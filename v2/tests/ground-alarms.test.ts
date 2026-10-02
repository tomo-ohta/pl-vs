/**
 * 壁の装置: 回転灯と警報（alarmRoom・D09）・ブレーカー（breakerRoom・D10）・ダイヤル錠（dialSafe・D11）・呼び出しボタン（callBell・D12）。
 * - 警報: 押すと鳴り、鳴っている間だけ鋼鉄の扉が開く（止むと閉まる）。中の側から近づけば開く（閉じ込めない）
 * - ブレーカー: レバーで部屋の照明が消える・戻る。消すと隠しが現れる出力
 * - ダイヤル錠: 張り紙の色の数字に合わせると開く（1 つ多く回すと開かない）
 * - 呼び出しボタン: 押すと、しばらくして遠くでベルが 3 回鳴り、扉が開く
 * - 見本のフロアで、隠しの奥まで行ける（隠しが無いと成り立たない仕掛けなので、置いたら必ず隠しがある）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTo } from './helpers/bot.ts';
import { disposeSim, entitiesOf, idle, labRooms, newSim, press, showcaseRooms, T } from './ground-lab.ts';

const center = (b: { min: number[]; max: number[] }): number[] => [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];

/** ボタンの前 0.8 m に立って押す */
function pushAt(sim: Awaited<ReturnType<typeof newSim>>, room: { cell: { bounds: { min: number[]; max: number[] } } }, at: number[]): void {
  const c = center(room.cell.bounds);
  const l = Math.hypot(c[0]! - at[0]!, c[2]! - at[2]!);
  sim.teleport(0, [at[0]! + ((c[0]! - at[0]!) / l) * 0.8, 0.02, at[2]! + ((c[2]! - at[2]!) / l) * 0.8], 0);
  idle(sim, 0.1);
  press(sim, at);
  idle(sim, 0.1);
}

test('警報: 押すと鳴り、鳴っている間だけ鋼鉄の扉が開く・中から近づけば開く', async () => {
  const rooms = labRooms('alarmRoom', { exit: 'opposite' });
  assert.ok(rooms.length >= 6, `部屋 ${rooms.length}`);
  for (const room of rooms) {
    assert.equal(room.offers.length, 1);
    assert.ok(room.offers[0]!.required);
    const btn = entitiesOf(room.floor, 'pushButton')[0]!;
    const alarm = entitiesOf(room.floor, 'alarm')[0]!;
    const door = entitiesOf(room.floor, 'securityDoor')[0]!;
    const sim = await newSim(room.floor);
    idle(sim, 1);
    assert.equal(sim.outputOf(door.id, 'open'), 0, `${room.tag}: 閉まっている`);
    pushAt(sim, room, center(btn.params.box as never));
    idle(sim, 1.5);
    assert.equal(sim.outputOf(alarm.id, 'on'), 1, `${room.tag}: 鳴る`);
    assert.equal(sim.outputOf(door.id, 'open'), 1, `${room.tag}: 鳴っている間は開く`);
    idle(sim, T['ground.alarm.sec'] + 1.5);
    assert.equal(sim.outputOf(alarm.id, 'on'), 0);
    assert.equal(sim.outputOf(door.id, 'open'), 0, `${room.tag}: 止むと閉まる`);
    // 中の側（壁の向こう）から近づくと開く
    const pc = center(door.params.panel as never);
    const out = door.params.out as number[];
    sim.teleport(0, [pc[0]! + out[0]! * 1.0, 0.02, pc[2]! + out[1]! * 1.0], 0);
    idle(sim, 1.5);
    assert.equal(sim.outputOf(door.id, 'open'), 1, `${room.tag}: 中からは開く`);
    disposeSim(sim);
  }
});

test('ブレーカー: レバーで部屋の照明が消え、戻る・消すと隠しの出力が入る', async () => {
  const rooms = labRooms('breakerRoom', { exit: 'opposite' });
  assert.ok(rooms.length >= 6);
  for (const room of rooms) {
    const lever = entitiesOf(room.floor, 'pushButton')[0]!;
    const brk = entitiesOf(room.floor, 'breaker')[0]!;
    const lamp = entitiesOf(room.floor, 'lamp')[0]!;
    assert.equal(room.offers[0]!.revealOutput, `${brk.id}.off`);
    assert.ok(room.cell.lights.some((l) => l.lampId === lamp.id), `${room.tag}: 部屋の照明が部品につながる`);
    const sim = await newSim(room.floor);
    idle(sim, 0.5);
    assert.equal(sim.outputOf(lamp.id, 'on'), 1);
    pushAt(sim, room, center(lever.params.box as never));
    idle(sim, 0.5);
    assert.equal(sim.outputOf(brk.id, 'off'), 1, `${room.tag}: 落とす`);
    assert.equal(sim.outputOf(lamp.id, 'on'), 0, `${room.tag}: 照明が消える`);
    assert.ok(((brk.params.signs as unknown[]) ?? []).length >= 2, `${room.tag}: 非常口の印`);
    pushAt(sim, room, center(lever.params.box as never));
    idle(sim, 0.5);
    assert.equal(sim.outputOf(lamp.id, 'on'), 1, `${room.tag}: 戻る`);
    disposeSim(sim);
  }
});

