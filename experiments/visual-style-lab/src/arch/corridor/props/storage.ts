import type { Prop } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { binder, bottle, cardboardBox, fillShelf, steelShelf, storageBin } from '../../../props/lib/storage.ts';
import { WARD } from './mats.ts';
import { infusionPump, syringePump } from './medical.ts';

/**
 * 病棟の棚と棚の中身（器材庫・物品庫・清潔材料庫・リネン庫・薬剤準備室・ナースステーション）。
 * 「無地の箱の積み重ね」にしないため、中身は部屋の種類ごとに決めた物を、見分けの付く部位つきで並べる:
 * - 'supply' = 医療材料の箱（白い箱に色の帯・品名の線・ふたの合わせ目。手袋の箱は上に取り出し口）
 * - 'ivbags' = 点滴の袋を入れた浅いかご、'linen' = たたんだシーツ・タオル、'binders' = カルテ・ファイル、
 *   'bottles' = 薬品・消毒液の瓶、'cardboard' = 段ボール、'devices' = 輸液ポンプ・シリンジポンプ、'mixed' = 器材庫の取り混ぜ
 * 棚は共通の小物のスチール棚（柱・筋かい・縁の立った棚板）を病棟の色で。
 */

export type WardLoad = 'supply' | 'bins' | 'ivbags' | 'linen' | 'binders' | 'bottles' | 'cardboard' | 'devices' | 'mixed' | 'paper';

/** 医療材料の箱の帯の色（病棟の色の表から） */
const BANDS = [WARD.teal, WARD.sea, WARD.red, WARD.orange, '#8fa6b0', WARD.olive];
const KRAFT = ['#c9b48e', '#bfa77f', '#d3c29c', '#b9a27c'];
const LINEN = [WARD.white, '#e6eedb', '#cfe0d6', WARD.cream];
const BINDERS = [WARD.teal, WARD.red, WARD.cream, WARD.olive, '#8fa6b0', WARD.pale];
const BOTTLES = [WARD.white, '#cfe0d6', '#e3c06a', '#c98f6a', WARD.mirror];

/** 医療材料の箱（白い箱・前と横を回る色の帯・品名の線・ふたの合わせ目）。glove = 上に手袋の取り出し口 */
export function supplyBox(p: Prop, w: number, h: number, d: number, band: string, o: { glove?: boolean; body?: string } = {}): void {
  const body = o.body ?? (p.r() < 0.7 ? WARD.white : '#f2f1e2');
  p.box(body, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], { r: 0.005 });
  const y0 = h * (0.55 + p.r() * 0.15);
  const bh = Math.min(h * 0.25, 0.05);
  p.box(band, [-w / 2 - 0.001, y0, -d / 2 - 0.001], [w / 2 + 0.001, y0 + bh, d / 2 + 0.001], { shadow: false });
  // 品名の線（前）・ふたの合わせ目（上）
  for (let k = 0; k < 2; k++) p.box(WARD.ink, [-w / 2 + 0.015, y0 - 0.02 - k * 0.016, d / 2], [-w / 2 + 0.015 + (w - 0.03) * (0.4 + p.r() * 0.4), y0 - 0.013 - k * 0.016, d / 2 + 0.002], { shadow: false });
  if (o.glove) {
    p.ball(shade(band, -0.6), [0, h, 0], [Math.min(w, 0.2) * 0.3, 0.004, d * 0.22], { seg: 12, shadow: false });
    p.ball(WARD.paper, [0, h + 0.002, 0], [Math.min(w, 0.2) * 0.12, 0.012, d * 0.1], { seg: 8, shadow: false });
  } else {
    p.box(shade(body, -0.35), [-w / 2 + 0.005, h, -0.0015], [w / 2 - 0.005, h + 0.002, 0.0015], { shadow: false });
  }
}

/** 点滴の袋を入れた浅いかご（樹脂のかご・袋の重なり・袋のラベルと口） */
export function ivBagTray(p: Prop, w: number, d: number, col: string = '#cfe0d6'): void {
  const h = 0.11;
  p.extrude(col, [[-w / 2 + 0.01, 0], [w / 2 - 0.01, 0], [w / 2, h], [-w / 2, h]], 'xy', -d / 2, d / 2, { bevel: 0.006 });
  p.box(shade(col, 0.3), [-w / 2 - 0.004, h - 0.015, -d / 2 - 0.004], [w / 2 + 0.004, h, d / 2 + 0.004], { r: 0.005 });
  p.box(WARD.paper, [-0.05, h * 0.3, d / 2], [0.05, h * 0.7, d / 2 + 0.003], { shadow: false });
  const n = 2 + Math.floor(p.r() * 3);
  for (let k = 0; k < n; k++) {
    const s = p.sub([(p.r() - 0.5) * (w - 0.18), h - 0.02 + k * 0.022, (p.r() - 0.5) * 0.04], (p.r() - 0.5) * 0.4);
    s.box('#e3efe8', [-0.07, 0, -0.11], [0.07, 0.022, 0.11], { r: 0.01, shadow: k === n - 1 ? true : 'receive' });
    s.box(WARD.paper, [-0.045, 0.021, -0.05], [0.045, 0.024, 0.05], { shadow: false });
    s.cyl(WARD.white, [0, 0.011, 0.125], 0.006, 0.03, { axis: 'z', seg: 6, shadow: false });
  }
}

