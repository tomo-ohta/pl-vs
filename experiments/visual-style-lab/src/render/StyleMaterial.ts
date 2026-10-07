import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL, PLANAR_GLSL } from './glsl.ts';
import { LAMP_GLSL } from './Lamps.ts';
import { shiftColor, styleUniforms, type StylePreset } from './Style.ts';

/**
 * 参考画像の見た目の材質。three の MeshStandardMaterial に次を足す。
 * - 段落とし（トゥーン）: 照明の明るさ（色指定に対する倍率）を段に丸め、段ごとの色（日なた・陰・暗部・ハイライト）を塗る。
 *   段の境目はワールド座標のねじったノイズでずらす（ちぎった紙のような縁。カメラが動いても模様は泳がない）
 * - 影をタイルの升目単位に丸める（プール）
 * - 手続きの模様: タイル目地・壁のかすれ・白い斑・水たまり
 * - 平面の鏡像の映り込み（水たまり・水面）
 * - 距離と高さの霧（空と同じ色）
 * - 後処理用の情報（法線・ID・線の重み）を 2 枚目の出力へ
 */

export interface TilePattern {
  /** タイルの大きさ（m）。[横, 縦] */
  size: number | [number, number];
  /** 目地の幅（m） */
  line: number;
  /** 目地の色 */
  color: THREE.ColorRepresentation;
  /** タイルごとの明るさのばらつき（0〜） */
  jitter?: number;
  /** 目地を所々途切れさせる（0〜1） */
  broken?: number;
  offset?: [number, number];
}

export interface FleckPattern {
  /** 1 m あたりの升目の数 */
  scale: number;
  /** 升目に傷がある割合 */
  density: number;
  color: THREE.ColorRepresentation;
  /** 傷の長さ・幅（升目に対する割合） */
  length: number;
  width: number;
  /** 2 色目（暗い傷） */
  color2?: THREE.ColorRepresentation;
  density2?: number;
}

export interface BlotchPattern {
  color: THREE.ColorRepresentation;
  /** ノイズの大きさ（1/m） */
  scale: number;
  /** しきい値（-1〜1。大きいほど少ない） */
  threshold: number;
  /** 高さで減らす: [この高さから, この高さまでに] しきい値が yGain 上がる（m） */
  yRange?: [number, number];
  /** 高さによるしきい値の上がり方 */
  yGain?: number;
  /** 位置でしきい値を変える: しきい値 += dot(p - origin, linear) + dot(|p - origin|, abs) */
  grad?: { origin: [number, number, number]; linear?: [number, number, number]; abs?: [number, number, number] };
  /** 床（上向きの面）だけに出す / 壁だけ */
  only?: 'floor' | 'wall';
}

export interface PuddlePattern {
  scale: number;
  threshold: number;
  /** 水たまりの外の濡れ（暗く）0〜1 */
  wetDarken?: number;
}

export interface ReflectionSource {
  texture: THREE.Texture;
  matrix: THREE.Matrix4;
}

export interface StyleMaterialOptions {
  /** 日なたの色（色指定のノーマル色） */
  color: THREE.ColorRepresentation;
  /** 陰の色（省略時は場面の既定の変え方で作る） */
  shade?: THREE.ColorRepresentation;
  /** 暗部の色 */
  dark?: THREE.ColorRepresentation;
  /** ハイライトの色 */
  hi?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  roughness?: number;
  metalness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  /** 段落としの強さ（場面の値に掛ける。0 で普通の描画） */
  toon?: number;
  /** 境目のノイズの強さ・大きさの倍率 */
  noise?: [number, number];
  /** 下向きの面の照り返し（場面の toon.bounce を上書き） */
  bounce?: number;
  /** 影をタイルの升目に丸める・ずらす（場面の shadowQuant / shadowJitter）をこの材質で使うか（既定 true） */
  shadowQuant?: boolean;
  /** 名前（__lab.mats() で見つけて色を変える・調整用） */
  name?: string;
  /** 鏡面反射を段落としで消す割合（既定 1） */
  specKill?: number;
  /** 線の重み（0 で線を引かない） */
  line?: number;
  /** 霧を掛けない（空・光源など） */
  noFog?: boolean;
  /** 照明を使わない（色そのまま） */
  unlit?: boolean;
  tiles?: TilePattern;
  flecks?: FleckPattern;
  blotch?: BlotchPattern;
  puddle?: PuddlePattern;
  reflection?: ReflectionSource & {
    strength: number;
    /** 映り込みのゆがみ（ノイズの強さ） */
    distort?: number;
    /** 映り込みの明るさを段に丸める（0 で無し） */
    posterize?: number;
    /** 水たまりの中だけ（puddle が必要） */
    puddleOnly?: boolean;
    /** 映り込みの色を掛ける */
    tint?: THREE.ColorRepresentation;
    /** フレネル（0 = 常に strength、1 = 視線が浅いほど強い） */
    fresnel?: number;
    /** 明るい映り込みだけ出す（映った色の明るさがこのしきい値を超えた所だけ。0 で全部） */
    key?: number;
    keySoft?: number;
  };
  /** 水面下の色の吸収（プールの底） */
  underwater?: { level: number; color: THREE.ColorRepresentation; depth: number; caustics?: number };
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  depthWrite?: boolean;
  /** 影を受けるか（シェーダー側。メッシュの receiveShadow も必要） */
  alphaTest?: number;
}

