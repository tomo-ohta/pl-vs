/** 足跡（footprint）= 互いに重ならず辺で接する矩形の集合。
 *  L 字の部屋、折れ曲がる廊下、アルコーブなどを矩形の集合として表し、
 *  外周にだけ壁を立てる（接している辺は通路として開く）。 */
import type { AABB } from '../core/aabb';
import type { Dir, Socket, Vec3 } from '../core/types';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type MatId, type Opening } from './layout';

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const EPS = 0.02;

export function rect(x0: number, z0: number, x1: number, z1: number): Rect {
  return { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) };
}

export function rectW(r: Rect): number {
  return r.x1 - r.x0;
}

export function rectD(r: Rect): number {
  return r.z1 - r.z0;
}

export function rectArea(r: Rect): number {
  return rectW(r) * rectD(r);
}

export function unionBounds(rects: Rect[]): Rect {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const r of rects) {
    b.x0 = Math.min(b.x0, r.x0);
    b.z0 = Math.min(b.z0, r.z0);
    b.x1 = Math.max(b.x1, r.x1);
    b.z1 = Math.max(b.z1, r.z1);
  }
  return b;
}

export function rectsOverlap(a: Rect, b: Rect, eps = EPS): boolean {
  return a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps;
}

export function inRect(r: Rect, x: number, z: number, margin = 0): boolean {
  return x >= r.x0 + margin && x <= r.x1 - margin && z >= r.z0 + margin && z <= r.z1 - margin;
}

export function inFootprint(rects: Rect[], x: number, z: number, margin = 0): boolean {
  return rects.some((r) => inRect(r, x, z, margin));
}

/** 矩形 r の方向 d の辺。coord = 辺の座標、a0..a1 = 辺に沿った区間 */
export interface Edge {
  rect: Rect;
  dir: Dir;
  coord: number;
  a0: number;
  a1: number;
}

export function edgesOf(r: Rect): Edge[] {
  return [
    { rect: r, dir: 0, coord: r.z1, a0: r.x0, a1: r.x1 },
    { rect: r, dir: 1, coord: r.x1, a0: r.z0, a1: r.z1 },
    { rect: r, dir: 2, coord: r.z0, a0: r.x0, a1: r.x1 },
    { rect: r, dir: 3, coord: r.x0, a0: r.z0, a1: r.z1 },
  ];
}

/** 辺に沿った座標（dir 0/2 なら x、1/3 なら z） */
export function along(dir: Dir, x: number, z: number): number {
  return dir === 0 || dir === 2 ? x : z;
}

/** 辺の法線方向の座標（dir 0/2 なら z、1/3 なら x） */
export function across(dir: Dir, x: number, z: number): number {
  return dir === 0 || dir === 2 ? z : x;
}

function subtract(a0: number, a1: number, cuts: [number, number][]): [number, number][] {
  const sorted = cuts.filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [p, q] of sorted) {
    if (p > cur + EPS) out.push([cur, Math.min(p, a1)]);
    cur = Math.max(cur, q);
    if (cur >= a1) break;
  }
  if (a1 > cur + EPS) out.push([cur, a1]);
  return out;
}

/** 辺のうち、他の矩形と接していない（= 外壁が必要な）区間 */
export function wallIntervals(edge: Edge, rects: Rect[]): [number, number][] {
  const covered: [number, number][] = [];
  for (const r2 of rects) {
    if (r2 === edge.rect) continue;
    let touching = false;
    let lo = 0;
    let hi = 0;
    switch (edge.dir) {
      case 0: touching = Math.abs(r2.z0 - edge.coord) < EPS; lo = r2.x0; hi = r2.x1; break;
      case 2: touching = Math.abs(r2.z1 - edge.coord) < EPS; lo = r2.x0; hi = r2.x1; break;
      case 1: touching = Math.abs(r2.x0 - edge.coord) < EPS; lo = r2.z0; hi = r2.z1; break;
      case 3: touching = Math.abs(r2.x1 - edge.coord) < EPS; lo = r2.z0; hi = r2.z1; break;
    }
    if (touching) covered.push([Math.max(edge.a0, lo), Math.min(edge.a1, hi)]);
  }
  return subtract(edge.a0, edge.a1, covered);
}

