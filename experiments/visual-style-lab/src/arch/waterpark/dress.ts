import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { CAM_A } from './hallA.ts';
import { CAM_B } from './hallB.ts';
import { CAM_C } from './hallC.ts';
import { CAM_D } from './hallD.ts';
import type { ShiftCam } from './cam.ts';
import { glowDecalMat } from './hallkit.ts';
import { HALL, LOCKER, PROM, PROM_CEIL, SHOWER, SOUTH_OPEN, SOUTH_OPEN_UP, UPPER, UPPER_Y, type HallId } from './layout.ts';
import { glow, semi } from './mats.ts';
import { viewWindows } from './connect.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import { floatRack, kickboardPile, loungerStack, poolShower, ringBuoyPost, wpBench, wpBin, wpPlant, wpVending } from './props/items.ts';
import { WC, wpPropMats } from './props/mats.ts';

/**
 * 壁の作り込みの決まり（写っていない所を参考画像の視点と同じ語彙に）: 参考画像の壁は「白いタイルに青い帯」「柱型」「壁の灯りと光だまり」
 * 「扉」「案内の札」。壁の線分ごとに、柱型（6 m おき）・腰と上の青い帯・柱型の上の灯り（光だまりつき）・扉（決めた所）・札を置く。
 * 広間の中は、その広間の参考画像の画角に入る所には置かない（視点の見た目を変えない）
 */
const CAMS: Record<HallId, ShiftCam> = { A: CAM_A, B: CAM_B, C: CAM_C, D: CAM_D };

/** 視点の目からこれより遠い所は、画角に入っても小さく霞むので作り込む（視点の画素はわずかに変わる） */
const FAR = 26;

function seenBy(id: HallId | null, p: [number, number, number], pad = 60, strict = false): boolean {
  if (!id) return false;
  const e = CAMS[id].eye;
  if (!strict && Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]) > FAR) return false;
  const q = CAMS[id].proj(p);
  return !!q && q[0] > -pad && q[0] < 1232 + pad && q[1] > -pad && q[1] < 928 + pad;
}

export interface DressMats {
  pilaster: THREE.Material;
  band: THREE.Material;
  bandHi: THREE.Material;
  frame: THREE.Material;
  door: THREE.Material;
  plate: THREE.Material;
  pict: THREE.Material;
  lampBody: THREE.Material;
  lampLit: THREE.Material;
  glowWall: THREE.Material;
  grate: THREE.Material;
  wainscot: THREE.Material;
  rail: THREE.Material;
  pipe: THREE.Material;
  red: THREE.Material;
  /** 色のタイルの帯（白と青のタイルを 1 枚ずつ交互に） */
  courseLight: THREE.Material;
  courseDark: THREE.Material;
  /** 掲示板・紙（白・薄い黄・薄い桃・薄い水色） */
  board: THREE.Material;
  papers: THREE.Material[];
  /** ガラスブロック（奥の部屋の明かりが透ける）・鏡・ゴムのマット・床の光だまり */
  glassBlock: THREE.Material;
  mirror: THREE.Material;
  mat: THREE.Material;
  glowFloor: THREE.Material;
  ink: THREE.Material;
  /** 床の縁取りの帯（広間ごと。X = 通路） */
  floorBand: Record<string, THREE.Material>;
  /** 上の階の床のタイル */
  upFloor: THREE.Material;
}

export function dressMats(ctx: SceneContext): DressMats {
  return {
    pilaster: semi(ctx, '#a4c0d2', { tiles: { size: 0.25, line: 0.018, color: '#5f87a2', jitter: 0.22 }, name: 'D-pilaster' }),
    wainscot: semi(ctx, '#2f6488', { tiles: { size: 0.15, line: 0.014, color: '#1f4a68', jitter: 0.2 }, name: 'D-wainscot' }),
    band: semi(ctx, '#2f6f9c', { name: 'D-band' }),
    bandHi: semi(ctx, '#86b0cc', { name: 'D-bandHi' }),
    frame: semi(ctx, '#a8c0d0', { name: 'D-frame' }),
    door: semi(ctx, '#2a4c62', { name: 'D-door' }),
    plate: semi(ctx, '#e4ecf2', { name: 'D-plate' }),
    pict: semi(ctx, '#2f6f9c'),
    lampBody: semi(ctx, '#2a3c48'),
    lampLit: glow(ctx, '#ffe0c4', 6),
    glowWall: glowDecalMat(ctx, '#ffb090', 0.6),
    grate: semi(ctx, '#1f3a4c', { name: 'D-grate' }),
    rail: semi(ctx, '#c4d4de', { metalness: 0.3, roughness: 0.4, name: 'D-rail' }),
    pipe: semi(ctx, '#7e9cb0', { metalness: 0.3, roughness: 0.4, name: 'D-pipe' }),
    red: semi(ctx, '#c8564e', { name: 'D-red' }),
    courseLight: semi(ctx, '#d2e2ec', { name: 'D-courseL' }),
    courseDark: semi(ctx, '#2a6896', { name: 'D-courseD' }),
    board: semi(ctx, '#dfe8ee', { name: 'D-board' }),
    papers: ['#f4f0dc', '#f2c8c2', '#cfe4f2', '#f0e0a0'].map((c, i) => semi(ctx, c, { name: `D-paper${i}` })),
    glassBlock: ctx.mat({ color: '#a8c8d8', emissive: '#bfe0ee', emissiveIntensity: 0.55, toon: 0, line: 0, tiles: { size: 0.19, line: 0.022, color: '#4f7488', jitter: 0.12 }, name: 'D-glassblock' }),
    mirror: semi(ctx, '#7f9eb0', { metalness: 0.5, roughness: 0.12, name: 'D-mirror' }),
    mat: semi(ctx, '#24404c', { tiles: { size: [0.06, 3.0], line: 0.014, color: '#162a34', jitter: 0 }, name: 'D-mat' }),
    glowFloor: glowDecalMat(ctx, '#ffc8a8', 0.32),
    ink: semi(ctx, '#5f7484', { name: 'D-ink' }),
    upFloor: semi(ctx, '#3a6e90', { tiles: { size: 0.3, line: 0.012, color: '#5d8eb0', jitter: 0.1 }, name: 'D-upFloor' }),
    floorBand: {
      X: semi(ctx, '#244f70', { tiles: { size: 0.15, line: 0.01, color: '#183a54', jitter: 0.1 }, name: 'D-fbX' }),
      A: semi(ctx, '#245a80', { tiles: { size: 0.15, line: 0.01, color: '#183e5c', jitter: 0.1 }, name: 'D-fbA' }),
      B: semi(ctx, '#4f7480', { tiles: { size: 0.15, line: 0.01, color: '#3a5862', jitter: 0.1 }, name: 'D-fbB' }),
      C: semi(ctx, '#8a7486', { tiles: { size: 0.15, line: 0.01, color: '#6c5a6a', jitter: 0.1 }, name: 'D-fbC' }),
      D: semi(ctx, '#b4685c', { tiles: { size: 0.15, line: 0.01, color: '#8c4c42', jitter: 0.1 }, name: 'D-fbD' }),
    },
  };
}

