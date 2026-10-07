import * as THREE from 'three';
import type { Colliders } from '../../core/Colliders.ts';
import type { Builder, PartOptions } from '../../scenes/Builder.ts';
import type { V3, WingFrame } from './layout.ts';

/**
 * 壁の座標系（u: 壁に沿って、y: 上、w: 外へ）で形を作る道具。西棟は斜めなので、箱を回してから置く。
 * 当たり判定は軸に沿った箱しか無いので、斜めの物は u に沿って短く切って足す。
 */
export class LocalFrame {
  readonly m = new THREE.Matrix4();
  readonly T: THREE.Vector3;
  readonly N: THREE.Vector3;
  readonly O: THREE.Vector3;
  /** 裏返しの座標系（三角形の向きを直す） */
  readonly flip: boolean;
  /** 軸に沿っている（当たり判定をそのまま足せる） */
  readonly axis: boolean;

  constructor(readonly f: WingFrame) {
    this.T = new THREE.Vector3(f.tangent[0], 0, f.tangent[1]);
    this.N = new THREE.Vector3(f.normal[0], 0, f.normal[1]);
    this.O = new THREE.Vector3(f.origin[0], 0, f.origin[1]);
    this.m.makeBasis(this.T, new THREE.Vector3(0, 1, 0), this.N).setPosition(this.O);
    this.flip = this.m.determinant() < 0;
    this.axis = Math.abs(f.tangent[0]) < 1e-6 || Math.abs(f.tangent[1]) < 1e-6;
  }

  /** 壁の座標 → 場面の座標 */
  w(u: number, y: number, w: number): V3 {
    return [this.O.x + this.T.x * u + this.N.x * w, y, this.O.z + this.T.z * u + this.N.z * w];
  }

  /** 場面の点 → 壁の座標 [u, y, w] */
  local(p: V3): V3 {
    const dx = p[0] - this.O.x;
    const dz = p[2] - this.O.z;
    return [dx * this.T.x + dz * this.T.z, p[1], dx * this.N.x + dz * this.N.z];
  }

  /** 壁の座標で作った形を場面へ（裏返しなら三角形の向きを直す） */
  place(g: THREE.BufferGeometry): THREE.BufferGeometry {
    g.applyMatrix4(this.m);
    if (this.flip) flipWinding(g);
    return g;
  }

  boxGeo(min: V3, max: V3): THREE.BufferGeometry {
    const g = new THREE.BoxGeometry(Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]), Math.abs(max[2] - min[2]));
    g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return this.place(g);
  }

  /** 壁の座標の箱（min・max は [u, y, w]） */
  box(b: Builder, mat: THREE.Material, min: V3, max: V3, o: PartOptions & { collide?: boolean } = {}): THREE.Mesh {
    const { collide, ...rest } = o;
    const mesh = b.mesh(this.boxGeo(min, max), mat, [0, 0, 0], { shadow: false, ...rest });
    if (collide) this.collide(b.ctx.colliders, min, max);
    return mesh;
  }

  /** 当たり判定（斜めなら u に沿って 0.6 m ごとに切る） */
  collide(col: Colliders, min: V3, max: V3): void {
    const u0 = Math.min(min[0], max[0]);
    const u1 = Math.max(min[0], max[0]);
    const y0 = Math.min(min[1], max[1]);
    const y1 = Math.max(min[1], max[1]);
    const w0 = Math.min(min[2], max[2]);
    const w1 = Math.max(min[2], max[2]);
    const n = this.axis ? 1 : Math.max(1, Math.ceil((u1 - u0) / 0.6));
    // 斜めの壁は厚さの方向にも切る（箱の角が通路へ出すぎないように）
    const m = this.axis ? 1 : Math.max(1, Math.ceil((w1 - w0) / 0.6));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const a = u0 + ((u1 - u0) * i) / n;
        const c = u0 + ((u1 - u0) * (i + 1)) / n;
        const p = w0 + ((w1 - w0) * j) / m;
        const q = w0 + ((w1 - w0) * (j + 1)) / m;
        const pts = [this.w(a, 0, p), this.w(c, 0, p), this.w(a, 0, q), this.w(c, 0, q)];
        const xs = pts.map((v) => v[0]);
        const zs = pts.map((v) => v[2]);
        // 斜めの時は少し内へ縮める（となりの片と重なるので隙間はできない）
        const s = this.axis ? 0 : 0.04;
        col.add({ x: Math.min(...xs) + s, y: y0, z: Math.min(...zs) + s }, { x: Math.max(...xs) - s, y: y1, z: Math.max(...zs) - s });
      }
    }
  }

  /** 壁の座標の平らな板（u・y の長方形、w の位置。法線は +w） */
  quad(u0: number, y0: number, u1: number, y1: number, w: number): THREE.BufferGeometry {
    const g = new THREE.PlaneGeometry(u1 - u0, y1 - y0);
    g.translate((u0 + u1) / 2, (y0 + y1) / 2, w);
    return this.place(g);
  }
}

/** 三角形の向きを裏返す（裏返しの座標系に置いたとき） */
export function flipWinding(g: THREE.BufferGeometry): void {
  const idx = g.index;
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
    return;
  }
  for (const key of Object.keys(g.attributes)) {
    const at = g.attributes[key] as THREE.BufferAttribute;
    const n = at.itemSize;
    const arr = at.array as Float32Array;
    for (let i = 0; i < at.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const t = arr[(i + 1) * n + k];
        arr[(i + 1) * n + k] = arr[(i + 2) * n + k];
        arr[(i + 2) * n + k] = t;
      }
    }
    at.needsUpdate = true;
  }
}
