import type { Prop, V2 } from '../kit.ts';
import { shade } from '../kit.ts';

/**
 * 棚と、棚に載る物（倉庫・器材庫・事務室・リネン庫・用具庫）。正面 +z、背 -z、床 y = 0。
 * 「箱を積んだだけ」に見えないように、載る物ごとに見分けの付く部位を付ける:
 * 段ボール = ふたの合わせ目・テープ・ラベル、収納箱 = ふたの縁・取っ手のくぼみ、ファイル = 背のラベル・指穴、
 * 畳んだタオル = 丸い縁と重ねのずれ、瓶 = 肩・首・ふた・ラベル、ビート板 = 丸い角の板の重ね、紙の束 = 包みの帯
 */

export type ShelfLoad = 'cardboard' | 'bins' | 'binders' | 'linen' | 'bottles' | 'kickboards' | 'paper' | 'mixed';

export interface ShelfOpts {
  w?: number;
  h?: number;
  d?: number;
  /** 棚板の数（床の板を含む） */
  levels?: number;
  frame?: string;
  /** 載せる物（段ごとに変えるなら配列） */
  load?: ShelfLoad | ShelfLoad[];
  /** 載せる物の色の候補 */
  colors?: string[];
  /** 空いた所の割合（0〜1） */
  empty?: number;
  /** 段ごとに中身を自分で詰める（局所: 棚板の上面の中心が原点。w・d は使える幅と奥行き、clearH は上の棚板までの高さ）。渡すと load は使わない */
  fill?: (level: Prop, i: number, w: number, d: number, clearH: number) => void;
}

const KRAFT = ['#c9ad83', '#bfa178', '#d3bb93', '#b89a72'];

/** スチール棚（角の柱・前の縁の立った棚板・背と横の筋かい・足の板）と中身 */
export function steelShelf(p: Prop, o: ShelfOpts = {}): void {
  const W = o.w ?? 1.2;
  const H = o.h ?? 1.8;
  const D = o.d ?? 0.45;
  const n = o.levels ?? 5;
  const fr = o.frame ?? '#b9c4c0';
  const dark = shade(fr, -0.9);
  // 柱（L 字の山形鋼を 2 枚の板で）と穴の列
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.015);
    const z = sz * (D / 2 - 0.015) - 0.0;
    p.box(fr, [x - 0.016, 0, z - 0.016], [x + 0.016, H, z + 0.016], { r: 0.003 });
    p.box(dark, [x - 0.017 * sx * -1 - 0.002, 0.05, z - 0.004], [x - 0.017 * sx * -1 + 0.002, H - 0.05, z + 0.004], { shadow: false });
  }
  for (const sx of [-1, 1]) p.box(dark, [sx * (W / 2 - 0.015) - 0.025, 0, -D / 2 - 0.01], [sx * (W / 2 - 0.015) + 0.025, 0.008, D / 2 + 0.01], { shadow: 'receive' });
  // 横と背の筋かい（細い棒の X）
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.015);
    p.rod(fr, [x, 0.12, -D / 2 + 0.02], [x, H * 0.5, D / 2 - 0.02], 0.004, { radial: 4 });
    p.rod(fr, [x, 0.12, D / 2 - 0.02], [x, H * 0.5, -D / 2 + 0.02], 0.004, { radial: 4 });
  }
  p.rod(fr, [-W / 2 + 0.02, 0.15, -D / 2 + 0.01], [W / 2 - 0.02, H - 0.1, -D / 2 + 0.01], 0.004, { radial: 4 });
  p.rod(fr, [W / 2 - 0.02, 0.15, -D / 2 + 0.01], [-W / 2 + 0.02, H - 0.1, -D / 2 + 0.01], 0.004, { radial: 4 });
  // 棚板（前と後ろの縁を折り返した板）と中身
  const loads = Array.isArray(o.load) ? o.load : null;
  for (let i = 0; i < n; i++) {
    const y = 0.08 + (i * (H - 0.12)) / (n - 1);
    p.box(fr, [-W / 2 + 0.005, y - 0.012, -D / 2 + 0.005], [W / 2 - 0.005, y, D / 2 - 0.005], { r: 0.002 });
    p.box(fr, [-W / 2 + 0.005, y - 0.04, D / 2 - 0.02], [W / 2 - 0.005, y, D / 2 - 0.005], { r: 0.003 });
    p.box(fr, [-W / 2 + 0.005, y - 0.04, -D / 2 + 0.005], [W / 2 - 0.005, y, -D / 2 + 0.02], { r: 0.003 });
    if (i === n - 1) break;
    const clear = (H - 0.12) / (n - 1) - 0.05;
    if (o.fill) {
      o.fill(p.sub([0, y, 0]), i, W - 0.06, D - 0.05, clear);
      continue;
    }
    const load = loads ? loads[i % loads.length] : (o.load as ShelfLoad | undefined) ?? 'mixed';
    fillShelf(p.sub([0, y, 0]), W - 0.06, D - 0.05, clear, load, o.colors, o.empty ?? 0.15);
  }
  p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/** 棚板 1 段に物を並べる（局所: 棚板の上面の中心が原点） */
