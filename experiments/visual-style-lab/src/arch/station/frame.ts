import * as THREE from 'three';
import { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { Colliders } from '../../core/Colliders.ts';
import { consolidate } from './region.ts';

/**
 * 別の座標で作って、回して置く（元の版の D を南北に向け直すため）。
 * 中で作った物（まとめる物・当たり判定・InstancedMesh の行列）を、最後に行列 T で場面の座標へ移す。
 * T は y 軸回りの 90° 単位の回転と平行移動だけ（当たり判定の箱が軸に沿ったままになる）
 */
export class FrameBuilder {
  readonly b: Builder;
  readonly T: THREE.Matrix4;
  private readonly boxes: THREE.Box3[] = [];

  constructor(ctx: SceneContext, T: THREE.Matrix4) {
    this.T = T;
    const self = this;
    // 当たり判定は覚えておき、最後に移して本当の Colliders に入れる
    const proxy = {
      add(min: THREE.Vector3Like, max: THREE.Vector3Like) {
        self.boxes.push(new THREE.Box3(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, max.y, max.z)));
        return null as never;
      },
      addCentered(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
        self.boxes.push(new THREE.Box3(new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2), new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2)));
        return null as never;
      },
      addObject(obj: THREE.Object3D) {
        self.boxes.push(new THREE.Box3().setFromObject(obj));
        return null as never;
      },
    } as unknown as Colliders;
    this.b = new Builder({ ...ctx, colliders: proxy });
  }

  /** 点を移す */
  p(v: [number, number, number]): [number, number, number] {
    const q = new THREE.Vector3(...v).applyMatrix4(this.T);
    return [q.x, q.y, q.z];
  }

  /** 向きを移す */
  dir(v: [number, number, number]): [number, number, number] {
    const q = new THREE.Vector3(...v).transformDirection(this.T);
    return [q.x, q.y, q.z];
  }

  /** 行列（InstancedMesh の 1 つ分）を移す */
  m(m: THREE.Matrix4): THREE.Matrix4 {
    return new THREE.Matrix4().multiplyMatrices(this.T, m);
  }

  /** 作った物を場面の座標へ移し、まとめて root に足す。当たり判定も移して入れる */
  finish(root: THREE.Object3D, colliders: Colliders): void {
    for (const c of [...this.b.root.children]) {
      c.applyMatrix4(this.T);
      c.updateMatrixWorld(true);
    }
    consolidate(this.b.root);
    this.b.finalize();
    root.add(this.b.root);
    for (const bx of this.boxes) {
      const w = bx.clone().applyMatrix4(this.T);
      colliders.add(w.min, w.max);
    }
  }
}

/** 元の版の座標 (ox, oz) を、場面の (nx, nz) へ y 軸回りに angle 回して移す行列（+90° で元の -X 向き → +Z 向き） */
export function frameMatrix(ox: number, oz: number, nx: number, nz: number, angle: number): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(nx, 0, nz)
    .multiply(new THREE.Matrix4().makeRotationY(angle))
    .multiply(new THREE.Matrix4().makeTranslation(-ox, 0, -oz));
}
