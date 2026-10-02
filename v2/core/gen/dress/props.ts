/**
 * v2 で足した家具・設備の部品。v1 の部屋別ドレッシング（generators/dressing/*.ts）の見た目を参考にしたが、
 * 部屋 ID には依らない（テーマ・大きさ・乱数だけで使う側が選ぶ）。
 *
 * - 高さは床から（床 = 0）。置けるかの判定は ctx.placeUnit が見る
 * - 当たり判定は少数のソリッド箱（座面・天板・本体）。細い部材で組む物（棚・座席の列）は「描かない当たり判定」で中を塞ぐ
 * - 向き: toward / facing は使う人が向く向き（Dir。0:+Z 1:+X 2:-Z 3:-X）。壁に付ける物は Face（壁の室内面）を受け取る
 */
import type { Rng } from '../../math/rng.ts';
import type { Dir } from '../../math/vec.ts';
import { box, type Box, type MatId } from '../../world/layout.ts';
import { collider, gid, tagGroup } from './furniture.ts';
import { alongFace, type Face } from './geom.ts';

/**
 * 向き付きの箱。局所座標 a（左右。幅の向き）・b（前後。toward の向きが +）で書いて、toward の向きへ 1/4 回転して置く。
 * toward 0 は a = +x・b = +z（vec.rotQ と同じ回転なので、左右のある物も鏡写しにならない）
 */
export function ob(cx: number, cz: number, toward: Dir, a0: number, a1: number, b0: number, b1: number, y0: number, y1: number, mat: MatId, solid = false): Box {
  switch (toward) {
    case 0: return box([cx + a0, y0, cz + b0], [cx + a1, y1, cz + b1], mat, solid);
    case 2: return box([cx - a1, y0, cz - b1], [cx - a0, y1, cz - b0], mat, solid);
    case 1: return box([cx + b0, y0, cz - a1], [cx + b1, y1, cz - a0], mat, solid);
    default: return box([cx - b1, y0, cz + a0], [cx - b0, y1, cz + a1], mat, solid);
  }
}

/** 向きの単位ベクトル [x, z] */
export const dirXZ = (d: Dir): [number, number] => (d === 0 ? [0, 1] : d === 1 ? [1, 0] : d === 2 ? [0, -1] : [-1, 0]);
/** 反対の向き */
export const back = (d: Dir): Dir => ((d + 2) % 4) as Dir;

// ---------------------------------------------------------------- 机・椅子

export interface DeskOpts {
  /** 幅（左右） */
  w?: number;
  /** 奥行き（前後） */
  d?: number;
  /** 天板の高さ */
  h?: number;
  mat?: MatId;
  /** 画面: 'on'（点いた液晶）/ 'off'（消えた画面）/ null（無し） */
  screen?: 'on' | 'off' | null;
  /** 足元の幕板（向こう側） */
  panel?: boolean;
  /** 袖の引き出し（右側） */
  drawers?: boolean;
}

/** 事務机: 天板（ソリッド）+ 両袖の側板・幕板・引き出し（非ソリッド）+ 画面とキーボード。toward は座った人が向く向き */
export function desk(B: Box[], cx: number, cz: number, toward: Dir, o: DeskOpts = {}): void {
  const w = o.w ?? 1.4, d = o.d ?? 0.7, h = o.h ?? 0.72, mat = o.mat ?? 'furnitureLight';
  const hw = w / 2, hd = d / 2;
  const from = B.length;
  B.push(ob(cx, cz, toward, -hw, hw, -hd, hd, h - 0.03, h, mat, true));
  B.push(ob(cx, cz, toward, -hw + 0.01, -hw + 0.04, -hd + 0.03, hd - 0.02, 0, h - 0.03, mat));
  B.push(ob(cx, cz, toward, hw - 0.04, hw - 0.01, -hd + 0.03, hd - 0.02, 0, h - 0.03, mat));
  if (o.panel ?? true) B.push(ob(cx, cz, toward, -hw + 0.04, hw - 0.04, hd - 0.05, hd - 0.03, 0.25, h - 0.03, mat));
  if (o.drawers) {
    B.push(ob(cx, cz, toward, hw - 0.45, hw - 0.04, -hd + 0.06, hd - 0.06, 0.02, h - 0.05, mat));
    for (const y of [0.22, 0.42, 0.6]) B.push(ob(cx, cz, toward, hw - 0.36, hw - 0.14, -hd + 0.045, -hd + 0.06, y, y + 0.02, 'metalDark'));
  }
  const screen = o.screen === undefined ? 'off' : o.screen;
  if (screen) {
    // 画面: 台 + 支柱 + 筐体（向こう寄り）。点いた画面は手前の面だけ光る
    B.push(ob(cx, cz, toward, -0.1, 0.1, hd - 0.28, hd - 0.12, h, h + 0.015, 'metalDark'));
    B.push(ob(cx, cz, toward, -0.025, 0.025, hd - 0.22, hd - 0.18, h + 0.015, h + 0.14, 'metalDark'));
    B.push(ob(cx, cz, toward, -0.28, 0.28, hd - 0.2, hd - 0.16, h + 0.1, h + 0.44, 'screenDark'));
    if (screen === 'on') B.push(ob(cx, cz, toward, -0.25, 0.25, hd - 0.205, hd - 0.2, h + 0.125, h + 0.415, 'screenLcd'));
    B.push(ob(cx, cz, toward, -0.22, 0.22, -hd + 0.12, -hd + 0.27, h, h + 0.02, 'metalDark'));
  }
  tagGroup(B, from, gid('desk', cx, cz), 'desk');
}

