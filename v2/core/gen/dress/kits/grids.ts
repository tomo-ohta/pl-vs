/**
 * 棚・ラック・壁の反復で埋める空間: 倉庫・貸し倉庫・サーバー室・図書館（書架）・スーパー（陳列棚の格子）・迷路の壁
 * （v1 GridGenerator の shelves / warehouseDress / rollCages / maze を移植）。
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { build, maybe, occupancy, placeNear, placeUnit, splitByZones, type DressCtx } from '../ctx.ts';
import { addDecor, wallBands, wallDetails } from '../decor.ts';
import { chair, floorLine, longTable, rack, rollCage } from '../furniture.ts';
import { alongFace, facePoint, freeRuns, innerRect, longX } from '../geom.ts';
import { patternColumns } from '../patterns.ts';
import { cabinet, coolerCase, crate, desk, lamp, officeChair, pallet, reception, serverRow, shelfIsland, sofa, wallShelf } from '../props.ts';
import { cornerPlants, count, entrance, faceOf, lineUp, mainRect, onSomeWall, oppositeFace, skirting, wallExtras } from './common.ts';

/** 棚の列の作り方（v1 ShelfSpec） */
interface Shelves {
  aisle: number;
  depth: number;
  height: number;
  segment: number;
  margin: number;
  axis: 'x' | 'z';
  /** 1 区切りを組む（x0..x1 × z0..z1） */
  make: (B: Box[], x0: number, z0: number, x1: number, z1: number) => void;
}

/**
 * 棚の列（v1 shelves）: axis の向きに伸びる列を pitch（通路 + 奥行き）で並べ、segment ごとに 1.2 m の切れ目を入れる。
 * 開口に近い区切りは置かない。列の中心の座標を返す（通路の線・灯りの基準）
 */
function shelfRows(c: DressCtx, r: Rect, s: Shelves): number[] {
  const ir = innerRect(r, s.margin);
  const pitch = s.aisle + s.depth;
  const rows: number[] = [];
  const occ = occupancy(c);
  // 列は横の範囲の中央に寄せる。区切りは扉前・keepOut の所で切り、その前後 0.5 m も空ける（扉から列の間へ入る通路）
  const W = s.axis === 'x' ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
  if (W < s.depth) return rows;
  const n = Math.floor((W - s.depth) / pitch + 1e-6) + 1;
  const first = (s.axis === 'x' ? ir.z0 : ir.x0) + (W - ((n - 1) * pitch + s.depth)) / 2 + s.depth / 2;
  const centers = Array.from({ length: n }, (_, i) => first + i * pitch);
  if (s.axis === 'x') {
    for (const z of centers) {
      rows.push(z);
      for (let x0 = ir.x0; x0 < ir.x1 - 1; x0 += s.segment + 1.2) {
        for (const [p0, p1] of splitByZones(c, 'x', x0, Math.min(ir.x1, x0 + s.segment), z - s.depth / 2 - 0.5, z + s.depth / 2 + 0.5, 0.5, 1.2)) {
          if (c.rng.chance(occ)) build(c, (B) => s.make(B, p0, z - s.depth / 2, p1, z + s.depth / 2));
        }
      }
    }
  } else {
    for (const x of centers) {
      rows.push(x);
      for (let z0 = ir.z0; z0 < ir.z1 - 1; z0 += s.segment + 1.2) {
        for (const [p0, p1] of splitByZones(c, 'z', z0, Math.min(ir.z1, z0 + s.segment), x - s.depth / 2 - 0.5, x + s.depth / 2 + 0.5, 0.5, 1.2)) {
          if (c.rng.chance(occ)) build(c, (B) => s.make(B, x - s.depth / 2, p0, x + s.depth / 2, p1));
        }
      }
    }
  }
  return rows;
}

/** 通路が入口から奥へ向かう向き（入口が z の面にあれば z 方向の列） */
function axisFromEntrance(c: DressCtx, r: Rect): 'x' | 'z' {
  const ef = faceOf(c, entrance(c));
  if (ef && ef.rect === r) return ef.horizontal ? 'z' : 'x';
  return longX(r) ? 'x' : 'z';
}

// ---------------------------------------------------------------- 倉庫

