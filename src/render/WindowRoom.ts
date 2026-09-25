import * as THREE from 'three';

/**
 * 窓の奥の部屋（インテリアマッピング）。建物の外壁に貼った窓の薄板（windowLit / windowDark）に、窓の奥 WINDOW_ROOM_DEPTH m の
 * 部屋があるように見せる。テクスチャは読まない（壁・床・天井・照明・カーテン・ブラインドを手続きで描く）。
 *
 * - 頂点属性 winCenter / winHalf（窓の箱の中心と半分の寸法。部屋ローカル = 結合メッシュのオブジェクト空間）を attachWindowRoom が付ける。
 *   属性の無いメッシュ（InstancedMesh など）は半分の寸法 0 になり、従来の見た目のまま
 * - 窓の法線は箱の薄い軸（x か z）。カメラ側が外、反対側が部屋。視線と部屋の箱（奥・側壁・床・天井）の交点で面を決めて色を出す
 * - 窓ごとの違い（点灯・色温度・カーテン・ブラインド・壁と床の色）は窓の中心座標のハッシュで決める（決定論。乱数列は使わない）
 * - windowLit: 部屋の明かりを発光として出す / windowDark: ほぼ暗い部屋（まれにテレビの青い明滅）を弱い発光として足す（反射は元の材質のまま）
 * - 室内の写真（tools/build-generated-textures.mjs の window-rooms。4 × 3 の 12 枚。winPhotoOn = 1 で使う）が届いたら、面の色を写真に替える:
 *   視線と部屋の箱の交点を、窓の外 WINDOW_PHOTO_EYE m に置いたピンホールで写真へ投影する（写真を撮った位置から見ると写真どおり、
 *   動くと奥の壁・床・天井が遠近どおりにずれる）。写真にカーテン・照明が写っているので、手続きのカーテン・ブラインド・照明は使わない（閉め切りのカーテンだけ残す）
 */
export const WINDOW_ROOM_MATS = new Set(['windowLit', 'windowDark']);
export const WINDOW_ROOM_DEPTH = 3.6;
/** 写真の撮影位置（窓の外、窓面からの距離 m）。奥の壁が写真の幅のおよそ 55% に写る距離 */
const WINDOW_PHOTO_EYE = 4.5;
/** 写真の段積み（列 × 段） */
export const WINDOW_PHOTO_GRID: readonly [number, number] = [4, 3];

/** 写真の uniform（MaterialLibrary が 1 組だけ持ち、windowLit / windowDark の全 variant で共有する） */
export interface WindowRoomPhoto { winPhoto: { value: THREE.Texture | null }; winPhotoOn: { value: number } }

/** 箱のジオメトリ（結合前・部屋ローカル）に窓の中心と半分の寸法を付ける */
export function attachWindowRoom(g: THREE.BufferGeometry, min: readonly number[], max: readonly number[]): void {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3), h = new Float32Array(n * 3);
  const cc = [0, 1, 2].map((i) => (min[i] + max[i]) / 2), hh = [0, 1, 2].map((i) => (max[i] - min[i]) / 2);
  for (let i = 0; i < n; i++) { c.set(cc, i * 3); h.set(hh, i * 3); }
  g.setAttribute('winCenter', new THREE.BufferAttribute(c, 3));
  g.setAttribute('winHalf', new THREE.BufferAttribute(h, 3));
}

