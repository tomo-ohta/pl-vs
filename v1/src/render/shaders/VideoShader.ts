/**
 * VideoShader — 映像記録系（ビデオの質感）のフルスクリーンシェーダ。OutputPass の**後**（sRGB の表示域 0〜1）で使う。
 * 担当 F1b。VideoPass が 3 通りの define で同じソースをコンパイルして使い分ける:
 *
 *   COLOR_STAGE           色段: 色のにじみ（YCbCr の色差だけ横ぼかし）→ 彩度・白の偏り → ニー → 黒の浮き → DCT ブロック
 *   HAS_PREV              色段で前フレーム（tPrev）を混ぜる: フレーム間引きの残像（frameBlend）と奇数行のコーミング（interlaceMix）
 *   FINAL_STAGE           最終段: テープの揺れ（行帯の横ずれ）→ ヘッド切替の帯 → 走査線 → 暗部ノイズ（音量連動は CPU 側で noiseAmp に掛ける）
 *
 *   single = COLOR_STAGE + FINAL_STAGE（前フレーム不要のプリセット。tDiffuse → 画面）
 *   color  = COLOR_STAGE + HAS_PREV（tDiffuse + tPrev → RT）
 *   final  = FINAL_STAGE（tDiffuse = 色段の RT → 画面）
 *
 * 方針:
 * - すべて出力ピクセル（gl_FragCoord）基準。ノイズはピクセル座標 + seed の整数ハッシュ（PCG）なので解像度・DPR で振幅が変わらない。
 *   seed は 0〜4095 の整数（VideoPass が frame か frozenSeed から作る）。
 * - 距離を持つ効果（色差ぼかし・横ずれ）は 1080p 基準の px を実解像度に換算する（LensPass の色収差と同じ流儀）。
 * - uniform が 0 の効果は分岐で飛ばす（uniform 分岐は warp 内で一様なので安価）。
 * - three.js は WebGL2 で `#version 300 es` を付けるので uint / ビット演算 / 配列コンストラクタが使える。
 */
import * as THREE from 'three';

export interface VideoUniforms {
  /** COLOR_STAGE: OutputPass の出力（sRGB）。final 単独では色段の RT */
  tDiffuse: THREE.IUniform<THREE.Texture | null>;
  /** HAS_PREV: 前フレーム（色段の出力） */
  tPrev: THREE.IUniform<THREE.Texture | null>;
  /** 出力バッファのピクセル寸法 */
  resolution: THREE.IUniform<THREE.Vector2>;
  /** ノイズの種（0〜4095 の整数） */
  seed: THREE.IUniform<number>;
  desaturate: THREE.IUniform<number>;
  tint: THREE.IUniform<THREE.Vector3>;
  /** 色差の横ぼかし半径（1080p 基準 px） */
  chromaBlur: THREE.IUniform<number>;
  /** 暗部ノイズの振幅（params.noise × 音量ゲイン。CPU 側で掛ける） */
  noiseAmp: THREE.IUniform<number>;
  colorNoise: THREE.IUniform<number>;
  blackLift: THREE.IUniform<number>;
  knee: THREE.IUniform<number>;
  scanlines: THREE.IUniform<number>;
  /** 奇数行に前フレームを混ぜる割合（前フレームが無効なら 0） */
  interlaceMix: THREE.IUniform<number>;
  /** フレーム間引きの切り替え時に前フレームを混ぜる割合（残像） */
  frameBlend: THREE.IUniform<number>;
  dctBlocks: THREE.IUniform<number>;
  /** DCT ブロックの位相の種（0.5 s ごとに変わる） */
  blockSeed: THREE.IUniform<number>;
  /** テープの揺れ: x = 帯の下端 y0（uv）、y = 上端 y1（uv）、z = 横ずれ（1080p 基準 px。符号あり）、w = 強さ（0 で無効） */
  jitterBand: THREE.IUniform<THREE.Vector4>;
  /** ヘッド切替: x = 帯の高さ（uv。画面下端から）、y = 横ずれ（1080p 基準 px）、z = 強さ（0 で無効）、w = 明滅の深さ */
  headBand: THREE.IUniform<THREE.Vector4>;
  /** 以下 VHS の追加項目（VideoParams の同名フィールド） */
  lumaBlur: THREE.IUniform<number>;
  chromaShift: THREE.IUniform<number>;
  smear: THREE.IUniform<number>;
  ringing: THREE.IUniform<number>;
  /** 四隅の減光（表示域。0〜0.4） */
  vignette: THREE.IUniform<number>;
  lineJitter: THREE.IUniform<number>;
  snow: THREE.IUniform<number>;
  tracking: THREE.IUniform<number>;
  chromaNoise: THREE.IUniform<number>;
  /** 経過秒（行揺れのゆっくりした波に使う） */
  timeSec: THREE.IUniform<number>;
}

