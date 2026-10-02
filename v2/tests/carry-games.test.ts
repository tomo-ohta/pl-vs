/**
 * ミニゲームの手触り（実際の操作で遊べるか）: ボウリングは走りながら投げるとピンが倒れて起き直る・傾く床に立ち続けると球が転がる・
 * ゴルフの球は体で触れると蹴れて、止まると元の所へ戻る・かくれんぼの灯りは開けた所に立つと見つけ、しゃがんで木箱の陰なら見つけにくい・
 * 記憶の部屋は 10 秒で暗くなって物が散らばる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Vec3 } from '../core/math/vec.ts';
import { walkTo } from './helpers/bot.ts';
import { newSim, rooms } from './carry-cases.ts';
import { bodyFree, center, cmd, ents, goPick, run, standNear } from './carry-solvers.ts';

test('ボウリング: ファウルの線の手前から走って投げると、ピンが倒れ、しばらくで起き直る', async () => {
  const list = rooms('bowlingLane', ['none']);
  assert.ok(list.length >= 2);
  let knocked = 0;
  for (const { room } of list) {
    const sim = await newSim(room);
    const ball = ents(room, 'carryBody', (e) => e.params.kind === 'ball')[0]!;
    const setter = ents(room, 'pinSetter')[0]!;
    const pins = setter.params.pins as string[];
    run(sim, 0.5);
    if (!goPick(sim, room, ball.id)) continue;
    // レーンの手前の真ん中に立ち、ピンの方を向いて走って Q
    const pc = center(sim, pins[0]!);
    const ent = room.inside;
    const toward = Math.atan2(-(pc[0] - ent[0]), -(pc[2] - ent[2]));
    const lane: Vec3 = [pc[0] + (ent[0] - pc[0]) * 0.92, room.cell.floorY, pc[2] + (ent[2] - pc[2]) * 0.92];
    walkTo(sim, 'room', bodyFree(sim, lane) ? lane : standNear(sim, lane, room.cell.floorY, 0.3) ?? lane, 30);
    const yaw = Math.atan2(-(pc[0] - sim.players[0]!.pos[0]), -(pc[2] - sim.players[0]!.pos[2]));
    run(sim, 0.4, { yaw, moveY: 1, dash: true });
    sim.step([cmd({ yaw, moveY: 1, dash: true, drop: true })]);
    run(sim, 0.3, { yaw: toward });
    let maxDown = 0;
    for (let i = 0; i < 6 * 60; i++) { sim.step([cmd()]); maxDown = Math.max(maxDown, sim.outputOf(setter.id, 'down')); }
    if (maxDown > 0) knocked++;
    // 投げて 10 秒で起き直る（ピンは元の所）
    run(sim, 6);
    assert.equal(sim.outputOf(setter.id, 'down'), 0, '起き直る');
    sim.physics?.dispose();
  }
  assert.ok(knocked >= Math.ceil(list.length / 2), `投げてピンが倒れた: ${knocked}/${list.length}`);
});

test('傾く床（球を穴に）: 床の端に立ち続けると、そちらへ傾いて球が転がる', async () => {
  const { room } = rooms('tiltMarble', ['none'])[0]!;
  const sim = await newSim(room);
  const ball = ents(room, 'carryBody')[0]!;
  const plate = ents(room, 'tiltFloor')[0]!;
  run(sim, 1);
  const b0 = center(sim, ball.id);
  const rect = plate.params.rect as { x0: number; z0: number; x1: number; z1: number };
  // 球から遠い方の端に立つ
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2;
  const far: Vec3 = [b0[0] < cx ? rect.x1 - 0.5 : rect.x0 + 0.5, room.cell.floorY, b0[2] < cz ? rect.z1 - 0.5 : rect.z0 + 0.5];
  sim.teleport(0, [far[0], room.cell.floorY + 0.3, far[2]], 0);
  run(sim, 10);
  const b1 = center(sim, ball.id);
  assert.ok(Math.hypot(b1[0] - b0[0], b1[2] - b0[2]) > 1.0, `球が転がる: ${Math.hypot(b1[0] - b0[0], b1[2] - b0[2]).toFixed(2)} m`);
  sim.physics?.dispose();
});

test('ゴルフ: 体で触れると蹴れて転がり、止まると元の所へ戻る', async () => {
  const { room } = rooms('golfRoom', ['none'])[0]!;
  const sim = await newSim(room);
  const ball = ents(room, 'rollBall')[0]!;
  const tee = ball.params.tee as number[];
  run(sim, 0.2);
  // 球の 1.2 m 手前（入口の側）から球へ走る
  const from: Vec3 = [tee[0]! + (room.inside[0] - tee[0]!) * 0.5, room.cell.floorY, tee[2]! + (room.inside[2] - tee[2]!) * 0.5];
  sim.teleport(0, [from[0], room.cell.floorY + 0.02, from[2]], 0);
  const yaw = Math.atan2(-(tee[0]! - from[0]), -(tee[2]! - from[2]));
  let moved = false;
  for (let i = 0; i < 90 && !moved; i++) { sim.step([cmd({ yaw, moveY: 1 })]); if (sim.outputOf(ball.id, 'moving') > 0.5) moved = true; }
  assert.ok(moved, '蹴れる');
  for (let i = 0; i < 20 * 60 && sim.outputOf(ball.id, 'kicks') > 0.5; i++) sim.step([cmd()]);
  const p = sim.stateOf(ball.id)!.pos as number[];
  assert.ok(Math.hypot(p[0]! - tee[0]!, p[2]! - tee[2]!) < 1e-6, '止まると元の所へ（1 打で）');
});

test('かくれんぼ: 開けた所に立つと見つかる（警報）・入口の前では見つからない', async () => {
  const { room } = rooms('hideSeek', ['none'])[0]!;
  const sim = await newSim(room);
  const seeker = ents(room, 'seeker')[0]!;
  // 入口の前に 20 秒: 見つからない
  sim.teleport(0, room.inside, 0);
  run(sim, 20);
  assert.equal(sim.outputOf(seeker.id, 'caught'), 0, '入口の前では見つからない');
  // 見回りの道の上に立つ: いつか見つかる
  const path = seeker.params.path as number[][];
  const p: Vec3 = [path[0]![0]!, room.cell.floorY, path[0]![2]!];
  sim.teleport(0, [(p[0] + path[1]![0]!) / 2, room.cell.floorY + 0.02, (p[2] + path[1]![2]!) / 2], 0);
  run(sim, 30);
  assert.ok(sim.outputOf(seeker.id, 'caught') > 0, '開けた所では見つかる');
});

test('記憶の部屋: 入ると 10 秒見せて暗くなり、物が台から散らばる。部屋を出ると戻る', async () => {
  const { room } = rooms('memoryRoom', ['none'])[0]!;
  const sim = await newSim(room);
  const game = ents(room, 'memoryGame')[0]!;
  const board = ents(room, 'carryReceiver')[0]!;
  sim.teleport(0, room.inside, 0);
  run(sim, 5);
  assert.equal(sim.outputOf(game.id, 'lights'), 1);
  assert.equal(sim.outputOf(board.id, 'ok'), 1, '初めは全部台の上');
  run(sim, 6);
  assert.equal(sim.outputOf(game.id, 'lights'), 0, '暗くなる');
  assert.equal(sim.outputOf(board.id, 'count'), 0, '散らばる');
  // 部屋の外（試験だけの足場）へ出て 7 秒
  const r = room.slot.rect;
  sim.colliders.addStatic({ min: [r.x1 + 1.5, room.cell.floorY - 0.2, r.z0], max: [r.x1 + 6, room.cell.floorY, r.z1] });
  sim.teleport(0, [r.x1 + 3, room.cell.floorY + 0.02, (r.z0 + r.z1) / 2], 0);
  run(sim, 7);
  assert.equal(sim.outputOf(game.id, 'lights'), 1, '最初から（明るい）');
  assert.equal(sim.outputOf(board.id, 'ok'), 1, '物は台の上に戻る');
});
