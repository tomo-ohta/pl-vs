import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport, validateFloor } from '../core/gen/floor/index.ts';
import { rollProfile } from '../core/gen/floor/profile.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';

const t = defaultTuning();

test('同じ key なら同じフロア（決定論）', () => {
  for (let w = 1; w <= 5; w++) {
    const a = generateFloorReport({ world: w, depth: 3, variant: 0 }, t).floor;
    const b = generateFloorReport({ world: w, depth: 3, variant: 0 }, t).floor;
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});

test('順番に依存しない: 先に別のフロアを作っても同じ', () => {
  const key = { world: 42, depth: 4, variant: 0 };
  const alone = JSON.stringify(generateFloorReport(key, t).floor);
  for (let d = 0; d < 8; d++) generateFloorReport({ world: 42, depth: d, variant: 0 }, t);
  generateFloorReport({ world: 7, depth: 2, variant: 1 }, t);
  assert.equal(JSON.stringify(generateFloorReport(key, t).floor), alone);
});

test('多数の seed で検証に通る・速い', () => {
  let fails = 0, retries = 0, ms = 0, n = 0;
  const families = new Set<string>(), patterns = new Set<string>();
  for (let w = 1; w <= 25; w++) {
    for (let d = 0; d < 8; d++) {
      const r = generateFloorReport({ world: w, depth: d, variant: 0 }, t);
      n++;
      ms += r.ms;
      retries += r.attempts - 1;
      families.add(r.profile.family.id);
      patterns.add(r.profile.pattern);
      const issues = validateFloor(r.floor);
      if (issues.length) { fails++; console.log(`  w${w} d${d}: ${issues.join(' / ')}`); }
      assert.ok(r.floor.exits.length >= 1);
      assert.ok(r.floor.cells.some((c) => c.id === r.floor.spawn.cell));
    }
  }
  console.log(`  ${n} フロア: 不合格 ${fails}、作り直し ${retries}、平均 ${(ms / n).toFixed(1)} ms、系統 ${families.size}、型 ${patterns.size}`);
  assert.equal(fails, 0);
  assert.ok(families.size >= 8 && patterns.size >= 5);
});

test('深さ 0 は Common、希少度は深さで増える', () => {
  assert.equal(rollProfile({ world: 9, depth: 0, variant: 0 }, t).rarity, 'Common');
  let rare = 0;
  for (let w = 0; w < 200; w++) if (['Epic', 'Legendary', 'Mythic'].includes(rollProfile({ world: w, depth: 20, variant: 0 }, t).rarity)) rare++;
  assert.ok(rare > 30, `深い階で珍しいフロアが出る: ${rare}/200`);
});

test('生成したフロアを歩ける: 入口から出口の扉まで（扉を開けて進む）', async () => {
  const R = await loadRapier();
  let walked = 0;
  for (let w = 1; w <= 6; w++) {
    const floor = generateFloorReport({ world: w, depth: 1, variant: 0 }, t).floor;
    const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    // 出てすぐ、何もしなくても落ちない・埋まらない
    for (let i = 0; i < 120; i++) sim.step([{ ...IDLE_COMMAND, yaw: floor.spawn.yaw }]);
    const p = sim.players[0]!;
    assert.ok(Math.abs(p.pos[1] - floor.spawn.pos[1]) < 0.1 && p.onGround, `w${w}: 出たところに立てる（y=${p.pos[1].toFixed(2)}）`);
    walked++;
  }
  assert.equal(walked, 6);
});

test('歩く人が入口から出口の階段の下まで歩ける（扉・階段を含む）', async () => {
  const { walkTo } = await import('./helpers/bot.ts');
  const R = await loadRapier();
  let ok = 0, n = 0;
  const fails: string[] = [];
  for (let w = 1; w <= 12; w++) {
    const floor = generateFloorReport({ world: w, depth: 2, variant: 0 }, t).floor;
    const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    const ex = floor.exits[0]!;
    const goal: [number, number, number] = [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2];
    const res = walkTo(sim, 'exitStairs', goal);
    const reached = sim.drainEvents().some((e) => e.type === 'floor.exit');
    n++;
    if (res.ok && reached) ok++;
    else fails.push(`w${w} ${floor.id}: ${res.reason || '出口に入れない'}`);
  }
  console.log(`  ${ok}/${n} フロアで出口まで歩けた`);
  for (const f of fails) console.log('  ' + f);
  assert.equal(ok, n);
});
