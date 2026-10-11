import type { Prop, V2 } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { WARD } from './mats.ts';
import { caster } from './medical.ts';

/**
 * 病棟の家具・設備（正面 +z、背 -z、床 y = 0）。寸法の根拠:
 * - 病院のベッド 全長 2.0 m・幅 0.95 m・マットレスの上 0.55〜0.63 m（頭板・足板の取っ手の穴・分かれた柵・キャスター）
 * - 床頭台 幅 0.46 m・高さ 0.83 m（引き出し・冷蔵庫の扉・テレビカードの口・タオル掛け・腕のテレビ）
 * - ロッカー 幅 0.45〜0.5 m・高さ 1.8 m（扉・通気の切れ目・取っ手・名札）。冷蔵庫 幅 0.6 m・高さ 1.5〜1.7 m
 * - 壁掛けの洗面台 幅 0.6 m・高さ 0.8 m（鉢・水栓・排水の管・鏡・棚）。腰掛けの便器（便座の高さ 0.4 m・タンク）
 */

/** 角の丸い長方形の輪郭（反時計回り）。r は角の半径 */
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number, n = 4): V2[] {
  const out: V2[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return out;
}

/** 楕円の輪郭（反時計回り。cw で時計回り = 穴） */
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 20, cw = false): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((cw ? -i : i) / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const cwRect = (x0: number, y0: number, x1: number, y1: number, r: number): V2[] => roundRect(x0, y0, x1, y1, r, 3).reverse();

export interface BedOpts {
  blanket?: string;
  frame?: string;
  /** マットレスの上の高さ */
  h?: number;
  /** 掛け布団の頭の側の端（局所の z） */
  turned?: number;
  /** 上げている柵の側（+1 = +x、-1 = -x） */
  rail?: 1 | -1;
}

/** 病院のベッド（頭が -z、足が +z。中心が原点） */
export function hospitalBed(p: Prop, o: BedOpts = {}): void {
  const H = o.h ?? 0.58;
  const fr = o.frame ?? WARD.pale;
  const blanket = o.blanket ?? WARD.sea;
  const turned = o.turned ?? -0.2;
  const metal = WARD.grey;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * 0.38, sz * 0.86, 0.06, { yaw: 0 });
  // 下の枠・昇降の覆い・床の枠
  p.box(metal, [-0.43, 0.14, -0.92], [0.43, 0.2, 0.92], { r: 0.02 });
  p.box(shade(metal, -0.3), [-0.3, 0.2, -0.7], [0.3, H - 0.2, 0.7], { r: 0.03, shadow: 'receive' });
  p.box(WARD.steel, [-0.46, H - 0.2, -0.98], [0.46, H - 0.14, 0.98], { r: 0.015 });
  // マットレス・枕・掛け布団（折り返したシーツの帯）
  p.box(WARD.white, [-0.45, H - 0.14, -0.96], [0.45, H, 0.96], { r: 0.045 });
  p.box(WARD.white, [-0.3, H - 0.01, -0.93], [0.3, H + 0.1, -0.6], { r: 0.05 });
  p.box(blanket, [-0.475, H - 0.09, turned], [0.475, H + 0.05, 0.99], { r: 0.035 });
  p.box(WARD.white, [-0.48, H + 0.03, turned - 0.005], [0.48, H + 0.07, turned + 0.2], { r: 0.02 });
  // 頭板・足板（角の丸い板に取っ手の穴）
  const head = roundRect(-0.48, 0.24, 0.48, H + 0.45, 0.07);
  p.extrude(fr, head, 'xy', -1.05, -0.99, { bevel: 0.012, holes: [cwRect(-0.22, H + 0.3, 0.22, H + 0.38, 0.035)] });
  const foot = roundRect(-0.48, 0.24, 0.48, H + 0.24, 0.06);
  p.extrude(fr, foot, 'xy', 0.99, 1.05, { bevel: 0.012, holes: [cwRect(-0.2, H + 0.1, 0.2, H + 0.17, 0.03)] });
  p.box(WARD.paper, [-0.1, H - 0.05, 1.05], [0.1, H + 0.03, 1.054], { shadow: false });
  p.box(WARD.ink, [-0.08, H - 0.02, 1.054], [0.04, H - 0.008, 1.056], { shadow: false });
  // 柵（頭の側の分かれた板。上げた側と下げた側）
  const rail = o.rail ?? 1;
  for (const sx of [-1, 1]) {
    const yb = sx === rail ? H - 0.02 : H - 0.26;
    const x = sx * 0.485;
    p.extrude(fr, roundRect(-0.85, yb, -0.12, yb + 0.3, 0.06), 'zy', x - 0.0125, x + 0.0125, {
      bevel: 0.008,
      holes: [cwRect(-0.78, yb + 0.06, -0.52, yb + 0.24, 0.04), cwRect(-0.45, yb + 0.06, -0.19, yb + 0.24, 0.04)],
    });
    p.box(metal, [x - 0.01, H - 0.2, -0.6], [x + 0.01, yb + 0.02, -0.56], { shadow: false });
    p.box(metal, [x - 0.01, H - 0.2, -0.4], [x + 0.01, yb + 0.02, -0.36], { shadow: false });
  }
  // 手元の操作の器（上げた柵に掛ける）と線
  p.box(WARD.cream, [rail * 0.5, H + 0.0, -0.36], [rail * 0.53, H + 0.16, -0.3], { r: 0.012 });
  p.tube(WARD.dark, [[rail * 0.515, H + 0.0, -0.33], [rail * 0.5, H - 0.12, -0.3], [rail * 0.46, H - 0.2, -0.25]], 0.004, { shadow: false });
  p.collide([-0.49, 0, -1.05], [0.49, H + 0.1, 1.05]);
}

