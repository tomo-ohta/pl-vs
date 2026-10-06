/**
 * 部屋（room / hall）の中身: オフィス・教室・体育館・トイレ・更衣室・店・小部屋・汎用・ホテルの客室・診察室・待合・住居・
 * カラオケ・ゲーム場・設備室。v1 の RoomGenerator（furnish・参考画像テンプレート）と部屋別ドレッシングの見た目を、
 * 部屋 ID に依らない形（テーマ・大きさ・入口の位置・乱数）で作り直した。
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { build, maybe, occupancy, placeNear, splitAlongFace, touchesSolid, type DressCtx } from '../ctx.ts';
import { addDecor, board, chalkboard, papers, wallBands, wallClock, wallScreen, wallWindow, whiteboard } from '../decor.ts';
import { bench, booths, chair, counter, floorLine, linkedSeats, longTable, rack, rollCage, sinkRow, urinalRow, vending, washer, WASHER_OUT, WASHER_PITCH } from '../furniture.ts';
import { alongFace, facePoint, faceOut, freeRuns, innerRect, lineFace, type Face } from '../geom.ts';
import { furnishGeneric, patternColumns, patternIslands, patternPartitions, patternRows, sofaIsland, type GenericStyle } from '../patterns.ts';
import {
  arcade, bed, bin, cabinet, coolerCase, copier, crate, desk, examBed, fridge, kitchenette, lamp, lowTable, officeChair, reception, rug, schoolChair, schoolDesk,
  shelfIsland, softBlock, sofa, wallShelf, waterCooler,
} from '../props.ts';
import { cornerPlants, count, deskAgainst, entrance, faceOf, lineUp, lockerRun, longestRun, mainFaces, mainRect, onSomeWall, openingsCount, oppositeFace, skirting, wallExtras } from './common.ts';

// ---------------------------------------------------------------- オフィス

/** オフィス: 向かい合わせの机の島（画面・椅子・仕切りのパネル）+ 壁際の書庫・複合機・給水器 + 鉢植え・白板・時計 */
export function office(c: DressCtx): void {
  skirting(c, 'metalDark');
  if (c.area > 150) patternColumns(c, 8);
  const felt = c.rng.pick<MatId>(['noticeGreen', 'seatBlue', 'whiteFabric']);
  const seat = c.rng.pick<MatId>(['seatBlue', 'metalDark', 'upholstery']);
  let n = 0;
  for (const r of c.rects) n += deskPods(c, r, felt, seat);
  if (c.area > 200 && maybe(c, 0.5)) patternPartitions(c, 1, 1.4, 'wallWhite');
  if (n < 2) wallDesks(c, Math.max(1, count(c, 1.5 + c.area / 15, 6)), seat);
  officeWalls(c);
  cornerPlants(c, count(c, 1.2, 3));
  wallExtras(c, ['clock', 'whiteboard', 'board'], count(c, 1.5, 3));
}

/** 向かい合わせの机の島を矩形 r に並べる。置いた席の数を返す */
function deskPods(c: DressCtx, r: Rect, felt: MatId, seat: MatId): number {
  const ir = innerRect(r, WALL_T + 1.2);
  const alongX = ir.x1 - ir.x0 >= ir.z1 - ir.z0;
  const L = alongX ? ir.x1 - ir.x0 : ir.z1 - ir.z0;
  const W = alongX ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
  const dw = c.rng.pick([1.2, 1.4]), dd = 0.7;
  const podW = 2 * dd + 2 * 0.62;
  const pitch = podW + 0.95;
  const rows = Math.floor((W + 0.95) / pitch);
  if (rows < 1 || L < dw * 2) return 0;
  const groupN = Math.max(2, Math.min(c.rng.int(3, 4), Math.floor(L / dw)));
  const groupLen = groupN * dw;
  const groups = Math.max(1, Math.floor((L + 1.4) / (groupLen + 1.4)));
  const totalL = groups * groupLen + (groups - 1) * 1.4;
  const along0 = (alongX ? ir.x0 : ir.z0) + (L - totalL) / 2;
  const across0 = (alongX ? ir.z0 : ir.x0) + (W - (rows * pitch - 0.95)) / 2 + podW / 2;
  const occ = occupancy(c);
  let placed = 0;
  for (let i = 0; i < rows; i++) {
    const cl = across0 + i * pitch;
    for (let g = 0; g < groups; g++) {
      const g0 = along0 + g * (groupLen + 1.4);
      let any = false;
      for (let k = 0; k < groupN; k++) {
        const a = g0 + (k + 0.5) * dw;
        for (const s of [-1, 1] as const) {
          if (!c.rng.chance(occ)) continue;
          const dc = cl + s * (dd / 2);
          const [x, z] = alongX ? [a, dc] : [dc, a];
          const toward: Dir = alongX ? (s < 0 ? 0 : 2) : (s < 0 ? 1 : 3);
          const sc = cl + s * (dd + 0.34 + c.rng.float(0, 0.12));
          const ja = a + c.rng.float(-0.12, 0.12);
          const [px, pz] = alongX ? [ja, sc] : [sc, ja];
          const screen = c.rng.chance(0.22) ? 'on' : 'off';
          const withChair = !c.rng.chance(0.12);
          const make = (chairToo: boolean) => (B: Box[]) => {
            desk(B, x, z, toward, { w: dw - 0.02, d: dd, screen, drawers: k % 2 === 0 });
            if (chairToo) officeChair(B, px, pz, toward, seat);
          };
          if (build(c, make(withChair)) || (withChair && build(c, make(false)))) { any = true; placed++; }
        }
      }
      // 2 列の間の仕切りのパネル（布張り）
      if (any) {
        const p0 = g0 + 0.02, p1 = g0 + groupLen - 0.02;
        addDecor(c, [alongX
          ? { min: [p0, 0.72, cl - 0.015], max: [p1, 1.15, cl + 0.015], mat: felt, solid: false }
          : { min: [cl - 0.015, 0.72, p0], max: [cl + 0.015, 1.15, p1], mat: felt, solid: false }]);
      }
    }
  }
  return placed;
}

/** 壁に向かう机を n 台まで（小さな部屋）。置いた数を返す */
function wallDesks(c: DressCtx, n: number, seat: MatId): number {
  let placed = 0;
  for (const f of c.rng.shuffle(c.faces.slice())) {
    for (const [p, q] of freeRuns(f, c.openings, 0.9)) {
      for (let at = p + 0.1; at + 1.2 <= q - 0.1 && placed < n; at += 1.5) {
        if (deskAgainst(c, f, at, { w: 1.2, d: 0.65, screen: c.rng.chance(0.25) ? 'on' : 'off', drawers: true }, seat)) placed++;
      }
    }
    if (placed >= n) break;
  }
  return placed;
}

/** オフィスの壁際: 書庫（低い・高い）・書類棚・複合機・給水器 */
function officeWalls(c: DressCtx): void {
  const items = count(c, 1 + c.area / 25, 7);
  let copiers = 0, coolers = 0;
  for (let i = 0; i < items; i++) {
    const kind = c.rng.weighted(['low', 'tall', 'binders', 'copier', 'cooler'] as const, (k) => (k === 'copier' ? (copiers ? 0 : 0.8) : k === 'cooler' ? (coolers ? 0 : 0.6) : 1));
    const ok = kind === 'low' ? onSomeWall(c, 1.6, (B, f, at) => cabinet(B, f, at, 1.6, 0.45, 0.9, c.rng.chance(0.5) ? 'furnitureLight' : 'shelfMetal', c.standoff))
      : kind === 'tall' ? onSomeWall(c, 0.9, (B, f, at) => cabinet(B, f, at, 0.9, 0.45, 1.8, 'shelfMetal', c.standoff))
        : kind === 'binders' ? onSomeWall(c, 0.9, (B, f, at) => wallShelf(B, c.rng, f, at, 0.9, 0.35, Math.min(2.0, c.h - 0.3), 'furnitureLight', 'binders', c.standoff))
          : kind === 'copier' ? onSomeWall(c, 0.62, (B, f, at) => copier(B, f, at, c.standoff + 0.06))
            : onSomeWall(c, 0.32, (B, f, at) => waterCooler(B, f, at, c.standoff + 0.02));
    if (ok && kind === 'copier') copiers++;
    if (ok && kind === 'cooler') coolers++;
  }
}

// ---------------------------------------------------------------- 教室・体育館

