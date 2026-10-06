/**
 * 大物の家具を箱で本物の比率に組む部品（v1 generators/furniture.ts から移植）。
 *
 * - 家具は「当たり判定になる少数のソリッド箱 + 見た目の非ソリッド薄箱」。高さは区画の床から（床 = 0）
 * - v1 では描画側（ArchitecturalDetails）が shelfMetal の塊を支柱 + 段板に描き替えていたが、v2 の描画は箱をそのまま描く。
 *   そのため棚（rack）は「描かない当たり判定（kind 'colliderOnly'）+ 支柱・段板・荷物の非ソリッド箱」で組み直した
 * - サイン（SignSpec）・デカール・インスタンスは v2 の layout にまだ無いので作らない（文字の無い板・箱で表す）
 * - 置けるかの判定（扉前・足跡・重なり）は呼ぶ側（ctx.placeUnit）が箱の組ごとに見る
 */
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId } from '../../world/layout.ts';
import { alongFace, hitsZone, insideRects, type Face } from './geom.ts';

// ---------------------------------------------------------------- 表示用の意味タグ

/**
 * from 以降に足した箱に表示用のグループ id（Box.propGroup）を付け、主箱に kind を付ける（v1 と同じ）。
 * 主箱を省くと、from 以降で最初の「描かない当たり判定ではない」箱
 */
export function tagGroup(B: Box[], from: number, group: string, kind: string, primary?: number): void {
  for (let i = from; i < B.length; i++) B[i]!.propGroup = group;
  let p = primary ?? from;
  if (primary === undefined) while (p < B.length && B[p]!.kind === 'colliderOnly') p++;
  if (p >= from && p < B.length && B[p]!.kind !== 'colliderOnly') B[p]!.kind = kind;
}

/** 表示用グループの id（種類 + 位置。ctx.placeUnit が区画の id を前に付ける） */
export const gid = (kind: string, ...v: number[]): string => `${kind}@${v.map((x) => x.toFixed(2)).join(',')}`;

/** 描かない当たり判定（細い部材で組んだ家具の中へ入り込まないように。描画は kind 'colliderOnly' を飛ばす） */
export function collider(B: Box[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  const b = box([x0, y0, z0], [x1, y1, z1], 'metalDark', true);
  b.kind = 'colliderOnly';
  B.push(b);
}

// ---------------------------------------------------------------- 家具ユニット（寸法は実物）

/** ロッカー列: 幅 0.4 単位 × 奥 0.5 × 高 1.8。本体 1 箱（ソリッド）+ 扉の溝・通気口・取っ手（非ソリッド）。a0 から n 台 */
export function lockerBank(B: Box[], f: Face, a0: number, n: number, standoff = 0.02, depth = 0.5, height = 1.8, mat: MatId = 'lockerGreen'): void {
  if (n <= 0) return;
  const w = n * 0.4;
  const front = standoff + depth;
  const from = B.length;
  B.push(alongFace(f, a0, w, standoff, front, 0, height, mat, true));
  // 台輪（暗い足元）と天板の縁
  B.push(alongFace(f, a0, w, front - 0.01, front + 0.004, 0, 0.08, 'metalDark', false));
  B.push(alongFace(f, a0, w, front - 0.01, front + 0.004, height - 0.03, height, 'metalDark', false));
  for (let k = 0; k <= n; k++) {
    // 扉の縁の溝
    B.push(alongFace(f, a0 + k * 0.4 - 0.007, 0.014, front - 0.01, front + 0.003, 0.08, height - 0.03, 'metalDark', false));
  }
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 0.4;
    // 通気口（上下に 2 段の横溝）
    for (const y of [0.32, 0.38, height - 0.38, height - 0.32]) B.push(alongFace(f, a + 0.11, 0.18, front - 0.006, front + 0.004, y, y + 0.022, 'metalDark', false));
    // 取っ手（右寄り）
    B.push(alongFace(f, a + 0.31, 0.03, front, front + 0.02, height * 0.54, height * 0.54 + 0.12, 'metalDark', false));
  }
  tagGroup(B, from, gid('lockers', f.dir, a0, f.face), 'lockers');
}

