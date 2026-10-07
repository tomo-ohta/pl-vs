import * as THREE from 'three';
import type { Box } from '../../core/Colliders.ts';
import { Builder, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Leg } from './leg.ts';

/**
 * 歩いて近づくと開く扉（建築版の病棟）。
 * - 引き戸: 戸袋（壁の中）へ横に滑る。まず少し引っ込んでから滑る（閉じた時は壁の面とそろう）
 * - 開き戸: 吊り元を軸に向こう側へ 90° 開く（防火扉の両開き・片開き）
 * 撮影（参考画像の視点）では update が呼ばれないので、扉は閉じたまま写る。
 * 当たり判定: 閉じている間は扉の板の箱、開き戸が開ききったら開いた板の箱。歩いている間（update）だけ効く。
 * 作った直後（update の前）はどちらも外してある（撮影・歩いて行けるかの確かめは「近づけば開く」として通す）。
 */

export interface LeafSpec {
  /** 区域（leg）の座標の軸の位置（吊り元・引き戸の基準） */
  pivot: V3;
  /** 引き戸の滑る向き（区域の座標の単位ベクトル x, z）と距離、引っ込む向きと距離 */
  slide?: { dir: [number, number]; dist: number; back?: [number, number] };
  /** 開き戸の回る角度（ラジアン。正で区域の +x が -z へ回る向き） */
  swing?: number;
  /** 区域の座標で形を作る（軸の位置からの相対ではなく、区域の座標のまま書く） */
  build(s: Leg): void;
}

interface Leaf {
  obj: THREE.Object3D;
  spec: LeafSpec;
}


export class Door {
  readonly leaves: Leaf[] = [];
  open = 0;
  locked = false;
  /** 閉じた板・開いた板の当たり判定（場面の箱）と、その本来の範囲 */
  closedBox: Box | null = null;
  openBoxes: Box[] = [];
  private colState = -1;
  constructor(
    readonly center: THREE.Vector3,
    readonly radius: number,
    readonly speed: number,
  ) {}

  apply(): void {
    // なめらかに（始めと終わりをゆっくり）
    const k = this.open * this.open * (3 - 2 * this.open);
    for (const { obj, spec } of this.leaves) {
      if (spec.swing !== undefined) {
        obj.rotation.y = spec.swing * k;
      } else if (spec.slide) {
        const sl = spec.slide;
        const back = sl.back ?? [0, 0];
        const kb = Math.min(1, k / 0.18);
        const ks = Math.max(0, (k - 0.12) / 0.88);
        obj.position.set(back[0] * kb + sl.dir[0] * sl.dist * ks, 0, back[1] * kb + sl.dir[1] * sl.dist * ks);
      }
    }
  }

  /** 開き具合に合わせて当たり判定を切り替える */
  updateColliders(): void {
    const st = this.open < 0.05 ? 0 : this.open > 0.95 ? 2 : 1;
    if (st === this.colState) return;
    this.colState = st;
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

  /**
   * 扉を作る。leg は区域の座標系（場面の座標のままなら原点 0・yaw 0 の Leg）。center は扉の中心（区域の座標）。
   * 開く距離 radius（m）以内に目が入ると開く
   */
  add(leg: Leg, center: V3, leaves: LeafSpec[], o: { radius?: number; speed?: number; locked?: boolean } = {}): Door {
    const d = new Door(new THREE.Vector3(...leg.w(center)), o.radius ?? 1.9, o.speed ?? 2.2);
    d.locked = o.locked ?? false;
    for (const spec of leaves) {
      const lb = new Builder(this.ctx);
      const p = spec.pivot;
      const s = new Leg(lb, this.ctx, [-p[0], -p[1], -p[2]], leg.cam, 0);
      spec.build(s);
      lb.finalize();
      const outer = new THREE.Group();
      outer.position.set(...leg.w(p));
      outer.rotation.y = leg.yaw;
      outer.add(lb.root);
      this.root.add(outer);
      d.leaves.push({ obj: lb.root, spec });
    }
    // 当たり判定: 閉じた板の範囲（全部の葉を合わせる）と、開き戸が開ききった時の板の範囲
    const closed = new THREE.Box3();
    for (const l of d.leaves) {
      l.obj.parent!.updateMatrixWorld(true);
      closed.union(new THREE.Box3().setFromObject(l.obj.parent!));
    }
    if (!closed.isEmpty()) {
      const box = this.ctx.colliders.add(closed.min, closed.max);
      box.enabled = false;
      box.passable = !d.locked;
      d.closedBox = box;
    }
    if (d.leaves.some((l) => l.spec.swing !== undefined)) {
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
    this.list.push(d);
    return d;
  }

  /** 毎フレーム: 目の位置で開け閉め */
  update(dt: number, eye: THREE.Vector3): void {
    for (const d of this.list) {
      if (d.locked) {
        // 鍵の掛かった扉は閉じたまま、閉じた板の当たり判定を効かせる（歩いて通り抜けられないように）
        d.updateColliders();
        continue;
      }
      const near = Math.hypot(eye.x - d.center.x, eye.z - d.center.z) < d.radius && Math.abs(eye.y - 1.5 - d.center.y) < 2.2;
      const t = near ? 1 : 0;
      if (d.open !== t) {
        d.open = t > d.open ? Math.min(1, d.open + dt * d.speed) : Math.max(0, d.open - dt * d.speed * 0.7);
        d.apply();
      }
      d.updateColliders();
    }
  }
}
