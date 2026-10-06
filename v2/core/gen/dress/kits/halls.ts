/**
 * 広い空間の中身: 駐車場・吹抜けロビー・コンコース・劇場・展示室・キッズスペース・屋内プール（部屋と回廊）。
 * v1 の ParkingGenerator・AtriumGenerator・RoomGenerator（Theater / Gallery / PlayArea）・PoolGenerator.decor の見た目を移植した。
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { addSunk, BASIN, basinAreas, basinLadder, hasWater, poolsidePuddles, sinkBasin } from '../basin.ts';
import { build, maybe, occupancy, placeNear, placeUnit, reserve, splitAlongFace, type DressCtx } from '../ctx.ts';
import { addDecor, board, sconce, wallBands, wallScreen } from '../decor.ts';
import { bench, counter, floorLine, linkedSeats } from '../furniture.ts';
import { alongFace, facePoint, faceOut, freeRuns, innerRect, lineFace, longX, type Face } from '../geom.ts';
import { nearOpening, patternColumns, patternIslands, patternPartitions, patternRows, sofaIsland } from '../patterns.ts';
import { bin, cone, lifeguardChair, lowTable, planter, plinth, reception, rug, seatRow, softBlock, sofa, startBlock, vitrine } from '../props.ts';
import { cornerPlants, count, entrance, faceOf, longestRun, mainFaces, mainRect, onSomeWall, oppositeFace, skirting, wallExtras } from './common.ts';

// ---------------------------------------------------------------- 駐車場

/**
 * 駐車場（v1 ParkingGenerator）: 壁の下 1.2 m の暗い帯 + 白の反射帯、柱の格子（黄色の帯・階の表示板）、梁、
 * 白線の駐車区画（2.5 × 5.0 m）と車止め、壁際のコーン。車は置かない
 */
export function parking(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 1.2, mat: 'ceilingDark', depth: 0.012 }, { y0: 1.2, y1: 1.3, mat: 'wallWhite', depth: 0.02 }]);
  const h = c.h;
  for (const r of c.rects) {
    const ir = innerRect(r, 1.0);
    // 柱の間隔: 7.5 m を基準に、小さな駐車場でも 2 列以上になるよう 5.5〜8 m で割り切る
    const span = Math.min(ir.x1 - ir.x0, ir.z1 - ir.z0);
    const px = Math.min(8, Math.max(5.5, span / Math.max(2, Math.round(span / 7.5))));
    const alongX = longX(r);
    const colX: number[] = [];
    const colZ: number[] = [];
    for (let x = ir.x0 + px / 2; x < ir.x1; x += px) colX.push(x);
    for (let z = ir.z0 + px / 2; z < ir.z1; z += px) colZ.push(z);
    for (const x of colX) {
      for (const z of colZ) {
        if (nearOpening(c, x, z, 2.5)) continue;
        const B: Box[] = [];
        B.push({ min: [x - 0.3, 0, z - 0.3], max: [x + 0.3, h, z + 0.3], mat: 'columnConcrete', solid: true, kind: 'column' });
        B.push({ min: [x - 0.32, 0, z - 0.32], max: [x + 0.32, 1.2, z + 0.32], mat: 'yellowLine', solid: false });
        B.push({ min: [x - 0.325, 1.2, z - 0.325], max: [x + 0.325, 1.23, z + 0.325], mat: 'metalDark', solid: false });
        // 階の表示（文字の無い白い板。表と裏）
        B.push({ min: [x - 0.22, 1.62, z - 0.336], max: [x + 0.22, 1.88, z - 0.322], mat: 'signPlate', solid: false });
        B.push({ min: [x - 0.22, 1.62, z + 0.322], max: [x + 0.22, 1.88, z + 0.336], mat: 'signPlate', solid: false });
        placeUnit(c, B);
      }
    }
    // 梁の格子（柱の通り芯。天井から 0.5 m 下がる）
    if (h > 2.4) {
      const yb = Math.max(2.25, h - 0.5);
      const beams: Box[] = [];
      for (const z of colZ) beams.push({ min: [r.x0 + WALL_T, yb, z - 0.2], max: [r.x1 - WALL_T, h, z + 0.2], mat: 'ceilingDark', solid: false });
      for (const x of colX) beams.push({ min: [x - 0.2, yb, r.z0 + WALL_T], max: [x + 0.2, h, r.z1 - WALL_T], mat: 'ceilingDark', solid: false });
      if (beams.length) addDecor(c, beams);
    }
    // 駐車区画: 長辺の壁から 5.0 m、幅 2.5 m の白線。線は柱の通り芯から 1.25 ずらす
    const stall = 2.5, depth = 5.0, lw = 0.12;
    const lineStart = (alongX ? colX[0] : colZ[0]) ?? ((alongX ? ir.x0 : ir.z0) + px / 2);
    const lo = (alongX ? ir.x0 : ir.z0) + 0.8, hi = (alongX ? ir.x1 : ir.z1) - 0.8;
    const lines: number[] = [];
    for (let t = lineStart - 1.25 - Math.ceil((lineStart - lo) / stall) * stall; t <= hi; t += stall) if (t >= lo) lines.push(t);
    const rows: { face: number; inward: 1 | -1 }[] = alongX
      ? [{ face: r.z0 + WALL_T, inward: 1 }, { face: r.z1 - WALL_T, inward: -1 }]
      : [{ face: r.x0 + WALL_T, inward: 1 }, { face: r.x1 - WALL_T, inward: -1 }];
    const shortLen = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    if (shortLen < 2 * depth + 3) rows.length = shortLen >= depth + 3.5 ? 1 : 0;
    if (shortLen >= 24) {
      const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
      rows.push({ face: mid, inward: 1 }, { face: mid, inward: -1 });
    }
    for (const row of rows) {
      const f0 = row.face, f1 = row.face + row.inward * depth;
      const paint: Box[] = [];
      for (const t of lines) {
        const cx = alongX ? t : (f0 + f1) / 2, cz = alongX ? (f0 + f1) / 2 : t;
        if (nearOpening(c, cx, cz, 3.2)) continue;
        if (alongX) floorLine(paint, t - lw / 2, f0, t + lw / 2, f1, 'wallWhite');
        else floorLine(paint, f0, t - lw / 2, f1, t + lw / 2, 'wallWhite');
      }
      if (paint.length) addDecor(c, paint);
      // 車止め（低いのでソリッドでも歩いて越えられる）
      for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i]!, b = lines[i + 1]!;
        const cx = alongX ? (a + b) / 2 : (f0 + f1) / 2, cz = alongX ? (f0 + f1) / 2 : (a + b) / 2;
        if (nearOpening(c, cx, cz, 3.2)) continue;
        const stop = f0 + row.inward * 0.9;
        const m = (a + b) / 2;
        const s0 = Math.min(stop, stop + row.inward * 0.15), s1 = Math.max(stop, stop + row.inward * 0.15);
        placeUnit(c, [alongX
          ? { min: [m - 0.3, 0, s0], max: [m + 0.3, 0.12, s1], mat: 'columnConcrete', solid: true, kind: 'wheelStop' }
          : { min: [s0, 0, m - 0.3], max: [s1, 0.12, m + 0.3], mat: 'columnConcrete', solid: true, kind: 'wheelStop' }]);
      }
    }
  }
  for (let i = 0; i < count(c, 1.5, 4); i++) onSomeWall(c, 0.4, (B, f, at) => { const [x, z] = facePoint(f, at + 0.2, c.standoff + 0.3); cone(B, x, z); });
}