test('ダイヤル錠: 張り紙の色の数字に合わせると開く・1 つ多く回すと開かない', async () => {
  const rooms = labRooms('dialSafe', { exit: 'opposite' });
  assert.ok(rooms.length >= 6);
  for (const room of rooms) {
    const lock = entitiesOf(room.floor, 'dialLock')[0]!;
    const code = lock.params.code as number[];
    const clues = lock.params.clues as number[][];
    assert.equal(clues.length, 3, `${room.tag}: 張り紙 3 枚`);
    const dials = (lock.params.dials as number[][]);
    const sim = await newSim(room.floor);
    // 1 桁目だけ 1 つ多く回す → 開かない
    for (let i = 0; i < 3; i++) for (let k = 0; k < code[i]! + (i === 0 ? 1 : 0); k++) pushAt(sim, room, dials[i]!);
    assert.equal(sim.outputOf(lock.id, 'open'), 0, `${room.tag}: 違う数字では開かない`);
    // 1 桁目を一周させて合わせる
    for (let k = 0; k < 9; k++) pushAt(sim, room, dials[0]!);
    assert.equal(sim.outputOf(lock.id, 'open'), 1, `${room.tag}: 合わせると開く`);
    disposeSim(sim);
  }
});

test('呼び出しボタン: 押すと、しばらくして遠くでベルが 3 回鳴り、扉が開く', async () => {
  const rooms = labRooms('callBell', { exit: 'opposite', sizes: [{ w: 6.6, d: 8.0 }, { w: 8.6, d: 12, kind: 'hall' }] });
  assert.ok(rooms.length >= 6, `部屋 ${rooms.length}`);
  for (const room of rooms) {
    const btn = entitiesOf(room.floor, 'pushButton')[0]!;
    const bell = entitiesOf(room.floor, 'callBell')[0]!;
    const sim = await newSim(room.floor);
    pushAt(sim, room, center(btn.params.box as never));
    sim.drainEvents();
    idle(sim, 1.0);
    assert.equal(sim.outputOf(bell.id, 'open'), 0, `${room.tag}: すぐには開かない`);
    let rings = 0;
    for (let i = 0; i < 60 * 6; i++) { idle(sim, 1 / 60); for (const e of sim.drainEvents()) if (e.type === 'cue' && e.data?.name === 'bell.ring') rings++; }
    assert.equal(rings, 3, `${room.tag}: ベルが 3 回`);
    assert.equal(sim.outputOf(bell.id, 'open'), 1, `${room.tag}: 扉が開く`);
    // ベルの鳴る所は、ボタンから遠い
    const at = bell.params.at as number[];
    const bc = center(btn.params.box as never);
    assert.ok(Math.hypot(at[0]! - bc[0]!, at[2]! - bc[2]!) > 4, `${room.tag}: 遠くで鳴る`);
    disposeSim(sim);
  }
});

for (const def of ['alarmRoom', 'breakerRoom', 'dialSafe', 'callBell']) {
  test(`${def}: 見本のフロアで、歩く人が隠しの奥まで行ける`, async () => {
    let n = 0;
    for (const room of showcaseRooms(def, [1, 2, 3, 4])) {
      const secs = room.r.gimmicks!.secrets.filter((x) => x.host === room.cell.id);
      assert.ok(secs.length >= 1, `${room.floor.id}: 隠しが付いている`);
      for (const sec of secs) {
        const sim = await newSim(room.floor);
        const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 300);
        assert.ok(res.ok, `${room.floor.id} 隠し ${sec.hook} ${sec.mode}: ${res.reason}`);
        n++;
        disposeSim(sim);
      }
    }
    console.log(`  ${def}: ${n}`);
    assert.ok(n >= 2);
  });
}
