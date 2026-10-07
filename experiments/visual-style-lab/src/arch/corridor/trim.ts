import type * as THREE from 'three';
import type { Leg } from './leg.ts';

/**
 * 脚の廊下の壁の小さな道具（区域の座標）。
 * n は壁の面の向き: -1 = 面が -x を向く（右の壁）、+1 = +x を向く（左の壁）。壁の厚さ 0.3 は面の裏へ。
 */

/** x = 一定の壁（z0〜z1、高さ y0〜y1）。当たり判定つき */
export function wallX(s: Leg, mat: THREE.Material, x: number, n: 1 | -1, z0: number, z1: number, y0: number, y1: number, thick = 0.3): void {
  if (z1 - z0 < 1e-3) return;
  const a = n < 0 ? x : x - thick;
  const b = n < 0 ? x + thick : x;
  s.faces([a, y0, z0], [b, y1, z1], n < 0 ? { nx: mat } : { px: mat }, { collide: y0 < 0.5 });
}

/** z = 一定の壁（x0〜x1）。n: -1 = 面が -z を向く、+1 = +z を向く */
export function wallZ(s: Leg, mat: THREE.Material, z: number, n: 1 | -1, x0: number, x1: number, y0: number, y1: number, thick = 0.3): void {
  if (x1 - x0 < 1e-3) return;
  const a = n < 0 ? z : z - thick;
  const b = n < 0 ? z + thick : z;
  s.faces([x0, y0, a], [x1, y1, b], n < 0 ? { nz: mat } : { pz: mat }, { collide: y0 < 0.5 });
}

/** x = 一定の壁の扉の口の枠（廊下の側。面から 0.02 出る） */
export function doorTrimX(s: Leg, mat: THREE.Material, x: number, n: 1 | -1, a: number, b: number, top: number, w = 0.05): void {
  const x0 = n < 0 ? x - 0.02 : x;
  const x1 = n < 0 ? x : x + 0.02;
  const f = n < 0 ? { nx: mat, pz: mat, nz: mat } : { px: mat, pz: mat, nz: mat };
  s.faces([x0, 0, a - w], [x1, top + w, a], f);
  s.faces([x0, 0, b], [x1, top + w, b + w], f);
  s.faces([x0, top, a], [x1, top + w, b], n < 0 ? { nx: mat, ny: mat } : { px: mat, ny: mat });
}

/** z = 一定の壁の扉の口の枠 */
export function doorTrimZ(s: Leg, mat: THREE.Material, z: number, n: 1 | -1, a: number, b: number, top: number, w = 0.05): void {
  const z0 = n < 0 ? z - 0.02 : z;
  const z1 = n < 0 ? z : z + 0.02;
  const f = n < 0 ? { nz: mat, px: mat, nx: mat } : { pz: mat, px: mat, nx: mat };
  s.faces([a - w, 0, z0], [a, top + w, z1], f);
  s.faces([b, 0, z0], [b + w, top + w, z1], f);
  s.faces([a, top, z0], [b, top + w, z1], n < 0 ? { nz: mat, ny: mat } : { pz: mat, ny: mat });
}