// ---------------------------------------------------------------- ロビー・コンコース

/** 吹抜けロビー（v1 AtriumGenerator）: 周囲の柱、中二階風の帯、入口を向く受付、ソファの島と敷物、植え込み、壁際の長椅子 */
export function lobby(c: DressCtx): void {
  skirting(c, 'metalDark');
  const big = c.area > 150;
  if (big) {
    for (const r of c.rects) {
      const ir = innerRect(r, 2.5);
      const step = 6;
      const pts: [number, number][] = [];
      for (let x = ir.x0; x <= ir.x1 + 0.01; x += step) pts.push([x, ir.z0], [x, ir.z1]);
      for (let z = ir.z0 + step; z < ir.z1; z += step) pts.push([ir.x0, z], [ir.x1, z]);
      for (const [x, z] of pts) {
        if (nearOpening(c, x, z, 2.2)) continue;
        placeUnit(c, [
          { min: [x - 0.35, 0, z - 0.35], max: [x + 0.35, c.h, z + 0.35], mat: 'columnConcrete', solid: true, kind: 'column' },
          { min: [x - 0.38, 0, z - 0.38], max: [x + 0.38, 0.15, z + 0.38], mat: 'marbleWhite', solid: false },
        ]);
      }
    }
    if (c.h >= 4.6) wallBands(c, [{ y0: 3.4, y1: 3.6, mat: 'trim', depth: 0.45 }]);
  }
  const ent = entrance(c);
  const ef = faceOf(c, ent);
  if (ent && ef) {
    const r = ef.rect ?? mainRect(c);
    const D = (ef.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
    const t = ef.horizontal ? ent.pos[0] : ent.pos[2];
    const [x, z] = facePoint(ef, t, Math.max(3.4, D * 0.35));
    const w = Math.min(4.8, Math.max(1.8, (ef.a1 - ef.a0) * 0.3));
    placeNear(c, x, z, (B, px, pz) => reception(B, px, pz, w, 0.9, ef.dir, 'woodPanel', 'marbleWhite', 1.1), 0.5, 3);
  }
  patternIslands(c, big ? 1 / 38 : 1 / 26, undefined, 'sofa', (B, x, z, sx, sz) => {
    rug(B, x - sx - 0.2, z - sz - 0.2, x + sx + 0.2, z + sz + 0.2, 'carpetPattern');
    sofaIsland(c, c.rng.pick<MatId>(['upholstery', 'seatBlue', 'whiteFabric']))(B, x, z, sx, sz);
  });
  for (let i = 0; i < count(c, big ? 4 : 2, 7); i++) {
    const r = c.rng.pick(c.rects);
    const s = c.rng.float(0.9, 1.6);
    placeNear(c, c.rng.float(r.x0 + 2, r.x1 - 2), c.rng.float(r.z0 + 2, r.z1 - 2), (B, x, z) => planter(B, c.rng, x - s / 2, z - s / 2, x + s / 2, z + s / 2, 0.55, 'marbleWhite'), 0.5, 2, { gap: 0.6 });
  }
  for (let i = 0; i < count(c, 2, 4); i++) onSomeWall(c, 2.0, (B, f, at) => { const [x, z] = facePoint(f, at + 1.0, c.standoff + 0.25); bench(B, f.horizontal, x, z, 2.0, 'woodPanel'); });
  cornerPlants(c, 4, 0.7, 1.9, 'columnConcrete');
}

/** コンコース・待合（v1 Terminal）: 背中合わせの連結椅子の列、ゲートのカウンターと内照の案内板、発着の表示、柱、ごみ箱・鉢植え */
export function terminal(c: DressCtx): void {
  skirting(c, 'metalDark');
  const r = mainRect(c);
  if (c.area > 200) patternColumns(c, 9, 0.8);
  const ef = faceOf(c, entrance(c));
  const gateF = (ef && oppositeFace(c, ef)) ?? mainFaces(c, () => true, r)[0];
  // ゲートのカウンター（7 m ごと）+ 上の内照の案内板
  if (gateF) {
    for (const [p, q] of freeRuns(gateF, c.openings, 1.2)) {
      for (let t = p + 0.3; t + 3.0 <= q - 0.3; t += 7) {
        build(c, (B) => {
          counter(B, gateF, t, 3.0, 0.8, 1.1, 'furnitureLight', 'metal', c.standoff + 0.9);
          if (c.h > 3.0) {
            B.push(alongFace(gateF, t + 0.3, 2.4, 0.02, 0.12, Math.min(c.h - 0.5, 2.6), Math.min(c.h - 0.1, 3.3), 'metalDark', false));
            B.push(alongFace(gateF, t + 0.4, 2.2, 0.12, 0.13, Math.min(c.h - 0.45, 2.65), Math.min(c.h - 0.15, 3.25), 'lightPanel', false));
          }
        });
      }
    }
  }
  // 連結椅子の列（背中合わせ。ゲートの面と平行）
  const axis: 'x' | 'z' = gateF ? (gateF.horizontal ? 'x' : 'z') : (longX(r) ? 'x' : 'z');
  patternRows(c, {
    spacing: 3.4, depth: 1.0, height: 0.85, mat: 'seatBlue', gapEvery: 5, margin: c.area > 120 ? 2.6 : 1.6, axis, minLen: 1.0,
    build: (B, x0, z0, x1, z1) => {
      const alongX = x1 - x0 >= z1 - z0;
      const len = alongX ? x1 - x0 : z1 - z0;
      const n = Math.max(2, Math.floor(len / 0.5));
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const seat = c.rng.pick<MatId>(['seatBlue', 'seatRed', 'metalDark']);
      if (alongX) { linkedSeats(B, cx, cz - 0.24, n, 2, seat); linkedSeats(B, cx, cz + 0.24, n, 0, seat); }
      else { linkedSeats(B, cx - 0.24, cz, n, 3, seat); linkedSeats(B, cx + 0.24, cz, n, 1, seat); }
    },
  });
  // 発着の表示（横の壁）
  const side = mainFaces(c, (f) => !gateF || f.horizontal !== gateF.horizontal, r)[0];
  const run = side && longestRun(c, side, 0.8);
  if (side && run && run[1] - run[0] > 2.4 && c.h > 2.9) {
    const T: Box[] = [];
    wallScreen(T, side, (run[0] + run[1]) / 2, Math.min(3.2, run[1] - run[0] - 0.6), 1.9, Math.min(c.h - 0.3, 2.8), 'screenLcd');
    addDecor(c, T);
  }
  for (let i = 0; i < count(c, 2, 5); i++) onSomeWall(c, 0.4, (B, f, at) => { const [x, z] = facePoint(f, at + 0.2, c.standoff + 0.22); bin(B, x, z, 'stainless', 0.4, 0.8); });
  cornerPlants(c, count(c, 2, 4), 0.6, 1.6);
}

// ---------------------------------------------------------------- 劇場

/**
 * 劇場（v1 Theater）: 入口の向かいの壁に暗幕と 16:9 のスクリーン、座席の列は後ろほど高い段床。
 * 段床は列ごとに 0.3 m まで上がり（段差 0.35 m 未満なので列の間の通路も側通路もそのまま上がれる）、最大 0.9 m。
 * 最後の列の後ろは 0.3 m ずつ下がる帯で床に戻す（v1 は後ろが 0.9 m の崖だった）。横の壁に開口があれば 0.3 m まで
 * （扉の前の床から 1 段で上がれる）。段床と座席は扉前・keepOut で切る。狭い部屋は段床なしの数列
 */
export function theater(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }]);
  const r = mainRect(c);
  const ef = faceOf(c, entrance(c));
  const sf = (ef && ef.rect === r ? oppositeFace(c, ef) : null) ?? mainFaces(c, () => true, r)[0];
  if (!sf) return;
  const D = (sf.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
  const A0 = Math.max(sf.a0, sf.horizontal ? r.x0 : r.z0) + WALL_T, A1 = Math.min(sf.a1, sf.horizontal ? r.x1 : r.z1) - WALL_T;
  // 暗幕とスクリーン（開口を避けて分ける）
  const runs = freeRuns(sf, c.openings, 0.3);
  const curtains: Box[] = [];
  for (const [p, q] of runs) if (q - p > 0.4) curtains.push(alongFace(sf, p + 0.05, q - p - 0.1, 0.25, 0.3, 0.3, c.h - 0.4, 'furnitureDark', false));
  if (curtains.length) addDecor(c, curtains);
  const best = runs.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  if (best && best[1] - best[0] >= 2.5) {
    let sw = Math.min(best[1] - best[0] - 0.4, 16);
    let sh = (sw * 9) / 16;
    if (sh > c.h - 1.5) { sh = Math.max(0.8, c.h - 1.5); sw = (sh * 16) / 9; }
    const m = (best[0] + best[1]) / 2;
    addDecor(c, [alongFace(sf, m - sw / 2, sw, 0.3, 0.36, 1.0, 1.0 + sh, 'wallWhite', false)]);
  }
  const small = c.area < 60 || D < 7.5;
  const pitch = small ? 1.0 : 1.1;
  const d0 = small ? 1.9 : 3.0;
  const rows = Math.floor((D - (small ? 1.3 : 2.8) - d0) / pitch);
  const side = A1 - A0 >= 8 ? 1.4 : 0.9;
  const ia0 = A0 + side, ia1 = A1 - side;
  const mat = c.rng.pick<MatId>(['seatRed', 'seatBlue', 'upholstery']);
  if (rows < 1 || ia1 - ia0 < 1.2) {
    // 列が入らない小部屋: スクリーンを向いたソファ
    const [x, z] = facePoint(sf, (A0 + A1) / 2, Math.min(D - 1.2, 2.2));
    placeNear(c, x, z, (B, px, pz) => sofa(B, px, pz, Math.min(2.0, A1 - A0 - 1.0), sf.dir, mat, 0.85), 0.3, 1.2);
    return;
  }
  const mid = (ia0 + ia1) / 2;
  const blocks: [number, number][] = ia1 - ia0 >= 12 ? [[ia0, mid - 0.7], [mid + 0.7, ia1]] : [[ia0, ia1]];
  const sideOpen = c.openings.some((s) => { const f = faceOf(c, s); return !!f && f.horizontal !== sf.horizontal; });
  const maxRise = small ? 0 : sideOpen ? 0.3 : 0.9;
  const steps = Math.round(maxRise / 0.3);
  const riseOf = (i: number): number => Math.min(maxRise, 0.3 * i, Math.floor((i * (steps + 1)) / rows) * 0.3);
  const floorMat = c.cell.palette.floor;
  const occ = occupancy(c);
  for (let i = 0; i < rows; i++) {
    const d = d0 + i * pitch;
    const rise = riseOf(i);
    if (rise > 0.01) for (const [p, q] of splitAlongFace(c, sf, A0, A1, d, d + pitch, 0.05, 0.3)) placeUnit(c, [alongFace(sf, p, q - p, d, d + pitch, 0, rise, floorMat, true)]);
    const n = sf.face + sf.inward * (d + 0.55);
    for (const [s0, s1] of blocks) {
      for (const [p, q] of splitAlongFace(c, sf, s0, s1, d, d + pitch, 0.1, 1.1)) {
        if (rise <= 0.01 && !c.rng.chance(occ)) continue;
        build(c, (B) => seatRow(B, sf.horizontal, p, q, n, rise, sf.dir, mat));
      }
    }
  }
  // 最後の列の後ろ: 0.3 m ずつ下がる帯で床へ
  let top = riseOf(rows - 1);
  let dd = d0 + rows * pitch;
  while (top > 0.31) {
    top -= 0.3;
    for (const [p, q] of splitAlongFace(c, sf, A0, A1, dd, dd + 0.5, 0.05, 0.3)) placeUnit(c, [alongFace(sf, p, q - p, dd, dd + 0.5, 0, top, floorMat, true)]);
    dd += 0.5;
  }
  // 通路の壁灯
  for (const f of mainFaces(c, (g) => g.horizontal !== sf.horizontal, r)) {
    for (const [p, q] of freeRuns(f, c.openings, 0.8)) {
      const T: Box[] = [];
      for (let t = p + 1.0; t < q - 0.5; t += 3.0) sconce(T, f, t, Math.min(c.h - 0.5, 2.2), 'lightWarm');
      if (T.length) addDecor(c, T);
    }
  }
}

