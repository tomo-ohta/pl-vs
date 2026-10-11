import type { Prop } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { SC, SG } from './mats.ts';

/**
 * 管理室の小物（正面 +z・床 y = 0）: 事務机（引き出し・天板の書類・開いた台帳・電気スタンド・電話）・壁の時計
 */

/** 事務机（鉄の机: 天板・袖の引き出し 3 段と取っ手・脚の板・幕板。上に書類の山・開いた台帳・電気スタンド・黒い電話） */
export function officeDesk(p: Prop): void {
  const W = 1.4;
  const D = 0.7;
  const H = 0.72;
  const body = SC.paintPale;
  p.box(shade(body, 0.15), [-W / 2, H - 0.035, -D / 2], [W / 2, H, D / 2], { r: 0.01, collide: true });
  // 袖（右）と引き出し
  p.box(body, [W / 2 - 0.42, 0.04, -D / 2 + 0.02], [W / 2 - 0.02, H - 0.035, D / 2 - 0.01], { r: 0.006 });
  for (let i = 0; i < 3; i++) {
    const y0 = 0.08 + i * 0.2;
    p.box(shade(body, 0.08), [W / 2 - 0.4, y0, D / 2 - 0.012], [W / 2 - 0.04, y0 + 0.17, D / 2 + 0.004], { r: 0.004, shadow: 'receive' });
    p.box(SC.steel, [W / 2 - 0.27, y0 + 0.13, D / 2 + 0.004], [W / 2 - 0.17, y0 + 0.145, D / 2 + 0.02], { r: 0.004, shadow: 'receive' });
  }
  // 左の脚の板と幕板
  p.box(body, [-W / 2 + 0.02, 0.0, -D / 2 + 0.03], [-W / 2 + 0.05, H - 0.035, D / 2 - 0.03], { r: 0.004 });
  p.box(body, [-W / 2 + 0.05, H - 0.2, -D / 2 + 0.03], [W / 2 - 0.42, H - 0.035, -D / 2 + 0.05], { shadow: 'receive' });
  // 書類の山（紙の束を少しずらして重ねる）
  const t = p.sub([-0.35, H, -0.12], 0.1);
  for (let i = 0; i < 6; i++) t.box(i % 2 ? SC.paper : shade(SC.paper, -0.12), [-0.15 + (p.r() - 0.5) * 0.02, i * 0.012, -0.11], [0.15 + (p.r() - 0.5) * 0.02, i * 0.012 + 0.011, 0.11], { shadow: 'receive' });
  // 開いた台帳（2 枚の板を少し山折りに）・ペン
  const b = p.sub([0.1, H, 0.08], -0.15);
  b.sub([-0.12, 0, 0], 0, { roll: 0.06 }).box(SC.paper, [-0.12, 0, -0.16], [0.12, 0.012, 0.16], { shadow: 'receive' });
  b.sub([0.12, 0, 0], 0, { roll: -0.06 }).box(SC.paper, [-0.12, 0, -0.16], [0.12, 0.012, 0.16], { shadow: 'receive' });
  b.box(SC.binder2, [-0.25, -0.004, -0.17], [0.25, 0.003, 0.17], { shadow: 'receive' });
  b.rod(SC.steelDark, [0.05, 0.02, 0.1], [0.2, 0.02, -0.02], 0.004, { shadow: 'receive' });
  // 電気スタンド（台・曲がる腕・笠・光る球）
  const l = p.sub([-0.55, H, 0.15]);
  l.cyl(SC.steelDark, [0, 0.01, 0], 0.08, 0.02, { seg: 14 });
  l.tube(SC.steelDark, [[0, 0.02, 0], [0.02, 0.3, -0.05], [0.18, 0.42, 0.02]], 0.01, { shadow: 'receive' });
  l.sub([0.2, 0.42, 0.03], 0, { roll: -0.6 }).lathe(SC.paint, [[0, 0.02], [0.03, 0.02], [0.09, -0.06], [0, -0.06]], [0, 0, 0], { seg: 14, shadow: 'receive' });
  l.sub([0.2, 0.42, 0.03], 0, { roll: -0.6 }).ball(SG.lampWarm, [0, -0.05, 0], 0.03, { kind: 'glow', seg: 8, shadow: 'receive' });
  // 電話（黒い本体と受話器）
  const ph = p.sub([0.5, H, -0.2], -0.3);
  ph.box(SC.rubber, [-0.1, 0, -0.1], [0.1, 0.07, 0.1], { r: 0.02, shadow: 'receive' });
  ph.box(SC.rubber, [-0.11, 0.07, -0.03], [0.11, 0.1, 0.03], { r: 0.015, shadow: 'receive' });
}

