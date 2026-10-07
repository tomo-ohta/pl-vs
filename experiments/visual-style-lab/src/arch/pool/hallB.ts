import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { roofGobo, T, towardSun } from '../../scenes/pool/kit.ts';
import { Frame } from './frame.ts';
import { perimeterWall, type HallEnv } from './hallkit.ts';
import { hallDress } from './halldress.ts';
import { bench, clock, decal, deckBench, depthMark, drain, exitSign, lifeguardChair, plant, rescueBoard, stairRail, wallNotice, type Dress } from './props.ts';
import { CAM_B, SUN_B } from '../../scenes/pool/zoneB.ts';
import { HALL, type RoomDef } from './layout.ts';
import { dressSpace } from './rooms.ts';

/**
 * ホール B「柱の森」（pool-1）。浅い段々の池（水深 0.3〜0.6 m）の中に、7.6 × 9 m の升目で太い角柱が立つ。
 * 柱は段々に広がる柱頭で、すぐ頭上の重い梁の格子につながる。梁の間は天窓（空が見える）。
 * 視点は南西の角に近い池の中（目は水面から 1.33 m）から北東を見る。見た目は元の版（zoneB.ts）を写して、壁の内へ切った。
 * 区域の座標の原点 = pool-1 の視点の真下の水面。
 */
export { CAM_B, SUN_B };

/** 区域の座標での内側の範囲（西・北・東・南） */
export const B_RECT = { x0: -4, z0: -40.5, x1: 45.5, z1: 6 };
const GOBO_Y = 8.0;

