import * as THREE from 'three';
import { NOISE_GLSL } from './glsl.ts';
import { styleUniforms } from './Style.ts';
import { FOG_GLSL } from './StyleMaterial.ts';
import { LAMP_GLSL } from './Lamps.ts';

/**
 * 「塗り」の材質（淡色の廊下で作り、校舎の間の通路でも使う。照明を使わない平らな場面の標準）。
 * 照明は使わず、面の向き（±X・±Y・±Z）ごとに色を直接指定する（参考画像のほぼ影の無い色面）。
 * - 腰壁: 高さ band.y より下を別の色にする。境目はノイズでちぎる（塗りが垂れたような縁）
 * - 塗りの層: ねじったノイズのしきい値で、白い塗り・床の明るい斑などを重ねる。しきい値は位置で変える
 *   （床なら手前と壁際に多く、中央の奥は少ない、など）
 * - 霧: 場面の霧（空と同じ色の関数）
 * ノイズは最初に作った模様のテクスチャを引く（毎画素のノイズの計算より軽い）。
 */

export type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
const FACES: FaceKey[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

/** 面ごとの色。1 色なら全部の面。x / z / side（縦の面すべて）でまとめて指定できる */
export type FaceColors =
  | THREE.ColorRepresentation
  | Partial<Record<FaceKey | 'x' | 'z' | 'side' | 'all', THREE.ColorRepresentation>>;

export interface PaintLayer {
  /** 塗りの色（面ごとに変えられる） */
  color: FaceColors;
  /** ノイズの大きさ（1/m） */
  scale: number;
  /** しきい値（0〜1 くらい。小さいほど多く塗る） */
  threshold: number;
  /** 位置でしきい値を変える: += dot(p - origin, linear) + dot(|p - origin|, abs) */
  origin?: [number, number, number];
  linear?: [number, number, number];
  abs?: [number, number, number];
  /** 高さで減らす: [この高さから, この高さまでに] しきい値が yGain 上がる */
  yRange?: [number, number];
  yGain?: number;
  /** 出す面: 'floor' | 'wall' | 'ceil' | 'all' */
  only?: 'floor' | 'wall' | 'ceil' | 'all';
  /** ねじりの強さ（既定 1） */
  warp?: number;
  /** 縦・横の伸ばし（ノイズの座標の倍率。[横, 縦]。壁の垂れなどに） */
  stretch?: [number, number];
  /** ノイズのずらし（層ごとに模様を変える） */
  seed?: number;
  /** 細かいちぎれの強さ（既定 0.22。大きいほど縁が細かく割れて小さな島が増える） */
  detail?: number;
  /** 塗りの分布の絵（cov）のチャンネルを使う強さ（しきい値から引く） */
  cov?: number;
  /** 使う分布の絵のチャンネル（0〜3 = r / g / b / a）。省略時は層の番号 */
  covChannel?: number;
}

export interface PaintOptions {
  color: FaceColors;
  /** 腰壁（この高さより下の色） */
  band?: { y: number; color: FaceColors; amp?: number; scale?: number; drip?: number };
  layers?: PaintLayer[];
  /** 塗りの分布の絵（上から見た XZ。RGBA が層 0〜3）。rect = [x0, z0, x1, z1] */
  cov?: { texture: THREE.Texture; rect: [number, number, number, number] };
  /** 目地: ある層で塗った所だけに升目の線を引く（日なたのタイルなど）。size = [x, z] m */
  grid?: { layer: number; size: [number, number]; width: number; color: THREE.ColorRepresentation };
  /** 貼る模様（掲示物など。メッシュの UV で、指定した面だけ） */
  map?: THREE.Texture;
  mapFace?: FaceKey;
  noFog?: boolean;
  /** 霧の掛かり方の倍率（既定 1） */
  fog?: number;
  /** 線の重み（後処理の線。既定 0） */
  line?: number;
  side?: THREE.Side;
  /** 灯りの光だまり（ctx.addLamp）で明るくなる割合（既定 1。0 で灯りを受けない: 光る面・空・遠景など） */
  lamp?: number;
}

function faceArray(c: FaceColors): THREE.Color[] {
  const out = FACES.map(() => new THREE.Color(0xff00ff));
  if (typeof c !== 'object' || c instanceof THREE.Color) {
    for (const o of out) o.set(c as THREE.ColorRepresentation);
    return out;
  }
  const r = c as Partial<Record<string, THREE.ColorRepresentation>>;
  // 指定の無い面は最初に書いた色
  const first = Object.values(r)[0];
  if (first !== undefined) for (const o of out) o.set(first);
  FACES.forEach((k, i) => {
    const axis = k[1];
    const v =
      r[k] ??
      (axis === 'x' ? r.x : axis === 'z' ? r.z : undefined) ??
      (axis !== 'y' ? r.side : undefined) ??
      r.all;
    if (v !== undefined) out[i].set(v);
  });
  return out;
}

let noiseTex: THREE.DataTexture | null = null;

/** 継ぎ目なく並ぶ値ノイズの fbm（RGBA にそれぞれ別の模様） */
export function getNoiseTexture(): THREE.DataTexture {
  if (noiseTex) return noiseTex;
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const lattice = (period: number, seed: number): Float32Array => {
    const a = new Float32Array(period * period);
    let s = seed * 9301 + 49297;
    for (let i = 0; i < a.length; i++) {
      s = (s * 16807) % 2147483647;
      a[i] = s / 2147483647;
    }
    return a;
  };
  const chan = (base: number, oct: number, seed: number): Float32Array => {
    const out = new Float32Array(N * N);
    let amp = 0.5;
    let tot = 0;
    for (let o = 0; o < oct; o++) {
      const p = base << o;
      if (p > N) break;
      const L = lattice(p, seed + o * 31);
      const cs = N / p;
      for (let y = 0; y < N; y++) {
        const fy = y / cs;
        const iy = Math.floor(fy);
        let ty = fy - iy;
        ty = ty * ty * (3 - 2 * ty);
        const y0 = iy % p;
        const y1 = (iy + 1) % p;
        for (let x = 0; x < N; x++) {
          const fx = x / cs;
          const ix = Math.floor(fx);
          let tx = fx - ix;
          tx = tx * tx * (3 - 2 * tx);
          const x0 = ix % p;
          const x1 = (ix + 1) % p;
          const v =
            (L[y0 * p + x0] * (1 - tx) + L[y0 * p + x1] * tx) * (1 - ty) + (L[y1 * p + x0] * (1 - tx) + L[y1 * p + x1] * tx) * ty;
          out[y * N + x] += v * amp;
        }
      }
      tot += amp;
      amp *= 0.5;
    }
    // 0〜1 に広げる
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < out.length; i++) {
      out[i] /= tot;
      mn = Math.min(mn, out[i]);
      mx = Math.max(mx, out[i]);
    }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
    return out;
  };
  const c = [chan(4, 3, 11), chan(4, 3, 23), chan(8, 6, 37), chan(16, 4, 53)];
  for (let i = 0; i < N * N; i++) for (let k = 0; k < 4; k++) data[i * 4 + k] = Math.round(c[k][i] * 255);
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

const MAX_LAYERS = 4;

const VS = /* glsl */ `
#include <clipping_planes_pars_vertex>
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vUv;
varying vec3 vVN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  vVN = normalize(normalMatrix * normal);
  vUv = uv;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
#include <clipping_planes_pars_fragment>
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vUv;
varying vec3 vVN;
uniform sampler2D uNoise;
uniform vec3 uCol[6];
uniform vec3 uLow[6];
uniform vec4 uBand;      // 高さ, 縁の振れ幅, 縁のノイズの大きさ, 垂れ
uniform int uLayerCount;
uniform vec3 uLCol[${MAX_LAYERS * 6}];
uniform vec4 uLA[${MAX_LAYERS}];   // scale, threshold, yGain, warp
uniform vec4 uLY[${MAX_LAYERS}];   // y0, y1, only(0 all,1 floor,2 wall,3 ceil), seed
uniform vec3 uLO[${MAX_LAYERS}];
uniform vec3 uLLin[${MAX_LAYERS}];
uniform vec3 uLAbs[${MAX_LAYERS}];
uniform vec4 uLS[${MAX_LAYERS}];
uniform float uLCov[${MAX_LAYERS}];
uniform float uLCovCh[${MAX_LAYERS}];
uniform sampler2D uCov;
uniform vec4 uCovRect;
uniform vec4 uGrid;      // 層の番号, 横, 縦, 幅
uniform vec3 uGridColor;
uniform sampler2D uMap;
uniform float uMapFace;
uniform float uLine;
uniform float uId;
uniform float uFogMul;
uniform float uLampLit;
${NOISE_GLSL}
${FOG_GLSL}
${LAMP_GLSL}

int faceIndex(vec3 n) {
  vec3 a = abs(n);
  if (a.x >= a.y && a.x >= a.z) return n.x > 0.0 ? 0 : 1;
  if (a.y >= a.z) return n.y > 0.0 ? 2 : 3;
  return n.z > 0.0 ? 4 : 5;
}
// 面に沿った 2D 座標
vec2 faceUV(vec3 p, int f) {
  if (f <= 1) return vec2(p.z, p.y);
  if (f <= 3) return p.xz;
  return vec2(p.x, p.y);
}
// ねじった fbm（テクスチャ引き）。0〜1
float pnoise(vec2 p, float warp, float seed, float detail) {
  p += seed * vec2(17.31, 41.7);
  vec2 w = texture2D(uNoise, p * 0.043).rg - 0.5;
  vec2 q = p + w * 6.0 * warp;
  float n = texture2D(uNoise, q * 0.11).b;
  n += (texture2D(uNoise, q * 0.47 + 0.3).a - 0.5) * detail;
  if (detail > 0.3) n += (texture2D(uNoise, q * 1.9 + 0.7).a - 0.5) * (detail - 0.3);
  return n;
}

void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vWN);
  int f = faceIndex(n);
  vec3 col = uCol[f];
  vec2 fuv = faceUV(vWorld, f);
  // 腰壁
  if (uBand.x > -50.0 && f != 2 && f != 3) {
    float e = uBand.x;
    if (uBand.y > 0.0) {
      float along = f <= 1 ? vWorld.z : vWorld.x;
      float nz = texture2D(uNoise, vec2(along * uBand.z, 0.37)).b - 0.5;
      // 垂れ: 細い縦の筋
      float dr = texture2D(uNoise, vec2(along * uBand.z * 5.0, 0.71)).a;
      e += nz * uBand.y - smoothstep(0.55, 0.85, dr) * uBand.w * (0.5 + texture2D(uNoise, vec2(along * 9.0, 0.2)).b);
    }
    float w = fwidth(vWorld.y) * 0.75;
    col = mix(uLow[f], col, smoothstep(e - w, e + w, vWorld.y));
  }
  // 塗りの層
  float gridOn = 0.0;
  for (int i = 0; i < ${MAX_LAYERS}; i++) {
    if (i >= uLayerCount) break;
    vec4 A = uLA[i];
    vec4 Y = uLY[i];
    bool ok = Y.z < 0.5 || (Y.z < 1.5 ? f == 2 : (Y.z < 2.5 ? (f != 2 && f != 3) : f == 3));
    if (!ok) continue;
    float th = A.y;
    if (Y.y > Y.x) th += smoothstep(Y.x, Y.y, vWorld.y) * A.z;
    vec3 dp = vWorld - uLO[i];
    th += dot(dp, uLLin[i]) + dot(abs(dp), uLAbs[i]);
    if (uLCov[i] != 0.0) {
      vec2 cuv = (vWorld.xz - uCovRect.xy) / (uCovRect.zw - uCovRect.xy);
      vec4 cv = texture2D(uCov, cuv);
      int ch = uLCovCh[i] >= 0.0 ? int(uLCovCh[i] + 0.5) : i;
      th -= uLCov[i] * (ch == 0 ? cv.r : ch == 1 ? cv.g : ch == 2 ? cv.b : cv.a);
    }
    vec2 pp = fuv * uLS[i].xy * A.x;
    float v = pnoise(pp, A.w, Y.w, uLS[i].z);
    float aa = fwidth(v) * 0.7 + 1e-4;
    float k = smoothstep(th - aa, th + aa, v);
    col = mix(col, uLCol[i * 6 + f], k);
    if (float(i) == uGrid.x) gridOn = k;
  }
  if (gridOn > 0.0) {
    vec2 gp = fuv / uGrid.yz;
    vec2 gf = abs(fract(gp) - 0.5);
    vec2 gw = 0.5 - uGrid.w / uGrid.yz * 0.5;
    vec2 gaa = fwidth(gp) * 0.75;
    float gl = max(smoothstep(gw.x - gaa.x, gw.x + gaa.x, gf.x), smoothstep(gw.y - gaa.y, gw.y + gaa.y, gf.y));
    col = mix(col, uGridColor, gl * gridOn);
  }
  if (uMapFace >= 0.0 && float(f) == uMapFace) {
    vec4 m = texture2D(uMap, vUv);
    col = mix(col, m.rgb, m.a);
  }
  // 灯りの光だまり: 色を明るくする。光の縁はノイズでちぎって、塗りの光だまりにする
  if (uLampCount > 0.0 && uLampLit > 0.0) {
    vec3 lp = sl_lamps(vWorld, n, 1.0) * uLampParams.x;
    float ll = dot(lp, vec3(0.2126, 0.7152, 0.0722));
    if (ll > 1e-3) {
      // 段で明るくする（弱い灯りで壁に筋のまだらが出ないように、なめらかな分は少しだけ。壁は模様を大きく）
      float nz = pnoise(fuv * (f == 2 || f == 3 ? 1.3 : 0.55), 1.0, 3.0, 0.3) - 0.5;
      float edge = smoothstep(0.18, 0.22, ll + nz * 0.12);
      col *= 1.0 + lp * (0.12 + 0.88 * edge) * uLampLit;
    }
  }
#ifndef PAINT_NOFOG
  col = mix(col, sl_applyFog(col, vWorld, cameraPosition), uFogMul);
#endif
  gl_FragColor = vec4(col, 1.0);
  gInfo = vec4(normalize(vVN).xy * 0.5 + 0.5, uId, uLine);
}`;

let idc = 0;

export function createPaint(o: PaintOptions): THREE.ShaderMaterial {
  const layers = o.layers ?? [];
  if (layers.length > MAX_LAYERS) throw new Error('paint: too many layers');
  const lcol: THREE.Color[] = [];
  const LA: THREE.Vector4[] = [];
  const LY: THREE.Vector4[] = [];
  const LO: THREE.Vector3[] = [];
  const LLin: THREE.Vector3[] = [];
  const LAbs: THREE.Vector3[] = [];
  const LS: THREE.Vector4[] = [];
  const LCov: number[] = [];
  const LCovCh: number[] = [];
  for (let i = 0; i < MAX_LAYERS; i++) {
    const l = layers[i];
    lcol.push(...faceArray(l?.color ?? 0xffffff));
    LA.push(new THREE.Vector4(l?.scale ?? 1, l?.threshold ?? 2, l?.yGain ?? 0, l?.warp ?? 1));
    const only = l?.only === 'floor' ? 1 : l?.only === 'wall' ? 2 : l?.only === 'ceil' ? 3 : 0;
    LY.push(new THREE.Vector4(l?.yRange?.[0] ?? 0, l?.yRange?.[1] ?? 0, only, l?.seed ?? i * 1.7));
    LO.push(new THREE.Vector3(...(l?.origin ?? [0, 0, 0])));
    LLin.push(new THREE.Vector3(...(l?.linear ?? [0, 0, 0])));
    LAbs.push(new THREE.Vector3(...(l?.abs ?? [0, 0, 0])));
    LS.push(new THREE.Vector4(...(l?.stretch ?? [1, 1]), l?.detail ?? 0.22, 0));
    LCov.push(o.cov ? (l?.cov ?? 0) : 0);
    LCovCh.push(l?.covChannel ?? -1);
  }
  const fi = o.mapFace ? FACES.indexOf(o.mapFace) : -1;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uNoise: { value: getNoiseTexture() },
      uCol: { value: faceArray(o.color) },
      uLow: { value: faceArray(o.band?.color ?? o.color) },
      uBand: { value: new THREE.Vector4(o.band?.y ?? -100, o.band?.amp ?? 0, o.band?.scale ?? 1, o.band?.drip ?? 0) },
      uLayerCount: { value: layers.length },
      uLCol: { value: lcol },
      uLA: { value: LA },
      uLY: { value: LY },
      uLO: { value: LO },
      uLLin: { value: LLin },
      uLAbs: { value: LAbs },
      uLS: { value: LS },
      uLCov: { value: LCov },
      uLCovCh: { value: LCovCh },
      uCov: { value: o.cov?.texture ?? null },
      uCovRect: { value: new THREE.Vector4(...(o.cov?.rect ?? [0, 0, 1, 1])) },
      uGrid: { value: new THREE.Vector4(o.grid?.layer ?? -1, o.grid?.size[0] ?? 1, o.grid?.size[1] ?? 1, o.grid?.width ?? 0.02) },
      uGridColor: { value: new THREE.Color(o.grid?.color ?? 0x000000) },
      uMap: { value: o.map ?? null },
      uMapFace: { value: o.map ? fi : -1 },
      uLine: { value: o.line ?? 0 },
      uFogMul: { value: o.fog ?? 1 },
      uLampLit: { value: o.lamp ?? 1 },
      uId: { value: ((idc++ * 0.618034) % 1) * 0.9 + 0.05 },
    },
    clipping: true,
    vertexShader: VS,
    fragmentShader: FS,
    defines: o.noFog ? { PAINT_NOFOG: 1 } : {},
    side: o.side ?? THREE.FrontSide,
  });
  return mat;
}

