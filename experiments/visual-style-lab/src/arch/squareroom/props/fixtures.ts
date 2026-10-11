import type { Prop } from '../../../props/kit.ts';
import { roundRect, shade } from '../../../props/kit.ts';
import { SC, SG } from './mats.ts';

/**
 * 建物の設備の小物（正面 +z・床 y = 0。壁に付ける物は壁の面 z = 0 から +z へ出る）。
 * 壁の腕木の灯り・鉄の扉・パイプの手すり・コンクリートの長椅子・天井の吊り灯・壁の小窓の格子
 */

/** 壁の腕木の灯り（座板・腕・笠・籠の格子・光る球）。y は器具の中心の高さ */
export function wallLamp(p: Prop, y = 2.4): void {
  const q = p.sub([0, y, 0]);
  q.box(SC.steelDark, [-0.07, -0.11, 0], [0.07, 0.11, 0.025], { r: 0.008, shadow: 'receive' });
  q.tube(SC.steelDark, [[0, 0.05, 0.02], [0, 0.07, 0.16], [0, 0.0, 0.26]], 0.012, { shadow: 'receive' });
  // 笠（円錐台）と、光る球、籠の格子 4 本
  q.lathe(SC.paint, [[0, 0.04], [0.06, 0.03], [0.12, -0.04], [0.125, -0.05], [0.0, -0.05]], [0, -0.0, 0.26], { seg: 16, shadow: 'receive' });
  q.ball(SG.lamp, [0, -0.09, 0.26], 0.05, { kind: 'glow', seg: 10, shadow: 'receive' });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    q.tube(SC.steelDark, [[Math.cos(a) * 0.1, -0.05, 0.26 + Math.sin(a) * 0.1], [Math.cos(a) * 0.06, -0.15, 0.26 + Math.sin(a) * 0.06], [0, -0.17, 0.26]], 0.004, { shadow: 'receive' });
  }
}

/** 鉄の扉（枠・扉の板・縦の補強・取っ手・蝶番・下の換気の羽根）。w × h、壁の面 z = 0 に付く */
export function steelDoor(p: Prop, w = 1.0, h = 2.2, color: string = SC.paint): void {
  const fw = 0.06;
  // 枠（壁から少し出る）
  p.box(SC.steelDark, [-w / 2 - fw, 0, 0], [-w / 2, h + fw, 0.05], { shadow: 'receive' });
  p.box(SC.steelDark, [w / 2, 0, 0], [w / 2 + fw, h + fw, 0.05], { shadow: 'receive' });
  p.box(SC.steelDark, [-w / 2 - fw, h, 0], [w / 2 + fw, h + fw, 0.05], { shadow: 'receive' });
  // 扉の板（少し奥まる）
  p.box(color, [-w / 2, 0.01, -0.02], [w / 2, h, 0.025], { r: 0.008, collide: true });
  // 補強の縦桟と、錆の垂れ（下の方の暗い帯）
  for (const x of [-w / 4, w / 4]) p.box(color, [x - 0.03, 0.05, 0.025], [x + 0.03, h - 0.05, 0.04], { r: 0.005, shadow: 'receive' });
  p.box(SC.rustDark, [-w / 2 + 0.02, 0.01, 0.026], [w / 2 - 0.02, 0.18, 0.03], { shadow: 'receive' });
  // 換気の羽根（下の方）
  for (let i = 0; i < 5; i++) {
    const yy = 0.32 + i * 0.05;
    p.box(SC.steelDark, [-w * 0.3, yy, 0.03], [w * 0.3, yy + 0.02, 0.05], { shadow: 'receive' });
  }
  // 取っ手（レバー）と蝶番
  p.box(SC.steel, [w / 2 - 0.16, 1.0, 0.03], [w / 2 - 0.12, 1.12, 0.06], { r: 0.008, shadow: 'receive' });
  p.rod(SC.steel, [w / 2 - 0.14, 1.06, 0.06], [w / 2 - 0.3, 1.06, 0.08], 0.012, { shadow: 'receive' });
  for (const yy of [0.25, h - 0.3]) p.cyl(SC.steelDark, [-w / 2 + 0.01, yy, 0.03], 0.018, 0.14, { seg: 8, shadow: 'receive' });
}

/** パイプの手すり（支柱を間隔 1.5 m、上と中の 2 本の手すり）。x の向きに長さ L */
export function pipeRailing(p: Prop, L: number, h = 1.1): void {
  const n = Math.max(1, Math.round(L / 1.5));
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + (i * L) / n;
    p.rod(SC.steel, [x, 0, 0], [x, h, 0], 0.022);
    p.cyl(SC.steelDark, [x, 0.01, 0], 0.045, 0.02, { seg: 10, shadow: 'receive' });
  }
  p.rod(SC.steel, [-L / 2, h, 0], [L / 2, h, 0], 0.025);
  p.rod(SC.steel, [-L / 2, h * 0.5, 0], [L / 2, h * 0.5, 0], 0.018);
}

