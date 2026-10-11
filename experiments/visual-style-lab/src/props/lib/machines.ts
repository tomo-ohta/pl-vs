import type { Prop, PropMats, V2 } from '../kit.ts';

/**
 * 自動販売機・券売機・給水機（日本の屋内外の物の寸法）。正面 +z、背 -z、床 y = 0。
 * 寸法の根拠: 飲料の自販機 幅 1.0 m・高さ 1.83 m・奥行き 0.72 m 前後。見本の窓は 3 段・1 段 8〜10 本、見本の下に押しボタン、
 * 窓の下に硬貨・紙幣の投入口と返却レバー、下に取り出し口（ふた付き）。給水機（冷水機）は幅 0.4 m・高さ 1.0 m 前後
 */

export interface VendingOpts {
  /** 本体の色 */
  body?: string;
  /** 前の飾りの色（広告の板・帯） */
  accent?: string;
  /** 見本の窓の背の明るさ（光る板の色） */
  lit?: string;
  /** 中身: 飲み物（缶とペットボトル）・お菓子（袋と箱） */
  goods?: 'drink' | 'snack';
  /** 見本の色（缶・ボトルの色の候補） */
  goodsColors?: string[];
  /** 押しボタンの色（冷たい・温かい） */
  cold?: string;
  hot?: string;
  /** 見本の窓の中（商品・棚・値札）を別の材質の作り方で（中の明かりで照らされる物を、本体と別の明るさに） */
  goodsMats?: PropMats;
}

const DRINK_COLORS = ['#c94a45', '#3a6fb0', '#e8e4d6', '#d9a43a', '#4f9a64', '#e07b39', '#2d3f55', '#b8d7e3', '#8a5a3b', '#f0d24a'];

