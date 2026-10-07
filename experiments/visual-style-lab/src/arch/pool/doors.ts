import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box } from '../../core/Colliders.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 近づくと開く扉（建築版のプール）。
 * - 自動ドア（auto）: ガラスの引き戸 2 枚が左右へ滑る
 * - 開き戸（swing）: 吊り元を軸に 90° 開く
 * - 鍵（locked）: 閉じたまま（当たり判定がずっと効く）
 * 撮影（参考画像の視点）では update が呼ばれないので閉じたまま写る。
 * 当たり判定は閉じた板の箱。作った直後（update の前）は外してある（歩いて行けるかの確かめは「近づけば開く」として通す）。鍵の扉は最初から効く。
 */

export interface DoorOpts {
  /** 開口の中心（場面の x, z）・床の高さ・幅・高さ */
  at: [number, number];
  y: number;
  width: number;
  height: number;
  /** 'x' = z 一定の壁（扉は x 方向に並ぶ）、'z' = x 一定の壁 */
  wall: 'x' | 'z';
  kind: 'auto' | 'swing' | 'locked';
  /** 開き戸の開く側（+1 = 壁の + 側へ、-1 = - 側へ） */
  swingTo?: 1 | -1;
  glass?: boolean;
}

interface Leaf {
  obj: THREE.Object3D;
  /** 閉じた位置・開いた位置（局所の移動と回転） */
  slide?: THREE.Vector3;
  rotY?: number;
}

export class Door {
  open = 0;
  readonly leaves: Leaf[] = [];
  holder!: THREE.Object3D;
  box: Box | null = null;
  constructor(
    readonly center: THREE.Vector3,
    readonly kind: DoorOpts['kind'],
    readonly radius: number,
  ) {}
  apply(): void {
    const k = this.open * this.open * (3 - 2 * this.open);
    for (const l of this.leaves) {
      if (l.slide) l.obj.position.copy(l.slide).multiplyScalar(k);
      if (l.rotY !== undefined) l.obj.rotation.y = l.rotY * k;
    }
  }
}

export interface DoorMats {
  frame: THREE.Material;
  glass: THREE.Material;
  leaf: THREE.Material;
  handle: THREE.Material;
}

/** 子のメッシュを材質ごとにまとめる（グループの局所の座標で）。onlyMeshes = 直下のメッシュだけ（葉のグループは残す） */
function mergeChildren(g: THREE.Object3D, onlyMeshes = false): void {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const list: THREE.Mesh[] = [];
  if (onlyMeshes) for (const c of g.children) {
    if ((c as THREE.Mesh).isMesh) list.push(c as THREE.Mesh);
  }
  else g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) list.push(c as THREE.Mesh);
  });
  for (const m of list) {
    const arr = byMat.get(m.material as THREE.Material) ?? [];
    arr.push(m);
    byMat.set(m.material as THREE.Material, arr);
  }
  for (const [mat, arr] of byMat) {
    if (arr.length < 2) continue;
    const geos = arr.map((m) => {
      const gg = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()) as THREE.BufferGeometry;
      gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
      return gg;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, mat);
    mm.castShadow = arr[0].castShadow;
    mm.receiveShadow = arr[0].receiveShadow;
    for (const m of arr) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    g.add(mm);
  }
}

export class Doors {
  readonly list: Door[] = [];
  readonly root = new THREE.Group();
  constructor(
    readonly ctx: SceneContext,
    readonly mats: DoorMats,
  ) {
    this.root.name = 'doors';
  }

