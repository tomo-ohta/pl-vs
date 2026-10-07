import * as THREE from 'three';
import { Builder, rng, type V3 } from '../../scenes/Builder.ts';
import type { BuiltScene, SceneContext } from '../../scenes/types.ts';
import { buildCanopies } from './canopies.ts';
import { buildD } from './dplat.ts';
import { floorMat, type PuddleShape, type Strip } from './floor.ts';
import { seatRow, slatBench } from './furniture.ts';
import { createTubeGlow, type Tube } from './glow.ts';
import { instanced, trs, tuftGeometry } from './kit.ts';
import { A, ASTAIR, BC, BLD, D, D_OLD, FREIGHT, SHED, SITE, TCAN, TUN, Y } from './layout.ts';
import { Looks } from './looks.ts';
import { LOOKS } from './looks-data.ts';
import { clearPools, setRoofs, updatePools } from './mat.ts';
import { makeMats } from './mats.ts';
import { createStationSky } from './sky.ts';
import { buildTracks } from './tracks.ts';
import { buildBuilding } from './building.ts';
import { buildSite } from './site.ts';
import { buildDressing } from './dress.ts';
import { consolidate } from './region.ts';
import { D_ROOF_LEN } from './dplat.ts';

/** A の水たまり: ノイズ（大きさ・しきい値・縁で上がる量・半幅） */
const PUD_A: [number, number, number, number] = [0.6, 0.26, 0.35, A.half];
/**
 * 手で置いた水たまり（参考画像を見ながら、大きな塊がある所に置いた絵の具の塊。縁はノイズでちぎる）。元の版と同じ。
 * A の大屋根の北（station-1 の手前）・中央柱の上屋の南（station-3 の手前）、D の先端（station-0。回す前の座標）
 */
const SHAPES_A: PuddleShape[] = [
  { x: 0.1, z: -6.8, rx: 0.85, rz: 1.9 },
  { x: -0.6, z: -4.25, rx: 0.65, rz: 0.32 },
  { x: 1.35, z: -4.15, rx: 0.8, rz: 0.55 },
  { x: 0.5, z: -3.3, rx: 0.4, rz: 0.17 },
  { x: 1.7, z: -5.2, rx: 0.55, rz: 0.4 },
  { x: 2.0, z: -7.8, rx: 0.3, rz: 0.4 },
  { x: 0.0, z: -10.0, rx: 1.0, rz: 0.4 },
  { x: 0.0, z: -10.8, rx: 0.9, rz: 1.1 },
  { x: 1.7, z: 22.8, rx: 0.55, rz: 4.8 },
  { x: 1.0, z: 19.4, rx: 0.32, rz: 1.0 },
  { x: 1.0, z: 25.8, rx: 0.3, rz: 1.4 },
  { x: -1.75, z: 25.2, rx: 0.45, rz: 2.2 },
  { x: 0.0, z: 30.0, rx: 0.32, rz: 1.8 },
  { x: -1.0, z: 28.8, rx: 0.3, rz: 0.9 },
];
const SHAPES_D: PuddleShape[] = [
  { x: -61.2, z: -2.2, rx: 1.1, rz: 1.35 },
  { x: -56.4, z: 2.9, rx: 0.45, rz: 0.55 },
  { x: -56.45, z: -0.95, rx: 0.5, rz: 0.5 },
  { x: -61.3, z: 3.1, rx: 0.65, rz: 1.0 },
];

/** 長方形から穴（長方形）を抜いた残りを、軸に沿った長方形の集まりで返す（当たり判定の地面） */
export function rectMinusHoles(r: [number, number, number, number], holes: [number, number, number, number][]): [number, number, number, number][] {
  const xs = [...new Set([r[0], r[2], ...holes.flatMap((h) => [h[0], h[2]])])].filter((x) => x >= r[0] && x <= r[2]).sort((a, b) => a - b);
  const out: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const cut = holes.filter((h) => h[0] < x1 && h[2] > x0).map((h) => [h[1], h[3]] as [number, number]).sort((a, b) => a[0] - b[0]);
    let z = r[1];
    for (const [a, c] of cut) {
      if (a > z) out.push([x0, z, x1, a]);
      z = Math.max(z, c);
    }
    if (z < r[3]) out.push([x0, z, x1, r[3]]);
  }
  return out;
}

