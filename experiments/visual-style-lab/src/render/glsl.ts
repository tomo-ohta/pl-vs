/** シェーダーの共通関数（ノイズ・OKLab・段の境目） */

export const NOISE_GLSL = /* glsl */ `
float sl_hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 sl_hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float sl_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// 値ノイズ（-1..1）
float sl_vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = sl_hash13(i);
  float n100 = sl_hash13(i + vec3(1, 0, 0));
  float n010 = sl_hash13(i + vec3(0, 1, 0));
  float n110 = sl_hash13(i + vec3(1, 1, 0));
  float n001 = sl_hash13(i + vec3(0, 0, 1));
  float n101 = sl_hash13(i + vec3(1, 0, 1));
  float n011 = sl_hash13(i + vec3(0, 1, 1));
  float n111 = sl_hash13(i + vec3(1, 1, 1));
  float a = mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y);
  float b = mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y);
  return mix(a, b, u.z) * 2.0 - 1.0;
}
float sl_fbm(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  float n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * sl_vnoise(p);
    n += a;
    p = p * 2.03 + vec3(17.1, 9.2, 3.7);
    a *= 0.5;
  }
  return s / n;
}
// ねじったノイズ（ちぎった紙のような縁になる）
float sl_warp(vec3 p, int oct) {
  vec3 q = vec3(sl_fbm(p, 3), sl_fbm(p + vec3(5.2, 1.3, 2.8), 3), sl_fbm(p + vec3(1.7, 9.2, 4.1), 3));
  return sl_fbm(p + q * 1.6, oct);
}
// 升目ノイズ（細胞の中心までの距離）
vec2 sl_voronoi(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(x, y, z);
    vec3 o = sl_hash33(i + g);
    vec3 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
`;

export const COLOR_GLSL = /* glsl */ `
vec3 sl_linToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827607001 * m - 0.8086757660 * s);
}
vec3 sl_oklabToLin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
float sl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// 画素 1 つ分だけぼかした段の境目
float sl_aastep(float t, float v, float soft) {
  float w = max(fwidth(v) * 0.75, soft);
  return smoothstep(t - w, t + w, v);
}
`;

/** 面の向きに合わせた 2D 座標（タイル・模様用）。軸に沿った面を想定 */
export const PLANAR_GLSL = /* glsl */ `
vec2 sl_planarUV(vec3 wp, vec3 wn) {
  vec3 a = abs(wn);
  if (a.y >= a.x && a.y >= a.z) return wp.xz;
  if (a.x >= a.z) return vec2(wp.z, wp.y);
  return vec2(wp.x, wp.y);
}
`;
