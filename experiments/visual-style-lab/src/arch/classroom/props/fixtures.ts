import { ellipse, type Prop } from '../../../props/kit.ts';
import { DARK, PAPER } from './school.ts';

/**
 * 校舎の設備の小物（階段室・廊下の壁と天井に付く物）。実寸と部位で作る。
 * 寸法の根拠: 屋内消火栓箱 幅 0.75 × 高さ 1.0 × 奥行き 0.18 m（上に赤い表示灯・横に発信機）、
 * 非常灯（天井付けの丸形）直径 0.16 m、煙感知器 直径 0.1 m、壁付けの灯り（ブラケット）高さ 0.3 m、
 * 水飲み場（ステンレスの流し・上向きの蛇口）長さ 1.2〜1.8 m・高さ 0.7 m
 */

/** 屋内消火栓の箱（赤い扉・枠・取っ手・「消火栓」の札・上の赤い表示灯・横の発信機とベル）。壁の面 z = 0、箱の下端 y = 0 */
export function hydrantCabinet(p: Prop, o: { w?: number; h?: number; red?: string } = {}): void {
  const W = o.w ?? 0.75;
  const H = o.h ?? 1.0;
  const D = 0.18;
  const red = o.red ?? '#c9504a';
  // 箱（壁から出る）と扉（枠の内側・少し前）
  p.box(red, [-W / 2, 0, 0], [W / 2, H, D - 0.01], { r: 0.006, seg: 1 });
  p.box(red, [-W / 2 + 0.03, 0.03, D - 0.012], [W / 2 - 0.03, H - 0.03, D], { r: 0.004, seg: 1 });
  // 扉の取っ手（くぼみの金物）と札（白い板に赤い字の帯）
  p.box('#a9cdd4', [W / 2 - 0.1, H * 0.45, D], [W / 2 - 0.06, H * 0.45 + 0.12, D + 0.012], { r: 0.004, seg: 1 });
  p.box(PAPER, [-0.2, H - 0.22, D], [0.2, H - 0.1, D + 0.003], { shadow: false });
  for (let k = 0; k < 3; k++) p.box(red, [-0.16 + k * 0.12, H - 0.2, D + 0.0032], [-0.08 + k * 0.12, H - 0.12, D + 0.0036], { shadow: false });
  // 上の赤い表示灯（丸い台・光る赤い玉）
  p.cyl(DARK, [0, H + 0.16, 0.035], 0.055, 0.07, { axis: 'z', seg: 16 });
  p.ball(red, [0, H + 0.16, 0.075], [0.045, 0.045, 0.03], { seg: 12, shadow: false });
  // 横の発信機（押しボタン）とベル
  p.box(red, [W / 2 + 0.06, H * 0.55, 0], [W / 2 + 0.2, H * 0.55 + 0.14, 0.05], { r: 0.006, seg: 1 });
  p.cyl(PAPER, [W / 2 + 0.13, H * 0.55 + 0.07, 0.052], 0.035, 0.006, { axis: 'z', seg: 12, shadow: false });
  p.lathe(red, [[0, 0], [0.075, 0], [0.075, 0.01], [0.06, 0.05], [0, 0.055]], [W / 2 + 0.13, H * 0.55 + 0.32, 0], { axis: 'z', seg: 16 });
}

/** 非常灯（天井付けの丸形: 白い台・乳白の覆い（消えている）・緑の点検の灯）。天井の面 y = 0、下へ */
export function emergencyLight(p: Prop, o: { body?: string } = {}): void {
  const body = o.body ?? '#cfe6e6';
  p.cyl(body, [0, -0.012, 0], 0.085, 0.024, { seg: 20 });
  p.lathe(PAPER, [[0, 0], [0.03, 0.002], [0.055, 0.015], [0.06, 0.036], [0, 0.036]], [0, -0.06, 0], { seg: 16, shadow: false });
  p.cyl('#a9cdd4', [0.07, -0.025, 0], 0.006, 0.004, { seg: 8, shadow: false });
}

