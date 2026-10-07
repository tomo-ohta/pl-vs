import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { gobo, T } from '../../scenes/pool/kit.ts';
import { stairs } from '../kit.ts';
import { Frame } from './frame.ts';
import { perimeterWall, type HallEnv } from './hallkit.ts';
import { hallDress } from './halldress.ts';
import { clock, decal, deckBench, depthMark, exitSign, lifeguardChair, plant, rescueBoard, stairRail, wallNotice, type Dress } from './props.ts';
import { UPPER_Y, type RoomDef } from './layout.ts';
import { clerestories } from './roomarch.ts';
import { dressSpace } from './rooms.ts';
import { CAM_D, SUN_D } from '../../scenes/pool/zoneD.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { HALL } from './layout.ts';

/**
 * ホール D「ガラス屋根の大広間」（pool-3）。浅い池（水深 0.5 m）の中に台座つきの太い柱が左右に立ち、
 * その奥に段々のアーチの壁が 3 枚（前面 z -8・-13・-18）、突き当たりに流れるプールの暗い洞窟（トンネル）。中央の水路の上はガラスのかまぼこ屋根。
 * 視点は浅い池の中（目は水面から 1.2 m、少し見上げる）から北を見る。見た目は元の版（zoneD.ts）を写して、壁の内へ切った。
 * 区域の座標の原点 = pool-3 の視点の真下の水面。
 */
export { CAM_D, SUN_D };

export const D_RECT = { x0: -14, z0: -25, x1: 14, z1: 6 };

export interface HallDMats {
  wall: THREE.Material;
  inner: THREE.Material;
  dark: THREE.Material;
  shadow: THREE.Material;
  glass: THREE.Material;
  roomPillar: THREE.Material;
  side: THREE.Material;
  sky: THREE.Material;
  reveal: THREE.Material;
  pane: THREE.Material;
}

export function hallDMats(m: SceneContext['mat']): HallDMats {
  const tD = (grout: string) => ({ size: T, line: 0.012, color: grout, jitter: 0.02, broken: 0.1 });
  return {
    wall: m({ name: 'd-wall', color: '#efebd9', hi: '#f2f1e4', shade: '#8ea392', dark: '#63857c', tiles: tD('#d4d6c6') }),
    inner: m({ name: 'd-inner', color: '#edf1e1', hi: '#e9eadb', shade: '#829989', dark: '#678f8e', tiles: tD('#c3cabb') }),
    roomPillar: m({ name: 'd-roomPillar', color: '#213e40', unlit: true, tiles: { size: T, line: 0.01, color: '#334d50' } }),
    side: m({ name: 'd-side', color: '#8ca18f', unlit: true, tiles: { size: T, line: 0.01, color: '#86998a' } }),
    dark: m({ name: 'd-dark', color: '#3f6673', unlit: true, noFog: true }),
    shadow: m({ name: 'd-shadow', color: '#1f4248', unlit: true, tiles: { size: T, line: 0.01, color: '#1f4146' } }),
    glass: m({ name: 'd-glass', color: '#748c8f', shade: '#4c6669', dark: '#425a5e', hi: '#5a7477' }),
    sky: m({ name: 'd-sky', color: '#eaf0ef', unlit: true, noFog: true, line: 0 }),
    reveal: m({ name: 'd-reveal', color: '#6b8d8e', unlit: true }),
    pane: m({ name: 'd-pane', color: '#eef4f1', unlit: true, noFog: true, line: 0, side: THREE.BackSide }),
  };
}

