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
import { slideSolve } from '../core/gen/gimmicks/carry/puzzles2.ts';

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

/** 部屋の外（試験だけの足場）へ出る。drop なら持っている物を置く */
function goOut(sim: Sim, room: LabRoom, drop: boolean): void {
  const r = room.slot.rect;
  const p: Vec3 = [r.x1 + 3, room.cell.floorY, (r.z0 + r.z1) / 2];
  if (!(sim as unknown as { _out?: boolean })._out) {
    sim.colliders.addStatic({ min: [r.x1 + 1.5, room.cell.floorY - 0.2, r.z0], max: [r.x1 + 6, room.cell.floorY, r.z1] });
    (sim as unknown as { _out?: boolean })._out = true;
  }
  sim.teleport(0, [p[0], p[1] + 0.02, p[2]], -Math.PI / 2);
  run(sim, 0.4);
  if (drop) sim.step([cmd({ yaw: -Math.PI / 2, drop: true })]);
  run(sim, 0.2);
}
const carryOut = (sim: Sim, room: LabRoom): void => goOut(sim, room, true);

/** 椅子を全部部屋の外へ（床下収納）/ 椅子を全部同じ向きに置き直す */
SOLVERS.chairRoom = [async (sim, room) => {
  for (const ch of ents(room, 'carryItem', (e) => e.params.kind === 'chair')) {
    sim.teleport(0, room.inside, 0);
    run(sim, 0.1);
    if (!goPick(sim, room, ch.id)) return ['（拾えない）'];
    carryOut(sim, room);
  }
  run(sim, 0.5);
  return [`group:${room.floor.entities.find((e) => e.type === 'reveal')!.params.group}`];
}];
SOLVERS.alignChairs = [async (sim, room) => {
  for (const ch of ents(room, 'carryItem', (e) => e.params.kind === 'chair')) {
    const c = center(sim, ch.id);
    if (!goPick(sim, room, ch.id)) return ['（拾えない）'];
    // 元の所の 0.8 m 手前（+z）に立って -z を向いて置く（同じ所に、向き 0 で）
    const at: Vec3 = [c[0], room.cell.floorY, c[2] + 0.8];
    if (bodyFree(sim, at)) walkTo(sim, 'room', at, 30);
    run(sim, 0.1, { yaw: 0 });
    sim.step([cmd({ yaw: 0.1, drop: true })]);
    run(sim, 0.1);
  }
  run(sim, 0.3);
  return ['carry.chairs.aligned'];
}];

/** 重い木箱を板に載せて、開いた穴の階段を底まで下りる */
SOLVERS.weightHatch = [async (sim, room) => {
  const crate = ents(room, 'carryItem', (e) => e.params.tag === 'box.heavy')[0]!;
  const plate = ents(room, 'carryReceiver')[0]!;
  const reg = plate.params.region as { min: number[]; max: number[] };
  const pc: Vec3 = [(reg.min[0]! + reg.max[0]!) / 2, room.cell.floorY, (reg.min[2]! + reg.max[2]!) / 2];
  if (!goPick(sim, room, crate.id)) return ['（拾えない）'];
  if (!goPlace(sim, room, pc, undefined, 1.05)) return ['（置けない）'];
  run(sim, 2.5);
  const open = room.floor.entities.find((e) => e.id.endsWith('.open'))!;
  if (sim.outputOf(open.id, 'out') < 0.5) return ['（開かない）'];
  const zone = ents(room, 'zoneSensor', (e) => e.id.endsWith('.inPit'))[0]!.params.aabb as { min: number[]; max: number[] };
  // 底（扉の前）へ: 穴の中の、壁際の床
  const bottom: Vec3 = [(zone.min[0]! + zone.max[0]!) / 2, zone.min[1]! + 0.2, (zone.min[2]! + zone.max[2]!) / 2];
  walkTo(sim, 'room', bottom, 60);
  run(sim, 2);
  if (sim.players[0]!.pos[1] > room.cell.floorY - 1.5) return ['（底へ下りられない）'];
  return [`out:${open.id}.out`];
}];

