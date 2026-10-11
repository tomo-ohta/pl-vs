import * as THREE from 'three';
import type { Colliders } from '../core/Colliders.ts';
import type { Lamp } from './Lamps.ts';

/**
 * リアルな照明で、照明器具（光る面）を灯りにする。
 * 場面の灯り（ctx.addLamp）は塗りの光だまり用に置いた所にしか無いので、リアルな照明を入れたときだけ、
 * 照明を使わない明るい面（天井の蛍光灯・パネル・ランプ）を 1 つずつ見つけて、その下に灯り（realOnly）を置く。
 * 材質ごとにまとめた形（Builder）も、つながった三角形の塊に分けて 1 つずつにする。
 * 照らす箱は、灯りから 4 方向へ当たり判定の壁まで（壁の向こうの部屋へ漏れない）。
 */
const MAX_VERTS = 400_000;

function emitterColor(mat: THREE.Material): THREE.Color | null {
  const m = mat as THREE.MeshStandardMaterial & { defines?: Record<string, unknown> };
  if (m.defines?.SL_UNLIT && m.color) {
    const c = m.color;
    if (Math.min(c.r, c.g, c.b) > 0.55) return c.clone();
    return null;
  }
  if ((m as unknown as THREE.MeshBasicMaterial).isMeshBasicMaterial && m.color) {
    const c = m.color;
    if (Math.min(c.r, c.g, c.b) > 0.6) return c.clone();
    return null;
  }
  if (m.emissive) {
    const e = m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 1);
    if (e.r * 0.2126 + e.g * 0.7152 + e.b * 0.0722 > 0.45) return e;
  }
  return null;
}

/** つながった三角形の塊ごとの外接箱（形の局所の座標） */
function components(geo: THREE.BufferGeometry): THREE.Box3[] {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count > MAX_VERTS) return [];
  const n = pos.count;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  // 同じ位置の頂点（面ごとに分けた頂点）をつなぐ
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 200)},${Math.round(pos.getY(i) * 200)},${Math.round(pos.getZ(i) * 200)}`;
    const j = seen.get(k);
    if (j === undefined) seen.set(k, i);
    else union(i, j);
  }
  const idx = geo.getIndex();
  const tri = idx ? idx.count / 3 : n / 3;
  for (let t = 0; t < tri; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    union(a, b);
    union(b, c);
  }
  const boxes = new Map<number, THREE.Box3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let b = boxes.get(r);
    if (!b) boxes.set(r, (b = new THREE.Box3()));
    b.expandByPoint(v.fromBufferAttribute(pos, i));
  }
  return [...boxes.values()];
}

/** 照明器具の灯り（realOnly）。既にある灯り（near）の近くの器具は除く */
export function fixtureLamps(scene: THREE.Scene, colliders: Colliders, near: Lamp[], maxCount = 600): Lamp[] {
  scene.updateMatrixWorld(true);
  const found: { c: THREE.Vector3; s: THREE.Vector3; col: THREE.Color }[] = [];
  const mtx = new THREE.Matrix4();
  const inst = new THREE.Matrix4();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || o.name === 'sky' || found.length > maxCount * 4) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat) return;
    const col = emitterColor(mat);
    if (!col) return;
    const comps = components(m.geometry);
    const im = (m as unknown as THREE.InstancedMesh).isInstancedMesh ? (m as unknown as THREE.InstancedMesh) : null;
    const count = im ? im.count : 1;
    for (let k = 0; k < count; k++) {
      mtx.copy(m.matrixWorld);
      if (im) mtx.multiply((im.getMatrixAt(k, inst), inst));
      for (const b of comps) {
        const wb = b.clone().applyMatrix4(mtx);
        const s = wb.getSize(new THREE.Vector3());
        const big = Math.max(s.x, s.y, s.z);
        // 小さすぎる点（光る粒・文字）と大きすぎる面（空・窓の外・遠景）は器具ではない
        if (big < 0.12 || big > 3.2) continue;
        found.push({ c: wb.getCenter(new THREE.Vector3()), s, col });
      }
    }
  });
  // 近い器具（蛍光灯の 2 本の管など）は 1 つにまとめる
  const merged: { c: THREE.Vector3; s: THREE.Vector3; col: THREE.Color; n: number }[] = [];
  for (const f of found) {
    const m = merged.find((g) => g.c.distanceTo(f.c) < 0.7);
    if (m) {
      m.c.multiplyScalar(m.n).add(f.c).divideScalar(m.n + 1);
      m.s.max(f.s);
      m.n++;
    } else merged.push({ c: f.c.clone(), s: f.s.clone(), col: f.col, n: 1 });
  }
  const out: Lamp[] = [];
  for (const f of merged) {
    if (out.length >= maxCount) break;
    if (near.some((l) => Math.hypot(l.pos[0] - f.c.x, l.pos[1] - f.c.y, l.pos[2] - f.c.z) < 1.5)) continue;
    const span = Math.max(f.s.x, f.s.z);
    // 平たい横向きの器具（天井灯）は下向き
    const down = f.s.y < 0.35 * span;
    const radius = THREE.MathUtils.clamp(2.4 + span * 0.9, 2.4, 6);
    const reach = radius * 1.7;
    const x = f.c.x;
    const z = f.c.z;
    const y = f.c.y - (down ? 0.15 : 0);
    // 照らす箱: 4 方向の壁まで（器具の少し下の高さで調べる）
    const ry = f.c.y - 0.35;
    const dW = colliders.rayXZ(x, z, ry, -1, 0, reach);
    const dE = colliders.rayXZ(x, z, ry, 1, 0, reach);
    const dN = colliders.rayXZ(x, z, ry, 0, -1, reach);
    const dS = colliders.rayXZ(x, z, ry, 0, 1, reach);
    const g = colliders.groundBelow(x, z, 0.1, f.c.y - 0.2).y;
    const floor = Number.isFinite(g) ? Math.max(g - 0.05, f.c.y - reach) : f.c.y - reach;
    const c = f.col.clone();
    const mx = Math.max(c.r, c.g, c.b, 1e-4);
    c.multiplyScalar(1 / mx);
    out.push({
      pos: [x, y, z],
      radius,
      intensity: 0.22 + 0.22 * THREE.MathUtils.clamp(span / 1.2, 0, 1),
      color: c,
      box: [x - dW, floor, z - dN, x + dE, f.c.y + 0.4, z + dS],
      down,
      shadow: 0.4,
      realOnly: true,
    });
  }
  return out;
}