/** ロッカーを a0..a1 に 0.4 単位で並べる。禁止領域に掛かる台は飛ばし、連続する台をまとめて 1 列にする。置いた台数を返す */
export function lockersAlong(B: Box[], f: Face, a0: number, a1: number, zones: readonly AABB[], rects: readonly Rect[], standoff = 0.02, mat: MatId = 'lockerGreen', height = 1.8): number {
  const n = Math.floor((a1 - a0 - 0.1) / 0.4);
  if (n <= 0) return 0;
  const start = a0 + (a1 - a0 - n * 0.4) / 2;
  let run = -1;
  let placed = 0;
  const flush = (end: number) => {
    if (run >= 0 && end > run) lockerBank(B, f, start + run * 0.4, end - run, standoff, 0.5, height, mat);
    placed += run >= 0 ? end - run : 0;
    run = -1;
  };
  for (let k = 0; k < n; k++) {
    const unit = alongFace(f, start + k * 0.4, 0.4, standoff, standoff + 0.5, 0, height, mat);
    const ok = !hitsZone(zones, unit) && insideRects(rects, unit, WALL_T - 0.001);
    if (ok && run < 0) run = k;
    if (!ok) flush(k);
  }
  flush(n);
  return placed;
}

/** 木のベンチ: 天板 0.35 幅 × 高 0.45（ソリッド）、metalDark の脚（非ソリッド） */
export function bench(B: Box[], alongX: boolean, cx: number, cz: number, len: number, mat: MatId = 'handrailWood'): void {
  const hw = 0.175;
  const from = B.length;
  B.push(alongX ? box([cx - len / 2, 0.4, cz - hw], [cx + len / 2, 0.45, cz + hw], mat) : box([cx - hw, 0.4, cz - len / 2], [cx + hw, 0.45, cz + len / 2], mat));
  const legs = Math.max(2, Math.ceil(len / 1.5) + 1);
  for (let i = 0; i < legs; i++) {
    const t = -len / 2 + 0.2 + (len - 0.4) * (i / (legs - 1));
    const lx = alongX ? cx + t : cx;
    const lz = alongX ? cz : cz + t;
    if (alongX) B.push(box([lx - 0.02, 0, lz - hw + 0.03], [lx + 0.02, 0.4, lz + hw - 0.03], 'metalDark', false));
    else B.push(box([lx - hw + 0.03, 0, lz - 0.02], [lx + hw - 0.03, 0.4, lz + 0.02], 'metalDark', false));
  }
  tagGroup(B, from, gid('bench', cx, cz), 'bench');
}

/** 長机 1.8 × 0.75 × 高 0.72: 天板 3 cm（ソリッド）+ 幕板（非ソリッド）+ metalDark の脚 5 cm */
export function longTable(B: Box[], cx: number, cz: number, alongX: boolean, len = 1.8, dep = 0.75, h = 0.72, mat: MatId = 'furnitureLight'): void {
  const hx = alongX ? len / 2 : dep / 2;
  const hz = alongX ? dep / 2 : len / 2;
  const from = B.length;
  B.push(box([cx - hx, h - 0.03, cz - hz], [cx + hx, h, cz + hz], mat));
  B.push(box([cx - hx + 0.1, h - 0.1, cz - hz + 0.1], [cx + hx - 0.1, h - 0.03, cz + hz - 0.1], mat, false));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = cx + sx * (hx - 0.08);
    const lz = cz + sz * (hz - 0.08);
    B.push(box([lx - 0.025, 0, lz - 0.025], [lx + 0.025, h - 0.03, lz + 0.025], 'metalDark', false));
  }
  tagGroup(B, from, gid('table', cx, cz), 'table');
}

