import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { BoxBatch, underside } from './canopy.ts';
import { FrameBuilder, frameMatrix } from './frame.ts';
import { twinSeat } from './furniture.ts';
import type { Tube } from './glow.ts';
import { haunch, hColumn, pipe, strut } from './kit.ts';
import { D, D_OLD } from './layout.ts';
import type { Mats } from './mats.ts';

/** 元の版の D の範囲（回す前の座標。x = 先端からの長さ、z = 横）。上屋は先端から ROOF_LEN m */
const OLD = { xEnd: D_OLD.xEnd, zc: D_OLD.zc, half: D.half, soffit: D.soffit };
export const D_ROOF_LEN = 41;

/**
 * D（駅舎側の単式ホーム）の上屋・柱・照明・ベンチ。元の版（長手が X、西端が先端）の作り方をそのまま使い、
 * 最後に南北へ回して置く（station-0 の見え方は元の版と同じ）。
 * 回す前の座標: x = xEnd + s（s = 先端（南端）からの長さ）、z = zc + w（w > 0 が回した後の東 = 駅舎の側、w < 0 が西 = 0 番線の側）
 */
export function buildD(ctx: SceneContext, root: THREE.Object3D, mat: Mats, tubes: Tube[]): { dark: BoxBatch; lite: BoxBatch } {
  // 元の版の先端（西端）を D の南端へ。元の -X（先端の向き）→ +Z（南）
  const T = frameMatrix(OLD.xEnd, OLD.zc, D.x, D.z1, Math.PI / 2);
  const fb = new FrameBuilder(ctx, T);
  const b = fb.b;
  const dark = new BoxBatch();
  const lite = new BoxBatch();
  const localTubes: Tube[] = [];
  const addTube = (c: V3, len: number, along: 'x' | 'z', w: number, h = 0.04, round = false): void => {
    if (round) {
      const g = new THREE.CapsuleGeometry(w / 2, Math.max(len - w, 0.01), 4, 10);
      if (along === 'x') g.rotateZ(Math.PI / 2);
      else g.rotateX(Math.PI / 2);
      b.mesh(g, mat.tube, c, { shadow: false });
    } else b.box(mat.tube, c, along === 'x' ? [len, h, w] : [w, h, len], { shadow: false });
    localTubes.push({ c, axis: along === 'x' ? [1, 0, 0] : [0, 0, 1], len });
  };

  const H = OLD.soffit;
  const xe = OLD.xEnd + 0.5;
  const xr = OLD.xEnd + D_ROOF_LEN;
  const zc = OLD.zc;
  b.boxMM(mat.roof, [xe, H, zc - OLD.half + 0.2], [xr, H + 0.25, zc + OLD.half - 0.2]);
  // 先端の梁
  b.boxMM(mat.frontD, [xe, 3.43, zc - OLD.half + 0.2], [xe + 0.4, H + 0.25, zc + OLD.half - 0.2]);
  // 長手の梁（蛍光灯を吊る・柱の列）と横の小梁
  for (const z of [-1.38, 1.2]) b.boxMM(mat.beam, [xe, 3.5, zc + z - 0.1], [xr, H, zc + z + 0.1]);
  for (const z of [-2.2, 2.2]) b.boxMM(mat.beam, [xe, 3.55, zc + z - 0.12], [xr, H, zc + z + 0.12]);
  // 柱の列の上の深い梁（下端 3.15）
  for (const z of [-4.6, 4.6]) b.boxMM(mat.beam, [xe, 3.15, zc + z - 0.14], [xr, H, zc + z + 0.14]);
  for (let x = xe + 6; x < xr; x += 6) b.boxMM(mat.beam, [x - 0.1, H - 0.25, zc - OLD.half + 0.3], [x + 0.1, H, zc + OLD.half - 0.3]);
  // 北の端の鼻先（回した後の北端）
  b.boxMM(mat.frontD, [xr - 0.4, 3.43, zc - OLD.half + 0.2], [xr, H + 0.25, zc + OLD.half - 0.2]);
  // 柱（2 列。台座はコンクリート、柱は H 形鋼）。最後の柱は上屋の延長分
  for (const s of [2.15, 4.25, 13.5, 22.5, 31.5, 40.0]) {
    const x = OLD.xEnd + s;
    for (const z0 of [-4.6, 4.6]) {
      const z = s === 4.25 && z0 > 0 ? 4.65 : z0;
      hColumn(b, mat.steelD, x, zc + z, 1.1, H, 0.18, 0.2, { rotY: Math.PI / 2 });
      b.box(mat.pedestalD, [x, 0.55, zc + z], [0.3, 1.1, 0.3], { collide: true });
      b.ctx.colliders.addCentered(x, 2, zc + z, 0.3, 4, 0.3);
    }
  }
  // 下面の細部: 波板の筋・中央のはしご形のラック・配管・箱・吊り金具
  underside({
    x0: xe + 0.4, x1: xr, z0: zc - OLD.half + 0.3, z1: zc + OLD.half - 0.3, y: H, along: 'x',
    rib: [0.22, 0.05],
    beams: [[-3.3, 0.18, 0.12], [3.3, 0.18, 0.12], [-5.8, 0.25, 0.14], [5.8, 0.25, 0.14]],
    trays: [[0.05, 0.3, 0.42]],
    pipes: [[-0.6, 0.2, 0.05], [0.7, 0.24, 0.04], [-2.7, 0.15, 0.06], [2.6, 0.12, 0.05]],
    boxes: { n: 18, size: [0.2, 0.5], drop: [0.05, 0.25], lanes: [-2.6, -0.4, 0.5, 2.7, -4.8, 4.9] },
    hangers: 0.8,
    seed: 5,
  }, dark, lite);
  // 先端の柱の方杖（曲がった板）と、手前の柱の間の格子
  for (const z of [-4.6, 4.6]) {
    const sz = Math.sign(z);
    haunch(b, mat.steelD, OLD.xEnd + 2.15, sz, zc + z - sz * 0.1, 2.95, 0.5, 3.43 - 2.95, H, 0.12, { rotY: Math.PI / 2 });
    for (let k = 0; k < 4; k++) {
      const y0 = 2.85 + (k % 2) * 0.28;
      strut(b, mat.steelD, [OLD.xEnd + 2.15 + k * 0.7, y0, zc + z * 0.98], [OLD.xEnd + 2.85 + k * 0.7, 3.41 - (k % 2) * 0.28, zc + z * 0.98], 0.03, 0.03);
    }
    // 柱の機器（箱・信号）。右（東）の柱には明るい案内板
    if (z > 0) b.box(mat.sign, [OLD.xEnd + 2.15, 2.35, zc + z * 0.96], [0.14, 0.35, 0.2]);
    else b.box(mat.signLight, [OLD.xEnd + 2.05, 2.23, zc - 4.3], [0.04, 0.16, 0.55]);
    b.box(mat.sign, [OLD.xEnd + 2.155, 0.68, zc + z * 0.95], [0.08, 0.2, 0.06]);
  }
  // 雨樋の縦管（左の手前）
  b.cyl(mat.steelD, [OLD.xEnd + 4.6, 0.95, zc + 4.75], 0.06, 1.9, { segments: 8 });
  b.box(mat.steelD, [OLD.xEnd + 4.6, 2.5, zc + 4.7], [0.05, 0.05, 0.4]);
  // 右の柱の間の深い梁と方杖
  b.boxMM(mat.steelD, [OLD.xEnd + 2.15, 2.9, zc - 4.7], [OLD.xEnd + 4.25, H, zc - 4.5]);
  strut(b, mat.steelD, [OLD.xEnd + 2.15, 2.35, zc - 4.6], [OLD.xEnd + 3.2, 2.95, zc - 4.6], 0.05, 0.05);
  // 左の柱の間の格子（下の弦と斜めの材）
  b.boxMM(mat.steelD, [OLD.xEnd + 2.15, 2.66, zc + 4.48], [OLD.xEnd + 4.25, 2.72, zc + 4.52]);
  for (let k = 0; k < 6; k++) {
    const x0 = OLD.xEnd + 2.15 + k * 0.35;
    strut(b, mat.steelD, [x0, 2.69, zc + 4.5], [x0 + 0.35, 3.15, zc + 4.5], 0.025, 0.025);
  }
  // 先端の梁から垂れる配線・管
  pipe(b, mat.steel, [[xe + 0.2, 3.42, zc + 3.6], [xe + 0.2, 3.22, zc + 3.3], [xe + 0.2, 3.3, zc + 2.9], [xe + 0.2, 3.42, zc + 2.6]], 0.03);
  pipe(b, mat.steel, [[xe + 0.2, 3.42, zc - 2.5], [xe + 0.2, 3.27, zc - 2.75], [xe + 0.2, 3.38, zc - 3.1]], 0.03);
  pipe(b, mat.steel, [[xe + 0.25, 3.42, zc + 0.6], [xe + 0.25, 3.1, zc + 0.6], [xe + 0.25, 3.05, zc + 0.25], [xe + 0.25, 3.05, zc - 0.55]], 0.035);
  // 吊り下げの箱（右）と柱の小さな案内
  b.box(mat.sign, [xe + 0.3, 3.15, zc - 4.06], [0.15, 0.42, 0.82]);
  for (const dz of [-0.3, 0.3]) b.box(mat.steel, [xe + 0.3, 3.4, zc - 4.06 + dz], [0.03, 0.12, 0.03]);
  // 蛍光灯（station-0 の参考画像の位置。幅の広い乳白の器具）。上屋を延ばした分も同じ間隔で
  const xs = [-61.6, -60.1, -57.1, -54.75, -52.5, -49.9, -47.3, -44.7, -42.1, -39.5, -36.9, -34.3, -31.7, -29.1, -26.5, -23.9];
  for (const z of [-1.38, 1.2]) {
    for (const x of xs) {
      if (x > xr - 0.8) continue;
      b.box(mat.housing, [x, 3.53, zc + z], [1.25, 0.08, 0.2], { shadow: false });
      addTube([x, 3.46, zc + z], 1.0, 'x', 0.11, 0.04, true);
    }
  }
  // ベンチ: 先端を向く 2 人掛け 2 つ（station-0）と、上屋の中ほどの 3 人掛け（線路を向く）
  for (const z of [0.99, -1.07]) {
    twinSeat(b, mat.benchD, mat.frameD, [-60.05, 0, zc + z], Math.PI / 2);
    b.ctx.colliders.addCentered(-60.05, 0.45, zc + z, 0.6, 0.9, 1.3);
  }
  for (const x of [-38.5, -30.0]) {
    twinSeat(b, mat.benchD, mat.frameD, [x, 0, zc - 3.2], 0);
    b.ctx.colliders.addCentered(x, 0.45, zc - 3.2, 1.3, 0.9, 0.6);
  }

  fb.finish(root, ctx.colliders);
  for (const t of localTubes) tubes.push({ c: fb.p(t.c), axis: fb.dir(t.axis), len: t.len });
  // 下面の細部の行列も移す
  const mv = (bb: BoxBatch): BoxBatch => {
    const out = new BoxBatch();
    for (const m of bb.mats) out.mats.push(fb.m(m));
    return out;
  };
  return { dark: mv(dark), lite: mv(lite) };
}
