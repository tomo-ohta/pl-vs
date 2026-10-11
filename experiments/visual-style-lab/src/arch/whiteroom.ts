import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../render/Style.ts';
import { Builder } from '../scenes/Builder.ts';
import type { BuiltScene, SceneDef, StyleZone, ViewDef } from '../scenes/types.ts';
import { buildCourtA } from './whiteroom/courtA.ts';
import { buildCourtB } from './whiteroom/courtB.ts';
import { buildCourtC } from './whiteroom/courtC.ts';
import { SUN_DIR, V0, V1, V2 } from './whiteroom/layout.ts';
import { Doors } from './whiteroom/doors.ts';
import { dressA, dressC } from './whiteroom/dress.ts';
import { Mats } from './whiteroom/mats.ts';
import { buildOutside } from './whiteroom/outside.ts';
import { whiteroomPlan } from './whiteroom/plan.ts';
import { wrPropMats } from './whiteroom/props/mats.ts';
import { ShiftLens, shiftFov, type ShiftView } from './whiteroom/shiftcam.ts';
import { Later } from './whiteroom/seen.ts';
import { createWrSky, type SkyLook } from './whiteroom/sky.ts';

/**
 * 白いコンクリートの中庭（whiteroom）。参考画像 public/refs/whiteroom-0〜2.jpg（1456×816）。
 * 山の上の修道院（寄宿の学びの家）の 3 つの中庭を 1 つの建物にした（間取り図は whiteroom/plan.ts、寸法は whiteroom/layout.ts）。
 * 見た目は「段落とし + 筆の跡」: 色彩設計の材質（日なた・陰の色を参考画像から）に、ワールド座標の四角い筆の跡と濃い点を足す（whiteroom/brush.ts）。
 * 参考画像は縦の線が平行のまま見下ろす建築の描き方なので、視点はあおりレンズ（whiteroom/shiftcam.ts）。
 */

// ---------------------------------------------------------------- 見た目（中庭ごと）

const TOON = { amount: 1, thresholds: [2.6, 0.62, 0.18] as [number, number, number], soft: 0.02, noiseAmp: 0.06, noiseScale: 2.4, shade: [0.5, 0.9, 10] as [number, number, number], dark: [0.35, 0.9, 15] as [number, number, number], hi: [1.06, 0.8, -4] as [number, number, number], bounce: 0 };
const POST_BASE = {
  bloom: { strength: 0, threshold: 1.0, radius: 0.6 },
  diffusion: { amount: 0.0, threshold: 0.85, radius: 0.6 },
  lines: { enabled: true, color: '#1e302c', width: 1, depth: 0.1, normal: 0.7, id: 0, breakup: 0.5, fadeFar: 30, opacity: 0.35 },
  kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1 },
  grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0] as [number, number], posterize: 0, vignette: 0, grain: 0 },
};

const styleA = makeStyle(DEFAULT_STYLE, {
  name: 'whiteroom-A',
  background: '#d6e7dd',
  fog: { horizon: '#d2e3d8', zenith: '#d6e7dd', ground: '#c9dbcf', density: 0.0025, heightFalloff: 0, baseHeight: 0, start: 16, max: 0.6, steps: 0 },
  toon: TOON,
  post: POST_BASE,
  shadowQuant: 0,
  shadowJitter: 0.015,
});
const styleB = makeStyle(styleA, {
  name: 'whiteroom-B',
  background: '#8aaca2',
  // 霧の色 = 空の色（暗い灰青緑）。突き当たりの門の棟（37 m）より向こう（A の棟）は霧に溶けて空と同じ色になる
  fog: { horizon: '#8aaca2', zenith: '#94b3a8', ground: '#8aaca2', density: 0.12, heightFalloff: 0, baseHeight: 0, start: 38.5, max: 1.0, steps: 0 },
});
const styleC = makeStyle(styleA, {
  name: 'whiteroom-C',
  background: '#d4e3da',
  fog: { horizon: '#cfdfd5', zenith: '#d6e5dc', ground: '#cadbd0', density: 0.014, heightFalloff: 0, baseHeight: 0, start: 16, max: 0.82, steps: 0 },
});

const SKY: Record<'A' | 'B' | 'C', SkyLook> = {
  // 雲の帯は参考画像の視点の画角より上（A: 地平から 17° まで写る → sin 0.34 から、C: 2° → 同じ、B: 4° → sin 0.2 から）
  A: { horizon: '#d4e5da', zenith: '#d8e8de', stroke: '#bfd3c6', strokeAmt: 0.35, cloud: { color: '#b2c8ba', amount: 0.85, from: 0.34 } },
  B: { horizon: '#89aba1', zenith: '#94b3a8', stroke: '#7a9e94', strokeAmt: 0.5, cloud: { color: '#a9c4ba', amount: 0.7, from: 0.2 } },
  C: { horizon: '#d2e2d8', zenith: '#dbe8df', stroke: '#bfd2c6', strokeAmt: 0.35, cloud: { color: '#b2c8ba', amount: 0.85, from: 0.34 } },
};

