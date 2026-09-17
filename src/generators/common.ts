/** 生成器共通のユーティリティ: 入口処理・出口ソケット配置・照明・ラベル・家具パターン */
import { aabbFromCenter, type AABB } from '../core/aabb';
import type { Dir, Socket } from '../core/types';
import type { Rng } from '../core/rng';
import {
  across, along, clearOfSockets, inner, inRect, pickSpanPosition, rectArea, socketOnSpan, wallSpans, type Rect, type WallSpan,
} from './footprint';
import { box, DOOR_H, DOOR_W, HOLE_SIZE, kinded, lightPanel, socket, WALL_T, WIDE_W, type Box, type GenParams, type MatId, type RoomLayout } from './layout';

/** 入口ソケットを作る。壁面入口は rect0 の南辺（z = rect0.z0）の x = ex に置く。hole 入口は天井穴。 */
export function makeEntry(p: GenParams, rect0: Rect, ex: number, h: number): { entry: Socket; ceilingHole: AABB | null } {
  const type = p.entry?.type ?? 'door';
  if (type === 'hole') {
    // 天井穴。入口は部屋内部の点（南西寄り 30%）。上の部屋から落ちてくる
    const hx = rect0.x0 + (rect0.x1 - rect0.x0) * 0.3;
    const hz = rect0.z0 + (rect0.z1 - rect0.z0) * 0.3;
    const entry: Socket = { id: 'entry', type: 'hole', pos: [hx, h + 0.2, hz], dir: 0, width: HOLE_SIZE, height: 0 };
    return { entry, ceilingHole: aabbFromCenter(hx, h + 0.1, hz, HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2) };
  }
  // EntryReq の拡張フィールド（height / sill / crawl）。しゃがみ開口や高いスロットは開口寸法をそのまま写す
  const req = p.entry as (typeof p.entry & { height?: number; sill?: number; crawl?: boolean }) | null;
  const lowOpening = !!req && (req.crawl || (req.sill ?? 0) > 0 || (req.height !== undefined && req.height < DOOR_H));
  const width = req ? (lowOpening ? req.width : Math.max(req.width, type === 'door' ? DOOR_W : WIDE_W)) : DOOR_W;
  const height = lowOpening ? Math.min(h - 0.1, req!.height ?? 1.2) : type === 'door' ? DOOR_H : h - 0.3;
  const entry = socket('entry', type, [ex, 0, rect0.z0], 2, width, height);
  if (req?.sill) entry.sill = req.sill;
  if (req?.crawl) entry.crawl = true;
  return { entry, ceilingHole: null };
}

export interface ExitOptions {
  count: number;
  /** 出口の種類（既定 door） */
  type?: Socket['type'];
  width?: number;
  height?: number;
  /** ソケット間の最小距離 */
  minGap?: number;
  /** 使わない辺（入口側など） */
  excludeDir?: Dir;
}

/** 外壁区間からランダムに出口ソケットを配置する */
export function placeExits(rects: Rect[], existing: Socket[], rng: Rng, o: ExitOptions, idPrefix = 'exit'): Socket[] {
  const width = o.width ?? DOOR_W;
  const height = o.height ?? DOOR_H;
  const spans = wallSpans(rects).filter((s) => s.a1 - s.a0 >= width + 1.2 && s.edge.dir !== o.excludeDir);
  const out: Socket[] = [];
  const all = [...existing];
  let guard = 0;
  while (out.length < o.count && guard++ < o.count * 12 && spans.length > 0) {
    const span = rng.weighted(spans, (s) => s.a1 - s.a0);
    const t = pickSpanPosition(span, all, width, rng.next(), 0.8);
    if (t === null) continue;
    // 同じ辺の近くに既存ソケットがあれば避ける
    const gap = o.minGap ?? 2.4;
    const tooClose = all.some((s) => s.dir === span.edge.dir && Math.abs(along(s.dir, s.pos[0], s.pos[2]) - t) < gap && Math.abs((span.edge.dir === 0 || span.edge.dir === 2 ? s.pos[2] : s.pos[0]) - span.edge.coord) < 0.05);
    if (tooClose) continue;
    const s = socketOnSpan(`${idPrefix}${out.length}`, o.type ?? 'door', span, t, width, height);
    out.push(s);
    all.push(s);
  }
  return out;
}