/** 教室: 黒板の壁を前に、生徒の机と椅子を前向きに並べる。教卓・後ろの物入れと掲示板・窓・時計 */
export function classroom(c: DressCtx): void {
  if (c.kind === 'hall' && c.area > 140) { gym(c); return; }
  skirting(c, 'trim');
  if (maybe(c, 0.5)) wallBands(c, [{ y0: 0.1, y1: 0.9, mat: 'woodPanel', depth: 0.012 }]);
  const r = mainRect(c);
  const front = mainFaces(c, (f) => f.a1 - f.a0 >= 3, r).sort((a, b) => openingsCount(c, a) - openingsCount(c, b) || runLen(c, b, 0.6) - runLen(c, a, 0.6))[0];
  const run = front && longestRun(c, front, 0.6);
  if (!front || !run || run[1] - run[0] < 2.2) { genericRoom(c); return; }
  const t = (run[0] + run[1]) / 2;
  const bw = Math.min(run[1] - run[0] - 0.4, 4.8);
  const B: Box[] = [];
  chalkboard(B, front, t, bw, 0.9, Math.min(2.1, c.h - 0.35));
  addDecor(c, B);
  // 教卓（先生は黒板を背にして教室を向く）
  const [tx, tz] = facePoint(front, t, c.standoff + 1.0);
  build(c, (T) => desk(T, tx, tz, faceOut(front), { w: 1.2, d: 0.6, h: 0.82, screen: null, mat: 'furnitureLight' }));
  // 生徒の机: 前の壁から 2.4 m、後ろの壁まで 1.1 m。列の間は 0.7 m 以上
  const D = (front.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
  const a0 = Math.max(front.a0, front.horizontal ? r.x0 : r.z0) + WALL_T + 0.75;
  const a1 = Math.min(front.a1, front.horizontal ? r.x1 : r.z1) - WALL_T - 0.75;
  const cols = Math.floor((a1 - a0) / 1.36);
  const rows = Math.floor((D - 2.4 - 1.1) / 1.25) + 1;
  const occ = occupancy(c);
  if (cols >= 1 && rows >= 1) {
    const pa = (a1 - a0) / cols;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (!c.rng.chance(occ)) continue;
        const a = a0 + (j + 0.5) * pa;
        const d = c.standoff + 2.4 + i * 1.25;
        const [x, z] = facePoint(front, a, d);
        const [px, pz] = facePoint(front, a + c.rng.float(-0.05, 0.05), d + 0.42 + c.rng.float(0, 0.08));
        build(c, (T) => { schoolDesk(T, x, z, front.dir); schoolChair(T, px, pz, front.dir); });
      }
    }
  }
  // 後ろの壁: 背の低い物入れ（ロッカー）と掲示板・時計
  const backF = oppositeFace(c, front);
  if (backF) {
    for (const [p, q] of freeRuns(backF, c.openings, 0.9)) lockerRun(c, backF, p + 0.1, q - 0.1, c.rng.chance(0.5) ? 'lockerBlue' : 'furnitureLight', c.standoff, 1.1);
    const br = longestRun(c, backF, 0.6);
    if (br && br[1] - br[0] > 1.6) {
      const T: Box[] = [];
      const w = Math.min(3.6, br[1] - br[0] - 0.4), m = (br[0] + br[1]) / 2;
      board(T, backF, m, w, 1.3, Math.min(2.1, c.h - 0.35), 'noticeGreen');
      papers(T, c.rng, backF, m, w, 1.3, Math.min(2.1, c.h - 0.35), c.rng.int(3, 7));
      addDecor(c, T);
    }
    if (c.h > 2.75) { const T: Box[] = []; wallClock(T, backF, backF.a0 + (backF.a1 - backF.a0) * 0.5, Math.min(c.h - 0.25, 2.45)); addDecor(c, T); }
  }
  // 窓: 横の面のうち開口の少ない方
  const side = mainFaces(c, (f) => f.horizontal !== front.horizontal, r).sort((a, b) => openingsCount(c, a) - openingsCount(c, b))[0];
  if (side) {
    for (const [p, q] of freeRuns(side, c.openings, 0.4)) {
      const T: Box[] = [];
      wallWindow(T, side, p + 0.3, q - 0.3, 0.95, Math.min(2.3, c.h - 0.3), 'trim', 1.8);
      if (T.length) addDecor(c, T);
    }
  }
}

const runLen = (c: DressCtx, f: Face, pad: number): number => { const r = longestRun(c, f, pad); return r ? r[1] - r[0] : 0; };

/** 体育館（学校の広間）: コートの線・壁の得点板と籠・壁際の長椅子と積んだマット */
function gym(c: DressCtx): void {
  skirting(c, 'trim');
  if (c.h > 3) wallBands(c, [{ y0: 0.1, y1: 1.6, mat: 'woodPanel', depth: 0.015 }]);
  const r = mainRect(c);
  const B: Box[] = [];
  const m = 1.6;
  const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
  if (x1 - x0 > 4 && z1 - z0 > 4) {
    const lw = 0.06;
    floorLine(B, x0, z0, x1, z0 + lw, 'wallWhite');
    floorLine(B, x0, z1 - lw, x1, z1, 'wallWhite');
    floorLine(B, x0, z0, x0 + lw, z1, 'wallWhite');
    floorLine(B, x1 - lw, z0, x1, z1, 'wallWhite');
    const alongX = x1 - x0 >= z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (alongX) floorLine(B, cx - lw / 2, z0, cx + lw / 2, z1, 'wallWhite');
    else floorLine(B, x0, cz - lw / 2, x1, cz + lw / 2, 'wallWhite');
    const s = Math.min(1.8, (Math.min(x1 - x0, z1 - z0)) / 5);
    floorLine(B, cx - s, cz - s, cx + s, cz - s + lw, 'yellowLine');
    floorLine(B, cx - s, cz + s - lw, cx + s, cz + s, 'yellowLine');
    floorLine(B, cx - s, cz - s, cx - s + lw, cz + s, 'yellowLine');
    floorLine(B, cx + s - lw, cz - s, cx + s, cz + s, 'yellowLine');
    addDecor(c, B);
  }
  // 籠の板（短い方の壁の高い所）
  if (c.h >= 4.2) {
    for (const f of mainFaces(c, (g) => g.horizontal === (r.x1 - r.x0 < r.z1 - r.z0), r)) {
      const t = (f.a0 + f.a1) / 2;
      const T: Box[] = [];
      T.push(alongFace(f, t - 0.9, 1.8, 0.02, 0.06, 2.9, 3.95, 'paintWhite', false));
      T.push(alongFace(f, t - 0.3, 0.6, 0.06, 0.07, 3.05, 3.45, 'plasticRed', false));
      T.push(alongFace(f, t - 0.23, 0.46, 0.07, 0.5, 3.03, 3.05, 'plasticRed', false));
      addDecor(c, T);
    }
  }
  // 集会: 開口の無い短い面の前に舞台（段で上がる）、舞台を向いたパイプ椅子の列。それ以外は壁際の長椅子とマット
  if (maybe(c, 0.6)) assembly(c, r);
  // 壁際の長椅子・積んだマット
  for (let i = 0; i < count(c, 3, 6); i++) {
    const mat = c.rng.chance(0.5);
    if (mat) onSomeWall(c, 1.8, (T, f, at) => { const [x, z] = facePoint(f, at + 0.9, c.standoff + 0.55); softBlock(T, x - (f.horizontal ? 0.9 : 0.5), z - (f.horizontal ? 0.5 : 0.9), x + (f.horizontal ? 0.9 : 0.5), z + (f.horizontal ? 0.5 : 0.9), c.rng.float(0.2, 0.6), 'plasticBlue', 'whiteFabric'); });
    else onSomeWall(c, 2.4, (T, f, at) => { const [x, z] = facePoint(f, at + 1.2, c.standoff + 0.2); bench(T, f.horizontal, x, z, 2.4, 'handrailWood'); });
  }
  wallExtras(c, ['clock', 'extinguisher'], 2);
}