/** 椅子: 座 0.45 × 0.45 高 0.45 + 背 0.4（ソリッド）、metalDark の脚（非ソリッド）。facing は座った人が向く方向 */
export function chair(B: Box[], cx: number, cz: number, facing: Dir, mat: MatId = 'seatBlue'): void {
  const s = 0.225;
  const from = B.length;
  B.push(box([cx - s, 0.41, cz - s], [cx + s, 0.45, cz + s], mat));
  switch (facing) {
    case 0: B.push(box([cx - s, 0.45, cz - s], [cx + s, 0.85, cz - s + 0.05], mat)); break;
    case 2: B.push(box([cx - s, 0.45, cz + s - 0.05], [cx + s, 0.85, cz + s], mat)); break;
    case 1: B.push(box([cx - s, 0.45, cz - s], [cx - s + 0.05, 0.85, cz + s], mat)); break;
    default: B.push(box([cx + s - 0.05, 0.45, cz - s], [cx + s, 0.85, cz + s], mat)); break;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = cx + sx * (s - 0.04);
    const lz = cz + sz * (s - 0.04);
    B.push(box([lx - 0.015, 0, lz - 0.015], [lx + 0.015, 0.41, lz + 0.015], 'metalDark', false));
  }
  tagGroup(B, from, gid('chair', cx, cz), 'chair');
}

/** 連結椅子（待合ベンチ）: n 席 × 0.5 ピッチ。座 0.45 × 0.45 高 0.45 + 背 0.4、metalDark の梁と脚。facing は座った人が向く方向 */
export function linkedSeats(B: Box[], cx: number, cz: number, n: number, facing: Dir, mat: MatId = 'seatBlue'): void {
  const len = n * 0.5;
  const alongX = facing === 0 || facing === 2; // 列は facing と直交
  const s = 0.225;
  const from = B.length;
  // 梁（床上 0.33〜0.38）と両端の脚
  if (alongX) B.push(box([cx - len / 2 + 0.05, 0.33, cz - 0.03], [cx + len / 2 - 0.05, 0.38, cz + 0.03], 'metalDark', false));
  else B.push(box([cx - 0.03, 0.33, cz - len / 2 + 0.05], [cx + 0.03, 0.38, cz + len / 2 - 0.05], 'metalDark', false));
  for (const e of [-1, 1]) {
    const t = e * (len / 2 - 0.12);
    if (alongX) B.push(box([cx + t - 0.02, 0, cz - s + 0.02], [cx + t + 0.02, 0.33, cz + s - 0.02], 'metalDark', false));
    else B.push(box([cx - s + 0.02, 0, cz + t - 0.02], [cx + s - 0.02, 0.33, cz + t + 0.02], 'metalDark', false));
  }
  for (let k = 0; k < n; k++) {
    const t = -len / 2 + 0.25 + k * 0.5;
    const ux = alongX ? cx + t : cx;
    const uz = alongX ? cz : cz + t;
    B.push(box([ux - s, 0.38, uz - s], [ux + s, 0.45, uz + s], mat));
    switch (facing) {
      case 0: B.push(box([ux - s, 0.45, uz - s], [ux + s, 0.85, uz - s + 0.06], mat)); break;
      case 2: B.push(box([ux - s, 0.45, uz + s - 0.06], [ux + s, 0.85, uz + s], mat)); break;
      case 1: B.push(box([ux - s, 0.45, uz - s], [ux - s + 0.06, 0.85, uz + s], mat)); break;
      default: B.push(box([ux + s - 0.06, 0.45, uz - s], [ux + s, 0.85, uz + s], mat)); break;
    }
  }
  // 主箱は最初の座（梁は非ソリッドなので、描画の置き換えと乱れの判定は座の列を見る）
  tagGroup(B, from, gid('linkedSeats', cx, cz), 'linkedSeats', from + 3);
}