/** a0..a1 の中に間隔 sp で中央寄せに並べた位置（端からは 0 以上） */
export function centered(a0: number, a1: number, sp: number): number[] {
  if (a1 < a0) return [];
  const n = Math.floor((a1 - a0) / sp + 1e-6) + 1;
  const start = (a0 + a1) / 2 - ((n - 1) * sp) / 2;
  return Array.from({ length: n }, (_, i) => start + i * sp);
}

// ---------------------------------------------------------------- 展示室

/** 展示室（v1 Gallery）: 壁の額と小さな灯り、広い部屋は自立の白い間仕切り（両面に額）、台座の展示、中央の長椅子 */
export function gallery(c: DressCtx): void {
  skirting(c, 'trim');
  const faceMats: MatId[] = ['wallDark', 'seatBlue', 'upholstery', 'noticeGreen', 'skyDusk', 'chalkboard', 'seatRed', 'aquariumBlue'];
  const hang = (f: Face, a0: number, a1: number, pitch: number): void => {
    const len = a1 - a0;
    const n = Math.floor((len + 0.6) / pitch);
    if (n <= 0) return;
    const start = (a0 + a1) / 2 - ((n - 1) * pitch) / 2;
    const B: Box[] = [];
    for (let k = 0; k < n; k++) {
      if (!c.rng.chance(Math.max(0.5, occupancy(c)))) continue;
      const t = start + k * pitch;
      const w = c.rng.float(0.5, Math.min(1.6, pitch - 0.5));
      const hh = c.rng.float(0.5, Math.min(1.2, c.h - 1.6));
      const y0 = 1.55 - hh / 2;
      board(B, f, t, w, y0, y0 + hh, c.rng.pick(faceMats), c.rng.chance(0.5) ? 'goldTrim' : 'furnitureDark');
      if (c.h > 2.7) sconce(B, f, t, Math.min(c.h - 0.4, y0 + hh + 0.15), 'lightWarm');
    }
    if (B.length) addDecor(c, B);
  };
  for (const f of c.faces) for (const [p, q] of freeRuns(f, c.openings, 0.8)) hang(f, p + 0.2, q - 0.2, c.rng.float(2.0, 2.8));
  if (c.area > 70) {
    const before = c.units.length;
    patternPartitions(c, c.area > 250 ? 3 : 2, Math.min(2.6, c.h - 0.4), 'wallWhite', 0.16);
    // 間仕切りの両面にも額
    for (const u of c.units.slice(before)) {
      const p = u.boxes.find((b) => b.kind === 'partition');
      if (!p) continue;
      const horiz = p.max[0] - p.min[0] >= p.max[2] - p.min[2];
      const a0 = horiz ? p.min[0] : p.min[2], a1 = horiz ? p.max[0] : p.max[2];
      if (a1 - a0 < 1.4) continue;
      hang(lineFace(horiz, horiz ? p.max[2] : p.max[0], 1, a0, a1), a0 + 0.3, a1 - 0.3, 2.2);
      hang(lineFace(horiz, horiz ? p.min[2] : p.min[0], -1, a0, a1), a0 + 0.3, a1 - 0.3, 2.2);
    }
  }
  // 台座の展示と展示ケース（格子に並べ、通路を残す。小さな部屋は間隔を詰める）
  const objs: MatId[] = ['goldTrim', 'marbleWhite', 'metal', 'plasticRed', 'screenLcd', 'aquariumBlue', 'boxCardboard', 'stainless'];
  for (const r of c.rects) {
    const small = Math.min(r.x1 - r.x0, r.z1 - r.z0) < 9;
    const ir = innerRect(r, small ? 1.9 : 2.4);
    const sp = small ? 2.6 : 3.6;
    for (const x of centered(ir.x0, ir.x1, sp)) {
      for (const z of centered(ir.z0, ir.z1, sp)) {
        if (c.rng.chance(0.35)) {
          const vw = c.rng.float(0.6, 1.2), vd = c.rng.float(0.5, 0.7), vo = c.rng.pick(objs);
          const along = c.rng.chance(0.5);
          placeNear(c, x, z, (B, px, pz) => vitrine(B, px, pz, along ? vw : vd, along ? vd : vw, c.rng.chance(0.5) ? 'woodPanel' : 'paintWhite', vo), 0.4, 0.8, { gap: 0.9 });
          continue;
        }
        if (!c.rng.chance(occupancy(c) * 0.7)) continue;
        const s = c.rng.float(0.45, 0.7), hh = c.rng.float(0.8, 1.15), m = c.rng.chance(0.7) ? 'marbleWhite' : 'paintWhite', o = c.rng.pick(objs), os = c.rng.float(0.18, 0.34);
        // 間仕切りや長椅子と重なる所は少しずらす
        placeNear(c, x, z, (B, px, pz) => plinth(B, px, pz, s, hh, m, o, os), 0.4, 0.8, { gap: 0.9 });
      }
    }
  }
  if (c.area > 25) {
    const r = mainRect(c);
    placeNear(c, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (B, x, z) => bench(B, longX(r), x, z, Math.min(1.8, Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.3), 'woodPanel'), 0.4, 2.0, { gap: 0.6 });
  }
  // 壁際の展示ケース（低い台 + ガラス）
  for (let i = 0; i < count(c, 1 + c.area / 60, 4); i++) onSomeWall(c, 1.2, (B, f, at) => { const [x, z] = facePoint(f, at + 0.6, c.standoff + 0.3); vitrine(B, x, z, f.horizontal ? 1.2 : 0.55, f.horizontal ? 0.55 : 1.2, 'woodPanel', c.rng.pick(objs)); }, { pad: 0.9 });
}

