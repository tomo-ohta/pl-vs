import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop } from '../../../props/kit.ts';
import { roundRect } from '../../../props/kit.ts';
import { SC, SG } from './mats.ts';

/**
 * ポンプ室の機械（水位を保つ排水ポンプの組・配管・仕切弁・制御盤・水槽）。正面 +z・床 y = 0
 */

/** 横置きの渦巻きポンプの組（共通の台・電動機の冷却のひれ・継手の覆い・渦巻きの胴・吸い込みと吐き出しの管の口） */
export function pumpSet(p: Prop): void {
  const c = SC.paint;
  // 台（コンクリートの基礎と鉄の台枠・据付のボルト）
  p.box(SC.concMid, [-0.95, 0, -0.45], [0.95, 0.18, 0.45], { r: 0.02, collide: true });
  p.box(SC.steelDark, [-0.9, 0.18, -0.3], [0.9, 0.26, 0.3], { r: 0.01 });
  for (const x of [-0.8, 0.8]) for (const z of [-0.22, 0.22]) p.cyl(SC.steel, [x, 0.28, z], 0.018, 0.04, { seg: 6, shadow: 'receive' });
  // 電動機（円筒の胴に冷却のひれ・端の覆い・端子箱）
  p.cyl(c, [-0.45, 0.55, 0], 0.26, 0.7, { axis: 'x', seg: 20 });
  for (let i = 0; i < 9; i++) p.cyl(c, [-0.72 + i * 0.065, 0.55, 0], 0.285, 0.018, { axis: 'x', seg: 20, shadow: 'receive' });
  p.lathe(SC.paintPale, [[0, 0], [0.24, 0], [0.26, 0.05], [0.2, 0.1], [0, 0.1]], [-0.8, 0.55, 0], { axis: 'x', seg: 18 });
  p.box(SC.steelDark, [-0.55, 0.8, -0.1], [-0.35, 0.95, 0.1], { r: 0.01 });
  p.box(SC.steel, [-0.52, 0.7, -0.17], [-0.38, 0.8, 0.17], { r: 0.01 });
  // 足（電動機を台へ）
  for (const x of [-0.65, -0.25]) p.box(c, [x - 0.06, 0.26, -0.22], [x + 0.06, 0.4, 0.22], { r: 0.008 });
  // 継手の覆い（黄色い網の箱）
  p.box(SC.yellow, [-0.08, 0.38, -0.16], [0.18, 0.72, 0.16], { r: 0.015 });
  for (let i = 0; i < 4; i++) p.box(SC.steelDark, [-0.07 + i * 0.07, 0.4, 0.16], [-0.05 + i * 0.07, 0.7, 0.165], { shadow: 'receive' });
  // 渦巻きの胴（輪の形の胴を横向きに）と、吐き出しの口（上）・吸い込みの口（前）
  p.cyl(c, [0.48, 0.58, 0], 0.32, 0.26, { axis: 'x', seg: 24 });
  p.torus(c, [0.48, 0.58, 0], 0.29, 0.07, { axis: 'x', seg: 24 });
  p.cyl(c, [0.48, 1.0, 0], 0.11, 0.3, { seg: 16 });
  p.cyl(SC.steel, [0.48, 1.16, 0], 0.17, 0.03, { seg: 16 });
  p.cyl(c, [0.75, 0.58, 0], 0.13, 0.25, { axis: 'x', seg: 16 });
  p.cyl(SC.steel, [0.88, 0.58, 0], 0.19, 0.03, { axis: 'x', seg: 16 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.cyl(SC.steelDark, [0.9, 0.58 + Math.sin(a) * 0.16, Math.cos(a) * 0.16], 0.014, 0.03, { axis: 'x', seg: 6, shadow: 'receive' });
  }
  // 名板
  p.box(SC.white, [0.38, 0.62, 0.32], [0.56, 0.72, 0.335], { shadow: 'receive' });
}

/** 配管（折れ線の管・継ぎ目のフランジ・壁への支持の帯）。pts は局所の点 */
export function pipeRun(p: Prop, pts: V3[], r = 0.11, color: string = SC.paint): void {
  p.tube(color, pts, r, { sharp: true });
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.floor(len / 1.8);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const c: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const ax = Math.abs(b[0] - a[0]) > 0.5 ? 'x' : Math.abs(b[1] - a[1]) > 0.5 ? 'y' : 'z';
      p.cyl(SC.steel, c, r * 1.45, 0.04, { axis: ax, seg: 14, shadow: 'receive' });
      for (let j = 0; j < 6; j++) {
        const an = (j / 6) * Math.PI * 2;
        const o = r * 1.25;
        const off: V3 = ax === 'x' ? [0, Math.cos(an) * o, Math.sin(an) * o] : ax === 'y' ? [Math.cos(an) * o, 0, Math.sin(an) * o] : [Math.cos(an) * o, Math.sin(an) * o, 0];
        p.cyl(SC.steelDark, [c[0] + off[0], c[1] + off[1], c[2] + off[2]], 0.012, 0.06, { axis: ax, seg: 6, shadow: 'receive' });
      }
    }
  }
}