/** 自販機 0.9 × 0.8 × 1.85: 暗い筐体（ソリッド）+ 前面の発光箔 + 下部の取り出し口 */
export function vending(B: Box[], f: Face, at: number, glow: MatId = 'lightPanel', standoff = 0.05): void {
  const d0 = standoff, d1 = standoff + 0.8;
  const from = B.length;
  B.push(alongFace(f, at, 0.9, d0, d1, 0, 1.85, 'metalDark', true));
  B.push(alongFace(f, at + 0.08, 0.66, d1, d1 + 0.012, 0.78, 1.72, glow, false));
  B.push(alongFace(f, at + 0.08, 0.66, d1, d1 + 0.01, 0.55, 0.72, 'shelfMetal', false));
  B.push(alongFace(f, at + 0.16, 0.5, d1, d1 + 0.012, 0.18, 0.42, 'metal', false));
  B.push(alongFace(f, at + 0.76, 0.1, d1, d1 + 0.018, 1.0, 1.35, 'shelfMetal', false));
  tagGroup(B, from, gid('vending', f.dir, at, f.face), 'vending');
}

/** カウンター（返却台・受付）: 本体（ソリッド）+ 天板 3 cm */
export function counter(B: Box[], f: Face, at: number, len: number, depth = 0.6, h = 0.9, base: MatId = 'shelfMetal', top: MatId = 'metal', standoff = 0.02): void {
  const from = B.length;
  B.push(alongFace(f, at, len, standoff, standoff + depth, 0, h - 0.03, base, true));
  B.push(alongFace(f, at - 0.02, len + 0.04, standoff, standoff + depth + 0.03, h - 0.03, h, top, false));
  tagGroup(B, from, gid('counter', f.dir, at, f.face), 'counter');
}

// ---------------------------------------------------------------- 窓（壁を実際に抜いた開口に入れる）