/** 体育館の集会の並び: 舞台（高さ 0.9 m、端に 0.3 m ずつの段）と、舞台を向いた連結のパイプ椅子の列（中央と両側に通路） */
function assembly(c: DressCtx, r: Rect): void {
  const ends = mainFaces(c, (f) => openingsCount(c, f) === 0 && f.a1 - f.a0 >= 6, r).sort((a, b) => (a.a1 - a.a0) - (b.a1 - b.a0));
  const sf = ends[0];
  if (!sf) return;
  const D = (sf.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
  const A0 = Math.max(sf.a0, sf.horizontal ? r.x0 : r.z0) + WALL_T, A1 = Math.min(sf.a1, sf.horizontal ? r.x1 : r.z1) - WALL_T;
  const sd = Math.min(3.0, D * 0.2);
  // 舞台の前の段（両端）と本体。扉前に掛かれば置かない
  const stage = (B: Box[]): void => {
    B.push(alongFace(sf, A0 + 1.2, A1 - A0 - 2.4, 0, sd, 0, 0.9, 'floorWood', true));
    B.push(alongFace(sf, A0 + 1.2, A1 - A0 - 2.4, sd - 0.03, sd, 0.05, 0.85, 'woodPanel', false));
    for (const [a, w] of [[A0 + 0.15, 1.05], [A1 - 1.2, 1.05]] as const) {
      B.push(alongFace(sf, a, w, 0, sd, 0, 0.6, 'floorWood', true));
      B.push(alongFace(sf, a, w, sd, sd + 0.35, 0, 0.3, 'floorWood', true));
    }
    if (c.h > 3.5) B.push(alongFace(sf, A0 + 1.4, A1 - A0 - 2.8, 0.02, 0.06, 0.9, Math.min(c.h - 0.3, 4.5), 'seatRed', false));
  };
  if (!build(c, stage)) return;
  // 椅子の列
  const d0 = sd + 2.0, d1 = D - 2.0;
  const rows = Math.floor((d1 - d0) / 1.0);
  const mid = (A0 + A1) / 2;
  const blocks: [number, number][] = [[A0 + 1.4, mid - 0.7], [mid + 0.7, A1 - 1.4]];
  const mat = c.rng.pick<MatId>(['metalDark', 'seatBlue', 'furnitureLight']);
  for (let i = 0; i < rows; i++) {
    if (!c.rng.chance(occupancy(c))) continue;
    const d = d0 + i * 1.0;
    for (const [b0, b1] of blocks) {
      for (const [p, q] of splitAlongFace(c, sf, b0, b1, d - 0.3, d + 0.3, 0.1, 1.0)) {
        const n = Math.floor((q - p) / 0.5);
        if (n < 2) continue;
        const [x, z] = facePoint(sf, (p + q) / 2, d);
        build(c, (B) => linkedSeats(B, x, z, n, sf.dir, mat));
      }
    }
  }
}

// ---------------------------------------------------------------- トイレ

/** 公衆トイレ（v1 furnishRestroom）: 開口の少ない面に個室ブースの列、直交する面に洗面台 + 鏡、別の面に小便器。ごみ箱 */
export function restroom(c: DressCtx): void {
  skirting(c, 'metalDark');
  if (c.cell.palette.wall !== 'floorTile') wallBands(c, [{ y0: 0.1, y1: 1.4, mat: 'floorTile', depth: 0.015 }, { y0: 1.4, y1: 1.44, mat: 'metalDark', depth: 0.025 }]);
  const faces = mainFaces(c).sort((a, b) => openingsCount(c, a) - openingsCount(c, b) || runLen(c, b, 1.0) - runLen(c, a, 1.0));
  const boothMat = c.rng.pick<MatId>(['furnitureLight', 'paintWhite', 'lockerBlue', 'woodPanel']);
  const boothFaces: Face[] = [];
  const maxBooth = c.kind === 'hall' ? 3 : 1;
  for (const f of faces) {
    if (boothFaces.length >= maxBooth) break;
    const run = longestRun(c, f, 1.0);
    if (!run || run[1] - run[0] < 1.9) continue;
    const [a0, a1] = run;
    let ok = false;
    for (let n = Math.min(10, Math.floor((a1 - a0 - 0.1) / 0.9)); n >= 2 && !ok; n--) {
      for (const start of [(a0 + a1) / 2 - n * 0.45, a1 - 0.05 - n * 0.9, a0 + 0.05]) {
        if (build(c, (B) => booths(B, f, start, n, 1.4, boothMat))) { ok = true; break; }
      }
    }
    if (ok) boothFaces.push(f);
  }
  const first = boothFaces[0];
  // 洗面台: ブースと直交する面
  let sinkFace: Face | null = null;
  for (const f of faces.filter((g) => !boothFaces.includes(g) && (!first || g.horizontal !== first.horizontal))) {
    let done = false;
    for (const [a0, a1] of freeRuns(f, c.openings, 1.0)) {
      for (let n = Math.min(6, Math.floor((a1 - a0 - 0.2) / 0.75)); n >= 1 && !done; n--) {
        for (const start of [(a0 + a1) / 2 - (n * 0.75) / 2, a1 - 0.1 - n * 0.75, a0 + 0.1]) {
          if (build(c, (B) => sinkRow(B, f, start, n))) { done = true; sinkFace = f; break; }
        }
      }
      if (done) break;
    }
    if (done) break;
  }
  // 小便器 2〜4 台: ブース・洗面台と別の面
  outer: for (const f of faces.filter((g) => !boothFaces.includes(g) && g !== sinkFace)) {
    for (const [a0, a1] of freeRuns(f, c.openings, 1.0)) {
      for (let n = Math.min(4, Math.floor((a1 - a0 - 0.2) / 0.75)); n >= 2; n--) {
        for (const start of [(a0 + a1) / 2 - (n * 0.75) / 2, a1 - 0.1 - n * 0.75, a0 + 0.1]) {
          if (build(c, (B) => urinalRow(B, f, start, n))) break outer;
        }
      }
    }
  }
  // ごみ箱・手の乾燥機（壁の白い箱）
  if (sinkFace) {
    const sf = sinkFace;
    onSomeWall(c, 0.4, (B, f, at) => { const [x, z] = facePoint(f, at + 0.2, c.standoff + 0.2); bin(B, x, z, 'stainless', 0.34, 0.65); }, { faces: [sf] });
    const T: Box[] = [];
    const run = longestRun(c, sf, 0.4);
    if (run) {
      T.push(alongFace(sf, run[1] - 0.45, 0.3, 0, 0.2, 1.05, 1.35, 'paintWhite', false));
      addDecor(c, T);
    }
  }
}

// ---------------------------------------------------------------- 更衣室

/**
 * 更衣室（v1 furnishLocker）: タイルの腰壁、壁沿いのロッカー列、広い部屋は背中合わせのロッカーの島、通路の中央に木の長椅子。
 * 島と通路は入口から奥へ向ける（入口から通路を見通す）
 */
export function lockerRoom(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 1.2, mat: 'floorTile', depth: 0.02 }, { y0: 1.2, y1: 1.24, mat: 'trim', depth: 0.03 }]);
  const r = mainRect(c);
  const ef = faceOf(c, entrance(c));
  const alongX = ef && ef.rect === r ? !ef.horizontal : (r.x1 - r.x0) > (r.z1 - r.z0) * 1.4;
  // 入口が長い軸の低い側か
  const entLow = ef && ef.rect === r ? (alongX ? ef.dir === 3 : ef.dir === 2) : true;
  const mat = c.rng.pick<MatId>(['lockerGreen', 'lockerBlue']);
  for (const f of c.faces.filter((g) => g.horizontal === alongX)) for (const [a0, a1] of freeRuns(f, c.openings, 1.0)) lockerRun(c, f, a0 + 0.1, a1 - 0.1, mat, c.standoff);
  const inS0 = (alongX ? r.z0 : r.x0) + WALL_T + 0.52;
  const inS1 = (alongX ? r.z1 : r.x1) - WALL_T - 0.52;
  const avail = inS1 - inS0;
  const aisleMin = 2.8;
  const islands = Math.max(0, Math.floor((avail - aisleMin) / (1.0 + aisleMin)));
  const aisleW = (avail - islands * 1.0) / (islands + 1);
  const lo = (alongX ? r.x0 : r.z0) + WALL_T, hi = (alongX ? r.x1 : r.z1) - WALL_T;
  const l0 = lo + (entLow ? 3.2 : 1.8), l1 = hi - (entLow ? 1.8 : 3.2);
  const aisles: number[] = [];
  for (let i = 0; i < islands && l1 - l0 > 1.2; i++) {
    const center = inS0 + aisleW * (i + 1) + 1.0 * i + 0.5;
    for (const inw of [1, -1] as const) lockerRun(c, lineFace(alongX, center, inw, l0, l1), l0, l1, mat, 0);
  }
  for (let i = 0; i <= islands; i++) aisles.push(inS0 + aisleW * i + 1.0 * i + aisleW / 2);
  // 長椅子（通路の中央。1.8 m の節）
  for (const a of aisles) {
    const b0 = l0 + 0.3, b1 = l1 - 0.3;
    const seg = 1.8, gap = 0.4;
    const n = Math.max(0, Math.floor((b1 - b0 + gap) / (seg + gap)));
    const start = (b0 + b1) / 2 - (n * (seg + gap) - gap) / 2 + seg / 2;
    for (let k = 0; k < n; k++) {
      if (!c.rng.chance(occupancy(c))) continue;
      const l = start + k * (seg + gap);
      build(c, (B) => bench(B, alongX, alongX ? l : a, alongX ? a : l, seg, 'handrailWood'));
    }
  }
  wallExtras(c, ['clock'], 1);
}

