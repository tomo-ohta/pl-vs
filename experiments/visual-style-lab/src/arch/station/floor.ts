import * as THREE from 'three';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import { stationMat } from './mat.ts';

/**
 * 濡れたホームの床。コンクリートの色・点字ブロックと白い縁の帯・目地、水たまり（鏡のように霧と灯りを映す）。
 * 水たまりの形: ねじったノイズのしきい値（ホームの中ほどで多く、縁ほど少ない）に、
 * 手で置いた水たまり（楕円の縁をノイズでちぎった形。参考画像を見ながら置いた絵の具の塊）を足す。
 * 縁はくっきり、ぎざぎざ。
 */

export const MAX_STRIPS = 12;

/** ホームの座標系（u = 横（縁へ向かう）、v = 長手） */
export interface FloorFrame {
  cx: number;
  cz: number;
  /** 長手が X 軸（D ホーム）なら true */
  alongX: boolean;
}

/** 床の帯（ホームの座標系の長方形） */
export interface Strip {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** 1 = 黄色の線状ブロック、2 = 白い縁の警告ブロック、3 = 黄色の点状ブロック、4 = 白線 */
  kind: number;
}

export const MAX_PUDDLES = 16;

/** 手で置く水たまり（中心・半径・向き。縁はノイズでちぎる） */
export interface PuddleShape {
  x: number;
  z: number;
  rx: number;
  rz: number;
  /** Y 軸回りの向き（ラジアン） */
  rot?: number;
}

export interface FloorOptions {
  color: THREE.ColorRepresentation;
  frame: FloorFrame;
  strips: Strip[];
  refl: PlanarReflector;
  /** ノイズの水たまり: 大きさ（1/m）・しきい値・縁でしきい値が上がる量・ホームの半幅 */
  puddle?: [number, number, number, number];
  /** 長手のむら（大きさ 1/m・しきい値の揺れ） */
  puddleVar?: [number, number];
  /** 手で置く水たまり */
  shapes?: PuddleShape[];
  /** 長手の範囲（v0, v1）でノイズの水たまりを減らす（しきい値に足す量） */
  dryZone?: [number, number, number];
  /** 黄色・白の色 */
  yellow?: THREE.ColorRepresentation;
  white?: THREE.ColorRepresentation;
  /** 目地の間隔（長手方向、m。0 で無し） */
  joint?: number;
  /** 黄色の帯を長手の位置で横にずらす（v0 で s0、v1 で s1 m 外へ） */
  yShift?: [number, number, number, number];
  /** 映り込みに掛ける色 */
  reflTint?: THREE.ColorRepresentation;
  /** 乾いた所の映り込みの強さ（既定 0.25） */
  dryRefl?: number;
  /** 水たまりの映り込みの強さ（既定 1） */
  wetRefl?: number;
  /** 点字ブロックの帯の映り込みの強さ（既定 0.6） */
  stripRefl?: number;
  /** 乾いた所の映り込みに場所ごとの倍率を掛けるか（既定 true） */
  lookRefl?: boolean;
  /**
   * 回して置いたホーム（D）: 模様（水たまり・帯）を回す前の座標で計算する（見え方を元の版と同じにする）。
   * 回す前の横・長手 = (su·u, sv·v)、回す前の点 = (ox + sv·v, oz + su·u)。手で置いた水たまり（shapes）も回す前の座標で書く
   */
  oldFrame?: { ox: number; oz: number; su: number; sv: number };
}

