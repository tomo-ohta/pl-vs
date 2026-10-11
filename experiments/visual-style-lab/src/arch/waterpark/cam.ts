import * as THREE from 'three';
import { ViewCam } from '../../core/ViewCam.ts';

/**
 * あおり補正（シフト）つきの視点のカメラ。
 * 参考画像 4 枚はどれも「縦の線がまっすぐ（カメラは水平）なのに、地平線が画面の中央より下」= 建築写真のシフトレンズの構図。
 * 上を向く（pitch）と柱が上で窄まるので、カメラは水平のまま、画面を縦にずらす（投影行列の e[9]）。
 * - 画素 ↔ 座標は ViewCam に「ずらした画素」を渡して求める（hit / proj / ray）
 * - three のカメラには beforeRender で applyShift(camera, k) を掛ける（k = ずらす画素 ÷ 画面の高さの半分）
 */
export const REF_W = 1232;
export const REF_H = 928;

export class ShiftCam {
  readonly vc: ViewCam;
  /** 画面の中身を下へずらす量（参考画像の画素。正 = 地平線が中央より下） */
  readonly shift: number;
  readonly eye: [number, number, number];
  readonly yaw: number;
  readonly fov: number;

  constructor(eye: [number, number, number], yaw: number, fov: number, shift: number, pitch = 0) {
    this.vc = new ViewCam(eye, yaw, pitch, fov, 0, REF_W, REF_H);
    this.shift = shift;
    this.eye = eye;
    this.yaw = yaw;
    this.fov = fov;
  }

  /** 投影行列の e[9] に入れる値 */
  get k(): number {
    return this.shift / (REF_H / 2);
  }

  get f(): number {
    return this.vc.f;
  }

  hit(x: number, y: number, axis: 'x' | 'y' | 'z', v: number): [number, number, number] {
    return this.vc.hit(x, y - this.shift, axis, v);
  }

  /** 床（高さ h）の上の点の [x, z] */
  floor(x: number, y: number, h = 0): [number, number] {
    const p = this.hit(x, y, 'y', h);
    return [p[0], p[2]];
  }

  proj(p: [number, number, number]): [number, number] | null {
    const q = this.vc.proj(p);
    return q ? [q[0], q[1] + this.shift] : null;
  }

  /** ViewDef の値（原点のずれ ox, oz を足す） */
  def(ox = 0, oz = 0): { eye: [number, number, number]; yaw: number; pitch: number; roll: number; fov: number; size: [number, number] } {
    return { ...this.vc.def(ox, oz), size: [REF_W, REF_H] };
  }
}

/** three のカメラの投影行列を縦にずらす（毎フレーム、描く直前に。fov・aspect は今の値のまま） */
export function applyShift(camera: THREE.Camera, k: number): void {
  const c = camera as THREE.PerspectiveCamera;
  if (!c.isPerspectiveCamera) return;
  c.updateProjectionMatrix();
  if (k !== 0) {
    c.projectionMatrix.elements[9] = k;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }
}