/** 倉庫（v1 WarehouseGrid）: スチールラックの列（段ボール）、列の両側の黄線、壁沿いのカゴ車、空いた所のパレット */
export function warehouse(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }, { y0: 0.1, y1: 0.4, mat: 'yellowLine', depth: 0.02 }]);
  if (c.area > 300) patternColumns(c, 9, 0.6);
  const height = Math.max(1.8, Math.min(c.h - 0.6, 3.3));
  const post = c.rng.pick<MatId>(['shelfMetal', 'lockerBlue', 'metalDark']);
  const beam = c.rng.pick<MatId>(['plasticYellow', 'redShutter', 'shelfMetal']);
  for (const r of c.rects) {
    const axis = c.rng.chance(0.5) ? 'x' : 'z';
    const spec: Shelves = { aisle: 2.5, depth: 1.2, height, segment: 9, margin: 1.4, axis, make: (B, x0, z0, x1, z1) => rack(B, c.rng, x0, z0, x1, z1, height, 0.7, post, beam) };
    const rows = shelfRows(c, r, spec);
    // 黄線: 各列の両側 0.35 m
    const ir = innerRect(r, 1.4);
    const B: Box[] = [];
    for (const m of rows) {
      for (const side of [-1, 1]) {
        const t = m + side * (spec.depth / 2 + 0.35);
        if (axis === 'x') floorLine(B, ir.x0, t - 0.05, ir.x1, t + 0.05, 'yellowLine');
        else floorLine(B, t - 0.05, ir.z0, t + 0.05, ir.z1, 'yellowLine');
      }
    }
    if (B.length) addDecor(c, B);
  }
  for (let i = 0; i < count(c, 2.5, 4); i++) onSomeWall(c, 1.1, (B, f, at) => rollCage(B, c.rng, f, at, c.standoff + 0.04), { pad: 1.4 });
  for (let i = 0; i < count(c, c.area / 70, 6); i++) {
    const r = c.rng.pick(c.rects);
    placeNear(c, c.rng.float(r.x0 + 1.5, r.x1 - 1.5), c.rng.float(r.z0 + 1.5, r.z1 - 1.5), (T, x, z) => pallet(T, c.rng, x, z, c.rng.chance(0.5), Math.min(1.8, c.h - 0.5)), 0.5, 2.0, { gap: 0.4 });
  }
}

// ---------------------------------------------------------------- 貸し倉庫・物置

/**
 * 貸し倉庫（v1 StorageGrid）: 背中合わせの区画の列（両面にシャッターと番号板）。小さな部屋は壁際の棚と段ボール
 */
export function storage(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }]);
  const r = mainRect(c);
  if (Math.min(r.x1 - r.x0, r.z1 - r.z0) < 7) {
    for (const f of c.faces) for (const [p, q] of freeRuns(f, c.openings, 0.9)) lineUp(c, p + 0.05, q - 0.05, 1.5, 0.05, (B, at) => wallShelf(B, c.rng, f, at, 1.5, 0.55, Math.min(2.2, c.h - 0.3), 'shelfMetal', 'boxes', c.standoff));
    for (let i = 0; i < count(c, 2.5, 5); i++) placeNear(c, c.rng.float(r.x0 + 1, r.x1 - 1), c.rng.float(r.z0 + 1, r.z1 - 1), (B, x, z) => crate(B, x, z, c.rng.float(0.45, 0.8), c.rng.float(0.3, 0.9), c.rng.chance(0.3) ? 'furnitureLight' : 'boxCardboard'), 0.3, 1.2, { gap: 0.2 });
    return;
  }
  const height = Math.max(2.0, Math.min(c.h - 0.4, 2.8));
  const shutter = c.rng.pick<MatId>(['redShutter', 'doorMetal', 'lockerBlue']);
  for (const q of c.rects) {
    shelfRows(c, q, {
      aisle: 2.2, depth: 2.4, height, segment: 12, margin: 1.4, axis: axisFromEntrance(c, q), make: (B, x0, z0, x1, z1) => {
        const alongX = x1 - x0 >= z1 - z0;
        B.push({ min: [x0, 0, z0], max: [x1, height, z1], mat: 'metal', solid: true, kind: 'storageUnit' });
        B.push({ min: [x0 - 0.01, height - 0.06, z0 - 0.01], max: [x1 + 0.01, height, z1 + 0.01], mat: 'metalDark', solid: false });
        const len = alongX ? x1 - x0 : z1 - z0;
        const n = Math.max(1, Math.floor(len / 1.5));
        const w = len / n;
        for (let k = 0; k < n; k++) {
          const a = (alongX ? x0 : z0) + k * w;
          for (const [side, s] of [[alongX ? z0 : x0, -1], [alongX ? z1 : x1, 1]] as const) {
            const q0 = side + s * 0.002, q1 = side + s * 0.02;
            const put = (p0: number, p1: number, y0: number, y1: number, m: MatId) => B.push(alongX ? { min: [p0, y0, Math.min(q0, q1)], max: [p1, y1, Math.max(q0, q1)], mat: m, solid: false } : { min: [Math.min(q0, q1), y0, p0], max: [Math.max(q0, q1), y1, p1], mat: m, solid: false });
            put(a + 0.12, a + w - 0.12, 0.02, Math.min(height - 0.3, 2.2), shutter);
            put(a + w / 2 - 0.12, a + w / 2 + 0.12, Math.min(height - 0.25, 2.25), Math.min(height - 0.1, 2.4), 'signPlate');
          }
        }
      },
    });
  }
  for (let i = 0; i < count(c, 1.5, 3); i++) onSomeWall(c, 1.1, (B, f, at) => rollCage(B, c.rng, f, at, c.standoff + 0.04), { pad: 1.4 });
}

