import type * as THREE from 'three';
import { createPaint, type PaintOptions } from '../../render/PaintMaterial.ts';

/**
 * 塗りの材質（PaintMaterial）を同じ指定なら使い回す。同じ材質の物は Builder.finalize でまとめて描けるので、
 * 自転車・机・扉のような同じ物が多い所で描く回数が減る。絵（テクスチャ）を持つ指定は使い回さない。
 */
const cache = new Map<string, THREE.ShaderMaterial>();

export function paint(o: PaintOptions): THREE.ShaderMaterial {
  if (o.map || o.cov) return createPaint(o);
  const key = JSON.stringify(o);
  let m = cache.get(key);
  if (!m) cache.set(key, (m = createPaint(o)));
  return m;
}

/** 場面を作り直すとき（読み込みのたび）に使い回しを捨てる */
export function resetPaintCache(): void {
  cache.clear();
}
