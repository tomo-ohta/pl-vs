/**
 * 床の升目の仕掛け: 踏むと鳴る床（chimeTiles・G09）・踏まない区画（avoidTiles・D03）・順番の区画（visitOrder・D02）。
 * - 通り抜けるだけなら何も起きない（本道に置ける）・決まった歩き方をすると解ける（出現型の隠しの出力）・間違えると最初から
 * - 部屋に入ると節を見せる・踏まない区画の白い升目は奥まで 1 本つながっている
 * - 見本のフロアで、歩く人が隠しの奥まで行ける・本道を抜けられる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BotHint } from './helpers/bot.ts';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, mainPathFloors, newSim, showcaseRooms, walkFloorExit } from './ground-lab.ts';

const SIZES = [{ w: 6.6, d: 8.0 }, { w: 8.6, d: 12, kind: 'hall' as const }];
const hintOf = (floor: Parameters<typeof entitiesOf>[0]): BotHint => entitiesOf(floor, 'constant').find((e) => e.params.bot)!.params.bot as unknown as BotHint;

/** 手順の立つ所を順に歩く */
function follow(sim: Awaited<ReturnType<typeof newSim>>, h: BotHint): void {
  for (const st of h.steps) {
    const res = walkTo(sim, 'room', st.at, 30);
    assert.ok(res.ok, res.reason);
    idle(sim, st.wait ?? 0.2);
  }
}

for (const [def, type, out] of [['chimeTiles', 'chimeFloor', 'solved'], ['avoidTiles', 'avoidFloor', 'done'], ['visitOrder', 'visitOrder', 'done']] as const) {
  test(`${def}: 通り抜けるだけでは解けない・決まった歩き方で解ける（隠しが現れる出力）`, async () => {
    const rooms = labRooms(def, { exit: 'opposite', sizes: SIZES });
    assert.equal(new Set(rooms.map((r) => r.entry)).size, 4, `入口の向き: ${[...new Set(rooms.map((r) => r.entry))]}`);
    for (const room of rooms) {
      const e = entitiesOf(room.floor, type)[0]!;
      const offer = room.offers[0]!;
      assert.equal(offer.revealOutput, `${e.id}.${out}`);
      {
        const sim = await newSim(room.floor);
        sim.teleport(0, room.inside, 0);
        const res = walkTo(sim, 'room', room.exitInside!, 40);
        assert.ok(res.ok, `${room.tag}: 通り抜けられる ${res.reason}`);
        assert.equal(sim.outputOf(e.id, out), 0, `${room.tag}: 通り抜けるだけでは解けない`);
        disposeSim(sim);
      }
      const sim = await newSim(room.floor);
      sim.teleport(0, room.inside, 0);
      if (def === 'chimeTiles') {
        // 部屋に入ると節を見せる
        idle(sim, 4);
        const demo = sim.drainEvents().filter((x) => x.type === 'cue' && x.data?.name === 'chime.demo').map((x) => Number(x.data?.tile));
        assert.deepEqual(demo.slice(0, (e.params.seq as number[]).length), e.params.seq, `${room.tag}: 節を見せる`);
      }
      follow(sim, hintOf(room.floor));
      assert.equal(sim.outputOf(e.id, out), 1, `${room.tag}: 解ける`);
      disposeSim(sim);
    }
  });
}

test('踏まない区画: 白い升目は印から目当てまでつながる・赤を踏むと失敗して印からやり直し', async () => {
  for (const room of labRooms('avoidTiles', { exit: 'opposite', sizes: SIZES })) {
    const e = entitiesOf(room.floor, 'avoidFloor')[0]!;
    const tiles = e.params.tiles as number[][];
    const bad = new Set(e.params.bad as number[]);
    // 白い升目の道: 手順の升目は全部白
    const h = hintOf(room.floor);
    for (const st of h.steps) {
      const i = tiles.findIndex((r) => st.at[0] > r[0]! && st.at[0] < r[2]! && st.at[2] > r[1]! && st.at[2] < r[3]!);
      assert.ok(i >= 0 && !bad.has(i), `${room.tag}: 道は白`);
    }
    assert.ok(bad.size >= 2, `${room.tag}: 赤い升目 ${bad.size}/${tiles.length}`);
    // 印に立ってから赤を踏む → 失敗
    const sim = await newSim(room.floor);
    const start = tiles[Number(e.params.start)]!;
    sim.teleport(0, [(start[0]! + start[2]!) / 2, 0.02, (start[1]! + start[3]!) / 2], 0);
    idle(sim, 0.3);
    assert.equal(sim.outputOf(e.id, 'armed'), 1);
    const b = tiles[[...bad][0]!]!;
    walkTo(sim, 'room', [(b[0]! + b[2]!) / 2, 0, (b[1]! + b[3]!) / 2], 30);
    idle(sim, 0.2);
    assert.equal(sim.outputOf(e.id, 'armed'), 0, `${room.tag}: 赤を踏むと失敗`);
    disposeSim(sim);
  }
});

for (const def of ['chimeTiles', 'avoidTiles', 'visitOrder']) {
  test(`${def}: 見本のフロアで、歩く人が隠しの奥まで行ける・本道を抜けられる`, async () => {
    let n = 0;
    for (const room of showcaseRooms(def, [1, 2, 3])) {
      for (const sec of room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id)) {
        const sim = await newSim(room.floor);
        const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 300);
        assert.ok(res.ok, `${room.floor.id} 隠し ${sec.hook}: ${res.reason}`);
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
