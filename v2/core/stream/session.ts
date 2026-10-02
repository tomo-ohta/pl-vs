/**
 * 果てしない階を渡り歩く（docs/endless-world.md 3.2・5.2）: 今の階（StoryWorld）と、階段室の向こうの階を持つ。
 *
 * - 下りの階段室の扉に world.prepare.airlockM まで近づいたら、向こうの階（下の階の同じ升目の区域から）を作っておく
 * - 階段室の入れ替えの頼み（StoryWorld.transfers）が来たら、プレイヤーを向こうの写しの同じ所へ移し（局所の座標で同じ位置・向き・速さ）、
 *   今の階と向こうの階を入れ替える。前の階は同じ階段室の向こうとして残す（すぐ戻っても作り直さない）
 * - 遠くなった向こうの階は捨てる
 * 階を移ったことは changes に出す（描画が場面を入れ替え、カメラを同じだけずらす）
 */
import type { Tuning } from '../config/tuning.ts';
import { rotQ, type Dir, type Vec3 } from '../math/vec.ts';
import type { PhysicsWorld } from '../physics/world.ts';
import type { PlayerState } from '../sim/types.ts';
import type { RegionAirlockCell } from '../world/layout.ts';
import { downSlot, parseAirlockId, storyId, WorldPlanner, type StoryKey } from '../gen/world/plan.ts';
import { StoryWorld, type RegionSource, type TransferRequest } from './story.ts';

export interface SessionOptions {
  tuning: Tuning;
  source: RegionSource;
  /** 階ごとの物理（階を作るたびに呼ぶ。捨てた階の物理は dispose する） */
  physics(): PhysicsWorld;
  playerIds?: string[];
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
  }

  private storyOpts(): ConstructorParameters<typeof StoryWorld>[2] {
    return { tuning: this.t, source: this.opts.source, physics: this.opts.physics(), planner: this.planner, ...(this.opts.playerIds ? { playerIds: this.opts.playerIds } : {}) };
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

  /** 1 tick: 今の階を進め、区域の出し入れ・向こうの階の用意・入れ替え */
  step(cmds: Parameters<StoryWorld['sim']['step']>[0]): void {
    this.active.sim.step(cmds);
    this.active.update();
    this.prepare();
    const reqs = this.active.transfers;
    this.active.transfers = [];
    for (const r of reqs) if (this.transfer(r)) break;
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
      return w;
    } catch {
      return null;
    }
  }

  /** 階段室の入れ替え。向こうの階が用意できていなければ false（扉の中で少し待つ） */
  private transfer(r: TransferRequest): boolean {
    const dest = this.beyond.get(r.airlock) ?? null;
    if (!dest) return false;
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

  /** 開発用: 今の階の id */
  get storyId(): string {
    return storyId(this.active.story);
  }
}
