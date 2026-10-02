/**
 * 廊下・曲がり角・階段・出口の中身（v1 CorridorGenerator の decorate を区画単位に移植。参考画像の文法:
 * 壁の二段構成（腰壁・巾木・手すり）・扉のリズム・掲示板などの壁の物・照明の列）。
 *
 * - 当たる物は、幅に余裕があるときだけ壁際に置き、通り道（1.3 m 以上）を残す。扉前は ctx の扉前の範囲で空く
 * - 照明は区画を作るとき（makeCell）に付いているので、ここでは器具を足さない
 * - 番号・室名などの文字は v2 にまだ無いので、文字の無い板で表す
 */
import { WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { along } from '../../../world/footprint.ts';
import { build, maybe, type DressCtx } from '../ctx.ts';
import {
  addDecor, board, decorDoor, doorPlate, exitSign, extinguisher, floorStrip, hangingPlate, papers, sconce, slots, wallBands, wallDetails, wallWindow, type Band,
} from '../decor.ts';
import { bench, linkedSeats, lockerBank, rollCage, vending } from '../furniture.ts';
import { alongFace, facePoint, faceOut, freeRuns, isFloorOpening, onFace, openingBase, type Face } from '../geom.ts';
import { bin, cabinet, plant, waterCooler } from '../props.ts';

/** 幅に余裕があるとき壁際に置く物 */
export type CorridorProp = 'vending' | 'bench' | 'seats' | 'plant' | 'bin' | 'waterCooler' | 'rollCage' | 'lockers' | 'cabinet';

/** 廊下の装い（テーマごと） */
export interface CorridorStyle {
  /** 壁の帯（腰壁・巾木・手すり） */
  bands: Band[];
  /** 装飾の扉を付ける側 */
  doors: 'both' | 'one' | 'none';
  doorPitch: number;
  /** 扉の材質（'palette' なら区画の色の組の扉） */
  doorMat: MatId | 'palette';
  doorFrame: MatId;
  /** 扉の脇の番号板 */
  plates: boolean;
  /** 扉の列の 3 枡目ごとに扉の代わりに入れる物 */
  every3: 'board' | 'poster' | 'neon' | null;
  /** 扉の横の小物 */
  doorExtra: 'sconce' | 'meter' | 'doorWindow' | null;
  /** 扉の無い側の壁 */
  other: 'windows' | 'seats' | 'parapet' | 'posters' | 'staffPlates' | 'boards' | null;
  /** 幅に余裕があるとき壁際に置く物（当たる物）と、置く数の目安（廊下 10 m あたり） */
  props: CorridorProp[];
  propRate: number;
  ceiling: 'ducts' | 'signs' | 'backlit' | null;
  floor: 'tactile' | null;
  /** 突き当たりの開口の上に非常口の灯り */
  exitSigns: boolean;
  /** 壁の小さな設備（コンセント・換気口）の数の目安 */
  details?: number;
}

const SKIRT = (mat: MatId = 'trim'): Band => ({ y0: 0, y1: 0.1, mat, depth: 0.014 });

/** テーマごとの廊下（v1 decorate の各テンプレート） */
export const CORRIDOR_STYLES: Record<string, CorridorStyle> = {
  // 学校: 緑の腰壁 1.2 m。片側に教室の扉（小窓付き）と掲示板、反対側に窓の帯
  school: {
    bands: [{ y0: 0, y1: 1.2, mat: 'wallGreen', depth: 0.012 }, SKIRT('trim')], doors: 'one', doorPitch: 3.0, doorMat: 'doorWood', doorFrame: 'trim', plates: true,
    every3: 'board', doorExtra: 'doorWindow', other: 'windows', props: ['lockers', 'bin'], propRate: 0.6, ceiling: null, floor: null, exitSigns: false,
  },
  // 病院: クリームの腰壁 1.0 m + 木の手すり。片側に診察室の扉、反対側に青い連結椅子、吊り案内板
  hospital: {
    bands: [{ y0: 0, y1: 1.0, mat: 'wainscotCream', depth: 0.012 }, { y0: 0.8, y1: 0.85, mat: 'handrailWood', depth: 0.06 }, SKIRT('trim')], doors: 'one', doorPitch: 3.2,
    doorMat: 'doorWood', doorFrame: 'trim', plates: true, every3: null, doorExtra: null, other: 'seats', props: ['plant', 'waterCooler'], propRate: 0.5, ceiling: 'signs', floor: null, exitSigns: false,
  },
  // ホテル: 濃い木の腰壁 0.9 m + 笠木。両側に客室の扉、片側に壁灯
  hotel: {
    bands: [{ y0: 0, y1: 0.9, mat: 'furnitureDark', depth: 0.012 }, { y0: 0.9, y1: 0.94, mat: 'trim', depth: 0.03 }], doors: 'both', doorPitch: 3.0, doorMat: 'doorWood', doorFrame: 'trim',
    plates: true, every3: null, doorExtra: 'sconce', other: null, props: ['plant', 'cabinet'], propRate: 0.35, ceiling: null, floor: null, exitSigns: false,
  },
  // カラオケ: 濃色の腰壁 + 黒い巾木。両側に黒い番号扉、ネオンの標語、突き当たりの非常口
  entertainment: {
    bands: [{ y0: 0.1, y1: 0.9, mat: 'wallDark', depth: 0.02 }, { y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.035 }], doors: 'both', doorPitch: 3.0, doorMat: 'metalDark', doorFrame: 'metalDark',
    plates: true, every3: 'neon', doorExtra: null, other: null, props: ['bin'], propRate: 0.25, ceiling: null, floor: null, exitSigns: true,
  },
  // 設備: 保護レール 2 段（黒・黄）+ 金属の巾木、金属の扉、露出天井のダクトと配管
  service: {
    bands: [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 }, { y0: 0.25, y1: 0.33, mat: 'metalDark', depth: 0.06 }, { y0: 0.85, y1: 0.93, mat: 'yellowLine', depth: 0.06 }], doors: 'one', doorPitch: 3.2,
    doorMat: 'doorMetal', doorFrame: 'metalDark', plates: false, every3: null, doorExtra: null, other: 'staffPlates', props: ['rollCage', 'cabinet'], propRate: 0.5, ceiling: 'ducts', floor: null, exitSigns: true,
  },
  // マンションの外廊下: 片側に鉄の玄関扉 + メーターボックス、反対側は手すり壁と夜の街
  apartment: {
    bands: [SKIRT('trim')], doors: 'one', doorPitch: 3.2, doorMat: 'doorMetal', doorFrame: 'metalDark', plates: true, every3: null, doorExtra: 'meter', other: 'parapet',
    props: [], propRate: 0, ceiling: null, floor: null, exitSigns: false,
  },
  // 駅の連絡通路: 点字ブロック、金属の巾木、額のポスター、吊り案内板（内照）
  transit: {
    bands: [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.025 }], doors: 'none', doorPitch: 3.0, doorMat: 'doorMetal', doorFrame: 'metalDark', plates: false, every3: null, doorExtra: null,
    other: 'posters', props: ['bin', 'bench'], propRate: 0.35, ceiling: 'backlit', floor: 'tactile', exitSigns: true,
  },
  // オフィス: 両側に木の扉 + 番号板。給水器・鉢植え・ごみ箱
  office: {
    bands: [SKIRT('metalDark')], doors: 'both', doorPitch: 3.2, doorMat: 'palette', doorFrame: 'trim', plates: true, every3: 'board', doorExtra: null, other: null,
    props: ['waterCooler', 'plant', 'bin', 'cabinet'], propRate: 0.5, ceiling: null, floor: null, exitSigns: false,
  },
  // 汎用: 片側に扉 4 m 間隔
  generic: {
    bands: [SKIRT('trim')], doors: 'one', doorPitch: 4.0, doorMat: 'palette', doorFrame: 'trim', plates: false, every3: null, doorExtra: null, other: 'boards',
    props: ['plant', 'bench', 'bin'], propRate: 0.35, ceiling: null, floor: null, exitSigns: false,
  },
  // ショッピングモールの通路: ベンチと植え込み、額のポスター
  mall: {
    bands: [SKIRT('metalDark')], doors: 'none', doorPitch: 4.0, doorMat: 'palette', doorFrame: 'metalDark', plates: false, every3: null, doorExtra: null, other: 'posters',
    props: ['bench', 'plant', 'bin'], propRate: 0.6, ceiling: 'backlit', floor: null, exitSigns: false,
  },
  // 図書館・美術館の廊下: 額（絵）と長椅子
  gallery: {
    bands: [SKIRT('trim')], doors: 'none', doorPitch: 4.0, doorMat: 'palette', doorFrame: 'trim', plates: false, every3: null, doorExtra: null, other: 'posters',
    props: ['bench'], propRate: 0.4, ceiling: null, floor: null, exitSigns: false,
  },
  // タイルの通路（トイレ・更衣室の前）
  tiled: {
    bands: [{ y0: 0, y1: 1.2, mat: 'floorTile', depth: 0.02 }, { y0: 1.2, y1: 1.24, mat: 'trim', depth: 0.03 }], doors: 'one', doorPitch: 3.0, doorMat: 'doorMetal', doorFrame: 'metalDark',
    plates: true, every3: null, doorExtra: null, other: null, props: ['bin'], propRate: 0.3, ceiling: null, floor: null, exitSigns: false,
  },
  // バックルーム: 何も無い（黄ばんだ壁紙だけ）
  backrooms: {
    bands: [], doors: 'none', doorPitch: 4.0, doorMat: 'palette', doorFrame: 'trim', plates: false, every3: null, doorExtra: null, other: null, props: [], propRate: 0,
    ceiling: null, floor: null, exitSigns: false, details: 3,
  },
};