let idCounter = 0;

export function createStyleMaterial(style: StylePreset, o: StyleMaterialOptions): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: o.color,
    map: o.map ?? null,
    roughness: o.roughness ?? 1,
    metalness: o.metalness ?? 0,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    vertexColors: o.vertexColors ?? false,
    depthWrite: o.depthWrite ?? true,
    alphaTest: o.alphaTest ?? 0,
  });

  const lit = new THREE.Color(o.color);
  const shade = o.shade !== undefined ? new THREE.Color(o.shade) : shiftColor(o.color, style.toon.shade);
  const dark = o.dark !== undefined ? new THREE.Color(o.dark) : shiftColor(o.color, style.toon.dark);
  const hi = o.hi !== undefined ? new THREE.Color(o.hi) : shiftColor(o.color, style.toon.hi);
  const ratio = (c: THREE.Color): THREE.Vector3 =>
    new THREE.Vector3(c.r / Math.max(lit.r, 1e-4), c.g / Math.max(lit.g, 1e-4), c.b / Math.max(lit.b, 1e-4));

  const defines: Record<string, string | number> = {};
  if (!o.unlit && (o.toon ?? 1) > 0) defines.SL_TOON = 1;
  if (o.unlit) defines.SL_UNLIT = 1;
  if (o.noFog) defines.SL_NOFOG = 1;
  if (o.tiles) defines.SL_TILES = 1;
  if (o.flecks) defines.SL_FLECKS = 1;
  if (o.flecks?.color2 !== undefined) defines.SL_FLECKS2 = 1;
  if (o.blotch) defines.SL_BLOTCH = 1;
  if (o.puddle) defines.SL_PUDDLE = 1;
  if (o.reflection) defines.SL_REFLECT = 1;
  if (o.reflection?.puddleOnly) defines.SL_REFLECT_PUDDLE = 1;
  if (o.underwater) defines.SL_UNDERWATER = 1;
  mat.defines = { ...(mat.defines ?? {}), ...defines };

  const tileSize = o.tiles ? (Array.isArray(o.tiles.size) ? o.tiles.size : [o.tiles.size, o.tiles.size]) : [1, 1];
  const u = {
    uSlRatioShade: { value: ratio(shade) },
    uSlRatioDark: { value: ratio(dark) },
    uSlRatioHi: { value: ratio(hi) },
    uSlToon: { value: o.toon ?? 1 },
    uSlNoiseMul: { value: new THREE.Vector2(...(o.noise ?? [1, 1])) },
    uSlSpecKill: { value: o.specKill ?? 1 },
    uSlBounce: { value: o.bounce ?? -1 },
    uSlQuant: { value: o.shadowQuant === false ? 0 : 1 },
    uSlLine: { value: o.line ?? 1 },
    uSlId: { value: ((idCounter++ * 0.618034) % 1) * 0.9 + 0.05 },
    uSlTile: { value: new THREE.Vector4(tileSize[0], tileSize[1], o.tiles?.line ?? 0.01, o.tiles?.jitter ?? 0) },
    uSlTileOffset: { value: new THREE.Vector3(o.tiles?.offset?.[0] ?? 0, o.tiles?.offset?.[1] ?? 0, o.tiles?.broken ?? 0) },
    uSlTileColor: { value: new THREE.Color(o.tiles?.color ?? 0x000000) },
    uSlFleck: { value: new THREE.Vector4(o.flecks?.scale ?? 1, o.flecks?.density ?? 0, o.flecks?.length ?? 0.3, o.flecks?.width ?? 0.05) },
    uSlFleckColor: { value: new THREE.Color(o.flecks?.color ?? 0xffffff) },
    uSlFleckColor2: { value: new THREE.Color(o.flecks?.color2 ?? 0x000000) },
    uSlFleckDensity2: { value: o.flecks?.density2 ?? 0 },
    uSlBlotch: { value: new THREE.Vector4(o.blotch?.scale ?? 1, o.blotch?.threshold ?? 1, o.blotch?.yGain ?? 0, 0) },
    uSlBlotchY: { value: new THREE.Vector2(...(o.blotch?.yRange ?? [0, 0])) },
    uSlBlotchO: { value: new THREE.Vector3(...(o.blotch?.grad?.origin ?? [0, 0, 0])) },
    uSlBlotchLin: { value: new THREE.Vector3(...(o.blotch?.grad?.linear ?? [0, 0, 0])) },
    uSlBlotchAbs: { value: new THREE.Vector3(...(o.blotch?.grad?.abs ?? [0, 0, 0])) },
    uSlBlotchColor: { value: new THREE.Color(o.blotch?.color ?? 0xffffff) },
    uSlBlotchOnly: { value: o.blotch?.only === 'floor' ? 1 : o.blotch?.only === 'wall' ? 2 : 0 },
    uSlPuddle: { value: new THREE.Vector3(o.puddle?.scale ?? 1, o.puddle?.threshold ?? 1, o.puddle?.wetDarken ?? 0) },
    uSlReflTex: { value: o.reflection?.texture ?? null },
    uSlReflMatrix: { value: o.reflection?.matrix ?? new THREE.Matrix4() },
    uSlRefl: { value: new THREE.Vector4(o.reflection?.strength ?? 0, o.reflection?.distort ?? 0, o.reflection?.posterize ?? 0, o.reflection?.fresnel ?? 0) },
    uSlReflTint: { value: new THREE.Color(o.reflection?.tint ?? 0xffffff) },
    uSlReflKey: { value: new THREE.Vector2(o.reflection?.key ?? 0, o.reflection?.keySoft ?? 0.05) },
    uSlWater: { value: new THREE.Vector4(o.underwater?.level ?? 0, o.underwater?.depth ?? 1, o.underwater?.caustics ?? 0, 0) },
    uSlWaterColor: { value: new THREE.Color(o.underwater?.color ?? 0x000000) },
  };
  mat.userData.sl = u;
  mat.userData.slOptions = o;
  if (o.name) mat.name = o.name;

  const key = 'sl:' + Object.keys(defines).sort().join(',');
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, styleUniforms, u);
    shader.vertexShader = patchVertex(shader.vertexShader);
    shader.fragmentShader = patchFragment(shader.fragmentShader);
  };
  return mat;
}

