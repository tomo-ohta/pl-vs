import * as THREE from 'three';
import type { V3 } from '../Builder.ts';
import { gobo, type Kit } from './kit.ts';
import { ViewCam } from './view.ts';

/** pool-3 の視点（区域の座標）と日の光の進む向き（後ろの右上から） */
export const CAM_D = new ViewCam([0, 1.2, 0], -0.018, 0.087, 60);
export const SUN_D: [number, number, number] = [-0.25, -0.65, -0.72];

/**
 * 区域 D（pool-3）: 水の中に立ち（目は水面から 1.2 m、少し見上げる）、中央の水路の奥の暗いトンネルを見る。
 * 手前の左右に台座付きの太い柱、その奥に段々のアーチの壁が 2 枚、突き当たりに暗いトンネル。中央の水路の上はガラスのかまぼこ屋根。
 * 光: 日は後ろの右上から。壁や柱に落ちる斜めの段々の影は、参考画像の影の形を面の上でなぞった見えない板（gobo）で決める（影の升目に丸めて段々にする）。
 * 寸法は参考画像の位置から逆算した（画面の x と奥行きから横位置、画面の y と奥行きから高さ）。原点 (ox, oz) は目の真下の水面。
 */
export interface ZoneDMats {
  wall: THREE.Material;
  inner: THREE.Material;
  dark: THREE.Material;
  /** 室内の陰（照明なしの暗い青緑） */
  shadow: THREE.Material;
  glass: THREE.Material;
  /** 暗い部屋の柱（照明なし） */
  roomPillar: THREE.Material;
  /** 陰の側面（照明に関係なく陰の色） */
  side: THREE.Material;
  sky: THREE.Material;
  /** 開口の見込み（陰の濃い青緑。照明なし） */
  reveal: THREE.Material;
  /** ガラスの屋根の面（照明なし・内側から見る） */
  pane: THREE.Material;
}

