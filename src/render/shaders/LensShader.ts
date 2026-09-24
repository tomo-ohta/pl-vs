/**
 * LensPass（src/render/LensPass.ts）用のシェーダ群。すべて線形 HDR のまま扱い、トーンマップ・sRGB 変換は OutputPass に任せる。
 *
 *   LensDownsampleShader  全解像度 → 1/4（4 タップの箱型 = 4×4 px の厳密な平均）
 *   LensBrightShader      1/4 → 1/8 + 明部抽出（閾値 1.0 前後の柔らかい膝。輝度 3 以上は 6 へ頭打ち。にじみ / フレアの元）
 *   LensBlurShader        1/8 での分離ガウス（9 タップを線形補間で 5 タップに。spread で幅を伸ばす）
 *   LensFlareShader       ぼかした明部から横一線のストリークと中心対称のゴースト 2 個（1/8）
 *   LensStatShader        1/4 → 固定 32×18。1 セルあたり 4×4 の層化タップで平均色と log2 輝度の平均
 *   LensReduceShader      32×18 → 2×1。px0 = 平均色 + log 輝度の平均、px1 = 視線中央の距離（min / mean）。CPU が読み戻す
 *   LensCompositeShader   本体 1 パス: 歪み・色収差・軟焦点 / 回転ブラー / 接写 DoF（共通のディスク核）・かすみ・にじみ・フレア・
 *                         露出 / WB / フリッカー（gain）・周辺減光
 *
 * 深度は「ウィンドウ深度（0〜1、非線形）」を .x に持つテクスチャ（GTAOPass.depthTexture か LensPass 自前の DepthTexture）で受け、
 * camera.near / far から距離 [m] に戻す。強さが 0 の効果は uniform の分岐で飛ばす（全画面で一様な分岐なので GPU は実質スキップする）。
 */
import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const LUM = /* glsl */ `
  float lensLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`;

/** 全解像度 → 1/4。出力 1 px = 入力 4×4 px。中心から ±1 px の 4 点を線形補間で読むと厳密な箱型平均になる */
export const LensDownsampleShader = {
  name: 'LensDownsampleShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** 入力テクスチャの 1 px（uv） */
    texel: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel);
      // HDR の外れ値（NaN / 極端な値）が平均を壊さないように上限を置く
      gl_FragColor = vec4(min(c.rgb * 0.25, vec3(64.0)), 1.0);
    }`,
};

/**
 * 1/4 → 1/8 + 明部抽出。4 タップは出力 1 px（= 1/4 の 2×2）より広い 4×4 を読むので、少しぼけた抽出になる（にじみ用途では都合が良い）。
 * 膝: Unity の Bloom と同じ二次の柔らかい閾値。閾値以上は (輝度 − 閾値) の分だけ通す（減算型。器具 2.3〜2.8 は 1.3〜1.8 通る）
 */
export const LensBrightShader = {
  name: 'LensBrightShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2(1, 1) },
    threshold: { value: 1.0 },
    knee: { value: 0.4 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float threshold;
    uniform float knee;
    varying vec2 vUv;
    ${LUM}
    void main() {
      vec3 c = (texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel).rgb) * 0.25;
      float l = lensLum(c);
      // 極端な明部（鏡面の峰・至近の光源）は輝度 3 から上を 6 へ頭打ちにしてから抽出する（にじみの面積が明るさに比例して際限なく広がらない）
      if (l > 3.0) { float lc = 3.0 + (l - 3.0) / (1.0 + (l - 3.0) / 3.0); c *= lc / l; l = lc; }
      float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
      soft = soft * soft / (4.0 * knee + 1e-4);
      float pass = max(soft, l - threshold);
      gl_FragColor = vec4(c * (pass / max(l, 1e-4)), 1.0);
    }`,
};

