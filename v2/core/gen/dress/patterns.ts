/**
 * 家具の並べ方の型（v1 generators/common.ts の patternColumns / Islands / Rows / Partitions / Perimeter・furnishGeneric・
 * canPlaceProp を移植）。
 *
 * - v1 は「塊を置いてから扉前を消す（clearDoorways）」だったが、v2 は 1 つずつ ctx.placeUnit で確かめてから置く
 * - v1 の塊（kind 'desk' / 'table' / 'sofa' / 'shelf' / 'cabinet' の箱）は描画側で模型に置き換わっていた。v2 は箱をそのまま描くので、
 *   既定の作り方（build）で本物らしい家具（天板 + 脚・座 + 背）に組む。呼ぶ側が build を渡せば好きな物に替えられる
 * - 高さは床から。乱数は c.rng
 */
import type { Dir } from '../../math/vec.ts';
import { rectArea, type Rect } from '../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId } from '../../world/layout.ts';
import { build, canPlace, maybe, occupancy, placeUnit, reserve, splitByZones, type DressCtx, type PlaceOpts } from './ctx.ts';
import { cabinet, lowTable, sofa, wallShelf } from './props.ts';
import { chair, gid, longTable, tagGroup } from './furniture.ts';
import { boxesOverlap, freeRuns, innerRect, type Face } from './geom.ts';

/** 開口の位置から radius 以内か（v1 clearOfSockets の逆） */
export function nearOpening(c: DressCtx, x: number, z: number, radius: number): boolean {
  return c.openings.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < radius);
}

/** 置き場所の点が空いているか（v1 common.free: 開口から radius 以上、予約した範囲の 1 m 外） */
export function free(c: DressCtx, x: number, z: number, radius = 1.6): boolean {
  if (nearOpening(c, x, z, radius)) return false;
  return !c.keepOut.some((q) => x > q.min[0] - 1 && x < q.max[0] + 1 && z > q.min[2] - 1 && z < q.max[2] + 1);
}

/** 追加候補 b が置けるか（v1 canPlaceProp）: 矩形の内側（margin）、開口から socketRadius 以上、先の当たる物と gap 以上離れる */
export function canPlaceProp(c: DressCtx, b: Box, opts: { margin?: number; socketRadius?: number; gap?: number } = {}): boolean {
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  if (!free(c, cx, cz, opts.socketRadius ?? 1.3)) return false;
  const o: PlaceOpts = { margin: opts.margin ?? 0.15, gap: opts.gap ?? 0.1 };
  return canPlace(c, [b], o);
}

/** 座面の高さの箱（机・テーブル）か（v1 isTableLike） */
export function isTableLike(b: Box): boolean {
  const h = b.max[1] - b.min[1];
  const w = b.max[0] - b.min[0];
  const d = b.max[2] - b.min[2];
  return b.solid && b.min[1] < 0.05 && h > 0.68 && h < 0.9 && Math.max(w, d) > 1.1 && Math.min(w, d) > 0.6;
}

// ---------------------------------------------------------------- 柱

/** 柱グリッド（大部屋）。柱は天井まで届く建物の一部なので density に依らない。置いた本数を返す */
export function patternColumns(c: DressCtx, spacing = 7, size = 0.6, mat: MatId = 'columnConcrete', margin = 1.0): number {
  let n = 0;
  const s = size / 2;
  for (const r of c.rects) {
    const ir = innerRect(r, margin);
    for (let x = ir.x0 + spacing / 2; x < ir.x1; x += spacing) {
      for (let z = ir.z0 + spacing / 2; z < ir.z1; z += spacing) {
        if (!free(c, x, z, 1.4)) continue;
        const from: Box[] = [];
        from.push(box([x - s, 0, z - s], [x + s, c.h, z + s], mat));
        from.push(box([x - s - 0.02, 0, z - s - 0.02], [x + s + 0.02, 0.1, z + s + 0.02], 'metalDark', false));
        tagGroup(from, 0, gid('column', x, z), 'column');
        if (placeUnit(c, from)) n++;
      }
    }
  }
  return n;
}