/** 壁の時計（丸い枠・文字盤・12 の目盛り・針）。原点は時計の中心・壁の面 z = 0 */
export function wallClock(p: Prop): void {
  p.cyl(SC.steelDark, [0, 0, 0.025], 0.17, 0.05, { axis: 'z', seg: 24 });
  p.cyl(SC.white, [0, 0, 0.051], 0.15, 0.004, { axis: 'z', seg: 24, shadow: 'receive' });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 === 0 ? 0.11 : 0.125;
    p.rod(SC.steelDark, [Math.cos(a) * r0, Math.sin(a) * r0, 0.055], [Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.055], 0.004, { shadow: 'receive', radial: 4 });
  }
  p.rod(SC.steelDark, [0, 0, 0.058], [0.07, 0.06, 0.058], 0.006, { shadow: 'receive', radial: 4 });
  p.rod(SC.steelDark, [0, 0, 0.06], [-0.02, 0.12, 0.06], 0.004, { shadow: 'receive', radial: 4 });
}

/** 鉄の寝台（枠・脚・頭と足の板の縦の棒・マットレス・枕・畳んだ毛布）。長さは局所の z（頭が -z）、幅は x */
export function bed(p: Prop, L = 2.0, W = 0.9): void {
  const h = 0.42;
  const f = SC.steelDark;
  for (const x of [-W / 2, W / 2]) {
    p.rod(f, [x, 0, -L / 2], [x, 0.85, -L / 2], 0.018);
    p.rod(f, [x, 0, L / 2], [x, 0.6, L / 2], 0.018);
    p.rod(f, [x, h - 0.05, -L / 2], [x, h - 0.05, L / 2], 0.016, { shadow: 'receive' });
  }
  for (const [z, top] of [
    [-L / 2, 0.85],
    [L / 2, 0.6],
  ] as [number, number][]) {
    p.rod(f, [-W / 2, top, z], [W / 2, top, z], 0.016);
    p.rod(f, [-W / 2, h + 0.05, z], [W / 2, h + 0.05, z], 0.012, { shadow: 'receive' });
    for (let i = 1; i < 6; i++) {
      const x = -W / 2 + (i * W) / 6;
      p.rod(f, [x, h + 0.05, z], [x, top, z], 0.008, { shadow: 'receive', radial: 5 });
    }
  }
  p.box(SC.paintPale, [-W / 2 + 0.02, h - 0.04, -L / 2 + 0.03], [W / 2 - 0.02, h + 0.12, L / 2 - 0.03], { r: 0.04, collide: true });
  p.box(SC.white, [-W / 2 + 0.12, h + 0.12, -L / 2 + 0.08], [W / 2 - 0.12, h + 0.24, -L / 2 + 0.48], { r: 0.05 });
  // 畳んだ毛布（足の方に 3 つ折り）
  p.box(SC.binder2, [-W / 2 + 0.05, h + 0.12, L / 2 - 0.75], [W / 2 - 0.05, h + 0.22, L / 2 - 0.1], { r: 0.03 });
  p.box(shade(SC.binder2, -0.15), [-W / 2 + 0.05, h + 0.165, L / 2 - 0.75], [W / 2 - 0.05, h + 0.175, L / 2 - 0.1], { shadow: 'receive' });
}

