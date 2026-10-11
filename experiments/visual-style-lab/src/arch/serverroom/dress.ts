import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { DOORS, type Rect } from './layout.ts';
import { PAL } from './mats.ts';
import { ledDot } from './props/equipment.ts';
import type { SignAtlas, SignId } from './signs.ts';

/**
 * 写っていない所の作り込み（docs/07）。参考画像の語彙を、部屋の種類ごとの「決まり」で全部の壁と天井に置く。
 * - 大: 腰の帯（暗い腰壁）・巾木・壁の板の継ぎ目の押さえ・壁ぎわのケーブルラック・天井のはしご形ラック・ダクト・配管
 * - 中: 分電盤（ブレーカーの列）・端子箱の群れ・還気の格子・非常灯・火災報知の発信機とベルと表示灯・消火器と札・掲示板・
 *       火災受信機・時計・内線電話・立て管と弁と計器・縦のケーブルラック
 * - 小: コンセント・配管（電線管）・表示の LED・札（注意・保護具・前を空ける）・床の立入注意の縞
 * 色は造りに従う: 板・盤・札ごとの色。面の上に模様の斑は描かない（細かさは部品と継ぎ目で出す）。
 * 参考画像の光の言葉: 暗い青緑の設備と、点々と光るシアンの LED・明るい床。壁は「暗い腰 + 中間の色の上」で、明るい床と暗い設備の幅を作る。
 */

export type WallKind = 'corridor' | 'plant' | 'office' | 'hot' | 'dock' | 'stair';

export interface WallSeg {
  /** 壁の面の上の始点・終点（x, z）と、部屋の内への法線 */
  a: [number, number];
  b: [number, number];
  n: [number, number];
  floorY: number;
  ceil: number;
}

/** 長方形の部屋の 4 面（扉の所を切る）。skip で使わない辺（'n' | 's' | 'w' | 'e'） */
export function roomWalls(rect: Rect, floorY: number, ceil: number, skip: string[] = [], inset = 0): WallSeg[] {
  const [x0, z0, x1, z1] = rect;
  const sides: { k: string; a: [number, number]; b: [number, number]; n: [number, number]; line: number; wall: 'x' | 'z' }[] = [
    { k: 'n', a: [x0, z0 + inset], b: [x1, z0 + inset], n: [0, 1], line: z0 - 0.1, wall: 'x' },
    { k: 's', a: [x1, z1 - inset], b: [x0, z1 - inset], n: [0, -1], line: z1 + 0.1, wall: 'x' },
    { k: 'w', a: [x0 + inset, z1], b: [x0 + inset, z0], n: [1, 0], line: x0 - 0.1, wall: 'z' },
    { k: 'e', a: [x1 - inset, z0], b: [x1 - inset, z1], n: [-1, 0], line: x1 + 0.1, wall: 'z' },
  ];
  const out: WallSeg[] = [];
  for (const s of sides) {
    if (skip.includes(s.k)) continue;
    const along = s.wall === 'x' ? 0 : 1;
    const lo = Math.min(s.a[along], s.b[along]);
    const hi = Math.max(s.a[along], s.b[along]);
    const gaps = DOORS.filter((d) => d.wall === s.wall && Math.abs(d.line - s.line) < 0.06 && d.b > lo && d.a < hi && Math.abs(d.y0 - floorY) < 1.5)
      .map((d) => [d.a - 0.35, d.b + 0.35] as [number, number])
      .sort((p, q) => p[0] - q[0]);
    let u = lo;
    const pieces: [number, number][] = [];
    for (const g of gaps) {
      if (g[0] > u + 0.3) pieces.push([u, g[0]]);
      u = Math.max(u, g[1]);
    }
    if (hi > u + 0.3) pieces.push([u, hi]);
    for (const [p0, p1] of pieces) {
      const pt = (v: number): [number, number] => (s.wall === 'x' ? [v, s.a[1]] : [s.a[0], v]);
      // 始点 → 終点の向きは元の辺の向きに合わせる
      const fwd = s.b[along] > s.a[along];
      out.push({ a: pt(fwd ? p0 : p1), b: pt(fwd ? p1 : p0), n: s.n, floorY, ceil });
    }
  }
  return out;
}

/** 壁の面の局所の座標の Prop（x = 壁に沿う、z = 部屋の内、y = 床から） */
function wallProp(base: Prop, seg: WallSeg): { p: Prop; len: number } {
  const dx = seg.b[0] - seg.a[0];
  const dz = seg.b[1] - seg.a[1];
  const len = Math.hypot(dx, dz);
  // 局所 +x = 壁に沿う向き、+z = 法線。Y 回りの回転 θ: (1,0,0) → (cos θ, 0, -sin θ)
  const yaw = Math.atan2(-dz / len, dx / len);
  // 置き場の座標（場面では原点、見本帳では見本の位置）に重ねる
  const m = base.m.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(seg.a[0], seg.floorY, seg.a[1]));
  // 法線が回した +z と逆なら鏡（ここでは辺の向きを法線に合わせて作っているので確かめだけ）
  const nz = new THREE.Vector3(0, 0, 1).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
  if (nz.x * seg.n[0] + nz.z * seg.n[1] < 0) m.multiply(new THREE.Matrix4().makeScale(1, 1, -1));
  const p = new Prop(base.sink, base.mats, m);
  (p as { r: () => number }).r = base.r;
  return { p, len };
}