// ---------------------------------------------------------------- 島

/** 島の作り方: 中心 (x, z)、半幅 sx・sz の範囲に物を組む */
export type IslandBuild = (B: Box[], x: number, z: number, sx: number, sz: number) => void;

/** v1 の島の既定（低い塊 + kind）。mats から材質を選ぶ */
const blockIsland = (c: DressCtx, mats: MatId[], kind?: string): IslandBuild => (B, x, z, sx, sz) => {
  const b = box([x - sx, 0, z - sz], [x + sx, c.rng.float(0.45, 1.1), z + sz], c.rng.pick(mats));
  if (kind) b.kind = kind;
  B.push(b);
};

/** テーブル島: テーブル 1 卓と、長辺の両側に椅子 */
export const tableIsland = (c: DressCtx, mat: MatId = 'furnitureLight', seat: MatId = 'seatBlue'): IslandBuild => (B, x, z, sx, sz) => {
  const alongX = sx >= sz;
  const len = Math.min(3.6, Math.max(1.2, (alongX ? sx : sz) * 2 - 0.9));
  const dep = Math.min(1.2, Math.max(0.75, (alongX ? sz : sx) * 2 - 1.4));
  longTable(B, x, z, alongX, len, dep, 0.72, mat);
  const n = Math.max(1, Math.floor((len - 0.3) / 0.7));
  for (let k = 0; k < n; k++) {
    const t = -len / 2 + (len / n) * (k + 0.5);
    for (const side of [-1, 1]) {
      if (c.rng.chance(0.15)) continue;
      const off = dep / 2 + 0.3;
      const px = alongX ? x + t : x + side * off;
      const pz = alongX ? z + side * off : z + t;
      const facing: Dir = alongX ? (side > 0 ? 2 : 0) : (side > 0 ? 3 : 1);
      chair(B, px, pz, facing, seat);
    }
  }
};

/** ソファ島: 低い卓をはさんで向かい合うソファ 2 脚 */
export const sofaIsland = (c: DressCtx, mat: MatId = 'upholstery'): IslandBuild => (B, x, z, sx, sz) => {
  const alongX = sx >= sz;
  const len = Math.min(2.4, Math.max(1.4, (alongX ? sx : sz) * 2 - 0.4));
  lowTable(B, x, z, alongX ? len * 0.6 : 0.6, alongX ? 0.6 : len * 0.6, 0.42, 'furnitureDark');
  const off = 0.3 + 0.45 + 0.1;
  if (alongX) { sofa(B, x, z - off, len, 0, mat); if (!c.rng.chance(0.25)) sofa(B, x, z + off, len, 2, mat); }
  else { sofa(B, x - off, z, len, 1, mat); if (!c.rng.chance(0.25)) sofa(B, x + off, z, len, 3, mat); }
};

/**
 * 家具島（v1 patternIslands）: 矩形ごとに面積 × density 個、乱数の位置・大きさで置く。build を省くと v1 と同じ低い塊（mats・kind）。
 * 置いた数を返す
 */
export function patternIslands(c: DressCtx, density = 1 / 35, mats: MatId[] = ['furnitureLight', 'furnitureDark'], kind?: string, make?: IslandBuild, opts: PlaceOpts = { gap: 0.9 }): number {
  const mk = make ?? blockIsland(c, mats, kind);
  let placed = 0;
  for (const r of c.rects) {
    const ir = innerRect(r, 1.2);
    if (ir.x1 - ir.x0 < 1 || ir.z1 - ir.z0 < 1) continue;
    const n = Math.round(rectArea(ir) * density);
    for (let i = 0; i < n; i++) {
      const x = c.rng.float(ir.x0, ir.x1);
      const z = c.rng.float(ir.z0, ir.z1);
      const sx = c.rng.float(0.5, 1.6);
      const sz = c.rng.float(0.5, 1.6);
      if (!free(c, x, z)) continue;
      if (x - sx < ir.x0 || x + sx > ir.x1 || z - sz < ir.z0 || z + sz > ir.z1) continue;
      if (!c.rng.chance(occupancy(c))) continue;
      if (build(c, (B) => mk(B, x, z, sx, sz), opts)) placed++;
    }
  }
  return placed;
}

