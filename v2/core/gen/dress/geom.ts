/**
 * 家具を置くための形の補助（v1 generators/furniture.ts・common.ts の「壁の室内面」「扉前の禁止領域」「重なり」の判定を移植）。
 *
 * - 高さはすべて区画の床からの値（床 = 0）。フロア座標の高さへは ctx.ts の finish が floorY を足して直す
 * - v1 の Socket の代わりに WallOpening（pos = 壁の外面の床位置、dir = 外向き）を使う。床穴（hole）は v2 の開口に無い
 */
import type { AABB } from '../../math/aabb.ts';
import type { Dir } from '../../math/vec.ts';
import { across, along, wallSpans, type Rect } from '../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId, type WallOpening } from '../../world/layout.ts';

// ---------------------------------------------------------------- 壁の室内面

/** 壁の室内面。dir は壁の外向き（footprint の Edge.dir）、face は室内面の座標（horizontal なら z、縦なら x）、inward は室内向きの符号 */
export interface Face {
  dir: Dir;
  horizontal: boolean;
  face: number;
  inward: 1 | -1;
  a0: number;
  a1: number;
  /** 壁の外面座標（開口の照合用） */
  coord: number;
  /** 壁が載っている足跡の矩形（島の中心線などの仮の面は null） */
  rect: Rect | null;
}

export function innerFaces(rects: Rect[]): Face[] {
  return wallSpans(rects).map((s) => {
    const d = s.edge.dir;
    const inward: 1 | -1 = d === 0 || d === 1 ? -1 : 1;
    return { dir: d, horizontal: d === 0 || d === 2, face: s.edge.coord + inward * WALL_T, inward, a0: s.a0, a1: s.a1, coord: s.edge.coord, rect: s.edge.rect };
  });
}

/** 内部の線（島の中心線など）を Face として扱う。horizontal なら z = face の線、inward 側に家具を出す */
export function lineFace(horizontal: boolean, face: number, inward: 1 | -1, a0: number, a1: number): Face {
  return { dir: horizontal ? (inward > 0 ? 2 : 0) : (inward > 0 ? 3 : 1), horizontal, face, inward, a0, a1, coord: face - inward * WALL_T, rect: null };
}

/** 面の前に立って壁を背にしたときに見る向き（室内向き） */
export const faceOut = (f: Face): Dir => ((f.dir + 2) % 4) as Dir;

/** 面の長さ */
export const faceLen = (f: Face): number => f.a1 - f.a0;

/** 開口が面 f の壁（同じ向き・同じ座標・区間の中）にあるか */
export function onFace(f: Face, s: WallOpening): boolean {
  if (s.dir !== f.dir || Math.abs(across(s.dir, s.pos[0], s.pos[2]) - f.coord) > 0.05) return false;
  const t = along(s.dir, s.pos[0], s.pos[2]);
  return t + s.width / 2 > f.a0 - 0.05 && t - s.width / 2 < f.a1 + 0.05;
}

export function openingsOn(f: Face, openings: readonly WallOpening[]): WallOpening[] {
  return openings.filter((s) => onFace(f, s));
}

/** 区間 [a0, a1] から cuts を引いた残り（短すぎる切れ端は捨てる） */
export function subtractIntervals(a0: number, a1: number, cuts: readonly (readonly [number, number])[], minLen = 0.05): [number, number][] {
  const sorted = cuts.filter(([p, q]) => q > p).map(([p, q]) => [p, q] as [number, number]).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [p, q] of sorted) {
    if (p > cur + 1e-6) out.push([cur, Math.min(p, a1)]);
    cur = Math.max(cur, q);
    if (cur >= a1) break;
  }
  if (a1 > cur + 1e-6) out.push([cur, a1]);
  return out.filter(([p, q]) => q - p > minLen);
}

/**
 * 面 f 上で開口（同じ壁の開口 ± pad）を除いた区間。両端は inset だけ縮める（既定 WALL_T: 面の区間は隣の壁の厚みまで
 * 含むので、家具を隅に寄せても直交する壁にめり込まないように）。壁の帯は inset 0 で隅まで貼る
 */
export function freeRuns(f: Face, openings: readonly WallOpening[], pad = 1.0, inset = WALL_T): [number, number][] {
  const cuts = openingsOn(f, openings).map((s) => {
    const t = along(s.dir, s.pos[0], s.pos[2]);
    return [t - s.width / 2 - pad, t + s.width / 2 + pad] as [number, number];
  });
  return subtractIntervals(f.a0 + inset, f.a1 - inset, cuts);
}

/** 面 f の室内面から d0..d1 離れ、辺に沿って at..at+len、高さ y0..y1 の箱 */
export function alongFace(f: Face, at: number, len: number, d0: number, d1: number, y0: number, y1: number, mat: MatId, solid = true): Box {
  const n0 = f.face + f.inward * d0;
  const n1 = f.face + f.inward * d1;
  return f.horizontal
    ? box([at, y0, Math.min(n0, n1)], [at + len, y1, Math.max(n0, n1)], mat, solid)
    : box([Math.min(n0, n1), y0, at], [Math.max(n0, n1), y1, at + len], mat, solid);
}

/** 面 f の辺に沿った位置 at・室内面からの距離 out の床の点 [x, z] */
export function facePoint(f: Face, at: number, out: number): [number, number] {
  const n = f.face + f.inward * out;
  return f.horizontal ? [at, n] : [n, at];
}

