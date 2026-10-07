import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import type { HField } from './hfield.ts';

/**
 * プールの水面（場面専用のシェーダー）。
 * - 視線を水面で屈折させ、底の升目（HField）をたどって当たった所の底・段の側面を塗る（タイル目地・日の当たり・コースティクス）
 * - 水の中の道のりで色を吸収（赤が早く減る → 浅い所は明るい青緑、深い所は暗い青緑）
 * - 平面の鏡像の映り込み（フレネル）
 * - 最後に明るさを段に丸める（ワールド座標のノイズで境目をずらす → ちぎれた平らな色面）
 * - 霧（場面と同じ）と後処理用の情報（法線・ID・線の重み 0）
 */
export interface WaterParams {
  /** 底のタイルの日なた・陰の色（吸収の前） */
  bottomLit: string;
  bottomShade: string;
  /** 側面（段の壁）の陰 */
  wallShade: string;
  grout: string;
  tile: number;
  groutWidth: number;
  /** 吸収の係数（1/m、RGB） */
  absorb: [number, number, number];
  /** 深い所の色（散乱光） */
  deep: string;
  /** 映り込み: 正面での反射率・強さの倍率・映り込みの色 */
  r0: number;
  reflGain: number;
  reflTint: string;
  /** 映り込みのゆがみ（画面座標）・波の大きさ（1/m）・波の高さ */
  distort: number;
  waveScale: number;
  waveAmp: number;
  /** 波の勾配を段に丸める（0 で無し） */
  waveQuant: number;
  /** 明るさの段数（0 で無し）・境目のノイズ */
  posterize: number;
  posterNoise: number;
  /** 映り込みだけを段に丸める段数 */
  reflPosterize: number;
  caustics: number;
  /** 日の当たる所の明るさの倍率 */
  sunGain: number;
  /** 波・段の境目のノイズの横長さ（Z 方向の縮み。1 で等方） */
  aniso: number;
  /** 物の際の白い泡（強さ・幅 m・色） */
  foam: number;
  foamWidth: number;
  foamColor: string;
  /** 水底の光のまだら（天窓からの光が波でゆらいだもの。影の地図とは別に描く）: 範囲 x0, z0, x1, z1 と量（0..1）、しきい値 */
  patch: [number, number, number, number];
  patchAmount: number;
  patchThreshold: number;
  /** まだらの大きさ（1/m） */
  patchScale: number;
  /** 日の当たる底の欠け（波で光が集まらない所が暗い穴になる）: 量 0..1・しきい値・大きさ（1/m）・縁のゆがみ（m） */
  litHoles: [number, number, number, number];
  /** 段の側面（水中の壁）に日が当たる割合（0 で常に wallShade） */
  wallLit: number;
  /** 明るい物の映り込みだけを強く出す: [明るさのしきい値（OKLab の L）, 強さ 0..1]。白い柱・通路の映り込みが白くちぎれて出る */
  reflKey: [number, number];
  /** 映り込みが水の中（底）より明るい所だけ映り込みを出す: [強さ 0..1, 明るさの差のしきい値]。暗い底には柱の映り込み、明るい底はそのまま */
  reflOver: [number, number];
  /** reflOver を出す範囲（x0, z0, x1, z1。ワールド座標。幅 0 なら全体） */
  reflRect: [number, number, number, number];
  /** 底をたどる位置を横にゆがめる: [量 m, 大きさ 1/m]。水路の縁が映り込みのように波打つ */
  bottomWarp: [number, number];
}

export const WATER_DEFAULTS: WaterParams = {
  bottomLit: '#f4f6e8',
  bottomShade: '#9fbcb2',
  wallShade: '#8fb0a8',
  grout: '#9fb1a5',
  tile: 0.25,
  groutWidth: 0.014,
  absorb: [2.6, 0.55, 0.62],
  deep: '#1f5a5e',
  r0: 0.04,
  reflGain: 1.0,
  reflTint: '#ffffff',
  distort: 0.012,
  waveScale: 1.2,
  waveAmp: 0.12,
  waveQuant: 0,
  posterize: 0,
  posterNoise: 0.4,
  reflPosterize: 0,
  caustics: 0.4,
  sunGain: 1.0,
  aniso: 2.5,
  foam: 0,
  foamWidth: 0.3,
  foamColor: '#f4f7ec',
  patch: [0, 0, 0, 0],
  patchAmount: 0,
  patchThreshold: 0.0,
  patchScale: 0.8,
  litHoles: [0, 0.3, 1.2, 0],
  wallLit: 1,
  reflKey: [1, 0],
  reflOver: [0, 0.05],
  reflRect: [0, 0, 0, 0],
  bottomWarp: [0, 1],
};