export function fillShelf(p: Prop, w: number, d: number, clearH: number, load: ShelfLoad, colors?: string[], empty = 0.15): void {
  let x = -w / 2;
  while (x < w / 2 - 0.06) {
    const kind = load === 'mixed' ? (['cardboard', 'bins', 'binders', 'bottles', 'paper'] as const)[Math.floor(p.r() * 5)] : load;
    const left = w / 2 - x;
    let used = 0;
    if (p.r() < empty) {
      used = 0.08 + p.r() * 0.18;
    } else if (kind === 'cardboard') {
      const bw = Math.min(left, 0.25 + p.r() * 0.3);
      const bh = Math.min(clearH * 0.95, 0.18 + p.r() * 0.22);
      const bd = Math.min(d, 0.25 + p.r() * 0.15);
      const z = d / 2 - bd / 2 - p.r() * 0.04;
      cardboardBox(p.sub([x + bw / 2, 0, z], (p.r() - 0.5) * 0.06), bw, bh, bd, colors);
      // ときどき上にもう 1 つ（小さめ）
      if (p.r() < 0.35 && clearH - bh > 0.14) cardboardBox(p.sub([x + bw / 2 + (p.r() - 0.5) * 0.05, bh, z], (p.r() - 0.5) * 0.2), bw * 0.8, Math.min(clearH - bh - 0.02, 0.12 + p.r() * 0.08), bd * 0.85, colors);
      used = bw + 0.02;
    } else if (kind === 'bins') {
      const bw = Math.min(left, 0.32 + p.r() * 0.12);
      const bh = Math.min(clearH * 0.9, 0.2 + p.r() * 0.08);
      const col = colors ? colors[Math.floor(p.r() * colors.length)] : (['#dfe7e3', '#9fc0c7', '#e6d9b8'] as const)[Math.floor(p.r() * 3)];
      storageBin(p.sub([x + bw / 2, 0, 0]), bw, bh, Math.min(d, 0.4), col);
      used = bw + 0.025;
    } else if (kind === 'binders') {
      const n = 3 + Math.floor(p.r() * 6);
      const bh = Math.min(clearH * 0.95, 0.29 + p.r() * 0.03);
      let xx = x;
      for (let k = 0; k < n && xx < w / 2 - 0.05; k++) {
        const t = 0.04 + p.r() * 0.035;
        const col = colors ? colors[Math.floor(p.r() * colors.length)] : (['#3f6f8e', '#d4dad6', '#4f7d63', '#9a4a45', '#2f4a4c'] as const)[Math.floor(p.r() * 5)];
        binder(p.sub([xx + t / 2, 0, d / 2 - 0.13], 0, { roll: k === n - 1 && p.r() < 0.4 ? -0.25 : 0 }), t, bh, 0.24, col);
        xx += t + 0.003;
      }
      used = xx - x + 0.04;
    } else if (kind === 'linen') {
      const bw = Math.min(left, 0.32 + p.r() * 0.08);
      const col = colors ? colors[Math.floor(p.r() * colors.length)] : '#eef1ea';
      towelStack(p.sub([x + bw / 2, 0, 0]), bw, Math.min(d, 0.34), Math.min(clearH * 0.9, 0.12 + p.r() * 0.2), col);
      used = bw + 0.02;
    } else if (kind === 'bottles') {
      const n = 2 + Math.floor(p.r() * 4);
      const col = colors ? colors[Math.floor(p.r() * colors.length)] : (['#e9eee9', '#8fb7c8', '#e3c06a', '#c98f6a'] as const)[Math.floor(p.r() * 4)];
      const big = p.r() < 0.5;
      const r = big ? 0.06 : 0.04;
      let xx = x;
      for (let k = 0; k < n && xx < w / 2 - r * 2; k++) {
        for (let j = 0; j < (big ? 1 : 2); j++) bottle(p.sub([xx + r, 0, d / 2 - r - 0.03 - j * (r * 2 + 0.01)]), r, Math.min(clearH * 0.9, big ? 0.28 : 0.2), col);
        xx += r * 2 + 0.008;
      }
      used = xx - x + 0.03;
    } else if (kind === 'kickboards') {
      const bw = Math.min(left, 0.32);
      const n = Math.max(2, Math.floor(Math.min(clearH * 0.9, 0.3) / 0.03));
      const col = colors ? colors[Math.floor(p.r() * colors.length)] : '#e3c06a';
      for (let k = 0; k < n; k++) {
        const c = colors ? colors[(k + Math.floor(p.r() * 3)) % colors.length] : k % 3 === 0 ? '#7fb1a8' : col;
        p.sub([x + bw / 2 + (p.r() - 0.5) * 0.02, k * 0.028, (p.r() - 0.5) * 0.02], (p.r() - 0.5) * 0.06).box(c, [-bw / 2, 0, -0.2], [bw / 2, 0.026, 0.2], { r: 0.012, shadow: k === n - 1 ? true : 'receive' });
      }
      used = bw + 0.03;
    } else {
      // 紙の束（包みの帯つき）
      const bw = Math.min(left, 0.3);
      const n = 1 + Math.floor(p.r() * 4);
      for (let k = 0; k < n; k++) {
        const s = p.sub([x + bw / 2, k * 0.052, 0], (p.r() - 0.5) * 0.1);
        s.box('#f2f3ee', [-0.15, 0, -0.105], [0.15, 0.05, 0.105], { r: 0.004 });
        s.box(colors ? colors[k % colors.length] : '#8fb0c8', [-0.155, 0.012, -0.06], [0.155, 0.04, 0.06], { r: 0.002, shadow: false });
      }
      used = bw + 0.03;
    }
    x += used;
  }
}