/** 窓の開口。面 f（壁の室内面）の a0..a1、高さ y0..y1。壁は区画を作るとき（makeCell の openings に sill 付きの開口）に抜いておく */
export interface WindowOpening {
  face: Face;
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

/** 夜景の箔の位置（壁の外面側。室内面から WALL_T − 6〜12 mm 奥 = ガラスから約 9 cm 奥） */
export const WINDOW_NIGHT_INSET: [number, number] = [-(WALL_T - 0.006), -(WALL_T - 0.012)];

/**
 * 窓の中身（開口は壁を作るときに抜いてある前提。v1 と同じ）:
 *   夜景 'windowNight'（開口より上下左右に大きく。余白は壁の中に隠れる）/ ガラス（ソリッド: 開口を塞ぐ当たり判定）/
 *   窓台（壁の上端を覆い 9 cm 室内へ出る）/ 上桟 / metalDark の方立 1.5 m 間隔
 * 中身の家具の部屋（dressCell）は壁を抜けないので使わない。抜いた壁のない所の窓らしさは decor.wallWindow（壁面の窓）で出す
 */
export function windowGlazing(B: Box[], o: WindowOpening): void {
  const { face: f, a0, a1, y0, y1 } = o;
  const len = a1 - a0;
  if (len < 0.3) return;
  B.push(alongFace(f, a0 - 0.15, len + 0.3, WINDOW_NIGHT_INSET[0], WINDOW_NIGHT_INSET[1], y0 - 0.12, y1 + 0.12, 'windowNight', false));
  B.push(alongFace(f, a0, len, 0.045, 0.06, y0, y1, 'glass', true));
  B.push(alongFace(f, a0 - 0.03, len + 0.06, -(WALL_T - 0.005), 0.09, y0, y0 + 0.025, 'trim', false));
  // 上桟・方立ては 0.065 までガラス（0.06）より手前に出す（同一平面にすると z-fight で縞が出る）
  B.push(alongFace(f, a0, len, 0.0, 0.065, y1 - 0.05, y1, 'metalDark', false));
  const n = Math.max(1, Math.round(len / 1.5));
  for (let k = 0; k <= n; k++) {
    const a = a0 + (len * k) / n;
    B.push(alongFace(f, Math.min(a1 - 0.04, Math.max(a0, a - 0.02)), 0.04, 0.0, 0.065, y0, y1, 'metalDark', false));
  }
}

// ---------------------------------------------------------------- バックヤード・トイレの大物

/**
 * カゴ車（ロールボックスパレット）0.8 × 1.1 × 1.7: 壁沿い、長辺（1.1）を壁に平行に。
 * 当たり判定はデッキ（床上 0.18〜0.22）と中の段ボール（ソリッド）。金属の格子は細い非ソリッド箱
 */
export function rollCage(B: Box[], rng: Rng, f: Face, at: number, standoff = 0.06): void {
  const w = 1.1, d = 0.8, h = 1.7;
  const d0 = standoff, d1 = standoff + d;
  const from = B.length;
  // デッキとキャスター
  B.push(alongFace(f, at, w, d0, d1, 0.18, 0.22, 'metalDark', true));
  for (const [u, v] of [[0.05, 0.05], [w - 0.13, 0.05], [0.05, d - 0.13], [w - 0.13, d - 0.13]] as const) B.push(alongFace(f, at + u, 0.08, d0 + v, d0 + v + 0.08, 0.04, 0.18, 'metalDark', false));
  // 支柱（4 隅）
  for (const [u, v] of [[0, 0], [w - 0.03, 0], [0, d - 0.03], [w - 0.03, d - 0.03]] as const) B.push(alongFace(f, at + u, 0.03, d0 + v, d0 + v + 0.03, 0.18, h, 'metal', false));
  // 横桟: 背面（壁側）と両側面。前面は開いている
  for (const y of [0.45, 0.75, 1.05, 1.35, 1.65]) {
    B.push(alongFace(f, at + 0.03, w - 0.06, d0, d0 + 0.015, y, y + 0.015, 'metal', false));
    B.push(alongFace(f, at, 0.015, d0 + 0.03, d1 - 0.03, y, y + 0.015, 'metal', false));
    B.push(alongFace(f, at + w - 0.015, 0.015, d0 + 0.03, d1 - 0.03, y, y + 0.015, 'metal', false));
  }
  // 縦桟（背面 4 本）
  for (let k = 1; k <= 4; k++) B.push(alongFace(f, at + (w * k) / 5 - 0.006, 0.012, d0, d0 + 0.012, 0.22, h - 0.02, 'metal', false));
  // 中身: 段ボール 1〜2 段（ソリッド。中に入り込めないようにする）
  const bh = rng.float(0.45, 0.7);
  B.push(alongFace(f, at + 0.06, w - 0.12, d0 + 0.05, d1 - 0.05, 0.22, 0.22 + bh, 'boxCardboard', true));
  if (rng.chance(0.7)) {
    const bw = rng.float(0.5, w - 0.16);
    B.push(alongFace(f, at + 0.08 + rng.float(0, w - 0.16 - bw), bw, d0 + 0.08, d1 - 0.1, 0.22 + bh, Math.min(h - 0.15, 0.22 + bh + rng.float(0.35, 0.6)), 'boxCardboard', true));
  }
  tagGroup(B, from, gid('rollCage', f.dir, at, f.face), 'rollCage');
}

/** 小便器の列: 壁掛けの白い器（0.35 × 0.6 × 0.4、床上 0.55、ソリッド）+ 洗浄管 + センサー板 + 間の仕切り板。ピッチ 0.75 */
export function urinalRow(B: Box[], f: Face, a0: number, n: number): void {
  if (n <= 0) return;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 0.75;
    const from = B.length;
    B.push(alongFace(f, a + 0.2, 0.35, 0.02, 0.42, 0.55, 1.15, 'marbleWhite', true));
    B.push(alongFace(f, a + 0.2 + 0.04, 0.27, 0.42, 0.44, 0.62, 0.72, 'metalDark', false));
    B.push(alongFace(f, a + 0.36, 0.03, 0.02, 0.05, 1.15, 1.45, 'metal', false));
    B.push(alongFace(f, a + 0.3, 0.15, 0.0, 0.02, 1.45, 1.6, 'metal', false));
    if (k < n - 1) B.push(alongFace(f, a + 0.735, 0.03, 0.0, 0.45, 0.6, 1.5, 'furnitureLight', false));
    tagGroup(B, from, gid('urinal', f.dir, a, f.face), 'urinal');
  }
}