/** 札を貼る口（図柄の材質で描く） */
export interface SignSink {
  b: Builder;
  mat: THREE.Material;
  atlas: SignAtlas;
}

/** 局所の座標の Prop の面（+z 向き）に札を貼る（中心 x, y・幅・高さ・壁からの出） */
export function signOn(s: SignSink, p: Prop, id: SignId, x: number, y: number, w: number, h: number, z = 0.012): void {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = s.atlas.uv(id);
  const a = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + (uv[2] - uv[0]) * a.getX(i), uv[1] + (uv[3] - uv[1]) * a.getY(i));
  g.translate(x, y, z);
  g.applyMatrix4(p.m);
  // 鏡の行列（壁の向きを合わせるための反転）では面の向きが裏返るので、三角形の向きを戻す
  if (p.m.determinant() < 0) {
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
  }
  s.b.mesh(g, s.mat, [0, 0, 0], { shadow: false });
}

export interface DressOpts {
  /** 壁の腰の帯の色（材質の帯が無いとき） */
  dado?: string;
  /** 壁ぎわの上のケーブルラック */
  tray?: boolean;
  /** 灯りを足す口（壁の非常灯の光だまり） */
  ctx?: SceneContext;
  /** 腰の帯を材質の板で張る（細かい縦の筋の金属の板。b と組で） */
  b?: Builder;
  dadoMat?: THREE.Material;
  /** 札（注意・消火器・分電盤） */
  signs?: SignSink;
  /** 壁の板の継ぎ目の押さえ（1.2 m おきの縦の帯）を付けない（波板の内張りの部屋など） */
  noJoints?: boolean;
  /** 波板の内張りの横の胴縁（板の重ね目。from の高さから step おき） */
  girts?: { from: number; step: number; color?: string };
}

const NB = { shadow: false as const };

/** 分電盤（幅 0.6・高さ 0.9。扉の窓の奥にブレーカーの 2 列・銘板・注意の札・上へ上がる電線管 4 本） */
function distBoard(p: Prop, x: number, ty: number, s?: SignSink): void {
  const y0 = 0.95;
  const y1 = 1.85;
  p.box('#3f7f94', [x, y0, 0], [x + 0.6, y1, 0.16], { r: 0.008 });
  // 扉の縁（4 辺の框）と窓
  p.box('#2f6a7e', [x + 0.03, y0 + 0.03, 0.16], [x + 0.57, y1 - 0.03, 0.166], NB);
  p.box('#132f3b', [x + 0.07, y0 + 0.22, 0.166], [x + 0.53, y1 - 0.2, 0.17], NB);
  // ブレーカーの 2 列（1 つずつ暗い溝と白いつまみ）
  for (let c = 0; c < 2; c++)
    for (let k = 0; k < 9; k++) {
      const bx = x + 0.1 + c * 0.22;
      const by = y0 + 0.26 + k * 0.047;
      p.box('#1f4656', [bx, by, 0.17], [bx + 0.18, by + 0.04, 0.176], NB);
      p.box(k % 5 === 2 ? PAL.ledAmber : '#d6ecf0', [bx + 0.07, by + 0.012, 0.176], [bx + 0.11, by + 0.028, 0.184], NB);
    }
  // 取っ手・鍵・銘板
  p.box(PAL.steel, [x + 0.53, y0 + 0.4, 0.166], [x + 0.555, y0 + 0.55, 0.19], { r: 0.005, shadow: false });
  p.box(PAL.paper, [x + 0.15, y1 - 0.15, 0.166], [x + 0.45, y1 - 0.08, 0.17], NB);
  ledDot(p, x + 0.5, y1 - 0.11, 0.17, PAL.ledGreen, 0.01);
  if (s) signOn(s, p, p.r() < 0.5 ? 'DB' : 'WARN', x + 0.3, y1 + 0.13, 0.32, 0.16, 0.004);
  // 上へ上がる電線管（盤の天板からケーブルラックへ）と途中の支持金物
  const top = Math.max(y1 + 0.4, ty);
  for (let k = 0; k < 4; k++) p.box(k === 3 ? '#4f8fa2' : '#6aa9bb', [x + 0.08 + k * 0.13, y1, 0.05], [x + 0.11 + k * 0.13, top, 0.08], NB);
  p.box(PAL.steelDark, [x + 0.03, y1 + 0.3, 0.0], [x + 0.57, y1 + 0.33, 0.09], NB);
}

