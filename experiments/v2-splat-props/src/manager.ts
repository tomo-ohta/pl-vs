/**
 * 小物のスプラット化の司令塔。
 *
 * 1. v2 の FloorBuilder.buildCellJob を「この検証のページの中でだけ」包む（v2 のファイルは変えない）。
 *    小物に印（revealGroup）を付けた写しで区画を作らせ、小物のメッシュを受け取る（最初はメッシュで見せる）
 * 2. 毎フレーム、近くの区画から 1 つずつスプラットへ変える（写し取り → 粒 → SH → Spark の ExtSplats）
 *    遠ざかった区画はスプラットを捨ててメッシュへ戻す（メモリを抑えるため）
 * 3. Spark の SparkRenderer をゲームの scene に入れる（GTAO などの上書き描画からは外す）。粒の色は霧も v2 と同じに掛ける
 * 4. 懐中電灯（v2 の PlayerFlashlight。動く光）は焼き込めないので、Spark のシェーダで粒ごとに照らし直す
 *    （粒ごとの地の色・粗さ・金属度を小さなテクスチャで持つ。式は v2 の材質と同じ: 拡散 × 0.4 + GGX の鏡面）
 */
import * as THREE from 'three';
import { SparkRenderer, type SplatMesh } from '@sparkjsdev/spark';
import { DYNAMIC_LIGHT_SCALE, FloorBuilder, type CellUnit } from '../../../v2/client/world/FloorBuilder.ts';
import { excludeFromOverridePasses } from '../../../v2/client/render/OverridePassExclusion.ts';
import type { MaterialLibrary } from '../../../v2/client/render/MaterialLibrary.ts';
import { PASSABLE_VEGETATION, type Box, type CellLayout, type LightSpec } from '../../../v2/core/world/layout.ts';
import { GROUP_PREFIX, keepAsMesh, splitCell, type PropInfo } from './props.ts';
import { captureBoxes, type CaptureBox } from './capture.ts';
import { DEFAULT_FACEGEN, generateSplats, OccluderGrid, type FaceGenParams, type Occluder, type SplatBatch } from './facegen.ts';
import { DEFAULT_SH_PARAMS, type ShEnv, type ShLight, type ShMaterial, type ShParams } from './sh.ts';
import { ShPool } from './shPool.ts';
import { buildExtSplats, buildMaterialTexture, encodeQuat, faceQuatCode } from './splatbuild.ts';
import { depthProxyMaterial, SplatLighting } from './splatMaterial.ts';
import { ENV_H, ENV_LEVELS, ENV_W, envProbe } from './env.ts';

/** ゲーム（v2 の ClientGame。必要な所だけ） */
export interface GameLike {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  materials: MaterialLibrary;
}

type State = 'mesh' | 'converting' | 'splat' | 'failed';

interface Rec {
  id: number;
  unit: CellUnit;
  cell: CellLayout;
  neighbors: CellLayout[];
  props: PropInfo[];
  meshes: THREE.Mesh[];
  state: State;
  /** 変換の世代（捨てられた・やり直したら進む。古い変換の続きを止める） */
  token: number;
  disposed: boolean;
  splat: SplatMesh | null;
  batch: SplatBatch | null;
  lights: ShLight[];
  /** 映り込み（環境マップ）と材質表。つやを変えて SH を計算し直すときに使う */
  env: ShEnv | null;
  /** 粒ごとの材質（懐中電灯用） */
  matTex: THREE.DataArrayTexture | null;
  fog: { color: THREE.Vector3; near: number; far: number } | null;
  stats: { splats: number; glossy: number; boxes: number; captureMs: number; genMs: number; shMs: number; totalMs: number; texel: number } | null;
  error?: string;
}

export interface Settings {
  /** スプラットで見せる（false なら v2 のメッシュの小物） */
  showSplats: boolean;
  /** スプラットにする半径（m。カメラから区画の外形まで） */
  radius: number;
  /** 細かい粒の大きさ（m） */
  texel: number;
  /** 1 区画の細かい粒（まとめる前）の上限。超えたら粒を粗くする */
  maxLeaves: number;
  /** スプラットにした区画の粒の合計の上限（メモリと描画の重さ）。超えそうなら遠い区画をメッシュへ戻す */
  budget: number;
  sh: ShParams;
  face: FaceGenParams;
}

