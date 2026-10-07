import * as THREE from 'three';
import type { V3 } from '../Builder.ts';
import { roofGobo, T, towardSun, type Kit } from './kit.ts';
import { ViewCam } from './view.ts';

/**
 * 区域 B（pool-1）: 水の中に立ち（目は水面から 1.33 m）、太い角柱の森を斜め（升目に対して右へ 40°）に見る。
 * 柱は 6 m の升目。柱は段々に広がる柱頭で、すぐ頭上の重い梁の格子につながる。梁の間は開いていて白い空が見える。
 * 光: 高い日が後ろから。区域の上に見えない屋根（影だけ落とす）を置き、日の当たる所（参考画像で明るい水色の水底・白い塊）の上だけ穴を開ける。
 * 柱・梁・柱頭は陰（青緑）、水底は日の当たる所だけ明るい水色、手前の白い段々の塊は日なた。
 * 原点 (ox, oz) は目の真下の水面。柱の中心は (6 + 6i, -7 - 6j)。手前の物と光の形は参考画像の画素から CAM_B で位置を決める。
 */
export const CAM_B = new ViewCam([0, 1.33, 0], -0.7, 0.0, 60);
/** 日の光の進む向き（後ろの高い所から） */
export const SUN_B: [number, number, number] = [0.3, -0.85, -0.45];
/** 見えない屋根の高さ */
const GOBO_Y = 8.0;

