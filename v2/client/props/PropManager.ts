/**
 * 作り込む小物の差し替え（FloorBuilder の PropHooks）。
 *
 * 1. 計画（plan）: 区画の箱から作り込む小物を見つけ（plan.ts）、8 m の区切り（タイル）に分ける。FloorBuilder は差し替える箱を
 *    区切りごとの別のメッシュにする（遠い所・作る前はこの箱を描く。当たり判定・シミュレーションは元の箱のまま）
 * 2. 作る（update）: カメラに近い区切りから 1 つずつ、Worker（props.worker.ts）で形の関数の物を作り、メインで焼き込み光を付けて
 *    v2 の材質のメッシュにする。テクスチャは v2 の先行アップロードの待ち行列で少しずつ GPU へ載せ、シェーダを用意してから出す
 * 3. 距離で細かさを変える: near_fine より近い区切りは細かく、near より近い区切りは棚の中身を粗く作り、far より遠い状態が
 *    FAR_HOLD 続いたら捨てて箱に戻す（v2 の霧の中なので、遠くの小物はほとんど見えない）。距離は画質ごと（LOD）
 * 4. 持てる物（carryItem / carryBody）は種類・大きさ・色ごとに 1 回作り、写しを置く（carryTemplate。views/carry/items.ts）
 */
import * as THREE from 'three';
import type { CellLayout } from '../../core/world/layout.ts';
import type { MaterialLibrary } from '../render/MaterialLibrary.ts';
import type { QualityTier, QualityTierId } from '../render/quality.ts';
import { IS_MOBILE } from '../device.ts';
import type { BlendMesh, BuiltCell, CellProps, PropCellPlan, PropHooks } from '../world/FloorBuilder.ts';
import { planCell, type PlanItem } from './plan.ts';
import type { PropSpec } from './registry.ts';
import type { PropBuildRequest, PropBuildResult } from './props.worker.ts';
import { buildPropMeshes, disposePropMeshes, type PropMeshes } from './propMeshes.ts';

/** 区切りの大きさ（m） */
const TILE = 8;
/** far より遠い状態がこの時間（ms）続いたら捨てる（階の入れ替えなどで一瞬だけ遠く測れることがあるので） */
const FAR_HOLD = 1500;
/** 棚の中身のように同じ物がたくさん並ぶ種類（遠い区切りでは粗く作る） */
const BULK = new Set(['books', 'goods']);

/** 画質ごとの距離（m。カメラから区切りの外接球まで）と細かさ（形の間隔の倍率。大きいほど粗い） */
/** tex は模様（テクスチャ）の細かさ（GPU の量の大半なので、画質で下げる） */
export const PROP_LOD: Record<QualityTierId, { near: number; fine: number; fineKeep: number; far: number; detail: number; bulk: number; other: number; tex: number }> = {
  high: { near: 22, fine: 10, fineKeep: 14, far: 32, detail: 1.5, bulk: 2, other: 1.3, tex: 1 },
  mid: { near: 18, fine: 8, fineKeep: 12, far: 26, detail: 1.7, bulk: 2, other: 1.3, tex: 0.75 },
  low: { near: 13, fine: 6, fineKeep: 9, far: 19, detail: 2.2, bulk: 1.8, other: 1.25, tex: 0.65 },
};

type Level = 0 | 1;

/** 画質ごとの距離と細かさ（スマホはメモリが少ないので、どの画質でも low の距離と細かさ） */
const lodOf = (t: QualityTier): (typeof PROP_LOD)[QualityTierId] => PROP_LOD[IS_MOBILE ? 'low' : t.id];

interface TileDraft { key: string; items: PlanItem[]; center: THREE.Vector3; radius: number }

interface Tile extends TileDraft {
  cell: CellRec;
  /** 作ってある細かさの段（null は未だ・捨てた） */
  level: Level | null;
  /** 作っている最中の番号（捨てたら変えて、届いた結果を捨てる） */
  gen: number;
  building: boolean;
  meshes: PropMeshes | null;
  triangles: number;
  bytes: number;
  farSince: number | null;
  failed: boolean;
}

interface CellRec { built: BuiltCell; props: CellProps; tiles: Tile[]; disposed: boolean }

export interface PropManagerOptions {
  materials: MaterialLibrary;
  /** 無ければ（試験）GPU へ先に載せる・シェーダを用意する手順を飛ばす */
  renderer?: THREE.WebGLRenderer | null;
  camera: THREE.Camera;
  scene?: THREE.Scene | null;
  tier: QualityTier;
}

