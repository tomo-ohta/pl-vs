/**
 * 落ちてくる天井（ceilingPress・G05）:
 * - 帯が 2 本以上・開口の前は落ちてこない・決まった周期で落ちる（予告 → 落ちる → 上がる）
 * - 帯の上で立ち止まると潰されて、入ってきた開口の前へ戻される。線の上で待てば潰されない
 * - 歩く人（手順あり）が入口から出口へ抜けられる（入口・出口の向き・横の出口）・見本のフロアの本道を抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, followHint, hintFor, idle, labRooms, mainPathFloors, newSim, T, walkFloorExit } from './ground-lab.ts';

const SIZES = [{ w: 6.0, d: 9.0 }, { w: 8.6, d: 12, kind: 'hall' as const }];

test('落ちてくる天井: 帯の上で立ち止まると潰されて戻される・線の上なら潰されない・予告してから落ちる', async () => {
  const rooms = labRooms('ceilingPress', { exit: 'opposite', sizes: SIZES });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const bands = entitiesOf(room.floor, 'ceilingPress');
    assert.ok(bands.length >= 2, `${room.tag}: 帯 ${bands.length}`);
    // 開口の前（1.2 m）は帯に掛からない
    for (const e of bands) {
      const b = e.params.box as { min: number[]; max: number[] };
      for (const o of room.slot.openings) {
        const f = [o.pos[0] + [0, -1, 0, 1][o.dir]! * 1.0, o.pos[2] + [-1, 0, 1, 0][o.dir]! * 1.0];
        assert.ok(!(f[0]! > b.min[0]! - 0.3 && f[0]! < b.max[0]! + 0.3 && f[1]! > b.min[2]! - 0.3 && f[1]! < b.max[2]! + 0.3), `${room.tag}: 開口の前は落ちてこない`);
      }
    }
    const sim = await newSim(room.floor);
    const band = bands[0]!;
    const b = band.params.box as { min: number[]; max: number[] };
    // 帯の真ん中に立ち続ける（上がっている間に立つ） → 予告（warn）が先に来て、潰されて開口の前へ
    idle(sim, 1 / 60);
    for (let i = 0; i < 60 * 8 && sim.outputOf(band.id, 'phase') !== 0; i++) idle(sim, 1 / 60);
    sim.teleport(0,[(b.min[0]! + b.max[0]!) / 2, 0.02, (b.min[2]! + b.max[2]!) / 2], 0);
    let warned = false, hit = false;
    for (let i = 0; i < 60 * 8 && !hit; i++) {
      idle(sim, 1 / 60);
      if (sim.outputOf(band.id, 'warn') > 0 && sim.outputOf(band.id, 'phase') === 1) warned = true;
      if (sim.outputOf(band.id, 'hit') > 0) hit = true;
    }
    assert.ok(warned && hit, `${room.tag}: 予告してから潰す（${warned} ${hit}）`);
    const p = sim.players[0]!.pos;
    assert.ok(room.slot.openings.some((o) => Math.hypot(o.pos[0] - p[0], o.pos[2] - p[2]) < 1.3), `${room.tag}: 開口の前へ戻された (${p.map((v) => v.toFixed(2))})`);
    // 帯と帯の間の線の上で待つ: 潰されない
    const b2 = bands[1]!.params.box as { min: number[]; max: number[] };
    const mid = [(b.min[0]! + b.max[0]! + b2.min[0]! + b2.max[0]!) / 4, 0.02, (b.min[2]! + b.max[2]! + b2.min[2]! + b2.max[2]!) / 4];
    const alongX = Math.abs(b.max[0]! - b.min[0]! - (b2.max[0]! - b2.min[0]!)) < 1e-6 && Math.abs(b.min[0]! - b2.min[0]!) < 1e-6;
    void alongX;
    sim.teleport(0, mid as [number, number, number], 0);
    let hits = 0;
    for (let i = 0; i < 60 * 14; i++) { idle(sim, 1 / 60); hits += sim.outputOf(band.id, 'hit') + sim.outputOf(bands[1]!.id, 'hit'); }
    assert.equal(hits, 0, `${room.tag}: 線の上では潰されない`);
    assert.ok(Math.hypot(sim.players[0]!.pos[0] - mid[0]!, sim.players[0]!.pos[2] - mid[2]!) < 0.3, `${room.tag}: 線の上に立ったまま`);
    disposeSim(sim);
  }
});

test('落ちてくる天井: 歩く人が入口から出口へ抜けられる（向かいの出口・横の出口）', async () => {
  let n = 0;
  for (const exit of ['opposite', 'side'] as const) {
    for (const room of labRooms('ceilingPress', { exit, sizes: SIZES })) {
      const sim = await newSim(room.floor);
      sim.teleport(0, room.inside, 0);
      let hits = 0;
      const step = sim.step.bind(sim);
      (sim as unknown as { step: typeof sim.step }).step = (c) => { step(c); for (const e of entitiesOf(room.floor, 'ceilingPress')) hits += sim.outputOf(e.id, 'hit'); };
      const h = hintFor(room.floor, room.slot.entrance!, room.slot.exit);
      assert.ok(h, `${room.tag} ${exit}: 手順がある`);
      const why = await followHint(sim, h!);
      assert.equal(why, '', `${room.tag} ${exit}: ${why}`);
      const res = walkTo(sim, 'room', room.exitInside!, 120);
      assert.ok(res.ok, `${room.tag} ${exit}: ${res.reason}`);
      assert.equal(hits, 0, `${room.tag} ${exit}: 潰されない`);
      n++;
      disposeSim(sim);
    }
  }
  assert.ok(n >= 12);
});

test('ceilingPress: 見本のフロアの本道を抜けられる', async () => {
  let n = 0;
  for (const f of mainPathFloors('ceilingPress', 3, 400)) {
    n++;
    const res = await walkFloorExit(f.floor);
    assert.ok(res.ok, `${f.floor.id}（${f.cell.id}）: ${res.reason}`);
  }
  console.log(`  ceilingPress: ${n}`);
  assert.ok(n >= 1);
  void T;
});
