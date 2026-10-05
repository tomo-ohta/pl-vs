/**
 * 箱の橋（crateBridge・G07）: 盤は解ける・押す前は渡れない（走って跳んでも下がり天井で越えられない）・解き方どおりに押すと溝が埋まって渡れる・
 * 戻すボタンで箱が戻る・溝に落ちても手前へ上がれる・向こう岸のボタンで板が伸びる（帰り道）・見本のフロアと本道を歩く人が抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCrates } from '../core/gen/gimmicks/ground/crates.ts';
import type { BotHint } from './helpers/bot.ts';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, mainPathFloors, newSim, press, runTo, showcaseRooms, walkFloorExit } from './ground-lab.ts';

const MAIN = labRooms('crateBridge', { exit: 'opposite', sizes: [{ w: 6.6, d: 7.6 }, { w: 8.6, d: 12, kind: 'hall' }] });
const DEAD = labRooms('crateBridge', { sizes: [{ w: 6.2, d: 7.0 }] });
const hintsOf = (floor: (typeof MAIN)[number]['floor']): BotHint[] => entitiesOf(floor, 'constant').find((e) => e.params.bot)!.params.bot as unknown as BotHint[];

test('箱の橋: 解く（幅優先）: 箱 2 つを同じ列の溝へ落とすまで', () => {
  // 4 列 × 手前 2 行 + 溝 2 行。人は (0, 0)、箱は (1, 1) と (2, 1): 1 つ目を下へ・2 つ目を左へ寄せてから下へ 2 回
  const b = { nu: 4, nb: 2, cells: [...'........oooooooo'], crates: [5, 6], start: 0 };
  const sol = solveCrates(b);
  assert.ok(sol && sol.length === 4, `解ける: ${JSON.stringify(sol)}`);
  assert.equal(solveCrates({ ...b, crates: [5] }), null, '箱 1 つでは渡れない');
  // 手前の行の箱は、下へ押せない（押す人が立つ升が無い）
  assert.equal(solveCrates({ ...b, crates: [1, 2] }), null, '手前の行の箱だけでは渡れない');
});

test('箱の橋: 入口の向き 4 つで組める・押す前は渡れない（走って跳んでも）', async () => {
  assert.equal(new Set(MAIN.map((r) => r.entry)).size, 4, `入口の向き: ${[...new Set(MAIN.map((r) => r.entry))]}`);
  assert.ok(DEAD.length >= 4, `行き止まり: ${DEAD.length}`);
  for (const room of MAIN) {
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    idle(sim, 0.2);
    // 走って溝へ向かい、縁の手前で跳ぶ
    const p = sim.players[0]!;
    const to = room.exitInside!;
    let jumped = false;
    for (let i = 0; i < 360; i++) {
      const dx = to[0] - p.pos[0], dz = to[2] - p.pos[2];
      const solid = room.cell.boxes.some((b) => b.solid && b.max[1] > -0.05 && b.max[1] < 0.05 && p.pos[0] > b.min[0] && p.pos[0] < b.max[0] && p.pos[2] > b.min[2] && p.pos[2] < b.max[2]);
      const ahead = !room.cell.boxes.some((b) => b.solid && Math.abs(b.max[1]) < 0.05 && p.pos[0] - dx / Math.hypot(dx, dz) * 0.6 > b.min[0] && p.pos[0] - dx / Math.hypot(dx, dz) * 0.6 < b.max[0]);
      const jump = !jumped && solid && !ahead && p.onGround;
      if (jump) jumped = true;
      sim.step([{ yaw: Math.atan2(-dx, -dz), pitch: 0, moveX: 0, moveY: 1, dash: true, crouch: false, jump: jump || (!jumped && i > 40 && i % 20 === 0), interact: null }]);
    }
    const end = sim.players[0]!.pos;
    assert.ok(Math.hypot(end[0] - to[0], end[2] - to[2]) > 1.2 || end[1] < -0.3, `${room.tag}: 渡れない（${end.map((v) => v.toFixed(2))}）`);
    disposeSim(sim);
  }
});

test('箱の橋: 解き方どおりに押すと溝が埋まり、渡れる。溝に落ちても手前へ上がれる', async () => {
  for (const room of [...MAIN, ...DEAD]) {
    const h = hintsOf(room.floor)[0]!;
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    for (const st of h.steps) {
      const res = walkTo(sim, 'room', st.at, 40);
      assert.ok(res.ok, `${room.tag}: 立つ所へ ${res.reason}`);
      press(sim, st.look!);
      idle(sim, st.wait ?? 0.6);
    }
    const crates = entitiesOf(room.floor, 'crate');
    assert.ok(crates.filter((c) => sim.outputOf(c.id, 'dropped') > 0.5).length >= 2, `${room.tag}: 箱が 2 つ溝に落ちた`);
    // 渡る（出口の前へ）
    if (room.exitInside) {
      const res = walkTo(sim, 'room', room.exitInside, 40);
      assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 渡れる ${res.reason}`);
    }
    // 溝の底から手前へ
    const bottom = room.cell.boxes.filter((b) => b.solid && b.max[1] < -0.5).sort((a, b) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) - (a.max[0] - a.min[0]) * (a.max[2] - a.min[2]))[0]!;
    const spot: [number, number, number] = [(bottom.min[0] + bottom.max[0]) / 2, bottom.max[1] + 0.05, (bottom.min[2] + bottom.max[2]) / 2];
    const s2 = await newSim(room.floor);
    s2.teleport(0, spot, 0);
    idle(s2, 0.3);
    const back = walkTo(s2, 'room', room.inside, 60);
    assert.ok(back.ok && Math.abs(s2.players[0]!.pos[1]) < 0.1, `${room.tag}: 溝の底から手前へ ${back.reason}`);
    disposeSim(sim);
    disposeSim(s2);
  }
});

test('箱の橋: 戻すボタンで箱が最初の位置に戻る', async () => {
  const room = MAIN[0]!;
  const h = hintsOf(room.floor)[0]!;
  const sim = await newSim(room.floor);
  sim.teleport(0, room.inside, 0);
  const st = h.steps[0]!;
  walkTo(sim, 'room', st.at, 40);
  press(sim, st.look!);
  idle(sim, 0.6);
  const crates = entitiesOf(room.floor, 'crate');
  const moved = crates.filter((c) => { const s = sim.stateOf(c.id) as { i: number; k: number }; const s0 = c.params.start as number[]; return s.i !== s0[0] || s.k !== s0[1]; });
  assert.equal(moved.length, 1, '1 つ動いた');
  const btn = entitiesOf(room.floor, 'button').find((b) => b.id.endsWith('.reset'))!;
  const bb = btn.params.box as { min: number[]; max: number[] };
  const c: [number, number, number] = [(bb.min[0]! + bb.max[0]!) / 2, (bb.min[1]! + bb.max[1]!) / 2, (bb.min[2]! + bb.max[2]!) / 2];
  walkTo(sim, 'room', room.inside, 30);
  press(sim, c);
  idle(sim, 0.2);
  assert.ok(crates.every((cr) => { const s = sim.stateOf(cr.id) as { i: number; k: number }; const s0 = cr.params.start as number[]; return s.i === s0[0] && s.k === s0[1]; }), '全部戻った');
  disposeSim(sim);
});

test('箱の橋: 向こう岸のボタンで板が伸び、手前へ戻れる（出口の側から来た人の帰り道）', async () => {
  for (const room of MAIN) {
    const h = hintsOf(room.floor).find((x) => x.enterAt && Math.hypot(x.enterAt[0] - room.slot.exit!.pos[0], x.enterAt[1] - room.slot.exit!.pos[2]) < 0.5)!;
    const sim = await newSim(room.floor);
    sim.teleport(0, room.exitInside!, 0);
    let res = walkTo(sim, 'room', h.steps[0]!.at, 30);
    assert.ok(res.ok, `${room.tag}: ボタンの前へ ${res.reason}`);
    press(sim, h.steps[0]!.look!);
    idle(sim, 4);
    res = walkTo(sim, 'room', room.inside, 40);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.15, `${room.tag}: 板を渡って戻れる ${res.reason}`);
    disposeSim(sim);
  }
});

test('箱の橋: 見本のフロア・本道で、歩く人が箱を押して抜けられる・隠しの奥まで行ける', async () => {
  let n = 0;
  for (const flip of [false, true]) for (const room of showcaseRooms('crateBridge', [1, 2, 3, 4, 5, 6], { flip })) {
    for (const sec of room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id)) {
      const sim = await newSim(room.floor);
      const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 300);
      assert.ok(res.ok, `${room.floor.id} 隠し ${sec.mode}: ${res.reason}`);
      n++;
      disposeSim(sim);
    }
  }
  for (const f of mainPathFloors('crateBridge', 2, 900)) {
    n++;
    const res = await walkFloorExit(f.floor);
    assert.ok(res.ok, `${f.floor.id}（${f.cell.id}）: ${res.reason}`);
  }
  assert.ok(n >= 2, `${n}`);
});
