/**
 * 身体の大きさが変わる部屋（sizeRoom）: 「小」の門で小さくなるとネズミの穴を通れる（普通の大きさでは通れない）・「大」の門で
 * 大きくなると通り口でかがむ・開口の前で元に戻る・小さいまま戸棚の下に潜ると隠しが開く。歩いて渡れる・生成したフロアに出る
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const SIZES = [{ w: 5.0, d: 9.0, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

function rooms(): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom('sizeRoom', { ...size, ...dims, height: 2.8, entry, exit: ((entry + 2) % 4) as Dir, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.42, exitAt: seed === 1 ? 0.5 : 0.6 });
    if (room) out.push({ room, tag: `${size.w}x${size.d} 入口${entry} seed${seed}` });
  }
  return out;
}

/** 点 q へまっすぐ歩く（着いたら true） */
function straight(sim: Sim, q: readonly number[], sec: number, crouch = false): boolean {
  const p = sim.players[0]!;
  for (let i = 0; i < sec * 60; i++) {
    const dx = q[0]! - p.pos[0], dz = q[2]! - p.pos[2];
    if (Math.hypot(dx, dz) < 0.15) return true;
    sim.step([{ ...IDLE_COMMAND, yaw: Math.atan2(-dx, -dz), moveY: 1, crouch }]);
  }
  return false;
}

const center = (a: { min: number[]; max: number[] }): Vec3 => [(a.min[0]! + a.max[0]!) / 2, 0, (a.min[2]! + a.max[2]!) / 2];

test('身体の大きさが変わる部屋（実験室）: 入口の向き 4 つ × 大きさで、入口から出口へ歩いて渡れる', () => {
  const list = rooms();
  assert.ok(list.length >= 12, `組めた ${list.length}`);
  const fails: string[] = [];
  for (const { room, tag } of list) {
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', room.exitInside!, 120);
    for (let i = 0; i < 90; i++) sim.step([{ ...IDLE_COMMAND }]);
    if (!res.ok) fails.push(`${tag}: ${res.reason}`);
    else if (Math.abs(sim.players[0]!.scale - 1) > 0.02) fails.push(`${tag}: 出口の前で元の大きさに戻らない（${sim.players[0]!.scale.toFixed(2)}）`);
  }
  assert.deepEqual(fails, []);
});

