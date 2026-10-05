/**
 * 時間で入れ替わる扉（timedDoors: T04・F27）: 双子の部屋 4 つが部屋と同じ・組 0 は X→青・Y→琥珀、periodSec 秒たつと X→琥珀・Y→青・
 * 扉の上の灯りの色が行き先を示す・入れ替わっても青い部屋・琥珀の部屋から元の部屋へ戻れる（閉じ込めない）・琥珀の部屋の隠し（歩く人）・決定的
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
const ROOMS = findRooms('timedDoors', 5, { maxWorld: 300 });
const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const cellOf = (f: FloorLayout, id: string) => f.cells.find((c) => c.id === id)!;
const panelCenter = (f: FloorLayout, id: string): Vec3 => aabbCenter(ent(f, id).params.panel as never);
const BLUE = 0x5aa8ff, AMBER = 0xffb347;

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
const inside = (f: FloorLayout, id: string): AABB => {
  const c = cellOf(f, id), r = c.footprint[0]!;
  return { min: [r.x0 + 0.01, c.floorY - 0.25, r.z0 + 0.01], max: [r.x1 - 0.01, c.floorY + c.height + 0.25, r.z1 - 0.01] };
};
const here = (sim: Sim): string => cellAtPos(sim.floor, sim.players[0]!.pos)?.id ?? '?';
const podsOf = (room: GimmickRoom): string[] => (ent(room.floor, `${room.id}.ante`).params.doors as { pods: string[] }).pods;

/** 部屋の扉 j を開けて、その向こうの部屋（青 / 琥珀）まで歩く。行った部屋の id */
function goThrough(sim: Sim, room: GimmickRoom, j: number): string {
  const f = room.floor, R = room.cell.id;
  const pods = podsOf(room);
  const r0 = walkTo(sim, R, doorFront(f, R, pods[j]!), 40);
  assert.ok(r0.ok, `${R}: 扉 ${j} の前へ: ${r0.reason}`);
  sim.drainEvents();
  // 部屋の扉が全部閉じるのを待つ（開いていると、足した扉は開かない）
  for (let i = 0; i < 60 * 10 && sim.outputOf(`${room.id}.ante`, 'ready') < 0.5; i++) stepWith(sim, 1, () => ({}));
  const w = interact(sim, pods[j]!);
  assert.equal(w.length, 1, `${R}: 扉 ${j} で移る`);
  const copy = here(sim);
  const ids = [`${R}~blue`, `${R}~amber`];
  for (const id of ids) {
    // 双子の部屋の開いた扉の向こうの部屋（portal で双子の部屋とつながっている方）
    if (!f.portals.some((p) => p.cells.includes(copy) && p.cells.includes(id))) continue;
    const r = walkTo(sim, id, undefined, 40);
    assert.ok(r.ok, `${R}: ${copy} から ${id} へ: ${r.reason}`);
    return id;
  }
  assert.fail(`${R}: ${copy} の向こうに部屋が無い`);
}

test('時間で入れ替わる扉: 双子の部屋 4 つは部屋とまったく同じ', () => {
  assert.ok(ROOMS.length >= 3, `時間で入れ替わる扉: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor;
    const copies = ent(f, `${room.id}.ante`).params.copies as { xform: unknown }[];
    assert.equal(copies.length, 4);
    for (const c of copies) assert.deepEqual(twinMismatch(f, readXform(c.xform as never), inside(f, room.cell.id)), [], `${room.cell.id}: 双子の部屋`);
  }
});

test('時間で入れ替わる扉: 組 0 は X→青・Y→琥珀、periodSec 秒たつと入れ替わる・扉の上の灯りが行き先の色・どちらからでも戻れる', () => {
  const sec = t['warp.timedDoors.periodSec'];
  for (const room of ROOMS.slice(0, 3)) {
    const R = room.cell.id;
    const tint = (k: number): number => { const e = ent(room.floor, `${room.id}.tint${k}`); return (e.params.colors as number[])[0]!; };
    assert.equal(tint(0), BLUE);
    assert.equal(tint(1), AMBER);
    // 組 0
    let sim = simIn(room);
    assert.equal(goThrough(sim, room, 0), `${R}~blue`, `${R}: 組 0 の X は青`);
    sim = simIn(room);
    assert.equal(goThrough(sim, room, 1), `${R}~amber`, `${R}: 組 0 の Y は琥珀`);
    // 組 1（periodSec 秒たってから）
    sim = simIn(room);
    stepWith(sim, Math.round(sec * 60) + 30, () => ({}));
    assert.equal(Number(sim.stateOf(`${room.id}.tint0`)?.idx), 1, '灯りが入れ替わる');
    assert.equal(goThrough(sim, room, 0), `${R}~amber`, `${R}: 組 1 の X は琥珀`);
    // 琥珀の部屋にいる間に組 0 へ戻っても、元の部屋へ出られる（向かいの扉からも）
    for (let i = 0; i < 2 * sec * 60 && sim.outputOf(`${room.id}.ante`, 'phase') !== 0; i += 60) stepWith(sim, 60, () => ({}));
    assert.equal(sim.outputOf(`${room.id}.ante`, 'phase'), 0, '組 0 へ戻った');
    const back = walkTo(sim, room.beyond ?? R, undefined, 120);
    assert.ok(back.ok, `${R}: 入れ替わったあとも琥珀の部屋から戻れる: ${back.reason}`);
    sim = simIn(room);
    stepWith(sim, Math.round(sec * 60) + 30, () => ({}));
    assert.equal(goThrough(sim, room, 1), `${R}~blue`, `${R}: 組 1 の Y は青`);
  }
});

test('時間で入れ替わる扉: 同じ扉で 2 つの部屋へ行くと、琥珀の部屋の隠しの扉が現れる（出現型。付いていれば歩いて行ける）・決定的', () => {
  const sec = t['warp.timedDoors.periodSec'];
  let secrets = 0;
  for (const room of ROOMS) {
    const s = room.r.gimmicks?.secrets.find((x) => x.host === `${room.cell.id}~amber`);
    if (s) {
      secrets++;
      assert.equal(s.mode, 'appear');
      const sim = simIn(room);
      const ante = `${room.id}.ante`;
      // X で青い部屋へ → 戻る → 入れ替わってから X で琥珀の部屋へ
      assert.equal(goThrough(sim, room, 0), `${room.cell.id}~blue`);
      assert.equal(sim.outputOf(ante, 'multi'), 0, 'まだ現れない');
      assert.ok(walkTo(sim, room.cell.id, undefined, 120).ok, '元の部屋へ');
      stepWith(sim, Math.round(sec * 60), () => ({}));
      assert.equal(sim.outputOf(ante, 'phase'), 1);
      assert.equal(goThrough(sim, room, 0), `${room.cell.id}~amber`);
      assert.equal(sim.outputOf(ante, 'multi'), 1, '同じ扉で 2 つの部屋へ行った');
      assert.ok(sim.isRevealed(`${s.id}.wall`), '琥珀の部屋の隠しの扉が現れる');
      const r = walkTo(sim, s.cells[s.cells.length - 1]!, undefined, 120);
      assert.ok(r.ok, `${room.cell.id}: 琥珀の部屋の隠しへ: ${r.reason}`);
    }
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(room.floor.entities.filter((e) => e.id.startsWith(room.id))));
  }
  console.log(`  琥珀の部屋の隠し ${secrets}/${ROOMS.length}`);
});