// ---------------------------------------------------------------- キッズスペース

/** キッズスペース（v1 PlayArea）: 壁の柔らかい腰板、床の色のマット、柔らかい積み木の島、ボールプール、小さな卓 */
export function playArea(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 1.0, mat: c.rng.pick<MatId>(['plasticBlue', 'plasticYellow', 'whiteFabric']), depth: 0.05 }]);
  const colors: MatId[] = ['plasticRed', 'plasticYellow', 'plasticBlue', 'whiteFabric', 'noticeGreen'];
  // 床のマット（1.2 m 角の市松。当たらない）
  for (const r of c.rects) {
    const ir = innerRect(r, 1.0);
    const B: Box[] = [];
    let k = 0;
    for (let x = ir.x0; x + 1.2 <= ir.x1 + 1e-6 && B.length < 60; x += 1.2) {
      for (let z = ir.z0; z + 1.2 <= ir.z1 + 1e-6 && B.length < 60; z += 1.2) B.push({ min: [x + 0.01, 0.001, z + 0.01], max: [x + 1.19, 0.03, z + 1.19], mat: colors[(((k++ + Math.floor(x)) % colors.length) + colors.length) % colors.length]!, solid: false });
    }
    if (B.length) addDecor(c, B);
  }
  // ボールプール（広い部屋）: 低い囲い（ソリッド）+ 中のボール（色の層）
  if (c.area > 30) {
    const r = mainRect(c);
    placeNear(c, c.rng.float(r.x0 + 2.5, r.x1 - 2.5), c.rng.float(r.z0 + 2.5, r.z1 - 2.5), (B, x, z) => {
      const s = 1.2, t = 0.15, hh = 0.55;
      for (const [x0, z0, x1, z1] of [[x - s, z - s, x + s, z - s + t], [x - s, z + s - t, x + s, z + s], [x - s, z - s + t, x - s + t, z + s - t], [x + s - t, z - s + t, x + s, z + s - t]] as const) B.push({ min: [x0, 0, z0], max: [x1, hh, z1], mat: 'plasticBlue', solid: true });
      for (let k = 0; k < 3; k++) B.push({ min: [x - s + t + 0.01, k * 0.11, z - s + t + 0.01], max: [x + s - t - 0.01, k * 0.11 + 0.12, z + s - t - 0.01], mat: colors[k]!, solid: false });
    }, 0.5, 2.5, { gap: 0.8 });
  }
  patternIslands(c, 1 / 18, undefined, 'softBlock', (B, x, z, sx, sz) => {
    const n = 1 + c.rng.int(0, 2);
    for (let k = 0; k < n; k++) {
      const w = Math.min(sx, c.rng.float(0.3, 0.7)), d = Math.min(sz, c.rng.float(0.3, 0.7));
      const ox = (k - (n - 1) / 2) * (w * 2 + 0.05);
      softBlock(B, x + ox - w, z - d, x + ox + w, z + d, c.rng.float(0.3, 0.8), c.rng.pick(colors), 'whiteFabric');
    }
  }, { gap: 0.8 });
  for (let i = 0; i < count(c, 1.2, 3); i++) {
    const r = c.rng.pick(c.rects);
    placeNear(c, c.rng.float(r.x0 + 1.5, r.x1 - 1.5), c.rng.float(r.z0 + 1.5, r.z1 - 1.5), (B, x, z) => {
      lowTable(B, x, z, 0.8, 0.6, 0.5, 'plasticYellow');
      for (const [dx, dz] of [[-0.62, 0], [0.62, 0]] as const) softBlock(B, x + dx - 0.16, z + dz - 0.16, x + dx + 0.16, z + dz + 0.16, 0.3, c.rng.pick(colors), 'whiteFabric');
    }, 0.4, 1.5, { gap: 0.5 });
  }
  wallExtras(c, ['picture', 'clock'], 2);
}

