import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../render/Style.ts';
import { Builder } from '../scenes/Builder.ts';
import { HField } from '../scenes/pool/hfield.ts';
import { Kit, T } from '../scenes/pool/kit.ts';
import { createWater, type WaterParams } from '../scenes/pool/water.ts';
import type { BuiltScene, SceneContext, SceneDef } from '../scenes/types.ts';
import type { Lamp } from '../render/Lamps.ts';
import { buildHallA, CAM_A, hallAMats, SUN_A } from './pool/hallA.ts';
import { buildHallB, CAM_B, SUN_B } from './pool/hallB.ts';
import { buildHallC, buildStairC, CAM_C, SUN_C } from './pool/hallC.ts';
import { buildHallD, CAM_D, hallDMats, SUN_D } from './pool/hallD.ts';
import { buildHallE, SUN_E } from './pool/hallE.ts';
import { buildCave, buildCaveInside } from './pool/river.ts';
import { buildTerrace } from './pool/outside.ts';
import { CAVE, HALL, TERRACE, type HallId, type Rect } from './pool/layout.ts';
import { poolPlan } from './pool/plan.ts';
import { Doors } from './pool/doors.ts';
import { Mats } from './pool/frame.ts';
import type { HallEnv } from './pool/hallkit.ts';
import { ROOMS } from './pool/layout.ts';
import { dressOf } from './pool/props.ts';
import { buildPartitions, finishes, roomMats, roomShell } from './pool/rooms.ts';
import { contactShadows, furnishMats, furnishRoom } from './pool/furnish.ts';
import { Signs } from './pool/signs.ts';
import { waterGeometry } from './pool/watergeo.ts';

/**
 * 屋内プール（建築版）。大きな屋内レジャープール（温浴とプールの複合施設）を間取り図（pool/plan.ts）から作った版。
 * 参考画像 pool-0〜3 は 4 つのホール A〜D の視点。ホールは流れるプール（1 周の水路）と通路でつながる。
 * 見た目（材質・水・影の形）は元の版（src/scenes/pool）を読んで使う。
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'pool-arch',
  background: '#b9d6cf',
  fog: { horizon: '#a9cbc2', zenith: '#eef4e8', ground: '#a9cbc2', density: 0.008, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.6, steps: 0, extinction: [1.15, 1.0, 1.0] },
  toon: { amount: 1, thresholds: [1.3, 0.72, 0.3], soft: 0.01, noiseAmp: 0.03, noiseScale: 1.2, shade: [0.8, 0.9, 10], dark: [0.55, 1, 18], hi: [1.04, 0.7, -4] },
  shadowQuant: T,
  shadowJitter: 0,
  post: {
    bloom: { strength: 0.25, threshold: 1.0, radius: 0.7 },
    diffusion: { amount: 0.25, threshold: 0.75, radius: 0.8 },
    lines: { enabled: false, color: '#2a4a4c', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.6 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

/** pool-3（D）: 平らな色面。クリーム色の壁と青緑の陰 */
const styleD = makeStyle(style, {
  name: 'pool-3',
  fog: { horizon: '#89a59d', zenith: '#b4ccc6', ground: '#89a59d', density: 0.01, heightFalloff: 0, baseHeight: 0, start: 5, max: 0.6, steps: 0, extinction: [1.1, 1.0, 1.0] },
  toon: { thresholds: [1.4, 0.6, 0.3] },
  post: { grade: { exposure: 1, lift: -0.03, gamma: 0.983, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 }, diffusion: { amount: 0.247, threshold: 0.85, radius: 0.6 }, kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1, scale: 0.5 } },
});
/** pool-2（C）: 明るい天窓、手前は明るい水色、右は深い青緑 */
const styleC = makeStyle(style, {
  name: 'pool-2',
  toon: { thresholds: [1.3, 0.72, 0.3] },
  fog: { horizon: '#82b5b8', zenith: '#a9d4cc', ground: '#82b5b8', density: 0.0165, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.7, steps: 0, extinction: [1.2, 1.0, 0.95] },
  post: {
    diffusion: { amount: 0.1, threshold: 0.85, radius: 0.7 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1, scale: 0.5 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1.1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});
/** pool-0（A）: 4 枚の中で写実寄り。影の縁は升目に丸めない */
const styleA = makeStyle(style, {
  name: 'pool-0',
  toon: { thresholds: [1.3, 0.72, 0.3] },
  shadowQuant: 0,
  post: { diffusion: { amount: 0.367, threshold: 0.75, radius: 0.8 }, grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1.12, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 } },
  fog: { horizon: '#87b0a8', zenith: '#eef4e8', ground: '#87b0a8', density: 0.007, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.6, steps: 0, extinction: [1.15, 1.0, 1.0] },
});
/** A の区域の部屋: pool-0 と同じ見た目で、影はタイルの升目に丸める（部屋の日なた・光だまりの縁が段になる） */
const styleARoom = makeStyle(styleA, { name: 'pool-0-room', shadowQuant: T });
/** pool-1（B）: 青緑が強く、くっきり（霧は薄い）。梁の下面は水からの照り返しで 1 段明るく */
const styleB = makeStyle(style, {
  name: 'pool-1',
  fog: { horizon: '#8cc2c8', zenith: '#a9d6d3', ground: '#8cc2c8', density: 0.007, heightFalloff: 0, baseHeight: 0, start: 12, max: 0.7, steps: 0, extinction: [1.2, 1.0, 0.95] },
  toon: { thresholds: [1.3, 0.72, 0.3], bounce: 0.3 },
  post: { grade: { exposure: 1, lift: 0, gamma: 1.075, gain: 0.983, saturation: 0.95, hue: 0, tint: [-0.002, 0], posterize: 0, vignette: 0, grain: 0 }, diffusion: { amount: 0.21, threshold: 0.9, radius: 0.6 } },
});

/** E（25 m プール。参考画像なし）: pool-0 に近い見た目で、霧はうすく */
const styleE = makeStyle(style, {
  name: 'pool-E',
  toon: { thresholds: [1.3, 0.72, 0.3] },
  fog: { horizon: '#9cc2ba', zenith: '#eef4e8', ground: '#9cc2ba', density: 0.006, heightFalloff: 0, baseHeight: 0, start: 8, max: 0.5, steps: 0, extinction: [1.15, 1.0, 1.0] },
  post: { diffusion: { amount: 0.3, threshold: 0.8, radius: 0.8 }, grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1.05, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 } },
});