// ---------------------------------------------------------------- 店

/** 店（v1 RetailRoom）: 陳列棚の列（通路は入口から奥へ）+ 壁の棚・冷蔵ケース + 入口の近くのレジ。2 割はコインランドリー */
export function retail(c: DressCtx): void {
  if (c.area >= 16 && c.area <= 120 && c.rng.chance(0.2)) { laundry(c); return; }
  skirting(c, 'metalDark');
  const ent = entrance(c);
  const ef = faceOf(c, ent);
  const r = mainRect(c);
  const sh = Math.min(1.55, c.h - 0.7);
  // レジ（入口の内側、横にずらす）
  if (ent && ef) {
    const [ix, iz] = facePoint(ef, along2(ent), c.standoff + 2.4);
    const side = c.rng.chance(0.5) ? 1 : -1;
    const [ox, oz] = ef.horizontal ? [side * 2.2, 0] : [0, side * 2.2];
    const toward: Dir = ef.horizontal ? (side > 0 ? 3 : 1) : (side > 0 ? 2 : 0);
    placeNear(c, ix + ox, iz + oz, (B, x, z) => reception(B, x, z, 1.6, 0.6, toward, 'shelfMetal', 'metal', 0.95), 0.4, 1.6);
  }
  // 冷蔵ケース（入口の向かいの面）
  const back = ef ? oppositeFace(c, ef) : mainFaces(c, () => true, r)[0];
  if (back && maybe(c, 0.8)) {
    const run = longestRun(c, back, 1.0);
    if (run && run[1] - run[0] >= 1.8) {
      const len = Math.min(run[1] - run[0] - 0.2, 6);
      build(c, (B) => coolerCase(B, c.rng, back, (run[0] + run[1]) / 2 - len / 2, len, Math.min(2.0, c.h - 0.3), c.standoff));
    }
  }
  // 陳列棚の列（通路が入口から奥へ向かう向き）
  const axis: 'x' | 'z' = ef ? (ef.horizontal ? 'z' : 'x') : (r.x1 - r.x0 >= r.z1 - r.z0 ? 'x' : 'z');
  patternRows(c, {
    spacing: 2.5, depth: 0.9, height: sh, mat: 'shelfMetal', gapEvery: 4.5, margin: 1.6, axis, kind: 'shelf',
    build: (B, x0, z0, x1, z1) => shelfIsland(B, c.rng, x0, z0, x1, z1, sh, 'shelfMetal', 'goods', 'metalDark'),
  });
  // 壁の棚
  for (const f of c.faces) {
    if (f === ef || f === back || !maybe(c, 0.75)) continue;
    for (const [p, q] of freeRuns(f, c.openings, 1.0)) {
      lineUp(c, p + 0.1, q - 0.1, 1.2, 0.05, (B, at) => wallShelf(B, c.rng, f, at, 1.2, 0.5, Math.min(1.9, c.h - 0.4), 'shelfMetal', 'goods', c.standoff));
    }
  }
  if (maybe(c, 0.6)) onSomeWall(c, 0.4, (B, f, at) => { const [x, z] = facePoint(f, at + 0.2, c.standoff + 0.2); bin(B, x, z); });
}

const along2 = (s: { pos: [number, number, number]; dir: number }): number => (s.dir === 0 || s.dir === 2 ? s.pos[0] : s.pos[2]);

/**
 * コインランドリー（v1 furnishLaundry）: 長い辺の壁に洗濯機 / 乾燥機（2 段）の列、広い部屋は背中合わせの洗濯機の島、
 * 通路の中央に折り畳み台、待つ人の長椅子と自販機
 */
export function laundry(c: DressCtx): void {
  skirting(c, 'metalDark');
  const r = mainRect(c);
  const alongX = (r.x1 - r.x0) > (r.z1 - r.z0) * 1.4 || (r.x1 - r.x0 >= r.z1 - r.z0 && c.rng.chance(0.5));
  mainFaces(c, (f) => f.horizontal === alongX, r).forEach((f, idx) => {
    for (const [a0, a1] of freeRuns(f, c.openings, 1.0)) {
      const n = Math.floor((a1 - a0 - 0.2) / WASHER_PITCH);
      if (n <= 0) continue;
      const start = (a0 + a1) / 2 - (n * WASHER_PITCH - 0.02) / 2;
      for (let k = 0; k < n; k++) build(c, (B) => washer(B, f, start + k * WASHER_PITCH, idx === 1 || k % 3 === 2));
    }
  });
  // 島（背中合わせ）と通路
  const inS0 = (alongX ? r.z0 : r.x0) + WALL_T + WASHER_OUT, inS1 = (alongX ? r.z1 : r.x1) - WALL_T - WASHER_OUT;
  const aisleMin = 3.2, islandD = WASHER_OUT * 2;
  const islands = Math.max(0, Math.floor((inS1 - inS0 - aisleMin) / (islandD + aisleMin)));
  const aisleW = (inS1 - inS0 - islands * islandD) / (islands + 1);
  const l0 = (alongX ? r.x0 : r.z0) + WALL_T + 2.0, l1 = (alongX ? r.x1 : r.z1) - WALL_T - 2.0;
  for (let i = 0; i < islands && l1 - l0 > 1.5; i++) {
    const center = inS0 + aisleW * (i + 1) + islandD * i + islandD / 2;
    for (const inw of [1, -1] as const) {
      const f = lineFace(alongX, center, inw, l0, l1);
      const n = Math.floor((l1 - l0 - 0.2) / WASHER_PITCH);
      const start = (l0 + l1) / 2 - (n * WASHER_PITCH - 0.02) / 2;
      for (let k = 0; k < n; k++) build(c, (B) => washer(B, f, start + k * WASHER_PITCH, k % 4 === 1));
    }
  }
  // 折り畳み台（通路の中央）
  for (let i = 0; i <= islands; i++) {
    const a = inS0 + aisleW * i + islandD * i + aisleW / 2;
    if (aisleW < 2.6) continue;
    const n = Math.max(1, Math.floor((l1 - l0 + 0.6) / 2.6));
    const start = (l0 + l1) / 2 - (n * 2.6 - 0.6) / 2 + 1.0;
    for (let k = 0; k < n; k++) {
      const l = start + k * 2.6;
      build(c, (B) => longTable(B, alongX ? l : a, alongX ? a : l, alongX, 2.0, 0.8, 0.78, 'furnitureLight'));
    }
  }
  onSomeWall(c, 1.8, (B, f, at) => { const [x, z] = facePoint(f, at + 0.9, c.standoff + 0.2); bench(B, f.horizontal, x, z, 1.8, 'handrailWood'); });
  if (maybe(c, 0.6)) onSomeWall(c, 0.9, (B, f, at) => vending(B, f, at, 'lightPanel', c.standoff + 0.03));
  wallExtras(c, ['clock', 'board'], 2);
}

// ---------------------------------------------------------------- 小部屋・汎用・大部屋