export interface WallSpec {
  /** 壁の面の上の始点・終点（x, z）。面は a → b の右（外向き = 部屋の内側が左）… normal で指定 */
  a: [number, number];
  b: [number, number];
  /** 部屋の内側を向く法線（x, z の単位） */
  n: [number, number];
  y0: number;
  y1: number;
  hall?: HallId | null;
  /** 扉を置く位置（a からの距離 m） */
  doors?: number[];
  pilasters?: boolean;
  lamps?: boolean;
  /** 床ぎわの排水の溝 */
  gutter?: boolean;
  /** 何も付けない区間（a からの距離 [s0, s1]。窓など） */
  skip?: [number, number][];
  /** 壁の手すり（既定あり） */
  rail?: boolean;
  /** 壁ぎわに小物を並べる（プールサイドの物。3.4 m おき・乱数で選ぶ） */
  props?: boolean;
  /** 部屋の種類（壁の器具の決まり）。corridor = 通路・shower = シャワー室・locker = 更衣室・hall = 広間 */
  kind?: 'corridor' | 'shower' | 'locker' | 'hall';
}

/** 決まった乱数のハッシュ（位置から） */
function hash(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 壁の器具（柱型の間の中ほど・部屋の種類ごと）。どれも実物の部品の組み合わせ（枠・板・紙・受け・つまみ）。
 * 通路 = 掲示板・ガラスブロックの明かり窓・案内のポスター・冷水の水飲み、シャワー室 = 鏡と棚・ポスター、
 * 更衣室 = 鏡と棚・ドライヤー・掲示板、広間 = 大きな案内板・ポスター・ガラスブロック
 */
function wallFixture(b: Builder, m: DressMats, w: WallSpec, s: number, pick: number): void {
  const y = w.y0;
  // 厚みが 1 cm 未満の物（紙・板の表・線）は平らな板で、それ以外は箱で
  const A = (mat: THREE.Material, s0: number, s1: number, d0: number, d1: number, y0: number, y1: number): void => {
    if (d1 - d0 < 0.0105) planeAlong(b, mat, w, s0, s1, d1, y + y0, y + y1);
    else boxAlong(b, mat, w, s0, s1, d0, d1, y + y0, y + y1);
  };
  const notice = (big: boolean): void => {
    const hw = big ? 0.85 : 0.6;
    const y0 = big ? 1.15 : 1.2;
    const y1 = big ? 2.25 : 2.0;
    A(m.frame, s - hw, s + hw, 0, 0.03, y0, y1);
    A(m.board, s - hw + 0.05, s + hw - 0.05, 0.03, 0.036, y0 + 0.05, y1 - 0.05);
    // 貼り紙（A4 の縦・横。位置と色は場所から決める）
    const n = big ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const h1 = hash(s * 3.1 + i, w.a[0] + w.a[1] + i * 7.7);
      const h2 = hash(s * 1.7 + i * 3.3, w.a[1] - w.a[0]);
      const pw = h1 < 0.5 ? 0.21 : 0.3;
      const ph = h1 < 0.5 ? 0.3 : 0.21;
      const cx = s - hw + 0.12 + pw / 2 + ((i + 0.15 * h2) / n) * (2 * hw - 0.24 - pw);
      const cy = y0 + 0.12 + ph / 2 + h2 * (y1 - y0 - 0.24 - ph);
      A(m.papers[Math.floor(h1 * 7 + i) % m.papers.length], cx - pw / 2, cx + pw / 2, 0.036, 0.04, cy - ph / 2, cy + ph / 2);
      // 紙の見出しの線
      A(m.ink, cx - pw * 0.35, cx + pw * 0.35, 0.04, 0.042, cy + ph * 0.28, cy + ph * 0.34);
    }
  };
  const glass = (): void => {
    A(m.frame, s - 0.72, s + 0.72, 0, 0.06, 0.88, 2.52);
    A(m.glassBlock, s - 0.62, s + 0.62, 0.06, 0.07, 0.98, 2.42);
    // 足元の光だまり（ガラスの明かり）
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const tx = (w.b[0] - w.a[0]) / len;
    const tz = (w.b[1] - w.a[1]) / len;
    const g = new THREE.PlaneGeometry(1.9, 1.3);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.atan2(tz, tx));
    g.translate(w.a[0] + tx * s + w.n[0] * 0.7, y + 0.012, w.a[1] + tz * s + w.n[1] * 0.7);
    b.mesh(g, m.glowFloor, [0, 0, 0], { shadow: false, layer: 1 });
  };
  const poster = (): void => {
    A(m.frame, s - 0.34, s + 0.34, 0, 0.02, 1.3, 2.24);
    A(m.plate, s - 0.31, s + 0.31, 0.02, 0.026, 1.33, 2.21);
    A(m.band, s - 0.31, s + 0.31, 0.026, 0.03, 2.04, 2.18);
    A(m.red, s - 0.31, s + 0.31, 0.026, 0.03, 1.44, 1.49);
    for (let i = 0; i < 4; i++) A(m.ink, s - 0.25, s + 0.25 - (i % 2) * 0.12, 0.026, 0.029, 1.6 + i * 0.1, 1.63 + i * 0.1);
    A(m.pict, s - 0.12, s + 0.12, 0.026, 0.03, 1.52, 1.58);
  };
  const fountain = (): void => {
    A(m.pipe, s - 0.26, s + 0.26, 0, 0.02, 0.68, 1.28);
    A(m.rail, s - 0.23, s + 0.23, 0.02, 0.38, 0.82, 0.96);
    A(m.grate, s - 0.16, s + 0.16, 0.06, 0.32, 0.955, 0.965);
    A(m.pipe, s - 0.05, s + 0.05, 0.02, 0.22, 0.42, 0.82);
    A(m.rail, s - 0.03, s + 0.03, 0.08, 0.14, 0.96, 1.03);
  };
  const mirror = (): void => {
    A(m.frame, s - 0.5, s + 0.5, 0, 0.02, 1.1, 2.02);
    A(m.mirror, s - 0.46, s + 0.46, 0.02, 0.026, 1.14, 1.98);
    A(m.plate, s - 0.46, s + 0.46, 0.02, 0.15, 1.0, 1.03);
    for (let i = 0; i < 3; i++) {
      const h = hash(s + i, w.a[0] * 0.3);
      const cx = s - 0.32 + i * 0.3 + h * 0.06;
      A(m.papers[(i + Math.floor(h * 4)) % m.papers.length], cx - 0.03, cx + 0.03, 0.05, 0.11, 1.03, 1.17 + h * 0.06);
    }
  };
  const dryer = (): void => {
    A(m.plate, s - 0.16, s + 0.16, 0, 0.17, 1.22, 1.52);
    A(m.grate, s - 0.1, s + 0.1, 0.12, 0.175, 1.2, 1.24);
    A(m.pict, s - 0.12, s + 0.12, 0.17, 0.174, 1.44, 1.48);
    // 横にタオル掛け
    A(m.rail, s + 0.35, s + 0.95, 0.06, 0.08, 1.12, 1.14);
    A(m.papers[2], s + 0.4, s + 0.62, 0.04, 0.1, 0.8, 1.13);
  };
  const k = w.kind ?? 'hall';
  const list: (() => void)[] =
    k === 'corridor' ? [() => notice(false), glass, poster, fountain, glass, () => notice(false)]
      : k === 'shower' ? [mirror, poster, mirror, dryer]
        : k === 'locker' ? [mirror, dryer, () => notice(false), poster]
          : [() => notice(true), poster, glass, () => notice(true)];
  list[Math.floor(pick * list.length) % list.length]();
}

