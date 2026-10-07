import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';
import { LAMP_GLSL } from '../../render/Lamps.ts';
import { getNoiseTexture } from '../../render/PaintMaterial.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import type { LocalFrame } from './frame.ts';
import { SUN_DIR } from './sun.ts';

/**
 * 校舎の外壁の塗りの材質（照明なし。元の版の「面ごとの色」と同じ考え）。
 * 面の向きを壁の座標系（外の面・横の面（窓の抱き・柱の側面）・上の面・下の面・内の面）で分けて色を塗る。
 * - 下ほど暗く（狭い通路の底は空が見えにくい。元の版の壁の絵の上下の明るさの差）
 * - 日なた: 壁の面の上に決めた「日の当たる形」（u・y の絵）の中だけ日なたの色（木の葉の影でちぎれた日の光）
 * - 霧（場面の霧と同じ）
 * - 目地（壁の座標に沿った升目。斜めの西棟でも壁に平行）・腰の帯（縁はノイズでちぎる）・しみ（ねじったノイズの斑）・灯りの光だまり
 */

export interface FaceSet {
  front: THREE.ColorRepresentation;
  side?: THREE.ColorRepresentation;
  top?: THREE.ColorRepresentation;
  bottom?: THREE.ColorRepresentation;
  back?: THREE.ColorRepresentation;
}

export interface SunMask {
  texture: THREE.Texture;
  /** 絵の範囲（壁の座標 u0, y0, u1, y1） */
  rect: [number, number, number, number];
}

export interface FacadeMatOptions {
  colors: FaceSet;
  /** 上の方の色（高さ grad[0]〜grad[1] で colors から hi へ） */
  hi?: FaceSet;
  grad?: [number, number];
  /** 日なたの色（sun の絵の中） */
  sun?: FaceSet;
  sunMask?: SunMask;
  /** 日なたの縁をノイズで切る強さ（0 = 絵の値でなめらかに混ぜる。元の版の手で描いた日なた）。edgeU より u の小さい所だけ */
  sunEdge?: number;
  sunEdgeU?: number;
  fog?: number;
  line?: number;
  side?: THREE.Side;
  /** 目地（壁の座標の升目）。外の面・内の面は (u, y)、上・下の面は (u, w)、横の面は (w, y)。faces は出す面（0 外, 1 横, 2 上, 3 下, 4 内） */
  grid?: { size: [number, number]; width: number; color?: THREE.ColorRepresentation; faces?: number[]; offset?: [number, number]; jitter?: number; mul?: number };
  /** 腰の帯（この高さより下を別の色。縁はノイズでちぎる。amp = 縁の振れ幅 m） */
  band?: { y: number; colors: FaceSet; amp?: number };
  /** しみ（ねじったノイズの斑で暗く/明るくする）。mul = 色の倍率、cover = 出る割合（0〜1）、scale = 1/m、yFade = この高さより上で薄れる */
  stain?: { mul: number; cover: number; scale: number; yFade?: [number, number]; faces?: number[] };
  /** 灯りの光だまり（ctx.addLamp）を受ける割合（既定 0: 外壁は室内の灯りを受けない。室内の床・壁・天井は 1） */
  lamp?: number;
}

