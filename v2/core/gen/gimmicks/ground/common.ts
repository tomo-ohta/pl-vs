/**
 * 床と足場・装置の仕掛け（ground）の共通の作り。
 * - 入口の壁を手前にした座標（wallFrame: u = 入口の壁に沿う向き / v = 入口の壁から奥への深さ）で部屋を組む
 * - 壁に付ける薄い箱（ボタン・手がかりの板）・部屋の照明を部品で入切する・床板の升目・溝（narrowPath と同じ作りの、入口側に戻る階段の付いた深い溝）
 * - 歩く人への解き方の手順（params.bot。tests/helpers/bot.ts の BotHint）
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type Json, type MatId, type WallOpening } from '../../../world/layout.ts';
import type { GimmickContext, GimmickSlot } from '../types.ts';
import { pitInner, pitShell } from '../pit.ts';
import { cutFloorSlab, innerRect, wallFrame, type WallFrame } from '../util.ts';

export const snap = (v: number): number => Math.round(v * 20) / 20;

/** 矩形 r の壁 d の座標（d = 0: z1 / 1: x1 / 2: z0 / 3: x0） */
export const wallCoord = (r: Rect, d: Dir): number => (d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0);

/** 開口の壁に沿った座標 */
export const openingAt = (o: WallOpening): number => (o.dir % 2 === 0 ? o.pos[0] : o.pos[2]);

/** 開口が主の矩形の壁の上にあるか（L 字の部屋の内側の壁の開口は false） */
export function onRectWall(s: GimmickSlot, o: WallOpening): boolean {
  return Math.abs((o.dir % 2 === 0 ? o.pos[2] : o.pos[0]) - wallCoord(s.rect, o.dir)) < 0.3;
}

/** 入口の壁を手前にした、壁の内側の座標 */
export function entranceFrame(s: GimmickSlot, margin = 0): WallFrame {
  return wallFrame(innerRect(s, margin), s.entrance!.dir);
}

/** 壁 d の、壁に沿った座標 at・高さ y0..y1 に、壁から内側へ depth の薄い箱 */
export function onWallBox(s: GimmickSlot, d: Dir, at: number, half: number, y0: number, y1: number, depth: number, mat: MatId, solid = false): Box {
  const r = innerRect(s);
  const wall = wallCoord(r, d);
  const sg = d === 0 || d === 1 ? -1 : 1;
  const w0 = Math.min(wall, wall + sg * depth), w1 = Math.max(wall, wall + sg * depth);
  return d === 0 || d === 2 ? box([at - half, y0, w0], [at + half, y1, w1], mat, solid) : box([w0, y0, at - half], [w1, y1, at + half], mat, solid);
}

/** 箱 b の中心 */
export const boxCenter = (b: { min: number[]; max: number[] }): Vec3 => [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];

/** 部屋の照明（天井の発光パネルと点光源）を lamp 部品 lampId で入切する。戻り値は結び付けた点光源の数 */
export function linkRoomLights(ctx: GimmickContext, lampId: string): number {
  const s = ctx.slot;
  for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06 && !b.kind) b.kind = `lamp:${lampId}`;
  let n = 0;
  for (const l of s.cell.lights) if (!l.lampId) { l.lampId = lampId; n++; }
  return n;
}

/** 床板の並び: area から holes を除いた所を、大きさ tile 前後の升目で敷く（holes の縁で切る） */
export function gridTiles(area: Rect, holes: readonly Rect[], tile: number): Rect[] {
  const lines = (a0: number, a1: number, edges: number[]): number[] => {
    const must = [...new Set([a0, a1, ...edges.filter((v) => v > a0 + 1e-6 && v < a1 - 1e-6)])].sort((p, q) => p - q);
    const out: number[] = [];
    for (let i = 0; i + 1 < must.length; i++) {
      const p = must[i]!, q = must[i + 1]!;
      out.push(p);
      const n = Math.max(1, Math.round((q - p) / tile));
      for (let k = 1; k < n; k++) out.push(p + ((q - p) * k) / n);
    }
    out.push(a1);
    return out.filter((v, i, arr) => i === 0 || v - arr[i - 1]! > 0.05);
  };
  const xs = lines(area.x0, area.x1, holes.flatMap((h) => [h.x0, h.x1]));
  const zs = lines(area.z0, area.z1, holes.flatMap((h) => [h.z0, h.z1]));
  const out: Rect[] = [];
  for (let k = 0; k + 1 < zs.length; k++) for (let i = 0; i + 1 < xs.length; i++) {
    const r: Rect = { x0: xs[i]!, x1: xs[i + 1]!, z0: zs[k]!, z1: zs[k + 1]! };
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    if (holes.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1)) continue;
    out.push(r);
  }
  return out;
}

/** 矩形 r が、点の列（体の通り道）から d より近いか */
export const rectNear = (r: Rect, x: number, z: number, d: number): boolean => x > r.x0 - d && x < r.x1 + d && z > r.z0 - d && z < r.z1 + d;

// ---------------------------------------------------------------- 溝（部屋を横切る深い溝。入口側へ戻る階段）

export interface Trench {
  /** 溝の矩形（壁から壁まで） */
  hole: Rect;
  /** 溝の内側（側壁を除く） */
  inner: Rect;
  depth: number;
  /** 入口の壁からの深さで、溝の手前の縁・奥の縁 */
  v0: number;
  v1: number;
  frame: WallFrame;
  /** 階段の範囲（溝の中。入口側の縁の、壁沿い） */
  stairs: Rect;
  /** 階段の下の端の前（溝の底） */
  foot: [number, number];
}