/** コンクリートの長椅子（打ち放しの板を 2 つの台で受ける。板の面取り・型枠の継ぎ目） */
export function concreteBench(p: Prop, L = 2.4): void {
  p.box(SC.conc, [-L / 2, 0.38, -0.24], [L / 2, 0.46, 0.24], { r: 0.015, collide: true });
  for (const x of [-L / 2 + 0.35, L / 2 - 0.35]) p.box(SC.concMid, [x - 0.12, 0, -0.2], [x + 0.12, 0.38, 0.2], { r: 0.01 });
  p.box(SC.concDark, [-0.005, 0.45, -0.24], [0.005, 0.462, 0.24], { shadow: 'receive' });
}

/** 天井の吊り灯（工場の笠。コード・笠・光る球）。y は天井の高さ */
export function pendantLamp(p: Prop, ceil: number, drop = 0.9): void {
  p.rod(SC.steelDark, [0, ceil, 0], [0, ceil - drop, 0], 0.006, { shadow: 'receive' });
  p.cyl(SC.steelDark, [0, ceil - 0.01, 0], 0.05, 0.02, { seg: 10, shadow: 'receive' });
  const q = p.sub([0, ceil - drop, 0]);
  q.lathe(SC.paint, [[0, 0.03], [0.04, 0.03], [0.07, -0.04], [0.2, -0.13], [0.21, -0.15], [0, -0.15]], [0, 0, 0], { seg: 20, shadow: 'receive' });
  q.ball(SG.lampWarm, [0, -0.12, 0], 0.055, { kind: 'glow', seg: 10, shadow: 'receive' });
}

/** 壁の小さな換気口（格子の羽根。壁の面 z = 0） */
export function wallVent(p: Prop, w = 0.45, h = 0.3): void {
  p.extrude(SC.steelDark, roundRect(0, 0, w + 0.06, h + 0.06, 0.01), 'xy', 0, 0.03, { shadow: 'receive' });
  for (let i = 0; i < 5; i++) {
    const y = -h / 2 + ((i + 0.5) * h) / 5;
    p.sub([0, y, 0.03], 0, { pitch: 0.5 }).box(SC.steel, [-w / 2, -0.02, -0.01], [w / 2, 0.02, 0.01], { shadow: 'receive' });
  }
}

/** 消火栓の箱（赤い扉・ガラスの小窓・中のホースの巻き・表示灯）。下端 y0。壁の面 z = 0 */
export function hoseCabinet(p: Prop, y0 = 0.9): void {
  const w = 0.6;
  const h = 0.8;
  p.box(SC.red, [-w / 2, y0, 0], [w / 2, y0 + h, 0.18], { r: 0.01 });
  p.box(SC.steelDark, [-w / 2 + 0.06, y0 + 0.22, 0.18], [w / 2 - 0.06, y0 + h - 0.08, 0.184], { shadow: 'receive' });
  p.box(SC.glass, [-w / 2 + 0.08, y0 + 0.24, 0.184], [w / 2 - 0.08, y0 + h - 0.1, 0.188], { shadow: 'receive' });
  p.torus(SC.white, [0, y0 + 0.47, 0.12], 0.14, 0.035, { axis: 'z', seg: 18, radial: 6, shadow: 'receive' });
  p.box(SC.steel, [w / 2 - 0.05, y0 + 0.35, 0.18], [w / 2 - 0.03, y0 + 0.5, 0.21], { shadow: 'receive' });
  p.cyl(SG.red, [0, y0 + h + 0.1, 0.04], 0.04, 0.05, { axis: 'z', seg: 12, kind: 'glow', shadow: 'receive' });
}

/** 屋上の空調の室外機（箱・前の丸い羽根の格子・横の放熱の羽根・台）。正面 +z */
export function rooftopUnit(p: Prop, w = 1.0, h = 0.8, d = 0.45): void {
  p.box(SC.concMid, [-w / 2 - 0.05, 0, -d / 2 - 0.05], [w / 2 + 0.05, 0.12, d / 2 + 0.05], { r: 0.01 });
  p.box(SC.paint, [-w / 2, 0.12, -d / 2], [w / 2, 0.12 + h, d / 2], { r: 0.015, collide: true });
  p.cyl(SC.steelDark, [-w * 0.15, 0.12 + h / 2, d / 2 + 0.005], h * 0.36, 0.02, { axis: 'z', seg: 22 });
  for (let i = 0; i < 5; i++) p.torus(SC.steel, [-w * 0.15, 0.12 + h / 2, d / 2 + 0.02], h * 0.07 * (i + 1), 0.005, { axis: 'z', seg: 20, radial: 3, shadow: 'receive' });
  for (let i = 0; i < 7; i++) p.box(shade(SC.paint, -0.2), [w / 2 - 0.3, 0.2 + i * 0.09, d / 2], [w / 2 - 0.05, 0.22 + i * 0.09, d / 2 + 0.01], { shadow: 'receive' });
  p.rod(SC.steel, [w / 2, 0.3, -0.1], [w / 2 + 0.3, 0.3, -0.1], 0.02, { shadow: 'receive' });
}

