import type * as THREE from 'three';
import { sideBlock, type LBox } from './author.ts';
import { carve } from './carve.ts';
import { place, waterPlane, type Env, type ZoneMats } from './env.ts';
import { Frame } from './frame.ts';
import { frontage } from './frontage.ts';
import { BASIN, BED, VIEWS, localCam } from './layout.ts';
import { overhangRibs } from './soffit.ts';
import { stackDress } from './upper.ts';
import { stackWall } from './stack.ts';

/**
 * D: 細く暗い水路（squareroom-1 の視点。中央の水庭から西へ）。
 * 水路（幅 6.4 m）の両側に高さ 0.35 m の歩廊。歩廊には排水の升（暗い長方形の穴）が並ぶ。
 * 左（南）は高さ 2.6 m の暗い回廊の上に箱が積まれて水路へ張り出す。右（北）は高く暗い壁で、奥まった窪み・縦の溝・張り出しの下面が並ぶ。
 * 正面（局所 z = -46.4）の壁の足元に水際の扉（光る）、上に縦長の窓と、右上に空の切れ目。
 * 局所の座標: 目が原点・-z が奥（世界の西）・+x が右（世界の北）。数値の画素は参考画像 squareroom-1 で測った値。
 */
export const D = {
  wl: -3.2,
  wr: 1.6,
  walkTop: 0.35,
  /** 左の張り出しの面と下端・足元の壁の面（張り出しより 1 m 奥）・回廊の奥の壁 */
  overL: -5.0,
  baseL: -6.0,
  underL: 2.6,
  backL: -9.0,
  /** 右の壁の面 */
  wallR: 5.5,
  endZ: -46.4,
  door: [-1.77, 1.29, 3.24] as [number, number, number],
  /** 正面の壁の上の切れ目（x 範囲・下端） */
  slit: [2.15, 4.7, 16] as [number, number, number],
  mouthZ: 30 - BASIN.walk,
  top: 44,
};

