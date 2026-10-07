import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { rng } from '../Builder.ts';
import type { ViewDef } from '../types.ts';

/**
 * 壁面の絵（場面専用）。校舎の壁を 1 枚の平面とし、窓・腰壁・柱・映り込み・葉の影を手で描いた絵を貼る。
 * - 絵は壁に沿った座標（u: 壁に沿った m、y: 高さ m）で描く（ワールドに固定。歩いても絵は壁に付いたまま）
 * - 形は「参考画像の視点で画面のどこに見えるか」（画面の画素の座標）で書き、壁の平面へ戻して描く
 *   （手で置いた形を壁に写すだけで、参考画像そのものは使わない）
 * - 壁は区画（タイル）に分け、手前ほど細かい絵にする（近くでもぼけない・遠くは軽い）
 */

export type P2 = [number, number];

export interface FacadeFrame {
  /** 壁の平面の原点（u = 0, y = 0） */
  origin: [number, number, number];
  /** 壁に沿った向き（水平・単位） */
  tangent: [number, number, number];
  /** 見る側を向いた法線 */
  normal: [number, number, number];
}

export interface FacadeTile {
  u: [number, number];
  y: [number, number];
  /** 1 m あたりの画素 */
  ppm: number;
}

type Op =
  | { k: 'fill'; pts: P2[]; color: string }
  | { k: 'clear'; pts: P2[] }
  | { k: 'line'; a: P2; b: P2; w: number; color: string }
  | { k: 'ell'; c: P2; rx: number; ry: number; rot: number; color: string };

/** 参考画像の視点のカメラ（1456×816） */
export function refCamera(v: ViewDef): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(v.fov, 1456 / 816, 0.05, 1000);
  c.position.set(...v.eye);
  c.rotation.set(v.pitch, v.yaw, v.roll ?? 0, 'YXZ');
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

export class FacadePainter {
  readonly ops: Op[] = [];
  private readonly o: THREE.Vector3;
  private readonly t: THREE.Vector3;
  private readonly n: THREE.Vector3;
  private readonly rand: () => number;

  constructor(
    readonly frame: FacadeFrame,
    readonly cam: THREE.PerspectiveCamera,
    seed = 1,
  ) {
    this.o = new THREE.Vector3(...frame.origin);
    this.t = new THREE.Vector3(...frame.tangent).normalize();
    this.n = new THREE.Vector3(...frame.normal).normalize();
    this.rand = rng(seed);
  }

  /** 壁の座標 → ワールド */
  world(u: number, y: number, off = 0): THREE.Vector3 {
    return this.o.clone().addScaledVector(this.t, u).add(new THREE.Vector3(0, y, 0)).addScaledVector(this.n, off);
  }

  /** 画面の画素 → 壁の座標 */
  s2f(sx: number, sy: number): P2 {
    const ndc = new THREE.Vector3((sx / 1456) * 2 - 1, -((sy / 816) * 2 - 1), 0.5).unproject(this.cam);
    const ro = this.cam.position;
    const rd = ndc.sub(ro).normalize();
    const denom = rd.dot(this.n);
    const tt = this.o.clone().sub(ro).dot(this.n) / (Math.abs(denom) < 1e-6 ? 1e-6 : denom);
    const p = ro.clone().addScaledVector(rd, tt);
    const d = p.sub(this.o);
    return [d.dot(this.t), d.y];
  }

  /** 壁の座標 → 画面の画素 */
  f2s(u: number, y: number): P2 {
    const v = this.world(u, y).project(this.cam);
    return [((v.x + 1) / 2) * 1456, ((1 - v.y) / 2) * 816];
  }

  // ---------- 壁の座標で描く ----------
  fillF(pts: P2[], color: string): this {
    this.ops.push({ k: 'fill', pts, color });
    return this;
  }
  /** 塗った絵を消す（屋根の線より上など） */
  clearF(pts: P2[]): this {
    this.ops.push({ k: 'clear', pts });
    return this;
  }
  rectF(u0: number, y0: number, u1: number, y1: number, color: string): this {
    return this.fillF(
      [
        [u0, y0],
        [u1, y0],
        [u1, y1],
        [u0, y1],
      ],
      color,
    );
  }
  lineF(a: P2, b: P2, w: number, color: string): this {
    this.ops.push({ k: 'line', a, b, w, color });
    return this;
  }

  // ---------- 画面の画素で描く（参考画像の視点で見える位置） ----------
  fill(pts: P2[], color: string): this {
    return this.fillF(
      pts.map(([x, y]) => this.s2f(x, y)),
      color,
    );
  }
  /** 画面の線（幅は壁の m） */
  line(a: P2, b: P2, w: number, color: string): this {
    return this.lineF(this.s2f(...a), this.s2f(...b), w, color);
  }

