import * as THREE from 'three';

/**
 * 筆の跡（whiteroom の参考画像の「乾いた筆で置いた四角い塗りの重なり」）を色彩設計の材質に足す。
 *
 * 参考画像の質感（3 枚とも）:
 * - 床: 横に長い筆の跡（長さ 0.6〜3 m・幅 0.1〜0.4 m）が明るさ ±5〜12 % で重なる。所々に濃い小さな点・短いひび
 * - 壁: 縦に長い跡（幅 0.2〜0.6 m・長さ 1〜2.5 m）と、四角い大きな斑（1〜3 m の塗り直したような面のむら）
 * これを面に沿った座標（床 = xz、壁 = 横 × 高さ）の「行（または列）」に並べた矩形で作る。行ごとにずらし、
 * 矩形ごとに乱数で長さ・幅・明るさを決め、端はノイズで欠く（乾いた筆のかすれ）。2 つの大きさを重ね、
 * 遠くで細かい方を消す（ちらつき防止）。ワールド座標なので歩いても泳がない。
 * 照明の段（日なた・陰）の前の色（diffuseColor）に掛けるので、陰の中にも跡が残る。
 */
export interface BrushOptions {
  /** 大きい跡: [長さ, 幅]（m）。床は長さの向き = along、壁は縦に長い */
  big: [number, number];
  small: [number, number];
  /** 明るさの振れ幅（大・小） */
  amp: [number, number];
  /** 跡のある割合（大・小。0〜1） */
  cover?: [number, number];
  /**
   * 面の区画ごとの色のむら: [使わない（互換のため）, 振れ幅]。色は造りに従う（2026-10-11 利用者の指摘「色と模様は造りに従う」）:
   * 壁 = 型枠の板 1 枚ごと（panel の寸法）と打ち継ぎ（板の段）ごと、床 = 目地（joints の間隔）で区切った打設の区画ごと。
   * 区画の中は 1 色（迷彩のような勝手な四角い斑は描かない）
   */
  patch?: [number, number];
  /** 型枠の板: [横 m, 縦 m, 継ぎ目の濃さ, 打ち継ぎの下のにじみの濃さ]。既定 0.9 × 1.8 m（板の継ぎ目に締め付けの穴の列が揃う） */
  panel?: [number, number, number, number];
  /** 近くの細かい筆の跡が現れる 1 画素の大きさ（m。既定 0.007 = 参考画像の視点の面より近い所だけ。部屋の中は視点から見えないので広く） */
  nearPx?: number;
  /** 縦の垂れ・筋（壁だけ。振れ幅） */
  streak?: number;
  /** 色みのむら（緑 ↔ 灰。0〜） */
  hueAmp?: number;
  /** 床の跡の長い向き（既定 x） */
  along?: 'x' | 'z';
  /** 暗い所（陰）だけ跡を強める倍率（参考画像の陰の中は跡のむらが大きい。0 で無し） */
  dark?: number;
  /**
   * 近くでだけ見える打ち放しの細部: 壁は型枠の締め付けの穴の並び（[横の間隔, 縦の間隔, 穴の大きさ m, 濃さ]）、
   * 床は目地（[間隔 m, 幅 m, 濃さ]）。画面で小さくなると消える（参考画像の視点の距離では見えない）
   */
  ties?: [number, number, number, number];
  joints?: [number, number, number];
}