export interface Totals {
  cells: number;
  props: number;
  converted: number;
  converting: string | null;
  splats: number;
  glossy: number;
  failed: number;
  lastMs: number;
}

export class SplatPropManager {
  readonly settings: Settings;
  private readonly recs = new Set<Rec>();
  private nextId = 1;
  private game: GameLike | null = null;
  private spark: SparkRenderer | null = null;
  private pool: ShPool | null = null;
  private busy = false;
  private lastMs = 0;
  private lastFrame = 0;
  /** 画面の更新の速さ（指数移動平均） */
  fps = 0;
  /** 粒の色の後処理（霧・懐中電灯）の uniform。毎フレーム v2 のゲームから写す */
  private readonly lighting = new SplatLighting();
  onChange: (() => void) | null = null;

  constructor(settings?: Partial<Settings>) {
    this.settings = {
      showSplats: true,
      radius: 18,
      texel: 0.01,
      maxLeaves: 1_500_000,
      budget: 2_500_000,
      sh: { ...DEFAULT_SH_PARAMS },
      face: { ...DEFAULT_FACEGEN },
      ...settings,
    };
  }

  /** FloorBuilder を包む（ゲームを作る前に呼ぶ） */
  install(): void {
    const proto = FloorBuilder.prototype as unknown as { buildCellJob: (this: FloorBuilder, seed: number, cell: CellLayout, neighbors: CellLayout[]) => Generator<void, CellUnit, void> };
    const original = proto.buildCellJob;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const mgr = this;
    proto.buildCellJob = function* (seed, cell, neighbors) {
      const split = splitCell(cell);
      const unit = yield* original.call(this, seed, split.cell, neighbors);
      // 区画の中身の情報は元のまま（地図・痕跡などが読む。写しの印を見せない）
      unit.built.layout = cell;
      if (split.props.length) mgr.register(unit, cell, split.props, neighbors);
      return unit;
    };
  }

  /** ゲームができたら呼ぶ（SparkRenderer を scene に入れて、毎フレームの処理を始める） */
  attach(game: GameLike): void {
    this.game = game;
    const spark = new SparkRenderer({ renderer: game.renderer, accumExtSplats: true, enable2DGS: true });
    spark.name = 'splat-props:spark';
    game.scene.add(spark);
    // GTAO（法線・深度）・レンズの深度など scene.overrideMaterial で描く補助パスには入れない
    excludeFromOverridePasses(spark);
    this.spark = spark;
    this.pool = new ShPool();
    const loop = (): void => {
      requestAnimationFrame(loop);
      this.frame();
    };
    requestAnimationFrame(loop);
  }

  get sparkRenderer(): SparkRenderer | null {
    return this.spark;
  }

  totals(): Totals {
    let props = 0, converted = 0, splats = 0, glossy = 0, failed = 0;
    let converting: string | null = null;
    for (const r of this.recs) {
      props += r.props.length;
      if (r.state === 'splat') { converted++; splats += r.stats?.splats ?? 0; glossy += r.stats?.glossy ?? 0; }
      if (r.state === 'failed') failed++;
      if (r.state === 'converting') converting = r.cell.id;
    }
    return { cells: this.recs.size, props, converted, converting, splats, glossy, failed, lastMs: this.lastMs };
  }

  /** 変換済みの区画（パネルの一覧） */
  list(): { id: string; props: number; state: State; splats: number; ms: number; texel: number; error?: string }[] {
    return [...this.recs].map((r) => ({ id: r.cell.id, props: r.props.length, state: r.state, splats: r.stats?.splats ?? 0, ms: r.stats?.totalMs ?? 0, texel: r.stats?.texel ?? 0, ...(r.error ? { error: r.error } : {}) }));
  }

  /** メッシュとスプラットの切り替え */
  setShowSplats(on: boolean): void {
    this.settings.showSplats = on;
    for (const r of this.recs) this.applyVisibility(r);
    this.onChange?.();
  }

  /** 粒の作り方を変えたので、変換済みの区画を全部作り直す */
  rebuildAll(): void {
    for (const r of this.recs) if (r.state !== 'converting') this.release(r, false);
    for (const r of this.recs) if (r.state === 'converting') { r.token++; this.release(r, false); }
  }

