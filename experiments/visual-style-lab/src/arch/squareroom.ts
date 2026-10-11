import { DEFAULT_STYLE, makeStyle, type DeepPartial, type StylePreset } from '../render/Style.ts';
import type { SceneDef, StyleZone, ViewDef } from '../scenes/types.ts';
import { buildSquareroom } from './squareroom/build.ts';
import { Frame } from './squareroom/frame.ts';
import { VIEWS, worldView, type ViewSpec } from './squareroom/layout.ts';
import { plan } from './squareroom/plan.ts';
import { ROOMS } from './squareroom/rooms.ts';

/**
 * 立方体の大広間と水路（squareroom）。参考画像 public/refs/squareroom-0〜3.jpg（利用者の whiteroom の束）。
 * 立方体の住戸を 40〜50 m まで積み上げた打ち放しの巨大な集合体が浅い貯水池に建ち、中央の四角い水庭から 4 本の水路が風車形に出る。
 * 参考画像の 4 枚は 4 本の水路の中から、水庭を背にして外周の門を見た視点（半写実: 霧・水の映り込み・型枠の目地とセパの穴）。
 * - 配置の数値: squareroom/layout.ts（視点の消失点・画角・水路の局所の座標）
 * - 形: squareroom/canalA〜D.ts（参考画像の画素から測った塊 + 決まりで積む塊 stack.ts）・basin.ts（水庭）・rooms.ts（箱の中の部屋）
 * - 材質: squareroom/mats.ts（打ち放し・水・浸水した板石・光る開口）
 * - 空気: 水路ごとの見た目（霧の色・濃さ・門の方向のにじみ）。参考画像ごとの色調の違いを、その水路にいる間だけ使う
 * - 間取り図: squareroom/plan.ts。資料: docs/stages/squareroom.md
 */
const base = makeStyle(DEFAULT_STYLE, {
  name: 'squareroom',
  background: '#7ea8b3',
  fog: {
    horizon: '#6f9caa',
    zenith: '#a9c9d0',
    ground: '#2f4c55',
    density: 0.008,
    heightFalloff: 0,
    baseHeight: 0,
    start: 12,
    max: 0.97,
    steps: 0,
    extinction: [1.3, 1.0, 0.85],
  },
  toon: { amount: 0, thresholds: [1.5, 0.72, 0.3], soft: 0.05, noiseAmp: 0, noiseScale: 1, shade: [0.8, 0.95, 6], dark: [0.6, 1, 10], hi: [1.05, 0.8, -2] },
  post: {
    bloom: { strength: 0.25, threshold: 0.9, radius: 0.5 },
    diffusion: { amount: 0.1, threshold: 0.7, radius: 0.4 },
    lines: { enabled: false, color: '#1c2e34', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.3 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0.04, gamma: 1, gain: 0.97, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

/** 水路の先の門の方向（世界）。霧の光のにじみをその向きに */
function gateDir(v: ViewSpec, up = 0.06): [number, number, number] {
  const [x, z] = new Frame(v.frame).dir(0, -1);
  return [x, up, z];
}

const look = (v: ViewSpec, over: DeepPartial<StylePreset>): StylePreset => makeStyle(base, { name: `squareroom-${v.id}`, ...over });

/** 視点ごと（= 水路ごと）の空気 */
const NOLIFT = { ...base.post.grade, lift: 0, gain: 1 };
const S0 = look(VIEWS.v0, {
  post: { grade: NOLIFT },
  fog: { horizon: '#6c9fae', zenith: '#a9cdd5', density: 0.010, start: 6, glow: { color: '#cfe6e4', strength: 0.35, dir: gateDir(VIEWS.v0), power: 24 } },
});
const S1 = look(VIEWS.v1, {
  fog: { horizon: '#2a5d73', zenith: '#a3d5e2', density: 0.010, start: 10, glow: { color: '#d9eae2', strength: 0.15, dir: gateDir(VIEWS.v1), power: 60 } },
  post: { grade: { ...NOLIFT, saturation: 1.18 } },
});
const S2 = look(VIEWS.v2, {
  fog: { horizon: '#5a7f87', zenith: '#a9c3c7', density: 0.012, start: 16, glow: { color: '#e9e6c8', strength: 0.55, dir: gateDir(VIEWS.v2, 0.02), power: 2500 } },
  post: { grade: { ...base.post.grade, saturation: 1.15, exposure: 1.15, lift: 0.07, gain: 0.97, hue: -6 } },
});
const S3 = look(VIEWS.v3, {
  fog: { horizon: '#5b8b90', zenith: '#a7c3c0', density: 0.009, start: 18, glow: { color: '#e4ecd8', strength: 0.4, dir: gateDir(VIEWS.v3, 0.06), power: 90 } },
  post: { grade: { ...base.post.grade, saturation: 1.12, lift: 0.09, gain: 0.95 } },
});

const view = (v: ViewSpec, style: StylePreset): ViewDef => ({ id: v.id, label: v.label, ...worldView(v), style });

/** 中央の水庭とテラス・階段室など、水路の区域の外: 日陰の水路（B・D）と同じく黒を持ち上げない */
const SB = makeStyle(base, { name: 'squareroom-basin', post: { grade: NOLIFT } });
/** 箱の中の部屋: 屋内の空気は澄んでいる（霧はごく薄く、遠くから）。黒を持ち上げない */
const SR = makeStyle(base, { name: 'squareroom-room', fog: { density: 0.003, start: 25 }, post: { grade: NOLIFT } });

/** 水路の区域（世界の箱）。カメラが入るとその水路の空気にする */
const zones: StyleZone[] = [
  // 部屋（先に調べる。水路の区域と重なる部屋もある）
  ...ROOMS.map((r): StyleZone => ({ min: [r.rect[0], r.floor - 0.5, r.rect[1]], max: [r.rect[2], r.ceil, r.rect[3]], style: SR })),
  { min: [-3, -50, 18], max: [21, 200, 110], style: S0 },
  { min: [-84, -50, -8], max: [-18, 200, 26], style: S1 },
  { min: [18, -50, -26], max: [88, 200, 8], style: S2 },
  { min: [-28, -50, -128], max: [12, 200, -18], style: S3 },
  // それ以外（水庭・テラス・門の外）
  { min: [-1000, -100, -1000], max: [1000, 500, 1000], style: SB },
];

export const squareroom: SceneDef = {
  id: 'squareroom',
  label: '立方体の大広間と水路（squareroom）',
  style: base,
  plan,
  views: [view(VIEWS.v0, S0), view(VIEWS.v1, S1), view(VIEWS.v2, S2), view(VIEWS.v3, S3)],
  build: (ctx) => {
    const built = buildSquareroom(ctx);
    built.styleZones = zones;
    return built;
  },
};
