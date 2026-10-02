/** 仕掛けを組むための補助（区画の内側・開口の前・入口から出口への向き） */
import type { AABB } from '../../math/aabb.ts';
import type { Dir, Vec3 } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { WALL_T, type Json, type WallOpening } from '../../world/layout.ts';
import type { GimmickSlot } from './types.ts';

export const aabbJson = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

/** 壁の内側の矩形（margin は壁からさらに空ける距離） */
export function innerRect(slot: GimmickSlot, margin = 0): Rect {
  const r = slot.rect;
  const m = WALL_T + margin;
  return { x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m };
}

/** 開口の内向きの単位ベクトル（開口の dir は外向き） */
export function inward(o: WallOpening): [number, number] {
  return ([[0, -1], [-1, 0], [0, 1], [1, 0]] as const)[o.dir] as [number, number];
}

/** 開口の前の範囲（区画の内側へ depth m、幅は開口 + 2·pad）。中身・仕掛けの物を置かない */
export function doorZone(o: WallOpening, floorY: number, depth = 1.3, pad = 0.35): AABB {
  const [ix, iz] = inward(o);
  const hw = o.width / 2 + pad;
  const p = o.pos;
  if (o.dir === 0 || o.dir === 2) {
    const z0 = p[2], z1 = p[2] + iz * depth;
    return { min: [p[0] - hw, floorY - 0.1, Math.min(z0, z1)], max: [p[0] + hw, floorY + 3, Math.max(z0, z1)] };
  }
  const x0 = p[0], x1 = p[0] + ix * depth;
  return { min: [Math.min(x0, x1), floorY - 0.1, p[2] - hw], max: [Math.max(x0, x1), floorY + 3, p[2] + hw] };
}

/** 開口の前の点（内側へ depth m） */
export function frontOf(o: WallOpening, depth = 1.0): Vec3 {
  const [ix, iz] = inward(o);
  return [o.pos[0] + ix * depth, o.pos[1], o.pos[2] + iz * depth];
}

/** 区画の主な向き: 入口から出口へ（無ければ長い辺の向き）。axis と、その軸で進む符号 */
export function mainAxis(slot: GimmickSlot): { axis: 'x' | 'z'; sign: 1 | -1 } {
  const a = slot.entrance, b = slot.exit;
  if (a && b) {
    const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2];
    if (Math.abs(dx) >= Math.abs(dz)) return { axis: 'x', sign: dx >= 0 ? 1 : -1 };
    return { axis: 'z', sign: dz >= 0 ? 1 : -1 };
  }
  const r = slot.rect;
  return r.x1 - r.x0 >= r.z1 - r.z0 ? { axis: 'x', sign: 1 } : { axis: 'z', sign: 1 };
}

/** 矩形が開口の前の範囲（どれか）と重なるか */
export function hitsDoorZones(slot: GimmickSlot, r: Rect, depth = 1.3): boolean {
  return slot.openings.some((o) => {
    const z = doorZone(o, slot.cell.floorY, depth);
    return r.x0 < z.max[0] && r.x1 > z.min[0] && r.z0 < z.max[2] && r.z1 > z.min[2];
  });
}

/** 壁 dir に開口が無い区間（a0..a1）を探す。無ければ null */
export function freeWallSpan(slot: GimmickSlot, dir: Dir, need: number, pad = 0.9): { at: number; a0: number; a1: number } | null {
  const r = innerRect(slot);
  const [a0, a1] = dir === 0 || dir === 2 ? [r.x0, r.x1] : [r.z0, r.z1];
  const blocked = slot.openings.filter((o) => o.dir === dir).map((o) => {
    const c = dir === 0 || dir === 2 ? o.pos[0] : o.pos[2];
    return [c - o.width / 2 - pad, c + o.width / 2 + pad] as [number, number];
  }).sort((p, q) => p[0] - q[0]);
  let cur = a0 + 0.3;
  const runs: [number, number][] = [];
  for (const [p, q] of blocked) { if (p > cur) runs.push([cur, p]); cur = Math.max(cur, q); }
  if (a1 - 0.3 > cur) runs.push([cur, a1 - 0.3]);
  const ok = runs.filter(([p, q]) => q - p >= need).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  const best = ok[0];
  return best ? { at: (best[0] + best[1]) / 2, a0: best[0], a1: best[1] } : null;
}

export const rectW = (r: Rect): number => r.x1 - r.x0;
export const rectD = (r: Rect): number => r.z1 - r.z0;

/**
 * 区画の床板に穴を開ける（buildShell が作った床板を、穴の周りの 4 枚に切り分ける）。
 * 穴の下は何も無いので、穴の側壁と底は呼び出し側が作る（pitBox）
 */