/** 事務椅子: 座（ソリッド）+ 背（ソリッド）+ 支柱と脚（非ソリッド）。facing は座った人が向く向き */
export function officeChair(B: Box[], cx: number, cz: number, facing: Dir, mat: MatId = 'seatBlue'): void {
  const from = B.length;
  B.push(ob(cx, cz, facing, -0.24, 0.24, -0.24, 0.24, 0.42, 0.5, mat, true));
  B.push(ob(cx, cz, facing, -0.22, 0.22, -0.26, -0.2, 0.56, 0.98, mat, true));
  B.push(ob(cx, cz, facing, -0.03, 0.03, -0.24, -0.2, 0.5, 0.58, 'metalDark'));
  B.push(ob(cx, cz, facing, -0.03, 0.03, -0.03, 0.03, 0.08, 0.42, 'metalDark'));
  B.push(ob(cx, cz, facing, -0.3, 0.3, -0.03, 0.03, 0.03, 0.08, 'metalDark'));
  B.push(ob(cx, cz, facing, -0.03, 0.03, -0.3, 0.3, 0.03, 0.08, 'metalDark'));
  tagGroup(B, from, gid('chair', cx, cz), 'chair');
}

/** 学校の机: 天板 0.65 × 0.45（高 0.7、ソリッド）+ 鉄の脚枠と物入れ（非ソリッド）。toward は座った人が向く向き */
export function schoolDesk(B: Box[], cx: number, cz: number, toward: Dir): void {
  const from = B.length;
  B.push(ob(cx, cz, toward, -0.325, 0.325, -0.225, 0.225, 0.68, 0.7, 'furnitureLight', true));
  for (const s of [-1, 1]) {
    const a = s * 0.29;
    B.push(ob(cx, cz, toward, a - 0.015, a + 0.015, -0.2, 0.2, 0.0, 0.68, 'metalDark'));
  }
  B.push(ob(cx, cz, toward, -0.28, 0.28, -0.1, 0.2, 0.56, 0.58, 'metalDark'));
  B.push(ob(cx, cz, toward, -0.28, 0.28, 0.19, 0.2, 0.58, 0.68, 'metalDark'));
  tagGroup(B, from, gid('desk', cx, cz), 'desk');
}

/** 学校の椅子: 座 0.38 角（高 0.43、ソリッド）+ 背板（ソリッド）+ 鉄の脚（非ソリッド）。facing は座った人が向く向き */
export function schoolChair(B: Box[], cx: number, cz: number, facing: Dir): void {
  const from = B.length;
  B.push(ob(cx, cz, facing, -0.19, 0.19, -0.19, 0.19, 0.4, 0.43, 'furnitureLight', true));
  B.push(ob(cx, cz, facing, -0.18, 0.18, -0.2, -0.17, 0.56, 0.8, 'furnitureLight', true));
  for (const s of [-1, 1]) {
    const a = s * 0.17;
    B.push(ob(cx, cz, facing, a - 0.012, a + 0.012, -0.18, 0.18, 0.0, 0.4, 'metalDark'));
    B.push(ob(cx, cz, facing, a - 0.012, a + 0.012, -0.2, -0.18, 0.43, 0.56, 'metalDark'));
  }
  tagGroup(B, from, gid('chair', cx, cz), 'chair');
}

/** 低い卓（座卓・センターテーブル）: 天板（ソリッド）+ 脚（非ソリッド） */
export function lowTable(B: Box[], cx: number, cz: number, w: number, d: number, h = 0.42, mat: MatId = 'furnitureDark'): void {
  const from = B.length;
  B.push(box([cx - w / 2, h - 0.04, cz - d / 2], [cx + w / 2, h, cz + d / 2], mat, true));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = cx + sx * (w / 2 - 0.06), lz = cz + sz * (d / 2 - 0.06);
    B.push(box([lx - 0.025, 0, lz - 0.025], [lx + 0.025, h - 0.04, lz + 0.025], mat, false));
  }
  tagGroup(B, from, gid('table', cx, cz), 'table');
}

/** 長椅子（ソファ）: 座の台・背・肘（ソリッド）+ 座布団・脚（非ソリッド）。len は幅、facing は座った人が向く向き */
export function sofa(B: Box[], cx: number, cz: number, len: number, facing: Dir, mat: MatId = 'upholstery', depth = 0.85): void {
  const hl = len / 2, hd = depth / 2;
  const from = B.length;
  B.push(ob(cx, cz, facing, -hl, hl, -hd, hd, 0.1, 0.4, mat, true));
  B.push(ob(cx, cz, facing, -hl, hl, -hd, -hd + 0.22, 0.4, 0.85, mat, true));
  B.push(ob(cx, cz, facing, -hl, -hl + 0.18, -hd + 0.22, hd, 0.4, 0.62, mat, true));
  B.push(ob(cx, cz, facing, hl - 0.18, hl, -hd + 0.22, hd, 0.4, 0.62, mat, true));
  const n = Math.max(1, Math.round((len - 0.36) / 0.65));
  const cw = (len - 0.36) / n;
  for (let k = 0; k < n; k++) {
    const a = -hl + 0.18 + k * cw;
    B.push(ob(cx, cz, facing, a + 0.01, a + cw - 0.01, -hd + 0.23, hd - 0.02, 0.4, 0.5, mat));
  }
  for (const s of [-1, 1]) for (const t of [-1, 1]) B.push(ob(cx, cz, facing, s * (hl - 0.08) - 0.03, s * (hl - 0.08) + 0.03, t * (hd - 0.08) - 0.03, t * (hd - 0.08) + 0.03, 0, 0.1, 'metalDark'));
  tagGroup(B, from, gid('sofa', cx, cz), 'sofa');
}

// ---------------------------------------------------------------- 壁際の大物

