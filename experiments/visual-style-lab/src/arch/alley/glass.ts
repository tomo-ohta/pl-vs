import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import type { LocalFrame } from './frame.ts';

/**
 * 窓ガラスの材質（場面専用）。見る角度で「映り込み」と「中の部屋」を混ぜる。
 *
 * 映り込み:
 * - 描いた映り込み（参考画像の視点で窓に見える木の葉・明るい建物・向かいの壁。元の版の壁面の絵と同じ描き方）を、
 *   「ガラスの奥 D m にある鏡の中の世界の絵」として扱う。今の目の鏡像からガラスの点を通る線が奥 D m の面に当たる点を求め、
 *   その点を参考画像の目から見たときの壁の上の位置で絵を引く。参考画像の目ではちょうど元の絵になり、
 *   ほかの所から見ると映り込みが目の動きに合わせてずれる（貼った絵に見えない）
 * - 絵の無い所（参考画像の視点に写らない所）は、向かいの壁（階ごとの窓の帯）・空・木を反射の向きで描く
 * 中の部屋（interior mapping）: ガラスの奥に部屋の箱（床・天井・奥の壁・横の壁・机・カーテン）を視線でたどって描く。
 *   入れる部屋（廊下）のガラスは透明にして、本当の部屋を見せる
 * 混ぜ方: 浅い角度（参考画像の視点の窓はすべて 40° 以上）では映り込みだけ、正面から見ると中の部屋が見える。
 */

/** ガラスの区画の種類（aRoom.y） */
export const ROOM = { corridor: 0, classroom: 1, stair: 2, office: 3, toilet: 4, club: 5, storage: 6 } as const;
/** ガラスの見せ方（aRoom.w） */
export const GLASS_MODE = { mapped: 0, clear: 1, frosted: 2 } as const;

export interface PaintTile {
  texture: THREE.Texture;
  /** 壁の座標の範囲 u0, y0, u1, y1 */
  rect: [number, number, number, number];
}

export interface GlassOptions {
  /** ガラスの面の w（外壁の面より奥。負） */
  glassW: number;
  /** 描いた映り込み（参考画像の視点の絵） */
  paint?: { tiles: PaintTile[]; eye: [number, number, number]; viewProj: THREE.Matrix4; depth: number };
  /** 向かいの物（反射の向きで描く） */
  opposite: { w: number; top: number; base: number; pitch: number; sill: number; head: number; treeTop: number; trees: number };
  /** 正面から見たときの映り込みの強さ（0〜1） */
  k0?: number;
  /** 中の部屋の暗さの倍率 */
  dim?: number;
  fog?: number;
}