/** 飲料の自動販売機 */
export function vendingMachine(p: Prop, o: VendingOpts = {}): void {
  const body = o.body ?? '#e9ece6';
  const accent = o.accent ?? '#3d78b8';
  const lit = o.lit ?? '#f4f7ee';
  const dark = '#22302f';
  const W = 1.0;
  const H = 1.83;
  const z0 = -0.36;
  const z1 = 0.33; // 筐体の前の面
  const zf = 0.36; // 扉の前の面
  const wx = W / 2 - 0.06;
  const wy0 = 0.98;
  const wy1 = 1.72;
  const back = z1 - 0.06;
  // 筐体: 見本の窓の高さだけ奥を空ける（窓の下・上は前まで詰める。窓の左右は前まで壁）
  p.box(body, [-W / 2, 0.06, z0], [W / 2, wy0, z1], { r: 0.02 });
  p.box(body, [-W / 2, wy1, z0], [W / 2, H, z1], { r: 0.02 });
  p.box(body, [-W / 2, wy0 - 0.01, z0], [W / 2, wy1 + 0.01, back - 0.01], { r: 0.02 });
  p.box(body, [-W / 2, wy0, back - 0.02], [-wx, wy1, z1]);
  p.box(body, [wx, wy0, back - 0.02], [W / 2, wy1, z1]);
  p.collide([-W / 2, 0, z0], [W / 2, H, zf]);
  // 台座・天板のひさし
  p.box(dark, [-W / 2 + 0.02, 0, z0 + 0.02], [W / 2 - 0.02, 0.07, z1 - 0.02], { r: 0.01 });
  p.box(body, [-W / 2 - 0.005, H - 0.05, z0 - 0.005], [W / 2 + 0.005, H + 0.01, zf + 0.01], { r: 0.012 });
  // 側面の広告の板（縦の帯）
  for (const s of [-1, 1]) {
    p.box(accent, [s * (W / 2) - 0.004, 0.25, -0.25], [s * (W / 2) + 0.004, 1.55, 0.2], { r: 0.003, shadow: 'receive' });
    p.box(body, [s * (W / 2) - 0.006, 1.3, -0.2], [s * (W / 2) + 0.006, 1.42, 0.15], { shadow: 'receive' });
  }
  // 扉（見本の窓の周りの枠を 4 本 + 窓の下の板）
  p.box(body, [-W / 2 + 0.01, wy1, z1], [W / 2 - 0.01, H - 0.05, zf], { r: 0.01 });
  p.box(body, [-W / 2 + 0.01, wy0, z1], [-wx, wy1, zf], { r: 0.008 });
  p.box(body, [wx, wy0, z1], [W / 2 - 0.01, wy1, zf], { r: 0.008 });
  p.box(body, [-W / 2 + 0.01, 0.07, z1], [W / 2 - 0.01, wy0, zf], { r: 0.012 });
  // 上の帯（銘柄の帯・光る）
  p.box(accent, [-wx, wy1 + 0.015, zf], [wx, H - 0.07, zf + 0.008], { r: 0.004 });
  p.box(lit, [-wx + 0.05, wy1 + 0.035, zf + 0.008], [wx - 0.05, H - 0.09, zf + 0.012], { kind: 'glow', shadow: false });
  // 見本の窓の中: 光る背の板・3 段の棚・見本・値札・押しボタン
  const g = o.goodsMats ? p.withMats(o.goodsMats) : p;
  g.box(lit, [-wx, wy0, back - 0.01], [wx, wy1, back], { kind: 'glow', shadow: false });
  const rows = 3;
  const per = o.goods === 'snack' ? 7 : 9;
  const cols = o.goodsColors ?? DRINK_COLORS;
  const rowH = (wy1 - wy0) / rows;
  for (let i = 0; i < rows; i++) {
    const y = wy0 + i * rowH;
    // 棚（手前の縁に値札の帯）
    g.box('#cfd6d2', [-wx, y, back], [wx, y + 0.012, z1 + 0.01], { shadow: 'receive' });
    g.box('#fbfdf8', [-wx, y + 0.012, z1 - 0.005], [wx, y + 0.032, z1 + 0.012], { kind: 'glow', shadow: false });
    const step = (2 * wx - 0.04) / per;
    for (let j = 0; j < per; j++) {
      const cx = -wx + 0.02 + step * (j + 0.5);
      const col = cols[Math.floor(p.r() * cols.length)];
      const cap = p.r() < 0.5 ? '#f2f2ec' : col;
      const s = g.sub([cx, y + 0.034, (back + z1) / 2]);
      if (o.goods === 'snack') {
        // 袋（ふくらんだ箱）と箱
        if (p.r() < 0.6) s.box(col, [-step * 0.38, 0, -0.04], [step * 0.38, rowH * 0.62, 0.03], { r: 0.018, shadow: false });
        else s.box(col, [-step * 0.34, 0, -0.03], [step * 0.34, rowH * 0.5, 0.02], { r: 0.004, shadow: false });
      } else if (p.r() < 0.45) {
        // 缶（350 ml: 直径 66 mm・高さ 122 mm）。見本は少し大きく見せる
        const r = 0.033;
        s.lathe(col, [[0, 0], [r * 0.85, 0], [r, 0.01], [r, 0.115], [r * 0.82, 0.13], [0, 0.13]], [0, 0, 0], { seg: 18, shadow: false });
        s.cyl('#c9cfcc', [0, 0.131, 0], r * 0.8, 0.004, { seg: 12, shadow: false });
      } else {
        // ペットボトル（500 ml: 直径 65 mm・高さ 205 mm）: 胴・ラベル・肩・首・ふた
        const r = 0.032;
        const prof: V2[] = [[0, 0], [r * 0.9, 0], [r, 0.012], [r, 0.12], [r * 0.95, 0.14], [r * 0.45, 0.185], [r * 0.4, 0.2], [0, 0.2]];
        s.lathe('#d8e6e6', prof, [0, 0, 0], { seg: 18, shadow: false });
        s.cyl(col, [0, 0.07, 0], r + 0.002, 0.07, { seg: 18, shadow: false });
        s.cyl(cap, [0, 0.207, 0], r * 0.42, 0.018, { seg: 10, shadow: false });
      }
      // 押しボタン（見本の下。冷たい = 青、温かい = 赤。下の段は温かいが多い）
      const hot = i === 0 && p.r() < 0.6;
      p.box(hot ? (o.hot ?? '#d9504a') : (o.cold ?? '#3d7fd0'), [cx - step * 0.28, y + 0.014, z1 + 0.012], [cx + step * 0.28, y + 0.028, z1 + 0.016], { kind: 'glow', shadow: false });
    }
  }
  // 窓のガラス（扉の前の面より少し奥）
  p.box('#dcebea', [-wx, wy0, zf - 0.012], [wx, wy1, zf - 0.006], { kind: 'glass', shadow: false });
  // 窓の下: 左に広告の板、右に投入口の板（硬貨・紙幣・返却レバー・表示・釣り銭の口）
  p.box(accent, [-wx, 0.62, zf], [0.02, 0.92, zf + 0.008], { r: 0.006 });
  p.box('#ffffff', [-wx + 0.04, 0.72, zf + 0.008], [-0.05, 0.84, zf + 0.011], { shadow: 'receive' });
  const coin = p.sub([0.26, 0, zf]);
  coin.box('#3a4646', [-0.18, 0.6, 0], [0.18, 0.94, 0.012], { r: 0.008 });
  coin.box('#9fb0aa', [-0.15, 0.86, 0.012], [-0.03, 0.91, 0.018], { r: 0.004 }); // 硬貨の口の台
  coin.box('#111a1a', [-0.13, 0.875, 0.018], [-0.05, 0.882, 0.02]);
  coin.box('#9fb0aa', [0.0, 0.78, 0.012], [0.15, 0.84, 0.02], { r: 0.004 }); // 紙幣の口
  coin.box('#111a1a', [0.02, 0.8, 0.02], [0.13, 0.812, 0.022]);
  coin.box('#3fb07a', [-0.15, 0.7, 0.012], [-0.03, 0.76, 0.016], { kind: 'glow', shadow: false }); // 表示
  coin.box('#c8d0cc', [0.04, 0.66, 0.012], [0.12, 0.74, 0.03], { r: 0.008 }); // 返却レバー
  coin.box('#111a1a', [-0.14, 0.62, 0.012], [-0.04, 0.66, 0.025], { r: 0.006 }); // 釣り銭の口
  // 取り出し口（暗い口・ふた・枠・札）
  p.box('#5f6c6a', [-0.4, 0.12, zf], [0.22, 0.44, zf + 0.012], { r: 0.012 });
  p.box('#0f1717', [-0.36, 0.16, zf + 0.004], [0.18, 0.4, zf + 0.014]);
  p.box('#76837f', [-0.355, 0.165, zf + 0.012], [0.175, 0.39, zf + 0.022], { r: 0.008 });
  p.box('#ffffff', [-0.3, 0.46, zf], [0.12, 0.5, zf + 0.008]);
  p.box(dark, [0.28, 0.14, zf], [0.42, 0.26, zf + 0.008], { r: 0.004 }); // 鍵穴の板
  p.cyl('#c8d0cc', [0.35, 0.2, zf + 0.012], 0.018, 0.012, { axis: 'z', seg: 10 });
}