/** 全外壁区間（ソケット配置候補） */
export interface WallSpan {
  edge: Edge;
  a0: number;
  a1: number;
}

export function wallSpans(rects: Rect[]): WallSpan[] {
  const out: WallSpan[] = [];
  for (const r of rects) {
    for (const e of edgesOf(r)) {
      for (const [a0, a1] of wallIntervals(e, rects)) out.push({ edge: e, a0, a1 });
    }
  }
  return out;
}

/** 壁区間上の位置 t（辺に沿った座標）にソケットを作る。pos は外面の床位置。
 *  extra.sill: 開口の下端の高さ（E03 横長スロット） / extra.crawl: しゃがみ開口（R16 小型扉） */
export function socketOnSpan(id: string, type: Socket['type'], span: WallSpan, t: number, width = DOOR_W, height = DOOR_H, y = 0, extra?: { sill?: number; crawl?: boolean }): Socket {
  const d = span.edge.dir;
  const pos: Vec3 = d === 0 || d === 2 ? [t, y, span.edge.coord] : [span.edge.coord, y, t];
  const s: Socket = { id, type, pos, dir: d, width, height };
  if (extra?.sill) s.sill = extra.sill;
  if (extra?.crawl) s.crawl = true;
  return s;
}

/** 壁開口（sill 付き）。layout.ts の Opening に下端の高さを足した内部型 */
export interface ShellOpening extends Opening {
  /** 開口の下端（壁の基準 y から）。0 なら床面 */
  sill?: number;
}

/** ソケットが載っている壁区間を探す */
export function spanForSocket(spans: WallSpan[], s: Socket): WallSpan | undefined {
  return spans.find((sp) => sp.edge.dir === s.dir && Math.abs(sp.edge.coord - across(s.dir, s.pos[0], s.pos[2])) < 0.05 && along(s.dir, s.pos[0], s.pos[2]) >= sp.a0 - EPS && along(s.dir, s.pos[0], s.pos[2]) <= sp.a1 + EPS);
}

export interface ShellOptions {
  floor: MatId;
  wall: MatId;
  ceiling: MatId;
  /** 床穴（ローカル AABB） */
  floorHoles?: AABB[];
  /** 天井穴（hole 到達部屋の入口） */
  ceilingHoles?: AABB[];
  noCeiling?: boolean;
  /** 壁の基準 y */
  yBase?: number;
}

/** 足跡から床・天井・外壁を生成する。openings = 壁面ソケット（entry/exit/extra）。 */
export function buildShell(out: Box[], rects: Rect[], h: number, openings: Socket[], o: ShellOptions): void {
  const y = o.yBase ?? 0;
  // 床（穴を避ける）
  for (const r of rects) {
    const holes = (o.floorHoles ?? []).filter((hh) => inRect(r, (hh.min[0] + hh.max[0]) / 2, (hh.min[2] + hh.max[2]) / 2));
    slabWithHoles(out, r, y - 0.2, y, o.floor, holes);
  }
  // 天井
  if (!o.noCeiling) {
    for (const r of rects) {
      const holes = (o.ceilingHoles ?? []).filter((hh) => inRect(r, (hh.min[0] + hh.max[0]) / 2, (hh.min[2] + hh.max[2]) / 2));
      slabWithHoles(out, r, y + h, y + h + 0.2, o.ceiling, holes);
    }
  }
  // 外壁
  for (const r of rects) {
    for (const e of edgesOf(r)) {
      for (const [a0, a1] of wallIntervals(e, rects)) {
        // 開口の下端は s.pos[1]（上階出口）+ s.sill（高いスロット）。上端は sill + height
        const ops: ShellOpening[] = openings
          .filter((s) => s.type !== 'hole' && s.dir === e.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - e.coord) < 0.05)
          .map((s) => ({ at: along(s.dir, s.pos[0], s.pos[2]), width: s.width, height: s.height, sill: (s.pos[1] - y) + (s.sill ?? 0) }))
          .filter((op) => op.at + op.width / 2 > a0 + EPS && op.at - op.width / 2 < a1 - EPS);
        wallOnEdge(out, e, a0, a1, y, h, o.wall, ops);
      }
    }
  }
}

