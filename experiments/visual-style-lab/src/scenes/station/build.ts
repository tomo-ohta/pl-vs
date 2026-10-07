import * as THREE from 'three';
import { Builder, rng, type V3 } from '../Builder.ts';
import type { BuiltScene, SceneContext } from '../types.ts';
import { fieldMat } from './field.ts';
import { floorMat, type PuddleShape, type Strip } from './floor.ts';
import { BoxBatch, underside } from './canopy.ts';
import { seatRow, slatBench, twinSeat } from './furniture.ts';
import { haunch, hColumn, instanced, pipe, strut, trs, tuftGeometry } from './kit.ts';
import { A, BC, D, POLES, SHED, TCAN, TRACK, Y } from './layout.ts';
import { setRoofs, stationMat, type StationMatOptions } from './mat.ts';
import { createStationSky } from './sky.ts';
import { createTubeGlow, type Tube } from './glow.ts';
import { Looks } from './looks.ts';
import { LOOKS } from './looks-data.ts';

/** A の水たまり: ノイズ（大きさ・しきい値・縁で上がる量・半幅） */
const PUD_A: [number, number, number, number] = [0.6, 0.26, 0.35, A.half];
/**
 * 手で置いた水たまり（参考画像を見ながら、大きな塊がある所に置いた絵の具の塊。縁はノイズでちぎる）。
 * A の大屋根の北（station-1 の手前）・中央柱の上屋の南（station-3 の手前）、D の先端（station-0）。
 */
const SHAPES_A: PuddleShape[] = [
  // station-1: 中央の筋に沿った大きな水たまりと、手前の横に長い水たまり
  { x: 0.1, z: -6.8, rx: 0.85, rz: 1.9 },
  { x: -0.6, z: -4.25, rx: 0.65, rz: 0.32 },
  { x: 1.35, z: -4.15, rx: 0.8, rz: 0.55 },
  { x: 0.5, z: -3.3, rx: 0.4, rz: 0.17 },
  { x: 1.7, z: -5.2, rx: 0.55, rz: 0.4 },
  { x: 2.0, z: -7.8, rx: 0.3, rz: 0.4 },
  { x: 0.0, z: -10.0, rx: 1.0, rz: 0.4 },
  { x: 0.0, z: -10.8, rx: 0.9, rz: 1.1 },
  // station-3: 左（+x）の点字ブロック沿いの細長い水たまり、右の水たまり、奥の中央の筋
  { x: 1.7, z: 22.8, rx: 0.55, rz: 4.8 },
  { x: 1.0, z: 19.4, rx: 0.32, rz: 1.0 },
  { x: 1.0, z: 25.8, rx: 0.3, rz: 1.4 },
  { x: -1.75, z: 25.2, rx: 0.45, rz: 2.2 },
];
const SHAPES_A2: PuddleShape[] = [
  { x: 0.0, z: 30.0, rx: 0.32, rz: 1.8 },
  { x: -1.0, z: 28.8, rx: 0.3, rz: 0.9 },
];
const SHAPES_D: PuddleShape[] = [
  { x: -61.2, z: -2.2, rx: 1.1, rz: 1.35 },
  { x: -56.4, z: 2.9, rx: 0.45, rz: 0.55 },
  { x: -56.45, z: -0.95, rx: 0.5, rz: 0.5 },
  { x: -61.3, z: 3.1, rx: 0.65, rz: 1.0 },
];

/** 柱の高さによる明るさ（屋根の下で暗く、床の近くで暗い） */
const PILLAR_GRAD = /* glsl */ `
  albedo *= mix(0.3, 1.0, smoothstep(0.3, 2.2, p.y)) * mix(1.0, 0.4, smoothstep(2.2, 3.3, p.y));
`;

