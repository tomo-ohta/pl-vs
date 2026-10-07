import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';

/**
 * 駅の材質（場面専用）。霧の日の明るさは「空がどれだけ見えるか」でほぼ決まるので、
 * 上屋（平らな長方形の屋根）が空を隠す割合を式で求めて明るさにする（点から平行な長方形への形態係数）。
 * - 上向きの面: 頭上の屋根に隠されない空の割合 × 空の色
 * - 下向きの面: 足元の床のうち屋根の外（明るい地面・霧）が見える割合
 * - 縦の面: 面の向きに少しずらした点で上の 2 つを混ぜる（屋根の外を向いた柱の面は明るい）
 * 霧は場面の霧の濃さ（sl_fogOptical）に、場面専用の色の関数（地平線で急に変わる）と「屋根の下の霧は暗い」を足したもの。
 * 後処理用の情報（法線・ID・線の重み）は 2 枚目の出力へ。
 */

/** 屋根の長方形の数（全部の画素がこの数だけ調べる。使う数ちょうどにする） */
export const MAX_RECTS = 8;

/** 屋根の長方形（ワールド座標 x0, z0, x1, z1 と下面の高さ h） */
export interface Roof {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  /** 屋根の下の蛍光灯の明るさ（屋根の下の物を照らす。0 で無し） */
  lamp?: number;
  /**
   * 霧の暗さに使うか（既定 true）。開いた上屋は true（下の霧が暗い・下面を見る視線が暗い）。
   * 閉じた建物・地下道は false（外から見た壁に暗い帯が出ないように。中の霧は材質の fogMul で弱める）
   */
  fog?: boolean;
}

/** 全材質で共有する照明の値 */
export const lightU = {
  uRects: { value: Array.from({ length: MAX_RECTS }, () => new THREE.Vector4()) },
  uRectH: { value: new Array<number>(MAX_RECTS).fill(-1000) },
  uRectL: { value: new Array<number>(MAX_RECTS).fill(0) },
  uRectF: { value: new Array<number>(MAX_RECTS).fill(1) },
  /** 蛍光灯の光の色 */
  uLampCol: { value: new THREE.Color('#bff0e0') },
  /** 空の明るさ（上向きの面が全天を見たとき） */
  uSkyCol: { value: new THREE.Color('#b8efe2') },
  /** 屋根の外の明るい地面・霧からの照り返し（下向きの面） */
  uOutCol: { value: new THREE.Color('#5d9c94') },
  /** 屋根の下の暗い床からの照り返し */
  uInCol: { value: new THREE.Color('#0d2a2e') },
  /** 床の高さ（照り返しの計算用） */
  uFloorY: { value: 0 },
  /** 霧の色: 地平線・すぐ上・天頂・地平線の下（野原の上の霧） */
  uStHorizon: { value: new THREE.Color('#b4efe4') },
  uStUpper: { value: new THREE.Color('#c4f8ea') },
  uStZenith: { value: new THREE.Color('#d0fbee') },
  uStGround: { value: new THREE.Color('#57a3a0') },
  /** 霧の色の形: 上へ明るくなる仰角・下へ暗くなる俯角の目安・屋根の下の霧の明るさ・屋根の影の縁のぼかし（m） */
  uStFogShape: { value: new THREE.Vector4(0.08, 0.025, 0.12, 1.6) },
  /** にじみ 2 つ（向き・鋭さ）と色（強さを掛けた色） */
  uStGlowA: { value: new THREE.Vector4(-1, 0.15, 0, 0) },
  uStGlowACol: { value: new THREE.Color('#ffffff') },
  uStGlowB: { value: new THREE.Vector4(-1, 0.15, 0, 6) },
  uStGlowBCol: { value: new THREE.Color('#000000') },
  /** 空の雲の強さ・遠くの丘の強さ */
  uStClouds: { value: 0 },
  uStHills: { value: 0 },
  /** 点字ブロックの帯の映り込みの倍率（場所ごと） */
  uStStripRefl: { value: 1 },
  /** 蛍光灯の色（場所ごと） */
  uStTubeCol: { value: new THREE.Color('#fff8d0') },
  /** 野原の明るさの倍率（場所ごと） */
  uStFieldGain: { value: 1 },
  /** 蛍光灯のにじみの強さ・広がりの倍率（場所ごと） */
  uStTubeGlow: { value: new THREE.Vector2(1, 1) },
  /** 点字ブロック・白線の明るさの倍率（場所ごと） */
  uStStripGain: { value: 1 },
  /** 水たまりの明るさの持ち上げ（場所ごと） */
  uStPudLift: { value: 0 },
  /** 屋根の下の蛍光灯の明るさの倍率（場所ごと） */
  uStLampMul: { value: 1 },
  /** 水たまりを鏡のようにする割合（場所ごと） */
  uStWet: { value: 0 },
  /** 床の乾いた所の映り込みの倍率（場所ごと） */
  uStFloorRefl: { value: 1 },
  /** 霧の濃さの倍率・地平線を上へずらす量（遠くの野や林）・屋根の下面や屋根の下の床を見る視線の霧の明るさ・霧の始まる距離 */
  uStDens: { value: new THREE.Vector4(1, 0, 0.1, 2) },
  /** 地平線の遠い影（倉庫・電柱）に掛ける霧の倍率（場所ごと。霧の薄い向きだけ影が見える） */
  uStFarMul: { value: 0.26 },
  /** 野原の小川の見え方（場所ごと。0〜1） */
  uStStream: { value: 1 },
};