/** 分離ガウス。9 タップ相当を線形補間で 5 タップ（0 / ±1.3846 / ±3.2308 texel、重み 0.2270 / 0.3162 / 0.0703）。spread で幅を伸ばす */
export const LensBlurShader = {
  name: 'LensBlurShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2(1, 1) },
    /** (1,0) か (0,1) */
    direction: { value: new THREE.Vector2(1, 0) },
    spread: { value: 1.5 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform vec2 direction;
    uniform float spread;
    varying vec2 vUv;
    void main() {
      vec2 step = direction * texel * spread;
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      c += (texture2D(tDiffuse, vUv + step * 1.3846153846).rgb + texture2D(tDiffuse, vUv - step * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(tDiffuse, vUv + step * 3.2307692308).rgb + texture2D(tDiffuse, vUv - step * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/**
 * レンズフレア（1/8）。入力はガウス 1 往復後の明部（光源の形が残っている）。
 *   - ストリーク: 横方向 13 タップ（±6 × streakStep texel、重み 1 / (1 + 0.7|k|)）。閾値 0.05 で抽出の裾を切る。やや寒色
 *   - ゴースト: 画面中心対称に 1.8 倍 / 3.2 倍で縮小した明部を 2 個。元の座標が画面外に出る部分はマスクで消す。1 個目は寒色、2 個目は暖色
 *   - 出力は flare = 1 で「器具を斜めに見たときに気づく」程度になるよう STREAK_GAIN / ghost の重みで正規化
 */
export const LensFlareShader = {
  name: 'LensFlareShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2(1, 1) },
    aspect: { value: 16 / 9 },
    streakStep: { value: 5.0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float aspect;
    uniform float streakStep;
    varying vec2 vUv;
    const float STREAK_GAIN = 1.2;
    vec3 ghost(vec2 uv, float scale, vec3 tint, float weight) {
      vec2 g = 0.5 - (uv - 0.5) * scale;
      float m = 1.0 - smoothstep(0.30, 0.48, length(g - 0.5));
      return max(texture2D(tDiffuse, g).rgb - 0.05, vec3(0.0)) * (m * weight) * tint;
    }
    void main() {
      vec3 streak = vec3(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = 1.0 / (1.0 + abs(fi) * 0.7);
        vec3 s = texture2D(tDiffuse, vUv + vec2(fi * streakStep * texel.x, 0.0)).rgb;
        streak += max(s - vec3(0.05), vec3(0.0)) * w;
        wsum += w;
      }
      streak *= vec3(0.85, 0.95, 1.10) * (STREAK_GAIN / wsum);
      vec3 g = ghost(vUv, 1.8, vec3(0.70, 0.85, 1.20), 0.30) + ghost(vUv, 3.2, vec3(1.10, 0.90, 0.70), 0.20);
      gl_FragColor = vec4(streak + g, 1.0);
    }`,
};

/** 1/4 → 固定 32×18。セル内 4×4 の層化タップ（各タップは線形補間で 2×2 の平均）。rgb = 平均色、a = log2(輝度) の平均 */
export const LensStatShader = {
  name: 'LensStatShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** 出力 1 セルの uv 寸法（1/32, 1/18） */
    cell: { value: new THREE.Vector2(1 / 32, 1 / 18) },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 cell;
    varying vec2 vUv;
    ${LUM}
    void main() {
      vec3 sum = vec3(0.0);
      float lsum = 0.0;
      for (int j = 0; j < 4; j++) {
        for (int i = 0; i < 4; i++) {
          vec2 o = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;
          vec3 c = texture2D(tDiffuse, vUv + o * cell).rgb;
          sum += c;
          lsum += log2(max(lensLum(c), 1e-4));
        }
      }
      gl_FragColor = vec4(sum / 16.0, lsum / 16.0);
    }`,
};

/**
 * 32×18 → 2×1。px0: 16×9 の格子タップ（2 texel 間隔、線形補間）で 32×18 全体の厳密な平均（rgb と log2 輝度）。
 * px1: 視線中央 5 点の距離 [m]（x = 最小、y = 平均）。depthMode 0 のときは 1e4（無効）
 */
export const LensReduceShader = {
  name: 'LensReduceShader',
  uniforms: {
    tStat: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    statTexel: { value: new THREE.Vector2(1 / 32, 1 / 18) },
    depthMode: { value: 0 },
    cameraNear: { value: 0.05 },
    cameraFar: { value: 100 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tStat;
    uniform sampler2D tDepth;
    uniform vec2 statTexel;
    uniform int depthMode;
    uniform float cameraNear;
    uniform float cameraFar;
    float depthToDist(float d) { return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear)); }
    void main() {
      if (gl_FragCoord.x < 1.0) {
        vec4 acc = vec4(0.0);
        for (int j = 0; j < 9; j++) {
          for (int i = 0; i < 16; i++) {
            acc += texture2D(tStat, (vec2(float(i), float(j)) * 2.0 + 1.0) * statTexel);
          }
        }
        gl_FragColor = acc / 144.0;
      } else {
        float dmin = 1e4;
        float dsum = 0.0;
        if (depthMode > 0) {
          const vec2 taps[5] = vec2[5](vec2(0.0, 0.0), vec2(0.012, 0.0), vec2(-0.012, 0.0), vec2(0.0, 0.02), vec2(0.0, -0.02));
          for (int i = 0; i < 5; i++) {
            float dist = depthToDist(texture2D(tDepth, vec2(0.5) + taps[i]).x);
            dmin = min(dmin, dist);
            dsum += dist;
          }
          dsum /= 5.0;
        } else {
          dsum = 1e4;
        }
        gl_FragColor = vec4(dmin, dsum, 0.0, 1.0);
      }
    }`,
};

/**
 * 本体の合成。順序: 歪み（src 座標）→ 深度 → ぼかし核（軟焦点 + 迷い + 回転ブラー + DoF を 1 つのディスクで）→ 色収差 → かすみ →
 * にじみ + ハレーション → フレア → gain（露出 × フリッカー × WB）→ 周辺減光。
 *   - ぼかし核: 半径 R < 1.25 px なら対角 4 タップ（3×3 テント相当。軟焦点のみのときはこちら）、それ以上は中心 + 2 重リング 8 タップ。
 *     軸 A / B（px）で楕円に伸ばす（回転ブラーは A を速度方向に伸ばす）。DoF は深度から求めた錯乱円を両軸に足す
 *   - 色収差: 中心からの放射方向に R を +off、B を −off で読み、中心タップとの差分をぼかし結果に足す（ぼかしを 3 回やらない近似）
 *   - かすみ: 距離 [m] を hazeClamp（霧の far 以下）で止め、20 m で haze の割合だけ hazeLevel（部屋の平均輝度に比例した灰）へ。彩度は 1.5 倍速く落とす
 */
export const LensCompositeShader = {
  name: 'LensCompositeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tGlow: { value: null as THREE.Texture | null },
    tFlare: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    aspect: { value: 16 / 9 },
    distortion: { value: 0 },
    distScale: { value: 1 },
    /** 色収差: (src − 0.5) に掛けて uv オフセットにする係数（端で chroma px になる） */
    chromaK: { value: 0 },
    vignette: { value: 0 },
    blurOn: { value: 0 },
    blurA: { value: new THREE.Vector2(0, 0) },
    blurB: { value: new THREE.Vector2(0, 0) },
    blurDirA: { value: new THREE.Vector2(1, 0) },
    blurDirB: { value: new THREE.Vector2(0, 1) },
    dofAmount: { value: 0 },
    dofFocus: { value: 1 },
    dofMaxPx: { value: 3 },
    glow: { value: 0 },
    halation: { value: 0 },
    flare: { value: 0 },
    haze: { value: 0 },
    hazeLevel: { value: 0.5 },
    hazeClamp: { value: 40 },
    cameraNear: { value: 0.05 },
    cameraFar: { value: 100 },
    depthMode: { value: 0 },
    gain: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tGlow;
    uniform sampler2D tFlare;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float aspect;
    uniform float distortion;
    uniform float distScale;
    uniform float chromaK;
    uniform float vignette;
    uniform float blurOn;
    uniform vec2 blurA;
    uniform vec2 blurB;
    uniform vec2 blurDirA;
    uniform vec2 blurDirB;
    uniform float dofAmount;
    uniform float dofFocus;
    uniform float dofMaxPx;
    uniform float glow;
    uniform float halation;
    uniform float flare;
    uniform float haze;
    uniform float hazeLevel;
    uniform float hazeClamp;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform int depthMode;
    uniform vec3 gain;
    varying vec2 vUv;
    ${LUM}
    float depthToDist(float d) { return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear)); }

    // 2 重リング（内 0.55 × 4、外 1.0 × 4）+ 中心。重みは中心 0.2 / 内 0.125 / 外 0.075（合計 1）
    const vec2 DISK[8] = vec2[8](
      vec2(0.55, 0.0), vec2(0.0, 0.55), vec2(-0.55, 0.0), vec2(0.0, -0.55),
      vec2(0.7071, 0.7071), vec2(-0.7071, 0.7071), vec2(-0.7071, -0.7071), vec2(0.7071, -0.7071));
    const float DISK_W[8] = float[8](0.125, 0.125, 0.125, 0.125, 0.075, 0.075, 0.075, 0.075);
    // ハレーションの暖色（輝度 1 に正規化した橙）
    const vec3 HALATION_TINT = vec3(1.45, 0.90, 0.50);

    void main() {
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r2 = dot(p, p);
      vec2 src = uv;
      if (distortion > 0.0) {
        // 樽型: 出力の半径が大きいほど外側を読む。distScale（= 1 / (1 + k1 rc²)）で四隅がちょうど元画像の隅に載る
        src = (p * (1.0 + distortion * r2) * distScale) / vec2(aspect, 1.0) + 0.5;
      }

      bool hasDepth = depthMode > 0;
      float dist = 0.0;
      if (hasDepth) dist = depthToDist(texture2D(tDepth, src).x);

      vec4 c0 = texture2D(tDiffuse, src);
      vec3 col = c0.rgb;
      if (blurOn > 0.5) {
        vec2 a = blurA;
        vec2 b = blurB;
        if (dofAmount > 0.0 && hasDepth) {
          float coc = dofAmount * dofMaxPx * smoothstep(dofFocus * 1.3, dofFocus * 4.0, dist);
          a += blurDirA * coc;
          b += blurDirB * coc;
        }
        vec2 texel = 1.0 / resolution;
        float R = max(length(a), length(b));
        if (R > 0.05) {
          if (R < 1.25) {
            vec2 d1 = (a + b) * texel;
            vec2 d2 = (a - b) * texel;
            col = 0.25 * (texture2D(tDiffuse, src + d1).rgb + texture2D(tDiffuse, src - d1).rgb
                        + texture2D(tDiffuse, src + d2).rgb + texture2D(tDiffuse, src - d2).rgb);
          } else {
            col *= 0.2;
            for (int i = 0; i < 8; i++) {
              vec2 o = (DISK[i].x * a + DISK[i].y * b) * texel;
              col += texture2D(tDiffuse, src + o).rgb * DISK_W[i];
            }
          }
        }
      }

      if (chromaK > 0.0) {
        vec2 off = (src - 0.5) * chromaK;
        col.r += texture2D(tDiffuse, src + off).r - c0.r;
        col.b += texture2D(tDiffuse, src - off).b - c0.b;
        col = max(col, vec3(0.0));
      }

      if (haze > 0.0 && hasDepth) {
        float h = haze * min(dist, hazeClamp) * 0.05;
        float l = lensLum(col);
        col = mix(col, vec3(l), min(1.0, h * 1.5));
        col = mix(col, vec3(hazeLevel), h);
      }

      if (glow > 0.0) {
        vec3 g = texture2D(tGlow, src).rgb;
        vec3 warm = lensLum(g) * HALATION_TINT;
        col += glow * mix(g, warm, halation);
      }
      if (flare > 0.0) col += flare * texture2D(tFlare, src).rgb;

      col *= gain;

      if (vignette > 0.0) {
        // 楕円（画面の縦横比に沿う）。四隅で vignette、辺の中央で約 0.4 倍
        vec2 q = (uv - 0.5) * 2.0;
        float rr = dot(q, q) * 0.5;
        col *= 1.0 - vignette * smoothstep(0.1, 1.0, rr);
      }

      gl_FragColor = vec4(max(col, vec3(0.0)), c0.a);
    }`,
};