/** 後で色を変える（見た目合わせ用） */
export function setStyleColors(mat: THREE.Material, style: StylePreset, c: { color?: THREE.ColorRepresentation; shade?: THREE.ColorRepresentation; dark?: THREE.ColorRepresentation; hi?: THREE.ColorRepresentation }): void {
  const m = mat as THREE.MeshStandardMaterial;
  const o = m.userData.slOptions as StyleMaterialOptions | undefined;
  const u = m.userData.sl;
  if (!o || !u) return;
  Object.assign(o, c);
  const lit = new THREE.Color(o.color);
  m.color.copy(lit);
  const ratio = (x: THREE.Color): THREE.Vector3 => new THREE.Vector3(x.r / Math.max(lit.r, 1e-4), x.g / Math.max(lit.g, 1e-4), x.b / Math.max(lit.b, 1e-4));
  u.uSlRatioShade.value = ratio(o.shade !== undefined ? new THREE.Color(o.shade) : shiftColor(o.color, style.toon.shade));
  u.uSlRatioDark.value = ratio(o.dark !== undefined ? new THREE.Color(o.dark) : shiftColor(o.color, style.toon.dark));
  u.uSlRatioHi.value = ratio(o.hi !== undefined ? new THREE.Color(o.hi) : shiftColor(o.color, style.toon.hi));
}

