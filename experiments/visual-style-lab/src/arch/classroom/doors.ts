import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box } from '../../core/Colliders.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 歩いて近づくと開く扉（校舎の間の通路 alley/doors.ts を写した。教室の引き戸・外の開き戸・防火戸）。
 * - 開き戸: 吊り元の軸で回る。引き戸: 横へ滑る
 * - 鍵の掛かった扉は開かない（当たり判定はずっと有効）
 * 撮影（参考画像の視点・道順）では update が呼ばれないので閉じたまま写る。
 * 開く扉の当たり判定は作った直後は外してある（「近づけば開く」として、歩いて行けるかの確かめを通す）。
 */

export interface DoorDef {
  /** 扉の板の形（軸の位置が原点の局所の座標で作る） */
  leaf: THREE.Object3D;
  /** 軸の位置（場面の座標）と、閉じた時の向き（Y 回り） */
  pivot: [number, number, number];
  yaw: number;
  /** 開き戸の開く角度（ラジアン）か、引き戸の滑る量（局所の x 方向・m） */
  swing?: number;
  slide?: number;
  locked?: boolean;
  /** 近づくと開く距離 */
  radius?: number;
}

interface Door {
  d: DoorDef;
  obj: THREE.Group;
  open: number;
  center: THREE.Vector3;
  box: Box | null;
}

export class Doors {
  readonly root = new THREE.Group();
  private readonly list: Door[] = [];
  constructor(private readonly ctx: SceneContext) {
    this.root.name = 'doors';
  }

  add(d: DoorDef): void {
    mergeLeaf(d.leaf);
    const g = new THREE.Group();
    g.position.set(...d.pivot);
    g.rotation.y = d.yaw;
    g.add(d.leaf);
    this.root.add(g);
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const center = bb.getCenter(new THREE.Vector3());
    let box: Box | null = null;
    if (!bb.isEmpty()) {
      box = this.ctx.colliders.add(bb.min, bb.max);
      box.enabled = !!d.locked;
      box.passable = !d.locked;
    }
    this.list.push({ d, obj: g, open: 0, center, box });
  }

  update(dt: number, eye: THREE.Vector3): void {
    for (const x of this.list) {
      if (x.d.locked) continue;
      const near = Math.hypot(eye.x - x.center.x, eye.z - x.center.z) < (x.d.radius ?? 1.9) && Math.abs(eye.y - 1.5 - x.center.y + 1.0) < 2.4;
      const t = near ? 1 : 0;
      if (x.open !== t) {
        x.open = t > x.open ? Math.min(1, x.open + dt * 2.2) : Math.max(0, x.open - dt * 1.5);
        const k = x.open * x.open * (3 - 2 * x.open);
        const leaf = x.d.leaf;
        if (x.d.swing !== undefined) leaf.rotation.y = x.d.swing * k;
        if (x.d.slide !== undefined) leaf.position.x = x.d.slide * k;
      }
      // 閉じている間だけ当たり判定（近づくと先に開くので、ふつうは当たらない）
      if (x.box) x.box.enabled = x.open < 0.05 && !near;
    }
  }
}

/**
 * 扉の板の中の形を材質ごとに 1 つにまとめる（描く回数を減らす。板は扉の Group の中で動くので、板の局所の座標のまま）
 */
export function mergeLeaf(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; layers: number; cast: boolean; recv: boolean }>();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes.push(m);
  });
  for (const m of meshes) {
    const mat = m.material as THREE.Material;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    let e = groups.get(mat);
    if (!e) groups.set(mat, (e = { geos: [], layers: m.layers.mask, cast: m.castShadow, recv: m.receiveShadow }));
    e.geos.push(g);
    m.removeFromParent();
  }
  for (const [mat, e] of groups) {
    const merged = mergeGeometries(e.geos, false);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, mat);
    mm.layers.mask = e.layers;
    mm.castShadow = e.cast;
    mm.receiveShadow = e.recv;
    root.add(mm);
  }
}
