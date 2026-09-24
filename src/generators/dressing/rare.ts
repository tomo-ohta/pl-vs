/**
 * Rare の部屋別ドレッシング（担当 R）。定義 ID で分岐し、参考画像の要点（docs/reference-rarities-analysis.md の RARE の表）を
 * 「その部屋らしさを決める 1〜3 の大物 + サイン + 光の色・配置」として Generator の出力に足す。実装の記録は docs/reference-rare.md。
 *
 * 約束（dressing/index.ts と共通）:
 *  - 乱数は渡された rng（p.rng.fork('dress')）だけ。footprint・ソケット・扉前 1.8 m（doorZones）・動線 1.2 m（入口→各出口の直線帯）は変えない。
 *  - 予算: 箱 +300 / 三角形 +40k / ライト +2。反復物は L.instances（Tier の instanceScale で間引かれるので、通り抜けを防ぐ構造材は L.boxes に置く）。
 *  - 新しい MatId は使わない。他ファイルは編集しない。
 *  - Modifier はこの後に走る。R02（LightingPhase unpowered）/ R03（PropRepetition banquetTable）/ R09（PastWindow のスクリーン箔）/
 *    R13（ScaleAnomaly room）/ R16（ScaleAnomaly perProp）/ R20（PropRepetition storageDoor + DuplicateNumber）は各関数の注記どおりに干渉を避ける。
 */
import type { Rng } from '../../core/rng';
import type { AABB } from '../../core/aabb';
import { dirVec, type Dir, type Socket, type Vec3 } from '../../core/types';
import { box, WALL_T, type Box, type GenParams, type InstanceSpec, type MatId, type RoomLayout, type SignSpec } from '../layout';
import { inner, type Rect } from '../footprint';
import { alongFace, doorZones, freeRuns, hitsZone, innerFaces, insideRects, signAt, signOnWall, type Face } from '../furniture';
import { boxesOverlap, wallBands } from '../common';
import { EXHIBIT_CAPTIONS, EXHIBIT_KINDS, EXHIBIT_SIZE, type ExhibitKind } from '../exhibits';

/** 1 InstanceSpec あたりの上限（暴走防止。Tier 間引きは RoomBuilder 側） */
const MAX_INST = 3000;
/** 追加ライトの上限（部屋あたり） */
const LIGHT_BUDGET = 2;
/** L.signs の上限（RoomBuilder は 48 枚。後続の Modifier の分を残す） */
const SIGN_CAP = 44;
/** 天井パネル灯として扱う材質 */
const PANEL_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm', 'lightOff', 'lightGreen', 'lightYellow', 'ledBlue']);

/** 開発用: `?nodress=1` でドレッシングを外す（構築時間・見た目の比較用。URL はセッション中に変わらないので決定論は保たれる） */
const DISABLED = typeof window !== 'undefined' && typeof window.location !== 'undefined' && new URLSearchParams(window.location.search).has('nodress');

export function dressRare(L: RoomLayout, p: GenParams, rng: Rng): void {
  if (DISABLED) return;
  const c = ctxOf(L, p, rng);
  switch (p.def.id) {
    case 'R01': return dressR01(c);
    case 'R02': return dressR02(c);
    case 'R03': return dressR03(c);
    case 'R04': return dressR04(c);
    case 'R05': return dressR05(c);
    case 'R06': return dressR06(c);
    case 'R07': return dressR07(c);
    case 'R08': return dressR08(c);
    case 'R09': return dressR09(c);
    case 'R10': return dressR10(c);
    case 'R11': return dressR11(c);
    case 'R12': return dressR12(c);
    case 'R13': return dressR13(c);
    case 'R14': return dressR14(c);
    case 'R15': return dressR15(c);
    case 'R16': return dressR16(c);
    case 'R17': return dressR17(c);
    case 'R18': return dressR18(c);
    case 'R19': return dressR19(c);
    case 'R20': return dressR20(c);
    default: return;
  }
}

// ---------------------------------------------------------------- 共通ヘルパ

interface Lane { a: [number, number]; b: [number, number] }

interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  rects: Rect[];
  h: number;
  sockets: Socket[];
  /** 扉前 1.8 m × 幅（+0.1）と床穴・着地点 */
  zones: AABB[];
  /** 入口 → 各出口の直線帯（半幅 0.6） */
  lanes: Lane[];
  /** シェルの末尾（内装の先頭） */
  start: number;
  lights0: number;
}

function ctxOf(L: RoomLayout, p: GenParams, rng: Rng): Ctx {
  const rects = L.footprint.length ? L.footprint : [{ x0: L.bounds.min[0], z0: L.bounds.min[2], x1: L.bounds.max[0], z1: L.bounds.max[2] }];
  return { L, p, rng, rects, h: L.height, sockets: L.sockets, zones: doorZones(L.sockets, null, 0.1), lanes: lanesOf(L.sockets), start: L.shellCount ?? 0, lights0: L.lights.length };
}

function lanesOf(sockets: Socket[]): Lane[] {
  const entry = sockets.find((s) => s.id === 'entry') ?? sockets[0];
  if (!entry) return [];
  return sockets.filter((s) => s !== entry).map((s) => ({ a: [entry.pos[0], entry.pos[2]] as [number, number], b: [s.pos[0], s.pos[2]] as [number, number] }));
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

/** 線分と XZ 矩形の 2D 距離（交差・内包なら 0）。PropRepetition.shared と同じ判定 */
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

/** core/aabb.aabbOverlap と同じ eps 付きの重なり判定 */
function overlapEps(a: AABB, b: AABB, eps: number): boolean {
  return a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps && a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps && a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
}

function laneHit(lanes: Lane[], b: AABB, half = 0.6, margin = 0.1): boolean {
  return lanes.some((l) => segRectDist(l.a, l.b, b.min[0], b.min[2], b.max[0], b.max[2]) < half + margin);
}

/** 追加候補 b が置けるか: 足跡内（margin）・扉前ゾーン外・動線帯外・既存のソリッド内装と重ならない */
function canPlace(c: Ctx, b: Box, o: { margin?: number; gap?: number; lanes?: boolean; ignore?: (q: Box) => boolean; zones?: AABB[] } = {}): boolean {
  if (!insideRects(c.rects, b, o.margin ?? WALL_T + 0.02)) return false;
  if (hitsZone(o.zones ?? c.zones, b)) return false;
  if ((o.lanes ?? true) && laneHit(c.lanes, b)) return false;
  const gap = o.gap ?? 0.05;
  for (let i = c.start; i < c.L.boxes.length; i++) {
    const q = c.L.boxes[i];
    if (q.solid && !(o.ignore && o.ignore(q)) && boxesOverlap(q, b, gap)) return false;
  }
  return true;
}

function interior(L: RoomLayout): Box[] {
  return L.boxes.slice(L.shellCount ?? 0);
}

/** シェル以降の箱から pred に合うものを取り除く（shellCount より前は触らない） */
function removeInterior(L: RoomLayout, pred: (b: Box) => boolean): number {
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

function isPanel(b: Box, h: number): boolean {
  return !b.solid && PANEL_MATS.has(b.mat) && b.max[1] - b.min[1] < 0.12 && b.max[1] > h - 0.3;
}

/** 天井パネル灯の材質を差し替える（消灯 lightOff は from が lightOff のときだけ変える） */
function recolorPanels(L: RoomLayout, to: MatId, keepOff = true): void {
  const h = L.height;
  for (let i = L.shellCount ?? 0; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!isPanel(b, h)) continue;
    if (keepOff && b.mat === 'lightOff') continue;
    L.boxes[i] = { ...b, mat: to };
  }
}

/** 外殻（床・壁・天井）の材質差し替え。パレットも同じ材質に */
function recolorShell(L: RoomLayout, m: { floor?: MatId; wall?: MatId; ceiling?: MatId }): void {
  const n = L.shellCount ?? L.boxes.length;
  const pal = L.palette;
  for (let i = 0; i < n; i++) {
    const b = L.boxes[i];
    if (m.floor && b.mat === pal.floor) L.boxes[i] = { ...b, mat: m.floor };
    else if (m.wall && b.mat === pal.wall) L.boxes[i] = { ...b, mat: m.wall };
    else if (m.ceiling && b.mat === pal.ceiling) L.boxes[i] = { ...b, mat: m.ceiling };
  }
  L.palette = { ...pal, ...(m.floor ? { floor: m.floor } : {}), ...(m.wall ? { wall: m.wall } : {}), ...(m.ceiling ? { ceiling: m.ceiling } : {}) };
}

function addLight(c: Ctx, pos: Vec3, color: number, intensity: number, distance: number): boolean {
  if (c.L.lights.length - c.lights0 >= LIGHT_BUDGET) return false;
  c.L.lights.push({ pos, color, intensity, distance });
  return true;
}

function pushSign(L: RoomLayout, s: SignSpec): boolean {
  L.signs ??= [];
  if (L.signs.length >= SIGN_CAP) return false;
  L.signs.push(s);
  return true;
}

function spec(mat: MatId, size: Vec3, solid = false): InstanceSpec {
  return { mat, size, transforms: [], solid };
}

function put(s: InstanceSpec, pos: Vec3, yaw = 0, scale?: number): void {
  if (s.transforms.length >= MAX_INST) return;
  s.transforms.push(scale !== undefined && scale !== 1 ? { pos, yaw, scale } : { pos, yaw });
}

function commit(L: RoomLayout, ...specs: InstanceSpec[]): void {
  for (const s of specs) if (s.transforms.length) (L.instances ??= []).push(s);
}

/** Modifier の params（rooms.json） */
function modParams(p: GenParams, id: string): Record<string, unknown> {
  return (p.def.modifiers.find((m) => m.id === id)?.params as Record<string, unknown> | undefined) ?? {};
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function yawOfDir(d: Dir): number {
  return (d * Math.PI) / 2;
}

/** 面 f 上の位置 at・面からの距離 d・高さ y の点 */
function onFace(f: Face, at: number, d: number, y: number): Vec3 {
  return f.horizontal ? [at, y, f.face + f.inward * d] : [f.face + f.inward * d, y, at];
}

/** 面が向く方向（室内側） */
function facing(f: Face): Dir {
  return ((f.dir + 2) % 4) as Dir;
}

function faceLen(f: Face): number {
  return f.a1 - f.a0;
}

function entryOf(L: RoomLayout): Socket | undefined {
  return L.sockets.find((s) => s.id === 'entry');
}

function dist2(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

/** footprint の矩形列を入口から順にたどった進行方向（0 = +Z、1 = +X …）。EraPreset.pathSegments と同じ規則 */
function headings(rects: Rect[]): Dir[] {
  const out: Dir[] = [];
  const eps = 0.05;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    let d: Dir = 0;
    if (i > 0) {
      const prev = rects[i - 1];
      if (Math.abs(prev.x1 - r.x0) < eps) d = 1;
      else if (Math.abs(prev.x0 - r.x1) < eps) d = 3;
      else if (Math.abs(prev.z1 - r.z0) < eps) d = 0;
      else if (Math.abs(prev.z0 - r.z1) < eps) d = 2;
      else d = r.x1 - r.x0 > r.z1 - r.z0 ? 1 : 0;
    }
    out.push(d);
  }
  return out;
}

/** 面が属する矩形（内面座標で照合） */
function rectOfFace(rects: Rect[], f: Face): Rect | null {
  for (const r of rects) {
    const on = f.horizontal ? Math.abs(f.coord - r.z0) < 0.01 || Math.abs(f.coord - r.z1) < 0.01 : Math.abs(f.coord - r.x0) < 0.01 || Math.abs(f.coord - r.x1) < 0.01;
    if (on && f.a0 >= (f.horizontal ? r.x0 : r.z0) - 0.01 && f.a1 <= (f.horizontal ? r.x1 : r.z1) + 0.01) return r;
  }
  return null;
}

/** 段状のアーチ（柱 2 本の上に 3 段の箔で丸みを近似）。r の短辺方向に渡す。at は長軸方向の位置 */
function steppedArch(c: Ctx, r: Rect, alongZ: boolean, at: number, mat: MatId, pillarMat: MatId, pillar: boolean, ignore?: (q: Box) => boolean): { center: Vec3; ok: boolean } {
  const { L, h } = c;
  const lo = (alongZ ? r.x0 : r.z0) + WALL_T;
  const hi = (alongZ ? r.x1 : r.z1) - WALL_T;
  const W = hi - lo;
  const t = 0.4;
  const mk = (s0: number, s1: number, y0: number, y1: number, m: MatId, solid: boolean): Box =>
    alongZ ? box([s0, y0, at - t / 2], [s1, y1, at + t / 2], m, solid) : box([at - t / 2, y0, s0], [at + t / 2, y1, s1], m, solid);
  let ok = false;
  if (pillar) {
    for (const side of [0, 1]) {
      const s0 = side === 0 ? lo : hi - 0.35;
      const pb = mk(s0, s0 + 0.35, 0, h, pillarMat, true);
      if (canPlace(c, pb, { lanes: false, margin: WALL_T - 0.001, ignore })) { L.boxes.push(pb); ok = true; }
    }
  }
  const step2 = Math.max(0.35, W * 0.22);
  const step3 = Math.max(0.35, W * 0.09);
  L.boxes.push(mk(lo, hi, h - 0.32, h, mat, false));
  L.boxes.push(mk(lo, lo + step2, h - 0.62, h - 0.32, mat, false), mk(hi - step2, hi, h - 0.62, h - 0.32, mat, false));
  L.boxes.push(mk(lo, lo + step3, h - 0.95, h - 0.62, mat, false), mk(hi - step3, hi, h - 0.95, h - 0.62, mat, false));
  const center: Vec3 = alongZ ? [(lo + hi) / 2, h - 0.5, at] : [at, h - 0.5, (lo + hi) / 2];
  return { center, ok };
}

// ---------------------------------------------------------------- R01 浅水タイル回廊（PoolGenerator + ShallowWater）
/** 等間隔の白タイルのアーチ（柱 + 段状の梁）を各セグメントに渡し、アーチの下に暖色の小さな灯。器具・点光源も暖色に */
function dressR01(c: Ctx): void {
  const { L, h } = c;
  recolorPanels(L, 'lightWarm');
  for (const l of L.lights) l.color = 0xffd9a0;
  const pitch = 3.6;
  let lit = 0;
  // デッキ（floorTile の低いソリッド）に柱が載るのは許す
  const deck = (q: Box) => q.mat === 'floorTile' && q.max[1] < 0.5;
  for (const r of c.rects) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const alongZ = d >= w;
    const len = alongZ ? d : w;
    const n = Math.max(1, Math.floor((len - 1.2) / pitch));
    const start = (alongZ ? r.z0 : r.x0) + (len - (n - 1) * pitch) / 2;
    for (let k = 0; k < n; k++) {
      const a = start + k * pitch;
      const { center } = steppedArch(c, r, alongZ, a, 'floorTile', 'floorTile', true, deck);
      // アーチ下の暖色の灯（下向きの面光源として焼き込まれる）
      L.boxes.push(box([center[0] - 0.22, h - 0.37, center[2] - 0.15], [center[0] + 0.22, h - 0.32, center[2] + 0.15], 'lightWarm', false));
      if (lit < LIGHT_BUDGET && addLight(c, [center[0], h - 0.7, center[2]], 0xffcf8a, 0.8, 7)) lit++;
    }
  }
}

// ---------------------------------------------------------------- R02 無電源アーケード（GridGenerator RetailGrid + LightingPhase unpowered）
/**
 * 棚（shelfMetal のスラブ）を背中合わせの筐体列に置き換える: 暗い筐体（screenDark、ソリッド instances）+ 前面の画面と看板
 * （screenGlow / neonRed / neonBlue の箔）。器具の消灯・点光源の付け直しは LightingPhase(unpowered) が行う
 * （画面箔は薄いので Modifier の筐体候補にはならず、候補が無いので壁沿いに 6 台の筐体と青い点光源を Modifier 側が足す）。
 */
function dressR02(c: Ctx): void {
  const { L, rng } = c;
  const slabs = interior(L).filter((b) => b.solid && b.mat === 'shelfMetal' && b.max[1] - b.min[1] >= 1.3 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 0.5);
  if (slabs.length === 0) return;
  const overlapsSlab = (b: Box) => slabs.some((s) => b.min[0] < s.max[0] + 0.1 && b.max[0] > s.min[0] - 0.1 && b.min[2] < s.max[2] + 0.1 && b.max[2] > s.min[2] - 0.1);
  removeInterior(L, (b) => slabs.includes(b) || (!b.solid && b.mat === 'furnitureLight' && b.min[1] > 0.1 && overlapsSlab(b)));
  // 筐体 1 台（本体・傾いた画面・看板・操作盤・コイン扉）はコード生成の家電（shape 'arcade'。正面 = 局所 +z）。画面と看板の色（accent）ごとに 1 つ
  // 画面はゲーム画面の絵 8 種（screen 0..7。台ごとの選択は位置のハッシュ）、看板の色は絵ごとに固定（spec を 8 つに抑える）
  const marquee: MatId[] = ['screenGlow', 'neonRed', 'neonBlue'];
  const cabinets: InstanceSpec[] = Array.from({ length: 8 }, (_, n) => ({ ...spec('screenDark', [0.72, 1.8, 0.7], true), shape: 'arcade', accent: marquee[n % 3], screen: n }));
  const cabinetAt = (p: Vec3) => {
    let h = (Math.round(p[0] * 100) * 73856093) ^ (Math.round(p[2] * 100) * 19349663);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return cabinets[Math.floor((((h ^ (h >>> 15)) >>> 0) / 4294967296) * cabinets.length)];
  };
  const mats = ['screenGlow', 'neonRed', 'neonBlue', 'neonBlue', 'screenGlow'];
  let count = 0;
  for (const s of slabs) {
    if (count >= 240) break;
    const alongX = s.max[0] - s.min[0] >= s.max[2] - s.min[2];
    const a0 = alongX ? s.min[0] : s.min[2];
    const a1 = alongX ? s.max[0] : s.max[2];
    const cc = alongX ? (s.min[2] + s.max[2]) / 2 : (s.min[0] + s.max[0]) / 2;
    const bays = Math.max(1, Math.floor((a1 - a0) / 0.78));
    const bay = (a1 - a0) / bays;
    for (let k = 0; k < bays; k++) {
      const a = a0 + bay * (k + 0.5);
      for (const side of [-1, 1] as const) {
        if (count >= 240) break;
        const bc = cc + side * 0.36;
        const pos = (across: number, y: number): Vec3 => (alongX ? [a, y, across] : [across, y, a]);
        const fp: Box = alongX ? box([a - 0.36, 0, bc - 0.35], [a + 0.36, 1.8, bc + 0.35], 'screenDark') : box([bc - 0.35, 0, a - 0.36], [bc + 0.35, 1.8, a + 0.36], 'screenDark');
        if (hitsZone(c.zones, fp)) continue;
        const m = rng.pick(mats);
        void (rng.chance(0.7) ? m : rng.pick(mats)); // 旧: 画面・看板の色の抽選（乱数列を以前と揃えるため引くだけ。色は画面の絵で決まる）
        // 正面 = 通路側（side の向き）。alongX なら ±z、そうでなければ ±x
        const facing = alongX ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2;
        put(cabinetAt(pos(bc, 0)), pos(bc, 0), facing);
        count++;
      }
    }
  }
  commit(L, ...cabinets);
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.3) };
  signOnWall(L, innerFaces(c.rects), c.sockets, 'GAME CENTER', { y: Math.min(c.h - 0.5, 2.4), width: 2.0, prefer: [0, 1, 3], kind: 'emissive', color: 0xff5a68, background: 0x140a12 });
}