  /** つや（SH）だけ変えた: 写し取りはやり直さず、SH を計算し直す */
  async reshadeAll(): Promise<void> {
    if (!this.pool) return;
    for (const r of this.recs) {
      if (r.state !== 'splat' || !r.batch || !r.splat) continue;
      const token = r.token;
      const shade = await this.pool.run(toShInput(r.batch), r.lights, this.settings.sh, r.env);
      if (r.token !== token || r.disposed || !r.splat) continue;
      const old = r.splat;
      r.splat = this.lighting.createMesh(buildExtSplats(r.batch, shade), r.matTex!, `splat-props:${r.cell.id}`, r.fog);
      if (r.stats) { r.stats.glossy = shade.glossy; r.stats.shMs = shade.ms; }
      r.unit.built.group.add(r.splat);
      old.removeFromParent();
      old.dispose();
      this.applyVisibility(r);
    }
    this.onChange?.();
  }

  // ---------------------------------------------------------------- 区画の登録と後始末

  private register(unit: CellUnit, cell: CellLayout, props: PropInfo[], neighbors: CellLayout[]): void {
    const meshes: THREE.Mesh[] = [];
    for (const [key, list] of unit.built.reveal) {
      if (!key.startsWith(GROUP_PREFIX)) continue;
      meshes.push(...list);
      unit.built.reveal.delete(key);
    }
    const r: Rec = {
      id: this.nextId++, unit, cell, neighbors, props, meshes, state: 'mesh', token: 0, disposed: false, splat: null, batch: null, lights: [],
      env: null, matTex: null, fog: null, stats: null,
    };
    this.applyVisibility(r);
    this.recs.add(r);
    const dispose = unit.dispose;
    unit.dispose = () => {
      r.disposed = true;
      r.token++;
      this.release(r, false);
      this.recs.delete(r);
      dispose();
    };
    this.onChange?.();
  }

  /** スプラットを捨ててメッシュへ戻す */
  private release(r: Rec, failed: boolean): void {
    if (r.splat) {
      r.splat.removeFromParent();
      r.splat.dispose();
      r.splat = null;
    }
    r.matTex?.dispose();
    r.matTex = null;
    r.batch = null;
    r.env = null;
    r.stats = null;
    r.state = failed ? 'failed' : 'mesh';
    this.applyVisibility(r);
  }

  /**
   * スプラットで見せるときも、小物のメッシュは「深さだけを書く代役」として残す（色は書かない・面を 4 mm 内側へ）。
   * - GTAO（画面空間の遮蔽）・レンズの深度は scene.overrideMaterial でメッシュを描き直して作るので、代役が無いと
   *   スプラットの後ろの床と壁の隅の陰をスプラットに掛けてしまう（小物が暗く沈む）
   * - 箱の裏側の面の粒や、小物の後ろにある物の粒は代役の深さで隠れる
   */
  private applyVisibility(r: Rec): void {
    const splat = this.settings.showSplats && r.state === 'splat' && !!r.splat;
    for (const m of r.meshes) {
      const orig = (m.userData.splatOrigMaterial ??= m.material) as THREE.Material;
      // 葉の粒は箱の中に散らすので、葉の箱を深さの代役にすると中の粒が隠れる。葉の箱はスプラットのときは消す
      const leaf = this.settings.face.foliage && /\|(plantLeaf|plant)$/.test(m.name);
      m.visible = !(splat && leaf);
      m.material = splat && !leaf ? depthProxyMaterial() : orig;
    }
    if (r.splat) r.splat.visible = splat;
  }

  // ---------------------------------------------------------------- 毎フレーム