// ---------------------------------------------------------------- 面の振り分け

/** 矩形の長い方の軸に沿った面（廊下の側壁）か。正方形に近い矩形はどの面も側壁 */
export function isSideFace(f: Face): boolean {
  const r = f.rect;
  if (!r) return true;
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  if (Math.abs(w - d) < 0.6) return true;
  return w > d ? f.horizontal : !f.horizontal;
}

/** 面の向かいの壁までの内法（廊下の幅） */
export function clearWidth(f: Face): number {
  const r = f.rect;
  if (!r) return 0;
  return (f.horizontal ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
}

/** 面ごとに使った区間（扉・掲示板・当たる物）を覚えておく */
type Used = Map<Face, [number, number][]>;
const use = (u: Used, f: Face, a: number, b: number): void => { const l = u.get(f) ?? []; l.push([a, b]); u.set(f, l); };
const isFree = (u: Used, f: Face, a: number, b: number): boolean => !(u.get(f) ?? []).some(([p, q]) => a < q && b > p);

// ---------------------------------------------------------------- 廊下

/** 廊下の中身 */
export function dressCorridor(c: DressCtx, st: CorridorStyle): void {
  if (st.bands.length) wallBands(c, st.bands);
  const sides = c.faces.filter((f) => isSideFace(f) && f.a1 - f.a0 >= 2.0);
  // 扉の側（A）と反対側（B）を矩形ごとに決める
  const sideA = new Set<Face>();
  for (const r of c.rects) {
    const mine = sides.filter((f) => f.rect === r);
    const pairs = new Map<number, Face[]>();
    for (const f of mine) { const l = pairs.get(f.dir) ?? []; l.push(f); pairs.set(f.dir, l); }
    const dirs = [...pairs.keys()].sort((a, b) => a - b);
    const flip = c.rng.chance(0.5);
    dirs.forEach((d, i) => { if (((i % 2) === 0) !== flip) for (const f of pairs.get(d)!) sideA.add(f); });
  }
  const used: Used = new Map();
  const doorMat: MatId = st.doorMat === 'palette' ? c.cell.palette.door : st.doorMat;
  for (const f of sides) {
    const A = sideA.has(f);
    const doorsHere = st.doors === 'both' || (st.doors === 'one' && A);
    if (doorsHere) decorDoorsOn(c, f, st, doorMat, used);
    else otherSide(c, f, st, used);
  }
  corridorProps(c, st, sides, sideA, used);
  if (st.ceiling) corridorCeiling(c, st);
  if (st.floor === 'tactile') tactile(c);
  if (st.exitSigns) exitSigns(c, (f) => !isSideFace(f));
  if (st.details) wallDetails(c, c.rng, c.rng.int(1, st.details));
}

/** 扉の列（装飾の扉 + 番号板 + 3 枡目ごとの掲示板など） */
function decorDoorsOn(c: DressCtx, f: Face, st: CorridorStyle, mat: MatId, used: Used): void {
  for (const { t, i } of slots(c, f, st.doorPitch, 0.55, 1.2)) {
    const B: Box[] = [];
    if (st.every3 && i % 3 === 2) {
      if (st.every3 === 'board') {
        board(B, f, t, 1.6, 0.95, 2.0, 'noticeGreen');
        papers(B, c.rng, f, t, 1.6, 0.95, 2.0, c.rng.int(2, 5));
      } else if (st.every3 === 'poster') board(B, f, t, 0.9, 1.1, 2.3, c.rng.pick(['wallDark', 'seatBlue', 'upholstery'] as MatId[]));
      else B.push(alongFace(f, t - 0.8, 1.6, 0.01, 0.03, 1.72, 1.8, c.rng.chance(0.5) ? 'neonRed' : 'neonBlue', false));
      if (addDecor(c, B)) use(used, f, t - 0.9, t + 0.9);
      continue;
    }
    decorDoor(B, f, t, mat, 0.9, Math.min(2.05, c.h - 0.2), st.doorFrame);
    if (st.plates) doorPlate(B, f, t, 0.9, st.doorMat === 'metalDark' ? 0.22 : 0.26, st.doorMat === 'metalDark' ? 'screenDark' : 'signPlate');
    if (st.doorExtra === 'doorWindow') B.push(alongFace(f, t - 0.2, 0.4, 0.08, 0.086, 1.45, 1.85, 'windowDark', false));
    else if (st.doorExtra === 'meter') B.push(alongFace(f, t + 0.45 + 0.065 + 0.5, 0.4, 0, 0.1, 1.15, 1.75, 'doorMetal', false));
    else if (st.doorExtra === 'sconce' && i % 2 === 1) sconce(B, f, t - 0.45 - 0.065 - 0.43, 1.6);
    if (addDecor(c, B)) use(used, f, t - (st.doorExtra === 'sconce' ? 1.1 : 0.6), t + (st.doorExtra === 'meter' ? 1.5 : 0.9));
  }
}

/** 扉の無い側の壁 */
function otherSide(c: DressCtx, f: Face, st: CorridorStyle, used: Used): void {
  const runs = freeRuns(f, c.openings, 0.3);
  switch (st.other) {
    case 'windows': {
      // 学校の窓帯 1.2〜2.2 m（壁は抜かずに夜景を貼る）。隅と開口の前後 0.3 m は壁のまま
      for (const [p, q] of runs) {
        const t0 = p + 0.3, t1 = q - 0.3;
        if (t1 - t0 < 0.9) continue;
        const B: Box[] = [];
        wallWindow(B, f, t0, t1, 1.2, Math.min(2.2, c.h - 0.25), 'trim', 2.4);
        if (addDecor(c, B)) use(used, f, t0, t1);
      }
      return;
    }
    case 'parapet': {
      // 手すり壁 1.1 m + 金属の笠木。その上は外（夜の街）
      for (const [p, q] of runs) {
        if (q - p < 0.6) continue;
        const B: Box[] = [];
        B.push(alongFace(f, p, q - p, 0, 0.03, 0.1, 1.1, 'wallConcrete', false));
        B.push(alongFace(f, p, q - p, 0, 0.07, 1.1, 1.15, 'metalDark', false));
        B.push(alongFace(f, p, q - p, 0.002, 0.006, 1.15, Math.max(1.3, c.h - 0.12), 'windowNight', false));
        addDecor(c, B);
      }
      return;
    }
    case 'posters':
    case 'boards': {
      for (const { t, i } of slots(c, f, 3.0, 0.5, 1.2)) {
        if (i % 2 === 1) continue;
        const B: Box[] = [];
        if (st.other === 'posters') board(B, f, t, 0.9, 1.1, Math.min(2.3, c.h - 0.3), c.rng.pick(['wallDark', 'seatBlue', 'upholstery', 'noticeGreen', 'chalkboard'] as MatId[]), 'metalDark');
        else { board(B, f, t, 1.2, 1.0, 1.9, 'noticeGreen'); papers(B, c.rng, f, t, 1.2, 1.0, 1.9, c.rng.int(1, 4)); }
        if (addDecor(c, B)) use(used, f, t - 0.7, t + 0.7);
      }
      return;
    }
    case 'staffPlates': {
      const ss = slots(c, f, 3.2, 0.5, 1.2);
      ss.forEach(({ t }, j) => {
        if (j % 3 !== 1 && ss.length !== 1) return;
        const B: Box[] = [];
        B.push(alongFace(f, t - 0.4, 0.8, 0, 0.012, 1.6, 1.9, 'signPlate', false));
        B.push(alongFace(f, t - 0.36, 0.72, 0.012, 0.016, 1.78, 1.86, 'plasticRed', false));
        addDecor(c, B);
      });
      return;
    }
    case 'seats': {
      // 待合の連結椅子（3 席。6.4 m ごと）。隅 2.0 m は空ける。幅に余裕が無ければ置かない
      if (clearWidth(f) - 0.62 < 1.3) return;
      for (const { t, i } of slots(c, f, 3.2, 0.85, 2.0)) {
        if (i % 2 !== 0 || !isFree(used, f, t - 0.8, t + 0.8) || !maybe(c, 0.9)) continue;
        const [x, z] = facePoint(f, t, c.standoff + 0.28);
        if (build(c, (B) => linkedSeats(B, x, z, 3, faceOut(f)))) use(used, f, t - 0.85, t + 0.85);
      }
      return;
    }
    default:
  }
}

/** 幅に余裕があるときの壁際の物。B 側（扉の無い側）を先に見る */
function corridorProps(c: DressCtx, st: CorridorStyle, sides: Face[], sideA: Set<Face>, used: Used): void {
  if (!st.props.length || st.propRate <= 0) return;
  const len = sides.reduce((a, f) => a + (f.a1 - f.a0), 0) / 2;
  let want = 0;
  const mean = (len / 10) * st.propRate;
  for (let k = 0; k < 4; k++) if (maybe(c, Math.min(1, mean - k))) want++;
  if (!want) return;
  const order = [...sides].sort((a, b) => Number(sideA.has(a)) - Number(sideA.has(b)));
  let placed = 0;
  for (let tries = 0; tries < want * 4 && placed < want; tries++) {
    const f = order[tries % order.length];
    if (!f) break;
    const kind = c.rng.pick(st.props);
    const [w, d] = PROP_SIZE[kind];
    // 向かいの壁まで 1.3 m 以上を残す
    if (clearWidth(f) - (c.standoff + d) < 1.3) continue;
    const runs = freeRuns(f, c.openings, 1.0).filter(([p, q]) => q - p >= w + 0.4);
    if (!runs.length) continue;
    const [p, q] = c.rng.pick(runs);
    const at = c.rng.float(p + 0.2, q - 0.2 - w);
    if (!isFree(used, f, at - 0.1, at + w + 0.1)) continue;
    if (build(c, (B) => corridorProp(c, B, kind, f, at))) { use(used, f, at - 0.1, at + w + 0.1); placed++; }
  }
}

/** 壁際の物の大きさ（辺に沿った幅, 室内面からの奥行き） */
const PROP_SIZE: Record<CorridorProp, [number, number]> = {
  vending: [0.9, 0.9], bench: [1.6, 0.42], seats: [1.5, 0.62], plant: [0.55, 0.62], bin: [0.42, 0.48], waterCooler: [0.34, 0.4], rollCage: [1.1, 0.9], lockers: [1.6, 0.54], cabinet: [1.2, 0.5],
};

function corridorProp(c: DressCtx, B: Box[], kind: CorridorProp, f: Face, at: number): void {
  const s = c.standoff;
  const [w, d] = PROP_SIZE[kind];
  const mid = at + w / 2;
  switch (kind) {
    case 'vending': vending(B, f, at, c.rng.chance(0.3) ? 'lightWarm' : 'lightPanel', s + 0.03); return;
    case 'bench': { const [x, z] = facePoint(f, mid, s + 0.2); bench(B, f.horizontal, x, z, w, 'handrailWood'); return; }
    case 'seats': { const [x, z] = facePoint(f, mid, s + 0.28); linkedSeats(B, x, z, 3, faceOut(f)); return; }
    case 'plant': { const [x, z] = facePoint(f, mid, s + 0.28); plant(B, x, z, 0.46, 1.3); return; }
    case 'bin': { const [x, z] = facePoint(f, mid, s + 0.22); bin(B, x, z, c.rng.chance(0.5) ? 'metalDark' : 'stainless', 0.36, 0.72); return; }
    case 'waterCooler': waterCooler(B, f, at, s + 0.02); return;
    case 'rollCage': rollCage(B, c.rng, f, at, s + 0.04); return;
    case 'lockers': lockerBank(B, f, at, 4, s, 0.5, 1.8, c.rng.chance(0.5) ? 'lockerBlue' : 'lockerGreen'); return;
    case 'cabinet': cabinet(B, f, at, w, d - s - 0.03, 0.9, c.rng.chance(0.5) ? 'furnitureDark' : 'shelfMetal', s); return;
  }
}

/** 天井の物（ダクト・吊り案内板） */
function corridorCeiling(c: DressCtx, st: CorridorStyle): void {
  for (const r of c.rects) {
    const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const wid = alongZ ? r.x1 - r.x0 : r.z1 - r.z0, len = alongZ ? r.z1 - r.z0 : r.x1 - r.x0;
    const h = c.h;
    const B: Box[] = [];
    if (st.ceiling === 'ducts') {
      // ダクト（片側）と配管（反対側）。天井から下がる
      const o = wid / 4;
      if (alongZ) {
        B.push(alongZbox(cx + o - 0.22, cx + o + 0.22, r.z0 + 0.2, r.z1 - 0.2, h - 0.38, h - 0.06, 'metal'));
        B.push(alongZbox(cx - o - 0.05, cx - o + 0.05, r.z0 + 0.2, r.z1 - 0.2, h - 0.22, h - 0.12, 'metalDark'));
      } else {
        B.push(alongZbox(r.x0 + 0.2, r.x1 - 0.2, cz + o - 0.22, cz + o + 0.22, h - 0.38, h - 0.06, 'metal'));
        B.push(alongZbox(r.x0 + 0.2, r.x1 - 0.2, cz - o - 0.05, cz - o + 0.05, h - 0.22, h - 0.12, 'metalDark'));
      }
    } else if (len >= 5 && h >= 2.6) {
      // 吊り案内板（中ほど。進む向きに面を向ける = 板は廊下を横切る向き）
      const w = Math.min(wid - 0.6, st.ceiling === 'backlit' ? 1.8 : 1.3);
      if (w < 0.6) continue;
      const hgt = w / 4;
      const y = h - 0.42 - hgt / 2;
      if (y - hgt / 2 < 2.15) continue;
      const a = (alongZ ? r.z0 : r.x0) + len * c.rng.float(0.4, 0.6);
      if (st.ceiling === 'backlit') hangingPlate(B, alongZ ? cx : a, alongZ ? a : cz, y, w, hgt, alongZ, h, 'metalDark', 'lightPanel');
      else hangingPlate(B, alongZ ? cx : a, alongZ ? a : cz, y, w, hgt, alongZ, h, 'signPlate', 'noticeGreen');
    }
    if (B.length) addDecor(c, B);
  }
}

const alongZbox = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, mat: MatId): Box =>
  ({ min: [x0, y0, z0], max: [x1, y1, z1], mat, solid: false });

