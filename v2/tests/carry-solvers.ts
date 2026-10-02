/**
 * 物を運ぶ担当の仕掛けの「決めた遊び方」（試験用）: 実験室の部屋で、歩く人（tests/helpers/bot.ts）で物の近くまで歩き、
 * 視線を合わせて調べる（E）・Q で置く。戻り値は、これで現れるはずの隠しの元（hook）。
 */
import type { Vec3 } from '../core/math/vec.ts';
import type { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import type { EntitySpec } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import type { LabRoom } from './helpers/gimmick-lab.ts';

export type Solver = (sim: Sim, room: LabRoom) => Promise<string[]>;

export const cmd = (o: Partial<InputCommand> = {}): InputCommand => ({ ...IDLE_COMMAND, ...o });

export function run(sim: Sim, sec: number, c: Partial<InputCommand> = {}): void {
  for (let i = 0; i < Math.round(sec / sim.dt); i++) sim.step([cmd({ yaw: sim.players[0]!.yaw, ...c })]);
}

export function center(sim: Sim, id: string): Vec3 {
  const p = sim.stateOf(id)!.poses as number[];
  return [p[0]!, p[1]!, p[2]!];
}

export function aimAt(sim: Sim, at: Vec3): { yaw: number; pitch: number } {
  const p = sim.players[0]!;
  const ex = at[0] - p.pos[0], ey = at[1] - (p.pos[1] + p.eye), ez = at[2] - p.pos[2];
  return { yaw: Math.atan2(-ex, -ez), pitch: Math.atan2(ey, Math.hypot(ex, ez)) };
}

/** 体（半幅 0.36・高さ 1.7）を足元 p に置けるか */
export function bodyFree(sim: Sim, p: Vec3): boolean {
  const under = sim.colliders.query(p[0] - 0.1, p[1] - 0.2, p[2] - 0.1, p[0] + 0.1, p[1] + 0.02, p[2] + 0.1).some((b) => Math.abs(b.max[1] - p[1]) < 0.05);
  const body = sim.colliders.query(p[0] - 0.37, p[1] + 0.06, p[2] - 0.37, p[0] + 0.37, p[1] + 1.7, p[2] + 0.37).some((b) => b.max[1] > p[1] + 0.06 && b.min[1] < p[1] + 1.7);
  return under && !body;
}

/** 点 at の近く（水平 dist m）の、体を置ける床の点（部屋の床の高さ y） */
export function standNear(sim: Sim, at: Vec3, y: number, dist = 1.0): Vec3 | null {
  for (const d of [dist, dist + 0.3, dist - 0.25, dist + 0.6]) for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const p: Vec3 = [at[0] + Math.cos(a) * d, y, at[2] + Math.sin(a) * d];
    if (bodyFree(sim, p)) return p;
  }
  return null;
}

/** 歩く人の操作を変えて歩く（しゃがむ・ゆっくり） */
export function walkWith(sim: Sim, goal: Vec3, mod: (c: InputCommand) => InputCommand, maxSec = 90): boolean {
  const step = sim.step.bind(sim);
  (sim as unknown as { step: typeof sim.step }).step = (cs) => step(cs.map(mod));
  try { return walkTo(sim, 'room', goal, maxSec).ok; } finally { (sim as unknown as { step: typeof sim.step }).step = step; }
}

/** 物の近くまで歩いて、見て調べる（拾う） */
export function goPick(sim: Sim, room: LabRoom, id: string, mod?: (c: InputCommand) => InputCommand): boolean {
  const c = center(sim, id);
  const p = standNear(sim, c, room.cell.floorY, 1.0);
  if (!p) return false;
  if (!(mod ? walkWith(sim, p, mod) : walkTo(sim, 'room', p, 90).ok)) return false;
  for (let i = 0; i < 10; i++) sim.step([cmd({ ...aimAt(sim, c), crouch: false })]);
  const a = aimAt(sim, center(sim, id));
  sim.step([cmd({ ...a, interact: a })]);
  sim.step([cmd(a)]);
  return sim.players[0]!.holding === id;
}

/** 点 slot（置く所の底）の前まで歩いて、見て Q */
export function goPlace(sim: Sim, room: LabRoom, slot: Vec3, mod?: (c: InputCommand) => InputCommand, dist = 0.95): boolean {
  const p = standNear(sim, slot, room.cell.floorY, dist);
  if (!p) return false;
  if (!(mod ? walkWith(sim, p, mod) : walkTo(sim, 'room', p, 90).ok)) return false;
  const at: Vec3 = [slot[0], slot[1] + 0.1, slot[2]];
  for (let i = 0; i < 10; i++) sim.step([cmd({ ...aimAt(sim, at), crouch: mod ? mod(cmd()).crouch : false })]);
  const a = aimAt(sim, at);
  sim.step([cmd({ ...a, drop: true, crouch: mod ? mod(cmd()).crouch : false })]);
  sim.step([cmd(a)]);
  return sim.players[0]!.holding === null;
}

export const ents = (room: LabRoom, type: string, pred: (e: EntitySpec) => boolean = () => true): EntitySpec[] => room.floor.entities.filter((e) => e.type === type && pred(e));
export const slotPos = (e: EntitySpec, i = 0): Vec3 => { const s = (e.params.slots as { pos: number[] }[])[i]!; return [s.pos[0]!, s.pos[1]!, s.pos[2]!]; };
const crouch = (c: InputCommand): InputCommand => ({ ...c, crouch: true });

/** 物を持って点 at に sec 秒立つ */
export function holdAt(sim: Sim, room: LabRoom, at: Vec3, sec: number): boolean {
  const p = bodyFree(sim, at) ? at : standNear(sim, at, room.cell.floorY, 0.3);
  if (!p || !walkTo(sim, 'room', p, 90).ok) return false;
  run(sim, sec);
  return true;
}

