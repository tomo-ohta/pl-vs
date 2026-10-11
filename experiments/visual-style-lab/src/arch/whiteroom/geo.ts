import * as THREE from 'three';
import type { Builder, PartOptions } from '../../scenes/Builder.ts';
import { at, type Frame } from './layout.ts';

/**
 * 形の道具（whiteroom）。中庭ごとの「視点の座標」（X = 右、d = 奥、h = 高さ）で箱を置く・断面を押し出す。
 */

/** 場面の座標の箱（角 2 つ） */
export function bx(b: Builder, mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: PartOptions = {}): THREE.Mesh | null {
  if (Math.abs(x1 - x0) < 1e-4 || Math.abs(y1 - y0) < 1e-4 || Math.abs(z1 - z0) < 1e-4) return null;
  return b.boxMM(mat, [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], o);
}

/** 中庭の座標の箱（X0..X1・h0..h1・d0..d1） */
export function fbox(b: Builder, F: Frame, mat: THREE.Material, X0: number, h0: number, d0: number, X1: number, h1: number, d1: number, o: PartOptions = {}): THREE.Mesh | null {
  const p = at(F, X0, d0);
  const q = at(F, X1, d1);
  return bx(b, mat, p[0], h0, p[1], q[0], h1, q[1], o);
}

/**
 * 断面（縦の面の多角形 [横, 高さ]）を厚みの向きへ押し出す。plane = 'zy' なら断面は (z, y) で x0..x1 へ、'xy' なら (x, y) で z0..z1 へ
 */
export function extrudeSection(b: Builder, mat: THREE.Material, plane: 'zy' | 'xy', outline: [number, number][], from: number, to: number, o: PartOptions = {}): THREE.Mesh {
  const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.abs(to - from), bevelEnabled: false, steps: 1 });
  // 断面は (u, v, 0..depth)。plane 'xy': そのまま z へ。'zy': u = z, v = y, 押し出し = x
  if (plane === 'xy') g.translate(0, 0, Math.min(from, to));
  else {
    // (u, v, w) → (x = w, y = v, z = u)
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      const w = pos.getZ(i);
      pos.setXYZ(i, w + Math.min(from, to), v, u);
    }
    // 向きが裏返るので面の順を戻す
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
    } else {
      const n = pos.count;
      for (let i = 0; i < n; i += 3) {
        const x = pos.getX(i + 1);
        const y = pos.getY(i + 1);
        const z = pos.getZ(i + 1);
        pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
        pos.setXYZ(i + 2, x, y, z);
      }
    }
    g.computeVertexNormals();
  }
  return b.mesh(g.index ? g.toNonIndexed() : g, mat, [0, 0, 0], o);
}