  private frame(): void {
    const g = this.game;
    if (!g) return;
    const now = performance.now();
    if (this.lastFrame) { const dt = now - this.lastFrame; if (dt > 0 && dt < 1000) this.fps = this.fps ? this.fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt; }
    this.lastFrame = now;
    this.lighting.update(g, this.settings.sh.gloss, this.settings.sh.roughScale);
    // 近い順に 1 つずつ変える。遠い区画は戻す
    const cam = this.lighting.camPos.value;
    let best: Rec | null = null;
    let bestScore = Infinity, bestD = Infinity;
    let total = 0;
    let farthest: Rec | null = null, farD = -1;
    for (const r of this.recs) {
      const d = this.distanceTo(r, cam);
      if (r.state === 'splat' && d > this.settings.radius + 12) this.release(r, false);
      if (r.state === 'splat') {
        total += r.stats?.splats ?? 0;
        if (d > farD) { farD = d; farthest = r; }
      }
      if (r.state !== 'mesh' || d > this.settings.radius) continue;
      // 見えている区画を先に
      const score = d - (this.visible(r) ? 1000 : 0);
      if (score < bestScore) { bestScore = score; bestD = d; best = r; }
    }
    if (!best || this.busy) return;
    // 粒の合計が上限を超えていたら、いちばん遠い区画が今の候補より遠いときだけ戻して空ける（近い区画を優先）
    if (total > this.settings.budget) {
      if (farthest && farD > bestD + 2) this.release(farthest, false);
      return;
    }
    void this.convert(best);
  }

  private visible(r: Rec): boolean {
    let o: THREE.Object3D | null = r.unit.built.group;
    while (o) { if (!o.visible) return false; o = o.parent; }
    return true;
  }

  /** カメラから区画の外形までの距離（区画が scene に入っていなければ ∞） */
  private distanceTo(r: Rec, cam: THREE.Vector3): number {
    const group = r.unit.built.group;
    const parent = group.parent;
    if (!parent) return Infinity;
    const b = r.cell.bounds;
    const box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(parent.matrixWorld);
    return box.distanceToPoint(cam);
  }

  // ---------------------------------------------------------------- 変換

  private async convert(r: Rec): Promise<void> {
    const g = this.game!;
    this.busy = true;
    r.state = 'converting';
    const token = ++r.token;
    const t0 = performance.now();
    this.onChange?.();
    try {
      const group = r.unit.built.group;
      group.updateMatrix();
      const unitFromFloor = group.matrix.clone().invert();

      // 1. 小物のメッシュを箱ごとの頂点の範囲に分ける
      const { boxes, idOf } = this.collectBoxes(r, unitFromFloor);
      if (!boxes.length) throw new Error('小物の箱が見つからない');
      let texel = this.settings.texel;
      const area = boxes.reduce((a, b) => { const s = b.aabb.getSize(new THREE.Vector3()); return a + 2 * (s.x * s.y + s.y * s.z + s.x * s.z); }, 0);
      texel = Math.max(texel, Math.sqrt(area / this.settings.maxLeaves));

      // 2. v2 の材質で写し取る
      const cap = await captureBoxes({ renderer: g.renderer, materials: g.materials, scene: g.scene }, boxes, texel);
      if (r.token !== token) return;

      // 3. 粒を作る（見えない面は作らない）
      const t1 = performance.now();
      const grid = new OccluderGrid(this.occluders(r, unitFromFloor, idOf));
      const { indexOf, env } = this.materialTable(g, boxes, group);
      const materialOf = (b: CaptureBox): { metal: number; index: number; foliage: boolean } => {
        const m = originalMaterial(b.mesh) as THREE.MeshStandardMaterial;
        return { metal: m.metalness ?? 0, index: indexOf.get(m) ?? 0, foliage: /\|(plantLeaf|plant)$/.test(b.mesh.name) };
      };
      const gen = generateSplats(cap, boxes, grid, materialOf, this.settings.face, faceQuatCode, encodeQuat);
      let batch: SplatBatch;
      for (;;) {
        const step = gen.next();
        if (step.done) { batch = step.value; break; }
        await nextFrame();
        if (r.token !== token) return;
      }
      const genMs = performance.now() - t1;

      // 4. 点光源から見る向きで変わる色（SH）を計算する（Worker）
      const lights = this.lightsFor(r, unitFromFloor);
      const shade = await this.pool!.run(toShInput(batch), lights, this.settings.sh, env);
      if (r.token !== token) return;

      // 5. Spark の粒にして区画の入れ物に入れる
      r.batch = batch;
      r.lights = lights;
      r.env = env;
      r.matTex = buildMaterialTexture(batch);
      r.fog = r.cell.render?.fog ? { color: new THREE.Vector3().setFromColor(new THREE.Color(r.cell.render.fog.color)), near: r.cell.render.fog.near, far: r.cell.render.fog.far } : null;
      r.splat = this.lighting.createMesh(buildExtSplats(batch, shade), r.matTex!, `splat-props:${r.cell.id}`, r.fog);
      group.add(r.splat);
      r.state = 'splat';
      r.stats = { splats: batch.n, glossy: shade.glossy, boxes: boxes.length, captureMs: cap.ms, genMs, shMs: shade.ms, totalMs: performance.now() - t0, texel: cap.texel };
      this.lastMs = r.stats.totalMs;
      this.applyVisibility(r);
      console.info(`[splat-props] ${r.cell.id}: 小物 ${r.props.length}・箱 ${boxes.length}・粒 ${batch.n.toLocaleString()}（つやあり ${shade.glossy.toLocaleString()}）・粒の大きさ ${(cap.texel * 100).toFixed(1)} cm・写し ${cap.ms.toFixed(0)} ms・粒 ${genMs.toFixed(0)} ms・SH ${shade.ms.toFixed(0)} ms・計 ${r.stats.totalMs.toFixed(0)} ms`);
    } catch (e) {
      console.error('[splat-props] 変換に失敗', r.cell.id, e);
      r.error = String((e as Error)?.message ?? e);
      if (r.token === token) this.release(r, true);
    } finally {
      this.busy = false;
      this.onChange?.();
    }
  }