const frameCenter = (e: EntitySpec): Vec3 => { const a = e.params.aabb as { min: number[]; max: number[] }; return [(a.min[0]! + a.max[0]!) / 2, a.min[1]! + 0.3, (a.min[2]! + a.max[2]!) / 2]; };

export const SOLVERS: Record<string, Solver[]> = {
  // バケツを満たし、しゃがみ歩きで台へ運んで置く
  carryWater: [async (sim, room) => {
    const bucket = ents(room, 'carryItem', (e) => e.params.kind === 'bucket')[0]!;
    const stand = ents(room, 'carryReceiver')[0]!;
    if (!goPick(sim, room, bucket.id)) return ['（拾えない）'];
    const fz = bucket.params.fillZone as { min: number[]; max: number[] };
    const fill: Vec3 = [(fz.min[0]! + fz.max[0]!) / 2, room.cell.floorY, (fz.min[2]! + fz.max[2]!) / 2];
    const at = bodyFree(sim, fill) ? fill : standNear(sim, fill, room.cell.floorY, 0.3) ?? fill;
    walkWith(sim, at, crouch);
    run(sim, 1.6, { crouch: true });
    if (!goPlace(sim, room, slotPos(stand), crouch, 1.1)) return ['（置けない）'];
    run(sim, 2);
    return ['carry.water.full'];
  }],
  // 札と同じ色の荷物を持って枠で待つ / 違う色の荷物を持って待つ
  parcelGate: [true, false].map((right) => async (sim, room) => {
    const frame = ents(room, 'carrySensor')[0]!;
    const want = (frame.params.want as string[])[0]!;
    const parcel = ents(room, 'carryItem', (e) => (right ? e.params.tag === want : e.params.tag !== want))[0]!;
    if (!goPick(sim, room, parcel.id)) return ['（拾えない）'];
    const c = frameCenter(frame);
    if (!holdAt(sim, room, [c[0], room.cell.floorY, c[2]], Number(frame.params.sec) + 0.5)) return ['（枠へ行けない）'];
    return [right ? 'carry.parcel.match' : 'carry.parcel.wrong'];
  }),
};

/** 本を全部拾って返却台へ / 道をたどって 1 冊も拾わずに返却台へ */
SOLVERS.bookCollect = [
  async (sim, room) => {
    const set = ents(room, 'collectSet')[0]!;
    const left = (set.params.items as number[][]).map((p) => [p[0]!, room.cell.floorY, p[2]!] as Vec3);
    while (left.length) {
      const p = sim.players[0]!.pos;
      left.sort((a, b) => Math.hypot(a[0] - p[0], a[2] - p[2]) - Math.hypot(b[0] - p[0], b[2] - p[2]));
      const b = left.shift()!;
      const at = bodyFree(sim, b) ? b : standNear(sim, b, room.cell.floorY, 0.3);
      if (at) walkTo(sim, 'room', at, 60);
    }
    const desk = set.params.desk as { min: number[]; max: number[] };
    holdAt(sim, room, [(desk.min[0]! + desk.max[0]!) / 2, room.cell.floorY, (desk.min[2]! + desk.max[2]!) / 2], 2);
    return sim.outputOf(set.id, 'count') === left.length + (set.params.items as unknown[]).length ? ['carry.books.all'] : ['（拾いきれない）'];
  },
  async (sim, room) => {
    const set = ents(room, 'collectSet')[0]!;
    for (const p of set.params.route as number[][]) {
      const pt: Vec3 = [p[0]!, room.cell.floorY, p[2]!];
      if (!walkTo(sim, 'room', pt, 60).ok) return ['（道をたどれない）'];
    }
    const desk = set.params.desk as { min: number[]; max: number[] };
    holdAt(sim, room, [(desk.min[0]! + desk.max[0]!) / 2, room.cell.floorY, (desk.min[2]! + desk.max[2]!) / 2], 2);
    return sim.outputOf(set.id, 'count') === 0 ? ['carry.books.none'] : [`（${sim.outputOf(set.id, 'count')} 冊拾った）`];
  },
];

/** 普通の遊び方（隠しが現れてはいけない）: 戻り値は、現れてはいけない隠しの元 */
export const ANTI: Record<string, Solver[]> = {
  // 普通に歩いて運ぶと少しこぼれる → 台は沈まない
  carryWater: [async (sim, room) => {
    const bucket = ents(room, 'carryItem', (e) => e.params.kind === 'bucket')[0]!;
    const stand = ents(room, 'carryReceiver')[0]!;
    if (!goPick(sim, room, bucket.id)) return [];
    const fz = bucket.params.fillZone as { min: number[]; max: number[] };
    const fill: Vec3 = [(fz.min[0]! + fz.max[0]!) / 2, room.cell.floorY, (fz.min[2]! + fz.max[2]!) / 2];
    walkTo(sim, 'room', bodyFree(sim, fill) ? fill : standNear(sim, fill, room.cell.floorY, 0.3) ?? fill, 60);
    run(sim, 1.6);
    goPlace(sim, room, slotPos(stand), undefined, 1.1);
    run(sim, 2);
    return ['carry.water.full'];
  }],
  // 何も持たずに枠で待つ
  parcelGate: [async (sim, room) => {
    const frame = ents(room, 'carrySensor')[0]!;
    const c = frameCenter(frame);
    holdAt(sim, room, [c[0], room.cell.floorY, c[2]], Number(frame.params.sec) + 1);
    return ['carry.parcel.match', 'carry.parcel.wrong'];
  }],
};
