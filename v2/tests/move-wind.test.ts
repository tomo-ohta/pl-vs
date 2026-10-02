/**
 * 送風の通路（windTunnel）: 入口から出口へ渡れる（突風の間は押し戻される）・風よけでは押されない・
 * 突風の中で跳ぶと通気口が開く（出現型）・人の流れの変種も渡れる・生成したフロアに出て、渡れる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
import type { Dir } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const SIZES = [{ w: 4.2, d: 9.0, kind: 'room' as const }, { w: 2.3, d: 8.0, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

/** 突風が on（1 = 吹き始めた・0 = 止んだ）になる tick まで進める（まず床に降りる） */
function untilGust(sim: Sim, id: string, on: number): void {
  for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND, yaw: sim.players[0]!.yaw }]);
  for (let i = 0; i < 1200 && sim.outputOf(id, 'on') === on; i++) sim.step([{ ...IDLE_COMMAND, yaw: sim.players[0]!.yaw }]);
  for (let i = 0; i < 1200 && sim.outputOf(id, 'on') !== on; i++) sim.step([{ ...IDLE_COMMAND, yaw: sim.players[0]!.yaw }]);
}

test('送風の通路（実験室）: 入口の向き 4 つ × 大きさで、入口から出口へ渡れる', () => {
  const fails: string[] = [];
  const dirs = new Set<number>();
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) {
    // 入口から奥への向きが長い辺になるように（入口が x の壁なら幅と奥行きを入れ替える）
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom('windTunnel', { ...size, ...dims, entry, exit: ((entry + 2) % 4) as Dir, seed: 3 + entry, t: makeTuning({ 'move.crowd.chance': 0 }).tuning });
    if (!room) { fails.push(`${size.w}x${size.d} 入口${entry}: 組めない`); continue; }
    dirs.add(entry);
    assert.ok(room.floor.entities.some((e) => e.type === 'flowZone' && e.params.visual === 'wind'));
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', room.exitInside!, 150);
    if (!res.ok) fails.push(`${size.w}x${size.d} 入口${entry}: ${res.reason}`);
  }
  assert.equal(dirs.size, 4);
  assert.deepEqual(fails, []);
});

test('送風の通路: 突風の間、開けた所では入口へ押し戻され、風よけの陰では押されない', () => {
  const room = labRoom('windTunnel', { w: 4.2, d: 9.0, entry: 2, exit: 0, seed: 5, t: makeTuning({ 'move.crowd.chance': 0 }).tuning })!;
  const gust = room.floor.entities.find((e) => e.type === 'flowZone')!.id;
  const sim = new Sim(room.floor, { tuning: t });
  // 入口は z = 0 の壁（dir 2）。奥へ +z。開けた所（風の帯の真ん中）
  const zones = room.floor.entities.filter((e) => e.type === 'flowZone').map((e) => e.params.aabb as { min: number[]; max: number[] });
  const big = zones.sort((a, b) => (b.max[0]! - b.min[0]!) * (b.max[2]! - b.min[2]!) - (a.max[0]! - a.min[0]!) * (a.max[2]! - a.min[2]!))[0]!;
  const open: [number, number, number] = [(big.min[0]! + big.max[0]!) / 2, 0.02, Math.min(big.max[2]! - 0.5, 5.5)];
  sim.teleport(0, open, 0);
  untilGust(sim, gust, 1);
  sim.teleport(0, open, 0);
  for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.ok(open[2] - sim.players[0]!.pos[2] > 1.8, `押し戻される（${open[2].toFixed(2)} → ${sim.players[0]!.pos[2].toFixed(2)}）`);
  // 歩いても進めない（ダッシュならわずかに進む）
  sim.teleport(0, open, Math.PI); // +z を向く
  untilGust(sim, gust, 1);
  sim.teleport(0, open, Math.PI);
  for (let i = 0; i < 3; i++) sim.step([{ ...IDLE_COMMAND, yaw: Math.PI }]);
  for (let i = 0; i < 40; i++) sim.step([{ ...IDLE_COMMAND, yaw: Math.PI, moveY: 1, dash: true }]);
  assert.ok(sim.players[0]!.pos[2] > open[2] && sim.players[0]!.pos[2] < open[2] + 1.2, 'ダッシュならわずかに進める');
  // 風よけ: 仕切りの陰（入口の側）
  const fins = room.cell.boxes.filter((b) => b.solid && b.max[2] - b.min[2] < 0.2 && b.max[1] - b.min[1] > 2);
  assert.ok(fins.length >= 1, '仕切りがある');
  const f = fins[0]!;
  const pocket: [number, number, number] = [(f.min[0] + f.max[0]) / 2, 0.02, f.min[2] - 0.55];
  sim.teleport(0, pocket, 0);
  untilGust(sim, gust, 1);
  for (let i = 0; i < 90; i++) sim.step([{ ...IDLE_COMMAND }]);
  const pl = sim.players[0]!;
  assert.ok(Math.hypot(pl.pos[0] - pocket[0], pl.pos[2] - pocket[2]) < 0.3, `風よけでは押されない（${pl.pos.map((v) => v.toFixed(2))}）`);
});

