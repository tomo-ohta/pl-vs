import * as THREE from 'three';
import type { Builder, PartOptions, V3 } from '../Builder.ts';

/** 2 点を結ぶ角材（筋交い・方杖・斜めの屋根） */
export function strut(b: Builder, mat: THREE.Material, p0: V3, p1: V3, w: number, h: number, o: PartOptions & { up?: V3 } = {}): THREE.Mesh {
  const a = new THREE.Vector3(...p0);
  const c = new THREE.Vector3(...p1);
  const dir = c.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const up = new THREE.Vector3(...(o.up ?? [0, 1, 0]));
  if (Math.abs(up.dot(dir)) > 0.99) up.set(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const nup = new THREE.Vector3().crossVectors(side, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(dir, nup, side);
  const g = new THREE.BoxGeometry(len, h, w);
  g.applyMatrix4(m);
  const mid = a.add(c).multiplyScalar(0.5);
  return b.mesh(g, mat, [mid.x, mid.y, mid.z], o);
}

/** 曲がった管（点列を通る） */
export function pipe(b: Builder, mat: THREE.Material, pts: V3[], r: number, o: PartOptions & { seg?: number; radial?: number } = {}): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
  const g = new THREE.TubeGeometry(curve, o.seg ?? Math.max(8, pts.length * 6), r, o.radial ?? 6, false);
  return b.mesh(g, mat, [0, 0, 0], o);
}

/** H 形鋼の柱（縦）。中心 (x, z)、下端 y0〜上端 y1、フランジの向きは rotY */
export function hColumn(b: Builder, mat: THREE.Material, x: number, z: number, y0: number, y1: number, w = 0.3, d = 0.3, o: PartOptions = {}): void {
  const h = y1 - y0;
  const yc = (y0 + y1) / 2;
  const t = Math.min(w, d) * 0.12;
  const ry = o.rotY ?? 0;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const off = (dx: number, dz: number): V3 => [x + dx * c + dz * s, yc, z - dx * s + dz * c];
  // フランジ 2 枚とウェブ
  b.box(mat, off(0, d / 2 - t / 2), [w, h, t], { ...o, rotY: ry });
  b.box(mat, off(0, -d / 2 + t / 2), [w, h, t], { ...o, rotY: ry });
  b.box(mat, off(0, 0), [t, h, d - 2 * t], { ...o, rotY: ry });
}

/** 箱の並び（枕木など）を 1 つの InstancedMesh で */
export function instanced(root: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  root.add(im);
  return im;
}

export function trs(x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
}

/** 草の株（細い三角の葉を放射状に数枚）。原点が根元、高さ 1 */
export function tuftGeometry(blades = 7, seed = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  let s = seed;
  const r = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + r() * 0.8;
    const lean = 0.15 + r() * 0.35;
    const h = 0.6 + r() * 0.4;
    const w = 0.035 + r() * 0.02;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    // 根元の 2 点と先端
    const px = -cz * w;
    const pz = cx * w;
    pos.push(px, 0, pz, -px, 0, -pz, cx * lean, h, cz * lean);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // 法線は上向き寄りに（草は空の光を受ける）
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  return g;
}

/**
 * 柱から梁へ曲がって伸びる方杖（アーチ形の板）。柱の内側の面 x0 から内向き（dir = ±1）へ、
 * 下の縁は放物線（柱で高さ y0 から斜めに立ち上がり、梁で x0 + dir * rx・高さ y0 + ry で水平）、上の縁は yTop の水平。奥行き depth（z）。
 */
export function haunch(b: Builder, mat: THREE.Material, x0: number, dir: number, z: number, y0: number, rx: number, ry: number, yTop: number, depth: number, o: PartOptions = {}): THREE.Mesh {
  const sh = new THREE.Shape();
  sh.moveTo(0, y0);
  // 下の縁: 柱から斜めに立ち上がり、梁で水平になる放物線
  const n = 16;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    sh.lineTo(rx * t, y0 + ry * (1 - (1 - t) * (1 - t)));
  }
  sh.lineTo(rx, yTop);
  sh.lineTo(0, yTop);
  sh.lineTo(0, y0);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  if (dir < 0) g.scale(-1, 1, 1);
  if (dir < 0) {
    // 向きを反転したので面の向きを直す
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const t = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, t);
      }
    } else {
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      const nn = g.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i += 3) {
        for (const at of [p, nn]) {
          const x = at.getX(i + 1), y = at.getY(i + 1), zz = at.getZ(i + 1);
          at.setXYZ(i + 1, at.getX(i + 2), at.getY(i + 2), at.getZ(i + 2));
          at.setXYZ(i + 2, x, y, zz);
        }
      }
    }
    g.computeVertexNormals();
  }
  return b.mesh(g, mat, [x0, 0, z], o);
}
