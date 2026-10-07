import * as THREE from 'three';

/**
 * 場面ごとの見た目の設定（霧・段・線・色調整）。
 * 材質のシェーダーと後処理は、ここの uniform を共有する（場面を切り替えると値だけ入れ替わる）。
 */
export interface FogSettings {
  /** 地平線の色（sRGB の 16 進） */
  horizon: string;
  /** 天頂の色 */
  zenith: string;
  /** 地面の下を見たときの色 */
  ground?: string;
  /** 濃さ（1 m あたり） */
  density: number;
  /** 高さで薄くなる割合（0 で高さに関係なし） */
  heightFalloff: number;
  /** 霧の基準の高さ */
  baseHeight: number;
  /** 霧が始まる距離 */
  start: number;
  /** 霧の上限（0〜1） */
  max: number;
  /** 霧の段数（0 でなめらか）。段の境目はノイズでずらす */
  steps: number;
  /** RGB ごとの減衰の倍率（赤を大きくすると中距離がシアンに寄る）。既定 [1,1,1] */
  extinction?: [number, number, number];
  /** 霧の光源方向のにじみ（色・強さ・方向） */
  glow?: { color: string; strength: number; dir: [number, number, number]; power: number };
}

export interface ToonSettings {
  /** 段落としの強さ（0 = 普通の描画、1 = 段だけ） */
  amount: number;
  /** 段の境目の明るさ: [ハイライト, 日なた, 陰]（照明の倍率。1 = 色指定どおり） */
  thresholds: [number, number, number];
  /** 境目のぼかし */
  soft: number;
  /** 境目をずらすノイズの強さ・大きさ（1/m） */
  noiseAmp: number;
  noiseScale: number;
  /** 陰の色を作る既定の変え方（OKLab: 明度の倍率・彩度の倍率・色相の回転（度）） */
  shade: [number, number, number];
  dark: [number, number, number];
  hi: [number, number, number];
  /** 下向きの面に足す照り返し（水面・床からの反射。F に bounce × 下向きの度合いを足す）。材質の bounce で上書き */
  bounce?: number;
}

export interface LineSettings {
  enabled: boolean;
  color: string;
  /** 線の太さ（画素） */
  width: number;
  /** 深度の段差（相対）のしきい値 */
  depth: number;
  /** 法線の差のしきい値 */
  normal: number;
  /** 物の違い（ID）で線を引く強さ */
  id: number;
  /** 線を途切れさせるノイズ（0〜1） */
  breakup: number;
  /** 遠くで線を消す距離 */
  fadeFar: number;
  opacity: number;
}

export interface GradeSettings {
  exposure: number;
  /** OKLab の明度に掛ける: 黒の持ち上げ・ガンマ・白の倍率 */
  lift: number;
  gamma: number;
  gain: number;
  saturation: number;
  /** 色相を回す（度） */
  hue: number;
  /** 色の偏り（OKLab a・b に足す） */
  tint: [number, number];
  /** 明度の段数（0 で無し）。画面全体の後処理の段落とし */
  posterize: number;
  /** 周辺減光 */
  vignette: number;
  /** フィルムの粒 */
  grain: number;
  /** 霞（画面全体に薄く色を重ねる） */
  haze?: { color: string; amount: number };
}

/** 画面に掛けるグラデーション（アニメの撮影処理のパラ・フレア） */
export interface ScreenGradient {
  color: string;
  amount: number;
  /** 画面座標（0〜1、左下が原点）の始点と終点。始点で amount、終点で 0 */
  p0: [number, number];
  p1: [number, number];
  blend: 'mul' | 'add' | 'screen';
}

export interface PostSettings {
  bloom: { strength: number; threshold: number; radius: number };
  /** ディフュージョン（明るい所が暗い所へにじむ。スクリーン合成） */
  diffusion: { amount: number; threshold: number; radius: number };
  gradients: ScreenGradient[];
  toneMap: 'none' | 'agx' | 'neutral';
  /** 明度の段落としの硬さ（tanh の係数） */
  posterizeSharpness: number;
  /** 異方性クワハラ。scale は処理する解像度（1 = 原寸、0.5 = 半分で約 1/4 の重さ） */
  kuwahara: { enabled: boolean; radius: number; sharpness: number; aniso: number; scale?: number };
  lines: LineSettings;
  grade: GradeSettings;
}

export interface StylePreset {
  name: string;
  background: string;
  fog: FogSettings;
  toon: ToonSettings;
  post: PostSettings;
  /** 影をタイルの升目単位に丸める（0 で無し。値は升目の大きさ m） */
  shadowQuant: number;
  /** 影の縁をちぎる（影を調べる位置をずらす量 m。0 で無し） */
  shadowJitter: number;
  /** 灯りの光だまり（render/Lamps.ts）の強さの倍率と、段の色を灯りの色へ寄せる割合。既定 { gain: 1, tint: 0.25 } */
  lamps?: { gain: number; tint: number };
}