/** 床穴を 1 つ置く（内部で、ソケットから離れた位置） */
export function placeHole(rects: Rect[], sockets: Socket[], rng: Rng, fixed?: [number, number, number]): { hole: AABB; socket: Socket } | null {
  if (fixed) {
    return { hole: aabbFromCenter(fixed[0], 0, fixed[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2), socket: socket('hole', 'hole', [fixed[0], 0, fixed[2]], 0, HOLE_SIZE, 0) };
  }
  const candidates = rects.filter((r) => rectArea(r) > 40);
  if (candidates.length === 0) return null;
  for (let i = 0; i < 12; i++) {
    const r = inner(rng.pick(candidates), 2.0);
    if (r.x1 - r.x0 < 2 || r.z1 - r.z0 < 2) continue;
    const hx = rng.float(r.x0, r.x1);
    const hz = rng.float(r.z0, r.z1);
    if (!clearOfSockets(sockets, hx, hz, 2.6)) continue;
    return { hole: aabbFromCenter(hx, 0, hz, HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2), socket: socket('hole', 'hole', [hx, 0, hz], 0, HOLE_SIZE, 0) };
  }
  return null;
}

/** 天井灯のグリッド配置。spacing 間隔、offChance で消灯 */
export function lightGrid(L: RoomLayout, rects: Rect[], h: number, spacing: number, offChance: number, rng: Rng, mat: MatId, color: number, intensity: number, everyNth = 3): void {
  let i = 0;
  for (const r of rects) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const nx = Math.max(1, Math.round(w / spacing));
    const nz = Math.max(1, Math.round(d / spacing));
    for (let a = 0; a < nx; a++) {
      for (const b of Array.from({ length: nz }, (_, k) => k)) {
        const x = r.x0 + (a + 0.5) * (w / nx);
        const z = r.z0 + (b + 0.5) * (d / nz);
        const off = rng.chance(offChance);
        lightPanel(L.boxes, x, z, Math.min(1.2, w * 0.3), 0.6, h, off ? 'lightOff' : mat);
        if (!off && i % everyNth === 0) L.lights.push({ pos: [x, h - 0.4, z], color, intensity, distance: spacing * 2.6 });
        i++;
      }
    }
  }
}

/** 入口の内側の壁にラベル */
export function labelAtEntry(L: RoomLayout, entry: Socket, width: number, text?: { text: string; sub?: string }): void {
  if (!text || entry.type === 'hole') return;
  const y = Math.min(2.35, entry.height + 0.3);
  // 入口は南辺（dir 2、外向き -Z）。内側（+Z）へ WALL_T + 0.01 ずらし、+Z を向ける
  L.labels.push({ pos: [entry.pos[0], y, entry.pos[2] + 0.16], dir: 0, text: text.text, sub: text.sub, width });
}

// ---------------------------------------------------------------- 家具パターン
export interface FurnishCtx {
  L: RoomLayout;
  rects: Rect[];
  h: number;
  rng: Rng;
  /** 近づけない点（ソケット・穴） */
  keep: Socket[];
  landing?: AABB | null;
}

function free(c: FurnishCtx, x: number, z: number, radius = 1.6): boolean {
  if (!clearOfSockets(c.keep, x, z, radius)) return false;
  if (c.landing && x > c.landing.min[0] - 1 && x < c.landing.max[0] + 1 && z > c.landing.min[2] - 1 && z < c.landing.max[2] + 1) return false;
  return true;
}

/** 柱グリッド（大部屋） */
export function patternColumns(c: FurnishCtx, spacing = 7): void {
  for (const r of c.rects) {
    const ir = inner(r, 1.0);
    for (let x = ir.x0 + spacing / 2; x < ir.x1; x += spacing) {
      for (let z = ir.z0 + spacing / 2; z < ir.z1; z += spacing) {
        if (!free(c, x, z, 1.4)) continue;
        c.L.boxes.push(box([x - 0.3, 0, z - 0.3], [x + 0.3, c.h, z + 0.3], 'columnConcrete'));
      }
    }
  }
}