export function buildStation(ctx: SceneContext): BuiltScene {
  const b = new Builder(ctx);
  clearPools();
  const mat = makeMats();
  const rand = rng(7);
  const tubes: Tube[] = [];
  const addTube = (c: V3, len: number, along: 'x' | 'z', w: number, h = 0.04, round = false): void => {
    if (round) {
      const g = new THREE.CapsuleGeometry(w / 2, Math.max(len - w, 0.01), 4, 10);
      if (along === 'x') g.rotateZ(Math.PI / 2);
      else g.rotateX(Math.PI / 2);
      b.mesh(g, mat.tube, c, { shadow: false });
    } else b.box(mat.tube, c, along === 'x' ? [len, h, w] : [w, h, len], { shadow: false });
    tubes.push({ c, axis: along === 'x' ? [1, 0, 0] : [0, 0, 1], len });
  };

  // ---------- 屋根（明るさの計算用の長方形）。地下道は道床の下（-2.0。上の地面を暗くしない高さ） ----------
  setRoofs([
    { x0: -SHED.half, z0: SHED.z0 - 0.2, x1: SHED.half, z1: SHED.z1, h: SHED.soffit, lamp: 0.05 },
    { x0: -TCAN.half, z0: TCAN.z0, x1: TCAN.half, z1: TCAN.z1, h: (TCAN.center + TCAN.edge) / 2, lamp: 0.02 },
    { x0: -10.1, z0: 46.5, x1: -2.0, z1: 56.05, h: 3.56, lamp: 1.5 },
    { x0: 2.0, z0: 46.5, x1: 10.1, z1: 56.05, h: 3.56, lamp: 1.5 },
    { x0: D.x - D.half + 0.2, z0: D.z1 - D_ROOF_LEN, x1: D.x + D.half - 0.2, z1: D.z1 - 0.5, h: D.soffit, lamp: 0.015 },
    // 駅舎と地下道: 屋根の下の一様な灯りは弱く（室内の明るさは天井の器具と窓の光だまり。mat.ts の Pool）。駅舎は軒の出まで
    { x0: BLD.x0 - 0.7, z0: BLD.z0 - 0.6, x1: BLD.x1 + 0.7, z1: BLD.z1 + 0.6, h: 3.0, lamp: 0.16, fog: false },
    { x0: TUN.x0 - 8, z0: TUN.z0 - 0.3, x1: TUN.x1 + 0.3, z1: TUN.z1 + 0.3, h: -2.0, lamp: 0.13, fog: false },
    // 旧貨物ホームの荷役の上屋（下は暗く、蛍光灯が照らす）。霧の暗さには使わない。
    // 屋根の長方形は全部の画素の明るさの計算で調べるので、増やすと全体が重くなる（小さな庇・バス停・駐輪場には使わない）
    { x0: FREIGHT.x0 + 8, z0: FREIGHT.z0 + 4, x1: FREIGHT.x1 + 0.6, z1: FREIGHT.z1 - 4, h: 3.4, lamp: 0.35, fog: false },
  ]);

  // ---------- 床の映り込み（全ホームの上面 y = 0 で 1 枚） ----------
  const refl = ctx.addReflector({ x: 0, y: Y.top, z: 0 }, undefined, 0.4);
  const looks = new Looks(LOOKS);
  b.root.add(createStationSky({ cloudColor: '#aae6ec', hillColor: '#4a9a9c', looks }));

  // ---------- 地面（野原）。当たり判定は歩ける範囲だけ（地下道の階段の穴を抜く） ----------
  const holes: [number, number, number, number][] = [
    [-ASTAIR.half - 0.15, ASTAIR.zBot, ASTAIR.half + 0.15, ASTAIR.zTop],
    [-52.6, TUN.z0 - 0.3, TUN.x0, TUN.z1 + 0.3],
  ];
  // 野原の面（1 枚の面から地下道の階段の穴を抜く。模様はワールド座標なので継ぎ目は出ない）
  {
    const pos: number[] = [];
    for (const r of rectMinusHoles([-800, -800, 800, 800], holes)) {
      const [x0, z0, x1, z1] = r;
      pos.push(x0, Y.ground, z0, x0, Y.ground, z1, x1, Y.ground, z1, x0, Y.ground, z0, x1, Y.ground, z1, x1, Y.ground, z0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    b.mesh(g, mat.field, [0, 0, 0], { merge: false, shadow: 'receive' });
  }
  for (const r of rectMinusHoles([SITE.x0, SITE.z0, SITE.x1, SITE.z1], holes)) {
    ctx.colliders.add({ x: r[0], y: Y.ground - 1, z: r[1] }, { x: r[2], y: Y.ground, z: r[3] });
  }

  // ---------- ホーム ----------
  const edgeStrips = (half: number, v0: number, v1: number): Strip[] => [
    { u0: -half, u1: -half + 0.48, v0, v1, kind: 2 },
    { u0: half - 0.48, u1: half, v0, v1, kind: 2 },
    { u0: -half + 0.68, u1: -half + 1.0, v0, v1, kind: 1 },
    { u0: half - 1.0, u1: half - 0.68, v0, v1, kind: 1 },
  ];
  /** ホームの本体（縁の下は少し引っ込める）と笠石。床の板は別に置く */
  const body = (x0: number, x1: number, z0: number, z1: number, inset: [boolean, boolean, boolean, boolean] = [true, true, true, true], wall: THREE.Material = mat.concreteW): void => {
    const i = (k: number): number => (inset[k] ? 0.12 : 0);
    b.boxMM(wall, [x0 + i(0), Y.ground, z0 + i(2)], [x1 - i(1), -0.16, z1 - i(3)]);
    b.boxMM(mat.coping, [x0, -0.16, z0], [x1, -0.005, z1]);
    ctx.colliders.add({ x: x0, y: Y.ground, z: z0 }, { x: x1, y: Y.top, z: z1 });
  };
  const floorPlane = (floor: THREE.Material, x0: number, x1: number, z0: number, z1: number): void => {
    const f = b.plane(floor, [(x0 + x1) / 2, Y.top, (z0 + z1) / 2], x1 - x0, z1 - z0, 'y', { merge: false });
    refl.hide.push(f);
  };
  // A: 地下道の階段の穴（x ±1.35、z 3〜11.2）をよけて作る
  const floorA = floorMat({ color: '#2a5c7a', frame: { cx: 0, cz: 0, alongX: false }, strips: [...edgeStrips(A.half, A.z0, A.z1), { u0: 0.05, u1: 0.08, v0: A.z0, v1: A.z1, kind: 5 }], refl, joint: 0, yShift: [-4, 17, 0.24, 0], reflTint: '#78e4f0', puddle: PUD_A, puddleVar: [0.04, 0.12], shapes: SHAPES_A, dryZone: [-4.5, 40, 0.8], dryRefl: 0.1 });
  const hx = ASTAIR.half + 0.15;
  body(-A.half, A.half, A.z0, ASTAIR.zBot, [true, true, true, false]);
  body(-A.half, -hx, ASTAIR.zBot, ASTAIR.zTop, [true, false, false, false]);
  body(hx, A.half, ASTAIR.zBot, ASTAIR.zTop, [false, true, false, false]);
  body(-A.half, A.half, ASTAIR.zTop, A.z1, [true, true, false, true]);
  floorPlane(floorA, -A.half, A.half, A.z0, ASTAIR.zBot);
  floorPlane(floorA, -A.half, -hx, ASTAIR.zBot, ASTAIR.zTop);
  floorPlane(floorA, hx, A.half, ASTAIR.zBot, ASTAIR.zTop);
  floorPlane(floorA, -A.half, A.half, ASTAIR.zTop, A.z1);
  // B・C（A とは目地の蓋でつながる）
  for (const s of [-1, 1]) {
    const cx = s * (BC.xIn + BC.xOut) / 2;
    const fl = floorMat({ color: '#3a8a8c', frame: { cx, cz: 0, alongX: false }, strips: edgeStrips((BC.xOut - BC.xIn) / 2, BC.z0, BC.z1), refl, puddle: [0.3, 0.6, 0.3, (BC.xOut - BC.xIn) / 2], dryRefl: 0.3, lookRefl: false });
    const x0 = s < 0 ? -BC.xOut : BC.xIn;
    const x1 = s < 0 ? -BC.xIn : BC.xOut;
    body(x0, x1, BC.z0, BC.z1, [true, true, true, true], mat.concrete);
    floorPlane(fl, x0, x1, BC.z0, BC.z1);
    // 目地の蓋（グレーチング）: 濃い鋼の板に細い隙間の筋
    const gx0 = s < 0 ? -BC.xIn : A.half;
    const gx1 = s < 0 ? -A.half : BC.xIn;
    b.boxMM(mat.concrete, [gx0, Y.ground, BC.z0 + 0.12], [gx1, -0.2, BC.z1 - 0.12]);
    b.boxMM(mat.black, [gx0, -0.2, BC.z0], [gx1, -0.03, BC.z1]);
    for (let z = BC.z0 + 0.05; z < BC.z1; z += 0.06) b.boxMM(mat.steel, [gx0, -0.03, z], [gx1, -0.004, z + 0.025], { shadow: false });
    ctx.colliders.add({ x: gx0, y: Y.ground, z: BC.z0 }, { x: gx1, y: Y.top, z: BC.z1 });
  }
  // D（駅舎側の単式ホーム）。床の模様は回す前の座標で（station-0 の見え方を元の版と同じに）
  {
    const dStrips: Strip[] = [
      ...edgeStrips(D.half, 0, D.z1 - D.z0),
      { u0: -D.half, u1: D.half, v0: 0, v1: 0.12, kind: 4 },
      { u0: -D.half + 0.5, u1: D.half - 0.5, v0: 6.0, v1: 6.75, kind: 3 },
      { u0: -0.32, u1: 0.32, v0: 6.75, v1: 36, kind: 1 },
    ];
    const floorD = floorMat({ color: '#2a5a7c', frame: { cx: D.x, cz: D.z1, alongX: false }, strips: dStrips, refl, puddle: [0.6, 0.22, 0.35, D.half], puddleVar: [0.04, 0.12], shapes: SHAPES_D, dryRefl: 0.2, wetRefl: 0.4, yellow: '#86a088', oldFrame: { ox: D_OLD.xEnd, oz: D_OLD.zc, su: 1, sv: -1 } });
    body(D.x - D.half, D.x + D.half, D.z0, D.z1);
    floorPlane(floorD, D.x - D.half, D.x + D.half, D.z0, D.z1);
  }

  // ---------- 線路・架線・信号・遠景 ----------
  buildTracks(b, ctx, mat);

  // ---------- 上屋（元の版と同じ） ----------
  const cb = buildCanopies(b, ctx, mat, tubes, addTube);
  const dB = buildD(ctx, b.root, mat, tubes);

  // ---------- ベンチ（A・B・C） ----------
  for (const s of [-1, 1]) {
    const x = s < 0 ? -1.0 : 1.15;
    seatRow(b, mat.bench, mat.steel, [x, 0, -8.4], s < 0 ? -Math.PI / 2 : Math.PI / 2, 9, 0.58);
    ctx.colliders.add({ x: x - 0.3, y: 0, z: -11.7 }, { x: x + 0.3, y: 0.9, z: -5.7 });
  }
  seatRow(b, mat.bench, mat.steel, [0.15, 0, -17.3], Math.PI, 3, 0.6);
  b.box(mat.board, [0.36, 1.05, -18.4], [0.95, 1.0, 0.08]);
  for (const x of [-0.42, 0.42]) b.box(mat.steel, [0.36 + x, 0.3, -18.4], [0.05, 0.6, 0.05]);
  ctx.colliders.add({ x: -1, y: 0, z: -18.6 }, { x: 1, y: 1.6, z: -17 });
  seatRow(b, mat.benchT, mat.steel, [-1.95, 0, 22.6], -Math.PI / 2, 12, 0.57);
  ctx.colliders.add({ x: -2.3, y: 0, z: 19.2 }, { x: -1.6, y: 0.9, z: 26 });
  seatRow(b, mat.benchT, mat.steel, [1.0, 0, 34.5], Math.PI / 2, 10, 0.57);
  ctx.colliders.add({ x: 0.7, y: 0, z: 31.6 }, { x: 1.3, y: 0.9, z: 37.4 });
  seatRow(b, mat.benchT, mat.steel, [-1.2, 0, 36.2], -Math.PI / 2, 4, 0.57);
  ctx.colliders.add({ x: -1.5, y: 0, z: 35 }, { x: -0.9, y: 0.9, z: 37.4 });
  for (const s of [-1, 1]) {
    seatRow(b, mat.benchT, mat.steel, [s * 5.6, 0, 48.3], 0, 5, 0.57);
    ctx.colliders.addCentered(s * 5.6, 0.45, 48.3, 2.9, 0.9, 0.6);
    slatBench(b, mat.benchB, mat.benchB, [s * 5.75, 0, 53.9], s < 0 ? 0.6435 : -0.6435, 1.7);
    ctx.colliders.addCentered(s * 5.75, 0.45, 53.9, 1.3, 0.9, 1.3);
  }

  // ---------- 草の株（線路のまわり・ホームの割れ目・野原） ----------
  {
    const grass = mat.grass;
    const grassDark = mat.grassDark;
    const ms: THREE.Matrix4[] = [];
    const msDark: THREE.Matrix4[] = [];
    const add = (x: number, y: number, z: number, h: number, to = ms): void => {
      to.push(trs(x, y, z, rand() * Math.PI * 2, h * (0.8 + rand() * 0.5), h, h * (0.8 + rand() * 0.5)));
    };
    for (let i = 0; i < 150; i++) add(-15.5 + rand() * 5.2, Y.ground, 44 + rand() * 16, 0.2 + rand() * 0.3, msDark);
    for (let i = 0; i < 50; i++) add(-10.7 - rand() * 0.5, Y.ground, 45.5 + rand() * 12.4, 0.22 + rand() * 0.25, msDark);
    for (let i = 0; i < 70; i++) {
      const z = 18 + rand() * 30;
      add((rand() - 0.5) * 3.2, Y.top, z, 0.06 + rand() * 0.08);
    }
    for (let i = 0; i < 220; i++) {
      const sx = rand() < 0.5 ? -1 : 1;
      add(sx * (6.6 + rand() * 9), Y.ground, -60 + rand() * 140, 0.12 + rand() * 0.2);
    }
    const tg = tuftGeometry(7, 3);
    instanced(b.root, tg, grass, ms);
    instanced(b.root, tg, grassDark, msDark);
  }

  // ---------- 駅舎・地下道・構外 ----------
  const cullTunnel = buildBuilding(ctx, b.root, mat, tubes);
  buildSite(ctx, b.root, mat, rand, tubes);
  // 参考画像の視点の外の作り込み（ホームの壁・線路の脇・野原・遠景。決まりで置く）
  const cullDress = buildDressing(ctx, b.root, mat);

  // 下面の細部（すべて映り込みに出す）
  cb.canDark.build(b.root, mat.underDark);
  cb.canLite.build(b.root, mat.underLite);
  cb.shedDark.build(b.root, mat.underDark);
  cb.shedLite.build(b.root, mat.underLite);
  dB.dark.build(b.root, mat.underDark);
  dB.lite.build(b.root, mat.underLite);
  cb.bcDark.build(b.root, mat.bcUnderDark);
  cb.bcLite.build(b.root, mat.bcUnderLite);

  b.root.add(createTubeGlow(tubes, { radius: 0.22, color: '#ffffff', strength: 0.2 }));
  consolidate(b.root);
  b.finalize();
  return {
    root: b.root,
    spawn: { pos: [-44, Y.road, 40], yaw: 0.2 },
    // 室内の光だまり: カメラに近い灯りを選ぶ
    beforeRender(camera) {
      const p = camera.position;
      updatePools(p.x, p.y, p.z);
      cullDress(p);
      cullTunnel(camera);
    },
  };
}