/** 戸棚（低い物入れ・背の高い書庫）: 本体（ソリッド）+ 扉の目地と取っ手（非ソリッド）。face から standoff 離す */
export function cabinet(B: Box[], f: Face, at: number, len: number, depth = 0.45, h = 0.9, mat: MatId = 'furnitureLight', standoff = 0.02): void {
  const from = B.length;
  const d0 = standoff, d1 = standoff + depth;
  B.push(alongFace(f, at, len, d0, d1, 0, h, mat, true));
  B.push(alongFace(f, at, len, d1 - 0.005, d1 + 0.004, 0, 0.07, 'metalDark', false));
  const n = Math.max(1, Math.round(len / 0.45));
  for (let k = 1; k < n; k++) B.push(alongFace(f, at + (len * k) / n - 0.004, 0.008, d1 - 0.004, d1 + 0.003, 0.08, h - 0.02, 'metalDark', false));
  for (let k = 0; k < n; k++) {
    const a = at + (len * (k + 0.5)) / n + (k % 2 ? -0.12 : 0.12);
    B.push(alongFace(f, a - 0.015, 0.03, d1, d1 + 0.02, Math.min(h - 0.15, 0.75), Math.min(h - 0.05, 0.87), 'metal', false));
  }
  tagGroup(B, from, gid('cabinet', f.dir, at, f.face), 'cabinet');
}

/** 冷蔵庫 0.7 × 0.7 × 1.8（白い筐体 + 扉の目地 + 取っ手） */
export function fridge(B: Box[], f: Face, at: number, standoff = 0.03): void {
  const from = B.length;
  const d1 = standoff + 0.7;
  B.push(alongFace(f, at, 0.7, standoff, d1, 0, 1.8, 'paintWhite', true));
  B.push(alongFace(f, at, 0.7, d1, d1 + 0.004, 1.12, 1.135, 'metalDark', false));
  B.push(alongFace(f, at + 0.58, 0.03, d1, d1 + 0.025, 0.7, 1.05, 'metal', false));
  B.push(alongFace(f, at + 0.58, 0.03, d1, d1 + 0.025, 1.2, 1.5, 'metal', false));
  tagGroup(B, from, gid('fridge', f.dir, at, f.face), 'fridge');
}

/** 流し台: 台（ソリッド）+ 天板・流し・水栓・吊り戸棚（非ソリッド） */
export function kitchenette(B: Box[], f: Face, at: number, len: number, standoff = 0.02): void {
  const from = B.length;
  const d1 = standoff + 0.6;
  B.push(alongFace(f, at, len, standoff, d1, 0, 0.82, 'furnitureLight', true));
  B.push(alongFace(f, at - 0.01, len + 0.02, standoff, d1 + 0.02, 0.82, 0.85, 'stainless', false));
  const sink = Math.min(0.7, len * 0.4);
  B.push(alongFace(f, at + len - sink - 0.15, sink, standoff + 0.12, d1 - 0.1, 0.845, 0.852, 'metalDark', false));
  B.push(alongFace(f, at + len - sink / 2 - 0.17, 0.04, standoff + 0.04, standoff + 0.2, 0.85, 1.12, 'metal', false));
  if (len > 1.4) for (const u of [0.25, 0.6]) B.push(alongFace(f, at + u, 0.22, standoff + 0.15, standoff + 0.4, 0.852, 0.87, 'metalDark', false));
  B.push(alongFace(f, at, len, standoff, standoff + 0.35, 1.5, 2.15, 'furnitureLight', false));
  const n = Math.max(1, Math.round(len / 0.6));
  for (let k = 1; k < n; k++) B.push(alongFace(f, at + (len * k) / n - 0.004, 0.008, standoff + 0.35, standoff + 0.354, 1.52, 2.13, 'metalDark', false));
  tagGroup(B, from, gid('kitchen', f.dir, at, f.face), 'kitchen');
}

/** 給水器 0.32 角 × 1.0 + 青い水のボトル */
export function waterCooler(B: Box[], f: Face, at: number, standoff = 0.04): void {
  const from = B.length;
  B.push(alongFace(f, at, 0.32, standoff, standoff + 0.32, 0, 1.0, 'paintWhite', true));
  B.push(alongFace(f, at + 0.04, 0.24, standoff + 0.04, standoff + 0.28, 1.0, 1.4, 'aquariumBlue', false));
  B.push(alongFace(f, at + 0.1, 0.12, standoff + 0.32, standoff + 0.34, 0.75, 0.8, 'metalDark', false));
  tagGroup(B, from, gid('waterCooler', f.dir, at, f.face), 'waterCooler');
}

/** 複合機 0.62 × 0.65 × 1.05（白い筐体 + 操作盤 + 排紙トレイ） */
export function copier(B: Box[], f: Face, at: number, standoff = 0.08): void {
  const from = B.length;
  const d1 = standoff + 0.65;
  B.push(alongFace(f, at, 0.62, standoff, d1, 0, 1.05, 'paintWhite', true));
  B.push(alongFace(f, at + 0.05, 0.52, d1 - 0.25, d1, 1.05, 1.1, 'metalDark', false));
  B.push(alongFace(f, at + 0.4, 0.18, d1 - 0.06, d1 + 0.02, 1.0, 1.06, 'screenDark', false));
  B.push(alongFace(f, at + 0.06, 0.5, d1, d1 + 0.004, 0.12, 0.6, 'metalDark', false));
  tagGroup(B, from, gid('copier', f.dir, at, f.face), 'copier');
}