// ---------------------------------------------------------------- 屋内プール
// 水は床に沈めた水槽に入れる（basin.ts。床の上に水の板を置かない）。デッキは床そのもの（扉前も同じ高さ）

/** 水槽 W の底のレーンライン（長い向き）と、ropes なら水面のコースロープ（レーンの境）。レーンの数を返す */
function laneMarks(c: DressCtx, W: Rect, ropes: boolean): number {
  const alongX = longX(W);
  const span = alongX ? W.z1 - W.z0 : W.x1 - W.x0;
  const lanes = Math.max(1, Math.floor(span / 2.0));
  const lw = span / lanes;
  const yb = -BASIN.depth, ys = -BASIN.level;
  const a0 = alongX ? W.x0 : W.z0, a1 = alongX ? W.x1 : W.z1, c0 = alongX ? W.z0 : W.x0;
  // p: 長い向き、q: 横の向き
  const put = (B: Box[], p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, mat: MatId): void => {
    B.push(alongX ? { min: [p0, y0, q0], max: [p1, y1, q1], mat, solid: false } : { min: [q0, y0, p0], max: [q1, y1, p1], mat, solid: false });
  };
  const B: Box[] = [];
  for (let k = 0; k < lanes; k++) {
    const m = c0 + lw * (k + 0.5);
    if (a1 - a0 > 3) {
      put(B, a0 + 1.0, a1 - 1.0, m - 0.1, m + 0.1, yb + 0.002, yb + 0.008, 'wallDark');
      // 線の両端の T 字
      for (const e of [a0 + 1.0, a1 - 1.0]) put(B, e - 0.1, e + 0.1, m - 0.4, m + 0.4, yb + 0.002, yb + 0.008, 'wallDark');
    }
    if (ropes && k > 0) {
      const e = c0 + lw * k;
      for (let t = a0, i = 0; t < a1 - 0.05; t += 0.5, i++) put(B, t, Math.min(a1, t + 0.5), e - 0.04, e + 0.04, ys - 0.03, ys + 0.025, i % 2 ? 'paintWhite' : 'plasticRed');
    }
  }
  if (B.length) addSunk(c, B);
  return lanes;
}