/**
 * 室内の光だまり（駅舎・地下道）。蛍光灯（線分）と窓（縦の長方形。外の霧の光が入る）を、部屋の内側の箱の中だけで足す
 * （壁の向こうへ漏れない）。縁はワールド座標のノイズで少しちぎり、明るさを柔らかく段に寄せる（絵の具で置いた光だまり）。
 * 毎フレーム、カメラに近い POOL_N 個を選んで uniform に書く（updatePools）。使う材質は pool: true（ST_POOL）
 */
export const POOL_N = 10;
export interface Pool {
  /** 0 = 蛍光灯（線分）、1 = 窓（縦の長方形） */
  kind: 0 | 1;
  /** 中心 */
  c: [number, number, number];
  /** 長手（水平・単位ベクトル） */
  axis: [number, number, number];
  /** 長手の半分の長さ・窓の高さの半分 */
  half: number;
  halfH?: number;
  /** 届く距離（m） */
  radius: number;
  /** 色 × 強さ */
  color: [number, number, number];
  /** 照らす箱（部屋の内側） */
  box: [number, number, number, number, number, number];
  /** 窓: 部屋の内側の向き（axis を上から見て左 = +1、右 = -1） */
  side?: 1 | -1;
}
const pools: Pool[] = [];
export function addPool(p: Pool): void {
  pools.push(p);
}
export function clearPools(): void {
  pools.length = 0;
}
export const poolU = {
  uPoolP: { value: Array.from({ length: POOL_N }, () => new THREE.Vector4()) },
  uPoolA: { value: Array.from({ length: POOL_N }, () => new THREE.Vector4()) },
  uPoolC: { value: Array.from({ length: POOL_N }, () => new THREE.Vector4()) },
  uPoolB0: { value: Array.from({ length: POOL_N }, () => new THREE.Vector4()) },
  uPoolB1: { value: Array.from({ length: POOL_N }, () => new THREE.Vector4()) },
  uPoolN: { value: 0 },
};
let poolKey = '';
/** カメラに近い（箱までの距離）POOL_N 個を選んで uniform に書く */
export function updatePools(x: number, y: number, z: number): void {
  const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)},${pools.length}`;
  if (key === poolKey) return;
  poolKey = key;
  const d = pools.map((p, i) => {
    const b = p.box;
    const dx = Math.max(b[0] - x, 0, x - b[3]);
    const dy = Math.max(b[1] - y, 0, y - b[4]);
    const dz = Math.max(b[2] - z, 0, z - b[5]);
    return [Math.hypot(dx, dy, dz) + Math.hypot(p.c[0] - x, p.c[2] - z) * 0.01, i];
  });
  d.sort((a, b) => a[0] - b[0]);
  const n = Math.min(POOL_N, pools.length);
  for (let k = 0; k < n; k++) {
    const p = pools[d[k][1]];
    poolU.uPoolP.value[k].set(p.c[0], p.c[1], p.c[2], p.half);
    poolU.uPoolA.value[k].set(p.axis[0], p.axis[1], p.axis[2], p.radius);
    poolU.uPoolC.value[k].set(p.color[0], p.color[1], p.color[2], p.kind);
    poolU.uPoolB0.value[k].set(p.box[0], p.box[1], p.box[2], p.halfH ?? 0);
    poolU.uPoolB1.value[k].set(p.box[3], p.box[4], p.box[5], p.side ?? 1);
  }
  poolU.uPoolN.value = n;
}

export const POOL_GLSL = /* glsl */ `
uniform vec4 uPoolP[${POOL_N}];
uniform vec4 uPoolA[${POOL_N}];
uniform vec4 uPoolC[${POOL_N}];
uniform vec4 uPoolB0[${POOL_N}];
uniform vec4 uPoolB1[${POOL_N}];
uniform int uPoolN;
// 灯り i の形の上で p に一番近い点（蛍光灯 = 線分、窓 = 縦の長方形）
vec3 st_poolNear(int i, vec3 p) {
  vec3 d = p - uPoolP[i].xyz;
  vec3 a = uPoolA[i].xyz;
  return uPoolP[i].xyz + a * clamp(dot(d, a), -uPoolP[i].w, uPoolP[i].w) + vec3(0.0, clamp(d.y, -uPoolB0[i].w, uPoolB0[i].w), 0.0);
}
// 窓の内側の向き
vec3 st_poolIn(int i) {
  vec3 a = uPoolA[i].xyz;
  return vec3(a.z, 0.0, -a.x) * uPoolB1[i].w;
}
bool st_poolOut(int i, vec3 p) {
  return any(lessThan(p, uPoolB0[i].xyz - 0.06)) || any(greaterThan(p, uPoolB1[i].xyz + 0.06));
}
// 光だまりの明るさ（色）。縁はちぎれ、明るさは柔らかく 3 段に寄せる（段は灯りの和で 1 回だけ）
vec3 st_pools(vec3 p, vec3 n) {
  vec3 acc = vec3(0.0);
  float fs = 0.0;
  for (int i = 0; i < ${POOL_N}; i++) {
    if (i >= uPoolN) break;
    if (st_poolOut(i, p)) continue;
    vec3 v = p - st_poolNear(i, p);
    float dist = length(v);
    vec3 l = -v / max(dist, 1e-3);
    float x = dist / uPoolA[i].w;
    if (x >= 1.0) continue;
    float f = 1.0 / (1.0 + 5.0 * x * x) * (1.0 - smoothstep(0.6, 1.0, x));
    if (uPoolC[i].w > 0.5) {
      // 窓: 部屋の内側だけ。窓の面に沿った壁は暗い（逆光）
      vec3 m = st_poolIn(i);
      f *= smoothstep(-0.02, 0.15, dot(v, m));
      f *= clamp(dot(n, l) * 0.85 + 0.15, 0.0, 1.0) * (1.0 - 0.6 * max(-n.y, 0.0));
    } else {
      f *= clamp(dot(n, l) * 0.75 + 0.25, 0.0, 1.0);
    }
    acc += uPoolC[i].rgb * f;
    fs += f;
  }
  if (fs <= 1e-4) return acc;
  float g = fs * (1.0 + sl_vnoise(p * 1.6) * 0.08);
  float q = smoothstep(0.05, 0.08, g) * 0.3 + smoothstep(0.22, 0.26, g) * 0.35 + smoothstep(0.5, 0.56, g) * 0.35;
  return acc * mix(1.0, q / fs, 0.35);
}
// 濡れた床に映る蛍光灯と窓（床 = 上向きの平らな面）。k = 映る強さ
vec3 st_poolRefl(vec3 p, float k) {
  vec3 vd = normalize(p - cameraPosition);
  vec3 r = reflect(vd, vec3(0.0, 1.0, 0.0));
  vec3 acc = vec3(0.0);
  if (r.y <= 0.0) return acc;
  for (int i = 0; i < ${POOL_N}; i++) {
    if (i >= uPoolN) break;
    if (st_poolOut(i, p)) continue;
    if (uPoolC[i].w < 0.5) {
      float t = (uPoolP[i].y - p.y) / r.y;
      if (t <= 0.0) continue;
      vec3 h = p + r * t;
      vec3 q = st_poolNear(i, h);
      float w = 0.05 + 0.025 * t;
      // 映り込みは見る向きに縦に伸びる（濡れた床の光の筋）
      vec2 e = h.xz - q.xz;
      vec2 fw = normalize(vd.xz + vec2(1e-4));
      float ea = dot(e, fw);
      float eb = dot(e, vec2(-fw.y, fw.x));
      float dd = length(vec2(ea * 0.35, eb));
      acc += uPoolC[i].rgb * exp(-dd * dd / (w * w)) * 2.2 + uPoolC[i].rgb * exp(-dd / (w * 6.0)) * 0.25;
    } else {
      vec3 m = st_poolIn(i);
      float dn = dot(r, m);
      if (dn >= -1e-3) continue;
      float t = dot(uPoolP[i].xyz - p, m) / dn;
      if (t <= 0.0) continue;
      vec3 h = p + r * t;
      vec3 d = h - uPoolP[i].xyz;
      float u = abs(dot(d, uPoolA[i].xyz)) - uPoolP[i].w;
      float yy = abs(d.y) - uPoolB0[i].w;
      float w = 0.03 + 0.02 * t;
      float inside = (1.0 - smoothstep(-w, w, u)) * (1.0 - smoothstep(-w, w, yy));
      acc += st_fogColor(r) * inside * 0.9;
    }
  }
  return acc * k;
}
`;

export function setRoofs(roofs: Roof[]): void {
  for (let i = 0; i < MAX_RECTS; i++) {
    const r = roofs[i];
    if (r) {
      lightU.uRects.value[i].set(Math.min(r.x0, r.x1), Math.min(r.z0, r.z1), Math.max(r.x0, r.x1), Math.max(r.z0, r.z1));
      lightU.uRectH.value[i] = r.h;
      lightU.uRectL.value[i] = r.lamp ?? 0;
      lightU.uRectF.value[i] = r.fog === false ? 0 : 1;
    } else {
      lightU.uRectL.value[i] = 0;
      lightU.uRects.value[i].set(0, 0, 0, 0);
      lightU.uRectH.value[i] = -1000;
    }
  }
}

export const LIGHT_GLSL = /* glsl */ `
uniform vec4 uRects[${MAX_RECTS}];
uniform float uRectH[${MAX_RECTS}];
uniform float uRectL[${MAX_RECTS}];
uniform float uRectF[${MAX_RECTS}];
uniform vec3 uLampCol;
uniform float uStLampMul;
uniform vec3 uStTubeCol;
uniform vec3 uSkyCol;
uniform vec3 uOutCol;
uniform vec3 uInCol;
uniform float uFloorY;
// 点の真上に角がある長方形（辺 a, b、距離 h）の形態係数（符号付き: 角の向きで足し引きする）
float st_fc(float a, float b, float h) {
  float X = abs(a) / h;
  float Y = abs(b) / h;
  float sx = sqrt(1.0 + X * X);
  float sy = sqrt(1.0 + Y * Y);
  float f = (X / sx) * atan(Y / sx) + (Y / sy) * atan(X / sy);
  return sign(a) * sign(b) * f * 0.15915494;
}
float st_rect(vec2 p, vec4 r, float h) {
  vec2 a = r.xy - p;
  vec2 b = r.zw - p;
  return st_fc(b.x, b.y, h) - st_fc(a.x, b.y, h) - st_fc(b.x, a.y, h) + st_fc(a.x, a.y, h);
}
// 上の空が見える割合（0〜1）
// 屋根の下面より上 0.8 m までは屋根の骨組みの中とみなす（ほぼ隠れる）
float st_visUp(vec3 p) {
  float occ = 0.0;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    float h = uRectH[i] - p.y;
    if (h <= -0.8) continue;
    h = max(h, 0.05);
    // 屋根から横に高さの 5 倍より離れた点は、隠される量がほぼ 0（重い計算を飛ばす）
    vec4 r = uRects[i];
    vec2 dd = max(max(r.xy - p.xz, p.xz - r.zw), vec2(0.0));
    if (max(dd.x, dd.y) > h * 5.0) continue;
    occ += st_rect(p.xz, r, h);
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}
// 下を見たとき、屋根の外（明るい所）が見える割合
float st_visDown(vec3 p) {
  float occ = 0.0;
  float h = max(p.y - uFloorY, 0.05);
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    if (uRectH[i] <= p.y - 0.8) continue;
    vec4 r = uRects[i];
    vec2 dd = max(max(r.xy - p.xz, p.xz - r.zw), vec2(0.0));
    if (max(dd.x, dd.y) > h * 5.0) continue;
    occ += st_rect(p.xz, r, h);
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}
// 霧の色（視線の向きの関数）。地平線の上で急に明るく、下で急に暗い（野原の上の霧）
uniform vec3 uStHorizon;
uniform vec3 uStUpper;
uniform vec3 uStZenith;
uniform vec3 uStGround;
uniform vec4 uStFogShape;
uniform vec4 uStGlowA;
uniform vec3 uStGlowACol;
uniform vec4 uStGlowB;
uniform vec3 uStGlowBCol;
uniform vec4 uStDens;
vec3 st_fogColor(vec3 rd) {
  float e = rd.y;
  vec3 c;
  // 地平線は遠くの野や林の分だけ少し上にずらす（uStDens.y）
  e -= uStDens.y;
  if (e >= 0.0) {
    c = mix(uStHorizon, uStUpper, smoothstep(0.0, uStFogShape.x, e));
    c = mix(c, uStZenith, smoothstep(uStFogShape.x, 0.9, e));
  } else {
    c = mix(uStHorizon, uStGround, 1.0 - exp(e / uStFogShape.y));
  }
  // 霧の向こうの光源のにじみ（広い・狭い）
  float above = smoothstep(-0.005, 0.035, e);
  vec3 ga = normalize(uStGlowA.xyz + vec3(0.0, 1e-4, 0.0));
  c += uStGlowACol * pow(max(dot(rd, ga), 0.0), uStGlowA.w) * above;
  vec3 gb = normalize(uStGlowB.xyz + vec3(0.0, 1e-4, 0.0));
  c += uStGlowBCol * pow(max(dot(rd, gb), 0.0), uStGlowB.w) * above;
  return c;
}
// 屋根の下か（0〜1）。箱のどの面でもなめらかに減る（横は 2·s m、上下は屋根の下面の上下 1 m でぼかす）。
// 床より下の点（映り込みを描くとき、鏡に映したカメラから床までの道のり）は床で折り返して調べる
// 視線の道のり（ro → wp）の近くにある屋根だけを調べる（屋根ごとの印。道のりの箱と屋根の影の範囲が重なる物）
int st_mask = 0;
void st_buildMask(vec3 ro, vec3 wp) {
  float s = max(uStFogShape.w, 1.2) + 0.5;
  vec2 lo = min(ro.xz, wp.xz) - s;
  vec2 hi = max(ro.xz, wp.xz) + s;
  float a = ro.y - uFloorY;
  float b = wp.y - uFloorY;
  float ymin = uFloorY + (a * b <= 0.0 ? 0.0 : min(abs(a), abs(b)));
  st_mask = 0;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    float h = uRectH[i];
    if (h < -100.0 || uRectF[i] < 0.5) continue;
    vec4 r = uRects[i];
    if (r.z < lo.x || r.x > hi.x || r.w < lo.y || r.y > hi.y || ymin > h + 1.0) continue;
    st_mask |= (1 << i);
  }
}
float st_roofShade(vec3 q) {
  float sh = 0.0;
  float s = max(uStFogShape.w, 1.2);
  q.y = uFloorY + abs(q.y - uFloorY);
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    if ((st_mask & (1 << i)) == 0) continue;
    vec4 r = uRects[i];
    float h = uRectH[i];
    float dx = min(q.x - r.x, r.z - q.x);
    float dz = min(q.z - r.y, r.w - q.z);
    float v = smoothstep(-s, s, dx) * smoothstep(-s, s, dz) * smoothstep(h + 1.0, h - 1.0, q.y);
    sh = max(sh, v);
  }
  return sh;
}
// 視線をそのまま延ばすと屋根の下面に当たるか（縁はぼかす）。当たるなら、その方向から来る光は屋根に遮られている
// 下を向く視線は床（y = 0）に当たる所が屋根の下なら遮られているとみなす（屋根の下の暗い床を見ている）。
// 遠くの縁は浅い角度で見るので、ぼかしの幅は当たる所までの距離とともに広げる（画面の上で縁が線にならない）。
// ぼかしは主に屋根の内側に置く（屋根の外の明るい所を暗くしない）
// 屋根の外へはみ出すぼかしの幅（内側の幅に対する割合）
#define ST_BIAS 0.3
float st_rayBlocked(vec3 ro, vec3 rd) {
  if (abs(rd.y) <= 1e-4) return 0.0;
  float s0 = max(uStFogShape.w, 1.2);
  float bl = 0.0;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    float h = uRectH[i];
    if (h < -100.0 || uRectF[i] < 0.5) continue;
    float yt = rd.y > 0.0 ? h : uFloorY;
    if (rd.y < 0.0 && ro.y < uFloorY) continue;
    float dy = yt - ro.y;
    // 屋根より上から見上げる視線は遮られない（屋根の下面の近くはなめらかに）
    float under = rd.y > 0.0 ? smoothstep(0.0, 0.6, dy) : 1.0;
    if (under <= 0.0) continue;
    float t = dy / rd.y;
    vec4 r = uRects[i];
    vec2 q = ro.xz + rd.xz * t;
    // 浅い角度で縮むのは視線の向き（水平成分）だけなので、x・z それぞれその向きの分だけ広げる
    vec2 hd = abs(rd.xz) / max(length(rd.xz), 1e-4);
    vec2 sw = s0 + hd * (0.03 * t * t / max(abs(dy), 0.5));
    float dx = min(q.x - r.x, r.z - q.x);
    float dz = min(q.y - r.y, r.w - q.y);
    bl = max(bl, smoothstep(-sw.x * ST_BIAS, sw.x, dx) * smoothstep(-sw.y * ST_BIAS, sw.y, dz) * under);
  }
  return bl;
}
// 霧を掛ける。色ごとに散乱の強さが違う（中くらいの距離の暗い物は青緑に寄る）。
// 屋根の下面を見上げる視線の霧は暗い（その向きから来る空の光が屋根に遮られる。開いた側を見る視線は明るいまま）
float st_fogMul = 1.0;
float st_lastT = 1.0;
vec3 st_applyFog(vec3 col, vec3 wp, vec3 ro) {
  // 霧の始まる距離は場所ごと（uStDens.w）。高さによる変化は小さいので無視する
  float od = uFogParams.x * uStDens.x * st_fogMul * max(length(wp - ro) - uStDens.w, 0.0);
  // 色ごとの差は中くらいの距離まで。遠くでは霧の色にそろう
  vec3 ext = mix(uFogExtinction, vec3(1.0), smoothstep(0.2, 1.8, od));
  vec3 T = max(exp(-od * ext), vec3(1.0 - uFogParams2.x));
  vec3 rd = normalize(wp - ro);
  // 道のりのうち屋根の下を通る部分の霧は暗い（開いた縁から奥へ入るほど暗い）。
  // 霧の溜まる量が等しくなる 6 点で調べる（近くの屋根の下を取りこぼさない）
  float total = 1.0 - exp(-od);
  float k = 1.0;
  st_buildMask(ro, wp);
  if (total > 1e-4 && st_mask != 0) {
    float acc = 0.0;
    for (int i = 0; i < 6; i++) {
      float t = -log(1.0 - (float(i) + 0.5) / 6.0 * total) / max(od, 1e-5);
      acc += mix(1.0, uStFogShape.z, st_roofShade(mix(ro, wp, clamp(t, 0.0, 1.0))));
    }
    k = acc / 6.0;
  }
  k = mix(k, uStDens.z, st_rayBlocked(ro, rd));
  st_lastT = dot(T, vec3(0.2126, 0.7152, 0.0722));
  return col * T + st_fogColor(rd) * (1.0 - T) * k;
}
vec3 st_light(vec3 p, vec3 n) {
  float up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  // 縦の面は面の向きへずらした点で調べる（屋根の外を向いた面は明るい）。
  // 重みが 0 になる項は計算しない（上向きの面は地面の項、下向きの面は空の項、水平な面はずらした点が要らない）
  vec3 q = p + vec3(n.x, 0.0, n.z) * 1.4;
  float ay = abs(n.y);
  float vu = 0.0;
  float vd = 0.0;
  if (up > 0.001) vu = (ay < 0.999 ? st_visUp(q) * (1.0 - ay) : 0.0) + (ay > 0.001 ? st_visUp(p) * ay : 0.0);
  if (up < 0.999) vd = (ay < 0.999 ? st_visDown(q) * (1.0 - ay) : 0.0) + (ay > 0.001 ? st_visDown(p) * ay : 0.0);
  vec3 sky = uSkyCol * vu;
  vec3 gnd = mix(uInCol, uOutCol, vd);
  // 屋根の下の蛍光灯（屋根の範囲の中、屋根より下を一様に照らす）
  float lamp = 0.0;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    if (uRectL[i] <= 0.0 || p.y > uRectH[i] + 0.3) continue;
    vec4 r = uRects[i];
    float d = min(min(p.x - r.x, r.z - p.x), min(p.z - r.y, r.w - p.z));
    lamp += uRectL[i] * smoothstep(-1.5, 1.0, d);
  }
  // 蛍光灯は下を向いた面（屋根の下面）を弱く照らす
  return sky * up + gnd * (1.0 - up) + uLampCol * lamp * uStLampMul * mix(0.4, 1.0, smoothstep(-0.6, 0.0, n.y));
}
// 室内（駅舎・地下道。屋根に完全に覆われる所）: 空は見えないので空の割合の計算を省き、暗い照り返しと屋根の下の一様な灯りだけ。
// 明るさは光だまり（st_pools: 器具と窓）が足す
vec3 st_lightIn(vec3 p, vec3 n) {
  float up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  float lamp = 0.0;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    if (uRectL[i] <= 0.0 || p.y > uRectH[i] + 0.3) continue;
    vec4 r = uRects[i];
    float d = min(min(p.x - r.x, r.z - p.x), min(p.z - r.y, r.w - p.z));
    lamp += uRectL[i] * smoothstep(-1.5, 1.0, d);
  }
  return uInCol * (1.0 - up) + uLampCol * lamp * uStLampMul * mix(0.4, 1.0, smoothstep(-0.6, 0.0, n.y));
}
`;

export interface StationMatOptions {
  color: THREE.ColorRepresentation;
  /** 光る色（照明に関係なく足す。HDR） */
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  /** 照明を使わない（色そのまま） */
  unlit?: boolean;
  noFog?: boolean;
  /** 線の重み（0 で引かない） */
  line?: number;
  map?: THREE.Texture | null;
  /** 明るさに掛ける（材質ごとの微調整） */
  gain?: number;
  /** 模様: 面の向きの座標でノイズのむら（強さ・大きさ 1/m） */
  mottle?: [number, number];
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  /** 頂点色を掛ける */
  vertexColors?: boolean;
  /** 霧の濃さの倍率（遠景の物を少しだけ見えるように残す） */
  fogMul?: number;
  /** 霧の濃さの倍率を場所ごとの値（uStFarMul）にする（地平線の遠い影） */
  farFog?: boolean;
  /** つや（浅い角度で霧の空を映す。樹脂の座席など）。屋根に遮られる向きは映さない */
  sheen?: number;
  /** 追加の定義（床・野原などの模様） */
  defines?: Record<string, string | number>;
  /** 追加の uniform */
  uniforms?: Record<string, THREE.IUniform>;
  /** 室内の光だまり（駅舎・地下道の蛍光灯と窓）を受ける */
  pool?: boolean;
  /**
   * 濡れた床（室内）: 水たまりの量（0〜1）・映り込みの強さ・水たまりの大きさ（1/m）。
   * 水たまりに蛍光灯と窓が映る（pool と一緒に使う）
   */
  wet?: [number, number, number];
  /** 色を決める追加の GLSL（albedo・p・n を書き換える。関数は fragHead へ） */
  fragHead?: string;
  fragAlbedo?: string;
  /** 最後の色（霧の前）を書き換える */
  fragFinal?: string;
  /** 霧の後の色を書き換える（st_lastT = 霧の透過率） */
  fragPostFog?: string;
}

let idCounter = 0;

export const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec3 vColor;
#endif
void main() {
  vec4 lp = vec4(position, 1.0);
  vec3 ln = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  ln = mat3(instanceMatrix) * ln;
#endif
  vec4 wp = modelMatrix * lp;
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * ln);
  vUv = uv;
#ifdef USE_COLOR
  vColor = color;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export function stationMat(o: StationMatOptions): THREE.ShaderMaterial {
  const defines: Record<string, string | number> = { ...(o.defines ?? {}) };
  if (o.unlit) defines.ST_UNLIT = 1;
  if (o.noFog) defines.ST_NOFOG = 1;
  if (o.map) defines.ST_MAP = 1;
  if (o.mottle) defines.ST_MOTTLE = 1;
  if (o.farFog) defines.ST_FARFOG = 1;
  if (o.pool) defines.ST_POOL = 1;
  if (o.wet) defines.ST_WET = 1;
  const em = new THREE.Color(o.emissive ?? 0x000000).multiplyScalar(o.emissiveIntensity ?? 1);
  const uniforms: Record<string, THREE.IUniform> = {
    ...styleUniforms,
    ...lightU,
    uAlbedo: { value: new THREE.Color(o.color) },
    uEmissive: { value: em },
    uGain: { value: o.gain ?? 1 },
    uMap: { value: o.map ?? null },
    uMottle: { value: new THREE.Vector2(...(o.mottle ?? [0, 1])) },
    uOpacity: { value: o.opacity ?? 1 },
    uId: { value: ((idCounter++ * 0.618034) % 1) * 0.9 + 0.05 },
    uLineW: { value: o.line ?? 0 },
    uFogMul: { value: o.fogMul ?? 1 },
    uSheen: { value: o.sheen ?? 0 },
    ...(o.pool ? poolU : {}),
    uWet: { value: new THREE.Vector3(...(o.wet ?? [0, 0, 1])) },
    ...(o.uniforms ?? {}),
  };
  const fs = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec3 vColor;
#endif
uniform float uTime;
uniform vec3 uAlbedo;
uniform vec3 uEmissive;
uniform float uGain;
uniform sampler2D uMap;
uniform vec2 uMottle;
uniform float uOpacity;
uniform float uId;
uniform float uLineW;
uniform float uFogMul;
uniform float uSheen;
uniform float uStFarMul;
${NOISE_GLSL}
${COLOR_GLSL}
${FOG_GLSL}
${LIGHT_GLSL}
#ifdef ST_POOL
${POOL_GLSL}
#endif
uniform vec3 uWet;
${o.fragHead ?? ''}
void main() {
  vec3 p = vWorld;
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 albedo = uAlbedo;
#ifdef USE_COLOR
  albedo *= vColor;
#endif
#ifdef ST_MAP
  vec4 tx = texture2D(uMap, vUv);
  albedo *= tx.rgb;
#endif
#ifdef ST_MOTTLE
  {
    vec3 a = abs(n);
    vec2 uv = a.y > 0.7 ? p.xz : (a.x > a.z ? p.zy : p.xy);
    float m = sl_fbm(vec3(uv * uMottle.y, 0.5), 4);
    albedo *= 1.0 + m * uMottle.x;
  }
#endif
  float alpha = uOpacity;
  vec3 emis = uEmissive;
${o.fragAlbedo ?? ''}
#ifdef ST_WET
  // 濡れた床の水たまり（ちぎれた縁）。水たまりは暗く、蛍光灯と窓が映る
  float wetM = 0.0;
  if (n.y > 0.7) {
    vec2 wq = p.xz * uWet.z;
    wq += vec2(sl_vnoise(vec3(wq * 0.8, 1.7)), sl_vnoise(vec3(wq * 0.8, 8.3))) * 0.9;
    float wn = sl_fbm(vec3(wq, 6.3), 3) + sl_vnoise(vec3(p.xz * 7.0, 2.2)) * 0.06;
    float th = mix(0.45, -0.15, uWet.x);
    float ww = fwidth(wn) * 0.8 + 0.002;
    wetM = smoothstep(th - ww, th + ww, wn);
    albedo *= mix(1.0, 0.86, wetM);
  }
#endif
#ifdef ST_UNLIT
  vec3 col = albedo;
#elif defined(ST_POOL)
  vec3 col = albedo * (st_lightIn(p, n) + st_pools(p, n)) * uGain;
#else
  vec3 col = albedo * st_light(p, n) * uGain;
#endif
#ifdef ST_WET
  {
    vec3 vd0 = normalize(cameraPosition - p);
    float fr = 0.25 + 0.75 * pow(1.0 - clamp(vd0.y, 0.0, 1.0), 3.0);
    col += st_poolRefl(p, uWet.y * fr * mix(0.12, 1.0, wetM));
    // 水たまりのつや（まわりの壁の明るさをぼんやり映す）
    col += uLampCol * 0.05 * wetM * fr * uWet.y;
  }
#endif
  col += emis;
  if (uSheen > 0.0) {
    vec3 vd = normalize(cameraPosition - p);
    vec3 rd = reflect(-vd, n);
    float fr = pow(1.0 - clamp(dot(n, vd), 0.0, 1.0), 5.0);
    float open = 1.0 - st_rayBlocked(p, rd);
    // 映すのは空の色（光源のにじみは入れない）
    col += uSkyCol * uSheen * fr * open * smoothstep(-0.1, 0.15, rd.y);
  }
${o.fragFinal ?? ''}
#ifndef ST_NOFOG
  // 真上から見た図（正射影）では霧を掛けない（間取り図との重ねを見やすく）
  if (!isOrthographic) {
#ifdef ST_FARFOG
  st_fogMul = uStFarMul;
#else
  st_fogMul = uFogMul;
#endif
  col = st_applyFog(col, p, cameraPosition);
  }
#endif
${o.fragPostFog ?? ''}
  gl_FragColor = vec4(col, alpha);
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  gInfo = vec4(vn.xy * 0.5 + 0.5, uId, uLineW * alpha);
}`;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    defines,
    vertexShader: VERT,
    fragmentShader: fs,
    side: o.side ?? THREE.FrontSide,
    transparent: o.transparent ?? false,
    depthWrite: o.depthWrite ?? true,
    vertexColors: o.vertexColors ?? false,
  });
  return mat;
}
