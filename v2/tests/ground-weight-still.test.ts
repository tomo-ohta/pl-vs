/**
 * 重りの床（weightBridge・G10）と、立ち止まると見える道・2 本目（stillPaths・BG04）。
 * - 重りの床: 印に乗ると床板が上がる・降りると少しして沈む（走れば渡れ、歩くと沈む床板と一緒に底へ）・箱を印に載せると上がったまま・
 *   向こう岸のボタンで上がる（帰り道）・落ちても階段で手前へ
 * - 見える道: 止まると 1 本目の橋・さらに長く止まると 2 本目（小部屋へ。隠しが現れる）・向こう岸の四角でも 1 本目・跳んでも越えられない
 * - どちらも見本のフロア・本道で歩く人が抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BotHint } from './helpers/bot.ts';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, mainPathFloors, newSim, press, runTo, showcaseRooms, T, walkFloorExit } from './ground-lab.ts';

const SIZES = [{ w: 6.6, d: 8.0 }, { w: 8.6, d: 12, kind: 'hall' as const }];
const WEIGHT = labRooms('weightBridge', { exit: 'opposite', sizes: SIZES });
const STILL = labRooms('stillPaths', { exit: 'opposite', sizes: SIZES });
const hintsOf = (floor: (typeof WEIGHT)[number]['floor']): BotHint[] => entitiesOf(floor, 'constant').find((e) => e.params.bot)!.params.bot as unknown as BotHint[];
const fromEntrance = (room: (typeof WEIGHT)[number]) => hintsOf(room.floor).find((x) => x.enterAt && Math.hypot(x.enterAt[0] - room.slot.entrance!.pos[0], x.enterAt[1] - room.slot.entrance!.pos[2]) < 0.5)!;
const fromExit = (room: (typeof WEIGHT)[number]) => hintsOf(room.floor).find((x) => x.enterAt && Math.hypot(x.enterAt[0] - room.slot.exit!.pos[0], x.enterAt[1] - room.slot.exit!.pos[2]) < 0.5)!;
const plateCenter = (room: (typeof WEIGHT)[number]): [number, number, number] => { const a = entitiesOf(room.floor, 'loadPlate')[0]!.params.aabb as { min: number[]; max: number[] }; return [(a.min[0]! + a.max[0]!) / 2, 0.02, (a.min[2]! + a.max[2]!) / 2]; };

test('重りの床: 入口の向き 4 つで組める・押す前は渡れない', async () => {
  assert.equal(new Set(WEIGHT.map((r) => r.entry)).size, 4, `入口の向き: ${[...new Set(WEIGHT.map((r) => r.entry))]}`);
  for (const room of WEIGHT) {
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    const res = runTo(sim, room.exitInside!, { dash: true, maxSec: 4 });
    assert.ok(!res.reached, `${room.tag}: 渡れない`);
    disposeSim(sim);
  }
});

test('重りの床: 印に乗って走れば渡れ、歩くと沈む床板と一緒に溝の底へ（階段で手前へ戻れる）', async () => {
  let sank = 0;
  for (const room of WEIGHT) {
    const up = entitiesOf(room.floor, 'threshold')[0]!;
    for (const dash of [true, false]) {
      const sim = await newSim(room.floor);
      sim.teleport(0, plateCenter(room), 0);
      idle(sim, 2.5);
      assert.equal(sim.outputOf(up.id, 'out'), 1, `${room.tag}: 印に乗ると床板が上がる`);
      const plat = entitiesOf(room.floor, 'mover').find((m) => m.id.endsWith('.platform'))!;
      const b = plat.params.box as { min: number[]; max: number[] };
      const c: [number, number, number] = [(b.min[0]! + b.max[0]!) / 2, 0, (b.min[2]! + b.max[2]!) / 2];
      // 印は床板の列の手前（同じ列）: まっすぐ走って渡る
      runTo(sim, c, { dash, maxSec: 3, stopAt: 0.3 });
      const res = runTo(sim, room.exitInside!, { dash, maxSec: 4 });
      const y = sim.players[0]!.pos[1];
      if (dash) assert.ok(res.reached && Math.abs(y) < 0.1, `${room.tag}: 走れば渡れる（${y.toFixed(2)}）`);
      else if (y < -1) {
        sank++;
        idle(sim, 2);
        const back = walkTo(sim, 'room', room.inside, 60);
        assert.ok(back.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 底から手前へ ${back.reason}`);
      }
      disposeSim(sim);
    }
  }
  assert.ok(sank >= WEIGHT.length * 0.6, `歩くと沈む: ${sank}/${WEIGHT.length}`);
});

test('重りの床: 箱を印に載せると上がったまま・向こう岸のボタンでも上がる（帰り道）', async () => {
  for (const room of WEIGHT) {
    const up = entitiesOf(room.floor, 'threshold')[0]!;
    {
      const h = fromEntrance(room).steps[0]!;
      const sim = await newSim(room.floor);
      sim.teleport(0, room.inside, 0);
      let res = walkTo(sim, 'room', h.at, 30);
      assert.ok(res.ok, `${room.tag}: 箱の後ろへ ${res.reason}`);
      press(sim, h.look!);
      idle(sim, 3);
      assert.equal(sim.outputOf(up.id, 'out'), 1, `${room.tag}: 箱で上がる`);
      res = walkTo(sim, 'room', room.exitInside!, 40);
      assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 歩いて渡れる ${res.reason}`);
      disposeSim(sim);
    }
    {
      const h = fromExit(room).steps[0]!;
      const sim = await newSim(room.floor);
      sim.teleport(0, room.exitInside!, 0);
      let res = walkTo(sim, 'room', h.at, 30);
      assert.ok(res.ok, `${room.tag}: ボタンの前へ ${res.reason}`);
      press(sim, h.look!);
      idle(sim, 2);
      assert.equal(sim.outputOf(up.id, 'out'), 1, `${room.tag}: ボタンで上がる`);
      res = walkTo(sim, 'room', room.inside, 40);
      assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 戻れる ${res.reason}`);
      disposeSim(sim);
    }
  }
});

test('見える道: 止まると 1 本目、さらに長く止まると 2 本目の橋（出現型の隠し）・向こう岸の四角でも 1 本目・止まる前は渡れない', async () => {
  assert.equal(new Set(STILL.map((r) => r.entry)).size, 4, `入口の向き: ${[...new Set(STILL.map((r) => r.entry))]}`);
  let alcoves = 0;
  for (const room of STILL) {
    const h = fromEntrance(room).steps[0]!;
    const r1 = entitiesOf(room.floor, 'reveal').find((e) => e.id.endsWith('.reveal1'))!;
    const r2 = entitiesOf(room.floor, 'reveal').find((e) => e.id.endsWith('.reveal2'));
    {
      const sim = await newSim(room.floor);
      sim.teleport(0, room.inside, 0);
      const res = runTo(sim, room.exitInside!, { dash: true, maxSec: 4 });
      assert.ok(!res.reached, `${room.tag}: 止まる前は渡れない`);
      disposeSim(sim);
    }
    const sim = await newSim(room.floor);
    sim.teleport(0, h.at, 0);
    idle(sim, T['ground.still.firstSec'] + 0.3);
    assert.equal(sim.outputOf(r1.id, 'shown'), 1, `${room.tag}: 1 本目`);
    if (r2) {
      alcoves++;
      assert.equal(sim.outputOf(r2.id, 'shown'), 0, `${room.tag}: 2 本目はまだ`);
      idle(sim, T['ground.still.secondSec']);
      assert.equal(sim.outputOf(r2.id, 'shown'), 1, `${room.tag}: さらに長く止まると 2 本目`);
      assert.ok(room.offers.some((o) => o.hook === 'still.longer' && o.revealOutput === `${r2.id}.shown`));
    }
    const res = walkTo(sim, 'room', room.exitInside!, 40);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 渡れる ${res.reason}`);
    disposeSim(sim);
    // 向こう岸の四角
    const hf = fromExit(room).steps[0]!;
    const s2 = await newSim(room.floor);
    s2.teleport(0, hf.at, 0);
    idle(s2, T['ground.still.firstSec'] + 0.3);
    assert.equal(s2.outputOf(r1.id, 'shown'), 1, `${room.tag}: 向こう岸の四角でも 1 本目`);
    disposeSim(s2);
  }
  assert.ok(alcoves >= 4, `小部屋: ${alcoves}`);
});

for (const def of ['weightBridge', 'stillPaths']) {
  test(`${def}: 見本のフロア・本道で、歩く人が抜けられる・隠しの奥まで行ける`, async () => {
    let n = 0;
    for (const flip of [false, true]) for (const room of showcaseRooms(def, [1, 2, 3], { flip })) {
      for (const sec of room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id)) {
        const sim = await newSim(room.floor);
        const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 300);
        assert.ok(res.ok, `${room.floor.id} 隠し ${sec.hook} ${sec.mode}: ${res.reason}`);
        n++;
        disposeSim(sim);
      }
    }
    for (const f of mainPathFloors(def, 2, 900)) {
      n++;
      const res = await walkFloorExit(f.floor);
      assert.ok(res.ok, `${f.floor.id}（${f.cell.id}）: ${res.reason}`);
    }
    console.log(`  ${def}: ${n}`);
    assert.ok(n >= 2);
  });
}