/** 水槽 W の長い辺のはしご（端から 2 m）。はしごの足元（デッキ）は当たる物を置かない範囲にする */
function poolLadder(c: DressCtx, W: Rect): void {
  const alongX = longX(W);
  const len = alongX ? W.x1 - W.x0 : W.z1 - W.z0;
  if (len < 4.5) return;
  const side: 0 | 1 | 2 | 3 = alongX ? (c.rng.chance(0.5) ? 0 : 2) : (c.rng.chance(0.5) ? 3 : 1);
  const at = c.rng.chance(0.5) ? (alongX ? W.x0 : W.z0) + 2.0 : (alongX ? W.x1 : W.z1) - 2.0;
  basinLadder(c, W, side, at);
  const d = BASIN.wall + 0.35;
  const [x0, x1, z0, z1] = side === 0 ? [at - 0.4, at + 0.4, W.z0 - d, W.z0] : side === 2 ? [at - 0.4, at + 0.4, W.z1, W.z1 + d] : side === 3 ? [W.x0 - d, W.x0, at - 0.4, at + 0.4] : [W.x1, W.x1 + d, at - 0.4, at + 0.4];
  reserve(c, { min: [x0, 0, z0], max: [x1, 1.0, z1] });
}

/**
 * 屋内プール（部屋・広間）: 壁沿いの歩道デッキ（床の高さ）の内側に、床に沈めた水槽（縁の笠石・底のレーンライン・水面のコースロープ）。
 * 扉前・仕掛けの場所は乾いた渡りにして水槽を切る。飛び込み台・はしご・監視台・壁際の長椅子・タイルの色帯・デッキの水たまり。
 * 狭い部屋は回廊と同じ（水路）
 */