/** ベッド: 頭板を面 f に付ける。w は幅（面に沿う）、len は長さ（室内へ） */
export function bed(B: Box[], f: Face, at: number, w = 1.0, len = 2.0, frame: MatId = 'furnitureDark', cover: MatId = 'seatBlue', standoff = 0.02): void {
  const from = B.length;
  const d0 = standoff;
  B.push(alongFace(f, at, w, d0 + 0.06, d0 + len, 0.1, 0.36, frame, true));
  B.push(alongFace(f, at + 0.03, w - 0.06, d0 + 0.08, d0 + len - 0.03, 0.36, 0.56, 'whiteFabric', true));
  B.push(alongFace(f, at, w, d0, d0 + 0.06, 0, 1.0, frame, true));
  B.push(alongFace(f, at + 0.12, w - 0.24, d0 + 0.12, d0 + 0.5, 0.56, 0.66, 'whiteFabric', false));
  B.push(alongFace(f, at + 0.01, w - 0.02, d0 + len * 0.38, d0 + len - 0.02, 0.5, 0.6, cover, false));
  tagGroup(B, from, gid('bed', f.dir, at, f.face), 'bed');
}

/** 診察台（金属の脚 + 白い敷布 + 枕） */
export function examBed(B: Box[], f: Face, at: number, standoff = 0.1): void {
  const from = B.length;
  const d0 = standoff, d1 = standoff + 0.7;
  B.push(alongFace(f, at, 1.9, d0, d1, 0.5, 0.65, 'whiteFabric', true));
  B.push(alongFace(f, at + 0.05, 1.8, d0 + 0.05, d1 - 0.05, 0.1, 0.5, 'stainless', false));
  B.push(alongFace(f, at + 0.05, 0.4, d0 + 0.1, d1 - 0.1, 0.65, 0.72, 'whiteFabric', false));
  tagGroup(B, from, gid('examBed', f.dir, at, f.face), 'bed');
}

/** ゲーム筐体 0.7 × 0.85 × 1.75: 本体（ソリッド）+ 画面・操作盤・看板（非ソリッド） */
export function arcade(B: Box[], f: Face, at: number, standoff = 0.05, marquee: MatId = 'neonBlue'): void {
  const from = B.length;
  const d0 = standoff, d1 = standoff + 0.8;
  B.push(alongFace(f, at, 0.7, d0, d1, 0, 1.75, 'metalDark', true));
  B.push(alongFace(f, at + 0.07, 0.56, d1, d1 + 0.01, 1.05, 1.5, 'screenArcade', false));
  B.push(alongFace(f, at + 0.04, 0.62, d1, d1 + 0.26, 0.82, 0.92, 'metalDark', false));
  B.push(alongFace(f, at + 0.12, 0.46, d1 + 0.16, d1 + 0.22, 0.92, 0.96, 'plasticRed', false));
  B.push(alongFace(f, at + 0.05, 0.6, d1, d1 + 0.012, 1.57, 1.7, marquee, false));
  B.push(alongFace(f, at + 0.28, 0.14, d1, d1 + 0.01, 0.35, 0.5, 'metal', false));
  tagGroup(B, from, gid('arcade', f.dir, at, f.face), 'arcade');
}

// ---------------------------------------------------------------- 棚（本・商品・荷物）

export type ShelfFill = 'books' | 'goods' | 'boxes' | 'binders' | 'none';

const FILL_MATS: Record<Exclude<ShelfFill, 'none'>, MatId[]> = {
  books: ['seatRed', 'seatBlue', 'noticeGreen', 'upholstery', 'whiteFabric', 'furnitureDark', 'chalkboard', 'signPlate'],
  goods: ['plasticRed', 'plasticYellow', 'plasticBlue', 'paintWhite', 'boxCardboard', 'canLabel', 'plasticRed', 'signPlate'],
  boxes: ['boxCardboard', 'boxCardboard', 'boxCardboard', 'paintWhite'],
  binders: ['plasticBlue', 'signPlate', 'noticeGreen', 'plasticRed', 'furnitureDark'],
};

/** 段の上の中身（a0..a1 の区間を 1〜3 個の塊に分け、高さと色を変える。ところどころ空ける）。put(p0, p1, y0, y1, mat) で箱を作る */
function fillLevel(rng: Rng, fill: ShelfFill, a0: number, a1: number, y: number, room: number, put: (p0: number, p1: number, y0: number, y1: number, mat: MatId) => void): void {
  if (fill === 'none' || room < 0.12) return;
  const mats = FILL_MATS[fill];
  const len = a1 - a0;
  const n = Math.max(1, Math.min(4, Math.round(len / 1.1) + rng.int(0, 1)));
  let t = a0;
  for (let k = 0; k < n; k++) {
    const rest = a1 - t;
    if (rest < 0.15) break;
    const w = k === n - 1 ? rest : Math.min(rest, (len / n) * rng.float(0.7, 1.25));
    const gap = rng.float(0.02, 0.1);
    if (!rng.chance(0.14)) {
      const hh = fill === 'books' || fill === 'binders' ? rng.float(0.62, 0.92) * room : rng.float(0.45, 0.85) * room;
      put(t, t + Math.max(0.1, w - gap), y, y + Math.max(0.08, hh), rng.pick(mats));
    }
    t += w;
  }
}

/** 段の高さ（床の台輪の上から上端まで。間隔はおよそ step） */
function shelfLevels(h: number, step: number): number[] {
  const n = Math.max(2, Math.round((h - 0.1) / step));
  const s = (h - 0.12) / n;
  return Array.from({ length: n }, (_, i) => 0.1 + i * s);
}

/**
 * 壁付けの棚（本棚・書類棚・陳列棚）: 当たり判定は描かない箱 1 つ。背板・側板・天板・段板・中身は非ソリッド。
 * face から standoff 離し、at..at+len、奥行き depth、高さ h
 */