test('送風の通路（出現型の隠し）: 突風の中で跳ぶと通気口が開く。普通に歩くだけでは開かない', () => {
  const room = labRoom('windTunnel', { w: 4.2, d: 9.0, entry: 2, exit: 0, seed: 5, t: makeTuning({ 'move.crowd.chance': 0 }).tuning })!;
  const offer = room.offers.find((o) => o.hook === 'wind.blown');
  assert.ok(offer && offer.modes.includes('appear') && offer.revealOutput);
  const [sensor] = offer.revealOutput!.split('.done');
  const gust = room.floor.entities.find((e) => e.type === 'flowZone')!.id;
  // 普通に歩いて渡る
  const a = new Sim(room.floor, { tuning: t });
  a.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
  const step = a.step.bind(a);
  let jumped = false;
  (a as unknown as { step: typeof a.step }).step = (c) => { if (c[0]?.jump) jumped = true; step(c); };
  assert.ok(walkTo(a, 'room', room.exitInside!, 150).ok);
  if (!jumped) assert.equal(a.outputOf(sensor!, 'done'), 0, '歩くだけでは開かない');
  // 突風の中で跳ぶ
  const b = new Sim(room.floor, { tuning: t });
  b.teleport(0, [room.inside[0], 0.02, 4.5], Math.PI);
  untilGust(b, gust, 1);
  for (let i = 0; i < 30; i++) b.step([{ ...IDLE_COMMAND, yaw: Math.PI, jump: i === 0 }]);
  assert.equal(b.outputOf(sensor!, 'done'), 1, '跳んで飛ばされると開く');
});

test('人の流れ（変種）: 横切る流れに押されながらも渡れる', () => {
  const tc = makeTuning({ 'move.crowd.chance': 1 }).tuning;
  let built = 0;
  for (const entry of [0, 1, 2, 3] as Dir[]) {
    const room = labRoom('windTunnel', { ...(entry % 2 === 1 ? { w: 9.5, d: 4.5 } : { w: 4.5, d: 9.5 }), entry, exit: ((entry + 2) % 4) as Dir, seed: 11 + entry, t: tc });
    if (!room) continue;
    const lanes = room.floor.entities.filter((e) => e.type === 'flowZone' && e.params.visual === 'crowd');
    if (!lanes.length) continue;
    built++;
    const sim = new Sim(room.floor, { tuning: tc });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', room.exitInside!, 150);
    assert.ok(res.ok, `入口${entry}: ${res.reason}`);
  }
  assert.ok(built >= 3, `組めた ${built}`);
});

test('送風の通路: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  const R = await loadRapier();
  const rooms = findRooms('windTunnel', 3, { maxWorld: 600 });
  assert.ok(rooms.length >= 2, `見つかった部屋 ${rooms.length}`);
  for (const room of rooms) {
    const res = await walkThrough(room, 200);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
  }
});