// ---------------------------------------------------------------- R03 無限宴会場（RoomGenerator LargeRoom + PropRepetition banquetTable + FogDepth）
/**
 * 丸卓（白クロス = whiteFabric の箱を 45° ずらして重ねた八角形近似 + 天板）と赤い椅子 6 脚を格子に、天井パネルをシャンデリア
 * （goldTrim の環 + lightWarm の蝋燭の束 + 下向きの暖色の灯）に、床を赤い模様カーペットに。
 * PropRepetition(banquetTable) は後で「家具材質の内装を捨てて 3.2 m 格子の空きセルに角卓を置く」ので、格子の計算（margin 1.2、
 * pitch max(2.6, 3.2/density)、位相 0 と 1）をここで同じ規則で先に埋め、卓の当たり判定は L.boxes のソリッド（whiteFabric）にして
 * Modifier の overlapsSolid に見えるようにする（FURNITURE_MATS に含まれない材質だけを使う）。
 */
function dressR03(c: Ctx): void {
  const { L, h } = c;
  removeInterior(L, (b) => !isPanel(b, h) && b.mat !== 'columnConcrete');
  recolorShell(L, { floor: 'carpetPattern' });
  wallBands(L, c.rects, c.sockets, [{ y0: 0, y1: 0.9, mat: 'woodPanel', depth: 0.012 }, { y0: 0.9, y1: 0.94, mat: 'goldTrim', depth: 0.03 }]);

  // ---- 格子（PropRepetition.gridCells と同じ座標）
  const prm = modParams(c.p, 'PropRepetition');
  const density = Math.min(3, Math.max(0.25, num(prm.density, 1)));
  const scale = Math.min(3, Math.max(0.5, num(prm.scale, 1)));
  const pitch = Math.max(2.6 * scale, (3.2 * scale) / density);
  const tableW = 1.6 * scale;
  const half = tableW / 2 + 0.55 * scale;
  const cells: { cx: number; cz: number }[] = [];
  for (const phase of [0, 1] as const) {
    for (const r of c.rects) {
      const ir = inner(r, WALL_T + 1.2);
      const w = ir.x1 - ir.x0 - (phase ? pitch : 0);
      const d = ir.z1 - ir.z0 - (phase ? pitch : 0);
      const nx = Math.floor(w / pitch);
      const nz = Math.floor(d / pitch);
      if (nx < 1 || nz < 1) continue;
      const ox = ir.x0 + (phase ? pitch / 2 : 0) + (w - nx * pitch) / 2 + pitch / 2;
      const oz = ir.z0 + (phase ? pitch / 2 : 0) + (d - nz * pitch) / 2 + pitch / 2;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) cells.push({ cx: ox + ix * pitch, cz: oz + iz * pitch });
    }
  }
  const modZones = modDoorZones(L);
  const cloth = spec('whiteFabric', [1.5 * scale, 0.74, 1.5 * scale]);
  const top0 = spec('whiteFabric', [1.62 * scale, 0.03, 1.62 * scale]);
  const top1 = spec('whiteFabric', [1.62 * scale, 0.03, 1.62 * scale]);
  const seat = spec('seatRed', [0.44, 0.06, 0.44]);
  const back = spec('seatRed', [0.44, 0.42, 0.05]);
  const leg = spec('metalDark', [0.06, 0.44, 0.06]);
  const candle = spec('lightWarm', [0.06, 0.1, 0.06]);
  const placed: Box[] = [];
  const tHalf = 0.75 * scale;
  for (const cell of cells) {
    const fp = box([cell.cx - half, 0, cell.cz - half], [cell.cx + half, 1.0, cell.cz + half], 'whiteFabric', false);
    // 扉前ゾーンは Modifier と同じ eps 0.01 の重なり判定（境界に接するセルを浮動小数の誤差で捨てない）
    if (modZones.some((z) => overlapEps(z, fp, 0.01)) || laneHit(c.lanes, fp) || L.holes.some((hh) => fp.min[0] < hh.max[0] + 0.1 && fp.max[0] > hh.min[0] - 0.1 && fp.min[2] < hh.max[2] + 0.1 && fp.max[2] > hh.min[2] - 0.1)) continue;
    const tb = box([cell.cx - tHalf, 0, cell.cz - tHalf], [cell.cx + tHalf, 0.74, cell.cz + tHalf], 'whiteFabric', true);
    if (placed.some((q) => boxesOverlap(q, tb, 0.3))) continue;
    // 扉前ゾーンは Modifier と同じ寸法で判定する（こちらだけ広いと、空いたセルに Modifier の角卓が立つ）
    if (!canPlace(c, tb, { lanes: false, gap: 0.02, zones: modZones })) continue;
    L.boxes.push(tb);
    placed.push(tb);
    const base: Vec3 = [cell.cx, 0, cell.cz];
    put(cloth, base, Math.PI / 4);
    put(top0, [cell.cx, 0.74, cell.cz], 0);
    put(top1, [cell.cx, 0.74, cell.cz], Math.PI / 4);
    put(candle, [cell.cx, 0.77, cell.cz], 0);
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + Math.PI / 12;
      const r0 = tHalf + 0.36;
      const sx = cell.cx + Math.cos(ang) * r0;
      const sz = cell.cz + Math.sin(ang) * r0;
      // 椅子は卓を向く（ローカル +Z が卓の中心へ）
      const yaw = Math.atan2(cell.cx - sx, cell.cz - sz);
      put(seat, [sx, 0.44, sz], yaw);
      put(leg, [sx, 0, sz], yaw);
      put(back, [cell.cx + Math.cos(ang) * (r0 + 0.2), 0.5, cell.cz + Math.sin(ang) * (r0 + 0.2)], yaw);
    }
  }
  commit(L, cloth, top0, top1, seat, back, leg, candle);

  // ---- シャンデリア: 天井パネルの位置に
  const drop = Math.min(1.0, Math.max(0.5, h - 2.5));
  const ring = spec('goldTrim', [0.9, 0.05, 0.05]);
  const rod = spec('goldTrim', [0.03, Math.max(0.1, drop - 0.28), 0.03]);
  const flame = spec('lightWarm', [0.035, 0.14, 0.035]);
  const arms = spec('goldTrim', [0.4, 0.03, 0.03]);
  const panels = interior(L).filter((b) => isPanel(b, h));
  removeInterior(L, (b) => isPanel(b, h));
  for (const pnl of panels) {
    const cx = (pnl.min[0] + pnl.max[0]) / 2;
    const cz = (pnl.min[2] + pnl.max[2]) / 2;
    const y = h - drop;
    const off = pnl.mat === 'lightOff';
    L.boxes.push(box([cx - 0.26, y, cz - 0.26], [cx + 0.26, y + 0.06, cz + 0.26], off ? 'lightOff' : 'lightWarm', false));
    put(rod, [cx, y + 0.28, cz], 0);
    for (let k = 0; k < 4; k++) put(ring, [cx, y + 0.1, cz], (k * Math.PI) / 4);
    for (let k = 0; k < 4; k++) put(arms, [cx, y + 0.2, cz], (k * Math.PI) / 4);
    if (!off) for (let k = 0; k < 8; k++) put(flame, [cx + Math.cos((k / 8) * Math.PI * 2) * 0.43, y + 0.13, cz + Math.sin((k / 8) * Math.PI * 2) * 0.43], 0);
  }
  commit(L, ring, rod, flame, arms);
  for (const l of L.lights) { l.color = 0xffd9a0; l.pos = [l.pos[0], h - drop - 0.25, l.pos[2]]; }
  L.palette.lightColor = 0xffd9a0;
  L.palette.ambient = 0x7a6a58;
}