const VS = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
precision highp sampler2DShadow;
varying vec3 vWorld;
uniform float uTime;
uniform float uShadowQuant;
uniform mat4 uSunShadowMatrix;
uniform sampler2DShadow uShadowMap;
uniform float uHasShadow;
uniform vec3 uSunDir;
uniform highp sampler2D uHeight;
uniform vec4 uHGrid;     // x0, z0, cell, base
uniform vec2 uHSize;
uniform sampler2D uReflTex;
uniform mat4 uReflMatrix;
uniform vec3 uBottomLit;
uniform vec3 uBottomShade;
uniform vec3 uWallShade;
uniform vec3 uGrout;
uniform vec2 uTile;      // size, grout width
uniform vec3 uAbsorb;
uniform vec3 uDeep;
uniform vec4 uRefl;      // r0, gain, distort, reflPosterize
uniform vec3 uReflTint;
uniform vec4 uWave;      // scale, amp, quant, caustics
uniform vec4 uPoster;    // levels, noise, sunGain, id
uniform vec4 uFoam;      // strength, width, aniso, -
uniform vec3 uFoamColor;
uniform vec4 uPatch;     // x0, z0, x1, z1
uniform vec3 uPatchAmt;  // amount, threshold, scale
uniform vec4 uLitHoles;  // amount, threshold, scale, warp
uniform float uWallLit;
uniform vec2 uReflKey;
uniform vec2 uReflOver;
uniform vec4 uReflRect;
uniform vec2 uBottomWarp;
${NOISE_GLSL}
${COLOR_GLSL}
${FOG_GLSL}

float hAt(ivec2 c) {
  if (c.x < 0 || c.y < 0 || float(c.x) >= uHSize.x || float(c.y) >= uHSize.y) return uHGrid.w;
  return texelFetch(uHeight, c, 0).r;
}

// 底の升目を視線でたどる。戻り値: 道のり t、当たった面の法線 n
float marchBottom(vec3 ro, vec3 rd, out vec3 n) {
  vec2 pos = (ro.xz - uHGrid.xy) / uHGrid.z;
  vec2 dir = rd.xz / uHGrid.z;
  ivec2 cell = ivec2(floor(pos));
  vec2 st = vec2(dir.x >= 0.0 ? 1.0 : -1.0, dir.y >= 0.0 ? 1.0 : -1.0);
  vec2 tDelta = vec2(abs(dir.x) > 1e-6 ? abs(1.0 / dir.x) : 1e9, abs(dir.y) > 1e-6 ? abs(1.0 / dir.y) : 1e9);
  vec2 fr = pos - floor(pos);
  vec2 tMax = vec2(st.x > 0.0 ? (1.0 - fr.x) : fr.x, st.y > 0.0 ? (1.0 - fr.y) : fr.y) * tDelta;
  float h = hAt(cell);
  n = vec3(0.0, 1.0, 0.0);
  if (h >= ro.y - 1e-4) return 0.0;
  for (int i = 0; i < 64; i++) {
    float tn = min(tMax.x, tMax.y);
    float yExit = ro.y + rd.y * tn;
    if (yExit <= h) {
      n = vec3(0.0, 1.0, 0.0);
      return (h - ro.y) / rd.y;
    }
    if (tMax.x < tMax.y) { cell.x += int(st.x); tMax.x += tDelta.x; n = vec3(-st.x, 0.0, 0.0); }
    else { cell.y += int(st.y); tMax.y += tDelta.y; n = vec3(0.0, 0.0, -st.y); }
    float hn = hAt(cell);
    if (yExit <= hn) return tn;
    h = hn;
  }
  n = vec3(0.0, 1.0, 0.0);
  return (h - ro.y) / rd.y;
}

float waveH(vec2 p) {
  p.y *= uFoam.z;
  return sl_fbm(vec3(p * uWave.x, uTime * 0.22), 3) + 0.35 * sl_vnoise(vec3(p * uWave.x * 3.1 + 7.0, uTime * 0.5));
}
// 近くに水面より上へ出た物（通路・柱）があるか（0..1）
float nearSolid(vec2 p, float r) {
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 q = p + vec2(cos(a), sin(a)) * r;
    ivec2 c = ivec2(floor((q - uHGrid.xy) / uHGrid.z));
    s = max(s, step(0.0, hAt(c)));
  }
  return s;
}

