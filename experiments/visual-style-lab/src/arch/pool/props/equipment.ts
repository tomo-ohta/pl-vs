import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop, V2 } from '../../../props/kit.ts';
import { chair } from '../../../props/lib/index.ts';
import { PC, PG } from './mats.ts';
import { bend, R1 } from './shape.ts';

/**
 * 機械室と倉庫の設備（ろ過装置・ポンプ・制御盤・薬品の槽・熱交換器・コースロープの巻き取り台・プールの掃除機・重ねた椅子・
 * 採暖室の柵）。正面 +z、床 y = 0。
 * 寸法の根拠: 砂ろ過の圧力槽 φ1.5〜2.6 m・胴 2 m 前後（鏡板・脚 4 本・上と前の点検口・前の管と仕切り弁・圧力計）。
 * 片吸込みの渦巻きポンプ（台・電動機の冷却のひれ・継ぎ手の覆い・渦巻きの胴・端の吸込み・上の吐出し）。
 * 制御盤 幅 0.8〜1.0 m・高さ 2 m・奥行き 0.4 m（扉 2 枚・計器・表示灯・切替えのつまみ・下の通気）。
 * 薬品の槽 500 L（φ0.8 m・高さ 1.2 m・受け皿・上の注入ポンプ）。コースロープの巻き取り台 幅 1.7 m（端の輪 φ1 m・キャスター）
 */

const FLANGE = (p: Prop, c: V3, r: number, axis: 'x' | 'y' | 'z'): void => p.cyl(PC.tealDark, c, r * 1.45, 0.025, { axis, seg: 12 });

/** 仕切り弁（胴・ふた・軸・ハンドルの輪）。管は axis の向き、ハンドルは上 */
function gateValve(p: Prop, c: V3, r: number, axis: 'x' | 'z'): void {
  p.box(PC.tealDark, [c[0] - r * 1.1, c[1] - r * 1.2, c[2] - r * 1.1], [c[0] + r * 1.1, c[1] + r * 1.2, c[2] + r * 1.1], R1(r * 0.3));
  FLANGE(p, [c[0] + (axis === 'x' ? r * 1.2 : 0), c[1], c[2] + (axis === 'z' ? r * 1.2 : 0)], r, axis);
  FLANGE(p, [c[0] - (axis === 'x' ? r * 1.2 : 0), c[1], c[2] - (axis === 'z' ? r * 1.2 : 0)], r, axis);
  p.cyl(PC.tealDark, [c[0], c[1] + r * 1.7, c[2]], r * 0.55, r * 1.2, { seg: 10 });
  p.rod(PC.steel, [c[0], c[1] + r * 2.2, c[2]], [c[0], c[1] + r * 3.2, c[2]], 0.012, { radial: 4 });
  p.torus(PC.red, [c[0], c[1] + r * 3.0, c[2]], r * 1.3, 0.012, { axis: 'y', seg: 16 });
  p.rod(PC.red, [c[0] - r * 1.3, c[1] + r * 3.0, c[2]], [c[0] + r * 1.3, c[1] + r * 3.0, c[2]], 0.008, { radial: 4 });
}

/** 圧力計（白い文字盤・縁・針）。face = 文字盤の向き */
function gauge(p: Prop, c: V3, r = 0.05): void {
  p.cyl(PC.ink, c, r + 0.008, 0.03, { axis: 'z', seg: 14 });
  p.cyl(PC.white, [c[0], c[1], c[2] + 0.016], r, 0.004, { axis: 'z', seg: 14, shadow: false });
  p.sub([c[0], c[1], c[2] + 0.019], 0, { roll: -0.7 }).box(PC.red, [-0.003, 0, 0], [0.003, r * 0.8, 0.002], { shadow: false });
}