const VS = /* glsl */ `
attribute vec4 aCell;
attribute vec4 aRoom;
attribute vec4 aRect;
attribute vec2 aPane;
varying vec2 vPane;
varying vec3 vWorld;
varying vec4 vCell;
varying vec4 vRoom;
varying vec4 vRect;
varying vec3 vVN;
#include <clipping_planes_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vCell = aCell;
  vRoom = aRoom;
  vRect = aRect;
  vPane = aPane;
  vVN = normalize(normalMatrix * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;

const MAXT = 6;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
#include <clipping_planes_pars_fragment>
varying vec3 vWorld;
varying vec4 vCell;
varying vec4 vRoom;
varying vec4 vRect;
varying vec2 vPane;
varying vec3 vVN;
uniform vec3 uO;
uniform vec3 uT;
uniform vec3 uN;
uniform float uG;
uniform int uTiles;
uniform sampler2D uP0;
uniform sampler2D uP1;
uniform sampler2D uP2;
uniform sampler2D uP3;
uniform sampler2D uP4;
uniform sampler2D uP5;
uniform vec4 uPR[${MAXT}];
uniform vec3 uRefEye;
uniform mat4 uRefVP;
uniform float uVD;
uniform vec4 uOpp;    // w, top, base, pitch
uniform vec4 uOpp2;   // sill, head, treeTop, trees
uniform float uK0;
uniform float uDim;
uniform float uFogMul;
uniform float uId;
uniform vec3 uRSkyLo;
uniform vec3 uRSkyHi;
uniform vec3 uRWall;
uniform vec3 uRWin;
uniform vec3 uRWin2;
uniform vec3 uRTree;
uniform vec3 uRGround;
uniform vec3 uIWall;
uniform vec3 uIFloor;
uniform vec3 uICeil;
uniform vec3 uILamp;
uniform vec3 uICurtain;
${NOISE_GLSL}
${FOG_GLSL}

vec4 tileAt(int i, vec2 st) {
  if (i == 0) return texture2D(uP0, st);
  if (i == 1) return texture2D(uP1, st);
  if (i == 2) return texture2D(uP2, st);
  if (i == 3) return texture2D(uP3, st);
  if (i == 4) return texture2D(uP4, st);
  return texture2D(uP5, st);
}

// 描いた映り込み（壁の座標 fu の点）。a = 絵がある度合い
vec4 painted(vec2 fu) {
  for (int i = 0; i < ${MAXT}; i++) {
    if (i >= uTiles) break;
    vec4 r = uPR[i];
    if (fu.x >= r.x && fu.x < r.z && fu.y >= r.y && fu.y < r.w) {
      vec2 st = (fu - r.xy) / (r.zw - r.xy);
      return tileAt(i, st);
    }
  }
  return vec4(0.0);
}

// 向かいの壁・空・地面・木（反射の向き R で）
vec3 procRefl(vec3 p, vec3 R) {
  float rw = dot(R, uN);
  float pw = dot(p - uO, uN);
  float t = rw > 1e-3 ? (uOpp.x - pw) / rw : 1e5;
  if (R.y < -1e-3) {
    float tg = -p.y / R.y;
    if (tg < t) return uRGround;
  }
  vec3 h = p + R * t;
  if (rw <= 1e-3 || h.y > uOpp.y) {
    return mix(uRSkyLo, uRSkyHi, smoothstep(0.0, 0.6, R.y));
  }
  float hu = dot(h - uO, uT);
  float s = (h.y - uOpp.z) / uOpp.w;
  float fi = floor(s);
  float fy = fract(s) * uOpp.w;
  vec3 c = uRWall;
  // 向かいの壁の階の境目（腰壁の下の細い影の帯）
  if (fy < 0.12) c *= 0.8;
  if (fy > uOpp2.x && fy < uOpp2.y) {
    float cu = floor(hu / 0.8);
    float r = sl_hash12(vec2(cu, fi + 17.0));
    c = mix(uRWin, uRWin2, r * r);
    float fu = fract(hu / 0.8);
    float fv = (fy - uOpp2.x) / (uOpp2.y - uOpp2.x);
    // 向かいの窓にも空が映る（上の階ほど明るい。参考画像の上の窓の明るい映り込みと同じ）。窓の上の方の小窓は特に明るい
    float up = smoothstep(uOpp.z + uOpp.w * 0.8, uOpp.y - uOpp.w * 0.5, h.y);
    // 下の階でも半分ほどの窓は空を映して明るい（参考画像の 1 階の窓の明るい映り込みと同じ）。
    // 窓 1 枚ごとに「暗い窓」か「空の色」のどちらか（参考画像のガラスと同じ平らな色。中間の色を作らない）
    float bright = (0.3 + 0.7 * up) * (0.25 + 0.75 * step(0.45, r)) + step(0.62, fv) * 0.25 * (0.4 + up);
    float hiSky = step(0.55, up + (sl_hash12(vec2(cu, fi + 3.0)) - 0.5) * 0.5);
    c = mix(c, mix(uRSkyLo, uRSkyHi, hiSky), step(0.45, bright));
    if (fu < 0.07 || abs(fv - 0.62) < 0.025) c = uRWall;
  }
  // 向かいの前の木の冠（まばらな塊。縁は葉の細かいちぎれ）
  if (uOpp2.w > 0.0 && h.y < uOpp2.z && h.y > 1.5) {
    vec3 tp = vec3(hu * 0.22, h.y * 0.3, 2.7);
    float n = sl_fbm(tp, 3) + sl_fbm(tp * 5.3 + 4.1, 2) * 0.22;
    float top = smoothstep(uOpp2.z - 3.5, uOpp2.z, h.y) * 0.45;
    if (n > 0.42 - uOpp2.w * 0.3 + top) c = mix(uRTree, uRWall, step(0.62, n) * 0.35);
  }
  return c;
}

// 中の部屋（interior mapping）
vec3 interior(vec3 p, vec3 V) {
  vec3 rel = p - uO;
  float pu = dot(rel, uT);
  float py = p.y;
  float du = dot(V, uT);
  float dy = V.y;
  float dw = min(dot(V, uN), -1e-3);
  float depth = vRoom.x;
  float kind = vRoom.y;
  float seed = vRoom.z;
  float tB = depth / -dw;
  float tY = dy < 0.0 ? (vCell.z - py) / min(dy, -1e-4) : (vCell.w - py) / max(dy, 1e-4);
  float tU = du > 0.0 ? (vCell.y - pu) / max(du, 1e-4) : (vCell.x - pu) / min(du, -1e-4);
  float t = min(tB, min(tY, tU));
  vec3 hp = vec3(pu + du * t, py + dy * t, -dw * t); // u, y, 奥行き
  float hy = hp.y - vCell.z;  // 床からの高さ
  float H = vCell.w - vCell.z;
  vec3 c;
  // 灯りの点いた部屋（夕方。暗い半地下・1 階は点いている部屋が多い）
  float lit = step(vCell.z < 1.0 ? 0.45 : 0.68, fract(seed * 7.13));
  if (t == tY && dy < 0.0) {
    c = uIFloor * (1.25 - 0.35 * smoothstep(0.0, depth, hp.z));
    // 床のタイルの目地（30 cm）
    vec2 fg = abs(fract(vec2(hp.x - vCell.x, hp.z) / 0.3) - 0.5);
    float fw = 0.5 - 0.012 / 0.3;
    if (max(fg.x, fg.y) > fw) c *= 0.82;
  } else if (t == tY) {
    c = uICeil;
    // 天井の板の目地
    vec2 cg = abs(fract(vec2((hp.x - vCell.x) / 0.91, hp.z / 0.455)) - 0.5);
    if (cg.x > 0.485 || cg.y > 0.47) c *= 0.85;
    // 天井の照明（u に沿って 2.4 m おき・奥行きの中ほど）
    float lu = abs(fract((hp.x - vCell.x) / 2.4) - 0.5) * 2.4;
    float lz = abs(hp.z - depth * 0.5);
    if (lu < 0.62 && lz < 0.09) c = mix(uICeil * 1.3, uILamp, lit);
  } else if (t == tB) {
    c = uIWall;
    float lu = hp.x - vCell.x;
    if (kind < 0.5) {
      // 廊下の奥の壁 = 教室の壁: 腰壁・引き戸・欄間の窓
      if (hy < 0.95) c = uIWall * 0.78;
      float dpos = mod(lu + seed * 3.0, 8.2);
      if ((dpos > 0.6 && dpos < 1.55) || (dpos > 6.6 && dpos < 7.55)) {
        if (hy < 1.95) c = uIWall * 0.62 + vec3(0.004, 0.008, 0.008);
        if (hy > 1.0 && hy < 1.6 && (abs(dpos - 1.07) < 0.25 || abs(dpos - 7.07) < 0.25)) c = uIWall * 1.25;
      } else if (hy > 2.05 && hy < 2.6) {
        // 欄間: 教室の窓の昼の明るさが透ける
        c = mix(uIWall * 1.2, uRSkyLo, 0.55 + 0.25 * fract(seed * 2.3));
        if (fract(lu / 0.9) < 0.06) c = uIWall * 0.8;
      } else if (hy > 1.1 && hy < 1.9 && fract(lu / 8.2 + seed) > 0.35 && fract(lu / 8.2 + seed) < 0.55) {
        c = uIWall * 1.12; // 掲示板
        // 掲示物（白い紙の四角）
        vec2 pc = vec2(lu / 0.32, (hy - 1.1) / 0.4);
        vec2 pf = fract(pc);
        float ph = sl_hash12(floor(pc) + seed);
        if (ph > 0.35 && pf.x > 0.12 && pf.x < 0.82 && pf.y > 0.08 && pf.y < 0.9) c = mix(uIWall * 1.6, uRSkyHi, 0.25 * ph);
      }
      // 扉の窓（教室の明るさ）
      if ((dpos > 0.6 && dpos < 1.55) || (dpos > 6.6 && dpos < 7.55)) {
        if (hy > 1.0 && hy < 1.6 && (abs(dpos - 1.07) < 0.25 || abs(dpos - 7.07) < 0.25)) c = mix(uIWall * 1.25, uRSkyLo, 0.45);
      }
    } else if (kind < 1.5) {
      // 教室の奥: 掲示板・ロッカー・黒板
      if (hy < 1.0) c = uIWall * 0.75 + vec3(0.0, 0.004, 0.004);
      if (hy > 1.2 && hy < 2.3 && abs(fract(lu / 8.0) - 0.5) < 0.3) c = vec3(0.05, 0.11, 0.09);
    } else if (kind < 2.5) {
      // 階段: 段の斜めの帯
      float st = fract((hp.y + lu * 0.6) / 0.34);
      c = uIWall * (st < 0.5 ? 0.85 : 1.0);
    } else {
      if (hy < 0.9) c = uIWall * 0.8;
      if (hy > 0.9 && hy < 2.0 && fract(lu / 1.8 + seed) < 0.5) c = uIWall * 0.68; // 棚
    }
  } else {
    c = uIWall * 0.86;
    if (hy < 0.95) c *= 0.85;
  }
  // 幅木（壁の足元の暗い帯）
  if (!(t == tY) && hy < 0.08) c = uIWall * 0.55;
  // 机（教室）: 高さ 0.72 m の板
  if (kind > 0.5 && kind < 1.5 && dy < 0.0) {
    float tD = (vCell.z + 0.72 - py) / dy;
    if (tD > 0.0 && tD < t) {
      vec2 d = vec2(pu + du * tD - vCell.x, -dw * tD);
      vec2 g = vec2(fract(d.x / 1.25), fract((d.y - 1.4) / 1.05));
      if (d.y > 1.4 && d.y < depth - 1.6 && g.x > 0.25 && g.x < 0.77 && g.y < 0.45) c = uIWall * 1.15;
    }
  }
  // 部屋ごとの明るさの違い。灯りの点いた部屋は天井の灯りの下が明るい（光だまり）
  c *= 0.85 + 0.3 * fract(seed * 3.71) + lit * 0.25;
  if (lit > 0.5 && !(t == tY && dy > 0.0)) {
    float lu2 = abs(fract((hp.x - vCell.x) / 2.4) - 0.5) * 2.4;
    float pool = 1.0 - smoothstep(0.6, 1.3, length(vec2(lu2, (hp.z - depth * 0.5) * 0.8)));
    c *= 1.0 + pool * 0.55 * (1.0 - smoothstep(0.0, H, hy) * 0.6);
  }
  // 窓ぎわの床は外の明るさで明るい
  if (t == tY && dy < 0.0) c *= 1.0 + 0.4 * (1.0 - smoothstep(0.0, 1.0, hp.z));
  // カーテン（窓のすぐ内側）: 区画の窓ごとに引いた量が違う
  float pane = floor((pu - vCell.x) / 1.6);
  float hc = sl_hash12(vec2(pane, seed * 13.1));
  float cover = hc < 0.45 ? 0.0 : (hc - 0.45) * 1.8;
  float side = step(0.5, fract(hc * 9.3));
  float x = fract((pu - vCell.x) / 1.6);
  float xx = side > 0.5 ? x : 1.0 - x;
  bool curtained = abs(kind - ${ROOM.classroom.toFixed(1)}) < 0.5 || abs(kind - ${ROOM.office.toFixed(1)}) < 0.5 || abs(kind - ${ROOM.club.toFixed(1)}) < 0.5;
  if (curtained && xx < cover) {
    // 襞は 2 段の帯（なめらかな諧調にしない）
    float fold = sin(pu * 38.0 + sin(pu * 7.0) * 2.0) > 0.0 ? 1.0 : 0.8;
    c = uICurtain * fold * (0.8 + 0.4 * fract(seed * 5.3));
  }
  return c * uDim;
}

void main() {
  #include <clipping_planes_fragment>
  vec3 E = cameraPosition;
  vec3 p = vWorld;
  vec3 V = normalize(p - E);
  float eW = dot(E - uO, uN);
  bool outside = eW > uG;
  // 映り込みと中の部屋の混ぜ方はガラス 1 枚（幅 0.7 m の升）ごとに 1 つ（升の中心への視線で決める）。
  // ガラスの中でなめらかに変わる諧調を作らない（参考画像のガラスも 1 枚ごとに平らな明るさ）
  float pu0 = dot(p - uO, uT);
  float pcu = clamp(vRect.x + (floor((pu0 - vRect.x) / max(vPane.x, 0.2)) + 0.5) * max(vPane.x, 0.2), vRect.x, vRect.z);
  vec3 pc0 = uO + uT * pcu + uN * uG + vec3(0.0, 0.5 * (vRect.y + vRect.w), 0.0);
  float c = abs(dot(normalize(pc0 - E), uN));
  float k = 1.0 - (1.0 - uK0) * smoothstep(0.80, 0.97, c);
  vec3 R = reflect(V, uN);
  // ガラス 1 枚ごとの見え方（参考画像のガラスの言葉: 明るい空と木の葉の映り込みの板・暗い板）。
  // 手で描いた映り込み（参考画像の視点の画角の中）はそのまま。その外の映り込みでは、まとまった広がりの板を明るい空と木の葉にする。
  // f = 正面から見ている度合い（浅い角度では 0。参考画像の視点の窓はすべて浅い角度）
  float f = (1.0 - k) / max(1.0 - uK0, 1e-3);
  vec2 paneId = vec2(floor((pu0 - vRect.x) / max(vPane.x, 0.2)), floor((p.y - vRect.y) / max(vPane.y, 0.2)));
  float ph = sl_hash12(paneId + vec2(vRoom.z * 3.1, vRoom.z * 1.7) + floor(vRect.x * 3.0));
  // まとまった広がり: 壁の座標の大きなノイズを板の中心で引き、上の階ほど多い（板ごとのばらばらな市松模様にしない）
  float pcy = vRect.y + (paneId.y + 0.5) * max(vPane.y, 0.2);
  float big = sl_fbm(vec3(pcu * 0.11, pcy * 0.16, dot(uN, vec3(3.1, 0.0, 7.3))), 2) + clamp((pcy - 2.0) * 0.03, 0.0, 0.3) + (ph - 0.5) * 0.12;
  float skyCls = step(-0.06, big);
  float reflCls = (1.0 - skyCls) * step(-0.2, big);
  // 遠くでは木の葉の細かいちぎれを消す（画素より細かい斑にしない）。微分は分岐の外で
  float fp = fwidth(pu0) + fwidth(p.y);
  // 手で描いた映り込み（参考画像の視点の画角の中）
  float pAmt = 0.0;
  vec3 pCol = vec3(0.0);
  if (outside && uTiles > 0) {
    float wE = eW - uG;
    vec3 q = E + (p - E) * (1.0 + uVD / wE);
    float wR = dot(uRefEye - uO, uN);
    vec3 pr = uRefEye + (q - uRefEye) * (wR / (wR - uG + uVD));
    vec2 fu = vec2(dot(pr - uO, uT), pr.y);
    vec4 pc = painted(fu);
    // 参考画像の視点の画角の外は描いていない（向かいの壁の反射に溶かす）
    vec4 cl = uRefVP * vec4(pr, 1.0);
    vec2 nd = cl.xy / max(cl.w, 1e-4);
    float inside = (1.0 - smoothstep(1.0, 1.015, abs(nd.x))) * (1.0 - smoothstep(1.0, 1.015, abs(nd.y))) * step(0.0, cl.w);
    // 正面から見る板（f > 0）では手で描いた映り込みから板ごとの映り込みへ移す（参考画像の視点では f = 0）
    pAmt = pc.a * inside * (1.0 - f);
    pCol = pc.rgb;
  }
  // 明るい映り込みの板: 平らな空（明るい色）か、明るい建物の映り込み（窓の段の横の帯と細い桟）に、ちぎれた暗い木の葉の塊
  vec3 skyPane = uRSkyHi;
  vec3 refl = pCol;
  if (pAmt < 0.999 || f > 0.0) {
    refl = procRefl(p, R);
    if (skyCls > 0.5) {
      if (fract(ph * 7.31) > 0.5) {
        float rowY = fract((p.y + ph * 3.0) / 0.62);
        skyPane = rowY < 0.3 ? uRSkyLo : uRSkyHi;
        if (fract((pu0 + ph) / 0.42) < 0.06) skyPane = uRSkyLo;
      }
      // 木の葉の塊（下の方ほど多い）。縁は葉の大きさのノイズで細かくちぎる（中間の色は作らない）
      vec3 lp = vec3(pu0 * 1.9, p.y * 1.9, vRoom.z * 0.37);
      float k1 = 1.0 - smoothstep(0.03, 0.09, fp);
      float k2 = 1.0 - smoothstep(0.012, 0.035, fp);
      float n = sl_fbm(lp, 2) + sl_vnoise(lp * 4.1 + 2.1) * 0.3 * (0.4 + 0.6 * k1);
      if (k1 > 0.0) n += sl_vnoise(lp * 11.0) * 0.18 * k1;
      if (k2 > 0.0) n += sl_vnoise(lp * 27.0 + 5.0) * 0.12 * k2;
      float th = 0.17 + clamp(p.y * 0.016, 0.0, 0.28);
      if (n > th) skyPane = uRTree;
    }
    refl = mix(refl, skyPane, skyCls);
    refl = mix(refl, pCol, pAmt);
  }
  vec3 col;
  float alpha = 1.0;
  float mode = vRoom.w;
  if (mode > 0.5 && mode < 1.5) {
    // 入れる部屋: 透明（中は本当の形）。正面からでも 4 割ほどの板は映り込みで見えない
    if (outside) {
      col = mix(refl, skyPane, skyCls * f);
      alpha = mix(k, 1.0, (skyCls + reflCls) * f);
    } else {
      // 内から見た窓は外の昼の明るさで白っぽく明るい（暗い部屋の中の明るい開口）
      col = mix(uRSkyLo, uRSkyHi, 0.35);
      alpha = 0.3;
    }
  } else if (mode > 1.5) {
    // すりガラス（便所・階段）
    vec3 fr = mix(uIWall * 1.6, uICeil * 1.4, smoothstep(vCell.z, vCell.w, p.y));
    col = mix(fr * uDim, refl, k);
  } else {
    col = outside ? mix(interior(p, V), refl, k) : uIWall;
    if (outside) col = mix(col, mix(refl, skyPane, skyCls), (skyCls + reflCls) * f);
  }
  col = mix(col, sl_applyFog(col, p, E), uFogMul);
  gl_FragColor = vec4(col, alpha);
  gInfo = vec4(normalize(vVN).xy * 0.5 + 0.5, uId, 0.0);
}`;

