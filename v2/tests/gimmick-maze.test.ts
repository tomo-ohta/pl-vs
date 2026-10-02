/**
 * 導く光の迷路（guideLight）: 迷路の形（完全迷路・行き止まり・光の道が正しい道を通る）・入口から出口まで歩ける・
 * 光について行けば出口に着く・光を待たせ続けると隠しが現れる（出現型）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { mazeCount } from '../core/gen/gimmicks/secret.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { WALL_T, type CellLayout } from '../core/world/layout.ts';
import { pathInCell, walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const ROOMS = findRooms('guideLight', 28);

/** 部屋の迷路を当たり判定の箱から読み直す（升目の数は生成と同じ式） */
function readMaze(room: GimmickRoom): { nx: number; nz: number; cw: number; cd: number; r: { x0: number; z0: number; x1: number; z1: number }; open: (a: number, b: number) => boolean; center: (c: number) => [number, number]; cellOf: (x: number, z: number) => number } {
  const cell = room.cell;
  const fr = cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
  const r = { x0: fr.x0 + WALL_T, z0: fr.z0 + WALL_T, x1: fr.x1 - WALL_T, z1: fr.z1 - WALL_T };
  const nx = mazeCount(r.x1 - r.x0, t['gimmick.maze.cellM']), nz = mazeCount(r.z1 - r.z0, t['gimmick.maze.cellM']);
  const cw = (r.x1 - r.x0) / nx, cd = (r.z1 - r.z0) / nz;
  const y = cell.floorY;
  const parts = cell.boxes.filter((b) => b.solid && b.mat === cell.palette.wall && b.min[1] <= y + 0.01 && b.max[1] >= y + cell.height - 0.01 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.12 && b.min[0] >= r.x0 - 1e-3 && b.max[0] <= r.x1 + 1e-3 && b.min[2] >= r.z0 - 1e-3 && b.max[2] <= r.z1 + 1e-3);
  const wallAt = (x: number, z: number): boolean => parts.some((b) => x >= b.min[0] - 1e-3 && x <= b.max[0] + 1e-3 && z >= b.min[2] - 1e-3 && z <= b.max[2] + 1e-3);
  const center = (c: number): [number, number] => [r.x0 + ((c % nx) + 0.5) * cw, r.z0 + (Math.floor(c / nx) + 0.5) * cd];
  const open = (a: number, b: number): boolean => {
    const [ax, az] = center(a), [bx, bz] = center(b);
    return !wallAt((ax + bx) / 2, (az + bz) / 2);
  };
  const cellOf = (x: number, z: number): number => Math.min(nz - 1, Math.max(0, Math.floor((z - r.z0) / cd))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - r.x0) / cw)));
  return { nx, nz, cw, cd, r, open, center, cellOf };
}

const neighbors = (nx: number, nz: number, c: number): number[] => {
  const i = c % nx, k = Math.floor(c / nx);
  return [i + 1 < nx ? c + 1 : -1, i > 0 ? c - 1 : -1, k + 1 < nz ? c + nx : -1, k > 0 ? c - nx : -1].filter((v) => v >= 0);
};