export function buildStation(ctx: SceneContext): BuiltScene {
  const b = new Builder(ctx);
  const M = (o: StationMatOptions): THREE.ShaderMaterial => stationMat(o);
  const rand = rng(7);

  // ---------- 材質 ----------
  const mat = {
    concrete: M({ color: '#1a2e40', mottle: [0.12, 1.3] }),
    coping: M({ color: '#2e4e54' }),
    roof: M({ color: '#3a6878' }),
    beam: M({ color: '#3e6c7c' }),
    steel: M({ color: '#3d6e7c' }),
    pedestal: M({ color: '#3f6a74', mottle: [0.1, 2] }),
    bench: M({ color: '#1a6878', emissive: '#04222c', emissiveIntensity: 1, side: THREE.DoubleSide, sheen: 0.3 }),
    frameD: M({ color: '#2a6670', emissive: '#0a3c44', emissiveIntensity: 1 }),
    benchB: M({ color: '#123238', sheen: 0.2 }),
    benchT: M({ color: '#1e4450', side: THREE.DoubleSide, sheen: 0.6 }),
    benchD: M({ color: '#2a6670', emissive: '#0a3c44', emissiveIntensity: 1, side: THREE.DoubleSide, sheen: 0.3 }),
    housing: M({ color: '#3a5a5e' }),
    tube: M({ color: '#000000', unlit: true, fragAlbedo: '  emis = uStTubeCol * (0.65 + 0.45 * abs(dot(n, normalize(cameraPosition - p))));' }),
    sign: M({ color: '#1d3a40' }),
    rail: M({ color: '#24383c' }),
    railTop: M({ color: '#a8c8c6', gain: 1.0 }),
    clip: M({ color: '#3a5c60', gain: 1.0 }),
    sleeper: M({ color: '#25393a', mottle: [0.15, 3] }),
    ballast: M({ color: '#0e1a20', mottle: [0.35, 6] }),
    // A の両側の線路（大屋根の下でも明るい灰色の砂利）
    ballastA: M({ color: '#4a8088', mottle: [0.35, 6], fragAlbedo: '  albedo *= mix(1.0, 0.4, smoothstep(4.0, 14.0, p.z));' }),
    field: fieldMat({
      color: '#8ab6ae',
      dark: '#4c766a',
      light: '#b4d8b8',
      // 西の野原の小川（station-0 の参考画像から床へ投げ返した位置）
      stream: [[-480, 200], [-383, 131], [-306, 66], [-258, 29], [-212, 5], [-187, -3], [-152, -6], [-119, -9.5], [-99, -11.4], [-86, -12], [-70, -12.6]],
      keep: 2.0,
    }),
    far: M({ color: '#3d5e5c' }),
    // 地平線の影（霧を薄く掛ける）
    farHaze: M({ color: '#2a5a5c', fogMul: 0.26 }),
    booth: M({ color: '#1e4a50' }),
    glass: M({ color: '#5a9890', gain: 1.0 }),
    wire: M({ color: '#2a4a50' }),
    // D の柱: 逆光の暗い柱。高さで明るさが変わる（屋根の下と床の近くが暗い）
    steelD: M({ color: '#6a9aa0', gain: 5.5, fragAlbedo: PILLAR_GRAD }),
    pedestalD: M({ color: '#3a6a7a', gain: 5.0, fragAlbedo: PILLAR_GRAD }),
    roofB: M({ color: '#3a96a0' }),
    columnB: M({ color: '#1a4a54', fragAlbedo: '  albedo *= mix(0.6, 1.0, smoothstep(0.5, 2.0, p.y)) * mix(1.0, 0.7, smoothstep(2.4, 3.4, p.y));' }),
    columnBase: M({ color: '#164a50' }),
    columnEdge: M({ color: '#3a7a80' }),
    bcFunnel: M({ color: '#24646c' }),
    shelterDark: M({ color: '#2a5a60' }),
    lampBox: M({ color: '#000000', unlit: true, emissive: '#f4f0c0', emissiveIntensity: 1.3 }),
    beamB: M({ color: '#2a6466' }),
    roofT: M({ color: '#2c4c70' }),
    columnT: M({ color: '#3a7488', emissive: '#16505e', emissiveIntensity: 1, sheen: 0.3 }),
    endT: M({ color: '#1a3848', fogMul: 0.55 }),
    shedCol: M({ color: '#24505a' }),
    shedColL: M({ color: '#3a7480', emissive: '#103a42', emissiveIntensity: 1 }),
    lattice: M({ color: '#4a8088', emissive: '#14424a', emissiveIntensity: 1 }),
    underDark: M({ color: '#1c3646' }),
    bcUnderDark: M({ color: '#2a7078' }),
    ticket: M({ color: '#1c4a4e' }),
    ticketScreen: M({ color: '#000000', unlit: true, emissive: '#9ad0c8', emissiveIntensity: 0.8 }),
    doorFrame: M({ color: '#4a8a84' }),
    doorLeaf: M({ color: '#1a4c50' }),
    fasciaN: M({ color: '#8ab4a0', emissive: '#2a4a40', emissiveIntensity: 1 }),
    bcValance: M({ color: '#2a6a72' }),
    bcUnderLite: M({ color: '#4a9aa0' }),
    underLite: M({ color: '#3a6a7a' }),
    hookT: M({ color: '#5aa0a8', emissive: '#0a2a30', emissiveIntensity: 1 }),
    beamT: M({ color: '#2a4a68' }),
    steelT: M({ color: '#2a4c58' }),
    housingT: M({ color: '#3a5a5e' }),
    tubeT: M({ color: '#000000', unlit: true, fragAlbedo: '  emis = uStTubeCol;' }),
    board: M({ color: '#b6d6d0' }),
    frontS: M({ color: '#2a5a64', emissive: '#16383e', emissiveIntensity: 1 }),
    frontD: M({ color: '#2a6a74', emissive: '#28626a', emissiveIntensity: 1 }),
    signLight: M({ color: '#94b4aa', unlit: true }),
    signal: M({ color: '#c06050', unlit: true }),
  };

  // 上屋の下面の細部（InstancedMesh。上屋ごとに映り込みの層を分ける）
  const canDark = new BoxBatch();
  const canLite = new BoxBatch();
  const shedDark = new BoxBatch();
  const shedLite = new BoxBatch();
  const bcDark = new BoxBatch();
  const bcLite = new BoxBatch();

  // 蛍光灯（光る板と、まわりのにじみ）
  const tubes: Tube[] = [];
  const addTube = (c: V3, len: number, along: 'x' | 'z', w: number, h = 0.04, round = false): void => {
    if (round) {
      // 丸い乳白の管（両端が丸い）
      const g = new THREE.CapsuleGeometry(w / 2, Math.max(len - w, 0.01), 4, 10);
      if (along === 'x') g.rotateZ(Math.PI / 2);
      else g.rotateX(Math.PI / 2);
      b.mesh(g, mat.tube, c, { shadow: false });
    } else b.box(mat.tube, c, along === 'x' ? [len, h, w] : [w, h, len], { shadow: false });
    tubes.push({ c, axis: along === 'x' ? [1, 0, 0] : [0, 0, 1], len });
  };

  // ---------- 屋根（明るさの計算用の長方形） ----------
  setRoofs([
    { x0: -SHED.half, z0: SHED.z0 - 0.2, x1: SHED.half, z1: SHED.z1, h: SHED.soffit, lamp: 0.05 },
    { x0: -TCAN.half, z0: TCAN.z0, x1: TCAN.half, z1: TCAN.z1, h: (TCAN.center + TCAN.edge) / 2, lamp: 0.02 },
    { x0: -10.1, z0: 46.5, x1: -2.0, z1: 56.05, h: 3.56, lamp: 1.5 },
    { x0: 2.0, z0: 46.5, x1: 10.1, z1: 56.05, h: 3.56, lamp: 1.5 },
    { x0: D.xEnd + 0.5, z0: D.zc - D.half + 0.2, x1: -30, z1: D.zc + D.half - 0.2, h: D.soffit, lamp: 0.015 },
  ]);

  // ---------- 床の映り込み（全ホームの上面 y = 0 で 1 枚） ----------
  const refl = ctx.addReflector({ x: 0, y: Y.top, z: 0 }, undefined, 0.5);

  b.root.add(createStationSky({ cloudColor: '#aae6ec', hillColor: '#4a9a9c', looks: new Looks(LOOKS) }));

  // ---------- 地面（野原）と道床 ----------
  b.plane(mat.field, [0, Y.ground, 0], 1600, 1600, 'y', { merge: false });
  ctx.colliders.add({ x: -800, y: Y.ground - 1, z: -800 }, { x: 800, y: Y.ground, z: 800 });

  // ---------- ホーム ----------
  const platform = (x0: number, x1: number, z0: number, z1: number, floor: THREE.Material): void => {
    // 本体（縁の下は少し引っ込める）
    b.boxMM(mat.concrete, [x0 + 0.12, Y.ground, z0 + 0.12], [x1 - 0.12, -0.16, z1 - 0.12]);
    b.boxMM(mat.coping, [x0, -0.16, z0], [x1, -0.005, z1]);
    const f = b.plane(floor, [(x0 + x1) / 2, Y.top, (z0 + z1) / 2], x1 - x0, z1 - z0, 'y', { merge: false });
    refl.hide.push(f);
    ctx.colliders.add({ x: x0, y: Y.ground, z: z0 }, { x: x1, y: Y.top, z: z1 });
  };
  const edgeStrips = (half: number, v0: number, v1: number): Strip[] => [
    { u0: -half, u1: -half + 0.48, v0, v1, kind: 2 },
    { u0: half - 0.48, u1: half, v0, v1, kind: 2 },
    { u0: -half + 0.68, u1: -half + 1.0, v0, v1, kind: 1 },
    { u0: half - 1.0, u1: half - 0.68, v0, v1, kind: 1 },
  ];
  const floorA = floorMat({ color: '#2a5c7a', frame: { cx: 0, cz: 0, alongX: false }, strips: [...edgeStrips(A.half, A.z0, A.z1), { u0: 0.05, u1: 0.08, v0: A.z0, v1: A.z1, kind: 5 }], refl, joint: 0, yShift: [-4, 17, 0.24, 0], reflTint: '#78e4f0', puddle: PUD_A, puddleVar: [0.04, 0.12], shapes: [...SHAPES_A, ...SHAPES_A2], dryZone: [-4.5, 40, 0.8], dryRefl: 0.1 });
  platform(-A.half, A.half, A.z0, A.z1, floorA);
  const floorB = floorMat({ color: '#3a8a8c', frame: { cx: -(BC.xIn + BC.xOut) / 2, cz: 0, alongX: false }, strips: edgeStrips((BC.xOut - BC.xIn) / 2, BC.z0, BC.z1), refl, puddle: [0.3, 0.6, 0.3, (BC.xOut - BC.xIn) / 2], dryRefl: 0.3, lookRefl: false });
  platform(-BC.xOut, -BC.xIn, BC.z0, BC.z1, floorB);
  const floorC = floorMat({ color: '#3a8a8c', frame: { cx: (BC.xIn + BC.xOut) / 2, cz: 0, alongX: false }, strips: edgeStrips((BC.xOut - BC.xIn) / 2, BC.z0, BC.z1), refl, puddle: [0.3, 0.6, 0.3, (BC.xOut - BC.xIn) / 2], dryRefl: 0.3, lookRefl: false });
  platform(BC.xIn, BC.xOut, BC.z0, BC.z1, floorC);
  const dStrips: Strip[] = [
    ...edgeStrips(D.half, D.xEnd, D.x1).map((s) => ({ ...s, v0: D.xEnd - D.xEnd, v1: D.x1 - D.xEnd })),
    // 先端の白線
    { u0: -D.half, u1: D.half, v0: 0, v1: 0.12, kind: 4 },
    // 横切る点字ブロックと中央の誘導
    { u0: -D.half + 0.5, u1: D.half - 0.5, v0: 6.0, v1: 6.75, kind: 3 },
    { u0: -0.32, u1: 0.32, v0: 6.75, v1: 30, kind: 1 },
  ];
  const floorD = floorMat({ color: '#2a5a7c', frame: { cx: D.xEnd, cz: D.zc, alongX: true }, strips: dStrips, refl, puddle: [0.6, 0.22, 0.35, D.half], puddleVar: [0.04, 0.12], shapes: SHAPES_D, dryRefl: 0.2, wetRefl: 0.4, yellow: '#86a088' });
  platform(D.xEnd, D.x1, D.zc - D.half, D.zc + D.half, floorD);

  // 0 番線の外の土手（station-2 の視点）。野原から少し高い砂利の道
  b.boxMM(mat.ballast, [-28, Y.ground, 30], [-21, -0.55, 80], { collide: true });
  // 土手へ上がる段（東の側）
  b.boxMM(mat.ballast, [-21, Y.ground, 48], [-20.6, -0.85, 55], { collide: true });

  // B の線路側の側面の小さな案内板（station-2）
  b.box(M({ color: '#3aa8b0', gain: 1.2 }), [-BC.xOut - 0.13, -0.42, 50.02], [0.03, 0.32, 0.43]);

  // ホームの端の階段（地面へ降りる）
  const steps = (x: number, z: number, dirX: number, dirZ: number, width: number): void => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const h = Y.top - ((i + 1) * (Y.top - Y.ground)) / (n + 1);
      const d0 = i * 0.3;
      const cx = x + dirX * (d0 + 0.15);
      const cz = z + dirZ * (d0 + 0.15);
      const sx = dirX !== 0 ? 0.3 : width;
      const sz = dirZ !== 0 ? 0.3 : width;
      b.boxMM(mat.concrete, [cx - sx / 2, Y.ground, cz - sz / 2], [cx + sx / 2, h, cz + sz / 2], { collide: true });
    }
  };
  steps(0, A.z1, 0, 1, 2.4);
  steps(0, A.z0, 0, -1, 2.4);
  steps(-(BC.xIn + BC.xOut) / 2, BC.z1, 0, 1, 2.0);
  steps((BC.xIn + BC.xOut) / 2, BC.z1, 0, 1, 2.0);
  steps(D.x1, D.zc, 1, 0, 2.4);

  // ---------- 線路 ----------
  const sleeperGeo = new THREE.BoxGeometry(2.0, 0.14, 0.22);
  const sleeperM: THREE.Matrix4[] = [];
  const clipM: THREE.Matrix4[] = [];
  const track = (x: number, z0: number, z1: number, ballast: THREE.Material = mat.ballast): void => {
    // 道床
    b.boxMM(ballast, [x - 2.1, Y.ground - 0.1, z0], [x + 2.1, Y.ballast - 0.02, z1], { shadow: false });
    for (const s of [-1, 1]) {
      const rx = x + (s * TRACK.gauge) / 2;
      b.boxMM(mat.rail, [rx - 0.035, Y.ballast, z0], [rx + 0.035, Y.rail - 0.012, z1], { shadow: false });
      b.boxMM(mat.railTop, [rx - 0.033, Y.rail - 0.012, z0], [rx + 0.033, Y.rail, z1], { shadow: false });
      for (let z = z0 + 0.3; z < z1; z += 0.6) for (const d of [-0.09, 0.09]) clipM.push(trs(rx + d, Y.ballast + 0.02, z, 0, 1, 1, 1));
    }
    for (let z = z0 + 0.3; z < z1; z += 0.6) sleeperM.push(trs(x, Y.ballast - 0.07, z));
  };
  track(TRACK.t1, -330, BC.z0 - 2, mat.ballastA);
  track(TRACK.t2, -330, BC.z0 - 2, mat.ballastA);
  track(TRACK.t0, BC.z0, 330);
  track(TRACK.t3, BC.z0, 330);
  instanced(b.root, sleeperGeo, mat.sleeper, sleeperM);
  // 締結の金具（小さな明るい点）
  instanced(b.root, new THREE.BoxGeometry(0.09, 0.05, 0.12), mat.clip, clipM);
  // 車止め
  for (const x of [TRACK.t1, TRACK.t2]) {
    b.boxMM(mat.steel, [x - 0.9, Y.ballast, BC.z0 - 2.3], [x + 0.9, Y.ballast + 0.9, BC.z0 - 2.0], { collide: true });
  }

  // ---------- 大屋根（station-1・A の中ほど） ----------
  {
    const z0 = SHED.z0;
    const z1 = SHED.z1;
    const H = SHED.soffit;
    b.boxMM(mat.roof, [-SHED.half, H + 0.3, z0 - 0.2], [SHED.half, H + 0.5, z1]);
    // 前の鼻先（梁）
    b.boxMM(mat.frontS, [-SHED.half, H - 0.02, z0 - 0.2], [SHED.half, H + 0.5, z0 + 0.1]);
    // 横の梁（3 m おき）と細い母屋（1 m おき）
    for (let z = z0 + 3; z < z1; z += 3) b.boxMM(mat.beam, [-SHED.colX, H, z - 0.12], [SHED.colX, H + 0.3, z + 0.12]);
    for (let z = z0 + 1; z < z1; z += 1) b.boxMM(mat.beam, [-SHED.colX, H + 0.2, z - 0.04], [SHED.colX, H + 0.3, z + 0.04]);
    // 縦の母屋
    for (const x of [-7.5, -4.6, -1.6, 1.6, 4.6, 7.5]) b.boxMM(mat.beam, [x - 0.08, H + 0.15, z0], [x + 0.08, H + 0.3, z1]);
    // 門形の骨組み（柱は線路の外の地面に立つ。参考画像に合わせて右は少し外）
    for (const z of [z0, (z0 + z1) / 2, z1]) {
      for (const s of [-1, 1]) {
        const x = s < 0 ? -SHED.colX : SHED.colX + 0.45;
        hColumn(b, s < 0 ? mat.shedColL : mat.shedCol, x, z, Y.ground + 0.45, H + 0.3, s < 0 ? 0.34 : 0.26, 0.3);
        b.box(mat.pedestal, [x, Y.ground + 0.22, z], [0.9, 0.45, 0.9], { collide: true });
        ctx.colliders.addCentered(x, 1.5, z, 0.4, 5, 0.4);
        // 左（西）は柱から梁へ曲がって伸びる方杖（アーチ形）、右（東）はまっすぐな方杖。梁は柱の外まで延びる
        if (s < 0) {
          strut(b, mat.shedCol, [x + 0.1, 3.4, z], [x + 2.2, H - 0.05, z], 0.3, 0.38);
          haunch(b, mat.shedCol, x - s * 0.17, -s, z, 3.2, 0.5, 0.45, 3.9, 0.3);
        } else strut(b, mat.shedCol, [x - 0.1, 3.45, z], [x - 1.4, H - 0.05, z], 0.16, 0.2);
        b.boxMM(mat.beam, [Math.min(x + s * 0.6, s * 6.5), H - 0.1, z - 0.15], [Math.max(x + s * 0.6, s * 6.5), H + 0.5, z + 0.15]);
      }
    }
    // 蛍光灯（2 列）
    for (const x of [-3.5, 3.75]) {
      for (let z = z0 + 0.2; z < z1 - 1; z += 2.65) {
        b.box(mat.housing, [x, H - 0.02, z], [0.34, 0.1, 1.45], { shadow: false });
        addTube([x, H - 0.1, z], 1.25, 'z', 0.2, 0.04, true);
        // 器具の端の明るい箱
        b.box(mat.board, [x, H - 0.06, z + 0.68], [0.36, 0.12, 0.12], { shadow: false });
      }
    }
    // 下面の細部: 波板の筋・ケーブルラック・配管・吊り下げの箱（空調・配電）・吊り金具
    underside({
      x0: -SHED.colX, x1: SHED.colX, z0: z0 + 0.2, z1, y: H + 0.3, along: 'z',
      rib: [0.25, 0.06],
      trays: [[0.7, 0.25, 0.35], [-5.9, 0.2, 0.3]],
      pipes: [[-2.6, 0.18, 0.06], [2.45, 0.22, 0.05], [6.1, 0.15, 0.08]],
      boxes: { n: 14, size: [0.25, 0.6], drop: [0.05, 0.3], lanes: [-2.4, 0.4, 2.0, 5.5, -6.5] },
      hangers: 0.9,
      seed: 11,
    }, shedDark, shedLite);
    shedDark.box([1.9, H - 0.05, -7.0], [1.0, 0.45, 0.9]);
    shedDark.box([1.0, H - 0.0, -6.6], [1.6, 0.2, 0.25]);
    // 吊り下げの案内（前の鼻先）と、鼻先の下の丸い器具
    for (const x of [-3.45, 3.9]) {
      b.box(mat.frontS, [x, 4.2, z0 + 0.25], [1.07, 0.28, 0.08], { shadow: false });
      for (const dx of [-0.4, 0.4]) b.box(mat.steel, [x + dx, 4.4, z0 + 0.25], [0.02, 0.12, 0.02]);
    }
    for (const x of [-1.9, -1.2, -0.3, 0.5, 1.1, 2.4]) b.cyl(mat.beam, [x, H - 0.12, z0 + 0.0], 0.13, 0.2, { segments: 10 });
    // 左の柱の脇の格子の柱と信号の箱、右の柱の信号
    {
      const x = -9.2;
      const z = z0 + 0.8;
      for (const dx of [-0.07, 0.07]) b.box(mat.lattice, [x + dx, 1.25, z], [0.04, 4.8, 0.04]);
      for (let y = Y.ground; y < 3.6; y += 0.32) strut(b, mat.lattice, [x - 0.07, y, z], [x + 0.07, y + 0.32, z], 0.02, 0.02);
      b.box(mat.sign, [-9.95, 1.0, z0 + 0.15], [0.45, 0.55, 0.3]);
      b.box(mat.signal, [-10.35, 0.15, z0 + 0.25], [0.12, 0.3, 0.05]);
      b.box(mat.sign, [10.5, 1.0, z0 + 0.2], [0.25, 0.3, 0.25]);
      b.box(mat.sign, [10.55, 2.35, z0 + 0.2], [0.25, 0.3, 0.25]);
    }
  }

  // ---------- 中央柱の上屋（station-3） ----------
  // 屋根・梁・器具・柱は床に映る（真上の暗い屋根が足元の床を暗くし、端の水たまりは外の空を映す）
  {
    const z0 = TCAN.z0;
    const z1 = TCAN.z1;
    const L1 = {} as const;
    // 中央の梁と、外へ上がる V 字の屋根
    b.boxMM(mat.beamT, [-0.35, TCAN.center - 0.35, z0], [0.35, TCAN.center + 0.05, z1], L1);
    for (const s of [-1, 1]) {
      strut(b, mat.roofT, [0, TCAN.center + 0.05, (z0 + z1) / 2], [s * TCAN.half, TCAN.edge + 0.04, (z0 + z1) / 2], z1 - z0, 0.14, L1);
      // 鼻先（樋）
      b.boxMM(mat.beamT, [s > 0 ? TCAN.half - 0.1 : -TCAN.half, TCAN.edge - 0.18, z0], [s > 0 ? TCAN.half : -TCAN.half + 0.1, TCAN.edge + 0.14, z1], L1);
      // 鼻先から下がる L 字の管（鼻先の下から下がり、内へ曲がる）
      for (let z = z0 + 6.4; z < z1 - 0.5; z += 4.15) {
        const x = s * (TCAN.half - 0.12);
        const H = TCAN.edge - 0.15;
        pipe(b, mat.hookT, [
          [x, H, z],
          [x + s * 0.02, H - 0.3, z],
          [x - s * 0.12, H - 0.42, z],
          [x - s * 0.6, H - 0.43, z],
          [x - s * 1.0, H - 0.43, z],
        ], 0.03, L1);
        b.box(mat.hookT, [x - s * 1.0, H - 0.52, z], [0.05, 0.18, 0.05], L1);
      }
      // 屋根の下の横の小梁と、長手の梁 2 本
      for (let z = z0 + 2; z < z1; z += 4.0) strut(b, mat.beamT, [0, TCAN.center - 0.1, z], [s * (TCAN.half - 0.1), TCAN.edge - 0.12, z], 0.12, 0.22, L1);
      for (const f of [0.3, 0.55]) {
        const x = s * TCAN.half * f;
        const yy = TCAN.center + (TCAN.edge - TCAN.center) * f - 0.12;
        b.boxMM(mat.beamT, [x - 0.07, yy - 0.2, z0], [x + 0.07, yy + 0.1, z1], L1);
      }
    }
    // 屋根の下面の細部（斜めの面に沿って、ケーブルと配管・吊り金具）
    for (const s of [-1, 1]) {
      for (const [f, t] of [[0.18, 0.05], [0.5, 0.035], [0.86, 0.04]] as const) {
        const x = s * TCAN.half * f;
        const yy = TCAN.center + (TCAN.edge - TCAN.center) * f - 0.22;
        canDark.box([x, yy, (z0 + z1) / 2], [t, t, z1 - z0 - 0.4]);
      }
      for (let z = z0 + 0.9; z < z1; z += 1.3) {
        const f = 0.2 + ((z * 7.31) % 1) * 0.6;
        const x = s * TCAN.half * f;
        const yy = TCAN.center + (TCAN.edge - TCAN.center) * f - 0.1;
        canDark.box([x, yy - 0.12, z], [0.02, 0.24, 0.02]);
        canLite.box([x, yy - 0.26, z], [0.07, 0.05, 0.05]);
      }
    }
    // 柱（細く暗い）。奥の柱だけ方杖
    for (const z of [20.5, 28.5, 36.4]) {
      hColumn(b, mat.columnT, 0, z, Y.top, TCAN.center - 0.35, 0.15, 0.15);
      ctx.colliders.addCentered(0, 1.5, z, 0.25, 3, 0.25);
    }
    for (const s of [-1, 1]) strut(b, mat.beamT, [0, 2.3, 36.4], [s * 1.3, 2.85, 36.4], 0.1, 0.1, L1);
    // 吊り下げの箱（配電盤）2 つと、その配線
    b.boxMM(mat.beamT, [-0.95, 2.85, 19.0], [-0.1, 3.42, 20.2], L1);
    b.boxMM(mat.beamT, [-1.8, 2.3, 23.6], [-0.25, 3.35, 25.0], L1);
    for (const x of [-1.6, -0.5]) b.box(mat.beamT, [x, 3.45, 24.3], [0.04, 0.3, 0.04], L1);
    // 端の鼻先
    for (const s of [-1, 1]) strut(b, mat.beamT, [0, TCAN.center - 0.1, z1 - 0.05], [s * TCAN.half, TCAN.edge, z1 - 0.05], 0.1, 0.3, L1);
    // 端の深い垂れ壁と、その下の機器の箱・梁（station-3 で中央の奥が暗く見える所）
    b.boxMM(mat.endT, [-3.8, 2.65, z1 - 0.3], [3.0, TCAN.center, z1 - 0.1], L1);
    b.boxMM(mat.endT, [-3.0, 2.4, z1 - 1.6], [-1.1, 2.65, z1 - 0.3], L1);
    b.boxMM(mat.endT, [0.6, 2.75, z1 - 2.6], [2.4, 2.95, z1 - 0.3], L1);
    // 蛍光灯（2 本ずつの器具）
    for (const x of [-2.95, 2.95]) {
      for (let z = 21.4; z < z1 - 0.8; z += 4.15) {
        b.box(mat.housingT, [x, 3.66, z], [0.34, 0.06, 1.7], { shadow: false });
        for (const dx of [-0.08, 0.08]) {
          b.box(mat.tubeT, [x + dx, 3.6, z], [0.05, 0.04, 1.55], { shadow: false });
        }
        tubes.push({ c: [x, 3.6, z], axis: [0, 0, 1], len: 1.55 });
      }
    }
  }

  // ---------- 映り込みだけに出る上屋の続き（layer 2） ----------
  // station-3 の床の水には、奥まで続く暗い屋根が映る（参考の絵）。本当の上屋は z = 37 で終わるので、
  // その先は映り込みだけに出す。B・C の上屋と重ならないよう、z = 46 より先は中央の細い帯だけ。
  // 上屋の端より先へ歩くと消える（見上げても無い屋根が足元に映らないように）
  {
    const ghost = M({
      color: '#183444', unlit: true, fogMul: 0.7, transparent: true, depthWrite: true,
      fragAlbedo: '  alpha *= smoothstep(36.0, 28.0, cameraPosition.z);',
    });
    const P = { layer: 2, shadow: false } as const;
    const zA = TCAN.z1;
    const zB = 46;
    const zC = 150;
    for (const s of [-1, 1]) {
      strut(b, ghost, [0, TCAN.center + 0.05, (zA + zB) / 2], [s * TCAN.half, TCAN.edge + 0.04, (zA + zB) / 2], zB - zA, 0.14, P);
      b.boxMM(ghost, [s > 0 ? TCAN.half - 0.1 : -TCAN.half, TCAN.edge - 0.18, zA], [s > 0 ? TCAN.half : -TCAN.half + 0.1, TCAN.edge + 0.14, zB], P);
      const f = 1.9 / TCAN.half;
      strut(b, ghost, [0, TCAN.center + 0.05, (zB + zC) / 2], [s * 1.9, TCAN.center + (TCAN.edge - TCAN.center) * f + 0.04, (zB + zC) / 2], zC - zB, 0.14, P);
    }
    b.boxMM(ghost, [-0.35, TCAN.center - 0.35, zA], [0.35, TCAN.center + 0.05, zC], P);
  }

  // ---------- B・C の小さな上屋（station-2・station-3） ----------
  // 中央の柱 1 本で支える平らな屋根（下面 3.56・鼻先の上 3.68。station-2 の視点から測った）。鼻先は薄く暗い帯。
  // 屋根は線路の上へ張り出す（A の側へ 1.9 m）。待合の小屋は北側、南側に券売機と案内の柱
  for (const s of [-1, 1]) {
    const cx = s * 6.55;
    const cz = 51.4;
    const RU = 3.56;
    const RT = 3.68;
    const rx0 = s < 0 ? -10.1 : 2.0;
    const rx1 = s < 0 ? -2.0 : 10.1;
    const z0 = 46.5;
    const z1 = 56.05;
    // 柱: 細く暗い幹（下は少し太い台座）。高さで明るさが変わる（床の近くと屋根の下が暗い）。
    // 幹から屋根へ斜めに上がる方杖が 4 方向に 2 本ずつ、頭は屋根の下面へ広がる暗い逆さの角錐
    b.box(mat.columnBase, [cx, 0.6, cz], [0.6, 1.2, 0.6], { collide: true });
    b.box(mat.columnBase, [cx, 1.22, cz], [0.64, 0.05, 0.64]);
    b.box(mat.columnB, [cx, (1.2 + RU) / 2, cz], [0.36, RU - 1.2, 0.36], { collide: true });
    // 幹の角の細い縁（左の明るい筋）
    b.box(mat.columnEdge, [cx - 0.17, (1.25 + RU) / 2, cz - 0.17], [0.03, RU - 1.25, 0.03]);
    b.cyl(mat.bcFunnel, [cx, RU - 0.3, cz], 0.28, 0.6, { radiusTop: 1.5, segments: 4, rotY: Math.PI / 4 });
    for (const d of [-1, 1]) {
      strut(b, mat.columnB, [cx, 2.1, cz], [cx + d * 2.2, RU - 0.06, cz], 0.12, 0.16);
      strut(b, mat.columnB, [cx, 2.35, cz], [cx, RU - 0.06, cz + d * 1.9], 0.12, 0.16, { up: [1, 0, 0] });
      strut(b, mat.columnB, [cx, 2.75, cz], [cx, RU - 0.06, cz + d * 2.8], 0.08, 0.1, { up: [1, 0, 0] });
    }
    // 屋根の板と、まわりの薄い鼻先
    b.boxMM(mat.roofB, [rx0, RU, z0], [rx1, RT - 0.03, z1]);
    // 北と南の鼻先は明るい（station-3 から見える面）、東西の鼻先は暗い（station-2 から見える面）
    b.boxMM(mat.fasciaN, [rx0 - 0.04, RU - 0.02, z0 - 0.04], [rx1 + 0.04, RT, z0 + 0.04]);
    b.boxMM(mat.fasciaN, [rx0 - 0.04, RU - 0.02, z1 - 0.04], [rx1 + 0.04, RT, z1 + 0.04]);
    b.boxMM(mat.beamB, [rx0 - 0.04, RU - 0.02, z0], [rx0 + 0.04, RT, z1]);
    b.boxMM(mat.beamB, [rx1 - 0.04, RU - 0.02, z0], [rx1 + 0.04, RT, z1]);
    // 両端（妻側）の深い垂れ壁
    for (const z of [z0 + 0.05, z1 - 0.05]) b.boxMM(mat.bcValance, [rx0, RU - 0.48, z - 0.05], [rx1, RU, z + 0.05]);
    // 下面の細部: 横の小梁・長手の梁・配線・吊り下げの箱
    underside({
      x0: rx0 + 0.1, x1: rx1 - 0.1, z0: z0 + 0.1, z1: z1 - 0.1, y: RU, along: 'z',
      rib: [0.0, 0.0],
      beams: [[cx, 0.3, 0.3], [cx - 2.4, 0.16, 0.1], [cx + 2.4, 0.16, 0.1], [rx0 + 0.6, 0.12, 0.08], [rx1 - 0.6, 0.12, 0.08]],
      cross: [[z0 + 0.6, 0.18, 0.1], [z0 + 2.9, 0.18, 0.1], [z0 + 5.2, 0.18, 0.1], [z0 + 7.5, 0.18, 0.1], [z1 - 0.6, 0.18, 0.1]],
      pipes: [[cx - 1.2, 0.1, 0.05], [cx + 1.4, 0.12, 0.04]],
      boxes: { n: 6, size: [0.2, 0.45], drop: [0.05, 0.3], lanes: [cx - 1.5, cx + 1.6, cx - 2.2, cx + 2.2] },
      hangers: 1.1,
      seed: s < 0 ? 21 : 22,
    }, bcDark, bcLite);
    // 屋根の上のアンテナ（縦の棒と斜めの棒）
    b.box(mat.steel, [s * 8.5, RT + 0.62, 50.6], [0.05, 1.25, 0.05]);
    b.box(mat.steel, [s * 7.5, RT + 0.1, 51.05], [0.08, 0.2, 0.08]);
    strut(b, mat.steel, [s * 9.5, RT, 56.0], [s * 9.5, RT + 1.2, 55.45], 0.05, 0.05);
    strut(b, mat.steel, [s * 9.5, RT, 55.65], [s * 9.5, RT + 0.9, 55.55], 0.03, 0.03);
    // 待合の小屋（柱の北、A の側の縁に寄せる。幅 1.15 m）: 暗い壁、外を向く面いっぱいに窓 2 つの両開きの扉、上に案内と時計
    const bin = s * 4.75;
    const bout = s * 7.2;
    const bx0 = Math.min(bin, bout);
    const bx1 = Math.max(bin, bout);
    const bz0 = 49.45;
    const bz1 = 50.6;
    b.boxMM(mat.booth, [bx0, 0, bz0], [bx1, 2.55, bz1], { collide: true });
    b.boxMM(mat.shelterDark, [bx0 - 0.06, 2.55, bz0 - 0.06], [bx1 + 0.06, 2.85, bz1 + 0.06]);
    const ox = bout;
    const so = s;
    const fx = (d: number): [number, number] => [Math.min(ox + so * d, ox + so * (d + 0.02)), Math.max(ox + so * d, ox + so * (d + 0.02))];
    // 扉の枠（明るい細い枠）と、2 枚の扉（下は暗い板、上に窓）
    const [f0, f1] = fx(0.0);
    const dz0 = bz0 + 0.08;
    const dz1 = bz1 - 0.08;
    b.boxMM(mat.doorFrame, [f0, 0.02, dz0 - 0.04], [f1, 2.0, dz0]);
    b.boxMM(mat.doorFrame, [f0, 0.02, dz1], [f1, 2.0, dz1 + 0.04]);
    b.boxMM(mat.doorFrame, [f0, 1.96, dz0 - 0.04], [f1, 2.0, dz1 + 0.04]);
    const [g0, g1] = fx(0.01);
    b.boxMM(mat.doorLeaf, [g0, 0.04, dz0], [g1, 1.96, dz1]);
    const dm = (dz0 + dz1) / 2;
    b.boxMM(mat.doorFrame, [g0, 0.04, dm - 0.015], [g1, 1.96, dm + 0.015]);
    const [w0, w1] = fx(0.02);
    for (const [za, zb] of [[dz0 + 0.07, dm - 0.06], [dm + 0.06, dz1 - 0.07]] as const) {
      b.boxMM(mat.glass, [w0, 1.08, za], [w1, 1.78, zb]);
    }
    b.box(mat.board, [ox + so * 0.04, 1.0, dm - 0.07], [0.02, 0.1, 0.025]);
    // 扉の上の案内（2 枚）と時計
    b.boxMM(mat.board, [w0, 2.12, bz0 + 0.12], [w1, 2.3, bz0 + 0.5]);
    b.boxMM(mat.board, [w0, 2.08, bz0 + 0.56], [w1, 2.2, bz0 + 0.82]);
    b.cyl(mat.board, [ox + so * 0.05, 2.22, bz1 - 0.14], 0.085, 0.03, { axis: 'x', segments: 16 });
    // 北の面の窓
    const fn = bz0 - 0.02;
    for (const [wa, wb] of [[bx0 + 0.2, bx0 + 1.12], [bx1 - 1.12, bx1 - 0.2]]) {
      b.boxMM(mat.glass, [wa, 1.0, fn - 0.01], [wb, 2.15, fn]);
      for (let k = 1; k < 4; k++) {
        const wx = wa + (k * (wb - wa)) / 4;
        b.boxMM(mat.shelterDark, [wx - 0.02, 1.0, fn - 0.03], [wx + 0.02, 2.15, fn]);
      }
    }
    // 柱の南の暗い小部屋（奥まった暗い壁）と、券売機 2 台（暗い箱に小さな明るい画面）
    b.boxMM(mat.booth, [Math.min(s * 4.0, s * 5.05), 0, 51.8], [Math.max(s * 4.0, s * 5.05), 2.1, 53.3], { collide: true });
    b.boxMM(mat.shelterDark, [Math.min(s * 4.0, s * 5.05) - 0.04, 2.1, 51.76], [Math.max(s * 4.0, s * 5.05) + 0.04, 2.25, 53.34]);
    for (const zz of [52.35, 52.85]) {
      b.boxMM(mat.ticket, [s < 0 ? -5.45 : 5.05, 0, zz - 0.21], [s < 0 ? -5.05 : 5.45, 1.55, zz + 0.21], { collide: true });
      const sx = s < 0 ? -5.45 : 5.45;
      b.boxMM(mat.ticketScreen, [sx - 0.012, 1.0, zz - 0.13], [sx + 0.012, 1.22, zz + 0.13]);
      b.boxMM(mat.shelterDark, [sx - 0.06, 1.55, zz - 0.21], [sx + 0.06, 1.68, zz + 0.21]);
    }
    // 蛍光灯（屋根の下、長手に。外の列は長く、内の列は短い）
    // 蛍光灯（station-2 の視点から測った位置。鼻先の内側の列と、A の側の列）
    for (const [zc, len] of [[48.77, 1.95], [53.76, 1.95]] as const) {
      addTube([s * 9.55, 3.22, zc], len, 'z', 0.12, 0.09);
      b.box(mat.shelterDark, [s * 9.55, 3.34, zc], [0.04, 0.18, len * 0.9], { shadow: false });
    }
    for (const [zc, len] of [[48.7, 1.6], [53.9, 2.2]] as const) {
      addTube([s * 3.6, 3.2, zc], len, 'z', 0.08);
      b.box(mat.shelterDark, [s * 3.6, 3.32, zc], [0.04, 0.22, len * 0.9], { shadow: false });
    }
    // 角の細い柱と案内の柱（光る案内の箱）、吊り下げの小さな灯り
    b.box(mat.steel, [s * 3.5, RU / 2, 47.4], [0.08, RU, 0.08]);
    b.box(mat.steel, [cx, 1.3, 54.5], [0.07, 2.6, 0.07]);
    b.box(mat.shelterDark, [cx, 1.6, 54.5], [0.12, 0.38, 0.12]);
    b.box(mat.tube, [cx - s * 0.08, 2.55, 54.3], [0.06, 0.24, 0.5], { shadow: false });
    b.box(mat.shelterDark, [cx - s * 0.08, 2.55, 54.95], [0.07, 0.24, 0.85], { shadow: false });
    b.box(mat.lampBox, [s < 0 ? -9.0 : 9.0, 2.35, 49.0], [0.12, 0.3, 0.18], { shadow: false });
  }

  // ---------- D の上屋（station-0） ----------
  {
    const H = D.soffit;
    const xe = D.xEnd + 0.5;
    const zc = D.zc;
    b.boxMM(mat.roof, [xe, H, zc - D.half + 0.2], [-30, H + 0.25, zc + D.half - 0.2]);
    // 先端の梁
    b.boxMM(mat.frontD, [xe, 3.43, zc - D.half + 0.2], [xe + 0.4, H + 0.25, zc + D.half - 0.2]);
    // 長手の梁（蛍光灯を吊る・柱の列）と横の小梁
    for (const z of [-1.38, 1.2]) b.boxMM(mat.beam, [xe, 3.5, zc + z - 0.1], [-30, H, zc + z + 0.1]);
    for (const z of [-2.2, 2.2]) b.boxMM(mat.beam, [xe, 3.55, zc + z - 0.12], [-30, H, zc + z + 0.12]);
    // 柱の列の上の深い梁（下端 3.15）
    for (const z of [-4.6, 4.6]) b.boxMM(mat.beam, [xe, 3.15, zc + z - 0.14], [-30, H, zc + z + 0.14]);
    for (let x = xe + 6; x < -30; x += 6) b.boxMM(mat.beam, [x - 0.1, H - 0.25, zc - D.half + 0.3], [x + 0.1, H, zc + D.half - 0.3]);
    // 柱（2 列。台座はコンクリート、柱は H 形鋼）
    for (const x of [D.xEnd + 2.15, D.xEnd + 4.25, D.xEnd + 13.5, D.xEnd + 22.5, D.xEnd + 31.5]) {
      for (const z0 of [-4.6, 4.6]) {
        const z = x === D.xEnd + 4.25 && z0 > 0 ? 4.65 : z0;
        hColumn(b, mat.steelD, x, zc + z, 1.1, H, 0.18, 0.2, { rotY: Math.PI / 2 });
        b.box(mat.pedestalD, [x, 0.55, zc + z], [0.3, 1.1, 0.3], { collide: true });
        ctx.colliders.addCentered(x, 2, zc + z, 0.3, 4, 0.3);
      }
    }
    // 下面の細部: 波板の筋・中央のはしご形のラック・配管・箱・吊り金具
    underside({
      x0: xe + 0.4, x1: -30, z0: zc - D.half + 0.3, z1: zc + D.half - 0.3, y: H, along: 'x',
      rib: [0.22, 0.05],
      beams: [[-3.3, 0.18, 0.12], [3.3, 0.18, 0.12], [-5.8, 0.25, 0.14], [5.8, 0.25, 0.14]],
      trays: [[0.05, 0.3, 0.42]],
      pipes: [[-0.6, 0.2, 0.05], [0.7, 0.24, 0.04], [-2.7, 0.15, 0.06], [2.6, 0.12, 0.05]],
      boxes: { n: 16, size: [0.2, 0.5], drop: [0.05, 0.25], lanes: [-2.6, -0.4, 0.5, 2.7, -4.8, 4.9] },
      hangers: 0.8,
      seed: 5,
    }, shedDark, shedLite);
    // 先端の柱の方杖（曲がった板）と、手前の柱の間の格子
    for (const z of [-4.6, 4.6]) {
      const sz = Math.sign(z);
      // 柱から内へ曲がって梁に届く方杖（アーチ形の板）
      haunch(b, mat.steelD, D.xEnd + 2.15, sz, zc + z - sz * 0.1, 2.95, 0.5, 3.43 - 2.95, H, 0.12, { rotY: Math.PI / 2 });
      for (let k = 0; k < 4; k++) {
        const y0 = 2.85 + (k % 2) * 0.28;
        strut(b, mat.steelD, [D.xEnd + 2.15 + k * 0.7, y0, zc + z * 0.98], [D.xEnd + 2.85 + k * 0.7, 3.41 - (k % 2) * 0.28, zc + z * 0.98], 0.03, 0.03);
      }
      // 柱の機器（箱・信号）。右（-z）の柱には明るい案内板
      if (z > 0) b.box(mat.sign, [D.xEnd + 2.15, 2.35, zc + z * 0.96], [0.14, 0.35, 0.2]);
      else b.box(mat.signLight, [D.xEnd + 2.05, 2.23, zc - 4.3], [0.04, 0.16, 0.55]);
      b.box(mat.sign, [D.xEnd + 2.155, 0.68, zc + z * 0.95], [0.08, 0.2, 0.06]);
    }
    // 雨樋の縦管（左の手前）
    b.cyl(mat.steelD, [D.xEnd + 4.6, 0.95, zc + 4.75], 0.06, 1.9, { segments: 8 });
    b.box(mat.steelD, [D.xEnd + 4.6, 2.5, zc + 4.7], [0.05, 0.05, 0.4]);
    // 右の柱の間の深い梁と方杖
    b.boxMM(mat.steelD, [D.xEnd + 2.15, 2.9, zc - 4.7], [D.xEnd + 4.25, H, zc - 4.5]);
    strut(b, mat.steelD, [D.xEnd + 2.15, 2.35, zc - 4.6], [D.xEnd + 3.2, 2.95, zc - 4.6], 0.05, 0.05);
    // 左の柱の間の格子（下の弦と斜めの材）
    b.boxMM(mat.steelD, [D.xEnd + 2.15, 2.66, zc + 4.48], [D.xEnd + 4.25, 2.72, zc + 4.52]);
    for (let k = 0; k < 6; k++) {
      const x0 = D.xEnd + 2.15 + k * 0.35;
      strut(b, mat.steelD, [x0, 2.69, zc + 4.5], [x0 + 0.35, 3.15, zc + 4.5], 0.025, 0.025);
    }
    // 先端の梁から垂れる配線・管
    pipe(b, mat.steel, [[xe + 0.2, 3.42, zc + 3.6], [xe + 0.2, 3.22, zc + 3.3], [xe + 0.2, 3.3, zc + 2.9], [xe + 0.2, 3.42, zc + 2.6]], 0.03);
    pipe(b, mat.steel, [[xe + 0.2, 3.42, zc - 2.5], [xe + 0.2, 3.27, zc - 2.75], [xe + 0.2, 3.38, zc - 3.1]], 0.03);
    pipe(b, mat.steel, [[xe + 0.25, 3.42, zc + 0.6], [xe + 0.25, 3.1, zc + 0.6], [xe + 0.25, 3.05, zc + 0.25], [xe + 0.25, 3.05, zc - 0.55]], 0.035);
    // 吊り下げの箱（右）と柱の小さな案内
    b.box(mat.sign, [xe + 0.3, 3.15, zc - 4.06], [0.15, 0.42, 0.82]);
    for (const dz of [-0.3, 0.3]) b.box(mat.steel, [xe + 0.3, 3.4, zc - 4.06 + dz], [0.03, 0.12, 0.03]);
    // 蛍光灯（station-0 の参考画像の位置。幅の広い乳白の器具）
    for (const z of [-1.38, 1.2]) {
      for (const x of [-61.6, -60.1, -57.1, -54.75, -52.5, -49.9, -47.3, -44.7, -42.1, -39.5, -36.9, -34.3, -31.7]) {
        b.box(mat.housing, [x, 3.53, zc + z], [1.25, 0.08, 0.2], { shadow: false });
        addTube([x, 3.46, zc + z], 1.0, 'x', 0.11, 0.04, true);
      }
    }
  }

  // ---------- 架線柱（A の北） ----------
  for (let i = 0; i < POLES.n; i++) {
    const z = POLES.z0 - i * POLES.step;
    for (const s of [-1, 1]) {
      // 右（東）の柱は線路から少し遠い（station-1 の参考画像に合わせる）
      const off = s > 0 ? 0.9 : 0;
      const xo = s * (POLES.x + 0.4 + off);
      const xi = s * (POLES.x - 0.8 + off);
      hColumn(b, mat.steel, xo, z, Y.ground, 5.4, 0.3, 0.3);
      hColumn(b, mat.steel, xi, z, Y.ground, 4.7, 0.22, 0.22);
      b.box(mat.pedestal, [xo, Y.ground + 0.3, z], [0.7, 0.6, 0.7]);
      // 横の梁（線路の上まで）
      b.boxMM(mat.steel, [Math.min(xo, s * 4.8), 5.25, z - 0.1], [Math.max(xo, s * 4.8), 5.45, z + 0.1]);
      strut(b, mat.steel, [xi, 3.4, z], [s * 5.2, 4.6, z], 0.08, 0.08);
      strut(b, mat.steel, [xi, 4.0, z], [s * 5.0, 3.95, z], 0.07, 0.07);
    }
  }
  // 架線（1 番線・2 番線の上）: 吊架線・トロリ線・ハンガー、柱の頭の饋電線
  const zA = -330;
  const zB = SHED.z0 + 2;
  for (const x of [TRACK.t1, TRACK.t2]) {
    b.boxMM(mat.wire, [x - 0.012, 5.3, zA], [x + 0.012, 5.324, zB]);
    b.boxMM(mat.wire, [x - 0.012, 4.1, zA], [x + 0.012, 4.12, zB]);
    for (let z = zB - 2; z > zA; z -= 4.5) b.boxMM(mat.wire, [x - 0.006, 4.12, z - 0.006], [x + 0.006, 5.3, z + 0.006]);
  }
  for (const sx of [-1, 1]) {
    for (const [dx, y] of [[0.0, 5.55], [-0.6, 5.2], [0.5, 5.35]] as const) {
      const x = sx * (POLES.x + 0.4 + dx);
      b.boxMM(mat.wire, [x - 0.012, y, zA], [x + 0.012, y + 0.024, zB]);
    }
  }
  // 柱の機器（箱）と碍子
  for (let i = 0; i < POLES.n; i++) {
    const z = POLES.z0 - i * POLES.step;
    for (const sx of [-1, 1]) {
      const xi = sx * (POLES.x - 0.8);
      b.box(mat.steel, [xi - sx * 0.15, 2.8, z], [0.22, 0.4, 0.22]);
      b.box(mat.steel, [xi - sx * 0.15, 3.6, z], [0.18, 0.25, 0.18]);
      b.box(mat.steel, [sx * 5.3, 4.95, z], [0.12, 0.3, 0.12]);
    }
  }

  // ---------- 遠くの建物（霧の向こう） ----------
  const shed = (x: number, z: number, w: number, d: number, h: number): void => {
    b.boxMM(mat.far, [x - w / 2, Y.ground, z - d / 2], [x + w / 2, Y.ground + h, z + d / 2]);
  };
  shed(-75, -150, 60, 14, 6);
  shed(-130, -170, 40, 12, 5);
  shed(85, -160, 50, 16, 7);
  shed(140, -190, 30, 12, 5);
  // station-2 の背景（東の野原の遠く）: 腕木のある柱・格子の鉄塔・小屋・細い柱
  const lattice = (x: number, z: number, h: number, w: number): void => {
    for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) strut(b, mat.far, [x + dx * 1.6, Y.ground, z + dz * 1.6], [x + dx * 0.5, Y.ground + h, z + dz * 0.5], 0.12, 0.12);
    for (let y = 0.9; y < h - 0.3; y += 1.3) b.box(mat.far, [x, Y.ground + y, z], [w * (1.6 - (y / h) * 1.1), 0.1, w * (1.6 - (y / h) * 1.1)]);
    b.box(mat.far, [x, Y.ground + h + 0.4, z], [w * 1.3, 0.8, w * 1.3]);
  };
  b.box(mat.far, [76.3, (Y.ground + 12.6) / 2, 8.5], [0.4, 12.6 - Y.ground, 0.4]);
  b.box(mat.far, [76.3, 11.3, 9.1], [0.25, 0.25, 3.2]);
  b.box(mat.far, [76.3, 10.0, 8.8], [0.6, 1.0, 0.7]);
  lattice(96.3, 2.5, 11.0, 1.6);
  lattice(116.3, 12.3, 10.5, 1.6);
  b.boxMM(mat.far, [123, Y.ground, -21.9], [129, Y.ground + 4.6, -15.5]);
  b.box(mat.far, [86.3, (Y.ground + 8.7) / 2, 97.7], [0.25, 8.7 - Y.ground, 0.25]);

  // 北の地平線の倉庫と電柱（station-1 の参考画像の地平線の影）。遠いので霧を薄く掛けて、影だけ残す
  {
    const zF = -230;
    const g = Y.ground;
    b.boxMM(mat.farHaze, [-204, g, zF - 20], [-126, 6.6, zF]);
    b.boxMM(mat.farHaze, [-128, g, zF - 14], [-106, 7.2, zF + 4]);
    b.boxMM(mat.farHaze, [119, g, zF - 24], [260, 5.8, zF]);
    b.boxMM(mat.farHaze, [167, g, zF - 18], [187, 10.0, zF - 2]);
    b.boxMM(mat.farHaze, [60, g, zF - 30], [100, 4.5, zF - 10]);
    for (const x of [-198, -169, -163, -137]) {
      b.box(mat.farHaze, [x, (g + 12.3) / 2, zF + 10], [0.5, 12.3 - g, 0.5]);
      b.box(mat.farHaze, [x, 11.8, zF + 10], [3.2, 0.3, 0.3]);
    }
    for (const x of [77, 96, 120, 148, 185]) {
      b.box(mat.farHaze, [x, (g + 8.1) / 2, zF], [0.4, 8.1 - g, 0.4]);
      b.box(mat.farHaze, [x, 7.7, zF], [2.4, 0.25, 0.25]);
    }
  }

  // ---------- ベンチ ----------
  // station-1: A の中央に背中合わせの 2 列（外の線路を向く）、奥に 3 人掛けと掲示板
  for (const s of [-1, 1]) {
    const x = s < 0 ? -1.0 : 1.15;
    seatRow(b, mat.bench, mat.steel, [x, 0, -8.4], s < 0 ? -Math.PI / 2 : Math.PI / 2, 9, 0.58);
    ctx.colliders.add({ x: x - 0.3, y: 0, z: -11.7 }, { x: x + 0.3, y: 0.9, z: -5.7 });
  }
  seatRow(b, mat.bench, mat.steel, [0.15, 0, -17.3], Math.PI, 3, 0.6);
  b.box(mat.board, [0.36, 1.05, -18.4], [0.95, 1.0, 0.08]);
  for (const x of [-0.42, 0.42]) b.box(mat.steel, [0.36 + x, 0.3, -18.4], [0.05, 0.6, 0.05]);
  ctx.colliders.add({ x: -1, y: 0, z: -18.6 }, { x: 1, y: 1.6, z: -17 });
  // station-3: 中央柱の上屋の下、西寄りの列（中央を向く）と東寄りの列
  seatRow(b, mat.benchT, mat.steel, [-1.95, 0, 22.6], -Math.PI / 2, 12, 0.57);
  ctx.colliders.add({ x: -2.3, y: 0, z: 19.2 }, { x: -1.6, y: 0.9, z: 26 });
  seatRow(b, mat.benchT, mat.steel, [1.0, 0, 34.5], Math.PI / 2, 10, 0.57);
  ctx.colliders.add({ x: 0.7, y: 0, z: 31.6 }, { x: 1.3, y: 0.9, z: 37.4 });
  seatRow(b, mat.benchT, mat.steel, [-1.2, 0, 36.2], -Math.PI / 2, 4, 0.57);
  ctx.colliders.add({ x: -1.5, y: 0, z: 35 }, { x: -0.9, y: 0.9, z: 37.4 });
  // station-0: D の先端を向く 2 人掛け 2 つ
  for (const z of [0.99, -1.07]) {
    twinSeat(b, mat.benchD, mat.frameD, [-60.05, 0, D.zc + z], Math.PI / 2);
    ctx.colliders.addCentered(-60.05, 0.45, D.zc + z, 0.6, 0.9, 1.3);
  }
  // station-2・station-3: B・C のベンチ。小屋の北に樹脂の座席の列（北を向く）、柱の南に板のベンチ（斜め）
  for (const s of [-1, 1]) {
    seatRow(b, mat.benchT, mat.steel, [s * 5.6, 0, 48.3], 0, 5, 0.57);
    ctx.colliders.addCentered(s * 5.6, 0.45, 48.3, 2.9, 0.9, 0.6);
    slatBench(b, mat.benchB, mat.benchB, [s * 5.75, 0, 53.9], s < 0 ? 0.6435 : -0.6435, 1.7);
    ctx.colliders.addCentered(s * 5.75, 0.45, 53.9, 1.3, 0.9, 1.3);
  }

  // ---------- 草の株（線路のまわり・ホームの割れ目・野原） ----------
  {
    const grass = M({ color: '#4a7a62', side: THREE.DoubleSide });
    // station-2 の手前の草は逆光の暗い影（光を当てない暗い色に霧だけ掛ける）
    const grassDark = M({ color: '#0c2a2e', unlit: true, side: THREE.DoubleSide });
    const ms: THREE.Matrix4[] = [];
    const msDark: THREE.Matrix4[] = [];
    const add = (x: number, y: number, z: number, h: number, to = ms): void => {
      const m = trs(x, y, z, rand() * Math.PI * 2, h * (0.8 + rand() * 0.5), h, h * (0.8 + rand() * 0.5));
      to.push(m);
    };
    // 0 番線のまわり（station-2 の手前）とホームの足元
    for (let i = 0; i < 150; i++) add(-15.5 + rand() * 5.2, Y.ground, 44 + rand() * 16, 0.2 + rand() * 0.3, msDark);
    for (let i = 0; i < 50; i++) add(-10.7 - rand() * 0.5, Y.ground, 45.5 + rand() * 12.4, 0.22 + rand() * 0.25, msDark);
    // A の床の割れ目（station-3 の中央）
    for (let i = 0; i < 70; i++) {
      const z = 18 + rand() * 30;
      add((rand() - 0.5) * 3.2, Y.top, z, 0.06 + rand() * 0.08);
    }
    // 線路の脇と野原（station-1・station-3）
    for (let i = 0; i < 220; i++) {
      const sx = rand() < 0.5 ? -1 : 1;
      add(sx * (6.6 + rand() * 9), Y.ground, -60 + rand() * 140, 0.12 + rand() * 0.2);
    }
    const tg = tuftGeometry(7, 3);
    instanced(b.root, tg, grass, ms);
    instanced(b.root, tg, grassDark, msDark);
  }

  // 下面の細部（すべて映り込みに出す）
  canDark.build(b.root, mat.underDark);
  canLite.build(b.root, mat.underLite);
  shedDark.build(b.root, mat.underDark);
  shedLite.build(b.root, mat.underLite);
  bcDark.build(b.root, mat.bcUnderDark);
  bcLite.build(b.root, mat.bcUnderLite);

  b.root.add(createTubeGlow(tubes, { radius: 0.22, color: '#ffffff', strength: 0.2 }));
  b.finalize();
  return { root: b.root, spawn: { pos: [0, 0, 0], yaw: 0 } };
}
