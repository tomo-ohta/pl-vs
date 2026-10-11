import { DEFAULT_STYLE, makeStyle, type StylePreset } from '../../render/Style.ts';

/**
 * 見た目（階ごと）。2 枚の参考画像の色調の違いを、上下の階の「水の深さ」の違いにした。
 * - deep（2 階・classroom-0）: 青い水の霞。輪郭線はほとんど無く、明るい窓が暗い室内へにじむ（ディフュージョン）
 * - shallow（3 階・classroom-1）: 青緑。輪郭は暗い墨の線（ちぎれた筋・机の縁）、色は濃い
 * 霧は室内の水の霞（奥ほど明るく淡い）。窓の外の物には目から窓までの分だけ掛ける（outside.ts）
 */

export const DEEP: StylePreset = makeStyle(DEFAULT_STYLE, {
  name: 'classroom-deep',
  background: '#1c3851',
  fog: {
    horizon: '#1c405c', zenith: '#163049', ground: '#1c3e58', density: 0.05, heightFalloff: 0, baseHeight: 0, start: 1.5, max: 0.6, steps: 0, extinction: [1.2, 1.0, 0.85],
    // 窓（南西）の方の霞が明るい（水の中で光が散る）。北の暗い壁の方は暗いまま
    glow: { color: '#3f8aae', strength: 0.9, dir: [-0.62, -0.02, -0.78], power: 3 },
  },
  toon: { amount: 1, thresholds: [1.3, 0.7, 0.3], soft: 0.02, noiseAmp: 0.08, noiseScale: 1.4, shade: [0.56, 0.72, 22], dark: [0.43, 0.66, 28], hi: [1.08, 0.75, -4] },
  shadowJitter: 0.11,
  post: {
    bloom: { strength: 0.35, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0.22, threshold: 0.55, radius: 0.75 },
    // パラ（乗算のグラデーション）: 天井の方を暗く（参考画像の天井は窓の明るさがにじまない暗い紺）
    gradients: [{ color: '#6f8aa0', amount: 0.32, p0: [0.62, 1.0], p1: [0.62, 0.62], blend: 'mul' }],
    lines: { enabled: true, color: '#12283a', width: 1, depth: 0.08, normal: 0.7, id: 0, breakup: 0.35, fadeFar: 14, opacity: 0.3 },
    kuwahara: { enabled: false, radius: 3, sharpness: 8, aniso: 1, scale: 0.5 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
});

export const SHALLOW: StylePreset = makeStyle(DEEP, {
  name: 'classroom-shallow',
  background: '#0b2d3e',
  fog: {
    horizon: '#10394c', zenith: '#0a2a3c', ground: '#0f3446', density: 0.06, heightFalloff: 0, baseHeight: 0, start: 1.2, max: 0.6, steps: 0, extinction: [1.15, 1.0, 0.9],
    glow: { color: '#2a9fb0', strength: 1.0, dir: [-0.62, 0.2, -0.76], power: 3 },
  },
  post: {
    bloom: { strength: 0.3, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0.18, threshold: 0.55, radius: 0.7 },
    // パラ: 右上（天井と奥の暗い所）を暗く・右下の床の手前を暗く
    gradients: [
      { color: '#5f7f88', amount: 0.35, p0: [1.0, 1.0], p1: [0.55, 0.55], blend: 'mul' },
      { color: '#4f6f78', amount: 0.3, p0: [0.85, 0.0], p1: [0.6, 0.35], blend: 'mul' },
    ],
    lines: { enabled: true, color: '#031a22', width: 1.25, depth: 0.06, normal: 0.55, id: 0.3, breakup: 0.15, fadeFar: 18, opacity: 0.9 },
    grade: { exposure: 1, lift: 0, gamma: 0.9, gain: 0.97, saturation: 1.0, hue: 0, tint: [0.002, -0.003], posterize: 0, vignette: 0, grain: 0 },
  },
});