/** 砂ろ過の圧力槽（鏡板の胴・継ぎ目の帯・脚・上と前の点検口・前の管と仕切り弁・圧力計・銘板・上の管の口）。R = 半径、h = 胴の高さ */
export function filterTank(p: Prop, R = 0.9, h = 2.4): void {
  const y0 = 0.42;
  const dish = R * 0.3;
  const prof: V2[] = [[0, y0], [R * 0.5, y0 + dish * 0.12], [R * 0.82, y0 + dish * 0.45], [R * 0.97, y0 + dish * 0.85], [R, y0 + dish], [R, y0 + h - dish], [R * 0.97, y0 + h - dish * 0.85], [R * 0.82, y0 + h - dish * 0.45], [R * 0.5, y0 + h - dish * 0.12], [0, y0 + h]];
  p.lathe(PC.blue, prof, [0, 0, 0], { seg: 32 });
  for (const y of [y0 + dish, y0 + h - dish]) p.torus(PC.tealDark, [0, y, 0], R + 0.004, 0.012, { axis: 'y', seg: 32 });
  p.torus(PC.tealDark, [0, y0 + h * 0.5, 0], R + 0.02, 0.03, { axis: 'y', seg: 32 });
  // 脚（山形鋼）と足の板
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const x = Math.cos(a) * R * 0.78;
    const z = Math.sin(a) * R * 0.78;
    p.box(PC.steel, [x - 0.05, 0, z - 0.05], [x + 0.05, y0 + dish * 0.5, z + 0.05]);
    p.box(PC.steel, [x - 0.1, 0, z - 0.1], [x + 0.1, 0.02, z + 0.1], { shadow: 'receive' });
  }
  // 上の点検口と管の口（天井の管へつなぐ）
  const top = y0 + h;
  p.cyl(PC.blue, [0, top + 0.06, 0], 0.24, 0.16, { seg: 18 });
  p.cyl(PC.tealDark, [0, top + 0.15, 0], 0.3, 0.04, { seg: 18 });
  for (let k = 0; k < 8; k++) p.ball(PC.steel, [Math.cos((k / 8) * Math.PI * 2) * 0.27, top + 0.18, Math.sin((k / 8) * Math.PI * 2) * 0.27], 0.015, { seg: 5, shadow: false });
  p.cyl(PC.white, [0, top + 0.4, 0], 0.1, 0.5, { seg: 12 });
  // 前の点検口（下の側）
  p.cyl(PC.blue, [0, y0 + 0.75, R - 0.02], 0.22, 0.16, { axis: 'z', seg: 18 });
  p.cyl(PC.tealDark, [0, y0 + 0.75, R + 0.07], 0.27, 0.04, { axis: 'z', seg: 18 });
  p.box(PC.steel, [-0.12, y0 + 0.73, R + 0.09], [0.12, y0 + 0.77, R + 0.13], R1(0.01));
  // 前の管（入口と出口）と仕切り弁・圧力計
  for (const [y, x] of [[y0 + h - 0.45, -R * 0.45], [y0 + 0.45, R * 0.45]] as [number, number][]) {
    const z0 = Math.sqrt(Math.max(R * R - x * x, 0)) - 0.05;
    p.cyl(PC.white, [x, y, z0 + 0.25], 0.1, 0.5, { axis: 'z', seg: 12 });
    FLANGE(p, [x, y, z0 + 0.05], 0.1, 'z');
    gateValve(p, [x, y, z0 + 0.38], 0.1, 'z');
    gauge(p, [x + 0.22, y + 0.2, z0 + 0.02]);
    p.rod(PC.steel, [x + 0.22, y + 0.2, z0], [x + 0.1, y, z0 + 0.2], 0.008, { radial: 4 });
  }
  // 銘板と覗き窓
  p.box(PC.white, [R * 0.25, y0 + 1.15, R - 0.02], [R * 0.25 + 0.36, y0 + 1.4, R + 0.004], { shadow: false });
  p.cyl(PC.ink, [-R * 0.3, y0 + 1.3, Math.sqrt(R * R - (R * 0.3) ** 2) - 0.01], 0.06, 0.04, { axis: 'z', seg: 12 });
  p.collide([-R, 0, -R], [R, top + 0.2, R + 0.15]);
}