/** PropRepetition.shared.doorwayZones と同じ寸法の扉前ゾーン（中心 0.9 / 半幅 max(0.8, w/2+0.3) / 高さ 2.2、穴は半径 1.3） */
function modDoorZones(L: RoomLayout): AABB[] {
  const out: AABB[] = [];
  for (const s of L.sockets) {
    if (s.type === 'hole') {
      out.push({ min: [s.pos[0] - 1.3, -0.2, s.pos[2] - 1.3], max: [s.pos[0] + 1.3, L.height + 0.4, s.pos[2] + 1.3] });
      continue;
    }
    const half = Math.max(0.8, s.width / 2 + 0.3);
    const inward = s.dir === 0 ? [0, -1] : s.dir === 1 ? [-1, 0] : s.dir === 2 ? [0, 1] : [1, 0];
    const cx = s.pos[0] + inward[0] * 0.9;
    const cz = s.pos[2] + inward[1] * 0.9;
    const hx = s.dir === 0 || s.dir === 2 ? half : 0.9;
    const hz = s.dir === 0 || s.dir === 2 ? 0.9 : half;
    out.push({ min: [cx - hx, s.pos[1] - 0.1, cz - hz], max: [cx + hx, s.pos[1] + (s.sill ?? 0) + 2.2, cz + hz] });
  }
  return out;
}

// ---------------------------------------------------------------- R04 屋内住宅街（StreetGenerator + FakeSky dusk）
/**
 * 生垣（plant の instances）を各ブロックの歩道の縁に。参考の核「オフィスの格子天井 + 蛍光灯」は rooms.json の FakeSky(dusk)
 * （天井を夕空に差し替え、天井付近のパネルを取り除く）と真向から矛盾するので、FakeSky が無い定義になったときだけ
 * 格子天井（ceilingTile の吊り天井 + トロファー列）を張る。判断は docs/reference-rare.md の保留。
 */
function dressR04(c: Ctx): void {
  const { L, h } = c;
  const hasSky = c.p.def.modifiers.some((m) => m.id === 'FakeSky');
  // ブロック = 歩道スラブ（floorConcrete、高さ 0.12 のソリッド）
  const walks = interior(L).filter((b) => b.solid && b.mat === 'floorConcrete' && Math.abs(b.max[1] - 0.12) < 0.02 && b.min[1] < 0.01 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 4);
  const hedge = spec('plant', [0.55, 0.85, 0.9]);
  const poles = interior(L).filter((b) => b.mat === 'metal' && b.max[1] - b.min[1] > 3 && b.max[0] - b.min[0] < 0.3);
  const solids = interior(L).filter((b) => b.solid && b.max[1] - b.min[1] > 1.5);
  for (const w of walks) {
    if (hedge.transforms.length > 900) break;
    // 4 辺。角 2.2 m と辺の中央 2.4 m（玄関の通路）は空ける
    const edges: { horizontal: boolean; coord: number; a0: number; a1: number; inward: 1 | -1 }[] = [
      { horizontal: true, coord: w.min[2] + 0.35, a0: w.min[0], a1: w.max[0], inward: 1 },
      { horizontal: true, coord: w.max[2] - 0.35, a0: w.min[0], a1: w.max[0], inward: -1 },
      { horizontal: false, coord: w.min[0] + 0.35, a0: w.min[2], a1: w.max[2], inward: 1 },
      { horizontal: false, coord: w.max[0] - 0.35, a0: w.min[2], a1: w.max[2], inward: -1 },
    ];
    for (const e of edges) {
      const mid = (e.a0 + e.a1) / 2;
      for (let a = e.a0 + 2.2 + 0.45; a < e.a1 - 2.2 - 0.45; a += 0.9) {
        if (Math.abs(a - mid) < 1.2) continue;
        const pos: Vec3 = e.horizontal ? [a, 0.12, e.coord] : [e.coord, 0.12, a];
        const fp = box([pos[0] - 0.45, 0.12, pos[2] - 0.45], [pos[0] + 0.45, 1.0, pos[2] + 0.45], 'plant', false);
        if (hitsZone(c.zones, fp)) continue;
        if (poles.some((q) => Math.hypot((q.min[0] + q.max[0]) / 2 - pos[0], (q.min[2] + q.max[2]) / 2 - pos[2]) < 0.6)) continue;
        if (solids.some((q) => q !== w && boxesOverlap(q, fp, 0.05))) continue;
        put(hedge, pos, e.horizontal ? 0 : Math.PI / 2);
      }
    }
  }
  commit(L, hedge);
  if (hasSky) return;
  // FakeSky 無しのときだけ: オフィスの格子天井（吊り天井の箔）とトロファー列
  for (const r of c.rects) {
    L.boxes.push(box([r.x0 + WALL_T, h - 0.5, r.z0 + WALL_T], [r.x1 - WALL_T, h - 0.42, r.z1 - WALL_T], 'ceilingTile', false));
    const ir = inner(r, 3);
    for (let x = ir.x0 + 2; x < ir.x1; x += 6) for (let z = ir.z0 + 2; z < ir.z1; z += 6) L.boxes.push(box([x - 0.6, h - 0.54, z - 0.3], [x + 0.6, h - 0.5, z + 0.3], 'lightPanel', false));
  }
}

// ---------------------------------------------------------------- R05 空中連絡橋（CorridorGenerator Bridge + FogDepth）
/** 手すりだけの歩廊に屋根・ガラス側壁・外の夜景・床際と天井のライン光を足し、細長いガラス張りの連絡橋にする */
function dressR05(c: Ctx): void {
  const { L, h } = c;
  for (const r of c.rects) L.boxes.push(box([r.x0, h, r.z0], [r.x1, h + 0.15, r.z1], 'ceilingDark', true));
  const faces = innerFaces(c.rects);
  for (const f of faces) {
    const onFace = c.sockets.filter((s) => s.type !== 'hole' && s.dir === f.dir && Math.abs((f.horizontal ? s.pos[2] : s.pos[0]) - f.coord) < 0.05);
    for (const [a0, a1] of freeRuns(f, c.sockets, 0.35)) {
      const len = a1 - a0;
      if (len < 0.4) continue;
      L.boxes.push(alongFace(f, a0, len, 0.02, 0.05, 1.05, h, 'glass', false));
      L.boxes.push(alongFace(f, a0 - 0.3, len + 0.6, -(WALL_T + 0.04), -(WALL_T + 0.015), 1.0, 2.9, 'windowNight', false));
      const n = Math.max(1, Math.round(len / 2.4));
      for (let k = 0; k <= n; k++) {
        const t = Math.min(a1 - 0.06, Math.max(a0, a0 + (len * k) / n - 0.03));
        L.boxes.push(alongFace(f, t, 0.06, 0.0, 0.07, 1.05, h, 'metalDark', false));
      }
      if (len >= 1.2) {
        L.boxes.push(alongFace(f, a0 + 0.15, len - 0.3, 0.1, 0.16, 0.02, 0.05, 'lightPanel', false));
        L.boxes.push(alongFace(f, a0 + 0.15, len - 0.3, 0.26, 0.32, h - 0.06, h - 0.02, 'lightPanel', false));
      }
    }
    // 扉の両脇の方立てと上部の梁（開口の上は手すり壁が無い）
    for (const s of onFace) {
      const t = f.horizontal ? s.pos[0] : s.pos[2];
      const w = s.width;
      L.boxes.push(alongFace(f, t - w / 2 - 0.35, 0.35, 0.0, 0.12, 1.05, h, 'metalDark', false));
      L.boxes.push(alongFace(f, t + w / 2, 0.35, 0.0, 0.12, 1.05, h, 'metalDark', false));
      const top = (s.sill ?? 0) + s.height;
      if (top < h - 0.05) L.boxes.push(alongFace(f, t - w / 2 - 0.35, w + 0.7, 0.0, 0.12, top + 0.02, h, 'metalDark', false));
    }
  }
  const r0 = c.rects[0];
  const alongZ = r0.z1 - r0.z0 >= r0.x1 - r0.x0;
  for (const k of [0.3, 0.7]) {
    const pos: Vec3 = alongZ ? [(r0.x0 + r0.x1) / 2, 2.2, r0.z0 + (r0.z1 - r0.z0) * k] : [r0.x0 + (r0.x1 - r0.x0) * k, 2.2, (r0.z0 + r0.z1) / 2];
    addLight(c, pos, 0xdfe8ff, 0.55, 12);
  }
  L.palette.lightColor = 0xdfe8ff;
}

// ---------------------------------------------------------------- R06 青い水族館通路（GenericCorridor + FogDepth）
/** 側壁の装飾扉を外し、両側を厚い aquariumBlue の水槽面（台輪・方立て・上枡は metalDark）に。器具は ledBlue、床は濡れ、青い薄霧 */
function dressR06(c: Ctx): void {
  const { L, h } = c;
  const door = L.palette.door;
  removeInterior(L, (b) => !b.solid && (b.mat === door || b.mat === 'trim' || b.mat === 'metal'));
  const top = h - 0.28;
  for (const f of innerFaces(c.rects)) {
    for (const [a0, a1] of freeRuns(f, c.sockets, 0.6)) {
      const len = a1 - a0;
      if (len < 1.5) continue;
      L.boxes.push(alongFace(f, a0, len, 0.0, 0.15, 0, 0.45, 'metalDark', false));
      L.boxes.push(alongFace(f, a0, len, 0.0, 0.15, top, top + 0.15, 'metalDark', false));
      const n = Math.max(1, Math.ceil(len / 3.0));
      for (let k = 0; k < n; k++) {
        const s0 = a0 + (len * k) / n;
        const s1 = a0 + (len * (k + 1)) / n;
        L.boxes.push(alongFace(f, s0 + 0.03, s1 - s0 - 0.06, 0.02, 0.13, 0.45, top, 'aquariumBlue', false));
      }
      for (let k = 0; k <= n; k++) {
        const t = Math.min(a1 - 0.06, Math.max(a0, a0 + (len * k) / n - 0.03));
        L.boxes.push(alongFace(f, t, 0.06, 0.0, 0.15, 0.45, top, 'metalDark', false));
      }
    }
  }
  recolorPanels(L, 'ledBlue');
  for (const l of L.lights) l.color = 0x74a6ff;
  L.lighting = { ...(L.lighting ?? {}), areaEmitters: true };
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.6) };
  const b = L.bounds;
  const vol = Math.max(1, (b.max[0] - b.min[0] - 0.6) * 0.9 * (b.max[2] - b.min[2] - 0.6));
  if (!L.particles) L.particles = { type: 'mist', density: Math.min(80, Math.max(20, vol * 0.08)) / vol, aabb: { min: [b.min[0] + 0.3, 0.1, b.min[2] + 0.3], max: [b.max[0] - 0.3, 1.0, b.max[2] - 0.3] }, size: 2.0, color: 0x8fb8ff };
  L.palette.lightColor = 0x74a6ff;
  L.palette.ambient = 0x243a5c;
  signOnWall(L, innerFaces(c.rects), c.sockets, 'AQUARIUM', { y: Math.min(h - 0.25, 2.5), width: 1.4, prefer: [0, 2], kind: 'emissive', color: 0xdff0ff, background: 0x0e2a55, sub: '水族館' });
}

// ---------------------------------------------------------------- R07 地下温室（RoomGenerator OrganicZone + InstanceOvergrowth）
/** ガラス天井の直下に明るい曇天の箔（天窓）、白いアーチのリブと柱、リブから垂れる植物、床の水たまり */
function dressR07(c: Ctx): void {
  const { L, h, rng } = c;
  removeInterior(L, (b) => isPanel(b, h));
  // 空の箔は厚さ 0.32（薄い水平パネル < 0.3 の面光源にしない。全面の面光源はサンプル格子が大きく構築が +50% 遅くなった）。焼き込みの光は L.lights と skyAmbient
  for (const r of c.rects) L.boxes.push(box([r.x0 + WALL_T, h - 0.36, r.z0 + WALL_T], [r.x1 - WALL_T, h - 0.04, r.z1 - WALL_T], 'skyOvercast', false));
  const hang = spec('plant', [0.5, 0.55, 0.5]);
  const r = c.rects[0];
  const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
  const len = alongZ ? r.z1 - r.z0 : r.x1 - r.x0;
  const n = Math.max(1, Math.floor((len - 1.5) / 3.0));
  const start = (alongZ ? r.z0 : r.x0) + (len - (n - 1) * 3.0) / 2;
  for (let k = 0; k < n; k++) {
    const a = start + k * 3.0;
    steppedArch(c, r, alongZ, a, 'shelfMetal', 'shelfMetal', true);
    if (k % 2 === 0) {
      const lo = (alongZ ? r.x0 : r.z0) + WALL_T + 0.8;
      const hi = (alongZ ? r.x1 : r.z1) - WALL_T - 0.8;
      for (let t = lo; t <= hi; t += 1.5) {
        const pos: Vec3 = alongZ ? [t + rng.float(-0.1, 0.1), h - 1.0, a] : [a, h - 1.0, t + rng.float(-0.1, 0.1)];
        put(hang, pos, rng.float(0, Math.PI), rng.float(0.8, 1.2));
      }
    }
  }
  commit(L, hang);
  // 水たまり（decals。Tier の decals=false なら描かれない）
  const decals = L.decals ?? [];
  const solids = interior(L).filter((b) => b.solid);
  for (let i = 0; i < 60 && decals.length < 18; i++) {
    const rr = rng.pick(c.rects);
    const x = rng.float(rr.x0 + 0.8, rr.x1 - 0.8);
    const z = rng.float(rr.z0 + 0.8, rr.z1 - 0.8);
    if (c.sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < 1.4)) continue;
    if (solids.some((b) => x > b.min[0] - 0.2 && x < b.max[0] + 0.2 && z > b.min[2] - 0.2 && z < b.max[2] + 0.2 && b.min[1] < 0.3)) continue;
    decals.push({ mat: 'water', pos: [x, 0.004, z], size: [rng.float(0.7, 1.8), rng.float(0.5, 1.3)], normal: 'y', yaw: rng.float(0, Math.PI) });
  }
  L.decals = decals;
  L.lighting = { ...(L.lighting ?? {}), skyAmbient: L.lighting?.skyAmbient ?? { color: 0xe6eef6, intensity: 0.45 } };
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.35) };
  for (const l of L.lights) l.color = 0xf0f6ff;
  L.palette.lightColor = 0xf0f6ff;
  L.palette.ambient = 0xa8b4be;
}

