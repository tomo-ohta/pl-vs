import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../render/Style.ts';
import { Builder } from './Builder.ts';
import { HField } from './pool/hfield.ts';
import { Kit, T } from './pool/kit.ts';
import { createShaft } from './pool/shafts.ts';
import { createWater, type WaterParams } from './pool/water.ts';
import { buildZoneA, CAM_A, SUN_A } from './pool/zoneA.ts';
import { buildZoneB, CAM_B, SUN_B } from './pool/zoneB.ts';
import { buildZoneC, CAM_C, SUN_C } from './pool/zoneC.ts';
import { buildZoneD, CAM_D, SUN_D } from './pool/zoneD.ts';
import type { SceneDef } from './types.ts';

/**
 * 屋内プール（pool-0〜3）。白い正方形タイルの柱・梁の森と、その間の浅い水路。天窓からの強い日差しと、タイルの升目に沿った階段状の影。
 * 1 つの大きな建物の中に 4 つの区域（A: pool-0, B: pool-1, C: pool-2, D: pool-3）があり、歩いて行き来できる。
 * 区域ごとに視点のカメラ（view.ts の ViewCam）を持ち、物の位置・光の形は参考画像の画素からそのカメラで逆算して決める。
 * 座標: 水面 y = 0、北が -Z。タイルは 0.25 m。
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'pool',
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

/**
 * 区域: カメラがこの中にいる間の日の向きと影の範囲、水の見た目、場面の見た目（styleZones）。
 * 色は参考画像から拾った値（--sample）を手で合わせた。光と影の形は区域ごとに見えない板（kit.ts の gobo / roofGobo）で決める
 */
interface Zone {
  id: string;
  /** 区域の範囲（x0, z0, x1, z1） */
  rect: [number, number, number, number];
  /** 日の光の進む向き */
  sunDir: [number, number, number];
  /** 影のカメラが覆う箱（min, max） */
  shadowBox: [[number, number, number], [number, number, number]];
  water: Partial<WaterParams>;
  /** この区域の見た目（視点の style と同じ物） */
  style: () => StylePreset;
}

const ZONES: Zone[] = [
  {
    id: 'A',
    rect: [-24, -40, 24, 12],
    sunDir: SUN_A,
    shadowBox: [[-24, -2, -40], [24, 5, 10]],
    water: { posterNoise: 0.4, bottomLit: '#f5f5f2', absorb: [1.9, 0.7, 0.75], bottomShade: '#5a9196', wallShade: '#4e8784', deep: '#1a4a51', grout: '#c9d6c6', groutWidth: 0.008, waveAmp: 0.05, waveScale: 0.9, distort: 0.006, caustics: 0.25, r0: 0.09, reflGain: 1, reflTint: '#dffcfc', patch: [-5.75, -9.5, -2.5, -4.5], patchAmount: 1, patchThreshold: 0.1, patchScale: 0.3, aniso: 2.5, sunGain: 1.0 },
    style: () => styleA,
  },
  {
    id: 'B',
    rect: [26, -90, 94, 12],
    sunDir: SUN_B,
    shadowBox: [[30, -2, -70], [110, 9, 12]],
    water: { bottomLit: '#fbfcfb', bottomShade: '#18545e', wallShade: '#6aa7a0', wallLit: 0, grout: '#a9d5cc', groutWidth: 0.02, absorb: [1.5, 0.28, 0.42], deep: '#154f5a', patch: [59.75, -4.25, 63.25, -2.0], patchAmount: 0, patchThreshold: 0.2, patchScale: 0.7, r0: 0.2, reflGain: 0.8, reflTint: '#b5e4e0', posterize: 6, posterNoise: 0.15, reflPosterize: 4, waveAmp: 0.05, waveScale: 0.8, waveQuant: 0, distort: 0.006, caustics: 0.0, aniso: 2, litHoles: [1, -0.35, 2.8, 0.012], reflKey: [0.9, 0.5], reflOver: [1, 0.05], reflRect: [56, -7.5, 59.8, -1.5] },
    style: () => styleB,
  },
  {
    id: 'C',
    rect: [-94, -70, -26, 12],
    sunDir: SUN_C,
    shadowBox: [[-90, -2, -55], [-38, 10, 10]],
    water: { bottomLit: '#fbfdff', bottomShade: '#0c5c68', wallShade: '#0b5a66', wallLit: 0, grout: '#a6dccd', groutWidth: 0.012, absorb: [1.25, 0.14, 0.32], deep: '#08505c', r0: 0.03, reflGain: 0.9, reflTint: '#6cc4c8', reflKey: [0.9, 0.8], posterize: 6, posterNoise: 0.3, reflPosterize: 3, waveAmp: 0.04, waveScale: 0.4, waveQuant: 0, distort: 0.01, aniso: 3, caustics: 0.0 },
    style: () => styleC,
  },
  {
    id: 'D',
    rect: [-24, -110, 24, -42],
    sunDir: SUN_D,
    shadowBox: [[-16, -2, -100], [16, 10, -54]],
    water: { bottomLit: '#fbfdff', bottomShade: '#eef6f2', wallShade: '#2a6a6c', wallLit: 0, grout: '#b9d8cc', groutWidth: 0.012, absorb: [1.6, 0.36, 0.56], deep: '#1a5c62', r0: 0.05, reflGain: 0.6, reflTint: '#b4e2d6', posterize: 7, posterNoise: 0.25, reflPosterize: 5, waveAmp: 0.06, waveScale: 0.6, waveQuant: 0, distort: 0.03, caustics: 0.0, aniso: 4, foam: 1, foamWidth: 0.6, foamColor: '#f3f4e6', reflKey: [0.85, 0.5], bottomWarp: [1.2, 0.5] },
    style: () => styleD,
  },
];

