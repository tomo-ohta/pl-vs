import * as THREE from 'three';
import type { V3 } from '../Builder.ts';
import { gobo, roofGobo, T, towardSun, type Kit } from './kit.ts';
import { ViewCam } from './view.ts';

/**
 * 区域 C（pool-2）: 水面近くの低い目（水面から 1.6 m）で、升目に対して左へ約 30° 向いて見る。
 * 左手前の低い通路、その奥の一段高い通路（縁が右奥へ伸びる）と太い柱、柱の列、右の段々の大きな壁と階段、奥の暗いトンネル。
 * 天井は 4.2 m。光: 区域の上に見えない屋根（影だけ落とす）を置き、日の当たる所（参考画像で白い所）の上だけ穴を開ける。
 * 原点 (ox, oz) は目の真下の水面。
 */
export const CAM_C = new ViewCam([0, 1.6, 0], 0.53, -0.057, 56.4);
/** 日の光の進む向き（右の上から、少し手前へ） */
export const SUN_C: [number, number, number] = [-0.55, -0.75, 0.1];

export function buildZoneC(k: Kit, ox: number, oz: number): void {
  const m = k.b.ctx.mat;
  const tC = (grout: string, size = T) => ({ size, line: 0.012, color: grout, jitter: 0.02 });
  const walk = m({ name: 'c-walk', shadowQuant: false, color: '#fdfaef', hi: '#fffcf3', shade: '#c3d4c8', dark: '#8fb0a3', tiles: tC('#e0e0d2', 2 * T) });
  const deck = m({ name: 'c-deck', color: '#ebe8dc', hi: '#fdfbf1', shade: '#c3d4c8', dark: '#8fb0a3', tiles: tC('#d9dacb', 2 * T) });
  const col = m({ name: 'c-col', color: '#f8f5e8', hi: '#fefbf0', shade: '#a6bcab', dark: '#7d9d92', tiles: tC('#d8d9c9') });
  // 柱頭・梁・天井は常に陰の色（影は落とさない。光の形は見えない屋根で決める）
  const cap = m({ name: 'c-cap', color: '#9fbfac', hi: '#9fbfac', shade: '#93b8a7', dark: '#7fa898', tiles: tC('#87aa98', 2 * T) });
  // 天井の板の下面は明るい（水と床の照り返し）
  const ceil = m({ name: 'c-ceil', color: '#b5cfc0', hi: '#b5cfc0', shade: '#adc9ba', dark: '#a6c4b5', tiles: tC('#9bbaaa', 4 * T) });
  // 梁（柱の列をつなぐ）の下面は陰
  const beamC = m({ name: 'c-beam', color: '#a9c9bb', hi: '#a9c9bb', shade: '#a1c3b4', dark: '#9abeaf', tiles: tC('#90b2a3', 2 * T) });
  // 奥の柱の列（陰の青緑）
  const colFar = m({ name: 'c-colFar', color: '#f4f2e6', hi: '#fbf9ee', shade: '#72aaa8', dark: '#5f9496', tiles: tC('#cfd6c8') });
  // 右上の暗い梁の下面（照明なし）
  const ceilDark = m({ name: 'c-ceilDark', color: '#3e7a77', unlit: true, tiles: { size: 2 * T, line: 0.015, color: '#36706d' } });
  // 天窓の右の奥に見える明るい壁（照明なし）
  const litWall = m({ name: 'c-litWall', color: '#c6d9ce', unlit: true, tiles: { size: 2 * T, line: 0.02, color: '#a9c1b3' } });
  const wall = m({ name: 'c-wall', color: '#eef2e6', hi: '#f8f8ef', shade: '#6aa096', dark: '#3f7877', tiles: tC('#c9d6cb') });
  const wallDeep = m({ name: 'c-wallDeep', color: '#e3ebe0', hi: '#f5f5f0', shade: '#5a8d89', dark: '#456b74', tiles: tC('#c3d1c6') });
  // 奥の暗い所（照明なし。左ほど少し明るい）
  const farDark = m({ name: 'c-farDark', color: '#2a6274', unlit: true, noFog: true, tiles: { size: T, line: 0.01, color: '#255c6d' } });
  const dark = m({ name: 'c-dark', color: '#0f4a5c', unlit: true, noFog: true });
  const recess = m({ name: 'c-recess', color: '#4d7a80', unlit: true, tiles: { size: T, line: 0.01, color: '#46727a' } });
  const sky = m({ name: 'c-sky', color: '#fdfbf0', unlit: true, noFog: true, line: 0 });

  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  const box = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, collide = false, shadow: boolean | 'receive' = 'receive'): void => {
    const sh = mat === cap || mat === ceil || mat === beamC ? 'receive' : shadow;
    k.box(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { collide, shadow: sh });
  };
  const CEIL = 4.2;

  // 底: 全体は深め。通路の前は明るい浅い所（縁は波打つ）
  k.basin(X(-30), Z(-45), X(20), Z(10), -1.1);
  k.basin(X(-1.5), Z(-30), X(20), Z(-1.6), -2.6);
  // 通路の前の明るい浅い所（右の縁は参考画像の明るい所の縁を屈折させて底へ写した値: x ≈ -1.4〜-2.0）
  // 縁の折れ線（z, x）: 参考画像の明るい水色の縁を屈折させて底へ写した点
  const SH: [number, number][] = [[-1.75, -1.55], [-2.9, -1.5], [-3.8, -1.5], [-5.1, -1.9], [-5.6, -2.6]];
  const shX = (z: number): number => {
    for (let i = 0; i < SH.length - 1; i++) if (z <= SH[i][0] && z >= SH[i + 1][0]) return SH[i][1] + ((z - SH[i][0]) / (SH[i + 1][0] - SH[i][0])) * (SH[i + 1][1] - SH[i][1]);
    return SH[SH.length - 1][1];
  };
  for (let z = -1.75; z > -5.6; z -= T) {
    const w = Math.sin(z * 2.3) * 0.12 + Math.sin(z * 5.1 + 1.0) * 0.08;
    k.shelf(X(-4.75), Z(z - T), X(Math.round((shX(z) + w) / T) * T), Z(z), -0.28);
  }
  k.shelf(X(-1.75), Z(-1.75), X(2.0), Z(3.0), -0.2);

  // 左手前の低い通路（目の左下）
  k.deck(deck, X(-14), Z(-1.67), X(-1.75), Z(8), 0.15);
  // 一段高い通路（縁は x = -3.4 で奥へ伸び、その先は細くなる）
  // 一段高い通路（参考画像の縁: 手前は x -3.3、z -3.8 で段になって奥は x -4.5）
  // 縁は参考画像の通路の縁（画素）から求めた折れ線: 手前は x -3.3 で奥へ、z -3.6 で斜めに左奥へ折れ、その先は x -4.75 で奥へ
  const WALK: [number, number][] = [[-6.4, -1.67], [-3.3, -1.67], [-3.2, -3.6], [-4.75, -5.6], [-4.75, -12.0], [-6.4, -12.0]];
  {
    const shape = new THREE.Shape(WALK.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 2.36, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    k.b.mesh(g, walk, [X(0), -2, Z(0)], { shadow: true });
    // 底の升目（水面より上 = 50）と当たり判定（升目ごとの細長い箱）
    const c = k.hf.cell;
    for (let z = -12.0; z < -1.67; z += c) {
      const zc = z + c / 2;
      // この奥行きでの縁の x（折れ線を補間）
      let xe = -6.4;
      for (let i = 1; i < WALK.length - 1; i++) {
        const [xa, za] = WALK[i];
        const [xb, zb] = WALK[i + 1];
        if ((zc <= za && zc >= zb) || (zc >= za && zc <= zb)) xe = Math.max(xe, xa + ((zc - za) / (zb - za)) * (xb - xa));
      }
      k.hf.rect(X(-6.4), Z(z), X(xe), Z(z + c), 50, 'max');
      k.b.ctx.colliders.add({ x: X(-6.4), y: -2, z: Z(z) }, { x: X(xe), y: 0.36, z: Z(z + c) });
    }
  }
  // 左の壁（暗い開口）と、明るい柱型
  box(wallDeep, -14.0, -2, -30, -13.0, CEIL, 4, true);
  box(col, -13.0, -2, -7.0, -12.3, CEIL, -5.6, true, true);
  box(recess, -12.98, -2, -5.4, -12.9, 3.2, 2.0);

  // 太い柱と段々の柱頭（影を落とす）
  box(col, -5.6, 0.36, -3.8, -4.4, 3.0, -2.8, true, true);
  box(cap, -5.85, 3.0, -4.05, -4.15, 3.4, -2.55, false, true);
  box(cap, -6.1, 3.4, -4.3, -3.9, CEIL, -2.3, false, true);
  // 柱の列: 通路の先（x -3.3）と、左の奥（x -9.0・-14.5）。参考画像の柱の根元の位置から（例: x 800〜875・y 470 → (-3.4, -8.4)）
  const rowA = [-8.4, -12.7, -17.0, -21.3, -25.6];
  const pier = (xc: number, zc: number, hw: number): void => {
    // 台座は水面すれすれ（参考画像では柱は水から直接立つ）
    box(colFar, xc - hw - 0.25, -2, zc - hw - 0.25, xc + hw + 0.25, 0.05, zc + hw + 0.25, true, true);
    box(colFar, xc - hw, 0.05, zc - hw, xc + hw, 3.0, zc + hw, true, true);
    box(cap, xc - hw - 0.25, 3.0, zc - hw - 0.25, xc + hw + 0.25, 3.4, zc + hw + 0.25);
    box(cap, xc - hw - 0.5, 3.4, zc - hw - 0.5, xc + hw + 0.5, CEIL, zc + hw + 0.5);
  };
  // 通路の先の柱は 2 本だけ（参考画像の柱の根元 x 800〜875 と x 900〜960）。その奥は暗い所が見える
  pier(-3.3, -8.4, 0.4);
  pier(-5.3, -22.3, 0.45);


  for (const zc of [-11.0, -16.0, -21.0, -26.0]) pier(-9.0, zc, 0.45);
  for (const zc of [-15.6, -21.6, -27.6]) pier(-14.5, zc, 0.45);
  // 梁（柱の列をつなぐ）
  box(beamC, -3.7, 3.5, -30, -2.9, CEIL, -12.0);
  box(beamC, -9.4, 3.5, -30, -8.6, CEIL, -8.0);
  for (const zc of rowA.slice(1)) box(beamC, -20, 3.5, zc - 0.4, 1.0, CEIL, zc + 0.4);

  // 天井の板（天窓: 参考画像の白い四角をなぞって板の高さへ写す）
  const sk = [CAM_C.hit(712, 72, 'y', CEIL), CAM_C.hit(900, -12, 'y', CEIL), CAM_C.hit(885, 162, 'y', CEIL), CAM_C.hit(840, 162, 'y', CEIL), CAM_C.hit(760, 110, 'y', CEIL)];
  const outer = new THREE.Shape([new THREE.Vector2(-20, -8), new THREE.Vector2(6, -8), new THREE.Vector2(6, 40), new THREE.Vector2(-20, 40)]);
  outer.holes.push(new THREE.Path(sk.map((p) => new THREE.Vector2(p[0], -p[2]))));
  // 天窓の右の開口（奥に明るい壁が見える）
  const sk2 = [CAM_C.hit(905, -40, 'y', CEIL), CAM_C.hit(1185, -40, 'y', CEIL), CAM_C.hit(1185, 115, 'y', CEIL), CAM_C.hit(905, 115, 'y', CEIL)];
  outer.holes.push(new THREE.Path(sk2.map((p) => new THREE.Vector2(p[0], -p[2])).reverse()));
  const slabGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2);
  k.b.mesh(slabGeo, ceil, [X(0), CEIL, Z(0)], { shadow: 'receive' });
  k.b.boxMM(sky, [X(-30), 9, Z(-50)], [X(20), 9.2, Z(10)], { shadow: false });
  box(litWall, -2.9, CEIL + 0.4, -14.5, 2, 8.9, -14.0, false, false);
  box(ceilDark, 0.4, 3.8, -10.5, 3.5, CEIL - 0.01, -6.2, false, false);

  // 右の段々の塊（参考画像の右下の手前の塊 x 1200〜1330・y 430〜550）と、上の大きな張り出し
  box(wall, 0.3, -2, -9.0, 8, 0.95, -7.3, true);
  box(wall, 1.0, 0.95, -9.0, 8, 1.25, -8.25, true);
  box(wallDeep, 1.4, -2, -12.0, 8, 1.6, -9.0, true);
  box(wallDeep, 1.0, 2.9, -12.0, 8, CEIL, -7.3, true);
  k.greeble(wallDeep, null, [X(1.0), 2.9, Z(-12.0)], [X(1.6), CEIL, Z(-7.3)], 6, { faces: ['-x', 'z'], size: [0.25, 0.75], out: 0.25 });
  // 右の階段（暗いトンネルの右から右上へ上る。参考画像の (1190, 400)〜(1320, 280) を z -22 の面へ写した値）
  for (let i = 0; i < 9; i++) box(wallDeep, 0.35 + i * 0.28, -2, -24, 8, 0.73 + (i + 1) * 0.32, -21.5, true);
  // 階段と手前の塊の間の壁（奥まった陰）
  box(wallDeep, 3.2, -2, -21.5, 8, CEIL, -12.0, true);
  // 奥の壁と暗いトンネル
  // 奥の壁: 左は明るい壁（外の光の開口）、x -8 から右は奥まった暗い所（参考画像の幅の広い暗い帯 x 890〜1225）
  box(wallDeep, -16, -2, -25.5, -8.0, CEIL, -24.0, true);
  for (const [x0, x1] of [[-12.5, -11.5], [-10.5, -9.0]] as [number, number][]) box(sky, x0, 0.3, -24.02, x1, 3.2, -23.98);
  box(farDark, -8.0, -2, -26.5, -3.2, 3.6, -26.0, true);
  box(wallDeep, -8.0, 3.6, -26.5, -3.2, CEIL, -24.0);
  box(wallDeep, -3.2, 3.4, -25.5, 1.6, CEIL, -24.0);
  box(dark, -3.2, -2, -32, 0.8, 3.4, -31.5);
  box(dark, -3.7, -2, -32, -3.2, 3.4, -25.5);
  box(dark, 0.8, -2, -32, 1.3, 3.4, -25.5);
  box(dark, -3.7, 3.4, -32, 1.3, 3.9, -25.5);

  // --- 日の差し込む所（見えない屋根の穴）: 日の当たる面の多角形を日の来る方へ屋根の高さまでたどる ---
  const sun = new THREE.Vector3(...SUN_C);
  const RY = 9.5;
  const up = (pts: V3[]): [number, number][] => pts.map((p) => towardSun(p, sun, RY));
  const rect = (x0: number, z0: number, x1: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const onX = (xf: number, px: [number, number][]): V3[] => px.map(([x, y]) => CAM_C.hit(x, y, 'x', xf));
  const holes: [number, number][][] = [
    // 手前の低い通路・一段高い通路・奥の細い通路
    up(rect(-14, -1.7, -1.7, 8, 0.15)),
    // （柱の左の通路は柱と柱頭の陰）
    up(WALK.map(([x, z]) => [Math.max(x, z > -3.8 ? -5.0 : -5.6), 0.36, z] as V3)),
    // 通路の縁の正面（水面から上面まで）
    ...[1, 2].map((i) => {
      const [xa, za] = WALK[i];
      const [xb, zb] = WALK[i + 1];
      return up([[xa, 0.36, za], [xb, 0.36, zb], [xb + 0.15, -0.05, zb], [xa + 0.15, -0.05, za]]);
    }),
    // 通路の前の浅い所の底
    up([[-4.75, -0.28, -1.6], ...SH.map(([z, x]) => [x + 0.3, -0.28, z] as V3), [-4.75, -0.28, -5.6]]),
    // 奥の低い台
    // 太い柱の右の面の下（斜めの境目の右下）
    up(onX(-4.4, [[345, 452], [452, 298], [452, 525], [345, 548]])),
    // 左の明るい柱型の正面
    up([[-12.3, 0.2, -7.0], [-12.3, 0.2, -5.6], [-12.3, 3.0, -5.6], [-12.3, 3.0, -7.0]]),
  ];
  // 屋根の穴を左右に少し広げる（升目の丸めで細い所が消えないように）
  const holesW = holes.map((h) => {
    const cx = h.reduce((s, p) => s + p[0], 0) / h.length;
    const cz = h.reduce((s, p) => s + p[1], 0) / h.length;
    return h.map(([x, z]) => [x + Math.sign(x - cx) * 0.05, z + Math.sign(z - cz) * 0.05] as [number, number]);
  });
  roofGobo(k.b, [X(-40), Z(-60), X(30), Z(20)], RY, 0.125, holesW.map((h) => h.map(([x, z]) => [X(x), Z(z)] as [number, number])));
  // 太い柱の右の面の上（斜めの境目の左上）は陰
  const W = (p: V3): V3 => [X(p[0]), p[1], Z(p[2])];
  gobo(k.b, onX(-4.4, [[340, 455], [455, 296], [455, 60], [340, 60]]).map(W), sun, 0.3);
}
