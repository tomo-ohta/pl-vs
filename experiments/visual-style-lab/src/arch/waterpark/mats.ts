import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import type { StyleMaterialOptions } from '../../render/StyleMaterial.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * ウォーターパークの材質の作り方。
 * - 半写実（段落としなし toon: 0）。色は参考画像から --sample で拾った値（hall ごとの色の表）
 * - 濡れた床: タイル目地 + 床の鏡像を「縦に伸ばした筋」で映す（濡れた床に灯りが縦の筋で映る）。
 *   StyleMaterial の映り込みの読み方を、この場面の中で縦に何点もならす形に書き換える（streak）
 * - 水面: 映り込み（揺らぎ・フレネル）と深い色
 */
export type Mat = THREE.MeshStandardMaterial;

/** StyleMaterial の映り込みを縦の筋にする（taps 点・uv で len の長さ）。材質の key を変えて別のプログラムにする */
export function streakify(m: Mat, len: number, taps = 20): Mat {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    const find = 'vec3 r = texture2D(uSlReflTex, ruv).rgb * uSlReflTint;';
    if (!sh.fragmentShader.includes(find)) throw new Error('waterpark: reflection sample not found');
    sh.fragmentShader = sh.fragmentShader.replace(
      find,
      `vec3 r = vec3(0.0);
      float wsum = 0.0;
      // 画素ごとに少しだけずらして間を埋める（点線にならない・粒が目立たない）
      float jit = (sl_hash12(gl_FragCoord.xy) - 0.5) * 0.35;
      for (int k = 0; k < ${taps}; k++) {
        float t = ((float(k) + jit) / float(${taps}) - 0.5 + 0.5 / float(${taps}));
        float w = 1.0 - abs(t) * 1.7;
        r += texture2D(uSlReflTex, ruv + vec2(0.0, t * ${len.toFixed(4)})).rgb * w;
        wsum += w;
      }
      r = r / wsum * uSlReflTint;`,
    );
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => `${key}|streak${taps}:${len.toFixed(4)}`;
  return m;
}

/**
 * タイルを馬目地（段ごとに半枚ずらす）に。StyleMaterial の目地の模様の升目を、行ごとに横へ半分ずらす
 * （参考画像 3 の床の長方形のタイルは段ごとにずれて並ぶ）
 */
export function runningBond(m: Mat): Mat {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    const find = 'vec2 cell = floor(tuv);';
    if (!sh.fragmentShader.includes(find)) throw new Error('waterpark: tile cell not found');
    sh.fragmentShader = sh.fragmentShader.replace(find, 'tuv.x += 0.5 * mod(floor(tuv.y), 2.0);\n    vec2 cell = floor(tuv);');
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => `${key}|bond`;
  return m;
}

export interface FloorLook {
  /** 馬目地（段ごとに半枚ずらす） */
  bond?: boolean;
  color: string;
  tile?: number | [number, number];
  grout?: string;
  groutW?: number;
  jitter?: number;
  refl: number;
  fresnel?: number;
  key?: number;
  keySoft?: number;
  streak?: number;
  tint?: string;
  distort?: number;
  name?: string;
}

/** 濡れたタイルの床 */
export function wetFloor(ctx: SceneContext, r: PlanarReflector, o: FloorLook): Mat {
  const m = ctx.mat({
    color: o.color,
    toon: 0,
    name: o.name,
    tiles: { size: o.tile ?? 0.3, line: o.groutW ?? 0.012, color: o.grout ?? '#1a3c58', jitter: o.jitter ?? 0.06 },
    reflection: {
      texture: r.target.texture,
      matrix: r.matrix,
      strength: o.refl,
      fresnel: o.fresnel ?? 0.6,
      key: o.key ?? 0,
      keySoft: o.keySoft ?? 0.1,
      distort: o.distort ?? 0.004,
      tint: o.tint ?? '#ffffff',
    },
    line: 0,
  });
  const out = o.streak ? streakify(m, o.streak) : m;
  return o.bond ? runningBond(out) : out;
}

export interface WaterLook {
  color: string;
  refl: number;
  fresnel?: number;
  distort?: number;
  tint?: string;
  streak?: number;
  name?: string;
}

/** 水面（不透明。底は見せず、深い色と映り込み） */
export function waterMat(ctx: SceneContext, r: PlanarReflector, o: WaterLook): Mat {
  const m = ctx.mat({
    color: o.color,
    toon: 0,
    unlit: true,
    name: o.name,
    reflection: { texture: r.target.texture, matrix: r.matrix, strength: o.refl, fresnel: o.fresnel ?? 0.4, distort: o.distort ?? 0.012, tint: o.tint ?? '#ffffff' },
    line: 0,
  });
  return o.streak ? streakify(m, o.streak, 7) : m;
}

/** 半写実の材質（toon 0）の短い書き方 */
export function semi(ctx: SceneContext, color: string, o: Partial<StyleMaterialOptions> = {}): Mat {
  return ctx.mat({ color, toon: 0, line: 0, ...o });
}

/** 光る物（灯り・照明の面） */
export function glow(ctx: SceneContext, color: string, intensity = 6): Mat {
  return ctx.mat({ color: '#000000', emissive: color, emissiveIntensity: intensity, unlit: false, toon: 0, line: 0, noFog: false });
}

// ------------------------------------------------------------------ つや（スライダーの樹脂の映り込み）


let envTex: THREE.Texture | null = null;
/** 部屋の明るさの環境（three の RoomEnvironment を PMREM に）。樹脂のスライダーの縁・頭のつやに使う */
export function glossEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (envTex) return envTex;
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return envTex;
}

/** 材質につやを足す（映り込みの強さ k。拡散の照り返しも少し増えるので、色は少し暗めに指定する） */
export function addGloss(m: Mat, env: THREE.Texture, k = 0.5, rough = 0.22, dim = 1): Mat {
  m.color.multiplyScalar(dim);
  m.envMap = env;
  m.envMapIntensity = k;
  m.roughness = rough;
  m.needsUpdate = true;
  return m;
}