export function createVideoUniforms(): VideoUniforms {
  return {
    tDiffuse: { value: null },
    tPrev: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    seed: { value: 0 },
    desaturate: { value: 0 },
    tint: { value: new THREE.Vector3(1, 1, 1) },
    chromaBlur: { value: 0 },
    noiseAmp: { value: 0 },
    colorNoise: { value: 0 },
    blackLift: { value: 0 },
    knee: { value: 0 },
    scanlines: { value: 0 },
    interlaceMix: { value: 0 },
    frameBlend: { value: 0 },
    dctBlocks: { value: 0 },
    blockSeed: { value: 0 },
    jitterBand: { value: new THREE.Vector4(0, 0, 0, 0) },
    headBand: { value: new THREE.Vector4(0, 0, 0, 0) },
    lumaBlur: { value: 0 },
    chromaShift: { value: 0 },
    smear: { value: 0 },
    ringing: { value: 0 },
    vignette: { value: 0 },
    lineJitter: { value: 0 },
    snow: { value: 0 },
    tracking: { value: 0 },
    chromaNoise: { value: 0 },
    timeSec: { value: 0 },
  };
}

/** 走査線の暗線の深さ（scanlines = 1 のとき奇数行を 12% 暗く。tape 0.35 → 4%。0.22 では白い器具面に縞が露骨だった） */
export const SCANLINE_DEPTH = 0.15;
/** 静止秒数がこれを超えたら揺れ（ジッタ・ヘッド切替）を止める（時間停止感: 粒子だけが動く） */
export const STILLNESS_CALM_SEC = 3;

