import * as THREE from 'three';
import { rng, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Frame, Mats } from './frame.ts';
import type { Sign, Signs } from './signs.ts';

/**
 * プールの施設の小物（記号的・寸法は実物）。どれも Frame の局所の座標で「背が -z、正面が +z、中心が原点、床 y = 0」で書く。
 * 色は参考画像の色の表から（白いタイル・青緑・淡い青緑・暗い青緑。差し色は救助用具・消火器の赤と非常口の緑だけ）。
 */
type M = THREE.Material;

export interface Palette {
  white: M;
  whiteTile: M;
  pale: M;
  teal: M;
  tealDark: M;
  dark: M;
  metal: M;
  chrome: M;
  locker: M;
  lockerLine: M;
  wood: M;
  red: M;
  green: M;
  rubber: M;
  glass: M;
  lamp: M;
  screen: M;
  rope: M;
  ropeRed: M;
  float: M;
  steel: M;
  pipe: M;
  pipeBlue: M;
  floorDark: M;
}

export function palette(m: Mats): Palette {
  return {
    white: m.flat('#f1f5ec', '#cdd9cf'),
    whiteTile: m.get({ color: '#eef3e8', shade: '#c9d7cc', dark: '#a4b9ad', hi: '#f6f8f1', tiles: { size: 0.25, line: 0.012, color: '#cfd9cf', jitter: 0.02 } }),
    pale: m.flat('#dbe7e1', '#b7cbc2'),
    teal: m.flat('#7fb1a8', '#5f948c'),
    tealDark: m.flat('#4c7f7c', '#3a6866'),
    dark: m.flat('#2f4a4c', '#243d40'),
    metal: m.flat('#c3cec9', '#9fb0a9'),
    chrome: m.flat('#e2e9e6', '#aebdb7'),
    locker: m.flat('#c9ddd6', '#7fa89f'),
    lockerLine: m.flat('#6f948c', '#4f746d'),
    wood: m.flat('#d9ccae', '#b7a98c'),
    red: m.flat('#cf6a60', '#a9554e'),
    green: m.unlit('#3f9a6a'),
    rubber: m.flat('#3d5658', '#2e4547'),
    glass: m.get({ color: '#cfe6e0', shade: '#b4d0c9', dark: '#9fbdb6', hi: '#e2f1ec', transparent: true, opacity: 0.32, depthWrite: false, line: 0.3 }),
    lamp: m.unlit('#f7fbf5', { line: 0.2 }),
    screen: m.flat('#3a585a', '#2c4648'),
    rope: m.flat('#e9eee9', '#c2cfc8'),
    ropeRed: m.flat('#d47a6c', '#b0625a'),
    float: m.flat('#e3c06a', '#c1a057'),
    steel: m.flat('#a9b8b4', '#869893'),
    pipe: m.flat('#c9d3cf', '#a3b3ad'),
    pipeBlue: m.flat('#6f9fb0', '#557f8f'),
    floorDark: m.flat('#9fb3aa', '#879e95'),
  };
}

export interface Dress {
  ctx: SceneContext;
  p: Palette;
  signs: Signs;
  r: () => number;
}

export function dressOf(ctx: SceneContext, mats: Mats, signs: Signs, seed: number): Dress {
  return { ctx, p: palette(mats), signs, r: rng(seed) };
}

const SH = { shadow: true } as const;

/** 図柄の板（局所の +z を向く。uv はアトラスの範囲） */
export function decal(f: Frame, sg: Sign, center: V3, w: number, h: number, glow = false): THREE.Mesh {
  const uv = sg.uv;
  const mat = glow ? sg.glow : sg.mat;
  const g = new THREE.PlaneGeometry(w, h);
  const at = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < at.count; i++) at.setXY(i, uv[0] + at.getX(i) * (uv[2] - uv[0]), uv[1] + at.getY(i) * (uv[3] - uv[1]));
  g.rotateY((f.k * Math.PI) / 2);
  return f.b.mesh(g, mat, f.w(center), { shadow: 'receive' });
}

/** 床に描いた図柄（上向き） */
export function floorDecal(f: Frame, sg: Sign, center: V3, w: number, d: number): THREE.Mesh {
  const uv = sg.uv;
  const mat = sg.mat;
  const g = new THREE.PlaneGeometry(w, d);
  const at = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < at.count; i++) at.setXY(i, uv[0] + at.getX(i) * (uv[2] - uv[0]), uv[1] + at.getY(i) * (uv[3] - uv[1]));
  g.rotateX(-Math.PI / 2);
  g.rotateY((f.k * Math.PI) / 2);
  return f.b.mesh(g, mat, f.w(center), { shadow: 'receive' });
}

