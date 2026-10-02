/**
 * 穴・溝の部屋（崩れる床 crumbleFloor・細い道 narrowPath・細い梁の網 beamNetwork）:
 * 入口から出口まで渡れる・穴の底のどこに落ちても入口の床へ歩いて戻れる（階段が入口の床に届く）・
 * 床板は乗り続けると落ちて、しばらくで戻る・梁の網には行き止まりがある・穴の底の隠しへ入れる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { Rng } from '../core/math/rng.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { WALL_T } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const ROOMS = {
  crumbleFloor: findRooms('crumbleFloor', 16),
  narrowPath: findRooms('narrowPath', 14, { maxWorld: 600 }),
  beamNetwork: findRooms('beamNetwork', 8, { maxWorld: 1200 }),
};

/** 穴の底の高さ（区画のいちばん低い当たり判定の箱の上面） */
const bottomOf = (room: GimmickRoom): number => Math.min(...room.cell.boxes.filter((b) => b.solid && b.max[1] < room.cell.floorY - 1).map((b) => b.max[1]));

/** 穴の底の、体が入る（段・柱・壁に掛からない）点を n 個（決まった乱数で） */
function fallSpots(sim: Sim, room: GimmickRoom, n: number, seed: number): [number, number, number][] {
  const fr = room.cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
  const y = bottomOf(room);
  const rng = new Rng(seed);
  const out: [number, number, number][] = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const x = rng.float(fr.x0 + WALL_T + 0.4, fr.x1 - WALL_T - 0.4), z = rng.float(fr.z0 + WALL_T + 0.4, fr.z1 - WALL_T - 0.4);
    // 底の上に立てて、体の高さに何も無い
    const under = sim.colliders.query(x - 0.12, y - 0.1, z - 0.12, x + 0.12, y + 0.05, z + 0.12).some((b) => Math.abs(b.max[1] - y) < 1e-3);
    const body = sim.colliders.query(x - 0.37, y + 0.05, z - 0.37, x + 0.37, y + 1.7, z + 0.37).some((b) => b.max[1] > y + 0.05 && b.min[1] < y + 1.7);
    if (under && !body) out.push([x, y + 0.02, z]);
  }
  return out;
}

const newSim = async (room: GimmickRoom): Promise<Sim> => new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(await loadRapier(), 1 / 60) });

for (const def of ['crumbleFloor', 'narrowPath', 'beamNetwork'] as const) {
  test(`${def}: 入口から出口まで渡れる（落ちずに）`, async () => {
    const rooms = ROOMS[def].filter((r) => r.beyond);
    assert.ok(rooms.length >= (def === 'beamNetwork' ? 3 : 6), `${def} の部屋: ${rooms.length}`);
    const fails: string[] = [];
    for (const room of rooms) {
      const sim = await newSim(room);
      // 入口の内側（入口の床・升目）から出口の向こうの区画へ
    sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
      let minY = Infinity;
      const step = sim.step.bind(sim);
      (sim as unknown as { step: typeof sim.step }).step = (c) => { step(c); const p = sim.players[0]!; if (Math.hypot(p.pos[0] - room.inside[0], p.pos[2] - room.inside[2]) < 30) minY = Math.min(minY, p.pos[1]); };
      const res = walkTo(sim, room.beyond!, undefined, 150);
      if (!res.ok || !res.route.includes(room.exit!.id)) fails.push(`${room.floor.id} ${room.cell.id}: ${res.reason || '部屋を通らない道順'}`);
      else if (minY < room.cell.floorY - 0.5) fails.push(`${room.floor.id} ${room.cell.id}: 途中で落ちた（y=${minY.toFixed(2)}）`);
      sim.physics?.dispose();
    }
    assert.deepEqual(fails, []);
  });

  test(`${def}: 穴の底のどこに落ちても、階段で入口の床へ戻れる`, async () => {
    const fails: string[] = [];
    let n = 0;
    // 入口の向き（区画から外向き。0:+Z 1:+X 2:-Z 3:-X）と、階段の側（入口から見て左右）
    const dirs = new Set<number>(), sides = new Set<string>();
    for (const room of ROOMS[def]) {
      const b = room.cell.bounds, a = room.entry.aabb;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2, px = (a.min[0] + a.max[0]) / 2, pz = (a.min[2] + a.max[2]) / 2;
      const dir = room.entry.dir % 2 === 1 ? (px > cx ? 1 : 3) : (pz > cz ? 0 : 2);
      dirs.add(dir);
      const steps = room.cell.boxes.filter((x) => x.solid && x.mat === room.cell.palette.floor && x.min[1] < room.cell.floorY - 1 && x.max[1] < room.cell.floorY - 0.05 && x.max[1] > bottomOf(room) + 0.05);
      if (steps.length) {
        const sx = steps.reduce((s0, x) => s0 + (x.min[0] + x.max[0]) / 2, 0) / steps.length, sz = steps.reduce((s0, x) => s0 + (x.min[2] + x.max[2]) / 2, 0) / steps.length;
        // 入口から奥へ向いたときの右手が +: 奥の向き (fx, fz)、右 = (-fz, fx)
        const [fx, fz] = dir === 0 ? [0, -1] : dir === 2 ? [0, 1] : dir === 1 ? [-1, 0] : [1, 0];
        sides.add(((sx - cx) * -fz + (sz - cz) * fx) > 0 ? 'right' : 'left');
      }
      const probe = await newSim(room);
      const spots = fallSpots(probe, room, def === 'beamNetwork' ? 4 : 3, room.floor.seed);
      probe.physics?.dispose();
      assert.ok(spots.length >= 2, `${room.cell.id}: 底に落ちる点がある`);
      for (const p of spots) {
        n++;
        const sim = await newSim(room);
        sim.teleport(0, p, 0);
        for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
        const res = walkTo(sim, room.cell.id, [room.inside[0], room.cell.floorY, room.inside[2]], 90);
        const pl = sim.players[0]!;
        if (!res.ok || Math.abs(pl.pos[1] - room.cell.floorY) > 0.1) fails.push(`${room.floor.id} ${room.cell.id} (${p.map((v) => v.toFixed(1)).join(', ')}): ${res.reason || `入口の床に上がれない y=${pl.pos[1].toFixed(2)}`}`);
        sim.physics?.dispose();
      }
    }
    console.log(`  ${def}: 落ちた点 ${n}、入口の向き ${[...dirs].sort().join(',')}、階段の側 ${[...sides].sort().join(',')}`);
    // 入口の向き 4 つ・階段の左右を全部試すのは gimmick-lab.test.ts（生成の偶然に頼らない）
    assert.deepEqual(fails, []);
  });
}