const GLSL = /* glsl */ `
uniform vec4 uWrBrushA;   // 大: 長さ, 幅 / 小: 長さ, 幅
uniform vec4 uWrBrushB;   // 振れ幅 大, 小, 斑の大きさ, 斑の振れ幅
uniform vec4 uWrBrushC;   // 筋, 色み, 覆う割合 大, 小
uniform float uWrAlongZ;
uniform float uWrDark;
uniform vec4 uWrTies;
uniform vec3 uWrJoints;
uniform vec4 uWrPanel;    // 型枠の板: 横, 縦, 継ぎ目の濃さ, 打ち継ぎの下のにじみ
uniform float uWrNearPx;
float wrBrushV = 0.0;
float wrSeam = 0.0;
// 行に並ぶ跡。p.x が跡の長い向き。値 -1..1（跡の無い所は 0）
float wr_strokes(vec2 p, vec2 size, float seed, float cover) {
  float rowF = p.y / size.y;
  float row = floor(rowF);
  float ry = fract(rowF);
  float x = p.x / size.x + sl_hash12(vec2(row, seed)) * 17.0;
  float seg = floor(x);
  float fx = fract(x);
  vec3 r = sl_hash33(vec3(seg, row, seed));
  if (r.z > cover) return 0.0;
  // 跡の範囲（升目の中で少しずれる。隣の升目にはみ出さない）
  float a = r.x * 0.25;
  float b = 0.55 + r.y * 0.45;
  float c = 0.05 + fract(r.z * 5.13) * 0.25;
  float d = 0.7 + fract(r.z * 9.71) * 0.3;
  // かすれ: 端の位置をノイズで揺らす
  float n = sl_vnoise(vec3(p * vec2(1.0 / size.x * 6.0, 1.0 / size.y * 2.0), seed)) * 0.08;
  vec2 aa = fwidth(vec2(x, rowF)) * 0.75 + 1e-4;
  float m = smoothstep(a - aa.x, a + aa.x, fx + n) * (1.0 - smoothstep(b - aa.x, b + aa.x, fx - n))
          * smoothstep(c - aa.y, c + aa.y, ry) * (1.0 - smoothstep(d - aa.y, d + aa.y, ry));
  return m * (fract(r.x * 13.7 + r.y * 3.1) * 2.0 - 1.0);
}
// 型枠の板ごとの色（hv = 横, 高さ）。板 1 枚ごとに少し違う色・打ち継ぎ（板の段）ごとの色・板の継ぎ目の細い線・
// 打ち継ぎの線のすぐ下のにじみ（セメントの水が垂れた暗い帯）。値 -1..1、継ぎ目は wrSeam（0..1）
float wr_panel(vec2 hv, float seed, float px) {
  vec2 q = hv / uWrPanel.xy;
  vec2 id = floor(q);
  float a = sl_hash12(id + vec2(seed * 7.1, seed * 3.3)) * 2.0 - 1.0;
  float lift = sl_hash12(vec2(id.y * 1.7, seed + 3.0)) * 2.0 - 1.0;
  vec2 fq = fract(q);
  vec2 e = min(fq, 1.0 - fq) * uWrPanel.xy;
  // 継ぎ目（幅 6 mm。画面で 1 画素より細くなると消す）
  float w = 0.006;
  vec2 aa = max(fwidth(hv), vec2(1e-4));
  float sx = 1.0 - smoothstep(w - aa.x, w + aa.x, e.x);
  float sy = 1.0 - smoothstep(w * 1.6 - aa.y, w * 1.6 + aa.y, e.y);
  wrSeam = max(sx, sy * 1.3) * (1.0 - smoothstep(0.6, 1.6, px / w));
  // 打ち継ぎの線の下 4〜12 cm のにじみ（上の段の板の下端 = 線のすぐ上は明るいまま）
  float bleed = (1.0 - smoothstep(0.0, 0.12, (1.0 - fq.y) * uWrPanel.y)) * uWrPanel.w;
  return clamp(0.65 * a + 0.35 * lift - bleed, -1.0, 1.0);
}
// 床の打設の区画（目地の升目）ごとの色
float wr_bay(vec2 p, float size, float seed) {
  vec2 id = floor(p / size);
  return sl_hash12(id + seed * 5.7) * 2.0 - 1.0;
}
vec3 wr_brush(vec3 col, vec3 wp, vec3 n) {
  vec3 a = abs(n);
  bool floorFace = a.y >= a.x && a.y >= a.z;
  // 跡の長い向きを p.x に: 床は x（または z）、壁は高さ
  vec2 p;
  float seed;
  if (floorFace) {
    p = uWrAlongZ > 0.5 ? wp.zx : wp.xz;
    seed = 3.0;
  } else {
    float h = a.x >= a.z ? wp.z : wp.x;
    p = vec2(wp.y, h);
    seed = a.x >= a.z ? 5.0 : 7.0;
  }
  float v = wr_strokes(p, uWrBrushA.xy, seed, uWrBrushC.z) * uWrBrushB.x;
  // 細かい跡は画面で数画素より小さくなったら消す
  float px = max(length(fwidth(p)), 1e-4);
  float fineFade = 1.0 - smoothstep(0.4, 1.0, px / uWrBrushA.w);
  v += wr_strokes(p + 7.3, uWrBrushA.zw, seed + 1.0, uWrBrushC.w) * uWrBrushB.y * fineFade;
  // 近くで見たときの筆の跡（絵の筆致は画面の上でほぼ同じ大きさ: 近づくほど細かい跡が見えてくる）。
  // 小さい跡の 1/3 の大きさ。1 画素が 0.6 cm より小さい（参考画像の視点の面より近い）所でだけ現れる
  float nearT = 1.0 - smoothstep(uWrNearPx - 0.001, uWrNearPx + 0.001, px);
  if (nearT > 0.0) v += wr_strokes(p + 3.1, uWrBrushA.zw * 0.34, seed + 2.0, uWrBrushC.w) * uWrBrushB.y * 0.9 * nearT;
  wrSeam = 0.0;
  if (uWrBrushB.w > 0.0) {
    // 色は造りに従う: 壁は型枠の板ごと、床は目地で区切った打設の区画ごと
    if (floorFace) v += wr_bay(p, uWrJoints.x, seed) * uWrBrushB.w;
    else v += wr_panel(p.yx, seed, px) * uWrBrushB.w;
  }
  // （雨の垂れの筋は面の模様にしない。窓台・水の吐き口・笠木の端の下にだけ形で付ける）
  wrBrushV = v;
  vec3 o = col * (1.0 + v);
  if (!floorFace && uWrPanel.z > 0.0) o *= 1.0 - wrSeam * uWrPanel.z;
  // 近くでだけ見える細部（型枠の穴・床の目地）。1 画素より小さくなる距離で消す
  if (!floorFace && uWrTies.w > 0.0) {
    vec2 q = vec2(p.y / uWrTies.x, p.x / uWrTies.y);
    vec2 f = abs(fract(q) - 0.5) * vec2(uWrTies.x, uWrTies.y);
    float r = length(f);
    float w = max(fwidth(r), 1e-4);
    float dotM = 1.0 - smoothstep(uWrTies.z - w, uWrTies.z + w, r);
    float fadeT = 1.0 - smoothstep(0.6, 1.6, px / uWrTies.z);
    o *= 1.0 - dotM * fadeT * uWrTies.w;
    // 打ち放しの気泡の跡（あばた。型枠の面に残る 3〜8 mm の小さな穴）。近くでだけ見える（1 画素 0.6 cm より細かい所）
    float nearB = 1.0 - smoothstep(0.004, 0.006, px);
    if (nearB > 0.0) {
      vec2 bq = vec2(p.y, p.x) / 0.11;
      vec2 bid = floor(bq);
      vec3 bh = sl_hash33(vec3(bid, seed + 41.0));
      if (bh.z < 0.32) {
        vec2 bc = (bid + 0.2 + bh.xy * 0.6) * 0.11;
        float br = 0.003 + fract(bh.z * 17.3) * 0.005;
        float bd = length(vec2(p.y, p.x) - bc);
        float bw = max(fwidth(bd), 1e-4);
        o *= 1.0 - (1.0 - smoothstep(br - bw, br + bw, bd)) * 0.45 * nearB;
      }
    }
  }
  if (floorFace && uWrJoints.z > 0.0) {
    vec2 q = p / uWrJoints.x;
    vec2 f = abs(fract(q) - 0.5) * uWrJoints.x;
    vec2 w = max(fwidth(p), vec2(1e-4));
    float line = max(smoothstep(uWrJoints.x * 0.5 - uWrJoints.y - w.x, uWrJoints.x * 0.5 - uWrJoints.y + w.x, f.x), smoothstep(uWrJoints.x * 0.5 - uWrJoints.y - w.y, uWrJoints.x * 0.5 - uWrJoints.y + w.y, f.y));
    float fadeJ = 1.0 - smoothstep(0.6, 1.6, px / uWrJoints.y);
    o *= 1.0 - line * fadeJ * uWrJoints.z;
  }
  // 色み: 跡ごとに緑 ↔ 灰へ少し寄せる
  if (uWrBrushC.y > 0.0) {
    float g = dot(o, vec3(0.299, 0.587, 0.114));
    o = mix(o, vec3(g), clamp(v * uWrBrushC.y * 3.0, -0.4, 0.4));
  }
  return max(o, vec3(0.0));
}
`;

