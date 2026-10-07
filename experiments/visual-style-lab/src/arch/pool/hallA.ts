import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { gobo, roofGobo, T, towardSun } from '../../scenes/pool/kit.ts';
import { CAM_A, SUN_A } from '../../scenes/pool/zoneA.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Frame } from './frame.ts';
import { perimeterWall, type HallEnv } from './hallkit.ts';
import { hallDress } from './halldress.ts';
import { clock, decal, deckBench, depthMark, drain, exitSign, lifeguardChair, plant, poolLadder, rescueBoard, wallNotice, type Dress } from './props.ts';

/**
 * ホール A「流れの回廊」（pool-0）。区域の座標 = 場面の座標（原点は pool-0 の視点の真下の水面）。
 * 南の入口のプールサイド（シャワー室から出てくる所）に立って北を見る。
 * 中央の水路（流れるプールの北へ向かう流れ）・西の深い水路（南へ向かう流れ）・その間の中島（台座と柱の列）・東の柱の列。
 * 梁の下 3.45 m・天井 4.4 m の低いホールで、梁の間に天窓の帯。見た目は元の版（src/scenes/pool/zoneA.ts）を写して、壁の内へ切った。
 */
export { CAM_A, SUN_A };

export interface HallAMats {
  deck: THREE.Material;
  deckDeep: THREE.Material;
  col: THREE.Material;
  ped: THREE.Material;
  colDeep: THREE.Material;
  beam: THREE.Material;
  beamDeep: THREE.Material;
  beamFar: THREE.Material;
  wall: THREE.Material;
  farWall: THREE.Material;
  glow: THREE.Material;
  dark: THREE.Material;
  bar: THREE.Material;
}

export function hallAMats(m: SceneContext['mat']): HallAMats {
  const tiles = (grout: string) => ({ size: T, line: 0.014, color: grout, jitter: 0.025 });
  const big = (c: string) => ({ size: 2 * T, line: 0.01, color: c, jitter: 0.015, broken: 0.35 });
  return {
    deck: m({ name: 'a-deck', color: '#e5f1da', hi: '#e8eedf', shade: '#4d7b78', dark: '#3b6a6a', tiles: tiles('#9fb0a2') }),
    col: m({ name: 'a-col', color: '#e7ebdc', hi: '#f5f5f1', shade: '#9db6a8', dark: '#5b8a85', tiles: big('#d3dccd') }),
    ped: m({ name: 'a-ped', color: '#e3ebd9', hi: '#e8eedf', shade: '#47706f', dark: '#416a6a', tiles: big('#d3dccd') }),
    deckDeep: m({ name: 'a-deckDeep', color: '#c5ccbc', hi: '#e8eedf', shade: '#1f494b', dark: '#274f53', tiles: tiles('#9fb0a2') }),
    colDeep: m({ name: 'a-colDeep', color: '#dfe7d9', hi: '#eef2e3', shade: '#264b4f', dark: '#244449', tiles: big('#c3cfc0') }),
    beamDeep: m({ name: 'a-beamDeep', color: '#b2baaa', hi: '#e8eedf', shade: '#385d5b', dark: '#345658', tiles: big('#c3cfc0') }),
    beam: m({ name: 'a-beam', color: '#eef3e7', hi: '#e8eedf', shade: '#86a592', dark: '#89ac9f', tiles: big('#c3cfc0') }),
    beamFar: m({ name: 'a-beamFar', color: '#eef3e7', hi: '#e8eedf', shade: '#6c9c92', dark: '#62948b', tiles: big('#c3cfc0') }),
    wall: m({ name: 'a-wall', color: '#e3eadb', hi: '#eef2e3', shade: '#7aa39c', dark: '#4f7d79', tiles: big('#c3cfc0') }),
    farWall: m({ name: 'a-farWall', color: '#7fa39d', unlit: true, tiles: { size: 2 * T, line: 0.01, color: '#759891' } }),
    glow: m({ name: 'a-glow', color: '#bcd2c8', unlit: true }),
    dark: m({ name: 'a-dark', color: '#2c5356', unlit: true }),
    bar: m({ name: 'a-bar', color: '#425f60', shade: '#425f60', dark: '#2f4c4f', hi: '#425f60' }),
  };
}

/** ホールの内側の西の端（西の壁の内面）。元の版の左の壁 x -19〜-18 */
const XW = -18;