/** コインランドリーの業務用洗濯機（幅 0.72 × 奥 0.75 × 高 1.05）。stacked なら上に乾燥機（高 0.85）を重ねる */
export const WASHER_W = 0.72;
export const WASHER_D = 0.75;
export const WASHER_H = 1.05;
export const DRYER_H = 0.85;
/** 壁（または島の中心線）から筐体の前面まで（背の隙間 0.03 + 奥行） */
export const WASHER_OUT = 0.03 + WASHER_D;
/** 列の間隔（隣との隙間 2 cm） */
export const WASHER_PITCH = WASHER_W + 0.02;
export function washer(B: Box[], f: Face, at: number, stacked = false): void {
  const d0 = 0.03, d1 = WASHER_OUT, W = WASHER_W;
  const unit = (y: number, dryer: boolean) => {
    const H = dryer ? DRYER_H : WASHER_H;
    const from = B.length;
    B.push(alongFace(f, at, W, d0, d1, y, y + H, 'paintWhite', true));
    // 丸窓は筐体の幅の 60%（業務用の大きなドア）。乾燥機は上寄り、洗濯機は中央やや上
    const win = W * 0.6, wy = dryer ? y + H * 0.3 : y + H * 0.28;
    B.push(alongFace(f, at + (W - win) / 2, win, d1, d1 + 0.012, wy, wy + win, 'metalDark', false));
    B.push(alongFace(f, at + (W - win * 0.84) / 2, win * 0.84, d1, d1 + 0.02, wy + win * 0.08, wy + win * 0.92, 'carGlass', false));
    B.push(alongFace(f, at + W * 0.08, W * 0.84, d1, d1 + 0.01, y + (dryer ? 0.06 : H - 0.17), y + (dryer ? 0.16 : H - 0.05), 'metalDark', false));
    tagGroup(B, from, gid(dryer ? 'dryer' : 'washer', f.dir, at, f.face, y), dryer ? 'dryer' : 'washer');
  };
  unit(0, false);
  if (stacked) unit(WASHER_H, true);
}

/** トイレブース: 幅 0.9 × 奥 1.4、間仕切りは床から 0.15 浮き、高さ 2.05（扉 0.7 幅）。n 室を a0 から */
export function booths(B: Box[], f: Face, a0: number, n: number, depth = 1.4, mat: MatId = 'furnitureLight'): void {
  if (n <= 0) return;
  const w = 0.9, t = 0.03, yb = 0.15, yt = 2.05;
  const from = B.length;
  for (let k = 0; k <= n; k++) {
    const a = a0 + k * w;
    B.push(alongFace(f, a - t / 2, t, 0.0, depth, yb, yt, mat, true));
  }
  for (let k = 0; k < n; k++) {
    const a = a0 + k * w;
    // 前板: 固定部 0.1 + 扉 0.7 + 固定部 0.1。扉は少し奥に引く
    B.push(alongFace(f, a, 0.11, depth - t, depth, yb, yt, mat, true));
    B.push(alongFace(f, a + 0.79, 0.11, depth - t, depth, yb, yt, mat, true));
    B.push(alongFace(f, a + 0.11, 0.68, depth - t - 0.015, depth - 0.015, yb, yt, mat, true));
    B.push(alongFace(f, a + 0.108, 0.006, depth - t - 0.02, depth - 0.01, yb, yt, 'metalDark', false));
    B.push(alongFace(f, a + 0.786, 0.006, depth - t - 0.02, depth - 0.01, yb, yt, 'metalDark', false));
    B.push(alongFace(f, a + 0.7, 0.05, depth - 0.015, depth + 0.012, 1.0, 1.06, 'metal', false));
    // 中の便器（奥の壁際。白い器と水槽）
    B.push(alongFace(f, a + 0.27, 0.36, 0.02, 0.62, 0, 0.42, 'marbleWhite', false));
    B.push(alongFace(f, a + 0.25, 0.4, 0.02, 0.2, 0.42, 0.8, 'marbleWhite', false));
  }
  // 上部の笠木
  B.push(alongFace(f, a0 - t / 2, n * w + t, 0.0, depth, yt, yt + 0.04, 'metalDark', false));
  tagGroup(B, from, gid('booths', f.dir, a0, f.face), 'booths');
}

