import type { Prop } from '../../../props/kit.ts';
import { PAL } from '../mats.ts';
import { ledDot } from './equipment.ts';

/**
 * 電源・空調の設備（UPS 室・蓄電池室・電気室・空調機械室・サーバー室の南の端）。物の座標: 原点は床の上の正面の中心、+z が正面。
 */

const NB = { shadow: false as const };

/**
 * 盤の側板の作り込み（列の端の盤の側面が平らな板にならないように）: 前後 2 枚の側板（継ぎ目と縁）・上下の換気の切れ込みの帯・
 * 吊りのボルト・定格の銘板・高電圧の注意の札・接地の端子
 */
export function sidePanel(p: Prop, hw: number, d: number, h: number, col = '#2a5d6e'): void {
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.003);
    const xs = (a: number, b: number): [number, number] => [Math.min(x + s * a, x + s * b), Math.max(x + s * a, x + s * b)];
    // 前後 2 枚の側板の継ぎ目と縁
    p.box(col, [xs(0, 0.006)[0], 0.12, -d / 2 - 0.008], [xs(0, 0.006)[1], h - 0.04, -d / 2 + 0.008], NB);
    p.box(col, [xs(0, 0.004)[0], h - 0.06, -d + 0.02], [xs(0, 0.004)[1], h - 0.04, -0.02], NB);
    p.box(col, [xs(0, 0.004)[0], 0.12, -d + 0.02], [xs(0, 0.004)[1], 0.14, -0.02], NB);
    for (const [y0, y1] of [
      [0.25, 0.6],
      [h - 0.55, h - 0.2],
    ])
      for (const [z0, z1] of [
        [-d + 0.08, -d / 2 - 0.06],
        [-d / 2 + 0.06, -0.08],
      ]) {
        const n = Math.max(3, Math.floor((z1 - z0) / 0.05));
        for (let k = 0; k < n; k++) {
          const z = z0 + (k + 0.25) * ((z1 - z0) / n);
          p.box(col, [xs(0, 0.006)[0], y0, z], [xs(0, 0.006)[1], y1, z + 0.022], NB);
        }
      }
    for (const y of [0.15, h * 0.5, h - 0.12]) for (const z of [-d + 0.06, -d / 2 - 0.04, -d / 2 + 0.04, -0.06]) p.box('#8fb8c2', [xs(0, 0.008)[0], y - 0.012, z - 0.012], [xs(0, 0.008)[1], y + 0.012, z + 0.012], NB);
    // 銘板・注意の札・接地の端子
    p.box(PAL.paper, [xs(0, 0.007)[0], h * 0.66, -d * 0.3 - 0.1], [xs(0, 0.007)[1], h * 0.66 + 0.12, -d * 0.3 + 0.1], NB);
    p.box(PAL.yellow, [xs(0, 0.007)[0], h * 0.62, -d * 0.72 - 0.08], [xs(0, 0.007)[1], h * 0.62 + 0.15, -d * 0.72 + 0.08], NB);
    p.box('#1a2a30', [xs(0.007, 0.009)[0], h * 0.62 + 0.03, -d * 0.72 - 0.04], [xs(0.007, 0.009)[1], h * 0.62 + 0.1, -d * 0.72 + 0.04], NB);
    p.box('#3c9a6c', [xs(0, 0.02)[0], 0.3, -d * 0.5 - 0.03], [xs(0, 0.02)[1], 0.36, -d * 0.5 + 0.03], NB);
  }
}

/**
 * 盤の背の面（列の背が通路に向く所で平らな板にならないように）: 2 枚の背の扉の合わせ目と縁・上下の換気の羽根（横の羽根 3.5 cm おき）・
 * 定格の銘板・注意の札・取っ手・ボルト。背の面は z = -d
 */
