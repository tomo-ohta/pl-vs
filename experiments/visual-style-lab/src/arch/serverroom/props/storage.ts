import type { Prop } from '../../../props/kit.ts';
import { PAL } from '../mats.ts';
import { ledDot } from './equipment.ts';
import { pallet, serverBox } from './facility.ts';
import { rearPanel } from './power.ts';

/**
 * 物の置き場・付帯の部屋の小物（荷捌き場のパレットラック・カゴ台車・ロッカー・蓄電池の盤・ポンプ）。
 * 物の座標: 原点は床の上の正面の中心、+z が正面。
 */

const NB = { shadow: false as const };

/** パレットラック（重量棚。幅 2.7・奥行き 1.1・3 段）: 柱（穴の列）・梁・筋かい・パレットと箱 */
export function palletRack(p: Prop, o: { w?: number; levels?: number; h?: number } = {}): void {
  const w = o.w ?? 2.7;
  const levels = o.levels ?? 3;
  const h = o.h ?? 3.2;
  const d = 1.1;
  const hw = w / 2;
  const up = '#2f6f86';
  // 梁は柱より明るい鋼の色（荷重の札は黄色）
  const beam = '#5a9db0';
  p.collide([-hw - 0.05, 0, -d - 0.05], [hw + 0.05, h, 0.05]);
  for (const x of [-hw, hw])
    for (const z of [-d, 0]) {
      p.box(up, [x - 0.04, 0, z - 0.04], [x + 0.04, h, z + 0.04]);
      for (let y = 0.2; y < h; y += 0.1) p.box('#1d4f60', [x - 0.012, y, z + 0.04], [x + 0.012, y + 0.04, z + 0.042], NB);
    }
  for (const x of [-hw, hw]) {
    for (let y = 0.3; y < h - 0.2; y += 0.6) p.rod(up, [x, y, -d], [x, y + 0.55, 0], 0.012, { radial: 5, shadow: false });
    p.box(PAL.steelDark, [x - 0.08, 0, -d - 0.08], [x + 0.08, 0.01, 0.08], NB);
  }
  for (let l = 0; l < levels; l++) {
    const y = 0.15 + l * (h / levels);
    for (const z of [-d, 0]) p.box(beam, [-hw, y - 0.12, z - 0.03], [hw, y, z + 0.03]);
    p.box(PAL.yellow, [-0.12, y - 0.1, 0.03], [0.12, y - 0.02, 0.034], NB);
    // 2 枚のパレットと箱（段ごとに中身を変える）
    for (const px of [-hw / 2, hw / 2]) {
      if (p.r() < 0.15) continue;
      const q = p.sub([px, y, -d / 2]);
      pallet(q);
      const n = 1 + Math.floor(p.r() * 3);
      if (p.r() < 0.65) {
        // ラップで巻いた荷（箱の上に巻いたフィルムの帯・角の当て板・帯の紐）
        wrapLoad(q, n);
      } else {
        for (let k = 0; k < n; k++) serverBox(q.sub([(p.r() - 0.5) * 0.1, 0.14 + k * 0.29, 0], (p.r() - 0.5) * 0.1), { w: 0.62, l: 1.0, h: 0.28 });
      }
    }
  }
}

/**
 * パレットの上のラップで巻いた荷（n 段の箱）。物の座標: 原点はパレットの上の中心（パレットの天板 y = 0.14）。
 * - 箱（2 列 × n 段。段ごとに向きを変えて積む）
 * - フィルム: 0.5 m 幅の帯を 0.1 m ずつ重ねて下から巻き上げる（重なった所は 2 枚分の濃さ = 横の帯が見える）。上は 1 枚のかぶせ
 * - 角の当て板（段ボールの L 字）・PP の帯の紐 2 本（上をまたいで下へ）・出荷の札
 */
