/**
 * 前の階に戻る輪（F30）: 戻るかどうかと戻り先は世界の seed と深さで決まる（決定的）・浅い階では戻らない・2〜3 階上へ・
 * おおよそ chance の割合・着く所は入口と別の部屋の扉の内側の床の上で、そこから出口まで歩ける
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { floorLoopTarget, loopSpawn } from '../core/gen/gimmicks/warp/floorLoop.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();

test('前の階に戻る輪: 決定的・浅い階では戻らない・2〜3 階上へ・おおよそ chance の割合', () => {
  let n = 0, hit = 0;
  for (let world = 1; world <= 40; world++) {
    for (let depth = 0; depth < 30; depth++) {
      const a = floorLoopTarget(world, depth, t);
      assert.equal(a, floorLoopTarget(world, depth, t), '決定的');
      if (depth < t['warp.floorLoop.minDepth']) { assert.equal(a, null); continue; }
      n++;
      if (a === null) continue;
      hit++;
      assert.ok(depth - a >= 2 && depth - a <= 3, `${world}/${depth} → ${a}`);
    }
  }
  const rate = hit / n;
  assert.ok(Math.abs(rate - t['warp.floorLoop.chance']) < 0.06, `割合 ${rate.toFixed(3)}`);
});

test('前の階に戻る輪: 着く所は入口と別の部屋の扉の内側（床の上）・そこから出口まで歩ける・決定的', async () => {
  const R = await loadRapier();
  let n = 0;
  for (let world = 1; world <= 8; world++) {
    const depth = 2 + (world % 3);
    const r = generateFloorReport({ world, depth, variant: 0 }, t, { dress: dressCell });
    const sp = loopSpawn(r.floor, world);
    assert.deepEqual(sp, loopSpawn(r.floor, world), '決定的');
    if (sp === r.floor.spawn) continue;
    n++;
    assert.notEqual(sp.cell, r.floor.spawn.cell, '入口と別の部屋');
    const cell = r.floor.cells.find((c) => c.id === sp.cell)!;
    assert.ok(!cell.pocket && cell.role !== 'secret');
    const floor = { ...r.floor, spawn: sp };
    const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND, yaw: sp.yaw }]);
    const p = sim.players[0]!;
    assert.ok(p.onGround && Math.hypot(p.pos[0] - sp.pos[0], p.pos[2] - sp.pos[2]) < 0.1, `w${world}: 着く所に立てる`);
    const ex = floor.exits.find((e) => e.id === 'down')!;
    const goal: [number, number, number] = [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2];
    const res = walkTo(sim, 'exitStairs', goal, 300);
    assert.ok(res.ok, `w${world}: 着いた所から出口へ: ${res.reason}`);
    sim.physics?.dispose();
  }
  assert.ok(n >= 6, `別の入口に着いたフロア ${n}`);
});