// ---------------------------------------------------------------- R08 無書籍図書館（GridGenerator ShelfGrid + AudioEvent）
/**
 * 棚のスラブ（furnitureDark 0.6 × 2.2）を空の木製書架に: 段板 5 枚（bookshelfWood、ソリッド。通り抜け防止のため L.boxes）+ 背板 + 支柱（instances）。
 * 中身（boxCardboard）は捨てる。入口側の帯に閲覧机 2 台（緑のバンカーズランプ + 暖色の点光源）、器具は通路上の長い天窓風のストリップに。
 */
function dressR08(c: Ctx): void {
  const { L, h } = c;
  const slabs = interior(L).filter((b) => b.solid && b.mat === 'furnitureDark' && b.max[1] - b.min[1] >= 1.3 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 0.35 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) <= 1.0);
  removeInterior(L, (b) => (!b.solid && b.mat === 'boxCardboard') || slabs.includes(b) || isPanel(b, h));
  const post = spec('bookshelfWood', [0.06, 2.2, 0.6]);
  const backs = new Map<string, InstanceSpec>();
  let axisX = true;
  const rows: number[] = [];
  for (const s of slabs.slice(0, 48)) {
    const w = s.max[0] - s.min[0], d = s.max[2] - s.min[2];
    const alongX = w >= d;
    axisX = alongX;
    const len = alongX ? w : d;
    const depth = alongX ? d : w;
    const H = s.max[1];
    const cc = alongX ? (s.min[2] + s.max[2]) / 2 : (s.min[0] + s.max[0]) / 2;
    rows.push(cc);
    const a0 = alongX ? s.min[0] : s.min[2];
    const mk = (t0: number, t1: number, d0: number, d1: number, y0: number, y1: number, mat: MatId, solid: boolean): Box =>
      alongX ? box([t0, y0, cc + d0], [t1, y1, cc + d1], mat, solid) : box([cc + d0, y0, t0], [cc + d1, y1, t1], mat, solid);
    for (const y of [0.5, 0.9, 1.3, 1.7]) L.boxes.push(mk(a0, a0 + len, -depth / 2 + 0.02, depth / 2 - 0.02, y, y + 0.03, 'bookshelfWood', true));
    L.boxes.push(mk(a0, a0 + len, -depth / 2, depth / 2, H - 0.04, H, 'bookshelfWood', true));
    // 背板（長さ別の instance spec）
    const key = (Math.round(len * 10) / 10).toFixed(1);
    let bs = backs.get(key);
    if (!bs) { bs = spec('bookshelfWood', [Number(key), H - 0.04, 0.03]); backs.set(key, bs); }
    put(bs, alongX ? [a0 + len / 2, 0, cc] : [cc, 0, a0 + len / 2], alongX ? 0 : Math.PI / 2);
    const bays = Math.max(1, Math.round(len));
    post.size = [0.06, H, depth];
    for (let k = 0; k <= bays; k++) {
      const t = Math.min(a0 + len - 0.03, Math.max(a0 + 0.03, a0 + (len * k) / bays));
      put(post, alongX ? [t, 0, cc] : [cc, 0, t], alongX ? 0 : Math.PI / 2);
    }
  }
  commit(L, post, ...backs.values());
  // 天窓風のストリップ: 通路（列の間 + 外周側）の中心線
  const main = c.rects[0];
  const lo = axisX ? main.z0 + WALL_T : main.x0 + WALL_T;
  const hi = axisX ? main.z1 - WALL_T : main.x1 - WALL_T;
  const uniq = [...new Set(rows.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  const aisles: number[] = [];
  if (uniq.length === 0) aisles.push((lo + hi) / 2);
  else {
    if (uniq[0] - lo > 1.4) aisles.push((lo + uniq[0] - 0.3) / 2);
    for (let i = 0; i + 1 < uniq.length; i++) aisles.push((uniq[i] + uniq[i + 1]) / 2);
    if (hi - uniq[uniq.length - 1] > 1.4) aisles.push((uniq[uniq.length - 1] + 0.3 + hi) / 2);
  }
  const l0 = (axisX ? main.x0 : main.z0) + 1.0;
  const l1 = (axisX ? main.x1 : main.z1) - 1.0;
  for (const a of aisles.slice(0, 14)) {
    L.boxes.push(axisX ? box([l0, h - 0.05, a - 0.35], [l1, h - 0.01, a + 0.35], 'lightPanel', false) : box([a - 0.35, h - 0.05, l0], [a + 0.35, h - 0.01, l1], 'lightPanel', false));
  }
  for (const l of L.lights) l.color = 0xdde8ff;
  // 閲覧机 + バンカーズランプ（入口側の帯。置けた机だけ点光源）
  const entry = entryOf(L);
  const ez = entry ? entry.pos[2] : main.z0;
  const cands: [number, number][] = [];
  for (const dx of [4.5, -4.5, 7.5, -7.5, 3.0, -3.0]) cands.push([(entry?.pos[0] ?? 0) + dx, ez + WALL_T + 1.0]);
  let tables = 0;
  for (const [x, z] of cands) {
    if (tables >= 2) break;
    const tb = box([x - 0.8, 0, z - 0.4], [x + 0.8, 0.75, z + 0.4], 'furnitureLight', true);
    if (!canPlace(c, tb, { gap: 0.4 })) continue;
    L.boxes.push(tb);
    L.boxes.push(box([x - 0.01, 0.75, z - 0.01], [x + 0.01, 1.1, z + 0.01], 'metalDark', false));
    L.boxes.push(box([x - 0.15, 1.05, z - 0.08], [x + 0.15, 1.14, z + 0.08], 'noticeGreen', false));
    L.boxes.push(box([x - 0.12, 1.03, z - 0.05], [x + 0.12, 1.05, z + 0.05], 'lightWarm', false));
    addLight(c, [x, 1.3, z], 0xffcf8a, 0.6, 6);
    tables++;
  }
  signOnWall(L, innerFaces(c.rects), c.sockets, 'QUIET PLEASE', { y: Math.min(h - 0.4, 2.3), width: 1.4, prefer: [0, 1, 3], sub: 'お静かに' });
}

// ---------------------------------------------------------------- R09 監視映画館（RoomGenerator Theater + PastWindow screen）
/** 座席を赤（seatRed）に、天井灯を消して壁の暖色スコンスだけにし、暗さを強める。スクリーン（wallWhite の非ソリッド箔）は触らない */
function dressR09(c: Ctx): void {
  const { L, h } = c;
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.solid && b.mat === 'furnitureDark') L.boxes[i] = { ...b, mat: 'seatRed' };
  }
  // 天井灯: 3 枚に 1 枚だけ暖色の場内灯として残し、他は消灯（全消灯だとスコンスと足元灯だけでは座席が読めない）
  let pi = 0;
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!isPanel(b, h)) continue;
    L.boxes[i] = { ...b, mat: pi % 3 === 0 && b.mat !== 'lightOff' ? 'lightWarm' : 'lightOff' };
    pi++;
  }
  for (const l of L.lights) { l.intensity *= 0.5; l.color = 0xffc080; }
  // 側壁のスコンス（3 m ピッチ）
  for (const f of innerFaces(c.rects)) {
    if (f.horizontal) continue;
    for (const [a0, a1] of freeRuns(f, c.sockets, 1.0)) {
      for (let t = a0 + 1.5; t < a1 - 1.0; t += 3.0) L.boxes.push(alongFace(f, t - 0.09, 0.18, 0.02, 0.09, 1.75, 2.1, 'lightWarm', false));
    }
  }
  // 側通路の足元灯（座席列の端ごと。上向きの小さな面光源）
  const rows = interior(L).filter((b) => b.solid && b.mat === 'seatRed' && b.max[1] - b.min[1] < 0.35);
  let steps = 0;
  for (const r of rows) {
    if (steps >= 40) break;
    for (const x of [r.min[0] - 0.35, r.max[0] + 0.35]) {
      const z = (r.min[2] + r.max[2]) / 2;
      const fp = box([x - 0.06, 0, z - 0.03], [x + 0.06, 0.025, z + 0.03], 'lightWarm', false);
      if (!insideRects(c.rects, fp, WALL_T + 0.3)) continue;
      L.boxes.push(fp);
      steps++;
    }
  }
  L.palette.light = 'lightWarm';
  L.palette.lightColor = 0xffc080;
  L.palette.ambient = 0x1a1418;
}

// ---------------------------------------------------------------- R10 ゲートのない空港（AtriumGenerator Terminal + FakeSignage flightBoard）
/**
 * 座席列のスラブを青い連結椅子（梁はソリッドの L.boxes、座と背は instances）に、入口の正面に大きな発着案内板（screenDark の板 + 白い行 = 発光サイン）、
 * 吊り下げの案内プレート、艶床（wetness）。FakeSignage の案内板スタンドはソリッドの梁を避けて中央に置かれる
 */
function dressR10(c: Ctx): void {
  const { L, h, rng } = c;
  const slabs = interior(L).filter((b) => b.solid && b.mat === 'furnitureDark' && Math.abs(b.max[1] - b.min[1] - 0.5) < 0.06 && Math.abs(Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) - 0.6) < 0.06);
  removeInterior(L, (b) => slabs.includes(b));
  const seat = spec('seatBlue', [0.45, 0.07, 0.45]);
  const back = spec('seatBlue', [0.45, 0.4, 0.06]);
  slabs.forEach((s, i) => {
    const alongX = s.max[0] - s.min[0] >= s.max[2] - s.min[2];
    const a0 = alongX ? s.min[0] : s.min[2];
    const a1 = alongX ? s.max[0] : s.max[2];
    const cc = alongX ? (s.min[2] + s.max[2]) / 2 : (s.min[0] + s.max[0]) / 2;
    const face: Dir = alongX ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
    const nv = dirVec(face);
    // 梁（ソリッド。0.36 は段差 0.35 を超えるので通り抜けられない）と脚
    L.boxes.push(alongX ? box([a0 + 0.1, 0.3, cc - 0.04], [a1 - 0.1, 0.36, cc + 0.04], 'metalDark', true) : box([cc - 0.04, 0.3, a0 + 0.1], [cc + 0.04, 0.36, a1 - 0.1], 'metalDark', true));
    for (const e of [a0 + 0.25, a1 - 0.25]) L.boxes.push(alongX ? box([e - 0.03, 0, cc - 0.22], [e + 0.03, 0.3, cc + 0.22], 'metalDark', false) : box([cc - 0.22, 0, e - 0.03], [cc + 0.22, 0.3, e + 0.03], 'metalDark', false));
    const n = Math.max(1, Math.floor((a1 - a0) / 0.55));
    const start = a0 + ((a1 - a0) - n * 0.55) / 2 + 0.275;
    for (let k = 0; k < n; k++) {
      const a = start + k * 0.55;
      const sp: Vec3 = alongX ? [a, 0.38, cc] : [cc, 0.38, a];
      put(seat, sp, yawOfDir(face));
      put(back, [sp[0] - nv[0] * 0.2, 0.45, sp[2] - nv[2] * 0.2], yawOfDir(face));
    }
  });
  commit(L, seat, back);
  // 発着案内板（入口の 7 m 先、入ってくる人に正対）
  const entry = entryOf(L);
  if (entry && entry.type !== 'hole') {
    const inward = dirVec(((entry.dir + 2) % 4) as Dir);
    const cx = entry.pos[0] + inward[0] * 7.0;
    const cz = entry.pos[2] + inward[2] * 7.0;
    const alongX = entry.dir === 0 || entry.dir === 2; // 板は入口の壁と平行
    const bw = 4.8, bh = 1.9, bt = 0.1;
    const y0 = 3.0;
    const panel = alongX ? box([cx - bw / 2, y0, cz - bt / 2], [cx + bw / 2, y0 + bh, cz + bt / 2], 'screenDark', false) : box([cx - bt / 2, y0, cz - bw / 2], [cx + bt / 2, y0 + bh, cz + bw / 2], 'screenDark', false);
    if (insideRects(c.rects, panel, WALL_T + 0.3)) {
      L.boxes.push(panel);
      for (const o of [-1.8, 1.8]) L.boxes.push(alongX ? box([cx + o - 0.02, y0 + bh, cz - 0.02], [cx + o + 0.02, h, cz + 0.02], 'metalDark', false) : box([cx - 0.02, y0 + bh, cz + o - 0.02], [cx + 0.02, h, cz + o + 0.02], 'metalDark', false));
      const face: Dir = entry.dir; // 入口の壁の外向き = 入ってくる人の方
      const n = dirVec(face);
      const front: Vec3 = [cx + n[0] * (bt / 2 + 0.012), 0, cz + n[2] * (bt / 2 + 0.012)];
      const u: Vec3 = alongX ? [1, 0, 0] : [0, 0, 1];
      // 見る人（面 face を正面に見る = -n を向く）の左手が列 0。右手 = cross(-n, up): face 0/3 は -u、face 1/2 は +u が左
      const mirror = face === 0 || face === 3 ? 1 : -1;
      const times = ['06:40', '07:15', '07:55', '08:30', '09:05', '09:50', '10:20', '11:05'];
      const dests = ['HANEDA 羽田', 'NAHA 那覇', 'SAPPORO 新千歳', 'FUKUOKA 福岡', 'OSAKA 伊丹', 'SENDAI 仙台', 'KOMATSU 小松', 'MATSUYAMA 松山'];
      const remarks = ['GATE ---', 'GATE ---', 'DELAYED', 'GATE ---', 'BOARDING', 'GATE ---'];
      const carriers = ['NX', 'JQ', 'HY', 'KL', 'VZ'];
      const rowY = (i: number) => y0 + bh - 0.22 - 0.375 * i;
      const cell = (col: number, row: number, text: string, color: number, bg: number) => {
        const off = mirror * (col - 1) * 1.6;
        pushSign(L, { text, pos: [front[0] + u[0] * off, rowY(row), front[2] + u[2] * off], dir: face, width: 1.5, kind: 'emissive', color, background: bg });
      };
      cell(0, 0, '出発 DEPARTURES', 0xffc040, 0x0b1428);
      cell(1, 0, '行先 DESTINATION', 0xffc040, 0x0b1428);
      cell(2, 0, 'GATE / REMARKS', 0xffc040, 0x0b1428);
      const shuffled = rng.shuffle([...dests]);
      for (let i = 1; i < 5; i++) {
        cell(0, i, `${times[(i * 2 + rng.int(0, 1)) % times.length]}  ${rng.pick(carriers)} ${rng.int(101, 998)}`, 0xf4f4ee, 0x0f1a30);
        cell(1, i, shuffled[i % shuffled.length], 0xf4f4ee, 0x0f1a30);
        cell(2, i, remarks[(i + rng.int(0, 2)) % remarks.length], i === 3 ? 0xff8a60 : 0xf4f4ee, 0x0f1a30);
      }
    }
    // 吊り下げの案内プレート（板の先 5 m と、さらに 10 m 先）
    const r0 = c.rects[0];
    const texts: [string, string][] = [['← 出発 DEPARTURES', '到着 ARRIVALS →'], ['GATES A–H  ↑', 'ゲート']];
    texts.forEach(([text, sub], k) => {
      const dist = 12.5 + k * 10;
      const px = entry.pos[0] + inward[0] * dist;
      const pz = entry.pos[2] + inward[2] * dist;
      if (px < r0.x0 + 2 || px > r0.x1 - 2 || pz < r0.z0 + 2 || pz > r0.z1 - 2) return;
      const y = 2.6;
      pushSign(L, { text, sub, pos: [px + inward[0] * -0.012, y, pz + inward[2] * -0.012], dir: entry.dir, width: 2.4, kind: 'plate', color: 0xf4f4ee, background: 0x14213a });
      const pb = alongX ? box([px - 1.2, y - 0.3, pz - 0.02], [px + 1.2, y + 0.3, pz + 0.02], 'screenDark', false) : box([px - 0.02, y - 0.3, pz - 1.2], [px + 0.02, y + 0.3, pz + 1.2], 'screenDark', false);
      L.boxes.push(pb);
      for (const o of [-0.9, 0.9]) L.boxes.push(alongX ? box([px + o - 0.015, y + 0.3, pz - 0.015], [px + o + 0.015, h, pz + 0.015], 'metalDark', false) : box([px - 0.015, y + 0.3, pz + o - 0.015], [px + 0.015, h, pz + o + 0.015], 'metalDark', false));
    });
  }
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.25) };
}

