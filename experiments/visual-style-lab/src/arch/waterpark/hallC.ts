import * as THREE from 'three';
import { stairs } from '../kit.ts';
import { ShiftCam } from './cam.ts';
import { buildSlide, duct, floodlight, HallKit, railing, roundLight, stairRail, stepEdges, type SlidePal } from './hallkit.ts';
import { HALL } from './layout.ts';
import { buildPool, floorColliders, floorWithHoles, type PoolBuilt, type PoolDef, type PoolMats } from './pools.ts';
import type { P2 } from './sweep.ts';

/**
 * C: 円いプールの広間（waterpark-2）。
 * 目は手前の通路（斜めに円いプールへ渡る）から北を見る。西に南（目の側）へ上がるタイル張りの階段（2 階の観覧通路へ）、その下に低い水槽。
 * 東に円いプール（ミントの筒のスライダーの着水）、奥に柵のある板張りの段と、ミント・桃色の筒のスライダーの群れ、奥の壁の投光器。
 * 天井（10.4 m）は濃紺の空に白灰の積雲。西の天井は斜めの梁と灯り・ダクト。
 */
export const CAM_C = new ShiftCam([HALL.C.o[0], 1.6, HALL.C.o[1]], 0, 60, 186);

export interface HallCMats {
  floor: THREE.Material;
  deck: THREE.Material;
  wall: THREE.Material;
  backWall: THREE.Material;
  sky: THREE.Material;
  beam: THREE.Material;
  col: THREE.Material;
  stairFace: THREE.Material;
  stairTread: THREE.Material;
  deckTile: THREE.Material;
  nose: THREE.Material;
  riser: THREE.Material;
  rail: THREE.Material;
  duct: THREE.Material;
  ductBand: THREE.Material;
  pink: SlidePal;
  mint: SlidePal;
  tubeIn: THREE.Material;
  steel: THREE.Material;
  lampBody: THREE.Material;
  lampLit: THREE.Material;
  pool: PoolMats;
  low: PoolMats;
}

export const POOLS_C: PoolDef[] = [
  // 円いプール（東の手前）
  { id: 'C-round', ctrl: [[-0.8, -8.9], [0.4, -10.8], [2.6, -11.6], [5.4, -11.4], [8.0, -10.6], [9.4, -7.5], [8.6, -3.6], [5.8, -1.6], [2.6, -2.0], [0.4, -4.6], [-0.4, -6.8]], water: -0.14, bottom: -1.2, coping: 'round', cw: 0.32, ch: 0.08 },
  // 西の低い水槽（階段の下。水面が低く、タイルの壁が見える）
  { id: 'C-low', sharp: true, ctrl: [[-4.75, -1.4], [-0.9, -1.4], [-0.6, -7.3], [-4.75, -7.3]], water: -0.65, bottom: -1.4, coping: 'flush', cw: 0.3, ch: 0.04 },
  // 奥の西の着水プール（桃色の筒）
  { id: 'C-pinkpool', ctrl: [[-4.4, -11.4], [0.4, -11.2], [1.2, -12.6], [0.6, -14.0], [-3.6, -14.2], [-4.6, -13.0]], water: -0.14, bottom: -1.0, coping: 'round', cw: 0.3, ch: 0.08 },
];

