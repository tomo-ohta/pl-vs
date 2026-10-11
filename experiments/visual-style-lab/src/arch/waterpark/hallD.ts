import * as THREE from 'three';
import { stairs } from '../kit.ts';
import { ShiftCam } from './cam.ts';
import { buildSlide, floodlight, HallKit, railing, reflGlow, roundLight, stairRail, stepEdges, type SlidePal } from './hallkit.ts';
import { HALL } from './layout.ts';
import { buildPool, floorColliders, floorWithHoles, type PoolBuilt, type PoolDef, type PoolMats } from './pools.ts';
import type { P2 } from './sweep.ts';

/**
 * D: 夕焼けの広間（waterpark-3）。
 * 目は東の床（桃色に照らされた濡れたタイル）から北を見る。西は大きな自由な形のプール（腰の高さのタイルの縁）、
 * 桃色とミントのまだらの幅広の樋のスライダーが西の柱の脇から下りる。奥に桃色・ミントの筒のスライダーの群れ、
 * 東の壁沿いに南（目の側）へ上がる階段（2 階の観覧通路へ）。西の上に 2 階の観覧席の床（下面に丸い灯り）。
 * 天井（9 m）は濃紺の空に夕焼けの桃色の雲と、吊り下げの小さな灯り。
 */
export const CAM_D = new ShiftCam([HALL.D.o[0], 1.5, HALL.D.o[1]], 0, 60, 66);

export interface HallDMats {
  floor: THREE.Material;
  wall: THREE.Material;
  sky: THREE.Material;
  col: THREE.Material;
  soffit: THREE.Material;
  stairTread: THREE.Material;
  nose: THREE.Material;
  riser: THREE.Material;
  stairFace: THREE.Material;
  rail: THREE.Material;
  /** 幅広の樋（桃色とミントの部品。側壁と床の板） */
  mix: SlidePal;
  /** 筒（桃色が多い・終わりはミント） */
  tubes: SlidePal;
  tubeIn: THREE.Material;
  steel: THREE.Material;
  lampBody: THREE.Material;
  lampLit: THREE.Material;
  lampGlow: THREE.Material;
  globe: THREE.Material;
  starLit: THREE.Material;
  /** 奥の観覧の段: 前の面（青いタイル）・上の面・茶色のタイル・扉 */
  standFace: THREE.Material;
  standTop: THREE.Material;
  brick: THREE.Material;
  door: THREE.Material;
  /** 白と青のタイルの柱型・階段の腰壁 */
  colLight: THREE.Material;
  parapet: THREE.Material;
  pool: PoolMats;
}

export const POOLS_D: PoolDef[] = [
  {
    id: 'D-main',
    ctrl: [[-1.8, -3.3], [0.0, -4.9], [1.8, -7.1], [3.2, -9.7], [4.6, -12.8], [5.4, -16.0], [3.0, -18.4], [-2.0, -19.4], [-7.4, -18.6], [-10.6, -15.0], [-10.8, -8.0], [-9.4, -3.6], [-5.8, -2.8], [-3.6, -3.0]],
    water: -0.05,
    bottom: -1.2,
    coping: 'raised',
    cw: 0.42,
    ch: 0.42,
  },
];

const C_CORE = 8.8;

