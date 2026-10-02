/**
 * 吹き抜けを渡る部屋（atrium）: ロープ渡り・ジップライン・台車・ゴンドラ。どの変種も、乗らずに穴の底の階段で歩いて渡れる・
 * 底から入口へ戻れる。乗り物は調べて乗り、向こう岸（または底の出口の階段の下）へ運ぶ。生成したフロアに出る・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning, type Tuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const VARIANTS = ['rope', 'zip', 'cart', 'gondola'] as const;
const only = (v: (typeof VARIANTS)[number]): Tuning => makeTuning(Object.fromEntries(VARIANTS.map((k) => [`move.atrium.w.${k}`, k === v ? 1 : 0]))).tuning;
const SIZES = [{ w: 5.6, d: 9.5, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

function rooms(tt: Tuning): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom('atrium', { ...size, ...dims, height: 3.0, entry, exit: ((entry + 2) % 4) as Dir, seed: seed * 5 + entry, entryAt: seed === 1 ? 0.5 : 0.42, exitAt: 0.5, t: tt });
    if (room) out.push({ room, tag: `${size.kind} 入口${entry} seed${seed}` });
  }
  return out;
}

/** 部品の調べられる所を見て調べる */
function interact(sim: Sim, at: Readonly<Vec3>): void {
  const p = sim.players[0]!;
  const ex = at[0] - p.pos[0], ez = at[2] - p.pos[2], ey = at[1] - (p.pos[1] + p.eye);
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
}

for (const v of VARIANTS) {
  test(`吹き抜け（${v}・実験室）: 乗らずに入口から出口へ歩いて渡れる・穴の底から入口へ戻れる`, () => {
    const tt = only(v);
    const list = rooms(tt).filter(({ room }) => room.floor.entities.some((e) => (v === 'gondola' ? e.type === 'cableCar' : e.type === 'pathRide' && e.params.mode === v)));
    assert.ok(list.length >= 6, `組めた ${list.length}`);
    const fails: string[] = [];
    for (const { room, tag } of list) {
      const sim = new Sim(room.floor, { tuning: tt });
      sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const res = walkTo(sim, 'room', room.exitInside!, 150);
      if (!res.ok) fails.push(`${tag}: 渡れない ${res.reason}`);
      const bottom = Math.min(...room.cell.boxes.filter((b) => b.solid && b.max[1] < -1).map((b) => b.max[1]));
      const b = new Sim(room.floor, { tuning: tt });
      b.teleport(0, [(room.inside[0] + room.exitInside![0]) / 2 + 0.3, bottom + 0.05, (room.inside[2] + room.exitInside![2]) / 2 + 0.3], 0);
      for (let i = 0; i < 20; i++) b.step([{ ...IDLE_COMMAND }]);
      const r2 = walkTo(b, 'room', room.inside, 120);
      if (!r2.ok || Math.abs(b.players[0]!.pos[1]) > 0.1) fails.push(`${tag}: 底から入口へ戻れない ${r2.reason}`);
    }
    assert.deepEqual(fails, []);
  });
}

