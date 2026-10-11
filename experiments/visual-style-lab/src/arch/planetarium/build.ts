import * as THREE from 'three';
import { Builder } from '../../scenes/Builder.ts';
import type { BuiltScene, SceneContext } from '../../scenes/types.ts';
import { createBeam } from './beam.ts';
import { buildDome } from './dome.ts';
import { buildBooth, buildDrum, buildFloors, buildPulpit, doorAt, gridColliders, inCamZone, inPulpit, l1R } from './hall.ts';
import { BEAM, DOME, DRUM_R, FLOOR, inHouse, LOBBY, LOGE, PULPIT, RING, TIERS, VIEW } from './layout.ts';
import { makeMats } from './mats.ts';
import { buildBackhouse, buildStageProps } from './backhouse.ts';
import { buildLobby, buildOuter, inLobby, outerColliders } from './outer.ts';
import { buildDressing } from './dress.ts';
import { LightShapes } from './fx.ts';
import { buildAisleLights, buildHallFit } from './hallfit.ts';
import { bayAt } from './zones.ts';

const PULPIT_NARROW = PULPIT.narrowR;
import { buildLights, buildStarCeilings, buildStarWall } from './lights.ts';
import { floorY, polar, rWall, tierAt, type TierRow } from './profile.ts';
import { bleacherSeatGeometry, buildSeats, seatPlaces, type SeatBlock, type SeatPlace } from './seats.ts';

/** 舞台の裏の塔（扉）。舞台の中心からの角度の範囲・前の面の半径・高さ */
export const BACKHOUSE = { a0: -0.34, a1: 0.23, r0: 8.6, top: 8.4 };
/** 段床の通路（角度）: 裏の段床・北西の段床 */
export const BACK_AISLES = [-0.72, -0.42, 0.3, 0.62, 0.95];
export const WEST_AISLES = [-1.95, -1.6, -1.3];

/** 正面の席の塊の角度（カメラの前。π をまたぐ） */
const CENTER = { a0: 2.958, a1: -2.75 };

function rowsEvery(r0: number, r1: number, d: number): { r: number; y: number }[] {
  const rows: { r: number; y: number }[] = [];
  for (let r = r0; r <= r1 + 1e-6; r += d) rows.push({ r, y: 0 });
  return rows;
}

/** 平土間の席の区画 */
function floorBlocks(): SeatBlock[] {
  return [
    // 正面の塊（劇場の椅子・密な列）
    { a0: CENTER.a0, a1: CENTER.a1, rows: rowsEvery(10.2, 24, 0.88), tablet: false, aisles: [] },
    // 西・南西の平土間（机つきの席の弧。列の間が広い）
    { a0: -2.71, a1: TIERS.back.a0 - 0.02, rows: rowsEvery(10.6, 30, 2.05), tablet: true, aisles: [-2.3, -1.85, -1.45] },
    // 東・南東（机つきの席の弧。西と同じ並び）
    { a0: TIERS.back.a1 + 0.02, a1: CENTER.a0, rows: rowsEvery(10.6, 30, 2.05), tablet: true, aisles: [1.62, 2.1, 2.55] },
  ];
}

/** 段床の通路の半分の段（蹴上げ 0.4 m を 0.2 m ずつ上る）。d = 段床の始まりからの距離 */
export function aisleStepY(rows: TierRow[], d: number, tread: number): number {
  for (let i = 0; i < rows.length; i++) {
    const rw = rows[i];
    if (d < rw.d1) {
      const next = rows[i + 1];
      if (next && d > rw.d1 - tread / 2) return rw.y + (next.y - rw.y) / 2;
      return rw.y;
    }
  }
  return rows[rows.length - 1].y;
}

/** 段床の席: 段ごとに 1 列（舞台を向く）。上の回廊の段と横の通路の段には置かない */
function tierPlaces(def: { a0: number; a1: number; tread: number; cross?: { y: number } }, rows: TierRow[], start: (a: number) => number, aisles: number[]): SeatPlace[] {
  const out: SeatPlace[] = [];
  rows.forEach((rw, k) => {
    if (k === rows.length - 1) return;
    if (def.cross && Math.abs(rw.y - def.cross.y) < 1e-6) return;
    for (let a = def.a0 + 0.03; a < def.a1 - 0.03; ) {
      const r = start(a) + rw.d0 + Math.min(0.45, (rw.d1 - rw.d0) * 0.62);
      const da = 0.6 / r;
      if (!aisles.some((al) => Math.abs(a - al) * r < 0.95) && r < rWall(a) - 0.6) {
        const x = r * Math.sin(a);
        const z = -r * Math.cos(a);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, rw.y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(1, 1, 1));
        out.push({ m, tablet: false, x, z, y: rw.y });
      }
      a += da;
    }
  });
  return out;
}