// ---------------------------------------------------------------- R11 年代混在ホテル（CorridorHotel + EraPreset）
/** 区画ごとの壁紙は EraPreset に任せ、装飾扉の両脇に壁灯（lightWarm のプレート）を足し、番号プレートを読める幅にする */
function dressR11(c: Ctx): void {
  const { L } = c;
  const door = L.palette.door;
  const doors = interior(L).filter((b) => !b.solid && b.mat === door && b.max[1] - b.min[1] >= 1.9 && b.max[1] - b.min[1] <= 2.2 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) <= 0.06);
  const lamps = interior(L).filter((b) => b.mat === 'lightWarm' && b.max[1] - b.min[1] < 0.4);
  const faces = innerFaces(c.rects);
  let added = 0;
  for (const d of doors) {
    if (added >= 40) break;
    const cx = (d.min[0] + d.max[0]) / 2;
    const cz = (d.min[2] + d.max[2]) / 2;
    const thinX = d.max[0] - d.min[0] < d.max[2] - d.min[2];
    const f = faces.find((q) => q.horizontal !== thinX && Math.abs((q.horizontal ? cz : cx) - q.face) < 0.2 && (q.horizontal ? cx : cz) > q.a0 && (q.horizontal ? cx : cz) < q.a1);
    if (!f) continue;
    const t0 = f.horizontal ? cx : cz;
    for (const side of [-1, 1]) {
      const t = t0 + side * (0.45 + 0.065 + 0.32);
      if (t - 0.08 < f.a0 + 0.1 || t + 0.08 > f.a1 - 0.1) continue;
      const probe = onFace(f, t, 0.06, 1.7);
      if (lamps.some((q) => Math.hypot((q.min[0] + q.max[0]) / 2 - probe[0], (q.min[2] + q.max[2]) / 2 - probe[2]) < 0.5)) continue;
      if (c.sockets.some((s) => s.type !== 'hole' && Math.hypot(s.pos[0] - probe[0], s.pos[2] - probe[2]) < 0.9)) continue;
      const lamp = alongFace(f, t - 0.07, 0.14, 0.03, 0.11, 1.6, 1.82, 'lightWarm', false);
      L.boxes.push(lamp);
      lamps.push(lamp);
      added++;
    }
  }
  for (const s of L.signs ?? []) if (s.kind === 'plate' && /^\d{3}$/.test(s.text)) s.width = Math.max(s.width, 0.42);
}

// ---------------------------------------------------------------- R12 日用品博物館（RoomGenerator Gallery）
/**
 * 壁を暗く、島の台と壁沿いの台にガラスケース。中の日用品はコード生成の展示品（InstanceSpec.shape 'exhibit'、variant = 品目。
 * src/render/props/MuseumObjects.ts: ケトル・黒電話・トランジスタラジオ・バケツ・樹脂の椅子・扇風機・炊飯器・アイロン・卓上ライト・
 * 目覚まし時計・魔法瓶）。品目は部屋ごとに並べ替えた順に割り当て（同じ物が続かない）、ケースに入らない物（椅子）は次の品目へ。
 * 展示品は正面を通路（島は部屋の中心、壁沿いは室内）へ向け、フェルトの敷板の上に置く。真上に小さなスポット、壁沿いは英文の説明
 */
function dressR12(c: Ctx): void {
  const { L, h, rng } = c;
  recolorShell(L, { wall: 'wallDark' });
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.solid && b.mat === 'wallWhite') L.boxes[i] = { ...b, mat: 'wallDark' };
  }
  recolorPanels(L, 'lightOff', false);
  for (const l of L.lights) { l.intensity *= 0.45; l.color = 0xffe0b0; }
  const order = rng.shuffle([...EXHIBIT_KINDS]);
  const specs = new Map<ExhibitKind, InstanceSpec>();
  let next = 0;
  /** ケースの内寸（幅 × 奥行き × 高さ）に入る品目を順番に選ぶ */
  const pick = (w: number, d: number, hh: number): ExhibitKind | null => {
    for (let k = 0; k < order.length; k++) {
      const kind = order[(next + k) % order.length];
      const [sx, sy, sz] = EXHIBIT_SIZE[kind];
      const fits = Math.max(sx, sz) <= Math.min(w, d) - 0.04 || (sx <= w - 0.04 && sz <= d - 0.04);
      if (fits && sy <= hh - 0.05) { next = (next + k + 1) % order.length; return kind; }
    }
    return null;
  };
  let spots = 0;
  /**
   * 展示: フェルトの敷板 → 小さな物は白い台座で持ち上げる（品目の上端がケースの床 + riseTo 前後になる高さ。ケースの天井から 0.15 m は空ける）→
   * 品目、手前に説明札（小さな板を斜めに立てた代わりの薄箱）
   */
  const exhibit = (cx: number, cz: number, top: number, kind: ExhibitKind, yaw: number, w: number, d: number, caseH: number, riseTo: number) => {
    L.boxes.push(box([cx - w / 2 + 0.02, top, cz - d / 2 + 0.02], [cx + w / 2 - 0.02, top + 0.012, cz + d / 2 - 0.02], 'whiteFabric', false));
    const [sx, sy, sz] = EXHIBIT_SIZE[kind];
    const riser = Math.max(0, Math.min(riseTo - sy, caseH - 0.15 - sy));
    let y = top + 0.012;
    // 正面方向（yaw の +z）と横方向
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (riser > 0.05) {
      const hx = Math.min(w / 2 - 0.08, Math.max(sx, sz) / 2 + 0.05), hz = Math.min(d / 2 - 0.08, Math.max(sx, sz) / 2 + 0.05);
      L.boxes.push(box([cx - hx, y, cz - hz], [cx + hx, y + riser, cz + hz], 'paintWhite', false));
      y += riser;
    }
    // 説明札: 台座（無ければ品目）の手前、敷板の上
    const reach = Math.max(sx, sz) / 2 + 0.1;
    const px = cx + fx * Math.min(reach, (Math.abs(fx) > 0.5 ? w : d) / 2 - 0.06), pz = cz + fz * Math.min(reach, (Math.abs(fx) > 0.5 ? w : d) / 2 - 0.06);
    const pw = Math.abs(fx) > 0.5 ? [0.035, 0.07] : [0.07, 0.035];
    L.boxes.push(box([px - pw[0], top + 0.012, pz - pw[1]], [px + pw[0], top + 0.03, pz + pw[1]], 'signPlate', false));
    let sp = specs.get(kind);
    if (!sp) { sp = { mat: 'furnitureDark', size: EXHIBIT_SIZE[kind], transforms: [], shape: 'exhibit', variant: kind }; specs.set(kind, sp); }
    sp.transforms.push({ pos: [cx, y, cz], yaw });
    if (spots < 24) {
      // スポット（下向きの小さな面光源。0.14 角では焼き込みがほぼ見えなかったので 0.3 角）
      L.boxes.push(box([cx - 0.15, h - 0.06, cz - 0.15], [cx + 0.15, h - 0.02, cz + 0.15], 'lightWarm', false));
      spots++;
    }
  };
  const r0 = c.rects[0];
  const mid: [number, number] = r0 ? [(r0.x0 + r0.x1) / 2, (r0.z0 + r0.z1) / 2] : [0, 0];
  // 島（patternIslands の furnitureLight）→ 暗い台 + ガラスケース
  let islands = 0;
  for (let i = c.start; i < L.boxes.length && islands < 14; i++) {
    const b = L.boxes[i];
    if (!b.solid || b.mat !== 'furnitureLight' || b.min[1] > 0.05) continue;
    L.boxes[i] = { ...b, mat: 'furnitureDark' };
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const top = b.max[1];
    const hw = Math.min(0.45, (b.max[0] - b.min[0]) / 2 - 0.1);
    const hd = Math.min(0.45, (b.max[2] - b.min[2]) / 2 - 0.1);
    if (hw < 0.2 || hd < 0.2) continue;
    const kind = pick(hw * 2, hd * 2, 0.9);
    if (!kind) continue;
    L.boxes.push(box([cx - hw, top, cz - hd], [cx + hw, top + 0.9, cz + hd], 'glass', false));
    // 正面は部屋の中心へ（軸に揃えた 4 方向）
    const dx = mid[0] - cx, dz = mid[1] - cz;
    const yaw = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    exhibit(cx, cz, top, kind, yaw, hw * 2, hd * 2, 0.9, Math.max(0.3, 1.25 - top));
    islands++;
  }
  // 壁沿いの台（4 m ごと）+ 説明文
  let wallCases = 0;
  for (const f of innerFaces(c.rects)) {
    for (const [a0, a1] of freeRuns(f, c.sockets, 1.2)) {
      for (let t = a0 + 1.5; t < a1 - 1.5 && wallCases < 8; t += 4.0) {
        const plinth = alongFace(f, t - 0.5, 1.0, 0.05, 0.65, 0, 0.9, 'furnitureDark', true);
        if (!canPlace(c, plinth, { lanes: false, gap: 0.3 })) continue;
        const kind = pick(0.84, 0.44, 0.85);
        if (!kind) continue;
        L.boxes.push(plinth);
        L.boxes.push(alongFace(f, t - 0.42, 0.84, 0.13, 0.57, 0.9, 1.75, 'glass', false));
        const center = onFace(f, t, 0.35, 0.9);
        const yaw = f.horizontal ? (f.inward > 0 ? 0 : Math.PI) : f.inward * Math.PI / 2;
        // 壁沿いは幅 0.84 × 奥行き 0.44（面の向きで x / z が入れ替わる）
        exhibit(center[0], center[2], 0.9, kind, yaw, f.horizontal ? 0.84 : 0.44, f.horizontal ? 0.44 : 0.84, 0.85, 0.45);
        signAt(L, f, t, 1.98, 0.7, EXHIBIT_CAPTIONS[kind], { color: 0xe8e4d8, background: 0x1c1c22 });
        wallCases++;
      }
    }
  }
  commit(L, ...specs.values());
  signOnWall(L, innerFaces(c.rects), c.sockets, 'THE MUSEUM OF ORDINARY THINGS', { y: Math.min(h - 0.5, 2.3), width: 2.8, prefer: [0, 1, 3], color: 0xe8e4d8, background: 0x1c1c22, sub: '日用品博物館' });
  L.palette.light = 'lightOff';
  L.palette.ambient = 0x35343a;
}

