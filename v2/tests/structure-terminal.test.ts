// 駅の線の終わりの駅: 車両は終点で止まったまま（扉は開いたまま・走らない）。乗っても、駅でない次のフロアのふつうの入口へは行かない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { isStation, stationContinues } from '../core/gen/floor/profile.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';

test('駅の線の終わりの駅: 車両は走らず、車両の出口が無い。途中の駅の車両は次の駅へ', () => {
  const t = defaultTuning();
  let ends = 0, mids = 0;
  for (let w = 1; w <= 80 && (ends < 3 || mids < 3); w++) {
    for (let d = 1; d <= 12; d++) {
      if (!isStation(w, d, t)) continue;
      const f = generateFloorReport({ world: w, depth: d, variant: 0 }, t).floor;
      const ride = f.entities.find((e) => e.type === 'trainRide');
      if (!ride) continue;
      if (stationContinues(w, d, t)) {
        mids++;
        assert.ok(f.exits.some((x) => x.id === 'train'), `w${w} d${d}: 途中の駅は車両で次の駅へ`);
        continue;
      }
      ends++;
      assert.equal(ride.params.terminal, true, `w${w} d${d}: 終点`);
      assert.ok(!f.exits.some((x) => x.id === 'train'), `w${w} d${d}: 終点の車両の出口は無い`);
      // 終点の表示は車両の外の面の前（車体の箱に埋まっていない）
      const q = ride.params.sign as number[];
      assert.ok(!f.cells.flatMap((c) => c.boxes).some((b) => b.solid !== false && q.every((v, i) => v > b.min[i]! + 0.005 && v < b.max[i]! - 0.005)), `w${w} d${d}: 終点の表示が車体に埋まっていない`);
      // 乗っても走らない（扉は開いたまま）
      const sim = new Sim(f, { tuning: t });
      const a = ride.params.aabb as { min: number[]; max: number[] };
      sim.teleport(0, [(a.min[0]! + a.max[0]!) / 2, a.min[1]! + 0.12, (a.min[2]! + a.max[2]!) / 2], 0);
      for (let i = 0; i < 60 * 20; i++) sim.step([{ ...IDLE_COMMAND }]);
      assert.equal(sim.outputOf(ride.id, 'riding'), 0, `w${w} d${d}: 走らない`);
      assert.equal(sim.outputOf(ride.id, 'open'), 1, `w${w} d${d}: 扉は開いたまま`);
    }
  }
  assert.ok(ends >= 3 && mids >= 3, `終点 ${ends}・途中 ${mids}`);
});
