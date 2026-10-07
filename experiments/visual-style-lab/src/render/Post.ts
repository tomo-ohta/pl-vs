import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { COLOR_GLSL, NOISE_GLSL } from './glsl.ts';
import type { Film } from './Film.ts';
import type { PlanarReflector } from './PlanarReflector.ts';
import { styleUniforms, type StylePreset } from './Style.ts';

/**
 * 後処理: 場面（色 + 情報 + 深度、MSAA）→ 異方性クワハラ（任意）→ ブルーム・ディフュージョン
 * → 合成（線・パラ / フレア・色調整・sRGB）→ 画面
 */
const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(fs: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string | number> = {}): FullScreenQuad {
  return new FullScreenQuad(
    new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, defines, depthTest: false, depthWrite: false }),
  );
}

function rt(w: number, h: number, opts: THREE.RenderTargetOptions = {}): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...opts });
  t.texture.colorSpace = THREE.LinearSRGBColorSpace;
  t.texture.generateMipmaps = false;
  return t;
}

// ---------- ぼかしの段（ブルーム・ディフュージョン共用。Kawase の dual filter） ----------
class BlurPyramid {
  private readonly levels: THREE.WebGLRenderTarget[] = [];
  private readonly ups: THREE.WebGLRenderTarget[] = [];
  private readonly prefilter: FullScreenQuad;
  private readonly down: FullScreenQuad;
  private readonly up: FullScreenQuad;
  constructor(prefilterFS: string, readonly prefilterUniforms: Record<string, THREE.IUniform>, private readonly count = 6) {
    this.prefilter = pass(prefilterFS, { tSrc: { value: null }, ...prefilterUniforms });
    this.down = pass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0);
      }`,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    );
    this.up = pass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
      void main() {
        vec2 o = uTexel * uRadius;
        vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
        gl_FragColor = vec4(c / 12.0 + texture2D(tBase, vUv).rgb, 1.0);
      }`,
      { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } },
    );
  }
  setSize(w: number, h: number): void {
    this.dispose();
    let lw = Math.max(1, w >> 1);
    let lh = Math.max(1, h >> 1);
    for (let i = 0; i < this.count; i++) {
      this.levels.push(rt(lw, lh));
      this.ups.push(rt(lw, lh));
      lw = Math.max(1, lw >> 1);
      lh = Math.max(1, lh >> 1);
    }
  }
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, radius: number): THREE.Texture {
    const pm = this.prefilter.material as THREE.ShaderMaterial;
    pm.uniforms.tSrc.value = src;
    renderer.setRenderTarget(this.levels[0]);
    this.prefilter.render(renderer);
    const dm = this.down.material as THREE.ShaderMaterial;
    for (let i = 1; i < this.levels.length; i++) {
      const s = this.levels[i - 1];
      dm.uniforms.tSrc.value = s.texture;
      dm.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      renderer.setRenderTarget(this.levels[i]);
      this.down.render(renderer);
    }
    const um = this.up.material as THREE.ShaderMaterial;
    let cur = this.levels[this.levels.length - 1].texture;
    for (let i = this.levels.length - 2; i >= 0; i--) {
      const s = this.levels[i + 1];
      um.uniforms.tSrc.value = cur;
      um.uniforms.tBase.value = this.levels[i].texture;
      um.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      um.uniforms.uRadius.value = radius;
      renderer.setRenderTarget(this.ups[i]);
      this.up.render(renderer);
      cur = this.ups[i].texture;
    }
    return cur;
  }
  dispose(): void {
    for (const t of [...this.levels, ...this.ups]) t.dispose();
    this.levels.length = 0;
    this.ups.length = 0;
  }
}