/** 洗面台の列: 壁掛けの白い洗面器（0.5 × 0.45 × 0.2）+ 蛇口 + 上の鏡帯。ピッチ 0.75 */
export function sinkRow(B: Box[], f: Face, a0: number, n: number): void {
  if (n <= 0) return;
  const from = B.length;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 0.75;
    B.push(alongFace(f, a + 0.125, 0.5, 0.02, 0.47, 0.72, 0.9, 'marbleWhite', true));
    B.push(alongFace(f, a + 0.125 + 0.05, 0.4, 0.06, 0.42, 0.9, 0.915, 'marbleWhite', false));
    B.push(alongFace(f, a + 0.36, 0.03, 0.05, 0.08, 0.9, 1.03, 'metal', false));
    B.push(alongFace(f, a + 0.32, 0.11, 0.06, 0.2, 1.0, 1.03, 'metal', false));
    B.push(alongFace(f, a + 0.35, 0.05, 0.02, 0.06, 0.2, 0.72, 'metal', false));
  }
  B.push(alongFace(f, a0 + 0.08, n * 0.75 - 0.16, 0.004, 0.016, 1.1, 1.9, 'carGlass', false));
  B.push(alongFace(f, a0 + 0.06, n * 0.75 - 0.12, 0.0, 0.02, 1.9, 1.93, 'metalDark', false));
  B.push(alongFace(f, a0 + 0.06, n * 0.75 - 0.12, 0.0, 0.02, 1.07, 1.1, 'metalDark', false));
  tagGroup(B, from, gid('sinks', f.dir, a0, f.face), 'sinks');
}

/**
 * スチール棚（x0..x1 × z0..z1、高さ height）+ 段に段ボール箱（幅・高さに揺らぎ、隙間あり）。
 * 当たり判定は棚全体の描かない箱 1 つ。支柱（約 2.7 m ごと）・前後の梁・段板・箱は非ソリッド。
 * 段の高さは v1 と同じ式（0.25 から max(0.9, h/3) ごと）
 */
