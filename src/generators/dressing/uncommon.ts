/**
 * Uncommon の部屋別ドレッシング（担当 U）。定義 ID で分岐し、参考画像の要点（docs/reference-rarities-analysis.md の UNCOMMON 表）を
 * 「その部屋らしさを決める 1〜3 の大物 + サイン + 光の色・配置」として足す。実装の記録・見え方・保留は docs/reference-uncommon.md。
 *
 * 約束（dressing/index.ts と同じ）:
 *  - 乱数は渡された rng（p.rng.fork('dress')）だけ。footprint・ソケット・扉前 1.8 m（furniture.doorZones）・入口→各出口の直線帯 1.2 m は変えない
 *    （ソリッドを置くときは placeUnit で全て判定する。箔だけのものは壁面・天井付近に限る）。
 *  - 予算: 部屋あたり 箔 +300 / 三角形 +40k / ライト +2 以内。反復物は L.instances。新しい MatId は増やさない。
 *  - Generator / Modifier が出す要素と重ねない。Modifier は dressing の後に走るので、
 *      - Modifier が乱数で決める位置（U01 の色相区画 / U07 の雨域）は同じ fork（p.rng.fork('mod:<Id>')。fork は状態を進めないので
 *        Modifier の乱数列は変わらない）で先読みして合わせる（modifierRng）。
 *      - Modifier がレイアウトから読む「目印」（U02 の palette.door、U04 の furnitureDark 自販機 + lightPanel 前面、U11 の shelfMetal 棚）は
 *        壊さない形で足す。U05 の FakeSignage はシェルを palette で組み直すので palette 側も書く。
 *  - 三角形の見積りは RoomBuilder の 1.25 m テッセレーション近似（dressStats。Node ハーネスの予算計測用）。
 */
import type { AABB } from '../../core/aabb';
import { dirVec, type Dir, type Socket } from '../../core/types';
import type { Rng } from '../../core/rng';
import { across, along, inner, rect, rectArea, wallSpans, type Rect } from '../footprint';
import { alongFace, doorZones, freeRuns, hitsZone, insideRects, signAt, tubePair, type Face } from '../furniture';
import { box, kinded, WALL_T, type Box, type GenParams, type InstanceSpec, type MatId, type RoomLayout, type SignSpec } from '../layout';

/** テスト用スイッチ: false にすると何もしない（Node ハーネスの before / after 比較。ブラウザでは開発用 `?nodress=1` で無効化 = 構築時間の基準） */
export const DRESS_UNCOMMON = { enabled: !(typeof location !== 'undefined' && /[?&]nodress=1/.test(location.search)) };

/** 直前の dressUncommon が足した量（Node ハーネスの予算計測用） */
export interface DressStats {
  id: string;
  boxes: number;
  solids: number;
  instanceSpecs: number;
  instanceTransforms: number;
  lights: number;
  signs: number;
  /** 三角形の見積り（箔 = 1.25 m テッセレーションの箱、instances = 12 × 個数） */
  tris: number;
  note: string[];
}
export const dressStats: DressStats = { id: '', boxes: 0, solids: 0, instanceSpecs: 0, instanceTransforms: 0, lights: 0, signs: 0, tris: 0, note: [] };

export function dressUncommon(L: RoomLayout, p: GenParams, rng: Rng): void {
  if (!DRESS_UNCOMMON.enabled) return;
  const fn = ROOMS[p.def.id];
  const before = snapshot(L);
  dressStats.id = p.def.id;
  dressStats.note = [];
  if (fn) fn(makeCtx(L, p, rng));
  const after = snapshot(L);
  dressStats.boxes = after.boxes - before.boxes;
  dressStats.solids = after.solids - before.solids;
  dressStats.instanceSpecs = after.specs - before.specs;
  dressStats.instanceTransforms = after.transforms - before.transforms;
  dressStats.lights = after.lights - before.lights;
  dressStats.signs = after.signs - before.signs;
  dressStats.tris = after.tris - before.tris;
}

// ---------------------------------------------------------------- 文脈と共通ヘルパ

interface Lane { a: [number, number]; b: [number, number] }
interface FaceR extends Face { rect: Rect; ri: number }
interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  rects: Rect[];
  faces: FaceR[];
  /** 扉前 1.8 m・床穴・着地点（furniture.doorZones） */
  zones: AABB[];
  /** 入口 → 各出口の直線帯（半幅 0.6） */
  lanes: Lane[];
  /** 部屋固有の追加禁止領域（U03 のベルト帯など） */
  extraZones: AABB[];
  start: number;
  h: number;
  note: (s: string) => void;
}

const LANE_HALF = 0.6;
const MAX_SIGNS = 44;
const PANEL_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm', 'lightOff', 'lightGreen', 'lightYellow', 'ledBlue']);

function makeCtx(L: RoomLayout, p: GenParams, rng: Rng): Ctx {
  const rects = L.footprint;
  return {
    L, p, rng, rects, faces: facesWithRect(rects), zones: doorZones(L.sockets, null), lanes: lanesOf(L), extraZones: [],
    start: L.shellCount ?? 0, h: L.height, note: (s) => dressStats.note.push(s),
  };
}

function snapshot(L: RoomLayout): { boxes: number; solids: number; specs: number; transforms: number; lights: number; signs: number; tris: number } {
  let solids = 0;
  let tris = 0;
  for (const b of L.boxes) {
    if (b.solid) solids++;
    tris += triEstimate(b);
  }
  let transforms = 0;
  for (const s of L.instances ?? []) {
    transforms += s.transforms.length;
    tris += s.transforms.length * 12;
  }
  return { boxes: L.boxes.length, solids, specs: L.instances?.length ?? 0, transforms, lights: L.lights.length, signs: L.signs?.length ?? 0, tris };
}

/** 箱 1 個の三角形（RoomBuilder.surfaceBox の 1.25 m 分割。carPaint / carGlass は RoundedBox、薄い器具は自動トレイ 5 箔ぶんを足す） */
function triEstimate(b: Box): number {
  if (b.mat === 'carPaint' || b.mat === 'carGlass') return 108;
  const s = [0, 1, 2].map((i) => Math.max(1, Math.min(40, Math.ceil((b.max[i] - b.min[i]) / 1.25))));
  let t = 4 * (s[0] * s[1] + s[1] * s[2] + s[0] * s[2]);
  if (/^light/.test(b.mat) && b.max[1] - b.min[1] < 0.12 && b.max[0] - b.min[0] > 0.15 && b.max[2] - b.min[2] > 0.12) t += 60;
  return t;
}

function facesWithRect(rects: Rect[]): FaceR[] {
  return wallSpans(rects).map((s) => {
    const d = s.edge.dir;
    const inward: 1 | -1 = d === 0 || d === 1 ? -1 : 1;
    return { dir: d, horizontal: d === 0 || d === 2, face: s.edge.coord + inward * WALL_T, inward, a0: s.a0, a1: s.a1, coord: s.edge.coord, rect: s.edge.rect, ri: rects.indexOf(s.edge.rect) };
  });
}

function lanesOf(L: RoomLayout): Lane[] {
  const entry = L.sockets.find((s) => s.id === 'entry') ?? L.sockets[0];
  if (!entry) return [];
  return L.sockets.filter((s) => s !== entry).map((s) => ({ a: [entry.pos[0], entry.pos[2]], b: [s.pos[0], s.pos[2]] }));
}

function pointSegDist(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
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

/** 線分と XZ 矩形の 2D 距離（交差・内包なら 0） */
function segRectDist(a: [number, number], b: [number, number], x0: number, z0: number, x1: number, z1: number): number {
  const inside = (p: [number, number]) => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1;
  if (inside(a) || inside(b)) return 0;
  const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let i = 0; i < 4; i++) if (segsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return 0;
  let d = Infinity;
  for (const c of corners) d = Math.min(d, pointSegDist(c[0], c[1], a, b));
  const clampPt = (p: [number, number]) => Math.hypot(p[0] - Math.max(x0, Math.min(x1, p[0])), p[1] - Math.max(z0, Math.min(z1, p[1])));
  return Math.min(d, clampPt(a), clampPt(b));
}

function laneHit(lanes: Lane[], b: AABB, margin = 0): boolean {
  // 天井付近（床上 2.2 m 以上）の箔は動線に掛からない
  if (b.min[1] >= 2.2) return false;
  return lanes.some((l) => segRectDist(l.a, l.b, b.min[0], b.min[2], b.max[0], b.max[2]) < LANE_HALF + margin);
}

function overlap(a: AABB, b: AABB, eps = 0.02): boolean {
  return a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps && a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps && a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
}

function solidHit(c: Ctx, b: AABB): boolean {
  const B = c.L.boxes;
  for (let i = c.start; i < B.length; i++) {
    const o = B[i];
    if (o.solid && overlap(o, b)) return true;
  }
  return false;
}

/**
 * 箱の集合を、ソリッドがどれも 扉前 / 動線 / 追加禁止領域 / 足跡外 / 既存ソリッド に掛からなければ追加する。
 * 非ソリッドの箔は判定しない（壁面・天井付近の飾り）。戻り値は置けたか
 */
function placeUnit(c: Ctx, boxes: Box[], o: { margin?: number; laneMargin?: number; lanes?: boolean } = {}): boolean {
  if (!canPlaceUnit(c, boxes, o)) return false;
  c.L.boxes.push(...boxes);
  return true;
}

/** placeUnit の判定だけ（置かない） */
function canPlaceUnit(c: Ctx, boxes: Box[], o: { margin?: number; laneMargin?: number; lanes?: boolean } = {}): boolean {
  for (const b of boxes) {
    if (!b.solid) continue;
    if (hitsZone(c.zones, b) || hitsZone(c.extraZones, b)) return false;
    if (c.rects.length && !insideRects(c.rects, b, o.margin ?? 0.14)) return false;
    if (o.lanes !== false && laneHit(c.lanes, b, o.laneMargin ?? 0)) return false;
    if (solidHit(c, b)) return false;
  }
  return true;
}

/**
 * 中心 (cx, cz) に近い順に格子（step）を走査し、寸法 2hx × 2hz × height のソリッドが 扉前 / 動線 / 既存ソリッド / 足跡外 に掛からずに
 * 置ける中心を返す（大物の置き場探し。柱・机の隙間を拾う）
 */
function findSpot(c: Ctx, hx: number, hz: number, cx: number, cz: number, o: { step?: number; margin?: number; height?: number; radius?: number; laneMargin?: number } = {}): [number, number] | null {
  const r = c.rects[0];
  if (!r) return null;
  const step = o.step ?? 0.5;
  const margin = (o.margin ?? 0.5) + WALL_T;
  const x0 = r.x0 + margin + hx, x1 = r.x1 - margin - hx, z0 = r.z0 + margin + hz, z1 = r.z1 - margin - hz;
  if (x1 < x0 || z1 < z0) return null;
  const radius = o.radius ?? Infinity;
  const cands: [number, number, number][] = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    for (let z = z0; z <= z1 + 1e-6; z += step) {
      const d = Math.hypot(x - cx, z - cz);
      if (d <= radius) cands.push([d, x, z]);
    }
  }
  cands.sort((p, q) => p[0] - q[0]);
  const h = o.height ?? 1.0;
  for (const [, x, z] of cands) {
    const b = box([x - hx, 0, z - hz], [x + hx, h, z + hz], 'metal');
    if (hitsZone(c.zones, b) || hitsZone(c.extraZones, b) || laneHit(c.lanes, b, o.laneMargin ?? 0) || solidHit(c, b)) continue;
    return [x, z];
  }
  return null;
}

/** シェル以降の箱から pred に合うものを取り除く */
function removeInterior(c: Ctx, pred: (b: Box) => boolean): number {
  const L = c.L;
  const keep = L.boxes.slice(0, c.start);
  let n = 0;
  for (const b of L.boxes.slice(c.start)) {
    if (pred(b)) n++;
    else keep.push(b);
  }
  L.boxes = keep;
  return n;
}

/** 天井付近の薄い器具箔（lightGrid / lightRow / Atrium の天窓帯） */
function isPanel(b: Box, h: number, near = 0.35): boolean {
  return !b.solid && PANEL_MATS.has(b.mat) && b.max[1] - b.min[1] < 0.12 && b.max[1] > h - near;
}

/** 点灯している天井器具を mat に差し替える。keep(箔, 点灯器具の連番) が true のものは残す */
function setPanels(c: Ctx, mat: MatId, keep?: (b: Box, k: number) => boolean): void {
  let k = 0;
  for (let i = c.start; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    if (!isPanel(b, c.h) || b.mat === 'lightOff') continue;
    if (keep && keep(b, k++)) continue;
    c.L.boxes[i] = { ...b, mat };
  }
}

function tintLights(L: RoomLayout, color: number, intensity = 1): void {
  for (const l of L.lights) {
    l.color = color;
    l.intensity *= intensity;
  }
}

/** シェル（先頭 shellCount 個）の床 / 壁 / 天井の材質と palette を差し替える（FakeSky と同じやり方。コライダはそのまま）。
 *  keepPalette: 足音・残響（Sfx.floorKindOf / Reverb は palette.floor を読む）が同じ系統のままでよいとき palette は変えない（carpetPattern → 足音は carpet のまま） */
function recolorShell(L: RoomLayout, which: 'floor' | 'wall' | 'ceiling', to: MatId, keepPalette = false): void {
  const n = L.shellCount ?? 0;
  const h = L.height;
  for (let i = 0; i < n; i++) {
    const b = L.boxes[i];
    if (!b.solid || b.mat !== L.palette[which]) continue;
    const isFloor = b.max[1] <= 0.01 && b.min[1] < -0.05;
    const isCeil = b.min[1] >= h - 0.01;
    const k = isFloor ? 'floor' : isCeil ? 'ceiling' : 'wall';
    if (k === which) L.boxes[i] = { ...b, mat: to };
  }
  if (!keepPalette) L.palette[which] = to;
}

function pushSign(L: RoomLayout, s: SignSpec): boolean {
  if ((L.signs?.length ?? 0) >= MAX_SIGNS) return false;
  (L.signs ??= []).push(s);
  return true;
}

function wallSignAt(c: Ctx, f: Face, at: number, y: number, width: number, text: string, o: Parameters<typeof signAt>[6] = {}): boolean {
  if ((c.L.signs?.length ?? 0) >= MAX_SIGNS) return false;
  signAt(c.L, f, at, y, width, text, o);
  return true;
}

/** 面上の点（辺に沿った at、室内面から out）を XZ に */
function facePoint(f: Face, at: number, out: number): [number, number] {
  const n = f.face + f.inward * out;
  return f.horizontal ? [at, n] : [n, at];
}

/** 面の点から dist 以内に既存のサインがあるか */
function signNear(L: RoomLayout, f: Face, at: number, dist: number): boolean {
  const [x, z] = facePoint(f, at, 0);
  return (L.signs ?? []).some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < dist);
}

