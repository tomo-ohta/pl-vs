/**
 * 部屋の画面効果（段階 4・oddity）: 部屋まるごとの異変の部屋にいる間だけ、画面の色を変える pass。
 * PostFX が OutputPass の前（線形 HDR）に差し込む。効果が無い間は pass を外す（いつもの描画の重さは変わらない）。
 *
 * 効果（RoomGrade。どれも省略可・既定は効果なし）:
 * - saturation: 彩度（1 = そのまま・0 = 白黒）
 * - tint: 色の掛け算（暖かい部屋は赤み・寒い部屋は青み）
 * - hueKill: 1 つの色相だけ灰色にする（X07 色が抜ける。hue 0..1・width 0..0.5・amount 0..1）
 * - mono: 単色（明るさだけを残して color の 1 色にする。X08）
 * - haze: 画面全体をその色に寄せる（煙の中・水の中）
 * - frost: 画面の縁が凍る（E07 寒い所）
 * - ripple: 水の揺らぎ（E09 水の壁をくぐる）
 * - vignette: 四隅を暗く
 * - contrast: 明暗の差（1 = そのまま）
 *
 * 部品の描画（client/views/oddity）が毎フレーム PostFX.setRoomGrade(key, grade) を呼ぶ。呼ばれなくなった効果は戻っていく
 * （部屋を出た・部屋が見えなくなって描画の更新が止まった）。複数あれば重ねる（彩度・掛け算は掛け、量は大きい方）。
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

export interface RoomGrade {
  saturation?: number;
  tint?: [number, number, number];
  hueKill?: { hue: number; width: number; amount: number };
  mono?: { color: number; amount: number };
  haze?: { color: number; amount: number };
  frost?: number;
  ripple?: number;
  vignette?: number;
  contrast?: number;
}

/** 混ぜた結果（uniform にそのまま写す値） */
export interface GradeValues {
  saturation: number;
  tint: [number, number, number];
  hueKill: [number, number, number];
  mono: [number, number, number, number];
  haze: [number, number, number, number];
  frost: number;
  ripple: number;
  vignette: number;
  contrast: number;
}

export const NEUTRAL_GRADE: Readonly<GradeValues> = {
  saturation: 1, tint: [1, 1, 1], hueKill: [0, 0.1, 0], mono: [1, 1, 1, 0], haze: [0, 0, 0, 0], frost: 0, ripple: 0, vignette: 0, contrast: 1,
};

const rgb = (c: number): [number, number, number] => {
  const col = new THREE.Color(c);
  return [col.r, col.g, col.b];
};

/** 効果の組を 1 つの値にまとめる（重ねる規則は冒頭） */
export function mergeGrades(list: readonly RoomGrade[]): GradeValues {
  const v: GradeValues = { ...NEUTRAL_GRADE, tint: [1, 1, 1], hueKill: [0, 0.1, 0], mono: [1, 1, 1, 0], haze: [0, 0, 0, 0] };
  for (const g of list) {
    if (g.saturation !== undefined) v.saturation *= Math.max(0, g.saturation);
    if (g.tint) for (let i = 0; i < 3; i++) v.tint[i] = v.tint[i]! * Math.max(0, g.tint[i]!);
    if (g.hueKill && g.hueKill.amount > v.hueKill[2]) v.hueKill = [((g.hueKill.hue % 1) + 1) % 1, Math.max(0.01, Math.min(0.5, g.hueKill.width)), Math.min(1, g.hueKill.amount)];
    if (g.mono && g.mono.amount > v.mono[3]) v.mono = [...rgb(g.mono.color), Math.min(1, g.mono.amount)];
    if (g.haze && g.haze.amount > v.haze[3]) v.haze = [...rgb(g.haze.color), Math.min(1, g.haze.amount)];
    if (g.frost !== undefined) v.frost = Math.max(v.frost, Math.min(1, g.frost));
    if (g.ripple !== undefined) v.ripple = Math.max(v.ripple, Math.min(1, g.ripple));
    if (g.vignette !== undefined) v.vignette = Math.max(v.vignette, Math.min(1, g.vignette));
    if (g.contrast !== undefined) v.contrast *= Math.max(0.2, g.contrast);
  }
  return v;
}

/** a を b へ k（0..1）だけ寄せる */
export function blendGrade(a: GradeValues, b: Readonly<GradeValues>, k: number): void {
  const m = (x: number, y: number): number => x + (y - x) * k;
  a.saturation = m(a.saturation, b.saturation);
  a.frost = m(a.frost, b.frost);
  a.ripple = m(a.ripple, b.ripple);
  a.vignette = m(a.vignette, b.vignette);
  a.contrast = m(a.contrast, b.contrast);
  for (let i = 0; i < 3; i++) a.tint[i] = m(a.tint[i]!, b.tint[i]!);
  // 色相・色は量が 0 の側の値に引きずられないよう、量のある側の色をそのまま使う
  if (b.hueKill[2] > 0.001) { a.hueKill[0] = b.hueKill[0]; a.hueKill[1] = b.hueKill[1]; }
  a.hueKill[2] = m(a.hueKill[2], b.hueKill[2]);
  if (b.mono[3] > 0.001) { a.mono[0] = b.mono[0]; a.mono[1] = b.mono[1]; a.mono[2] = b.mono[2]; }
  a.mono[3] = m(a.mono[3], b.mono[3]);
  if (b.haze[3] > 0.001) { a.haze[0] = b.haze[0]; a.haze[1] = b.haze[1]; a.haze[2] = b.haze[2]; }
  a.haze[3] = m(a.haze[3], b.haze[3]);
}

