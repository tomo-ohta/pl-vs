/**
 * 果てしない階の 1 つの階（docs/endless-world.md 5.1・5.2）: Sim に、プレイヤーのまわりの区域だけを入れて進める。
 *
 * - 区域の計画は升目のハッシュだけで決まる（core/gen/world/plan.ts）。区域の layout は source から受け取る
 *   （試験・Node は同期で作る syncSource。クライアントは裏で作る）。受け取った layout は id を付け替えた物
 * - 読む: プレイヤーのいる区域・境目の扉から world.load.gateM 以内の向こうの区域
 * - 外す: プレイヤーのいる区域でなく、区域の矩形から world.unload.gateM より遠い区域（持っている物があれば外さない）。
 *   world.maxRegions を超えたら遠い順に
 * - 境目の扉: 扉の部品は世界が持つ（Sim の '@world'）。片側だけ読まれている間は錠がかかり、両側そろうと開けられる。
 *   両側がそろった扉の portal（区域をまたぐ）を portals に出す（描画が向こうを描くかを決めるのに使う）
 * - 階段室: 入れ替えの範囲（区域の exits の airlock）に入り、扉が両方閉じていたら transfers に頼みを出す（実際に移すのは session.ts）
 * update() は tick ごとに呼ぶ（Sim の step の後）。区域の出し入れは tick の間に行う
 */
import type { Tuning } from '../config/tuning.ts';
import type { AABB } from '../math/aabb.ts';
import { hashAll } from '../math/rng.ts';
import type { Vec3 } from '../math/vec.ts';
import type { PhysicsWorld } from '../physics/world.ts';
import { doorPanel, portalAabb } from '../world/build.ts';
import { DOOR_H, DOOR_W, type EntitySpec, type FloorLayout, type PortalSpec, type RegionInfo } from '../world/layout.ts';
import { GEN_VERSION, type GenOptions } from '../gen/floor/index.ts';
import { tuningVersion } from '../config/tuning.ts';
import { namespaceLayout } from '../gen/world/namespace.ts';
import { storyId, WorldPlanner, type GateEnd, type RegionPlan, type StoryKey } from '../gen/world/plan.ts';
import { generateRegionReport } from '../gen/world/region.ts';
import { Sim } from '../sim/sim.ts';

/** 区域の layout の受け取り先（id を付け替えた物。まだ無ければ null） */
export interface RegionSource {
  get(plan: RegionPlan): FloorLayout | null;
}

/** 同期で作る（試験・Node）。作った物を cacheSize まで覚える */
export function syncSource(t: Tuning, opts: GenOptions = {}, cacheSize = 32): RegionSource {
  const cache = new Map<string, FloorLayout>();
  return {
    get(plan) {
      const key = `${storyId(plan.story)}:${plan.id}`;
      const hit = cache.get(key);
      if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
      const L = namespaceLayout(generateRegionReport(plan, t, opts).floor, plan.id);
      cache.set(key, L);
      while (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
      return L;
    },
  };
}

export interface StoryOptions {
  tuning: Tuning;
  source: RegionSource;
  /** 物理（区域に物理の部品が出るので、果てしない階では必ず渡す） */
  physics: PhysicsWorld;
  planner?: WorldPlanner;
  playerIds?: string[];
  /**
   * 区域を見せられるか（描画が区画を作り終えたか）。境目の扉は、両側の区域が読まれていて、両方見せられるときだけ錠を外す。
   * 無ければ読まれていればよい（試験・Node）
   */
  ready?: (regionId: string) => boolean;
  /** 区域を入れた直後・外す直前（置いた物の保存を戻す・書く。描画が入れる） */
  regionAdded?: (world: StoryWorld, id: string, layout: FloorLayout) => void;
  regionRemoving?: (world: StoryWorld, id: string, layout: FloorLayout) => void;
}

/** 階を移る頼み（階段室の入れ替えの範囲に入り、扉が両方閉じた） */
export interface TransferRequest { player: number; airlock: string; region: string; role: 'down' | 'up'; to: StoryKey }

interface GateLink { gate: GateEnd; sides: Map<string, string>; door: string; portal: PortalSpec | null }

const distRect = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number): number => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const gatePoint = (g: GateEnd): [number, number] => (g.side % 2 === 0 ? [g.at, g.line] : [g.line, g.at]);

