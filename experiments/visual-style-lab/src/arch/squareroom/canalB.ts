import * as THREE from 'three';
import { sideBlock, wallBlock, type LBox } from './author.ts';
import { place, waterPlane, type Env, type ZoneMats } from './env.ts';
import { Frame } from './frame.ts';
import { frontage } from './frontage.ts';
import { BASIN, STREET, VIEWS, localCam } from './layout.ts';
import { tagFlood } from './mats.ts';
import { overhangRibs } from './soffit.ts';
import { stackDress } from './upper.ts';
import { stackWall } from './stack.ts';

/**
 * B: 浸水した通り（squareroom-0 の視点。中央の水庭から南へ）。
 * 両側の壁は低い箱（3〜4 m）が手前へ出て、その間は奥まり、上には高い塊が 40 m 余りまで積み上がる。奥ほど壁が少しずつ下がって
 * 通りが広がり、正面の高い壁（局所 z = -71.7）に細く高い扉（光る）と、上に空の切れ目がある。
 * 床は板石の通路で区切った浅い水盤（水深 0.12 m）で、通路の縁から水がかぶる。
 * 局所の座標: 目が原点・-z が奥（世界の南）・+x が右（世界の西）。数値の画素は参考画像 squareroom-0 で測った値。
 */
export const B = {
  /** 手前の通りの壁の面 x（画素の床の線から） */
  xl: -4.09,
  xr: 4.23,
  /** 中央の水盤の幅（板石の通路の内側の縁） */
  chL: -1.6,
  chR: 2.6,
  /** 奥の前庭 */
  plazaZ: -44,
  plazaXl: -7.4,
  plazaXr: 11.2,
  /** 正面の壁の面 */
  endZ: -71.7,
  /** 扉（x 範囲・高さ） */
  door: [1.75, 3.65, 6.1] as [number, number, number],
  /** 上の切れ目（x 範囲・下端の高さ） */
  slit: [1.6, 7.2, 16.9] as [number, number, number],
  /** 中央の水庭への口（局所 z。世界の z = 18） */
  mouthZ: 30 - BASIN.walk,
  top: 44,
};