function boxAlong(b: Builder, mat: THREE.Material, w: WallSpec, s0: number, s1: number, d0: number, d1: number, y0: number, y1: number): void {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const tx = (w.b[0] - w.a[0]) / len;
  const tz = (w.b[1] - w.a[1]) / len;
  const cs = (s0 + s1) / 2;
  const cd = (d0 + d1) / 2;
  const cx = w.a[0] + tx * cs + w.n[0] * cd;
  const cz = w.a[1] + tz * cs + w.n[1] * cd;
  const g = new THREE.BoxGeometry(Math.abs(s1 - s0), y1 - y0, Math.abs(d1 - d0));
  g.rotateY(-Math.atan2(tz, tx));
  g.translate(cx, (y0 + y1) / 2, cz);
  b.mesh(g, mat, [0, 0, 0], { shadow: false });
}

/** 壁の面に平らな板（壁から d の所、部屋の側を向く 2 枚の三角形。貼り紙・タイルの帯のような薄い物） */
function planeAlong(b: Builder, mat: THREE.Material, w: WallSpec, s0: number, s1: number, d: number, y0: number, y1: number): void {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const tx = (w.b[0] - w.a[0]) / len;
  const tz = (w.b[1] - w.a[1]) / len;
  const cs = (s0 + s1) / 2;
  const g = new THREE.PlaneGeometry(Math.abs(s1 - s0), y1 - y0);
  g.rotateY(Math.atan2(w.n[0], w.n[1]));
  g.translate(w.a[0] + tx * cs + w.n[0] * d, (y0 + y1) / 2, w.a[1] + tz * cs + w.n[1] * d);
  b.mesh(g, mat, [0, 0, 0], { shadow: false });
}