/** 区域の空の土台（Sim の floor。区画は区域が持つ） */
function baseLayout(story: StoryKey, t: Tuning, spawn: { pos: Vec3; yaw: number; cell: string }): FloorLayout {
  return {
    id: storyId(story), seed: hashAll(story.world, 'story', story.depth, story.variant), genVersion: GEN_VERSION, tuningVersion: tuningVersion(t),
    bounds: { min: [spawn.pos[0] - 1, spawn.pos[1] - 20, spawn.pos[2] - 1], max: [spawn.pos[0] + 1, spawn.pos[1] + 4, spawn.pos[2] + 1] },
    cells: [], portals: [], entities: [], surfaces: [], spawn, exits: [], fog: { color: 0x0b0d14, near: 8, far: 46 },
  };
}

export class StoryWorld {
  readonly story: StoryKey;
  readonly sim: Sim;
  readonly planner: WorldPlanner;
  readonly t: Tuning;
  private readonly source: RegionSource;
  private readonly hooks: Pick<StoryOptions, 'regionAdded' | 'regionRemoving'>;
  /** 区域を見せられるか（StoryOptions.ready）。描画が後から入れてもよい */
  ready: ((regionId: string) => boolean) | null;
  private readonly loaded = new Map<string, { plan: RegionPlan; layout: FloorLayout }>();
  private readonly gates = new Map<string, GateLink>();
  /** 区域の出し入れ（描画が受け取る。取り出したら空になる） */
  private changes: { type: 'add' | 'remove'; id: string }[] = [];
  /** 階を移る頼み（session.ts が受け取る） */
  transfers: TransferRequest[] = [];
  private readonly lastRegion = new Map<number, string>();
  /**
   * 階段室の入れ替えの範囲（プレイヤー:階段室）: outside 外にいる / armed 外から入った（扉が閉じれば移る）/ blocked 最初から中にいた
   * （出てくる位置・移ってきた所）。外から入ったときだけ移す（入れ替えの範囲で始まって、すぐ移らないように）
   */
  private readonly zones = new Map<string, 'outside' | 'armed' | 'blocked'>();

  /**
   * start: 最初に入れる区域（同期で受け取れること）。spawn を渡さなければ、その区域の出てくる位置（上から着く階段室か、最初の境目の扉の内側）
   */
  constructor(story: StoryKey, start: RegionPlan, opts: StoryOptions, spawn?: { pos: Vec3; yaw: number }) {
    this.story = story;
    this.t = opts.tuning;
    this.source = opts.source;
    this.planner = opts.planner ?? new WorldPlanner(opts.tuning);
    this.ready = opts.ready ?? null;
    this.hooks = { ...(opts.regionAdded ? { regionAdded: opts.regionAdded } : {}), ...(opts.regionRemoving ? { regionRemoving: opts.regionRemoving } : {}) };
    const first = this.source.get(start);
    if (!first) throw new Error(`最初の区域を受け取れません: ${start.id}`);
    const sp = spawn ? { ...spawn, cell: '' } : first.spawn;
    this.sim = new Sim(baseLayout(story, this.t, { pos: [...sp.pos], yaw: sp.yaw, cell: sp.cell }), { tuning: this.t, physics: opts.physics, ...(opts.playerIds ? { playerIds: opts.playerIds } : {}) });
    this.add(start, first);
  }

  /** 入っている区域 */
  get regions(): { plan: RegionPlan; layout: FloorLayout }[] {
    return [...this.loaded.values()];
  }

  regionLayout(id: string): FloorLayout | null {
    return this.loaded.get(id)?.layout ?? null;
  }

  /** 両側の区域がそろった境目の扉の portal（区域をまたぐ） */
  get portals(): PortalSpec[] {
    return [...this.gates.values()].flatMap((g) => (g.portal ? [g.portal] : []));
  }

  /** 区域の出し入れを取り出す */
  drainChanges(): { type: 'add' | 'remove'; id: string }[] {
    const c = this.changes;
    this.changes = [];
    return c;
  }

  /** 点 (x, z) を持つ区域の計画 */
  planAt(x: number, z: number): RegionPlan {
    return this.planner.atPos(this.story, x, z);
  }