export function buildZoneD(k: Kit, m: ZoneDMats, ox: number, oz: number): void {
  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  const b = k.b;
  // 影は既定で受けるだけ（影の形は見えない板で決める）。影を落とす物は shadow: true
  const box = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, collide = false, shadow: boolean | 'receive' = 'receive'): void => {
    k.box(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { collide, shadow });
  };
  const TOP = 7.5;

  // 底（立って歩ける深さ）
  k.basin(X(-20), Z(-40), X(20), Z(6), -0.5);
  // 中央の水路は深い（暗い青緑）
  k.basin(X(-1.25), Z(-40), X(2.0), Z(6), -3.0);

  /**
   * 段々のアーチの開口を持つ壁（z0〜z1）。開口は [xa, xb]・高さ ya まで。
   * 左右の肩は steps 段で ys から ya まで上がる（段の幅 sw）。stepL / stepR で片側だけにもできる
   */
  const archWall = (
    mat: THREE.Material,
    z0: number,
    z1: number,
    xl: number,
    xr: number,
    xa: number,
    xb: number,
    ys: number,
    ya: number,
    top: number,
    o: { steps?: number; sw?: number; stepL?: boolean; stepR?: boolean } = {},
  ): void => {
    const n = o.steps ?? 4;
    const sw = o.sw ?? 0.375;
    const dy = (ya - ys) / n;
    // 開口の左右の壁
    box(mat, xl, -2, z0, xa, top, z1, true);
    box(mat, xb, -2, z0, xr, top, z1, true);
    // 開口の上
    box(mat, xa, ya, z0, xb, top, z1);
    // 肩の段（上へ行くほど内側へ張り出す）
    for (let i = 0; i < n; i++) {
      const y0 = ys + i * dy;
      const w = (i + 1) * sw;
      if (o.stepL ?? true) box(mat, xa, y0, z0, xa + w, y0 + dy, z1);
      if (o.stepR ?? true) box(mat, xb - w, y0, z0, xb, y0 + dy, z1);
    }
  };

  // --- 手前の左右の柱（台座付き） ---
  // 左: 台座 x -5〜-1.76（上面 0.6、前の縁 z -5.85）、柱 x -4.08〜-2.44（前の面 z -5.8）。参考画像の柱 x 205〜410・台座 x 90〜495 から
  // （左の柱は影を落とさない: 参考画像では柱の左の壁が明るい）
  box(m.wall, -5.0, -2, -6.8, -1.76, 0.6, -5.85, true, true);
  box(m.wall, -4.08, 0.6, -6.6, -2.44, TOP, -5.8, true, true);
  box(m.wall, -4.08, 6.1, -8.0, -2.44, TOP, -6.6);
  // 左の柱の右の側面は陰の色（色指定）
  box(m.side, -2.44, 0.6, -6.6, -2.41, 6.1, -5.8);
  // 右: 台座 x 1.82〜5.27（上面 0.48、前の縁 z -6.65）、柱 x 2.73〜4.46（前の面 z -6.8）。参考画像の柱 x 1000〜1180・台座 x 905〜1285 から
  box(m.wall, 1.82, -2, -7.8, 5.27, 0.48, -6.65, true, true);
  box(m.wall, 2.73, 0.48, -8.0, 4.46, TOP, -6.8, true, true);
  // 柱の上の手前へ伸びる梁（右は画面の右上に見える。左は画面の外）
  box(m.wall, 3.4, 5.47, -8.5, 6.5, 6.5, -3.5, false, true);

  // --- 1 枚目のアーチの壁（前面 z -8）: 開口 x -3.5〜1.5、左の肩だけ段々 ---
  archWall(m.wall, -8.75, -8.0, -3.6, 4.5, -3.5, 1.5, 3.35, 4.85, 6.1, { steps: 4, sw: 0.4, stepR: false });
  // 左の柱の左: 1 枚目の壁に大きな開口（奥の暗いアーチが見える）
  box(m.wall, -14, -2, -8.75, -9.5, 6.1, -8.0, true);
  box(m.wall, -9.5, 3.0, -8.75, -3.6, 6.1, -8.0);
  box(m.wall, -3.6, -2, -8.75, -3.5, 3.35, -8.0, true);
  // 開口の奥: 陰の横の壁と、突き当たりの暗いアーチ
  box(m.inner, -10.0, -2, -24, -9.5, 3.0, -8.75, true);
  // 左の奥の暗い開口（参考画像の左端の暗いアーチ）: 横の壁の手前の部分を暗く
  box(m.shadow, -9.52, -2, -11.2, -9.48, 3.0, -8.75);
  box(m.inner, -10.0, -2, -24.5, -3.0, 3.0, -24.0, true);
  box(m.shadow, -9.5, -2, -23.98, -6.0, 2.4, -23.9);
  box(m.inner, -10.0, 3.0, -24.5, -3.0, 3.4, -8.75);
  // 壁の上（中央の水路の上は高さ 6.85 から上を開けてガラスの屋根を見せる。参考画像の画面の一番上 x 565〜850）
  box(m.wall, -14, 6.1, -8.75, -1.95, TOP, -8.0);
  box(m.wall, -1.95, 6.1, -8.75, 1.75, 6.85, -8.0);
  box(m.wall, 1.75, 6.1, -8.75, 6.0, TOP, -8.0);
  box(m.wall, 6.0, 6.1, -8.75, 14, TOP, -8.0);
  // 右の柱の右: 暗い部屋の開口の上の壁（右ほど開口が高い・段々）
  box(m.inner, 4.5, 3.75, -8.75, 6.0, 6.1, -8.0);
  box(m.wall, 6.0, 4.2, -8.75, 7.0, 6.1, -8.0);
  box(m.wall, 7.0, 4.6, -8.75, 14, 6.1, -8.0);

  // 参考画像の画素から面の上の位置を求める（縦の縁は地平線の高さ、横の縁は画面の中央で測る）
  const sx = (px: number, z: number): number => CAM_D.hit(px, 470, 'z', z)[0];
  const sy = (py: number, z: number): number => CAM_D.hit(715, py, 'z', z)[1];

  // --- 2 枚目の壁（前面 z -13）: 上の帯（ガラスの屋根が見える窓）と、段々のアーチ ---
  const Z2 = -13.0;
  const Z2b = -14.5;
  const a2l = sx(560, Z2); // アーチの左の縁（肩の一番下の段）
  const a2r = sx(850, Z2);
  const a2t = sy(285, Z2); // アーチの上
  const w2l = sx(625, Z2); // 窓
  const w2r = sx(800, Z2);
  const w2b = sy(235, Z2);
  box(m.inner, -14, -2, Z2b, a2l, TOP, Z2, true);
  box(m.inner, a2r, -2, Z2b, 14, TOP, Z2, true);
  box(m.inner, a2l, a2t, Z2b, w2l, TOP, Z2);
  box(m.inner, w2r, a2t, Z2b, a2r, TOP, Z2);
  box(m.inner, w2l, a2t, Z2b, w2r, w2b, Z2);
  // 左の肩の段（参考画像: x 560→600→640、y 345→330→300→285）
  box(m.inner, a2l, sy(330, Z2), Z2b, sx(600, Z2), a2t, Z2);
  box(m.inner, sx(600, Z2), sy(300, Z2), Z2b, sx(640, Z2), a2t, Z2);

  // --- 3 枚目: トンネルの入口（前面 z -18）と、その奥の暗いトンネル ---
  const Z3 = -18.0;
  const Z3b = -19.0;
  const a3l = sx(640, Z3);
  const a3r = sx(832, Z3);
  const a3t = sy(345, Z3);
  box(m.inner, -14, -2, Z3b, a3l, 9.0, Z3, true);
  box(m.inner, a3r, -2, Z3b, 14, 9.0, Z3, true);
  box(m.inner, a3l, a3t, Z3b, a3r, 9.0, Z3);
  // 入口の上の角の段
  box(m.inner, a3l, sy(360, Z3), Z3b, sx(660, Z3), a3t, Z3);
  box(m.inner, sx(812, Z3), sy(360, Z3), Z3b, a3r, a3t, Z3);
  box(m.dark, a3l, -2, -40, a3r, a3t, -39.5);
  box(m.dark, a3l - 0.5, -2, -40, a3l, a3t, Z3b);
  box(m.dark, a3r, -2, -40, a3r + 0.5, a3t, Z3b);
  box(m.dark, a3l - 0.5, a3t, -40, a3r + 0.5, a3t + 0.5, Z3b);
  // 2 枚目と 3 枚目の間の横の壁
  box(m.inner, -8.0, -2, Z3, -7.0, 9.0, Z2b, true);
  box(m.inner, 7.0, -2, Z3, 8.0, 9.0, Z2b, true);

  // --- 1 枚目の壁の開口の内側（見込み）: 陰の濃い青緑（参考画像の開口の縁の暗い帯） ---
  box(m.reveal, -3.52, -2, -8.74, -3.48, 3.35, -8.01, false, false);
  for (let i = 0; i < 4; i++) {
    const y0 = 3.35 + i * 0.375;
    const xw = -3.5 + (i + 1) * 0.4;
    box(m.reveal, xw - 0.02, y0, -8.74, xw + 0.02, y0 + 0.375, -8.01, false, false);
    box(m.reveal, -3.5, y0 - 0.02, -8.74, xw, y0 + 0.02, -8.01, false, false);
  }
  box(m.reveal, -1.9, 4.83, -8.74, 1.5, 4.87, -8.01, false, false);

  // --- 右: 暗い部屋（右の柱の右の奥） ---
  box(m.shadow, 4.5, -2, -12.5, 14, 4.6, -12.0);
  box(m.shadow, 4.5, 3.25, -12.0, 14, 4.6, -9.5);
  box(m.roomPillar, 7.5, -2, -12.0, 8.25, 3.25, -11.0, true);
  box(m.roomPillar, 10.5, -2, -12.0, 11.25, 3.25, -11.0, true);
  // 暗い部屋の手前の低い縁（水面の少し上）
  box(m.side, 5.5, -2, -9.6, 14, 0.3, -8.8, true);

  // --- ガラスのかまぼこ屋根（中央の水路の上）: 1 枚目の壁の上の高い部分と、その奥の低い部分 ---
  const vault = (z0: number, z1: number, yc: number, R: number, cx0 = -0.1, step = 1.0): void => {
    for (let z = z0; z >= z1 - 1e-6; z -= step) {
      for (let a = 0; a < 12; a++) {
        const t0 = ((a + 0.5) / 12) * Math.PI;
        b.box(m.glass, [X(cx0 + Math.cos(t0) * R), yc + Math.sin(t0) * R, Z(z)], [0.07, (Math.PI * R) / 12 + 0.02, 0.07], { rotZ: t0, shadow: false });
      }
    }
    for (let a = 1; a < 12; a += 2) {
      const t0 = (a / 12) * Math.PI;
      const cx = cx0 + Math.cos(t0) * R;
      const cy = yc + Math.sin(t0) * R;
      b.boxMM(m.glass, [X(cx - 0.03), cy - 0.03, Z(z1)], [X(cx + 0.03), cy + 0.03, Z(z0)], { shadow: false });
    }
    // ガラス（明るい面。内側から見る）
    const g = new THREE.CylinderGeometry(R + 0.05, R + 0.05, z0 - z1, 24, 1, true, -Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    b.mesh(g, m.pane, [X(cx0), yc, Z((z0 + z1) / 2)], { shadow: false });
  };
  vault(0, -8.75, 6.85, 1.85);
  vault(-14.5, -18.0, 5.6, 1.75, -0.15, 1.5);
  // 屋根の外の天井（目の上も覆う: 手前の水面に映る）。ガラスの屋根の所は開ける
  box(m.wall, -14, TOP, -8.0, -1.95, TOP + 0.5, 6.0);
  box(m.wall, 1.75, TOP, -8.0, 14, TOP + 0.5, 6.0);
  box(m.wall, -2.2, 6.85, -8.0, -1.95, TOP + 0.5, 6.0);
  box(m.wall, 1.75, 6.85, -8.0, 2.0, TOP + 0.5, 6.0);
  box(m.wall, -14, TOP, -26, -2.15, TOP + 0.5, -8.0);
  box(m.wall, 1.85, TOP, -26, 14, TOP + 0.5, -8.0);
  box(m.wall, -14, 9.0, -40, 14, 9.5, -26);
  // 空
  b.boxMM(m.sky, [X(-30), 14, Z(-60)], [X(30), 14.2, Z(10)], { shadow: false });

  // --- 影の形（見えない板）: 参考画像の影の形を面の上でなぞった多角形（画素）---
  const sun = new THREE.Vector3(...SUN_D);
  const onZ = (zf: number, px: [number, number][]): V3[] => px.map(([x, y]) => {
    const h = CAM_D.hit(x, y, 'z', zf);
    return [X(h[0]), h[1], Z(h[2])];
  });
  const onX = (xf: number, px: [number, number][]): V3[] => px.map(([x, y]) => {
    const h = CAM_D.hit(x, y, 'x', xf);
    return [X(h[0]), h[1], Z(h[2])];
  });
  // 右の柱の正面: 左上が陰（段々の斜めの境目）
  gobo(k.b, onZ(-6.8, [[975, 60], [1190, 60], [1190, 335], [1160, 340], [1160, 360], [1150, 365], [1145, 400], [1135, 420], [1110, 440], [1090, 460], [1072, 480], [1052, 500], [1045, 552], [975, 552]]), sun, 0.25);
  // 1 枚目の壁の右（柱の左）: 陰
  gobo(k.b, onZ(-8.0, [[835, -20], [985, -20], [985, 552], [850, 552], [850, 150], [795, 150], [795, 125], [812, 90], [825, 40]]), sun, 0.2);
  // 2 枚目の壁: アーチの左（斜めの境目の左上が陰）と、トンネルの右の大きな陰
  gobo(k.b, onZ(-13.0, [[380, 240], [585, 262], [578, 285], [560, 300], [545, 330], [530, 360], [510, 400], [490, 430], [470, 460], [450, 492], [380, 492]]), sun, 0.3);
  gobo(k.b, onZ(-13.0, [[860, 120], [860, 492], [765, 492], [745, 400], [735, 335], [760, 280], [785, 230], [810, 180], [830, 140]]), sun, 0.3);
  // 右の柱の右（1 枚目の壁の右の上）: 段々の明るい帯だけ日なた。その上と下は陰
  gobo(k.b, onZ(-8.0, [[1180, -40], [1480, -40], [1480, 40], [1440, 75], [1405, 100], [1375, 125], [1335, 152], [1300, 178], [1265, 200], [1180, 205]]), sun, 0.2);
  gobo(k.b, onZ(-8.0, [[1290, 200], [1310, 175], [1350, 150], [1480, 145], [1480, 260], [1180, 260], [1180, 205]]), sun, 0.2);
  // 左の奥の横の壁（x -9.5）: 斜めの境目の左上が陰
  gobo(k.b, onX(-9.5, [[100, 270], [215, 270], [215, 335], [190, 370], [160, 420], [130, 470], [110, 505], [100, 505]]), sun, 0.2);
  // 左の柱の左（1 枚目の壁の左の上）: 上の帯だけ明るく、その下は陰（明るい斑を残す）
  gobo(k.b, onZ(-8.0, [[-20, 145], [75, 142], [80, 155], [130, 180], [165, 185], [170, 195], [150, 200], [90, 215], [70, 245], [80, 260], [150, 262], [205, 265], [205, 560], [-20, 560]]), sun, 0.2);
}
