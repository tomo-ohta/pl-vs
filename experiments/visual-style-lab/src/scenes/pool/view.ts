import * as THREE from 'three';
import type { V3 } from '../Builder.ts';

/**
 * 参考画像の視点のカメラ（画像の画素と区域の座標を行き来する）。物の位置・寸法を参考画像の画素から決めるのに使う。
 * three と同じ YXZ の回転（yaw = 0 で -Z、正で左へ回る）。座標は区域の原点（目の真下の水面）から。
 */
export const IMG_W = 1456;
export const IMG_H = 816;

export class ViewCam {
  readonly f: number;
  private readonly q: THREE.Quaternion;
  private readonly qi: THREE.Quaternion;
  constructor(
    readonly eye: V3,
    readonly yaw: number,
    readonly pitch: number,
    readonly fov: number,
  ) {
    this.f = IMG_H / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    this.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    this.qi = this.q.clone().invert();
  }

  /** 画素（左上が原点）を通る視線の向き */
  ray(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - IMG_W / 2) / this.f, -(y - IMG_H / 2) / this.f, -1).applyQuaternion(this.q).normalize();
  }

  /** 画素の視線と、軸に垂直な面（axis = v）の交点 */
  hit(x: number, y: number, axis: 'x' | 'y' | 'z', v: number): V3 {
    const r = this.ray(x, y);
    const a = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const ra = [r.x, r.y, r.z][a];
    const t = (v - this.eye[a]) / (Math.abs(ra) < 1e-9 ? 1e-9 : ra);
    return [this.eye[0] + r.x * t, this.eye[1] + r.y * t, this.eye[2] + r.z * t];
  }

  /** 区域の座標の点を画素へ */
  proj(p: V3): [number, number] {
    const c = new THREE.Vector3(p[0] - this.eye[0], p[1] - this.eye[1], p[2] - this.eye[2]).applyQuaternion(this.qi);
    return [IMG_W / 2 + (this.f * c.x) / -c.z, IMG_H / 2 - (this.f * c.y) / -c.z];
  }

  /** 視点の定義（ViewDef の値）。原点 (ox, oz) を足す */
  def(ox: number, oz: number): { eye: [number, number, number]; yaw: number; pitch: number; fov: number } {
    return { eye: [this.eye[0] + ox, this.eye[1], this.eye[2] + oz], yaw: this.yaw, pitch: this.pitch, fov: this.fov };
  }
}