export function dressWall(b: Builder, _ctx: SceneContext, m: DressMats, w: WallSpec): void {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const tx = (w.b[0] - w.a[0]) / len;
  const tz = (w.b[1] - w.a[1]) / len;
  const P = (s: number, d: number, y: number): [number, number, number] => [w.a[0] + tx * s + w.n[0] * d, y, w.a[1] + tz * s + w.n[1] * d];
  const H = w.y1 - w.y0;
  const doorAt = (s: number): boolean => (w.doors ?? []).some((d) => Math.abs(d - s) < 1.0) || (w.skip ?? []).some(([a, c]) => s > a - 0.4 && s < c + 0.4);
  // 帯（腰 1.0 m・上 2.6 m）: 見える区間は飛ばす（1 m ずつ）
  for (let s = 0; s < len; s += 1.0) {
    const s1 = Math.min(len, s + 1.0);
    const mid = P((s + s1) / 2, 0.05, w.y0 + 1.2);
    if (seenBy(w.hall ?? null, mid)) continue;
    if (!doorAt((s + s1) / 2)) {
      boxAlong(b, m.band, w, s, s1, 0, 0.025, w.y0 + 0.95, w.y0 + 1.12);
      // 腰の濃い青のタイル（床から 0.95 m）
      boxAlong(b, m.wainscot, w, s, s1, 0, 0.012, w.y0, w.y0 + 0.95);
    }
    if (H > 3.0 && !(w.skip ?? []).some(([a, c]) => (s + s1) / 2 > a - 0.4 && (s + s1) / 2 < c + 0.4)) boxAlong(b, m.bandHi, w, s, s1, 0, 0.02, w.y0 + 2.55, w.y0 + 2.63);
    if (w.gutter) {
      boxAlong(b, m.grate, w, s, s1, 0.02, 0.22, w.y0, w.y0 + 0.008);
      // 床の縁取りの帯（壁ぎわ 0.6 m の濃い色のタイル。広間の床の色に合わせて）
      if (!doorAt((s + s1) / 2)) boxAlong(b, m.floorBand[w.hall ?? 'X'] ?? m.floorBand.X, w, s, s1, 0.22, 0.82, w.y0 + 0.001, w.y0 + 0.006);
    }
  }
  // 柱型（4.5 m おき）と柱型の上の灯り
  if (w.pilasters !== false) {
    for (let s = 2.5; s < len - 1; s += 4.5) {
      if (doorAt(s)) continue;
      const top = Math.min(w.y1, w.y0 + 6);
      if (seenBy(w.hall ?? null, P(s, 0.2, w.y0 + 1.5)) || seenBy(w.hall ?? null, P(s, 0.2, top))) continue;
      boxAlong(b, m.pilaster, w, s - 0.3, s + 0.3, 0, 0.22, w.y0, top);
      if (w.lamps !== false) {
        const lp = P(s, 0.24, w.y0 + 2.4);
        const g = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14);
        g.rotateX(Math.PI / 2);
        g.rotateY(-Math.atan2(w.n[1], w.n[0]) + Math.PI / 2);
        g.translate(...lp);
        b.mesh(g, m.lampLit, [0, 0, 0], { shadow: false });
        // 光だまり（壁に）
        const d = new THREE.PlaneGeometry(2.6, 2.8);
        d.rotateY(Math.atan2(w.n[0], w.n[1]));
        const c = P(s - 0.0, 0.012, w.y0 + 2.0);
        d.translate(c[0], c[1], c[2]);
        b.mesh(d, m.glowWall, [0, 0, 0], { shadow: false, layer: 1 });
      }
    }
  }
  // 色のタイルの帯（1.5〜1.8 m。白と青のタイルを 0.3 m ずつ交互に、上下に細い白の目地の帯）
  for (let s = 0, i = 0; s < len - 0.05; s += 0.3, i++) {
    const s1 = Math.min(len, s + 0.3);
    const mid = (s + s1) / 2;
    if (doorAt(mid) || seenBy(w.hall ?? null, P(mid, 0.05, w.y0 + 1.65))) continue;
    planeAlong(b, i % 2 === 0 ? m.courseLight : m.courseDark, w, s, s1, 0.014, w.y0 + 1.5, w.y0 + 1.8);
  }
  // 壁の器具（柱型の間の中ほど。柱型の無い部屋は 2.4 m おき）
  {
    const step = w.pilasters === false ? 2.4 : 4.5;
    const start = w.pilasters === false ? 1.6 : 4.75;
    for (let s = start; s < len - 1.0; s += step) {
      if (doorAt(s) || doorAt(s - 0.7) || doorAt(s + 0.7)) continue;
      if (seenBy(w.hall ?? null, P(s, 0.1, w.y0 + 1.6)) || seenBy(w.hall ?? null, P(s, 0.1, w.y0 + 0.4))) continue;
      wallFixture(b, m, w, s, hash(s * 0.37 + w.a[0], w.a[1] * 0.71 + w.y0));
    }
  }
  // 広間の高い壁（6 m 以上）: 上の色のタイルの帯（5.0〜5.3 m）・柱型の間の高窓（ガラスブロック。奥の機械室の明かり）・
  // 柱型の上の高い投光器と壁の光だまり（9 m おき）
  if (H > 6) {
    for (let s = 0, i = 0; s < len - 0.05; s += 0.3, i++) {
      const s1 = Math.min(len, s + 0.3);
      const mid = (s + s1) / 2;
      if ((w.skip ?? []).some(([a, c]) => mid > a - 0.4 && mid < c + 0.4) || seenBy(w.hall ?? null, P(mid, 0.05, w.y0 + 5.15))) continue;
      planeAlong(b, i % 2 === 0 ? m.courseDark : m.courseLight, w, s, s1, 0.014, w.y0 + 5.0, w.y0 + 5.3);
    }
    for (let s = 4.75; s < len - 1.5; s += 4.5) {
      if ((w.skip ?? []).some(([a, c]) => s > a - 1.4 && s < c + 1.4)) continue;
      const top = Math.min(w.y1 - 0.8, w.y0 + 7.8);
      if (seenBy(w.hall ?? null, P(s, 0.05, w.y0 + 6.2)) || seenBy(w.hall ?? null, P(s, 0.05, top))) continue;
      boxAlong(b, m.frame, w, s - 1.3, s + 1.3, 0, 0.06, w.y0 + 6.1, top + 0.1);
      boxAlong(b, m.glassBlock, w, s - 1.2, s + 1.2, 0.06, 0.07, w.y0 + 6.2, top);
      boxAlong(b, m.frame, w, s - 0.02, s + 0.02, 0.07, 0.09, w.y0 + 6.2, top);
    }
    // 天井ぎわのケーブルラック（2 本の桁と横桟・受けの金物）と、その下の配管
    for (let s = 0; s < len; s += 1.5) {
      const s1 = Math.min(len, s + 1.5);
      const ry = w.y1 - 1.3;
      if (seenBy(w.hall ?? null, P((s + s1) / 2, 0.3, ry))) continue;
      boxAlong(b, m.rail, w, s, s1, 0.08, 0.12, ry, ry + 0.1);
      boxAlong(b, m.rail, w, s, s1, 0.5, 0.54, ry, ry + 0.1);
      for (let t = s + 0.3; t < s1; t += 0.5) boxAlong(b, m.rail, w, t - 0.02, t + 0.02, 0.08, 0.54, ry, ry + 0.03);
      boxAlong(b, m.grate, w, s + 0.7, s + 0.76, 0.0, 0.56, ry - 0.06, ry + 0.02);
      boxAlong(b, m.pipe, w, s, s1, 0.06, 0.2, ry - 0.5, ry - 0.36);
    }
    for (let s = 7.0; s < len - 1; s += 9) {
      if ((w.skip ?? []).some(([a, c]) => s > a - 1 && s < c + 1)) continue;
      if (seenBy(w.hall ?? null, P(s, 0.3, w.y0 + 8.0))) continue;
      const ly = Math.min(w.y1 - 0.6, w.y0 + 8.2);
      boxAlong(b, m.lampBody, w, s - 0.2, s + 0.2, 0, 0.32, ly - 0.14, ly + 0.14);
      boxAlong(b, m.lampLit, w, s - 0.16, s + 0.16, 0.32, 0.33, ly - 0.1, ly + 0.1);
      const d = new THREE.PlaneGeometry(4.2, 3.6);
      d.rotateY(Math.atan2(w.n[0], w.n[1]));
      const c = P(s, 0.012, ly - 1.6);
      d.translate(c[0], c[1], c[2]);
      b.mesh(d, m.glowWall, [0, 0, 0], { shadow: false, layer: 1 });
    }
  }
  // 低い部屋（4.2 m 以下）の天井ぎわの配管 2 本と受けの金物
  if (H <= 4.2) {
    for (let s = 0; s < len; s += 1.5) {
      const s1 = Math.min(len, s + 1.5);
      if (seenBy(w.hall ?? null, P((s + s1) / 2, 0.1, w.y1 - 0.3))) continue;
      boxAlong(b, m.pipe, w, s, s1, 0.05, 0.12, w.y1 - 0.36, w.y1 - 0.29);
      boxAlong(b, m.pipe, w, s, s1, 0.05, 0.1, w.y1 - 0.22, w.y1 - 0.17);
      boxAlong(b, m.grate, w, s + 0.7, s + 0.76, 0.0, 0.14, w.y1 - 0.4, w.y1 - 0.12);
    }
  }
  // 壁の手すり（0.85 m・腕つき）と、高い所の配管 2 本（壁 4 m 以上）・換気の格子・消火栓の箱
  for (let s = 0; s < len; s += 1.5) {
    const s1 = Math.min(len, s + 1.5);
    const mid = (s + s1) / 2;
    if (doorAt(mid) || seenBy(w.hall ?? null, P(mid, 0.1, w.y0 + 0.9))) continue;
    if (w.rail !== false) {
      boxAlong(b, m.rail, w, s, s1, 0.09, 0.14, w.y0 + 0.83, w.y0 + 0.88);
      boxAlong(b, m.rail, w, s + 0.7, s + 0.76, 0.0, 0.1, w.y0 + 0.8, w.y0 + 0.84);
    }
    if (H > 4.2 && !seenBy(w.hall ?? null, P(mid, 0.1, w.y0 + 3.6))) {
      boxAlong(b, m.pipe, w, s, s1, 0.05, 0.13, w.y0 + 3.55, w.y0 + 3.63);
      boxAlong(b, m.pipe, w, s, s1, 0.05, 0.11, w.y0 + 3.75, w.y0 + 3.81);
      if (Math.round(s / 1.5) % 2 === 0) boxAlong(b, m.grate, w, s + 0.7, s + 0.78, 0.0, 0.15, w.y0 + 3.5, w.y0 + 3.86);
    }
  }
  for (let s = 8.5; s < len - 2; s += 12) {
    if (doorAt(s) || seenBy(w.hall ?? null, P(s, 0.05, w.y0 + 1.6))) continue;
    // 換気の格子（羽根つき）
    boxAlong(b, m.frame, w, s - 0.5, s + 0.5, 0, 0.03, w.y0 + 2.9, w.y0 + 3.3);
    for (let i = 0; i < 5; i++) boxAlong(b, m.grate, w, s - 0.45, s + 0.45, 0.03, 0.045, w.y0 + 2.95 + i * 0.07, w.y0 + 2.98 + i * 0.07);
    // 消火栓の箱（赤い扉・白い札）
    boxAlong(b, m.red, w, s + 1.2, s + 1.95, 0, 0.16, w.y0 + 0.6, w.y0 + 1.5);
    boxAlong(b, m.plate, w, s + 1.3, s + 1.85, 0.16, 0.17, w.y0 + 1.3, w.y0 + 1.42);
  }
  // 札（案内の板。12 m おき、柱型の間）
  for (let s = 5.5; s < len - 2; s += 12) {
    if (doorAt(s)) continue;
    if (seenBy(w.hall ?? null, P(s, 0.05, w.y0 + 2.0))) continue;
    boxAlong(b, m.plate, w, s - 0.35, s + 0.35, 0, 0.03, w.y0 + 1.75, w.y0 + 2.15);
    boxAlong(b, m.pict, w, s - 0.27, s - 0.05, 0.03, 0.035, w.y0 + 1.82, w.y0 + 2.08);
    boxAlong(b, m.pict, w, s + 0.02, s + 0.28, 0.03, 0.035, w.y0 + 1.9, w.y0 + 1.97);
  }
  // 壁ぎわの小物（プールサイドの物を乱数で。扉・窓・開口・参考画像の画角は避ける）
  if (w.props) {
    const sink = builderSink(b, _ctx);
    const pm = wpPropMats(_ctx);
    const yaw = Math.atan2(w.n[0], w.n[1]);
    let seed = Math.round(Math.abs(w.a[0] * 13.7 + w.a[1] * 7.3 + w.y0 * 3.1)) + 1;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let s = 1.8; s < len - 1.2; s += 3.4) {
      if (doorAt(s) || doorAt(s - 0.8) || doorAt(s + 0.8)) continue;
      const c = P(s, 0.55, w.y0);
      if (seenBy(w.hall ?? null, [c[0], w.y0 + 1.2, c[2]]) || seenBy(w.hall ?? null, c)) continue;
      const p = Prop.at(sink, pm, c, yaw, Math.round(rnd() * 1e6));
      const pick = rnd();
      if (pick < 0.22) wpBench(p, 1.6);
      else if (pick < 0.36) loungerStack(Prop.at(sink, pm, P(s, 1.1, w.y0), yaw + Math.PI / 2, Math.round(rnd() * 1e6)), 2 + Math.floor(rnd() * 4));
      else if (pick < 0.48) wpPlant(p);
      else if (pick < 0.58) floatRack(Prop.at(sink, pm, P(s, 0.45, w.y0), yaw, Math.round(rnd() * 1e6)));
      else if (pick < 0.68) wpBin(p);
      else if (pick < 0.76) ringBuoyPost(p);
      else if (pick < 0.84) poolShower(Prop.at(sink, pm, P(s, 0.1, w.y0), yaw, Math.round(rnd() * 1e6)));
      else if (pick < 0.92) wpVending(Prop.at(sink, pm, P(s, 0.45, w.y0), yaw, Math.round(rnd() * 1e6)));
      else kickboardPile(p, 10, [WC.yellow, WC.blue]);
    }
  }
  // 扉（枠・戸・取っ手）
  for (const s of w.doors ?? []) {
    if (seenBy(w.hall ?? null, P(s, 0.05, w.y0 + 1.0))) continue;
    boxAlong(b, m.frame, w, s - 0.65, s + 0.65, 0, 0.08, w.y0, w.y0 + 2.25);
    boxAlong(b, m.door, w, s - 0.55, s + 0.55, 0.08, 0.1, w.y0, w.y0 + 2.15);
    boxAlong(b, m.frame, w, s + 0.32, s + 0.42, 0.1, 0.14, w.y0 + 0.95, w.y0 + 1.05);
    boxAlong(b, m.plate, w, s - 0.25, s + 0.25, 0.08, 0.1, w.y0 + 2.28, w.y0 + 2.45);
    // 扉の前のゴムのマット（筋つき）
    boxAlong(b, m.mat, w, s - 0.6, s + 0.6, 0.15, 1.05, w.y0 + 0.002, w.y0 + 0.016);
  }
}

