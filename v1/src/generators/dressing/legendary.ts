/**
 * Legendary 20 部屋の部屋別ドレッシング（担当 L）。参考ボードの要点（docs/reference-rarities-analysis.md の LEGENDARY 表）を、
 * Generator（Mega / Street / Atrium / Grid / Parking / Room）が出した構造の上に「少数の大物 + 反復（instances）+ 色」で足す。
 *
 * 約束（dressing/index.ts と同じ）:
 * - 乱数は渡された rng（p.rng.fork('dress')）から部屋 ID → 要素ごとに fork したものだけ。Generator / Modifier の乱数列は変えない
 * - footprint・sockets・bounds・扉前 1.6 m・動線 1.2 m・階段は変えない。ソリッドを置く前に doorZones / 動線 / 既存ソリッドと照合する
 * - 予算: 部屋あたり 箱 +300 / 三角形 +40k / ライト +2。同型の反復は L.instances（Tier の instanceScale で間引かれる）
 * - Modifier の layout フックはこの後に走る。内装を書き換える Modifier（L12 ScaleAnomaly perProp / L13 PropRepetition / L03 InstanceOvergrowth）の
 *   対象にしたくない装飾は shellPush でシェル側（L.shellCount より前）に入れる（その分の扉前クリアは自分で保証する）
 * - 既に Generator / Modifier が出す要素（ゾーン・桟橋・麦・モノレール車両・雪・霧）は重複させず、不足分と色だけ足す
 * 各部屋の実装内容と保留理由は docs/reference-legendary.md。
 */
import type { AABB } from '../../core/aabb';
import type { Dir, Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { inner, rect, rectArea, type Rect } from '../footprint';
import { alongFace, keepOutZones, freeRuns, hitsZone, innerFaces, insideRects, signAt, signOnWall, type Face } from '../furniture';
import { car } from '../StreetGenerator.facade';
import { courtyardEdges } from '../MegaStructureGenerator.common';
import { box, snap, WALL_T, type Box, type GenParams, type InstanceSpec, type LightSpec, type MatId, type ParticleSpec, type RoomLayout, type SignSpec } from '../layout';
import { addParticles } from '../particles';

const FLOOR = 3.6;
const MAX_SIGNS = 46;
const MAX_LIGHTS = 2;

// ---------------------------------------------------------------- コンテキストと共通ヘルパ

interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  /** ドレッシング開始時の shellCount（内装の先頭） */
  shell: number;
  rects: Rect[];
  h: number;
  /** 扉前・床穴の禁止領域 */
  zones: AABB[];
  /** 入口 → 各出口の直線動線（地上のもの） */
  lanes: [[number, number], [number, number]][];
  lightsAdded: number;
}

function inwardOf(d: Dir): [number, number] {
  return d === 0 ? [0, -1] : d === 1 ? [-1, 0] : d === 2 ? [0, 1] : [1, 0];
}

function ctxOf(L: RoomLayout, p: GenParams, rng: Rng): Ctx {
  const rects = L.footprint.length ? L.footprint : [rect(L.bounds.min[0], L.bounds.min[2], L.bounds.max[0], L.bounds.max[2])];
  const lanes: [[number, number], [number, number]][] = [];
  const entry = L.sockets.find((s) => s.id === 'entry');
  if (entry && entry.type !== 'hole') {
    const ei = inwardOf(entry.dir);
    const a: [number, number] = [entry.pos[0] + ei[0] * 1.5, entry.pos[2] + ei[1] * 1.5];
    for (const s of L.sockets) {
      if (s.id === 'entry' || s.type === 'hole' || s.pos[1] > 0.1) continue;
      const si = inwardOf(s.dir);
      lanes.push([a, [s.pos[0] + si[0] * 1.5, s.pos[2] + si[1] * 1.5]]);
    }
  }
  return { L, p, rng, shell: L.shellCount ?? L.boxes.length, rects, h: L.height, zones: keepOutZones(L, null, 0.1), lanes, lightsAdded: 0 };
}

function overlap3(a: AABB, b: AABB, eps = 0.01): boolean {
  return a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps && a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps && a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
}

function overlapXZ(a: AABB, b: AABB, pad = 0): boolean {
  return a.min[0] < b.max[0] + pad && a.max[0] > b.min[0] - pad && a.min[2] < b.max[2] + pad && a.max[2] > b.min[2] - pad;
}

/** 既存のソリッド箱（シェル・構造・内装）と重なるか */
function overlapsSolid(c: Ctx, b: AABB, pad = 0.05, ignoreLow = 0, before = c.L.boxes.length): boolean {
  const q: AABB = { min: [b.min[0] - pad, b.min[1], b.min[2] - pad], max: [b.max[0] + pad, b.max[1], b.max[2] + pad] };
  const n = Math.min(before, c.L.boxes.length);
  for (let i = 0; i < n; i++) {
    const o = c.L.boxes[i];
    if (!o.solid || (ignoreLow > 0 && o.max[1] - o.min[1] <= ignoreLow)) continue;
    // 外壁（シェル側の薄く高い壁）は insideRects で既に避けている。pad ぶんの接触で弾かない
    if (i < c.shell && o.max[1] - o.min[1] >= 2 && Math.min(o.max[0] - o.min[0], o.max[2] - o.min[2]) <= WALL_T + 0.01) continue;
    if (overlap3(o, q)) return true;
  }
  return false;
}

/** 条件に合う箱（非ソリッド含む）と xz で重なるか。街灯の柱・マストなど細い非ソリッドの回避に使う */
function overlapsAny(c: Ctx, b: AABB, pred: (o: Box) => boolean, pad = 0.05): boolean {
  const q: AABB = { min: [b.min[0] - pad, b.min[1], b.min[2] - pad], max: [b.max[0] + pad, b.max[1], b.max[2] + pad] };
  for (const o of c.L.boxes) if (pred(o) && overlap3(o, q)) return true;
  return false;
}

/** 動線（入口 → 各出口の直線）から half 以内に掛かるか（地上に立つソリッドだけ照合する） */
function laneBlocked(c: Ctx, b: AABB, half = 0.7): boolean {
  if (b.min[1] > 1.9) return false;
  // 細い柱・杭・ポール（xz 1 m 未満）は動線を塞がない（回り込める）
  if (Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 1.0) return false;
  const r = rect(b.min[0] - half, b.min[2] - half, b.max[0] + half, b.max[2] + half);
  for (const [a, e] of c.lanes) {
    const len = Math.hypot(e[0] - a[0], e[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / 0.4));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((e[0] - a[0]) * i) / n;
      const z = a[1] + ((e[1] - a[1]) * i) / n;
      if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
    }
  }
  return false;
}

interface PlaceOpts {
  lanes?: boolean;
  solids?: boolean;
  pad?: number;
  margin?: number;
  /** この高さ以下のソリッド（車止め・段差）とは重なってよい */
  ignoreLow?: number;
  /** このインデックスより前の箱だけと照合する（自分が直前に置いた同種の箔と接してよいとき） */
  before?: number;
}

/** 箱を置けるか: 足跡の内側・扉前でない・動線を塞がない・既存ソリッドと重ならない */
function canPlace(c: Ctx, b: Box, o: PlaceOpts = {}): boolean {
  if (!insideRects(c.rects, b, o.margin ?? WALL_T)) return false;
  if (hitsZone(c.zones, b)) return false;
  if (b.solid && o.lanes !== false && laneBlocked(c, b)) return false;
  if (o.solids !== false && overlapsSolid(c, b, o.pad ?? 0.05, o.ignoreLow ?? 0, o.before ?? c.L.boxes.length)) return false;
  return true;
}

function push(c: Ctx, ...boxes: Box[]): void {
  c.L.boxes.push(...boxes);
}

/** シェル側（L.shellCount より前）に差し込む。内装を書き換える Modifier（perProp / PropRepetition / 麦）の対象から外す */
function shellPush(c: Ctx, boxes: Box[]): void {
  if (boxes.length === 0) return;
  const at = c.L.shellCount ?? c.L.boxes.length;
  c.L.boxes.splice(at, 0, ...boxes);
  c.L.shellCount = at + boxes.length;
}

function addLight(c: Ctx, l: LightSpec): void {
  if (c.lightsAdded >= MAX_LIGHTS) return;
  c.L.lights.push(l);
  c.lightsAdded++;
}

function addSign(c: Ctx, s: SignSpec, front = false): boolean {
  const n = c.L.signs?.length ?? 0;
  // RoomBuilder は先頭 48 枚だけ描く。Generator が既に 48 枚以上出している部屋（L04 の客室番号）では先頭に入れる
  if (front || n >= MAX_SIGNS) {
    (c.L.signs ??= []).unshift(s);
    return true;
  }
  (c.L.signs ??= []).push(s);
  return true;
}

/** InstancedMesh の反復配置（transforms はシャッフルして Tier の間引きが均一になるようにする） */
function addInstances(c: Ctx, rng: Rng, mat: MatId, size: Vec3, transforms: InstanceSpec['transforms'], solid = false): void {
  if (transforms.length === 0) return;
  rng.shuffle(transforms);
  (c.L.instances ??= []).push({ mat, size, transforms, solid });
}

/** 材質の差し替え（幾何は変えない）。range で対象を限定する */
function recolor(c: Ctx, pred: (b: Box, i: number) => boolean, mat: MatId, from = 0, to = c.L.boxes.length): number {
  let n = 0;
  for (let i = from; i < to; i++) {
    const b = c.L.boxes[i];
    if (b.mat === mat || !pred(b, i)) continue;
    c.L.boxes[i] = { ...b, mat };
    n++;
  }
  return n;
}

function aabbOfRect(r: Rect, y0 = 0, y1 = 1): AABB {
  return { min: [r.x0, y0, r.z0], max: [r.x1, y1, r.z1] };
}

