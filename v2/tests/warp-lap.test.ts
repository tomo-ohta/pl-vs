/**
 * 異変の廊下（anomalyHall: X01・BX01）: 1 周ずらしても・180° 回しても見える範囲の箱が同じ（継ぎ目が見えない）・
 * 移す所（曲がりの真ん中）から異変を置く所は見えない・正しく進む / 引き返すと数が増え goal で出口・間違えると 0・
 * 数が 0 なら引き返して来た道へ戻れる・引き返さずに異変のある周を 3 回進むと隠し（BX01）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
import { aabbCenter, type AABB } from '../core/math/aabb.ts';
import type { Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { readXform, type Xform } from '../core/sim/parts/warp/util.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith, twinMismatch } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('anomalyHall', 5, { maxWorld: 300 });
const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const cellOf = (f: FloorLayout, id: string) => f.cells.find((c) => c.id === id)!;

interface Lap { g1: { center: Vec3; dir: number; box: AABB }; g0: { center: Vec3; dir: number; box: AABB }; lap: Xform; turn: Xform; zone: AABB; anomalies: { id: string }[] }
const lapOf = (room: GimmickRoom): Lap => {
  const p = ent(room.floor, `${room.id}.lap`).params as unknown as Lap & { lap: never; turn: never };
  return { ...p, lap: readXform(p.lap), turn: readXform(p.turn) };
};
/** 区画の足跡の内側（端から 0.01 m 内側。高さは床から天井まで） */
const insideOf = (f: FloorLayout, id: string): AABB => {
  const c = cellOf(f, id), r = c.footprint[0]!;
  return { min: [r.x0 + 0.01, c.floorY - 0.25, r.z0 + 0.01], max: [r.x1 - 0.01, c.floorY + c.height + 0.25, r.z1 - 0.01] };
};
/** 区画の足跡の、点 at から 4 m の所（廊下の端の見える範囲） */
function endPart(f: FloorLayout, id: string, at: Vec3): AABB {
  const a = insideOf(f, id);
  const long = a.max[0] - a.min[0] > a.max[2] - a.min[2] ? 0 : 2;
  const out: AABB = { min: [...a.min], max: [...a.max] };
  if (Math.abs(at[long]! - a.min[long]!) < Math.abs(at[long]! - a.max[long]!)) out.max[long] = a.min[long]! + 4 - 0.02;
  else out.min[long] = a.max[long]! - 4 + 0.02;
  return out;
}