// ---------------------------------------------------------------- プールサイド

/** 監視台（背の高い椅子。足は白い管、座面・背・はしご）。正面 +z がプール */
export function lifeguardChair(d: Dress, f: Frame): void {
  const { p } = d;
  const H = 1.9;
  for (const x of [-0.45, 0.45]) for (const z of [-0.5, 0.35]) f.box(p.white, [x - 0.03, 0, z - 0.03], [x + 0.03, H, z + 0.03], SH);
  for (const y of [0.45, 0.9, 1.35]) {
    f.box(p.white, [-0.45, y - 0.02, -0.53], [0.45, y + 0.02, -0.47], SH);
    f.box(p.white, [-0.42, y - 0.02, 0.33], [0.42, y + 0.02, 0.37], SH);
  }
  f.box(p.teal, [-0.5, H, -0.55], [0.5, H + 0.06, 0.45], { ...SH, collide: true });
  f.box(p.teal, [-0.5, H + 0.06, -0.55], [0.5, H + 0.7, -0.47], SH);
  for (const x of [-0.5, 0.5]) f.box(p.white, [x - 0.025, H + 0.06, -0.5], [x + 0.025, H + 0.4, 0.4], SH);
  // 救助用の浮き（赤い筒）を手すりに掛ける
  f.box(p.red, [0.52, H - 0.5, -0.3], [0.62, H + 0.2, -0.2], SH);
  // 足元の当たり判定
  f.box(p.white, [-0.5, 0, -0.55], [0.5, 0.05, 0.4], { collide: true, shadow: 'receive' });
}

/** プールのはしご（2 本の手すり・3 段の踏み板）。背 -z がプールの壁、正面 +z が水の中。y = 0 が床（プールサイド） */
export function poolLadder(d: Dress, f: Frame, depth: number): void {
  const { p } = d;
  const r = 0.022;
  for (const x of [-0.25, 0.25]) {
    // 床の上の弓（上へ立ち上がり、水の方へ曲がって下りる）
    f.cyl(p.chrome, [x, 0.45, -0.25], r, 0.9, { axis: 'y', shadow: true, segments: 8 });
    f.cyl(p.chrome, [x, 0.9, -0.05], r, 0.42, { axis: 'z', shadow: true, segments: 8 });
    f.cyl(p.chrome, [x, 0.45 - depth / 2, 0.15], r, 0.9 + depth, { axis: 'y', shadow: true, segments: 8 });
  }
  for (let i = 0; i < 3; i++) f.box(p.chrome, [-0.25, -0.25 - i * 0.28, 0.05], [0.25, -0.22 - i * 0.28, 0.2], SH);
}

/** 入水の階段の手すり（床から水の中へ斜めに下りる管。長さ len、段の数 n） */
export function stairRail(d: Dress, f: Frame, len: number, drop: number): void {
  const { p } = d;
  const r = 0.022;
  const a = Math.atan2(drop, len);
  const L = Math.hypot(len, drop);
  f.cyl(p.chrome, [0, 0.9, -0.15], r, 0.9, { axis: 'y', shadow: true, segments: 8 });
  const g = new THREE.CylinderGeometry(r, r, L, 8);
  g.rotateX(Math.PI / 2 - a);
  g.rotateY((f.k * Math.PI) / 2);
  f.b.mesh(g, p.chrome, f.w([0, 0.9 - drop / 2, len / 2 - 0.15]), SH);
  f.cyl(p.chrome, [0, 0.9 - drop - 0.45, len - 0.15], r, 0.9, { axis: 'y', shadow: true, segments: 8 });
}

/** プールサイドのベンチ（白いタイルの台・座面） */
export function deckBench(d: Dress, f: Frame, w: number): void {
  const { p } = d;
  f.box(p.whiteTile, [-w / 2, 0, -0.22], [w / 2, 0.4, 0.22], { ...SH, collide: true });
  f.box(p.pale, [-w / 2 - 0.02, 0.4, -0.24], [w / 2 + 0.02, 0.45, 0.24], SH);
}

/** 床の排水口（暗い格子の板） */
export function drain(d: Dress, f: Frame, w: number, dp: number): void {
  const { p } = d;
  f.box(p.dark, [-w / 2, 0.0, -dp / 2], [w / 2, 0.006, dp / 2], { shadow: 'receive' });
  for (let x = -w / 2 + 0.05; x < w / 2; x += 0.05) f.box(p.steel, [x - 0.008, 0.006, -dp / 2], [x + 0.008, 0.01, dp / 2], { shadow: 'receive' });
}

