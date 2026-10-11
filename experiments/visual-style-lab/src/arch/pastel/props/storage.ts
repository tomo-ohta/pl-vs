import type { Prop } from '../../../props/kit.ts';
import { binder, bottle, cardboardBox, steelShelf, towelStack } from '../../../props/lib/index.ts';
import { BOTTLES, K, KRAFT, SPINES } from './mats.ts';
import { bookRow, storeBox } from './office.ts';

/**
 * 倉庫（カルテ・物品）・受付の書類の棚・処置室と検査室の棚の中身。棚の骨組みは共通の小物のスチール棚（props/lib の steelShelf）で、
 * 中身はこの場所の物: カルテ（色の札の付いた紙ばさみを立てて並べる・仕切りの板）・文書の保存箱（ふた・手を掛ける穴・名札）・
 * 段ボール・ファイル・薬の瓶・試薬の瓶（すり合わせの栓）・物品の箱とガーゼの巻き・畳んだリネン・本。
 * 局所の座標: 足元の真ん中が原点・正面 +z。
 */

export type PastelLoad = 'charts' | 'archive' | 'cardboard' | 'binders' | 'bottles' | 'reagents' | 'supplies' | 'linen' | 'books';

const ROUND = { seg: 1 } as const;

/** カルテ（紙ばさみ）1 冊: 淡い紙の板と、背の色の札（1〜2 枚）。原点は底の真ん中・背が +z */
function chart(p: Prop, t: number, h: number, d: number): void {
  const body = p.r() < 0.6 ? K.cream : p.r() < 0.5 ? K.paper : '#e5ece0';
  p.box(body, [-t / 2, 0, -d / 2], [t / 2, h, d / 2]);
  const nt = p.r() < 0.55 ? 1 : 2;
  for (let k = 0; k < nt; k++) {
    const y = h * (0.45 + p.r() * 0.45);
    p.box(SPINES[Math.floor(p.r() * SPINES.length)], [-t / 2 - 0.0005, y, d / 2 - 0.004], [t / 2 + 0.0005, y + 0.028, d / 2 + 0.0015]);
  }
}

/** 文書の保存箱: 胴・かぶせぶたの縁・前の手を掛ける穴・名札の枠と字の線 */
function archiveBox(p: Prop, w: number, h: number, d: number): void {
  const col = [...KRAFT, K.paper][Math.floor(p.r() * 4)];
  p.box(col, [-w / 2, 0, -d / 2], [w / 2, h - 0.03, d / 2], { r: 0.003 });
  p.box(col, [-w / 2 - 0.004, h - 0.045, -d / 2 - 0.004], [w / 2 + 0.004, h, d / 2 + 0.004], { r: 0.004 });
  p.box(K.dark, [-0.035, h - 0.1, d / 2], [0.035, h - 0.075, d / 2 + 0.002], { r: 0.01 });
  p.box(K.white, [-w * 0.32, h * 0.2, d / 2], [w * 0.32, h * 0.55, d / 2 + 0.002]);
  for (let k = 0; k < 2; k++) p.box(K.sageD, [-w * 0.25, h * (0.43 - k * 0.12), d / 2 + 0.002], [-w * 0.25 + w * (0.2 + p.r() * 0.3), h * (0.43 - k * 0.12) + 0.008, d / 2 + 0.003]);
}

/** 試薬の瓶（広口・すり合わせの栓・ラベル）。原点は底 */
function reagent(p: Prop, r: number, h: number, col: string): void {
  p.lathe(col, [[0, 0], [r * 0.95, 0], [r, r * 0.25], [r, h * 0.66], [r * 0.82, h * 0.78], [r * 0.55, h * 0.84], [r * 0.55, h * 0.9], [0, h * 0.9]], [0, 0, 0], { seg: 14 });
  p.cyl(K.glassTint, [0, h * 0.92, 0], r * 0.5, h * 0.06, { seg: 10 });
  p.ball(K.glassTint, [0, h * 0.97, 0], [r * 0.45, h * 0.06, r * 0.45], { seg: 8 });
  p.lathe(K.white, [[r + 0.0015, h * 0.25], [r + 0.0015, h * 0.5]], [0, 0, 0], { seg: 8, phi: [-0.7, 1.4] });
}

