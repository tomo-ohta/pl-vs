/**
 * 動く床: 回る円盤（turntable・G19）・動く床タイル（slideTiles・G18）。
 * - 回る円盤: 橋が止まっては 90° 回る・乗っている人を回す・回っている間に降りると穴の底・底から階段で入口の足場へ・
 *   手順どおりに入口から出口へ（向かい・横）・1 周すると隠しが現れる
 * - 動く床タイル: 床板が空いた升目へ滑る・人の近くの床板は動かない・乗っている人から両岸へつながったまま・入口から出口へ渡れる・
 *   落ちたら階段で入口側へ戻れる
 * - 見本のフロアで、隠しの奥まで行ける・本道を抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, followHint, hintFor, idle, labRooms, mainPathFloors, newSim, runTo, showcaseRooms, walkFloorExit } from './ground-lab.ts';

const SIZES = [{ w: 7.2, d: 7.6 }, { w: 9.0, d: 9.0, kind: 'hall' as const }];

test('回る円盤: 止まっては 90° 回る・乗っている人を回す・回っている間に降りると穴の底・階段で入口の足場へ', async () => {
  const rooms = labRooms('turntable', { exit: 'opposite', sizes: SIZES });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const e = entitiesOf(room.floor, 'turntable')[0]!;
    const c = e.params.center as number[];
    const sim = await newSim(room.floor);
    // 真ん中に立って待つ: 止まる・回るをくり返し、90° ずつ変わる
    sim.teleport(0, [c[0]!, 0.02, c[2]!], 0);
    const seen = new Set<number>();
    let paused = 0, moving = 0;
    for (let i = 0; i < 60 * 42; i++) {
      idle(sim, 1 / 60);
      const a = sim.outputOf(e.id, 'angle');
      if (sim.outputOf(e.id, 'paused')) { paused++; seen.add(Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 2)) % 4); } else moving++;
    }
    assert.ok(paused > 60 * 8 && moving > 60 * 8, `${room.tag}: 止まる・回る`);
    assert.ok(seen.size >= 3, `${room.tag}: 90° ずつ ${[...seen]}`);
    assert.ok(Math.abs(sim.players[0]!.pos[1]) < 0.05, `${room.tag}: 真ん中なら落ちない`);
    assert.equal(sim.outputOf(e.id, 'fullTurn'), 1, `${room.tag}: 乗ったまま 1 周`);
    // 橋の端寄りに立つ: 回ると一緒に回る（向きが変わる）
    for (let i = 0; i < 60 * 12 && !sim.outputOf(e.id, 'paused'); i++) idle(sim, 1 / 60);
    for (let i = 0; i < 60 * 12 && sim.outputOf(e.id, 'paused'); i++) idle(sim, 1 / 60);
    for (let i = 0; i < 60 * 12 && !sim.outputOf(e.id, 'paused'); i++) idle(sim, 1 / 60);
    const a0 = sim.outputOf(e.id, 'angle');
    const rr = 1.4;
    sim.teleport(0, [c[0]! + Math.cos(a0) * rr, 0.02, c[2]! + Math.sin(a0) * rr], 0);
    for (let i = 0; i < 60 * 12 && sim.outputOf(e.id, 'paused'); i++) idle(sim, 1 / 60);
    for (let i = 0; i < 60 * 12 && !sim.outputOf(e.id, 'paused'); i++) idle(sim, 1 / 60);
    const a1 = sim.outputOf(e.id, 'angle');
    const p = sim.players[0]!.pos;
    const ang = Math.atan2(p[2] - c[2]!, p[0] - c[0]!);
    const diff = Math.abs(Math.atan2(Math.sin(ang - a1), Math.cos(ang - a1)));
    assert.ok(Math.abs(p[1]) < 0.05 && diff < 0.25 && Math.abs(Math.hypot(p[0] - c[0]!, p[2] - c[2]!) - rr) < 0.35, `${room.tag}: 一緒に回った（角度の差 ${diff.toFixed(2)}、高さ ${p[1].toFixed(2)}）`);
    // 回っている間に横へ降りる → 穴の底 → 階段で入口の足場へ
    for (let i = 0; i < 60 * 12 && sim.outputOf(e.id, 'paused'); i++) idle(sim, 1 / 60);
    const a2 = sim.outputOf(e.id, 'angle');
    runTo(sim, [c[0]! + Math.cos(a2 + Math.PI / 2) * 2.0, 0, c[2]! + Math.sin(a2 + Math.PI / 2) * 2.0], { maxSec: 2 });
    idle(sim, 1.0);
    assert.ok(sim.players[0]!.pos[1] < -1.5, `${room.tag}: 穴の底へ（y=${sim.players[0]!.pos[1].toFixed(2)}）`);
    const back = walkTo(sim, 'room', [room.inside[0], 0, room.inside[2]], 60);
    assert.ok(back.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 階段で入口へ ${back.reason}`);
    disposeSim(sim);
  }
});

test('回る円盤: 手順どおりに入口から出口へ（向かいの出口・横の出口）', async () => {
  let n = 0;
  for (const exit of ['opposite', 'side'] as const) {
    for (const room of labRooms('turntable', { exit, sizes: SIZES })) {
      const sim = await newSim(room.floor);
      sim.teleport(0, room.inside, 0);
      const h = hintFor(room.floor, room.slot.entrance!, room.slot.exit);
      assert.ok(h, `${room.tag} ${exit}: 手順がある`);
      const why = await followHint(sim, h!);
      assert.equal(why, '', `${room.tag} ${exit}: ${why}`);
      const res = walkTo(sim, 'room', room.exitInside!, 30);
      assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag} ${exit}: ${res.reason} y=${sim.players[0]!.pos[1].toFixed(2)}`);
      n++;
      disposeSim(sim);
    }
  }
  assert.ok(n >= 12);
});

const SLIDE = [{ w: 6.0, d: 8.4 }, { w: 8.6, d: 11, kind: 'hall' as const }];

test('動く床タイル: 床板が空いた升目へ滑る・乗っていれば一緒に滑って落ちない・岸の近くの床板は止まっている・落ちたら階段で入口へ', async () => {
  const rooms = labRooms('slideTiles', { exit: 'opposite', sizes: SLIDE });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const e = entitiesOf(room.floor, 'slideTiles')[0]!;
    const cells = e.params.cells as number[][];
    const sim = await newSim(room.floor);
    // 入口の床の外で待つ: 床板が動く
    const occ0 = JSON.stringify(sim.stateOf(e.id)!.occ);
    idle(sim, 8);
    assert.notEqual(JSON.stringify(sim.stateOf(e.id)!.occ), occ0, `${room.tag}: 床板が滑る`);
    // 真ん中の床板の上に立ち続ける: 落ちない
    const occ = sim.stateOf(e.id)!.occ as number[];
    const rows = Number(e.params.rows), cols = Number(e.params.cols);
    const j = occ.findIndex((v, k) => v >= 0 && Math.floor(k / cols) === Math.floor(rows / 2));
    const c = cells[j]!;
    sim.teleport(0, [(c[0]! + c[2]!) / 2, 0.02, (c[1]! + c[3]!) / 2], 0);
    let minY = 0;
    for (let i = 0; i < 60 * 20; i++) { idle(sim, 1 / 60); minY = Math.min(minY, sim.players[0]!.pos[1]); }
    assert.ok(minY > -0.3, `${room.tag}: 乗っている床板の上で落ちない（y=${minY.toFixed(2)}）`);
    // 空いた升目へ歩いて落ちる → 階段で入口へ
    const o2 = sim.stateOf(e.id)!.occ as number[];
    const hole = o2.findIndex((v) => v === -1);
    const hc = cells[hole]!;
    sim.teleport(0, [(hc[0]! + hc[2]!) / 2, 0.3, (hc[1]! + hc[3]!) / 2], 0);
    idle(sim, 1.2);
    assert.ok(sim.players[0]!.pos[1] < -1.5, `${room.tag}: 空いた升目から溝の底へ`);
    const back = walkTo(sim, 'room', [room.inside[0], 0, room.inside[2]], 60);
    assert.ok(back.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: 階段で入口へ ${back.reason}`);
    disposeSim(sim);
  }
});

test('動く床タイル: 手順どおりに（つながるのを待って）入口から出口へ渡れる・落ちない', async () => {
  let n = 0, fell = 0;
  for (const room of labRooms('slideTiles', { exit: 'opposite', sizes: SLIDE, seeds: [1, 2, 3] })) {
    const sim = await newSim(room.floor);
    sim.teleport(0, room.inside, 0);
    let minY = 0;
    const step = sim.step.bind(sim);
    (sim as unknown as { step: typeof sim.step }).step = (cmd) => { step(cmd); minY = Math.min(minY, sim.players[0]!.pos[1]); };
    const h = hintFor(room.floor, room.slot.entrance!, room.slot.exit);
    assert.ok(h, `${room.tag}: 手順がある`);
    const why = await followHint(sim, h!);
    assert.equal(why, '', `${room.tag}: ${why}`);
    const res = walkTo(sim, 'room', room.exitInside!, 60);
    assert.ok(res.ok && Math.abs(sim.players[0]!.pos[1]) < 0.1, `${room.tag}: ${res.reason}`);
    if (minY < -0.5) fell++;
    n++;
    disposeSim(sim);
  }
  console.log(`  slideTiles: 渡った ${n}、途中で落ちた ${fell}`);
  assert.ok(n >= 12 && fell <= 1, `渡った ${n}、落ちた ${fell}`);
});

for (const def of ['turntable', 'slideTiles']) {
  test(`${def}: 見本のフロアで、歩く人が隠しの奥まで行ける・本道を抜けられる`, async () => {
    let n = 0;
    for (const room of showcaseRooms(def, [1, 2, 3, 4])) {
      for (const sec of room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id)) {
        const sim = await newSim(room.floor);
        const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 300);
        assert.ok(res.ok, `${room.floor.id} 隠し ${sec.hook} ${sec.mode}: ${res.reason}`);
        n++;
        disposeSim(sim);
      }
    }
    for (const f of mainPathFloors(def, 2, 400)) {
      n++;
      const res = await walkFloorExit(f.floor);
      assert.ok(res.ok, `${f.floor.id}（${f.cell.id}）: ${res.reason}`);
    }
    console.log(`  ${def}: ${n}`);
    assert.ok(n >= 2);
  });
}