/** 段ボール箱（局所: 底の中心が原点）: ふたの合わせ目・テープ・ラベル・角の少しのつぶれ */
export function cardboardBox(p: Prop, w: number, h: number, d: number, colors?: string[]): void {
  const col = (colors ?? KRAFT)[Math.floor(p.r() * (colors ?? KRAFT).length)];
  const tape = p.r() < 0.6 ? shade(col, 0.55) : '#d9d4c4';
  p.box(col, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], { r: 0.006 });
  // ふたの合わせ目（上の真ん中の溝）とテープ（上から前・後ろへ回る）
  p.box(shade(col, -0.7), [-w / 2 + 0.01, h - 0.001, -0.002], [w / 2 - 0.01, h + 0.001, 0.002], { shadow: false });
  p.box(tape, [-0.03, h, -d / 2 - 0.001], [0.03, h + 0.002, d / 2 + 0.001], { shadow: false });
  p.box(tape, [-0.03, h - 0.06, d / 2], [0.03, h, d / 2 + 0.002], { shadow: false });
  // ラベル（白い紙と、その上の字の線）・前の面の折り目の線
  if (p.r() < 0.75) {
    const lx = (p.r() - 0.5) * (w - 0.14);
    const ly = h * (0.3 + p.r() * 0.3);
    p.box('#f4f4ee', [lx - 0.05, ly - 0.03, d / 2], [lx + 0.05, ly + 0.03, d / 2 + 0.002], { shadow: false });
    for (let k = 0; k < 3; k++) p.box('#4a5656', [lx - 0.04, ly + 0.012 - k * 0.012, d / 2 + 0.002], [lx - 0.04 + 0.03 + p.r() * 0.04, ly + 0.016 - k * 0.012, d / 2 + 0.003], { shadow: false });
  }
  if (p.r() < 0.5) p.box(shade(col, -0.5), [-w / 2 + 0.02, h * 0.62, d / 2], [w / 2 - 0.02, h * 0.62 + 0.004, d / 2 + 0.002], { shadow: false });
}