// ---------------------------------------------------------------- サーバー室

/** サーバー室（v1 ServerGrid）: ラックの列（扉の目地と青い LED）、列の上のケーブルラック、壁際の空調機、入口の近くの監視卓 */
export function server(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }]);
  const height = Math.max(1.8, Math.min(c.h - 0.6, 2.2));
  // 監視卓（先に置いて、列が避ける）
  const ent = entrance(c);
  const ef = faceOf(c, ent);
  if (ent && ef) {
    const t = ef.horizontal ? ent.pos[0] : ent.pos[2];
    const side = c.rng.chance(0.5) ? 1 : -1;
    const [x, z] = facePoint(ef, t + side * 2.2, c.standoff + 1.9);
    placeNear(c, x, z, (B, px, pz) => {
      desk(B, px, pz, ef.dir, { w: 1.4, d: 0.7, screen: 'on' });
      const [cx, cz] = ef.horizontal ? [px, pz + (ef.dir === 0 ? -0.65 : 0.65)] : [px + (ef.dir === 1 ? -0.65 : 0.65), pz];
      officeChair(B, cx, cz, ef.dir, 'metalDark');
    }, 0.4, 1.6);
  }
  for (const r of c.rects) {
    const axis = axisFromEntrance(c, r);
    const rows = shelfRows(c, r, { aisle: 1.6, depth: 1.0, height, segment: 7, margin: 1.4, axis, make: (B, x0, z0, x1, z1) => serverRow(B, c.rng, x0, z0, x1, z1, height) });
    // ケーブルラック（列の上。当たらない）
    if (c.h - height > 0.5) {
      const ir = innerRect(r, 1.4);
      const B: Box[] = [];
      const y = Math.min(c.h - 0.15, height + 0.35);
      for (const m of rows) B.push(axis === 'x' ? { min: [ir.x0, y, m - 0.2], max: [ir.x1, y + 0.06, m + 0.2], mat: 'metal', solid: false } : { min: [m - 0.2, y, ir.z0], max: [m + 0.2, y + 0.06, ir.z1], mat: 'metal', solid: false });
      if (B.length) addDecor(c, B);
    }
  }
  // 空調機（白い大きな箱 + 吸気の格子）
  for (let i = 0; i < count(c, 1 + c.area / 80, 3); i++) {
    onSomeWall(c, 1.8, (B, f, at) => {
      B.push(alongFace(f, at, 1.8, c.standoff, c.standoff + 0.85, 0, Math.min(2.0, c.h - 0.3), 'paintWhite', true));
      for (let k = 0; k < 3; k++) B.push(alongFace(f, at + 0.15 + k * 0.55, 0.45, c.standoff + 0.85, c.standoff + 0.86, 0.9, 1.7, 'metalDark', false));
    }, { pad: 1.2 });
  }
}

