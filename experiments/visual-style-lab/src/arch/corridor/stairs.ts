import * as THREE from 'three';
import { type Builder, rng, type V3 } from '../../scenes/Builder.ts';
import { CAM0 } from '../../scenes/corridor/seg0.ts';
import type { Atlas } from '../../scenes/corridor/kit.ts';
import { lamp } from '../../scenes/corridor/props.ts';
import { bar, paper, scribble } from '../../scenes/corridor/tex.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { type Mats, ZONE_COLORS } from './furnish.ts';
import type { RoomDef } from './layout.ts';
import { trackLamp } from './dress.ts';
import { Leg } from './leg.ts';
import { alarmBox, board, boxStack, conduit, fbox, fcyl, kitFor, lowPole, outlet, paperCluster, sbox, scrap, smokeDet, sprinkler } from './wallkit.ts';
import type { RoomPalette } from './rooms.ts';

/**
 * 階段室（北東・南西の 2 か所。二方向の避難）。扉の内側に一時待避の場所（ベッドのまま待てる広さ）、その奥に折り返し階段（U 字）。
 * 1 階上の踊り場と 1 階下の踊り場まで作り、その先の各階の扉は閉じている（鍵）。階の高さ 3.0 m・蹴上げ 0.167 m・踏面 0.28 m。
 * 座標: 階段室の座標系（原点は待避の場所と階段の境・扉の側の壁の面。local +x が階段の奥、local -z が扉から離れる向き）。
 */

const FLOOR_H = 3.0;
const N_STEP = 9;
const TREAD = 0.28;
const RUN = N_STEP * TREAD; // 2.52

export interface StairFrame {
  origin: V3;
  yaw: number;
  /** 待避の場所の幅（local x の負の側） */
  refuge: number;
  /** 階段の部分の長さ（local x の正の側） */
  shaft: number;
  /** 部屋の奥行き（local z の負の側） */
  depth: number;
}