test('立ち止まると見える道（appearPath）: 溝の底から、入口側の階段で入口へ戻れる（階段の下の端が溝の底に向いている）', async () => {
  const rooms = findRooms('appearPath', 8, { maxWorld: 400 });
  assert.ok(rooms.length >= 4, `部屋: ${rooms.length}`);
  const fails: string[] = [];
  for (const room of rooms) {
    const probe = await newSim(room);
    const spots = fallSpots(probe, room, 3, room.floor.seed);
    probe.physics?.dispose();
    for (const p of spots) {
      const sim = await newSim(room);
      sim.teleport(0, p, 0);
      for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
      const res = walkTo(sim, room.cell.id, [room.inside[0], room.cell.floorY, room.inside[2]], 90);
      if (!res.ok || Math.abs(sim.players[0]!.pos[1] - room.cell.floorY) > 0.1) fails.push(`${room.floor.id} ${room.cell.id}: ${res.reason || '上がれない'}`);
      sim.physics?.dispose();
    }
  }
  assert.deepEqual(fails, []);
});

test('崩れる床: 乗り続けると揺れて落ち、穴の底へ落ちる。離れていればしばらくで戻る', async () => {
  for (const room of ROOMS.crumbleFloor.slice(0, 6)) {
    const tiles = room.floor.entities.filter((e) => e.type === 'crumbleTile' && e.cell === room.cell.id);
    assert.ok(tiles.length >= 6, `${room.cell.id}: 床板 ${tiles.length}`);
    const tile = tiles[Math.floor(tiles.length / 2)]!;
    const b = tile.params.box as { min: number[]; max: number[] };
    const sim = await newSim(room);
    sim.teleport(0, [(b.min[0]! + b.max[0]!) / 2, room.cell.floorY + 0.02, (b.min[2]! + b.max[2]!) / 2], 0);
    // 床板の真ん中に立ち続ける（ほかの床板にも掛かるので、まわりの床板も落ちる）
    for (let i = 0; i < 60 * 3; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(sim.outputOf(tile.id, 'fallen') > 0.5, `${room.cell.id}: 床板が落ちた`);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - bottomOf(room)) < 0.1, `${room.cell.id}: 穴の底へ落ちた（y=${sim.players[0]!.pos[1].toFixed(2)}）`);
    // 入口の床へ戻って待つ → 戻る
    sim.teleport(0, room.inside, room.yaw);
    for (let i = 0; i < 60 * (t['gimmick.crumble.respawnSec'] + 1); i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(sim.outputOf(tile.id, 'fallen') < 0.5, `${room.cell.id}: 床板が戻った`);
    // 床板を歩いて渡るだけ（1 枚 0.33 秒ほど）では揺れ始めない床板が多い
    assert.ok(t['gimmick.crumble.standSec'] * 0.85 > 0.3);
    sim.physics?.dispose();
  }
});