/** pool-3: 平らな色面。クリーム色の壁と青緑の陰 */
const styleD = makeStyle(style, {
  name: 'pool-3',
  fog: { horizon: '#89a59d', zenith: '#b4ccc6', ground: '#89a59d', density: 0.01, heightFalloff: 0, baseHeight: 0, start: 5, max: 0.6, steps: 0, extinction: [1.1, 1.0, 1.0] },
  toon: { thresholds: [1.4, 0.6, 0.3] },
  post: { grade: { exposure: 1, lift: -0.03, gamma: 0.983, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 }, diffusion: { amount: 0.247, threshold: 0.85, radius: 0.6 }, kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1, scale: 0.5 } },
});

/** pool-2: 明るい天窓、手前は明るい水色、右は深い青緑 */
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

/** pool-0: 4 枚の中で写実寄り。影の縁は升目に丸めない */
const styleA = makeStyle(style, {
  name: 'pool-0',
  toon: { thresholds: [1.3, 0.72, 0.3] },
  shadowQuant: 0,
  post: { diffusion: { amount: 0.367, threshold: 0.75, radius: 0.8 }, grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1.12, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 } },
  fog: { horizon: '#87b0a8', zenith: '#eef4e8', ground: '#87b0a8', density: 0.007, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.6, steps: 0, extinction: [1.15, 1.0, 1.0] },
});

/** pool-1: 青緑が強く、くっきり（霧は薄い）。梁の下面は水からの照り返しで 1 段明るく */
const styleB = makeStyle(style, {
  name: 'pool-1',
  fog: { horizon: '#8cc2c8', zenith: '#a9d6d3', ground: '#8cc2c8', density: 0.007, heightFalloff: 0, baseHeight: 0, start: 12, max: 0.7, steps: 0, extinction: [1.2, 1.0, 0.95] },
  toon: { thresholds: [1.3, 0.72, 0.3], bounce: 0.3 },
  post: { grade: { exposure: 1, lift: 0, gamma: 1.075, gain: 0.983, saturation: 0.95, hue: 0, tint: [-0.002, 0], posterize: 0, vignette: 0, grain: 0 }, diffusion: { amount: 0.21, threshold: 0.9, radius: 0.6 } },
});