/** 家具島（ランダムな低い塊） */
export function patternIslands(c: FurnishCtx, density = 1 / 35, mats: MatId[] = ['furnitureLight', 'furnitureDark'], kind?: string): void {
  for (const r of c.rects) {
    const ir = inner(r, 1.2);
    const n = Math.round(rectArea(ir) * density);
    for (let i = 0; i < n; i++) {
      const x = c.rng.float(ir.x0, ir.x1);
      const z = c.rng.float(ir.z0, ir.z1);
      if (!free(c, x, z)) continue;
      const sx = c.rng.float(0.5, 1.6);
      const sz = c.rng.float(0.5, 1.6);
      if (x - sx < ir.x0 || x + sx > ir.x1 || z - sz < ir.z0 || z + sz > ir.z1) continue;
      const b = box([x - sx, 0, z - sz], [x + sx, c.rng.float(0.45, 1.1), z + sz], c.rng.pick(mats));
      if (kind) b.kind = kind;
      c.L.boxes.push(b);
    }
  }
}

/** 列（机・棚・座席）。axis 'x' なら x 方向に伸びる列を z 間隔で並べる */
export function patternRows(c: FurnishCtx, o: { spacing: number; depth: number; height: number; mat: MatId; gapEvery?: number; margin?: number; axis?: 'x' | 'z'; top?: MatId; kind?: string }): void {
  const axis = o.axis ?? 'x';
  for (const r of c.rects) {
    const ir = inner(r, o.margin ?? 1.4);
    if (axis === 'x') {
      for (let z = ir.z0 + o.spacing / 2; z + o.depth / 2 < ir.z1; z += o.spacing) {
        const segLen = o.gapEvery ?? Infinity;
        for (let x0 = ir.x0; x0 < ir.x1 - 0.5; x0 += segLen + 1.2) {
          const x1 = Math.min(ir.x1, x0 + segLen);
          // ソケット付近を避けて分割
          const blocked = c.keep.some((s) => s.pos[2] > z - 2 && s.pos[2] < z + 2 && s.pos[0] > x0 - 1.5 && s.pos[0] < x1 + 1.5 && Math.abs(s.pos[2] - z) < 1.8);
          if (blocked) continue;
          const b = box([x0, 0, z - o.depth / 2], [x1, o.height, z + o.depth / 2], o.mat);
          if (o.kind) b.kind = o.kind;
          c.L.boxes.push(b);
          if (o.top) c.L.boxes.push(box([x0, o.height, z - o.depth / 2], [x1, o.height + 0.04, z + o.depth / 2], o.top, false));
        }
      }
    } else {
      for (let x = ir.x0 + o.spacing / 2; x + o.depth / 2 < ir.x1; x += o.spacing) {
        const segLen = o.gapEvery ?? Infinity;
        for (let z0 = ir.z0; z0 < ir.z1 - 0.5; z0 += segLen + 1.2) {
          const z1 = Math.min(ir.z1, z0 + segLen);
          const blocked = c.keep.some((s) => s.pos[0] > x - 2 && s.pos[0] < x + 2 && s.pos[2] > z0 - 1.5 && s.pos[2] < z1 + 1.5 && Math.abs(s.pos[0] - x) < 1.8);
          if (blocked) continue;
          const b = box([x - o.depth / 2, 0, z0], [x + o.depth / 2, o.height, z1], o.mat);
          if (o.kind) b.kind = o.kind;
          c.L.boxes.push(b);
          if (o.top) c.L.boxes.push(box([x - o.depth / 2, o.height, z0], [x + o.depth / 2, o.height + 0.04, z1], o.top, false));
        }
      }
    }
  }
}