export function floorMat(o: FloorOptions): THREE.ShaderMaterial {
  const strips = Array.from({ length: MAX_STRIPS }, (_, i) => {
    const s = o.strips[i];
    return s ? new THREE.Vector4(Math.min(s.u0, s.u1), Math.max(s.u0, s.u1), Math.min(s.v0, s.v1), Math.max(s.v0, s.v1)) : new THREE.Vector4(0, 0, 0, 0);
  });
  const kinds = Array.from({ length: MAX_STRIPS }, (_, i) => o.strips[i]?.kind ?? 0);
  const shapes = o.shapes ?? [];
  const pe = Array.from({ length: MAX_PUDDLES }, (_, i) => {
    const sh = shapes[i];
    return sh ? new THREE.Vector4(sh.x, sh.z, sh.rx, sh.rz) : new THREE.Vector4(0, 0, 0, 0);
  });
  const per = Array.from({ length: MAX_PUDDLES }, (_, i) => shapes[i]?.rot ?? 0);
  const uniforms: Record<string, THREE.IUniform> = {
    uFrame: { value: new THREE.Vector3(o.frame.cx, o.frame.cz, o.frame.alongX ? 1 : 0) },
    uStrips: { value: strips },
    uStripKind: { value: kinds },
    uYellow: { value: new THREE.Color(o.yellow ?? '#c8c062') },
    uWhite: { value: new THREE.Color(o.white ?? '#80aab0') },
    uJoint: { value: o.joint ?? 0 },
    uYShift: { value: new THREE.Vector4(...(o.yShift ?? [0, 1, 0, 0])) },
    uPud: { value: new THREE.Vector4(...(o.puddle ?? [0.3, 0.2, 0.3, 3])) },
    uPud2: { value: new THREE.Vector2(...(o.puddleVar ?? [0.05, 0.0])) },
    uPE: { value: pe },
    uPER: { value: per },
    uPEN: { value: shapes.length },
    uDry: { value: new THREE.Vector3(...(o.dryZone ?? [0, 0, 0])) },
    uReflTex: { value: o.refl.target.texture },
    uReflMatrix: { value: o.refl.matrix },
    /** 水たまりの映り込みの強さ・乾いた所の映り込みの強さ・水たまりの外を暗くする */
    uRefl: { value: new THREE.Vector3(o.wetRefl ?? 1.0, o.dryRefl ?? 0.25, 0.85) },
    uStripRefl: { value: o.stripRefl ?? 0.6 },
    uLookRefl: { value: o.lookRefl === false ? 0 : 1 },
    /** 映り込みの色（水は赤を少し吸う） */
    uReflTint: { value: new THREE.Color(o.reflTint ?? '#a8f0ff') },
    uOldFrame: { value: new THREE.Vector3(o.oldFrame?.ox ?? 0, o.oldFrame?.oz ?? 0, o.oldFrame ? 1 : 0) },
    uOldSign: { value: new THREE.Vector2(o.oldFrame?.su ?? 1, o.oldFrame?.sv ?? 1) },
  };
  return stationMat({
    color: o.color,
    line: 0,
    uniforms,
    fragHead: /* glsl */ `
uniform vec3 uFrame;
uniform vec4 uStrips[${MAX_STRIPS}];
uniform float uStripKind[${MAX_STRIPS}];
uniform vec3 uYellow;
uniform vec3 uWhite;
uniform float uJoint;
uniform vec4 uYShift;
uniform vec4 uPud;
uniform vec2 uPud2;
uniform vec4 uPE[${MAX_PUDDLES}];
uniform float uPER[${MAX_PUDDLES}];
uniform int uPEN;
uniform vec3 uDry;
uniform sampler2D uReflTex;
uniform mat4 uReflMatrix;
uniform vec3 uRefl;
uniform float uStripRefl;
uniform float uLookRefl;
uniform float uStStripRefl;
uniform float uStFloorRefl;
uniform float uStWet;
uniform float uStPudLift;
uniform float uStStripGain;
uniform vec3 uReflTint;
uniform vec3 uOldFrame;
uniform vec2 uOldSign;
// 水たまりの形（正 = 水）。ノイズのしきい値と、手で置いた楕円の和
float fl_puddle(vec2 xz, float u, float v) {
  // 横（u）に長い塊（長手 v に細かく）
  float nz = sl_warp(vec3(vec2(u * 0.7, v * 1.3) * uPud.x, 0.37), 5);
  float th = uPud.y + uPud.z * smoothstep(0.3, 0.9, abs(u) / uPud.w) + sl_fbm(vec3(xz * uPud2.x, 2.1), 3) * uPud2.y;
  th += uDry.z * smoothstep(uDry.x - 2.0, uDry.x, v) * (1.0 - smoothstep(uDry.y, uDry.y + 2.0, v));
  float f = nz - th;
  // 手で置いた水たまりの縁と中の乾いた島（横に長い、ちぎれた形）。
  // 縁のノイズは、どれかの水たまりの近く（楕円の 1.45 倍の内側。外では値が水にならない）でだけ計算する
  float rag = 0.0;
  bool ragDone = false;
  for (int i = 0; i < ${MAX_PUDDLES}; i++) {
    if (i >= uPEN) break;
    vec4 e = uPE[i];
    vec2 d = xz - e.xy;
    float c = cos(uPER[i]);
    float s = sin(uPER[i]);
    d = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / e.zw;
    float L = length(d);
    if (L > 1.45) continue;
    if (!ragDone) {
      rag = sl_warp(vec3(vec2(u * 0.9, v * 2.6), 5.1), 4) * 0.8 + sl_vnoise(vec3(u * 3.0, v * 9.0, 8.3)) * 0.25;
      ragDone = true;
    }
    f = max(f, (1.0 - L) * 0.4 + rag * 0.18 - 0.02);
  }
  // 縁をぎざぎざに
  f += sl_vnoise(vec3(xz * 9.0, 1.3)) * 0.025 + sl_vnoise(vec3(xz * 31.0, 4.1)) * 0.012;
  return f;
}
`,
    fragAlbedo: /* glsl */ `
  float puddle = 0.0;
  float strip = 0.0;
  {
    vec2 rel = p.xz - uFrame.xy;
    float u = uFrame.z > 0.5 ? rel.y : rel.x;
    float v = uFrame.z > 0.5 ? rel.x : rel.y;
    // 模様に使う xz（回して置いたホームは回す前の座標）
    vec2 pxz = p.xz;
    if (uOldFrame.z > 0.5) {
      u *= uOldSign.x;
      v *= uOldSign.y;
      pxz = vec2(uOldFrame.x + v, uOldFrame.y + u);
    }
    vec2 aa = fwidth(vec2(u, v));
    for (int i = 0; i < ${MAX_STRIPS}; i++) {
      vec4 s = uStrips[i];
      float k = uStripKind[i];
      if (k < 0.5) continue;
      float uu = u;
      if (k < 1.5) uu = sign(u) * (abs(u) - mix(uYShift.z, uYShift.w, clamp((v - uYShift.x) / (uYShift.y - uYShift.x), 0.0, 1.0)));
      if (uu < s.x || uu > s.y || v < s.z || v > s.w) continue;
      if (k < 2.5) strip = 1.0;
      if (k < 1.5) {
        // 黄色の線状ブロック（長手の筋）
        float r = abs(fract((uu - s.x) / 0.075) - 0.5);
        float rid = smoothstep(0.18, 0.3, r);
        float blk = step(0.012, abs(fract(v / 0.3 + 0.5) - 0.5) * 0.3);
        albedo = uYellow * uStStripGain * mix(0.72, 1.0, rid) * mix(0.8, 1.0, blk);
      } else if (k < 2.5) {
        // 白い縁の警告ブロック（長手の筋）
        float r = abs(fract((u - s.x) / 0.06) - 0.5);
        albedo = uWhite * uStStripGain * mix(0.7, 1.0, smoothstep(0.15, 0.3, r));
      } else if (k < 3.5) {
        // 黄色の点状ブロック
        vec2 c = fract(vec2(u - s.x, v) / 0.075) - 0.5;
        float dots = smoothstep(0.32, 0.22, length(c));
        float blk = step(0.012, min(abs(fract((u - s.x) / 0.3 + 0.5) - 0.5), abs(fract(v / 0.3 + 0.5) - 0.5)) * 0.3);
        albedo = uYellow * mix(0.78, 1.05, dots) * mix(0.75, 1.0, blk);
      } else if (k < 4.5) {
        albedo = uWhite;
      } else {
        // 目地の線（暗い）
        albedo *= 0.55;
      }
    }
    if (uJoint > 0.0) {
      float j = abs(fract(v / uJoint + 0.5) - 0.5) * uJoint;
      albedo *= mix(0.7, 1.0, smoothstep(0.004, 0.004 + aa.y * 1.5, j));
    }
    {
      float f = fl_puddle(pxz, u, v);
      float w = fwidth(f) * 0.8 + 0.002;
      puddle = smoothstep(-w, w, f);
    }
    // 水たまりの外は少し暗く（濡れ）
    albedo *= mix(uRefl.z, 1.0, puddle);
  }
`,
    fragFinal: /* glsl */ `
  {
    vec4 pc = uReflMatrix * vec4(p, 1.0);
    vec2 ruv = pc.xy / pc.w;
    vec3 r = texture2D(uReflTex, ruv).rgb * uReflTint;
    vec3 vd = normalize(cameraPosition - p);
    float c = clamp(vd.y, 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - c, 5.0);
    // 水たまりの映り込み: 物理的なフレネルと、近くでも鏡のように映す絵の強さを場所ごとに混ぜる（uStWet）
    float fresW = mix(fres, 0.5 + 0.5 * pow(1.0 - c, 3.0), uStWet);
    // 乾いた所は浅い角度でだけ映す（荒れた面のつや）
    float k = mix(uRefl.y * mix(1.0, uStFloorRefl, uLookRefl) * pow(1.0 - c, 9.0), uRefl.x * fresW, puddle);
    // 点字ブロックの帯は濡れてつやがある
    k = max(k, uStripRefl * uStStripRefl * pow(1.0 - c, 12.0) * strip);
    col = mix(col, r, clamp(k, 0.0, 1.0));
    // 水たまりの明るさの持ち上げ（場所ごと。浅い角度で明るい霧を映す絵の表現）
    col += uSkyCol * uStPudLift * puddle * (0.4 + 0.6 * pow(1.0 - c, 3.0));
  }
`,
  });
}
