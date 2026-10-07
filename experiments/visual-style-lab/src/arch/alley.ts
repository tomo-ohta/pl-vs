import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { Builder } from '../scenes/Builder.ts';
import type { BuiltScene, SceneDef, ViewDef } from '../scenes/types.ts';
import { Doors } from './alley/doors.ts';
import { resetDecalCache, resetDressCache } from './alley/dress.ts';
import { buildInside } from './alley/inside.ts';
import { buildLane } from './alley/lane.ts';
import { VIEW } from './alley/layout.ts';
import { buildNorth } from './alley/north.ts';
import { buildOutside, resetOutsideCache } from './alley/outside.ts';
import { resetSunCache } from './alley/sun.ts';
import { resetPaintCache } from './alley/paint.ts';
import { resetTreeCache } from './alley/tree.ts';
import { alleyPlan } from './alley/plan.ts';
import { paintEast, paintWest, sunMaskEast } from './alley/reflect.ts';
import { buildSouth } from './alley/south.ts';
import { buildEast, buildWest } from './alley/wings.ts';

/**
 * 校舎の間の通路（建築版）。都市部の高等学校の、廊下側どうしが向き合う 2 つの校舎の間の管理用の通路
 * （間取り図は alley/plan.ts、寸法は alley/layout.ts）。
 * 参考画像 alley-0 の視点は元の版と同じ。校舎の壁は本当の形（窓の穴・抱き・枠・桟・柱型・水切り）で作り、
 * 窓ガラスには元の版の壁面の絵を「映り込み」として引く（alley/glass.ts。見る位置・角度で映り込みがずれ、正面からは中の部屋が見える）。
 * 照明は使わず面ごとの色を塗る（元の版と同じ）。写っていない所は、光線で調べた日なた（alley/sun.ts）と灯りの光だまり（ctx.addLamp）で明暗を付ける。
 */

const style = makeStyle(DEFAULT_STYLE, {
  name: 'alley-arch',
  background: '#0c1d23',
  fog: { horizon: '#3d7d7f', zenith: '#5a9893', ground: '#3d7d7f', density: 0.045, heightFalloff: 0, baseHeight: 0, start: 22, max: 0.9, steps: 0 },
  post: {
    bloom: { strength: 0, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0.08, threshold: 0.75, radius: 0.6 },
    lines: { enabled: false, color: '#06141a', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.8 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

const views: ViewDef[] = [{ id: 'alley-0', label: '通路の手前から北の突き当たりを見る', eye: VIEW.eye, yaw: VIEW.yaw, pitch: VIEW.pitch, fov: VIEW.fov }];

export const alley: SceneDef = {
  id: 'alley',
  label: '校舎の間の通路（建築版）',
  style,
  // 空のドームだけを明るい淡い緑に（参考画像の明るい奥 #ccf8e3 の色。物に掛かる霧の色はそのまま）。
  // 地平線の近く（仰角 9° まで）は霧の色から移す。参考画像の視点の画角には空がほとんど写らない
  sky: { gain: 1.25, tint: '#ccf8e3', tintAmount: 0.72, horizonBlend: 0.16 },
  plan: alleyPlan,
  views,
  build(ctx) {
    // 材質の使い回しは読み込みごとに作り直す（前の読み込みの材質は片付けで捨てられている）
    resetPaintCache();
    resetTreeCache();
    resetDressCache();
    resetDecalCache();
    resetOutsideCache();
    resetSunCache();
    const b = new Builder(ctx);
    const doors = new Doors(ctx);
    buildLane(b);
    buildWest(b, paintWest(views[0]), doors);
    buildEast(b, paintEast(views[0]), sunMaskEast(views[0]));
    buildNorth(b, doors, views[0]);
    buildSouth(b, doors);
    buildInside(b, doors);
    buildOutside(b);
    b.finalize();
    const root = new THREE.Group();
    root.add(b.root, doors.root);
    // 真上の図（--plan / --top）では壁の切り口が見えるように、材質を両面にする（ふだんは表だけ）
    const sides = new Map<THREE.Material, THREE.Side>();
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !sides.has(m)) sides.set(m, m.side);
    });
    let mapMode = false;
    const built: BuiltScene = {
      root,
      spawn: { pos: [0, 0, 0], yaw: VIEW.yaw },
      update(dt, _t, camera) {
        doors.update(dt, camera.position);
      },
      beforeRender(_camera, o) {
        const want = !!o?.map;
        if (want === mapMode) return;
        mapMode = want;
        for (const [m, sd] of sides) m.side = want ? THREE.DoubleSide : sd;
      },
    };
    return built;
  },
};