function sizeOf(b: AABB): [number, number, number] {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

/** 面 f 上の点（面から off だけ室内側）。InstanceSpec の pos 用 */
function facePoint(f: Face, at: number, y: number, off: number): Vec3 {
  const n = f.face + f.inward * off;
  return f.horizontal ? [at, y, n] : [n, y, at];
}

/** 面 f に貼る箔の yaw（InstanceSpec の size は yaw=0 で x 方向に伸びる想定） */
function faceYaw(f: Face): number {
  return f.horizontal ? 0 : Math.PI / 2;
}

/** 面 f の室内側 near m 以内にある箱（窓格子などの衝突照合用の事前絞り込み） */
function boxesNearFace(c: Ctx, f: Face, near: number, y0: number, y1: number, solidOnly = true): Box[] {
  const lo = Math.min(f.face, f.face + f.inward * near);
  const hi = Math.max(f.face, f.face + f.inward * near);
  const out: Box[] = [];
  for (const b of c.L.boxes) {
    if (solidOnly && !b.solid) continue;
    if (b.max[1] <= y0 || b.min[1] >= y1) continue;
    if (f.horizontal) {
      if (b.max[2] <= lo || b.min[2] >= hi) continue;
      if (b.max[0] <= f.a0 || b.min[0] >= f.a1) continue;
    } else {
      if (b.max[0] <= lo || b.min[0] >= hi) continue;
      if (b.max[2] <= f.a0 || b.min[2] >= f.a1) continue;
    }
    out.push(b);
  }
  return out;
}

/** 地上のテーマゾーン（kind 'theme'）を preset 名で探す */
function themeZones(c: Ctx, preset: string): Rect[] {
  return (c.L.zones ?? [])
    .filter((z) => z.kind === 'theme' && z.params?.preset === preset && z.aabb.min[1] < 0.5)
    .map((z) => rect(z.aabb.min[0], z.aabb.min[2], z.aabb.max[0], z.aabb.max[2]));
}

// ---------------------------------------------------------------- StreetGrid の街区格子（StreetGenerator.grid.ts の deriveAxis と同じ式で復元）

interface Grid {
  x0: number;
  z0: number;
  w: number;
  d: number;
  nx: number;
  nz: number;
  sx: number;
  sz: number;
  bx: number;
  bz: number;
}

function deriveAxis(len: number): { n: number; s: number; b: number } {
  const n = len >= 56 ? 3 : len >= 34 ? 2 : 1;
  const sPref = n === 1 ? 6 : 7;
  const b = Math.max(6, snap((len - (n + 1) * sPref) / n));
  const s = (len - n * b) / (n + 1);
  return { n, s, b };
}

function streetGridOf(main: Rect): Grid {
  const w = main.x1 - main.x0;
  const d = main.z1 - main.z0;
  const ax = deriveAxis(w);
  const az = deriveAxis(d);
  return { x0: main.x0, z0: main.z0, w, d, nx: ax.n, nz: az.n, sx: ax.s, sz: az.s, bx: ax.b, bz: az.b };
}

function vStreet(g: Grid, k: number): [number, number] {
  const a = g.x0 + k * (g.sx + g.bx);
  return [a, a + g.sx];
}

function hStreet(g: Grid, j: number): [number, number] {
  const a = g.z0 + j * (g.sz + g.bz);
  return [a, a + g.sz];
}

function blockRect(g: Grid, i: number, j: number): Rect {
  const x = g.x0 + g.sx + i * (g.sx + g.bx);
  const z = g.z0 + g.sz + j * (g.sz + g.bz);
  return rect(x, z, x + g.bx, z + g.bz);
}

/** 街区に建物（高さ 3 m 以上のソリッド）があるか（無ければ広場） */
function blockHasBuilding(c: Ctx, r: Rect): boolean {
  for (let i = c.shell; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    if (!b.solid || b.max[1] - b.min[1] < 3) continue;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    if (cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1) return true;
  }
  return false;
}

/** 壁面上部の「夜景の塔」: 暗い箔の塔 + 窓明かりの点（instances）。y0..y1 の帯に、面 f に沿って並べる */
function skylineOnFace(rng: Rng, f: Face, y0: number, y1: number, inset: number, lit: InstanceSpec['transforms'], out: Box[], maxTowers: number): void {
  let t = f.a0 + rng.float(0.6, 1.6);
  let n = 0;
  // 長い壁でも面全体に行き渡るように、塔の幅は壁の長さに応じて広げる
  const wide = f.a1 - f.a0 > 60;
  while (t < f.a1 - 2.0 && n < maxTowers) {
    const tw = wide ? rng.float(4.0, 9.0) : rng.float(2.0, 5.0);
    if (t + tw > f.a1 - 0.5) break;
    const th = rng.float((y1 - y0) * 0.45, y1 - y0);
    const top = y0 + th;
    out.push(alongFace(f, t, tw, inset, inset + 0.04, y0, top, 'wallDark', false));
    // 窓明かり: 0.9 × 1.0 のピッチ、1/3 を点灯
    for (let y = y0 + 0.4; y + 0.3 < top - 0.2; y += 1.0) {
      for (let a = t + 0.35; a + 0.22 < t + tw - 0.25; a += 0.9) {
        if (!rng.chance(0.36)) continue;
        lit.push({ pos: facePoint(f, a + 0.11, y, inset + 0.05), yaw: faceYaw(f) });
      }
    }
    // 屋上の航空障害灯
    if (rng.chance(0.35)) out.push(alongFace(f, t + tw / 2 - 0.06, 0.12, inset, inset + 0.08, top, top + 0.12, 'neonRed', false));
    t += tw + (wide ? rng.float(1.5, 4.0) : rng.float(0.3, 1.6));
    n++;
  }
}

// ---------------------------------------------------------------- 入口

export function dressLegendary(L: RoomLayout, p: GenParams, rng: Rng): void {
  const c = ctxOf(L, p, rng.fork(p.def.id));
  switch (p.def.id) {
    case 'L01': return dressL01(c);
    case 'L02': return dressL02(c);
    case 'L03': return dressL03(c);
    case 'L04': return dressL04(c);
    case 'L05': return dressL05(c);
    case 'L06': return dressL06(c);
    case 'L07': return dressL07(c);
    case 'L08': return dressL08(c);
    case 'L09': return dressL09(c);
    case 'L10': return dressL10(c);
    case 'L11': return dressL11(c);
    case 'L12': return dressL12(c);
    case 'L13': return dressL13(c);
    case 'L14': return dressL14(c);
    case 'L15': return dressL15(c);
    case 'L16': return dressL16(c);
    case 'L17': return dressL17(c);
    case 'L18': return dressL18(c);
    case 'L19': return dressL19(c);
    case 'L20': return dressL20(c);
    default: return;
  }
}

// ---------------------------------------------------------------- L01 永久薄明都市（StreetGrid city）
// 窓明かりの密度を上げ、屋上にマスト・障害灯・給水塔を足して塔に見せる。内側の横街路 1 本を運河（水面 + 岸壁 + 橋 + 小舟）にする。
// 20〜40 m の塔は室高 12 m に収まらないので保留（青い霧 FogDepth と屋上の点で高さを示唆する）。

function dressL01(c: Ctx): void {
  const { L } = c;
  const rng = c.rng;
  const main = c.rects[0];
  const h = c.h;
  // 1) 窓明かり密度（色だけ）
  const wr = rng.fork('windows');
  recolor(c, (b) => b.mat === 'windowDark' && !b.solid && wr.chance(0.45), 'windowLit', c.shell);
  // 2) 屋上: マスト + 航空障害灯 + 給水塔
  const rr = rng.fork('roof');
  const buildingMats = new Set<MatId>(['wallConcrete', 'wallDark', 'wallBrick', 'wallWhite']);
  const roofs: Box[] = [];
  for (let i = c.shell; i < L.boxes.length && roofs.length < 60; i++) {
    const b = L.boxes[i];
    const [w, bh, d] = sizeOf(b);
    if (!b.solid || !buildingMats.has(b.mat) || bh < 5 || w < 3 || d < 3 || b.min[1] > 0.2 || b.max[1] > h - 0.6) continue;
    const top = b.max[1];
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    if (rr.chance(0.7)) {
      const mastTop = Math.min(h - 0.25, top + rr.float(2.0, 4.5));
      const mx = cx + rr.float(-w * 0.3, w * 0.3);
      const mz = cz + rr.float(-d * 0.3, d * 0.3);
      roofs.push(box([mx - 0.05, top, mz - 0.05], [mx + 0.05, mastTop, mz + 0.05], 'metal', false));
      roofs.push(box([mx - 0.09, mastTop - 0.05, mz - 0.09], [mx + 0.09, mastTop + 0.13, mz + 0.09], 'neonRed', false));
    }
    if (rr.chance(0.45)) {
      const tx = b.min[0] + rr.float(0.6, Math.max(0.6, w - 1.8));
      const tz = b.min[2] + rr.float(0.6, Math.max(0.6, d - 1.8));
      const th = Math.min(h - 0.3 - top, 1.4);
      if (th > 0.6) {
        roofs.push(box([tx, top, tz], [tx + 1.2, top + th, tz + 1.2], 'wallDark', false));
        roofs.push(box([tx + 0.5, top + th, tz + 0.5], [tx + 0.7, Math.min(h - 0.25, top + th + 0.5), tz + 0.7], 'metal', false));
      }
    }
  }
  push(c, ...roofs);
  // 2b) 低い建物の屋上に「上階の塔」（非ソリッドの暗い箔 + 窓明かりの instances）。天井の闇に消えて高層に見せる
  const tr = rng.fork('towers');
  const towerWin: InstanceSpec['transforms'] = [];
  let towers = 0;
  for (let i = c.shell; i < L.boxes.length && towers < 14; i++) {
    const b = L.boxes[i];
    const [w, bh, d] = sizeOf(b);
    if (!b.solid || !buildingMats.has(b.mat) || bh < 5 || w < 5 || d < 5 || b.min[1] > 0.2 || b.max[1] > h - 3.0) continue;
    if (!tr.chance(0.75)) continue;
    const inset = Math.min(w, d) * 0.18;
    const top = Math.min(h - 0.4, b.max[1] + tr.float(2.5, 4.5));
    const tb = box([b.min[0] + inset, b.max[1], b.min[2] + inset], [b.max[0] - inset, top, b.max[2] - inset], 'wallDark', false);
    push(c, tb);
    towers++;
    // 窓（4 面。3 m 階高、1.6 m ピッチ）
    const faces: [boolean, number, number, number, number][] = [
      [true, tb.max[2] + 0.03, tb.min[0], tb.max[0], 0], [true, tb.min[2] - 0.03, tb.min[0], tb.max[0], 0],
      [false, tb.max[0] + 0.03, tb.min[2], tb.max[2], Math.PI / 2], [false, tb.min[0] - 0.03, tb.min[2], tb.max[2], Math.PI / 2],
    ];
    for (const [alongX, coord, a0, a1, yaw] of faces) {
      for (let y = b.max[1] + 0.8; y + 1.2 < top - 0.3; y += 3.0) {
        for (let a = a0 + 0.8; a + 0.9 < a1 - 0.4; a += 1.6) {
          if (!tr.chance(0.5)) continue;
          towerWin.push({ pos: alongX ? [a + 0.45, y, coord] : [coord, y, a + 0.45], yaw });
        }
      }
    }
  }
  addInstances(c, tr.fork('inst'), 'windowLit', [0.9, 1.2, 0.04], towerWin);
  // 3) 運河（内側の横街路 1 本。街区が 2 段以上あるとき）
  const g = streetGridOf(main);
  if (g.nz < 2) return;
  const cr = rng.fork('canal');
  const j = cr.int(1, g.nz - 1);
  const [hz0, hz1] = hStreet(g, j);
  const quay = 0.9;
  const wz0 = hz0 + quay;
  const wz1 = hz1 - quay;
  if (wz1 - wz0 < 3.0) return;
  const canal = rect(main.x0 + WALL_T, wz0, main.x1 - WALL_T, wz1);
  // 床穴が運河に掛かるなら作らない（水面の下の穴は見えない）
  if (L.holes.some((hh) => hh.max[2] > hz0 - 1 && hh.min[2] < hz1 + 1)) return;
  // 運河に掛かる車・路面標示を取り除く（街灯は歩道側なので残る）
  const keep: Box[] = L.boxes.slice(0, c.shell);
  for (const b of L.boxes.slice(c.shell)) {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const inCanal = cz > hz0 && cz < hz1 && cx > main.x0 && cx < main.x1 && b.min[1] < 2.0 && b.max[1] - b.min[1] < 2.0;
    if (inCanal && (b.solid || b.max[1] < 0.02 || b.mat === 'carGlass' || b.mat === 'rubber' || b.mat === 'carPaint')) continue;
    keep.push(b);
  }
  L.boxes = keep;
  // 水面 + 水域ゾーン（足音と減速）
  push(c, box([canal.x0, 0.003, canal.z0], [canal.x1, 0.06, canal.z1], 'waterShallow', false));
  (L.zones ??= []).push({ kind: 'water', aabb: { min: [canal.x0, -0.1, canal.z0], max: [canal.x1, 0.5, canal.z1] }, params: { slow: 0.75, depth: 0.06 } });
  // 橋（縦街路との交差部。0.32 m の段で登れる）
  const bridges: Rect[] = [];
  for (let k = 0; k <= g.nx; k++) {
    const [vx0, vx1] = vStreet(g, k);
    const br = rect(Math.max(canal.x0 + 0.3, vx0 + 0.4), hz0 - 0.2, Math.min(canal.x1 - 0.3, vx1 - 0.4), hz1 + 0.2);
    if (br.x1 - br.x0 < 2.0) continue;
    const slab = box([br.x0, 0, br.z0], [br.x1, 0.32, br.z1], 'floorConcrete');
    if (hitsZone(c.zones, slab)) continue;
    push(c, slab);
    for (const zz of [br.z0 + 0.08, br.z1 - 0.08]) {
      push(c, box([br.x0, 0.32, zz - 0.04], [br.x1, 1.25, zz + 0.04], 'metal', false));
      const n = Math.max(1, Math.round((br.x1 - br.x0) / 1.5));
      for (let i = 0; i <= n; i++) {
        const x = br.x0 + ((br.x1 - br.x0) * i) / n;
        push(c, box([x - 0.03, 0.32, zz - 0.05], [x + 0.03, 1.2, zz + 0.05], 'metal', false));
      }
    }
    bridges.push(br);
  }
  // 岸壁（水際の低い縁石。橋と扉前は切る）
  for (const zz of [wz0, wz1]) {
    const cz0 = zz === wz0 ? wz0 - 0.25 : wz1;
    const cz1 = cz0 + 0.25;
    let x = canal.x0 + 0.2;
    const x1 = canal.x1 - 0.2;
    while (x < x1 - 0.3) {
      const seg = Math.min(x1, x + 4.0);
      const cb = box([x, 0, cz0], [seg, 0.35, cz1], 'columnConcrete');
      if (!hitsZone(c.zones, cb) && !bridges.some((br) => overlapXZ(aabbOfRect(br), cb, 0.1))) push(c, cb);
      x = seg;
    }
  }
  // 小舟（水面に浮く木の箱。低いので越えられる）
  const boats = Math.min(3, Math.max(1, Math.round((canal.x1 - canal.x0) / 24)));
  for (let i = 0; i < boats; i++) {
    const bx = cr.float(canal.x0 + 4, canal.x1 - 4);
    const bz = cr.float(canal.z0 + 1.2, canal.z1 - 1.2);
    const boat = box([bx - 1.6, 0.03, bz - 0.55], [bx + 1.6, 0.42, bz + 0.55], 'floorWood');
    if (!canPlace(c, boat, { lanes: false })) continue;
    push(c, boat, box([bx - 0.5, 0.42, bz - 0.35], [bx + 0.5, 0.55, bz + 0.35], 'furnitureDark', false));
  }
  // 運河の案内（岸壁の街路名）
  const faces = innerFaces(c.rects).filter((f) => !f.horizontal);
  for (const f of faces) {
    const zc = (wz0 + wz1) / 2;
    if (freeRuns(f, L.sockets, 0.8).some(([a, b]) => zc - 0.8 > a && zc + 0.8 < b)) signAt(L, f, zc, 2.4, 1.4, 'CANAL ST.', { kind: 'emissive', color: 0xbfe0ff, background: 0x101828 });
  }
}

// ---------------------------------------------------------------- L02 室内海洋（MegaHall sea）
// 水面の透け色を深い青緑に（床スラブを暗い材質に）、乾いた前庭は元の床色の箔で戻す。入口の桟橋の軸に沿って杭柱の列、天井に桟橋の梁。

function dressL02(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  const floorMat = L.palette.floor;
  recolor(c, (b) => b.solid && b.mat === floorMat && b.max[1] <= 0.01 && b.min[1] < 0, 'chalkboard', 0, c.shell);
  // 前庭（ShallowWater の apron と同じ寸法）に元の床色
  for (const s of L.sockets) {
    if (s.type === 'hole' || (s.sill ?? 0) >= 0.5) continue;
    const home = c.rects.find((r) => { const iw = inwardOf(s.dir); const x = s.pos[0] + iw[0] * 0.3; const z = s.pos[2] + iw[1] * 0.3; return x >= r.x0 - 0.02 && x <= r.x1 + 0.02 && z >= r.z0 - 0.02 && z <= r.z1 + 0.02; }) ?? main;
    const depth = Math.max(1.3, s.width + 0.3);
    const hw = s.width / 2 + 0.4;
    let r: Rect;
    switch (s.dir) {
      case 0: r = rect(s.pos[0] - hw, s.pos[2] - depth, s.pos[0] + hw, s.pos[2]); break;
      case 2: r = rect(s.pos[0] - hw, s.pos[2], s.pos[0] + hw, s.pos[2] + depth); break;
      case 1: r = rect(s.pos[0] - depth, s.pos[2] - hw, s.pos[0], s.pos[2] + hw); break;
      default: r = rect(s.pos[0], s.pos[2] - hw, s.pos[0] + depth, s.pos[2] + hw); break;
    }
    const ih = inner(home, 0.02);
    const x0 = Math.max(r.x0, ih.x0), x1 = Math.min(r.x1, ih.x1), z0 = Math.max(r.z0, ih.z0), z1 = Math.min(r.z1, ih.z1);
    if (x1 - x0 < 0.3 || z1 - z0 < 0.3) continue;
    push(c, box([x0, 0.001, z0], [x1, 0.012, z1], floorMat, false));
  }
  // 杭柱の列: 入口 → 部屋中央（桟橋の第 1 脚は壁に垂直、第 2 脚は中央へ）
  const entry = L.sockets.find((s) => s.id === 'entry');
  if (entry && entry.type !== 'hole') {
    const iw = inwardOf(entry.dir);
    const hub: [number, number] = [(main.x0 + main.x1) / 2, (main.z0 + main.z1) / 2];
    const start: [number, number] = [entry.pos[0] + iw[0] * 2.4, entry.pos[2] + iw[1] * 2.4];
    const perpZ = entry.dir === 0 || entry.dir === 2;
    const corner: [number, number] = perpZ ? [start[0], hub[1]] : [hub[0], start[1]];
    const piles: Box[] = [];
    const legs: [[number, number], [number, number]][] = [[start, corner], [corner, hub]];
    for (const [a, b] of legs) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 4) continue;
      const n = Math.floor((len - 3) / 6);
      const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
      for (let i = 0; i <= n; i++) {
        const t = 3 + i * 6;
        const px = a[0] + ((b[0] - a[0]) * t) / len;
        const pz = a[1] + ((b[1] - a[1]) * t) / len;
        for (const sg of [-1, 1]) {
          const x = alongX ? px : px + sg * 2.6;
          const z = alongX ? pz + sg * 2.6 : pz;
          const pile = box([x - 0.35, 0, z - 0.35], [x + 0.35, h, z + 0.35], 'columnConcrete');
          if (!canPlace(c, pile, { lanes: false, pad: 0.4 })) continue;
          piles.push(pile, box([x - 0.5, h - 1.2, z - 0.5], [x + 0.5, h - 0.9, z + 0.5], 'columnConcrete', false));
        }
      }
    }
    push(c, ...piles);
  }
  // 桟橋の天井の梁（短手方向。非ソリッド）
  const alongX = main.x1 - main.x0 >= main.z1 - main.z0;
  const len = alongX ? main.x1 - main.x0 : main.z1 - main.z0;
  const nBeam = Math.min(14, Math.floor(len / 12));
  for (let i = 1; i < nBeam; i++) {
    const t = (alongX ? main.x0 : main.z0) + (len * i) / nBeam;
    if (alongX) push(c, box([t - 0.4, h - 0.9, main.z0 + 0.2], [t + 0.4, h - 0.02, main.z1 - 0.2], 'columnConcrete', false));
    else push(c, box([main.x0 + 0.2, h - 0.9, t - 0.4], [main.x1 - 0.2, h - 0.02, t + 0.4], 'columnConcrete', false));
  }
  L.palette = { ...L.palette, fog: 0x050810, ambient: 0x3a4658 };
}