export function cutFloorSlab(slot: GimmickSlot, hole: Rect): void {
  const y = slot.cell.floorY;
  const boxes = slot.cell.boxes;
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]!;
    const isSlab = b.solid && Math.abs(b.max[1] - y) < 1e-3 && b.max[1] - b.min[1] <= 0.25 && b.min[0] < hole.x1 && b.max[0] > hole.x0 && b.min[2] < hole.z1 && b.max[2] > hole.z0;
    if (!isSlab) continue;
    boxes.splice(i, 1);
    const h0 = { x0: Math.max(b.min[0], hole.x0), x1: Math.min(b.max[0], hole.x1), z0: Math.max(b.min[2], hole.z0), z1: Math.min(b.max[2], hole.z1) };
    const put = (x0: number, z0: number, x1: number, z1: number): void => { if (x1 - x0 > 1e-3 && z1 - z0 > 1e-3) boxes.push({ ...b, min: [x0, b.min[1], z0], max: [x1, b.max[1], z1] }); };
    put(b.min[0], b.min[2], b.max[0], h0.z0);
    put(b.min[0], h0.z1, b.max[0], b.max[2]);
    put(b.min[0], h0.z0, h0.x0, h0.z1);
    put(h0.x1, h0.z0, b.max[0], h0.z1);
  }
}

/** 穴の底と側壁（穴の矩形の内側に厚さ 0.15）。depth は床からの深さ */
export function pitBoxes(slot: GimmickSlot, hole: Rect, depth: number, mat = slot.cell.palette.wall): import('../../world/layout.ts').Box[] {
  const y = slot.cell.floorY;
  const t = 0.15;
  const bottom = slot.cell.palette.floor;
  const out: import('../../world/layout.ts').Box[] = [];
  out.push({ min: [hole.x0, y - depth - 0.2, hole.z0], max: [hole.x1, y - depth, hole.z1], mat: bottom, solid: true });
  out.push({ min: [hole.x0, y - depth, hole.z0], max: [hole.x0 + t, y, hole.z1], mat, solid: true });
  out.push({ min: [hole.x1 - t, y - depth, hole.z0], max: [hole.x1, y, hole.z1], mat, solid: true });
  out.push({ min: [hole.x0 + t, y - depth, hole.z0], max: [hole.x1 - t, y, hole.z0 + t], mat, solid: true });
  out.push({ min: [hole.x0 + t, y - depth, hole.z1 - t], max: [hole.x1 - t, y, hole.z1], mat, solid: true });
  return out;
}

/** 矩形どうしの隙間（重なっていれば負）。軸ごとの隙間の大きい方 */
export function rectGap(a: Rect, b: Rect): number {
  return Math.max(a.x0 - b.x1, b.x0 - a.x1, a.z0 - b.z1, b.z0 - a.z1);
}

export const rectsTouch = (a: Rect, b: Rect, eps = 1e-3): boolean => rectGap(a, b) < eps;

/**
 * 壁 d を手前にした区画の内側の座標（u: 壁に沿う向き / v: 壁から内側への深さ。v = 0 が壁の室内面）。
 * 入口の壁からの奥行きで部屋を組む仕掛け（穴の部屋・梁の網）が、入口の向きに関係なく同じ式で書けるように
 */
export interface WallFrame {
  d: Dir;
  /** 壁に沿う範囲 */
  u0: number;
  u1: number;
  /** 壁から向かいの壁までの奥行き */
  depth: number;
  rect(u0: number, v0: number, u1: number, v1: number): Rect;
  point(u: number, v: number): [number, number];
  u(x: number, z: number): number;
  v(x: number, z: number): number;
}

export function wallFrame(r: Rect, d: Dir): WallFrame {
  const alongX = d === 0 || d === 2;
  const u0 = alongX ? r.x0 : r.z0, u1 = alongX ? r.x1 : r.z1;
  const depth = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  // 壁の座標と、内側へ進む符号
  const wall = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
  const sg = d === 0 || d === 1 ? -1 : 1;
  const w = (v: number): number => wall + sg * v;
  return {
    d, u0, u1, depth,
    rect(a0, b0, a1, b1) {
      const [p0, p1] = [Math.min(a0, a1), Math.max(a0, a1)];
      const [q0, q1] = [Math.min(w(b0), w(b1)), Math.max(w(b0), w(b1))];
      return alongX ? { x0: p0, x1: p1, z0: q0, z1: q1 } : { x0: q0, x1: q1, z0: p0, z1: p1 };
    },
    point: (a, b) => (alongX ? [a, w(b)] : [w(b), a]),
    u: (x, z) => (alongX ? x : z),
    v: (x, z) => (alongX ? (z - wall) * sg : (x - wall) * sg),
  };
}

/**
 * 1 次元の並び: 区間 a0..a1 を「足場」と「間（帯・梁）」の交互に分ける（両端は足場）。
 * required の区間（開口の前など）は必ず足場に含める。間が gapMin より狭くなる足場どうしはまとめる。
 * 間は gapTarget に近く、gapMin〜gapMax に収まるように足場を足す。足場の幅は pad（両端は edge）
 */
