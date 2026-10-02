/**
 * 物を運ぶ担当の仕掛けの共通の道具: 持てる物・受けを足す・床の空いた所を選ぶ・壁に付ける板・部屋を暗くする・
 * 別の区画（同じフロア）に手がかりを置く（GimmickContext.clueCells / addToCell。無ければ自分の部屋の壁）。
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Rng } from '../../../math/rng.ts';
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W, WALL_T, type Box, type CellLayout, type Json, type MatId, type WallOpening } from '../../../world/layout.ts';
import type { GimmickContext, GimmickSlot } from '../types.ts';
import { doorZone, innerRect } from '../util.ts';

export const snap = (v: number): number => Math.round(v * 20) / 20;
export const aabbJ = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

/** 部品の id（addEntity が付ける id。後から足す部品を先に配線するとき） */
export const idOf = (ctx: GimmickContext, name: string): string => `${ctx.id}.${name}`;

export interface ItemOpts { half: Vec3; kind: string; tag?: string; mat?: MatId; yaw?: number; body?: boolean; cell?: string; inputs?: { [k: string]: string }; [k: string]: Json | undefined | { [k: string]: string } }

/** 持てる物を足す（底の中心 pos）。戻り値は部品の id */
export function addItem(ctx: GimmickContext, name: string, pos: Vec3, o: ItemOpts): string {
  const { body, cell, inputs, ...rest } = o;
  const params: { [k: string]: Json } = { pos: [...pos], ...(rest as { [k: string]: Json }) };
  if (!params.tag) params.tag = o.kind;
  for (const k of Object.keys(params)) if (params[k] === undefined) delete params[k];
  return ctx.addEntity(name, { type: body ? 'carryBody' : 'carryItem', params, ...(cell ? { cell } : {}), ...(inputs ? { inputs } : {}) });
}

/** 壁 d の室内面の座標と、内側へ進む符号 */
export function wallFace(r: Rect, d: Dir): { face: number; sg: 1 | -1 } {
  const face = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
  return { face, sg: d === 0 || d === 1 ? -1 : 1 };
}

/** 矩形 r の壁 d の、壁に沿った at・高さ y0..y1 に、壁から depth だけ出る箱（板・棚・ボタン） */
export function wallBox(r: Rect, d: Dir, at: number, half: number, y0: number, y1: number, depth: number, mat: MatId, solid = false, off = 0): Box {
  const { face, sg } = wallFace(r, d);
  const w0 = Math.min(face + sg * off, face + sg * (off + depth)), w1 = Math.max(face + sg * off, face + sg * (off + depth));
  return d === 0 || d === 2 ? box([at - half, y0, w0], [at + half, y1, w1], mat, solid) : box([w0, y0, at - half], [w1, y1, at + half], mat, solid);
}

/** 壁 d の、壁に沿った at・壁から v m 内側の床の点 */
export function wallPoint(r: Rect, d: Dir, at: number, v: number, y: number): Vec3 {
  const { face, sg } = wallFace(r, d);
  return d === 0 || d === 2 ? [at, y, face + sg * v] : [face + sg * v, y, at];
}

/** 壁 d に開口が無い区間（a0..a1）のうち長さ need 以上の物（長い順）。pad は開口から空ける距離 */
export function freeSpans(r: Rect, openings: readonly WallOpening[], d: Dir, need: number, pad = 0.9): { at: number; a0: number; a1: number }[] {
  const [a0, a1] = d === 0 || d === 2 ? [r.x0, r.x1] : [r.z0, r.z1];
  const { face } = wallFace(r, d);
  const blocked = openings.filter((o) => o.dir === d && Math.abs((d % 2 === 0 ? o.pos[2] : o.pos[0]) - face) < WALL_T + 0.35).map((o) => {
    const c = d === 0 || d === 2 ? o.pos[0] : o.pos[2];
    return [c - o.width / 2 - pad, c + o.width / 2 + pad] as [number, number];
  }).sort((p, q) => p[0] - q[0]);
  let cur = a0 + 0.3;
  const runs: [number, number][] = [];
  for (const [p, q] of blocked) { if (p > cur) runs.push([cur, p]); cur = Math.max(cur, q); }
  if (a1 - 0.3 > cur) runs.push([cur, a1 - 0.3]);
  return runs.filter(([p, q]) => q - p >= need).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0])).map(([p, q]) => ({ at: (p + q) / 2, a0: p, a1: q }));
}

/** 開口が主の矩形の壁にあるか（L 字の部屋の、ほかの矩形の壁の開口は見ない） */
export function onMainWall(slot: GimmickSlot, o: WallOpening): boolean {
  const r = slot.rect;
  const wallC = o.dir === 0 ? r.z1 : o.dir === 2 ? r.z0 : o.dir === 1 ? r.x1 : r.x0;
  return Math.abs((o.dir % 2 === 0 ? o.pos[2] : o.pos[0]) - wallC) < 0.3;
}