// ---------------------------------------------------------------- L03 倉庫内麦畑（MegaHall field）
// 麦の茎（grass）は InstanceOvergrowth が後段で敷く。ここでは畑の地面を黄金色に、高所灯と環境色を暖色にして「黄金の麦畑」に寄せる。
// 茎そのものの色は Modifier 側（docs/visual-requests.md に依頼）。

function dressL03(c: Ctx): void {
  const { L } = c;
  recolor(c, (b) => !b.solid && b.mat === 'grass' && b.max[1] <= 0.3, 'yellowLine', c.shell);
  recolor(c, (b) => !b.solid && b.mat === 'lightPanel' && b.max[1] > c.h - 2.5, 'lightWarm', c.shell);
  for (const l of L.lights) l.color = 0xffd08a;
  L.palette = { ...L.palette, light: 'lightWarm', lightColor: 0xffd9a0, ambient: 0x9a8a62, fog: 0x2a2418 };
  // 倉庫の名残り: 出口の脇のサイロ（高い円筒の近似）を 2 基
  const sr = c.rng.fork('silo');
  const main = c.rects[0];
  let n = 0;
  for (const s of L.sockets) {
    if (n >= 2 || s.type === 'hole' || s.id === 'entry') continue;
    const iw = inwardOf(s.dir);
    const side: [number, number] = s.dir === 0 || s.dir === 2 ? [1, 0] : [0, 1];
    const sg = sr.chance(0.5) ? 1 : -1;
    const x = s.pos[0] + iw[0] * 4.5 + side[0] * 5.5 * sg;
    const z = s.pos[2] + iw[1] * 4.5 + side[1] * 5.5 * sg;
    const top = Math.min(c.h - 0.6, 7.5);
    const silo = box([x - 1.4, 0, z - 1.4], [x + 1.4, top, z + 1.4], 'shelfMetal');
    if (!insideRects([main], silo, 1.0) || !canPlace(c, silo, { pad: 0.6 })) continue;
    // InstanceOvergrowth（麦）は内装の家具材質を捨てるのでシェル側に入れる
    shellPush(c, [silo, box([x - 1.0, top, z - 1.0], [x + 1.0, top + 0.7, z + 1.0], 'shelfMetal', false), box([x - 0.5, top + 0.7, z - 0.5], [x + 0.5, top + 1.0, z + 0.5], 'metalDark', false)]);
    n++;
  }
}

// ---------------------------------------------------------------- L04 無限グランドホテル（MegaAtrium hotel）
// ロビーの大理石床・金の手すり・シャンデリア（金の枠 + 暖色の小箔の束 + 暖色灯 2）・赤いソファ組。

function dressL04(c: Ctx): void {
  const { L } = c;
  const h = c.h;
  const lobbies = themeZones(c, 'lobby');
  const banquets = themeZones(c, 'banquet');
  // 大理石: ロビーの床箔（floorTile の薄い箔）を marbleFloor に
  for (const lb of lobbies) recolor(c, (b) => !b.solid && b.mat === 'floorTile' && b.max[1] < 0.03 && overlapXZ(b, { min: [lb.x0, 0, lb.z0], max: [lb.x1, 1, lb.z1] }), 'marbleFloor', c.shell);
  // 金の縁: 回廊・橋の手すり（metal 1.05 m）を goldTrim に
  recolor(c, (b) => b.solid && b.mat === 'metal' && Math.abs(b.max[1] - b.min[1] - 1.05) < 0.02, 'goldTrim', 0, c.shell);
  // シャンデリア
  // シャンデリアは天井から長い吊り棒で 2 階の高さ（灯体上端 ≈ 8.6 m）まで下げ、ロビーの床を照らす。橋・スラブに掛かれば x をずらす
  const chandelier = (cx0: number, cz: number, size: number, tag: string) => {
    const yTop = Math.min(h - 0.2, 8.6);
    let cx = cx0;
    for (const dx of [0, -4, 4, -8, 8]) {
      const vol: AABB = { min: [cx0 + dx - size / 2 - 0.3, yTop - 2.6, cz - size / 2 - 0.3], max: [cx0 + dx + size / 2 + 0.3, h, cz + size / 2 + 0.3] };
      if (!L.boxes.some((b) => b.solid && overlap3(b, vol))) { cx = cx0 + dx; break; }
    }
    const rod = box([cx - 0.05, yTop - 2.2, cz - 0.05], [cx + 0.05, h, cz + 0.05], 'goldTrim', false);
    const tiers: Box[] = [rod];
    const crystals: InstanceSpec['transforms'] = [];
    const levels: [number, number, number][] = [[yTop - 2.2, size, 20], [yTop - 1.45, size * 0.68, 14], [yTop - 0.75, size * 0.4, 8]];
    for (const [y, s, n] of levels) {
      tiers.push(box([cx - s / 2, y, cz - s / 2], [cx + s / 2, y + 0.09, cz + s / 2], 'goldTrim', false));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        crystals.push({ pos: [cx + Math.cos(a) * (s / 2 - 0.1), y - 0.5, cz + Math.sin(a) * (s / 2 - 0.1)], yaw: a, scale: 1 });
      }
    }
    // 中央の灯体
    tiers.push(box([cx - 0.3, yTop - 2.0, cz - 0.3], [cx + 0.3, yTop - 1.1, cz + 0.3], 'lightWarm', false));
    push(c, ...tiers);
    addInstances(c, c.rng.fork(tag), 'lightWarm', [0.1, 0.48, 0.1], crystals);
    addLight(c, { pos: [cx, yTop - 2.5, cz], color: 0xffd9a0, intensity: 2.2, distance: 34 });
  };
  const lb = lobbies[0];
  if (lb) chandelier((lb.x0 + lb.x1) / 2, lb.z0 + (lb.z1 - lb.z0) * 0.62, 3.6, 'ch0');
  const bq = banquets[0];
  if (bq) chandelier((bq.x0 + bq.x1) / 2, (bq.z0 + bq.z1) / 2, 3.0, 'ch1');
  // ソファ組（ロビーの 4 象限）
  if (lb) {
    const sr = c.rng.fork('sofa');
    const ir = inner(lb, 3.0);
    const pts: [number, number][] = [[0.28, 0.3], [0.72, 0.3], [0.28, 0.78], [0.72, 0.78], [0.5, 0.55]];
    let placed = 0;
    for (const [fx, fz] of pts) {
      if (placed >= 4) break;
      const cx = snap(ir.x0 + (ir.x1 - ir.x0) * fx + sr.float(-1, 1));
      const cz = snap(ir.z0 + (ir.z1 - ir.z0) * fz + sr.float(-1, 1));
      const alongX = sr.chance(0.5);
      const seat = alongX ? box([cx - 1.05, 0, cz - 1.25], [cx + 1.05, 0.45, cz - 0.4], 'seatRed') : box([cx - 1.25, 0, cz - 1.05], [cx - 0.4, 0.45, cz + 1.05], 'seatRed');
      const back = alongX ? box([cx - 1.05, 0.45, cz - 1.25], [cx + 1.05, 0.95, cz - 1.0], 'seatRed') : box([cx - 1.25, 0.45, cz - 1.05], [cx - 1.0, 0.95, cz + 1.05], 'seatRed');
      const seat2 = alongX ? box([cx - 1.05, 0, cz + 0.4], [cx + 1.05, 0.45, cz + 1.25], 'seatRed') : box([cx + 0.4, 0, cz - 1.05], [cx + 1.25, 0.45, cz + 1.05], 'seatRed');
      const back2 = alongX ? box([cx - 1.05, 0.45, cz + 1.0], [cx + 1.05, 0.95, cz + 1.25], 'seatRed') : box([cx + 1.0, 0.45, cz - 1.05], [cx + 1.25, 0.95, cz + 1.05], 'seatRed');
      const table = box([cx - 0.55, 0, cz - 0.3], [cx + 0.55, 0.42, cz + 0.3], 'furnitureDark');
      const group = box([cx - 1.3, 0, cz - 1.3], [cx + 1.3, 1.0, cz + 1.3], 'seatRed');
      if (!canPlace(c, group, { pad: 0.5 })) continue;
      push(c, seat, back, seat2, back2, table, box([cx - 0.5, 0.42, cz - 0.25], [cx + 0.5, 0.45, cz + 0.25], 'goldTrim', false));
      placed++;
    }
    // 受付の館名（emissive の金文字）
    const desk = L.boxes.slice(c.shell).find((b) => b.solid && b.mat === 'furnitureLight' && Math.abs(b.max[1] - 1.1) < 0.02 && b.max[0] - b.min[0] > 4.5 && overlapXZ(b, { min: [lb.x0, 0, lb.z0], max: [lb.x1, 1, lb.z1] }));
    if (desk) addSign(c, { text: 'GRAND HOTEL', sub: '∞ FLOORS · ALWAYS OPEN', pos: [(desk.min[0] + desk.max[0]) / 2, 0.62, desk.min[2] - 0.02], dir: 2, width: 2.6, kind: 'emissive', color: 0xf2d38a, background: 0x2a1a10 }, true);
  }
}

// ---------------------------------------------------------------- L05 屋内学園都市（MegaAtrium campus）
// 中庭（無ければ体育館）に陸上トラック、プールに青い底と縁、天窓を青空（skyDay）に。

function dressL05(c: Ctx): void {
  const { L } = c;
  const h = c.h;
  const field = themeZones(c, 'courtyard')[0] ?? themeZones(c, 'gym')[0];
  if (field) {
    const outer = inner(field, 1.5);
    const laneW = 1.22;
    const band = laneW * 4;
    if (outer.x1 - outer.x0 >= band * 2 + 6 && outer.z1 - outer.z0 >= band * 2 + 6) {
      const inr = inner(outer, band);
      // トラックに掛かる島（植栽・ベンチ）を取り除く
      const keep = L.boxes.slice(0, c.shell);
      for (const b of L.boxes.slice(c.shell)) {
        const onBand = b.solid && b.min[1] < 0.1 && overlapXZ(b, { min: [outer.x0, 0, outer.z0], max: [outer.x1, 1, outer.z1] }, 0.2) && !(b.min[0] > inr.x0 + 0.2 && b.max[0] < inr.x1 - 0.2 && b.min[2] > inr.z0 + 0.2 && b.max[2] < inr.z1 - 0.2);
        if (!onBand) keep.push(b);
      }
      L.boxes = keep;
      const y0 = 0.024;
      const y1 = 0.036;
      const track: MatId = 'floorCarpetRed';
      push(c,
        box([outer.x0, y0, outer.z0], [outer.x1, y1, inr.z0], track, false),
        box([outer.x0, y0, inr.z1], [outer.x1, y1, outer.z1], track, false),
        box([outer.x0, y0, inr.z0], [inr.x0, y1, inr.z1], track, false),
        box([inr.x1, y0, inr.z0], [outer.x1, y1, inr.z1], track, false),
      );
      // レーンライン（外周から 1.22 m ごと）
      for (let k = 0; k <= 4; k++) {
        const o = k * laneW;
        const lw = 0.05;
        const yl0 = y1;
        const yl1 = y1 + 0.006;
        push(c,
          box([outer.x0 + o, yl0, outer.z0 + o], [outer.x1 - o, yl1, outer.z0 + o + lw], 'wallWhite', false),
          box([outer.x0 + o, yl0, outer.z1 - o - lw], [outer.x1 - o, yl1, outer.z1 - o], 'wallWhite', false),
          box([outer.x0 + o, yl0, outer.z0 + o], [outer.x0 + o + lw, yl1, outer.z1 - o], 'wallWhite', false),
          box([outer.x1 - o - lw, yl0, outer.z0 + o], [outer.x1 - o, yl1, outer.z1 - o], 'wallWhite', false),
        );
      }
      // 内側のフィールド（芝）
      push(c, box([inr.x0, y0, inr.z0], [inr.x1, y1, inr.z1], 'grass', false));
      // 掲示板（支柱付き。トラックの入口側の縁）
      const sx = (outer.x0 + outer.x1) / 2;
      const sz = outer.z0 - 0.5;
      const postA = box([sx - 1.15, 0, sz - 0.05], [sx - 1.05, 2.5, sz + 0.05], 'metalDark');
      const postB = box([sx + 1.05, 0, sz - 0.05], [sx + 1.15, 2.5, sz + 0.05], 'metalDark');
      if (canPlace(c, postA, { pad: 0.3 }) && canPlace(c, postB, { pad: 0.3 })) {
        push(c, postA, postB, box([sx - 1.25, 1.85, sz - 0.03], [sx + 1.25, 2.55, sz + 0.03], 'wallDark', false));
        addSign(c, { text: 'TRACK & FIELD', sub: '第一運動場', pos: [sx, 2.2, sz - 0.04], dir: 2, width: 2.4, kind: 'plate' });
      }
    }
  }
  // プール: 水面の下に青い底、縁に青い帯
  for (const wb of L.boxes.filter((b) => b.mat === 'waterShallow' && !b.solid)) {
    push(c, box([wb.min[0] + 0.05, 0.002, wb.min[2] + 0.05], [wb.max[0] - 0.05, 0.009, wb.max[2] - 0.05], 'plasticBlue', false));
    const k = 0.25;
    const top = 0.3;
    push(c,
      box([wb.min[0] - k, top, wb.min[2] - k], [wb.max[0] + k, top + 0.012, wb.min[2]], 'plasticBlue', false),
      box([wb.min[0] - k, top, wb.max[2]], [wb.max[0] + k, top + 0.012, wb.max[2] + k], 'plasticBlue', false),
      box([wb.min[0] - k, top, wb.min[2]], [wb.min[0], top + 0.012, wb.max[2]], 'plasticBlue', false),
      box([wb.max[0], top, wb.min[2]], [wb.max[0] + k, top + 0.012, wb.max[2]], 'plasticBlue', false),
    );
    // コースロープ（水面上の細い帯）
    const w = wb.max[0] - wb.min[0];
    const d = wb.max[2] - wb.min[2];
    const alongX = w >= d;
    const lanes = Math.min(5, Math.floor((alongX ? d : w) / 2.5));
    for (let i = 1; i < lanes; i++) {
      const t = (alongX ? wb.min[2] : wb.min[0]) + ((alongX ? d : w) * i) / lanes;
      if (alongX) push(c, box([wb.min[0] + 0.3, wb.max[1] + 0.002, t - 0.05], [wb.max[0] - 0.3, wb.max[1] + 0.05, t + 0.05], 'plasticRed', false));
      else push(c, box([t - 0.05, wb.max[1] + 0.002, wb.min[2] + 0.3], [t + 0.05, wb.max[1] + 0.05, wb.max[2] - 0.3], 'plasticRed', false));
    }
  }
  // 天窓を青空に（昼光）
  recolor(c, (b) => !b.solid && b.mat === 'lightPanel' && b.min[1] > h - 0.06 && (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) > 12, 'skyDay', c.shell);
  L.palette = { ...L.palette, lightColor: 0xf4f7ff, ambient: 0xa0a8b8 };
}