/** 点字ブロック（黄の帯 0.3 m）: 矩形ごとの中心線 */
function tactile(c: DressCtx): void {
  const B: Box[] = [];
  for (const r of c.rects) {
    const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    if (alongZ) floorStrip(B, cx - 0.15, r.z0 + 0.3, cx + 0.15, r.z1 - 0.3);
    else floorStrip(B, r.x0 + 0.3, cz - 0.15, r.x1 - 0.3, cz + 0.15);
  }
  addDecor(c, B);
}

/** 開口の上に非常口の灯り（pred を満たす面の開口。上に 0.3 m の余裕がある物だけ） */
export function exitSigns(c: DressCtx, pred: (f: Face) => boolean = () => true, max = 4): number {
  let n = 0;
  for (const s of c.openings) {
    if (n >= max) break;
    const f = c.faces.find((g) => onFace(g, s));
    if (!f || !pred(f)) continue;
    const top = openingBase(s, c.y0) + s.height;
    const y = top + 0.12;
    if (y + 0.2 > c.h - 0.02) continue;
    const B: Box[] = [];
    exitSign(B, f, along(s.dir, s.pos[0], s.pos[2]), y, Math.min(0.5, s.width));
    if (addDecor(c, B)) n++;
  }
  return n;
}

// ---------------------------------------------------------------- 曲がり角（小さな区画）