/** 券売機（駅・プールの入口）: 台の上の斜めの画面・押しボタン・硬貨と紙幣の口・券の出口 */
export function ticketMachine(p: Prop, o: { body?: string; screen?: string; accent?: string } = {}): void {
  const body = o.body ?? '#d9e1dc';
  const scr = o.screen ?? '#9fd0c4';
  const accent = o.accent ?? '#2f6a8a';
  const W = 0.62;
  p.box(body, [-W / 2, 0, -0.32], [W / 2, 1.05, 0.28], { r: 0.03, collide: true });
  // 上の斜めの面（画面）と、後ろの背の高い部分
  p.extrude(body, [[-0.32, 1.05], [0.28, 1.05], [0.28, 1.12], [-0.12, 1.42], [-0.32, 1.42]], 'zy', -W / 2, W / 2, { bevel: 0.015 });
  // 画面（斜めの面に沿って）
  const s = p.sub([0, 1.08, 0.18], 0, { pitch: -0.9 });
  s.box('#1d2a2b', [-0.24, 0, -0.005], [0.24, 0.3, 0.01], { r: 0.01 });
  s.box(scr, [-0.21, 0.03, 0.01], [0.21, 0.27, 0.014], { kind: 'glow', shadow: false });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s.box('#e7f4ef', [-0.18 + j * 0.13, 0.06 + i * 0.05, 0.014], [-0.08 + j * 0.13, 0.095 + i * 0.05, 0.017], { kind: 'glow', shadow: false });
  // 上の案内（色の帯と光る札）
  p.box(accent, [-W / 2, 1.42, -0.32], [W / 2, 1.58, -0.1], { r: 0.012 });
  p.box('#f2f6f2', [-W / 2 + 0.04, 1.45, -0.1], [W / 2 - 0.04, 1.55, -0.094], { kind: 'glow', shadow: false });
  // 前の板: 硬貨・紙幣・カード・券の出口・釣り銭
  const f = p.sub([0, 0, 0.28]);
  f.box('#3a4646', [-0.26, 0.6, 0], [0.26, 0.98, 0.012], { r: 0.01 });
  f.box('#111a1a', [-0.2, 0.9, 0.012], [-0.08, 0.91, 0.018]);
  f.box('#111a1a', [0.0, 0.88, 0.012], [0.18, 0.895, 0.018]);
  f.box('#c8d0cc', [-0.21, 0.72, 0.012], [-0.07, 0.78, 0.03], { r: 0.006 });
  f.box('#111a1a', [0.02, 0.7, 0.012], [0.2, 0.75, 0.024], { r: 0.006 }); // 券の出口
  f.box('#5f6c6a', [-0.22, 0.12, 0], [0.22, 0.4, 0.012], { r: 0.012 }); // 釣り銭の受け
  f.box('#0f1717', [-0.18, 0.16, 0.008], [0.18, 0.34, 0.016]);
}