export function buildHallC(k: HallKit, m: HallCMats): PoolBuilt[] {
  const H = HALL.C;
  const [x0, z0, x1, z1] = H.rect;
  const C = H.ceil;

  // ---- 壁。東は手前（z > -15）に腰より高い仕切り（3.4 m。桃色に照らされたタイル）、その向こうは休憩所
  k.box(m.backWall, [x0 - 0.5, 0, z0 - 0.5], [x1 + 0.5, C, z0], { collide: true });
  k.box(m.wall, [x0 - 0.5, 0, z0], [x0, C, z1], { collide: true });
  k.box(m.wall, [x1, 0, z0], [x1 + 0.5, C, z1], { collide: true });
  k.box(m.wall, [8.4, 0, -15], [8.8, 3.4, 5.5], { collide: true });
  k.box(m.wall, [8.4, 0, -15.4], [x1, 3.4, -15], { collide: true });
  k.box(m.steel, [8.35, 3.4, -15.4], [8.85, 3.5, 5.5], { shadow: false });
  // 仕切りの灯り（3 m）
  for (const z of [-4.5, -11.4, -14.6, 1.5]) roundLight(k, m.lampBody, m.lampLit, [8.36, 2.7, z], 0.14, 'x', -1);
  // 天井の空の絵
  const sky = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  sky.rotateX(Math.PI / 2);
  sky.translate((x0 + x1) / 2, C, (z0 + z1) / 2);
  k.mesh(sky, m.sky, { shadow: false });
  // 西の斜めの梁（灯り付き）とその下のダクト
  const beamA: [number, number] = [-9.0, -7.0];
  const beamB: [number, number] = [0.6, -27.0];
  for (const off of [0, -1.4]) {
    const a: [number, number, number] = [beamA[0] + off, C - 0.9, beamA[1]];
    const bb: [number, number, number] = [beamB[0] + off, C - 0.9, beamB[1]];
    const len = Math.hypot(bb[0] - a[0], bb[2] - a[2]);
    const g = new THREE.BoxGeometry(0.5, 1.8, len);
    g.rotateY(Math.atan2(-(bb[0] - a[0]), -(bb[2] - a[2])));
    g.translate((a[0] + bb[0]) / 2, a[1] + 0.0, (a[2] + bb[2]) / 2);
    k.mesh(g, m.beam, { shadow: false });
  }
  for (const t of [0.23, 0.4, 0.6, 0.78]) floodlight(k, m.lampBody, m.lampLit, [beamA[0] + (beamB[0] - beamA[0]) * t + 0.3, C - 1.85, beamA[1] + (beamB[1] - beamA[1]) * t], Math.PI / 2 + 0.4, { tilt: 1.1, w: 0.5, h: 0.22 });
  duct(k, m.duct, m.ductBand, [x0 + 0.8, 7.0, z1], [x0 + 0.8, 7.0, z0], 0.7);
  duct(k, m.duct, m.ductBand, [x0 + 2.2, 7.6, -2], [x0 + 6.5, 7.6, -24], 0.45);

  // ---- 柱
  // 東の柱（7.8 m の梁まで）と、南北に渡る梁・梁の下の投光
  k.box(m.col, [7.4, 0, -12.15], [8.3, 7.8, -11.25], { collide: true });
  k.box(m.col, [7.0, 0, -23.8], [7.8, 7.8, -23.0], { collide: true });
  k.box(m.beam, [7.0, 7.8, z0], [8.6, 8.5, z1], { shadow: false });
  for (const z of [-7.5, -14.5, -19.0]) floodlight(k, m.lampBody, m.lampLit, [7.6, 7.65, z], Math.PI / 2 + 0.3, { tilt: 0.9, w: 0.36, h: 0.2 });
  k.box(m.col, [-7.1, 0, -18.0], [-6.1, C, -17.0], { collide: true });
  k.box(m.col, [-5.0, 0, -26.0], [-4.2, C, -25.2], { collide: true });

  // ---- 西の階段（北の z = -12 から南へ上がり、2 階の観覧通路（4.4 m）へ）
  const SX0 = -6.8;
  const SX1 = -4.8;
  // 緩い階段（踏み面 0.36・蹴上げ 0.15。参考画像の階段は傾きが浅い）
  stairs(k.b, m.stairTread, k.p((SX0 + SX1) / 2, 0, -15.0), '+z', 4.4, SX1 - SX0, { tread: 0.36, riser: 0.15 });
  stepEdges(k, m.nose, m.riser, k.p((SX0 + SX1) / 2, 0, -15.0), '+z', 4.4, SX1 - SX0, { tread: 0.36, riser: 0.15 });
  // 階段の横の面（タイル。下の低い水槽の奥の壁まで続く）
  const face = new THREE.Shape([new THREE.Vector2(-15.0, 0), new THREE.Vector2(-15.0 + 10.6, 4.4), new THREE.Vector2(-15.0 + 10.6, -1.4), new THREE.Vector2(-7.3, -1.4), new THREE.Vector2(-7.3, 0)]);
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.25, bevelEnabled: false });
  fg.rotateY(-Math.PI / 2);
  fg.translate(SX1 + 0.25, 0, 0);
  k.mesh(fg, m.stairFace, { shadow: false });
  stairRail(k, m.rail, [SX1, 0, -15.0], [SX1, 4.4, -4.4], { h: 1.05, gap: 0.12 });
  // 2 階の観覧席の床（階段の上から南の壁まで）
  k.box(m.deckTile, [x0, 4.1, -4.4], [-3.0, 4.4, z1], { collide: true });
  // 観覧席の縁の腰壁（タイル張り 0.45 m）と笠木、その上の手すり
  k.box(m.stairFace, [-3.25, 4.4, -4.4], [-3.0, 4.85, z1], { collide: true });
  k.box(m.nose, [-3.3, 4.85, -4.4], [-2.95, 4.9, z1], { shadow: false });
  railing(k, m.rail, [-3.12, -4.4], [-3.12, z1], 4.9, { h: 0.65, gap: 0.12 });
  // 観覧席のベンチの段（2 段）
  for (const [x, h] of [[-6.6, 0.42], [-7.6, 0.84]] as [number, number][]) {
    k.box(m.stairFace, [x - 0.5, 4.4, -3.6], [x + 0.5, 4.4 + h, z1 - 0.4], { collide: true });
    k.box(m.nose, [x + 0.45, 4.4 + h - 0.02, -3.6], [x + 0.52, 4.4 + h + 0.01, z1 - 0.4], { shadow: false });
  }
  railing(k, m.rail, [SX1, -4.4], [-3.0, -4.4], 4.4, { h: 1.05, gap: 0.12 });

  // ---- 奥の板張りの段と柵
  k.box(m.deck, [0.4, 0, -16], [8.4, 0.3, -12.2], { collide: true });
  railing(k, m.rail, [0.9, -13.6], [3.6, -13.6], 0.3, { h: 1.0, gap: 0.12 });
  railing(k, m.rail, [4.8, -13.6], [8.3, -13.6], 0.3, { h: 1.0, gap: 0.12 });

  // ---- プール・床
  const pools = POOLS_C.map((d, i) => buildPool(k.b, i === 1 ? m.low : m.pool, { ...d, ctrl: d.ctrl.map(([x, z]): P2 => [x + k.ox, z + k.oz]) }));
  const [wx0, , wz0] = k.p(x0, 0, z0);
  const [wx1, , wz1] = k.p(x1, 0, z1);
  k.meshW(floorWithHoles([[wx0, wz0], [wx1, wz0], [wx1, wz1], [wx0, wz1]], pools.map((p) => p.outer), 0), m.floor, { shadow: false, name: 'floor-C' });
  floorColliders(k.ctx.colliders, [wx0, wz0, wx1, wz1], 0, pools);

  // ---- スライダー
  // 桃色: 西の壁ぎわの出発台（5.0 m。2 階の観覧席の上の段から）から、開いた樋で東へ渡り U 字に折り返して、筒になって階段の奥を下り、
  // 西の着水プールへ（参考画像の左上の水平な桃色の樋と、階段の手すり越しに見える筒）
  {
    k.box(m.stairTread, [-8.5, 4.7, -10.4], [-6.4, 5.0, -8.6], { shadow: false });
    railing(k, m.rail, [-8.5, -10.4], [-6.4, -10.4], 5.0, { h: 1.05 });
    const trough = k.spline([
      [-6.6, 5.2, -9.5],
      [-5.6, 5.1, -9.6],
      [-3.6, 4.95, -9.6],
      [-2.2, 4.8, -10.3],
      [-2.3, 4.6, -11.5],
      [-3.6, 4.4, -11.9],
    ]);
    buildSlide(k, { path: trough, kind: 'trough', r: 0.52, lip: 0.3, pal: m.pink, part: 2.0, posts: { every: 2.6, floor: 0, mat: m.steel, r: 0.07, minH: 3 } });
    const tube = k.spline([
      [-3.6, 4.4, -11.9],
      [-4.4, 3.6, -12.0],
      [-4.4, 2.5, -12.5],
      [-3.4, 1.65, -13.0],
      [-2.2, 1.0, -13.0],
      [-0.9, 0.4, -12.8],
    ]);
    buildSlide(k, { path: tube, kind: 'tube', r: 0.55, pal: m.pink, tubeIn: m.tubeIn, part: 1.8, posts: { every: 2.4, floor: 0, mat: m.steel, r: 0.07 } });
  }
  // ミントの筒（東の上から輪を描いて円いプールへ。最後は開いた樋）
  {
    const path = k.spline([
      [10.6, 6.0, -11.5],
      [9.0, 5.6, -13.8],
      [6.0, 5.0, -14.6],
      [4.2, 4.5, -13.2],
      [5.0, 3.6, -11.6],
      [6.9, 3.0, -12.4],
    ]);
    buildSlide(k, { path, kind: 'tube', r: 0.6, pal: m.mint, tubeIn: m.tubeIn, posts: { every: 3, floor: 0, mat: m.steel, r: 0.09 } });
    const run = k.spline([[6.9, 3.0, -12.4], [7.4, 2.3, -11.4], [6.6, 1.3, -10.0], [5.7, 0.35, -8.6]]);
    buildSlide(k, { path: run, kind: 'trough', r: 0.6, lip: 0.36, pal: m.mint, flare: { len: 1.6, k: 1.15, ky: 0.8 } });
  }
  // 奥のスライダーの群れ（ミント・桃色の筒）
  {
    const p1 = k.path([-1.5, 6.0, -26], [{ kind: 'helix', c: [1.0, -21.5], r: 2.6, turn: Math.PI * 1.2, y1: 4.0 }, { kind: 'line', to: [5.5, 3.6, -20.5] }, { kind: 'line', to: [7.5, 2.0, -17] }], 0.3, 0.1);
    buildSlide(k, { path: p1, kind: 'tube', r: 0.6, pal: m.mint, tubeIn: m.tubeIn, posts: { every: 3.5, floor: 0, mat: m.steel, r: 0.09 } });
    const p2 = k.path([0.5, 6.5, -27], [{ kind: 'helix', c: [3.0, -23.0], r: 2.2, turn: -Math.PI * 1.1, y1: 4.9 }, { kind: 'line', to: [5.5, 4.2, -22] }], 0.3, 0.1);
    buildSlide(k, { path: p2, kind: 'tube', r: 0.62, pal: m.pink, tubeIn: m.tubeIn });
    const p3 = k.path([7.5, 4.0, -24], [{ kind: 'helix', c: [5.0, -20.2], r: 1.6, turn: Math.PI * 1.0, y1: 3.2 }, { kind: 'line', to: [3.6, 2.6, -18.4] }], 0.3, 0.1);
    buildSlide(k, { path: p3, kind: 'tube', r: 0.55, pal: m.pink, tubeIn: m.tubeIn, posts: { every: 3, floor: 0, mat: m.steel, r: 0.08 } });
  }
  // 奥の壁の投光器（8.8 m）
  for (const x of [0.3, 5.3, 9.2]) floodlight(k, m.lampBody, m.lampLit, [x, 8.8, z0 + 0.25], Math.PI, { tilt: 0.6, w: 0.42, h: 0.26 });
  return pools;
}
