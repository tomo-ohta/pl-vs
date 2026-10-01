/** MegaStructureGenerator の共通コア（MegaHall / MegaAtrium が共有する寸法表・構造部品・ゾーン・予算）。
 *  - 寸法: variant = sizeIdx(5 段: 160 / 120 / 96 / 72 / 60 m) × entryOffset(4: 中央 / 左 1/4 / 右 1/4 / 角寄り)
 *  - 構造（上階スラブ・階段・手すり・橋・間仕切り・柱・EV 籠）は「シェル側」（L.shellCount より前）に入れる。
 *    Modifier（ScaleAnomaly perProp / InstanceOvergrowth / ZoneThemeShuffle …）は shellCount 以降だけを内装として扱うので、
 *    歩行に必要な構造が縮尺や撤去の対象にならない。家具・小道具は shellCount 以降（内装側）。
 *  - 階高は 3.6 m 固定（WorldManager.FLOOR / GridProjector.levelOfY と一致）。上階の出口ソケットは pos[1] = 3.6k。
 *  - 予算: 箱 MAX_BOXES（6000）を超えないよう、装飾（偽扉・小道具）は追加前に remaining() を見る。 */
import type { AABB } from '../core/aabb';
import type { Dir, Socket, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { along, across, buildShell, edgesOf, inner, pickSpanPosition, rect, rectArea, socketOnSpan, unionBounds, wallIntervals, wallSpans, type Rect } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, makeEntry, placeHole } from './common';
import { box, DOOR_H, DOOR_W, emptyLayout, snap, WALL_T, type Box, type GenParams, type MatId, type RoomLayout, type Zone } from './layout';

export const FLOOR = 3.6;
/** 1 部屋の箱の上限（三角形予算の目安。RoomBuilder のチャンク分割で床・壁はさらに分割される） */
export const MAX_BOXES = 6000;
/** 回廊（上階の外周スラブ）の幅 */
export const GALLERY_W = 4.5;
/** 階段の幅（壁沿いの帯） */
export const STAIR_W = 1.5;
export const STEP_RISE = 0.18;
export const STEP_RUN = 0.3;
export const STAIR_STEPS = 20;
/** 階段の水平長（20 段 × 0.3） */
export const STAIR_RUN = STAIR_STEPS * STEP_RUN;
export const RAIL_H = 1.05;
export const RAIL_T = 0.1;

/** バリアント数 = サイズ 5 段 × 入口位置 4 */
export const SIZE_STEPS = 5;
export const ENTRY_OFFSETS = 4;
export const VARIANT_COUNT = SIZE_STEPS * ENTRY_OFFSETS;

/** サイズ段（variant 0 = 最大）。長辺の基準値 */
export const SIZE_SCALE = [160, 120, 96, 72, 60];

export function sizeIdxOf(variant: number): number {
  return Math.floor(variant / ENTRY_OFFSETS) % SIZE_STEPS;
}
export function entryOffsetIdxOf(variant: number): number {
  return variant % ENTRY_OFFSETS;
}

/** 長辺 long・短辺比 ratio から矩形寸法を作る（0.5 m スナップ、jitter は vr） */
export function dims(variant: number, vr: Rng, ratio: number, longBase = SIZE_SCALE[sizeIdxOf(variant)], jitter = 0.1): { w: number; d: number } {
  const long = longBase * vr.float(1 - jitter, 1 + jitter);
  const short = long * ratio * vr.float(1 - jitter, 1 + jitter);
  return { w: snap(Math.max(24, long)), d: snap(Math.max(20, short)) };
}

/** 入口位置バリアント: 主矩形を x 方向にずらす量（入口は常に x = 0、南辺） */
export function entryShift(variant: number, w: number): number {
  const k = [0, -0.25, 0.25, 0.4][entryOffsetIdxOf(variant)];
  return snap(k * (w / 2 - 3));
}

// ---------------------------------------------------------------- 矩形ユーティリティ

const EPS = 0.02;

/** 矩形の集合から cut を引く（重ならない矩形へ 4 分割） */
export function subtractRect(pieces: Rect[], cut: Rect): Rect[] {
  const out: Rect[] = [];
  for (const p of pieces) {
    if (!(p.x0 < cut.x1 - EPS && p.x1 > cut.x0 + EPS && p.z0 < cut.z1 - EPS && p.z1 > cut.z0 + EPS)) {
      out.push(p);
      continue;
    }
    const push = (x0: number, z0: number, x1: number, z1: number) => {
      if (x1 - x0 > EPS && z1 - z0 > EPS) out.push({ x0, z0, x1, z1 });
    };
    if (cut.z0 > p.z0) push(p.x0, p.z0, p.x1, Math.min(p.z1, cut.z0));
    if (cut.z1 < p.z1) push(p.x0, Math.max(p.z0, cut.z1), p.x1, p.z1);
    const zz0 = Math.max(p.z0, cut.z0);
    const zz1 = Math.min(p.z1, cut.z1);
    if (cut.x0 > p.x0) push(p.x0, zz0, Math.min(p.x1, cut.x0), zz1);
    if (cut.x1 < p.x1) push(Math.max(p.x0, cut.x1), zz0, p.x1, zz1);
  }
  return out;
}

export function rectsOverlapPad(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad - EPS && a.x1 > b.x0 - pad + EPS && a.z0 < b.z1 + pad - EPS && a.z1 > b.z0 - pad + EPS;
}

export function rectOfBox(b: Box | AABB): Rect {
  return rect(b.min[0], b.min[2], b.max[0], b.max[2]);
}

/** 1 次元区間 [a0,a1] から cuts を引く */
export function subtract1D(a0: number, a1: number, cuts: [number, number][]): [number, number][] {
  const sorted = cuts.filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [p, q] of sorted) {
    if (p > cur + EPS) out.push([cur, Math.min(p, a1)]);
    cur = Math.max(cur, q);
    if (cur >= a1) break;
  }
  if (a1 > cur + EPS) out.push([cur, a1]);
  return out;
}

// ---------------------------------------------------------------- 生成コンテキスト

/** 立入禁止（家具を置かない）領域: 階段・EV 籠・橋の着地・間仕切り・主動線 */
export interface Reserved {
  rect: Rect;
  /** 高さ範囲（既定: 全高） */
  y0?: number;
  y1?: number;
}

export interface MegaCtx {
  p: GenParams;
  L: RoomLayout;
  /** バリアント固有の乱数（rng.fork('v<variant>')） */
  vr: Rng;
  rects: Rect[];
  main: Rect;
  h: number;
  /** 階数（1 = 単層） */
  levels: number;
  /** 生成器が置いたソケット（entry / exit* / up* / elev* / hole）。extraSockets は mergeExtraSockets で合流する */
  sockets: Socket[];
  /** 後から追加された直結ソケット（p.extraSockets）。出口の抽選に影響させない（安定性: 追加されても既存の出口が動かない） */
  extras: Socket[];
  /** mergeExtraSockets 済みか */
  merged?: boolean;
  /** 構造（シェル側）の箱。finalizeStructure で L.boxes へ移し shellCount を更新する */
  structure: Box[];
  reserved: Reserved[];
  /** 階段の踏面矩形（上階スラブから切り抜く）。level = 到達する階 */
  stairHoles: { level: number; rect: Rect }[];
  /** 各階のスラブ矩形（ゾーン計算・地図用） */
  slabs: Map<number, Rect[]>;
}

export function reserve(c: MegaCtx, r: Rect, y0?: number, y1?: number): void {
  c.reserved.push({ rect: r, y0, y1 });
}