/** 冷水機（給水器）: 細い箱・上の受け皿と蛇口・押しボタン・足元の排水 */
export function waterCooler(p: Prop, o: { body?: string; top?: string; button?: string } = {}): void {
  const body = o.body ?? '#dfe5e2';
  const top = o.top ?? '#b9c6c2';
  p.box(body, [-0.2, 0.05, -0.2], [0.2, 0.9, 0.2], { r: 0.03, collide: true });
  p.box('#3a4646', [-0.19, 0, -0.19], [0.19, 0.06, 0.19], { r: 0.01 });
  // 上の受け皿（くぼみ）と蛇口
  p.extrude(top, [[-0.21, 0.9], [0.21, 0.9], [0.21, 1.0], [0.17, 1.0], [0.17, 0.94], [-0.17, 0.94], [-0.17, 1.0], [-0.21, 1.0]], 'xy', -0.21, 0.21, { bevel: 0.008 });
  p.box('#7f8f8b', [-0.17, 0.94, -0.17], [0.17, 0.945, 0.17]);
  p.cyl('#c8d0cc', [0.0, 0.97, -0.08], 0.018, 0.06, { seg: 10 });
  p.box('#c8d0cc', [-0.015, 0.99, -0.08], [0.015, 1.01, -0.02], { r: 0.006 });
  // 前の押しボタンと吸気の格子
  p.box(o.button ?? '#3d7fd0', [-0.05, 0.84, 0.2], [0.05, 0.88, 0.215], { r: 0.008 });
  for (let i = 0; i < 6; i++) p.box('#9aa8a4', [-0.14, 0.15 + i * 0.04, 0.2], [0.14, 0.165 + i * 0.04, 0.206]);
}
