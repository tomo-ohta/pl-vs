/**
 * 奇妙さ生成（oddity）の共通ヘルパ。各カテゴリのファイル（layout.ts / contents.ts / surfaces.ts / traces.ts）はここだけを使う。
 *
 * 約束:
 *  - 乱数は c.rng（p.rng.fork('odd')）だけ。footprint・ソケット（扉の位置と高さ）・入口→出口の動線（lanes）・扉前ゾーンは変えない。
 *  - 追加する箱は oddBox() / oddKinded() で作る（kind が 'dress:odd…' になり、後段の Modifier の removeFills / removeInterior に捨てられない）。
 *  - ソリッドを足すときは canPlace() で動線と既存ソリッドを避ける。プレイヤーは 0.35 m までの段差を登れる（PLAYER.step）。
 *  - 予算: 箱 +250 / 三角形 +30k / ライト +2 / サイン +8。反復物は instances。
 */
import type { Rng } from '../../core/rng';
import type { AABB } from '../../core/aabb';
import { type Dir, type Socket, type Vec3 } from '../../core/types';
import { box, WALL_T, type Box, type GenParams, type InstanceSpec, type MatId, type RoomLayout, type SignSpec } from '../layout';
import { inner, type Rect } from '../footprint';
import { alongFace, keepOutZones, freeRuns, hitsZone, innerFaces, insideRects, type Face } from '../furniture';
import { boxesOverlap } from '../common';
import { splitBoxXZ } from '../../modifiers/mods/EraPreset.shellSplit';

export { alongFace, freeRuns, innerFaces, insideRects, inner, box, WALL_T, boxesOverlap };
export type { Face, Rect, Box, MatId, RoomLayout, InstanceSpec, SignSpec, Socket, Vec3, Dir, AABB, Rng, GenParams };

export type Strength = 'weak' | 'strong';
export type OddCategory = 'layout' | 'contents' | 'surface' | 'light' | 'trace' | 'space' | 'disorder';

/** 1 つの仕掛け。applicable で部屋に合うかを判定し、apply で足す（strong = 主題、weak = 添え物） */
export interface Oddity {
  id: string;
  category: OddCategory;
  /** 選ばれやすさ（同カテゴリ内で正規化） */
  weight: number;
  /** 主題（strong）になれるか */
  theme: boolean;
  applicable(c: Ctx): boolean;
  /** 実際に何かを足せたら true（false なら別の候補へ） */
  apply(c: Ctx, strength: Strength): boolean;
}

export interface Lane { a: [number, number]; b: [number, number] }

export interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  rects: Rect[];
  h: number;
  sockets: Socket[];
  /** 扉前 1.8 m × 幅（+0.1）と床穴 */
  zones: AABB[];
  /** 入口 → 各出口の直線帯（半幅 0.6） */
  lanes: Lane[];
  /** シェルの末尾（内装の先頭）。cutFloor / cutCeiling で変わるので毎回 c.start を読む */
  get start(): number;
  lights0: number;
  boxes0: number;
  /** 入口から見た正面の領域（主題はここに置く）。入口が無ければ部屋全体 */
  focus: Rect;
  /** 入口ソケット（無ければ undefined） */
  entry: Socket | undefined;
  note(msg: string): void;
  notes: string[];
}

export const BOX_BUDGET = 250;
export const LIGHT_BUDGET = 2;
export const SIGN_BUDGET = 8;
const MAX_INST = 2000;
export const ODD_KIND = 'dress:odd';

export function ctxOf(L: RoomLayout, p: GenParams, rng: Rng): Ctx {
  const rects = L.footprint.length ? L.footprint : [{ x0: L.bounds.min[0], z0: L.bounds.min[2], x1: L.bounds.max[0], z1: L.bounds.max[2] }];
  const entry = L.sockets.find((s) => s.id === 'entry');
  const notes: string[] = [];
  return {
    L, p, rng, rects, h: L.height, sockets: L.sockets,
    zones: keepOutZones(L, null, 0.1), lanes: lanesOf(L.sockets),
    get start() { return L.shellCount ?? 0; },
    lights0: L.lights.length, boxes0: L.boxes.length,
    focus: focusRect(rects, entry), entry, notes,
    note: (m) => { notes.push(m); },
  };
}