function replaceOnce(src: string, find: string, rep: string): string {
  const i = src.indexOf(find);
  if (i < 0) throw new Error('StyleMaterial: chunk not found: ' + find);
  return src.slice(0, i) + rep + src.slice(i + find.length);
}

function patchVertex(vs: string): string {
  vs = replaceOnce(vs, '#include <common>', '#include <common>\nvarying vec3 vSlWorld;');
  vs = replaceOnce(
    vs,
    '#include <project_vertex>',
    `#include <project_vertex>
  {
    vec4 slw = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      slw = batchingMatrix * slw;
    #endif
    #ifdef USE_INSTANCING
      slw = instanceMatrix * slw;
    #endif
    vSlWorld = (modelMatrix * slw).xyz;
  }`,
  );
  return vs;
}

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogHorizon;
uniform vec3 uFogZenith;
uniform vec3 uFogGround;
uniform vec4 uFogParams;
uniform vec4 uFogParams2;
uniform vec3 uFogGlowColor;
uniform vec3 uFogGlowDir;
uniform vec3 uFogExtinction;
vec3 sl_fogColor(vec3 rd) {
  float e = rd.y;
  vec3 c = e >= 0.0 ? mix(uFogHorizon, uFogZenith, smoothstep(0.0, 0.55, e)) : mix(uFogHorizon, uFogGround, smoothstep(0.0, 0.35, -e));
  if (uFogParams2.z > 0.0) c += uFogGlowColor * uFogParams2.z * pow(max(dot(rd, uFogGlowDir), 0.0), uFogParams2.w);
  return c;
}
// 光学的な厚さ（霧の濃さ × 距離）
float sl_fogOptical(vec3 wp, vec3 ro) {
  vec3 rd = wp - ro;
  float dist = length(rd);
  rd /= max(dist, 1e-5);
  float d = max(dist - uFogParams.w, 0.0);
  float dens = uFogParams.x;
  float b = uFogParams.y;
  if (b > 0.0) {
    float h0 = ro.y + rd.y * min(dist, uFogParams.w) - uFogParams.z;
    float k = dens * exp(-b * h0);
    float by = b * rd.y * d;
    float integ = abs(by) > 1e-4 ? (1.0 - exp(-by)) / (b * rd.y) : d;
    return k * integ;
  }
  return dens * d;
}
// 霧を掛ける。steps > 0 なら段にする（境目はワールド座標のノイズでずらす）
vec3 sl_applyFog(vec3 col, vec3 wp, vec3 ro) {
  float od = sl_fogOptical(wp, ro);
  float fa = 1.0 - exp(-od);
  if (uFogParams2.y > 0.0) {
    float st = uFogParams2.y;
    float nz = sl_warp(wp * 0.35, 3) * 0.7;
    fa = clamp(floor(fa * st + 0.5 + nz) / st, 0.0, 0.9999);
    od = -log(1.0 - fa);
  }
  fa = min(fa, uFogParams2.x);
  vec3 T = max(exp(-od * uFogExtinction), vec3(1.0 - uFogParams2.x));
  return col * T + sl_fogColor(normalize(wp - ro)) * fa;
}
`;

function patchFragment(fs: string): string {
  fs = replaceOnce(
    fs,
    '#include <common>',
    `#include <common>