// ---------------------------------------------------------------- L06 地下鉄ショッピングシティ（AtriumGenerator Terminal）
// 長辺の壁に店舗正面（ガラス + 暗い店内 + 発光看板 + 店名）、コンコースに吊り下げの「出口」案内、艶床。

const SHOP_NAMES = ['BOOKS 書店', 'CAFE', '薬 PHARMACY', 'DONUTS', 'CLINIC', 'SHOES', '100円', 'MOBILE', 'BAKERY', 'RAMEN', 'OPTIC', 'BENTO 弁当', 'FLOWERS', 'TRAVEL', 'KIOSK', 'CLEANING'];
const SHOP_COLORS: [number, number][] = [[0xfff1c0, 0x1a1a22], [0xff7aa8, 0x1a1020], [0x7ad0ff, 0x101a26], [0xc0ffb0, 0x10201a], [0xffffff, 0x223046], [0xffd27a, 0x24180c]];

function dressL06(c: Ctx): void {
  const { L } = c;
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.25) };
  const rng = c.rng.fork('shops');
  const faces = innerFaces(c.rects).filter((f) => f.a1 - f.a0 >= 12);
  // 構築時間（+30% 以内）のため店舗は 10 軒・1 軒 6 箱まで、店名サインは 1 軒おき（サインアトラス 1 枚に収める）
  const unit = 6.6;
  let shopIdx = rng.int(0, SHOP_NAMES.length - 1);
  let units = 0;
  for (const f of faces) {
    for (const [r0, r1] of freeRuns(f, L.sockets, 1.4)) {
      for (let a = r0 + 0.3; a + unit <= r1 - 0.3 && units < 10; a += unit + 1.2) {
        const pilA = alongFace(f, a, 0.35, 0.0, 1.15, 0, 3.3, 'wallWhite', true);
        const pilB = alongFace(f, a + unit - 0.35, 0.35, 0.0, 1.15, 0, 3.3, 'wallWhite', true);
        const glass = alongFace(f, a + 0.35, unit - 0.7, 1.06, 1.1, 0.05, 2.75, 'glass', true);
        if (!canPlace(c, pilA, { lanes: false }) || !canPlace(c, pilB, { lanes: false }) || !canPlace(c, glass, { lanes: false })) continue;
        const dark = alongFace(f, a + 0.35, unit - 0.7, 0.96, 0.99, 0.05, 2.75, 'screenDark', false);
        const fascia = alongFace(f, a, unit, 0.0, 1.15, 2.75, 3.3, 'wallWhite', false);
        const board = alongFace(f, a + 1.0, unit - 2.0, 1.15, 1.19, 2.85, 3.25, 'screenGlow', false);
        push(c, pilA, pilB, glass, dark, fascia, board);
        if (units % 2 === 0) {
          const [color, background] = SHOP_COLORS[shopIdx % SHOP_COLORS.length];
          signAt(L, f, a + unit / 2, 3.05, Math.min(3.4, unit - 2.4), SHOP_NAMES[shopIdx % SHOP_NAMES.length], { kind: 'emissive', color, background, offset: 1.2 });
          shopIdx++;
        }
        units++;
      }
    }
  }
  // 吊り下げの「出口」案内（コンコースの長軸に 14 m ごと、両面）
  const main = c.rects[0];
  const alongZ = main.z1 - main.z0 >= main.x1 - main.x0;
  const len = alongZ ? main.z1 - main.z0 : main.x1 - main.x0;
  const n = Math.min(1, Math.floor(len / 14));
  for (let i = 1; i <= n; i++) {
    const t = (alongZ ? main.z0 : main.x0) + (len * i) / (n + 1);
    const cx = alongZ ? (main.x0 + main.x1) / 2 : t;
    const cz = alongZ ? t : (main.z0 + main.z1) / 2;
    const y = Math.min(c.h - 1.0, 3.0);
    push(c, box([cx - 0.02, y + 0.25, cz - 0.02], [cx + 0.02, c.h, cz + 0.02], 'metalDark', false));
    push(c, box([cx - 0.95, y + 0.2, cz - 0.03], [cx + 0.95, y + 0.26, cz + 0.03], 'metalDark', false));
    const dirs: [Dir, Dir] = alongZ ? [0, 2] : [1, 3];
    const off = 0.035;
    const posA: Vec3 = alongZ ? [cx, y, cz + off] : [cx + off, y, cz];
    const posB: Vec3 = alongZ ? [cx, y, cz - off] : [cx - off, y, cz];
    addSign(c, { text: i % 2 === 0 ? '出口 EXIT →' : '← 出口 EXIT', sub: `${String.fromCharCode(64 + i)}${i * 3} 番出口`, pos: posA, dir: dirs[0], width: 1.8, kind: 'emissive', color: 0xffffff, background: 0x0f5a2e });
    addSign(c, { text: i % 2 === 0 ? '← 出口 EXIT' : '出口 EXIT →', sub: 'SHOPPING CITY B2', pos: posB, dir: dirs[1], width: 1.8, kind: 'emissive', color: 0xffffff, background: 0x0f5a2e });
  }
  L.palette = { ...L.palette, lightColor: 0xfff0dc, ambient: 0x8a8478 };
}

// ---------------------------------------------------------------- L07 垂直オフィス世界（MegaAtrium office）
// 各階の壁面にオフィスの窓格子（点灯 / 消灯の instances）。西のオフィス帯（ガラス間仕切り）以外の面。階段・出口・EV は避ける。

function dressL07(c: Ctx): void {
  const { L } = c;
  const rng = c.rng.fork('windows');
  const levels = Math.max(1, Math.round(L.levels ?? 1));
  const lit: InstanceSpec['transforms'] = [];
  const dark: InstanceSpec['transforms'] = [];
  const faces = innerFaces(c.rects).filter((f) => f.dir !== 3);
  const pitch = 1.6;
  for (let k = 0; k < levels; k++) {
    const y0 = k * FLOOR + 1.05;
    const y1 = y0 + 1.5;
    if (y1 > c.h - 0.4) break;
    for (const f of faces) {
      const near = boxesNearFace(c, f, 1.6, k * FLOOR + 0.2, y1 + 0.2);
      for (const [r0, r1] of freeRuns(f, L.sockets.filter((s) => Math.abs(s.pos[1] - k * FLOOR) < 0.2), 1.0)) {
        for (let a = r0 + 0.5; a + 1.2 < r1 - 0.3; a += pitch) {
          if (lit.length + dark.length >= 2400) break;
          const probe = alongFace(f, a, 1.2, 0.0, 0.3, y0, y1, 'windowLit', false);
          if (near.some((b) => overlap3(b, probe))) continue;
          const t = { pos: facePoint(f, a + 0.6, y0, 0.03), yaw: faceYaw(f) };
          if (rng.chance(0.62)) lit.push(t); else dark.push(t);
        }
      }
    }
  }
  addInstances(c, rng.fork('lit'), 'windowLit', [1.2, 1.5, 0.04], lit);
  addInstances(c, rng.fork('dark'), 'windowDark', [1.2, 1.5, 0.04], dark);
  // 階表示（各階の北壁の中央付近）
  const main = c.rects[0];
  const north = innerFaces(c.rects).find((f) => f.dir === 0 && f.a1 - f.a0 > 8);
  if (north) {
    for (let k = 0; k < levels; k++) {
      const y = k * FLOOR + 2.6;
      if (y > c.h - 0.5) break;
      const at = (main.x0 + main.x1) / 2 + 3.0;
      if (!freeRuns(north, L.sockets, 0.8).some(([a, b]) => at - 0.6 > a && at + 0.6 < b)) continue;
      signAt(L, north, at, y, 1.0, `${k + 1}F`, { kind: 'plate', color: 0x20232a, background: 0xf0f0e8, sub: `LEVEL ${k + 1} · OFFICES` });
    }
  }
  L.palette = { ...L.palette, fog: 0x0e1216, ambient: 0x8a92a4 };
}

// ---------------------------------------------------------------- L08 終着しない国際空港（AtriumGenerator Terminal）
// 青い連結椅子（既存の座席列を色替え）、ゲート番号、発着案内板、艶床。飛行機は幅 18 m × 奥行 40 m × 高さ 8.4 m 以上の変種だけ屋内に 1 機置く（箱の近似）。

function dressL08(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.15) };
  recolor(c, (b) => b.solid && b.mat === 'furnitureDark' && b.min[1] < 0.05 && Math.abs(b.max[1] - 0.5) < 0.06, 'seatBlue', c.shell);
  // ゲート番号（北壁のカウンター上の発光板の手前）
  let gate = 20 + c.rng.fork('gate').int(1, 30);
  const boards = L.boxes.slice(c.shell).filter((b) => !b.solid && b.mat === 'lightPanel' && Math.abs(b.min[1] - 2.6) < 0.05 && Math.abs(b.max[1] - 3.4) < 0.05 && b.max[0] - b.min[0] > 2.0).sort((a, b) => a.min[0] - b.min[0]);
  for (const b of boards) {
    addSign(c, { text: `GATE ${gate}`, sub: '搭乗口 · BOARDING', pos: [(b.min[0] + b.max[0]) / 2, 3.0, b.min[2] - 0.03], dir: 2, width: 2.2, kind: 'emissive', color: 0xffffff, background: 0x12285a });
    gate += 1;
  }
  // 発着案内板（自立式 2 基）
  const w = main.x1 - main.x0;
  const d = main.z1 - main.z0;
  const br = c.rng.fork('board');
  // 座席列（z 方向）の間の通路の中心に置く
  const rowXs = [...new Set(L.boxes.slice(c.shell).filter((b) => b.solid && b.mat === 'seatBlue' && b.max[2] - b.min[2] > b.max[0] - b.min[0]).map((b) => ((b.min[0] + b.max[0]) / 2).toFixed(2)))].map(Number).sort((a, b) => a - b);
  const aisles: number[] = [];
  for (let i = 0; i + 1 < rowXs.length; i++) if (rowXs[i + 1] - rowXs[i] > 3.2) aisles.push((rowXs[i] + rowXs[i + 1]) / 2);
  const mid = (main.x0 + main.x1) / 2;
  aisles.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  const xs = aisles.length ? aisles.slice(0, 4) : [mid - 4.5, mid + 4.5, mid];
  let placed = 0;
  outer: for (const fz of [0.3, 0.62, 0.45, 0.2, 0.75]) {
    for (const cx of xs) {
      if (placed >= 2) break outer;
      const cz = snap(main.z0 + d * fz);
      const postA = box([cx - 1.3, 0, cz - 0.06], [cx - 1.18, 2.2, cz + 0.06], 'metalDark');
      const postB = box([cx + 1.18, 0, cz - 0.06], [cx + 1.3, 2.2, cz + 0.06], 'metalDark');
      const body = box([cx - 1.4, 0, cz - 0.3], [cx + 1.4, 4.2, cz + 0.3], 'screenDark');
      if (!canPlace(c, body, { pad: 0.3, ignoreLow: 0.02 })) continue;
      push(c, postA, postB, box([cx - 1.4, 2.2, cz - 0.05], [cx + 1.4, 3.8, cz + 0.05], 'screenDark', false));
      for (let k = 0; k < 5; k++) {
        const y = 2.45 + k * 0.26;
        const lw = 2.4 - br.float(0, 0.8);
        push(c, box([cx - 1.2, y, cz - 0.07], [cx - 1.2 + lw, y + 0.1, cz - 0.05], 'screenGlow', false));
        push(c, box([cx - 1.2, y, cz + 0.05], [cx - 1.2 + lw, y + 0.1, cz + 0.07], 'screenGlow', false));
      }
      addSign(c, { text: 'DEPARTURES 出発', sub: 'ALL FLIGHTS DELAYED · 全便遅延', pos: [cx, 4.05, cz - 0.06], dir: 2, width: 2.4, kind: 'emissive', color: 0xffd27a, background: 0x0a0c14 });
      addSign(c, { text: 'ARRIVALS 到着', sub: 'NO SCHEDULED ARRIVALS', pos: [cx, 4.05, cz + 0.06], dir: 0, width: 2.4, kind: 'emissive', color: 0x9fd0ff, background: 0x0a0c14 });
      placed++;
      break;
    }
  }
  // 飛行機（箱の近似。胴体は床上 2.5 m、翼 3.2 m、エンジン下端 2.0 m で下を歩ける）
  if (w >= 18 && d >= 40 && h >= 8.4) airplane(c, main);
}

