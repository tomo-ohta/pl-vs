import * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../render/Style.ts';
import { Builder, type V3 } from './Builder.ts';
import { Atlas, Seg, type ViewCam } from './corridor/kit.ts';
import { flat } from './corridor/props.ts';
import { buildSeg0, CAM0 } from './corridor/seg0.ts';
import { buildSeg1, CAM1 } from './corridor/seg1.ts';
import { buildSeg2, CAM2 } from './corridor/seg2.ts';
import { buildSeg3, CAM3 } from './corridor/seg3.ts';
import type { SceneDef, StyleZone, ViewDef } from './types.ts';

/**
 * 病院の廊下（corridor-0〜3）。平らな色面のベクターイラスト風（セル調）。
 * 4 つの廊下（参考画像 1 枚に 1 つ）を手前の横の廊下でつなぐ（くし形の階）。各廊下は奥が -Z、手前の端（z = 2.5）で横の廊下へ出る。
 * 廊下ごとの座標は corridor/seg*.ts（目の真下が原点）。参考画像の画素から面の上の点を逆算して形を決めている（ViewCam）。
 *
 * 照明は「どの指定色を塗るか」を選ぶためだけに使う:
 * - 半球光は上から暗く・下から明るく → 床（上向き）は暗め、壁は中くらい、天井は明るめ
 * - 平行光（真上に近い）が床と物の上面だけを日なたにする
 * → 床と上面は「日なた / 影」の 2 色、壁・天井は常に日なたの色（color）。影を落とすのは選んだ小物だけ。
 * 描いた影・床の光・幅木の影は貼り絵（corridor/decal.ts、縁がちぎれる）。
 */

// 照明の倍率（色指定に対する明るさ）
const SKY_F = 0.45;
const GROUND_F = 1.45;
const SUN_F = 0.8;

