/**
 * RoomLayout → Three.js Object3D + コライダ。材質ごとにジオメトリを結合して draw call を抑える。
 *
 * 統合担当向け: 呼び出し方（v1.3 で追加された部分）
 * - `new RoomBuilder(materials)` / `build(node, layout)` / `dispose(built)` のシグネチャは従来どおり。
 * - `builder.setTier(tier)`: Tier 変更時に呼ぶ（instances の個数・particles 上限・decals の有無に効く。構築済みの部屋は変わらない）。
 * - BuiltRoom の追加フィールド:
 *     chunks: RoomChunk[]      … 大部屋を chunkSize（既定 28 m）格子で分けた Group。RoomStreamingManager は毎フレーム
 *                                `RoomBuilder.updateChunkVisibility(built, cameraPos, tier.fogFar + chunkSize)` を呼ぶか、
 *                                自前で `chunk.group.visible` を距離 / 視錐台で切り替える。1 チャンクの部屋は chunks[0].group === built.group。
 *     zones: WorldZone[]       … ワールド AABB 化済みのゾーン。PlayerZone への変換は kind が一致するのでそのまま渡せる（theme / crawl / ride は物理では無視）。
 *     effects: RoomEffect[]    … 毎フレーム `for (const e of built.effects) e.update(dt, ctx)`（現在部屋 + 可視部屋）。dispose は builder.dispose が呼ぶ。
 *     dynamicColliders         … 可動要素のコライダ（ワールド、毎フレーム更新済み）。RoomStreamingManager.colliders() に `solid` のものを足す。
 *     fog                      … 部屋固有の霧（FogDepth）。Game.enterRoom で scene.fog / background の補間目標にする（無ければ palette.fog）。
 *     updateSign(id, text)     … サインの文字差し替え（DuplicateNumber / FakeSignage の時計など）。
 *     layout                   … 構築に使った RoomLayout。
 * - 扉開口は Socket.height / sill / crawl を反映する（低い開口・高いスロット）。扉パネル・コライダも開口に合わせる。
 * - RoomLayout.roll（E03）があれば rollFrom 以降の箱・照明・ラベル・サインを進行軸まわりに回して構築し、コライダも回転後の箱で作る。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AABB } from '../core/aabb';
import { aabbOverlap, aabbToWorld } from '../core/aabb';
import { Rng } from '../core/rng';
import { addDir, QUALITY_TIERS, rotQ, toWorld, type Dir, type Portal, type QualityTier, type RoomInstance, type Socket, type Vec3 } from '../core/types';
import type { Box, DynamicSpec, InstanceSpec, LabelSpec, MatId, ParticleSpec, RoomLayout, SignSpec, ZoneKind } from '../generators/layout';
import { MaterialLibrary, SURFACES, wetnessOverrides, L2_FLAGS, type ExternalOverrides, type MaterialOverrides, type UploadHandle } from './MaterialLibrary';
import { appearanceSeed, attachSurfaceAppearance, corridorWearRegion, corridorDustRegion, wetWallBoxes, doorSurfaceId } from './SurfaceAppearance';
import { surfaceBox, applyMetricUV, isBevelMat, SurfaceLighting } from './SurfaceGeometry';
import { allocateLightmapAtlas, createLightmapTexture, InstanceLighting, isLightmapTarget, LIGHTMAP_FADE_MS, LightmapBaker, LightmapSampler, lightmapsSupported, startLightmapCrossfade, writeConstantUV1, writeLightmapUV, type LightmapJobHandle } from './Lightmap';
import { vehicleSurfaces, foliageGeometry, grassGeometry } from './ObjectGeometry';
import { monumentSurfaces } from './MonumentGeometry';
import { detailedBoxes } from './ArchitecturalDetails';
import { PropCatalog, PROP_TRIANGLE_BUDGET, TILED_KINDS, type CatalogEntry, type LoadedProp } from './PropCatalog';
import { wallSpans } from '../generators/footprint';
import { WALL_T } from '../generators/layout';
import { SignAtlas, MAX_ATLASES_PER_ROOM } from './SignAtlas';
import { ROOM_BY_ID } from '../data';
import { buildDecalLayer } from './DecalLayer';
import { applyWearEffects } from './wearEffects';
import { applyBuildModifiers } from '../modifiers';
import { particleList } from '../generators/particles';
import type { RuntimeContext } from '../modifiers/types';

export interface DoorObject {
  portal: Portal;
  pivot: THREE.Group;
  /** 扉全体のルート（部屋グループとは独立に scene に置く: 両側の部屋のどちらかが見えていれば描く） */
  root: THREE.Group;
  panel: THREE.Mesh;
  /** 閉じているときのコライダ（ワールド） */
  collider: AABB;
  /** 扉面の中心（ワールド） */
  center: Vec3;
  /** 外向き方向（ワールド） */
  dir: Dir;
  angle: number; // 0 閉 / 1 開
  /** しゃがんで通る低い開口 */
  crawl?: boolean;
  /** 開口下端の高さ（床から） */
  sill: number;
}

/** 毎フレーム更新される部屋効果（Modifier が build フックで追加する）。ジオメトリは変えず uniform・位置・可視性だけ動かす */
export interface RoomEffect {
  update(dt: number, ctx: RuntimeContext): void;
  dispose(): void;
}

export interface RoomChunk {
  key: string;
  ix: number;
  iz: number;
  group: THREE.Group;
  /** ワールド AABB（userData.chunkBounds にも同じ値） */
  bounds: AABB;
  triangles: number;
}

export interface WorldZone {
  kind: ZoneKind;
  aabb: AABB;
  vector?: Vec3;
  params?: Record<string, unknown>;
}

export interface DynamicCollider {
  id: string;
  spec: DynamicSpec;
  mesh: THREE.Mesh;
  /** 現在位置のワールド AABB（毎フレーム更新） */
  aabb: AABB;
  solid: boolean;
}

export interface SignObject {
  id?: string;
  spec: SignSpec;
  mesh: THREE.Mesh;
  atlas: SignAtlas;
  cellIndex: number;
}

/** 部屋のライトマップ（担当 L1）。Worker の結果が届くと ready=true になり texture の中身が差し替わる */
export interface RoomLightmap {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  /** テクセルの一辺（m） */
  texel: number;
  /** 内側のテクセル数 / 面（アトラス矩形）数 */
  texels: number;
  faces: number;
  ready: boolean;
  /** Worker の計算時間（ms。到着後） */
  workerMs?: number;
  /** 構築からの到着までの時間（ms） */
  latencyMs?: number;
  failed?: string;
  /** 到着時の検証用: 置き換えた頂点焼き込みの平均輝度と、テクセルの平均輝度（大きく違えば到着時に明るさが飛ぶ） */
  vertexMean?: number;
  texelMean?: number;
  /** Worker が飛ばしたレイの本数（到着後） */
  rays?: number;
  /** クロスフェードの長さ（ms。到着後。頂点焼き込み → テクセル、インスタンスの定数値 → 床の値）と開始時刻（performance.now()） */
  fadeMs?: number;
  appliedAt?: number;
  /** InstancedMesh / glTF プロップの照明（到着後）: 旧値 / 新値の平均輝度比と、床から値を拾えたインスタンス数 */
  instances?: { ratio: number; sampled: number; total: number };
  /** 検証用: 対象の箱と 6 面の矩形（px, py, pw, ph）、黒テクセルの uv */
  debug?: { targets: Box[]; rects: ({ px: number; py: number; pw: number; ph: number } | null)[][]; blackU: number; blackV: number };
  job: LightmapJobHandle | null;
  /** Worker の結果が届いてから GPU に反映するまでの待ち（MaterialLibrary.uploads。1 フレームに 1 部屋分だけ反映する） */
  upload?: UploadHandle | null;
}

/** 構築の計時と分割の記録（RoomBuildJob と buildSteps が共有） */
interface BuildClock {
  /** 直前の mark からの起点（step の再開時に進める。フレーム間の待ち時間を段階に数えない） */
  t: number;
  prof: Record<string, number>;
  steps: number;
  frames: number;
}

/** 分割構築の 1 部屋あたりの結合ループの単位（この箱数ごとに中断できる） */
const BUILD_PARTS_PER_STEP = 24;

/**
 * 分割構築のハンドル（担当 L2）。RoomBuilder.beginBuild が返す。`step(deadline)` を呼ぶたびに構築を進め、deadline（performance.now 基準）
 * を過ぎたら次の中断点で戻る。`run()` は残りを一気に進める（見えている部屋の同期構築 = 従来の build と同じ）。
 * 出力（BuiltRoom）は分割の有無に依らず同じ（箱の処理順は変えない。乱数は node.seed の fork だけ）
 */
export class RoomBuildJob {
  readonly roomId: string;
  private readonly gen: Generator<void, BuiltRoom, void>;
  private readonly clock: BuildClock;
  private readonly cleanup: (() => void)[];
  private result: BuiltRoom | null = null;
  private finished = false;
  cancelled = false;

  constructor(roomId: string, gen: Generator<void, BuiltRoom, void>, clock: BuildClock, cleanup: (() => void)[]) {
    this.roomId = roomId; this.gen = gen; this.clock = clock; this.cleanup = cleanup;
  }

  get done(): boolean { return this.finished; }
  get built(): BuiltRoom | null { return this.result; }
  /** step を呼んだ回数（= またいだフレーム数） */
  get frames(): number { return this.clock.frames; }

  /** deadline まで進める。完了したら true */
  step(deadline: number): boolean {
    if (this.finished) return true;
    this.clock.t = performance.now();
    this.clock.frames++;
    for (;;) {
      const r = this.gen.next();
      this.clock.steps++;
      if (r.done) { this.result = r.value; this.finished = true; return true; }
      if (performance.now() >= deadline) return false;
    }
  }

  /** 残りを一気に進める */
  run(): BuiltRoom {
    if (this.cancelled) throw new Error(`RoomBuildJob ${this.roomId} was cancelled`);
    this.step(Infinity);
    return this.result!;
  }

  /** 途中で捨てる（部屋が対象から外れた / レイアウトが変わった）。途中で確保した材質・ライトマップ job を解放する */
  cancel(): void {
    if (this.finished || this.cancelled) return;
    this.cancelled = true;
    this.finished = true;
    try { this.gen.return(undefined as unknown as BuiltRoom); } catch { /* ignore */ }
    for (const f of this.cleanup) { try { f(); } catch (err) { console.warn('[RoomBuilder] cancel cleanup failed', err); } }
  }
}

/** 構築時に forRoom（部屋 seed のバリエーション + lightMap）で作られる材質の見込み（2 hop 先の先読み・事前コンパイル用） */
export interface RoomMaterialPlan {
  /** forRoom に渡される MatId（上限集合。プロップ置換で消える箱は除いていない） */
  ids: MatId[];
  /** variant(mat, overrides)（共有 variant。ライトマップ無し）で使われる MatId: 小さな箱・扉パネル・枠・可動要素・デカール */
  shared: MatId[];
  /** InstancedMesh（反復配置）で使われる MatId（USE_INSTANCING の別プログラム） */
  instanced: MatId[];
  overrides: MaterialOverrides;
  /** ライトマップ付き（forRoom）で作られるか。false なら共有 variant（先頭候補）だけで、先読みは不要 */
  lit: boolean;
}

export interface BuiltRoom {
  roomId: string;
  group: THREE.Group;
  /** 扉パネル群。所有部屋が非表示でも隣室側から見えるよう、部屋グループの外に置く */
  doorGroup: THREE.Group;
  colliders: AABB[];
  doors: Map<string, DoorObject>;
  lights: (THREE.PointLight | THREE.SpotLight)[];
  interactables: THREE.Object3D[];
  holes: AABB[];
  elevators: { socketId: string; volume: AABB }[];
  bounds: AABB;
  triangles: number;
  // ---- v1.3 ----
  layout: RoomLayout;
  chunks: RoomChunk[];
  zones: WorldZone[];
  effects: RoomEffect[];
  dynamicColliders: DynamicCollider[];
  signs: SignObject[];
  fog?: { color: number; near: number; far: number };
  /** テクセル単位のライトマップ（high / mid Tier、Worker が使える環境のみ）。無ければ頂点焼き込みだけ */
  lightmap?: RoomLightmap;
  updateSign(id: string, text: string, sub?: string): boolean;
}