/** 面 f の等間隔の枡（中央寄せ。CorridorGenerator.slots と同じ式）。開口 ± pad を避け、隅 margin を空ける */
function faceSlots(f: Face, sockets: Socket[], pitch: number, halfW: number, margin: number, pad = 1.6): { t: number; i: number }[] {
  const usable = f.a1 - f.a0 - 2 * (margin + halfW);
  if (usable < 0) return [];
  const n = Math.floor(usable / pitch) + 1;
  const start = f.a0 + margin + halfW + (usable - (n - 1) * pitch) / 2;
  const runs = freeRuns(f, sockets, pad);
  const out: { t: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * pitch;
    if (runs.some(([a, b]) => t - halfW >= a && t + halfW <= b)) out.push({ t, i });
  }
  return out;
}

/** a0..a1 に pitch で中央寄せした位置（両端 margin） */
function pitchAlong(a0: number, a1: number, pitch: number, margin: number): number[] {
  const usable = a1 - a0 - 2 * margin;
  if (usable < 0) return [];
  const n = Math.floor(usable / pitch) + 1;
  const start = a0 + margin + (usable - (n - 1) * pitch) / 2;
  return Array.from({ length: n }, (_, i) => start + i * pitch);
}

/** 廊下セグメントの進行方向（CorridorGenerator と同じ: 最初は +Z、以降は前のセグメントに接する辺から） */
function corridorHeadings(rects: Rect[]): Dir[] {
  const out: Dir[] = [0];
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i], q = rects[i - 1];
    const e = 0.03;
    out.push(Math.abs(r.z0 - q.z1) < e ? 0 : Math.abs(r.z1 - q.z0) < e ? 2 : Math.abs(r.x0 - q.x1) < e ? 1 : 3);
  }
  return out;
}

function sideOf(f: FaceR, headings: Dir[]): 'left' | 'right' | 'end' {
  const hd = headings[f.ri] ?? 0;
  return f.dir === (hd + 1) % 4 ? 'left' : f.dir === (hd + 3) % 4 ? 'right' : 'end';
}

/** 「ソケットの無い最長の壁」の方向（PropOrientation.socketFreeWallDir と同じ規則。U10 の机の向きを先読みする） */
function socketFreeWallDir(L: RoomLayout): Dir {
  const freeLen = [0, 0, 0, 0];
  const count = [0, 0, 0, 0];
  const wall = L.sockets.filter((s) => s.type !== 'hole');
  for (const s of wall) count[s.dir]++;
  for (const sp of wallSpans(L.footprint)) {
    const d = sp.edge.dir;
    const has = wall.some((s) => s.dir === d && Math.abs(across(d, s.pos[0], s.pos[2]) - sp.edge.coord) < 0.05 && along(d, s.pos[0], s.pos[2]) >= sp.a0 - 0.01 && along(d, s.pos[0], s.pos[2]) <= sp.a1 + 0.01);
    if (!has) freeLen[d] += sp.a1 - sp.a0;
  }
  let best: Dir = 0;
  let bestLen = -1;
  for (const d of [0, 1, 2, 3] as Dir[]) if (freeLen[d] > bestLen + 0.01) { best = d; bestLen = freeLen[d]; }
  if (bestLen > 0.5) return best;
  let bc = Infinity;
  for (const d of [0, 1, 2, 3] as Dir[]) if (count[d] < bc) { best = d; bc = count[d]; }
  return best;
}

/** Modifier が layout フックで受け取る乱数列と同じ fork（状態は進めない）。Modifier の乱数で決まる位置に合わせる先読み専用 */
function modifierRng(p: GenParams, id: string): Rng {
  return p.rng.fork(`mod:${id}`);
}

function modParam(p: GenParams, id: string, key: string): unknown {
  return p.def.modifiers.find((m) => m.id === id)?.params?.[key];
}

function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x0, b.x0), z0 = Math.max(a.z0, b.z0), x1 = Math.min(a.x1, b.x1), z1 = Math.min(a.z1, b.z1);
  if (x1 - x0 < 0.02 || z1 - z0 < 0.02) return null;
  return { x0, z0, x1, z1 };
}

function pushInstances(L: RoomLayout, rng: Rng, spec: InstanceSpec): void {
  if (spec.transforms.length === 0) return;
  rng.shuffle(spec.transforms); // Tier の等間隔間引きが空間的に均一になるように
  (L.instances ??= []).push(spec);
}

// ---------------------------------------------------------------- 共通の部品

/** 装飾扉（開かない）: 枡（0..0.05）+ 5 cm 浮かせた扉箔 + レバー（CorridorGenerator.decorDoor と同じ寸法）。yBase は階の床 */
function decorDoor(c: Ctx, f: Face, t: number, mat: MatId, yBase = 0, dw = 0.9, dh = 2.05, frame: MatId = 'trim'): void {
  const B = c.L.boxes;
  B.push(alongFace(f, t - dw / 2 - 0.065, dw + 0.13, 0, 0.05, yBase, yBase + dh + 0.065, frame, false));
  B.push(alongFace(f, t - dw / 2, dw, 0.05, 0.08, yBase + 0.01, yBase + dh, mat, false));
  B.push(alongFace(f, t + dw / 2 - 0.16, 0.11, 0.08, 0.13, yBase + 0.99, yBase + 1.02, 'metal', false));
}

/** 暖色の壁灯（箔。焼き込みの面光源になる） */
function sconce(c: Ctx, f: Face, t: number, y = 1.6): void {
  c.L.boxes.push(alongFace(f, t - 0.07, 0.14, 0.03, 0.11, y, y + 0.22, 'lightWarm', false));
}

/** 掲示板（枡 + 緑のコルク面） */
function noticeBoard(c: Ctx, f: Face, t: number, w = 1.8, y0 = 1.0, y1 = 2.2): void {
  c.L.boxes.push(alongFace(f, t - w / 2 - 0.04, w + 0.08, 0, 0.02, y0 - 0.04, y1 + 0.04, 'trim', false));
  c.L.boxes.push(alongFace(f, t - w / 2, w, 0.02, 0.032, y0, y1, 'noticeGreen', false));
}

/**
 * 壁の丸時計（3:17）。白い円盤は横方向の薄板 7 段で近似（縁は黒）。針は軸並行の箔なので「3」を指す右向きの 2 本で表す
 * （3:17 の時針 98° / 分針 102° はどちらも 3 の側）。上 2 段はソリッドにして、FakeSignage のデジタル時計スロットが重ならないようにする
 */
function wallClock(c: Ctx, f: Face, at: number, y: number, dia = 0.5): void {
  const B = c.L.boxes;
  const rows = 9;
  const rh = dia / rows;
  const R = dia / 2;
  for (let i = 0; i < rows; i++) {
    const yc = y - R + (i + 0.5) * rh;
    const hw = Math.sqrt(Math.max(0.0025, R * R - (yc - y) * (yc - y)));
    B.push(alongFace(f, at - hw - 0.022, 2 * hw + 0.044, 0.006, 0.012, yc - rh / 2 - 0.01, yc + rh / 2 + 0.01, 'metalDark', false));
    B.push(alongFace(f, at - hw, 2 * hw, 0.012, 0.018, yc - rh / 2, yc + rh / 2, 'signPlate', i >= rows - 2));
  }
  // 見る人の右手 = 辺に沿った符号（-Z を向くと右は +X、-X を向くと右は -Z）
  const rs = f.horizontal ? f.inward : -f.inward;
  const R2 = dia / 2;
  B.push(alongFace(f, Math.min(at, at + rs * R2 * 0.82), R2 * 0.82, 0.018, 0.026, y - 0.014, y + 0.006, 'metalDark', false));
  B.push(alongFace(f, Math.min(at, at + rs * R2 * 0.55), R2 * 0.55, 0.026, 0.032, y - 0.024, y + 0.006, 'metalDark', false));
  B.push(alongFace(f, at - 0.025, 0.05, 0.018, 0.034, y - 0.025, y + 0.025, 'metalDark', false));
}

/** 観葉植物（鉢 = ソリッド、葉は箔）。置けたら true */
function plantUnit(c: Ctx, x: number, z: number, size = 0.6, h = 1.4): boolean {
  const s = size / 2;
  return placeUnit(c, [
    kinded([x - s, 0, z - s], [x + s, 0.45, z + s], 'furnitureDark', 'plant', true),
    box([x - s + 0.06, 0.45, z - s + 0.06], [x + s - 0.06, h, z + s - 0.06], 'plant', false),
  ].map(b => ({ ...b, propGroup: `plant:${x}:${z}` }))); 
}

/**
 * 吊り看板: 板（thickness 0.04）+ 天井への吊り棒 2 本 + 面ごとのサイン。alongX は板が伸びる向き（面は ±Z）。
 * sides: 'both' | 見せたい面の dir
 */
function hangingBoard(c: Ctx, x: number, z: number, y: number, w: number, hgt: number, alongX: boolean, text: string, o: Partial<SignSpec> = {}, sides: 'both' | Dir = 'both', boardMat: MatId = 'signPlate'): void {
  const B = c.L.boxes;
  const hw = w / 2, t = 0.02;
  B.push(alongX ? box([x - hw, y - hgt / 2, z - t], [x + hw, y + hgt / 2, z + t], boardMat, false) : box([x - t, y - hgt / 2, z - hw], [x + t, y + hgt / 2, z + hw], boardMat, false));
  for (const o2 of [-hw * 0.7, hw * 0.7]) {
    B.push(alongX ? box([x + o2 - 0.01, y + hgt / 2, z - 0.01], [x + o2 + 0.01, c.h, z + 0.01], 'metalDark', false) : box([x - 0.01, y + hgt / 2, z + o2 - 0.01], [x + 0.01, c.h, z + o2 + 0.01], 'metalDark', false));
  }
  const faces: Dir[] = alongX ? [0, 2] : [1, 3];
  for (const d of faces) {
    if (sides !== 'both' && sides !== d) continue;
    const n = dirVec(d);
    pushSign(c.L, { text, pos: [x + n[0] * (t + 0.011), y, z + n[2] * (t + 0.011)], dir: d, width: Math.min(w - 0.1, hgt * 4), kind: 'plate', ...o });
  }
}

/** 床の養生テープの枡（yellowLine の細い箔 4 本） */
function tapeRect(c: Ctx, x0: number, z0: number, x1: number, z1: number, mat: MatId = 'yellowLine', w = 0.05): void {
  const B = c.L.boxes;
  B.push(box([x0, 0.002, z0], [x1, 0.01, z0 + w], mat, false));
  B.push(box([x0, 0.002, z1 - w], [x1, 0.01, z1], mat, false));
  B.push(box([x0, 0.002, z0 + w], [x0 + w, 0.01, z1 - w], mat, false));
  B.push(box([x1 - w, 0.002, z0 + w], [x1, 0.01, z1 - w], mat, false));
}

// ---------------------------------------------------------------- 部屋別

type RoomFn = (c: Ctx) => void;

const ROOMS: Record<string, RoomFn> = {
  U01: u01, U02: u02, U03: u03, U04: u04, U05: u05, U06: u06, U07: u07, U08: u08, U09: u09, U10: u10,
  U11: u11, U12: u12, U13: u13, U14: u14, U15: u15, U16: u16, U17: u17, U18: u18, U19: u19, U20: u20,
};

// ---- U01 蛍光灯位相廊下: 艶のあるリノリウム、区画ごとの色帯（LightingPhase の色相と同じ区画）、両側に扉

type Phase = 'green' | 'white' | 'yellow';

/** LightingPhase.planSegments と同じ区画・同じ抽選（同じ fork）。隣り合う区画は同じ色相を避ける */
function lightingPhaseSegments(L: RoomLayout, p: GenParams): { rect: Rect; phase: Phase }[] {
  const rng = modifierRng(p, 'LightingPhase');
  const PH: Phase[] = ['green', 'white', 'yellow'];
  const out: { rect: Rect; phase: Phase }[] = [];
  let prev: Phase | null = null;
  for (const r of L.footprint) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const alongZ = d >= w;
    const len = alongZ ? d : w;
    const n = Math.max(1, Math.round(len / 6));
    for (let i = 0; i < n; i++) {
      const a0 = (alongZ ? r.z0 : r.x0) + (len * i) / n;
      const a1 = (alongZ ? r.z0 : r.x0) + (len * (i + 1)) / n;
      const rr: Rect = alongZ ? { x0: r.x0, z0: a0, x1: r.x1, z1: a1 } : { x0: a0, z0: r.z0, x1: a1, z1: r.z1 };
      const cands: Phase[] = prev ? PH.filter((q) => q !== prev) : PH;
      const phase: Phase = rng.pick(cands);
      out.push({ rect: rr, phase });
      prev = phase;
    }
  }
  return out;
}

function u01(c: Ctx): void {
  const { L, p } = c;
  recolorShell(L, 'floor', 'floorLino');
  const segs = lightingPhaseSegments(L, p);
  const bandMat: Record<Phase, MatId> = { green: 'wallGreen', white: 'wallWhite', yellow: 'wainscotCream' };
  for (const f of c.faces) {
    for (const [a0, a1] of freeRuns(f, L.sockets, 0.08)) {
      for (const s of segs) {
        const r = s.rect;
        const onBoundary = f.horizontal ? Math.abs(f.coord - r.z0) < 0.01 || Math.abs(f.coord - r.z1) < 0.01 : Math.abs(f.coord - r.x0) < 0.01 || Math.abs(f.coord - r.x1) < 0.01;
        if (!onBoundary) continue;
        const lo = Math.max(a0, f.horizontal ? r.x0 : r.z0);
        const hi = Math.min(a1, f.horizontal ? r.x1 : r.z1);
        if (hi - lo < 0.05) continue;
        L.boxes.push(alongFace(f, lo, hi - lo, 0, 0.012, 0, 1.2, bandMat[s.phase], false));
      }
      L.boxes.push(alongFace(f, a0, a1 - a0, 0, 0.03, 1.2, 1.24, 'trim', false));
    }
  }
  // 右側にも扉（GenericCorridor は左側だけ 4 m ピッチ）
  const hd = corridorHeadings(c.rects);
  let doors = 0;
  for (const f of c.faces) {
    if (sideOf(f, hd) !== 'right' || f.a1 - f.a0 < 3) continue;
    for (const { t } of faceSlots(f, L.sockets, 4.0, 0.55, 1.2)) { decorDoor(c, f, t, L.palette.door); doors++; }
  }
  c.note(`U01: segments ${segs.length} (${segs.map((s) => s.phase[0]).join('')}), right doors ${doors}`);
}

// ---- U02 重複客室階: 模様カーペット、暗い木扉、大きな番号板だけ（DuplicateNumber）、両側の壁灯

