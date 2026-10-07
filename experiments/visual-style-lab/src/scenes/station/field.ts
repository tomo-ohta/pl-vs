import * as THREE from 'three';
import { stationMat } from './mat.ts';

/**
 * 野原の材質（絵の具で描いたような草地）。
 * - 大きなむら（明るい所・暗い所）と、向きのある筋（刷毛の跡のような横長のむら）
 * - 明るい草の房（黄緑の点）と、暗い草の塊
 * - 近くでは 0.2〜0.5 m の小さな塊と短い筆の跡（差は小さい。遠くでは消す）
 * - 西の野原の小川（遠くは空を映して白く細い線、近くは暗い溝）
 * 霧の向こうでも模様が少し残るように、霧の後に模様の差を足し戻す（絵として遠くの草の筋を見せる）。
 * 筋の向きは場所ごと（その場所をよく見る視点に対して横向きになるように）。
 */

export interface FieldOptions {
  color: THREE.ColorRepresentation;
  /** 暗い草・明るい草の房の色 */
  dark: THREE.ColorRepresentation;
  light: THREE.ColorRepresentation;
  /** 小川の折れ線（ワールド xz） */
  stream: [number, number][];
  /** 霧の後に足し戻す割合（0 で無し） */
  keep: number;
}

export const MAX_STREAM = 12;

