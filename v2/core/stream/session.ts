/**
 * 果てしない階を渡り歩く（docs/endless-world.md 3.2・5.2）: 今の階（StoryWorld）と、階段室の向こうの階を持つ。
 *
 * - 下りの階段室の扉に world.prepare.airlockM まで近づいたら、向こうの階（下の階の同じ升目の区域から）を作っておく
 * - 階段室の入れ替えの頼み（StoryWorld.transfers）が来たら、プレイヤーを向こうの写しの同じ所へ移し（局所の座標で同じ位置・向き・速さ）、
 *   今の階と向こうの階を入れ替える。前の階は同じ階段室の向こうとして残す（すぐ戻っても作り直さない）
 * - 遠くなった向こうの階は捨てる
 * - 隠しの穴（13 章）: 穴に world.hole.prepareM まで近づいたら、行き先の階の着く部屋の区域を作っておく。落ちる途中（穴の床から
 *   world.hole.transferM）で、着く部屋の天井の上の縦穴の同じ所へ移す（速さはそのまま。どちらも暗い縦穴なので見た目は変わらない）。
 *   まだ用意できなければ、暗い縦穴の中で落ち続けさせる（world.hole.holdSec まで。それでも駄目なら底の出口で暗転して移る）
 * 階を移ったことは changes に出す（描画が場面を入れ替え、カメラを同じだけずらす）
 */
import type { Tuning } from '../config/tuning.ts';
import { rotQ, type Dir, type Vec3 } from '../math/vec.ts';
import type { PhysicsWorld } from '../physics/world.ts';
import type { PlayerState } from '../sim/types.ts';
import type { FloorExit, RegionAirlockCell } from '../world/layout.ts';
import { downSlot, landingId, landingSlot, parseAirlockId, storyId, WorldPlanner, type StoryKey } from '../gen/world/plan.ts';
import { StoryWorld, type RegionSource, type StoryOptions, type TransferRequest } from './story.ts';

export interface SessionOptions {
  tuning: Tuning;
  source: RegionSource;
  /** 階ごとの物理（階を作るたびに呼ぶ。捨てた階の物理は dispose する） */
  physics(): PhysicsWorld;
  playerIds?: string[];
  /** 向こうの階を見せられるか（描画が作り終えたか）。無ければ作れていればよい */
  ready?: (world: StoryWorld) => boolean;
  /** 階を作ったとき（描画が区域の見せられるかを入れる） */
  created?: (world: StoryWorld) => void;
  /** 区域を入れた直後・外す直前（StoryOptions と同じ） */
  regionAdded?: StoryOptions['regionAdded'];
  regionRemoving?: StoryOptions['regionRemoving'];
}

export interface StoryChange {
  from: StoryKey;
  to: StoryKey;
  airlock: string;
  /** 局所の座標で同じ所へ移した（見た目は変わらない） */
  seamless: boolean;
  player: number;
  /** 移した量（前の位置 → 新しい位置）と向きの差 */
  dx: number; dy: number; dz: number; dYaw: number;
}

type Anchor = RegionAirlockCell['anchor'];

const inv = (q: Dir): Dir => ((4 - q) % 4) as Dir;
const sub = (a: readonly number[], b: readonly number[]): Vec3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];

/** 写し A の点 → 写し B の同じ所 */
export function mapPoint(p: readonly number[], A: Anchor, B: Anchor): Vec3 {
  const l = rotQ(sub(p, A.offset), inv(A.q));
  const r = rotQ(l, B.q);
  return [r[0] + B.offset[0], r[1] + B.offset[1], r[2] + B.offset[2]];
}

/** 写し A の向き → 写し B の向き（1/4 回転ごとに yaw が π/2 増える） */
export const mapYaw = (yaw: number, A: Anchor, B: Anchor): number => yaw + (((B.q - A.q + 4) % 4) * Math.PI) / 2;