/** プールの縁の水深の表示（縁の上面に置く板） */
export function depthMark(d: Dress, f: Frame, m: number): void {
  floorDecal(f, d.signs.depth(m), [0, 0.004, 0], 0.4, 0.2);
}

/** 浮き輪・救命浮環を掛けた壁の板 */
export function rescueBoard(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.pale, [-0.45, 1.0, -0.05], [0.45, 2.0, 0], SH);
  const t = new THREE.TorusGeometry(0.28, 0.07, 8, 16);
  t.rotateY((f.k * Math.PI) / 2);
  f.b.mesh(t, p.red, f.w([0, 1.55, 0.05]), SH);
  f.box(p.red, [-0.35, 1.08, 0.0], [0.35, 1.18, 0.1], SH);
}

/** 壁の時計 */
export function clock(d: Dress, f: Frame, y = 2.4, r = 0.25): void {
  f.cyl(d.p.white, [0, y, 0.03], r, 0.06, { axis: 'z', segments: 24 });
  decal(f, d.signs.clock(), [0, y, 0.065], r * 1.8, r * 1.8);
}

/** 壁の掲示（板に紙） */
export function wallNotice(_d: Dress, f: Frame, sg: Sign, w: number, h: number, y: number): void {
  decal(f, sg, [0, y, 0.01], w, h);
}

/** 天井の灯り（細長い光る板と枠） */
export function ceilingLamp(d: Dress, f: Frame, y: number, len = 1.2, w = 0.25): void {
  f.box(d.p.metal, [-len / 2 - 0.03, y - 0.06, -w / 2 - 0.03], [len / 2 + 0.03, y, w / 2 + 0.03], { shadow: false });
  f.box(d.p.lamp, [-len / 2, y - 0.075, -w / 2], [len / 2, y - 0.06, w / 2], { shadow: false });
}

/** 非常口の表示（光る箱） */
export function exitSign(d: Dress, f: Frame, y: number): void {
  f.box(d.p.white, [-0.22, y - 0.08, -0.04], [0.22, y + 0.08, 0.0], { shadow: false });
  decal(f, d.signs.exit(), [0, y, 0.004], 0.42, 0.14, true);
}

/** 消火器（赤い筒）と箱 */
export function extinguisher(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.white, [-0.18, 0, -0.18], [0.18, 0.08, 0.18], SH);
  f.cyl(p.red, [0, 0.33, 0], 0.08, 0.5, { segments: 12, shadow: true });
  f.box(p.dark, [-0.02, 0.58, -0.02], [0.04, 0.66, 0.02], SH);
}

/** AED の箱（壁） */
export function aed(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.white, [-0.25, 1.1, -0.15], [0.25, 1.6, 0], SH);
  f.box(p.red, [-0.22, 1.42, 0], [0.22, 1.56, 0.01], SH);
  f.box(p.glass, [-0.2, 1.14, 0], [0.2, 1.4, 0.012]);
}

/** 植木（鉢と、塊の葉） */
export function plant(d: Dress, f: Frame, s = 1): void {
  const { p, r } = d;
  f.cyl(p.white, [0, 0.25 * s, 0], 0.22 * s, 0.5 * s, { radiusTop: 0.26 * s, segments: 12, shadow: true, collide: true });
  const leaf = d.p.teal;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r();
    const h = (0.7 + r() * 0.5) * s;
    const g = new THREE.SphereGeometry(0.22 * s, 7, 5);
    g.scale(1, 1.6, 1);
    f.b.mesh(g, leaf, f.w([Math.cos(a) * 0.18 * s, 0.5 * s + h * 0.6, Math.sin(a) * 0.18 * s]), SH);
  }
}

/** 自動販売機（背 -z） */
export function vending(d: Dress, f: Frame, kind: 'drink' | 'water' = 'drink'): void {
  const { p } = d;
  f.box(p.white, [-0.5, 0, -0.35], [0.5, 1.83, 0.35], { ...SH, collide: true });
  decal(f, d.signs.machine(kind), [0, 0.95, 0.352], 0.9, 1.75);
}

/** 給水器 */
export function fountain(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.chrome, [-0.2, 0, -0.18], [0.2, 0.85, 0.18], { ...SH, collide: true });
  f.box(p.metal, [-0.22, 0.85, -0.2], [0.22, 0.9, 0.2], SH);
  f.box(p.dark, [-0.12, 0.88, -0.05], [0.12, 0.905, 0.12], SH);
}

/** ごみ箱 */
export function bin(d: Dress, f: Frame): void {
  f.cyl(d.p.pale, [0, 0.35, 0], 0.2, 0.7, { segments: 12, shadow: true });
  f.cyl(d.p.tealDark, [0, 0.71, 0], 0.21, 0.04, { segments: 12 });
}