/** 端子箱の群れ（大小 2〜3 個と、間をつなぐ電線管・札） */
function jboxes(p: Prop, x: number, ty: number): number {
  const n = 2 + Math.floor(p.r() * 2);
  let xx = x;
  for (let k = 0; k < n; k++) {
    const w = 0.18 + p.r() * 0.16;
    const h = 0.2 + p.r() * 0.2;
    const y = 1.2 + p.r() * 0.35;
    p.box(k % 2 ? '#356f82' : '#2f7187', [xx, y, 0], [xx + w, y + h, 0.12], { r: 0.008 });
    p.box('#1d5466', [xx + 0.02, y + 0.02, 0.12], [xx + w - 0.02, y + h - 0.02, 0.124], NB);
    p.box(PAL.paper, [xx + 0.03, y + h - 0.06, 0.124], [xx + w - 0.03, y + h - 0.035, 0.127], NB);
    for (const bx of [xx + 0.015, xx + w - 0.025]) for (const by of [y + 0.015, y + h - 0.025]) p.box('#8fb8c2', [bx, by, 0.124], [bx + 0.01, by + 0.01, 0.128], NB);
    if (p.r() < 0.6) ledDot(p, xx + w - 0.04, y + 0.05, 0.124, PAL.led, 0.007);
    // 上の電線管（ケーブルラックへ）
    p.box('#6aa9bb', [xx + w / 2 - 0.012, y + h, 0.04], [xx + w / 2 + 0.012, Math.max(y + h + 0.3, ty), 0.064], NB);
    if (k > 0) p.box('#5f9fb2', [xx - 0.1, y + 0.08, 0.05], [xx, y + 0.1, 0.07], NB);
    xx += w + 0.1;
  }
  return xx - x;
}

/** 火災報知の組（赤い発信機・上のベル・表示灯・下に掛けた消火器と赤い札） */
function fireSet(p: Prop, x: number, H: number, s?: SignSink): void {
  // 発信機（押しボタンの箱）
  p.box(PAL.red, [x, 1.25, 0], [x + 0.12, 1.42, 0.05], { r: 0.008, shadow: false });
  p.box('#e8d8d8', [x + 0.025, 1.3, 0.05], [x + 0.095, 1.37, 0.054], NB);
  p.cyl('#7a2830', [x + 0.06, 1.335, 0.055], 0.018, 0.008, { axis: 'z', seg: 10, shadow: false });
  // 表示灯（赤く光る）とベル
  p.box('#8f3a42', [x + 0.01, 1.5, 0], [x + 0.11, 1.6, 0.03], { r: 0.006, shadow: false });
  ledDot(p, x + 0.06, 1.55, 0.03, PAL.ledRed, 0.022);
  const by = Math.min(H - 0.5, 2.25);
  p.cyl(PAL.red, [x + 0.06, by, 0.03], 0.075, 0.05, { axis: 'z', seg: 14, shadow: false });
  p.cyl('#7a2830', [x + 0.06, by, 0.058], 0.02, 0.012, { axis: 'z', seg: 8, shadow: false });
  // 消火器（壁の掛け具に掛ける）と札
  const ex = x + 0.35;
  p.box(PAL.steelDark, [ex - 0.05, 0.62, 0], [ex + 0.05, 0.66, 0.06], NB);
  p.lathe(PAL.red, [[0, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.42], [0.06, 0.46], [0.02, 0.48], [0, 0.48]], [ex, 0.12, 0.09], { seg: 14, shadow: false });
  p.cyl('#c8d0cc', [ex, 0.62, 0.09], 0.022, 0.04, { seg: 8, shadow: false });
  p.box('#1f2626', [ex - 0.012, 0.62, 0.03], [ex + 0.012, 0.64, 0.13], NB);
  p.box('#f4f4ee', [ex - 0.04, 0.3, 0.163], [ex + 0.04, 0.42, 0.166], NB);
  if (s) signOn(s, p, 'EXT', ex, 1.0, 0.26, 0.13, 0.004);
  else p.box(PAL.red, [ex - 0.13, 0.94, 0], [ex + 0.13, 1.06, 0.006], NB);
}

/** 立て管（冷水の往き・還り・消火）と弁のハンドル・計器・名の帯・支持金物 */
function riser(p: Prop, x: number, H: number, s?: SignSink): void {
  const pipes: [number, number, string][] = [
    [x + 0.08, 0.06, '#5f9fb2'],
    [x + 0.28, 0.06, '#7fb9c8'],
    [x + 0.46, 0.04, '#b4565c'],
  ];
  for (const [px, r, c] of pipes) {
    p.cyl(c, [px, H / 2, 0.12], r, H, { seg: 12, shadow: false });
    // 継ぎ手のフランジ（1.5 m おき）
    for (let y = 0.4; y < H - 0.2; y += 1.5) p.cyl('#2f6a7e', [px, y, 0.12], r + 0.02, 0.03, { seg: 12, shadow: false });
  }
  // 弁（丸いハンドル）と計器（白い文字盤）
  for (const [px, r] of pipes.slice(0, 2)) {
    p.cyl('#2a5a6c', [px, 1.05, 0.12], r + 0.012, 0.14, { seg: 12, shadow: false });
    p.rod(PAL.steelDark, [px, 1.05, 0.12 + r], [px, 1.05, 0.12 + r + 0.12], 0.01, { radial: 6, shadow: false });
    p.torus(PAL.red, [px, 1.05, 0.12 + r + 0.12], 0.08, 0.01, { axis: 'z', seg: 16, shadow: false });
    p.cyl('#e8f4f6', [px + r + 0.03, 1.45, 0.12], 0.045, 0.02, { axis: 'z', seg: 14, shadow: false });
    p.box('#14303c', [px + r + 0.03, 1.45, 0.131], [px + r + 0.06, 1.455, 0.134], NB);
  }
  // 名の帯（矢印の札）
  if (s) signOn(s, p, 'CHW', x + 0.18, 1.75, 0.26, 0.13, 0.19);
  // 支持金物（2 か所の横の帯）
  for (const y of [0.8, 2.0]) p.box(PAL.steelDark, [x - 0.02, y, 0.0], [x + 0.54, y + 0.04, 0.2], NB);
}

