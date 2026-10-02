/**
 * 部屋まるごとの異変（段階 4・oddity）の共通の道具: 部屋の範囲・描画の効果（oddRoom 部品）・壁や床に重ねる薄い板・
 * 開口から開口への通り道・出口の開口・床の穴（区画の床板を切る）・家具の天板・格子の点。
 * 高さはすべてフロア座標（床 = cell.floorY）。
 */
import type { AABB } from '../../../../math/aabb.ts';
import type { Dir } from '../../../../math/vec.ts';
import { along, type Rect } from '../../../../world/footprint.ts';
import { box, WALL_T, type Box, type Json, type MatId, type WallOpening } from '../../../../world/layout.ts';
import { alongFace, innerFaces, type Face } from '../../../dress/geom.ts';
import type { AnomalyContext } from '../../types.ts';
import { bbOf, inwardOf, isFloorFixture, mainRect } from '../../util.ts';

export type { Face } from '../../../dress/geom.ts';

/** 部屋の範囲（壁の内側の矩形の外形・床の少し下から天井まで） */
export function roomBox(ctx: AnomalyContext, pad = 0): AABB {
  const rs = ctx.rects;
  const fy = ctx.cell.floorY;
  return {
    min: [Math.min(...rs.map((r) => r.x0)) - pad, fy - 0.1, Math.min(...rs.map((r) => r.z0)) - pad],
    max: [Math.max(...rs.map((r) => r.x1)) + pad, fy + ctx.cell.height, Math.max(...rs.map((r) => r.z1)) + pad],
  };
}

export const aabbJ = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

/**
 * 描画の効果（client/views/oddity の fx）を部屋の部品 oddRoom に足す。部品はこの異変に 1 つ（無ければ作る）。戻り値は部品の id
 */
export function roomFx(ctx: AnomalyContext, ...fx: { [k: string]: Json }[]): string {
  const id = `${ctx.id}.room`;
  const e = ctx.world.entities.find((x) => x.id === id);
  if (e) { (e.params.fx as Json[]).push(...fx); return id; }
  return ctx.addEntity('room', { type: 'oddRoom', params: { aabb: aabbJ(roomBox(ctx)), fx } });
}

/** 壁の室内面（足跡の外周） */
export const facesOf = (ctx: AnomalyContext): Face[] => innerFaces(ctx.cell.footprint);

/** 面 f の上の開口の区間（± pad） */
export function openingCuts(ctx: AnomalyContext, f: Face, pad: number): [number, number][] {
  return ctx.geo.openings
    .filter((o) => o.dir === f.dir && Math.abs((o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0]) - f.coord) < 0.05)
    .map((o) => { const t = along(o.dir, o.pos[0], o.pos[2]); return [t - o.width / 2 - pad, t + o.width / 2 + pad] as [number, number]; });
}

/** 面 f の上で、開口（± pad）を除いた区間（両端は壁の厚み + inset だけ縮める） */
export function freeSpans(ctx: AnomalyContext, f: Face, pad = 0.3, inset = 0.02, minLen = 0.3): [number, number][] {
  const cuts = openingCuts(ctx, f, pad).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = f.a0 + WALL_T + inset;
  const end = f.a1 - WALL_T - inset;
  for (const [p, q] of cuts) { if (p > cur) out.push([cur, Math.min(p, end)]); cur = Math.max(cur, q); }
  if (end > cur) out.push([cur, end]);
  return out.filter(([p, q]) => q - p > minLen);
}

/** 面 f に開口が無いか */
export const blankFace = (ctx: AnomalyContext, f: Face): boolean => openingCuts(ctx, f, 0).length === 0;

/** 壁の室内面に重ねる薄い板（当たらない。d0..d1 は面から内側への距離。高さはフロア座標） */
export function wallSheet(f: Face, a0: number, a1: number, y0: number, y1: number, mat: MatId, d0 = 0.004, d1 = 0.012): Box {
  return alongFace(f, a0, a1 - a0, d0, d1, y0, y1, mat, false);
}