export function wallShelf(B: Box[], rng: Rng, f: Face, at: number, len: number, depth = 0.35, h = 2.0, mat: MatId = 'bookshelfWood', fill: ShelfFill = 'books', standoff = 0.02): void {
  const from = B.length;
  const d0 = standoff, d1 = standoff + depth;
  const put = (p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, m: MatId) => B.push(alongFace(f, p0, p1 - p0, q0, q1, y0, y1, m, false));
  put(at, at + len, d0, d0 + 0.02, 0, h, mat);
  put(at, at + 0.025, d0, d1, 0, h, mat);
  put(at + len - 0.025, at + len, d0, d1, 0, h, mat);
  put(at, at + len, d0, d1, h - 0.025, h, mat);
  put(at + 0.025, at + len - 0.025, d0, d1, 0, 0.08, mat);
  const levels = shelfLevels(h, 0.4);
  for (let i = 0; i < levels.length; i++) {
    const y = levels[i]!;
    if (i > 0) put(at + 0.025, at + len - 0.025, d0 + 0.02, d1, y - 0.02, y, mat);
    const room = (i + 1 < levels.length ? levels[i + 1]! - 0.02 : h - 0.025) - y;
    fillLevel(rng, fill, at + 0.04, at + len - 0.04, y, room - 0.02, (p0, p1, y0, y1, m) => put(p0, p1, d0 + 0.03, Math.min(d1 - 0.02, d0 + 0.03 + Math.max(0.16, depth * rng.float(0.6, 0.9))), y0, y1, m));
  }
  const solid = alongFace(f, at, len, d0, d1, 0, h, mat, true);
  collider(B, solid.min[0], 0, solid.min[2], solid.max[0], h, solid.max[2]);
  tagGroup(B, from, gid('shelf', f.dir, at, f.face), 'shelf');
}

/**
 * 両面の島の棚（図書館の書架・店の陳列棚）: x0..x1 × z0..z1（長い方が棚の向き）、高さ h。中央の背板で両面に分け、
 * 両面に中身を置く。当たり判定は描かない箱 1 つ
 */
export function shelfIsland(B: Box[], rng: Rng, x0: number, z0: number, x1: number, z1: number, h: number, mat: MatId = 'bookshelfWood', fill: ShelfFill = 'books', plinth: MatId | null = null): void {
  const from = B.length;
  const alongX = x1 - x0 >= z1 - z0;
  const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
  const c0 = alongX ? z0 : x0, c1 = alongX ? z1 : x1;
  const cm = (c0 + c1) / 2;
  const put = (p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, m: MatId) =>
    B.push(alongX ? box([p0, y0, Math.min(q0, q1)], [p1, y1, Math.max(q0, q1)], m, false) : box([Math.min(q0, q1), y0, p0], [Math.max(q0, q1), y1, p1], m, false));
  put(a0, a1, cm - 0.015, cm + 0.015, 0, h, mat);
  put(a0, a0 + 0.03, c0, c1, 0, h, mat);
  put(a1 - 0.03, a1, c0, c1, 0, h, mat);
  put(a0, a1, c0, c1, h - 0.03, h, mat);
  put(a0 + 0.03, a1 - 0.03, c0 + 0.01, c1 - 0.01, 0, 0.1, plinth ?? mat);
  const levels = shelfLevels(h, 0.42);
  for (let i = 0; i < levels.length; i++) {
    const y = levels[i]!;
    if (i > 0) put(a0 + 0.03, a1 - 0.03, c0, c1, y - 0.025, y, mat);
    const room = (i + 1 < levels.length ? levels[i + 1]! - 0.025 : h - 0.03) - y - 0.02;
    for (const side of [-1, 1] as const) {
      const outer = side < 0 ? c0 : c1;
      const dep = Math.max(0.12, (Math.abs(outer - cm) - 0.03) * rng.float(0.65, 0.95));
      fillLevel(rng, fill, a0 + 0.05, a1 - 0.05, y, room, (p0, p1, y0, y1, m) => put(p0, p1, cm + side * 0.02, cm + side * (0.02 + dep), y0, y1, m));
    }
  }
  collider(B, x0, 0, z0, x1, h, z1);
  tagGroup(B, from, gid('shelf', x0, z0), 'shelf');
}

// ---------------------------------------------------------------- 置き物

/** 鉢植え: 鉢（ソリッド）+ 土 + 葉（通り抜けられる葉の材質、非ソリッド） */
export function plant(B: Box[], x: number, z: number, size = 0.5, h = 1.3, pot: MatId = 'furnitureDark'): void {
  const s = size / 2;
  const from = B.length;
  B.push(box([x - s, 0, z - s], [x + s, 0.42, z + s], pot, true));
  B.push(box([x - s + 0.03, 0.42, z - s + 0.03], [x + s - 0.03, 0.44, z + s - 0.03], 'plantSoil', false));
  const f = s + 0.12;
  B.push(box([x - f, 0.5, z - f], [x + f, Math.max(0.9, h * 0.72), z + f], 'plantLeaf', false));
  B.push(box([x - f * 0.62, Math.max(0.9, h * 0.72), z - f * 0.62], [x + f * 0.62, h, z + f * 0.62], 'plantLeaf', false));
  tagGroup(B, from, gid('plant', x, z), 'plant');
}

/** 大きな植え込み（ロビー・コンコース）: 縁（ソリッド）+ 土 + 葉の塊 */
export function planter(B: Box[], rng: Rng, x0: number, z0: number, x1: number, z1: number, h = 0.55, mat: MatId = 'columnConcrete'): void {
  const from = B.length;
  B.push(box([x0, 0, z0], [x1, h, z1], mat, true));
  B.push(box([x0 + 0.08, h, z0 + 0.08], [x1 - 0.08, h + 0.02, z1 - 0.08], 'plantSoil', false));
  const w = x1 - x0, d = z1 - z0;
  const n = Math.max(1, Math.min(4, Math.round((w * d) / 1.2)));
  for (let k = 0; k < n; k++) {
    const cx = rng.float(x0 + w * 0.3, x1 - w * 0.3), cz = rng.float(z0 + d * 0.3, z1 - d * 0.3);
    const r = Math.min(w, d) * rng.float(0.22, 0.38);
    B.push(box([Math.max(x0, cx - r), h + 0.02, Math.max(z0, cz - r)], [Math.min(x1, cx + r), h + rng.float(0.5, 1.2), Math.min(z1, cz + r)], 'plantLeaf', false));
  }
  tagGroup(B, from, gid('planter', x0, z0), 'planter');
}