export function buildD(env: Env, M: ZoneMats): { frame: Frame; blocks: LBox[] } {
  const v = VIEWS.v1;
  const f = new Frame(v.frame);
  const cam = localCam(v);
  const L: LBox[] = [];
  const add = (bx: LBox): LBox => {
    L.push(bx);
    return bx;
  };
  const y0 = BED;
  const wt = D.walkTop;

  // ================= 歩廊（水際に水の入る切り欠き。参考画像の歩廊の暗い長方形） =================
  const walkL: LBox = { min: [D.backL - 1, y0, D.endZ], max: [D.wl, wt, D.mouthZ] };
  const walkR: LBox = { min: [D.wr, y0, D.endZ], max: [D.wallR + 1, wt, D.mouthZ] };
  // 画素の切り欠き: 左 (150〜275, 655〜672)・(320〜430, 615〜630)・奥、右 (1110〜1290, 660〜710)・(870〜1000, 615〜630)・奥
  const notches: LBox[] = [
    { min: [-4.2, BED - 0.5, -7.6], max: [D.wl + 0.01, wt + 0.1, -6.5] },
    { min: [-4.65, BED - 0.5, -12.3], max: [D.wl + 0.01, wt + 0.1, -9.9] },
    { min: [-4.0, BED - 0.5, -19.8], max: [D.wl + 0.01, wt + 0.1, -16.4] },
    { min: [-4.4, BED - 0.5, -30.5], max: [D.wl + 0.01, wt + 0.1, -26.0] },
    { min: [D.wr - 0.01, BED - 0.5, -7.6], max: [2.75, wt + 0.1, -5.2] },
    { min: [D.wr - 0.01, BED - 0.5, -12.6], max: [2.4, wt + 0.1, -10.3] },
    { min: [D.wr - 0.01, BED - 0.5, -21.5], max: [2.3, wt + 0.1, -17.0] },
    { min: [D.wr - 0.01, BED - 0.5, -33.0], max: [2.6, wt + 0.1, -28.5] },
  ];

  // ================= 左（面は +x）: 足元の壁と奥まった戸口、その上の張り出し =================
  // 足元の壁（面 x = -5.0、高さ 2.6 m まで）に奥まった暗い戸口（画素 115〜235 = z -8.9〜-10.8 など。奥行き 2〜4 m）。
  // z -12.4〜-14.2 の戸口の奥はポンプ室の扉（世界の z = 18.6）
  const voids: LBox[] = [];
  const doorways: [number, number, number][] = [
    [-10.8, -8.9, 2.4],
    [-14.2, -12.2, 4.2],
    [-17.2, -15.6, 2.2],
    [-23.8, -22.0, 2.2],
    [-30.6, -29.0, 2.2],
    [-37.4, -35.8, 2.2],
    [2.6, 4.4, 2.2],
  ];
  add({ min: [D.backL - 6, y0, D.endZ], max: [D.backL, D.underL, D.mouthZ], kind: 'dark' });
  {
    const zs = doorways.map((d) => [d[0], d[1]] as [number, number]).sort((a, b) => a[0] - b[0]);
    let z = D.endZ;
    for (const [a, c] of zs) {
      if (a > z) add({ min: [D.backL, y0, z], max: [D.baseL, D.underL, a] });
      z = c;
    }
    add({ min: [D.backL, y0, z], max: [D.baseL, D.underL, D.mouthZ] });
    // 戸口の奥（暗い）。ポンプ室への戸口（深さ 4.2 m）のほかは、0.4 m の抱きの奥を暗い穴で塞ぐ（住戸の暗い玄関）
    for (const [a, c, dep] of doorways) {
      add({ min: [D.backL, y0, a], max: [D.baseL - dep, D.underL, c], kind: 'dark' });
      if (dep < 3) voids.push({ min: [D.baseL - dep, y0, a], max: [D.baseL - 0.4, D.underL - 0.25, c] });
    }
  }
  // 張り出しの下端の縁 (115,358)〜(345,420)。面 x = -5.0、下端 2.6 m。上の箱（345〜535、上端 225、側面 460〜535 が明るい）
  add({ min: [D.backL - 6, D.underL, -11.0], max: [D.overL, 4.9, D.mouthZ] });
  add(sideBlock(cam, { X: -4.3, side: 'L', near: 460, far: 535, top: 225, y0: D.underL, back: 12 }));
  add({ min: [D.backL - 6, D.underL, -46.4], max: [-5.6, 6.0, -20.0] });
  // 左上の高い壁（0〜555、0〜225）
  add({ min: [D.backL - 6, 4.9, -11.0], max: [-5.4, 30, D.mouthZ] });
  // BX の上は奥まる・U1（正面 447〜515・上端 25、側面 515〜555: z -18.9〜-22.7、高さ 8.6〜11.4）・その下は奥まる
  add({ min: [D.backL - 6, 5.6, -18.9], max: [-6.2, 30, -11.0] });
  add({ min: [D.backL - 6, 8.6, -22.7], max: [-5.4, 11.4, -18.9] });
  add({ min: [D.backL - 6, D.underL, -23.0], max: [-6.6, 8.6, -17.1], kind: 'dark' });
  add({ min: [D.backL - 6, 11.4, -26.9], max: [-6.4, 30, -18.9] });
  // T1: 奥へ向かう面（555〜620: z -23〜-32.8、高さ 3〜11）と、その上の U2（572〜605、16〜17.5 m）
  add({ min: [D.backL - 6, 3.0, -32.8], max: [-5.4, 11.0, -23.0] });
  add({ min: [D.backL - 6, 11.0, -32.8], max: [-6.6, 16.0, -26.9] });
  add({ min: [D.backL - 6, 16.0, -32.2], max: [-6.0, 30, -26.9] });
  add({ min: [D.backL - 6, 11.0, -40], max: [-7.0, 30, -32.2] });
  // 奥の低い塊（600〜622、425〜500: z -32.5〜-37.4、3〜5.3 m）
  add({ min: [D.backL - 6, D.underL, -37.4], max: [-6.0, 5.3, -32.8] });
  add({ min: [D.backL - 6, 5.3, -40], max: [-6.8, 11.0, -32.8], kind: 'dark' });
  // 奥の左の塊（z = -40〜-46.4。その右の正面の壁に窓 632〜658、370〜453）
  add({ min: [D.backL - 6, y0, -46.4], max: [-7.1, 30, -40] });

  // ================= 右（面は -x）: 高く暗い壁 =================
  add({ min: [D.wallR, y0, D.endZ], max: [D.wallR + 8, 34, D.mouthZ] });
  // 窪み（1120〜1205、85〜420）・溝（985〜1025）・窪み（915〜955）: 奥まった暗い面（壁の面から 0.9 m）
  const niches: LBox[] = [
    { min: [D.wallR - 0.02, 2.8, -16.1], max: [D.wallR + 0.9, 7.1, -12.2] },
    { min: [D.wallR - 0.02, 2.9, -25.8], max: [D.wallR + 0.9, 7.9, -22.4] },
    { min: [D.wallR - 0.02, 6.6, -38.6], max: [D.wallR + 0.9, 12.7, -30.6] },
  ];
  // 張り出し（900〜935、70〜215）: 12.7 m から上へ、水路の上へ 1.5 m
  add({ min: [D.wallR - 1.5, 12.7, -41.6], max: [D.wallR + 8, 22.3, -33.5] });
  add({ min: [D.wallR - 0.9, 7.1, -12.2], max: [D.wallR + 8, 12, -5] });

  // ================= 正面の壁（扉・窓・切れ目） =================
  const ez = D.endZ;
  const [dx0, dx1, dh] = D.door;
  const [sx0, sx1, sy] = D.slit;
  add({ min: [-16, y0, ez - 5], max: [dx0, sy, ez] });
  add({ min: [dx1, y0, ez - 5], max: [14, sy, ez] });
  add({ min: [dx0, dh, ez - 5], max: [dx1, sy, ez] });
  add({ min: [-16, sy, ez - 5], max: [sx0, D.top, ez] });
  add({ min: [sx1, sy, ez - 5], max: [14, D.top, ez] });

  // ================= 写っていない所・上の方（決まりで積む） =================
  const hide = [cam];
  const gen = [
    stackWall({ side: 'L', X: D.overL, z0: D.endZ, z1: D.mouthZ, yBase: 4.9, top: D.top, seed: 41, avoid: L, hide, hideNear: 32, clearUnder: 4.9 }),
    stackWall({ side: 'R', X: D.wallR, z0: D.endZ, z1: D.mouthZ, yBase: D.walkTop, top: D.top, seed: 42, avoid: L, hide, hideNear: 32, clearUnder: 4.5 }),
  ];
  add({ min: [-24, y0, D.endZ - 6], max: [D.backL - 5, D.top - 6, D.mouthZ], kind: 'dark' });
  add({ min: [D.wallR + 7, y0, D.endZ - 6], max: [22, D.top - 6, D.mouthZ], kind: 'dark' });

  // 右（北）の岸は南を向くが、南の高い壁の陰で日が届かない暗い壁（wall2）
  const wallOf = (bx: LBox): THREE.Material => (bx.kind === 'dark' ? M.dark : bx.min[0] > 0 && M.wall2 ? M.wall2 : M.wall);
  for (const bx of L) place(env, f, wallOf(bx), bx);
  for (const bx of niches) place(env, f, M.dark, bx, { collide: false });
  for (const bx of voids) place(env, f, env.voidMat, bx, { collide: true });
  for (const bx of carve([walkL, walkR], notches)) place(env, f, M.floor, bx);
  const sides: ('L' | 'R')[] = ['L', 'R'];
  gen.forEach((g, i) => {
    if (sides[i]) for (const bx of g.blocks) env.faces.push({ f, box: bx, side: sides[i] });
  });
  for (const g of gen) {
    for (const bx of g.blocks) place(env, f, wallOf(bx), bx);
    for (const w of g.windows) place(env, f, w.kind === 'lit' ? env.glow('#d8e6d8') : env.voidMat, w, { collide: false, shadow: false });
  }
  // 張り出しの下のリブ（決まり）
  overhangRibs(env, f, wallOf, gen[0].blocks, D.overL, 'L');
  overhangRibs(env, f, wallOf, gen[1].blocks, D.wallR, 'R');
  stackDress(env, f, gen[0], 'L', wallOf, 96);
  stackDress(env, f, gen[1], 'R', wallOf, 97);
  // 光る開口: 扉の奥・正面の壁の縦長の窓（700〜740、260〜365）・左の窓（632〜658、370〜453）
  place(env, f, env.glow('#eef4e4', false), { min: [dx0 - 0.4, y0, ez - 6], max: [dx1 + 0.4, dh + 0.4, ez - 5] }, { collide: true, shadow: false });
  place(env, f, env.glow('#cfe3e4'), { min: [-3.8, 9.9, ez + 0.0], max: [-1.85, 15.15, ez + 0.03] }, { collide: false, shadow: false });
  place(env, f, env.glow('#d4e6e2'), { min: [-7.04, 5.7, ez], max: [-5.74, 9.7, ez + 0.03] }, { collide: false, shadow: false });
  // 北の歩廊の奥の壁の足元（決まり）。参考画像の視点からは暗い壁なので、目から 26 m より遠い所と背中側
  frontage(env, { f, X: D.wallR, facing: -1, z0: D.endZ + 1, z1: D.mouthZ - 1, floor: D.walkTop, maxOut: 1.0, seed: 74, wall: M.wall2 ?? M.wall, voidMat: env.voidMat, lampEvery: 9, near: 26 });
  // 南の暗い回廊の奥の壁（決まり。天井が低いので戸口は作らない。手で置いた戸口の前は空ける）
  frontage(env, { f, X: D.baseL, facing: 1, z0: D.endZ + 1, z1: D.mouthZ - 1, floor: wt, ceil: D.underL, maxOut: 0.5, seed: 79, wall: M.wall, voidMat: env.voidMat, skip: doorways.map(([a, c]) => [a - 0.3, c + 0.3] as [number, number]), lampEvery: 9, near: 26 });
  const bed = f.box([D.wl, BED - 0.3, D.endZ], [D.wr, BED, D.mouthZ]);
  const bb = env.ctx.colliders.add({ x: bed.min[0], y: bed.min[1], z: bed.min[2] }, { x: bed.max[0], y: bed.max[1], z: bed.max[2] }, 0.55);
  bb.depth = -BED;
  waterPlane(env, f, M.water, [-4.8, D.endZ - 5, 2.9, D.mouthZ]);
  return { frame: f, blocks: L };
}