const base = makeStyle(DEFAULT_STYLE, {
  name: 'corridor',
  background: '#c9d6bd',
  fog: { horizon: '#d6e2c6', zenith: '#d6e2c6', density: 0.0, heightFalloff: 0, baseHeight: 0, start: 6, max: 0.4, steps: 0 },
  toon: { amount: 1, thresholds: [2.4, 0.72, 0.22], soft: 0.01, noiseAmp: 0.06, noiseScale: 1.6, shade: [0.8, 0.95, 6], dark: [0.62, 0.95, 12], hi: [1.06, 0.7, -4] },
  shadowJitter: 0.035,
  post: {
    bloom: { strength: 0, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0, threshold: 0.8, radius: 0.6 },
    lines: { enabled: true, color: '#2e3b40', width: 1, depth: 0.06, normal: 0.5, id: 0.0, breakup: 0.25, fadeFar: 24, opacity: 0.85 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1, scale: 0.5 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

// 線: 法線の差の線は MSAA の境で途切れて点線になるので、ほぼ使わず深度の段差（物の外形）で引く
const style0 = makeStyle(base, { name: 'corridor-0', post: { lines: { enabled: true, color: '#2e3b40', width: 1, depth: 0.05, normal: 0.6, id: 0, breakup: 0.06, fadeFar: 24, opacity: 0.75 } } });
const style1 = makeStyle(base, { name: 'corridor-1', post: { lines: { enabled: true, color: '#3a4a46', width: 1, depth: 0.08, normal: 0.75, id: 0, breakup: 0.3, fadeFar: 14, opacity: 0.5 } } });
const style2 = makeStyle(base, { name: 'corridor-2', post: { lines: { enabled: true, color: '#2a4044', width: 1.3, depth: 0.05, normal: 0.6, id: 0, breakup: 0.08, fadeFar: 26, opacity: 0.95 } } });
const style3 = makeStyle(base, { name: 'corridor-3', post: { lines: { enabled: true, color: '#1d2e33', width: 1, depth: 0.08, normal: 0.75, id: 0, breakup: 0.3, fadeFar: 16, opacity: 0.6 } } });

// 区域の原点（くし形: X に並べる）
const ORIGIN: V3[] = [
  [0, 0, 0],
  [16, 0, 0],
  [32, 0, 0],
  [48, 0, 0],
];
const Z0 = 2.5; // 廊下の手前の端（横の廊下との境）
// 廊下の手前の口の左右（区域の座標の x、壁の外側まで）
const MOUTH: [number, number][] = [
  [-1.78, 2.6],
  [-2.1, 1.75],
  [-1.68, 1.73],
  [-1.42, 1.47],
];

const CAMS: ViewCam[] = [CAM0, CAM1, CAM2, CAM3];
const STYLES: StylePreset[] = [style0, style1, style2, style3];
const LABELS = ['掲示板とカート', '2 色の影と窓の光', '格子の天井と白いポール', '青緑の壁と医療カート'];

const views: ViewDef[] = CAMS.map((c, i) => ({
  id: `corridor-${i}`,
  label: LABELS[i],
  eye: [ORIGIN[i][0] + c.eye[0], c.eye[1], ORIGIN[i][2] + c.eye[2]],
  yaw: c.yaw,
  pitch: c.pitch,
  roll: c.roll,
  fov: c.fov,
  style: STYLES[i],
}));

/** 横の廊下（4 つの廊下の手前をつなぐ）と、各廊下の手前の閉じ */
function buildHall(b: Builder, ctx: Parameters<SceneDef['build']>[0]): void {
  const m = (c: string, s?: string): THREE.MeshStandardMaterial => ctx.mat({ ...flat(c, s), line: 0.4 });
  const floor = m('#d9e2c6', '#b3bea3');
  const wall = m('#c4cfb0');
  const ceil = m('#9fb19f');
  const base0 = m('#3f5159');
  const x0 = -5;
  const x1 = 53;
  const z1 = Z0 + 3.2;
  const H = 2.75;
  b.boxMM(floor, [x0, -0.1, Z0], [x1, 0, z1], { collide: true, shadow: 'receive' });
  b.boxMM(ceil, [x0, H, Z0], [x1, H + 0.1, z1], { shadow: false });
  b.boxMM(wall, [x0, 0, z1], [x1, H, z1 + 0.3], { collide: true, shadow: 'receive' });
  b.boxMM(wall, [x0 - 0.3, 0, Z0], [x0, H, z1], { collide: true, shadow: 'receive' });
  b.boxMM(wall, [x1, 0, Z0], [x1 + 0.3, H, z1], { collide: true, shadow: 'receive' });
  b.boxMM(base0, [x0, 0, z1 - 0.015], [x1, 0.12, z1], { shadow: 'receive' });
  // 手前の壁（廊下の口の間）と口の上の垂れ壁
  let x = x0;
  ORIGIN.forEach((o, i) => {
    const [l, r] = MOUTH[i];
    b.boxMM(wall, [x, 0, Z0 - 0.3], [o[0] + l, 3.2, Z0], { collide: true, shadow: 'receive' });
    b.boxMM(wall, [o[0] + l, 2.5, Z0 - 0.3], [o[0] + r, 3.2, Z0], { shadow: 'receive' });
    x = o[0] + r;
  });
  b.boxMM(wall, [x, 0, Z0 - 0.3], [x1, 3.2, Z0], { collide: true, shadow: 'receive' });
  // 灯り
  const lens = ctx.mat({ color: '#f4fae6', unlit: true, line: 0.5 });
  for (let lx = x0 + 3; lx < x1; lx += 5) b.boxMM(lens, [lx - 0.7, H - 0.04, Z0 + 1.45], [lx + 0.7, H, Z0 + 1.75], { shadow: false });
}

export const corridor: SceneDef = {
  id: 'corridor',
  label: '病院の廊下',
  style: base,
  sky: false,
  views,
  build(ctx) {
    const b = new Builder(ctx);
    const atlas = new Atlas(2048);
    // 掲示物（紙の図柄は 1 枚のキャンバスにまとめる。色はキャンバスの色そのまま）
    const paperMat = ctx.mat({ color: '#ffffff', shade: '#c4c8bc', dark: '#9da396', hi: '#ffffff', map: atlas.tex, line: 0.7 });

    buildSeg0(new Seg(b, ctx, ORIGIN[0], CAM0), atlas, paperMat);
    buildSeg1(new Seg(b, ctx, ORIGIN[1], CAM1), atlas, paperMat);
    buildSeg2(new Seg(b, ctx, ORIGIN[2], CAM2), atlas, paperMat);
    buildSeg3(new Seg(b, ctx, ORIGIN[3], CAM3), atlas, paperMat);
    buildHall(b, ctx);
    atlas.tex.needsUpdate = true;

    // ---- 照明 ----
    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI);
    hemi.color.setRGB(SKY_F, SKY_F, SKY_F);
    hemi.groundColor.setRGB(GROUND_F, GROUND_F, GROUND_F);
    b.root.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, SUN_F * Math.PI);
    const cx = 24;
    sun.position.set(cx - 0.35 * 40, 40, -7 - 0.25 * 40);
    sun.target.position.set(cx, 0, -7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 16, bottom: -16, near: 1, far: 80 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    b.root.add(sun, sun.target);
    ctx.setSun(sun);

    b.finalize();

    // 歩いて別の廊下へ入ったら、その廊下の見た目（線など）に切り替える。横の廊下は既定の見た目
    const styleZones: StyleZone[] = ORIGIN.map((o, i) => ({ min: [o[0] - 6, -1, -40], max: [o[0] + 6, 5, Z0], style: STYLES[i] }));
    styleZones.push({ min: [-10, -1, Z0], max: [60, 5, 10], style: base });
    const v0 = views[0];
    return {
      root: b.root,
      spawn: { pos: [v0.eye[0], 0, v0.eye[2]], yaw: v0.yaw, pitch: v0.pitch },
      styleZones,
    };
  },
};
