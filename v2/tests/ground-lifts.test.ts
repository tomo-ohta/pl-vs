/**
 * 上下する床と床下の明かり: 沈む床（sinkFloor・G16）・せり上がる床（riseFloor・G17）・天秤の床（balanceRoom・BG06）・床下の明かり（underHatch・G15）。
 * - 止まって立つと動き、歩くと戻る・沈む床は底で止まっていると下のフロアへ（Cue floor.goto）・通り抜ける人は沈まない
 * - せり上がる床で高い扉の前へ・天秤は重い箱 vs 軽い箱 + 自分で釣り合い、間の床が下がる・蓋を開けると地下へ降りられる
 * - 見本のフロアで、歩く人が隠しの奥まで行ける（本道も抜けられる）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BotHint } from './helpers/bot.ts';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, mainPathFloors, newSim, press, runTo, showcaseRooms, T, walkFloorExit } from './ground-lab.ts';

const center = (b: { min: number[]; max: number[] }): [number, number, number] => [(b.min[0]! + b.max[0]!) / 2, b.max[1]!, (b.min[2]! + b.max[2]!) / 2];
const hintOf = (floor: Parameters<typeof entitiesOf>[0]): BotHint => entitiesOf(floor, 'constant').find((e) => e.params.bot)!.params.bot as unknown as BotHint;

test('沈む床: 止まって立つと沈み、底で止まっていると下のフロアへ。歩くと戻る・通り抜ける人は沈まない', async () => {
  const rooms = labRooms('sinkFloor', { exit: 'opposite', sizes: [{ w: 6.0, d: 7.0 }] });
  assert.ok(rooms.length >= 6, `${rooms.length}`);
  for (const room of rooms) {
    const lift = entitiesOf(room.floor, 'stillLift')[0]!;
    const top = center(lift.params.box as never);
    const sim = await newSim(room.floor);
    sim.teleport(0, [top[0], 0.02, top[2]], 0);
    idle(sim, 3);
    assert.ok(sim.outputOf(lift.id, 't') > 0.2, `${room.tag}: 沈む`);
    // 歩き回ると戻る
    for (let i = 0; i < 4; i++) { runTo(sim, [top[0] + 0.5, 0, top[2]], { maxSec: 0.6, stopAt: 0.05 }); runTo(sim, [top[0] - 0.5, 0, top[2]], { maxSec: 0.6, stopAt: 0.05 }); }
    const t1 = sim.outputOf(lift.id, 't');
    assert.ok(t1 < 0.2, `${room.tag}: 歩くと戻る（t=${t1.toFixed(2)}）`);
    sim.teleport(0, [top[0], sim.players[0]!.pos[1] + 0.02, top[2]], 0);
    // 底まで沈んで止まっている → floor.goto
    sim.drainEvents();
    idle(sim, T['ground.sink.depthM'] / T['ground.sink.speed'] + T['ground.sink.gotoSec'] + 2);
    const go = sim.drainEvents().filter((e) => e.type === 'cue' && e.data?.name === 'floor.goto');
    assert.equal(go.length, 1, `${room.tag}: 下のフロアへ`);
    assert.ok(sim.players[0]!.pos[1] < -T['ground.sink.depthM'] + 0.1, `${room.tag}: 底`);
    disposeSim(sim);
    // 通り抜ける（歩く人）は沈まない
    const s2 = await newSim(room.floor);
    s2.teleport(0, room.inside, 0);
    const res = walkTo(s2, 'room', room.exitInside!, 40);
    assert.ok(res.ok && !s2.drainEvents().some((e) => e.data?.name === 'floor.goto') && s2.outputOf(lift.id, 't') < 0.1, `${room.tag}: 通り抜けられる ${res.reason}`);
    disposeSim(s2);
  }
});

test('せり上がる床: 止まって立つと高い扉の高さまで上がる・降りるとしばらくで戻る', async () => {
  const rooms = labRooms('riseFloor', { exit: 'opposite', sizes: [{ w: 6.0, d: 7.0, height: 4.0 }] });
  assert.ok(rooms.length >= 6, `${rooms.length}`);
  for (const room of rooms) {
    const lift = entitiesOf(room.floor, 'stillLift')[0]!;
    const offer = room.offers.find((o) => o.hook === 'rise.high')!;
    assert.ok(offer.required && offer.doorway.y > 1.2, `${room.tag}: 高い扉`);
    const h = hintOf(room.floor).steps[0]!;
    const sim = await newSim(room.floor);
    sim.teleport(0, h.at, 0);
    idle(sim, 0.5 + offer.doorway.y / T['ground.rise.speed'] + 1);
    assert.equal(sim.outputOf(lift.id, 'atFar'), 1, `${room.tag}: 上がった`);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - offer.doorway.y) < 0.05, `${room.tag}: 扉の高さ（${sim.players[0]!.pos[1].toFixed(2)}）`);
    // 飛び降りて戻る → 床板は下がる
    runTo(sim, room.inside, { maxSec: 4 });
    idle(sim, 3 + offer.doorway.y / T['ground.rise.speed'] + 1);
    assert.ok(sim.outputOf(lift.id, 't') < 0.05 && Math.abs(sim.players[0]!.pos[1]) < 0.05, `${room.tag}: 降りて戻る`);
    disposeSim(sim);
  }
});

test('天秤の床（BG06）: 重い箱と軽い箱だけでは傾いたまま。軽い方に自分も乗ると釣り合い、間の床が 2 段に下がる', async () => {
  const rooms = labRooms('balanceRoom', { exit: 'opposite', sizes: [{ w: 6.6, d: 7.6 }, { w: 8.6, d: 12, kind: 'hall' }] });
  assert.ok(rooms.length >= 6, `${rooms.length}`);
  for (const room of rooms) {
    const bal = entitiesOf(room.floor, 'balanceScale')[0]!;
    const h = hintOf(room.floor);
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    for (const st of h.steps.slice(0, 2)) {
      const res = walkTo(sim, 'room', st.at, 30);
      assert.ok(res.ok, `${room.tag}: ${res.reason}`);
      press(sim, st.look!);
      idle(sim, st.wait ?? 1);
    }
    idle(sim, 3);
    assert.equal(sim.outputOf(bal.id, 'left') + sim.outputOf(bal.id, 'right'), 3, `${room.tag}: 箱が皿に載った`);
    assert.equal(sim.outputOf(bal.id, 'balanced'), 0, `${room.tag}: 箱だけでは傾いたまま`);
    const res = walkTo(sim, 'room', h.steps[2]!.at, 30);
    assert.ok(res.ok, `${room.tag}: 皿へ ${res.reason}`);
    idle(sim, T['ground.balance.holdSec'] + 3);
    assert.equal(sim.outputOf(bal.id, 'balanced'), 1, `${room.tag}: 釣り合った`);
    const steps = entitiesOf(room.floor, 'mover').filter((m) => m.id.includes('.step'));
    assert.ok(steps.every((m) => sim.outputOf(m.id, 't') > 0.99), `${room.tag}: 間の床が下がった`);
    disposeSim(sim);
  }
});

test('床下の明かり: 蓋を調べると開き、階段で地下の扉の前まで降りられる・また上がれる', async () => {
  const rooms = labRooms('underHatch', { exit: 'opposite', sizes: [{ w: 6.0, d: 7.0 }] });
  assert.ok(rooms.length >= 6, `${rooms.length}`);
  for (const room of rooms) {
    const hatch = entitiesOf(room.floor, 'hatch')[0]!;
    const offer = room.offers.find((o) => o.hook === 'hatch.under')!;
    const h = hintOf(room.floor).steps[0]!;
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    let res = walkTo(sim, 'room', h.at, 30);
    assert.ok(res.ok, `${room.tag}: 蓋の前へ ${res.reason}`);
    press(sim, h.look!);
    idle(sim, 1.6);
    assert.equal(sim.outputOf(hatch.id, 'open'), 1, `${room.tag}: 開く`);
    // 扉の前（壁の内側 0.5 m・地下の床）
    const d = offer.doorway;
    const r = room.cell.footprint[0]!;
    const inner = d.dir === 0 ? [d.at, d.y, r.z1 - 0.65] : d.dir === 2 ? [d.at, d.y, r.z0 + 0.65] : d.dir === 1 ? [r.x1 - 0.65, d.y, d.at] : [r.x0 + 0.65, d.y, d.at];
    res = walkTo(sim, 'room', inner as [number, number, number], 40);
    idle(sim, 0.6);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1] - d.y) < 0.1, `${room.tag}: 地下へ ${res.reason}（${sim.players[0]!.pos[1].toFixed(2)}）`);
    res = walkTo(sim, 'room', room.inside, 40);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 上がれる ${res.reason}`);
    disposeSim(sim);
  }
});

for (const def of ['riseFloor', 'balanceRoom', 'underHatch', 'sinkFloor']) {
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
    assert.ok(n >= 1);
  });
}