/** 床に重ねる薄い板（当たらない） */
export function floorSheet(r: Rect, y: number, mat: MatId, h = 0.006): Box {
  return box([r.x0, y, r.z0], [r.x1, y + h, r.z1], mat, false);
}

/** 天井に重ねる薄い板（当たらない） */
export function ceilingSheet(r: Rect, top: number, mat: MatId, h = 0.006): Box {
  return box([r.x0, top - h - 0.004, r.z0], [r.x1, top - 0.004, r.z1], mat, false);
}

/** 箱の組に、区画の中で一意の propGroup を付けて足す */
export function addGroup(ctx: AnomalyContext, boxes: readonly Box[], name: string): void {
  const g = `${ctx.cell.id}/a-${name}`;
  for (const b of boxes) { b.propGroup = g; ctx.addBox(b); }
}

/** 開口の前の点（区画の内側へ depth m） */
export function front(o: WallOpening, depth: number): [number, number] {
  const [ix, iz] = inwardOf(o);
  return [o.pos[0] + ix * depth, o.pos[2] + iz * depth];
}

/**
 * 先へ進む開口: 入ってくる開口以外で、出口の階段（exitStairs）にいちばん近い区画へつながる開口。無ければ入口からいちばん遠い開口。
 * 開口が 1 つしか無ければ null
 */
export function forwardOpening(ctx: AnomalyContext): WallOpening | null {
  const others = ctx.geo.openings.filter((o) => o !== ctx.entrance);
  if (!others.length) return null;
  const w = ctx.world;
  const dist = new Map<string, number>([['exitStairs', 0]]);
  const q = ['exitStairs'];
  for (let h = 0; h < q.length; h++) for (const p of w.portals) {
    if (!p.cells.includes(q[h]!)) continue;
    const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
    if (!dist.has(o)) { dist.set(o, dist.get(q[h]!)! + 1); q.push(o); }
  }
  const id = ctx.cell.id;
  const score = (o: WallOpening): number => {
    let best: { d: number; c: string } | null = null;
    for (const p of w.portals) {
      if (!p.cells.includes(id)) continue;
      const d = Math.hypot((p.aabb.min[0] + p.aabb.max[0]) / 2 - o.pos[0], (p.aabb.min[2] + p.aabb.max[2]) / 2 - o.pos[2]);
      if (d < 0.6 && (!best || d < best.d)) best = { d, c: p.cells[0] === id ? p.cells[1] : p.cells[0] };
    }
    return best ? dist.get(best.c) ?? 1e6 : 1e6;
  };
  const e = ctx.entrance.pos;
  return others.slice().sort((a, b) => score(a) - score(b) || Math.hypot(b.pos[0] - e[0], b.pos[2] - e[2]) - Math.hypot(a.pos[0] - e[0], a.pos[2] - e[2]))[0]!;
}

/**
 * 開口から開口への通り道（幅 width）: どの開口も、開口の前から部屋の中心（主の矩形の中心）へ L 字に結ぶ。
 * 草木・穴・物を置かない範囲に使う（高さは床から 3 m）
 */
export function lanes(ctx: AnomalyContext, width = 1.2, depth = 1.0): AABB[] {
  const r = mainRect(ctx.cell);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const fy = ctx.cell.floorY, hw = width / 2;
  const out: AABB[] = [];
  const seg = (x0: number, z0: number, x1: number, z1: number): void => {
    out.push({ min: [Math.min(x0, x1) - hw, fy - 0.1, Math.min(z0, z1) - hw], max: [Math.max(x0, x1) + hw, fy + 3, Math.max(z0, z1) + hw] });
  };
  for (const o of ctx.geo.openings) {
    const [fx, fz] = front(o, depth);
    const [ox, oz] = [o.pos[0], o.pos[2]];
    seg(ox, oz, fx, fz);
    // 開口の奥行きの向きに中心の座標まで進んでから、横へ
    if (o.dir === 0 || o.dir === 2) { seg(fx, fz, fx, cz); seg(fx, cz, cx, cz); }
    else { seg(fx, fz, cx, fz); seg(cx, fz, cx, cz); }
  }
  return out;
}

