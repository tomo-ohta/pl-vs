import type * as THREE from 'three';
import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import type { SceneDef } from '../scenes/types.ts';
import { buildStation } from './station/build.ts';
import { D, SHED } from './station/layout.ts';
import { plan } from './station/plan.ts';

/**
 * 霧の駅（建築版）。電化区間の終点で非電化の支線へ乗り換える地方の分岐駅を、間取り図（station/plan.ts）から作った版。
 * 見た目（材質・霧・映り込み・空気の色）は元の版（src/scenes/station）を station/ に写して使う。
 * - 配置: station/layout.ts（数値）・station/plan.ts（間取り図・判断の記録）
 * - 形: station/build.ts（ホーム・ベンチ）・canopies.ts（上屋）・dplat.ts と frame.ts（D。元の版の形を南北に回す）・tracks.ts（線路・架線・信号・遠景）
 *       building.ts（駅舎・地下道）・site.ts（広場・道・踏切・旧踏切道・ホームの端・野原・農家）・signs.ts（掲示物の絵を 1 枚にまとめる）
 * - 材質: station/mat.ts（明るさ = 屋根に隠されない空の割合）・mats.ts（色の表）・region.ts（場所ごとにまとめる・色だけ違う材質を頂点色に）
 * - 空気の色: station/looks-data.ts（視点ごとの値をカメラの位置で混ぜる）
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'station-arch',
  background: '#bdf5e8',
  fog: {
    horizon: '#bdf6e7',
    zenith: '#d2fcee',
    ground: '#8fd3c8',
    density: 0.024,
    heightFalloff: 0,
    baseHeight: -1,
    start: 2,
    max: 0.985,
    steps: 0,
    extinction: [0.28, 1.0, 1.3],
  },
  toon: { amount: 0, thresholds: [1.5, 0.72, 0.3], soft: 0.05, noiseAmp: 0, noiseScale: 1, shade: [0.8, 0.95, 6], dark: [0.6, 1, 10], hi: [1.05, 0.8, -2] },
  post: {
    bloom: { strength: 0.04, threshold: 1.0, radius: 0.15 },
    diffusion: { amount: 0.12, threshold: 0.75, radius: 0.15 },
    lines: { enabled: false, color: '#173036', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.4 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

/** 大屋根の下（station-1）: 霧のにじみを弱く、右（東）は光源から遠く暗い（パラ） */
const GRAD1 = { color: '#c0c8cc', amount: 0.4, p0: [1, 0.4] as [number, number], p1: [0.65, 0.4] as [number, number], blend: 'mul' as const };
const style1 = makeStyle(style, { name: 'station-arch-1', post: { diffusion: { amount: 0.0, threshold: 0.75, radius: 0.15 }, gradients: [GRAD1] } });
/** D の上屋の下（station-0）も、細い柱が霧ににじんで明るくならないように */
const style0 = makeStyle(style, { name: 'station-arch-0', post: { diffusion: { amount: 0.0, threshold: 0.75, radius: 0.15 } } });
/** 歩いているときの見た目（大屋根の下・D の上屋の下に近いほど、その視点の上書きへ滑らかに寄せる） */
const walk = makeStyle(style, { name: 'station-arch-walk', post: { gradients: [{ ...GRAD1, amount: 0 }] } });

/** 箱の中で 1、外へ fade m で 0 へ */
function inBox(p: THREE.Vector3, x0: number, z0: number, x1: number, z1: number, fade: number): number {
  const dx = Math.max(x0 - p.x, 0, p.x - x1);
  const dz = Math.max(z0 - p.z, 0, p.z - z1);
  const d = Math.hypot(dx, dz);
  const t = Math.min(Math.max(1 - d / fade, 0), 1);
  return t * t * (3 - 2 * t);
}

export const station: SceneDef = {
  id: 'station',
  label: '霧の駅（建築版）',
  style,
  plan,
  sky: false,
  views: [
    { id: 'station-0', label: 'D（0 番線）の上屋の下から南の野原', eye: [D.x, 1.55, D.z1 - 15.7], yaw: Math.PI, pitch: 0.0327, fov: 27.7, style: style0 },
    { id: 'station-1', label: '大屋根の下から北', eye: [0, 1.55, 0], yaw: -0.016, pitch: 0.0086, fov: 53.3, style: style1 },
    { id: 'station-2', label: '旧踏切道の行き止まりから B', eye: [-23.7, 1.05, 51.4], yaw: -Math.PI / 2, pitch: 0.071, fov: 32.3 },
    { id: 'station-3', label: '中央柱の上屋から南（頭端の B・C）', eye: [0, 1.55, 12], yaw: Math.PI, pitch: 0.026, roll: 0.007, fov: 32.5 },
  ],
  build(ctx) {
    const built = buildStation(ctx);
    built.styleZones = [{ min: [-2000, -50, -2000], max: [2000, 200, 2000], style: walk }];
    const prev = built.beforeRender;
    built.beforeRender = (camera) => {
      prev?.(camera);
      const p = camera.position;
      // 大屋根の下（線路の上まで）と、D の上屋の下
      const w1 = inBox(p, -SHED.half, SHED.z0, SHED.half, SHED.z1 - 6, 5);
      const w0 = inBox(p, D.x - D.half, D.z1 - 30, D.x + D.half, D.z1, 4);
      walk.post.diffusion.amount = 0.12 * (1 - Math.max(w0, w1));
      walk.post.gradients[0].amount = 0.4 * w1;
    };
    return built;
  },
};
