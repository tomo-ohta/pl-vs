import type * as THREE from 'three';
import { createPaint, makeCoverage, type PaintOptions } from '../../render/PaintMaterial.ts';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import { wallWithHoles } from '../kit.ts';
import { CEIL, DOORS } from './layout.ts';
import { WHITE } from './paint.ts';

/**
 * 参考画像の視点（pastel-0）に写る所: 元の版（src/scenes/pastel.ts）の形と色をそのまま写したもの。
 * 変えた所（どれも参考画像から見えない所）:
 * - 床は建物全体の床（pastel.ts）に任せる（元の版の分布はその絵の中に同じ形で描く）
 * - 北の壁の 2 つの塊: 幅を外壁まで・高さを天井まで。西の塊に受付と薬の窓口（x < -4.2）
 * - 東の壁: 診察室・処置室の戸口（柱型の陰）。奥の左右の壁: 階段室の口・検査室の窓・便所の扉（枠の陰）
 * - 突き当たりの壁: 白い戸の所に開口（戸は doors.ts。閉じた見た目は元の版と同じ）
 * - 天井の板は廊下の壁の外までに縮めた（部屋の天井と重ならないように）
 * - 元の版の「手前の部屋」の箱は待合（rooms.ts）に置き換えた
 */
export function buildView(b: Builder, snow?: { texture: THREE.Texture; rect: [number, number, number, number] }): { endWallMat: THREE.Material; doorMat: THREE.Material; doorFrameMat: THREE.Material; handleMat: THREE.Material; cabMats: THREE.Material[] } {
  // 参考画像に写る所の塗りは灯りを受けない（灯りの計算を飛ばす。床は建物全体の 1 枚で別）
  const P = (o: PaintOptions): THREE.ShaderMaterial => createPaint({ lamp: 0, ...o });
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): THREE.Mesh => b.boxMM(m, min, max, { collide, shadow: false });
  const door = (id: string) => DOORS.find((d) => d.id === id)!;
  const BASEBOARD = P({ color: '#565d60' });

  // ---------- 手前の左の壁（北の壁の西の塊。正面を向く）----------
  const lfw = P({
    color: { pz: '#b8c8bd', px: '#b9c9be', nz: '#b8c8bd' },
    band: { y: 1.23, color: { pz: '#a1b6b1', px: '#b9c9be' }, amp: 0.06, scale: 0.8 },
    layers: [
      { color: { pz: '#dde1d3', px: '#fbfff0' }, scale: 1.6, threshold: 0.18, yRange: [1.3, 1.8], yGain: 1.0, origin: [-1.68, 0, 0], linear: [-0.22, 0, 0], detail: 0.45, only: 'wall', seed: 5 },
      { color: WHITE, scale: 2.2, threshold: 0.2, yRange: [0.02, 0.3], yGain: 1.0, detail: 0.5, only: 'wall', seed: 6 },
    ],
  });
  // 受付と薬の窓口（x < -4.2。画角の左の端は x -3.25）
  const holes = ['drug', 'recep'].map((id) => {
    const d = door(id);
    return { at: (d.a + d.b) / 2 - -7.5, width: d.b - d.a, bottom: d.y0, top: d.y1 };
  });
  wallWithHoles(b, lfw, [-7.5, -4.32], [-1.68, -4.32], 0, CEIL, 0.28, holes, { shadow: false });
  box(BASEBOARD, [-7.2, 0, -4.17], [-2.6, 0.1, -4.2]);

  // 左の手前の箱（白い下足箱）
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

  // 左の入口の奥のクリームの枠（防火シャッターの枠）と、その上
  const creamJamb = P({ color: { pz: '#d5d7c2', px: '#cfd1bc', nz: '#bfc1ad' }, band: { y: 3.05, color: { pz: '#d5d7c2', px: '#cfd1bc', nz: '#bfc1ad' } } });
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
  box(lWall1, [-2.2, 0, -5.1], [-1.76, 4.6, -7.29], true);
  box(lWall1, [-2.2, 0, -4.46], [-1.86, 4.6, -5.1], true);
  // シャッターの枠の上（元の版では奥の壁が見えていた所。同じ色でふさぐ）
  box(lWall1, [-1.869, 3.33, -5.0], [-1.666, CEIL, -5.1]);
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
  // 左の壁の小さな板（スイッチ・案内の板）
  const plate = P({ color: '#eef1e6' });
  box(plate, [-1.765, 2.58, -6.15], [-1.75, 2.8, -6.3]);
  const greyPlate2 = P({ color: '#8f9e98' });
  box(greyPlate2, [-1.765, 1.95, -8.4], [-1.75, 2.2, -8.55]);
  box(greyPlate2, [-1.765, 1.9, -10.9], [-1.75, 2.1, -11.05]);
  box(greyPlate2, [-1.765, 1.85, -13.3], [-1.75, 2.05, -13.45]);

  // ---------- 手前の右の壁（北の壁の東の塊。正面を向く）----------
  const rfw = P({
    color: { pz: '#dde5d8', nx: '#d8d9c7' },
    band: { y: 2.97, color: { pz: '#dde5d8', nx: '#bcc7b7' } },
    layers: [
      { color: { pz: '#dde5d8', nx: '#abb2ab' }, scale: 1.4, threshold: -1, yRange: [0.95, 0.97], yGain: 3, only: 'wall', seed: 16 },
      { color: { pz: '#eef2e6', nx: '#c9d0c9' }, scale: 1.4, threshold: 0.6, yRange: [0.1, 0.7], yGain: 0.8, only: 'wall', seed: 15 },
    ],
  });
  box(rfw, [1.48, 0, -4.28], [7.5, CEIL, -4.73], true);
  const baseR = P({ color: '#565d60', layers: [{ color: WHITE, scale: 5, threshold: 0.42, detail: 0.6, seed: 41 }] });
  box(baseR, [1.48, 0, -4.27], [7.2, 0.125, -4.3]);
  box(BASEBOARD, [1.47, 0, -4.3], [1.5, 0.11, -4.73]);
  // 防火シャッターの手動閉鎖装置（塊の端の暗い金具）
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

  // 右の入口の奥のクリームの板（防火シャッターの枠）
  const creamR = P({
    color: { pz: '#c7cebe', nx: '#a1aea7', nz: '#b3b9aa' },
    band: { y: 0.95, color: { pz: '#c2c4b7', nx: '#a1aea7' }, amp: 0.04, scale: 1 },
    layers: [{ color: '#cbd2cb', scale: 2.0, threshold: 0.15, yRange: [0.1, 0.5], yGain: 1.0, stretch: [2.0, 0.7], detail: 0.6, only: 'wall', seed: 21 }],
  });
  box(creamR, [1.18, 0, -4.9], [1.82, CEIL, -5.1], true);

  // ---------- 右の廊下の壁と柱型（柱型の陰の凹みに診察室・処置室の戸口）----------
  // 東の壁の面（x = 1.82）は手前のクリームの柱・柱型 A・B の陰で、参考画像の目からほぼ見えない（柱型 B の手前の 0.1 m だけ）。
  // そこで写っていない所と同じ塗り（腰壁の縁のちぎれと垂れ・足元の雪）にする
  const rWall = P({
    color: { nx: '#b5c5bb', pz: '#b5c5bb' },
    band: { y: 1.38, color: '#8a9d9d', amp: 0.04, scale: 1.2, drip: 0.12 },
    cov: snow,
    layers: [
      { color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' },
      { color: '#93a6a5', scale: 2.0, threshold: 0.42, yRange: [0.05, 0.6], yGain: 0.7, stretch: [2.5, 0.6], detail: 0.6, only: 'wall', seed: 13 },
      { color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' },
      { color: WHITE, scale: 2.2, threshold: 0.92, yRange: [0.03, 0.42], yGain: 1.1, detail: 0.55, only: 'wall', seed: 6, cov: 0.75 },
    ],
  });
  const rHoles = ['E1', 'E2', 'E3'].map((id) => {
    const d = door(id);
    return { at: -5.1 - d.b + (d.b - d.a) / 2, width: d.b - d.a, bottom: d.y0, top: d.y1 };
  });
  wallWithHoles(b, rWall, [2.06, -5.1], [2.06, -14.5], 0, 4.6, 0.48, rHoles, { shadow: false });
  const pilA = P({
    color: { pz: '#a1aea7', nx: '#9aa8a2', nz: '#929f99' },
    band: { y: 1.38, color: { pz: '#829697', nx: '#7d9091', nz: '#768a8b' }, amp: 0.03, scale: 1.2 },
  });
  box(pilA, [1.34, 0, -7.5], [1.82, 4.6, -7.8], true);
  const pilB = P({
    color: { pz: '#b5c5bb', nx: '#a9b8b0', nz: '#a3b1a9' },
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
  // 天井 4.45 m。梁の下端 4.1 m（左右の壁の上端が水平に切れて見える）。板は廊下の壁の外の面まで
  const ceilNear = P({ color: '#9db2ab' });
  box(ceilNear, [-2.2, CEIL, -4.4], [2.3, 4.8, -7.5]);
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
  box(ceil, [-2.2, CEIL, -7.5], [2.3, 4.8, -12.9]);
  const beam1 = P({ color: '#9db2ab' });
  box(beam1, [-2.2, 4.1, -7.5], [2.3, 4.45, -7.8]);
  const beam = P({ color: '#a8bcb3' });
  box(beam, [-2.2, 4.1, -9.0], [2.3, 4.45, -9.25]);
  box(beam, [-2.2, 4.1, -10.6], [2.3, 4.45, -10.85]);
  // 天井の灯り（小さな白い長方形。梁の下端の高さに吊る）
  const lamp = P({ color: '#f4f6e4', noFog: true });
  for (const z of [-7.9, -9.43, -10.74]) box(lamp, [-0.15, 4.06, z + 0.04], [0.17, 4.08, z - 0.04]);
  // 廊下の口の上のまぐさ（目から見えない高さ 3.7 m より上）
  box(ceilNear, [-1.7, 3.7, -4.3], [1.5, CEIL, -4.62]);

  // ---------- 奥のクリームの区画（入れ子の枠）----------
  // 枠 1（d 12.9〜13.9、下端 3.88）・枠 2（d 13.9〜15.4、下端 3.35）・その先は天井 4.1 で突き当たり d 21
  const creamFace1 = P({ color: { pz: '#d9d7be', ny: '#dad8c5', nz: '#c8c6ae' } });
  box(creamFace1, [-1.57, 3.88, -12.9], [1.6, 4.45, -13.9]);
  const creamFace2 = P({ color: { pz: '#dcd9c2', ny: '#dedccb', nz: '#cac8b2' } });
  box(creamFace2, [-1.6, 3.35, -13.9], [1.5, 3.88, -15.4]);
  const farCeil = P({ color: '#d2d3c0' });
  box(farCeil, [-1.71, 4.1, -15.4], [1.73, 4.4, -21.1]);
  // 枠 2 の上の隙間をふさぐ（下からは見えない）
  box(creamFace2, [-1.6, 3.88, -13.9], [1.5, 4.45, -15.4]);
  // 区画の壁（左）: 枠 1 の柱・枠 2 の柱・奥（階段室の口は枠 2 の陰）
  const fwL1 = P({ color: { pz: '#a9b8ae', px: '#bccac0', nz: '#97a69d' }, band: { y: 1.3, color: { pz: '#6f8384', px: '#b3c2bb', nz: '#6f8384' } } });
  box(fwL1, [-2.2, 0, -12.9], [-1.57, CEIL, -13.9], true);
  const fwL2 = P({ color: { pz: '#c6d3c6', px: '#c6d3c6', nz: '#b5c1b4' }, band: { y: 1.2, color: { pz: '#c7d1c8', px: '#c7d1c8', nz: '#a7b8b2' } } });
  box(fwL2, [-2.2, 0, -13.9], [-1.24, CEIL, -15.4], true);
  const fwL3 = P({ color: { pz: '#cdd6c8', px: '#cbd5c4' }, band: { y: 1.2, color: { pz: '#d9dccd', px: '#d9dccd' } } });
  const so = door('stairOpen');
  wallWithHoles(b, fwL3, [-1.56, -15.4], [-1.56, -21.3], 0, CEIL, 0.3, [{ at: -15.4 - so.b + (so.b - so.a) / 2, width: so.b - so.a, bottom: so.y0, top: so.y1 }], { shadow: false });
  box(P({ color: '#dcdcc8' }), [-1.25, 0, -13.95], [-1.2, 3.35, -14.05]);
  // 区画の壁（右）（検査室の窓・便所の扉は枠 2 の陰）
  const fwR1 = P({ color: { pz: '#a8b3ad', nx: '#a8b3ad', nz: '#98a39d' } });
  box(fwR1, [1.4, 0, -12.9], [2.3, CEIL, -13.9], true);
  const fwR2 = P({ color: { pz: '#d5d8c6', nx: '#d8d8c4', nz: '#c3c6b4' }, band: { y: 1.2, color: { pz: '#d5d8c6', nx: '#d8d8c4', nz: '#a7b8b2' } } });
  box(fwR2, [1.13, 0, -13.9], [2.3, CEIL, -15.4], true);
  const fwR3 = P({ color: { pz: '#cccfbb', nx: '#d5d6c3' } });
  const rh = ['labWin', 'E5'].map((id) => {
    const d = door(id);
    return { at: -15.4 - d.b + (d.b - d.a) / 2, width: d.b - d.a, bottom: d.y0, top: d.y1 };
  });
  wallWithHoles(b, fwR3, [1.58, -15.4], [1.58, -21.3], 0, CEIL, 0.3, rh, { shadow: false });
  // 突き当たりの壁（白い戸の所に開口。戸は doors.ts）
  const endWall = P({
    color: '#c4cbb9',
    band: { y: 0.95, color: '#c3c9bb', amp: 0.0, scale: 1 },
    layers: [{ color: '#d8d9c6', scale: 1.6, threshold: 0.35, yRange: [0.95, 1.35], yGain: 1.0, only: 'wall', seed: 27 }],
  });
  const bd = door('back');
  wallWithHoles(b, endWall, [-1.71, -21.15], [1.73, -21.15], 0, CEIL, 0.3, [{ at: (bd.a + bd.b) / 2 + 1.71, width: bd.b - bd.a, bottom: 0, top: bd.y1 }], { shadow: false });
  box(BASEBOARD, [-1.41, 0, -20.99], [bd.a - 0.04, 0.07, -21.0]);
  box(BASEBOARD, [bd.b + 0.04, 0, -20.99], [1.43, 0.07, -21.0]);
  // 戸の枠（開口の周りの 3 本。閉じた戸の後ろは元の版の枠の板と同じ色）
  const doorFrame = P({ color: '#dadbc9' });
  box(doorFrame, [bd.a - 0.04, 0, -20.985], [bd.a, 2.1, -21.0]);
  box(doorFrame, [bd.b, 0, -20.985], [bd.b + 0.04, 2.1, -21.0]);
  box(doorFrame, [bd.a - 0.04, bd.y1, -20.985], [bd.b + 0.04, 2.1, -21.0]);
  const farSign = P({ color: '#a3aba3', layers: [{ color: '#d8dccf', scale: 12, threshold: 0.5, seed: 3 }] });
  box(farSign, [-1.22, 2.58, -20.99], [-1.03, 2.68, -21.0]);
  box(farSign, [0.71, 2.58, -20.99], [0.86, 2.68, -21.0]);
  // 奥の低い棚（左: 突き当たりの壁ぎわの下駄箱、右: 検査室の窓口の台）
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

  return {
    endWallMat: endWall,
    doorMat: P({ color: '#cfd0be' }),
    doorFrameMat: doorFrame,
    handleMat: P({ color: '#2e3436' }),
    cabMats: [cab, cabTop, counter],
  };
}