export function buildHallD(k: HallKit, m: HallDMats): PoolBuilt[] {
  const H = HALL.D;
  const [x0, z0, x1, z1] = H.rect;
  const C = H.ceil;

  // ---- 壁
  k.box(m.wall, [x0 - 0.5, 0, z0 - 0.5], [x1 + 0.5, C, z0], { collide: true });
  k.box(m.wall, [x0 - 0.5, 0, z0], [x0, C, z1], { collide: true });
  k.box(m.wall, [x1, 0, z0], [x1 + 0.5, C, z1], { collide: true });
  const sky = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  sky.rotateX(Math.PI / 2);
  sky.translate((x0 + x1) / 2, C, (z0 + z1) / 2);
  k.mesh(sky, m.sky, { shadow: false });

  // ---- 西の高い観覧席（床下 6.3 m。縁は斜めの直線・下面に吊りの丸い灯り）: 参考画像の左上の暗い天井の張り出し
  const UP = 7.3;
  const SOFF = 6.3;
  // 縁は参考画像の左上の暗い張り出しの曲がった縁（視点のカメラで測った点: 画素 (350,0)・(300,80)・(230,200)・(210,290) を高さ 6.3 m へ）
  const edge: P2[] = [[-9.6, -18.4], [-8.1, -16.1], [-6.9, -13.9], [-5.6, -11.7], [-4.4, -10.0], [-3.4, -8.6], [-2.4, -7.3], [-1.8, -6.0]];
  const outline: P2[] = [[x0, z1], [x0, -19.6], ...edge, [-1.6, -4.0], [-1.6, z1]];
  const sh = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const slab = new THREE.ExtrudeGeometry(sh, { depth: UP - SOFF, bevelEnabled: false });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, SOFF, 0);
  k.mesh(slab, m.soffit, { shadow: false });
  // 縁の見付け（少し明るい帯）と手すり
  railing(k, m.rail, [-1.6, -6.0], [-1.6, z1], UP, { h: 1.05 });
  for (let i = 0; i + 1 < edge.length; i++) railing(k, m.rail, edge[i], edge[i + 1], UP, { h: 1.05 });
  railing(k, m.rail, [-1.8, -6.0], [-1.6, -4.0], UP, { h: 1.05 });
  // 張り出しの縁の丸い見付け（暗い緑青の曲がった帯。参考画像の左上の曲面）
  {
    const pts = edge.map(([x, z]) => new THREE.Vector3(...k.p(x, SOFF + 0.1, z)));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    k.meshW(new THREE.TubeGeometry(curve, 40, 0.55, 10, false), m.soffit, { shadow: false });
  }
  // 吊りの丸い灯り（大きな玉）
  for (const [x, z, d] of [[-5.4, -8.4, 0.5], [-7.0, -12.0, 0.6], [-7.4, -14.0, 0.4], [-3.6, -5.0, 0.4], [-8.6, -15.4, 0.4], [-9.6, -9.6, 0.5], [-4.2, -1.0, 0.4]] as [number, number, number][]) {
    const wire = new THREE.CylinderGeometry(0.01, 0.01, d, 4);
    wire.translate(...k.p(x, SOFF - d / 2, z));
    k.meshW(wire, m.steel, { shadow: false });
    k.meshW(new THREE.SphereGeometry(0.17, 14, 10).translate(...k.p(x, SOFF - d - 0.17, z)), m.globe, { shadow: false });
    k.lamp({ pos: [x, SOFF - d - 0.6, z], radius: 5.5, intensity: 1.0, color: '#ffe0c8', box: [x0, -1, -20, 8.2, SOFF, z1], down: true });
  }
  // ---- 斜めに渡る点検の通路（参考画像の中ほどを左上から右へ横切る暗い帯）: 西の張り出しの奥から、北東の隅へ。下に吊りの灯り
  {
    // 参考画像の中ほどを左上から右へ細くなる暗い帯（画素 (210,210〜300) → (720,390〜420)）
    const A: [number, number] = [-7.0, -13.2];
    const B: [number, number] = [4.6, -28.6];
    const UY0 = 5.2; // 下面
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ang = Math.atan2(-(B[1] - A[1]), B[0] - A[0]);
    const deck = new THREE.BoxGeometry(len, 0.95, 1.6);
    deck.rotateY(ang);
    deck.translate((A[0] + B[0]) / 2, UY0 + 0.47, (A[1] + B[1]) / 2);
    k.mesh(deck, m.soffit, { shadow: false });
    for (const side of [-0.68, 0.68]) {
      const nx = Math.sin(ang) * side;
      const nz = Math.cos(ang) * side;
      railing(k, m.steel, [A[0] + nx, A[1] + nz], [B[0] + nx, B[1] + nz], UY0 + 0.95, { h: 1.0, gap: 0.3, mid: true });
    }
    for (let t = 0.08; t < 1; t += 0.09) {
      const x = A[0] + (B[0] - A[0]) * t;
      const z = A[1] + (B[1] - A[1]) * t;
      const d = 0.3 + (t * 7) % 0.5;
      const wire = new THREE.CylinderGeometry(0.008, 0.008, d, 3);
      wire.translate(...k.p(x, UY0 - d / 2, z));
      k.meshW(wire, m.steel, { shadow: false });
      k.meshW(new THREE.SphereGeometry(0.08, 8, 6).translate(...k.p(x, UY0 - d - 0.08, z)), m.globe, { shadow: false });
    }
    // 受けの柱（2 本）
    for (const t of [0.45, 0.85]) k.cyl(m.steel, [A[0] + (B[0] - A[0]) * t, UY0 / 2, A[1] + (B[1] - A[1]) * t], 0.14, UY0, { collide: true, segments: 10 });
    // 通路の北の端（塔の上の踊り場へ）
    k.box(m.soffit, [B[0] - 1.0, UY0, B[1] - 1.6], [B[0] + 1.4, UY0 + 0.95, B[1] + 0.6], { shadow: false });
  }
  // 奥の 2 階の点検通路（北の壁ぎわ）
  k.box(m.soffit, [x0, 6.9, z0], [x1, 7.4, z0 + 2.4], { shadow: false });
  railing(k, m.rail, [x0, z0 + 2.4], [x1, z0 + 2.4], 7.4, { h: 1.05 });

  // ---- 柱: 西の塔（円柱・青いタイル。まだらの樋の出発台）と南西の柱
  k.cyl(m.col, [-8.8, SOFF / 2, -12.0], 1.1, SOFF, { collide: true, segments: 28 });
  k.cyl(m.col, [-10.0, C / 2, -1.5], 0.6, C, { collide: true, segments: 20 });

  // ---- 東の設備の壁（z < -11.2。タイル・投光器）と、その前の急な階段（北の z = -11.2 から南へ上がり、東の観覧席（4.4 m）へ）
  const CORE = C_CORE;
  // 設備の部屋は 2 階の床の高さまで（上は大きな筒が東の壁から出て斜めに下りる）
  k.box(m.wall, [CORE, 0, -14.9], [x1, 4.6, -11.2], { collide: true });
  k.box(m.nose, [CORE - 0.05, 4.6, -14.95], [x1, 4.7, -11.15], { shadow: false });
  for (const z of [-12.4, -13.8]) {
    floodlight(k, m.lampBody, m.lampLit, [x1 - 0.1, 6.6, z], -Math.PI / 2 + 0.3, { tilt: 0.6, w: 0.3, h: 0.22 });
    reflGlow(k, m.lampGlow, [x1 - 0.3, 6.6, z], 0.5);
  }
  // 広間の明かり（光だまり）: 西の張り出しの下・東の観覧席の下・南の壁ぎわ
  k.lamp({ pos: [-6.0, 4.5, 3.0], radius: 7, intensity: 0.8, color: '#ffd8c8', box: [x0, -1, -2, 4, 6.3, z1] });
  k.lamp({ pos: [8.5, 3.6, -1.0], radius: 7, intensity: 1.0, color: '#ffd8c8', box: [5.0, -1, -7, x1, 4.1, z1], down: true });
  for (let z = -4.0; z < z1; z += 3.5) roundLight(k, m.lampBody, m.lampLit, [8.4, 4.06, z], 0.12);
  // 吊りの灯り・観覧席の下の灯りの映り込み（床のつやの白い点）
  for (const [x, y, z] of [[-5.4, 5.4, -8.4], [-7.0, 5.2, -12.0], [-3.6, 5.4, -5.0], [-4.2, 5.4, -1.0], [3.0, 4.2, -2.0], [6.0, 4.0, -4.0]] as [number, number, number][]) reflGlow(k, m.lampGlow, [x, y, z], 0.4);
  const SX0 = 6.8;
  const SX1 = 8.8;
  const RUN = 4.4;
  const UY = 4.4;
  stairs(k.b, m.stairTread, k.p((SX0 + SX1) / 2, 0, -11.2), '+z', UY, SX1 - SX0, { tread: 0.2, riser: 0.2 });
  stepEdges(k, m.nose, m.riser, k.p((SX0 + SX1) / 2, 0, -11.2), '+z', UY, SX1 - SX0, { tread: 0.2, riser: 0.2 });
  // 段の西の側は腰壁（eastD）
  for (let i = 0; i < 8; i++) {
    const t0 = i / 8;
    const t1 = (i + 1) / 8;
    k.collide([SX0 - 0.25, t0 * UY, -11.2 + t0 * RUN], [SX0, t0 * UY + 1.1, -11.2 + t1 * RUN]);
  }
  // 東の観覧席（4.4 m。南の壁の 2 階の開口から観覧通路へ）
  // 観覧席の床はタイル張り（縁の帯は濃い）
  k.box(m.pool.copingTop ?? m.stairTread, [SX0, UY - 0.3, -6.8], [x1, UY, z1], { collide: true });
  k.box(m.riser, [SX0, UY - 0.32, -6.8], [SX0 + 0.25, UY + 0.004, z1], { shadow: false });
  railing(k, m.rail, [SX0, -6.8], [SX0, z1], UY, { h: 1.05 });
  for (const z of [-6.6, -1.0, 4.6]) k.cyl(m.steel, [SX0 + 0.2, (UY - 0.3) / 2, z], 0.12, UY - 0.3, { collide: true, segments: 10 });

  // ---- プール・床
  const pools = POOLS_D.map((d) => buildPool(k.b, m.pool, { ...d, ctrl: d.ctrl.map(([x, z]): P2 => [x + k.ox, z + k.oz]) }));
  const [wx0, , wz0] = k.p(x0, 0, z0);
  const [wx1, , wz1] = k.p(x1, 0, z1);
  k.meshW(floorWithHoles([[wx0, wz0], [wx1, wz0], [wx1, wz1], [wx0, wz1]], pools.map((p) => p.outer), 0), m.floor, { shadow: false, name: 'floor-D' });
  floorColliders(k.ctx.colliders, [wx0, wz0, wx1, wz1], 0, pools);

  // ---- スライダー
  // 桃色とミントの部品の幅広の樋（西の柱の脇の出発台から、途中で一度ふくらんで、プールの中ほどへ）。
  // 道筋は参考画像の樋の中ほどの画素（170,375）・（250,420）・（330,490）・（420,555）・（520,600）を視点のカメラで奥行きの面へ
  {
    const path = k.spline([
      [-7.6, 4.3, -13.45],
      [-6.8, 3.5, -13.05],
      [-5.8, 2.45, -12.55],
      [-4.8, 1.85, -12.05],
      [-3.7, 1.45, -11.5],
      [-2.7, 1.0, -10.95],
      [-1.8, 0.82, -10.4],
      [-1.0, 0.75, -9.9],
    ]);
    buildSlide(k, { path, kind: 'trough', r: 0.82, lip: 0.4, pal: m.mix, wide: 1.6, flare: { len: 2.4, k: 1.15, ky: 0.75 }, posts: { every: 2.6, floor: -1.2, mat: m.steel, r: 0.1 } });
    // 出発台（柱の脇・4.4 m）: 樋の頭の丸い背もたれ（2 つの丸いこぶ。桃色）と床・手すり
    const pink = m.mix.tones[0];
    k.box(m.stairFace, [-9.6, 3.5, -15.4], [-6.8, 3.8, -12.8], { collide: true });
    railing(k, m.rail, [-9.6, -15.4], [-6.8, -15.4], 3.8, { h: 1.05 });
    for (const dx of [-0.75, 0.75]) {
      const g = new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 1.3, 0.7);
      g.translate(...k.p(-7.3 + dx * 0.5, 3.9, -13.9 + dx));
      k.meshW(g, pink.out, { shadow: false });
    }
  }
  // 東の大きなまだらの樋（設備の壁の向こうの塔から、西へ斜めに下りてプールの奥へ）とミントの筒
  {
    // 東の壁の向こう（2 階の出発の部屋）から壁を抜けて出る。参考画像の右上から斜めに下りる筒の画素 (1150,235)・(1000,290)・(900,340)・(812,385)
    const big = k.spline([
      [11.6, 7.75, -16.4],
      [9.6, 7.0, -16.4],
      [7.8, 6.3, -16.4],
      [5.8, 5.35, -16.45],
      [4.0, 4.4, -16.7],
      [2.4, 3.2, -17.6],
      [2.6, 2.0, -19.6],
      [5.0, 1.2, -20.6],
      [7.0, 0.6, -21.0],
    ]);
    buildSlide(k, { path: big, kind: 'tube', r: 0.8, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.2, floor: 0, mat: m.steel, r: 0.1 } });
    const p2 = k.path([7.8, 5.8, -21.0], [{ kind: 'helix', c: [5.0, -20.6], r: 2.4, turn: Math.PI * 1.1, y1: 3.2 }, { kind: 'line', to: [2.0, 1.6, -19.0] }], 0.3, 0.15);
    buildSlide(k, { path: p2, kind: 'tube', r: 0.6, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.2, floor: 0, mat: m.steel, r: 0.09 } });
  }
  // 天井から吊った小さな灯り（参考画像の空の中の星のような点）。細い吊り線と小さな光る玉
  {
    let seed = 77;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = x0 + 1 + rnd() * (x1 - x0 - 2);
      const z = z0 + 1 + rnd() * (z1 - z0 - 6);
      if (x < -1.6 && z > -18) continue; // 西の観覧席の上は除く
      const y = C - 0.6 - rnd() * 2.2;
      const wire = new THREE.CylinderGeometry(0.006, 0.006, C - y, 3);
      wire.translate(x, (C + y) / 2, z);
      k.mesh(wire, m.steel, { shadow: false });
      k.mesh(new THREE.SphereGeometry(0.03 + rnd() * 0.025, 6, 4).translate(x, y, z), m.starLit, { shadow: false });
    }
  }
  // 奥の真ん中の筒の群れ（参考画像の奥の密な桃色とミントの筒）
  {
    const f1 = k.path([10.4, 5.8, -31.5], [{ kind: 'helix', c: [6.4, -29.4], r: 2.2, turn: Math.PI * 1.6, y1: 3.2 }, { kind: 'line', to: [2.6, 2.0, -25.0] }], 0.3, 0.12);
    buildSlide(k, { path: f1, kind: 'tube', r: 0.55, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.0, floor: 0, mat: m.steel, r: 0.08 } });
    const f2 = k.spline([[-2.0, 5.6, -34], [1.5, 5.2, -30.5], [5.0, 4.4, -28.5], [8.4, 3.6, -27.4], [10.4, 2.6, -25.2]]);
    buildSlide(k, { path: f2, kind: 'tube', r: 0.5, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.2, floor: 0, mat: m.steel, r: 0.08 } });
    const f3 = k.spline([[13.0, 6.2, -33.5], [9.5, 4.9, -31.8], [6.4, 4.2, -32.6], [3.6, 3.4, -31.0], [1.2, 2.2, -27.6]]);
    buildSlide(k, { path: f3, kind: 'trough', r: 0.62, lip: 0.3, pal: m.mix, posts: { every: 3.2, floor: 0, mat: m.steel, r: 0.08 } });
  }
  // 奥（北）の段（床 1.2 m）と手すり、筒の群れ
  k.box(m.stairFace, [x0, 0, z0], [x1, 1.2, -24.0], { collide: true });
  railing(k, m.rail, [x0, -24.0], [-11.2, -24.0], 1.2, { h: 1.05 });
  railing(k, m.rail, [0.4, -24.0], [x1, -24.0], 1.2, { h: 1.05 });
  standD(k, m);
  eastD(k, m);
  {
    const p3 = k.path([-11.0, 5.8, -27.5], [{ kind: 'helix', c: [-8.4, -24.6], r: 2.0, turn: -Math.PI * 1.4, y1: 3.0 }, { kind: 'line', to: [-6.0, 1.4, -20.4] }], 0.3, 0.1);
    buildSlide(k, { path: p3, kind: 'tube', r: 0.55, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.2, floor: 0, mat: m.steel, r: 0.08 } });
    const p4 = k.path([6.0, 5.4, -32.0], [{ kind: 'helix', c: [7.4, -28.6], r: 2.2, turn: -Math.PI * 1.2, y1: 3.0 }, { kind: 'line', to: [4.6, 1.8, -24.4] }], 0.3, 0.1);
    buildSlide(k, { path: p4, kind: 'tube', r: 0.6, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.4, floor: 0, mat: m.steel, r: 0.08 } });
  }
  {
    const p1 = k.path([-8.0, 6.4, -30], [{ kind: 'helix', c: [-4.2, -27.0], r: 2.4, turn: -Math.PI * 1.3, y1: 4.6 }, { kind: 'line', to: [-1.0, 3.6, -24.0] }, { kind: 'line', to: [0.5, 2.0, -21.5] }], 0.3, 0.1);
    buildSlide(k, { path: p1, kind: 'tube', r: 0.6, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.4, floor: 0, mat: m.steel, r: 0.08 } });
    const p2 = k.path([-1.0, 5.6, -33.5], [{ kind: 'helix', c: [1.8, -30.6], r: 2.2, turn: Math.PI * 1.2, y1: 2.8 }, { kind: 'line', to: [4.0, 1.6, -24.8] }], 0.3, 0.1);
    buildSlide(k, { path: p2, kind: 'tube', r: 0.6, pal: m.tubes, tubeIn: m.tubeIn, posts: { every: 3.4, floor: 0, mat: m.steel, r: 0.08 } });
  }
  return pools;
}