/** 縦のケーブルラック（床から上のラックへ）と束 */
function vtray(p: Prop, x: number, ty: number): void {
  const top = Math.max(2.0, ty);
  p.box(PAL.trayHi, [x, 0.1, 0.02], [x + 0.02, top, 0.12], NB);
  p.box(PAL.trayHi, [x + 0.3, 0.1, 0.02], [x + 0.32, top, 0.12], NB);
  for (let y = 0.3; y < top; y += 0.3) p.box(PAL.tray, [x + 0.02, y, 0.03], [x + 0.3, y + 0.02, 0.05], NB);
  const C = [PAL.cable, '#2f8ad0', PAL.cable, '#d8c25a'];
  for (let k = 0; k < 4; k++) p.box(C[k], [x + 0.04 + k * 0.06, 0.1, 0.05], [x + 0.09 + k * 0.06, top, 0.1], { r: 0.02, shadow: false });
}

/** 掲示板（枠と紙） */
function notice(p: Prop, x: number): void {
  p.box('#2f6f84', [x, 1.25, 0], [x + 0.9, 1.85, 0.02], { r: 0.004, shadow: false });
  p.box('#3f86a0', [x + 0.02, 1.27, 0.02], [x + 0.88, 1.83, 0.022], NB);
  for (let k = 0; k < 6; k++) {
    const px = x + 0.05 + (k % 3) * 0.28 + p.r() * 0.03;
    const py = 1.3 + Math.floor(k / 3) * 0.27;
    p.box(k === 4 ? '#e0c64e' : PAL.paper, [px, py, 0.022], [px + 0.2 + p.r() * 0.04, py + 0.2, 0.026], NB);
    p.box('#4a6a78', [px + 0.03, py + 0.14, 0.026], [px + 0.15, py + 0.15, 0.027], NB);
    p.box('#4a6a78', [px + 0.03, py + 0.11, 0.026], [px + 0.12, py + 0.12, 0.027], NB);
  }
}

/** 火災受信機（灰色の盤・表示の窓・LED の列） */
function facp(p: Prop, x: number): void {
  p.box('#9fc0c8', [x, 1.1, 0], [x + 0.5, 1.75, 0.14], { r: 0.01 });
  p.box('#7ea2ac', [x + 0.03, 1.13, 0.14], [x + 0.47, 1.72, 0.144], NB);
  p.box('#173f4f', [x + 0.08, 1.5, 0.144], [x + 0.42, 1.64, 0.148], NB);
  p.box('#5fd0e8', [x + 0.1, 1.52, 0.148], [x + 0.4, 1.62, 0.15], { kind: 'glow', ...NB });
  for (let k = 0; k < 12; k++) ledDot(p, x + 0.1 + (k % 6) * 0.06, 1.38 - Math.floor(k / 6) * 0.05, 0.144, k === 3 ? PAL.ledAmber : PAL.ledGreen, 0.008);
  p.box(PAL.red, [x + 0.08, 1.18, 0.144], [x + 0.42, 1.24, 0.148], NB);
}

/** 内線電話（壁掛けの箱と受話器） */
function phone(p: Prop, x: number): void {
  p.box('#2f6a7e', [x, 1.3, 0], [x + 0.2, 1.55, 0.07], { r: 0.01 });
  p.box('#16303a', [x + 0.03, 1.33, 0.07], [x + 0.08, 1.52, 0.1], { r: 0.012, shadow: false });
  for (let k = 0; k < 9; k++) p.box('#9fc7d0', [x + 0.1 + (k % 3) * 0.028, 1.36 + Math.floor(k / 3) * 0.035, 0.07], [x + 0.12 + (k % 3) * 0.028, 1.38 + Math.floor(k / 3) * 0.035, 0.075], NB);
  ledDot(p, x + 0.16, 1.5, 0.07, PAL.ledGreen, 0.006);
}