export interface PropStats {
  cells: number;
  tiles: number;
  ready: number;
  fine: number;
  items: number;
  triangles: number;
  bytes: number;
  building: number;
  failed: number;
  dropped: number;
  /** 種類ごとの数（出している区切りの分） */
  labels: Map<string, number>;
}

/** Worker（無い環境では同じ処理をその場で） */
class PropWorkerClient {
  private worker: Worker | null = null;
  private seq = 1;
  private readonly pending = new Map<number, (r: PropBuildResult) => void>();
  private fallback: Promise<(req: PropBuildRequest) => PropBuildResult> | null = null;

  constructor() {
    if (typeof Worker === 'undefined' || typeof window === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./props.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<PropBuildResult>) => { const f = this.pending.get(e.data.id); this.pending.delete(e.data.id); f?.(e.data); };
      this.worker.onerror = (e) => {
        console.warn('[props] Worker が使えないので、その場で作る', e.message);
        this.worker?.terminate();
        this.worker = null;
        const waiting = [...this.pending.values()];
        this.pending.clear();
        for (const f of waiting) f({ id: 0, data: null, failed: 0, ms: 0, error: 'worker' });
      };
    } catch { this.worker = null; }
  }

  run(items: PropBuildRequest['items'], tex = 1): Promise<PropBuildResult> {
    const id = this.seq++;
    const req: PropBuildRequest = { id, items, tex };
    const w = this.worker;
    if (w) return new Promise((resolve) => { this.pending.set(id, resolve); w.postMessage(req); });
    this.fallback ??= import('./props.worker.ts').then((m) => m.buildProps);
    return this.fallback.then((build) => build(req));
  }

  dispose(): void { this.worker?.terminate(); this.worker = null; this.pending.clear(); }
}

/** 区切って進める（MessageChannel のタスク。rAF は裏のタブで止まるので使わない） */
function makePause(budgetMs: number): () => Promise<void> {
  let t = performance.now();
  const next = (): Promise<void> => new Promise((r) => {
    if (typeof MessageChannel === 'undefined') { setTimeout(r, 0); return; }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); r(); };
    ch.port2.postMessage(0);
  });
  return async () => { if (performance.now() - t > budgetMs) { await next(); t = performance.now(); } };
}

export class PropManager implements PropHooks {
  private readonly materials: MaterialLibrary;
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly camera: THREE.Camera;
  private readonly scene: THREE.Scene | null;
  private tier: QualityTier;
  private readonly cells = new Set<CellRec>();
  private readonly worker = new PropWorkerClient();
  private inFlight = 0;
  /** 形の関数の物を出すか（false なら箱のまま。開発用の見比べ） */
  private enabled = true;
  private readonly labels = new Map<string, number>();
  private failedItems = 0;
  private dropped = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly cam = new THREE.Vector3();
  /** 持てる物の形（種類・大きさ・色ごと） */
  private readonly templates = new Map<string, Promise<THREE.Object3D | null>>();

  constructor(o: PropManagerOptions) {
    this.materials = o.materials;
    this.renderer = o.renderer ?? null;
    this.camera = o.camera;
    this.scene = o.scene ?? null;
    this.tier = o.tier;
  }

  /** 画質を変えた（次に作る区切りから効く。距離も変わる） */
  setTier(tier: QualityTier): void { this.tier = tier; }

  get isEnabled(): boolean { return this.enabled; }