test('「小」の門で小さくなるとネズミの穴を通れる（普通の大きさでは通れない）。開口の前で元に戻る', () => {
  let n = 0;
  for (const { room, tag } of rooms().slice(0, 6)) {
    const e = room.floor.entities.find((x) => x.type === 'sizeGate')!;
    const gates = e.params.gates as { min: number[]; max: number[]; scale: number }[];
    const small = gates.find((g) => g.scale < 1)!;
    // ネズミの穴: 仕切りの縁取り（trim の当たらない箱、高さ 0.7）の真下
    const trim = room.cell.boxes.find((b) => b.mat === 'trim' && !b.solid && Math.abs(b.min[1] - 0.7) < 0.01)!;
    const hc = center(trim);
    const { f } = (() => { const a = room.inside, b = room.exitInside!; const d = [b[0] - a[0], b[2] - a[2]]; const l = Math.hypot(d[0]!, d[1]!); return { f: [d[0]! / l, d[1]! / l] }; })();
    const before: Vec3 = [hc[0] - f[0]! * 0.8, 0, hc[2] - f[1]! * 0.8], after: Vec3 = [hc[0] + f[0]! * 1.0, 0, hc[2] + f[1]! * 1.0];
    // 普通の大きさ: 穴を通れない
    const a = new Sim(room.floor, { tuning: t });
    a.teleport(0, [before[0], 0.02, before[2]], 0);
    assert.ok(!straight(a, after, 4, true), `${tag}: 普通の大きさでは穴を通れない`);
    // 小さくなってから
    const sim = new Sim(room.floor, { tuning: t });
    const gc = center(small);
    sim.teleport(0, [gc[0] - f[0]! * 0.6, 0.02, gc[2] - f[1]! * 0.6], 0);
    straight(sim, [gc[0] + f[0]! * 0.6, 0, gc[2] + f[1]! * 0.6], 3);
    for (let i = 0; i < 90; i++) sim.step([{ ...IDLE_COMMAND }]);
    const p = sim.players[0]!;
    assert.ok(Math.abs(p.scale - t['move.size.small']) < 0.01, `${tag}: 小さくなる（${p.scale.toFixed(2)}）`);
    assert.ok(straight(sim, before, 12) && straight(sim, after, 6), `${tag}: 小さいと穴を通れる（${p.pos.map((x) => x.toFixed(2))}）`);
    // 出口の前で元に戻る
    straight(sim, room.exitInside!, 15);
    for (let i = 0; i < 90; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(Math.abs(p.scale - 1) < 0.01, `${tag}: 元に戻る（${p.scale.toFixed(2)}）`);
    n++;
  }
  assert.ok(n >= 4);
});

test('「大」の門で大きくなると、通り口は立ったままでは通れず、かがめば通れる', () => {
  const { room, tag } = rooms()[0]!;
  const e = room.floor.entities.find((x) => x.type === 'sizeGate')!;
  const large = (e.params.gates as { min: number[]; max: number[]; scale: number }[]).find((g) => g.scale > 1)!;
  const sim = new Sim(room.floor, { tuning: t });
  const gc = center(large);
  const a = room.inside, b = room.exitInside!;
  const d = [b[0] - a[0], b[2] - a[2]], l = Math.hypot(d[0]!, d[1]!), f = [d[0]! / l, d[1]! / l];
  sim.teleport(0, [gc[0] - f[0]! * 0.6, 0.02, gc[2] - f[1]! * 0.6], 0);
  straight(sim, [gc[0] + f[0]! * 0.6, 0, gc[2] + f[1]! * 0.6], 3);
  for (let i = 0; i < 90; i++) sim.step([{ ...IDLE_COMMAND }]);
  const p = sim.players[0]!;
  assert.ok(Math.abs(p.scale - t['move.size.large']) < 0.01, `${tag}: 大きくなる（${p.scale.toFixed(2)}）`);
  // 通り口: 仕切りの上の箱（2.1 m から上）の真下
  const lintel = room.cell.boxes.find((x) => x.solid && Math.abs(x.min[1] - 2.1) < 0.01 && Math.abs(Math.min(x.max[0] - x.min[0], x.max[2] - x.min[2]) - 0.3) < 0.01)!;
  const lc = center(lintel);
  const before: Vec3 = [lc[0] - f[0]! * 1.0, 0, lc[2] - f[1]! * 1.0], after: Vec3 = [lc[0] + f[0]! * 1.0, 0, lc[2] + f[1]! * 1.0];
  assert.ok(straight(sim, before, 10), '通り口の前へ');
  const st = new Sim(room.floor, { tuning: t });
  st.teleport(0, [p.pos[0], 0.02, p.pos[2]], 0);
  st.players[0]!.scale = p.scale; st.players[0]!.scaleTo = p.scaleTo;
  assert.ok(!straight(st, after, 3), '立ったままでは通れない');
  assert.ok(straight(sim, after, 6, true), 'かがめば通れる');
});

test('小さいまま戸棚の下に潜ると隠しが開く（普通の大きさでは潜れない）', () => {
  const list = rooms().filter(({ room }) => room.offers.some((o) => o.hook === 'size.under'));
  assert.ok(list.length >= 6, `戸棚のある部屋 ${list.length}`);
  for (const { room, tag } of list.slice(0, 4)) {
    const offer = room.offers.find((o) => o.hook === 'size.under')!;
    const sensor = offer.revealOutput!.replace(/\.done$/, '');
    const a = room.floor.entities.find((x) => x.id === sensor)!.params.aabb as { min: number[]; max: number[] };
    const c = center(a);
    // 普通の大きさ: 戸棚の前に立っても開かない
    const n = new Sim(room.floor, { tuning: t });
    n.teleport(0, [c[0], 0.02, c[2]], 0);
    for (let i = 0; i < 120; i++) n.step([{ ...IDLE_COMMAND }]);
    assert.equal(n.outputOf(sensor, 'done'), 0, `${tag}: 普通の大きさでは開かない`);
    // 小さい身体で戸棚の下へ
    const sim = new Sim(room.floor, { tuning: t });
    const p = sim.players[0]!;
    p.scale = t['move.size.small']; p.scaleTo = t['move.size.small'];
    // 戸棚の前（部屋の真ん中の側）から下へ
    const mid = [(room.slot.rect.x0 + room.slot.rect.x1) / 2, (room.slot.rect.z0 + room.slot.rect.z1) / 2];
    const dx = mid[0]! - c[0], dz = mid[1]! - c[2];
    const dl = Math.hypot(dx, dz);
    const alongX = a.max[0]! - a.min[0]! < a.max[2]! - a.min[2]!;
    const from: Vec3 = alongX ? [c[0] + Math.sign(dx) * 1.0, 0.02, c[2]] : [c[0], 0.02, c[2] + Math.sign(dz) * 1.0];
    void dl;
    sim.teleport(0, from, 0);
    assert.ok(straight(sim, c, 6), `${tag}: 戸棚の下へ（${p.pos.map((x) => x.toFixed(2))}）`);
    for (let i = 0; i < 60 * (t['move.size.underSec'] + 0.5); i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.equal(sim.outputOf(sensor, 'done'), 1, `${tag}: 小さいまま潜ると開く`);
  }
});

test('身体の大きさが変わる部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  await loadRapier();
  const list = findRooms('sizeRoom', 2, { maxWorld: 900 });
  assert.ok(list.length >= 1, `見つかった部屋 ${list.length}`);
  for (const room of list) {
    const res = await walkThrough(room, 220);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
  }
});
