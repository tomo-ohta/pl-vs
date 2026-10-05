/**
 * v2 の世界の小物を、形の関数のメッシュに差し替える（world.html）。v2 のファイルは変えない。
 *
 * 1. v2 の FloorBuilder.buildCellJob をこのページの中でだけ包む。区画の箱から作り込む小物を見つけ（recognize.ts）、
 *    描画の写しでその箱に印（revealGroup `pp:<番号>`）を付けて別のメッシュにさせる（差し替え中は隠す。当たり判定は元のまま）。
 *    差し替え中だけ出す箱（流しの下を抜いた台）は `pq:<番号>`
 * 2. 区画の小物を 8 m の区切り（タイル）に分け、カメラに近い区切りから 1 つずつ、形の関数でメッシュ（三角形 + テクスチャ）を作り、
 *    v2 の材質と焼き込み照明で描く（作る前・作れなかった物は v2 の箱のまま）。
 *    近い区切り（NEAR_FINE より近い）は細かく、それより遠い区切りは棚の中身を粗く作り、FAR より遠くなったら捨てて v2 の箱に戻す
 * 3. P で 形の関数 ↔ v2 の箱 を切り替える
 */
import * as THREE from 'three';
import { FloorBuilder, type CellUnit } from '../../../../v2/client/world/FloorBuilder.ts';
import type { MaterialLibrary } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { Box, CellLayout } from '../../../../v2/core/world/layout.ts';
import { planCell, type PlanItem } from './recognize.ts';
import { detail, Rand, Surfels } from '../showroom/surfel.ts';
import { buildRoomMeshes, type RoomMeshes } from '../showroom/meshes.ts';
import { exhibitLighting, nextTask } from '../showroom/bake.ts';

export interface GameLike { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; materials: MaterialLibrary }
export type WorldMode = 'proc' | 'v2';

/** 区切りの大きさ（m） */
const TILE = 8;
/**
 * カメラから区切りの外形までの距離（m）。NEAR より近ければ作り、NEAR_FINE より近ければ細かく作り直し、FAR より遠くなったら捨てる。
 * v2 の霧は 8〜46 m（中の画質）で、25 m より先の小物はほとんど見えないので、そのあたりまで
 */
export const NEAR = 22, NEAR_FINE = 10, FAR = 32;
/** 細かく作った区切りを粗くし直すまでの距離（行き来でちらつかないように少し離す） */
const FINE_KEEP = 14;
/** FAR より遠い状態がこの時間（ms）続いたら捨てる */
const FAR_HOLD = 1500;
/** 棚の中身のように同じ物がたくさん並ぶ種類 */
const BULK = new Set(['books', 'goods']);
/** 細かさの段（0: 近い、1: 遠い）ごとの粗さの倍率 */
const LEVELS = [{ bulk: 1, other: 1 }, { bulk: 2, other: 1.3 }] as const;
type Level = 0 | 1;

interface CellRec {
  unit: CellUnit;
  cell: CellLayout;
  copy: CellLayout;
  neighbors: CellLayout[];
  plan: PlanItem[];
  tiles: Tile[];
  lighting: ReturnType<typeof exhibitLighting> | null;
  disposed: boolean;
}

interface Tile {
  id: string;
  cell: CellRec;
  plan: PlanItem[];
  /** 区切りの小物の外形（フロアの座標） */
  bounds: THREE.Box3;
  hideMeshes: THREE.Mesh[];
  addMeshes: THREE.Mesh[];
  /** 作ってある細かさの段（null は未だ・捨てた） */
  level: Level | null;
  building: boolean;
  holder: THREE.Object3D | null;
  meshes: RoomMeshes | null;
  counted: boolean;
  ms: number;
  /** FAR より遠くなった時刻（近ければ null） */
  farSince: number | null;
}

export class ProceduralProps {
  mode: WorldMode = 'proc';
  readonly cells = new Set<CellRec>();
  private game: GameLike | null = null;
  private busy = false;
  fps = 0;
  /** 作った小物の数（種類ごと。今出している区切りの分） */
  readonly counts = new Map<string, number>();
  failures = 0;
  /** 遠くなって捨てた区切りの数 */
  dropped = 0;
  /** 捨てた区切りと距離（開発用。直近 50） */
  readonly dropLog: string[] = [];
  onChange: (() => void) | null = null;

