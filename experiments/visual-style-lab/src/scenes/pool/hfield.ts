import * as THREE from 'three';
import type { Colliders } from '../../core/Colliders.ts';

/**
 * プールの底の高さ（水面 y = 0 より下）を升目で持つ。水面のシェーダーが視線を屈折させてこの升目をたどり、
 * 当たった所の底のタイル・日の当たり・吸収を計算する（屈折用の描画が要らない）。
 * 当たり判定（水の中を歩く）も同じ値から作る。
 */
export class HField {
  readonly data: Float32Array;
  readonly nx: number;
  readonly nz: number;

  constructor(
    readonly x0: number,
    readonly z0: number,
    readonly x1: number,
    readonly z1: number,
    readonly cell: number,
    readonly base: number,
  ) {
    this.nx = Math.round((x1 - x0) / cell);
    this.nz = Math.round((z1 - z0) / cell);
    this.data = new Float32Array(this.nx * this.nz).fill(base);
  }

  /** 範囲（ワールド座標）の底の高さを決める。mode = 'max' なら高い方を残す */
  rect(xa: number, za: number, xb: number, zb: number, y: number, mode: 'set' | 'max' | 'min' = 'set'): void {
    const ia = Math.max(0, Math.round((Math.min(xa, xb) - this.x0) / this.cell));
    const ib = Math.min(this.nx, Math.round((Math.max(xa, xb) - this.x0) / this.cell));
    const ja = Math.max(0, Math.round((Math.min(za, zb) - this.z0) / this.cell));
    const jb = Math.min(this.nz, Math.round((Math.max(za, zb) - this.z0) / this.cell));
    for (let j = ja; j < jb; j++)
      for (let i = ia; i < ib; i++) {
        const k = j * this.nx + i;
        this.data[k] = mode === 'set' ? y : mode === 'max' ? Math.max(this.data[k], y) : Math.min(this.data[k], y);
      }
  }

  at(x: number, z: number): number {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return this.base;
    return this.data[j * this.nx + i];
  }

  texture(): THREE.DataTexture {
    const t = new THREE.DataTexture(this.data, this.nx, this.nz, THREE.RedFormat, THREE.FloatType);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  /**
   * 水の中を歩く当たり判定（遅くなる床）。同じ高さの升目を長方形にまとめる。水面より上の升目（通路）は除く。
   * 深い所は minY より下へ沈まない（目が水に潜らない）。本当の水深は箱の depth に入れる（水面 y = 0）
   */
  addColliders(c: Colliders, slow: number, minY = -1.0): void {
    const done = new Uint8Array(this.nx * this.nz);
    const d = this.data;
    for (let j = 0; j < this.nz; j++)
      for (let i = 0; i < this.nx; i++) {
        const k = j * this.nx + i;
        if (done[k] || d[k] >= 0) continue;
        const y = d[k];
        let w = 1;
        while (i + w < this.nx && !done[k + w] && d[k + w] === y) w++;
        let h = 1;
        grow: while (j + h < this.nz) {
          for (let q = 0; q < w; q++) {
            const kk = (j + h) * this.nx + i + q;
            if (done[kk] || d[kk] !== y) break grow;
          }
          h++;
        }
        for (let b = 0; b < h; b++) for (let q = 0; q < w; q++) done[(j + b) * this.nx + i + q] = 1;
        const xa = this.x0 + i * this.cell;
        const za = this.z0 + j * this.cell;
        const yy = Math.max(y, minY);
        c.add({ x: xa, y: yy - 2, z: za }, { x: xa + w * this.cell, y: yy, z: za + h * this.cell }, slow).depth = -y;
      }
  }
}
