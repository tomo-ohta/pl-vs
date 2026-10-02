/**
 * 閉じた輪の廊下（loopHall: W06・BX02）と控え室（3 枚目の扉・双子の部屋）:
 * 双子の部屋が部屋とまったく同じ・廊下が 12 m ずらしても同じ（継ぎ目が見えない）・3 枚目の扉はほかの扉が閉じているときだけ開く・
 * 双子の部屋の扉は元の部屋へ戻す・前へ歩くと戻され lapsOut 周でほどけて奥から最初の部屋（の双子）に出る・
 * 後ろの輪（BX02）・閉じ込めない（時間でほどける）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
import { aabbCenter } from '../core/math/aabb.ts';
import { rotQ, type Dir, type Vec3 } from '../core/math/vec.ts';
import '../core/sim/parts/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith, twinMismatch } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('loopHall', 6, { maxWorld: 200 });

const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const panelCenter = (f: FloorLayout, id: string): Vec3 => aabbCenter(ent(f, id).params.panel as never);
const cellOf = (f: FloorLayout, id: string) => f.cells.find((c) => c.id === id)!;

/** 部屋の中（入口の扉の内側 1.2 m）に立ち、扉の部品が全部閉じた状態のシミュレーション */
function simIn(room: GimmickRoom, tt = t): Sim {
  const sim = new Sim(room.floor, { tuning: tt, physics: new PhysicsWorld(RAPIER, 1 / 60) });
  sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], faceTo(room.inside, aabbCenter(room.cell.bounds)));
  stepWith(sim, 10, () => ({}));
  return sim;
}

/** 扉を調べる（目の高さから板の中心を見る） */
function interact(sim: Sim, door: string): ReturnType<typeof stepWith> {
  const p = sim.players[0]!;
  const c = panelCenter(sim.floor, door);
  const eye = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  const yaw = faceTo(eye, c), pitch = Math.atan2(c[1] - eye[1]!, Math.hypot(c[0] - eye[0]!, c[2] - eye[2]!));
  return stepWith(sim, 1, () => ({ yaw, pitch, interact: { yaw, pitch } }));
}

/** 扉の前（区画 cell の内側へ d m）の点 */
function doorFront(f: FloorLayout, cell: string, door: string, d = 0.9): Vec3 {
  const pn = ent(f, door).params.panel as { min: number[]; max: number[] };
  const c = aabbCenter(pn as never);
  const k = aabbCenter(cellOf(f, cell).bounds);
  const alongX = pn.max[0]! - pn.min[0]! < pn.max[2]! - pn.min[2]!;
  return alongX ? [c[0] + Math.sign(k[0] - c[0]) * d, cellOf(f, cell).floorY, c[2]] : [c[0], cellOf(f, cell).floorY, c[2] + Math.sign(k[2] - c[2]) * d];
}

/** 区画の中の点へ歩く（歩く人）。歩いた間のイベントは捨てる */
function walkIn(sim: Sim, cell: string, at: Vec3): void {
  const r = walkTo(sim, cell, at, 30);
  assert.ok(r.ok, `${cell} の中を歩く: ${r.reason}`);
  sim.drainEvents();
}

