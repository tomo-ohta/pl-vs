import * as THREE from 'three';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { slab, stairs, wallWithHoles } from '../kit.ts';
import { glowDecalMat, HallKit, railing, roundLight, stairRail } from './hallkit.ts';
import { HALL, hallRectW, LOCKER, PROM, PROM_CEIL, SHOWER, SOUTH_OPEN, SOUTH_OPEN_UP, UPPER, UPPER_Y, type HallId } from './layout.ts';
import { glow, semi, wetFloor } from './mats.ts';

/**
 * 広間をつなぐ所: 広間の南の壁（開口つき）・南のプールサイドの通路・2 階の観覧通路・シャワー室・更衣室・A の西の踊り場への階段。
 * 色と材質は広間と同じ語彙（青と白のタイル・濡れた床・橙の灯り）。天井の低い所は暗い格子と丸いダウンライト
 */
export interface ConnectMats {
  floor: THREE.Material;
  wall: THREE.Material;
  wallUp: THREE.Material;
  band: THREE.Material;
  ceil: THREE.Material;
  slabEdge: THREE.Material;
  tread: THREE.Material;
  rail: THREE.Material;
  door: THREE.Material;
  lampBody: THREE.Material;
  lampLit: THREE.Material;
  roomFloor: THREE.Material;
  roomWall: THREE.Material;
  glass: THREE.Material;
  plate: THREE.Material;
  pict: THREE.Material;
  beam: THREE.Material;
  /** 四角い照明の器具の光る面 */
  panel: THREE.Material;
}

export function connectMats(ctx: SceneContext, refl: PlanarReflector): ConnectMats & { floorMats: THREE.Material[] } {
  const floor = wetFloor(ctx, refl, { color: '#2f6386', tile: 0.3, grout: '#5b8cae', groutW: 0.016, refl: 0.5, fresnel: 0.4, key: 0.5, keySoft: 0.4, streak: 0.18, name: 'X-floor' });
  // 水回りの床は 10 cm のモザイクタイル（滑りにくい）
  const roomFloor = wetFloor(ctx, refl, { color: '#6f8ea2', tile: 0.1, grout: '#44627a', groutW: 0.01, refl: 0.35, fresnel: 0.5, key: 0.5, keySoft: 0.4, streak: 0.1, name: 'X-roomfloor' });
  return {
    floorMats: [floor, roomFloor],
    floor,
    roomFloor,
    wall: semi(ctx, '#5b88a4', { tiles: { size: 0.3, line: 0.018, color: '#3f6a86', jitter: 0.18 }, name: 'X-wall' }),
    wallUp: semi(ctx, '#3d6f88', { tiles: { size: 0.3, line: 0.018, color: '#2a5670', jitter: 0.16 }, name: 'X-wallUp' }),
    band: semi(ctx, '#2c6890', { name: 'X-band' }),
    ceil: semi(ctx, '#173f58', { tiles: { size: 0.6, line: 0.018, color: '#0f3048', jitter: 0.04 }, name: 'X-ceil' }),
    slabEdge: semi(ctx, '#2f6f95', { name: 'X-slab' }),
    tread: semi(ctx, '#46768f', { name: 'X-tread' }),
    rail: semi(ctx, '#9fb9cc', { metalness: 0.2, roughness: 0.5 }),
    door: semi(ctx, '#284a5c', { name: 'X-door' }),
    lampBody: semi(ctx, '#2c3a44'),
    lampLit: glow(ctx, '#ffe2c8', 6),
    // 更衣室・シャワー室の壁は 15 cm の小さなタイル（水回りの壁）
    roomWall: semi(ctx, '#8fb0c2', { tiles: { size: 0.15, line: 0.014, color: '#5f8096', jitter: 0.16 }, name: 'X-roomwall' }),
    plate: semi(ctx, '#e4ecf2', { name: 'X-plate' }),
    beam: semi(ctx, '#8aaabe', { tiles: { size: 0.3, line: 0.014, color: '#5f8096', jitter: 0.1 }, name: 'X-beam' }),
    pict: semi(ctx, '#2f6f9c', { name: 'X-pict' }),
    panel: glow(ctx, '#fff0e0', 2.2),
    glass: ctx.mat({ color: '#9fc4d8', toon: 0, transparent: true, opacity: 0.22, depthWrite: false, line: 0, roughness: 0.05, name: 'X-glass' }),
  };
}

