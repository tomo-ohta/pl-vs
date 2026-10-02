/**
 * ドミノの橋（dominoBridge・G06 / BG03）: 溝は柵で渡れない・棚を押すと鎖で倒れて出口の側に橋が架かる・逆の向きに倒すと小部屋に橋が架かって
 * 隠しが現れる・向こう岸のレバーで橋を倒せる（帰り道）・橋から落ちても階段で戻れる・見本のフロアを歩く人が抜けられる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BotHint } from './helpers/bot.ts';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, mainPathFloors, newSim, press, runTo, showcaseRooms, walkFloorExit } from './ground-lab.ts';

const ROOMS = labRooms('dominoBridge', { exit: 'opposite', sizes: [{ w: 7.2, d: 8.2 }, { w: 8.6, d: 12, kind: 'hall' }] });
type Floor = (typeof ROOMS)[number]['floor'];
/** 出口の側の橋の棚（最後の棚）・小部屋の橋の棚（最初の棚。小部屋が無ければ鎖の棚） */
const pieces = (floor: Floor) => entitiesOf(floor, 'domino');
const mainOf = (floor: Floor) => pieces(floor).find((e) => e.params.bot)!;
const secOf = (floor: Floor) => pieces(floor).find((e) => !e.params.prev)!;
const hintsOf = (floor: Floor): BotHint[] => mainOf(floor).params.bot as unknown as BotHint[];

test('ドミノの橋: 入口の向き 4 つで組める・押す前は柵で溝を渡れない', async () => {
  assert.equal(new Set(ROOMS.map((r) => r.entry)).size, 4, `入口の向き: ${[...new Set(ROOMS.map((r) => r.entry))]}`);
  for (const room of ROOMS) {
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    const res = runTo(sim, room.exitInside!, { dash: true, maxSec: 4 });
    assert.ok(!res.reached && res.minY > -0.2, `${room.tag}: 柵で止まる`);
    disposeSim(sim);
  }
});

test('ドミノの橋: 出口の側へ押すと、鎖で倒れて橋が架かり、渡って出口へ行ける', async () => {
  for (const room of ROOMS) {
    const main = mainOf(room.floor), sec = secOf(room.floor);
    const h = hintsOf(room.floor).find((x) => x.enterAt && !x.only && Math.hypot(x.enterAt[0] - room.slot.entrance!.pos[0], x.enterAt[1] - room.slot.entrance!.pos[2]) < 0.5)!;
    const sim = await newSim(room.floor);
    sim.teleport(0, h.steps[0]!.at, 0);
    idle(sim, 0.3);
    press(sim, h.steps[0]!.look!);
    idle(sim, 3);
    assert.equal(sim.outputOf(main.id, 'fallen'), 1, `${room.tag}: 出口の側の橋`);
    assert.equal(sim.outputOf(sec.id, 'fallen'), 0, `${room.tag}: 反対の端の棚はまだ`);
    const res = walkTo(sim, 'room', room.exitInside!, 60);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.35, `${room.tag}: 渡れる ${res.reason}`);
    disposeSim(sim);
  }
});

