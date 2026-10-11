import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { rng } from '../../scenes/Builder.ts';

/**
 * 空の絵の天井（参考画像の天井は濃紺の空に積雲を描いた壁画）。
 * 参考画像の画素は使わない: 雲の塊の位置と大きさは参考画像の視点から ViewCam で測った数値（広間ごとの雲の表）、
 * 形は手続き: 塊ごとに小さな「玉」（積雲のもこもこ）を乱数で並べ、玉を半球の高さとして重ねた面の向きで陰影を付ける
 * （光の側が明るい・反対が青い陰・縁は薄く明るい）。細かい凹凸はワールド座標のノイズ。
 * 重い計算なので、読み込みのときに 1 回だけ広間の天井の大きさのテクスチャへ描いて（bake）、天井はそれを貼るだけ。
 */
export interface CloudBlob {
  /** 中心（ワールドの x, z） */
  x: number;
  z: number;
  /** 半径（x, z の向き） */
  rx: number;
  rz: number;
  /** 濃さ（1 で大きな玉が多い、0.5 で薄い小さな玉だけ） */
  k?: number;
  /** 奥行き（光の向き）への伸び（視点から見て玉が丸く見えるように、見上げた天井の縮みを打ち消す。既定 1） */
  aniso?: number;
}

export interface SkyCeilingOptions {
  /** 空の色: 中心・縁 */
  base: string;
  edge: string;
  /** 雲の色: 日なた・中間・陰・縁の明るさ */
  lit: string;
  mid: string;
  shade: string;
  rim?: string;
  /**
   * 光の来る向き（ワールドの x, z）と高さ（0..1）。参考画像の雲は「絵の上 = 雲の頭」で描かれていて、天井を見上げると絵の上は手前（目の側）。
   * なので光（雲の頭の向き）は目の側へ向け、平らな底は奥（地平線の側）になる
   */
  light: [number, number];
  elev?: number;
  /** 空の色の中心と、縁までの距離（m） */
  center: [number, number];
  radius: number;
  /** 星の点（天井の小さな灯り）の密度（0 で無し） */
  stars?: number;
  starColor?: string;
  /** 空の上の薄い雲の筋（0..1） */
  wisps?: number;
  /** 玉の大きさの倍率（既定 1） */
  puff?: number;
  /** 光の吸収（大きいほど雲の奥が暗い。既定 0.55） */
  absorb?: number;
  /** 雲の縁のぼかし（濃さの幅。既定 0.14。大きいほど薄く柔らかい縁） */
  soft?: number;
  /** 雲のちぎれ（0 で無し、0.5 前後で塊の中に空の隙間） */
  breakUp?: number;
  seed?: number;
  blobs: CloudBlob[];
  /**
   * 参考画像の視点から見えない所の雲（天井の残りを埋める）。玉は blobs の後に別の数（extraPuffs、既定 380）で作るので、
   * 視点から見える雲（blobs の玉の数・並び・平均の伸び）は変わらない
   */
  extra?: CloudBlob[];
  extraPuffs?: number;
  /** extra の雲の縁のぼかし（既定 0.14。視点の雲より硬く、塊の形がはっきりする） */
  extraSoft?: number;
}

/** blobs の玉の数（前の版と同じ） */
const BASE_PUFFS = 640;
/** 玉の表の大きさ（blobs + extra） */
const MAX_PUFFS = 1100;

