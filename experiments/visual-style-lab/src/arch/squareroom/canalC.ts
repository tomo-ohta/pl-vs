import type * as THREE from 'three';
import { wallBlock, type LBox } from './author.ts';
import { place, waterPlane, type Env, type ZoneMats } from './env.ts';
import { Frame } from './frame.ts';
import { BASIN, BED, VIEWS, WALK, localCam } from './layout.ts';
import { frontage } from './frontage.ts';
import { gateWalls } from './gates.ts';
import { overhangRibs } from './soffit.ts';
import { stackDress } from './upper.ts';
import { stackEnd, stackWall } from './stack.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import { sqPropMats } from './props/mats.ts';
import { canopy, ivyCurtain, shrub } from './props/plants.ts';

/**
 * C: 日の差す水路と飛び石（squareroom-3 の視点。中央の水庭から北へ）。
 * 左（西）の岸は幅 1.5 m の歩廊（高さ 0.25 m）で、その奥の壁から低い箱（高さ 2.5〜4 m）が並んで突き出し、南南東からの日が
 * 箱の正面と歩廊を照らす（日は水庭の上から水路の口へ差し込む。口の近くの東の壁は低い）。
 * 右（東）は暗い高い壁（x = 3.3）に沿って長い飛び石の箱（幅 2.1 m・高さ 0.3 m）が並ぶ。右上には 5.9 m の高さで水路の上へ張り出す塊。
 * 正面（局所 z = -90）に高さ 9.4 m の門があり、外の湖と段々が見える。門の上は霞む高い塊。
 * 局所の座標: 目が原点・-z が奥（世界の北）・+x が右（世界の東）。数値の画素は参考画像 squareroom-3 で測った値。
 */
export const C = {
  /** 左の歩廊（奥の縁・水際） */
  walkBack: -7.2,
  walkEdge: -5.7,
  walkTop: 0.25,
  /** 右の壁の面と飛び石の列 */
  wallR: 3.3,
  stepX: [0.85, 2.95] as [number, number],
  endZ: -90,
  gate: [-4.6, 3.2, 9.4] as [number, number, number],
  /** 門の奥の抜けの広がり（左右・上） */
  gateWd: 1.0,
  gateSh: 1.2,
  mouthZ: 30 - BASIN.walk,
  top: 44,
};