export function wrapLoad(q: Prop, n: number): void {
  const y0 = 0.14;
  const h = n * 0.29;
  for (let k = 0; k < n; k++)
    for (const x of [-0.27, 0.27]) {
      const turn = k % 2 === 1;
      serverBox(q.sub([x, y0 + k * 0.29, turn ? 0.01 : -0.01]), { w: 0.52, l: 1.04, h: 0.28 });
    }
  const hw = 0.545;
  const hl = 0.535;
  // 角の当て板（段ボールの L 字。x の面と z の面に 5 cm ずつ）
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const xo = sx * (hw + 0.006);
      const zo = sz * (hl + 0.006);
      q.box('#b4a07c', [Math.min(sx * hw, xo), y0, Math.min(zo, zo - sz * 0.06)], [Math.max(sx * hw, xo), y0 + h, Math.max(zo, zo - sz * 0.06)], NB);
      q.box('#b4a07c', [Math.min(xo, xo - sx * 0.06), y0, Math.min(sz * hl, zo)], [Math.max(xo, xo - sx * 0.06), y0 + h, Math.max(sz * hl, zo)], NB);
    }
  // フィルムの帯（4 面の薄い板。帯ごとに少し外へ出す）
  const band = 0.5;
  const step = 0.4;
  let i = 0;
  for (let y = y0; y < y0 + h - 0.05; y += step, i++) {
    const t = Math.min(y + band, y0 + h);
    const o = 0.012 + (i % 2) * 0.004;
    q.box('#dceff2', [-hw - o, y, hl + o - 0.002], [hw + o, t, hl + o], { kind: 'glass', ...NB });
    q.box('#dceff2', [-hw - o, y, -hl - o], [hw + o, t, -hl - o + 0.002], { kind: 'glass', ...NB });
    q.box('#dceff2', [hw + o - 0.002, y, -hl - o], [hw + o, t, hl + o], { kind: 'glass', ...NB });
    q.box('#dceff2', [-hw - o, y, -hl - o], [-hw - o + 0.002, t, hl + o], { kind: 'glass', ...NB });
  }
  q.box('#dceff2', [-hw - 0.02, y0 + h + 0.004, -hl - 0.02], [hw + 0.02, y0 + h + 0.008, hl + 0.02], { kind: 'glass', ...NB });
  // 帯の紐（白い PP の帯 2 本が上をまたいで前後の面を下りる）
  for (const x of [-0.25, 0.25]) {
    q.box('#e8f2f2', [x - 0.008, y0 + h + 0.008, -hl - 0.025], [x + 0.008, y0 + h + 0.014, hl + 0.025], NB);
    for (const sz of [-1, 1]) q.box('#e8f2f2', [x - 0.008, 0.02, sz * (hl + 0.022) - 0.003], [x + 0.008, y0 + h + 0.014, sz * (hl + 0.022) + 0.003], NB);
  }
  // 出荷の札（前の面）
  q.box(PAL.paper, [-0.12, y0 + h * 0.55, hl + 0.026], [0.12, y0 + h * 0.55 + 0.16, hl + 0.03], NB);
  q.box('#1a2a30', [-0.1, y0 + h * 0.55 + 0.03, hl + 0.03], [0.06, y0 + h * 0.55 + 0.05, hl + 0.032], NB);
}