  add(o: DoorOpts): Door {
    const { mats } = this;
    const alongX = o.wall === 'x';
    const c = new THREE.Vector3(o.at[0], o.y, o.at[1]);
    const d = new Door(c, o.kind, o.kind === 'auto' ? 2.6 : 1.8);
    // 局所: x = 壁に沿う向き、z = 壁の厚さの向き
    const holder = new THREE.Group();
    holder.position.copy(c);
    if (!alongX) holder.rotation.y = Math.PI / 2;
    this.root.add(holder);
    d.holder = holder;
    const W = o.width;
    const H = o.height;
    const T = 0.05;
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    if (o.kind === 'auto') {
      // 2 枚の引き戸（枠 + ガラス）。開くと戸袋（壁の前）へ半分ずつ滑る
      for (const sgn of [-1, 1]) {
        const g = new THREE.Group();
        const inner = new THREE.Group();
        inner.position.set((sgn * W) / 4, 0, 0);
        g.add(inner);
        holder.add(g);
        const lw = W / 2;
        mk(new THREE.BoxGeometry(lw, 0.06, T), mats.frame, 0, H - 0.03, 0, inner);
        mk(new THREE.BoxGeometry(lw, 0.1, T), mats.frame, 0, 0.05, 0, inner);
        mk(new THREE.BoxGeometry(0.05, H, T), mats.frame, (-sgn * lw) / 2 + (sgn * 0.025), H / 2, 0, inner);
        mk(new THREE.BoxGeometry(0.05, H, T), mats.frame, (sgn * lw) / 2 - sgn * 0.025, H / 2, 0, inner);
        const gl = mk(new THREE.BoxGeometry(lw - 0.1, H - 0.16, 0.012), mats.glass, 0, H / 2 + 0.02, 0, inner);
        gl.castShadow = false;
        d.leaves.push({ obj: g, slide: new THREE.Vector3((sgn * W) / 2 - sgn * 0.05, 0, 0) });
      }
      // 上の無目（センサーの箱）
      mk(new THREE.BoxGeometry(W + 0.3, 0.22, 0.24), mats.frame, 0, H + 0.11, 0, holder);
      mk(new THREE.BoxGeometry(0.12, 0.05, 0.03), mats.handle, 0, H + 0.08, 0.13, holder);
    } else {
      // 開き戸（1 枚）。吊り元は開口の左端
      const g = new THREE.Group();
      g.position.set(-W / 2, 0, 0);
      holder.add(g);
      const leafMat = o.glass ? mats.frame : mats.leaf;
      mk(new THREE.BoxGeometry(W - 0.02, H - 0.02, T), leafMat, W / 2, H / 2, 0, g);
      if (o.glass) {
        const gl = mk(new THREE.BoxGeometry(W * 0.6, H * 0.55, T + 0.01), mats.glass, W / 2, H * 0.58, 0, g);
        gl.castShadow = false;
      } else {
        mk(new THREE.BoxGeometry(W * 0.3, 0.32, T + 0.006), mats.glass, W / 2, H * 0.72, 0, g);
      }
      for (const z of [-1, 1]) mk(new THREE.BoxGeometry(0.14, 0.03, 0.03), mats.handle, W - 0.14, 1.0, (z * (T + 0.04)) / 2, g);
      d.leaves.push({ obj: g, rotY: (o.swingTo ?? 1) * (Math.PI / 2) * -1 });
    }
    // 葉ごとに材質ごとの 1 つの形にまとめる（描画の回数を減らす）
    for (const l of d.leaves) mergeChildren(l.obj);
    mergeChildren(holder, true);
    // 当たり判定（閉じた板）
    const half = W / 2;
    const min = alongX ? new THREE.Vector3(c.x - half, o.y, c.z - 0.06) : new THREE.Vector3(c.x - 0.06, o.y, c.z - half);
    const max = alongX ? new THREE.Vector3(c.x + half, o.y + H, c.z + 0.06) : new THREE.Vector3(c.x + 0.06, o.y + H, c.z + half);
    d.box = this.ctx.colliders.add(min, max);
    d.box.enabled = o.kind === 'locked';
    d.box.passable = o.kind !== 'locked';
    this.list.push(d);
    return d;
  }

  /** 遠くの扉は描かない（30 m より先） */
  cull(eye: THREE.Vector3, all: boolean): void {
    for (const d of this.list) {
      const v = all || Math.hypot(eye.x - d.center.x, eye.z - d.center.z) < 30;
      if (d.holder.visible !== v) d.holder.visible = v;
    }
  }

  /** 毎フレーム: 目の位置で開け閉め */
  update(dt: number, eye: THREE.Vector3): void {
    for (const d of this.list) {
      if (d.kind === 'locked') continue;
      const near = Math.hypot(eye.x - d.center.x, eye.z - d.center.z) < d.radius && Math.abs(eye.y - 1.5 - d.center.y) < 2.5;
      const t = near ? 1 : 0;
      if (d.open !== t) {
        d.open = t > d.open ? Math.min(1, d.open + dt * 2.2) : Math.max(0, d.open - dt * 1.5);
        d.apply();
      }
      if (d.box) d.box.enabled = d.open < 0.05 && !near ? true : false;
    }
  }
}
