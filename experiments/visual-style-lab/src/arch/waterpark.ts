import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { Builder } from '../scenes/Builder.ts';
import type { SceneDef } from '../scenes/types.ts';
import { applyShift } from './waterpark/cam.ts';
import { bakeSky, skyCeilingMaterial } from './waterpark/ceiling.ts';
import { buildHallA, CAM_A } from './waterpark/hallA.ts';
import { buildHallB, CAM_B } from './waterpark/hallB.ts';
import { buildHallC, CAM_C } from './waterpark/hallC.ts';
import { buildHallD, CAM_D } from './waterpark/hallD.ts';
import { buildConnect, connectMats } from './waterpark/connect.ts';
import { HallKit, LampCuller } from './waterpark/hallkit.ts';
import { plan } from './waterpark/plan.ts';
import { placeProps } from './waterpark/props/place.ts';
import { hallRectW, LOCKER, PROM, PROM_CEIL, SHOWER, UPPER } from './waterpark/layout.ts';
import { matsA, matsB, matsC, matsD, skyA, skyB, skyC, skyD, skyStrip } from './waterpark/looks.ts';
import { addGloss, glossEnv } from './waterpark/mats.ts';
import { SLIDE_LOG, SLIDE_MATS } from './waterpark/slides.ts';
import { dressAll } from './waterpark/dress.ts';
import { buildExtras } from './waterpark/extras.ts';

/**
 * 地下のウォーターパーク（pools）。参考画像 public/refs/waterpark-0〜3.jpg（1232×928）。
 * 地下 2 階の屋内レジャープール。広間 A〜D（参考画像 0〜3 の視点）が東西に並び、南の通路でつながる（waterpark/plan.ts）。
 * - カメラ: あおり補正（シフト）つき（waterpark/cam.ts）。広間ごとに参考画像と同じずらし
 * - 天井: 空と積雲の絵を読み込みのときに焼く（waterpark/ceiling.ts）
 * - 床・水面: 1 枚の鏡像（床の高さ）を、床は縦の筋に、水面は揺らぎで映す（waterpark/mats.ts）
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'waterpark',
  background: '#0a2c40',
  fog: { horizon: '#2f6684', zenith: '#1d4f6c', ground: '#2f6684', density: 0.012, heightFalloff: 0, baseHeight: 0, start: 4, max: 0.5, steps: 0, extinction: [1.2, 1.0, 0.9] },
  toon: { amount: 0, thresholds: [1.35, 0.72, 0.35], soft: 0.05, noiseAmp: 0, noiseScale: 1, shade: [0.8, 0.95, 6], dark: [0.6, 1, 10], hi: [1.05, 0.8, -2] },
  post: {
    bloom: { strength: 0.6, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0.15, threshold: 0.7, radius: 0.6 },
    lines: { enabled: false, color: '#173036', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.4 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

const styleB = makeStyle(style, {
  name: 'waterpark-B',
  background: '#1d4a52',
  post: { grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1.25, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 } },
  fog: { horizon: '#5f8f96', zenith: '#3f6f78', ground: '#5f8f96', density: 0.01, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.45, steps: 0, extinction: [1.15, 1.0, 0.95] },
});

/** 環境光と天井の灯りの強さ（π に掛ける。材質の色 = 参考画像で見える色なので、合わせて 1 前後） */
const HEMI = 0.85;
const GLOSS = 0.32;

const KEY = 0.25;

/**
 * あおり補正（シフト）: 参考画像の視点の目では参考画像と同じずらし、そこから離れるほど歩くときの弱いずらし（WALK）へ。
 * 目の位置だけで決める（向きには依らない）。間取り図の真上の図（o.map）では掛けない
 */
const VIEW_SHIFT: { eye: [number, number, number]; k: number }[] = [CAM_A, CAM_B, CAM_C, CAM_D].map((c) => ({ eye: c.eye, k: c.k }));
const WALK_SHIFT = 0.14;
function shiftAt(p: THREE.Vector3): number {
  let k = WALK_SHIFT;
  for (const v of VIEW_SHIFT) {
    const d = Math.hypot(p.x - v.eye[0], p.y - v.eye[1], p.z - v.eye[2]);
    const t = Math.min(Math.max((3.0 - d) / 2.6, 0), 1);
    k = Math.max(k, WALK_SHIFT + (v.k - WALK_SHIFT) * t * t * (3 - 2 * t));
  }
  return k;
}