/** 床頭台（引き出し・冷蔵庫の扉・テレビカードの口・タオル掛け・腕のテレビ）。背が -z */
export function bedsideCabinet(p: Prop, o: { body?: string } = {}): void {
  const body = o.body ?? WARD.pale;
  p.box(WARD.grey, [-0.21, 0, -0.21], [0.21, 0.05, 0.2], { r: 0.01 });
  p.box(body, [-0.23, 0.05, -0.23], [0.23, 0.8, 0.22], { r: 0.012 });
  p.box(WARD.white, [-0.24, 0.8, -0.24], [0.24, 0.83, 0.24], { r: 0.01 });
  p.box(WARD.white, [-0.24, 0.82, -0.24], [0.24, 0.86, -0.21], { r: 0.008 });
  // 引き出し・扉（冷蔵庫）・取っ手・カードの口
  p.box(WARD.white, [-0.21, 0.63, 0.22], [0.21, 0.77, 0.234], { r: 0.008 });
  p.box(shade(WARD.white, -0.6), [-0.08, 0.74, 0.234], [0.08, 0.752, 0.24], { r: 0.004, shadow: false });
  p.box(WARD.white, [-0.21, 0.08, 0.22], [0.21, 0.6, 0.234], { r: 0.008 });
  p.box(WARD.grey, [0.15, 0.25, 0.234], [0.17, 0.45, 0.246], { r: 0.006, shadow: false });
  p.box(WARD.dark, [-0.17, 0.5, 0.234], [-0.07, 0.56, 0.237], { r: 0.004, shadow: false });
  p.box(WARD.ink, [-0.15, 0.525, 0.237], [-0.09, 0.53, 0.239], { shadow: false });
  // 横のタオル掛けとタオル
  p.rod(WARD.steel, [0.245, 0.58, -0.15], [0.245, 0.58, 0.15], 0.007, { shadow: false });
  if (p.r() < 0.6) p.box(p.r() < 0.5 ? WARD.white : WARD.cream, [0.238, 0.36, -0.12], [0.256, 0.6, 0.1], { r: 0.008 });
  // 腕のテレビ（後ろの右の柱・横の腕・薄い画面）
  p.rod(WARD.grey, [0.17, 0.83, -0.2], [0.17, 1.02, -0.2], 0.012);
  p.rod(WARD.grey, [0.17, 1.02, -0.2], [0.02, 1.02, -0.1], 0.01);
  const tv = p.sub([0.0, 0.92, -0.08], -0.25);
  tv.box(WARD.dark, [-0.17, 0, -0.025], [0.17, 0.21, 0.0], { r: 0.012 });
  tv.box(WARD.screen, [-0.155, 0.015, 0.0], [0.155, 0.195, 0.003], { shadow: false });
  // 上の物（ティッシュの箱・湯のみ）
  if (p.r() < 0.7) {
    p.box(WARD.white, [-0.2, 0.83, -0.05], [-0.06, 0.9, 0.08], { r: 0.008 });
    p.ball(WARD.paper, [-0.13, 0.905, 0.015], [0.03, 0.02, 0.015], { seg: 8, shadow: false });
  }
  if (p.r() < 0.5) p.lathe(WARD.cream, [[0, 0], [0.03, 0], [0.036, 0.08], [0.032, 0.08], [0.027, 0.008], [0, 0.008]], [0.08, 0.83, 0.12], { seg: 14 });
  p.collide([-0.25, 0, -0.24], [0.25, 0.86, 0.25]);
}

/** オーバーベッドテーブル（片側の柱・コの字の脚・キャスター） */
export function overbedTable(p: Prop): void {
  p.box(WARD.white, [-0.42, 0.78, -0.2], [0.42, 0.81, 0.2], { r: 0.012 });
  p.box(WARD.grey, [-0.4, 0.765, -0.17], [0.4, 0.78, 0.17], { r: 0.004, shadow: false });
  p.box(WARD.grey, [0.335, 0.08, -0.035], [0.405, 0.5, 0.035], { r: 0.01 });
  p.box(WARD.steel, [0.345, 0.5, -0.025], [0.395, 0.77, 0.025], { r: 0.008 });
  p.box(WARD.grey, [0.3, 0.05, -0.04], [0.44, 0.09, 0.04], { r: 0.01 });
  for (const sz of [-1, 1]) {
    p.box(WARD.grey, [-0.36, 0.05, sz * 0.22 - 0.025], [0.44, 0.08, sz * 0.22 + 0.025], { r: 0.01 });
    caster(p, -0.34, sz * 0.22, 0.025);
    caster(p, 0.42, sz * 0.22, 0.025);
  }
  p.collide([-0.42, 0.0, -0.25], [0.44, 0.81, 0.25]);
}

/** ロッカー（扉・通気の切れ目・取っ手と鍵・名札。2 段のことも）。背が -z */
export function locker(p: Prop, o: { w?: number; h?: number; body?: string; door?: string; tiers?: 1 | 2 } = {}): void {
  const W = o.w ?? 0.5;
  const H = o.h ?? 1.8;
  const body = o.body ?? WARD.pale;
  const door = o.door ?? shade(body, 0.2);
  const tiers = o.tiers ?? 1;
  p.box(WARD.grey, [-W / 2 + 0.02, 0, -0.25], [W / 2 - 0.02, 0.08, 0.22], { r: 0.006 });
  p.box(body, [-W / 2, 0.08, -0.27], [W / 2, H, 0.25], { r: 0.008 });
  const zf = 0.25;
  const parts: [number, number][] = tiers === 2 ? [[0.11, H / 2 + 0.03], [H / 2 + 0.06, H - 0.03]] : [[0.11, H - 0.03]];
  for (const [y0, y1] of parts) {
    p.box(door, [-W / 2 + 0.018, y0, zf], [W / 2 - 0.018, y1, zf + 0.012], { r: 0.006 });
    // 通気の切れ目（上と下）
    for (const yy of [y1 - 0.12, y0 + 0.08])
      for (let k = 0; k < 4; k++) p.box(shade(door, -0.75), [-W * 0.22, yy + k * 0.022, zf + 0.012], [W * 0.22, yy + k * 0.022 + 0.008, zf + 0.014], { shadow: false });
    // 取っ手と鍵・名札
    const hy = tiers === 2 ? y0 + 0.2 : 0.98;
    p.box(WARD.steel, [W / 2 - 0.075, hy, zf + 0.012], [W / 2 - 0.05, hy + 0.15, zf + 0.03], { r: 0.008 });
    p.cyl(WARD.steel, [W / 2 - 0.0625, hy + 0.2, zf + 0.016], 0.012, 0.012, { axis: 'z', seg: 10, shadow: false });
    p.box(WARD.paper, [-0.08, y1 - 0.25, zf + 0.012], [0.08, y1 - 0.2, zf + 0.016], { shadow: false });
    p.box(WARD.ink, [-0.06, y1 - 0.23, zf + 0.016], [0.02, y1 - 0.222, zf + 0.018], { shadow: false });
  }
  p.collide([-W / 2, 0, -0.27], [W / 2, H, 0.27]);
}

