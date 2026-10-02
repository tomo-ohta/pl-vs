/**
 * 機械: エレベーター（liftCabin・D04 / BX06）・自販機（vendingRoom・D05 / BX07）。
 * - エレベーター: 階のボタンで戸が閉まって動き、押していない階へ（floor.goto。1 つ下を押すと裏のフロア）・戸の所に人がいると閉まらない・
 *   乗っていなければ動かない・存在しない階のボタンを傷の数の順に押すと奥の壁が開く（違う順では開かない）
 * - 自販機: 押すと缶が落ちて部屋の照明の色が変わる・同じボタンを続けて押すと鍵・鍵を取ると点検口が開く（違うボタンを挟むと鍵は出ない）
 * - 見本のフロアで、隠しの奥まで行ける
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, newSim, press, showcaseRooms, T } from './ground-lab.ts';

type Btn = { label: string; to: string | null; cur: boolean; fake: boolean; scratches: number; center: number[] };

test('エレベーター: 呼ぶと来て開く・階のボタンで動いて押していない階へ・戸の所に人がいると閉まらない・存在しない階を傷の順に押すと奥の壁が開く', async () => {
  const rooms = labRooms('liftCabin', { exit: 'opposite' });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const cab = entitiesOf(room.floor, 'liftCabin')[0]!;
    const btns = cab.params.buttons as unknown as Btn[];
    assert.equal(btns.filter((b) => b.fake).length, 3, `${room.tag}: 存在しない階 3 つ`);
    const order = cab.params.order as number[];
    assert.deepEqual(order.map((i) => btns[i]!.scratches), [1, 2, 3], `${room.tag}: 傷の数の順`);
    const sim = await newSim(room.floor);
    const face = cab.params.facing as number[];
    const inside = cab.params.inside as { min: number[]; max: number[] };
    const ic = [(inside.min[0]! + inside.max[0]!) / 2, 0.02, (inside.min[2]! + inside.max[2]!) / 2];
    // 戸は閉まっている（来ていない）。▼ を押すと、しばらくで来て開く
    const call = cab.params.call as number[];
    sim.teleport(0, [call[0]! + face[0]! * 0.75, 0.02, call[2]! + face[2]! * 0.75], 0);
    idle(sim, 0.5);
    assert.equal(sim.outputOf(cab.id, 'open'), 0, `${room.tag}: 最初は閉まっている`);
    press(sim, call);
    idle(sim, 1.0);
    assert.equal(sim.outputOf(cab.id, 'open'), 0, `${room.tag}: すぐには開かない`);
    idle(sim, 3.0);
    assert.equal(sim.outputOf(cab.id, 'open'), 1, `${room.tag}: 来て開く`);
    const res = walkTo(sim, 'room', ic as [number, number, number], 20);
    assert.ok(res.ok, `${room.tag}: かごに入れる ${res.reason}`);
    const pressBtn = (i: number): void => {
      const b = btns[i]!;
      sim.teleport(0, [b.center[0]! - face[0]! * 0.7, 0.02, b.center[2]! - face[2]! * 0.7], 0);
      idle(sim, 0.1);
      press(sim, b.center);
      idle(sim, 0.1);
    };
    // 違う順: 開かない。傷の数の順: 開く
    pressBtn(order[1]!); pressBtn(order[0]!); pressBtn(order[2]!);
    assert.equal(sim.outputOf(cab.id, 'secret'), 0, `${room.tag}: 違う順では開かない`);
    for (const i of order) pressBtn(i);
    assert.equal(sim.outputOf(cab.id, 'secret'), 1, `${room.tag}: 傷の数の順で開く`);
    // 本当の階（今の階でない）: 戸が閉まって動き、floor.goto
    const ri = btns.findIndex((b) => !b.fake && !b.cur);
    sim.drainEvents();
    pressBtn(ri);
    let goto: { to?: unknown } | null = null, rode = false;
    for (let i = 0; i < 60 * 12 && !goto; i++) {
      idle(sim, 1 / 60);
      if (sim.outputOf(cab.id, 'riding')) rode = true;
      for (const e of sim.drainEvents()) if (e.type === 'cue' && e.data?.name === 'floor.goto') goto = e.data as { to?: unknown };
    }
    assert.ok(rode && goto, `${room.tag}: 動いて floor.goto`);
    assert.equal(goto!.to ?? null, btns[ri]!.to, `${room.tag}: 行き先`);
    idle(sim, 3);
    assert.equal(sim.outputOf(cab.id, 'open'), 1, `${room.tag}: 移らなければ戸が開く`);
    // 戸の所に立って押すと閉まらない（動かない）
    const gap = cab.params.gap as { min: number[]; max: number[] };
    sim.teleport(0, [(gap.min[0]! + gap.max[0]!) / 2, 0.02, (gap.min[2]! + gap.max[2]!) / 2], 0);
    idle(sim, 0.2);
    press(sim, btns[ri]!.center);
    let moved = false;
    for (let i = 0; i < 60 * 5; i++) { idle(sim, 1 / 60); if (sim.outputOf(cab.id, 'riding')) moved = true; }
    assert.ok(!moved, `${room.tag}: 戸の所に人がいると閉まらない`);
    // 誰もいなくなると、しばらくで閉まって行ってしまう
    sim.teleport(0, room.inside, 0);
    idle(sim, 16);
    assert.equal(sim.outputOf(cab.id, 'open'), 0, `${room.tag}: 誰もいなければ閉まる`);
    disposeSim(sim);
  }
});

test('自販機: 押すと缶が落ちて照明の色が変わる・同じボタンを続けて押すと鍵・鍵を取ると点検口が開く', async () => {
  const rooms = labRooms('vendingRoom', { exit: 'opposite' });
  assert.equal(new Set(rooms.map((r) => r.entry)).size, 4);
  for (const room of rooms) {
    const v = entitiesOf(room.floor, 'vending')[0]!;
    const btns = entitiesOf(room.floor, 'pushButton').filter((e) => !e.params.hidden);
    const slot = entitiesOf(room.floor, 'pushButton').find((e) => e.params.hidden)!;
    const sim = await newSim(room.floor);
    const c = (e: (typeof btns)[number]): number[] => { const b = e.params.box as { min: number[]; max: number[] }; return [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2]; };
    const dir = v.params.dir as number[];
    const stand = (p: number[]): void => { sim.teleport(0, [p[0]! + dir[0]! * 0.9, 0.02, p[2]! + dir[2]! * 0.9], 0); idle(sim, 0.1); };
    stand(c(btns[0]!));
    press(sim, c(btns[0]!)); idle(sim, 0.2);
    assert.equal(sim.outputOf(v.id, 'c1'), 1, `${room.tag}: 赤い缶で赤い照明`);
    assert.equal(sim.outputOf(v.id, 'c0'), 0);
    press(sim, c(btns[1]!)); idle(sim, 0.2);
    assert.equal(sim.outputOf(v.id, 'c2'), 1, `${room.tag}: 青い缶で青い照明`);
    // 違うボタンを挟むと鍵は出ない
    for (let i = 0; i < 4; i++) { press(sim, c(btns[2]!)); idle(sim, 0.2); }
    press(sim, c(btns[0]!)); idle(sim, 0.2);
    assert.equal(sim.outputOf(v.id, 'key'), 0, `${room.tag}: 挟むと鍵は出ない`);
    for (let i = 0; i < T['ground.vend.keyAfter']; i++) { press(sim, c(btns[2]!)); idle(sim, 0.2); }
    assert.equal(sim.outputOf(v.id, 'key'), 1, `${room.tag}: 同じボタンを続けて押すと鍵`);
    assert.equal(sim.outputOf(v.id, 'taken'), 0);
    const sc = c(slot);
    stand(sc);
    press(sim, sc); idle(sim, 0.2);
    assert.equal(sim.outputOf(v.id, 'taken'), 1, `${room.tag}: 取り出し口から鍵を取る`);
    assert.equal(room.offers[0]!.revealOutput, `${v.id}.taken`);
    disposeSim(sim);
  }
});

for (const def of ['liftCabin', 'vendingRoom']) {
  test(`${def}: 見本のフロアで、歩く人が隠しの奥まで行ける`, async () => {
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
    console.log(`  ${def}: ${n}`);
    assert.ok(n >= 1);
  });
}