/** 煙感知器（天井の丸い皿・中のふくらみ・周りのすき間）。天井の面 y = 0、下へ */
export function smokeDetector(p: Prop, o: { body?: string } = {}): void {
  const body = o.body ?? '#cfe6e6';
  p.lathe(body, [[0, 0], [0.03, 0.002], [0.045, 0.014], [0.052, 0.032], [0.052, 0.044], [0, 0.044]], [0, -0.044, 0], { seg: 20 });
  p.torus('#a9cdd4', [0, -0.022, 0], 0.046, 0.003, { axis: 'y', seg: 20, shadow: false });
}

/** 壁付けの灯り（丸い台座・腕・乳白のガラスの筒（消えている）・金物の蓋）。壁の面 z = 0、中心 y = 0 */
export function bracketLight(p: Prop, o: { body?: string; glass?: string } = {}): void {
  const body = o.body ?? '#2c4c66';
  p.cyl(body, [0, 0, 0.012], 0.07, 0.024, { axis: 'z', seg: 16 });
  p.rod(body, [0, 0, 0.02], [0, 0, 0.11], 0.012, { radial: 8 });
  p.cyl(o.glass ?? PAPER, [0, 0, 0.13], 0.06, 0.24, { seg: 16, shadow: false });
  p.cyl(body, [0, 0.125, 0.13], 0.066, 0.015, { seg: 16 });
  p.cyl(body, [0, -0.125, 0.13], 0.05, 0.015, { seg: 16 });
}

/**
 * 水飲み場（ステンレスの長い流し・前の縁・上向きの蛇口の列・後ろの立ち上がり・下の脚と排水の管）。
 * 局所: 床の中心、壁は -z 側（奥行き D の流しが壁に付く）
 */
export function drinkingFountain(p: Prop, o: { w?: number; steel?: string; n?: number } = {}): void {
  const W = o.w ?? 1.5;
  const D = 0.45;
  const H = 0.72;
  const st = o.steel ?? '#8fb4c4';
  const n = o.n ?? 4;
  // 流し（外の箱・内の底・前の縁の丸み）と後ろの立ち上がり（タイルの壁に付く板）
  p.box(st, [-W / 2, H - 0.16, -D / 2], [W / 2, H, D / 2], { r: 0.012, seg: 1 });
  p.box(DARK, [-W / 2 + 0.04, H - 0.13, -D / 2 + 0.06], [W / 2 - 0.04, H + 0.001, D / 2 - 0.04]);
  p.box(st, [-W / 2, H, -D / 2], [W / 2, H + 0.25, -D / 2 + 0.03], { r: 0.006, seg: 1 });
  // 上向きの蛇口（台・首・口）と、後ろの壁の横の配管
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    p.cyl('#a9cdd4', [x, H + 0.02, -D / 2 + 0.09], 0.02, 0.04, { seg: 10 });
    p.tube('#cfe6e6', [[x, H + 0.04, -D / 2 + 0.09], [x, H + 0.12, -D / 2 + 0.09], [x, H + 0.15, -D / 2 + 0.13]], 0.008, { radial: 6, seg: 6, shadow: false });
    p.cyl('#a9cdd4', [x + 0.05, H + 0.05, -D / 2 + 0.09], 0.012, 0.012, { seg: 8, shadow: false });
  }
  p.rod('#4f7f96', [-W / 2 + 0.05, H + 0.18, -D / 2 + 0.045], [W / 2 - 0.05, H + 0.18, -D / 2 + 0.045], 0.012, { radial: 6 });
  // 脚と排水の管
  for (const s of [-1, 1]) p.box('#7fa9b4', [s * (W / 2 - 0.08) - 0.025, 0, -D / 2 + 0.05], [s * (W / 2 - 0.08) + 0.025, H - 0.16, -D / 2 + 0.1]);
  p.tube('#4f7f96', [[0, H - 0.16, 0], [0, 0.3, 0], [0, 0.3, -D / 2 + 0.02]], 0.022, { sharp: true, radial: 8 });
  p.cyl(DARK, [0, 0.005, -D / 2 + 0.15], 0.06, 0.01, { seg: 12, shadow: false });
  p.collide([-W / 2, 0, -D / 2], [W / 2, H + 0.25, D / 2]);
}

