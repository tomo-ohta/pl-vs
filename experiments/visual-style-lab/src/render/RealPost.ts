import * as THREE from 'three';
import type { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { LAMP_GLSL, MAX_LAMPS } from './Lamps.ts';
import { BlurPyramid, pass, rt } from './Post.ts';
import { DEFAULT_REAL, type RealSettings } from './Real.ts';
import { styleUniforms } from './Style.ts';

/**
 * リアルな照明の画面の処理（render/Real.ts の設定。Post が使う）。
 * 場面の色 → 物の隅の暗さ（SAO）・空気の光（光芒・灯りのグロウ・スポットの円錐）を足す → しきい値の無いブルーム → 自動露出。
 * 物の隅の暗さと空気の光は半分の解像度で計算して、ぼかしてから重ねる。
 */
const MAX_SPOTS = 4;

const DEPTH_GLSL = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform mat4 uProjInv;
vec3 viewPos(vec2 uv, float d) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
// 画素ごとのずらし（interleaved gradient noise）
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

// ---- 物の隅の暗さ（Scalable Ambient Obscurance, McGuire 2012 の簡略版） ----
const AO_FS = /* glsl */ `
${DEPTH_GLSL}
uniform sampler2D tInfo;
uniform vec2 uRes;
uniform float uRadius;
uniform float uProjScale;
varying vec2 vUv;
vec3 decodeN(vec4 info) {
  vec2 xy = info.xy * 2.0 - 1.0;
  return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
  vec3 P = viewPos(vUv, d);
  vec3 N = decodeN(texture2D(tInfo, vUv));
  float rPx = min(uRadius * uProjScale / max(-P.z, 1e-3), 140.0);
  float jit = ign(gl_FragCoord.xy) * 6.2831853;
  float R2 = uRadius * uRadius;
  float sum = 0.0;
  const int NS = 12;
  for (int i = 0; i < NS; i++) {
    float a = (float(i) + 0.5) / float(NS);
    float ang = a * 6.2831853 * 4.7 + jit;
    vec2 uv2 = vUv + vec2(cos(ang), sin(ang)) * (rPx * a) / uRes;
    float d2 = texture2D(tDepth, uv2).x;
    vec3 v = viewPos(uv2, d2) - P;
    float vv = dot(v, v);
    float f = max(R2 - vv, 0.0) / R2;
    sum += f * f * f * max(dot(v, N) - 0.01 * -P.z, 0.0) / (vv + 0.01);
  }
  float ao = max(0.0, 1.0 - 2.0 * 1.2 / float(NS) * sum);
  gl_FragColor = vec4(ao, -P.z, 0.0, 1.0);
}`;

// 深さを見てぼかす（縁の向こうへにじまない）
const BILATERAL_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv);
  float z0 = c.y;
  float sum = c.x;
  float wsum = 1.0;
  for (int i = -4; i <= 4; i++) {
    if (i == 0) continue;
    vec4 s = texture2D(tSrc, vUv + uDir * float(i));
    float w = exp(-float(i * i) / 12.0) * exp(-abs(s.y - z0) / max(z0 * 0.04, 0.02));
    sum += s.x * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, z0, 0.0, 1.0);
}`;

// ---- 空気の光（光芒・灯りのグロウ・スポットの円錐） ----
const VOL_FS = /* glsl */ `
${DEPTH_GLSL}
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
#ifdef SUN_SHADOW
uniform sampler2DShadow tSunShadow;
#endif
uniform mat4 uSunMatrix;
uniform vec3 uSunDir;   // 光の来る向き（光源の方）
uniform vec3 uSunColor;
uniform vec4 uVol;      // 濃さ, 前方散乱 g, 調べる距離, 光芒の強さ
uniform vec4 uVol2;     // 灯りのグロウ, スポットの円錐, 灯りの倍率, 光芒の基準
uniform float uSpotCount;
uniform vec4 uSpotPos[${MAX_SPOTS}];   // 位置, 届く距離（0 で無限）
uniform vec4 uSpotDir[${MAX_SPOTS}];   // 向き, cos(外側)
uniform vec4 uSpotColor[${MAX_SPOTS}]; // 色 × 強さ, cos(内側)
uniform float uSpotDecay[${MAX_SPOTS}];
varying vec2 vUv;
${LAMP_GLSL}
// Henyey-Greenstein（4π を掛けて、どの向きにも同じなら 1）
float phaseHG(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5);
}
void main() {
  float d = texture2D(tDepth, vUv).x;
  vec3 wp = (uCamWorld * vec4(viewPos(vUv, d), 1.0)).xyz;
  vec3 ro = uCamPos;
  vec3 rd = wp - ro;
  float L = length(rd);
  rd /= max(L, 1e-5);
  float tMax = d >= 0.99999 ? uVol.z : min(L, uVol.z);
  vec3 acc = vec3(0.0);
  float dens = uVol.x;
  float jit = ign(gl_FragCoord.xy);
  // 光芒（日光の影の地図を視線に沿って調べる）とスポットの円錐
  bool doSun = false;
#ifdef SUN_SHADOW
  doSun = uVol.w > 0.0;
#endif
  bool doSpot = uSpotCount > 0.0 && uVol2.y > 0.0;
  if ((doSun || doSpot) && dens > 0.0) {
    const int ST = 32;
    float dt = tMax / float(ST);
    float sunAcc = 0.0;
    vec3 spotAcc = vec3(0.0);
    for (int i = 0; i < ST; i++) {
      float t = (float(i) + jit) * dt;
      vec3 p = ro + rd * t;
      float tr = exp(-dens * t);
#ifdef SUN_SHADOW
      if (doSun) {
        vec4 sc = uSunMatrix * vec4(p, 1.0);
        vec3 s = sc.xyz / sc.w;
        float vis = 1.0;
        if (all(greaterThan(s, vec3(0.0))) && all(lessThan(s, vec3(1.0)))) vis = texture(tSunShadow, vec3(s.xy, s.z - 0.0015));
        sunAcc += (vis - uVol2.w) * tr;
      }
#endif
      if (doSpot) {
        for (int k = 0; k < ${MAX_SPOTS}; k++) {
          if (float(k) >= uSpotCount) break;
          vec3 lv = p - uSpotPos[k].xyz;
          float dist = length(lv);
          float cone = smoothstep(uSpotDir[k].w, uSpotColor[k].w, dot(lv / max(dist, 1e-4), uSpotDir[k].xyz));
          if (cone <= 0.0) continue;
          float att = uSpotDecay[k] > 0.0 ? 1.0 / (dist * dist + 1.0) : 1.0;
          if (uSpotPos[k].w > 0.0) att *= clamp(1.0 - pow(dist / uSpotPos[k].w, 4.0), 0.0, 1.0);
          spotAcc += uSpotColor[k].rgb * cone * att * tr;
        }
      }
    }
    acc += uSunColor * phaseHG(dot(rd, uSunDir), uVol.y) * dens * sunAcc * dt * uVol.w;
    acc += spotAcc * dens * dt * uVol2.y;
  }
  // 灯りのまわりの空気の光: 灯りの箱の中の線分で、距離の 2 乗で弱まる光を式で積分する（点光源の単散乱）
  if (uLampCount > 0.0 && uVol2.x > 0.0 && dens > 0.0) {
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      if (float(i) >= uLampCount) break;
      vec3 bmin = uLampBoxMin[i];
      vec3 bmax = uLampBoxMax[i];
      vec3 bc = (bmin + bmax) * 0.5;
      vec3 o = ro - bc;
      vec3 dd = rd;
      float yw = uLampExtra[i].y;
      if (yw != 0.0) {
        float c = cos(yw);
        float s = sin(yw);
        o = vec3(c * o.x - s * o.z, o.y, s * o.x + c * o.z);
        dd = vec3(c * dd.x - s * dd.z, dd.y, s * dd.x + c * dd.z);
      }
      vec3 hb = (bmax - bmin) * 0.5;
      vec3 inv = 1.0 / (abs(dd) + 1e-6) * sign(dd + 1e-9);
      vec3 ta = (-hb - o) * inv;
      vec3 tb = (hb - o) * inv;
      vec3 tn = min(ta, tb);
      vec3 tf = max(ta, tb);
      float t0 = max(max(tn.x, tn.y), max(tn.z, 0.0));
      float t1 = min(min(tf.x, tf.y), min(tf.z, tMax));
      if (t1 <= t0) continue;
      vec3 lp = uLampPos[i].xyz;
      float r = uLampPos[i].w;
      float R = r * uRealLight.w;
      vec3 lo = lp - ro;
      float s0 = dot(lo, rd);
      float h2 = max(dot(lo, lo) - s0 * s0, 0.0);
      float r0 = 0.25 * r;
      float h = sqrt(h2 + r0 * r0);
      float I = (atan((t1 - s0) / h) - atan((t0 - s0) / h)) / h;
      float x = sqrt(h2) / R;
      float win = clamp(1.0 - x * x, 0.0, 1.0);
      win *= win;
      acc += uLampColor[i].rgb * (0.25 * r * r) * I * win * dens * uVol2.x * uVol2.z * uLampParams.x;
    }
  }
  gl_FragColor = vec4(acc, 1.0);
}`;

const GAUSS9_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

// 場面の色に、物の隅の暗さと空気の光を重ねる
const COMBINE_FS = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform sampler2D tVol;
uniform vec2 uAmt; // AO の強さ, 空気の光の有無
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  if (uAmt.x > 0.0) c *= mix(1.0, texture2D(tAO, vUv).x, uAmt.x);
  if (uAmt.y > 0.0) c += texture2D(tVol, vUv).rgb;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;

// 自動露出: 縮めた画面（1/32）の明るさの対数平均（中央を重く）から、目の慣れの目標を出し、前の値から少しずつ寄せる
const EXPOSURE_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tPrev;
uniform vec2 uSize;
uniform vec4 uExp; // 補正（倍率）, 寄せる割合, 自動（1）, 0
varying vec2 vUv;
void main() {
  float sum = 0.0;
  float wsum = 0.0;
  for (int y = 0; y < 64; y++) {
    if (float(y) >= uSize.y) break;
    for (int x = 0; x < 64; x++) {
      if (float(x) >= uSize.x) break;
      vec2 uv = (vec2(float(x), float(y)) + 0.5) / uSize;
      vec3 c = texture2D(tSrc, uv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float w = 1.0 - 0.6 * smoothstep(0.15, 0.7, length(uv - 0.5));
      sum += log2(max(l, 1e-4)) * w;
      wsum += w;
    }
  }
  float avg = exp2(sum / max(wsum, 1e-4));
  float target = uExp.z > 0.5 ? clamp(0.16 / max(avg, 1e-4), 0.7, 1.6) : 1.0;
  target *= uExp.x;
  float prev = texture2D(tPrev, vec2(0.5)).x;
  float e = prev > 0.0 ? mix(prev, target, uExp.y) : target;
  gl_FragColor = vec4(e, avg, 0.0, 1.0);
}`;