/** 冷蔵庫（上下の扉・縦の取っ手・継ぎ目・下の吸気の格子）。背が -z */
export function fridge(p: Prop, o: { h?: number; w?: number; body?: string } = {}): void {
  const H = o.h ?? 1.7;
  const W = o.w ?? 0.6;
  const body = o.body ?? WARD.white;
  p.box(body, [-W / 2, 0.05, -0.32], [W / 2, H, 0.29], { r: 0.02 });
  p.box(WARD.dark, [-W / 2 + 0.03, 0, -0.3], [W / 2 - 0.03, 0.05, 0.25], { r: 0.006 });
  const split = H * 0.4;
  p.box(body, [-W / 2 + 0.005, 0.07, 0.29], [W / 2 - 0.005, split - 0.008, 0.33], { r: 0.015 });
  p.box(body, [-W / 2 + 0.005, split + 0.008, 0.29], [W / 2 - 0.005, H - 0.01, 0.33], { r: 0.015 });
  p.box(shade(body, -0.6), [-W / 2 + 0.02, split - 0.008, 0.29], [W / 2 - 0.02, split + 0.008, 0.3], { shadow: false });
  for (const [y0, y1] of [[split - 0.3, split - 0.06], [split + 0.06, split + 0.45]] as [number, number][]) p.box(WARD.steel, [W / 2 - 0.07, y0, 0.33], [W / 2 - 0.045, y1, 0.355], { r: 0.008 });
  for (let k = 0; k < 4; k++) p.box(WARD.grey, [-W / 2 + 0.06, 0.06 + k * 0.01, 0.33], [W / 2 - 0.06, 0.065 + k * 0.01, 0.332], { shadow: false });
  p.box(WARD.paper, [-W / 2 + 0.06, H - 0.35, 0.33], [-W / 2 + 0.16, H - 0.22, 0.332], { shadow: false });
  p.collide([-W / 2, 0, -0.32], [W / 2, H, 0.36]);
}