test('迷路の形: 全部の升目がつながる・行き止まりがある・光の道は升目の中心を通り、開いた辺だけを通って入口から出口へ', () => {
  assert.ok(ROOMS.length >= 12, `迷路の部屋: ${ROOMS.length}`);
  let dead = 0;
  for (const room of ROOMS) {
    const m = readMaze(room);
    const n = m.nx * m.nz;
    // つながり
    const seen = new Set([0]);
    const q = [0];
    for (let h = 0; h < q.length; h++) for (const b of neighbors(m.nx, m.nz, q[h]!)) if (!seen.has(b) && m.open(q[h]!, b)) { seen.add(b); q.push(b); }
    assert.equal(seen.size, n, `${room.floor.id} ${room.cell.id}: 全部の升目がつながる（${seen.size}/${n}）`);
    // 光の道
    const guide = room.floor.entities.find((e) => e.type === 'guideLight' && e.cell === room.cell.id)!;
    const pts = guide.params.points as number[][];
    assert.equal(guide.params.follow, 'path');
    const inner = pts.slice(1, -1);
    for (const p of inner) {
      const [cx, cz] = m.center(m.cellOf(p[0]!, p[2]!));
      assert.ok(Math.abs(p[0]! - cx) < 0.01 && Math.abs(p[2]! - cz) < 0.01, `${room.cell.id}: 光の道の折れ目は升目の中心`);
    }
    const onPath = new Set<number>();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const steps = Math.ceil(Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!) / 0.1);
      let prev = m.cellOf(a[0]!, a[2]!);
      onPath.add(prev);
      for (let s = 1; s <= steps; s++) {
        const c = m.cellOf(a[0]! + ((b[0]! - a[0]!) * s) / steps, a[2]! + ((b[2]! - a[2]!) * s) / steps);
        if (c !== prev) { assert.ok(m.open(prev, c), `${room.floor.id} ${room.cell.id}: 光の道が仕切りを抜けない（${prev} → ${c}）`); onPath.add(c); prev = c; }
      }
    }
    // 始まりは入口の前、終わりは入口でない開口（出口）の前
    const e = room.entry.aabb;
    const near = (p: number[], a: typeof e): number => Math.hypot(p[0]! - (a.min[0] + a.max[0]) / 2, p[2]! - (a.min[2] + a.max[2]) / 2);
    assert.ok(near(pts[0]!, e) < 1.3, `${room.cell.id}: 光は入口の前から`);
    const others = room.floor.portals.filter((p) => p.cells.includes(room.cell.id) && p !== room.entry && !p.cells.some((c) => c.startsWith('secret')));
    assert.ok(others.some((p) => near(pts[pts.length - 1]!, p.aabb) < 1.3), `${room.cell.id}: 光は出口の前まで`);
    // 行き止まり（光の道の外で、開いた辺が 1 本）
    const deadEnds = [...Array(n).keys()].filter((c) => !onPath.has(c) && neighbors(m.nx, m.nz, c).filter((b) => m.open(c, b)).length === 1);
    assert.ok(deadEnds.length >= 1, `${room.floor.id} ${room.cell.id}: 行き止まりがある`);
    dead += deadEnds.length;
    // 部屋の照明は消えたまま
    const darkId = room.floor.entities.find((en) => en.type === 'lamp' && en.cell === room.cell.id && en.params.on === false)?.id;
    assert.ok(darkId && room.cell.lights.every((l) => l.lampId === darkId), `${room.cell.id}: 照明は消えている`);
  }
  console.log(`  迷路 ${ROOMS.length} 部屋、行き止まり 平均 ${(dead / ROOMS.length).toFixed(1)}`);
});

test('迷路: 歩く人が入口から出口まで抜けられる（光に頼らず、形だけで道を探す）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  for (const room of ROOMS.filter((x) => x.beyond).slice(0, 16)) {
    const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    // 入口の内側（入口の床・升目）から出口の向こうの区画へ
    sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
    const res = walkTo(sim, room.beyond!, undefined, 120);
    if (!res.ok || !res.route.includes(room.exit!.id)) fails.push(`${room.floor.id} ${room.cell.id}: ${res.reason || '迷路を通らない道順'}`);
    sim.physics?.dispose();
  }
  assert.deepEqual(fails, []);
});

/** 光について行く人: 0.25 秒ごとに光の真下への道を引き直して歩く。光が出口に着き、人が出口の前に着いたら true */
function followLight(sim: Sim, cell: CellLayout, guideId: string, maxSec: number): { ok: boolean; waitedSec: number; lostSec: number } {
  const p = sim.players[0]!;
  let path: [number, number][] = [];
  let waited = 0, lost = 0;
  for (let n = 0; n < maxSec / sim.dt; n++) {
    const lp = sim.stateOf(guideId)!.pos as number[];
    if (n % 15 === 0) path = pathInCell(sim, cell, p.pos, [lp[0]!, cell.floorY, lp[2]!]) ?? [];
    while (path.length && Math.hypot(path[0]![0] - p.pos[0], path[0]![1] - p.pos[2]) < 0.3) path.shift();
    const tgt = path[0] ?? [lp[0]!, lp[2]!];
    const dx = tgt[0] - p.pos[0], dz = tgt[1] - p.pos[2];
    sim.step([{ ...IDLE_COMMAND, yaw: Math.atan2(-dx, -dz), moveY: Math.hypot(dx, dz) > 0.2 ? 1 : 0 }]);
    if (sim.outputOf(guideId, 'waiting') > 0.5) waited += sim.dt;
    if (sim.outputOf(guideId, 'lost') > 0.5) lost += sim.dt;
    if (sim.outputOf(guideId, 'done') > 0.5 && Math.hypot(lp[0]! - p.pos[0], lp[2]! - p.pos[2]) < 1.2) return { ok: true, waitedSec: waited, lostSec: lost };
  }
  return { ok: false, waitedSec: waited, lostSec: lost };
}

