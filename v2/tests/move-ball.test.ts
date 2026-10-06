/**
 * 球に乗る部屋（ballRide）: 塗りたてのペンキの床は歩くと遅いが歩いて渡れる。球に乗ると速く渡れる。
 * 玉乗りは速いまま壁にぶつかると振り落とされ、横の坂を乗ったまま下りると隠しが開く。バブルは薄い壁に何度もぶつかると割れる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTuning, type Tuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const tOf = (bubble: boolean): Tuning => makeTuning({ 'move.ball.bubbleChance': bubble ? 1 : 0 }).tuning;
const SIZES = [{ w: 5.0, d: 9.0, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

function rooms(tt: Tuning): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom('ballRide', { ...size, ...dims, height: 2.8, entry, exit: ((entry + 2) % 4) as Dir, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.4, exitAt: 0.5, t: tt });
    if (room) out.push({ room, tag: `${size.w}x${size.d} 入口${entry} seed${seed}` });
  }
  return out;
}

/** 球に乗る（球を見て調べる） */
function board(sim: Sim, ball: Vec3): void {
  const p = sim.players[0]!;
  const ex = ball[0] - p.pos[0], ez = ball[2] - p.pos[2], ey = ball[1] - (p.pos[1] + p.eye);
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
}

/** 乗っている球を点 q へ転がす（近づいたら止める）。着いたら true */
function rollTo(sim: Sim, id: string, q: readonly number[], sec: number, stop = 0.5): boolean {
  for (let i = 0; i < sec * 60; i++) {
    const b = (sim.stateOf(id)!.pos as number[]);
    const v = sim.stateOf(id)!.vel as number[];
    const dx = q[0]! - b[0]!, dz = q[2]! - b[2]!;
    const d = Math.hypot(dx, dz);
    if (d < stop) return true;
    // 行き過ぎないように: 速さ v のときの止まるまでの距離より近ければ逆へ
    const toward = (v[0]! * dx + v[2]! * dz) / Math.max(1e-6, d);
    const brake = toward > 0 && toward * toward / 7 > d;
    const yaw = Math.atan2(-dx, -dz);
    sim.step([{ ...IDLE_COMMAND, yaw, moveY: brake ? -1 : 1 }]);
  }
  return false;
}

for (const bubble of [false, true]) {
  test(`球に乗る部屋（${bubble ? 'バブル' : '玉乗り'}・実験室）: 乗らずに歩いて渡れる（ペンキの床は遅い）`, () => {
    const tt = tOf(bubble);
    const list = rooms(tt);
    assert.ok(list.length >= 12, `組めた ${list.length}`);
    const fails: string[] = [];
    for (const { room, tag } of list) {
      const sim = new Sim(room.floor, { tuning: tt });
      sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const res = walkTo(sim, 'room', room.exitInside!, 150);
      if (!res.ok) fails.push(`${tag}: ${res.reason}`);
    }
    assert.deepEqual(fails, []);
  });

  test(`${bubble ? 'バブル' : '玉乗り'}: 調べて乗ると、ペンキの上を歩くより速く出口の前まで転がれる`, () => {
    const tt = tOf(bubble);
    const room = rooms(tt).find(({ room }) => room.slot.rect.x1 - room.slot.rect.x0 < 6)!.room;
    const e = room.floor.entities.find((x) => x.type === 'rideBall')!;
    const home = e.params.home as Vec3;
    const walk = new Sim(room.floor, { tuning: tt });
    walk.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const rw = walkTo(walk, 'room', room.exitInside!, 150);
    assert.ok(rw.ok);
    const sim = new Sim(room.floor, { tuning: tt });
    const p = sim.players[0]!;
    sim.teleport(0, [home[0] + (room.inside[0] - home[0]) * 0.6, 0.02, home[2] + (room.inside[2] - home[2]) * 0.6], 0);
    for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
    board(sim, home);
    assert.equal(sim.outputOf(e.id, 'riding'), 1, '乗った');
    let n = 0;
    const ok = rollTo(sim, e.id, room.exitInside!, 30, 0.9);
    n = sim.tick;
    assert.ok(ok && p.ride, `出口の前へ（${(sim.stateOf(e.id)!.pos as number[]).map((x) => x.toFixed(2))}）`);
    assert.ok(n / 60 < rw.seconds * 0.7, `歩くより速い（${(n / 60).toFixed(1)} 秒 / 歩いて ${rw.seconds.toFixed(1)} 秒）`);
    // 跳ぶと降りる
    sim.step([{ ...IDLE_COMMAND, jump: true }]);
    for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(!p.ride && sim.outputOf(e.id, 'riding') === 0 && p.onGround, '降りた');
  });
}