export function fieldMat(o: FieldOptions): THREE.ShaderMaterial {
  const pts = Array.from({ length: MAX_STREAM }, (_, i) => new THREE.Vector2(...(o.stream[Math.min(i, o.stream.length - 1)] ?? [0, 0])));
  return stationMat({
    color: o.color,
    uniforms: {
      uFDark: { value: new THREE.Color(o.dark) },
      uFLight: { value: new THREE.Color(o.light) },
      uStream: { value: pts },
      uStreamN: { value: o.stream.length },
      uFKeep: { value: o.keep },
    },
    fragHead: /* glsl */ `
uniform vec3 uFDark;
uniform vec3 uFLight;
uniform vec2 uStream[${MAX_STREAM}];
uniform int uStreamN;
uniform float uFKeep;
uniform float uStFieldGain;
float fd_pat;
float fd_water;
// 2 次元の値ノイズ（-1..1。草の塊用の軽いもの）
float fd_vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = sl_hash12(i);
  float b = sl_hash12(i + vec2(1.0, 0.0));
  float c = sl_hash12(i + vec2(0.0, 1.0));
  float d = sl_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}
// 折れ線までの距離と、その点の折れ線に沿った位置（0〜1）
vec2 fd_stream(vec2 p) {
  float best = 1e9;
  float t = 0.0;
  for (int i = 0; i < ${MAX_STREAM - 1}; i++) {
    if (i + 1 >= uStreamN) break;
    vec2 a = uStream[i];
    vec2 b = uStream[i + 1];
    vec2 ab = b - a;
    float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    float d = length(p - a - ab * h);
    if (d < best) { best = d; t = (float(i) + h) / float(uStreamN - 1); }
  }
  return vec2(best, t);
}
`,
    fragAlbedo: /* glsl */ `
  fd_water = 0.0;
  fd_pat = 0.0;
  albedo *= uStFieldGain;
  {
    vec2 xz = p.xz;
    // 筋の向き: 西の野原（D の先）・東の野原（station-2 の奥）は z 向き、線路沿いは x 向き
    float wz = max(smoothstep(-62.0, -80.0, xz.x), smoothstep(18.0, 30.0, xz.x) * smoothstep(20.0, 35.0, xz.y));
    vec2 sa = vec2(xz.x * 0.06, xz.y * 0.012);
    vec2 sb = vec2(xz.x * 0.012, xz.y * 0.06);
    vec2 sq = mix(sb, sa, wz);
    // 画面の 1 画素の大きさ（遠くでは細かい模様を消す）
    float fw = length(fwidth(xz));
    float lodM = 1.0 - smoothstep(0.6, 3.0, fw);
    float lodF = 1.0 - smoothstep(0.08, 0.5, fw);
    // 大きなむら・筋・塊（平均 0 の模様。正 = 明るい草、負 = 暗い草）
    float big = sl_fbm(vec3(xz * 0.01, 1.7), 3);
    float streak = sl_fbm(vec3(sq, 4.1), 4);
    float clump = sl_warp(vec3(xz * 0.07, 2.3), 4);
    float pat = big * 0.6 + streak * 1.1 + clump * 0.5 * lodM;
    fd_pat = big * 0.6 + streak * 1.1;
    vec3 c = pat < 0.0 ? mix(albedo, uFDark * uStFieldGain, clamp(-pat * 1.4, 0.0, 1.0)) : mix(albedo, uFLight * uStFieldGain, clamp(pat * 1.0, 0.0, 1.0));
    // 明るい草の房（筋の縁に多い）
    float edge = 1.0 - smoothstep(0.0, 0.12, abs(streak + 0.05));
    float tuft = sl_vnoise(vec3(xz * 1.7, 7.7)) * 0.5 + 0.5;
    c = mix(c, uFLight, smoothstep(0.6, 0.88, tuft) * (0.3 + edge * 0.7) * lodF);
    float tuftM = sl_vnoise(vec3(sq * 6.0, 9.3)) * 0.5 + 0.5;
    c = mix(c, uFLight, smoothstep(0.65, 0.92, tuftM) * edge * 0.6 * lodM);
    // 草の小さな塊（絵の具で置いたような 0.2〜0.5 m のやわらかい暗い塊と、短い筆の跡・明るい房）。ワールド座標に固定。
    // 低い視線では地面の模様が縦につぶれるので、その場所をよく見る向き（筋と直交する向き）に 2.5 倍長くして、画面で丸く見せる。
    // 差は小さく、1 画素が粗くなる距離では消す（ちらつき・縞の防止）
    {
      float lodC = 1.0 - smoothstep(0.12, 0.35, fw);
      float lodS = 1.0 - smoothstep(0.05, 0.15, fw);
      if (lodC > 0.0) {
        // 見る向きに沿う軸を u、横を v にした座標（u を縮めて塊を長くする）
        vec2 uv = mix(vec2(xz.y, xz.x), xz, wz);
        vec2 w = vec2(fd_vn(xz * 0.9 + 3.1), fd_vn(xz * 0.9 + 17.4));
        vec2 g = vec2(uv.x * 0.4, uv.y) * 3.0 + w * 1.2;
        float a = fd_vn(g) * 0.65 + fd_vn(g * 2.1 + 5.3) * 0.35;
        float dk = smoothstep(0.0, 0.5, a);
        // 短い筆の跡（幅 8 cm・長さ 25 cm ほど）と明るい房
        vec2 gs = vec2(uv.x * 4.0, uv.y * 12.0) + w * 2.0;
        float st = fd_vn(gs);
        float lt = smoothstep(0.35, 0.85, -a) * 0.6 + smoothstep(0.55, 0.95, st) * 0.4 * lodS;
        dk = max(dk, smoothstep(0.6, 0.95, -st) * 0.5 * lodS);
        c = mix(c, uFDark * 0.75 * uStFieldGain, dk * 0.42 * lodC);
        c = mix(c, uFLight * uStFieldGain, lt * 0.3 * lodC);
      }
    }
    // 暗い草の塊（はっきりした縁）
    float blob = sl_warp(vec3(xz * 0.35, 8.8), 4);
    c = mix(c, uFDark * 0.75, smoothstep(0.12, 0.2, blob) * 0.55 * lodM);
    // 小川: 遠く（西）は空を映す白い線、近くは暗い溝と湿った縁
    if (uStreamN > 1) {
      vec2 ds = fd_stream(xz);
      float wob = sl_fbm(vec3(xz * 0.08, 5.5), 3);
      float w = mix(2.2, 1.4, ds.y) + wob * 0.8;
      float far = smoothstep(-165.0, -185.0, xz.x);
      float core = 1.0 - smoothstep(w * 0.5, w * 0.5 + max(fw, 0.2), ds.x);
      float wet = 1.0 - smoothstep(w * 0.6, w * 3.5 + wob * 3.0, ds.x);
      c = mix(c, uFDark * 0.6, wet * (1.0 - far) * 0.7);
      fd_pat -= wet * (1.0 - far) * 1.2;
      fd_water = core * far;
    }
    albedo = c;
  }
`,
    fragFinal: /* glsl */ `
  {
    // 遠くの小川は空（霧の色）を映す
    vec3 vd = normalize(p - cameraPosition);
    vec3 sky = st_fogColor(reflect(vd, vec3(0.0, 1.0, 0.0)));
    col = mix(col, sky * 0.92, fd_water);
  }
`,
    fragPostFog: /* glsl */ `
  // 霧の向こうでも大きな模様（むら・筋・小川）を少し残す（平均 0 の模様で明るさだけを変える）
  {
    float w = max(pow(st_lastT, 0.4) - st_lastT, 0.0) * uFKeep;
    col *= 1.0 + fd_pat * 0.25 * w;
    vec3 vd = normalize(p - cameraPosition);
    col = mix(col, st_fogColor(reflect(vd, vec3(0.0, 1.0, 0.0))) * 1.02, fd_water * w * 0.8);
  }
`,
  });
}