export function pool(c: DressCtx): void {
  const band = c.rng.pick<MatId>(['wallGreen', 'wallDark', 'trim', 'plasticBlue']);
  wallBands(c, [{ y0: 1.05, y1: 1.25, mat: band, depth: 0.012 }]);
  const r = mainRect(c);
  const minDim = Math.min(r.x1 - r.x0, r.z1 - r.z0);
  if (minDim < 6.5) { poolCorridor(c); return; }
  const deck = Math.min(3.0, Math.max(1.7, minDim * 0.18));
  // 水槽（デッキの内側）
  const pools: Rect[] = [];
  if (!hasWater(c)) {
    for (const q of c.rects) {
      const R = innerRect(q, WALL_T + deck);
      if (R.x1 - R.x0 < 1.8 || R.z1 - R.z0 < 1.8) continue;
      for (const a of basinAreas(c, R, 0.25, 1.8)) {
        const W = sinkBasin(c, a, { slow: 0.65 });
        if (W) pools.push(W);
      }
    }
  }
  for (const W of pools) {
    const alongX = longX(W);
    const lanes = laneMarks(c, W, true);
    const lw = (alongX ? W.z1 - W.z0 : W.x1 - W.x0) / lanes;
    // 飛び込み台（短い辺の笠石の上。台の先は水際まで）
    if (maybe(c, 0.8)) {
      const low = c.rng.chance(0.5);
      const end = alongX ? (low ? W.x0 - 0.3 : W.x1 + 0.3) : (low ? W.z0 - 0.3 : W.z1 + 0.3);
      const toward: Dir = alongX ? (low ? 1 : 3) : (low ? 0 : 2);
      for (let k = 0; k < lanes; k++) {
        const m = (alongX ? W.z0 : W.x0) + lw * (k + 0.5);
        build(c, (T) => startBlock(T, alongX ? end : m, alongX ? m : end, toward));
      }
    }
    poolLadder(c, W);
  }
  // 監視台・長椅子（デッキの上）・デッキの水たまり
  if (deck >= 2.0 && maybe(c, 0.6)) onSomeWall(c, 0.8, (B, f, at) => { const [x, z] = facePoint(f, at + 0.4, deck - 0.5); lifeguardChair(B, x, z, faceOut(f)); }, { pad: 1.2 });
  for (let i = 0; i < count(c, 2, 4); i++) onSomeWall(c, 1.8, (B, f, at) => { const [x, z] = facePoint(f, at + 0.9, 0.3); bench(B, f.horizontal, x, z, 1.8, 'floorTile'); }, { pad: 1.2 });
  poolsidePuddles(c, count(c, 2, 5));
}