/** 矩形 r（y 範囲 y0..y1）が予約領域・ソケット前と重なるか */
export function blocked(c: MegaCtx, r: Rect, y0 = 0, y1 = 2.2, pad = 0.3): boolean {
  for (const res of c.reserved) {
    const ry0 = res.y0 ?? -Infinity;
    const ry1 = res.y1 ?? Infinity;
    if (y0 >= ry1 || y1 <= ry0) continue;
    if (rectsOverlapPad(res.rect, r, pad)) return true;
  }
  for (const s of c.sockets) {
    if (s.type === 'hole') {
      if (rectsOverlapPad(rect(s.pos[0] - 1.3, s.pos[2] - 1.3, s.pos[0] + 1.3, s.pos[2] + 1.3), r, pad)) return true;
      continue;
    }
    if (y0 > s.pos[1] + 2.3 || y1 < s.pos[1] - 0.1) continue;
    const dz = doorZone(s, 2.2);
    if (rectsOverlapPad(dz, r, pad)) return true;
  }
  return false;
}

/** 扉の内側 depth m × 幅 (width + 1.2) の矩形 */
export function doorZone(s: Socket, depth: number): Rect {
  const half = s.width / 2 + 0.6;
  const inward = inwardOf(s.dir);
  const cx = s.pos[0] + inward[0] * depth / 2;
  const cz = s.pos[2] + inward[1] * depth / 2;
  const hx = s.dir === 0 || s.dir === 2 ? half : depth / 2;
  const hz = s.dir === 0 || s.dir === 2 ? depth / 2 : half;
  return rect(cx - hx, cz - hz, cx + hx, cz + hz);
}

export function inwardOf(d: Dir): [number, number] {
  return d === 0 ? [0, -1] : d === 1 ? [-1, 0] : d === 2 ? [0, 1] : [1, 0];
}

/** ソケットの正面（室内側 depth m × 幅 + 両側 side m）の矩形 */
export function socketApproach(s: Socket, depth: number, side: number): Rect {
  const [ix, iz] = inwardOf(s.dir);
  const half = s.width / 2 + side;
  const x0 = ix === 0 ? s.pos[0] - half : Math.min(s.pos[0], s.pos[0] + ix * depth);
  const x1 = ix === 0 ? s.pos[0] + half : Math.max(s.pos[0], s.pos[0] + ix * depth);
  const z0 = iz === 0 ? s.pos[2] - half : Math.min(s.pos[2], s.pos[2] + iz * depth);
  const z1 = iz === 0 ? s.pos[2] + half : Math.max(s.pos[2], s.pos[2] + iz * depth);
  return rect(x0, z0, x1, z1);
}

/** 残りの箱予算 */
export function remaining(c: MegaCtx): number {
  return MAX_BOXES - c.L.boxes.length - c.structure.length;
}

// ---------------------------------------------------------------- 回廊 / 吹抜 / 橋 / 階段（MegaAtrium。MegaHall も歩ける橋で使う）

/** 矩形 r の各辺が外壁（他の矩形と接していない）か */
export function exteriorEdges(r: Rect, rects: Rect[]): boolean[] {
  return edgesOf(r).map((e) => wallIntervals(e, rects).length > 0);
}

/** 辺が「中庭側」（足跡全体の外周に無い外壁）か。環状 footprint の内側の壁を判定する */
export function courtyardEdges(r: Rect, rects: Rect[]): boolean[] {
  const ub = unionBounds(rects);
  const ext = exteriorEdges(r, rects);
  return edgesOf(r).map((e, i) => {
    if (!ext[i]) return false;
    const onOuter = e.dir === 0 ? Math.abs(e.coord - ub.z1) < EPS : e.dir === 1 ? Math.abs(e.coord - ub.x1) < EPS : e.dir === 2 ? Math.abs(e.coord - ub.z0) < EPS : Math.abs(e.coord - ub.x0) < EPS;
    return !onOuter;
  });
}

/** 回廊の帯（矩形 r の指定した辺に沿った幅 gw の帯）と吹抜（残り）。dirs は帯を作る辺（Dir の集合） */
export type GalleryW = number | [number, number, number, number];

function gwOf(gw: GalleryW, dir: Dir): number {
  return typeof gw === 'number' ? gw : gw[dir];
}

export function galleryOf(r: Rect, dirs: boolean[], gw: GalleryW): { bands: Rect[]; voidRect: Rect | null } {
  const v = {
    x0: r.x0 + (dirs[3] ? gwOf(gw, 3) : 0),
    x1: r.x1 - (dirs[1] ? gwOf(gw, 1) : 0),
    z0: r.z0 + (dirs[2] ? gwOf(gw, 2) : 0),
    z1: r.z1 - (dirs[0] ? gwOf(gw, 0) : 0),
  };
  const bands: Rect[] = [];
  if (v.x1 - v.x0 < 3 || v.z1 - v.z0 < 3) return { bands: [{ ...r }], voidRect: null };
  if (dirs[2]) bands.push(rect(r.x0, r.z0, r.x1, v.z0));
  if (dirs[0]) bands.push(rect(r.x0, v.z1, r.x1, r.z1));
  if (dirs[3]) bands.push(rect(r.x0, v.z0, v.x0, v.z1));
  if (dirs[1]) bands.push(rect(v.x1, v.z0, r.x1, v.z1));
  return { bands, voidRect: v };
}

export interface Bridge {
  level: number;
  rect: Rect;
  /** 橋の長手方向 */
  axis: 'x' | 'z';
}

/** スラブ（上階の床）。厚 0.2、上面 y */
export function slab(out: Box[], r: Rect, y: number, mat: MatId): void {
  out.push(box([r.x0, y - 0.2, r.z0], [r.x1, y, r.z1], mat));
}

/** 手すり（線分 a→b、y は床面） */
export function rail(out: Box[], x0: number, z0: number, x1: number, z1: number, y: number, mat: MatId = 'metal', h = RAIL_H): void {
  if (Math.abs(x1 - x0) < 0.05 && Math.abs(z1 - z0) < 0.05) return;
  const t = RAIL_T / 2;
  out.push(box([Math.min(x0, x1) - t, y, Math.min(z0, z1) - t], [Math.max(x0, x1) + t, y + h, Math.max(z0, z1) + t], mat));
  // 上桟（薄い帯。非ソリッド）
  out.push(box([Math.min(x0, x1) - t - 0.02, y + h - 0.06, Math.min(z0, z1) - t - 0.02], [Math.max(x0, x1) + t + 0.02, y + h, Math.max(z0, z1) + t + 0.02], 'furnitureDark', false));
}

/** 直階段。base = 下階の床 y、from → to（辺に沿った方向に上る）、strip は帯の法線方向の範囲。
 *  axis 'x': x が from→to に進むにつれ上る（z 範囲 strip）。踏面ごとに床から立ち上がる箱（下は塞ぐ） */
export function stairs(out: Box[], axis: 'x' | 'z', from: number, to: number, strip: [number, number], base: number, rise: number, mat: MatId): Rect {
  const steps = Math.max(1, Math.round(rise / STEP_RISE));
  const dir = to > from ? 1 : -1;
  const run = Math.abs(to - from) / steps;
  const stepH = rise / steps;
  for (let i = 0; i < steps; i++) {
    const a0 = from + dir * i * run;
    const a1 = a0 + dir * run;
    const top = base + (i + 1) * stepH;
    if (axis === 'x') out.push(box([Math.min(a0, a1), base - 0.2, strip[0]], [Math.max(a0, a1), top, strip[1]], mat));
    else out.push(box([strip[0], base - 0.2, Math.min(a0, a1)], [strip[1], top, Math.max(a0, a1)], mat));
  }
  return axis === 'x' ? rect(Math.min(from, to), strip[0], Math.max(from, to), strip[1]) : rect(strip[0], Math.min(from, to), strip[1], Math.max(from, to));
}