/** 床の空いた所を選ぶ: 部屋の内側 margin・開口の前（奥行き doorD）・avoid（矩形）を避け、互いに gap 以上離れた点を n 個。足りなければ null */
export function floorSpots(ctx: GimmickContext, n: number, o: { margin?: number; doorD?: number; avoid?: Rect[]; gap?: number; area?: Rect; rng?: Rng; tries?: number } = {}): Vec3[] | null {
  const s = ctx.slot;
  const rng = o.rng ?? ctx.rng;
  const r = o.area ?? innerRect(s, o.margin ?? 0.45);
  const zones = s.openings.map((op) => doorZone(op, s.cell.floorY, o.doorD ?? 1.5, 0.45));
  const out: Vec3[] = [];
  const gap = o.gap ?? 0.9;
  for (let k = 0; k < (o.tries ?? 400) && out.length < n; k++) {
    const x = snap(rng.float(r.x0, r.x1)), z = snap(rng.float(r.z0, r.z1));
    if (zones.some((a) => x > a.min[0] - 0.2 && x < a.max[0] + 0.2 && z > a.min[2] - 0.2 && z < a.max[2] + 0.2)) continue;
    if ((o.avoid ?? []).some((a) => x > a.x0 - 0.3 && x < a.x1 + 0.3 && z > a.z0 - 0.3 && z < a.z1 + 0.3)) continue;
    if (out.some((p) => Math.hypot(p[0] - x, p[2] - z) < gap)) continue;
    out.push([x, s.cell.floorY, z]);
  }
  return out.length >= n ? out : null;
}

/** 部屋の照明を、部品の照明 id に結び付ける（初めは on）。戻り値は照明の部品の id */
export function roomLamp(ctx: GimmickContext, name: string, on: boolean, inputs?: { [k: string]: string }, rate = 3): string {
  const s = ctx.slot;
  const id = ctx.addEntity(name, { type: 'lamp', params: { on, rate }, ...(inputs ? { inputs } : {}) });
  for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06) b.kind = `lamp:${id}`;
  for (const l of s.cell.lights) l.lampId = id;
  return id;
}

/** 区画の主の矩形（足跡の最大の矩形） */
export function mainRectOf(cell: CellLayout): Rect {
  return cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
}

/** 手がかりを貼る壁: 区画・壁の向き・壁に沿った位置・矩形 */
export interface ClueWall { cell: string; rect: Rect; dir: Dir; at: number; y: number; own: boolean }

/**
 * 手がかりを貼る壁を選ぶ: 同じフロアの別の区画（近い順に hops 1〜maxHops。廊下・曲がり角・入口と出口の部屋を先に）の、開口の無い壁の区間。
 * 無ければ自分の部屋の壁（avoidDirs 以外）。need は壁に沿った長さ
 */
export function clueWall(ctx: GimmickContext, need: number, o: { maxHops?: number; avoidDirs?: Dir[]; ownOnly?: boolean; height?: number } = {}): ClueWall | null {
  const cands = o.ownOnly ? [] : (ctx.clueCells?.() ?? []).filter((c) => c.hops >= 1 && c.hops <= (o.maxHops ?? 4) && c.cell.height >= (o.height ?? 2.3));
  // 廊下・曲がり角・入口と出口の部屋（異変の掛からない区画）を先に
  const pref = (k: string, role: string): number => (k === 'corridor' || k === 'junction' || role === 'entry' || role === 'exit' ? 0 : 1);
  cands.sort((a, b) => pref(a.kind, a.cell.role) - pref(b.kind, b.cell.role) || a.hops - b.hops);
  for (const c of cands) {
    const r = mainRectOf(c.cell);
    for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
      // 区画の主の矩形の、外壁の面（ほかの矩形が続いている所は壁ではない）
      const inner = { x0: r.x0 + WALL_T, z0: r.z0 + WALL_T, x1: r.x1 - WALL_T, z1: r.z1 - WALL_T };
      const span = freeSpans(inner, c.openings, d, need + 0.4, 0.7)[0];
      if (!span) continue;
      const { face } = wallFace(r, d);
      const out = face + (d === 0 || d === 1 ? 0.2 : -0.2);
      const along = span.at;
      if (c.cell.footprint.some((x) => x !== r && (d % 2 === 0 ? out > x.z0 && out < x.z1 && along > x.x0 && along < x.x1 : out > x.x0 && out < x.x1 && along > x.z0 && along < x.z1))) continue;
      return { cell: c.cell.id, rect: inner, dir: d, at: span.at, y: c.cell.floorY, own: false };
    }
  }
  const s = ctx.slot;
  const r = innerRect(s);
  for (const d of ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((x) => !(o.avoidDirs ?? []).includes(x)))) {
    const span = freeSpans(r, s.openings, d, need + 0.2, 0.6)[0];
    if (span) return { cell: s.cell.id, rect: r, dir: d, at: span.at, y: s.cell.floorY, own: true };
  }
  return null;
}