test('玉乗り: 速いまま壁にぶつかると振り落とされる。横の坂を乗ったまま下りると隠しが開く（歩いて下りても開かない）', () => {
  const tt = tOf(false);
  const list = rooms(tt).filter(({ room }) => room.offers.some((o) => o.hook === 'ball.slope'));
  assert.ok(list.length >= 4, `坂のある部屋 ${list.length}`);
  for (const { room, tag } of list.slice(0, 4)) {
    const e = room.floor.entities.find((x) => x.type === 'rideBall')!;
    const home = e.params.home as Vec3;
    const area = e.params.area as { min: number[]; max: number[] };
    const ramp = room.floor.entities.find((x) => x.type === 'ramp')!;
    const rr = ramp.params.rect as { x0: number; z0: number; x1: number; z1: number };
    const y0 = Number(ramp.params.y0), y1 = Number(ramp.params.y1);
    const a0 = Number(ramp.params.a0), a1 = Number(ramp.params.a1);
    const ax = Number(ramp.params.axis);
    // 坂の上の口（高い端の手前 0.8 m）と、坂の下の低い所の真ん中
    const top = y0 > y1 ? a0 : a1, dirA = Math.sign((y0 > y1 ? a1 : a0) - top);
    const mid = ax === 0 ? (rr.z0 + rr.z1) / 2 : (rr.x0 + rr.x1) / 2;
    const entryP = ax === 0 ? [top - dirA * 0.9, 0, mid] : [mid, 0, top - dirA * 0.9];
    const bottomP = [(area.min[0]! + area.max[0]!) / 2, 0, (area.min[2]! + area.max[2]!) / 2];
    // 歩いて下りても開かない
    const w = new Sim(room.floor, { tuning: tt });
    w.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    walkTo(w, 'room', [bottomP[0]!, area.min[1]! + 0.1, bottomP[2]!], 60);
    assert.equal(w.outputOf(e.id, 'inArea'), 0, `${tag}: 歩いて下りても開かない`);
    // 乗って下りる
    const sim = new Sim(room.floor, { tuning: tt });
    sim.teleport(0, [home[0] + (room.inside[0] - home[0]) * 0.6, 0.02, home[2] + (room.inside[2] - home[2]) * 0.6], 0);
    for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
    board(sim, home);
    assert.ok(rollTo(sim, e.id, entryP, 30, 0.35), `${tag}: 坂の上の口へ`);
    assert.ok(rollTo(sim, e.id, bottomP, 20, 0.5), `${tag}: 坂の下へ（${(sim.stateOf(e.id)!.pos as number[]).map((x) => x.toFixed(2))}）`);
    for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.equal(sim.outputOf(e.id, 'inArea'), 1, `${tag}: 乗ったまま下りると開く`);
  }
  // 振り落とされる: 横の壁へまっすぐ速く
  const room = list[0]!.room;
  const e = room.floor.entities.find((x) => x.type === 'rideBall')!;
  const home = e.params.home as Vec3;
  const sim = new Sim(room.floor, { tuning: tt });
  sim.teleport(0, [home[0] + (room.inside[0] - home[0]) * 0.6, 0.02, home[2] + (room.inside[2] - home[2]) * 0.6], 0);
  for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
  board(sim, home);
  const ex = room.exitInside!;
  const yaw = Math.atan2(-(ex[0] - home[0]), -(ex[2] - home[2]));
  let thrown = false;
  for (let i = 0; i < 60 * 12 && !thrown; i++) { sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]); thrown = !sim.players[0]!.ride; }
  assert.ok(thrown, '奥の壁へぶつかって振り落とされる');
});