/** 階段の側面の段状パラペット（吹抜側の転落防止。非ソリッド薄板） */
export function stairParapet(out: Box[], axis: 'x' | 'z', from: number, to: number, side: number, base: number, rise: number): void {
  const steps = Math.max(1, Math.round(rise / STEP_RISE));
  const dir = to > from ? 1 : -1;
  const run = Math.abs(to - from) / steps;
  const stepH = rise / steps;
  const t = 0.04;
  for (let i = 0; i < steps; i++) {
    const a0 = from + dir * i * run;
    const a1 = a0 + dir * run;
    const top = base + (i + 1) * stepH;
    if (axis === 'x') out.push(box([Math.min(a0, a1), top, side - t], [Math.max(a0, a1), top + 0.95, side + t], 'metal', false));
    else out.push(box([side - t, top, Math.min(a0, a1)], [side + t, top + 0.95, Math.max(a0, a1)], 'metal', false));
  }
}

/** 階段の配置候補: 矩形 r の辺 dir に沿った帯（壁側 0.15 + STAIR_W）。avoid は辺に沿った座標の禁止区間 */
export function placeStairAlongEdge(c: MegaCtx, r: Rect, dir: Dir, levelFrom: number, avoid: [number, number][], prefer: number, mat: MatId): boolean {
  const e = edgesOf(r)[dir];
  const a0 = e.a0 + WALL_T + 0.6;
  const a1 = e.a1 - WALL_T - 0.6;
  const need = STAIR_RUN + 1.2;
  if (a1 - a0 < need) return false;
  const free = subtract1D(a0, a1, avoid).filter(([p, q]) => q - p >= need);
  if (free.length === 0) return false;
  // prefer（0..1）に最も近い区間を選ぶ
  const target = a0 + (a1 - a0) * prefer;
  let best = free[0];
  let bd = Infinity;
  for (const seg of free) {
    const s0 = Math.max(seg[0], Math.min(seg[1] - need, target - need / 2));
    const d = Math.abs(s0 + need / 2 - target);
    if (d < bd) { bd = d; best = seg; }
  }
  let start = Math.max(best[0], Math.min(best[1] - need, target - need / 2));
  start = snap(start);
  if (start < best[0]) start += 0.5;
  const up = prefer < 0.5 ? 1 : -1; // 端から中央へ向かって上る
  const from = up > 0 ? start + 0.6 : start + need - 0.6;
  const to = from + up * STAIR_RUN;
  const wallIn = dir === 0 ? r.z1 - WALL_T : dir === 2 ? r.z0 + WALL_T : dir === 1 ? r.x1 - WALL_T : r.x0 + WALL_T;
  const strip: [number, number] = dir === 0 ? [wallIn - STAIR_W, wallIn] : dir === 2 ? [wallIn, wallIn + STAIR_W] : dir === 1 ? [wallIn - STAIR_W, wallIn] : [wallIn, wallIn + STAIR_W];
  const axis: 'x' | 'z' = dir === 0 || dir === 2 ? 'x' : 'z';
  const base = levelFrom * FLOOR;
  stairs(c.structure, axis, from, to, strip, base, FLOOR, mat);
  // 吹抜側のパラペット
  const side = dir === 0 ? strip[0] : dir === 2 ? strip[1] : dir === 1 ? strip[0] : strip[1];
  stairParapet(c.structure, axis, from, to, side, base, FLOOR);
  // 下端側の踏み出し（0.6 m）を含む予約 + 上階スラブの切り欠き
  const hole = axis === 'x' ? rect(Math.min(from, to) - 0.3, strip[0], Math.max(from, to) + 0.3, strip[1]) : rect(strip[0], Math.min(from, to) - 0.3, strip[1], Math.max(from, to) + 0.3);
  c.stairHoles.push({ level: levelFrom + 1, rect: hole });
  reserve(c, axis === 'x' ? rect(hole.x0 - 0.9, hole.z0 - 0.3, hole.x1 + 0.9, hole.z1 + 0.6) : rect(hole.x0 - 0.3, hole.z0 - 0.9, hole.x1 + 0.6, hole.z1 + 0.9), base - 0.1, base + FLOOR + 2.2);
  // 上階の切り欠きの縁の手すり（吹抜側の長辺 + 下端側の短辺）
  const yTop = base + FLOOR;
  if (axis === 'x') {
    rail(c.structure, hole.x0, side, hole.x1, side, yTop);
    const endA = up > 0 ? hole.x0 : hole.x1;
    rail(c.structure, endA, strip[0], endA, strip[1], yTop);
  } else {
    rail(c.structure, side, hole.z0, side, hole.z1, yTop);
    const endA = up > 0 ? hole.z0 : hole.z1;
    rail(c.structure, strip[0], endA, strip[1], endA, yTop);
  }
  avoid.push([Math.min(from, to) - 1.2, Math.max(from, to) + 1.2]);
  return true;
}

/** ソケットが辺 (r, dir) の壁に載っているときの、辺に沿った禁止区間 */
export function socketIntervalsOnEdge(sockets: Socket[], r: Rect, dir: Dir, levelY: number[], pad = 1.6): [number, number][] {
  const e = edgesOf(r)[dir];
  const out: [number, number][] = [];
  for (const s of sockets) {
    if (s.type === 'hole' || s.dir !== dir) continue;
    if (Math.abs(across(dir, s.pos[0], s.pos[2]) - e.coord) > 0.05) continue;
    if (!levelY.some((y) => Math.abs(s.pos[1] - y) < 0.1)) continue;
    const a = along(dir, s.pos[0], s.pos[2]);
    out.push([a - s.width / 2 - pad, a + s.width / 2 + pad]);
  }
  return out;
}