/** 仕切弁（弁の胴・ボンネット・ねじ棒・ハンドル車。管の上に立つ）。管の軸は x */
export function gateValve(p: Prop, r = 0.11): void {
  p.cyl(SC.paint, [0, 0, 0], r * 1.6, 0.3, { axis: 'x', seg: 18 });
  for (const x of [-0.16, 0.16]) p.cyl(SC.steel, [x, 0, 0], r * 1.7, 0.035, { axis: 'x', seg: 18, shadow: 'receive' });
  p.box(SC.paint, [-0.1, 0.1, -0.08], [0.1, 0.42, 0.08], { r: 0.03 });
  p.rod(SC.steel, [0, 0.42, 0], [0, 0.62, 0], 0.016);
  p.torus(SC.red, [0, 0.6, 0], 0.16, 0.014, { axis: 'y', seg: 22 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    p.rod(SC.red, [0, 0.6, 0], [Math.cos(a) * 0.16, 0.6, Math.sin(a) * 0.16], 0.01, { shadow: 'receive' });
  }
}

/** 制御盤（自立の鉄の箱・扉の継ぎ目・計器・表示灯・切替のつまみ・名札・足の台） */
export function controlPanel(p: Prop, w = 1.2): void {
  const h = 1.9;
  const d = 0.45;
  p.box(SC.concMid, [-w / 2 - 0.03, 0, -d / 2 - 0.03], [w / 2 + 0.03, 0.08, d / 2 + 0.03], { r: 0.01 });
  p.box(SC.paintPale, [-w / 2, 0.08, -d / 2], [w / 2, h, d / 2], { r: 0.015, collide: true });
  p.box(SC.paint, [-w / 2 - 0.02, h, -d / 2 - 0.02], [w / 2 + 0.02, h + 0.05, d / 2 + 0.02], { r: 0.01 });
  // 扉 2 枚の継ぎ目と取っ手
  p.box(SC.steelDark, [-0.006, 0.12, d / 2], [0.006, h - 0.05, d / 2 + 0.004], { shadow: 'receive' });
  for (const x of [-0.08, 0.08]) p.box(SC.steel, [x - 0.015, 0.95, d / 2], [x + 0.015, 1.15, d / 2 + 0.03], { r: 0.006, shadow: 'receive' });
  // 計器（丸い窓 3 つ）・表示灯・つまみ
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.2 + i * 0.18;
    p.cyl(SC.steelDark, [x, 1.55, d / 2 + 0.01], 0.07, 0.02, { axis: 'z', seg: 16, shadow: 'receive' });
    p.cyl(SC.white, [x, 1.55, d / 2 + 0.022], 0.058, 0.004, { axis: 'z', seg: 16, shadow: 'receive' });
    p.box(SC.steelDark, [x - 0.003, 1.55, d / 2 + 0.026], [x + 0.003, 1.6, d / 2 + 0.028], { shadow: 'receive' });
  }
  const lamps = [SG.green, SG.amber, SG.red, SG.green];
  lamps.forEach((c, i) => p.cyl(c, [0.12 + i * 0.1, 1.55, d / 2 + 0.015], 0.022, 0.03, { axis: 'z', seg: 10, kind: 'glow', shadow: 'receive' }));
  for (let i = 0; i < 4; i++) p.cyl(SC.steelDark, [0.12 + i * 0.1, 1.4, d / 2 + 0.02], 0.025, 0.04, { axis: 'z', seg: 10, shadow: 'receive' });
  p.box(SC.white, [-w / 2 + 0.1, 1.75, d / 2], [w / 2 - 0.1, 1.82, d / 2 + 0.004], { shadow: 'receive' });
  // 換気の羽根（下）
  for (let i = 0; i < 6; i++) p.box(SC.steelDark, [-w / 2 + 0.1, 0.25 + i * 0.04, d / 2], [-0.05, 0.265 + i * 0.04, d / 2 + 0.01], { shadow: 'receive' });
}

/** 立てた水槽（円筒の胴・帯・上の点検口・はしご・液面計の管・脚） */
export function waterTank(p: Prop, r = 0.8, h = 2.2): void {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    p.box(SC.steelDark, [Math.cos(a) * r * 0.7 - 0.05, 0, Math.sin(a) * r * 0.7 - 0.05], [Math.cos(a) * r * 0.7 + 0.05, 0.3, Math.sin(a) * r * 0.7 + 0.05], { r: 0.008 });
  }
  p.lathe(SC.paintPale, [[0, 0.3], [r, 0.3], [r, 0.3 + h], [r * 0.6, 0.3 + h + 0.12], [0, 0.3 + h + 0.14]], [0, 0, 0], { seg: 28, collide: true });
  for (const y of [0.3 + h * 0.33, 0.3 + h * 0.66]) p.torus(SC.paint, [0, y, 0], r + 0.01, 0.02, { axis: 'y', seg: 30, radial: 6, shadow: 'receive' });
  p.cyl(SC.steel, [0, 0.3 + h + 0.15, 0], 0.22, 0.06, { seg: 16 });
  // はしご（正面）
  for (const x of [-0.18, 0.18]) p.rod(SC.steel, [x, 0.3, r + 0.12], [x, 0.3 + h + 0.4, r + 0.12], 0.016);
  for (let y = 0.5; y < 0.3 + h + 0.3; y += 0.3) p.rod(SC.steel, [-0.18, y, r + 0.12], [0.18, y, r + 0.12], 0.012);
  // 液面計の管
  p.rod(SC.glass, [r * 0.7, 0.45, r * 0.72], [r * 0.7, 0.3 + h - 0.1, r * 0.72], 0.02, { kind: 'glass' });
  p.sub([0, 1.5, 0]).extrude(SC.white, roundRect(0, 0, 0.3, 0.12, 0.01), 'xy', r + 0.005, r + 0.012, { shadow: 'receive' });
}

