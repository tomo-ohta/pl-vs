import { DEFAULT_STYLE, makeStyle } from '../render/Style.ts';
import type { SceneDef } from '../scenes/types.ts';
import { buildPlanetarium } from './planetarium/build.ts';
import { VIEW } from './planetarium/layout.ts';
import { plan } from './planetarium/plan.ts';

/**
 * プラネタリウム（大ドーム劇場）。参考画像 planetarium-0（1 枚）を、「現実にあったらどういう建物か」の間取り図から作った版。
 * - 配置: planetarium/layout.ts（数値・参考画像の視点）・plan.ts（間取り図・判断の記録）・profile.ts（床と段床の高さ）
 * - 形: hall.ts（舞台・平土間・段床・ドラムの壁・桟敷・演台・投影室の塔）・dome.ts（投影ドームの地図の焼き込み・リブ）・
 *       seats.ts（客席の椅子）・backhouse.ts（舞台の裏の塔と前室・操作卓など）・outer.ts（ドラムのまわりの回廊・玄関ホール）
 * - 光: beam.ts（照明の輪のスポットの光の筋）・lights.ts（壁の点・回廊の灯り・星の天井と星の壁）・build.ts（照明）
 * - 写っていない所の作り込み: zones.ts（回廊のベイの種類: 展示・休む・出入口）・foyer.ts（ベイごとの床・天井・壁・展示・光）・
 *   hallfit.ts（客席の中のカメラに写らない所: 木の格子の壁・壁付け灯・通路の灯り）・dress.ts（梁・壁柱・玄関ホール）・
 *   fx.ts（器具ごとの光だまり・壁の光の山形）・panels.ts（図の電飾の板の絵）。小物: planetarium/props/（見本帳 props/gallery.ts）
 * 描き方は半写実（toon 0 + 霧 + 光の筋 + ブルーム）。手順と数値は docs/stages/planetarium.md
 */
const style = makeStyle(DEFAULT_STYLE, {
  name: 'planetarium',
  background: '#07141c',
  fog: {
    horizon: '#0d2f40',
    zenith: '#10354a',
    ground: '#091e2a',
    density: 0.016,
    heightFalloff: 0,
    baseHeight: 0,
    start: 3,
    max: 0.9,
    steps: 0,
    extinction: [1.25, 1.0, 0.9],
  },
  toon: { amount: 0, thresholds: [1.5, 0.72, 0.3], soft: 0.05, noiseAmp: 0, noiseScale: 1, shade: [0.8, 0.95, 6], dark: [0.6, 1, 10], hi: [1.05, 0.8, -2] },
  post: {
    bloom: { strength: 0.5, threshold: 0.85, radius: 0.55 },
    diffusion: { amount: 0.08, threshold: 0.5, radius: 0.6 },
    lines: { enabled: false, color: '#06141c', width: 1, depth: 0.1, normal: 0.6, id: 0, breakup: 0.3, fadeFar: 30, opacity: 0.4 },
    kuwahara: { enabled: false, radius: 4, sharpness: 8, aniso: 1 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

export const planetarium: SceneDef = {
  id: 'planetarium',
  label: 'プラネタリウム（大ドーム劇場）',
  style,
  plan,
  sky: false,
  views: [{ id: 'planetarium-0', label: '後ろの段の横の通路から舞台と投影ドーム', eye: VIEW.eye, yaw: VIEW.yaw, pitch: VIEW.pitch, fov: VIEW.fov }],
  build: (ctx) => buildPlanetarium(ctx),
};
