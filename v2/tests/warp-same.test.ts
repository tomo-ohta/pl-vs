/**
 * 2 つの扉が同じ部屋へ（twoDoors: W12）: 双子の部屋 H1・H2（180° 回した）が部屋と同じ・左の扉からも右の扉からも同じ居間へ（両端の扉から）・
 * 居間を通り抜けると、もう一方の扉から元の部屋へ出る・双子の部屋のつながっていない扉は、もう一方の双子の部屋へ移す・閉じ込めない（歩く人）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { aabbCenter, type AABB } from '../core/math/aabb.ts';
import type { Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { readXform } from '../core/sim/parts/warp/util.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { cellAtPos, walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith, twinMismatch } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('twoDoors', 5, { maxWorld: 300 });
const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const cellOf = (f: FloorLayout, id: string) => f.cells.find((c) => c.id === id)!;
const panelCenter = (f: FloorLayout, id: string): Vec3 => aabbCenter(ent(f, id).params.panel as never);

function simIn(room: GimmickRoom): Sim {
  const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
  sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], faceTo(room.inside, aabbCenter(room.cell.bounds)));
  stepWith(sim, 10, () => ({}));
  return sim;
}
function interact(sim: Sim, door: string): ReturnType<typeof stepWith> {
  const p = sim.players[0]!;
  const c = panelCenter(sim.floor, door);
  const eye = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  const yaw = faceTo(eye, c), pitch = Math.atan2(c[1] - eye[1]!, Math.hypot(c[0] - eye[0]!, c[2] - eye[2]!));
  return stepWith(sim, 1, () => ({ yaw, pitch, interact: { yaw, pitch } }));
}
function doorFront(f: FloorLayout, cell: string, door: string, d = 0.9): Vec3 {
  const pn = ent(f, door).params.panel as { min: number[]; max: number[] };
  const c = aabbCenter(pn as never);
  const k = aabbCenter(cellOf(f, cell).bounds);
  const alongX = pn.max[0]! - pn.min[0]! < pn.max[2]! - pn.min[2]!;
  return alongX ? [c[0] + Math.sign(k[0] - c[0]) * d, cellOf(f, cell).floorY, c[2]] : [c[0], cellOf(f, cell).floorY, c[2] + Math.sign(k[2] - c[2]) * d];
}
function walkIn(sim: Sim, cell: string, at: Vec3): void {
  const r = walkTo(sim, cell, at, 40);
  assert.ok(r.ok, `${cell} の中を歩く: ${r.reason}`);
  sim.drainEvents();
}
const inside = (f: FloorLayout, id: string): AABB => {
  const c = cellOf(f, id), r = c.footprint[0]!;
  return { min: [r.x0 + 0.01, c.floorY - 0.25, r.z0 + 0.01], max: [r.x1 - 0.01, c.floorY + c.height + 0.25, r.z1 - 0.01] };
};
const here = (sim: Sim): string => cellAtPos(sim.floor, sim.players[0]!.pos)?.id ?? '?';

test('2 つの扉が同じ部屋へ: 双子の部屋 H1・H2（180° 回した）は部屋とまったく同じ', () => {
  assert.ok(ROOMS.length >= 3, `2 つの扉が同じ部屋へ: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor;
    const copies = (ent(f, `${room.id}.ante`).params.copies as { xform: unknown; entry?: boolean }[]);
    assert.equal(copies.length, 2);
    assert.ok(copies.every((c) => c.entry), '2 つとも入口の双子の部屋');
    for (const c of copies) assert.deepEqual(twinMismatch(f, readXform(c.xform as never), inside(f, room.cell.id)), [], `${room.cell.id}: 双子の部屋`);
  }
});

test('2 つの扉が同じ部屋へ: 左の扉からも右の扉からも同じ居間へ・通り抜けるともう一方の扉から元の部屋へ', () => {
  for (const room of ROOMS) {
    const f = room.floor, R = room.cell.id;
    const P = `${R}~same`;
    const pods = (ent(f, `${room.id}.ante`).params.doors as { pods: string[] }).pods;
    assert.equal(pods.length, 2);
    for (const j of [0, 1] as const) {
      const sim = simIn(room);
      walkIn(sim, R, doorFront(f, R, pods[j]!));
      const w = interact(sim, pods[j]!);
      assert.equal(w.length, 1, `${R}: 扉 ${j} で移る`);
      assert.ok(w[0]!.data?.seamless);
      const copy = here(sim);
      assert.equal(copy, j === 0 ? `${R}~a1` : `${R}~a2`, `${R}: 扉 ${j} の双子の部屋`);
      // 開いた扉の先は居間
      const r = walkTo(sim, P, undefined, 40);
      assert.ok(r.ok, `${R}: 扉 ${j} から居間へ: ${r.reason}`);
      // 居間を通り抜けて、向かいの扉から出る → もう一方の双子の部屋 → 元の部屋の扉から出られる
      const otherCopy = j === 0 ? `${R}~a2` : `${R}~a1`;
      const r2 = walkTo(sim, otherCopy, undefined, 60);
      assert.ok(r2.ok, `${R}: 居間の向かいの扉から ${otherCopy} へ: ${r2.reason}`);
      const home = walkTo(sim, room.beyond ?? R, undefined, 80);
      assert.ok(home.ok, `${R}: 双子の部屋から元の部屋の扉の向こうへ出られる: ${home.reason}`);
    }
  }
});

test('2 つの扉が同じ部屋へ: 双子の部屋のつながっていない扉は、もう一方の双子の部屋へ移して向こうの扉を開ける（開いた扉は閉めてから）', () => {
  for (const room of ROOMS.slice(0, 3)) {
    const f = room.floor, R = room.cell.id;
    const ante = ent(f, `${room.id}.ante`).params as { copies: { pods: string[] }[]; doors: { pods: string[] } };
    const [c1, c2] = ante.copies;
    const sim = simIn(room);
    walkIn(sim, R, doorFront(f, R, ante.doors.pods[0]!));
    assert.equal(interact(sim, ante.doors.pods[0]!).length, 1);
    stepWith(sim, 50, () => ({}));
    assert.ok(Number(sim.stateOf(c1!.pods[0]!)?.angle) > 0.9, 'H1 の左の扉が開く');
    // H1 の右の扉（つながっていない）: 左の扉が閉まってから H2 へ移り、H2 の右の扉が開く
    walkIn(sim, `${R}~a1`, doorFront(f, `${R}~a1`, c1!.pods[1]!));
    let w = interact(sim, c1!.pods[1]!);
    for (let i = 0; i < 120 && !w.length; i++) w.push(...stepWith(sim, 1, () => ({})));
    assert.equal(w.length, 1, `${R}: H1 の右の扉で H2 へ`);
    assert.equal(here(sim), `${R}~a2`);
    stepWith(sim, 50, () => ({}));
    assert.ok(Number(sim.stateOf(c2!.pods[1]!)?.angle) > 0.9, 'H2 の右の扉が開く');
    assert.ok(Number(sim.stateOf(c1!.pods[0]!)?.angle) < 0.02, 'H1 の左の扉は閉じた');
    const r = walkTo(sim, `${R}~same`, undefined, 40);
    assert.ok(r.ok, `${R}: H2 の右の扉から居間へ: ${r.reason}`);
  }
});

test('2 つの扉が同じ部屋へ: 決定的', () => {
  for (const room of ROOMS.slice(0, 2)) {
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(room.floor.entities.filter((e) => e.id.startsWith(room.id))));
  }
});