/** 片吸込みの渦巻きポンプ（台と鉄の枠・電動機と冷却のひれ・ファンの覆い・端子の箱・継ぎ手の覆い・渦巻きの胴・端の吸込みの管・上の吐出しの管） */
export function pump(p: Prop): void {
  p.box(PC.pale, [-0.78, 0, -0.42], [0.78, 0.08, 0.42], R1(0.01));
  p.box(PC.dark, [-0.7, 0.08, -0.3], [0.7, 0.16, 0.3]);
  const ay = 0.44;
  // 電動機（x -0.62〜-0.05）: ひれのある胴・ファンの覆い・足・端子の箱
  const fins: V2[] = [[0, 0], [0.16, 0], [0.19, 0.02]];
  for (let k = 0; k < 10; k++) fins.push([0.2, 0.04 + k * 0.045], [0.215, 0.055 + k * 0.045], [0.2, 0.07 + k * 0.045]);
  fins.push([0.19, 0.5], [0.14, 0.53], [0, 0.53]);
  p.lathe(PC.teal, fins, [-0.6, ay, 0], { axis: 'x', seg: 18 });
  p.lathe(PC.teal, [[0, 0], [0.19, 0], [0.2, 0.06], [0.18, 0.1], [0, 0.11]], [-0.71, ay, 0], { axis: 'x', seg: 18 });
  p.cyl(PC.ink, [-0.715, ay, 0], 0.15, 0.004, { axis: 'x', seg: 18, shadow: false });
  for (const sz of [-1, 1]) p.box(PC.teal, [-0.55, 0.16, sz * 0.14 - 0.04], [-0.12, ay - 0.12, sz * 0.14 + 0.04]);
  p.box(PC.teal, [-0.42, ay + 0.18, -0.09], [-0.24, ay + 0.3, 0.09], R1(0.01));
  p.cyl(PC.ink, [-0.33, ay + 0.24, 0.11], 0.02, 0.04, { axis: 'z', seg: 8 });
  p.box(PC.white, [-0.4, ay - 0.05, 0.205], [-0.28, ay + 0.03, 0.21], { shadow: false });
  // 継ぎ手の覆い（黄）・軸受け
  p.box(PC.yellow, [-0.06, ay - 0.13, -0.13], [0.11, ay + 0.13, 0.13], R1(0.02));
  p.cyl(PC.blue, [0.16, ay, 0], 0.1, 0.12, { axis: 'x', seg: 14 });
  p.box(PC.blue, [0.08, 0.16, -0.1], [0.24, ay - 0.05, 0.1]);
  // 渦巻きの胴（中心 x 0.32）・端の吸込み・上の吐出し
  p.lathe(PC.blue, [[0, 0], [0.2, 0], [0.26, 0.04], [0.27, 0.12], [0.24, 0.18], [0.12, 0.2], [0, 0.2]], [0.22, ay, 0], { axis: 'x', seg: 20 });
  p.box(PC.blue, [0.24, 0.16, -0.12], [0.4, ay - 0.15, 0.12]);
  FLANGE(p, [0.43, ay, 0], 0.09, 'x');
  p.tube(PC.white, bend([[0.43, ay, 0], [0.64, ay, 0], [0.64, 1.25, 0]], 0.12), 0.09, { seg: 24, radial: 12 });
  p.cyl(PC.white, [0.32, 0.95, 0], 0.08, 0.6, { seg: 12 });
  FLANGE(p, [0.32, 0.7, 0], 0.08, 'y');
  gateValve(p, [0.32, 1.1, 0], 0.08, 'z');
  gauge(p, [0.32, 0.82, 0.12], 0.04);
  p.collide([-0.78, 0, -0.42], [0.78, 0.76, 0.42]);
}