function airplane(c: Ctx, main: Rect): void {
  const { L } = c;
  const h = c.h;
  const w = main.x1 - main.x0;
  const d = main.z1 - main.z0;
  const zc = main.z0 + d * 0.6;
  const halfSpan = Math.min(10.5, w / 2 - 1.5);
  const cx0 = (main.x0 + main.x1) / 2;
  const gearFor = (xa: number): Box[] => [
    box([xa - 0.15, 0, zc - 7.2], [xa + 0.15, 2.7, zc - 6.9], 'metalDark'),
    box([xa - 0.16, 0.05, zc - 7.5], [xa + 0.16, 0.95, zc - 6.6], 'rubber'),
    box([xa - 2.35, 0, zc + 1.2], [xa - 2.05, 3.3, zc + 1.5], 'metalDark'),
    box([xa - 2.5, 0.05, zc + 0.9], [xa - 1.9, 0.95, zc + 1.8], 'rubber'),
    box([xa + 2.05, 0, zc + 1.2], [xa + 2.35, 3.3, zc + 1.5], 'metalDark'),
    box([xa + 1.9, 0.05, zc + 0.9], [xa + 2.5, 0.95, zc + 1.8], 'rubber'),
  ];
  // 脚が置ける胴体位置（低い座席列は取り除いてよい。柱・カウンターとは重ねない）
  let xa: number | null = null;
  for (const dx of [0, -3, 3, -6, 6]) {
    const x = cx0 + dx;
    if (x - halfSpan < main.x0 + 1.0 || x + halfSpan > main.x1 - 1.0) continue;
    const ok = gearFor(x).every((g) => {
      if (!insideRects(c.rects, g, WALL_T) || hitsZone(c.zones, g) || laneBlocked(c, g)) return false;
      for (const o of L.boxes) if (o.solid && o.max[1] - o.min[1] > 0.7 && overlap3(o, g)) return false;
      return true;
    });
    if (ok) { xa = x; break; }
  }
  if (xa === null) return;
  const plane: AABB = { min: [xa - halfSpan, 1.5, zc - 12], max: [xa + halfSpan, h, zc + 8] };
  // 胴体・翼の範囲に掛かる低い座席と吊り灯を取り除く
  const keep = L.boxes.slice(0, c.shell);
  for (const b of L.boxes.slice(c.shell)) {
    const [bw, bh] = sizeOf(b);
    const underGear = b.solid && bh <= 0.7 && gearFor(xa).some((g) => overlapXZ(g, b, 0.2));
    const hanging = !b.solid && b.min[1] > 2.0 && overlapXZ(plane, b) && (b.mat === 'lightPanel' || (b.mat === 'metal' && bw < 0.1));
    if (!underGear && !hanging) keep.push(b);
  }
  L.boxes = keep;
  const B: Box[] = [];
  const body: MatId = 'wallWhite';
  const win: MatId = 'screenDark';
  // 胴体（前 → 後）
  B.push(box([xa - 1.7, 2.5, zc - 8], [xa + 1.7, 5.9, zc + 8], body, false));
  B.push(box([xa - 1.5, 2.7, zc - 10.5], [xa + 1.5, 5.7, zc - 8], body, false));
  B.push(box([xa - 1.1, 3.0, zc - 12.3], [xa + 1.1, 5.2, zc - 10.5], body, false));
  B.push(box([xa - 0.6, 3.5, zc - 13.4], [xa + 0.6, 4.6, zc - 12.3], body, false));
  B.push(box([xa - 1.4, 2.9, zc + 8], [xa + 1.4, 5.9, zc + 10.5], body, false));
  B.push(box([xa - 1.0, 3.6, zc + 10.5], [xa + 1.0, 5.9, zc + 13], body, false));
  B.push(box([xa - 0.5, 4.6, zc + 13], [xa + 0.5, 5.9, zc + 15], body, false));
  // 窓帯・操縦席窓・扉
  B.push(box([xa - 1.74, 4.55, zc - 7.5], [xa - 1.7, 4.95, zc + 7.5], win, false));
  B.push(box([xa + 1.7, 4.55, zc - 7.5], [xa + 1.74, 4.95, zc + 7.5], win, false));
  B.push(box([xa - 1.14, 4.5, zc - 12.2], [xa - 1.1, 4.95, zc - 11.0], win, false));
  B.push(box([xa + 1.1, 4.5, zc - 12.2], [xa + 1.14, 4.95, zc - 11.0], win, false));
  B.push(box([xa - 0.9, 4.5, zc - 12.34], [xa + 0.9, 4.95, zc - 12.3], win, false));
  B.push(box([xa - 1.74, 2.9, zc - 6.8], [xa - 1.7, 4.8, zc - 5.9], 'doorMetal', false));
  B.push(box([xa - 1.74, 2.9, zc + 6.0], [xa - 1.7, 4.8, zc + 6.9], 'doorMetal', false));
  // 垂直尾翼・水平尾翼
  const finTop = Math.min(h - 0.3, 8.6);
  B.push(box([xa - 0.15, 5.9, zc + 10.5], [xa + 0.15, Math.min(finTop, 7.3), zc + 14.8], body, false));
  if (finTop > 7.4) B.push(box([xa - 0.12, 7.3, zc + 12.2], [xa + 0.12, finTop, zc + 14.9], body, false));
  B.push(box([xa - 4.2, 5.5, zc + 12.5], [xa - 0.5, 5.75, zc + 14.6], body, false));
  B.push(box([xa + 0.5, 5.5, zc + 12.5], [xa + 4.2, 5.75, zc + 14.6], body, false));
  // 主翼（後退翼を 3 段の箱で）
  for (const sg of [-1, 1]) {
    const x = (a: number, b: number) => [Math.min(xa + sg * a, xa + sg * b), Math.max(xa + sg * a, xa + sg * b)];
    const [r0, r1] = x(1.7, Math.min(5.5, halfSpan));
    B.push(box([r0, 3.2, zc - 1.0], [r1, 3.62, zc + 3.6], body, false));
    if (halfSpan > 5.6) {
      const [m0, m1] = x(5.5, Math.min(8.5, halfSpan));
      B.push(box([m0, 3.25, zc + 0.6], [m1, 3.56, zc + 3.4], body, false));
    }
    if (halfSpan > 8.6) {
      const [t0, t1] = x(8.5, halfSpan);
      B.push(box([t0, 3.3, zc + 1.6], [t1, 3.5, zc + 3.1], body, false));
      const tipX = xa + sg * halfSpan;
      B.push(box([Math.min(tipX, tipX - sg * 0.25), 3.28, zc + 2.2], [Math.max(tipX, tipX - sg * 0.25), 3.55, zc + 2.6], sg < 0 ? 'neonRed' : 'signEmissive', false));
    }
    // エンジン（吊り下げ。下端 2.0 m）
    const ex = xa + sg * 4.3;
    if (Math.abs(ex - xa) + 0.8 < halfSpan) {
      B.push(box([ex - 0.75, 2.0, zc - 2.2], [ex + 0.75, 3.45, zc + 0.9], body, false));
      B.push(box([ex - 0.62, 2.12, zc - 2.26], [ex + 0.62, 3.33, zc - 2.2], win, false));
      B.push(box([ex - 0.5, 2.25, zc + 0.9], [ex + 0.5, 3.2, zc + 1.4], 'metalDark', false));
      B.push(box([ex - 0.25, 3.3, zc - 1.0], [ex + 0.25, 3.5, zc + 0.6], body, false));
    }
  }
  // 航法灯・ビーコン
  B.push(box([xa - 0.12, 5.9, zc - 0.12], [xa + 0.12, 6.12, zc + 0.12], 'neonRed', false));
  B.push(box([xa - 0.1, 4.7, zc + 14.85], [xa + 0.1, 4.9, zc + 15.1], 'lightPanel', false));
  // 脚
  B.push(...gearFor(xa));
  push(c, ...B);
  // 機体を照らす（胴体の下と主翼の間）
  addLight(c, { pos: [xa, 1.7, zc - 3], color: 0xeef3ff, intensity: 1.6, distance: 22 });
  addLight(c, { pos: [xa, 1.7, zc + 6], color: 0xeef3ff, intensity: 1.2, distance: 18 });
  // ボーディングブリッジ（近い長辺の壁 → 前方左扉。床上 2.6 m で下を歩ける）
  const doorX = xa - 1.7;
  const wallX = main.x0 + WALL_T;
  if (doorX - wallX <= 16 && doorX - wallX >= 3) {
    const z0 = zc - 7.0;
    const z1 = zc - 5.6;
    push(c, box([wallX, 2.6, z0], [doorX, 5.0, z1], 'shelfMetal', false));
    push(c, box([wallX + 0.3, 3.6, z0 - 0.03], [doorX - 0.3, 4.4, z0], win, false));
    push(c, box([wallX + 0.3, 3.6, z1], [doorX - 0.3, 4.4, z1 + 0.03], win, false));
    const px = (wallX + doorX) / 2;
    const col = box([px - 0.2, 0, (z0 + z1) / 2 - 0.2], [px + 0.2, 2.6, (z0 + z1) / 2 + 0.2], 'metalDark');
    if (canPlace(c, col, { pad: 0.3 })) push(c, col);
    addSign(c, { text: 'GATE 0', sub: 'FINAL BOARDING · 最終案内', pos: [wallX + 0.05, 2.2, (z0 + z1) / 2], dir: 1, width: 1.4, kind: 'emissive', color: 0xffffff, background: 0x12285a });
  }
  L.lights.forEach((l) => { l.color = 0xeef3ff; });
}

// ---------------------------------------------------------------- L09 無限温浴施設（MegaAtrium bath）
// 浴槽の縁を石に、湯を琥珀色に（水面下の箔）、植栽、暖色、「ゆ」のサイン。浴槽ごとの湯気（steam スロット）。床の薄い mist は ParticleDetail が後段で足す。

function dressL09(c: Ctx): void {
  const { L } = c;
  recolor(c, (b) => b.solid && b.mat === 'floorTile' && Math.abs(b.max[1] - 0.3) < 0.02 && b.min[1] < 0.01 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) <= 0.3, 'columnConcrete', 0, c.shell);
  const waters = L.boxes.filter((b) => b.mat === 'waterShallow' && !b.solid);
  // 湯の色: 水面の下に温かい木色の底（大浴場 = 最大の水面と、小さな浴槽だけ。中間の区画プールは三角形予算のため見送る）
  const areaOf = (b: Box) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);
  const grand = waters.reduce<Box | null>((best, b) => (!best || areaOf(b) > areaOf(best) ? b : best), null);
  for (const wb of waters) {
    if (wb !== grand && areaOf(wb) > 40) continue;
    push(c, box([wb.min[0] + 0.03, 0.002, wb.min[2] + 0.03], [wb.max[0] - 0.03, 0.009, wb.max[2] - 0.03], 'floorWood', false));
  }
  // 区画の腰壁（1.2 m のタイル）を木の間仕切りに
  recolor(c, (b) => b.solid && b.mat === 'floorTile' && Math.abs(b.max[1] - 1.2) < 0.02 && b.min[1] < 0.01, 'woodPanel', 0, c.shell);
  // 植栽（大浴場の縁の外側の四隅 + 各浴槽の脇）
  const pr = c.rng.fork('plants');
  let planted = 0;
  for (const wb of waters.sort((a, b) => rectArea(rect(b.min[0], b.min[2], b.max[0], b.max[2])) - rectArea(rect(a.min[0], a.min[2], a.max[0], a.max[2])))) {
    const corners: [number, number][] = [[wb.min[0] - 1.1, wb.min[2] - 1.1], [wb.max[0] + 1.1, wb.min[2] - 1.1], [wb.min[0] - 1.1, wb.max[2] + 1.1], [wb.max[0] + 1.1, wb.max[2] + 1.1]];
    for (const [x, z] of corners) {
      if (planted >= 14) break;
      const s = pr.float(0.45, 0.7);
      const ph = pr.float(1.2, 2.0);
      const plant = box([x - s, 0, z - s], [x + s, ph, z + s], 'plant');
      if (!canPlace(c, plant, { pad: 0.3 })) continue;
      push(c, box([x - s - 0.1, 0, z - s - 0.1], [x + s + 0.1, 0.35, z + s + 0.1], 'columnConcrete'), plant);
      planted++;
    }
  }
  // 湯気: 浴槽（大浴場 + 小さな浴槽。40 m² 超の区画プールは冷水として除く）ごとに水面直上 0〜1.3 m の steam スロット。
  // 後段の ParticleDetail(mist) は別 type なので残る（generators/particles.ts）。粒数の合計は RoomBuilder が Tier の particleCap に収める
  const steam: ParticleSpec[] = [];
  for (const wb of waters) {
    if (wb !== grand && areaOf(wb) > 40) continue;
    if (steam.length >= 12) break;
    const a = areaOf(wb);
    // 大浴場は最大 320 粒（seed 7 の 128 × 79 m でも薄く広がる）、小浴槽（3 × 4 m）は 18〜40 粒。合計 + mist 120 が Tier high の上限 1000 に収まる
    const count = wb === grand ? Math.min(320, Math.max(24, Math.round(a * 0.5))) : Math.min(40, Math.max(18, Math.round(a * 1.6)));
    const aabb: AABB = { min: [wb.min[0] + 0.2, wb.max[1], wb.min[2] + 0.2], max: [wb.max[0] - 0.2, wb.max[1] + 1.3, wb.max[2] - 0.2] };
    const vol = Math.max(0.1, (aabb.max[0] - aabb.min[0]) * (aabb.max[1] - aabb.min[1]) * (aabb.max[2] - aabb.min[2]));
    steam.push({ type: 'steam', density: count / vol, aabb, size: 0.8, color: 0xfff1e2 });
  }
  addParticles(L, ...steam);
  // 「ゆ」（入口側の壁に赤い発光サイン）
  signOnWall(L, innerFaces(c.rects), L.sockets, 'ゆ', { y: 2.6, width: 1.3, kind: 'emissive', color: 0xffffff, background: 0xa8302c, prefer: [2, 1, 3, 0] });
  for (const l of L.lights) l.color = 0xffc890;
  L.palette = { ...L.palette, lightColor: 0xffc890, ambient: 0x9a7a5a, fog: 0x2a2018 };
}

// ---------------------------------------------------------------- L10 夜間郊外住宅地（StreetGrid suburb）
// 一部の窓を TV の青白い光に（LightingPhase allWindowsLit は windowDark だけを点灯するので先に差し替える）、区画の白い低い塀。
// 「俯瞰」と「地平の都市」は室内では出せないので保留。

function dressL10(c: Ctx): void {
  const { L } = c;
  const tr = c.rng.fork('tv');
  recolor(c, (b) => b.mat === 'windowDark' && !b.solid && b.min[1] < 3.0 && tr.chance(0.15), 'screenGlow', c.shell);
  const main = c.rects[0];
  const g = streetGridOf(main);
  const fr = c.rng.fork('fence');
  let fences = 0;
  const before = L.boxes.length;
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      const r = blockRect(g, i, j);
      if (!blockHasBuilding(c, r)) continue;
      const fr0 = inner(r, 1.25);
      const t = 0.06;
      const fh = 0.9;
      const gap = 1.3;
      const edges: [number, number, number, number, boolean][] = [
        [fr0.x0, fr0.z0, fr0.x1, fr0.z0 + t, true], [fr0.x0, fr0.z1 - t, fr0.x1, fr0.z1, true],
        [fr0.x0, fr0.z0, fr0.x0 + t, fr0.z1, false], [fr0.x1 - t, fr0.z0, fr0.x1, fr0.z1, false],
      ];
      for (const [x0, z0, x1, z1, horizontal] of edges) {
        const a0 = horizontal ? x0 : z0;
        const a1 = horizontal ? x1 : z1;
        const mid = (a0 + a1) / 2 + fr.float(-1.5, 1.5);
        for (const [s0, s1] of [[a0, mid - gap], [mid + gap, a1]] as [number, number][]) {
          if (s1 - s0 < 0.6 || fences >= 90) continue;
          const fb = horizontal ? box([s0, 0.12, z0], [s1, 0.12 + fh, z1], 'wallWhite') : box([x0, 0.12, s0], [x1, 0.12 + fh, s1], 'wallWhite');
          if (!canPlace(c, fb, { lanes: false, pad: 0.15, before })) continue;
          push(c, fb);
          fences++;
        }
      }
    }
  }
  L.palette = { ...L.palette, fog: 0x0a0d18, ambient: 0x30323c };
}