/** 社員証・切符を拾って改札の間に立つ */
SOLVERS.keycardGate = [async (sim, room) => {
  const key = ents(room, 'carryItem', (e) => e.id.endsWith('.key'))[0]!;
  const gate = ents(room, 'carrySensor')[0]!;
  if (!goPick(sim, room, key.id)) return ['（拾えない）'];
  const c = frameCenter(gate);
  if (!holdAt(sim, room, [c[0], room.cell.floorY, c[2]], 1)) return ['（改札へ行けない）'];
  return ['carry.keycard'];
}];
/** 落とし物を拾って、名札の机に置く */
SOLVERS.lostItem = [async (sim, room) => {
  const item = ents(room, 'carryItem', (e) => e.id.endsWith('.lost'))[0]!;
  const desk = ents(room, 'carryReceiver')[0]!;
  if (!goPick(sim, room, item.id)) return ['（拾えない）'];
  if (!goPlace(sim, room, slotPos(desk))) return ['（置けない）'];
  run(sim, 0.3);
  return ['carry.lost.returned'];
}];
/** 電球を拾って、電気スタンドの受け口に差す */
SOLVERS.bulbRoom = [async (sim, room) => {
  const bulb = ents(room, 'carryItem', (e) => e.params.kind === 'bulb')[0]!;
  const socket = ents(room, 'carryReceiver')[0]!;
  if (!goPick(sim, room, bulb.id)) return ['（拾えない）'];
  if (!goPlace(sim, room, slotPos(socket))) return ['（差せない）'];
  run(sim, 0.5);
  const lit = room.floor.entities.find((e) => e.id.endsWith('.lit'))!;
  return ['carry.bulb.lit', `out:${lit.id}.out`];
}];

/** 台に物を置いて、部屋の外へ出る（戻ると並んでいる） */
SOLVERS.replicaRoom = [async (sim, room) => {
  const thing = ents(room, 'carryItem', (e) => e.id.endsWith('.thing'))[0]!;
  const ped = ents(room, 'carryReceiver')[0]!;
  if (!goPick(sim, room, thing.id)) return ['（拾えない）'];
  if (!goPlace(sim, room, slotPos(ped))) return ['（置けない）'];
  run(sim, 0.3);
  const field = ents(room, 'replicaField')[0]!;
  if (sim.outputOf(field.id, 'shown') > 0.5) return ['（見ている間に並んだ）'];
  goOut(sim, room, false);
  return ['carry.replica'];
}];
/** 運ぶと変わる物を、鍵になるまで持って歩いて台に戻す / 部屋の外へ持ち出してから戻して置く */
SOLVERS.homeObject = [async (sim, room) => {
  const thing = ents(room, 'carryItem', (e) => e.id.endsWith('.thing'))[0]!;
  const ped = ents(room, 'carryReceiver')[0]!;
  if (!goPick(sim, room, thing.id)) return ['（拾えない）'];
  if (thing.params.kind === 'morph') {
    const a = room.inside, b = farPointOf(sim, room);
    for (let k = 0; k < 40 && sim.outputOf(thing.id, 'stage') < 3; k++) walkTo(sim, 'room', k % 2 ? a : b, 30);
    if (sim.outputOf(thing.id, 'stage') < 3) return ['（鍵にならない）'];
    if (!goPlace(sim, room, slotPos(ped))) return ['（戻せない）'];
    run(sim, 0.3);
    return ['carry.home.morph'];
  }
  goOut(sim, room, false);
  sim.teleport(0, room.inside, 0);
  run(sim, 0.3);
  if (!goPlace(sim, room, slotPos(ped))) return ['（戻せない）'];
  run(sim, 0.3);
  return ['carry.home.returned'];
}];

/** 部屋の奥（入口から遠い、体を置ける点） */
function farPointOf(sim: Sim, room: LabRoom): Vec3 {
  const r = room.slot.rect;
  let best: Vec3 = room.inside, bd = -1;
  for (let x = r.x0 + 0.6; x < r.x1 - 0.5; x += 0.5) for (let z = r.z0 + 0.6; z < r.z1 - 0.5; z += 0.5) {
    const p: Vec3 = [x, room.cell.floorY, z];
    const d = Math.hypot(x - room.inside[0], z - room.inside[2]);
    if (d > bd && bodyFree(sim, p)) { bd = d; best = p; }
  }
  return best;
}