export function buildC(env: Env, M: ZoneMats): { frame: Frame; blocks: LBox[] } {
  const v = VIEWS.v3;
  const f = new Frame(v.frame);
  const cam = localCam(v);
  const L: LBox[] = [];
  const add = (bx: LBox): LBox => {
    L.push(bx);
    return bx;
  };
  const y0 = BED;
  const X = C.walkBack;
  const wt = C.walkTop;

  // ================= 左の岸: 歩廊と、奥の壁から突き出す低い箱（日の当たる正面） =================
  const walk: LBox = { min: [X - 3, y0, C.endZ], max: [C.walkEdge, wt, C.mouthZ] };
  // 奥の壁（暗い。箱の間に見える）
  add({ min: [X - 10, y0, C.endZ], max: [X - 1.4, 4.4, C.mouthZ], kind: 'dark' });
  // B1（正面 215〜335、上端 385）とその上の細い箱（290〜335、上端 285）
  // 低い箱の正面には日だまり（下の lit）。B2（350〜415、上端 435）・B3（460〜495、上端 350）・B4（612〜650、上端 420）。間は奥まる
  const lit: LBox[] = [];
  const b1 = add(wallBlock(cam, { side: 'L', X, x0: 215, x1: 335, top: 385, y0: wt, depth: 0.4, ext: 1.5 }));
  lit.push(b1);
  lit.push(add({ min: [b1.min[0] + 0.9, b1.max[1], b1.min[2]], max: [X, 4.25, b1.max[2]] }));
  lit.push(add(wallBlock(cam, { side: 'L', X: X + 0.3, x0: 350, x1: 415, top: 435, y0: wt, depth: 1.4, ext: 1.6 })));
  lit.push(add(wallBlock(cam, { side: 'L', X: X + 0.15, x0: 460, x1: 495, top: 350, y0: wt, depth: 1.6, ext: 1.6 })));
  add(wallBlock(cam, { side: 'L', X, x0: 612, x1: 650, top: 420, y0: wt, depth: 2.5, ext: 1.6 }));
  // 左上の暗い箱の積み重ね（参考画像 0〜620・0〜210 の段々の暗い箱）。一つの大きな張り出しにせず、
  // 幅 2〜5 m の箱を下端 4.4〜6.2 m・面 -6.2〜-7.0 で段々に（下の縁が段になって見える）。上の段も面をずらす
  for (const [z0, z1, yb, yt, fx] of [
    [-8.0, C.mouthZ, 4.4, 8.0, -6.3],
    [-10.0, -8.0, 5.2, 8.8, -6.9],
    [-12.8, -10.0, 4.8, 8.4, -6.4],
    [-15.5, -12.8, 6.0, 9.6, -6.8],
    [-18.7, -15.5, 5.5, 9.1, -6.6],
    [-9.0, C.mouthZ, 8.0, 11.6, -6.8],
    [-13.5, -9.0, 8.4, 12.0, -6.2],
    [-18.7, -13.5, 9.1, 12.7, -7.0],
    [-12.0, C.mouthZ, 11.6, 16.0, -7.3],
    [-18.7, -12.0, 12.0, 16.0, -6.7],
  ] as [number, number, number, number, number][]) {
    add({ min: [X - 9, yb, z0], max: [fx, yt, z1] });
  }
  // 段の奥（箱の間に見える下面の奥）
  add({ min: [X - 9, 4.4, -18.7], max: [-7.4, 16, C.mouthZ], kind: 'dark' });
  add({ min: [X - 9, 5.5, -20.5], max: [X - 1.2, 16, -18.7], kind: 'dark' });
  // 上の日の当たる箱（620〜665、125〜340）と、その奥の明るい塊（665〜760、0〜300）
  lit.push(add(wallBlock(cam, { side: 'L', X, x0: 620, x1: 665, top: 125, bot: 340, depth: 3.6, ext: 4 })));
  add({ min: [X - 9, 6.4, -31.2], max: [-6.0, 19.7, -24.5] });
  add({ min: [X - 9, 4.4, -24.5], max: [X - 1.4, 6.4, -20.5] });
  add({ min: [X - 9, 4.4, -60], max: [-6.6, 9.0, -31.2] });
  // 奥の高い箱の上の植え込み（参考画像 750〜880・0〜110 の緑。屋上庭園の縁から茂みと蔦が垂れる）
  const planter = add({ min: [X - 9, 9.0, -48], max: [-6.4, 22.0, -41] });

  // ================= 右の岸: 暗い壁と飛び石 =================
  add({ min: [C.wallR, y0, -32], max: [C.wallR + 8, 5.85, C.mouthZ] });
  // 右上の大きな張り出し（前の縁 z = -11.7・下端 5.85 m・x = 0.9 まで）
  add({ min: [0.9, 5.85, -12.6], max: [C.wallR + 8, 9.5, -11.7] });
  add({ min: [C.wallR + 0.6, 5.85, -16.5], max: [C.wallR + 8, 9.5, -12.6] });
  // 張り出しの上は奥へ下がる暗い壁（画角の右上の暗い塊）
  add({ min: [C.wallR + 1.2, 9.5, -24], max: [C.wallR + 8, 30, -11.7] });
  add({ min: [C.wallR + 0.4, 5.85, -32], max: [C.wallR + 8, 9.5, -16.5] });
  // 水庭への口の上の楣（まぐさ。12〜22 m）: 低い所は日陰。日は楣の上を越えて奥の高い箱の南の面に当たる
  add({ min: [-12, 12, 6], max: [12, 22, C.mouthZ] });
  // 口の近くの東の壁は低い（日が水庭の上から差し込む）
  add({ min: [C.wallR + 1.8, 5.85, -11.7], max: [C.wallR + 8, 12, C.mouthZ] });
  // 飛び石の列（参考画像の段 628〜660・598〜612・570〜590 から）
  const steps: LBox[] = [];
  for (const [z0, z1] of [
    [-10.5, -5.5],
    [-16.6, -12.6],
    [-24.0, -19.0],
    [-33.0, -28.5],
    [-42, -37],
    [-52, -47],
    [-62, -57],
    [-72, -67],
    [-1.0, 3.5],
    [5.5, 10],
  ] as [number, number][]) {
    steps.push({ min: [C.stepX[0], y0, z0], max: [C.stepX[1], WALK, z1] });
  }

  // ================= 正面の壁と門 =================
  const ez = C.endZ;
  const [gx0, gx1, gh] = C.gate;
  // 正面の枠（厚さ 0.6 m）の奥は左右と上へ広い水門の抜け（gates.ts。参考画像の視点からは枠の陰）
  for (const bx of gateWalls({ ez, depth: 6, x0: gx0, x1: gx1, h: gh, wd: C.gateWd, sh: C.gateSh, xl: -20, xr: 16, top: 14, lintelTop: gh + 1.2, y0 })) add(bx);
  // 門の抜け（奥行き 6 m）の先は外の湖

  // ================= 写っていない所・上の方・奥（決まりで積む） =================
  const hide = [cam];
  const gen = [
    stackWall({ side: 'L', X: X - 1.4, z0: C.endZ, z1: C.mouthZ, yBase: 4.4, top: C.top, seed: 31, avoid: L, hide, hideNear: 34, clearUnder: 6, maxOut: 3 }),
    // 東の岸の奥（z < -32）は霞む段々の塊（参考画像の右奥の明るい箱の重なり）
    stackWall({ side: 'R', X: C.wallR + 0.6, z0: C.endZ, z1: -32, yBase: WALK, top: C.top, seed: 32, avoid: L, hide, hideNear: 26, clearUnder: 6, maxOut: 2 }),
    stackWall({ side: 'R', X: C.wallR + 1.8, z0: -30, z1: C.mouthZ, yBase: 12, top: 22, seed: 33, avoid: L, hide, hideNear: 34, maxOut: 0 }),
    // 門の上の霞む塊（正面の壁の面から奥へ段々に）
    stackEnd({ Z: ez - 6, x0: -20, x1: 16, yBase: C.gate[2] + 1.2, top: 50, seed: 34, avoid: L, hide, hideNear: 34, maxOut: 0, windows: 0.15 }),
  ];
  add({ min: [-26, y0, C.endZ - 6], max: [X - 9, C.top - 6, C.mouthZ], kind: 'dark' });
  add({ min: [C.wallR + 9, y0, C.endZ - 6], max: [20, C.top - 6, -30], kind: 'dark' });

  // 右（東）の岸は日の当たらない青い壁（wall2）
  // 西の岸の高い所（4 m より上）は東を向く暗い面（参考画像の左上の暗い箱の積み重ね）
  const wallOf = (bx: LBox): THREE.Material =>
    bx.kind === 'dark' ? M.dark : bx.min[0] > 0 && M.wall2 ? M.wall2 : bx.max[0] < 0 && bx.min[1] >= 4 && M.upper ? M.upper : M.wall;
  for (const bx of L) place(env, f, lit.includes(bx) && M.sunlit ? M.sunlit : wallOf(bx), bx);
  // 飛び石は東の高い壁の陰で暗い（上面にも日が当たらない）
  for (const bx of steps) place(env, f, M.dark, bx);
  place(env, f, M.floor, walk);
  const sides: ('L' | 'R')[] = ['L', 'R', 'R'];
  gen.forEach((g, i) => {
    if (sides[i]) for (const bx of g.blocks) env.faces.push({ f, box: bx, side: sides[i] });
  });
  for (const g of gen) {
    for (const bx of g.blocks) place(env, f, wallOf(bx), bx);
    for (const w of g.windows) place(env, f, w.kind === 'lit' ? env.glow('#d8e6d8') : env.voidMat, w, { collide: false, shadow: false });
  }
  // 張り出しの下のリブ（決まり）
  overhangRibs(env, f, wallOf, gen[0].blocks, X - 1.4, 'L');
  overhangRibs(env, f, wallOf, gen[1].blocks, C.wallR + 0.6, 'R');
  overhangRibs(env, f, wallOf, gen[2].blocks, C.wallR + 1.8, 'R');
  stackDress(env, f, gen[0], 'L', wallOf, 93);
  stackDress(env, f, gen[1], 'R', wallOf, 94);
  stackDress(env, f, gen[2], 'R', wallOf, 95);
  // 日だまり（描いた光）: 水庭の上を越えて差し込む低い日が、西の岸の低い箱の南の正面と歩廊を照らす（参考画像の明るい面）。
  // 一つの太陽ではこの形にならない（上の箱は日陰で低い箱だけ明るい）ので、箱の南の正面は材質で（M.sunlit）、歩廊は灯りで塗る
  const sunPatch = (bx: [number, number, number, number, number, number], pos: [number, number, number], intensity: number): void => {
    const w = f.box([bx[0], bx[1], bx[2]], [bx[3], bx[4], bx[5]]);
    env.ctx.addLamp({ pos: f.p(...pos), radius: 40, intensity, color: '#f1eedd', box: [...w.min, ...w.max], square: true, hard: true, shadow: 0 });
  };
  // 歩廊の日だまり（120〜680、580〜655 の帯）
  sunPatch([X - 0.2, wt - 0.1, -28, C.walkEdge + 0.05, wt + 0.15, -7.5], [X + 1, 10, -18], 1.9);
  // 描いた影: 奥の門の上の高い塊は日陰（参考画像では霞んだ青）。高い所（46 m）に影だけを落とす板
  {
    const w = f.box([-24, 46, C.endZ - 40], [20, 47, -75]);
    env.b.shadowCaster([(w.min[0] + w.max[0]) / 2, 46.5, (w.min[2] + w.max[2]) / 2], [w.max[0] - w.min[0], 1, w.max[2] - w.min[2]]);
  }
  // 植え込みの緑（茂み 3 つ・縁から垂れる蔦）
  {
    const sink = builderSink(env.b, env.ctx);
    const mats = sqPropMats(env.ctx);
    const top = planter.max[1];
    // 樹冠（参考画像 750〜890・10〜120 の明るい葉の塊）と、縁の茂み
    canopy(Prop.at(sink, mats, f.p(-6.4, top, -46), 0, 901), 6.5, 5.0);
    for (const [x, z] of [
      [-7.2, -42.4],
      [-7.6, -47.6],
    ] as [number, number][]) {
      shrub(Prop.at(sink, mats, f.p(x, top, z), 0, 900 + Math.round(z * 10)), 1.8, 1.3);
    }
    for (const z of [-46.5, -44.5, -42.6]) ivyCurtain(Prop.at(sink, mats, f.p(-6.38, top, z), f.yawW(Math.PI / 2), 950 + Math.round(z * 10)), 1.6, 3.5);
  }
  // 西の歩廊の奥の壁（決まり。小部屋の扉の前は空ける）
  frontage(env, { f, X: X - 1.4, facing: 1, z0: C.endZ + 1, z1: C.mouthZ - 1, floor: wt, maxOut: 0.9, seed: 73, wall: M.wall, voidMat: env.voidMat, skip: [[-1.8, 1.8]], upper: 4.4, lampEvery: 9 });
  const bed = f.box([C.walkEdge, BED - 0.3, C.endZ - 6], [C.wallR, BED, C.mouthZ]);
  const bb = env.ctx.colliders.add({ x: bed.min[0], y: bed.min[1], z: bed.min[2] }, { x: bed.max[0], y: bed.max[1], z: bed.max[2] }, 0.55);
  bb.depth = -BED;
  waterPlane(env, f, M.water, [C.walkEdge, C.endZ - 6, C.wallR, C.mouthZ]);
  // 門の抜けの広がった所の水面（右の縁の段の手前まで）
  waterPlane(env, f, M.water, [C.wallR, C.endZ - 6, C.gate[1] + C.gateWd, C.endZ - 0.6]);
  return { frame: f, blocks: L };
}