/** ホールごとの日の向き・影の範囲・水の見た目・見た目 */
interface Zone {
  id: HallId;
  sunDir: [number, number, number];
  shadowBox: [[number, number, number], [number, number, number]];
  water: Partial<WaterParams>;
  style: StylePreset;
}

const ZONES: Partial<Record<HallId, Zone>> = {
  A: {
    id: 'A',
    sunDir: SUN_A,
    shadowBox: [[-20, -2, -38], [24, 5, 13]],
    water: { posterNoise: 0.4, bottomLit: '#f5f5f2', absorb: [1.9, 0.7, 0.75], bottomShade: '#5a9196', wallShade: '#4e8784', deep: '#1a4a51', grout: '#c9d6c6', groutWidth: 0.008, waveAmp: 0.05, waveScale: 0.9, distort: 0.006, caustics: 0.25, r0: 0.09, reflGain: 1, reflTint: '#dffcfc', patch: [-5.75, -9.5, -2.5, -4.5], patchAmount: 1, patchThreshold: 0.1, patchScale: 0.3, aniso: 2.5, sunGain: 1.0 },
    style: styleA,
  },
  B: {
    id: 'B',
    sunDir: SUN_B,
    shadowBox: [[HALL.B.rect[0] - 1, -2, HALL.B.rect[1] - 1], [HALL.B.rect[2] + 1, 9, HALL.B.rect[3] + 1]],
    water: { bottomLit: '#fbfcfb', bottomShade: '#18545e', wallShade: '#6aa7a0', wallLit: 0, grout: '#a9d5cc', groutWidth: 0.02, absorb: [1.5, 0.28, 0.42], deep: '#154f5a', patch: [59.75 - 33, -4.25, 63.25 - 33, -2.0], patchAmount: 0, patchThreshold: 0.2, patchScale: 0.7, r0: 0.2, reflGain: 0.8, reflTint: '#b5e4e0', posterize: 6, posterNoise: 0.15, reflPosterize: 4, waveAmp: 0.05, waveScale: 0.8, waveQuant: 0, distort: 0.006, caustics: 0.0, aniso: 2, litHoles: [1, -0.35, 2.8, 0.012], reflKey: [0.9, 0.5], reflOver: [1, 0.05], reflRect: [56 - 33, -7.5, 59.8 - 33, -1.5] },
    style: styleB,
  },
  C: {
    id: 'C',
    sunDir: SUN_C,
    shadowBox: [[HALL.C.rect[0] - 1, -2, HALL.C.rect[1] - 7], [HALL.C.rect[2] + 1, 10, HALL.C.rect[3] + 1]],
    water: { bottomLit: '#fbfdff', bottomShade: '#0c5c68', wallShade: '#0b5a66', wallLit: 0, grout: '#a6dccd', groutWidth: 0.012, absorb: [1.25, 0.14, 0.32], deep: '#08505c', r0: 0.03, reflGain: 0.9, reflTint: '#6cc4c8', reflKey: [0.9, 0.8], posterize: 6, posterNoise: 0.3, reflPosterize: 3, waveAmp: 0.04, waveScale: 0.4, waveQuant: 0, distort: 0.01, aniso: 3, caustics: 0.0 },
    style: styleC,
  },
  D: {
    id: 'D',
    sunDir: SUN_D,
    shadowBox: [[HALL.D.rect[0] - 1, -2, HALL.D.rect[1] - 1], [HALL.D.rect[2] + 1, 10, HALL.D.rect[3] + 1]],
    water: { bottomLit: '#fbfdff', bottomShade: '#eef6f2', wallShade: '#2a6a6c', wallLit: 0, grout: '#b9d8cc', groutWidth: 0.012, absorb: [1.6, 0.36, 0.56], deep: '#1a5c62', r0: 0.05, reflGain: 0.6, reflTint: '#b4e2d6', posterize: 7, posterNoise: 0.25, reflPosterize: 5, waveAmp: 0.06, waveScale: 0.6, waveQuant: 0, distort: 0.03, caustics: 0.0, aniso: 4, foam: 1, foamWidth: 0.6, foamColor: '#f3f4e6', reflKey: [0.85, 0.5], bottomWarp: [1.2, 0.5] },
    style: styleD,
  },
  E: {
    id: 'E',
    sunDir: SUN_E,
    shadowBox: [[HALL.E.rect[0] - 1, -2, HALL.E.rect[1] - 1], [HALL.E.rect[2] + 1, 7, HALL.E.rect[3] + 1]],
    water: { posterNoise: 0.35, bottomLit: '#f5f6f0', absorb: [1.7, 0.45, 0.55], bottomShade: '#6f9fa2', wallShade: '#5d8f8e', deep: '#1f5a60', grout: '#c3d5cb', groutWidth: 0.01, waveAmp: 0.05, waveScale: 0.8, distort: 0.008, caustics: 0.2, r0: 0.07, reflGain: 0.9, reflTint: '#dff5f2', posterize: 6, reflPosterize: 4, aniso: 2.5, sunGain: 1.0 },
    style: styleE,
  },
};

