import type * as THREE from 'three';
import type { LBox } from './author.ts';
import { place, waterPlane, type Env, type ZoneMats } from './env.ts';
import { Frame } from './frame.ts';
import { BASIN, BED, WALK } from './layout.ts';
import { stackWall } from './stack.ts';
import { frontage } from './frontage.ts';
import { colonnadeBeams, overhangRibs } from './soffit.ts';
import { cqBox } from './env.ts';
import { stainOf } from './mats.ts';
import { builderSink, Prop } from '../../props/kit.ts';
import { conduitRun, downpipe } from './props/wall.ts';
import { stackDress } from './upper.ts';
import { STAIR_CLERESTORY, TERRACE } from './rooms.ts';

/**
 * 中央の四角い水庭（参考画像には写らない。4 枚の視点はどれもこれを背にしている）。
 * 水面 28 × 28 m（深さ 0.45 m）のまわりに幅 4 m の歩廊（高さ 0.3 m）。中央に 6 × 6 m の四角い島（squareroom の名の「四角い広間」の芯）と、
 * 島へ渡る飛び石。四方の壁は積み上げた箱で、4 本の水路の口が風車形に開く（口の上は高さ 12 m の楣）:
 * 北の西寄りに C、東の北寄りに A、南の東寄りに B、西の南寄りに D。南の壁の西には階段室と、水庭へ張り出す屋上テラス（rooms.ts）。
 * 座標は世界のまま（x 東・z 南）。
 */
export const MOUTHS = {
  /** 北の壁の開口（x 範囲）= C */
  n: [-18.8, -5.3] as [number, number],
  /** 東の壁の開口（z 範囲）= A */
  e: [-20.3, 2.7] as [number, number],
  /** 南の壁の開口（x 範囲）= B */
  s: [3.4, 14.6] as [number, number],
  /** 西の壁の開口（z 範囲）= D */
  w: [3.1, 19.6] as [number, number],
};
/** 口の上の楣の下端 */
export const LINTEL = 12;
/** 水面の半分の幅（BASIN.water） */
const R0 = BASIN.water;

/** 水へ下りる段（歩廊 0.3 → 0.05 → -0.2 → 底 -0.45）。dir は水の方へ */
export function waterSteps(env: Env, m: THREE.Material, x: number, z: number, w: number, dir: '+x' | '-x' | '+z' | '-z'): void {
  const f = new Frame({ k: 0, ox: 0, oz: 0 });
  for (let i = 0; i < 2; i++) {
    const top = WALK - 0.25 * (i + 1);
    const a = 0.6 * i;
    const b = 0.6 * (i + 1);
    let bx: LBox;
    if (dir === '+x') bx = { min: [x + a, BED, z - w / 2], max: [x + b, top, z + w / 2] };
    else if (dir === '-x') bx = { min: [x - b, BED, z - w / 2], max: [x - a, top, z + w / 2] };
    else if (dir === '+z') bx = { min: [x - w / 2, BED, z + a], max: [x + w / 2, top, z + b] };
    else bx = { min: [x - w / 2, BED, z - b], max: [x + w / 2, top, z - a] };
    place(env, f, m, bx, { collide: true });
  }
}


/** 水庭の回廊: 屋根の板の下面の高さ・柱の列（水際からの距離） */
export const ARCADE = { y: 3.9, col: R0 + 0.5 };

/**
 * 水庭の四方の歩廊の回廊（口を除く）。壁の局所の座標（壁の面 x = X、歩廊は水の方へ）で、柱・屋根の板・梁。
 * 東西の壁の回廊は、南北の回廊の屋根と重ならないように |z| ≤ 屋根の内の縁 まで
 */
