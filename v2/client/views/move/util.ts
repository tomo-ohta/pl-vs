/**
 * 移動と身体の描画の補助（views.ts の基本の描画と同じ作り: 箱のジオメトリに、置かれた区画の陰影を頂点の明るさで写す）
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { surfaceBox } from '../../render/SurfaceGeometry.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import type { ViewContext } from '../views.ts';

/** 箱のジオメトリ（原点中心）と頂点の明るさ */
export function boxGeo(size: readonly [number, number, number], mat: MatId): THREE.BufferGeometry {
  const g = surfaceBox({ min: [-size[0] / 2, -size[1] / 2, -size[2] / 2], max: [size[0] / 2, size[1] / 2, size[2] / 2], mat, solid: false });
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  return g;
}

/** three の標準のジオメトリに頂点の明るさを足す */
export function withBaked<T extends THREE.BufferGeometry>(g: T): T {
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  return g;
}

/** ジオメトリの頂点の明るさを一色に */
export function setBaked(g: THREE.BufferGeometry, rgb: readonly [number, number, number]): void {
  const attr = g.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
  attr.needsUpdate = true;
}

/** 区画の陰影をその位置で測る */
export function lightAt(ctx: ViewContext, at: [number, number, number]): [number, number, number] {
  const cell = cellAt(ctx.built, at);
  return cell ? sampleCellLight(cell, at, ctx.levelOf) : [0.2, 0.2, 0.2];
}

/** 決まった並びの乱数（見た目だけ） */
export function seeded(seed: number): () => number {
  let k = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => { k = (k * 16807) % 2147483647; return (k - 1) / 2147483646; };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** 近くにいるときだけ音を鳴らす（遠い部屋の仕掛けの音を鳴らさない） */
export function nearCamera(ctx: ViewContext, at: readonly [number, number, number], dist = 22): boolean {
  return !ctx.camera || Math.hypot(ctx.camera.position.x - at[0], ctx.camera.position.y - at[1], ctx.camera.position.z - at[2]) < dist;
}
