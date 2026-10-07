import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { Builder, type V3 } from './Builder.ts';
import { createPaint, makeCoverage, type PaintOptions } from '../render/PaintMaterial.ts';
import type { SceneDef } from './types.ts';

/**
 * 淡色の廊下（pastel-0）。ほぼ影の無い淡いセージ・クリーム・灰青の色面と、床・壁の下の白い塗りの斑。
 * 照明は使わず、面の向きごとに参考画像の色を直接塗る（pastel/paint.ts）。
 * 座標: 目の位置が x = 0・z = 0、奥が -Z。床 y = 0。
 * 寸法は参考画像の消失点（762, 436）・目の高さ 1.25 m・焦点距離 1000 画素から逆算した。
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'pastel',
  background: '#c9d3c8',
  fog: { horizon: '#dfe3d4', zenith: '#dfe3d4', density: 0.0, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.5, steps: 0 },
  post: {
    lines: { enabled: false, color: '#3c4346', width: 1, depth: 0.12, normal: 0.9, id: 0, breakup: 0.55, fadeFar: 12, opacity: 0.5 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

const EYE = 1.25;

export const pastel: SceneDef = {
  id: 'pastel',
  label: '淡色の廊下',
  style,
  sky: false,
  views: [{ id: 'pastel-0', label: '入口から奥を見る', eye: [0, EYE, 0], yaw: 0.034, pitch: 0.028, fov: 44.39 }],
  build(ctx) {
    const b = new Builder(ctx);
    const P = (o: PaintOptions): THREE.ShaderMaterial => createPaint(o);
    // 角の座標で箱（x, y, z の最小・最大）
    const box = (m: THREE.Material, min: V3, max: V3, collide = false): THREE.Mesh =>
      b.boxMM(m, min, max, { collide, shadow: false });

    const WHITE = '#f5f7ea';
    const BASEBOARD = P({ color: '#565d60' });

    // ---------- 床 ----------
    // 塗りの分布（上から見た絵）: R = 中間の灰青, G = 左の壁際の明るい吹きだまり・手前, B = 右の白っぽい吹きだまり, A = 白
    const covRect: [number, number, number, number] = [-2.4, 2, 2.4, -23];
    const cov = makeCoverage(covRect, 16, [
      // 明るい灰青（左の壁際の吹きだまり・右の棚の前・手前の中央）
      { ch: 1, seg: [-1.35, -5.0, -1.15, -9.0], w: 0.45, soft: 0.3 },
      { ch: 1, seg: [-1.35, -9.0, -1.3, -12.5], w: 0.2, soft: 0.2, v: 0.8 },
      { ch: 1, seg: [1.0, -6.0, 1.0, -8.5], w: 0.25, soft: 0.2 },
      { ch: 0, e: [-0.2, -3.38, 1.1, 0.16] },
      { ch: 0, e: [0.1, -4.0, 0.4, 0.3] },
      { ch: 1, e: [0, -18.5, 1.0, 1.5], v: 0.7 },
      { ch: 1, seg: [-1.6, -4.7, -1.3, -6.0], w: 0.4, soft: 0.3 },
      { ch: 1, e: [0.9, -15, 0.4, 2], v: 0.8 },
      // 白っぽい灰（右の吹きだまり・奥の床・左の手前）
      { ch: 2, seg: [1.05, -4.3, 1.15, -6.6], w: 0.55, soft: 0.3 },
      { ch: 2, seg: [0, -16.5, 0, -22], w: 1.6, soft: 1.5 },
      { ch: 2, e: [-1.0, -4.8, 0.8, 0.45], v: 0.9 },
      // 白（手前の帯・右の手前・奥の筋・左の壁の足元）
      { ch: 3, seg: [-3, -4.0, -1.1, -4.0], w: 0.42, soft: 0.25 },
      { ch: 3, seg: [-1.1, -4.05, -0.3, -4.05], w: 0.12, soft: 0.2, v: 0.8 },
      { ch: 3, seg: [0.95, -4.0, 3, -4.0], w: 0.45, soft: 0.2 },
      { ch: 3, seg: [1.3, -3.6, 3, -3.6], w: 0.35, soft: 0.2 },
      { ch: 3, e: [-1.5, -4.6, 0.55, 0.55] },
      { ch: 3, e: [1.9, -4.0, 0.8, 0.3] },
      { ch: 3, e: [-0.7, -14.5, 0.9, 1.6], v: 0.85 },
      { ch: 3, seg: [-1.5, -10.55, 1.2, -10.55], w: 0.1, soft: 0.2, v: 0.7 },
      { ch: 3, seg: [-1.5, -12.35, 1.2, -12.35], w: 0.15, soft: 0.2, v: 0.75 },
      { ch: 3, seg: [-1.5, -13.55, 1.2, -13.55], w: 0.15, soft: 0.2, v: 0.8 },
      { ch: 3, seg: [-1.76, -5, -1.76, -9], w: 0.05, soft: 0.15, v: 0.6 },
    ]);
    const floor = P({
      color: '#768987',
      cov: { texture: cov, rect: covRect },
      layers: [
        { color: '#a5b5b5', scale: 2.0, threshold: 0.68, cov: 0.6, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 1 },
        { color: '#a9bfbd', scale: 2.0, threshold: 0.92, cov: 0.62, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 2 },
        { color: '#cbd2cb', scale: 2.0, threshold: 0.95, cov: 0.62, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 3 },
        { color: WHITE, scale: 1.8, threshold: 0.95, cov: 0.8, stretch: [0.35, 4.0], detail: 0.6, only: 'floor', seed: 4 },
      ],
    });
    box(floor, [-8, -0.2, 4], [8, 0, -26], true);

    // ---------- 手前の左の壁（正面を向く）----------
    const lfw = P({
      color: { pz: '#b8c8bd', px: '#b9c9be', nz: '#b8c8bd' },
      band: { y: 1.23, color: { pz: '#a1b6b1', px: '#b9c9be' }, amp: 0.06, scale: 0.8 },
      layers: [
        { color: { pz: '#dde1d3', px: '#fbfff0' }, scale: 1.6, threshold: 0.18, yRange: [1.3, 1.8], yGain: 1.0, origin: [-1.68, 0, 0], linear: [-0.22, 0, 0], detail: 0.45, only: 'wall', seed: 5 },
        { color: WHITE, scale: 2.2, threshold: 0.2, yRange: [0.02, 0.3], yGain: 1.0, detail: 0.5, only: 'wall', seed: 6 },
      ],
    });
    box(lfw, [-9, 0, -4.18], [-1.68, 6, -4.46], true);
    box(BASEBOARD, [-9, 0, -4.17], [-2.6, 0.1, -4.2]);

    // 左の手前の箱（白いロッカー）
    const locker = P({
      color: { pz: '#dee0d3', px: '#fbfff0', py: '#f0f2e6' },
      layers: [
        { color: { pz: '#a9bbb5', px: '#e9ece0' }, scale: 3.5, threshold: 0.86, only: 'wall', seed: 7 },
        { color: WHITE, scale: 2.2, threshold: 0.2, yRange: [0.05, 0.42], yGain: 1.0, detail: 0.5, only: 'wall', seed: 8 },
      ],
    });
    box(locker, [-2.733, 0, -3.74], [-2.02, 1.292, -4.18], true);

    // 左の掲示（淡い青の長方形）と上の小さな灰色の板
    const paleSign = P({ color: '#bed3c9', layers: [{ color: '#a9bcb3', scale: 6, threshold: 0.84, seed: 9 }] });
    box(paleSign, [-2.843, 1.809, -4.17], [-2.459, 2.552, -4.175]);
    const greyPlate = P({ color: '#9fb2aa', layers: [{ color: '#c9d6cf', scale: 5, threshold: 0.6, seed: 4 }] });
    box(greyPlate, [-2.655, 2.938, -4.17], [-2.463, 3.093, -4.175]);

    // 左の入口の奥のクリームの枠と、その上
    const creamJamb = P({ color: { pz: '#d5d7c2', px: '#cfd1bc' }, band: { y: 3.05, color: { pz: '#d5d7c2', px: '#cfd1bc' } } });
    box(creamJamb, [-1.869, 0.08, -5.0], [-1.666, 3.088, -5.1], true);
    box(BASEBOARD, [-1.869, 0, -4.99], [-1.666, 0.08, -5.1]);
    const jambTop = P({ color: '#a3b4ab' });
    box(jambTop, [-1.869, 3.088, -5.0], [-1.666, 3.33, -5.1]);
    box(P({ color: '#3f4749' }), [-1.66, 2.69, -5.0], [-1.65, 2.96, -5.04]);

    // ---------- 左の廊下の壁（柱型の間）----------
    const lWall1 = P({
      color: { px: '#b1c2b8', pz: '#b1c2b8' },
      band: { y: 1.38, color: { px: '#99afad', pz: '#99afad' }, amp: 0.04, scale: 1.2, drip: 0.12 },
      layers: [{ color: '#a9bfbd', scale: 2.0, threshold: 0.12, yRange: [0.05, 0.75], yGain: 0.9, origin: [0, 0, -5], linear: [0, 0, -0.12], stretch: [2.5, 0.6], detail: 0.6, only: 'wall', seed: 12 }],
    });
    box(lWall1, [-2.2, 0, -5.1], [-1.76, 6, -7.29], true);
    box(lWall1, [-2.2, 0, -4.46], [-1.86, 6, -5.1], true);
    const lWall = P({
      color: { px: '#a5b5ab', pz: '#a5b5ab' },
      band: { y: 1.38, color: { px: '#61767a', pz: '#61767a' }, amp: 0.04, scale: 1.2, drip: 0.25 },
      layers: [{ color: '#a9bfbc', scale: 2.0, threshold: 0.25, yRange: [0.05, 0.45], yGain: 0.9, stretch: [2.5, 0.6], detail: 0.6, only: 'wall', seed: 13 }],
    });
    box(lWall, [-2.2, 0, -7.29], [-1.76, 4.6, -14.5], true);
    const lPil = P({
      color: { pz: '#8a9b95', px: '#a5b5ab' },
      band: { y: 1.38, color: { pz: '#6c7f80', px: '#61767a' }, amp: 0.04, scale: 1.2 },
      layers: [{ color: '#a9bfbc', scale: 2.0, threshold: 0.25, yRange: [0.05, 0.45], yGain: 0.9, stretch: [2.5, 0.6], detail: 0.6, only: 'wall', seed: 14 }],
    });
    for (const [z, x1] of [
      [-7.29, -1.65],
      [-9.6, -1.65],
      [-12.1, -1.69],
      [-14.5, -1.62],
    ] as const) {
      box(lPil, [-1.8, 0, z], [x1, 3.2, z - 0.3], true);
      box(lWall, [-1.8, 3.2, z], [x1, 4.45, z - 0.3]);
      box(BASEBOARD, [-1.8, 0, z + 0.005], [x1, 0.08, z - 0.3]);
    }
    // 左の壁の小さな板（スイッチ）
    const plate = P({ color: '#eef1e6' });
    box(plate, [-1.765, 2.58, -6.15], [-1.75, 2.8, -6.3]);
    const greyPlate2 = P({ color: '#8f9e98' });
    box(greyPlate2, [-1.765, 1.95, -8.4], [-1.75, 2.2, -8.55]);
    box(greyPlate2, [-1.765, 1.9, -10.9], [-1.75, 2.1, -11.05]);
    box(greyPlate2, [-1.765, 1.85, -13.3], [-1.75, 2.05, -13.45]);

    // ---------- 手前の右の壁（正面を向く）----------
    const rfw = P({
      color: { pz: '#dde5d8', nx: '#d8d9c7' },
      band: { y: 2.97, color: { pz: '#dde5d8', nx: '#bcc7b7' } },
      layers: [
        { color: { pz: '#dde5d8', nx: '#abb2ab' }, scale: 1.4, threshold: -1, yRange: [0.95, 0.97], yGain: 3, only: 'wall', seed: 16 },
        { color: { pz: '#eef2e6', nx: '#c9d0c9' }, scale: 1.4, threshold: 0.6, yRange: [0.1, 0.7], yGain: 0.8, only: 'wall', seed: 15 },
      ],
    });
    box(rfw, [1.48, 0, -4.28], [9, 6, -4.73], true);
    const baseR = P({ color: '#565d60', layers: [{ color: WHITE, scale: 5, threshold: 0.42, detail: 0.6, seed: 41 }] });
    box(baseR, [1.48, 0, -4.27], [9, 0.125, -4.3]);
    box(BASEBOARD, [1.47, 0, -4.3], [1.5, 0.11, -4.73]);
    // 戸の取っ手
    box(P({ color: '#2e3436' }), [1.465, 1.38, -4.22], [1.48, 1.72, -4.3]);
    // スイッチ・コンセント・掲示
    const plateR = P({ color: '#d8ddd0' });
    box(plateR, [1.677, 2.516, -4.17], [1.821, 2.76, -4.175]);
    box(P({ color: '#b3b8b2' }), [1.692, 2.535, -4.165], [1.806, 2.741, -4.17]);
    box(P({ color: '#4a5153' }), [1.7, 2.63, -4.16], [1.76, 2.64, -4.165]);
    box(plateR, [1.696, 1.707, -4.17], [1.823, 1.956, -4.175]);
    const swBtn = P({ color: '#c3c8c0' });
    box(swBtn, [1.73, 1.85, -4.165], [1.79, 1.91, -4.17]);
    box(swBtn, [1.73, 1.75, -4.165], [1.79, 1.81, -4.17]);
    box(plateR, [1.854, 0.209, -4.17], [1.964, 0.378, -4.175]);
    box(swBtn, [1.88, 0.3, -4.165], [1.94, 0.34, -4.17]);
    box(swBtn, [1.88, 0.24, -4.165], [1.94, 0.28, -4.17]);
    const paleSignR = P({ color: '#e5ece0', layers: [{ color: '#d3dccf', scale: 6, threshold: 0.84, seed: 19 }] });
    box(paleSignR, [2.293, 1.745, -4.17], [2.669, 2.536, -4.175]);
    box(plateR, [2.289, 2.934, -4.17], [2.477, 3.1, -4.175]);

    // 右の入口の奥のクリームの板（柱型）
    const creamR = P({
      color: { pz: '#c7cebe', nx: '#a1aea7' },
      band: { y: 0.95, color: { pz: '#c2c4b7', nx: '#a1aea7' }, amp: 0.04, scale: 1 },
      layers: [{ color: '#cbd2cb', scale: 2.0, threshold: 0.15, yRange: [0.1, 0.5], yGain: 1.0, stretch: [2.0, 0.7], detail: 0.6, only: 'wall', seed: 21 }],
    });
    box(creamR, [1.18, 0, -4.9], [1.82, 6, -5.1], true);

    // ---------- 右の廊下の壁と柱型 ----------
    const rWall = P({ color: { nx: '#b5c5bb', pz: '#b5c5bb' }, band: { y: 1.38, color: '#8a9d9d' } });
    box(rWall, [1.82, 0, -5.1], [2.3, 4.6, -14.5], true);
    const pilA = P({
      color: { pz: '#a1aea7', nx: '#9aa8a2' },
      band: { y: 1.38, color: { pz: '#829697', nx: '#7d9091' }, amp: 0.03, scale: 1.2 },
    });
    box(pilA, [1.34, 0, -7.5], [1.82, 4.6, -7.8], true);
    const pilB = P({
      color: { pz: '#b5c5bb', nx: '#a9b8b0' },
      layers: [{ color: { pz: '#dfe2db' }, scale: 1.4, threshold: 0.55, yRange: [0.1, 0.6], yGain: 0.8, only: 'wall', seed: 23 }],
    });
    box(pilB, [1.33, 0, -10.7], [1.82, 4.6, -11.0], true);
    box(plateR, [1.45, 2.58, -10.69], [1.58, 2.82, -10.695]);
    box(plateR, [1.45, 1.75, -10.69], [1.58, 2.0, -10.695]);
    // 右の暗い棚
    const cab = P({ color: { pz: '#6f8382', nx: '#677a7a' } });
    box(cab, [1.11, 0, -6.53], [1.55, 1.01, -7.0], true);
    const cabTop = P({ color: { pz: '#92a19a', py: '#a1ada5', nx: '#8d9c96' } });
    box(cabTop, [1.04, 1.01, -6.46], [1.6, 1.062, -7.05], true);

    // ---------- 天井（梁の段）----------
    // 天井 4.45 m。梁の下端 4.1 m（左右の壁の上端が水平に切れて見える）
    const ceilNear = P({ color: '#9db2ab' });
    box(ceilNear, [-3, 4.45, -4.4], [3, 4.8, -7.5]);
    const ceilCovRect: [number, number, number, number] = [-2, -7, 2, -13];
    const ceilCov = makeCoverage(ceilCovRect, 24, [
      { ch: 0, e: [1.05, -10.45, 0.9, 0.13], soft: 0.6 },
      { ch: 0, e: [-0.02, -12.2, 0.35, 0.1], soft: 0.6 },
    ]);
    const ceil = P({
      color: '#a8bcb3',
      cov: { texture: ceilCov, rect: ceilCovRect },
      layers: [{ color: '#cbd6cd', scale: 2.5, threshold: 1.0, cov: 0.8, stretch: [0.5, 2.5], detail: 0.45, only: 'ceil', seed: 25 }],
    });
    box(ceil, [-3, 4.45, -7.5], [3, 4.8, -12.9]);
    const beam1 = P({ color: '#9db2ab' });
    box(beam1, [-2.2, 4.1, -7.5], [2.3, 4.45, -7.8]);
    const beam = P({ color: '#a8bcb3' });
    box(beam, [-2.2, 4.1, -9.0], [2.3, 4.45, -9.25]);
    box(beam, [-2.2, 4.1, -10.6], [2.3, 4.45, -10.85]);
    // 天井の灯り（小さな白い長方形。梁の下端の高さに吊る）
    const lamp = P({ color: '#f4f6e4', noFog: true });
    for (const z of [-7.9, -9.43, -10.74]) box(lamp, [-0.15, 4.06, z + 0.04], [0.17, 4.08, z - 0.04]);

    // ---------- 奥のクリームの区画（入れ子の枠）----------
    // 枠 1（d 12.9〜13.9、下端 3.88）・枠 2（d 13.9〜15.4、下端 3.35）・その先は天井 4.1 で突き当たり d 21
    const creamFace1 = P({ color: { pz: '#d9d7be', ny: '#dad8c5' } });
    box(creamFace1, [-1.57, 3.88, -12.9], [1.6, 4.45, -13.9]);
    const creamFace2 = P({ color: { pz: '#dcd9c2', ny: '#dedccb' } });
    box(creamFace2, [-1.6, 3.35, -13.9], [1.5, 3.88, -15.4]);
    const farCeil = P({ color: '#d2d3c0' });
    box(farCeil, [-1.8, 4.1, -15.4], [1.8, 4.4, -21.1]);
    // 区画の壁（左）: 枠 1 の柱・枠 2 の柱・奥
    const fwL1 = P({ color: { pz: '#a9b8ae', px: '#bccac0' }, band: { y: 1.3, color: { pz: '#6f8384', px: '#b3c2bb' } } });
    box(fwL1, [-2.2, 0, -12.9], [-1.57, 4.45, -13.9], true);
    const fwL2 = P({ color: { pz: '#c6d3c6', px: '#c6d3c6' }, band: { y: 1.2, color: { pz: '#c7d1c8', px: '#c7d1c8' } } });
    box(fwL2, [-2.2, 0, -13.9], [-1.24, 4.45, -15.4], true);
    const fwL3 = P({ color: { pz: '#cdd6c8', px: '#cbd5c4' }, band: { y: 1.2, color: { pz: '#d9dccd', px: '#d9dccd' } } });
    box(fwL3, [-2.2, 0, -15.4], [-1.41, 4.45, -21.1], true);
    box(P({ color: '#dcdcc8' }), [-1.25, 0, -13.95], [-1.2, 3.35, -14.05]);
    // 区画の壁（右）
    const fwR1 = P({ color: { pz: '#a8b3ad', nx: '#a8b3ad' } });
    box(fwR1, [1.4, 0, -12.9], [2.3, 4.45, -13.9], true);
    const fwR2 = P({ color: { pz: '#d5d8c6', nx: '#d8d8c4' } });
    box(fwR2, [1.13, 0, -13.9], [2.3, 4.45, -15.4], true);
    const fwR3 = P({ color: { pz: '#cccfbb', nx: '#d5d6c3' } });
    box(fwR3, [1.43, 0, -15.4], [2.3, 4.45, -21.1], true);
    // 突き当たりの壁と白い戸
    const endWall = P({
      color: '#c4cbb9',
      band: { y: 0.95, color: '#c3c9bb', amp: 0.0, scale: 1 },
      layers: [{ color: '#d8d9c6', scale: 1.6, threshold: 0.35, yRange: [0.95, 1.35], yGain: 1.0, only: 'wall', seed: 27 }],
    });
    box(endWall, [-2.2, 0, -21.0], [2.3, 4.4, -21.3], true);
    box(BASEBOARD, [-1.6, 0, -20.99], [1.5, 0.07, -21.0]);
    const doorFrame = P({ color: '#dadbc9' });
    box(doorFrame, [-0.68, 0, -20.985], [0.38, 2.1, -21.0]);
    const door = P({ color: '#cfd0be' });
    box(door, [-0.64, 0, -20.97], [0.34, 2.05, -20.985]);
    box(P({ color: '#2e3436' }), [-0.6, 0.95, -20.96], [-0.56, 1.12, -20.97]);
    const farSign = P({ color: '#a3aba3', layers: [{ color: '#d8dccf', scale: 12, threshold: 0.5, seed: 3 }] });
    box(farSign, [-1.22, 2.58, -20.99], [-1.03, 2.68, -21.0]);
    box(farSign, [0.71, 2.58, -20.99], [0.86, 2.68, -21.0]);
    // 奥の低い棚（左: 突き当たりの壁ぎわ、右: 区画の中ほど）
    const counter = P({ color: { pz: '#d6d6c2', py: '#e2e3d2', nx: '#cfd0bd', px: '#cfd0bd' } });
    box(counter, [-1.41, 0, -20.4], [-0.66, 1.06, -21.0], true);
    box(P({ color: '#3a4244' }), [-0.85, 0.82, -20.39], [-0.75, 0.86, -20.4]);
    box(counter, [1.05, 0, -16.7], [1.43, 0.95, -17.6], true);
    const counterDark = P({ color: '#b0b7b0' });
    box(counterDark, [1.25, 0, -16.69], [1.43, 0.9, -16.7]);
    // 奥の灯り（画面の縦の位置に並ぶ白い棒）
    for (const [z, y] of [
      [-12.5, 4.44],
      [-12.85, 4.04],
      [-13.86, 3.84],
      [-13.86, 3.52],
      [-14.6, 3.33],
      [-20.95, 3.94],
      [-20.95, 3.67],
    ] as const)
      box(lamp, [-0.16, y - 0.025, z + 0.02], [0.18, y, z - 0.02]);

    // 手前の部屋（参考画像には写らない。歩いて振り返ったとき用）
    const room = P({ color: { nz: '#d8ddd0', px: '#c9d2c6', nx: '#c9d2c6', ny: '#b9c7bf' } });
    box(room, [-4, 0, 3], [4, 4.6, 3.3], true);
    box(room, [-4.3, 0, -4.18], [-4, 4.6, 3.3], true);
    box(room, [4, 0, -4.18], [4.3, 4.6, 3.3], true);
    box(room, [-4.3, 4.6, -4.4], [4.3, 4.9, 3.3]);
    // 奥の区画の天井より上を塞ぐ（当たり判定）
    ctx.colliders.add({ x: -3, y: 4.45, z: -4.4 }, { x: 3, y: 5, z: -22 });

    b.finalize();
    return { root: b.root, spawn: { pos: [0, 0, 0], yaw: 0.034 } };
  },
};