/** 小部屋: 休憩室 / 会議室 / 物置 / 小さな事務室 / 自販機コーナー のどれか（大きければ大部屋の型） */
export function smallRoom(c: DressCtx): void {
  if (c.area > 70) { largeRoom(c); return; }
  skirting(c, 'trim');
  const type = c.rng.weighted(['breakroom', 'meeting', 'storage', 'office', 'vending'] as const, (k) => ({ breakroom: 3, meeting: 2.5, storage: 2, office: 2, vending: 1 })[k]);
  const r = mainRect(c);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  switch (type) {
    case 'breakroom': {
      // 流し台 + 冷蔵庫、角机 + 椅子 4 脚（v1 furnishBreakroom）
      onSomeWall(c, 2.4, (B, f, at) => { kitchenette(B, f, at, 1.6, c.standoff); fridge(B, f, at + 1.7, c.standoff); });
      placeNear(c, cx, cz, (B, x, z) => {
        lowTable(B, x, z, 0.9, 0.9, 0.72, 'furnitureLight');
        for (const [dx, dz, fc] of [[0, -0.75, 0], [0, 0.75, 2], [-0.75, 0, 1], [0.75, 0, 3]] as const) if (!c.rng.chance(0.15)) chair(B, x + dx, z + dz, fc as Dir, c.rng.pick<MatId>(['seatBlue', 'plasticRed', 'furnitureDark']));
      }, 0.3, 1.5);
      if (maybe(c, 0.5)) onSomeWall(c, 0.9, (B, f, at) => vending(B, f, at, 'lightPanel', c.standoff + 0.03));
      break;
    }
    case 'meeting': {
      const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
      const len = Math.min(3.6, (alongX ? r.x1 - r.x0 : r.z1 - r.z0) - 2.6);
      if (len >= 1.2) {
        placeNear(c, cx, cz, (B, x, z) => {
          longTable(B, x, z, alongX, len, 1.0, 0.72, 'furnitureDark');
          const n = Math.max(1, Math.floor(len / 0.75));
          for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
            if (c.rng.chance(0.15)) continue;
            const t = -len / 2 + (len / n) * (k + 0.5);
            const [px, pz] = alongX ? [x + t, z + s * 0.85] : [x + s * 0.85, z + t];
            officeChair(B, px, pz, alongX ? (s > 0 ? 2 : 0) : (s > 0 ? 3 : 1), 'metalDark');
          }
        }, 0.3, 1.2);
      }
      const T: Box[] = [];
      const f = mainFaces(c, (g) => runLen(c, g, 0.6) > 2.2, r)[0];
      if (f) { const run = longestRun(c, f, 0.6)!; whiteboard(T, f, (run[0] + run[1]) / 2, Math.min(2.4, run[1] - run[0] - 0.4), 0.9, Math.min(1.9, c.h - 0.4)); addDecor(c, T); }
      break;
    }
    case 'storage': {
      for (const f of c.faces) for (const [p, q] of freeRuns(f, c.openings, 0.9)) lineUp(c, p + 0.05, q - 0.05, 1.2, 0.05, (B, at) => wallShelf(B, c.rng, f, at, 1.2, 0.5, Math.min(2.0, c.h - 0.3), 'shelfMetal', 'boxes', c.standoff));
      for (let i = 0; i < count(c, 2, 4); i++) placeNear(c, c.rng.float(r.x0 + 1, r.x1 - 1), c.rng.float(r.z0 + 1, r.z1 - 1), (B, x, z) => crate(B, x, z, c.rng.float(0.4, 0.7), c.rng.float(0.3, 0.8)), 0.3, 1.0);
      break;
    }
    case 'office': {
      wallDesks(c, count(c, 2.5, 4), 'seatBlue');
      onSomeWall(c, 0.9, (B, f, at) => cabinet(B, f, at, 0.9, 0.45, 1.8, 'shelfMetal', c.standoff));
      break;
    }
    case 'vending': {
      onSomeWall(c, 2.0, (B, f, at) => { vending(B, f, at, 'lightPanel', c.standoff + 0.03); if (c.rng.chance(0.7)) vending(B, f, at + 1.0, 'lightWarm', c.standoff + 0.03); });
      onSomeWall(c, 1.8, (B, f, at) => { const [x, z] = facePoint(f, at + 0.9, c.standoff + 0.2); bench(B, f.horizontal, x, z, 1.8, 'handrailWood'); });
      onSomeWall(c, 0.4, (B, f, at) => { const [x, z] = facePoint(f, at + 0.2, c.standoff + 0.2); bin(B, x, z); });
      break;
    }
  }
  cornerPlants(c, count(c, 0.7, 2));
  wallExtras(c, ['clock', 'board', 'picture'], count(c, 1.0, 2));
}

/**
 * 汎用の部屋（v1 GenericRoom = furnishGeneric 'plain'）+ 鉢植え・壁の飾り。
 * v1 の汎用の型は大部屋向けで、40 m² 未満ではほとんど何も置かれないので、小さな部屋は小部屋の型にする
 */
export function genericRoom(c: DressCtx): void {
  if (c.area < 40) { smallRoom(c); return; }
  if (maybe(c, 0.5)) { largeRoom(c); return; }
  genericPattern(c, 'plain');
}

/** v1 の汎用の型（furnishGeneric）+ 鉢植え・壁の飾り */
export function genericPattern(c: DressCtx, style: GenericStyle): void {
  skirting(c, 'trim');
  furnishGeneric(c, c.area, style);
  cornerPlants(c, count(c, 1.0, 3));
  wallExtras(c, ['clock', 'board', 'picture', 'whiteboard'], count(c, 1.2, 3));
}

/**
 * 大部屋（v1 LargeRoom = 型をランダムに選ぶ furnishGeneric）。v2 には部屋ごとの飾り付けの段が無いので、
 * 食堂・宴会場・待合・事務室・ラウンジ・家具置き場・v1 の汎用の型 のどれかにする
 */
export function largeRoom(c: DressCtx): void {
  if (c.area < 40) { smallRoom(c); return; }
  const type = c.rng.weighted(['cafeteria', 'banquet', 'waiting', 'office', 'lounge', 'stacked', 'generic'] as const,
    (k) => ({ cafeteria: 2, banquet: 1.5, waiting: 1, office: 1, lounge: 1.2, stacked: 1, generic: 1.5 })[k]);
  switch (type) {
    case 'cafeteria': cafeteria(c); return;
    case 'banquet': banquet(c); return;
    case 'waiting': waiting(c); return;
    case 'office': office(c); return;
    case 'lounge': {
      skirting(c, 'metalDark');
      if (c.area > 150) patternColumns(c, 8);
      patternIslands(c, 1 / 22, undefined, 'sofa', (B, x, z, sx, sz) => {
        rug(B, x - sx - 0.2, z - sz - 0.2, x + sx + 0.2, z + sz + 0.2, 'carpetPattern');
        sofaIsland(c, c.rng.pick<MatId>(['upholstery', 'seatBlue', 'whiteFabric']))(B, x, z, sx, sz);
      });
      cornerPlants(c, 4, 0.6, 1.6);
      wallExtras(c, ['picture', 'clock'], count(c, 2, 4));
      return;
    }
    case 'stacked': stackedFurniture(c); return;
    default: genericPattern(c, c.rng.pick<GenericStyle>(['plain', 'office', 'retail', 'soft']));
  }
}

/**
 * 社員食堂（v1 furnishCafeteria）: 長机の列（列間 2.7 m・机間 0.9 m・両側に椅子）、短い辺の壁に自販機 2〜3 台、
 * 反対の短い辺に返却台、時計と鉢植え
 */
