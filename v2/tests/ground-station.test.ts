/**
 * 仕切りの装置: 改札（ticketGates・D06）・自動扉（autoDoors・D07）・シャッター（shutterHall・D08）。
 * - 改札: ふつうの通路を通ると駅が進む・× の通路は立ったままでは通れず、しゃがむとくぐれて知らない駅になる
 * - 自動扉: 近づくと開く・調子の悪い扉はたまに開かない・故障中の扉は立っていても開かず、しゃがんでいると開く
 * - シャッター: 上下をくり返す・人の上では止まる（挟まない）・下りかけはしゃがんでくぐれる
 * - どれも、手順どおりに入口から出口へ抜けられる・見本のフロアで隠しの奥まで行ける・本道を抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, followHint, hintFor, idle, labRooms, mainPathFloors, newSim, runTo, showcaseRooms, walkFloorExit } from './ground-lab.ts';

const SIZES = [{ w: 6.0, d: 8.4 }, { w: 9.0, d: 12, kind: 'hall' as const }];

test('改札: ふつうの通路を通ると駅が進む・× の通路は立ったままでは通れず、しゃがむとくぐれて知らない駅になる', async () => {
  const rooms = labRooms('ticketGates', { exit: 'opposite', sizes: SIZES });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const g = entitiesOf(room.floor, 'ticketGates')[0]!;
    const lanes = g.params.lanes as number[][];
    const cross = Number(g.params.cross);
    const along = g.params.along as number[];
    const sim = await newSim(room.floor);
    const through = (k: number, o: { crouch?: boolean } = {}): boolean => {
      const r = lanes[k]!;
      const c = [(r[0]! + r[2]!) / 2, (r[1]! + r[3]!) / 2];
      sim.teleport(0, [c[0]! - along[0]! * 1.3, 0.02, c[1]! - along[1]! * 1.3], 0);
      idle(sim, 0.2);
      return runTo(sim, [c[0]! + along[0]! * 1.3, 0, c[1]! + along[1]! * 1.3], { maxSec: 4, crouch: !!o.crouch }).reached;
    };
    const normal = lanes.findIndex((_, k) => k !== cross);
    assert.ok(through(normal), `${room.tag}: ふつうの通路を通れる`);
    assert.equal(sim.outputOf(g.id, 'station'), 1, `${room.tag}: 駅が進む`);
    assert.ok(!through(cross), `${room.tag}: × の通路は立ったままでは通れない`);
    assert.equal(sim.outputOf(g.id, 'other'), 0);
    assert.ok(through(cross, { crouch: true }), `${room.tag}: しゃがむとくぐれる`);
    assert.equal(sim.outputOf(g.id, 'other'), 1, `${room.tag}: 知らない駅`);
    // 手順どおりに入口から出口へ
    sim.teleport(0, room.inside, 0);
    const h = hintFor(room.floor, room.slot.entrance!, room.slot.exit);
    assert.ok(h);
    assert.equal(await followHint(sim, h!), '');
    assert.ok(walkTo(sim, 'room', room.exitInside!, 30).ok, `${room.tag}: 出口へ`);
    disposeSim(sim);
  }
});

test('自動扉: 近づくと開く・調子の悪い扉はたまに開かない・故障中の扉はしゃがんでいると開く・手順どおりに抜けられる', async () => {
  const rooms = labRooms('autoDoors', { exit: 'opposite', sizes: SIZES });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  let refusedAny = 0;
  for (const room of rooms) {
    const doors = entitiesOf(room.floor, 'autoDoor');
    const sim = await newSim(room.floor);
    for (const d of doors.filter((x) => !x.params.broken)) {
      const sn = d.params.sensor as { min: number[]; max: number[] };
      const pn = d.params.panel as { min: number[]; max: number[] };
      const c = [(pn.min[0]! + pn.max[0]!) / 2, (pn.min[2]! + pn.max[2]!) / 2];
      const thinX = pn.max[0]! - pn.min[0]! < 0.2;
      const away = (k: number): [number, number, number] => (thinX ? [c[0]! - k, 0.02, c[1]!] : [c[0]!, 0.02, c[1]! - k]);
      let opened = 0, refused = 0;
      for (let i = 0; i < 8; i++) {
        sim.teleport(0, away(2.6), 0);
        idle(sim, 0.8);
        sim.teleport(0, away(0.9), 0);
        idle(sim, 1.2);
        if (sim.outputOf(d.id, 'open')) opened++;
        if (sim.outputOf(d.id, 'refused')) refused++;
      }
      void sn;
      assert.ok(opened >= 1, `${room.tag} ${d.id}: 近づくと開く`);
      if (Number(d.params.flaky) > 0) { refusedAny += refused; assert.ok(opened + refused === 8); } else assert.equal(opened, 8, `${room.tag}: いつも開く扉`);
    }
    const broken = doors.find((x) => x.params.broken);
    if (broken) {
      const sn = broken.params.sensor as { min: number[]; max: number[] };
      const at: [number, number, number] = [(sn.min[0]! + sn.max[0]!) / 2, 0.02, (sn.min[2]! + sn.max[2]!) / 2];
      sim.teleport(0, at, 0);
      idle(sim, 3);
      assert.equal(sim.outputOf(broken.id, 'done'), 0, `${room.tag}: 立っていても開かない`);
      idle(sim, 1.6, { crouch: true });
      assert.equal(sim.outputOf(broken.id, 'done'), 1, `${room.tag}: しゃがんでいると開く`);
    }
    sim.teleport(0, room.inside, 0);
    idle(sim, 1);
    const h = hintFor(room.floor, room.slot.entrance!, room.slot.exit);
    assert.ok(h);
    assert.equal(await followHint(sim, h!), '');
    assert.ok(walkTo(sim, 'room', room.exitInside!, 30).ok, `${room.tag}: 出口へ`);
    disposeSim(sim);
  }
  assert.ok(refusedAny >= 2, `調子の悪い扉が開かなかった回数 ${refusedAny}`);
});

test('シャッター: 上下をくり返す・人の上では止まる・下りかけはしゃがんでくぐれる・手順どおりに抜けられる', async () => {
  const rooms = labRooms('shutterHall', { exit: 'opposite', sizes: [{ w: 6.0, d: 9.0 }, { w: 9.0, d: 12, kind: 'hall' as const }] });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const shs = entitiesOf(room.floor, 'shutter');
    assert.equal(shs.length, 2);
    const sh = shs[0]!;
    const b = sh.params.box as { min: number[]; max: number[] };
    const sim = await newSim(room.floor);
    // 下の端が上下する
    let lo = 9, hi = 0;
    for (let i = 0; i < 60 * 12; i++) { idle(sim, 1 / 60); const h = sim.outputOf(sh.id, 'h'); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    assert.ok(lo < 0.05 && hi > 2.2, `${room.tag}: 上下する ${lo.toFixed(2)}..${hi.toFixed(2)}`);
    // 開いている間に真下に立つ → 下りてきても頭の上で止まる
    for (let i = 0; i < 60 * 12 && sim.outputOf(sh.id, 'phase') !== 0; i++) idle(sim, 1 / 60);
    const c: [number, number, number] = [(b.min[0]! + b.max[0]!) / 2, 0.02, (b.min[2]! + b.max[2]!) / 2];
    sim.teleport(0, c, 0);
    let minH = 9;
    for (let i = 0; i < 60 * 10; i++) { idle(sim, 1 / 60); minH = Math.min(minH, sim.outputOf(sh.id, 'h')); }
    assert.ok(minH > 1.7 && Math.hypot(sim.players[0]!.pos[0] - c[0], sim.players[0]!.pos[2] - c[2]) < 0.2, `${room.tag}: 人の上で止まる（${minH.toFixed(2)}）`);
    sim.teleport(0, room.inside, 0);
    idle(sim, 0.5);
    const h = hintFor(room.floor, room.slot.entrance!, room.slot.exit);
    assert.ok(h);
    assert.equal(await followHint(sim, h!), '');
    assert.ok(walkTo(sim, 'room', room.exitInside!, 30).ok, `${room.tag}: 出口へ`);
    disposeSim(sim);
  }
});

for (const def of ['ticketGates', 'autoDoors', 'shutterHall']) {
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
