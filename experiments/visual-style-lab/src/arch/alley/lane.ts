import * as THREE from 'three';
import { paint } from './paint.ts';
import { makeCoverage, type PaintOptions } from '../../render/PaintMaterial.ts';
import { createLeafMaterial, leafCluster, makeLeafTexture } from '../../scenes/alley/foliage.ts';
import { addGroundSun, sunLayer as computedSun } from './sun.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import { CABINETS, EAST, LANE, LN, LK, PLANTER, roofAt, WEST, westX } from './layout.ts';

/**
 * 通路（路面・歩道の敷石・白線・排水の蓋）と、通路に沿った物（花壇・分電盤・植え込み・配管・室外機・屋上の柱）。
 * 見た目は元の版（scenes/alley.ts）と同じ色・同じ置き方。路面は通路の全長（中庭から倉庫の前まで）に広げた。
 */

export const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);

export interface LaneMats {
  pole: THREE.ShaderMaterial;
  acu: THREE.ShaderMaterial;
  pipe: THREE.ShaderMaterial;
}

export function buildLane(b: Builder): LaneMats {
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): THREE.Mesh => b.boxMM(m, min, max, { collide, shadow: false });
  const r = rng(3);

  // ---------- 路面 ----------
  const covRect: [number, number, number, number] = [-3, 18, 3, -40];
  const cov = makeCoverage(covRect, 16, [
    // 日の差し込み（右の歩道。木の葉の影でちぎれる）
    { ch: 0, seg: [1.15, -8.3, 1.15, -9.9], w: 0.5, soft: 0.12 },
    { ch: 0, seg: [1.38, -4.7, 1.38, -5.45], w: 0.22, soft: 0.12 },
    { ch: 0, seg: [1.45, -14.6, 1.45, -15.5], w: 0.18, soft: 0.1 },
    { ch: 0, seg: [1.5, -29.5, 2.4, -29.5], w: 0.5, soft: 0.2 },
    // 中庭の口（南）: 渡り廊下の屋根の隙間からの日
    { ch: 0, seg: [1.3, 13.5, 1.3, 16.5], w: 0.35, soft: 0.25 },
  ]);
  // 通路の口の方（z > -1。参考画像の視点の後ろ）は光線で調べた日なたを足す（中庭と同じ日）
  addGroundSun(cov, covRect, 0, -1);
  const sunLayer = { color: '#3b7378', scale: 3.0, threshold: 1.0, cov: 0.6, stretch: [1, 1] as [number, number], detail: 0.6, only: 'floor' as const, seed: 1 };
  // アスファルト（通路の全長）。通路の口の方だけ日なた
  const aRect: [number, number, number, number] = [-12, 18.5, 3, -40];
  const aCov = makeCoverage(aRect, 4, []);
  addGroundSun(aCov, aRect, 0, -1);
  const asphalt = P({ color: '#0e222b', cov: { texture: aCov, rect: aRect }, layers: [computedSun('#27535c', 21)] });
  box(asphalt, [LANE.asphaltW, -0.2, LANE.z0], [LANE.walkX[0], 0, LANE.z1], true);
  // 西の路肩（車路の西の端から西棟の植え込みまで。北ほど狭い）: 路面と同じアスファルト、斜めの壁ぞいは細かく切る
  for (let z = LANE.z0; z > -33.6; z -= 1) {
    const x0 = westX(Math.min(z, z - 1)) + 0.02;
    if (x0 >= LANE.asphaltW) continue;
    box(asphalt, [x0, -0.2, z], [LANE.asphaltW, 0, z - 1], true);
  }
  // 北の端（倉庫の前・西の抜け道）
  box(asphalt, [-1.2, -0.2, -33.4], [LANE.asphaltW + 0.01, 0, LANE.z1], true);
  // 東の歩道（敷石の升目。日なただけ目地が見える）
  const walk = P({
    color: '#0f2530',
    cov: { texture: cov, rect: covRect },
    layers: [sunLayer],
    grid: { layer: 0, size: [0.62, 0.62], width: 0.035, color: '#1f474e' },
  });
  box(walk, [LANE.walkX[0], 0, LANE.z0], [LANE.walkX[1], 0.005, -34.95], true);
  // 縁石（車路と歩道の間）
  box(P({ color: { py: '#163039', nx: '#10262e', side: '#10262e' } }), [LANE.walkX[0] - 0.06, 0, LANE.z0], [LANE.walkX[0] + 0.02, 0.012, -34.95]);
  // 白線（車路の西の線は薄い。歩道の中に白い線）
  const lineMat = P({ color: '#132a34' });
  box(lineMat, [LANE.edgeLine[0], 0, LANE.z0 - 0.5], [LANE.edgeLine[1], 0.012, -33.4]);
  const walkLine = P({ color: '#10262f', cov: { texture: cov, rect: covRect }, layers: [{ ...sunLayer, color: '#a6d6d0' }] });
  box(walkLine, [LANE.walkLine[0], 0.005, LANE.z0], [LANE.walkLine[1], 0.008, -34.9]);
  // 排水の蓋（通路に沿って 6 m おき）
  const lid = P({ color: '#1d3a44' });
  box(lid, [-1.45, 0, -5.12], [-1.15, 0.012, -5.3]);
  box(lid, [-1.1, 0, -4.96], [-0.82, 0.012, -5.1]);
  for (let z = 7; z > -32; z -= 6.2) {
    if (z < 0 && z > -8) continue;
    box(lid, [-1.42, 0, z], [-1.12, 0.012, z - 0.18]);
  }
  // 側溝（歩道の際。細い格子の蓋）
  box(P({ color: '#0c1d24' }), [LANE.walkX[0] - 0.3, 0, LANE.z0], [LANE.walkX[0] - 0.08, 0.004, -34.9]);

  // ---------- 東棟の壁ぞい: 花壇（低い台）と分電盤 ----------
  const plinth = P({ color: { nx: '#0f272f', py: '#163039', pz: '#122c35', nz: '#0e2129' }, fog: 0.6 });
  box(plinth, [PLANTER.x[0], 0, PLANTER.z[0]], [PLANTER.x[1], PLANTER.h, PLANTER.z[1]], true);
  box(P({ color: '#2f5c62', fog: 0.6 }), [2.04, 0.83, -4.6], [2.07, 0.86, -7.0]);
  // 花壇の土
  box(P({ color: '#0a1a1f' }), [PLANTER.x[0] + 0.06, PLANTER.h, PLANTER.z[0] + 0.06], [PLANTER.x[1], PLANTER.h + 0.01, PLANTER.z[1] - 0.06]);
  // 南の方の花壇（通路の口まで、同じ高さ）
  box(plinth, [PLANTER.x[0], 0, 9.5], [PLANTER.x[1], PLANTER.h, 1.0], true);
  const cab = P({ color: { nx: '#122c35', pz: '#15313a', py: '#24505a', nz: '#0e2129' }, fog: 0.5 });
  const tag = P({ color: '#a8812f' });
  for (const [x0, z0, z1, h] of CABINETS) {
    box(cab, [x0, 0, z0], [2.05, h, z1], true);
    box(tag, [x0 - 0.005, h * 0.55, z0 - 0.06], [x0, h * 0.55 + 0.16, z0 - 0.13]);
    // 扉の合わせ目と取っ手
    box(P({ color: '#0d2229' }), [x0 - 0.004, 0.06, (z0 + z1) / 2 - 0.005], [x0, h - 0.06, (z0 + z1) / 2 + 0.005]);
    box(P({ color: '#2a525a' }), [x0 - 0.02, h * 0.45, (z0 + z1) / 2 + 0.05], [x0, h * 0.45 + 0.1, (z0 + z1) / 2 + 0.07]);
  }
  // 分電盤からの配線の管（壁へ）
  box(P({ color: '#10262e' }), [2.05, 0.4, -5.1], [2.5, 0.46, -5.16]);

  // ---------- 植え込み ----------
  const midBush = createLeafMaterial(makeLeafTexture(37, { clumps: 34, leaf: 7, litSide: 0.9, fill: 1.6 }), '#0a1d24', '#10272e', 1, { fog: 0.3, cardEdge: 0.5 });
  (midBush.uniforms.uMap.value as THREE.Texture).wrapS = (midBush.uniforms.uMap.value as THREE.Texture).wrapT = THREE.RepeatWrapping;
  b.mesh(leafCluster([1.85, 0.55, -8.8], [1.0, 1.2, 4.4], 12, 43, Math.PI / 2, 1.2), midBush, [0, 0, 0], { shadow: false });
  b.mesh(leafCluster([2.15, 1.05, -13.6], [0.8, 0.6, 3.6], 8, 44, Math.PI / 2, 1.2), midBush, [0, 0, 0], { shadow: false });
  const nearBush = createLeafMaterial(makeLeafTexture(31, { clumps: 34, leaf: 7, litSide: 0.8, fill: 1.6 }), '#0a1c22', '#122a31', 1, { fog: 0, cardEdge: 0.5 });
  (nearBush.uniforms.uMap.value as THREE.Texture).wrapS = (nearBush.uniforms.uMap.value as THREE.Texture).wrapT = THREE.RepeatWrapping;
  b.mesh(leafCluster([2.1, 0.5, -3.6], [1.0, 1.1, 1.2], 10, 41, Math.PI / 2, 1.2), nearBush, [0, 0, 0], { shadow: false });
  b.mesh(leafCluster([2.0, 0.5, -2.3], [1.2, 1.1, 1.4], 8, 42, 0.3, 1.2), nearBush, [0, 0, 0], { shadow: false });
  box(P({ color: '#0a1c22' }), [2.3, 0, -1.5], [2.5, 0.75, -4.4]);
  // 南の花壇の植え込み（振り返った所）
  for (let z = 8.8; z > 1.5; z -= 1.6) b.mesh(leafCluster([2.2, 1.15, z], [0.7, 0.7, 1.5], 5, 140 + z * 3, Math.PI / 2, 1.2), nearBush, [0, 0, 0], { shadow: false });

  const bushTex = makeLeafTexture(21, { clumps: 30, leaf: 6, litSide: 0.7, fill: 1.4 });
  bushTex.wrapS = bushTex.wrapT = THREE.RepeatWrapping;
  const bushMat = createLeafMaterial(bushTex, '#081a1e', '#10272c', 1, { cardEdge: 0.5 });
  // 左の手前の植え込み（画面の左下を覆う）
  b.mesh(leafCluster([-2.6, 0.38, -4.4], [2.6, 0.78, 1.0], 12, 77, 0, 1.3), bushMat, [0, 0, 0], { shadow: false });
  b.mesh(leafCluster([-4.6, 0.36, -5.2], [2.8, 0.75, 1.2], 12, 78, 0.3, 1.3), bushMat, [0, 0, 0], { shadow: false });
  b.mesh(leafCluster([-6.2, 0.3, -6.4], [2.4, 0.65, 1.4], 8, 79, 0.5, 1.3), bushMat, [0, 0, 0], { shadow: false });
  // 植え込みの縁石と土（手前の三角の植え込み: 植え込みの列から駐輪場の手前まで）
  const bed = P({ color: { py: '#0b1c21', side: '#0f2329' } });
  for (let z = -4.0; z < 1.0; z += 1) box(bed, [westX(z) + 0.35, 0, z + 1], [LANE.asphaltW - 0.1, 0.12, z], true);
  box(P({ color: { py: '#1a3640', side: '#132a32' } }), [LANE.asphaltW - 0.12, 0, 1.0], [LANE.asphaltW, 0.16, -4.0]);
  for (let z = -3.5; z < 0.8; z += 1.4) {
    const xm = (westX(z) + LANE.asphaltW) / 2;
    b.mesh(leafCluster([xm, 0.45, z], [Math.max(1.5, LANE.asphaltW - westX(z) - 1.4), 0.8, 1.3], 8, 150 + z * 7, 0.2, 1.3), bushMat, [0, 0, 0], { shadow: false });
  }
  // 西棟の壁の足元の生け垣
  for (let d = 6.5; d < 31; d += 1.3) {
    const x = WEST.origin[0] + LK * d + 0.45;
    const h = 0.16 + r() * 0.08;
    b.mesh(leafCluster([x, h * 0.45, -d], [1.8, h * 1.1, 0.8], 3, 100 + d * 10, Math.PI / 2 - Math.atan(LK)), bushMat, [0, 0, 0], { shadow: false });
  }

  // ---------- 東棟の壁: 配管・室外機・屋上の柱 ----------
  const pole = P({ color: '#2d5257', fog: 0.5 });
  const pipe = P({ color: { nx: '#4f8984', px: '#4f8984', pz: '#3f7774', nz: '#3f7774' }, fog: 0.5 });
  const rH = (z: number): number => roofAt(EAST, -z) - 0.9;
  for (const [z, y0] of [
    [-31.5, 4],
    [-27.6, 6],
    [-24.0, 7],
  ] as const) {
    box(pipe, [2.36, y0, z - 0.05], [2.46, rH(z) + 0.3, z + 0.05]);
    // 管の受け金物
    for (let y = y0 + 0.8; y < rH(z); y += 1.6) box(pipe, [2.33, y, z - 0.08], [2.5, y + 0.04, z + 0.08]);
  }
  // 暗い所の配管（雨どい: 屋上から路面の排水へ）
  const dpipe = P({ color: { nx: '#14303a', side: '#10272f' }, fog: 0.6 });
  for (const z of [-9.1]) {
    box(dpipe, [2.34, 0, z - 0.05], [2.44, rH(z) + 0.4, z + 0.05]);
    box(dpipe, [2.2, 0, z - 0.08], [2.46, 0.12, z + 0.08]);
  }
  const acu = P({ color: { nx: '#5d9890', pz: '#4f8984', py: '#6aa49a', ny: '#3a6c6c', nz: '#3f7774' }, fog: 0.5 });
  for (const [z, y, x0] of [
    [-20.2, 11.65, 1.75],
    [-26.0, 11.85, 1.85],
    [-28.6, 8.3, 1.9],
  ] as const) {
    box(acu, [x0, y, z + 0.45], [2.5, y + 0.6, z - 0.45]);
    // 架台と冷媒管
    box(pole, [x0 + 0.05, y - 0.05, z + 0.4], [2.5, y, z + 0.36]);
    box(pole, [x0 + 0.05, y - 0.05, z - 0.36], [2.5, y, z - 0.4]);
    box(pipe, [2.4, y - 1.5, z - 0.32], [2.46, y + 0.2, z - 0.26]);
  }
  // 屋上の柱（右の屋根の線の上）
  for (const z of [-25.5, -29, -32.5]) {
    const H0 = rH(z) + 0.9;
    box(pole, [2.4, H0 - 0.3, z - 0.03], [2.46, H0 + 2.2, z + 0.03]);
    box(pole, [2.4, H0 + 1.6, z - 0.35], [2.46, H0 + 1.64, z + 0.35]);
  }

  // ---------- 西棟の屋上の柱・アンテナ・室外機（明るい建物を背に細いシルエット） ----------
  const lH = (d: number): number => roofAt(WEST, d * LN);
  for (const [d, h] of [
    [20, 3.2],
    [23.5, 2.6],
    [26.5, 3.4],
    [29.5, 2.4],
    [32.5, 2.8],
  ] as const) {
    const x = WEST.origin[0] + LK * d + 0.25;
    const H0 = lH(d) - 0.1;
    box(pole, [x - 0.04, H0 - 0.5, -d - 0.04], [x + 0.04, H0 + h, -d + 0.04]);
    box(pole, [x - 0.04, H0 + h * 0.7, -d - 0.45], [x + 0.04, H0 + h * 0.7 + 0.05, -d + 0.45]);
    box(pole, [x - 0.04, H0 + h * 0.4, -d - 0.3], [x + 0.04, H0 + h * 0.4 + 0.05, -d + 0.3]);
  }
  for (const [d, y] of [
    [26, 7.6],
    [30, 9.0],
  ] as const) {
    const x = WEST.origin[0] + LK * d;
    box(acu, [x, y, -d], [x + 0.55, y + 0.6, -d - 0.8]);
    box(pole, [x, y - 0.05, -d - 0.05], [x + 0.6, y, -d - 0.1]);
    box(pole, [x, y - 0.05, -d - 0.7], [x + 0.6, y, -d - 0.75]);
  }
  // ---------- 参考画像の画角の外（目の後ろ・中庭の口）の壁の設備: 雨どい・室外機・換気口 ----------
  // 東棟（x = 2.5 の壁。z > -2.5 は画角の外）
  const dpipe2 = P({ color: { nx: '#14303a', side: '#10272f', py: '#1a3a42' }, fog: 0.6 });
  for (const z of [0.4, 9.4]) {
    box(dpipe2, [2.34, 0, z - 0.05], [2.44, roofAt(EAST, -z) - 0.5, z + 0.05]);
    box(dpipe2, [2.2, 0, z - 0.08], [2.46, 0.12, z + 0.08]);
    for (let y = 1.2; y < roofAt(EAST, -z) - 1; y += 2.2) box(dpipe2, [2.32, y, z - 0.07], [2.5, y + 0.04, z + 0.07]);
  }
  const acuDark = P({ color: { nx: '#2c5254', px: '#2c5254', pz: '#264a4c', nz: '#264a4c', py: '#33595b', ny: '#1d3c3f' }, fog: 0.7 });
  for (const [z, y] of [
    [4.2, 6.75],
    [13.0, 10.2],
    [7.6, 13.6],
  ] as const) {
    box(acuDark, [1.85, y, z - 0.42], [2.5, y + 0.6, z + 0.42]);
    box(pole, [1.9, y - 0.05, z - 0.4], [2.5, y, z - 0.36]);
    box(pole, [1.9, y - 0.05, z + 0.36], [2.5, y, z + 0.4]);
    box(pipe, [2.4, y - 1.2, z + 0.26], [2.46, y + 0.25, z + 0.32]);
  }
  // 西棟（u < 6 は画角の外）
  const lx = (d: number): number => WEST.origin[0] + LK * d;
  for (const d of [-2.0, -12.5]) {
    const x = lx(d);
    box(dpipe2, [x + 0.04, 0, -d - 0.05], [x + 0.14, roofAt(WEST, d * LN) - 0.5, -d + 0.05]);
    box(dpipe2, [x, 0, -d - 0.08], [x + 0.3, 0.12, -d + 0.08]);
  }
  for (const [d, y] of [
    [-6.0, 8.0],
    [-9.4, 12.2],
    [2.6, 16.4],
  ] as const) {
    const x = lx(d);
    box(acuDark, [x, y, -d - 0.42], [x + 0.6, y + 0.6, -d + 0.42]);
    box(pole, [x, y - 0.05, -d - 0.4], [x + 0.62, y, -d - 0.36]);
    box(pole, [x, y - 0.05, -d + 0.36], [x + 0.62, y, -d + 0.4]);
  }
  return { pole, acu, pipe };
}
