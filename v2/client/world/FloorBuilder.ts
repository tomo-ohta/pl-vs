/**
 * FloorLayout → three.js（v1 の RoomBuilder の作り直し。継承計画 3 章の C 区分）。
 *
 * 箱 1 つずつの扱いは v1 と同じ流れ: surfaceBox（面取り・UV）→ 表面の質感の座標（attachSurfaceAppearance）→
 * 焼き込み陰影（SurfaceLighting.bake → 頂点属性 bakedLight）→ 材質ごとに結合 → MaterialLibrary.forRoom の材質。
 *
 * v2 で足したもの:
 * - 区画（cell）ごとに Group を分ける（cell and portal の描画で、見えない区画を丸ごと隠すため）
 * - 出現型の隠し: revealGroup の箱は別のメッシュにして最初は隠す / concealGroup の箱は現れたら隠す
 * - 部品で入切する照明（lamp）: 発光パネル（Box.kind 'lamp:<id>'）は「点灯」と「消灯」の 2 つのメッシュを持って切り替え、
 *   焼き込み陰影は「その照明なし」と「あり」の 2 通りを焼いて、照明の明るさに合わせて混ぜる
 * - 材質のシェーダは「メッシュの座標の y = 0 が床」を前提にする（水深・汚れ層の高さ）。区画の Group を床の高さ（floorY）に置き、
 *   ジオメトリは焼き込みの後で -floorY ずらす（v1 の部屋のローカル座標と同じ）
 * - ライトマップ（mid / high。v1 の RoomBuilder と同じ流れ。Lightmap.ts の冒頭）: 区画ごとにアトラスを作って Worker で焼き、届いたら
 *   頂点焼き込みからクロスフェードする。見えている区画から先に焼く。部品で入切する照明のある区画は焼かない
 *   （照明の入切は頂点焼き込みの混ぜ合わせで出す。ライトマップは 1 通りしか持てない）
 * - 形の特別扱い（BoxShapes.ts）: 水面（water / waterShallow）は上面だけ、水たまり（puddle）は不定形の輪郭、傾けた箱（Box.slope。
 *   階段の手すり）は剪断。水面のメッシュは原点を箱の底に置く（材質の水深 = メッシュの座標の y なので、床に沈めた水槽でも
 *   「底 .. 水面」が水深になる）。傾けた箱は焼き込みの遮蔽物に入れず（外接の箱が大きすぎる）、ライトマップの対象にもしない
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AABB } from '../../core/math/aabb.ts';
import { hashAll } from '../../core/math/rng.ts';
import type { Box, CellLayout, FloorLayout, LightSpec, MatId } from '../../core/world/layout.ts';
import { allocateLightmapAtlas, createLightmapTexture, isLightmapTarget, LIGHTMAP_TIER, LightmapBaker, lightmapsSupported, startLightmapCrossfade, writeConstantUV1, writeLightmapUV, type LightmapJobHandle } from '../render/Lightmap.ts';
import { L2_FLAGS, materialOverridesFor, SURFACES, type MaterialLibrary, type UploadHandle } from '../render/MaterialLibrary.ts';
import type { QualityTierId } from '../render/quality.ts';
import { appearanceSeed, attachSurfaceAppearance } from '../render/SurfaceAppearance.ts';
import { SurfaceLighting } from '../render/SurfaceGeometry.ts';
import { boxGeometry, slopeBounds, waterBase } from '../render/BoxShapes.ts';
import { attachWindowRoom, WINDOW_ROOM_MATS } from '../render/WindowRoom.ts';
import { OUTSIDE_VIEW_MAT } from '../render/OutsideView.ts';
import type { LitLayout } from '../render/litLayout.ts';

/** v1 と同じ: 拡散は材質側で抑えるので、点光源は鏡面反射担当として強めに戻す */
export const DYNAMIC_LIGHT_SCALE = 3.0;

export interface ManagedLight {
  spec: LightSpec;
  cell: string;
  /** spec.intensity × DYNAMIC_LIGHT_SCALE */
  base: number;
}

/** 焼き込み陰影を混ぜるメッシュ: 全部の照明ありの値と、照明ごとの「その照明なし」の値 */
interface BlendMesh { mesh: THREE.Mesh; on: Float32Array; offs: { lamp: string; off: Float32Array }[] }

/** 区画のライトマップ（検証用に状態を持つ） */
export interface CellLightmap {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  texel: number;
  ready: boolean;
  failed?: string;
  job: LightmapJobHandle | null;
  upload: UploadHandle | null;
  /** 焼くのにかかった時間（Worker・依頼から反映まで） */
  workerMs?: number;
  latencyMs?: number;
}