/** 上階スラブ・手すり・橋を構造へ出す。gallery(r) は矩形ごとの帯の辺（null なら回廊なし） */
export function buildGalleries(c: MegaCtx, opts: { gallery: (r: Rect, level: number) => boolean[] | null; gw?: GalleryW; bridgesPerLevel: (level: number) => number; floorMat: MatId; railMat?: MatId; bridgeMat?: MatId }): Bridge[] {
  const gw = opts.gw ?? GALLERY_W;
  const bridges: Bridge[] = [];
  for (let k = 1; k < c.levels; k++) {
    const y = k * FLOOR;
    let slabs: Rect[] = [];
    const voids: { r: Rect; v: Rect; dirs: boolean[] }[] = [];
    for (const r of c.rects) {
      const dirs = opts.gallery(r, k);
      if (!dirs) continue;
      const g = galleryOf(r, dirs, gw);
      slabs.push(...g.bands);
      if (g.voidRect) voids.push({ r, v: g.voidRect, dirs });
    }
    // 橋（吹抜を短手方向に横断）
    const nb = opts.bridgesPerLevel(k);
    const bridgeRects: { rect: Rect; axis: 'x' | 'z'; v: Rect }[] = [];
    for (const { v, dirs } of voids) {
      const vw = v.x1 - v.x0;
      const vd = v.z1 - v.z0;
      // 横断できる方向（両端に帯がある）
      const canZ = dirs[0] && dirs[2] && vd >= 4;
      const canX = dirs[1] && dirs[3] && vw >= 4;
      if (!canZ && !canX) continue;
      const axis: 'x' | 'z' = canZ && (!canX || vw >= vd) ? 'z' : 'x';
      for (let i = 0; i < nb; i++) {
        const f = nb === 1 ? (k % 2 === 0 ? 0.38 : 0.62) : (i + 1) / (nb + 1) + (k % 2 === 0 ? 0.06 : -0.06);
        const half = 1.5;
        let br: Rect;
        if (axis === 'z') {
          const x = snap(v.x0 + vw * f);
          br = rect(x - half, v.z0 - 0.02, x + half, v.z1 + 0.02);
        } else {
          const z = snap(v.z0 + vd * f);
          br = rect(v.x0 - 0.02, z - half, v.x1 + 0.02, z + half);
        }
        // 階段の切り欠き・着地点（天井穴）と重なる橋は置かない
        if (c.stairHoles.some((sh) => sh.level === k && rectsOverlapPad(sh.rect, br, 1.0))) continue;
        if (blocked(c, br, y - 0.2, y + 2.2, 0.5)) continue;
        bridgeRects.push({ rect: br, axis, v });
        bridges.push({ level: k, rect: br, axis });
      }
    }
    // 階段の切り欠き
    for (const sh of c.stairHoles) if (sh.level === k) slabs = subtractRect(slabs, sh.rect);
    for (const s of slabs) slab(c.structure, s, y, opts.floorMat);
    for (const b of bridgeRects) slab(c.structure, b.rect, y, opts.bridgeMat ?? opts.floorMat);
    c.slabs.set(k, [...slabs, ...bridgeRects.map((b) => b.rect)]);
    // 手すり: 吹抜の縁（橋の取り付き部は切る）+ 橋の両側
    const railMat = opts.railMat ?? 'metal';
    for (const { v, dirs } of voids) {
      const cutsX: [number, number][] = bridgeRects.filter((b) => b.axis === 'z' && b.v === v).map((b) => [b.rect.x0, b.rect.x1]);
      const cutsZ: [number, number][] = bridgeRects.filter((b) => b.axis === 'x' && b.v === v).map((b) => [b.rect.z0, b.rect.z1]);
      // 階段の切り欠きが縁に接している区間も切る（切り欠きの縁の手すりは階段側で出す）
      for (const sh of c.stairHoles) {
        if (sh.level !== k) continue;
        cutsX.push([sh.rect.x0, sh.rect.x1]);
        cutsZ.push([sh.rect.z0, sh.rect.z1]);
      }
      if (dirs[2]) for (const [a, b] of subtract1D(v.x0, v.x1, cutsX)) rail(c.structure, a, v.z0, b, v.z0, y, railMat);
      if (dirs[0]) for (const [a, b] of subtract1D(v.x0, v.x1, cutsX)) rail(c.structure, a, v.z1, b, v.z1, y, railMat);
      if (dirs[3]) for (const [a, b] of subtract1D(v.z0, v.z1, cutsZ)) rail(c.structure, v.x0, a, v.x0, b, y, railMat);
      if (dirs[1]) for (const [a, b] of subtract1D(v.z0, v.z1, cutsZ)) rail(c.structure, v.x1, a, v.x1, b, y, railMat);
    }
    for (const b of bridgeRects) {
      if (b.axis === 'z') {
        rail(c.structure, b.rect.x0, b.rect.z0, b.rect.x0, b.rect.z1, y, railMat);
        rail(c.structure, b.rect.x1, b.rect.z0, b.rect.x1, b.rect.z1, y, railMat);
      } else {
        rail(c.structure, b.rect.x0, b.rect.z0, b.rect.x1, b.rect.z0, y, railMat);
        rail(c.structure, b.rect.x0, b.rect.z1, b.rect.x1, b.rect.z1, y, railMat);
      }
    }
  }
  return bridges;
}

/** 全階を階段で結ぶ。各階間に最低 1 本（主矩形）+ 他の矩形にも 1 本ずつ（回廊がある矩形）。
 *  出口ソケット・入口の前は避ける。戻り値は置けた本数 */
export function buildStairs(c: MegaCtx, gallery: (r: Rect, level: number) => boolean[] | null, mat: MatId, rng: Rng, perLevel = 2, dirFilter?: (r: Rect, dir: Dir) => boolean): number {
  let placed = 0;
  for (let k = 0; k < c.levels - 1; k++) {
    const candidates = c.rects.filter((r) => gallery(r, k + 1) !== null);
    let n = 0;
    const order = rng.shuffle([...candidates]);
    // perLevel 本を矩形を巡回しながら置く（矩形が 1 つでも 2 本置く）
    for (let i = 0; i < Math.max(perLevel, order.length) && order.length > 0; i++) {
      if (n >= perLevel) break;
      const r = order[i % order.length];
      const dirs = gallery(r, k + 1)!;
      const dirOrder = rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => dirs[d] && (!dirFilter || dirFilter(r, d))));
      for (const d of dirOrder) {
        const avoid = socketIntervalsOnEdge(c.sockets, r, d, [k * FLOOR, (k + 1) * FLOOR]);
        // 既存の階段（同じ辺）
        for (const sh of c.stairHoles) {
          if (nearWall(sh.rect, r, d, 0.3)) avoid.push(d === 0 || d === 2 ? [sh.rect.x0 - 1.2, sh.rect.x1 + 1.2] : [sh.rect.z0 - 1.2, sh.rect.z1 + 1.2]);
        }
        const prefer = rng.pick([0.15, 0.3, 0.7, 0.85]);
        if (placeStairAlongEdge(c, r, d, k, avoid, prefer, mat)) {
          n++;
          placed++;
          break;
        }
      }
    }
    // 置けなかったら（狭い）回廊のある矩形の辺を総当たり
    if (n === 0) {
      outer: for (const r of candidates) {
        const dirs = gallery(r, k + 1)!;
        for (const d of [2, 0, 3, 1] as Dir[]) {
          if (!dirs[d]) continue;
          const avoid = socketIntervalsOnEdge(c.sockets, r, d, [k * FLOOR, (k + 1) * FLOOR]);
          for (const sh of c.stairHoles) if (nearWall(sh.rect, r, d, 0.3)) avoid.push(d === 0 || d === 2 ? [sh.rect.x0 - 1.2, sh.rect.x1 + 1.2] : [sh.rect.z0 - 1.2, sh.rect.z1 + 1.2]);
          if (placeStairAlongEdge(c, r, d, k, avoid, 0.5, mat)) { placed++; break outer; }
        }
      }
    }
  }
  return placed;
}

/** 矩形 hole が r の辺 dir の壁から tol 以内（壁沿いの帯）にあるか */
export function nearWall(hole: Rect, r: Rect, dir: Dir, tol: number): boolean {
  return dir === 0 ? hole.z1 > r.z1 - WALL_T - STAIR_W - tol : dir === 2 ? hole.z0 < r.z0 + WALL_T + STAIR_W + tol : dir === 1 ? hole.x1 > r.x1 - WALL_T - STAIR_W - tol : hole.x0 < r.x0 + WALL_T + STAIR_W + tol;
}

// ---------------------------------------------------------------- 柱・間仕切り・偽扉・EV 籠

/** 柱グリッド（構造側）。予約領域・ソケット前は避ける */
export function columnGrid(c: MegaCtx, r: Rect, spacing: number, size: number, mat: MatId, hTop = c.h, margin = 1.5): number {
  const ir = inner(r, margin);
  let n = 0;
  const nx = Math.max(1, Math.round((ir.x1 - ir.x0) / spacing));
  const nz = Math.max(1, Math.round((ir.z1 - ir.z0) / spacing));
  // 扉の正面（内側 6 m × 扉幅 + 両側 1.2 m）には柱を立てない（L02 で桟橋の軸上に柱が立ち、扉を出て 3 m で衝突した）
  const approaches = [...c.sockets, ...c.extras].filter((s) => s.type !== 'hole').map((s) => socketApproach(s, 6, 1.2));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      const x = snap(ir.x0 + ((ir.x1 - ir.x0) * i) / nx);
      const z = snap(ir.z0 + ((ir.z1 - ir.z0) * j) / nz);
      const cr = rect(x - size / 2, z - size / 2, x + size / 2, z + size / 2);
      if (blocked(c, cr, 0, hTop, 0.5)) continue;
      if (approaches.some((a) => rectsOverlapPad(a, cr, 0))) continue;
      if (remaining(c) < 50) return n;
      c.structure.push(box([cr.x0, 0, cr.z0], [cr.x1, hTop, cr.z1], mat));
      n++;
    }
  }
  return n;
}