/** 制御盤（台・箱・ひさし・2 枚の扉と継ぎ目・取っ手と鍵・計器 3 つ・表示灯・切替えのつまみと札・下の通気の切れ目・図面入れ）。背 -z が壁 */
export function controlPanel(p: Prop, w = 0.9, d = 0.4): void {
  p.box(PC.ink, [-w / 2 + 0.01, 0, -d / 2 + 0.01], [w / 2 - 0.01, 0.1, d / 2 - 0.02]);
  p.box(PC.pale, [-w / 2, 0.1, -d / 2], [w / 2, 2.0, d / 2 - 0.02]);
  p.box(PC.pale, [-w / 2 - 0.012, 2.0, -d / 2 - 0.01], [w / 2 + 0.012, 2.04, d / 2 + 0.02], R1(0.006));
  const nd = w > 0.7 ? 2 : 1;
  const dw = w / nd;
  const zf = d / 2;
  for (let i = 0; i < nd; i++) {
    const x0 = -w / 2 + i * dw + 0.004;
    const x1 = x0 + dw - 0.008;
    p.box(PC.pale, [x0, 0.12, zf - 0.02], [x1, 1.98, zf], { shadow: 'receive' });
    const hx = i === 0 && nd === 2 ? x1 - 0.05 : x0 + 0.05;
    p.box(PC.steel, [hx - 0.012, 1.0, zf], [hx + 0.012, 1.2, zf + 0.025], R1(0.006));
    p.cyl(PC.ink, [hx, 1.25, zf + 0.004], 0.01, 0.008, { axis: 'z', seg: 8, shadow: false });
    for (const y of [0.3, 1.75]) p.box(PC.steel, [i === 0 ? x0 - 0.006 : x1 - 0.004, y, zf - 0.01], [i === 0 ? x0 + 0.004 : x1 + 0.006, y + 0.08, zf + 0.006], { shadow: false });
    for (let k = 0; k < 6; k++) p.box(PC.tealDark, [x0 + 0.06, 0.2 + k * 0.035, zf], [x1 - 0.06, 0.212 + k * 0.035, zf + 0.003], { shadow: false });
    p.box(PC.steel, [(x0 + x1) / 2 - 0.12, 0.7, zf], [(x0 + x1) / 2 + 0.12, 0.85, zf + 0.03], R1(0.006));
  }
  if (nd === 2) p.box(PC.tealDark, [-0.003, 0.12, zf], [0.003, 1.98, zf + 0.002], { shadow: false });
  // 計器・表示灯・つまみ（左の扉の上）
  const cx = nd === 2 ? -w / 4 : 0;
  for (let k = 0; k < 3; k++) {
    const x = cx - 0.13 + k * 0.13;
    p.cyl(PC.ink, [x, 1.68, zf + 0.01], 0.052, 0.02, { axis: 'z', seg: 14 });
    p.cyl(PC.white, [x, 1.68, zf + 0.021], 0.045, 0.003, { axis: 'z', seg: 14, shadow: false });
    p.sub([x, 1.68, zf + 0.024], 0, { roll: -0.4 - k * 0.5 }).box(PC.red, [-0.002, 0, 0], [0.002, 0.036, 0.002], { shadow: false });
    p.box(PC.white, [x - 0.04, 1.6, zf], [x + 0.04, 1.615, zf + 0.002], { shadow: false });
  }
  const lamps = [PG.green, PG.red, PG.amber, PG.green];
  for (let k = 0; k < 4; k++) {
    const x = cx - 0.15 + k * 0.1;
    p.cyl(PC.ink, [x, 1.47, zf + 0.006], 0.022, 0.012, { axis: 'z', seg: 10 });
    p.cyl(lamps[k], [x, 1.47, zf + 0.014], 0.016, 0.008, { axis: 'z', seg: 10, kind: k === 1 ? 'solid' : 'glow', shadow: false });
  }
  for (let k = 0; k < 3; k++) {
    const x = cx - 0.12 + k * 0.12;
    p.cyl(PC.ink, [x, 1.3, zf + 0.012], 0.024, 0.024, { axis: 'z', seg: 10 });
    p.sub([x, 1.3, zf + 0.026], 0, { roll: k * 0.8 - 0.8 }).box(PC.steel, [-0.006, -0.022, 0], [0.006, 0.022, 0.012], { shadow: false });
    p.box(PC.white, [x - 0.04, 1.23, zf], [x + 0.04, 1.245, zf + 0.002], { shadow: false });
  }
  p.box(PC.white, [-w / 2 + 0.06, 1.88, zf], [w / 2 - 0.06, 1.94, zf + 0.002], { shadow: false });
  p.collide([-w / 2, 0, -d / 2], [w / 2, 2.04, zf + 0.03]);
}

