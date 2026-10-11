import type * as THREE from 'three';
import type { LBox } from './author.ts';
import { place, waterPlane, type Env, type ZoneMats } from './env.ts';
import { Frame } from './frame.ts';
import { frontage } from './frontage.ts';
import { BASIN, BED, VIEWS, WALK, localCam } from './layout.ts';
import { gateWalls } from './gates.ts';
import { colonnadeBeams, undersideRibs } from './soffit.ts';
import { stackEnd, stackWall } from './stack.ts';

/**
 * A: 柱の歩廊の大運河（squareroom-2 の視点。中央の水庭から東へ）。
 * 水路（幅 8.3 m）の両側に高さ 0.3 m の歩廊。歩廊は柱の並ぶ回廊（天井 3.5〜3.8 m）で、その上に箱が積まれて水路へ張り出す。
 * 左（北）の箱は南を向くので日が当たる（明るい側面に型枠の目地）。右（南）の箱は北を向いて暗い。
 * 正面（局所 z = -50）の壁の足元に四角い開口（外の湖へ）。開口の上は段々に下がる高い塊が霞む。
 * 局所の座標: 目が原点・-z が奥（世界の東）・+x が右（世界の南）。数値は参考画像 squareroom-2 の輪郭（docs/stages/squareroom.md）から。
 */
export const A = {
  /** 水路の縁 */
  wl: -3.7,
  wr: 4.6,
  /** 回廊: 柱の外側の面・天井・奥の壁 */
  colL: [-5.7, -5.1] as [number, number],
  colR: [5.9, 6.6] as [number, number],
  roofL: 3.5,
  roofR: 3.8,
  backL: -11,
  backR: 12,
  endZ: -50,
  /** 開口（x 範囲・上端） */
  gate: [-1.16, 2.11, 2.66] as [number, number, number],
  /** 開口の奥の抜けの広がり（左右・上） */
  gateWd: 1.0,
  gateSh: 0.7,
  mouthZ: 30 - BASIN.walk,
  top: 46,
};