/** 壁掛けの洗面台（陶器の鉢・蛇口・下の排水の管・上の鏡と小さな棚）。壁の面 z = 0 */
export function washBasin(p: Prop): void {
  const y = 0.82;
  p.box(SC.white, [-0.28, y - 0.16, 0], [0.28, y, 0.42], { r: 0.05, collide: true });
  p.box(shade(SC.white, -0.25), [-0.22, y - 0.1, 0.06], [0.22, y + 0.002, 0.36], { r: 0.04, shadow: 'receive' });
  p.rod(SC.steel, [0, y + 0.02, 0.05], [0, y + 0.18, 0.05], 0.014, { shadow: 'receive' });
  p.rod(SC.steel, [0, y + 0.18, 0.05], [0, y + 0.17, 0.16], 0.012, { shadow: 'receive' });
  for (const x of [-0.08, 0.08]) p.cyl(SC.steel, [x, y + 0.04, 0.05], 0.022, 0.04, { seg: 8, shadow: 'receive' });
  p.tube(SC.steel, [[0, y - 0.15, 0.2], [0, y - 0.35, 0.2], [0, y - 0.42, 0.12], [0, y - 0.42, 0.0]], 0.02, { shadow: 'receive' });
  p.box(SC.steelDark, [-0.22, y + 0.3, 0], [0.22, y + 0.85, 0.02], { r: 0.01 });
  p.box(SC.glass, [-0.2, y + 0.32, 0.02], [0.2, y + 0.83, 0.024], { shadow: 'receive' });
  p.box(SC.paintPale, [-0.25, y + 0.24, 0], [0.25, y + 0.27, 0.12], { shadow: 'receive' });
  p.cyl(SC.paper, [-0.12, y + 0.31, 0.06], 0.025, 0.08, { seg: 8, shadow: 'receive' });
  p.cyl(SC.binder, [0.1, y + 0.32, 0.06], 0.02, 0.1, { seg: 8, shadow: 'receive' });
}

/** 壁の棚板（腕木 2 本・板・本と台帳・瓶・箱）。幅 w、高さ y。壁の面 z = 0 */
export function wallShelf(p: Prop, w: number, y: number, o: { load?: 'books' | 'jars' } = {}): void {
  const d = 0.26;
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
    p.box(SC.steelDark, [x - 0.012, y - 0.2, 0], [x + 0.012, y, 0.02], { shadow: 'receive' });
    p.box(SC.steelDark, [x - 0.012, y - 0.03, 0], [x + 0.012, y, d - 0.03], { shadow: 'receive' });
  }
  p.box(SC.wood, [-w / 2, y, 0], [w / 2, y + 0.025, d], { r: 0.005 });
  let x = -w / 2 + 0.06;
  const cols = [SC.binder, SC.binder2, SC.paintPale, SC.paper, SC.red];
  while (x < w / 2 - 0.08) {
    if (o.load === 'jars' || p.r() < 0.18) {
      const r = 0.035 + p.r() * 0.02;
      p.cyl(p.r() < 0.5 ? SC.glass : SC.white, [x + r, y + 0.025 + 0.06, d * 0.5], r, 0.12, { seg: 10, shadow: 'receive' });
      x += r * 2 + 0.03;
    } else {
      const t = 0.03 + p.r() * 0.04;
      const h = 0.18 + p.r() * 0.1;
      const lean = p.r() < 0.12 ? 0.25 : 0;
      p.sub([x + t / 2, y + 0.025, d * 0.5], 0, { roll: lean }).box(cols[Math.floor(p.r() * cols.length)], [-t / 2, 0, -0.1], [t / 2, h, 0.1], { r: 0.004, shadow: 'receive' });
      x += t + 0.005 + (lean ? 0.06 : 0);
    }
  }
}

/** 書類の引き出しの棚（鉄の箱・4 段の引き出し・取っ手・名札の枠） */
export function filingCabinet(p: Prop, n = 4): void {
  const W = 0.47;
  const D = 0.62;
  const dh = 0.32;
  const H = n * dh + 0.06;
  p.box(SC.paintPale, [-W / 2, 0, -D / 2], [W / 2, H, D / 2], { r: 0.008, collide: true });
  for (let i = 0; i < n; i++) {
    const y0 = 0.04 + i * dh;
    p.box(shade(SC.paintPale, 0.06), [-W / 2 + 0.015, y0, D / 2 - 0.01], [W / 2 - 0.015, y0 + dh - 0.015, D / 2 + 0.006], { r: 0.004, shadow: 'receive' });
    p.box(SC.steel, [-0.08, y0 + dh * 0.55, D / 2 + 0.006], [0.08, y0 + dh * 0.55 + 0.025, D / 2 + 0.03], { r: 0.008, shadow: 'receive' });
    p.box(SC.steelDark, [-0.05, y0 + dh * 0.75, D / 2 + 0.006], [0.05, y0 + dh * 0.75 + 0.04, D / 2 + 0.01], { shadow: 'receive' });
    p.box(SC.paper, [-0.042, y0 + dh * 0.75 + 0.006, D / 2 + 0.01], [0.042, y0 + dh * 0.75 + 0.034, D / 2 + 0.012], { shadow: 'receive' });
  }
}