/** 点が範囲のどれかの中か（xz だけ・margin だけ太らせて） */
export function inZones(zones: readonly AABB[], x: number, z: number, margin = 0): boolean {
  return zones.some((a) => x > a.min[0] - margin && x < a.max[0] + margin && z > a.min[2] - margin && z < a.max[2] + margin);
}

/** 点 (x, z) の半径 r が、当たる物（床から y0..y1 の高さに掛かる物）に掛かるか */
export function blockedAt(solids: readonly Box[], x: number, z: number, r: number, y0 = -Infinity, y1 = Infinity): boolean {
  return solids.some((s) => s.max[1] > y0 && s.min[1] < y1 && s.min[0] < x + r && s.max[0] > x - r && s.min[2] < z + r && s.max[2] > z - r);
}

/** 矩形ごとの格子の点（間隔 step・壁から margin・揺らぎ jitter） */
export function gridPoints(ctx: AnomalyContext, step: number, margin: number, jitter = 0): [number, number][] {
  const out: [number, number][] = [];
  for (const r of ctx.rects) {
    const nx = Math.floor((r.x1 - r.x0 - 2 * margin) / step), nz = Math.floor((r.z1 - r.z0 - 2 * margin) / step);
    const ox = r.x0 + (r.x1 - r.x0 - nx * step) / 2, oz = r.z0 + (r.z1 - r.z0 - nz * step) / 2;
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
      out.push([ox + i * step + (jitter ? ctx.rng.float(-jitter, jitter) : 0), oz + k * step + (jitter ? ctx.rng.float(-jitter, jitter) : 0)]);
    }
  }
  return out;
}

/** 家具の天板（上が空いている水平の面）: 床から lo..hi の高さに上面があり、面積が minArea 以上。上に別の箱が重なる物は除く */
export function tops(boxes: readonly Box[], fy: number, lo = 0.3, hi = 2.2, minArea = 0.05): Box[] {
  return boxes.filter((b) => {
    const area = (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);
    if (area < minArea || b.max[1] < fy + lo || b.max[1] > fy + hi || isFloorFixture(b) || b.slope || b.kind === 'colliderOnly' || b.kind === 'emitOnly') return false;
    if (b.max[1] - b.min[1] > 0.5 && !b.solid) return false;
    // 上に被さる箱（天板の上の物・棚の段）
    return !boxes.some((o) => o !== b && o.min[1] >= b.max[1] - 0.01 && o.min[1] < b.max[1] + 0.25 && o.min[0] < b.max[0] - 0.02 && o.max[0] > b.min[0] + 0.02 && o.min[2] < b.max[2] - 0.02 && o.max[2] > b.min[2] + 0.02 && (o.max[0] - o.min[0]) * (o.max[2] - o.min[2]) > area * 0.5);
  });
}

/**
 * 床の穴（hole）を足しても、開口どうしが立って歩いてつながるか: 穴の上に一時的に背の高い当たる箱を置いて ctx.reachOk で確かめる
 * （到達判定は床板の穴を見ないので）
 */
export function holesKeepPaths(ctx: AnomalyContext, holes: readonly Rect[]): boolean {
  const fy = ctx.cell.floorY;
  const tmp = holes.map((h) => box([h.x0, fy, h.z0], [h.x1, fy + 2.6, h.z1], 'void', true));
  for (const b of tmp) ctx.addBox(b);
  const ok = ctx.reachOk();
  const set = new Set(tmp);
  ctx.removeBoxes((b) => set.has(b));
  return ok;
}

