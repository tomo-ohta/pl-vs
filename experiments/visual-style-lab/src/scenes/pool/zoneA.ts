import * as THREE from 'three';
import type { V3 } from '../Builder.ts';
import { gobo, roofGobo, T, towardSun, type Kit } from './kit.ts';
import { ViewCam } from './view.ts';

/** pool-0 の視点（区域 A の座標）と日の光の進む向き（右後ろの上から） */
export const CAM_A = new ViewCam([0, 1.92, 0], 0.021, -0.041, 53.5);
export const SUN_A: [number, number, number] = [-0.5, -0.65, -0.55];

/**
 * 区域 A（pool-0）: 通路に立って北（-Z）の長い水路を見る。右に柱の列、左に台座の列、上に梁と天窓。
 * 目は (0, 1.92, 0)（通路の上面 0.15 + 1.77）。日は右後ろの上から（光は -X・-Z へ進む）。
 */
export interface ZoneAMats {
  deck: THREE.Material;
  /** 奥の陰の床（暗い） */
  deckDeep: THREE.Material;
  col: THREE.Material;
  /** 左の台座（陰でも明るめ） */
  ped: THREE.Material;
  /** 奥の陰の柱（暗い） */
  colDeep: THREE.Material;
  beam: THREE.Material;
  /** 左の陰の天井・梁（暗い） */
  beamDeep: THREE.Material;
  wall: THREE.Material;
  /** 突き当たりの壁（暗い帯に見える） */
  farWall: THREE.Material;
  /** 奥の明るい開口（照明なし） */
  glow: THREE.Material;
  dark: THREE.Material;
  bar: THREE.Material;
}