test('細い梁の網: 足場の梁に行き止まりがあり、入口の床・出口の床から出る梁は 1 本ずつ', () => {
  for (const room of ROOMS.beamNetwork) {
    const y = room.cell.floorY;
    const plats = room.cell.boxes.filter((b) => b.solid && Math.abs(b.max[1] - y) < 1e-3 && Math.abs(b.min[1] - (y - 0.15)) < 1e-3 && Math.abs(b.max[0] - b.min[0] - t['gimmick.beams.platformM']) < 0.05 && Math.abs(b.max[2] - b.min[2] - t['gimmick.beams.platformM']) < 0.05 && b.mat !== room.cell.palette.floor);
    const beams = room.cell.boxes.filter((b) => b.solid && b.mat === 'metal' && Math.abs(b.max[1] - y) < 1e-3 && Math.abs(b.min[1] - (y - 0.12)) < 1e-3);
    const touch = (a: { min: number[]; max: number[] }, b: { min: number[]; max: number[] }): boolean => a.min[0]! <= b.max[0]! + 0.01 && a.max[0]! >= b.min[0]! - 0.01 && a.min[2]! <= b.max[2]! + 0.01 && a.max[2]! >= b.min[2]! - 0.01;
    assert.ok(plats.length >= 3, `${room.cell.id}: 足場 ${plats.length}`);
    const deg = plats.map((p) => beams.filter((b) => touch(p, b)).length);
    assert.ok(deg.every((d) => d >= 1), `${room.cell.id}: どの足場にも梁がある`);
    assert.ok(deg.some((d) => d === 1), `${room.cell.id}: 行き止まりの足場がある`);
    // 固い床（入口・出口の床。床の材質）から出る梁
    const strips = room.cell.boxes.filter((b) => b.solid && b.mat === room.cell.palette.floor && Math.abs(b.max[1] - y) < 1e-3 && Math.abs(b.min[1] - (y - 0.15)) < 1e-3 && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) > 4);
    for (const s of strips) assert.equal(beams.filter((b) => touch(s, b)).length, 1, `${room.cell.id}: 入口・出口の床から出る梁は 1 本`);
  }
});

test('穴の底の隠し（crumble.fall・fall.below）: 底から隠し場所へ歩いて入れる', async () => {
  let n = 0;
  const fails: string[] = [];
  for (const room of [...ROOMS.crumbleFloor, ...ROOMS.narrowPath, ...ROOMS.beamNetwork]) {
    const sec = room.r.gimmicks?.secrets.find((s) => s.host === room.cell.id && (s.hook === 'crumble.fall' || s.hook === 'fall.below'));
    if (!sec) continue;
    n++;
    const door = room.floor.portals.find((p) => p.cells[0] === room.cell.id && p.cells[1] === sec.cell)!;
    assert.ok(door.aabb.min[1] < room.cell.floorY - 1.5, `${sec.id}: 入口は穴の底`);
    const probe = await newSim(room);
    const spot = fallSpots(probe, room, 1, 7)[0]!;
    probe.physics?.dispose();
    const sim = await newSim(room);
    sim.teleport(0, spot, 0);
    const res = walkTo(sim, sec.cell, undefined, 90);
    if (!res.ok) fails.push(`${room.floor.id} ${sec.id}: ${res.reason}`);
    sim.physics?.dispose();
  }
  assert.ok(n >= 3, `穴の底の隠し: ${n}`);
  assert.deepEqual(fails, []);
});

test('穴・溝の部屋: 同じ key なら同じ形（決定的）', () => {
  for (const room of [ROOMS.crumbleFloor[0]!, ROOMS.narrowPath[0]!, ROOMS.beamNetwork[0]!].filter(Boolean)) {
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.cells.find((c) => c.id === room.cell.id)!.boxes), JSON.stringify(room.cell.boxes));
    assert.equal(JSON.stringify(again.entities.filter((e) => e.cell === room.cell.id)), JSON.stringify(room.floor.entities.filter((e) => e.cell === room.cell.id)));
  }
});
