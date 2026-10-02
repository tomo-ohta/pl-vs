/**
 * 空間のゆがみ（warp）の部品の共通の道具。
 * - Xform: 同じ形の所どうしの写し方（点 from を to へ、1/4 回転 q。p' = to + rotQ(p − from, q)）。向きは yaw + q·π/2
 * - seenBy: プレイヤーから箱が見えているか（視野の円錐と、当たり判定の箱で遮られないか = PartContext.sightClear）。見ていない間に作り替える仕掛けに使う
 * - JSON の読み書き（params の Xform・箱の列）
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import { lookDir, rotQ, type Dir, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import type { PlayerState } from '../../types.ts';

export interface Xform { from: Vec3; to: Vec3; q: Dir }

export const IDENTITY: Xform = { from: [0, 0, 0], to: [0, 0, 0], q: 0 };

export function xPoint(x: Xform, p: readonly number[]): Vec3 {
  const r = rotQ([p[0]! - x.from[0], p[1]! - x.from[1], p[2]! - x.from[2]], x.q);
  return [r[0] + x.to[0], r[1] + x.to[1], r[2] + x.to[2]];
}

/** 向き（ベクトル）だけを写す */
export function xVec(x: Xform, v: readonly number[]): Vec3 {
  return rotQ([v[0]!, v[1]!, v[2]!], x.q);
}

export function xYaw(x: Xform, yaw: number): number {
  return yaw + (x.q * Math.PI) / 2;
}

export function xInverse(x: Xform): Xform {
  return { from: [...x.to], to: [...x.from], q: ((4 - x.q) % 4) as Dir };
}

/** a のあとに b（p → b(a(p))） */
export function xCompose(a: Xform, b: Xform): Xform {
  return { from: [...a.from], to: xPoint(b, a.to), q: ((a.q + b.q) % 4) as Dir };
}

export function xBox(x: Xform, a: AABB): AABB {
  const p = xPoint(x, a.min), q = xPoint(x, a.max);
  return { min: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], max: [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])] };
}

export function xJson(x: Xform): Json {
  return { from: [...x.from], to: [...x.to], q: x.q };
}

export function readXform(v: Json | undefined): Xform {
  const o = (v ?? {}) as { from?: number[]; to?: number[]; q?: number };
  const f = o.from ?? [0, 0, 0], t = o.to ?? [0, 0, 0];
  return { from: [f[0] ?? 0, f[1] ?? 0, f[2] ?? 0], to: [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0], q: ((((o.q ?? 0) % 4) + 4) % 4) as Dir };
}

export function readAabb(v: Json | undefined): AABB {
  const o = v as { min: number[]; max: number[] };
  return { min: [o.min[0]!, o.min[1]!, o.min[2]!], max: [o.max[0]!, o.max[1]!, o.max[2]!] };
}

export function inBox(p: readonly number[], a: AABB, margin = 0): boolean {
  return p[0]! >= a.min[0] - margin && p[0]! <= a.max[0] + margin && p[1]! >= a.min[1] - margin && p[1]! <= a.max[1] + margin && p[2]! >= a.min[2] - margin && p[2]! <= a.max[2] + margin;
}

/** 視野の円錐の半角（rad）。縦 72°・横長の画面（2.4:1）の横の半角 60° に余裕を足す */
export const VIEW_HALF_ANGLE = (70 * Math.PI) / 180;

/** 箱の見え方を調べる点（中心と、上下の面の 4 隅を少し内側へ） */
function samplePoints(a: AABB): Vec3[] {
  const c = aabbCenter(a);
  const out: Vec3[] = [c];
  const ix = (a.max[0] - a.min[0]) * 0.4, iz = (a.max[2] - a.min[2]) * 0.4;
  for (const y of [a.min[1] + (a.max[1] - a.min[1]) * 0.15, a.max[1] - (a.max[1] - a.min[1]) * 0.15]) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) out.push([c[0] + sx * ix, y, c[2] + sz * iz]);
  }
  return out;
}

/**
 * プレイヤーから箱 a が見えている（かもしれない）か: 調べる点のどれかが視野の円錐に入り、遮られずに見通せる。
 * 近すぎる（1.2 m 以内）ときは向きによらず見えているとする（振り向いた瞬間に変わらないように）。maxDist より遠い箱は見えない
 */
export function seenBy(p: PlayerState, a: AABB, sight: ((from: Vec3, to: Vec3) => boolean) | null | undefined, maxDist = 40): boolean {
  const eye: Vec3 = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  const dir = lookDir(p.yaw, p.pitch);
  const cos = Math.cos(VIEW_HALF_ANGLE);
  for (const s of samplePoints(a)) {
    const v: Vec3 = [s[0] - eye[0], s[1] - eye[1], s[2] - eye[2]];
    const l = Math.hypot(v[0], v[1], v[2]);
    if (l > maxDist) continue;
    if (l > 1.2 && (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / l < cos) continue;
    if (!sight || sight(eye, s)) return true;
  }
  return false;
}

/** 平面の横切り: 点 c を通り向き dir（0:+Z 1:+X 2:-Z 3:-X）に向いた面の、どちら側か（dir の向きに正） */
export function sideOf(c: readonly number[], dir: Dir, p: readonly number[]): number {
  switch (dir) {
    case 0: return p[2]! - c[2]!;
    case 1: return p[0]! - c[0]!;
    case 2: return c[2]! - p[2]!;
    default: return c[0]! - p[0]!;
  }
}