/** 塗りの分布の形（上から見た XZ） */
export type CovShape =
  /** 楕円: 中心・半径（x, z）・値。縁は soft（半径に対する割合）でぼかす */
  | { ch: number; e: [number, number, number, number]; v?: number; soft?: number }
  /** 帯: 線分（x0, z0, x1, z1）からの距離 w までが値 v、w + soft で 0 */
  | { ch: number; seg: [number, number, number, number]; w: number; v?: number; soft?: number };

/** 塗りの分布の絵を作る（RGBA = 層 0〜3。重なりは大きい方） */
export function makeCoverage(rect: [number, number, number, number], pxPerM: number, shapes: CovShape[]): THREE.DataTexture {
  const [x0, z0, x1, z1] = rect;
  const W = Math.max(4, Math.round(Math.abs(x1 - x0) * pxPerM));
  const H = Math.max(4, Math.round(Math.abs(z1 - z0) * pxPerM));
  const data = new Uint8Array(W * H * 4);
  const ss = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0);
      const z = z0 + ((j + 0.5) / H) * (z1 - z0);
      const acc = [0, 0, 0, 0];
      for (const s of shapes) {
        let val = 0;
        const v = s.v ?? 1;
        if ('e' in s) {
          const [cx, cz, rx, rz] = s.e;
          const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
          const soft = s.soft ?? 0.5;
          val = v * (1 - ss(1 - soft, 1, d));
        } else {
          const [ax, az, bx, bz] = s.seg;
          const vx = bx - ax;
          const vz = bz - az;
          const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / Math.max(vx * vx + vz * vz, 1e-9)));
          const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
          val = v * (1 - ss(s.w, s.w + (s.soft ?? 0.3), d));
        }
        acc[s.ch] = Math.max(acc[s.ch], val);
      }
      for (let k = 0; k < 4; k++) data[(j * W + i) * 4 + k] = Math.round(Math.min(1, acc[k]) * 255);
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