function u02(c: Ctx): void {
  const { L } = c;
  recolorShell(L, 'floor', 'carpetPattern', true);
  // 暗い木扉: 装飾扉の箔と palette.door を woodPanel に（DuplicateNumber は palette.door の非ソリッド箔を偽扉として数える）
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid && b.mat === L.palette.door && b.max[1] - b.min[1] > 1.9) L.boxes[i] = { ...b, mat: 'woodPanel' };
  }
  L.palette.door = 'woodPanel';
  // Generator の小さな番号板（扉脇 1.55 m、幅 0.3）は外す。番号は DuplicateNumber の大きな板（1.9 m、幅 0.48）だけにする
  if (L.signs) L.signs = L.signs.filter((s) => !(s.kind === 'plate' && Math.abs(s.pos[1] - 1.55) < 0.01 && /^\d+$/.test(s.text)));
  hotelSconcesRight(c, 1.55);
}

/** ホテル廊下の右側の枡（Generator は左側の 1 枡おきに壁灯を置く）に壁灯を足し、左右交互にする */
function hotelSconcesRight(c: Ctx, y: number): void {
  const hd = corridorHeadings(c.rects);
  for (const f of c.faces) {
    if (sideOf(f, hd) !== 'right' || f.a1 - f.a0 < 3) continue;
    for (const { t, i } of faceSlots(f, c.L.sockets, 3.0, 0.55, 1.2)) if (i % 2 === 0) sconce(c, f, t + 0.945, y);
  }
}

// ---- U03 無人エスカレーター: 器具を消し、側壁に上るエスカレーター（青白の段差灯・手すり灯）だけを光らせる

/** ExternalForce（U03 conveyor 0.8、lanes 1、幅 1.0）が主矩形に置くベルト帯を先読みする（同じ式。乱数は使わない） */
function u03LaneRect(L: RoomLayout): Rect | null {
  const main = L.footprint[0];
  if (!main) return null;
  const entry = L.sockets.find((s) => s.id === 'entry');
  const exit = L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
  let v: [number, number] = [0, 1];
  if (entry && exit) {
    const dx = exit.pos[0] - entry.pos[0];
    const dz = exit.pos[2] - entry.pos[2];
    if (Math.abs(dx) > 0.5 || Math.abs(dz) > 0.5) v = Math.abs(dz) >= Math.abs(dx) ? [0, Math.sign(dz)] : [Math.sign(dx), 0];
  }
  const ir = inner(main, WALL_T + 0.3);
  const alongX = Math.abs(v[0]) > Math.abs(v[1]);
  const a0 = (alongX ? ir.x0 : ir.z0) + 0.8;
  const a1 = (alongX ? ir.x1 : ir.z1) - 0.8;
  if (a1 - a0 < 4) return null;
  const c0 = alongX ? ir.z0 : ir.x0;
  const c1 = alongX ? ir.z1 : ir.x1;
  if (c1 - c0 < 1.0) return null;
  let center = (c0 + c1) / 2;
  if (entry && entry.type !== 'hole') {
    const d = dirVec(entry.dir);
    const onEnd = alongX ? Math.abs(d[0]) > 0.5 : Math.abs(d[2]) > 0.5;
    if (onEnd) center = alongX ? entry.pos[2] : entry.pos[0];
  }
  center = Math.min(c1 - 0.5, Math.max(c0 + 0.5, center));
  return alongX ? { x0: a0, z0: center - 0.5, x1: a1, z1: center + 0.5 } : { x0: center - 0.5, z0: a0, x1: center + 0.5, z1: a1 };
}

function u03(c: Ctx): void {
  const { L } = c;
  // 周囲暗転: 天窓帯・吊りパネルを消灯、点光源は捨てる（ExternalForce がベルト沿いの青い光を足し、ここでエスカレーターの 2 灯を足す）
  setPanels(c, 'lightOff');
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid && b.mat === L.palette.light && b.max[1] - b.min[1] < 0.1) L.boxes[i] = { ...b, mat: 'lightOff' };
  }
  L.lights = [];
  L.palette.light = 'lightOff';
  L.palette.lightColor = 0x9fd0ff;
  L.palette.lightIntensity = 0.6;
  L.palette.ambient = 0x262a33;
  // ExternalForce のベルト帯（+ 隣の停止ベルト候補）は避ける
  const lane = u03LaneRect(L);
  if (lane) {
    c.extraZones.push({ min: [lane.x0 - 0.4, -0.2, lane.z0 - 0.4], max: [lane.x1 + 0.4, 2.5, lane.z1 + 0.4] });
    const alongX = lane.x1 - lane.x0 > lane.z1 - lane.z0;
    const ir = inner(c.rects[0], WALL_T + 0.3);
    const w = alongX ? lane.z1 - lane.z0 : lane.x1 - lane.x0;
    const cand: Rect[] = alongX
      ? [{ x0: lane.x0, z0: lane.z1 + 1.5, x1: lane.x1, z1: lane.z1 + 1.5 + w }, { x0: lane.x0, z0: lane.z0 - 1.5 - w, x1: lane.x1, z1: lane.z0 - 1.5 }]
      : [{ x0: lane.x1 + 1.5, z0: lane.z0, x1: lane.x1 + 1.5 + w, z1: lane.z1 }, { x0: lane.x0 - 1.5 - w, z0: lane.z0, x1: lane.x0 - 1.5, z1: lane.z1 }];
    const fits = (r: Rect) => r.x0 >= ir.x0 && r.x1 <= ir.x1 && r.z0 >= ir.z0 && r.z1 <= ir.z1 && !L.sockets.some((s) => s.pos[0] > r.x0 - 1 && s.pos[0] < r.x1 + 1 && s.pos[2] > r.z0 - 1 && s.pos[2] < r.z1 + 1);
    const dec = cand.find(fits);
    if (dec) c.extraZones.push({ min: [dec.x0 - 0.3, -0.2, dec.z0 - 0.3], max: [dec.x1 + 0.3, 2.5, dec.z1 + 0.3] });
  }
  if (!placeEscalator(c, lane)) c.note('U03: escalator omitted (no free side wall)');
}

/** 側壁に沿って上るエスカレーター。段は床から積んだソリッド、両側のステンレスの腰板、段の縁と手すり下の青い灯、上の踊り場 */
function placeEscalator(c: Ctx, lane: Rect | null): boolean {
  // 上る高さは 3.4 m を基本に、側壁が短い部屋では 2.6 / 2.0 m へ落とす
  for (const rise of [Math.min(3.4, c.h - 2.6), 2.6, 2.0]) if (placeEscalatorOf(c, lane, rise)) return true;
  return false;
}

function placeEscalatorOf(c: Ctx, lane: Rect | null, rise: number): boolean {
  const { L, rng } = c;
  const main = c.rects[0];
  if (!main) return false;
  const stepH = 0.2, stepD = 0.4;
  const n = Math.max(8, Math.round(rise / stepH));
  const runLen = n * stepD;
  const landing = 1.2, top = 2.2, standoff = 0.5, wOut = 1.3;
  const total = landing + runLen + top;
  const laneAxisX = lane ? lane.x1 - lane.x0 > lane.z1 - lane.z0 : main.x1 - main.x0 > main.z1 - main.z0;
  const laneC = lane ? (laneAxisX ? (lane.z0 + lane.z1) / 2 : (lane.x0 + lane.x1) / 2) : 0;
  const faces = c.faces.filter((f) => f.horizontal === laneAxisX && f.a1 - f.a0 >= total + 1).sort((a, b) => Math.abs(b.face - laneC) - Math.abs(a.face - laneC));
  const entry = L.sockets.find((s) => s.id === 'entry');
  for (const f of faces) {
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.5)) {
      if (a1 - a0 < total + 0.6) continue;
      const eAlong = entry ? (f.horizontal ? entry.pos[0] : entry.pos[2]) : a0;
      const up = eAlong <= (a0 + a1) / 2 ? 1 : -1; // 入口から遠ざかる方向へ上る
      const mid = (a0 + a1) / 2;
      const offsets = [0, 1, -1, 2, -2, 3, -3].map((k) => k * 1.0).filter((o) => mid + o - total / 2 >= a0 + 0.3 && mid + o + total / 2 <= a1 - 0.3);
      for (const o of offsets) {
        const base = up > 0 ? mid + o - total / 2 : mid + o + total / 2;
        const tmp: Box[] = [];
        const edge: InstanceSpec = { mat: 'ledBlue', size: [stepD - 0.03, 0.03, 0.07], transforms: [] };
        const rail: InstanceSpec = { mat: 'rubber', size: [2 * stepD + 0.05, 0.05, 0.1], transforms: [] };
        const railGlow: InstanceSpec = { mat: 'ledBlue', size: [2 * stepD, 0.05, 0.05], transforms: [] };
        // 腰板の足元に沿う青い帯（部屋側と壁側の外面。エスカレーターの輪郭が暗い吹抜で読める）
        const skirtGlow: InstanceSpec = { mat: 'ledBlue', size: [2 * stepD, 0.05, 0.03], transforms: [] };
        const yaw = f.horizontal ? 0 : Math.PI / 2;
        const span = (a: number, len: number) => (up > 0 ? a : a - len);
        const at = (a: number, d: number): [number, number] => facePoint(f, a, d);
        const d0 = standoff, d1 = standoff + wOut;
        // 下の踊り場（薄板 + 縁のコーム）
        tmp.push(alongFace(f, span(base, landing), landing, d0 + 0.15, d1 - 0.15, 0, 0.02, 'stainless', false));
        tmp.push(alongFace(f, span(base + up * (landing - 0.25), 0.25), 0.25, d0 + 0.15, d1 - 0.15, 0.02, 0.03, 'metalDark', false));
        for (const s of [d0, d1 - 0.12]) tmp.push(alongFace(f, span(base, landing), landing, s, s + 0.12, 0, 1.0, 'stainless', true));
        // 段（床から積む）と段の縁の灯
        for (let k = 0; k < n; k++) {
          const a = base + up * (landing + k * stepD);
          const yTop = (k + 1) * stepH;
          tmp.push(alongFace(f, span(a, stepD), stepD, d0 + 0.15, d1 - 0.15, 0, yTop, 'metal', true));
          for (const s of [d0 + 0.15 + 0.03, d1 - 0.15 - 0.03]) {
            const [x, z] = at(a + up * stepD / 2, s);
            edge.transforms.push({ pos: [x, yTop, z], yaw });
          }
          // 腰板と手すり（2 段ごと）
          if (k % 2 === 0) {
            const len = Math.min(2, n - k) * stepD;
            const yPanel = Math.min(n, k + 2) * stepH + 1.0;
            for (const s of [d0, d1 - 0.12]) {
              tmp.push(alongFace(f, span(a, len), len, s, s + 0.12, 0, yPanel, 'stainless', true));
              const [x, z] = at(a + up * len / 2, s + 0.06);
              rail.transforms.push({ pos: [x, yPanel, z], yaw });
              const [gx, gz] = at(a + up * len / 2, s === d0 ? s + 0.145 : s - 0.025);
              railGlow.transforms.push({ pos: [gx, yPanel - 0.06, gz], yaw });
            }
            const [ox, oz] = at(a + up * len / 2, d1 + 0.016);
            skirtGlow.transforms.push({ pos: [ox, 0.06, oz], yaw });
          }
        }
        // 上の踊り場（壁まで）と手すり、支柱
        const aTop = base + up * (landing + runLen);
        tmp.push(alongFace(f, span(aTop, top), top, 0, d1, rise - 0.28, rise, 'stainless', true));
        tmp.push(alongFace(f, span(aTop, 0.25), 0.25, d0 + 0.15, d1 - 0.15, rise, rise + 0.01, 'metalDark', false));
        tmp.push(alongFace(f, span(aTop, top), top, d1 - 0.08, d1, rise, rise + 1.05, 'stainless', true));
        tmp.push(alongFace(f, span(aTop + up * (top - 0.08), 0.08), 0.08, 0, d1, rise, rise + 1.05, 'stainless', true));
        tmp.push(alongFace(f, span(aTop, top), top, d1 - 0.1, d1, rise + 1.05, rise + 1.1, 'rubber', false));
        tmp.push(alongFace(f, span(aTop + up * (top - 0.3), 0.3), 0.3, d1 - 0.3, d1, 0, rise - 0.28, 'metalDark', true));
        if (!placeUnit(c, tmp, { margin: 0.14 })) continue;
        pushInstances(L, rng, edge);
        pushInstances(L, rng, rail);
        pushInstances(L, rng, railGlow);
        pushInstances(L, rng, skirtGlow);
        // エスカレーターの上下に青白の点光源（+2）
        const [bx, bz] = at(base + up * landing * 0.5, (d0 + d1) / 2);
        const [tx, tz] = at(aTop + up * top * 0.5, (d0 + d1) / 2);
        L.lights.push({ pos: [bx, 1.6, bz], color: 0x9fd0ff, intensity: 0.75, distance: 9 });
        L.lights.push({ pos: [tx, rise + 1.6, tz], color: 0x9fd0ff, intensity: 0.75, distance: 9 });
        // 上階の案内（壁面、踊り場の上）
        wallSignAt(c, f, aTop + up * top * 0.5, Math.min(c.h - 0.4, rise + 2.1), 1.0, '2F ↑', { kind: 'emissive', color: 0xdff3ff, background: 0x10243a });
        c.note(`U03: escalator on dir ${f.dir}, steps ${n}, up ${up}`);
        return true;
      }
    }
  }
  return false;
}

// ---- U04 無名自販機室: 自販機を 3〜4 台の列に、灰タイル、ゴミ箱、冷白色

function u04(c: Ctx): void {
  const { L } = c;
  const r = c.rects[0];
  if (!r) return;
  recolorShell(L, 'floor', 'floorTile');
  tintLights(L, 0xe6efff, 1.15);
  L.palette.lightColor = 0xe6efff;
  // Generator の 1 台（前面 -X、z0+1.0〜2.0）に続けて 1.1 m ピッチの列にする。FakeSignage（blank/productLabel）は元の 1 台を
  // k = 1..extra（extra は同じ fork の rng.int(1,3)）の位置に複製するので、その先の k から置いて合計 4 台を狙う。
  // 前面の商品ラベル（白無地）は FakeSignage が全台（furnitureDark + lightPanel 前面）に貼る
  const src = L.boxes.slice(c.start).find((b) => b.solid && b.kind === 'vending');
  let placed = 0;
  if (src) {
    const extra = modifierRng(c.p, 'FakeSignage').int(1, 3);
    const unit = (k: number): Box[] => {
      const dz = 1.1 * k;
      return [
        kinded([src.min[0], 0, src.min[2] + dz], [src.max[0], src.max[1], src.max[2] + dz], 'furnitureDark', 'vending'),
        box([src.min[0] - 0.02, 0.5, src.min[2] + dz + 0.1], [src.min[0], 1.7, src.max[2] + dz - 0.1], 'lightPanel', false),
      ];
    };
    // FakeSignage の複製（k = 1..extra）が置けるかを同じ判定で見積もる（扉前・穴に掛かる分は置けない）
    let theirs = 0;
    for (let k = 1; k <= extra; k++) if (canPlaceUnit(c, unit(k), { margin: 0.1, lanes: false })) theirs++;
    for (let k = extra + 1; k <= 5 && 1 + theirs + placed < 4; k++) if (placeUnit(c, unit(k), { margin: 0.1 })) placed++;
    // 列が伸ばせない（穴・扉前）ときは向かいの壁（前面 +X）にも並べて 3〜4 台にする
    if (1 + theirs + placed < 3) {
      const w = src.max[0] - src.min[0];
      for (let k = 0; k < 3 && 1 + theirs + placed < 4; k++) {
        const z0 = src.min[2] + 1.1 * k;
        const body = kinded([r.x0 + 0.2, 0, z0], [r.x0 + 0.2 + w, src.max[1], z0 + 1.0], 'furnitureDark', 'vending');
        const front = box([r.x0 + 0.2 + w, 0.5, z0 + 0.1], [r.x0 + 0.2 + w + 0.02, 1.7, z0 + 0.9], 'lightPanel', false);
        if (placeUnit(c, [body, front], { margin: 0.1 })) placed++;
      }
    }
    // ゴミ箱（列の入口側の端）
    const bz = src.min[2] - 0.55;
    if (bz > r.z0 + WALL_T + 0.1) placeUnit(c, [kinded([src.max[0] - 0.5, 0, bz], [src.max[0] - 0.05, 0.8, bz + 0.45], 'metalDark', 'bin')], { margin: 0.1 });
    c.note(`U04: FakeSignage extra ${extra} (placeable ${theirs}), vending +${placed}`);
  }
}