/** ごみ箱（筐体 + 縁） */
export function bin(B: Box[], x: number, z: number, mat: MatId = 'metalDark', size = 0.38, h = 0.7): void {
  const s = size / 2;
  const from = B.length;
  B.push(box([x - s, 0, z - s], [x + s, h, z + s], mat, true));
  B.push(box([x - s - 0.01, h - 0.04, z - s - 0.01], [x + s + 0.01, h, z + s + 0.01], 'metal', false));
  tagGroup(B, from, gid('bin', x, z), 'bin');
}

/** 台座 + 上の物 1 つ（展示・隠し部屋）。台座はソリッド、上の物は非ソリッド */
export function plinth(B: Box[], cx: number, cz: number, size = 0.6, h = 1.0, mat: MatId = 'marbleWhite', obj: MatId | null = 'goldTrim', objSize = 0.24): void {
  const s = size / 2;
  const from = B.length;
  B.push(box([cx - s, 0, cz - s], [cx + s, h, cz + s], mat, true));
  B.push(box([cx - s - 0.03, 0, cz - s - 0.03], [cx + s + 0.03, 0.08, cz + s + 0.03], mat, false));
  B.push(box([cx - s - 0.02, h - 0.04, cz - s - 0.02], [cx + s + 0.02, h, cz + s + 0.02], mat, false));
  if (obj) {
    const o = objSize / 2;
    B.push(box([cx - o, h, cz - o], [cx + o, h + objSize * 1.3, cz + o], obj, false));
  }
  tagGroup(B, from, gid('plinth', cx, cz), 'plinth');
}

/** 机の上の電気スタンド（台 + 発光する笠。非ソリッド） */
export function lamp(B: Box[], x: number, z: number, y: number): void {
  B.push(box([x - 0.07, y, z - 0.07], [x + 0.07, y + 0.03, z + 0.07], 'metalDark', false));
  B.push(box([x - 0.012, y + 0.03, z - 0.012], [x + 0.012, y + 0.32, z + 0.012], 'metalDark', false));
  B.push(box([x - 0.11, y + 0.32, z - 0.11], [x + 0.11, y + 0.46, z + 0.11], 'lightWarm', false));
}

/** 受付台（自立）: 本体（ソリッド）+ 張り出した天板 + 正面の帯。toward は受付の人が向く向き（客の側） */
export function reception(B: Box[], cx: number, cz: number, w: number, d: number, toward: Dir, mat: MatId = 'woodPanel', top: MatId = 'marbleWhite', h = 1.05): void {
  const from = B.length;
  const hw = w / 2, hd = d / 2;
  B.push(ob(cx, cz, toward, -hw, hw, -hd, hd, 0, h - 0.04, mat, true));
  B.push(ob(cx, cz, toward, -hw - 0.03, hw + 0.03, -hd, hd + 0.12, h - 0.04, h, top));
  B.push(ob(cx, cz, toward, -hw + 0.05, hw - 0.05, hd, hd + 0.01, 0.12, 0.2, 'metalDark'));
  // 内側の作業台と画面（受付の人の側）
  B.push(ob(cx, cz, toward, -hw + 0.1, hw - 0.1, -hd - 0.3, -hd, 0.72, 0.75, 'furnitureLight'));
  B.push(ob(cx, cz, toward, -0.25, 0.25, -hd - 0.08, -hd - 0.04, 0.78, 1.1, 'screenDark'));
  tagGroup(B, from, gid('reception', cx, cz), 'counter');
}

/** パレット（木の台 0.14 m）+ 段ボールの山（ソリッド） */
export function pallet(B: Box[], rng: Rng, cx: number, cz: number, alongX: boolean, maxH = 1.6): void {
  const w = alongX ? 1.2 : 1.0, d = alongX ? 1.0 : 1.2;
  const from = B.length;
  B.push(box([cx - w / 2, 0, cz - d / 2], [cx + w / 2, 0.14, cz + d / 2], 'furnitureLight', true));
  let y = 0.14;
  const layers = rng.int(1, 3);
  for (let k = 0; k < layers && y < maxH - 0.3; k++) {
    const shrink = k * rng.float(0.02, 0.08);
    const bh = Math.min(maxH - y, rng.float(0.35, 0.6));
    B.push(box([cx - w / 2 + 0.03 + shrink, y, cz - d / 2 + 0.03 + shrink], [cx + w / 2 - 0.03 - shrink, y + bh, cz + d / 2 - 0.03 - shrink], 'boxCardboard', true));
    y += bh;
  }
  tagGroup(B, from, gid('pallet', cx, cz), 'pallet');
}

/** 木箱・段ボールの山（床に直置き。ソリッド） */
export function crate(B: Box[], x: number, z: number, s: number, h: number, mat: MatId = 'boxCardboard'): void {
  const from = B.length;
  B.push(box([x - s / 2, 0, z - s / 2], [x + s / 2, h, z + s / 2], mat, true));
  tagGroup(B, from, gid('crate', x, z), 'crate');
}