/** 参考画像の画素の雲の塊 [x, y, 横の半径, 縦の半径, 濃さ] を天井（高さ y）の上の楕円に（視点のカメラで測る） */
export function cloudsFrom(cam: { hit(x: number, y: number, axis: 'y', v: number): [number, number, number] }, y: number, px: [number, number, number, number, number?][], horizon = 520): CloudBlob[] {
  return px.map(([x, yy, rx, ry, kk]) => {
    const c = cam.hit(x, yy, 'y', y);
    const a = cam.hit(x - rx, yy, 'y', y);
    const b = cam.hit(x + rx, yy, 'y', y);
    const t = cam.hit(x, yy - ry, 'y', y);
    const u = cam.hit(x, Math.min(yy + ry, horizon), 'y', y);
    const wx = Math.hypot(b[0] - a[0], b[2] - a[2]) / 2;
    const wz = Math.hypot(u[0] - t[0], u[2] - t[2]) / 2;
    const ryUsed = (Math.min(yy + ry, horizon) - (yy - ry)) / 2;
    // 画素あたりの奥行きの長さ ÷ 画素あたりの横の長さ（見上げた天井の縮み）
    const aniso = Math.min(Math.max((wz / Math.max(ryUsed, 1)) / (wx / Math.max(rx, 1)), 1), 4);
    return { x: c[0], z: c[2], rx: wx, rz: wz, k: kk ?? 1, aniso };
  });
}

/**
 * 塊を玉の列にする。積雲を横から見た形（参考画像の雲は「上へ盛り上がる積雲」を天井に描いた絵）:
 * 光の向き（= 絵の上）を u、横を v として、手前（u の負の側）は平らな底、底の列に大きな玉、上へ行くほど小さな玉が縁を作る。
 * 返す: 玉ごとに [x, z, 半径, 高さの倍率] と [底の線（u の値）, u の向きの x, z, 0]
 */
function puffsOf(o: SkyCeilingOptions): { a: THREE.Vector4; b: THREE.Vector4; c: THREE.Vector4 }[] {
  const R = rng(o.seed ?? 7);
  const out: { a: THREE.Vector4; b: THREE.Vector4; c: THREE.Vector4 }[] = [];
  const L = new THREE.Vector2(...o.light).normalize();
  const V = new THREE.Vector2(-L.y, L.x);
  const pf = o.puff ?? 1;
  const area = (b: CloudBlob): number => b.rx * b.rz * (b.k ?? 1);
  const total = o.blobs.reduce((s, b) => s + area(b) / (b.aniso ?? 1), 0);
  const totalE = (o.extra ?? []).reduce((s, b) => s + area(b) / (b.aniso ?? 1), 0);
  const nBase = o.blobs.length;
  for (const [bi, bl] of [...o.blobs, ...(o.extra ?? [])].entries()) {
    const isExtra = bi >= nBase;
    const k = bl.k ?? 1;
    const ru = Math.hypot(L.x * bl.rx, L.y * bl.rz);
    const rv = Math.hypot(V.x * bl.rx, V.y * bl.rz);
    const c = new THREE.Vector2(bl.x, bl.z);
    const base = -0.85 * ru;
    const baseDot = c.dot(L) + base;
    const an = bl.aniso ?? 1;
    const rm = Math.min(ru / an, rv);
    const n = isExtra ? Math.max(4, Math.round((area(bl) / an / Math.max(totalE, 1e-6)) * (o.extraPuffs ?? 380))) : Math.max(4, Math.round((area(bl) / an / total) * BASE_PUFFS * 0.98));
    const cap = isExtra ? MAX_PUFFS : BASE_PUFFS;
    for (let i = 0; i < n && out.length < cap; i++) {
      // 楕円の中の点（上の縁に寄せる: 半径方向の位置を外へ偏らせる）
      const a = R() * Math.PI * 2;
      const d = Math.pow(R(), 0.45) * 0.95;
      let u = Math.sin(a) * ru * d;
      const v = Math.cos(a) * rv * d;
      if (u < base + rm * an * 0.2) u = base + rm * an * (0.2 + R() * 0.3);
      // 上ほど小さく、底の近くは大きく
      const up = (u - base) / (ru - base);
      const big = R() < 0.12 ? 1.8 : 1;
      const r = rm * (0.2 - 0.1 * up + R() * R() * 0.2) * big * pf * (k < 0.75 ? 1.3 : 1);
      const p = c.clone().addScaledVector(L, u).addScaledVector(V, v);
      out.push({ a: new THREE.Vector4(p.x, p.y, r, 0.8 + R() * 0.4), b: new THREE.Vector4(baseDot, L.x, L.y, ru - base), c: new THREE.Vector4(an, isExtra ? 1 : 0, 0, 0) });
    }
  }
  return out;
}