/** デッキの幅（v1 deckWidthFor: 回廊の幅 5 m 未満は無し） */
export function deckWidthFor(width: number): number {
  if (width < 5) return 0;
  return Math.min(2.0, Math.max(1.0, Math.round(width * 0.2 * 2) / 2));
}

/**
 * プールの回廊（v1 PoolGenerator.decor）: タイルの色帯、床に沈めた水路（幅 5 m 以上は長い辺に歩道デッキと柱を残した真ん中、
 * 細い回廊は壁から壁まで）。扉の前は乾いた渡り。水路の底のレーンライン・排水溝、乾いた所のタイルのベンチと水たまり
 */
export function poolCorridor(c: DressCtx): void {
  if (!c.units.length) wallBands(c, [{ y0: 1.05, y1: 1.25, mat: c.rng.pick<MatId>(['wallGreen', 'wallDark', 'trim']), depth: 0.012 }]);
  const water = !hasWater(c);
  for (const r of c.rects) {
    const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
    const width = alongZ ? r.x1 - r.x0 : r.z1 - r.z0;
    const deckW = deckWidthFor(width);
    // 水路（デッキの間）
    const inset = deckW > 0 ? WALL_T + deckW : WALL_T;
    const R: Rect = alongZ ? { x0: r.x0 + inset, z0: r.z0 + WALL_T, x1: r.x1 - inset, z1: r.z1 - WALL_T } : { x0: r.x0 + WALL_T, z0: r.z0 + inset, x1: r.x1 - WALL_T, z1: r.z1 - inset };
    const ws: Rect[] = [];
    if (water) {
      for (const a of basinAreas(c, R)) {
        const W = sinkBasin(c, a, { slow: 0.7 });
        if (W) ws.push(W);
      }
    }
    // 柱（幅 6 m 以上。デッキの縁。水路の縁に掛けない）
    if (deckW > 0 && width >= 6) {
      for (const f of c.faces.filter((g) => g.rect === r && g.horizontal !== alongZ)) {
        for (const [p, q] of freeRuns(f, c.openings, 0.4)) {
          for (let t = p + 2.2; t <= q - 2.2; t += 4.5) {
            const [x, z] = facePoint(f, t, deckW - 0.32);
            build(c, (B) => B.push({ min: [x - 0.25, 0, z - 0.25], max: [x + 0.25, c.h, z + 0.25], mat: c.cell.palette.wall === 'floorTile' ? 'floorTile' : 'columnConcrete', solid: true, kind: 'column' }));
          }
        }
      }
    }
    // 水路の底のレーンライン・排水溝のグレーチング
    for (const W of ws) {
      const alongX = longX(W);
      const cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2;
      const a0 = (alongX ? W.x0 : W.z0) + 0.6, a1 = (alongX ? W.x1 : W.z1) - 0.6;
      const yb = -BASIN.depth;
      const B: Box[] = [];
      if (a1 - a0 > 1) B.push(alongX ? { min: [a0, yb + 0.002, cz - 0.06], max: [a1, yb + 0.008, cz + 0.06], mat: 'wallWhite', solid: false } : { min: [cx - 0.06, yb + 0.002, a0], max: [cx + 0.06, yb + 0.008, a1], mat: 'wallWhite', solid: false });
      for (let t = a0 + 1.0; t + 0.6 <= a1; t += 6) B.push(alongX ? { min: [t, yb + 0.001, cz - 0.3], max: [t + 0.6, yb + 0.012, cz + 0.3], mat: 'metal', solid: false } : { min: [cx - 0.3, yb + 0.001, t], max: [cx + 0.3, yb + 0.012, t + 0.6], mat: 'metal', solid: false });
      if (B.length) addSunk(c, B);
    }
  }
  // タイルのベンチ（壁際の乾いた床。水路の上には置かれない）
  for (let i = 0; i < count(c, 1.0, 2); i++) onSomeWall(c, 2.0, (B, f, at) => B.push(alongFace(f, at, 2.0, 0, 0.4, 0, 0.45, 'floorTile', true)), { pad: 1.2 });
  poolsidePuddles(c, count(c, 1.2, 3));
  if (maybe(c, 0.5)) wallExtras(c, ['clock'], 1);
}