/** 区画の床板に穴を開ける（gimmicks/util.ts の cutFloorSlab と同じ。床板を穴の周りの 4 枚に切る） */
export function cutFloor(ctx: AnomalyContext, hole: Rect): void {
  const cell = ctx.cell, y = cell.floorY;
  const keep: Box[] = [];
  for (const b of cell.boxes.slice()) {
    const isSlab = b.solid && Math.abs(b.max[1] - y) < 1e-3 && b.max[1] - b.min[1] <= 0.25 && b.min[0] < hole.x1 && b.max[0] > hole.x0 && b.min[2] < hole.z1 && b.max[2] > hole.z0;
    if (!isSlab) continue;
    ctx.removeBoxes((x) => x === b);
    const h0 = { x0: Math.max(b.min[0], hole.x0), x1: Math.min(b.max[0], hole.x1), z0: Math.max(b.min[2], hole.z0), z1: Math.min(b.max[2], hole.z1) };
    const put = (x0: number, z0: number, x1: number, z1: number): void => { if (x1 - x0 > 1e-3 && z1 - z0 > 1e-3) keep.push({ ...b, min: [x0, b.min[1], z0], max: [x1, b.max[1], z1] }); };
    put(b.min[0], b.min[2], b.max[0], h0.z0);
    put(b.min[0], h0.z1, b.max[0], b.max[2]);
    put(b.min[0], h0.z0, h0.x0, h0.z1);
    put(h0.x1, h0.z0, b.max[0], h0.z1);
  }
  for (const b of keep) ctx.addBox(b);
}

/** 開口 o の dir の壁の内側の面（足跡の外周の面のうち、開口の載っている物） */
export function faceOfOpening(ctx: AnomalyContext, o: WallOpening): Face | null {
  return facesOf(ctx).find((f) => f.dir === o.dir && Math.abs(f.coord - (o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0])) < 0.05 && along(o.dir, o.pos[0], o.pos[2]) >= f.a0 - 0.05 && along(o.dir, o.pos[0], o.pos[2]) <= f.a1 + 0.05) ?? null;
}

/** 向きの外向きの単位ベクトル */
export const outward = (d: Dir): [number, number] => (d === 0 ? [0, 1] : d === 1 ? [1, 0] : d === 2 ? [0, -1] : [-1, 0]);

/** 箱の組の外形の中心 [x, z] */
export function centerXZ(boxes: readonly Box[]): [number, number] {
  const bb = bbOf(boxes);
  return [(bb.min[0] + bb.max[0]) / 2, (bb.min[2] + bb.max[2]) / 2];
}

/** 区画の部屋の面積（m²） */
export const areaOf = (ctx: AnomalyContext): number => ctx.rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);

/**
 * 入口の壁を手前にした主の矩形の座標: v = 奥行き（0 = 入口の壁の室内面 … depth = 向かいの壁の室内面）、
 * u = 入口の壁に沿う座標（u0..u1）。奥へ進むほど変わる異変（室内の海・古くなる・遠近法）が、入口の向きに関係なく同じ式で書けるように
 */
export interface DepthFrame {
  depth: number;
  u0: number;
  u1: number;
  /** 奥行き v0..v1・幅 u0..u1（省略は全幅）の矩形 */
  rect(v0: number, v1: number, u0?: number, u1?: number): Rect;
  v(x: number, z: number): number;
  u(x: number, z: number): number;
  point(u: number, v: number): [number, number];
}