// ---------------------------------------------------------------- 更衣室・シャワー

/** ロッカーの列（幅 n 個 × 縦 rows 段。背 -z）。番号の札と鍵 */
export function lockers(d: Dress, f: Frame, n: number, rows: number, start: number, w = 0.4, h = 1.8): void {
  const { p, signs } = d;
  const W = n * w;
  f.box(p.locker, [-W / 2, 0.1, -0.5], [W / 2, h, 0], { ...SH, collide: true });
  f.box(p.lockerLine, [-W / 2, 0, -0.5], [W / 2, 0.1, -0.02], SH);
  const rh = (h - 0.1) / rows;
  let k = start;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * w;
    f.box(p.lockerLine, [x0 - 0.004, 0.1, 0], [x0 + 0.004, h, 0.006], { shadow: false });
    for (let j = 0; j < rows; j++) {
      const y0 = 0.1 + j * rh;
      if (i === 0) f.box(p.lockerLine, [-W / 2, y0 - 0.004, 0], [W / 2, y0 + 0.004, 0.006], { shadow: false });
      // 札と鍵
      decal(f, signs.number(k++), [x0 + w * 0.5, y0 + rh - 0.09, 0.008], 0.09, 0.06);
      f.box(p.dark, [x0 + w - 0.07, y0 + rh * 0.5 - 0.04, 0], [x0 + w - 0.05, y0 + rh * 0.5 + 0.04, 0.025], { shadow: false });
      if (d.r() < 0.15) f.box(p.red, [x0 + w - 0.075, y0 + rh * 0.5 - 0.1, 0.02], [x0 + w - 0.045, y0 + rh * 0.5 - 0.05, 0.03], { shadow: false });
    }
  }
}

/** 更衣室のベンチ（木の座面・金属の脚） */
export function bench(d: Dress, f: Frame, w: number, dp = 0.4): void {
  const { p } = d;
  f.box(p.wood, [-w / 2, 0.4, -dp / 2], [w / 2, 0.44, dp / 2], { ...SH, collide: true });
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) f.box(p.metal, [x - 0.03, 0, -dp / 2 + 0.05], [x + 0.03, 0.4, dp / 2 - 0.05], SH);
}

/** 化粧台（カウンター・鏡・ドライヤー・椅子）。幅 w */
export function vanity(d: Dress, f: Frame, w: number): void {
  const { p } = d;
  f.box(p.white, [-w / 2, 0.68, -0.55], [w / 2, 0.73, 0], { ...SH, collide: true });
  f.box(p.pale, [-w / 2, 0, -0.55], [w / 2, 0.68, -0.5], SH);
  f.box(p.glass, [-w / 2 + 0.1, 0.95, -0.55], [w / 2 - 0.1, 1.85, -0.53]);
  f.box(p.chrome, [-w / 2 + 0.08, 0.93, -0.555], [w / 2 - 0.08, 1.87, -0.55], { shadow: false });
  for (let x = -w / 2 + 0.45; x < w / 2 - 0.3; x += 0.9) {
    f.box(p.dark, [x - 0.06, 0.76, -0.5], [x + 0.06, 0.9, -0.44], SH);
    f.cyl(p.dark, [x, 0.85, -0.38], 0.035, 0.18, { axis: 'z', segments: 8 });
    f.cyl(p.pale, [x, 0.22, 0.25], 0.17, 0.44, { segments: 12, shadow: true });
  }
}

/** シャワーの仕切り（ブース 1 つ: 左右の仕切り・シャワーの管と頭・蛇口）。幅 w、奥行き dp */
export function showerStall(d: Dress, f: Frame, w: number, dp: number, wallL: boolean, wallR: boolean): void {
  const { p } = d;
  if (wallL) f.box(p.pale, [-w / 2 - 0.02, 0.1, -dp], [-w / 2 + 0.02, 2.0, 0], { ...SH, collide: true });
  if (wallR) f.box(p.pale, [w / 2 - 0.02, 0.1, -dp], [w / 2 + 0.02, 2.0, 0], { ...SH, collide: true });
  f.cyl(p.chrome, [0, 1.4, -dp + 0.05], 0.015, 1.3, { segments: 8 });
  f.cyl(p.chrome, [0, 2.05, -dp + 0.15], 0.012, 0.22, { axis: 'z', segments: 8 });
  f.cyl(p.chrome, [0, 2.02, -dp + 0.27], 0.07, 0.04, { segments: 12 });
  f.box(p.chrome, [-0.08, 1.0, -dp], [0.08, 1.12, -dp + 0.07], SH);
  f.box(p.white, [0.2, 1.2, -dp], [0.4, 1.32, -dp + 0.12], SH);
}