export function rearPanel(p: Prop, hw: number, d: number, h: number, col = '#3f7d90', vent = '#24505e'): void {
  const z = -d - 0.004;
  // 扉の縁（框）と合わせ目
  p.box(col, [-hw + 0.02, 0.12, z - 0.004], [hw - 0.02, h - 0.03, z], NB);
  p.box(vent, [-0.004, 0.14, z - 0.007], [0.004, h - 0.05, z - 0.004], NB);
  // 換気の羽根（下と上の帯。扉ごと）
  for (const [y0, y1] of [
    [0.3, 0.72],
    [h - 0.62, h - 0.2],
  ])
    for (const s of [-1, 1]) {
      const xa = s < 0 ? -hw + 0.07 : 0.05;
      const xb = s < 0 ? -0.05 : hw - 0.07;
      p.box(vent, [xa, y0, z - 0.006], [xb, y1, z - 0.004], NB);
      for (let y = y0 + 0.02; y < y1 - 0.01; y += 0.035) p.box('#6aa2b2', [xa + 0.01, y, z - 0.012], [xb - 0.01, y + 0.012, z - 0.006], NB);
    }
  // 取っ手・銘板・注意の札・ボルト
  for (const x of [-0.07, 0.05]) p.box(PAL.steel, [x, h * 0.48, z - 0.03], [x + 0.02, h * 0.48 + 0.16, z - 0.004], { r: 0.005, shadow: false });
  p.box(PAL.paper, [-hw + 0.1, h * 0.62, z - 0.007], [-hw + 0.32, h * 0.62 + 0.12, z - 0.004], NB);
  p.box(PAL.yellow, [hw - 0.24, h * 0.62, z - 0.007], [hw - 0.1, h * 0.62 + 0.1, z - 0.004], NB);
  for (const x of [-hw + 0.05, hw - 0.05]) for (const y of [0.18, h - 0.08]) p.box('#8fb8c2', [x - 0.01, y - 0.01, z - 0.008], [x + 0.01, y + 0.01, z - 0.004], NB);
}

/** UPS の盤（幅 0.8・奥行き 0.9・高さ 2.0）: 上の操作画面・状態の LED・扉の換気の切れ込み・台座・銘板 */
export function upsCabinet(p: Prop, o: { w?: number; screen?: boolean } = {}): void {
  const w = o.w ?? 0.8;
  const hw = w / 2;
  const h = 2.0;
  const c = '#4f8ea0';
  p.collide([-hw, 0, -0.9], [hw, h, 0.03]);
  p.box(PAL.black, [-hw + 0.01, 0, -0.88], [hw - 0.01, 0.08, -0.02], NB);
  p.box(c, [-hw, 0.08, -0.9], [hw, h, -0.01], { r: 0.008 });
  sidePanel(p, hw, 0.9, h);
  rearPanel(p, hw, 0.9, h);
  // 扉の縁と合わせ目
  p.box('#3f7d90', [-hw + 0.02, 0.1, -0.01], [hw - 0.02, h - 0.02, 0.0], NB);
  // 吸い込みの羽根（扉の下と上の帯。横の羽根 2.5 cm おき・枠）。盤の前の羽根は通路に沿って見ても横の線が残る
  for (const [y0, y1] of [
    [0.18, 0.9],
    [1.5, 1.88],
  ]) {
    p.box('#2a5d6e', [-hw + 0.06, y0, 0], [hw - 0.06, y1, 0.004], NB);
    for (let y = y0 + 0.015; y < y1 - 0.012; y += 0.025) p.box('#6aa2b2', [-hw + 0.07, y, 0.004], [hw - 0.07, y + 0.01, 0.012], NB);
  }
  // 扉の合わせ目（2 枚扉）
  p.box('#2a5d6e', [-0.004, 0.12, 0.0], [0.004, h - 0.04, 0.006], NB);
  if (o.screen ?? true) {
    p.box('#173f4f', [-0.16, 1.18, 0], [0.16, 1.4, 0.012], { r: 0.004, shadow: false });
    p.box('#2f9db8', [-0.14, 1.2, 0.012], [0.14, 1.38, 0.015], { kind: 'glow', ...NB });
    ledDot(p, 0.22, 1.35, 0.0, PAL.ledGreen, 0.01);
    ledDot(p, 0.22, 1.3, 0.0, PAL.ledGreen, 0.01);
    ledDot(p, 0.22, 1.25, 0.0, PAL.ledAmber, 0.01);
  }
  // 取っ手と銘板
  p.box(PAL.steel, [hw - 0.07, 0.95, 0], [hw - 0.05, 1.15, 0.03], { r: 0.006, shadow: false });
  p.box(PAL.paper, [-hw + 0.06, 1.62, 0], [-hw + 0.26, 1.68, 0.004], NB);
}

