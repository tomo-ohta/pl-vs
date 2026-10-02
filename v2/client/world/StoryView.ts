/**
 * 1 つの階の描画（docs/endless-world.md 5.3）: 区域ごとに区画を作り、部品の描画を作り、シェーダを作ってから見せる。
 *
 * - 区域を足す（addRegion）と、区画を 1 つずつ作る待ち行列に入る（pump に渡した時間だけ、毎フレーム少しずつ）
 * - 区画を全部作ったら部品の描画を作り、区域の入れ物ごとシェーダを作る（compileAsync）。終わったら見せてよい（ready）
 * - 区域を外す（removeRegion）と、部品の描画と区画を捨てる（素材の部屋ごとの写しは参照の数で外す）
 * - 境目の扉（世界の部品）の描画は、階（StoryWorld）の扉に合わせて足し・外す
 * フロア（フロア単位の生成）は 1 つの区域 '' として、全部を作ってから使う（fromFloor）
 */
import * as THREE from 'three';
import type { Sim } from '../../core/sim/sim.ts';
import type { SimEvent } from '../../core/sim/types.ts';
import type { StoryWorld } from '../../core/stream/story.ts';
import { regionOfId } from '../../core/gen/world/namespace.ts';
import type { CellLayout, EntitySpec, FloorLayout } from '../../core/world/layout.ts';
import { createView, type EntityView, type ViewContext } from '../views/index.ts';
import { openNeighbors, type BuiltFloor, type CellUnit, type FloorBuilder } from './FloorBuilder.ts';
import { Visibility } from './Visibility.ts';

export interface StoryViewEnv {
  builder: FloorBuilder;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** 部品の描画の入れ物（描画の root・区域の built・区域の floor を見る Sim・イベントの受け取り）から ViewContext を作る */
  viewContext(root: THREE.Group, built: BuiltFloor, sim: Sim, onEvent: NonNullable<ViewContext['onEvent']>): ViewContext;
}

interface RegionState {
  id: string;
  layout: FloorLayout;
  root: THREE.Group;
  units: CellUnit[];
  pending: CellLayout[];
  /** 作りかけの区画（少し作るたびに止まる） */
  job: Generator<void, CellUnit, void> | null;
  /** 部品の描画を作り終えた数 */
  viewAt: number;
  neighbors: Map<string, CellLayout[]>;
  views: Map<string, EntityView>;
  viewRoots: Map<string, { root: THREE.Group; cells: string[] }>;
  state: 'build' | 'views' | 'compile' | 'ready';
}