/** 区域（カメラがこの中なら、そのホールの日・水・見た目）。部屋は近いホールの区域 */
/** 洞窟の水路の中か（影の範囲を洞窟まで広げ、D の区域として扱う） */
function inCave(p: THREE.Vector3): boolean {
  return p.y < 4 && p.x > CAVE.crossX[0] - 0.5 && p.x < CAVE.tunnelX[1] + 0.5 && p.z > CAVE.crossZ[0] - 0.5 && p.z < -62.5;
}

/** ホールの中で部屋の材質を使う小さな空間（B の前室・D の 2 階の回廊・C の階段室）: x0, y0, z0, x1, y1, z1 */
const INNER: [number, number, number, number, number, number][] = [
  [HALL.B.o[0] - 4, -1, -40.5, HALL.B.o[0] + 1.75, 3.0, -20.75],
  [HALL.D.o[0] + 8, 4.5, HALL.D.o[1] - 25, HALL.D.o[0] + 14, 8, HALL.D.o[1] - 18],
  [HALL.C.o[0] - 0.5, -1, HALL.C.o[1] - 24, HALL.C.o[0] + 8, 8.5, HALL.C.o[1] - 21.25],
];

function zoneAt(p: THREE.Vector3): HallId | null {
  if (inCave(p)) return 'D';
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.rect;
    if (p.x >= x0 - 0.15 && p.x <= x1 + 0.15 && p.z >= z0 - 0.15 && p.z <= z1 + 0.15 && p.y > r.floor - 0.5 && p.y < r.ceil + 0.5) return r.zone;
  }
  for (const id of ['A', 'B', 'C', 'D', 'E'] as HallId[]) {
    const r = HALL[id].rect;
    if (p.x >= r[0] - 0.5 && p.x <= r[2] + 0.5 && p.z >= r[1] - 0.5 && p.z <= r[3] + 0.5) return id;
  }
  return null;
}