/** 掲示板（木の枠・コルクの面・留めた紙）。中心の高さ y、幅 w × 高さ h。壁の面 z = 0 */
export function noticeBoard(p: Prop, y: number, w = 1.2, h = 0.8): void {
  p.box(SC.woodDark, [-w / 2, y - h / 2, 0], [w / 2, y + h / 2, 0.03], { r: 0.006 });
  p.box(SC.wood, [-w / 2 + 0.04, y - h / 2 + 0.04, 0.03], [w / 2 - 0.04, y + h / 2 - 0.04, 0.035], { shadow: 'receive' });
  for (let i = 0; i < 7; i++) {
    const pw = 0.16 + p.r() * 0.12;
    const ph = 0.2 + p.r() * 0.1;
    const cx = -w / 2 + 0.15 + p.r() * (w - 0.3);
    const cy = y - h / 2 + 0.15 + p.r() * (h - 0.3);
    p.sub([cx, cy, 0.036], 0, { roll: (p.r() - 0.5) * 0.12 }).box(i % 3 === 0 ? SC.yellow : SC.paper, [-pw / 2, -ph / 2, 0], [pw / 2, ph / 2, 0.003], { shadow: 'receive' });
  }
}

/** 小さな机（天板・4 本の脚・幕板・上に本と湯呑み・灯り）。幅 w × 奥行き d（局所の z が前） */
export function smallDesk(p: Prop, w = 1.0, d = 0.55): void {
  const H = 0.72;
  p.box(SC.wood, [-w / 2, H - 0.03, -d / 2], [w / 2, H, d / 2], { r: 0.008, collide: true });
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) p.box(SC.woodDark, [x - 0.02, 0, z - 0.02], [x + 0.02, H - 0.03, z + 0.02]);
  p.box(SC.woodDark, [-w / 2 + 0.03, H - 0.12, -d / 2 + 0.03], [w / 2 - 0.03, H - 0.03, -d / 2 + 0.05], { shadow: 'receive' });
  p.box(SC.binder, [-0.3, H, -0.05], [-0.08, H + 0.03, 0.12], { r: 0.004, shadow: 'receive' });
  p.box(SC.paper, [-0.28, H + 0.03, -0.04], [-0.1, H + 0.034, 0.11], { shadow: 'receive' });
  p.lathe(SC.white, [[0, 0], [0.035, 0], [0.04, 0.08], [0.036, 0.08], [0, 0.005]], [0.12, H, 0.08], { seg: 12, shadow: 'receive' });
  const l = p.sub([0.32, H, -0.12]);
  l.cyl(SC.steelDark, [0, 0.01, 0], 0.07, 0.02, { seg: 12 });
  l.rod(SC.steelDark, [0, 0.02, 0], [0, 0.32, 0], 0.008, { shadow: 'receive' });
  l.lathe(SC.paint, [[0, 0.06], [0.03, 0.06], [0.1, -0.02], [0, -0.02]], [0, 0.32, 0.03], { seg: 14, shadow: 'receive' });
  l.ball(SG.lampWarm, [0, 0.32, 0.03], 0.03, { kind: 'glow', seg: 8, shadow: 'receive' });
}

/** 放熱器（縦のひれの並び・上下の管・脚・弁）。幅 w、壁の面 z = 0 */
export function radiator(p: Prop, w = 0.9, h = 0.6, y0 = 0.15): void {
  const n = Math.max(4, Math.round(w / 0.06));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    p.box(SC.paintPale, [x - 0.022, y0, 0.05], [x + 0.022, y0 + h, 0.13], { r: 0.012, shadow: 'receive' });
  }
  for (const y of [y0 + 0.04, y0 + h - 0.04]) p.rod(SC.paintPale, [-w / 2 - 0.04, y, 0.09], [w / 2 + 0.04, y, 0.09], 0.02, { shadow: 'receive' });
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) p.box(SC.steelDark, [x - 0.012, y0 + h * 0.5, 0], [x + 0.012, y0 + h * 0.5 + 0.03, 0.06], { shadow: 'receive' });
  p.rod(SC.steel, [w / 2 + 0.04, y0 + 0.04, 0.09], [w / 2 + 0.04, 0, 0.09], 0.012, { shadow: 'receive' });
  p.cyl(SC.red, [w / 2 + 0.04, y0 + h + 0.03, 0.09], 0.03, 0.03, { seg: 10, shadow: 'receive' });
}