export function rack(B: Box[], rng: Rng, x0: number, z0: number, x1: number, z1: number, height: number, fillChance = 0.78, post: MatId = 'shelfMetal', beam: MatId = 'shelfMetal'): void {
  const from = B.length;
  const alongX = x1 - x0 >= z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const depth = alongX ? z1 - z0 : x1 - x0;
  const a0 = alongX ? x0 : z0;
  const c0 = alongX ? z0 : x0, c1 = alongX ? z1 : x1;
  // 辺に沿った座標 a・奥行きの座標 c の箱
  const put = (p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, mat: MatId) =>
    B.push(alongX ? box([p0, y0, q0], [p1, y1, q1], mat, false) : box([q0, y0, p0], [q1, y1, p1], mat, false));
  // 支柱
  const bays = Math.max(1, Math.round(len / 2.7));
  for (let k = 0; k <= bays; k++) {
    const a = a0 + Math.min(len - 0.08, Math.max(0, (len * k) / bays - 0.04));
    put(a, a + 0.08, c0, c0 + 0.08, 0, height, post);
    put(a, a + 0.08, c1 - 0.08, c1, 0, height, post);
    // 奥行き方向のつなぎ（支柱の間の筋交いの代わり）
    put(a + 0.02, a + 0.06, c0 + 0.08, c1 - 0.08, 0.1, 0.14, post);
  }
  const step = Math.max(0.9, height / 3);
  for (let level = 0.25; level + 0.05 + 0.3 < height - 0.05; level += step) {
    // 梁（前後）と段板
    put(a0, a0 + len, c0, c0 + 0.05, level - 0.08, level + 0.02, beam);
    put(a0, a0 + len, c1 - 0.05, c1, level - 0.08, level + 0.02, beam);
    put(a0 + 0.04, a0 + len - 0.04, c0 + 0.05, c1 - 0.05, level + 0.02, level + 0.05, 'shelfMetal');
    const top = level + 0.05;
    const room = Math.min(step, height - 0.05 - top) - 0.12; // この段に積める高さ（上の梁の下まで）
    let t = 0.1;
    while (t + 0.35 <= len - 0.1) {
      const bw = rng.float(0.5, 0.9);
      if (t + bw > len - 0.1) break;
      const bd = Math.max(0.35, depth - rng.float(0.12, 0.3));
      const c = (c0 + c1) / 2;
      if (rng.chance(fillChance)) {
        // 1〜2 段に積む（下は大きく、上は少し小さい）
        const tiers = room > 0.9 && rng.chance(0.45) ? 2 : 1;
        let y = top;
        for (let k = 0; k < tiers; k++) {
          const maxH = Math.max(0.25, (room - (y - top)) - (tiers - k - 1) * 0.3 - 0.04);
          const bh = Math.min(maxH, rng.float(0.3, tiers === 1 ? 0.65 : 0.5));
          const w2 = k === 0 ? bw : bw * rng.float(0.75, 1.0);
          const d2 = k === 0 ? bd : bd * rng.float(0.8, 1.0);
          const p0 = a0 + t + (bw - w2) / 2;
          put(p0, p0 + w2, c - d2 / 2, c + d2 / 2, y, y + bh, 'boxCardboard');
          y += bh;
          if (y + 0.3 > top + room) break;
        }
      }
      t += bw + rng.float(0.03, 0.18);
    }
  }
  collider(B, x0, 0, z0, x1, height, z1);
  tagGroup(B, from, gid('rack', x0, z0), 'rack');
}

/** 露出蛍光管ペア（天井から 10 cm 下がる器具の発光面だけ。光源は区画の照明が持つ） */
export function tubePair(B: Box[], x: number, z: number, alongX: boolean, h: number, mat: MatId = 'lightPanel', len = 1.2): void {
  const hx = alongX ? len / 2 : 0.15;
  const hz = alongX ? 0.15 : len / 2;
  B.push(box([x - hx, h - 0.13, z - hz], [x + hx, h - 0.09, z + hz], mat, false));
}

/** 吊り灯（倉庫の高所灯）: 吊り棒 + 笠 + 発光面 */
export function pendant(B: Box[], x: number, z: number, h: number, drop = 1.0, mat: MatId = 'lightPanel'): void {
  const y = h - drop;
  B.push(box([x - 0.015, y + 0.22, z - 0.015], [x + 0.015, h, z + 0.015], 'metalDark', false));
  B.push(box([x - 0.26, y, z - 0.26], [x + 0.26, y + 0.22, z + 0.26], 'metalDark', false));
  B.push(box([x - 0.21, y - 0.02, z - 0.21], [x + 0.21, y, z + 0.21], mat, false));
}

/** 床の線（白線・黄線）。非ソリッドの薄い箔 */
export function floorLine(B: Box[], x0: number, z0: number, x1: number, z1: number, mat: MatId): void {
  B.push(box([Math.min(x0, x1), 0.001, Math.min(z0, z1)], [Math.max(x0, x1), 0.012, Math.max(z0, z1)], mat, false));
}