/** パレットのラップの巻き機（回る台・柱・フィルムの台車・操作の箱）。台の上にラップで巻いた荷 */
export function palletWrapper(p: Prop): void {
  p.collide([-1.0, 0, -1.25], [1.0, 2.3, 1.0]);
  // 回る台（低い円盤と縁）・前の踏み板
  p.cyl('#3f7484', [0, 0.04, 0], 0.9, 0.08, { seg: 32 });
  p.cyl('#5a93a3', [0, 0.085, 0], 0.86, 0.01, { seg: 32, shadow: false });
  p.box('#2f6474', [-0.5, 0, 0.85], [0.5, 0.06, 1.0], NB);
  // 後ろの柱とフィルムの台車（ロール）・操作の箱
  p.box('#2f6474', [-0.12, 0, -1.25], [0.12, 2.3, -1.05], { r: 0.01 });
  p.box('#2f6474', [-0.35, 0, -1.3], [0.35, 0.12, -0.95]);
  p.box('#4f8ea0', [-0.2, 1.0, -1.05], [0.2, 1.3, -0.85], { r: 0.01 });
  p.cyl('#dceff2', [0, 1.15, -0.8], 0.06, 0.5, { seg: 14 });
  p.cyl('#9fc7d0', [0, 1.15, -0.8], 0.02, 0.56, { seg: 8, shadow: false });
  p.box('#c8d8dc', [0.35, 0.9, -1.25], [0.75, 1.4, -1.05], { r: 0.01 });
  p.box('#173f4f', [0.4, 1.2, -1.05], [0.7, 1.33, -1.045], NB);
  p.cyl(PAL.red, [0.47, 1.05, -1.04], 0.025, 0.02, { axis: 'z', seg: 10, shadow: false });
  p.cyl(PAL.green, [0.6, 1.05, -1.04], 0.025, 0.02, { axis: 'z', seg: 10, shadow: false });
  const q = p.sub([0, 0.09, 0]);
  q.collide([-0.55, 0, -0.55], [0.55, 0.14, 0.55]);
  // パレットと巻いた荷
  for (let i = 0; i < 7; i++) {
    const x = -0.55 + 0.05 + i * 0.165;
    q.box('#8a7c62', [x - 0.05, 0.12, -0.55], [x + 0.05, 0.14, 0.55], NB);
  }
  for (const z of [-0.5, 0, 0.5]) q.box('#76694f', [-0.55, 0.0, z - 0.05], [0.55, 0.12, z + 0.05], NB);
  wrapLoad(q, 4);
}

/** カゴ台車（かご車。幅 0.8・奥行き 0.6・高さ 1.7）: 4 面の格子・キャスター・中の箱 */
export function rollCage(p: Prop): void {
  const w = 0.8;
  const d = 0.6;
  const h = 1.7;
  const c = '#7fb0bd';
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) p.cyl(PAL.black, [x, 0.05, z], 0.05, 0.035, { axis: 'x', seg: 10, shadow: false });
  p.box(c, [-w / 2, 0.1, -d / 2], [w / 2, 0.14, d / 2]);
  for (const x of [-w / 2, w / 2]) {
    for (const z of [-d / 2, d / 2]) p.box(c, [x - 0.012, 0.14, z - 0.012], [x + 0.012, h, z + 0.012], NB);
    for (let y = 0.3; y < h; y += 0.15) p.box(c, [x - 0.005, y, -d / 2], [x + 0.005, y + 0.008, d / 2], NB);
  }
  for (const z of [-d / 2]) for (let y = 0.3; y < h; y += 0.15) p.box(c, [-w / 2, y, z - 0.005], [w / 2, y + 0.008, z + 0.005], NB);
  for (let x = -w / 2 + 0.1; x < w / 2; x += 0.1) p.box(c, [x - 0.004, 0.14, -d / 2 - 0.004], [x + 0.004, h, -d / 2 + 0.004], NB);
  for (let k = 0; k < 3; k++) serverBox(p.sub([0, 0.14 + k * 0.3, 0], (k - 1) * 0.06), { w: 0.55, l: 0.5, h: 0.28 });
}