export interface Span { lo: number; hi: number }
export function padLines(a0: number, a1: number, required: Span[], o: { pad: number; edge?: [number, number]; gapMin: number; gapTarget: number; gapMax: number }): Span[] | null {
  if (a1 - a0 < o.pad) return null;
  const e0 = Math.min(a1 - a0, o.edge?.[0] ?? o.pad), e1 = Math.min(a1 - a0, o.edge?.[1] ?? o.pad);
  const req: Span[] = [{ lo: a0, hi: a0 + e0 }, { lo: a1 - e1, hi: a1 }];
  for (const s of required) {
    const w = Math.min(s.hi - s.lo, a1 - a0);
    const lo = Math.min(Math.max(s.lo, a0), a1 - w);
    req.push({ lo, hi: lo + w });
  }
  req.sort((p, q) => p.lo - q.lo);
  const merged: Span[] = [];
  for (const s of req) {
    const last = merged[merged.length - 1];
    if (last && s.lo - last.hi < o.gapMin) last.hi = Math.max(last.hi, s.hi);
    else merged.push({ ...s });
  }
  const out: Span[] = [merged[0]!];
  for (let i = 1; i < merged.length; i++) {
    const prev = out[out.length - 1]!, next = merged[i]!;
    const g = next.lo - prev.hi;
    // 足す足場の数 k: 間の長さ (g - k·pad) / (k + 1) が gapTarget に近く、gapMin 以上（gapMax 以下を優先）
    let best = -1, bestScore = Infinity;
    for (let k = 0; k < 40; k++) {
      const len = (g - k * o.pad) / (k + 1);
      if (len < o.gapMin) break;
      const score = Math.abs(len - o.gapTarget) + (len > o.gapMax ? 100 : 0);
      if (score < bestScore) { bestScore = score; best = k; }
    }
    if (best < 0) return null;
    const len = (g - best * o.pad) / (best + 1);
    for (let k = 0; k < best; k++) {
      const lo = prev.hi + len * (k + 1) + o.pad * k;
      out.push({ lo, hi: lo + o.pad });
    }
    out.push(next);
  }
  return out;
}

/** 矩形 area から holes を除いた残りを、矩形の列で返す（座標を区切って、残った升目を横につなぐ） */
export function fillRects(area: Rect, holes: readonly Rect[], eps = 1e-4): Rect[] {
  const cut = holes.filter((h) => rectGap(h, area) < -eps);
  const xs = [...new Set([area.x0, area.x1, ...cut.flatMap((h) => [h.x0, h.x1])].map((v) => Math.min(area.x1, Math.max(area.x0, v))))].sort((a, b) => a - b);
  const zs = [...new Set([area.z0, area.z1, ...cut.flatMap((h) => [h.z0, h.z1])].map((v) => Math.min(area.z1, Math.max(area.z0, v))))].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let k = 0; k + 1 < zs.length; k++) {
    const z0 = zs[k]!, z1 = zs[k + 1]!;
    if (z1 - z0 < eps) continue;
    let run: Rect | null = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i]!, x1 = xs[i + 1]!;
      if (x1 - x0 < eps) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const inHole = cut.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      if (inHole) { if (run) { out.push(run); run = null; } continue; }
      if (run) run.x1 = x1;
      else run = { x0, x1, z0, z1 };
    }
    if (run) out.push(run);
  }
  return out;
}

/**
 * 床（体の中心を置ける所）がつながっているか: area の中で、blocks（体の半径 r だけ太らせる）を避けて、
 * from から 4 近傍で塗る。届かない空きの升目があれば、その位置を返す（無ければ null）。格子 g m
 */
export function unreachableSpot(area: Rect, blocks: readonly Rect[], from: [number, number], r = 0.36, g = 0.1): [number, number] | null | 'start' {
  const nx = Math.max(1, Math.floor((area.x1 - area.x0) / g)), nz = Math.max(1, Math.floor((area.z1 - area.z0) / g));
  const free = new Uint8Array(nx * nz);
  const cx = (i: number): number => area.x0 + (i + 0.5) * g, cz = (k: number): number => area.z0 + (k + 0.5) * g;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = cx(i), z = cz(k);
    if (x - r < area.x0 - 1e-6 || x + r > area.x1 + 1e-6 || z - r < area.z0 - 1e-6 || z + r > area.z1 + 1e-6) continue;
    if (blocks.some((b) => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1)) continue;
    free[k * nx + i] = 1;
  }
  const si = Math.min(nx - 1, Math.max(0, Math.floor((from[0] - area.x0) / g))), sk = Math.min(nz - 1, Math.max(0, Math.floor((from[1] - area.z0) / g)));
  if (!free[sk * nx + si]) return 'start';
  const seen = new Uint8Array(nx * nz);
  const q = [sk * nx + si];
  seen[q[0]!] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!, i = c % nx, k = (c - i) / nx;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const a = i + di, b = k + dk;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const j = b * nx + a;
      if (!free[j] || seen[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  for (let j = 0; j < nx * nz; j++) if (free[j] && !seen[j]) return [cx(j % nx), cz(Math.floor(j / nx))];
  return null;
}