/** 区域の影の範囲: ホールと、その区域の部屋を全部覆う箱（部屋の天井が影を落として部屋の中を陰にする） */
function shadowBoxOf(id: HallId, base: [[number, number, number], [number, number, number]]): [[number, number, number], [number, number, number]] {
  const mn = [...base[0]] as [number, number, number];
  const mx = [...base[1]] as [number, number, number];
  if (id === 'D') {
    mn[0] = Math.min(mn[0], CAVE.crossX[0] - 1);
    mn[2] = Math.min(mn[2], CAVE.crossZ[0] - 1);
  }
  for (const r of ROOMS) {
    if (r.zone !== id) continue;
    mn[0] = Math.min(mn[0], r.rect[0] - 1);
    mn[2] = Math.min(mn[2], r.rect[1] - 1);
    mx[0] = Math.max(mx[0], r.rect[2] + 1);
    mx[2] = Math.max(mx[2], r.rect[3] + 1);
    mx[1] = Math.max(mx[1], r.ceil + 0.5);
  }
  return [mn, mx];
}

export const pool: SceneDef = {
  id: 'pool',
  label: '屋内プール（建築版）',
  style,
  sky: { clouds: 0 },
  plan: poolPlan,
  views: [
    { id: 'pool-0', label: 'A 流れの回廊: 入口のプールサイドから北', ...CAM_A.def(HALL.A.o[0], HALL.A.o[1]), style: styleA },
    { id: 'pool-1', label: 'B 柱の森: 浅い池の中から北東', ...CAM_B.def(HALL.B.o[0], HALL.B.o[1]), style: styleB },
    { id: 'pool-2', label: 'C 深いプール: 低い段から北西', ...CAM_C.def(HALL.C.o[0], HALL.C.o[1]), style: styleC },
    { id: 'pool-3', label: 'D 大広間: 浅い池の中から北の洞窟', ...CAM_D.def(HALL.D.o[0], HALL.D.o[1]), style: styleD },
  ],
  build(ctx0) {
    // 灯り（部屋の光だまり）は、目がその灯りの照らす箱の近く（3 m 以内）にある時だけ点ける
    // （ホールの視点では部屋の灯りを計算しない。部屋の外から見る部屋は影の範囲の外なので明るい）
    const lampList: Lamp[] = [];
    const ctx: SceneContext = { ...ctx0, addLamp: (l) => { const r = ctx0.addLamp(l); lampList.push(r); return r; } };
    const root = new THREE.Group();
    // 水の底の升目（建物全体。既定は「詰まっている」= 水の無い所）
    const hf = new HField(-45, -100, 85, 50, T, 50);
    const builders = new Map<string, Builder>();
    const kitOf = (key: string): Kit => {
      let b = builders.get(key);
      if (!b) builders.set(key, (b = new Builder(ctx)));
      return new Kit(b, hf);
    };

    const mats = new Mats(ctx);
    const signs = new Signs(ctx);
    const rm = roomMats(mats);
    const doors = new Doors(ctx, { frame: mats.flat('#c9d4cf', '#a6b6af'), glass: rm.pane, leaf: mats.flat('#dbe7e1', '#b7cbc2'), handle: mats.flat('#6f8d86', '#5c7a73') });
    const fin = finishes(mats);
    const envOf = (key: string): HallEnv => ({ k: kitOf(key), doors, rm, fin });
    buildHallA(envOf('A'), hallAMats(ctx.mat), dressOf(ctx, mats, signs, 101));
    buildHallB(envOf('B'), dressOf(ctx, mats, signs, 202));
    buildHallC(envOf('C'), dressOf(ctx, mats, signs, 303));
    buildHallD(envOf('D'), hallDMats(ctx.mat), dressOf(ctx, mats, signs, 404));
    buildHallE(envOf('E'), dressOf(ctx, mats, signs, 505), ctx);
    buildCave(kitOf('cave'), ctx);
    buildCaveInside(kitOf('caveIn'), ctx);
    buildStairC(kitOf('stairC'), ctx, rm);
    buildTerrace(kitOf('terrace'), ctx, dressOf(ctx, mats, signs, 606));

    // 部屋（床・天井・灯り）と間仕切り・扉
    const fm = furnishMats(mats);
    // ホールから見る部屋（影の範囲の外 = 全部日なたになる）は、部屋の材質を陰の色に切り替える（暗い開口に見える）
    const roomOnly = new Set<THREE.Material>([rm.wall, rm.arch.ceil, rm.arch.beam, rm.arch.pier, rm.arch.plinth, rm.arch.reveal, ...Object.values(fm)]);
    for (const f of Object.values(fin)) {
      roomOnly.add(f.floor);
      if (f.band) roomOnly.add(f.band.mat);
    }
    const shadeSwap = [...roomOnly].map((m) => {
      const mm = m as THREE.MeshStandardMaterial;
      const u = mm.userData.sl;
      return { mm, u, color: mm.color.clone(), sh: u.uSlRatioShade.value.clone(), dk: u.uSlRatioDark.value.clone(), hi: u.uSlRatioHi.value.clone(), tile: u.uSlTileColor.value.clone() };
    });
    let shaded = false;
    const setRoomShade = (on: boolean): void => {
      if (on === shaded) return;
      shaded = on;
      for (const s of shadeSwap) {
        if (on) {
          s.mm.color.copy(s.color).multiply(new THREE.Color(s.sh.x, s.sh.y, s.sh.z));
          s.u.uSlRatioShade.value.set(1, 1, 1);
          s.u.uSlRatioHi.value.set(1, 1, 1);
          s.u.uSlRatioDark.value.set(s.dk.x / Math.max(s.sh.x, 1e-4), s.dk.y / Math.max(s.sh.y, 1e-4), s.dk.z / Math.max(s.sh.z, 1e-4));
          s.u.uSlTileColor.value.copy(s.tile).multiply(new THREE.Color(s.sh.x, s.sh.y, s.sh.z));
        } else {
          s.mm.color.copy(s.color);
          s.u.uSlRatioShade.value.copy(s.sh);
          s.u.uSlRatioHi.value.copy(s.hi);
          s.u.uSlRatioDark.value.copy(s.dk);
          s.u.uSlTileColor.value.copy(s.tile);
        }
      }
    };
    // 物の足元の深い影（どの段でも同じ深い青緑）
    const contactMat = mats.flat('#335c59', '#335c59', { line: 0 });
    ROOMS.forEach((r, i) => {
      if (r.closed) return;
      const b = kitOf(`room:${r.id}`).b;
      roomShell(b, rm, r, fin[r.kind]);
      furnishRoom(b, dressOf(ctx, mats, signs, 1000 + i * 37), fm, r);
      contactShadows(b, r, contactMat);
    });
    buildPartitions(kitOf('shell').b, rm, doors);
    signs.done();
    root.add(doors.root);

    // 水面（映り込み 1 枚）。水のある升目だけ
    const refl = ctx.addReflector({ x: 0, y: 0, z: 0 }, undefined, 0.5);
    const water = createWater(hf, refl, [-45, -100, 85, 50]);
    water.mesh.geometry.dispose();
    water.mesh.geometry = waterGeometry(hf);
    root.add(water.mesh);
    hf.addColliders(ctx.colliders, 0.55, -0.66);

    // 光: 日（ホールごとに向きと影の範囲を合わせる）+ 空の明るさ
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    root.add(sun, sun.target);
    root.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, Math.PI * 0.5));
    ctx.setSun(sun);

    // ホールの影だけを落とす板（見えない屋根・なぞった影）は、今いるホールの分だけ効かせる
    const gobos = new Map<string, THREE.Object3D[]>();
    for (const [key, b] of builders) {
      const list: THREE.Object3D[] = [];
      b.root.traverse((o) => {
        if (o.name.startsWith('gobo')) list.push(o);
      });
      gobos.set(key, list);
      b.finalize();
      b.root.name = key;
      root.add(b.root);
    }

    // ---- 見えない所を描かない ----
    // 区画（ホール・部屋・洞窟）ごとに、そこが見える場所（自分と、開口・ガラス戸・窓でつながる場所）を決めておき、
    // 目がそのどれかの中にある時だけ描く。真上の図（beforeRender の o.map）では全部描く
    const grow = (r: Rect, d: number): Rect => [r[0] - d, r[1] - d, r[2] + d, r[3] + d];
    const place: Record<string, Rect> = { cave: [CAVE.crossX[0] - 1, CAVE.crossZ[0] - 1, CAVE.tunnelX[1] + 1, -61], terrace: grow(TERRACE, 0.5) };
    // 洞窟の中の作り込み（灯り・肋）は中にいる時だけ（参考画像の視点からは暗いトンネル）
    place.caveIn = [CAVE.crossX[0] - 0.5, CAVE.crossZ[0] - 0.5, CAVE.tunnelX[1] + 0.5, -62.5];
    // C の観覧の階段の階段室の作り込みも中にいる時だけ（pool-2 からは暗い吹き抜け）
    place.stairC = [HALL.C.o[0] - 0.5, HALL.C.o[1] - 24.0, HALL.C.o[0] + 8.0, HALL.C.o[1] - 21.25];
    for (const id of ['A', 'B', 'C', 'D', 'E'] as HallId[]) place[id] = grow(HALL[id].rect, 1.2);
    for (const r of ROOMS) place[r.id] = grow(r.rect, 0.4);
    const SEE: Record<string, string[]> = {
      A: ['B', 'guard', 'showerM', 'showerW', 'changeM', 'changeW', 'lobbyT', 'terrace'],
      terrace: ['A'],
      B: ['A', 'toiletB', 'sauna', 'plant', 'E'],
      C: ['lobbyT', 'lounge', 'cave'],
      D: ['lobbyT', 'service', 'lounge', 'cave'],
      E: ['service', 'B'],
      cave: ['C', 'D'],
      guard: ['A', 'staffLocker'],
      showerM: ['A', 'changeM'],
      showerW: ['A', 'changeW'],
      changeM: ['showerM', 'hallway'],
      changeW: ['showerW', 'hallway'],
      hallway: ['entrance', 'changeM', 'changeW', 'staff', 'staffLocker'],
      staffLocker: ['hallway', 'guard'],
      entrance: ['hallway', 'office', 'plant', 'store'],
      office: ['entrance'],
      store: ['entrance'],
      plant: ['entrance', 'B'],
      toiletB: ['B'],
      sauna: ['B'],
      lobbyT: ['A', 'C', 'D', 'aid', 'toiletT'],
      aid: ['lobbyT'],
      toiletT: ['lobbyT'],
      service: ['D', 'E'],
      lounge: ['C', 'D'],
      staff: ['hallway'],
    };
    const lounge = ROOMS.find((r) => r.id === 'lounge')!;
    const inPlace = (p: THREE.Vector3, key: string): boolean => {
      const r = place[key];
      if (!r || p.x < r[0] || p.x > r[2] || p.z < r[1] || p.z > r[3]) return false;
      // 2 階のラウンジは高さでも分ける（下は機械室）
      if (key === 'lounge') return p.y > lounge.floor - 0.5;
      if (key === 'caveIn') return p.y < 4;
      return true;
    };
    const cullList: { obj: THREE.Object3D; keys: string[] }[] = [];
    for (const [key, b] of builders) {
      if (key === 'shell') continue;
      const k = key.startsWith('room:') ? key.slice(5) : key;
      cullList.push({ obj: b.root, keys: [k, ...(SEE[k] ?? [])] });
    }
    const cull = (p: THREE.Vector3, all: boolean): void => {
      let changed = false;
      for (const c of cullList) {
        const v = all || c.keys.some((k) => inPlace(p, k));
        if (c.obj.visible !== v) {
          c.obj.visible = v;
          changed = true;
        }
      }
      doors.cull(p, all);
      if (changed) ctx.updateShadows();
    };

    let zoneKey = '';
    // 部屋の中にいる時だけ、影の範囲を部屋まで広げる（ホールの中では元の版と同じ範囲 = 参考画像の視点の影の細かさを変えない）
    const setZone = (z: Zone, inRoom: boolean): void => {
      const key = `${z.id}:${inRoom}`;
      if (zoneKey === key) return;
      zoneKey = key;
      // 部屋の中では見えない屋根（ホールの日なたの形をなぞった板）を外す: 部屋の天窓からの日を遮らないように
      for (const [key, list] of gobos) for (const o of list) o.visible = key === z.id && !(inRoom && o.name === 'gobo-roof');
      const d = new THREE.Vector3(...z.sunDir).normalize();
      const [mn, mx] = inRoom ? shadowBoxOf(z.id, z.shadowBox) : z.shadowBox;
      const c = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
      sun.target.position.copy(c);
      sun.position.copy(c).addScaledVector(d, -80);
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      const cam = sun.shadow.camera;
      cam.position.copy(sun.position);
      cam.lookAt(c);
      cam.updateMatrixWorld();
      const inv = cam.matrixWorldInverse;
      const bb = new THREE.Box3();
      for (let i = 0; i < 8; i++) bb.expandByPoint(new THREE.Vector3(i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] : mn[1], i & 4 ? mx[2] : mn[2]).applyMatrix4(inv));
      cam.left = bb.min.x;
      cam.right = bb.max.x;
      cam.bottom = bb.min.y;
      cam.top = bb.max.y;
      cam.near = Math.max(0.1, -bb.max.z - 1);
      cam.far = -bb.min.z + 1;
      cam.updateProjectionMatrix();
      ctx.updateShadows();
      water.set(z.water);
    };

    const built: BuiltScene = {
      root,
      spawn: { pos: [0, 0.15, 0], yaw: 0.021 },
      staticShadows: true,
      styleZones: [
        ...ROOMS.filter((r) => ZONES[r.zone]).map((r) => ({ min: [r.rect[0] - 0.15, r.floor - 0.5, r.rect[1] - 0.15] as [number, number, number], max: [r.rect[2] + 0.15, r.ceil + 0.5, r.rect[3] + 0.15] as [number, number, number], style: r.zone === 'A' ? styleARoom : ZONES[r.zone]!.style })),
        ...(Object.values(ZONES) as Zone[]).map((z) => {
          const r = HALL[z.id].rect;
          return { min: [r[0] - 0.5, -10, r[1] - 0.5] as [number, number, number], max: [r[2] + 0.5, 30, r[3] + 0.5] as [number, number, number], style: z.style };
        }),
      ],
      update(dt, _t, camera) {
        doors.update(dt, camera.position);
      },
      beforeRender(camera, o) {
        const p = camera.position;
        for (const l of lampList) {
          const bx = l.box;
          l.on = !bx || (p.x > bx[0] - 3 && p.x < bx[3] + 3 && p.y > bx[1] - 3 && p.y < bx[4] + 3 && p.z > bx[2] - 3 && p.z < bx[5] + 3);
        }
        const inRoom = inCave(p) || ROOMS.some((r) => p.x >= r.rect[0] - 0.15 && p.x <= r.rect[2] + 0.15 && p.z >= r.rect[1] - 0.15 && p.z <= r.rect[3] + 0.15 && p.y > r.floor - 0.5 && p.y < r.ceil + 0.5);
        const id = zoneAt(p) ?? 'A';
        // ホールの中のホールの材質で作った小さな空間（前室・2 階の回廊・階段室）は部屋と同じ扱い
        const inner = INNER.some((q) => p.x > q[0] && p.x < q[3] && p.y > q[1] && p.y < q[4] && p.z > q[2] && p.z < q[5]);
        setRoomShade(!(inRoom || inner) && !o?.map);
        setZone(ZONES[id] ?? ZONES.A!, inRoom || !!o?.map);
        cull(p, !!o?.map);
        water.update(sun);
      },
    };
    return built;
  },
};