// ---------------------------------------------------------------- 図書館

/**
 * 図書館（v1 ShelfGrid）: 入口の近くの貸出台、両面の書架の列（通路は入口から奥へ）、奥の端の閲覧の机と椅子
 * （長さが 9 m 以上の部屋。書架の列はその手前まで）、壁の本棚、一人掛けの椅子
 */
export function library(c: DressCtx): void {
  skirting(c, 'trim');
  const ent = entrance(c);
  const ef = faceOf(c, ent);
  const r = mainRect(c);
  const sh = Math.max(1.4, Math.min(2.2, c.h - 0.5));
  if (ent && ef) {
    const t = ef.horizontal ? ent.pos[0] : ent.pos[2];
    const side = c.rng.chance(0.5) ? 1 : -1;
    const [x, z] = facePoint(ef, t + side * 2.4, c.standoff + 2.0);
    const toward: Dir = ef.horizontal ? (side > 0 ? 3 : 1) : (side > 0 ? 2 : 0);
    placeNear(c, x, z, (B, px, pz) => reception(B, px, pz, 2.0, 0.7, toward, 'bookshelfWood', 'furnitureLight', 1.0), 0.4, 1.6);
  }
  for (const q of c.rects) {
    const axis = axisFromEntrance(c, q);
    const len = axis === 'x' ? q.x1 - q.x0 : q.z1 - q.z0;
    let shelfRect = q;
    // 閲覧の帯（列の奥の端 3.6 m。入口の面から遠い方）
    if (len >= 9 && q === r && c.area > 40) {
      const farHigh = ef && ef.rect === q ? (axis === 'x' ? ef.dir === 3 : ef.dir === 2) : c.rng.chance(0.5);
      const band = 3.6;
      shelfRect = axis === 'x'
        ? (farHigh ? { ...q, x1: q.x1 - band } : { ...q, x0: q.x0 + band })
        : (farHigh ? { ...q, z1: q.z1 - band } : { ...q, z0: q.z0 + band });
      const along = axis === 'x' ? (farHigh ? q.x1 - WALL_T - band / 2 : q.x0 + WALL_T + band / 2) : (farHigh ? q.z1 - WALL_T - band / 2 : q.z0 + WALL_T + band / 2);
      const c0 = (axis === 'x' ? q.z0 : q.x0) + WALL_T + 1.4, c1 = (axis === 'x' ? q.z1 : q.x1) - WALL_T - 1.4;
      const n = Math.max(1, Math.floor((c1 - c0 + 0.9) / 3.3));
      const start = (c0 + c1) / 2 - ((n - 1) * 3.3) / 2;
      // 机は列と直交（長辺が奥の壁と平行）
      const alongX = axis === 'z';
      for (let k = 0; k < n; k++) {
        const m = start + k * 3.3;
        const [x, z] = axis === 'x' ? [along, m] : [m, along];
        if (!c.rng.chance(Math.max(0.5, occupancy(c)))) continue;
        build(c, (B) => {
          longTable(B, x, z, alongX, 2.4, 1.0, 0.72, 'furnitureDark');
          lamp(B, x, z, 0.72);
          for (const s2 of [-1, 1]) for (const t of [-0.75, 0, 0.75]) {
            if (c.rng.chance(0.3)) continue;
            chair(B, alongX ? x + t : x + s2 * 0.82, alongX ? z + s2 * 0.82 : z + t, (alongX ? (s2 > 0 ? 2 : 0) : (s2 > 0 ? 3 : 1)) as Dir, 'furnitureDark');
          }
        });
      }
    }
    shelfRows(c, shelfRect, {
      aisle: c.rng.float(1.5, 1.9), depth: 0.6, height: sh, segment: 4.5, margin: 1.5, axis,
      make: (B, x0, z0, x1, z1) => shelfIsland(B, c.rng, x0, z0, x1, z1, sh, 'bookshelfWood', 'books'),
    });
  }
  for (const f of c.faces) {
    if (!maybe(c, 0.8)) continue;
    for (const [p, q] of freeRuns(f, c.openings, 1.0)) lineUp(c, p + 0.1, q - 0.1, 1.0, 0.02, (B, at) => wallShelf(B, c.rng, f, at, 1.0, 0.35, sh, 'bookshelfWood', 'books', c.standoff));
  }
  cornerPlants(c, count(c, 1, 2), 0.5, 1.2);
  if (maybe(c, 0.5)) placeNear(c, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (B, x, z) => sofa(B, x, z, 0.85, c.rng.pick([0, 1, 2, 3] as Dir[]), 'upholstery', 0.8), 0.5, 3);
  wallExtras(c, ['clock'], 1);
}