// ---------------------------------------------------------------- 列

export interface RowOpts {
  /** 列の間隔（中心どうし） */
  spacing: number;
  /** 列の奥行き */
  depth: number;
  height: number;
  mat: MatId;
  /** この長さごとに 1.2 m の切れ目を入れる */
  gapEvery?: number;
  margin?: number;
  /** 'x' なら x 方向に伸びる列を z 間隔で並べる */
  axis?: 'x' | 'z';
  /** 天板（非ソリッドの 4 cm） */
  top?: MatId;
  kind?: string;
  /** 1 区切りの作り方（x0..x1 × z0..z1 の範囲）。省くと v1 と同じ塊 + 天板 */
  build?: (B: Box[], x0: number, z0: number, x1: number, z1: number) => void;
  /** 置く範囲の矩形（省くと足跡の矩形ごと） */
  rects?: Rect[];
  /** 扉前で切った切れ端の最短（既定 1.0 m） */
  minLen?: number;
}

/** 列（机・棚・座席。v1 patternRows）。開口の近くの区切りは置かない。置いた区切りの数を返す */
export function patternRows(c: DressCtx, o: RowOpts): number {
  const axis = o.axis ?? 'x';
  let placed = 0;
  const mk = o.build ?? ((B: Box[], x0: number, z0: number, x1: number, z1: number) => {
    const b = box([x0, 0, z0], [x1, o.height, z1], o.mat);
    if (o.kind) b.kind = o.kind;
    B.push(b);
    if (o.top) B.push(box([x0, o.height, z0], [x1, o.height + 0.04, z1], o.top, false));
  });
  const occ = occupancy(c);
  for (const r of o.rects ?? c.rects) {
    const ir = innerRect(r, o.margin ?? 1.4);
    const segLen = o.gapEvery ?? Infinity;
    // 列は中央に寄せる（v1 は端から spacing / 2 で始めて片側が空いた）。区切りは扉前・keepOut の所で切る
    // （v1 は開口に近い区切りを丸ごと除いていた）
    const W = axis === 'x' ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
    if (W < o.depth) continue;
    const n = Math.floor((W - o.depth) / o.spacing + 1e-6) + 1;
    const first = (axis === 'x' ? ir.z0 : ir.x0) + (W - ((n - 1) * o.spacing + o.depth)) / 2 + o.depth / 2;
    const centers = Array.from({ length: n }, (_, i) => first + i * o.spacing);
    if (axis === 'x') {
      for (const z of centers) {
        for (let x0 = ir.x0; x0 < ir.x1 - 0.5; x0 += segLen + 1.2) {
          for (const [p0, p1] of splitByZones(c, 'x', x0, Math.min(ir.x1, x0 + segLen), z - o.depth / 2 - 0.6, z + o.depth / 2 + 0.6, 0.3, o.minLen ?? 1.0)) {
            if (!c.rng.chance(occ)) continue;
            if (build(c, (B) => mk(B, p0, z - o.depth / 2, p1, z + o.depth / 2))) placed++;
          }
        }
      }
    } else {
      for (const x of centers) {
        for (let z0 = ir.z0; z0 < ir.z1 - 0.5; z0 += segLen + 1.2) {
          for (const [p0, p1] of splitByZones(c, 'z', z0, Math.min(ir.z1, z0 + segLen), x - o.depth / 2 - 0.6, x + o.depth / 2 + 0.6, 0.3, o.minLen ?? 1.0)) {
            if (!c.rng.chance(occ)) continue;
            if (build(c, (B) => mk(B, x - o.depth / 2, p0, x + o.depth / 2, p1))) placed++;
          }
        }
      }
    }
  }
  return placed;
}

