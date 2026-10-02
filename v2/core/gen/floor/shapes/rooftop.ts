/**
 * 屋上（F33）: 屋外の屋上（天井なし・灰色の霧）。四方は胸壁と、その上の高い金網（向こうは霧しか見えない）。
 *
 * - 屋上の床（区画 1 つ）に、小屋が建つ: 入口の階段室（降りてきた階段の上の小屋）・機械室（ふつうの部屋。仕掛けや異変が入る）・
 *   倉庫。小屋は屋上の区画の穴（穴のまわりの壁を小屋の高さで切り、外壁の材質にする。styles.ts の carveInner）
 * - 一段高い屋上（給水塔の載る台）へ上る短い階段・室外機の列・アンテナの柱・水たまり
 * - 出口: 屋上の縁の金網の戸から、外の非常階段で下へ（exitStairs の outdoor）
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { Rng } from '../../../math/rng.ts';
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type CellLayout } from '../../../world/layout.ts';
import type { FloorProfile } from '../profile.ts';
import { entryStairs, exitStairs, GeoBuild, snap, type FloorGeometry, type Placed } from '../geometry.ts';
import type { SkelNode } from '../skeleton.ts';
import { addRailings, lampPost, outdoorEnv } from './outdoor.ts';
import { carveInner, holeJoin } from './styles.ts';

const node = (id: number): SkelNode => ({ id, col: 0, row: 0, kind: 'room', level: 0, hall: -1, story: 0 });

export function buildRooftop(p: FloorProfile, rng: Rng, t: Tuning): FloorGeometry {
  const fam = p.family;
  const hc = snap(rng.float(fam.corridorHeight[0], fam.corridorHeight[1]));
  const g = new GeoBuild(p, t, rng.fork('doors'), 2.4);
  const rail = t['structure.railM'];
  const env = outdoorEnv('day', t['structure.outdoor.fogNear'], t['structure.outdoor.fogFar']);
  const W = snap(rng.float(24, 32)), D = snap(rng.float(18, 24));
  const hutH = t['structure.building.heightM'];
  const roof: Placed = {
    node: node(0), rect: { x0: snap(-W / 2), x1: snap(W / 2), z0: snap(-D - 1), z1: -1 }, y: 0, height: hutH + 0.2, theme: 'ParkingGrid', kind: 'hall', cellId: 'roof', fam,
    opts: { noCeiling: true, lights: 'none', palette: { floor: 'floorConcrete', wall: 'wallConcrete', ambient: env.ambient, fog: env.fog }, render: env.render, lighting: env.lighting, name: '屋上', audio: '換気・遠い車道音', role: 'hub' },
  };
  g.reserved.add('roof');
  g.keep('roof', { min: [roof.rect.x0, -0.1, roof.rect.z0], max: [roof.rect.x1, 4, roof.rect.z1] });
  const r = roof.rect;
  // 入口の階段室（手前の縁に接する小屋。降りてきた階段は小屋の手前へ）
  const ex = snap(rng.float(r.x0 + 4, r.x1 - 7));
  const entryHut = carveInner(g, roof, { x0: ex, x1: snap(ex + 3.4), z0: snap(r.z1 - 3.6), z1: r.z1 }, { node: node(1), y: 0, height: hutH, theme: 'CorridorService', kind: 'room', cellId: 'roofEntry', fam, opts: { role: 'entry', name: '階段室' } }, 'wallConcrete');
  g.reserved.add('roofEntry');
  entryStairs(g, entryHut, hc);
  holeJoin(g, roof, entryHut, 2, snap(ex + 1.7), 0, { mat: 'doorMetal' });
  // 機械室（ふつうの部屋）と倉庫
  const huts: Placed[] = [entryHut];
  const free = (q: Rect): boolean => huts.every((h) => q.x0 > h.rect.x1 + 2.2 || q.x1 < h.rect.x0 - 2.2 || q.z0 > h.rect.z1 + 2.2 || q.z1 < h.rect.z0 - 2.2);
  const hutAt = (w: number, d: number): Rect | null => {
    for (let i = 0; i < 30; i++) {
      const x0 = snap(rng.float(r.x0 + 2.4, r.x1 - 2.4 - w)), z0 = snap(rng.float(r.z0 + 2.4, r.z1 - 2.4 - d - 3.6));
      const q = { x0, x1: snap(x0 + w), z0, z1: snap(z0 + d) };
      if (free(q)) return q;
    }
    return null;
  };
  for (const [id, w, d, theme, name] of [['roofMachine', snap(rng.float(5, 6.5)), snap(rng.float(4.2, 5.2)), 'ServerGrid', '機械室'], ['roofStore', 3.6, 3.2, 'StorageGrid', '倉庫']] as const) {
    const q = hutAt(w, d);
    if (!q) continue;
    const hut = carveInner(g, roof, q, { node: node(huts.length + 1), y: 0, height: hutH, theme, kind: 'room', cellId: id, fam, opts: { role: 'side', name } }, 'sidingMetal');
    huts.push(hut);
    // 扉: 屋上の広い方を向く辺
    const room = (dd: Dir): number => (dd === 0 ? r.z1 - q.z1 : dd === 2 ? q.z0 - r.z0 : dd === 1 ? r.x1 - q.x1 : q.x0 - r.x0);
    const side = ([0, 1, 2, 3] as Dir[]).sort((a2, b2) => room(b2) - room(a2))[0]!;
    holeJoin(g, roof, hut, side, side === 0 || side === 2 ? snap((q.x0 + q.x1) / 2) : snap((q.z0 + q.z1) / 2), 0, { mat: 'doorMetal' });
  }
  // 出口: 縁の金網の戸から外の非常階段（左右の縁のどちらか。奥の方）
  const exitDir: Dir = rng.chance(0.5) ? 1 : 3;
  const exitAt = snap(rng.float(r.z0 + 2.5, (r.z0 + r.z1) / 2));
  exitStairs(g, roof, exitDir, 0, hc, { id: 'exitStairs', exitId: 'down', doorId: 'door:exit', at: exitAt, outdoor: true });
  // 縁: 胸壁（開口の無い所は手すりの高さの壁。上は開く）。小屋のまわりの壁（穴の縁）はそのまま
  const onHutEdge = (dir: Dir, at: number, coord: number): boolean => huts.some((h) => {
    const q = h.rect;
    const c = dir === 0 ? q.z0 : dir === 2 ? q.z1 : dir === 1 ? q.x0 : q.x1;
    const [lo, hi] = dir === 0 || dir === 2 ? [q.x0, q.x1] : [q.z0, q.z1];
    return Math.abs(c - coord) < 0.05 && at > lo - 0.05 && at < hi + 0.05;
  });
  roof.preBuild = [(pl) => addRailings(g, pl.cellId, pl.rects ?? [pl.rect], 0, pl.height, rail, onHutEdge)];
  // 屋上の物: 金網・一段高い台と給水塔・室外機・アンテナ・水たまり・街灯
  roof.post = [...(roof.post ?? []), (cell) => dressRoof(cell, r, huts, rng, rail, exitDir, exitAt)];
  g.cell(roof);
  return g.finish(null);
}

function dressRoof(cell: CellLayout, r: Rect, huts: Placed[], rng: Rng, rail: number, exitDir: Dir, exitAt: number): void {
  const B: Box[] = cell.boxes;
  const fenceTop = 3.2;
  // 金網: 胸壁の上に、細い縦の格子（0.25 m おき。向こうの霧が透ける）・上と中の横桟・2 m おきの柱。描画だけ（胸壁で越えられない）
  const edges: [number, number, number, number][] = [[r.x0, r.z0, r.x1, r.z0 + WALL_T], [r.x0, r.z1 - WALL_T, r.x1, r.z1], [r.x0, r.z0, r.x0 + WALL_T, r.z1], [r.x1 - WALL_T, r.z0, r.x1, r.z1]];
  const isExit = (x: number, z: number): boolean => (exitDir === 1 ? Math.abs(x - r.x1) < 0.3 : Math.abs(x - r.x0) < 0.3) && Math.abs(z - exitAt) < 0.9;
  const onHut = (x: number, z: number): boolean => huts.some((h) => x >= h.rect.x0 - 0.2 && x <= h.rect.x1 + 0.2 && z >= h.rect.z0 - 0.2 && z <= h.rect.z1 + 0.2);
  for (const [x0, z0, x1, z1] of edges) {
    const alongX = x1 - x0 > z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0;
    const c = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    const at = (a: number): [number, number] => (alongX ? [x0 + a, c] : [c, z0 + a]);
    for (let k = 0; 0.1 + k * 0.25 < len - 0.05; k++) {
      const [x, z] = at(0.1 + k * 0.25);
      if (isExit(x, z) || onHut(x, z)) continue;
      const big = k % 8 === 0;
      const s = big ? 0.04 : 0.012;
      B.push(box([x - s, rail, z - s], [x + s, fenceTop, z + s], big ? 'metalDark' : 'metal', false));
    }
    for (let a = 0; a < len - 0.05; a += 2) {
      const s1 = Math.min(len, a + 2);
      const [px, pz] = at(a), [qx, qz] = at(s1);
      if (isExit((px + qx) / 2, (pz + qz) / 2) || onHut((px + qx) / 2, (pz + qz) / 2)) continue;
      for (const yy of [fenceTop - 0.04, (rail + fenceTop) / 2]) B.push(alongX ? box([px, yy, c - 0.02], [qx, yy + 0.04, c + 0.02], 'metalDark', false) : box([c - 0.02, yy, pz], [c + 0.02, yy + 0.04, qz], 'metalDark', false));
    }
  }
  // 室外機の列（壁際）
  const n = rng.int(3, 6);
  const alongZ = rng.chance(0.5);
  const ex = exitDir === 1 ? r.x1 : r.x0;
  for (let i = 0; i < n; i++) {
    const x = alongZ ? r.x0 + 1.0 : r.x0 + 4 + i * 1.6, z = alongZ ? r.z0 + 4 + i * 1.6 : r.z0 + 1.0;
    // 小屋の前・出口の戸の前には置かない
    if (onHut(x, z) || huts.some((h) => x > h.rect.x0 - 2 && x < h.rect.x1 + 2 && z > h.rect.z0 - 2 && z < h.rect.z1 + 2) || Math.hypot(x - ex, z - exitAt) < 3) continue;
    B.push(box([x - 0.45, 0, z - 0.4], [x + 0.45, 0.9, z + 0.4], 'metal'));
    B.push(box([x - 0.3, 0.9, z - 0.3], [x + 0.3, 0.92, z + 0.3], 'metalDark', false));
  }
  // 給水塔: 4 本の脚の上の箱（奥の角）
  const tx = r.x1 - 3.2, tz = r.z0 + 3.2;
  if (!onHut(tx, tz)) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) B.push(box([tx + dx * 1.0 - 0.08, 0, tz + dz * 1.0 - 0.08], [tx + dx * 1.0 + 0.08, 2.4, tz + dz * 1.0 + 0.08], 'metalDark'));
    B.push(box([tx - 1.3, 2.4, tz - 1.3], [tx + 1.3, 4.4, tz + 1.3], 'stainless'));
  }
  // アンテナの柱と赤い灯り
  const axp = r.x0 + 2.0, azp = r.z1 - 2.0;
  if (!onHut(axp, azp)) {
    B.push(box([axp - 0.06, 0, azp - 0.06], [axp + 0.06, 7, azp + 0.06], 'metalDark'));
    B.push(box([axp - 0.1, 7, azp - 0.1], [axp + 0.1, 7.15, azp + 0.1], 'neonRed', false));
  }
  // 水たまり
  for (let i = 0; i < 6; i++) {
    const x = rng.float(r.x0 + 2, r.x1 - 2), z = rng.float(r.z0 + 2, r.z1 - 2), s = rng.float(0.5, 1.4);
    if (onHut(x, z)) continue;
    B.push(box([x - s, 0.004, z - s * 0.7], [x + s, 0.008, z + s * 0.7], 'puddle', false));
  }
  // 街灯（縁の 4 か所）
  for (const [x, z] of [[r.x0 + 0.5, (r.z0 + r.z1) / 2], [r.x1 - 0.5, (r.z0 + r.z1) / 2], [(r.x0 + r.x1) / 2, r.z0 + 0.5], [(r.x0 + r.x1) / 2, r.z1 - 0.5]] as const) {
    if (onHut(x, z) || isExit(x, z)) continue;
    lampPost(B, x, z, rail, 3.4, 'lightPanel');
    cell.lights.push({ pos: [x, 3.2, z], color: 0xe8eef8, intensity: 0.45, distance: 12 });
  }
}