/** 部品の箱（params.box）の近くへ歩いて、times 回調べる */
export function goPress(sim: Sim, room: LabRoom, e: EntitySpec, times = 1): boolean {
  const b = e.params.box as { min: number[]; max: number[] };
  const c: Vec3 = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
  // 壁に付いた物は正面に立つ（薄い向きの、部屋の真ん中の側）
  const r = room.slot.rect;
  const thinX = b.max[0]! - b.min[0]! < b.max[2]! - b.min[2]!;
  const wd = e.params.dir;
  const n: Vec3 = typeof wd === 'number' ? ([[0, 0, -1], [-1, 0, 0], [0, 0, 1], [1, 0, 0]] as Vec3[])[wd]! : thinX ? [Math.sign((r.x0 + r.x1) / 2 - c[0]), 0, 0] : [0, 0, Math.sign((r.z0 + r.z1) / 2 - c[2])];
  const front: Vec3 = [c[0] + n[0] * 1.1, room.cell.floorY, c[2] + n[2] * 1.1];
  const p = bodyFree(sim, front) ? front : standNear(sim, [c[0], room.cell.floorY, c[2]], room.cell.floorY, 1.1);
  if (!p || !walkTo(sim, 'room', p, 60).ok) return false;
  for (let i = 0; i < 6; i++) sim.step([cmd(aimAt(sim, c))]);
  for (let i = 0; i < times; i++) { const a = aimAt(sim, c); sim.step([cmd({ ...a, interact: a })]); sim.step([cmd(a)]); }
  return true;
}
const byId = (room: LabRoom, id: string): EntitySpec => room.floor.entities.find((e) => e.id === id)!;
const portOf = (ref: string): string => ref.slice(0, ref.lastIndexOf('.'));

SOLVERS.dialLock = [async (sim, room) => {
  run(sim, 0.1);
  for (const is of ents(room, 'valueIs')) {
    const dial = byId(room, portOf(is.inputs!.in as string));
    const want = Number(is.params.value), now = sim.outputOf(dial.id, 'value');
    if (!goPress(sim, room, dial, (want - now + 10) % 10)) return ['（回せない）'];
  }
  run(sim, 0.3);
  return ['puzzle.dial'];
}];
SOLVERS.colorMix = [async (sim, room) => {
  run(sim, 0.1);
  const mix = ents(room, 'matchBits')[0]!;
  const want = mix.params.want as number[];
  for (const [i, port] of ['a', 'b', 'c'].entries()) if (want[i]) { if (!goPress(sim, room, byId(room, portOf(mix.inputs![port] as string)))) return ['（押せない）']; }
  run(sim, 0.3);
  return ['puzzle.color'];
}];
SOLVERS.clockRoom = [async (sim, room) => {
  run(sim, 0.1);
  const same = ents(room, 'sameValue')[0]!;
  const clocks = Object.values(same.inputs!).map((r) => byId(room, portOf(r as string)));
  const target = typeof same.params.target === 'number' ? same.params.target : sim.outputOf(clocks[0]!.id, 'value');
  for (const c of clocks) { const now = sim.outputOf(c.id, 'value'); if (!goPress(sim, room, c, (target - now + 12) % 12)) return ['（回せない）']; }
  run(sim, 0.3);
  return ['puzzle.clocks'];
}];
SOLVERS.bellOrder = [async (sim, room) => {
  run(sim, 0.1);
  const seq = ents(room, 'sequence')[0]!;
  const n = Number(seq.params.count);
  for (let i = 1; i <= n; i++) if (!goPress(sim, room, byId(room, portOf(seq.inputs![`s${i}`] as string)))) return ['（鳴らせない）'];
  run(sim, 0.3);
  return ['puzzle.bells'];
}];
SOLVERS.bulbOrder = [async (sim, room) => {
  const sockets = ents(room, 'carryReceiver')[0]!;
  const slots = sockets.params.slots as { want: string[] }[];
  for (let i = 0; i < slots.length; i++) {
    const bulb = ents(room, 'carryItem', (e) => e.params.tag === slots[i]!.want[0])[0]!;
    if (!goPick(sim, room, bulb.id)) return ['（拾えない）'];
    if (!goPlace(sim, room, slotPos(sockets, i), undefined, 0.8)) return ['（差せない）'];
  }
  run(sim, 0.3);
  return ['puzzle.bulbs'];
}];