export const waterpark: SceneDef = {
  id: 'waterpark',
  label: '地下のウォーターパーク（pools）',
  style,
  sky: false,
  plan,
  views: [
    { id: 'waterpark-0', label: 'A スライダーの大広間: 南の端から北', ...CAM_A.def() },
    { id: 'waterpark-1', label: 'B 流れの水路の広間: アーケードの縁から北北東', ...CAM_B.def(), style: styleB },
    { id: 'waterpark-2', label: 'C 円いプールの広間: 手前の通路から北', ...CAM_C.def() },
    { id: 'waterpark-3', label: 'D 夕焼けの広間: 東の床から北', ...CAM_D.def() },
  ],
  build(ctx0) {
    SLIDE_MATS.clear();
    SLIDE_LOG.length = 0;
    // 灯りは画角に入る物だけを使う（16 個の枠を目の後ろの灯りに取られない）
    const culler = new LampCuller();
    const ctx = { ...ctx0, addLamp: (l: Parameters<typeof ctx0.addLamp>[0]) => culler.add(ctx0.addLamp(l)) };
    const b = new Builder(ctx);
    const refl = ctx.addReflector({ x: 0, y: 0, z: 0 }, undefined, 0.5);
    const hideInRefl = new Set<THREE.Material>();

    const rA = hallRectW('A');
    const mA = matsA(ctx, refl, skyCeilingMaterial(bakeSky(ctx.renderer, skyA(), rA), rA));
    const poolsA = buildHallA(new HallKit(b, ctx, 'A'), mA);
    hideInRefl.add(mA.floorMat).add(mA.waterMat);

    const rB = hallRectW('B');
    const mB = matsB(ctx, refl, skyCeilingMaterial(bakeSky(ctx.renderer, skyB(), rB), rB));
    const poolsB = buildHallB(new HallKit(b, ctx, 'B'), mB);
    for (const mm of [...mB.floorMat, ...mB.waterMat]) hideInRefl.add(mm);

    const rC = hallRectW('C');
    const mC = matsC(ctx, refl, skyCeilingMaterial(bakeSky(ctx.renderer, skyC(), rC), rC));
    const poolsC = buildHallC(new HallKit(b, ctx, 'C'), mC);
    for (const mm of [...mC.floorMat, ...mC.waterMat]) hideInRefl.add(mm);

    const rD = hallRectW('D');
    const mD = matsD(ctx, refl, skyCeilingMaterial(bakeSky(ctx.renderer, skyD(), rD), rD));
    const poolsD = buildHallD(new HallKit(b, ctx, 'D'), mD);
    for (const mm of [...mD.floorMat, ...mD.waterMat]) hideInRefl.add(mm);

    placeProps(b, ctx, { A: poolsA, B: poolsB, C: poolsC, D: poolsD });

    const mX = connectMats(ctx, refl);
    buildConnect(b, ctx, mX, new HallKit(b, ctx, 'A'));
    for (const mm of mX.floorMats) hideInRefl.add(mm);
    dressAll(b, ctx);
    buildExtras(b, ctx);
    // 通路と 2 階の観覧通路の天井にも空の絵（同じ建物の「空の天井」）
    for (const [r, y, opt] of [
      [[PROM[0], PROM[1], PROM[2], PROM[3]], PROM_CEIL - 0.02, skyStrip(PROM, 1)],
      [[UPPER[0], UPPER[1], UPPER[2], PROM[3]], 7.58, skyStrip([UPPER[0], UPPER[1], UPPER[2], PROM[3]], 2)],
      [[SHOWER[0], SHOWER[1], SHOWER[2], SHOWER[3]], 2.995, skyStrip(SHOWER, 3)],
      [[LOCKER[0], LOCKER[1], LOCKER[2], LOCKER[3]], 2.995, skyStrip(LOCKER, 4)],
    ] as [[number, number, number, number], number, ReturnType<typeof skyStrip>][]) {
      const mat = skyCeilingMaterial(bakeSky(ctx.renderer, opt, r, 32), r);
      const g = new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]);
      g.rotateX(Math.PI / 2);
      g.translate((r[0] + r[2]) / 2, y, (r[1] + r[3]) / 2);
      b.mesh(g, mat, [0, 0, 0], { shadow: false });
    }

    // 環境光は白（材質の色 = 参考画像で見える色）。下向きの面は少し暗い青灰
    // スライダーの樹脂のつや（環境の映り込み）
    const env = glossEnv(ctx.renderer);
    for (const mm of SLIDE_MATS) addGloss(mm, env, GLOSS, 0.22, 0.8);

    b.root.add(new THREE.HemisphereLight(0xffffff, 0x7f90a2, Math.PI * HEMI));
    // 天井の灯りの向き（真上より少し手前から）: 上を向く面と丸い物の頭に暖かい光とつや（影は付けない）
    const key = new THREE.DirectionalLight(0xffe2cc, Math.PI * KEY);
    key.position.set(0.3, 1, 0.45);
    b.root.add(key, key.target);
    b.finalize();
    // 映り込みに床・水面を出さない
    b.root.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh && hideInRefl.has(mm.material as THREE.Material)) refl.hide.push(mm);
    });
    return {
      root: b.root,
      spawn: { pos: [0, 0, 0], yaw: 0 },
      styleZones: [{ min: [hallRectW('B')[0] - 1, -5, hallRectW('B')[1] - 1], max: [hallRectW('B')[2] + 0.4, 30, hallRectW('B')[3] + 1], style: styleB }],
      beforeRender(camera, o) {
        if (o?.map) return;
        applyShift(camera, shiftAt(camera.position));
        culler.update(camera);
      },
    };
  },
};