/** 便所の個室（仕切り 3 面と扉。扉は少し開いている）・便器 */
export function cubicle(d: Dress, f: Frame, w: number, dp: number, wallL: boolean): void {
  const { p } = d;
  if (wallL) f.box(p.pale, [-w / 2 - 0.02, 0.12, -dp], [-w / 2 + 0.02, 2.0, 0], { ...SH, collide: true });
  f.box(p.pale, [w / 2 - 0.02, 0.12, -dp], [w / 2 + 0.02, 2.0, 0], { ...SH, collide: true });
  // 扉（内へ少し開く）
  const g = new THREE.BoxGeometry(w - 0.1, 1.85, 0.03);
  g.translate((w - 0.1) / 2, 0, 0);
  g.rotateY(-0.5);
  g.rotateY((f.k * Math.PI) / 2);
  f.b.mesh(g, p.teal, f.w([-w / 2 + 0.05, 1.05, 0]), SH);
  // 前の柱と上の横木（金属の細い枠）・壁ぎわの足元の暗い帯
  f.box(p.steel, [w / 2 - 0.03, 0, -0.03], [w / 2 + 0.03, 2.1, 0.03], SH);
  f.box(p.steel, [-w / 2, 2.0, -0.03], [w / 2, 2.05, 0.03], SH);
  f.box(p.tealDark, [-w / 2, 0, -dp], [w / 2, 0.12, -dp + 0.03], { shadow: false });
  f.box(p.white, [-0.19, 0, -dp + 0.05], [0.19, 0.42, -dp + 0.65], { ...SH, collide: true });
  f.box(p.white, [-0.2, 0.42, -dp + 0.05], [0.2, 0.47, -dp + 0.68], SH);
  f.box(p.white, [-0.22, 0.6, -dp], [0.22, 0.95, -dp + 0.2], SH);
}

/** 洗面台（陶器の鉢・蛇口・鏡） */
export function washbasin(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.white, [-0.28, 0.72, -0.45], [0.28, 0.85, 0], { ...SH, collide: true });
  f.box(p.chrome, [-0.03, 0.85, -0.42], [0.03, 1.0, -0.36], SH);
  f.box(p.glass, [-0.3, 1.1, -0.45], [0.3, 1.8, -0.43]);
  f.box(p.chrome, [-0.32, 1.08, -0.455], [0.32, 1.82, -0.45], { shadow: false });
}

/** 体重計 */
export function scale(d: Dress, f: Frame): void {
  f.box(d.p.white, [-0.18, 0, -0.18], [0.18, 0.06, 0.18], SH);
  f.box(d.p.dark, [-0.05, 0.06, -0.12], [0.05, 0.065, -0.06], { shadow: false });
}

// ---------------------------------------------------------------- 入口・事務

/** 券売機（背 -z） */
export function ticketMachine(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.pale, [-0.4, 0, -0.35], [0.4, 1.7, 0.3], { ...SH, collide: true });
  f.box(p.teal, [-0.42, 1.7, -0.37], [0.42, 1.85, 0.32], SH);
  decal(f, d.signs.machine('ticket'), [0, 0.95, 0.302], 0.7, 1.4);
}

/** 受付のカウンター（幅 w。客の側が +z） */
export function frontDesk(d: Dress, f: Frame, w: number): void {
  const { p } = d;
  f.box(p.whiteTile, [-w / 2, 0, -0.2], [w / 2, 1.05, 0.2], { ...SH, collide: true });
  f.box(p.teal, [-w / 2 - 0.05, 1.05, -0.3], [w / 2 + 0.05, 1.1, 0.3], SH);
  f.box(p.pale, [-w / 2, 0.72, -0.8], [w / 2, 0.76, -0.2], SH);
  for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) {
    f.box(p.screen, [x - 0.22, 0.78, -0.55], [x + 0.22, 1.1, -0.52], SH);
    f.box(p.dark, [x - 0.03, 0.76, -0.56], [x + 0.03, 0.8, -0.5], SH);
  }
}

/** 入場ゲート（腰の高さの箱の列と、腕木）。通路は局所の x 方向に並ぶ */
export function gates(d: Dress, f: Frame, n: number, pitch = 0.9): void {
  const { p } = d;
  for (let i = 0; i <= n; i++) {
    const x = -((n * pitch) / 2) + i * pitch;
    f.box(p.metal, [x - 0.1, 0, -0.6], [x + 0.1, 1.0, 0.6], { ...SH, collide: true });
    f.box(p.dark, [x - 0.08, 1.0, 0.2], [x + 0.08, 1.02, 0.5], { shadow: false });
    if (i < n) f.box(p.chrome, [x + 0.1, 0.85, -0.03], [x + pitch * 0.5, 0.88, 0.03], SH);
  }
}