/** 天井を横切る梁（x0〜x1 の間に every m おき。下がり 0.45 m・幅 0.35 m）と、梁の両脇の見切りの帯 */
function crossBeams(b: Builder, m: ConnectMats, x0: number, x1: number, z0: number, z1: number, ceil: number, every: number): void {
  for (let x = x0 + every / 2; x < x1; x += every) {
    b.boxMM(m.beam, [x - 0.18, ceil - 0.45, z0], [x + 0.18, ceil, z1], { shadow: false });
    b.boxMM(m.slabEdge, [x - 0.2, ceil - 0.47, z0], [x + 0.2, ceil - 0.43, z1], { shadow: false });
  }
}

/**
 * 通路の天井の器具（梁の間ごと）: 四角い照明の器具 2 つ（光る面と枠）・換気の格子（1 つおき）、床に器具の光だまり。
 * 天井の一様な面を器具で区切り、床に明るい所と暗い所を作る
 */
function ceilingFixtures(b: Builder, m: ConnectMats, glowF: THREE.Material, x0: number, x1: number, z0: number, z1: number, ceil: number, floorY: number, every: number): void {
  let i = 0;
  for (let x = x0 + every; x < x1 - 0.5; x += every, i++) {
    for (const t of [0.3, 0.7]) {
      const z = z0 + (z1 - z0) * t;
      b.boxMM(m.lampBody, [x - 0.68, ceil - 0.07, z - 0.2], [x + 0.68, ceil, z + 0.2], { shadow: false });
      b.boxMM(m.panel, [x - 0.6, ceil - 0.075, z - 0.13], [x + 0.6, ceil - 0.069, z + 0.13], { shadow: false });
    }
    if (i % 2 === 1) {
      const z = (z0 + z1) / 2;
      b.boxMM(m.slabEdge, [x - 0.32, ceil - 0.03, z - 0.32], [x + 0.32, ceil, z + 0.32], { shadow: false });
      for (let k = -2; k <= 2; k++) b.boxMM(m.door, [x - 0.27, ceil - 0.035, z + k * 0.11 - 0.025], [x + 0.27, ceil - 0.03, z + k * 0.11 + 0.025], { shadow: false });
    }
    // 床の光だまり（器具の下が明るい）
    const g = new THREE.PlaneGeometry(2.6, (z1 - z0) * 0.8);
    g.rotateX(-Math.PI / 2);
    g.translate(x, floorY + 0.012, (z0 + z1) / 2);
    b.mesh(g, glowF, [0, 0, 0], { shadow: false, layer: 1 });
  }
}

/** 天井から吊った案内の看板（白い板に青い帯と絵記号。2 本の吊り棒）。every m おき */
function hangingSigns(b: Builder, m: ConnectMats, x0: number, x1: number, z: number, ceil: number, every: number): void {
  for (let x = x0; x < x1; x += every) {
    const y = ceil - 0.75;
    b.boxMM(m.plate, [x - 0.9, y - 0.22, z - 0.04], [x + 0.9, y + 0.22, z + 0.04], { shadow: false });
    b.boxMM(m.band, [x - 0.9, y + 0.12, z - 0.045], [x + 0.9, y + 0.22, z + 0.045], { shadow: false });
    for (const sx of [-1, 1]) {
      b.boxMM(m.pict, [x + sx * 0.5 - 0.12, y - 0.15, z - 0.05], [x + sx * 0.5 + 0.12, y + 0.08, z + 0.05], { shadow: false });
      b.boxMM(m.rail, [x + sx * 0.7 - 0.01, y + 0.22, z - 0.01], [x + sx * 0.7 + 0.01, ceil, z + 0.01], { shadow: false });
    }
    b.boxMM(m.pict, [x - 0.2, y - 0.04, z - 0.05], [x + 0.2, y + 0.0, z + 0.05], { shadow: false });
  }
}

/** 2 階の観覧通路から広間を見下ろす窓の x の範囲（観覧通路のある所だけ。3 m おき・幅 2.2 m） */
export function viewWindows(id: HallId): [number, number][] {
  const r = hallRectW(id);
  const up = SOUTH_OPEN_UP[id];
  const out: [number, number][] = [];
  for (let x = Math.max(r[0], UPPER[0]) + 1.6; x < Math.min(r[2], UPPER[2]) - 1.4; x += 3.0) {
    if (up && x > up[0] - 1.6 && x < up[1] + 1.6) continue;
    if (id === 'D' && x < HALL.D.o[0] - 1.0) continue; // D の西の張り出し（6.3 m）の下は窓にしない
    out.push([x, x + 2.2]);
  }
  return out;
}

