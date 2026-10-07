import * as THREE from 'three';
import { styleUniforms } from './Style.ts';

/**
 * 灯りの光だまり（天井灯・スタンド・自販機・窓ぎわの明るさなど）。
 * 色彩設計の材質の「照明の倍率」に足すので、段落としの段（日なた・ハイライト）が灯りのまわりで切り替わり、
 * 段の境目は場面の段と同じノイズでちぎれる（塗りの光だまり）。影は付けない代わりに、灯りごとに「照らす箱」を決めて、
 * 箱の外（壁の向こうの部屋）には漏れないようにする。毎フレーム、目に近い灯り 16 個だけを使う。
 */
export interface Lamp {
  /** 光の中心（天井灯なら器具の少し下） */
  pos: [number, number, number];
  /** 届く距離（m）。中心で intensity、距離 radius で 0 */
  radius: number;
  /** 照明の倍率に足す量（0.3 で陰 → 日なたくらい、0.8 でハイライトまで） */
  intensity: number;
  /** 光の色（段の色を少し寄せる。既定 白） */
  color?: THREE.ColorRepresentation;
  /** 照らす箱（部屋の内側の寸法など）。[x0, y0, z0, x1, y1, z1]。省略時は球の外接箱 */
  box?: [number, number, number, number, number, number];
  /** 照らす箱を、箱の中心のまわりに Y 軸で回す（ラジアン。Object3D.rotation.y と同じ向き。斜めの建物の部屋） */
  yaw?: number;
  /** 四角い光だまり（天窓・四角い器具の形。照らす箱の向き yaw に揃う）。既定は丸 */
  square?: boolean;
  /**
   * 縁を硬くする（なめらかに弱まらず、半分ほどの所で切れる。参考画像の角ばった日なた）。
   * 場面の影の升目（StylePreset.shadowQuant）があれば、縁も影と同じ升目に沿って段になる
   */
  hard?: boolean;
  /** 下向きの灯り（天井灯）。真下ほど明るく、横・上はほぼ照らさない */
  down?: boolean;
  /** false で消す（点滅・スイッチ） */
  on?: boolean;
  /**
   * 場面の平行光源（sun）の影をこの灯りにも効かせる割合（0〜1。既定 0.8）。
   * 室内の場面の sun は天井の明かりの代わりなので、家具の下・棚の陰の影が灯りで消えないようにする。屋外の街灯などは 0
   */
  shadow?: number;
}

export const MAX_LAMPS = 16;

export const LAMP_GLSL = /* glsl */ `
uniform float uLampCount;
uniform vec4 uLampPos[${MAX_LAMPS}];
uniform vec4 uLampColor[${MAX_LAMPS}];
uniform vec3 uLampBoxMin[${MAX_LAMPS}];
uniform vec3 uLampBoxMax[${MAX_LAMPS}];
uniform vec4 uLampExtra[${MAX_LAMPS}]; // 影の効き, yaw, 四角, 硬い
uniform vec2 uLampParams;
uniform float uLampQuant;
uniform vec3 uLampAllMin;
uniform vec3 uLampAllMax;
// 灯りの明るさ（照明の倍率に足す。RGB）。sunVis = この画素の平行光源の影（1 = 日なた）
vec3 sl_lamps(vec3 p, vec3 n, float sunVis) {
  vec3 acc = vec3(0.0);
  // どの灯りの箱にも入らない画素は繰り返しをしない（全部の箱を包む箱で先に調べる）
  if (any(lessThan(p, uLampAllMin)) || any(greaterThan(p, uLampAllMax))) return acc;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (float(i) >= uLampCount) break;
    vec3 q = p;
    float yw = uLampExtra[i].y;
    if (yw != 0.0) {
      // 回した箱: 点を箱の向きへ戻してから調べる
      vec3 bc = (uLampBoxMin[i] + uLampBoxMax[i]) * 0.5;
      vec3 r = p - bc;
      float cs = cos(yw);
      float sn = sin(yw);
      q = bc + vec3(cs * r.x - sn * r.z, r.y, sn * r.x + cs * r.z);
    }
    if (any(lessThan(q, uLampBoxMin[i])) || any(greaterThan(q, uLampBoxMax[i]))) continue;
    // 硬い縁: 面の上の点を影の升目の中心へ寄せる（縁が升目に沿って段になる）
    vec3 pp = p;
    if (uLampExtra[i].w > 0.5 && uLampQuant > 0.0) {
      vec3 an = abs(n);
      vec3 cell = (floor(p / uLampQuant) + 0.5) * uLampQuant;
      if (an.y >= an.x && an.y >= an.z) pp.xz = cell.xz; else if (an.x >= an.z) pp.zy = cell.zy; else pp.xy = cell.xy;
    }
    vec3 d = uLampPos[i].xyz - pp;
    float dist = length(d);
    float r = uLampPos[i].w;
    float x;
    if (uLampExtra[i].z > 0.5) {
      // 四角: 箱の向きで、横は大きい方の軸・縦は半分の重み
      vec3 e = -d;
      if (yw != 0.0) {
        float c2 = cos(yw);
        float s2 = sin(yw);
        e = vec3(c2 * e.x - s2 * e.z, e.y, s2 * e.x + c2 * e.z);
      }
      vec3 a = abs(e) / r;
      x = max(max(a.x, a.z), a.y * 0.5);
    } else {
      x = dist / r;
    }
    if (x >= 1.0) continue;
    vec3 l = d / max(dist, 1e-4);
    // なめらかに 0 へ（中心付近は平ら、縁で落ちる。塗りの光だまりの形）。硬い縁は途中で切る
    float att = 1.0 - x * x;
    att *= att;
    if (uLampExtra[i].w > 0.5) att = step(0.3, att);
    // 面の向き（回り込みを少し入れて、壁も淡く照らす）
    float ndl = max(dot(n, l), 0.0) * 0.7 + 0.3;
    // 下向きの灯り: 真下ほど明るい
    float cone = uLampColor[i].w > 0.5 ? smoothstep(0.15, 0.85, l.y) : 1.0;
    acc += uLampColor[i].rgb * att * ndl * cone * mix(1.0, sunVis, uLampExtra[i].x);
  }
  return acc;
}
`;

