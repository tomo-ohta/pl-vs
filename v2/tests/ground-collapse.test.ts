/**
 * 崩れていく帰り道（collapseRun・G03 / BG02）: 普段は床板が崩れない・装置に触れると奥から崩れてくる・走れば逃げ切れて歩くと落ちる・
 * 落ちても階段で入口の床へ戻れる・しばらくで戻る・装置の下へ落ちると隠しが現れる（出現型）・フロアの中で隠しの奥まで行ける・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, newSim, press, runTo, showcaseRooms, T } from './ground-lab.ts';

const ROOMS = labRooms('collapseRun');

const deviceOf = (room: (typeof ROOMS)[number]): number[] => {
  const e = entitiesOf(room.floor, 'collapseFloor')[0]!;
  const d = e.params.device as { min: number[]; max: number[] };
  return [(d.min[0]! + d.max[0]!) / 2, (d.min[1]! + d.max[1]!) / 2, (d.min[2]! + d.max[2]!) / 2];
};
/** 装置の手前（入口の側）0.8 m */
const nearDevice = (room: (typeof ROOMS)[number]): [number, number, number] => {
  const d = deviceOf(room);
  const dx = room.inside[0] - d[0]!, dz = room.inside[2] - d[2]!;
  const l = Math.hypot(dx, dz);
  return [d[0]! + (dx / l) * 0.8, 0.02, d[2]! + (dz / l) * 0.8];
};

test('崩れていく帰り道: 入口の向き 4 つで組める・普段は乗っても崩れない', async () => {
  assert.ok(new Set(ROOMS.map((r) => r.entry)).size === 4, `入口の向き: ${[...new Set(ROOMS.map((r) => r.entry))]}`);
  for (const room of ROOMS) {
    const sim = await newSim(room.floor);
    sim.teleport(0, nearDevice(room), 0);
    idle(sim, 3);
    const e = entitiesOf(room.floor, 'collapseFloor')[0]!;
    assert.equal(sim.outputOf(e.id, 'fallen'), 0, `${room.tag}: 立っていても崩れない`);
    assert.ok(Math.abs(sim.players[0]!.pos[1]) < 0.05, `${room.tag}: 床の上`);
    disposeSim(sim);
  }
});

test('崩れていく帰り道: 装置に触れると奥から崩れてくる。走れば入口の床へ逃げ切れ、歩くと落ちる。落ちても階段で戻れ、しばらくで床板が戻る', async () => {
  let caught = 0;
  for (const room of ROOMS) {
    const e = entitiesOf(room.floor, 'collapseFloor')[0]!;
    // 走って逃げる
    {
      const sim = await newSim(room.floor);
      sim.teleport(0, nearDevice(room), 0);
      idle(sim, 0.2);
      press(sim, deviceOf(room));
      assert.equal(sim.outputOf(e.id, 'active'), 1, `${room.tag}: 崩れ始める`);
      const res = runTo(sim, room.inside, { dash: true, maxSec: 6 });
      idle(sim, 4);
      assert.ok(res.reached && res.minY > -0.3 && Math.abs(sim.players[0]!.pos[1]) < 0.05, `${room.tag}: 走れば逃げ切れる（最低 ${res.minY.toFixed(2)}）`);
      assert.ok(sim.outputOf(e.id, 'fallen') > 0.95, `${room.tag}: 床板が全部落ちる`);
      disposeSim(sim);
    }
    // 歩いて逃げる → 落ちる → 階段で入口の床へ → 床板が戻る
    {
      const sim = await newSim(room.floor);
      sim.teleport(0, nearDevice(room), 0);
      idle(sim, 0.2);
      press(sim, deviceOf(room));
      const res = runTo(sim, room.inside, { dash: false, maxSec: 6 });
      if (res.minY < -1.5) caught++;
      idle(sim, 1);
      const back = walkTo(sim, 'room', room.inside, 90);
      assert.ok(back.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 入口の床へ戻れる ${back.reason}`);
      idle(sim, T['ground.collapse.restoreSec'] + 2);
      assert.equal(sim.outputOf(e.id, 'fallen'), 0, `${room.tag}: 床板が戻る`);
      assert.equal(sim.outputOf(e.id, 'active'), 0);
      disposeSim(sim);
    }
  }
  assert.ok(caught >= ROOMS.length * 0.75, `歩くと捕まる: ${caught}/${ROOMS.length}`);
});

test('崩れていく帰り道（BG02）: 帰らずに装置のそばに居ると、装置の下の穴の底へ落ち、出現型の隠しが現れる', async () => {
  for (const room of ROOMS) {
    const offer = room.offers.find((o) => o.hook === 'collapse.deep');
    assert.ok(offer, `${room.tag}: 隠しの元`);
    assert.ok(offer.doorway.y < -2, `${room.tag}: 入口は穴の底`);
    const reveal = offer.revealOutput!;
    const [id, port] = [reveal.slice(0, reveal.lastIndexOf('.')), reveal.slice(reveal.lastIndexOf('.') + 1)];
    // 走って逃げた人には現れない
    {
      const sim = await newSim(room.floor);
      sim.teleport(0, nearDevice(room), 0);
      press(sim, deviceOf(room));
      runTo(sim, room.inside, { dash: true, maxSec: 6 });
      idle(sim, 3);
      assert.equal(sim.outputOf(id, port), 0, `${room.tag}: 逃げた人には現れない`);
      disposeSim(sim);
    }
    {
      const sim = await newSim(room.floor);
      sim.teleport(0, nearDevice(room), 0);
      press(sim, deviceOf(room));
      idle(sim, 3);
      assert.ok(sim.players[0]!.pos[1] < -2, `${room.tag}: 装置の下へ落ちた`);
      assert.equal(sim.outputOf(id, port), 1, `${room.tag}: 現れる`);
      disposeSim(sim);
    }
  }
});

test('崩れていく帰り道: 見本のフロアで、歩く人が装置に触れて落ち、穴の底の隠しの奥まで行ける（存在型・出現型）', async () => {
  let n = 0;
  for (const flip of [false, true]) {
    for (const room of showcaseRooms('collapseRun', [1, 2, 3, 4], { flip })) {
      const sec = room.r.gimmicks!.secrets.find((s) => s.host === room.cell.id);
      if (!sec) continue;
      n++;
      const sim = await newSim(room.floor);
      const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 240);
      assert.ok(res.ok, `${room.floor.id} ${sec.mode}: ${res.reason}`);
      disposeSim(sim);
    }
  }
  assert.ok(n >= 2, `隠し: ${n}`);
});

test('崩れていく帰り道: 同じ seed で同じ部屋（決定的）', () => {
  const a = labRooms('collapseRun', { sizes: [{ w: 6.6, d: 8 }], seeds: [3] });
  const b = labRooms('collapseRun', { sizes: [{ w: 6.6, d: 8 }], seeds: [3] });
  assert.equal(JSON.stringify(a.map((r) => r.floor)), JSON.stringify(b.map((r) => r.floor)));
});