/** 間仕切り壁（部屋を 2〜4 区画に分ける。1.4m の通り抜けを残す） */
export function patternPartitions(c: FurnishCtx, count: number, height: number, mat: MatId): void {
  const r = c.rects[0];
  const ir = inner(r, 0);
  const alongX = c.rng.chance(0.5);
  for (let i = 1; i <= count; i++) {
    const t = alongX ? ir.z0 + ((ir.z1 - ir.z0) * i) / (count + 1) : ir.x0 + ((ir.x1 - ir.x0) * i) / (count + 1);
    const gapAt = alongX ? c.rng.float(ir.x0 + 1.5, ir.x1 - 1.5) : c.rng.float(ir.z0 + 1.5, ir.z1 - 1.5);
    const segs: [number, number][] = alongX ? [[ir.x0 + 0.15, gapAt - 0.8], [gapAt + 0.8, ir.x1 - 0.15]] : [[ir.z0 + 0.15, gapAt - 0.8], [gapAt + 0.8, ir.z1 - 0.15]];
    for (const [a, b] of segs) {
      if (b - a < 0.3) continue;
      // ソケット直前に壁が来ないよう、ソケット周辺 1.6m は切る
      const pieces: [number, number][] = [[a, b]];
      for (const s of c.keep) {
        const sa = alongX ? s.pos[0] : s.pos[2];
        const sc = alongX ? s.pos[2] : s.pos[0];
        if (Math.abs(sc - t) > 1.6) continue;
        for (let k = pieces.length - 1; k >= 0; k--) {
          const [p0, p1] = pieces[k];
          if (sa - 1.2 < p1 && sa + 1.2 > p0) {
            pieces.splice(k, 1);
            if (sa - 1.2 > p0 + 0.3) pieces.push([p0, sa - 1.2]);
            if (p1 > sa + 1.2 + 0.3) pieces.push([sa + 1.2, p1]);
          }
        }
      }
      for (const [p0, p1] of pieces) {
        if (alongX) c.L.boxes.push(box([p0, 0, t - 0.06], [p1, height, t + 0.06], mat));
        else c.L.boxes.push(box([t - 0.06, 0, p0], [t + 0.06, height, p1], mat));
      }
    }
  }
}

/** 壁沿いの家具（ロッカー・カウンター・棚） */
export function patternPerimeter(c: FurnishCtx, depth: number, height: number, mat: MatId, skip = 0.3, kind?: string): void {
  for (const r of c.rects) {
    const ir = inner(r, 0.15);
    const edges: { x0: number; z0: number; x1: number; z1: number }[] = [
      { x0: ir.x0, z0: ir.z1 - depth, x1: ir.x1, z1: ir.z1 },
      { x0: ir.x0, z0: ir.z0, x1: ir.x1, z1: ir.z0 + depth },
      { x0: ir.x0, z0: ir.z0, x1: ir.x0 + depth, z1: ir.z1 },
      { x0: ir.x1 - depth, z0: ir.z0, x1: ir.x1, z1: ir.z1 },
    ];
    for (const e of edges) {
      if (c.rng.chance(skip)) continue;
      const horizontal = e.x1 - e.x0 > e.z1 - e.z0;
      const len = horizontal ? e.x1 - e.x0 : e.z1 - e.z0;
      const seg = 2.0;
      for (let t = 0; t + seg <= len; t += seg + 0.1) {
        const x0 = horizontal ? e.x0 + t : e.x0;
        const x1 = horizontal ? e.x0 + t + seg : e.x1;
        const z0 = horizontal ? e.z0 : e.z0 + t;
        const z1 = horizontal ? e.z1 : e.z0 + t + seg;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        if (!free(c, cx, cz, 1.5)) continue;
        if (!inRect(r, cx, cz, 0.1)) continue;
        const b = box([x0, 0, z0], [x1, height, z1], mat);
        if (kind) b.kind = kind;
        c.L.boxes.push(b);
      }
    }
  }
}

/** 取り除かれた穴（真下に部屋を置けなかった）をレイアウトから外す。buildShell の前に呼ぶ */
export function dropRemovedHole(L: RoomLayout, p: GenParams): void {
  if (!p.removedSockets.includes('hole')) return;
  L.sockets = L.sockets.filter((s) => s.id !== 'hole');
  L.holes = [];
}

/** 扉の前後 1.6m × 幅 1.6m × 高 2.2m から家具（fromIndex 以降のソリッド箱）を取り除く。扉が家具で塞がれないようにする */
/** 壁の内面に帯（腰壁・巾木・手すり・廻り縁）を貼る。開口（ソケット幅 + 余白）は避ける。非ソリッド。
 *  bands: { y0, y1, mat, depth(壁面からの出。既定 0.02) , skipDoors(既定 true: 扉高さ未満の帯は開口を避ける) } */