/** 三角コーン（下の筒はソリッド） */
export function cone(B: Box[], x: number, z: number): void {
  const from = B.length;
  B.push(box([x - 0.13, 0.03, z - 0.13], [x + 0.13, 0.3, z + 0.13], 'plasticRed', true));
  B.push(box([x - 0.18, 0, z - 0.18], [x + 0.18, 0.03, z + 0.18], 'rubber', false));
  B.push(box([x - 0.08, 0.3, z - 0.08], [x + 0.08, 0.5, z + 0.08], 'plasticRed', false));
  B.push(box([x - 0.11, 0.24, z - 0.11], [x + 0.11, 0.3, z + 0.11], 'paintWhite', false));
  tagGroup(B, from, gid('cone', x, z), 'cone');
}

/** 柔らかい遊具の塊（キッズスペース）: 色の付いた箱（ソリッド）+ 上の縁の色帯 */
export function softBlock(B: Box[], x0: number, z0: number, x1: number, z1: number, h: number, mat: MatId, trim: MatId = 'whiteFabric'): void {
  const from = B.length;
  B.push(box([x0, 0, z0], [x1, h, z1], mat, true));
  B.push(box([x0 - 0.005, h - 0.05, z0 - 0.005], [x1 + 0.005, h, z1 + 0.005], trim, false));
  tagGroup(B, from, gid('softBlock', x0, z0), 'softBlock');
}

/** 床に敷く物（マット・敷物）。非ソリッドの薄い板 */
export function rug(B: Box[], x0: number, z0: number, x1: number, z1: number, mat: MatId = 'carpetPattern', h = 0.012): void {
  B.push(box([x0, 0.002, z0], [x1, h, z1], mat, false));
}

/** サーバーラックの列: 本体（ソリッド 1 箱）+ 0.6 m ごとの扉の目地・LED（非ソリッド、両面） */
export function serverRow(B: Box[], rng: Rng, x0: number, z0: number, x1: number, z1: number, h: number): void {
  const from = B.length;
  const alongX = x1 - x0 >= z1 - z0;
  const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
  const c0 = alongX ? z0 : x0, c1 = alongX ? z1 : x1;
  B.push(box([x0, 0, z0], [x1, h, z1], 'metalDark', true));
  B.push(box([x0 - 0.005, h - 0.04, z0 - 0.005], [x1 + 0.005, h, z1 + 0.005], 'screenDark', false));
  const n = Math.max(1, Math.floor((a1 - a0) / 0.6));
  const w = (a1 - a0) / n;
  const put = (p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, m: MatId) =>
    B.push(alongX ? box([p0, y0, Math.min(q0, q1)], [p1, y1, Math.max(q0, q1)], m, false) : box([Math.min(q0, q1), y0, p0], [Math.max(q0, q1), y1, p1], m, false));
  for (const [face, s] of [[c0, -1], [c1, 1]] as const) {
    for (let k = 0; k < n; k++) {
      const a = a0 + k * w;
      if (k > 0) put(a - 0.006, a + 0.006, face, face + s * 0.006, 0.05, h - 0.06, 'screenDark');
      const ly = rng.float(1.0, h - 0.5);
      put(a + w * 0.15, a + w * 0.15 + 0.02, face, face + s * 0.008, ly, ly + rng.float(0.15, 0.45), rng.chance(0.85) ? 'ledBlue' : 'lightGreen');
      put(a + w * 0.3, a + w * 0.7, face, face + s * 0.006, 0.12, 0.26, 'metal');
    }
  }
  tagGroup(B, from, gid('serverRack', x0, z0), 'serverRack');
}

/**
 * 劇場の座席の列: a0..a1（列の向き）、c（列の中心線）、床 y（段床の上面）、facing は座った人が向く向き。
 * 当たり判定は座の台と背の列（ソリッド 2 箱）、座布団・背もたれ・肘掛けは席ごとの非ソリッド
 */
export function seatRow(B: Box[], alongX: boolean, a0: number, a1: number, c: number, y: number, facing: Dir, mat: MatId = 'seatRed'): void {
  const from = B.length;
  // 背の側（facing と反対）が -、前が +。b は c からの距離
  const sgn = facing === 0 || facing === 1 ? 1 : -1;
  const put = (p0: number, p1: number, b0: number, b1: number, y0: number, y1: number, m: MatId, solid = false) => {
    const q0 = c + sgn * b0, q1 = c + sgn * b1;
    B.push(alongX ? box([p0, y0, Math.min(q0, q1)], [p1, y1, Math.max(q0, q1)], m, solid) : box([Math.min(q0, q1), y0, p0], [Math.max(q0, q1), y1, p1], m, solid));
  };
  put(a0, a1, -0.25, 0.22, y, y + 0.4, 'metalDark', true);
  put(a0, a1, -0.3, -0.22, y + 0.4, y + 0.95, 'metalDark', true);
  const n = Math.max(1, Math.floor((a1 - a0) / 0.55));
  const w = (a1 - a0) / n;
  for (let k = 0; k < n; k++) {
    const p = a0 + k * w;
    put(p + 0.04, p + w - 0.04, -0.2, 0.24, y + 0.4, y + 0.48, mat);
    put(p + 0.05, p + w - 0.05, -0.22, -0.16, y + 0.48, y + 0.92, mat);
    put(p - 0.025, p + 0.025, -0.22, 0.2, y + 0.4, y + 0.64, 'metalDark');
  }
  put(a1 - 0.025, a1, -0.22, 0.2, y + 0.4, y + 0.64, 'metalDark');
  tagGroup(B, from, gid('seatRow', alongX ? a0 : c, alongX ? c : a0), 'seatRow');
}