// ---------------------------------------------------------------- 間仕切り

/** 間仕切りの開口を通る人の帯（開口の中心 ±0.45 m × 壁の前後 PASS_DEPTH） */
const PASS_HALF = 0.45;
const PASS_DEPTH = 1.6;

/** 間仕切り（alongX: z = t に x 方向へ伸びる）の開口を a に開けたとき、通る帯に段差より高い当たる物が無いか */
function passClear(c: DressCtx, alongX: boolean, t: number, a: number): boolean {
  const lo: [number, number] = alongX ? [a - PASS_HALF, t - PASS_DEPTH] : [t - PASS_DEPTH, a - PASS_HALF];
  const hi: [number, number] = alongX ? [a + PASS_HALF, t + PASS_DEPTH] : [t + PASS_DEPTH, a + PASS_HALF];
  const probe = box([lo[0], 0.35, lo[1]], [hi[0], 1.7, hi[1]], 'void', true);
  for (const u of c.units) if (u.solid) for (const b of u.boxes) if (b.solid && boxesOverlap(b, probe)) return false;
  return !c.fixed.some((b) => boxesOverlap(b, probe));
}

/**
 * 間仕切り壁（v1 patternPartitions: 主の矩形を 2〜4 区画に分ける。1.6 m の通り抜けを残す）。
 * 開口は乱数の位置から 0.25 m 刻みで左右に探し、先に置いた物で塞がらない位置に開ける。開口とその前後は予約（c.zones）し、
 * 後から置く物が避ける。扉前・keepOut に掛かる所は壁を切る。置いた壁の数を返す
 */
export function patternPartitions(c: DressCtx, count: number, height: number, mat: MatId, thick = 0.12): number {
  const r = c.rects[0];
  if (!r) return 0;
  const ir = innerRect(r, 0);
  const alongX = c.rng.chance(0.5);
  let n = 0;
  for (let i = 1; i <= count; i++) {
    const t = alongX ? ir.z0 + ((ir.z1 - ir.z0) * i) / (count + 1) : ir.x0 + ((ir.x1 - ir.x0) * i) / (count + 1);
    const g0 = alongX ? ir.x0 + 1.5 : ir.z0 + 1.5, g1 = alongX ? ir.x1 - 1.5 : ir.z1 - 1.5;
    if (g1 <= g0) continue;
    const drawn = c.rng.float(g0, g1);
    let gapAt = drawn;
    for (let k = 0; k * 0.25 <= g1 - g0; k++) {
      const a = drawn + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25;
      if (a < g0 || a > g1) continue;
      if (passClear(c, alongX, t, a)) { gapAt = a; break; }
    }
    reserve(c, alongX
      ? { min: [gapAt - 0.8, 0, t - PASS_DEPTH], max: [gapAt + 0.8, 2.2, t + PASS_DEPTH] }
      : { min: [t - PASS_DEPTH, 0, gapAt - 0.8], max: [t + PASS_DEPTH, 2.2, gapAt + 0.8] });
    const segs: [number, number][] = alongX ? [[ir.x0 + WALL_T, gapAt - 0.8], [gapAt + 0.8, ir.x1 - WALL_T]] : [[ir.z0 + WALL_T, gapAt - 0.8], [gapAt + 0.8, ir.z1 - WALL_T]];
    for (const [a, b] of segs) {
      // 扉前・keepOut・予約に掛かる所は切る
      let pieces: [number, number][] = [[a, b]];
      for (const z of c.zones) {
        const zc0 = alongX ? z.min[2] : z.min[0], zc1 = alongX ? z.max[2] : z.max[0];
        if (t + thick / 2 <= zc0 || t - thick / 2 >= zc1) continue;
        const za0 = alongX ? z.min[0] : z.min[2], za1 = alongX ? z.max[0] : z.max[2];
        pieces = pieces.flatMap(([p, q]): [number, number][] => (q <= za0 || p >= za1 ? [[p, q]] : [[p, Math.min(q, za0)], [Math.max(p, za1), q]]));
      }
      for (const [p0, p1] of pieces) {
        if (p1 - p0 < 0.6) continue;
        const wall = alongX ? box([p0, 0, t - thick / 2], [p1, height, t + thick / 2], mat) : box([t - thick / 2, 0, p0], [t + thick / 2, height, p1], mat);
        wall.kind = 'partition';
        const B: Box[] = [wall];
        // 笠木（上端の見切り）
        B.push(alongX ? box([p0, height - 0.03, t - thick / 2 - 0.01], [p1, height, t + thick / 2 + 0.01], 'metal', false) : box([t - thick / 2 - 0.01, height - 0.03, p0], [t + thick / 2 + 0.01, height, p1], 'metal', false));
        if (placeUnit(c, B)) n++;
      }
    }
  }
  return n;
}