/** 薬品の槽（受け皿・白い槽と帯・液面の目盛り・ふた・上の注入ポンプと管・注意の札） */
export function chemTank(p: Prop): void {
  p.box(PC.tealDark, [-0.5, 0, -0.5], [0.5, 0.02, 0.5], { shadow: 'receive' });
  for (const [a, b] of [[[-0.5, 0, -0.5], [0.5, 0.16, -0.48]], [[-0.5, 0, 0.48], [0.5, 0.16, 0.5]], [[-0.5, 0, -0.5], [-0.48, 0.16, 0.5]], [[0.48, 0, -0.5], [0.5, 0.16, 0.5]]] as [V3, V3][]) p.box(PC.tealDark, a, b);
  p.lathe(PC.white, [[0, 0.02], [0.37, 0.02], [0.4, 0.06], [0.4, 1.2], [0.37, 1.27], [0.2, 1.31], [0.12, 1.32], [0, 1.32]], [0, 0, 0], { seg: 24 });
  for (const y of [0.45, 0.85]) p.torus(PC.white, [0, y, 0], 0.4, 0.012, { axis: 'y', seg: 24 });
  p.box(PC.pale, [-0.02, 0.15, 0.392], [0.02, 1.15, 0.402], { shadow: false });
  for (let k = 0; k < 10; k++) p.box(PC.ink, [0.02, 0.2 + k * 0.1, 0.395], [0.05, 0.205 + k * 0.1, 0.4], { shadow: false });
  p.cyl(PC.blue, [-0.12, 1.33, -0.05], 0.13, 0.05, { seg: 16 });
  // 注入ポンプ（上の箱・表示・透明な管）
  p.box(PC.teal, [0.08, 1.31, -0.08], [0.3, 1.44, 0.08], R1(0.012));
  p.box(PG.green, [0.12, 1.39, 0.08], [0.2, 1.42, 0.082], { kind: 'glow', shadow: false });
  p.tube(PC.white, [[0.3, 1.38, 0.0], [0.44, 1.36, 0.0], [0.47, 1.0, 0.1], [0.46, 0.3, 0.3], [0.42, 0.18, 0.44]], 0.01, { seg: 16, radial: 4, shadow: false });
  // 注意の札（黄の板と黒い帯）
  p.box(PC.yellow, [-0.32, 0.6, 0.22], [-0.12, 0.84, 0.36], { shadow: false });
  p.sub([-0.22, 0.72, 0.29], -0.6).box(PC.yellow, [-0.12, -0.12, 0.0], [0.12, 0.12, 0.006], { shadow: false });
  p.sub([-0.22, 0.72, 0.29], -0.6).box(PC.ink, [-0.12, 0.08, 0.006], [0.12, 0.1, 0.008], { shadow: false });
  p.collide([-0.5, 0, -0.5], [0.5, 1.45, 0.5]);
}

/** 熱交換器（横の胴・両端の鏡板と継ぎ手・支えの台・上の管 2 本・保温の帯・温度計と圧力計・銘板）。胴は局所 x の向き */
export function heatExchanger(p: Prop): void {
  const ay = 0.9;
  const r = 0.42;
  p.cyl(PC.metal, [-0.05, ay, 0], r, 2.1, { axis: 'x', seg: 24 });
  for (const x of [-0.6, 0.0, 0.6]) p.torus(PC.steel, [x, ay, 0], r + 0.004, 0.01, { axis: 'x', seg: 24 });
  // 両端の継ぎ手（ボルトの列）と、外へふくらむ鏡板（左は向きを返す）
  for (const [x, s] of [[-1.1, -1], [1.0, 1]] as [number, number][]) {
    p.cyl(PC.steel, [x, ay, 0], r + 0.08, 0.07, { axis: 'x', seg: 24 });
    for (let k = 0; k < 12; k++) p.ball(PC.ink, [x + s * 0.04, ay + Math.cos((k / 12) * Math.PI * 2) * (r + 0.05), Math.sin((k / 12) * Math.PI * 2) * (r + 0.05)], 0.014, { seg: 5, shadow: false });
    p.sub([x + s * 0.035, ay, 0], s < 0 ? Math.PI : 0).lathe(PC.metal, [[r, 0], [r * 0.95, 0.08], [r * 0.7, 0.17], [0, 0.21]], [0, 0, 0], { axis: 'x', seg: 24 });
  }
  for (const x of [-0.7, 0.65]) {
    p.extrude(PC.steel, [[-0.38, 0], [0.38, 0], [0.38, 0.12], [0.3, 0.12], [0.2, ay - r * 0.75], [-0.2, ay - r * 0.75], [-0.3, 0.12], [-0.38, 0.12]], 'zy', x - 0.07, x + 0.07, {});
    p.box(PC.steel, [x - 0.12, 0, -0.42], [x + 0.12, 0.02, 0.42], { shadow: 'receive' });
  }
  for (const [x, col] of [[-0.8, PC.blue], [0.8, PC.white]] as [number, string][]) {
    p.cyl(col, [x, ay + 0.65, 0], 0.08, 0.6, { seg: 12 });
    FLANGE(p, [x, ay + r + 0.02, 0], 0.08, 'y');
    gauge(p, [x + 0.14, ay + 0.6, 0.06], 0.04);
  }
  p.box(PC.white, [-0.25, ay - 0.1, r - 0.01], [0.15, ay + 0.1, r + 0.004], { shadow: false });
  p.collide([-1.3, 0, -0.5], [1.25, ay + r + 0.1, 0.5]);
}