/** 電子レンジ（台の上 y）と電気ポット（横） */
export function microwave(p: Prop, y: number, o: { pot?: boolean } = {}): void {
  p.box(WARD.pale, [-0.25, y + 0.01, -0.18], [0.25, y + 0.29, 0.18], { r: 0.018 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(WARD.dark, [sx * 0.2, y + 0.005, sz * 0.13], 0.015, 0.01, { seg: 8, shadow: false });
  p.box(WARD.white, [-0.24, y + 0.025, 0.18], [0.1, y + 0.275, 0.19], { r: 0.01 });
  p.box(WARD.screen, [-0.21, y + 0.06, 0.19], [0.05, y + 0.24, 0.193], { r: 0.006, shadow: false });
  p.box(WARD.steel, [0.06, y + 0.06, 0.19], [0.085, y + 0.24, 0.205], { r: 0.008, shadow: false });
  p.box(WARD.grey, [0.11, y + 0.025, 0.18], [0.24, y + 0.275, 0.186], { r: 0.006 });
  p.box('#bfe8c8', [0.13, y + 0.225, 0.186], [0.22, y + 0.25, 0.188], { kind: 'glow', shadow: false });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.box(WARD.white, [0.13 + j * 0.05, y + 0.06 + i * 0.05, 0.186], [0.17 + j * 0.05, y + 0.09 + i * 0.05, 0.19], { r: 0.004, shadow: false });
  if (o.pot !== false) {
    const s = p.sub([0.5, y, 0]);
    s.lathe(WARD.white, [[0, 0], [0.09, 0], [0.098, 0.02], [0.098, 0.21], [0.088, 0.25], [0, 0.25]], [0, 0, 0], { seg: 18 });
    s.lathe(WARD.grey, [[0, 0], [0.085, 0], [0.07, 0.03], [0, 0.035]], [0, 0.25, 0], { seg: 18 });
    s.box(WARD.dark, [-0.03, 0.2, 0.08], [0.03, 0.24, 0.12], { r: 0.008 });
    s.box(WARD.screen, [-0.025, 0.14, 0.096], [0.025, 0.17, 0.1], { shadow: false });
    s.torus(WARD.grey, [0, 0.28, 0], 0.06, 0.008, { axis: 'z', seg: 12, arc: Math.PI });
  }
}

/** ソファ（台・座のクッション・背のクッション・ひじ掛け・短い脚）。背が -z */
export function sofa(p: Prop, w: number, color: string): void {
  const dark = shade(color, -0.35);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(WARD.dark, [sx * (w / 2 - 0.08), 0.06, sz * 0.32], 0.022, 0.12, { seg: 8, shadow: false });
  p.box(dark, [-w / 2 + 0.04, 0.12, -0.38], [w / 2 - 0.04, 0.3, 0.38], { r: 0.03 });
  const n = Math.max(1, Math.round((w - 0.3) / 0.6));
  const cw = (w - 0.28) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + 0.14 + i * cw;
    p.box(color, [x0 + 0.005, 0.3, -0.2], [x0 + cw - 0.005, 0.44, 0.39], { r: 0.05 });
    p.sub([x0 + cw / 2, 0.42, -0.24], 0, { pitch: -0.18 }).box(color, [-cw / 2 + 0.01, 0, -0.07], [cw / 2 - 0.01, 0.38, 0.07], { r: 0.06 });
  }
  p.box(dark, [-w / 2 + 0.1, 0.3, -0.4], [w / 2 - 0.1, 0.8, -0.27], { r: 0.05 });
  for (const sx of [-1, 1]) p.box(color, [sx > 0 ? w / 2 - 0.15 : -w / 2, 0.12, -0.4], [sx > 0 ? w / 2 : -w / 2 + 0.15, 0.6, 0.4], { r: 0.06 });
  p.collide([-w / 2, 0, -0.4], [w / 2, 0.8, 0.4]);
}

/** テレビ台とテレビ（2 枚の扉・つまみ・脚の台・薄い画面）。背が -z */
export function tvStand(p: Prop, o: { w?: number } = {}): void {
  const W = o.w ?? 1.4;
  p.box(WARD.dark, [-W / 2 + 0.04, 0, -0.2], [W / 2 - 0.04, 0.05, 0.19], { r: 0.006 });
  p.box(WARD.pale, [-W / 2, 0.05, -0.22], [W / 2, 0.5, 0.22], { r: 0.015 });
  for (const sx of [-1, 1]) {
    p.box(WARD.white, [sx > 0 ? 0.005 : -W / 2 + 0.03, 0.08, 0.22], [sx > 0 ? W / 2 - 0.03 : -0.005, 0.47, 0.232], { r: 0.008 });
    p.cyl(WARD.steel, [sx * 0.06, 0.32, 0.24], 0.012, 0.016, { axis: 'z', seg: 10, shadow: false });
  }
  p.box(WARD.dark, [-0.2, 0.5, -0.12], [0.2, 0.52, 0.06], { r: 0.008 });
  p.box(WARD.dark, [-0.04, 0.52, -0.08], [0.04, 0.64, -0.04], { r: 0.008 });
  p.box(WARD.dark, [-0.62, 0.6, -0.08], [0.62, 1.32, -0.03], { r: 0.015 });
  p.box(WARD.screen, [-0.6, 0.62, -0.03], [0.6, 1.3, -0.027], { shadow: false });
  p.box(WARD.dark, [0.3, 0.5, 0.05], [0.35, 0.515, 0.17], { r: 0.008, shadow: false });
  p.collide([-W / 2, 0, -0.22], [W / 2, 1.32, 0.23]);
}

/** 壁掛けの洗面台（鉢・水栓・排水の管・鏡・下の棚）。壁は z = -0.25 */
export function washbasin(p: Prop): void {
  const wz = -0.25;
  p.box(WARD.white, [-0.3, 0.68, wz], [0.3, 0.82, 0.2], { r: 0.04 });
  p.ball(shade(WARD.white, -0.3), [0, 0.818, -0.02], [0.22, 0.008, 0.15], { seg: 20, shadow: false });
  p.cyl(WARD.grey, [0, 0.824, -0.02], 0.02, 0.004, { seg: 10, shadow: false });
  // 水栓（台・上がって手前へ曲がる口・レバー）
  p.cyl(WARD.steel, [0, 0.84, -0.18], 0.022, 0.04, { seg: 12 });
  p.tube(WARD.steel, [[0, 0.86, -0.18], [0, 0.98, -0.18], [0, 0.98, -0.09], [0, 0.94, -0.08]], 0.011, { sharp: true });
  p.box(WARD.steel, [-0.01, 0.99, -0.2], [0.01, 1.0, -0.12], { r: 0.004 });
  // 排水の管
  p.tube(WARD.steel, [[0, 0.68, -0.05], [0, 0.5, -0.05], [0, 0.45, -0.15], [0, 0.45, wz]], 0.02, { seg: 12 });
  // 鏡（枠・鏡の板）と棚・石けんの瓶
  p.box(WARD.steel, [-0.27, 1.02, wz], [0.27, 1.62, wz + 0.015], { r: 0.008 });
  p.box(WARD.mirror, [-0.25, 1.04, wz + 0.015], [0.25, 1.6, wz + 0.018], { shadow: false });
  p.box(WARD.white, [-0.27, 0.97, wz], [0.27, 0.99, wz + 0.1], { r: 0.008 });
  p.lathe(WARD.white, [[0, 0], [0.03, 0], [0.032, 0.11], [0.015, 0.14], [0, 0.14]], [0.18, 0.99, wz + 0.05], { seg: 12 });
  p.box(WARD.dark, [0.175, 1.13, wz + 0.04], [0.185, 1.145, wz + 0.08], { shadow: false });
  p.collide([-0.3, 0, wz], [0.3, 0.82, 0.2]);
}

/** 腰掛けの便器（鉢・便座・開いたふた・タンク・L 字の手すり・紙の掛け具）。壁は z = -0.32 */
export function toiletBowl(p: Prop, o: { rail?: boolean } = {}): void {
  const W = WARD.white;
  p.box(W, [-0.21, 0.42, -0.32], [0.21, 0.82, -0.14], { r: 0.025 });
  p.box(W, [-0.215, 0.81, -0.325], [0.215, 0.85, -0.135], { r: 0.015 });
  p.box(WARD.steel, [-0.25, 0.74, -0.24], [-0.21, 0.76, -0.2], { r: 0.006, shadow: false });
  p.extrude(W, ellipse(0, 0.05, 0.13, 0.17), 'xz', 0, 0.3, { bevel: 0.02 });
  p.extrude(W, ellipse(0, 0.08, 0.19, 0.25), 'xz', 0.28, 0.4, { bevel: 0.02 });
  p.extrude(shade(W, -0.45), ellipse(0, 0.09, 0.12, 0.16), 'xz', 0.33, 0.401);
  p.extrude(W, ellipse(0, 0.08, 0.19, 0.25), 'xz', 0.4, 0.425, { bevel: 0.006, holes: [ellipse(0, 0.09, 0.12, 0.16, 20, true)] });
  p.extrude(W, ellipse(0, 0.67, 0.19, 0.24), 'xy', -0.135, -0.11, { bevel: 0.006 });
  if (o.rail !== false) {
    p.tube(WARD.steel, [[0.395, 0.715, -0.3], [0.395, 0.715, 0.335], [0.395, 1.35, 0.335]], 0.016, { sharp: true });
    p.box(WARD.steel, [0.36, 0.695, -0.32], [0.43, 0.735, -0.29], { r: 0.008 });
    p.box(WARD.white, [0.36, 0.66, 0.0], [0.43, 0.68, 0.14], { r: 0.006 });
    p.cyl(WARD.paper, [0.39, 0.62, 0.07], 0.055, 0.11, { axis: 'z', seg: 14 });
  }
  p.collide([-0.22, 0, -0.32], [0.22, 0.45, 0.33]);
}

/** 丸椅子（クッションの座・4 本の管の脚・足掛けの輪） */
export function roundStool(p: Prop, o: { seat?: string } = {}): void {
  const seat = o.seat ?? WARD.sea;
  p.lathe(seat, [[0, 0], [0.165, 0], [0.18, 0.02], [0.175, 0.05], [0.14, 0.065], [0, 0.065]], [0, 0.42, 0], { seg: 20 });
  p.torus(WARD.steel, [0, 0.415, 0], 0.13, 0.01, { axis: 'y', seg: 18 });
  p.torus(WARD.steel, [0, 0.18, 0], 0.17, 0.008, { axis: 'y', seg: 18, shadow: false });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.785;
    p.rod(WARD.steel, [Math.cos(a) * 0.13, 0.415, Math.sin(a) * 0.13], [Math.cos(a) * 0.2, 0.015, Math.sin(a) * 0.2], 0.012);
    p.cyl(WARD.rubber, [Math.cos(a) * 0.2, 0.01, Math.sin(a) * 0.2], 0.016, 0.02, { seg: 8, shadow: false });
  }
  p.collide([-0.2, 0, -0.2], [0.2, 0.49, 0.2]);
}