export function wallBands(L: RoomLayout, rects: Rect[], sockets: Socket[], bands: { y0: number; y1: number; mat: MatId; depth?: number; skipDoors?: boolean }[], yBase = 0): void {
  for (const span of wallSpans(rects)) {
    const e = span.edge;
    // 内面: 外壁は矩形の内側に WALL_T の厚みで立つので、内面は coord から WALL_T だけ内側
    const inward = e.dir === 0 ? -1 : e.dir === 2 ? 1 : e.dir === 1 ? -1 : 1; // dir 0:+Z 面 → 内側は -Z
    const face = e.coord + inward * WALL_T;
    const cuts: [number, number][] = sockets
      .filter((s) => s.type !== 'hole' && s.dir === e.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - e.coord) < 0.05)
      .map((s) => [along(s.dir, s.pos[0], s.pos[2]) - s.width / 2 - 0.08, along(s.dir, s.pos[0], s.pos[2]) + s.width / 2 + 0.08] as [number, number]);
    for (const b of bands) {
      const d = b.depth ?? 0.02;
      const segs: [number, number][] = b.skipDoors === false ? [[span.a0, span.a1]] : subtractIntervals(span.a0, span.a1, cuts);
      for (const [p, q] of segs) {
        if (q - p < 0.05) continue;
        const lo = Math.min(face, face + inward * d), hi = Math.max(face, face + inward * d);
        if (e.dir === 0 || e.dir === 2) L.boxes.push(box([p, yBase + b.y0, lo], [q, yBase + b.y1, hi], b.mat, false));
        else L.boxes.push(box([lo, yBase + b.y0, p], [hi, yBase + b.y1, q], b.mat, false));
      }
    }
  }
}

function subtractIntervals(a0: number, a1: number, cuts: [number, number][]): [number, number][] {
  const sorted = cuts.filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [p, q] of sorted) {
    if (p > cur + 1e-6) out.push([cur, Math.min(p, a1)]);
    cur = Math.max(cur, q);
    if (cur >= a1) break;
  }
  if (a1 > cur + 1e-6) out.push([cur, a1]);
  return out;
}

export function clearDoorways(L: RoomLayout, sockets: Socket[], fromIndex: number): void {
  const zones: AABB[] = [];
  for (const s of sockets) {
    if (s.type === 'hole') {
      zones.push(aabbFromCenter(s.pos[0], 1.1, s.pos[2], 1.3, 1.2, 1.3));
      continue;
    }
    const half = Math.max(0.8, s.width / 2 + 0.3);
    // 内側方向へ 1.8m
    const inward = s.dir === 0 ? [0, -1] : s.dir === 1 ? [-1, 0] : s.dir === 2 ? [0, 1] : [1, 0];
    const cx = s.pos[0] + inward[0] * 0.9;
    const cz = s.pos[2] + inward[1] * 0.9;
    const hx = s.dir === 0 || s.dir === 2 ? half : 0.9;
    const hz = s.dir === 0 || s.dir === 2 ? 0.9 : half;
    zones.push({ min: [cx - hx, s.pos[1] - 0.1, cz - hz], max: [cx + hx, s.pos[1] + 2.2, cz + hz] });
  }
  const keep: Box[] = L.boxes.slice(0, fromIndex);
  for (const b of L.boxes.slice(fromIndex)) {
    if (!b.solid) {
      keep.push(b);
      continue;
    }
    const hit = zones.some((z) => b.min[0] < z.max[0] && b.max[0] > z.min[0] && b.min[1] < z.max[1] && b.max[1] > z.min[1] && b.min[2] < z.max[2] && b.max[2] > z.min[2]);
    if (!hit) keep.push(b);
  }
  L.boxes = keep;
}

export type PatternSet = 'columns' | 'islands' | 'partitions' | 'perimeter' | 'empty' | 'rows';

