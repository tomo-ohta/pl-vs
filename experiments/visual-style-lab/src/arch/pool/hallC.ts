import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { gobo, roofGobo, T, towardSun } from '../../scenes/pool/kit.ts';
import { Frame } from './frame.ts';
import { perimeterWall, type HallEnv } from './hallkit.ts';
import { hallDress, unseenPlacer, viewSees } from './halldress.ts';
import { clock, decal, deckBench, depthMark, drain, exitSign, lifeguardChair, plant, poolLadder, rescueBoard, wallNotice, type Dress } from './props.ts';
import { UPPER_Y } from './layout.ts';
import { CAM_C, SUN_C } from '../../scenes/pool/zoneC.ts';
import { HALL } from './layout.ts';
import type { Kit } from '../../scenes/pool/kit.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { RoomMats } from './rooms.ts';

/**
 * ホール C「深いプールと洞窟の口」（pool-2）。天井 4.2 m。南西に低いプールサイド、そこから北へ一段高い斜めの通路と太い柱、
 * 柱の列、東に深いプール、北東に観覧の段（段々の塊）と階段、その奥に流れるプールが出てくる暗い洞窟の口。
 * 視点は深いプールの縁の浅い段（水深 0.2 m）に立ち、北西を見る（目は水面から 1.6 m）。見た目は元の版（zoneC.ts）を写して、壁の内へ切った。
 * 区域の座標の原点 = pool-2 の視点の真下の水面。
 */
export { CAM_C, SUN_C };

export const C_RECT = { x0: -13, z0: -26.5, x1: 8, z1: 9 };