/** 床に積んだ荷（段ボールと医療材料の箱。1〜3 段・ずれ・向きのばらつき） */
export function parcelPile(p: Prop, o: { n?: number } = {}): void {
  const n = o.n ?? 1 + Math.floor(p.r() * 3);
  let y = 0;
  for (let k = 0; k < n; k++) {
    const w = 0.5 - k * 0.07 - p.r() * 0.06;
    const h = 0.26 + p.r() * 0.14;
    const d = 0.38 - k * 0.04;
    const s = p.sub([(p.r() - 0.5) * 0.06, y, (p.r() - 0.5) * 0.05], (p.r() - 0.5) * 0.25);
    if (k % 2 === 1 && p.r() < 0.7) supplyBox(s, w, h, d, BANDS[Math.floor(p.r() * BANDS.length)]);
    else cardboardBox(s, w, h, d, KRAFT);
    y += h;
  }
  p.collide([-0.3, 0, -0.24], [0.3, y, 0.24]);
}

/** 棚板 1 段に並べる（局所: 棚板の上面の中心が原点。棚の正面が +z） */
export function fillWardLevel(p: Prop, w: number, d: number, clearH: number, load: WardLoad, empty = 0.15): void {
  if (load === 'linen') return fillShelf(p, w, d, clearH, 'linen', LINEN, empty);
  if (load === 'binders') return fillShelf(p, w, d, clearH, 'binders', BINDERS, empty);
  if (load === 'cardboard') return fillShelf(p, w, d, clearH, 'cardboard', KRAFT, empty);
  if (load === 'paper') return fillShelf(p, w, d, clearH, 'paper', [WARD.sea, WARD.red, WARD.olive], empty);
  let x = -w / 2;
  while (x < w / 2 - 0.08) {
    const left = w / 2 - x;
    let kind: WardLoad = load;
    if (load === 'mixed') kind = (['supply', 'supply', 'cardboard', 'bins', 'bottles', 'ivbags'] as const)[Math.floor(p.r() * 6)];
    let used: number;
    if (p.r() < empty) used = 0.08 + p.r() * 0.18;
    else if (kind === 'supply') {
      // 同じ箱を 2〜4 個並べる・重ねる（品物ごとに同じ大きさ）
      const glove = p.r() < 0.3;
      const bw = glove ? 0.24 : Math.min(left - 0.01, 0.14 + p.r() * 0.2);
      const bh = glove ? 0.07 : Math.min(clearH * 0.45, 0.08 + p.r() * 0.12);
      const bd = glove ? 0.125 : Math.min(d - 0.04, 0.18 + p.r() * 0.15);
      const band = BANDS[Math.floor(p.r() * BANDS.length)];
      const stack = Math.max(1, Math.min(Math.floor((clearH - 0.02) / bh), 1 + Math.floor(p.r() * 3)));
      const rows = glove ? 2 : 1;
      for (let j = 0; j < rows; j++)
        for (let k = 0; k < stack; k++) {
          const z = d / 2 - bd / 2 - 0.02 - j * (bd + 0.01);
          supplyBox(p.sub([x + bw / 2 + (p.r() - 0.5) * 0.01, k * bh, z], (p.r() - 0.5) * 0.05), bw, bh, bd, band, { glove: glove && k === stack - 1 });
        }
      used = bw + 0.015;
    } else if (kind === 'bins') {
      const bw = Math.min(left - 0.01, 0.3 + p.r() * 0.1);
      storageBin(p.sub([x + bw / 2, 0, 0]), bw, Math.min(clearH * 0.85, 0.2 + p.r() * 0.06), Math.min(d - 0.02, 0.38), [WARD.white, '#cfe0d6', WARD.cream][Math.floor(p.r() * 3)]);
      used = bw + 0.02;
    } else if (kind === 'ivbags') {
      const bw = Math.min(left - 0.01, 0.36);
      ivBagTray(p.sub([x + bw / 2, 0, 0]), bw, Math.min(d - 0.03, 0.34));
      used = bw + 0.02;
    } else if (kind === 'bottles') {
      const col = BOTTLES[Math.floor(p.r() * BOTTLES.length)];
      const r = p.r() < 0.5 ? 0.045 : 0.032;
      const n = 2 + Math.floor(p.r() * 4);
      let xx = x;
      for (let k = 0; k < n && xx < w / 2 - r * 2; k++) {
        for (let j = 0; j < 2; j++) bottle(p.sub([xx + r, 0, d / 2 - r - 0.03 - j * (r * 2 + 0.01)]), r, Math.min(clearH * 0.9, r > 0.04 ? 0.24 : 0.16), col);
        xx += r * 2 + 0.008;
      }
      used = xx - x + 0.03;
    } else if (kind === 'devices') {
      const big = p.r() < 0.4 && left > 0.32;
      if (left < 0.17) break;
      if (big) syringePump(p.sub([x + 0.15, 0, 0.0]));
      else infusionPump(p.sub([x + 0.08, 0, 0.0]));
      used = big ? 0.32 : 0.18;
    } else if (kind === 'cardboard') {
      const bw = Math.min(left - 0.01, 0.25 + p.r() * 0.25);
      const bh = Math.min(clearH * 0.9, 0.18 + p.r() * 0.2);
      const bd = Math.min(d - 0.02, 0.25 + p.r() * 0.12);
      cardboardBox(p.sub([x + bw / 2, 0, d / 2 - bd / 2 - 0.01], (p.r() - 0.5) * 0.06), bw, bh, bd, KRAFT);
      used = bw + 0.02;
    } else {
      used = 0.2;
    }
    x += used;
  }
}

