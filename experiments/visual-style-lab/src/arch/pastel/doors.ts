import * as THREE from 'three';
import type { Box } from '../../core/Colliders.ts';
import { Builder, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { DoorDef } from './layout.ts';

/**
 * 歩いて近づくと開く扉（淡色の廊下の建築版。場面の座標のまま）。
 * - 引き戸: 壁の中（戸袋）へ滑る
 * - 開き戸: 吊り元を軸に 90° 開く
 * 撮影（参考画像の視点・道順）では update が呼ばれないので、扉は閉じたまま写る。
 * 当たり判定: 閉じた板の箱は作った直後は外しておき（歩いて行けるかの確かめは「近づけば開く」として通す）、
 * 歩いている間（update）だけ開き具合で切り替える。鍵の扉はいつも効く。
 */

export interface LeafBuild {
  /** 吊り元（引き戸は閉じた位置の基準）。形は軸からの相対の座標で作る */
  pivot: V3;
  swing?: number;
  slide?: [number, number];
  build(b: Builder): void;
}

interface Leaf {
  obj: THREE.Object3D;
  spec: LeafBuild;
}

export class Door {
  readonly leaves: Leaf[] = [];
  open = 0;
  closedBox: Box | null = null;
  openBoxes: Box[] = [];
  private col = -1;
  constructor(
    readonly def: DoorDef,
    readonly center: THREE.Vector3,
    readonly radius: number,
  ) {}

  apply(): void {
    const k = this.open * this.open * (3 - 2 * this.open);
    for (const { obj, spec } of this.leaves) {
      if (spec.swing !== undefined) obj.rotation.y = spec.swing * k;
      else if (spec.slide) obj.position.set(spec.slide[0] * k, 0, spec.slide[1] * k);
    }
  }

  updateColliders(): void {
    const st = this.def.state === 'locked' ? 0 : this.open < 0.05 ? 0 : this.open > 0.95 ? 2 : 1;
    if (st === this.col) return;
    this.col = st;
    if (this.closedBox) this.closedBox.enabled = st === 0;
    for (const b of this.openBoxes) b.enabled = st === 2;
  }
}

export class Doors {
  readonly list: Door[] = [];
  readonly root = new THREE.Group();
  constructor(readonly ctx: SceneContext) {
    this.root.name = 'doors';
  }

  add(def: DoorDef, leaves: LeafBuild[], radius = 1.8): Door {
    const m = (def.a + def.b) / 2;
    const c = def.wall === 'x' ? new THREE.Vector3(m, def.y0 + 1, def.line) : new THREE.Vector3(def.line, def.y0 + 1, m);
    const d = new Door(def, c, radius);
    for (const spec of leaves) {
      const lb = new Builder(this.ctx);
      spec.build(lb);
      lb.finalize();
      const outer = new THREE.Group();
      outer.position.set(...spec.pivot);
      outer.add(lb.root);
      this.root.add(outer);
      d.leaves.push({ obj: lb.root, spec });
    }
    const closed = new THREE.Box3();
    for (const l of d.leaves) {
      l.obj.parent!.updateMatrixWorld(true);
      closed.union(new THREE.Box3().setFromObject(l.obj.parent!));
    }
    if (!closed.isEmpty()) {
      // 板の厚さが薄いと歩く判定ですり抜けるので、壁の厚さの向きに少し厚くする
      if (def.wall === 'x') closed.expandByVector(new THREE.Vector3(0, 0, 0.05));
      else closed.expandByVector(new THREE.Vector3(0.05, 0, 0));
      const box = this.ctx.colliders.add(closed.min, closed.max);
      box.enabled = def.state === 'locked';
      box.passable = def.state !== 'locked';
      d.closedBox = box;
    }
    if (def.state !== 'locked' && d.leaves.some((l) => l.spec.swing !== undefined)) {
      d.open = 1;
      d.apply();
      for (const l of d.leaves) {
        if (l.spec.swing === undefined) continue;
        l.obj.parent!.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(l.obj.parent!);
        const box = this.ctx.colliders.add(bb.min, bb.max);
        box.enabled = false;
        d.openBoxes.push(box);
      }
      d.open = 0;
      d.apply();
      for (const l of d.leaves) l.obj.parent!.updateMatrixWorld(true);
    }
    if (def.state === 'open') {
      d.open = 1;
      d.apply();
    }
    this.list.push(d);
    return d;
  }

  /** 毎フレーム: 目の位置で開け閉め */
  update(dt: number, eye: THREE.Vector3): void {
    for (const d of this.list) {
      if (d.def.state !== 'auto') {
        d.updateColliders();
        continue;
      }
      const near = Math.hypot(eye.x - d.center.x, eye.z - d.center.z) < d.radius && Math.abs(eye.y - 1.5 - d.def.y0) < 2.2;
      const t = near ? 1 : 0;
      if (d.open !== t) {
        d.open = t > d.open ? Math.min(1, d.open + dt * 2.2) : Math.max(0, d.open - dt * 1.5);
        d.apply();
      }
      d.updateColliders();
    }
  }

  /** 全部の扉を開ける・閉める（確かめ用） */
  setAll(open: number): void {
    for (const d of this.list) {
      if (d.def.state !== 'auto') continue;
      d.open = open;
      d.apply();
    }
  }
}

/**
 * 開き戸の回る角度: 吊り元から戸先への向き u（壁に沿う）を、開く向き n（壁に垂直）へ回す角度（Y 軸回り）
 */
export function swingAngle(u: [number, number], n: [number, number]): number {
  // θ = +π/2 で u → (uz, -ux)
  const ux = u[0];
  const uz = u[1];
  return Math.abs(uz - n[0]) < 1e-6 && Math.abs(-ux - n[1]) < 1e-6 ? Math.PI / 2 : -Math.PI / 2;
}