/** 屋上の換気の筒（管・雨よけの笠）。高さ h */
export function ventStack(p: Prop, h = 1.6, r = 0.12): void {
  p.cyl(SC.steel, [0, h / 2, 0], r, h, { seg: 12 });
  p.cyl(SC.steelDark, [0, 0.05, 0], r * 1.6, 0.1, { seg: 12 });
  p.lathe(SC.steel, [[0, h + 0.25], [r * 2.2, h + 0.08], [r * 2.2, h + 0.04], [0, h + 0.04]], [0, 0, 0], { seg: 14 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    p.rod(SC.steelDark, [Math.cos(a) * r, h, Math.sin(a) * r], [Math.cos(a) * r * 1.8, h + 0.08, Math.sin(a) * r * 1.8], 0.008, { shadow: 'receive' });
  }
}

/**
 * 打ち放しの植え込みの箱: 壁 4 枚（厚さ 8 cm）と奥まった台座・上の笠木（3 cm 張り出す）・中の暗い土・前の面の水抜きの口と、
 * その下へ垂れる染み・笠木の下から垂れる染み（色は造りに従う）。長さ L（x）。中に植える物は場所が決める（土の上面 y = h - 0.12）
 */
export function planterTrough(p: Prop, L = 2.4, d = 0.6, h = 0.55): void {
  const c = SC.concMid;
  const t = 0.08;
  const st = shade(c, -0.22);
  p.box(SC.concDark, [-L / 2 + 0.04, 0, -d / 2 + 0.04], [L / 2 - 0.04, 0.06, d / 2 - 0.04], { shadow: 'receive' });
  p.box(c, [-L / 2, 0.06, d / 2 - t], [L / 2, h - 0.06, d / 2], { r: 0.008, collide: true });
  p.box(c, [-L / 2, 0.06, -d / 2], [L / 2, h - 0.06, -d / 2 + t], { r: 0.008 });
  p.box(c, [-L / 2, 0.06, -d / 2 + t], [-L / 2 + t, h - 0.06, d / 2 - t]);
  p.box(c, [L / 2 - t, 0.06, -d / 2 + t], [L / 2, h - 0.06, d / 2 - t]);
  // 笠木（4 本。外へ 3 cm 張り出す）
  const o = 0.03;
  p.box(SC.conc, [-L / 2 - o, h - 0.06, d / 2 - t - 0.01], [L / 2 + o, h, d / 2 + o], { r: 0.008 });
  p.box(SC.conc, [-L / 2 - o, h - 0.06, -d / 2 - o], [L / 2 + o, h, -d / 2 + t + 0.01], { r: 0.008 });
  p.box(SC.conc, [-L / 2 - o, h - 0.06, -d / 2 + t], [-L / 2 + t + 0.01, h, d / 2 - t], { r: 0.008 });
  p.box(SC.conc, [L / 2 - t - 0.01, h - 0.06, -d / 2 + t], [L / 2 + o, h, d / 2 - t], { r: 0.008 });
  // 土（暗い。笠木より 12 cm 下）
  p.box(SC.soil, [-L / 2 + t, h - 0.16, -d / 2 + t], [L / 2 - t, h - 0.12, d / 2 - t], { shadow: 'receive' });
  // 前の面の水抜きの口と、その下の染み・笠木の下から垂れる染み
  for (const x of [-L / 3, L / 3]) {
    p.box(SC.rubber, [x - 0.05, 0.16, d / 2 - 0.004], [x + 0.05, 0.2, d / 2 + 0.002], { shadow: 'receive' });
    p.box(st, [x - 0.035, 0.06, d / 2 + 0.001], [x + 0.035, 0.16, d / 2 + 0.003], { shadow: 'receive' });
  }
  for (let i = 0; i < Math.round(L * 2); i++) {
    const x = -L / 2 + 0.12 + p.r() * (L - 0.24);
    const len = 0.08 + p.r() * 0.22;
    p.box(st, [x - 0.02 - p.r() * 0.03, h - 0.06 - len, d / 2 + 0.001], [x + 0.02, h - 0.06, d / 2 + 0.003], { shadow: 'receive' });
  }
}

/** 天井の蛍光灯（鉄の箱・光る管 2 本・吊りの棒）。x の向きに長さ L、器具の上面の高さ y（天井から rod だけ下がる） */
export function tubeLight(p: Prop, L: number, y: number, rod = 0.3): void {
  p.box(SC.paintPale, [-L / 2, y - 0.07, -0.09], [L / 2, y, 0.09], { r: 0.01 });
  for (const z of [-0.045, 0.045]) p.rod(SG.lamp, [-L / 2 + 0.06, y - 0.085, z], [L / 2 - 0.06, y - 0.085, z], 0.016, { kind: 'glow', shadow: false, radial: 6 });
  for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) p.rod(SC.steelDark, [x, y, 0], [x, y + rod, 0], 0.006, { shadow: 'receive', radial: 4 });
}