/** 風呂の椅子（座の中の切れ目・両横の板の脚） */
export function bathStool(p: Prop, o: { color?: string } = {}): void {
  const c = o.color ?? WARD.white;
  p.extrude(c, roundRect(-0.2, -0.17, 0.2, 0.17, 0.05), 'xz', 0.3, 0.34, { bevel: 0.012, holes: [cwRect(-0.08, -0.025, 0.08, 0.025, 0.02)] });
  for (const sx of [-1, 1]) p.extrude(shade(c, -0.15), [[-0.16, 0], [0.16, 0], [0.13, 0.3], [-0.13, 0.3]], 'zy', sx * 0.17 - 0.015, sx * 0.17 + 0.015, { bevel: 0.008, holes: [[[-0.07, 0.05], [-0.06, 0.18], [0.06, 0.18], [0.07, 0.05]]] });
  p.collide([-0.2, 0, -0.17], [0.2, 0.34, 0.17]);
}

/** たたんだパイプ椅子（壁に立てかける。局所の座標で立てた形） */
export function foldedChair(p: Prop, o: { seat?: string } = {}): void {
  const seat = o.seat ?? WARD.teal;
  p.tube(WARD.steel, [[-0.2, 0, 0], [-0.2, 0.84, 0], [0.2, 0.84, 0], [0.2, 0, 0]], 0.011, { sharp: true });
  p.tube(WARD.steel, [[-0.18, 0, 0.035], [-0.18, 0.52, 0.035], [0.18, 0.52, 0.035], [0.18, 0, 0.035]], 0.01, { sharp: true });
  p.box(seat, [-0.19, 0.24, 0.012], [0.19, 0.62, 0.03], { r: 0.008 });
  p.box(seat, [-0.19, 0.62, -0.012], [0.19, 0.8, 0.008], { r: 0.008 });
  for (const x of [-0.2, 0.2, -0.18, 0.18]) p.cyl(WARD.rubber, [x, 0.012, x === 0.2 || x === -0.2 ? 0 : 0.035], 0.014, 0.024, { seg: 8, shadow: false });
}

/** 掛けた上着・白衣・エプロン（前から見た形を厚みに）。原点は掛け具の点、len は丈 */
export function coat(p: Prop, len: number, col: string, kind: 'coat' | 'apron' = 'coat'): void {
  const pts: V2[] =
    kind === 'coat'
      ? [[-0.06, 0], [-0.18, -0.05], [-0.21, -0.22], [-0.215, -len], [0.215, -len], [0.21, -0.22], [0.18, -0.05], [0.06, 0]]
      : [[-0.05, -0.02], [-0.1, -0.08], [-0.13, -0.3], [-0.21, -0.36], [-0.22, -len], [0.22, -len], [0.21, -0.36], [0.13, -0.3], [0.1, -0.08], [0.05, -0.02]];
  p.extrude(col, pts, 'xy', 0.02, kind === 'coat' ? 0.11 : 0.04, { bevel: kind === 'coat' ? 0.02 : 0.006 });
  if (kind === 'coat') {
    p.extrude(shade(col, -0.3), [[-0.06, -0.005], [0, -0.16], [0.06, -0.005]], 'xy', 0.105, 0.115);
    p.box(shade(col, -0.25), [-0.004, -len + 0.02, 0.106], [0.004, -0.16, 0.114], { shadow: false });
  }
  p.torus(WARD.steel, [0, 0.015, 0.05], 0.015, 0.003, { axis: 'z', seg: 10, arc: Math.PI, shadow: false });
}

/** 机・テーブル（角の丸い天板・幕板・丸い管の脚・脚の先） */
export function table(p: Prop, w: number, d: number, h = 0.72, top: string = WARD.white): void {
  p.box(top, [-w / 2, h - 0.03, -d / 2], [w / 2, h, d / 2], { r: 0.012 });
  p.box(WARD.grey, [-w / 2 + 0.06, h - 0.1, -d / 2 + 0.06], [w / 2 - 0.06, h - 0.03, d / 2 - 0.06], { r: 0.006, shadow: 'receive' });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - 0.06);
      const z = sz * (d / 2 - 0.06);
      p.cyl(WARD.steel, [x, (h - 0.03) / 2, z], 0.022, h - 0.03, { seg: 10 });
      p.cyl(WARD.rubber, [x, 0.01, z], 0.025, 0.02, { seg: 10, shadow: false });
    }
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** パソコンの画面・キーボード・マウス（机の上 y）。画面の幅 w */
export function pcSet(p: Prop, y: number, w = 0.5, o: { keyboard?: boolean } = {}): void {
  p.box(WARD.dark, [-0.1, y, -0.12], [0.1, y + 0.015, 0.04], { r: 0.006 });
  p.box(WARD.dark, [-0.025, y + 0.015, -0.08], [0.025, y + 0.16, -0.05], { r: 0.006 });
  const h = w * 0.6;
  p.box(WARD.dark, [-w / 2, y + 0.1, -0.06], [w / 2, y + 0.1 + h, -0.02], { r: 0.01 });
  p.box('#7f9593', [-w / 2 + 0.012, y + 0.115, -0.02], [w / 2 - 0.012, y + 0.085 + h, -0.017], { shadow: false });
  p.box('#a9bdb9', [-w / 2 + 0.03, y + 0.07 + h - 0.05, -0.016], [w / 2 - 0.12, y + 0.07 + h - 0.035, -0.015], { shadow: false });
  if (o.keyboard !== false) {
    p.box(WARD.pale, [-0.22, y, 0.1], [0.22, y + 0.02, 0.25], { r: 0.006 });
    for (let k = 0; k < 4; k++) p.box(WARD.grey, [-0.2, y + 0.02, 0.115 + k * 0.032], [0.2, y + 0.022, 0.135 + k * 0.032], { shadow: false });
    p.ball(WARD.pale, [0.32, y + 0.012, 0.18], [0.03, 0.015, 0.05], { seg: 10 });
  }
}