/** ふた付きの収納箱（半透明でない樹脂。ふたの縁・前の取っ手のくぼみ・横の取っ手） */
export function storageBin(p: Prop, w: number, h: number, d: number, col: string): void {
  // 底がすぼまる胴（押し出しで台形）
  p.extrude(col, [[-w / 2 + 0.015, 0], [w / 2 - 0.015, 0], [w / 2, h - 0.03], [-w / 2, h - 0.03]], 'xy', -d / 2, d / 2, { bevel: 0.008 });
  p.box(shade(col, 0.4), [-w / 2 - 0.008, h - 0.035, -d / 2 - 0.008], [w / 2 + 0.008, h, d / 2 + 0.008], { r: 0.008 });
  p.box(shade(col, -0.6), [-0.06, h - 0.1, d / 2 - 0.002], [0.06, h - 0.07, d / 2 + 0.004], { r: 0.008, shadow: false });
  p.box('#f4f4ee', [-0.07, h * 0.35, d / 2], [0.07, h * 0.35 + 0.05, d / 2 + 0.006], { shadow: false });
}

/** ファイル（バインダー）: 表紙・背・背のラベル・指穴 */
export function binder(p: Prop, t: number, h: number, d: number, col: string): void {
  p.box(col, [-t / 2, 0, -d / 2], [t / 2, h, d / 2], { r: 0.004 });
  p.box('#f4f4ee', [-t / 2 + 0.006, h * 0.55, d / 2], [t / 2 - 0.006, h * 0.8, d / 2 + 0.002], { shadow: false });
  p.cyl(shade(col, -0.8), [0, h * 0.25, d / 2 + 0.001], Math.min(t * 0.25, 0.012), 0.003, { axis: 'z', seg: 10, shadow: false });
}

/** 畳んだタオル・シーツの重ね（丸い縁・少しずつずれる・折り目の線） */
export function towelStack(p: Prop, w: number, d: number, h: number, col: string): void {
  const n = Math.max(1, Math.round(h / 0.045));
  for (let k = 0; k < n; k++) {
    const s = p.sub([(p.r() - 0.5) * 0.02, k * 0.045, (p.r() - 0.5) * 0.02], (p.r() - 0.5) * 0.05);
    const c = k % 4 === 3 ? shade(col, -0.25) : col;
    s.box(c, [-w / 2, 0, -d / 2], [w / 2, 0.044, d / 2], { r: 0.018, shadow: k === n - 1 ? true : 'receive' });
    s.box(shade(c, -0.35), [-w / 2 + 0.02, 0.02, d / 2 + 0.004], [w / 2 - 0.02, 0.024, d / 2 + 0.006], { shadow: false });
  }
}

/** 瓶・ボトル（洗剤・薬品・飲み物）: 胴・肩・首・ふた・ラベル */
export function bottle(p: Prop, r: number, h: number, col: string): void {
  const prof: V2[] = [[0, 0], [r * 0.92, 0], [r, r * 0.2], [r, h * 0.62], [r * 0.85, h * 0.74], [r * 0.38, h * 0.86], [r * 0.36, h * 0.92], [0, h * 0.92]];
  p.lathe(col, prof, [0, 0, 0], { seg: 14 });
  p.cyl(p.r() < 0.5 ? '#f2f3ee' : shade(col, -0.6), [0, h * 0.95, 0], r * 0.42, h * 0.08, { seg: 12 });
  p.cyl('#f4f4ee', [0, h * 0.38, 0], r + 0.002, h * 0.3, { seg: 14, open: true, shadow: false });
}

/** 床に積んだ段ボール（倉庫の隅）。n 段・ずれ・向きのばらつき */
export function boxPile(p: Prop, o: { n?: number; colors?: string[] } = {}): void {
  const n = o.n ?? 3;
  let y = 0;
  // 当たり判定は積んだ箱の実際の大きさ（いちばん下の箱。回した分の余裕を少し）
  let hw = 0;
  let hd = 0;
  for (let k = 0; k < n; k++) {
    const w = 0.45 + p.r() * 0.2 - k * 0.04;
    const h = 0.28 + p.r() * 0.15;
    const d = 0.35 + p.r() * 0.15 - k * 0.03;
    const ox = (p.r() - 0.5) * 0.06;
    const oz = (p.r() - 0.5) * 0.06;
    cardboardBox(p.sub([ox, y, oz], (p.r() - 0.5) * 0.25), w, h, d, o.colors);
    if (k === 0) {
      hw = w / 2 + Math.abs(ox) + 0.04;
      hd = d / 2 + Math.abs(oz) + 0.04;
    }
    y += h;
  }
  p.collide([-hw, 0, -hd], [hw, y, hd]);
}