/**
 * 回廊・観覧席の床の下面（下の階の天井）の作り込み: 横の小梁（1.5 m おき）・四角い照明の器具（3 m おき）・配管の束（長い向き）。
 * rect = ワールドの x0, z0, x1, z1、y = 下面の高さ。長い向きに沿って並べる。視点から見える所（26 m 以内）は除く
 */
export function dressSoffit(b: Builder, m: DressMats, rect: [number, number, number, number], y: number, hall: HallId | null, lightAt: number | null = 0.5): void {
  const [x0, z0, x1, z1] = rect;
  const alongX = x1 - x0 >= z1 - z0;
  const L = alongX ? x1 - x0 : z1 - z0;
  const Wd = alongX ? z1 - z0 : x1 - x0;
  const at = (u: number, v: number): [number, number] => (alongX ? [x0 + u, z0 + v] : [x0 + v, z0 + u]);
  const box = (mat: THREE.Material, u0: number, u1: number, v0: number, v1: number, ya: number, yb: number): void => {
    const [ax, az] = at(u0, v0);
    const [bx, bz] = at(u1, v1);
    // 床の映り込みには出さない（明るい器具が濡れた床の縦の筋の中で光の粒にならないように）
    b.boxMM(mat, [Math.min(ax, bx), ya, Math.min(az, bz)], [Math.max(ax, bx), yb, Math.max(az, bz)], { shadow: false, layer: 1 });
  };
  const seen = (u: number, v: number): boolean => {
    const [x, z] = at(u, v);
    return seenBy(hall, [x, y - 0.1, z], 40);
  };
  for (let u = 0.75; u < L; u += 1.5) {
    if (seen(u, Wd / 2)) continue;
    box(m.pilaster, u - 0.07, u + 0.07, 0.05, Wd - 0.05, y - 0.22, y);
  }
  for (let u = 1.5; lightAt !== null && u < L - 0.5; u += 3.0) {
    const v = Wd * lightAt;
    if (seen(u, v)) continue;
    box(m.lampBody, u - 0.55, u + 0.55, v - 0.2, v + 0.2, y - 0.06, y);
    box(m.lampLit, u - 0.5, u + 0.5, v - 0.13, v + 0.13, y - 0.065, y - 0.059);
  }
  // 配管の束（壁ぎわ寄り）
  for (let u = 0; u < L; u += 1.5) {
    const u1 = Math.min(L, u + 1.5);
    if (seen((u + u1) / 2, Wd * 0.2)) continue;
    box(m.pipe, u, u1, Wd * 0.15, Wd * 0.15 + 0.09, y - 0.36, y - 0.27);
    box(m.pipe, u, u1, Wd * 0.15 + 0.14, Wd * 0.15 + 0.2, y - 0.33, y - 0.27);
    box(m.grate, u + 0.7, u + 0.76, Wd * 0.12, Wd * 0.15 + 0.24, y - 0.4, y - 0.22);
  }
}