test('バブル: 横の壁の薄い所へ何度も速くぶつかると割れる（1 回では割れない）', () => {
  const tt = tOf(true);
  const list = rooms(tt).filter(({ room }) => room.offers.some((o) => o.hook === 'bubble.wall'));
  assert.ok(list.length >= 4, `薄い壁のある部屋 ${list.length}`);
  for (const { room, tag } of list.slice(0, 3)) {
    const e = room.floor.entities.find((x) => x.type === 'rideBall')!;
    const home = e.params.home as Vec3;
    const thin = e.params.thin as { min: number[]; max: number[] };
    const tc = [(thin.min[0]! + thin.max[0]!) / 2, 0, (thin.min[2]! + thin.max[2]!) / 2];
    const R = Number(e.params.radius);
    // 壁から離れた点（壁の法線の向きへ 2.5 m）
    const alongX = thin.max[0]! - thin.min[0]! < thin.max[2]! - thin.min[2]!;
    const inner = room.slot.rect;
    const nx = alongX ? (tc[0]! < (inner.x0 + inner.x1) / 2 ? 1 : -1) : 0, nz = alongX ? 0 : (tc[2]! < (inner.z0 + inner.z1) / 2 ? 1 : -1);
    const back = [tc[0]! + nx * 2.6, 0, tc[2]! + nz * 2.6];
    const sim = new Sim(room.floor, { tuning: tt });
    sim.teleport(0, [home[0] + (room.inside[0] - home[0]) * 0.6, 0.02, home[2] + (room.inside[2] - home[2]) * 0.6], 0);
    for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
    board(sim, home);
    let first = -1;
    for (let k = 0; k < 6 && !sim.outputOf(e.id, 'broke'); k++) {
      assert.ok(rollTo(sim, e.id, back, 20, 0.4), `${tag}: 下がる`);
      // 止まるまで待つ（後ろへ押して止める）
      for (let i = 0; i < 120; i++) {
        const v = sim.stateOf(e.id)!.vel as number[];
        if (Math.hypot(v[0]!, v[2]!) < 0.2) break;
        sim.step([{ ...IDLE_COMMAND, yaw: Math.atan2(v[0]!, v[2]!), moveY: 1 }]);
      }
      // 薄い所の真ん中へ向かって押す
      for (let i = 0; i < 120; i++) {
        const b = sim.stateOf(e.id)!.pos as number[];
        sim.step([{ ...IDLE_COMMAND, yaw: Math.atan2(-(tc[0]! - b[0]!), -(tc[2]! - b[2]!)), moveY: 1 }]);
        if (Math.abs((b[0]! - tc[0]!) * nx + (b[2]! - tc[2]!) * nz) < R + 0.15) break;
      }
      for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
      if (first < 0) first = sim.outputOf(e.id, 'hits');
    }
    assert.ok(first >= 1 && first < 3, `${tag}: 1 回ぶつかっただけでは割れない（${first}）`);
    assert.equal(sim.outputOf(e.id, 'broke'), 1, `${tag}: 何度もぶつかると割れる（${sim.outputOf(e.id, 'hits')} 回）`);
  }
});

test('球に乗る部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  await loadRapier();
  const list = findRooms('ballRide', 2, { maxWorld: 900 });
  assert.ok(list.length >= 1, `見つかった部屋 ${list.length}`);
  for (const room of list) {
    const res = await walkThrough(room, 220);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
  }
});