/** 日の向き（日へ向かう単位ベクトル）と影の範囲。中庭ごとに参考画像の陰の付き方に合わせた（現実離れ。notes に記録） */
const SUN: Record<'A' | 'B' | 'C', { dir: [number, number, number]; box: [[number, number, number], [number, number, number]] }> = {
  // A: 南西の上から（高さ 60°。参考画像 0 では左の後ろ）。西の棟の面は陰、東の棟の面と北の棟の面は日なた
  A: { dir: SUN_DIR.A, box: [[-16, -0.5, -42], [18, 16, 15]] },
  // B: ほぼ真上（少し後ろ）から。庇の影は庇の真下の床に落ちる
  B: { dir: SUN_DIR.B, box: [[-17, -0.5, 13], [16, 10, 64]] },
  // C: A と同じ日（南西の上から）。西を見る参考画像 2 では前の少し左（南）からの逆光。手前の門の壁の外の面は陰
  C: { dir: SUN_DIR.C, box: [[-72, -0.5, -44], [-14, 10, 3]] },
};

/** 区域（中庭ごと）。先に書いた方が優先 */
const ZONES: { id: 'A' | 'B' | 'C'; min: [number, number, number]; max: [number, number, number] }[] = [
  // A の西の棟の 2 階のバルコニーは C を見る
  { id: 'C', min: [-17.5, 4.0, -24], max: [-14.25, 9, -16] },
  { id: 'C', min: [-80, -5, -50], max: [-14.3, 40, 10] },
  { id: 'B', min: [-20, -5, 14.0], max: [20, 40, 80] },
  { id: 'A', min: [-14.3, -5, -50], max: [20, 40, 14.0] },
];
const STYLE_OF = { A: styleA, B: styleB, C: styleC };

const SV: ShiftView[] = [V0, V1, V2];
const views: ViewDef[] = [
  { id: V0.id, label: '回廊の中庭: 目の高さで北の棟を見る', eye: V0.eye, yaw: V0.yaw, pitch: 0, fov: shiftFov(V0), style: styleA },
  { id: V1.id, label: '庇の中庭: 南の棟の 2 階から北の門を見る', eye: V1.eye, yaw: V1.yaw, pitch: 0, fov: shiftFov(V1), style: styleB },
  { id: V2.id, label: '沈んだ中庭: 西の棟の 2 階のバルコニーから見下ろす', eye: V2.eye, yaw: V2.yaw, pitch: 0, fov: shiftFov(V2), style: styleC },
];

export const whiteroom: SceneDef = {
  id: 'whiteroom',
  label: '白いコンクリートの中庭',
  style: styleA,
  sky: false,
  plan: whiteroomPlan,
  views,
  build(ctx) {
    const root = new THREE.Group();
    const m = new Mats(ctx);
    const bA = new Builder(ctx);
    const bB = new Builder(ctx);
    const bC = new Builder(ctx);
    const doors = new Doors(ctx);
    const pmA = wrPropMats(ctx, [0.55, 0.95, 8]);
    const pmC = wrPropMats(ctx, [0.72, 0.95, 8]);
    const later = new Later();
    buildCourtA(bA, m, pmA, doors);
    buildCourtB(bB, m, wrPropMats(ctx, [0.95, 1, 2]), doors);
    buildCourtC(bC, m, pmC, doors, later);
    buildOutside(bA, m);
    // 写っていない屋外の作り込み（決まりで並べ、参考画像の視点から見える物は外す）
    dressA({ b: bA, m, pm: pmA, later });
    dressC({ b: bC, m, pm: pmC, later });
    later.run(ctx.colliders);
    root.add(doors.root);
    for (const b of [bA, bB, bC]) {
      b.finalize();
      root.add(b.root);
    }

    // 光: 日（中庭ごとに向きと影の範囲）+ 空の明るさ
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.03;
    root.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(0xffffff, new THREE.Color(0.4, 0.4, 0.4), 1.25);
    root.add(hemi);
    ctx.setSun(sun);

    const sky = createWrSky(SKY.A);
    root.add(sky.mesh);

    let zone = '';
    const setZone = (id: 'A' | 'B' | 'C'): void => {
      if (zone === id) return;
      zone = id;
      const s = SUN[id];
      const d = new THREE.Vector3(...s.dir).normalize();
      const [mn, mx] = s.box;
      const c = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
      sun.target.position.copy(c);
      sun.position.copy(c).addScaledVector(d, 120);
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
      sky.set(SKY[id]);
      ctx.updateShadows();
    };
    const zoneAt = (p: THREE.Vector3): 'A' | 'B' | 'C' => {
      for (const z of ZONES) if (p.x >= z.min[0] && p.x <= z.max[0] && p.y >= z.min[1] && p.y <= z.max[1] && p.z >= z.min[2] && p.z <= z.max[2]) return z.id;
      return 'A';
    };
    setZone('A');

    const lens = new ShiftLens(SV);
    const styleZones: StyleZone[] = ZONES.map((z) => ({ min: z.min, max: z.max, style: STYLE_OF[z.id] as StylePreset }));
    const built: BuiltScene = {
      root,
      spawn: { pos: [0, 0, 0], yaw: V0.yaw },
      staticShadows: true,
      styleZones,
      update(dt, _t, camera) {
        doors.update(dt, camera.position);
      },
      beforeRender(camera, o) {
        const z = zoneAt(camera.position);
        setZone(o?.map ? 'A' : z);
        // 見えない中庭を描かない（B から C は A の棟の向こう、C から B も見えない。A の中庭と東の棟から C は西の棟の屋根の向こう。
        // 西の棟の部屋の窓・バルコニーからは見える）
        bB.root.visible = !!o?.map || z !== 'C';
        bC.root.visible = !!o?.map || (z !== 'B' && !(z === 'A' && camera.position.x > -5.0));
        lens.apply(camera);
      },
    };
    return built;
  },
};