// ---- U05 出口のない EXIT: 無地のコンクリート壁、扉なし、非常灯だけの暗さ（EXIT サイン・偽扉・緑灯は FakeSignage）

function u05(c: Ctx): void {
  const { L } = c;
  // FakeSignage が end を側壁へ移してシェルを palette で組み直すので、palette 側も書き換える
  recolorShell(L, 'wall', 'wallConcrete');
  recolorShell(L, 'floor', 'floorConcrete');
  // 装飾扉（左側の木扉）は外す: 出口の無い壁に扉は無い
  const door = L.palette.door;
  removeInterior(c, (b) => {
    if (b.solid) return false;
    const sy = b.max[1] - b.min[1];
    const thin = Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) <= 0.14;
    if (b.mat === door && sy > 1.9 && thin) return true;
    if (b.mat === 'trim' && sy > 2.0 && sy < 2.2 && thin) return true;
    if (b.mat === 'metal' && sy < 0.05 && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.2) return true;
    return false;
  });
  // 非常灯だけ: トロファーは全消灯、点光源は薄緑白の 2 灯（廊下の 1/3 と 2/3）、壁に小さな非常灯の箔
  setPanels(c, 'lightOff');
  L.lights = [];
  const pts = corridorPoints(c.rects, [1 / 3, 2 / 3]);
  for (const [x, z] of pts) {
    L.lights.push({ pos: [x, c.h - 0.5, z], color: 0xcfe8d6, intensity: 0.5, distance: 10 });
    const f = nearestFace(c, x, z);
    if (f) {
      const at = f.horizontal ? x : z;
      if (freeRuns(f, L.sockets, 0.8).some(([a, b]) => at > a + 0.3 && at < b - 0.3)) c.L.boxes.push(alongFace(f, at - 0.14, 0.28, 0, 0.05, c.h - 0.42, c.h - 0.32, 'lightGreen', false));
    }
  }
  L.palette.light = 'lightOff';
  L.palette.lightColor = 0xcfe8d6;
  L.palette.lightIntensity = 0.5;
  L.palette.ambient = 0x363a3e;
}

/** 廊下（矩形列）の中心線上の点。fracs は全長に対する位置 */
function corridorPoints(rects: Rect[], fracs: number[]): [number, number][] {
  if (!rects.length) return [];
  const centers = rects.map((r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2] as [number, number]);
  if (centers.length === 1) {
    const r = rects[0];
    const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
    return fracs.map((t) => (alongZ ? [centers[0][0], r.z0 + (r.z1 - r.z0) * t] : [r.x0 + (r.x1 - r.x0) * t, centers[0][1]]));
  }
  const segLen = centers.slice(1).map((c, i) => Math.hypot(c[0] - centers[i][0], c[1] - centers[i][1]));
  const total = segLen.reduce((a, b) => a + b, 0);
  return fracs.map((t) => {
    let d = t * total;
    for (let i = 0; i < segLen.length; i++) {
      if (d <= segLen[i] || i === segLen.length - 1) {
        const k = segLen[i] > 0 ? Math.min(1, d / segLen[i]) : 0;
        return [centers[i][0] + (centers[i + 1][0] - centers[i][0]) * k, centers[i][1] + (centers[i + 1][1] - centers[i][1]) * k] as [number, number];
      }
      d -= segLen[i];
    }
    return centers[0];
  });
}

/** 点に最も近い面（点が辺の範囲内にあるもの） */
function nearestFace(c: Ctx, x: number, z: number): FaceR | null {
  let best: FaceR | null = null;
  let bd = Infinity;
  for (const f of c.faces) {
    const at = f.horizontal ? x : z;
    if (at < f.a0 || at > f.a1) continue;
    const d = Math.abs((f.horizontal ? z : x) - f.face);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

// ---- U06 3:17 の待合室: 丸時計 5 個（全て 3:17）、掲示板、観葉植物（青い連結椅子・窓口は Generator、デジタル時計は FakeSignage）

function u06(c: Ctx): void {
  const { L, rng } = c;
  const used: { f: Face; a0: number; a1: number }[] = [];
  const conflicts = (f: Face, a0: number, a1: number) => used.some((u) => u.f === f && a0 < u.a1 + 0.3 && a1 > u.a0 - 0.3) || signNear(L, f, (a0 + a1) / 2, 1.2);
  // 掲示板 1 枚（窓口の北面以外の長い空き区間）
  const boards = c.faces.filter((f) => f.dir !== 0).flatMap((f) => freeRuns(f, L.sockets, 0.8).filter(([a, b]) => b - a >= 2.6).map(([a, b]) => ({ f, a, b }))).sort((p, q) => (q.b - q.a) - (p.b - p.a));
  for (const cd of boards) {
    const t = (cd.a + cd.b) / 2;
    if (conflicts(cd.f, t - 0.95, t + 0.95)) continue;
    noticeBoard(c, cd.f, t);
    used.push({ f: cd.f, a0: t - 0.95, a1: t + 0.95 });
    break;
  }
  // 丸時計 5 個: 長い区間から、2.5 m 以上離して
  let clocks = 0;
  const y = Math.min(c.h - 0.5, 2.05);
  const runs = c.faces.flatMap((f) => freeRuns(f, L.sockets, 1.0).map(([a, b]) => ({ f, a, b }))).filter((x) => x.b - x.a >= 1.2).sort((p, q) => (q.b - q.a) - (p.b - p.a));
  for (const rn of runs) {
    const n = Math.max(1, Math.floor((rn.b - rn.a - 0.8) / 2.5));
    for (let i = 0; i < n && clocks < 5; i++) {
      const t = rn.a + 0.4 + ((rn.b - rn.a - 0.8) * (i + 0.5)) / n + rng.float(-0.2, 0.2);
      if (conflicts(rn.f, t - 0.3, t + 0.3)) continue;
      wallClock(c, rn.f, t, y);
      used.push({ f: rn.f, a0: t - 0.3, a1: t + 0.3 });
      clocks++;
    }
    if (clocks >= 5) break;
  }
  // 観葉植物 2 つ（隅）
  const r = c.rects[0];
  let plants = 0;
  for (const [x, z] of rng.shuffle<[number, number]>([[r.x0 + 0.65, r.z1 - 0.65], [r.x1 - 0.65, r.z1 - 0.65], [r.x0 + 0.65, r.z0 + 0.65], [r.x1 - 0.65, r.z0 + 0.65]])) {
    if (plants >= 2) break;
    if (plantUnit(c, x, z)) plants++;
  }
  c.note(`U06: clocks ${clocks}, plants ${plants}`);
}

// ---- U07 室内雨漏り広場: 雨域（ParticleDetail と同じ位置）に落水の柱、天井のシミ、濡れ床看板、プランター、青灰の光、「2F」

/** ParticleDetail(rain) が選ぶ雨域（同じ fork・同じ式） */
function rainRect(L: RoomLayout, p: GenParams): Rect | null {
  const rects = L.footprint;
  if (!rects.length) return null;
  const rng = modifierRng(p, 'ParticleDetail');
  const dp = modParam(p, 'ParticleDetail', 'density');
  const density = Math.min(1, Math.max(0.05, typeof dp === 'number' ? dp : 0.3));
  const largest = rects.reduce((a, r) => (rectArea(r) > rectArea(a) ? r : a), rects[0]);
  const side = Math.min(8, Math.max(3, 3 + 6 * density));
  const zone = inner(largest, 3.0);
  const cx = zone.x1 - zone.x0 > 0.5 ? rng.float(zone.x0, zone.x1) : (largest.x0 + largest.x1) / 2;
  const cz = zone.z1 - zone.z0 > 0.5 ? rng.float(zone.z0, zone.z1) : (largest.z0 + largest.z1) / 2;
  const ib = inner(largest, 0.6);
  return rectIntersect(rect(cx - side / 2, cz - side / 2, cx + side / 2, cz + side / 2), ib) ?? ib;
}

function u07(c: Ctx): void {
  const { L, p, rng } = c;
  const main = c.rects[0];
  if (!main) return;
  const rain = rainRect(L, p);
  if (rain) {
    const cx = (rain.x0 + rain.x1) / 2;
    const cz = (rain.z0 + rain.z1) / 2;
    // 落水の柱: 半透明の waterShallow（flow で流れる）を細い箱で束ねる。非ソリッド
    const cols: [number, number, number][] = [[0, 0, 0.09], [0.22, 0.1, 0.05], [-0.18, 0.2, 0.05], [0.05, -0.24, 0.05], [-0.15, -0.15, 0.04], [0.3, -0.12, 0.035]];
    for (const [dx, dz, w] of cols) L.boxes.push(box([cx + dx - w / 2, 0.02, cz + dz - w / 2], [cx + dx + w / 2, c.h - 0.02, cz + dz + w / 2], 'waterShallow', false));
    // 天井の漏水のシミ（暗い箔）
    L.boxes.push(box([cx - 0.9, c.h - 0.012, cz - 0.7], [cx + 0.9, c.h - 0.006, cz + 0.7], 'wallDark', false));
    // 濡れ床の看板（雨域の入口側の縁。glTF プロップ 'sign.wetFloor' に置き換わる寸法）
    const entry = L.sockets.find((s) => s.id === 'entry');
    const toward = entry ? Math.sign(entry.pos[2] - cz) || -1 : -1;
    const sz = toward < 0 ? rain.z0 - 0.7 : rain.z1 + 0.7;
    placeUnit(c, [kinded([cx - 0.15, 0, sz - 0.15], [cx + 0.15, 0.62, sz + 0.15], 'plasticYellow', 'sign.wetFloor', true)], { margin: 0.3 });
    // プランター: 雨域に近い壁面の空き区間に 3 つ
    let planters = 0;
    const faces = [...c.faces].sort((a, b) => faceDist(a, cx, cz) - faceDist(b, cx, cz));
    for (const f of faces) {
      if (planters >= 3) break;
      for (const [a0, a1] of freeRuns(f, L.sockets, 1.2)) {
        if (planters >= 3) break;
        if (a1 - a0 < 2.0) continue;
        const t = rng.float(a0 + 0.8, a1 - 0.8);
        const [px, pz] = facePoint(f, t, 0.55);
        if (placeUnit(c, [
          box([px - 0.6, 0, pz - 0.35], [px + 0.6, 0.5, pz + 0.35], 'furnitureDark', true),
          box([px - 0.5, 0.5, pz - 0.28], [px + 0.5, 1.2, pz + 0.28], 'plant', false),
        ], { margin: 0.14 })) planters++;
      }
    }
    c.note(`U07: rain at ${cx.toFixed(1)},${cz.toFixed(1)} planters ${planters}`);
  }
  // 青灰の光、濡れて反射する床
  tintLights(L, 0xa9bfd6);
  L.palette.lightColor = 0xa9bfd6;
  L.palette.ambient = 0x6b7684;
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.3) };
  // 「2F」: 入口の反対（北）の壁、中二階の帯（3.4〜3.6）の上に大きく
  const north = c.faces.filter((f) => f.dir === 0).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0];
  if (north) wallSignAt(c, north, (north.a0 + north.a1) / 2, Math.min(c.h - 0.6, 4.1), 1.6, '2F', { kind: 'emissive', color: 0xffffff, background: 0x1b2a44 });
}

function faceDist(f: Face, x: number, z: number): number {
  const at = f.horizontal ? x : z;
  const along = at < f.a0 ? f.a0 - at : at > f.a1 ? at - f.a1 : 0;
  return Math.hypot(along, (f.horizontal ? z : x) - f.face);
}

// ---- U08 湿ったホテル廊下: 模様カーペット、暗い暖色（ダウンライトの一部消灯）、両側の壁灯（濡れは Wetness）

function u08(c: Ctx): void {
  const { L, rng } = c;
  recolorShell(L, 'floor', 'carpetPattern', true);
  const off: Box[] = [];
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (isPanel(b, c.h) && b.mat !== 'lightOff' && rng.chance(0.35)) {
      L.boxes[i] = { ...b, mat: 'lightOff' };
      off.push(b);
    }
  }
  L.lights = L.lights.filter((l) => !off.some((b) => Math.hypot((b.min[0] + b.max[0]) / 2 - l.pos[0], (b.min[2] + b.max[2]) / 2 - l.pos[2]) < 0.7));
  tintLights(L, 0xffc27a, 0.75);
  L.palette.lightColor = 0xffc27a;
  L.palette.lightIntensity *= 0.75;
  L.palette.ambient = 0x4a3c30;
  hotelSconcesRight(c, 1.55);
}

// ---- U09 鏡のずれる洗面所: 清潔な白い光、洗面器のソープボトル、ペーパータオル・ハンドドライヤー（鏡と洗面台は Generator / MirrorOffset）