// ---------------------------------------------------------------- 壁沿い

/** 壁沿いの 1 区切りの作り方: 面 f の at..at+len に置く */
export type PerimeterBuild = (B: Box[], f: Face, at: number, len: number) => void;

/**
 * 壁沿いの家具（ロッカー・カウンター・棚。v1 patternPerimeter）: 壁の室内面ごとに 2.0 m の区切りを 0.1 m 間隔で並べる。
 * 面ごとに skip の確率で飛ばす。v1 は矩形の内側の辺に沿わせていたが、v2 は本物の壁（innerFaces）だけに沿わせる
 * （L 字のつなぎ目に家具の列を作らない）。置いた区切りの数を返す
 */
export function patternPerimeter(c: DressCtx, depth: number, height: number, mat: MatId, skip = 0.3, kind?: string, make?: PerimeterBuild, seg = 2.0): number {
  const mk: PerimeterBuild = make ?? ((B, f, at, len) => {
    const s = c.standoff;
    const n0 = f.face + f.inward * s, n1 = f.face + f.inward * (s + depth);
    const b = f.horizontal ? box([at, 0, Math.min(n0, n1)], [at + len, height, Math.max(n0, n1)], mat) : box([Math.min(n0, n1), 0, at], [Math.max(n0, n1), height, at + len], mat);
    if (kind) b.kind = kind;
    B.push(b);
  });
  let placed = 0;
  for (const f of c.faces) {
    if (c.rng.chance(skip)) continue;
    for (const [a0, a1] of freeRuns(f, c.openings, 1.0)) {
      const usable = a1 - a0 - 0.3;
      const n = Math.floor((usable + 0.1) / (seg + 0.1));
      if (n <= 0) continue;
      const start = a0 + 0.15 + (usable - (n * (seg + 0.1) - 0.1)) / 2;
      for (let k = 0; k < n; k++) {
        const at = start + k * (seg + 0.1);
        if (!c.rng.chance(occupancy(c))) continue;
        if (build(c, (B) => mk(B, f, at, seg))) placed++;
      }
    }
  }
  return placed;
}

// ---------------------------------------------------------------- 汎用の部屋

export type GenericStyle = 'office' | 'plain' | 'retail' | 'soft';

/**
 * 大部屋の汎用の型（v1 furnishGeneric）。面積に応じて柱を立て、間仕切り / 島 / 列 / 壁沿い / 空 のどれかを置く。
 * v1 の塊の代わりに、島はテーブル + 椅子・ソファの組、列は机・長机、壁沿いは戸棚・棚にする
 */
