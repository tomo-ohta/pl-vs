/** 座標の型と向き。単位は m、y が上。向き Dir は 0:+Z 1:+X 2:-Z 3:-X（v1 と同じ） */

export type Vec3 = [number, number, number];
export type Dir = 0 | 1 | 2 | 3;

export function dirVec(d: Dir): Vec3 {
  switch (d) {
    case 0: return [0, 0, 1];
    case 1: return [1, 0, 0];
    case 2: return [0, 0, -1];
    case 3: return [-1, 0, 0];
  }
}

export function addDir(a: Dir, b: number): Dir {
  return ((((a + b) % 4) + 4) % 4) as Dir;
}

export function oppositeDir(d: Dir): Dir {
  return addDir(d, 2);
}

/** ベクトルを 1/4 回転 q 回だけ回す（three.js の rotation.y = q·π/2 と一致） */
export function rotQ(v: Vec3, q: Dir): Vec3 {
  let [x, y, z] = v;
  for (let i = 0; i < q; i++) {
    const nx = z;
    const nz = -x;
    x = nx;
    z = nz;
  }
  return [x, y, z];
}

/** 部品の配置（位置 + 1/4 回転）。フロアの生成で、部屋の型を置くときに使う */
export interface Placement {
  position: Vec3;
  yawQ: Dir;
}

export function toWorld(p: Placement, local: Vec3): Vec3 {
  const r = rotQ(local, p.yawQ);
  return [r[0] + p.position[0], r[1] + p.position[1], r[2] + p.position[2]];
}

export function toLocal(p: Placement, world: Vec3): Vec3 {
  const d: Vec3 = [world[0] - p.position[0], world[1] - p.position[1], world[2] - p.position[2]];
  return rotQ(d, ((4 - p.yawQ) % 4) as Dir);
}

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const distXZ = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);
export function norm3(a: Vec3): Vec3 {
  const l = len3(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

/** 視線の向き（yaw / pitch。three.js のカメラと同じく yaw 0 で -Z を向く） */
export function lookDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** v を target へ最大 step だけ近づける */
export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