const _c = new THREE.Color();

export class LampSet {
  readonly list: Lamp[] = [];
  /** 照らす箱までこれより遠い灯りは送らない（m。画素ごとの灯りの繰り返しを減らす） */
  maxDist = 24;
  private readonly order: { l: Lamp; d: number }[] = [];

  add(l: Lamp): Lamp {
    this.list.push(l);
    return l;
  }

  clear(): void {
    this.list.length = 0;
  }

  /** 目に近い灯り（照らす箱までの距離の近い順）を uniform へ */
  update(eye: THREE.Vector3): void {
    const u = styleUniforms;
    this.order.length = 0;
    for (const l of this.list) {
      if (l.on === false || l.intensity <= 0) continue;
      const b = l.box ?? [l.pos[0] - l.radius, l.pos[1] - l.radius, l.pos[2] - l.radius, l.pos[0] + l.radius, l.pos[1] + l.radius, l.pos[2] + l.radius];
      const dx = Math.max(b[0] - eye.x, 0, eye.x - b[3]);
      const dy = Math.max(b[1] - eye.y, 0, eye.y - b[4]);
      const dz = Math.max(b[2] - eye.z, 0, eye.z - b[5]);
      if (Math.hypot(dx, dy, dz) > this.maxDist) continue;
      // 同じ箱の中なら灯りまでの距離で順を付ける
      this.order.push({ l, d: Math.hypot(dx, dy, dz) * 4 + Math.hypot(l.pos[0] - eye.x, l.pos[1] - eye.y, l.pos[2] - eye.z) * 0.1 });
    }
    this.order.sort((a, b) => a.d - b.d);
    const n = Math.min(MAX_LAMPS, this.order.length);
    const all = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) {
      const l = this.order[i].l;
      const b = l.box ?? [l.pos[0] - l.radius, l.pos[1] - l.radius, l.pos[2] - l.radius, l.pos[0] + l.radius, l.pos[1] + l.radius, l.pos[2] + l.radius];
      u.uLampPos.value[i].set(l.pos[0], l.pos[1], l.pos[2], l.radius);
      _c.set(l.color ?? 0xffffff);
      u.uLampColor.value[i].set(_c.r * l.intensity, _c.g * l.intensity, _c.b * l.intensity, l.down ? 1 : 0);
      u.uLampBoxMin.value[i].set(b[0], b[1], b[2]);
      u.uLampBoxMax.value[i].set(b[3], b[4], b[5]);
      u.uLampExtra.value[i].set(l.shadow ?? 0.8, l.yaw ?? 0, l.square ? 1 : 0, l.hard ? 1 : 0);
      // 回した箱は、回した後の外接箱で包む
      const cx = (b[0] + b[3]) / 2;
      const cz = (b[2] + b[5]) / 2;
      const c = Math.abs(Math.cos(l.yaw ?? 0));
      const s = Math.abs(Math.sin(l.yaw ?? 0));
      const hx = ((b[3] - b[0]) / 2) * c + ((b[5] - b[2]) / 2) * s;
      const hz = ((b[3] - b[0]) / 2) * s + ((b[5] - b[2]) / 2) * c;
      all[0] = Math.min(all[0], cx - hx);
      all[1] = Math.min(all[1], b[1]);
      all[2] = Math.min(all[2], cz - hz);
      all[3] = Math.max(all[3], cx + hx);
      all[4] = Math.max(all[4], b[4]);
      all[5] = Math.max(all[5], cz + hz);
    }
    u.uLampAllMin.value.set(all[0], all[1], all[2]);
    u.uLampAllMax.value.set(all[3], all[4], all[5]);
    u.uLampCount.value = n;
  }
}
