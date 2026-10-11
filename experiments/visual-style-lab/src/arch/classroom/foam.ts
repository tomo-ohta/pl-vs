import * as THREE from 'three';
import { rng } from '../../scenes/Builder.ts';
import type { FacadeSpec } from './layout.ts';
import type { Mats, Zone } from './mats.ts';

/**
 * 2 階の窓の「泡と氷の殻」（classroom-0 の窓台・竪框・壁柱の縁の白い塊と、窓の上から垂れる氷柱）。
 * 決まり（どの窓にも同じ）: 窓台の前の縁に小さな塊の群れ（カリフラワーのような盛り上がり・所々で前へこぼれる）、
 * ガラスの無い枠の縁を上る殻、上の框から垂れる氷柱。西の端ほど多い。
 * 形は小さな多面体（1〜6 cm）をたくさん（InstancedMesh で 1 回で描く）。段落としの材質で日なたは白、陰は水色
 */

export function foamMat(mats: Mats, zone: Zone): THREE.Material {
  return mats.get(zone, '#d3fcfe', { shade: '#8ccbd8', dark: '#4f8fa8', hi: '#f2ffff', noise: [0.5, 2], shadowQuant: false, line: 0.3, key: 'foam' });
}

export class Foam {
  private readonly small: THREE.Matrix4[] = [];
  private readonly big: THREE.Matrix4[] = [];
  private readonly cones: THREE.Matrix4[] = [];
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  /** 北の窓など、窓の壁が逆向きの所: x を mirror - x に写す（undefined なら南の窓のまま） */
  private mirror: number | undefined;

  private add(list: THREE.Matrix4[], p: [number, number, number], s: [number, number, number], rot: [number, number, number]): void {
    this.q.setFromEuler(this.e.set(rot[0], rot[1], rot[2]));
    const x = this.mirror === undefined ? p[0] : this.mirror - p[0];
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, p[1], p[2]), this.q, new THREE.Vector3(...s)));
  }

  /** 1 つの窓（壁柱の間 za〜zb）の泡と氷柱。fl = 床、amount = 0〜1（多さ） */
  bay(fl: number, f: FacadeSpec, za: number, zb: number, amount: number, seed: number, mirror?: number): void {
    this.mirror = mirror;
    const r = rng(seed);
    const sill = fl + f.sill;
    const front = f.ledge - 0.01;
    const piece = (x: number, y: number, z: number, s: number, flat = 0.75): void => {
      const list = s > 0.035 ? this.big : this.small;
      this.add(list, [x, y + s * flat * 0.4, z], [s * (0.8 + r() * 0.5), s * flat * (0.6 + r() * 0.6), s * (0.9 + r() * 0.7)], [r() * 3, r() * 3, r() * 3]);
    };
    // 窓台: ガラスの線（x -0.12〜0）に沿って盛り上がる塊と、部屋の方へ伸びる平たい筋
    let z = za + r() * 0.08;
    while (z < zb - 0.04) {
      const len = 0.1 + r() * 0.5;
      if (r() < 0.35 + amount * 0.55) {
        const n = Math.round(len * (50 + amount * 70));
        for (let i = 0; i < n; i++) {
          const zz = Math.min(zb - 0.02, z + r() * len);
          const t = (zz - z) / len;
          const heap = Math.sin(t * Math.PI) * (0.02 + r() * 0.06) * (0.6 + amount * 0.6);
          const x = -0.13 + Math.pow(r(), 1.4) * 0.16;
          piece(x, sill + r() * heap, zz, 0.008 + Math.pow(r(), 2.2) * 0.04, 0.6);
        }
        // 平たい筋（窓台の上を部屋の方へ）
        const k = Math.round(len * (6 + amount * 10));
        for (let i = 0; i < k; i++) {
          const zz = z + r() * len;
          const l = 0.05 + r() * (front + 0.05);
          for (let x = 0; x < l; x += 0.018) piece(x, sill - 0.004, zz + x * 0.25 + (r() - 0.5) * 0.01, 0.01 + r() * 0.012 * (1 - x / l), 0.25);
        }
        // 前の縁からこぼれて腰の前へ垂れる
        if (r() < 0.6 * amount) {
          const zz = z + r() * len;
          const kk = 3 + Math.floor(r() * 6);
          for (let i = 0; i < kk; i++) piece(front + 0.012, sill - 0.02 - i * 0.022 - r() * 0.01, zz + (r() - 0.5) * 0.04, 0.008 + r() * 0.012, 1.2);
        }
      }
      z += len + 0.04 + r() * 0.3 * (1.2 - amount);
    }
    // 枠の縁を上る殻（区画の両端・竪框の縁）
    const edges = [za + 0.04, zb - 0.04];
    for (const sp of f.split ?? []) edges.push(za + (zb - za) * sp - f.mullW / 2 - 0.01, za + (zb - za) * sp + f.mullW / 2 + 0.01);
    for (const ze of edges) {
      if (r() > 0.35 + amount * 0.55) continue;
      const top = sill + (0.3 + r() * (f.head - f.sill - 0.3)) * (0.5 + amount * 0.5);
      // 細い帯（枠の面に張り付く小さな欠片）。下ほど太い
      for (let y = sill; y < top; y += 0.008 + r() * 0.018) {
        const k = 1 - (y - sill) / (top - sill + 1e-3);
        piece(-0.06 + (r() - 0.5) * 0.03, y, ze + (r() - 0.5) * 0.03 * (0.5 + k), 0.006 + r() * 0.016 * (0.3 + k), 1.3);
      }
    }
    // 上の框から垂れる氷柱（群れ）
    const head = fl + f.head;
    let zi = za + 0.04;
    while (zi < zb - 0.04) {
      if (r() < 0.25 + amount * 0.45) {
        const n = 2 + Math.floor(r() * 6);
        for (let i = 0; i < n; i++) {
          const zz = Math.min(zb - 0.03, zi + r() * 0.25);
          const len = 0.04 + Math.pow(r(), 2.2) * 0.45 * (0.6 + amount * 0.6);
          const rad = 0.006 + r() * 0.016;
          this.add(this.cones, [-0.11 + (r() - 0.5) * 0.05, head - 0.01, zz], [rad, len, rad], [(r() - 0.5) * 0.1, r() * 3, (r() - 0.5) * 0.1]);
          piece(-0.11, head - 0.03, zz, rad * 2.2, 0.5);
        }
      }
      zi += 0.18 + r() * 0.45;
    }
  }

  /** まとめて 3 つの InstancedMesh にする（小さい塊・大きい塊・氷柱） */
  build(mat: THREE.Material): THREE.Object3D {
    const g = new THREE.Group();
    const cone = new THREE.ConeGeometry(1, 1, 6, 1);
    cone.rotateX(Math.PI);
    cone.translate(0, -0.5, 0);
    const parts: [THREE.BufferGeometry, THREE.Matrix4[]][] = [
      [new THREE.IcosahedronGeometry(1, 0), this.small],
      [new THREE.IcosahedronGeometry(1, 1), this.big],
      [cone, this.cones],
    ];
    for (const [geo, list] of parts) {
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = true;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      m.name = 'foam';
      g.add(m);
    }
    return g;
  }
}
