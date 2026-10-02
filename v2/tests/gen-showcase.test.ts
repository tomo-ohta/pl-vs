import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { BSIDE_TONES } from '../core/gen/floor/bside.ts';
import { showcaseFloor, STAGE3_GIMMICKS } from '../core/gen/floor/showcase.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout } from '../core/world/layout.ts';

const t = defaultTuning();
/** 形 = 区画の足跡と床の高さ（天井の高さは部屋まるごとの異変 vast が上げることがあるので見ない） */
const shape = (f: FloorLayout): string => f.cells.filter((c) => c.role !== 'secret').map((c) => `${c.id}:${c.bounds.min.join(',')}:${c.bounds.max[0]},${c.bounds.max[2]}`).join('|');

test('裏のフロア: 表と同じ形・中身と調子は裏の seed で決まる（決定的）', () => {
  const tones = new Set<string>();
  let differ = 0;
  for (let w = 1; w <= 40; w++) {
    const d = 1 + (w % 6);
    const a = generateFloorReport({ world: w, depth: d, variant: 0 }, t);
    const b = generateFloorReport({ world: w, depth: d, variant: 1 }, t);
    assert.equal(shape(b.floor), shape(a.floor), `w${w}: 表と同じ形`);
    assert.equal(b.floor.id, `${d}.1`);
    assert.ok(b.tone && BSIDE_TONES.some((x) => x.id === b.tone));
    assert.ok(b.attempts < t['floor.genRetries'] || !b.issues.length, `w${w}: 裏のフロアが検証に通る`);
    assert.equal(JSON.stringify(generateFloorReport({ world: w, depth: d, variant: 1 }, t).floor), JSON.stringify(b.floor), `w${w}: 決定的`);
    tones.add(b.tone!);
    if (JSON.stringify(a.gimmicks?.gimmicks.map((g) => g.def)) !== JSON.stringify(b.gimmicks?.gimmicks.map((g) => g.def))) differ++;
  }
  assert.ok(tones.size >= 3, `調子が偏らない: ${[...tones].join(', ')}`);
  assert.ok(differ >= 30, `仕掛けは表と違う: ${differ}/40`);
});

test('見本のフロア: 仕掛けを全種置き、見て回る位置はどれも床の上', async () => {
  const R = await loadRapier();
  // 見本のフロア（?showcase=1 / 2）は段階 3 の仕掛け 14 種。段階 4 の仕掛けは ?try / ?group で見る
  const all = [...STAGE3_GIMMICKS];
  const modesBy: string[][] = [];
  for (const flip of [false, true]) {
    const r = showcaseFloor(t, { flip });
    const g = r.gimmicks!;
    assert.deepEqual(new Set(g.gimmicks.map((x) => x.def)), new Set(all), '全種');
    assert.equal(g.tour.length, g.gimmicks.length + g.secrets.filter((s) => s.hook === 'generic.darkCorner').length + r.anomalies.length);
    const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (const s of g.tour) {
      sim.teleport(0, s.pos, s.yaw);
      for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND, yaw: s.yaw, pitch: 0 }]);
      const p = sim.players[0]!;
      assert.ok(p.onGround && Math.hypot(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]) < 0.05, `${s.label}（${s.cell}）: 立てる`);
    }
    modesBy.push(g.secrets.filter((s) => s.hook === 'tilt.clearProps' || s.hook === 'light.ignore').map((s) => `${s.hook}:${s.mode}`));
  }
  // 型を選べる隠しは、flip で型が入れ替わる（1 と 2 で両方の型を見られる）
  assert.ok(modesBy[0]!.length >= 1);
  assert.notDeepEqual(modesBy[0], modesBy[1], `${modesBy[0]!.join(',')} / ${modesBy[1]!.join(',')}`);
});