export function cafeteria(c: DressCtx): void {
  skirting(c, 'metalDark');
  const r = mainRect(c);
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const m = 2.1;
  const ir = innerRect(r, m);
  const shortLen = alongX ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
  const longLen = alongX ? ir.x1 - ir.x0 : ir.z1 - ir.z0;
  const rowPitch = 2.7;
  const rows = Math.max(1, Math.floor((shortLen - 1.75) / rowPitch) + 1);
  const rowStart = (alongX ? ir.z0 : ir.x0) + (shortLen - (rows - 1) * rowPitch) / 2;
  const gap = 0.9, unit = 1.8 + gap;
  const per = Math.max(1, Math.floor((longLen + gap) / unit));
  const colStart = (alongX ? ir.x0 : ir.z0) + (longLen - per * unit + gap) / 2 + 0.9;
  const mid = (alongX ? ir.x0 + ir.x1 : ir.z0 + ir.z1) / 2;
  const crossAisle = longLen > 11;
  const seat = c.rng.pick<MatId>(['seatBlue', 'plasticRed', 'furnitureDark']);
  for (let i = 0; i < rows; i++) {
    const a = rowStart + i * rowPitch;
    for (let j = 0; j < per; j++) {
      const l = colStart + j * unit;
      if (crossAisle && Math.abs(l - mid) < 1.4) continue;
      if (!c.rng.chance(occupancy(c))) continue;
      const cx = alongX ? l : a, cz = alongX ? a : l;
      build(c, (B) => {
        longTable(B, cx, cz, alongX, 1.8, 0.75, 0.72, 'furnitureLight');
        for (const side of [-1, 1]) for (const k of [-0.45, 0.45]) {
          if (c.rng.chance(0.08)) continue;
          const off = 0.375 + 0.05 + 0.225;
          const px = alongX ? cx + k : cx + side * off, pz = alongX ? cz + side * off : cz + k;
          chair(B, px, pz, (alongX ? (side > 0 ? 2 : 0) : (side > 0 ? 3 : 1)) as Dir, seat);
        }
      });
    }
  }
  const shortFaces = mainFaces(c, (f) => f.horizontal !== alongX, r);
  const vendFace = shortFaces[0];
  if (vendFace) {
    const run = longestRun(c, vendFace, 1.0);
    if (run && run[1] - run[0] >= 2.0) {
      const n = Math.min(3, Math.floor((run[1] - run[0] - 0.4) / 1.0));
      lineUp(c, run[0], run[1], 0.9, 0.1, (B, at, k) => vending(B, vendFace, at, k === 1 ? 'lightWarm' : 'lightPanel', c.standoff + 0.03), n);
    }
  }
  const counterFace = shortFaces.find((f) => f !== vendFace);
  if (counterFace) {
    const run = longestRun(c, counterFace, 1.0);
    if (run && run[1] - run[0] >= 2.0) {
      const len = Math.min(3.6, run[1] - run[0] - 0.4);
      const at = (run[0] + run[1]) / 2 - len / 2;
      build(c, (B) => {
        counter(B, counterFace, at, len, 0.6, 0.9, 'shelfMetal', 'metal', c.standoff);
        B.push(alongFace(counterFace, at + 0.2, len - 0.4, 0.0, 0.012, 0.95, 1.75, 'void', false));
        B.push(alongFace(counterFace, at + 0.2, len - 0.4, 0.0, 0.5, 0.93, 0.95, 'metal', false));
      });
    }
  }
  cornerPlants(c, count(c, 2, 4), 0.6, 1.5);
  wallExtras(c, ['clock', 'board'], 2);
}

/** 宴会場・集会室: 角卓（4 人掛け）の格子と、開口の無い壁の前の演台と低い壇 */
export function banquet(c: DressCtx): void {
  skirting(c, 'trim');
  const r = mainRect(c);
  const front = mainFaces(c, (f) => openingsCount(c, f) === 0 && f.a1 - f.a0 >= 4, r)[0];
  if (front) {
    const run = longestRun(c, front, 0.6);
    if (run && run[1] - run[0] > 3) {
      const m = (run[0] + run[1]) / 2;
      const w = Math.min(6, run[1] - run[0] - 1);
      build(c, (B) => {
        B.push(alongFace(front, m - w / 2, w, 0, 1.6, 0, 0.3, 'floorWood', true));
        const [x, z] = facePoint(front, m, 0.9);
        B.push({ min: [x - 0.3, 0.3, z - 0.25], max: [x + 0.3, 1.45, z + 0.25], mat: 'woodPanel', solid: true, kind: 'lectern' });
      });
    }
  }
  const tableMat = c.rng.pick<MatId>(['whiteFabric', 'furnitureLight', 'furnitureDark']);
  const seat = c.rng.pick<MatId>(['seatRed', 'upholstery', 'metalDark']);
  for (const q of c.rects) {
    const ir = innerRect(q, 1.9);
    for (const x of centeredRow(ir.x0, ir.x1, 2.9)) {
      for (const z of centeredRow(ir.z0, ir.z1, 2.9)) {
        if (!c.rng.chance(occupancy(c))) continue;
        build(c, (B) => {
          lowTable(B, x, z, 1.1, 1.1, 0.72, tableMat);
          for (const [dx, dz, fc] of [[0, -0.85, 0], [0, 0.85, 2], [-0.85, 0, 1], [0.85, 0, 3]] as const) if (!c.rng.chance(0.12)) chair(B, x + dx, z + dz, fc as Dir, seat);
        });
      }
    }
  }
  cornerPlants(c, count(c, 2, 4), 0.6, 1.6);
  wallExtras(c, ['clock', 'picture'], 2);
}

/** a0..a1 に間隔 sp で中央寄せの位置 */
function centeredRow(a0: number, a1: number, sp: number): number[] {
  if (a1 < a0) return [];
  const n = Math.floor((a1 - a0) / sp + 1e-6) + 1;
  const start = (a0 + a1) / 2 - ((n - 1) * sp) / 2;
  return Array.from({ length: n }, (_, i) => start + i * sp);
}

/** 家具置き場になった大部屋: 壁際に積み重ねた椅子・立て掛けた折り畳みの机、ぽつぽつと残った椅子（柱があれば柱も） */
export function stackedFurniture(c: DressCtx): void {
  skirting(c, 'trim');
  if (c.area > 150) patternColumns(c, 8);
  const seat = c.rng.pick<MatId>(['seatBlue', 'metalDark', 'plasticRed']);
  for (let i = 0; i < count(c, 2 + c.area / 40, 8); i++) {
    if (c.rng.chance(0.5)) {
      // 椅子の山（座の箱を 8 cm ずつ重ねる。いちばん下だけソリッド）
      onSomeWall(c, 0.5, (B, f, at) => {
        const [x, z] = facePoint(f, at + 0.25, c.standoff + 0.3);
        const n = c.rng.int(4, 10);
        chair(B, x, z, faceOut(f), seat);
        for (let k = 1; k < n; k++) {
          const y = k * 0.08;
          B.push({ min: [x - 0.225, 0.41 + y, z - 0.225], max: [x + 0.225, 0.45 + y, z + 0.225], mat: seat, solid: false });
          B.push(alongFace(f, at + 0.025, 0.45, c.standoff + 0.05, c.standoff + 0.1, 0.45 + y, 0.85 + y, seat, false));
        }
      }, { pad: 0.9 });
    } else {
      // 立て掛けた折り畳みの机（壁に寄せた薄い板）
      onSomeWall(c, 1.8, (B, f, at) => {
        B.push(alongFace(f, at, 1.8, c.standoff, c.standoff + 0.12, 0, 0.75, 'furnitureLight', true));
        B.push(alongFace(f, at + 0.1, 1.6, c.standoff + 0.12, c.standoff + 0.16, 0.05, 0.7, 'metalDark', false));
      }, { pad: 0.9 });
    }
  }
  for (let i = 0; i < count(c, 1.5, 4); i++) {
    const q = c.rng.pick(c.rects);
    placeNear(c, c.rng.float(q.x0 + 2, q.x1 - 2), c.rng.float(q.z0 + 2, q.z1 - 2), (B, x, z) => chair(B, x, z, c.rng.pick([0, 1, 2, 3] as Dir[]), seat), 0.3, 1.0);
  }
}

// ---------------------------------------------------------------- ホテルの客室

/** ホテルの客室: ベッド（ダブル / ツイン）+ ナイトテーブルと灯り、机と椅子と鏡、テレビ、物入れ、肘掛け椅子、敷物 */
export function hotelRoom(c: DressCtx): void {
  skirting(c, 'trim');
  const r = mainRect(c);
  const ef = faceOf(c, entrance(c));
  addDecor(c, [{ min: [r.x0 + 0.6, 0.002, r.z0 + 0.6], max: [r.x1 - 0.6, 0.01, r.z1 - 0.6], mat: 'carpetPattern', solid: false }]);
  const faces = mainFaces(c, (f) => f !== ef, r).sort((a, b) => runLen(c, b, 0.8) - runLen(c, a, 0.8));
  let bedFace: Face | null = null;
  for (const f of faces) {
    const run = longestRun(c, f, 0.8);
    if (!run || run[1] - run[0] < 1.8) continue;
    const m = (run[0] + run[1]) / 2;
    const twin = run[1] - run[0] >= 3.4 && c.rng.chance(0.5);
    const cover = c.rng.pick<MatId>(['seatBlue', 'upholstery', 'whiteFabric', 'seatRed']);
    const ok = twin
      ? build(c, (B) => { bed(B, f, m - 1.3, 1.0, 2.0, 'furnitureDark', cover, c.standoff); bed(B, f, m + 0.3, 1.0, 2.0, 'furnitureDark', cover, c.standoff); nightstand(B, f, m - 0.25, c.standoff); })
      : build(c, (B) => { bed(B, f, m - 0.75, 1.5, 2.0, 'furnitureDark', cover, c.standoff); if (run[1] - run[0] > 2.6) { nightstand(B, f, m - 1.3, c.standoff); nightstand(B, f, m + 0.82, c.standoff); } });
    if (ok) { bedFace = f; break; }
  }
  // 机と椅子（ベッドと別の面）+ 鏡 + テレビ
  const others = c.faces.filter((f) => f !== bedFace);
  onSomeWall(c, 1.2, (B, f, at) => {
    const [x, z] = facePoint(f, at + 0.6, c.standoff + 0.27);
    desk(B, x, z, f.dir, { w: 1.2, d: 0.5, screen: null, panel: true });
    const [px, pz] = facePoint(f, at + 0.6, c.standoff + 0.8);
    chair(B, px, pz, f.dir, 'upholstery');
    lamp(B, ...facePoint(f, at + 0.2, c.standoff + 0.2), 0.72);
    B.push(alongFace(f, at + 0.25, 0.7, 0, 0.012, 1.0, 1.7, 'carGlass', false));
  }, { faces: others });
  if (bedFace) {
    const tv = oppositeFace(c, bedFace);
    const run = tv && longestRun(c, tv, 0.6);
    if (tv && run && run[1] - run[0] > 1.4) { const T: Box[] = []; wallScreen(T, tv, (run[0] + run[1]) / 2, 0.9, 1.1, 1.62, null); addDecor(c, T); }
  }
  onSomeWall(c, 1.0, (B, f, at) => cabinet(B, f, at, 1.0, 0.6, Math.min(2.0, c.h - 0.3), 'furnitureDark', c.standoff));
  if (maybe(c, 0.7)) placeNear(c, r.x1 - 1.0, r.z1 - 1.0, (B, x, z) => sofa(B, x, z, 0.8, c.rng.pick([0, 1, 2, 3] as Dir[]), 'upholstery', 0.8), 0.3, 1.2);
}