/**
 * カーテン（レールと、ひだの付いた布を左右に寄せた 2 枚）。窓の内の面 z = 0、レールの高さ y = 0、幅 W（窓の幅）。
 * ひだは布の輪郭（波の形の押し出し）で作る。open = 寄せた布の幅の割合
 */
export function curtain(p: Prop, o: { w?: number; h?: number; col?: string; open?: number } = {}): void {
  const W = o.w ?? 1.6;
  const H = o.h ?? 1.5;
  const col = o.col ?? '#9fc0bc';
  const k = o.open ?? 0.25;
  p.box('#7fa9b4', [-W / 2 - 0.1, -0.02, 0.06], [W / 2 + 0.1, 0.01, 0.09], { r: 0.004, seg: 1 });
  for (const s of [-1, 1]) {
    const cw = W * k;
    const x0 = s < 0 ? -W / 2 - 0.08 : W / 2 + 0.08 - cw;
    // ひだ（上から見た波の輪郭: 山の数は幅に比例）
    const n = Math.max(3, Math.round(cw / 0.07));
    const front: [number, number][] = [];
    const back: [number, number][] = [];
    for (let i = 0; i <= n * 2; i++) {
      const x = x0 + (i / (n * 2)) * cw;
      const z = 0.075 + (i % 2 === 0 ? -0.03 : 0.03);
      front.push([x, z + 0.006]);
      back.push([x, z - 0.006]);
    }
    p.extrude(col, [...back, ...front.reverse()], 'xz', -H, -0.02, { bevel: 0 });
    // 裾を留めるたすき（寄せた布の中ほど）
    p.box('#2c4c66', [x0 - 0.01, -H * 0.55, 0.035], [x0 + cw + 0.01, -H * 0.55 + 0.04, 0.115], { shadow: false });
  }
}

/** 掛け図（上下の木の軸・紙・海の地と陸の塊・題の帯）。壁の面 z = 0、上の軸の高さ y = 0 */
export function hangingMap(p: Prop, o: { w?: number; h?: number } = {}): void {
  const W = o.w ?? 1.0;
  const H = o.h ?? 1.2;
  p.box(PAPER, [-W / 2, -H, 0.004], [W / 2, 0, 0.006], { shadow: false });
  p.box('#4f7f96', [-W / 2 + 0.04, -H + 0.06, 0.006], [W / 2 - 0.04, -0.14, 0.007], { shadow: false });
  // 陸（楕円を重ねた島と半島の形）
  const lands: [number, number, number, number][] = [[-0.28, -0.35, 0.13, 0.09], [-0.18, -0.42, 0.08, 0.12], [0.12, -0.5, 0.16, 0.07], [0.2, -0.56, 0.07, 0.1], [-0.05, -0.8, 0.06, 0.1], [0.3, -0.85, 0.05, 0.05]];
  for (const [x, y, rx, ry] of lands) p.extrude('#8fc0b0', ellipse(x * W, y * H, rx, ry, 16), 'xy', 0.007, 0.0075, { shadow: false });
  p.box('#2c4c66', [-W / 2 + 0.06, -0.11, 0.006], [W / 2 - 0.06, -0.05, 0.007], { shadow: false });
  for (const y of [0, -H]) p.cyl('#5f8c94', [0, y, 0.012], 0.014, W + 0.08, { axis: 'x', seg: 8 });
  p.rod('#2c4c66', [-0.15, 0.0, 0.01], [0, 0.12, 0.002], 0.003, { radial: 4, shadow: false });
  p.rod('#2c4c66', [0.15, 0.0, 0.01], [0, 0.12, 0.002], 0.003, { radial: 4, shadow: false });
}