export function furnishGeneric(c: DressCtx, area: number, style: GenericStyle): void {
  if (area > 150) patternColumns(c, c.rng.chance(0.5) ? 7 : 8.5);
  const roll = c.rng.next();
  if (area > 120 && roll < 0.3) {
    patternPartitions(c, area > 300 ? 3 : 2, c.rng.chance(0.5) ? Math.min(2.2, c.h) : c.h, 'wallWhite');
    patternIslands(c, 1 / 60, undefined, 'table', tableIsland(c));
  } else if (roll < 0.55) {
    patternIslands(c, style === 'soft' ? 1 / 28 : 1 / 40, undefined, style === 'soft' ? 'sofa' : 'table', style === 'soft' ? sofaIsland(c) : tableIsland(c));
  } else if (roll < 0.75) {
    const office = style === 'office';
    patternRows(c, office
      ? { spacing: 3.2, depth: 1.4, height: 0.75, mat: 'furnitureLight', gapEvery: 6, kind: 'desk', build: (B, x0, z0, x1, z1) => rowTables(c, B, x0, z0, x1, z1, true) }
      : { spacing: 4, depth: 0.9, height: 0.8, mat: 'furnitureDark', gapEvery: 5, kind: 'table', build: (B, x0, z0, x1, z1) => rowTables(c, B, x0, z0, x1, z1, false) });
  }
  // 壁沿い（v1 では 15% の型。広い部屋は他の型に重ねる: v1 の「面積に応じて 1〜2 パターン重ねる」）
  const perimeter = roll >= 0.75 && roll < 0.9;
  if (perimeter || (roll >= 0.9 && maybe(c, 0.5)) || (area > 100 && maybe(c, 0.45))) {
    const retail = style === 'retail';
    patternPerimeter(c, retail ? 0.5 : 0.45, retail ? 1.8 : 1.0, retail ? 'shelfMetal' : 'furnitureDark', perimeter ? 0.3 : 0.55, retail ? 'shelf' : 'cabinet', retail
      ? (B, f, at, len) => wallShelf(B, c.rng, f, at, len, 0.5, Math.min(1.8, c.h - 0.3), 'shelfMetal', 'goods', c.standoff)
      : (B, f, at, len) => cabinet(B, f, at, len, 0.45, 0.9, c.rng.chance(0.5) ? 'furnitureDark' : 'furnitureLight', c.standoff));
  }
  // 広い部屋は島も重ねる（列・間仕切りの部屋の空いた所にテーブルやソファ）
  if (area > 100 && roll >= 0.55 && maybe(c, 0.5)) patternIslands(c, 1 / 70, undefined, style === 'soft' ? 'sofa' : 'table', style === 'soft' ? sofaIsland(c) : tableIsland(c));
  // 残り: 空（がらんどう）
}

/** 列の 1 区切りを机（または長机）と椅子で埋める。office なら背中合わせの 2 列 */
function rowTables(c: DressCtx, B: Box[], x0: number, z0: number, x1: number, z1: number, office: boolean): void {
  const alongX = x1 - x0 >= z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const dep = alongX ? z1 - z0 : x1 - x0;
  const n = Math.max(1, Math.floor(len / 1.6));
  const step = len / n;
  const cc = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
  for (let k = 0; k < n; k++) {
    const a = (alongX ? x0 : z0) + step * (k + 0.5);
    const tw = step - 0.1;
    const td = office ? dep / 2 : dep;
    for (const side of office ? [-1, 1] : [0]) {
      const center = cc + side * (td / 2);
      const x = alongX ? a : center, z = alongX ? center : a;
      longTable(B, x, z, alongX, tw, td, 0.72, office ? 'furnitureLight' : 'furnitureDark');
      const sides = office ? [side] : [-1, 1];
      for (const s of sides) {
        if (c.rng.chance(0.18)) continue;
        const off = td / 2 + 0.32;
        const px = alongX ? a : center + s * off, pz = alongX ? center + s * off : a;
        const facing: Dir = alongX ? (s > 0 ? 2 : 0) : (s > 0 ? 3 : 1);
        chair(B, px, pz, facing, office ? 'seatBlue' : 'furnitureDark');
      }
    }
  }
}

