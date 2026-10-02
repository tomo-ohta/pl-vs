/**
 * 遠ざかる廊下（recedingHall: W05）: 扉を開けると近くに突き当たり・歩くほど遠ざかる（残りの距離が伸びる）・偽の突き当たりは通れない・
 * ある所まで歩くと消えて本物の扉に着く（歩く人）・戻ると近づく・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { rotQ, type Dir, type Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { WALL_T, type FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('recedingHall', 5, { maxWorld: 260 });
const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;

test('遠ざかる廊下: 歩くほど突き当たりが遠ざかり、偽の突き当たりは通れない・ある所で消えて本物の扉へ着く・戻ると近づく', () => {
  assert.ok(ROOMS.length >= 3, `遠ざかる廊下: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor;
    const sim = new Sim(f, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
    sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], faceTo(room.inside, room.cell.bounds.min));
    const hall = `${room.cell.id}~far`;
    assert.ok(walkTo(sim, hall, undefined, 60).ok, `${room.cell.id}: 廊下へ`);
    sim.drainEvents();
    const rc = `${room.id}.recede`;
    const P = ent(f, rc).params as { origin: Vec3; fwd: number; start: number; boxes: unknown[] };
    assert.ok(P.boxes.length >= 3, '本物の突き当たりの箱（壁・灯り）を写す');
    const fw = rotQ([0, 0, 1], P.fwd as Dir);
    const cell = f.cells.find((c) => c.id === hall)!;
    const Lh = Math.max(...cell.footprint.flatMap((r) => [(r.x0 - P.origin[0]) * fw[0] + (r.z0 - P.origin[2]) * fw[2], (r.x1 - P.origin[0]) * fw[0] + (r.z1 - P.origin[2]) * fw[2]]));
    const u = (): number => (sim.players[0]!.pos[0] - P.origin[0]) * fw[0] + (sim.players[0]!.pos[2] - P.origin[2]) * fw[2];
    const endU = (): number => Lh + Number(sim.stateOf(rc)?.off ?? 0);
    const yaw = Math.atan2(-fw[0], -fw[2]);
    const rem0 = endU() - u();
    assert.ok(rem0 < t['warp.recede.startM'] + 0.5 && rem0 > 3, `扉を開けると突き当たりは近い（${rem0.toFixed(2)} m）`);
    // 10 m 歩くと、残りの距離は伸びている
    const u0 = u();
    for (let i = 0; i < 60 * 8 && u() < u0 + 10; i++) stepWith(sim, 1, () => ({ yaw, moveY: 1 }));
    const rem1 = endU() - u();
    assert.ok(rem1 > rem0 + 3, `${room.cell.id}: 遠ざかる（${rem0.toFixed(2)} → ${rem1.toFixed(2)} m）`);
    // 戻ると近づく
    for (let i = 0; i < 60 * 2; i++) stepWith(sim, 1, () => ({ yaw, moveY: -1 }));
    assert.ok(endU() - u() < rem1, '戻ると近づく');
    // 走って突き当たりへ: 消えるまでは偽の壁を越えない
    let gone = false;
    for (let i = 0; i < 60 * 40 && !gone; i++) {
      stepWith(sim, 1, () => ({ yaw, moveY: 1, dash: true }));
      gone = !!sim.stateOf(rc)?.gone;
      if (!gone) assert.ok(u() < endU() - WALL_T - 0.3, `偽の突き当たりは通れない（${u().toFixed(2)} / ${endU().toFixed(2)}）`);
    }
    assert.ok(gone, `${room.cell.id}: 歩けば必ず本物の突き当たりに着く`);
    const res = walkTo(sim, `${room.cell.id}~far.q`, undefined, 60);
    assert.ok(res.ok, `${room.cell.id}: 奥の扉から双子の部屋へ: ${res.reason}`);
  }
});

test('遠ざかる廊下: 決定的', () => {
  for (const room of ROOMS.slice(0, 2)) {
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(room.floor.entities.filter((e) => e.id.startsWith(room.id))));
  }
});
