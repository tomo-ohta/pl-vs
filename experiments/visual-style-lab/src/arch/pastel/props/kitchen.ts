import type { Prop } from '../../../props/kit.ts';
import { bottle, extinguisher as commonExtinguisher } from '../../../props/lib/index.ts';
import { kettle } from './lobby.ts';
import { glassCabinet } from './medical.ts';
import { BOTTLES, K } from './mats.ts';

/**
 * 流し台・ガス台・冷蔵庫・食器棚（給湯室・処置室・検査室）と、どの部屋にもある設備（吊り下げの灯り・暗い低い棚・消火器）。
 * 局所の座標: 足元の真ん中が原点・正面 +z・背 -z。
 * 実寸: 流し台（高さ 0.85 m・奥行き 0.6 m・流しの鉢 0.5 × 0.37 × 深さ 0.17 m）・2 口のガス台・冷蔵庫（昭和の 1 枚扉と冷凍の小扉）。
 */

const ROUND = { seg: 1 } as const;

/** 2 口のガス台: 胴・暗い天板・火口と五徳・前のつまみ・壁へのゴムの管。原点は台の下 */
export function gasStove(p: Prop): void {
  p.box(K.enamel, [-0.28, 0, -0.2], [0.28, 0.1, 0.2], { r: 0.012, ...ROUND });
  p.box(K.darker, [-0.27, 0.1, -0.19], [0.27, 0.106, 0.19]);
  for (const x of [-0.13, 0.13]) {
    p.cyl(K.ink, [x, 0.112, 0], 0.045, 0.014, { seg: 14 });
    p.torus(K.ink, [x, 0.125, 0], 0.085, 0.006, { axis: 'y', seg: 18 });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      p.box(K.ink, [x + Math.cos(a) * 0.05 - 0.006, 0.12, Math.sin(a) * 0.05 - 0.006], [x + Math.cos(a) * 0.085 + 0.006, 0.135, Math.sin(a) * 0.085 + 0.006]);
    }
    p.cyl(K.ink, [x, 0.05, 0.205], 0.022, 0.02, { axis: 'z', seg: 12 });
    p.box(K.paper, [x - 0.002, 0.065, 0.214], [x + 0.002, 0.07, 0.216]);
  }
  p.tube(K.sageD, [[0.28, 0.04, -0.15], [0.33, 0.03, -0.2], [0.34, 0.15, -0.28]], 0.01, { seg: 10, radial: 6 });
}

/**
 * 流し台: 引っ込んだ台輪・胴と扉（隙間・取っ手）・ステンレスの天板（流しの所だけ抜いて、くぼんだ鉢の底と 4 面の内壁）・水よけの立ち上がり・
 * 曲がった蛇口と十字の取っ手。stove でガス台とやかん、upper で吊り戸棚
 */
