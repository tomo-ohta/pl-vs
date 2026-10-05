/**
 * 見本の部屋の展示物（粒・同じ形のメッシュ）に v2 の焼き込み照明を当てる共通の部品。
 * v2 の FloorBuilder と同じ SurfaceLighting（器具の配光・遮蔽・接触の陰・反射光の広がり）を、点の集まりに 0.4 m の升目ごとに当てる。
 */
import * as THREE from 'three';
import { SURFACES } from '../../../../v2/client/render/MaterialLibrary.ts';
import { SurfaceLighting } from '../../../../v2/client/render/SurfaceGeometry.ts';
import type { LitLayout } from '../../../../v2/client/render/litLayout.ts';
import { box, type Box, type CellLayout, type LightSpec } from '../../../../v2/core/world/layout.ts';

/** 焼き込みの升目（m）。v2 の小物の箱と同じ速い焼き方（遮蔽は升目の中心で 1 回）になる大きさ */
const BAKE_CELL = 0.4;

/** 作業を区切る（MessageChannel のタスク。rAF は裏のタブで止まるので使わない） */
const channel = new MessageChannel();
const waiting: (() => void)[] = [];
channel.port1.onmessage = () => waiting.shift()?.();
export const nextTask = (): Promise<void> => new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });

/**
 * 展示物用の焼き込み照明: v2 の FloorBuilder と同じ範囲・器具（隣の区画の器具も光源として借りる）。
 * 遮蔽体は部屋の描く箱から v2 の箱（cmp:）・深さの代役（proxy:）を除いた物
 */
export function exhibitLighting(cell: CellLayout, neighbors: CellLayout[]): SurfaceLighting {
  const SKIP = new Set(['colliderOnly', 'emitOnly']);
  const drawn = cell.boxes.filter((b) => !SKIP.has(b.kind ?? '') && !b.revealGroup && !b.slope && b.max[0] - b.min[0] > 1e-4 && b.max[1] - b.min[1] > 1e-4 && b.max[2] - b.min[2] > 1e-4);
  const borrowed: Box[] = [];
  const lights: LightSpec[] = [...cell.lights];
  for (const n of neighbors) {
    for (const b of n.boxes) if (SURFACES[b.mat]?.emission && !b.revealGroup && b.max[1] - b.min[1] < 0.1) borrowed.push({ ...b, solid: false });
    lights.push(...n.lights);
  }
  const fy = cell.floorY;
  const layout: LitLayout = {
    bounds: { min: [cell.bounds.min[0], Math.max(cell.bounds.min[1], fy - 0.2), cell.bounds.min[2]], max: cell.bounds.max },
    footprint: cell.footprint, height: cell.height, boxes: [...drawn, ...borrowed], lights, palette: cell.palette,
    ...(cell.lighting ? { lighting: cell.lighting } : {}),
  };
  return new SurfaceLighting(layout);
}

/** 点 from..to（位置・法線は 3 個ずつ）を 0.4 m の升目ごとに焼く（out に焼き込み光 RGB） */
export async function bakePoints(L: SurfaceLighting, center: Float32Array, normal: Float32Array, from: number, to: number, out: Float32Array): Promise<void> {
  const groups = new Map<number, number[]>();
  for (let i = from; i < to; i++) {
    const kx = Math.floor(center[i * 3]! / BAKE_CELL), ky = Math.floor(center[i * 3 + 1]! / BAKE_CELL), kz = Math.floor(center[i * 3 + 2]! / BAKE_CELL);
    const key = ((kx + 512) * 1024 + (ky + 512)) * 1024 + (kz + 512);
    let g = groups.get(key);
    if (!g) groups.set(key, g = []);
    g.push(i);
  }
  let t = performance.now();
  for (const idx of groups.values()) {
    const n = idx.length;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < n; k++) {
      const i = idx[k]!;
      for (let c = 0; c < 3; c++) {
        const v = center[i * 3 + c]!;
        pos[k * 3 + c] = v;
        nor[k * 3 + c] = normal[i * 3 + c]!;
        if (v < min[c]!) min[c] = v;
        if (v > max[c]!) max[c] = v;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    L.bake(g, box(min, max, 'untextured', false));
    const baked = g.getAttribute('bakedLight').array as Float32Array;
    for (let k = 0; k < n; k++) { const i = idx[k]!; out[i * 3] = baked[k * 3]!; out[i * 3 + 1] = baked[k * 3 + 1]!; out[i * 3 + 2] = baked[k * 3 + 2]!; }
    if (performance.now() - t > 12) { await nextTask(); t = performance.now(); }
  }
}
