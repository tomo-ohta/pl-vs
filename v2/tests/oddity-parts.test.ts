// 段階 4・oddity の部品（core/sim/parts/oddity/room.ts）: 部屋にいる時間・部屋の中だけ進む時刻・足跡・触れる・寄せる波
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import '../core/sim/parts/index.ts';
import { sunLevel } from '../core/sim/parts/oddity/room.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import { makeCell } from '../core/world/build.ts';
import type { EntitySpec, FloorLayout } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

const t = defaultTuning();

/** 10 × 10 m の 1 部屋（床 0）と部品 */
function lab(entities: EntitySpec[]): FloorLayout {
  const cell = makeCell({ id: 'room', role: 'lab', rects: [{ x0: 0, z0: 0, x1: 10, z1: 10 }], height: 3, palette: themePalette('GenericRoom') });
  return {
    id: 'oddity-lab', seed: 7, genVersion: 'test', tuningVersion: 'test', bounds: { min: [0, -3, 0], max: [10, 3.2, 10] },
    cells: [cell], portals: [], entities, surfaces: [], spawn: { pos: [1, 0.02, 1], yaw: 0, cell: 'room' }, exits: [],
  };
}

const ROOM = { min: [4, -0.1, 4], max: [8, 3, 8] };
const cmd = (o: Partial<InputCommand> = {}): InputCommand => ({ ...IDLE_COMMAND, ...o });
const run = (sim: Sim, sec: number, c: InputCommand = cmd()): void => { for (let i = 0; i < Math.round(sec / sim.dt); i++) sim.step([c]); };

test('oddRoom: 部屋にいる間だけ in・今回の秒数・合計の秒数が進む', () => {
  const sim = new Sim(lab([{ id: 'r', type: 'oddRoom', params: { aabb: ROOM, fx: [] } }]), { tuning: t });
  run(sim, 1);
  assert.equal(sim.outputOf('r', 'in'), 0);
  sim.teleport(0, [6, 0.02, 6], 0);
  run(sim, 2);
  assert.equal(sim.outputOf('r', 'in'), 1);
  assert.ok(Math.abs(sim.outputOf('r', 'sec') - 2) < 0.05);
  sim.teleport(0, [1, 0.02, 1], 0);
  run(sim, 1);
  assert.equal(sim.outputOf('r', 'in'), 0);
  assert.equal(sim.outputOf('r', 'sec'), 0);
  sim.teleport(0, [6, 0.02, 6], 0);
  run(sim, 1);
  assert.ok(Math.abs(sim.outputOf('r', 'total') - 3) < 0.05, `合計 ${sim.outputOf('r', 'total')}`);
});

test('oddClock: 時刻は部屋の中だけ進み、朝 → 昼 → 夕 → 夜。夜の灯り（oddLevel）は日が暮れると点く', () => {
  const day = 12;
  const sim = new Sim(lab([
    { id: 'c', type: 'oddClock', params: { aabb: ROOM, daySec: day, startPhase: 0 } },
    { id: 'n', type: 'oddLevel', params: {}, inputs: { in: 'c.night' } },
  ]), { tuning: t });
  run(sim, 3);
  assert.equal(sim.outputOf('c', 'phase'), 0, '部屋の外では止まっている');
  sim.teleport(0, [6, 0.02, 6], 0);
  run(sim, day * 0.25);
  assert.ok(Math.abs(sim.outputOf('c', 'phase') - 0.25) < 0.02);
  assert.ok(sim.outputOf('c', 'level') > 0.95, '昼は明るい');
  assert.equal(sim.outputOf('n', 'level'), 0, '昼は夜の灯りが消えている');
  run(sim, day * 0.5);
  assert.ok(sim.outputOf('c', 'level') < 0.05, '夜は暗い');
  assert.equal(sim.outputOf('n', 'level'), 1, '夜は夜の灯りが点く');
  // 日の明るさは連続（照明の焼き込みを混ぜるので、急に変わらない）
  for (let p = 0; p < 1; p += 0.01) assert.ok(Math.abs(sunLevel(p + 0.01) - sunLevel(p)) < 0.06, `phase ${p.toFixed(2)}`);
});

test('oddTrail: 部屋の中を歩くと歩幅ごとに左右交互の足跡が残り、上限を超えると古い物から消える', () => {
  const sim = new Sim(lab([{ id: 'tr', type: 'oddTrail', params: { aabb: { min: [0.5, -0.1, 0.5], max: [9.5, 1, 9.5] }, stride: 0.6, max: 8 } }]), { tuning: t });
  sim.teleport(0, [5, 0.02, 9], 0);
  run(sim, 0.3);
  run(sim, 1.2, cmd({ moveY: 1 }));
  const prints = (sim.stateOf('tr')!.prints as number[]);
  const n = prints.length / 4;
  assert.ok(n >= 4 && n <= 8, `足跡 ${n}`);
  for (let i = 1; i < n; i++) assert.equal(prints[i * 4 + 3], -prints[(i - 1) * 4 + 3]!, '左右交互');
  run(sim, 3, cmd({ moveY: 1 }));
  run(sim, 2, cmd({ moveY: 1, yaw: Math.PI }));
  assert.equal((sim.stateOf('tr')!.prints as number[]).length / 4, 8, '上限');
});

test('oddTouch: 調べると touched が入ったまま（隠しの出現型の条件）', () => {
  const sim = new Sim(lab([{ id: 'touch', type: 'oddTouch', params: { box: { min: [4.8, 0.7, 2.8], max: [5.2, 1.1, 3.2] } } }]), { tuning: t });
  sim.teleport(0, [5, 0.02, 4.5], 0);
  run(sim, 0.2);
  assert.equal(sim.outputOf('touch', 'touched'), 0);
  // 前（-Z）の少し下を見て調べる
  sim.step([cmd({ interact: { yaw: 0, pitch: -0.45 } })]);
  assert.equal(sim.outputOf('touch', 'touched'), 1);
  run(sim, 1);
  assert.equal(sim.outputOf('touch', 'touched'), 1, '入ったまま');
});

test('oddWaves: 寄せる間だけ浜へ押し戻す（外力のゾーン）', () => {
  const sim = new Sim(lab([{ id: 'w', type: 'oddWaves', params: { aabb: { min: [0, -0.1, 0], max: [10, 1.2, 5] }, vector: [0, 0, 1], speed: 1.2, period: 4, surge: 2 } }]), { tuning: t });
  sim.teleport(0, [5, 0.02, 2], 0);
  run(sim, 0.5);
  const z0 = sim.players[0]!.pos[2];
  run(sim, 1);
  assert.equal(sim.outputOf('w', 'push'), 1);
  assert.ok(sim.players[0]!.pos[2] > z0 + 0.6, `押し戻される ${(sim.players[0]!.pos[2] - z0).toFixed(2)} m`);
  run(sim, 1.2);
  assert.equal(sim.outputOf('w', 'push'), 0, '引いている間は押さない');
  const z1 = sim.players[0]!.pos[2];
  run(sim, 0.6);
  assert.ok(Math.abs(sim.players[0]!.pos[2] - z1) < 0.15, '引いている間は止まっていられる');
});