/** 圧力計の板（壁の板・3 つの丸い計器・細い管・止め弁）。中心の高さ y。壁の面 z = 0 */
export function gaugeBoard(p: Prop, y = 1.5, w = 0.9): void {
  p.box(SC.paintPale, [-w / 2, y - 0.3, 0], [w / 2, y + 0.3, 0.03], { r: 0.006 });
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.17 + i * ((w - 0.34) / 2);
    p.cyl(SC.steelDark, [x, y + 0.06, 0.06], 0.085, 0.05, { axis: 'z', seg: 18 });
    p.cyl(SC.white, [x, y + 0.06, 0.086], 0.072, 0.004, { axis: 'z', seg: 18, shadow: 'receive' });
    p.box(SC.red, [x - 0.003, y + 0.06, 0.089], [x + 0.003, y + 0.12, 0.091], { shadow: 'receive' });
    p.rod(SC.steel, [x, y - 0.03, 0.06], [x, y - 0.3, 0.06], 0.008, { shadow: 'receive', radial: 5 });
    p.cyl(SC.red, [x, y - 0.18, 0.06], 0.025, 0.012, { axis: 'z', seg: 8, shadow: 'receive' });
  }
}

/** 電線の受け皿（はしご形の縁 2 本・桟・中の電線の束）。x の向きに長さ L、高さ y、壁から 0.2 m */
export function cableTray(p: Prop, L: number, y: number): void {
  const z0 = 0.05;
  const z1 = 0.4;
  for (const z of [z0, z1]) p.box(SC.steel, [-L / 2, y, z - 0.008], [L / 2, y + 0.08, z + 0.008], { shadow: 'receive' });
  for (let x = -L / 2 + 0.15; x < L / 2; x += 0.3) p.box(SC.steelDark, [x - 0.012, y, z0], [x + 0.012, y + 0.012, z1], { shadow: 'receive' });
  for (let k = 0; k < 4; k++) p.rod(k % 2 ? SC.rubber : SC.steelDark, [-L / 2, y + 0.03, z0 + 0.06 + k * 0.07], [L / 2, y + 0.03, z0 + 0.06 + k * 0.07], 0.018, { shadow: 'receive', radial: 6 });
  for (let x = -L / 2 + 0.6; x < L / 2; x += 1.5) p.box(SC.steelDark, [x - 0.015, y - 0.04, 0], [x + 0.015, y, z1 + 0.02], { shadow: 'receive' });
}

/** 吊り上げの梁（I 形の鋼の梁・走る台車・鎖の巻き上げ機と鉤）。x の向きに長さ L、梁の下面の高さ y */
export function hoistBeam(p: Prop, L: number, y: number, at = 0): void {
  p.box(SC.yellow, [-L / 2, y, -0.08], [L / 2, y + 0.02, 0.08], { shadow: 'receive' });
  p.box(SC.yellow, [-L / 2, y + 0.02, -0.01], [L / 2, y + 0.28, 0.01]);
  p.box(SC.yellow, [-L / 2, y + 0.28, -0.08], [L / 2, y + 0.3, 0.08], { shadow: 'receive' });
  const q = p.sub([at, y, 0]);
  q.box(SC.steelDark, [-0.14, -0.12, -0.12], [0.14, 0.0, 0.12], { r: 0.01 });
  q.box(SC.paint, [-0.12, -0.42, -0.1], [0.12, -0.12, 0.1], { r: 0.02 });
  q.rod(SC.steelDark, [0.04, -0.42, 0], [0.04, -1.5, 0], 0.012, { radial: 5, shadow: 'receive' });
  q.rod(SC.steelDark, [-0.06, -0.42, 0.02], [-0.06, -1.1, 0.02], 0.01, { radial: 5, shadow: 'receive' });
  q.box(SC.yellow, [-0.05, -1.62, -0.04], [0.13, -1.5, 0.04], { r: 0.01 });
  q.torus(SC.steelDark, [0.04, -1.7, 0], 0.05, 0.012, { axis: 'z', seg: 12, arc: Math.PI * 1.4, shadow: 'receive' });
}