export function buildZoneA(k: Kit, m: ZoneAMats): void {
  const b = k.b;
  const TOP = 0.15;
  const BEAM0 = 3.45; // 梁の下端
  const CEIL = 4.4; // 梁の上端・天井の下面
  const SLAB = 4.8;
  // 手前の梁より奥の梁・天井（陰は暗い青緑）
  const beamFar = k.b.ctx.mat({ name: 'a-beamFar', color: '#eef3e7', hi: '#e8eedf', shade: '#6c9c92', dark: '#62948b', tiles: { size: 2 * T, line: 0.01, color: '#c3cfc0', jitter: 0.015, broken: 0.35 } });

  // 通路（立っている所）と右奥の通路・左の水路の向こうの通路
  k.deck(m.deck, -2.0, -7.5, 22, 8, TOP);
  k.deck(m.deck, 7.0, -30, 22, -19, TOP);
  k.deck(m.deckDeep, -22, -40, -10.0, 8, TOP);

  // 底: 左の水路は深め、中央の水路は浅め
  k.basin(-10, -36, -2.0, 8, -0.8);
  k.basin(-2.0, -36, 3.5, -7.5, -0.45);
  k.basin(-2.0, -36, 3.5, -16, -0.3);

  // 右の柱の列（奥行きの長い柱 x 3.5〜4.25）
  const fronts = [-6.25, -12.25, -18.25, -24.25, -30.25];
  for (const z of fronts) {
    if (z === -6.25) {
      // 手前の柱は幅広で薄い（参考画像の x 1112〜1285）。上は段々の柱頭で梁につながる
      k.column(m.col, 3.25, z - 0.5, 4.25, z, -2, BEAM0, { base: TOP, plinth: [[0.0, 0.25]] });
      // 柱頭は梁の高さで手前へ張り出す箱の寄せ集め（参考画像の x 1115〜1290・y 30〜180）。継ぎ目は暗い凹み
      k.box(m.col, [3.0, BEAM0 - 0.05, z - 0.4], [4.1, CEIL + 0.1, z + 0.35]);
      k.box(m.col, [2.8, BEAM0 + 0.25, z - 0.3], [3.25, CEIL - 0.1, z + 0.5]);
      k.box(m.col, [3.6, BEAM0 + 0.15, z - 0.3], [4.15, CEIL - 0.25, z + 0.55]);
      k.box(m.col, [3.25, CEIL - 0.35, z - 0.3], [3.6, CEIL + 0.1, z + 0.45]);
      b.boxMM(m.dark, [3.25, BEAM0 + 0.35, z + 0.36], [3.31, CEIL + 0.1, z + 0.52], { shadow: false });
      b.boxMM(m.dark, [2.7, CEIL - 0.05, z + 0.0], [3.6, CEIL + 0.02, z + 0.5], { shadow: false });
      b.boxMM(m.dark, [3.55, BEAM0 + 0.5, z + 0.4], [3.62, CEIL - 0.25, z + 0.6], { shadow: false });
      continue;
    }
    k.column(m.col, 3.5, z - 1.5, 4.25, z, -2, BEAM0, { base: 0, plinth: [[0.0, 0.25]] });
    k.greeble(m.col, m.dark, [3.25, BEAM0 - 1.0, z - 1.75], [4.5, BEAM0, z + 0.25], 4, { faces: ['x', '-x', 'z'], size: [0.25, 0.75], out: 0.25 });
  }
  // 左の台座（2 つ並ぶ）と細い柱・配管
  k.box(m.ped, [-4.5, -2, -14.0], [-2.75, 2.5, -12.5], { collide: true });
  // 台座の間の奥（陰）
  k.box(m.colDeep, [-5.25, -2, -14.5], [-4.5, 2.5, -14.0], { collide: true });
  // 台座の前の明るい床（水面すれすれ）
  k.box(m.col, [-7.0, -2, -12.5], [-2.5, 0.05, -11.75], { collide: true });
  k.box(m.ped, [-6.75, -2, -13.75], [-5.25, 2.5, -12.25], { collide: true });
  b.boxMM(m.dark, [-4.4, 2.5, -13.4], [-3.9, 3.0, -12.9]);
  for (const x of [-6.4, -5.7, -3.2]) b.boxMM(m.dark, [x, 2.5, -13.0], [x + 0.06, BEAM0, -12.94], { shadow: 'cast' });
  // 左の列の奥（台座の後ろの柱）
  for (const z of [-18.5, -24.5, -30.5]) k.column(m.colDeep, -3.75, z - 1.0, -2.75, z, -2, BEAM0);
  // 左の奥の柱
  for (const z of [-12.5, -24.5]) k.column(m.colDeep, -8.0, z - 1.0, -7.0, z, -2, BEAM0);
  k.column(m.colDeep, -11.5, -12.0, -10.5, -11.0, -2, BEAM0);
  // 左の奥の壁（陰。区域 C へ抜ける口あり）
  k.box(m.colDeep, [-19, -2, -40], [-18, BEAM0, -30], { collide: true });
  k.box(m.colDeep, [-19, -2, -26], [-18, BEAM0, 8], { collide: true });
  k.box(m.colDeep, [-19, 2.5, -30], [-18, BEAM0, -26]);
  // 右の奥の柱の列
  for (const z of [-18.25, -24.25, -30.25]) k.column(m.col, 9.75, z - 1.5, 11.25, z, -2, BEAM0);

  // 突き当たりの壁（右奥に区域 D へ抜ける口）
  k.box(m.farWall, [-22, -2, -37], [6.0, CEIL, -36], { collide: true });
  k.box(m.farWall, [8.0, -2, -37], [22, CEIL, -36], { collide: true });
  k.box(m.farWall, [6.0, 2.5, -37], [8.0, CEIL, -36]);
  // 突き当たりの壁の明るい開口（奥の明るい部屋）
  for (const [x0, x1] of [[-1.5, 0.5], [2.0, 2.75], [8.5, 10.0]] as [number, number][]) b.boxMM(m.glow, [x0, 0, -35.98], [x1, 2.2, -35.94], { shadow: false });
  // 水から通路へ上がる段（視点の後ろ・左の通路の縁）
  k.shelf(-2.0, 8.0, 6.0, 8.75, -0.15);
  k.shelf(-10.0, 4.0, -9.5, 8.0, -0.15);

  // 横の梁（柱の列ごと）
  for (const z of fronts) {
    k.box(m.beamDeep, [-22, BEAM0, z - 1.5], [-2.0, CEIL, z]);
    k.box(z < -6.25 ? beamFar : m.beam, [-2.0, BEAM0, z - 1.5], [22, CEIL, z]);
  }
  // 縦の梁: 右の列の上（柱より右へ張り出す。柱の正面に斜めの影を落とす）、左の列の上
  k.box(m.beam, [3.0, BEAM0 + 0.25, -36], [4.5, CEIL, -7.0]);
  // 左の列の上の縦の梁は影を落とさない（台座の正面に日が当たる。台座の影の形は見えない板で決める）
  k.box(m.beamDeep, [-5.0, BEAM0, -36], [-2.0, CEIL, -11.0], { shadow: 'receive' });
  k.box(m.beamDeep, [-5.0, BEAM0, -8.0], [-2.0, CEIL, 2], { shadow: 'receive' });
  k.box(m.beamDeep, [-5.0, BEAM0, -11.0], [-2.0, CEIL, -8.0], { shadow: 'receive' });
  k.box(m.beam, [9.75, BEAM0, -36], [11.25, CEIL, -3.5]);
  k.box(m.beamDeep, [-8.5, BEAM0, -36], [-7.0, CEIL, 8]);

  // 梁の下の細かい張り出し（箱の積み重ね）と暗い凹み・吊り下がった配管
  for (const z of fronts) {
    k.greeble(m.beam, null, [-2.0, BEAM0 + 0.25, z - 1.75], [12, CEIL - 0.25, z + 0.25], 6, { faces: ['z'], size: [0.25, 0.5], out: 0.25 });
    k.greeble(m.beamDeep, m.dark, [-16, BEAM0 - 0.25, z - 1.75], [-2.0, BEAM0 + 0.5, z + 0.25], 14, { faces: ['z', '-y'], size: [0.25, 0.5], out: 0.25 });
  }
  k.greeble(m.beamDeep, null, [-5.25, BEAM0 - 0.25, -36], [-2.0, BEAM0 + 0.4, 2], 0, { faces: ['-x', '-y', '-y'], size: [0.25, 0.5], out: 0.25 });
  k.greeble(m.beam, m.dark, [2.25, BEAM0 - 0.25, -36], [5.25, BEAM0 + 0.4, -6.25], 14, { faces: ['x', '-x', '-y'], size: [0.25, 0.75], out: 0.25 });
  // 中央の水路の上: 梁から吊り下がった小さな箱（少しだけ）
  for (const z of fronts) k.greeble(m.beam, m.dark, [-2.0, BEAM0 - 0.25, z - 1.75], [3.0, BEAM0, z + 0.25], 4, { faces: ['-y'], size: [0.25, 0.5], out: 0.25 });
  for (let z = -2; z > -34; z -= 2.5) {
    for (const x of [-1.9, -5.1]) b.boxMM(m.dark, [x, 1.9 + ((z * 7) % 3 === 0 ? 0.4 : 0.9), z - 0.03], [x + 0.06, BEAM0, z + 0.03], { shadow: 'cast' });
  }

  // 天井（天窓の所は開ける）。手前の梁より奥の天井の下面は暗い青緑
  const slab = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(z1 <= -6.25 ? beamFar : m.beam, [x0, CEIL, z0], [x1, SLAB, z1]);
  };
  const slabD = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(m.beamDeep, [x0, CEIL, z0], [x1, SLAB, z1]);
  };
  slabD(-22, -36, -13.5, 8); // 左の奥
  slabD(-10.0, -36, -8.5, 8);
  slabD(-7.0, -36, -2.0, -11.0); // 左
  slabD(-7.0, -8.0, -2.0, 8);
  // （z -11〜-8 は影を落とさない板。光の形は見えない屋根で決める: 左の台座の正面だけに日が当たる）
  k.box(m.beamDeep, [-7.0, CEIL, -11.0], [-2.0, SLAB, -8.0], { shadow: 'receive' });
  slab(-2.0, -6.25, 2.75, 8); // 手前の水路の上
  // 奥の水路の上（細い天窓だけ）。z -11.75〜-8 は影を落とさない板（左の台座に日を落とす見えない屋根の穴の所）
  slab(-2.0, -36, 0.5, -11.75);
  slab(-2.0, -8.0, 0.5, -6.25);
  k.box(beamFar, [-2.0, CEIL, -11.75], [0.5, SLAB, -8.0], { shadow: 'receive' });
  slab(2.0, -36, 2.5, -6.25);
  slab(2.5, -36, 5.0, -12.25); // 右奥（柱の列の上）
  slab(9.5, -36, 22, -12.25);
  // 右奥の天窓（x 5〜9.5）の桟
  for (let z = -36; z <= -12.25; z += 1.0) b.boxMM(m.bar, [5.0, CEIL, z - 0.05], [9.5, CEIL + 0.1, z + 0.05], { shadow: 'cast' });
  slab(2.5, -12.25, 5.0, -6.25);
  slab(12.0, -12.25, 22, -6.25);
  slab(2.5, -6.25, 5.0, -3.5);
  // 通路の奥に帯状の影を落とす天井の帯
  slab(2.75, -3.5, 6.0, -2.75);
  // 中央の水路の上の細い天窓（x 0.5〜2）の桟
  for (let z = -36; z <= -6.25; z += 0.75) b.boxMM(m.bar, [0.5, CEIL, z - 0.04], [2.0, CEIL + 0.1, z + 0.04], { shadow: 'cast' });
  // 左の奥の天窓（x -13.5〜-10）: 光は左の奥の床に落ち、手前の水に映る
  for (let z = -36; z <= 8; z += 1.5) b.boxMM(m.bar, [-13.5, CEIL, z - 0.15], [-10.0, CEIL + 0.1, z + 0.15], { shadow: 'cast' });
  // 手前の大きな天窓の桟（床に細い斜めの影を落とす）
  b.box(m.beam, [5.35, CEIL + 0.1, -1.3], [3.2, 0.2, 0.3], { rotY: -0.2 });
  b.box(m.beam, [12, CEIL + 0.1, 2.0], [18, 0.2, 0.3]);

  // --- 影の形（見えない板）: 参考画像の影の形を面の上でなぞった多角形（画素） ---
  const sun = new THREE.Vector3(...SUN_A);
  const onZ = (zf: number, px: [number, number][]): V3[] => px.map(([x, y]) => CAM_A.hit(x, y, 'z', zf));
  // 左の台座の正面: 左上が陰（斜めの境目）
  gobo(b, onZ(-12.25, [[296, 326], [404, 326], [404, 352], [342, 418], [312, 452], [296, 452]]), sun, 0.3);
  gobo(b, onZ(-12.5, [[452, 326], [582, 326], [582, 338], [540, 382], [505, 418], [470, 452], [452, 452]]), sun, 0.3);
  // 左の台座に日を落とす見えない屋根（影を落とさない天井の板の所を覆い、台座の日なたの形の所だけ穴）
  const lit1 = onZ(-12.25, [[404, 352], [404, 505], [296, 505], [296, 452], [312, 452], [342, 418]]);
  const lit2 = onZ(-12.5, [[582, 338], [582, 505], [452, 505], [452, 452], [470, 452], [505, 418], [540, 382]]);
  const upA = (pts: V3[]): [number, number][] => pts.map((p) => towardSun(p, sun, SLAB + 0.1));
  roofGobo(b, [-7.0, -12.0, 0.5, -8.0], SLAB + 0.1, 0.0625, [upA(lit1), upA(lit2)]);
  // 右の手前の柱の正面: 左上が陰（斜めの境目）
  gobo(b, onZ(-6.25, [[1150, 170], [1295, 170], [1295, 362], [1250, 420], [1200, 495], [1162, 560], [1150, 560]]), sun, 0.25);
}