/** 還気の格子（上）とコンセント（下） */
function returnGrille(p: Prop, x: number, H: number): void {
  const y0 = Math.min(H - 0.75, 2.2);
  p.box('#2a6a80', [x, y0, 0], [x + 0.6, y0 + 0.36, 0.03], NB);
  for (let k = 0; k < 8; k++) p.box('#173f50', [x + 0.03, y0 + 0.03 + k * 0.04, 0.03], [x + 0.57, y0 + 0.05 + k * 0.04, 0.036], NB);
  p.box('#cfe6ea', [x + 0.2, 0.3, 0], [x + 0.32, 0.38, 0.012], NB);
  p.box('#cfe6ea', [x + 0.36, 0.3, 0], [x + 0.48, 0.38, 0.012], NB);
}

/** 非常灯（白い箱・光る帯） */
function eLight(p: Prop, x: number, H: number): void {
  const y = Math.min(H - 0.45, 2.35);
  p.box('#cfe6ea', [x, y, 0], [x + 0.32, y + 0.1, 0.08], { r: 0.006, shadow: false });
  p.box(PAL.lamp, [x + 0.03, y - 0.01, 0.02], [x + 0.29, y, 0.07], { kind: 'glow', ...NB });
  ledDot(p, x + 0.28, y + 0.05, 0.08, PAL.ledGreen, 0.005);
}

/** 時計 */
function clock(p: Prop, x: number, H: number): void {
  const y = Math.min(H - 0.45, 2.3);
  p.cyl('#2a4a58', [x + 0.15, y, 0.02], 0.15, 0.04, { axis: 'z', seg: 20, shadow: false });
  p.cyl('#e8f4f6', [x + 0.15, y, 0.041], 0.135, 0.004, { axis: 'z', seg: 20, shadow: false });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.box('#14303c', [x + 0.15 + Math.sin(a) * 0.11 - 0.004, y + Math.cos(a) * 0.11 - 0.004, 0.043], [x + 0.15 + Math.sin(a) * 0.11 + 0.004, y + Math.cos(a) * 0.11 + 0.004, 0.045], NB);
  }
  p.box('#14303c', [x + 0.145, y, 0.045], [x + 0.155, y + 0.08, 0.048], NB);
  p.box('#14303c', [x + 0.15, y - 0.005, 0.045], [x + 0.21, y + 0.005, 0.048], NB);
}

/** 注意の札の組（注意・保護具・禁煙。札の間隔をそろえて貼る） */
function signGroup(p: Prop, x: number, s: SignSink, kind: WallKind): void {
  const ids: SignId[] = kind === 'plant' || kind === 'dock' ? ['WARN', 'PPE', 'NOSMK'] : kind === 'hot' ? ['HOT', 'WARN'] : ['NOSMK', 'STAFF'];
  ids.forEach((id, i) => {
    p.box('#d8eef0', [x + i * 0.36 - 0.01, 1.48, 0], [x + i * 0.36 + 0.33, 1.66, 0.008], NB);
    signOn(s, p, id, x + i * 0.36 + 0.16, 1.57, 0.3, 0.15, 0.01);
  });
}

