// エレベーターで着いたフロア（GenOptions.arrival 'lift'。core/gen/floor/arrival.ts）: 入口の階段の手前がかごになり、
// かごの中から始まり、引き戸が開いて歩いて出られる。かご以外（区画・開口）はふつうに着いたときと同じ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';

test('エレベーターで着いたフロア: かごの中から始まり、引き戸が開いて出られる・ほかの区画は同じ', async () => {
  const t = defaultTuning();
  const R = await loadRapier();
  let n = 0;
  for (let w = 1; w <= 24; w++) {
    const key = { world: w, depth: 1 + (w % 9), variant: 0 };
    const r = generateFloorReport(key, t, { dress: dressCell, arrival: 'lift' });
    const plain = generateFloorReport(key, t, { dress: dressCell }).floor;
    assert.deepEqual(r.floor.cells.map((c) => c.id), plain.cells.map((c) => c.id), `w${w}: 区画は同じ`);
    assert.deepEqual(r.floor.portals.map((p) => p.id), plain.portals.map((p) => p.id), `w${w}: 開口は同じ`);
    if (r.floor.spawn.cell !== 'entryStairs') continue;
    n++;
    const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.equal(sim.outputOf('arrival:door', 'open'), 1, `w${w}: 引き戸が開く`);
    for (let i = 0; i < 180; i++) sim.step([{ ...IDLE_COMMAND, yaw: r.floor.spawn.yaw, moveY: 1 }]);
    const fp = r.floor.cells.find((c) => c.id === 'entryStairs')!.footprint[0]!;
    assert.ok(sim.players[0]!.pos[2] < fp.z0 - 0.5, `w${w}: かごから出られる`);
    sim.physics?.dispose();
  }
  assert.ok(n >= 15, `入口の階段のあるフロア ${n}`);
});