export function buildHallC(env: HallEnv, dr: Dress): void {
  const k = env.k;
  const [ox, oz] = HALL.C.o;
  const { x0: XC0, z0: ZC0, x1: XC1, z1: ZC1 } = C_RECT;
  const m = k.b.ctx.mat;
  const tC = (grout: string, size = T) => ({ size, line: 0.012, color: grout, jitter: 0.02 });
  const walk = m({ name: 'c-walk', shadowQuant: false, color: '#fdfaef', hi: '#fffcf3', shade: '#c3d4c8', dark: '#8fb0a3', tiles: tC('#e0e0d2', 2 * T) });
  const deck = m({ name: 'c-deck', color: '#ebe8dc', hi: '#fdfbf1', shade: '#c3d4c8', dark: '#8fb0a3', tiles: tC('#d9dacb', 2 * T) });
  const col = m({ name: 'c-col', color: '#f8f5e8', hi: '#fefbf0', shade: '#a6bcab', dark: '#7d9d92', tiles: tC('#d8d9c9') });
  const cap = m({ name: 'c-cap', color: '#9fbfac', hi: '#9fbfac', shade: '#93b8a7', dark: '#7fa898', tiles: tC('#87aa98', 2 * T) });
  const ceil = m({ name: 'c-ceil', color: '#b5cfc0', hi: '#b5cfc0', shade: '#adc9ba', dark: '#a6c4b5', tiles: tC('#9bbaaa', 4 * T) });
  const beamC = m({ name: 'c-beam', color: '#a9c9bb', hi: '#a9c9bb', shade: '#a1c3b4', dark: '#9abeaf', tiles: tC('#90b2a3', 2 * T) });
  const colFar = m({ name: 'c-colFar', color: '#f4f2e6', hi: '#fbf9ee', shade: '#72aaa8', dark: '#5f9496', tiles: tC('#cfd6c8') });
  const ceilDark = m({ name: 'c-ceilDark', color: '#3e7a77', unlit: true, tiles: { size: 2 * T, line: 0.015, color: '#36706d' } });
  const litWall = m({ name: 'c-litWall', color: '#c6d9ce', unlit: true, tiles: { size: 2 * T, line: 0.02, color: '#a9c1b3' } });
  const wall = m({ name: 'c-wall', color: '#eef2e6', hi: '#f8f8ef', shade: '#6aa096', dark: '#3f7877', tiles: tC('#c9d6cb') });
  const wallDeep = m({ name: 'c-wallDeep', color: '#e3ebe0', hi: '#f5f5f0', shade: '#5a8d89', dark: '#456b74', tiles: tC('#c3d1c6') });
  const farDark = m({ name: 'c-farDark', color: '#2a6274', unlit: true, noFog: true, tiles: { size: T, line: 0.01, color: '#255c6d' } });
  const dark = m({ name: 'c-dark', color: '#0f4a5c', unlit: true, noFog: true });
  const recess = m({ name: 'c-recess', color: '#4d7a80', unlit: true, tiles: { size: T, line: 0.01, color: '#46727a' } });
  const sky = m({ name: 'c-sky', color: '#fdfbf0', unlit: true, noFog: true, line: 0 });

  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  const box = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, collide = false, shadow: boolean | 'receive' = 'receive'): void => {
    const sh = mat === cap || mat === ceil || mat === beamC ? 'receive' : shadow;
    k.box(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { collide, shadow: sh });
  };
  const CEIL = 4.2;

  // 底: 全体は深め。東は深いプール
  k.basin(X(XC0), Z(ZC0), X(XC1), Z(ZC1), -1.1);
  k.basin(X(-1.5), Z(ZC0), X(XC1), Z(-1.6), -2.6);
  const SH: [number, number][] = [[-1.75, -1.55], [-2.9, -1.5], [-3.8, -1.5], [-5.1, -1.9], [-5.6, -2.6]];
  const shX = (z: number): number => {
    for (let i = 0; i < SH.length - 1; i++) if (z <= SH[i][0] && z >= SH[i + 1][0]) return SH[i][1] + ((z - SH[i][0]) / (SH[i + 1][0] - SH[i][0])) * (SH[i + 1][1] - SH[i][1]);
    return SH[SH.length - 1][1];
  };
  for (let z = -1.75; z > -5.6; z -= T) {
    const w = Math.sin(z * 2.3) * 0.12 + Math.sin(z * 5.1 + 1.0) * 0.08;
    k.shelf(X(-4.75), Z(z - T), X(Math.round((shX(z) + w) / T) * T), Z(z), -0.28);
  }
  k.shelf(X(-1.75), Z(-1.75), X(2.0), Z(3.0), -0.2);

  // 左手前の低い通路
  k.deck(deck, X(XC0), Z(-1.67), X(-1.75), Z(ZC1), 0.15);
  // 一段高い通路
  const WALK: [number, number][] = [[-6.4, -1.67], [-3.3, -1.67], [-3.2, -3.6], [-4.75, -5.6], [-4.75, -12.0], [-6.4, -12.0]];
  {
    const shape = new THREE.Shape(WALK.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 2.36, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    k.b.mesh(g, walk, [X(0), -2, Z(0)], { shadow: true });
    const c = k.hf.cell;
    for (let z = -12.0; z < -1.67; z += c) {
      const zc = z + c / 2;
      let xe = -6.4;
      for (let i = 1; i < WALK.length - 1; i++) {
        const [xa, za] = WALK[i];
        const [xb, zb] = WALK[i + 1];
        if ((zc <= za && zc >= zb) || (zc >= za && zc <= zb)) xe = Math.max(xe, xa + ((zc - za) / (zb - za)) * (xb - xa));
      }
      k.hf.rect(X(-6.4), Z(z), X(xe), Z(z + c), 50, 'max');
      k.b.ctx.colliders.add({ x: X(-6.4), y: -2, z: Z(z) }, { x: X(xe), y: 0.36, z: Z(z + c) });
    }
  }
  // 外周の壁（西: 外壁、南: 休憩コーナーへの扉、東: 2 階のラウンジの扉（階段の上）、北: 洞窟の口と窓）
  perimeterWall(env, 'C', 'w', wallDeep, { y1: CEIL + 0.3 });
  perimeterWall(env, 'C', 's', wall, { y1: CEIL + 0.3 });
  perimeterWall(env, 'C', 'e', wallDeep, { y1: 8.3 });
  // 北の壁: 洞窟の口（x -3.7〜1.3）を開ける
  perimeterWall(env, 'C', 'n', wallDeep, { y1: CEIL + 0.3, extra: [{ at: ox + (-3.7 + 1.3) / 2 - (ox + XC0 - 1), width: 5.0, bottom: -2.5, top: 3.9 }] });
  // 明るい柱型（西の壁の前）
  box(col, -13.0, -2, -7.0, -12.3, CEIL, -5.6, true, true);
  box(recess, -12.98, -2, -5.4, -12.9, 3.2, 2.0);

  // 太い柱と段々の柱頭（影を落とす）
  // （参考画像で測った: 柱頭の下 y 200 → 高さ 2.6 m、柱の幅 x 248〜452）
  box(col, -5.55, 0.36, -3.8, -4.45, 2.6, -2.8, true, true);
  box(cap, -5.95, 2.6, -4.2, -4.05, 3.0, -2.4, false, true);
  box(cap, -6.2, 3.0, -4.45, -3.8, CEIL, -2.15, false, true);
  const rowA = [-8.4, -12.7, -17.0, -21.3, -25.6];
  const pier = (xc: number, zc: number, hw: number): void => {
    box(colFar, xc - hw - 0.25, -2, zc - hw - 0.25, xc + hw + 0.25, 0.05, zc + hw + 0.25, true, true);
    box(colFar, xc - hw, 0.05, zc - hw, xc + hw, 3.0, zc + hw, true, true);
    box(cap, xc - hw - 0.25, 3.0, zc - hw - 0.25, xc + hw + 0.25, 3.4, zc + hw + 0.25);
    box(cap, xc - hw - 0.5, 3.4, zc - hw - 0.5, xc + hw + 0.5, CEIL, zc + hw + 0.5);
  };
  // 斜めの通路の先の明るい柱（参考画像で測った: 台の下の縁 x 780〜920・y 465 → 中心 (-4.7, -11.5)、柱の幅 1.25 m）
  pier(-4.7, -11.5, 0.62);
  pier(-5.3, -22.3, 0.45);
  for (const zc of [-11.0, -16.0, -21.0]) pier(-9.0, zc, 0.45);
  // 梁
  box(beamC, -5.1, 3.5, ZC0, -4.3, CEIL, -12.3);
  box(beamC, -9.4, 3.5, ZC0, -8.6, CEIL, -8.0);
  for (const zc of rowA.slice(1)) if (zc + 0.4 <= ZC1 && zc - 0.4 >= ZC0) box(beamC, XC0, 3.5, zc - 0.4, 1.0, CEIL, zc + 0.4);

  // 天井の板（天窓）
  const sk = [CAM_C.hit(712, 72, 'y', CEIL), CAM_C.hit(900, -12, 'y', CEIL), CAM_C.hit(885, 162, 'y', CEIL), CAM_C.hit(840, 162, 'y', CEIL), CAM_C.hit(760, 110, 'y', CEIL)];
  const outer = new THREE.Shape([new THREE.Vector2(XC0, -ZC1), new THREE.Vector2(XC1, -ZC1), new THREE.Vector2(XC1, -ZC0), new THREE.Vector2(XC0, -ZC0)]);
  outer.holes.push(new THREE.Path(sk.map((p) => new THREE.Vector2(p[0], -p[2]))));
  const sk2 = [CAM_C.hit(905, -40, 'y', CEIL), CAM_C.hit(1185, -40, 'y', CEIL), CAM_C.hit(1185, 115, 'y', CEIL), CAM_C.hit(905, 115, 'y', CEIL)];
  outer.holes.push(new THREE.Path(sk2.map((p) => new THREE.Vector2(p[0], -p[2])).reverse()));
  outer.holes.push(new THREE.Path([new THREE.Vector2(1.0, 24.0), new THREE.Vector2(1.0, 21.5), new THREE.Vector2(XC1, 21.5), new THREE.Vector2(XC1, 24.0)]));
  const slabGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2);
  k.b.mesh(slabGeo, ceil, [X(0), CEIL, Z(0)], { shadow: 'receive' });
  k.b.boxMM(sky, [X(XC0), 9, Z(ZC0)], [X(XC1), 9.2, Z(ZC1)], { shadow: false });
  box(litWall, -2.9, CEIL + 0.4, -14.5, 2, 8.9, -14.0, false, false);
  box(ceilDark, 0.4, 3.8, -10.5, 3.5, CEIL - 0.01, -6.2, false, false);

  // 東の段々の塊と、上の大きな張り出し
  box(wall, 0.3, -2, -9.0, XC1, 0.95, -7.3, true);
  box(wall, 1.0, 0.95, -9.0, XC1, 1.25, -8.25, true);
  box(wallDeep, 1.4, -2, -12.0, XC1, 1.6, -9.0, true);
  box(wallDeep, 1.0, 2.9, -12.0, XC1, CEIL, -7.3, true);
  k.greeble(wallDeep, null, [X(1.0), 2.9, Z(-12.0)], [X(1.6), CEIL, Z(-7.3)], 6, { faces: ['-x', 'z'], size: [0.25, 0.75], out: 0.25 });
  // 観覧の段の脇の階段: 深いプールの中（泳いで上がれる段）から、2 階のラウンジへ上がる
  for (let i = -5; i < 13; i++) box(wallDeep, 0.35 + i * 0.28, -2.6, -24, XC1, 0.73 + (i + 1) * 0.32, -21.5, true);
  // 階段の北の壁（洞窟の口の右の段々の壁の続き）
  box(wallDeep, 1.3, -2.6, ZC0, XC1, CEIL, -24, true);
  // 階段の上の吹き抜け（天井より上は暗い階段室。上の踊り場から東の壁の扉でラウンジへ）
  box(wallDeep, 0.75, CEIL, -24.25, 1.0, 8.3, -21.25, true);
  box(wallDeep, 0.75, CEIL, -21.5, XC1, 8.3, -21.25, true);
  // 北の壁（外に面する）: 上の方に横長の窓（x 2〜7・y 6.0〜7.6。pool-2 の視点からは見えない高さ）
  box(wallDeep, 0.75, CEIL, -24.25, XC1, 6.0, -24.0, true);
  box(wallDeep, 0.75, 7.6, -24.25, XC1, 8.3, -24.0, true);
  box(wallDeep, 0.75, 6.0, -24.25, 2.0, 7.6, -24.0, true);
  box(wallDeep, 7.0, 6.0, -24.25, XC1, 7.6, -24.0, true);
  box(wallDeep, 0.75, 8.0, -24.25, XC1, 8.3, -21.25);
  box(wallDeep, 0.35 + 13 * 0.28, -2, -24, XC1, UPPER_Y, -21.5, true);
  box(wallDeep, 3.2, -2, -21.5, XC1, CEIL, -12.0, true);
  // 北の壁と暗い洞窟の口
  box(wallDeep, XC0, -2, -25.5, -8.0, CEIL, -24.0, true);
  for (const [x0, x1] of [[-12.5, -11.5], [-10.5, -9.0]] as [number, number][]) box(sky, x0, 0.3, -24.02, x1, 3.2, -23.98);
  box(farDark, -8.0, -2, -26.5, -3.2, 3.6, -26.0, true);
  box(wallDeep, -8.0, 3.6, -26.5, -3.2, CEIL, -24.0);
  box(wallDeep, -3.2, 3.4, -25.5, 1.6, CEIL, -24.0);
  box(dark, -3.2, -2, -32, 0.8, 3.4, -31.5);
  box(dark, -3.7, -2, -32, -3.2, 3.4, -25.5);
  // 洞窟の口の東の壁（北の横の水路が東から入る所 z -31.5〜-27.5 は開ける）
  box(dark, 0.8, -2, -32, 1.3, 3.4, -31.5);
  box(dark, 0.8, -2, -27.5, 1.3, 3.4, -25.5);
  box(dark, 0.8, 3.4, -31.5, 1.3, 3.9, -27.5);
  box(dark, -3.7, 3.4, -32, 1.3, 3.9, -25.5);
  k.basin(X(-3.2), Z(-31.5), X(0.8), Z(ZC0), -1.1);
  k.basin(X(-1.5), Z(-31.5), X(0.8), Z(ZC0), -2.6);

  // --- 日の差し込む所（見えない屋根の穴） ---
  const sun = new THREE.Vector3(...SUN_C);
  const RY = 9.5;
  const up = (pts: V3[]): [number, number][] => pts.map((p) => towardSun(p, sun, RY));
  const rect = (x0: number, z0: number, x1: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const onX = (xf: number, px: [number, number][]): V3[] => px.map(([x, y]) => CAM_C.hit(x, y, 'x', xf));
  const holes: [number, number][][] = [
    up(rect(XC0, -1.7, -1.7, ZC1, 0.15)),
    up(WALK.map(([x, z]) => [Math.max(x, z > -3.8 ? -5.0 : -5.6), 0.36, z] as V3)),
    ...[1, 2].map((i) => {
      const [xa, za] = WALK[i];
      const [xb, zb] = WALK[i + 1];
      return up([[xa, 0.36, za], [xb, 0.36, zb], [xb + 0.15, -0.05, zb], [xa + 0.15, -0.05, za]]);
    }),
    up([[-4.75, -0.28, -1.6], ...SH.map(([z, x]) => [x + 0.3, -0.28, z] as V3), [-4.75, -0.28, -5.6]]),
    up(onX(-4.45, [[345, 452], [452, 298], [452, 525], [345, 548]])),
    // 斜めの通路の先の明るい柱の東の面（参考画像では右の面が明るい）
    up([[-4.08, 0.05, -10.88], [-4.08, 0.05, -12.12], [-4.08, 3.0, -12.12], [-4.08, 3.0, -10.88]]),
    up([[-12.3, 0.2, -7.0], [-12.3, 0.2, -5.6], [-12.3, 3.0, -5.6], [-12.3, 3.0, -7.0]]),
  ];
  const holesW = holes.map((h) => {
    const cx = h.reduce((s, p) => s + p[0], 0) / h.length;
    const cz = h.reduce((s, p) => s + p[1], 0) / h.length;
    return h.map(([x, z]) => [x + Math.sign(x - cx) * 0.05, z + Math.sign(z - cz) * 0.05] as [number, number]);
  });
  roofGobo(k.b, [X(XC0 - 12), Z(ZC0 - 6), X(XC1 + 4), Z(ZC1 + 4)], RY, 0.125, holesW.map((h) => h.map(([x, z]) => [X(x), Z(z)] as [number, number])));
  const W = (p: V3): V3 => [X(p[0]), p[1], Z(p[2])];
  gobo(k.b, onX(-4.45, [[340, 455], [455, 296], [455, 60], [340, 60]]).map(W), sun, 0.3);

  // ---- 写っていない所: 南のプールサイド・はしご・置く物 ----
  k.deck(deck, X(-1.75), Z(3.0), X(XC1), Z(ZC1), 0.15);
  // 階段室の灯り（暗い）と上の踊り場の案内
  k.b.boxMM(env.rm.lampFrame, [X(4.6), 7.92, Z(-23.2)], [X(5.8), 7.97, Z(-22.4)], { shadow: false });
  k.b.boxMM(env.rm.lamp, [X(4.65), 7.91, Z(-23.15)], [X(5.75), 7.92, Z(-22.45)], { shadow: false });
  const F = (x: number, z: number, kk: number, y = 0.15): Frame => new Frame(k.b, [X(x), y, Z(z)], kk);
  decal(F(XC1, -22.75, 3, 0), dr.signs.label('2F ラウンジ', '→'), [0, UPPER_Y + 2.4, 0.01], 1.4, 0.35);
  lifeguardChair(dr, F(6.2, 6.0, 2));
  poolLadder(dr, F(4.0, 3.0, 2), 1.1);
  poolLadder(dr, F(-1.5, 6.0, 1), 0.3);
  for (const x of [-11.0, -7.5]) deckBench(dr, F(x, 8.5, 2), 2.4);
  for (const x of [-6.0, 2.0]) drain(dr, F(x, 6.5, 0), 0.6, 0.3);
  depthMark(dr, F(2.0, 3.2, 2), 2.6);
  depthMark(dr, F(6.5, 3.2, 2), 2.6);
  depthMark(dr, F(-2.0, 2.0, 1), 1.1);
  plant(dr, F(-12.4, 8.4, 0));
  const S = (x: number): Frame => new Frame(k.b, [X(x), 0, Z(ZC1)], 2);
  clock(dr, S(-2.0), 2.9, 0.3);
  rescueBoard(dr, S(1.0));
  wallNotice(dr, S(3.0), dr.signs.caution(41, 'dive'), 0.5, 0.62, 1.5);
  wallNotice(dr, S(4.0), dr.signs.notice(42), 0.6, 0.8, 1.5);
  wallNotice(dr, S(6.5), dr.signs.board(43), 1.4, 0.9, 1.6);
  decal(S(-5.6), dr.signs.label('休憩コーナー'), [0, 2.75, 0.01], 1.4, 0.35);
  exitSign(dr, S(-4.25), 2.7);
  // 南の部分の天井の梁（pool-2 の視点の後ろ。梁は柱型で受ける。1 m ずつ置いて見える所は省く）
  const putC = unseenPlacer(env, 'C', CAM_C, new THREE.Vector3(...SUN_C));
  for (const zc of [2.75, 6.25]) {
    for (let x = XC0; x < XC1 - 1e-3; x += 1.0) {
      const x1 = Math.min(XC1, x + 1.0);
      putC(beamC, [X(x), 3.55, Z(zc - 0.4)], [X(x1), CEIL, Z(zc + 0.4)], false);
      putC(beamC, [X(x), 3.4, Z(zc - 0.22)], [X(x1), 3.55, Z(zc + 0.22)], false);
    }
  }
  for (let z = 1.0; z < ZC1 - 1e-3; z += 1.0) {
    const z1 = Math.min(ZC1, z + 1.0);
    putC(beamC, [X(-6.9), 3.55, Z(z)], [X(-6.1), CEIL, Z(z1)], false);
    putC(beamC, [X(-6.72), 3.4, Z(z)], [X(-6.28), 3.55, Z(z1)], false);
  }
  // 南西のプールサイドの置く物（pool-2 の画角の外だけ）: タイルの塊の段々の腰掛け・植え込みの台・寝椅子
  const sees = viewSees('C', CAM_C);
  const tileBlock = col;
  const blockBench = (x0: number, z0: number, x1: number, z1: number): void => {
    if (sees([X(x0), 0, Z(z0)], [X(x1), 0.9, Z(z1)])) return;
    // 壁ぎわ（西）に背の段、手前の縁は青緑のタイル
    k.b.boxMM(tileBlock, [X(x0), 0.15, Z(z0)], [X(x1), 0.6, Z(z1)], { collide: true });
    k.b.boxMM(tileBlock, [X(x0), 0.6, Z(z0)], [X(x0 + 0.45), 1.0, Z(z1)], { collide: true });
    k.b.boxMM(dr.p.teal, [X(x1) - 0.06, 0.15, Z(z0) - 0.01], [X(x1) + 0.01, 0.62, Z(z1) + 0.01], { shadow: 'receive' });
  };
  blockBench(-12.9, 5.2, -11.2, 7.6);
  blockBench(-12.9, 1.0, -11.2, 3.4);
  const lounger = (x: number, z: number): void => {
    if (sees([X(x - 0.4), 0, Z(z - 1.0)], [X(x + 0.4), 1.0, Z(z + 1.0)])) return;
    const f = new Frame(k.b, [X(x), 0.15, Z(z)], 0);
    f.box(dr.p.white, [-0.33, 0.28, -0.95], [0.33, 0.34, 0.6], { shadow: true, collide: true });
    const g = new THREE.BoxGeometry(0.66, 0.06, 0.7);
    g.rotateX(0.6);
    k.b.mesh(g, dr.p.white, [X(x), 0.55, Z(z - 1.15)], { shadow: true });
    for (const sx of [-0.28, 0.28]) for (const sz of [-0.85, 0.5]) f.box(dr.p.metal, [sx - 0.02, 0, sz - 0.02], [sx + 0.02, 0.28, sz + 0.02], { shadow: true });
  };
  for (const x of [-9.5, -8.4, -7.3, -4.4, -3.3]) lounger(x, 6.4);
  if (!sees([X(-6.2), 0, Z(4.0)], [X(-5.0), 1.6, Z(5.2)])) {
    k.b.boxMM(tileBlock, [X(-6.2), 0.15, Z(4.0)], [X(-5.0), 0.7, Z(5.2)], { collide: true });
    plant(dr, new Frame(k.b, [X(-5.6), 0.7, Z(4.6)], 0), 1.0);
  }
  // 外周の壁の柱型・腰の帯・蛇腹（pool-2 の画角と映り込みの外だけ。東は観覧の段、北は洞窟の口）
  hallDress(env, 'C', { pier: col, ceil: CEIL, cam: CAM_C, sun: new THREE.Vector3(...SUN_C), skip: ['e', 'n'] });
}

