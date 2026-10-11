import * as THREE from 'three';
import { ShiftCam } from './cam.ts';
import { duct, ductCurve, floodlight, glowDecal, HallKit, railing, reflGlow, roundLight, buildSlide, stairRail, type SlidePal } from './hallkit.ts';
import { HALL } from './layout.ts';
import { buildPool, floorColliders, floorWithHoles, type PoolBuilt, type PoolDef, type PoolMats } from './pools.ts';
import type { P2, PathSeg } from './sweep.ts';
import { stairs } from '../kit.ts';

/**
 * A: スライダーの大広間（waterpark-0）。
 * 南の端から北を見る。東西に 2 階の回廊（床 4.5 m）とその上の銀色のダクト、柱の列（青と白の升目のタイル、柱の上に投光器）。
 * 奥（北）の壁の前に階段の塔があり、桃色（西）と白（東）の螺旋のスライダーが下りて、それぞれの着水プールへ。
 * 天井（10 m）は濃紺の空と雲の壁画。
 */
export const CAM_A = new ShiftCam([0, 1.5, 0], -0.032, 60, 81);

export interface HallAMats {
  floor: THREE.Material;
  wall: THREE.Material;
  wallBand: THREE.Material;
  ceilDark: THREE.Material;
  sky: THREE.Material;
  col: THREE.Material;
  galleryFace: THREE.Material;
  galleryUnder: THREE.Material;
  rail: THREE.Material;
  duct: THREE.Material;
  ductBand: THREE.Material;
  pink: SlidePal;
  white: SlidePal;
  steel: THREE.Material;
  stair: THREE.Material;
  stairLit: THREE.Material;
  lampBody: THREE.Material;
  lampLit: THREE.Material;
  lampGlow: THREE.Material;
  winLit: THREE.Material;
  mint: SlidePal;
  tubeIn: THREE.Material;
  glowWall: THREE.Material;
  glowFloor: THREE.Material;
  pool: PoolMats;
}

/** プールの水の縁（局所の座標） */
export const POOLS_A: PoolDef[] = [
  // 西の着水プール（桃色のスライダー）
  {
    id: 'A-west',
    ctrl: [[-5.1, -7.15], [-3.1, -7.4], [-1.7, -8.1], [-1.35, -9.5], [-2.0, -11.3], [-3.6, -13.0], [-5.8, -13.9], [-8.4, -13.6], [-9.4, -11.6], [-9.0, -8.8], [-7.2, -7.3]],
    water: -0.12,
    bottom: -0.95,
    coping: 'round',
    cw: 0.26,
    ch: 0.09,
  },
  // 東の手前のプール（左の尖りから東へ）
  {
    id: 'A-east1',
    ctrl: [[-0.45, -8.06], [0.23, -6.13], [1.05, -5.27], [1.83, -4.7], [3.45, -4.21], [6.5, -3.9], [9.0, -4.3], [9.4, -7.5], [8.9, -10.8], [5.66, -10.92], [2.84, -10.8], [0.36, -9.7]],
    water: -0.12,
    bottom: -1.1,
    coping: 'round',
    cw: 0.26,
    ch: 0.09,
  },
  // 東の奥のプール（白のスライダーの着水）
  {
    id: 'A-east2',
    ctrl: [[-0.4, -14.6], [4.0, -15.0], [8.2, -14.4], [9.2, -16.0], [8.8, -19.5], [5.0, -20.6], [2.7, -20.0], [0.6, -19.0], [-0.9, -16.8]],
    water: -0.12,
    bottom: -1.1,
    coping: 'round',
    cw: 0.26,
    ch: 0.09,
  },
];