/** Tier ごとのライトマップ設定。low は無し */
const LIGHTMAP_TIER: Record<string, { texel: number; maxSize: number; aoRays: number } | undefined> = {
  high: { texel: 0.25, maxSize: 512, aoRays: 24 },
  mid: { texel: 0.5, maxSize: 256, aoRays: 16 },
};
/** 動的 PointLight の強度倍率（従来 5）。直接光の拡散成分は焼き込み（頂点 / ライトマップ）が担うので、動的光は床の鏡面反射を
 *  残す程度に下げる（V04 手順 5）。器具 2 台に 1 灯なので拡散成分が残ると器具ごとの明るさが不揃いになる。
 *  担当 M の directDiffuseScale（docs/visual-requests.md）が入れば 3〜5 に戻して拡散だけを落とす */
const DYNAMIC_LIGHT_SCALE = 3.0; // 拡散は材質側の liminalDirectDiffuse（0.4）で抑えるので、鏡面反射担当として強めに戻す

const DEFAULT_CHUNK = 28;

export class RoomBuilder {
  private tier: QualityTier;

  constructor(private readonly materials: MaterialLibrary, private readonly opts: { tier?: QualityTier; worldSeed?: () => number } = {}) {
    this.tier = opts.tier ?? QUALITY_TIERS.high;
    // CC0 プロップのカタログ（index.json）を先に読み始める。最初の部屋の構築までに届けば kind 付きの箱が glTF に置き換わる
    // 材質の注入（bakedLight / colorMask / roomFog / 診断 / 共有 envMap）は MaterialLibrary.adoptExternal に任せる
    PropCatalog.shared.attach(materials);
    void PropCatalog.shared.preload();
  }

  setTier(tier: QualityTier): void { this.tier = tier; }

  /** 距離でチャンクの表示を切り替える簡易版（RoomStreamingManager から毎フレーム呼べる）。1 チャンクの部屋は何もしない */
  static updateChunkVisibility(built: BuiltRoom, cameraPos: THREE.Vector3, farDistance: number): void {
    if (built.chunks.length <= 1) return;
    for (const c of built.chunks) {
      const dx = Math.max(c.bounds.min[0] - cameraPos.x, 0, cameraPos.x - c.bounds.max[0]);
      const dy = Math.max(c.bounds.min[1] - cameraPos.y, 0, cameraPos.y - c.bounds.max[1]);
      const dz = Math.max(c.bounds.min[2] - cameraPos.z, 0, cameraPos.z - c.bounds.max[2]);
      c.group.visible = dx * dx + dy * dy + dz * dz < farDistance * farDistance;
    }
  }

  /** 同期構築（従来どおり一気に）。見えている部屋（入室時・扉を開けた瞬間）はこちら */
  build(node: RoomInstance, layout: RoomLayout): BuiltRoom {
    return this.beginBuild(node, layout).run();
  }

  /**
   * 分割構築（担当 L2）。準備 → 箱の結合を BUILD_PARTS_PER_STEP 個ずつ → 結合メッシュ → デカール → 反復配置 → プロップ → 仕上げ の
   * 中断点を持つジョブを返す。RoomStreamingManager.buildPending が後回しの部屋をフレーム予算の範囲で進める
   */
  beginBuild(node: RoomInstance, layout: RoomLayout): RoomBuildJob {
    const clock: BuildClock = { t: performance.now(), prof: {}, steps: 0, frames: 0 };
    const cleanup: (() => void)[] = [];
    return new RoomBuildJob(node.roomId, this.buildSteps(node, layout, clock, cleanup), clock, cleanup);
  }

  /**
   * 構築時に部屋 seed の材質（forRoom）で作られる MatId の見込みと上書き。RoomBuilder.build と同じ判定（Tier のライトマップ設定、
   * legacy / ロール / Worker の有無、detailedBoxes、Theater の張地、isLightmapTarget）を使う。Game が 2 hop 先の先読みと事前コンパイルに使う
   */
  static materialPlan(node: RoomInstance, layout: RoomLayout, tier: QualityTier): RoomMaterialPlan {
    const definition = ROOM_BY_ID.get(node.definitionId);
    const render = layout.render;
    const legacy = render?.style === 'legacy';
    const untextured = render?.style === 'untextured';
    const overrides = overridesFor(layout);
    const lit = !!LIGHTMAP_TIER[tier.id] && !legacy && !(layout.roll ?? 0) && lightmapsSupported();
    const ids = new Set<MatId>();
    const shared = new Set<MatId>();
    const instanced = new Set<MatId>();
    // kind 'emitOnly' は焼き込みの光源にだけ数え、描かない（光源の無い明るい一角。oddity）
    const boxes = (legacy ? layout.boxes : detailedBoxes(layout, definition?.baseTemplate)).filter((b) => b.kind !== 'emitOnly' && b.kind !== 'colliderOnly');
    for (const original of boxes) {
      const themed = original.propGroup && original.kind === 'plant' ? { ...original, mat: 'paintWhite' as const } : original.mat === 'plant' && !legacy && Math.min(...original.max.map((v,k)=>v-original.min[k]))>.15 ? {...original,mat:'plantLeaf' as const} : definition?.baseTemplate === 'Theater' && original.mat === 'furnitureDark' ? { ...original, mat: 'upholstery' as const } : original;
      const s = SURFACES[themed.mat];
      if (!s) continue;
      if (lit && !untextured && isLightmapTarget(themed, !!s.emission, !!s.decal)) ids.add(themed.mat);
      else shared.add(untextured ? 'untextured' : themed.mat);
    }
    if (lit && untextured) ids.add('untextured');
    // 扉パネル（untextured でも通常材質）・枠・格子・可動要素・デカール・反復配置
    shared.add(layout.palette.door);
    shared.add('doorMetal');
    shared.add(untextured ? 'untextured' : 'trim');
    for (const d of layout.decals ?? []) if (tier.decals && SURFACES[d.mat]) shared.add(untextured ? 'untextured' : d.mat);
    for (const d of layout.dynamics ?? []) if (SURFACES[d.box.mat]) shared.add(untextured ? 'untextured' : d.box.mat);
    for (const i of layout.instances ?? []) if (SURFACES[i.mat]) instanced.add(untextured ? 'untextured' : i.mat);
    for (const id of ids) shared.delete(id);
    return { ids: [...ids], shared: [...shared], instanced: [...instanced], overrides, lit };
  }

