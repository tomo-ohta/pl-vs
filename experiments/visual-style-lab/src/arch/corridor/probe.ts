import * as THREE from 'three';
import type { ViewDef } from '../../scenes/types.ts';

/**
 * 作った形を調べる道具（写っていない所の作り込みを「決まり」で置くため）。
 * - 面の種類の登録: 壁・天井・床の材質（その上に物を貼ってよい面）と、調べるときに無視する薄い貼り物
 * - Probe: 作った形（Builder の中のメッシュ）へ光線を飛ばして、物を貼れる平らな面と、その前が空いているかを調べる
 * - RefVis: 参考画像の視点（4 つ）から見えるかを調べる。見える所には何も足さない（参考画像の見た目を変えない）
 */

const MOUNT = new WeakSet<THREE.Material>();
const SKIP = new WeakSet<THREE.Material>();

/** 物を貼ってよい面（壁・天井・床）の材質 */
export function mountable(...ms: (THREE.Material | null | undefined)[]): void {
  for (const m of ms) if (m) MOUNT.add(m);
}

/** 調べるときに無い物とする薄い貼り物（壁の傷の板など） */
export function skippable(...ms: (THREE.Material | null | undefined)[]): void {
  for (const m of ms) if (m) SKIP.add(m);
}

export type SurfKind = 'mount' | 'skip' | 'solid';

export function surfKind(m: THREE.Material | THREE.Material[]): SurfKind {
  const mm = Array.isArray(m) ? m[0] : m;
  // 貼り絵（描いた影・帯・紙くず）は面の上の薄い物
  if (mm instanceof THREE.ShaderMaterial) return 'skip';
  if (SKIP.has(mm)) return 'skip';
  if (MOUNT.has(mm)) return 'mount';
  return 'solid';
}

export interface Hit {
  dist: number;
  kind: SurfKind;
  /** 面の向き（場面の座標） */
  normal: THREE.Vector3;
  point: THREE.Vector3;
  mat: THREE.Material;
}

const _box = new THREE.Box3();

/** メッシュの場面の座標の包み箱（作り直さないように覚える） */
const BOXES = new WeakMap<THREE.Object3D, THREE.Box3>();
function boxOf(m: THREE.Mesh): THREE.Box3 {
  let b = BOXES.get(m);
  if (!b) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
    BOXES.set(m, b);
  }
  return b;
}

function meshesOf(roots: THREE.Object3D[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const r of roots)
    r.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.visible !== false) out.push(o as THREE.Mesh);
    });
  return out;
}

/**
 * 作った形への光線。調べる範囲（箱）を先に決めて、その箱に掛かるメッシュだけを相手にする（速くするため）。
 * 後から足した物も相手にしたいときは refresh() で集め直す
 */
export class Probe {
  private readonly rc = new THREE.Raycaster();
  private list: THREE.Mesh[] = [];
  private readonly area = new THREE.Box3();
  constructor(private readonly roots: THREE.Object3D[]) {}

  /** 調べる範囲を決めて、掛かるメッシュを集める */
  focus(area: THREE.Box3): this {
    this.area.copy(area);
    this.refresh();
    return this;
  }

  refresh(): void {
    this.list = meshesOf(this.roots).filter((m) => boxOf(m).intersectsBox(this.area));
  }

  /** 原点から向きへ、最初に当たる「無視しない」面 */
  cast(o: THREE.Vector3, d: THREE.Vector3, far: number): Hit | null {
    this.rc.set(o, d);
    this.rc.near = 0;
    this.rc.far = far;
    const ray = this.rc.ray;
    const cand = this.list.filter((m) => ray.intersectsBox(boxOf(m)));
    if (!cand.length) return null;
    const hits = this.rc.intersectObjects(cand, false);
    for (const h of hits) {
      const kind = surfKind((h.object as THREE.Mesh).material);
      if (kind === 'skip') continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3();
      const mm = (h.object as THREE.Mesh).material;
      return { dist: h.distance, kind, normal: n, point: h.point.clone(), mat: Array.isArray(mm) ? mm[0] : mm };
    }
    return null;
  }
}

/**
 * 参考画像の視点から見えるか。視点の画角（少し広め）に入り、目からその点までの間に何も無ければ「見える」。
 * 遮る物は廊下の形と閉じた扉（撮影では扉は閉じている）
 */
export class RefVis {
  private readonly cams: THREE.PerspectiveCamera[] = [];
  private readonly meshes: THREE.Mesh[];
  private readonly rc = new THREE.Raycaster();
  private readonly v = new THREE.Vector3();
  private readonly seg = new THREE.Box3();
  constructor(views: ViewDef[], occluders: THREE.Object3D[], aspect = 1456 / 816) {
    for (const vd of views) {
      const c = new THREE.PerspectiveCamera(vd.fov ?? 60, aspect, 0.05, 300);
      c.position.set(...vd.eye);
      c.rotation.set(vd.pitch ?? 0, vd.yaw, vd.roll ?? 0, 'YXZ');
      c.updateMatrixWorld(true);
      this.cams.push(c);
    }
    this.meshes = meshesOf(occluders);
  }

  /** 点のどれかが、どれかの視点から見えるなら true */
  anyVisible(pts: THREE.Vector3[]): boolean {
    for (const c of this.cams) for (const p of pts) if (this.seen(c, p)) return true;
    return false;
  }

  private seen(c: THREE.PerspectiveCamera, p: THREE.Vector3): boolean {
    const v = this.v.copy(p).applyMatrix4(c.matrixWorldInverse);
    if (v.z > -0.05) return false;
    v.copy(p).project(c);
    if (Math.abs(v.x) > 1.06 || Math.abs(v.y) > 1.06) return false;
    // 目からその点までの間に遮る面があるか
    const eye = c.position;
    const d = this.v.copy(p).sub(eye);
    const len = d.length();
    d.divideScalar(len);
    this.rc.set(eye, d);
    this.rc.near = 0;
    this.rc.far = len - 0.015;
    this.seg.makeEmpty().expandByPoint(eye).expandByPoint(p);
    const ray = this.rc.ray;
    const cand = this.meshes.filter((m) => {
      const b = boxOf(m);
      return b.intersectsBox(this.seg) && ray.intersectsBox(b);
    });
    if (!cand.length) return true;
    const hits = this.rc.intersectObjects(cand, false);
    for (const h of hits) if (surfKind((h.object as THREE.Mesh).material) !== 'skip') return false;
    return true;
  }
}

/** 区域の 2 点から場面の箱（調べる範囲） */
export function areaBox(a: [number, number, number], b: [number, number, number], pad = 0): THREE.Box3 {
  return _box
    .clone()
    .makeEmpty()
    .expandByPoint(new THREE.Vector3(...a))
    .expandByPoint(new THREE.Vector3(...b))
    .expandByScalar(pad);
}