export const pool: SceneDef = {
  id: 'pool',
  label: '屋内プール',
  style,
  sky: { clouds: 0 },
  views: [
    { id: 'pool-0', label: '通路から長い水路を見る', ...CAM_A.def(0, 0), style: styleA },
    { id: 'pool-1', label: '水の中から柱の森を斜めに見る', ...CAM_B.def(60, 0), style: styleB },
    { id: 'pool-2', label: '低い通路から大きなプールを見る', ...CAM_C.def(-70, 0), style: styleC },
    { id: 'pool-3', label: '水の中から段々のアーチの奥のトンネルを見る', ...CAM_D.def(0, -60), style: styleD },
  ],
  build(ctx) {
    const b = new Builder(ctx);
    const m = ctx.mat;
    const hf = new HField(-110, -130, 110, 40, T, -0.45);
    const kit = new Kit(b, hf);
    const tiles = (grout: string) => ({ size: T, line: 0.014, color: grout, jitter: 0.025 });

    // 区域 A の材質（pool-0 の色）
    const zA = {
      deck: m({ color: '#e5f1da', hi: '#e8eedf', shade: '#4d7b78', dark: '#3b6a6a', tiles: tiles('#9fb0a2') }),
      col: m({ color: '#e7ebdc', hi: '#f5f5f1', shade: '#9db6a8', dark: '#5b8a85', tiles: { size: 2 * T, line: 0.01, color: '#d3dccd', jitter: 0.015, broken: 0.35 } }),
      ped: m({ name: 'a-ped', color: '#e3ebd9', hi: '#e8eedf', shade: '#47706f', dark: '#416a6a', tiles: { size: 2 * T, line: 0.01, color: '#d3dccd', jitter: 0.015, broken: 0.35 } }),
      deckDeep: m({ color: '#c5ccbc', hi: '#e8eedf', shade: '#1f494b', dark: '#274f53', tiles: tiles('#9fb0a2') }),
      colDeep: m({ color: '#dfe7d9', hi: '#eef2e3', shade: '#264b4f', dark: '#244449', tiles: { size: 2 * T, line: 0.01, color: '#c3cfc0', jitter: 0.015, broken: 0.35 } }),
      beamDeep: m({ color: '#b2baaa', hi: '#e8eedf', shade: '#385d5b', dark: '#345658', tiles: { size: 2 * T, line: 0.01, color: '#c3cfc0', jitter: 0.015, broken: 0.35 } }),
      beam: m({ name: 'a-beam', color: '#eef3e7', hi: '#e8eedf', shade: '#86a592', dark: '#89ac9f', tiles: { size: 2 * T, line: 0.01, color: '#c3cfc0', jitter: 0.015, broken: 0.35 } }),
      wall: m({ color: '#e3eadb', hi: '#eef2e3', shade: '#7aa39c', dark: '#4f7d79', tiles: { size: 2 * T, line: 0.01, color: '#c3cfc0', jitter: 0.015, broken: 0.35 } }),
      farWall: m({ color: '#7fa39d', unlit: true, tiles: { size: 2 * T, line: 0.01, color: '#759891' } }),
      glow: m({ color: '#bcd2c8', unlit: true }),
      dark: m({ color: '#2c5356', unlit: true }),
      bar: m({ color: '#425f60', shade: '#425f60', dark: '#2f4c4f', hi: '#425f60' }),
    };
    buildZoneA(kit, zA);

    // 区域 B（pool-1）は材質も区域のファイルで作る
    buildZoneB(kit, 60, 0);

    // 区域 C（pool-2）
    buildZoneC(kit, -70, 0);

    // 区域 D の材質（pool-3 の色）
    const tD = (grout: string) => ({ size: T, line: 0.012, color: grout, jitter: 0.02, broken: 0.1 });
    const zD = {
      wall: m({ color: '#efebd9', hi: '#f2f1e4', shade: '#8ea392', dark: '#63857c', tiles: tD('#d4d6c6') }),
      inner: m({ color: '#edf1e1', hi: '#e9eadb', shade: '#829989', dark: '#678f8e', tiles: tD('#c3cabb') }),
      roomPillar: m({ color: '#213e40', unlit: true, tiles: { size: T, line: 0.01, color: '#334d50' } }),
      side: m({ color: '#8ca18f', unlit: true, tiles: { size: T, line: 0.01, color: '#86998a' } }),
      dark: m({ color: '#3f6673', unlit: true, noFog: true }),
      shadow: m({ color: '#1f4248', unlit: true, tiles: { size: T, line: 0.01, color: '#1f4146' } }),
      glass: m({ color: '#748c8f', shade: '#4c6669', dark: '#425a5e', hi: '#5a7477' }),
      sky: m({ color: '#eaf0ef', unlit: true, noFog: true, line: 0 }),
      reveal: m({ color: '#6b8d8e', unlit: true }),
      pane: m({ color: '#eef4f1', unlit: true, noFog: true, line: 0, side: THREE.BackSide }),
    };
    buildZoneD(kit, zD, 0, -60);

    // 水面（映り込み 1 枚）
    const refl = ctx.addReflector({ x: 0, y: 0, z: 0 }, undefined, 0.5);
    const water = createWater(hf, refl, [-110, -130, 110, 40]);
    b.root.add(water.mesh);

    // 光の筋（区域 A の天窓から）
    const sunA = new THREE.Vector3(...ZONES[0].sunDir);
    for (const o of [
      { rect: [5, -12.25, 12, -6.25] as [number, number, number, number], y: 4.4, length: 6, color: '#f4f8ea', intensity: 0.07 },
      { rect: [0.5, -30, 2.0, -6.25] as [number, number, number, number], y: 4.4, length: 5, color: '#f4f8ea', intensity: 0.04, stripe: 0.75, stripeAxis: 'z' as const },
    ]) {
      const sh = createShaft(o, sunA);
      b.root.add(sh);
      refl.hide.push(sh);
    }
    hf.addColliders(ctx.colliders, 0.55, -0.66);

    // 光: 日（区域ごとに向きと影の範囲を合わせる）+ 空の明るさ
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    b.root.add(sun, sun.target);
    b.root.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, Math.PI * 0.5));
    ctx.setSun(sun);

    let zone: Zone | null = null;
    const setZone = (z: Zone): void => {
      if (zone === z) return;
      zone = z;
      const d = new THREE.Vector3(...z.sunDir).normalize();
      const [mn, mx] = z.shadowBox;
      const c = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
      sun.target.position.copy(c);
      sun.position.copy(c).addScaledVector(d, -80);
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      // 影のカメラを箱にぴったり合わせる
      const cam = sun.shadow.camera;
      cam.position.copy(sun.position);
      cam.lookAt(c);
      cam.updateMatrixWorld();
      const inv = cam.matrixWorldInverse;
      const bb = new THREE.Box3();
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Vector3(i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] : mn[1], i & 4 ? mx[2] : mn[2]).applyMatrix4(inv);
        bb.expandByPoint(p);
      }
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
    const frame = (camera: THREE.Camera): void => {
      const p = camera.position;
      const z = ZONES.find((q) => p.x >= q.rect[0] && p.x <= q.rect[2] && p.z >= q.rect[1] && p.z <= q.rect[3]) ?? ZONES[0];
      setZone(z);
      water.update(sun);
    };
    b.finalize();
    return {
      root: b.root,
      spawn: { pos: [0, 0.15, 0], yaw: 0.021 },
      // 動かない場面なので影の地図は区域を切り替えたときだけ描き直す（毎フレーム描くと 4096 の影で 6 ms ほどかかる）
      staticShadows: true,
      beforeRender: (camera) => frame(camera),
      styleZones: ZONES.map((z) => ({ min: [z.rect[0], -10, z.rect[1]] as [number, number, number], max: [z.rect[2], 30, z.rect[3]] as [number, number, number], style: z.style() })),
    };
  },
};
