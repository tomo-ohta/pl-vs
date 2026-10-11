import * as THREE from 'three';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import type { FrameDef } from './layout.ts';

/**
 * 水路の局所の座標（目が原点・-z が奥・+x が右）を世界へ写す。回すのは 90° 単位なので、箱は軸に沿ったまま（当たり判定もそのまま）。
 */
export class Frame {
  readonly k: number;
  readonly ox: number;
  readonly oz: number;
  readonly yaw: number;
  constructor(d: FrameDef) {
    this.k = d.k;
    this.ox = d.ox;
    this.oz = d.oz;
    this.yaw = (d.k * Math.PI) / 2;
  }

  /** 局所の点 → 世界 */
  p(x: number, y: number, z: number): V3 {
    switch (this.k) {
      case 0:
        return [this.ox + x, y, this.oz + z];
      case 1:
        return [this.ox + z, y, this.oz - x];
      case 2:
        return [this.ox - x, y, this.oz - z];
      default:
        return [this.ox - z, y, this.oz + x];
    }
  }

  /** 世界の点 → 局所 */
  inv(x: number, y: number, z: number): V3 {
    const dx = x - this.ox;
    const dz = z - this.oz;
    switch (this.k) {
      case 0:
        return [dx, y, dz];
      case 1:
        return [-dz, y, dx];
      case 2:
        return [-dx, y, -dz];
      default:
        return [dz, y, -dx];
    }
  }

  /** 世界の箱 → 局所の箱 */
  boxInv(min: V3, max: V3): { min: V3; max: V3 } {
    const a = this.inv(min[0], min[1], min[2]);
    const b = this.inv(max[0], max[1], max[2]);
    return {
      min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    };
  }

  /** 局所の向き（水平）→ 世界 */
  dir(x: number, z: number): [number, number] {
    const a = this.p(x, 0, z);
    const o = this.p(0, 0, 0);
    return [a[0] - o[0], a[2] - o[2]];
  }

  /** 局所の箱（角の座標）→ 世界の箱 */
  box(min: V3, max: V3): { min: V3; max: V3 } {
    const a = this.p(min[0], min[1], min[2]);
    const b = this.p(max[0], max[1], max[2]);
    return {
      min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    };
  }

  /** 局所の長方形（x0, z0, x1, z1）→ 世界の長方形 */
  rect(r: [number, number, number, number]): [number, number, number, number] {
    const w = this.box([r[0], 0, r[1]], [r[2], 0, r[3]]);
    return [w.min[0], w.min[2], w.max[0], w.max[2]];
  }

  /** 局所の yaw（Object3D.rotation.y と同じ向き）→ 世界 */
  yawW(localYaw: number): number {
    return localYaw + this.yaw;
  }

  /** 局所の箱を Builder へ（世界の箱にして置く） */
  put(b: Builder, mat: THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
    const w = this.box(min, max);
    return b.boxMM(mat, w.min, w.max, o);
  }
}