export const VideoShader = {
  name: 'VideoShader',
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrev;
    uniform vec2 resolution;
    uniform float seed;
    uniform float desaturate;
    uniform vec3 tint;
    uniform float chromaBlur;
    uniform float noiseAmp;
    uniform float colorNoise;
    uniform float blackLift;
    uniform float knee;
    uniform float scanlines;
    uniform float interlaceMix;
    uniform float frameBlend;
    uniform float dctBlocks;
    uniform float blockSeed;
    uniform vec4 jitterBand;
    uniform vec4 headBand;
    uniform float lumaBlur;
    uniform float chromaShift;
    uniform float smear;
    uniform float ringing;
    uniform float vignette;
    uniform float lineJitter;
    uniform float snow;
    uniform float tracking;
    uniform float chromaNoise;
    uniform float timeSec;
    varying vec2 vUv;

    // BT.601（SD ビデオ）の輝度・色差
    const vec3 LUMA = vec3(0.299, 0.587, 0.114);
    const vec3 CB = vec3(-0.168736, -0.331264, 0.5);
    const vec3 CR = vec3(0.5, -0.418688, -0.081312);

    // PCG ハッシュ（整数）。ピクセル座標 + seed で解像度に依らない一様乱数
    uint pcg(uint v) {
      uint s = v * 747796405u + 2891336453u;
      uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
      return (w >> 22u) ^ w;
    }
    float hashU(uvec2 p, uint s) {
      return float(pcg(p.x + pcg(p.y + pcg(s)))) * (1.0 / 4294967296.0);
    }

    #ifdef COLOR_STAGE
    vec3 colorStage(vec2 uv, vec2 px, uvec2 ip) {
      float scale1080c = resolution.y / 1080.0;
      vec3 rgb = texture2D(tDiffuse, uv).rgb;
      float y0 = dot(rgb, LUMA);

      // 2a. 輝度の横ぼかし（VHS の輝度帯域 ≈ 240 本）: 5 タップ（1 2 3 2 1 / 9）。輪郭が横方向にだけ甘くなる
      float y = y0;
      float yWide = y0;
      if (lumaBlur > 0.0 || ringing > 0.0) {
        float lr = max(lumaBlur, 1.2) * scale1080c * px.x;
        float acc = 3.0 * y0;
        float accW = 0.0;
        for (int i = 1; i <= 2; i++) {
          float a = dot(texture2D(tDiffuse, vec2(uv.x - float(i) * lr * 0.5, uv.y)).rgb, LUMA);
          float b = dot(texture2D(tDiffuse, vec2(uv.x + float(i) * lr * 0.5, uv.y)).rgb, LUMA);
          float w = 3.0 - float(i);
          acc += w * (a + b);
          accW += a + b;
        }
        float yb = acc / 9.0;
        yWide = (accW + y0) / 5.0;
        y = mix(y0, yb, min(lumaBlur, 1.0));
      }

      // 2b. 色のにじみ（クロマサブサンプリング）: 色差だけ横に 7 タップ（1 2 3 4 3 2 1 / 16）ぼかし、右へ chromaShift ぶん遅らせる。
      //     行ごとの色相ずれ（chromaNoise）はテープの色同期の甘さ
      vec2 cc = vec2(dot(rgb, CB), dot(rgb, CR));
      if (chromaBlur > 0.0) {
        float r = chromaBlur * scale1080c;
        float stepX = r / 3.0 * px.x;
        float delay = (r * 0.35 + chromaShift * scale1080c) * px.x;
        cc = vec2(0.0);
        for (int i = -3; i <= 3; i++) {
          vec3 sm = texture2D(tDiffuse, vec2(uv.x - delay + float(i) * stepX, uv.y)).rgb;
          float w = 4.0 - abs(float(i));
          cc += w * vec2(dot(sm, CB), dot(sm, CR));
        }
        cc *= 1.0 / 16.0;
      }
      if (chromaNoise > 0.0) {
        float rowN = hashU(uvec2(ip.y / 2u, 3u), uint(seed) + 29u) - 0.5;
        float rowM = hashU(uvec2(ip.y / 2u, 4u), uint(seed) + 31u) - 0.5;
        cc += vec2(rowN, rowM) * chromaNoise * 0.05;
      }
      // 2c. 明部の右への滲み（テープの smear）: 左側 6 タップの明部（0.55 超）を減衰させて足す。暖色寄り
      float sm = 0.0;
      if (smear > 0.0) {
        float sstep = 3.0 * scale1080c * px.x;
        for (int i = 1; i <= 6; i++) {
          float l = dot(texture2D(tDiffuse, vec2(uv.x - float(i) * sstep, uv.y)).rgb, LUMA);
          sm += max(l - 0.55, 0.0) * (1.0 - float(i) / 7.0);
        }
        sm *= smear * 0.35;
      }
      // 2d. リンギング: 輝度と広いぼかしの差を足し戻して縁に明暗の線を出す（強調回路の出過ぎ）
      if (ringing > 0.0) y += (y0 - yWide) * ringing * 1.4;
      y += sm;
      rgb = vec3(y + 1.402 * cc.y, y - 0.344136 * cc.x - 0.714136 * cc.y, y + 1.772 * cc.x) + sm * vec3(0.10, 0.03, -0.04);

      // 1. 色調整: 彩度低下と白点の偏り（RGB ゲイン）
      float luma = dot(rgb, LUMA);
      rgb = mix(vec3(luma), rgb, 1.0 - desaturate) * tint;

      // 5. ハイライトのニー: 折れ点（knee 0→0.92、1→0.85）以上の傾きを 1 − 0.75 knee に落とす（肩ではなく折れ）。チャンネル別なので白に近い色は少し色が残る
      if (knee > 0.0) {
        float kp = mix(0.92, 0.85, knee);
        float slope = 1.0 - 0.75 * knee;
        vec3 over = max(rgb - kp, vec3(0.0));
        rgb += over * (slope - 1.0);
      }

      // 4. 黒レベルの浮きと圧縮: lift + (1 − lift) x のあと、toe（0.22）以下の傾きを二次曲線で緩める（0 での傾き ≈ 1 − 3 lift）
      if (blackLift > 0.0) {
        rgb = blackLift + (1.0 - blackLift) * rgb;
        const float toe = 0.22;
        vec3 d = max(toe - rgb, vec3(0.0));
        rgb += (blackLift * 1.5) * d * d / toe;
      }

      // 10. DCT ブロックの気配: 8 px ブロックごとに量子化（2/255 刻み）の位相をずらす → 暗部の緩い勾配に境界の段差が出る。
      //     ブロックごとの DC の偏り（±0.75/255）も足す。暗部だけ（luma 0.06→0.35 で消える）。位相は 0.5 s ごとに変わる（GOP のつもり）
      if (dctBlocks > 0.0) {
        uvec2 blk = ip / 8u;
        float bh = hashU(blk, uint(blockSeed) + 7u) - 0.5;
        float dark = 1.0 - smoothstep(0.06, 0.35, dot(rgb, LUMA));
        const float q = 128.0;
        vec3 qz = floor(rgb * q + 0.5 + bh) / q + bh * (1.5 / 255.0);
        rgb = mix(rgb, qz, dctBlocks * dark);
      }
      return rgb;
    }
    #endif

    void main() {
      vec2 px = 1.0 / resolution;
      uvec2 ip = uvec2(gl_FragCoord.xy);
      uint s = uint(seed);
      vec2 uv = vUv;
      float inHead = 0.0;

      #ifdef FINAL_STAGE
      float scale1080 = resolution.y / 1080.0;
      // 7a. 行ごとの横揺れ（トラッキングの甘さ）: 行のハッシュ + ゆっくり流れる波（2 行単位、下端ほど強い）
      if (lineJitter > 0.0) {
        float rowJ = hashU(uvec2(ip.y / 2u, 9u), s + 23u) - 0.5;
        float wave = sin(vUv.y * 40.0 + timeSec * 1.7) * 0.35 + sin(vUv.y * 7.0 - timeSec * 0.6) * 0.25;
        float bottom = 1.0 + 2.0 * smoothstep(0.35, 0.0, vUv.y);
        uv.x += (rowJ * 0.6 + wave * 0.4) * lineJitter * bottom * scale1080 * px.x;
      }
      // 7. テープの揺れ（水平同期ずれ）: 行帯の中だけ横にずらす。帯の上端で最大、下へ向かって同期が戻る（t^1.5）
      if (jitterBand.w > 0.0) {
        float t = (vUv.y - jitterBand.x) / max(jitterBand.y - jitterBand.x, 1e-4);
        float inJ = step(0.0, t) * step(t, 1.0) * jitterBand.w;
        uv.x += inJ * t * sqrt(t) * jitterBand.z * scale1080 * px.x;
      }
      // 8. ヘッド切替ノイズ: 画面下端の帯。行ごとに違う横ずれ（下へ行くほど大きい）
      if (headBand.z > 0.0) {
        inHead = step(vUv.y, headBand.x) * headBand.z;
        float k = 1.0 - vUv.y / max(headBand.x, 1e-4);
        float rowH = hashU(uvec2(ip.y, 0u), s + 11u) - 0.5;
        uv.x += inHead * (headBand.y * (0.5 + 0.5 * k) + rowH * headBand.y * 0.8) * scale1080 * px.x;
      }
      #endif

      #ifdef COLOR_STAGE
      vec3 rgb = colorStage(uv, px, ip);
      #ifdef HAS_PREV
      // 9. フレーム間引きの残像 / 6. コーミング（奇数行だけ前フレーム）。前フレームは揺れの無い座標で採る
      vec3 prev = texture2D(tPrev, vUv).rgb;
      if (frameBlend > 0.0) rgb = mix(rgb, prev, frameBlend);
      if (interlaceMix > 0.0) rgb = mix(rgb, prev, interlaceMix * float(ip.y & 1u));
      #endif
      #else
      vec3 rgb = texture2D(tDiffuse, uv).rgb;
      #endif

      #ifdef FINAL_STAGE
      // 12. 常時のトラッキング帯: 画面下端 0〜3% がざらつき、行ごとに横ずれし、上端がちらつく
      if (tracking > 0.0) {
        float th = tracking * 0.03;
        float inT = step(vUv.y, th);
        if (inT > 0.0) {
          float k = 1.0 - vUv.y / max(th, 1e-4);
          float rowT = hashU(uvec2(ip.y, 5u), s + 37u) - 0.5;
          vec3 shifted = texture2D(tDiffuse, vec2(uv.x + rowT * 14.0 * k * scale1080 * px.x, uv.y)).rgb;
          float tn = hashU(ip, s + 41u);
          rgb = mix(rgb, shifted * (0.6 + 0.8 * tn) + (tn - 0.5) * 0.5 * k, 0.85);
        }
      }
      // 14. スノー: 暗部に散る白い点（画素の 0.15% × snow）
      if (snow > 0.0) {
        float l = dot(rgb, LUMA);
        float dark = 1.0 - smoothstep(0.1, 0.5, l);
        float sn = hashU(ip, s + 61u);
        if (sn < 0.0015 * snow * (0.3 + 0.7 * dark)) rgb += vec3(0.35 + 0.45 * hashU(ip, s + 67u));
      }
      // 8. ヘッド切替の帯: 行ごとの明滅 + 粗いノイズ（白い線は出さない）
      if (inHead > 0.0) {
        float fl = 1.0 + (hashU(uvec2(ip.y, 1u), s + 13u) - 0.5) * 1.2 * headBand.w;
        vec3 noisy = rgb * fl + (hashU(ip, s + 17u) - 0.5) * 0.4;
        rgb = mix(rgb, noisy, inHead);
      }
      // 15. 四隅の減光: 楕円の外側だけ（辺の中央はほとんど変えない）
      if (vignette > 0.0) {
        vec2 q = (vUv - 0.5) * 2.0;
        float rr = dot(q, q) * 0.5;
        rgb *= 1.0 - vignette * smoothstep(0.32, 1.0, rr);
      }
      // 6. 走査線: 2 px 周期（出力ピクセル基準）の弱い暗線
      if (scanlines > 0.0) rgb *= 1.0 - scanlines * ${SCANLINE_DEPTH.toFixed(2)} * float(ip.y & 1u);
      // 3. 暗部ノイズ: 輝度が低いほど強い（暗部 1.0 / 明部 0.3）。色ノイズは青を多めに（0.8 / 0.7 / 1.3）
      if (noiseAmp > 0.0) {
        float l = dot(rgb, LUMA);
        float dark = 1.0 - smoothstep(0.04, 0.6, l);
        float amp = noiseAmp * (0.3 + 0.7 * dark) * 2.0;
        float n = hashU(ip, s) - 0.5;
        vec3 cn = (vec3(hashU(ip, s + 1u), hashU(ip, s + 2u), hashU(ip, s + 3u)) - 0.5) * vec3(0.8, 0.7, 1.3);
        rgb += amp * mix(vec3(n), cn, colorNoise);
      }
      #endif

      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    }`,
};