export function buildZoneB(k: Kit, ox: number, oz: number): void {
  const m = k.b.ctx.mat;
  const tl = (grout: string, size = T) => ({ size, line: 0.014, color: grout, jitter: 0.02 });
  // 柱の軸は常に陰（参考画像では日の当たる柱は無い）
  const shaft = m({ name: 'b-shaft', color: '#80b8ae', hi: '#80b8ae', shade: '#7eb7ad', dark: '#6aa29c', tiles: tl('#6ea69c') });
  const col = m({ name: 'b-col', color: '#f2f8f1', hi: '#fbfdf9', shade: '#7eb7ad', dark: '#5f9893', tiles: tl('#d3e2db') });
  const cap = m({ name: 'b-cap', color: '#8cc0b6', hi: '#8cc0b6', shade: '#84bbb2', dark: '#6aa29c', tiles: tl('#79ada3') });
  const beam = m({ name: 'b-beam', color: '#97c6bc', hi: '#97c6bc', shade: '#8fc0b6', dark: '#76aaa2', tiles: tl('#80b2a8', 2 * T) });
  const block = m({ name: 'b-block', color: '#f3f7ef', hi: '#fcfefa', shade: '#a9cdc4', dark: '#86b4aa', tiles: tl('#d9e4dc') });
  const recess = m({ name: 'b-recess', color: '#4c7b84', unlit: true, tiles: { size: T, line: 0.012, color: '#44717a' } });
  // 左手前の柱（参考画像では陰）
  const colNL = m({ name: 'b-colNL', color: '#a8cbc2', hi: '#b9d6cd', shade: '#6e9b96', dark: '#5f8e89', tiles: tl('#8fb3ab') });
  // 空: 淡い青緑に白い雲の斑
  const ceilB = m({ name: 'b-ceil', color: '#d4e8e2', hi: '#e2f0ec', shade: '#a9cfc7', dark: '#93c1b8', tiles: tl('#b9d6cf', 2 * T) });
  const sky = m({ name: 'b-sky', color: '#a9d3d0', unlit: true, noFog: true, line: 0, blotch: { color: '#f4fbf7', scale: 0.12, threshold: -0.05 } });

  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  // 梁・柱頭は影を落とさない（光の形は見えない屋根の穴で決める）。影を受けて陰の色になる
  const box = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, collide = false): void => {
    const sh = mat === beam || mat === cap || mat === colNL ? 'receive' : true;
    k.box(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { collide, shadow: sh });
  };
  /** 回した箱（原点 o・向き a の局所座標 u（横）・v（手前）で角の範囲）。水中の部分は包み箱で底の升目に書く。上面の四隅を返す */
  const rbox = (mat: THREE.Material, o: [number, number], a: number, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number): V3[] => {
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // u 軸 = (cos a, 0, -sin a)、v 軸 = (sin a, 0, cos a)（rotY = a）
    const cx = o[0] + cu * ca + cv * sa;
    const cz = o[1] - cu * sa + cv * ca;
    k.b.box(mat, [X(cx), (y0 + y1) / 2, Z(cz)], [u1 - u0, y1 - y0, v1 - v0], { rotY: a, collide: true });
    const hu = (u1 - u0) / 2;
    const hv = (v1 - v0) / 2;
    const ex = Math.abs(hu * ca) + Math.abs(hv * sa);
    const ez = Math.abs(hu * sa) + Math.abs(hv * ca);
    // 底の升目: 回した長方形の中に中心がある升目だけ（包み箱で塗ると、箱の無い水面まで「詰まっている」ことになる）
    if (y0 < 0) {
      const c = k.hf.cell;
      for (let zz = Math.floor((cz - ez) / c) * c; zz < cz + ez; zz += c)
        for (let xx = Math.floor((cx - ex) / c) * c; xx < cx + ex; xx += c) {
          const dx = xx + c / 2 - cx;
          const dz = zz + c / 2 - cz;
          const lu = dx * ca - dz * sa;
          const lv = dx * sa + dz * ca;
          if (Math.abs(lu) <= hu && Math.abs(lv) <= hv) k.hf.rect(X(xx), Z(zz), X(xx + c), Z(zz + c), y1 >= 0 ? 50 : y1, 'max');
        }
    }
    const pts: V3[] = [];
    for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]) pts.push([o[0] + u * ca + v * sa, y1, o[1] - u * sa + v * ca]);
    return pts;
  };

  // 柱の升目（参考画像の柱の位置から: 真ん中の柱 (6, -7)、右の柱 (13.6, -7)、左奥の柱 (6, -16)、左手前の柱 (-1.6, -7)）
  const SX = 7.6;
  const SZ = 9;
  const CX = (i: number): number => 6 + i * SX;
  const CZ = (j: number): number => -7 - j * SZ;
  const HW = 0.5625; // 柱の半幅
  const CAP0 = 2.82; // 柱の上端（柱頭の下端）
  const CAP1 = 3.05; // 柱頭の 1 段目の上端
  const BEAM0 = 3.35; // 柱頭の 2 段目の上端 = 梁の下端
  const BEAMT = 4.1; // 梁の上端
  const BW = 0.9; // 梁の半幅

  // 底: 全体は浅め。明るい水色の所は日の当たった底（日の当たらない底は暗い青緑）
  const BOTTOM = -0.6;
  k.basin(X(-30), Z(-70), X(60), Z(10), BOTTOM);
  k.basin(X(-1.0), Z(-1.0), X(1.0), Z(1.5), -0.3); // 目の下（立つ所）

  // 柱の森（目のまわりは無い）
  const has = (i: number, j: number): boolean => i >= -4 && i <= 6 && j >= -1 && j <= 6 && !(j === -1 && i <= 0) && !(j === 0 && i === -1);
  for (let j = -1; j <= 6; j++)
    for (let i = -4; i <= 6; i++) {
      if (!has(i, j)) continue;
      const cx = CX(i);
      const cz = CZ(j);
      // 水中の広い台座（段々）と、水面すれすれの台
      box(col, cx - 1.6, -2, cz - 1.6, cx + 1.6, -0.05, cz + 1.6, true);
      box(col, cx - 1.1, -0.05, cz - 1.1, cx + 1.1, 0.25, cz + 1.1, true);
      box(col, cx - 0.8, 0.25, cz - 0.8, cx + 0.8, 0.52, cz + 0.8, true);
      box(shaft, cx - HW, 0.52, cz - HW, cx + HW, CAP0, cz + HW, true);
      // 段々に広がる柱頭
      box(cap, cx - 0.85, CAP0, cz - 0.85, cx + 0.85, CAP1, cz + 0.85);
      box(cap, cx - 1.25, CAP1, cz - 1.25, cx + 1.25, BEAM0, cz + 1.25);
    }
  // 梁の格子（柱頭の上に載る）: 横（x 方向）は奥の列だけ、縦（z 方向）は柱の列ごとに手前まで
  for (let j = 0; j <= 6; j++) box(beam, CX(-4) - 1.25, BEAM0, CZ(j) - BW, CX(6) + 1.25, BEAMT, CZ(j) + BW);
  for (let i = -4; i <= 6; i++) box(beam, CX(i) - BW, BEAM0, CZ(6) - 1.25, CX(i) + BW, BEAMT, i <= 0 ? CZ(0) + 1.25 : 6);
  // 真ん中の柱の頭上の大きな塊（参考画像の手前の角 x 815・y 150〜205、左右の角 x 660 / 995・y 252 から求めた）
  box(cap, 5.07, BEAM0 - 0.05, -7.35, 8.44, 3.84, -4.71);
  // 頭上の手前の梁（真ん中の柱から手前へ。背が高い）
  box(beam, CX(0) - BW, BEAMT, CZ(0) - BW, CX(0) + BW, 5.0, 6);
  // 左手前の柱（参考画像の左端 x 0〜140。升目から外れた位置。右手前の角が x 140・奥行き 6 m）
  {
    const nr = CAM_B.hit(140, 408 + (CAM_B.f * 1.33) / 6.0, 'y', 0);
    box(colNL, nr[0] - 2 * HW, -2, nr[2] - 2 * HW, nr[0], BEAMT, nr[2], true);
    box(cap, nr[0] - 2 * HW - 0.35, 3.44, nr[2] - 2 * HW - 0.35, nr[0] + 0.6, BEAMT, nr[2] + 0.35);
  }
  // 天井の板（梁の上）。開口は参考画像の白い空の所（画素でなぞった形を板の下面の高さへ写す）
  {
    const y0 = BEAMT;
    const shape = new THREE.Shape([new THREE.Vector2(-30, 70), new THREE.Vector2(60, 70), new THREE.Vector2(60, -8), new THREE.Vector2(-30, -8)]);
    const polys: [number, number][][] = [
      [[-40, -60], [140, -60], [140, 30], [60, 55], [-40, 60]],
      [[170, -60], [570, -60], [560, 30], [420, 45], [170, 30]],
      [[590, -60], [960, -60], [950, 25], [800, 125], [600, 125]],
      [[1090, -60], [1290, -60], [1280, 45], [1100, 50]],
      [[1150, 185], [1400, 118], [1480, 110], [1480, 250], [1150, 250]],
      [[150, 140], [470, 160], [470, 240], [150, 240]],
    ];
    for (const poly of polys)
      shape.holes.push(new THREE.Path(poly.map(([px, py]) => {
        const h = CAM_B.hit(px, py, 'y', y0);
        return new THREE.Vector2(h[0], -h[2]);
      })));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    k.b.mesh(geo, ceilB, [X(0), y0, Z(0)], { shadow: 'receive' });
  }
  // 空（開口から見える明るい面。影は落とさない）
  k.b.boxMM(sky, [X(-60), 14, Z(-120)], [X(80), 14.2, Z(40)], { shadow: false });

  // 左奥の暗い青緑の奥まった壁と、奥の壁の暗い奥まり（柱の間に見える）
  box(recess, -16, -2, -21.5, 2.0, BEAM0, -20.5, true);
  box(recess, 9, -2, -41.5, 60, BEAM0, -40.5, true);
  box(recess, 45.5, -2, -40, 46.5, BEAM0, 8, true);

  // 手前の物は画面に正対させて置く: CAM_B の横（u, 右が正）と奥行き（d）。参考画像の画素から u = (x - 728) * d / f
  const ya = CAM_B.yaw;
  const o0: [number, number] = [0, 0];
  const uAt = (px: number, d: number): number => ((px - 728) * d) / CAM_B.f;
  const fbox = (mat: THREE.Material, px0: number, px1: number, d0: number, d1: number, y0: number, y1: number): V3[] =>
    rbox(mat, o0, ya, uAt(px0, d0), uAt(px1, d0), -d1, -d0, y0, y1);
  const lit: V3[][] = [];
  // 柱の前の白い段々の塊（日が当たる）: 手前の低い段（x 75〜330）・主な塊（x 75〜290）・左の高い塊（x 80〜140）
  lit.push(fbox(block, 75, 330, 4.5, 5.0, -2, 0.12));
  lit.push(fbox(block, 75, 290, 5.0, 5.67, -2, 0.43));
  lit.push(fbox(block, 80, 140, 5.0, 5.5, 0.43, 1.07));
  // 右手前（参考画像の右下）: 画面に正対する白い立方体の列・その右の白い床・奥の低い縁
  for (let n = 0; n < 5; n++) {
    const h = [0.2, 0.21, 0.19, 0.21, 0.2][n];
    // 水面から上だけ（水の中の部分は底の升目に書かない: 書くと回した箱の縁が水の中で階段状に見える）
    lit.push(fbox(block, 1100 + n * 63, 1161 + n * 63, 2.86, 3.1, 0, h));
  }
  // 白い床（升目の向き。手前の縁は z -0.6）と、その右奥の段・柱
  box(block, 3.0, -2, -0.6, 10, 0.1, 3, true);
  lit.push([[3.0, 0.1, -0.6], [10, 0.1, -0.6], [10, 0.1, 3], [3.0, 0.1, 3]]);
  box(block, 8.0, -2, -1.6, 10, 0.35, -0.6, true);
  lit.push([[8.0, 0.35, -1.6], [10, 0.35, -1.6], [10, 0.35, -0.6], [8.0, 0.35, -0.6]]);

  lit.push(fbox(block, 1300, 1390, 5.6, 6.2, -2, 0.12));
  // --- 日の差し込む所（見えない屋根の穴） ---
  const sun = new THREE.Vector3(...SUN_B);
  const up = (pts: V3[]): [number, number][] => pts.map((p) => towardSun(p, sun, GOBO_Y));
  // 水底の明るい所: 参考画像でなぞった形（画素）の視線を水面で屈折させて、底と交わる所
  const onBottom = (px: [number, number][]): V3[] =>
    px.map(([x, y]) => {
      const p = CAM_B.hit(x, y, 'y', 0);
      // 屈折（GLSL の refract と同じ式。法線は上向き）
      const I = CAM_B.ray(x, y);
      const eta = 1 / 1.333;
      const ni = I.y;
      const kk = 1 - eta * eta * (1 - ni * ni);
      const r = I.clone().multiplyScalar(eta).sub(new THREE.Vector3(0, eta * ni + Math.sqrt(Math.max(kk, 0)), 0));
      const t = BOTTOM / r.y;
      return [p[0] + r.x * t, BOTTOM, p[2] + r.z * t];
    });
  const rect = (x0: number, z0: number, x1: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const holes: [number, number][][] = [
    // 手前の真ん中の大きな明るい所
    up(onBottom([[600, 705], [752, 688], [880, 688], [912, 712], [1072, 728], [1120, 740], [1250, 750], [1300, 764], [1312, 792], [1290, 830], [270, 830], [440, 790], [464, 756], [544, 740], [576, 716]])),
    // 左の中ほど
    up(onBottom([[370, 522], [560, 520], [578, 560], [500, 582], [400, 584], [350, 566]])),
    // 右
    up(onBottom([[1050, 524], [1270, 522], [1270, 556], [1200, 568], [1100, 568], [1050, 548]])),
    up(onBottom([[1300, 536], [1385, 536], [1385, 556], [1300, 556]])),
    // 右奥と左奥の明るい浅い所
    up(onBottom([[-10, 466], [60, 466], [60, 545], [-10, 545]])),
    // 白い塊の上面
    ...lit.map((q) => up(q)),
    // 真ん中の柱の台座の手前の面
    up(rect(CX(0) - 1.6, CZ(0) + 1.1, CX(0) + 1.6, CZ(0) + 1.6, 0.25)),
  ];
  roofGobo(k.b, [X(-40), Z(-80), X(70), Z(20)], GOBO_Y, 0.125, holes.map((h) => h.map(([x, z]) => [X(x), Z(z)] as [number, number])));
}
