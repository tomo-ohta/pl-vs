import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { labFloor } from '../core/lab/lab.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import type { FloorLayout } from '../core/world/layout.ts';

const tuning = defaultTuning();

async function makeSim(floor: FloorLayout = labFloor(7)): Promise<Sim> {
  const R = await loadRapier();
  return new Sim(floor, { tuning, physics: new PhysicsWorld(R, 1 / tuning['physics.tickHz']) });
}

const cmd = (o: Partial<InputCommand> = {}): InputCommand => ({ ...IDLE_COMMAND, ...o });
function run(sim: Sim, sec: number, c: InputCommand | ((t: number) => InputCommand)): void {
  const n = Math.round(sec / sim.dt);
  for (let i = 0; i < n; i++) sim.step([typeof c === 'function' ? c(i * sim.dt) : c]);
}
const teleport = (sim: Sim, x: number, y: number, z: number, yaw = 0): void => {
  const p = sim.players[0]!;
  p.pos = [x, y, z]; p.vel = [0, 0, 0]; p.yaw = yaw; p.onGround = false;
};

test('歩いて閉じた扉で止まり、調べると開いて通れる', async () => {
  const sim = await makeSim();
  run(sim, 4, cmd({ moveY: 1 }));
  const p = sim.players[0]!;
  assert.ok(p.pos[2] > -10 + 0.3 && p.pos[2] < -8.5, `扉の手前で止まる: z=${p.pos[2].toFixed(2)}`);
  assert.equal(sim.outputOf('door1', 'open'), 0);
  // 扉の方（-Z）を見て調べる
  sim.step([cmd({ interact: { yaw: 0, pitch: 0 } })]);
  run(sim, 1, cmd());
  assert.equal(sim.outputOf('door1', 'open'), 1, '扉が開く');
  run(sim, 2, cmd({ moveY: 1 }));
  assert.ok(sim.players[0]!.pos[2] < -10.5, `扉を通れる: z=${sim.players[0]!.pos[2].toFixed(2)}`);
  sim.drainEvents();
});

test('ボタンで別の扉が開く（配線）', async () => {
  const sim = await makeSim();
  teleport(sim, 7.0, 0.05, -15.82, -Math.PI / 2); // 東の壁（+X）を向く（動く歩道の外）
  run(sim, 0.5, cmd({ yaw: -Math.PI / 2 }));
  assert.equal(sim.outputOf('door2', 'open'), 0);
  sim.step([cmd({ yaw: -Math.PI / 2, interact: { yaw: -Math.PI / 2, pitch: -0.25 } })]);
  assert.equal(sim.outputOf('button1', 'on'), 1, 'ボタンが入る');
  run(sim, 1, cmd({ yaw: -Math.PI / 2 }));
  assert.equal(sim.outputOf('door2', 'open'), 1, '扉 2 が開く');
});

test('立ち止まると奥の照明がつく', async () => {
  const sim = await makeSim();
  teleport(sim, 0, 0.05, -15.6);
  run(sim, 0.8, cmd());
  assert.equal(sim.outputOf('lampB', 'on'), 0);
  run(sim, 1.5, cmd());
  assert.equal(sim.outputOf('pad1', 'done'), 1);
  assert.equal(sim.outputOf('lampB', 'on'), 1);
});

test('昇降台に乗ると持ち上がる', async () => {
  const sim = await makeSim();
  teleport(sim, 3, 0.3, -15);
  run(sim, 4.5, cmd());
  assert.ok(sim.players[0]!.pos[1] > 1.2, `持ち上がる: y=${sim.players[0]!.pos[1].toFixed(2)}`);
});

test('動く歩道で押し流される', async () => {
  const sim = await makeSim();
  teleport(sim, 5.6, 0.05, -12);
  run(sim, 2, cmd());
  assert.ok(sim.players[0]!.pos[2] < -13.5, `奥へ流される: z=${sim.players[0]!.pos[2].toFixed(2)}`);
});

test('傾く床に乗ると立ち位置の方へ傾き、箱が転がる', async () => {
  const sim = await makeSim();
  run(sim, 1.5, cmd()); // 箱が落ち着く
  const before = (sim.stateOf('pile1')!.poses as number[]).slice();
  teleport(sim, -6.6, 0.3, -21.5);
  run(sim, 3, cmd());
  assert.equal(sim.players[0]!.surfaceId, 'tilt1:top', '傾く床の面に立っている');
  assert.ok(sim.outputOf('tilt1', 'gx') < -0.1, `-X 側へ傾く: gx=${sim.outputOf('tilt1', 'gx').toFixed(3)}`);
  const after = sim.stateOf('pile1')!.poses as number[];
  let movedX = 0;
  for (let i = 0; i < after.length; i += 7) movedX += after[i]! - before[i]!;
  assert.ok(movedX < -1, `箱が -X へ転がる: 合計 ${movedX.toFixed(2)} m`);
});

test('出現型の隠し: 現れたら壁の当たり判定が消える', async () => {
  const floor = labFloor(3);
  // 箱をどかす代わりに、reveal を常に入る入力へつなぎ替える
  floor.entities.push({ id: 'always', type: 'constant', params: { value: 1 } });
  const r = floor.entities.find((e) => e.id === 'reveal1')!;
  r.inputs = { show: 'always.out' };
  const sim = await makeSim(floor);
  assert.ok(sim.colliders.pointBlocked(-7.95, 1, -21), '最初は壁がある');
  sim.step([cmd()]);
  sim.step([cmd()]);
  assert.ok(sim.isRevealed('secretWall'));
  assert.ok(!sim.colliders.pointBlocked(-7.95, 1, -21), '壁が消える');
  assert.ok(sim.drainEvents().some((e) => e.type === 'reveal'));
});

test('決定論: 同じ操作なら同じ状態（物理も含む）', async () => {
  const script = (t: number): InputCommand => cmd({ moveY: t < 3 ? 1 : 0, moveX: Math.sin(t) * 0.3, yaw: Math.sin(t * 0.5) * 0.4, interact: Math.abs(t - 3.5) < 0.01 ? { yaw: 0, pitch: 0 } : null });
  const a = await makeSim(labFloor(11));
  const b = await makeSim(labFloor(11));
  run(a, 6, script);
  run(b, 6, script);
  assert.equal(a.stateHash(), b.stateHash());
});

test('隠し発見: 誰も触らなければ現れない / 傾け続けると現れる', async () => {
  const idle = await makeSim(labFloor(5));
  teleport(idle, 0, 0.05, -12);
  run(idle, 20, cmd());
  assert.ok(idle.outputOf('count1', 'ratio') > 0.85, `触らなければ物は残る: ${idle.outputOf('count1', 'ratio').toFixed(2)}`);
  assert.ok(!idle.isRevealed('secretWall'));

  const sim = await makeSim(labFloor(5));
  run(sim, 1.5, cmd());
  teleport(sim, -1.6, 0.3, -21.5); // 東の端に立ち続ける → 東へ傾く → 物が西の端から東へ転がる
  let at = -1;
  for (let i = 0; i < 40 * 60 && at < 0; i++) { sim.step([cmd()]); if (sim.isRevealed('secretWall')) at = i / 60; }
  assert.ok(at > 0, `傾け続けると現れる（西の端の物の割合 ${sim.outputOf('count1', 'ratio').toFixed(2)}）`);
  console.log(`  隠しが現れるまで ${at.toFixed(1)} 秒`);
});