/**
 * D の奥の段の上の観覧の段（参考画像 3 の中ほど左の、青いタイルの 3 段の観覧席と手すり・斜めの階段・扉）。
 * 段の高さと前の面は視点のカメラで測った値（1 段目の上 2.3 m・3 段目の上 4.4 m が画素 505・440 に来る奥行き）
 */
function standD(k: HallKit, m: HallDMats): void {
  const B = 1.2; // 奥の段の床
  const tiers: [number, number, number, number][] = [
    // x0, x1, 前の面 z, 上の高さ
    [-11.2, -0.6, -24.6, 2.3],
    [-11.2, -5.4, -26.4, 3.4],
    [-11.2, -6.8, -28.2, 4.4],
  ];
  for (const [ax, bx, fz, top] of tiers) {
    k.box(m.standFace, [ax, B, -40.0], [bx, top - 0.12, fz], { collide: true });
    // 上の面（明るいタイル）と縁の笠木
    k.box(m.standTop, [ax, top - 0.12, -40.0], [bx, top, fz], { collide: true });
    k.box(m.nose, [ax, top - 0.02, fz - 0.02], [bx, top + 0.04, fz + 0.06], { shadow: false });
    railing(k, m.rail, [ax, fz + 0.05], [bx - 0.1, fz + 0.05], top, { h: 1.0, gap: 0.14 });
  }
  // 2 段目の前の面の西は茶色のタイルの壁（参考画像の手すりの下の茶色の升目）
  k.box(m.brick, [-11.2, 2.3, -26.42], [-8.4, 3.28, -26.36], { shadow: false });
  // 1 段目の扉（奥の部屋。暗い開口と枠）
  k.box(m.stairFace, [-9.25, B, -24.66], [-7.35, 2.3 - 0.1, -24.58], { shadow: false });
  k.box(m.door, [-9.1, B, -24.7], [-7.5, 2.1, -24.62], { shadow: false });
  // 斜めの階段（3 段目の上 4.4 m から東へ 1 段目の上 2.3 m へ下りる）と両脇の手すり
  const st = stairs(k.b, m.stairTread, k.p(-1.6, 2.3, -27.3), '-x', 2.1, 1.4, { tread: 0.42, riser: 0.175 });
  void st;
  stairRail(k, m.rail, [-1.6, 2.3, -26.6], [-6.64, 4.4, -26.6], { h: 1.0, gap: 0.14 });
  stairRail(k, m.rail, [-1.6, 2.3, -28.0], [-6.64, 4.4, -28.0], { h: 1.0, gap: 0.14 });
  // 1 段目から奥の段の床へ下りる短い階段（東の端）
  stairs(k.b, m.stairTread, k.p(0.9, B, -25.4), '-x', 1.1, 1.4, { tread: 0.3, riser: 0.18 });
  // 段を照らす灯り（参考画像の段は明るい青。上の通路の下の投光）
  k.lamp({ pos: [-6.0, 6.8, -25.0], radius: 9, intensity: 1.3, color: '#e8eeff', box: [-11.6, 1.0, -40, 1.0, 8, -23.8] });
  k.lamp({ pos: [-1.0, 5.6, -24.0], radius: 6, intensity: 0.8, color: '#ffe0cc', box: [-6.0, 1.0, -30, 4.0, 8, -23.8] });
  // 段の上の灯り（小さな丸い灯り。参考画像の段の上の点々）
  for (const [x, y, z] of [[-10.4, 5.6, -28.4], [-8.6, 4.6, -26.6], [-6.0, 3.5, -24.8], [-3.0, 3.5, -24.8]] as [number, number, number][]) {
    k.mesh(new THREE.SphereGeometry(0.09, 8, 6).translate(x, y, z), m.globe, { shadow: false });
  }
}