/** 1 回目: 雲の濃さ（R = 濃さ、G = 底からの高さ 0..1）。玉を放物面として重ね、底は平らに切り、縁を細かいもこもこで削る */
const DENSITY_FS = /* glsl */ `
  varying vec2 vUv;
  uniform vec4 uRect;
  uniform sampler2D uPuffs;
  uniform int uNPuffs;
  uniform float uBreak;
  uniform vec2 uLd;
  uniform float uAniso;
  ${NOISE_GLSL}
  float billow(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      float n = 1.0 - abs(sl_vnoise(vec3(p, 2.3 + float(i) * 4.1)));
      s += a * n * n;
      p = mat2(1.7, 1.1, -1.1, 1.7) * p;
      a *= 0.5;
    }
    return s;
  }
  void main() {
    vec2 p = mix(uRect.xy, uRect.zw, vUv);
    vec2 w = vec2(sl_fbm(vec3(p * 0.4, 1.3), 3), sl_fbm(vec3(p * 0.4, 6.7), 3)) * 0.45;
    vec2 pp = p + w;
    float h = 0.0;
    float bu = 0.0;
    float ex = 0.0;
    for (int i = 0; i < ${MAX_PUFFS}; i++) {
      if (i >= uNPuffs) break;
      vec4 q = texelFetch(uPuffs, ivec2(i, 0), 0);
      vec2 d = pp - q.xy;
      if (dot(d, d) > q.z * q.z * 16.0) continue;
      vec4 q2 = texelFetch(uPuffs, ivec2(i, 1), 0);
      vec4 q3 = texelFetch(uPuffs, ivec2(i, 2), 0);
      float an = q3.x;
      float du = dot(d, q2.yz) / an;
      float dv = dot(d, vec2(-q2.z, q2.y));
      float x2 = (du * du + dv * dv) / (q.z * q.z);
      if (x2 >= 1.0) continue;
      float u = dot(pp, q2.yz) - q2.x;
      float cut = smoothstep(0.0, 0.25, u + sl_fbm(vec3(pp * 1.6, 4.4), 2) * 0.2);
      float hh = (1.0 - x2) * q.z * q.w * cut;
      float k = q.z * 0.25;
      float hm = clamp(0.5 + 0.5 * (hh - h) / k, 0.0, 1.0);
      if (hh > h - k) {
        h = mix(h, hh, hm) + k * hm * (1.0 - hm);
        bu = mix(bu, clamp(u / max(q2.w, 0.1), 0.0, 1.0), hm);
        ex = mix(ex, q3.y, hm);
      }
    }
    // 縁を細かいもこもこで削る（中ほどはそのまま）
    float edge = 1.0 - smoothstep(0.0, 0.9, h);
    float on = step(0.0, h - 0.001);
    // 細かいもこもこは見上げた縮みを打ち消した座標で（画面で丸く見える）
    vec2 pa = vec2(dot(p, vec2(-uLd.y, uLd.x)), dot(p, uLd) / uAniso);
    h += (billow(pa * 1.6) - 0.42) * 1.1 * edge * on;
    // 中のもこもこ（陰影の凹凸になる）
    h *= 0.8 + 0.45 * billow(pa * 0.9 + 3.1);
    // ちぎれ: 大きなノイズで雲の中にも空の隙間を空ける（参考画像の雲は塊が離れて浮かぶ）
    if (uBreak > 0.0) h -= uBreak * smoothstep(0.0, 0.5, sl_fbm(vec3(p * 0.28, 7.7), 3) + 0.1) * 0.9;
    gl_FragColor = vec4(h, bu, ex, 1.0);
  }`;