/** 壁 1 面の作り込み（決まり） */
export function dressWall(base: Prop, seg: WallSeg, kind: WallKind, o: DressOpts = {}): void {
  const { p, len } = wallProp(base, seg);
  if (len < 0.4) return;
  const H = seg.ceil;
  const r = p.r;
  const S = o.signs;
  // 巾木と腰の帯（暗い腰壁）・見切りの縁
  p.box('#0f2f3c', [0, 0, 0], [len, 0.1, 0.016], NB);
  if (kind !== 'hot') {
    if (o.b && o.dadoMat) {
      // 腰の帯を金属の板で張る（板の継ぎ目の筋が材質の模様）
      const A = p.w([0, 0.1, 0.004]);
      const B = p.w([len, 1.15, 0.014]);
      o.b.boxMM(o.dadoMat, [Math.min(A[0], B[0]), A[1], Math.min(A[2], B[2])], [Math.max(A[0], B[0]), B[1], Math.max(A[2], B[2])], { shadow: false });
    } else {
      p.box(o.dado ?? '#174a5e', [0, 0.1, 0], [len, 1.15, 0.01], NB);
    }
    p.box('#3d8aa4', [0, 1.15, 0], [len, 1.18, 0.02], NB);
  }
  // 壁の板の継ぎ目の押さえ（1.2 m おきの縦の帯。上の板は淡く、腰の板は濃い）
  if (!o.noJoints) {
    for (let x = 1.2 - (seg.a[0] + seg.a[1]) % 1.2; x < len - 0.05; x += 1.2) {
      if (x < 0.05) continue;
      p.box('#56a6c0', [x - 0.04, 1.18, 0], [x + 0.04, H, 0.024], NB);
      p.box('#2a6c84', [x - 0.005, 1.18, 0.024], [x + 0.005, H, 0.026], NB);
      if (kind !== 'hot') p.box('#0d3040', [x - 0.04, 0.1, 0], [x + 0.04, 1.15, 0.022], NB);
    }
  }
  // 波板の内張りの胴縁（横の重ね目の帯）
  if (o.girts) for (let y = o.girts.from; y < H - 0.25; y += o.girts.step) p.box(o.girts.color ?? '#4f9ab0', [0, y, 0.03], [len, y + 0.07, 0.05], NB);
  // 壁ぎわの上のケーブルラック（受け金物つき）
  const tray = o.tray ?? (kind === 'plant' || kind === 'hot' || kind === 'dock');
  const ty = Math.min(H - 0.35, 2.75);
  if (tray && ty > 2.2) {
    p.box(PAL.trayHi, [0.05, ty, 0.06], [len - 0.05, ty + 0.08, 0.075], NB);
    p.box(PAL.trayHi, [0.05, ty, 0.36], [len - 0.05, ty + 0.08, 0.375], NB);
    for (let x = 0.2; x < len - 0.1; x += 0.3) p.box(PAL.tray, [x, ty, 0.075], [x + 0.022, ty + 0.016, 0.36], NB);
    for (let x = 0.3; x < len - 0.2; x += 1.6) p.box(PAL.steelDark, [x, ty - 0.04, 0], [x + 0.04, ty, 0.4], NB);
    const BUND = [PAL.cable, '#2f8ad0', PAL.cable, '#d8c25a', '#7f9aa4'];
    for (let k = 0; k < 5; k++) p.box(BUND[k], [0.1, ty + 0.016, 0.1 + k * 0.046], [len - 0.1, ty + 0.045 + (k % 2) * 0.015, 0.142 + k * 0.046], { r: 0.012, shadow: false });
  }
  // ホットアイルの壁: 台車の当たりの保護の横木（腰の高さ）
  if (kind === 'hot' && len > 1.2) {
    p.box('#86bfcc', [0.05, 0.82, 0], [len - 0.05, 0.97, 0.035], { r: 0.008, shadow: false });
    for (let x = 0.4; x < len - 0.2; x += 1.2) p.box(PAL.steelDark, [x, 0.84, 0], [x + 0.04, 0.95, 0.04], NB);
  }
  // 横に走る電線管（2〜3 本・支持金物つき。機械の部屋・荷捌き場・廊下・ホットアイルの上の方）
  if (len > 1.2) {
    const runs = kind === 'corridor' || kind === 'office' || kind === 'hot' ? 2 : 3;
    const yb = Math.min(H - 0.75, kind === 'corridor' ? 2.35 : kind === 'hot' ? 1.95 : 2.05);
    for (let k = 0; k < runs; k++) {
      const yy = yb + k * 0.07;
      p.rod(k === 1 ? '#7fb9c8' : '#5f9fb2', [0.05, yy, 0.05], [len - 0.05, yy, 0.05], 0.014, { radial: 6, shadow: false });
    }
    for (let x = 0.4; x < len - 0.2; x += 1.2) p.box(PAL.steelDark, [x, yb - 0.04, 0], [x + 0.03, yb + runs * 0.07, 0.07], NB);
  }
  // 決まった間隔で置く物（扉・端から離す）。部屋の種類ごとの並び
  const SEQ: Record<WallKind, string[]> = {
    plant: ['board', 'jbox', 'fire', 'riser', 'signs', 'vtray', 'grille', 'jbox', 'light', 'board'],
    dock: ['board', 'fire', 'jbox', 'signs', 'vtray', 'light', 'riser', 'grille'],
    corridor: ['notice', 'fire', 'signs', 'facp', 'light', 'clock', 'grille', 'phone', 'jbox'],
    office: ['notice', 'clock', 'signs', 'grille', 'phone', 'light', 'jbox'],
    stair: ['notice', 'fire', 'signs', 'light', 'phone', 'grille', 'clock'],
    hot: [],
  };
  const step = kind === 'corridor' ? 1.0 : kind === 'hot' ? 1.0 : kind === 'plant' ? 0.45 : 0.6;
  let i = Math.floor(r() * 4);
  for (let x = 0.4 + r() * 0.3; x < len - 0.5; x += step * (0.7 + r() * 0.6)) {
    if (kind === 'hot') {
      // ホットアイル: 分電盤（RPP）・縦の電線管・コンセントの帯・札
      const pick = (i++ + Math.floor(r() * 2)) % 5;
      if (pick === 0 && x + 0.85 < len - 0.3) {
        p.box('#3f7f94', [x, 0.1, 0], [x + 0.8, 1.9, 0.32], { r: 0.008 });
        p.box('#2d6a7e', [x + 0.03, 0.15, 0.32], [x + 0.39, 1.85, 0.326], NB);
        p.box('#2d6a7e', [x + 0.41, 0.15, 0.32], [x + 0.77, 1.85, 0.326], NB);
        p.box('#123848', [x + 0.1, 1.45, 0.326], [x + 0.32, 1.6, 0.33], NB);
        ledDot(p, x + 0.15, 1.52, 0.33, PAL.ledGreen, 0.01);
        ledDot(p, x + 0.2, 1.52, 0.33, PAL.ledAmber, 0.01);
        p.box(PAL.paper, [x + 0.5, 1.6, 0.326], [x + 0.7, 1.68, 0.33], NB);
        // 換気の切れ込み（扉の下）
        for (let k = 0; k < 6; k++) p.box('#1d5466', [x + 0.06, 0.25 + k * 0.05, 0.326], [x + 0.36, 0.27 + k * 0.05, 0.33], NB);
        for (let k = 0; k < 6; k++) p.box('#1d5466', [x + 0.44, 0.25 + k * 0.05, 0.326], [x + 0.74, 0.27 + k * 0.05, 0.33], NB);
        x += 0.8;
      } else if (pick === 1 && S) {
        signGroup(p, x, S, 'hot');
        x += 0.7;
      } else if (pick === 2) {
        x += jboxes(p, x, ty);
      } else if (pick === 3) {
        vtray(p, x, ty);
        x += 0.4;
      } else {
        for (let k = 0; k < 3; k++) p.box('#5f9fb2', [x + k * 0.05, 1.3, 0.02], [x + k * 0.05 + 0.025, ty, 0.045], NB);
        p.box('#2f6f84', [x - 0.08, 1.05, 0.0], [x + 0.2, 1.3, 0.1], { r: 0.006 });
        ledDot(p, x + 0.06, 1.22, 0.1, r() < 0.7 ? PAL.ledGreen : PAL.ledRed, 0.008);
      }
      continue;
    }
    const seq = SEQ[kind];
    const pick = seq[i++ % seq.length];
    const room = len - 0.4 - x;
    switch (pick) {
      case 'board':
        if (room < 0.7) continue;
        distBoard(p, x, ty, S);
        x += 0.65;
        break;
      case 'jbox':
        if (room < 0.8) continue;
        x += jboxes(p, x, ty);
        break;
      case 'fire':
        if (room < 0.5) continue;
        fireSet(p, x, H, S);
        x += 0.5;
        break;
      case 'riser':
        if (room < 0.6) continue;
        riser(p, x, H, S);
        x += 0.6;
        break;
      case 'signs':
        if (!S || room < 0.9) continue;
        signGroup(p, x, S, kind);
        x += kind === 'plant' || kind === 'dock' ? 1.05 : 0.7;
        break;
      case 'vtray':
        vtray(p, x, ty);
        x += 0.35;
        break;
      case 'grille':
        if (room < 0.6) continue;
        returnGrille(p, x, H);
        x += 0.6;
        break;
      case 'notice':
        if (room < 0.9) continue;
        notice(p, x);
        x += 0.9;
        break;
      case 'facp':
        if (room < 0.5) continue;
        facp(p, x);
        x += 0.5;
        break;
      case 'clock':
        clock(p, x, H);
        x += 0.3;
        break;
      case 'phone':
        phone(p, x);
        x += 0.2;
        break;
      default:
        eLight(p, x, H);
        x += 0.32;
        break;
    }
  }
}

