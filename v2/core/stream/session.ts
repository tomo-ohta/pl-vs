/**
 * 果てしない階を渡り歩く（docs/endless-world.md 3.2・5.2・13・14 章）: 今の階（StoryWorld）と、移る先の階（others。階ごとに 1 つ）を持つ。
 *
 * - 移る先の階には、近くの移る所の行き先の区域だけを入れる（階段室・エレベーターの扉から world.prepare.airlockM、穴・落ちる所から
 *   world.hole.prepareM）。遠くなった区域は外し、要る区域が無くなった階は捨てる（階を 1 つ用意すれば、同じ階へのどの移る所にも使える）
 * - 階段室・エレベーターの入れ替えの頼み（StoryWorld.transfers）が来たら、プレイヤーを向こうの写しの同じ所へ移し（局所の座標で同じ位置・
 *   向き・速さ）、今の階と向こうの階を入れ替える。前の階は移る先の階として残る（近くにまた移る所があれば）
 * - 落ちる所（穴・崩れた床の下・縦穴。exits の shaft）: 縦穴の上（anchor）から world.hole.transferM 落ちたら、行き先の階の同じ升目の
 *   着く部屋の天井の上の縦穴へ移す（速さはそのまま。どちらも暗い縦穴なので見た目は変わらない）。まだ用意できなければ、暗い縦穴の中で
 *   落ち続けさせる（world.hole.holdSec まで。それでも駄目なら底の出口で暗転して移る）。沈む床に乗っていれば、着く部屋の床板も一緒に動かす
 * 階を移ったことは changes に出す（描画が場面を入れ替え、カメラを同じだけずらす）
 */
import type { Tuning } from '../config/tuning.ts';
import { rotQ, type Dir, type Vec3 } from '../math/vec.ts';
import type { PhysicsWorld } from '../physics/world.ts';
import type { PlayerState } from '../sim/types.ts';
import type { FloorExit, RegionAirlockCell } from '../world/layout.ts';
import { landingId, parseAirlockId, slotOf, START_SLOT, storyId, WorldPlanner, type RegionPlan, type StoryKey } from '../gen/world/plan.ts';
import { StoryWorld, type RegionSource, type StoryOptions, type TransferRequest } from './story.ts';
import { openSecretOf, spawnInCell } from './spawn.ts';
import { IDLE_COMMAND } from '../sim/types.ts';

export interface SessionOptions {
  tuning: Tuning;
  source: RegionSource;
  /** 階ごとの物理（階を作るたびに呼ぶ。捨てた階の物理は dispose する） */
  physics(): PhysicsWorld;
  playerIds?: string[];
  /** 向こうの階の区域を見せられるか（描画が作り終えたか）。無ければ作れていればよい */
  ready?: (world: StoryWorld, regionId: string) => boolean;
  /** 階を作ったとき（描画が区域の見せられるかを入れる） */
  created?: (world: StoryWorld) => void;
  /** 区域を入れた直後・外す直前（StoryOptions と同じ） */
  regionAdded?: StoryOptions['regionAdded'];
  regionRemoving?: StoryOptions['regionRemoving'];
  /** 始める部屋（ルーム ID で飛んだとき。docs/endless-world.md 15 章）: 階・区域（同期で受け取れること）・区画の id。無ければ始まりの升目の階段室の上 */
  start?: { story: StoryKey; plan: RegionPlan; cell: string };
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
  /** 移る先の階（'depth.variant' → 階） */
  private readonly others = new Map<string, StoryWorld>();
  private changes: StoryChange[] = [];

  /** 深さ depth の階から始める（始まりの升目の、上から着く階段室の上の踊り場）。opts.start があればその部屋の中から */
  constructor(world: number, depth: number, opts: SessionOptions) {
    this.opts = opts;
    this.t = opts.tuning;
    this.planner = new WorldPlanner(opts.tuning);
    const st = opts.start;
    const story: StoryKey = st ? st.story : { world, depth, variant: 0 };
    this.active = new StoryWorld(story, st ? st.plan : this.planner.at(story, START_SLOT[0], START_SLOT[1]), this.storyOpts());
    if (st) this.placeInRoom(st.plan.id, st.cell);
    opts.created?.(this.active);
  }

