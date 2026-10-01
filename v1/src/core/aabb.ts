import type { Placement, Vec3 } from './types';
import { toWorld } from './types';

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export function aabb(min: Vec3, max: Vec3): AABB {
  return { min: [...min] as Vec3, max: [...max] as Vec3 };
}

export function aabbFromCenter(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): AABB {
  return { min: [cx - hx, cy - hy, cz - hz], max: [cx + hx, cy + hy, cz + hz] };
}

export function aabbOverlap(a: AABB, b: AABB, eps = 0.05): boolean {
  return (
    a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps &&
    a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps &&
    a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps
  );
}

export function aabbContains(a: AABB, p: Vec3, eps = 0): boolean {
  return (
    p[0] >= a.min[0] - eps && p[0] <= a.max[0] + eps &&
    p[1] >= a.min[1] - eps && p[1] <= a.max[1] + eps &&
    p[2] >= a.min[2] - eps && p[2] <= a.max[2] + eps
  );
}

/** ローカル AABB を配置（1/4 回転 + 平行移動）してワールド AABB にする */
export function aabbToWorld(local: AABB, p: Placement): AABB {
  const corners: Vec3[] = [
    [local.min[0], local.min[1], local.min[2]],
    [local.max[0], local.min[1], local.min[2]],
    [local.min[0], local.min[1], local.max[2]],
    [local.max[0], local.min[1], local.max[2]],
  ];
  const min: Vec3 = [Infinity, local.min[1] + p.position[1], Infinity];
  const max: Vec3 = [-Infinity, local.max[1] + p.position[1], -Infinity];
  for (const c of corners) {
    const w = toWorld(p, c);
    min[0] = Math.min(min[0], w[0]);
    min[2] = Math.min(min[2], w[2]);
    max[0] = Math.max(max[0], w[0]);
    max[2] = Math.max(max[2], w[2]);
  }
  return { min, max };
}

export function aabbExpand(a: AABB, d: number): AABB {
  return { min: [a.min[0] - d, a.min[1] - d, a.min[2] - d], max: [a.max[0] + d, a.max[1] + d, a.max[2] + d] };
}

export function aabbCenter(a: AABB): Vec3 {
  return [(a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2, (a.min[2] + a.max[2]) / 2];
}