// ---------------------------------------------------------------- スーパー

/** スーパー（v1 RetailGrid）: 入口の側のレジの列、陳列棚の格子（通路は入口から奥へ、横の通路あり）、奥の壁の冷蔵ケース、横の壁の棚 */
export function supermarket(c: DressCtx): void {
  skirting(c, 'metalDark');
  const ent = entrance(c);
  const ef = faceOf(c, ent);
  const sh = Math.max(1.2, Math.min(1.7, c.h - 0.8));
  // レジ（入口の面に沿って 2〜5 台。入口の横から並べる）
  if (ent && ef) {
    const t = ef.horizontal ? ent.pos[0] : ent.pos[2];
    const n = Math.max(1, Math.min(5, Math.floor((ef.a1 - ef.a0) / 4)));
    let k = 0;
    for (const side of [1, -1]) {
      for (let i = 0; i < 6 && k < n; i++) {
        const a = t + side * (ent.width / 2 + 2.0 + i * 1.9);
        if (a < ef.a0 + 1 || a > ef.a1 - 1) break;
        const [x, z] = facePoint(ef, a, c.standoff + 2.6);
        if (build(c, (B) => {
          const alongX = !ef.horizontal;
          const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
          B.push({ min: [x - hx, 0, z - hz], max: [x + hx, 0.9, z + hz], mat: 'shelfMetal', solid: true, kind: 'checkout' });
          B.push({ min: [x - hx - 0.02, 0.9, z - hz - 0.02], max: [x + hx + 0.02, 0.93, z + hz + 0.02], mat: 'stainless', solid: false });
          B.push({ min: [x - 0.15, 0.93, z - 0.12], max: [x + 0.15, 1.2, z + 0.12], mat: 'screenDark', solid: false });
        })) k++;
      }
    }
  }
  const back = ef ? oppositeFace(c, ef) : null;
  if (back) {
    for (const [p, q] of freeRuns(back, c.openings, 1.0)) {
      if (q - p < 1.6) continue;
      for (let s = p + 0.1; s + 1.5 <= q - 0.1; s += 4.6) build(c, (B) => coolerCase(B, c.rng, back, s, Math.min(4.5, q - 0.1 - s), Math.min(2.0, c.h - 0.4), c.standoff));
    }
  }
  for (const q of c.rects) {
    shelfRows(c, q, {
      aisle: c.rng.float(1.8, 2.3), depth: 0.9, height: sh, segment: 6, margin: 1.8, axis: axisFromEntrance(c, q),
      make: (B, x0, z0, x1, z1) => shelfIsland(B, c.rng, x0, z0, x1, z1, sh, 'shelfMetal', 'goods', 'metalDark'),
    });
  }
  for (const f of c.faces) {
    if (f === ef || f === back || !maybe(c, 0.8)) continue;
    for (const [p, q] of freeRuns(f, c.openings, 1.0)) lineUp(c, p + 0.1, q - 0.1, 1.2, 0.05, (B, at) => wallShelf(B, c.rng, f, at, 1.2, 0.5, Math.min(1.9, c.h - 0.4), 'shelfMetal', 'goods', c.standoff));
  }
}

// ---------------------------------------------------------------- 迷路

/**
 * 迷路の壁（v1 maze: 再帰的バックトラックの全域木 + 15% の壁を抜いてループ）。cell 間隔の格子の内側の線に壁を立てる
 * （格子の外周は開いているので、部屋の外周の通路から必ずつながる）。壁 1 枚ずつを置く単位にし、扉前・keepOut に掛かる壁は置かない
 */