float sunShadow(vec3 q, vec3 n) {
  if (uHasShadow < 0.5) return 1.0;
  vec3 a = abs(n);
  if (uShadowQuant > 0.0) {
    vec3 cell = (floor(q / uShadowQuant) + 0.5) * uShadowQuant;
    if (a.y >= a.x && a.y >= a.z) q.xz = cell.xz; else if (a.x >= a.z) q.zy = cell.zy; else q.xy = cell.xy;
  }
  vec4 sc = uSunShadowMatrix * vec4(q + n * 0.05, 1.0);
  sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  return texture(uShadowMap, vec3(sc.xy, sc.z - 0.0008));
}

void main() {
  vec3 P = vWorld;
  vec3 V = normalize(P - cameraPosition);
  // 波（勾配。段に丸めると平らな面になる）
  float e = 0.06;
  float h0 = waveH(P.xz);
  vec2 g = vec2(waveH(P.xz + vec2(e, 0.0)) - h0, waveH(P.xz + vec2(0.0, e)) - h0) / e;
  if (uWave.z > 0.0) g = floor(g * uWave.z + 0.5) / uWave.z;
  vec3 N = normalize(vec3(-g.x * uWave.y, 1.0, -g.y * uWave.y));

  // 映り込み
  vec4 pc = uReflMatrix * vec4(P, 1.0);
  vec2 ruv = pc.xy / pc.w + N.xz * uRefl.z;
  vec3 reflRaw = texture2D(uReflTex, ruv).rgb;
  vec3 refl = reflRaw * uReflTint;
  if (uRefl.w > 0.0) {
    vec3 lab = sl_linToOklab(max(refl, 0.0));
    float nz = sl_fbm(vec3(P.xz * vec2(1.9, 1.9 * uFoam.z), uTime * 0.15), 3) * uPoster.y;
    lab.x = floor(lab.x * uRefl.w + 0.5 + nz) / uRefl.w;
    refl = sl_oklabToLin(lab);
  }

  // 屈折して底へ
  vec3 R = refract(V, N, 1.0 / 1.333);
  vec3 n;
  vec3 Pm = P;
  if (uBottomWarp.x > 0.0) {
    vec2 wq = P.xz * vec2(1.0, uFoam.z) * uBottomWarp.y;
    Pm.x += sl_fbm(vec3(wq, 3.1 + uTime * 0.06), 3) * uBottomWarp.x;
    Pm.z += sl_fbm(vec3(wq + 7.7, 5.3 + uTime * 0.06), 3) * uBottomWarp.x * 0.5;
  }
  float t = marchBottom(Pm, R, n);
  vec3 Q = Pm + R * t;
  vec2 tuv = n.y > 0.5 ? Q.xz : (abs(n.x) > 0.5 ? vec2(Q.z, Q.y) : vec2(Q.x, Q.y));
  vec2 tc = tuv / uTile.x;
  vec2 f = fract(tc);
  vec2 dl = min(f, 1.0 - f);
  vec2 aa = fwidth(tc) * 0.75;
  float lw = uTile.y / uTile.x * 0.5;
  float grout = max(1.0 - smoothstep(lw - aa.x, lw + aa.x, dl.x), 1.0 - smoothstep(lw - aa.y, lw + aa.y, dl.y));
  grout *= 1.0 - smoothstep(0.3, 0.7, max(aa.x, aa.y));
  float ndl = max(dot(n, uSunDir), 0.0);
  // 日の光も波で曲がる: 影を調べる位置を波の傾きでずらす（光の縁が波打つ）
  vec3 Qs = Q + vec3(N.x, 0.0, N.z) * uLitHoles.w * 10.0;
  float sh = ndl > 0.0 ? sunShadow(Qs, n) : 0.0;
  float lit = sh * step(0.05, ndl);
  if (uLitHoles.x > 0.0 && n.y > 0.5) {
    float hn = sl_warp(vec3(Q.xz * vec2(1.0, uFoam.z) * uLitHoles.z + N.xz * 3.0, uTime * 0.05), 3);
    lit *= 1.0 - uLitHoles.x * step(hn, uLitHoles.y);
  }
  if (uPatchAmt.x > 0.0 && n.y > 0.5) {
    vec2 pq = Q.xz;
    vec2 e2 = min(pq - uPatch.xy, uPatch.zw - pq);
    float edge = min(e2.x, e2.y);
    float nz = sl_warp(vec3(pq * vec2(1.0, uFoam.z) * uPatchAmt.z + N.xz * 2.0, uTime * 0.08), 4);
    float mk = step(uPatchAmt.y - clamp(edge, -2.0, 1.5) * 0.25, nz);
    lit = max(lit, mk * uPatchAmt.x);
  }
  if (n.y < 0.5) lit *= uWallLit;
  vec3 base = n.y > 0.5 ? uBottomShade : uWallShade;
  base = mix(base, uBottomLit * uPoster.z, lit);
  // コースティクス（日の当たる底だけ）
  if (uWave.w > 0.0) {
    vec2 vo = sl_voronoi(vec3(Q.xz * 1.5 + N.xz * 0.6, uTime * 0.3)).xy;
    float c = smoothstep(0.12, 0.0, vo.y - vo.x);
    base += uBottomLit * c * uWave.w * (0.25 + 0.75 * lit);
  }
  base = mix(base, base * uGrout, grout);
  // 吸収: 視線の水中の道のり + 日の光の水中の道のり（底まで）
  float depthQ = max(-Q.y, 0.0);
  float path = t + depthQ / max(uSunDir.y, 0.3) * 0.5;
  vec3 tr = exp(-uAbsorb * path);
  vec3 under = base * tr + uDeep * (1.0 - tr);

  // フレネル
  float cosi = clamp(-dot(V, N), 0.0, 1.0);
  float F = uRefl.x + (1.0 - uRefl.x) * pow(1.0 - cosi, 5.0);
  F = clamp(F * uRefl.y, 0.0, 1.0);
  vec3 col = mix(under, refl, F);
  if (uReflOver.x > 0.0) {
    float lu = sl_linToOklab(max(under, 0.0)).x;
    float lr2 = sl_linToOklab(max(reflRaw, 0.0)).x;
    float nz2 = sl_fbm(vec3(P.xz * vec2(1.6, 1.6 * uFoam.z), uTime * 0.15), 3) * 0.06;
    float inR = 1.0;
    if (uReflRect.z > uReflRect.x) {
      vec2 e3 = min(P.xz - uReflRect.xy, uReflRect.zw - P.xz);
      inR = step(0.0, min(e3.x, e3.y) + nz2 * 4.0);
    }
    col = mix(col, reflRaw, step(lu + uReflOver.y + nz2, lr2) * uReflOver.x * inR);
  }
  if (uReflKey.y > 0.0) {
    // 明るい映り込み（白い物）だけを強く重ねる。境目はワールド座標のノイズでちぎる
    float lr = sl_linToOklab(max(reflRaw, 0.0)).x;
    float nz = sl_fbm(vec3(P.xz * vec2(2.2, 2.2 * uFoam.z), uTime * 0.2), 3) * 0.05;
    col = mix(col, reflRaw * mix(uReflTint, vec3(1.0), 0.6), step(uReflKey.x + nz, lr) * uReflKey.y);
  }

  // 物の際の白い泡（ギザギザ）
  if (uFoam.x > 0.0) {
    float n = sl_fbm(vec3(P.xz * vec2(3.0, 3.0 * uFoam.z), uTime * 0.3), 3);
    float r = uFoam.y * (0.55 + 0.45 * n);
    float f = max(nearSolid(P.xz, r * 0.5), nearSolid(P.xz, r)) * step(0.0, n + 0.25);
    col = mix(col, uFoamColor, f * uFoam.x);
  }

  // 明るさを段に丸める（ちぎれた平らな色面）
  if (uPoster.x > 0.0) {
    vec3 lab = sl_linToOklab(max(col, 0.0));
    float nz = sl_warp(vec3(P.xz * vec2(0.9, 0.9 * uFoam.z), 0.5 + uTime * 0.05), 3) * uPoster.y;
    float q = floor(lab.x * uPoster.x + nz + 0.5);
    lab.x = (q - nz) / uPoster.x;
    col = sl_oklabToLin(lab);
  }

  col = sl_applyFog(col, P, cameraPosition);
  gl_FragColor = vec4(col, 1.0);
  vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  gInfo = vec4(vn.xy * 0.5 + 0.5, uPoster.w, 0.0);
}`;

export interface Water {
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  /** 毎フレーム（描画の前）: 影の地図・日の向き */
  update(sun: THREE.DirectionalLight): void;
  /** 見た目を入れ替える（既定値 + 作ったときの値 + q） */
  set(p: Partial<WaterParams>): void;
}

export function createWater(hf: HField, refl: PlanarReflector, size: [number, number, number, number], p0: Partial<WaterParams> = {}): Water {
  const p: WaterParams = { ...WATER_DEFAULTS, ...p0 };
  const u = {
    ...styleUniforms,
    uShadowMap: { value: null as THREE.Texture | null },
    uHasShadow: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uHeight: { value: hf.texture() },
    uHGrid: { value: new THREE.Vector4(hf.x0, hf.z0, hf.cell, hf.base) },
    uHSize: { value: new THREE.Vector2(hf.nx, hf.nz) },
    uReflTex: { value: refl.target.texture },
    uReflMatrix: { value: refl.matrix },
    uBottomLit: { value: new THREE.Color() },
    uBottomShade: { value: new THREE.Color() },
    uWallShade: { value: new THREE.Color() },
    uGrout: { value: new THREE.Color() },
    uTile: { value: new THREE.Vector2() },
    uAbsorb: { value: new THREE.Vector3() },
    uDeep: { value: new THREE.Color() },
    uRefl: { value: new THREE.Vector4() },
    uReflTint: { value: new THREE.Color() },
    uWave: { value: new THREE.Vector4() },
    uPoster: { value: new THREE.Vector4(0, 0, 1, 0.37) },
    uFoam: { value: new THREE.Vector4() },
    uFoamColor: { value: new THREE.Color() },
    uPatch: { value: new THREE.Vector4() },
    uPatchAmt: { value: new THREE.Vector3() },
    uLitHoles: { value: new THREE.Vector4() },
    uWallLit: { value: 1 },
    uReflKey: { value: new THREE.Vector2(1, 0) },
    uReflOver: { value: new THREE.Vector2(0, 0.05) },
    uReflRect: { value: new THREE.Vector4() },
    uBottomWarp: { value: new THREE.Vector2(0, 1) },
  };
  const material = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, fog: false });
  const apply = (q: WaterParams): void => {
    u.uBottomLit.value.set(q.bottomLit);
    u.uBottomShade.value.set(q.bottomShade);
    u.uWallShade.value.set(q.wallShade);
    // 目地は色の倍率（日なた・陰どちらにも掛ける）
    const gl = new THREE.Color(q.grout);
    const bl = new THREE.Color(q.bottomLit);
    u.uGrout.value.setRGB(gl.r / Math.max(bl.r, 1e-3), gl.g / Math.max(bl.g, 1e-3), gl.b / Math.max(bl.b, 1e-3));
    u.uTile.value.set(q.tile, q.groutWidth);
    u.uAbsorb.value.set(...q.absorb);
    u.uDeep.value.set(q.deep);
    u.uRefl.value.set(q.r0, q.reflGain, q.distort, q.reflPosterize);
    u.uReflTint.value.set(q.reflTint);
    u.uWave.value.set(q.waveScale, q.waveAmp, q.waveQuant, q.caustics);
    u.uPoster.value.set(q.posterize, q.posterNoise, q.sunGain, 0.37);
    u.uFoam.value.set(q.foam, q.foamWidth, q.aniso, 0);
    u.uFoamColor.value.set(q.foamColor);
    u.uPatch.value.set(...q.patch);
    u.uPatchAmt.value.set(q.patchAmount, q.patchThreshold, q.patchScale);
    u.uLitHoles.value.set(...q.litHoles);
    u.uWallLit.value = q.wallLit;
    u.uReflKey.value.set(...q.reflKey);
    u.uReflOver.value.set(...q.reflOver);
    u.uReflRect.value.set(...q.reflRect);
    u.uBottomWarp.value.set(...q.bottomWarp);
  };
  apply(p);
  const [x0, z0, x1, z1] = size;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'water';
  // ほかの不透明な物の後に描く（隠れた所で重いシェーダーを走らせない）
  mesh.renderOrder = 10;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  refl.hide.push(mesh);
  return {
    material,
    mesh,
    update(sun) {
      const map = sun.shadow.map?.depthTexture ?? null;
      u.uShadowMap.value = map;
      u.uHasShadow.value = map ? 1 : 0;
      u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
    },
    // 区域を切り替えるときは既定値から作り直す（前の区域の値を持ち越さない）
    set(q) {
      Object.assign(p, WATER_DEFAULTS, p0, q);
      apply(p);
    },
  };
}
