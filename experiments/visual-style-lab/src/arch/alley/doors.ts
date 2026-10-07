import * as THREE from 'three';
import type { Box } from '../../core/Colliders.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 歩いて近づくと開く扉（場面専用。病棟の扉と同じ考え）。
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
