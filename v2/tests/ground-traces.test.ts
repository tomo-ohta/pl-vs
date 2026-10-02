/**
 * 足跡と光る床・水たまりの鏡: 光る床の迷路（glowMaze・G11）・足跡が残る床（footLoop・G12 / BG05）・他人の足跡（strangerTrail・G13）・
 * 水たまりの鏡（mirrorPuddle・G14）。
 * - 歩くと足跡が残る（光る床は時刻付き）・誰かの足跡は入口の近くから隠しの扉の前まで続く・足跡の終わりで立ち止まると現れる
 * - 塊のまわりを 1 周してから逆向きに 1 周すると現れる（通り抜けるだけ・同じ向きに回るだけでは現れない）
 * - 水たまりの上を歩ける・水面越しに映った扉を見続けると現れる（ほかの所を見ていても現れない）
 * - 見本のフロアで、歩く人が隠しの奥まで行ける・本道を抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BotHint } from './helpers/bot.ts';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, mainPathFloors, newSim, press, runTo, showcaseRooms, T, walkFloorExit } from './ground-lab.ts';

const SIZES = [{ w: 6.6, d: 8.0 }, { w: 8.6, d: 12, kind: 'hall' as const }];
const hintOf = (floor: Parameters<typeof entitiesOf>[0]): BotHint => entitiesOf(floor, 'constant').find((e) => e.params.bot)!.params.bot as unknown as BotHint;

test('光る床の迷路・他人の足跡: 誰かの足跡は入口の近くから扉の前まで・足跡の終わりで立ち止まると現れる・自分の足跡が残る', async () => {
  for (const def of ['glowMaze', 'strangerTrail']) {
    const rooms = labRooms(def, { exit: 'opposite', sizes: SIZES });
    assert.equal(new Set(rooms.map((r) => r.entry)).size, 4, `${def} 入口の向き: ${[...new Set(rooms.map((r) => r.entry))]}`);
    for (const room of rooms) {
      const marks = entitiesOf(room.floor, 'footMarks')[0]!.params.marks as number[];
      const offer = room.offers[0]!;
      const first: [number, number] = [marks[0]!, marks[1]!], last: [number, number] = [marks[marks.length - 3]!, marks[marks.length - 2]!];
      assert.ok(Math.hypot(first[0] - room.inside[0], first[1] - room.inside[2]) < 1.0, `${room.tag}: 入口の近くから`);
      const d = offer.doorway;
      const along = d.dir % 2 === 0 ? last[0] : last[1];
      assert.ok(Math.abs(along - d.at) < 0.6, `${room.tag}: 扉の前まで`);
      const sim = await newSim(room.floor);
      sim.teleport(0, room.inside, 0);
      // 通り抜ける: 現れない。自分の足跡が残る（光る床は時刻付き）
      const res = walkTo(sim, 'room', room.exitInside!, 60);
      assert.ok(res.ok, `${room.tag}: 通り抜けられる ${res.reason}`);
      const reveal = offer.revealOutput!;
      const [rid, rport] = [reveal.slice(0, reveal.lastIndexOf('.')), reveal.slice(reveal.lastIndexOf('.') + 1)];
      assert.equal(sim.outputOf(rid, rport), 0, `${room.tag}: 通り抜けるだけでは現れない`);
      const trail = entitiesOf(room.floor, 'stepTrail')[0];
      if (trail) assert.ok(sim.outputOf(trail.id, 'count') >= 4, `${room.tag}: 自分の足跡`);
      // 足跡の終わりで立ち止まる
      const h = hintOf(room.floor).steps[0]!;
      const r2 = walkTo(sim, 'room', h.at, 60);
      assert.ok(r2.ok, `${room.tag}: 足跡の終わりへ ${r2.reason}`);
      idle(sim, T['ground.trail.stopSec'] + 0.3);
      assert.equal(sim.outputOf(rid, rport), 1, `${room.tag}: 立ち止まると現れる`);
      disposeSim(sim);
    }
  }
});

test('足跡が残る床（BG05）: 通り抜ける・同じ向きに回るだけでは現れず、1 周してから逆向きに 1 周すると現れる', async () => {
  const rooms = labRooms('footLoop', { exit: 'opposite', sizes: SIZES });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const loop = entitiesOf(room.floor, 'loopCounter')[0]!;
    const h = hintOf(room.floor);
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    assert.ok(walkTo(sim, 'room', room.exitInside!, 40).ok);
    assert.equal(sim.outputOf(loop.id, 'reversed'), 0, `${room.tag}: 通り抜けるだけ`);
    // 同じ向きに 2 周
    const lap = h.steps.slice(0, 7);
    for (const st of [...lap, ...lap.slice(1)]) assert.ok(walkTo(sim, 'room', st.at, 30).ok);
    assert.ok(sim.outputOf(loop.id, 'laps') >= 1);
    assert.equal(sim.outputOf(loop.id, 'reversed'), 0, `${room.tag}: 同じ向きでは現れない`);
    // 逆向き
    for (const st of h.steps.slice(7)) assert.ok(walkTo(sim, 'room', st.at, 30).ok);
    idle(sim, 0.3);
    assert.equal(sim.outputOf(loop.id, 'reversed'), 1, `${room.tag}: 逆向きに 1 周で現れる`);
    assert.ok(sim.outputOf(entitiesOf(room.floor, 'stepTrail')[0]!.id, 'count') > 30, `${room.tag}: 足跡が残る`);
    disposeSim(sim);
  }
});

test('水たまりの鏡: 水たまりの上を歩ける・水面越しに映った扉を見続けると現れる', async () => {
  const rooms = labRooms('mirrorPuddle', { exit: 'opposite', sizes: SIZES });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const gaze = entitiesOf(room.floor, 'mirrorGaze')[0]!;
    const puddles = gaze.params.puddles as number[][];
    const sim = await newSim(room.floor);
    for (const q of puddles) {
      sim.teleport(0, [(q[0]! + q[2]!) / 2, 0.05, (q[1]! + q[3]!) / 2], 0);
      idle(sim, 0.3);
      assert.ok(Math.abs(sim.players[0]!.pos[1]) < 0.02, `${room.tag}: 水たまりの上に立てる`);
    }
    // ほかの所を見ていても現れない
    const h = hintOf(room.floor).steps[0]!;
    assert.ok(walkTo(sim, 'room', h.at, 40).ok);
    idle(sim, T['ground.mirror.gazeSec'] + 1, { pitch: 0.3 });
    assert.equal(sim.outputOf(gaze.id, 'done'), 0, `${room.tag}: 上を見ていると現れない`);
    press(sim, h.look!);
    idle(sim, T['ground.mirror.gazeSec'] + 0.4);
    assert.equal(sim.outputOf(gaze.id, 'done'), 1, `${room.tag}: 水面の扉を見ると現れる`);
    disposeSim(sim);
  }
});

for (const def of ['glowMaze', 'footLoop', 'strangerTrail', 'mirrorPuddle']) {
  test(`${def}: 見本のフロアで、歩く人が隠しの奥まで行ける・本道を抜けられる`, async () => {
    let n = 0;
    for (const room of showcaseRooms(def, [1, 2, 3])) {
      for (const sec of room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id)) {
        const sim = await newSim(room.floor);
        const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 300);
        assert.ok(res.ok, `${room.floor.id} 隠し ${sec.hook} ${sec.mode}: ${res.reason}`);
        n++;
        disposeSim(sim);
      }
    }
    for (const f of mainPathFloors(def, 1, 400)) {
      n++;
      const res = await walkFloorExit(f.floor);
      assert.ok(res.ok, `${f.floor.id}（${f.cell.id}）: ${res.reason}`);
    }
    console.log(`  ${def}: ${n}`);
    assert.ok(n >= 2);
  });
}
void runTo;