/** 水泳の飛び込み台（白い台 + 上面の滑り止め + 番号板）。toward は飛び込む向き */
export function startBlock(B: Box[], cx: number, cz: number, toward: Dir): void {
  const from = B.length;
  B.push(ob(cx, cz, toward, -0.25, 0.25, -0.25, 0.25, 0, 0.7, 'paintWhite', true));
  B.push(ob(cx, cz, toward, -0.26, 0.26, -0.24, 0.28, 0.7, 0.74, 'plasticBlue'));
  B.push(ob(cx, cz, toward, -0.12, 0.12, -0.26, -0.25, 0.4, 0.62, 'signPlate'));
  tagGroup(B, from, gid('startBlock', cx, cz), 'startBlock');
}

/** 監視台（高い椅子。脚は非ソリッド、座と背はソリッド） */
export function lifeguardChair(B: Box[], cx: number, cz: number, facing: Dir): void {
  const from = B.length;
  B.push(ob(cx, cz, facing, -0.35, 0.35, -0.35, 0.35, 0, 0.12, 'paintWhite', true));
  for (const s of [-1, 1]) for (const t of [-1, 1]) B.push(ob(cx, cz, facing, s * 0.28 - 0.03, s * 0.28 + 0.03, t * 0.28 - 0.03, t * 0.28 + 0.03, 0.12, 1.5, 'paintWhite'));
  B.push(ob(cx, cz, facing, -0.32, 0.32, -0.32, 0.32, 1.5, 1.56, 'paintWhite', true));
  B.push(ob(cx, cz, facing, -0.3, 0.3, -0.34, -0.28, 1.56, 2.1, 'paintWhite', true));
  for (const y of [0.45, 0.8, 1.15]) B.push(ob(cx, cz, facing, -0.28, 0.28, 0.3, 0.33, y, y + 0.04, 'paintWhite'));
  tagGroup(B, from, gid('lifeguard', cx, cz), 'lifeguardChair');
}

/**
 * 冷蔵の陳列ケース（ガラス扉）: 当たり判定は描かない箱 1 つ。背板・側板・天板・台輪・棚・商品・ガラス扉・枠・上の灯りは非ソリッド
 * （本体を 1 つの不透明な箱にすると中の商品が見えないため）
 */
export function coolerCase(B: Box[], rng: Rng, f: Face, at: number, len: number, h = 2.0, standoff = 0.02): void {
  const from = B.length;
  const d0 = standoff, d1 = standoff + 0.7;
  const put = (p: number, w: number, q0: number, q1: number, y0: number, y1: number, m: MatId) => B.push(alongFace(f, p, w, q0, q1, y0, y1, m, false));
  put(at, len, d0, d0 + 0.03, 0, h, 'paintWhite');
  put(at, 0.04, d0, d1, 0, h, 'paintWhite');
  put(at + len - 0.04, 0.04, d0, d1, 0, h, 'paintWhite');
  put(at, len, d0, d1, h - 0.22, h, 'paintWhite');
  put(at + 0.04, len - 0.08, d0, d1, 0, 0.18, 'metalDark');
  put(at + 0.1, len - 0.2, d1 - 0.03, d1 - 0.01, h - 0.2, h - 0.12, 'lightPanel');
  const levels = [0.2, 0.62, 1.04, 1.46].filter((y) => y < h - 0.5);
  for (const y of levels) {
    put(at + 0.04, len - 0.08, d0 + 0.03, d1 - 0.06, y - 0.02, y, 'metal');
    let t = at + 0.08;
    while (t < at + len - 0.25) {
      const w = Math.min(at + len - 0.08 - t, rng.float(0.18, 0.4));
      put(t, w - 0.02, d0 + 0.06, d0 + 0.06 + rng.float(0.25, 0.5), y, y + rng.float(0.16, 0.3), rng.pick(['canLabel', 'plasticRed', 'plasticBlue', 'paintWhite', 'plasticYellow'] as MatId[]));
      t += w;
    }
  }
  const doors = Math.max(1, Math.round(len / 0.75));
  const dw = (len - 0.08) / doors;
  for (let k = 0; k < doors; k++) {
    const p = at + 0.04 + k * dw;
    put(p + 0.02, dw - 0.04, d1 - 0.012, d1, 0.2, h - 0.24, 'carGlass');
    put(p, 0.02, d1 - 0.015, d1 + 0.005, 0.18, h - 0.22, 'metalDark');
    put(p + dw - 0.08, 0.025, d1, d1 + 0.03, 0.8, 1.3, 'metal');
  }
  const solid = alongFace(f, at, len, d0, d1, 0, h, 'metalDark', true);
  collider(B, solid.min[0], 0, solid.min[2], solid.max[0], h, solid.max[2]);
  tagGroup(B, from, gid('cooler', f.dir, at, f.face), 'cooler');
}

/** 展示ケース（木の台の上にガラスの箱、中に物 1 つ）。台はソリッド、ガラスと中の物は非ソリッド */
export function vitrine(B: Box[], cx: number, cz: number, w: number, d: number, mat: MatId = 'woodPanel', obj: MatId = 'goldTrim'): void {
  const from = B.length;
  const hw = w / 2, hd = d / 2;
  B.push(box([cx - hw, 0, cz - hd], [cx + hw, 0.9, cz + hd], mat, true));
  B.push(box([cx - hw - 0.02, 0.86, cz - hd - 0.02], [cx + hw + 0.02, 0.9, cz + hd + 0.02], 'metalDark', false));
  B.push(box([cx - hw + 0.02, 0.9, cz - hd + 0.02], [cx + hw - 0.02, 1.38, cz + hd - 0.02], 'glass', false));
  const o = Math.min(hw, hd) * 0.45;
  B.push(box([cx - o, 0.9, cz - o * 0.7], [cx + o, 0.9 + o * 1.2, cz + o * 0.7], obj, false));
  tagGroup(B, from, gid('vitrine', cx, cz), 'vitrine');
}