/** 壁の外套掛け（板・掛け金 4 つ・掛けた上着と鞄）。幅 w、高さ y */
export function coatRail(p: Prop, w = 0.9, y = 1.7): void {
  p.box(SC.wood, [-w / 2, y - 0.06, 0], [w / 2, y + 0.06, 0.025], { r: 0.006 });
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.12 + (i * (w - 0.24)) / 3;
    p.rod(SC.steelDark, [x, y, 0.025], [x, y + 0.04, 0.1], 0.008, { shadow: 'receive' });
    if (i === 0 || i === 2) {
      // 掛けた上着（肩の丸い上と、下へ広がる裾）
      const c = i === 0 ? SC.binder : SC.woodDark;
      p.lathe(c, [[0, -0.02], [0.12, -0.06], [0.17, -0.25], [0.2, -0.85], [0, -0.85]], [x, y + 0.02, 0.12], { seg: 10 });
    }
    if (i === 3) p.box(SC.binder2, [x - 0.14, y - 0.55, 0.04], [x + 0.14, y - 0.2, 0.16], { r: 0.03 });
  }
}

/** 額（細い枠・中の絵は 2 色の面だけ）。中心の高さ y */
export function pictureFrame(p: Prop, y: number, w = 0.5, h = 0.38): void {
  p.box(SC.woodDark, [-w / 2, y - h / 2, 0], [w / 2, y + h / 2, 0.025], { r: 0.004 });
  p.box(SC.paper, [-w / 2 + 0.035, y - h / 2 + 0.035, 0.025], [w / 2 - 0.035, y + h / 2 - 0.035, 0.028], { shadow: 'receive' });
  p.box(SC.paint, [-w / 2 + 0.06, y - h / 2 + 0.06, 0.028], [w / 2 - 0.06, y - 0.02, 0.03], { shadow: 'receive' });
}

/** 木の箱（板の継ぎ目と、角の補強）。幅 w × 高さ h × 奥行き d */
export function crate(p: Prop, w = 0.6, h = 0.4, d = 0.4): void {
  p.box(SC.wood, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], { r: 0.008, collide: true });
  for (let y = h / 3; y < h - 0.02; y += h / 3) p.box(SC.woodDark, [-w / 2 - 0.002, y - 0.006, -d / 2 - 0.002], [w / 2 + 0.002, y + 0.006, d / 2 + 0.002], { shadow: 'receive' });
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) p.box(SC.woodDark, [x - 0.025, 0, d / 2], [x + 0.025, h, d / 2 + 0.01], { shadow: 'receive' });
}

/** 洋服の箪笥（2 枚の扉・取っ手・上の段の小さな扉・脚の台・上の帽子の箱）。幅 w、正面 +z */
export function wardrobe(p: Prop, w = 1.0, h = 1.9, d = 0.56): void {
  const c = SC.woodDark;
  p.box(c, [-w / 2, 0.06, -d / 2], [w / 2, h, d / 2], { r: 0.01, collide: true });
  p.box(SC.rubber, [-w / 2 + 0.03, 0, -d / 2 + 0.03], [w / 2 - 0.03, 0.06, d / 2 - 0.03], { shadow: 'receive' });
  p.box(shade(c, 0.12), [-w / 2 + 0.02, 0.1, d / 2], [-0.006, h - 0.4, d / 2 + 0.015], { r: 0.004, shadow: 'receive' });
  p.box(shade(c, 0.12), [0.006, 0.1, d / 2], [w / 2 - 0.02, h - 0.4, d / 2 + 0.015], { r: 0.004, shadow: 'receive' });
  p.box(shade(c, 0.08), [-w / 2 + 0.02, h - 0.36, d / 2], [w / 2 - 0.02, h - 0.04, d / 2 + 0.015], { r: 0.004, shadow: 'receive' });
  for (const x of [-0.05, 0.05]) p.box(SC.steel, [x - 0.008, 0.95, d / 2 + 0.015], [x + 0.008, 1.15, d / 2 + 0.035], { shadow: 'receive' });
  p.box(SC.binder2, [-w / 2 + 0.1, h, -d / 2 + 0.08], [-0.05, h + 0.22, d / 2 - 0.1], { r: 0.02 });
  p.box(SC.paper, [0.02, h, -d / 2 + 0.1], [w / 2 - 0.12, h + 0.12, d / 2 - 0.12], { r: 0.01 });
}