/** プリンター（台の上 y）: 胴・上の紙の受け・前の出口・操作の板 */
export function printer(p: Prop, y: number): void {
  p.box(WARD.pale, [-0.22, y, -0.2], [0.22, y + 0.22, 0.2], { r: 0.02 });
  p.box(WARD.grey, [-0.17, y + 0.12, 0.17], [0.17, y + 0.15, 0.205], { r: 0.006 });
  p.box(WARD.paper, [-0.105, y + 0.22, -0.1], [0.105, y + 0.23, 0.15], { shadow: false });
  p.box(WARD.dark, [0.08, y + 0.17, 0.2], [0.2, y + 0.21, 0.204], { r: 0.004, shadow: false });
  p.box('#bfe8c8', [0.1, y + 0.185, 0.204], [0.15, y + 0.2, 0.206], { kind: 'glow', shadow: false });
  p.box(shade(WARD.pale, -0.5), [-0.2, y + 0.06, 0.2], [0.2, y + 0.064, 0.203], { shadow: false });
}

/** かご（脱衣の棚。下がすぼまる・上の縁・取っ手の穴・中のタオル） */
export function basket(p: Prop, w: number, h: number, d: number, col: string): void {
  p.extrude(col, [[-w / 2 + 0.02, 0], [w / 2 - 0.02, 0], [w / 2, h], [-w / 2, h]], 'xy', -d / 2, d / 2, { bevel: 0.008 });
  p.box(shade(col, 0.35), [-w / 2 - 0.006, h - 0.02, -d / 2 - 0.006], [w / 2 + 0.006, h, d / 2 + 0.006], { r: 0.006 });
  p.box(shade(col, -0.7), [-0.05, h - 0.06, d / 2], [0.05, h - 0.035, d / 2 + 0.004], { r: 0.008, shadow: false });
  if (p.r() < 0.5) p.box(p.r() < 0.5 ? WARD.white : WARD.cream, [-w / 2 + 0.03, h - 0.04, -d / 2 + 0.04], [w / 2 - 0.03, h + 0.03, d / 2 - 0.05], { r: 0.025 });
}

/** 湯のみ・マグ */
export function mug(p: Prop, col: string): void {
  p.lathe(col, [[0, 0], [0.033, 0], [0.04, 0.008], [0.04, 0.09], [0.035, 0.09], [0.034, 0.012], [0, 0.012]], [0, 0, 0], { seg: 14 });
  p.torus(col, [0.045, 0.05, 0], 0.022, 0.006, { axis: 'z', seg: 10, arc: Math.PI, shadow: false });
}

/** 手さげの袋（角の丸い胴と 2 本の持ち手） */
export function toteBag(p: Prop, col: string): void {
  p.box(col, [-0.16, 0, -0.06], [0.16, 0.26, 0.06], { r: 0.035 });
  for (const z of [-0.03, 0.03]) p.torus(shade(col, -0.35), [0, 0.25, z], 0.08, 0.008, { axis: 'z', seg: 12, arc: Math.PI, shadow: false });
}

/** バケツとモップ（モップの頭はバケツの中） */
export function bucketMop(p: Prop, o: { color?: string } = {}): void {
  const c = o.color ?? WARD.sea;
  p.lathe(c, [[0, 0], [0.13, 0], [0.135, 0.012], [0.165, 0.28], [0.175, 0.29], [0.168, 0.3], [0.158, 0.29], [0.128, 0.022], [0, 0.022]], [0, 0, 0], { seg: 20, collide: true });
  p.cyl(WARD.mirror, [0, 0.12, 0], 0.145, 0.006, { seg: 18, shadow: false });
  p.torus(WARD.grey, [0, 0.3, 0], 0.17, 0.004, { axis: 'x', seg: 16, arc: Math.PI, shadow: false });
  p.box(WARD.paper, [-0.09, 0.08, -0.06], [0.09, 0.16, 0.06], { r: 0.03 });
  p.rod(WARD.steel, [0.0, 0.15, 0.0], [0.1, 1.35, -0.14], 0.012);
  p.cyl(WARD.dark, [0.1, 1.37, -0.14], 0.016, 0.06, { seg: 8, shadow: false });
}

/** 積み重ねの椅子（デイルーム・カンファレンス室: 管の脚・成形の座と背）。前が +z */
export function stackChair(p: Prop, o: { seat?: string; frame?: string } = {}): void {
  const seat = o.seat ?? WARD.sea;
  const fr = o.frame ?? WARD.steel;
  for (const sx of [-1, 1]) {
    const x = sx * 0.2;
    p.rod(fr, [x, 0.0, 0.2], [x, 0.44, 0.18], 0.011);
    p.tube(fr, [[x, 0.0, -0.21], [x, 0.44, -0.18], [x, 0.86, -0.25]], 0.011, { sharp: true });
    p.rod(fr, [x, 0.43, 0.18], [x, 0.43, -0.18], 0.01);
    for (const z of [0.2, -0.21]) p.cyl(WARD.rubber, [x, 0.008, z], 0.014, 0.016, { seg: 8, shadow: false });
  }
  p.rod(fr, [-0.2, 0.2, 0.19], [0.2, 0.2, 0.19], 0.008);
  // 座（前の縁が少し下がる）と背（少し後ろへ傾く）
  p.extrude(seat, [[-0.21, 0.43], [0.19, 0.43], [0.215, 0.445], [0.2, 0.47], [-0.21, 0.47]], 'zy', -0.22, 0.22, { bevel: 0.01 });
  p.sub([0, 0.6, -0.215], 0, { pitch: -0.14 }).box(seat, [-0.21, 0, -0.012], [0.21, 0.24, 0.012], { r: 0.012 });
  // 当たり判定は座の外形（机の下へ少し入れて並べるので、背の傾きの分は含めない）
  p.collide([-0.22, 0, -0.21], [0.22, 0.87, 0.21]);
}