/** 広間の南の壁（地上の開口と 2 階の開口） */
function southWalls(b: Builder, m: ConnectMats, ctx0: SceneContext): void {
  for (const id of ['A', 'B', 'C', 'D'] as HallId[]) {
    const r = hallRectW(id);
    const z = r[3] + 0.25;
    const holes = [{ at: (SOUTH_OPEN[id][0] + SOUTH_OPEN[id][1]) / 2 - (r[0] - 0.5), width: SOUTH_OPEN[id][1] - SOUTH_OPEN[id][0], bottom: 0, top: 3.0 }];
    const up = SOUTH_OPEN_UP[id];
    if (up) holes.push({ at: (up[0] + up[1]) / 2 - (r[0] - 0.5), width: up[1] - up[0], bottom: UPPER_Y, top: UPPER_Y + 2.6 });
    const wins = viewWindows(id);
    for (const [xa] of wins) holes.push({ at: xa + 1.1 - (r[0] - 0.5), width: 2.2, bottom: UPPER_Y + 0.9, top: UPPER_Y + 2.5 });
    wallWithHoles(b, m.wall, [r[0] - 0.5, z], [r[2] + 0.5, z], 0, HALL[id].ceil, 0.5, holes);
    for (const [xa, xb] of wins) {
      b.boxMM(m.glass, [xa, UPPER_Y + 0.9, z - 0.02], [xb, UPPER_Y + 2.5, z + 0.02], { shadow: false });
      b.boxMM(m.rail, [xa + 1.08, UPPER_Y + 0.9, z - 0.04], [xa + 1.12, UPPER_Y + 2.5, z + 0.04], { shadow: false });
      b.boxMM(m.slabEdge, [xa - 0.05, UPPER_Y + 0.82, z - 0.3], [xb + 0.05, UPPER_Y + 0.9, z + 0.3], { shadow: false });
      ctx0.colliders.add({ x: xa, y: UPPER_Y + 0.9, z: z - 0.25 }, { x: xb, y: UPPER_Y + 2.5, z: z + 0.25 });
    }
    // 開口の床（壁の厚みの分）
    slab(b, m.floor, [SOUTH_OPEN[id][0], r[3] - 0.1, SOUTH_OPEN[id][1], r[3] + 0.6], 0, 0.4);
    if (up) slab(b, m.slabEdge, [up[0], r[3] - 0.1, up[1], r[3] + 0.6], UPPER_Y, 0.4);
  }
}