test('ドミノの橋: 向こう岸のレバーで橋の棚を倒せる（出口の側から来た人の帰り道）・橋から落ちても階段で手前へ戻れる', async () => {
  for (const room of ROOMS) {
    const main = mainOf(room.floor);
    const h = hintsOf(room.floor).find((x) => x.enterAt && Math.hypot(x.enterAt[0] - room.slot.exit!.pos[0], x.enterAt[1] - room.slot.exit!.pos[2]) < 0.5)!;
    const sim = await newSim(room.floor);
    sim.teleport(0, room.exitInside!, 0);
    idle(sim, 0.2);
    let res = walkTo(sim, 'room', h.steps[0]!.at, 30);
    assert.ok(res.ok, `${room.tag}: レバーの前へ ${res.reason}`);
    press(sim, h.steps[0]!.look!);
    idle(sim, 3);
    assert.equal(sim.outputOf(main.id, 'fallen'), 1, `${room.tag}: レバーで橋`);
    res = walkTo(sim, 'room', room.inside, 60);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.35, `${room.tag}: 戻れる ${res.reason}`);
    // 溝の底へ落ちて、階段で手前へ
    const tr = room.cell.boxes.filter((b) => b.solid && b.max[1] < -1).sort((a, b) => a.max[1] - b.max[1])[0]!;
    sim.teleport(0, [(tr.min[0] + tr.max[0]) / 2, tr.max[1] + 0.05, (tr.min[2] + tr.max[2]) / 2], 0);
    idle(sim, 0.5);
    res = walkTo(sim, 'room', room.inside, 60);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 溝の底から戻れる ${res.reason}`);
    disposeSim(sim);
  }
});

test('ドミノの橋（BG03）: 逆の向きに倒すと小部屋に橋が架かり、出現型の隠しが現れる', async () => {
  let n = 0;
  for (const room of ROOMS) {
    const offer = room.offers.find((o) => o.hook === 'domino.reverse');
    if (!offer) continue;
    n++;
    const main = mainOf(room.floor), sec = secOf(room.floor);
    const h = hintsOf(room.floor).find((x) => x.only === 'secret')!;
    const sim = await newSim(room.floor);
    sim.teleport(0, h.steps[0]!.at, 0);
    idle(sim, 0.3);
    press(sim, h.steps[0]!.look!);
    idle(sim, 3);
    assert.equal(sim.outputOf(sec.id, 'fallen'), 1, `${room.tag}: 小部屋の橋`);
    assert.equal(sim.outputOf(main.id, 'fallen'), 0, `${room.tag}: 出口の側の橋はまだ（残りの棚は押せる）`);
    assert.equal(offer.revealOutput, `${sec.id}.fallen`);
    // 残りの棚を出口の側へ押せば、出口の側の橋も架かる（倒し方を間違えても閉じ込めない）
    const mh = hintsOf(room.floor).find((x) => x.enterAt && !x.only && Math.hypot(x.enterAt[0] - room.slot.entrance!.pos[0], x.enterAt[1] - room.slot.entrance!.pos[2]) < 0.5)!;
    const res = walkTo(sim, 'room', mh.steps[0]!.at, 30);
    assert.ok(res.ok, res.reason);
    press(sim, mh.steps[0]!.look!);
    idle(sim, 3);
    assert.equal(sim.outputOf(main.id, 'fallen'), 1, `${room.tag}: 残りを押して出口の側の橋`);
    disposeSim(sim);
  }
  assert.ok(n >= ROOMS.length / 2, `小部屋のある部屋: ${n}/${ROOMS.length}`);
});

test('ドミノの橋: 見本のフロアで、歩く人が棚を押して抜けられる・隠しの奥まで行ける', async () => {
  let main = 0, secrets = 0;
  for (const flip of [false, true]) {
    for (const room of showcaseRooms('dominoBridge', [1, 2, 3, 4], { flip })) {
      const sim = await newSim(room.floor);
      if (room.main) {
        const ex = room.floor.exits[0]!;
        const res = walkTo(sim, 'exitStairs', [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2], 300);
        assert.ok(res.ok, `${room.floor.id} 出口へ: ${res.reason}`);
        main++;
      }
      disposeSim(sim);
      for (const sec of room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id)) {
        const s2 = await newSim(room.floor);
        const res = walkTo(s2, sec.cells[sec.cells.length - 1]!, undefined, 300);
        assert.ok(res.ok, `${room.floor.id} 隠し ${sec.mode}: ${res.reason}`);
        secrets++;
        disposeSim(s2);
      }
    }
  }
  console.log(`  本道 ${main}・隠し ${secrets}`);
  assert.ok(main + secrets >= 2);
});

test('ドミノの橋: 同じ seed で同じ部屋（決定的）', () => {
  const a = labRooms('dominoBridge', { exit: 'opposite', sizes: [{ w: 7.2, d: 8.2 }], seeds: [3] });
  const b = labRooms('dominoBridge', { exit: 'opposite', sizes: [{ w: 7.2, d: 8.2 }], seeds: [3] });
  assert.equal(JSON.stringify(a.map((r) => r.floor)), JSON.stringify(b.map((r) => r.floor)));
});

test('ドミノの橋: ふつうのフロアの本道に置かれても、歩く人が棚を押して出口まで抜けられる', async () => {
  const floors = mainPathFloors('dominoBridge', 2, 900);
  assert.ok(floors.length >= 1, '本道のドミノの橋が出る');
  for (const f of floors) {
    const res = await walkFloorExit(f.floor);
    assert.ok(res.ok, `${f.floor.id}（${f.cell.id}）: ${res.reason}`);
  }
});