/** プレイヤーの状態を、別の階の Sim のプレイヤーへ写す（持ち物・乗り物・立つ面は外す） */
export function transferPlayer(from: PlayerState, to: PlayerState, A: Anchor, B: Anchor): void {
  const keepId = to.id;
  Object.assign(to, JSON.parse(JSON.stringify(from)) as PlayerState);
  to.id = keepId;
  to.pos = mapPoint(from.pos, A, B);
  const v = rotQ(rotQ([...from.vel] as Vec3, inv(A.q)), B.q);
  to.vel = v;
  to.yaw = mapYaw(from.yaw, A, B);
  to.lastGround = [...to.pos];
  to.respawn = { pos: [...to.pos], yaw: to.yaw };
  to.holding = null;
  to.ride = null;
  to.surfaceId = null;
  to.interactedId = null;
  to.grav = null;
  to.climbing = false;
  to.swimming = false;
  to.mantle = null;
}

export class WorldSession {
  active: StoryWorld;
  readonly t: Tuning;
  readonly planner: WorldPlanner;
  private readonly opts: SessionOptions;
  /** 階段室の id → その向こうの階 */
  private readonly beyond = new Map<string, StoryWorld>();
  private changes: StoryChange[] = [];

  /** 深さ depth の階から始める（超ブロック (0, 0) の、上から着く階段室の上の踊り場） */
  constructor(world: number, depth: number, opts: SessionOptions) {
    this.opts = opts;
    this.t = opts.tuning;
    this.planner = new WorldPlanner(opts.tuning);
    const story: StoryKey = { world, depth, variant: 0 };
    const [cx, cz] = downSlot(world, depth - 1, 0, 0);
    this.active = new StoryWorld(story, this.planner.at(story, cx, cz), this.storyOpts());
    opts.created?.(this.active);
  }

  private storyOpts(): ConstructorParameters<typeof StoryWorld>[2] {
    return {
      tuning: this.t, source: this.opts.source, physics: this.opts.physics(), planner: this.planner, ...(this.opts.playerIds ? { playerIds: this.opts.playerIds } : {}),
      ...(this.opts.regionAdded ? { regionAdded: this.opts.regionAdded } : {}), ...(this.opts.regionRemoving ? { regionRemoving: this.opts.regionRemoving } : {}),
    };
  }

  /** 階を移ったこと（取り出したら空になる） */
  drainChanges(): StoryChange[] {
    const c = this.changes;
    this.changes = [];
    return c;
  }

  /** 階段室の向こうの階（作ってあれば） */
  beyondOf(airlock: string): StoryWorld | null {
    return this.beyond.get(airlock) ?? null;
  }

  /** 作ってある向こうの階（全部。暗転して移る先も） */
  beyondWorlds(): StoryWorld[] {
    return [...this.beyond.values(), ...[...this.holes.values()].map((h) => h.w), ...(this.gotoWorld ? [this.gotoWorld.w] : [])];
  }

  /** 1 tick: 今の階を進め、区域の出し入れ・向こうの階の用意・入れ替え */
  step(cmds: Parameters<StoryWorld['sim']['step']>[0]): void {
    this.active.sim.step(cmds);
    this.active.update();
    this.prepare();
    this.prepareHoles();
    if (this.fallThroughHoles()) return;
    const reqs = this.active.transfers;
    this.active.transfers = [];
    for (const r of reqs) if (this.transfer(r)) break;
  }

  // ---------------------------------------------------------------- 隠しの穴（暗転しない）
  /** 穴の出口の id → 行き先の階（着く部屋の区域から作った）と着く部屋の id・縦穴に入った時刻 */
  private readonly holes = new Map<string, { w: StoryWorld; landing: string; since: number | null }>();

  /** 今の階の、縦穴のある隠しの穴 */
  private holeExits(): FloorExit[] {
    return this.active.regions.flatMap((r) => r.layout.exits.filter((x) => x.shaft && x.to));
  }