const PARS = /* glsl */ `
uniform sampler2D winPhoto; uniform float winPhotoOn;
varying vec3 vWinCenter; varying vec3 vWinHalf; varying vec3 vWinCam; varying vec3 vWinPos;
float winHash(vec3 p) { p = fract(p * 0.1031 + 0.37); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
// 部屋の色（線形）。lit: 1 = 点灯 / 0 = 消灯
vec3 liminalWindowRoom(float litMat) {
  vec3 H = vWinHalf;
  if (H.x + H.y + H.z < 1e-4) return vec3(-1.0);
  bool axisX = H.x < H.z;
  vec3 C = vWinCenter;
  // 法線はカメラ側（外）向き
  float s = axisX ? sign(vWinCam.x - C.x) : sign(vWinCam.z - C.z);
  vec3 nrm = axisX ? vec3(s, 0.0, 0.0) : vec3(0.0, 0.0, s);
  vec3 tng = axisX ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 d = normalize(vWinPos - vWinCam);
  float halfW = axisX ? H.z : H.x;
  // 長い帯の窓（温室都市の外壁の 150 m の帯など）は幅 2.4 m 前後の窓に割る（第22回。1 枚の窓として扱うと、奥の部屋・写真が
  // 帯の長さに引き伸ばされていた）。窓ごとに中心を置き直すので、点灯・写真・カーテンも窓ごとに変わる。境目は 5 cm の暗い方立て
  float mull = 1.0;
  if (halfW > 1.6) {
    float aw = dot(vWinPos - C, tng);
    float nP = max(1.0, floor(2.0 * halfW / 2.4 + 0.5));
    float pw = 2.0 * halfW / nP;
    float k = clamp(floor((aw + halfW) / pw), 0.0, nP - 1.0);
    float ac = -halfW + (k + 0.5) * pw;
    C += tng * ac;
    halfW = 0.5 * pw;
    mull = mix(0.12, 1.0, step(abs(aw - ac), halfW - 0.05));
  }
  bool photo = winPhotoOn > 0.5;
  // 部屋: 横は窓幅の 1.6 倍（最低 1.6 m）、床は窓の下端 − 0.9 m、天井は床 + 2.6 m、奥行き WINDOW_ROOM_DEPTH。
  // 写真のときは窓面での幅 : 高さを写真と同じ 3 : 2 にする（幅 3.9 m）
  float RW = photo ? max(1.95, halfW * 1.25) : max(1.6, halfW * 1.6);
  float floorY = C.y - H.y - 0.9, ceilY = floorY + 2.6, D = ${WINDOW_ROOM_DEPTH.toFixed(2)};
  float a0 = dot(vWinPos - C, tng), y0 = vWinPos.y;
  float da = dot(d, tng), dy = d.y, dd = max(1e-4, dot(d, -nrm));
  float tb = D / dd;
  float ts = abs(da) > 1e-4 ? ((da > 0.0 ? RW : -RW) - a0) / da : 1e9;
  float ty = abs(dy) > 1e-4 ? ((dy > 0.0 ? ceilY : floorY) - y0) / dy : 1e9;
  float t = min(tb, min(ts, ty));
  float ha = a0 + da * t, hy = y0 + dy * t, hd = dd * t;
  // 窓ごとの性格
  float r0 = winHash(C), r1 = winHash(C + 17.3), r2 = winHash(C + 41.7), r3 = winHash(C + 7.1);
  float lit = litMat * step(0.08, r0); // 点灯窓でも 8% は明かりが奥で消えている
  float cover = r3 < 0.35 ? 0.0 : (r3 < 0.6 ? 0.3 : (r3 < 0.85 ? 0.5 : 1.0));
  float u = a0 / max(halfW, 0.1); // −1..1
  if (photo) {
    // 写真: 窓の外 WINDOW_PHOTO_EYE のピンホールで交点を投影。窓面で幅 2RW・高さ 2.6 m が写真全体
    float P = ${WINDOW_PHOTO_EYE.toFixed(2)};
    float side = axisX ? -s : s; // 外から見た右 = tng × side
    vec2 q = vec2(ha * side, hy - (floorY + ceilY) * 0.5) / (hd + P);
    vec2 puv = clamp(0.5 + q * vec2(P / (2.0 * RW), P / 2.6), vec2(0.004), vec2(0.996));
    vec2 grid = vec2(${WINDOW_PHOTO_GRID[0].toFixed(1)}, ${WINDOW_PHOTO_GRID[1].toFixed(1)});
    float cell = floor(winHash(C + 3.9) * grid.x * grid.y);
    vec2 cxy = vec2(mod(cell, grid.x), grid.y - 1.0 - floor(cell / grid.x)); // 段は上から
    vec3 pc = texture2D(winPhoto, (cxy + puv) / grid).rgb;
    // 写真の隅は暗く（窓枠の影）
    pc *= mix(0.55, 1.0, smoothstep(0.0, 0.25, 1.0 - abs(u)));
    vec3 col = lit > 0.5 ? pc * 1.5 : pc * 0.06;
    if (litMat < 0.5 && r0 > 0.9) col += vec3(0.18, 0.26, 0.45) * (0.6 + 0.4 * sin(r1 * 40.0 + float(int(r2 * 7.0)))) * smoothstep(D * 1.2, 0.0, hd) * 0.5;
    if (cover >= 1.0) {
      vec3 lampC = r1 < 0.62 ? vec3(1.0, 0.72, 0.42) : vec3(0.86, 0.93, 1.0);
      col = mix(vec3(0.75, 0.68, 0.55), vec3(0.55, 0.6, 0.66), r2) * (0.85 + 0.15 * sin(u * 38.0 + r1 * 6.0)) * (lampC * lit * 0.55 + 0.02);
    }
    return col * mull;
  }
  vec3 lampCol = r1 < 0.62 ? vec3(1.0, 0.72, 0.42) : (r1 < 0.9 ? vec3(0.86, 0.93, 1.0) : vec3(1.0, 0.86, 0.66));
  vec3 wallCol = mix(vec3(0.62, 0.58, 0.52), vec3(0.45, 0.5, 0.52), r2) * (0.8 + 0.3 * r3);
  vec3 floorCol = mix(vec3(0.32, 0.22, 0.14), vec3(0.4, 0.38, 0.34), step(0.6, r3));
  vec3 base;
  if (t == tb) {
    base = wallCol;
    // 奥の壁の家具の影（棚・ソファの背の暗い帯）
    float furn = step(abs(ha - (r2 - 0.5) * RW), 0.35 + 0.4 * r3) * step(hy, floorY + 0.9 + 0.8 * r1);
    base *= 1.0 - 0.45 * furn;
  } else if (t == ts) {
    base = wallCol * 0.85;
  } else if (dy < 0.0) {
    base = floorCol;
  } else {
    base = vec3(0.8, 0.8, 0.78);
  }
  // 照明: 天井の中央（奥行き 45%）の点光源 + 環境光
  vec3 L = vec3(0.0, ceilY - 0.15, D * 0.45);
  vec3 Q = vec3(ha, hy, hd);
  float dist2 = dot(Q - L, Q - L);
  vec3 light = lampCol * (lit * (1.1 / (1.0 + dist2 * 0.9)) + 0.025);
  // 部屋の隅の暗がり: 当たった面の、他の 2 軸の縁までの距離
  float eA = RW - abs(ha), eY = min(hy - floorY, ceilY - hy), eD = D - hd;
  float edge = t == tb ? min(eA, eY) : (t == ts ? min(eY, eD) : min(eA, eD));
  light *= mix(0.45, 1.0, smoothstep(0.0, 0.6, edge));
  // 天井の器具そのもの
  float fixture = (t == ty && dy > 0.0) ? smoothstep(0.35, 0.0, length(vec2(ha, hd - L.z))) : 0.0;
  vec3 col = base * light + lampCol * fixture * lit * 1.6;
  // 消灯窓: まれにテレビの青い明滅（奥の壁の一部）
  if (litMat < 0.5 && r0 > 0.9) col += vec3(0.18, 0.26, 0.45) * (0.6 + 0.4 * sin(r1 * 40.0 + float(int(r2 * 7.0)))) * smoothstep(D * 1.2, 0.0, hd) * 0.5;
  // カーテン（窓の直後）: 左右から覆う割合 0 / 30% / 50% / 閉め切り。明かりが透けて暖かく光る
  float fold = 0.85 + 0.15 * sin(u * 38.0 + r1 * 6.0);
  vec3 curtain = mix(vec3(0.75, 0.68, 0.55), vec3(0.55, 0.6, 0.66), r2) * fold;
  float onCurtain = cover >= 1.0 ? 1.0 : step(1.0 - cover, abs(u));
  col = mix(col, curtain * (lampCol * lit * 0.55 + 0.02), onCurtain);
  // ブラインド（カーテンの無い窓の 30%）: 横の羽根の隙間から奥が見える
  if (cover == 0.0 && r2 > 0.7) {
    float slat = smoothstep(0.35, 0.5, fract((vWinPos.y - C.y) * 9.0));
    col = mix(col, vec3(0.7, 0.68, 0.62) * (lampCol * lit * 0.5 + 0.02), slat * 0.85);
  }
  return col * mull;
}
`;

interface WinShader { vertexShader: string; fragmentShader: string; }

/** MaterialLibrary の onBeforeCompile から呼ぶ（windowLit / windowDark）。発光（totalEmissiveRadiance）を部屋の色に置き換える / 足す */
export function addWindowRoom(shader: WinShader & { uniforms: Record<string, unknown> }, lit: boolean, emission: number, photo: WindowRoomPhoto): void {
  shader.uniforms.winPhoto = photo.winPhoto;
  shader.uniforms.winPhotoOn = photo.winPhotoOn;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 winCenter; attribute vec3 winHalf; varying vec3 vWinCenter; varying vec3 vWinHalf; varying vec3 vWinCam; varying vec3 vWinPos;');
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vWinCenter = winCenter; vWinHalf = winHalf; vWinPos = transformed;
vWinCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${PARS}`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    vec3 winRoom = liminalWindowRoom(${lit ? '1.0' : '0.0'});
    if (winRoom.x >= 0.0) {
      ${lit ? `totalEmissiveRadiance = winRoom * ${emission.toFixed(2)}; diffuseColor.rgb *= 0.08;` : 'totalEmissiveRadiance += winRoom * 0.6;'}
    }
  }`);
}