/** 盤（受変電・分電盤。幅 0.9・高さ 2.2）: 計器の丸窓・表示灯・開閉器の取っ手・銘板 */
export function switchboard(p: Prop, o: { w?: number; meters?: number } = {}): void {
  const w = o.w ?? 0.9;
  const hw = w / 2;
  const h = 2.2;
  const c = '#5b97a6';
  p.collide([-hw, 0, -0.8], [hw, h, 0.05]);
  p.box(PAL.black, [-hw, 0, -0.78], [hw, 0.1, -0.02], NB);
  p.box(c, [-hw, 0.1, -0.8], [hw, h, -0.01], { r: 0.006 });
  sidePanel(p, hw, 0.8, h);
  rearPanel(p, hw, 0.8, h, '#4c8696');
  p.box('#4c8696', [-hw + 0.02, 0.12, -0.01], [hw - 0.02, h - 0.03, 0], NB);
  const n = o.meters ?? 3;
  for (let i = 0; i < n; i++) {
    const x = -hw + (w / (n + 1)) * (i + 1);
    p.cyl('#e4f2f2', [x, 1.75, 0.005], 0.06, 0.012, { axis: 'z', seg: 16, shadow: false });
    p.box(PAL.black, [x - 0.002, 1.74, 0.012], [x + 0.035, 1.76, 0.014], NB);
  }
  // 表示灯（赤・緑・橙）
  const lamps = [PAL.ledRed, PAL.ledGreen, PAL.ledAmber];
  lamps.forEach((col, i) => p.cyl(col, [-0.15 + i * 0.15, 1.52, 0.006], 0.02, 0.015, { axis: 'z', seg: 10, kind: 'glow', shadow: false }));
  // 遮断器の段（下から 3 段の小さな扉: 継ぎ目・取っ手・銘板・状態の窓）
  for (let t = 0; t < 3; t++) {
    const y0 = 0.16 + t * 0.42;
    p.box('#3c7686', [-hw + 0.04, y0 + 0.4, 0.0], [hw - 0.04, y0 + 0.415, 0.006], NB);
    p.box('#2c5f6e', [-0.3, y0 + 0.06, 0], [-0.06, y0 + 0.34, 0.01], NB);
    p.box('#1a3a46', [-0.2, y0 + 0.12, 0.01], [-0.16, y0 + 0.28, 0.05], { r: 0.005, shadow: false });
    p.box(PAL.paper, [0.04, y0 + 0.27, 0.0], [0.3, y0 + 0.33, 0.004], NB);
    p.box('#173f4f', [0.06, y0 + 0.1, 0.0], [0.22, y0 + 0.2, 0.006], NB);
    p.box(t === 1 ? '#e05a4a' : '#3fd29a', [0.09, y0 + 0.13, 0.006], [0.13, y0 + 0.17, 0.009], { kind: 'glow', ...NB });
    p.box(PAL.steel, [hw - 0.08, y0 + 0.15, 0.0], [hw - 0.06, y0 + 0.27, 0.025], NB);
  }
  p.box(PAL.paper, [-0.2, 1.95, 0], [0.2, 2.02, 0.004], NB);
  p.box(PAL.yellow, [hw - 0.2, 1.62, 0], [hw - 0.06, 1.72, 0.004], NB);
}