export interface BuiltCell {
  id: string;
  layout: CellLayout;
  group: THREE.Group;
  bounds: AABB;
  /** 出現型の隠し: 現れたら見せる / 現れたら隠す */
  reveal: Map<string, THREE.Mesh[]>;
  conceal: Map<string, THREE.Mesh[]>;
  /** 部品で入切する照明の発光パネル */
  lampPanels: Map<string, { on: THREE.Mesh[]; off: THREE.Mesh[] }>;
  /** 照明で焼き込み陰影を混ぜるメッシュ */
  blend: BlendMesh[];
  /** この区画に効く照明（lamp id） */
  lamps: string[];
  /** 焼き込み陰影（動く物の明るさを測るのに使う）。offs は照明ごとの「その照明なし」 */
  lighting: { on: SurfaceLighting; offs: Map<string, SurfaceLighting> };
  /** ライトマップ（mid / high で焼く区画だけ） */
  lightmap?: CellLightmap;
  triangles: number;
}

export interface BuiltFloor {
  floor: FloorLayout;
  root: THREE.Group;
  cells: Map<string, BuiltCell>;
  lights: ManagedLight[];
  dispose(): void;
}

const SKIP_KINDS = new Set(['colliderOnly', 'emitOnly']);

export interface FloorBuilderOptions {
  /** 画質の段階（mid / high でライトマップを焼く。省略時は焼かない） */
  tier?: QualityTierId;
}

export class FloorBuilder {
  private readonly materials: MaterialLibrary;
  private readonly tier: QualityTierId | undefined;

  constructor(materials: MaterialLibrary, opts: FloorBuilderOptions = {}) {
    this.materials = materials;
    this.tier = opts.tier;
  }

  build(floor: FloorLayout): BuiltFloor {
    const root = new THREE.Group();
    root.name = `floor:${floor.id}`;
    const cells = new Map<string, BuiltCell>();
    const lights: ManagedLight[] = [];
    const disposables: THREE.BufferGeometry[] = [];
    // 広い開口（扉のない opening）でつながる隣の区画: その照明も焼き込みの光源にする（境目で明るさが切れないように）
    const neighbors = new Map<string, CellLayout[]>();
    for (const pt of floor.portals) {
      if (pt.kind !== 'opening') continue;
      const [a, b] = pt.cells.map((id) => floor.cells.find((c) => c.id === id));
      if (!a || !b) continue;
      neighbors.set(a.id, [...(neighbors.get(a.id) ?? []), b]);
      neighbors.set(b.id, [...(neighbors.get(b.id) ?? []), a]);
    }
    for (const cell of floor.cells) {
      const built = this.buildCell(floor, cell, disposables, neighbors.get(cell.id) ?? []);
      cells.set(cell.id, built);
      root.add(built.group);
      for (const l of cell.lights) lights.push({ spec: l, cell: cell.id, base: l.intensity * DYNAMIC_LIGHT_SCALE });
    }
    return {
      floor,
      root,
      cells,
      lights,
      dispose: () => {
        root.removeFromParent();
        for (const g of disposables) g.dispose();
        for (const c of cells.values()) {
          const lm = c.lightmap;
          if (!lm) continue;
          lm.job?.cancel();
          lm.upload?.cancel();
          lm.texture.dispose();
        }
        for (const c of floor.cells) this.materials.releaseRoom(c.materialKey ?? c.id);
      },
    };
  }