/** 間仕切り壁（構造側。高さ h、開口 openings は辺に沿った区間）。axis 'x': x 方向に伸びる壁を z = at に */
export function partition(c: MegaCtx, axis: 'x' | 'z', at: number, a0: number, a1: number, h: number, mat: MatId, openings: [number, number][], y0 = 0): void {
  const t = 0.08;
  for (const [p, q] of subtract1D(a0, a1, openings)) {
    if (q - p < 0.2) continue;
    if (axis === 'x') {
      const r = rect(p, at - t, q, at + t);
      if (blocked(c, r, y0, y0 + h, 0.2)) continue;
      c.structure.push(box([p, y0, at - t], [q, y0 + h, at + t], mat));
    } else {
      const r = rect(at - t, p, at + t, q);
      if (blocked(c, r, y0, y0 + h, 0.2)) continue;
      c.structure.push(box([at - t, y0, p], [at + t, y0 + h, q], mat));
    }
  }
}

/** 壁面の偽扉（開かない装飾。非ソリッドの薄い板 + 枕木）。辺 dir の壁の内面に pitch 間隔。ソケット・階段付近は飛ばす */
export function fakeDoors(c: MegaCtx, r: Rect, dir: Dir, y: number, pitch: number, mat: MatId, rng: Rng, opts?: { numberFrom?: number; signEvery?: number; prefix?: string; width?: number; height?: number }): number {
  const e = edgesOf(r)[dir];
  const ints = wallIntervals(e, c.rects);
  const w = opts?.width ?? 0.95;
  const dh = opts?.height ?? 2.05;
  const avoid = socketIntervalsOnEdge(c.sockets, r, dir, [y], 1.4);
  for (const sh of c.stairHoles) {
    if (Math.abs(sh.level * FLOOR - y) > 0.1 && Math.abs((sh.level - 1) * FLOOR - y) > 0.1) continue;
    if (nearWall(sh.rect, r, dir, 0.6)) avoid.push(dir === 0 || dir === 2 ? [sh.rect.x0 - 0.6, sh.rect.x1 + 0.6] : [sh.rect.z0 - 0.6, sh.rect.z1 + 0.6]);
  }
  let n = 0;
  let num = opts?.numberFrom ?? 101;
  const signEvery = opts?.signEvery ?? 0;
  const face = dir === 0 ? r.z1 - WALL_T : dir === 2 ? r.z0 + WALL_T : dir === 1 ? r.x1 - WALL_T : r.x0 + WALL_T;
  const inward = inwardOf(dir);
  const phase = rng.float(0, pitch);
  for (const [i0, i1] of ints) {
    for (let a = i0 + 1.2 + phase; a + w / 2 < i1 - 1.0; a += pitch) {
      if (avoid.some(([p, q]) => a > p && a < q)) { num++; continue; }
      if (remaining(c) < 40) return n;
      const d0 = 0.005;
      const d1 = 0.05;
      const fx0 = dir === 0 || dir === 2 ? a - w / 2 : face + Math.min(inward[0] * d0, inward[0] * d1);
      const fx1 = dir === 0 || dir === 2 ? a + w / 2 : face + Math.max(inward[0] * d0, inward[0] * d1);
      const fz0 = dir === 0 || dir === 2 ? face + Math.min(inward[1] * d0, inward[1] * d1) : a - w / 2;
      const fz1 = dir === 0 || dir === 2 ? face + Math.max(inward[1] * d0, inward[1] * d1) : a + w / 2;
      c.L.boxes.push(box([fx0, y, fz0], [fx1, y + dh, fz1], mat, false));
      // 枕木（扉枠の上）
      const t0 = dir === 0 || dir === 2 ? a - w / 2 - 0.08 : fx0;
      const t1 = dir === 0 || dir === 2 ? a + w / 2 + 0.08 : fx1 + (inward[0] > 0 ? 0.03 : -0.03);
      const u0 = dir === 0 || dir === 2 ? fz0 : a - w / 2 - 0.08;
      const u1 = dir === 0 || dir === 2 ? fz1 + (inward[1] > 0 ? 0.03 : -0.03) : a + w / 2 + 0.08;
      c.L.boxes.push(box([Math.min(t0, t1), y + dh, Math.min(u0, u1)], [Math.max(t0, t1), y + dh + 0.12, Math.max(u0, u1)], 'trim', false));
      if (signEvery > 0 && n % signEvery === 0) {
        (c.L.signs ??= []).push({
          text: `${opts?.prefix ?? ''}${num}`,
          pos: dir === 0 || dir === 2 ? [a + w / 2 + 0.35, y + 1.6, face + inward[1] * 0.02] : [face + inward[0] * 0.02, y + 1.6, a + w / 2 + 0.35],
          dir: ((dir + 2) % 4) as Dir,
          width: 0.4,
          kind: 'plate',
        });
      }
      n++;
      num++;
    }
  }
  return n;
}

/** エレベーター籠（VerticalGenerator と同じ構成。壁の外側に突き出し、bounds を広げる）。ソケットは外壁上に置いてあること */
export function elevatorCage(c: MegaCtx, s: Socket): void {
  const depth = 1.8;
  const half = 0.9;
  const inward = inwardOf(s.dir);
  const ox = -inward[0];
  const oz = -inward[1];
  const y = s.pos[1];
  // 籠の内側範囲
  const ix0 = s.dir === 1 ? s.pos[0] : s.dir === 3 ? s.pos[0] - depth : s.pos[0] - half;
  const ix1 = s.dir === 1 ? s.pos[0] + depth : s.dir === 3 ? s.pos[0] : s.pos[0] + half;
  const iz0 = s.dir === 0 ? s.pos[2] : s.dir === 2 ? s.pos[2] - depth : s.pos[2] - half;
  const iz1 = s.dir === 0 ? s.pos[2] + depth : s.dir === 2 ? s.pos[2] : s.pos[2] + half;
  const t = WALL_T;
  const S = c.structure;
  S.push(box([ix0 - t, y - 0.2, iz0 - t], [ix1 + t, y, iz1 + t], 'metal'));
  S.push(box([ix0 - t, y + 2.3, iz0 - t], [ix1 + t, y + 2.5, iz1 + t], 'metal'));
  // 側壁（開口側 = 部屋側の壁は無い）
  if (s.dir !== 3) S.push(box([ix1, y, iz0 - t], [ix1 + t, y + 2.3, iz1 + t], 'metal'));
  if (s.dir !== 1) S.push(box([ix0 - t, y, iz0 - t], [ix0, y + 2.3, iz1 + t], 'metal'));
  if (s.dir !== 2) S.push(box([ix0, y, iz1], [ix1, y + 2.3, iz1 + t], 'metal'));
  if (s.dir !== 0) S.push(box([ix0, y, iz0 - t], [ix1, y + 2.3, iz0], 'metal'));
  // ボタン（奥の壁、内側を向く）と天井灯
  const bx = s.dir === 1 ? ix1 - 0.02 : s.dir === 3 ? ix0 + 0.02 : s.pos[0] + 0.4;
  const bz = s.dir === 0 ? iz1 - 0.02 : s.dir === 2 ? iz0 + 0.02 : s.pos[2] + 0.4;
  const bx0 = s.dir === 1 || s.dir === 3 ? bx - 0.01 : bx - 0.1;
  const bx1 = s.dir === 1 || s.dir === 3 ? bx + 0.01 : bx + 0.1;
  const bz0 = s.dir === 0 || s.dir === 2 ? bz - 0.01 : bz - 0.1;
  const bz1 = s.dir === 0 || s.dir === 2 ? bz + 0.01 : bz + 0.1;
  S.push(box([bx0, y + 1.0, bz0], [bx1, y + 1.4, bz1], 'lightWarm', false));
  S.push(box([ix0 + 0.3, y + 2.26, iz0 + 0.3], [ix1 - 0.3, y + 2.3, iz1 - 0.3], 'lightPanel', false));
  const buttonDir = ((s.dir + 2) % 4) as Dir;
  c.L.elevators.push({ socketId: s.id, volume: { min: [ix0, y, iz0], max: [ix1, y + 2.2, iz1] }, button: [bx, y + 1.2, bz], buttonDir });
  // bounds を籠まで広げる
  const b = c.L.bounds;
  b.min[0] = Math.min(b.min[0], ix0 - t);
  b.max[0] = Math.max(b.max[0], ix1 + t);
  b.min[2] = Math.min(b.min[2], iz0 - t);
  b.max[2] = Math.max(b.max[2], iz1 + t);
  void ox;
  void oz;
}