export function buildB(env: Env, M: ZoneMats): { frame: Frame; blocks: LBox[] } {
  const v = VIEWS.v0;
  const f = new Frame(v.frame);
  const cam = localCam(v);
  const y0 = STREET - 0.3;
  const A: LBox[] = [];
  const add = (bx: LBox): LBox => {
    A.push(bx);
    return bx;
  };

  // ================= 左の壁（面は +x を向く） =================
  // L1: 手前の低い箱（側面 100〜235、上端 148）
  add(sideBlock(cam, { X: B.xl, side: 'L', near: 100, far: 235, top: 148, y0, back: 7 }));
  // 手前の口までの壁（参考画像の画角の外。L1 と同じ面）
  add({ min: [-12, y0, -6.0], max: [-5.6, 9, B.mouthZ] });
  // L4: L1 の奥の段（正面 237〜316、下端 500）。側面 x = -6.45 が 316〜400 に見える
  add(wallBlock(cam, { side: 'L', X: -6.45, x0: 237, x1: 316, top: 205, bot: 500, y0, depth: 3.6, ext: 6 }));
  // L1 と L4 の間の奥まった壁
  add({ min: [-14, y0, -14.1], max: [-7.6, 4.2, -7.5], kind: 'dark' });
  // L3: 低い箱（正面 408〜510、上端 255、側面 510〜530）
  add(wallBlock(cam, { side: 'L', X: -4.54, x0: 408, x1: 510, top: 255, bot: 478, y0, depth: 1.6, ext: 8 }));
  // L2: L1・L3 の上に載る大きな塊（側面 388〜470、下端 220）
  add(sideBlock(cam, { X: -4.6, side: 'L', near: 388, far: 470, top: -400, bot: 220, yTop: 26, back: 10 }));
  // L3 と L5 の間の奥まった壁（暗い）
  add({ min: [-14, y0, -31.3], max: [-7.0, 4.0, -19.3], kind: 'dark' });
  // L6: 奥まりの上の塊（正面 485〜545、上端 85）
  add(wallBlock(cam, { side: 'L', X: -5.0, x0: 485, x1: 545, top: 85, y0: 4.0, depth: 8, ext: 8 }));
  // L5: 奥の柱状の塊（正面 545〜595、上端 120、下端 440）
  add(wallBlock(cam, { side: 'L', X: -5.27, x0: 545, x1: 595, top: 120, bot: 440, y0, depth: 3.6, ext: 6 }));
  // L7: 奥の高い柱（正面 600〜625、側面が明るい）と、前庭の手前の塊（625〜660）
  add(wallBlock(cam, { side: 'L', X: -6.0, x0: 596, x1: 625, top: -200, bot: 425, y0, yTop: 34, depth: 6, ext: 6 }));
  add(wallBlock(cam, { side: 'L', X: -7.4, x0: 625, x1: 660, top: 50, bot: 418, y0, depth: 4, ext: 6 }));
  // 前庭の左の壁（正面の壁まで）
  add({ min: [B.plazaXl - 8, y0, B.endZ], max: [B.plazaXl, 30, -48] });

  // ================= 右の壁（面は -x を向く） =================
  // R1: 手前の高い壁（側面 1225〜1315、正面 1315〜は暗い）
  add(sideBlock(cam, { X: B.xr, side: 'R', near: 1315, far: 1225, top: -600, y0, yTop: 30, back: 8 }));
  add({ min: [5.6, y0, -7.5], max: [12, 12, B.mouthZ] });
  // R2: 低い箱（正面 1078〜1225、上端 245）と、その上の高い面（1095〜1315）
  const r2 = add(wallBlock(cam, { side: 'R', X: 4.25, x0: 1078, x1: 1225, top: 245, bot: 510, y0, depth: 6.4, ext: 6 }));
  add({ min: [4.6, r2.max[1], r2.min[2]], max: [12, 28, r2.max[2]] });
  // R1 と R2 の間（奥まった壁）
  add({ min: [6.3, y0, -13.3], max: [12, 4, -8.9], kind: 'dark' });
  // R4: 低い箱（正面 975〜1050、上端 210、下端 470）と、その上の R3（1008〜1095、上端 15）
  const r4 = add(wallBlock(cam, { side: 'R', X: 4.3, x0: 975, x1: 1050, top: 210, bot: 470, y0, depth: 5, ext: 6 }));
  add({ min: [4.95, r4.max[1], r4.min[2]], max: [12, 9.1, r4.max[2]] });
  add({ min: [6.0, 9.1, r4.min[2] - 2], max: [14, 30, r4.max[2]] });
  // 奥の右の壁（930〜975、900〜930、870〜900）。少しずつ下がる
  add(wallBlock(cam, { side: 'R', X: 4.95, x0: 930, x1: 975, top: 150, bot: 445, y0, depth: 9, ext: 6 }));
  add(wallBlock(cam, { side: 'R', X: 5.6, x0: 900, x1: 930, top: 240, bot: 430, y0, depth: 12, ext: 6 }));
  add(wallBlock(cam, { side: 'R', X: 5.9, x0: 870, x1: 900, top: 270, bot: 420, y0, depth: 9, ext: 6 }));
  add({ min: [7.2, 8, -52], max: [16, 34, -26] });
  // 前庭の右の壁
  add({ min: [B.plazaXr, y0, B.endZ], max: [B.plazaXr + 8, 30, -52] });

  // ================= 正面の壁（扉と上の切れ目） =================
  const ez = B.endZ;
  const [dx0, dx1, dh] = B.door;
  const [sx0, sx1, sy] = B.slit;
  add({ min: [B.plazaXl - 8, y0, ez - 6], max: [dx0, sy, ez] });
  add({ min: [dx1, y0, ez - 6], max: [B.plazaXr + 8, sy, ez] });
  add({ min: [dx0, dh, ez - 6], max: [dx1, sy, ez] });
  add({ min: [B.plazaXl - 8, sy, ez - 6], max: [sx0, B.top, ez] });
  add({ min: [sx1, sy, ez - 6], max: [B.plazaXr + 8, B.top, ez] });

  // ================= 写っていない所・上の方（決まりで積む） =================
  const hide = [cam];
  const gen = [
    stackWall({ side: 'L', X: B.xl, z0: -44, z1: B.mouthZ, yBase: y0, top: B.top, seed: 11, avoid: A, hide, hideNear: 40 }),
    stackWall({ side: 'R', X: B.xr, z0: -44, z1: B.mouthZ, yBase: y0, top: B.top, seed: 12, avoid: A, hide, hideNear: 40 }),
  ];
  // 背中の詰め物（どこにも積まれなかった所から空が見えないように）
  add({ min: [-22, y0, B.endZ - 6], max: [-10.5, B.top - 6, B.mouthZ], kind: 'dark' });
  add({ min: [10.5, y0, B.endZ - 6], max: [22, B.top - 6, B.mouthZ], kind: 'dark' });

  for (const bx of A) place(env, f, bx.kind === 'dark' ? M.dark : M.wall, bx);
  const sides: ('L' | 'R')[] = ['L', 'R'];
  gen.forEach((g, i) => {
    if (sides[i]) for (const bx of g.blocks) env.faces.push({ f, box: bx, side: sides[i] });
  });
  for (const g of gen) {
    for (const bx of g.blocks) place(env, f, M.wall, bx);
    for (const w of g.windows) place(env, f, w.kind === 'lit' ? env.glow('#d8e6d8') : env.voidMat, w, { collide: false, shadow: false });
  }
  // 張り出しの下のリブ（決まり）
  overhangRibs(env, f, () => M.wall, gen[0].blocks, B.xl, 'L');
  overhangRibs(env, f, () => M.wall, gen[1].blocks, B.xr, 'R');
  stackDress(env, f, gen[0], 'L', () => M.wall, 91);
  stackDress(env, f, gen[1], 'R', () => M.wall, 92);
  place(env, f, env.glow('#f2f8ee', false), { min: [dx0 - 0.4, y0, ez - 7.0], max: [dx1 + 0.4, dh + 0.4, ez - 6.5] }, { collide: true, shadow: false });

  // 描いた影: 上の切れ目から差す真南の日が通りの床に細い日なたを落とさないように（参考画像の通りは日陰で、明るいのは空の照り返し）、
  // 切れ目の奥（外の湖の上・ずっと高い所）に影だけを落とす板
  // 通り全体も日陰の谷（参考画像に日なたが無い）: 積んだ塊の隙間から日が床に落ちないように、高い所（47 m）に影だけの板
  {
    const w = f.box([-14, 47, B.endZ - 90], [16, 48, B.mouthZ]);
    env.b.shadowCaster([(w.min[0] + w.max[0]) / 2, 47.5, (w.min[2] + w.max[2]) / 2], [w.max[0] - w.min[0], 1, w.max[2] - w.min[2]]);
  }
  {
    const w = f.box([sx0 - 2, sy, ez - 30], [sx1 + 2, B.top + 30, ez - 28]);
    env.b.shadowCaster([(w.min[0] + w.max[0]) / 2, (w.min[1] + w.max[1]) / 2, (w.min[2] + w.max[2]) / 2], [w.max[0] - w.min[0], w.max[1] - w.min[1], w.max[2] - w.min[2]]);
  }

  // 通りの壁の足元（決まり）: 手で置いた箱の目の高さの面に沿って。参考画像の視点から見える面は空き、
  // 張り出した箱の陰（奥まった所・箱の奥の面）にだけ戸口・窓・設備が付く（sight.ts の隠れの判定）
  const faceOf = (side: 'L' | 'R') => (za: number, zb: number): number | null => {
    const yy = STREET + 1.5;
    const cov = A.filter((b) => (side === 'L' ? b.max[0] < 0 : b.min[0] > 0) && b.min[1] <= yy && b.max[1] >= yy && b.max[2] > za && b.min[2] < zb);
    if (!cov.length) return null;
    // いちばん通りに近い面（その面の箱が区切りを覆うときだけ）
    const fs = cov.map((b) => (side === 'L' ? b.max[0] : b.min[0]));
    const front = side === 'L' ? Math.max(...fs) : Math.min(...fs);
    let z = za;
    for (const b of cov.filter((_, i) => Math.abs(fs[i] - front) < 0.05).sort((p, q) => p.min[2] - q.min[2])) if (b.min[2] <= z + 0.01) z = Math.max(z, b.max[2]);
    return z < zb - 0.01 ? null : front;
  };
  frontage(env, { f, X: B.xl, facing: 1, z0: -44, z1: -6, floor: STREET + 0.03, maxOut: 0.6, seed: 85, wall: M.wall, voidMat: env.voidMat, face: faceOf('L'), upper: 3.6, lampEvery: 7 });
  frontage(env, { f, X: B.xr, facing: -1, z0: -44, z1: -7.5, floor: STREET + 0.03, maxOut: 0.6, seed: 86, wall: M.wall, voidMat: env.voidMat, face: faceOf('R'), upper: 3.6, lampEvery: 7 });
  // 口の近くと前庭の壁の足元（決まり）
  frontage(env, { f, X: -5.6, facing: 1, z0: -6, z1: B.mouthZ - 0.5, floor: STREET + 0.03, maxOut: 0.8, seed: 75, wall: M.wall, voidMat: env.voidMat, lampEvery: 8 });
  frontage(env, { f, X: 5.6, facing: -1, z0: -7.5, z1: B.mouthZ - 0.5, floor: STREET + 0.03, maxOut: 0.8, seed: 76, wall: M.wall, voidMat: env.voidMat, lampEvery: 8 });
  frontage(env, { f, X: B.plazaXl, facing: 1, z0: B.endZ + 0.5, z1: -48, floor: STREET + 0.03, maxOut: 1.0, seed: 77, wall: M.wall, voidMat: env.voidMat, lampEvery: 8 });
  frontage(env, { f, X: B.plazaXr, facing: -1, z0: B.endZ + 0.5, z1: -52, floor: STREET + 0.03, maxOut: 1.0, seed: 78, wall: M.wall, voidMat: env.voidMat, lampEvery: 8 });

  // ================= 床: 板石の通路と浅い水盤 =================
  const flood = M.flood ?? M.floor;
  // 板石の通路は上面の板だけ（水面から 1 cm。横の面を作らない: 水面との境に細い線が出ないように）。当たり判定は箱で
  const path = (x0: number, z0: number, x1: number, z1: number, rag: number): void => {
    const w = f.box([x0, STREET - 0.3, z0], [x1, STREET + 0.01, z1]);
    const sx = w.max[0] - w.min[0];
    const sz = w.max[2] - w.min[2];
    const g = tagFlood(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), sx, sz, rag);
    env.b.mesh(g, flood, [(w.min[0] + w.max[0]) / 2, w.max[1], (w.min[2] + w.max[2]) / 2], { layer: 1, shadow: 'receive' });
    env.ctx.colliders.add({ x: w.min[0], y: w.min[1], z: w.min[2] }, { x: w.max[0], y: w.max[1], z: w.max[2] });
  };
  // 両側の通路（壁の下まで）。内側の縁は画素の明るい帯の端から（左 -2.6・右 +2.8。手前の右は水をかぶる）
  path(-9, B.plazaZ, -2.6, -7.6, 0.75);
  path(-9, -7.6, -3.3, B.mouthZ, 0.5);
  path(2.8, B.plazaZ, 12, -8.0, 0.75);
  path(3.4, -8.0, 12, B.mouthZ, 1.2);
  // 手前の横の板石（z -7.5。真ん中は水。参考画像の 592〜608 の行）
  path(-2.6, -7.9, -1.75, -7.1, 0.25);
  path(0.08, -7.9, 2.8, -7.1, 0.25);
  // 横の通路（水盤を区切る。画素の明るい帯 535・508・470・440 の行から。-20.5 は中ほどが切れる）
  for (const [x0, x1, z, w] of [
    [-2.6, 2.8, -10.9, 1.0],
    [-2.6, 2.8, -13.4, 0.6],
    [-2.6, -0.2, -20.5, 0.9],
    [1.0, 2.8, -20.5, 0.9],
    [-2.6, 2.8, -31.0, 1.2],
    [-2.6, 2.8, -39.0, 1.0],
    [-3.3, 3.4, 5.0, 1.2],
  ] as [number, number, number, number][]) {
    path(x0, z - w / 2, x1, z + w / 2, 0.3);
  }
  // 前庭: 両側と正面の壁ぎわの通路、横の通路
  path(B.plazaXl - 1, B.endZ - 1, B.plazaXr + 1, B.endZ + 3, 0.9);
  path(B.plazaXl - 1, B.endZ + 3, -1.0, B.plazaZ, 0.9);
  path(5.5, B.endZ + 3, B.plazaXr + 1, B.plazaZ, 0.9);
  for (const z of [-50, -58]) path(-1.0, z - 0.6, 5.5, z + 0.6, 0.35);
  // 水盤の底（歩ける。浅い）
  const bed = f.box([B.plazaXl, STREET - 0.6, B.endZ], [B.plazaXr, STREET - 0.12, B.mouthZ]);
  const bb = env.ctx.colliders.add({ x: bed.min[0], y: bed.min[1], z: bed.min[2] }, { x: bed.max[0], y: bed.max[1], z: bed.max[2] }, 0.8);
  bb.depth = 0.12;
  waterPlane(env, f, M.water, [B.plazaXl - 1, B.endZ - 1, B.plazaXr + 1, B.mouthZ]);
  return { frame: f, blocks: A };
}