/** 下足箱（小さな扉の升目。背 -z） */
export function shoeLockers(d: Dress, f: Frame, n: number, rows: number, start: number): void {
  const { p, signs } = d;
  const w = 0.3;
  const W = n * w;
  const h = rows * 0.3 + 0.1;
  f.box(p.pale, [-W / 2, 0, -0.4], [W / 2, h, 0], { ...SH, collide: true });
  let k = start;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) {
      const x0 = -W / 2 + i * w;
      const y0 = 0.1 + j * 0.3;
      f.box(p.lockerLine, [x0 + 0.01, y0 + 0.01, 0], [x0 + w - 0.01, y0 + 0.012, 0.004], { shadow: false });
      decal(f, signs.number(k++, '#e9efe9'), [x0 + w / 2, y0 + 0.22, 0.006], 0.08, 0.05);
      f.box(p.dark, [x0 + w / 2 - 0.03, y0 + 0.12, 0], [x0 + w / 2 + 0.03, y0 + 0.14, 0.02], { shadow: false });
    }
}

/** 事務机と椅子・端末 */
export function desk(d: Dress, f: Frame, w = 1.4): void {
  const { p } = d;
  f.box(p.pale, [-w / 2, 0.7, -0.35], [w / 2, 0.74, 0.35], { ...SH, collide: true });
  f.box(p.metal, [-w / 2, 0, -0.35], [-w / 2 + 0.4, 0.7, 0.35], SH);
  f.box(p.metal, [w / 2 - 0.04, 0, -0.35], [w / 2, 0.7, 0.35], SH);
  f.box(p.screen, [-0.25, 0.76, -0.25], [0.25, 1.08, -0.22], SH);
  f.box(p.dark, [-0.03, 0.74, -0.26], [0.03, 0.78, -0.2], SH);
  f.box(p.white, [-0.22, 0.74, 0.0], [0.22, 0.76, 0.15], SH);
  chair(d, f.sub(0.1, 0.65, 2));
}

/** 椅子（背もたれ付き。背が -z） */
export function chair(d: Dress, f: Frame, color?: M): void {
  const { p } = d;
  const seat = color ?? p.tealDark;
  f.box(seat, [-0.21, 0.43, -0.2], [0.21, 0.48, 0.2], SH);
  for (const x of [-0.18, 0.18]) for (const z of [-0.17, 0.17]) f.box(p.metal, [x - 0.012, 0, z - 0.012], [x + 0.012, 0.43, z + 0.012], SH);
  f.box(seat, [-0.2, 0.55, -0.21], [0.2, 0.85, -0.18], SH);
}

/** テーブル（4 本脚） */
export function table(d: Dress, f: Frame, w: number, dp: number, h = 0.72): void {
  const { p } = d;
  f.box(p.white, [-w / 2, h - 0.04, -dp / 2], [w / 2, h, dp / 2], { ...SH, collide: true });
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-dp / 2 + 0.05, dp / 2 - 0.05]) f.box(p.metal, [x - 0.02, 0, z - 0.02], [x + 0.02, h - 0.04, z + 0.02], SH);
}

/** 棚（箱・用具を載せる） */
export function shelf(d: Dress, f: Frame, w: number, h: number, dp: number, load: 'box' | 'float' | 'mixed'): void {
  const { p, r } = d;
  for (const x of [-w / 2, w / 2]) f.box(p.steel, [x - 0.02, 0, -dp], [x + 0.02, h, 0], { ...SH, collide: true });
  const n = Math.max(2, Math.round(h / 0.45));
  for (let i = 0; i <= n; i++) {
    const y = 0.1 + (i * (h - 0.15)) / n;
    f.box(p.steel, [-w / 2, y - 0.015, -dp], [w / 2, y + 0.015, 0], SH);
    if (i === n) break;
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.2) {
      const bw = 0.2 + r() * 0.35;
      if (x + bw > w / 2 - 0.04) break;
      const bh = 0.12 + r() * 0.22;
      const kind = load === 'mixed' ? (r() < 0.5 ? 'box' : 'float') : load;
      const mat = kind === 'float' ? (r() < 0.5 ? p.float : r() < 0.5 ? p.teal : p.ropeRed) : r() < 0.6 ? p.pale : p.wood;
      if (r() < 0.85) f.box(mat, [x, y + 0.015, -dp + 0.04], [x + bw, y + 0.015 + bh, -0.03], SH);
      x += bw + 0.03;
    }
  }
}

// ---------------------------------------------------------------- 機械室