/** 大部屋の汎用パターン選択。面積に応じて 1〜2 パターン重ねる */
export function furnishGeneric(c: FurnishCtx, area: number, style: 'office' | 'plain' | 'retail' | 'soft'): void {
  if (area > 150) patternColumns(c, c.rng.chance(0.5) ? 7 : 8.5);
  const roll = c.rng.next();
  if (area > 120 && roll < 0.3) patternPartitions(c, area > 300 ? 3 : 2, c.rng.chance(0.5) ? 2.2 : c.h, 'wallWhite');
  else if (roll < 0.55) patternIslands(c, style === 'soft' ? 1 / 28 : 1 / 40, undefined, style === 'soft' ? 'sofa' : 'table');
  else if (roll < 0.75) patternRows(c, style === 'office' ? { spacing: 3.2, depth: 1.4, height: 0.75, mat: 'furnitureLight', gapEvery: 6, kind: 'desk' } : { spacing: 4, depth: 0.9, height: 0.8, mat: 'furnitureDark', gapEvery: 5, kind: 'table' });
  else if (roll < 0.9) patternPerimeter(c, 0.6, style === 'retail' ? 1.6 : 1.0, style === 'retail' ? 'shelfMetal' : 'furnitureDark', 0.3, style === 'retail' ? 'shelf' : 'cabinet');
  // 残り: 空（がらんどう）
}

// ---------------------------------------------------------------- kind 付き小物（プロップ）の追加配置
// 既存パターンの乱数列の後ろで専用 fork（rng.fork('props')）を使い、既存の箱の寸法・位置は変えない。追加する箱は solid（コライダあり）。

/** 箱同士の重なり（margin だけ膨らませて判定） */
export function boxesOverlap(a: Box, b: Box, margin = 0): boolean {
  return a.min[0] < b.max[0] + margin && a.max[0] > b.min[0] - margin
    && a.min[1] < b.max[1] + margin && a.max[1] > b.min[1] - margin
    && a.min[2] < b.max[2] + margin && a.max[2] > b.min[2] - margin;
}

/** 追加候補 b が置けるか: 矩形の内側（margin）にあり、ソケット・着地点から離れ、fromIndex 以降のソリッド箱と重ならない */
export function canPlaceProp(c: FurnishCtx, b: Box, fromIndex: number, opts: { margin?: number; socketRadius?: number; gap?: number } = {}): boolean {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const m = opts.margin ?? 0.15;
  if (!c.rects.some((r) => b.min[0] >= r.x0 + m && b.max[0] <= r.x1 - m && b.min[2] >= r.z0 + m && b.max[2] <= r.z1 - m)) return false;
  if (!free(c, cx, cz, opts.socketRadius ?? 1.3)) return false;
  const gap = opts.gap ?? 0.1;
  for (let i = fromIndex; i < c.L.boxes.length; i++) {
    const o = c.L.boxes[i];
    if (o.solid && boxesOverlap(o, b, gap)) return false;
  }
  return true;
}

/** 座面の高さの箱（机・テーブル）か */
export function isTableLike(b: Box): boolean {
  const h = b.max[1] - b.min[1];
  const w = b.max[0] - b.min[0];
  const d = b.max[2] - b.min[2];
  return b.solid && b.min[1] < 0.05 && h > 0.68 && h < 0.9 && Math.max(w, d) > 1.1 && Math.min(w, d) > 0.6;
}

/** 壁沿い配置用の辺。face は壁の室内面座標（horizontal なら z、縦なら x）、inward は室内向き（±1）、a0..a1 は辺に沿った範囲 */
export interface WallEdge { horizontal: boolean; face: number; inward: 1 | -1; a0: number; a1: number }

/** 壁の室内面から offset 離して、辺に沿った位置 at から len、奥行き depth の箱を作る */
export function alongWall(e: WallEdge, at: number, len: number, depth: number, y0: number, y1: number, mat: MatId, kind?: string, solid = true, offset = 0): Box {
  const near = e.face + e.inward * offset;
  const far = e.face + e.inward * (offset + depth);
  const b = e.horizontal
    ? box([at, y0, Math.min(near, far)], [at + len, y1, Math.max(near, far)], mat, solid)
    : box([Math.min(near, far), y0, at], [Math.max(near, far), y1, at + len], mat, solid);
  if (kind) b.kind = kind;
  return b;
}