/**
 * D の東: 大きな筒の出発の塔（鉄骨の格子）・急な樋（塔の脇から床へ）・柱型（白いタイル）・階段の腰壁（参考画像 3 の右の端）
 */
function eastD(k: HallKit, m: HallDMats): void {
  // 鉄骨の格子の塔（奥の筒の群れの出発の塔。急な樋の奥）
  const tx0 = 8.6;
  const tx1 = 10.8;
  const tz0 = -24.2;
  const tz1 = -22.0;
  const TOP = 7.6;
  for (const [x, z] of [[tx0, tz0], [tx1, tz0], [tx0, tz1], [tx1, tz1]] as [number, number][]) k.box(m.steel, [x - 0.08, 0, z - 0.08], [x + 0.08, TOP + 1.1, z + 0.08], { collide: true });
  k.box(m.steel, [tx0 - 0.1, TOP - 0.18, tz0 - 0.1], [tx1 + 0.1, TOP, tz1 + 0.1], { shadow: false });
  railing(k, m.rail, [tx0, tz0], [tx1, tz0], TOP, { h: 1.05, gap: 0.2 });
  // 筋交い（各面に X）
  const brace = (a: [number, number, number], c: [number, number, number]): void => {
    const A = new THREE.Vector3(...k.p(...a));
    const C = new THREE.Vector3(...k.p(...c));
    const g = new THREE.CylinderGeometry(0.035, 0.035, A.distanceTo(C), 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize()));
    g.translate((A.x + C.x) / 2, (A.y + C.y) / 2, (A.z + C.z) / 2);
    k.meshW(g, m.steel, { shadow: false });
  };
  for (let y = 0; y < TOP - 0.5; y += 1.9) {
    const y1 = Math.min(TOP, y + 1.9);
    brace([tx0, y, tz1], [tx1, y1, tz1]);
    brace([tx1, y, tz1], [tx0, y1, tz1]);
    brace([tx0, y, tz0], [tx0, y1, tz1]);
    brace([tx0, y, tz1], [tx0, y1, tz0]);
    k.box(m.steel, [tx0, y1 - 0.05, tz1 - 0.04], [tx1, y1 + 0.05, tz1 + 0.04], { shadow: false });
  }
  // 急な樋（塔の脇 4.6 m から床へ。桃色とミントの部品）
  const path = k.spline([
    [9.9, 4.4, -19.6],
    [9.6, 3.6, -18.8],
    [9.3, 2.4, -17.9],
    [9.1, 1.2, -17.0],
    [9.0, 0.5, -16.0],
    [9.0, 0.32, -15.2],
  ]);
  buildSlide(k, { path, kind: 'trough', r: 0.7, lip: 0.4, pal: m.mix, wide: 1.1, part: 2.0, flare: { len: 1.4, k: 1.2, ky: 0.8 } });
  // 柱型（白と青のタイル。設備の壁の南西の角）
  k.box(m.colLight, [8.2, 0, -11.9], [8.85, 4.4, -11.15], { collide: true });
  k.box(m.nose, [8.15, 4.4, -11.95], [8.9, 4.5, -11.1], { shadow: false });
  // 階段の腰壁（段の西の側。タイル張りの厚い壁、上に笠木）: 下（北）z = -11.2 から上（南）z = -6.8 へ
  const RUN = 4.4;
  const UY = 4.4;
  const wall = new THREE.Shape([new THREE.Vector2(-11.2, 0), new THREE.Vector2(-11.2 + RUN, UY), new THREE.Vector2(-11.2 + RUN, UY + 1.0), new THREE.Vector2(-11.2, 1.0)]);
  const wg = new THREE.ExtrudeGeometry(wall, { depth: 0.22, bevelEnabled: false });
  wg.rotateY(-Math.PI / 2);
  wg.translate(6.8 - 0.22, 0, 0);
  k.mesh(wg, m.parapet, { shadow: false });
  const cap = new THREE.Shape([new THREE.Vector2(-11.2, 0.98), new THREE.Vector2(-11.2 + RUN, UY + 0.98), new THREE.Vector2(-11.2 + RUN, UY + 1.06), new THREE.Vector2(-11.2, 1.06)]);
  const cg = new THREE.ExtrudeGeometry(cap, { depth: 0.3, bevelEnabled: false });
  cg.rotateY(-Math.PI / 2);
  cg.translate(6.8 - 0.26, 0, 0);
  k.mesh(cg, m.nose, { shadow: false });
}