/**
 * 上の階の床の上面（回廊・観覧席・塔の上・踊り場）: 床のタイル張りの板と縁の濃い帯（視点の目より高いので視点からは見えない）
 */
function upperFloor(b: Builder, m: DressMats, rect: [number, number, number, number], y: number): void {
  const [x0, z0, x1, z1] = rect;
  b.boxMM(m.upFloor, [x0, y, z0], [x1, y + 0.004, z1], { shadow: false });
  const e = 0.35;
  for (const [a, c] of [[[x0, z0], [x1, z0 + e]], [[x0, z1 - e], [x1, z1]], [[x0, z0], [x0 + e, z1]], [[x1 - e, z0], [x1, z1]]] as [[number, number], [number, number]][]) {
    b.boxMM(m.floorBand.X, [a[0], y + 0.004, a[1]], [c[0], y + 0.007, c[1]], { shadow: false });
  }
}

/**
 * 広間の天井から吊った灯り（6 m の升目。細い吊り棒・丸い笠・光る下面）。視点から見える所（26 m 以内）は除く
 */
function hallPendants(b: Builder, m: DressMats, id: HallId): void {
  const h = HALL[id];
  const [x0, z0, x1, z1] = [h.o[0] + h.rect[0], h.o[1] + h.rect[1], h.o[0] + h.rect[2], h.o[1] + h.rect[3]];
  for (let z = z0 + 3; z < z1 - 1; z += 6) {
    for (let x = x0 + 3; x < x1 - 1; x += 6) {
      const hh = hash(x * 0.13, z * 0.29);
      const y = h.ceil - 1.4 - hh * 1.2;
      if (seenBy(id, [x, y, z], 80) || seenBy(id, [x, h.ceil, z], 80)) continue;
      // 床の映り込みには出さない（視点の画角の外の灯りが、床の鏡像の中で小さな光の粒にならないように）
      b.boxMM(m.pipe, [x - 0.012, y + 0.2, z - 0.012], [x + 0.012, h.ceil, z + 0.012], { shadow: false, layer: 1 });
      const shade = new THREE.CylinderGeometry(0.16, 0.34, 0.24, 14, 1, true);
      shade.translate(x, y + 0.1, z);
      b.mesh(shade, m.lampBody, [0, 0, 0], { shadow: false, layer: 1 });
      const lit = new THREE.CircleGeometry(0.3, 14);
      lit.rotateX(Math.PI / 2);
      lit.translate(x, y - 0.015, z);
      b.mesh(lit, m.lampLit, [0, 0, 0], { shadow: false, layer: 1 });
    }
  }
}

