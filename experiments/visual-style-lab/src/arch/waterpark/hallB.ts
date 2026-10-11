import * as THREE from 'three';
import { stairs } from '../kit.ts';
import { ShiftCam } from './cam.ts';
import { buildSlide, duct, glowDecal, HallKit, railing, roundLight, stairRail, type SlidePal } from './hallkit.ts';
import { HALL } from './layout.ts';
import { buildPool, floorColliders, floorWithHoles, type PoolBuilt, type PoolDef, type PoolMats } from './pools.ts';
import type { P2 } from './sweep.ts';

/**
 * B: 流れの水路の長い広間（waterpark-1）。
 * 西の壁に沿って低い天井のアーケード（天井 4.2 m、艶のあるタイル、扉の列）。その東の縁に沿って幅 3.4 m の水路が北へ長く延びる。
 * 水路の西の縁に緑青の細い柱、水路に桃色の筒のスライダーが口を開ける。東は浅いプールと桃色の大きな樋のスライダー・白いスライダー・
 * 金属の階段。天井（11 m）は青緑の空と桃色に照らされた雲。
 * 目は水路の西の縁の歩道、北北東を向く（局所の座標の原点）。
 */
export const CAM_B = new ShiftCam([HALL.B.o[0], 1.6, HALL.B.o[1]], -0.406, 60, 66);

export interface HallBMats {
  floor: THREE.Material;
  walk: THREE.Material;
  wall: THREE.Material;
  soffit: THREE.Material;
  door: THREE.Material;
  sky: THREE.Material;
  eastWall: THREE.Material;
  teal: THREE.Material;
  pale: THREE.Material;
  duct: THREE.Material;
  ductBand: THREE.Material;
  pink: SlidePal;
  pinkWhite: SlidePal;
  tubeIn: THREE.Material;
  white: SlidePal;
  steel: THREE.Material;
  rail: THREE.Material;
  lampBody: THREE.Material;
  lampLit: THREE.Material;
  glowFloor: THREE.Material;
  pool: PoolMats;
  shallow: PoolMats;
}

/** 水路と浅いプール（局所の座標） */
export const POOLS_B: PoolDef[] = [
  { id: 'B-channel', sharp: true, ctrl: [[0.8, -1.2], [4.2, -1.2], [4.2, -58], [0.8, -58]], water: -0.18, bottom: -1.2, coping: 'flush', cw: 0.25, ch: 0.02 },
  { id: 'B-shallow', sharp: true, ctrl: [[6.0, -4.0], [17.5, -4.0], [17.5, -15.5], [6.0, -15.5]], water: -0.1, bottom: -0.45, coping: 'raised', cw: 0.4, ch: 0.18 },
];