function arcade(env: Env, f: Frame, M: ZoneMats, X: number, side: 'L' | 'R', gap: [number, number], short: boolean): void {
  const s = side === 'L' ? 1 : -1;
  const W = BASIN.walk;
  const cx = s * -ARCADE.col; // 柱の列（局所の x）
  const inner = cx + s * 0.25; // 屋根の内の縁
  const z0 = short ? -(ARCADE.col - 0.25) : -W;
  const z1 = short ? ARCADE.col - 0.25 : W;
  const ga = gap[0] - 0.2;
  const gb = gap[1] + 0.2;
  const steps = [9, -9];
  const cols: [number, number][] = [];
  for (let z = -W + 1.6; z <= W - 1.4; z += 4.2) {
    if (z > ga - 0.4 && z < gb + 0.4) continue;
    if (steps.some((t) => Math.abs(z - t * (s < 0 ? -1 : 1)) < 2.0 || Math.abs(z - t) < 2.0)) continue;
    if (Math.abs(z) > ARCADE.col - 0.3 && short) continue;
    cols.push([z - 0.25, z + 0.25]);
    place(env, f, M.wall, { min: [Math.min(cx - 0.25, cx + 0.25), WALK, z - 0.25], max: [Math.max(cx - 0.25, cx + 0.25), ARCADE.y, z + 0.25] }, { collide: true });
  }
  const xa = Math.min(X, inner);
  const xb = Math.max(X, inner);
  for (const [a, b] of [
    [z0, Math.min(z1, ga)],
    [Math.max(z0, gb), z1],
  ] as [number, number][]) {
    if (b - a < 0.5) continue;
    place(env, f, M.wall, { min: [xa, ARCADE.y, a], max: [xb, ARCADE.y + 0.4, b] }, { collide: false });
    // 屋根の先の縁の立ち上がり（水切り）
    place(env, f, M.wall, { min: [Math.min(inner, inner - s * 0.25), ARCADE.y + 0.4, a], max: [Math.max(inner, inner - s * 0.25), ARCADE.y + 0.75, b] }, { collide: false });
  }
  colonnadeBeams(env, f, M.dark, { x0: X, x1: inner, cols, y: ARCADE.y, depth: 0.4 });
}

/** 中央の島の東屋（4 本の柱・屋根の板・梁・下の長椅子は dress.ts） */
function pavilion(env: Env, M: ZoneMats): void {
  const f = new Frame({ k: 0, ox: 0, oz: 0 });
  const h = 3.4;
  for (const [x, z] of [
    [-2.3, -2.3],
    [2.3, -2.3],
    [-2.3, 2.3],
    [2.3, 2.3],
  ] as [number, number][])
    place(env, f, M.wall, { min: [x - 0.2, WALK, z - 0.2], max: [x + 0.2, h, z + 0.2] }, { collide: true });
  place(env, f, M.wall, { min: [-2.9, h, -2.9], max: [2.9, h + 0.35, 2.9] }, { collide: false });
  place(env, f, M.wall, { min: [-3.0, h + 0.35, -3.0], max: [3.0, h + 0.5, 3.0] }, { collide: false });
  for (const z of [-2.3, 2.3]) place(env, f, M.dark, { min: [-2.5, h - 0.35, z - 0.15], max: [2.5, h, z + 0.15] }, { collide: false });
}