/**
 * 地図の引き出しの箱（教材室の窓の下: 浅い引き出しを重ねた鉄の箱・引き出しごとの取っ手と名札・上に丸めた地図）。
 * 幅 1.4・奥行き 0.6・高さ 0.8。局所: 床の中心、壁は -z 側
 */
export function mapCase(p: Prop, o: { body?: string } = {}): void {
  const W = 1.4;
  const D = 0.6;
  const body = o.body ?? '#6f9aaa';
  p.box(DARK, [-W / 2 + 0.02, 0, -D / 2 + 0.02], [W / 2 - 0.02, 0.06, D / 2 - 0.03]);
  p.box(body, [-W / 2, 0.06, -D / 2], [W / 2, 0.8, D / 2 - 0.01], { r: 0.006, seg: 1 });
  for (let k = 0; k < 6; k++) {
    const y0 = 0.08 + k * 0.115;
    p.box('#7fa7b6', [-W / 2 + 0.02, y0, D / 2 - 0.012], [W / 2 - 0.02, y0 + 0.105, D / 2], { r: 0.003, seg: 1 });
    p.box('#a9cdd4', [-0.15, y0 + 0.04, D / 2], [0.15, y0 + 0.06, D / 2 + 0.014], { r: 0.004, seg: 1 });
    p.box(PAPER, [-0.45, y0 + 0.035, D / 2], [-0.3, y0 + 0.07, D / 2 + 0.003], { shadow: false });
  }
  for (let k = 0; k < 3; k++) p.cyl(k === 1 ? PAPER : '#cfe6e6', [-0.3 + k * 0.25, 0.84, 0.05 * k], 0.04, 1.1, { axis: 'x' });
  p.collide([-W / 2, 0, -D / 2], [W / 2, 0.85, D / 2]);
}

/** 空調の室外機（鉄の箱・前のファンの丸い格子・横の吸い込みの格子・脚・配管の口）。局所: 床の中心、壁は -z 側 */
export function acUnit(p: Prop): void {
  const W = 0.8;
  const H = 0.6;
  const D = 0.28;
  const body = '#cfe6e6';
  p.box('#7fa9b4', [-W / 2 + 0.04, 0, -D / 2 + 0.02], [W / 2 - 0.04, 0.06, D / 2 - 0.02]);
  p.box(body, [-W / 2, 0.06, -D / 2], [W / 2, 0.06 + H, D / 2], { r: 0.012, seg: 1, collide: true });
  // 前のファン（暗い丸・放射の桟・中心の丸）
  const cx = -0.1;
  const cy = 0.06 + H / 2;
  p.cyl('#14283a', [cx, cy, D / 2 + 0.001], 0.21, 0.004, { axis: 'z', seg: 24, shadow: false });
  for (let k = 0; k < 8; k++) p.sub([cx, cy, D / 2 + 0.004], 0, { roll: (k / 8) * Math.PI }).box('#a9cdd4', [-0.21, -0.004, 0], [0.21, 0.004, 0.004], { shadow: false });
  p.torus('#a9cdd4', [cx, cy, D / 2 + 0.006], 0.13, 0.004, { axis: 'z', seg: 20, shadow: false });
  p.cyl('#a9cdd4', [cx, cy, D / 2 + 0.008], 0.035, 0.008, { axis: 'z', seg: 12, shadow: false });
  // 右の格子（横の線）と配管の口
  for (let k = 0; k < 9; k++) p.box('#7fa9b4', [0.17, 0.12 + k * 0.05, D / 2], [0.36, 0.13 + k * 0.05, D / 2 + 0.004], { shadow: false });
  p.box('#7fa9b4', [W / 2, 0.2, -0.06], [W / 2 + 0.05, 0.32, 0.06], { r: 0.005, seg: 1 });
}