function u09(c: Ctx): void {
  const { L, rng } = c;
  tintLights(L, 0xf3f6ff, 1.1);
  L.palette.lightColor = 0xf3f6ff;
  const basins = L.boxes.slice(c.start).filter((b) => b.solid && b.mat === 'wallWhite' && Math.abs(b.min[1] - 0.72) < 0.01 && Math.abs(b.max[1] - 0.9) < 0.01);
  const bottles: InstanceSpec = { mat: 'signPlate', size: [0.07, 0.17, 0.07], transforms: [] };
  const pumps: InstanceSpec = { mat: 'metalDark', size: [0.03, 0.05, 0.09], transforms: [] };
  let sinkFace: FaceR | null = null;
  let sinkA0 = Infinity, sinkA1 = -Infinity;
  for (const b of basins) {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const f = nearestFace(c, cx, cz);
    if (!f) continue;
    sinkFace = f;
    const at = (f.horizontal ? cx : cz) + 0.17;
    sinkA0 = Math.min(sinkA0, f.horizontal ? b.min[0] : b.min[2]);
    sinkA1 = Math.max(sinkA1, f.horizontal ? b.max[0] : b.max[2]);
    const [x, z] = facePoint(f, at, 0.1);
    bottles.transforms.push({ pos: [x, 0.9, z], yaw: 0 });
    pumps.transforms.push({ pos: [x, 1.07, z], yaw: f.horizontal ? 0 : Math.PI / 2 });
  }
  pushInstances(L, rng, bottles);
  pushInstances(L, rng, pumps);
  // 洗面器列の脇にペーパータオル（白）とハンドドライヤー（ステンレス）
  if (sinkFace) {
    const f = sinkFace;
    for (const [a0, a1] of freeRuns(f, L.sockets, 0.6)) {
      if (a1 <= sinkA0 - 0.3 || a0 >= sinkA1 + 0.3) continue;
      const right = sinkA1 + 0.3, left = sinkA0 - 0.3;
      if (right + 0.35 <= a1 - 0.1) {
        L.boxes.push(alongFace(f, right, 0.3, 0.0, 0.12, 1.15, 1.55, 'signPlate', false));
        L.boxes.push(alongFace(f, right + 0.02, 0.26, 0.12, 0.13, 1.18, 1.3, 'metalDark', false));
      }
      if (left - 0.35 >= a0 + 0.1) {
        L.boxes.push(alongFace(f, left - 0.32, 0.3, 0.0, 0.2, 1.0, 1.55, 'stainless', false));
        L.boxes.push(alongFace(f, left - 0.27, 0.2, 0.2, 0.22, 1.02, 1.1, 'void', false));
      }
      break;
    }
  }
  c.note(`U09: basins ${basins.length}`);
}

// ---- U10 壁向き教室: 露出蛍光管ペア、後ろの壁（机が向く壁の反対）にランドセル棚と丸時計（机・黒板・教卓は PropOrientation）

function u10(c: Ctx): void {
  const { L } = c;
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!isPanel(b, c.h)) continue;
    const x = (b.min[0] + b.max[0]) / 2;
    const z = (b.min[2] + b.max[2]) / 2;
    const tmp: Box[] = [];
    tubePair(tmp, x, z, b.max[0] - b.min[0] >= b.max[2] - b.min[2], c.h, b.mat === 'lightOff' ? 'lightOff' : 'lightPanel');
    L.boxes[i] = tmp[0];
  }
  const facing = socketFreeWallDir(L);
  const back = ((facing + 2) % 4) as Dir;
  let shelf = false;
  for (const f of c.faces.filter((q) => q.dir === back)) {
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.0)) {
      const len = Math.min(6, a1 - a0 - 0.4);
      if (len < 1.2) continue;
      const at = (a0 + a1) / 2 - len / 2;
      if (!placeUnit(c, [alongFace(f, at, len, 0.02, 0.42, 0, 0.9, 'bookshelfWood', true)])) continue;
      for (let t = at + 0.4; t < at + len - 0.2; t += 0.4) L.boxes.push(alongFace(f, t - 0.01, 0.02, 0.42, 0.44, 0.05, 0.85, 'wallDark', false));
      L.boxes.push(alongFace(f, at, len, 0.02, 0.44, 0.88, 0.9, 'handrailWood', false));
      L.boxes.push(alongFace(f, at, len, 0.42, 0.44, 0.45, 0.47, 'handrailWood', false));
      wallClock(c, f, at + len / 2, Math.min(c.h - 0.45, 2.35), 0.46);
      shelf = true;
      break;
    }
    if (shelf) break;
  }
  c.note(`U10: facing ${facing}, shelf ${shelf}`);
}

// ---- U11 手荷物受取所: 中央のターンテーブル（段付きのステンレスの環 + 段状の島）とスーツケース 1 つ、「3」の吊り看板、案内板

function u11(c: Ctx): void {
  const { L } = c;
  const r = c.rects[0];
  if (!r) return;
  recolorShell(L, 'floor', 'floorTile');
  L.palette.lightColor = 0xe9f0ff;
  // 汎用パターンの家具は PropRepetition（luggage）が後で捨てる（FURNITURE_MATS）ので、先に外して置き場を空ける。
  // ここで足す箱はその材質集合（metal / rubber / upholstery …）を避ける（stainless / metalDark / seatRed / void）
  removeInterior(c, (b) => b.solid && PROP_FURNITURE.has(b.mat));
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const alongX = w >= d;
  // 柱（7〜8.5 m 格子）の間に収まる大きさ。置き場は中央に近い順の格子探索（動線・柱を避ける）
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  let placed: [number, number] | null = null;
  const sizes: [number, number][] = [[Math.min(5.4, Math.max(4.4, (alongX ? w : d) * 0.25)), Math.min(3.6, Math.max(3.0, (alongX ? d : w) * 0.2))], [4.2, 3.0], [3.6, 2.8]];
  for (const [len, wid] of sizes) {
    const hx = (alongX ? len : wid) / 2 + 0.35, hz = (alongX ? wid : len) / 2 + 0.35;
    const spot = findSpot(c, hx, hz, cx, cz, { step: 0.25, margin: 0.4, height: 1.3 });
    if (spot && carousel(c, spot[0], spot[1], len, wid, alongX)) { placed = spot; c.note(`U11: carousel ${len}x${wid} at ${spot.map((v) => v.toFixed(1)).join(',')}`); break; }
  }
  if (placed) {
    // 「3」の吊り看板（黄地・黒字、両面）をターンテーブルの上に
    hangingBoard(c, placed[0], placed[1], Math.min(c.h - 0.55, 3.2), 1.2, 0.5, !alongX, '3', { color: 0x151515, background: 0xf2c94c }, 'both', 'plasticYellow');
  } else c.note('U11: carousel omitted');
  // 案内板（入口の反対の壁）。入口内側の「BAGGAGE CLAIM」は PropRepetition
  const north = c.faces.filter((f) => f.dir === 0).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0];
  if (north) wallSignAt(c, north, (north.a0 + north.a1) / 2, Math.min(c.h - 0.45, 2.45), 2.2, '3  手荷物受取所', { sub: 'Baggage Claim', color: 0x151515, background: 0xf2c94c });
}

/** PropRepetition.shared.FURNITURE_MATS と同じ集合（U11 で後段の Modifier が捨てる家具材質） */
const PROP_FURNITURE: ReadonlySet<string> = new Set(['furnitureDark', 'furnitureLight', 'shelfMetal', 'boxCardboard', 'upholstery', 'metal', 'doorMetal', 'ledBlue', 'rubber', 'carPaint', 'carGlass', 'screenGlow']);
/** ベルト面の材質（rubber は PropRepetition が家具として捨てるので metalDark） */
const BELT: MatId = 'metalDark';

/** ターンテーブル: 段付き（角を 1 m の段で落とした）ステンレスの台座 0.72 m + 暗いベルト面 + 段状の島 + 投入口。台座はソリッド */
function carousel(c: Ctx, cx: number, cz: number, len: number, wid: number, alongX: boolean): boolean {
  const hx = alongX ? len / 2 : wid / 2, hz = alongX ? wid / 2 : len / 2;
  const x0 = cx - hx, x1 = cx + hx, z0 = cz - hz, z1 = cz + hz;
  const cut = 1.0, H = 0.72, bw = 0.9, e = 0.05;
  const skirt: MatId = 'stainless';
  const tmp: Box[] = [];
  tmp.push(box([x0 + cut, 0, z0], [x1 - cut, H, z1], skirt));
  tmp.push(box([x0, 0, z0 + cut], [x0 + cut, H, z1 - cut], skirt));
  tmp.push(box([x1 - cut, 0, z0 + cut], [x1, H, z1 - cut], skirt));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
    // 外側の角 (ox, oz) から内側へ ix / iz。角の 1 m 角のうち最外の 0.5 m 角だけを落とす（L 字 = 2 箱）
    const ox = sx < 0 ? x0 : x1, oz = sz < 0 ? z0 : z1;
    const ix = -sx, iz = -sz;
    tmp.push(box([ox + ix * cut / 2, 0, oz], [ox + ix * cut, H, oz + iz * cut], skirt));
    tmp.push(box([ox, 0, oz + iz * cut / 2], [ox + ix * cut / 2, H, oz + iz * cut], skirt));
    // 角のベルト面（L 字）
    tmp.push(box([ox + ix * cut / 2, H, oz + iz * e], [ox + ix * cut, H + 0.04, oz + iz * cut], BELT, false));
    tmp.push(box([ox + ix * e, H, oz + iz * cut / 2], [ox + ix * cut / 2, H + 0.04, oz + iz * cut], BELT, false));
  }
  tmp.push(box([x0 + cut, H, z0 + e], [x1 - cut, H + 0.04, z0 + e + bw], BELT, false));
  tmp.push(box([x0 + cut, H, z1 - e - bw], [x1 - cut, H + 0.04, z1 - e], BELT, false));
  tmp.push(box([x0 + e, H, z0 + cut], [x0 + e + bw, H + 0.04, z1 - cut], BELT, false));
  tmp.push(box([x1 - e - bw, H, z0 + cut], [x1 - e, H + 0.04, z1 - cut], BELT, false));
  // 島（段状のステンレス）と投入口（暗い開口 + 黒い庇）
  const ix0 = x0 + e + bw + 0.1, ix1 = x1 - e - bw - 0.1, iz0 = z0 + e + bw + 0.1, iz1 = z1 - e - bw - 0.1;
  if (ix1 - ix0 > 0.8 && iz1 - iz0 > 0.8) {
    tmp.push(box([ix0, H, iz0], [ix1, H + 0.35, iz1], skirt, false));
    const in2 = Math.min(0.45, (ix1 - ix0) / 4, (iz1 - iz0) / 4);
    tmp.push(box([ix0 + in2, H + 0.35, iz0 + in2], [ix1 - in2, H + 0.7, iz1 - in2], skirt, false));
    const mx = (ix0 + ix1) / 2, mz = (iz0 + iz1) / 2;
    if (alongX) {
      tmp.push(box([mx - 0.6, H + 0.04, iz0 - 0.005], [mx + 0.6, H + 0.6, iz0 + 0.01], 'void', false));
      tmp.push(box([mx - 0.7, H + 0.6, iz0 - 0.15], [mx + 0.7, H + 0.7, iz0 + 0.3], 'metalDark', false));
    } else {
      tmp.push(box([ix0 - 0.005, H + 0.04, mz - 0.6], [ix0 + 0.01, H + 0.6, mz + 0.6], 'void', false));
      tmp.push(box([ix0 - 0.15, H + 0.6, mz - 0.7], [ix0 + 0.3, H + 0.7, mz + 0.7], 'metalDark', false));
    }
  }
  if (!placeUnit(c, tmp, { margin: 0.4 })) return false;
  // スーツケース 1 つ（入口側のベルトの上）
  const bx = alongX ? cx - len * 0.2 : x0 + e + bw / 2;
  const bz = alongX ? z0 + e + bw / 2 : cz - len * 0.2;
  c.L.boxes.push(box([bx - 0.35, H + 0.04, bz - 0.22], [bx + 0.35, H + 0.32, bz + 0.22], 'seatRed', false));
  c.L.boxes.push(box([bx - 0.15, H + 0.32, bz - 0.02], [bx + 0.15, H + 0.36, bz + 0.02], 'metalDark', false));
  return true;
}

// ---- U12 営業時間外フードコート: 暗い部屋、店舗列（メニュー看板と赤い店名帯だけ点灯）、卓の上に逆さの椅子

function u12(c: Ctx): void {
  const { L, rng } = c;
  const r = c.rects[0];
  if (!r) return;
  // 汎用パターンの机・島は外す（柱・間仕切りは残す）
  removeInterior(c, (b) => b.solid && (b.mat === 'furnitureLight' || b.mat === 'furnitureDark' || b.mat === 'shelfMetal') && b.max[1] - b.min[1] < 2.0);
  setPanels(c, 'lightOff');
  L.lights = [];
  L.palette.light = 'lightOff';
  L.palette.lightColor = 0xffd2a0;
  L.palette.lightIntensity = 0.5;
  L.palette.ambient = 0x2a2b31;
  // 店舗列: 入口の反対（北）の面の最長区間、無ければ他の面
  const runs = c.faces.flatMap((f) => freeRuns(f, L.sockets, 1.0).map(([a, b]) => ({ f, a, b }))).filter((x) => x.b - x.a >= 4.2);
  runs.sort((p, q) => Number(q.f.dir === 0) - Number(p.f.dir === 0) || (q.b - q.a) - (p.b - p.a));
  const names = ['麺 NOODLE', 'CURRY HOUSE', 'BURGER', 'CAFE & SWEETS'];
  let shops = 0, lit = 0;
  let shopFace: FaceR | null = null;
  const shopW = 3.6, gap = 0.4;
  // 置けた店が 2 つになるまで区間を順に試す（柱・動線に掛かる店は飛ばす）
  for (const run of runs) {
    if (shops >= 2) break;
    const f = run.f;
    const n = Math.min(4 - shops, Math.floor((run.b - run.a + gap) / (shopW + gap)));
    if (n < 1) continue;
    const start = (run.a + run.b) / 2 - (n * (shopW + gap) - gap) / 2;
    for (let k = 0; k < n; k++) {
      const a = start + k * (shopW + gap);
      const tmp: Box[] = [];
      tmp.push(alongFace(f, a, shopW, 0, 0.02, 0, 2.95, 'wallDark', false));
      tmp.push(alongFace(f, a + 0.2, shopW - 0.4, 1.2, 1.9, 0, 0.92, 'metalDark', true));
      tmp.push(alongFace(f, a + 0.16, shopW - 0.32, 1.18, 1.94, 0.92, 0.96, 'stainless', false));
      tmp.push(alongFace(f, a + 0.5, 1.2, 1.25, 1.75, 0.96, 1.45, 'carGlass', false));
      tmp.push(alongFace(f, a + 0.3, shopW - 0.6, 0.02, 0.05, 2.05, 2.62, 'screenGlow', false));
      tmp.push(alongFace(f, a + 0.1, shopW - 0.2, 0.02, 0.06, 2.62, 2.95, 'plasticRed', false));
      if (!placeUnit(c, tmp, { margin: 0.1 })) continue;
      shopFace ??= f;
      wallSignAt(c, f, a + shopW / 2, 2.785, 1.3, names[shops % names.length], { color: 0xfff4e6, background: 0xc4342c, offset: 0.072 });
      if (lit < 2) {
        const [lx, lz] = facePoint(f, a + shopW / 2, 1.5);
        L.lights.push({ pos: [lx, 2.3, lz], color: 0xffd2a0, intensity: 0.9, distance: 9 });
        lit++;
      }
      shops++;
    }
  }
  // 卓（0.8 角、1 本脚）と逆さの椅子（instances）
  const seat: InstanceSpec = { mat: 'plasticRed', size: [0.4, 0.04, 0.4], transforms: [] };
  const back: InstanceSpec = { mat: 'plasticRed', size: [0.04, 0.36, 0.4], transforms: [] };
  const leg: InstanceSpec = { mat: 'metalDark', size: [0.025, 0.42, 0.025], transforms: [] };
  const ir = inner(r, 1.8);
  if (shopFace) {
    // 店舗の前 3.2 m は空ける
    if (shopFace.dir === 0) ir.z1 = Math.min(ir.z1, shopFace.face - 3.2);
    else if (shopFace.dir === 2) ir.z0 = Math.max(ir.z0, shopFace.face + 3.2);
    else if (shopFace.dir === 1) ir.x1 = Math.min(ir.x1, shopFace.face - 3.2);
    else ir.x0 = Math.max(ir.x0, shopFace.face + 3.2);
  }
  const pitch = 2.6;
  let tables = 0;
  for (const tx of pitchAlong(ir.x0, ir.x1, pitch, 0.5)) {
    for (const tz of pitchAlong(ir.z0, ir.z1, pitch, 0.5)) {
      if (tables >= 30) break;
      const top = box([tx - 0.4, 0.7, tz - 0.4], [tx + 0.4, 0.74, tz + 0.4], 'furnitureLight');
      const ped = box([tx - 0.04, 0, tz - 0.04], [tx + 0.04, 0.7, tz + 0.04], 'metalDark');
      const base = box([tx - 0.25, 0, tz - 0.25], [tx + 0.25, 0.02, tz + 0.25], 'metalDark', false);
      if (!placeUnit(c, [top, ped, base], { margin: 0.3 })) continue;
      tables++;
      for (const side of [-1, 1]) {
        if (rng.chance(0.15)) continue;
        const sx = tx + side * 0.2;
        seat.transforms.push({ pos: [sx, 0.74, tz], yaw: 0 });
        back.transforms.push({ pos: [tx + side * 0.42, 0.36, tz], yaw: 0 });
        for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) leg.transforms.push({ pos: [sx + lx, 0.78, tz + lz], yaw: 0 });
      }
    }
  }
  pushInstances(L, rng, seat);
  pushInstances(L, rng, back);
  pushInstances(L, rng, leg);
  c.note(`U12: shops ${shops}, tables ${tables}`);
}

