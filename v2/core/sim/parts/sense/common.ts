/**
 * 光・音・視線・時間の部品の共通の判定（段階 4・担当 sense）。
 *
 * - 視線: 目の位置・視線の向き（yaw / pitch）と、点が「画面に映っている」か（縦・横の画角の半分。既定は縦 34°・横 52° = 16:9 の画面の端の少し内側）
 * - 懐中電灯: 点いていて、光の円錐（半角 deg）の中・range 以内・遮られていない（区画の静的な当たる箱で見る）
 * - 遮り: 区画の当たる箱（静的。出現型の隠し・描かない当たり判定は除く）を、フロアごとに一度だけ集めて覚える
 *   （生成の結果だけから決まるので決定論は崩れない。状態には入れない）
 */
import { rayAabb, type AABB } from '../../../math/aabb.ts';
import { lookDir, type Vec3 } from '../../../math/vec.ts';
import { PASSABLE_VEGETATION, type FloorLayout } from '../../../world/layout.ts';
import type { PlayerState } from '../../types.ts';

export const eyeOf = (p: PlayerState): Vec3 => [p.pos[0], p.pos[1] + p.eye, p.pos[2]];

/** 点が視線から何度ずれているか（縦・横を分けて。視線の向きの座標で、横 = 右、縦 = 上） */
export function viewOffsetDeg(p: PlayerState, target: Vec3): { h: number; v: number; dist: number; front: boolean } {
  const e = eyeOf(p);
  const d: Vec3 = [target[0] - e[0], target[1] - e[1], target[2] - e[2]];
  const dist = Math.hypot(d[0], d[1], d[2]);
  const f = lookDir(p.yaw, p.pitch);
  // 右 = 前 × 上（three のカメラと同じ: yaw 0 で -Z を向くとき右は +X）
  const r: Vec3 = [Math.cos(p.yaw), 0, -Math.sin(p.yaw)];
  const u: Vec3 = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
  const y = -(d[0] * u[0] + d[1] * u[1] + d[2] * u[2]);
  const deg = 180 / Math.PI;
  return { h: Math.atan2(x, Math.max(1e-6, z)) * deg, v: Math.atan2(y, Math.max(1e-6, z)) * deg, dist, front: z > 0.05 };
}

/** 点が画面に映っている（視線の前・縦 vdeg・横 hdeg 以内・maxDist 以内）。遮りは見ない */
export function onScreen(p: PlayerState, target: Vec3, hdeg = 52, vdeg = 34, maxDist = 40): boolean {
  const o = viewOffsetDeg(p, target);
  return o.front && o.dist <= maxDist && Math.abs(o.h) <= hdeg && Math.abs(o.v) <= vdeg;
}

/** 点が視線の円錐（半角 deg）の中 */
export function inCone(p: PlayerState, target: Vec3, deg: number, maxDist: number): boolean {
  const e = eyeOf(p);
  const d: Vec3 = [target[0] - e[0], target[1] - e[1], target[2] - e[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  if (l > maxDist) return false;
  if (l < 1e-6) return true;
  const f = lookDir(p.yaw, p.pitch);
  return (d[0] * f[0] + d[1] * f[1] + d[2] * f[2]) / l >= Math.cos((deg * Math.PI) / 180);
}

// ---------------------------------------------------------------- 遮り
const SOLIDS = new WeakMap<FloorLayout, Map<string, AABB[]>>();

/** 区画の静的な当たる箱（出現型の隠し・草木・描かない光源は除く） */
export function cellSolids(floor: FloorLayout, cellId: string): AABB[] {
  let byCell = SOLIDS.get(floor);
  if (!byCell) SOLIDS.set(floor, (byCell = new Map()));
  let list = byCell.get(cellId);
  if (!list) {
    const cell = floor.cells.find((c) => c.id === cellId);
    list = (cell?.boxes ?? []).filter((b) => b.solid && !b.revealGroup && !b.concealGroup && !PASSABLE_VEGETATION.has(b.mat) && b.kind !== 'emitOnly').map((b) => ({ min: [...b.min], max: [...b.max] }) as AABB);
    byCell.set(cellId, list);
  }
  return list;
}

/** 線分 a → b が区画の箱に遮られる（両端の近く pad m は見ない。a・b が箱に触れていても遮りにしない） */
export function blockedIn(floor: FloorLayout, cellId: string, a: Vec3, b: Vec3, pad = 0.08): boolean {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  if (l <= 2 * pad) return false;
  const dir: Vec3 = [d[0] / l, d[1] / l, d[2] / l];
  const o: Vec3 = [a[0] + dir[0] * pad, a[1] + dir[1] * pad, a[2] + dir[2] * pad];
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  for (const box of cellSolids(floor, cellId)) {
    if (box.max[0] < lo[0]! || box.min[0] > hi[0]! || box.max[1] < lo[1]! || box.min[1] > hi[1]! || box.max[2] < lo[2]! || box.min[2] > hi[2]!) continue;
    const t = rayAabb(o, dir, box, l - 2 * pad);
    if (t !== null) return true;
  }
  return false;
}

/** 懐中電灯が点 target を照らしている（点いている・円錐の半角 deg・range 以内・cellId の箱に遮られない。cellId が無ければ遮りを見ない） */
export function flashlightHits(floor: FloorLayout, p: PlayerState, target: Vec3, deg: number, range: number, cellId?: string): boolean {
  if (!p.flashlight || !inCone(p, target, deg, range)) return false;
  return !cellId || !blockedIn(floor, cellId, eyeOf(p), target);
}

/** 区画 aabb の中のプレイヤー（足元） */
export function playersIn(players: readonly PlayerState[], a: AABB, margin = 0): PlayerState[] {
  return players.filter((p) => p.pos[0] >= a.min[0] - margin && p.pos[0] <= a.max[0] + margin && p.pos[2] >= a.min[2] - margin && p.pos[2] <= a.max[2] + margin && p.pos[1] + 0.1 >= a.min[1] - margin && p.pos[1] <= a.max[1] + margin);
}

/** 折れ線（[x, z] の列）の長さ */
export function lineLength(pts: readonly (readonly number[])[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]![0]! - pts[i - 1]![0]!, pts[i]![1]! - pts[i - 1]![1]!);
  return l;
}

/** 折れ線の上で、始まりから d m の点 */
export function lineAt(pts: readonly (readonly number[])[], d: number): [number, number] {
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const l = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
    if (left <= l || i === pts.length - 1) {
      const k = l > 1e-9 ? Math.min(1, left / l) : 0;
      return [a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k];
    }
    left -= l;
  }
  const last = pts[pts.length - 1] ?? [0, 0];
  return [last[0]!, last[1]!];
}

/**
 * 往復する点（止まる時間つき）: 長さ len の道を速さ speed で行き来し、両端で pause 秒止まる。時刻 t の位置（始まりからの道のり）と向き
 * （仕掛けの部品と、試験の歩く人が同じ式で先を読む）
 */
export function shuttle(t: number, len: number, speed: number, pause: number, phase = 0): { d: number; dir: 1 | -1 | 0 } {
  const leg = len / Math.max(1e-6, speed);
  const period = 2 * (leg + pause);
  let u = (((t + phase) % period) + period) % period;
  if (u < pause) return { d: 0, dir: 0 };
  u -= pause;
  if (u < leg) return { d: u * speed, dir: 1 };
  u -= leg;
  if (u < pause) return { d: len, dir: 0 };
  u -= pause;
  return { d: len - u * speed, dir: -1 };
}