/** ろ過装置（砂ろ過の大きな縦型の筒・足・上の配管） */
export function filterTank(d: Dress, f: Frame, r = 0.9, h = 2.4): void {
  const { p } = d;
  f.cyl(p.pipeBlue, [0, 0.35 + h / 2, 0], r, h, { segments: 24, shadow: true, collide: true });
  // 胴のつなぎ目のフランジ（濃い帯）と銘板
  for (const y of [0.45, 0.35 + h * 0.5, 0.25 + h]) f.cyl(p.tealDark, [0, y, 0], r + 0.03, 0.08, { segments: 24, shadow: true });
  f.box(p.white, [-0.18, 1.35, r - 0.02], [0.18, 1.6, r + 0.02], { shadow: false });
  const top = new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  top.scale(1, 0.35, 1);
  f.b.mesh(top, p.pipeBlue, f.w([0, 0.35 + h, 0]), SH);
  for (const a of [0.4, 2.5, 4.6]) f.box(p.steel, [Math.cos(a) * r * 0.8 - 0.05, 0, Math.sin(a) * r * 0.8 - 0.05], [Math.cos(a) * r * 0.8 + 0.05, 0.4, Math.sin(a) * r * 0.8 + 0.05], SH);
  // 計器と弁
  f.cyl(p.white, [0, 0.35 + h + r * 0.35 + 0.1, 0], 0.08, 0.06, { axis: 'z', segments: 12 });
  f.cyl(p.pipe, [r + 0.25, 1.0, 0], 0.11, 0.5, { axis: 'x', segments: 10 });
  f.cyl(p.pipe, [r + 0.25, 2.2, 0], 0.11, 0.5, { axis: 'x', segments: 10 });
}

/** ポンプ（台・電動機・ポンプの胴・つなぐ管） */
export function pump(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.floorDark, [-0.6, 0, -0.35], [0.6, 0.15, 0.35], { ...SH, collide: true });
  f.cyl(p.teal, [-0.2, 0.42, 0], 0.22, 0.6, { axis: 'x', segments: 14, shadow: true });
  f.cyl(p.pipeBlue, [0.32, 0.42, 0], 0.26, 0.3, { axis: 'x', segments: 14, shadow: true });
  f.cyl(p.pipe, [0.32, 0.9, 0], 0.09, 0.7, { segments: 10, shadow: true });
  f.box(p.dark, [-0.45, 0.2, -0.2], [-0.35, 0.65, 0.2], SH);
}

/** 制御盤（扉の箱・計器・灯り） */
export function panel(d: Dress, f: Frame, w = 0.9): void {
  const { p } = d;
  f.box(p.pale, [-w / 2, 0, -0.4], [w / 2, 2.0, 0], { ...SH, collide: true });
  decal(f, d.signs.machine('panel'), [0, 1.2, 0.004], w * 0.86, 1.4);
  f.box(p.metal, [-w / 2, 0, 0], [w / 2, 0.1, 0.02], { shadow: false });
}

/** 薬品の槽（白い筒・ふた・注意の札） */
export function chemTank(d: Dress, f: Frame): void {
  const { p } = d;
  f.cyl(p.white, [0, 0.6, 0], 0.4, 1.2, { segments: 18, shadow: true, collide: true });
  f.cyl(p.pale, [0, 1.22, 0], 0.2, 0.05, { segments: 12 });
  decal(f, d.signs.caution(31), [0, 0.7, 0.402], 0.24, 0.3);
}

/** 天井の近くを走る配管（場面の座標の点を結ぶ管） */
export function pipeRun(d: Dress, f: Frame, pts: V3[], r = 0.08, mat?: M): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...f.w(pts[i]));
    const b = new THREE.Vector3(...f.w(pts[i + 1]));
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    f.b.mesh(g, mat ?? d.p.pipe, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], SH);
    if (i > 0) {
      const s = new THREE.SphereGeometry(r * 1.15, 10, 6);
      f.b.mesh(s, mat ?? d.p.pipe, [a.x, a.y, a.z], SH);
    }
  }
}

// ---------------------------------------------------------------- 25 m プール

/** 飛び込み台（スタート台）。背 -z がプールサイド、正面 +z がプール */
export function startBlock(d: Dress, f: Frame, n: number): void {
  const { p, signs } = d;
  f.box(p.white, [-0.25, 0, -0.35], [0.25, 0.7, 0.1], { ...SH, collide: true });
  f.box(p.teal, [-0.26, 0.7, -0.4], [0.26, 0.75, 0.15], SH);
  f.box(p.chrome, [-0.2, 0.25, 0.12], [-0.17, 0.6, 0.15], SH);
  f.box(p.chrome, [0.17, 0.25, 0.12], [0.2, 0.6, 0.15], SH);
  decal(f, signs.number(n, '#f4f7f2', '#2f5a5a'), [0, 0.5, 0.102], 0.24, 0.16);
}

