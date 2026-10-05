/**
 * 窓の向こうの自分（pastWindow: W08・BX08）: 窓の向こうの自分は delay 秒前の自分（位置と向き）・部屋の外にいた頃は見えない・
 * BX08 窓の前でじっと stillSec 秒立つと、向こうの自分が隠しの扉の前へ歩いて 3 回叩き、隠しの扉が現れる・歩いていると起きない・
 * 窓の描画の写し方（向かいの壁の外から見る）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { aabbCenter } from '../core/math/aabb.ts';
import { rotQ, type Dir, type Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { readAabb } from '../core/sim/parts/warp/util.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout, Json } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
// 隠しを多めに（段階 4 で隠しを差し出す仕掛けが増え、ふつうの調整では隠しの付いた枠・窓が少ない）
const ROOMS = findRooms('pastWindow', 6, { maxWorld: 300, t: { ...t, 'secrets.perFloorMean': 3 } as typeof t });
const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const simOf = (room: GimmickRoom): Sim => new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
const ghost = (sim: Sim, id: string): number[] => [...((sim.stateOf(id)?.ghost as number[] | undefined) ?? [])];

test('窓の向こうの自分: delay 秒前の自分の位置と向き・部屋の外にいた頃は見えない', () => {
  assert.ok(ROOMS.length >= 3, `窓の向こうの自分: ${ROOMS.length}`);
  const delay = t['warp.pastWindow.delaySec'];
  for (const room of ROOMS) {
    const id = `${room.id}.past`;
    const sim = simOf(room);
    sim.teleport(0, [room.outside[0], room.outside[1] + 0.02, room.outside[2]], room.yaw);
    stepWith(sim, 5, () => ({}));
    // 部屋の外にいる間は見えない
    stepWith(sim, Math.round(delay * 60) + 12, () => ({}));
    assert.equal(ghost(sim, id)[3], 0, `${room.cell.id}: 部屋の外にいた頃は見えない`);
    // 部屋に入って歩き回る（記録: tick ごとの位置）
    const r = walkTo(sim, room.cell.id, undefined, 30);
    assert.ok(r.ok, r.reason);
    const hist: { tick: number; pos: Vec3; yaw: number }[] = [];
    const c = aabbCenter(room.cell.bounds);
    for (let i = 0; i < 60 * (delay + 3); i++) {
      const p = sim.players[0]!;
      const yaw = faceTo(p.pos, [c[0] + Math.sin(i / 40) * 1.5, 0, c[2] + Math.cos(i / 40) * 1.5]);
      sim.step([{ ...IDLE_COMMAND, yaw, moveY: 0.6 }]);
      hist.push({ tick: sim.tick, pos: [...sim.players[0]!.pos], yaw: sim.players[0]!.yaw });
    }
    const g = ghost(sim, id);
    assert.equal(g[3], 1, `${room.cell.id}: 向こうの自分が見える`);
    const past = hist[hist.length - 1 - Math.round(delay * 60)]!;
    assert.ok(Math.hypot(g[0]! - past.pos[0], g[1]! - past.pos[2]) < 0.25, `${room.cell.id}: ${delay} 秒前の位置（${g[0]!.toFixed(2)},${g[1]!.toFixed(2)} / ${past.pos[0].toFixed(2)},${past.pos[2].toFixed(2)}）`);
  }
});

test('窓の向こうの自分（BX08）: 窓の前でじっと立つと、向こうの自分が壁を 3 回叩き、隠しの扉が現れる・歩いていると起きない', () => {
  let secrets = 0;
  for (const room of ROOMS) {
    const id = `${room.id}.past`;
    const sec = room.r.gimmicks?.secrets.find((s) => s.host === room.cell.id && s.hook === 'past.knock');
    const P = ent(room.floor, id).params as { stand: Json; spot?: number[]; stillSec: number };
    const stand = aabbCenter(readAabb(P.stand));
    const sim = simOf(room);
    sim.teleport(0, [stand[0], room.cell.floorY + 0.02, stand[2]], 0);
    stepWith(sim, 5, () => ({}));
    // 窓の前で歩き回っている間は起きない
    for (let i = 0; i < 60 * (P.stillSec + 4); i++) stepWith(sim, 1, () => ({ yaw: (i / 50) % (2 * Math.PI), moveY: i % 120 < 60 ? 0.5 : 0 }));
    if (!sec) { assert.equal(sim.outputOf(id, 'reveal'), 0); continue; }
    secrets++;
    assert.equal(sim.outputOf(id, 'mode'), 0, `${room.cell.id}: 歩いていると起きない`);
    // じっと立つ
    sim.teleport(0, [stand[0], room.cell.floorY + 0.02, stand[2]], 0);
    let knocks = 0;
    for (let i = 0; i < 60 * (P.stillSec + 20) && !sim.outputOf(id, 'reveal'); i++) {
      sim.step([{ ...IDLE_COMMAND }]);
      for (const e of sim.drainEvents()) if (e.type === 'cue' && e.entity === id && e.data?.name === 'past.knock') knocks++;
    }
    assert.equal(sim.outputOf(id, 'reveal'), 1, `${room.cell.id}: 隠しの扉が現れる`);
    assert.equal(knocks, 3, '3 回叩く');
    assert.ok(sim.isRevealed(`${sec.id}.wall`));
    const g = ghost(sim, id);
    assert.ok(Math.hypot(g[0]! - P.spot![0]!, g[1]! - P.spot![2]!) < 0.05, '向こうの自分は隠しの扉の前');
    const r = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 80);
    assert.ok(r.ok, `${room.cell.id}: 隠しへ: ${r.reason}`);
  }
  assert.ok(secrets >= 1, `隠しの付いた窓 ${secrets}`);
});

test('窓の向こうの自分: 窓の描画は、この部屋を向かいの壁の外から見る写し方（窓の真ん中 → 向かいの壁の内面）・決定的', () => {
  for (const room of ROOMS) {
    const P = ent(room.floor, `${room.id}.past`).params as { window: { center: number[]; dir: number; depth: number } };
    const u = rotQ([0, 0, 1], (P.window.dir & 3) as Dir);
    const to = [P.window.center[0]! + u[0] * P.window.depth, P.window.center[2]! + u[2] * P.window.depth];
    const b = room.cell.footprint[0]!;
    // 写した真ん中は、向かいの壁の内面（区画の足跡から壁の厚み 0.15 m 内側）の上
    const onWall = [b.x0 + 0.15, b.x1 - 0.15].some((x) => Math.abs(to[0]! - x) < 0.01) || [b.z0 + 0.15, b.z1 - 0.15].some((z) => Math.abs(to[1]! - z) < 0.01);
    assert.ok(onWall, `${room.cell.id}: ${to}`);
    const again = regenerate(room, { t: { ...t, 'secrets.perFloorMean': 3 } as typeof t });
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(room.floor.entities.filter((e) => e.id.startsWith(room.id))));
  }
});