/** ロッカー（4 列 × 2 段。幅 0.9）: 扉の縁・通気の切れ込み・取っ手・名札 */
export function lockerBank(p: Prop, o: { cols?: number } = {}): void {
  const cols = o.cols ?? 4;
  const cw = 0.38;
  const w = cols * cw;
  const h = 1.8;
  const c = '#4f8ea0';
  p.collide([-w / 2, 0, -0.5], [w / 2, h, 0.02]);
  p.box(c, [-w / 2, 0.05, -0.5], [w / 2, h, -0.01], { r: 0.006 });
  p.box('#1f4f60', [-w / 2 + 0.01, 0, -0.48], [w / 2 - 0.01, 0.05, -0.03], NB);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < 2; j++) {
      const x0 = -w / 2 + i * cw + 0.01;
      const y0 = 0.07 + j * (h / 2 - 0.02);
      p.box('#5a9db0', [x0, y0, -0.01], [x0 + cw - 0.02, y0 + h / 2 - 0.06, 0.0], NB);
      for (let k = 0; k < 4; k++) p.box('#2f6f84', [x0 + 0.08, y0 + h / 2 - 0.2 + k * 0.025, 0.0], [x0 + cw - 0.1, y0 + h / 2 - 0.19 + k * 0.025, 0.003], NB);
      p.box(PAL.steelDark, [x0 + cw - 0.07, y0 + 0.35, 0.0], [x0 + cw - 0.05, y0 + 0.5, 0.02], NB);
      p.box(PAL.paper, [x0 + 0.08, y0 + 0.5, 0.0], [x0 + 0.2, y0 + 0.55, 0.003], NB);
    }
}

/** 蓄電池の盤（UPS 室。黒い盤・状態の LED の列・換気の切れ込み） */
export function batteryCabinet(p: Prop, o: { w?: number } = {}): void {
  const w = o.w ?? 0.6;
  const hw = w / 2;
  p.collide([-hw, 0, -0.85], [hw, 2.0, 0.01]);
  p.box('#0d2430', [-hw, 0.05, -0.85], [hw, 2.0, -0.01], { r: 0.008 });
  rearPanel(p, hw, 0.85, 2.0, '#163a4a', '#0d2430');
  p.box(PAL.black, [-hw + 0.01, 0, -0.83], [hw - 0.01, 0.05, -0.03], NB);
  for (let k = 0; k < 10; k++) {
    const y = 0.25 + k * 0.17;
    p.box('#163a4a', [-hw + 0.04, y, -0.01], [hw - 0.04, y + 0.14, 0.0], NB);
    ledDot(p, -hw + 0.08, y + 0.07, 0.0, k % 4 === 3 ? PAL.ledAmber : PAL.ledGreen, 0.008);
    ledDot(p, -hw + 0.12, y + 0.07, 0.0, PAL.led, 0.008);
  }
  p.box(PAL.paper, [-0.1, 1.9, 0.0], [0.1, 1.95, 0.003], NB);
}

/** 冷水のポンプ（台の上のモーターと渦巻きの胴・配管・計器） */
export function pump(p: Prop): void {
  p.collide([-0.5, 0, -0.3], [0.65, 1.1, 0.3]);
  p.box('#3f7d90', [-0.5, 0, -0.3], [0.5, 0.15, 0.3], { r: 0.01 });
  p.cyl('#5f9fb2', [-0.15, 0.4, 0], 0.18, 0.5, { axis: 'x', seg: 16 });
  for (let k = 0; k < 6; k++) p.torus('#4f8ea0', [-0.35 + k * 0.08, 0.4, 0], 0.18, 0.012, { axis: 'x', seg: 18, shadow: false });
  p.cyl('#6aa9bb', [0.25, 0.4, 0], 0.22, 0.2, { axis: 'x', seg: 18 });
  p.cyl('#5f9fb2', [0.25, 0.85, 0], 0.08, 0.5, { seg: 12 });
  p.cyl('#5f9fb2', [0.55, 0.4, 0], 0.08, 0.3, { axis: 'x', seg: 12 });
  p.cyl('#d8eef0', [0.25, 0.75, 0.1], 0.045, 0.02, { axis: 'z', seg: 12, shadow: false });
  p.box(PAL.red, [0.2, 1.05, -0.08], [0.3, 1.1, 0.08], { r: 0.01, shadow: false });
}