  /** 区域を今すぐ入れる（読み込みの方針によらない。同期で受け取れなければ false） */
  ensure(plan: RegionPlan): boolean {
    if (this.loaded.has(plan.id)) return true;
    const L = this.source.get(plan);
    if (!L) return false;
    this.add(plan, L);
    return true;
  }

  /** tick ごとに: 区域の出し入れ・境目の扉・階段室の入れ替えの頼み */
  update(): void {
    const t = this.t;
    const want = new Set<string>();
    const plans = new Map<string, RegionPlan>();
    this.sim.players.forEach((p, i) => {
      const cur = this.planAt(p.pos[0], p.pos[2]);
      want.add(cur.id);
      plans.set(cur.id, cur);
      // 区域が替わった: 落ちたときに戻る所を、新しい区域の入った所に
      const prev = this.lastRegion.get(i);
      if (prev !== cur.id) {
        this.lastRegion.set(i, cur.id);
        if (prev !== undefined && this.loaded.has(cur.id)) p.respawn = { pos: [...p.pos], yaw: p.yaw };
      }
      for (const g of cur.gates) {
        const [gx, gz] = gatePoint(g);
        if (Math.hypot(gx - p.pos[0], gz - p.pos[2]) > t['world.load.gateM']) continue;
        const o = this.planner.byId(this.story, g.other);
        want.add(o.id);
        plans.set(o.id, o);
      }
    });
    // 読む（受け取れた物だけ。受け取れなければ次の tick にまた頼む）
    for (const id of want) if (!this.loaded.has(id)) { const pl = plans.get(id)!; const L = this.source.get(pl); if (L) this.add(pl, L); }
    // 外す
    const far = (id: string): number => Math.min(...this.sim.players.map((p) => distRect(this.loaded.get(id)!.plan.rect, p.pos[0], p.pos[2])));
    const drop = [...this.loaded.keys()].filter((id) => !want.has(id) && far(id) > t['world.unload.gateM']);
    for (const id of drop) this.remove(id);
    if (this.loaded.size > t['world.maxRegions']) {
      const extra = [...this.loaded.keys()].filter((id) => !want.has(id)).sort((a, b) => far(b) - far(a));
      for (const id of extra.slice(0, this.loaded.size - t['world.maxRegions'])) this.remove(id);
    }
    // 錠: 区域を見せられるようになった扉を開ける
    if (this.ready) for (const g of this.gates.values()) if (g.sides.size >= 2 && this.sim.entitySpec(g.door)?.params.locked) this.refreshGate(g);
    this.checkAirlocks();
  }

  /** 境目の扉の部品（描画が扉を描く） */
  gateDoors(): { id: string; cell: string }[] {
    return [...this.gates.values()].map((g) => ({ id: g.door, cell: [...g.sides.values()][0]! }));
  }

  private add(plan: RegionPlan, layout: FloorLayout): void {
    this.sim.addRegion(layout);
    this.loaded.set(plan.id, { plan, layout });
    this.hooks.regionAdded?.(this, plan.id, layout);
    this.changes.push({ type: 'add', id: plan.id });
    for (const g of layout.region!.gates) this.attachGate(plan, g.id, g.cell);
  }

  private remove(id: string): void {
    const r = this.loaded.get(id);
    if (!r) return;
    this.hooks.regionRemoving?.(this, id, r.layout);
    if (!this.sim.removeRegion(id)) return;
    this.loaded.delete(id);
    this.changes.push({ type: 'remove', id });
    for (const g of r.layout.region!.gates) this.detachGate(id, g.id);
  }

  // ---------------------------------------------------------------- 境目の扉
  private attachGate(plan: RegionPlan, gateId: string, cell: string): void {
    const gate = plan.gates.find((x) => x.id === gateId)!;
    let link = this.gates.get(gateId);
    if (!link) {
      link = { gate, sides: new Map(), door: gateId, portal: null };
      this.gates.set(gateId, link);
      this.sim.addWorldEntity(gateDoor(gate, cell, this.story));
    }
    link.sides.set(plan.id, cell);
    this.refreshGate(link);
  }

  private detachGate(regionId: string, gateId: string): void {
    const link = this.gates.get(gateId);
    if (!link) return;
    link.sides.delete(regionId);
    if (!link.sides.size) { this.sim.removeWorldEntity(link.door); this.gates.delete(gateId); return; }
    this.refreshGate(link);
  }