layout(location = 1) out highp vec4 gInfo;
varying vec3 vSlWorld;
uniform float uTime;
uniform float uToonAmount;
uniform vec4 uToonThresh;
uniform vec2 uToonNoise;
uniform float uToonBounce;
uniform float uSlBounce;
uniform float uSlQuant;
uniform float uShadowQuant;
uniform float uShadowJitter;
uniform mat4 uSunShadowMatrix;
uniform float uSunShadowNormalBias;
uniform vec3 uSlRatioShade;
uniform vec3 uSlRatioDark;
uniform vec3 uSlRatioHi;
uniform float uSlToon;
uniform vec2 uSlNoiseMul;
uniform float uSlSpecKill;
uniform float uSlLine;
uniform float uSlId;
uniform vec4 uSlTile;
uniform vec3 uSlTileOffset;
uniform vec3 uSlTileColor;
uniform vec4 uSlFleck;
uniform vec3 uSlFleckColor;
uniform vec3 uSlFleckColor2;
uniform float uSlFleckDensity2;
uniform vec4 uSlBlotch;
uniform vec2 uSlBlotchY;
uniform vec3 uSlBlotchO;
uniform vec3 uSlBlotchLin;
uniform vec3 uSlBlotchAbs;
uniform vec3 uSlBlotchColor;
uniform float uSlBlotchOnly;
uniform vec3 uSlPuddle;
uniform sampler2D uSlReflTex;
uniform mat4 uSlReflMatrix;
uniform vec4 uSlRefl;
uniform vec3 uSlReflTint;
uniform vec2 uSlReflKey;
uniform vec4 uSlWater;
uniform vec3 uSlWaterColor;
${NOISE_GLSL}
${COLOR_GLSL}
${PLANAR_GLSL}
${FOG_GLSL}
${LAMP_GLSL}
// 1 つ目の平行光源の影（灯りにも効かせる）。lights_fragment_begin の影の計算で入れる
float slSunShadow = 1.0;
float sl_recShadow(float v, int idx) {
  if (idx == 0) slSunShadow = v;
  return v;
}
vec3 sl_geoNormal() {
  vec3 n = normalize(cross(dFdx(vSlWorld), dFdy(vSlWorld)));
  if (dot(n, cameraPosition - vSlWorld) < 0.0) n = -n;
  return n;
}
vec4 sl_shadowCoord(vec4 c, int idx) {
  if (idx != 0 || uSlQuant <= 0.0 || (uShadowQuant <= 0.0 && uShadowJitter <= 0.0)) return c;
  vec3 wn = sl_geoNormal();
  vec3 a = abs(wn);
  vec3 q = vSlWorld;
  if (uShadowJitter > 0.0) {
    // 影の縁をちぎる: 調べる位置を面に沿ってノイズでずらす
    vec3 j = vec3(sl_fbm(q * 2.7, 3), sl_fbm(q * 2.7 + 11.3, 3), sl_fbm(q * 2.7 + 23.1, 3));
    j += 0.35 * vec3(sl_vnoise(q * 19.0), sl_vnoise(q * 19.0 + 5.1), sl_vnoise(q * 19.0 + 9.7));
    j -= wn * dot(j, wn);
    q += j * uShadowJitter;
  }
  if (uShadowQuant > 0.0) {
    vec3 cell = (floor(q / uShadowQuant) + 0.5) * uShadowQuant;
    if (a.y >= a.x && a.y >= a.z) q.xz = cell.xz; else if (a.x >= a.z) q.zy = cell.zy; else q.xy = cell.xy;
  }
  return uSunShadowMatrix * vec4(q + wn * uSunShadowNormalBias, 1.0);
}
float sl_puddleMask() {
  float n = sl_warp(vec3(vSlWorld.xz * uSlPuddle.x, 0.37), 5);
  return step(uSlPuddle.y, n);
}
`,
  );

  // 影を升目に丸める・ずらす（1 つ目の平行光源だけ）。include はこの後で展開されるので、ここで展開して書き換える
  const lfb = THREE.ShaderChunk.lights_fragment_begin;
  const lfbPatched = lfb.replace(
    /getShadow\( directionalShadowMap\[ i \], (.*?), vDirectionalShadowCoord\[ i \] \)/,
    'sl_recShadow( getShadow( directionalShadowMap[ i ], $1, sl_shadowCoord( vDirectionalShadowCoord[ i ], UNROLLED_LOOP_INDEX ) ), UNROLLED_LOOP_INDEX )',
  );
  if (lfbPatched === lfb) throw new Error('StyleMaterial: shadow lookup not found in lights_fragment_begin');
  fs = replaceOnce(fs, '#include <lights_fragment_begin>', lfbPatched);

  // 模様（色指定に重ねる）
  fs = replaceOnce(
    fs,
    '#include <color_fragment>',
    `#include <color_fragment>
  vec3 slN = sl_geoNormal();
  vec2 slUV = sl_planarUV(vSlWorld, slN);
  float slPuddle = 0.0;
