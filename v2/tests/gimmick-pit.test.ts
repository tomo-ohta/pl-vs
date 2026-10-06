/**
 * 穴・溝の部屋（崩れる床 crumbleFloor・細い道 narrowPath・細い梁の網 beamNetwork）。穴は底の見えない落ちる穴（14 章）:
 * 入口から出口まで渡れる・穴の上のどこから落ちても縦穴を落ちる（1 つ下の階へ）・崩れる床は道の床板が離れても崩れ、見せかけの床板は
 * すぐ抜け、しばらくで戻る・梁の網には行き止まりがある・下の細い足場から隠しへ入れる・決定的
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
import { dropSpots, fallsDown } from './helpers/drop.ts';

const t = defaultTuning();
// 段階 4 で仕掛けが 100 種を超えたので、穴の仕掛けを出やすくして集める（gimmick.w.<id>）
const boost = (id: string, w: number) => ({ t: { ...t, [`gimmick.w.${id}`]: w } as typeof t });
const ROOMS = {
  crumbleFloor: findRooms('crumbleFloor', 16, { maxWorld: 600, ...boost('crumbleFloor', 8) }),
  narrowPath: findRooms('narrowPath', 14, { maxWorld: 600, ...boost('narrowPath', 20) }),
  beamNetwork: findRooms('beamNetwork', 8, { maxWorld: 1200, ...boost('beamNetwork', 20) }),
};

/** 溝の底（立ち止まると見える道は、底と階段のある溝のまま）の、体が入る点を n 個 */
function fallSpots(sim: Sim, room: GimmickRoom, n: number, seed: number): [number, number, number][] {
  const fr = room.cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
  const y = Math.min(...room.cell.boxes.filter((b) => b.solid && b.max[1] < room.cell.floorY - 1).map((b) => b.max[1]));
  const rng = new Rng(seed);
  const out: [number, number, number][] = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const x = rng.float(fr.x0 + WALL_T + 0.4, fr.x1 - WALL_T - 0.4), z = rng.float(fr.z0 + WALL_T + 0.4, fr.z1 - WALL_T - 0.4);
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

  test(`${def}: 穴の上のどこから落ちても、底の見えない縦穴を落ちる（1 つ下の階へ）`, async () => {
    const fails: string[] = [];
    let n = 0;
    for (const room of ROOMS[def]) {
      const probe = await newSim(room);
      const spots = dropSpots(probe, room.cell, 3, room.floor.seed);
      probe.physics?.dispose();
      for (const p of spots) {
        n++;
        const sim = await newSim(room);
        if (!fallsDown(sim, room.floor, p, room.cell.floorY)) fails.push(`${room.floor.id} ${room.cell.id} (${p.map((v) => v.toFixed(1)).join(', ')}): 縦穴を落ちない（y=${sim.players[0]!.pos[1].toFixed(2)}）`);
        sim.physics?.dispose();
      }
    }
    assert.ok(n >= 3, `${def}: 落ちた点 ${n}`);
    assert.deepEqual(fails, []);
  });
}

