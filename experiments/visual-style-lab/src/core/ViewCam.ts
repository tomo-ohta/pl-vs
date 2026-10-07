import * as THREE from 'three';

/**
 * 参考画像の視点のカメラ。画像の画素と場面の座標を行き来する（今回の場面で 3 つの担当が別々に書いた道具を 1 つにした）。
 *
 * 使い方（合わせ込みの 1 段目「カメラと粗い形」）:
 *   1. 参考画像で消失点・地平線・床と壁の境目などを画素で測り、目の高さ・yaw・pitch・縦の画角を決める
 *   2. `hit(x, y, axis, v)` で「画像のこの画素に見える、この面の上の点」を求めて、壁・柱・物の位置と寸法を決める
 *   3. `proj(p)` で置いた物が画像のどこに見えるかを確かめる（数値で合わせる）
 *   4. `def()` を ViewDef にそのまま入れる
 * 回転は three と同じ YXZ（yaw = 0 で -Z を向き、正で左へ回る。pitch 正で上を見る）。画素は左上が原点。
 */
export class ViewCam {
  readonly eye: [number, number, number];
  readonly yaw: number;
  readonly pitch: number;
  /** 縦の画角（度） */
  readonly fov: number;
  readonly roll: number;
  readonly imgW: number;
  readonly imgH: number;
  /** 焦点距離（画素） */
  readonly f: number;
  private readonly q: THREE.Quaternion;
  private readonly qi: THREE.Quaternion;

  // パラメータプロパティは使わない（Node の型ストリップでも読めるように。v2 と同じ）
  constructor(eye: [number, number, number], yaw: number, pitch: number, fov: number, roll = 0, imgW = 1456, imgH = 816) {
    this.eye = eye;
    this.yaw = yaw;
    this.pitch = pitch;
    this.fov = fov;
    this.roll = roll;
    this.imgW = imgW;
    this.imgH = imgH;
    this.f = imgH / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    this.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    this.qi = this.q.clone().invert();
  }

  /** 画素を通る視線の向き（単位） */
  ray(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - this.imgW / 2) / this.f, -(y - this.imgH / 2) / this.f, -1).applyQuaternion(this.q).normalize();
  }

  /** 画素の視線と、軸に垂直な面（axis = v）の交点 */
  hit(x: number, y: number, axis: 'x' | 'y' | 'z', v: number): [number, number, number] {
    const r = this.ray(x, y);
    const a = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const ra = [r.x, r.y, r.z][a];
    const t = (v - this.eye[a]) / (Math.abs(ra) < 1e-9 ? 1e-9 : ra);
    return [this.eye[0] + r.x * t, this.eye[1] + r.y * t, this.eye[2] + r.z * t];
  }

  /** 床（高さ h）の上の点の [x, z] */
  floor(x: number, y: number, h = 0): [number, number] {
    const p = this.hit(x, y, 'y', h);
    return [p[0], p[2]];
  }

  /** 場面の点が画像のどの画素に見えるか（カメラの後ろなら null） */
  proj(p: [number, number, number]): [number, number] | null {
    const c = new THREE.Vector3(p[0] - this.eye[0], p[1] - this.eye[1], p[2] - this.eye[2]).applyQuaternion(this.qi);
    if (c.z >= -1e-6) return null;
    return [this.imgW / 2 + (this.f * c.x) / -c.z, this.imgH / 2 - (this.f * c.y) / -c.z];
  }

  /** 水平な線（床・天井の縁）が奥へ向かう消失点の画素（向き dir の水平の線） */
  vanishing(dir: [number, number, number]): [number, number] | null {
    return this.proj([this.eye[0] + dir[0] * 1e5, this.eye[1] + dir[1] * 1e5, this.eye[2] + dir[2] * 1e5]);
  }

  /**
   * 画像の外接矩形（画素）から、面（axis = v）の上の長方形を求める（掲示物・窓・扉の大きさ）。
   * 奥へ向かう面（axis 'x'）では、横の範囲を中ほどの高さで、縦の範囲を手前の縁で測る
   */
  rectOn(axis: 'x' | 'z', v: number, x0: number, y0: number, x1: number, y1: number): { c: [number, number, number]; w: number; h: number } {
    const ym = (y0 + y1) / 2;
    if (axis === 'x') {
      const a = this.hit(x0, ym, 'x', v);
      const b = this.hit(x1, ym, 'x', v);
      const nearX = a[2] > b[2] ? x0 : x1;
      const t = this.hit(nearX, y0, 'x', v);
      const u = this.hit(nearX, y1, 'x', v);
      return { c: [v, (t[1] + u[1]) / 2, (a[2] + b[2]) / 2], w: Math.abs(a[2] - b[2]), h: Math.abs(t[1] - u[1]) };
    }
    const xm = (x0 + x1) / 2;
    const a = this.hit(x0, ym, 'z', v);
    const b = this.hit(x1, ym, 'z', v);
    const t = this.hit(xm, y0, 'z', v);
    const u = this.hit(xm, y1, 'z', v);
    return { c: [(a[0] + b[0]) / 2, (t[1] + u[1]) / 2, v], w: Math.abs(a[0] - b[0]), h: Math.abs(t[1] - u[1]) };
  }

  /** ViewDef の値（原点のずれ ox, oz を足す） */
  def(ox = 0, oz = 0): { eye: [number, number, number]; yaw: number; pitch: number; roll: number; fov: number } {
    return { eye: [this.eye[0] + ox, this.eye[1], this.eye[2] + oz], yaw: this.yaw, pitch: this.pitch, roll: this.roll, fov: this.fov };
  }
}

/**
 * 消失点と地平線からカメラの向きと画角を求める（一点透視の画像向けの目安）。
 * - vp: 奥へ向かう水平な線（廊下の床と壁の境目など）の消失点の画素
 * - fov: 縦の画角（度）。画像の中の既知の寸法（扉の高さ 2.0〜2.1 m・天井 2.5〜3 m・目の高さ 1.5〜1.6 m）で別に決める
 * 返す yaw / pitch は、消失点の方向を -Z（奥）とした場面でのカメラの向き
 */
export function solveFromVanishingPoint(vp: [number, number], fov: number, imgW = 1456, imgH = 816): { yaw: number; pitch: number } {
  const f = imgH / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  // 消失点の方向（カメラの座標）: (dx, dy, -f)。これが場面の -Z になるように回す
  const dx = (vp[0] - imgW / 2) / f;
  const dy = -(vp[1] - imgH / 2) / f;
  // Rx(pitch) で消失点の向きを水平にし（tan p = −dy）、Ry(yaw) で -Z に合わせる（tan yaw = dx / √(1 + dy²)）
  const pitch = -Math.atan(dy);
  const yaw = Math.atan2(dx, Math.sqrt(1 + dy * dy));
  return { yaw, pitch };
}