// ---------------------------------------------------------------- ゾーン / 照明 / 仕上げ

export function themeZone(c: MegaCtx, r: Rect, name: string, preset: string, y0 = -0.2, y1 = c.h + 0.2, extra?: Record<string, unknown>): Zone {
  const z: Zone = { kind: 'theme', aabb: { min: [r.x0, y0, r.z0], max: [r.x1, y1, r.z1] }, params: { name, preset, ...(extra ?? {}) } };
  (c.L.zones ??= []).push(z);
  return z;
}

/** 浅い水面（歩ける。膝下）。基準床の上に縁石 curb と水面箔。kind 'water' ゾーンも出す */
export function waterBasin(c: MegaCtx, r: Rect, depth: number, curbMat: MatId, waterMat: MatId = 'waterShallow', slow = 0.6): void {
  const curbH = Math.min(0.3, depth + 0.05);
  const t = 0.25;
  const S = c.structure;
  S.push(box([r.x0 - t, 0, r.z0 - t], [r.x1 + t, curbH, r.z0], curbMat));
  S.push(box([r.x0 - t, 0, r.z1], [r.x1 + t, curbH, r.z1 + t], curbMat));
  S.push(box([r.x0 - t, 0, r.z0], [r.x0, curbH, r.z1], curbMat));
  S.push(box([r.x1, 0, r.z0], [r.x1 + t, curbH, r.z1], curbMat));
  // 水面（縁石より少し低い。非ソリッド）
  c.L.boxes.push(box([r.x0, 0.01, r.z0], [r.x1, Math.max(0.05, curbH - 0.03), r.z1], waterMat, false));
  (c.L.zones ??= []).push({ kind: 'water', aabb: { min: [r.x0, -0.1, r.z0], max: [r.x1, curbH + 0.1, r.z1] }, params: { slow, depth } });
}

/** 高所の吊り灯（発光箔 + 吊り棒 + PointLight）。spacing 間隔、everyNth で PointLight を間引く */
export function hangingLights(c: MegaCtx, rects: Rect[], y: number, spacing: number, mat: MatId, color: number, intensity: number, rng: Rng, everyNth = 4, offChance = 0.1, size = 1.2): void {
  let i = 0;
  for (const r of rects) {
    const ir = inner(r, 3);
    const nx = Math.max(1, Math.round((ir.x1 - ir.x0) / spacing));
    const nz = Math.max(1, Math.round((ir.z1 - ir.z0) / spacing));
    for (let a = 0; a < nx; a++) {
      for (let b = 0; b < nz; b++) {
        if (remaining(c) < 30) return;
        const x = ir.x0 + (a + 0.5) * ((ir.x1 - ir.x0) / nx);
        const z = ir.z0 + (b + 0.5) * ((ir.z1 - ir.z0) / nz);
        const off = rng.chance(offChance);
        c.L.boxes.push(box([x - size / 2, y - 0.08, z - size / 2], [x + size / 2, y, z + size / 2], off ? 'lightOff' : mat, false));
        c.L.boxes.push(box([x - 0.03, y, z - 0.03], [x + 0.03, c.h, z + 0.03], 'metal', false));
        if (!off && i % everyNth === 0) c.L.lights.push({ pos: [x, y - 0.5, z], color, intensity, distance: spacing * 2.4 });
        i++;
      }
    }
  }
}

/** 回廊の天井（上階スラブの下面）に付ける壁灯。y は階の床、帯ごとに pitch 間隔 */
export function galleryLights(c: MegaCtx, level: number, pitch: number, mat: MatId, color: number, intensity: number, everyNth = 5): void {
  const slabs = c.slabs.get(level) ?? [];
  let i = 0;
  for (const s of slabs) {
    const w = s.x1 - s.x0;
    const d = s.z1 - s.z0;
    const alongX = w >= d;
    const len = alongX ? w : d;
    const n = Math.max(1, Math.floor(len / pitch));
    for (let k = 0; k < n; k++) {
      if (remaining(c) < 30) return;
      const t = (alongX ? s.x0 : s.z0) + (k + 0.5) * (len / n);
      const x = alongX ? t : (s.x0 + s.x1) / 2;
      const z = alongX ? (s.z0 + s.z1) / 2 : t;
      const y = level * FLOOR - 0.2;
      c.L.boxes.push(box([x - 0.5, y - 0.04, z - 0.15], [x + 0.5, y - 0.005, z + 0.15], mat, false));
      if (i % everyNth === 0) c.L.lights.push({ pos: [x, y - 0.4, z], color, intensity, distance: pitch * 1.8 });
      i++;
    }
  }
}

/** 予約領域（階段・EV・橋）と重なる内装（fromIndex 以降のソリッド箱）を取り除く */
export function clearReserved(c: MegaCtx, fromIndex: number): void {
  const keep = c.L.boxes.slice(0, fromIndex);
  for (const b of c.L.boxes.slice(fromIndex)) {
    if (!b.solid) { keep.push(b); continue; }
    const r = rectOfBox(b);
    const hit = c.reserved.some((res) => {
      const ry0 = res.y0 ?? -Infinity;
      const ry1 = res.y1 ?? Infinity;
      if (b.min[1] >= ry1 || b.max[1] <= ry0) return false;
      return rectsOverlapPad(res.rect, r, 0.05);
    });
    if (!hit) keep.push(b);
  }
  c.L.boxes = keep;
}

/** 構造を L.boxes の先頭（シェルの直後）へ差し込み shellCount を更新する。内装はこの後に追加する */
export function finalizeStructure(c: MegaCtx): number {
  const shell = c.L.shellCount ?? c.L.boxes.length;
  c.L.boxes.splice(shell, 0, ...c.structure);
  c.L.shellCount = shell + c.structure.length;
  c.structure = [];
  return c.L.shellCount;
}

/** 面積合計 */
export function totalArea(rects: Rect[]): number {
  return rects.reduce((a, r) => a + rectArea(r), 0);
}

/** 視程（Tier でさらにクランプされる）: 対角の 0.6、40〜90 */
export function fogFarFor(rects: Rect[]): number {
  const b = unionBounds(rects);
  const diag = Math.hypot(b.x1 - b.x0, b.z1 - b.z0);
  return Math.max(40, Math.min(90, Math.round(diag * 0.6)));
}

/** 進行軸: 入口 → 最も遠い出口（同じ階の出口を優先） */
export function pathFor(sockets: Socket[]): Vec3[] | undefined {
  const entry = sockets.find((s) => s.id === 'entry');
  if (!entry) return undefined;
  let best: Socket | null = null;
  let bd = -1;
  for (const s of sockets) {
    if (s.id === 'entry' || s.type === 'hole') continue;
    const d = Math.hypot(s.pos[0] - entry.pos[0], s.pos[2] - entry.pos[2]) - Math.abs(s.pos[1] - entry.pos[1]) * 3;
    if (d > bd) { bd = d; best = s; }
  }
  if (!best) return undefined;
  const ei = inwardOf(entry.dir);
  const bi = inwardOf(best.dir);
  return [
    [entry.pos[0] + ei[0] * 1.5, entry.pos[1], entry.pos[2] + ei[1] * 1.5],
    [best.pos[0] + bi[0] * 1.5, best.pos[1], best.pos[2] + bi[1] * 1.5],
  ];
}