export function buildStairHall(b: Builder, ctx: SceneContext, r: RoomDef, fr: StairFrame, p: RoomPalette, mats: Mats, atlas: Atlas, paperMat: THREE.Material): void {
  const f = new Leg(b, ctx, fr.origin, CAM0, fr.yaw);
  const c = ZONE_COLORS[r.zone];
  const concrete = mats.get('#c9cfbd', '#a9b19f', 0.4);
  const tread = mats.get('#b9c4ad', '#97a28f', 0.5);
  const nosing = mats.get(c.base, undefined, 0.6);
  const wall = p.wall;
  const rail = mats.get('#9fae98', undefined, 1);
  const door = mats.get('#7a8f86', undefined, 1);
  const H = r.h;
  const L = fr.shaft;
  const D = fr.depth;
  const top = 5.9;
  const bot = -3.2;
  const land = 1.5; // 各階の踊り場（扉の前）の長さ
  const fx0 = land;
  const fx1 = land + RUN;
  // 帯（z）: 帯 1 は扉の側、帯 2 は奥。間に仕切りの壁
  const b1: [number, number] = [-1.55, -0.1];
  const b2: [number, number] = [-3.15, -1.7];
  const sz = -3.25; // 階段の奥の壁（物置との境）

  // 待避の場所の床・天井（階段の部分の上下は空ける）
  f.faces([-fr.refuge, -0.2, -D], [0, 0, 0], { py: p.floor }, { collide: true });
  f.faces([-fr.refuge, H, -D], [0, H + 0.1, 0], { ny: p.ceil });
  // 物置（鍵）: 階段の奥（z < sz）。待避の場所の側の壁と扉
  f.faces([0, 0, -D], [0.15, H, sz], { nx: wall }, { collide: true });
  f.faces([-0.02, 0, -D + 0.8], [0, 2.0, -D + 1.7], { nx: door }, {});
  f.faces([-0.05, 0.95, -D + 0.9], [-0.02, 1.0, -D + 1.2], { nx: rail, py: rail });
  f.faces([0, -0.2, -D], [L, H, sz - 0.15], {}, { collide: true });
  f.faces([0, -0.2, -D], [L, 0, sz - 0.15], { py: p.floor });
  f.faces([0, H, -D], [L, H + 0.1, sz - 0.15], { ny: p.ceil });
  // 物置の上の天井（待避の場所と同じ高さ。階段の部分からは見えない）
  // 階段の部分の壁: 扉の側（z = 0）・奥（z = sz）・端（x = L）・待避の場所の側（x = 0。床より下と天井より上）
  f.faces([0, bot, 0], [L, 0, 0.3], { nz: wall }, { collide: true });
  f.faces([0, H, 0], [L, top, 0.3], { nz: wall }, { collide: true });
  f.faces([0, bot, sz - 0.15], [L, top, sz], { pz: wall }, { collide: true });
  f.faces([L, bot, sz], [L + 0.3, 0, 0], { nx: wall }, { collide: true });
  f.faces([L, H, sz], [L + 0.3, top, 0], { nx: wall }, { collide: true });
  f.faces([-0.15, bot, sz], [0, -0.2, 0], { px: wall }, { collide: true });
  f.faces([-0.15, H, sz], [0, top, 0], { px: wall }, { collide: true });
  f.faces([0, top, sz], [L, top + 0.1, 0], { ny: p.ceil });
  f.faces([0, bot - 0.1, sz], [L, bot, 0], { py: concrete });
  // 上の階・下の階の扉（鍵。待避の場所の側の壁）
  for (const y of [-FLOOR_H, FLOOR_H]) {
    f.faces([0, y, -1.45], [0.02, y + 2.05, -0.25], { px: door }, {});
    f.faces([0.02, y + 0.95, -1.35], [0.05, y + 1.0, -1.0], { px: rail, py: rail });
    f.faces([0, y + 2.05, -1.5], [0.03, y + 2.1, -0.2], { px: mats.get(c.frame, undefined, 0.8), ny: mats.get(c.frame, undefined, 0.8) });
  }
  // 各階の踊り場の階の表示（扉の横の板）
  const plate = mats.get('#3f5159', undefined, 0.6);
  const plateIn = mats.get('#e8ecc7', undefined, 0.3);
  for (const y of [-FLOOR_H, 0, FLOOR_H]) {
    f.faces([0.3, y + 1.55, sz], [0.75, y + 1.95, sz + 0.015], { pz: plate, px: plate, nx: plate, py: plate });
    f.faces([0.38, y + 1.62, sz + 0.015], [0.67, y + 1.88, sz + 0.02], { pz: plateIn });
  }
  // 端の壁の窓（踊り場の高さ）
  for (const y of [-FLOOR_H / 2 + 0.6, FLOOR_H / 2 + 0.6]) {
    f.faces([L - 0.01, y, -2.6], [L, y + 1.0, -0.7], { nx: p.sky }, {});
    f.faces([L - 0.05, y - 0.04, -2.65], [L, y, -0.65], { nx: p.frame, py: p.frame });
  }

  // 踊り場（各階は x 0〜land、折り返しは fx1〜L）
  const slab = (x0: number, x1: number, y: number): void => {
    // 踊り場・段・仕切りの壁は影を落とす（下の踊り場と壁に段の影の斜めの帯。参考画像の切り絵の影）
    f.faces([x0, y - 0.2, b2[0]], [x1, y, b1[1]], { py: concrete, ny: concrete, px: concrete, nx: concrete }, { collide: true, shadow: true });
  };
  slab(0, land, 0);
  slab(0, land, FLOOR_H);
  slab(0, land, -FLOOR_H);
  slab(fx1, L, FLOOR_H / 2);
  slab(fx1, L, -FLOOR_H / 2);
  // 段（板の厚さ 0.22 の斜めの段。下を人が通れる）
  const flight = (band: [number, number], xa: number, ya: number, xb: number, yb: number): void => {
    const rh = (yb - ya) / N_STEP;
    const dir = Math.sign(xb - xa);
    for (let k = 0; k < N_STEP; k++) {
      const x0 = xa + dir * k * TREAD;
      const x1 = x0 + dir * TREAD;
      // 上り: 段の上面は ya + (k+1) rh。下り（ya > yb）でも同じ式で段が下がる
      const yt = rh > 0 ? ya + (k + 1) * rh : ya + (k + 1) * rh;
      f.faces([Math.min(x0, x1), yt - 0.22, band[0]], [Math.max(x0, x1), yt, band[1]], { py: tread, ny: concrete, px: concrete, nx: concrete, pz: concrete, nz: concrete }, { collide: true, shadow: true });
      const nx = dir > 0 ? Math.max(x0, x1) : Math.min(x0, x1);
      f.faces([nx - 0.03, yt - 0.02, band[0]], [nx + 0.03, yt + 0.003, band[1]], { py: nosing });
    }
  };
  flight(b1, fx0, 0, fx1, FLOOR_H / 2); // 上り 1
  flight(b2, fx1, FLOOR_H / 2, fx0, FLOOR_H); // 上り 2
  flight(b2, fx0, 0, fx1, -FLOOR_H / 2); // 下り 1
  flight(b1, fx1, -FLOOR_H / 2, fx0, -FLOOR_H); // 下り 2
  // 帯の間の仕切りの壁（踊り場の所は空ける）と手すり
  f.faces([fx0, bot, b1[0] - 0.15], [fx1, top, b1[0]], { pz: wall, nz: wall, px: wall, nx: wall }, { collide: true, shadow: true });
  // 灯り（各踊り場の天井・壁）
  const body = mats.get('#d2dcbb', undefined, 1);
  const lens = mats.unlit('#f6faea', 0.5);
  lamp(f, body, lens, [L - 0.9, top, -1.6], 0.9, 0.3, 0.06);
  for (const y of [-FLOOR_H / 2 + 2.6, FLOOR_H / 2 - 0.4]) f.faces([L - 0.06, y, -2.0], [L, y + 0.12, -1.2], { nx: lens });
  f.faces([0.02, -FLOOR_H + 2.4, -1.2], [0.08, -FLOOR_H + 2.52, -0.5], { px: lens });
  // 待避の場所: 表示・消火器の箱・ベンチ・避難用の椅子
  const sign = mats.get('#4f8f6a', undefined, 0.6);
  f.faces([-fr.refuge + 0.4, 2.2, -0.02], [-fr.refuge + 1.1, 2.45, 0], { nz: sign });
  f.faces([-fr.refuge, 0.9, -D + 0.6], [-fr.refuge + 0.18, 1.6, -D + 1.1], { px: mats.get('#c4595e', undefined, 0.8), pz: mats.get('#c4595e', undefined, 0.8), nz: mats.get('#c4595e', undefined, 0.8), py: mats.get('#c4595e', undefined, 0.8) }, { shadow: true, collide: true });
  f.faces([-fr.refuge, 0.4, -D + 2.0], [-fr.refuge + 0.4, 0.45, -D + 3.6], { py: mats.get('#889d89', undefined, 1), px: mats.get('#889d89', undefined, 1), pz: mats.get('#889d89', undefined, 1), nz: mats.get('#889d89', undefined, 1) }, { shadow: true, collide: true });
  for (const z of [-D + 2.1, -D + 3.5]) f.faces([-fr.refuge + 0.05, 0, z - 0.03], [-fr.refuge + 0.35, 0.4, z + 0.03], { px: rail, pz: rail, nz: rail });
  // 避難用の椅子（たたんで壁に掛けてある）
  f.faces([-0.6, 0.3, -D + 0.02], [-0.1, 1.3, -D + 0.18], { pz: mats.get('#c76b6c', undefined, 1), px: mats.get('#c76b6c', undefined, 1), nx: mats.get('#c76b6c', undefined, 1), py: mats.get('#c76b6c', undefined, 1) }, { shadow: true });
  lamp(f, body, lens, [-fr.refuge / 2, H, -D / 2], 1.2, 0.28, 0.06);
  stairDetails({ f, b, ctx, r, fr, p, mats, atlas, paperMat, L, D, H, sz, b1, b2, fx0, fx1, top, bot });
}