const VS = /* glsl */ `
varying vec3 vWorld;
varying vec3 vWN;
varying vec3 vVN;
#include <clipping_planes_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  vVN = normalize(normalMatrix * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
#include <clipping_planes_pars_fragment>
varying vec3 vWorld;
varying vec3 vWN;
varying vec3 vVN;
uniform vec3 uO;
uniform vec3 uT;
uniform vec3 uN;
uniform vec3 uC[5];
uniform vec3 uH[5];
uniform vec3 uS[5];
uniform vec2 uGrad;
uniform float uHasSun;
uniform sampler2D uSun;
uniform vec4 uSunRect;
uniform float uFogMul;
uniform float uId;
uniform float uLine;
uniform sampler2D uNoise;
uniform vec4 uGrid;       // 横, 縦, 幅, ばらつき
uniform vec3 uGridColor;
uniform float uGridMul;
uniform vec2 uGridOff;
uniform float uGridFaces[5];
uniform vec3 uBandC[5];
uniform vec2 uBand;       // 高さ, 振れ幅（高さ < -50 で無し）
uniform vec4 uStain;      // 倍率, 割合, 大きさ, 有無
uniform vec2 uStainFade;
uniform float uStainFaces[5];
uniform float uLampLit;
uniform vec2 uSunEdge;
uniform vec3 uSunDir;
${NOISE_GLSL}
${FOG_GLSL}
${LAMP_GLSL}
float fm_noise(vec2 p, float seed) {
  p += seed * vec2(17.31, 41.7);
  vec2 w = texture2D(uNoise, p * 0.043).rg - 0.5;
  vec2 q = p + w * 6.0;
  float n = texture2D(uNoise, q * 0.11).b;
  n += (texture2D(uNoise, q * 0.47 + 0.3).a - 0.5) * 0.3;
  return n;
}
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vWN);
  float a = dot(n, uN);
  float b = dot(n, uT);
  // 0 外, 1 横, 2 上, 3 下, 4 内
  int f = abs(n.y) > max(abs(a), abs(b)) ? (n.y > 0.0 ? 2 : 3) : (abs(a) >= abs(b) ? (a > 0.0 ? 0 : 4) : 1);
  vec3 col = uC[f];
  if (uGrad.y > uGrad.x) col = mix(col, uH[f], smoothstep(uGrad.x, uGrad.y, vWorld.y));
  vec3 relW = vWorld - uO;
  float lu = dot(relW, uT);
  float lw = dot(relW, uN);
  // 面に沿った座標（外・内: u, y / 上・下: u, w / 横: w, y）
  vec2 fuv = f == 2 || f == 3 ? vec2(lu, lw) : (f == 1 ? vec2(lw, vWorld.y) : vec2(lu, vWorld.y));
  if (uBand.x > -50.0 && f != 2 && f != 3) {
    float e = uBand.x + (texture2D(uNoise, vec2((lu + lw) * 0.9, 0.37)).b - 0.5) * uBand.y;
    float aw = fwidth(vWorld.y) * 0.75;
    col = mix(uBandC[f], col, smoothstep(e - aw, e + aw, vWorld.y));
  }
  if (uStain.w > 0.5 && uStainFaces[f] > 0.5) {
    float n = fm_noise(fuv * uStain.z, 5.0);
    float th = 1.0 - uStain.y;
    if (uStainFade.y > uStainFade.x) th += smoothstep(uStainFade.x, uStainFade.y, vWorld.y) * 0.6;
    float aa = fwidth(n) * 0.7 + 1e-4;
    col *= mix(1.0, uStain.x, smoothstep(th - aa, th + aa, n));
  }
  // 目地: 色で塗る（uGridMul = 0）か、日なたの後で明るさを掛ける（uGridMul > 0。日なたでも目地とばらつきが残る）
  float gridL = 0.0;
  float gridJ = 1.0;
  if (uGrid.x > 0.0 && uGridFaces[f] > 0.5) {
    vec2 gp = (fuv - uGridOff) / uGrid.xy;
    if (uGrid.w > 0.0) gridJ = 1.0 + (sl_hash12(floor(gp) + float(f) * 7.0) - 0.5) * uGrid.w;
    vec2 gf = abs(fract(gp) - 0.5);
    vec2 gw = 0.5 - uGrid.z / uGrid.xy * 0.5;
    vec2 gaa = fwidth(gp) * 0.75;
    gridL = max(smoothstep(gw.x - gaa.x, gw.x + gaa.x, gf.x), smoothstep(gw.y - gaa.y, gw.y + gaa.y, gf.y));
    // 遠くでは目地を消す（細かい縞にしない）
    gridL *= 1.0 - smoothstep(0.25, 0.5, max(gaa.x, gaa.y) * 2.0);
    if (uGridMul <= 0.0) {
      col *= gridJ;
      col = mix(col, uGridColor, gridL);
    }
  }
  if (uHasSun > 0.5) {
    vec3 rel = vWorld - uO;
    vec2 su = vec2(dot(rel, uT), vWorld.y);
    vec2 st = (su - uSunRect.xy) / (uSunRect.zw - uSunRect.xy);
    if (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0) {
      float s = texture2D(uSun, st).r;
      if (uSunEdge.x > 0.0 && su.x < uSunEdge.y) {
        // ちぎれた縁・木漏れ日（ねじったノイズのしきい値）
        float nz = fm_noise(vec2(su.x + dot(rel, uN), su.y) * 1.7, 9.0) - 0.5;
        float v = s + nz * uSunEdge.x;
        float aa = fwidth(v) * 0.7 + 1e-4;
        // 日の方を向いていない面（窓の抱き・柱型の横）は日なたにしない
        s = smoothstep(0.5 - aa, 0.5 + aa, v) * step(0.06, dot(n, uSunDir));
      }
      col = mix(col, uS[f], s);
    }
  }
  if (uGridMul > 0.0) col *= gridJ * mix(1.0, uGridMul, gridL);
  if (uLampCount > 0.0 && uLampLit > 0.0) {
    vec3 lp = sl_lamps(vWorld, n, 1.0) * uLampParams.x;
    float ll = dot(lp, vec3(0.2126, 0.7152, 0.0722));
    if (ll > 1e-3) {
      float nz = fm_noise(fuv * 1.3, 3.0) - 0.5;
      float edge = smoothstep(0.17, 0.23, ll + nz * 0.14);
      col *= 1.0 + lp * (0.35 + 0.65 * edge) * uLampLit;
    }
  }
  col = mix(col, sl_applyFog(col, vWorld, cameraPosition), uFogMul);
  gl_FragColor = vec4(col, 1.0);
  gInfo = vec4(normalize(vVN).xy * 0.5 + 0.5, uId, uLine);
}`;

