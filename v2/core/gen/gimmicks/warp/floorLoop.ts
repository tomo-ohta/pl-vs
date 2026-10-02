/**
 * 前の階に戻る輪（F30。v1 E01 の発展）: 何階か進むと、ふつうの出口の階段を下りた先が、前に来た階（2〜3 階上）になる。
 * 着く所は、その階の入口の階段ではなく、入口から遠い部屋の扉を入ったところ（別の入口から出る）。前に歩いた部屋に、知らない側から入る。
 * 同じ階からの輪は 1 回だけ（2 回目にその階の出口を下りると、ふつうに次の階へ。クライアント client/main.ts が覚える）。
 *
 * floorLoopTarget: 深さ depth のふつうの出口が前の階へ戻るなら、その深さ（決定的。世界の seed と深さで決まる）。戻らなければ null
 * loopSpawn: 前の階に別の入口から出る所（入口から遠い部屋の扉の内側 1 m・部屋の中を向く。決定的）
 */
import type { Tuning } from '../../../config/tuning.ts';
import { hashAll } from '../../../math/rng.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { FloorLayout } from '../../../world/layout.ts';

export function floorLoopTarget(world: number, depth: number, t: Tuning): number | null {
  if (depth < t['warp.floorLoop.minDepth']) return null;
  const h = hashAll(world, depth, 'floorLoop') / 4294967296;
  if (h >= t['warp.floorLoop.chance']) return null;
  const back = 2 + (hashAll(world, depth, 'floorLoop.back') % 2);
  return Math.max(0, depth - back);
}

const ROLES = new Set(['side', 'rest', 'hub', 'gimmick', 'landmark']);

export function loopSpawn(floor: FloorLayout, world: number): FloorLayout['spawn'] {
  const s = floor.spawn.pos;
  // 入口から遠い部屋（別の空間・隠し・階段の区画は除く）の、扉の付いた開口
  const cand: { cell: string; pos: Vec3; yaw: number; d: number }[] = [];
  for (const c of floor.cells) {
    if (c.pocket || !ROLES.has(c.role) || c.id === floor.spawn.cell || c.footprint.length !== 1) continue;
    for (const p of floor.portals) {
      if (!p.cells.includes(c.id) || p.kind !== 'door' || p.cells.some((x) => x.startsWith('secret'))) continue;
      const a = p.aabb;
      const pc: Vec3 = [(a.min[0] + a.max[0]) / 2, c.floorY, (a.min[2] + a.max[2]) / 2];
      const cc = [(c.bounds.min[0] + c.bounds.max[0]) / 2, (c.bounds.min[2] + c.bounds.max[2]) / 2];
      const alongX = a.max[0] - a.min[0] > a.max[2] - a.min[2];
      const inward: [number, number] = alongX ? [0, Math.sign(cc[1]! - pc[2])] : [Math.sign(cc[0]! - pc[0]), 0];
      const pos: Vec3 = [pc[0] + inward[0] * 1.0, c.floorY + 0.02, pc[2] + inward[1] * 1.0];
      cand.push({ cell: c.id, pos, yaw: Math.atan2(-inward[0], -inward[1]), d: Math.hypot(pos[0] - s[0], pos[2] - s[2]) });
    }
  }
  if (!cand.length) return floor.spawn;
  // 遠い方の半分から、世界の seed で 1 つ（決定的）
  cand.sort((p, q) => q.d - p.d || (p.cell < q.cell ? -1 : 1));
  const far = cand.slice(0, Math.max(1, Math.ceil(cand.length / 2)));
  const pick = far[hashAll(world, floor.id, 'loopSpawn') % far.length]!;
  return { cell: pick.cell, pos: pick.pos, yaw: pick.yaw };
}