  /**
   * 窓: 画面の四隅（左上・右上・右下・左下）。中を色で塗り、縦横の桟を引く（桟は壁の座標で等分）
   */
  win(q: [P2, P2, P2, P2], o: { color?: string; cols?: number; rows?: number; frame?: number; frameColor?: string; rowAt?: number[]; colAt?: number[] }): this {
    const f = q.map(([x, y]) => this.s2f(x, y)) as [P2, P2, P2, P2];
    if (o.color) this.fillF(f, o.color);
    const fc = o.frameColor ?? '#0b1a20';
    const w = o.frame ?? 0.06;
    const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const cols = o.colAt ?? Array.from({ length: (o.cols ?? 1) + 1 }, (_, i) => i / (o.cols ?? 1));
    const rows = o.rowAt ?? Array.from({ length: (o.rows ?? 1) + 1 }, (_, i) => i / (o.rows ?? 1));
    for (const c of cols) this.lineF(lerp(f[0], f[1], c), lerp(f[3], f[2], c), w, fc);
    for (const r of rows) this.lineF(lerp(f[0], f[3], r), lerp(f[1], f[2], r), w, fc);
    return this;
  }

  /**
   * 葉の塊: 画面の多角形を塗り、縁に葉（小さな楕円）を散らしてちぎれた輪郭にする。
   * leafPx: 葉の大きさ（画面の画素）。edge: 縁の葉の数の倍率。holes: 中に抜ける葉の色
   */
  foliage(pts: P2[], color: string, o: { leafPx?: number; edge?: number; holes?: string; holeAmt?: number; spread?: number; solid?: boolean } = {}): this {
    const lp = o.leafPx ?? 6;
    if (o.solid !== false) this.fill(pts, color);
    // 輪郭に沿って葉を置く
    const n = pts.length;
    let per = 0;
    for (let i = 0; i < n; i++) per += Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]);
    const count = Math.round((per / lp) * 1.6 * (o.edge ?? 1));
    const spread = (o.spread ?? 1.2) * lp;
    for (let k = 0; k < count; k++) {
      let d = this.rand() * per;
      let i = 0;
      for (; i < n; i++) {
        const l = Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]);
        if (d <= l) break;
        d -= l;
      }
      i = Math.min(i, n - 1);
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const l = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1e-6);
      const t = d / l;
      const nx = -(b[1] - a[1]) / l;
      const ny = (b[0] - a[0]) / l;
      const off = (this.rand() - 0.35) * spread * 2;
      this.leafAt([a[0] + (b[0] - a[0]) * t + nx * off, a[1] + (b[1] - a[1]) * t + ny * off], lp * (0.5 + this.rand() * 0.8), color);
    }
    if (o.holes) {
      // 中の抜け（向こうが透ける所）
      const box = bbox(pts);
      const area = (box[2] - box[0]) * (box[3] - box[1]);
      const hc = Math.round((area / (lp * lp)) * 0.05 * (o.holeAmt ?? 1));
      for (let k = 0; k < hc; k++) {
        const p: P2 = [box[0] + this.rand() * (box[2] - box[0]), box[1] + this.rand() * (box[3] - box[1])];
        if (!inPoly(p, pts)) continue;
        this.leafAt(p, lp * (0.4 + this.rand() * 0.7), o.holes);
      }
    }
    return this;
  }

  /** 葉を多角形の中に散らす（まばらな葉） */
  scatter(pts: P2[], colors: string[], o: { leafPx?: number; density?: number } = {}): this {
    const lp = o.leafPx ?? 6;
    const box = bbox(pts);
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    const cnt = Math.round((area / (lp * lp)) * (o.density ?? 0.5));
    for (let k = 0; k < cnt; k++) {
      const p: P2 = [box[0] + this.rand() * (box[2] - box[0]), box[1] + this.rand() * (box[3] - box[1])];
      if (!inPoly(p, pts)) continue;
      this.leafAt(p, lp * (0.5 + this.rand() * 0.8), colors[Math.floor(this.rand() * colors.length)]);
    }
    return this;
  }

  /** 画面の点に葉 1 枚（大きさは画面の画素。壁の座標へ局所的に変換） */
  leafAt(p: P2, rPx: number, color: string): void {
    const c = this.s2f(p[0], p[1]);
    const ex = this.s2f(p[0] + rPx, p[1]);
    const ey = this.s2f(p[0], p[1] + rPx);
    const sx = Math.hypot(ex[0] - c[0], ex[1] - c[1]);
    const sy = Math.hypot(ey[0] - c[0], ey[1] - c[1]);
    const rot = this.rand() * Math.PI;
    const asp = 0.45 + this.rand() * 0.35;
    this.ops.push({ k: 'ell', c, rx: sx, ry: sy * asp, rot, color });
  }

  /** 区画ごとにキャンバスへ描いてテクスチャにする */
  raster(tile: FacadeTile): THREE.CanvasTexture {
    const W = Math.max(4, Math.round((tile.u[1] - tile.u[0]) * tile.ppm));
    const H = Math.max(4, Math.round((tile.y[1] - tile.y[0]) * tile.ppm));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const sx = W / (tile.u[1] - tile.u[0]);
    const sy = H / (tile.y[1] - tile.y[0]);
    g.setTransform(sx, 0, 0, -sy, -tile.u[0] * sx, tile.y[1] * sy);
    const box = [tile.u[0], tile.y[0], tile.u[1], tile.y[1]];
    for (const op of this.ops) {
      if (op.k === 'clear') {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        g.beginPath();
        op.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.closePath();
        g.fill();
        g.restore();
      } else if (op.k === 'fill') {
        const b = bbox(op.pts);
        if (b[2] < box[0] || b[0] > box[2] || b[3] < box[1] || b[1] > box[3]) continue;
        g.fillStyle = op.color;
        g.beginPath();
        op.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.closePath();
        g.fill();
      } else if (op.k === 'line') {
        g.strokeStyle = op.color;
        g.lineWidth = op.w;
        g.beginPath();
        g.moveTo(op.a[0], op.a[1]);
        g.lineTo(op.b[0], op.b[1]);
        g.stroke();
      } else {
        if (op.c[0] + op.rx < box[0] || op.c[0] - op.rx > box[2] || op.c[1] + op.rx < box[1] || op.c[1] - op.rx > box[3]) continue;
        g.fillStyle = op.color;
        g.beginPath();
        g.ellipse(op.c[0], op.c[1], Math.max(op.rx, 1e-4), Math.max(op.ry, 1e-4), op.rot, 0, Math.PI * 2);
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  /** 区画の板（壁の平面から off m 手前） */
  plane(tile: FacadeTile, off = 0): THREE.BufferGeometry {
    const corners = [
      this.world(tile.u[0], tile.y[0], off),
      this.world(tile.u[1], tile.y[0], off),
      this.world(tile.u[1], tile.y[1], off),
      this.world(tile.u[0], tile.y[1], off),
    ];
    const g = new THREE.BufferGeometry();
    const pos = [corners[0], corners[1], corners[2], corners[0], corners[2], corners[3]].flatMap((v) => [v.x, v.y, v.z]);
    const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const n = this.n;
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(6).fill(0).flatMap(() => [n.x, n.y, n.z]), 3));
    // 見る側が表になるように並びを直す
    const e1 = corners[1].clone().sub(corners[0]);
    const e2 = corners[2].clone().sub(corners[0]);
    if (e1.cross(e2).dot(n) < 0) {
      const idx = [0, 2, 1, 3, 5, 4];
      const p2: number[] = [];
      const u2: number[] = [];
      for (const i of idx) {
        p2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        u2.push(uv[i * 2], uv[i * 2 + 1]);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(u2, 2));
    }
    return g;
  }
}