  /** FloorBuilder を包む（ゲームを作る前に呼ぶ） */
  install(): void {
    const proto = FloorBuilder.prototype as unknown as { buildCellJob: (this: FloorBuilder, seed: number, cell: CellLayout, neighbors: CellLayout[]) => Generator<void, CellUnit, void> };
    const original = proto.buildCellJob;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const mgr = this;
    proto.buildCellJob = function* (seed, cell, neighbors) {
      let plan: PlanItem[] = [];
      try { plan = planCell(cell); } catch (e) { console.warn('[procedural] 見つけられなかった', cell.id, e); }
      if (!plan.length) return yield* original.call(this, seed, cell, neighbors);
      const tag = new Map<Box, string>();
      plan.forEach((it, i) => { for (const b of it.hide) tag.set(b, `pp:${i}`); });
      const extra = plan.flatMap((it, i) => it.add.map((b) => ({ ...b, revealGroup: `pq:${i}` })));
      const copy: CellLayout = { ...cell, boxes: [...cell.boxes.map((b) => { const g = tag.get(b); return g ? { ...b, revealGroup: g } : b; }), ...extra] };
      const unit = yield* original.call(this, seed, copy, neighbors);
      unit.built.layout = cell;
      mgr.register(unit, cell, copy, neighbors, plan);
      return unit;
    };
  }

  attach(game: GameLike): void {
    this.game = game;
    let last = 0;
    const loop = (now: number): void => {
      requestAnimationFrame(loop);
      if (last) { const dt = now - last; if (dt > 0 && dt < 1000) this.fps = this.fps ? this.fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt; }
      last = now;
      this.frame();
    };
    requestAnimationFrame(loop);
  }

  setMode(m: WorldMode): void {
    this.mode = m;
    for (const c of this.cells) for (const t of c.tiles) this.apply(t);
    this.onChange?.();
  }

  totals(): { cells: number; tiles: number; ready: number; fine: number; items: number; triangles: number; bytes: number; building: string | null } {
    let tiles = 0, ready = 0, fine = 0, items = 0, triangles = 0, bytes = 0;
    let building: string | null = null;
    for (const c of this.cells) {
      for (const t of c.tiles) {
        tiles++;
        if (t.building) building = t.id;
        if (t.level === null) continue;
        ready++;
        if (t.level === 0) fine++;
        items += t.plan.length;
        triangles += t.meshes?.triangles ?? 0;
        bytes += t.meshes?.bytes ?? 0;
      }
    }
    return { cells: this.cells.size, tiles, ready, fine, items, triangles, bytes, building };
  }