// ---- U13 プールのない更衣室: ロッカーを青に、「シャワーをご利用ください」、出口の無い壁に「プール →」

function u13(c: Ctx): void {
  const { L } = c;
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.mat === 'lockerGreen') L.boxes[i] = { ...b, mat: 'lockerBlue' };
  }
  for (const s of L.signs ?? []) if (s.text === '清潔にご利用ください') s.text = 'シャワーをご利用ください';
  // 「プール →」: ソケットの無い面のうち最長のもの（案内の先に扉は無い）
  const blank = c.faces.filter((f) => freeRuns(f, L.sockets, 0.6).length === 1 && freeRuns(f, L.sockets, 0.6)[0][1] - freeRuns(f, L.sockets, 0.6)[0][0] >= f.a1 - f.a0 - 0.01)
    .sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0];
  const runs = c.faces.flatMap((f) => freeRuns(f, L.sockets, 1.0).map(([a, b]) => ({ f, a, b }))).filter((x) => x.b - x.a >= 3).sort((p, q) => (q.b - q.a) - (p.b - p.a));
  const cand = blank ? { f: blank, a: blank.a0, b: blank.a1 } : runs[0];
  if (cand && !signNear(L, cand.f, (cand.a + cand.b) / 2, 1.5)) wallSignAt(c, cand.f, (cand.a + cand.b) / 2, Math.min(c.h - 0.4, 2.35), 0.9, 'プール →', { color: 0x1d4f8a });
  L.palette.lightColor = 0xdfe9ff;
}

// ---- U14 受話器の上がったオフィス: 机の CRT モニター・キーボード・電話（受話器は立てて置く）、本棚、観葉植物

function u14(c: Ctx): void {
  const { L, rng } = c;
  const desks = L.boxes.slice(c.start).filter((b) => b.solid && b.kind === 'desk' && b.max[1] - b.min[1] > 0.6 && b.max[1] - b.min[1] < 0.9);
  const body: InstanceSpec = { mat: 'signPlate', size: [0.4, 0.34, 0.38], transforms: [] };
  const screen: InstanceSpec = { mat: 'screenDark', size: [0.34, 0.26, 0.02], transforms: [] };
  const kb: InstanceSpec = { mat: 'furnitureDark', size: [0.42, 0.025, 0.15], transforms: [] };
  const phone: InstanceSpec = { mat: 'metalDark', size: [0.2, 0.05, 0.22], transforms: [] };
  const handset: InstanceSpec = { mat: 'metalDark', size: [0.05, 0.21, 0.06], transforms: [] };
  let stations = 0;
  for (const d of desks) {
    const top = d.max[1] + 0.04; // 天板箔（furnitureDark 4 cm）の上
    const alongX = d.max[0] - d.min[0] >= d.max[2] - d.min[2];
    const len = alongX ? d.max[0] - d.min[0] : d.max[2] - d.min[2];
    const dep = alongX ? d.max[2] - d.min[2] : d.max[0] - d.min[0];
    const n = Math.floor((len - 0.4) / 1.6);
    if (n < 1) continue;
    const step = len / n;
    const cc = alongX ? (d.min[2] + d.max[2]) / 2 : (d.min[0] + d.max[0]) / 2;
    for (let k = 0; k < n; k++) {
      const a = (alongX ? d.min[0] : d.min[2]) + step * (k + 0.5);
      for (const side of dep >= 1.2 ? [-1, 1] : [1]) {
        const off = dep >= 1.2 ? side * 0.18 : side * (dep / 2 - 0.36);
        const mx = alongX ? a : cc + off;
        const mz = alongX ? cc + off : a;
        const yaw = alongX ? 0 : Math.PI / 2;
        body.transforms.push({ pos: [mx, top, mz], yaw });
        screen.transforms.push({ pos: [alongX ? mx : mx + side * 0.2, top + 0.05, alongX ? mz + side * 0.2 : mz], yaw });
        kb.transforms.push({ pos: [alongX ? mx : mx + side * 0.44, top, alongX ? mz + side * 0.44 : mz], yaw });
        if ((k + (side > 0 ? 0 : 1)) % 2 === 0) {
          const px = alongX ? a + 0.5 : cc + off + side * 0.1;
          const pz = alongX ? cc + off + side * 0.1 : a + 0.5;
          phone.transforms.push({ pos: [px, top, pz], yaw });
          handset.transforms.push({ pos: [alongX ? px + 0.18 : px, top, alongX ? pz : pz + 0.18], yaw });
        }
        stations++;
      }
    }
  }
  for (const s of [body, screen, kb, phone, handset]) pushInstances(L, rng, s);
  // 本棚（空き壁に 2〜3 台）と観葉植物（隅）
  let shelves = 0;
  for (const f of [...c.faces].sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))) {
    if (shelves >= 3) break;
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.0)) {
      if (shelves >= 3 || a1 - a0 < 2.0) continue;
      const at = (a0 + a1) / 2 - 0.9;
      for (let k = 0; k < 2 && shelves < 3; k++) {
        if (placeUnit(c, [alongFace(f, at + k * 0.92, 0.9, 0.02, 0.37, 0, 2.1, 'bookshelfWood', true)])) {
          for (const y of [0.4, 0.9, 1.4, 1.9]) L.boxes.push(alongFace(f, at + k * 0.92 + 0.03, 0.84, 0.05, 0.36, y, y + 0.02, 'wallDark', false));
          shelves++;
        }
      }
    }
  }
  const r = c.rects[0];
  let plants = 0;
  for (const [x, z] of rng.shuffle<[number, number]>([[r.x0 + 0.65, r.z1 - 0.65], [r.x1 - 0.65, r.z1 - 0.65], [r.x0 + 0.65, r.z0 + 0.65], [r.x1 - 0.65, r.z0 + 0.65]])) {
    if (plants >= 2) break;
    if (plantUnit(c, x, z)) plants++;
  }
  c.note(`U14: desks ${desks.length}, stations ${stations}, shelves ${shelves}`);
}

// ---- U15 単一商品スーパー: 白い高照度、棚の縁の値札レール、全通路に同じ「5 日用品」の吊り看板（商品は PropRepetition）

function u15(c: Ctx): void {
  const { L } = c;
  const r = c.rects[0];
  if (!r) return;
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (isPanel(b, c.h) && b.mat === 'lightOff') L.boxes[i] = { ...b, mat: L.palette.light };
  }
  tintLights(L, 0xf4f7ff, 1.2);
  L.palette.lightColor = 0xf4f7ff;
  L.palette.lightIntensity *= 1.2;
  const blocks = L.boxes.slice(c.start).filter((b) => b.solid && b.mat === 'shelfMetal' && b.max[1] - b.min[1] >= 1.3 && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 1.2);
  // 棚の縁の値札レールは置かない: PropRepetition が非ソリッドの箔を捨てるためソリッドで 250 個置くと、構築時間が +45%（焼き込み・コライダ）になり
  // 見た目の寄与（縁の細い帯）が小さかった。商品（PropRepetition）と看板・高照度で「スーパーの通路」を出す
  // 通路の吊り看板: 列（across 座標）の間の通路中央、入口側の端
  let signs = 0;
  if (blocks.length) {
    const axisX = blocks[0].max[0] - blocks[0].min[0] >= blocks[0].max[2] - blocks[0].min[2];
    const rows = [...new Set(blocks.map((b) => Math.round(((axisX ? b.min[2] + b.max[2] : b.min[0] + b.max[0]) / 2) * 10) / 10))].sort((p, q) => p - q);
    const lo = (axisX ? r.z0 : r.x0) + WALL_T, hi = (axisX ? r.z1 : r.x1) - WALL_T;
    const aisles: number[] = [];
    if (rows[0] - lo > 1.6) aisles.push((lo + rows[0] - 0.45) / 2);
    for (let i = 0; i + 1 < rows.length; i++) aisles.push((rows[i] + rows[i + 1]) / 2);
    if (hi - rows[rows.length - 1] > 1.6) aisles.push((rows[rows.length - 1] + 0.45 + hi) / 2);
    const entry = L.sockets.find((s) => s.id === 'entry');
    const a = axisX ? (entry && entry.pos[0] > (r.x0 + r.x1) / 2 ? r.x1 - 2.2 : r.x0 + 2.2) : r.z0 + 2.2;
    for (const ac of aisles.slice(0, 6)) {
      const x = axisX ? a : ac, z = axisX ? ac : a;
      hangingBoard(c, x, z, c.h - 0.5, 1.2, 0.3, !axisX, '5 日用品', { sub: 'Daily Goods', color: 0xffffff, background: 0x2b5aa8 }, 'both', 'plasticBlue');
      signs++;
    }
  }
  c.note(`U15: blocks ${blocks.length}, aisle signs ${signs}`);
}

// ---- U16 番号異常駐車場: 柱の階表示を矛盾させる（B3 / B1 / 101 …）、車 2〜3 台、床の矢印（区画コードは DuplicateNumber）

function u16(c: Ctx): void {
  const { L, rng } = c;
  const r = c.rects[0];
  if (!r) return;
  let k = 0;
  for (const s of L.signs ?? []) {
    if (s.text !== 'B1') continue;
    const idx = Math.floor(k / 2);
    s.text = idx % 3 === 0 ? 'B3' : idx % 3 === 1 ? 'B1' : String(101 + idx);
    k++;
  }
  // 車: 車止め（columnConcrete 高 0.12）から区画の向きを読み、2〜3 台
  const stops = L.boxes.slice(c.start).filter((b) => b.solid && b.mat === 'columnConcrete' && Math.abs(b.max[1] - 0.12) < 0.01 && b.min[1] < 0.01);
  let cars = 0;
  const want = rng.int(2, 3);
  for (const s of rng.shuffle([...stops])) {
    if (cars >= want) break;
    const car = carAt(c, s);
    if (car && placeUnit(c, car, { margin: 0.3, laneMargin: 0.2 })) cars++;
  }
  // 床の矢印（通路の中心線、8 m ごと、ランプ出口の方向）
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const shortLen = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
  const lanesC: number[] = shortLen >= 24 ? [(alongX ? r.z0 : r.x0) + 0.15 + 5 + (mid - 5 - (alongX ? r.z0 : r.x0) - 0.15) / 2, (alongX ? r.z1 : r.x1) - 0.15 - 5 - ((alongX ? r.z1 : r.x1) - 0.15 - 5 - mid) / 2] : [mid];
  const ramp = L.sockets.find((s) => s.type === 'ramp') ?? L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
  const entry = L.sockets.find((s) => s.id === 'entry');
  const from = entry ? (alongX ? entry.pos[0] : entry.pos[2]) : (alongX ? r.x0 : r.z0);
  const to = ramp ? (alongX ? ramp.pos[0] : ramp.pos[2]) : (alongX ? r.x1 : r.z1);
  const dir = Math.sign(to - from) || 1;
  const head: InstanceSpec = { mat: 'yellowLine', size: [0.9, 0.012, 0.22], transforms: [] };
  let arrows = 0;
  for (const lc of lanesC) {
    for (const a of pitchAlong(alongX ? r.x0 + 2 : r.z0 + 2, alongX ? r.x1 - 2 : r.z1 - 2, 8, 1)) {
      const x = alongX ? a : lc, z = alongX ? lc : a;
      const tip = a + dir * 0.9;
      const shaft = alongX ? box([Math.min(a - dir * 0.9, tip - dir * 0.2), 0.002, z - 0.11], [Math.max(a - dir * 0.9, tip - dir * 0.2), 0.012, z + 0.11], 'yellowLine', false)
        : box([x - 0.11, 0.002, Math.min(a - dir * 0.9, tip - dir * 0.2)], [x + 0.11, 0.012, Math.max(a - dir * 0.9, tip - dir * 0.2)], 'yellowLine', false);
      // 柱・車止めの上には描かない
      if (solidHit(c, shaft) || hitsZone(c.zones, shaft)) continue;
      L.boxes.push(shaft);
      for (const side of [-1, 1]) {
        const ax = alongX ? tip - dir * 0.32 : x + side * 0.32;
        const az = alongX ? z + side * 0.32 : tip - dir * 0.32;
        head.transforms.push({ pos: [ax, 0.002, az], yaw: (side * dir > 0 ? 1 : -1) * Math.PI / 4 });
      }
      arrows++;
    }
  }
  pushInstances(L, rng, head);
  c.note(`U16: stops ${stops.length}, cars ${cars}, arrows ${arrows}`);
}