#ifdef SL_TILES
  {
    vec2 tuv = (slUV + uSlTileOffset.xy) / uSlTile.xy;
    vec2 cell = floor(tuv);
    vec2 f = fract(tuv);
    vec2 lw = uSlTile.z / uSlTile.xy;
    vec2 dl = min(f, 1.0 - f);
    vec2 aa = fwidth(tuv) * 0.75;
    float gx = 1.0 - smoothstep(lw.x * 0.5 - aa.x, lw.x * 0.5 + aa.x, dl.x);
    float gy = 1.0 - smoothstep(lw.y * 0.5 - aa.y, lw.y * 0.5 + aa.y, dl.y);
    float g = max(gx, gy);
    if (uSlTileOffset.z > 0.0) g *= step(uSlTileOffset.z, sl_hash12(cell * 1.37 + floor(f * 3.0)));
    // 遠くでは目地を薄くする（ちらつき防止）
    g *= 1.0 - smoothstep(0.25, 0.6, max(aa.x, aa.y) / max(lw.x, 1e-4) * 0.08);
    float j = (sl_hash12(cell) - 0.5) * uSlTile.w;
    diffuseColor.rgb *= 1.0 + j;
    diffuseColor.rgb = mix(diffuseColor.rgb, uSlTileColor, g);
  }
#endif
#ifdef SL_BLOTCH
  {
    bool ok = uSlBlotchOnly < 0.5 || (uSlBlotchOnly < 1.5 ? slN.y > 0.7 : abs(slN.y) < 0.3);
    if (ok) {
      float th = uSlBlotch.y;
      if (uSlBlotchY.y > uSlBlotchY.x) th += smoothstep(uSlBlotchY.x, uSlBlotchY.y, vSlWorld.y) * uSlBlotch.z;
      vec3 dp = vSlWorld - uSlBlotchO;
      th += dot(dp, uSlBlotchLin) + dot(abs(dp), uSlBlotchAbs);
      float n = sl_warp(vSlWorld * uSlBlotch.x, 5);
      diffuseColor.rgb = mix(diffuseColor.rgb, uSlBlotchColor, step(th, n));
    }
  }
#endif
#ifdef SL_FLECKS
  {
    vec2 p = slUV * uSlFleck.x;
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    vec3 h = sl_hash33(vec3(cell, floor(dot(slN, vec3(1.0, 2.0, 3.0)) * 7.0)));
    vec2 c = (h.xy - 0.5) * 0.6;
    vec2 d = abs(f - c);
    float len = uSlFleck.z * (0.4 + h.z);
    float on = step(d.x, uSlFleck.w) * step(d.y, len * 0.5);
    if (h.z < uSlFleck.y) diffuseColor.rgb = mix(diffuseColor.rgb, uSlFleckColor, on);
#ifdef SL_FLECKS2
    else if (h.z > 1.0 - uSlFleckDensity2) diffuseColor.rgb = mix(diffuseColor.rgb, uSlFleckColor2, on);
#endif
  }
#endif
#ifdef SL_PUDDLE
  slPuddle = slN.y > 0.7 ? sl_puddleMask() : 0.0;
  diffuseColor.rgb *= 1.0 - uSlPuddle.z * (1.0 - slPuddle);
#endif
#ifdef SL_UNDERWATER
  float slUnder = max(uSlWater.x - vSlWorld.y, 0.0);
#endif
`,
  );

  // 段落とし（照明の倍率を段に丸めて、段ごとの色を塗る）
  fs = replaceOnce(
    fs,
    '#include <aomap_fragment>',
    `#include <aomap_fragment>
#ifdef SL_UNLIT
  reflectedLight.directDiffuse = diffuseColor.rgb;
  reflectedLight.indirectDiffuse = vec3(0.0);
  reflectedLight.directSpecular = vec3(0.0);
  reflectedLight.indirectSpecular = vec3(0.0);
#endif
#if !defined(SL_UNLIT)
  vec3 slLamp = uLampCount > 0.0 ? sl_lamps(vSlWorld, slN, slSunShadow) * uLampParams.x : vec3(0.0);
#endif
#if !defined(SL_TOON) && !defined(SL_UNLIT)
  reflectedLight.directDiffuse += diffuseColor.rgb * slLamp;