/** 蓄電池の架台（3 段・長さ len）: 鉄の枠・黒い電池の箱（赤と黒の端子・つなぐ板）・段の札 */
export function batteryRack(p: Prop, o: { len?: number; tiers?: number } = {}): void {
  const len = o.len ?? 2.4;
  const tiers = o.tiers ?? 3;
  const d = 0.55;
  const hl = len / 2;
  const frame = '#2f6474';
  p.collide([-hl - 0.03, 0, -d - 0.03], [hl + 0.03, tiers * 0.5 + 0.1, 0.03]);
  for (const x of [-hl, -hl / 3, hl / 3, hl])
    for (const z of [-d, 0]) p.box(frame, [x - 0.025, 0, z - 0.025], [x + 0.025, tiers * 0.5 + 0.1, z + 0.025], NB);
  for (let t = 0; t < tiers; t++) {
    const y = 0.12 + t * 0.5;
    p.box(frame, [-hl, y - 0.04, -d - 0.02], [hl, y, 0.02]);
    // 電池（幅 0.17・高さ 0.24・奥行き 0.5）
    for (let x = -hl + 0.12; x < hl - 0.1; x += 0.2) {
      p.box('#0c1e26', [x - 0.085, y, -d + 0.02], [x + 0.085, y + 0.25, -0.03], { r: 0.008 });
      p.box('#173542', [x - 0.085, y + 0.24, -d + 0.02], [x + 0.085, y + 0.26, -0.03], NB);
      p.cyl(PAL.red, [x - 0.04, y + 0.27, -0.12], 0.012, 0.025, { seg: 8, shadow: false });
      p.cyl(PAL.black, [x + 0.04, y + 0.27, -0.12], 0.012, 0.025, { seg: 8, shadow: false });
      p.box(PAL.steel, [x + 0.04, y + 0.28, -0.13], [x + 0.16, y + 0.285, -0.11], NB);
      p.box(PAL.paper, [x - 0.05, y + 0.12, -0.03], [x + 0.05, y + 0.17, -0.026], NB);
    }
  }
}