/** 車止めから車 1 台（carPaint の車体 + carGlass のキャビン + ゴムのタイヤ 4 つ）。区画は車止めの壁と反対の側へ伸びる */
function carAt(c: Ctx, stop: Box): Box[] | null {
  const r = c.rects.find((q) => stop.min[0] >= q.x0 - 0.01 && stop.max[0] <= q.x1 + 0.01 && stop.min[2] >= q.z0 - 0.01 && stop.max[2] <= q.z1 + 0.01) ?? c.rects[0];
  if (!r) return null;
  const sx = stop.max[0] - stop.min[0], sz = stop.max[2] - stop.min[2];
  const alongZ = sx > sz; // 車止めが x に長い → 区画は z 方向
  const cxs = (stop.min[0] + stop.max[0]) / 2, czs = (stop.min[2] + stop.max[2]) / 2;
  const lo = alongZ ? r.z0 : r.x0, hi = alongZ ? r.z1 : r.x1;
  const s0 = alongZ ? czs : cxs;
  const inward = s0 - lo < 1.3 ? 1 : hi - s0 < 1.3 ? -1 : s0 > (lo + hi) / 2 ? 1 : -1;
  const a0 = s0 + inward * 0.25, a1 = s0 + inward * 4.55;
  const mk = (t0: number, t1: number, w0: number, w1: number, y0: number, y1: number, mat: MatId, solid: boolean) =>
    alongZ ? box([cxs + w0, y0, Math.min(t0, t1)], [cxs + w1, y1, Math.max(t0, t1)], mat, solid) : box([Math.min(t0, t1), y0, czs + w0], [Math.max(t0, t1), y1, czs + w1], mat, solid);
  const out: Box[] = [];
  out.push(mk(a0, a1, -0.86, 0.86, 0.3, 0.78, 'carPaint', true));
  out.push(mk(a0 + inward * 1.25, a0 + inward * 3.35, -0.76, 0.76, 0.78, 1.38, 'carGlass', false));
  for (const t of [0.85, 3.55]) for (const w of [-0.86, 0.64]) out.push(mk(a0 + inward * (t - 0.31), a0 + inward * (t + 0.31), w, w + 0.22, 0, 0.62, 'rubber', false));
  out.forEach((b, i) => { b.vehicle = { id: `parking:${cxs}:${czs}`, body: i === 0 }; });
  return out;
}

// ---- U17 終了後の展示会場: 作業灯、床の養生テープの枡と吊り番号札（FakeSignage のブース格子と同じ）、ケーブル、残置物

function u17(c: Ctx): void {
  const { L, rng } = c;
  const r = c.rects[0];
  if (!r) return;
  // 作業灯: トロファーは 3 つに 1 つだけ。点光源も 1/3 に
  setPanels(c, 'lightOff', (_b, k) => k % 3 === 0);
  L.lights = L.lights.filter((_, i) => i % 3 === 0);
  L.palette.ambient = 0x4c4f55;
  // 撤収後のブースの跡（FakeSignage blankNameTags の格子: 長軸に 3.4 m ピッチ、横断 0.28 / 0.72）
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const alongX = w >= d;
  const pitch = 3.4;
  const len = alongX ? w : d;
  const n = Math.max(1, Math.floor((len - 3) / pitch));
  const start = (alongX ? r.x0 : r.z0) + (len - (n - 1) * pitch) / 2;
  const entry = L.sockets.find((s) => s.id === 'entry');
  let tags = 0;
  if (Math.min(w, d) >= 7) {
    [0.28, 0.72].forEach((frac, li) => {
      const cross = alongX ? r.z0 + d * frac : r.x0 + w * frac;
      const facing: Dir = alongX ? (frac < 0.5 ? 0 : 2) : (frac < 0.5 ? 1 : 3);
      const nv = dirVec(facing);
      for (let i = 0; i < n && i < 6; i++) {
        const a = start + i * pitch;
        const cx = alongX ? a : cross, cz = alongX ? cross : a;
        const ox = cx + nv[0] * 0.1, oz = cz + nv[2] * 0.1;
        const hx = alongX ? 1.5 : 1.0, hz = alongX ? 1.0 : 1.5;
        tapeRect(c, ox - hx, oz - hz, ox + hx, oz + hz);
        if (tags < 12) {
          const boardAlongX = facing === 0 || facing === 2;
          const side: Dir = boardAlongX ? 2 : (entry && entry.pos[0] < cx ? 3 : 1);
          hangingBoard(c, cx, cz, Math.min(c.h - 0.6, 2.9), 0.7, 0.18, boardAlongX, `${'AB'[li]}-${i + 1}`, { color: 0x202020, background: 0xf3f0e6 }, side);
          tags++;
        }
      }
    });
  }
  // 三脚の作業灯 2 基（ブース列の間の通路）+ ケーブル
  let lamps = 0;
  for (const frac of [0.32, 0.68]) {
    const a = (alongX ? r.x0 : r.z0) + len * frac;
    const cross = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const face: Dir = alongX ? (frac < 0.5 ? 1 : 3) : (frac < 0.5 ? 0 : 2);
    const spot = findSpot(c, 0.55, 0.55, alongX ? a : cross, alongX ? cross : a, { margin: 0.4, height: 2.2, radius: 6 });
    if (!spot) continue;
    const [x, z] = spot;
    if (workLight(c, x, z, face)) {
      lamps++;
      // ケーブル: 作業灯から近い壁へ L 字
      const f = nearestFace(c, x, z);
      if (f) {
        const [wx, wz] = facePoint(f, f.horizontal ? x : z, 0.1);
        const kx = x + rng.float(-1.5, 1.5);
        L.boxes.push(box([Math.min(x, kx), 0.002, z - 0.02], [Math.max(x, kx) + 0.04, 0.014, z + 0.02], 'rubber', false));
        L.boxes.push(box([kx - 0.02, 0.002, Math.min(z, wz)], [kx + 0.02, 0.014, Math.max(z, wz)], 'rubber', false));
        L.boxes.push(box([Math.min(kx, wx), 0.002, wz - 0.02], [Math.max(kx, wx), 0.014, wz + 0.02], 'rubber', false));
      }
    }
  }
  // 残置物: 壁に立てた白いパネル 3 枚、巻いたカーペット、独立のパーティション
  let leftovers = 0;
  for (const f of rng.shuffle([...c.faces])) {
    if (leftovers >= 2) break;
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.2)) {
      if (a1 - a0 < 3.2 || leftovers >= 2) continue;
      const at = rng.float(a0 + 0.3, a1 - 2.9);
      if (leftovers === 0) {
        const tmp: Box[] = [];
        for (let k = 0; k < 3; k++) tmp.push(alongFace(f, at, 2.4, 0.06 + k * 0.11, 0.11 + k * 0.11, 0.02, 2.22, 'wallWhite', true));
        if (placeUnit(c, tmp)) leftovers++;
      } else if (placeUnit(c, [alongFace(f, at, 3.0, 0.08, 0.48, 0, 0.4, 'carpetPattern', true)])) leftovers++;
    }
  }
  c.note(`U17: tags ${tags}, lamps ${lamps}, leftovers ${leftovers}`);
}

/** 三脚の作業灯（脚 = 台座箔、支柱ソリッド、暖色のヘッド）+ 点光源。face はヘッドが向く方向 */
function workLight(c: Ctx, x: number, z: number, face: Dir): boolean {
  const n = dirVec(face);
  const tmp: Box[] = [
    box([x - 0.03, 0, z - 0.03], [x + 0.03, 1.95, z + 0.03], 'metalDark', true),
    box([x - 0.4, 0, z - 0.4], [x + 0.4, 0.03, z + 0.4], 'metalDark', false),
    box([x - 0.2 + n[0] * 0.1, 1.9, z - 0.2 + n[2] * 0.1], [x + 0.2 + n[0] * 0.1, 2.18, z + 0.2 + n[2] * 0.1], 'metalDark', false),
    box([x - 0.17 + n[0] * 0.31, 1.93, z - 0.17 + n[2] * 0.31], [x + 0.17 + n[0] * 0.31, 2.15, z + 0.17 + n[2] * 0.31], 'lightWarm', false),
  ];
  // ヘッドの前面だけ光る箔にする: 箱を面の方向に薄く
  const head = tmp[3];
  if (n[0] !== 0) { head.min[0] = x + n[0] * 0.3 - (n[0] > 0 ? 0 : 0.02); head.max[0] = x + n[0] * 0.3 + (n[0] > 0 ? 0.02 : 0); }
  else { head.min[2] = z + n[2] * 0.3 - (n[2] > 0 ? 0 : 0.02); head.max[2] = z + n[2] * 0.3 + (n[2] > 0 ? 0.02 : 0); }
  if (!placeUnit(c, tmp, { margin: 0.5 })) return false;
  c.L.lights.push({ pos: [x + n[0] * 0.5, 2.0, z + n[2] * 0.5], color: 0xffd9a0, intensity: 1.1, distance: 12 });
  return true;
}

// ---- U18 反復エレベーター: 籠を木目パネルに、階ボタンは全部「3」、階表示「3」、暖色（「N F」サインは RepeatDestination）

function u18(c: Ctx): void {
  const { L } = c;
  const hw = 3.0; // VerticalGenerator の w = 6
  for (let i = 0; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.mat === 'metal' && b.solid && b.min[0] >= hw - 0.01) {
      if (b.max[1] <= 0.01) L.boxes[i] = { ...b, mat: 'carpetPattern' };
      else if (b.min[1] < 2.29) L.boxes[i] = { ...b, mat: 'woodPanel' };
    } else if (!b.solid && b.mat === 'lightPanel') L.boxes[i] = { ...b, mat: 'lightWarm' };
  }
  tintLights(L, 0xffd9a0);
  L.palette.light = 'lightWarm';
  L.palette.lightColor = 0xffd9a0;
  L.palette.ambient = 0x7a6a58;
  const elev = L.elevators[0];
  if (elev) {
    const bx = elev.button; // [ex1 - 0.03, 1.2, ez1 - 0.4]、面は -X
    const ex1 = bx[0] + 0.03;
    pushSign(L, { text: '3  3  3  3', pos: [ex1 - 0.032, 1.62, bx[2]], dir: 3, width: 0.5, kind: 'plate', color: 0x202020, background: 0xd8d4c8 });
    pushSign(L, { text: '3', pos: [ex1 - 0.012, 2.0, (elev.volume.min[2] + elev.volume.max[2]) / 2], dir: 3, width: 0.3, kind: 'clock' });
  }
  const s = L.sockets.find((q) => q.type === 'elevator');
  if (s) pushSign(L, { text: '3', pos: [s.pos[0] - WALL_T - 0.012, 2.5, s.pos[2]], dir: 3, width: 0.4, kind: 'clock' });
}

// ---- U19 無人キッズスペース: 原色の遊具（ボールプール・トンネル・滑り台・ソフトブロック）、雲の壁画、「みんな なかよく あそぼう」

function u19(c: Ctx): void {
  const { L, rng } = c;
  const r = c.rects[0];
  if (!r) return;
  // 汎用の島（furnitureLight / yellowLine / furnitureDark の低い塊）は外す
  removeInterior(c, (b) => b.solid && (b.mat === 'furnitureLight' || b.mat === 'furnitureDark' || b.mat === 'yellowLine') && b.max[1] - b.min[1] <= 1.2);
  tintLights(L, 0xffd9a0);
  L.palette.lightColor = 0xffd9a0;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const colors: MatId[] = ['plasticRed', 'plasticYellow', 'plasticBlue'];
  // 看板（入口の反対の壁）
  const north = c.faces.filter((f) => f.dir === 0).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0];
  let signAt0 = NaN;
  if (north) {
    const run = freeRuns(north, L.sockets, 0.8).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
    if (run && run[1] - run[0] >= 3) { signAt0 = (run[0] + run[1]) / 2; wallSignAt(c, north, signAt0, Math.min(c.h - 0.5, 2.0), 2.4, 'みんな なかよく あそぼう', { color: 0xd23a34, background: 0xfff3b0 }); }
  }
  // 雲の壁画（whiteFabric の箔 4 枚 = 1 つ）を 4 つまで
  let clouds = 0;
  for (const f of [...c.faces].sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))) {
    if (clouds >= 4) break;
    for (const [a0, a1] of freeRuns(f, L.sockets, 0.6)) {
      if (clouds >= 4 || a1 - a0 < 2.4) continue;
      const t = (a0 + a1) / 2 + rng.float(-0.3, 0.3);
      if (f === north && Math.abs(t - signAt0) < 2.4) continue;
      const y = Math.min(c.h - 0.7, 2.15);
      const B = L.boxes;
      // 白い箔は signPlate（whiteFabric は生成テクスチャの布が暗く、壁画が黒い塊に見えた）
      B.push(alongFace(f, t - 0.9, 1.8, 0.005, 0.03, y - 0.25, y + 0.1, 'signPlate', false));
      B.push(alongFace(f, t - 0.6, 0.55, 0.005, 0.03, y, y + 0.42, 'signPlate', false));
      B.push(alongFace(f, t - 0.05, 0.65, 0.005, 0.03, y, y + 0.55, 'signPlate', false));
      B.push(alongFace(f, t + 0.45, 0.4, 0.005, 0.03, y - 0.1, y + 0.25, 'signPlate', false));
      clouds++;
    }
  }
  // ボールプール（青い枡 + 小球の instances）。置き場は中央に近い順の格子探索
  const pit = 3.2;
  let pitAt: [number, number] | null = null;
  {
    const s = pit / 2;
    const spot = findSpot(c, s + 0.5, s + 0.5, cx + 2.6, cz, { margin: 0.4, height: 0.6 });
    if (spot) {
      const [px, pz] = spot;
      const tmp: Box[] = [
        box([px - s, 0, pz - s], [px + s, 0.55, pz - s + 0.25], 'plasticBlue'), box([px - s, 0, pz + s - 0.25], [px + s, 0.55, pz + s], 'plasticBlue'),
        box([px - s, 0, pz - s + 0.25], [px - s + 0.25, 0.55, pz + s - 0.25], 'plasticBlue'), box([px + s - 0.25, 0, pz - s + 0.25], [px + s, 0.55, pz + s - 0.25], 'plasticBlue'),
        box([px - s + 0.25, 0, pz - s + 0.25], [px + s - 0.25, 0.3, pz + s - 0.25], 'plasticBlue'),
      ];
      if (placeUnit(c, tmp, { margin: 0.4 })) pitAt = [px, pz];
    }
  }
  if (pitAt) {
    const balls = colors.map((m): InstanceSpec => ({ mat: m, size: [0.16, 0.16, 0.16], transforms: [] }));
    const s = pit / 2 - 0.3;
    for (let x = -s + 0.1; x < s - 0.05; x += 0.21) {
      for (let z = -s + 0.1; z < s - 0.05; z += 0.21) {
        const spec = rng.pick(balls);
        spec.transforms.push({ pos: [pitAt[0] + x + rng.float(-0.03, 0.03), 0.3, pitAt[1] + z + rng.float(-0.03, 0.03)], yaw: rng.float(0, Math.PI) });
        if (rng.chance(0.3)) rng.pick(balls).transforms.push({ pos: [pitAt[0] + x + rng.float(-0.06, 0.06), 0.44, pitAt[1] + z + rng.float(-0.06, 0.06)], yaw: rng.float(0, Math.PI) });
      }
    }
    for (const b of balls) pushInstances(L, rng, b);
  }
  // トンネル（黄。内法 0.9 × 0.9 = しゃがんで通れる）
  let tunnel = false;
  for (const alongX of [true, false]) {
    const L2 = 1.3, W = 0.65;
    const hx = alongX ? L2 : W, hz = alongX ? W : L2;
    const spot = findSpot(c, hx + 0.5, hz + 0.5, cx - 3.5, cz + 2.5, { margin: 0.4, height: 1.2 });
    if (!spot) continue;
    const [tx, tz] = spot;
    const tmp: Box[] = alongX
      ? [box([tx - hx, 0, tz - hz], [tx + hx, 1.1, tz - hz + 0.2], 'plasticYellow'), box([tx - hx, 0, tz + hz - 0.2], [tx + hx, 1.1, tz + hz], 'plasticYellow'), box([tx - hx, 0.9, tz - hz], [tx + hx, 1.1, tz + hz], 'plasticYellow')]
      : [box([tx - hx, 0, tz - hz], [tx - hx + 0.2, 1.1, tz + hz], 'plasticYellow'), box([tx + hx - 0.2, 0, tz - hz], [tx + hx, 1.1, tz + hz], 'plasticYellow'), box([tx - hx, 0.9, tz - hz], [tx + hx, 1.1, tz + hz], 'plasticYellow')];
    if (placeUnit(c, tmp, { margin: 0.4 })) { tunnel = true; break; }
  }
  // 滑り台（赤い台 + 青い段状の滑り面 + 黄色の段）: x 方向に 4.6 m
  let slide = false;
  {
    const spot = findSpot(c, 2.4 + 0.5, 0.6 + 0.5, cx + 2.5, cz - 3.2, { margin: 0.4, height: 1.1 });
    if (spot) {
      const dir = rng.chance(0.5) ? 1 : -1;
      const sx = spot[0] - dir * 0.6, sz = spot[1];
      const tmp: Box[] = [box([sx - 0.6, 0, sz - 0.6], [sx + 0.6, 1.0, sz + 0.6], 'plasticRed')];
      for (let k = 0; k < 3; k++) {
        const a0 = sx + dir * (0.6 + k * 0.6), a1 = sx + dir * (1.2 + k * 0.6);
        tmp.push(box([Math.min(a0, a1), 0, sz - 0.35], [Math.max(a0, a1), 0.75 - k * 0.25, sz + 0.35], 'plasticBlue'));
      }
      for (let k = 0; k < 2; k++) {
        const a0 = sx - dir * (0.6 + k * 0.4), a1 = sx - dir * (1.0 + k * 0.4);
        tmp.push(box([Math.min(a0, a1), 0, sz - 0.4], [Math.max(a0, a1), 0.66 - k * 0.33, sz + 0.4], 'plasticYellow'));
      }
      if (placeUnit(c, tmp, { margin: 0.4 })) slide = true;
    }
  }
  // ソフトブロック 8 個（2 か所に固めて、一部は積む）
  let blocks = 0;
  for (const [gx, gz] of [[cx + 1.2, cz - 2.2], [cx - 1.5, cz + 2.4], [cx - 4, cz], [cx + 4.5, cz + 0.5]] as [number, number][]) {
    for (let k = 0; k < 4 && blocks < 8; k++) {
      const s = rng.float(0.5, 0.7);
      const x = gx + rng.float(-0.9, 0.9), z = gz + rng.float(-0.9, 0.9);
      const m = colors[(blocks + k) % 3];
      const tmp: Box[] = [box([x - s / 2, 0, z - s / 2], [x + s / 2, s, z + s / 2], m)];
      if (rng.chance(0.4)) tmp.push(box([x - s / 2 + 0.08, s, z - s / 2 + 0.08], [x + s / 2 - 0.08, s + s - 0.16, z + s / 2 - 0.08], colors[(blocks + k + 1) % 3]));
      if (placeUnit(c, tmp, { margin: 0.4 })) blocks++;
    }
  }
  c.note(`U19: pit ${!!pitAt}, tunnel ${tunnel}, slide ${slide}, blocks ${blocks}, clouds ${clouds}`);
}

