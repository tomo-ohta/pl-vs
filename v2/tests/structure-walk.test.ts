/**
 * フロアの形の型ごとに、入口から出口まで歩ける（段階 4・フロアの形の担当）。
 * - 家具あり・仕掛けなし: どの型も、表と裏のフロアで必ず歩ける（形のせいで歩けない所が無い）
 * - 家具あり・仕掛けあり: ほとんど歩ける（歩く人が解けない仕掛けがあるので、全部とは言わない。形の試験ではない）
 * 歩く人（tests/helpers/bot.ts）は、スイッチで開く扉を開いたままにして歩く（スイッチは探さない）。乗り物の扉はそのまま
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { PATTERN_INFO, type PatternId } from '../core/gen/floor/themes.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();
const ALL = Object.keys(PATTERN_INFO) as PatternId[];

function exitWalk(r: GenReport, R: Awaited<ReturnType<typeof loadRapier>>): { ok: boolean; reason: string } {
  const floor = r.floor;
  const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
  // スイッチで開く扉は開いたまま（エレベーター・車両の扉は除く: 乗り物の部品が開け閉めする）
  const rides = new Set(floor.entities.filter((e) => e.type === 'shaftLift' || e.type === 'trainRide').map((e) => e.id));
  const wired = floor.entities.filter((e) => e.type === 'door' && e.inputs?.open && !rides.has(String(e.inputs.open).split('.')[0]!)).map((e) => e.id);
  const step = sim.step.bind(sim);
  (sim as unknown as { step: typeof sim.step }).step = (c) => {
    for (const id of wired) { const st = sim.stateOf(id) as { angle: number; target: number }; st.angle = 1; st.target = 1; }
    step(c);
  };
  const ex = floor.exits.find((e) => e.id === 'down')!;
  const goal: [number, number, number] = [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2];
  const res = walkTo(sim, 'exitStairs', goal, 400);
  const reached = sim.drainEvents().some((e) => e.type === 'floor.exit');
  sim.physics?.dispose();
  return { ok: res.ok && reached, reason: res.reason || '出口に入れない' };
}

test('どの型も、仕掛けの無いフロアを入口から出口まで歩ける（家具あり・表と裏）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  for (const p of ALL) {
    for (let w = 1; w <= 3; w++) {
      const key = { world: w, depth: 2 + (w % 6), variant: w === 3 ? 1 : 0 };
      const r = generateFloorReport(key, t, { dress: dressCell, shape: p, noGimmicks: true });
      n++;
      const res = exitWalk(r, R);
      if (!res.ok) fails.push(`${p} w${w} ${r.floor.id}: ${res.reason}`);
    }
  }
  assert.deepEqual(fails, [], `${fails.length}/${n} のフロアで出口まで歩けない`);
});

test('仕掛けのあるフロアも、ほとんど入口から出口まで歩ける（9 割以上。歩けないのは仕掛けの区画）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  for (const p of ALL) {
    for (let w = 4; w <= 5; w++) {
      const r = generateFloorReport({ world: w, depth: 2 + (w % 6), variant: 0 }, t, { dress: dressCell, shape: p });
      n++;
      const res = exitWalk(r, R);
      if (!res.ok) fails.push(`${p} w${w} ${r.floor.id}: ${res.reason}（仕掛け ${r.gimmicks?.gimmicks.map((g) => `${g.def}@${g.cell}`).join(' ')}）`);
    }
  }
  if (fails.length) console.log(`  歩けなかったフロア:\n  ${fails.join('\n  ')}`);
  assert.ok(fails.length <= Math.floor(n * 0.1), `${fails.length}/${n} のフロアで出口まで歩けない`);
});