/** 作業台（厚い木の天板・鉄の脚と下の棚・万力・工具箱・壁の工具掛けの板）。幅 w、正面 +z、壁は z = -d/2 */
export function workbench(p: Prop, w = 1.8, d = 0.7): void {
  const H = 0.88;
  p.box(SC.wood, [-w / 2, H - 0.06, -d / 2], [w / 2, H, d / 2], { r: 0.008, collide: true });
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) p.box(SC.steelDark, [x - 0.03, 0, z - 0.03], [x + 0.03, H - 0.06, z + 0.03]);
  p.box(SC.steel, [-w / 2 + 0.05, 0.18, -d / 2 + 0.05], [w / 2 - 0.05, 0.21, d / 2 - 0.05], { shadow: 'receive' });
  // 下の棚の箱と、天板の万力・工具箱
  p.box(SC.red, [-w / 2 + 0.15, 0.21, -0.2], [-w / 2 + 0.65, 0.45, 0.15], { r: 0.015 });
  p.box(SC.steelDark, [w / 2 - 0.3, H, d / 2 - 0.2], [w / 2 - 0.1, H + 0.12, d / 2 - 0.02], { r: 0.01 });
  p.rod(SC.steel, [w / 2 - 0.2, H + 0.08, d / 2], [w / 2 - 0.2, H + 0.08, d / 2 + 0.15], 0.01, { shadow: 'receive' });
  p.box(SC.red, [-0.3, H, -0.15], [0.15, H + 0.18, 0.1], { r: 0.015 });
  p.box(SC.steelDark, [-0.3, H + 0.18, -0.03], [0.15, H + 0.2, -0.01], { shadow: 'receive' });
  // 壁の工具掛けの板（有孔の板と掛けた工具）
  p.box(SC.paintPale, [-w / 2 + 0.1, H + 0.3, -d / 2], [w / 2 - 0.1, H + 1.1, -d / 2 + 0.02], { shadow: 'receive' });
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.3 + i * ((w - 0.6) / 5);
    p.box(i % 2 ? SC.steelDark : SC.red, [x - 0.02, H + 0.5 + (i % 3) * 0.08, -d / 2 + 0.02], [x + 0.02, H + 0.9, -d / 2 + 0.05], { shadow: 'receive' });
  }
}

/** 角の四角い風道（天井の下を x の向きに長さ L。継ぎ目の帯 1.2 m ごと・吹き出しの格子・吊り金具）。下面の高さ y */
export function duct(p: Prop, L: number, y: number, w = 0.5, h = 0.32): void {
  p.box(SC.steel, [-L / 2, y, -w / 2], [L / 2, y + h, w / 2]);
  for (let x = -L / 2 + 0.6; x < L / 2; x += 1.2) p.box(SC.steelDark, [x - 0.02, y - 0.01, -w / 2 - 0.01], [x + 0.02, y + h + 0.01, w / 2 + 0.01], { shadow: 'receive' });
  for (let x = -L / 2 + 1.5; x < L / 2 - 0.5; x += 2.6) {
    p.box(SC.steelDark, [x - 0.2, y - 0.015, -0.12], [x + 0.2, y, 0.12], { shadow: 'receive' });
    for (let k = 0; k < 5; k++) p.box(SC.rubber, [x - 0.18 + k * 0.08, y - 0.018, -0.1], [x - 0.16 + k * 0.08, y - 0.014, 0.1], { shadow: 'receive' });
  }
  for (let x = -L / 2 + 1.0; x < L / 2; x += 2.0) p.rod(SC.steelDark, [x, y + h, 0], [x, y + h + 0.5, 0], 0.008, { shadow: 'receive', radial: 4 });
}
