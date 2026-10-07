import * as THREE from 'three';
import { rng } from '../Builder.ts';
import { trs } from './kit.ts';

/**
 * 上屋の下面の細かい骨組み（暗い所に暗い物が重なる、参考画像の「密度」）。
 * 小梁の並び（波板の筋）・長手の梁・ケーブルラック（はしご形）・配管・吊り下げの箱・吊り金具を、
 * 単位の箱を伸ばした InstancedMesh で置く（材質ごとに 1 回の描画）。
 */

const UNIT = new THREE.BoxGeometry(1, 1, 1);

/** 単位の箱を置く行列を集める */
export class BoxBatch {
  readonly mats: THREE.Matrix4[] = [];
  /** 中心と寸法（軸に沿った箱） */
  box(c: [number, number, number], s: [number, number, number], ry = 0): void {
    this.mats.push(trs(c[0], c[1], c[2], ry, s[0], s[1], s[2]));
  }
  /** 角の座標で */
  mm(a: [number, number, number], b: [number, number, number]): void {
    this.box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])]);
  }
  /** InstancedMesh にして root に足す */
  build(root: THREE.Object3D, mat: THREE.Material, layer = 0): THREE.InstancedMesh | null {
    if (!this.mats.length) return null;
    const im = new THREE.InstancedMesh(UNIT, mat, this.mats.length);
    this.mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    if (layer) im.layers.set(layer);
    root.add(im);
    return im;
  }
}

export interface UndersideSpec {
  /** 範囲（ワールド座標） */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** 下面の高さ */
  y: number;
  /** 長手の向き */
  along: 'x' | 'z';
  /** 小梁（波板の筋）の間隔・深さ。0 で無し */
  rib?: [number, number];
  /** 長手の梁（横の位置・深さ・幅） */
  beams?: [number, number, number][];
  /** 横の梁（長手の位置・深さ・幅） */
  cross?: [number, number, number][];
  /** ケーブルラック（横の位置・下面からの下がり・幅） */
  trays?: [number, number, number][];
  /** 配管（横の位置・下面からの下がり・太さ） */
  pipes?: [number, number, number][];
  /** 吊り下げの箱の数（乱数で置く）と大きさの範囲 */
  boxes?: { n: number; size: [number, number]; drop: [number, number]; lanes?: number[] };
  /** 吊り金具（細い棒）の間隔 */
  hangers?: number;
  seed?: number;
}

/**
 * 下面の骨組みを、暗い骨組み（dark）・少し明るい細部（lite）の 2 つの束に入れる。
 * 長手の座標を u、横の座標を v と呼ぶ。
 */
export function underside(spec: UndersideSpec, dark: BoxBatch, lite: BoxBatch): void {
  const r = rng(spec.seed ?? 1);
  const ax = spec.along === 'x';
  const u0 = ax ? spec.x0 : spec.z0;
  const u1 = ax ? spec.x1 : spec.z1;
  const v0 = ax ? spec.z0 : spec.x0;
  const v1 = ax ? spec.z1 : spec.x1;
  const y = spec.y;
  // (u, v, y) → ワールド
  const W = (u: number, yy: number, v: number): [number, number, number] => (ax ? [u, yy, v] : [v, yy, u]);
  const S = (su: number, sy: number, sv: number): [number, number, number] => (ax ? [su, sy, sv] : [sv, sy, su]);
  // 小梁（長手と直角の細い筋）
  if (spec.rib && spec.rib[0] > 0) {
    const [step, depth] = spec.rib;
    for (let u = u0 + step / 2; u < u1; u += step) dark.box(W(u, y - depth / 2, (v0 + v1) / 2), S(0.05, depth, v1 - v0));
  }
  for (const [v, depth, w] of spec.beams ?? []) dark.box(W((u0 + u1) / 2, y - depth / 2, v), S(u1 - u0, depth, w));
  for (const [u, depth, w] of spec.cross ?? []) dark.box(W(u, y - depth / 2, (v0 + v1) / 2), S(w, depth, v1 - v0));
  // ケーブルラック: 2 本の縁と横木、吊り棒
  for (const [v, drop, w] of spec.trays ?? []) {
    const yy = y - drop;
    for (const s of [-1, 1]) lite.box(W((u0 + u1) / 2, yy, v + (s * w) / 2), S(u1 - u0, 0.06, 0.025));
    for (let u = u0 + 0.15; u < u1; u += 0.3) dark.box(W(u, yy - 0.02, v), S(0.025, 0.02, w));
    for (let u = u0 + 0.6; u < u1; u += 1.8) for (const s of [-1, 1]) dark.box(W(u, y - drop / 2, v + (s * w) / 2), S(0.015, drop, 0.015));
  }
  // 配管
  for (const [v, drop, t] of spec.pipes ?? []) {
    lite.box(W((u0 + u1) / 2, y - drop, v), S(u1 - u0, t, t));
    for (let u = u0 + 1.0; u < u1; u += 2.4) dark.box(W(u, y - drop / 2, v), S(0.04, drop, t * 1.6));
  }
  // 吊り下げの箱
  if (spec.boxes) {
    const { n, size, drop, lanes } = spec.boxes;
    for (let i = 0; i < n; i++) {
      const u = u0 + 0.5 + r() * (u1 - u0 - 1);
      const v = lanes && lanes.length ? lanes[Math.floor(r() * lanes.length)] + (r() - 0.5) * 0.4 : v0 + 0.5 + r() * (v1 - v0 - 1);
      const sx = size[0] + r() * (size[1] - size[0]);
      const sy = size[0] + r() * (size[1] - size[0]);
      const d = drop[0] + r() * (drop[1] - drop[0]);
      dark.box(W(u, y - d - sy / 2, v), S(sx, sy, sx * (0.6 + r() * 0.6)));
      dark.box(W(u, y - d / 2, v), S(0.03, d, 0.03));
    }
  }
  // 吊り金具（細い縦の棒と、その先の小さな金物）
  if (spec.hangers) {
    for (let u = u0 + spec.hangers / 2; u < u1; u += spec.hangers) {
      const v = v0 + 0.4 + r() * (v1 - v0 - 0.8);
      const len = 0.15 + r() * 0.35;
      dark.box(W(u, y - len / 2, v), S(0.02, len, 0.02));
      lite.box(W(u, y - len - 0.03, v), S(0.08, 0.06, 0.05));
    }
  }
}