/** 2 回目: 色。光の側へ濃さを何歩かたどって、光の届き方（透過）で明るさを決める（光の側の縁が明るく、奥・底は青い陰） */
const SHADE_FS = /* glsl */ `
  varying vec2 vUv;
  uniform vec4 uRect;
  uniform sampler2D uDen;
  uniform vec3 uBase, uEdge, uLit, uMid, uShade, uRim, uStarColor;
  uniform vec2 uL;
  uniform vec3 uCenter;
  uniform float uStars, uWisps, uAbsorb, uSoft, uSoftX;
  ${NOISE_GLSL}
  float den(vec2 p) {
    vec2 uv = (p - uRect.xy) / (uRect.zw - uRect.xy);
    return max(texture2D(uDen, uv).r, 0.0);
  }
  void main() {
    vec2 p = mix(uRect.xy, uRect.zw, vUv);
    float rr = length(p - uCenter.xy) / uCenter.z;
    vec3 sky = mix(uBase, uEdge, smoothstep(0.15, 1.0, rr));
    sky *= 1.0 + 0.07 * sl_fbm(vec3(p * 0.06, 2.0), 3);
    if (uWisps > 0.0) {
      float wv = sl_fbm(vec3(p.x * 0.05, p.y * 0.16, 5.0), 4);
      sky = mix(sky, uMid * 0.8 + sky * 0.2, smoothstep(0.3, 0.75, wv) * uWisps);
    }
    vec3 col = sky;
    vec4 dd = texture2D(uDen, vUv);
    float h = dd.r;
    float bu = dd.g;
    if (h > 0.0) {
      // 光の側へたどる（近い所ほど重く）
      float acc = 0.0;
      for (int i = 1; i <= 12; i++) {
        float t = float(i) * 0.22;
        acc += den(p + uL * t) * (1.25 - float(i) / 12.0);
      }
      float T = exp(-acc * uAbsorb);
      // 小さな凹凸の陰影（濃さの傾き）
      float e = 0.08;
      vec2 g = vec2(den(p + vec2(e, 0.0)) - den(p - vec2(e, 0.0)), den(p + vec2(0.0, e)) - den(p - vec2(0.0, e))) / (2.0 * e);
      float lam = dot(-g, uL) * 0.35;
      float l = clamp(T + lam * 1.1 + sl_fbm(vec3(p * 2.0, 5.5), 3) * 0.08, 0.0, 1.3);
      vec3 c = mix(uShade, uMid, smoothstep(0.05, 0.45, l));
      c = mix(c, uLit, smoothstep(0.45, 0.85, l));
      c = mix(c, uRim, smoothstep(0.85, 1.1, l) * 0.8);
      // 底の近くは暗い
      c *= mix(0.7, 1.05, smoothstep(0.0, 0.7, bu));
      float a = smoothstep(0.0, mix(uSoft, uSoftX, clamp(dd.b, 0.0, 1.0)), h);
      col = mix(sky, c, a);
    }
    if (uStars > 0.0) {
      vec2 gg = p * 0.9;
      vec2 cell = floor(gg);
      vec3 hh = sl_hash33(vec3(cell, 7.0));
      if (hh.z < uStars) {
        float r = length(fract(gg) - 0.5 - (hh.xy - 0.5) * 0.6);
        col += uStarColor * smoothstep(0.05, 0.0, r) * (0.5 + hh.x);
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

function renderPass(renderer: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, rt: THREE.WebGLRenderTarget): void {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  const prevAuto = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.autoClear = prevAuto;
  quad.geometry.dispose();
}

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/** 天井の絵を 1 回だけテクスチャへ描く。rect = 天井の範囲（ワールドの x0, z0, x1, z1）。pxPerM = 1 m あたりの画素 */
export function bakeSky(renderer: THREE.WebGLRenderer, o: SkyCeilingOptions, rect: [number, number, number, number], pxPerM = 40): THREE.Texture {
  const w = Math.min(4096, Math.round((rect[2] - rect[0]) * pxPerM));
  const h = Math.min(4096, Math.round((rect[3] - rect[1]) * pxPerM));
  const puffs = puffsOf(o);
  const data = new Float32Array(MAX_PUFFS * 3 * 4);
  puffs.forEach((q, i) => {
    data.set([q.a.x, q.a.y, q.a.z, q.a.w], i * 4);
    data.set([q.b.x, q.b.y, q.b.z, q.b.w], (MAX_PUFFS + i) * 4);
    data.set([q.c.x, q.c.y, q.c.z, q.c.w], (MAX_PUFFS * 2 + i) * 4);
  });
  const puffTex = new THREE.DataTexture(data, MAX_PUFFS, 3, THREE.RGBAFormat, THREE.FloatType);
  puffTex.needsUpdate = true;
  // 1 回目: 濃さ
  const denRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const dm = new THREE.ShaderMaterial({ uniforms: { uRect: { value: new THREE.Vector4(...rect) }, uPuffs: { value: puffTex }, uNPuffs: { value: puffs.length }, uBreak: { value: o.breakUp ?? 0 }, uLd: { value: new THREE.Vector2(...o.light).normalize() }, uAniso: { value: o.blobs.length ? o.blobs.reduce((a, b) => a + (b.aniso ?? 1), 0) / o.blobs.length : 1 } }, vertexShader: VS, fragmentShader: DENSITY_FS, depthTest: false, depthWrite: false });
  renderPass(renderer, dm, denRT);
  dm.dispose();
  puffTex.dispose();
  // 2 回目: 色
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const L = new THREE.Vector2(...o.light).normalize();
  const sm = new THREE.ShaderMaterial({
    uniforms: {
      uRect: { value: new THREE.Vector4(...rect) },
      uDen: { value: denRT.texture },
      uBase: { value: new THREE.Color(o.base) },
      uEdge: { value: new THREE.Color(o.edge) },
      uLit: { value: new THREE.Color(o.lit) },
      uMid: { value: new THREE.Color(o.mid) },
      uShade: { value: new THREE.Color(o.shade) },
      uRim: { value: new THREE.Color(o.rim ?? o.lit) },
      uStarColor: { value: new THREE.Color(o.starColor ?? '#fff4e0') },
      uL: { value: L },
      uCenter: { value: new THREE.Vector3(o.center[0], o.center[1], o.radius) },
      uStars: { value: o.stars ?? 0 },
      uWisps: { value: o.wisps ?? 0 },
      uAbsorb: { value: o.absorb ?? 0.55 },
      uSoft: { value: o.soft ?? 0.14 },
      uSoftX: { value: o.extraSoft ?? 0.14 },
    },
    vertexShader: VS,
    fragmentShader: SHADE_FS,
    depthTest: false,
    depthWrite: false,
  });
  renderPass(renderer, sm, rt);
  sm.dispose();
  denRT.dispose();
  return rt.texture;
}

/** 焼いた天井の絵を貼る材質（霧は場面と同じ） */
export function skyCeilingMaterial(tex: THREE.Texture, rect: [number, number, number, number], gain = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uTex: { value: tex },
      uRect: { value: new THREE.Vector4(...rect) },
      uGain: { value: gain },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vW;
      uniform float uTime;
      uniform sampler2D uTex;
      uniform vec4 uRect;
      uniform float uGain;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      void main() {
        vec2 uv = (vW.xz - uRect.xy) / (uRect.zw - uRect.xy);
        vec3 col = texture2D(uTex, uv).rgb * uGain;
        col = sl_applyFog(col, vW, cameraPosition);
        gl_FragColor = vec4(col, 1.0);
        gInfo = vec4(0.5, 0.5, 0.97, 0.0);
      }`,
  });
}