// ---------------------------------------------------------------- 生成パイプライン（共通の入口・出口・シェル・仕上げ）

export interface CtxOptions {
  rects: Rect[];
  main: Rect;
  h: number;
  levels: number;
  /** 地上の出口数 */
  groundExits: number;
  exitWidth?: number;
  exitHeight?: number;
  /** 地上出口を置ける辺（省略時は全外壁） */
  exitPred?: (r: Rect, dir: Dir) => boolean;
  /** 床穴の確率（allowHole のとき） */
  holeChance?: number;
  /** パレットの上書き */
  palette?: Partial<RoomLayout['palette']>;
}

/** 足跡・入口・地上出口・床穴・extraSockets を確定してコンテキストを作る（buildShell はまだ呼ばない） */
export function createCtx(p: GenParams, vr: Rng, o: CtxOptions): { c: MegaCtx; entry: Socket; ceilingHole: AABB | null } {
  const L = emptyLayoutMega(p, o.palette);
  const h = o.h;
  L.footprint = o.rects;
  L.height = h;
  L.bounds = footprintAABBMega(o.rects, h);
  const { entry, ceilingHole } = makeEntry(p, o.main, 0, h);
  const c: MegaCtx = { p, L, vr, rects: o.rects, main: o.main, h, levels: o.levels, sockets: [entry], extras: [...p.extraSockets], structure: [], reserved: [], stairHoles: [], slabs: new Map() };
  // 地上の出口
  placeExitsOn(c, o.groundExits, [0], o.exitPred ?? (() => true), 'exit', vr, o.exitWidth ?? DOOR_W, o.exitHeight ?? DOOR_H, 6.0);
  // removedSockets の除外は mergeExtraSockets で行う（上階出口・EV の抽選が除外の有無で変わらないように）
  // 床穴（判定・配置は専用 fork。holeLocal の有無で vr の消費量を変えない）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && hr.chance(o.holeChance ?? 0.25);
  if (p.holeLocal || wantHole) {
    const hole = placeHole(o.rects, c.sockets, hr, p.holeLocal);
    if (hole) {
      L.holes.push(hole.hole);
      c.sockets.push(hole.socket);
    }
  }
  L.sockets = [...c.sockets, ...c.extras];
  if (ceilingHole) {
    // 天井穴からの着地点は塞がない（橋・家具・階段を避ける）
    const cx = (ceilingHole.min[0] + ceilingHole.max[0]) / 2;
    const cz = (ceilingHole.min[2] + ceilingHole.max[2]) / 2;
    reserve(c, rect(cx - 1.6, cz - 1.6, cx + 1.6, cz + 1.6));
  }
  for (const hh of L.holes) reserve(c, rect(hh.min[0] - 1.2, hh.min[2] - 1.2, hh.max[0] + 1.2, hh.max[2] + 1.2));
  return { c, entry, ceilingHole };
}

/** 出口ソケットを外壁に置く（地上 / 上階共通）。pred(r, dir, level) が true の辺だけ */
export function placeExitsOn(c: MegaCtx, count: number, levelYs: number[], pred: (r: Rect, dir: Dir, level: number) => boolean, idPrefix: string, rng: Rng, width = DOOR_W, height = DOOR_H, gap = 4.0): Socket[] {
  const out: Socket[] = [];
  if (count <= 0) return out;
  const all = wallSpans(c.rects).filter((sp) => sp.a1 - sp.a0 >= width + 2.4);
  let guard = 0;
  let idx = c.sockets.filter((s) => s.id.startsWith(idPrefix)).length;
  while (out.length < count && guard++ < count * 14) {
    const y = rng.pick(levelYs);
    const level = Math.round(y / FLOOR);
    const spans = all.filter((sp) => pred(sp.edge.rect, sp.edge.dir, level));
    if (spans.length === 0) return out;
    const span = rng.weighted(spans, (s) => s.a1 - s.a0);
    const t = pickSpanPosition(span, c.sockets, width, rng.next(), 1.0);
    if (t === null) continue;
    const same = c.sockets.some((s) => s.dir === span.edge.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - span.edge.coord) < 0.05 && Math.abs(along(s.dir, s.pos[0], s.pos[2]) - t) < gap);
    if (same) continue;
    const s = socketOnSpan(`${idPrefix}${idx++}`, 'door', span, t, width, height, y);
    out.push(s);
    c.sockets.push(s);
  }
  return out;
}

/** extraSockets を c.sockets に合流させる（冪等）。同じ壁で重なる生成ソケットは取り除く（WorldManager は既存ソケットを避けて追加するので通常は起きない）。
 *  出口・上階出口・EV を置き終えた後、構造（階段は扉前を避ける）より前に呼ぶ */
export function mergeExtraSockets(c: MegaCtx): void {
  if (c.merged) return;
  c.merged = true;
  const clash = (a: Socket, b: Socket) => a.dir === b.dir && Math.abs(across(a.dir, a.pos[0], a.pos[2]) - across(b.dir, b.pos[0], b.pos[2])) < 0.08 && Math.abs(a.pos[1] - b.pos[1]) < 0.1 && Math.abs(along(a.dir, a.pos[0], a.pos[2]) - along(b.dir, b.pos[0], b.pos[2])) < (a.width + b.width) / 2 + 0.4;
  const removed = new Set(c.p.removedSockets);
  const kept = c.sockets.filter((s) => !removed.has(s.id) && (s.id === 'entry' || s.type === 'hole' || !c.extras.some((x) => clash(s, x))));
  c.sockets = [...kept, ...c.extras];
  c.extras = [];
  c.L.sockets = c.sockets;
  dropRemovedHole(c.L, c.p);
  c.sockets = c.L.sockets;
}

/** シェル（床・天井・外壁）を組み、構造をその直後へ差し込む。戻り値は shellCount（内装の開始位置） */
export function commitShell(c: MegaCtx, ceilingHole: AABB | null, mats?: { floor?: MatId; wall?: MatId; ceiling?: MatId; noCeiling?: boolean }): number {
  const L = c.L;
  mergeExtraSockets(c);
  L.sockets = c.sockets;
  buildShell(L.boxes, c.rects, c.h, c.sockets, {
    floor: mats?.floor ?? L.palette.floor, wall: mats?.wall ?? L.palette.wall, ceiling: mats?.ceiling ?? L.palette.ceiling,
    floorHoles: L.holes, ceilingHoles: ceilingHole ? [ceilingHole] : [], noCeiling: mats?.noCeiling,
  });
  L.shellCount = L.boxes.length;
  if (ceilingHole) {
    const hh = ceilingHole;
    L.boxes.push(box([hh.min[0] - 0.2, 0.001, hh.min[2] - 0.2], [hh.max[0] + 0.2, 0.012, hh.max[2] + 0.2], 'furnitureDark', false));
    L.shellCount = L.boxes.length;
  }
  return finalizeStructure(c);
}