function slabWithHoles(out: Box[], r: Rect, y0: number, y1: number, mat: MatId, holes: AABB[]): void {
  if (holes.length === 0) {
    out.push(box([r.x0, y0, r.z0], [r.x1, y1, r.z1], mat));
    return;
  }
  // 1 穴前提の十字分割
  const hh = holes[0];
  const hx0 = Math.max(r.x0, hh.min[0]);
  const hx1 = Math.min(r.x1, hh.max[0]);
  const hz0 = Math.max(r.z0, hh.min[2]);
  const hz1 = Math.min(r.z1, hh.max[2]);
  if (hz0 > r.z0) out.push(box([r.x0, y0, r.z0], [r.x1, y1, hz0], mat));
  if (hz1 < r.z1) out.push(box([r.x0, y0, hz1], [r.x1, y1, r.z1], mat));
  if (hx0 > r.x0) out.push(box([r.x0, y0, hz0], [hx0, y1, hz1], mat));
  if (hx1 < r.x1) out.push(box([hx1, y0, hz0], [r.x1, y1, hz1], mat));
}

function wallOnEdge(out: Box[], e: Edge, a0: number, a1: number, y: number, h: number, mat: MatId, ops: ShellOpening[]): void {
  // 壁帯（矩形の内側 WALL_T）
  const lo = e.dir === 0 || e.dir === 1 ? e.coord - WALL_T : e.coord;
  const hi = lo + WALL_T;
  const put = (s0: number, s1: number, y0: number, y1: number) => {
    if (s1 - s0 < 0.005 || y1 - y0 < 0.005) return;
    if (e.dir === 0 || e.dir === 2) out.push(box([s0, y0, lo], [s1, y1, hi], mat));
    else out.push(box([lo, y0, s0], [hi, y1, s1], mat));
  };
  const cuts: [number, number][] = ops.map((op) => [Math.max(a0, op.at - op.width / 2), Math.min(a1, op.at + op.width / 2)]);
  for (const [s0, s1] of subtract(a0, a1, cuts)) put(s0, s1, y, y + h);
  for (const op of ops) {
    const s0 = Math.max(a0, op.at - op.width / 2);
    const s1 = Math.min(a1, op.at + op.width / 2);
    const sill = Math.max(0, op.sill ?? 0);
    // 開口の下（腰壁）: 下端が床より上のとき
    if (sill > 0) put(s0, s1, y, y + Math.min(sill, h));
    // 開口の上
    if (sill + op.height < h) put(s0, s1, y + sill + op.height, y + h);
  }
}

/** 足跡全体のローカル AABB（壁は矩形内なので矩形の外形がそのまま境界） */
export function footprintAABB(rects: Rect[], h: number, yBase = 0): AABB {
  const b = unionBounds(rects);
  return { min: [b.x0, yBase - 0.2, b.z0], max: [b.x1, yBase + h + 0.2, b.z1] };
}

/** 内側（壁厚 + margin を除いた）矩形 */
export function inner(r: Rect, margin = WALL_T): Rect {
  return { x0: r.x0 + margin, z0: r.z0 + margin, x1: r.x1 - margin, z1: r.z1 - margin };
}

/** 矩形の周囲・ソケット付近を避けて点が置けるか */
export function clearOfSockets(sockets: Socket[], x: number, z: number, radius: number): boolean {
  return !sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < radius);
}

/** 壁区間の中で、既存ソケットと重ならない位置を探す（無ければ null） */
export function pickSpanPosition(span: WallSpan, existing: Socket[], width: number, rngT: number, margin = 0.6): number | null {
  const len = span.a1 - span.a0;
  if (len < width + margin * 2) return null;
  let t = span.a0 + margin + width / 2 + rngT * (len - width - margin * 2);
  t = Math.round(t * 2) / 2;
  t = Math.min(span.a1 - margin - width / 2, Math.max(span.a0 + margin + width / 2, t));
  const clash = existing.some((s) => s.dir === span.edge.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - span.edge.coord) < 0.05 && Math.abs(along(s.dir, s.pos[0], s.pos[2]) - t) < (s.width + width) / 2 + 0.4);
  return clash ? null : t;
}