// ---------------------------------------------------------------- R13 巨大児童遊園（RoomGenerator PlayArea + ScaleAnomaly ×3）
/** 原色の遊具（チューブ・段状の滑り台・ボールプール）と市松の床タイル（plasticBlue の箔）。ScaleAnomaly が後で全体を 3 倍にする */
function dressR13(c: Ctx): void {
  const { L, h, rng } = c;
  removeInterior(L, (b) => b.solid && b.min[1] < 0.05 && b.max[1] < 1.6 && (b.mat === 'furnitureLight' || b.mat === 'furnitureDark' || b.mat === 'yellowLine'));
  wallBands(L, c.rects, c.sockets, [{ y0: 0, y1: 0.5, mat: 'plasticBlue', depth: 0.012 }, { y0: 0.5, y1: 0.58, mat: 'plasticYellow', depth: 0.02 }]);
  const r = c.rects[0];
  const tile = spec('plasticBlue', [1.0, 0.012, 1.0]);
  const ir = inner(r, WALL_T + 0.3);
  const nx = Math.floor(ir.x1 - ir.x0);
  const nz = Math.floor(ir.z1 - ir.z0);
  const ox = ir.x0 + (ir.x1 - ir.x0 - nx) / 2 + 0.5;
  const oz = ir.z0 + (ir.z1 - ir.z0 - nz) / 2 + 0.5;
  // 市松は 300 枚まで（×3 の後は 3 m 角になり BoxGeometry の分割が増えるので、三角形予算 +40k に対して余裕を残す）
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if ((i + j) % 2 === 0 && tile.transforms.length < 300) put(tile, [ox + i, 0.001, oz + j], 0);
  commit(L, tile);
  const structures = rng.shuffle(['tube', 'slide', 'pit', 'tube', 'slide']);
  let placed = 0;
  const pitch = 4.5;
  const gx0 = ir.x0 + 2.0, gz0 = ir.z0 + 2.0;
  const cells: [number, number][] = [];
  for (let x = gx0; x < ir.x1 - 2.0; x += pitch) for (let z = gz0; z < ir.z1 - 2.0; z += pitch) cells.push([x, z]);
  rng.shuffle(cells);
  for (const [x, z] of cells) {
    if (placed >= 5 || structures.length === 0) break;
    const kind = structures[structures.length - 1];
    const tmp: Box[] = [];
    if (kind === 'tube') {
      const alongX = rng.chance(0.5);
      const L2 = 3.2;
      const hx = alongX ? L2 / 2 : 0.4, hz = alongX ? 0.4 : L2 / 2;
      tmp.push(box([x - hx, 1.0, z - hz], [x + hx, 1.8, z + hz], 'plasticRed'));
      for (const e of [-1, 1]) {
        const lx = alongX ? x + e * (L2 / 2 - 0.35) : x;
        const lz = alongX ? z : z + e * (L2 / 2 - 0.35);
        tmp.push(box([lx - 0.18, 0, lz - 0.18], [lx + 0.18, 1.0, lz + 0.18], 'plasticBlue'));
      }
    } else if (kind === 'slide') {
      tmp.push(box([x - 0.6, 1.3, z - 0.6], [x + 0.6, 1.42, z + 0.6], 'plasticYellow'));
      tmp.push(box([x - 0.15, 0, z - 0.15], [x + 0.15, 1.3, z + 0.15], 'plasticBlue'));
      tmp.push(box([x - 0.6, 1.42, z - 0.6], [x + 0.6, 2.2, z - 0.52], 'plasticYellow', false));
      tmp.push(box([x - 0.6, 1.42, z - 0.6], [x - 0.52, 2.2, z + 0.6], 'plasticYellow', false));
      for (let k = 0; k < 3; k++) tmp.push(box([x + 0.6 + k * 0.9, 0.05 + (2 - k) * 0.42, z - 0.4], [x + 1.5 + k * 0.9, 0.05 + (2 - k) * 0.42 + 0.12, z + 0.4], 'plasticRed'));
    } else {
      const hw = 1.3;
      tmp.push(box([x - hw, 0, z - hw], [x + hw, 0.55, z - hw + 0.15], 'plasticBlue'));
      tmp.push(box([x - hw, 0, z + hw - 0.15], [x + hw, 0.55, z + hw], 'plasticBlue'));
      tmp.push(box([x - hw, 0, z - hw + 0.15], [x - hw + 0.15, 0.55, z + hw - 0.15], 'plasticBlue'));
      tmp.push(box([x + hw - 0.15, 0, z - hw + 0.15], [x + hw, 0.55, z + hw - 0.15], 'plasticBlue'));
      tmp.push(box([x - hw + 0.15, 0.3, z - hw + 0.15], [x + hw - 0.15, 0.4, z + hw - 0.15], 'plasticYellow', false));
    }
    if (!tmp.filter((b) => b.solid).every((b) => canPlace(c, b, { gap: 0.6 }) && b.max[1] < h - 0.3)) continue;
    L.boxes.push(...tmp);
    if (kind === 'pit') {
      const ball = spec('plasticRed', [0.16, 0.16, 0.16]);
      const ball2 = spec('plasticYellow', [0.16, 0.16, 0.16]);
      for (let k = 0; k < 40; k++) put(rng.chance(0.5) ? ball : ball2, [x + rng.float(-1.05, 1.05), 0.34, z + rng.float(-1.05, 1.05)], rng.float(0, Math.PI));
      commit(L, ball, ball2);
    }
    structures.pop();
    placed++;
  }
  // 柔らかい人工光: 天井パネルを 2.2 倍に広げる（×3 の後は 15 m 上の小さな点になり天井が黒く沈む）。明るめの環境光
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!isPanel(b, h)) continue;
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const hw = (b.max[0] - b.min[0]) * 1.1, hd = (b.max[2] - b.min[2]) * 1.1;
    L.boxes[i] = { ...b, min: [cx - hw, b.min[1], cz - hd], max: [cx + hw, b.max[1], cz + hd] };
  }
  for (const l of L.lights) l.color = 0xfff0dc;
  L.palette.lightColor = 0xfff0dc;
  L.palette.ambient = 0x8890a0;
}

// ---------------------------------------------------------------- R14 浸水学校（RoomGenerator GenericRoom + ShallowWater 0.3）
/** 教室: 黒板の壁へ向く机と椅子の列（instances）、反対の壁に昼光の窓（skyDay の箔 + 木枠）、緑の腰壁、木の床。水面は ShallowWater が敷く */
function dressR14(c: Ctx): void {
  const { L, h } = c;
  removeInterior(L, (b) => !isPanel(b, h) && b.mat !== 'columnConcrete');
  recolorShell(L, { floor: 'floorWood', wall: 'wallCream' });
  wallBands(L, c.rects, c.sockets, [{ y0: 0, y1: 1.1, mat: 'wallGreen', depth: 0.012 }]);
  const faces = innerFaces(c.rects);
  const main = c.rects[0];
  const onMain = (f: Face) => rectOfFace([main], f) !== null;
  const longestRun = (f: Face): [number, number] | null => freeRuns(f, c.sockets, 0.8).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0] ?? null;
  const cands = faces.filter((f) => onMain(f) && f.dir !== 2 && longestRun(f) && longestRun(f)![1] - longestRun(f)![0] >= 3.0).sort((a, b) => (a.dir === 0 ? -1 : b.dir === 0 ? 1 : faceLen(b) - faceLen(a)));
  const board = cands[0];
  if (board) {
    const run = longestRun(board)!;
    const bw = Math.min(5.0, run[1] - run[0] - 0.6);
    const bc = (run[0] + run[1]) / 2;
    L.boxes.push(alongFace(board, bc - bw / 2, bw, 0.02, 0.05, 0.9, 2.1, 'chalkboard', false));
    L.boxes.push(alongFace(board, bc - bw / 2 - 0.05, bw + 0.1, 0.0, 0.06, 2.1, 2.16, 'trim', false));
    L.boxes.push(alongFace(board, bc - bw / 2 - 0.05, bw + 0.1, 0.0, 0.1, 0.84, 0.9, 'trim', false));
    L.boxes.push(alongFace(board, bc - bw / 2 - 0.05, 0.05, 0.0, 0.06, 0.9, 2.1, 'trim', false));
    L.boxes.push(alongFace(board, bc + bw / 2, 0.05, 0.0, 0.06, 0.9, 2.1, 'trim', false));
    signAt(L, board, bc + bw / 2 - 0.8, 1.85, 1.2, '9月17日（水）', { color: 0xf0ede4, background: 0x2f3d33, offset: 0.062 });
    // 机（黒板を向く）: 黒板から 2.2 m 空け、横 1.1 × 前後 1.4 m の格子
    const toBoard = board.dir; // 黒板を見る向き = 壁の外向き
    const nv = dirVec(toBoard);
    const desk = spec('furnitureLight', [0.6, 0.04, 0.45], true);
    const side = spec('metalDark', [0.03, 0.66, 0.42]);
    const seat = spec('furnitureLight', [0.4, 0.03, 0.4]);
    const backS = spec('furnitureLight', [0.4, 0.34, 0.03]);
    const ir = inner(main, WALL_T + 1.6);
    const along = board.horizontal ? [ir.x0, ir.x1] : [ir.z0, ir.z1];
    const depthLo = board.horizontal ? ir.z0 : ir.x0;
    const depthHi = board.horizontal ? ir.z1 : ir.x1;
    // 黒板側から奥へ
    const fromBoard = board.inward > 0 ? depthLo : depthHi;
    let count = 0;
    for (let k = 0; k < 40 && count < 120; k++) {
      const dpos = fromBoard + board.inward * (2.2 + k * 1.4);
      if (dpos < depthLo || dpos > depthHi) break;
      const n = Math.floor((along[1] - along[0]) / 1.1);
      const start = along[0] + ((along[1] - along[0]) - n * 1.1) / 2 + 0.55;
      for (let i = 0; i < n && count < 120; i++) {
        const a = start + i * 1.1;
        const px = board.horizontal ? a : dpos;
        const pz = board.horizontal ? dpos : a;
        const fp = box([px - 0.32, 0, pz - 0.32], [px + 0.32, 0.9, pz + 0.32], 'furnitureLight');
        const fp2 = box([px - nv[0] * 0.55 - 0.22, 0, pz - nv[2] * 0.55 - 0.22], [px - nv[0] * 0.55 + 0.22, 0.9, pz - nv[2] * 0.55 + 0.22], 'furnitureLight');
        if (!canPlace(c, fp, { gap: 0.15 }) || !canPlace(c, fp2, { gap: 0.1 })) continue;
        const yaw = yawOfDir(toBoard);
        put(desk, [px, 0.68, pz], yaw);
        const rv = dirVec(((toBoard + 1) % 4) as Dir);
        for (const s of [-1, 1]) put(side, [px + rv[0] * s * 0.28, 0, pz + rv[2] * s * 0.28], yaw);
        put(seat, [px - nv[0] * 0.55, 0.42, pz - nv[2] * 0.55], yaw);
        put(backS, [px - nv[0] * 0.74, 0.45, pz - nv[2] * 0.74], yaw);
        count++;
      }
    }
    commit(L, desk, side, seat, backS);
  }
  // 窓: 黒板の反対の壁（無ければ最長の側壁）に昼光の箔 + 木枠
  const opp = faces.filter((f) => onMain(f) && f !== board && f.dir !== 2 && (!board || f.dir === (board.dir + 2) % 4)).sort((a, b) => faceLen(b) - faceLen(a))[0]
    ?? faces.filter((f) => onMain(f) && f !== board && f.dir !== 2).sort((a, b) => faceLen(b) - faceLen(a))[0];
  if (opp) {
    let windows = 0;
    for (const [a0, a1] of freeRuns(opp, c.sockets, 0.6)) {
      for (let t = a0 + 1.0; t + 0.7 < a1 - 0.3 && windows < 8; t += 2.2) {
        L.boxes.push(alongFace(opp, t - 0.6, 1.2, 0.02, 0.035, 0.9, 2.3, 'skyDay', false));
        L.boxes.push(alongFace(opp, t - 0.66, 0.06, 0.0, 0.06, 0.85, 2.36, 'trim', false));
        L.boxes.push(alongFace(opp, t + 0.6, 0.06, 0.0, 0.06, 0.85, 2.36, 'trim', false));
        L.boxes.push(alongFace(opp, t - 0.66, 1.32, 0.0, 0.12, 0.85, 0.9, 'trim', false));
        L.boxes.push(alongFace(opp, t - 0.66, 1.32, 0.0, 0.06, 2.3, 2.36, 'trim', false));
        windows++;
      }
    }
    if (windows) L.lighting = { ...(L.lighting ?? {}), areaEmitters: true };
  }
  for (const l of L.lights) l.color = 0xe8f0fc;
  L.palette.lightColor = 0xe8f0fc;
  L.palette.ambient = 0xa6b2c0;
  const entry = entryOf(L);
  if (entry && entry.type !== 'hole') {
    const f = faces.find((q) => q.dir === entry.dir && Math.abs((q.horizontal ? entry.pos[2] : entry.pos[0]) - q.coord) < 0.05);
    if (f) {
      const t = (f.horizontal ? entry.pos[0] : entry.pos[2]) + entry.width / 2 + 0.45;
      if (t + 0.25 < f.a1 - 0.1) signAt(L, f, t, 2.0, 0.5, '2-B');
    }
  }
}

// ---------------------------------------------------------------- R15 絨毯化する設備通路（CorridorService + MaterialGradient）
/**
 * 進行度 t（MaterialGradient と同じ入口→end の軸で bounds を射影）に沿って、床に赤い模様カーペットの箔を t 0.35〜0.55 で
 * 疎らに、0.55 以降で全面に敷き、保護レール（黄帯・下段の金属帯）を t 0.6 で切り、奥半分に木の腰壁と暖色の壁灯を足す
 */