/** タイルを入れ替えて絵をそろえる: 枠 i の物を拾い、正しいタイルを調べて入れ替え、空いた枠 i へ置く */
SOLVERS.tilePicture = [async (sim, room) => {
  const grid = ents(room, 'carryReceiver')[0]!;
  const slots = grid.params.slots as { pos: number[]; want: string[] }[];
  const tiles = ents(room, 'carryItem', (e) => e.params.kind === 'tile');
  const at = (id: string): number => { const c = center(sim, id); return slots.findIndex((sl) => Math.hypot(sl.pos[0]! - c[0], sl.pos[2]! - c[2]) < 0.2); };
  for (let i = 0; i < slots.length; i++) {
    const want = tiles.find((t) => t.params.tag === slots[i]!.want[0])!;
    if (at(want.id) === i) continue;
    const here = tiles.find((t) => at(t.id) === i)!;
    if (!goPick(sim, room, here.id)) return ['（拾えない）'];
    if (!goPick(sim, room, want.id)) return ['（入れ替えられない）'];
    run(sim, 0.1);
    if (!goPlace(sim, room, slotPos(grid, i), undefined, 0.9)) return ['（置けない）'];
    run(sim, 0.1);
  }
  run(sim, 0.3);
  return ['puzzle.tiles'];
}];
/** 切り抜きを正しい台に置く */
SOLVERS.shadowPuzzle = [async (sim, room) => {
  const o = room.offers.find((x) => x.hook === 'puzzle.shadow')!;
  const ped = byId(room, portOf(o.revealOutput!));
  const cut = ents(room, 'carryItem', (e) => e.params.kind === 'cutout')[0]!;
  if (!goPick(sim, room, cut.id)) return ['（拾えない）'];
  if (!goPlace(sim, room, slotPos(ped), undefined, 0.9)) return ['（置けない）'];
  run(sim, 0.3);
  return ['puzzle.shadow'];
}];
/** 鏡を解き方の升目に、解き方の向きで置く（置く向きに立って、升目を見て Q） */
SOLVERS.mirrorBeam = [async (sim, room) => {
  const beam = ents(room, 'beamGrid')[0]!;
  const o = beam.params.origin as number[];
  const C = Number(beam.params.cell);
  const sol = beam.params.solution as number[][];
  const mirrors = ents(room, 'carryItem', (e) => e.params.kind === 'mirror');
  for (let j = 0; j < sol.length; j++) {
    const [i, k, yaw] = sol[j]!;
    const c: Vec3 = [o[0]! + (i! + 0.5) * C, room.cell.floorY, o[2]! + (k! + 0.5) * C];
    if (!goPick(sim, room, mirrors[j]!.id)) return ['（拾えない）'];
    let ok = false;
    for (const [yy, dd] of [[yaw!, 0.8], [yaw! + Math.PI, 0.8], [yaw!, 1.2], [yaw! + Math.PI, 1.2]] as const) {
      const st: Vec3 = [c[0] + Math.sin(yy) * dd, room.cell.floorY, c[2] + Math.cos(yy) * dd];
      if (!bodyFree(sim, st) || !walkTo(sim, 'room', st, 40).ok) continue;
      const pitch = -Math.atan2(sim.players[0]!.eye - 0.3, dd);
      for (let n = 0; n < 6; n++) sim.step([cmd({ yaw: yy, pitch })]);
      sim.step([cmd({ yaw: yy, pitch, drop: true })]);
      run(sim, 0.1);
      ok = true;
      break;
    }
    if (!ok) return ['（鏡を置けない）'];
  }
  run(sim, 0.5);
  return ['puzzle.mirror'];
}];
/** 家具を写真の所へ */
SOLVERS.furnitureMatch = [async (sim, room) => {
  const lay = ents(room, 'carryReceiver')[0]!;
  const slots = lay.params.slots as { want: string[] }[];
  for (let i = 0; i < slots.length; i++) {
    const f = ents(room, 'carryItem', (e) => e.params.tag === slots[i]!.want[0])[0]!;
    if (!goPick(sim, room, f.id)) return ['（拾えない）'];
    if (!goPlace(sim, room, slotPos(lay, i))) return ['（置けない）'];
  }
  run(sim, 0.3);
  return ['puzzle.layout'];
}];
/** 天秤: 左に 1 と 3、右に 4 */
SOLVERS.balanceScale = [async (sim, room) => {
  const pans = ents(room, 'carryReceiver');
  const mid = (e: EntitySpec): Vec3 => { const a = e.params.region as { min: number[]; max: number[] }; return [(a.min[0]! + a.max[0]!) / 2, a.min[1]! + 0.08, (a.min[2]! + a.max[2]!) / 2]; };
  for (const [w, pan] of [[1, 0], [3, 0], [4, 1]] as const) {
    const box = ents(room, 'carryItem', (e) => e.params.tag === `weight.${w}`)[0]!;
    if (!goPick(sim, room, box.id)) return ['（拾えない）'];
    if (!goPlace(sim, room, mid(pans[pan]!), undefined, 0.85)) return ['（載せられない）'];
    run(sim, 0.2);
  }
  run(sim, 0.3);
  return ['puzzle.balance'];
}];
/** 迷路の模型: 玉の道（傾きの並び）を、机の辺に立って順に傾ける */
SOLVERS.mazeModel = [async (sim, room) => {
  const m = ents(room, 'marbleModel')[0]!;
  const nu = Number(m.params.nx), nv = Number(m.params.nz);
  const seq = slideSolve(nu, nv, new Set(m.params.open as string[]), Number(m.params.start), Number(m.params.hole));
  if (!seq) return ['（玉が届かない）'];
  const t = m.params.table as { min: number[]; max: number[] };
  const ax = m.params.axes as number[];
  const c: Vec3 = [(t.min[0]! + t.max[0]!) / 2, room.cell.floorY, (t.min[2]! + t.max[2]!) / 2];
  const hw = (t.max[0]! - t.min[0]!) / 2, hd = (t.max[2]! - t.min[2]!) / 2;
  for (const d of seq) {
    // 升目の向き → 世界の向き（+i = ax[0..1]、+k = ax[2..3]）→ その辺の外に立つ
    const g: [number, number] = d === 0 ? [ax[0]!, ax[1]!] : d === 1 ? [ax[2]!, ax[3]!] : d === 2 ? [-ax[0]!, -ax[1]!] : [-ax[2]!, -ax[3]!];
    const wx = Math.abs(g[0]) > Math.abs(g[1]) ? Math.sign(g[0]) : 0, wz = wx ? 0 : Math.sign(g[1]);
    const st: Vec3 = [c[0] + wx * (hw + 0.5), room.cell.floorY, c[2] + wz * (hd + 0.5)];
    if (!walkTo(sim, 'room', st, 40).ok) return ['（机の辺へ行けない）'];
    run(sim, 0.3);
    for (let n = 0; n < 600 && sim.outputOf(m.id, 'moving') > 0.5; n++) sim.step([cmd()]);
    run(sim, 0.2);
    if (sim.outputOf(m.id, 'done') > 0.5) break;
  }
  run(sim, 0.3);
  return ['puzzle.mazeModel'];
}];
/** 足跡の模様の順に升目を踏む */
SOLVERS.footPattern = [async (sim, room) => {
  const st = ents(room, 'stepPattern')[0]!;
  const o = st.params.origin as number[];
  const C = Number(st.params.cell), N = Number(st.params.nx);
  for (const c of st.params.pattern as number[]) {
    const p: Vec3 = [o[0]! + ((c % N) + 0.5) * C, room.cell.floorY, o[2]! + (Math.floor(c / N) + 0.5) * C];
    if (!walkTo(sim, 'room', p, 30).ok) return ['（踏めない）'];
  }
  run(sim, 0.3);
  return ['puzzle.feet'];
}];

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
  // 椅子を全部、机の後ろの印へ戻す（片付ける）→ 床下収納は開かない
  chairRoom: [async (sim, room) => {
    const seats = ents(room, 'carryReceiver', (e) => Array.isArray(e.params.slots))[0]!;
    const chairs = ents(room, 'carryItem', (e) => e.params.kind === 'chair');
    for (let i = 0; i < chairs.length; i++) {
      if (!goPick(sim, room, chairs[i]!.id)) return [];
      goPlace(sim, room, slotPos(seats, i));
    }
    run(sim, 0.5);
    if (sim.outputOf(seats.id, 'full') < 0.5) return ['（片付けられない）'];
    return [`group:${room.floor.entities.find((e) => e.type === 'reveal')!.params.group}`];
  }],
  // 板に乗ってから蓋の前へ走っても、着く前に閉まる
  weightHatch: [async (sim, room) => {
    const plate = ents(room, 'carryReceiver')[0]!;
    const reg = plate.params.region as { min: number[]; max: number[] };
    holdAt(sim, room, [(reg.min[0]! + reg.max[0]!) / 2, room.cell.floorY, (reg.min[2]! + reg.max[2]!) / 2], 1.5);
    const zone = ents(room, 'zoneSensor', (e) => e.id.endsWith('.inPit'))[0]!.params.aabb as { min: number[]; max: number[] };
    const c: Vec3 = [(zone.min[0]! + zone.max[0]!) / 2, room.cell.floorY, (zone.min[2]! + zone.max[2]!) / 2];
    const near = standNear(sim, c, room.cell.floorY, 1.9);
    if (near) walkWith(sim, near, (x) => ({ ...x, dash: true }), 30);
    const open = room.floor.entities.find((e) => e.id.endsWith('.open'))!;
    return sim.players[0]!.pos[1] < room.cell.floorY - 0.5 ? [] : [`out:${open.id}.out`];
  }],
  // 何も持たずに改札の間に立つ
  keycardGate: [async (sim, room) => {
    const c = frameCenter(ents(room, 'carrySensor')[0]!);
    holdAt(sim, room, [c[0], room.cell.floorY, c[2]], 2);
    return ['carry.keycard'];
  }],
  // 部屋の中で拾って、台に置き直すだけ（持ち出さない・形が変わるほど運ばない）
  homeObject: [async (sim, room) => {
    const thing = ents(room, 'carryItem', (e) => e.id.endsWith('.thing'))[0]!;
    const ped = ents(room, 'carryReceiver')[0]!;
    if (!goPick(sim, room, thing.id)) return [];
    goPlace(sim, room, slotPos(ped));
    run(sim, 0.3);
    return ['carry.home.morph', 'carry.home.returned'];
  }],
  // 鐘を高い順に鳴らす（逆の順）
  bellOrder: [async (sim, room) => {
    const seq = ents(room, 'sequence')[0]!;
    const n = Number(seq.params.count);
    for (let i = n; i >= 1; i--) goPress(sim, room, byId(room, portOf(seq.inputs![`s${i}`] as string)));
    return ['puzzle.bells'];
  }],
  // 違う台に切り抜きを置く（影が扉より大きい / 小さい）
  shadowPuzzle: [async (sim, room) => {
    const o = room.offers.find((x) => x.hook === 'puzzle.shadow')!;
    const right = portOf(o.revealOutput!);
    const ped = ents(room, 'carryReceiver', (e) => e.id !== right)[0]!;
    const cut = ents(room, 'carryItem', (e) => e.params.kind === 'cutout')[0]!;
    if (!goPick(sim, room, cut.id)) return [];
    goPlace(sim, room, slotPos(ped), undefined, 0.9);
    run(sim, 0.3);
    return ['puzzle.shadow'];
  }],
  // 足跡の模様を逆から踏む
  footPattern: [async (sim, room) => {
    const st = ents(room, 'stepPattern')[0]!;
    const o = st.params.origin as number[];
    const C = Number(st.params.cell), N = Number(st.params.nx);
    for (const c of (st.params.pattern as number[]).slice().reverse()) walkTo(sim, 'room', [o[0]! + ((c % N) + 0.5) * C, room.cell.floorY, o[2]! + (Math.floor(c / N) + 0.5) * C], 30);
    return ['puzzle.feet'];
  }],
  // 天秤を 1 つずつ（2 と 2 には分けられない: 1 と 1 なら軽すぎ）
  balanceScale: [async (sim, room) => {
    const pans = ents(room, 'carryReceiver');
    const mid = (e: EntitySpec): Vec3 => { const a = e.params.region as { min: number[]; max: number[] }; return [(a.min[0]! + a.max[0]!) / 2, a.min[1]! + 0.08, (a.min[2]! + a.max[2]!) / 2]; };
    for (const [w, pan] of [[1, 0], [2, 1]] as const) {
      const box = ents(room, 'carryItem', (e) => e.params.tag === `weight.${w}`)[0]!;
      if (goPick(sim, room, box.id)) goPlace(sim, room, mid(pans[pan]!), undefined, 0.85);
    }
    run(sim, 0.3);
    return ['puzzle.balance'];
  }],
  // 何も持たずに枠で待つ
  parcelGate: [async (sim, room) => {
    const frame = ents(room, 'carrySensor')[0]!;
    const c = frameCenter(frame);
    holdAt(sim, room, [c[0], room.cell.floorY, c[2]], Number(frame.params.sec) + 1);
    return ['carry.parcel.match', 'carry.parcel.wrong'];
  }],
};