test('立ち止まると見える道（appearPath）: 溝の底から、入口側の階段で入口へ戻れる（階段の下の端が溝の底に向いている）', async () => {
  const rooms = findRooms('appearPath', 8, { maxWorld: 400, ...boost('appearPath', 10) });
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

test('崩れる床: 道の床板は乗ると少しで揺れて落ち、離れても止まらない。見せかけの床板は乗るとすぐ抜ける。しばらくで戻る', async () => {
  let checked = 0;
  for (const room of ROOMS.crumbleFloor.slice(0, 6)) {
    const tiles = room.floor.entities.filter((e) => e.type === 'crumbleTile' && e.cell === room.cell.id);
    const road = tiles.filter((e) => !e.params.crack), decoy = tiles.filter((e) => e.params.crack);
    assert.ok(road.length >= 4, `${room.cell.id}: 道の床板 ${road.length}`);
    const center = (e: (typeof tiles)[number]): [number, number, number] => { const b = e.params.box as { min: number[]; max: number[] }; return [(b.min[0]! + b.max[0]!) / 2, room.cell.floorY + 0.02, (b.min[2]! + b.max[2]!) / 2]; };
    // 道の床板: 0.15 秒乗って離れても、少しで落ちる
    const tile = road[Math.floor(road.length / 2)]!;
    const sim = await newSim(room);
    sim.teleport(0, center(tile), 0);
    for (let i = 0; i < 9; i++) sim.step([{ ...IDLE_COMMAND }]);
    sim.teleport(0, room.inside, room.yaw);
    for (let i = 0; i < 60 * 2; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(sim.outputOf(tile.id, 'fallen') > 0.5, `${room.cell.id}: 道の床板は離れても落ちる`);
    // しばらくで戻る
    for (let i = 0; i < 60 * (t['gimmick.crumble.respawnSec'] + 1); i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(sim.outputOf(tile.id, 'fallen') < 0.5, `${room.cell.id}: 床板が戻った`);
    // 見せかけの床板: 乗るとすぐ抜けて、縦穴を落ちる
    if (decoy.length) {
      const d = decoy[0]!;
      sim.teleport(0, center(d), 0);
      for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
      assert.ok(sim.outputOf(d.id, 'fallen') > 0.5 && sim.players[0]!.pos[1] < room.cell.floorY - 0.5, `${room.cell.id}: 見せかけの床板はすぐ抜ける`);
      checked++;
    }
    sim.physics?.dispose();
  }
  assert.ok(checked >= 2, `見せかけの床板 ${checked}`);
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

test('下の細い足場の隠し（crumble.fall・fall.below）: 足場に落ちれば、足場の先の扉から隠し場所へ歩いて入れる', async () => {
  let n = 0;
  const fails: string[] = [];
  for (const room of [...ROOMS.crumbleFloor, ...ROOMS.narrowPath, ...ROOMS.beamNetwork]) {
    const sec = room.r.gimmicks?.secrets.find((x) => x.host === room.cell.id && (x.hook === 'crumble.fall' || x.hook === 'fall.below'));
    if (!sec) continue;
    n++;
    const door = room.floor.portals.find((p) => p.cells[0] === room.cell.id && p.cells[1] === sec.cell)!;
    const cy = room.cell.floorY - t['gimmick.pit.catwalkDepthM'];
    assert.ok(Math.abs(door.aabb.min[1] - cy) < 0.05, `${sec.id}: 入口は下の細い足場の高さ`);
    const walk = room.cell.boxes.filter((b) => b.narrow && Math.abs(b.max[1] - cy) < 1e-3);
    assert.ok(walk.length >= 2, `${sec.id}: 下の細い足場`);
    // 足場の上に落ちる（真ん中の上から）
    const w = walk[0]!;
    const sim = await newSim(room);
    sim.teleport(0, [(w.min[0] + w.max[0]) / 2, cy + 1.2, (w.min[2] + w.max[2]) / 2], 0);
    for (let i = 0; i < 40; i++) sim.step([{ ...IDLE_COMMAND }]);
    if (Math.abs(sim.players[0]!.pos[1] - cy) > 0.05) { fails.push(`${sec.id}: 足場に乗れない（y=${sim.players[0]!.pos[1].toFixed(2)}）`); sim.physics?.dispose(); continue; }
    // 足場に沿って歩く（L 字の足場では角を通る。歩く人はまっすぐ歩くので、角を切ると足場の外へ落ちる）
    const mid = (b: (typeof walk)[number]): [number, number] => [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
    let along = true;
    for (let i = 1; i < walk.length && along; i++) {
      const [ax, az] = mid(walk[i - 1]!), [bx, bz] = mid(walk[i]!);
      const b = walk[i]!;
      const corner: [number, number] = b.max[0] - b.min[0] > b.max[2] - b.min[2] ? [ax, bz] : [bx, az];
      for (const [x, z] of [corner, [bx, bz]] as const) {
        const leg = walkTo(sim, room.cell.id, [x, cy, z], 20);
        if (!leg.ok) { fails.push(`${room.floor.id} ${sec.id}: 足場の上を歩けない: ${leg.reason}`); along = false; break; }
      }
    }
    if (!along) { sim.physics?.dispose(); continue; }
    const res = walkTo(sim, sec.cell, undefined, 60);
    if (!res.ok) fails.push(`${room.floor.id} ${sec.id}: ${res.reason}`);
    sim.physics?.dispose();
  }
  assert.ok(n >= 2, `下の細い足場の隠し: ${n}`);
  assert.deepEqual(fails, []);
});

test('穴・溝の部屋: 同じ key なら同じ形（決定的）', () => {
  for (const id of ['crumbleFloor', 'narrowPath', 'beamNetwork'] as const) {
    const room = ROOMS[id][0];
    if (!room) continue;
    const again = regenerate(room, boost(id, id === 'crumbleFloor' ? 8 : 20));
    assert.equal(JSON.stringify(again.cells.find((c) => c.id === room.cell.id)!.boxes), JSON.stringify(room.cell.boxes));
    assert.equal(JSON.stringify(again.entities.filter((e) => e.cell === room.cell.id)), JSON.stringify(room.floor.entities.filter((e) => e.cell === room.cell.id)));
  }
});