/** 部屋の 4 面（内側の長方形）。開口の所は飛ばさない（扉の位置だけ避ける） */
export function dressRoom(b: Builder, ctx: SceneContext, m: DressMats, r: [number, number, number, number], y0: number, y1: number, hall: HallId | null, o: { doorsN?: number[]; doorsS?: number[]; doorsW?: number[]; doorsE?: number[]; skip?: ('n' | 's' | 'w' | 'e')[]; pilasters?: boolean; kind?: WallSpec['kind']; skipN?: [number, number][]; skipS?: [number, number][] } = {}): void {
  const [x0, z0, x1, z1] = r;
  const sk = o.skip ?? [];
  const kind = o.kind;
  if (!sk.includes('n')) dressWall(b, ctx, m, { a: [x0, z0], b: [x1, z0], n: [0, 1], y0, y1, hall, doors: o.doorsN, pilasters: o.pilasters, kind, skip: o.skipN });
  if (!sk.includes('s')) dressWall(b, ctx, m, { a: [x1, z1], b: [x0, z1], n: [0, -1], y0, y1, hall, doors: o.doorsS, pilasters: o.pilasters, kind, skip: o.skipS });
  if (!sk.includes('w')) dressWall(b, ctx, m, { a: [x0, z1], b: [x0, z0], n: [1, 0], y0, y1, hall, doors: o.doorsW, pilasters: o.pilasters, kind });
  if (!sk.includes('e')) dressWall(b, ctx, m, { a: [x1, z0], b: [x1, z1], n: [-1, 0], y0, y1, hall, doors: o.doorsE, pilasters: o.pilasters, kind });
}

/** 広間の壁の小物を置かない区間（南の壁の開口・C の仕切りの戸口など。壁の始点 a からの距離） */
function hallSkip(id: HallId, a: [number, number], c: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  // 南の壁（z 一定）なら開口の x 範囲
  if (Math.abs(a[1] - c[1]) < 0.01) {
    const dir = Math.sign(c[0] - a[0]);
    const o = SOUTH_OPEN[id];
    const s0 = (o[0] - a[0]) * dir;
    const s1 = (o[1] - a[0]) * dir;
    out.push([Math.min(s0, s1) - 1.2, Math.max(s0, s1) + 1.2]);
    const u = SOUTH_OPEN_UP[id];
    if (u) {
      const t0 = (u[0] - a[0]) * dir;
      const t1 = (u[1] - a[0]) * dir;
      out.push([Math.min(t0, t1) - 1.2, Math.max(t0, t1) + 1.2]);
    }
  }
  return out;
}

