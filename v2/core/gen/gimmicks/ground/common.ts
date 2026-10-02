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
  /** 階段の上の端の、縁の柵を空ける範囲（u） */
  stairGap: [number, number];
  /** 階段の側（-1 = u0 の壁 / 1 = u1 の壁） */
  stairSide: -1 | 1;
}

/**
 * 部屋を横切る深い溝（入口の壁から深さ v0..v1）。側壁は部屋の壁に接する辺では壁の厚みの中（壁沿いの縁を歩いて渡れない）。
 * 溝の中の階段は、入口側の縁の壁沿い（stairSide の端）に、溝の真ん中の方へ下りる（落ちたら入口側へ戻る）。
 * 横の壁の開口の前が溝にならないこと（置けなければ null）
 */
export interface TrenchOptions { v0: number; v1: number; depth: number; stairSide?: -1 | 1; laneW?: number }
export interface TrenchPlan extends Trench { steps: { r: Rect; top: number }[] }

/** 溝の計画（何も足さない）。置けなければ null。仕掛けは、ほかの条件を全部確かめてから buildTrench で作る（途中で諦めて半端な部屋を残さない） */
export function planTrench(ctx: GimmickContext, o: TrenchOptions): TrenchPlan | null {
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
  const inner = pitInner(ctx, hole);
  const iu = [F.u(inner.x0, inner.z0), F.u(inner.x1, inner.z1)].sort((a, b) => a - b) as [number, number];
  const iv = [F.v(inner.x0, inner.z0), F.v(inner.x1, inner.z1)].sort((a, b) => a - b) as [number, number];
  // 階段: 入口側の縁（v = iv[0]）の帯（幅 laneW）に、壁 stairSide の端から真ん中の方へ下りる
  const side = o.stairSide ?? (ctx.rng.chance(0.5) ? -1 : 1);
  const a0 = side < 0 ? iu[0] : iu[1];
  const steps: { r: Rect; top: number }[] = [];
  for (let j = 0; j < n; j++) {
    const p = a0 - side * j * tread, q = a0 - side * (j + 1) * tread;
    steps.push({ r: F.rect(Math.min(p, q), iv[0], Math.max(p, q), iv[0] + laneW), top: y - rise * (j + 1) });
  }
  const end = a0 - side * n * tread;
  const stairs = F.rect(Math.min(a0, end), iv[0], Math.max(a0, end), iv[0] + laneW);
  const foot = F.point(end - side * 0.45, iv[0] + laneW / 2);
  const stairGap: [number, number] = side < 0 ? [iu[0] - 0.2, iu[0] + 1.0] : [iu[1] - 1.0, iu[1] + 0.2];
  return { hole, inner, depth: o.depth, v0: o.v0, v1: o.v1, frame: F, stairs, foot, stairGap, stairSide: side, steps };
}

/** 計画どおりに溝を作る（床板を切る・側壁・階段・底の灯り・家具を置かない範囲） */
export function buildTrench(ctx: GimmickContext, p: TrenchPlan): Trench {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const F = p.frame;
  cutFloorSlab(s, p.hole);
  pitShell(ctx, p.hole, p.depth);
  for (const st of p.steps) ctx.addBox(box([st.r.x0, y - p.depth, st.r.z0], [st.r.x1, st.top, st.r.z1], s.cell.palette.floor));
  // 底をぼんやり照らす灯り
  const c: [number, number] = [(p.inner.x0 + p.inner.x1) / 2, (p.inner.z0 + p.inner.z1) / 2];
  s.cell.lights.push({ pos: [c[0], y - p.depth + 1.6, c[1]], color: 0xbfd0e0, intensity: 0.35, distance: 6 });
  const h = p.hole;
  ctx.keepOut({ min: [h.x0 - (F.d % 2 ? 1.2 : 0), y - p.depth, h.z0 - (F.d % 2 ? 0 : 1.2)], max: [h.x1 + (F.d % 2 ? 1.2 : 0), y + 3, h.z1 + (F.d % 2 ? 0 : 1.2)] });
  return p;
}

/**
 * 溝の縁の柵（跳んで越えられない高さ 1.05 m）: 入口の壁からの深さ v の線に沿って、u0..u1 から gaps（[a0, a1] の列）を除いた所。
 * 走って跳べば 4 m 先まで届くので、溝の縁は柵で囲み、渡る所（橋の棚が立っている所・橋が架かる所・階段の出口）だけ空ける
 */
export function railLine(ctx: GimmickContext, F: WallFrame, v0: number, v1: number, u0: number, u1: number, gaps: [number, number][], mat: MatId = 'metal'): void {
  const y = ctx.slot.cell.floorY;
  const cuts = gaps.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]).sort((p, q) => p[0] - q[0]);
  let cur = u0;
  const put = (a: number, b: number): void => {
    if (b - a < 0.05) return;
    const r = F.rect(a, v0, b, v1);
    ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + 1.0, r.z1], mat));
    ctx.addBox(box([r.x0, y + 1.0, r.z0], [r.x1, y + 1.06, r.z1], 'handrailWood'));
  };
  for (const [a, b] of cuts) { if (a > cur) put(cur, a); cur = Math.max(cur, b); }
  if (u1 > cur) put(cur, u1);
}

/**
 * 溝の上の下がり天井（床から clearH m。走って跳んでも頭が当たって溝を越えられない。歩くのは 1.7 m の体が通る）。
 * 範囲の天井の照明は外し、点光源は下がり天井の下へ下ろす
 */
export function soffit(ctx: GimmickContext, r: Rect, clearH: number): void {
  const s = ctx.slot;
  const y = s.cell.floorY, top = y + s.cell.height;
  if (top - (y + clearH) < 0.05) return;
  ctx.removeBoxes((b) => !b.solid && b.min[1] > y + clearH && b.min[0] < r.x1 && b.max[0] > r.x0 && b.min[2] < r.z1 && b.max[2] > r.z0);
  for (const l of s.cell.lights) if (l.pos[0] > r.x0 - 0.3 && l.pos[0] < r.x1 + 0.3 && l.pos[2] > r.z0 - 0.3 && l.pos[2] < r.z1 + 0.3 && l.pos[1] > y + clearH - 0.2) l.pos = [l.pos[0], y + clearH - 0.25, l.pos[2]];
  ctx.addBox(box([r.x0, y + clearH, r.z0], [r.x1, top, r.z1], 'wallConcrete'));
}

// ---------------------------------------------------------------- 歩く人への解き方の手順（tests/helpers/bot.ts の BotHint）

/** through: 立つ所まで道を探さず、しゃがんでまっすぐ進む（腰の高さのバーの下をくぐる） */
export interface BotStepSpec { at: Vec3; look?: Vec3; wait?: number; until?: string; crouch?: boolean; through?: boolean }

/** params.bot の値（JSON） */
export function botHint(steps: BotStepSpec[], o: { enterAt?: [number, number]; only?: 'secret'; doneIf?: string; replanSec?: number } = {}): Json {
  const out: { [k: string]: Json } = {
    steps: steps.map((st) => {
      const x: { [k: string]: Json } = { at: [...st.at] };
      if (st.look) x.look = [...st.look];
      if (st.wait !== undefined) x.wait = st.wait;
      if (st.until) x.until = st.until;
      if (st.crouch) x.crouch = true;
      if (st.through) x.through = true;
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