interface SD {
  f: Leg;
  b: Builder;
  ctx: SceneContext;
  r: RoomDef;
  fr: StairFrame;
  p: RoomPalette;
  mats: Mats;
  atlas: Atlas;
  paperMat: THREE.Material;
  L: number;
  D: number;
  H: number;
  sz: number;
  b1: [number, number];
  b2: [number, number];
  fx0: number;
  fx1: number;
  top: number;
  bot: number;
}

/** 区域の壁より少し明るい地の色（大きな階の数字の板） */
function zoneBg(z: string): string {
  return z === 'D' ? '#e8ecc7' : z === 'C' ? '#eef8e4' : z === 'B' ? '#e4ead0' : '#e3eed3';
}

/** 文字の板（階の数字・案内）。canvas に描いた図柄 */
function textPlate(atlas: Atlas, text: string, o: { bg: string; fg: string; w?: number; h?: number; sub?: string; arrow?: 'up' | 'down' | 'both' }): [number, number, number, number] {
  const W = o.w ?? 160;
  const Hh = o.h ?? 120;
  return atlas.add(W, Hh, (g, w, h) => {
    paper(g, w, h, o.bg, o.fg, 4);
    g.fillStyle = o.fg;
    // 文字の大きさは板の高さと、文字数に対する幅の小さい方
    const room = w * (o.arrow ? 0.66 : 0.86);
    const fsz = Math.min(h * (o.sub ? 0.5 : 0.62), room / (Math.max(1, text.length) * 0.6));
    g.font = `bold ${Math.round(fsz)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w * (o.arrow ? 0.6 : 0.5), h * (o.sub ? 0.4 : 0.52));
    if (o.sub) scribble(g, w * 0.18, h * 0.72, w * 0.64, h * 0.16, { color: o.fg, row: h * 0.14, width: 3, seed: text.length * 7 });
    if (o.arrow) {
      const ax = w * 0.2;
      g.beginPath();
      if (o.arrow !== 'down') {
        g.moveTo(ax, h * 0.18);
        g.lineTo(ax - h * 0.14, h * 0.38);
        g.lineTo(ax + h * 0.14, h * 0.38);
      }
      if (o.arrow !== 'up') {
        g.moveTo(ax, h * 0.84);
        g.lineTo(ax - h * 0.14, h * 0.64);
        g.lineTo(ax + h * 0.14, h * 0.64);
      }
      g.fill();
    }
  });
}

/** 非常口の表示（緑の地に白い走る人と扉） */
function exitPlate(atlas: Atlas): [number, number, number, number] {
  return atlas.add(200, 80, (g, w, h) => {
    paper(g, w, h, '#3f8f62', '#2a5a40', 4);
    g.fillStyle = '#eef6e6';
    g.fillRect(w * 0.62, h * 0.18, w * 0.22, h * 0.64);
    g.fillStyle = '#3f8f62';
    g.fillRect(w * 0.66, h * 0.24, w * 0.14, h * 0.52);
    g.fillStyle = '#eef6e6';
    // 走る人（頭・胴・手足）
    g.beginPath();
    g.arc(w * 0.36, h * 0.24, h * 0.09, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = h * 0.09;
    g.strokeStyle = '#eef6e6';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.33, h * 0.36);
    g.lineTo(w * 0.29, h * 0.58);
    g.lineTo(w * 0.2, h * 0.82);
    g.moveTo(w * 0.29, h * 0.58);
    g.lineTo(w * 0.4, h * 0.72);
    g.lineTo(w * 0.44, h * 0.86);
    g.moveTo(w * 0.33, h * 0.4);
    g.lineTo(w * 0.22, h * 0.48);
    g.moveTo(w * 0.33, h * 0.4);
    g.lineTo(w * 0.46, h * 0.46);
    g.stroke();
    bar(g, w * 0.5, h * 0.48, w * 0.08, h * 0.06, '#eef6e6');
  });
}

/**
 * 階段室の作り込み: 腰壁の色の帯（段の傾きに沿う）・2 段の手すりと受け金物・各階の階数の表示と踊り場の案内・
 * 非常口の表示・消火器と屋内消火栓の箱・踊り場の窓のルーバー・鍵の掛かった各階の扉の表示
 */
function stairDetails(o: SD): void {
  const { f, mats, atlas, paperMat, L, D, H, sz, b1, b2, fx0, fx1, top, bot } = o;
  const zone = o.r.zone;
  const c = ZONE_COLORS[zone];
  const dado = mats.get(zone === 'D' ? '#5f8479' : '#a3b59d', undefined, 0.3);
  const dadoLine = mats.get('#e8ecc7', undefined, 0.4);
  const rail = mats.get('#9fae98', undefined, 1);
  const bracket = mats.get('#6f7f78', undefined, 1);
  const red = mats.get('#c4595e', '#9e4448', 0.8);
  const dark = mats.get('#2f3b40', undefined, 1);
  const half = FLOOR_H / 2;
  // ---- 腰壁の帯（床・段の面から 0.9 m。上の縁に明るい線） ----
  // 壁の面ごとに、x（または z）に沿って床の高さが y0 → y1 と変わる区間
  type Run = [number, number, number, number]; // a0, a1, y(a0), y(a1)
  const bandX = (z: number, nSign: 1 | -1, runs: Run[]): void => {
    const zz = z + nSign * 0.003;
    for (const [a0, a1, y0, y1] of runs) {
      const P = (a: number, y: number): V3 => [a, y, zz];
      const q = (m: THREE.Material, d0: number, d1: number): void => {
        if (nSign > 0) f.quad(m, P(a0, y0 + d0), P(a1, y1 + d0), P(a1, y1 + d1), P(a0, y0 + d1));
        else f.quad(m, P(a1, y1 + d0), P(a0, y0 + d0), P(a0, y0 + d1), P(a1, y1 + d1));
      };
      q(dado, 0.0, 0.9);
      q(dadoLine, 0.9, 0.94);
    }
  };
  const bandZ = (x: number, nSign: 1 | -1, runs: Run[]): void => {
    const xx = x + nSign * 0.003;
    for (const [a0, a1, y0, y1] of runs) {
      const P = (a: number, y: number): V3 => [xx, y, a];
      const q = (m: THREE.Material, d0: number, d1: number): void => {
        if (nSign < 0) f.quad(m, P(a0, y0 + d0), P(a1, y1 + d0), P(a1, y1 + d1), P(a0, y0 + d1));
        else f.quad(m, P(a1, y1 + d0), P(a0, y0 + d0), P(a0, y0 + d1), P(a1, y1 + d1));
      };
      q(dado, 0.0, 0.9);
      q(dadoLine, 0.9, 0.94);
    }
  };
  const floors = [-FLOOR_H, 0, FLOOR_H];
  // 扉の側の壁（z = 0、-z を向く）: 帯 1 の上り 1・下り 2、各階の踊り場、折り返しの踊り場
  bandX(0, -1, [
    [fx0, fx1, 0, half],
    [fx0, fx1, -FLOOR_H, -half],
    ...floors.map((y): Run => [0, fx0, y, y]),
    [fx1, L, half, half],
    [fx1, L, -half, -half],
  ]);
  // 奥の壁（z = sz、+z を向く）: 帯 2 の上り 2・下り 1
  bandX(sz, 1, [
    [fx0, fx1, FLOOR_H, half],
    [fx0, fx1, 0, -half],
    ...floors.map((y): Run => [0, fx0, y, y]),
    [fx1, L, half, half],
    [fx1, L, -half, -half],
  ]);
  // 仕切りの壁の両面
  bandX(b1[0], 1, [
    [fx0, fx1, 0, half],
    [fx0, fx1, -FLOOR_H, -half],
  ]);
  bandX(b2[1], -1, [
    [fx0, fx1, FLOOR_H, half],
    [fx0, fx1, 0, -half],
  ]);
  // 端の壁（x = L、-x を向く）: 折り返しの踊り場
  bandZ(L, -1, [
    [sz, 0, half, half],
    [sz, 0, -half, -half],
  ]);
  // 待避の場所の側の壁（x = 0、+x を向く）: 上の階・下の階の踊り場
  bandZ(0, 1, [
    [sz, 0, FLOOR_H, FLOOR_H],
    [sz, 0, -FLOOR_H, -FLOOR_H],
  ]);
  // 待避の場所の壁（扉の側の壁は扉を避ける）
  const rx = -o.fr.refuge;
  bandZ(rx, 1, [[-D, 0, 0, 0]]);
  bandX(-D, 1, [[rx, 0, 0, 0]]);
  bandZ(0, -1, [[-D, sz, 0, 0]]);

  // ---- 手すり（2 段: 0.85 m と 0.65 m）と受け金物 ----
  const railRun = (a0: number, a1: number, y0: number, y1: number, z: number, wallZ: number): void => {
    for (const hgt of [0.85, 0.65]) {
      const len = Math.hypot(a1 - a0, y1 - y0);
      const ang = Math.atan2(y1 - y0, a1 - a0);
      const g = new THREE.CylinderGeometry(0.018, 0.018, len, 8).rotateZ(Math.PI / 2 + ang);
      f.mesh(g, rail, [(a0 + a1) / 2, (y0 + y1) / 2 + hgt, z]);
      const n = Math.max(2, Math.round(len / 1.0) + 1);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const a = a0 + (a1 - a0) * t;
        const y = y0 + (y1 - y0) * t + hgt;
        f.box(bracket, [a - 0.012, y - 0.02, Math.min(z, wallZ)], [a + 0.012, y - 0.005, Math.max(z, wallZ)]);
      }
    }
  };
  // 外側の壁（扉の側・奥）に沿う手すり（段と踊り場）
  railRun(fx0, fx1, 0, half, -0.07, 0);
  railRun(fx0, fx1, -FLOOR_H, -half, -0.07, 0);
  railRun(fx0, fx1, FLOOR_H, half, sz + 0.07, sz);
  railRun(fx0, fx1, 0, -half, sz + 0.07, sz);
  for (const y of [half, -half]) {
    railRun(fx1, L - 0.1, y, y, -0.07, 0);
    railRun(fx1, L - 0.1, y, y, sz + 0.07, sz);
  }
  // 仕切りの壁の側の手すり
  railRun(fx0, fx1, 0, half, b1[0] + 0.07, b1[0]);
  railRun(fx0, fx1, -FLOOR_H, -half, b1[0] + 0.07, b1[0]);
  railRun(fx0, fx1, FLOOR_H, half, b2[1] - 0.07, b2[1]);
  railRun(fx0, fx1, 0, -half, b2[1] - 0.07, b2[1]);
  // 待避の場所の壁の手すり
  railRun(rx + 0.3, -0.3, 0, 0, -D + 0.07, -D);

  // ---- 各階の階数の表示・踊り場の案内 ----
  const plateNo = (label: string): [number, number, number, number] => textPlate(atlas, label, { bg: '#e8ecc7', fg: '#3f5159', w: 160, h: 112 });
  const labels: [number, string][] = [
    [-FLOOR_H, '4F'],
    [0, '5F'],
    [FLOOR_H, '6F'],
  ];
  for (const [y, lab] of labels) {
    // 奥の壁（踊り場の正面）
    f.sheet(paperMat, '+z', [0.75, y + 1.75, sz + 0.012], 0.42, 0.3, plateNo(lab));
    // 扉の側の壁
    f.sheet(paperMat, '-z', [0.75, y + 1.75, -0.012], 0.42, 0.3, plateNo(lab));
  }
  // 折り返しの踊り場の案内（上の階・下の階へ）
  for (const [y, up, dn] of [
    [half, '6F', '5F'],
    [-half, '5F', '4F'],
  ] as [number, string, string][]) {
    const uv = textPlate(atlas, `${up} / ${dn}`, { bg: '#e8ecc7', fg: '#3f5159', w: 240, h: 112, arrow: 'both' });
    f.sheet(paperMat, '-x', [L - 0.012, y + 1.6, -1.6], 0.6, 0.28, uv);
  }
  // 非常口の表示（待避の場所の扉の上・各階の扉の上）
  const exitUv = exitPlate(atlas);
  const exitM = o.ctx.mat({ color: '#ffffff', map: atlas.tex, unlit: true, line: 0.4 });
  const door = o.r.doors[0];
  const dc = door ? (door.a + door.b) / 2 : 0;
  // 扉の中心（部屋の座標系 → 階段の座標系の x）
  const dx = door ? (o.fr.yaw === 0 ? dc - o.fr.origin[0] : -(dc - o.fr.origin[0])) : -1.6;
  f.sheet(exitM, '-z', [dx, 2.38, -0.02], 0.5, 0.2, exitUv);
  for (const y of [-FLOOR_H, FLOOR_H]) f.sheet(exitM, '+x', [0.02, y + 2.3, -0.85], 0.45, 0.18, exitUv);
  // 鍵の掛かった各階の扉の表示（立入禁止）
  for (const [y, lab] of [
    [-FLOOR_H, '4F'],
    [FLOOR_H, '6F'],
  ] as [number, string][]) {
    const uv = textPlate(atlas, lab, { bg: '#e8ecc7', fg: '#8e3f45', w: 160, h: 140, sub: 'x' });
    f.sheet(paperMat, '+x', [0.02, y + 1.5, -1.75], 0.28, 0.25, uv);
    // 扉の閉じる金物・小窓
    f.faces([0, y + 1.92, -1.2], [0.06, y + 2.0, -0.6], { px: bracket, py: bracket, ny: bracket, pz: bracket, nz: bracket });
    f.faces([0.02, y + 1.3, -1.05], [0.025, y + 1.75, -0.85], { px: mats.get('#a9bdb0', undefined, 0.6) });
  }
  // ---- 消火器と屋内消火栓 ----
  {
    // 屋内消火栓の箱（赤い扉・上に赤い灯り）: 待避の場所の奥の壁
    const hx = rx + 0.9;
    f.faces([hx - 0.4, 0.5, -D], [hx + 0.4, 1.7, -D + 0.18], { pz: red, px: red, nx: red, py: red, ny: red }, { shadow: true, collide: true });
    f.faces([hx - 0.32, 0.6, -D + 0.18], [hx + 0.32, 1.6, -D + 0.185], { pz: mats.get('#d06a6d', undefined, 0.6) });
    f.sheet(paperMat, '+z', [hx, 1.45, -D + 0.19], 0.4, 0.12, textPlate(atlas, '消火栓', { bg: '#c4595e', fg: '#f4f0e0', w: 200, h: 60 }));
    o.f.cyl(mats.unlit('#ff6a5a', 0.4), [hx, 1.9, -D + 0.06], 0.06, 0.05, { axis: 'z', segments: 16 });
    // 消火器（赤い円柱・黒い管）と表示
    const ex = rx + 1.8;
    f.cyl(red, [ex, 0.3, -D + 0.15], 0.085, 0.5, { segments: 14 });
    f.cyl(dark, [ex, 0.6, -D + 0.15], 0.035, 0.1, { segments: 10 });
    f.box(dark, [ex + 0.06, 0.25, -D + 0.12], [ex + 0.09, 0.62, -D + 0.18]);
    f.sheet(paperMat, '+z', [ex, 1.05, -D + 0.01], 0.3, 0.12, textPlate(atlas, '消火器', { bg: '#c4595e', fg: '#f4f0e0', w: 200, h: 60 }));
  }
  // ---- 踊り場の窓のルーバー（端の壁の窓の下の段に横の羽） ----
  const slat = mats.get(c.frame, undefined, 0.6);
  for (const y of [-half + 0.6, half + 0.6]) {
    for (let k = 0; k < 5; k++) {
      const yy = y + 0.06 + k * 0.08;
      f.faces([L - 0.07, yy, -2.6], [L - 0.01, yy + 0.03, -0.7], { nx: slat, py: slat, ny: slat }, {});
    }
    f.faces([L - 0.05, y + 0.45, -2.62], [L, y + 0.48, -0.68], { nx: slat, py: slat });
    f.faces([L - 0.05, y, -1.67], [L, y + 1.0, -1.63], { nx: slat, pz: slat, nz: slat });
  }
  void top;
  void bot;
  void H;
  void b2;
}


/**
 * 階段室の写っていない所の作り込み（dress.ts と同じ記号の小物）: 立て管と電線の管（全部の階を通る）・天井の際の横の管、
 * 各階の踊り場の発信機・避難経路の図・コンセント・紙、折り返しの踊り場の紙と非常灯、段の横の注意の札、
 * 行き止まりの上下の階の踊り場に置きっぱなしの物（たたんだ椅子・段ボール・バケツ）、床の紙くず、踊り場ごとの灯りの光だまり
 */
export function dressStairs(env: { ctx: SceneContext; mats: Mats; atlas: Atlas; paperMat: THREE.Material }, b: Builder, r: RoomDef, fr: StairFrame, seed: number): void {
  const { ctx, mats } = env;
  const f = new Leg(b, ctx, fr.origin, CAM0, fr.yaw);
  const k = kitFor(mats, r.zone, env.atlas, env.paperMat);
  const rnd = rng(seed);
  const L = fr.shaft;
  const land = 1.5;
  const fx1 = land + RUN;
  const sz = -3.25;
  const top = 5.9;
  const bot = -3.2;
  const half = FLOOR_H / 2;
  // 壁の面ごとの置く座標系（面が z' = 0、階段の側が +z'）
  const OFF = { z0: Math.PI, sz: 0, xL: -Math.PI / 2, x0: Math.PI / 2, p1: 0, p2: Math.PI } as const;
  const POS = { z0: (x: number): V3 => [x, 0, 0], sz: (x: number): V3 => [x, 0, sz], xL: (z: number): V3 => [L, 0, z], x0: (z: number): V3 => [0, 0, z], p1: (x: number): V3 => [x, 0, -1.55], p2: (x: number): V3 => [x, 0, -1.7] };
  // u は面に沿った座標（階段室の座標。z0・sz・p1・p2 は x、xL・x0 は z）。物は座標系の x = 0 に置く（z0・p2 の座標系の +x は階段室の -x）
  const mount = (face: keyof typeof OFF, u: number, y: number): Leg => {
    const p = POS[face](u);
    return new Leg(b, ctx, f.w([p[0], y, p[2]]), CAM0, f.yaw + OFF[face]);
  };
  // ---- 立て管（赤い連結送水管）と電線の管: 奥の壁の端の角を全部の階を通る ----
  conduit(k, mount('sz', L - 0.14, bot), 0, 0, top - bot, 0.055, 'red');
  conduit(k, mount('sz', L - 0.36, bot), 0, 0, top - bot, 0.02, 'pipe');
  conduit(k, mount('z0', L - 0.14, bot), 0, 0, top - bot, 0.025, 'pipe');
  // 天井の際の横の管（奥の壁）
  {
    const s = mount('sz', 0, 0);
    fcyl(k, s, [L / 2, top - 0.22, 0.06], 0.03, L, 'pipe', { axis: 'x', segments: 10 });
    for (let x = 0.4; x < L; x += 1.2) fbox(k, s, [x - 0.02, top - 0.26, 0], [x + 0.02, top - 0.18, 0.1], { pz: 'metal', px: 'metal', nx: 'metal' });
  }
  // ---- 各階の踊り場（y = -3, 0, 3）----
  for (const y of [-FLOOR_H, 0, FLOOR_H]) {
    // 扉の側の壁: 発信機（階の表示 x 0.54〜0.96 の横）
    alarmBox(k, mount('z0', 1.25, y), 0, 1.35, 1.7);
    outlet(k, mount('z0', 0.3, y), 0, 0.3);
    // 奥の壁: 避難経路の図（枠の付いた板）とコンセント
    {
      const s = mount('sz', 1.12, y);
      board(k, s, 0, 1.45, 0.5, 0.38, rnd);
      outlet(k, mount('sz', 1.25, y), 0, 0.3);
    }
    // 紙くず
    for (let i = 0; i < 4; i++) {
      const x = 0.15 + rnd() * 1.25;
      const z = -3.0 + rnd() * 2.8;
      scrap(k, f, x, z, 0.04 + rnd() * 0.08, 0.02 + rnd() * 0.04, rnd() * Math.PI, undefined, y + 0.003);
    }
  }
  // ---- 仕切りの壁の端の大きな階の数字（階段室の壁に描いた階の表示）と、その下の案内の紙 ----
  for (const [y, lab] of [[-FLOOR_H, '4'], [0, '5'], [FLOOR_H, '6']] as [number, string][]) {
    const uv = textPlate(env.atlas, lab, { bg: zoneBg(r.zone), fg: '#3f5159', w: 120, h: 140 });
    // 仕切りの壁は x = 1.5〜4.02（段の間）。踊り場の側の端の近く
    mount('p1', land + 0.4, y).sheet(env.paperMat, '+z', [0, 1.75, 0.006], 0.42, 0.5, uv);
    mount('p2', land + 0.4, y).sheet(env.paperMat, '+z', [0, 1.75, 0.006], 0.42, 0.5, uv);
    paperCluster(k, mount('p1', land + 0.95, y), 0, 1.75, 0.34, 0.34, 1, rnd);
  }
  // 上の階の踊り場の吹き抜け側の手すりの柵（帯 1 は下の段まで吹き抜け）
  {
    const s = new Leg(b, ctx, f.w([land, FLOOR_H, 0]), CAM0, f.yaw);
    const rail = mats.get('#9fae98', undefined, 1);
    s.box(rail, [-0.03, 1.08, -1.55], [0.03, 1.12, -0.1]);
    s.box(rail, [-0.02, 0.55, -1.55], [0.02, 0.58, -0.1]);
    for (let z = -1.5; z < -0.1; z += 0.12) s.box(rail, [-0.008, 0.05, z - 0.008], [0.008, 1.08, z + 0.008]);
    s.faces([-0.05, -0.2, -1.55], [0.05, 0.05, -0.1], { px: rail, nx: rail, py: rail });
    s.collider([-0.05, 0, -1.55], [0.05, 1.12, -0.1]);
  }
  // ---- 行き止まりの上下の階の踊り場: 置きっぱなしの物（奥の角。扉と通る所は空ける）----
  for (const y of [-FLOOR_H, FLOOR_H]) {
    const s = new Leg(b, ctx, f.w([0.42, y, sz + 0.32]), CAM0, f.yaw + (rnd() - 0.5) * 0.3);
    if (y > 0) {
      // たたんだパイプ椅子を壁に立てかける
      for (let i = 0; i < 3; i++) {
        const zc = -0.12 + i * 0.06;
        fbox(k, s, [0.05 * i - 0.26, 0.05, zc - 0.015], [0.05 * i + 0.16, 0.86, zc + 0.015], { pz: 'teal', nz: 'teal', px: 'dark', nx: 'dark', py: 'teal' }, { shadow: true });
        sbox(k, s, [0.05 * i - 0.28, 0, zc - 0.03], [0.05 * i - 0.26, 0.88, zc - 0.01], 'metal');
        sbox(k, s, [0.05 * i + 0.16, 0, zc - 0.03], [0.05 * i + 0.18, 0.88, zc - 0.01], 'metal');
      }
      s.collider([-0.3, 0, -0.2], [0.3, 0.9, 0.1]);
      boxStack(k, new Leg(b, ctx, f.w([1.0, y, sz + 0.3]), CAM0, f.yaw + 0.1), rnd);
    } else {
      boxStack(k, s, rnd);
      // バケツとモップ
      const bk = new Leg(b, ctx, f.w([1.05, y, sz + 0.28]), CAM0, f.yaw);
      fcyl(k, bk, [0, 0.15, 0], 0.15, 0.3, 'bucket', { radiusTop: 0.17, segments: 14 });
      fcyl(k, bk, [0.08, 0.7, -0.05], 0.012, 1.3, 'metal', { segments: 6 });
      bk.collider([-0.17, 0, -0.17], [0.17, 0.3, 0.17]);
      lowPole(k, new Leg(b, ctx, f.w([0.25, y, -0.6]), CAM0, f.yaw), 0, -1.2);
    }
  }
  // ---- 折り返しの踊り場（y = ±1.5、x fx1〜L）----
  for (const y of [-half, half]) {
    // 奥の壁と扉の側の壁に紙・非常灯（白い箱と緑の窓）
    paperCluster(k, mount('sz', fx1 + 0.55, y), 0, 1.5, 0.5, 0.45, 2 + Math.floor(rnd() * 2), rnd);
    {
      const s = mount('z0', fx1 + 0.6, y);
      fbox(k, s, [-0.18, 2.0, 0], [0.18, 2.14, 0.08], { pz: 'white', py: 'white', ny: 'plateIn', px: 'plateIn', nx: 'plateIn' });
      fbox(k, s, [-0.12, 2.02, 0.08], [0.12, 2.06, 0.082], { pz: 'greenLens' });
      paperCluster(k, s, 0.15, 1.45, 0.4, 0.35, 1 + Math.floor(rnd() * 2), rnd);
    }
    for (let i = 0; i < 3; i++) scrap(k, f, fx1 + 0.2 + rnd() * (L - fx1 - 0.4), -3.0 + rnd() * 2.8, 0.04 + rnd() * 0.08, 0.02 + rnd() * 0.04, rnd() * Math.PI, undefined, y + 0.003);
  }
  // ---- 段の横の注意の札（外の壁。段の中ほどの高さ + 1.4 m）----
  const flights: [keyof typeof OFF, number, number][] = [
    ['z0', 0, half],
    ['sz', FLOOR_H, half],
    ['sz', 0, -half],
    ['z0', -half, -FLOOR_H],
  ];
  for (const [face, ya, yb] of flights) {
    const xm = (land + fx1) / 2;
    const ym = (ya + yb) / 2;
    const s = mount(face, xm, ym);
    paperCluster(k, s, 0, 1.45, 0.34, 0.3, 1, rnd);
  }
  // ---- 天井（最上階の天井）: 感知器・スプリンクラー ----
  {
    const s = new Leg(b, ctx, f.w([0, 0, 0]), CAM0, f.yaw);
    sprinkler(k, s, 0.8, -2.4, top);
    sprinkler(k, s, L - 1.6, -0.8, top);
    smokeDet(k, s, 1.6, -1.6, top);
  }
  // ---- 灯りの光だまり（踊り場ごと。階段室の中だけ）----
  const a = f.w([-0.05, bot, sz]);
  const c = f.w([L + 0.05, top, 0.05]);
  const box: [number, number, number, number, number, number] = [Math.min(a[0], c[0]), bot, Math.min(a[2], c[2]), Math.max(a[0], c[0]), top, Math.max(a[2], c[2])];
  for (const y of [-FLOOR_H, 0, FLOOR_H]) trackLamp(ctx, { pos: f.w([0.75, y + 2.2, -1.6]), radius: 2.8, intensity: 0.42, down: true, box, shadow: 0.5 });
  for (const y of [-half, half]) trackLamp(ctx, { pos: f.w([(fx1 + L) / 2, y + 2.3, -1.6]), radius: 2.8, intensity: 0.4, down: true, box, shadow: 0.5 });
  // 壁の灯り（端の壁の踊り場の灯り・下の階の壁の灯り）のまわりの壁の明るい段
  trackLamp(ctx, { pos: f.w([L - 0.3, -half + 2.66, -1.6]), radius: 1.7, intensity: 0.35, box, shadow: 0.3 });
  trackLamp(ctx, { pos: f.w([L - 0.3, half - 0.34, -1.6]), radius: 1.7, intensity: 0.35, box, shadow: 0.3 });
  trackLamp(ctx, { pos: f.w([0.3, -FLOOR_H + 2.46, -0.85]), radius: 1.6, intensity: 0.35, box, shadow: 0.3 });
}