/**
 * 部屋を横切る深い溝（入口の壁から深さ v0..v1）。側壁は部屋の壁に接する辺では壁の厚みの中（壁沿いの縁を歩いて渡れない）。
 * 溝の中の階段は、入口側の縁の壁沿い（stairSide の端）に、溝の真ん中の方へ下りる（落ちたら入口側へ戻る）。
 * 横の壁の開口の前が溝にならないこと（置けなければ null）
 */
export function buildTrench(ctx: GimmickContext, o: { v0: number; v1: number; depth: number; stairSide?: -1 | 1; laneW?: number }): Trench | null {
  const s = ctx.slot;
  const ent = s.entrance;
  if (!ent) return null;
  const y = s.cell.floorY;
  const F = entranceFrame(s);
  if (o.v0 < 1.3 || o.v1 > F.depth - 1.3 || o.v1 - o.v0 < 1.0) return null;
  const hole = F.rect(F.u0, o.v0, F.u1, o.v1);
  // 横の壁（入口の壁と直角）の開口の前が溝に掛からない
  for (const op of s.openings) {
    if (op.dir % 2 === ent.dir % 2) continue;
    const v = F.v(op.pos[0], op.pos[2]);
    if (v + op.width / 2 + 0.8 > o.v0 && v - op.width / 2 - 0.8 < o.v1) return null;
  }
  // 入口・出口の壁の開口が溝の縁から近すぎない
  for (const op of s.openings) {
    if (op.dir % 2 !== ent.dir % 2) continue;
    const v = F.v(op.pos[0], op.pos[2]);
    if (Math.abs(v - o.v0) < 1.25 || Math.abs(v - o.v1) < 1.25) return null;
  }
  const t = ctx.tuning;
  const n = Math.max(1, Math.ceil(o.depth / t['gimmick.pit.stairRise']) - 1);
  const rise = o.depth / (n + 1);
  const laneW = o.laneW ?? 1.0;
  const tread = Math.min(t['gimmick.pit.stairTread'] * 1.3, (F.u1 - F.u0 - laneW - 0.9) / n);
  if (tread < 0.22) return null;
  cutFloorSlab(s, hole);
  pitShell(ctx, hole, o.depth);
  const inner = pitInner(ctx, hole);
  const iu = [F.u(inner.x0, inner.z0), F.u(inner.x1, inner.z1)].sort((a, b) => a - b) as [number, number];
  const iv = [F.v(inner.x0, inner.z0), F.v(inner.x1, inner.z1)].sort((a, b) => a - b) as [number, number];
  // 階段: 入口側の縁（v = iv[0]）の帯（幅 laneW）に、壁 stairSide の端から真ん中の方へ下りる
  const side = o.stairSide ?? (ctx.rng.chance(0.5) ? -1 : 1);
  const a0 = side < 0 ? iu[0] : iu[1];
  for (let j = 0; j < n; j++) {
    const p = a0 - side * j * tread, q = a0 - side * (j + 1) * tread;
    const r = F.rect(Math.min(p, q), iv[0], Math.max(p, q), iv[0] + laneW);
    ctx.addBox(box([r.x0, y - o.depth, r.z0], [r.x1, y - rise * (j + 1), r.z1], s.cell.palette.floor));
  }
  const end = a0 - side * n * tread;
  const stairs = F.rect(Math.min(a0, end), iv[0], Math.max(a0, end), iv[0] + laneW);
  const foot = F.point(end - side * 0.45, iv[0] + laneW / 2);
  // 底をぼんやり照らす灯り
  const c = F.point((iu[0] + iu[1]) / 2, (iv[0] + iv[1]) / 2);
  s.cell.lights.push({ pos: [c[0], y - o.depth + 1.6, c[1]], color: 0xbfd0e0, intensity: 0.35, distance: 6 });
  ctx.keepOut({ min: [hole.x0 - (F.d % 2 ? 1.2 : 0), y - o.depth, hole.z0 - (F.d % 2 ? 0 : 1.2)], max: [hole.x1 + (F.d % 2 ? 1.2 : 0), y + 3, hole.z1 + (F.d % 2 ? 0 : 1.2)] });
  return { hole, inner, depth: o.depth, v0: o.v0, v1: o.v1, frame: F, stairs, foot };
}

// ---------------------------------------------------------------- 歩く人への解き方の手順（tests/helpers/bot.ts の BotHint）

export interface BotStepSpec { at: Vec3; look?: Vec3; wait?: number; until?: string; crouch?: boolean }

/** params.bot の値（JSON） */
export function botHint(steps: BotStepSpec[], o: { enterAt?: [number, number]; only?: 'secret'; doneIf?: string; replanSec?: number } = {}): Json {
  const out: { [k: string]: Json } = {
    steps: steps.map((st) => {
      const x: { [k: string]: Json } = { at: [...st.at] };
      if (st.look) x.look = [...st.look];
      if (st.wait !== undefined) x.wait = st.wait;
      if (st.until) x.until = st.until;
      if (st.crouch) x.crouch = true;
      return x;
    }),
  };
  if (o.enterAt) out.enterAt = [...o.enterAt];
  if (o.only) out.only = o.only;
  if (o.doneIf) out.doneIf = o.doneIf;
  if (o.replanSec) out.replanSec = o.replanSec;
  return out;
}

/** 開口の外面の床の位置 [x, z]（BotHint.enterAt） */
export const enterAt = (o: WallOpening): [number, number] => [o.pos[0], o.pos[2]];

/** 壁の厚み（壁の内側の矩形の外へ） */
export const WALL = WALL_T;