/** 効果が無いのと同じか（pass を外してよいか） */
export function isNeutral(v: Readonly<GradeValues>, eps = 0.004): boolean {
  return Math.abs(v.saturation - 1) < eps && Math.abs(v.contrast - 1) < eps && v.tint.every((x) => Math.abs(x - 1) < eps) &&
    v.hueKill[2] < eps && v.mono[3] < eps && v.haze[3] < eps && v.frost < eps && v.ripple < eps && v.vignette < eps;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uSat;
uniform vec3 uTint;
uniform vec3 uHueKill;
uniform vec4 uMono;
uniform vec4 uHaze;
uniform float uFrost;
uniform float uRipple;
uniform float uVignette;
uniform float uContrast;
uniform float uTime;
uniform float uAspect;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
float hueOf(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn;
  if (d < 1e-5) return 0.0;
  float h = mx == c.r ? mod((c.g - c.b) / d, 6.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
  return h / 6.0;
}

void main() {
  vec2 uv = vUv;
  if (uRipple > 0.0) uv += uRipple * 0.008 * vec2(sin(uv.y * 38.0 + uTime * 3.1), cos(uv.x * 31.0 + uTime * 2.4));
  vec4 tex = texture2D(tDiffuse, uv);
  vec3 c = max(tex.rgb, vec3(0.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (uHueKill.z > 0.0) {
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
    float d = abs(hueOf(c) - uHueKill.x);
    d = min(d, 1.0 - d);
    float w = (1.0 - smoothstep(uHueKill.y * 0.5, uHueKill.y, d)) * smoothstep(0.06, 0.22, sat);
    c = mix(c, vec3(l), w * uHueKill.z);
  }
  c = mix(vec3(l), c, uSat);
  if (uContrast != 1.0) c = 0.18 * pow(max(c, vec3(1e-5)) / 0.18, vec3(uContrast));
  c *= uTint;
  if (uMono.a > 0.0) c = mix(c, uMono.rgb * l * 1.6, uMono.a);
  if (uHaze.a > 0.0) c = mix(c, uHaze.rgb, uHaze.a);
  if (uFrost > 0.0) {
    vec2 q = vec2(vUv.x * uAspect, vUv.y);
    float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
    float n = fbm(q * 6.0);
    float crystal = fbm(q * 34.0 + 7.0);
    float f = smoothstep(1.0 - uFrost * 0.8, 1.12 - uFrost * 0.45, e + (n - 0.5) * 0.4);
    vec3 ice = vec3(0.62, 0.76, 0.9) * (0.55 + 0.7 * crystal) * (0.35 + 0.9 * min(l, 1.0));
    c = mix(c, ice, f * 0.88);
    c *= mix(vec3(1.0), vec3(0.86, 0.94, 1.1), uFrost * 0.6);
  }
  if (uVignette > 0.0) c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length((vUv - 0.5) * vec2(1.25, 1.0)) * 1.35);
  gl_FragColor = vec4(c, tex.a);
}
`;

/** 部屋の画面効果の pass（OutputPass の前。読み → 書き） */
export class GradePass extends Pass {
  readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private time = 0;

  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({
      name: 'RoomGrade',
      uniforms: {
        tDiffuse: { value: null }, uSat: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uHueKill: { value: new THREE.Vector3(0, 0.1, 0) },
        uMono: { value: new THREE.Vector4(1, 1, 1, 0) }, uHaze: { value: new THREE.Vector4(0, 0, 0, 0) }, uFrost: { value: 0 }, uRipple: { value: 0 },
        uVignette: { value: 0 }, uContrast: { value: 1 }, uTime: { value: 0 }, uAspect: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  /** 値を uniform に写す */
  apply(v: Readonly<GradeValues>, dt: number): void {
    this.time += dt;
    const u = this.material.uniforms;
    u.uSat!.value = v.saturation;
    (u.uTint!.value as THREE.Vector3).set(...v.tint);
    (u.uHueKill!.value as THREE.Vector3).set(...v.hueKill);
    (u.uMono!.value as THREE.Vector4).set(...v.mono);
    (u.uHaze!.value as THREE.Vector4).set(...v.haze);
    u.uFrost!.value = v.frost;
    u.uRipple!.value = v.ripple;
    u.uVignette!.value = v.vignette;
    u.uContrast!.value = v.contrast;
    u.uTime!.value = this.time;
  }

  override setSize(width: number, height: number): void {
    this.material.uniforms.uAspect!.value = width / Math.max(1, height);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.material.uniforms.tDiffuse!.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

/**
 * 効果の頼み（key ごと。頼まれたフレームの番号付き）を集め、ゆっくり寄せた値を持つ。PostFX が 1 つ持つ
 */
export class RoomGradeState {
  private readonly requests = new Map<string, { g: RoomGrade; frame: number }>();
  readonly current: GradeValues = { ...NEUTRAL_GRADE, tint: [1, 1, 1], hueKill: [0, 0.1, 0], mono: [1, 1, 1, 0], haze: [0, 0, 0, 0] };
  /** 寄せる速さ（1/秒） */
  rate = 3.5;

  set(key: string, g: RoomGrade | null, frame: number): void {
    if (g) this.requests.set(key, { g, frame });
    else this.requests.delete(key);
  }

  /** frame のフレームに頼まれた効果へ寄せる。戻り値: 効果が残っているか */
  update(frame: number, dt: number): boolean {
    const live: RoomGrade[] = [];
    for (const [k, r] of this.requests) {
      if (r.frame >= frame - 1) live.push(r.g);
      else this.requests.delete(k);
    }
    const target = mergeGrades(live);
    blendGrade(this.current, target, 1 - Math.exp(-this.rate * Math.max(0, dt)));
    if (!live.length && isNeutral(this.current)) {
      blendGrade(this.current, NEUTRAL_GRADE, 1);
      return false;
    }
    return true;
  }
}
