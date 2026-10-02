/**
 * 足元の部屋（footingRoom）: 氷・滑る床・泥。入口から出口へ渡れる（落ちても入口から）・氷は止まれず敷物で止まる・
 * 穴に落ちると入口の前へ戻る・泥は遅く目が沈む・流砂で立ち止まると飲み込まれる・生成したフロアに出る・決定的
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
import { labRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const only = (v: 'ice' | 'wax' | 'mud') => makeTuning({ 'move.foot.w.ice': v === 'ice' ? 1 : 0, 'move.foot.w.wax': v === 'wax' ? 1 : 0, 'move.foot.w.mud': v === 'mud' ? 1 : 0 }).tuning;
const SIZES = [{ w: 6.0, d: 7.5, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

for (const v of ['ice', 'wax', 'mud'] as const) {
  test(`足元の部屋（${v}・実験室）: 入口の向き 4 つ × 出口の向き × 大きさで、入口から出口へ渡れる`, () => {
    const t = only(v);
    const fails: string[] = [];
    let built = 0;
    for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const side of [false, true]) {
      const exit = ((entry + (side ? 1 : 2)) % 4) as Dir;
      const room = labRoom('footingRoom', { ...size, entry, exit, seed: 7 + entry * 3 + (side ? 1 : 0), t });
      if (!room) continue;
      built++;
      const sim = new Sim(room.floor, { tuning: t });
      sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const res = walkTo(sim, 'room', room.exitInside!, 150);
      if (!res.ok) fails.push(`${size.kind} 入口${entry} 出口${exit}: ${res.reason}`);
    }
    assert.ok(built >= 12, `組めた ${built}`);
    assert.deepEqual(fails, []);
  });
}

test('氷: 押し出すと止まれずに滑り、敷物の上では止まる。穴に落ちると入口の前へ戻る', () => {
  const t = only('ice');
  const room = labRoom('footingRoom', { w: 6.0, d: 7.5, entry: 2, exit: 0, seed: 9, t })!;
  const sim = new Sim(room.floor, { tuning: t });
  const zones = room.cell.zones.filter((z) => z.kind === 'friction');
  assert.ok(zones.length >= 2 && zones.every((z) => Number(z.params?.friction) < 0.3));
  // 氷の上で走ってから手を離すと、しばらく滑り続ける
  const z = zones.sort((a, b) => (b.aabb.max[0] - b.aabb.min[0]) * (b.aabb.max[2] - b.aabb.min[2]) - (a.aabb.max[0] - a.aabb.min[0]) * (a.aabb.max[2] - a.aabb.min[2]))[0]!;
  const p0: [number, number, number] = [(z.aabb.min[0] + z.aabb.max[0]) / 2, 0.02, (z.aabb.min[2] + z.aabb.max[2]) / 2];
  sim.teleport(0, p0, 0);
  for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
  const pl = sim.players[0]!;
  pl.vel = [2.5, 0, 0];
  for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.ok(Math.hypot(pl.vel[0], pl.vel[2]) > 1.0, `止まれない（${pl.vel.map((x) => x.toFixed(2))}）`);
  // 敷物の上では止まる
  const mat = room.cell.boxes.find((b) => b.kind === 'footingMat')!;
  sim.teleport(0, [(mat.min[0] + mat.max[0]) / 2, 0.03, (mat.min[2] + mat.max[2]) / 2], 0);
  for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
  pl.vel = [1.0, 0, 0];
  for (let i = 0; i < 12; i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.ok(Math.hypot(pl.vel[0], pl.vel[2]) < 0.15, `敷物で止まる（${pl.vel.map((x) => x.toFixed(2))}）`);
  // 穴（冷たい水）に落ちると入口の前へ
  const back = room.floor.entities.find((e) => e.type === 'respawnZone')!;
  const a = back.params.aabb as { min: number[]; max: number[] };
  sim.teleport(0, [(a.min[0]! + a.max[0]!) / 2, 0.3, (a.min[2]! + a.max[2]!) / 2], 0);
  let respawned = false;
  for (let i = 0; i < 90 && !respawned; i++) { sim.step([{ ...IDLE_COMMAND }]); respawned = sim.drainEvents().some((e) => e.type === 'player.respawn' && e.entity === undefined && e.data?.cause === back.id); }
  assert.ok(respawned, '落ちると戻る');
  assert.ok(Math.hypot(pl.pos[0] - room.inside[0], pl.pos[2] - room.inside[2]) < 0.5, `入口の前（${pl.pos.map((x) => x.toFixed(2))}）`);
  // 隠し（存在型）: 扉の手前に薄い氷
  const offer = room.offers.find((o) => o.hook === 'ice.corner');
  if (offer) assert.deepEqual(offer.modes, ['present']);
});

test('泥: 遅く、目が沈む。板の上は普通。流砂で立ち止まると飲み込まれて入口へ、歩き続ければ平気', () => {
  const t = only('mud');
  const room = labRoom('footingRoom', { w: 6.5, d: 8.0, entry: 2, exit: 0, seed: 4, t })!;
  const mud = room.cell.zones.find((z) => z.kind === 'water' && z.params?.mud)!;
  assert.ok(mud);
  const sim = new Sim(room.floor, { tuning: t });
  const c: [number, number, number] = [(mud.aabb.min[0] + mud.aabb.max[0]) / 2, 0.02, (mud.aabb.min[2] + mud.aabb.max[2]) / 2];
  sim.teleport(0, c, 0);
  for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
  const pl = sim.players[0]!;
  assert.ok(pl.zoneSlow < 0.5 && pl.eye < 1.5, `遅く沈む（${pl.zoneSlow}・目 ${pl.eye.toFixed(2)}）`);
  const trap = room.floor.entities.find((e) => e.type === 'sinkTrap');
  assert.ok(trap, '流砂がある');
  const a = trap.params.aabb as { min: number[]; max: number[] };
  const q: [number, number, number] = [(a.min[0]! + a.max[0]!) / 2, 0.02, (a.min[2]! + a.max[2]!) / 2];
  // 歩き続ける（その場で左右に）なら飲み込まれない
  sim.teleport(0, q, 0);
  for (let i = 0; i < 240; i++) sim.step([{ ...IDLE_COMMAND, moveX: Math.floor(i / 20) % 2 ? 0.6 : -0.6 }]);
  assert.ok(!sim.drainEvents().some((e) => e.type === 'player.respawn' && e.data?.cause === trap.id), '歩き続ければ平気');
  // 立ち止まると飲み込まれる
  sim.teleport(0, q, 0);
  let eyeMin = 9, swallowed = false;
  for (let i = 0; i < 240 && !swallowed; i++) {
    sim.step([{ ...IDLE_COMMAND }]);
    eyeMin = Math.min(eyeMin, pl.eye);
    swallowed = sim.drainEvents().some((e) => e.type === 'player.respawn' && e.data?.cause === trap.id);
  }
  assert.ok(swallowed && eyeMin < 1.0, `沈んで飲み込まれる（目 ${eyeMin.toFixed(2)}）`);
});

test('足元の部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  const R = await loadRapier();
  const t = defaultTuning();
  const rooms = findRooms('footingRoom', 3, { maxWorld: 600 });
  assert.ok(rooms.length >= 2, `見つかった部屋 ${rooms.length}`);
  for (const room of rooms) {
    const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    sim.teleport(0, room.outside, room.yaw);
    const res = walkTo(sim, room.beyond ?? room.cell.id, undefined, 250);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    sim.physics?.dispose();
    assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
  }
});