// ---------------------------------------------------------------- L11 環状モノレール都市（MegaAtrium ring）
// 軌道桁の上にモノレール車両（2 編成）、ホーム縁の黄線、外壁上部に夜景の塔（暗い箔 + 窓明かりの instances）。

function dressL11(c: Ctx): void {
  const rects = c.rects;
  const h = c.h;
  const gw = 4.0;
  const beamTop = 5.0;
  const lit: InstanceSpec['transforms'] = [];
  const towers: Box[] = [];
  const tr = c.rng.fork('towers');
  rects.forEach((r, idx) => {
    const cy = courtyardEdges(r, rects);
    const dir = cy.findIndex((b) => b) as Dir;
    if (dir < 0) return;
    const off = gw + 1.4;
    const alongX = dir === 0 || dir === 2;
    // ホーム縁の黄線（回廊 y 3.6 の吹抜側の縁）
    const edge = dir === 0 ? r.z1 - gw : dir === 2 ? r.z0 + gw : dir === 1 ? r.x1 - gw : r.x0 + gw;
    const inwardSign = dir === 0 || dir === 1 ? -1 : 1;
    const y0 = FLOOR + 0.002;
    const y1 = FLOOR + 0.012;
    if (alongX) push(c, box([r.x0 + 2, y0, Math.min(edge, edge - inwardSign * 0.3)], [r.x1 - 2, y1, Math.max(edge, edge - inwardSign * 0.3)], 'yellowLine', false));
    else push(c, box([Math.min(edge, edge - inwardSign * 0.3), y0, r.z0 + 2], [Math.max(edge, edge - inwardSign * 0.3), y1, r.z1 - 2], 'yellowLine', false));
    // 車両（南・北の帯）
    if (idx === 0 || idx === 1) {
      const line = dir === 0 ? r.z1 - off : dir === 2 ? r.z0 + off : dir === 1 ? r.x1 - off : r.x0 + off;
      const mid = alongX ? (r.x0 + r.x1) / 2 + (idx === 0 ? -6 : 6) : (r.z0 + r.z1) / 2;
      const len = 14;
      const hw = 1.3;
      const yb = beamTop;
      const body: MatId = 'wallWhite';
      const b = (a0: number, y0b: number, s0: number, a1: number, y1b: number, s1: number, mat: MatId) =>
        alongX ? box([a0, y0b, line + s0], [a1, y1b, line + s1], mat, false) : box([line + s0, y0b, a0], [line + s1, y1b, a1], mat, false);
      push(c,
        b(mid - len / 2, yb, -hw, mid + len / 2, yb + 2.6, hw, body),
        b(mid - len / 2 - 0.9, yb + 0.3, -hw + 0.2, mid - len / 2, yb + 2.3, hw - 0.2, body),
        b(mid + len / 2, yb + 0.3, -hw + 0.2, mid + len / 2 + 0.9, yb + 2.3, hw - 0.2, body),
        b(mid - len / 2 + 0.3, yb + 2.6, -hw + 0.1, mid + len / 2 - 0.3, yb + 2.78, hw - 0.1, 'metalDark'),
        b(mid - len / 2 + 0.6, yb + 1.3, -hw - 0.03, mid + len / 2 - 0.6, yb + 2.0, -hw, 'windowLit'),
        b(mid - len / 2 + 0.6, yb + 1.3, hw, mid + len / 2 - 0.6, yb + 2.0, hw + 0.03, 'windowLit'),
        b(mid - len / 2 - 0.9, yb + 0.5, -hw - 0.03, mid + len / 2 + 0.9, yb + 0.72, -hw, 'ledBlue'),
        b(mid - len / 2 - 0.9, yb + 0.5, hw, mid + len / 2 + 0.9, yb + 0.72, hw + 0.03, 'ledBlue'),
        b(mid - len / 2 - 0.95, yb + 1.0, -0.6, mid - len / 2 - 0.9, yb + 1.3, -0.25, 'lightPanel'),
        b(mid - len / 2 - 0.95, yb + 1.0, 0.25, mid - len / 2 - 0.9, yb + 1.3, 0.6, 'lightPanel'),
        b(mid + len / 2 + 0.9, yb + 1.0, -0.5, mid + len / 2 + 0.95, yb + 1.3, 0.5, 'neonRed'),
      );
      const signPos: Vec3 = alongX ? [mid, yb + 2.3, line + (dir === 0 ? hw + 0.04 : -hw - 0.04)] : [line + (dir === 1 ? hw + 0.04 : -hw - 0.04), yb + 2.3, mid];
      addSign(c, { text: 'LOOP LINE', sub: '環状線 · NO STOPS', pos: signPos, dir: dir === 0 ? 0 : dir === 2 ? 2 : dir === 1 ? 1 : 3, width: 2.0, kind: 'emissive', color: 0xffffff, background: 0x10203a });
    }
    // 夜景の塔（外壁の面。店舗と看板帯の上 3.6〜h-0.3）
    for (const f of innerFaces([r]).filter((f) => f.dir !== dir && f.a1 - f.a0 > 6)) {
      if (!f.horizontal && !alongX && Math.abs(f.face - (dir === 1 ? r.x1 - WALL_T : r.x0 + WALL_T)) < 0.2) continue;
      skylineOnFace(tr, f, 3.6, h - 0.3, 0.12, lit, towers, 18);
    }
  });
  push(c, ...towers);
  addInstances(c, tr.fork('lit'), 'windowLit', [0.22, 0.3, 0.03], lit);
}

// ---------------------------------------------------------------- L12 設備大聖堂（MegaHall nave）
// 身廊の柱にステンレスの配管束と横引き管、両端の壁にステンドグラス風の縦長窓（青 / 赤の発光帯）、青と赤の照明 2 灯。
// ScaleAnomaly perProp が内装を 3〜8 倍にするので、ここで足す物は全てシェル側に入れる。

function dressL12(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  const cx = (main.x0 + main.x1) / 2;
  const S: Box[] = [];
  // 身廊の柱（1.2 m 角の columnConcrete）に配管束（同寸なので instances）
  const cols = L.boxes.slice(0, c.shell).filter((b) => b.solid && b.mat === 'columnConcrete' && Math.abs(b.max[0] - b.min[0] - 1.2) < 0.02 && b.max[1] >= h - 0.05);
  const rows = new Map<number, number[]>();
  const pipes: InstanceSpec['transforms'] = [];
  const collars: InstanceSpec['transforms'] = [];
  for (const col of cols) {
    const x = (col.min[0] + col.max[0]) / 2;
    const z = (col.min[2] + col.max[2]) / 2;
    const sx = x < cx ? -1 : 1;
    for (const dz of [-0.5, 0, 0.5]) pipes.push({ pos: [x + sx * 1.32, 0, z + dz], yaw: 0 });
    collars.push({ pos: [x + sx * 1.05, h - 1.4, z], yaw: 0 });
    const key = Math.round(x * 2);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(z);
  }
  addInstances(c, c.rng.fork('pipes'), 'stainless', [0.22, h - 1.2, 0.22], pipes);
  addInstances(c, c.rng.fork('collars'), 'stainless', [0.9, 0.25, 1.2], collars);
  // 横引きの主管（柱列に沿う 2 本）と身廊を渡る枝管
  for (const [key, zs] of rows) {
    const x = key / 2;
    const sx = x < cx ? -1 : 1;
    const z0 = Math.min(...zs) - 3;
    const z1 = Math.max(...zs) + 3;
    S.push(box([x + sx * 1.6 - 0.25, h - 2.2, Math.max(main.z0 + 0.5, z0)], [x + sx * 1.6 + 0.25, h - 1.7, Math.min(main.z1 - 0.5, z1)], 'stainless', false));
    if (sx > 0) {
      for (const z of zs) {
        if (rows.size < 2) break;
        S.push(box([cx - (x - cx) - 1.6, h - 2.6, z - 0.2], [x + 1.6, h - 2.2, z + 0.2], 'stainless', false));
      }
    }
  }
  // ステンドグラス（両端の壁: 中央に 5 連の縦長窓。側壁: 8 m ごとの高窓）
  const strips: [MatId, number][] = [['aquariumBlue', 0.5], ['neonBlue', 0.25], ['aquariumBlue', 0.3], ['neonRed', 0.18], ['aquariumBlue', 0.5]];
  const stripsSide: [MatId, number][] = [['aquariumBlue', 0.55], ['neonBlue', 0.22], ['aquariumBlue', 0.55]];
  const stained = (f: Face, at: number, y0: number, y1: number, pattern = strips) => {
    let a = at;
    for (const [mat, wdt] of pattern) {
      S.push(alongFace(f, a, wdt, 0.02, 0.05, y0, y1, mat, false));
      a += wdt;
    }
    S.push(alongFace(f, at - 0.1, a - at + 0.2, 0.0, 0.08, y1, y1 + 0.2, 'metalDark', false));
    S.push(alongFace(f, at - 0.1, a - at + 0.2, 0.0, 0.08, y0 - 0.2, y0, 'metalDark', false));
  };
  const winW = strips.reduce((s, [, wdt]) => s + wdt, 0);
  for (const f of innerFaces(c.rects)) {
    const runs = freeRuns(f, L.sockets, 0.6);
    if (f.horizontal) {
      const y0 = Math.min(6.0, h * 0.4);
      const y1 = Math.min(h - 1.6, y0 + 6.5);
      for (let i = -2; i <= 2; i++) {
        const at = cx + i * 2.4 - winW / 2;
        if (!runs.some(([a, b]) => at > a && at + winW < b)) continue;
        stained(f, at, y0 + Math.abs(i) * 0.8, y1);
      }
    } else {
      const y0 = Math.max(6.5, h * 0.55);
      const y1 = h - 1.4;
      if (y1 - y0 < 1.5) continue;
      const sideW = stripsSide.reduce((s, [, wdt]) => s + wdt, 0);
      for (let at = f.a0 + 5; at + sideW < f.a1 - 2; at += 16) {
        if (!runs.some(([a, b]) => at > a && at + sideW < b)) continue;
        stained(f, at, y0, y1, stripsSide);
      }
    }
  }
  shellPush(c, S);
  addLight(c, { pos: [cx, Math.min(h - 3, 8), main.z1 - 4], color: 0x4a7dff, intensity: 1.6, distance: 34 });
  addLight(c, { pos: [cx, Math.min(h - 3, 8), main.z0 + 5], color: 0xff5a48, intensity: 0.9, distance: 24 });
  L.palette = { ...L.palette, ambient: 0x343a48 };
}

// ---------------------------------------------------------------- L13 サーバー森林（GridGenerator ServerGrid）
// ラックの側面に黒い化粧板（screenDark。PropRepetition の LED 帯・レールはその上に載る）、天井灯を間引いて暗く冷たく。

function dressL13(c: Ctx): void {
  const { L } = c;
  const racks = L.boxes.slice(c.shell).filter((b) => b.solid && b.mat === 'furnitureDark' && b.max[1] - b.min[1] >= 1.8 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 0.7 && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 1.2);
  // 構築時間（+30% 以内）のため化粧板は通路に面する長辺 2 面だけ（1 ラック 2 箔）
  const S: Box[] = [];
  const t = 0.012;
  for (const r of racks) {
    const y0 = r.min[1] + 0.02;
    const y1 = r.max[1] - 0.02;
    const alongX = r.max[0] - r.min[0] >= r.max[2] - r.min[2];
    if (alongX) {
      S.push(box([r.min[0] - t, y0, r.min[2] - t], [r.max[0] + t, y1, r.min[2]], 'screenDark', false), box([r.min[0] - t, y0, r.max[2]], [r.max[0] + t, y1, r.max[2] + t], 'screenDark', false));
    } else {
      S.push(box([r.min[0] - t, y0, r.min[2] - t], [r.min[0], y1, r.max[2] + t], 'screenDark', false), box([r.max[0], y0, r.min[2] - t], [r.max[0] + t, y1, r.max[2] + t], 'screenDark', false));
    }
  }
  shellPush(c, S);
  const dr = c.rng.fork('dim');
  recolor(c, (b) => !b.solid && (b.mat === 'ledBlue' || b.mat === 'lightPanel') && b.min[1] > c.h - 0.1 && dr.chance(0.6), 'lightOff', c.shell);
  for (const l of L.lights) { l.intensity *= 0.55; l.color = 0x7fb0ff; }
  L.palette = { ...L.palette, lightColor: 0x8fb8ff, ambient: 0x1a2030, fog: 0x05070d, lightIntensity: L.palette.lightIntensity * 0.6 };
  // 入口の内側にデータセンターのサイン
  signOnWall(L, innerFaces(c.rects), L.sockets, 'SERVER FOREST · 3F', { y: 2.5, width: 2.2, kind: 'emissive', color: 0x9fd0ff, background: 0x080c18, prefer: [2], sub: 'AUTHORIZED PERSONNEL ONLY' });
}

// ---------------------------------------------------------------- L14 温室都市（MegaAtrium greenhouse）
// 天井から落ちる滝（waterWall の交差する 2 面 + 石の水盤 + 泡 + 霧）、庭園の椰子、回廊から垂れるつる。