test('迷路: 光について行けば出口の前に着く・ついて行く人の前で光は長く待たない', async () => {
  const R = await loadRapier();
  for (const room of ROOMS.slice(0, 10)) {
    const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
    const guide = room.floor.entities.find((e) => e.type === 'guideLight' && e.cell === room.cell.id)!;
    const res = followLight(sim, room.cell, guide.id, 180);
    assert.ok(res.ok, `${room.floor.id} ${room.cell.id}: 光について行けば出口に着く`);
    assert.ok(res.waitedSec < t['gimmick.maze.ignoreSec'] * 0.5, `${room.cell.id}: ついて行く人を光が待ち続けない（${res.waitedSec.toFixed(1)} 秒）`);
    assert.ok(res.lostSec < t['gimmick.maze.ignoreSec'] * 0.5, `${room.cell.id}: ついて行く人は光を無視したことにならない（${res.lostSec.toFixed(1)} 秒）`);
    sim.physics?.dispose();
  }
});

test('迷路: 光が止まっている人を待つ / 行き止まりで光を無視し続けると隠しの扉が現れる（出現型）', async () => {
  const R = await loadRapier();
  let checked = 0;
  for (let w = 1; w <= 900 && checked < 4; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: w % 3 === 0 ? 1 : 0 }, t);
    for (const sec of r.gimmicks?.secrets ?? []) {
      if (sec.hook !== 'light.ignore' || sec.mode !== 'appear') continue;
      const cell = r.floor.cells.find((c) => c.id === sec.host)!;
      const guide = r.floor.entities.find((e) => e.type === 'guideLight' && e.cell === sec.host)!;
      const start = guide.params.points as number[][];
      const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      // 入口の前に立って光を動かし始め、そのまま止まっている → 光は先で待つ（進み続けない）
      sim.teleport(0, [start[0]![0]!, cell.floorY + 0.02, start[0]![2]!], 0);
      for (let i = 0; i < 60 * 8; i++) sim.step([{ ...IDLE_COMMAND }]);
      const p1 = sim.outputOf(guide.id, 'progress');
      for (let i = 0; i < 60 * 2; i++) sim.step([{ ...IDLE_COMMAND }]);
      // 道が短い迷路では、待つ前に光が出口に着く
      let total = 0;
      for (let i = 1; i < start.length; i++) total += Math.hypot(start[i]![0]! - start[i - 1]![0]!, start[i]![2]! - start[i - 1]![2]!);
      if (total > t['gimmick.maze.waitDist'] + 1.5) assert.ok(p1 < 1 && Math.abs(sim.outputOf(guide.id, 'progress') - p1) < 1e-6 && sim.outputOf(guide.id, 'waiting') > 0.5, `${r.floor.id}: 光が待つ（道 ${total.toFixed(1)} m、進み ${p1.toFixed(2)}）`);
      assert.ok(!sim.isRevealed(`${sec.id}.wall`) || t['gimmick.maze.ignoreSec'] < 8, '待たせ始めてすぐには現れない');
      // 隠しの扉の前（行き止まり）へ行って待つ
      const door = r.floor.portals.find((p) => p.cells[0] === sec.host && p.cells[1] === sec.cell)!;
      const front = [(door.aabb.min[0] + door.aabb.max[0]) / 2, (door.aabb.min[2] + door.aabb.max[2]) / 2];
      const cx = (cell.bounds.min[0] + cell.bounds.max[0]) / 2, cz = (cell.bounds.min[2] + cell.bounds.max[2]) / 2;
      const at: [number, number, number] = door.dir % 2 === 1 ? [front[0]! + Math.sign(cx - front[0]!) * 0.8, cell.floorY + 0.02, front[1]!] : [front[0]!, cell.floorY + 0.02, front[1]! + Math.sign(cz - front[1]!) * 0.8];
      sim.teleport(0, at, 0);
      for (let i = 0; i < 60 * (t['gimmick.maze.ignoreSec'] + 1); i++) sim.step([{ ...IDLE_COMMAND }]);
      assert.ok(sim.isRevealed(`${sec.id}.wall`), `${r.floor.id} ${sec.id}: 光を無視し続けると現れる`);
      sim.physics?.dispose();
      checked++;
    }
  }
  assert.ok(checked >= 2, `出現型の迷路の隠し: ${checked}`);
});

test('迷路: 同じ key なら同じ迷路（決定的）', () => {
  for (const room of ROOMS.slice(0, 4)) {
    const again = regenerate(room);
    const a = room.floor.cells.find((c) => c.id === room.cell.id)!, b = again.cells.find((c) => c.id === room.cell.id)!;
    assert.equal(JSON.stringify(b.boxes), JSON.stringify(a.boxes));
    assert.equal(JSON.stringify(again.entities.filter((e) => e.cell === room.cell.id)), JSON.stringify(room.floor.entities.filter((e) => e.cell === room.cell.id)));
  }
});