/** 曲がり角・小さなつなぎの区画: 廊下と同じ帯 + 空いた壁があれば 1 つだけ（自販機・ごみ箱・鉢植え・長椅子）+ 消火器 */
export function dressJunction(c: DressCtx, st: CorridorStyle, prefer: CorridorProp[]): void {
  if (st.bands.length) wallBands(c, st.bands);
  const items = prefer.length ? prefer : st.props;
  if (items.length && maybe(c, 0.55)) {
    const faces = c.rng.shuffle(c.faces.slice());
    let done = false;
    for (const f of faces) {
      if (done) break;
      for (let k = 0; k < 2 && !done; k++) {
        const kind = c.rng.pick(items);
        const [w, d] = PROP_SIZE[kind];
        if (clearWidth(f) - (c.standoff + d) < 1.3) continue;
        for (const [p, q] of freeRuns(f, c.openings, 0.4)) {
          if (q - p < w + 0.3) continue;
          const at = c.rng.float(p + 0.15, q - 0.15 - w);
          if (build(c, (B) => corridorProp(c, B, kind, f, at))) { done = true; break; }
        }
      }
    }
  }
  if (maybe(c, 0.3)) {
    for (const f of c.rng.shuffle(c.faces.slice())) {
      const runs = freeRuns(f, c.openings, 0.3).filter(([p, q]) => q - p >= 0.8);
      if (!runs.length) continue;
      const [p, q] = runs[0]!;
      const B: Box[] = [];
      extinguisher(B, f, (p + q) / 2);
      if (addDecor(c, B)) break;
    }
  }
  if (st.exitSigns && maybe(c, 0.5)) exitSigns(c, () => true, 1);
  if (st.details) wallDetails(c, c.rng, c.rng.int(0, Math.max(1, st.details - 1)));
}