function dressR15(c: Ctx): void {
  const { L, rng } = c;
  const entry = entryOf(L);
  const end = L.sockets.find((s) => s.id === 'end') ?? L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
  if (!entry || !end) return;
  let ax = end.pos[0] - entry.pos[0];
  let az = end.pos[2] - entry.pos[2];
  const n = Math.hypot(ax, az);
  if (n < 0.5) { ax = 0; az = 1; } else { ax /= n; az /= n; }
  const b = L.bounds;
  let lo = Infinity, hi = -Infinity;
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) { const d = x * ax + z * az; lo = Math.min(lo, d); hi = Math.max(hi, d); }
  const tOf = (x: number, z: number) => Math.max(0, Math.min(1, (x * ax + z * az - lo) / Math.max(0.001, hi - lo)));
  // カーペットの箔（0.5 m の帯を連結）
  for (const r of c.rects) {
    const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
    const a0 = (alongZ ? r.z0 : r.x0) + WALL_T + 0.04;
    const a1 = (alongZ ? r.z1 : r.x1) - WALL_T - 0.04;
    const c0 = (alongZ ? r.x0 : r.z0) + WALL_T + 0.05;
    const c1 = (alongZ ? r.x1 : r.z1) - WALL_T - 0.05;
    const mid = (c0 + c1) / 2;
    let runStart: number | null = null;
    const flush = (endA: number) => {
      if (runStart === null) return;
      if (endA - runStart > 0.05) L.boxes.push(alongZ ? box([c0, 0.002, runStart], [c1, 0.01, endA], 'carpetPattern', false) : box([runStart, 0.002, c0], [endA, 0.01, c1], 'carpetPattern', false));
      runStart = null;
    };
    for (let a = a0; a < a1 - 0.01; a += 0.5) {
      const e = Math.min(a1, a + 0.5);
      const t = alongZ ? tOf(mid, (a + e) / 2) : tOf((a + e) / 2, mid);
      const on = t > 0.55 || (t > 0.35 && rng.chance((t - 0.35) / 0.2));
      if (on) { if (runStart === null) runStart = a; }
      else flush(a);
    }
    flush(a1);
  }
  // 保護レール（黄帯・金属帯）を t 0.6 で切る
  const from = c.start;
  const keep = L.boxes.slice(0, from);
  for (const bx of L.boxes.slice(from)) {
    const isBand = !bx.solid && (bx.mat === 'yellowLine' || bx.mat === 'metalDark') && bx.max[1] - bx.min[1] <= 0.12 && bx.max[1] < 1.2 && Math.max(bx.max[0] - bx.min[0], bx.max[2] - bx.min[2]) >= 1.0 && Math.min(bx.max[0] - bx.min[0], bx.max[2] - bx.min[2]) <= 0.1;
    if (!isBand) { keep.push(bx); continue; }
    const alongX = bx.max[0] - bx.min[0] >= bx.max[2] - bx.min[2];
    const cz = (bx.min[2] + bx.max[2]) / 2, cx = (bx.min[0] + bx.max[0]) / 2;
    const tA = alongX ? tOf(bx.min[0], cz) : tOf(cx, bx.min[2]);
    const tB = alongX ? tOf(bx.max[0], cz) : tOf(cx, bx.max[2]);
    const cut = 0.6;
    if (tA >= cut && tB >= cut) continue;
    if (tA < cut && tB < cut) { keep.push(bx); continue; }
    const k = (cut - tA) / (tB - tA);
    const at = (alongX ? bx.min[0] : bx.min[2]) + k * (alongX ? bx.max[0] - bx.min[0] : bx.max[2] - bx.min[2]);
    const nb: Box = { ...bx, min: [...bx.min] as Vec3, max: [...bx.max] as Vec3 };
    if (tA < tB) nb.max[alongX ? 0 : 2] = at; else nb.min[alongX ? 0 : 2] = at;
    if (nb.max[alongX ? 0 : 2] - nb.min[alongX ? 0 : 2] > 0.1) keep.push(nb);
  }
  L.boxes = keep;
  // 奥半分の木の腰壁と暖色の壁灯
  for (const f of innerFaces(c.rects)) {
    for (const [r0, r1] of freeRuns(f, c.sockets, 0.4)) {
      const pA = onFace(f, r0, 0, 0), pB = onFace(f, r1, 0, 0);
      const tA = tOf(pA[0], pA[2]), tB = tOf(pB[0], pB[2]);
      if (tA < 0.6 && tB < 0.6) continue;
      let s0 = r0, s1 = r1;
      if (tA < 0.6) s0 = r0 + ((0.6 - tA) / (tB - tA)) * (r1 - r0);
      if (tB < 0.6) s1 = r1 - ((0.6 - tB) / (tA - tB)) * (r1 - r0);
      if (s1 - s0 < 0.3) continue;
      L.boxes.push(alongFace(f, s0, s1 - s0, 0.07, 0.082, 0.1, 0.9, 'furnitureDark', false));
      L.boxes.push(alongFace(f, s0, s1 - s0, 0.07, 0.1, 0.9, 0.94, 'trim', false));
      for (let t = s0 + 2.0; t < s1 - 1.0; t += 4.0) L.boxes.push(alongFace(f, t - 0.07, 0.14, 0.04, 0.12, 1.6, 1.82, 'lightWarm', false));
    }
  }
}

// ---------------------------------------------------------------- R16 縮尺異常オフィス（RoomGenerator OfficeGrid + ScaleAnomaly perProp）
/** 空いた壁面に大きさの揃わない偽扉（1 箱 = perProp が一体で拡縮する）と番号プレート、艶床。小型扉・巨大扉は ScaleAnomaly が作る */
function dressR16(c: Ctx): void {
  const { L, h, rng } = c;
  const sizes: [number, number][] = [[0.5, 1.15], [0.9, 2.05], [1.25, 2.7], [0.7, 1.5], [0.9, 2.05]];
  const floorNo = rng.int(2, 9);
  let placed = 0;
  let k = 1;
  const faces = rng.shuffle(innerFaces(c.rects).filter((f) => faceLen(f) >= 5));
  for (const f of faces) {
    if (placed >= 5) break;
    for (const [a0, a1] of freeRuns(f, c.sockets, 2.2)) {
      if (placed >= 5) break;
      for (let t = a0 + 1.6; t < a1 - 1.6 && placed < 5; t += 3.8) {
        const [w, hgt] = rng.pick(sizes);
        if (hgt > h - 0.3) continue;
        const d = alongFace(f, t - w / 2, w, 0.02, 0.06, 0.005, hgt, L.palette.door, false);
        if (interior(L).some((q) => q.solid && boxesOverlap(q, d, 0.6))) continue;
        L.boxes.push(d);
        signAt(L, f, t + w / 2 + 0.28, Math.min(1.5, hgt + 0.2), 0.3, `${floorNo}${String(k++).padStart(2, '0')}`);
        placed++;
      }
    }
  }
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.3) };
}

// ---------------------------------------------------------------- R17 無限病棟（CorridorHospital + RepeatDestination）
/**
 * 白タイルの床・腰壁、ベンチを外して廊下の両側（狭ければ右側だけ）に白いベッド（whiteFabric のマットレス + metalDark の脚・ヘッドボード、instances）、
 * 扉・ベッドの番号は 301 / 302 の交互（階は 3 + 反復回数）。冷白色はテンプレートのまま
 */
function dressR17(c: Ctx): void {
  const { L } = c;
  recolorShell(L, { floor: 'floorTile' });
  for (let i = c.start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid && b.mat === 'wainscotCream') L.boxes[i] = { ...b, mat: 'floorTile' };
  }
  removeInterior(L, (b) => b.solid && (b.mat === 'seatBlue' || (b.mat === 'metalDark' && b.max[1] <= 0.45)));
  const floorNo = 3 + Math.max(0, Math.min(6, Math.round(num(c.p.node?.repeat, 0))));
  const hd = headings(c.rects);
  const faces = innerFaces(c.rects);
  const mattress = spec('whiteFabric', [0.9, 0.2, 2.0], true);
  const frame = spec('metalDark', [0.94, 0.05, 2.04]);
  const leg = spec('metalDark', [0.05, 0.45, 0.05]);
  const head = spec('metalDark', [0.9, 0.55, 0.04]);
  const pillow = spec('whiteFabric', [0.5, 0.1, 0.32]);
  let bedNo = 0;
  const bedPlates: SignSpec[] = [];
  const entry = entryOf(L);
  for (const f of faces) {
    const r = rectOfFace(c.rects, f);
    if (!r) continue;
    const width = f.horizontal ? r.z1 - r.z0 : r.x1 - r.x0;
    const hdg = hd[c.rects.indexOf(r)] ?? 0;
    const right = f.dir === (hdg + 3) % 4;
    const left = f.dir === (hdg + 1) % 4;
    if (!right && !left) continue;
    if (left && width < 3.4) continue;
    for (const [a0, a1] of freeRuns(f, c.sockets, 1.2)) {
      const pitch = 2.7;
      const n = Math.floor((a1 - a0 - 0.4) / pitch);
      if (n <= 0) continue;
      const start = a0 + ((a1 - a0) - n * pitch) / 2 + pitch / 2 + (left ? 0.6 : 0);
      for (let k = 0; k < n; k++) {
        const t = start + k * pitch;
        if (t + 1.0 > a1 - 0.2) continue;
        const fp = alongFace(f, t - 1.0, 2.0, 0.05, 0.95, 0, 0.9, 'whiteFabric', true);
        if (hitsZone(c.zones, fp) || !insideRects(c.rects, fp, WALL_T)) continue;
        const cpos = onFace(f, t, 0.5, 0);
        const yaw = f.horizontal ? Math.PI / 2 : 0;
        put(mattress, [cpos[0], 0.5, cpos[2]], yaw);
        put(frame, [cpos[0], 0.45, cpos[2]], yaw);
        for (const [u, v] of [[-0.4, -0.95], [0.4, -0.95], [-0.4, 0.95], [0.4, 0.95]]) {
          const lp = f.horizontal ? onFace(f, t + v, 0.5 + u, 0) : onFace(f, t + v, 0.5 + u, 0);
          put(leg, [lp[0], 0, lp[2]], yaw);
        }
        // ヘッドボードと枕は進行方向の手前側
        const headSide = k % 2 === 0 ? -1 : 1;
        const hp = onFace(f, t + headSide * 0.98, 0.5, 0);
        put(head, [hp[0], 0.45, hp[2]], yaw);
        const pp = onFace(f, t + headSide * 0.7, 0.5, 0);
        put(pillow, [pp[0], 0.7, pp[2]], yaw);
        bedPlates.push({ text: String(floorNo * 100 + 1 + (bedNo % 2)), pos: onFace(f, t, 0.035, 1.75), dir: facing(f), width: 0.4, kind: 'plate' });
        bedNo++;
      }
    }
  }
  commit(L, mattress, frame, leg, head, pillow);
  // 扉のプレート（診察室 1 …）を 301 / 302 の交互に
  const plates = (L.signs ?? []).filter((s) => s.kind === 'plate' && s.width <= 0.4).sort((a, b) => (entry ? dist2(a.pos, entry.pos) - dist2(b.pos, entry.pos) : 0));
  plates.forEach((s, i) => { s.text = String(floorNo * 100 + 1 + (i % 2)); s.width = 0.4; });
  bedPlates.sort((a, b) => (entry ? dist2(a.pos, entry.pos) - dist2(b.pos, entry.pos) : 0));
  for (const s of bedPlates.slice(0, 20)) pushSign(L, s);
}

