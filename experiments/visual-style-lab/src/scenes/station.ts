import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import { buildStation } from './station/build.ts';
import type { SceneDef } from './types.ts';

/**
 * 霧の駅（station-0〜3）。濃いシアンの霧の中の乗り換え駅。アニメ映画の背景のような半写実。
 * 暗い上屋と蛍光灯のにじみ、鏡のような水たまり、黄色の点字ブロック、霧に消える架線柱と野原。
 * - 配置: station/layout.ts・station/build.ts（4 つの視点は 1 つの駅の中にあり、歩いて行き来できる）
 * - 材質: station/mat.ts（場面専用。明るさ = 屋根に隠されない空の割合。霧は屋根の下で暗い）
 * - 床: station/floor.ts（点字ブロック・水たまりの映り込み。水たまりはノイズと、手で置いた形 build.ts の SHAPES_*）
 * - 野原: station/field.ts（絵の具で描いたような草地と小川）、上屋の下面の細部: station/canopy.ts
 * - 場所ごとの空気の色: station/looks-data.ts（カメラの位置で混ぜる）
 * ここの fog は濃さ（density）・始まり・上限・色ごとの減衰（extinction）だけを使う（色は looks-data.ts）。
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'station',
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

/** 視点ごとの上書き（大屋根の下の station-1 は霧のにじみを弱く） */
const style1 = makeStyle(style, {
  name: 'station-1',
  post: {
    diffusion: { amount: 0.0, threshold: 0.75, radius: 0.15 },
    // 右（東）は光源から遠く暗い（パラ）
    gradients: [{ color: '#c0c8cc', amount: 0.4, p0: [1, 0.4], p1: [0.65, 0.4], blend: 'mul' }],
  },
});
/** D の上屋の下（station-0）も、細い柱が霧ににじんで明るくならないように */
const style0 = makeStyle(style, { name: 'station-0', post: { diffusion: { amount: 0.0, threshold: 0.75, radius: 0.15 } } });

export const station: SceneDef = {
  id: 'station',
  label: '霧の駅',
  style,
  sky: false,
  views: [
    { id: 'station-0', label: '支線のホームの先端（西）', eye: [-48.3, 1.55, 0], yaw: Math.PI / 2, pitch: 0.0327, fov: 27.7, style: style0 },
    { id: 'station-1', label: '大屋根の下から北', eye: [0, 1.55, 0], yaw: -0.016, pitch: 0.0086, fov: 53.3, style: style1 },
    { id: 'station-2', label: '線路の外から小さな上屋', eye: [-23.7, 1.05, 51.4], yaw: -Math.PI / 2, pitch: 0.071, fov: 32.3 },
    { id: 'station-3', label: '中央柱の上屋から南', eye: [0, 1.55, 12], yaw: Math.PI, pitch: 0.026, roll: 0.007, fov: 32.5 },
  ],
  build(ctx) {
    const built = buildStation(ctx);
    // 歩いているときの見た目: 大屋根の下は station-1 の上書き、それ以外は場面の既定
    built.styleZones = [
      { min: [-12, -5, -13], max: [12, 8, 11.6], style: style1 },
      { min: [-70, -5, -8], max: [-26, 8, 8], style: style0 },
      { min: [-2000, -50, -2000], max: [2000, 200, 2000], style },
    ];
    return built;
  },
};
