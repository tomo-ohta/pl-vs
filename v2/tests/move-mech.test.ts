/**
 * 回る・動く床と壁の部屋: 回る床（一緒に回される・縁に乗り続けると隠し）・回転扉（羽を押すと回る・勢いで回り続ける）・
 * 押せる壁（押すと動いて道が開く・反対からも）・傾いていく部屋（乗っていると傾き、家具が滑る）。どれも渡れる・生成したフロアに出る
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
void PhysicsWorld;

function rooms(def: string, sizes: { w: number; d: number; kind: 'room' | 'hall' }[], exits: ('opposite' | 'side')[] = ['opposite']): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of sizes) for (const entry of [0, 1, 2, 3] as Dir[]) for (const ex of exits) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const exit = ((entry + (ex === 'opposite' ? 2 : 1)) % 4) as Dir;
    const room = labRoom(def, { ...size, ...dims, entry, exit, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.45, exitAt: 0.5 });
    if (room) out.push({ room, tag: `${size.w}x${size.d} 入口${entry} 出口${exit} seed${seed}` });
  }
  return out;
}

function crossAll(list: { room: LabRoom; tag: string }[], sec = 120): string[] {
  const fails: string[] = [];
  for (const { room, tag } of list) {
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', room.exitInside!, sec);
    if (!res.ok) fails.push(`${tag}: ${res.reason}`);
  }
  return fails;
}

const forward = (room: LabRoom): { yaw: number; f: Vec3 } => {
  const e = room.inside, x = room.exitInside!;
  const f: Vec3 = [x[0] - e[0], 0, x[2] - e[2]];
  const l = Math.hypot(f[0], f[2]);
  return { yaw: Math.atan2(-f[0] / l, -f[2] / l), f: [f[0] / l, 0, f[2] / l] };
};

const SQ = [{ w: 6.5, d: 6.5, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];
const LONG = [{ w: 4.2, d: 8.0, kind: 'room' as const }, { w: 6.4, d: 9.0, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

test('回る床（実験室）: 入口の向き 4 つ × 出口の向き × 大きさで、入口から出口へ渡れる', () => {
  const list = rooms('spinFloor', SQ, ['opposite', 'side']);
  assert.ok(list.length >= 12, `組めた ${list.length}`);
  assert.deepEqual(crossAll(list), []);
});

test('回る床: 上に立つと一緒に回され、縁に乗り続けると隠しが開く（真ん中では開かない）', () => {
  const room = labRoom('spinFloor', { w: 7.5, d: 7.5, entry: 2, exit: 0, seed: 3 })!;
  const disc = room.floor.entities.find((e) => e.type === 'spinFloor')!;
  const c = disc.params.center as number[], R = Number(disc.params.radius);
  const sim = new Sim(room.floor, { tuning: t });
  const start: Vec3 = [c[0]! + R - 0.4, 0.02, c[2]!];
  sim.teleport(0, start, 0);
  for (let i = 0; i < 120; i++) sim.step([{ ...IDLE_COMMAND }]);
  const p = sim.players[0]!.pos;
  const moved = Math.hypot(p[0] - start[0], p[2] - start[2]);
  assert.ok(moved > 1.0 && Math.abs(Math.hypot(p[0] - c[0]!, p[2] - c[2]!) - (R - 0.4)) < 0.15, `回される ${moved.toFixed(2)} m`);
  const offer = room.offers.find((o) => o.hook === 'turntable.rim')!;
  assert.ok(offer && offer.modes[0] === 'appear');
  for (let i = 0; i < Math.ceil((t['move.turn.rimSec'] + 0.5) * 60); i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.equal(sim.outputOf(disc.id, 'done'), 1, '縁に乗り続けると開く');
  // 真ん中に近い所では開かない
  const s2 = new Sim(room.floor, { tuning: t });
  s2.teleport(0, [c[0]! + 0.25, 0.02, c[2]!], 0);
  for (let i = 0; i < Math.ceil((t['move.turn.rimSec'] + 1) * 60); i++) s2.step([{ ...IDLE_COMMAND }]);
  assert.equal(s2.outputOf(disc.id, 'done'), 0);
});

test('回転扉（実験室）: 入口の向き 4 つ × 大きさで、入口から出口へ渡れる', () => {
  const list = rooms('revolvingDoor', LONG);
  assert.ok(list.length >= 12, `組めた ${list.length}`);
  assert.deepEqual(crossAll(list), []);
});

test('回転扉: 羽を押すと回り、手を離しても勢いで回り続ける。走って押すと速い', () => {
  const room = labRoom('revolvingDoor', { w: 6.4, d: 9.0, entry: 2, exit: 0, seed: 1 })!;
  const door = room.floor.entities.find((e) => e.type === 'revolvingDoor')!;
  const c = door.params.center as number[];
  const push = (dash: boolean): { after: number; coast: number } => {
    const sim = new Sim(room.floor, { tuning: t });
    // 入口側の区切りの真ん中から、回る向き（円の接線）へ押し続ける
    sim.teleport(0, [c[0]!, 0.02, c[2]! - 1.0], 0);
    const pl = sim.players[0]!;
    const tangentYaw = (): number => { const phi = Math.atan2(pl.pos[2] - c[2]!, pl.pos[0] - c[0]!); return Math.atan2(Math.sin(phi), -Math.cos(phi)); };
    for (let i = 0; i < 50; i++) sim.step([{ ...IDLE_COMMAND, yaw: tangentYaw(), moveY: 1, dash }]);
    const a0 = sim.outputOf(door.id, 'angle');
    const w = Math.abs(sim.outputOf(door.id, 'speed'));
    for (let i = 0; i < 40; i++) sim.step([{ ...IDLE_COMMAND, yaw: pl.yaw }]);
    const a1 = sim.outputOf(door.id, 'angle');
    return { after: w, coast: Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))) };
  };
  const walk = push(false), run = push(true);
  assert.ok(walk.after > 0.5, `押すと回る ${walk.after.toFixed(2)} rad/s`);
  assert.ok(walk.coast > 0.2, `手を離しても回る ${walk.coast.toFixed(2)} rad`);
  assert.ok(run.after > walk.after * 1.3, `走ると速い ${run.after.toFixed(2)} / ${walk.after.toFixed(2)}`);
});

test('押せる壁（実験室）: 入口の向き 4 つ × 大きさで、押して渡れる。出口の側から来ても通れる', () => {
  const list = rooms('pushWall', LONG);
  assert.ok(list.length >= 12, `組めた ${list.length}`);
  assert.deepEqual(crossAll(list), []);
  const back: string[] = [];
  for (const { room, tag } of list) {
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [room.exitInside![0], 0.02, room.exitInside![2]], 0);
    const res = walkTo(sim, 'room', room.inside, 120);
    if (!res.ok) back.push(`${tag}: ${res.reason}`);
  }
  assert.deepEqual(back, []);
});

test('押せる壁: 押すとゆっくり動いて止まり、押さなければ動かない', () => {
  const room = labRoom('pushWall', { w: 4.2, d: 8.0, entry: 2, exit: 0, seed: 1 })!;
  const e = room.floor.entities.find((x) => x.type === 'pushBlock')!;
  const b = e.params.box as { min: number[]; max: number[] };
  const { yaw, f } = forward(room);
  const sim = new Sim(room.floor, { tuning: t });
  const cx = (b.min[0]! + b.max[0]!) / 2, cz = (b.min[2]! + b.max[2]!) / 2;
  sim.teleport(0, [cx - f[0] * 1.2, 0.02, cz - f[2] * 1.2], yaw);
  for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND, yaw }]);
  assert.equal(sim.outputOf(e.id, 'off'), 0, '押さなければ動かない');
  for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
  const off1 = Math.abs(sim.outputOf(e.id, 'off'));
  assert.ok(off1 > 0.1 && off1 < 0.8, `ゆっくり動く ${off1.toFixed(2)}`);
  for (let i = 0; i < 360; i++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
  assert.ok(Math.abs(Math.abs(sim.outputOf(e.id, 'off')) - t['move.push.travelM']) < 1e-6 && sim.outputOf(e.id, 'done') === 1, '端で止まる');
});

test('傾いていく部屋（実験室）: 入口の向き 4 つ × 大きさで、入口から出口へ渡れる', () => {
  const list = rooms('slantRoom', LONG);
  assert.ok(list.length >= 12, `組めた ${list.length}`);
  assert.deepEqual(crossAll(list), []);
});

test('傾いていく部屋: 床の上にいるとだんだん傾き、家具が低い側の壁まで滑る。降りると床は戻る', () => {
  const room = labRoom('slantRoom', { w: 6.4, d: 9.0, entry: 2, exit: 0, seed: 2 })!;
  const deck = room.floor.entities.find((e) => e.type === 'tiltDeck')!;
  const items = deck.params.items as { min: number[]; max: number[] }[];
  assert.ok(items.length >= 2, `家具 ${items.length}`);
  const sim = new Sim(room.floor, { tuning: t });
  const r = deck.params.rect as { x0: number; z0: number; x1: number; z1: number };
  // 低い側の壁際の入口寄り（家具の滑る道の外）に立つ
  const low = Number(deck.params.down) > 0 ? r.x1 - 0.45 : r.x0 + 0.45;
  sim.teleport(0, [low, 0.02, r.z0 + 0.8], 0);
  for (let i = 0; i < 60 * 14; i++) sim.step([{ ...IDLE_COMMAND }]);
  const roll = Math.abs(sim.outputOf(deck.id, 'roll'));
  assert.ok(roll > t['move.tilt.maxDeg'] - 0.5, `傾く ${roll.toFixed(1)}°`);
  const st = sim.stateOf(deck.id) as { off: number[] };
  const lim = deck.params.limits as number[];
  assert.ok(st.off.some((o, i) => o > 0.5 && Math.abs(o - lim[i]!) < 0.05), `家具が滑る ${st.off.map((o) => o.toFixed(2))}`);
  // 降りると戻る
  sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
  for (let i = 0; i < 60 * 30; i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.ok(Math.abs(sim.outputOf(deck.id, 'roll')) < 0.5, `戻る ${sim.outputOf(deck.id, 'roll').toFixed(1)}`);
});

test('回る・動く部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  await loadRapier();
  for (const def of ['spinFloor', 'revolvingDoor', 'pushWall', 'slantRoom']) {
    const list = findRooms(def, 2, { maxWorld: 900 });
    assert.ok(list.length >= 1, `${def}: 見つかった部屋 ${list.length}`);
    for (const room of list) {
      const res = await walkThrough(room, 220);
      assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
      assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
    }
  }
});