test('loopHall が出る・双子の部屋は部屋とまったく同じ・廊下は 1 周ずらしても同じ（見える範囲の箱が揃う）', () => {
  assert.ok(ROOMS.length >= 4, `閉じた輪の廊下: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor;
    const R = room.cell, R1 = cellOf(f, `${R.id}~a1`), H = cellOf(f, `${R.id}~hall`);
    const rise = R1.floorY - R.floorY;
    assert.ok(rise > 50 && Math.abs(rise % 66) < 1e-6, `${R.id}: 双子の部屋は真上（${rise}）`);
    for (const c of f.cells.filter((x) => x.pocket === room.id)) assert.equal(c.role, 'secret', `${c.id}: 別の空間は開口でフロアにつながらない`);
    const r = R.footprint[0]!;
    const inside = { min: [r.x0 + 0.01, R.floorY - 0.25, r.z0 + 0.01] as Vec3, max: [r.x1 - 0.01, R.floorY + R.height + 0.25, r.z1 - 0.01] as Vec3 };
    assert.deepEqual(twinMismatch(f, { from: [0, 0, 0], to: [0, rise, 0], q: 0 }, inside), [], `${f.id} ${R.id}: 双子の部屋`);
    // 廊下: 前の面・後ろの面のまわり（霧の届く範囲）が、1 周ずらしても同じ
    const tm = ent(f, `${room.id}.loop`).params as { origin: Vec3; fwd: number; period: number; front: number; back: number };
    const fw = rotQ([0, 0, 1], tm.fwd as Dir);
    const F = t['warp.loopHall.fogFarM'], P = tm.period;
    const W = t['warp.loopHall.widthM'];
    const lat = rotQ([0, 0, 1], ((tm.fwd + 1) % 4) as Dir);
    const span = (u0: number, u1: number) => {
      const a = [tm.origin[0] + fw[0] * u0 + lat[0] * (W / 2 - 0.01), tm.origin[2] + fw[2] * u0 + lat[2] * (W / 2 - 0.01)];
      const b = [tm.origin[0] + fw[0] * u1 - lat[0] * (W / 2 - 0.01), tm.origin[2] + fw[2] * u1 - lat[2] * (W / 2 - 0.01)];
      return { min: [Math.min(a[0]!, b[0]!), H.floorY - 0.25, Math.min(a[1]!, b[1]!)] as Vec3, max: [Math.max(a[0]!, b[0]!), H.floorY + H.height + 0.25, Math.max(a[1]!, b[1]!)] as Vec3 };
    };
    const back: Vec3 = [-fw[0] * P, 0, -fw[2] * P];
    assert.deepEqual(twinMismatch(f, { from: [0, 0, 0], to: back, q: 0 }, span(tm.front - F, tm.front + F)), [], `${R.id}: 前の面で戻しても同じ`);
    assert.deepEqual(twinMismatch(f, { from: [0, 0, 0], to: [-back[0], 0, -back[2]], q: 0 }, span(tm.back - F, tm.back + F)), [], `${R.id}: 後ろの面で進めても同じ`);
  }
});

test('控え室: 3 枚目の扉はほかの扉が閉じているときだけ開き、双子の部屋へ継ぎ目なく移る・双子の部屋の扉は元の部屋へ戻して本物の扉を開ける', () => {
  for (const room of ROOMS) {
    const f = room.floor, R = room.cell;
    const sim = simIn(room);
    const pod = `${room.id}.pod`;
    walkIn(sim, R.id, doorFront(f, R.id, pod));
    const y0 = sim.players[0]!.pos[1];
    let w = interact(sim, pod);
    assert.equal(w.length, 1, `${R.id}: 扉が閉じていれば移る`);
    assert.ok(w[0]!.data?.seamless, '継ぎ目なく');
    const R1 = `${R.id}~a1`;
    const rise = cellOf(f, R1).floorY - R.floorY;
    assert.ok(Math.abs(sim.players[0]!.pos[1] - y0 - rise) < 1e-6, '真上の双子の部屋へ');
    stepWith(sim, 60, () => ({}));
    assert.ok(Number(sim.stateOf(`${room.id}.a1.pod`)?.angle) > 0.9, '双子の部屋の 3 枚目の扉が開く');
    // 双子の部屋の入口の扉 → 元の部屋へ戻り、本物の入口の扉が開く
    const a1 = `${room.id}.a1.a`;
    walkIn(sim, R1, doorFront(f, R1, a1));
    w = interact(sim, a1);
    assert.equal(w.length, 1, `${R.id}: 双子の部屋の扉で戻る`);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - R.floorY) < 0.5, '元の部屋の高さ');
    const realA = (ent(f, `${room.id}.ante`).params.doors as { a: string }).a;
    stepWith(sim, 50, () => ({}));
    assert.ok(Number(sim.stateOf(realA)?.angle) > 0.5, '本物の扉が開いている');
    // 扉が開いていると 3 枚目の扉は開かない（鍵の音）
    w = interact(sim, realA);
    assert.equal(w.length, 0);
    stepWith(sim, 10, () => ({}));
    walkIn(sim, R.id, doorFront(f, R.id, pod));
    if (Number(sim.stateOf(realA)?.angle) > 0.5) {
      w = interact(sim, pod);
      assert.equal(w.length, 0, `${R.id}: 扉が開いていると移らない`);
    }
  }
});

test('閉じた輪の廊下: 前へ歩くと何度も戻され、lapsOut 周でほどけて奥の扉から最初の部屋（の双子）へ、そこから元の部屋へ（歩く人）', () => {
  for (const room of ROOMS) {
    const f = room.floor, R = room.cell;
    const sim = simIn(room);
    const Q = `${R.id}~a2`;
    let res = walkTo(sim, Q, undefined, 240);
    assert.ok(res.ok, `${f.id} ${R.id}: 奥の双子の部屋へ: ${res.reason}`);
    assert.equal(sim.outputOf(`${room.id}.loop`, 'laps'), t['warp.loopHall.lapsOut'], '前の周');
    res = walkTo(sim, R.id, undefined, 60);
    assert.ok(res.ok, `${R.id}: 元の部屋へ: ${res.reason}`);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - R.floorY) < 0.5);
  }
});

test('BX02: 1 周したあとは後ろも輪・後ろへ lapsBack 周すると後ろの輪がほどけて隠しの入口が現れる', () => {
  let revealed = 0;
  for (const room of ROOMS) {
    const f = room.floor;
    const sim = simIn(room);
    const tread = `${room.id}.loop`;
    const tm = ent(f, tread).params as { origin: Vec3; fwd: number; period: number; front: number; back: number };
    const fw = rotQ([0, 0, 1], tm.fwd as Dir);
    // 廊下の入口の所へ（3 枚目の扉で双子の部屋へ移り、廊下へ）
    assert.ok(walkTo(sim, `${room.cell.id}~hall`, undefined, 60).ok);
    sim.drainEvents();
    const fwdYaw = Math.atan2(-fw[0], -fw[2]);
    const u = (): number => (sim.players[0]!.pos[0] - tm.origin[0]) * fw[0] + (sim.players[0]!.pos[2] - tm.origin[2]) * fw[2];
    // 前へ: 1 回戻されるまで
    let warps = 0;
    for (let i = 0; i < 60 * 30 && warps < 1; i++) warps += stepWith(sim, 1, () => ({ yaw: fwdYaw, moveY: 1 })).length;
    assert.equal(warps, 1, `${room.cell.id}: 前の面で戻された`);
    // 後ろへ: lapsBack 回進められるまで（その後は入口の所へ戻れる）
    warps = 0;
    for (let i = 0; i < 60 * 60 && warps < t['warp.loopHall.lapsBack']; i++) warps += stepWith(sim, 1, () => ({ yaw: fwdYaw, moveY: -1 })).length;
    assert.equal(warps, t['warp.loopHall.lapsBack'], '後ろの面で進められた');
    assert.equal(sim.outputOf(tread, 'back'), 1, '後ろの輪をほどいた');
    for (let i = 0; i < 60 * 12 && u() > 3; i++) stepWith(sim, 1, () => ({ yaw: fwdYaw, moveY: -1 }));
    assert.ok(u() <= 3.2, `${room.cell.id}: 入口の所へ戻れる（u = ${u().toFixed(2)}）`);
    const sec = room.r.gimmicks!.secrets.find((s) => s.host === `${room.cell.id}~hall`);
    if (sec) { revealed++; assert.ok(sim.isRevealed(`${sec.id}.wall`), '隠しの入口が現れた'); }
  }
  console.log(`  後ろの輪の隠し ${revealed}`);
});

test('閉じ込めない: 抜けられなくても giveUpSec 秒で前も後ろもほどける', () => {
  const tt = makeTuning({ 'warp.loopHall.giveUpSec': 20, 'warp.loopHall.lapsOut': 12 }).tuning;
  const room = findRooms('loopHall', 1, { t: tt })[0]!;
  const sim = simIn(room, tt);
  assert.ok(walkTo(sim, `${room.cell.id}~hall`, undefined, 60).ok);
  const tread = `${room.id}.loop`;
  for (let i = 0; i < 60 * 25; i++) stepWith(sim, 1, () => ({ moveY: 1 }));
  assert.equal(sim.outputOf(tread, 'out'), 1);
  assert.equal(sim.outputOf(tread, 'back'), 0, '時間でほどけても隠しは現れない');
});

test('決定的: 同じ鍵で同じ別の空間', () => {
  for (const room of ROOMS.slice(0, 3)) {
    const again = regenerate(room);
    const shape = (f: FloorLayout) => JSON.stringify(f.cells.filter((c) => c.pocket === room.id).map((c) => [c.id, c.bounds, c.boxes.length]));
    assert.equal(shape(again), shape(room.floor));
  }
});