export function buildHallB(env: HallEnv, dr: Dress): void {
  const k = env.k;
  const [ox, oz] = HALL.B.o;
  const { x0: XB0, z0: ZB0, x1: XB1, z1: ZB1 } = B_RECT;
  const m = k.b.ctx.mat;
  const tl = (grout: string, size = T) => ({ size, line: 0.014, color: grout, jitter: 0.02 });
  const shaft = m({ name: 'b-shaft', color: '#80b8ae', hi: '#80b8ae', shade: '#7eb7ad', dark: '#6aa29c', tiles: tl('#6ea69c') });
  const col = m({ name: 'b-col', color: '#f2f8f1', hi: '#fbfdf9', shade: '#7eb7ad', dark: '#5f9893', tiles: tl('#d3e2db') });
  const cap = m({ name: 'b-cap', color: '#8cc0b6', hi: '#8cc0b6', shade: '#84bbb2', dark: '#6aa29c', tiles: tl('#79ada3') });
  const beam = m({ name: 'b-beam', color: '#97c6bc', hi: '#97c6bc', shade: '#8fc0b6', dark: '#76aaa2', tiles: tl('#80b2a8', 2 * T) });
  const block = m({ name: 'b-block', color: '#f3f7ef', hi: '#fcfefa', shade: '#a9cdc4', dark: '#86b4aa', tiles: tl('#d9e4dc') });
  // 暗い青緑のタイル（北西の前室・北と東の壁）。日なたも陰も同じ色（元の版の照明なしと同じ見え方で、霧と影の扱いは他の壁と同じ）
  const recess = m({ name: 'b-recess', color: '#4c7b84', shade: '#4c7b84', dark: '#4c7b84', hi: '#4c7b84', tiles: { size: T, line: 0.012, color: '#44717a' } });
  const colNL = m({ name: 'b-colNL', color: '#a8cbc2', hi: '#b9d6cd', shade: '#6e9b96', dark: '#5f8e89', tiles: tl('#8fb3ab') });
  const ceilB = m({ name: 'b-ceil', color: '#d4e8e2', hi: '#e2f0ec', shade: '#a9cfc7', dark: '#93c1b8', tiles: tl('#b9d6cf', 2 * T) });
  const sky = m({ name: 'b-sky', color: '#a9d3d0', unlit: true, noFog: true, line: 0, blotch: { color: '#f4fbf7', scale: 0.12, threshold: -0.05 } });

  const X = (x: number): number => ox + x;
  const Z = (z: number): number => oz + z;
  const cx0 = (x: number): number => Math.max(XB0, Math.min(XB1, x));
  const cz0 = (z: number): number => Math.max(ZB0, Math.min(ZB1, z));
  const box = (mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, collide = false): void => {
    const sh = mat === beam || mat === cap || mat === colNL ? 'receive' : true;
    k.box(mat, [X(Math.min(x0, x1)), Math.min(y0, y1), Z(Math.min(z0, z1))], [X(Math.max(x0, x1)), Math.max(y0, y1), Z(Math.max(z0, z1))], { collide, shadow: sh });
  };
  const rbox = (mat: THREE.Material, o: [number, number], a: number, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number): V3[] => {
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cx = o[0] + cu * ca + cv * sa;
    const cz = o[1] - cu * sa + cv * ca;
    k.b.box(mat, [X(cx), (y0 + y1) / 2, Z(cz)], [u1 - u0, y1 - y0, v1 - v0], { rotY: a, collide: true });
    const hu = (u1 - u0) / 2;
    const hv = (v1 - v0) / 2;
    const ex = Math.abs(hu * ca) + Math.abs(hv * sa);
    const ez = Math.abs(hu * sa) + Math.abs(hv * ca);
    if (y0 < 0) {
      const c = k.hf.cell;
      for (let zz = Math.floor((cz - ez) / c) * c; zz < cz + ez; zz += c)
        for (let xx = Math.floor((cx - ex) / c) * c; xx < cx + ex; xx += c) {
          const dx = xx + c / 2 - cx;
          const dz = zz + c / 2 - cz;
          const lu = dx * ca - dz * sa;
          const lv = dx * sa + dz * ca;
          if (Math.abs(lu) <= hu && Math.abs(lv) <= hv) k.hf.rect(X(xx), Z(zz), X(xx + c), Z(zz + c), y1 >= 0 ? 50 : y1, 'max');
        }
    }
    const pts: V3[] = [];
    for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]) pts.push([o[0] + u * ca + v * sa, y1, o[1] - u * sa + v * ca]);
    return pts;
  };

  const SX = 7.6;
  const SZ = 9;
  const CX = (i: number): number => 6 + i * SX;
  const CZ = (j: number): number => -7 - j * SZ;
  const HW = 0.5625;
  const CAP0 = 2.82;
  const CAP1 = 3.05;
  const BEAM0 = 3.35;
  const BEAMT = 4.1;
  const BW = 0.9;

  const BOTTOM = -0.6;
  k.basin(X(XB0), Z(ZB0), X(XB1), Z(ZB1), BOTTOM);
  k.basin(X(-1.0), Z(-1.0), X(1.0), Z(1.5), -0.3);

  // 柱の森（壁の内に台座が収まる柱だけ。目のまわりは無い）
  const inside = (i: number, j: number): boolean => CX(i) - 1.6 >= XB0 && CX(i) + 1.6 <= XB1 && CZ(j) - 1.6 >= ZB0 && CZ(j) + 1.6 <= ZB1;
  const has = (i: number, j: number): boolean => inside(i, j) && !(j === -1 && i <= 0) && !(j === 0 && i === -1);
  for (let j = -1; j <= 6; j++)
    for (let i = -4; i <= 6; i++) {
      if (!has(i, j)) continue;
      const cx = CX(i);
      const cz = CZ(j);
      box(col, cx - 1.6, -2, cz - 1.6, cx + 1.6, -0.05, cz + 1.6, true);
      box(col, cx - 1.1, -0.05, cz - 1.1, cx + 1.1, 0.25, cz + 1.1, true);
      box(col, cx - 0.8, 0.25, cz - 0.8, cx + 0.8, 0.52, cz + 0.8, true);
      box(shaft, cx - HW, 0.52, cz - HW, cx + HW, CAP0, cz + HW, true);
      box(cap, cx - 0.85, CAP0, cz - 0.85, cx + 0.85, CAP1, cz + 0.85);
      box(cap, cx - 1.25, CAP1, cz - 1.25, cx + 1.25, BEAM0, cz + 1.25);
    }
  // 梁の格子
  for (let j = 0; j <= 6; j++) if (CZ(j) - BW >= ZB0) box(beam, cx0(CX(-4) - 1.25), BEAM0, CZ(j) - BW, cx0(CX(6) + 1.25), BEAMT, CZ(j) + BW);
  for (let i = -4; i <= 6; i++) if (CX(i) - BW >= XB0 && CX(i) + BW <= XB1) box(beam, CX(i) - BW, BEAM0, cz0(CZ(6) - 1.25), CX(i) + BW, BEAMT, cz0(i <= 0 ? CZ(0) + 1.25 : 6));
  box(cap, 5.07, BEAM0 - 0.05, -7.35, 8.44, 3.84, -4.71);
  box(beam, CX(0) - BW, BEAMT, CZ(0) - BW, CX(0) + BW, 5.0, ZB1);
  {
    const nr = CAM_B.hit(140, 408 + (CAM_B.f * 1.33) / 6.0, 'y', 0);
    box(colNL, nr[0] - 2 * HW, -2, nr[2] - 2 * HW, nr[0], BEAMT, nr[2], true);
    box(cap, nr[0] - 2 * HW - 0.35, 3.44, nr[2] - 2 * HW - 0.35, nr[0] + 0.6, BEAMT, nr[2] + 0.35);
  }
  // 天井の板（梁の上）。開口は天窓
  {
    const y0 = BEAMT;
    const shape = new THREE.Shape([new THREE.Vector2(XB0, -ZB1), new THREE.Vector2(XB1, -ZB1), new THREE.Vector2(XB1, -ZB0), new THREE.Vector2(XB0, -ZB0)]);
    const polys: [number, number][][] = [
      [[-40, -60], [140, -60], [140, 30], [60, 55], [-40, 60]],
      [[170, -60], [570, -60], [560, 30], [420, 45], [170, 30]],
      [[590, -60], [960, -60], [950, 25], [800, 125], [600, 125]],
      [[1090, -60], [1290, -60], [1280, 45], [1100, 50]],
      [[1150, 185], [1400, 118], [1480, 110], [1480, 250], [1150, 250]],
      [[150, 140], [470, 160], [470, 240], [150, 240]],
    ];
    for (const poly of polys)
      shape.holes.push(new THREE.Path(poly.map(([px, py]) => {
        const h = CAM_B.hit(px, py, 'y', y0);
        return new THREE.Vector2(h[0], -h[2]);
      })));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    k.b.mesh(geo, ceilB, [X(0), y0, Z(0)], { shadow: 'receive' });
  }
  // 空（天窓から見える明るい面）。浅い角度で天窓をのぞいても切れないよう、北と東へ広げる
  k.b.boxMM(sky, [X(XB0 - 1), 14, Z(ZB0 - 60)], [X(XB1 + 60), 14.2, Z(ZB1 + 1)], { shadow: false });

  // 北西の角の前室（暗い青緑のタイル。B から E へ抜ける通路）: 南の面の入口は視点から左手前の柱の陰
  const PR = { x0: XB0, z0: ZB0, x1: 1.75, z1: -20.75 };
  k.deck(block, X(PR.x0), Z(PR.z0), X(PR.x1), Z(PR.z1), 0.15);
  k.box(recess, [X(PR.x1), -2, Z(PR.z0)], [X(2.0), BEAM0, Z(-20.5)], { collide: true });
  k.box(recess, [X(-1.5), -2, Z(PR.z1)], [X(2.0), BEAM0, Z(-20.5)], { collide: true });
  k.box(recess, [X(PR.x0), 2.3, Z(PR.z1)], [X(-1.5), BEAM0, Z(-20.5)], { collide: true });
  k.box(recess, [X(PR.x0), 2.8, Z(PR.z0)], [X(PR.x1), 3.0, Z(PR.z1)], { shadow: true });
  // 前室の入口の前の小さなプールサイドと、池へ下りる段
  k.deck(block, X(PR.x0), Z(-20.5), X(-1.0), Z(-18.5), 0.15);
  k.box(block, [X(PR.x0), -2, Z(-18.5)], [X(-1.0), -0.1, Z(-18.0)], { collide: true });
  k.box(block, [X(PR.x0), -2, Z(-18.0)], [X(-1.0), -0.35, Z(-17.5)], { collide: true });
  // 外周の壁（北: 前室の奥に E への扉、東: 外壁、南: 機械室・便所・採暖室の扉）
  perimeterWall(env, 'B', 'n', recess, { y1: 4.4 });
  perimeterWall(env, 'B', 'e', recess, { y1: 4.4 });
  perimeterWall(env, 'B', 's', block, { y1: 4.4 });
  // 南のプールサイド（A からの扉・南の部屋の扉の前）と、池へ下りる段
  k.deck(block, X(XB0), Z(3.6), X(XB1), Z(ZB1), 0.15);
  for (const [x0, x1] of [[-3.5, -1.0], [21.0, 23.5]] as [number, number][]) {
    k.box(block, [X(x0), -2, Z(3.1)], [X(x1), -0.1, Z(3.6)], { collide: true });
    k.box(block, [X(x0), -2, Z(2.6)], [X(x1), -0.35, Z(3.1)], { collide: true });
  }
  // 視点の後ろの横の梁（柱の列 j = -1 の上）
  box(beam, XB0, BEAM0, 1.1, XB1, BEAMT, 2.9);

  const ya = CAM_B.yaw;
  const o0: [number, number] = [0, 0];
  const uAt = (px: number, d: number): number => ((px - 728) * d) / CAM_B.f;
  const fbox = (mat: THREE.Material, px0: number, px1: number, d0: number, d1: number, y0: number, y1: number): V3[] =>
    rbox(mat, o0, ya, uAt(px0, d0), uAt(px1, d0), -d1, -d0, y0, y1);
  const lit: V3[][] = [];
  lit.push(fbox(block, 75, 330, 4.5, 5.0, -2, 0.12));
  lit.push(fbox(block, 75, 290, 5.0, 5.67, -2, 0.43));
  lit.push(fbox(block, 80, 140, 5.0, 5.5, 0.43, 1.07));
  for (let n = 0; n < 5; n++) {
    const h = [0.2, 0.21, 0.19, 0.21, 0.2][n];
    lit.push(fbox(block, 1100 + n * 63, 1161 + n * 63, 2.86, 3.1, 0, h));
  }
  box(block, 3.0, -2, -0.6, 10, 0.1, 3, true);
  lit.push([[3.0, 0.1, -0.6], [10, 0.1, -0.6], [10, 0.1, 3], [3.0, 0.1, 3]]);
  box(block, 8.0, -2, -1.6, 10, 0.35, -0.6, true);
  lit.push([[8.0, 0.35, -1.6], [10, 0.35, -1.6], [10, 0.35, -0.6], [8.0, 0.35, -0.6]]);
  lit.push(fbox(block, 1300, 1390, 5.6, 6.2, -2, 0.12));

  // --- 日の差し込む所（見えない屋根の穴） ---
  const sun = new THREE.Vector3(...SUN_B);
  const up = (pts: V3[]): [number, number][] => pts.map((p) => towardSun(p, sun, GOBO_Y));
  const onBottom = (px: [number, number][]): V3[] =>
    px.map(([x, y]) => {
      const p = CAM_B.hit(x, y, 'y', 0);
      const I = CAM_B.ray(x, y);
      const eta = 1 / 1.333;
      const ni = I.y;
      const kk = 1 - eta * eta * (1 - ni * ni);
      const r = I.clone().multiplyScalar(eta).sub(new THREE.Vector3(0, eta * ni + Math.sqrt(Math.max(kk, 0)), 0));
      const t = BOTTOM / r.y;
      return [p[0] + r.x * t, BOTTOM, p[2] + r.z * t];
    });
  const rect = (x0: number, z0: number, x1: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const holes: [number, number][][] = [
    up(onBottom([[600, 705], [752, 688], [880, 688], [912, 712], [1072, 728], [1120, 740], [1250, 750], [1300, 764], [1312, 792], [1290, 830], [270, 830], [440, 790], [464, 756], [544, 740], [576, 716]])),
    up(onBottom([[370, 522], [560, 520], [578, 560], [500, 582], [400, 584], [350, 566]])),
    up(onBottom([[1050, 524], [1270, 522], [1270, 556], [1200, 568], [1100, 568], [1050, 548]])),
    up(onBottom([[1300, 536], [1385, 536], [1385, 556], [1300, 556]])),
    up(onBottom([[-10, 466], [60, 466], [60, 545], [-10, 545]])),
    ...lit.map((q) => up(q)),
    up(rect(CX(0) - 1.6, CZ(0) + 1.1, CX(0) + 1.6, CZ(0) + 1.6, 0.25)),
  ];
  roofGobo(k.b, [X(XB0 - 6), Z(ZB0 - 2), X(XB1 + 2), Z(ZB1 + 8)], GOBO_Y, 0.125, holes.map((h) => h.map(([x, z]) => [X(x), Z(z)] as [number, number])));

  // ---- 置く物（視点の後ろ・南のプールサイド・前室の中） ----
  const F = (x: number, z: number, kk: number, y = 0.15): Frame => new Frame(k.b, [X(x), y, Z(z)], kk);
  lifeguardChair(dr, F(30.0, 4.6, 2));
  for (const x of [5.0, 16.5, 38.0]) deckBench(dr, F(x, 5.5, 2), 2.4);
  for (const x of [8.0, 16.0, 26.0, 34.0, 42.0]) drain(dr, F(x, 4.8, 0), 0.6, 0.3);
  for (const x of [-0.5, 24.0]) stairRail(dr, F(x, 3.8, 2), 1.0, 0.75);
  for (const x of [2.0, 18.0, 40.0]) depthMark(dr, F(x, 3.85, 2), 0.6);
  plant(dr, F(1.8, 5.3, 0));
  plant(dr, F(44.6, 5.2, 0));
  // 南の壁（北を向く）
  const S = (x: number): Frame => new Frame(k.b, [X(x), 0, Z(ZB1)], 2);
  clock(dr, S(10.0), 2.9, 0.3);
  rescueBoard(dr, S(16.0));
  wallNotice(dr, S(20.0), dr.signs.notice(21), 0.6, 0.8, 1.5);
  wallNotice(dr, S(20.9), dr.signs.caution(22, 'run'), 0.5, 0.62, 1.5);
  wallNotice(dr, S(28.0), dr.signs.board(23), 1.6, 1.0, 1.6);
  decal(S(-0.75), dr.signs.label('便所'), [0, 2.65, 0.01], 0.8, 0.22);
  decal(S(11.6), dr.signs.label('採暖室'), [0, 2.65, 0.01], 1.0, 0.25);
  decal(S(33.75), dr.signs.label('関係者以外立入禁止'), [0, 2.65, 0.01], 1.6, 0.3);
  exitSign(dr, new Frame(k.b, [X(XB0), 0, 4.9], 1), 2.75);
  // 前室の中（ベンチ・案内・灯り）
  const P = (x: number, z: number, kk: number): Frame => new Frame(k.b, [X(x), 0.15, Z(z)], kk);
  for (const z of [-24.0, -29.0, -34.0]) bench(dr, P(PR.x0 + 0.3, z, 1), 1.8, 0.4);
  decal(new Frame(k.b, [X(PR.x1), 0, Z(-26)], 3), dr.signs.label('25mプール', '↑'), [0, 2.0, 0.01], 1.4, 0.35);
  // 前室を部屋と同じ決まりで（白いタイルの柱型と梁・暗い青緑の腰・吊り下げの灯りと光だまり）。入口は南の面
  const ante: RoomDef = { id: 'anteB', label: '前室', kind: 'corridor', rect: [X(PR.x0), Z(PR.z0), X(PR.x1), Z(PR.z1)], floor: 0.15, ceil: 2.8, zone: 'B', doors: [{ side: 's', a: X(PR.x0), b: X(-1.5), kind: 'open' }] };
  dressSpace(k.b, env.rm, ante, env.fin.corridor);
  exitSign(dr, new Frame(k.b, [X(-1.5), 0, Z(ZB0)], 0), 2.6);
  // 外周の壁の柱型・腰の帯・蛇腹（pool-1 の画角と映り込みの外だけ。西は前室）
  hallDress(env, 'B', { pier: col, ceil: BEAMT, cam: CAM_B, sun: new THREE.Vector3(...SUN_B), skip: ['w'] });
}