  private *buildSteps(node: RoomInstance, layout: RoomLayout, clock: BuildClock, cleanup: (() => void)[]): Generator<void, BuiltRoom, void> {
    // 段階別の計時（フリーズ調査用。window.__buildProfile に最新 200 件）。分割構築では step の再開時に clock.t が進むので、
    // フレーム間の待ち時間は段階に数えない
    const prof = clock.prof;
    const mark = (k: string) => { const now = performance.now(); prof[k] = (prof[k] ?? 0) + (now - clock.t); clock.t = now; };
    const p = node.placement!;
    const tier = this.tier;
    const group = new THREE.Group();
    group.name = node.roomId;
    group.position.set(p.position[0], p.position[1], p.position[2]);
    group.rotation.y = (p.yawQ * Math.PI) / 2;
    const doorGroup = new THREE.Group();
    doorGroup.name = `${node.roomId}/doors`;
    doorGroup.position.copy(group.position);
    doorGroup.rotation.y = group.rotation.y;

    const definition = ROOM_BY_ID.get(node.definitionId);
    const render = layout.render;
    const legacy = render?.style === 'legacy';
    const untextured = render?.style === 'untextured';
    // 途中で捨てられたとき: ラベル・サインのテクスチャを先行アップロードから外して解放する（GPU には何も載っていない）
    cleanup.push(() => {
      for (const root of [group, doorGroup]) root.traverse((o) => {
        const d = o.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined;
        if (d) for (const x of d) { if (x instanceof THREE.Texture) this.materials.uploads.cancel(x); x.dispose(); }
      });
      for (const a of (group.userData.signAtlases as SignAtlas[] | undefined) ?? []) { this.materials.uploads.cancel(a.texture); a.dispose(); }
    });

    // 材質の部屋別上書き（uniform 値だけ違うものはプログラムを共有する）
    const overrides = overridesFor(layout);
    const materialFor = (mat: MatId): THREE.MeshStandardMaterial => this.materials.variant(untextured ? 'untextured' : mat, overrides);
    /** 扉パネルは untextured でも通常材質（出口だけが目印） */
    const doorMaterialFor = (mat: MatId): THREE.MeshStandardMaterial => this.materials.variant(mat, overrides);

    // E03 ロール: rollFrom 以降の箱・照明・ラベル・サインを進行軸まわりに回した作業用レイアウトを作る
    const roll = layout.roll ?? 0;
    const rollFn = roll ? makeRoll(layout) : null;
    const rollFrom = layout.rollFrom ?? layout.shellCount ?? 0;
    const workBoxes = rollFn ? layout.boxes.map((b, i) => (i >= rollFrom ? rollBox(b, rollFn) : b)) : layout.boxes;
    const workLights = rollFn ? layout.lights.map((l) => ({ ...l, pos: rollFn.point(l.pos) })) : layout.lights;
    const work: RoomLayout = rollFn ? { ...layout, boxes: workBoxes, lights: workLights } : layout;

    mark('setup');
    // 材質ごとに結合（チャンク単位）
    const colliders: AABB[] = [];
    let triangles = 0;
    // kind 付きの箱 → CC0 glTF プロップ（見た目だけ。コライダ・レイアウトは箱のまま）。E03 ロール・legacy / untextured では置換しない
    const catalog = PropCatalog.shared;
    // プロップ材質にも部屋固有の霧（FogDepth）と色欠損（ColorMissing）を効かせる
    const propOverrides: ExternalOverrides = {};
    if (render?.fog) propOverrides.fog = render.fog;
    if (render?.colorMask) propOverrides.colorMask = render.colorMask;
    const propGroups = new Map<string, Box[]>();
    for (const b of work.boxes) if (b.propGroup) { const list=propGroups.get(b.propGroup)??[];list.push(b);propGroups.set(b.propGroup,list); }
    const groupedBoxes: Box[] = [...propGroups].map(([id,bs])=>({ ...bs[0], propGroup:id, kind:bs.find(b=>b.kind)?.kind, min:[0,1,2].map(k=>k===1 && bs.some(b=>b.kind==='plant') ? Math.max(...bs.filter(b=>b.kind==='plant').map(b=>b.min[1]+(b.max[1]-b.min[1])*.84)) : Math.min(...bs.map(b=>b.min[k]))) as Vec3, max:[0,1,2].map(k=>Math.max(...bs.map(b=>b.max[k]))) as Vec3 }));
    const propWork = { ...work, boxes:work.boxes.filter(b=>!b.propGroup).concat(groupedBoxes) };
    const propPlan = !legacy && !untextured && !roll && catalog.ready ? planProps(propWork, new Rng(node.seed).fork('props'), catalog) : [];
    const vehicles = !legacy && !roll ? vehicleSurfaces(work.boxes) : [];
    cleanup.push(()=>vehicles.forEach(v=>v.geometry.dispose()));
    // モニュメント（謎の物体）: 部品列をプリミティブで組み立て、vehicles と同じ special 部品として結合する
    const monuments = !legacy && !roll ? monumentSurfaces(work) : [];
    cleanup.push(() => monuments.forEach((v) => v.geometry.dispose()));
    const replaced = new Set(propPlan.flatMap(pp => pp.box.propGroup ? propGroups.get(pp.box.propGroup)!.filter(b=>b.mat==='plant') : [pp.box]));
    if (vehicles.length) for (const b of work.boxes) if (b.vehicle) replaced.add(b);
    const visibleWork = replaced.size ? { ...work, boxes: work.boxes.filter((b) => !replaced.has(b)) } : work;
    let displayBoxes = (legacy ? work.boxes : detailedBoxes(visibleWork, definition?.baseTemplate)).filter((b) => b.kind !== 'emitOnly' && b.kind !== 'colliderOnly');
    if(!legacy) for(const b of visibleWork.boxes) if(b.propGroup && b.kind==='plant') {
      const r=Math.min(b.max[0]-b.min[0],b.max[2]-b.min[2])*.425, x=(b.min[0]+b.max[0])/2,z=(b.min[2]+b.max[2])/2,y=b.min[1]+(b.max[1]-b.min[1])*.84;
      displayBoxes.push({min:[x-r,y-.01,z-r],max:[x+r,y,z+r],mat:'plantSoil',solid:false});
    }
    // デカール（Tier で省略）: 薄い非ソリッド箱として同じ経路で描く
    if (layout.decals?.length && tier.decals) displayBoxes = displayBoxes.concat(layout.decals.map(decalBox));
    const officeLighting = definition?.baseTemplate === 'CorridorOffice';
    // 焼き込みの遮蔽体には置換した箱も含める（プロップが占める体積の近似）
    const bake = new SurfaceLighting({ ...work, boxes: replaced.size ? displayBoxes.concat([...replaced]) : displayBoxes }, officeLighting, { ...(layout.lighting ?? {}), roll: !!roll });
    // InstancedMesh / glTF プロップの照明（担当 P3）: 到着前は bake.sample の定数値、ライトマップ到着で足元の床の値へフェード
    const shading = new InstanceLighting();
    for (const original of workBoxes) if (original.solid) colliders.push(aabbToWorld(original, p));

    // チャンク格子
    const chunkSize = layout.chunkSize ?? DEFAULT_CHUNK;
    const bw = layout.bounds.max[0] - layout.bounds.min[0];
    const bd = layout.bounds.max[2] - layout.bounds.min[2];
    const nx = Math.max(1, Math.ceil(bw / chunkSize - 1e-6));
    const nz = Math.max(1, Math.ceil(bd / chunkSize - 1e-6));
    const single = nx * nz === 1;
    const chunks: RoomChunk[] = [];
    const chunkGroups: THREE.Group[] = [];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const g = single ? group : new THREE.Group();
        const local: AABB = {
          min: [layout.bounds.min[0] + ix * chunkSize, layout.bounds.min[1], layout.bounds.min[2] + iz * chunkSize],
          max: [Math.min(layout.bounds.max[0], layout.bounds.min[0] + (ix + 1) * chunkSize), layout.bounds.max[1], Math.min(layout.bounds.max[2], layout.bounds.min[2] + (iz + 1) * chunkSize)],
        };
        const bounds = aabbToWorld(local, p);
        if (!single) { g.name = `${node.roomId}/chunk${ix},${iz}`; group.add(g); }
        g.userData.chunkBounds = bounds;
        chunks.push({ key: `${ix},${iz}`, ix, iz, group: g, bounds, triangles: 0 });
        chunkGroups.push(g);
      }
    }
    const chunkIndexOf = (x: number, z: number): number => {
      if (single) return 0;
      const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - layout.bounds.min[0]) / chunkSize)));
      const iz = Math.min(nz - 1, Math.max(0, Math.floor((z - layout.bounds.min[2]) / chunkSize)));
      return iz * nx + ix;
    };

    // チャンク格子をまたぐ箱（部屋全長の床・天井・外壁）は格子で分割して各チャンクへ入れる。中心座標のチャンクだけに入れると、
    // そのチャンクが距離カリングされたときに部屋の反対側に立つプレイヤーの足元の床・壁が消える。
    // 面取り材質（継ぎ目に角が出る）と特殊形状（rubber 円柱 / plant 球）は分割せず、代わりに入れたチャンクの AABB を実ジオメトリまで広げる
    const cellOf = (v: number, origin: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor((v - origin) / chunkSize)));
    const splitByChunk = (b: Box): Box[] => {
      if (single || isBevelMat(b.mat)) return [b];
      const ox = layout.bounds.min[0];
      const oz = layout.bounds.min[2];
      const ix0 = cellOf(b.min[0] + 1e-4, ox, nx);
      const ix1 = cellOf(b.max[0] - 1e-4, ox, nx);
      const iz0 = cellOf(b.min[2] + 1e-4, oz, nz);
      const iz1 = cellOf(b.max[2] - 1e-4, oz, nz);
      if (ix0 === ix1 && iz0 === iz1) return [b];
      const out: Box[] = [];
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const x0 = ix === ix0 ? b.min[0] : ox + ix * chunkSize;
          const x1 = ix === ix1 ? b.max[0] : ox + (ix + 1) * chunkSize;
          const z0 = iz === iz0 ? b.min[2] : oz + iz * chunkSize;
          const z1 = iz === iz1 ? b.max[2] : oz + (iz + 1) * chunkSize;
          if (x1 - x0 > 1e-4 && z1 - z0 > 1e-4) out.push({ ...b, min: [x0, b.min[1], z0], max: [x1, b.max[1], z1] });
        }
      }
      return out;
    };
    // チャンクごとの実ジオメトリのローカル AABB（格子セルを初期値に、入れた箱で広げる）
    const chunkLocal: AABB[] = chunks.map((_, i) => {
      const ix = i % nx;
      const iz = Math.floor(i / nx);
      return {
        min: [layout.bounds.min[0] + ix * chunkSize, layout.bounds.min[1], layout.bounds.min[2] + iz * chunkSize],
        max: [Math.min(layout.bounds.max[0], layout.bounds.min[0] + (ix + 1) * chunkSize), layout.bounds.max[1], Math.min(layout.bounds.max[2], layout.bounds.min[2] + (iz + 1) * chunkSize)],
      };
    });
    const growChunk = (ci: number, b: Box): void => {
      const c = chunkLocal[ci];
      for (let k = 0; k < 3; k++) {
        if (b.min[k] < c.min[k]) c.min[k] = b.min[k];
        if (b.max[k] > c.max[k]) c.max[k] = b.max[k];
      }
    };

    if(definition?.id==='R01' && !legacy && !untextured && !roll)
      displayBoxes=wetWallBoxes(displayBoxes,work.boxes.filter(b=>b.mat==='waterShallow'),layout.palette.wall);
    // ---- ライトマップ（テクセル焼き込み。担当 L1。src/render/Lightmap.ts / lightmap.worker.ts）
    // 外殻と大きな家具の面にアトラス矩形を割り当て、結合前のジオメトリに uv1 を書く。テクスチャは 0 埋めで作り、
    // Worker の結果が届いたら中身を差し替える（材質・ジオメトリの再構築なし）。low Tier / legacy / ロール / Worker 無しでは頂点焼き込みだけ
    const lmCfg = LIGHTMAP_TIER[tier.id];
    const lmWanted = !!lmCfg && !legacy && !rollFn && lightmapsSupported();
    interface Part { b: Box; special: boolean; target: number; geometry?: THREE.BufferGeometry }
    const parts: Part[] = [];
    const lmTargets: Box[] = [];
    for (const original of displayBoxes) {
      const themed = original.propGroup && original.kind === 'plant' ? { ...original, mat: 'paintWhite' as const } : original.mat === 'plant' && !legacy && Math.min(...original.max.map((v,k)=>v-original.min[k]))>.15 ? {...original,mat:'plantLeaf' as const} : definition?.baseTemplate === 'Theater' && original.mat === 'furnitureDark' ? { ...original, mat: 'upholstery' as const } : original;
      const osx = themed.max[0] - themed.min[0];
      const osy = themed.max[1] - themed.min[1];
      const special = !legacy && (!!themed.propGroup || (themed.mat === 'rubber' && osx < .3 && osy > .4) || (themed.mat === 'plantLeaf') || themed.mat === 'puddle');
      const target = lmWanted && !special && isLightmapTarget(themed, !!SURFACES[themed.mat].emission, !!SURFACES[themed.mat].decal);
      for (const b of special ? [themed] : splitByChunk(themed)) {
        if (b.max[0] - b.min[0] <= 0.0001 || b.max[1] - b.min[1] <= 0.0001 || b.max[2] - b.min[2] <= 0.0001) continue;
        let ti = -1;
        if (target) { ti = lmTargets.length; lmTargets.push(b); }
        parts.push({ b, special, target: ti });
      }
    }
    for (const v of vehicles) parts.push({ b: v.box, special: true, target: -1, geometry: v.geometry });
    for (const v of monuments) parts.push({ b: v.box, special: true, target: -1, geometry: v.geometry });
    // 隠れた面（スラブの外側・家具の底）の判定に使う外殻の箱
    const shellCount = layout.shellCount ?? 0;
    const shellBoxes = (shellCount > 0 ? work.boxes.slice(0, shellCount) : work.boxes).filter((b) => b.solid && /^(floor|ceiling|wall)/.test(b.mat));
    const atlas = lmWanted && lmTargets.length && lmCfg
      ? allocateLightmapAtlas(lmTargets, { texel: lmCfg.texel, maxSize: lmCfg.maxSize, footprint: layout.footprint, bounds: layout.bounds, shell: shellBoxes })
      : null;
    const lmTex = atlas ? createLightmapTexture(atlas.width, atlas.height) : null;
    // palette / height: 部屋別 envMap（P2。MaterialLibrary.roomEnvironment。low Tier / legacy / untextured では共有のまま）
    const lmMaterialFor = (mat: MatId): THREE.MeshStandardMaterial => this.materials.forRoom(untextured ? 'untextured' : mat, { roomId: node.roomId, seed: node.seed, overrides, lightMap: lmTex, lightMapIntensity: 1, palette: layout.palette, height: layout.height });
    mark('lightmapPlan');
    yield; // 中断点: 準備が終わった

    const byChunk: Map<MatId, THREE.BufferGeometry[]>[] = chunks.map(() => new Map());
    /** 材質ごとの結合メッシュの中で、ライトマップ対象の頂点範囲（[start, count] の列）と現在の頂点オフセット */
    const lmByChunk: Map<MatId, { ranges: number[]; offset: number }>[] = chunks.map(() => new Map());
    for (let pi = 0; pi < parts.length; pi++) {
      if (pi > 0 && pi % BUILD_PARTS_PER_STEP === 0) yield; // 中断点: 箱 BUILD_PARTS_PER_STEP 個ごと
      const part = parts[pi];
      const b = part.b;
      const source = b;
      const sx = b.max[0] - b.min[0];
      const sy = b.max[1] - b.min[1];
      const sz = b.max[2] - b.min[2];
      let g: THREE.BufferGeometry;
      if (part.geometry) {
        g = part.geometry;
        applyMetricUV(g, b.mat);
      } else if (!legacy && b.mat === 'puddle') {
        // 水たまり: 箱の足跡に収まる不定形の平面（角の無い輪郭。中心座標で決まる固定シード）
        g = puddleGeometry(b);
        applyMetricUV(g, b.mat);
      } else if (!legacy && b.mat === 'plantSoil') {
        g=new THREE.CylinderGeometry(sx/2,sx/2,sy,32);g.translate((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);applyMetricUV(g,b.mat);
      } else if (!legacy && b.propGroup && b.kind === 'plant') {
        const radius=Math.min(sx,sz)/2;
        const profile=[[0,0],[radius*.7,0],[radius,sy*.95],[radius,sy],[radius*.88,sy],[radius*.86,sy*.82],[0,sy*.82]].map(([x,y])=>new THREE.Vector2(x,y));
        g=new THREE.LatheGeometry(profile,32);
        g.translate((b.min[0]+b.max[0])/2,b.min[1],(b.min[2]+b.max[2])/2);
        applyMetricUV(g,b.mat);
      } else if (!legacy && b.mat === 'rubber' && sx < .3 && sy > .4) {
        g = new THREE.CylinderGeometry(sy / 2, sy / 2, sx, 16);
        g.rotateZ(Math.PI / 2);
        g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
        applyMetricUV(g, b.mat);
      } else if (!legacy && b.mat === 'plantLeaf') {
        g = foliageGeometry(b, tier.id === 'low' ? .45 : 1);
        applyMetricUV(g, b.mat);
      } else g = surfaceBox(b, { legacy });
      mark('geo');
      // uv1（ライトマップ）。結合する全ジオメトリが同じ属性集合を持つ必要があるので、対象外の箱にも黒テクセルの uv1 を付ける
      let lmRanges: [number, number][] | null = null;
      if (atlas) {
        if (part.target >= 0) lmRanges = writeLightmapUV(g, b, atlas.rects[part.target], atlas);
        else writeConstantUV1(g, atlas.blackU, atlas.blackV);
      }
      mark('uv1');
      attachSurfaceAppearance(g, appearanceSeed(this.opts.worldSeed?.() ?? node.seed, node.roomId, b.mat),
        !legacy && !untextured && !roll && definition?.baseTemplate === 'CorridorOffice' && /^floor/.test(b.mat)
          ? corridorWearRegion(b,layout.footprint) : [0,0,0,0],
        legacy || untextured || roll ? [0,0,0,0] : b.environment ??
        (definition?.id==='C02' && /^floor/.test(b.mat) && sy<.3 && b.max[1]<.1
          ? corridorDustRegion(b,layout.footprint) : [0,0,0,0]));
      mark('appearance');
      bake.bake(g, source);
      mark('bake');
      // Rounded boxes are non-indexed; merge all surfaces in that common format.
      if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
      mark('flat');
      const ci = chunkIndexOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
      const byMat = byChunk[ci];
      if (!byMat.has(b.mat)) byMat.set(b.mat, []);
      byMat.get(b.mat)!.push(g);
      const vcount = g.getAttribute('position').count;
      if (atlas) {
        let e = lmByChunk[ci].get(b.mat);
        if (!e) lmByChunk[ci].set(b.mat, e = { ranges: [], offset: 0 });
        if (lmRanges) for (const [s, c] of lmRanges) e.ranges.push(e.offset + s, c);
        e.offset += vcount;
      }
      if (!single) growChunk(ci, b);
      triangles += vcount / 3;
    }
    // チャンク AABB を実ジオメトリの範囲に更新（距離カリングは bounds で判定する）
    if (!single) {
      chunks.forEach((c, ci) => {
        c.bounds = aabbToWorld(chunkLocal[ci], p);
        c.group.userData.chunkBounds = c.bounds;
      });
    }
    mark('loopOther');
    yield; // 中断点: 箱の結合前
    // ここから forRoom（部屋専用材質の確保・CC0 セットの参照）が始まる。途中で捨てられたら releaseRoom で戻す
    cleanup.push(() => this.materials.releaseRoom(node.roomId));
    /** ライトマップ付きのメッシュと、到着時に 0 にする bakedLight の頂点範囲 */
    const lmMeshes: { mesh: THREE.Mesh; ranges: number[] }[] = [];
    byChunk.forEach((byMat, ci) => {
      for (const [mat, geos] of byMat) {
        const merged = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!merged) continue;
        const lmInfo = atlas ? lmByChunk[ci].get(mat) : undefined;
        const lit = !!lmInfo && lmInfo.ranges.length > 0;
        const mesh = new THREE.Mesh(merged, lit ? lmMaterialFor(mat) : materialFor(mat));
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        // 影の受け口（担当 P が主要 1〜2 灯にシャドウマップを付ける）: 外殻・家具は投影・受影、発光箔・ガラス・水・デカールは投影しない
        const s = SURFACES[mat];
        const solidLook = !s.emission && !s.decal && s.opacity === undefined && !/^(sky|water)/.test(mat);
        mesh.castShadow = solidLook;
        mesh.receiveShadow = !s.emission;
        chunkGroups[ci].add(mesh);
        chunks[ci].triangles += merged.getAttribute('position').count / 3;
        if (lit && lmInfo) lmMeshes.push({ mesh, ranges: lmInfo.ranges });
      }
    });

    mark('shellBakeMerge');
    yield; // 中断点: 結合メッシュができた
    // Worker へ焼き込みを依頼（結果は非同期。部屋が dispose されたら捨てる）
    let lightmap: RoomLightmap | undefined;
    if (atlas && lmTex && lmCfg && lmMeshes.length) {
      const info: RoomLightmap = { texture: lmTex, width: atlas.width, height: atlas.height, texel: atlas.texel, texels: atlas.texelCount, faces: atlas.faceCount, ready: false, job: null, upload: null,
        debug: { targets: lmTargets, rects: atlas.rects, blackU: atlas.blackU, blackV: atlas.blackV } };
      // faces は Worker へ転送（transfer）されて元の配列が空になるので、到着後の CPU サンプル（LightmapSampler）用にコピーを渡す
      const req = { ...bake.payload(), width: atlas.width, height: atlas.height, faces: atlas.faces.slice(), aoRays: lmCfg.aoRays };
      const started = performance.now();
      this.materials.track(lmTex);
      info.job = LightmapBaker.shared.enqueue(req, () => group.visible, (res) => {
        info.job = null;
        // 反映（画像データの差し替え + ライトマップ対象の頂点焼き込みを 0 に）。テクスチャの GPU アップロード（512² HalfFloat = 2 MB）は
        // 先行アップロードの待ち行列が同じフレームに 1 部屋分だけ流す（描画側で複数部屋分が重なる停止を避ける）。
        // 差し替えと 0 化は同じフレームで行う（片方だけだと明るさが飛ぶ）
        const apply = () => {
          (lmTex.image as unknown as { data: Uint16Array }).data = res.data;
          lmTex.needsUpdate = true;
          let vSum = 0, vN = 0;
          for (const { mesh, ranges } of lmMeshes) {
            const attr = mesh.geometry.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
            if (!attr) continue;
            const arr = attr.array as Float32Array;
            for (let i = 0; i < ranges.length; i += 2) {
              const s = ranges[i] * 3, e = (ranges[i] + ranges[i + 1]) * 3;
              for (let k = s; k < e; k += 3) { vSum += 0.2126 * arr[k] + 0.7152 * arr[k + 1] + 0.0722 * arr[k + 2]; vN++; }
            }
          }
          // クロスフェード（担当 P3）: 頂点焼き込みを 1 − t で減衰、lightMapIntensity を t で立ち上げる（LIGHTMAP_FADE_MS）。
          // 完了時に対象頂点の bakedLight は 0 になる（二重加算を避ける。従来はここで即 0 埋めしていた）
          const now = performance.now();
          startLightmapCrossfade(lmMeshes, now);
          // InstancedMesh / glTF プロップ: 足元の床のライトマップ値へ同じ時間でフェード
          shading.apply(new LightmapSampler(atlas, res.data), now);
          info.fadeMs = LIGHTMAP_FADE_MS;
          info.appliedAt = now;
          info.instances = { ratio: shading.ratio, sampled: shading.stats.sampled, total: shading.stats.total };
          info.vertexMean = vN ? vSum / vN : 0;
          info.texelMean = res.stats.mean;
          info.rays = res.stats.rays;
          info.ready = true;
          info.workerMs = res.ms;
          info.latencyMs = performance.now() - started;
          info.upload = null;
          this.materials.uploadStats.lightmaps++;
        };
        if (L2_FLAGS.queue) info.upload = this.materials.uploads.enqueue(lmTex, { big: true, lightmap: true, priority: group.visible ? 0 : 1, run: apply });
        else apply();
      }, (reason) => { info.failed = reason; info.job = null; });
      lightmap = info;
      cleanup.push(() => { info.job?.cancel(); info.job = null; info.upload?.cancel(); lmTex.dispose(); });
    } else if (lmTex) lmTex.dispose();
    group.userData.lightmap = lightmap;
    mark('lightmapEnqueue');
    // ライト（種別は PointLight に統一。可視ライトの種別構成 numPointLights / numSpotLights が変わるたびに three.js が
    // 画面内の全材質プログラムを再コンパイルするため、SpotLight は使わない。オフィス照明の下向きの見え方は SurfaceLighting の焼き込みが担う。
    // 可視本数は RoomStreamingManager.updateLights がダミーで Tier 上限に固定する）
    const lights: (THREE.PointLight | THREE.SpotLight)[] = [];
    for (const l of workLights) {
      const light = new THREE.PointLight(l.color, l.intensity * DYNAMIC_LIGHT_SCALE, l.distance, 2);
      light.position.set(l.pos[0], l.pos[1], l.pos[2]);
      light.visible = false;
      light.userData.baseIntensity = l.intensity * DYNAMIC_LIGHT_SCALE;
      group.add(light);
      lights.push(light);
    }

    // 扉（この部屋が所有する door ポータルのみ）
    const doors = new Map<string, DoorObject>();
    const interactables: THREE.Object3D[] = [];
    // 戻り側（isReturn）の扉も作る: 所有部屋が未構築のときだけ表示し、扉の無い黒い開口を見せない
    for (const portal of node.portals) {
      if (portal.type !== 'door') continue;
      const s = layout.sockets.find((x) => x.id === portal.socketId);
      if (!s) continue;
      const door = this.buildDoor(node, portal, s, doorGroup, layout, doorMaterialFor);
      doors.set(portal.portalId, door);
      interactables.push(door.panel);
    }

    // Portal frames, including return sockets; geometry never narrows the opening.
    const frameGeometries: THREE.BufferGeometry[] = [];
    for (const socket of layout.sockets) {
      if (socket.type !== 'door') continue;
      const frame = new THREE.Group();
      frame.position.set(socket.pos[0], socket.pos[1], socket.pos[2]); frame.rotation.y = socket.dir * Math.PI / 2;
      const w = socket.width / 2, h = socket.height, y0 = socket.sill ?? 0;
      // しゃがみ開口は枠を細く
      const t = socket.crawl ? .04 : .065;
      // 共有面（z=0）を越えない（隣室の枠と重ならない）。開口側へ 2cm 出し、壁の端面・まぐさ底面と同一平面にしない
      const parts: { min: Vec3; max: Vec3 }[] = [
        { min: [-w - t, y0, -.18], max: [-w + .02, y0 + h + t, -.001] },
        { min: [w - .02, y0, -.18], max: [w + t, y0 + h + t, -.001] },
        { min: [-w + .02, y0 + h - .02, -.18], max: [w - .02, y0 + h + t, -.001] },
      ];
      // 見付の 2 段目（ケーシング）: 内側の枠より 3.5 cm 広く、壁面（z = -.15）から 1.5 cm だけ出る薄い帯。しゃがみ開口には付けない
      if (!socket.crawl) {
        const t2 = .035;
        parts.push(
          { min: [-w - t - t2, y0, -.165], max: [-w - t + .002, y0 + h + t + t2, -.14] },
          { min: [w + t - .002, y0, -.165], max: [w + t + t2, y0 + h + t + t2, -.14] },
          { min: [-w - t + .002, y0 + h + t - .002, -.165], max: [w + t - .002, y0 + h + t + t2, -.14] },
        );
      }
      // 高い開口（sill > 0）は下枠も付ける
      if (y0 > .05) parts.push({ min: [-w + .02, y0 - t, -.18], max: [w - .02, y0 + .02, -.001] });
      for (const part of parts) {
        const geom = surfaceBox({ min: part.min, max: part.max, mat: 'trim', solid: false }, { legacy });
        geom.setAttribute('bakedLight', new THREE.Float32BufferAttribute(Array.from({length: geom.getAttribute('position').count * 3}, () => .4), 3));
        frame.updateMatrix();
        geom.applyMatrix4(frame.matrix);
        if (geom.index) { const flat = geom.toNonIndexed(); geom.dispose(); frameGeometries.push(flat); }
        else frameGeometries.push(geom);
      }
    }
    if (frameGeometries.length) {
      const merged = mergeGeometries(frameGeometries, false);
      frameGeometries.forEach(g => g.dispose());
      if (merged) {
        const frames = new THREE.Mesh(merged, materialFor('trim'));
        frames.castShadow = true;
        frames.receiveShadow = true;
        group.add(frames);
      }
    }

    mark('lightsDoorsFrames');
    // ラベル
    for (const lb of layout.labels) group.add(this.buildLabel(lb, rollFn, legacy));

    // サイン（アトラス。部屋あたり最大 3 枚 = 48 サイン）
    const signs: SignObject[] = [];
    const atlases: SignAtlas[] = [];
    for (const spec of layout.signs ?? []) {
      let atlas = atlases[atlases.length - 1];
      if (!atlas || atlas.full) {
        if (atlases.length >= MAX_ATLASES_PER_ROOM) break;
        atlas = new SignAtlas();
        atlases.push(atlas);
      }
      const { geometry, material, cellIndex } = atlas.add(spec);
      const mesh = new THREE.Mesh(geometry, material);
      const pos = rollFn ? rollFn.point(spec.pos) : spec.pos;
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.quaternion.copy(facing(spec.dir, rollFn));
      mesh.userData.signId = spec.id;
      group.add(mesh);
      signs.push({ id: spec.id, spec, mesh, atlas, cellIndex });
    }
    group.userData.signAtlases = atlases;
    // サインのアトラス（1024² の CanvasTexture）も先行アップロードへ（全セルを描いた後に 1 回）
    for (const atlas of atlases) {
      this.materials.track(atlas.texture);
      if (L2_FLAGS.queue) this.materials.uploads.enqueue(atlas.texture, { big: true, priority: 1 });
    }

    // 蓋をした穴（配置できなかった hole）: 金属グレーチングで塞ぐ
    for (const portal of node.portals) {
      if (portal.type !== 'hole' || !portal.locked || portal.isReturn) continue;
      const s = layout.sockets.find((x) => x.id === portal.socketId);
      if (!s) continue;
      const half = s.width / 2 + 0.1;
      const grate = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.08, half * 2), materialFor('metal'));
      grate.position.set(s.pos[0], 0.04, s.pos[2]);
      group.add(grate);
      colliders.push(aabbToWorld({ min: [s.pos[0] - half, -0.02, s.pos[2] - half], max: [s.pos[0] + half, 0.08, s.pos[2] + half] }, p));
    }
    // エレベーターの呼びボタン（インタラクト対象）
    for (const e of layout.elevators) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.22), this.materials.get('lightWarm'));
      btn.position.set(e.button[0], e.button[1], e.button[2]);
      btn.rotation.y = (e.buttonDir * Math.PI) / 2;
      btn.userData = { roomId: node.roomId, portalId: e.socketId, kind: 'elevator' };
      group.add(btn);
      interactables.push(btn);
    }

    const effects: RoomEffect[] = [];

    mark('labelsSigns');
    // デカール層（コンセント・スイッチ・貼り紙・扉下の汚れ・壁際の埃など。担当 D: src/render/DecalLayer.ts）
    {
      const dl = buildDecalLayer({ node, layout, definition: definition ?? null, group, chunkGroups, chunkIndexOf, placement: p, tier, materials: this.materials, bake, legacy, untextured, roll: !!rollFn });
      triangles += dl.triangles;
      effects.push(...dl.effects);
    }
    mark('decals');
    yield; // 中断点: デカールまで
    // InstancedMesh（反復配置）。チャンクごとに 1 InstancedMesh、Tier の instanceScale で間引く
    for (const spec of layout.instances ?? []) {
      triangles += this.buildInstances(spec, chunks, chunkGroups, chunkIndexOf, materialFor, bake, shading, tier, colliders, p, legacy);
    }

    mark('instances');
    yield; // 中断点: 反復配置まで
    // CC0 プロップ（読込済みなら即、未読込なら箱の仮表示 → 到着後に差し替え）。Tier で間引かない（見た目の完成度優先）
    const propState: PropState = { disposed: false, built: null };
    group.userData.propState = propState;
    cleanup.push(() => { propState.disposed = true; });
    if (propPlan.length) triangles += installProps(propPlan, catalog, chunks, chunkGroups, chunkIndexOf, bake, shading, materialFor, propOverrides, propState, legacy);

    mark('props');
    yield; // 中断点: プロップまで（残りはパーティクル・可動要素・Modifier の build フック）
    // パーティクル（スロットごとに 1 Points + 頂点シェーダ）。粒数は部屋合計で Tier の particleCap に収める（超えるときは比例で削る）
    const particleSlots = particleList(layout);
    if (particleSlots.length && tier.particleCap > 0) {
      const wanted = particleSlots.map((spec) => particleCount(spec, layout.bounds));
      const sum = wanted.reduce((a, b) => a + b, 0);
      const k = sum > tier.particleCap ? tier.particleCap / sum : 1;
      particleSlots.forEach((spec, i) => {
        const count = Math.floor(wanted[i] * k);
        // 先頭スロットの rng は従来（単一スロット）と同じ fork 名にして既存部屋の粒配置を変えない
        const built = buildParticles(spec, layout.bounds, count, new Rng(node.seed).fork(i === 0 ? 'particles' : `particles:${i}`));
        if (built) {
          group.add(built.points);
          effects.push(built.effect);
        }
      });
    }

    // 可動要素（個別 Mesh + 動くコライダ）
    const dynamicColliders: DynamicCollider[] = [];
    if (layout.dynamics?.length) {
      const dyn = buildDynamics(layout.dynamics, p, materialFor, bake, legacy);
      for (const d of dyn.items) { group.add(d.mesh); dynamicColliders.push(d); triangles += d.mesh.geometry.getAttribute('position').count / 3; }
      effects.push(dyn.effect);
    }

    // ゾーン（ワールド化）
    const zones: WorldZone[] = (layout.zones ?? []).map((z) => ({
      kind: z.kind,
      aabb: aabbToWorld(z.aabb, p),
      vector: z.vector ? rotQ(z.vector, p.yawQ) : undefined,
      params: z.params,
    }));

    const holes = layout.holes.map((h) => aabbToWorld(h, p));
    const elevators = layout.elevators.map((e) => ({ socketId: e.socketId, volume: aabbToWorld(e.volume, p) }));
    const built: BuiltRoom = {
      roomId: node.roomId, group, doorGroup, colliders, doors, lights, interactables, holes, elevators,
      bounds: aabbToWorld(layout.bounds, p), triangles,
      layout, chunks, zones, effects, dynamicColliders, signs,
      fog: render?.fog ? { ...render.fog } : undefined,
      lightmap,
      updateSign(id: string, text: string, sub?: string): boolean {
        let hit = false;
        for (const s of signs) if (s.id === id) { s.atlas.update(s.cellIndex, text, sub); hit = true; }
        return hit;
      },
    };

    propState.built = built;
    mark('particlesDynamicsZones');
    // Modifier の build フック（BuiltRoom.effects への追加など）
    applyBuildModifiers(built, layout, { node, def: definition ?? null, tier, materials: this.materials, rng: new Rng(node.seed).fork('build') });
    // 全部屋共通の低確率の破れ（切れかけの蛍光灯の明滅など。担当 W: src/render/wearEffects.ts）
    applyWearEffects(built, layout, { node, definition: definition ?? null, tier, materials: this.materials });
    mark('modifiers');
    if (typeof window !== 'undefined') {
      const g = window as unknown as { __buildProfile?: unknown[] };
      (g.__buildProfile ??= []).push({ room: node.roomId, def: node.definitionId, boxes: layout.boxes.length, total: Object.values(prof).reduce((a, b) => a + b, 0), steps: clock.steps, frames: clock.frames, ...prof });
      if (g.__buildProfile.length > 200) g.__buildProfile.shift();
    }
    return built;
  }

  private buildInstances(
    spec: InstanceSpec, chunks: RoomChunk[], chunkGroups: THREE.Group[], chunkIndexOf: (x: number, z: number) => number,
    materialFor: (m: MatId) => THREE.MeshStandardMaterial, bake: SurfaceLighting, shading: InstanceLighting, tier: QualityTier, colliders: AABB[],
    placement: NonNullable<RoomInstance['placement']>, legacy: boolean,
  ): number {
    const [sx, sy, sz] = spec.size;
    if (sx <= 0 || sy <= 0 || sz <= 0 || spec.transforms.length === 0) return 0;
    // Tier で間引き（決定論: 等間隔に採用）
    const scale = Math.max(0, Math.min(1, tier.instanceScale));
    const picked = spec.transforms.filter((_, i) => Math.floor(i * scale) !== Math.floor((i - 1) * scale) || i === 0);
    if (!picked.length) return 0;
    const perChunk = new Map<number, InstanceSpec['transforms']>();
    for (const t of picked) {
      const ci = chunkIndexOf(t.pos[0], t.pos[2]);
      if (!perChunk.has(ci)) perChunk.set(ci, []);
      perChunk.get(ci)!.push(t);
    }
    const botanical = !legacy && (spec.mat === 'plant' || spec.mat === 'grass');
    const baseBox: Box={ min: [-sx / 2, 0, -sz / 2], max: [sx / 2, sy, sz / 2], mat: spec.mat, solid: false };
    const base = botanical && spec.mat === 'grass' ? grassGeometry(baseBox,tier.id==='low'?.5:1) : botanical ? foliageGeometry(baseBox, tier.id === 'low' ? .3 : .65, Math.max(12,Math.floor(150000/(picked.length*12)))) : surfaceBox(baseBox, { legacy });
    const triPer = base.getAttribute('position').count / 3;
    let total = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (const [ci, list] of perChunk) {
      const geo = base.clone();
      const baked = new Float32Array(list.length * 3);
      // ライトマップ到着後の足元サンプル用: [x, 底面 y, z, 半幅 x, 半幅 z]（yaw を含む AABB の半幅）
      const probes = new Float32Array(list.length * 5);
      const mesh = new THREE.InstancedMesh(geo, materialFor(botanical?'plantLeaf':spec.mat), list.length);
      list.forEach((t, i) => {
        const s = t.scale ?? 1;
        pos.set(t.pos[0], t.pos[1], t.pos[2]);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw);
        scl.set(s, s, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
        const l = bake.sample([t.pos[0], t.pos[1] + sy * s / 2, t.pos[2]]);
        baked[i * 3] = l[0]; baked[i * 3 + 1] = l[1]; baked[i * 3 + 2] = l[2];
        const c = Math.abs(Math.cos(t.yaw)), sn = Math.abs(Math.sin(t.yaw));
        const hx = (c * sx + sn * sz) / 2 * s, hz = (sn * sx + c * sz) / 2 * s;
        probes[i * 5] = t.pos[0]; probes[i * 5 + 1] = t.pos[1]; probes[i * 5 + 2] = t.pos[2]; probes[i * 5 + 3] = hx; probes[i * 5 + 4] = hz;
        if (spec.solid) {
          colliders.push(aabbToWorld({ min: [t.pos[0] - hx, t.pos[1], t.pos[2] - hz], max: [t.pos[0] + hx, t.pos[1] + sy * s, t.pos[2] + hz] }, placement));
        }
      });
      // 焼き込みはインスタンスごとの一定値（InstancedBufferAttribute として同じ attribute 名で渡す）。
      // ライトマップが届いたら InstanceLighting が足元の床の値へ差し替える（到着済みなら register が即書く）
      geo.setAttribute('bakedLight', new THREE.InstancedBufferAttribute(baked, 3));
      shading.register(mesh, probes);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = true;
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true; // InstancedMesh は影を受けるだけ（投影しない）
      chunkGroups[ci].add(mesh);
      chunks[ci].triangles += triPer * list.length;
      total += triPer * list.length;
    }
    base.dispose();
    return total;
  }

  private buildDoor(node: RoomInstance, portal: Portal, s: Socket, group: THREE.Group, layout: RoomLayout, materialFor: (m: MatId) => THREE.MeshStandardMaterial): DoorObject {
    const p = node.placement!;
    const pos = s.pos, dir = s.dir, width = s.width;
    const height = s.height;
    const sill = s.sill ?? 0;
    // 開口より 3cm ずつ大きくして隙間から向こうが見えないようにする（壁厚の中に収まる）
    const w = width + 0.06;
    const ph = height + 0.04;
    const pivot = new THREE.Group();
    // ソケット位置は壁の外面。扉は壁厚の中央（内側へ 0.075）
    pivot.position.set(pos[0], pos[1] + sill, pos[2]);
    pivot.rotation.y = (dir * Math.PI) / 2; // ローカル +Z が外向き
    // ヒンジは開口の左端（-X 側）。パネルは +X 方向に伸びる
    // 戻り側の扉は座標系が 180° 反転しているので左右を鏡像にし、所有側のパネルとワールド上で一致させる
    const m = portal.isReturn ? -1 : 1;
    const hinge = new THREE.Group();
    hinge.position.set(-m * w / 2, 0, -m * 0.075);
    pivot.add(hinge);
    const doorMat: MatId = portal.locked ? 'doorMetal' : (themeDoorMatAt(layout, s.pos) ?? layout.palette.door);
    const mat = materialFor(doorMat);
    const doorGeo = surfaceBox({ min: [-w / 2, -ph / 2, -.03], max: [w / 2, ph / 2, .03], mat: doorMat, solid: false }, { legacy: layout.render?.style === 'legacy' });
    attachSurfaceAppearance(doorGeo,
      appearanceSeed(this.opts.worldSeed?.() ?? 0,doorSurfaceId(node.roomId,portal),'door'),
      layout.render?.style==='legacy' ? [0,0,0,0] : [m*3,w/2-.12,-ph/2,Math.min(1.0,height*.5)+.01]);
    doorGeo.setAttribute('bakedLight', new THREE.Float32BufferAttribute(Array.from({length: doorGeo.getAttribute('position').count * 3}, () => .55), 3));
    const panel = new THREE.Mesh(doorGeo, mat);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.position.set(m * w / 2, ph / 2 - 0.01, 0);
    panel.userData = { roomId: node.roomId, portalId: portal.portalId, kind: 'door', crawl: !!s.crawl };
    hinge.add(panel);
    // ノブ（低い開口では開口高さの中ほど）
    // Lever and spindle project beyond both panel faces (panel half-depth .03m).
    const knobGeo = new THREE.CylinderGeometry(.014, .014, .13, 10);
    const spindleGeo = new THREE.CylinderGeometry(.022, .022, .12, 10);
    const knobX=m*(w-.12), knobY=Math.min(1.0,height*.5);
    const spindle=new THREE.Mesh(spindleGeo,this.materials.get('metal'));
    spindle.rotation.x=Math.PI/2;spindle.position.set(knobX,knobY,0);hinge.add(spindle);
    for(const face of [-1,1]) {
      const knob=new THREE.Mesh(knobGeo,this.materials.get('metal'));
      knob.rotation.z=Math.PI/2;knob.position.set(knobX,knobY,face*.065);hinge.add(knob);
    }
    group.add(pivot);

    const center = toWorld(p, [pos[0], pos[1] + sill + height / 2, pos[2]]);
    const wdir = addDir(dir, p.yawQ);
    const half = width / 2 + 0.05;
    const y0 = pos[1] + sill + p.position[1];
    const collider: AABB =
      wdir === 0 || wdir === 2
        ? { min: [center[0] - half, y0, center[2] - 0.2], max: [center[0] + half, y0 + height, center[2] + 0.2] }
        : { min: [center[0] - 0.2, y0, center[2] - half], max: [center[0] + 0.2, y0 + height, center[2] + half] };
    const door: DoorObject = { portal, pivot: hinge, root: pivot, panel, collider, center, dir: wdir, angle: portal.open ? 1 : 0, crawl: s.crawl, sill };
    hinge.rotation.y = -door.angle * (Math.PI / 2) * 0.95;
    return door;
  }

  private buildLabel(lb: LabelSpec, rollFn: Roll | null, legacy: boolean): THREE.Object3D {
    const canvas = document.createElement('canvas');
    canvas.width = legacy ? 128 : 512;
    canvas.height = legacy ? 32 : 128;
    const ctx = canvas.getContext('2d')!;
    const k = canvas.width / 512;
    ctx.fillStyle = '#f0f0e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#20232a';
    ctx.font = `bold ${Math.round(44 * k)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(lb.text, canvas.width / 2, 58 * k);
    if (lb.sub) {
      ctx.font = `${Math.round(26 * k)}px sans-serif`;
      ctx.fillStyle = '#5a5f6a';
      ctx.fillText(lb.sub, canvas.width / 2, 100 * k);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (legacy) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
    this.materials.track(tex);
    if (L2_FLAGS.queue) this.materials.uploads.enqueue(tex, { big: false, priority: 1 });
    // 焼き込み（頂点色 / ライトマップ）の対象外で、動的光だけでは黒い板に見えるため、板サイン（SignAtlas plate）と同じ弱い自己発光を持たせる
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .55, metalness: .08, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .28 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(lb.width, lb.width / 4), mat);
    const pos = rollFn ? rollFn.point(lb.pos) : lb.pos;
    mesh.position.set(pos[0], pos[1], pos[2]);
    // dir: 表面が向く方向（0: +Z を向く）。ロール時は進行軸まわりの回転を合成
    mesh.quaternion.copy(facing(lb.dir, rollFn));
    mesh.userData.disposable = [tex, mat];
    return mesh;
  }

  dispose(built: BuiltRoom): void {
    // ライトマップ: 計算待ちなら取り消し（結果は捨てる）、テクスチャを解放。部屋専用材質は releaseRoom が捨てる
    if (built.lightmap) {
      built.lightmap.job?.cancel();
      built.lightmap.job = null;
      built.lightmap.upload?.cancel();
      built.lightmap.upload = null;
      this.materials.uploads.cancel(built.lightmap.texture);
      built.lightmap.texture.dispose();
    }
    for (const atlas of (built.group.userData.signAtlases as SignAtlas[] | undefined) ?? []) this.materials.uploads.cancel(atlas.texture);
    this.materials.releaseRoom(built.roomId);
    for (const e of built.effects) { try { e.dispose(); } catch (err) { console.warn('[RoomBuilder] effect dispose failed', err); } }
    built.effects.length = 0;
    // 読込待ちのプロップ差し替えを無効化（glTF 到着後に捨てた部屋へ追加しない）
    const ps = built.group.userData.propState as PropState | undefined;
    if (ps) ps.disposed = true;
    for (const atlas of (built.group.userData.signAtlases as SignAtlas[] | undefined) ?? []) atlas.dispose();
    for (const root of [built.group, built.doorGroup]) {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (o instanceof THREE.InstancedMesh) o.dispose();
          const d = o.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined;
          if (d) for (const x of d) { if (x instanceof THREE.Texture) this.materials.uploads.cancel(x); x.dispose(); }
        } else if (o instanceof THREE.Points) {
          o.geometry.dispose();
          const d = o.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined;
          if (d) for (const x of d) { if (x instanceof THREE.Texture) this.materials.uploads.cancel(x); x.dispose(); }
        }
      });
      root.removeFromParent();
    }
  }
}

// ---------------------------------------------------------------- ロール（E03）

interface Roll { point(v: Vec3): Vec3; quaternion: THREE.Quaternion }

/** 進行軸（既定 z）まわりの 1/4 回転 × roll。回転中心は rollPivot か footprint 断面の中心 */
function makeRoll(layout: RoomLayout): Roll {
  const axis = layout.rollAxis ?? 'z';
  const q = layout.roll ?? 0;
  const b = layout.bounds;
  const pivot: Vec3 = layout.rollPivot ?? [(b.min[0] + b.max[0]) / 2, layout.height / 2, (b.min[2] + b.max[2]) / 2];
  const point = (v: Vec3): Vec3 => {
    // 軸に垂直な平面の 2 成分（u, y）を回す。axis z: u=x / axis x: u=z
    let u = (axis === 'z' ? v[0] - pivot[0] : v[2] - pivot[2]);
    let y = v[1] - pivot[1];
    for (let i = 0; i < q; i++) { const nu = -y; y = u; u = nu; }
    return axis === 'z' ? [u + pivot[0], y + pivot[1], v[2]] : [v[0], y + pivot[1], u + pivot[2]];
  };
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), (q * Math.PI) / 2);
  return { point, quaternion };
}

function rollBox(b: Box, r: Roll): Box {
  const a = r.point(b.min), c = r.point(b.max);
  return { ...b, min: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], max: [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])] };
}

/** 面の向き（dir の yaw）とロールを合成した回転 */
function facing(dir: Dir, roll: Roll | null): THREE.Quaternion {
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (dir * Math.PI) / 2);
  return roll ? roll.quaternion.clone().multiply(yaw) : yaw;
}

/** 材質の部屋別上書き（RoomLayout.render から。build と materialPlan が同じものを使う） */
function overridesFor(layout: RoomLayout): MaterialOverrides {
  const render = layout.render;
  const overrides: MaterialOverrides = {};
  if (render?.wetness) Object.assign(overrides, wetnessOverrides(render.wetness));
  if (render?.floorWetness) overrides.floorWetness = render.floorWetness; // 床材だけ（MaterialLibrary.resolveOverrides が畳む）
  // 器具の発光面を palette.lightColor（P1 の色温度）に追従させる（器具材質だけ。MaterialLibrary.resolveOverrides が他の材質から落とす）
  if (layout.palette?.lightColor !== undefined) overrides.lightTint = layout.palette.lightColor;
  if (render?.colorMask) overrides.colorMask = render.colorMask;
  if (render?.style === 'legacy') overrides.style = 'legacy';
  if (render?.gradient) overrides.gradient = { ...render.gradient, range: projectRange(layout.bounds, render.gradient.axis) };
  if (render?.fog) overrides.fog = render.fog;
  return overrides;
}

/** 勾配軸に bounds を射影した範囲 */
function projectRange(bounds: AABB, axis: Vec3): [number, number] {
  const n = Math.hypot(...axis) || 1;
  const a: Vec3 = [axis[0] / n, axis[1] / n, axis[2] / n];
  let lo = Infinity, hi = -Infinity;
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const d = x * a[0] + y * a[1] + z * a[2];
    lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  return [lo, hi];
}

function decalBox(d: NonNullable<RoomLayout['decals']>[number]): Box {
  const t = .004;
  const [w, dd] = d.size;
  const yaw = d.yaw ?? 0;
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  if (d.normal === 'y') {
    const hx = (c * w + s * dd) / 2, hz = (s * w + c * dd) / 2;
    return { min: [d.pos[0] - hx, d.pos[1], d.pos[2] - hz], max: [d.pos[0] + hx, d.pos[1] + t, d.pos[2] + hz], mat: d.mat, solid: false };
  }
  if (d.normal === 'x') return { min: [d.pos[0], d.pos[1] - dd / 2, d.pos[2] - w / 2], max: [d.pos[0] + t, d.pos[1] + dd / 2, d.pos[2] + w / 2], mat: d.mat, solid: false };
  return { min: [d.pos[0] - w / 2, d.pos[1] - dd / 2, d.pos[2]], max: [d.pos[0] + w / 2, d.pos[1] + dd / 2, d.pos[2] + t], mat: d.mat, solid: false };
}

// ---------------------------------------------------------------- パーティクル

const PARTICLE_DEFAULTS: Record<ParticleSpec['type'], { vel: Vec3; sway: number; size: number; color: number; alpha: number }> = {
  rain: { vel: [0, -9, 0], sway: 0, size: .05, color: 0xaac0d0, alpha: .55 },
  snow: { vel: [.1, -.8, 0], sway: .5, size: .07, color: 0xffffff, alpha: .85 },
  steam: { vel: [0, .6, 0], sway: .35, size: .6, color: 0xffffff, alpha: .12 },
  mist: { vel: [.05, .05, 0], sway: .25, size: 1.4, color: 0xdde4ea, alpha: .07 },
  dust: { vel: [0, -.05, 0], sway: .15, size: .03, color: 0xf0e8d8, alpha: .35 },
};

/** スロットが求める粒数（density × 発生領域の体積。Tier の上限は呼び出し側が部屋合計で掛ける） */
function particleCount(spec: ParticleSpec, roomBounds: AABB): number {
  const bb = spec.aabb ?? roomBounds;
  const volume = Math.max(0, (bb.max[0] - bb.min[0]) * (bb.max[1] - bb.min[1]) * (bb.max[2] - bb.min[2]));
  return Math.max(0, Math.round(spec.density * volume));
}

function buildParticles(spec: ParticleSpec, roomBounds: AABB, count: number, rng: Rng): { points: THREE.Points; effect: RoomEffect } | null {
  const bb = spec.aabb ?? roomBounds;
  const size: Vec3 = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
  if (count <= 0) return null;
  const d = PARTICLE_DEFAULTS[spec.type];
  const positions = new Float32Array(count * 3);
  const rand = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = bb.min[0] + rng.next() * size[0];
    positions[i * 3 + 1] = bb.min[1] + rng.next() * size[1];
    positions[i * 3 + 2] = bb.min[2] + rng.next() * size[2];
    rand[i * 3] = rng.next(); rand[i * 3 + 1] = rng.next(); rand[i * 3 + 2] = rng.next();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3((bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2), Math.hypot(...size) / 2 + 1);
  const uniforms = {
    uTime: { value: 0 },
    uMin: { value: new THREE.Vector3(...bb.min) },
    uSize3: { value: new THREE.Vector3(...size) },
    uVel: { value: new THREE.Vector3(...d.vel) },
    uSway: { value: d.sway },
    uPointSize: { value: spec.size ?? d.size },
    uColor: { value: new THREE.Color(spec.color ?? d.color) },
    uAlpha: { value: d.alpha },
    uStretch: { value: spec.type === 'rain' ? 6 : 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: spec.type === 'steam' || spec.type === 'mist' ? THREE.NormalBlending : THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform vec3 uMin; uniform vec3 uSize3; uniform vec3 uVel; uniform float uSway; uniform float uPointSize;
      attribute vec3 aRand; varying float vFade;
      void main() {
        vec3 p = position + uVel * uTime;
        p.x += sin(uTime * (0.6 + aRand.x) + aRand.y * 6.2831) * uSway;
        p.z += cos(uTime * (0.5 + aRand.z) + aRand.x * 6.2831) * uSway;
        // 領域内でラップ（各軸）
        p = uMin + mod(p - uMin, max(uSize3, vec3(0.001)));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(0.5, -mv.z);
        gl_PointSize = clamp(uPointSize * 600.0 / dist, 1.0, 64.0);
        // 近すぎる粒は薄く
        vFade = smoothstep(0.3, 1.5, dist);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; uniform float uStretch; varying float vFade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        c.y *= 1.0 / uStretch;
        float r = length(c) * 2.0;
        float a = (1.0 - smoothstep(0.4, 1.0, r)) * uAlpha * vFade;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const points = new THREE.Points(geo, material);
  points.name = `particles/${spec.type}`;
  points.userData.disposable = [material];
  points.frustumCulled = true;
  const effect: RoomEffect = {
    update(dt) { uniforms.uTime.value += dt; },
    dispose() { /* geometry / material は RoomBuilder.dispose の traverse で解放 */ },
  };
  return { points, effect };
}

// ---------------------------------------------------------------- 可動要素

function buildDynamics(specs: DynamicSpec[], placement: NonNullable<RoomInstance['placement']>, materialFor: (m: MatId) => THREE.MeshStandardMaterial, bake: SurfaceLighting, legacy: boolean): { items: DynamicCollider[]; effect: RoomEffect } {
  const items: DynamicCollider[] = [];
  const centers: Vec3[] = [];
  for (const spec of specs) {
    const b = spec.box;
    const center: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    // ジオメトリは箱の中心を原点に置き、Mesh の位置で動かす
    const geo = surfaceBox({ ...b, min: [b.min[0] - center[0], b.min[1] - center[1], b.min[2] - center[2]], max: [b.max[0] - center[0], b.max[1] - center[1], b.max[2] - center[2]] }, { legacy });
    const l = bake.sample(center);
    const n = geo.getAttribute('position').count;
    const baked = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { baked[i * 3] = l[0]; baked[i * 3 + 1] = l[1]; baked[i * 3 + 2] = l[2]; }
    geo.setAttribute('bakedLight', new THREE.BufferAttribute(baked, 3));
    const mesh = new THREE.Mesh(geo, materialFor(b.mat));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(center[0], center[1], center[2]);
    mesh.name = `dynamic/${spec.id}`;
    items.push({ id: spec.id, spec, mesh, aabb: aabbToWorld(b, placement), solid: spec.solid });
    centers.push(center);
  }
  // 要素ごとの経過時間（ソリッドの要素はプレイヤーに当たる位置へは進めず、その場で待つので個別に持つ）
  const times = items.map(() => 0);
  const axis = new THREE.Vector3();
  /** 時刻 t の位置と AABB（ワールド）を求める。apply=true で Mesh に反映する */
  const poseAt = (i: number, t: number, apply: boolean): AABB => {
    const d = items[i];
    const m = d.spec.motion;
    const phase = t / Math.max(.01, m.period) + m.phase;
    axis.set(m.axis[0], m.axis[1], m.axis[2]);
    if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
    axis.normalize();
    const b = d.spec.box;
    const c = centers[i];
    if (m.kind === 'rotate') {
      const angle = m.amplitude * Math.sin(phase * Math.PI * 2);
      if (apply) {
        d.mesh.position.set(c[0], c[1], c[2]);
        d.mesh.quaternion.setFromAxisAngle(axis, angle);
      }
      // コライダは掃引範囲（軸に垂直な面で半対角線ぶん膨らませた AABB）
      const hx = (b.max[0] - b.min[0]) / 2, hy = (b.max[1] - b.min[1]) / 2, hz = (b.max[2] - b.min[2]) / 2;
      const r = Math.hypot(hx, hy, hz);
      const ex = Math.abs(axis.x) > .99 ? hx : r, ey = Math.abs(axis.y) > .99 ? hy : r, ez = Math.abs(axis.z) > .99 ? hz : r;
      return aabbToWorld({ min: [c[0] - ex, c[1] - ey, c[2] - ez], max: [c[0] + ex, c[1] + ey, c[2] + ez] }, placement);
    }
    const w = m.kind === 'slide' ? 1 - 2 * Math.abs(((phase % 1) + 1) % 1 - .5) : (Math.sin(phase * Math.PI * 2) + 1) / 2;
    const off = m.amplitude * w;
    if (apply) d.mesh.position.set(c[0] + axis.x * off, c[1] + axis.y * off, c[2] + axis.z * off);
    return aabbToWorld({ min: [b.min[0] + axis.x * off, b.min[1] + axis.y * off, b.min[2] + axis.z * off], max: [b.max[0] + axis.x * off, b.max[1] + axis.y * off, b.max[2] + axis.z * off] }, placement);
  };
  items.forEach((d, i) => { d.aabb = poseAt(i, 0, true); });
  const effect: RoomEffect = {
    update(dt, ctx) {
      // 挟み込み防止: ソリッドの要素は「次の位置がプレイヤー AABB（余白 0.15 m）と重なる」なら時間を進めず待つ
      // （静止中のプレイヤーへ食い込むと PlayerController の押し出しが箱の上面へ取られ、天井の上へ弾き出されるため）。
      // 既に重なっている（プレイヤーが自分で入り込んだ）ときは離れる方向へ進めるよう通常どおり動かす
      const pa = ctx?.player ? playerAabbOf(ctx.player.pos, ctx.player.crouching) : null;
      items.forEach((d, i) => {
        const next = times[i] + dt;
        if (d.solid && pa) {
          const cand = poseAt(i, next, false);
          if (aabbOverlap(cand, pa, 0) && !aabbOverlap(d.aabb, pa, 0)) return;
        }
        times[i] = next;
        d.aabb = poseAt(i, next, true);
      });
    },
    dispose() { /* Mesh は RoomBuilder.dispose の traverse で解放 */ },
  };
  return { items, effect };
}

/** プレイヤーの当たり判定 AABB（PlayerController.PLAYER と同じ寸法。render → player の依存を作らないため定数で持つ）+ 余白 */
function playerAabbOf(pos: Vec3, crouching: boolean, margin = 0.15): AABB {
  const h = crouching ? 0.85 : 1.7;
  const r = 0.35 + margin;
  return { min: [pos[0] - r, pos[1] - margin, pos[2] - r], max: [pos[0] + r, pos[1] + h + margin, pos[2] + r] };
}

/** ソケット位置を含む kind 'theme' ゾーン（EraPreset が区画ごとに書く）の扉材質。無ければ undefined */
function themeDoorMatAt(layout: RoomLayout, pos: Vec3): MatId | undefined {
  for (const z of layout.zones ?? []) {
    if (z.kind !== 'theme' || z.params?.mod !== 'EraPreset') continue;
    const door = z.params?.door;
    if (typeof door !== 'string' || !(door in SURFACES)) continue;
    const a = z.aabb, e = 0.35;
    if (pos[0] >= a.min[0] - e && pos[0] <= a.max[0] + e && pos[2] >= a.min[2] - e && pos[2] <= a.max[2] + e) return door as MatId;
  }
  return undefined;
}

// ---------------------------------------------------------------- CC0 プロップ（kind 付きの箱 → glTF）

interface PropTransform { pos: Vec3; yaw: number; scale: number }
interface PropPlacement { box: Box; entry: CatalogEntry; transforms: PropTransform[] }
interface PropState { disposed: boolean; built: BuiltRoom | null }

const PROP_SCALE_MIN = 0.75;
const PROP_SCALE_MAX = 1.25;
/** 列（TILED_KINDS）だけは断面が箱より小さいモデルも許す上限（1.25 にクランプして並べる。カウンター 0.9 m に 0.55 m の引出しなど） */
const PROP_TILED_SCALE_RAW_MAX = 1.6;
const dirVec2 = (d: Dir): [number, number] => (d === 0 ? [0, 1] : d === 1 ? [1, 0] : d === 2 ? [0, -1] : [-1, 0]);
/** 前面（+Z）を (fx, fz) に向ける yaw */
const yawToward = (fx: number, fz: number): number => Math.atan2(fx, fz);
const snapYaw = (y: number): number => Math.round(y / (Math.PI / 2)) * (Math.PI / 2);

/** 箱が接している外壁の外向き方向（0.35 m 以内）。無ければ null */
function wallSideOf(b: Box, spans: ReturnType<typeof wallSpans>): Dir | null {
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  let best: { d: Dir; dist: number } | null = null;
  for (const sp of spans) {
    const d = sp.edge.dir;
    const along = d === 0 || d === 2 ? cx : cz;
    if (along < sp.a0 - 0.05 || along > sp.a1 + 0.05) continue;
    const inward = d === 0 || d === 1 ? -1 : 1;
    const face = sp.edge.coord + inward * WALL_T;
    const side = d === 0 ? b.max[2] : d === 2 ? b.min[2] : d === 1 ? b.max[0] : b.min[0];
    const dist = Math.abs(side - face);
    if (dist < 0.35 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best?.d ?? null;
}

/** 箱・kind・候補モデルから配置（yaw 候補は 90° 刻み、prefer の順に試す）。収まらなければ null */
function fitProp(b: Box, kind: string, e: CatalogEntry, prefer: number[], wallSide: Dir | null): { scale: number; yaw: number; count: number; axis: 'x' | 'z'; fill: number } | null {
  const bw = b.max[0] - b.min[0], bh = b.max[1] - b.min[1], bd = b.max[2] - b.min[2];
  const [mw, mh, md] = e.size;
  if (e.mount === 'wall') {
    if (wallSide === null) return null;
    const along = wallSide === 0 || wallSide === 2 ? bw : bd;
    const thick = wallSide === 0 || wallSide === 2 ? bd : bw;
    const raw = Math.min(along / mw, bh / mh, (thick + 0.02) / md);
    if (raw < PROP_SCALE_MIN || raw > PROP_SCALE_MAX) return null;
    const scale = raw;
    const [nx, nz] = dirVec2(wallSide);
    return { scale, yaw: yawToward(-nx, -nz), count: 1, axis: 'x', fill: Math.min(1, (mw * mh * md * scale ** 3) / (bw * bh * bd)) };
  }
  const tiled = TILED_KINDS.has(kind);
  const boxLongX = bw >= bd;
  const boxElong = Math.max(bw, bd) / Math.min(bw, bd) > 1.3;
  const modelElong = Math.max(mw, md) / Math.min(mw, md) > 1.3;
  let best: { scale: number; yaw: number; count: number; axis: 'x' | 'z'; fill: number } | null = null;
  for (const yaw of prefer) {
    const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
    const rw = c * mw + sn * md, rd = sn * mw + c * md; // yaw 後の footprint
    const modelLongX = rw >= rd;
    if (boxElong && modelElong && modelLongX !== boxLongX) continue; // 長辺を揃える
    let scale: number, count = 1;
    const axis: 'x' | 'z' = boxLongX ? 'x' : 'z';
    if (tiled) {
      const bShort = boxLongX ? bd : bw, rShort = boxLongX ? rd : rw;
      const bLong = boxLongX ? bw : bd, rLong = boxLongX ? rw : rd;
      const raw = Math.min(bShort / rShort, bh / mh);
      if (raw < PROP_SCALE_MIN || raw > PROP_TILED_SCALE_RAW_MAX) continue;
      scale = Math.min(PROP_SCALE_MAX, raw);
      count = Math.floor(bLong / (rLong * scale) + 1e-6);
      if (count < 1) {
        const s2 = Math.min(raw, bLong / rLong);
        if (s2 < PROP_SCALE_MIN) continue;
        scale = Math.min(PROP_SCALE_MAX, s2);
        count = 1;
      }
    } else {
      // 一様スケールが 0.75〜1.25 に入る候補だけ（小さすぎるモデルを拡大して置かない）
      const raw = Math.min(bw / rw, bd / rd, bh / mh);
      if (raw < (kind === 'plant' ? .65 : PROP_SCALE_MIN) || raw > PROP_SCALE_MAX) continue;
      scale = raw;
    }
    const fill = Math.min(1, (rw * rd * mh * scale ** 3 * count) / (bw * bd * bh));
    if (!best) { best = { scale, yaw, count, axis, fill }; break; }
  }
  return best;
}

/**
 * kind 付きの箱ごとにモデルと変換を決める（seed 決定論）。
 * 1) 箱ごとに収まる候補を求める。2) 同じ kind が多い部屋（> 12 箱）は軽い候補に絞り、部屋ごとに 1 モデルへ統一する。
 * 3) 合計が三角形予算を超えるときは、使用量の多い kind から順に「最軽量へ切替 → 1 つおきに間引き」で収める。
 */
function planProps(work: RoomLayout, rng: Rng, catalog: PropCatalog): PropPlacement[] {
  const spans = wallSpans(work.footprint);
  const bounds = work.bounds;
  const center: [number, number] = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
  const tables = work.boxes.filter((b) => b.kind === 'table' || b.kind === 'desk');
  const countByKind = new Map<string, number>();
  for (const b of work.boxes) if (b.kind) countByKind.set(b.kind, (countByKind.get(b.kind) ?? 0) + 1);
  type Fit = NonNullable<ReturnType<typeof fitProp>>;
  interface Slot { box: Box; index: number; wallSide: Dir | null; fits: { e: CatalogEntry; f: Fit }[]; pick: { e: CatalogEntry; f: Fit } | null }
  const slots: Slot[] = [];
  // 多数配置の kind は部屋ごとに 1 モデルへ統一（最軽量の 1.6 倍以内から seed で選ぶ）
  const unified = new Map<string, string>();
  for (const [kind, n] of countByKind) {
    if (n <= 12) continue;
    const cands = catalog.candidates(kind).slice().sort((a, b) => a.triangles - b.triangles);
    if (!cands.length) continue;
    const light = cands.filter((c) => c.triangles <= cands[0].triangles * 1.6);
    unified.set(kind, rng.fork(`unify:${kind}`).pick(light).id);
  }
  work.boxes.forEach((b, i) => {
    if (!b.kind) return;
    // 広い植栽帯を単独の鉢植えに縮めない。枝葉の専用形状を使う。
    if (b.kind === 'plant' && Math.max(b.max[0]-b.min[0], b.max[2]-b.min[2]) > 1.2) return;
    let candidates = catalog.candidates(b.kind);
    if (b.propGroup && b.kind === 'plant') candidates = candidates.filter(e=>e.id==='pachira_aquatica_01');
    if (!candidates.length) return;
    const uni = unified.get(b.kind);
    if (uni) candidates = candidates.filter((c) => c.id === uni);
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const wallSide = wallSideOf(b, spans);
    // 向きの優先: 椅子は最寄りの机へ、壁際は壁に背を向けて、それ以外は部屋の中心へ
    let face: number;
    let target: Box | undefined;
    if (b.kind === 'chair') {
      let bestD = 1.8;
      for (const t of tables) {
        const tx = Math.max(t.min[0], Math.min(t.max[0], cx)), tz = Math.max(t.min[2], Math.min(t.max[2], cz));
        const d = Math.hypot(tx - cx, tz - cz);
        if (d < bestD) { bestD = d; target = t; }
      }
    }
    if (target) {
      // 机の外側から机の面へ垂直に向く（机の範囲内に射影した最近点への方向を 90° に丸める）
      const tx = Math.max(target.min[0], Math.min(target.max[0], cx)), tz = Math.max(target.min[2], Math.min(target.max[2], cz));
      face = snapYaw(yawToward(tx - cx, tz - cz));
    } else if (wallSide !== null) {
      const [nx, nz] = dirVec2(wallSide);
      face = yawToward(-nx, -nz);
    } else face = snapYaw(yawToward(center[0] - cx, center[1] - cz));
    const prefer = [face, face + Math.PI / 2, face - Math.PI / 2, face + Math.PI];
    const fits = candidates
      .map((e) => ({ e, f: fitProp(b, b.kind!, e, prefer, wallSide) }))
      .filter((x): x is { e: CatalogEntry; f: Fit } => !!x.f);
    if (!fits.length) return;
    const r = rng.fork(i);
    const maxFill = Math.max(...fits.map((x) => x.f.fill));
    const eligible = fits.filter((x) => x.f.fill >= maxFill * 0.6);
    slots.push({ box: b, index: i, wallSide, fits, pick: r.pick(eligible) });
  });
  // 三角形予算
  const cost = (sl: Slot): number => (sl.pick ? sl.pick.e.triangles * sl.pick.f.count : 0);
  const total = (): number => slots.reduce((a, sl) => a + cost(sl), 0);
  for (let guard = 0; total() > PROP_TRIANGLE_BUDGET && guard < 64; guard++) {
    // まず「最軽量の候補へ切替」で最も節約できる kind を切り替える（全 kind が最軽量になるまで）。それでも超えるなら使用量最大の kind を 1 つおきに間引く
    const savings = new Map<string, number>();
    for (const sl of slots) {
      if (!sl.pick) continue;
      const lightest = sl.fits.slice().sort((a, b) => a.e.triangles * a.f.count - b.e.triangles * b.f.count)[0];
      const save = cost(sl) - lightest.e.triangles * lightest.f.count;
      if (save > 0) savings.set(sl.box.kind!, (savings.get(sl.box.kind!) ?? 0) + save);
    }
    if (savings.size) {
      const [kind] = [...savings.entries()].sort((a, b) => b[1] - a[1])[0];
      for (const sl of slots) {
        if (sl.box.kind !== kind || !sl.pick) continue;
        sl.pick = sl.fits.slice().sort((a, b) => a.e.triangles * a.f.count - b.e.triangles * b.f.count)[0];
      }
      continue;
    }
    const byKind = new Map<string, number>();
    for (const sl of slots) byKind.set(sl.box.kind!, (byKind.get(sl.box.kind!) ?? 0) + cost(sl));
    const [heavy] = [...byKind.entries()].sort((a, b) => b[1] - a[1])[0];
    let k = 0, changed = false;
    for (const sl of slots) {
      if (sl.box.kind !== heavy || !sl.pick) continue;
      if (k++ % 2 === 1) { sl.pick = null; changed = true; }
    }
    if (!changed) break;
  }
  const out: PropPlacement[] = [];
  for (const sl of slots) {
    if (!sl.pick) continue;
    const { e, f } = sl.pick;
    const b = sl.box;
    const r = rng.fork(`t${sl.index}`);
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const wallSide = sl.wallSide;
    // 収まりを判定した角度を維持する。回転ジッターは壁や隣の家具へはみ出す。
    const yaw = f.yaw;
    const transforms: PropTransform[] = [];
    const c = Math.abs(Math.cos(f.yaw)), sn = Math.abs(Math.sin(f.yaw));
    const rw = (c * e.size[0] + sn * e.size[2]) * f.scale, rd = (sn * e.size[0] + c * e.size[2]) * f.scale;
    const bw = b.max[0] - b.min[0], bd = b.max[2] - b.min[2];
    if (e.mount === 'wall' && wallSide !== null) {
      const y = (b.min[1] + b.max[1]) / 2;
      const pos: Vec3 = wallSide === 0 ? [cx, y, b.max[2]] : wallSide === 2 ? [cx, y, b.min[2]] : wallSide === 1 ? [b.max[0], y, cz] : [b.min[0], y, cz];
      transforms.push({ pos, yaw: f.yaw, scale: f.scale });
    } else if (e.mount === 'ceiling') {
      transforms.push({ pos: [cx, b.max[1], cz], yaw, scale: f.scale });
    } else {
      const slackX = Math.max(0, (bw - (f.axis === 'x' && f.count > 1 ? bw : rw)) / 2);
      const slackZ = Math.max(0, (bd - (f.axis === 'z' && f.count > 1 ? bd : rd)) / 2);
      // 壁際は壁から離す方向にだけずらす（壁へ食い込ませない）
      for (let k = 0; k < f.count; k++) {
        const jx = Math.min(0.03, slackX) * r.float(-1, 1), jz = Math.min(0.03, slackZ) * r.float(-1, 1);
        let x = cx, z = cz;
        if (f.count > 1) {
          if (f.axis === 'x') x = b.min[0] + (bw / f.count) * (k + 0.5);
          else z = b.min[2] + (bd / f.count) * (k + 0.5);
        }
        x += wallSide === 1 ? -Math.abs(jx) : wallSide === 3 ? Math.abs(jx) : jx;
        z += wallSide === 0 ? -Math.abs(jz) : wallSide === 2 ? Math.abs(jz) : jz;
        transforms.push({ pos: [x, b.min[1], z], yaw, scale: f.scale });
      }
    }
    out.push({ box: b, entry: e, transforms });
  }
  return out;
}

/** モデルごとに InstancedMesh（チャンク別）を作る。未読込のモデルは箱の仮表示を出し、到着後に差し替える。戻り値は今すぐ足した三角形数 */
function installProps(
  plan: PropPlacement[], catalog: PropCatalog, chunks: RoomChunk[], chunkGroups: THREE.Group[], chunkIndexOf: (x: number, z: number) => number,
  bake: SurfaceLighting, shading: InstanceLighting, materialFor: (m: MatId) => THREE.MeshStandardMaterial, propOverrides: ExternalOverrides, state: PropState, legacy: boolean,
): number {
  const byModel = new Map<string, PropPlacement[]>();
  for (const pp of plan) {
    if (!byModel.has(pp.entry.id)) byModel.set(pp.entry.id, []);
    byModel.get(pp.entry.id)!.push(pp);
  }
  let now = 0;
  for (const [id, list] of byModel) {
    const instantiate = (model: LoadedProp): number => {
      const perChunk = new Map<number, { t: PropTransform; box: Box }[]>();
      for (const pp of list) for (const t of pp.transforms) {
        const ci = chunkIndexOf(t.pos[0], t.pos[2]);
        if (!perChunk.has(ci)) perChunk.set(ci, []);
        perChunk.get(ci)!.push({ t, box: pp.box });
      }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      let tris = 0;
      for (const [ci, items] of perChunk) {
        const baked = new Float32Array(items.length * 3);
        // ライトマップ到着後の足元サンプル用: [x, 底面 y, z, 半幅 x, 半幅 z]（置き換えた箱の足跡）
        const probes = new Float32Array(items.length * 5);
        items.forEach((it, i) => {
          const l = bake.sample([it.t.pos[0], (it.box.min[1] + it.box.max[1]) / 2, it.t.pos[2]]);
          baked[i * 3] = l[0]; baked[i * 3 + 1] = l[1]; baked[i * 3 + 2] = l[2];
          probes[i * 5] = it.t.pos[0]; probes[i * 5 + 1] = it.box.min[1]; probes[i * 5 + 2] = it.t.pos[2];
          probes[i * 5 + 3] = (it.box.max[0] - it.box.min[0]) / 2; probes[i * 5 + 4] = (it.box.max[2] - it.box.min[2]) / 2;
        });
        for (const part of model.parts) {
          const geo = part.geometry.clone();
          geo.setAttribute('bakedLight', new THREE.InstancedBufferAttribute(baked.slice(), 3));
          const mesh = new THREE.InstancedMesh(geo, catalog.materialFor(part, propOverrides), items.length);
          // glTF プロップも InstancedMesh と同じ経路（インスタンスごとの一様値）でライトマップの足元の値を受ける
          shading.register(mesh, probes);
          items.forEach((it, i) => {
            pos.set(it.t.pos[0], it.t.pos[1], it.t.pos[2]);
            q.setFromAxisAngle(up, it.t.yaw);
            scl.setScalar(it.t.scale);
            m.compose(pos, q, scl);
            mesh.setMatrixAt(i, m);
          });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.frustumCulled = true;
          mesh.computeBoundingSphere();
          mesh.receiveShadow = true;
          mesh.castShadow = true;
          mesh.name = `prop/${id}`;
          mesh.userData.prop = id;
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();
          chunkGroups[ci].add(mesh);
          const per = (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3;
          chunks[ci].triangles += per * items.length;
          tris += per * items.length;
        }
      }
      return tris;
    };
    const loaded = catalog.model(id);
    if (loaded) { now += instantiate(loaded); continue; }
    // 仮表示: 元の箱（材質別に結合、焼き込み付き）。到着後に外す
    const placeholders: THREE.Mesh[] = [];
    const byMat = new Map<string, { mat: MatId; ci: number; geos: THREE.BufferGeometry[] }>();
    for (const pp of list) {
      const b = pp.box;
      let g = surfaceBox(b, { legacy });
      bake.bake(g, b);
      if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
      const ci=chunkIndexOf((b.min[0]+b.max[0])/2,(b.min[2]+b.max[2])/2), key=`${ci}:${b.mat}`;
      if(!byMat.has(key))byMat.set(key,{mat:b.mat,ci,geos:[]});
      byMat.get(key)!.geos.push(g);
    }
    for (const {mat,ci,geos} of byMat.values()) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, materialFor(mat));
      mesh.name = `prop-placeholder/${id}`;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      chunkGroups[ci].add(mesh);
      placeholders.push(mesh);
    }
    catalog.whenLoaded(id, (model) => {
      if (state.disposed) return;
      if (!model) return; // 読めなければ箱のまま
      for (const ph of placeholders) { ph.removeFromParent(); ph.geometry.dispose(); }
      const added = instantiate(model);
      if (state.built) state.built.triangles += added;
    });
  }
  return now;
}

/**
 * 水たまりの不定形ジオメトリ（oddity の 'puddle'）。箱の足跡（楕円の半径 rx / rz）に収まる 28 頂点の輪郭を、
 * 中心座標から決めた固定シードの 2〜5 次の正弦で揺らして作る。上向きの平面（法線 +Y）を箱の上面の高さに置く
 */
function puddleGeometry(b: Box): THREE.BufferGeometry {
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const rx = (b.max[0] - b.min[0]) / 2, rz = (b.max[2] - b.min[2]) / 2;
  let seed = ((Math.round(cx * 100) * 73856093) ^ (Math.round(cz * 100) * 19349663)) >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const a1 = rnd() * Math.PI * 2, a2 = rnd() * Math.PI * 2, a3 = rnd() * Math.PI * 2;
  const k1 = 0.14 + rnd() * 0.1, k2 = 0.07 + rnd() * 0.08;
  const N = 28;
  const shape = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const rr = 0.78 + k1 * Math.sin(2 * t + a1) + k2 * Math.sin(3 * t + a2) + 0.05 * Math.sin(5 * t + a3);
    const x = Math.cos(t) * rx * rr, y = Math.sin(t) * rz * rr;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, b.max[1], cz);
  return g;
}