// ---- U20 屋内モーテル中庭: 2 層のバルコニーと客室扉の列、ヤシの木、プールと噴水、寝椅子、暖色の壁灯（空は FakeSky）

function u20(c: Ctx): void {
  const { L, rng } = c;
  const main = c.rects[0];
  if (!main) return;
  // 受付島と中二階の帯（3.4〜3.6）は外す（バルコニーが階を定義する）
  removeInterior(c, (b) => (b.solid && b.mat === 'furnitureLight' && Math.abs(b.max[1] - 1.1) < 0.01 && b.max[0] - b.min[0] > 4) || (!b.solid && b.mat === 'trim' && b.min[1] > 3 && b.max[1] - b.min[1] < 0.3 && b.max[0] - b.min[0] > 4));
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid && b.mat === L.palette.light && b.max[1] < c.h - 1) L.boxes[i] = { ...b, mat: 'lightWarm' };
  }
  tintLights(L, 0xffc98a);
  L.palette.lightColor = 0xffc98a;
  const levels = c.h >= 7.8 ? [3.0, 5.6] : [3.0];
  // 反復物は instances: 扉板・枡・窓・手すり支柱。壁灯（焼き込みの面光源）だけ箔
  const posts: InstanceSpec = { mat: 'metalDark', size: [0.05, 0.98, 0.05], transforms: [] };
  const doorFoil: InstanceSpec = { mat: 'doorWood', size: [0.9, 2.04, 0.03], transforms: [] };
  const doorFrame: InstanceSpec = { mat: 'trim', size: [1.03, 2.115, 0.05], transforms: [] };
  const lever: InstanceSpec = { mat: 'metal', size: [0.11, 0.03, 0.05], transforms: [] };
  const winLit: InstanceSpec = { mat: 'windowLit', size: [0.8, 1.0, 0.03], transforms: [] };
  const winDark: InstanceSpec = { mat: 'windowDark', size: [0.8, 1.0, 0.03], transforms: [] };
  let doorNo = 1;
  let doors = 0, sconces = 0;
  const motelDoor = (f: FaceR, t: number, lv: number, floorNo: number) => {
    const yaw = f.horizontal ? 0 : Math.PI / 2;
    const rs = f.horizontal ? f.inward : -f.inward; // 見る人の右手
    const put = (spec: InstanceSpec, at: number, out: number, y: number) => {
      const [x, z] = facePoint(f, at, out);
      spec.transforms.push({ pos: [x, y, z], yaw });
    };
    put(doorFrame, t, 0.025, lv);
    put(doorFoil, t, 0.065, lv + 0.01);
    put(lever, t + rs * 0.34, 0.105, lv + 0.99);
    put(rng.chance(0.35) ? winLit : winDark, t + rs * 1.52, 0.035, lv + 1.0);
    if (doors % 3 === 0 && sconces < 16) { sconce(c, f, t - rs * 0.78, lv + 1.62); sconces++; } // 壁灯は 3 枡に 1 つ・最大 16（焼き込みの面光源の数 = 構築時間）
    if (doors < 18) wallSignAt(c, f, t, lv + 2.28, 0.32, String(floorNo * 100 + (doorNo++ % 100)), { offset: 0.06 });
    doors++;
  };
  for (const f of c.faces) {
    if (f.a1 - f.a0 < 4) continue;
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.2)) for (const t of pitchAlong(a0, a1, 3.8, 1.1)) motelDoor(f, t, 0, 1);
    levels.forEach((lv, li) => {
      const len = f.a1 - f.a0 - 0.04;
      L.boxes.push(alongFace(f, f.a0 + 0.02, len, 0, 1.7, lv - 0.28, lv, 'floorConcrete', true));
      L.boxes.push(alongFace(f, f.a0 + 0.02, len, 1.62, 1.72, lv + 0.98, lv + 1.06, 'handrailWood', false));
      L.boxes.push(alongFace(f, f.a0 + 0.02, len, 1.66, 1.69, lv + 0.5, lv + 0.53, 'metalDark', false));
      for (const t of pitchAlong(f.a0 + 0.1, f.a1 - 0.1, 1.2, 0.05)) {
        const [x, z] = facePoint(f, t, 1.67);
        posts.transforms.push({ pos: [x, lv, z], yaw: 0 });
      }
      for (const t of pitchAlong(f.a0, f.a1, 3.8, 1.1)) motelDoor(f, t, lv, li + 2);
    });
  }
  for (const s of [posts, doorFrame, doorFoil, lever, winLit, winDark]) pushInstances(L, rng, s);
  // プール（縁石 + 青い底 + 浅水 + 噴水）: 中庭の奥寄りから置き場を探す
  const w = main.x1 - main.x0, d = main.z1 - main.z0;
  const pw = Math.min(7, Math.max(4, w * 0.25)), pd = Math.min(4.5, Math.max(3, d * 0.18));
  let poolAt: [number, number] | null = null;
  const spot = findSpot(c, pw / 2 + 1.0, pd / 2 + 1.0, (main.x0 + main.x1) / 2, main.z0 + d * 0.55, { margin: 0.6, height: 1.0, step: 0.5 });
  if (spot) {
    const [px, pz] = spot;
    const x0 = px - pw / 2, x1 = px + pw / 2, z0 = pz - pd / 2, z1 = pz + pd / 2;
    const tmp: Box[] = [
      box([x0, 0, z0], [x1, 0.32, z0 + 0.3], 'marbleFloor'), box([x0, 0, z1 - 0.3], [x1, 0.32, z1], 'marbleFloor'),
      box([x0, 0, z0 + 0.3], [x0 + 0.3, 0.32, z1 - 0.3], 'marbleFloor'), box([x1 - 0.3, 0, z0 + 0.3], [x1, 0.32, z1 - 0.3], 'marbleFloor'),
      box([x0 + 0.3, 0.004, z0 + 0.3], [x1 - 0.3, 0.012, z1 - 0.3], 'plasticBlue', false),
      box([x0 + 0.3, 0.2, z0 + 0.3], [x1 - 0.3, 0.24, z1 - 0.3], 'waterShallow', false),
      box([px - 0.35, 0.24, pz - 0.35], [px + 0.35, 0.95, pz + 0.35], 'marbleFloor'),
      box([px - 0.5, 0.95, pz - 0.5], [px + 0.5, 1.02, pz + 0.5], 'stainless', false),
      box([px - 0.04, 1.0, pz - 0.04], [px + 0.04, 2.3, pz + 0.04], 'waterShallow', false),
      box([px - 0.16, 1.0, pz - 0.03], [px + 0.16, 1.9, pz + 0.03], 'waterShallow', false),
      box([px - 0.03, 1.0, pz - 0.16], [px + 0.03, 1.9, pz + 0.16], 'waterShallow', false),
    ];
    if (placeUnit(c, tmp, { margin: 0.5 })) {
      poolAt = [px, pz];
      (L.zones ??= []).push({ kind: 'water', aabb: { min: [x0 + 0.3, -0.2, z0 + 0.3], max: [x1 - 0.3, 1.0, z1 - 0.3] }, params: { slow: 0.6, depth: 0.2 } });
    }
  }
  // ヤシの木（プールの周り、無ければ中央付近）と寝椅子（instances、ソリッド）
  let palms = 0;
  const [qx, qz] = poolAt ?? [(main.x0 + main.x1) / 2, main.z0 + d * 0.5];
  const fronds: InstanceSpec = { mat: 'plant', size: [2.6, 0.12, 0.6], transforms: [] };
  for (const [dx, dz] of rng.shuffle<[number, number]>([[-pw / 2 - 1.6, -pd / 2 - 1.2], [pw / 2 + 1.6, -pd / 2 - 1.2], [-pw / 2 - 1.6, pd / 2 + 1.2], [pw / 2 + 1.6, pd / 2 + 1.2], [0, pd / 2 + 2.6], [0, -pd / 2 - 2.6]])) {
    if (palms >= 4) break;
    if (palm(c, qx + dx, qz + dz, fronds)) palms++;
  }
  pushInstances(L, rng, fronds);
  const seat: InstanceSpec = { mat: 'signPlate', size: [0.65, 0.3, 1.7], transforms: [], solid: true };
  const backrest: InstanceSpec = { mat: 'signPlate', size: [0.65, 0.5, 0.08], transforms: [], solid: true };
  if (poolAt) {
    for (const [dx, yaw] of [[-1.0, Math.PI], [0, Math.PI], [1.0, Math.PI], [-1.0, 0], [0, 0], [1.0, 0]] as [number, number][]) {
      const sx = poolAt[0] + dx * 1.2, sz = poolAt[1] + (yaw === 0 ? -1 : 1) * (pd / 2 + 1.4);
      const fp = box([sx - 0.33, 0, sz - 0.85], [sx + 0.33, 0.3, sz + 0.85], 'signPlate');
      if (hitsZone(c.zones, fp) || laneHit(c.lanes, fp) || solidHit(c, fp) || !insideRects(c.rects, fp, 0.3)) continue;
      seat.transforms.push({ pos: [sx, 0, sz], yaw });
      backrest.transforms.push({ pos: [sx, 0.3, sz + (yaw === 0 ? -0.81 : 0.81)], yaw });
    }
  }
  pushInstances(L, rng, seat);
  pushInstances(L, rng, backrest);
  // サイン: POOL（赤いネオン風）
  const south = c.faces.filter((f) => f.dir === 2).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0];
  if (south) {
    const run = freeRuns(south, L.sockets, 1.0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
    if (run && run[1] - run[0] > 2) wallSignAt(c, south, (run[0] + run[1]) / 2, Math.min(c.h - 0.5, 2.55), 1.0, 'POOL', { kind: 'emissive', color: 0xff6a5a, background: 0x1a0c0c, offset: 0.09 });
  }
  c.note(`U20: levels ${levels.length}, doors ${doors}, sconces ${sconces}, pool ${!!poolAt}, palms ${palms}`);
}

/** ヤシの木: 少しずらして積んだ幹（ソリッド）+ 8 方向の葉（instances、fronds に追加）+ 中心の葉の塊 */
function palm(c: Ctx, x: number, z: number, fronds: InstanceSpec): boolean {
  const tmp: Box[] = [];
  const lean = c.rng.float(-0.06, 0.06);
  const lz = c.rng.float(-0.06, 0.06);
  for (let k = 0; k < 4; k++) {
    const w = 0.34 - k * 0.03;
    const ox = lean * k, oz = lz * k;
    tmp.push(box([x + ox - w / 2, k * 1.1, z + oz - w / 2], [x + ox + w / 2, (k + 1) * 1.1, z + oz + w / 2], 'bookshelfWood', k === 0));
  }
  if (!placeUnit(c, tmp, { margin: 0.6 })) return false;
  const tx = x + lean * 3.5, tz = z + lz * 3.5;
  c.L.boxes.push(box([tx - 0.45, 4.2, tz - 0.45], [tx + 0.45, 4.8, tz + 0.45], 'plant', false));
  for (let k = 0; k < 8; k++) fronds.transforms.push({ pos: [tx, 4.3 + (k % 2) * 0.18, tz], yaw: (k * Math.PI) / 4 + c.rng.float(-0.1, 0.1) });
  return true;
}