/**
 * C の観覧の階段の階段室（天井より上）の作り込み。中にいる時だけ描く（pool-2 の視点からは天井の穴の奥の暗がりのまま）。
 * 白いタイルの内張り・柱型と梁・段々の蛇腹・北の高窓（外の明るさ）・吊り下げの灯りと光だまり・手すり。
 */
export function buildStairC(k: Kit, ctx: SceneContext, rm: RoomMats): void {
  const [ox, oz] = HALL.C.o;
  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  const b = k.b;
  const a = rm.arch;
  const CEIL = 4.2;
  const bx = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, sh: boolean | 'receive' = 'receive'): void => {
    b.boxMM(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { shadow: sh });
  };
  const L = 0.05;
  const T0 = CEIL - 0.6;
  // 内張り（北・南・西の面と天井）。北は窓を空ける
  bx(rm.wall, 1.0, T0, -21.5 - L, 8.0, 8.0, -21.5);
  bx(rm.wall, 1.0, T0, -24.0, 1.0 + L, 8.0, -21.5);
  bx(rm.wall, 1.0, T0, -24.0, 8.0, 6.0, -24.0 + L);
  bx(rm.wall, 1.0, 7.6, -24.0, 8.0, 8.0, -24.0 + L);
  bx(rm.wall, 1.0, 6.0, -24.0, 2.0, 7.6, -24.0 + L);
  bx(rm.wall, 7.0, 6.0, -24.0, 8.0, 7.6, -24.0 + L);
  bx(a.ceil, 1.0, 8.0 - L, -24.0, 8.0, 8.0, -21.5);
  // 東の面（ラウンジの扉の所は空ける）と扉の厚い額縁
  const dz0 = -82.5 - oz;
  const dz1 = -80.8 - oz;
  const dTop = UPPER_Y + 2.55;
  bx(rm.wall, 8.0 - L, T0, -24.0, 8.0, 8.0, dz0);
  bx(rm.wall, 8.0 - L, T0, dz1, 8.0, 8.0, -21.5);
  bx(rm.wall, 8.0 - L, dTop, dz0, 8.0, 8.0, dz1);
  bx(rm.wall, 8.0 - L, T0, dz0, 8.0, UPPER_Y, dz1);
  bx(a.frame, 7.9, UPPER_Y, dz0 - 0.16, 8.0, dTop + 0.16, dz0);
  bx(a.frame, 7.9, UPPER_Y, dz1, 8.0, dTop + 0.16, dz1 + 0.16);
  bx(a.frame, 7.9, dTop, dz0, 8.0, dTop + 0.16, dz1);
  // 窓（ガラス・桟・深い窓台）と外の明るい面
  bx(a.glass, 2.0, 6.0, -24.17, 7.0, 7.6, -24.15, false);
  // 桟は 0.5 m の升目（型板ガラスの窓）
  for (let x = 2.5; x < 6.9; x += 0.5) bx(a.bar, x - 0.025, 6.0, -24.2, x + 0.025, 7.6, -24.1, false);
  for (const y of [6.53, 7.07]) bx(a.bar, 2.0, y - 0.025, -24.2, 7.0, y + 0.025, -24.1, false);
  bx(a.frame, 1.88, 5.88, -24.0, 7.12, 6.0, -23.82);
  bx(a.frame, 1.88, 7.6, -24.0, 7.12, 7.72, -23.9);
  bx(a.glow, 1.0, 5.2, -25.2, 8.0, 8.4, -25.15, false);
  // 柱型と梁（段々の柱頭）・蛇腹
  for (const x of [3.0, 5.6]) {
    for (const [z0, z1] of [[-24.0, -23.72], [-21.78, -21.5]] as [number, number][]) {
      bx(a.pier, x - 0.25, T0, z0, x + 0.25, 7.3, z1);
      bx(a.pier, x - 0.35, 7.3, z0 < -23 ? -24.0 : -21.88, x + 0.35, 7.5, z0 < -23 ? -23.62 : -21.5);
    }
    bx(a.beam, x - 0.3, 7.5, -24.0, x + 0.3, 8.0, -21.5);
    bx(a.beam, x - 0.17, 7.36, -23.6, x + 0.17, 7.5, -21.9);
  }
  bx(a.beam, 1.0, 7.75, -24.0, 8.0, 8.0, -23.75);
  bx(a.beam, 1.0, 7.75, -21.75, 8.0, 8.0, -21.5);
  bx(a.beam, 1.0, 7.75, -23.75, 1.25, 8.0, -21.75);
  // 手すり（階段に沿って上る管と、踊り場の手すり）
  const rail = a.bar;
  for (let i = -3; i < 13; i++) {
    const x = 0.35 + i * 0.28 + 0.14;
    const y = 0.73 + (i + 1) * 0.32;
    if (i % 3 === 0) bx(rail, x - 0.02, y, -21.62, x + 0.02, y + 0.9, -21.58, false);
    bx(rail, x - 0.15, y + 0.88, -21.63, x + 0.15, y + 0.92, -21.57, false);
  }
  // 吊り下げの灯り（踊り場の上と階段の中ほど）と光だまり。照らすのは階段室の中だけ
  const box6: [number, number, number, number, number, number] = [X(0.75), -0.6, Z(-24.0), X(8.0), 8.0, Z(-21.5)];
  for (const [x, y] of [[6.3, 7.25], [2.0, 5.6]] as [number, number][]) {
    bx(a.body, x - 0.6, y, -22.92, x + 0.6, y + 0.1, -22.58, false);
    bx(a.lens, x - 0.56, y - 0.012, -22.88, x + 0.56, y, -22.62, false);
    ctx.addLamp({ pos: [X(x), y - 0.25, Z(-22.75)], radius: 4.0, intensity: 0.8, box: box6, down: true, shadow: 0 });
  }
}