  /** プレイヤーを今の階の区域 regionId の区画 cellId の中へ出す（開口の内側の床の上。出現型の隠し場所なら入口を開ける） */
  private placeInRoom(regionId: string, cellId: string): void {
    const w = this.active, L = w.regionLayout(regionId);
    const c = L?.cells.find((x) => x.id === cellId);
    if (!L || !c) return;
    // 部品の当たり判定（床板・扉）は 1 tick 目に入る
    w.sim.step([{ ...IDLE_COMMAND }]);
    openSecretOf(w.sim, L, cellId);
    const at = spawnInCell(w.sim, c, [...L.portals, ...w.portals]);
    w.sim.teleport(0, at.pos, at.yaw);
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

  /** 移る先の階（作ってあれば） */
  otherStory(to: StoryKey | string): StoryWorld | null {
    return this.others.get(typeof to === 'string' ? to : storyId(to)) ?? null;
  }

  /** 作ってある移る先の階（全部。暗転して移る先も） */
  beyondWorlds(): StoryWorld[] {
    return [...this.others.values(), ...(this.gotoWorld && !this.others.has(storyId(this.gotoWorld.to)) ? [this.gotoWorld.w] : [])];
  }

  /** 1 tick: 今の階を進め、区域の出し入れ・移る先の用意・入れ替え */
  step(cmds: Parameters<StoryWorld['sim']['step']>[0]): void {
    this.active.sim.step(cmds);
    this.active.update();
    this.prepare();
    if (this.fallThrough()) return;
    const reqs = this.active.transfers;
    this.active.transfers = [];
    for (const r of reqs) if (this.transfer(r)) break;
  }

  private isReady(w: StoryWorld, regionId: string): boolean {
    return w.regionLayout(regionId) !== null && (!this.opts.ready || this.opts.ready(w, regionId));
  }

  /** 今の階の、落ちる所（縦穴のある出口） */
  private drops(): FloorExit[] {
    return this.active.regions.flatMap((r) => r.layout.exits.filter((x) => x.shaft && x.to));
  }

  /** 落ちる所の行き先: 階と、着く部屋のある区域・着く部屋の id（行き先の階の同じ升目） */
  private dropTarget(x: FloorExit): { to: StoryKey; plan: RegionPlan; landing: string } | null {
    const m = /^(-?\d+)\.(\d+)$/.exec(x.to!.floor);
    if (!m) return null;
    const to: StoryKey = { world: this.active.story.world, depth: Number(m[1]), variant: Number(m[2]) };
    const a = x.shaft!.anchor;
    const [cx, cz] = slotOf(a[0], a[2], this.t);
    return { to, plan: this.planner.at(to, cx, cz), landing: landingId(to.depth, cx, cz) };
  }

  /**
   * 近くの移る所の行き先の区域を、移る先の階に入れておく（同期で受け取れなければ次の tick にまた試す）。
   * 遠くなった区域は外し、要る区域の無い階は捨てる
   */
  prepare(): void {
    const near = this.t['world.prepare.airlockM'], nearDrop = this.t['world.hole.prepareM'];
    const players = this.active.sim.players;
    const dist = (x: number, z: number): number => Math.min(...players.map((p) => Math.hypot(p.pos[0] - x, p.pos[2] - z)));
    // 階 → 要る区域（今すぐ作る物 / 残しておく物）
    const want = new Map<string, { to: StoryKey; make: Map<string, RegionPlan>; keep: Set<string> }>();
    const need = (to: StoryKey, plan: RegionPlan, make: boolean): void => {
      const k = storyId(to);
      const e = want.get(k) ?? { to, make: new Map(), keep: new Set() };
      e.keep.add(plan.id);
      if (make) e.make.set(plan.id, plan);
      want.set(k, e);
    };
    for (const { layout } of this.active.regions) {
      for (const a of layout.region!.airlocks) {
        if (!a.to) continue;
        const d = dist(a.anchor.offset[0], a.anchor.offset[2]);
        if (d > near * 2.5) continue;
        const p = parseAirlockId(a.id);
        if (!p) continue;
        const [dd, v] = a.to.split('.').map(Number) as [number, number];
        const to: StoryKey = { world: this.active.story.world, depth: dd, variant: v };
        need(to, this.planner.at(to, p.cx, p.cz), d <= near);
      }
    }
    for (const x of this.drops()) {
      const a = x.shaft!.anchor;
      const falling = this.dropping.has(x.id);
      const d = dist(a[0], a[2]);
      if (d > nearDrop * 2.5 && !falling) continue;
      const tg = this.dropTarget(x);
      if (tg) need(tg.to, tg.plan, d <= nearDrop || falling);
    }
    for (const [k, e] of want) {
      let w = this.others.get(k) ?? null;
      for (const plan of e.make.values()) {
        if (!w) {
          try {
            w = new StoryWorld(e.to, plan, this.storyOpts());
            this.others.set(k, w);
            this.opts.created?.(w);
          } catch {
            // まだ作れていない（作業の糸で作っている）: 次の tick にまた
          }
          continue;
        }
        w.ensure(plan);
      }
      w?.retain(e.keep);
    }
    for (const [k, w] of this.others) if (!want.has(k) && !(this.gotoWorld?.w === w)) { w.sim.physics?.dispose(); this.others.delete(k); }
  }

  /** 階段室・エレベーターの入れ替え。向こうの階が用意できていなければ false（扉の中で少し待つ） */
  private transfer(r: TransferRequest): boolean {
    const dest = this.others.get(storyId(r.to)) ?? null;
    if (!dest) return false;
    const srcA = this.active.regionInfo(r.region)?.airlocks.find((x) => x.id === r.airlock);
    const dstR = dest.regions.find((x) => x.layout.region!.airlocks.some((a) => a.id === r.airlock));
    const dstA = dstR?.layout.region!.airlocks.find((x) => x.id === r.airlock);
    if (!srcA || !dstA || !dstR || !this.isReady(dest, dstR.plan.id)) return false;
    const from = this.active.sim.players[r.player]!, to = dest.sim.players[r.player]!;
    const before = [...from.pos] as Vec3, yaw0 = from.yaw;
    transferPlayer(from, to, srcA.anchor, dstA.anchor);
    // 向こうの階の扉の状態も、こちらと同じ（閉じている）。入れ替えの頼みがすぐ逆に出ないよう、向こうの頼みは捨て、
    // 向こうの入れ替えの範囲は、いったん出るまで効かない
    dest.transfers = [];
    dest.holdAirlocks(r.player);
    this.swap(dest);
    this.changes.push({ from: this.otherOrPrev.story, to: dest.story, airlock: r.airlock, seamless: true, player: r.player, dx: to.pos[0] - before[0], dy: to.pos[1] - before[1], dz: to.pos[2] - before[2], dYaw: to.yaw - yaw0 });
    return true;
  }

  /** 前の今の階（入れ替えた直後に changes に書くため） */
  private otherOrPrev!: StoryWorld;

  /** 今の階を dest に入れ替える。前の今の階は移る先の階に回す（要らなければ次の prepare で捨てる） */
  private swap(dest: StoryWorld): void {
    const prev = this.active;
    this.others.delete(storyId(dest.story));
    this.others.set(storyId(prev.story), prev);
    this.active = dest;
    this.otherOrPrev = prev;
    this.dropping.clear();
  }

  // ---------------------------------------------------------------- 落ちる所（暗転しない）
  /** 縦穴に入った落ちる所（出口の id → 入った時刻） */
  private readonly dropping = new Map<string, number>();

  /** 縦穴を落ちている人を、行き先の階の着く部屋の縦穴へ移す。移したら true */
  private fallThrough(): boolean {
    const p = this.active.sim.players[0];
    if (!p) return false;
    const tm = this.t['world.hole.transferM'];
    const now = this.active.sim.tick * this.active.sim.dt;
    for (const x of this.drops()) {
      const sh = x.shaft!;
      const z = sh.zone;
      if (p.pos[0] < z.min[0] - 0.05 || p.pos[0] > z.max[0] + 0.05 || p.pos[2] < z.min[2] - 0.05 || p.pos[2] > z.max[2] + 0.05) continue;
      const a = sh.anchor;
      const depth = a[1] - p.pos[1];
      if (depth < tm) { if (depth < -1) this.dropping.delete(x.id); continue; }
      if (!this.dropping.has(x.id)) this.dropping.set(x.id, now);
      const tg = this.dropTarget(x);
      const dest = tg ? this.others.get(storyId(tg.to)) ?? null : null;
      const dstR = dest?.regions.find((r) => r.layout.region?.landings?.some((l) => l.id === tg!.landing));
      const ld = dstR?.layout.region!.landings!.find((l) => l.id === tg!.landing);
      // 移れる深さ: 着く部屋の縦穴の中（天井より上）に収まる所まで
      if (dest && dstR && ld && depth < this.t['world.hole.shaftM'] - 1 && this.isReady(dest, dstR.plan.id)) {
        const to = dest.sim.players[0]!;
        const before = [...p.pos] as Vec3;
        // 広い落ちる所（崩れた床の下）は、着く部屋の縦穴の幅に収める（真っ暗なので横にずらしても見えない）
        const half = (ld.zone.max[0] - ld.zone.min[0]) / 2 - 0.4;
        const off: Vec3 = [Math.max(-half, Math.min(half, p.pos[0] - a[0])), p.pos[1] - a[1], Math.max(-half, Math.min(half, p.pos[2] - a[2]))];
        const riding = !!sh.lift && this.active.sim.outputOf(sh.lift, 'occupied') > 0.5;
        transferPlayer(p, to, { offset: [p.pos[0] - off[0], a[1], p.pos[2] - off[2]], q: 0 }, { offset: [...ld.anchor] as Vec3, q: 0 });
        // 沈む床に乗っていた: 着く部屋の床板を、足の下の同じ高さから同じ速さで下ろす
        if (riding && ld.lift) dest.sim.patchState(ld.lift, { y: to.pos[1], riding: 1 });
        dest.transfers = [];
        dest.holdAirlocks(0);
        this.swap(dest);
        this.changes.push({ from: this.otherOrPrev.story, to: dest.story, airlock: `drop:${x.id}`, seamless: true, player: 0, dx: to.pos[0] - before[0], dy: to.pos[1] - before[1], dz: to.pos[2] - before[2], dYaw: 0 });
        return true;
      }
      // まだ用意できない: 暗い縦穴の中で落ち続ける（少し上へ戻す。まわりは真っ暗なので見た目は変わらない）
      if (depth > tm + 2.5 && now - (this.dropping.get(x.id) ?? now) < this.t['world.hole.holdSec']) this.active.sim.warpPlayer(p, [p.pos[0], p.pos[1] + 2, p.pos[2]], p.yaw, true, 'drop');
      return false;
    }
    return false;
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
    if (!g || (this.opts.ready && !g.w.regions.every((r) => this.opts.ready!(g.w, r.plan.id)))) return false;
    const prev = this.active;
    const from = prev.sim.players[0]!, to = g.w.sim.players[0]!;
    const keepPos = [...to.pos] as Vec3;
    Object.assign(to, JSON.parse(JSON.stringify(from)) as PlayerState);
    to.pos = keepPos; to.vel = [0, 0, 0]; to.yaw = g.land.yaw; to.pitch = 0; to.holding = null; to.ride = null; to.surfaceId = null; to.interactedId = null; to.grav = null;
    to.respawn = { pos: [...keepPos], yaw: g.land.yaw }; to.lastGround = [...keepPos];
    prev.sim.physics?.dispose();
    for (const w of this.others.values()) if (w !== g.w) w.sim.physics?.dispose();
    this.others.clear();
    this.dropping.clear();
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