let idc = 0;

export interface GlassColors {
  skyLo: string;
  skyHi: string;
  wall: string;
  win: string;
  win2: string;
  tree: string;
  ground: string;
  iWall: string;
  iFloor: string;
  iCeil: string;
  iLamp: string;
  iCurtain: string;
}

export const GLASS_COLORS: GlassColors = {
  skyLo: '#7fb3a8',
  skyHi: '#bce9d4',
  wall: '#132a32',
  win: '#1c3d46',
  win2: '#3a6a6c',
  tree: '#1d3d42',
  ground: '#0e222b',
  iWall: '#1d3a42',
  iFloor: '#11252c',
  iCeil: '#24454d',
  iLamp: '#8fc0ae',
  iCurtain: '#37574f',
};

export function createGlass(fr: LocalFrame, o: GlassOptions, colors: Partial<GlassColors> = {}): THREE.ShaderMaterial {
  const c = { ...GLASS_COLORS, ...colors };
  const tiles = o.paint?.tiles ?? [];
  if (tiles.length > MAXT) throw new Error('glass: too many tiles');
  const tex = (i: number): THREE.Texture | null => tiles[i]?.texture ?? null;
  const rects = Array.from({ length: MAXT }, (_, i) => new THREE.Vector4(...(tiles[i]?.rect ?? [0, 0, 0, 0])));
  const op = o.opposite;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uO: { value: fr.O.clone() },
      uT: { value: fr.T.clone() },
      uN: { value: fr.N.clone() },
      uG: { value: o.glassW },
      uTiles: { value: tiles.length },
      uP0: { value: tex(0) },
      uP1: { value: tex(1) },
      uP2: { value: tex(2) },
      uP3: { value: tex(3) },
      uP4: { value: tex(4) },
      uP5: { value: tex(5) },
      uPR: { value: rects },
      uRefEye: { value: new THREE.Vector3(...(o.paint?.eye ?? [0, 0, 0])) },
      uRefVP: { value: o.paint?.viewProj.clone() ?? new THREE.Matrix4() },
      uVD: { value: o.paint?.depth ?? 8 },
      uOpp: { value: new THREE.Vector4(op.w, op.top, op.base, op.pitch) },
      uOpp2: { value: new THREE.Vector4(op.sill, op.head, op.treeTop, op.trees) },
      uK0: { value: o.k0 ?? 0.22 },
      uDim: { value: o.dim ?? 1 },
      uFogMul: { value: o.fog ?? 1 },
      uId: { value: 0.3 + ((idc++ * 0.618) % 1) * 0.6 },
      uRSkyLo: { value: new THREE.Color(c.skyLo) },
      uRSkyHi: { value: new THREE.Color(c.skyHi) },
      uRWall: { value: new THREE.Color(c.wall) },
      uRWin: { value: new THREE.Color(c.win) },
      uRWin2: { value: new THREE.Color(c.win2) },
      uRTree: { value: new THREE.Color(c.tree) },
      uRGround: { value: new THREE.Color(c.ground) },
      uIWall: { value: new THREE.Color(c.iWall) },
      uIFloor: { value: new THREE.Color(c.iFloor) },
      uICeil: { value: new THREE.Color(c.iCeil) },
      uILamp: { value: new THREE.Color(c.iLamp) },
      uICurtain: { value: new THREE.Color(c.iCurtain) },
    },
    vertexShader: VS,
    fragmentShader: FS,
    clipping: true,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

/**
 * ガラスの板（壁の座標の長方形）に、部屋の区画の情報を付ける。
 * cell = [区画の u0, u1, 床の y, 天井の y]、room = [奥行き, 種類, 種, 見せ方]
 */
export function glassQuad(fr: LocalFrame, u0: number, y0: number, u1: number, y1: number, w: number, cell: [number, number, number, number], room: [number, number, number, number], pane: [number, number] = [0.7, 1.1]): THREE.BufferGeometry {
  const g = fr.quad(u0, y0, u1, y1, w);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  const rc = new Float32Array(n * 4);
  const pn = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    a.set(cell, i * 4);
    b.set(room, i * 4);
    rc.set([u0, y0, u1, y1], i * 4);
    pn.set(pane, i * 2);
  }
  g.setAttribute('aPane', new THREE.BufferAttribute(pn, 2));
  g.setAttribute('aCell', new THREE.BufferAttribute(a, 4));
  g.setAttribute('aRoom', new THREE.BufferAttribute(b, 4));
  g.setAttribute('aRect', new THREE.BufferAttribute(rc, 4));
  return g;
}