/** 空調機（CRAH。幅 1.8・奥行き 0.9・高さ 2.2）: 上の吸い込みの格子・扉 3 枚・表示の画面・下の吐き出しは床下へ */
export function crah(p: Prop, o: { w?: number; h?: number } = {}): void {
  const w = o.w ?? 1.8;
  const hw = w / 2;
  const h = o.h ?? 2.2;
  const c = '#6aa9b8';
  p.collide([-hw, 0, -0.9], [hw, h, 0.03]);
  p.box(c, [-hw, 0, -0.9], [hw, h, -0.01], { r: 0.01 });
  sidePanel(p, hw, 0.9, h, '#3f7a8b');
  rearPanel(p, hw, 0.9, h, '#5a98a8', '#3f7a8b');
  // 扉 3 枚の合わせ目
  for (let i = 1; i < 3; i++) p.box('#3f7a8b', [-hw + (w / 3) * i - 0.004, 0.05, -0.01], [-hw + (w / 3) * i + 0.004, h - 0.35, 0.002], NB);
  // 上の吸い込みの格子（横の羽根）
  p.box('#2b5f70', [-hw + 0.05, h - 0.32, -0.01], [hw - 0.05, h - 0.04, 0.0], NB);
  for (let y = h - 0.3; y < h - 0.05; y += 0.035) p.box('#7fbccb', [-hw + 0.06, y, 0.0], [hw - 0.06, y + 0.012, 0.012], NB);
  // 扉ごとの下の点検の格子（横の羽根）と、扉の縁
  for (let i = 0; i < 3; i++) {
    const xa = -hw + (w / 3) * i + 0.06;
    const xb = -hw + (w / 3) * (i + 1) - 0.06;
    p.box('#2b5f70', [xa, 0.12, -0.01], [xb, 0.75, 0.0], NB);
    for (let y = 0.14; y < 0.73; y += 0.03) p.box('#7fbccb', [xa + 0.01, y, 0.0], [xb - 0.01, y + 0.012, 0.01], NB);
    p.box('#4f8e9e', [xa, 0.8, -0.01], [xb, h - 0.4, 0.002], NB);
    // 扉の中の 2 枚の羽目板（凹んだ板の縁）と扉ごとの銘板
    for (const [y0, y1] of [
      [0.86, 1.25],
      [1.6, h - 0.46],
    ]) {
      p.box('#3f7a8b', [xa + 0.05, y0, 0.002], [xb - 0.05, y0 + 0.02, 0.006], NB);
      p.box('#3f7a8b', [xa + 0.05, y1 - 0.02, 0.002], [xb - 0.05, y1, 0.006], NB);
      p.box('#3f7a8b', [xa + 0.05, y0, 0.002], [xa + 0.07, y1, 0.006], NB);
      p.box('#3f7a8b', [xb - 0.07, y0, 0.002], [xb - 0.05, y1, 0.006], NB);
    }
    p.box(PAL.paper, [xa + 0.06, 1.3, 0.002], [xa + 0.2, 1.36, 0.005], NB);
  }
  // 表示の画面と取っ手
  p.box('#173f4f', [-0.15, 1.35, 0], [0.15, 1.55, 0.012], { r: 0.004, shadow: false });
  p.box('#36a8c2', [-0.13, 1.37, 0.012], [0.13, 1.53, 0.015], { kind: 'glow', ...NB });
  for (let i = 0; i < 3; i++) p.box(PAL.steelDark, [-hw + (w / 3) * (i + 1) - 0.09, 1.0, 0], [-hw + (w / 3) * (i + 1) - 0.07, 1.2, 0.03], { r: 0.005, shadow: false });
  p.box(PAL.paper, [-hw + 0.1, 1.7, 0], [-hw + 0.4, 1.78, 0.004], NB);
  // 冷水の配管（上へ）
  p.cyl('#9fc9d2', [hw - 0.25, h + 0.4, -0.45], 0.07, 0.8, { seg: 14 });
  p.cyl('#9fc9d2', [hw - 0.45, h + 0.4, -0.45], 0.07, 0.8, { seg: 14 });
}

/** 冷水の配管（断熱材の巻いた太い管・継ぎ目の帯・支持の金具）。a から b へ（水平） */
export function insulatedPipe(p: Prop, a: [number, number, number], b: [number, number, number], r = 0.12, color = '#a9cfd6'): void {
  p.rod(color, a, b, r, { radial: 14 });
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.floor(len / 1.0);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const c: [number, number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const dx = (b[0] - a[0]) / len;
    const dz = (b[2] - a[2]) / len;
    p.rod('#7fa9b3', [c[0] - dx * 0.02, c[1], c[2] - dz * 0.02], [c[0] + dx * 0.02, c[1], c[2] + dz * 0.02], r + 0.008, { radial: 14, shadow: false });
  }
}

/** 洗眼器（蓄電池室の壁ぎわ）: 立ち上がりの管・受け皿・押し板・緑の札 */
export function eyewash(p: Prop): void {
  p.cyl(PAL.yellow, [0, 0.5, 0], 0.025, 1.0, { seg: 10 });
  p.box(PAL.yellow, [-0.12, 0, -0.12], [0.12, 0.03, 0.12], { r: 0.01 });
  p.lathe(PAL.yellow, [[0, 0], [0.16, 0.0], [0.18, 0.06], [0.17, 0.07], [0.0, 0.03]], [0, 1.0, 0], { seg: 18 });
  p.box(PAL.yellow, [0.02, 0.9, 0.0], [0.04, 0.95, 0.25], NB);
  p.box(PAL.green, [-0.15, 1.6, -0.03], [0.15, 1.82, -0.02], NB);
  p.box(PAL.paper, [-0.08, 1.67, -0.02], [0.08, 1.75, -0.018], NB);
}