/** 長椅子（脱衣室・更衣室・ホール: 張った座・鉄の脚の枠） */
export function paddedBench(p: Prop, w: number, o: { seat?: string; frame?: string } = {}): void {
  const seat = o.seat ?? WARD.sea;
  const fr = o.frame ?? WARD.steel;
  p.box(seat, [-w / 2, 0.36, -0.17], [w / 2, 0.44, 0.17], { r: 0.03 });
  p.box(shade(seat, -0.4), [-w / 2 + 0.03, 0.33, -0.15], [w / 2 - 0.03, 0.365, 0.15], { r: 0.008 });
  for (const x of [-w / 2 + 0.14, w / 2 - 0.14]) {
    p.tube(fr, [[x, 0.012, -0.14], [x, 0.33, -0.12], [x, 0.33, 0.12], [x, 0.012, 0.14]], 0.015, { sharp: true });
    p.rod(fr, [x, 0.012, -0.15], [x, 0.012, 0.15], 0.013);
  }
  p.rod(fr, [-w / 2 + 0.14, 0.15, 0], [w / 2 - 0.14, 0.15, 0], 0.012);
  p.collide([-w / 2, 0, -0.17], [w / 2, 0.44, 0.17]);
}

/** 処置台・診察台（張った台・頭の側が少し上がる・下の物入れ・頭の紙のロール）。頭が -x（長さ w は x の向き） */
export function examCouch(p: Prop, w: number, d: number, h: number, o: { pad?: string } = {}): void {
  const pad = o.pad ?? WARD.green;
  p.box(WARD.pale, [-w / 2 + 0.1, 0.0, -d / 2 + 0.06], [w / 2 - 0.1, h - 0.1, d / 2 - 0.06], { r: 0.02 });
  p.box(WARD.dark, [-w / 2 + 0.12, 0, -d / 2 + 0.08], [w / 2 - 0.12, 0.05, d / 2 - 0.08], { r: 0.006 });
  for (const x of [-w / 4, w / 4]) {
    p.box(WARD.white, [x - w / 4 + 0.02, 0.1, d / 2 - 0.06], [x + w / 4 - 0.02, h - 0.14, d / 2 - 0.048], { r: 0.008 });
    p.box(WARD.steel, [x - 0.06, h - 0.2, d / 2 - 0.048], [x + 0.06, h - 0.185, d / 2 - 0.035], { r: 0.004, shadow: false });
  }
  p.box(WARD.steel, [-w / 2, h - 0.1, -d / 2], [w / 2, h - 0.07, d / 2], { r: 0.01 });
  // 張った台（足の側は平ら、頭の側の 0.6 m は少し上がる）
  p.box(pad, [-w / 2 + 0.6, h - 0.07, -d / 2 + 0.01], [w / 2, h, d / 2 - 0.01], { r: 0.03 });
  p.sub([-w / 2 + 0.6, h - 0.07, 0], 0, { roll: -0.18 }).box(pad, [-0.6, 0, -d / 2 + 0.01], [0, 0.07, d / 2 - 0.01], { r: 0.03 });
  // 敷いた紙（ロールから台の上へ）
  p.cyl(WARD.paper, [-w / 2 - 0.02, h - 0.05, 0], 0.045, d - 0.12, { axis: 'z', seg: 12 });
  p.sub([-w / 2 + 0.6, h - 0.07, 0], 0, { roll: -0.18 }).box(WARD.paper, [-0.58, 0.07, -d / 2 + 0.12], [0, 0.074, d / 2 - 0.12], { shadow: false });
  p.box(WARD.paper, [-w / 2 + 0.6, h - 0.002, -d / 2 + 0.12], [0.1, h + 0.002, d / 2 - 0.12], { shadow: false });
  p.collide([-w / 2 - 0.07, 0, -d / 2], [w / 2, h + 0.1, d / 2]);
}

/** 浴槽（縁の厚い槽・中の底と湯・壁の水栓）と機械浴（槽の横の昇降の柱・操作の板・槽の上に渡した担架の台）。背が -z */
export function bathTub(p: Prop, w: number, o: { machine?: boolean } = {}): void {
  const D = 0.9;
  const W0 = WARD.white;
  p.extrude(W0, roundRect(-w / 2, -D / 2, w / 2, D / 2, 0.06), 'xz', 0, 0.6, { bevel: 0.02, holes: [cwRect(-w / 2 + 0.1, -D / 2 + 0.1, w / 2 - 0.1, D / 2 - 0.1, 0.14)] });
  p.box(shade(W0, -0.3), [-w / 2 + 0.1, 0.1, -D / 2 + 0.1], [w / 2 - 0.1, 0.12, D / 2 - 0.1], { r: 0.005, shadow: 'receive' });
  p.box(WARD.mirror, [-w / 2 + 0.11, 0.33, -D / 2 + 0.11], [w / 2 - 0.11, 0.345, D / 2 - 0.11], { r: 0.005, shadow: 'receive' });
  p.cyl(WARD.grey, [-w / 2 + 0.22, 0.125, 0], 0.03, 0.006, { seg: 10, shadow: false });
  // 壁の水栓（混ぜる弁と口）と手すり
  p.box(WARD.steel, [-w / 2 + 0.3, 0.75, -D / 2 - 0.04], [-w / 2 + 0.55, 0.8, -D / 2 + 0.02], { r: 0.012 });
  p.tube(WARD.steel, [[-w / 2 + 0.42, 0.75, -D / 2 + 0.02], [-w / 2 + 0.42, 0.72, -D / 2 + 0.12], [-w / 2 + 0.42, 0.66, -D / 2 + 0.15]], 0.012, { sharp: true });
  p.tube(WARD.steel, [[w / 2 - 0.6, 0.85, -D / 2 - 0.03], [w / 2 - 0.6, 0.85, -D / 2 + 0.03], [w / 2 - 0.15, 0.85, -D / 2 + 0.03], [w / 2 - 0.15, 0.85, -D / 2 - 0.03]], 0.016, { sharp: true });
  if (o.machine) {
    // 昇降の柱（角の丸い白い柱・操作の板・腕）
    const x = w / 2 + 0.19;
    p.box(W0, [x - 0.15, 0, -0.12], [x + 0.15, 1.2, 0.2], { r: 0.04 });
    p.box(WARD.dark, [x - 0.1, 0.95, 0.2], [x + 0.1, 1.1, 0.212], { r: 0.008 });
    for (const [k, c] of [[-0.05, '#9fe0a8'], [0, '#f4f8ea'], [0.05, '#ec7c72']] as [number, string][]) p.box(c, [x + k - 0.018, 0.98, 0.212], [x + k + 0.018, 1.01, 0.216], { r: 0.005, kind: 'glow', shadow: false });
    p.box(WARD.steel, [w / 2 - 0.05, 0.62, -0.06], [x - 0.14, 0.7, 0.06], { r: 0.015 });
    // 槽の上の担架の台（金属の枠・張った台・横の柵）
    p.box(WARD.steel, [-w / 2 + 0.12, 0.62, -0.3], [w / 2 - 0.02, 0.66, 0.3], { r: 0.012 });
    p.box(WARD.green, [-w / 2 + 0.15, 0.66, -0.27], [w / 2 - 0.05, 0.72, 0.27], { r: 0.025 });
    for (const sz of [-1, 1]) p.tube(WARD.steel, [[-w / 2 + 0.3, 0.66, sz * 0.31], [-w / 2 + 0.35, 0.9, sz * 0.31], [w / 2 - 0.25, 0.9, sz * 0.31], [w / 2 - 0.2, 0.66, sz * 0.31]], 0.012, { sharp: true });
    p.collide([-w / 2, 0, -D / 2], [x + 0.15, 1.2, D / 2]);
  } else p.collide([-w / 2, 0, -D / 2], [w / 2, 0.6, D / 2]);
}