let idc = 0;

function faceArr(s: FaceSet): THREE.Color[] {
  const f = new THREE.Color(s.front);
  const side = new THREE.Color(s.side ?? s.front);
  return [f, side, new THREE.Color(s.top ?? s.side ?? s.front), new THREE.Color(s.bottom ?? s.side ?? s.front), new THREE.Color(s.back ?? s.side ?? s.front)];
}

function faceMask(list: number[]): number[] {
  return [0, 1, 2, 3, 4].map((i) => (list.includes(i) ? 1 : 0));
}

/** 壁の座標系に合わせた塗りの材質 */
export function facadeMat(fr: LocalFrame, o: FacadeMatOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uO: { value: fr.O.clone() },
      uT: { value: fr.T.clone() },
      uN: { value: fr.N.clone() },
      uC: { value: faceArr(o.colors) },
      uH: { value: faceArr(o.hi ?? o.colors) },
      uS: { value: faceArr(o.sun ?? o.colors) },
      uGrad: { value: new THREE.Vector2(...(o.grad ?? [0, 0])) },
      uHasSun: { value: o.sunMask ? 1 : 0 },
      uSun: { value: o.sunMask?.texture ?? null },
      uSunRect: { value: new THREE.Vector4(...(o.sunMask?.rect ?? [0, 0, 1, 1])) },
      uFogMul: { value: o.fog ?? 1 },
      uId: { value: ((idc++ * 0.618034) % 1) * 0.9 + 0.05 },
      uLine: { value: o.line ?? 0 },
      uNoise: { value: getNoiseTexture() },
      uGrid: { value: new THREE.Vector4(o.grid?.size[0] ?? 0, o.grid?.size[1] ?? 1, o.grid?.width ?? 0.01, o.grid?.jitter ?? 0) },
      uGridColor: { value: new THREE.Color(o.grid?.color ?? 0) },
      uGridMul: { value: o.grid?.mul ?? 0 },
      uGridOff: { value: new THREE.Vector2(...(o.grid?.offset ?? [0, 0])) },
      uGridFaces: { value: faceMask(o.grid?.faces ?? [0, 1, 2, 3, 4]) },
      uBandC: { value: faceArr(o.band?.colors ?? o.colors) },
      uBand: { value: new THREE.Vector2(o.band?.y ?? -100, o.band?.amp ?? 0.06) },
      uStain: { value: new THREE.Vector4(o.stain?.mul ?? 1, o.stain?.cover ?? 0, o.stain?.scale ?? 1, o.stain ? 1 : 0) },
      uStainFade: { value: new THREE.Vector2(...(o.stain?.yFade ?? [0, 0])) },
      uStainFaces: { value: faceMask(o.stain?.faces ?? [0, 1, 4]) },
      uLampLit: { value: o.lamp ?? 0 },
      uSunEdge: { value: new THREE.Vector2(o.sunEdge ?? 0, o.sunEdgeU ?? 1e9) },
      uSunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: VS,
    fragmentShader: FS,
    clipping: true,
    side: o.side ?? THREE.FrontSide,
  });
}

/** 材質を名前で使い回す（同じ色の材質は 1 つにして、まとめて描く） */
export class MatCache<T extends THREE.Material> {
  private readonly map = new Map<string, T>();
  constructor(private readonly make: (key: string) => T) {}
  get(key: string): T {
    let m = this.map.get(key);
    if (!m) this.map.set(key, (m = this.make(key)));
    return m;
  }
}