/** 棚板 1 段に物を並べる（局所: 棚板の上面の中心が原点。w・d は使える幅と奥行き、clear は上の棚板までの高さ） */
export function fillLevel(p: Prop, w: number, d: number, clear: number, load: PastelLoad): void {
  if (load === 'books') {
    bookRow(p.sub([0, 0, 0]), w, d, clear);
    return;
  }
  let x = -w / 2;
  let run = 0;
  while (x < w / 2 - 0.05) {
    const left = w / 2 - x;
    const gap = p.r();
    if (load === 'charts') {
      // 立てたカルテの列。25 冊前後ごとに仕切りの板、ところどころ抜けた所と、そこへ倒れ掛かった冊
      if (gap < 0.025 && run > 6) {
        const g = 0.05 + p.r() * 0.08;
        const lean = 0.3;
        const h = Math.min(clear - 0.02, 0.31);
        chart(p.sub([x + h * Math.sin(lean) * 0.5 + 0.01, 0, d / 2 - 0.13], 0, { roll: -lean }), 0.012, h, 0.24);
        x += g + 0.06;
        run = 0;
        continue;
      }
      if (run > 0 && run % 24 === 0) {
        p.box(K.creamD, [x, 0, d / 2 - 0.25], [x + 0.003, Math.min(clear - 0.01, 0.34), d / 2 - 0.005]);
        p.box(K.creamD, [x - 0.001, Math.min(clear - 0.01, 0.34) - 0.05, d / 2 - 0.02], [x + 0.004, Math.min(clear - 0.01, 0.34) + 0.0, d / 2 + 0.008]);
        x += 0.005;
      }
      const t = 0.008 + p.r() * 0.016;
      const h = Math.min(clear - 0.015, 0.29 + p.r() * 0.025);
      const dd = Math.min(d - 0.01, 0.235);
      const out = p.r() < 0.06 ? 0.03 + p.r() * 0.05 : 0;
      chart(p.sub([x + t / 2, 0, d / 2 - dd / 2 - 0.008 + out]), t, h, dd);
      x += t + 0.0015;
      run++;
      continue;
    }
    if (gap < 0.12) {
      x += 0.06 + p.r() * 0.14;
      continue;
    }
    if (load === 'archive') {
      const bw = Math.min(left, 0.26 + p.r() * 0.06);
      const bh = Math.min(clear - 0.02, 0.25 + p.r() * 0.03);
      archiveBox(p.sub([x + bw / 2, 0, 0], (p.r() - 0.5) * 0.04), bw, bh, Math.min(d, 0.36));
      x += bw + 0.012;
    } else if (load === 'cardboard') {
      const bw = Math.min(left, 0.25 + p.r() * 0.28);
      const bh = Math.min(clear * 0.92, 0.18 + p.r() * 0.2);
      const bd = Math.min(d, 0.26 + p.r() * 0.14);
      cardboardBox(p.sub([x + bw / 2, 0, d / 2 - bd / 2 - p.r() * 0.03], (p.r() - 0.5) * 0.06), bw, bh, bd, KRAFT);
      if (p.r() < 0.35 && clear - bh > 0.14) cardboardBox(p.sub([x + bw / 2, bh, d / 2 - bd / 2], (p.r() - 0.5) * 0.2), bw * 0.8, Math.min(clear - bh - 0.02, 0.1 + p.r() * 0.08), bd * 0.85, KRAFT);
      x += bw + 0.02;
    } else if (load === 'binders') {
      const n = 4 + Math.floor(p.r() * 7);
      const bh = Math.min(clear - 0.02, 0.29 + p.r() * 0.03);
      let xx = x;
      for (let k = 0; k < n && xx < w / 2 - 0.05; k++) {
        const t = 0.04 + p.r() * 0.035;
        binder(p.sub([xx + t / 2, 0, d / 2 - 0.13], 0, { roll: k === n - 1 && p.r() < 0.4 ? -0.22 : 0 }), t, bh, 0.24, SPINES[Math.floor(p.r() * SPINES.length)]);
        xx += t + 0.003;
      }
      x = xx + 0.04;
    } else if (load === 'bottles' || load === 'reagents') {
      const n = 2 + Math.floor(p.r() * 4);
      const col = BOTTLES[Math.floor(p.r() * BOTTLES.length)];
      const big = p.r() < 0.4;
      const r = big ? 0.05 : 0.032;
      const hh = Math.min(clear - 0.03, big ? 0.24 : 0.15 + p.r() * 0.05);
      let xx = x;
      for (let k = 0; k < n && xx < w / 2 - r * 2; k++) {
        for (let j = 0; j < (big ? 1 : 2); j++) {
          const s = p.sub([xx + r, 0, d / 2 - r - 0.03 - j * (r * 2 + 0.012)]);
          if (load === 'reagents') reagent(s, r, hh, col);
          else bottle(s, r, hh, col);
        }
        xx += r * 2 + 0.01;
      }
      x = xx + 0.03;
    } else if (load === 'supplies') {
      const r = p.r();
      if (r < 0.55) {
        const bw = Math.min(left, 0.16 + p.r() * 0.16);
        const bh = Math.min(clear - 0.03, 0.09 + p.r() * 0.12);
        storeBox(p.sub([x + bw / 2, 0, d / 2 - 0.13], (p.r() - 0.5) * 0.06), bw, bh, Math.min(d - 0.02, 0.24), K.white);
        if (p.r() < 0.4 && clear - bh > 0.12) storeBox(p.sub([x + bw / 2, bh, d / 2 - 0.13], (p.r() - 0.5) * 0.2), bw * 0.9, 0.08, Math.min(d - 0.04, 0.2), K.white);
        x += bw + 0.015;
      } else if (r < 0.8) {
        // ガーゼの巻き（横に寝かせて積む）
        const n = 2 + Math.floor(p.r() * 3);
        for (let k = 0; k < n; k++) p.cyl(K.white, [x + 0.05 + (k % 2) * 0.1, 0.045 + Math.floor(k / 2) * 0.09, d / 2 - 0.12], 0.045, 0.1, { axis: 'z', seg: 12 });
        x += 0.22;
      } else {
        towelStack(p.sub([x + 0.17, 0, 0]), 0.32, Math.min(d, 0.32), Math.min(clear * 0.8, 0.14 + p.r() * 0.1), K.white);
        x += 0.36;
      }
    } else if (load === 'linen') {
      const bw = Math.min(left, 0.32 + p.r() * 0.06);
      towelStack(p.sub([x + bw / 2, 0, 0]), bw, Math.min(d, 0.34), Math.min(clear * 0.88, 0.14 + p.r() * 0.18), p.r() < 0.7 ? K.white : K.cloth);
      x += bw + 0.02;
    }
  }
}