/** 区域の layout を floor として見せる Sim（部品の描画の ctx.sim.floor が自分の区域になる） */
export function simFacade(sim: Sim, floor: FloorLayout): Sim {
  return new Proxy(sim, {
    get(target, k) {
      if (k === 'floor') return floor;
      const v = (target as unknown as Record<string | symbol, unknown>)[k];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

export class StoryView {
  readonly root = new THREE.Group();
  /** 全部の区域の区画と照明（区画は作った物だけ） */
  readonly built: BuiltFloor;
  readonly visibility = new Visibility();
  /** 部品の描画が受け取るイベント */
  readonly listeners = new Set<(e: SimEvent) => void>();
  private readonly regions = new Map<string, RegionState>();
  private readonly gateViews = new Map<string, { view: EntityView; root: THREE.Group; cells: string[] }>();
  private readonly env: StoryViewEnv;
  /** 果てしない階の階（フロアなら null） */
  readonly world: StoryWorld | null;
  private readonly simOf: () => Sim;

  constructor(env: StoryViewEnv, world: StoryWorld | null, sim: () => Sim, name: string) {
    this.env = env;
    this.world = world;
    this.simOf = sim;
    this.root.name = `story:${name}`;
    const base = sim().floor;
    this.built = { floor: base, root: this.root, cells: new Map(), lights: [], dispose: () => this.dispose() };
    this.visibility.ready = (cellId) => this.cellReady(cellId);
  }

  get sim(): Sim {
    return this.simOf();
  }

  /** 区画が描ける（区域が作り終わった）か */
  cellReady(cellId: string): boolean {
    const r = this.regions.get(regionOfId(cellId) ?? '');
    return !!r && r.state === 'ready';
  }

  /** 区域が作り終わったか */
  regionReady(id: string): boolean {
    return this.regions.get(id)?.state === 'ready';
  }

  /** 全部の区域が作り終わったか */
  allReady(): boolean {
    return [...this.regions.values()].every((r) => r.state === 'ready');
  }

  get pendingCount(): number {
    let n = 0;
    for (const r of this.regions.values()) if (r.state !== 'ready') n += r.pending.length + 1;
    return n;
  }

  addRegion(id: string, layout: FloorLayout): void {
    if (this.regions.has(id)) return;
    const root = new THREE.Group();
    root.name = `region:${id}`;
    this.root.add(root);
    this.regions.set(id, { id, layout, root, units: [], pending: [...layout.cells], job: null, viewAt: 0, neighbors: openNeighbors(layout), views: new Map(), viewRoots: new Map(), state: 'build' });
    this.visibility.addGroup(id, layout.cells, layout.portals);
  }

  removeRegion(id: string): void {
    const r = this.regions.get(id);
    if (!r) return;
    for (const v of r.views.values()) v.dispose();
    // 作りかけの区画は最後まで作ってから捨てる（途中の物を残さない）
    if (r.job) { for (;;) { const x = r.job.next(); if (x.done) { r.units.push(x.value); break; } } r.job = null; }
    for (const u of r.units) {
      this.built.cells.delete(u.built.id);
      u.dispose();
    }
    const gone = new Set(r.units.flatMap((u) => u.lights));
    this.built.lights = this.built.lights.filter((l) => !gone.has(l));
    r.root.removeFromParent();
    this.visibility.removeGroup(id);
    this.regions.delete(id);
  }

  /**
   * 作る（時間 budgetMs まで）。戻り値は使った時間。今いる区域（first）を先に
   */
  pump(budgetMs: number, first?: string): number {
    const t0 = performance.now();
    const order = [...this.regions.values()].sort((a, b) => Number(b.id === first) - Number(a.id === first));
    for (const r of order) {
      while (r.state === 'build' && performance.now() - t0 < budgetMs) {
        if (!r.job) {
          const cell = r.pending.shift();
          if (!cell) { r.state = 'views'; break; }
          r.job = this.env.builder.buildCellJob(r.layout.seed, cell, r.neighbors.get(cell.id) ?? []);
        }
        const x = r.job.next();
        if (!x.done) continue;
        r.job = null;
        const u = x.value;
        u.built.group.visible = false;
        r.root.add(u.built.group);
        r.units.push(u);
        this.built.cells.set(u.built.id, u.built);
        this.built.lights.push(...u.lights);
      }
      if (r.state === 'views' && performance.now() - t0 < budgetMs) {
        if (this.createViews(r, t0 + budgetMs)) { r.state = 'compile'; this.compile(r); }
      }
      if (performance.now() - t0 >= budgetMs) break;
    }
    return performance.now() - t0;
  }

  /** 全部を今すぐ作る（フロア・最初の区域） */
  buildAll(): void {
    for (const r of this.regions.values()) {
      while (r.state === 'build') this.pump(1e9);
      if (r.state === 'compile') r.state = 'ready';
    }
  }

  /** 部品の描画を作る（deadline の時刻まで。全部作り終えたら true） */
  private createViews(r: RegionState, deadline = Infinity): boolean {
    const built: BuiltFloor = { floor: r.layout, root: this.root, cells: this.built.cells, lights: this.built.lights, dispose: () => {} };
    const sim = simFacade(this.sim, r.layout);
    const list = r.layout.entities;
    for (; r.viewAt < list.length; r.viewAt++) {
      if (performance.now() > deadline) return false;
      const e = list[r.viewAt]!;
      const root = new THREE.Group();
      root.name = `entity:${e.id}`;
      r.root.add(root);
      const tv = performance.now();
      const v = createView(e, this.env.viewContext(root, built, sim, (f) => { this.listeners.add(f); return () => this.listeners.delete(f); }));
      const dv = performance.now() - tv;
      if (dv > 25) console.warn(`[描画] 部品の描画を作るのに ${dv.toFixed(0)} ms: ${e.type}（${e.id}）`);
      if (!v) { root.removeFromParent(); continue; }
      r.views.set(e.id, v);
      const portal = e.type === 'door' ? r.layout.portals.find((p) => p.doorId === e.id) : undefined;
      r.viewRoots.set(e.id, { root, cells: portal ? [...portal.cells] : e.cell ? [e.cell] : [] });
    }
    return true;
  }

  /** 区域の入れ物ごとシェーダを作る（隠したまま。作り終わったら ready） */
  private compile(r: RegionState): void {
    const saved: { o: THREE.Object3D; v: boolean }[] = [];
    r.root.traverse((o) => { saved.push({ o, v: o.visible }); o.visible = true; });
    let p: Promise<unknown>;
    try { p = this.env.renderer.compileAsync(r.root, this.env.camera, this.env.scene); } catch { p = Promise.resolve(); }
    for (const s of saved) s.o.visible = s.v;
    void p.catch(() => {}).then(() => { if (this.regions.get(r.id) === r) r.state = 'ready'; });
  }

  /** 境目の扉の描画を、階の扉に合わせる。区域をまたぐ開口も Visibility へ */
  syncGates(): void {
    const w = this.world;
    if (!w) return;
    const portals = w.portals;
    this.visibility.setExtra(portals);
    const doors = w.gateDoors();
    const want = new Set(doors.map((d) => d.id));
    for (const [id, g] of this.gateViews) if (!want.has(id)) { g.view.dispose(); g.root.removeFromParent(); this.gateViews.delete(id); }
    for (const d of doors) {
      const cells = portals.find((p) => p.doorId === d.id)?.cells ?? [d.cell];
      const have = this.gateViews.get(d.id);
      if (have) { have.cells = [...cells]; continue; }
      const spec = this.sim.entitySpec(d.id) as EntitySpec | null;
      if (!spec) continue;
      const root = new THREE.Group();
      root.name = `gate:${d.id}`;
      this.root.add(root);
      const v = createView(spec, this.env.viewContext(root, this.built, this.sim, (f) => { this.listeners.add(f); return () => this.listeners.delete(f); }));
      if (!v) { root.removeFromParent(); continue; }
      this.gateViews.set(d.id, { view: v, root, cells: [...cells] });
    }
  }

  /** 部品の描画を全部（描画・見えるか）。f が false を返したら隠す */
  forEachView(f: (id: string, v: EntityView, vr: { root: THREE.Group; cells: string[] }) => void): void {
    for (const r of this.regions.values()) {
      if (r.state !== 'ready') { for (const vr of r.viewRoots.values()) vr.root.visible = false; continue; }
      for (const [id, v] of r.views) f(id, v, r.viewRoots.get(id)!);
    }
    for (const [id, g] of this.gateViews) f(id, g.view, g);
  }

  /** 部品の描画の入れ物（窓・枠の向こうを描くときに見え方を替える） */
  *viewRootsAll(): Generator<{ root: THREE.Group; cells: string[] }> {
    for (const r of this.regions.values()) yield* r.viewRoots.values();
    for (const g of this.gateViews.values()) yield g;
  }

  dispose(): void {
    for (const id of [...this.regions.keys()]) this.removeRegion(id);
    for (const g of this.gateViews.values()) { g.view.dispose(); g.root.removeFromParent(); }
    this.gateViews.clear();
    this.listeners.clear();
    this.root.removeFromParent();
  }
}
