/**
 * 高い所へ上がる部屋（riseHall）: 弾む床・上昇気流・はしごで、棚を 1 段ずつ上って一番上の棚まで行ける・床の通り道は普通に歩ける・
 * 一番上の棚の奥に扉（存在型）・生成したフロアに出る
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { labRoom } from './helpers/gimmick-lab.ts';
import { findRooms } from './helpers/gimmick-rooms.ts';

const only = (v: 'springs' | 'updraft' | 'ladder') => makeTuning({ 'move.rise.w.springs': v === 'springs' ? 1 : 0, 'move.rise.w.updraft': v === 'updraft' ? 1 : 0, 'move.rise.w.ladder': v === 'ladder' ? 1 : 0 }).tuning;

for (const v of ['springs', 'updraft', 'ladder'] as const) {
  test(`高い所へ上がる部屋（${v}）: 床から一番上の棚まで上れる・入口から出口へ歩ける`, () => {
    const t = only(v);
    const fails: string[] = [];
    let built = 0, multi = 0;
    for (const size of [{ w: 6.4, d: 8, height: 3.6 }, { w: 8.6, d: 12, height: 5.2 }]) for (const entry of [0, 1, 2, 3] as Dir[]) {
      const room = labRoom('riseHall', { ...size, kind: 'hall', entry, exit: ((entry + 2) % 4) as Dir, seed: 3 + entry, t });
      if (!room) continue;
      built++;
      const tops = room.cell.boxes.filter((b) => b.kind === 'landing');
      const top = tops.sort((a, b) => b.max[1] - a.max[1])[0]!;
      if (tops.length >= 2) multi++;
      const offer = room.offers.find((o) => o.hook === 'rise.top');
      assert.ok(offer && Math.abs(offer.doorway.y - top.max[1]) < 1e-6, '一番上の棚の奥に扉');
      const tag = `${size.height} m 入口${entry}`;
      // 床の通り道
      const a = new Sim(room.floor, { tuning: t });
      a.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const r1 = walkTo(a, 'room', room.exitInside!, 90);
      if (!r1.ok) fails.push(`${tag}: 出口へ ${r1.reason}`);
      // 一番上の棚へ
      const b = new Sim(room.floor, { tuning: t });
      b.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const goal: Vec3 = [(top.min[0] + top.max[0]) / 2, top.max[1], (top.min[2] + top.max[2]) / 2];
      const r2 = walkTo(b, 'room', goal, 120);
      // 着いた後、落ち着く（弾む床で跳ね上がった途中で着いたとみなされることがある）
      for (let i = 0; i < 90; i++) b.step([{ ...IDLE_COMMAND }]);
      if (!r2.ok || Math.abs(b.players[0]!.pos[1] - top.max[1]) > 0.05) fails.push(`${tag}: 一番上の棚へ ${r2.reason}（${b.players[0]!.pos.map((x) => x.toFixed(2))}）`);
    }
    assert.ok(built >= 6 && multi >= 2, `組めた ${built}（2 段以上 ${multi}）`);
    assert.deepEqual(fails, []);
  });
}

test('高い所へ上がる部屋: 生成したフロアに出て、一番上の棚まで上れる', async () => {
  const R = await loadRapier();
  const rooms = findRooms('riseHall', 2, { maxWorld: 900 });
  assert.ok(rooms.length >= 1, `見つかった部屋 ${rooms.length}`);
  for (const room of rooms) {
    const top = room.cell.boxes.filter((b) => b.kind === 'landing').sort((a, b) => b.max[1] - a.max[1])[0]!;
    const sim = new Sim(room.floor, { tuning: makeTuning({}).tuning, physics: new PhysicsWorld(R, 1 / 60) });
    sim.teleport(0, room.outside, room.yaw);
    const res = walkTo(sim, room.cell.id, [(top.min[0] + top.max[0]) / 2, top.max[1], (top.min[2] + top.max[2]) / 2], 200);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    sim.physics?.dispose();
  }
});