  /** 近くの隠しの穴の行き先を作っておく（同期で作れなければ次の tick にまた試す）。遠くなった行き先は捨てる */
  private prepareHoles(): void {
    const near = this.t['world.hole.prepareM'];
    const p = this.active.sim.players[0];
    if (!p) return;
    const keep = new Set<string>();
    for (const x of this.holeExits()) {
      const a = x.shaft!.anchor;
      const d = Math.hypot(p.pos[0] - a[0], p.pos[2] - a[2]);
      if (d > near * 2.5 && !this.holes.get(x.id)?.since) continue;
      keep.add(x.id);
      if (d > near || this.holes.has(x.id)) continue;
      const m = /^(-?\d+)\.(\d+)$/.exec(x.to!.floor);
      if (!m) continue;
      const to: StoryKey = { world: this.active.story.world, depth: Number(m[1]), variant: Number(m[2]) };
      const L2 = this.t['world.slotM'] * 2;
      const bx = Math.floor(a[0] / L2), bz = Math.floor(a[2] / L2);
      const [cx, cz] = landingSlot(to.world, to.depth, bx, bz);
      try {
        const plan = this.planner.at(to, cx, cz);
        const w = new StoryWorld(to, plan, this.storyOpts());
        const id = landingId(to.depth, bx, bz);
        const ld = w.regionInfo(plan.id)?.landings?.find((l) => l.id === id);
        if (!ld) { w.sim.physics?.dispose(); continue; }
        // 行き先の階のプレイヤーは着く部屋の床に置いておく（区域の読み込みが着く所のまわりになる）
        const fy = w.regionLayout(plan.id)?.cells.find((c) => c.id === ld.cell)?.floorY ?? 0;
        w.sim.teleport(0, [ld.anchor[0], fy + 0.05, ld.anchor[2]], 0);
        this.holes.set(x.id, { w, landing: id, since: null });
        this.opts.created?.(w);
      } catch {
        // 区域がまだ作れていない（作業の糸で作っている）: 次の tick にまた試す
      }
    }
    for (const [id, h] of this.holes) if (!keep.has(id)) { h.w.sim.physics?.dispose(); this.holes.delete(id); }
  }

  /** 縦穴を落ちている人を、行き先の階の着く部屋の縦穴へ移す。移したら true */
  private fallThroughHoles(): boolean {
    const p = this.active.sim.players[0];
    if (!p) return false;
    const half = this.t['world.hole.sizeM'] / 2 + 0.05;
    const tm = this.t['world.hole.transferM'];
    for (const x of this.holeExits()) {
      const a = x.shaft!.anchor;
      if (Math.abs(p.pos[0] - a[0]) > half || Math.abs(p.pos[2] - a[2]) > half) continue;
      const depth = a[1] - p.pos[1];
      if (depth < tm) continue;
      const h = this.holes.get(x.id);
      const now = this.active.sim.tick * this.active.sim.dt;
      if (h && h.since === null) h.since = now;
      const dest = h?.w ?? null;
      const ld = dest?.regions.flatMap((r) => r.layout.region?.landings ?? []).find((l) => l.id === h!.landing);
      // 移れる深さ: 着く部屋の縦穴の中（天井より上）に収まる所まで
      if (dest && ld && depth < this.t['world.hole.shaftM'] - 1 && (!this.opts.ready || this.opts.ready(dest))) {
        const to = dest.sim.players[0]!;
        const before = [...p.pos] as Vec3;
        transferPlayer(p, to, { offset: [...a] as Vec3, q: 0 }, { offset: [...ld.anchor] as Vec3, q: 0 });
        dest.transfers = [];
        const prev = this.active;
        this.holes.delete(x.id);
        this.active = dest;
        // 前の階には戻れない（落ちてきた）: 前の階・階段室の向こう・ほかの穴の行き先は捨てる
        prev.sim.physics?.dispose();
        for (const w of this.beyond.values()) w.sim.physics?.dispose();
        this.beyond.clear();
        for (const o of this.holes.values()) o.w.sim.physics?.dispose();
        this.holes.clear();
        this.changes.push({ from: prev.story, to: dest.story, airlock: `hole:${x.id}`, seamless: true, player: 0, dx: to.pos[0] - before[0], dy: to.pos[1] - before[1], dz: to.pos[2] - before[2], dYaw: 0 });
        return true;
      }
      // まだ用意できない: 暗い縦穴の中で落ち続ける（少し上へ戻す。まわりは真っ暗なので見た目は変わらない）
      if (depth > tm + 2.5 && h && now - (h.since ?? now) < this.t['world.hole.holdSec']) this.active.sim.warpPlayer(p, [p.pos[0], p.pos[1] + 2, p.pos[2]], p.yaw, true, 'hole');
      return false;
    }
    return false;
  }