function lanesOf(sockets: Socket[]): Lane[] {
  const entry = sockets.find((s) => s.id === 'entry') ?? sockets[0];
  if (!entry) return [];
  return sockets.filter((s) => s !== entry).map((s) => ({ a: [entry.pos[0], entry.pos[2]] as [number, number], b: [s.pos[0], s.pos[2]] as [number, number] }));
}

/** 入口の向き（室内側）に 12 m・左右 ±5 m の矩形を footprint の外接矩形で切る */
function focusRect(rects: Rect[], entry: Socket | undefined): Rect {
  const bx0 = Math.min(...rects.map((r) => r.x0)), bx1 = Math.max(...rects.map((r) => r.x1));
  const bz0 = Math.min(...rects.map((r) => r.z0)), bz1 = Math.max(...rects.map((r) => r.z1));
  if (!entry) return { x0: bx0, z0: bz0, x1: bx1, z1: bz1 };
  const inward = ((entry.dir + 2) % 4) as Dir; // 0:+Z 1:+X 2:-Z 3:-X
  const [ex, , ez] = entry.pos;
  let r: Rect;
  if (inward === 0) r = { x0: ex - 5, x1: ex + 5, z0: ez, z1: ez + 12 };
  else if (inward === 2) r = { x0: ex - 5, x1: ex + 5, z0: ez - 12, z1: ez };
  else if (inward === 1) r = { x0: ex, x1: ex + 12, z0: ez - 5, z1: ez + 5 };
  else r = { x0: ex - 12, x1: ex, z0: ez - 5, z1: ez + 5 };
  return { x0: Math.max(bx0, r.x0), x1: Math.min(bx1, r.x1), z0: Math.max(bz0, r.z0), z1: Math.min(bz1, r.z1) };
}

/** 入口から見た正面の向き（室内側）。入口が無ければ 0 */
export function entryInward(c: Ctx): Dir {
  return c.entry ? (((c.entry.dir + 2) % 4) as Dir) : 0;
}

export function dirVec(d: Dir): [number, number] {
  return d === 0 ? [0, 1] : d === 1 ? [1, 0] : d === 2 ? [0, -1] : [-1, 0];
}

/** 箱の中心が focus 内か */
export function inFocus(c: Ctx, b: Box | AABB): boolean {
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  return cx >= c.focus.x0 && cx <= c.focus.x1 && cz >= c.focus.z0 && cz <= c.focus.z1;
}