  /** 両側そろえば錠を外し portal を出す。片側なら錠をかけ、扉の区画を残った側に */
  private refreshGate(link: GateLink): void {
    const spec = this.sim.entitySpec(link.door);
    if (!spec) return;
    const both = link.sides.size >= 2;
    const shown = !this.ready || [...link.sides.keys()].every((id) => this.ready!(id));
    spec.params.locked = !(both && shown);
    const cells = [...link.sides.entries()];
    spec.cell = cells[0]![1];
    if (both) {
      // portal の向きは cells[0] の区域から見た外向き（区域の矩形の辺のどちらに扉の線があるか）
      const [ra, ca] = cells[0]!, [, cb] = cells[1]!;
      const rect = this.loaded.get(ra)?.plan.rect;
      const g = link.gate;
      const axis: 'x' | 'z' = g.side % 2 === 0 ? 'z' : 'x';
      const out = rect ? (axis === 'z' ? (Math.abs(g.line - rect.z1) < 0.01 ? 0 : 2) : (Math.abs(g.line - rect.x1) < 0.01 ? 1 : 3)) : g.side;
      link.portal = { id: `p:${link.door}`, cells: [ca, cb], aabb: portalAabb(axis, g.line, g.at, DOOR_W, 0, DOOR_H), dir: out as PortalSpec['dir'], kind: 'door', doorId: link.door };
    } else link.portal = null;
  }

  // ---------------------------------------------------------------- 階段室
  private checkAirlocks(): void {
    this.sim.players.forEach((p, pi) => {
      for (const { plan, layout } of this.loaded.values()) {
        for (const a of layout.region!.airlocks) {
          if (!a.to) continue;
          const ex = layout.exits.find((x) => x.airlock === a.id);
          if (!ex) continue;
          const key = `${pi}:${a.id}`;
          const st = this.zones.get(key);
          const isIn = inside(ex.aabb, p.pos);
          if (!isIn) { this.zones.set(key, 'outside'); continue; }
          if (st === undefined || st === 'blocked') { this.zones.set(key, 'blocked'); continue; }
          if (st === 'outside') this.zones.set(key, 'armed');
          if (this.sim.outputOf(a.live, 'angle') > 0.01 || this.sim.outputOf(a.sealed, 'angle') > 0.01) continue;
          if (this.transfers.some((x) => x.player === pi && x.airlock === a.id)) continue;
          const [d, v] = a.to.split('.').map(Number) as [number, number];
          this.transfers.push({ player: pi, airlock: a.id, region: plan.id, role: a.role, to: { world: this.story.world, depth: d, variant: v } });
        }
      }
    });
  }

  /** 入れ替えの範囲の中にいても、いったん出るまで移さない（移ってきたとき・出てくるとき） */
  holdAirlocks(player: number): void {
    for (const k of this.zones.keys()) if (k.startsWith(`${player}:`)) this.zones.set(k, 'blocked');
    for (const { layout } of this.loaded.values()) for (const a of layout.region!.airlocks) this.zones.set(`${player}:${a.id}`, 'blocked');
  }

  /** 区域の情報（入っている区域から） */
  regionInfo(id: string): RegionInfo | null {
    return this.loaded.get(id)?.layout.region ?? null;
  }
}

const inside = (a: AABB, p: Vec3): boolean => p[0] >= a.min[0] && p[0] <= a.max[0] && p[1] + 0.1 >= a.min[1] && p[1] <= a.max[1] && p[2] >= a.min[2] && p[2] <= a.max[2];

/** 境目の扉の部品（世界が持つ）。材質は境目の id のハッシュ */
function gateDoor(g: GateEnd, cell: string, story: StoryKey): EntitySpec {
  const axis: 'x' | 'z' = g.side % 2 === 0 ? 'z' : 'x';
  const p = doorPanel(axis, g.line, g.at, DOOR_W, 0, DOOR_H);
  const h = hashAll(story.world, g.id);
  const mats = ['doorMetal', 'doorWood', 'doorWood', 'doorMetal', 'stainless'] as const;
  return {
    id: g.id, type: 'door', cell,
    params: { panel: { min: [...p.min], max: [...p.max] }, axis, mat: mats[h % mats.length]!, hinge: h & 1 ? 1 : -1, swing: h & 2 ? 1 : -1, locked: true },
  };
}