// ---------------------------------------------------------------- 階段・出口

/**
 * 手すり（壁付け）。段の箱（先に置かれていた当たる箱 = 階段の段・踊り場）の上面に沿って高さを変える:
 * 面に沿って 0.14 m ごとに、壁際 0.5 m の帯に掛かる段の上面の最大を見て、そこから 0.85 m に手すりを通す。
 * 段の高さが変わる所は縦のつなぎを入れ、約 1.2 m ごとに壁からの持ち送り（金物）を付ける
 */
export function stairRail(c: DressCtx, f: Face, mat: MatId = 'handrailWood', y = 0.85, out = 0.07): void {
  const B: Box[] = [];
  for (const [p, q] of freeRuns(f, c.openings, 0.15)) {
    const a0 = p + 0.25, a1 = q - 0.25;
    if (a1 - a0 < 0.6) continue;
    const pieces: { p0: number; p1: number; top: number }[] = [];
    for (let a = a0; a < a1 - 1e-6; a += 0.14) {
      const b1 = Math.min(a1, a + 0.14);
      const strip = alongFace(f, a, b1 - a, 0, 0.5, 0, c.h, 'void', true);
      let top = 0;
      for (const s of c.fixed) {
        if (s.max[1] > c.h - 0.6) continue; // 壁・柱のような背の高い物は見ない
        if (s.min[0] < strip.max[0] && s.max[0] > strip.min[0] && s.min[2] < strip.max[2] && s.max[2] > strip.min[2]) top = Math.max(top, s.max[1]);
      }
      const last = pieces[pieces.length - 1];
      if (last && Math.abs(last.top - top) < 1e-3) last.p1 = b1;
      else pieces.push({ p0: a, p1: b1, top });
    }
    let since = 1.2;
    for (let i = 0; i < pieces.length; i++) {
      const pc = pieces[i]!;
      const yy = Math.min(pc.top + y, c.h - 0.1);
      B.push(alongFace(f, pc.p0, pc.p1 - pc.p0, out, out + 0.05, yy, yy + 0.05, mat, false));
      const nx = pieces[i + 1];
      if (nx) {
        const y2 = Math.min(nx.top + y, c.h - 0.1);
        B.push(alongFace(f, pc.p1 - 0.025, 0.05, out, out + 0.05, Math.min(yy, y2), Math.max(yy, y2) + 0.05, mat, false));
      }
      since += pc.p1 - pc.p0;
      if (since >= 1.2) {
        B.push(alongFace(f, pc.p0 + 0.02, 0.03, 0, out, yy - 0.07, yy - 0.04, 'metal', false));
        since = 0;
      }
    }
  }
  if (B.length) addDecor(c, B);
}