export function depthFrame(r: Rect, d: Dir): DepthFrame {
  const inner = { x0: r.x0 + WALL_T, z0: r.z0 + WALL_T, x1: r.x1 - WALL_T, z1: r.z1 - WALL_T };
  const alongX = d === 0 || d === 2;
  const u0 = alongX ? inner.x0 : inner.z0, u1 = alongX ? inner.x1 : inner.z1;
  const depth = alongX ? inner.z1 - inner.z0 : inner.x1 - inner.x0;
  // 入口の壁の室内面の座標と、奥へ進む符号
  const wall = d === 0 ? inner.z1 : d === 2 ? inner.z0 : d === 1 ? inner.x1 : inner.x0;
  const sg = d === 0 || d === 1 ? -1 : 1;
  const w = (v: number): number => wall + sg * v;
  return {
    depth, u0, u1,
    rect(v0, v1, a0 = u0, a1 = u1) {
      const [p0, p1] = [Math.min(a0, a1), Math.max(a0, a1)];
      const [q0, q1] = [Math.min(w(v0), w(v1)), Math.max(w(v0), w(v1))];
      return alongX ? { x0: p0, x1: p1, z0: q0, z1: q1 } : { x0: q0, x1: q1, z0: p0, z1: p1 };
    },
    v: (x, z) => ((alongX ? z : x) - wall) * sg,
    u: (x, z) => (alongX ? x : z),
    point: (a, b) => (alongX ? [a, w(b)] : [w(b), a]),
  };
}

/** 入口の開口が主の矩形の壁にあるか（L 字の部屋の脇の矩形の入口なら false） */
export function entranceOnMain(ctx: AnomalyContext): boolean {
  const r = mainRect(ctx.cell), o = ctx.entrance;
  const a = along(o.dir, o.pos[0], o.pos[2]);
  const inSpan = o.dir === 0 || o.dir === 2 ? a > r.x0 && a < r.x1 : a > r.z0 && a < r.z1;
  const wall = o.dir === 0 ? r.z1 : o.dir === 2 ? r.z0 : o.dir === 1 ? r.x1 : r.x0;
  return inSpan && Math.abs(wall - (o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0])) < 0.05;
}

/** 箱を部品の params に入れる形（描画の fx が箱を自分で描く: 回る物・近づくと大きくなる物） */
export function boxesJ(boxes: readonly Box[]): Json {
  return boxes.map((b) => ({ min: [...b.min], max: [...b.max], mat: b.mat, solid: false }));
}

/** 作業座標（床 = 0）で作った箱（区画の中身の部品・装飾の扉）をフロア座標へ上げる */
export function lift(B: Box[], fy: number): Box[] {
  for (const b of B) { b.min = [b.min[0], b.min[1] + fy, b.min[2]]; b.max = [b.max[0], b.max[1] + fy, b.max[2]]; }
  return B;
}

/** 文字の札（描画の fx 'labels' の 1 つ）の作り方 */
export interface LabelOpts { fg?: number; bg?: number; glow?: boolean; size?: number; yaw?: number }

/** 壁の面 f の、辺に沿った位置 a・高さ y（フロア座標）に貼る札（室内を向く。壁から off m 前） */
export function faceLabel(f: Face, a: number, y: number, w: number, h: number, text: string, o: LabelOpts = {}, off = 0.03): { [k: string]: Json } {
  const n = f.face + f.inward * off;
  const pos = f.horizontal ? [a, y, n] : [n, y, a];
  return { text, pos, dir: f.dir, w, h, ...o };
}

/** 床・天板の上に上向きに置く札（y はフロア座標の面の高さ） */
export function floorLabel(x: number, y: number, z: number, w: number, h: number, text: string, o: LabelOpts = {}): { [k: string]: Json } {
  return { text, pos: [x, y + 0.004, z], dir: 'up', w, h, ...o };
}

/** 床の矢印の札の回り（描画の札は +x 向きの矢印。上向きに置いた板を、床の向き (dx, dz) へ回す角） */
export const arrowYaw = (dx: number, dz: number): number => Math.atan2(-dz, dx);

/** 壁の面 f に貼った札で、絵の右（+x）が向く床の向き [x, z]（描画 labels.ts の板の回りと同じ） */
export function faceRight(f: Face): [number, number] {
  return f.dir === 0 ? [-1, 0] : f.dir === 1 ? [0, 1] : f.dir === 2 ? [1, 0] : [0, -1];
}