export function sinkCounter(p: Prop, w: number, o: { sinkAt?: number; stove?: boolean; upper?: boolean; h?: number; dp?: number } = {}): void {
  const h = o.h ?? 0.85;
  const dp = o.dp ?? 0.6;
  const sx = o.sinkAt ?? 0;
  const body = K.enamel;
  const top = K.metal;
  const sw = 0.25;
  const [sz0, sz1] = [-0.17, 0.2];
  p.box(K.sageD, [-w / 2 + 0.01, 0, -dp / 2 + 0.02], [w / 2 - 0.01, 0.08, dp / 2 - 0.07]);
  p.box(body, [-w / 2, 0.08, -dp / 2], [w / 2, h - 0.21, dp / 2 - 0.02]);
  p.box(body, [-w / 2, h - 0.21, dp / 2 - 0.05], [w / 2, h - 0.03, dp / 2 - 0.02]);
  for (const s of [-1, 1]) p.box(body, [s < 0 ? -w / 2 : w / 2 - 0.02, h - 0.21, -dp / 2], [s < 0 ? -w / 2 + 0.02 : w / 2, h - 0.03, dp / 2 - 0.02]);
  const n = Math.max(1, Math.round(w / 0.45));
  for (let i = 0; i < n; i++) {
    const a = -w / 2 + (w * i) / n + 0.008;
    const b = -w / 2 + (w * (i + 1)) / n - 0.008;
    p.box(K.pale, [a, 0.1, dp / 2 - 0.022], [b, h - 0.07, dp / 2 - 0.004], { r: 0.004, ...ROUND });
    const hx = i % 2 ? a + 0.05 : b - 0.05;
    p.box(K.ink, [hx - 0.008, h - 0.2, dp / 2 - 0.004], [hx + 0.008, h - 0.11, dp / 2 + 0.01], { r: 0.004 });
  }
  // 天板（流しの穴の周り 4 枚）と前の縁
  const T = (a: [number, number, number], b: [number, number, number]): void => p.box(top, a, b);
  T([-w / 2, h - 0.03, -dp / 2], [sx - sw, h, dp / 2]);
  T([sx + sw, h - 0.03, -dp / 2], [w / 2, h, dp / 2]);
  T([sx - sw, h - 0.03, -dp / 2], [sx + sw, h, sz0]);
  T([sx - sw, h - 0.03, sz1], [sx + sw, h, dp / 2]);
  p.box(top, [-w / 2, h - 0.045, dp / 2 - 0.01], [w / 2, h + 0.004, dp / 2 + 0.008], { r: 0.004 });
  // 流しの鉢（底・4 面の内壁・排水口）
  const by = h - 0.2;
  p.box(K.sage, [sx - sw, by - 0.01, sz0], [sx + sw, by, sz1]);
  p.box(top, [sx - sw, by, sz0], [sx + sw, h - 0.03, sz0 + 0.008]);
  p.box(top, [sx - sw, by, sz1 - 0.008], [sx + sw, h - 0.03, sz1]);
  p.box(top, [sx - sw, by, sz0], [sx - sw + 0.008, h - 0.03, sz1]);
  p.box(top, [sx + sw - 0.008, by, sz0], [sx + sw, h - 0.03, sz1]);
  p.cyl(K.ink, [sx, by + 0.002, (sz0 + sz1) / 2], 0.03, 0.004, { seg: 12 });
  // 水よけの立ち上がり・蛇口
  p.box(top, [-w / 2, h, -dp / 2], [w / 2, h + 0.1, -dp / 2 + 0.015]);
  p.tube(K.steel, [[sx, h + 0.06, -dp / 2 + 0.015], [sx, h + 0.06, -dp / 2 + 0.08], [sx, h + 0.24, -dp / 2 + 0.1], [sx, h + 0.26, -dp / 2 + 0.2], [sx, h + 0.17, -dp / 2 + 0.26]], 0.012, { seg: 16, radial: 8 });
  for (const s of [-1, 1]) {
    p.rod(K.steel, [sx + s * 0.09, h + 0.05, -dp / 2 + 0.015], [sx + s * 0.09, h + 0.05, -dp / 2 + 0.06], 0.01, { radial: 6 });
    p.box(K.steel, [sx + s * 0.09 - 0.03, h + 0.045, -dp / 2 + 0.055], [sx + s * 0.09 + 0.03, h + 0.055, -dp / 2 + 0.065], { r: 0.004 });
  }
  // 流しの横: 洗剤の瓶・ふきん
  bottle(p.sub([sx + sw + 0.08, h, -dp / 2 + 0.08]), 0.03, 0.18, BOTTLES[1]);
  p.box(K.paper, [sx + sw + 0.03, h, 0.0], [sx + sw + 0.2, h + 0.012, 0.13], { r: 0.004 });
  if (o.stove) {
    const x = w / 2 - 0.35;
    gasStove(p.sub([x, h, -0.02]));
    kettle(p.sub([x - 0.13, h + 0.135, -0.02], 0.4));
  }
  if (o.upper !== false) {
    const d2 = 0.35;
    p.box(body, [-w / 2, 1.5, -dp / 2], [w / 2, 2.15, -dp / 2 + d2], { r: 0.005, ...ROUND });
    for (let i = 0; i < n; i++) {
      const a = -w / 2 + (w * i) / n + 0.008;
      const b = -w / 2 + (w * (i + 1)) / n - 0.008;
      p.box(K.pale, [a, 1.52, -dp / 2 + d2], [b, 2.13, -dp / 2 + d2 + 0.016], { r: 0.004, ...ROUND });
      const hx = i % 2 ? a + 0.05 : b - 0.05;
      p.box(K.ink, [hx - 0.008, 1.54, -dp / 2 + d2 + 0.016], [hx + 0.008, 1.62, -dp / 2 + d2 + 0.028], { r: 0.004 });
    }
  }
  p.collide([-w / 2, 0, -dp / 2], [w / 2, h, dp / 2 + 0.008]);
}

