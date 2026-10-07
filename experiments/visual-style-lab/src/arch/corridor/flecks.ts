import type * as THREE from 'three';
import type { Leg } from './leg.ts';

/**
 * 壁の短い傷（材質の flecks と同じ並び）を、区域の座標で板として作る。
 * 材質の flecks は場面の座標の面の向き（x / z）で模様が決まるので、区域を回すと模様が鏡写しになる。
 * 元の版の区域の座標（この区域の z と高さ y）で同じ hash を計算して、同じ所に傷を置く。
 */

function fract(x: number): number {
  return x - Math.floor(x);
}

/** sl_hash33（glsl.ts と同じ） */
function hash33(px: number, py: number, pz: number): [number, number, number] {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.103);
  let z = fract(pz * 0.0973);
  const d = x * (y + 33.33) + y * (x + 33.33) + z * (z + 33.33);
  x += d;
  y += d;
  z += d;
  return [fract((x + y) * z), fract((x + x) * y), fract((y + x) * x)];
}

export interface FleckOpts {
  scale: number;
  density: number;
  length: number;
  width: number;
  /** 元の版の面の向きの hash の 3 つ目（floor(dot(n, (1,2,3)) * 7)。-x を向く面なら -7） */
  face: number;
}

/**
 * x = wx の面（n = -1 なら -x を向く）の z0〜z1・y0〜y1 に傷を貼る。skip の z 範囲は飛ばす（扉の所）。
 * 傷の板は面から 0.002 手前
 */
export function wallFlecksHash(s: Leg, mat: THREE.Material, wx: number, n: 1 | -1, z0: number, z1: number, y0: number, y1: number, o: FleckOpts, skip: [number, number][] = []): void {
  const sc = o.scale;
  const x = wx + n * 0.002;
  for (let cy = Math.floor(y0 * sc); cy < Math.ceil(y1 * sc); cy++)
    for (let cx = Math.floor(z0 * sc); cx < Math.ceil(z1 * sc); cx++) {
      const h = hash33(cx, cy, o.face);
      if (h[2] >= o.density) continue;
      // セルの中の中心と大きさ（セルの外は切る）
      const ccx = cx + 0.5 + (h[0] - 0.5) * 0.6;
      const ccy = cy + 0.5 + (h[1] - 0.5) * 0.6;
      const len = o.length * (0.4 + h[2]);
      const ua = Math.max(cx, ccx - o.width);
      const ub = Math.min(cx + 1, ccx + o.width);
      const va = Math.max(cy, ccy - len / 2);
      const vb = Math.min(cy + 1, ccy + len / 2);
      const za = ua / sc;
      const zb = ub / sc;
      const ya = Math.max(y0, va / sc);
      const yb = Math.min(y1, vb / sc);
      if (zb <= z0 || za >= z1 || yb <= ya) continue;
      if (skip.some(([a, b]) => zb > a && za < b)) continue;
      if (n < 0) s.quad(mat, [x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za]);
      else s.quad(mat, [x, ya, zb], [x, ya, za], [x, yb, za], [x, yb, zb]);
    }
}
