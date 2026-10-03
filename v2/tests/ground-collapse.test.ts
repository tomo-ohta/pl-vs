/**
 * 崩れていく帰り道（collapseRun・G03 / BG02）: 普段は床板が崩れない・装置に触れると奥から崩れてくる・走れば逃げ切れて歩くと落ちる・
 * 落ちたら底の見えない縦穴（1 つ下の階）・しばらくで戻る・装置のそばに居ると下の細い足場へ落ち、足場の先の扉から隠しへ・決定的
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

test('崩れていく帰り道: 装置に触れると奥から崩れてくる。走れば入口の床へ逃げ切れ、歩くと落ちる（縦穴か下の細い足場へ）。しばらくで床板が戻る', async () => {
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
    // 歩いて逃げる → 落ちる（縦穴の暗い所か、下の細い足場の上）→ 床板が戻る
    {
      const sim = await newSim(room.floor);
      sim.teleport(0, nearDevice(room), 0);
      idle(sim, 0.2);
      press(sim, deviceOf(room));
      const res = runTo(sim, room.inside, { dash: false, maxSec: 6 });
      if (res.minY < -1.5) {
        caught++;
        idle(sim, 1.5);
        const py = sim.players[0]!.pos[1];
        assert.ok(py < -6 || Math.abs(py + T['gimmick.pit.catwalkDepthM']) < 0.05, `${room.tag}: 落ちたら縦穴か下の細い足場（y=${py.toFixed(2)}）`);
      }
      sim.teleport(0, room.inside, 0);
      idle(sim, T['ground.collapse.restoreSec'] + 2);
      assert.equal(sim.outputOf(e.id, 'fallen'), 0, `${room.tag}: 床板が戻る`);
      assert.equal(sim.outputOf(e.id, 'active'), 0);
      disposeSim(sim);
    }
  }
  assert.ok(caught >= ROOMS.length * 0.75, `歩くと捕まる: ${caught}/${ROOMS.length}`);
});

test('崩れていく帰り道（BG02）: 帰らずに装置のそばに居ると、崩れる床と一緒に下の細い足場へ落ちる。足場の先に隠しの扉', async () => {
  let n = 0;
  const cy = -T['gimmick.pit.catwalkDepthM'];
  for (const room of ROOMS) {
    const offer = room.offers.find((o) => o.hook === 'collapse.deep');
    if (!offer) continue;
    n++;
    assert.ok(offer.required && Math.abs(offer.doorway.y - cy) < 1e-3, `${room.tag}: 入口は下の細い足場の高さ`);
    const sim = await newSim(room.floor);
    sim.teleport(0, nearDevice(room), 0);
    press(sim, deviceOf(room));
    idle(sim, 3);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - cy) < 0.05, `${room.tag}: 下の細い足場に落ちた（y=${sim.players[0]!.pos[1].toFixed(2)}）`);
    disposeSim(sim);
  }
  assert.ok(n >= ROOMS.length * 0.6, `下の細い足場: ${n}/${ROOMS.length}`);
});

test('崩れていく帰り道: 見本のフロアで、歩く人が装置に触れて下の細い足場へ落ち、隠しの奥まで行ける', async () => {
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