/** 冷蔵庫（昭和の型）: 角の丸い胴・台輪と下の通気の桟・上の冷凍の小扉と下の扉（継ぎ目）・縦の取っ手・名の板 */
export function fridge(p: Prop, h = 1.4, w = 0.6): void {
  const c = K.enamel;
  p.box(K.sageD, [-w / 2 + 0.03, 0, -0.27], [w / 2 - 0.03, 0.06, 0.22]);
  p.box(c, [-w / 2, 0.05, -0.3], [w / 2, h, 0.27], { r: 0.05 });
  const yd = h * 0.7;
  p.box(c, [-w / 2 + 0.012, 0.1, 0.25], [w / 2 - 0.012, yd - 0.006, 0.3], { r: 0.03 });
  p.box(c, [-w / 2 + 0.012, yd + 0.006, 0.25], [w / 2 - 0.012, h - 0.02, 0.3], { r: 0.03 });
  for (let i = 0; i < 3; i++) p.box(K.creamD, [-w / 2 + 0.06, 0.065 + i * 0.012, 0.25], [w / 2 - 0.06, 0.07 + i * 0.012, 0.272]);
  p.box(K.steel, [w / 2 - 0.085, yd - 0.3, 0.29], [w / 2 - 0.055, yd - 0.06, 0.325], { r: 0.012, ...ROUND });
  p.box(K.steel, [w / 2 - 0.085, yd + 0.04, 0.29], [w / 2 - 0.055, yd + 0.16, 0.32], { r: 0.012, ...ROUND });
  p.box(K.metal, [-0.08, yd - 0.12, 0.299], [0.08, yd - 0.09, 0.303], { r: 0.004 });
  p.collide([-w / 2, 0, -0.3], [w / 2, h, 0.33]);
}

/** 食器棚（木の枠のガラス戸。中に皿・茶碗・急須）と上の笠木 */
export function cupboard(p: Prop, w = 0.9, h = 1.8): void {
  glassCabinet(p, { w, h, dp: 0.42, body: K.wood, content: 'dishes' });
  p.box(K.woodD, [-w / 2 - 0.02, h, -0.22], [w / 2 + 0.02, h + 0.03, 0.23], { r: 0.008, ...ROUND });
}

/** 吊り下げの灯り: 天井の台・吊り棒・ほうろうの笠（内側が見える 1 つの回転体）・電球 */
export function pendant(p: Prop, ceil: number, drop: number): void {
  p.cyl(K.enamel, [0, ceil - 0.015, 0], 0.06, 0.03, { seg: 14 });
  p.cyl(K.metal, [0, ceil - drop / 2, 0], 0.008, drop, { seg: 6 });
  const y = ceil - drop;
  p.cyl(K.metal, [0, y - 0.01, 0], 0.025, 0.04, { seg: 10 });
  p.lathe(K.enamel, [[0.022, 0], [0.05, -0.015], [0.19, -0.1], [0.225, -0.125], [0.218, -0.132], [0.185, -0.112], [0.045, -0.026], [0.0, -0.02]], [0, y, 0], { seg: 22 });
  p.ball('#f4f6e4', [0, y - 0.06, 0], [0.045, 0.05, 0.045], { kind: 'glow', seg: 10 });
}

