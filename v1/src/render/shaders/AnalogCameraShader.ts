/**
 * 控えめな古い撮像表現（V07）の ShaderPass 用シェーダ。OutputPass の**前**（線形 HDR バッファ）に置く。
 *
 * - 暗部に偏る微粒子ノイズ（grain 0〜0.015）、弱い彩度低下（desaturate）、周辺減光（vignette 0〜8%）、色成分だけの微小ずれ（chroma: 1080p 基準 px）
 * - 走査線・歪み・追従遅延・手ブレ・暗転は入れない（仕様 V07 手順 6）
 * - トーンマップと sRGB 変換はこの pass では行わない（OutputPass が 1 回だけ行う）。粒子と彩度・減光は近似の知覚域
 *   （pow 1/2.2）で加減して線形へ戻すだけで、出力変換の再実行ではない
 * - ノイズは gl_FragCoord（出力ピクセル）基準なので解像度・DPR で振幅が変わらない。seed を止めれば静止（スクリーンショット用）
 * - HUD / メニューは DOM なので影響しない
 */
import * as THREE from 'three';

export interface AnalogParams {
  /** 粒子ノイズの振幅（知覚域。0〜0.015 が調整範囲） */
  grain: number;
  /** 彩度低下（0〜1。0.1 = 10% 低下） */
  desaturate: number;
  /** 周辺減光（0〜0.08） */
  vignette: number;
  /** 色成分のずれ（1080p 基準の px。0〜0.5） */
  chromaPx: number;
}

export const ANALOG_PRESETS: Record<'clean' | 'archival', AnalogParams> = {
  clean: { grain: 0, desaturate: 0, vignette: 0, chromaPx: 0 },
  archival: { grain: 0.012, desaturate: 0.1, vignette: 0.06, chromaPx: 0.35 },
};

export const AnalogCameraShader = {
  name: 'AnalogCameraShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** 出力バッファのピクセル寸法 */
    resolution: { value: new THREE.Vector2(1, 1) },
    /** ノイズの種（毎フレーム更新。固定すれば静止） */
    seed: { value: 0 },
    grain: { value: ANALOG_PRESETS.archival.grain },
    desaturate: { value: ANALOG_PRESETS.archival.desaturate },
    vignette: { value: ANALOG_PRESETS.archival.vignette },
    chroma: { value: ANALOG_PRESETS.archival.chromaPx },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float seed;
    uniform float grain;
    uniform float desaturate;
    uniform float vignette;
    uniform float chroma;
    varying vec2 vUv;

    // 整数格子のハッシュ（ピクセル座標 + seed）。周期パターンが出にくい 2 段
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 px = 1.0 / resolution;
      // 色ずれ: 1080p 基準の px を実解像度に換算し、画面中心から放射方向に R と B を逆向きにずらす（中心 0、端で最大）
      float chromaPx = chroma * (resolution.y / 1080.0);
      vec2 radial = vUv - 0.5;
      vec2 off = radial * 2.0 * chromaPx * px;
      vec4 c = texture2D(tDiffuse, vUv);
      float r = texture2D(tDiffuse, vUv + off).r;
      float b = texture2D(tDiffuse, vUv - off).b;
      vec3 col = vec3(r, c.g, b);

      // 近似の知覚域（出力変換の再実行ではない。OutputPass がトーンマップ + sRGB を 1 回行う）
      vec3 p = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
      float luma = dot(p, vec3(0.2126, 0.7152, 0.0722));

      // 弱い彩度低下
      p = mix(vec3(luma), p, 1.0 - desaturate);

      // 暗部に偏る粒子ノイズ（暗部 1.0、明部 0.35 の重み）
      float n = hash12(floor(gl_FragCoord.xy) + vec2(seed * 7.13, seed * 3.71)) - 0.5;
      float dark = 1.0 - smoothstep(0.05, 0.75, luma);
      p += n * 2.0 * grain * (0.35 + 0.65 * dark);

      // 周辺減光（アスペクト補正した半径²。中央は減光なし）
      vec2 q = radial * vec2(resolution.x / resolution.y, 1.0);
      float rr = dot(q, q);
      p *= 1.0 - vignette * smoothstep(0.12, 0.85, rr);

      col = pow(max(p, vec3(0.0)), vec3(2.2));
      gl_FragColor = vec4(col, c.a);
    }`,
};