/** コースロープ（浮きの列）。局所の x 方向に長さ len */
export function laneRope(d: Dress, f: Frame, len: number): void {
  const { p } = d;
  const n = Math.round(len / 0.12);
  // 端の 5 m は赤
  const segs: [number, number, M][] = [[-len / 2, -len / 2 + 5, p.ropeRed], [-len / 2 + 5, len / 2 - 5, p.rope], [len / 2 - 5, len / 2, p.ropeRed]];
  for (const [a, b, mat] of segs) {
    const L = b - a;
    const g = new THREE.CylinderGeometry(0.05, 0.05, L, 10);
    g.rotateZ(Math.PI / 2);
    g.rotateY((f.k * Math.PI) / 2);
    f.b.mesh(g, mat, f.w([(a + b) / 2, 0.01, 0]), { shadow: 'receive' });
  }
  // 浮きの切れ目（暗い輪）
  for (let i = 0; i <= n; i += 4) f.cyl(p.tealDark, [-len / 2 + i * 0.12, 0.01, 0], 0.052, 0.02, { axis: 'x', segments: 10, shadow: false });
}

/** 背泳ぎの旗（2 本の柱の間の綱に三角の旗） */
export function backstrokeFlags(d: Dress, f: Frame, span: number, h = 1.8): void {
  const { p } = d;
  for (const x of [-span / 2, span / 2]) f.cyl(p.chrome, [x, h / 2, 0], 0.03, h, { segments: 8, shadow: true });
  f.box(p.rope, [-span / 2, h - 0.01, -0.005], [span / 2, h + 0.01, 0.005], { shadow: false });
  const tri = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (let x = -span / 2 + 0.2; x < span / 2 - 0.1; x += 0.3) pos.push(x - 0.1, h, 0, x + 0.1, h, 0, x, h - 0.22, 0);
  tri.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  tri.rotateY((f.k * Math.PI) / 2);
  tri.computeVertexNormals();
  const flagMat = d.p.ropeRed;
  f.b.mesh(tri, flagMat, f.w([0, 0, 0]), { shadow: false });
  const tri2 = tri.clone();
  tri2.scale(1, 1, 1);
  const idx = tri2.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < idx.count; i += 3) {
    const ax = idx.getX(i + 1);
    const ay = idx.getY(i + 1);
    const az = idx.getZ(i + 1);
    idx.setXYZ(i + 1, idx.getX(i + 2), idx.getY(i + 2), idx.getZ(i + 2));
    idx.setXYZ(i + 2, ax, ay, az);
  }
  tri2.computeVertexNormals();
  f.b.mesh(tri2, flagMat, f.w([0, 0, 0]), { shadow: false });
}

/** ペースクロック（大きな丸い時計） */
export function paceClock(d: Dress, f: Frame, y: number): void {
  clock(d, f, y, 0.55);
}

// ---------------------------------------------------------------- 救護室・ラウンジ

/** 救護用のベッド */
export function aidBed(d: Dress, f: Frame): void {
  const { p } = d;
  f.box(p.metal, [-0.4, 0, -0.95], [0.4, 0.55, 0.95], { ...SH, collide: true });
  f.box(p.white, [-0.42, 0.55, -0.97], [0.42, 0.68, 0.97], SH);
  f.box(p.pale, [-0.3, 0.68, -0.92], [0.3, 0.76, -0.62], SH);
  f.box(p.teal, [-0.43, 0.6, -0.2], [0.43, 0.7, 0.97], SH);
}

/** 背板（救助用の担架。壁に立てかける） */
export function backboard(d: Dress, f: Frame): void {
  const g = new THREE.BoxGeometry(0.45, 1.85, 0.05);
  g.rotateX(-0.12);
  g.rotateY((f.k * Math.PI) / 2);
  f.b.mesh(g, d.p.float, f.w([0, 0.93, 0.12]), SH);
}

/** ソファ（低い背もたれ） */
export function sofa(d: Dress, f: Frame, w: number): void {
  const { p } = d;
  f.box(p.teal, [-w / 2, 0.1, -0.4], [w / 2, 0.42, 0.4], { ...SH, collide: true });
  f.box(p.teal, [-w / 2, 0.42, -0.4], [w / 2, 0.8, -0.22], SH);
  f.box(p.dark, [-w / 2 + 0.05, 0, -0.35], [w / 2 - 0.05, 0.1, 0.35], SH);
}
