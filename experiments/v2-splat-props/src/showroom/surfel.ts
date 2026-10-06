/**
 * 見本の部屋の粒（スプラット）の受け。形の道具と形の関数は v2 の物（v2/client/props/shape.ts・gen/*.ts）をそのまま使い、
 * 同じ曲面に粒も置く（Surfels を形の関数に渡すと、メッシュの曲面 patches と粒の両方ができる）。
 *
 * 粒は面に貼り付く楕円（2D ガウシアン）。大きさは隣の粒との間隔から、向きは曲面の接線と法線から決まる。
 * 粗さ・金属度・不透明度・材質の番号を粒ごとに持つ。
 */
import { ShapeSink, type Look, type SplatSink, type V3 } from '../../../../v2/client/props/shape.ts';
import { encodeQuat } from '../splatbuild.ts';

export * from '../../../../v2/client/props/shape.ts';

export class Surfels extends ShapeSink implements SplatSink {
  n = 0;
  private cap = 0;
  center = new Float32Array(0);
  normal = new Float32Array(0);
  quat = new Uint32Array(0);
  scale = new Float32Array(0);
  albedo = new Float32Array(0);
  emit = new Float32Array(0);
  rough = new Float32Array(0);
  metal = new Float32Array(0);
  opacity = new Float32Array(0);
  mat = new Uint16Array(0);

  constructor() {
    super();
    // 既定は粒だけ（同じ形のメッシュも作るときは patches = []）
    this.patches = null;
    this.splats = this;
  }

  private grow(n: number): void {
    if (n <= this.cap) return;
    const cap = Math.max(n, this.cap * 2, 8192);
    const g = <T extends Float32Array | Uint32Array | Uint16Array>(a: T, k: number): T => { const b = new (a.constructor as new (n: number) => T)(cap * k); b.set(a); return b; };
    this.center = g(this.center, 3); this.normal = g(this.normal, 3); this.quat = g(this.quat, 1); this.scale = g(this.scale, 2);
    this.albedo = g(this.albedo, 3); this.emit = g(this.emit, 3); this.rough = g(this.rough, 1); this.metal = g(this.metal, 1);
    this.opacity = g(this.opacity, 1); this.mat = g(this.mat, 1);
    this.cap = cap;
  }

  /** 粒を 1 つ。t は接線（粒の u の向き）、n は法線。su・sv は u・v の向きの広がり（標準偏差 m） */
  push(p: V3, n: V3, t: V3, su: number, sv: number, c: V3, look: Look, opacity = look.opacity, rough = look.rough): void {
    // 接線を法線に直交させる
    const d = t[0] * n[0] + t[1] * n[1] + t[2] * n[2];
    let tx = t[0] - n[0] * d, ty = t[1] - n[1] * d, tz = t[2] - n[2] * d;
    let tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-6) { // 法線に平行な接線: 適当な直交の向き
      if (Math.abs(n[0]) < 0.9) { tx = 0; ty = -n[2]; tz = n[1]; } else { tx = -n[2]; ty = 0; tz = n[0]; }
      tl = Math.hypot(tx, ty, tz);
    }
    tx /= tl; ty /= tl; tz /= tl;
    const bx = n[1] * tz - n[2] * ty, by = n[2] * tx - n[0] * tz, bz = n[0] * ty - n[1] * tx;
    // 回転行列（列 = t, b, n）→ 四元数
    const m00 = tx, m10 = ty, m20 = tz, m01 = bx, m11 = by, m21 = bz, m02 = n[0], m12 = n[1], m22 = n[2];
    const tr = m00 + m11 + m22;
    let qx: number, qy: number, qz: number, qw: number;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); qw = 0.25 / s; qx = (m21 - m12) * s; qy = (m02 - m20) * s; qz = (m10 - m01) * s; }
    else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); qw = (m21 - m12) / s; qx = 0.25 * s; qy = (m01 + m10) / s; qz = (m02 + m20) / s; }
    else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = 0.25 * s; qz = (m12 + m21) / s; }
    else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = 0.25 * s; }
    const i = this.n;
    this.grow(i + 1);
    this.center[i * 3] = p[0]; this.center[i * 3 + 1] = p[1]; this.center[i * 3 + 2] = p[2];
    this.normal[i * 3] = n[0]; this.normal[i * 3 + 1] = n[1]; this.normal[i * 3 + 2] = n[2];
    this.quat[i] = encodeQuat(qx, qy, qz, qw);
    this.scale[i * 2] = Math.max(1e-4, su); this.scale[i * 2 + 1] = Math.max(1e-4, sv);
    this.albedo[i * 3] = c[0]; this.albedo[i * 3 + 1] = c[1]; this.albedo[i * 3 + 2] = c[2];
    const e = look.emit;
    if (e) { this.emit[i * 3] = e[0]; this.emit[i * 3 + 1] = e[1]; this.emit[i * 3 + 2] = e[2]; }
    this.rough[i] = rough; this.metal[i] = look.metal; this.opacity[i] = opacity; this.mat[i] = look.mat;
    this.n = i + 1;
  }

  /** 外接の箱（min・max） */
  bounds(from = 0, to = this.n): { min: V3; max: V3 } {
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    for (let i = from; i < to; i++) for (let k = 0; k < 3; k++) { const v = this.center[i * 3 + k]!; if (v < min[k]!) min[k] = v; if (v > max[k]!) max[k] = v; }
    return { min, max };
  }
}