function bbox(pts: P2[]): [number, number, number, number] {
  let a = Infinity;
  let b = Infinity;
  let c = -Infinity;
  let d = -Infinity;
  for (const p of pts) {
    a = Math.min(a, p[0]);
    b = Math.min(b, p[1]);
    c = Math.max(c, p[0]);
    d = Math.max(d, p[1]);
  }
  return [a, b, c, d];
}

function inPoly(p: P2, pts: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const VS = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vVN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vVN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vVN;
uniform sampler2D uMap;
uniform float uFogMul;
uniform float uId;
${NOISE_GLSL}
${FOG_GLSL}
void main() {
  vec4 m = texture2D(uMap, vUv);
  if (m.a < 0.5) discard;
  vec3 col = m.rgb;
  col = mix(col, sl_applyFog(col, vWorld, cameraPosition), uFogMul);
  gl_FragColor = vec4(col, 1.0);
  gInfo = vec4(normalize(vVN).xy * 0.5 + 0.5, uId, 0.0);
}`;

let idc = 0;

/** 壁面の絵の材質（照明なし・霧あり） */
export function createFacadeMaterial(map: THREE.Texture, fog = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uMap: { value: map },
      uFogMul: { value: fog },
      uId: { value: 0.2 + ((idc++ * 0.618) % 1) * 0.7 },
    },
    vertexShader: VS,
    fragmentShader: FS,
  });
}