  /**
   * 材質表（粒の mat の添字）と環境マップ。材質ごとに: 映り込みの強さ・クリアコート（v2 の MeshPhysicalMaterial の値）・
   * 部屋の環境マップ（PMREM。粗さの段ごとに読み出す）
   */
  private materialTable(g: GameLike, boxes: CaptureBox[], group: THREE.Object3D): { table: ShMaterial[]; indexOf: Map<THREE.Material, number>; env: ShEnv } {
    const indexOf = new Map<THREE.Material, number>();
    const table: ShMaterial[] = [];
    const envIndex = new Map<THREE.Texture, number>();
    const probes: Float32Array[][] = [];
    for (const b of boxes) {
      const m = originalMaterial(b.mesh) as THREE.MeshPhysicalMaterial;
      if (indexOf.has(m)) continue;
      let env = -1;
      if (m.envMap && (m.envMap as THREE.Texture).mapping === THREE.CubeUVReflectionMapping) {
        env = envIndex.get(m.envMap) ?? -1;
        if (env < 0) {
          env = probes.length;
          envIndex.set(m.envMap, env);
          probes.push(envProbe(g.renderer, m.envMap));
        }
      }
      indexOf.set(m, table.length);
      table.push({ env, envIntensity: m.envMapIntensity ?? 1, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: m.clearcoatRoughness ?? 0 });
    }
    // 粒の座標系（区画の入れ物）→ ワールドの回転（行優先）
    group.updateWorldMatrix(true, false);
    const e = new THREE.Matrix4().extractRotation(group.matrixWorld).elements;
    const rot = [e[0]!, e[4]!, e[8]!, e[1]!, e[5]!, e[9]!, e[2]!, e[6]!, e[10]!];
    return { table, indexOf, env: { levels: ENV_LEVELS, w: ENV_W, h: ENV_H, probes, materials: table, rot } };
  }