export function maze(c: DressCtx, cell: number, wallH: number, mat: MatId, pillars = 0): void {
  for (const r of c.rects) {
    const big = Math.min(r.x1 - r.x0, r.z1 - r.z0) > 12;
    const ir = innerRect(r, big ? 1.2 : 0.8);
    const nx = Math.floor((ir.x1 - ir.x0) / cell), nz = Math.floor((ir.z1 - ir.z0) / cell);
    // 格子が 4 マス以下だと迷路にならない（全域木で壁がほぼ消える）ので、袖壁と柱にする
    if (nx * nz <= 4) { wallStubs(c, r, wallH, mat); continue; }
    const NX = Math.max(1, nx), NZ = Math.max(1, nz);
    const ox = ir.x0 + ((ir.x1 - ir.x0) - NX * cell) / 2, oz = ir.z0 + ((ir.z1 - ir.z0) - NZ * cell) / 2;
    const visited = Array.from({ length: NX }, () => Array<boolean>(NZ).fill(false));
    const vwall = Array.from({ length: NX + 1 }, () => Array<boolean>(NZ).fill(true));
    const hwall = Array.from({ length: NX }, () => Array<boolean>(NZ + 1).fill(true));
    const stack: [number, number][] = [[0, 0]];
    visited[0]![0] = true;
    while (stack.length) {
      const [cx, cz] = stack[stack.length - 1]!;
      const nbrs: [number, number, number][] = [];
      if (cx > 0 && !visited[cx - 1]![cz]) nbrs.push([cx - 1, cz, 0]);
      if (cx < NX - 1 && !visited[cx + 1]![cz]) nbrs.push([cx + 1, cz, 1]);
      if (cz > 0 && !visited[cx]![cz - 1]) nbrs.push([cx, cz - 1, 2]);
      if (cz < NZ - 1 && !visited[cx]![cz + 1]) nbrs.push([cx, cz + 1, 3]);
      if (!nbrs.length) { stack.pop(); continue; }
      const [mx, mz, d] = c.rng.pick(nbrs);
      if (d === 0) vwall[cx]![cz] = false;
      if (d === 1) vwall[cx + 1]![cz] = false;
      if (d === 2) hwall[cx]![cz] = false;
      if (d === 3) hwall[cx]![cz + 1] = false;
      visited[mx]![mz] = true;
      stack.push([mx, mz]);
    }
    for (let i = 0; i < NX * NZ * 0.15; i++) {
      if (c.rng.chance(0.5) && NX > 1) vwall[c.rng.int(1, NX - 1)]![c.rng.int(0, NZ - 1)] = false;
      else if (NZ > 1) hwall[c.rng.int(0, NX - 1)]![c.rng.int(1, NZ - 1)] = false;
    }
    const t = 0.1;
    const put = (b: Box): void => { b.kind = 'mazeWall'; placeUnit(c, [b, { min: [b.min[0] - 0.005, 0, b.min[2] - 0.005], max: [b.max[0] + 0.005, 0.1, b.max[2] + 0.005], mat: 'trim', solid: false }]); };
    for (let x = 1; x < NX; x++) for (let z = 0; z < NZ; z++) {
      if (!vwall[x]![z]) continue;
      const wx = ox + x * cell, z0 = oz + z * cell;
      put({ min: [wx - t, 0, z0 - (z > 0 ? t : 0)], max: [wx + t, wallH, z0 + cell + (z < NZ - 1 ? t : 0)], mat, solid: true });
    }
    for (let x = 0; x < NX; x++) for (let z = 1; z < NZ; z++) {
      if (!hwall[x]![z]) continue;
      const wz = oz + z * cell, x0 = ox + x * cell;
      put({ min: [x0, 0, wz - t], max: [x0 + cell, wallH, wz + t], mat, solid: true });
    }
    // 格子の交点の柱（壁の無い交点だけ。バックルームの「どこまでも続く柱の間」）
    if (pillars > 0) {
      for (let x = 1; x < NX; x++) for (let z = 1; z < NZ; z++) {
        if (vwall[x]![z] || vwall[x]![z - 1] || hwall[x]![z] || hwall[x - 1]![z] || !c.rng.chance(pillars)) continue;
        const px = ox + x * cell, pz = oz + z * cell;
        placeUnit(c, [{ min: [px - 0.25, 0, pz - 0.25], max: [px + 0.25, wallH, pz + 0.25], mat, solid: true, kind: 'mazeWall' }]);
      }
    }
  }
}