export function buildConnect(b: Builder, ctx: SceneContext, m: ConnectMats, kA: HallKit): void {
  southWalls(b, m, ctx);
  const [px0, pz0, px1, pz1] = PROM;
  // ---- 南の通路: 床・天井・南の壁（シャワー室の入口）・東西の端の壁
  slab(b, m.floor, [px0, pz0, px1, pz1], 0, 0.4);
  slab(b, m.ceil, [px0, pz0, px1, pz1], PROM_CEIL + 0.4, 0.4, { shadow: false });
  wallWithHoles(b, m.wall, [px0 - 0.5, pz1 + 0.25], [px1 + 0.5, pz1 + 0.25], 0, PROM_CEIL, 0.5, [{ at: -px0 + 0.5, width: 3, bottom: 0, top: 2.6 }]);
  b.boxMM(m.wall, [px0 - 0.5, 0, pz0], [px0, PROM_CEIL, pz1], { collide: true });
  b.boxMM(m.wall, [px1, 0, pz0], [px1 + 0.5, PROM_CEIL, pz1], { collide: true });
  // 腰の帯（青）
  b.boxMM(m.band, [px0, 0.9, pz1 - 0.02], [px1, 1.05, pz1], { shadow: false });
  hangingSigns(b, m, px0 + 5, px1 - 2, (pz0 + pz1) / 2, PROM_CEIL, 10);
  crossBeams(b, m, px0, px1, pz0, pz1, PROM_CEIL, 4);
  // 天井の器具（梁の間）と床の光だまり
  const glowF = glowDecalMat(ctx, '#ffd0b0', 0.22);
  ceilingFixtures(b, m, glowF, px0, px1, pz0, pz1, PROM_CEIL - 0.02, 0, 4);
  for (let x = px0 + 2; x < px1; x += 8) ctx.addLamp({ pos: [x, PROM_CEIL - 0.4, (pz0 + pz1) / 2], radius: 4.5, intensity: 0.5, color: '#ffd8bc', box: [px0, 0, pz0, px1, PROM_CEIL, pz1], down: true });

  // ---- 2 階の観覧通路（通路の上）。A の東の回廊の南の端から D の観覧席まで
  const [ux0, uz0, ux1] = UPPER;
  slab(b, m.slabEdge, [ux0, uz0, ux1, pz1], UPPER_Y, 0.4);
  // 天井の板は 7.6 m より上（下に空の絵の帯と器具。前の版は板が 7.3〜7.6 m で空の絵を隠していた）
  slab(b, m.ceil, [ux0, uz0, ux1, pz1], 7.9, 0.3, { shadow: false });
  b.boxMM(m.wallUp, [ux0 - 0.5, UPPER_Y, uz0], [ux0, 7.6, pz1], { collide: true });
  b.boxMM(m.wallUp, [ux1, UPPER_Y, uz0], [ux1 + 0.5, 7.6, pz1], { collide: true });
  b.boxMM(m.wallUp, [ux0, UPPER_Y, pz1], [ux1, 7.6, pz1 + 0.5], { collide: true });
  // 通路の天井より上の壁（地上の通路の天井の上 4.4〜7.6 を、観覧通路の無い西側でふさぐ）
  b.boxMM(m.wallUp, [px0, PROM_CEIL + 0.4, pz0], [ux0 - 0.5, PROM_CEIL + 0.9, pz1], { shadow: false });
  ceilingFixtures(b, m, glowF, ux0, ux1, uz0, pz1, 7.58, UPPER_Y, 4);
  hangingSigns(b, m, ux0 + 6, ux1 - 2, (uz0 + pz1) / 2, 7.6, 9);
  crossBeams(b, m, ux0, ux1, uz0, pz1, 7.6, 4);

  for (let x = ux0 + 3; x < ux1; x += 8) ctx.addLamp({ pos: [x, 7.2, (uz0 + pz1) / 2], radius: 4.5, intensity: 0.45, color: '#ffd8bc', box: [ux0, UPPER_Y, uz0, ux1, 7.6, pz1], down: true });

  // ---- シャワー室・更衣室
  const [sx0, sz0, sx1, sz1] = SHOWER;
  slab(b, m.roomFloor, [sx0, sz0, sx1, sz1], 0, 0.4);
  slab(b, m.ceil, [sx0 - 0.5, sz0, sx1 + 0.5, sz1], 3.4, 0.4, { shadow: false });
  b.boxMM(m.roomWall, [sx0 - 0.5, 0, sz0], [sx0, 3.0, sz1], { collide: true });
  b.boxMM(m.roomWall, [sx1, 0, sz0], [sx1 + 0.5, 3.0, sz1], { collide: true });
  wallWithHoles(b, m.roomWall, [LOCKER[0] - 0.5, sz1 + 0.25], [LOCKER[2] + 0.5, sz1 + 0.25], 0, 3.0, 0.5, [{ at: -LOCKER[0] + 0.5, width: 3, bottom: 0, top: 2.4 }]);
  const [lx0, lz0, lx1, lz1] = LOCKER;
  slab(b, m.roomFloor, [lx0, lz0, lx1, lz1], 0, 0.4);
  slab(b, m.ceil, [lx0 - 0.5, lz0, lx1 + 0.5, lz1 + 0.5], 3.4, 0.4, { shadow: false });
  b.boxMM(m.roomWall, [lx0 - 0.5, 0, lz0], [lx0, 3.0, lz1], { collide: true });
  b.boxMM(m.roomWall, [lx1, 0, lz0], [lx1 + 0.5, 3.0, lz1], { collide: true });
  b.boxMM(m.roomWall, [lx0 - 0.5, 0, lz1], [lx1 + 0.5, 3.0, lz1 + 0.5], { collide: true });
  // 戸口の床
  slab(b, m.roomFloor, [-1.5, pz1 - 0.1, 1.5, sz0 + 0.1], 0, 0.4);
  slab(b, m.roomFloor, [-1.5, sz1 - 0.1, 1.5, lz0 + 0.1], 0, 0.4);
  // 受付への扉（鍵）
  b.boxMM(m.door, [-1.2, 0, lz1 - 0.06], [1.2, 2.3, lz1], { shadow: false });
  for (const [z0, z1] of [[sz0, sz1], [lz0, lz1]] as [number, number][]) {
    for (let z = z0 + 1.5; z < z1; z += 3) {
      for (const x of [-4, 0, 4]) roundLight(kA, m.lampBody, m.lampLit, [x, 2.97, z], 0.11);
      // 床の光だまり（ダウンライトの下）
      for (const x of [-4, 0, 4]) {
        const g = new THREE.PlaneGeometry(1.8, 1.8);
        g.rotateX(-Math.PI / 2);
        g.translate(x, 0.012, z);
        b.mesh(g, glowF, [0, 0, 0], { shadow: false, layer: 1 });
      }
    }
    crossBeams(b, m, -8.5, 8.5, z0, z1, 3.0, 4.25);
    // 天井の格子（見切りの帯）と換気口
    for (let x = -7; x <= 7; x += 2) b.boxMM(m.slabEdge, [x - 0.03, 2.94, z0], [x + 0.03, 3.0, z1], { shadow: false });
    for (let z = z0 + 0.75; z < z1; z += 1.5) b.boxMM(m.slabEdge, [-8.5, 2.94, z - 0.03], [8.5, 3.0, z + 0.03], { shadow: false });
    for (let z = z0 + 3; z < z1 - 1; z += 4.5) b.boxMM(m.door, [-2.3, 2.97, z - 0.3], [-1.7, 3.0, z + 0.3], { shadow: false });
    // 天井から吊った区画の札（ロッカーの番号・シャワーの案内。白い板に青い帯と番号の枠）と四角い照明
    for (let z = z0 + 2.2; z < z1 - 1; z += 2.6) {
      for (const x of [-6.2, 6.2]) {
        b.boxMM(m.plate, [x - 0.45, 2.42, z - 0.03], [x + 0.45, 2.7, z + 0.03], { shadow: false });
        b.boxMM(m.band, [x - 0.45, 2.62, z - 0.035], [x + 0.45, 2.7, z + 0.035], { shadow: false });
        b.boxMM(m.pict, [x - 0.3, 2.47, z - 0.036], [x - 0.05, 2.58, z + 0.036], { shadow: false });
        b.boxMM(m.pict, [x + 0.05, 2.47, z - 0.036], [x + 0.3, 2.58, z + 0.036], { shadow: false });
        for (const sx of [-0.35, 0.35]) b.boxMM(m.rail, [x + sx - 0.008, 2.7, z - 0.008], [x + sx + 0.008, 3.0, z + 0.008], { shadow: false });
      }
      b.boxMM(m.lampBody, [-2.0 - 0.62, 2.93, z - 0.18], [-2.0 + 0.62, 3.0, z + 0.18], { shadow: false });
      b.boxMM(m.panel, [-2.0 - 0.55, 2.925, z - 0.12], [-2.0 + 0.55, 2.931, z + 0.12], { shadow: false });
      b.boxMM(m.lampBody, [2.0 - 0.62, 2.93, z - 0.18], [2.0 + 0.62, 3.0, z + 0.18], { shadow: false });
      b.boxMM(m.panel, [2.0 - 0.55, 2.925, z - 0.12], [2.0 + 0.55, 2.931, z + 0.12], { shadow: false });
    }
  }
  ctx.addLamp({ pos: [0, 2.6, (sz0 + sz1) / 2], radius: 6, intensity: 0.45, color: '#ffe8d4', box: [sx0, 0, sz0, sx1, 3.0, sz1], down: true });
  ctx.addLamp({ pos: [0, 2.6, (lz0 + lz1) / 2], radius: 8, intensity: 0.45, color: '#ffe8d4', box: [lx0, 0, lz0, lx1, 3.0, lz1], down: true });

  // ---- A の西の低い回廊（3.6 m。西の壁沿い・上の回廊の下）と、そこへ西へ上がる階段（参考画像の左下の手すりの階段）
  for (let z = -29.5; z < -12; z += 3.5) roundLight(kA, m.lampBody, m.lampLit, [-16.0, 6.76, z], 0.12);
  const WY = 3.6;
  stairs(b, m.tread, kA.p(-9.0, 0, -15.0), '-x', WY, 1.2, { tread: 0.28 });
  stairRail(kA, m.rail, [-9.0, 0, -14.4], [-14.9, WY, -14.4], { h: 1.0, gap: 0.12 });
  stairRail(kA, m.rail, [-9.0, 0, -15.6], [-14.9, WY, -15.6], { h: 1.0, gap: 0.12 });
  kA.box(m.tread, [-17.0, WY - 0.3, -31.5], [-14.9, WY, -12.0], { collide: true });
  railing(kA, m.rail, [-14.9, -31.5], [-14.9, -15.6], WY, { h: 1.05 });
  railing(kA, m.rail, [-14.9, -14.4], [-14.9, -12.0], WY, { h: 1.05 });
  railing(kA, m.rail, [-17.0, -12.0], [-14.9, -12.0], WY, { h: 1.05 });
}