export function buildHallD(env: HallEnv, m: HallDMats, dr: Dress): void {
  const k = env.k;
  const [ox, oz] = HALL.D.o;
  const { x0: XD0, z0: ZD0, x1: XD1, z1: ZD1 } = D_RECT;
  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  const b = k.b;
  const box = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, collide = false, shadow: boolean | 'receive' = 'receive'): void => {
    k.box(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { collide, shadow });
  };
  const TOP = 7.5;
  const DECK = 0.15;

  // 底（立って歩ける深さ）と中央の深い水路・洞窟
  k.basin(X(XD0), Z(ZD0), X(XD1), Z(ZD1), -0.5);
  k.basin(X(-1.25), Z(-40), X(2.0), Z(-2.0), -3.0);

  const archWall = (
    mat: THREE.Material,
    z0: number,
    z1: number,
    xl: number,
    xr: number,
    xa: number,
    xb: number,
    ys: number,
    ya: number,
    top: number,
    o: { steps?: number; sw?: number; stepL?: boolean; stepR?: boolean } = {},
  ): void => {
    const n = o.steps ?? 4;
    const sw = o.sw ?? 0.375;
    const dy = (ya - ys) / n;
    box(mat, xl, -2, z0, xa, top, z1, true);
    box(mat, xb, -2, z0, xr, top, z1, true);
    box(mat, xa, ya, z0, xb, top, z1);
    for (let i = 0; i < n; i++) {
      const y0 = ys + i * dy;
      const w = (i + 1) * sw;
      if (o.stepL ?? true) box(mat, xa, y0, z0, xa + w, y0 + dy, z1);
      if (o.stepR ?? true) box(mat, xb - w, y0, z0, xb, y0 + dy, z1);
    }
  };

  // --- 手前の左右の柱（台座付き） ---
  box(m.wall, -5.0, -2, -6.8, -1.76, 0.6, -5.85, true, true);
  box(m.wall, -4.08, 0.6, -6.6, -2.44, TOP, -5.8, true, true);
  box(m.wall, -4.08, 6.1, -8.0, -2.44, TOP, -6.6);
  box(m.side, -2.44, 0.6, -6.6, -2.41, 6.1, -5.8);
  box(m.wall, 1.82, -2, -7.8, 5.27, 0.48, -6.65, true, true);
  box(m.wall, 2.73, 0.48, -8.0, 4.46, TOP, -6.8, true, true);
  box(m.wall, 3.4, 5.47, -8.5, 6.5, 6.5, -3.5, false, true);

  // --- 1 枚目のアーチの壁（前面 z -8） ---
  archWall(m.wall, -8.75, -8.0, -3.6, 4.5, -3.5, 1.5, 3.35, 4.85, 6.1, { steps: 4, sw: 0.4, stepR: false });
  box(m.wall, XD0, -2, -8.75, -9.5, 6.1, -8.0, true);
  box(m.wall, -9.5, 3.0, -8.75, -3.6, 6.1, -8.0);
  box(m.wall, -3.6, -2, -8.75, -3.5, 3.35, -8.0, true);
  box(m.inner, -10.0, -2, -24, -9.5, 3.0, -8.75, true);
  box(m.shadow, -9.52, -2, -11.2, -9.48, 3.0, -8.75);
  box(m.inner, -10.0, -2, -24.5, -3.0, 3.0, -24.0, true);
  box(m.shadow, -9.5, -2, -23.98, -6.0, 2.4, -23.9);
  box(m.inner, -10.0, 3.0, -24.5, -3.0, 3.4, -8.75);
  box(m.wall, XD0, 6.1, -8.75, -1.95, TOP, -8.0);
  box(m.wall, -1.95, 6.1, -8.75, 1.75, 6.85, -8.0);
  box(m.wall, 1.75, 6.1, -8.75, 6.0, TOP, -8.0);
  box(m.wall, 6.0, 6.1, -8.75, 12.5, TOP, -8.0);
  box(m.wall, 12.5, 7.0, -8.75, XD1, TOP, -8.0);
  box(m.inner, 4.5, 3.75, -8.75, 6.0, 6.1, -8.0);
  box(m.wall, 6.0, 4.2, -8.75, 7.0, 6.1, -8.0);
  box(m.wall, 7.0, 4.6, -8.75, 12.5, 6.1, -8.0);
  box(m.wall, 12.5, 4.6, -8.75, XD1, 4.9, -8.0);

  const sx = (px: number, z: number): number => CAM_D.hit(px, 470, 'z', z)[0];
  const sy = (py: number, z: number): number => CAM_D.hit(715, py, 'z', z)[1];

  // --- 2 枚目の壁（前面 z -13） ---
  const Z2 = -13.0;
  const Z2b = -14.5;
  const a2l = sx(560, Z2);
  const a2r = sx(850, Z2);
  const a2t = sy(285, Z2);
  const w2l = sx(625, Z2);
  const w2r = sx(800, Z2);
  const w2b = sy(235, Z2);
  box(m.inner, XD0, -2, Z2b, a2l, TOP, Z2, true);
  box(m.inner, a2r, -2, Z2b, 12.5, TOP, Z2, true);
  box(m.inner, 12.5, -2, Z2b, XD1, UPPER_Y, Z2, true);
  box(m.inner, 12.5, 7.0, Z2b, XD1, TOP, Z2, true);
  box(m.inner, a2l, a2t, Z2b, w2l, TOP, Z2);
  box(m.inner, w2r, a2t, Z2b, a2r, TOP, Z2);
  box(m.inner, w2l, a2t, Z2b, w2r, w2b, Z2);
  box(m.inner, a2l, sy(330, Z2), Z2b, sx(600, Z2), a2t, Z2);
  box(m.inner, sx(600, Z2), sy(300, Z2), Z2b, sx(640, Z2), a2t, Z2);

  // --- 3 枚目: トンネルの入口（前面 z -18） ---
  const Z3 = -18.0;
  const Z3b = -19.0;
  // トンネルの口: 参考画像で測った段々のアーチ（下の幅 x 632〜813・段 3 つ・上 y 338）
  const a3l = sx(632, Z3);
  const a3r = sx(813, Z3);
  const a3t = sy(338, Z3);
  box(m.inner, XD0, -2, Z3b, a3l, 9.0, Z3, true);
  box(m.inner, a3r, -2, Z3b, 12.5, 9.0, Z3, true);
  box(m.inner, 12.5, -2, Z3b, XD1, UPPER_Y, Z3, true);
  box(m.inner, 12.5, 7.0, Z3b, XD1, 9.0, Z3, true);
  box(m.inner, a3l, a3t, Z3b, a3r, 9.0, Z3);
  for (const [pl, pr, py] of [[640, 805, 370], [655, 795, 357], [677, 780, 345]] as [number, number, number][]) {
    box(m.inner, a3l, sy(py, Z3), Z3b, sx(pl, Z3), a3t, Z3);
    box(m.inner, sx(pr, Z3), sy(py, Z3), Z3b, a3r, a3t, Z3);
  }
  box(m.dark, a3l - 0.5, -2, -40, a3l, a3t, Z3b);
  box(m.dark, a3r, -2, -40, a3r + 0.5, a3t, Z3b);
  // トンネルの天井: 口から 2 m は口の高さ、その先は 3.6 m に下がる（上は 2 階のラウンジの床。暗い同じ色なので段は見えない）
  box(m.dark, a3l - 0.5, a3t, -21, a3r + 0.5, a3t + 0.4, Z3b);
  box(m.dark, a3l - 0.5, 3.6, -40, a3r + 0.5, 4.1, -21);
  box(m.dark, a3l - 0.5, 4.1, -21.5, a3r + 0.5, a3t, -21);
  box(m.inner, -8.0, -2, Z3, -7.0, 9.0, Z2b, true);
  box(m.inner, 7.0, -2, Z3, 8.0, 9.0, Z2b, true);

  // --- 1 枚目の壁の開口の見込み ---
  box(m.reveal, -3.52, -2, -8.74, -3.48, 3.35, -8.01, false, false);
  for (let i = 0; i < 4; i++) {
    const y0 = 3.35 + i * 0.375;
    const xw = -3.5 + (i + 1) * 0.4;
    box(m.reveal, xw - 0.02, y0, -8.74, xw + 0.02, y0 + 0.375, -8.01, false, false);
    box(m.reveal, -3.5, y0 - 0.02, -8.74, xw, y0 + 0.02, -8.01, false, false);
  }
  box(m.reveal, -1.9, 4.83, -8.74, 1.5, 4.87, -8.01, false, false);

  // --- 右: 暗い部屋 ---
  box(m.shadow, 4.5, -2, -12.5, XD1, 4.6, -12.0);
  box(m.shadow, 4.5, 3.25, -12.0, XD1, 4.6, -9.5);
  box(m.roomPillar, 7.5, -2, -12.0, 8.25, 3.25, -11.0, true);
  box(m.roomPillar, 10.5, -2, -12.0, 11.25, 3.25, -11.0, true);
  box(m.side, 5.5, -2, -9.6, XD1, 0.3, -8.8, true);

  // --- ガラスのかまぼこ屋根 ---
  const vault = (z0: number, z1: number, yc: number, R: number, cx0 = -0.1, step = 1.0): void => {
    for (let z = z0; z >= z1 - 1e-6; z -= step) {
      for (let a = 0; a < 12; a++) {
        const t0 = ((a + 0.5) / 12) * Math.PI;
        b.box(m.glass, [X(cx0 + Math.cos(t0) * R), yc + Math.sin(t0) * R, Z(z)], [0.07, (Math.PI * R) / 12 + 0.02, 0.07], { rotZ: t0, shadow: false });
      }
    }
    for (let a = 1; a < 12; a += 2) {
      const t0 = (a / 12) * Math.PI;
      const cx = cx0 + Math.cos(t0) * R;
      const cy = yc + Math.sin(t0) * R;
      b.boxMM(m.glass, [X(cx - 0.03), cy - 0.03, Z(z1)], [X(cx + 0.03), cy + 0.03, Z(z0)], { shadow: false });
    }
    const g = new THREE.CylinderGeometry(R + 0.05, R + 0.05, z0 - z1, 24, 1, true, -Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    b.mesh(g, m.pane, [X(cx0), yc, Z((z0 + z1) / 2)], { shadow: false });
  };
  vault(ZD1, -8.75, 6.85, 1.85);
  vault(-14.5, -18.0, 5.6, 1.75, -0.15, 1.5);
  box(m.wall, XD0, TOP, -8.0, -1.95, TOP + 0.5, ZD1);
  box(m.wall, 1.75, TOP, -8.0, XD1, TOP + 0.5, ZD1);
  box(m.wall, -2.2, 6.85, -8.0, -1.95, TOP + 0.5, ZD1);
  box(m.wall, 1.75, 6.85, -8.0, 2.0, TOP + 0.5, ZD1);
  box(m.wall, XD0, TOP, ZD0, -2.15, TOP + 0.5, -8.0);
  box(m.wall, 1.85, TOP, ZD0, XD1, TOP + 0.5, -8.0);
  box(m.wall, -4, 9.0, -40, 4, 9.5, ZD0);
  b.boxMM(m.sky, [X(XD0), 14, Z(ZD0)], [X(XD1), 14.2, Z(ZD1)], { shadow: false });

  // --- 影の形（見えない板） ---
  const sun = new THREE.Vector3(...SUN_D);
  const onZ = (zf: number, px: [number, number][]): V3[] => px.map(([x, y]) => {
    const h = CAM_D.hit(x, y, 'z', zf);
    return [X(h[0]), h[1], Z(h[2])];
  });
  const onX = (xf: number, px: [number, number][]): V3[] => px.map(([x, y]) => {
    const h = CAM_D.hit(x, y, 'x', xf);
    return [X(h[0]), h[1], Z(h[2])];
  });
  gobo(k.b, onZ(-6.8, [[975, 60], [1190, 60], [1190, 335], [1160, 340], [1160, 360], [1150, 365], [1145, 400], [1135, 420], [1110, 440], [1090, 460], [1072, 480], [1052, 500], [1045, 552], [975, 552]]), sun, 0.25);
  gobo(k.b, onZ(-8.0, [[835, -20], [985, -20], [985, 552], [850, 552], [850, 150], [795, 150], [795, 125], [812, 90], [825, 40]]), sun, 0.2);
  gobo(k.b, onZ(-13.0, [[380, 240], [585, 262], [578, 285], [560, 300], [545, 330], [530, 360], [510, 400], [490, 430], [470, 460], [450, 492], [380, 492]]), sun, 0.3);
  gobo(k.b, onZ(-13.0, [[860, 120], [860, 492], [765, 492], [745, 400], [735, 335], [760, 280], [785, 230], [810, 180], [830, 140]]), sun, 0.3);
  gobo(k.b, onZ(-8.0, [[1180, -40], [1480, -40], [1480, 40], [1440, 75], [1405, 100], [1375, 125], [1335, 152], [1300, 178], [1265, 200], [1180, 205]]), sun, 0.2);
  gobo(k.b, onZ(-8.0, [[1290, 200], [1310, 175], [1350, 150], [1480, 145], [1480, 260], [1180, 260], [1180, 205]]), sun, 0.2);
  gobo(k.b, onX(-9.5, [[100, 270], [215, 270], [215, 335], [190, 370], [160, 420], [130, 470], [110, 505], [100, 505]]), sun, 0.2);
  gobo(k.b, onZ(-8.0, [[-20, 145], [75, 142], [80, 155], [130, 180], [165, 185], [170, 195], [150, 200], [90, 215], [70, 245], [80, 260], [150, 262], [205, 265], [205, 560], [-20, 560]]), sun, 0.2);

  // ---- 写っていない所 ----
  // A との間の壁の上の部分（A の天井より上。D は天井が高い）
  box(m.wall, XD0 - 1, 4.8, ZD1, XD1 + 1, TOP + 0.5, ZD1 + 1, true);
  // 外周の壁（西: 休憩コーナーへの扉、東: E への通路の扉、北: 洞窟のトンネルの口・2 階のラウンジの扉）
  perimeterWall(env, 'D', 'w', m.inner, { y1: TOP + 0.5 });
  // 2 階の回廊（3 枚目の壁の奥）を部屋と同じ決まりで。東の外壁に縦長の窓（外の明るさ）
  const gallery: RoomDef = { id: 'galleryD', label: '2 階の回廊', kind: 'corridor', rect: [X(8.0), Z(ZD0), X(XD1), Z(Z3b)], floor: UPPER_Y, ceil: TOP, zone: 'D', doors: [{ side: 's', a: X(12.5), b: X(XD1), kind: 'open' }] };
  const gwin = clerestories(gallery).filter((w) => w.side === 'e');
  perimeterWall(env, 'D', 'e', m.wall, { y1: TOP + 0.5, extra: gwin.map((w) => ({ at: (w.a + w.b) / 2 - (Z(ZD0) - 1), width: w.b - w.a, bottom: w.bottom, top: w.top })) });
  perimeterWall(env, 'D', 'n', m.inner, { y1: 9.5, extra: [{ at: ox + (a3l + a3r) / 2 - (ox + XD0 - 1), width: a3r - a3l + 1.2, bottom: -2.5, top: a3t + 0.6 }] });
  // 南のプールサイド（A・休憩コーナー・E への通路の扉の前）と池へ下りる段
  k.deck(m.wall, X(XD0), Z(2.0), X(XD1), Z(ZD1), 0.15);
  for (const [x0, x1] of [[-8.0, -5.0], [5.5, 8.5]] as [number, number][]) {
    k.box(m.wall, [X(x0), -2, Z(1.5)], [X(x1), -0.1, Z(2.0)], { collide: true });
    k.box(m.wall, [X(x0), -2, Z(1.0)], [X(x1), -0.3, Z(1.5)], { collide: true });
  }
  // 東の壁ぞいの階段（2 階の回廊へ。視点の画角の外）: 池の中に立つ段々の塊
  const st = stairs(k.b, m.wall, [X(13.25), DECK, Z(1.6)], '-z', UPPER_Y - DECK, 1.5, { riser: 0.17, tread: 0.28 });
  k.box(m.wall, [X(12.5), -2, st.top[2]], [X(14), DECK, Z(1.6)], { collide: true });
  k.box(m.wall, [X(12.5), -2, st.top[2] - 1.66], [X(14), UPPER_Y, st.top[2]], { collide: true });
  // 2 階の回廊: 東の暗いアーケードの上（1 枚目と 2 枚目の壁の間）・2 枚目と 3 枚目の間・3 枚目の奥（北の壁の扉でラウンジへ）
  k.box(m.wall, [X(4.5), 4.6, Z(-13.0)], [X(XD1), UPPER_Y, Z(-8.75)], { collide: true });
  k.box(m.inner, [X(4.5), UPPER_Y, Z(-13.0)], [X(4.6), UPPER_Y + 1.1, Z(-8.75)], { collide: true });
  k.box(m.inner, [X(8.0), -2, Z(Z3)], [X(XD1), UPPER_Y, Z(Z2b)], { collide: true });
  k.box(m.inner, [X(8.0), -2, Z(ZD0)], [X(XD1), UPPER_Y, Z(Z3b)], { collide: true });
  k.box(m.inner, [X(7.75), UPPER_Y, Z(ZD0)], [X(8.0), 8.0, Z(Z3b)], { collide: true });
  k.box(m.inner, [X(8.0), 8.0, Z(ZD0)], [X(XD1), 8.3, Z(Z2b)]);
  dressSpace(k.b, env.rm, gallery, env.fin.corridor);
  k.b.boxMM(env.rm.lampFrame, [X(10.4), 7.45, Z(-16.0) - 0.6], [X(11.6), 7.5, Z(-16.0) + 0.6], { shadow: false });
  k.b.boxMM(env.rm.lamp, [X(10.45), 7.44, Z(-16.0) - 0.55], [X(11.55), 7.45, Z(-16.0) + 0.55], { shadow: false });
  // ---- 置く物 ----
  const F = (x: number, z: number, kk: number, y = DECK): Frame => new Frame(k.b, [X(x), y, Z(z)], kk);
  lifeguardChair(dr, F(9.5, 4.0, 2));
  for (const x of [-11.0, -6.5]) deckBench(dr, F(x, 5.5, 2), 2.4);
  for (const x of [-6.5, 7.0]) stairRail(dr, F(x, 2.1, 2), 1.0, 0.65);
  depthMark(dr, F(-2.5, 2.2, 2), 0.5);
  depthMark(dr, F(3.0, 2.2, 2), 0.5);
  plant(dr, F(-13.2, 5.4, 0));
  plant(dr, F(11.6, 5.4, 0));
  const S = (x: number): Frame => new Frame(k.b, [X(x), 0, Z(ZD1)], 2);
  clock(dr, S(-3.0), 3.2, 0.32);
  rescueBoard(dr, S(1.5));
  wallNotice(dr, S(4.0), dr.signs.caution(51, 'dive'), 0.5, 0.62, 1.5);
  wallNotice(dr, S(5.0), dr.signs.notice(52), 0.6, 0.8, 1.5);
  decal(new Frame(k.b, [X(XD0), 0, Z(4.0)], 1), dr.signs.label('休憩コーナー', '←'), [0, 2.75, 0.01], 1.4, 0.35);
  decal(new Frame(k.b, [X(XD1), 0, Z(4.0)], 3), dr.signs.label('25mプール', '→'), [0, 2.75, 0.01], 1.4, 0.35);
  exitSign(dr, new Frame(k.b, [X(XD0), 0, Z(4.25)], 1), 2.6);
  exitSign(dr, new Frame(k.b, [X(XD1), 0, Z(4.25)], 3), 2.6);
  decal(F(XD1, -6.6, 3, UPPER_Y), dr.signs.label('2F ラウンジ', '↑'), [0, 2.2, 0.01], 1.2, 0.3);
  // 外周の壁の柱型・腰の帯・蛇腹（南のプールサイドの側だけ。pool-3 の画角と映り込みの外）
  hallDress(env, 'D', { pier: m.wall, ceil: TOP, cam: CAM_D, sun: new THREE.Vector3(...SUN_D), skip: ['n', 'e'], avoid: [[X(XD0) - 1, Z(ZD0) - 1, X(XD1) + 1, Z(-8.0)]] });
}

/** D のトンネル（3 枚目の壁の口）の場面の座標での横の範囲と高さ（洞窟の水路をつなぐのに使う） */
export function dTunnel(): { x0: number; x1: number; top: number } {
  const [ox] = HALL.D.o;
  const sx = (px: number, z: number): number => CAM_D.hit(px, 470, 'z', z)[0];
  const sy = (py: number, z: number): number => CAM_D.hit(715, py, 'z', z)[1];
  return { x0: ox + sx(632, -18), x1: ox + sx(813, -18), top: sy(338, -18) };
}