export function buildA(env: Env, M: ZoneMats): { frame: Frame; blocks: LBox[] } {
  const v = VIEWS.v2;
  const f = new Frame(v.frame);
  const cam = localCam(v);
  const L: LBox[] = [];
  const add = (bx: LBox): LBox => {
    L.push(bx);
    return bx;
  };
  const y0 = BED;

  // ================= 歩廊と回廊 =================
  const walkL: LBox = { min: [A.backL - 1, y0, A.endZ], max: [A.wl, WALK, A.mouthZ] };
  const walkR: LBox = { min: [A.wr, y0, A.endZ], max: [A.backR + 1, WALK, A.mouthZ] };
  // 柱（左 5.8 m・右 4.1 m おき。画素の柱 220〜270（z = -11.5）/ 1296〜1380（z = -9.5）から）
  const cols: LBox[] = [];
  for (let z = -11.5 + 5.8 * 3; z > A.endZ + 2; z -= 5.8) cols.push({ min: [A.colL[0], WALK, z - 0.6], max: [A.colL[1], A.roofL, z] });
  // 右の柱は参考画像の柱の足元（1296〜1380・1157〜1200・1065〜1095・1010〜1030・940〜960）から z = -9.5・-13.1・-17・-21.3・-28.4、その先は 4.2 m おき
  const zr = [10.5, 6.3, 2.1, -2.1, -5.7, -9.5, -13.1, -17.0, -21.3, -24.9, -28.4];
  for (let z = -32.6; z > A.endZ + 2; z -= 4.2) zr.push(z);
  for (const z of zr) cols.push({ min: [A.colR[0], WALK, z - 0.7], max: [A.colR[1], A.roofR, z] });
  // 回廊の奥の壁（暗い）と天井の床板
  add({ min: [A.backL - 6, y0, A.endZ], max: [A.backL, A.roofL, A.mouthZ], kind: 'dark' });
  // 右の回廊の奥の壁は、向かいの日の当たる岸と水面の照り返しを受けて明るめ（kind 'lit'）
  add({ min: [A.backR, y0, A.endZ], max: [A.backR + 6, A.roofR, A.mouthZ] });
  // 回廊の天井は柱の列より奥（柱の上の箱の下面がそのまま天井。水路側に通しの梁の線を出さない）
  add({ min: [A.backL - 6, A.roofL, A.endZ], max: [-6.4, 3.9, A.mouthZ], kind: 'dark' });
  add({ min: [7.2, A.roofR, A.endZ], max: [A.backR + 6, 4.3, A.mouthZ], kind: 'dark' });

  // ================= 左の壁（面は +x を向く・南向きで日が当たる） =================
  // TL: 左上の大きな箱（側面の下の縁 (0,85)〜(235,230)。面 x = -7.0、下端 5.4 m、z = -14.2 まで）
  add({ min: [A.backL - 4, 5.4, -14.2], max: [-7.0, 22, A.mouthZ] });
  // TL の下（回廊の上の奥まった段）
  add({ min: [A.backL - 4, 3.9, -14.2], max: [-7.6, 5.4, A.mouthZ], kind: 'dark' });
  // B2: 回廊の上の箱（正面 235〜357 は暗く、側面 357〜435 が明るい。面 x = -5.5、高さ 3.9〜8.0、z = -14.2〜-18.1）
  add({ min: [A.backL - 4, 3.9, -18.1], max: [-5.5, 8.0, -14.2] });
  // B2 の上の段（奥まる）
  add({ min: [A.backL - 4, 8.0, -21.6], max: [-7.0, 22, -14.2] });
  // B3: 側面 480〜525（上端 95・下端 245）: 面 x = -5.5、高さ 7.5〜12.9、z = -21.6〜-25.9
  add({ min: [A.backL - 4, 7.5, -25.9], max: [-5.5, 12.9, -21.6] });
  add({ min: [A.backL - 4, 3.9, -30], max: [-7.6, 7.5, -18.1], kind: 'dark' });
  // 低い張り出し（正面 355〜610、上端 350・下端 485。z = -30、水路の上へ 0.5 m）
  add({ min: [A.backL - 4, 2.6, -46], max: [-3.2, 6.6, -30] });
  // その上の高い塊（霞む。525〜685）
  add({ min: [A.backL - 4, 12.9, -34.8], max: [-5.5, 30, -21.6] });
  // 奥の左の高い所も段々の箱
  for (const [z0, z1, y0b, y1b, fx] of [
    [-40, -34.8, 6.6, 10.2, -6.0],
    [-48, -40, 6.6, 10.2, -7.2],
    [-38, -34.8, 10.2, 13.8, -7.0],
    [-48, -38, 10.2, 13.8, -5.8],
    [-42, -34.8, 13.8, 17.4, -6.2],
    [-48, -42, 13.8, 17.4, -7.4],
    [-37, -34.8, 17.4, 21, -7.6],
    [-48, -37, 17.4, 21, -6.4],
    [-44, -34.8, 21, 27, -6.8],
    [-48, -44, 21, 27, -6.0],
  ] as [number, number, number, number, number][]) {
    add({ min: [A.backL - 4, y0b, z0], max: [fx, y1b, z1] });
  }
  add({ min: [A.backL - 4, 6.6, -48], max: [-8.0, 27, -34.8], kind: 'dark' });

  // ================= 右の壁（面は -x を向く・北向きで暗い） =================
  // 張り出し: 下面の内側の縁 (990,225)〜(1092,122)。下端 6.5 m・x = 4.9 まで・z = -12.6〜-17.1
  add({ min: [4.9, 6.5, -17.1], max: [A.backR + 4, 9, -12.6] });
  // 張り出しの手前と上の暗い高い壁
  // 右の壁（日は真南から）: 手前（z > -14.2）は高く（画角の上の外。左の TL を日陰にする）、奥（z < -14.2）は 9.5 m まで（左の B2・B3 の側面に日が届く）
  add({ min: [6.3, 4.3, -12.6], max: [A.backR + 4, 36, A.mouthZ] });
  add({ min: [6.0, 11, -14.2], max: [A.backR + 4, 36, -12.6] });
  add({ min: [6.0, 9, -30], max: [A.backR + 4, 9.5, -14.2] });
  // 高い所の塊（16.5 m より上・画角の上の外）: B2・B3 の上の段を日陰にし、低い B2・B3 の側面だけに日が届く
  add({ min: [6.0, 18.5, -30], max: [9.0, 36, -14.2] });
  add({ min: [6.6, 6.5, -30], max: [A.backR + 4, 9, -17.1] });
  // 奥の大きな箱（正面 840〜1155・上端 180・下端 490 → z = -30、回廊の上）
  add({ min: [4.2, 4.3, -42], max: [A.backR + 4, 12.0, -30] });
  add({ min: [5.5, 4.3, -30], max: [A.backR + 4, 6.5, -17.1], kind: 'dark' });
  // 奥の右の高い所は段々の箱（参考画像 900〜1150・100〜300 の明暗の交互）: 面の出入り 0.6〜2.4 m・高さ 3.6 m ごと
  for (const [z0, z1, y0b, y1b, fx] of [
    [-36, -30, 12, 15.6, 5.2],
    [-42, -36, 12, 15.6, 6.6],
    [-48, -42, 12, 15.6, 5.6],
    [-34, -30, 15.6, 19.2, 7.0],
    [-40, -34, 15.6, 19.2, 5.4],
    [-48, -40, 15.6, 19.2, 6.8],
    [-38, -30, 19.2, 22.8, 5.8],
    [-48, -38, 19.2, 22.8, 7.4],
    [-35, -30, 22.8, 26, 6.6],
    [-48, -35, 22.8, 26, 5.6],
  ] as [number, number, number, number, number][]) {
    add({ min: [fx, y0b, z0], max: [A.backR + 4, y1b, z1] });
  }
  add({ min: [8.0, 12, -48], max: [A.backR + 4, 26, -30], kind: 'dark' });
  add({ min: [5.0, 4.3, -48], max: [A.backR + 4, 12.0, -42] });

  // ================= 正面の壁と開口 =================
  const ez = A.endZ;
  const [gx0, gx1, gh] = A.gate;
  // 正面の枠（厚さ 0.6 m）の奥は左右と上へ広い水門の抜け（gates.ts。参考画像の視点からは枠の陰）
  for (const bx of gateWalls({ ez, depth: 4, x0: gx0, x1: gx1, h: gh, wd: A.gateWd, sh: A.gateSh, xl: -14, xr: 16, top: 10.6, y0 })) add(bx);
  // 上の段（685〜840、260〜340: 10.6〜14.85 m）
  add({ min: [-14, 10.6, ez - 4], max: [16, 14.85, ez + 0.4] });
  // 開口の両脇の低い瓦礫の段（左 580〜700・右 860〜1010、525〜548）。暗い影絵
  add({ min: [-6.8, y0, ez + 0.4], max: [-1.2, 0.9, ez + 2.4], kind: 'dark' });
  add({ min: [-6.8, 0.9, ez + 0.4], max: [-3.2, 1.5, ez + 1.6], kind: 'dark' });
  add({ min: [-6.8, 1.5, ez + 0.4], max: [-5.0, 1.9, ez + 1.2], kind: 'dark' });
  add({ min: [2.4, y0, ez + 0.4], max: [14, 0.8, ez + 2.4], kind: 'dark' });
  add({ min: [4.0, 0.8, ez + 0.4], max: [14, 1.5, ez + 1.6], kind: 'dark' });
  add({ min: [7.5, 1.5, ez + 0.4], max: [14, 1.9, ez + 1.0], kind: 'dark' });

  // ================= 写っていない所・上の方・奥（決まりで積む） =================
  const hide = [cam];
  const gen = [
    stackWall({ side: 'L', X: -7.0, z0: A.endZ, z1: A.mouthZ, yBase: 22, top: A.top, seed: 21, avoid: L, hide, hideNear: 30, clearUnder: 4.5 }),
    stackWall({ side: 'R', X: 6.0, z0: A.endZ, z1: -30, yBase: 26, top: A.top, seed: 22, avoid: L, hide, hideNear: 30, clearUnder: 4.5 }),
    stackEnd({ Z: ez - 4, x0: -14, x1: 16, yBase: 14.85, top: 48, seed: 23, avoid: L, hide, hideNear: 30, maxOut: 0, windows: 0.15 }),
  ];
  add({ min: [-24, y0, A.endZ - 6], max: [A.backL - 4, A.top - 6, A.mouthZ], kind: 'dark' });
  add({ min: [A.backR + 4, y0, A.endZ - 6], max: [24, A.top - 6, -30], kind: 'dark' });
  add({ min: [A.backR + 4, y0, -30], max: [24, 9.5, -14.2], kind: 'dark' });
  add({ min: [A.backR + 4, y0, -14.2], max: [24, 36, A.mouthZ], kind: 'dark' });

  // 右（南）の岸は日の当たらない湿った打ち放し（wall2: 暗い）
  const wallOf = (bx: LBox): THREE.Material => (bx.kind === 'dark' ? M.dark : bx.kind === 'lit' ? M.wall : bx.min[0] > 0 && M.wall2 ? M.wall2 : M.wall);
  for (const bx of L) place(env, f, wallOf(bx), bx);
  for (const bx of cols) place(env, f, wallOf(bx), bx);
  place(env, f, M.floor, walkL);
  place(env, f, M.floor, walkR);
  const sides: ('L' | 'R')[] = ['L', 'R'];
  gen.forEach((g, i) => {
    if (sides[i]) for (const bx of g.blocks) env.faces.push({ f, box: bx, side: sides[i] });
  });
  for (const g of gen) {
    for (const bx of g.blocks) place(env, f, wallOf(bx), bx);
    for (const w of g.windows) place(env, f, w.kind === 'lit' ? env.glow('#d8e6d8') : env.voidMat, w, { collide: false, shadow: false });
  }
  // 小さな灯りの窓（1275〜1285・392〜400 など。回廊の奥の壁）
  for (const [x, y, z] of [
    [A.backR - 0.02, 2.4, -7.6],
    [A.backR - 0.02, 2.6, -15.0],
  ] as [number, number, number][]) {
    place(env, f, env.glow('#e8eadc'), { min: [x - 0.03, y, z], max: [x, y + 0.25, z + 0.25] }, { collide: false, shadow: false });
  }
  // 光だまり（灯り）: 左の回廊には右の箱の隙間を抜けた日（柱の正面・歩廊の帯）、右の回廊の奥の壁には水面に照り返した日の明るい斑。
  // 右の高い箱が左の上の箱を日陰にする形のまま、低い所にだけ日が届く（参考画像の明暗。一つの日の影では作れない）
  const patch = (bx: [number, number, number, number, number, number], pos: [number, number, number], intensity: number, hard = true, radius = 30): void => {
    const w = f.box([bx[0], bx[1], bx[2]], [bx[3], bx[4], bx[5]]);
    env.ctx.addLamp({ pos: f.p(...pos), radius, intensity, color: '#fff3df', box: [...w.min, ...w.max], square: true, hard, shadow: 0 });
  };
  // 柱の南の面と、その間の歩廊の縁の日だまり（柱の列の間を抜けた日。参考画像 220〜270・1296 の柱と、歩廊の 600〜640 の明るい所）
  // 手前の柱の正面の下半分の日なた（参考画像 220〜270 の柱: 下が明るく上は梁の陰。横の面は日陰のまま）
  {
    const w = f.box([A.colL[0] - 0.02, WALK, -11.6], [A.colL[1] + 0.02, 2.4, -11.4]);
    env.ctx.addLamp({ pos: f.p(-5.4, 1.4, -1.5), radius: 30, intensity: 1.15, color: '#e6eceb', box: [...w.min, ...w.max], square: true, hard: true, shadow: 0 });
  }
  // 右の奥の壁の斑（画素 1380〜1456・1200〜1296 → z -17.9〜-16・-24.6〜-20.5）
  for (const [z0, z1] of [
    [-17.9, -16.0],
    [-24.6, -20.5],
  ] as [number, number][]) {
    // 照り返しの斑は縁がぼける（灯りの中心を壁の面に置き、半径を斑の幅の半分ほどに）
    patch([A.backR - 0.3, 0.3, z0 - 1, A.backR + 0.05, 3.6, z1 + 1], [A.backR - 0.1, 1.8, (z0 + z1) / 2], 1.6, false, (z1 - z0) / 2 + 1.2);
  }
  // 歩廊の奥の壁の足元（決まり: 突き出した低い箱・暗い戸口・柱型）。南の回廊は管理室の扉の前を空ける
  // 回廊の奥の壁は参考画像の視点から暗く見えるので、目から 24 m より遠い所と背中側だけ
  frontage(env, { f, X: A.backL, facing: 1, z0: A.endZ + 1, z1: A.mouthZ - 1, floor: WALK, ceil: A.roofL, maxOut: 1.2, seed: 71, wall: M.wall, voidMat: env.voidMat, near: 24, lampEvery: 9 });
  frontage(env, { f, X: A.backR, facing: -1, z0: A.endZ + 1, z1: A.mouthZ - 1, floor: WALK, ceil: A.roofR, maxOut: 1.2, seed: 72, wall: M.wall2 ?? M.wall, voidMat: env.voidMat, skip: [[-1.4, 1.6]], near: 24, lampEvery: 9 });
  // 回廊の天井の梁（柱ごと・柱の間の小梁）。低い張り出し（2.6 m）の下は除く
  colonnadeBeams(env, f, M.dark, { x0: A.backL, x1: A.colL[1], cols: cols.filter((c) => c.min[0] < 0).map((c) => [c.min[2], c.max[2]] as [number, number]), y: A.roofL, near: 24, avoid: L });
  // 北の回廊の上へ低く張り出す箱（2.6 m）の下面のリブと水の側の縁の梁
  undersideRibs(env, f, M.dark, { x0: A.backL, x1: -3.2, z0: -46, z1: -30, y: 2.6, edgeX: -3.2, near: 24 });
  colonnadeBeams(env, f, M.dark, { x0: A.colR[0], x1: A.backR, cols: cols.filter((c) => c.min[0] > 0).map((c) => [c.min[2], c.max[2]] as [number, number]), y: A.roofR, near: 24, avoid: L });
  // 水路の底（歩ける。膝まで）
  const bed = f.box([A.wl, BED - 0.3, A.endZ - 4], [A.wr, BED, A.mouthZ]);
  const bb = env.ctx.colliders.add({ x: bed.min[0], y: bed.min[1], z: bed.min[2] }, { x: bed.max[0], y: bed.max[1], z: bed.max[2] }, 0.55);
  bb.depth = -BED;
  waterPlane(env, f, M.water, [A.wl, A.endZ - 4, A.wr, A.mouthZ]);
  return { frame: f, blocks: L };
}