export class RealPost {
  settings: RealSettings = { ...DEFAULT_REAL };
  /** 自動露出の寄せ方（撮影は 1 = すぐに合わせる） */
  adapt = 0.05;
  private sun: THREE.DirectionalLight | null = null;
  private readonly spots: THREE.SpotLight[] = [];
  private readonly combined = rt(1, 1);
  private readonly aoA = rt(1, 1);
  private readonly aoB = rt(1, 1);
  private readonly volA = rt(1, 1);
  private readonly volB = rt(1, 1);
  private readonly exp = [rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }), rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })];
  private expI = 0;
  private expFresh = true;
  readonly bloom: BlurPyramid;
  private readonly ao: FullScreenQuad;
  private readonly bilateral: FullScreenQuad;
  private readonly vol: FullScreenQuad;
  private readonly gauss: FullScreenQuad;
  private readonly combine: FullScreenQuad;
  private readonly exposure: FullScreenQuad;
  private w = 1;
  private h = 1;

  constructor() {
    this.bloom = new BlurPyramid(
      /* glsl */ `
      uniform sampler2D tSrc; varying vec2 vUv;
      void main() { gl_FragColor = vec4(min(texture2D(tSrc, vUv).rgb, vec3(64.0)), 1.0); }`,
      {},
      7,
    );
    const depthU = (): Record<string, THREE.IUniform> => ({ tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() } });
    this.ao = pass(AO_FS, { ...depthU(), tInfo: { value: null }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 0.6 }, uProjScale: { value: 500 } });
    this.bilateral = pass(BILATERAL_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    const spotArr = <T>(f: () => T): T[] => Array.from({ length: MAX_SPOTS }, f);
    this.vol = pass(VOL_FS, {
      ...styleUniforms,
      ...depthU(),
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      tSunShadow: { value: null },
      uSunMatrix: { value: new THREE.Matrix4() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uVol: { value: new THREE.Vector4() },
      uVol2: { value: new THREE.Vector4() },
      uSpotCount: { value: 0 },
      uSpotPos: { value: spotArr(() => new THREE.Vector4()) },
      uSpotDir: { value: spotArr(() => new THREE.Vector4()) },
      uSpotColor: { value: spotArr(() => new THREE.Vector4()) },
      uSpotDecay: { value: spotArr(() => 0) },
    });
    this.gauss = pass(GAUSS9_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.combine = pass(COMBINE_FS, { tColor: { value: null }, tAO: { value: null }, tVol: { value: null }, uAmt: { value: new THREE.Vector2() } });
    this.exposure = pass(EXPOSURE_FS, { tSrc: { value: null }, tPrev: { value: null }, uSize: { value: new THREE.Vector2() }, uExp: { value: new THREE.Vector4() } });
  }

  /** 場面を読んだときに呼ぶ: 平行光源（影の地図）とスポットライトを覚える */
  setScene(scene: THREE.Scene, sun: THREE.DirectionalLight | null): void {
    const vm = this.vol.material as THREE.ShaderMaterial;
    const hadSun = !!vm.defines.SUN_SHADOW;
    this.sun = sun && sun.castShadow ? sun : null;
    if (hadSun !== !!this.sun) {
      if (this.sun) vm.defines.SUN_SHADOW = 1;
      else delete vm.defines.SUN_SHADOW;
      vm.needsUpdate = true;
    }
    this.spots.length = 0;
    scene.traverse((o) => {
      if ((o as THREE.SpotLight).isSpotLight && this.spots.length < MAX_SPOTS) this.spots.push(o as THREE.SpotLight);
    });
    this.expFresh = true;
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const hw = Math.max(1, w >> 1);
    const hh = Math.max(1, h >> 1);
    this.combined.setSize(w, h);
    for (const t of [this.aoA, this.aoB, this.volA, this.volB]) t.setSize(hw, hh);
    this.bloom.setSize(w, h);
    this.expFresh = true;
  }

  /**
   * 場面の色（線形・HDR）から、重ねた色・ブルーム・露出（1×1 の x）を作る
   */
  render(
    r: THREE.WebGLRenderer,
    color: THREE.Texture,
    depth: THREE.Texture,
    info: THREE.Texture,
    camera: THREE.PerspectiveCamera,
  ): { color: THREE.Texture; bloom: THREE.Texture; exposure: THREE.Texture; bloomLevels: number } {
    const s = this.settings;
    const hw = this.aoA.width;
    const hh = this.aoA.height;
    // 物の隅の暗さ
    let aoTex: THREE.Texture | null = null;
    if (s.ao > 0) {
      const m = this.ao.material as THREE.ShaderMaterial;
      m.uniforms.tDepth.value = depth;
      m.uniforms.tInfo.value = info;
      m.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
      m.uniforms.uRes.value.set(this.w, this.h);
      m.uniforms.uRadius.value = s.aoRadius;
      m.uniforms.uProjScale.value = this.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      r.setRenderTarget(this.aoA);
      this.ao.render(r);
      const b = this.bilateral.material as THREE.ShaderMaterial;
      b.uniforms.tSrc.value = this.aoA.texture;
      b.uniforms.uDir.value.set(1 / hw, 0);
      r.setRenderTarget(this.aoB);
      this.bilateral.render(r);
      b.uniforms.tSrc.value = this.aoB.texture;
      b.uniforms.uDir.value.set(0, 1 / hh);
      r.setRenderTarget(this.aoA);
      this.bilateral.render(r);
      aoTex = this.aoA.texture;
    }
    // 空気の光
    let volTex: THREE.Texture | null = null;
    const sunOn = !!this.sun && s.shafts > 0 && !!this.sun.shadow.map?.depthTexture;
    const spotOn = this.spots.length > 0 && s.beams > 0;
    if (s.density > 0 && (sunOn || spotOn || s.airGlow > 0)) {
      const m = this.vol.material as THREE.ShaderMaterial;
      const u = m.uniforms;
      u.tDepth.value = depth;
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(camera.matrixWorld);
      u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      if (this.sun && sunOn) {
        u.tSunShadow.value = this.sun.shadow.map!.depthTexture;
        u.uSunMatrix.value.copy(this.sun.shadow.matrix);
        const sp = new THREE.Vector3().setFromMatrixPosition(this.sun.matrixWorld);
        const tp = new THREE.Vector3().setFromMatrixPosition(this.sun.target.matrixWorld);
        u.uSunDir.value.copy(sp.sub(tp).normalize());
        u.uSunColor.value.copy(this.sun.color).multiplyScalar((this.sun.intensity / Math.PI) * s.sun);
      }
      u.uVol.value.set(s.density, s.anisotropy, s.maxDist, sunOn ? s.shafts : 0);
      u.uVol2.value.set(s.airGlow, spotOn ? s.beams : 0, s.lamps, s.shaftBase);
      const n = spotOn ? this.spots.length : 0;
      u.uSpotCount.value = n;
      for (let i = 0; i < n; i++) {
        const l = this.spots[i];
        const p = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld);
        const t = new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld);
        const dir = t.sub(p).normalize();
        u.uSpotPos.value[i].set(p.x, p.y, p.z, l.distance);
        u.uSpotDir.value[i].set(dir.x, dir.y, dir.z, Math.cos(l.angle));
        const k = l.visible ? (l.intensity / Math.PI) * s.sun : 0;
        u.uSpotColor.value[i].set(l.color.r * k, l.color.g * k, l.color.b * k, Math.cos(l.angle * (1 - l.penumbra)));
        u.uSpotDecay.value[i] = l.decay;
      }
      r.setRenderTarget(this.volA);
      this.vol.render(r);
      const g = this.gauss.material as THREE.ShaderMaterial;
      g.uniforms.tSrc.value = this.volA.texture;
      g.uniforms.uDir.value.set(1.5 / hw, 0);
      r.setRenderTarget(this.volB);
      this.gauss.render(r);
      g.uniforms.tSrc.value = this.volB.texture;
      g.uniforms.uDir.value.set(0, 1.5 / hh);
      r.setRenderTarget(this.volA);
      this.gauss.render(r);
      volTex = this.volA.texture;
    }
    // 重ねる
    const cm = this.combine.material as THREE.ShaderMaterial;
    cm.uniforms.tColor.value = color;
    cm.uniforms.tAO.value = aoTex ?? color;
    cm.uniforms.tVol.value = volTex ?? color;
    cm.uniforms.uAmt.value.set(aoTex ? s.ao : 0, volTex ? 1 : 0);
    r.setRenderTarget(this.combined);
    this.combine.render(r);
    // ブルーム（しきい値なし）
    const bloomTex = this.bloom.render(r, this.combined.texture, 1);
    // 自動露出（1/32 の段の明るさ）
    const lv = this.bloom.level(4) ?? this.bloom.level(0)!;
    const em = this.exposure.material as THREE.ShaderMaterial;
    const prev = this.exp[this.expI];
    const next = this.exp[1 - this.expI];
    em.uniforms.tSrc.value = lv.texture;
    em.uniforms.tPrev.value = this.expFresh ? null : prev.texture;
    em.uniforms.uSize.value.set(Math.min(lv.width, 64), Math.min(lv.height, 64));
    em.uniforms.uExp.value.set(2 ** s.exposure, this.expFresh ? 1 : this.adapt, s.autoExposure ? 1 : 0, 0);
    r.setRenderTarget(next);
    this.exposure.render(r);
    this.expI = 1 - this.expI;
    this.expFresh = false;
    return { color: this.combined.texture, bloom: bloomTex, exposure: next.texture, bloomLevels: this.bloom.levelCount };
  }

  /** 露出を次のフレームですぐに合わせ直す（場面の切り替え・撮影） */
  resetExposure(): void {
    this.expFresh = true;
  }

  dispose(): void {
    for (const t of [this.combined, this.aoA, this.aoB, this.volA, this.volB, ...this.exp]) t.dispose();
    this.bloom.dispose();
  }
}