  /** 小物のメッシュ（小物 × 材質）を、箱 1 つずつの頂点の範囲に分ける */
  private collectBoxes(r: Rec, unitFromFloor: THREE.Matrix4): { boxes: CaptureBox[]; idOf: Map<Box, number> } {
    const group = r.unit.built.group;
    const boxes: CaptureBox[] = [];
    const idOf = new Map<Box, number>();
    const c = new THREE.Vector3(), p = new THREE.Vector3();
    for (const mesh of r.meshes) {
      // メッシュの名前は `<区画>:reveal|splatprop:<番号>|<材質>`（FloorBuilder の bucket の鍵）
      const m = /\|splatprop:(\d+)\|([^|]+)$/.exec(mesh.name);
      if (!m) continue;
      const prop = r.props[Number(m[1])];
      if (!prop) continue;
      const list = prop.boxes.filter((b) => b.mat === m[2]);
      if (!list.length) continue;
      const meshToUnit = new THREE.Matrix4();
      for (let o: THREE.Object3D | null = mesh; o && o !== group; o = o.parent) {
        if (o.matrixAutoUpdate) o.updateMatrix();
        meshToUnit.premultiply(o.matrix);
      }
      // フロア座標 → メッシュの座標（= 区画の入れ物の座標 → メッシュの座標 の後に フロア → 区画の入れ物）
      const floorToMesh = meshToUnit.clone().invert().multiply(unitFromFloor);
      // 期待する外接の箱（メッシュの座標。3 mm 広げる）
      const expect = list.map((b) => new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(floorToMesh).expandByScalar(0.003));
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const ranges = list.map(() => ({ start: -1, end: -1 }));
      let k = 0;
      for (let t = 0; t + 2 < pos.count; t += 3) {
        c.set(0, 0, 0);
        for (let q = 0; q < 3; q++) c.add(p.fromBufferAttribute(pos, t + q));
        c.multiplyScalar(1 / 3);
        if (!expect[k]!.containsPoint(c)) {
          let found = -1;
          for (let s = 0; s < list.length; s++) { const kk = (k + s) % list.length; if (expect[kk]!.containsPoint(c)) { found = kk; break; } }
          if (found < 0) continue;
          k = found;
        }
        const rg = ranges[k]!;
        if (rg.start < 0) rg.start = t;
        rg.end = t + 3;
      }
      list.forEach((b, i) => {
        const rg = ranges[i]!;
        if (rg.start < 0) return;
        const aabb = new THREE.Box3();
        for (let v = rg.start; v < rg.end; v++) aabb.expandByPoint(p.fromBufferAttribute(pos, v).applyMatrix4(meshToUnit));
        const id = boxes.length;
        boxes.push({ id, mesh, start: rg.start, count: rg.end - rg.start, meshToUnit, aabb });
        idOf.set(b, id);
      });
    }
    return { boxes, idOf };
  }

  /** 接して見えない面を決める箱（区画の描かれる箱すべて。小物の箱は自分を除くため id を付ける） */
  private occluders(r: Rec, unitFromFloor: THREE.Matrix4, idOf: Map<Box, number>): Occluder[] {
    const out: Occluder[] = [];
    const box = new THREE.Box3();
    for (const b of r.cell.boxes) {
      if (b.kind === 'colliderOnly' || b.kind === 'emitOnly' || b.slope || b.revealGroup) continue;
      if (keepAsMesh(b.mat) || PASSABLE_VEGETATION.has(b.mat)) continue;
      box.set(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)).applyMatrix4(unitFromFloor);
      out.push({ id: idOf.get(b) ?? -1, minX: box.min.x, minY: box.min.y, minZ: box.min.z, maxX: box.max.x, maxY: box.max.y, maxZ: box.max.z });
    }
    return out;
  }

  /** この区画に効く点光源（区画と、扉の無い開口でつながる隣の区画の照明）を区画の入れ物の座標で */
  private lightsFor(r: Rec, unitFromFloor: THREE.Matrix4): ShLight[] {
    const specs: LightSpec[] = [...r.cell.lights, ...r.neighbors.flatMap((n) => n.lights)];
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    return specs.map((l) => {
      p.set(l.pos[0], l.pos[1], l.pos[2]).applyMatrix4(unitFromFloor);
      c.set(l.color);
      const k = l.intensity * DYNAMIC_LIGHT_SCALE;
      return { x: p.x, y: p.y, z: p.z, r: c.r * k, g: c.g * k, b: c.b * k, distance: l.distance };
    });
  }
}

/** 小物のメッシュの v2 の材質（代役に替えていても元の材質） */
export function originalMaterial(m: THREE.Mesh): THREE.Material {
  return (m.userData.splatOrigMaterial as THREE.Material | undefined) ?? (m.material as THREE.Material);
}

function toShInput(b: SplatBatch): import('./sh.ts').ShInput {
  return { n: b.n, center: b.center, dir: b.dir, base: b.base, albedo: b.albedo, rough: b.rough, metal: b.metal, mat: b.mat };
}

/**
 * 作業を区切って次の仕事へ回す（MessageChannel のタスク）。requestAnimationFrame で待つと、タブが裏にあるときや
 * 描画が重いときに 1 秒に 1 回まで落ちて変換が進まないので使わない。区切りの間にブラウザは描画できる
 */
const channel = new MessageChannel();
const waiting: (() => void)[] = [];
channel.port1.onmessage = () => waiting.shift()?.();
const nextFrame = (): Promise<void> => new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });
