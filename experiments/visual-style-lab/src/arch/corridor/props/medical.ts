import type { Prop } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { WARD } from './mats.ts';

/**
 * 病棟の医療の器材（正面 +z、背 -z、床 y = 0）。寸法は日本の病院の物の実寸から:
 * - 処置・救急カート 幅 0.6〜0.75 m・奥行き 0.45〜0.5 m・高さ 0.95〜1.0 m（引き出しの段・天板の縁・横の押し手・角の当たり・キャスター）
 * - ストレッチャー 全長 1.95 m・幅 0.7 m・高さ 0.65〜0.75 m（台の柱・マットレス・背の上がる頭・柵・押し手）
 * - 車椅子 幅 0.63 m・長さ 1.0 m・座の高さ 0.45 m・後ろの輪 22 型（直径 0.56 m）・前のキャスター 0.15 m
 * - 点滴の柱 高さ 1.9〜2.0 m・脚 5 本（半径 0.27 m）・上の掛け具 4 本・点滴の袋（500 mL: 0.12 × 0.2 m）
 * - 歩行器 幅 0.55 m・高さ 0.85 m。酸素の筒（3.4 L: 直径 0.14 m・高さ 0.85 m）・輸液ポンプ（0.14 × 0.2 m）
 */

/** キャスター（車輪・軸の金具・回る台）。x, z は車輪の下の位置、r は車輪の半径 */
export function caster(p: Prop, x: number, z: number, r = 0.05, o: { yaw?: number; fork?: string } = {}): void {
  const s = p.sub([x, 0, z], o.yaw ?? 0);
  const fork = o.fork ?? WARD.grey;
  const t = r * 0.6;
  s.cyl(WARD.rubber, [0, r, 0], r, t, { axis: 'x', seg: 14, shadow: false });
  s.cyl(WARD.steel, [0, r, 0], r * 0.42, t + 0.006, { axis: 'x', seg: 10, shadow: false });
  for (const sx of [-1, 1]) s.box(fork, [sx * (t / 2 + 0.003) - 0.003, r * 0.9, -0.012], [sx * (t / 2 + 0.003) + 0.003, r * 2 + 0.015, 0.012], { shadow: false });
  s.box(fork, [-t / 2 - 0.008, r * 2 + 0.008, -0.02], [t / 2 + 0.008, r * 2 + 0.024, 0.02], { r: 0.004, shadow: false });
}

export interface CartOpts {
  w?: number;
  d?: number;
  h?: number;
  body?: string;
  /** 引き出しの前の板の色 */
  front?: string;
  /** 'drawers' = 処置カート（引き出しの段）、'emergency' = 救急カート（上に除細動器）、'records' = カルテのカート（ふたの付いた棚） */
  kind?: 'drawers' | 'emergency' | 'records';
}

/** 処置カート・救急カート・カルテのカート */
export function medCart(p: Prop, o: CartOpts = {}): void {
  const W = o.w ?? 0.6;
  const D = o.d ?? 0.48;
  const H = o.h ?? 0.98;
  const body = o.body ?? WARD.green;
  const front = o.front ?? shade(body, 0.35);
  const frame = WARD.grey;
  const kind = o.kind ?? 'drawers';
  const cr = 0.05;
  const y0 = cr * 2 + 0.024;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * (W / 2 - 0.07), sz * (D / 2 - 0.07), cr);
  // 台・角の当たり（丸いゴム）
  p.box(frame, [-W / 2, y0, -D / 2], [W / 2, y0 + 0.045, D / 2], { r: 0.012 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(WARD.rubber, [sx * (W / 2 - 0.02), y0 + 0.022, sz * (D / 2 - 0.02)], 0.03, 0.05, { seg: 12, shadow: false });
  // 胴・天板（後ろと横の縁が立つ）
  const top = H - 0.035;
  p.box(body, [-W / 2 + 0.015, y0 + 0.045, -D / 2 + 0.015], [W / 2 - 0.015, top, D / 2 - 0.02], { r: 0.012 });
  p.box(WARD.white, [-W / 2 - 0.015, top, -D / 2 - 0.015], [W / 2 + 0.015, top + 0.025, D / 2 + 0.015], { r: 0.01 });
  p.box(WARD.white, [-W / 2 - 0.015, top + 0.02, -D / 2 - 0.015], [W / 2 + 0.015, top + 0.06, -D / 2 + 0.01], { r: 0.008 });
  for (const sx of [-1, 1]) p.box(WARD.white, [sx * (W / 2 + 0.015) - 0.0125, top + 0.02, -D / 2 - 0.015], [sx * (W / 2 + 0.015) + 0.0125, top + 0.05, D / 2 + 0.015], { r: 0.008 });
  // 横の押し手（左）・右のごみ袋の掛け具
  for (const z of [-D / 2 + 0.08, D / 2 - 0.08]) p.rod(WARD.steel, [-W / 2, top - 0.08, z], [-W / 2 - 0.06, top - 0.08, z], 0.009);
  p.rod(WARD.steel, [-W / 2 - 0.06, top - 0.08, -D / 2 + 0.06], [-W / 2 - 0.06, top - 0.08, D / 2 - 0.06], 0.014);
  p.box(WARD.steel, [W / 2 - 0.005, top - 0.14, -0.12], [W / 2 + 0.03, top - 0.12, 0.12], { r: 0.006, shadow: false });
  // 前の面: 引き出し（上から浅い段 → 深い段）
  const zf = D / 2 - 0.02;
  if (kind === 'records') {
    // カルテの差し込み（斜めのファイルの列）とふた
    p.box(front, [-W / 2 + 0.03, top - 0.3, zf], [W / 2 - 0.03, top - 0.02, zf + 0.012], { r: 0.006 });
    for (let i = 0; i < 7; i++) {
      const x = -W / 2 + 0.07 + i * ((W - 0.14) / 6);
      p.sub([x, top + 0.02, 0], 0, { roll: 0.06 * (i % 3 - 1) }).box(i % 3 === 0 ? WARD.red : i % 3 === 1 ? WARD.cream : WARD.sea, [-0.012, 0, -D / 2 + 0.06], [0.012, 0.22, D / 2 - 0.08], { r: 0.003 });
    }
  }
  const rows = kind === 'records' ? [0.2, 0.22] : [0.08, 0.08, 0.12, 0.16, 0.2];
  let y = kind === 'records' ? top - 0.32 : top - 0.015;
  for (const h of rows) {
    const b = Math.max(y - h, y0 + 0.06);
    p.box(front, [-W / 2 + 0.03, b + 0.006, zf], [W / 2 - 0.03, y - 0.006, zf + 0.014], { r: 0.006 });
    // 取っ手（上の縁の細い横の溝と、つまみ）
    p.box(shade(front, -0.75), [-W * 0.22, y - 0.03, zf + 0.014], [W * 0.22, y - 0.018, zf + 0.022], { r: 0.004, shadow: false });
    p.box(WARD.paper, [W / 2 - 0.12, y - 0.04, zf + 0.014], [W / 2 - 0.05, y - 0.022, zf + 0.016], { shadow: false });
    y = b;
    if (y <= y0 + 0.07) break;
  }
  if (kind === 'emergency') {
    // 封印の札・上に除細動器（暗い箱・画面・取っ手）・背の板（心臓マッサージの板）
    p.box(WARD.cream, [-0.02, top - 0.12, zf + 0.014], [0.02, top - 0.07, zf + 0.02], { shadow: false });
    const s = p.sub([0.04, top + 0.025, -0.02]);
    s.box(WARD.dark, [-0.17, 0, -0.14], [0.17, 0.16, 0.12], { r: 0.025 });
    s.box(WARD.screen, [-0.14, 0.07, 0.12], [0.02, 0.14, 0.126], { r: 0.004, shadow: false });
    s.box('#bfe8c8', [-0.12, 0.09, 0.126], [0.0, 0.1, 0.128], { kind: 'glow', shadow: false });
    s.box('#e9b56f', [0.05, 0.08, 0.12], [0.08, 0.11, 0.128], { r: 0.006, shadow: false });
    s.box(WARD.red, [0.1, 0.08, 0.12], [0.13, 0.11, 0.128], { r: 0.006, shadow: false });
    s.tube(WARD.dark, [[-0.12, 0.16, -0.02], [-0.12, 0.21, -0.02], [0.12, 0.21, -0.02], [0.12, 0.16, -0.02]], 0.012, { sharp: true });
    p.box(WARD.olive, [-W / 2 + 0.08, H - 0.62, -D / 2 - 0.03], [W / 2 - 0.08, H - 0.08, -D / 2 - 0.012], { r: 0.012 });
    p.box(WARD.dark, [-W / 2 + 0.06, H - 0.4, -D / 2 - 0.034], [W / 2 - 0.06, H - 0.37, -D / 2 - 0.008], { shadow: false });
  } else if (kind === 'drawers') {
    // 天板の上: 膿盆・針の捨て箱（黄色い箱）・消毒綿の缶
    p.box('#e3c06a', [W / 2 - 0.17, top + 0.025, -D / 2 + 0.04], [W / 2 - 0.04, top + 0.17, -D / 2 + 0.16], { r: 0.012 });
    p.box(shade('#e3c06a', -0.5), [W / 2 - 0.15, top + 0.17, -D / 2 + 0.06], [W / 2 - 0.06, top + 0.18, -D / 2 + 0.14], { r: 0.004 });
    p.lathe(WARD.steel, [[0, 0], [0.08, 0], [0.11, 0.025], [0.105, 0.03], [0.075, 0.008], [0, 0.008]], [-0.1, top + 0.025, 0.02], { seg: 18 });
    p.cyl(WARD.white, [0.04, top + 0.075, -D / 2 + 0.1], 0.045, 0.1, { seg: 14 });
    p.cyl(WARD.sea, [0.04, top + 0.13, -D / 2 + 0.1], 0.047, 0.012, { seg: 14 });
  }
  p.collide([-W / 2 - 0.07, 0, -D / 2 - 0.03], [W / 2 + 0.03, H + 0.06, D / 2 + 0.02]);
}

/** ストレッチャー（頭が -z。全長 1.95 m） */
export function stretcher(p: Prop, o: { pad?: string; frame?: string; raised?: number } = {}): void {
  const pad = o.pad ?? WARD.mirror;
  const fr = o.frame ?? WARD.pale;
  const metal = WARD.grey;
  const L = 1.95;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * 0.25, sz * 0.72, 0.075);
  // 台（車輪の上の箱）と 2 本の昇降の柱
  p.box(fr, [-0.3, 0.17, -0.85], [0.3, 0.25, 0.85], { r: 0.03 });
  for (const z of [-0.45, 0.45]) p.box(metal, [-0.06, 0.25, z - 0.05], [0.06, 0.58, z + 0.05], { r: 0.03 });
  // 床の板（金属の枠）・角の当たり
  p.box(metal, [-0.34, 0.58, -L / 2 + 0.02], [0.34, 0.62, L / 2 - 0.02], { r: 0.015 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(WARD.rubber, [sx * 0.33, 0.6, sz * (L / 2 - 0.03)], 0.035, 0.05, { seg: 12, shadow: false });
  // マットレス（足の側は平ら、頭の側は少し上がる）・枕・たたんだ毛布
  const hinge = -0.3;
  p.box(pad, [-0.31, 0.62, hinge], [0.31, 0.7, L / 2 - 0.04], { r: 0.035 });
  const up = o.raised ?? 0.28;
  const hs = p.sub([0, 0.62, hinge], 0, { pitch: up });
  hs.box(pad, [-0.31, 0, -(hinge + L / 2 - 0.04)], [0.31, 0.08, 0.0], { r: 0.035 });
  hs.box(WARD.white, [-0.2, 0.08, -0.55], [0.2, 0.15, -0.25], { r: 0.035 });
  p.box(WARD.cream, [-0.26, 0.7, 0.45], [0.26, 0.78, 0.85], { r: 0.03 });
  p.box(shade(WARD.cream, -0.25), [-0.265, 0.735, 0.45], [0.265, 0.745, 0.851], { shadow: false });
  // 柵（左は上げ、右は下げ）
  for (const sx of [-1, 1]) {
    const yt = sx < 0 ? 0.95 : 0.74;
    const x = sx * 0.355;
    p.tube(WARD.steel, [[x, 0.63, -0.6], [x, yt, -0.55], [x, yt, 0.45], [x, 0.63, 0.5]], 0.011, { sharp: true });
    for (const z of [-0.25, 0.05, 0.3]) p.rod(WARD.steel, [x, 0.63, z], [x, yt, z], 0.007);
  }
  // 足の側の押し手・頭の側の点滴の柱（たたんだ短い柱）
  p.tube(WARD.steel, [[-0.28, 0.6, L / 2 - 0.02], [-0.28, 0.9, L / 2 + 0.02], [0.28, 0.9, L / 2 + 0.02], [0.28, 0.6, L / 2 - 0.02]], 0.013, { sharp: true });
  p.rod(WARD.steel, [-0.32, 0.55, -L / 2 + 0.04], [-0.32, 1.25, -L / 2 + 0.04], 0.011);
  p.rod(WARD.steel, [-0.38, 1.25, -L / 2 + 0.04], [-0.26, 1.25, -L / 2 + 0.04], 0.006);
  p.collide([-0.37, 0, -L / 2 - 0.02], [0.37, 0.95, L / 2 + 0.03]);
}

/** 車椅子（自走式。前が +z） */
export function wheelchair(p: Prop, o: { seat?: string; frame?: string } = {}): void {
  const seat = o.seat ?? WARD.dark;
  const fr = o.frame ?? WARD.steel;
  const R = 0.28;
  const wz = -0.14;
  for (const sx of [-1, 1]) {
    const xw = sx * 0.29;
    // 後ろの輪: タイヤ・リム・ハンドリム・スポーク・軸
    p.torus(WARD.rubber, [xw, R, wz], R - 0.017, 0.017, { axis: 'x', seg: 28 });
    p.torus(fr, [xw, R, wz], R - 0.04, 0.008, { axis: 'x', seg: 28, shadow: false });
    p.torus(fr, [xw + sx * 0.03, R, wz], R - 0.03, 0.007, { axis: 'x', seg: 28, shadow: false });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      p.rod(fr, [xw, R, wz], [xw, R + Math.sin(a) * (R - 0.045), wz + Math.cos(a) * (R - 0.045)], 0.0025, { radial: 4, shadow: false });
    }
    p.cyl(WARD.grey, [xw, R, wz], 0.03, 0.06, { axis: 'x', seg: 12 });
    // 枠: 押し手 → 背の柱 → 下の横棒 → 前の足（キャスターの柱）・座の横の棒
    const x = sx * 0.22;
    p.tube(fr, [[x, 0.93, -0.3], [x, 0.5, -0.24], [x, 0.2, -0.2], [x, 0.2, 0.27]], 0.012, { sharp: true });
    p.tube(fr, [[x, 0.48, -0.24], [x, 0.48, 0.24], [x * 0.85, 0.16, 0.36]], 0.012, { sharp: true });
    p.rod(fr, [x, 0.2, 0.27], [x, 0.48, 0.24], 0.012);
    // 押し手の握り
    p.rod(WARD.rubber, [x, 0.93, -0.3], [x, 0.94, -0.4], 0.016);
    // ひじ掛け（支柱 2 本と暗い板）
    for (const z of [-0.16, 0.12]) p.rod(fr, [x, 0.48, z], [x, 0.67, z], 0.009);
    p.box(seat, [x - 0.03, 0.67, -0.2], [x + 0.03, 0.7, 0.16], { r: 0.012 });
    // 前のキャスター（小さな輪と軸の金具）
    p.cyl(fr, [x, 0.17, 0.3], 0.012, 0.07, { seg: 8 });
    caster(p, x, 0.3, 0.065, { fork: fr });
    // 足のせ
    p.box(seat, [sx * 0.1 - 0.08, 0.13, 0.32], [sx * 0.1 + 0.08, 0.145, 0.44], { r: 0.008 });
  }
  // 座・背（布）・座の下の筋かい
  p.box(seat, [-0.215, 0.47, -0.21], [0.215, 0.5, 0.22], { r: 0.012 });
  p.sub([0, 0.5, -0.24], 0, { pitch: -0.12 }).box(seat, [-0.215, 0, -0.012], [0.215, 0.4, 0.012], { r: 0.01 });
  p.rod(fr, [-0.21, 0.24, -0.02], [0.21, 0.46, -0.02], 0.009);
  p.rod(fr, [0.21, 0.24, -0.02], [-0.21, 0.46, -0.02], 0.009);
  p.collide([-0.33, 0, -0.42], [0.33, 0.95, 0.45]);
}

/** 点滴の柱（5 本脚・上の掛け具 4 本・袋 1〜2 つ・ときどき輸液ポンプ） */
export function ivStand(p: Prop, o: { bags?: number; pump?: boolean } = {}): void {
  const st = WARD.steel;
  p.cyl(WARD.grey, [0, 0.09, 0], 0.04, 0.06, { seg: 12 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    const e: [number, number, number] = [Math.cos(a) * 0.26, 0.06, Math.sin(a) * 0.26];
    p.rod(WARD.grey, [0, 0.09, 0], e, 0.012, { radial: 6 });
    p.ball(WARD.rubber, [e[0], 0.026, e[2]], [0.022, 0.026, 0.022], { seg: 8, shadow: false });
  }
  p.rod(st, [0, 0.1, 0], [0, 1.45, 0], 0.013);
  p.rod(st, [0, 1.4, 0], [0, 1.95, 0], 0.009);
  p.cyl(WARD.grey, [0, 1.42, 0], 0.02, 0.05, { seg: 10 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.785;
    const c = Math.cos(a);
    const s = Math.sin(a);
    p.tube(st, [[0, 1.93, 0], [c * 0.11, 1.95, s * 0.11], [c * 0.13, 1.99, s * 0.13]], 0.005, { sharp: true, shadow: false });
  }
  const nb = o.bags ?? 1 + Math.floor(p.r() * 2);
  for (let k = 0; k < nb; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.785;
    const c = Math.cos(a) * 0.12;
    const sz = Math.sin(a) * 0.12;
    const s = p.sub([c, 1.92, sz], -a + Math.PI / 2);
    // 袋（平たい角の丸い板）・ラベル・下の口と点滴の筒・管
    s.box('#e3efe8', [-0.06, -0.23, -0.015], [0.06, -0.01, 0.015], { r: 0.012 });
    s.box(WARD.paper, [-0.04, -0.17, 0.0145], [0.04, -0.08, 0.017], { shadow: false });
    s.box(WARD.board, [-0.012, -0.012, -0.004], [0.012, 0.012, 0.004], { shadow: false });
    s.cyl(WARD.white, [0, -0.25, 0], 0.006, 0.04, { seg: 6, shadow: false });
    s.cyl('#d5e6e2', [0, -0.3, 0], 0.011, 0.06, { seg: 8, shadow: false });
    s.tube('#d5e6e2', [[0, -0.33, 0], [0.03, -0.6, 0.04], [-0.06, -0.85, 0.06], [-0.1, -0.95, 0.02]], 0.0035, { seg: 16, radial: 4, shadow: false });
  }
  if (o.pump ?? p.r() < 0.35) infusionPump(p.sub([0, 1.02, 0.02]), { clamp: true });
  p.collide([-0.24, 0, -0.24], [0.24, 2.0, 0.24]);
}

/** 輸液ポンプ（白い箱・暗い画面・ボタン・扉の継ぎ目・後ろの留め具）。原点は底の中心 */
export function infusionPump(p: Prop, o: { body?: string; clamp?: boolean } = {}): void {
  const body = o.body ?? WARD.white;
  p.box(body, [-0.07, 0, -0.07], [0.07, 0.2, 0.06], { r: 0.016 });
  p.box(WARD.screen, [-0.05, 0.125, 0.06], [0.05, 0.175, 0.066], { r: 0.004, shadow: false });
  p.box('#bfe8c8', [-0.04, 0.145, 0.066], [0.01, 0.155, 0.068], { kind: 'glow', shadow: false });
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) p.box(j === 2 && i === 0 ? WARD.red : WARD.sea, [-0.045 + j * 0.032, 0.04 + i * 0.035, 0.06], [-0.025 + j * 0.032, 0.062 + i * 0.035, 0.067], { r: 0.004, shadow: false });
  p.box(shade(body, -0.4), [-0.068, 0.105, 0.059], [0.068, 0.11, 0.063], { shadow: false });
  if (o.clamp) {
    p.box(WARD.grey, [-0.025, 0.06, -0.1], [0.025, 0.14, -0.07], { r: 0.006 });
    p.cyl(WARD.grey, [0, 0.1, -0.11], 0.012, 0.03, { axis: 'z', seg: 8, shadow: false });
  }
}

/** シリンジポンプ（横長の低い箱・注射器） */
export function syringePump(p: Prop): void {
  p.box(WARD.white, [-0.14, 0, -0.07], [0.14, 0.1, 0.06], { r: 0.014 });
  p.box(WARD.screen, [0.04, 0.05, 0.06], [0.12, 0.085, 0.065], { r: 0.004, shadow: false });
  p.cyl('#e3efe8', [-0.05, 0.11, 0.0], 0.017, 0.16, { axis: 'x', seg: 10 });
  p.box(WARD.grey, [0.035, 0.1, -0.012], [0.05, 0.13, 0.012], { shadow: false });
}

/** 患者のモニター（暗い縁・画面・波形の光る線・数字・上の取っ手） */
export function vitalMonitor(p: Prop, w = 0.38): void {
  const h = w * 0.78;
  p.box(WARD.dark, [-w / 2, 0, -0.08], [w / 2, h, 0.0], { r: 0.02 });
  p.box('#1f2b2e', [-w / 2 + 0.025, 0.04, 0.0], [w / 2 - 0.025, h - 0.03, 0.004], { shadow: false });
  const cols = ['#9fe0a8', '#e8d77a', '#8fd0e0'];
  for (let i = 0; i < 3; i++) {
    const y = h - 0.07 - i * (h - 0.12) / 3;
    let px = -w / 2 + 0.04;
    let py = y;
    for (let k = 0; k < 7; k++) {
      const nx = px + (w * 0.62) / 7;
      const ny = y + (k % 3 === 1 ? 0.025 : k % 3 === 2 ? -0.012 : 0) * (i === 1 ? 0.5 : 1);
      p.rod(cols[i], [px, py, 0.006], [nx, ny, 0.006], 0.0022, { kind: 'glow', radial: 4, shadow: false });
      px = nx;
      py = ny;
    }
    p.box(cols[i], [w / 2 - 0.1, y - 0.015, 0.004], [w / 2 - 0.045, y + 0.015, 0.006], { kind: 'glow', shadow: false });
  }
  p.tube(WARD.dark, [[-w / 4, h, -0.04], [-w / 4, h + 0.04, -0.04], [w / 4, h + 0.04, -0.04], [w / 4, h, -0.04]], 0.01, { sharp: true });
  p.box(WARD.screen, [-w / 2 + 0.03, 0.008, 0.0], [-w / 2 + 0.09, 0.03, 0.006], { shadow: false });
}

/** 歩行器（アルミの枠・前の車輪・握り） */
export function walker(p: Prop): void {
  const al = '#c9d0c3';
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) p.rod(al, [sx * 0.25, 0.85, sz * 0.2], [sx * 0.27, 0.06, sz * 0.23], 0.012);
    p.rod(al, [sx * 0.25, 0.85, -0.2], [sx * 0.25, 0.85, 0.2], 0.012);
    p.rod(WARD.rubber, [sx * 0.25, 0.855, -0.19], [sx * 0.25, 0.855, 0.0], 0.019);
    p.rod(al, [sx * 0.262, 0.42, -0.215], [sx * 0.262, 0.42, 0.215], 0.009);
    p.cyl(WARD.rubber, [sx * 0.27, 0.02, -0.23], 0.018, 0.04, { seg: 8, shadow: false });
    caster(p, sx * 0.27, 0.23, 0.05, { fork: al });
  }
  p.rod(al, [-0.25, 0.75, 0.205], [0.25, 0.75, 0.205], 0.011);
  p.rod(al, [-0.262, 0.32, 0.215], [0.262, 0.32, 0.215], 0.009);
  p.collide([-0.3, 0, -0.25], [0.3, 0.88, 0.28]);
}

/** 酸素の筒の台車（筒 n 本・後ろの枠・前の留め棒・キャスター）。筒は緑の胴に白い肩 */
export function oxygenCart(p: Prop, o: { n?: number; body?: string } = {}): void {
  const n = o.n ?? 4;
  const body = o.body ?? '#4f7f62';
  const W = n * 0.2 + 0.1;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * (W / 2 - 0.05), sz * 0.14, 0.035);
  p.box(WARD.grey, [-W / 2, 0.095, -0.19], [W / 2, 0.125, 0.19], { r: 0.01 });
  for (const sx of [-1, 1]) p.rod(WARD.grey, [sx * (W / 2 - 0.02), 0.12, -0.17], [sx * (W / 2 - 0.02), 1.0, -0.17], 0.013);
  p.rod(WARD.grey, [-W / 2 + 0.02, 1.0, -0.17], [W / 2 - 0.02, 1.0, -0.17], 0.013);
  for (const y of [0.35, 0.72]) {
    p.rod(WARD.grey, [-W / 2 + 0.02, y, -0.17], [W / 2 - 0.02, y, -0.17], 0.008);
    p.rod(WARD.steel, [-W / 2 + 0.02, y, 0.11], [W / 2 - 0.02, y, 0.11], 0.006, { shadow: false });
    for (const sx of [-1, 1]) p.rod(WARD.grey, [sx * (W / 2 - 0.02), y, -0.17], [sx * (W / 2 - 0.02), y, 0.11], 0.006);
  }
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.15 + i * 0.2;
    const b: [number, number, number] = [x, 0.125, -0.03];
    p.lathe(body, [[0, 0], [0.065, 0], [0.072, 0.015], [0.072, 0.7]], b, { seg: 16 });
    p.lathe(WARD.white, [[0.072, 0.7], [0.066, 0.76], [0.04, 0.81], [0.018, 0.83], [0, 0.83]], b, { seg: 16 });
    p.cyl(WARD.steel, [x, 0.125 + 0.86, -0.03], 0.014, 0.06, { seg: 8 });
    p.torus(WARD.dark, [x, 0.125 + 0.875, -0.03], 0.024, 0.005, { axis: 'y', seg: 14, shadow: false });
    if (i === 0) {
      p.box(WARD.grey, [x - 0.025, 0.125 + 0.85, 0.0], [x + 0.025, 0.125 + 0.92, 0.05], { r: 0.008 });
      p.cyl(WARD.white, [x, 0.125 + 0.9, 0.055], 0.025, 0.012, { axis: 'z', seg: 12, shadow: false });
    }
  }
  p.collide([-W / 2, 0, -0.2], [W / 2, 1.02, 0.2]);
}

/** リネンの袋の台車（金属の枠・布の袋・ふた・足踏み・キャスター） */
export function hamper(p: Prop, o: { bag?: string; lid?: string } = {}): void {
  const bag = o.bag ?? WARD.green;
  const lid = o.lid ?? WARD.sea;
  const fr = WARD.steel;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * 0.27, sz * 0.22, 0.04, { fork: fr });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.rod(fr, [sx * 0.28, 0.1, sz * 0.23], [sx * 0.28, 0.88, sz * 0.23], 0.011);
  for (const y of [0.11, 0.88]) {
    p.rod(fr, [-0.28, y, -0.23], [0.28, y, -0.23], 0.011);
    p.rod(fr, [-0.28, y, 0.23], [0.28, y, 0.23], 0.011);
    p.rod(fr, [-0.28, y, -0.23], [-0.28, y, 0.23], 0.011);
    p.rod(fr, [0.28, y, -0.23], [0.28, y, 0.23], 0.011);
  }
  // 袋（下がふくらむ）と、枠に折り返した口
  p.extrude(bag, [[-0.25, 0.2], [0.25, 0.2], [0.275, 0.4], [0.27, 0.86], [-0.27, 0.86], [-0.275, 0.4]], 'xy', -0.22, 0.22, { bevel: 0.03 });
  p.box(shade(bag, -0.25), [-0.29, 0.8, -0.24], [0.29, 0.875, 0.24], { r: 0.012 });
  // ふた（後ろの蝶番で少し開く）と足踏み
  p.sub([0, 0.9, -0.24], 0, { pitch: -0.35 }).box(lid, [-0.3, 0, 0], [0.3, 0.025, 0.49], { r: 0.012 });
  p.rod(fr, [0, 0.11, 0.23], [0, 0.06, 0.31], 0.008);
  p.box(WARD.rubber, [-0.06, 0.04, 0.29], [0.06, 0.06, 0.34], { r: 0.008, shadow: false });
  p.collide([-0.3, 0, -0.25], [0.3, 0.95, 0.34]);
}

/** リネンのカート（金属の枠・3 段の棚・たたんだリネン・前の覆いの布） */
export function linenCart(p: Prop, o: { w?: number; d?: number; h?: number; cover?: string; linen?: string[] } = {}): void {
  const W = o.w ?? 0.9;
  const D = o.d ?? 0.6;
  const H = o.h ?? 1.15;
  const fr = WARD.steel;
  const cols = o.linen ?? [WARD.white, '#cfe0d6', WARD.cream];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * (W / 2 - 0.05), sz * (D / 2 - 0.05), 0.05, { fork: fr });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.rod(fr, [sx * (W / 2 - 0.02), 0.12, sz * (D / 2 - 0.02)], [sx * (W / 2 - 0.02), H, sz * (D / 2 - 0.02)], 0.012);
  for (const sx of [-1, 1]) p.tube(fr, [[sx * (W / 2 - 0.02), H, -D / 2 + 0.02], [sx * (W / 2 + 0.03), H + 0.03, -0.1], [sx * (W / 2 + 0.03), H + 0.03, 0.1], [sx * (W / 2 - 0.02), H, D / 2 - 0.02]], 0.012, { sharp: true });
  const levels = [0.14, 0.52, 0.88];
  for (const [i, y] of levels.entries()) {
    p.box(WARD.pale, [-W / 2 + 0.01, y, -D / 2 + 0.01], [W / 2 - 0.01, y + 0.02, D / 2 - 0.01], { r: 0.006 });
    const clear = (i < levels.length - 1 ? levels[i + 1] : H) - y - 0.06;
    for (let k = 0; k < 2; k++) {
      const x = -W / 4 + (k * W) / 2;
      const n = 2 + Math.floor(p.r() * Math.max(1, clear / 0.06 - 1));
      const c = cols[Math.floor(p.r() * cols.length)];
      for (let j = 0; j < n; j++) {
        const s = p.sub([x + (p.r() - 0.5) * 0.02, y + 0.02 + j * 0.05, (p.r() - 0.5) * 0.02], (p.r() - 0.5) * 0.05);
        s.box(j % 3 === 2 ? shade(c, -0.2) : c, [-W / 4 + 0.03, 0, -D / 2 + 0.06], [W / 4 - 0.03, 0.048, D / 2 - 0.06], { r: 0.018, shadow: j === n - 1 ? true : 'receive' });
      }
    }
  }
  // 覆いの布（上から前へ半分ほど垂れる）
  const cover = o.cover ?? WARD.sea;
  p.box(cover, [-W / 2, H, -D / 2], [W / 2, H + 0.015, D / 2], { r: 0.006 });
  p.box(cover, [-W / 2, H - 0.45, D / 2 - 0.005], [W / 2, H + 0.015, D / 2 + 0.01], { r: 0.006 });
  p.box(shade(cover, -0.3), [-W / 2, H - 0.45, D / 2 + 0.008], [W / 2, H - 0.42, D / 2 + 0.012], { shadow: false });
  p.collide([-W / 2 - 0.04, 0, -D / 2], [W / 2 + 0.04, H + 0.05, D / 2 + 0.02]);
}

/** 感染性の廃棄物の箱（樹脂の容器・ふた・投入口・印・横の取っ手のくぼみ） */
export function wasteBox(p: Prop, o: { body?: string; h?: number } = {}): void {
  const body = o.body ?? WARD.orange;
  const H = o.h ?? 0.42;
  p.extrude(body, [[-0.17, 0], [0.17, 0], [0.19, H], [-0.19, H]], 'xy', -0.18, 0.18, { bevel: 0.012 });
  p.box(shade(body, -0.2), [-0.205, H - 0.01, -0.195], [0.205, H + 0.045, 0.195], { r: 0.014 });
  p.box(shade(body, -0.7), [-0.12, H + 0.04, -0.05], [0.12, H + 0.05, 0.08], { r: 0.008, shadow: false });
  // 印（白い札に暗い丸）と、横の取っ手のくぼみ
  p.box(WARD.paper, [-0.08, H * 0.4, 0.18], [0.08, H * 0.78, 0.184], { shadow: false });
  p.cyl(WARD.dark, [0, H * 0.62, 0.184], 0.035, 0.004, { axis: 'z', seg: 14, shadow: false });
  p.cyl(WARD.paper, [0, H * 0.62, 0.186], 0.015, 0.004, { axis: 'z', seg: 10, shadow: false });
  for (let k = 0; k < 2; k++) p.box(WARD.ink, [-0.06, H * 0.48 - k * 0.025, 0.184], [0.06, H * 0.48 - k * 0.025 + 0.008, 0.186], { shadow: false });
  for (const sx of [-1, 1]) p.box(shade(body, -0.6), [sx * 0.19 - 0.006, H - 0.12, -0.08], [sx * 0.19 + 0.006, H - 0.08, 0.08], { r: 0.006, shadow: false });
  p.collide([-0.2, 0, -0.19], [0.2, H + 0.05, 0.19]);
}

/** 足踏みのごみ箱（下がすぼまる角の丸い箱・色のふた・前の足踏み・後ろの蝶番） */
export function pedalBin(p: Prop, o: { body?: string; lid?: string; h?: number } = {}): void {
  const body = o.body ?? WARD.white;
  const lid = o.lid ?? WARD.sea;
  const H = o.h ?? 0.52;
  p.extrude(body, [[-0.14, 0.02], [0.14, 0.02], [0.165, H], [-0.165, H]], 'xy', -0.15, 0.15, { bevel: 0.02 });
  p.box(WARD.rubber, [-0.13, 0, -0.14], [0.13, 0.025, 0.14], { r: 0.008 });
  p.box(lid, [-0.175, H, -0.16], [0.175, H + 0.035, 0.16], { r: 0.018 });
  p.box(shade(lid, 0.3), [-0.15, H + 0.03, -0.13], [0.15, H + 0.045, 0.13], { r: 0.012 });
  p.cyl(WARD.grey, [0, H - 0.01, -0.165], 0.012, 0.22, { axis: 'x', seg: 8, shadow: false });
  p.box(WARD.grey, [-0.07, 0.025, 0.14], [0.07, 0.045, 0.21], { r: 0.008, shadow: false });
  p.box(WARD.paper, [-0.07, H * 0.55, 0.155], [0.07, H * 0.75, 0.159], { shadow: false });
  p.box(lid, [-0.07, H * 0.71, 0.159], [0.07, H * 0.75, 0.161], { shadow: false });
  p.collide([-0.17, 0, -0.17], [0.17, H + 0.05, 0.2]);
}

/** 汚物流し（深い流しの台・高い立ち上がり・壁の水栓と洗浄の管）。背が -z（壁 z = -0.31） */
export function sluiceSink(p: Prop): void {
  const W = 0.72;
  p.box(WARD.white, [-W / 2, 0.08, -0.3], [W / 2, 0.8, 0.27], { r: 0.012 });
  p.box(WARD.dark, [-W / 2 + 0.02, 0, -0.28], [W / 2 - 0.02, 0.08, 0.22], { r: 0.006 });
  p.box(shade(WARD.white, -0.6), [-0.002, 0.12, 0.27], [0.002, 0.76, 0.274], { shadow: false });
  for (const sx of [-1, 1]) p.box(WARD.steel, [sx * 0.04 - 0.008, 0.6, 0.27], [sx * 0.04 + 0.008, 0.72, 0.285], { r: 0.004, shadow: false });
  // 上の流し（ステンレスの縁と深い鉢）・立ち上がり
  p.extrude(WARD.steel, [[-W / 2 - 0.01, -0.31], [W / 2 + 0.01, -0.31], [W / 2 + 0.01, 0.3], [-W / 2 - 0.01, 0.3]], 'xz', 0.8, 0.86, {
    bevel: 0.008,
    holes: [[[-0.27, -0.2], [-0.27, 0.21], [0.27, 0.21], [0.27, -0.2]]],
  });
  p.box(shade(WARD.steel, -0.55), [-0.27, 0.62, -0.2], [0.27, 0.64, 0.21]);
  p.box(shade(WARD.steel, -0.3), [-0.27, 0.64, -0.2], [0.27, 0.85, -0.19], { shadow: false });
  p.box(shade(WARD.steel, -0.15), [-0.27, 0.64, 0.2], [0.27, 0.85, 0.21], { shadow: false });
  p.box(WARD.steel, [-W / 2 - 0.01, 0.86, -0.31], [W / 2 + 0.01, 1.25, -0.27], { r: 0.01 });
  // 水栓（壁から出る管と下向きの口・ハンドル）と洗浄の管（壁に沿って上へ・弁）
  p.tube(WARD.steel, [[0.18, 1.12, -0.27], [0.18, 1.12, -0.12], [0.18, 1.04, -0.1]], 0.013, { sharp: true });
  p.box(WARD.steel, [0.13, 1.16, -0.27], [0.23, 1.18, -0.2], { r: 0.006 });
  p.rod(WARD.steel, [-0.2, 1.25, -0.29], [-0.2, 1.95, -0.29], 0.017);
  p.cyl(WARD.grey, [-0.2, 1.55, -0.27], 0.035, 0.1, { seg: 12 });
  p.box(WARD.dark, [-0.2, 1.53, -0.25], [-0.08, 1.56, -0.22], { r: 0.008 });
  p.collide([-W / 2 - 0.01, 0, -0.31], [W / 2 + 0.01, 1.25, 0.3]);
}

/** ベッドパンの洗浄器（背の高い箱・前の扉と取っ手・上の操作の板）。背が -z */
export function bedpanWasher(p: Prop): void {
  const W = 0.6;
  const H = 1.42;
  p.box(WARD.steel, [-W / 2, 0.06, -0.3], [W / 2, H, 0.28], { r: 0.015 });
  p.box(WARD.dark, [-W / 2 + 0.02, 0, -0.28], [W / 2 - 0.02, 0.06, 0.24], { r: 0.006 });
  // 扉（膨らんだ板）・取っ手のレバー・下の点検の板
  p.box(shade(WARD.steel, 0.25), [-W / 2 + 0.04, 0.55, 0.28], [W / 2 - 0.04, 1.08, 0.3], { r: 0.012 });
  p.box(WARD.dark, [-0.16, 1.1, 0.28], [0.16, 1.13, 0.33], { r: 0.01 });
  p.box(shade(WARD.steel, 0.1), [-W / 2 + 0.04, 0.1, 0.28], [W / 2 - 0.04, 0.5, 0.287], { r: 0.008 });
  for (const sx of [-1, 1]) p.box(WARD.dark, [sx * 0.2 - 0.012, 0.44, 0.287], [sx * 0.2 + 0.012, 0.46, 0.292], { shadow: false });
  // 操作の板（暗い帯・表示・ボタン）
  p.box(WARD.dark, [-W / 2 + 0.04, 1.18, 0.28], [W / 2 - 0.04, 1.34, 0.295], { r: 0.008 });
  p.box('#bfe8c8', [-0.2, 1.27, 0.295], [-0.04, 1.31, 0.297], { kind: 'glow', shadow: false });
  for (const [x, c] of [[0.05, '#9fe0a8'], [0.12, '#f4f8ea'], [0.19, '#ec7c72']] as [number, string][]) p.box(c, [x - 0.025, 1.21, 0.295], [x + 0.025, 1.25, 0.3], { r: 0.006, kind: 'glow', shadow: false });
  p.rod(WARD.steel, [0.18, H, -0.24], [0.18, 1.9, -0.24], 0.02);
  p.collide([-W / 2, 0, -0.3], [W / 2, H, 0.33]);
}