/** 手がかりの壁に箱を足す（別の区画なら addToCell。家具を置かない範囲も足す） */
export function addClueBox(ctx: GimmickContext, w: ClueWall, b: Box): void {
  if (w.own || !ctx.addToCell) ctx.addBox(b);
  else ctx.addToCell(w.cell, b);
}

/** 手がかりの壁の前（奥行き 1.0 m）に家具を置かない */
export function keepClueFront(ctx: GimmickContext, w: ClueWall, half: number): void {
  const p0 = wallPoint(w.rect, w.dir, w.at, 0, w.y), p1 = wallPoint(w.rect, w.dir, w.at, 1.0, w.y);
  const a: AABB = w.dir % 2 === 0
    ? { min: [w.at - half - 0.2, w.y - 0.1, Math.min(p0[2], p1[2])], max: [w.at + half + 0.2, w.y + 2.6, Math.max(p0[2], p1[2])] }
    : { min: [Math.min(p0[0], p1[0]), w.y - 0.1, w.at - half - 0.2], max: [Math.max(p0[0], p1[0]), w.y + 2.6, w.at + half + 0.2] };
  if (w.own || !ctx.keepOutIn) ctx.keepOut(a);
  else ctx.keepOutIn(w.cell, a);
}

/** 別の区画の床に物を置ける点（開口の前・壁際を避ける）。無ければ null */
export function clueFloorSpot(ctx: GimmickContext, o: { maxHops?: number; minHops?: number; rng?: Rng } = {}): { cell: string; pos: Vec3; own: boolean } | null {
  const rng = o.rng ?? ctx.rng;
  const cands = (ctx.clueCells?.() ?? []).filter((c) => c.hops >= (o.minHops ?? 1) && c.hops <= (o.maxHops ?? 5) && (c.kind === 'room' || c.kind === 'hall' || c.kind === 'corridor' || c.kind === 'junction'));
  for (const c of rng.shuffle(cands.slice())) {
    const r = mainRectOf(c.cell);
    const inner = { x0: r.x0 + WALL_T + 0.4, z0: r.z0 + WALL_T + 0.4, x1: r.x1 - WALL_T - 0.4, z1: r.z1 - WALL_T - 0.4 };
    if (inner.x1 - inner.x0 < 0.4 || inner.z1 - inner.z0 < 0.4) continue;
    const zones = c.openings.map((op) => doorZone(op, c.cell.floorY, 1.4, 0.4));
    for (let k = 0; k < 40; k++) {
      // 壁際（壁から 0.4〜0.8 m）に置く（通り道の真ん中を避ける）
      const side = rng.int(0, 3) as Dir;
      const t = rng.next();
      const x = side % 2 === 0 ? inner.x0 + (inner.x1 - inner.x0) * t : side === 1 ? inner.x1 : inner.x0;
      const z = side % 2 === 1 ? inner.z0 + (inner.z1 - inner.z0) * t : side === 0 ? inner.z1 : inner.z0;
      if (zones.some((a) => x > a.min[0] - 0.3 && x < a.max[0] + 0.3 && z > a.min[2] - 0.3 && z < a.max[2] + 0.3)) continue;
      return { cell: c.cell.id, pos: [snap(x), c.cell.floorY, snap(z)], own: false };
    }
  }
  return null;
}

/** 7 本の線の数字（手がかりの番号）: 壁 w の at 中心・高さ y0 に、幅 dw の数字を箱で描く（光る材質） */
export function digitBoxes(w: { rect: Rect; dir: Dir }, at: number, y0: number, digit: number, dw: number, mat: MatId): Box[] {
  const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f][((digit % 10) + 10) % 10]!;
  const t = dw * 0.18, hh = dw * 0.9;
  // 線: [壁に沿った中心のずれ, 高さの中心, 横長か]
  const segs: [number, number, boolean][] = [[0, hh * 2, true], [dw / 2, hh * 1.5, false], [dw / 2, hh * 0.5, false], [0, 0, true], [-dw / 2, hh * 0.5, false], [-dw / 2, hh * 1.5, false], [0, hh, true]];
  const out: Box[] = [];
  // 壁の手前から見て左右が逆にならないよう、壁の向きで壁に沿った向きを決める（室内から壁を見て右が +）
  const right = w.dir === 2 || w.dir === 1 ? 1 : -1;
  segs.forEach(([dx, dy, horiz], i) => {
    if (!(SEG & (1 << i))) return;
    const a = at + right * dx;
    out.push(horiz ? wallBox(w.rect, w.dir, a, dw / 2, y0 + dy - t / 2, y0 + dy + t / 2, 0.02, mat) : wallBox(w.rect, w.dir, a, t / 2, y0 + dy - hh / 2, y0 + dy + hh / 2, 0.02, mat));
  });
  return out;
}

/** 開口を避けて壁 d に、幅 need の区間が取れるか（開口の無い壁） */
export function wallFree(slot: GimmickSlot, d: Dir, need: number): { at: number; a0: number; a1: number } | null {
  return freeSpans(innerRect(slot), slot.openings, d, need)[0] ?? null;
}

export const DOOR = DOOR_W;