/** たたんだおむつ交換台（壁の面 z = 0。角の丸い箱・前の絵の板・上の取っ手のくぼみ・下の蝶番） */
export function changingTable(p: Prop): void {
  p.box(WARD.cream, [-0.45, 0.75, 0], [0.45, 1.35, 0.13], { r: 0.035 });
  p.box(shade(WARD.cream, -0.6), [-0.14, 1.27, 0.12], [0.14, 1.31, 0.136], { r: 0.01, shadow: false });
  p.box(WARD.green, [-0.22, 0.92, 0.128], [0.22, 1.16, 0.134], { r: 0.012, shadow: false });
  p.box(WARD.paper, [-0.17, 0.96, 0.134], [0.17, 1.12, 0.136], { shadow: false });
  for (let k = 0; k < 3; k++) p.box(WARD.ink, [-0.14, 1.07 - k * 0.035, 0.136], [0.05 + k * 0.03, 1.08 - k * 0.035, 0.138], { shadow: false });
  for (const x of [-0.35, 0.35]) p.cyl(WARD.grey, [x, 0.77, 0.12], 0.015, 0.1, { axis: 'x', seg: 8, shadow: false });
}

/** 手を乾かす機械（上から手を入れる口・下の水受け）と紙タオルの箱（壁の面 z = 0）。x は機械の中心 */
export function handDryer(p: Prop, x: number): void {
  p.box(WARD.white, [x - 0.15, 0.95, 0], [x + 0.15, 1.5, 0.2], { r: 0.035 });
  p.box(WARD.dark, [x - 0.12, 1.2, 0.07], [x + 0.12, 1.42, 0.205], { r: 0.02 });
  p.box(WARD.grey, [x - 0.13, 0.97, 0.12], [x + 0.13, 1.03, 0.21], { r: 0.012 });
  p.box('#9fe0a8', [x - 0.03, 1.45, 0.2], [x + 0.03, 1.465, 0.203], { kind: 'glow', shadow: false });
  const t = p.sub([x + 0.44, 0, 0]);
  t.box(WARD.white, [-0.14, 1.2, 0], [0.14, 1.55, 0.12], { r: 0.025 });
  t.box(WARD.screen, [-0.1, 1.3, 0.12], [0.1, 1.48, 0.123], { r: 0.01, shadow: false });
  t.box(WARD.paper, [-0.09, 1.16, 0.04], [0.09, 1.2, 0.07], { r: 0.004 });
}

/** 洗い場の水栓と壁の物（混ぜる水栓・スライドの棒とシャワー・ホース・棚と瓶・鏡）。壁の面 z = 0 */
export function showerSet(p: Prop): void {
  p.box(WARD.steel, [-0.11, 0.72, 0], [0.11, 0.78, 0.05], { r: 0.015 });
  for (const x of [-0.08, 0.08]) p.cyl(WARD.white, [x, 0.75, 0.065], 0.025, 0.03, { axis: 'z', seg: 12 });
  p.tube(WARD.steel, [[0, 0.73, 0.05], [0, 0.7, 0.12], [0, 0.66, 0.13]], 0.009, { sharp: true });
  p.rod(WARD.steel, [0.17, 1.05, 0.04], [0.17, 1.85, 0.04], 0.011);
  for (const y of [1.05, 1.85]) p.box(WARD.steel, [0.15, y - 0.015, 0], [0.19, y + 0.015, 0.04], { r: 0.006 });
  const h = p.sub([0.17, 1.72, 0.06], 0, { pitch: 0.7 });
  h.rod(WARD.steel, [0, -0.14, 0], [0, 0, 0], 0.012);
  h.cyl(WARD.white, [0, 0.01, 0], 0.045, 0.025, { seg: 16 });
  p.tube(WARD.grey, [[0.08, 0.73, 0.04], [0.1, 0.5, 0.08], [0.16, 0.45, 0.1], [0.19, 0.9, 0.11], [0.17, 1.6, 0.11]], 0.008, { seg: 24, radial: 6, shadow: false });
  p.box(WARD.white, [-0.3, 0.92, 0], [0.12, 0.95, 0.12], { r: 0.01 });
  p.lathe(WARD.cream, [[0, 0], [0.03, 0], [0.032, 0.15], [0.012, 0.18], [0, 0.18]], [-0.22, 0.95, 0.06], { seg: 12 });
  p.lathe(WARD.sea, [[0, 0], [0.028, 0], [0.03, 0.13], [0.012, 0.16], [0, 0.16]], [-0.14, 0.95, 0.06], { seg: 12 });
  p.box(WARD.steel, [-0.27, 1.08, 0], [0.08, 1.55, 0.012], { r: 0.008 });
  p.box(WARD.mirror, [-0.25, 1.1, 0.012], [0.06, 1.53, 0.015], { shadow: false });
}
