import * as THREE from 'three';
import type { HField } from '../../scenes/pool/hfield.ts';

/**
 * 水面の形: 底の升目のうち水のある所（高さ < 0）だけを、行ごとにまとめた長方形にする。
 * 建物の外・部屋の床の下に水面を描かない（真上の図にも水の無い所が出ない）。
 */
export function waterGeometry(hf: HField): THREE.BufferGeometry {
  const pos: number[] = [];
  const { nx, nz, cell, x0, z0, data } = hf;
  const done = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (done[k] || data[k] >= 0) continue;
      let w = 1;
      while (i + w < nx && !done[k + w] && data[k + w] < 0) w++;
      let h = 1;
      grow: while (j + h < nz) {
        for (let q = 0; q < w; q++) {
          const kk = (j + h) * nx + i + q;
          if (done[kk] || data[kk] >= 0) break grow;
        }
        h++;
      }
      for (let bb = 0; bb < h; bb++) for (let q = 0; q < w; q++) done[(j + bb) * nx + i + q] = 1;
      const xa = x0 + i * cell;
      const za = z0 + j * cell;
      const xb = xa + w * cell;
      const zb = za + h * cell;
      pos.push(xa, 0, za, xa, 0, zb, xb, 0, zb, xa, 0, za, xb, 0, zb, xb, 0, za);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.computeBoundingSphere();
  return g;
}