test('異変の廊下: 1 周ずらしても・180° 回しても見える範囲の箱が同じ・双子の部屋も同じ', () => {
  assert.ok(ROOMS.length >= 3, `異変の廊下: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor, R = room.cell.id;
    const L = lapOf(room);
    const id = (s: string): string => `${R}~x${s}`;
    // 1 周: S1 → S0、C0 の終わり → P の終わり、C1 の始まり → C0 の始まり
    const S1 = insideOf(f, id('S1'));
    assert.deepEqual(twinMismatch(f, L.lap, S1), [], `${f.id} ${R}: S1 → S0`);
    const c0end = endPart(f, id('C0'), cellOf(f, id('S1')).bounds.min);
    const c1start = endPart(f, id('C1'), aabbCenter(cellOf(f, id('S1')).bounds));
    assert.deepEqual(twinMismatch(f, L.lap, c0end), [], `${R}: C0 の終わり → P の終わり`);
    assert.deepEqual(twinMismatch(f, L.lap, c1start), [], `${R}: C1 の始まり → C0 の始まり`);
    // 180°: S0 → S0、P の終わり → C0 の始まり
    assert.deepEqual(twinMismatch(f, L.turn, insideOf(f, id('S0'))), [], `${R}: S0 を回しても同じ`);
    const pEnd = endPart(f, id('P'), aabbCenter(cellOf(f, id('S0')).bounds));
    assert.deepEqual(twinMismatch(f, L.turn, pEnd), [], `${R}: P の終わり → C0 の始まり`);
    // 双子の部屋（入口 R'・出口 Q'）
    const ante = ent(f, `${room.id}.ante`).params as { copies: { xform: unknown }[] };
    const r = room.cell.footprint[0]!;
    const inside: AABB = { min: [r.x0 + 0.01, room.cell.floorY - 0.25, r.z0 + 0.01], max: [r.x1 - 0.01, room.cell.floorY + room.cell.height + 0.25, r.z1 - 0.01] };
    for (const c of ante.copies) assert.deepEqual(twinMismatch(f, readXform(c.xform as never), inside), [], `${R}: 双子の部屋`);
  }
});

test('異変の廊下: 移す所（曲がりの真ん中）からは、異変を置く所が見えない', () => {
  for (const room of ROOMS) {
    const f = room.floor;
    const sim = new Sim(f, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
    const L = lapOf(room);
    const z = L.zone;
    const pts: Vec3[] = [];
    for (let i = 0; i <= 8; i++) for (const yy of [0.2, 1.2, 2.3]) for (const k of [0.15, 0.5, 0.85]) pts.push([z.min[0] + ((z.max[0] - z.min[0]) * i) / 8, z.min[1] + yy, z.min[2] + (z.max[2] - z.min[2]) * k]);
    for (const g of [L.g0, L.g1]) {
      // 移す tick の目の位置: 面の上（進む向きに ±0.1 m）・廊下の幅のどこか・立っている / しゃがんでいる
      const alongZ = g.dir % 2 === 0;
      for (const da of [-0.1, 0, 0.1]) for (const dl of [-0.8, -0.4, 0, 0.4, 0.8]) for (const eye of [0.75, 1.6]) {
        const e: Vec3 = [g.center[0] + (alongZ ? dl : da), g.center[1] + eye, g.center[2] + (alongZ ? da : dl)];
        const seen = pts.filter((p) => sim.sightClear(e, p));
        assert.equal(seen.length, 0, `${room.cell.id}: 曲がりの真ん中から異変の所が見える（${seen.length}）`);
      }
    }
  }
});

/** 周を回る運転: C0 の真ん中で異変を見て、進む / 引き返す（答えは部品の状態を読む）。移されたら true */
function drive(room: GimmickRoom, sim: Sim): { forward(): boolean; back(): boolean; look(): number } {
  const f = room.floor, R = room.cell.id, ctrl = `${room.id}.lap`;
  const L = lapOf(room);
  const id = (s: string): string => `${R}~x${s}`;
  const c0 = cellOf(f, id('C0'));
  // C0 の真ん中（異変を置く所の真ん中）
  const zc = aabbCenter(L.zone);
  const walk = (cell: string, at: Vec3): void => { const r = walkTo(sim, cell, at, 40); assert.ok(r.ok, `${cell}: ${r.reason}`); };
  // 面へ向かって歩き、移されたらやめる（移されると向きも回る: 180° 回されたあとも同じ向きの操作を続けると、また面を越えてしまう）
  const push = (g: { center: Vec3; dir: number }): boolean => {
    const v = [[0, 1], [1, 0], [0, -1], [-1, 0]][g.dir & 3]!;
    const yaw = Math.atan2(-v[0]!, -v[1]!);
    for (let i = 0; i < 90; i++) if (stepWith(sim, 1, () => ({ yaw, moveY: 1 })).length) { stepWith(sim, 5, () => ({})); return true; }
    return false;
  };
  const before = (g: { center: Vec3; dir: number }, d: number): Vec3 => { const v = [[0, 1], [1, 0], [0, -1], [-1, 0]][g.dir & 3]!; return [g.center[0] - v[0]! * d, c0.floorY, g.center[2] - v[1]! * d]; };
  return {
    look() { walk(c0.id, [zc[0], c0.floorY, zc[2]]); sim.drainEvents(); return Number(sim.stateOf(ctrl)?.anomaly ?? -1); },
    forward() { walk(id('S1'), before(L.g1, 0.5)); sim.drainEvents(); return push(L.g1); },
    back() { walk(id('S0'), before(L.g0, 0.5)); sim.drainEvents(); return push(L.g0); },
  };
}

test('異変の廊下: 異変があれば引き返し・無ければ進むと数が増え、goal で出口の周（奥へ進める）・間違えると 0 に戻る・出口から元の部屋へ', () => {
  const kinds = new Set<string>();
  for (const room of ROOMS) {
    const f = room.floor, ctrl = `${room.id}.lap`;
    const sim = new Sim(f, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
    sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], faceTo(room.inside, aabbCenter(room.cell.bounds)));
    assert.ok(walkTo(sim, `${room.cell.id}~xS0`, undefined, 60).ok, '控え室から異変の廊下へ');
    const d = drive(room, sim);
    // わざと間違える: 最初の周（異変なし）で引き返す → 数 0 のままなので、来た道へ（移されない）
    assert.equal(d.look(), -1, '最初の周は異変なし');
    assert.equal(d.back(), false, `${room.cell.id}: 数 0 の周で引き返すと、移されずに来た道へ`);
    // 進んで周を回る（正しく答える）
    const goal = t['warp.lapHall.goal'];
    let laps = 0;
    while (!sim.stateOf(ctrl)?.exit && laps < 40) {
      const a = d.look();
      if (a >= 0) kinds.add(lapOf(room).anomalies[a]!.id);
      const before = Number(sim.stateOf(ctrl)?.count);
      const warped = a >= 0 ? d.back() : d.forward();
      assert.ok(warped, `${room.cell.id}: 周の終わりで移される`);
      assert.equal(Number(sim.stateOf(ctrl)?.count), before + 1, '正しければ数が増える');
      laps++;
    }
    assert.equal(sim.stateOf(ctrl)?.count, goal, `${room.cell.id}: goal で出口の周（${laps} 周）`);
    // 出口の周は進んでも移されず、奥の双子の部屋 → 元の部屋へ
    assert.equal(d.look(), -1, '出口の周は異変なし');
    assert.equal(d.forward(), false, '出口の周は移されない');
    assert.ok(walkTo(sim, `${room.cell.id}~xq`, undefined, 60).ok, '奥の双子の部屋へ');
    assert.ok(walkTo(sim, room.cell.id, undefined, 60).ok, '元の部屋へ');
    // もう一度入って、わざと間違える（異変のある周で進む / 無い周で引き返す）と 0 に戻る
  }
  console.log(`  見た異変 ${kinds.size} 種: ${[...kinds].join(', ')}`);
  assert.ok(kinds.size >= 5, '異変が何種類も出る');
});

test('異変の廊下: 間違えると数が 0 に戻り、次の周は異変なし・BX01 引き返さずに異変のある周を 3 回進むと隠しの扉が現れる', () => {
  let revealed = 0;
  // 出口の周にならないように goal を大きく（正しく進む周も混ざるので）
  const tt = makeTuning({ "warp.lapHall.goal": 12 }).tuning;
  for (const room of findRooms("anomalyHall", 4, { maxWorld: 300, t: tt })) {
    const f = room.floor, ctrl = `${room.id}.lap`;
    const sim = new Sim(f, { tuning: tt, physics: new PhysicsWorld(RAPIER, 1 / 60) });
    sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], 0);
    assert.ok(walkTo(sim, `${room.cell.id}~xS0`, undefined, 60).ok);
    const d = drive(room, sim);
    let run = 0, guard = 0;
    while (!sim.stateOf(ctrl)?.secret && guard++ < 60) {
      const a = d.look();
      if (a >= 0) {
        // 異変があるのに進む（間違い）: 数は 0 に戻り、次の周は異変なし
        assert.ok(d.forward());
        run++;
        assert.equal(sim.stateOf(ctrl)?.count, 0, '間違えると 0');
        if (!sim.stateOf(ctrl)?.secret) assert.equal(sim.stateOf(ctrl)?.anomaly, -1, '間違えた次の周は異変なし');
      } else {
        // 異変が無い: 正しく進む（数を増やして、異変のある周を待つ）。続けて間違えた数は数え直し
        assert.ok(d.forward());
        run = 0;
      }
    }
    assert.equal(sim.stateOf(ctrl)?.secret, 1, `${room.cell.id}: 引き返さずに異変のある周を 3 回進んだ`);
    const sec = room.r.gimmicks!.secrets.find((s) => s.host === `${room.cell.id}~xC0`);
    if (sec) { revealed++; assert.ok(sim.isRevealed(`${sec.id}.wall`), '異変の部屋の扉が現れる'); }
  }
  console.log(`  異変の部屋 ${revealed}`);
});

test('異変の廊下: 決定的', () => {
  for (const room of ROOMS.slice(0, 2)) {
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.cells.filter((c) => c.pocket === room.id).map((c) => [c.id, c.bounds, c.boxes.length])), JSON.stringify(room.floor.cells.filter((c) => c.pocket === room.id).map((c) => [c.id, c.bounds, c.boxes.length])));
  }
});