/** 体重計（床に置く平たい台・暗い足のせ・表示） */
export function floorScale(p: Prop): void {
  p.box(WARD.white, [-0.18, 0, -0.18], [0.18, 0.05, 0.18], { r: 0.016, collide: true });
  p.box(WARD.olive, [-0.16, 0.048, -0.16], [0.16, 0.056, 0.12], { r: 0.008 });
  p.box(WARD.screen, [-0.05, 0.048, 0.135], [0.05, 0.057, 0.165], { r: 0.004, shadow: false });
  p.box('#bfe8c8', [-0.035, 0.057, 0.142], [0.035, 0.058, 0.158], { kind: 'glow', shadow: false });
}

/** 手指の消毒液の台（丸い台・柱・受け皿・押し出しの瓶・札） */
export function sanitizerStand(p: Prop): void {
  p.lathe(WARD.grey, [[0, 0], [0.16, 0], [0.16, 0.015], [0.04, 0.035], [0, 0.035]], [0, 0, 0], { seg: 20 });
  p.rod(WARD.steel, [0, 0.03, 0], [0, 1.0, 0], 0.016);
  p.lathe(WARD.white, [[0, 0], [0.085, 0], [0.09, 0.03], [0.082, 0.03], [0.075, 0.008], [0, 0.008]], [0, 1.0, 0], { seg: 18 });
  const b = p.sub([0, 1.008, 0]);
  b.lathe(WARD.white, [[0, 0], [0.042, 0], [0.045, 0.01], [0.045, 0.13], [0.03, 0.16], [0.012, 0.17], [0, 0.17]], [0, 0, 0], { seg: 16 });
  b.cyl(WARD.sea, [0, 0.07, 0], 0.046, 0.06, { seg: 16, open: true, shadow: false });
  b.cyl(WARD.white, [0, 0.19, 0], 0.012, 0.04, { seg: 8 });
  b.box(WARD.white, [-0.008, 0.2, -0.008], [0.008, 0.215, 0.05], { r: 0.004 });
  p.box(WARD.white, [-0.09, 0.78, 0.016], [0.09, 0.92, 0.022], { r: 0.004 });
  p.box(WARD.sea, [-0.09, 0.88, 0.022], [0.09, 0.92, 0.024], { shadow: false });
  for (let k = 0; k < 2; k++) p.box(WARD.ink, [-0.06, 0.82 + k * 0.025, 0.022], [0.04 - k * 0.03, 0.83 + k * 0.025, 0.024], { shadow: false });
  p.collide([-0.16, 0, -0.16], [0.16, 1.2, 0.16]);
}

/** 持ち運ぶ機械（吸引器のような: 暗い台と 4 輪・白い本体・上の取っ手・表示）。参考画像 corridor-0 の床の機械の形 */
export function portableUnit(p: Prop): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * 0.1, sz * 0.07, 0.025);
  p.box(WARD.dark, [-0.13, 0.07, -0.09], [0.13, 0.15, 0.09], { r: 0.015 });
  p.box(WARD.white, [-0.14, 0.15, -0.1], [0.14, 0.31, 0.1], { r: 0.025 });
  p.box(WARD.screen, [-0.08, 0.2, 0.1], [0.02, 0.27, 0.104], { r: 0.004, shadow: false });
  p.cyl(WARD.sea, [0.07, 0.235, 0.1], 0.022, 0.012, { axis: 'z', seg: 12, shadow: false });
  p.tube(WARD.grey, [[-0.09, 0.31, 0], [-0.09, 0.38, 0], [0.09, 0.38, 0], [0.09, 0.31, 0]], 0.011, { sharp: true });
  p.cyl('#e3efe8', [0.0, 0.33, -0.04], 0.04, 0.06, { seg: 12 });
  p.collide([-0.15, 0, -0.11], [0.15, 0.39, 0.11]);
}

/** モニターの台車（4 輪の台・2 本の柱・大きな画面・下の棚） */
export function monitorCart(p: Prop): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(p, sx * 0.26, sz * 0.2, 0.04);
  p.box(WARD.grey, [-0.3, 0.1, -0.25], [0.3, 0.14, 0.25], { r: 0.015 });
  for (const sx of [-1, 1]) p.box(WARD.grey, [sx * 0.08 - 0.025, 0.14, -0.04], [sx * 0.08 + 0.025, 1.3, 0.0], { r: 0.008 });
  p.box(WARD.pale, [-0.22, 0.8, -0.1], [0.22, 0.82, 0.12], { r: 0.006 });
  p.box(WARD.dark, [-0.12, 0.82, -0.06], [0.12, 0.86, 0.08], { r: 0.012 });
  p.box(WARD.dark, [-0.48, 1.2, 0.0], [0.48, 1.76, 0.05], { r: 0.015 });
  p.box(WARD.screen, [-0.46, 1.22, 0.05], [0.46, 1.74, 0.053], { shadow: false });
  p.collide([-0.48, 0, -0.25], [0.48, 1.76, 0.25]);
}