/** 迷路の格子が入らない小さな矩形: 壁から突き出た短い壁（袖壁）を 1〜2 枚と、離れた柱を 1 本 */
function wallStubs(c: DressCtx, r: Rect, wallH: number, mat: MatId): void {
  const faces = c.rng.shuffle(c.faces.filter((f) => f.rect === r && f.a1 - f.a0 >= 3));
  const want = c.rng.int(1, 3);
  let n = 0;
  for (const f of [...faces, ...faces]) {
    if (n >= want) break;
    const runs = freeRuns(f, c.openings, 1.2).filter(([p, q]) => q - p >= 1.0);
    if (!runs.length) continue;
    const [p, q] = c.rng.pick(runs);
    const t = c.rng.float(p + 0.3, q - 0.3);
    const depth = Math.min(c.rng.float(1.0, 2.2), ((f.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T) * 0.45);
    if (placeUnit(c, [{ ...alongFace(f, t - 0.1, 0.2, 0, depth, 0, wallH, mat, true), kind: 'mazeWall' }])) n++;
  }
  if (Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 5.5) {
    const x = c.rng.float(r.x0 + 2, r.x1 - 2), z = c.rng.float(r.z0 + 2, r.z1 - 2);
    placeUnit(c, [{ min: [x - 0.3, 0, z - 0.3], max: [x + 0.3, wallH, z + 0.3], mat, solid: true, kind: 'mazeWall' }]);
  }
}

/** 迷路の区画（MazeGrid: 黄ばんだ壁紙の低い壁 / ServiceMaze: 天井までのコンクリートの壁）+ 少しの物 */
export function mazeRoom(c: DressCtx, service: boolean): void {
  if (service) wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }]);
  const wallH = service ? c.h : (c.h > 2.75 ? Math.min(2.4, c.h - 0.3) : c.h);
  maze(c, service ? 2.4 : (c.area > 100 ? 1.9 : 2.2), wallH, service ? 'wallConcrete' : c.cell.palette.wall, service ? 0 : 0.35);
  if (service) for (let i = 0; i < count(c, 1.5, 4); i++) {
    const r = c.rng.pick(c.rects);
    placeNear(c, c.rng.float(r.x0 + 1, r.x1 - 1), c.rng.float(r.z0 + 1, r.z1 - 1), (B, x, z) => crate(B, x, z, c.rng.float(0.4, 0.7), c.rng.float(0.3, 0.9)), 0.3, 1.0, { gap: 0.3 });
  }
  else {
    // 壁のコンセント・換気口（家具の無いバックルームの手掛かり）
    wallDetails(c, c.rng, c.rng.int(2, 4));
  }
  if (!service && maybe(c, 0.25)) {
    // バックルームの片隅にぽつんと置かれた物
    const r = c.rng.pick(c.rects);
    placeNear(c, c.rng.float(r.x0 + 1, r.x1 - 1), c.rng.float(r.z0 + 1, r.z1 - 1), (B, x, z) => (c.rng.chance(0.5) ? chair(B, x, z, c.rng.pick([0, 1, 2, 3] as Dir[]), 'seatBlue') : crate(B, x, z, 0.5, 0.45)), 0.3, 1.5);
  }
}

/** 物置の壁の棚（v1 にない小さな貸し倉庫の代わりにも使う） */
export function shelvesAlongWalls(c: DressCtx, fill: 'boxes' | 'books' | 'goods' = 'boxes'): void {
  for (const f of c.faces) for (const [p, q] of freeRuns(f, c.openings, 0.9)) lineUp(c, p + 0.05, q - 0.05, 1.2, 0.05, (B, at) => wallShelf(B, c.rng, f, at, 1.2, 0.5, Math.min(2.0, c.h - 0.3), 'shelfMetal', fill, c.standoff));
}

/** 収納の戸棚（壁際） */
export function cabinetsAlongWalls(c: DressCtx, mat: MatId = 'furnitureLight'): void {
  for (const f of c.faces) if (maybe(c, 0.5)) for (const [p, q] of freeRuns(f, c.openings, 0.9)) lineUp(c, p + 0.05, q - 0.05, 0.9, 0.02, (B, at) => cabinet(B, f, at, 0.9, 0.45, 0.9, mat, c.standoff));
}