/** 色彩設計の材質（ctx.mat の結果）に筆の跡を足す。材質ごとにシェーダーが分かれないよう、鍵は 1 つ */
export function addBrush(mat: THREE.MeshStandardMaterial, o: BrushOptions): THREE.MeshStandardMaterial {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  const u = {
    uWrBrushA: { value: new THREE.Vector4(o.big[0], o.big[1], o.small[0], o.small[1]) },
    uWrBrushB: { value: new THREE.Vector4(o.amp[0], o.amp[1], o.patch?.[0] ?? 2, o.patch?.[1] ?? 0) },
    uWrBrushC: { value: new THREE.Vector4(o.streak ?? 0, o.hueAmp ?? 0, o.cover?.[0] ?? 0.8, o.cover?.[1] ?? 0.6) },
    uWrAlongZ: { value: o.along === 'z' ? 1 : 0 },
    uWrDark: { value: o.dark ?? 0 },
    uWrTies: { value: new THREE.Vector4(...(o.ties ?? [1, 1, 0.02, 0])) },
    uWrJoints: { value: new THREE.Vector3(...(o.joints ?? [3, 0.01, 0])) },
    uWrPanel: { value: new THREE.Vector4(...(o.panel ?? [0.9, 1.8, 0, 0])) },
    uWrNearPx: { value: o.nearPx ?? 0.007 },
  };
  mat.userData.wrBrush = u;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    const anchor = 'vec3 slN = sl_geoNormal();';
    if (shader.fragmentShader.indexOf(anchor) < 0) throw new Error('whiteroom brush: anchor not found');
    // 関数は main の前に（StyleMaterial の共通部の後ろ = sl_hash など定義済み）
    const j = shader.fragmentShader.indexOf('void main()');
    shader.fragmentShader = shader.fragmentShader.slice(0, j) + GLSL + shader.fragmentShader.slice(j);
    shader.fragmentShader = shader.fragmentShader.replace(anchor, `${anchor}\n  diffuseColor.rgb = wr_brush(diffuseColor.rgb, vSlWorld, slN);`);
    // 陰（暗い所）だけ跡を強める（段落としの後の色の明るさで）
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `if (uWrDark > 0.0) { float wl = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)); outgoingLight *= 1.0 + wrBrushV * uWrDark * (1.0 - smoothstep(0.03, 0.22, wl)); }\n#include <opaque_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => prevKey + '|wrbrush';
  return mat;
}