/** 壁沿い配置用の辺（v1 common.WallEdge）。Face もこの形を満たす */
export interface WallEdge { horizontal: boolean; face: number; inward: 1 | -1; a0: number; a1: number }

/** 壁の室内面から offset 離して、辺に沿った位置 at から len、奥行き depth の箱を作る（v1 common.alongWall） */
export function alongWall(e: WallEdge, at: number, len: number, depth: number, y0: number, y1: number, mat: MatId, kind?: string, solid = true, offset = 0): Box {
  const near = e.face + e.inward * offset;
  const far = e.face + e.inward * (offset + depth);
  const b = e.horizontal
    ? box([at, y0, Math.min(near, far)], [at + len, y1, Math.max(near, far)], mat, solid)
    : box([Math.min(near, far), y0, at], [Math.max(near, far), y1, at + len], mat, solid);
  if (kind) b.kind = kind;
  return b;
}

// ---------------------------------------------------------------- 扉前・禁止領域

/** 開口の室内向きの単位ベクトル [x, z] */
export function inwardOf(s: WallOpening): [number, number] {
  return s.dir === 0 ? [0, -1] : s.dir === 1 ? [-1, 0] : s.dir === 2 ? [0, 1] : [1, 0];
}

/** 開口の下端（区画の床から）。下端より上に開いた窓・高いスロットは sill を足す */
export function openingBase(s: WallOpening, floorY: number): number {
  return s.pos[1] - floorY + (s.sill ?? 0);
}

/** 床の高さから歩いて入れる開口か（reach.ts の floorDoor と同じ条件） */
export function isFloorOpening(s: WallOpening, floorY: number): boolean {
  return s.pos[1] - floorY < 0.5 && (s.sill ?? 0) <= 0.35;
}

/**
 * 開口の前の空けておく範囲（床からの高さ）。幅は開口 + 両側 pad（最小 1.6 m）、奥行きは壁の室内面から depth。
 * 高さは床（下の窓の下も含めて）から開口の上端 + 0.1 か 2.2 m の高い方まで（v1 doorZones と同じ考え方）
 */
export function doorZones(openings: readonly WallOpening[], floorY: number, depth = 1.2, pad = 0.3): AABB[] {
  return openings.map((s): AABB => {
    const half = Math.max(0.8, s.width / 2 + pad);
    const base = openingBase(s, floorY);
    const y0 = Math.min(0, base) - 0.1;
    const y1 = Math.max(2.2, base + s.height + 0.1);
    const reach = WALL_T + depth;
    const [x, z] = [s.pos[0], s.pos[2]];
    switch (s.dir) {
      case 0: return { min: [x - half, y0, z - reach], max: [x + half, y1, z] };
      case 2: return { min: [x - half, y0, z], max: [x + half, y1, z + reach] };
      case 1: return { min: [x - reach, y0, z - half], max: [x, y1, z + half] };
      default: return { min: [x, y0, z - half], max: [x + reach, y1, z + half] };
    }
  });
}

/** 箱が範囲のどれかに掛かるか（接するだけは掛からない） */
export function hitsZone(zones: readonly AABB[], b: Box | AABB, eps = 1e-4): boolean {
  return zones.some((z) => b.min[0] < z.max[0] - eps && b.max[0] > z.min[0] + eps && b.min[1] < z.max[1] - eps && b.max[1] > z.min[1] + eps && b.min[2] < z.max[2] - eps && b.max[2] > z.min[2] + eps);
}

/** 箱が足跡のどれかの矩形の内側（margin）に収まるか */
export function insideRects(rects: readonly Rect[], b: Box | AABB, margin = WALL_T): boolean {
  return rects.some((r) => b.min[0] >= r.x0 + margin - 1e-6 && b.max[0] <= r.x1 - margin + 1e-6 && b.min[2] >= r.z0 + margin - 1e-6 && b.max[2] <= r.z1 - margin + 1e-6);
}

/** 箱の水平の範囲が足跡（矩形の和）に収まるか。L 字のつなぎ目をまたぐ物（壁の帯は矩形ごとなので普通はまたがない）にも使える */
export function insideFootprint(rects: readonly Rect[], b: Box | AABB): boolean {
  if (insideRects(rects, b, 0)) return true;
  const inAny = (x: number, z: number): boolean => rects.some((r) => x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6);
  const xs = [b.min[0], (b.min[0] + b.max[0]) / 2, b.max[0]];
  const zs = [b.min[2], (b.min[2] + b.max[2]) / 2, b.max[2]];
  return xs.every((x) => zs.every((z) => inAny(x, z)));
}

/** 箱同士の重なり（margin だけ膨らませて判定。負の margin は「その分めり込んで初めて重なり」） */
export function boxesOverlap(a: Box | AABB, b: Box | AABB, margin = 0): boolean {
  return a.min[0] < b.max[0] + margin && a.max[0] > b.min[0] - margin
    && a.min[1] < b.max[1] + margin && a.max[1] > b.min[1] - margin
    && a.min[2] < b.max[2] + margin && a.max[2] > b.min[2] - margin;
}

/** 矩形の内側（壁の厚み + margin） */
export function innerRect(r: Rect, margin: number): Rect {
  return { x0: r.x0 + margin, z0: r.z0 + margin, x1: r.x1 - margin, z1: r.z1 - margin };
}

/** 矩形の長い方の軸が x か */
export const longX = (r: Rect): boolean => r.x1 - r.x0 >= r.z1 - r.z0;

/** 床の範囲（xz）の AABB（高さ y0..y1） */
export function rectBox(x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = 2.2): AABB {
  return { min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)] };
}
