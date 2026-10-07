import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneContext } from './types.ts';

export type V3 = [number, number, number];

export interface PartOptions {
  /** 当たり判定を付ける（軸に沿った包み箱） */
  collide?: boolean;
  /** 影: true = 落とす・受ける、'cast' / 'receive' / false */
  shadow?: boolean | 'cast' | 'receive';
  /** Y 軸回りの回転（ラジアン） */
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  name?: string;
  /** 1 = 映り込みに出さない物、2 = 映り込みにだけ出す物（画面には出ない） */
  layer?: number;
  /** 動かない物はまとめて描く（既定 true） */
  merge?: boolean;
  parent?: THREE.Object3D;
}

/**
 * 箱・円柱などを置く道具。動かない物は最後に材質ごとに 1 つのメッシュへまとめる（描画の回数を減らす）。
 */
export class Builder {
  readonly root = new THREE.Group();
  private readonly staticParts: THREE.Mesh[] = [];

  constructor(readonly ctx: SceneContext) {}

  private place(mesh: THREE.Mesh, pos: V3, o: PartOptions): THREE.Mesh {
    mesh.position.set(...pos);
    mesh.rotation.set(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0);
    const sh = o.shadow ?? true;
    mesh.castShadow = sh === true || sh === 'cast';
    mesh.receiveShadow = sh === true || sh === 'receive';
    if (o.name) mesh.name = o.name;
    if (o.layer) mesh.layers.set(o.layer);
    (o.parent ?? this.root).add(mesh);
    mesh.updateMatrixWorld(true);
    if (o.collide) this.ctx.colliders.addObject(mesh);
    if ((o.merge ?? true) && !o.parent) this.staticParts.push(mesh);
    return mesh;
  }

  /** 中心と寸法の箱 */
  box(mat: THREE.Material, center: V3, size: V3, o: PartOptions = {}): THREE.Mesh {
    return this.place(new THREE.Mesh(new THREE.BoxGeometry(...size), mat), center, o);
  }

  /** 角の座標で箱 */
  boxMM(mat: THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
    const c: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const s: V3 = [Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]), Math.abs(max[2] - min[2])];
    return this.box(mat, c, s, o);
  }

  /** 円柱（axis の向き） */
  cyl(mat: THREE.Material, center: V3, radius: number, length: number, o: PartOptions & { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number } = {}): THREE.Mesh {
    const g = new THREE.CylinderGeometry(o.radiusTop ?? radius, radius, length, o.segments ?? 16);
    if (o.axis === 'x') g.rotateZ(Math.PI / 2);
    if (o.axis === 'z') g.rotateX(Math.PI / 2);
    return this.place(new THREE.Mesh(g, mat), center, o);
  }

  /** 任意の形 */
  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, o: PartOptions = {}): THREE.Mesh {
    return this.place(new THREE.Mesh(geo, mat), pos, o);
  }

  /** 板（向きは normal 軸） */
  plane(mat: THREE.Material, center: V3, w: number, h: number, normal: 'x' | '-x' | 'y' | '-y' | 'z' | '-z', o: PartOptions = {}): THREE.Mesh {
    const g = new THREE.PlaneGeometry(w, h);
    if (normal === 'x') g.rotateY(Math.PI / 2);
    if (normal === '-x') g.rotateY(-Math.PI / 2);
    if (normal === 'y') g.rotateX(-Math.PI / 2);
    if (normal === '-y') g.rotateX(Math.PI / 2);
    if (normal === '-z') g.rotateY(Math.PI);
    return this.place(new THREE.Mesh(g, mat), center, { shadow: 'receive', ...o });
  }

  /** 影だけを落とす板（画面にも深度にも何も書かない）。光源では作れない形の影を足す（描いた影） */
  shadowCaster(center: V3, size: V3, o: PartOptions = {}): THREE.Mesh {
    Builder.casterMat ??= new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    return this.box(Builder.casterMat, center, size, { ...o, shadow: 'cast', collide: false });
  }
  private static casterMat: THREE.MeshBasicMaterial | undefined;

  /** 動かない物を材質と影の設定ごとにまとめる */
  finalize(): void {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const m of this.staticParts) {
      const key = `${(m.material as THREE.Material).uuid}|${m.castShadow}|${m.receiveShadow}|${m.layers.mask}`;
      let arr = groups.get(key);
      if (!arr) groups.set(key, (arr = []));
      arr.push(m);
    }
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      // 全部のメッシュが同じ形で持つ属性だけ残す（位置・法線・UV と、場面が足した属性）
      const keep = Object.keys(arr[0].geometry.attributes).filter((k) =>
        arr.every((m) => m.geometry.attributes[k]?.itemSize === arr[0].geometry.attributes[k].itemSize),
      );
      const geos = arr.map((m) => {
        m.updateMatrixWorld(true);
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, arr[0].material);
      mm.layers.mask = arr[0].layers.mask; // 映り込みに出さない層（layer 1）もそのまままとめる
      mm.castShadow = arr[0].castShadow;
      mm.receiveShadow = arr[0].receiveShadow;
      for (const m of arr) {
        m.removeFromParent();
        m.geometry.dispose();
      }
      for (const g of geos) g.dispose();
      this.root.add(mm);
    }
    this.staticParts.length = 0;
  }
}

/** 決まった乱数（場面の配置用） */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