#endif
#ifdef SL_TOON
  {
    vec3 F = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb * RECIPROCAL_PI * PI, vec3(1e-4));
    float s = sl_luma(F);
    s += (uSlBounce >= 0.0 ? uSlBounce : uToonBounce) * max(-slN.y, 0.0);
    float slLampL = sl_luma(slLamp);
    s += slLampL;
    float amt = uToonAmount * uSlToon;
    if (amt > 0.0) {
      float nz = sl_warp(vSlWorld * uToonNoise.y * uSlNoiseMul.y, 4);
      s *= exp2(nz * uToonNoise.x * uSlNoiseMul.x * 4.0);
      float soft = uToonThresh.w;
      vec3 base = diffuseColor.rgb;
      vec3 col = base * uSlRatioDark;
      col = mix(col, base * uSlRatioShade, sl_aastep(uToonThresh.z, s, soft));
      col = mix(col, base, sl_aastep(uToonThresh.y, s, soft));
      col = mix(col, base * uSlRatioHi, sl_aastep(uToonThresh.x, s, soft));
      // 灯りの色へ少し寄せる（灯りの強い所ほど）
      if (slLampL > 1e-3) col = mix(col, col * slLamp / slLampL, uLampParams.y * min(slLampL, 1.0));
      reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, col, amt);
      reflectedLight.indirectDiffuse *= 1.0 - amt;
      reflectedLight.directSpecular *= 1.0 - amt * uSlSpecKill;
      reflectedLight.indirectSpecular *= 1.0 - amt * uSlSpecKill;
    }
  }
#endif
#ifdef SL_UNDERWATER
  {
    vec3 vdir = normalize(vSlWorld - cameraPosition);
    float path = slUnder + slUnder / max(abs(vdir.y), 0.2);
    float k = 1.0 - exp(-path / max(uSlWater.y, 1e-3));
    vec3 tot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 tinted = mix(tot, uSlWaterColor, k);
    if (uSlWater.z > 0.0 && slUnder > 0.0) {
      vec2 v = sl_voronoi(vec3(vSlWorld.xz * 1.6, uTime * 0.35));
      float c = smoothstep(0.05, 0.0, v.y - v.x);
      tinted += uSlWaterColor * c * uSlWater.z * (1.0 - k * 0.5);
    }
    reflectedLight.directDiffuse = tinted;
    reflectedLight.indirectDiffuse = vec3(0.0);
  }
#endif
`,
  );

  // 映り込み（不透明の扱いの直前）
  fs = replaceOnce(
    fs,
    '#include <opaque_fragment>',
    `#ifdef SL_REFLECT
  {
    float m = 1.0;
#ifdef SL_REFLECT_PUDDLE
    m = slPuddle;
#endif
    if (m > 0.0) {
      vec4 pc = uSlReflMatrix * vec4(vSlWorld, 1.0);
      vec2 ruv = pc.xy / pc.w;
      if (uSlRefl.y > 0.0) {
        vec3 q = vec3(vSlWorld.xz * 1.7, uTime * 0.25);
        ruv += vec2(sl_fbm(q, 3), sl_fbm(q + 7.3, 3)) * uSlRefl.y;
      }
      vec3 r = texture2D(uSlReflTex, ruv).rgb * uSlReflTint;
      if (uSlRefl.z > 0.0) {
        vec3 lab = sl_linToOklab(r);
        float lev = uSlRefl.z;
        float nz = sl_fbm(vec3(vSlWorld.xz * 2.3, uTime * 0.2), 3) * 0.6;
        lab.x = (floor(lab.x * lev + 0.5 + nz) / lev);
        r = sl_oklabToLin(lab);
      }
      if (uSlReflKey.x > 0.0) m *= smoothstep(uSlReflKey.x - uSlReflKey.y, uSlReflKey.x + uSlReflKey.y, sl_luma(r));
      vec3 vd = normalize(cameraPosition - vSlWorld);
      float fr = mix(1.0, pow(1.0 - max(vd.y, 0.0), 3.0) * 0.85 + 0.15, uSlRefl.w);
      outgoingLight = mix(outgoingLight, r, clamp(uSlRefl.x * fr * m, 0.0, 1.0));
    }
  }
#endif
#include <opaque_fragment>`,
  );

  // 霧と後処理用の情報
  fs = replaceOnce(
    fs,
    '#include <fog_fragment>',
    `#ifndef SL_NOFOG
  gl_FragColor.rgb = sl_applyFog(gl_FragColor.rgb, vSlWorld, cameraPosition);
#endif
  {
    vec3 vn = normalize(normal);
    gInfo = vec4(vn.xy * 0.5 + 0.5, uSlId, uSlLine * gl_FragColor.a);
  }`,
  );
  return fs;
}