export function buildHallB(k: HallKit, m: HallBMats): PoolBuilt[] {
  const H = HALL.B;
  const [x0, z0, x1, z1] = H.rect;
  const C = H.ceil;
  const SOF = 4.2; // アーケードの天井
  const XS = -0.5; // アーケードの天井の縁

  // ---- 壁
  k.box(m.wall, [x0 - 0.5, 0, z0], [x0, C, z1], { collide: true });
  k.box(m.eastWall, [x1, 0, z0], [x1 + 0.5, C, z1], { collide: true });
  k.box(m.eastWall, [x0, 0, z0 - 0.5], [x1, C, z0], { collide: true });
  // 西の壁の扉（2.1 m、6 m おき）
  for (let z = -5.3; z > z0 + 2; z -= 6.3) k.box(m.door, [x0 + 0.01, 0, z - 0.55], [x0 + 0.06, 2.1, z + 0.55], { shadow: false });
  // アーケードの天井（艶のあるタイル）と下がり壁、ダウンライト
  k.box(m.soffit, [x0, SOF, z0], [XS, SOF + 0.3, z1], { collide: true });
  k.box(m.soffit, [XS - 0.15, SOF - 0.25, z0], [XS, SOF + 0.3, z1], { shadow: false });
  k.box(m.wall, [x0, SOF + 0.3, z0], [XS, C, z1], { shadow: false });
  for (let z = -3; z > z0 + 2; z -= 5.2) {
    roundLight(k, m.lampBody, m.lampLit, [x0 + 1.6, SOF - 0.04, z], 0.14);
    // 歩道の床の桃色の光だまり（ダウンライトの下）
    glowDecal(k, m.glowFloor, [x0 + 1.7, 0, z - 0.3], 2.6, 1.6, '+y');
    glowDecal(k, m.glowFloor, [x0 + 1.4, 0, z - 2.6], 2.0, 1.2, '+y');
  }
  // 空の絵
  const sky = new THREE.PlaneGeometry(x1 - XS, z1 - z0);
  sky.rotateX(Math.PI / 2);
  sky.translate((x1 + XS) / 2, C, (z0 + z1) / 2);
  k.mesh(sky, m.sky, { shadow: false });

  // ---- 柱
  k.cyl(m.teal, [1.0, C / 2, -14.3], 0.4, C, { collide: true, segments: 20 });
  k.cyl(m.teal, [1.0, C / 2, -30.5], 0.4, C, { collide: true, segments: 20 });
  k.cyl(m.teal, [1.0, C / 2, -46.7], 0.4, C, { collide: true, segments: 20 });
  k.cyl(m.pale, [12.35, C / 2, -22.7], 1.05, C, { collide: true, segments: 28 });
  k.cyl(m.pale, [12.35, C / 2, -44.0], 1.05, C, { collide: true, segments: 28 });

  // ---- ダクト: 縦の太いダクト（天井から筒のスライダーの塔の上へ）・東西に渡る上のダクト・東の壁沿い
  duct(k, m.duct, m.ductBand, [0.25, 3.9, -7], [0.25, C, -7], 0.55, 1.2);
  duct(k, m.duct, m.ductBand, [-0.5, 9.2, -11.2], [x1, 9.2, -7.8], 0.75);
  // 東の壁ぎわの太いダクト（北の回廊の手前で天井へ上がる）
  duct(k, m.duct, m.ductBand, [20.8, 7.0, -25.0], [20.8, 7.0, z1], 0.9);
  duct(k, m.duct, m.ductBand, [20.8, 6.1, -25.0], [20.8, C, -25.0], 0.9);
  duct(k, m.duct, m.ductBand, [3.5, 8.0, z0], [3.5, 8.0, -12], 0.6);

  // ---- 水路・浅いプール・床
  const pools = POOLS_B.map((d, i) => buildPool(k.b, i === 0 ? m.pool : m.shallow, { ...d, ctrl: d.ctrl.map(([x, z]): P2 => [x + k.ox, z + k.oz]) }));
  const [wx0, , wz0] = k.p(x0, 0, z0);
  const [wx1, , wz1] = k.p(x1, 0, z1);
  const ws = k.p(XS, 0, 0)[0];
  // アーケードの歩道（明るいタイル）と東の床
  k.meshW(floorWithHoles([[wx0, wz0], [ws, wz0], [ws, wz1], [wx0, wz1]], [], 0), m.walk, { shadow: false, name: 'floor-B-walk' });
  k.meshW(floorWithHoles([[ws, wz0], [wx1, wz0], [wx1, wz1], [ws, wz1]], pools.map((p) => p.outer), 0), m.floor, { shadow: false, name: 'floor-B' });
  floorColliders(k.ctx.colliders, [wx0, wz0, wx1, wz1], 0, pools);

  // ---- 桃色の筒（アーケードの屋根の上の塔から出て、水路の上で折り返し、北で U 字に回って南へ戻り、水路に口を開ける）
  {
    const path = k.spline([
      [0.42, 6.0, -12.0],
      [0.45, 5.6, -10.2],
      [1.4, 5.6, -9.2],
      [3.1, 5.2, -10.0],
      [3.0, 4.6, -11.2],
      [1.4, 4.4, -12.6],
      [0.2, 3.9, -16.0],
      [0.1, 3.4, -21.0],
      [1.0, 3.0, -23.6],
      [2.6, 2.7, -22.4],
      [2.4, 2.2, -18.2],
      [2.4, 1.4, -14.3],
      [2.5, 0.78, -10.6],
      [2.5, 0.72, -9.9],
    ]);
    buildSlide(k, { path, kind: 'tube', r: 0.62, pal: m.pink, tubeIn: m.tubeIn, part: 1.8, posts: { every: 3.5, floor: 0, mat: m.steel, r: 0.09, skip: (p) => p.x - k.ox < 0.9 || p.x - k.ox > 4.3 } });
    // 口の縁（少し広がる輪）
    const g = new THREE.TorusGeometry(0.72, 0.08, 6, 24);
    g.translate(...k.p(2.5, 0.72, -9.95));
    k.meshW(g, m.pink.tones[0].out, { shadow: false });
  }
  // 白い筒（同じ塔から、水路の上を北東へ下って奥の着水プールへ）
  {
    const path = k.spline([
      [0.4, 4.6, -11.0],
      [0.45, 4.0, -9.4],
      [1.6, 3.95, -13.0],
      [5.1, 3.1, -20.0],
      [7.2, 2.0, -26.0],
      [8.0, 0.6, -29.5],
    ]);
    buildSlide(k, { path, kind: 'tube', r: 0.55, pal: m.white, tubeIn: m.tubeIn, part: 1.8, posts: { every: 3.6, floor: 0, mat: m.steel, r: 0.08, skip: (p) => p.x - k.ox < 4.3 } });
  }

  // ---- 東の大きな桃色（塔 → 上の筒の輪 → 開いた樋が西へ → 柱の脇で下へ折り返し → 東へ浅いプールへ）と白いスライダー
  {
    // 東の塔（北東の階段の上）から反時計回りに 2 周半: 上の 1 周は筒、残りは開いた樋。最後は南へ浅いプールの縁へ
    const C0: [number, number] = [10.8, -12.8];
    const ring = (deg: number, r: number, y: number): [number, number, number] => [C0[0] + r * Math.cos((deg * Math.PI) / 180), y, C0[1] - r * Math.sin((deg * Math.PI) / 180)];
    const tubePts: [number, number, number][] = [[14.6, 7.3, -16.4], ring(60, 2.8, 7.0), ring(120, 2.8, 6.8), ring(180, 2.8, 6.6), ring(240, 2.8, 6.4), ring(300, 2.8, 6.2), ring(360, 2.9, 6.0)];
    const troughPts: [number, number, number][] = [
      ring(360, 2.9, 6.0),
      ring(420, 3.1, 5.5),
      ring(480, 3.3, 5.0),
      ring(540, 3.4, 4.4),
      ring(600, 3.4, 3.8),
      ring(660, 3.4, 3.3),
      ring(720, 3.4, 2.9),
      ring(780, 3.4, 2.5),
      ring(840, 3.4, 2.1),
      ring(900, 3.6, 1.7),
      [7.6, 1.2, -9.6],
      [9.6, 0.8, -8.1],
      [11.8, 0.42, -6.8],
    ];
    buildSlide(k, { path: k.spline(tubePts), kind: 'tube', r: 0.62, pal: m.pinkWhite, tubeIn: m.tubeIn, part: 1.8 });
    buildSlide(k, { path: k.spline(troughPts), kind: 'trough', r: 0.82, lip: 0.36, pal: m.pinkWhite, part: 2.0, flare: { len: 3, k: 1.3, ky: 0.7 }, posts: { every: 3.6, floor: 0, mat: m.steel, r: 0.1 } });
    // 中心の塔（細い鉄骨の柱と、輪を受ける腕）
    k.cyl(m.steel, [C0[0], 3.6, C0[1]], 0.22, 7.2, { collide: true, segments: 12 });
    for (const y of [2.4, 4.2, 6.0]) for (const a of [0, 1, 2, 3]) {
      const ang = a * (Math.PI / 2) + y;
      const g = new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6);
      g.rotateZ(Math.PI / 2);
      g.rotateY(ang);
      g.translate(...k.p(C0[0] + Math.cos(ang) * 1.7, y, C0[1] - Math.sin(ang) * 1.7));
      k.meshW(g, m.steel, { shadow: false });
    }
  }
  {
    // 白い半円の樋（奥の螺旋の下の段から、手前の浅いプールの縁へ）
    const path = k.spline([
      [4.6, 4.3, -15.0],
      [6.4, 3.2, -12.6],
      [6.2, 2.2, -10.0],
      [5.4, 1.2, -7.6],
      [5.9, 0.45, -6.4],
    ]);
    buildSlide(k, { path, kind: 'trough', r: 0.78, lip: 0.42, pal: m.white, flare: { len: 1.8, k: 1.2, ky: 0.85 }, posts: { every: 3.2, floor: 0, mat: m.steel, r: 0.08 } });
  }
  // 奥の真ん中の筒の群れ（参考画像の水路の奥の白と桃色の筒）
  {
    const f1 = k.path([19.6, 6.4, -29.0], [{ kind: 'helix', c: [16.6, -27.4], r: 2.2, turn: Math.PI * 1.8, y1: 2.6 }, { kind: 'line', to: [14.0, 1.0, -22.8] }], 0.3, 0.12);
    buildSlide(k, { path: f1, kind: 'tube', r: 0.55, pal: m.white, tubeIn: m.tubeIn, posts: { every: 3.0, floor: 0, mat: m.steel, r: 0.08 } });
    const f2 = k.spline([[21.0, 5.6, -21.0], [18.0, 4.8, -24.5], [15.4, 3.9, -28.6], [12.6, 3.0, -31.4], [9.6, 1.6, -32.0]]);
    buildSlide(k, { path: f2, kind: 'tube', r: 0.5, pal: m.pink, tubeIn: m.tubeIn, posts: { every: 3.4, floor: 0, mat: m.steel, r: 0.08 } });
  }
  // スライダーの塔（東）と階段
  const TX = 15.5;
  const TZ = -19.5;
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as [number, number][]) k.box(m.steel, [TX + dx - 0.12, 0, TZ + dz - 0.12], [TX + dx + 0.12, 8.6, TZ + dz + 0.12], { collide: true });
  k.box(m.steel, [TX - 1.8, 7.6, TZ - 1.8], [TX + 1.8, 7.85, TZ + 1.8], { collide: true });
  stairs(k.b, m.steel, k.p(19.0, 0, -4.5), '-z', 3.4, 1.2);
  stairRail(k, m.rail, [18.4, 0, -4.5], [18.4, 3.4, -10.6]);
  stairRail(k, m.rail, [19.6, 0, -4.5], [19.6, 3.4, -10.6]);
  k.box(m.steel, [18.2, 3.15, -14.0], [20.0, 3.4, -10.6], { collide: true });
  stairs(k.b, m.steel, k.p(18.4, 3.4, -14.0), '-x', 4.2, 1.2, { tread: 0.3 });
  railing(k, m.rail, [20.0, -14.0], [20.0, -10.6], 3.4);
  return pools;
}