export interface WardShelfOpts {
  w?: number;
  h?: number;
  d?: number;
  levels?: number;
  /** 段ごとの中身（下の段から。足りなければ繰り返す） */
  load?: WardLoad | WardLoad[];
  empty?: number;
}

/** 病棟のスチール棚（共通の小物の棚を病棟の色で）と、段ごとの中身 */
export function wardShelf(p: Prop, o: WardShelfOpts = {}): void {
  const W = o.w ?? 1.2;
  const H = o.h ?? 1.8;
  const D = o.d ?? 0.45;
  const n = o.levels ?? Math.max(3, Math.min(6, Math.round(H / 0.4) + 1));
  // 枠だけ（中身は病棟の決まりで並べる）
  steelShelf(p, { w: W, h: H, d: D, levels: n, frame: WARD.steel, empty: 1 });
  const loads = Array.isArray(o.load) ? o.load : [o.load ?? 'mixed'];
  for (let i = 0; i < n - 1; i++) {
    const y = 0.08 + (i * (H - 0.12)) / (n - 1);
    const clear = (H - 0.12) / (n - 1) - 0.05;
    fillWardLevel(p.sub([0, y, 0]), W - 0.06, D - 0.05, clear, loads[i % loads.length], o.empty ?? 0.15);
  }
}

/** 壁の棚の上の小物（手袋・マスクの箱、消毒液の瓶）。原点は棚板の上面の中心、幅 w、奥行き d */
export function wallShelfItems(p: Prop, w: number, d: number): void {
  let x = -w / 2 + 0.03;
  while (x < w / 2 - 0.15) {
    const t = p.r();
    if (t < 0.55) {
      const band = BANDS[Math.floor(p.r() * BANDS.length)];
      const n = 1 + Math.floor(p.r() * 2);
      for (let k = 0; k < n; k++) supplyBox(p.sub([x + 0.12, k * 0.07, 0.0], (p.r() - 0.5) * 0.06), 0.23, 0.07, Math.min(d, 0.125), band, { glove: k === n - 1 });
      x += 0.26;
    } else if (t < 0.8) {
      bottle(p.sub([x + 0.04, 0, 0]), 0.035, 0.2, BOTTLES[Math.floor(p.r() * BOTTLES.length)]);
      x += 0.09;
    } else {
      supplyBox(p.sub([x + 0.08, 0, 0]), 0.16, 0.1 + p.r() * 0.06, Math.min(d, 0.12), BANDS[Math.floor(p.r() * BANDS.length)]);
      x += 0.19;
    }
    x += 0.01 + p.r() * 0.05;
  }
}

/** ファイル立ての中のカルテ・ファイル（机の上・カウンターの上） */
export function binderRow(p: Prop, n: number, h = 0.3): void {
  let x = 0;
  for (let k = 0; k < n; k++) {
    const t = 0.035 + p.r() * 0.03;
    binder(p.sub([x + t / 2, 0, 0], 0, { roll: k === n - 1 && p.r() < 0.5 ? -0.2 : 0 }), t, h * (0.85 + p.r() * 0.15), 0.24, BINDERS[Math.floor(p.r() * BINDERS.length)]);
    x += t + 0.003;
  }
}