/** ナイトテーブル（面に付ける小さな戸棚 + 電気スタンド） */
function nightstand(B: Box[], f: Face, at: number, standoff: number): void {
  cabinet(B, f, at, 0.45, 0.4, 0.55, 'furnitureDark', standoff);
  const [x, z] = facePoint(f, at + 0.225, standoff + 0.2);
  lamp(B, x, z, 0.55);
}

// ---------------------------------------------------------------- 病院

/** 診察室: 診察台・医師の机と画面・患者の丸椅子・薬品棚・洗面台・仕切りのカーテン */
export function clinic(c: DressCtx): void {
  if (c.kind === 'hall' || c.area > 60) { waiting(c); return; }
  skirting(c, 'trim');
  wallBands(c, [{ y0: 0.1, y1: 1.0, mat: 'wainscotCream', depth: 0.012 }]);
  let bedF: Face | null = null;
  onSomeWall(c, 1.9, (B, f, at) => {
    examBed(B, f, at, c.standoff + 0.08);
    // カーテン（天井のレールから下がる布。当たらない）
    const y1 = Math.min(c.h - 0.05, 2.4);
    B.push(alongFace(f, at - 0.1, 2.1, 1.05, 1.08, 0.3, y1 - 0.06, 'whiteFabric', false));
    B.push(alongFace(f, at - 0.1, 2.1, 1.04, 1.09, y1 - 0.06, y1, 'metal', false));
    bedF = f;
  });
  onSomeWall(c, 1.2, (B, f, at) => {
    const [x, z] = facePoint(f, at + 0.6, c.standoff + 0.3);
    desk(B, x, z, f.dir, { w: 1.2, d: 0.6, screen: 'on', drawers: true });
    const [px, pz] = facePoint(f, at + 0.6, c.standoff + 0.95);
    officeChair(B, px, pz, f.dir, 'paintWhite');
  }, { faces: c.faces.filter((f) => f !== bedF) });
  onSomeWall(c, 0.9, (B, f, at) => cabinet(B, f, at, 0.9, 0.4, 1.8, 'paintWhite', c.standoff));
  onSomeWall(c, 0.75, (B, f, at) => sinkRow(B, f, at, 1));
  wallExtras(c, ['clock', 'board'], count(c, 1, 2));
}

/** 待合（v1 furnishWaiting）: 入口の向かいの壁に受付カウンター + 窓口の衝立、青い連結椅子の列（窓口を向く）、テレビ・鉢植え */
export function waiting(c: DressCtx): void {
  skirting(c, 'trim');
  const r = mainRect(c);
  const ef = faceOf(c, entrance(c));
  const north = (ef && oppositeFace(c, ef)) ?? mainFaces(c, () => true, r)[0];
  let counterDepth = 0;
  if (north) {
    const run = longestRun(c, north, 1.0);
    if (run && run[1] - run[0] >= 2.4) {
      const len = Math.min(7.2, run[1] - run[0] - 0.6);
      const at = (run[0] + run[1]) / 2 - len / 2;
      if (build(c, (B) => {
        counter(B, north, at, len, 0.75, 1.05, 'furnitureLight', 'furnitureDark', c.standoff);
        const n = Math.max(1, Math.floor(len / 1.8));
        for (let k = 0; k < n; k++) B.push(alongFace(north, at + (len / n) * k + 0.15, len / n - 0.3, c.standoff + 0.05, c.standoff + 0.07, 1.05, 1.95, 'glass', false));
      })) counterDepth = 0.85;
    }
  }
  // 椅子の列: 窓口の面を向く。窓口側から詰め、入口側を空ける
  const front = north;
  if (front) {
    const D = (front.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
    const a0 = Math.max(front.a0, front.horizontal ? r.x0 : r.z0) + WALL_T + 1.4;
    const a1 = Math.min(front.a1, front.horizontal ? r.x1 : r.z1) - WALL_T - 1.4;
    const benchLen = 2.0;
    const groups = Math.max(1, Math.floor((a1 - a0 + 0.8) / (benchLen + 0.8)));
    const rows = Math.min(10, Math.max(0, Math.floor((D - counterDepth - 2.4 - 1.4) / 1.6) + 1));
    const g0 = (a0 + a1) / 2 - (groups * (benchLen + 0.8) - 0.8) / 2 + benchLen / 2;
    for (let i = 0; i < rows; i++) {
      for (let g = 0; g < groups; g++) {
        if (!c.rng.chance(occupancy(c))) continue;
        const [x, z] = facePoint(front, g0 + g * (benchLen + 0.8), c.standoff + counterDepth + 2.4 + i * 1.6);
        build(c, (B) => linkedSeats(B, x, z, 4, front.dir));
      }
    }
  }
  const side = mainFaces(c, (f) => front !== undefined && f.horizontal !== front.horizontal, r)[0];
  const run = side && longestRun(c, side, 0.8);
  if (side && run && run[1] - run[0] > 1.6 && c.h > 2.6) { const T: Box[] = []; wallScreen(T, side, (run[0] + run[1]) / 2, 1.1, 1.75, 2.38, maybe(c, 0.5) ? 'screenLcd' : null); addDecor(c, T); }
  cornerPlants(c, count(c, 1.5, 4));
  wallExtras(c, ['clock', 'board'], 2);
}

// ---------------------------------------------------------------- 住居

/** 集合住宅の部屋: 台所（流し + 冷蔵庫）、食卓と椅子、ソファと低い卓とテレビ台、敷物・本棚。狭ければ布団と座卓 */
export function apartment(c: DressCtx): void {
  skirting(c, 'trim');
  const r = mainRect(c);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  if (c.area < 14) {
    placeNear(c, cx, cz, (B, x, z) => { lowTable(B, x, z, 0.75, 0.75, 0.35, 'furnitureLight'); for (const [dx, dz] of [[0, -0.65], [0, 0.65]]) B.push({ min: [x + dx! - 0.25, 0, z + dz! - 0.25], max: [x + dx! + 0.25, 0.08, z + dz! + 0.25], mat: 'seatBlue', solid: false }); }, 0.3, 1.2);
    onSomeWall(c, 1.0, (B, f, at) => B.push(alongFace(f, at, 1.0, c.standoff + 0.05, c.standoff + 2.0, 0, 0.12, 'whiteFabric', true)));
    onSomeWall(c, 0.8, (B, f, at) => wallShelf(B, c.rng, f, at, 0.8, 0.3, 1.2, 'furnitureLight', 'books', c.standoff));
    return;
  }
  onSomeWall(c, 2.5, (B, f, at) => { kitchenette(B, f, at, 1.8, c.standoff); fridge(B, f, at + 1.85, c.standoff); });
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const third = (alongX ? r.x1 - r.x0 : r.z1 - r.z0) / 4;
  // 食卓（片側）とソファ（反対側）
  placeNear(c, alongX ? cx - third : cx, alongX ? cz : cz - third, (B, x, z) => {
    longTable(B, x, z, alongX, 1.2, 0.75, 0.72, 'furnitureLight');
    for (const s of [-1, 1]) for (const t of [-0.3, 0.3]) if (!c.rng.chance(0.25)) chair(B, alongX ? x + t : x + s * 0.68, alongX ? z + s * 0.68 : z + t, (alongX ? (s > 0 ? 2 : 0) : (s > 0 ? 3 : 1)) as Dir, 'furnitureDark');
  }, 0.3, 1.5);
  const sx = alongX ? cx + third : cx, sz = alongX ? cz : cz + third;
  addDecor(c, [{ min: [sx - 1.0, 0.002, sz - 0.8], max: [sx + 1.0, 0.01, sz + 0.8], mat: 'carpetPattern', solid: false }]);
  const sofaDir: Dir = alongX ? 0 : 1;
  placeNear(c, sx, sz, (B, x, z) => {
    lowTable(B, x, z, 0.9, 0.5, 0.4, 'furnitureDark');
    const [bx, bz] = alongX ? [x, z - 0.95] : [x - 0.95, z];
    sofa(B, bx, bz, 1.8, sofaDir, c.rng.pick<MatId>(['upholstery', 'seatBlue', 'whiteFabric']), 0.85);
  }, 0.3, 1.5);
  onSomeWall(c, 1.2, (B, f, at) => { cabinet(B, f, at, 1.2, 0.4, 0.45, 'furnitureDark', c.standoff); B.push(alongFace(f, at + 0.15, 0.9, c.standoff + 0.12, c.standoff + 0.17, 0.47, 1.0, 'screenDark', false)); });
  onSomeWall(c, 0.8, (B, f, at) => wallShelf(B, c.rng, f, at, 0.8, 0.3, Math.min(1.8, c.h - 0.4), 'furnitureLight', 'books', c.standoff));
  cornerPlants(c, count(c, 0.8, 2));
  wallExtras(c, ['clock', 'picture'], count(c, 1.0, 2));
}

// ---------------------------------------------------------------- 娯楽

/** カラオケの部屋: 壁沿いのソファ（コの字）、中央の低い卓、壁の画面、天井際のネオン */
export function karaoke(c: DressCtx): void {
  if (c.kind === 'hall' || c.area > 45) { arcadeHall(c); return; }
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }, { y0: Math.min(c.h - 0.2, 2.2), y1: Math.min(c.h - 0.16, 2.24), mat: c.rng.chance(0.5) ? 'neonBlue' : 'neonRed', depth: 0.02 }]);
  const r = mainRect(c);
  const ef = faceOf(c, entrance(c));
  const screenF = (ef && oppositeFace(c, ef)) ?? mainFaces(c, () => true, r)[0];
  const mat = c.rng.pick<MatId>(['seatRed', 'upholstery', 'seatBlue']);
  for (const f of c.faces.filter((g) => g !== screenF)) {
    for (const [p, q] of freeRuns(f, c.openings, 0.7)) {
      const len = q - p - 0.1;
      if (len < 1.2) continue;
      const [x, z] = facePoint(f, (p + q) / 2, c.standoff + 0.4);
      build(c, (B) => sofa(B, x, z, Math.min(len, 3.6), faceOut(f), mat, 0.75));
    }
  }
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  placeNear(c, cx, cz, (B, x, z) => lowTable(B, x, z, 1.2, 0.6, 0.42, 'furnitureDark'), 0.3, 1.0);
  if (screenF) {
    const run = longestRun(c, screenF, 0.4);
    if (run && run[1] - run[0] > 1.4) {
      const T: Box[] = [];
      wallScreen(T, screenF, (run[0] + run[1]) / 2, Math.min(1.6, run[1] - run[0] - 0.4), 0.95, Math.min(1.85, c.h - 0.3), 'screenArcade');
      addDecor(c, T);
      onSomeWall(c, 0.9, (B, f, at) => cabinet(B, f, at, 0.9, 0.4, 0.6, 'metalDark', c.standoff), { faces: [screenF] });
    }
  }
}