export function buildHallA(k: HallKit, m: HallAMats): PoolBuilt[] {
  const H = HALL.A;
  const [x0, z0, x1, z1] = H.rect;
  const C = H.ceil;
  const GE = 4.5; // 東の回廊の床
  const XE = 10.6; // 東の回廊の縁
  const GW = 7.2; // 西の上の回廊の床
  const XW = -9.4; // 西の上の回廊の縁

  // ---- 壁・天井
  k.box(m.wall, [x0 - 0.5, 0, z0 - 0.5], [x1 + 0.5, C, z0], { collide: true });
  k.box(m.wall, [x0 - 0.5, 0, z0], [x0, C, z1], { collide: true });
  k.box(m.wall, [x1, 0, z0], [x1 + 0.5, C, z1], { collide: true });
  // 空の絵（天井全体）
  const sky = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  sky.rotateX(Math.PI / 2);
  sky.translate((x0 + x1) / 2, C, (z0 + z1) / 2);
  k.mesh(sky, m.sky, { shadow: false });
  // 天井の縁の見切り（壁との境の暗い帯）
  k.box(m.ceilDark, [x0, C - 0.35, z0], [x1, C, z0 + 0.4], { shadow: false });

  // ---- 東の回廊（床 4.5 m）
  k.box(m.galleryUnder, [XE, GE - 0.45, z0], [x1, GE, z1], { collide: true });
  k.box(m.galleryFace, [XE - 0.06, GE - 0.65, z0], [XE + 0.06, GE + 0.05, z1], { shadow: false });
  railing(k, m.rail, [XE, z0], [XE, z1], GE, { h: 1.1, gap: 0.16, posts: 12 });
  // ---- 西の上の回廊（床 7.2 m）。その下は太いダクトと 1 階の壁
  k.box(m.galleryUnder, [x0, GW - 0.4, z0], [XW, GW, z1], { collide: true });
  k.box(m.galleryFace, [XW - 0.06, GW - 0.6, z0], [XW + 0.06, GW + 0.05, z1], { shadow: false });
  railing(k, m.rail, [XW, z0], [XW, z1], GW, { h: 1.1, gap: 0.16, posts: 12 });

  // ---- 柱（円柱。青と白の升目のタイルに、濃い青の帯の輪）。東 x = 10、西 x = -10。柱の上に投光器、回廊の高さに 3 つの灯り
  const colZ = { e: [-25.1, -16.9, -8.7, -0.5, 7.7], w: [-26.7, -18.4, -10.1, -1.8, 6.5] };
  const WARM = '#ffc2a2';
  const column = (cx: number, z: number, side: 1 | -1, top: number, mid: number): void => {
    k.cyl(m.col, [cx, C / 2, z], 0.56, C, { segments: 24 });
    k.collide([cx - 0.5, 0, z - 0.5], [cx + 0.5, C, z + 0.5]);
    for (const y of [0.15, 1.05, mid - 0.55, mid + 0.55, top - 0.7]) k.cyl(m.wallBand, [cx, y, z], 0.585, y < 0.3 ? 0.3 : 0.16, { segments: 24 });
    const face = cx - side * 0.6;
    const yaw = side > 0 ? Math.PI / 2 + 0.55 : -Math.PI / 2 - 0.55;
    floodlight(k, m.lampBody, m.lampLit, [face, top, z + 0.35], yaw, { tilt: 0.75 });
    reflGlow(k, m.lampGlow, [face, top, z + 0.5], 1.3);
    // 回廊の高さの 3 つの灯り（柱を回る）
    for (const da of [-0.55, 0, 0.55]) {
      const ang = (side > 0 ? Math.PI : 0) + da;
      roundLight(k, m.lampBody, m.lampLit, [cx + Math.cos(ang) * 0.6, mid, z - Math.sin(ang) * 0.6], 0.11, 'x', side > 0 ? -1 : 1);
    }
    reflGlow(k, m.lampGlow, [face, mid, z + 0.2], 0.9);
    glowDecal(k, m.glowWall, [cx - side * 0.62, mid, z], 1.2, 3.0, side > 0 ? '-x' : '+x');
    k.lamp({ pos: [cx - side * 1.4, mid + 0.6, z + 0.8], radius: 7.5, intensity: 1.7, color: WARM, box: side > 0 ? [x0, -1, z0, XE + 0.6, C, z1] : [XW - 0.6, -1, z0, x1, C, z1] });
  };
  for (const z of colZ.e) column(10.0, z, 1, 9.0, 4.0);
  for (const z of colZ.w) column(-10.0, z, -1, 9.3, 3.9);
  // 壁の帯（腰と上の 2 本・床ぎわの濃い帯）。北・東・西の壁
  for (const [a0, a1, y0, y1] of [[0, 0.3, 0, 0], [1.0, 1.18, 0, 0], [2.55, 2.68, 0, 0]] as [number, number, number, number][]) {
    void y0;
    void y1;
    k.box(m.wallBand, [x0, a0, z0], [x1, a1, z0 + 0.03], { shadow: false });
    k.box(m.wallBand, [x0, a0, z0], [x0 + 0.03, a1, z1], { shadow: false });
    k.box(m.wallBand, [x1 - 0.03, a0, z0], [x1, a1, z1], { shadow: false });
  }

  // ---- 回廊の下のダウンライト（東の回廊の下・西の低い回廊の下）と、その光だまり（壁と床を暖かく）
  for (let z = z0 + 3; z < z1; z += 4) {
    roundLight(k, m.lampBody, m.lampLit, [13.3, GE - 0.47, z], 0.2);
    roundLight(k, m.lampBody, m.lampLit, [-16.0, 3.27, z], 0.18);
    reflGlow(k, m.lampGlow, [13.3, GE - 0.6, z], 0.5);
  }
  // 光だまり（描いた光。灯りの数の上限に縛られない）: 回廊の下の壁と床
  for (let z = z0 + 3; z < z1; z += 4) {
    glowDecal(k, m.glowWall, [x1, 1.9, z], 3.6, 3.8, '-x');
    glowDecal(k, m.glowFloor, [13.6, 0, z], 4.2, 3.6, '+y');
    glowDecal(k, m.glowWall, [x0, 1.6, z], 3.4, 3.2, '+x');
    glowDecal(k, m.glowFloor, [-15.4, 0, z], 3.4, 3.4, '+y');
  }
  // スライダーを照らす投光（柱の上の投光器の光）
  k.lamp({ pos: [-3.6, 7.5, -15.5], radius: 8, intensity: 1.2, color: '#ffd0b8', box: [-9, -1, -25, 1, 9, -10] });
  k.lamp({ pos: [5.0, 7.5, -19.5], radius: 8, intensity: 0.35, color: '#e8eef8', box: [0, -1, -29, 10, 9, -15] });
  // 奥の踊り場（街灯と明るい階段）
  k.lamp({ pos: [0.5, 5.5, z0 + 2.5], radius: 9, intensity: 1.5, color: '#ffc8a4', box: [-8, -1, z0, 8, C, z0 + 9] });

  // ---- ダクト（東は少し斜めに走って南で壁へ曲がる）
  duct(k, m.duct, m.ductBand, [11.6, 7.45, z0 + 0.3], [13.2, 7.45, z1], 0.9);
  duct(k, m.duct, m.ductBand, [10.2, 9.2, z0 + 0.3], [11.9, 9.2, z1], 0.72);
  duct(k, m.duct, m.ductBand, [-10.9, 9.15, z0 + 0.3], [-10.9, 9.15, z1], 0.72);
  duct(k, m.duct, m.ductBand, [-11.0, 6.4, z0 + 0.3], [-11.0, 6.4, z1], 0.9);
  // 西の上の回廊から天井の中ほどへ曲がって渡るダクト（参考画像の左上の銀色の太い管）
  ductCurve(k, m.duct, m.ductBand, [[-16.5, 8.7, 4.0], [-12.0, 8.7, -6.0], [-9.4, 8.6, -13.1], [-7.2, 8.6, -17.8], [-5.0, 8.9, -24.0], [-4.0, 9.0, z0 + 0.5]], 0.62);
  // 東も同じく、回廊の上から天井の奥へ
  ductCurve(k, m.duct, m.ductBand, [[15.5, 8.6, 4.0], [12.0, 8.6, -6.0], [10.0, 8.7, -14.0], [8.6, 8.9, -22.0], [8.0, 9.0, z0 + 0.5]], 0.55);

  // 回廊の奥の壁の灯った窓（すりガラスの暖かい光と桟）。東は 4.5〜10 m の層、西は低い回廊と上の回廊の層
  const winRow = (x: number, nx: number, y0: number, y1: number): void => {
    for (let z = z0 + 2.2; z < z1 - 1; z += 3.0) {
      const g = new THREE.PlaneGeometry(2.0, y1 - y0);
      g.rotateY(nx > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.translate(x + nx * 0.02, (y0 + y1) / 2, z);
      k.mesh(g, m.winLit, { shadow: false });
      for (const dz of [-1.0, 0, 1.0]) k.box(m.lampBody, [x + nx * 0.01 - 0.03, y0, z + dz - 0.04], [x + nx * 0.01 + 0.03, y1, z + dz + 0.04], { shadow: false });
      k.box(m.lampBody, [x + nx * 0.01 - 0.03, (y0 + y1) / 2 - 0.03, z - 1.0], [x + nx * 0.01 + 0.03, (y0 + y1) / 2 + 0.03, z + 1.0], { shadow: false });
    }
  };
  winRow(x1, -1, GE + 0.9, GE + 2.6);
  winRow(x1, -1, 0.9, 2.8);
  winRow(x0, 1, 4.4, 6.2);
  winRow(x0, 1, GW + 0.9, GW + 2.4);

  // ---- 奥（北）の段: 壁の前の踊り場（床 3.4 m）と階段・街灯
  const BZ = z0 + 3.2;
  k.box(m.stair, [-7, 3.1, z0], [7, 3.4, BZ], { collide: true });
  railing(k, m.rail, [-7, BZ], [0.6, BZ], 3.4, { h: 1.05, gap: 0.14 });
  railing(k, m.rail, [2.2, BZ], [7, BZ], 3.4, { h: 1.05, gap: 0.14 });
  stairs(k.b, m.stair, k.p(1.4, 0, BZ + 5.6), '-z', 3.4, 1.4);
  stairRail(k, m.rail, [0.7, 0, BZ + 5.6], [0.7, 3.4, BZ]);
  stairRail(k, m.rail, [2.1, 0, BZ + 5.6], [2.1, 3.4, BZ]);
  for (const [x, two] of [[-0.2, false], [3.9, true], [8.9, true]] as [number, boolean][]) {
    k.cyl(m.steel, [x, 3.4 + 2.4, z0 + 1.0], 0.05, 4.8);
    for (const dx of two ? [-0.28, 0.28] : [0]) {
      k.mesh(new THREE.SphereGeometry(0.17, 10, 8).translate(x + dx, 3.4 + 4.75 + (two ? 0.1 : 0), z0 + 1.0), m.lampLit, { shadow: false });
      reflGlow(k, m.lampGlow, [x + dx, 8.2, z0 + 1.0], 0.55);
    }
    glowDecal(k, m.glowWall, [x, 6.4, z0], 3.4, 4.2, '+z');
  }

  // ---- プール
  const pools = POOLS_A.map((d) => buildPool(k.b, m.pool, { ...d, ctrl: d.ctrl.map(([x, z]): P2 => [x + k.ox, z + k.oz]) }));
  const [wx0, , wz0] = k.p(x0, 0, z0);
  const [wx1, , wz1] = k.p(x1, 0, z1);
  const floorOutline: P2[] = [
    [wx0, wz0],
    [wx1, wz0],
    [wx1, wz1],
    [wx0, wz1],
  ];
  k.meshW(floorWithHoles(floorOutline, pools.map((p) => p.outer), 0), m.floor, { shadow: false, name: 'floor-A' });
  floorColliders(k.ctx.colliders, [wx0, wz0, wx1, wz1], 0, pools);

  // ---- スライダーの塔（奥の中央、踊り場の上）
  const TX = -0.4;
  const TZ = z0 + 5.4;
  const TOP = 6.9;
  for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]] as [number, number][]) k.box(m.steel, [TX + dx - 0.12, 0, TZ + dz - 0.12], [TX + dx + 0.12, TOP + 1.2, TZ + dz + 0.12], { collide: true });
  k.box(m.stair, [TX - 2.0, TOP - 0.25, TZ - 2.0], [TX + 2.0, TOP, TZ + 2.0], { collide: true });
  railing(k, m.rail, [TX - 2.0, TZ - 2.0], [TX + 2.0, TZ - 2.0], TOP);
  railing(k, m.rail, [TX - 2.0, TZ + 2.0], [TX - 0.6, TZ + 2.0], TOP);
  // 踊り場（3.4 m）から塔の上（6.9 m）への階段（西へ上がる）
  // 踊り場（3.4 m）の上を西へ上がる明るい階段 → 西の端の小さな踊り場 → 塔の上
  stairs(k.b, m.stairLit, k.p(TX + 2.8, 3.4, z0 + 2.0), '-x', 3.5, 1.1);
  k.box(m.stair, [TX - 4.6, TOP - 0.25, z0 + 0.6], [TX - 3.0, TOP, TZ + 2.0], { collide: true });
  k.box(m.stair, [TX - 3.0, TOP - 0.25, TZ - 2.0], [TX - 2.0, TOP, TZ + 2.0], { collide: true });
  railing(k, m.rail, [TX - 4.6, z0 + 0.6], [TX - 4.6, TZ + 2.0], TOP);
  glowDecal(k, m.glowWall, [TX - 1.0, 5.2, z0], 4.0, 4.0, '+z');

  // ---- スライダー（競技場の形の輪: 前と後ろはほぼ水平の直線、両端の U 字で下がる。参考画像の「水平な帯が 3 段」）
  // 桃色: 塔から東へ出て、時計回り（前の直線は西へ）に 3 周、最後の前の直線の西の端から南西へ曲がって西の着水プールへ
  {
    const xw = -4.6;
    const xe = -3.1;
    const zc = -19.6;
    const R = 1.3;
    const lv = [5.9, 3.75, 1.25];
    const segs: PathSeg[] = [{ kind: 'line', to: [xe, lv[0] + 0.15, zc - R] }];
    for (let i = 0; i < 3; i++) {
      const y = lv[i];
      segs.push({ kind: 'helix', c: [xe, zc], r: R, turn: -Math.PI, y1: y });
      segs.push({ kind: 'line', to: [xw, y - 0.1, zc + R] });
      if (i < 2) {
        segs.push({ kind: 'helix', c: [xw, zc], r: R, turn: -Math.PI, y1: (y + lv[i + 1]) / 2 + 0.1 });
        segs.push({ kind: 'line', to: [xe, (y + lv[i + 1]) / 2, zc - R] });
      }
    }
    // 西の端から南へ大きく曲がって、幅広の出口で着水
    segs.push({ kind: 'helix', c: [xw, zc + R + 2.7], r: 2.7, turn: Math.PI * 0.5, y1: 0.75 });
    segs.push({ kind: 'line', to: [-5.5, 0.32, -11.4] });
    const pinkPath = k.path([TX - 1.4, TOP + 0.5, TZ + 1.4], segs, 0.22, 0.15);
    buildSlide(k, { path: pinkPath, kind: 'trough', r: 0.66, lip: 0.3, pal: m.pink, flare: { len: 3.0, k: 1.25, ky: 1.0 }, posts: { every: 4.2, floor: 0, mat: m.steel, r: 0.09, skip: (p) => p.z > -15 } });
  }
  // 白: 塔の東から出て、反時計回り（前の直線は東へ）に 2 周、東の端から S 字に南へ下りて東の奥のプールへ
  {
    const xw = 2.9;
    const xe = 4.6;
    const zc = -24.0;
    const R = 1.65;
    const segs: PathSeg[] = [
      { kind: 'line', to: [xw - 0.2, 6.6, zc - R] },
      { kind: 'helix', c: [xw, zc], r: R, turn: Math.PI, y1: 5.75 },
      { kind: 'line', to: [xe, 5.6, zc + R] },
      { kind: 'helix', c: [xe, zc], r: R, turn: Math.PI, y1: 4.6 },
      { kind: 'line', to: [xw, 4.4, zc - R] },
      { kind: 'helix', c: [xw, zc], r: R, turn: Math.PI, y1: 3.6 },
      { kind: 'line', to: [7.0, 3.4, zc + R] },
      { kind: 'helix', c: [7.0, zc + R + 2.2], r: 2.2, turn: -Math.PI * 0.5, y1: 2.0 },
      { kind: 'line', to: [7.6, 0.45, -17.6] },
    ];
    const whitePath = k.path([TX + 1.4, TOP + 0.5, TZ + 1.4], segs, 0.22, 0.15);
    buildSlide(k, { path: whitePath, kind: 'trough', r: 0.9, pal: m.white, lip: 0.32, posts: { every: 4.0, floor: 0, mat: m.steel, r: 0.1, skip: (p) => p.z > -19 } });
  }
  // 奥の踊り場の上の小さな筒のスライダー（子ども用。塔の脇から踊り場へ 1 周半）と、2 本目の小さな樋
  {
    const kid = k.path([TX + 1.6, TOP - 0.2, TZ - 1.4], [{ kind: 'helix', c: [1.6, -29.6], r: 1.1, turn: Math.PI * 3, y1: 4.3 }, { kind: 'line', to: [3.8, 3.85, -29.8] }], 0.2, 0.15);
    buildSlide(k, { path: kid, kind: 'tube', r: 0.42, pal: m.mint, tubeIn: m.tubeIn, part: 1.8 });
    const kid2 = k.spline([[-3.2, 6.0, -30.6], [-5.0, 5.2, -30.2], [-5.6, 4.4, -29.6], [-4.6, 3.75, -29.4]]);
    buildSlide(k, { path: kid2, kind: 'trough', r: 0.45, lip: 0.25, pal: m.white, part: 1.8 });
  }
  return pools;
}