export function buildHallA(env: HallEnv, m: HallAMats, dr: Dress): void {
  const k = env.k;
  const b = k.b;
  const TOP = 0.15;
  const BEAM0 = 3.45; // 梁の下端
  const CEIL = 4.4; // 梁の上端・天井の下面
  const SLAB = 4.8;

  // 通路（立っている所）と右奥の通路・左の水路の向こうの通路
  k.deck(m.deck, -2.0, -7.5, 22, 8, TOP);
  k.deck(m.deck, 7.0, -30, 22, -19, TOP);
  k.deck(m.deckDeep, XW, -36, -10.0, 8, TOP);

  // 底: 全体（東の浅い所）・左の水路は深め、中央の水路は浅め
  k.basin(-10, -36, 22, 8, -0.45);
  k.basin(-10, -36, -2.0, 8, -0.8);
  k.basin(-2.0, -36, 3.5, -7.5, -0.45);
  k.basin(-2.0, -36, 3.5, -16, -0.3);

  // 右の柱の列（奥行きの長い柱 x 3.5〜4.25）
  const fronts = [-6.25, -12.25, -18.25, -24.25, -30.25];
  for (const z of fronts) {
    if (z === -6.25) {
      k.column(m.col, 3.25, z - 0.5, 4.25, z, -2, BEAM0, { base: TOP, plinth: [[0.0, 0.25]] });
      k.box(m.col, [3.0, BEAM0 - 0.05, z - 0.4], [4.1, CEIL + 0.1, z + 0.35]);
      k.box(m.col, [2.8, BEAM0 + 0.25, z - 0.3], [3.25, CEIL - 0.1, z + 0.5]);
      k.box(m.col, [3.6, BEAM0 + 0.15, z - 0.3], [4.15, CEIL - 0.25, z + 0.55]);
      k.box(m.col, [3.25, CEIL - 0.35, z - 0.3], [3.6, CEIL + 0.1, z + 0.45]);
      b.boxMM(m.dark, [3.25, BEAM0 + 0.35, z + 0.36], [3.31, CEIL + 0.1, z + 0.52], { shadow: false });
      b.boxMM(m.dark, [2.7, CEIL - 0.05, z + 0.0], [3.6, CEIL + 0.02, z + 0.5], { shadow: false });
      b.boxMM(m.dark, [3.55, BEAM0 + 0.5, z + 0.4], [3.62, CEIL - 0.25, z + 0.6], { shadow: false });
      continue;
    }
    k.column(m.col, 3.5, z - 1.5, 4.25, z, -2, BEAM0, { base: 0, plinth: [[0.0, 0.25]] });
    k.greeble(m.col, m.dark, [3.25, BEAM0 - 1.0, z - 1.75], [4.5, BEAM0, z + 0.25], 4, { faces: ['x', '-x', 'z'], size: [0.25, 0.75], out: 0.25 });
  }
  // 左の台座（2 つ並ぶ）と細い柱・配管
  k.box(m.ped, [-4.5, -2, -14.0], [-2.75, 2.5, -12.5], { collide: true });
  k.box(m.colDeep, [-5.25, -2, -14.5], [-4.5, 2.5, -14.0], { collide: true });
  k.box(m.col, [-7.0, -2, -12.5], [-2.5, 0.05, -11.75], { collide: true });
  k.box(m.ped, [-6.75, -2, -13.75], [-5.25, 2.5, -12.25], { collide: true });
  b.boxMM(m.dark, [-4.4, 2.5, -13.4], [-3.9, 3.0, -12.9]);
  for (const x of [-6.4, -5.7, -3.2]) b.boxMM(m.dark, [x, 2.5, -13.0], [x + 0.06, BEAM0, -12.94], { shadow: 'cast' });
  for (const z of [-18.5, -24.5, -30.5]) k.column(m.colDeep, -3.75, z - 1.0, -2.75, z, -2, BEAM0);
  for (const z of [-12.5, -24.5]) k.column(m.colDeep, -8.0, z - 1.0, -7.0, z, -2, BEAM0);
  k.column(m.colDeep, -11.5, -12.0, -10.5, -11.0, -2, BEAM0);
  for (const z of [-18.25, -24.25, -30.25]) k.column(m.col, 9.75, z - 1.5, 11.25, z, -2, BEAM0);

  // 外周の壁（西: 屋外テラスへのガラス戸、北: C・D への通路の扉、東: B への扉と水の口、南: シャワー室・監視室）
  perimeterWall(env, 'A', 'w', m.colDeep, { y1: SLAB });
  perimeterWall(env, 'A', 'n', m.farWall, { y1: SLAB });
  perimeterWall(env, 'A', 'e', m.wall, { y1: SLAB });
  perimeterWall(env, 'A', 's', m.wall, { y1: SLAB });

  // 横の梁（柱の列ごと）
  for (const z of fronts) {
    k.box(m.beamDeep, [XW, BEAM0, z - 1.5], [-2.0, CEIL, z]);
    k.box(z < -6.25 ? m.beamFar : m.beam, [-2.0, BEAM0, z - 1.5], [22, CEIL, z]);
  }
  k.box(m.beam, [3.0, BEAM0 + 0.25, -36], [4.5, CEIL, -7.0]);
  k.box(m.beamDeep, [-5.0, BEAM0, -36], [-2.0, CEIL, -11.0], { shadow: 'receive' });
  k.box(m.beamDeep, [-5.0, BEAM0, -8.0], [-2.0, CEIL, 2], { shadow: 'receive' });
  k.box(m.beamDeep, [-5.0, BEAM0, -11.0], [-2.0, CEIL, -8.0], { shadow: 'receive' });
  k.box(m.beam, [9.75, BEAM0, -36], [11.25, CEIL, -3.5]);
  k.box(m.beamDeep, [-8.5, BEAM0, -36], [-7.0, CEIL, 8]);

  for (const z of fronts) {
    k.greeble(m.beam, null, [-2.0, BEAM0 + 0.25, z - 1.75], [12, CEIL - 0.25, z + 0.25], 6, { faces: ['z'], size: [0.25, 0.5], out: 0.25 });
    k.greeble(m.beamDeep, m.dark, [-16, BEAM0 - 0.25, z - 1.75], [-2.0, BEAM0 + 0.5, z + 0.25], 14, { faces: ['z', '-y'], size: [0.25, 0.5], out: 0.25 });
  }
  k.greeble(m.beamDeep, null, [-5.25, BEAM0 - 0.25, -36], [-2.0, BEAM0 + 0.4, 2], 0, { faces: ['-x', '-y', '-y'], size: [0.25, 0.5], out: 0.25 });
  k.greeble(m.beam, m.dark, [2.25, BEAM0 - 0.25, -36], [5.25, BEAM0 + 0.4, -6.25], 14, { faces: ['x', '-x', '-y'], size: [0.25, 0.75], out: 0.25 });
  for (const z of fronts) k.greeble(m.beam, m.dark, [-2.0, BEAM0 - 0.25, z - 1.75], [3.0, BEAM0, z + 0.25], 4, { faces: ['-y'], size: [0.25, 0.5], out: 0.25 });
  for (let z = -2; z > -34; z -= 2.5) {
    for (const x of [-1.9, -5.1]) b.boxMM(m.dark, [x, 1.9 + ((z * 7) % 3 === 0 ? 0.4 : 0.9), z - 0.03], [x + 0.06, BEAM0, z + 0.03], { shadow: 'cast' });
  }

  // 天井（天窓の所は開ける）
  const slab = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(z1 <= -6.25 ? m.beamFar : m.beam, [x0, CEIL, z0], [x1, SLAB, z1]);
  };
  const slabD = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(m.beamDeep, [x0, CEIL, z0], [x1, SLAB, z1]);
  };
  slabD(XW, -36, -13.5, 8);
  slabD(-10.0, -36, -8.5, 8);
  slabD(-7.0, -36, -2.0, -11.0);
  slabD(-7.0, -8.0, -2.0, 8);
  k.box(m.beamDeep, [-7.0, CEIL, -11.0], [-2.0, SLAB, -8.0], { shadow: 'receive' });
  slab(-2.0, -6.25, 2.75, 8);
  slab(-2.0, -36, 0.5, -11.75);
  slab(-2.0, -8.0, 0.5, -6.25);
  k.box(m.beamFar, [-2.0, CEIL, -11.75], [0.5, SLAB, -8.0], { shadow: 'receive' });
  slab(2.0, -36, 2.5, -6.25);
  slab(2.5, -36, 5.0, -12.25);
  slab(9.5, -36, 22, -12.25);
  for (let z = -36; z <= -12.25; z += 1.0) b.boxMM(m.bar, [5.0, CEIL, z - 0.05], [9.5, CEIL + 0.1, z + 0.05], { shadow: 'cast' });
  slab(2.5, -12.25, 5.0, -6.25);
  slab(12.0, -12.25, 22, -6.25);
  slab(2.5, -6.25, 5.0, -3.5);
  slab(2.75, -3.5, 6.0, -2.75);
  for (let z = -36; z <= -6.25; z += 0.75) b.boxMM(m.bar, [0.5, CEIL, z - 0.04], [2.0, CEIL + 0.1, z + 0.04], { shadow: 'cast' });
  for (let z = -36; z <= 8; z += 1.5) b.boxMM(m.bar, [-13.5, CEIL, z - 0.15], [-10.0, CEIL + 0.1, z + 0.15], { shadow: 'cast' });
  b.box(m.beam, [5.35, CEIL + 0.1, -1.3], [3.2, 0.2, 0.3], { rotY: -0.2 });
  b.box(m.beam, [12, CEIL + 0.1, 2.0], [18, 0.2, 0.3]);

  // ---- 写っていない所（南の帯・中島・柱と梁の続き・天窓のガラス・プールサイドの物） ----
  // 南の帯のプールサイド（シャワー室・監視室の前。西のプールサイドへ続く）
  k.deck(m.deck, XW, 8, 22, 12, TOP);
  // 中島（流れの内側の濡れた通路。台座と柱の列が立つ。北の端で流れが折り返す）
  k.deck(m.col, -6.75, -31.75, -2.75, -11.75, 0.05);
  // 中島の東の縁は浅い流れと同じ深さ（0.3 m。歩いて中島へ上がれる）
  k.basin(-2.75, -31.75, -2.0, -16, -0.3);
  // 南の柱の列と横の梁（視点の後ろ。柱の升目は北と同じ 6 m）
  for (const [x0, x1] of [[3.5, 4.25], [9.75, 11.25], [16.5, 18.0], [-8.0, -7.0], [-11.5, -10.5]] as [number, number][]) k.column(m.col, x0, 5.25, x1, 6.75, -2, BEAM0, { base: TOP, plinth: [[0.0, 0.25]] });
  k.box(m.beam, [XW, BEAM0, 5.25], [22, CEIL, 6.75]);
  // 縦の梁は手前の大きな天窓（ガラスの屋根）の所で止まり、南の梁の先だけ続く
  k.box(m.beam, [3.0, BEAM0 + 0.25, 6.75], [4.5, CEIL, 12]);
  k.box(m.beam, [9.75, BEAM0, 6.75], [11.25, CEIL, 12]);
  k.box(m.beamDeep, [-5.0, BEAM0, 2], [-2.0, CEIL, 12], { shadow: 'receive' });
  k.box(m.beamDeep, [-8.5, BEAM0, 8], [-7.0, CEIL, 12]);
  // 南の帯の屋根
  k.box(m.beam, [XW, CEIL, 8], [22, SLAB, 12]);
  // 手前の大きな天窓（x 2.75〜22・z -2.75〜8）のガラスの桟（細いので影は落とさない）
  for (let x = 4.0; x < 22; x += 1.5) b.boxMM(m.bar, [x - 0.04, SLAB - 0.1, -2.75], [x + 0.04, SLAB, 8], { shadow: false });
  for (const z of [0.5, 4.0]) b.boxMM(m.bar, [2.75, SLAB - 0.1, z - 0.04], [22, SLAB, z + 0.04], { shadow: false });

  // ---- 置く物（視点の画角の外: 後ろ・右の手前・左の手前） ----
  const F = (x: number, z: number, kk: number, y = TOP): Frame => new Frame(b, [x, y, z], kk);
  lifeguardChair(dr, F(14, -4.2, 2));
  poolLadder(dr, F(-6.0, 8.0, 2), 0.8);
  poolLadder(dr, F(-10.0, -1.5, 1), 0.8);
  poolLadder(dr, F(-10.0, -27.0, 1), 0.8);
  for (const x of [-14.5, -9.5, 7.5, 19.5]) deckBench(dr, F(x, 11.5, 2), 2.4);
  for (const x of [1.0, 8.0, 13.0, 20.0]) drain(dr, F(x, 9.8, 0), 0.6, 0.3);
  for (const z of [2.0, 6.0]) depthMark(dr, F(-1.7, z, 1), 0.8);
  depthMark(dr, F(-12.0, 9.0, 2), 0.8);
  plant(dr, F(-17.0, 11.0, 0));
  plant(dr, F(21.0, 11.0, 0));
  // 南の壁（北を向く）: 時計・名前の板・流れの向き・救命浮環・掲示
  const S = (x: number): Frame => new Frame(b, [x, 0, 12], 2);
  clock(dr, S(9.5), 2.9, 0.3);
  decal(S(4.0), dr.signs.label('男子シャワー'), [0, 2.75, 0.01], 1.4, 0.35);
  decal(S(16.0), dr.signs.label('女子シャワー'), [0, 2.75, 0.01], 1.4, 0.35);
  decal(S(-3.6), dr.signs.label('監視室'), [0, 2.75, 0.01], 1.1, 0.28);
  decal(S(-0.8), dr.signs.flow(), [0, 2.3, 0.01], 1.6, 0.4);
  decal(S(-0.8), dr.signs.label('流れるプール'), [0, 2.85, 0.01], 1.6, 0.4);
  rescueBoard(dr, S(1.5));
  wallNotice(dr, S(6.6), dr.signs.notice(11), 0.6, 0.8, 1.5);
  wallNotice(dr, S(7.5), dr.signs.caution(12, 'run'), 0.5, 0.62, 1.5);
  wallNotice(dr, S(8.4), dr.signs.notice(13, '#c08a6a'), 0.6, 0.8, 1.5);
  wallNotice(dr, S(12.5), dr.signs.board(15), 1.6, 1.0, 1.6);
  // 西の壁（東を向く）: 案内図・掲示
  const W = (z: number): Frame => new Frame(b, [XW, 0, z], 1);
  wallNotice(dr, W(9.0), dr.signs.map(3), 1.4, 1.05, 1.7);
  wallNotice(dr, W(4.5), dr.signs.caution(14, 'dive'), 0.5, 0.62, 1.6);
  // 非常口の表示（C・D への通路の扉の上・B への扉の上）
  exitSign(dr, new Frame(b, [-15.25, 0, -36], 0), 2.75);
  exitSign(dr, new Frame(b, [22, 0, 4.9], 3), 2.75);

  // 中島・西の柱の北の面（pool-0 の視点の裏側）にも段々の欠きと暗い凹み（参考画像の柱の欠けと同じ）
  const notch = (x0: number, x1: number, z: number, seed: number): void => {
    let r = seed;
    const rnd = (): number => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 9; i++) {
      const w = T * (1 + Math.floor(rnd() * 2));
      const h = T * (1 + Math.floor(rnd() * 3));
      const x = x0 + Math.floor(rnd() * ((x1 - x0 - w) / T)) * T;
      const y = 0.25 + Math.floor(rnd() * ((BEAM0 - 0.6) / T)) * T;
      // 柱の北の面は pool-0 の視点から裏向き。柱の幅の内側（端から 0.25 m）に収まる欠きは柱の陰で見えない
      if (x < x0 + T - 1e-3 || x + w > x1 - T + 1e-3) continue;
      if (rnd() < 0.35) b.boxMM(m.dark, [x, y, z - 0.02], [x + w, y + h * 0.5, z + 0.01], { shadow: false });
      else b.boxMM(m.colDeep, [x, y, z - T], [x + w, y + h, z]);
    }
  };
  for (const zz of [-18.5, -24.5, -30.5]) notch(-3.75, -2.75, zz - 1.0, Math.round(-zz * 13));
  for (const zz of [-12.5, -24.5]) notch(-8.0, -7.0, zz - 1.0, Math.round(-zz * 17));
  notch(-11.5, -10.5, -12.0, 77);
  // 外周の壁の柱型・腰の帯・蛇腹（pool-0 の画角と映り込みの外だけ）
  hallDress(env, 'A', { pier: m.wall, ceil: CEIL, cam: CAM_A, sun: new THREE.Vector3(...SUN_A) });

  // --- 影の形（見えない板）: 参考画像の影の形を面の上でなぞった多角形（画素） ---
  const sun = new THREE.Vector3(...SUN_A);
  const onZ = (zf: number, px: [number, number][]): V3[] => px.map(([x, y]) => CAM_A.hit(x, y, 'z', zf));
  gobo(b, onZ(-12.25, [[296, 326], [404, 326], [404, 352], [342, 418], [312, 452], [296, 452]]), sun, 0.3);
  gobo(b, onZ(-12.5, [[452, 326], [582, 326], [582, 338], [540, 382], [505, 418], [470, 452], [452, 452]]), sun, 0.3);
  const lit1 = onZ(-12.25, [[404, 352], [404, 505], [296, 505], [296, 452], [312, 452], [342, 418]]);
  const lit2 = onZ(-12.5, [[582, 338], [582, 505], [452, 505], [452, 452], [470, 452], [505, 418], [540, 382]]);
  const upA = (pts: V3[]): [number, number][] => pts.map((p) => towardSun(p, sun, SLAB + 0.1));
  roofGobo(b, [-7.0, -12.0, 0.5, -8.0], SLAB + 0.1, 0.0625, [upA(lit1), upA(lit2)]);
  gobo(b, onZ(-6.25, [[1150, 170], [1295, 170], [1295, 362], [1250, 420], [1200, 495], [1162, 560], [1150, 560]]), sun, 0.25);
}
