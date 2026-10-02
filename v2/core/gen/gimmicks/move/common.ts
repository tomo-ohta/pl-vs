/**
 * 移動と身体の仕掛けの共通の道具: 入口の壁から奥への座標（u: 壁に沿う向き / v: 入口の壁からの奥行き）で部屋を組む。
 * 入口と出口が向かい合う部屋（通り抜ける長い部屋）を前提にする仕掛けが多い。
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box, type MatId, type WallOpening } from '../../../world/layout.ts';
import type { GimmickContext, GimmickSlot } from '../types.ts';
import { innerRect, inward, wallFrame, type WallFrame } from '../util.ts';

export interface Hall {
  F: WallFrame;
  /** 床の高さ・天井の高さ（床から） */
  y: number;
  h: number;
  /** 入口の壁から出口の壁までの奥行き・横の幅 */
  L: number;
  W: number;
  /** 入口・出口の横の位置（u） */
  entU: number;
  exitU: number | null;
  /** 奥へ進む向き（世界の座標の単位ベクトル） */
  fwd: Vec3;
  /** 横（u が増える向き） */
  side: Vec3;
  inner: Rect;
}

/** 入口から奥への座標。入口と出口が向かい合うこと（opposite: false なら出口はどこでもよい） */
export function hallOf(slot: GimmickSlot, opposite = true): Hall | null {
  const ent = slot.entrance;
  if (!ent) return null;
  if (opposite && (!slot.exit || slot.exit.dir !== (ent.dir + 2) % 4)) return null;
  const inner = innerRect(slot);
  const F = wallFrame(inner, ent.dir);
  const [ix, iz] = inward(ent);
  const a = F.point(F.u0, 0), b = F.point(F.u0 + 1, 0);
  const side: Vec3 = [b[0] - a[0], 0, b[1] - a[1]];
  return {
    F, y: slot.cell.floorY, h: slot.cell.height, L: F.depth, W: F.u1 - F.u0,
    entU: F.u(ent.pos[0], ent.pos[2]), exitU: slot.exit ? F.u(slot.exit.pos[0], slot.exit.pos[2]) : null,
    fwd: [ix, 0, iz], side, inner,
  };
}

/** 部屋の座標（u0..u1 × v0..v1、高さ y0..y1。y は床からの高さ）の箱 */
export function hallBox(H: Hall, u0: number, v0: number, u1: number, v1: number, y0: number, y1: number, mat: MatId, solid = true): Box {
  const r = H.F.rect(u0, v0, u1, v1);
  return box([r.x0, H.y + y0, r.z0], [r.x1, H.y + y1, r.z1], mat, solid);
}

export function hallAabb(H: Hall, u0: number, v0: number, u1: number, v1: number, y0: number, y1: number): AABB {
  const r = H.F.rect(u0, v0, u1, v1);
  return { min: [r.x0, H.y + y0, r.z0], max: [r.x1, H.y + y1, r.z1] };
}

/** 部屋の座標の点（高さは床から） */
export function hallPoint(H: Hall, u: number, v: number, y = 0): Vec3 {
  const [x, z] = H.F.point(u, v);
  return [x, H.y + y, z];
}

/** 部屋の座標の向き（du, dv）を世界の向きへ */
export function hallDir(H: Hall, du: number, dv: number): Vec3 {
  return [H.side[0] * du + H.fwd[0] * dv, 0, H.side[2] * du + H.fwd[2] * dv];
}

/** 横の壁の向き（hi: u1 側の壁。開口と同じく外向き。0 = +Z / 1 = +X / 2 = -Z / 3 = -X） */
export function sideDir(H: Hall, hi: boolean): Dir {
  const v = hi ? H.side : ([-H.side[0], 0, -H.side[2]] as Vec3);
  return Math.abs(v[0]) > 0.5 ? (v[0] > 0 ? 1 : 3) : v[2] > 0 ? 0 : 2;
}

/** 世界の座標の壁 dir の、壁に沿った座標（SecretDoorway.at）: u の値から */
export function wallAt(H: Hall, dir: Dir, u: number, v: number): number {
  const p = hallPoint(H, u, v);
  return dir === 0 || dir === 2 ? p[0] : p[2];
}

/** 開口の、部屋の座標の横の位置 */
export const openingU = (H: Hall, o: WallOpening): number => H.F.u(o.pos[0], o.pos[2]);

/** 天井の照明の箱を外す（部屋を暗くする・低い天井の下の照明） */
export function removeLightsIn(ctx: GimmickContext, pred: (x: number, z: number) => boolean): void {
  const s = ctx.slot;
  ctx.removeBoxes((b) => b.mat === s.cell.palette.light && !b.solid && pred((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2));
  s.cell.lights = s.cell.lights.filter((l) => !pred(l.pos[0], l.pos[2]));
}

/**
 * 穴の部屋（入口・出口の壁沿いの固い床 strips だけが岸）に使える区画: 入口と出口が向かい合い、ほかの開口も入口か出口の壁にある
 * （横の壁の開口の前の床は、穴を渡る道（橋・乗り物）がつながらない島になる）
 */
export function stripsFits(s: { entrance: WallOpening | null; exit: WallOpening | null; openings: WallOpening[] }): boolean {
  return !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4 && s.openings.every((o) => o.dir === s.entrance!.dir || o.dir === s.exit!.dir);
}