  /** 形の関数の物を出す / 箱に戻す（戻すときは作った物を捨てる） */
  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) for (const c of this.cells) for (const t of c.tiles) this.release(t);
  }

  // ---------------------------------------------------------------- FloorBuilder から

  plan(cell: CellLayout): PropCellPlan | null {
    const items = planCell(cell);
    if (!items.length) return null;
    const hide = new Map<PlanItem['hide'][number], string>(), add = new Map<PlanItem['add'][number], string>();
    const byKey = new Map<string, { items: PlanItem[]; box: THREE.Box3 }>();
    for (const it of items) {
      const box = new THREE.Box3();
      for (const b of [...it.hide, ...it.add]) box.union(new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)));
      // 箱を隠さない物（自販機の見本）は置き場所の周り
      if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(...it.spec.o), new THREE.Vector3(1, 1, 1));
      const c = box.getCenter(new THREE.Vector3());
      const key = `${Math.floor(c.x / TILE)},${Math.floor(c.z / TILE)}`;
      let t = byKey.get(key);
      if (!t) byKey.set(key, t = { items: [], box: new THREE.Box3() });
      t.items.push(it);
      t.box.union(box);
      for (const b of it.hide) hide.set(b, key);
      for (const b of it.add) add.set(b, key);
    }
    const tiles: TileDraft[] = [...byKey].map(([key, t]) => { const s = t.box.getBoundingSphere(new THREE.Sphere()); return { key, items: t.items, center: s.center, radius: s.radius }; });
    return { hide, add, data: tiles };
  }

  attach(built: BuiltCell): void {
    const props = built.props;
    if (!props) return;
    const rec: CellRec = { built, props, tiles: [], disposed: false };
    rec.tiles = (props.plan.data as TileDraft[]).map((d) => ({ ...d, cell: rec, level: null, gen: 0, building: false, meshes: null, triangles: 0, bytes: 0, farSince: null, failed: false }));
    this.cells.add(rec);
    for (const t of rec.tiles) this.apply(t);
  }

  detach(built: BuiltCell): void {
    for (const rec of this.cells) {
      if (rec.built !== built) continue;
      rec.disposed = true;
      for (const t of rec.tiles) this.release(t);
      this.cells.delete(rec);
    }
  }

  // ---------------------------------------------------------------- 毎フレーム

  /** 近い区切りを作り、遠い区切りを捨てる（ClientGame の描画の前に毎フレーム） */
  update(): void {
    if (!this.enabled || !this.cells.size) return;
    const lod = lodOf(this.tier);
    this.camera.getWorldPosition(this.cam);
    const now = performance.now();
    let best: Tile | null = null, bestLevel: Level = 1, bestScore = Infinity;
    for (const c of this.cells) {
      const m = c.props.root.matrixWorld;
      const visible = c.built.group.visible;
      for (const t of c.tiles) {
        if (t.failed || t.building) continue;
        const d = Math.max(0, this.tmp.copy(t.center).applyMatrix4(m).distanceTo(this.cam) - t.radius);
        if (t.level !== null && d > lod.far) t.farSince ??= now; else t.farSince = null;
        if (t.level !== null && t.farSince !== null && now - t.farSince > FAR_HOLD) { this.release(t); this.dropped++; continue; }
        // 欲しい段: 近ければ細かく（細かいのは少し離れるまで保つ）、near より近ければ粗く（作ってあれば far まで粗く保つ）
        const want: Level | null = d < (t.level === 0 ? lod.fineKeep : lod.fine) ? 0 : t.level !== null || d < lod.near ? 1 : null;
        if (want === null || want === t.level) continue;
        // 見えている区画・まだ何も無い区切りを先に（細かくし直すのは後）
        const score = d + (t.level === null ? 0 : 20) + (visible ? 0 : 12);
        if (score < bestScore) { bestScore = score; best = t; bestLevel = want; }
      }
    }
    if (best && this.inFlight < 1) void this.build(best, bestLevel);
  }

  private async build(tile: Tile, level: Level): Promise<void> {
    const c = tile.cell;
    const lod = lodOf(this.tier);
    const my = ++tile.gen;
    tile.building = true;
    this.inFlight++;
    try {
      const res = await this.worker.run(tile.items.map((it) => ({ spec: it.spec, scale: lod.detail * (level === 0 ? 1 : BULK.has(it.label) ? lod.bulk : lod.other) })), lod.tex);
      this.failedItems += res.failed;
      if (res.error) throw new Error(res.error);
      if (c.disposed || my !== tile.gen || !this.enabled) return;
      if (!res.data) { tile.failed = true; return; }
      const L = c.props.lighting();
      const meshes = await buildPropMeshes(res.data, {
        materials: this.materials, anisotropy: this.anisotropy(), lighting: L.on,
        offs: c.built.lamps.length ? L.offs : null, overrides: c.props.overrides,
        name: `props:${c.built.id}@${tile.key}`, pause: makePause(4),
      });
      if (c.disposed || my !== tile.gen || !this.enabled) { disposePropMeshes(meshes.group); return; }
      await this.upload(meshes, c.built.group.visible);
      if (c.disposed || my !== tile.gen || !this.enabled) { disposePropMeshes(meshes.group); return; }
      // 前の段の物と入れ替える（作り終わるまで前の物を出しておく）
      this.dropMeshes(tile);
      c.props.root.add(meshes.group);
      c.built.blend.push(...meshes.blend);
      tile.meshes = meshes;
      tile.triangles = res.data.triangles;
      tile.bytes = res.data.bytes;
      if (tile.level === null) for (const it of tile.items) this.labels.set(it.label, (this.labels.get(it.label) ?? 0) + 1);
      tile.level = level;
      this.apply(tile);
    } catch (e) {
      console.warn('[props] 区切りを作れなかった', c.built.id, tile.key, e);
      tile.failed = true;
    } finally {
      tile.building = false;
      this.inFlight--;
    }
  }

  /** テクスチャを先行アップロードの待ち行列で載せ、シェーダを用意する（試験では飛ばす） */
  private async upload(m: PropMeshes, visible: boolean): Promise<void> {
    const r = this.renderer;
    if (!r) return;
    const priority = visible ? 0 : 1;
    for (const t of m.textures) this.materials.uploads.enqueue(t, { big: true, priority });
    await new Promise<void>((resolve) => { this.materials.uploads.enqueue(null, { big: false, priority, run: resolve }); });
    if (this.scene) {
      m.group.visible = true;
      try { await r.compileAsync(m.group, this.camera, this.scene); } catch { /* 描くときに作られる */ }
    }
  }

  private anisotropy(): number {
    const max = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
    return Math.min(max, this.tier.id === 'high' ? 8 : this.tier.id === 'mid' ? 4 : 1);
  }

  private dropMeshes(t: Tile): void {
    const m = t.meshes;
    if (!m) return;
    const blend = t.cell.built.blend;
    for (const b of m.blend) { const i = blend.indexOf(b as BlendMesh); if (i >= 0) blend.splice(i, 1); }
    disposePropMeshes(m.group);
    t.meshes = null;
  }

  /** 区切りの作った物を捨てる（箱に戻す） */
  private release(t: Tile): void {
    t.gen++;
    if (t.level !== null) for (const it of t.items) this.labels.set(it.label, (this.labels.get(it.label) ?? 1) - 1);
    this.dropMeshes(t);
    t.level = null;
    t.farSince = null;
    t.triangles = 0;
    t.bytes = 0;
    this.apply(t);
  }

  private apply(t: Tile): void {
    const on = this.enabled && t.level !== null && !!t.meshes;
    const p = t.cell.props;
    for (const m of p.placeholders.get(t.key) ?? []) m.visible = !on;
    for (const m of p.adds.get(t.key) ?? []) m.visible = on;
    if (t.meshes) t.meshes.group.visible = on;
  }

  // ---------------------------------------------------------------- 持てる物

  /**
   * 持てる物の形（kind・半分の大きさ・色ごとに 1 回作る。焼き込み光は一定の値で、使う側が relightMeshes で当て直す）。
   * 写しは propMeshes.ts の instanceOf。形の関数が無い kind は null
   */
  carryTemplate(parts: { spec: PropSpec; name?: string }[], key: string): Promise<THREE.Object3D | null> {
    let p = this.templates.get(key);
    if (p) return p;
    p = (async () => {
      const root = new THREE.Group();
      root.name = `carry:${key}`;
      // 部分ごとに別の物（バケツの水面のように、名前で探して動かす物があるので）
      for (const part of parts) {
        const res = await this.worker.run([{ spec: part.spec, scale: 1 }]);
        if (!res.data) continue;
        const m = await buildPropMeshes(res.data, { materials: this.materials, anisotropy: this.anisotropy(), lighting: null, name: part.name ?? `carry:${key}`, pause: makePause(4) });
        await this.upload(m, true);
        if (part.name) m.group.name = part.name;
        root.add(m.group);
      }
      return root.children.length ? root : null;
    })().catch((e) => { console.warn('[props] 持てる物を作れなかった', key, e); return null; });
    this.templates.set(key, p);
    return p;
  }

  // ---------------------------------------------------------------- 数

  stats(): PropStats {
    let tiles = 0, ready = 0, fine = 0, items = 0, triangles = 0, bytes = 0, building = 0, failed = 0;
    for (const c of this.cells) for (const t of c.tiles) {
      tiles++;
      if (t.building) building++;
      if (t.failed) failed++;
      if (t.level === null) continue;
      ready++;
      if (t.level === 0) fine++;
      items += t.items.length;
      triangles += t.triangles;
      bytes += t.bytes;
    }
    return { cells: this.cells.size, tiles, ready, fine, items, triangles, bytes, building, failed: failed + this.failedItems, dropped: this.dropped, labels: new Map([...this.labels].filter(([, n]) => n > 0)) };
  }

  dispose(): void {
    for (const c of this.cells) { c.disposed = true; for (const t of c.tiles) this.release(t); }
    this.cells.clear();
    for (const p of this.templates.values()) void p.then((g) => g?.children.forEach((c) => disposePropMeshes(c)));
    this.templates.clear();
    this.worker.dispose();
  }
}