function pointSegDist(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  let t = len2 > 1e-9 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}
function segsIntersect(p0: [number, number], p1: [number, number], q0: [number, number], q1: [number, number]): boolean {
  const o = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = o(q0, q1, p0), d2 = o(q0, q1, p1), d3 = o(p0, p1, q0), d4 = o(p0, p1, q1);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function segRectDist(a: [number, number], b: [number, number], x0: number, z0: number, x1: number, z1: number): number {
  const inside = (q: [number, number]) => q[0] >= x0 && q[0] <= x1 && q[1] >= z0 && q[1] <= z1;
  if (inside(a) || inside(b)) return 0;
  const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let i = 0; i < 4; i++) if (segsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return 0;
  let d = Infinity;
  for (const q of corners) d = Math.min(d, pointSegDist(q[0], q[1], a, b));
  const clampPt = (q: [number, number]) => Math.hypot(q[0] - Math.max(x0, Math.min(x1, q[0])), q[1] - Math.max(z0, Math.min(z1, q[1])));
  return Math.min(d, clampPt(a), clampPt(b));
}

/** 動線帯（半幅 0.6 + margin）に掛かるか */
export function laneHit(c: Ctx, b: AABB, half = 0.6, margin = 0.1): boolean {
  return c.lanes.some((l) => segRectDist(l.a, l.b, b.min[0], b.min[2], b.max[0], b.max[2]) < half + margin);
}

/** 追加候補 b が置けるか: 足跡内（margin）・扉前ゾーン外・動線帯外・既存のソリッド内装と重ならない */
export function canPlace(c: Ctx, b: Box, o: { margin?: number; gap?: number; lanes?: boolean; ignore?: (q: Box) => boolean } = {}): boolean {
  if (!insideRects(c.rects, b, o.margin ?? WALL_T + 0.02)) return false;
  if (hitsZone(c.zones, b)) return false;
  if ((o.lanes ?? true) && laneHit(c, b)) return false;
  const gap = o.gap ?? 0.05;
  for (let i = c.start; i < c.L.boxes.length; i++) {
    const q = c.L.boxes[i];
    if (q.solid && !(o.ignore && o.ignore(q)) && boxesOverlap(q, b, gap)) return false;
  }
  return true;
}

/** 内装（シェル以降）の箱 */
export function interior(L: RoomLayout): Box[] {
  return L.boxes.slice(L.shellCount ?? 0);
}

/** シェル以降の箱から pred に合うものを取り除く */
export function removeInterior(L: RoomLayout, pred: (b: Box) => boolean): number {
  const from = L.shellCount ?? 0;
  const keep = L.boxes.slice(0, from);
  let n = 0;
  for (const b of L.boxes.slice(from)) {
    if (pred(b)) n++;
    else keep.push(b);
  }
  L.boxes = keep;
  return n;
}

/** 箱の予算内か（超えたら false。apply は false を返して終える） */
export function budgetOk(c: Ctx, extra = 0): boolean {
  return c.L.boxes.length - c.boxes0 + extra <= BOX_BUDGET;
}

/** 奇妙さの箱（kind 'dress:odd'）。後段の Modifier に捨てられない */
export function oddBox(min: Vec3, max: Vec3, mat: MatId, solid = true, kind = ODD_KIND): Box {
  return { ...box(min, max, mat, solid), kind };
}

/** 既存の箱の複製（位置をずらす。kind は保つ + odd 印） */
export function shifted(b: Box, dx: number, dy: number, dz: number): Box {
  return { ...b, min: [b.min[0] + dx, b.min[1] + dy, b.min[2] + dz], max: [b.max[0] + dx, b.max[1] + dy, b.max[2] + dz], kind: b.kind ?? ODD_KIND };
}

export function addLight(c: Ctx, pos: Vec3, color: number, intensity: number, distance: number): boolean {
  if (c.L.lights.length - c.lights0 >= LIGHT_BUDGET) return false;
  c.L.lights.push({ pos, color, intensity, distance });
  return true;
}

export function pushSign(c: Ctx, s: SignSpec): boolean {
  c.L.signs ??= [];
  if (c.L.signs.length >= 44) return false;
  c.L.signs.push(s);
  return true;
}

export function spec(mat: MatId, size: Vec3, solid = false): InstanceSpec {
  return { mat, size, transforms: [], solid };
}
export function put(s: InstanceSpec, pos: Vec3, yaw = 0, scale?: number): void {
  if (s.transforms.length >= MAX_INST) return;
  s.transforms.push(scale !== undefined && scale !== 1 ? { pos, yaw, scale } : { pos, yaw });
}
export function commit(L: RoomLayout, ...specs: InstanceSpec[]): void {
  for (const s of specs) if (s.transforms.length) (L.instances ??= []).push(s);
}

export function yawOfDir(d: Dir): number { return (d * Math.PI) / 2; }
/** 面 f 上の位置 at・面からの距離 d・高さ y の点 */
export function onFace(f: Face, at: number, d: number, y: number): Vec3 {
  return f.horizontal ? [at, y, f.face + f.inward * d] : [f.face + f.inward * d, y, at];
}
/** 面が向く方向（室内側） */
export function facing(f: Face): Dir { return ((f.dir + 2) % 4) as Dir; }
export function faceLen(f: Face): number { return f.a1 - f.a0; }

/** 家具グループ（propGroup ごとの箱）。kind は最初に見つかったもの */
export function propGroups(L: RoomLayout): Map<string, { kind: string | undefined; boxes: Box[]; min: Vec3; max: Vec3 }> {
  const out = new Map<string, { kind: string | undefined; boxes: Box[]; min: Vec3; max: Vec3 }>();
  for (const b of interior(L)) {
    if (!b.propGroup) continue;
    let g = out.get(b.propGroup);
    if (!g) { g = { kind: b.kind, boxes: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; out.set(b.propGroup, g); }
    if (!g.kind && b.kind) g.kind = b.kind;
    g.boxes.push(b);
    for (let k = 0; k < 3; k++) { g.min[k] = Math.min(g.min[k], b.min[k]); g.max[k] = Math.max(g.max[k], b.max[k]); }
  }
  return out;
}

/** シェルの床の箱か（上面が y ≈ 0） */
export function isFloorBox(b: Box): boolean { return b.solid && b.max[1] <= 0.005 && b.min[1] < -0.01; }
/** シェルの天井の箱か */
export function isCeilingBox(b: Box, h: number): boolean { return b.min[1] >= h - 0.005 && b.max[1] > h; }

/**
 * 床（または天井）のシェル箔から XZ 矩形を切り抜く。切った後の断面は開いたまま（呼び出し側で底や側壁を足す）。
 * shellCount を更新する。切れた面積が 0 なら false
 */
export function cutShell(L: RoomLayout, rect: Rect, which: 'floor' | 'ceiling'): boolean {
  const from = L.shellCount ?? 0;
  const shell = L.boxes.slice(0, from);
  const rest = L.boxes.slice(from);
  const h = L.height;
  let cut = false;
  const out: Box[] = [];
  for (const b of shell) {
    const hit = which === 'floor' ? isFloorBox(b) : isCeilingBox(b, h);
    if (!hit || b.max[0] <= rect.x0 || b.min[0] >= rect.x1 || b.max[2] <= rect.z0 || b.min[2] >= rect.z1) { out.push(b); continue; }
    const cutsX = [rect.x0, rect.x1].filter((v) => v > b.min[0] + 1e-4 && v < b.max[0] - 1e-4);
    const cutsZ = [rect.z0, rect.z1].filter((v) => v > b.min[2] + 1e-4 && v < b.max[2] - 1e-4);
    for (const piece of splitBoxXZ(b, cutsX, cutsZ)) {
      const cx = (piece.min[0] + piece.max[0]) / 2, cz = (piece.min[2] + piece.max[2]) / 2;
      const insideCut = cx > rect.x0 && cx < rect.x1 && cz > rect.z0 && cz < rect.z1;
      if (insideCut) cut = true; else out.push(piece);
    }
  }
  if (!cut) return false;
  L.boxes = [...out, ...rest];
  L.shellCount = out.length;
  return true;
}

/** 部屋の主な床材 / 壁材 */
export function floorMat(c: Ctx): MatId { return c.L.palette.floor; }
export function wallMat(c: Ctx): MatId { return c.L.palette.wall; }
export function ceilingMat(c: Ctx): MatId { return c.L.palette.ceiling; }

/** 部屋の最大の矩形 */
export function mainRect(c: Ctx): Rect {
  return c.rects.reduce((a, r) => ((r.x1 - r.x0) * (r.z1 - r.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? r : a), c.rects[0]);
}

/** 廊下らしい部屋か（主矩形の短辺 ≤ 3.2 m で長辺 ≥ 8 m） */
export function isCorridor(c: Ctx): boolean {
  const r = mainRect(c);
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  return Math.min(w, d) <= 3.2 && Math.max(w, d) >= 8;
}

/** ソケットのある壁面から距離 d 以内か（扉の周りを避けるため） */
export function nearSocket(c: Ctx, x: number, z: number, d: number): boolean {
  return c.sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < d);
}

export function pick<T>(rng: Rng, arr: readonly T[]): T { return arr[Math.min(arr.length - 1, Math.floor(rng.float(0, 1) * arr.length))]; }