/** 建物全体の壁の作り込み（広間の写っていない壁・通路・2 階の観覧通路・シャワー室・更衣室） */
export function dressAll(b: Builder, ctx: SceneContext): void {
  const m = dressMats(ctx);
  const W = (id: HallId, x: number, z: number): [number, number] => [HALL[id].o[0] + x, HALL[id].o[1] + z];
  // 通路（南の壁に扉 = 倉庫・救護室・監視室。北の壁は広間の開口の間）
  dressWall(b, ctx, m, { a: [PROM[2], PROM[3]], b: [PROM[0], PROM[3]], n: [0, -1], y0: 0, y1: PROM_CEIL, doors: [8, 30, 52, 74, 96], gutter: true, kind: 'corridor', skip: [[PROM[2] - 1.8, PROM[2] + 1.8]] });
  const openings = (['A', 'B', 'C', 'D'] as HallId[]).map((id): [number, number] => [SOUTH_OPEN[id][0] - PROM[0] - 1.0, SOUTH_OPEN[id][1] - PROM[0] + 1.0]);
  dressWall(b, ctx, m, { a: [PROM[0], PROM[1]], b: [PROM[2], PROM[1]], n: [0, 1], y0: 0, y1: PROM_CEIL, pilasters: true, gutter: true, props: true, skip: openings, kind: 'corridor' });
  // 2 階の観覧通路
  dressWall(b, ctx, m, { a: [UPPER[2], PROM[3]], b: [UPPER[0], PROM[3]], n: [0, -1], y0: UPPER_Y, y1: 7.6, doors: [14, 34], kind: 'corridor' });
  const wins = (['A', 'C', 'D'] as HallId[]).flatMap((id) => viewWindows(id)).map(([a, c]): [number, number] => [a - UPPER[0], c - UPPER[0]]);
  const upOpen = (['A', 'C', 'D'] as HallId[]).map((id): [number, number] => [SOUTH_OPEN_UP[id]![0] - UPPER[0] - 1.0, SOUTH_OPEN_UP[id]![1] - UPPER[0] + 1.0]);
  dressWall(b, ctx, m, { a: [UPPER[0], UPPER[1]], b: [UPPER[2], UPPER[1]], n: [0, 1], y0: UPPER_Y, y1: 7.6, skip: [...wins, ...upOpen], kind: 'corridor' });
  // シャワー室・更衣室
  // 戸口（幅 3 m・x = 0 の中心）は器具を置かない
  const door3: [number, number][] = [[(SHOWER[2] - SHOWER[0]) / 2 - 2.0, (SHOWER[2] - SHOWER[0]) / 2 + 2.0]];
  const door3L: [number, number][] = [[(LOCKER[2] - LOCKER[0]) / 2 - 2.0, (LOCKER[2] - LOCKER[0]) / 2 + 2.0]];
  dressRoom(b, ctx, m, SHOWER, 0, 3.0, null, { skip: ['w', 'e'], pilasters: false, kind: 'shower', skipN: door3, skipS: door3 });
  dressRoom(b, ctx, m, LOCKER, 0, 3.0, null, { pilasters: false, kind: 'locker', skipN: door3L, skipS: door3L });
  // 広間の壁（参考画像の画角の外だけ）
  const hallWalls: [HallId, [number, number], [number, number], [number, number], number, number[]?][] = [
    ['A', W('A', 16, 10), W('A', -17, 10), [0, -1], HALL.A.ceil, []],
    // A の北の壁（視点の目から 32 m より遠い。踊り場の奥）
    ['A', W('A', -17, -32), W('A', 16, -32), [0, 1], HALL.A.ceil, [3.0, 30.0]],
    ['B', W('B', 22.5, -58), W('B', 22.5, 8), [-1, 0], HALL.B.ceil, [20, 40]],
    ['B', W('B', -3.5, -60), W('B', 22.5, -60), [0, 1], HALL.B.ceil, [10]],
    ['B', W('B', 22.5, 8), W('B', -3.5, 8), [0, -1], HALL.B.ceil],
    ['C', W('C', 14, 9), W('C', -8.5, 9), [0, -1], HALL.C.ceil],
    ['C', W('C', 14, -31), W('C', 14, 9), [-1, 0], HALL.C.ceil, [12, 30]],
    ['D', W('D', 11, 8), W('D', -12, 8), [0, -1], HALL.D.ceil],
    ['D', W('D', -12, 8), W('D', -12, -20), [1, 0], HALL.D.ceil, [6]],
    ['D', W('D', 11, -20), W('D', 11, 8), [-1, 0], HALL.D.ceil],
  ];
  for (const [id, a, c, n, h, doors] of hallWalls) dressWall(b, ctx, m, { a, b: c, n, y0: 0, y1: h, hall: id, doors, gutter: true, props: true, skip: hallSkip(id, a, c), kind: 'hall' });
  // 回廊・観覧席の床の下面
  const R = (id: HallId, a: number, c: number, d: number, e: number): [number, number, number, number] => [HALL[id].o[0] + a, HALL[id].o[1] + c, HALL[id].o[0] + d, HALL[id].o[1] + e];
  // 上の階の床（タイル張りと縁の帯）
  upperFloor(b, m, R('A', 10.6, -32, 16, 10), 4.5);
  upperFloor(b, m, R('A', -17, -32, -9.4, 10), 7.2);
  upperFloor(b, m, R('A', -17, -31.5, -14.9, -12), 3.6);
  upperFloor(b, m, R('A', -7, -32, 7, -28.8), 3.4);
  upperFloor(b, m, R('A', -2.4, -28.6, 1.6, -24.6), 6.9);
  upperFloor(b, m, [UPPER[0], UPPER[1], UPPER[2], PROM[3]], UPPER_Y);
  // 広間の天井から吊った灯り（A・B・C。D は星のような小さな灯りがある）
  for (const id of ['A', 'B', 'C'] as HallId[]) hallPendants(b, m, id);
  dressSoffit(b, m, R('A', -17, -32, -12.2, 10), 6.8, 'A');
  dressSoffit(b, m, R('A', 10.6, -32, 16, 10), 4.05, 'A', 0.78);
  dressSoffit(b, m, R('B', 19.4, -59.5, 22.5, -27), 4.1, 'B', 0.25);
  dressSoffit(b, m, R('B', -3.5, -60, -0.5, 8), 4.2, 'B', null);
  dressSoffit(b, m, R('C', -8.5, -4.4, -3.0, 9), 4.1, 'C');
  dressSoffit(b, m, R('D', 6.8, -6.8, 11, 8), 4.1, 'D');
  dressSoffit(b, m, R('D', -12, -4.0, -1.6, 8), 6.3, 'D');
  // C の仕切りの向こうの休憩所: 仕切りの東の面と、東の壁の低い所（参考画像 2 の視点からは仕切りの陰で見えない）
  dressWall(b, ctx, m, { a: W('C', 8.8, 5.5), b: W('C', 8.8, -15), n: [1, 0], y0: 0, y1: 3.4, hall: null, pilasters: false, kind: 'corridor' });
  dressWall(b, ctx, m, { a: W('C', 14, -15), b: W('C', 14, 9), n: [-1, 0], y0: 0, y1: 4.4, hall: null, pilasters: false, kind: 'corridor', doors: [14] });
  // C の西の壁（観覧席の下。参考画像 2 の視点の後ろ）と D の設備の部屋の南の面
  dressWall(b, ctx, m, { a: W('C', -8.5, 9), b: W('C', -8.5, -4.4), n: [1, 0], y0: 0, y1: 4.1, hall: 'C', pilasters: false, kind: 'corridor' });
  dressWall(b, ctx, m, { a: W('D', 8.8, -11.2), b: W('D', 11, -11.2), n: [0, 1], y0: 0, y1: 4.6, hall: 'D', pilasters: false, kind: 'corridor' });
  // B のアーケードの上の壁（4.5〜11 m。東を向く面）
  dressWall(b, ctx, m, { a: W('B', -0.5, 8), b: W('B', -0.5, -60), n: [1, 0], y0: 4.5, y1: HALL.B.ceil, hall: 'B', kind: 'hall', rail: false });
  // B の西のアーケードの壁（天井 4.2 m。扉の列。参考画像 1 に写る手前は除く）
  dressWall(b, ctx, m, { a: W('B', -3.5, 8), b: W('B', -3.5, -60), n: [1, 0], y0: 0, y1: 4.2, hall: 'B', doors: [13.3, 19.6, 25.9, 32.2, 38.5, 44.8, 51.1, 57.4, 63.7], kind: 'corridor' });
  // A の西の低い回廊（3.6 m）の壁: 扉（監視室・倉庫）・柱型・灯り
  dressWall(b, ctx, m, { a: W('A', -17, -12), b: W('A', -17, -31.5), n: [1, 0], y0: 3.6, y1: 6.8, hall: 'A', doors: [6, 14], kind: 'corridor' });
  dressWall(b, ctx, m, { a: W('A', -17, -31.5), b: W('A', -14.9, -31.5), n: [0, 1], y0: 3.6, y1: 6.8, hall: 'A', pilasters: false });
}