/** コースロープの巻き取り台（A 字の脚とキャスター・軸・端の輪と輻・芯と巻いた浮きの列・回すハンドル）。軸は局所 x */
export function ropeReel(p: Prop): void {
  const ay = 0.62;
  for (const sx of [-1, 1]) {
    const x = sx * 0.84;
    p.rod(PC.steel, [x, 0.1, -0.42], [x, ay, 0], 0.02, { radial: 6 });
    p.rod(PC.steel, [x, 0.1, 0.42], [x, ay, 0], 0.02, { radial: 6 });
    p.rod(PC.steel, [x, 0.1, -0.44], [x, 0.1, 0.44], 0.018, { radial: 6 });
    for (const z of [-0.42, 0.42]) {
      p.box(PC.steel, [x - 0.03, 0.08, z - 0.03], [x + 0.03, 0.1, z + 0.03]);
      p.cyl(PC.ink, [x, 0.045, z], 0.045, 0.03, { axis: 'x', seg: 10 });
    }
    // 端の輪（縁・輻・こしき）
    const ex = sx * 0.78;
    p.torus(PC.steel, [ex, ay, 0], 0.5, 0.016, { axis: 'x', seg: 28 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      p.rod(PC.steel, [ex, ay, 0], [ex, ay + Math.sin(a) * 0.5, Math.cos(a) * 0.5], 0.01, { radial: 4 });
    }
    p.cyl(PC.steel, [ex, ay, 0], 0.07, 0.06, { axis: 'x', seg: 12 });
  }
  p.rod(PC.chrome, [-0.92, ay, 0], [0.92, ay, 0], 0.02, { radial: 8 });
  p.cyl(PC.white, [0, ay, 0], 0.2, 1.5, { axis: 'x', seg: 18 });
  // 巻いた浮き（外の層の円盤の列。端は赤、間は青と白）
  const pitch = 0.12;
  const n = Math.floor(1.5 / pitch);
  for (let k = 0; k < n; k++) {
    const col = k < 2 || k >= n - 2 ? PC.red : k % 2 === 0 ? PC.blue : PC.white;
    const r0 = 0.36 + ((k * 7) % 3) * 0.015;
    p.lathe(col, [[0.2, 0], [r0 - 0.03, 0.012], [r0, 0.04], [r0, 0.08], [r0 - 0.03, 0.108], [0.2, 0.12]], [-0.75 + k * pitch, ay, 0], { axis: 'x', seg: 16 });
  }
  // 回すハンドル
  p.rod(PC.steel, [0.92, ay, 0], [0.96, ay, 0], 0.025, { radial: 8 });
  p.rod(PC.steel, [0.96, ay, 0], [0.96, ay + 0.22, 0.05], 0.014, { radial: 6 });
  p.cyl(PC.ink, [1.02, ay + 0.22, 0.05], 0.018, 0.1, { axis: 'x', seg: 8 });
  p.collide([-0.95, 0, -0.5], [1.05, ay + 0.52, 0.5]);
}

/** プールの掃除機（台車の車輪と押し手・載せた掃除の機械とブラシ・浮く線を巻いて掛ける・電源の箱） */
export function poolCleaner(p: Prop): void {
  for (const sx of [-1, 1]) {
    p.cyl(PC.ink, [sx * 0.32, 0.15, -0.18], 0.15, 0.06, { axis: 'x', seg: 16 });
    p.cyl(PC.steel, [sx * 0.32, 0.15, -0.18], 0.06, 0.07, { axis: 'x', seg: 10 });
  }
  p.rod(PC.steel, [-0.35, 0.15, -0.18], [0.35, 0.15, -0.18], 0.015, { radial: 6 });
  p.box(PC.steel, [-0.28, 0.12, -0.24], [0.28, 0.15, 0.32], R1(0.008));
  p.rod(PC.steel, [0, 0.12, 0.3], [0, 0.0, 0.32], 0.015, { radial: 6 });
  p.tube(PC.chrome, bend([[-0.25, 0.15, -0.22], [-0.25, 1.02, -0.28], [0.25, 1.02, -0.28], [0.25, 0.15, -0.22]], 0.06), 0.016, { seg: 40, radial: 6 });
  // 掃除の機械（胴・上の覆い・取っ手・前後のブラシ・横の帯）
  p.box(PC.white, [-0.22, 0.2, -0.15], [0.22, 0.44, 0.27], { r: 0.06, seg: 2 });
  p.box(PC.teal, [-0.2, 0.42, -0.12], [0.2, 0.47, 0.24], { r: 0.025, seg: 2 });
  p.tube(PC.ink, bend([[-0.1, 0.46, 0.06], [-0.1, 0.56, 0.06], [0.1, 0.56, 0.06], [0.1, 0.46, 0.06]], 0.04), 0.014, { seg: 20, radial: 6 });
  for (const z of [-0.14, 0.26]) p.cyl(PC.rubber, [0, 0.22, z], 0.065, 0.42, { axis: 'x', seg: 12 });
  for (const sx of [-1, 1]) p.box(PC.rubber, [sx * 0.225 - 0.02, 0.15, -0.17], [sx * 0.225 + 0.02, 0.29, 0.29], R1(0.02));
  // 浮く線（黄の輪を押し手に掛ける）・電源の箱
  for (let k = 0; k < 4; k++) p.torus(PC.yellow, [0.27, 0.7 - k * 0.012, -0.28], 0.17 - k * 0.006, 0.012, { axis: 'x', seg: 16 });
  p.box(PC.dark, [-0.3, 0.6, -0.36], [-0.12, 0.84, -0.26], R1(0.01));
  p.box(PG.green, [-0.26, 0.76, -0.26], [-0.16, 0.8, -0.258], { kind: 'glow', shadow: false });
  p.collide([-0.4, 0, -0.4], [0.4, 1.05, 0.34]);
}

/** 重ねた椅子（積み重ねの椅子 n 脚を少しずつ上と後ろへずらして） */
export function stackedChairs(p: Prop, n = 6, seat: string = PC.teal): void {
  for (let i = 0; i < n; i++) chair(p.sub([0, i * 0.052, -i * 0.018]), { seat, frame: PC.chrome });
}

/** 採暖室の暖房器の柵（木の縦の板・上と下の横木）。局所 x の向きに len */
export function woodFence(p: Prop, len: number, h = 1.0): void {
  for (const y of [0.15, h - 0.06]) p.box(PC.wood, [-len / 2, y, -0.02], [len / 2, y + 0.05, 0.02], R1(0.008));
  const n = Math.max(2, Math.round(len / 0.12));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n;
    p.box(PC.wood, [x - 0.03, 0.02, 0.02], [x + 0.03, h, 0.045], R1(0.008));
  }
  for (const x of [-len / 2, len / 2]) p.box(PC.wood, [x - 0.03, 0, -0.03], [x + 0.03, h + 0.04, 0.03], R1(0.01));
  p.collide([-len / 2 - 0.03, 0, -0.03], [len / 2 + 0.03, h + 0.04, 0.05]);
}

