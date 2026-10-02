/**
 * 回転する部屋（turnRoom: W11）: 筒が 1 回り periodSec で回る・真ん中にいれば立っていられる・離れると一緒に回り、外へ押される（壁は越えない）・
 * 筒の外の通路は仕切られ、扉から扉へは筒の中を通る（歩く人が入口の来るのを待って乗り降りして、向かいの部屋へ抜けられる）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { stepWith } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('turnRoom', 5, { maxWorld: 400 });

const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
interface Turn { id: string; c: [number, number]; R: number; omega: number; gaps: { at: number; half: number }[] }
const turnOf = (room: GimmickRoom): Turn => {
  const id = `${room.id}.turn`;
  const p = ent(room.floor, id).params as { center: number[]; radius: number; omega: number; gaps: { at: number; half: number }[] };
  return { id, c: [p.center[0]!, p.center[1]!], R: p.radius, omega: p.omega, gaps: p.gaps };
};
const simOf = (room: GimmickRoom): Sim => new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
const polar = (T: Turn, p: readonly number[]): [number, number] => [Math.hypot(p[0]! - T.c[0], p[2]! - T.c[1]), Math.atan2(p[2]! - T.c[1], p[0]! - T.c[0])];
const wrap = (a: number): number => { let d = a % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };

test('回転する部屋: 1 回り periodSec で回る・真ん中にいれば立っていられる・離れると一緒に回り外へ押される（壁は越えない）', () => {
  assert.ok(ROOMS.length >= 3, `回転する部屋: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const T = turnOf(room);
    const y = room.cell.floorY;
    assert.ok(Math.abs(Math.abs(T.omega) - (2 * Math.PI) / t['warp.turnRoom.periodSec']) < 1e-9);
    // 真ん中: 10 秒立っていても真ん中から 0.5 m 以内（向きは一緒に回る）
    const sim = simOf(room);
    sim.teleport(0, [T.c[0] + 0.1, y + 0.02, T.c[1]], 0);
    stepWith(sim, 5, () => ({}));
    const yaw0 = sim.players[0]!.yaw;
    stepWith(sim, 600, () => ({ yaw: sim.players[0]!.yaw }));
    const [r0] = polar(T, sim.players[0]!.pos);
    assert.ok(r0 < 0.5, `${room.cell.id}: 真ん中にいれば立っていられる（${r0.toFixed(2)} m）`);
    const turned = wrap(sim.players[0]!.yaw - yaw0);
    assert.ok(Math.abs(turned + wrap(T.omega * 10)) < 0.1, `${room.cell.id}: 向きも一緒に回る（${turned.toFixed(2)} / ${(-T.omega * 10).toFixed(2)}）`);
    // 軸から R - 1.0 m: 一緒に回り、外へ押されるが、壁は越えない
    const s2 = simOf(room);
    const r1 = T.R - 1.0;
    // 入口の向き（家具の無い所）
    const ga = T.gaps[0]!.at;
    s2.teleport(0, [T.c[0] + r1 * Math.cos(ga), y + 0.02, T.c[1] + r1 * Math.sin(ga)], 0);
    stepWith(s2, 5, () => ({}));
    const [ra, aa] = polar(T, s2.players[0]!.pos);
    let maxR = 0;
    for (let i = 0; i < 360; i++) { stepWith(s2, 1, () => ({ yaw: s2.players[0]!.yaw })); maxR = Math.max(maxR, polar(T, s2.players[0]!.pos)[0]); }
    const [rb, ab] = polar(T, s2.players[0]!.pos);
    const moved = wrap(ab - aa);
    assert.ok(Math.sign(moved) === Math.sign(T.omega) && Math.abs(moved - T.omega * 6) < 0.25, `${room.cell.id}: 一緒に回る（${moved.toFixed(2)} / ${(T.omega * 6).toFixed(2)}）`);
    assert.ok(rb > ra + 0.1, `${room.cell.id}: 外へ押される（${ra.toFixed(2)} → ${rb.toFixed(2)}）`);
    assert.ok(maxR < T.R - 0.06 - 0.3, `${room.cell.id}: 壁は越えない（${maxR.toFixed(2)} / ${T.R.toFixed(2)}）`);
  }
});

test('回転する部屋: 扉から扉へは筒の中を通る・入口が来るのを待って乗り降りし、ほかの開口へ抜けられる（歩く人）', () => {
  let crossed = 0, through = 0;
  for (const room of ROOMS) {
    if (!room.beyond) continue;
    const T = turnOf(room);
    const sim = simOf(room);
    sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], 0);
    stepWith(sim, 5, () => ({}));
    // 筒の中を通ったか（歩く人の 1 tick ごとに見る）
    let inDrum = false;
    const step = sim.step.bind(sim);
    (sim as unknown as { step: typeof sim.step }).step = (c) => { step(c); if (polar(T, sim.players[0]!.pos)[0] < T.R - 0.4) inDrum = true; };
    const r = walkTo(sim, room.beyond, undefined, 240);
    assert.ok(r.ok, `${room.cell.id}: ほかの開口へ: ${r.reason}`);
    crossed++;
    if (inDrum) through++;
    // 戻りも
    const back = walkTo(sim, room.cell.id, undefined, 120);
    assert.ok(back.ok, `${room.cell.id}: 戻れる: ${back.reason}`);
  }
  assert.ok(crossed >= 2, `抜けた部屋 ${crossed}`);
  assert.ok(through >= 1, `筒の中を通って抜けた部屋 ${through}`);
});

/** 筒の外の通路だけを歩いて（筒の中に入らずに）、点 a から点 b へ行けるか（静的な箱と筒の円で塞いだ 0.1 m の升目） */
function ringReach(room: GimmickRoom, T: Turn, a: readonly number[], b: readonly number[]): boolean {
  const c = room.cell, bb = c.bounds, G = 0.1, rad = 0.35;
  const nx = Math.ceil((bb.max[0] - bb.min[0]) / G), nz = Math.ceil((bb.max[2] - bb.min[2]) / G);
  const solid = c.boxes.filter((x) => x.solid && x.max[1] > c.floorY + 0.3 && x.min[1] < c.floorY + 1.7);
  const free = (i: number, k: number): boolean => {
    const x = bb.min[0] + (i + 0.5) * G, z = bb.min[2] + (k + 0.5) * G;
    if (Math.hypot(x - T.c[0], z - T.c[1]) < T.R + 0.06 + rad) return false;
    return !solid.some((q) => x > q.min[0] - rad && x < q.max[0] + rad && z > q.min[2] - rad && z < q.max[2] + rad);
  };
  const idx = (p: readonly number[]): [number, number] => [Math.floor((p[0]! - bb.min[0]) / G), Math.floor((p[2]! - bb.min[2]) / G)];
  const [si, sk] = idx(a), [ti, tk] = idx(b);
  const seen = new Uint8Array(nx * nz);
  const q: [number, number][] = [[si, sk]];
  seen[sk * nx + si] = 1;
  for (let h = 0; h < q.length; h++) {
    const [i, k] = q[h]!;
    if (Math.abs(i - ti) <= 1 && Math.abs(k - tk) <= 1) return true;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nk = k + dk;
      if (ni < 0 || nk < 0 || ni >= nx || nk >= nz || seen[nk * nx + ni] || !free(ni, nk)) continue;
      seen[nk * nx + ni] = 1;
      q.push([ni, nk]);
    }
  }
  return false;
}

test('回転する部屋: 仕切りで、筒の外の通路だけでは向かいの扉へ行けない部屋がある・決定的', () => {
  let walled = 0;
  for (const room of ROOMS) {
    const f = room.floor;
    const T = turnOf(room);
    if (room.exit) {
      const e = room.exit, ec = [(e.aabb.min[0] + e.aabb.max[0]) / 2, 0, (e.aabb.min[2] + e.aabb.max[2]) / 2];
      const cc = [(room.cell.bounds.min[0] + room.cell.bounds.max[0]) / 2, (room.cell.bounds.min[2] + room.cell.bounds.max[2]) / 2];
      const l = Math.hypot(cc[0]! - ec[0]!, cc[1]! - ec[2]!);
      const exitIn = [ec[0]! + ((cc[0]! - ec[0]!) / l) * 0.5, 0, ec[2]! + ((cc[1]! - ec[2]!) / l) * 0.5];
      if (!ringReach(room, T, room.inside, exitIn)) walled++;
    }
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(f.entities.filter((e) => e.id.startsWith(room.id))));
  }
  assert.ok(walled >= 2, `筒を通らないと出口へ行けない部屋 ${walled}/${ROOMS.length}`);
});