  /** 近くの階段室の向こうの階を作っておく（同期で作れなければ次の tick にまた試す）。遠くなった向こうは捨てる */
  prepare(): void {
    const near = this.t['world.prepare.airlockM'];
    const keep = new Set<string>();
    for (const { layout } of this.active.regions) {
      for (const a of layout.region!.airlocks) {
        if (!a.to) continue;
        const d = Math.min(...this.active.sim.players.map((p) => Math.hypot(p.pos[0] - a.anchor.offset[0], p.pos[2] - a.anchor.offset[2])));
        if (d > near * 2.5) continue;
        keep.add(a.id);
        if (d <= near && !this.beyond.has(a.id)) this.open(a);
      }
    }
    for (const [id, w] of this.beyond) if (!keep.has(id)) { w.sim.physics?.dispose(); this.beyond.delete(id); }
  }

  /** 階段室 a の向こうの階を作る（向こうの写しのある区域から） */
  private open(a: RegionAirlockCell): StoryWorld | null {
    if (!a.to) return null;
    const p = parseAirlockId(a.id);
    if (!p) return null;
    const [d, v] = a.to.split('.').map(Number) as [number, number];
    const to: StoryKey = { world: this.active.story.world, depth: d, variant: v };
    // 階段室の升目: 上の深さ p.depth の超ブロックの下りの升目（上の階と下の階で同じ）
    const [cx, cz] = downSlot(to.world, p.depth, p.bx, p.bz);
    try {
      const w = new StoryWorld(to, this.planner.at(to, cx, cz), this.storyOpts());
      this.beyond.set(a.id, w);
      this.opts.created?.(w);
      return w;
    } catch {
      return null;
    }
  }

  /** 階段室の入れ替え。向こうの階が用意できていなければ false（扉の中で少し待つ） */
  private transfer(r: TransferRequest): boolean {
    const dest = this.beyond.get(r.airlock) ?? null;
    if (!dest || (this.opts.ready && !this.opts.ready(dest))) return false;
    const srcA = this.active.regionInfo(r.region)?.airlocks.find((x) => x.id === r.airlock);
    const dstA = dest.regions.flatMap((x) => x.layout.region!.airlocks).find((x) => x.id === r.airlock);
    if (!srcA || !dstA) return false;
    const from = this.active.sim.players[r.player]!, to = dest.sim.players[r.player]!;
    const before = [...from.pos] as Vec3, yaw0 = from.yaw;
    transferPlayer(from, to, srcA.anchor, dstA.anchor);
    // 向こうの階の扉の状態も、こちらと同じ（両方閉じている）。入れ替えの頼みがすぐ逆に出ないよう、向こうの頼みは捨て、
    // 向こうの入れ替えの範囲は、いったん出るまで効かない
    dest.transfers = [];
    dest.holdAirlocks(r.player);
    const prev = this.active;
    this.beyond.delete(r.airlock);
    this.beyond.set(r.airlock, prev);
    this.active = dest;
    this.changes.push({ from: prev.story, to: dest.story, airlock: r.airlock, seamless: true, player: r.player, dx: to.pos[0] - before[0], dy: to.pos[1] - before[1], dz: to.pos[2] - before[2], dYaw: to.yaw - yaw0 });
    return true;
  }

  // ---------------------------------------------------------------- 暗転して移る（穴・エレベーターの仕掛け・縦穴・迷路フロアの別の出口）
  private gotoWorld: { to: StoryKey; w: StoryWorld; land: { pos: Vec3; yaw: number } } | null = null;