test('ロープ渡り: 端で調べてつかまり、前へ押すとゆっくり向こう岸へ。跳ぶと手を離して落ちる', () => {
  const tt = only('rope');
  const room = rooms(tt)[0]!.room;
  const e = room.floor.entities.find((x) => x.type === 'pathRide')!;
  const path = e.params.path as number[][];
  const start = e.params.startAt as Vec3, end = e.params.endAt as Vec3;
  const sim = new Sim(room.floor, { tuning: tt });
  sim.teleport(0, [start[0], 0.02, start[2]], 0);
  for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
  interact(sim, path[0] as Vec3);
  assert.equal(sim.outputOf(e.id, 'riding'), 1, 'つかまった');
  const yaw = Math.atan2(-(path[1]![0]! - path[0]![0]!), -(path[1]![2]! - path[0]![2]!));
  const len = Math.hypot(path[1]![0]! - path[0]![0]!, path[1]![2]! - path[0]![2]!);
  let ticks = 0;
  for (; ticks < 60 * 20 && sim.outputOf(e.id, 'riding'); ticks++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
  const p = sim.players[0]!;
  assert.ok(!sim.outputOf(e.id, 'riding') && Math.hypot(p.pos[0] - end[0], p.pos[2] - end[2]) < 0.2 && Math.abs(p.pos[1] - end[1]) < 0.05, `向こう岸へ（${p.pos.map((x) => x.toFixed(2))}）`);
  assert.ok(ticks / 60 > len / (tt['move.atrium.ropeSpeed'] + 0.01), `ゆっくり（${(ticks / 60).toFixed(1)} 秒）`);
  // 途中で跳ぶと落ちる
  const s2 = new Sim(room.floor, { tuning: tt });
  s2.teleport(0, [start[0], 0.02, start[2]], 0);
  for (let i = 0; i < 5; i++) s2.step([{ ...IDLE_COMMAND }]);
  interact(s2, path[0] as Vec3);
  for (let i = 0; i < 120; i++) s2.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
  s2.step([{ ...IDLE_COMMAND, yaw, jump: true }]);
  for (let i = 0; i < 90; i++) s2.step([{ ...IDLE_COMMAND, yaw }]);
  assert.ok(s2.players[0]!.pos[1] < -1.5 && !s2.players[0]!.ride, `落ちる（${s2.players[0]!.pos[1].toFixed(2)}）`);
});

for (const v of ['zip', 'cart'] as const) {
  test(`${v === 'zip' ? 'ジップライン' : '台車'}: 始まりで調べて乗ると、終わりまで運ばれて降りる。誰もいないと始まりへ戻る`, () => {
    const tt = only(v);
    const room = rooms(tt).find(({ room }) => room.floor.entities.some((e) => e.type === 'pathRide' && e.params.mode === v))!.room;
    const e = room.floor.entities.find((x) => x.type === 'pathRide')!;
    const path = e.params.path as number[][];
    const foot = e.params.foot as number[];
    const sim = new Sim(room.floor, { tuning: tt });
    const a = path[0]!;
    // 乗り場の床（取っ手・台車の手前）
    const dir = [path[1]![0]! - a[0]!, path[1]![2]! - a[2]!];
    const dl = Math.hypot(dir[0]!, dir[1]!);
    sim.teleport(0, [a[0]! - (dir[0]! / dl) * 0.9, 0.02, a[2]! - (dir[1]! / dl) * 0.9], 0);
    for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
    interact(sim, [a[0]!, a[1]! + (v === 'cart' ? 0.4 : -0.1), a[2]!]);
    assert.equal(sim.outputOf(e.id, 'riding'), 1, '乗った');
    let ticks = 0, vmax = 0;
    for (; ticks < 60 * 15 && sim.outputOf(e.id, 'riding'); ticks++) { sim.step([{ ...IDLE_COMMAND }]); vmax = Math.max(vmax, sim.outputOf(e.id, 'v')); }
    const last = path[path.length - 1]!;
    for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND }]);
    const p = sim.players[0]!;
    assert.ok(Math.hypot(p.pos[0] - last[0]!, p.pos[2] - last[2]!) < 1.5 && Math.abs(p.pos[1] - (v === 'zip' ? last[1]! + foot[1]! : last[1]!)) < 0.1, `終わりへ（${p.pos.map((x) => x.toFixed(2))}）`);
    assert.ok(vmax > 3, `速い（${vmax.toFixed(1)} m/s）`);
    // 離れると、しばらくで始まりへ戻る
    for (let i = 0; i < 60 * 14; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(sim.outputOf(e.id, 's') < 0.05, `始まりへ戻る（${sim.outputOf(e.id, 's').toFixed(2)}）`);
  });
}

test('ゴンドラ: 乗り場で箱に乗っていると、向こうの乗り場へ運ばれる。動いている間は箱が回る', () => {
  const tt = only('gondola');
  const room = rooms(tt).find(({ room }) => room.floor.entities.some((e) => e.type === 'cableCar'))!.room;
  const e = room.floor.entities.find((x) => x.type === 'cableCar')!;
  const a = e.params.a as number[], b = e.params.b as number[];
  const sim = new Sim(room.floor, { tuning: tt });
  sim.teleport(0, [a[0]! + 0.25, 0.02, a[2]! + 0.1], 0);
  let maxAngle = 0;
  const wait = tt['move.atrium.carWait'];
  for (let i = 0; i < 60 * (wait + 0.5); i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.equal(sim.outputOf(e.id, 'moving'), 1, '動き出す');
  for (let i = 0; i < 60 * 20 && sim.outputOf(e.id, 'moving'); i++) { sim.step([{ ...IDLE_COMMAND }]); maxAngle = Math.max(maxAngle, sim.outputOf(e.id, 'angle')); }
  const p = sim.players[0]!;
  assert.ok(Math.hypot(p.pos[0] - b[0]!, p.pos[2] - b[2]!) < 0.7 && Math.abs(p.pos[1] - b[1]!) < 0.05, `向こうの乗り場へ（${p.pos.map((x) => x.toFixed(2))}）`);
  assert.ok(maxAngle > 3, `回る（${maxAngle.toFixed(2)} rad）`);
  // 降りて出口の床へ
  const res = walkTo(sim, 'room', room.exitInside!, 30);
  assert.ok(res.ok, res.reason);
});

test('吹き抜け: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  await loadRapier();
  const list = findRooms('atrium', 3, { maxWorld: 900 });
  assert.ok(list.length >= 1, `見つかった部屋 ${list.length}`);
  for (const room of list) {
    const res = await walkThrough(room, 220);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
  }
  void defaultTuning;
});