export const DEFAULT_STYLE: StylePreset = {
  name: 'default',
  background: '#c8d8d0',
  fog: { horizon: '#c8d8d0', zenith: '#b8ccc8', density: 0.0, heightFalloff: 0, baseHeight: 0, start: 0, max: 1, steps: 0 },
  toon: { amount: 1, thresholds: [1.35, 0.72, 0.35], soft: 0.02, noiseAmp: 0.08, noiseScale: 1.2, shade: [0.84, 0.9, 12], dark: [0.62, 0.95, 20], hi: [1.08, 0.7, -4] },
  post: {
    bloom: { strength: 0, threshold: 1.0, radius: 0.6 },
    diffusion: { amount: 0, threshold: 0.6, radius: 0.7 },
    gradients: [],
    toneMap: 'none',
    posterizeSharpness: 12,
    kuwahara: { enabled: false, radius: 5, sharpness: 8, aniso: 1 },
    lines: { enabled: true, color: '#2d373c', width: 1, depth: 0.08, normal: 0.6, id: 0.0, breakup: 0.3, fadeFar: 40, opacity: 0.9 },
    grade: { exposure: 1, lift: 0, gamma: 1, gain: 1, saturation: 1, hue: 0, tint: [0, 0], posterize: 0, vignette: 0, grain: 0 },
  },
  shadowQuant: 0,
  shadowJitter: 0,
};

/** 材質と後処理が共有する uniform（場面の切り替えで値だけ変わる） */
export const styleUniforms = {
  uTime: { value: 0 },
  uFogHorizon: { value: new THREE.Color() },
  uFogZenith: { value: new THREE.Color() },
  uFogGround: { value: new THREE.Color() },
  uFogParams: { value: new THREE.Vector4() }, // density, heightFalloff, baseHeight, start
  uFogParams2: { value: new THREE.Vector4() }, // max, steps, glowStrength, glowPower
  uFogGlowColor: { value: new THREE.Color() },
  uFogExtinction: { value: new THREE.Vector3(1, 1, 1) },
  uFogGlowDir: { value: new THREE.Vector3(0, 0, -1) },
  uToonAmount: { value: 1 },
  uToonThresh: { value: new THREE.Vector4() }, // hi, lit, shade, soft
  uToonNoise: { value: new THREE.Vector2() }, // amp, scale
  uToonBounce: { value: 0 },
  uShadowQuant: { value: 0 },
  uShadowJitter: { value: 0 },
  uSunShadowMatrix: { value: new THREE.Matrix4() },
  uSunShadowNormalBias: { value: 0 },
  // 灯りの光だまり（render/Lamps.ts）
  uLampCount: { value: 0 },
  uLampPos: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
  uLampColor: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
  uLampBoxMin: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) },
  uLampBoxMax: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) },
  uLampExtra: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, // 影の効き, yaw, 四角, 硬い
  uLampQuant: { value: 0 }, // 硬い縁の灯りの升目（= shadowQuant）

  uLampParams: { value: new THREE.Vector2(1, 0.25) }, // gain, tint
  uLampAllMin: { value: new THREE.Vector3() }, // 使う灯りの箱を全部包む箱
  uLampAllMax: { value: new THREE.Vector3() },
};

export function applyStyleUniforms(s: StylePreset): void {
  const u = styleUniforms;
  u.uFogHorizon.value.set(s.fog.horizon);
  u.uFogZenith.value.set(s.fog.zenith);
  u.uFogGround.value.set(s.fog.ground ?? s.fog.horizon);
  u.uFogParams.value.set(s.fog.density, s.fog.heightFalloff, s.fog.baseHeight, s.fog.start);
  u.uFogParams2.value.set(s.fog.max, s.fog.steps, s.fog.glow?.strength ?? 0, s.fog.glow?.power ?? 8);
  u.uFogExtinction.value.set(...(s.fog.extinction ?? [1, 1, 1]));
  if (s.fog.glow) {
    u.uFogGlowColor.value.set(s.fog.glow.color);
    u.uFogGlowDir.value.set(...s.fog.glow.dir).normalize();
  }
  u.uToonAmount.value = s.toon.amount;
  u.uToonThresh.value.set(s.toon.thresholds[0], s.toon.thresholds[1], s.toon.thresholds[2], s.toon.soft);
  u.uToonNoise.value.set(s.toon.noiseAmp, s.toon.noiseScale);
  u.uToonBounce.value = s.toon.bounce ?? 0;
  u.uShadowQuant.value = s.shadowQuant;
  u.uShadowJitter.value = s.shadowJitter;
  u.uLampParams.value.set(s.lamps?.gain ?? 1, s.lamps?.tint ?? 0.25);
  u.uLampQuant.value = s.shadowQuant;
}

/** 部分的に上書きした設定を作る */
export function makeStyle(base: StylePreset, over: DeepPartial<StylePreset>): StylePreset {
  return deepMerge(structuredClone(base) as unknown as Record<string, unknown>, over as Record<string, unknown>) as unknown as StylePreset;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    else a[k] = v;
  }
  return a;
}

/** sRGB の色を OKLab で変える（明度の倍率・彩度の倍率・色相の回転） */
export function shiftColor(hex: THREE.ColorRepresentation, [lMul, cMul, hueDeg]: [number, number, number]): THREE.Color {
  const c = new THREE.Color(hex); // 線形
  const lab = linToOklab(c.r, c.g, c.b);
  const h = Math.atan2(lab[2], lab[1]) + (hueDeg * Math.PI) / 180;
  const ch = Math.hypot(lab[1], lab[2]) * cMul;
  const out = oklabToLin(lab[0] * lMul, Math.cos(h) * ch, Math.sin(h) * ch);
  return new THREE.Color(Math.max(0, out[0]), Math.max(0, out[1]), Math.max(0, out[2]));
}

export function linToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827607001 * m - 0.808675766 * s,
  ];
}

export function oklabToLin(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