  /**
   * 行き先の階 to の、点 (x, z) を持つ区域を作り始める（同期で作れなければ次に呼んだときにまた試す）。
   * 着く所は、その区域の部屋（隠し・階段室・別の空間を除く）のうち (x, z) にいちばん近い部屋の真ん中。作れたら true
   */
  prepareGoto(to: StoryKey, x: number, z: number): boolean {
    if (this.gotoWorld && storyId(this.gotoWorld.to) === storyId(to)) return true;
    const plan = this.planner.atPos(to, x, z);
    try {
      const w = new StoryWorld(to, plan, this.storyOpts());
      const L = w.regionLayout(plan.id)!;
      const sealed = new Set(L.region?.airlocks.map((a) => a.cell));
      const rooms = L.cells.filter((c) => c.role !== 'secret' && !c.pocket && !sealed.has(c.id) && c.role !== 'connector');
      const pick = (rooms.length ? rooms : L.cells).map((c) => ({ c, d: Math.hypot((c.bounds.min[0] + c.bounds.max[0]) / 2 - x, (c.bounds.min[2] + c.bounds.max[2]) / 2 - z) })).sort((a, b) => a.d - b.d)[0]!.c;
      // 部屋の床の空いた所（家具に埋まらない所）のうち、部屋の真ん中にいちばん近い所。そこへ上から少し落とす
      const cx = (pick.bounds.min[0] + pick.bounds.max[0]) / 2, cz = (pick.bounds.min[2] + pick.bounds.max[2]) / 2, y = pick.floorY;
      const spots: [number, number][] = [];
      for (const f of pick.footprint) for (let px = f.x0 + 0.6; px <= f.x1 - 0.6; px += 0.5) for (let pz = f.z0 + 0.6; pz <= f.z1 - 0.6; pz += 0.5) spots.push([px, pz]);
      spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
      const clear = (px: number, pz: number): boolean => [0.3, 0.9, 1.5].every((h) => [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].every(([ox, oz]) => !w.sim.colliders.pointBlocked(px + ox!, y + h, pz + oz!)));
      const at = spots.find(([px, pz]) => clear(px, pz)) ?? [cx, cz];
      const land = { pos: [at[0], y + 0.4, at[1]] as Vec3, yaw: 0 };
      w.sim.teleport(0, land.pos, land.yaw);
      this.gotoWorld = { to, w, land };
      this.opts.created?.(w);
      return true;
    } catch {
      return false;
    }
  }

  /** 暗転して移る先（作ってあれば） */
  get gotoTarget(): StoryWorld | null {
    return this.gotoWorld?.w ?? null;
  }

  /** 暗転の間に、作っておいた階へ移る（見せられなければ false）。前の階は捨てる */
  commitGoto(): boolean {
    const g = this.gotoWorld;
    if (!g || (this.opts.ready && !this.opts.ready(g.w))) return false;
    const prev = this.active;
    const from = prev.sim.players[0]!, to = g.w.sim.players[0]!;
    const keepPos = [...to.pos] as Vec3;
    Object.assign(to, JSON.parse(JSON.stringify(from)) as PlayerState);
    to.pos = keepPos; to.vel = [0, 0, 0]; to.yaw = g.land.yaw; to.pitch = 0; to.holding = null; to.ride = null; to.surfaceId = null; to.interactedId = null; to.grav = null;
    to.respawn = { pos: [...keepPos], yaw: g.land.yaw }; to.lastGround = [...keepPos];
    prev.sim.physics?.dispose();
    for (const w of this.beyond.values()) w.sim.physics?.dispose();
    this.beyond.clear();
    this.active = g.w;
    this.gotoWorld = null;
    this.changes.push({ from: prev.story, to: g.w.story, airlock: '', seamless: false, player: 0, dx: 0, dy: 0, dz: 0, dYaw: 0 });
    return true;
  }

  /** 開発用: 今の階の id */
  get storyId(): string {
    return storyId(this.active.story);
  }
}