export function buildPlanetarium(ctx: SceneContext): BuiltScene {
  const b = new Builder(ctx);
  const m = makeMats(ctx);
  buildFloors(b, m);
  buildDrum(b, m);
  buildBooth(b, m);
  buildPulpit(b, m);
  buildDome(b);
  buildOuter(b, m.outer);
  buildLobby(b, m.outer);
  const fx = new LightShapes();
  buildDressing(b, ctx, m.dress, fx);
  buildHallFit(b, ctx, fx, { pier: m.pier, trim: m.pier, frame: m.dress.frame, house: m.house });

  const inHouseA = (a: number): boolean => a > BACKHOUSE.a0 - 0.02 && a < BACKHOUSE.a1 + 0.02;

  // 裏の段床のベンチの席（段ごとの帯）
  {
    const rows = tierAt(0)!.rows;
    const strips = rows
      .filter((rw, k) => k < rows.length - 1 && !(TIERS.back.cross && Math.abs(rw.y - TIERS.back.cross.y) < 1e-6))
      .map((rw) => ({ r0: TIERS.back.r0 + rw.d0, r1: TIERS.back.r0 + rw.d1, y: rw.y }));
    const gap = (a: number, r: number): boolean => BACK_AISLES.some((al) => Math.abs(a - al) * r < 0.65) || inHouseA(a) || r > rWall(a) - 0.4;
    b.mesh(bleacherSeatGeometry(strips, TIERS.back.a0 + 0.03, TIERS.back.a1 - 0.03, gap), m.bleachSeat, [0, 0, 0], { shadow: true });
  }

  // 舞台の裏の塔・扉・操作卓などの小物
  const doorMat = ctx.mat({ color: '#000000', unlit: true, emissive: '#ffe39a', emissiveIntensity: 1.8, toon: 0, line: 0, name: 'door-light' });
  const glow2 = ctx.mat({ color: '#000000', unlit: true, emissive: '#fff1d8', emissiveIntensity: 1.2, toon: 0, line: 0, name: 'house-panel' });
  buildBackhouse(b, {
    glow2,
    // 前室の中: 暖かい灰の漆喰の壁・明るい石の床・暗い天井（光は奥の光の板と天井の灯りの光だまり）
    roomWall: ctx.mat({ color: '#83807a', toon: 0, roughness: 0.85, line: 0, name: 'room-wall' }),
    roomFloor: ctx.mat({ color: '#98958c', toon: 0, roughness: 0.35, line: 0, name: 'room-floor', tiles: { size: 0.6, line: 0.01, color: '#6f6656', jitter: 0.1 } }),
    roomCeil: ctx.mat({ color: '#2e3134', toon: 0, roughness: 0.9, line: 0, name: 'room-ceil' }),
    wall: m.house,
    trim: m.pier,
    dark: m.console,
    rail: m.rail,
    door: doorMat,
  });
  // 前室の光: 奥の光の板の前の光だまり（板に近いほど明るく、扉の側と隅は暗い）と天井の灯り
  ctx.addLamp({ pos: [-1.1, 1.5, -13.3], radius: 4.6, intensity: 1.4, color: '#ffe4c2', box: [-2.7, 0.2, -14.2, 1.7, 3.4, -9.8], shadow: 0 });
  ctx.addLamp({ pos: [-0.4, 3.0, -12.2], radius: 3.2, intensity: 0.55, color: '#ffe6c4', box: [-2.7, 0.2, -14.2, 1.7, 3.4, -9.8], down: true, shadow: 0 });
  // 扉の口の床（前室の床の扉の近くも明るい: 舞台から見た扉の下の端まで光る）
  ctx.addLamp({ pos: [-0.8, 0.9, -10.6], radius: 2.4, intensity: 1.2, color: '#ffe8c8', box: [-2.7, 0.2, -14.2, 1.7, 3.4, -9.8], shadow: 0 });
  // 扉から舞台の床へこぼれる光（扉の口の形が床に落ちた台形。扉に近いほど明るい）。足す合成の薄い板
  {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 256;
    const g = cv.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,236,190,1)');
    grd.addColorStop(0.35, 'rgba(255,230,180,0.45)');
    grd.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 256);
    // 横の縁はぼかす
    const side = g.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.2, 'rgba(0,0,0,0)');
    side.addColorStop(0.8, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side;
    g.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spill = ctx.mat({ color: '#000000', unlit: true, emissive: '#ffffff', emissiveIntensity: 0.55, toon: 0, line: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, name: 'door-spill' }) as THREE.MeshStandardMaterial;
    spill.emissiveMap = tex;
    spill.alphaMap = null;
    spill.blending = THREE.AdditiveBlending;
    // 台形: 扉の口（幅 1.25）から手前へ 3.6 m、幅 2.4 まで広がる
    const z0 = -9.48;
    const z1 = -5.8;
    const geo = new THREE.BufferGeometry();
    const xs0 = [-0.8 - 0.62, -0.8 + 0.62];
    const xs1 = [-0.8 - 1.2, -0.8 + 1.2];
    const y = 0.3 + 0.006;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([xs0[0], y, z0, xs0[1], y, z0, xs1[1], y, z1, xs0[0], y, z0, xs1[1], y, z1, xs1[0], y, z1], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
    geo.computeVertexNormals();
    // canvas の上（v = 1）が扉の側
    const mesh = new THREE.Mesh(geo, spill);
    mesh.renderOrder = 5;
    b.root.add(mesh);
  }
  // 前室の床の光の板からの照り返し（板に近いほど明るい）。灯りの光だまりは目に近い 16 個だけなので、
  // 舞台から扉の向こうに見える床も明るく見えるように、床の上に足す合成の薄い板で描く
  {
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,232,190,1)');
    grd.addColorStop(0.5, 'rgba(255,232,190,0.35)');
    grd.addColorStop(1, 'rgba(255,232,190,0.12)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = ctx.mat({ color: '#000000', unlit: true, emissive: '#ffffff', emissiveIntensity: 0.4, toon: 0, line: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, name: 'room-floor-glow' }) as THREE.MeshStandardMaterial;
    mat.emissiveMap = tex;
    mat.blending = THREE.AdditiveBlending;
    // 前室の床（x -2.7〜1.7・z -14.2〜-9.8）。v = 1 が奥（光の板）
    const geo = new THREE.PlaneGeometry(4.4, 4.4);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.5, 0.304, -12.0);
    mesh.renderOrder = 5;
    b.root.add(mesh);
  }
  // 通路の灯りは光る面を客席の後ろ（外）へ向ける（足もとを照らし、後ろの段から見える）
  const lampAt = (r: number, a: number): { x: number; z: number; yaw: number } => ({ x: r * Math.sin(a), z: -r * Math.cos(a), yaw: Math.atan2(Math.sin(a), -Math.cos(a)) });
  buildStageProps(
    b,
    ctx,
    [lampAt(13.8, 2.905), lampAt(17.6, 2.905), lampAt(21.4, 2.905), lampAt(13.8, -2.707), lampAt(17.6, -2.707), lampAt(21.4, -2.707)],
    [
      { x: 6.4, z: 15.0, yaw: 0.35 },
      { x: 10.0, z: 13.3, yaw: 0.6 },
    ],
  );

  // 客席: 平土間の区画・北西の段床
  const skip = (x: number, z: number): boolean => {
    const { r, a } = polar(x, z);
    if (r < FLOOR.r0 + 0.3) return true;
    if (x > -3 && x < 7 && z > 5 && z < 11.2) return true;
    const t = tierAt(a);
    if (t && r > t.start - 0.6) return true;
    return false;
  };
  const places = seatPlaces(floorBlocks(), skip, (a) => rWall(a) - 1.2);
  const west = tierPlaces(TIERS.west, tierAt((TIERS.west.a0 + TIERS.west.a1) / 2)!.rows, (a) => rWall(a) - TIERS.west.depth, WEST_AISLES);
  const all = [...places, ...west];
  buildSeats(ctx, b.root, m.seat, all);
  buildAisleLights(b, ctx, fx, all);

  // 小さな灯り（回廊の手すり・壁付け灯・輪の梁・段床の通路の足もと・投影室の窓）
  const steps: { x: number; y: number; z: number; yaw: number }[] = [];
  for (const [def, aisles, start] of [
    [TIERS.back, BACK_AISLES, () => TIERS.back.r0],
    [TIERS.west, WEST_AISLES, (a: number) => rWall(a) - TIERS.west.depth],
  ] as const) {
    const rows = tierAt((def.a0 + def.a1) / 2)!.rows;
    for (const al of aisles) {
      for (const rw of rows.slice(0, -1)) {
        for (const sg of [-1, 1]) {
          const r = (start as (a: number) => number)(al) + rw.d0 + 0.1;
          const a = al + (sg * 0.62) / r;
          if (r > rWall(a) - 0.5) continue;
          steps.push({ x: r * Math.sin(a), y: rw.y - 0.12, z: -r * Math.cos(a), yaw: Math.atan2(-Math.sin(a), Math.cos(a)) });
        }
      }
    }
  }
  buildLights(ctx, b.root, floorY, steps);
  // 回廊のドラムの外の面の星の壁（出入口と壁柱は空ける）
  buildStarWall(ctx, b.root, RING.wallOut, [
    [1.05, RING.ceil1 - 0.15],
    [RING.floor2 + 1.05, RING.ceil2 - 0.15],
  ], (ph, band, y) => {
    // 星の壁: 光ファイバーの星を植えた吸音の布の板（展示の区間）と、壁の面（休む区間・玄関ホール）。
    // 扉の額縁と開いた扉の所・壁柱・展示の区間の壁の陳列棚の所は空ける
    const lv = band === 0 ? 1 : 2;
    const bz = bayAt(lv, ph);
    if (bz.zone === 'exhibit') {
      const pc = Math.round(((ph * 180) / Math.PI - 3.75) / 7.5) * 7.5 + 3.75;
      const dt = (((ph * 180) / Math.PI - pc) * Math.PI) / 180 * RING.wallOut;
      const yb = y - (lv === 1 ? 0 : RING.floor2);
      if (Math.abs(dt) < 0.6 && yb < 2.35) return true;
      if (yb < 1.05) return true;
    }
    if (bz.zone === 'rest' || (bz.zone === 'entrance' && bz.door === undefined)) {
      const yb = y - (lv === 1 ? 0 : RING.floor2);
      if (yb < 1.05) return true;
    }
    return !!doorAt(ph, 0.075) || Math.abs(((ph * 48) / (Math.PI * 2) + 1000.5) % 1 - 0.5) > 0.42;
  }, (ph, band) => {
    const bz = bayAt(band === 0 ? 1 : 2, ph);
    return bz.zone === 'exhibit' || bz.zone === 'rest' || (bz.zone === 'entrance' && bz.door === undefined) ? 0.046 : 0;
  });

  // 回廊と玄関ホールの星空の天井
  {
    const annulus = (r0: number, r1: number, y: number, skipLobby: boolean) => ({
      area: Math.PI * (r1 * r1 - r0 * r0),
      sample: (u: number, v: number): [number, number, number] | null => {
        const r = Math.sqrt(r0 * r0 + u * (r1 * r1 - r0 * r0));
        const ph = v * Math.PI * 2;
        const x = DOME.cx + r * Math.sin(ph);
        const z = DOME.cz - r * Math.cos(ph);
        if (skipLobby && inLobby(x, z)) return null;
        return [x, y, z];
      },
    });
    buildStarCeilings(ctx, b.root, [
      annulus(RING.wallOut + 0.2, RING.r1 - 0.2, RING.ceil1, true),
      annulus(RING.wallOut + 0.2, RING.r2 - 0.2, RING.ceil2, false),
      {
        area: (LOBBY.x1 - LOBBY.x0) * (LOBBY.z1 - LOBBY.z0),
        sample: (u, v) => {
          const x = LOBBY.x0 + 0.3 + u * (LOBBY.x1 - LOBBY.x0 - 0.6);
          const z = LOBBY.z0 + 0.3 + v * (LOBBY.z1 - LOBBY.z0 - 0.6);
          if (Math.hypot(x - DOME.cx, z - DOME.cz) < RING.r2 + 0.2) return null;
          return [x, LOBBY.ceil, z];
        },
      },
    ]);
  }

  // 照明: ドームの光（上から広く）・照明の輪のスポット
  const hemi = new THREE.HemisphereLight('#3f98bb', '#04090e', 0.22);
  // ドームの映像の光: ドームの頂部から下へ広く（壁ぎわほど弱い）。影は付けない
  const top = new THREE.SpotLight('#5cc0e6', 2.6, 0, 0.55, 1.0, 0);
  top.position.set(-5, 38, 1);
  top.target.position.set(-3, 0, 2);
  // 壁の外（回廊）へ光が抜けないように影を付ける（動かない場面なので影の地図は 1 回だけ描く）
  top.castShadow = true;
  top.shadow.mapSize.set(2048, 2048);
  top.shadow.bias = -0.0005;
  top.shadow.normalBias = 0.04;
  top.shadow.camera.near = 10;
  top.shadow.camera.far = 60;
  b.root.add(hemi, top, top.target);
  const apex = new THREE.Vector3(...BEAM.apex);
  const target = new THREE.Vector3(...BEAM.target);
  const half = (BEAM.half * Math.PI) / 180;
  const spot = new THREE.SpotLight('#a8e6ff', 4.6, 0, half * 1.05, 0.25, 0);
  spot.position.copy(apex);
  spot.target.position.copy(target);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.03;
  spot.shadow.camera.near = 8;
  spot.shadow.camera.far = 75;
  b.root.add(spot, spot.target);
  // 2 つ目の照明（煙の筋は見せない洗い）: 舞台の奥の右の段床と柱の回廊を照らす（参考画像の光の筋の右下の「膝」）
  const wash = new THREE.SpotLight('#9fe0f8', 2.2, 0, 0.26, 0.15, 0);
  wash.position.set(-11, 30.5, 8.5);
  wash.target.position.set(6.5, 5.0, -15);
  wash.castShadow = true;
  wash.shadow.mapSize.set(1024, 1024);
  wash.shadow.bias = -0.0005;
  wash.shadow.normalBias = 0.04;
  wash.shadow.camera.near = 10;
  wash.shadow.camera.far = 70;
  b.root.add(wash, wash.target);
  // 扉の光（舞台の奥の床へこぼれる暖かい光だまり）
  ctx.addLamp({ pos: [-0.8, 1.4, -8.2], radius: 7.5, intensity: 1.1, color: '#ffd98a', box: [-6, 0, -9.6, 4.5, 4, -1], shadow: 0 });
  const beam = createBeam({ apex, target, half, color: '#3d9cc0', density: 0.017, rim: 0.25, pool: 1.5, falloff: 1.0 });
  b.root.add(beam.mesh);

  // 当たり判定: 平土間・段床（通路は半分の段）・席の所は高く・1 階 / 2 階の回廊と手すり・張り出しの桟敷・ドラムの壁
  const seatCells = new Set<string>();
  const key = (x: number, z: number): string => `${Math.floor(x / 0.5)},${Math.floor(z / 0.5)}`;
  for (const p of all) {
    // 席の中心と背の側（0.2 m 外）の升目を通れなくする（列の間は歩ける）
    const l = Math.hypot(p.x, p.z) || 1;
    seatCells.add(key(p.x, p.z));
    seatCells.add(key(p.x + (p.x / l) * 0.2, p.z + (p.z / l) * 0.2));
  }
  const rD = (x: number, z: number): number => Math.hypot(x - DOME.cx, z - DOME.cz);
  const phD = (x: number, z: number): number => Math.atan2(x - DOME.cx, -(z - DOME.cz));
  const ground = (x: number, z: number): [number, number] | null => {
    if (rD(x, z) > DRUM_R - 0.05) return null;
    // 舞台の裏の塔の中（前室）は舞台の高さ
    if (inHouse(x, z)) return [-1.2, 0.3];
    const { r, a } = polar(x, z);
    let y = floorY(x, z);
    const t = tierAt(a);
    if (t && r > t.start) {
      const aisles = t.def === TIERS.back ? BACK_AISLES : WEST_AISLES;
      if (aisles.some((al) => Math.abs(a - al) * r < 0.55)) y = aisleStepY(t.rows, r - t.start, t.def.tread);
    }
    if (seatCells.has(key(x, z))) y += 0.9;
    return [-1.2, y];
  };
  const R2 = DRUM_R - LOGE.l2Depth;
  const l2At = (x: number, z: number): boolean => {
    const ph = (phD(x, z) * 180) / Math.PI;
    return ph >= LOGE.l2Phi[0] && ph <= LOGE.l2Phi[1];
  };
  const gallery = (x: number, z: number): [number, number] | null => {
    if (floorY(x, z) >= LOGE.l1 - 1e-3) return null;
    if (inPulpit(x, z)) return [LOGE.l1 - 0.35, LOGE.l1];
    const d = rD(x, z);
    if (d < l1R(phD(x, z)) - 0.05 || d > DRUM_R) return null;
    return [LOGE.l1 - 0.35, LOGE.l1];
  };
  const railing = (x: number, z: number): [number, number] | null => {
    if (floorY(x, z) >= LOGE.l1 - 1e-3) return null;
    if (inPulpit(x, z, -0.15)) return null;
    const d = rD(x, z);
    const ph = phD(x, z);
    // 演台の縁
    if (inPulpit(x, z, 0.25) && d < l1R(ph)) return [LOGE.l1, LOGE.l1 + 1.1];
    if (inPulpit(x, z, 0.1)) return null;
    // 細い通路と広い回廊の境の縁（放射の向きの手すり）
    const zoneEdge = inCamZone(ph) !== inCamZone(ph + 0.3 / d) || inCamZone(ph) !== inCamZone(ph - 0.3 / d);
    if (zoneEdge && d > LOGE.l1R - 0.2 && d < PULPIT_NARROW + 0.1) return [LOGE.l1, LOGE.l1 + 1.1];
    const R1 = l1R(ph);
    if (d < R1 - 0.25 || d >= R1 + 0.1) return null;
    return [LOGE.l1, LOGE.l1 + 1.1];
  };
  const gallery2 = (x: number, z: number): [number, number] | null => {
    if (!l2At(x, z)) return null;
    if (floorY(x, z) >= LOGE.l2 - 1e-3) return null;
    const d = rD(x, z);
    if (d < R2 - 0.05 || d > DRUM_R) return null;
    return [LOGE.l2 - 0.45, LOGE.l2];
  };
  const railing2 = (x: number, z: number): [number, number] | null => {
    if (!l2At(x, z)) return null;
    if (floorY(x, z) >= LOGE.l2 - 1e-3) return null;
    const d = rD(x, z);
    if (d < R2 - 0.3 || d >= R2 + 0.2) return null;
    return [LOGE.l2, LOGE.l2 + 1.0];
  };
  const oc = outerColliders();
  const bx = [DOME.cx - RING.r1 - 1, DOME.cz - RING.r1 - 1, DOME.cx + RING.r1 + 1, Math.max(DOME.cz + RING.r1 + 1, LOBBY.z1 + 0.5)] as const;
  for (const f of [ground, gallery, railing, gallery2, railing2, oc.ground, oc.upper, oc.walls, oc.walls2]) gridColliders(ctx, f, bx[0], bx[1], bx[2], bx[3], 0.5);

  // 内向きの片面の壁・天井・ドームも、中の照明の影を落とす（影の描画は既定で裏の面だけを描くので、両面にする）
  for (const mm of [m.wall, m.outer.wall, m.outer.ceiling, m.ceiling, m.slab, m.house]) (mm as THREE.MeshStandardMaterial).shadowSide = THREE.DoubleSide;
  b.root.traverse((o) => {
    if (o.name === 'dome') ((o as THREE.Mesh).material as THREE.Material).shadowSide = THREE.DoubleSide;
  });

  fx.build(b, ctx);
  b.finalize();
  return {
    root: b.root,
    spawn: { pos: [VIEW.eye[0], LOGE.l1, VIEW.eye[2]], yaw: VIEW.yaw },
    staticShadows: true,
    beforeRender(camera) {
      beam.update(camera);
    },
  };
}