export function buildBasin(env: Env, M: ZoneMats): void {
  const W = BASIN.walk;
  const R = BASIN.water;
  const top = 40;
  const fz = new Frame({ k: 0, ox: 0, oz: 0 });
  // 北・南の壁は、局所の z が世界の -x になる向き（k = 3）
  const fx = new Frame({ k: 3, ox: 0, oz: 0 });

  // 歩廊（水面のまわり）
  // （水路の歩廊と重ならないように、四方の壁の面 ±W まで）
  const walk: LBox[] = [
    { min: [-W, BED, -W], max: [W, WALK, -R] },
    { min: [-W, BED, R], max: [W, WALK, W] },
    { min: [-W, BED, -R], max: [-R, WALK, R] },
    { min: [R, BED, -R], max: [W, WALK, R] },
  ];
  for (const bx of walk) place(env, fz, M.floor, bx);
  waterPlane(env, fz, M.water, [-R, -R, R, R]);
  const bed = env.ctx.colliders.add({ x: -R, y: BED - 0.3, z: -R }, { x: R, y: BED, z: R }, 0.55);
  bed.depth = -BED;

  // 中央の四角い島（6 × 6 m・高さ 0.3）と東屋。南北へ渡る飛び石は dress.ts（欠けた打ち放しの塊の小物）
  place(env, fz, M.floor, { min: [-3, BED, -3], max: [3, WALK, 3] });
  pavilion(env, M);
  // 水へ下りる段（四方の歩廊から・島から）
  waterSteps(env, M.floor, 9, -R, 3, '+z');
  waterSteps(env, M.floor, -9, R, 3, '-z');
  waterSteps(env, M.floor, R, 9, 3, '-x');
  waterSteps(env, M.floor, -R, -9, 3, '+x');
  waterSteps(env, M.floor, 3, 0, 2, '+x');
  waterSteps(env, M.floor, -3, 0, 2, '-x');

  // 四方の壁（口を避けて決まりで積む。口の上は楣）
  // 南の壁は低い（屋上テラスの 12.7 m。後ろの塊も 20 m まで）: 南南東の日が水庭の北半分と北の壁に当たる（水庭の光の言葉: 日なたの壁と水）
  const walls = [
    { f: fz, side: 'L' as const, X: -W, gap: MOUTHS.w, seed: 51, top, back: top - 4 },
    { f: fz, side: 'R' as const, X: W, gap: MOUTHS.e, seed: 52, top, back: top - 4 },
    { f: fx, side: 'L' as const, X: -W, gap: [-MOUTHS.n[1], -MOUTHS.n[0]] as [number, number], seed: 53, top, back: top - 4 },
    { f: fx, side: 'R' as const, X: W, gap: [-MOUTHS.s[1], -MOUTHS.s[0]] as [number, number], seed: 54, top: TERRACE.y, back: 20 },
  ];
  // テラスの東の端から見える B の口の楣の西の面（x = 3.4・z 18〜24・12〜18 m）: 住戸の窓 2 つ（額縁・窓台・窓台の下の染み）・竪樋・電線管
  {
    const fw = new Frame({ k: 0, ox: 0, oz: 0 });
    const X = MOUTHS.s[0];
    const st = stainOf(env.ctx, M.wall);
    const sink = builderSink(env.b, env.ctx);
    for (const zc of [19.6, 22.3]) {
      const [z0, z1, y0, y1] = [zc - 0.6, zc + 0.6, 13.5, 14.9];
      env.b.boxMM(env.voidMat, [X - 0.012, y0, z0], [X + 0.02, y1, z1], { shadow: 'receive' });
      cqBox(env.b, M.wall, [X - 0.1, y0, z0 - 0.12], [X, y1 + 0.12, z0], { shadow: true });
      cqBox(env.b, M.wall, [X - 0.1, y0, z1], [X, y1 + 0.12, z1 + 0.12], { shadow: true });
      cqBox(env.b, M.wall, [X - 0.1, y1, z0], [X, y1 + 0.12, z1], { shadow: true });
      cqBox(env.b, M.wall, [X - 0.16, y0 - 0.08, z0 - 0.2], [X, y0, z1 + 0.2], { shadow: true });
      env.b.boxMM(st, [X - 0.006, y0 - 1.6, z0 - 0.1], [X - 0.002, y0 - 0.08, z1 + 0.1], { shadow: 'receive' });
    }
    const yaw = fw.yawW(-Math.PI / 2);
    downpipe(Prop.at(sink, env.props.out, [X, 12.75, 20.95], yaw, 5901), 5.0);
    conduitRun(Prop.at(sink, env.props.out, [X, 0, 21.0], yaw, 5902), 5.2, 16.3, { boxEvery: 2.6 });
  }

  // 屋上テラスの奥の壁（階段室の北の面。12.7〜16 m）にも壁の足元の決まり（扉の所は空ける）
  frontage(env, { f: new Frame({ k: 1, ox: 0, oz: 0 }), X: -19.2, facing: 1, z0: -15.3, z1: -2.7, floor: TERRACE.y, ceil: 16.0, maxOut: 0.8, seed: 59, wall: M.wall, voidMat: env.voidMat, skip: [[-5.5, -2.7], ...STAIR_CLERESTORY.map((x) => [x - 0.75, x + 0.75] as [number, number])], lampEvery: 6 });
  for (const w of walls) {
    const s = w.side === 'L' ? -1 : 1; // 壁の外へ向かう向き
    // 口の両脇は 0.15 m 広く避ける（水路の壁の面と同じ面に積んだ箱の面が重なって、ちらつかないように）
    const avoid: LBox[] = [{ min: [w.X - 30, BED - 1, w.gap[0] - 0.15], max: [w.X + 30, LINTEL, w.gap[1] + 0.15] }];
    const g0 = stackWall({ side: w.side, X: w.X, z0: -W - 2, z1: W + 2, yBase: WALK, top: w.top, seed: w.seed, avoid, clearUnder: 4.5, maxOut: w.top < 20 ? 1.8 : 4.5 });
    // 目の高さの窓（と窓台）は壁の足元の決まり（frontage）が作るので、積んだ箱の低い窓は除く
    const low = (b: LBox): boolean => b.min[1] < WALK + 3.4;
    const lowWin = g0.windows.filter(low);
    const g = {
      windows: g0.windows.filter((wn) => !low(wn)),
      blocks: g0.blocks.filter((b) => !(b.max[1] - b.min[1] < 0.2 && lowWin.some((wn) => Math.abs(b.max[1] - wn.min[1]) < 0.02 && b.max[2] > wn.min[2] && b.min[2] < wn.max[2]))),
    };
    for (const bx of g.blocks) place(env, w.f, M.wall, bx);
    for (const wn of g.windows) place(env, w.f, wn.kind === 'lit' ? env.glow('#d8e6d8') : env.voidMat, wn, { collide: false, shadow: false });
    overhangRibs(env, w.f, () => M.wall, g.blocks, w.X, w.side);
    stackDress(env, w.f, g, w.side, () => M.wall, w.seed + 40);
    // 歩廊の奥の壁の足元（決まり）。口の所と、南の壁の階段室の扉（x -6〜-2.2）は空ける
    const skip: [number, number][] = [[w.gap[0] - 0.5, w.gap[1] + 0.5]];
    if (w.f === fx && w.side === 'R') skip.push([2.0, 6.2]);
    // 低い段の箱は奥まることがあるので、区切りごとに実際の壁の面（目の高さの箱の面）に置く。箱の間の溝・積んだ箱の窓の所は空ける
    const face = (za: number, zb: number): number | null => {
      const yy = WALK + 2.0;
      const cov = g.blocks.filter((b) => b.max[1] - b.min[1] > 1 && b.min[1] <= yy && b.max[1] >= yy && b.max[2] > za && b.min[2] < zb);
      if (g.windows.some((wn) => wn.min[1] < WALK + 3.2 && wn.max[2] > za - 0.2 && wn.min[2] < zb + 0.2)) return null;
      let z = za;
      for (const b of [...cov].sort((p, q) => p.min[2] - q.min[2])) if (b.min[2] <= z + 0.01) z = Math.max(z, b.max[2]);
      if (z < zb - 0.01) return null;
      const fs = cov.map((b) => (w.side === 'L' ? b.max[0] : b.min[0]));
      if (Math.max(...fs) - Math.min(...fs) > 0.05) return null;
      return fs[0];
    };
    frontage(env, { f: w.f, X: w.X, facing: w.side === 'L' ? 1 : -1, z0: -W + 0.5, z1: W - 0.5, floor: WALK, ceil: ARCADE.y, maxOut: 1.0, seed: w.seed + 30, wall: M.wall, voidMat: env.voidMat, skip, face, lampEvery: 8.4 });
    // 回廊（決まり: 水際から 0.5 m の柱の列 4.2 m ごと・屋根の板・柱ごとの梁。口と水へ下りる段の所は空ける）
    arcade(env, w.f, M, w.X, w.side, w.gap, w.f === fz);
    // 口の上の楣（下端 12 m）
    place(env, w.f, M.wall, { min: [Math.min(w.X, w.X + s * 6), LINTEL, w.gap[0]], max: [Math.max(w.X, w.X + s * 6), LINTEL + 6, w.gap[1]] });
    // 背中の詰め物（壁の外側）
    const x0 = w.X + s * 9;
    const x1 = w.X + s * 18;
    const segs: [number, number][] = [
      [-W - 9, w.gap[0] - 0.15],
      [w.gap[1] + 0.15, W + 9],
    ];
    for (const [a, b] of segs) if (b - a > 0.5) place(env, w.f, M.dark, { min: [Math.min(x0, x1), BED, a], max: [Math.max(x0, x1), w.back, b] });
    // 低い南の壁の奥: 詰め物の水庭を向く面にも箱を積む（テラス・水庭から見上げる 12.7〜24 m。窓・張り出しの下のリブ・窓台の下の染み）
    if (w.top < 20) {
      const g2 = stackWall({ side: w.side, X: x0 - s * 0.02, z0: -W - 2, z1: W + 2, yBase: w.top, top: 24, seed: w.seed + 7, avoid, clearUnder: w.top + 3.6, maxOut: 3.6, depth: 4, windows: 0.8 });
      for (const bx of g2.blocks) place(env, w.f, M.wall, bx);
      for (const wn of g2.windows) place(env, w.f, wn.kind === 'lit' ? env.glow('#d8e6d8') : env.voidMat, wn, { collide: false, shadow: false });
      overhangRibs(env, w.f, () => M.wall, g2.blocks, x0 - s * 0.02, w.side, { yMax: 24 });
      stackDress(env, w.f, g2, w.side, () => M.wall, w.seed + 47, { yMax: 24 });
    }
  }
}