// ---------- 異方性クワハラ（Kyprianidis 2009 / 多項式の重み 2010） ----------
const TENSOR_FS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 s(vec2 o) { return clamp(texture2D(tSrc, vUv + o * uTexel).rgb, 0.0, 1.0); }
void main() {
  vec3 sx = (s(vec2(-1,-1)) + 2.0*s(vec2(-1,0)) + s(vec2(-1,1)) - s(vec2(1,-1)) - 2.0*s(vec2(1,0)) - s(vec2(1,1))) / 4.0;
  vec3 sy = (s(vec2(-1,-1)) + 2.0*s(vec2(0,-1)) + s(vec2(1,-1)) - s(vec2(-1,1)) - 2.0*s(vec2(0,1)) - s(vec2(1,1))) / 4.0;
  gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0);
}`;
const GAUSS_FS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv) * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846) * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846) * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308) * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c;
}`;
const AKF_FS = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tTensor; uniform vec2 uTexel;
uniform float uRadius; uniform float uSharpness; uniform float uAlpha; uniform float uHardness;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tTensor, vUv);
  float d = sqrt(max(t.y * t.y - 2.0 * t.x * t.y + t.x * t.x + 4.0 * t.z * t.z, 0.0));
  float l1 = 0.5 * (t.y + t.x + d);
  float l2 = 0.5 * (t.y + t.x - d);
  vec2 v = vec2(l1 - t.x, -t.z);
  vec2 dir = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
  float phi = -atan(dir.y, dir.x);
  float A = (l1 + l2 > 0.0) ? (l1 - l2) / (l1 + l2) : 0.0;
  float r = uRadius;
  float a = r * clamp((uAlpha + A) / uAlpha, 0.1, 2.0);
  float b = r * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
  float cp = cos(phi), sp = sin(phi);
  mat2 R = mat2(cp, -sp, sp, cp);
  mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
  mat2 SR = S * R;
  int mx = int(sqrt(a * a * cp * cp + b * b * sp * sp));
  int my = int(sqrt(a * a * sp * sp + b * b * cp * cp));
  float zeta = 2.0 / max(r, 1.0);
  float zc = 0.58;
  float sz = sin(zc);
  float eta = (zeta + cos(zc)) / (sz * sz);
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  mx = min(mx, 12);
  my = min(my, 12);
  for (int y = -my; y <= my; y++) {
    for (int x = -mx; x <= mx; x++) {
      vec2 vv = SR * vec2(float(x), float(y));
      if (dot(vv, vv) > 0.25) continue;
      vec3 c = clamp(texture2D(tSrc, vUv + vec2(float(x), float(y)) * uTexel).rgb, 0.0, 1.0);
      float w[8]; float sum = 0.0; float z; float vxx; float vyy;
      vxx = zeta - eta * vv.x * vv.x; vyy = zeta - eta * vv.y * vv.y;
      z = max(0.0, vv.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -vv.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -vv.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, vv.x + vyy); w[6] = z * z; sum += w[6];
      vec2 v2 = 0.70710678 * vec2(vv.x - vv.y, vv.x + vv.y);
      vxx = zeta - eta * v2.x * v2.x; vyy = zeta - eta * v2.y * v2.y;
      z = max(0.0, v2.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -v2.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -v2.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, v2.x + vyy); w[7] = z * z; sum += w[7];
      float g = exp(-3.125 * dot(vv, vv)) / max(sum, 1e-6);
      for (int k = 0; k < 8; k++) {
        float wk = w[k] * g;
        m[k] += vec4(c * wk, wk);
        s[k] += c * c * wk;
      }
    }
  }
  vec4 o = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 0.0) continue;
    vec3 mu = m[k].rgb / m[k].w;
    vec3 sg = abs(s[k] / m[k].w - mu * mu);
    float s2 = sg.r + sg.g + sg.b;
    float w = 1.0 / (1.0 + pow(uHardness * 1000.0 * s2, 0.5 * uSharpness));
    o += vec4(mu * w, w);
  }
  vec3 src = texture2D(tSrc, vUv).rgb;
  vec3 res = o.w > 0.0 ? o.rgb / o.w : src;
  // HDR（光る板）はそのまま残す
  float hdr = max(max(src.r, src.g), src.b);
  gl_FragColor = vec4(hdr > 1.0 ? src : res, 1.0);
}`;

// ---------- 合成 ----------
const COMPOSITE_FS = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform float uTime;
uniform float uDebug;
// 線
uniform vec4 uLine;       // enabled, width, depth, normal
uniform vec4 uLine2;      // id, breakup, fadeFar, opacity
uniform vec3 uLineColor;
// ブルーム・ディフュージョン
uniform float uBloom;
uniform float uDiffusion;
// 画面のグラデーション
uniform vec4 uGradA[3];   // p0.xy, p1.xy
uniform vec4 uGradB[3];   // color.rgb, amount
uniform float uGradMode[3];
// 色調整
uniform vec4 uGrade1;     // exposure, lift, gamma, gain
uniform vec4 uGrade2;     // saturation, hue(rad), tint.a, tint.b
uniform vec4 uGrade3;     // posterize, sharpness, vignette, grain
uniform vec4 uHaze;       // color.rgb, amount
uniform float uToneMap;
uniform float uLinearOut;
uniform float uFilmScale;
varying vec2 vUv;
${NOISE_GLSL}
${COLOR_GLSL}

float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, uNear, uFar);
}
vec3 viewPos(vec2 uv, float d) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
vec3 decodeN(vec4 info) {
  vec2 xy = info.xy * 2.0 - 1.0;
  return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}
// AgX（three の実装と同じ係数の簡略版）
vec3 agx(vec3 color) {
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color = AgXInsetMatrix * max(color, 1e-10);
  color = clamp(log2(color), AgxMinEv, AgxMaxEv);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  vec3 x2 = color * color; vec3 x4 = x2 * x2;
  color = + 15.5 * x4 * x2 - 40.14 * x4 * color + 31.96 * x4 - 6.868 * x2 * color + 0.4298 * x2 + 0.1191 * color - 0.00232;
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  return clamp(color, 0.0, 1.0);
}
vec3 neutral(vec3 color) {
  const float StartCompression = 0.8 - 0.04;
  const float Desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < StartCompression) return color;
  float d = 1. - StartCompression;
  float newPeak = 1. - d * d / (peak + d - StartCompression);
  color *= newPeak / peak;
  float g = 1. - 1. / (Desaturation * (peak - newPeak) + 1.);
  return mix(color, vec3(newPeak), g);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  vec4 info = texture2D(tInfo, vUv);
  float rawD = texture2D(tDepth, vUv).x;
  float dC = -perspectiveDepthToViewZ(rawD, uNear, uFar);

  // ---- 線 ----
  float edge = 0.0;
  if (uLine.x > 0.5) {
    vec2 px = uLine.y / uRes;
    vec3 nC = decodeN(info);
    vec3 vp = viewPos(vUv, rawD);
    float ndv = abs(dot(nC, normalize(-vp)));
    float graze = 1.0 + clamp((1.0 - ndv - 0.5) / 0.5, 0.0, 1.0) * 7.0;
    float dTh = uLine.z * graze;
    float wMax = info.w;
    float dE = 0.0; float nE = 0.0; float iE = 0.0;
    // 深度は中心と周り 8 つ（深度は MSAA で平均されない）。
    // 法線と ID は向かい合う 2 つの組で比べる（縁の画素は MSAA で法線が平均されるので、中心と比べると線が点線になる）
    for (int i = 0; i < 4; i++) {
      vec2 o = i == 0 ? vec2(1,0) : i == 1 ? vec2(0,1) : i == 2 ? vec2(1,1) : vec2(1,-1);
      vec2 uvA = vUv + o * px;
      vec2 uvB = vUv - o * px;
      vec4 iA = texture2D(tInfo, uvA);
      vec4 iB = texture2D(tInfo, uvB);
      float dA = linDepth(uvA);
      float dB = linDepth(uvB);
      // 手前の物の線の重みを使う（線は奥側に描く）
      if (dA < dC) wMax = max(wMax, iA.w);
      if (dB < dC) wMax = max(wMax, iB.w);
      dE = max(dE, max((dC - dA) / max(dA, 1e-3), (dC - dB) / max(dB, 1e-3)));
      nE = max(nE, 1.0 - dot(decodeN(iA), decodeN(iB)));
      iE = max(iE, step(0.002, abs(iA.z - iB.z)) * step(0.001, iA.w * iB.w));
    }
    float e = max(step(dTh, dE), smoothstep(uLine.w * 0.85, uLine.w * 1.15, nE));
    e = max(e, iE * uLine2.x);
    // 遠くで消す・ワールド座標のノイズで途切れさせる
    float fade = 1.0 - smoothstep(uLine2.z * 0.6, uLine2.z, dC);
    vec3 wp = (uCamWorld * vec4(vp, 1.0)).xyz;
    float nz = sl_fbm(wp * 2.2, 3) * 0.5 + 0.5;
    float keep = smoothstep(uLine2.y - 0.08, uLine2.y + 0.08, nz + 0.0001) ;
    keep = uLine2.y <= 0.0 ? 1.0 : keep;
    edge = e * wMax * fade * keep * uLine2.w;
    col = mix(col, uLineColor, clamp(edge, 0.0, 1.0));
  }

  // ---- ブルーム・ディフュージョン ----
  col += texture2D(tBloom, vUv).rgb * uBloom;
  if (uDiffusion > 0.0) {
    vec3 dfz = texture2D(tDiffuse, vUv).rgb;
    vec3 sc = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - clamp(dfz, 0.0, 1.0));
    col = mix(col, max(sc, col), uDiffusion);
  }

  // ---- 露出・トーン ----
  col *= uGrade1.x;
  if (uToneMap > 1.5) col = neutral(col);
  else if (uToneMap > 0.5) col = agx(col);

  // ---- 画面のグラデーション（パラ・フレア） ----
  for (int i = 0; i < 3; i++) {
    if (uGradB[i].w <= 0.0) continue;
    vec2 a = uGradA[i].xy; vec2 b = uGradA[i].zw;
    vec2 ab = b - a;
    float t = clamp(dot(vUv - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float k = (1.0 - t) * uGradB[i].w;
    vec3 gc = uGradB[i].rgb;
    if (uGradMode[i] < 0.5) col = mix(col, col * gc, k);
    else if (uGradMode[i] < 1.5) col += gc * k;
    else col = mix(col, 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - gc), k);
  }

  // ---- 色調整（OKLab） ----
  vec3 lab = sl_linToOklab(max(col, 0.0));
  float L = lab.x * uGrade1.w;
  L = L + uGrade1.y * (1.0 - L);
  L = pow(max(L, 0.0), 1.0 / max(uGrade1.z, 1e-3));
  if (uGrade3.x > 0.0) {
    float n = uGrade3.x;
    float q = floor(L * n + 0.5) / n;
    L = q + (0.5 / n) * tanh(uGrade3.y * (L - q) * n);
  }
  float C = length(lab.yz) * uGrade2.x;
  float h = atan(lab.z, lab.y) + uGrade2.y;
  lab = vec3(L, cos(h) * C + uGrade2.z, sin(h) * C + uGrade2.w);
  col = sl_oklabToLin(lab);
  col = mix(col, uHaze.rgb, uHaze.w);

  // ---- 周辺減光・粒 ----
  vec2 cv = vUv - 0.5;
  col *= 1.0 - uGrade3.z * smoothstep(0.35, 0.95, length(cv * vec2(1.0, uRes.y / uRes.x) * 1.6));
  if (uLinearOut > 0.5) {
    // カメラ効果（Film）へ線形のまま渡す（sRGB・粒はその後）
    gl_FragColor = vec4(max(col, 0.0) * uFilmScale, 1.0);
    return;
  }
  vec3 outc = toSRGB(col);
  float gn = sl_hash12(vUv * uRes + fract(uTime) * 917.0) - 0.5;
  outc += gn * uGrade3.w;
  outc += (sl_hash12(vUv * uRes * 1.37) - 0.5) / 255.0;

  if (uDebug > 0.5) {
    if (uDebug < 1.5) outc = toSRGB(texture2D(tColor, vUv).rgb);
    else if (uDebug < 2.5) outc = info.xyz * vec3(1.0, 1.0, 0.0) + vec3(0.0, 0.0, 0.5);
    else if (uDebug < 3.5) outc = vec3(info.z, fract(info.z * 7.0), info.w);
    else if (uDebug < 4.5) outc = vec3(1.0 - clamp(dC / 60.0, 0.0, 1.0));
    else outc = vec3(1.0 - clamp(edge, 0.0, 1.0));
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

export class Post {
  readonly sceneRT: THREE.WebGLRenderTarget;
  private readonly kuwaharaRT: THREE.WebGLRenderTarget;
  private readonly tensorRT: THREE.WebGLRenderTarget;
  private readonly tensorRT2: THREE.WebGLRenderTarget;
  private readonly tensor: FullScreenQuad;
  private readonly gauss: FullScreenQuad;
  private readonly akf: FullScreenQuad;
  private readonly bloom: BlurPyramid;
  private readonly diffusion: BlurPyramid;
  private readonly composite: FullScreenQuad;
  readonly reflectors: PlanarReflector[] = [];
  style!: StylePreset;
  /** 0 = 完成, 1 = 後処理なし, 2 = 法線, 3 = ID・線の重み, 4 = 深度, 5 = 線 */
  debug = 0;
  /** 段ごとの有効・無効（見比べ用） */
  enable = { kuwahara: true, lines: true, bloom: true, grade: true };
  width = 1;
  height = 1;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      count: 2,
      type: THREE.HalfFloatType,
      samples: 4,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    for (const t of this.sceneRT.textures) {
      t.colorSpace = THREE.LinearSRGBColorSpace;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    }
    this.sceneRT.textures[1].minFilter = THREE.NearestFilter;
    this.sceneRT.textures[1].magFilter = THREE.NearestFilter;
    this.kuwaharaRT = rt(1, 1);
    this.tensorRT = rt(1, 1);
    this.tensorRT2 = rt(1, 1);
    this.tensor = pass(TENSOR_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.gauss = pass(GAUSS_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.akf = pass(AKF_FS, {
      tSrc: { value: null },
      tTensor: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 5 },
      uSharpness: { value: 8 },
      uAlpha: { value: 1 },
      uHardness: { value: 8 },
    });
    this.bloom = new BlurPyramid(
      /* glsl */ `
      uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb;
        float l = max(max(c.r, c.g), c.b);
        float k = clamp((l - uThreshold) / max(l, 1e-4), 0.0, 1.0);
        gl_FragColor = vec4(c * k, 1.0);
      }`,
      { uThreshold: { value: 1 } },
    );
    this.diffusion = new BlurPyramid(
      /* glsl */ `
      uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
      void main() {
        vec3 c = clamp(texture2D(tSrc, vUv).rgb, 0.0, 4.0);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor = vec4(c * smoothstep(uThreshold - 0.2, uThreshold + 0.2, l), 1.0);
      }`,
      { uThreshold: { value: 0.6 } },
      5,
    );
    this.composite = pass(COMPOSITE_FS, {
      tColor: { value: null },
      tInfo: { value: null },
      tDepth: { value: null },
      tBloom: { value: null },
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0.05 },
      uFar: { value: 1000 },
      uProjInv: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uTime: styleUniforms.uTime,
      uDebug: { value: 0 },
      uLine: { value: new THREE.Vector4() },
      uLine2: { value: new THREE.Vector4() },
      uLineColor: { value: new THREE.Color() },
      uBloom: { value: 0 },
      uDiffusion: { value: 0 },
      uGradA: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uGradB: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uGradMode: { value: [0, 0, 0] },
      uGrade1: { value: new THREE.Vector4(1, 0, 1, 1) },
      uGrade2: { value: new THREE.Vector4(1, 0, 0, 0) },
      uGrade3: { value: new THREE.Vector4(0, 12, 0, 0) },
      uHaze: { value: new THREE.Vector4() },
      uToneMap: { value: 0 },
      uLinearOut: { value: 0 },
      uFilmScale: { value: 1 },
    });
  }

  /** カメラ効果（v2 の LensPass / VideoPass）。描画効果が 'off' 以外なら合成の後に掛ける */
  film: Film | null = null;

  setFilm(f: Film | null): void {
    this.film = f;
    f?.setSize(this.width, this.height);
    f?.setDepthTexture(this.sceneRT.depthTexture);
  }

  setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.sceneRT.setSize(w, h);
    this.bloom.setSize(w, h);
    this.diffusion.setSize(w, h);
    for (const r of this.reflectors) r.setSize(w, h);
    this.film?.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const r = this.renderer;
    const s = this.style;
    const ex = s.post;
    for (const ref of this.reflectors) ref.render(r, scene, camera);

    r.setRenderTarget(this.sceneRT);
    r.setClearColor(s.background, 1);
    r.clear();
    r.render(scene, camera);

    let colorTex: THREE.Texture = this.sceneRT.textures[0];
    const kw = s.post.kuwahara;
    if (kw.enabled && this.enable.kuwahara && this.debug === 0) {
      const texel = new THREE.Vector2(1 / this.width, 1 / this.height);
      const ks = THREE.MathUtils.clamp(kw.scale ?? 1, 0.25, 1);
      const kw2 = Math.max(1, Math.round(this.width * ks));
      const kh2 = Math.max(1, Math.round(this.height * ks));
      if (this.kuwaharaRT.width !== kw2 || this.kuwaharaRT.height !== kh2) {
        this.kuwaharaRT.setSize(kw2, kh2);
        this.tensorRT.setSize(kw2, kh2);
        this.tensorRT2.setSize(kw2, kh2);
      }
      const ttexel = new THREE.Vector2(1 / kw2, 1 / kh2);
      const tm = this.tensor.material as THREE.ShaderMaterial;
      tm.uniforms.tSrc.value = colorTex;
      tm.uniforms.uTexel.value.copy(texel);
      r.setRenderTarget(this.tensorRT);
      this.tensor.render(r);
      const gm = this.gauss.material as THREE.ShaderMaterial;
      gm.uniforms.tSrc.value = this.tensorRT.texture;
      gm.uniforms.uDir.value.set(ttexel.x, 0);
      r.setRenderTarget(this.tensorRT2);
      this.gauss.render(r);
      gm.uniforms.tSrc.value = this.tensorRT2.texture;
      gm.uniforms.uDir.value.set(0, ttexel.y);
      r.setRenderTarget(this.tensorRT);
      this.gauss.render(r);
      const am = this.akf.material as THREE.ShaderMaterial;
      am.uniforms.tSrc.value = colorTex;
      am.uniforms.tTensor.value = this.tensorRT.texture;
      am.uniforms.uRadius.value = Math.min(kw.radius * ks, 12);
      am.uniforms.uTexel.value.copy(texel).divideScalar(ks);
      am.uniforms.uSharpness.value = kw.sharpness;
      am.uniforms.uAlpha.value = kw.aniso;
      r.setRenderTarget(this.kuwaharaRT);
      this.akf.render(r);
      colorTex = this.kuwaharaRT.texture;
    }

    const bl = s.post.bloom;
    let bloomTex: THREE.Texture | null = null;
    if (bl.strength > 0 && this.enable.bloom) {
      this.bloom.prefilterUniforms.uThreshold.value = bl.threshold;
      bloomTex = this.bloom.render(r, colorTex, bl.radius * 1.5 + 0.5);
    }
    let diffTex: THREE.Texture | null = null;
    if (ex.diffusion.amount > 0 && this.enable.bloom) {
      this.diffusion.prefilterUniforms.uThreshold.value = ex.diffusion.threshold;
      diffTex = this.diffusion.render(r, colorTex, ex.diffusion.radius * 1.5 + 0.5);
    }

    const cm = this.composite.material as THREE.ShaderMaterial;
    const u = cm.uniforms;
    u.tColor.value = colorTex;
    u.tInfo.value = this.sceneRT.textures[1];
    u.tDepth.value = this.sceneRT.depthTexture;
    u.tBloom.value = bloomTex ?? this.sceneRT.textures[0];
    u.tDiffuse.value = diffTex ?? this.sceneRT.textures[0];
    u.uBloom.value = bloomTex ? bl.strength : 0;
    u.uDiffusion.value = diffTex ? ex.diffusion.amount : 0;
    u.uRes.value.set(this.width, this.height);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uDebug.value = this.debug;
    const ln = s.post.lines;
    const on = ln.enabled && this.enable.lines;
    u.uLine.value.set(on ? 1 : 0, ln.width * (this.height / 816), ln.depth, ln.normal);
    u.uLine2.value.set(ln.id, ln.breakup, ln.fadeFar, ln.opacity);
    u.uLineColor.value.set(ln.color);
    const g = s.post.grade;
    const gon = this.enable.grade;
    u.uGrade1.value.set(g.exposure, gon ? g.lift : 0, gon ? g.gamma : 1, gon ? g.gain : 1);
    u.uGrade2.value.set(gon ? g.saturation : 1, gon ? (g.hue * Math.PI) / 180 : 0, gon ? g.tint[0] : 0, gon ? g.tint[1] : 0);
    u.uGrade3.value.set(gon ? g.posterize : 0, ex.posterizeSharpness, gon ? g.vignette : 0, gon ? g.grain : 0);
    if (g.haze && gon) {
      const hc = new THREE.Color(g.haze.color);
      u.uHaze.value.set(hc.r, hc.g, hc.b, g.haze.amount);
    } else u.uHaze.value.set(0, 0, 0, 0);
    u.uToneMap.value = ex.toneMap === 'agx' ? 1 : ex.toneMap === 'neutral' ? 2 : 0;
    for (let i = 0; i < 3; i++) {
      const gr = gon ? ex.gradients[i] : undefined;
      if (!gr) {
        u.uGradB.value[i].set(0, 0, 0, 0);
        continue;
      }
      const c = new THREE.Color(gr.color);
      u.uGradA.value[i].set(gr.p0[0], gr.p0[1], gr.p1[0], gr.p1[1]);
      u.uGradB.value[i].set(c.r, c.g, c.b, gr.amount);
      u.uGradMode.value[i] = gr.blend === 'mul' ? 0 : gr.blend === 'add' ? 1 : 2;
    }
    const film = this.film && this.film.active && this.debug === 0 ? this.film : null;
    u.uLinearOut.value = film ? 1 : 0;
    u.uFilmScale.value = film ? film.inputScale : 1;
    r.setRenderTarget(film ? film.linearTarget : null);
    this.composite.render(r);
    film?.render(r);
  }

  dispose(): void {
    this.sceneRT.dispose();
    this.kuwaharaRT.dispose();
    this.tensorRT.dispose();
    this.tensorRT2.dispose();
    this.bloom.dispose();
    this.diffusion.dispose();
  }
}