/** 仕上げ: 扉前・予約領域の家具を取り除き、ラベル・視程・進行軸・チャンクを設定 */
export function finish(c: MegaCtx, entry: Socket, shellCount: number, opts?: { chunkSize?: number; fogFar?: number; labelWidth?: number }): RoomLayout {
  const L = c.L;
  clearDoorways(L, c.sockets, shellCount);
  clearReserved(c, shellCount);
  labelAtEntry(L, entry, opts?.labelWidth ?? 3.0, c.p.label);
  L.fogFar = opts?.fogFar ?? fogFarFor(c.rects);
  L.chunkSize = opts?.chunkSize ?? 28;
  // 歩ける階数（地図の levelSpan。単層で天井の高い MegaHall が世界 AABB の高さから 3〜5 階に描かれないように）
  L.levels = Math.max(1, c.levels);
  L.path ??= pathFor(c.sockets);
  // 予算超過の保険: 内装側の非ソリッド装飾から削る
  if (L.boxes.length > MAX_BOXES) {
    const keep = L.boxes.slice(0, shellCount);
    const rest = L.boxes.slice(shellCount);
    const solids = rest.filter((b) => b.solid);
    const decor = rest.filter((b) => !b.solid);
    const room = Math.max(0, MAX_BOXES - keep.length - solids.length);
    L.boxes = [...keep, ...solids, ...decor.slice(0, room)];
  }
  return L;
}

function emptyLayoutMega(p: GenParams, over?: Partial<RoomLayout['palette']>): RoomLayout {
  const L = emptyLayout({ ...p.palette, ...(over ?? {}) });
  return L;
}

function footprintAABBMega(rects: Rect[], h: number): AABB {
  const b = unionBounds(rects);
  return { min: [b.x0, -0.2, b.z0], max: [b.x1, h + 0.2, b.z1] };
}

// ---------------------------------------------------------------- 内装パターン（予約領域・扉前を避ける版）

export interface RowsOpts {
  spacing: number;
  depth: number;
  height: number;
  mat: MatId;
  /** 列を分割する長さ（隙間 1.2 m） */
  gapEvery?: number;
  margin?: number;
  axis?: 'x' | 'z';
  top?: MatId;
  y0?: number;
}

/** 列（机・棚・座席）。axis 'x' なら x 方向に伸びる列を z 間隔で並べる。予約・扉前と重なる区間は飛ばす */
export function furnishRows(c: MegaCtx, r: Rect, o: RowsOpts): number {
  const axis = o.axis ?? 'x';
  const ir = inner(r, o.margin ?? 1.4);
  const y0 = o.y0 ?? 0;
  let n = 0;
  const seg = o.gapEvery ?? Infinity;
  if (axis === 'x') {
    for (let z = ir.z0 + o.spacing / 2; z + o.depth / 2 < ir.z1; z += o.spacing) {
      for (let x0 = ir.x0; x0 < ir.x1 - 0.8; x0 += seg + 1.2) {
        const x1 = Math.min(ir.x1, x0 + seg);
        const rr = rect(x0, z - o.depth / 2, x1, z + o.depth / 2);
        if (blocked(c, rr, y0, y0 + o.height, 0.4)) continue;
        if (remaining(c) < 40) return n;
        c.L.boxes.push(box([x0, y0, rr.z0], [x1, y0 + o.height, rr.z1], o.mat));
        if (o.top) c.L.boxes.push(box([x0, y0 + o.height, rr.z0], [x1, y0 + o.height + 0.04, rr.z1], o.top, false));
        n++;
      }
    }
  } else {
    for (let x = ir.x0 + o.spacing / 2; x + o.depth / 2 < ir.x1; x += o.spacing) {
      for (let z0 = ir.z0; z0 < ir.z1 - 0.8; z0 += seg + 1.2) {
        const z1 = Math.min(ir.z1, z0 + seg);
        const rr = rect(x - o.depth / 2, z0, x + o.depth / 2, z1);
        if (blocked(c, rr, y0, y0 + o.height, 0.4)) continue;
        if (remaining(c) < 40) return n;
        c.L.boxes.push(box([rr.x0, y0, z0], [rr.x1, y0 + o.height, z1], o.mat));
        if (o.top) c.L.boxes.push(box([rr.x0, y0 + o.height, z0], [rr.x1, y0 + o.height + 0.04, z1], o.top, false));
        n++;
      }
    }
  }
  return n;
}

/** 島（低い塊）。count 個を乱択配置 */
export function furnishIslands(c: MegaCtx, r: Rect, count: number, mats: MatId[], size: [number, number], height: [number, number], rng: Rng, margin = 1.2): number {
  const ir = inner(r, margin);
  let n = 0;
  for (let i = 0; i < count * 3 && n < count; i++) {
    const sx = rng.float(size[0], size[1]) / 2;
    const sz = rng.float(size[0], size[1]) / 2;
    const x = rng.float(ir.x0 + sx, ir.x1 - sx);
    const z = rng.float(ir.z0 + sz, ir.z1 - sz);
    const hh = rng.float(height[0], height[1]);
    if (x - sx < ir.x0 || x + sx > ir.x1 || z - sz < ir.z0 || z + sz > ir.z1) continue;
    const rr = rect(x - sx, z - sz, x + sx, z + sz);
    if (blocked(c, rr, 0, hh, 0.8)) continue;
    if (overlapsInterior(c, rr, 0, hh)) continue;
    if (remaining(c) < 40) return n;
    c.L.boxes.push(box([rr.x0, 0, rr.z0], [rr.x1, hh, rr.z1], rng.pick(mats)));
    n++;
  }
  return n;
}

/** 壁沿いの什器（矩形 r の辺のうち sides が true の辺）。depth × height、2 m 刻み */
export function furnishPerimeter(c: MegaCtx, r: Rect, sides: boolean[], depth: number, height: number, mat: MatId, rng: Rng, skip = 0.2, y0 = 0): number {
  const ir = inner(r, 0.15);
  let n = 0;
  const edges: { x0: number; z0: number; x1: number; z1: number; horizontal: boolean }[] = [];
  if (sides[0]) edges.push({ x0: ir.x0, z0: ir.z1 - depth, x1: ir.x1, z1: ir.z1, horizontal: true });
  if (sides[2]) edges.push({ x0: ir.x0, z0: ir.z0, x1: ir.x1, z1: ir.z0 + depth, horizontal: true });
  if (sides[3]) edges.push({ x0: ir.x0, z0: ir.z0, x1: ir.x0 + depth, z1: ir.z1, horizontal: false });
  if (sides[1]) edges.push({ x0: ir.x1 - depth, z0: ir.z0, x1: ir.x1, z1: ir.z1, horizontal: false });
  for (const e of edges) {
    const len = e.horizontal ? e.x1 - e.x0 : e.z1 - e.z0;
    const seg = 2.0;
    for (let t = 0.4; t + seg <= len - 0.4; t += seg + 0.1) {
      if (rng.chance(skip)) continue;
      const rr = e.horizontal ? rect(e.x0 + t, e.z0, e.x0 + t + seg, e.z1) : rect(e.x0, e.z0 + t, e.x1, e.z0 + t + seg);
      if (blocked(c, rr, y0, y0 + height, 0.5)) continue;
      if (remaining(c) < 40) return n;
      c.L.boxes.push(box([rr.x0, y0, rr.z0], [rr.x1, y0 + height, rr.z1], mat));
      n++;
    }
  }
  return n;
}

/** 内装側（shellCount 以降）のソリッド箱と重なるか */
export function overlapsInterior(c: MegaCtx, r: Rect, y0: number, y1: number): boolean {
  const from = c.L.shellCount ?? 0;
  for (let i = from; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    if (!b.solid) continue;
    if (b.min[1] >= y1 || b.max[1] <= y0) continue;
    if (rectsOverlapPad(rectOfBox(b), r, 0.05)) return true;
  }
  return false;
}

/** 床の薄い箔（通路・ライン・雪面。非ソリッド） */
export function floorSheet(c: MegaCtx, r: Rect, mat: MatId, thickness = 0.02, y0 = 0.001): void {
  c.L.boxes.push(box([r.x0, y0, r.z0], [r.x1, y0 + thickness, r.z1], mat, false));
}

export { rect, inner, rectArea, unionBounds };
export type { Rect };