/** ゲーム場（娯楽施設の広間）: 背中合わせのゲーム筐体の列、壁沿いの筐体、両替機、ごみ箱、床の柄 */
export function arcadeHall(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }]);
  const r = mainRect(c);
  addDecor(c, [{ min: [r.x0 + 0.3, 0.002, r.z0 + 0.3], max: [r.x1 - 0.3, 0.008, r.z1 - 0.3], mat: 'carpetPattern', solid: false }]);
  const marquee = (): MatId => c.rng.pick<MatId>(['neonBlue', 'neonRed', 'lightWarm']);
  for (const f of c.faces) for (const [p, q] of freeRuns(f, c.openings, 1.0)) lineUp(c, p + 0.1, q - 0.1, 0.7, 0.08, (B, at) => { if (c.rng.chance(occupancy(c))) arcade(B, f, at, c.standoff + 0.03, marquee()); });
  // 島（背中合わせの 2 列）
  const ir = innerRect(r, WALL_T + 1.0 + 1.9);
  const alongX = ir.x1 - ir.x0 >= ir.z1 - ir.z0;
  const W = alongX ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
  const n = Math.max(0, Math.floor((W + 2.2) / (1.7 + 2.2)));
  const across0 = (alongX ? ir.z0 : ir.x0) + (W - (n * 3.9 - 2.2)) / 2 + 0.85;
  const l0 = alongX ? ir.x0 : ir.z0, l1 = alongX ? ir.x1 : ir.z1;
  for (let i = 0; i < n; i++) {
    const center = across0 + i * 3.9;
    for (const inw of [1, -1] as const) {
      const f = lineFace(alongX, center, inw, l0, l1);
      for (let seg0 = l0; seg0 + 0.7 <= l1; seg0 += 5.2) lineUp(c, seg0, Math.min(l1, seg0 + 4.0), 0.7, 0.06, (B, at) => { if (c.rng.chance(occupancy(c))) arcade(B, f, at, 0.0, marquee()); });
    }
  }
  onSomeWall(c, 0.9, (B, f, at) => vending(B, f, at, 'lightWarm', c.standoff + 0.03));
  for (let i = 0; i < count(c, 1.5, 3); i++) onSomeWall(c, 0.4, (B, f, at) => { const [x, z] = facePoint(f, at + 0.2, c.standoff + 0.2); bin(B, x, z, 'plasticRed'); });
}

// ---------------------------------------------------------------- 設備

/** 設備室・バックヤード: 壁際のスチール棚とカゴ車、作業台と灯り、分電盤、壁の配管 */
export function serviceRoom(c: DressCtx): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }]);
  for (const f of c.faces) {
    if (!maybe(c, 0.7)) continue;
    for (const [p, q] of freeRuns(f, c.openings, 1.0)) {
      lineUp(c, p + 0.1, q - 0.1, 1.8, 0.1, (B, at) => {
        const a = alongFace(f, at, 1.8, c.standoff + 0.02, c.standoff + 0.62, 0, 1, 'void', false);
        rack(B, c.rng, a.min[0], a.min[2], a.max[0], a.max[2], Math.min(2.2, c.h - 0.4), 0.7);
      });
    }
  }
  for (let i = 0; i < count(c, 1.2, 3); i++) onSomeWall(c, 1.1, (B, f, at) => rollCage(B, c.rng, f, at, c.standoff + 0.04));
  const r = mainRect(c);
  placeNear(c, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (B, x, z) => { longTable(B, x, z, r.x1 - r.x0 >= r.z1 - r.z0, 1.8, 0.75, 0.85, 'metal'); lamp(B, x + 0.5, z, 0.85); }, 0.4, 1.6);
  // 分電盤・配管（当たらない）
  for (const f of c.rng.shuffle(c.faces.slice()).slice(0, 2)) {
    const run = longestRun(c, f, 0.6);
    if (!run || run[1] - run[0] < 1.2) continue;
    const T: Box[] = [];
    const t = c.rng.float(run[0] + 0.4, run[1] - 0.8);
    T.push(alongFace(f, t, 0.5, 0, 0.16, 1.2, 1.9, 'metalDark', false));
    T.push(alongFace(f, t + 0.05, 0.4, 0.16, 0.165, 1.25, 1.85, 'shelfMetal', false));
    T.push(alongFace(f, run[0] + 0.1, run[1] - run[0] - 0.2, 0.05, 0.13, c.h - 0.4, c.h - 0.32, 'metal', false));
    if (T.some((b) => touchesSolid(c, b, 0.04))) continue;
    addDecor(c, T);
  }
}