/** 床の立入注意の縞（黄と黒の斜めの縞の帯。盤・ボンベ・荷台の縁の前） */
export function hatch(p: Prop, x0: number, z0: number, x1: number, z1: number, y = 0): void {
  p.box('#1a2a30', [x0, y + 0.001, z0], [x1, y + 0.004, z1], NB);
  const alongX = x1 - x0 >= z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  for (let u = 0.05; u < len - 0.12; u += 0.24) {
    if (alongX) p.box(PAL.yellow, [x0 + u, y + 0.004, z0 + 0.01], [x0 + u + 0.12, y + 0.006, z1 - 0.01], NB);
    else p.box(PAL.yellow, [x0 + 0.01, y + 0.004, z0 + u], [x1 - 0.01, y + 0.006, z0 + u + 0.12], NB);
  }
}

/**
 * 天井の作り込み（機械の部屋・荷捌き場・階段: 天井の板の下に設備を見せる）。
 * 長い向きに 2 本のはしご形ラック・配管 2 本・ダクト 1 本・吊りボルト。短い向きに消火の枝管と下向きの散水の頭・煙感知器の格子・電線管
 */
export function dressCeiling(p: Prop, rect: Rect, floorY: number, ceil: number, o: { trays?: boolean; duct?: boolean; pipes?: boolean; branches?: boolean } = {}): void {
  const [x0, z0, x1, z1] = rect;
  const alongX = x1 - x0 >= z1 - z0;
  const y = floorY + ceil;
  const span = alongX ? z1 - z0 : x1 - x0;
  const a0 = alongX ? x0 + 0.3 : z0 + 0.3;
  const a1 = alongX ? x1 - 0.3 : z1 - 0.3;
  const at = (u: number, v: number, h: number): [number, number, number] => (alongX ? [u, h, v] : [v, h, u]);
  const c0 = alongX ? z0 : x0;
  const box = (u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, col: string, r = 0): void => {
    const A = at(u0, v0, h0);
    const B = at(u1, v1, h1);
    p.box(col, [Math.min(A[0], B[0]), h0, Math.min(A[2], B[2])], [Math.max(A[0], B[0]), h1, Math.max(A[2], B[2])], { r, shadow: false });
  };
  if (o.trays ?? true) {
    for (const f of [0.3, 0.7]) {
      const v = c0 + span * f;
      const ty = y - 0.45;
      box(a0, a1, v - 0.25, v - 0.23, ty, ty + 0.08, PAL.trayHi);
      box(a0, a1, v + 0.23, v + 0.25, ty, ty + 0.08, PAL.trayHi);
      for (let u = a0 + 0.15; u < a1; u += 0.3) box(u, u + 0.022, v - 0.23, v + 0.23, ty, ty + 0.016, PAL.tray);
      // 載ったケーブルの束（色ごとの束が並ぶ。黒い電源・青と黄の通信・灰色）
      const BUND = [PAL.cable, '#2f8ad0', PAL.cable, '#d8c25a', '#7f9aa4', PAL.cable, '#3aa0e0'];
      for (let k = 0; k < 7; k++) {
        const w0 = v - 0.2 + k * 0.057;
        box(a0 + 0.1, a1 - 0.1, w0, w0 + 0.05, ty + 0.016, ty + 0.05 + (k % 3) * 0.012, BUND[k], 0.012);
      }
      for (let u = a0 + 0.6; u < a1; u += 1.8) {
        box(u, u + 0.012, v - 0.28, v - 0.268, ty, y, PAL.steelDark);
        box(u, u + 0.012, v + 0.268, v + 0.28, ty, y, PAL.steelDark);
        // 受けの形鋼（ラックの下を横切る）
        box(u - 0.02, u + 0.03, v - 0.3, v + 0.3, ty - 0.04, ty, '#2f6474');
      }
    }
  }
  if (o.pipes ?? true) {
    const v = c0 + span * 0.5;
    for (const [dv, col, rr] of [
      [0, '#b4565c', 0.035],
      [0.18, '#5f9fb2', 0.05],
    ] as [number, string, number][]) {
      const A = at(a0, v + dv, y - 0.2);
      const B = at(a1, v + dv, y - 0.2);
      p.rod(col, A, B, rr, { radial: 10, shadow: false });
    }
  }
  if (o.branches ?? true) {
    // 消火の枝管（短い向きに 3 m おき）と下向きの散水の頭（2.4 m おき）
    const v = c0 + span * 0.5;
    for (let u = a0 + 1.0; u < a1; u += 3.0) {
      const A = at(u, c0 + 0.4, y - 0.12);
      const B = at(u, c0 + span - 0.4, y - 0.12);
      p.rod('#b4565c', A, B, 0.016, { radial: 6, shadow: false });
      p.rod('#b4565c', at(u, v, y - 0.2), at(u, v, y - 0.12), 0.02, { radial: 6, shadow: false });
      for (let w = c0 + 0.9; w < c0 + span - 0.5; w += 2.4) {
        const H0 = at(u, w, y - 0.12);
        p.rod('#b4565c', H0, [H0[0], y - 0.3, H0[2]], 0.01, { radial: 6, shadow: false });
        p.cyl('#c8d8dc', [H0[0], y - 0.315, H0[2]], 0.012, 0.03, { seg: 8, shadow: false });
        p.cyl('#c8d8dc', [H0[0], y - 0.335, H0[2]], 0.03, 0.006, { seg: 10, shadow: false });
      }
    }
    // 煙感知器（白い丸。4 m ごとの格子・枝管の間）と、それをつなぐ電線管
    for (let u = a0 + 2.5; u < a1; u += 4.0)
      for (let w = c0 + 1.5; w < c0 + span - 0.8; w += 3.2) {
        const D = at(u, w, y);
        p.cyl('#d8eef0', [D[0], y - 0.025, D[2]], 0.06, 0.05, { seg: 14, shadow: false });
        p.box(PAL.ledRed, [D[0] + 0.02, y - 0.054, D[2] - 0.005], [D[0] + 0.03, y - 0.05, D[2] + 0.005], { kind: 'glow', ...NB });
      }
  }
  if (o.duct ?? true) {
    const v = c0 + span * 0.12;
    box(a0, a1, v - 0.3, v + 0.3, y - 0.55, y - 0.15, '#2f6f86', 0.01);
    for (let u = a0 + 1.2; u < a1; u += 1.2) box(u, u + 0.04, v - 0.31, v + 0.31, y - 0.56, y - 0.14, '#3d8098');
    for (let u = a0 + 2.0; u < a1; u += 4.0) {
      box(u, u + 0.5, v - 0.2, v + 0.2, y - 0.6, y - 0.55, '#7fb9c8');
      for (let k = 0; k < 5; k++) box(u + 0.04 + k * 0.09, u + 0.07 + k * 0.09, v - 0.18, v + 0.18, y - 0.605, y - 0.6, '#173f50');
    }
    // ダクトの吊り
    for (let u = a0 + 0.6; u < a1; u += 2.4) {
      box(u, u + 0.03, v - 0.34, v - 0.31, y - 0.58, y, PAL.steelDark);
      box(u, u + 0.03, v + 0.31, v + 0.34, y - 0.58, y, PAL.steelDark);
      box(u - 0.01, u + 0.04, v - 0.34, v + 0.34, y - 0.6, y - 0.56, PAL.steelDark);
    }
  }
}