/**
 * 受水槽（FRP のパネル水槽: 1 m 角前後のふくらんだパネルと継ぎ目のつば・鉄の架台とコンクリートの台・はしご・上の点検口と通気の笠・
 * 水位計の管・下の管と弁・銘板）。w × d × h はパネルの部分の寸法
 */
export function panelTank(p: Prop, w = 4.4, d = 3.2, h = 2.4): void {
  const y0 = 0.42;
  p.box(PC.pale, [-w / 2 - 0.2, 0, -d / 2 - 0.2], [w / 2 + 0.2, 0.3, d / 2 + 0.2], R1(0.01));
  p.box(PC.dark, [-w / 2, 0.3, -d / 2], [w / 2, y0, d / 2]);
  // 継ぎ目のつば（下地の箱）と、ふくらんだパネル
  p.box(PC.pale, [-w / 2, y0, -d / 2], [w / 2, y0 + h, d / 2]);
  const nx = Math.max(1, Math.round(w));
  const nz = Math.max(1, Math.round(d));
  const ny = Math.max(1, Math.round(h));
  const mx = w / nx;
  const mz = d / nz;
  const my = h / ny;
  const g = 0.035;
  const t = 0.04;
  for (let j = 0; j < ny; j++) {
    const ya = y0 + j * my + g;
    const yb = y0 + (j + 1) * my - g;
    for (let i = 0; i < nx; i++) {
      const xa = -w / 2 + i * mx + g;
      const xb = xa + mx - 2 * g;
      p.box(PC.white, [xa, ya, d / 2 - 0.01], [xb, yb, d / 2 + t], { r: 0.035, seg: 2 });
      p.box(PC.white, [xa, ya, -d / 2 - t], [xb, yb, -d / 2 + 0.01], { r: 0.035, seg: 2 });
    }
    for (let i = 0; i < nz; i++) {
      const za = -d / 2 + i * mz + g;
      const zb = za + mz - 2 * g;
      p.box(PC.white, [w / 2 - 0.01, ya, za], [w / 2 + t, yb, zb], { r: 0.035, seg: 2 });
      p.box(PC.white, [-w / 2 - t, ya, za], [-w / 2 + 0.01, yb, zb], { r: 0.035, seg: 2 });
    }
  }
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const xa = -w / 2 + i * mx + g;
      const za = -d / 2 + k * mz + g;
      p.box(PC.white, [xa, y0 + h - 0.01, za], [xa + mx - 2 * g, y0 + h + t, za + mz - 2 * g], { r: 0.035, seg: 2 });
    }
  // 上: 点検口・通気の笠・手すり
  const top = y0 + h + t;
  p.cyl(PC.blue, [w / 2 - 0.8, top + 0.06, d / 2 - 0.8], 0.32, 0.12, { seg: 18 });
  p.cyl(PC.blue, [w / 2 - 0.8, top + 0.13, d / 2 - 0.8], 0.36, 0.03, { seg: 18 });
  p.rod(PC.white, [-w / 2 + 0.6, top, -d / 2 + 0.6], [-w / 2 + 0.6, top + 0.35, -d / 2 + 0.6], 0.05, { radial: 10 });
  p.lathe(PC.white, [[0.0, 0], [0.16, 0], [0.16, 0.03], [0.05, 0.12], [0, 0.13]], [-w / 2 + 0.6, top + 0.33, -d / 2 + 0.6], { seg: 14 });
  for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) p.rod(PC.steel, [w / 2 - 0.1, top + 0.9, z], [w / 2 - 1.6, top + 0.9, z], 0.02, { radial: 6 });
  for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) for (const x of [w / 2 - 0.1, w / 2 - 1.6]) p.rod(PC.steel, [x, top, z], [x, top + 0.9, z], 0.02, { radial: 6 });
  // はしご（+x の面）
  for (const z of [-0.25, 0.25]) p.rod(PC.steel, [w / 2 + 0.25, 0.3, z], [w / 2 + 0.25, top + 0.9, z], 0.022, { radial: 6 });
  for (let y = 0.6; y < top + 0.1; y += 0.3) p.rod(PC.steel, [w / 2 + 0.25, y, -0.25], [w / 2 + 0.25, y, 0.25], 0.016, { radial: 6 });
  for (const y of [1.2, top - 0.2]) for (const z of [-0.25, 0.25]) p.rod(PC.steel, [w / 2 + t, y, z], [w / 2 + 0.25, y, z], 0.016, { radial: 6 });
  // 水位計の管・下の管と弁・銘板
  p.cyl(PC.chrome, [-w / 2 + 0.3, y0 + h / 2, d / 2 + t + 0.06], 0.018, h - 0.2, { seg: 8 });
  p.cyl(PC.blue, [-w / 2 + 0.3, y0 + h * 0.35, d / 2 + t + 0.06], 0.021, h * 0.6, { seg: 8 });
  for (const x of [-0.6, 0.6]) {
    p.cyl(PC.white, [x, y0 + 0.25, d / 2 + t + 0.25], 0.08, 0.5, { axis: 'z', seg: 12 });
    gateValve(p, [x, y0 + 0.25, d / 2 + t + 0.42], 0.08, 'z');
  }
  p.box(PC.white, [0.9, y0 + 1.4, d / 2 + t], [1.5, y0 + 1.75, d / 2 + t + 0.006], { shadow: false });
  p.collide([-w / 2 - 0.2, 0, -d / 2 - 0.2], [w / 2 + 0.3, top + 0.9, d / 2 + 0.6]);
}
