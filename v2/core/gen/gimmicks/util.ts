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