/**
 * 金属の棚（スチール棚の骨組み）と段ごとの中身。loads は下の段から（足りなければ繰り返す）。top で天板の上にも物（文書の箱・段ボール）
 */
export function shelfUnit(p: Prop, w: number, h: number, d: number, loads: PastelLoad[], o: { frame?: string; top?: boolean } = {}): void {
  const n = Math.max(3, Math.round(h / 0.42));
  steelShelf(p, { w, h, d, levels: n, frame: o.frame ?? K.metal, empty: 1 });
  for (let i = 0; i < n - 1; i++) {
    const y = 0.08 + (i * (h - 0.12)) / (n - 1);
    const clear = (h - 0.12) / (n - 1) - 0.05;
    fillLevel(p.sub([0, y, 0]), w - 0.06, d - 0.05, clear, loads[i % loads.length]);
  }
  if (o.top) {
    let x = -w / 2 + 0.02;
    while (x < w / 2 - 0.3) {
      if (p.r() < 0.35) {
        x += 0.15;
        continue;
      }
      const bw = 0.26 + p.r() * 0.1;
      if (x + bw > w / 2) break;
      if (p.r() < 0.5) archiveBox(p.sub([x + bw / 2, h - 0.04, 0], (p.r() - 0.5) * 0.1), bw, 0.26, Math.min(d, 0.36));
      else cardboardBox(p.sub([x + bw / 2, h - 0.04, 0], (p.r() - 0.5) * 0.15), bw, 0.22 + p.r() * 0.1, Math.min(d, 0.36), KRAFT);
      x += bw + 0.03;
    }
  }
}