// ---------------------------------------------------------------- R18 密閉風洞廊下（RoomGenerator GenericRoom + ExternalForce wind）
/** コンクリートの空洞に: 風上の端壁に大きな換気グリル（metalDark の格子）、風下に四角い大型ファン、冷白色（風の筋は不自然なため置かない） */
function dressR18(c: Ctx): void {
  const { L, h } = c;
  removeInterior(L, (b) => !isPanel(b, h));
  recolorShell(L, { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark' });
  // 風向（ExternalForce.forceVector と同じ規則: params.vector → 入口→最初の出口の主軸 → +Z）
  const prm = modParams(c.p, 'ExternalForce');
  let v: Vec3 = [0, 0, 1];
  const pv = prm.vector;
  if (Array.isArray(pv) && pv.length === 3 && pv.every((x) => typeof x === 'number') && Math.hypot(pv[0], pv[2]) > 1e-6) {
    v = Math.abs(pv[2]) >= Math.abs(pv[0]) ? [0, 0, Math.sign(pv[2])] : [Math.sign(pv[0]), 0, 0];
  } else {
    const entry = entryOf(L);
    const exit = L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
    if (entry && exit) {
      const dx = exit.pos[0] - entry.pos[0], dz = exit.pos[2] - entry.pos[2];
      if (Math.abs(dx) > 0.5 || Math.abs(dz) > 0.5) v = Math.abs(dz) >= Math.abs(dx) ? [0, 0, Math.sign(dz)] : [Math.sign(dx), 0, 0];
    }
  }
  const downDir: Dir = v[2] > 0.5 ? 0 : v[0] > 0.5 ? 1 : v[2] < -0.5 ? 2 : 3;
  const upDir: Dir = ((downDir + 2) % 4) as Dir;
  const faces = innerFaces(c.rects);
  const pickFace = (dir: Dir) => faces.filter((f) => f.dir === dir).map((f) => ({ f, run: freeRuns(f, c.sockets, 0.8).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0] })).filter((x) => x.run && x.run[1] - x.run[0] >= 3.6).sort((a, b) => (b.run![1] - b.run![0]) - (a.run![1] - a.run![0]))[0];
  const bar = spec('metalDark', [3.2, 0.04, 0.06]);
  const vbar = spec('metalDark', [0.04, 2.0, 0.06]);
  const up = pickFace(upDir);
  if (up) {
    const f = up.f;
    const cc = (up.run![0] + up.run![1]) / 2;
    const y0 = 0.7, y1 = Math.min(h - 0.3, 2.7);
    const yaw = f.horizontal ? 0 : Math.PI / 2;
    L.boxes.push(alongFace(f, cc - 1.6, 3.2, 0.02, 0.05, y0, y1, 'void', false));
    L.boxes.push(alongFace(f, cc - 1.7, 3.4, 0.0, 0.1, y1, y1 + 0.1, 'metalDark', false));
    L.boxes.push(alongFace(f, cc - 1.7, 3.4, 0.0, 0.1, y0 - 0.1, y0, 'metalDark', false));
    L.boxes.push(alongFace(f, cc - 1.7, 0.1, 0.0, 0.1, y0, y1, 'metalDark', false));
    L.boxes.push(alongFace(f, cc + 1.6, 0.1, 0.0, 0.1, y0, y1, 'metalDark', false));
    for (let y = y0 + 0.15; y < y1 - 0.05; y += 0.2) put(bar, onFace(f, cc, 0.08, y), yaw);
    vbar.size = [0.04, y1 - y0, 0.06];
    for (let t = -1.45; t <= 1.45; t += 0.29) put(vbar, onFace(f, cc + t, 0.08, y0), yaw);
  }
  const down = pickFace(downDir);
  if (down) {
    const f = down.f;
    const runLen = down.run![1] - down.run![0];
    const centers = runLen >= 6.8 ? [(down.run![0] + down.run![1]) / 2 - 1.7, (down.run![0] + down.run![1]) / 2 + 1.7] : [(down.run![0] + down.run![1]) / 2];
    for (const cc of centers) {
      const y0 = 0.5, y1 = Math.min(h - 0.25, 3.1);
      const cy = (y0 + y1) / 2;
      const half = (y1 - y0) / 2;
      L.boxes.push(alongFace(f, cc - half, half * 2, 0.02, 0.05, y0, y1, 'void', false));
      L.boxes.push(alongFace(f, cc - half - 0.2, half * 2 + 0.4, 0.0, 0.3, y1, y1 + 0.2, 'metalDark', false));
      L.boxes.push(alongFace(f, cc - half - 0.2, half * 2 + 0.4, 0.0, 0.3, y0 - 0.2, y0, 'metalDark', false));
      L.boxes.push(alongFace(f, cc - half - 0.2, 0.2, 0.0, 0.3, y0, y1, 'metalDark', false));
      L.boxes.push(alongFace(f, cc + half, 0.2, 0.0, 0.3, y0, y1, 'metalDark', false));
      L.boxes.push(alongFace(f, cc - 0.25, 0.5, 0.05, 0.3, cy - 0.25, cy + 0.25, 'metalDark', false));
      L.boxes.push(alongFace(f, cc - 0.17, 0.34, 0.08, 0.16, y0 + 0.1, y1 - 0.1, 'metalDark', false));
      L.boxes.push(alongFace(f, cc - half + 0.1, half * 2 - 0.2, 0.08, 0.16, cy - 0.17, cy + 0.17, 'metalDark', false));
    }
  }
  // 風の筋（静止した白線 26 本）は不自然なため削除（2026-09-17）。風は ExternalForce の押し出しと音で伝える
  commit(L, bar, vbar);
  for (const l of L.lights) l.color = 0xe4ecff;
  L.palette.lightColor = 0xe4ecff;
  L.palette.ambient = 0x7a808c;
  signOnWall(L, faces, c.sockets, 'WIND TUNNEL 03', { y: Math.min(h - 0.4, 2.2), width: 1.4, prefer: [2, 1, 3], sub: '風洞試験室', color: 0x20232a, background: 0xd9b52e });
}

// ---------------------------------------------------------------- R19 無人喫茶店（RoomGenerator RetailRoom + ParticleDetail steam）
/** 棚を捨て、木の床と腰壁、カウンター（エスプレッソマシン・カップ・黒板「GOOD COFFEE STILL HERE」）、丸机と椅子、机ごとのペンダントランプ。器具は消灯 */
function dressR19(c: Ctx): void {
  const { L, h, rng } = c;
  removeInterior(L, (b) => !isPanel(b, h) && b.mat !== 'columnConcrete');
  recolorShell(L, { floor: 'floorWood', wall: 'wallCream' });
  wallBands(L, c.rects, c.sockets, [{ y0: 0, y1: 1.0, mat: 'woodPanel', depth: 0.015 }, { y0: 1.0, y1: 1.04, mat: 'trim', depth: 0.03 }]);
  recolorPanels(L, 'lightOff', false);
  for (const l of L.lights) { l.intensity *= 0.3; l.color = 0xffcf8a; }
  const faces = innerFaces(c.rects);
  const entry = entryOf(L);
  // カウンター: 入口の壁以外で最長の空き区間
  const cands = faces.filter((f) => !entry || f.dir !== entry.dir).flatMap((f) => freeRuns(f, c.sockets, 1.2).map((run) => ({ f, run }))).sort((a, b) => (b.run[1] - b.run[0]) - (a.run[1] - a.run[0]));
  let counter: Box | null = null;
  for (const { f, run } of cands) {
    const len = Math.min(4.2, run[1] - run[0] - 0.6);
    if (len < 2.0) continue;
    const at = (run[0] + run[1]) / 2 - len / 2;
    const body = alongFace(f, at, len, 0.05, 0.65, 0, 0.95, 'furnitureDark', true);
    if (!canPlace(c, body, { lanes: false, gap: 0.3 })) continue;
    L.boxes.push(body);
    counter = body;
    L.boxes.push(alongFace(f, at - 0.02, len + 0.04, 0.03, 0.7, 0.95, 0.99, 'woodPanel', false));
    L.boxes.push(alongFace(f, at, len, 0.0, 0.25, 1.5, 1.53, 'bookshelfWood', false));
    L.boxes.push(alongFace(f, at + 0.3, 0.6, 0.12, 0.6, 0.99, 1.45, 'stainless', false));
    L.boxes.push(alongFace(f, at + 0.45, 0.06, 0.6, 0.62, 1.3, 1.34, 'neonRed', false));
    const cups = spec('whiteFabric', [0.08, 0.09, 0.08]);
    for (let t = at + 0.25; t < at + len - 0.2; t += 0.3) put(cups, onFace(f, t, 0.12, 1.53), 0);
    commit(L, cups);
    const bc = at + len / 2 + 0.3;
    L.boxes.push(alongFace(f, bc - 0.7, 1.4, 0.02, 0.05, 1.75, 2.65, 'chalkboard', false));
    L.boxes.push(alongFace(f, bc - 0.75, 1.5, 0.0, 0.06, 2.65, 2.7, 'trim', false));
    L.boxes.push(alongFace(f, bc - 0.75, 1.5, 0.0, 0.06, 1.7, 1.75, 'trim', false));
    L.boxes.push(alongFace(f, bc - 0.75, 0.05, 0.0, 0.06, 1.75, 2.65, 'trim', false));
    L.boxes.push(alongFace(f, bc + 0.7, 0.05, 0.0, 0.06, 1.75, 2.65, 'trim', false));
    signAt(L, f, bc, 2.28, 1.3, 'GOOD COFFEE', { color: 0xf4f1e8, background: 0x2f3d33, offset: 0.062, sub: 'STILL HERE' });
    break;
  }
  // 丸机（45° ずらした天板 2 枚）+ 椅子 2 脚 + カップ、ペンダントランプ
  const top0 = spec('furnitureDark', [0.7, 0.03, 0.7], true);
  const top1 = spec('furnitureDark', [0.7, 0.03, 0.7]);
  const ped = spec('metalDark', [0.06, 0.72, 0.06]);
  const base = spec('metalDark', [0.42, 0.02, 0.42]);
  const seat = spec('furnitureDark', [0.4, 0.04, 0.4]);
  const back = spec('furnitureDark', [0.4, 0.4, 0.04]);
  const cped = spec('metalDark', [0.05, 0.45, 0.05]);
  const cup = spec('whiteFabric', [0.08, 0.09, 0.08]);
  const main = c.rects[0];
  const ir = inner(main, WALL_T + 1.4);
  const pitch = 2.3;
  const nx = Math.max(0, Math.floor((ir.x1 - ir.x0) / pitch));
  const nz = Math.max(0, Math.floor((ir.z1 - ir.z0) / pitch));
  const ox = ir.x0 + ((ir.x1 - ir.x0) - nx * pitch) / 2 + pitch / 2;
  const oz = ir.z0 + ((ir.z1 - ir.z0) - nz * pitch) / 2 + pitch / 2;
  const tables: Vec3[] = [];
  for (let i = 0; i < nx && tables.length < 12; i++) {
    for (let j = 0; j < nz && tables.length < 12; j++) {
      const x = ox + i * pitch + rng.float(-0.15, 0.15);
      const z = oz + j * pitch + rng.float(-0.15, 0.15);
      const fp = box([x - 0.8, 0, z - 0.55], [x + 0.8, 0.9, z + 0.55], 'furnitureDark');
      if (!canPlace(c, fp, { gap: 0.4 })) continue;
      if (counter && boxesOverlap(counter, fp, 1.2)) continue;
      tables.push([x, 0, z]);
      put(top0, [x, 0.72, z], 0);
      put(top1, [x, 0.72, z], Math.PI / 4);
      put(ped, [x, 0, z], 0);
      put(base, [x, 0, z], Math.PI / 4);
      for (const s of [-1, 1]) {
        put(seat, [x + s * 0.62, 0.45, z], 0);
        put(cped, [x + s * 0.62, 0, z], 0);
        put(back, [x + s * 0.82, 0.49, z], Math.PI / 2);
      }
      if (rng.chance(0.6)) put(cup, [x + rng.float(-0.15, 0.15), 0.735, z + rng.float(-0.15, 0.15)], 0);
      const yTop = Math.min(h, 2.05 + 0.3);
      L.boxes.push(box([x - 0.01, 2.03, z - 0.01], [x + 0.01, yTop >= h ? h : h, z + 0.01], 'metalDark', false));
      L.boxes.push(box([x - 0.16, 1.85, z - 0.16], [x + 0.16, 2.03, z + 0.16], 'metalDark', false));
      L.boxes.push(box([x - 0.1, 1.83, z - 0.1], [x + 0.1, 1.85, z + 0.1], 'lightWarm', false));
    }
  }
  commit(L, top0, top1, ped, base, seat, back, cped, cup);
  tables.sort((a, b) => (entry ? dist2(a, entry.pos) - dist2(b, entry.pos) : 0));
  for (const t of tables.slice(0, 2)) addLight(c, [t[0], 1.7, t[2]], 0xffcf8a, 0.7, 6);
  L.palette.light = 'lightOff';
  L.palette.lightColor = 0xffcf8a;
  L.palette.ambient = 0x4a4038;
  if (entry && entry.type !== 'hole') {
    const f = faces.find((q) => q.dir === entry.dir && Math.abs((q.horizontal ? entry.pos[2] : entry.pos[0]) - q.coord) < 0.05);
    if (f) {
      const t = (f.horizontal ? entry.pos[0] : entry.pos[2]) - entry.width / 2 - 0.6;
      if (t - 0.3 > f.a0 + 0.1) signAt(L, f, t, 2.0, 0.6, 'OPEN', { kind: 'emissive', color: 0xff6a5a, background: 0x1a0e10 });
    }
  }
}

// ---------------------------------------------------------------- R20 巨大トランクルーム（GridGenerator StorageGrid + PropRepetition storageDoor + DuplicateNumber）
/**
 * 扉は PropRepetition(storageDoor) が後で金属ブロックの長い面に置く（rooms.json の params.doorMat 'redShutter' で赤いシャッターの化粧板、
 * 取手、枡）。番号板は DuplicateNumber。ここでは扉の規則を二重に持たず、空間の印象だけを補う: 通路上の器具を蛍光灯のライン（長いストリップ）に
 * 置き換え、環境光を灰に落とす。以前の redShutter のソリッド箔（最大 260）と自前の番号板は Modifier 側の params 対応で不要になったので外した
 */
function dressR20(c: Ctx): void {
  const { L, h } = c;
  const blocks = interior(L).filter((b) => b.solid && b.mat === 'metal' && b.max[1] - b.min[1] >= 2.0 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 1.4 && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 1.2);
  if (blocks.length === 0) return;
  // 蛍光灯のライン: 通路の中心線に長いストリップ（元のパネルは外す）
  const alongX = blocks[0].max[0] - blocks[0].min[0] >= blocks[0].max[2] - blocks[0].min[2];
  removeInterior(L, (b) => isPanel(b, h));
  const main = c.rects[0];
  const rows = [...new Set(blocks.map((b) => Math.round((alongX ? (b.min[2] + b.max[2]) / 2 : (b.min[0] + b.max[0]) / 2) * 10) / 10))].sort((a, b) => a - b);
  const depth = alongX ? blocks[0].max[2] - blocks[0].min[2] : blocks[0].max[0] - blocks[0].min[0];
  const lo = (alongX ? main.z0 : main.x0) + WALL_T;
  const hi = (alongX ? main.z1 : main.x1) - WALL_T;
  const aisles: number[] = [];
  if (rows[0] - depth / 2 - lo > 1.4) aisles.push((lo + rows[0] - depth / 2) / 2);
  for (let i = 0; i + 1 < rows.length; i++) aisles.push((rows[i] + rows[i + 1]) / 2);
  if (hi - (rows[rows.length - 1] + depth / 2) > 1.4) aisles.push((rows[rows.length - 1] + depth / 2 + hi) / 2);
  const l0 = (alongX ? main.x0 : main.z0) + 1.0;
  const l1 = (alongX ? main.x1 : main.z1) - 1.0;
  for (const a of aisles.slice(0, 12)) {
    L.boxes.push(alongX ? box([l0, h - 0.05, a - 0.12], [l1, h - 0.01, a + 0.12], 'lightPanel', false) : box([a - 0.12, h - 0.05, l0], [a + 0.12, h - 0.01, l1], 'lightPanel', false));
  }
  L.palette.ambient = 0x6e7076;
}