/** 壁の腕木の灯り: 壁の座金・曲がった腕・ほうろうの笠・電球。原点は壁の面、y は腕の付け根の高さ */
export function bracketLamp(p: Prop, y: number): void {
  p.cyl(K.metal, [0, y, 0.01], 0.05, 0.02, { axis: 'z', seg: 14 });
  p.tube(K.metal, [[0, y, 0.02], [0, y + 0.03, 0.09], [0, y - 0.01, 0.15]], 0.01, { seg: 10, radial: 6 });
  p.lathe(K.enamel, [[0.016, 0], [0.032, -0.012], [0.11, -0.07], [0.13, -0.085], [0.124, -0.09], [0.104, -0.077], [0.03, -0.02], [0.0, -0.016]], [0, y - 0.02, 0.15], { seg: 18 });
  p.ball('#f4f6e4', [0, y - 0.07, 0.15], [0.035, 0.04, 0.035], { kind: 'glow', seg: 10 });
}

/**
 * 暗い低い棚（参考画像の右の暗い棚と同じ色: 前 #6f8382・横 #677a7a・天板 #92a19a）: 引っ込んだ台輪・胴・張り出した天板・
 * 2 枚の扉の合わせ目と蝶番・取っ手・鍵穴、天板の上に紙の束とほうろうの水差し（ときどき）
 */
export function darkCabinet(p: Prop, w = 0.8, h = 1.0, dp = 0.45): void {
  p.box(K.darker, [-w / 2 + 0.02, 0, -dp / 2 + 0.02], [w / 2 - 0.02, 0.06, dp / 2 - 0.03]);
  p.box('@cab', [-w / 2, 0.06, -dp / 2], [w / 2, h, dp / 2]);
  p.box('@cabTop', [-w / 2 - 0.035, h, -dp / 2 - 0.02], [w / 2 + 0.035, h + 0.05, dp / 2 + 0.035], { r: 0.006, ...ROUND });
  p.box('#61767a', [-0.004, 0.08, dp / 2], [0.004, h - 0.04, dp / 2 + 0.004]);
  p.box('#61767a', [-w / 2 + 0.02, h - 0.045, dp / 2], [w / 2 - 0.02, h - 0.04, dp / 2 + 0.004]);
  for (const x of [-0.06, 0.04]) p.box(K.ink, [x, h * 0.55, dp / 2], [x + 0.02, h * 0.55 + 0.1, dp / 2 + 0.02], { r: 0.005 });
  for (const s of [-1, 1]) for (const y of [0.18, h - 0.14]) p.cyl(K.ink, [s * (w / 2 - 0.012), y, dp / 2 + 0.004], 0.006, 0.05, { seg: 6 });
  p.box(K.ink, [0.06, h * 0.55 + 0.13, dp / 2], [0.07, h * 0.55 + 0.15, dp / 2 + 0.003]);
  if (p.r() < 0.7) {
    const st = p.sub([-w / 2 + 0.21, h + 0.05, -0.01], (p.r() - 0.5) * 0.3);
    const n = 2 + Math.floor(p.r() * 5);
    for (let i = 0; i < n; i++) st.sub([(p.r() - 0.5) * 0.02, i * 0.008, (p.r() - 0.5) * 0.02], (p.r() - 0.5) * 0.08).box(i % 2 ? '#e5ece0' : K.paper, [-0.15, 0, -0.105], [0.15, 0.008, 0.105]);
  }
  if (p.r() < 0.5) p.lathe(K.enamel, [[0, 0], [0.05, 0], [0.055, 0.06], [0.04, 0.14], [0.045, 0.16], [0, 0.155]], [w / 2 - 0.15, h + 0.05, 0], { seg: 14 });
  p.collide([-w / 2 - 0.035, 0, -dp / 2 - 0.02], [w / 2 + 0.035, h + 0.05, dp / 2 + 0.035]);
}

/** 消火器（共通の小物。色は参考画像の表に赤が無いので暗い青緑）と壁の札。原点は壁の面 */
export function extinguisher(p: Prop): void {
  commonExtinguisher(p.sub([0, 0, 0.15]), { red: '#7d8f8b' });
  p.box(K.paper, [-0.15, 1.2, 0], [0.15, 1.35, 0.008], { r: 0.003 });
  p.box(K.greyBlue, [-0.12, 1.29, 0.008], [0.12, 1.32, 0.01]);
  p.box(K.sageD, [-0.08, 1.235, 0.008], [0.08, 1.25, 0.01]);
}