/** 床に積んだ段ボール（共通の小物の段ボールを、上ほど小さく少しずつずらして積む）。当たり判定は積んだ箱の外形 */
export function boxes(p: Prop, n = 3): void {
  let y = 0;
  let hw = 0;
  let hd = 0;
  for (let k = 0; k < n; k++) {
    const w = 0.44 + p.r() * 0.16 - k * 0.04;
    const h = 0.26 + p.r() * 0.14;
    const d = 0.34 + p.r() * 0.1 - k * 0.03;
    cardboardBox(p.sub([(p.r() - 0.5) * 0.05, y, (p.r() - 0.5) * 0.05], (p.r() - 0.5) * 0.2), w, h, d, KRAFT);
    hw = Math.max(hw, w / 2 + 0.04);
    hd = Math.max(hd, d / 2 + 0.04);
    y += h;
  }
  p.collide([-hw, 0, -hd], [hw, y, hd]);
}

/** 脚立（アルミ）: 前後の脚・前の踏み板 4 段・天板・開き止めの金具・脚のゴム */
export function ladder(p: Prop, h = 1.5): void {
  const m = K.metal;
  const zb = 0.27;
  for (const sx of [-1, 1]) {
    p.rod(m, [sx * 0.22, 0, zb], [sx * 0.17, h, 0.04], 0.015, { radial: 6 });
    p.rod(m, [sx * 0.22, 0, -zb], [sx * 0.17, h, -0.04], 0.015, { radial: 6 });
    for (const z of [zb, -zb]) p.box(K.ink, [sx * 0.22 - 0.02, 0, z - 0.02], [sx * 0.22 + 0.02, 0.025, z + 0.02], { r: 0.006 });
    const ys = h * 0.5;
    const t = ys / h;
    p.rod(K.steel, [sx * (0.22 - 0.05 * t), ys, zb - (zb - 0.04) * t], [sx * (0.22 - 0.05 * t), ys - 0.04, 0], 0.005, { radial: 4 });
    p.rod(K.steel, [sx * (0.22 - 0.05 * t), ys, -(zb - (zb - 0.04) * t)], [sx * (0.22 - 0.05 * t), ys - 0.04, 0], 0.005, { radial: 4 });
  }
  for (let i = 1; i < 5; i++) {
    const y = (h * i) / 5;
    const t = y / h;
    const xh = 0.22 - 0.05 * t - 0.005;
    const z = zb - (zb - 0.04) * t;
    p.box(K.steel, [-xh, y - 0.012, z - 0.07], [xh, y + 0.012, z + 0.02], { r: 0.004 });
  }
  p.box(K.sageD, [-0.2, h - 0.01, -0.08], [0.2, h + 0.035, 0.08], { r: 0.012, ...ROUND });
  p.collide([-0.24, 0, -zb - 0.02], [0.24, h + 0.035, zb + 0.02]);
}

/** ロープの柵（コーン 2 本と横の棒・下げた札）: 四角い台・回転体のコーン・帯・上の穴に差したバー */
export function cones(p: Prop, w = 1.0): void {
  for (const x of [-w / 2, w / 2]) {
    p.box(K.sageD, [x - 0.17, 0, -0.17], [x + 0.17, 0.035, 0.17], { r: 0.012, ...ROUND });
    p.lathe(K.cream, [[0, 0.035], [0.13, 0.035], [0.12, 0.08], [0.035, 0.66], [0.025, 0.7], [0, 0.7]], [x, 0, 0], { seg: 16 });
    p.cyl(K.sageD, [x, 0.42, 0], 0.078, 0.08, { radiusTop: 0.067, seg: 16, open: true });
    p.cyl(K.sageD, [x, 0.22, 0], 0.1, 0.06, { radiusTop: 0.093, seg: 16, open: true });
  }
  p.rod(K.creamD, [-w / 2, 0.66, 0], [w / 2, 0.66, 0], 0.018, { radial: 8 });
  for (const x of [-0.12, 0.12]) p.rod(K.ink, [x, 0.66, 0], [x, 0.58, 0], 0.002, { radial: 3 });
  p.box(K.paper, [-0.18, 0.4, -0.004], [0.18, 0.58, 0.004], { r: 0.003 });
  for (let k = 0; k < 2; k++) p.box(K.sageD, [-0.13, 0.52 - k * 0.06, 0.004], [0.13, 0.54 - k * 0.06, 0.006]);
  p.collide([-w / 2 - 0.17, 0, -0.17], [w / 2 + 0.17, 0.7, 0.17]);
}