/**
 * 社員食堂（C09）のプロップ: 長机（既存パターンに机が無いときだけ）+ 椅子 + 配膳カウンター + 自販機 + 観葉植物 + ゴミ箱。
 * pr は既存の乱数列から fork した専用 Rng。fromIndex はシェルの末尾（内装の先頭）。
 */
export function furnishCafeteriaProps(c: FurnishCtx, pr: Rng, fromIndex: number): void {
  const B = c.L.boxes;
  const r = c.rects[0];
  const ir = inner(r, 1.2);
  // 既存の机・島に kind を付ける（テーブル相当）
  for (let i = fromIndex; i < B.length; i++) if (!B[i].kind && isTableLike(B[i])) B[i].kind = 'table';
  let tables = B.slice(fromIndex).filter((b) => b.kind === 'table');
  // 長机: 3.6 × 0.75 × 1.1（dining_table が 2 台並ぶ寸法）。x 方向の列を 3.2 m 間隔で
  if (tables.length < 2 && ir.x1 - ir.x0 > 5 && ir.z1 - ir.z0 > 4) {
    const alongX = ir.x1 - ir.x0 >= ir.z1 - ir.z0;
    const len = 3.6, dep = 1.1, hgt = 0.75, pitch = 3.2;
    const spanA = alongX ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
    const rows = Math.max(1, Math.floor((spanA - 1.0) / pitch));
    const offA = (spanA - rows * pitch) / 2 + pitch / 2;
    const spanL = alongX ? ir.x1 - ir.x0 : ir.z1 - ir.z0;
    const cols = Math.max(1, Math.floor(spanL / (len + 1.4)));
    const offL = (spanL - cols * (len + 1.4)) / 2 + (len + 1.4) / 2;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = (alongX ? ir.z0 : ir.x0) + offA + i * pitch + pr.float(-0.1, 0.1);
        const l = (alongX ? ir.x0 : ir.z0) + offL + j * (len + 1.4) + pr.float(-0.15, 0.15);
        const b = alongX
          ? kinded([l - len / 2, 0, a - dep / 2], [l + len / 2, hgt, a + dep / 2], 'furnitureLight', 'table')
          : kinded([a - dep / 2, 0, l - len / 2], [a + dep / 2, hgt, l + len / 2], 'furnitureLight', 'table');
        if (!canPlaceProp(c, b, fromIndex, { socketRadius: 1.6, gap: 0.6 })) continue;
        B.push(b);
      }
    }
    tables = B.slice(fromIndex).filter((b) => b.kind === 'table');
  }
  // 椅子: 机の長辺の両側に 0.7 m 間隔（0.6 × 0.9 × 0.6。学校椅子・モノブロック・ダイニングチェアが収まる寸法）
  const chair = 0.6, ch = 0.9;
  for (const t of tables) {
    const w = t.max[0] - t.min[0];
    const d = t.max[2] - t.min[2];
    const alongX = w >= d;
    const len = alongX ? w : d;
    const n = Math.max(1, Math.floor((len - 0.4) / 0.75));
    const step = len / n;
    for (let k = 0; k < n; k++) {
      const l = (alongX ? t.min[0] : t.min[2]) + step * (k + 0.5);
      for (const side of [-1, 1]) {
        if (pr.chance(0.12)) continue; // 抜けた席
        const off = pr.float(-0.04, 0.04);
        const b = alongX
          ? kinded([l - chair / 2 + off, 0, side > 0 ? t.max[2] + 0.05 : t.min[2] - 0.05 - chair], [l + chair / 2 + off, ch, side > 0 ? t.max[2] + 0.05 + chair : t.min[2] - 0.05], 'furnitureDark', 'chair')
          : kinded([side > 0 ? t.max[0] + 0.05 : t.min[0] - 0.05 - chair, 0, l - chair / 2 + off], [side > 0 ? t.max[0] + 0.05 + chair : t.min[0] - 0.05, ch, l + chair / 2 + off], 'furnitureDark', 'chair');
        if (!canPlaceProp(c, b, fromIndex, { socketRadius: 1.1, gap: 0.05, margin: 0.3 })) continue;
        B.push(b);
      }
    }
  }
  // 配膳カウンター（壁沿い。入口 = 南辺 z0 以外の辺）+ 自販機 2 台 + ゴミ箱。face は壁の室内面、inward は室内向き
  const edges: WallEdge[] = [
    { horizontal: true, face: r.z1 - 0.15, inward: -1, a0: r.x0 + 0.5, a1: r.x1 - 0.5 },
    { horizontal: false, face: r.x0 + 0.15, inward: 1, a0: r.z0 + 0.5, a1: r.z1 - 0.5 },
    { horizontal: false, face: r.x1 - 0.15, inward: -1, a0: r.z0 + 0.5, a1: r.z1 - 0.5 },
  ];
  const counterEdge = pr.pick(edges);
  {
    const e = counterEdge;
    const span = e.a1 - e.a0;
    const len = Math.min(4.2, span - 1);
    const at = e.a0 + pr.float(0.5, Math.max(0.5, span - len - 0.5));
    const b = alongWall(e, at, len, 0.7, 0, 0.9, 'furnitureLight', 'cabinet');
    if (canPlaceProp(c, b, fromIndex, { socketRadius: 1.4, gap: 0.3, margin: 0.1 })) {
      B.push(b);
      // カウンター上の小物（書類・トレイのコンテナ相当。非ソリッド）
      for (let k = 0; k < 2; k++) {
        const u = pr.float(0.4, len - 0.8);
        const kind = k === 0 ? 'papers' : 'crate';
        const sw = kind === 'papers' ? 0.7 : 0.55, sd = kind === 'papers' ? 0.45 : 0.45, sh = kind === 'papers' ? 0.03 : 0.3;
        B.push(alongWall(e, at + u, sw, sd, 0.9, 0.9 + sh, 'furnitureDark', kind, false, (0.7 - sd) / 2));
      }
    }
  }
  // 自販機（0.9 × 1.9 × 0.8 + 前面の発光箔）: カウンターと別の辺
  const vendEdge = pr.pick(edges.filter((e) => e !== counterEdge));
  {
    const e = vendEdge;
    const span = e.a1 - e.a0;
    const at0 = e.a0 + pr.float(0.4, Math.max(0.4, span - 2.2));
    for (let k = 0; k < 2; k++) {
      const at = at0 + k * 1.0;
      const b = alongWall(e, at, 0.9, 0.8, 0, 1.9, 'furnitureDark', 'vending');
      if (!canPlaceProp(c, b, fromIndex, { socketRadius: 1.4, gap: 0.2, margin: 0.1 })) continue;
      B.push(b);
      // 前面パネル（非ソリッド。室内側の面から 2 cm）
      B.push(alongWall(e, at + 0.1, 0.7, 0.02, 0.5, 1.7, 'lightPanel', undefined, false, 0.8));
    }
    // ゴミ箱 2 つ（自販機の横）
    for (let k = 0; k < 2; k++) {
      const at = at0 - 0.6 - k * 0.5;
      const b = alongWall(e, at, 0.45, 0.45, 0, 0.8, 'furnitureDark', 'bin');
      if (!canPlaceProp(c, b, fromIndex, { socketRadius: 1.2, gap: 0.05, margin: 0.1 })) continue;
      B.push(b);
    }
  }
  // 観葉植物（隅。0.6 × 1.4 × 0.6）
  const corners: [number, number][] = [[r.x0 + 0.5, r.z0 + 0.5], [r.x1 - 1.1, r.z0 + 0.5], [r.x0 + 0.5, r.z1 - 1.1], [r.x1 - 1.1, r.z1 - 1.1]];
  for (const [x, z] of pr.shuffle(corners).slice(0, 3)) {
    const b = kinded([x, 0, z], [x + 0.6, 1.4, z + 0.6], 'plant', 'plant');
    if (!canPlaceProp(c, b, fromIndex, { socketRadius: 1.5, gap: 0.1, margin: 0.1 })) continue;
    B.push(b);
  }
}

export { DOOR_W, DOOR_H, WIDE_W };
export type { WallSpan };