/** 階段: 長い方の壁の両側に手すり（段に沿う）。小さな区画にも付ける */
export function dressStairs(c: DressCtx, rail: MatId = 'handrailWood'): void {
  for (const f of c.faces) if (isSideFace(f) && f.a1 - f.a0 >= 1.2) stairRail(c, f, rail);
}

/** 出口（次の階への階段・出口の前室）: 開口の上の非常口の灯り + 手すり + 消火器。ほかは置かない */
export function dressExit(c: DressCtx, rail: MatId = 'metal'): void {
  exitSigns(c, () => true, 4);
  const stepped = c.fixed.some((b) => b.max[1] > 0.1 && b.max[1] < c.h - 0.6);
  if (stepped || c.rects.every((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) < 3.2)) dressStairs(c, rail);
  if (maybe(c, 0.5)) {
    for (const f of c.rng.shuffle(c.faces.slice())) {
      const runs = freeRuns(f, c.openings, 0.5).filter(([p, q]) => q - p >= 0.8);
      if (!runs.length) continue;
      const B: Box[] = [];
      extinguisher(B, f, (runs[0]![0] + runs[0]![1]) / 2);
      if (addDecor(c, B)) break;
    }
  }
  // 階の表示（文字の無い白い板）: 床の高さの開口の脇
  const s = c.openings.find((o) => isFloorOpening(o, c.y0));
  const f = s && c.faces.find((g) => onFace(g, s));
  if (s && f) {
    const t = along(s.dir, s.pos[0], s.pos[2]) + s.width / 2 + 0.35;
    if (t + 0.3 < f.a1) {
      const B: Box[] = [];
      B.push(alongFace(f, t, 0.3, 0, 0.012, 1.4, 1.7, 'signPlate', false));
      addDecor(c, B);
    }
  }
}
