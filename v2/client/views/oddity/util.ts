/**
 * 部屋まるごとの異変の描画（client/views/oddity）の補助: 箱のジオメトリ・焼き込みの明るさ・雲の柄・カメラが部屋にいるか。
 */
import * as THREE from 'three';
import type { AABB } from '../../../core/math/aabb.ts';
import type { Box, Json, MatId } from '../../../core/world/layout.ts';
import { surfaceBox } from '../../render/SurfaceGeometry.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import type { ViewContext } from '../views.ts';

export function aabbOf(v: Json | undefined): AABB {
  const o = v as { min: number[]; max: number[] };
  return { min: [o.min[0]!, o.min[1]!, o.min[2]!], max: [o.max[0]!, o.max[1]!, o.max[2]!] };
}

export const num = (v: Json | undefined, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const str = (v: Json | undefined, d: string): string => (typeof v === 'string' ? v : d);

/** 箱のジオメトリ（フロア座標のまま。原点は箱の中心）と、頂点の明るさの属性 */
export function boxGeo(b: Box): THREE.BufferGeometry {
  const g = surfaceBox({ ...b, min: [-(b.max[0] - b.min[0]) / 2, -(b.max[1] - b.min[1]) / 2, -(b.max[2] - b.min[2]) / 2], max: [(b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2, (b.max[2] - b.min[2]) / 2] });
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  return g;
}

/** ジオメトリの頂点の明るさを一色に */
export function setBaked(g: THREE.BufferGeometry, rgb: [number, number, number]): void {
  const attr = g.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
  attr.needsUpdate = true;
}

/** 区画の焼き込みの、点 at での明るさ */
export function lightAt(ctx: ViewContext, at: [number, number, number]): [number, number, number] {
  const cell = cellAt(ctx.built, at);
  return cell ? sampleCellLight(cell, at, ctx.levelOf) : [0.2, 0.2, 0.2];
}

/** 箱の組を、材質ごとに 1 つのメッシュにまとめた入れ物（組の中心 center が原点。回す物に使う） */
export function boxesGroup(ctx: ViewContext, boxes: readonly Box[], center: [number, number, number]): { group: THREE.Group; geos: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const light = lightAt(ctx, center);
  for (const b of boxes) {
    const g = boxGeo(b);
    setBaked(g, light);
    geos.push(g);
    const m = new THREE.Mesh(g, ctx.materials.get(b.mat as MatId));
    m.position.set((b.min[0] + b.max[0]) / 2 - center[0], (b.min[1] + b.max[1]) / 2 - center[1], (b.min[2] + b.max[2]) / 2 - center[2]);
    group.add(m);
  }
  group.position.set(...center);
  return { group, geos };
}

/** カメラ（目）の位置。無ければ null（テスト） */
export function eyeOf(ctx: ViewContext): THREE.Vector3 | null {
  return ctx.camera ? ctx.camera.position : null;
}

export function inside(a: AABB, p: THREE.Vector3 | null, margin = 0): boolean {
  return !!p && p.x >= a.min[0] - margin && p.x <= a.max[0] + margin && p.y >= a.min[1] - margin && p.y <= a.max[1] + margin && p.z >= a.min[2] - margin && p.z <= a.max[2] + margin;
}

/** 決まった種の擬似乱数（描画の揺らぎ用。シミュレーションには使わない） */
export function prng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let NOISE: THREE.DataTexture | null = null;

/** 雲の柄（繰り返せる値ノイズ 64 × 64。白 + 透明度）。煙・霧・砂の流れに使う。DOM が無くても作れる */
export function cloudTexture(): THREE.DataTexture {
  if (NOISE) return NOISE;
  const N = 64;
  const rnd = prng(77);
  const grid = (n: number): number[] => Array.from({ length: n * n }, () => rnd());
  const layers = [grid(4), grid(8), grid(16)];
  const val = (g: number[], n: number, x: number, y: number): number => {
    const fx = (x / N) * n, fy = (y / N) * n;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const at = (i: number, k: number): number => g[((k % n) + n) % n * n + (((i % n) + n) % n)]!;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = val(layers[0]!, 4, x, y) * 0.55 + val(layers[1]!, 8, x, y) * 0.3 + val(layers[2]!, 16, x, y) * 0.15;
    const i = (y * N + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(Math.max(0, Math.min(1, (v - 0.25) * 1.6)) * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  NOISE = t;
  return t;
}

/** 照明に依らない半透明の材質（粒・煙・光の筋） */
export function glowMaterial(color: number, opacity: number, o: { map?: THREE.Texture; additive?: boolean; side?: THREE.Side; fog?: boolean } = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, fog: o.fog ?? true, side: o.side ?? THREE.DoubleSide,
    ...(o.map ? { map: o.map } : {}), ...(o.additive ? { blending: THREE.AdditiveBlending } : {}),
  });
}