function dressL14(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  const v = inner(main, 5.5);
  // 滝の位置: 中央から候補を試す（水盤 5.2 m 角が空いていて、水柱が橋・スラブに当たらない）
  const cands: [number, number][] = [[0.5, 0.5], [0.35, 0.5], [0.65, 0.5], [0.5, 0.35], [0.5, 0.65], [0.3, 0.3], [0.7, 0.7], [0.3, 0.7], [0.7, 0.3]];
  let fall: [number, number] | null = null;
  for (const [fx, fz] of cands) {
    const x = snap(v.x0 + (v.x1 - v.x0) * fx);
    const z = snap(v.z0 + (v.z1 - v.z0) * fz);
    const basin = box([x - 2.6, 0, z - 2.6], [x + 2.6, 0.5, z + 2.6], 'columnConcrete');
    const column: AABB = { min: [x - 1.5, 0.5, z - 1.5], max: [x + 1.5, h, z + 1.5] };
    if (!canPlace(c, basin, { pad: 0.6 })) continue;
    if (L.boxes.some((b) => b.solid && overlap3(b, column))) continue;
    fall = [x, z];
    break;
  }
  if (fall) {
    const [x, z] = fall;
    const k = 2.4;
    const curb = 0.3;
    push(c,
      box([x - k - curb, 0, z - k - curb], [x + k + curb, 0.42, z - k], 'columnConcrete'),
      box([x - k - curb, 0, z + k], [x + k + curb, 0.42, z + k + curb], 'columnConcrete'),
      box([x - k - curb, 0, z - k], [x - k, 0.42, z + k], 'columnConcrete'),
      box([x + k, 0, z - k], [x + k + curb, 0.42, z + k], 'columnConcrete'),
      box([x - k, 0.01, z - k], [x + k, 0.36, z + k], 'waterShallow', false),
      box([x - 1.6, 0.36, z - 1.6], [x + 1.6, 0.44, z + 1.6], 'snow', false),
      box([x - 1.3, 0.44, z - 0.035], [x + 1.3, h - 0.25, z + 0.035], 'waterWall', false),
      box([x - 0.035, 0.44, z - 1.3], [x + 0.035, h - 0.25, z + 1.3], 'waterWall', false),
      box([x - 1.6, h - 0.32, z - 1.6], [x + 1.6, h - 0.05, z - 1.3], 'metalDark', false),
      box([x - 1.6, h - 0.32, z + 1.3], [x + 1.6, h - 0.05, z + 1.6], 'metalDark', false),
      box([x - 1.6, h - 0.32, z - 1.3], [x - 1.3, h - 0.05, z + 1.3], 'metalDark', false),
      box([x + 1.3, h - 0.32, z - 1.3], [x + 1.6, h - 0.05, z + 1.3], 'metalDark', false),
    );
    (L.zones ??= []).push({ kind: 'water', aabb: { min: [x - k, -0.1, z - k], max: [x + k, 0.5, z + k] }, params: { slow: 0.6, depth: 0.35 } });
    if (!L.particles) L.particles = { type: 'mist', density: 0.6, aabb: { min: [x - 3.2, 0.1, z - 3.2], max: [x + 3.2, 1.4, z + 3.2] }, size: 1.6, color: 0xdfe8e4 };
    addLight(c, { pos: [x, 4.0, z], color: 0xdfe8ff, intensity: 1.1, distance: 18 });
    addSign(c, { text: 'RAIN VORTEX', sub: '雨の渦 · 40 m', pos: [x, 0.62, z - k - curb - 0.02], dir: 2, width: 1.6, kind: 'plate', color: 0xf0f0e8, background: 0x24302a });
  }
  // 椰子（庭園ゾーンの花壇の中。幹はソリッド、樹冠は球）
  const pr = c.rng.fork('palms');
  let palms = 0;
  for (const zr of themeZones(c, 'garden')) {
    const b = inner(zr, 2.4);
    if (b.x1 - b.x0 < 3 || b.z1 - b.z0 < 3) continue;
    for (let i = 0; i < 3 && palms < 12; i++) {
      const x = pr.float(b.x0, b.x1);
      const z = pr.float(b.z0, b.z1);
      let th = pr.float(3.4, 4.6);
      const trunk = box([x - 0.12, 0.4, z - 0.12], [x + 0.12, th, z + 0.12], 'handrailWood');
      if (!canPlace(c, trunk, { lanes: false, pad: 0.4 })) continue;
      let crown = box([x - 1.4, th - 0.5, z - 1.4], [x + 1.4, th + 0.9, z + 1.4], 'plant', false);
      if (L.boxes.some((o) => o.solid && overlap3(o, crown))) {
        th = 2.6;
        trunk.max[1] = th;
        crown = box([x - 1.2, th - 0.4, z - 1.2], [x + 1.2, th + 0.7, z + 1.2], 'plant', false);
        if (L.boxes.some((o) => o.solid && overlap3(o, crown))) continue;
      }
      shellPush(c, [trunk, crown]);
      palms++;
    }
  }
  // つる（回廊の吹抜側の縁から垂れる。instances）
  const vine: InstanceSpec['transforms'] = [];
  const vr = c.rng.fork('vines');
  const gEdge = inner(main, 4.5);
  const along = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / 2.4);
    for (let i = 0; i <= n; i++) {
      if (!vr.chance(0.75)) continue;
      const t = (i + 0.5) / (n + 1);
      vine.push({ pos: [x0 + (x1 - x0) * t, FLOOR - 1.35, z0 + (z1 - z0) * t], yaw: vr.float(0, Math.PI * 2), scale: vr.float(0.7, 1.3) });
    }
  };
  along(gEdge.x0 + 1, gEdge.z0 - 0.25, gEdge.x1 - 1, gEdge.z0 - 0.25);
  along(gEdge.x0 + 1, gEdge.z1 + 0.25, gEdge.x1 - 1, gEdge.z1 + 0.25);
  along(gEdge.x0 - 0.25, gEdge.z0 + 1, gEdge.x0 - 0.25, gEdge.z1 - 1);
  along(gEdge.x1 + 0.25, gEdge.z0 + 1, gEdge.x1 + 0.25, gEdge.z1 - 1);
  addInstances(c, vr.fork('inst'), 'plant', [0.5, 1.0, 0.25], vine);
  L.palette = { ...L.palette, ambient: 0xa0a890 };
}

// ---------------------------------------------------------------- L15 屋内高速道路（RoadGraph）
// 「東 ↑ / 西 ↑」の緑の大型標識をガントリーに、天井のジェットファン、非常電話。ナトリウム灯は Generator が持つ。

function dressL15(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  const cx = (main.x0 + main.x1) / 2;
  const len = main.z1 - main.z0;
  const laneOut = 3.85;
  const branches = c.rects.slice(1);
  const gantryZs = branches.map((b) => b.z0 - 2.5);
  let gz: number | null = null;
  for (const f of [0.42, 0.3, 0.55, 0.68, 0.2]) {
    const z = snap(main.z0 + len * f);
    if (gantryZs.every((g) => Math.abs(g - z) > 5) && z > main.z0 + 6 && z < main.z1 - 8) { gz = z; break; }
  }
  if (gz !== null) {
    const postA = box([cx - laneOut - 0.9, 0, gz - 0.15], [cx - laneOut - 0.6, 6.0, gz + 0.15], 'metal');
    const postB = box([cx + laneOut + 0.6, 0, gz - 0.15], [cx + laneOut + 0.9, 6.0, gz + 0.15], 'metal');
    if (canPlace(c, postA, { lanes: false }) && canPlace(c, postB, { lanes: false })) {
      push(c, postA, postB, box([cx - laneOut - 0.9, 5.7, gz - 0.18], [cx + laneOut + 0.9, 6.0, gz + 0.18], 'metal', false));
      push(c, box([cx - 3.7, 4.2, gz - 0.06], [cx - 0.5, 5.6, gz], 'noticeGreen', false), box([cx + 0.5, 4.2, gz - 0.06], [cx + 3.7, 5.6, gz], 'noticeGreen', false));
      addSign(c, { text: '東 ↑ EAST', sub: '首都高 ∞ 号線 · 次の出口 2 km', pos: [cx - 2.1, 4.95, gz - 0.08], dir: 2, width: 3.0, kind: 'plate', color: 0xffffff, background: 0x1f6b3a });
      addSign(c, { text: '西 ↑ WEST', sub: 'INDOOR EXPRESSWAY · KEEP LEFT', pos: [cx + 2.1, 4.95, gz - 0.08], dir: 2, width: 3.0, kind: 'plate', color: 0xffffff, background: 0x1f6b3a });
    }
  }
  // ジェットファン（天井。非ソリッド）
  for (const f of [0.22, 0.78]) {
    const z = main.z0 + len * f;
    for (const x of [cx - 2.4, cx + 2.4]) {
      push(c, box([x - 0.45, h - 1.35, z - 1.3], [x + 0.45, h - 0.45, z + 1.3], 'metalDark', false), box([x - 0.5, h - 0.45, z - 0.15], [x + 0.5, h - 0.05, z + 0.15], 'metal', false));
    }
  }
  // 非常電話（両側の壁。25 m ごと）
  const faces = innerFaces([main]).filter((f) => !f.horizontal);
  let phones = 0;
  for (const f of faces) {
    for (let at = main.z0 + 12; at < main.z1 - 6 && phones < 4; at += 25) {
      if (!freeRuns(f, L.sockets, 1.5).some(([a, b]) => at - 0.5 > a && at + 0.5 < b)) continue;
      push(c, alongFace(f, at - 0.2, 0.4, 0.07, 0.3, 1.1, 1.6, 'plasticYellow', false));
      signAt(L, f, at, 1.9, 0.6, 'SOS', { kind: 'plate', color: 0xffffff, background: 0xc03a30, offset: 0.08 });
      phones++;
    }
  }
}

// ---------------------------------------------------------------- L16 空間博物館（RoomGenerator Gallery）
// 暗い壁と落とした照明、島を展示ケース（暗い台 + ガラス + 部屋の模型）に、題字「まだ見ぬ世界たち WORLDS YET UNSEEN」、スポット 2 灯。
// 写真の額（GraphReference）は後段で壁の空きに置かれる。

function dressL16(c: Ctx): void {
  const { L } = c;
  const h = c.h;
  const wallMat = L.palette.wall;
  recolor(c, (b) => b.solid && b.mat === wallMat && b.max[1] - b.min[1] > 2 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.35, 'wallDark', 0, c.shell);
  const dr = c.rng.fork('dim');
  recolor(c, (b) => !b.solid && b.mat === L.palette.light && b.min[1] > h - 0.1 && dr.chance(0.75), 'lightOff', c.shell);
  for (const l of L.lights) l.intensity *= 0.4;
  // 展示ケース
  const islands = L.boxes.slice(c.shell).filter((b) => b.solid && b.mat === 'furnitureLight' && b.min[1] < 0.05 && b.max[1] > 0.4 && b.max[1] < 1.2).sort((a, b) => rectArea(rect(b.min[0], b.min[2], b.max[0], b.max[2])) - rectArea(rect(a.min[0], a.min[2], a.max[0], a.max[2])));
  const mr = c.rng.fork('models');
  const MODEL_MATS: MatId[] = ['wallWhite', 'wallCream', 'wallConcrete', 'floorTile', 'wallBeige'];
  islands.forEach((b, i) => {
    const idx = L.boxes.indexOf(b);
    if (idx >= 0) L.boxes[idx] = { ...b, mat: 'screenDark' };
    const [w, bh, d] = sizeOf(b);
    const top = b.max[1];
    const ins = 0.08;
    const caseH = Math.min(1.1, h - 0.6 - top);
    if (caseH < 0.5 || w < 0.7 || d < 0.7) return;
    push(c, box([b.min[0] + ins, top, b.min[2] + ins], [b.max[0] - ins, top + caseH, b.max[2] - ins], 'glass'));
    // 部屋の模型（白い小箱 + 灯った小窓 + 小さな扉）
    const mw = Math.min(0.9, w * 0.45);
    const md = Math.min(0.6, d * 0.4);
    const mh = mr.float(0.22, 0.4);
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    push(c,
      box([cx - mw / 2, top + 0.02, cz - md / 2], [cx + mw / 2, top + 0.02 + mh, cz + md / 2], mr.pick(MODEL_MATS), false),
      box([cx - mw / 2 + 0.08, top + 0.02 + mh * 0.4, cz - md / 2 - 0.006], [cx - mw / 2 + 0.2, top + 0.02 + mh * 0.75, cz - md / 2], 'windowLit', false),
      box([cx + 0.05, top + 0.02, cz - md / 2 - 0.006], [cx + 0.13, top + 0.02 + mh * 0.6, cz - md / 2], 'doorWood', false),
    );
    void bh;
    if (i < 2) addLight(c, { pos: [cx, Math.min(h - 0.3, top + caseH + 1.2), cz], color: 0xffe2b0, intensity: 1.2, distance: 7 });
    if (i < 8) addSign(c, { text: ['閉館後の学校廊下', '無人エスカレーター', '3:17 の待合室', '浅水タイル回廊', '無限宴会場', '青い水族館通路', '閉ループ廊下', '地下の昼光室'][i], sub: `EXHIBIT ${String(i + 1).padStart(2, '0')}`, pos: [cx, top - 0.16, b.min[2] - 0.01], dir: 2, width: Math.min(1.2, w - 0.2), kind: 'plate', color: 0xf0f0e8, background: 0x15161a });
  });
  // 題字（入口の反対の壁の上部）
  const faces = innerFaces(c.rects);
  const y = Math.max(2.5, h - 0.55);
  signOnWall(L, faces, L.sockets, 'まだ見ぬ世界たち', { y, width: 3.2, kind: 'plate', color: 0xf0f0e8, background: 0x15161a, prefer: [0, 1, 3], sub: 'WORLDS YET UNSEEN' });
  L.palette = { ...L.palette, ambient: 0x2a2a30, fog: 0x08080a, lightIntensity: L.palette.lightIntensity * 0.5 };
}

// ---------------------------------------------------------------- L17 無限団地（StreetGrid danchi）
// 歩道の街路樹（幹 + 球の樹冠）と、棟の各階の共用廊下の灯（暖色の小箔の instances）。ScaleAnomaly（×1.5）が後で全体を拡大する。

function dressL17(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const g = streetGridOf(main);
  const tr = c.rng.fork('trees');
  let trees = 0;
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      const r = blockRect(g, i, j);
      const e = inner(r, 0.6);
      const pts: [number, number][] = [];
      const step = 8;
      for (let x = e.x0 + 2.4; x < e.x1 - 2.0; x += step) pts.push([x, e.z0], [x, e.z1]);
      for (let z = e.z0 + 2.4; z < e.z1 - 2.0; z += step) pts.push([e.x0, z], [e.x1, z]);
      for (const [x, z] of pts) {
        if (trees >= 64) break;
        const th = tr.float(1.8, 2.3);
        const trunk = box([x - 0.08, 0.12, z - 0.08], [x + 0.08, th, z + 0.08], 'handrailWood');
        const crown = box([x - 0.8, th - 0.5, z - 0.8], [x + 0.8, th + 0.9, z + 0.8], 'plant', false);
        if (!canPlace(c, crown, { lanes: false, pad: 0.1 })) continue;
        if (overlapsAny(c, crown, (o) => o.max[1] - o.min[1] > 1.5 && Math.min(o.max[0] - o.min[0], o.max[2] - o.min[2]) < 0.3, 0.3)) continue;
        push(c, trunk, crown);
        trees++;
      }
    }
  }
  // 共用廊下の灯（棟の長辺の面。各階 2.7 m、3.2 m ピッチ）
  const lamps: InstanceSpec['transforms'] = [];
  const lr = c.rng.fork('lamps');
  for (let i = c.shell; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    const [w, bh, d] = sizeOf(b);
    if (!b.solid || b.mat !== 'wallConcrete' || bh < 5 || w < 4 || d < 3) continue;
    for (const side of [-1, 1]) {
      const z = side < 0 ? b.min[2] - 0.05 : b.max[2] + 0.05;
      for (let k = 0; k < 4 && 2.7 * k + 2.5 < bh - 0.3; k++) {
        const y = b.min[1] + 2.7 * k + 2.3;
        for (let x = b.min[0] + 1.6; x < b.max[0] - 1.0; x += 3.2) {
          if (!lr.chance(0.85)) continue;
          lamps.push({ pos: [x, y, z], yaw: 0 });
        }
      }
    }
    if (lamps.length > 600) break;
  }
  addInstances(c, lr.fork('inst'), 'lightWarm', [0.45, 0.1, 0.07], lamps);
}

// ---------------------------------------------------------------- L18 駐車場メガストラクチャ（ParkingGenerator）
// 駐車区画に車（箱の車）、柱の階表示を「B3 / B6」に、ランプ脇の階案内。