  private buildCell(floor: FloorLayout, cell: CellLayout, disposables: THREE.BufferGeometry[], neighbors: CellLayout[]): BuiltCell {
    const group = new THREE.Group();
    group.name = `cell:${cell.id}`;
    const fy = cell.floorY;
    group.position.y = fy;
    const matKey = cell.materialKey ?? cell.id;
    const cellSeed = hashAll(floor.seed, 'cell', matKey);
    const drawn = cell.boxes.filter((b) => !SKIP_KINDS.has(b.kind ?? '') && b.max[0] - b.min[0] > 1e-4 && b.max[1] - b.min[1] > 1e-4 && b.max[2] - b.min[2] > 1e-4);
    // 隣の区画の照明器具（描かない。光源としてだけ焼き込みに入れる。遮蔽には使わない）
    const borrowed: Box[] = [];
    const borrowedLights: LightSpec[] = [];
    for (const n of neighbors) {
      for (const b of n.boxes) if (SURFACES[b.mat]?.emission && !b.revealGroup && b.max[1] - b.min[1] < 0.1) borrowed.push({ ...b, solid: false });
      borrowedLights.push(...n.lights);
    }
    const lampIds = new Set<string>();
    for (const b of [...drawn, ...borrowed]) if (b.kind?.startsWith('lamp:')) lampIds.add(b.kind.slice(5));
    for (const l of [...cell.lights, ...borrowedLights]) if (l.lampId) lampIds.add(l.lampId);

    // 焼き込み: 全部の照明あり（on）と、lamp ごとに「その照明なし」（off）。
    // 焼き込みの範囲の下端は床板の下（floorY − 0.2）のまま（床に沈めた水槽で cell.bounds が下がっても、壁の足元の陰りの基準を変えない）
    const litBounds: AABB = { min: [cell.bounds.min[0], Math.max(cell.bounds.min[1], fy - 0.2), cell.bounds.min[2]], max: cell.bounds.max };
    const lit = (boxes: Box[], lightsIn: LightSpec[]): LitLayout => ({ bounds: litBounds, footprint: cell.footprint, height: cell.height, boxes: boxes.filter((b) => !b.slope), lights: lightsIn, palette: cell.palette, ...(cell.lighting ? { lighting: cell.lighting } : {}) });
    const all = [...drawn, ...borrowed];
    const allLights = [...cell.lights, ...borrowedLights];
    const bakeOn = new SurfaceLighting(lit(all, allLights));
    const bakeOff = new Map<string, SurfaceLighting>();
    for (const id of lampIds) {
      const boxes = all.map((b) => (b.kind === `lamp:${id}` ? { ...b, mat: 'lightOff' as MatId } : b));
      bakeOff.set(id, new SurfaceLighting(lit(boxes, allLights.filter((l) => l.lampId !== id))));
    }
    const lampList = [...lampIds];

    // ライトマップの対象（外殻と大きな家具の面）とアトラス
    const lmCfg = this.tier ? LIGHTMAP_TIER[this.tier] : undefined;
    const lmWanted = !!lmCfg && !lampList.length && lightmapsSupported();
    const targetOf = new Map<Box, number>();
    const lmTargets: Box[] = [];
    if (lmWanted) {
      for (const b of drawn) {
        if (b.kind?.startsWith('lamp:') || b.revealGroup || b.concealGroup || b.slope) continue;
        const sf = SURFACES[b.mat];
        if (isLightmapTarget(b, !!sf?.emission, !!sf?.decal)) { targetOf.set(b, lmTargets.length); lmTargets.push(b); }
      }
    }
    // 隠れた面（床板の裏・家具の底）の判定に使う外殻の箱
    const shell = drawn.filter((b) => b.solid && /^(floor|ceiling|wall)/.test(b.mat));
    const atlas = lmCfg && lmTargets.length ? allocateLightmapAtlas(lmTargets, { texel: lmCfg.texel, maxSize: lmCfg.maxSize, footprint: cell.footprint, bounds: cell.bounds, shell }) : null;
    const lmTex = atlas ? createLightmapTexture(atlas.width, atlas.height) : null;

    // 箱 → ジオメトリ（区分 bucket と材質ごとに結合する）。ranges: 結合後のメッシュの中でライトマップ対象の頂点範囲（[start, count] の列）。
    // base: メッシュの原点の高さ（区画の Group から。水面は箱の底、ほかは 0 = 床）
    const buckets = new Map<string, { mat: MatId; geos: THREE.BufferGeometry[]; kind: string; group: string; ranges: number[]; offset: number; base: number }>();
    const put = (key: string, mat: MatId, kind: string, grp: string, g: THREE.BufferGeometry, ranges: [number, number][] | null, base = 0): void => {
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat, geos: [], kind, group: grp, ranges: [], offset: 0, base }));
      if (ranges) for (const [st, c] of ranges) b.ranges.push(b.offset + st, c);
      b.offset += g.getAttribute('position').count;
      b.geos.push(g);
    };
    let triangles = 0;
    for (const b of drawn) {
      const lamp = b.kind?.startsWith('lamp:') ? b.kind.slice(5) : null;
      const variants: { mat: MatId; kind: string; grp: string }[] = lamp
        ? [{ mat: b.mat, kind: 'lampOn', grp: lamp }, { mat: 'lightOff', kind: 'lampOff', grp: lamp }]
        : b.revealGroup ? [{ mat: b.mat, kind: 'reveal', grp: b.revealGroup }]
          : b.concealGroup ? [{ mat: b.mat, kind: 'conceal', grp: b.concealGroup }]
            : [{ mat: b.mat, kind: 'static', grp: '' }];
      for (const v of variants) {
        const box: Box = v.mat === b.mat ? b : { ...b, mat: v.mat };
        let g = boxGeometry(box);
        if (WINDOW_ROOM_MATS.has(box.mat) || box.mat === OUTSIDE_VIEW_MAT) attachWindowRoom(g, box.min, box.max);
        // uv1（ライトマップ）。結合する全ジオメトリが同じ属性を持つよう、対象外の箱にも黒テクセルの uv1 を付ける。範囲は toNonIndexed 後の頂点範囲
        let ranges: [number, number][] | null = null;
        if (atlas) {
          const ti = v.kind === 'static' ? targetOf.get(b) : undefined;
          if (ti !== undefined) ranges = writeLightmapUV(g, box, atlas.rects[ti]!, atlas);
          else writeConstantUV1(g, atlas.blackU, atlas.blackV);
        }
        attachSurfaceAppearance(g, appearanceSeed(floor.seed, matKey, box.mat));
        // 傾けた箱は、傾けた後の外接の箱を「自分の箱」として焼く（近くの器具・遮蔽物の絞り込みの中心と大きさ）
        const own = slopeBounds(box);
        bakeOn.bake(g, own);
        // 照明ごとの「なし」の焼き込みを別の属性に（結合のため全部の箱に同じ属性を付ける）
        for (const id of lampList) {
          const tmp = g.clone();
          bakeOff.get(id)!.bake(tmp, own);
          g.setAttribute(`bakedOff_${id}`, tmp.getAttribute('bakedLight'));
          tmp.dispose();
        }
        if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
        // 水面: メッシュの原点を箱の底に（水深 = メッシュの座標の y）。底の高さごとに別のメッシュ
        const wb = waterBase(box);
        const origin = wb ?? fy;
        if (origin !== 0) g.translate(0, -origin, 0);
        triangles += g.getAttribute('position').count / 3;
        put(`${v.kind}|${v.grp}|${v.mat}${wb === null ? '' : `|base${(wb - fy).toFixed(3)}`}`, v.mat, v.kind, v.grp, g, ranges, wb === null ? 0 : wb - fy);
      }
    }

    const built: BuiltCell = { id: cell.id, layout: cell, group, bounds: cell.bounds, reveal: new Map(), conceal: new Map(), lampPanels: new Map(), blend: [], lamps: lampList, lighting: { on: bakeOn, offs: bakeOff }, triangles };
    const lmMeshes: { mesh: THREE.Mesh; ranges: number[] }[] = [];
    for (const [key, b] of buckets) {
      const merged = b.geos.length === 1 ? b.geos[0]! : mergeGeometries(b.geos, false);
      if (!merged) { console.warn(`[FloorBuilder] 結合に失敗: ${cell.id} ${key}`); continue; }
      if (b.geos.length > 1) for (const g of b.geos) g.dispose();
      disposables.push(merged);
      const lit = !!lmTex && b.ranges.length > 0;
      const mat = this.materials.forRoom(b.mat, { roomId: matKey, seed: cellSeed, palette: cell.palette, height: cell.height, overrides: materialOverridesFor(cell.render, cell.palette), ...(lit ? { lightMap: lmTex, lightMapIntensity: 1 } : {}) });
      const mesh = new THREE.Mesh(merged, mat);
      if (lit) lmMeshes.push({ mesh, ranges: b.ranges });
      mesh.name = `${cell.id}:${key}`;
      mesh.position.y = b.base;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
      // 照明の混ぜ合わせ
      const onAttr = merged.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
      if (lampList.length && onAttr) {
        const offs: BlendMesh['offs'] = [];
        for (const id of lampList) {
          const offAttr = merged.getAttribute(`bakedOff_${id}`) as THREE.BufferAttribute | undefined;
          if (!offAttr) continue;
          offs.push({ lamp: id, off: (offAttr.array as Float32Array).slice() });
          merged.deleteAttribute(`bakedOff_${id}`);
        }
        built.blend.push({ mesh, on: (onAttr.array as Float32Array).slice(), offs });
      }
      if (b.kind === 'reveal') { mesh.visible = false; push(built.reveal, b.group, mesh); }
      else if (b.kind === 'conceal') push(built.conceal, b.group, mesh);
      else if (b.kind === 'lampOn' || b.kind === 'lampOff') {
        const e = built.lampPanels.get(b.group) ?? { on: [], off: [] };
        (b.kind === 'lampOn' ? e.on : e.off).push(mesh);
        built.lampPanels.set(b.group, e);
      }
    }
    if (atlas && lmTex && lmCfg && lmMeshes.length) built.lightmap = this.bakeLightmap(group, bakeOn, atlas, lmTex, lmCfg.aoRays, lmMeshes);
    else lmTex?.dispose();
    return built;
  }

  /**
   * Worker へ焼き込みを頼む（結果は非同期。見えている区画が先）。届いたら画像の中身を差し替え、頂点焼き込みからクロスフェードする。
   * テクスチャの GPU への転送は先行アップロードの待ち行列が 1 フレームに 1 区画分ずつ流す（v1 と同じ）
   */
  private bakeLightmap(group: THREE.Group, bake: SurfaceLighting, atlas: NonNullable<ReturnType<typeof allocateLightmapAtlas>>, tex: THREE.DataTexture, aoRays: number, meshes: { mesh: THREE.Mesh; ranges: number[] }[]): CellLightmap {
    const info: CellLightmap = { texture: tex, width: atlas.width, height: atlas.height, texel: atlas.texel, ready: false, job: null, upload: null };
    // faces は Worker へ転送されて元の配列が空になるので写しを渡す
    const req = { ...bake.payload(), width: atlas.width, height: atlas.height, faces: atlas.faces.slice(), aoRays };
    const started = performance.now();
    this.materials.track(tex);
    info.job = LightmapBaker.shared.enqueue(req, () => group.visible, (res) => {
      info.job = null;
      const apply = (): void => {
        (tex.image as unknown as { data: Uint16Array }).data = res.data;
        tex.needsUpdate = true;
        startLightmapCrossfade(meshes, performance.now());
        info.ready = true;
        info.upload = null;
        info.workerMs = res.ms;
        info.latencyMs = performance.now() - started;
        this.materials.uploadStats.lightmaps++;
      };
      if (L2_FLAGS.queue) info.upload = this.materials.uploads.enqueue(tex, { big: true, lightmap: true, priority: group.visible ? 0 : 1, run: apply });
      else apply();
    }, (reason) => { info.failed = reason; info.job = null; });
    return info;
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

/**
 * 照明の明るさ（lamp id → 0..1）を、発光パネルの切替と焼き込み陰影の混ぜ合わせに写す。
 * 陰影 = 全部あり − Σ（1 − 明るさ）×（全部あり − その照明なし）
 */
export function applyLampLevels(cell: BuiltCell, levelOf: (lampId: string) => number): void {
  for (const [id, panels] of cell.lampPanels) {
    const lv = levelOf(id);
    for (const m of panels.on) m.visible = lv >= 0.5;
    for (const m of panels.off) m.visible = lv < 0.5;
  }
  for (const b of cell.blend) {
    const attr = b.mesh.geometry.getAttribute('bakedLight') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    arr.set(b.on);
    for (const o of b.offs) {
      const k = 1 - levelOf(o.lamp);
      if (k <= 0) continue;
      for (let i = 0; i < arr.length; i++) arr[i] = arr[i]! - k * (b.on[i]! - o.off[i]!);
    }
    attr.needsUpdate = true;
  }
}

/** 区画の焼き込み陰影の、点 at での明るさ（照明の入切を反映）。動く物の頂点の明るさに使う */
export function sampleCellLight(cell: BuiltCell, at: [number, number, number], levelOf: (lampId: string) => number): [number, number, number] {
  const on = cell.lighting.on.sample(at);
  const out: [number, number, number] = [on[0], on[1], on[2]];
  for (const [id, off] of cell.lighting.offs) {
    const k = 1 - levelOf(id);
    if (k <= 0) continue;
    const o = off.sample(at);
    for (let i = 0; i < 3; i++) out[i] = out[i]! - k * (on[i]! - o[i]!);
  }
  return out;
}

/** 点を含む区画（無ければ null） */
export function cellAt(built: BuiltFloor, at: readonly [number, number, number]): BuiltCell | null {
  let best: BuiltCell | null = null;
  for (const c of built.cells.values()) {
    const b = c.bounds;
    if (at[0] < b.min[0] || at[0] > b.max[0] || at[2] < b.min[2] || at[2] > b.max[2] || at[1] < b.min[1] - 2 || at[1] > b.max[1] + 0.5) continue;
    // 重なるときは小さい区画（中に入っている方）
    if (!best || (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) < (best.bounds.max[0] - best.bounds.min[0]) * (best.bounds.max[2] - best.bounds.min[2])) best = c;
  }
  return best;
}