  private register(unit: CellUnit, cell: CellLayout, copy: CellLayout, neighbors: CellLayout[], plan: PlanItem[]): void {
    const hide = new Map<number, THREE.Mesh[]>(), add = new Map<number, THREE.Mesh[]>();
    for (const [key, list] of [...unit.built.reveal]) {
      const m = /^p([pq]):(\d+)$/.exec(key);
      if (!m) continue;
      (m[1] === 'p' ? hide : add).set(Number(m[2]), list);
      unit.built.reveal.delete(key);
    }
    const c: CellRec = { unit, cell, copy, neighbors, plan, tiles: [], lighting: null, disposed: false };
    // 小物の外形の中心で 8 m の区切りに分ける
    const byKey = new Map<string, Tile>();
    plan.forEach((it, i) => {
      const box = new THREE.Box3();
      for (const b of [...it.hide, ...it.add]) box.union(new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)));
      if (box.isEmpty()) return;
      const ctr = box.getCenter(new THREE.Vector3());
      const key = `${Math.floor(ctr.x / TILE)},${Math.floor(ctr.z / TILE)}`;
      let t = byKey.get(key);
      if (!t) byKey.set(key, t = { id: `${cell.id}@${key}`, cell: c, plan: [], bounds: new THREE.Box3(), hideMeshes: [], addMeshes: [], level: null, building: false, holder: null, meshes: null, counted: false, ms: 0, farSince: null });
      t.plan.push(it);
      t.bounds.union(box);
      t.hideMeshes.push(...(hide.get(i) ?? []));
      t.addMeshes.push(...(add.get(i) ?? []));
    });
    c.tiles = [...byKey.values()];
    this.cells.add(c);
    for (const t of c.tiles) this.apply(t);
    const dispose = unit.dispose;
    unit.dispose = () => {
      c.disposed = true;
      for (const t of c.tiles) this.release(t);
      c.lighting = null;
      this.cells.delete(c);
      dispose();
      this.onChange?.();
    };
    this.onChange?.();
  }

  /** 区切りの作った物を捨てる（v2 の箱に戻す） */
  private release(t: Tile): void {
    if (t.counted) { for (const it of t.plan) this.counts.set(it.label, (this.counts.get(it.label) ?? 1) - 1); t.counted = false; }
    disposeHolder(t.holder);
    t.holder = null;
    t.meshes = null;
    t.level = null;
    this.apply(t);
  }

  private apply(t: Tile): void {
    const on = this.mode === 'proc' && t.level !== null;
    for (const m of t.hideMeshes) m.visible = !on;
    for (const m of t.addMeshes) m.visible = on;
    if (t.holder) t.holder.visible = on;
  }

  /** カメラから区切りの外形まで（区画が scene に入っていなければ ∞） */
  private distanceTo(t: Tile, cam: THREE.Vector3): number {
    const parent = t.cell.unit.built.group.parent;
    if (!parent) return Infinity;
    return t.bounds.clone().applyMatrix4(parent.matrixWorld).distanceToPoint(cam);
  }

  private frame(): void {
    const g = this.game;
    if (!g) return;
    const cam = g.camera.getWorldPosition(new THREE.Vector3());
    const now = performance.now();
    let best: Tile | null = null, bestLevel: Level = 1, bestScore = Infinity;
    for (const c of this.cells) {
      for (const t of c.tiles) {
        if (t.building || !t.plan.length) continue;
        const d = this.distanceTo(t, cam);
        // 遠い状態が FAR_HOLD（ms）続いたら捨てる（階の入れ替えなどで一瞬だけ遠く測れることがあるので）
        if (t.level !== null && d > FAR) t.farSince ??= now; else t.farSince = null;
        if (t.level !== null && t.farSince !== null && now - t.farSince > FAR_HOLD) { t.farSince = null; this.release(t); this.dropped++; this.dropLog.push(`${t.id} ${d.toFixed(1)}`); if (this.dropLog.length > 50) this.dropLog.shift(); this.onChange?.(); continue; }
        // 欲しい段: 近ければ細かく（細かいのは少し離れるまで保つ）、NEAR より近ければ粗く、作ってあれば FAR までそのまま
        const want: Level | null = d < (t.level === 0 ? FINE_KEEP : NEAR_FINE) ? 0 : d < (t.level !== null ? Infinity : NEAR) ? 1 : null;
        if (want === null || want === t.level) continue;
        // まだ何も無い区切りを先に（細かくし直すのは後）
        const score = d + (t.level === null ? 0 : 20);
        if (score < bestScore) { bestScore = score; best = t; bestLevel = want; }
      }
    }
    if (!this.busy && best) void this.build(best, bestLevel);
  }

  private async build(tile: Tile, level: Level): Promise<void> {
    const g = this.game!;
    const c = tile.cell;
    this.busy = true;
    tile.building = true;
    this.onChange?.();
    const t0 = performance.now();
    try {
      const S = new Surfels();
      S.patches = [];
      S.noSplats = true;
      const ranges = new Map<string, [number, number]>();
      const base = detail.spacingScale;
      const L = LEVELS[level];
      let t = performance.now();
      for (let i = 0; i < tile.plan.length; i++) {
        const it = tile.plan[i]!;
        const from = S.patches.length;
        detail.spacingScale = base * (BULK.has(it.label) ? L.bulk : L.other);
        try { it.gen(S, new Rand(it.seed)); } catch (e) { this.failures++; console.warn('[procedural] 作れなかった', tile.id, it.label, e); S.patches.length = from; }
        finally { detail.spacingScale = base; }
        ranges.set(String(i), [from, S.patches.length]);
        if (performance.now() - t > 8) { await nextTask(); t = performance.now(); if (c.disposed) return; }
      }
      c.lighting ??= exhibitLighting(c.copy, c.neighbors);
      const meshes = await buildRoomMeshes(S.patches, ranges, c.lighting, g.materials, g.renderer, `procedural:${tile.id}`);
      if (c.disposed) { disposeHolder(meshes.group); return; }
      // 形はフロアの座標。区画の入れ物（区画の床の高さ・階段室の写し方）の逆を掛けて入れる
      const group = c.unit.built.group;
      group.updateMatrix();
      const holder = new THREE.Group();
      holder.name = `procedural:${tile.id}`;
      holder.matrixAutoUpdate = false;
      holder.matrix.copy(group.matrix).invert();
      holder.add(meshes.group);
      group.add(holder);
      // 前の段の物と入れ替える（作り終わるまで前の物を出しておく）
      disposeHolder(tile.holder);
      tile.holder = holder;
      tile.meshes = meshes;
      tile.level = level;
      tile.ms = performance.now() - t0;
      if (!tile.counted) { for (const it of tile.plan) this.counts.set(it.label, (this.counts.get(it.label) ?? 0) + 1); tile.counted = true; }
      if (tile.ms > 150) console.info(`[procedural] ${tile.id}（${level === 0 ? '細かく' : '粗く'}）: 小物 ${tile.plan.length}・三角形 ${meshes.triangles.toLocaleString()}・${(meshes.bytes / 1048576).toFixed(1)} MB・${tile.ms.toFixed(0)} ms`);
    } catch (e) {
      console.error('[procedural] 区切りを作れなかった', tile.id, e);
      this.failures += tile.plan.length;
      // 作れなかった区切りは二度と作らない（v2 の箱のまま）
      if (tile.level === null) tile.plan = [];
    } finally {
      tile.building = false;
      this.busy = false;
      this.apply(tile);
      this.onChange?.();
    }
  }
}

/** 作った物（メッシュ・材質・テクスチャ）を捨てる */
function disposeHolder(root: THREE.Object3D | null): void {
  if (!root) return;
  root.removeFromParent();
  const pages = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    for (const tx of [mat.map, mat.roughnessMap, mat.emissiveMap]) if (tx) pages.add(tx);
    m.geometry.dispose();
    mat.dispose();
  });
  for (const tx of pages) tx.dispose();
}