function dressL18(c: Ctx): void {
  const { L } = c;
  const sr = c.rng.fork('signs');
  const signs = L.signs ?? [];
  for (let k = 0; k < signs.length; k += 2) {
    const text = sr.chance(0.5) ? 'B3' : 'B6';
    if (signs[k]?.text === 'B1') signs[k].text = text;
    if (signs[k + 1]?.text === 'B1') signs[k + 1].text = text;
  }
  // 区画線（wallWhite の薄い床線、長さ ≈ 5 m）から区画を復元して車を置く
  const lines = L.boxes.slice(c.shell).filter((b) => !b.solid && b.mat === 'wallWhite' && b.max[1] <= 0.013 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.2 && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) > 4.5);
  const rows = new Map<string, Box[]>();
  for (const ln of lines) {
    const alongZ = ln.max[2] - ln.min[2] > ln.max[0] - ln.min[0];
    const key = alongZ ? `z:${ln.min[2].toFixed(1)}:${ln.max[2].toFixed(1)}` : `x:${ln.min[0].toFixed(1)}:${ln.max[0].toFixed(1)}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(ln);
  }
  const cr = c.rng.fork('cars');
  let cars = 0;
  for (const [key, list] of rows) {
    const alongZ = key.startsWith('z');
    list.sort((a, b) => (alongZ ? a.min[0] - b.min[0] : a.min[2] - b.min[2]));
    for (let i = 0; i + 1 < list.length && cars < 36; i++) {
      const a = list[i];
      const b = list[i + 1];
      const gap = alongZ ? b.min[0] - a.min[0] : b.min[2] - a.min[2];
      if (Math.abs(gap - 2.5) > 0.1) continue;
      if (!cr.chance(0.42)) continue;
      const cx = alongZ ? (a.min[0] + b.min[0]) / 2 + 0.06 : (a.min[0] + a.max[0]) / 2;
      const cz = alongZ ? (a.min[2] + a.max[2]) / 2 : (a.min[2] + b.min[2]) / 2 + 0.06;
      const tmp: Box[] = [];
      car(tmp, snap(cx, 0.1), snap(cz, 0.1), alongZ, cr);
      if (!tmp.every((bx) => !bx.solid || canPlace(c, bx, { pad: 0.2, ignoreLow: 0.2 }))) continue;
      push(c, ...tmp);
      cars++;
    }
  }
  // ランプ脇の階案内
  const ramp = L.sockets.find((s) => s.type === 'ramp');
  if (ramp) {
    const iw = inwardOf(ramp.dir);
    const side: [number, number] = ramp.dir === 0 || ramp.dir === 2 ? [1, 0] : [0, 1];
    const off = ramp.width / 2 + 0.9;
    const pos: Vec3 = [ramp.pos[0] + iw[0] * 0.17 + side[0] * off, 1.9, ramp.pos[2] + iw[1] * 0.17 + side[1] * off];
    addSign(c, { text: '↑ B2  ↓ B4', sub: 'RAMP · 出口はありません', pos, dir: ((ramp.dir + 2) % 4) as Dir, width: 1.4, kind: 'emissive', color: 0xffffff, background: 0x14285a });
  }
  L.palette = { ...L.palette, ambient: 0x4a4c50 };
}

// ---------------------------------------------------------------- L19 凍結リゾート（MegaAtrium resort）
// 凍結プール（手続きの氷面）、天井のつらら（instances）、壁の氷壁、上階の暖色の室内窓（instances）、青い灯。雪と霧は Modifier。

function dressL19(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  const ices = L.boxes.filter((b) => !b.solid && b.mat === 'ice' && b.max[1] <= 0.05 && (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) > 20);
  // 第22回: 氷の上の青く光る半透明の箔は外した（氷面が「水色の板」に見えていた。氷は材質 'ice' の手続きの氷面 + 艶で見せる）
  const pool = ices[0];
  if (pool) addLight(c, { pos: [(pool.min[0] + pool.max[0]) / 2, 3.0, (pool.min[2] + pool.max[2]) / 2], color: 0x4a90ff, intensity: 1.2, distance: 22 });
  // つらら（天井。クラスタ）
  const ir = c.rng.fork('icicles');
  const drops: InstanceSpec['transforms'] = [];
  const clusters = Math.min(14, Math.max(4, Math.round(rectArea(main) / 600)));
  for (let k = 0; k < clusters; k++) {
    const cx = ir.float(main.x0 + 4, main.x1 - 4);
    const cz = ir.float(main.z0 + 4, main.z1 - 4);
    const n = ir.int(12, 24);
    for (let i = 0; i < n; i++) {
      const s = ir.float(0.5, 1.4);
      drops.push({ pos: [cx + ir.float(-2.5, 2.5), h - 0.2 - 1.1 * s, cz + ir.float(-2.5, 2.5)], yaw: ir.float(0, Math.PI), scale: s });
    }
  }
  addInstances(c, ir.fork('inst'), 'ice', [0.14, 1.1, 0.14], drops);
  // 氷壁（雪面側の外壁に張り付く氷の板）
  const snowZone = themeZones(c, 'snowfield')[0];
  const wr = c.rng.fork('walls');
  const sheets: Box[] = [];
  for (const f of innerFaces(c.rects)) {
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.6)) {
      for (let at = a0 + wr.float(0.5, 3); at + 2 < a1 && sheets.length < 16; at += wr.float(5, 9)) {
        const sw = wr.float(2.0, 4.0);
        if (at + sw > a1 - 0.3) break;
        const mid = facePoint(f, at + sw / 2, 0, 0.5);
        if (snowZone && !(mid[0] > snowZone.x0 - 6 && mid[0] < snowZone.x1 + 6 && mid[2] > snowZone.z0 - 6 && mid[2] < snowZone.z1 + 6)) continue;
        const sh = wr.float(2.2, Math.min(6.0, h - 1));
        const th = wr.float(0.2, 0.45);
        const sheet = alongFace(f, at, sw, 0.03, 0.03 + th, 0, sh, 'ice', false);
        if (boxesNearFace(c, f, 0.6, 0, sh).some((b) => overlap3(b, sheet))) continue;
        sheets.push(sheet, alongFace(f, at + sw * 0.3, sw * 0.4, 0.03 + th, 0.03 + th + 0.12, 0, sh * 0.55, 'snow', false));
      }
    }
  }
  push(c, ...sheets);
  // 暖色の室内窓（主矩形の壁の上部。回廊の無い主矩形は 3.6 m 以上が空いている）
  const win: InstanceSpec['transforms'] = [];
  const winR = c.rng.fork('win');
  for (const f of innerFaces([main])) {
    for (const [a0, a1] of freeRuns(f, L.sockets, 1.0)) {
      for (let at = a0 + 1.2; at + 1.0 < a1 - 0.6; at += 2.4) {
        if (!winR.chance(0.7)) continue;
        for (const y of [4.6, 7.2]) {
          if (y + 1.2 > h - 0.4) continue;
          win.push({ pos: facePoint(f, at + 0.5, y, 0.03), yaw: faceYaw(f) });
        }
      }
    }
  }
  addInstances(c, winR.fork('inst'), 'windowLit', [1.0, 1.2, 0.04], win);
  addLight(c, { pos: [(main.x0 + main.x1) / 2, h - 2, (main.z0 + main.z1) / 2], color: 0xbfd8ff, intensity: 0.8, distance: 40 });
  L.palette = { ...L.palette, ambient: 0x9aa6b8 };
}

// ---------------------------------------------------------------- L20 永久万博会場（StreetGrid expo）
// 入口街路のゲート（旗「THE NEXT HORIZON」）、旗の列、広場（無ければ最も低いパビリオンの屋上）の多段ドーム、展示カラーの帯を原色に。

function dressL20(c: Ctx): void {
  const { L } = c;
  const main = c.rects[0];
  const h = c.h;
  const g = streetGridOf(main);
  const entry = L.sockets.find((s) => s.id === 'entry');
  const PLASTIC: MatId[] = ['plasticRed', 'plasticBlue', 'plasticYellow'];
  // 展示カラーの帯（パビリオンの帯とキャノピー）を原色に
  const ar = c.rng.fork('accent');
  const accentMats = new Set<MatId>(['trim', 'wallGreen', 'yellowLine', 'furnitureLight', 'ledBlue']);
  recolor(c, (b) => !b.solid && accentMats.has(b.mat) && ((Math.abs(b.min[1] - 2.6) < 0.02 && Math.abs(b.max[1] - 3.0) < 0.02) || (Math.abs(b.min[1] - 3.3) < 0.02 && Math.abs(b.max[1] - 3.5) < 0.02)) && ar.chance(0.8), PLASTIC[ar.int(0, 2)], c.shell);
  // 入口街路のゲート + 旗
  if (entry && entry.type !== 'hole') {
    let k = 0;
    for (let i = 0; i <= g.nx; i++) { const [a, b] = vStreet(g, i); if (entry.pos[0] >= a - 0.1 && entry.pos[0] <= b + 0.1) k = i; }
    const [sx0, sx1] = vStreet(g, k);
    const gzz = main.z0 + 8.0;
    const pyA = box([sx0 + 0.15, 0, gzz - 0.3], [sx0 + 0.75, 6.8, gzz + 0.3], 'wallWhite');
    const pyB = box([sx1 - 0.75, 0, gzz - 0.3], [sx1 - 0.15, 6.8, gzz + 0.3], 'wallWhite');
    if (canPlace(c, pyA, { pad: 0.25, ignoreLow: 0.15 }) && canPlace(c, pyB, { pad: 0.25, ignoreLow: 0.15 })) {
      push(c, pyA, pyB, box([sx0 + 0.15, 6.8, gzz - 0.35], [sx1 - 0.15, 7.5, gzz + 0.35], 'wallWhite', false), box([sx0 + 0.15, 7.5, gzz - 0.2], [sx1 - 0.15, 7.7, gzz + 0.2], 'plasticRed', false));
      const bw = Math.min(6.0, sx1 - sx0 - 1.8);
      addSign(c, { text: 'THE NEXT HORIZON', sub: 'EXPO ∞ · 永久万博会場', pos: [(sx0 + sx1) / 2, 6.0, gzz - 0.37], dir: 2, width: bw, kind: 'emissive', color: 0xffffff, background: 0x223046 });
      addSign(c, { text: 'THE NEXT HORIZON', sub: 'SEE YOU AGAIN · またいつか', pos: [(sx0 + sx1) / 2, 6.0, gzz + 0.37], dir: 0, width: bw, kind: 'emissive', color: 0xffffff, background: 0x223046 });
    }
    const fr = c.rng.fork('flags');
    let flags = 0;
    for (let z = main.z0 + 13; z < main.z1 - 4 && flags < 24; z += 6) {
      for (const x of [sx0 - 0.6, sx1 + 0.6]) {
        const pole = box([x - 0.05, 0.12, z - 0.05], [x + 0.05, 8.2, z + 0.05], 'metal');
        if (!canPlace(c, pole, { lanes: false, pad: 0.3, ignoreLow: 0.15 })) continue;
        if (overlapsAny(c, pole, (o) => o.max[1] - o.min[1] > 1.5 && Math.min(o.max[0] - o.min[0], o.max[2] - o.min[2]) < 0.3, 0.4)) continue;
        const dirX = x < (sx0 + sx1) / 2 ? -1 : 1;
        push(c, pole, box([Math.min(x + dirX * 0.05, x + dirX * 1.45), 7.0, z - 0.015], [Math.max(x + dirX * 0.05, x + dirX * 1.45), 7.9, z + 0.015], PLASTIC[fr.int(0, 2)], false));
        flags++;
      }
    }
  }
  // ドーム（広場の中央。無ければ最も低い屋上）
  let plaza: Rect | null = null;
  for (let j = 0; j < g.nz && !plaza; j++) for (let i = 0; i < g.nx && !plaza; i++) { const r = blockRect(g, i, j); if (!blockHasBuilding(c, r)) plaza = r; }
  const dome = (cx: number, cz: number, base: number, size: number, tierH: number, solidBase: boolean) => {
    const sizes = [1.0, 0.78, 0.55, 0.3];
    let y = base;
    sizes.forEach((s, i) => {
      const half = (size * s) / 2;
      const mat: MatId = i === 1 ? 'plasticBlue' : i === 3 ? 'stainless' : 'wallWhite';
      push(c, box([cx - half, y, cz - half], [cx + half, y + tierH, cz + half], mat, i === 0 && solidBase));
      y += tierH;
    });
    push(c, box([cx - 0.06, y, cz - 0.06], [cx + 0.06, y + 1.2, cz + 0.06], 'metal', false), box([cx - 0.15, y + 1.2, cz - 0.15], [cx + 0.15, y + 1.5, cz + 0.15], 'neonRed', false));
  };
  if (plaza) {
    const cx = (plaza.x0 + plaza.x1) / 2;
    const cz = (plaza.z0 + plaza.z1) / 2;
    const size = Math.min(10, Math.min(plaza.x1 - plaza.x0, plaza.z1 - plaza.z0) - 4);
    if (size >= 5) {
      const foot = box([cx - size / 2 - 0.4, 0, cz - size / 2 - 0.4], [cx + size / 2 + 0.4, 4, cz + size / 2 + 0.4], 'wallWhite');
      // 広場の中の低い物（ベンチ・街灯の柱）を取り除く（着地点は避ける）
      if (!hitsZone(c.zones, foot)) {
        const keep = L.boxes.slice(0, c.shell);
        for (const b of L.boxes.slice(c.shell)) if (!(overlapXZ(foot, b) && b.min[1] < 1.0 && b.max[1] - b.min[1] < 6.5 && b.mat !== 'floorConcrete')) keep.push(b);
        L.boxes = keep;
        dome(cx, cz, 0.12, size, 0.85, true);
        addSign(c, { text: 'DOME PAVILION', sub: 'THE NEXT HORIZON · 次の地平へ', pos: [cx, 1.4, cz - size / 2 - 0.02], dir: 2, width: Math.min(3.0, size - 1), kind: 'emissive', color: 0xffffff, background: 0x223046 });
      }
    }
  } else {
    // 屋上に十分な余裕（3 m 以上）がある最大のパビリオン
    let best: Box | null = null;
    for (let i = c.shell; i < L.boxes.length; i++) {
      const b = L.boxes[i];
      const [w, bh, d] = sizeOf(b);
      if (!b.solid || bh < 4 || w < 6 || d < 6 || b.max[1] > h - 3.2) continue;
      if (!best || w * d > (best.max[0] - best.min[0]) * (best.max[2] - best.min[2])) best = b;
    }
    if (best) {
      const [w, , d] = sizeOf(best);
      const cx = (best.min[0] + best.max[0]) / 2;
      const cz = (best.min[2] + best.max[2]) / 2;
      const room = h - 0.5 - best.max[1] - 1.5;
      dome(cx, cz, best.max[1], Math.min(14, Math.min(w, d) - 0.8), Math.max(0.5, Math.min(1.0, room / 4)), false);
    }
  }
  L.palette = { ...L.palette, lightColor: 0xf4f6ff, ambient: 0x5a5c66 };
}
