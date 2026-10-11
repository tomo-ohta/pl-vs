import * as THREE from 'three';
import { ViewCam } from '../../core/ViewCam.ts';

/**
 * あおり（シフト）レンズの視点。whiteroom の参考画像は 3 枚とも「縦の線が平行のまま、地平線だけが画面の上の方にある」
 * 建築写真・建築パースの描き方（見下ろしても縦の線がすぼまらない）。カメラを下へ傾けると縦の線が下ですぼまって
 * 輪郭が合わないので、カメラは水平のまま、写す範囲だけを上下にずらす（three の setViewOffset で大きな仮の画面の一部を描く）。
 *
 * - f: 焦点距離（画素。参考画像の高さ 816 の画面で）
 * - yh: 地平線（消失点）の画素の y
 * ViewDef には水平（pitch 0）と、この f の普通の縦の画角を入れる（間取り図の扇・歩くときの画角はそのまま）。
 * 撮影・参考画像の視点にいる間だけ、beforeRender で写す範囲をずらす（applyShift）。
 */
export interface ShiftView {
  id: string;
  eye: [number, number, number];
  yaw: number;
  f: number;
  yh: number;
  w?: number;
  h?: number;
}

/** 普通の縦の画角（度）。ViewDef.fov に入れる */
export function shiftFov(v: ShiftView): number {
  const h = v.h ?? 816;
  return THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / v.f));
}

/** 仮の大きな画面（地平線が真ん中）の高さと、その中の参考画像の画面の上端の位置（画素） */
function fullFrame(v: ShiftView): { H: number; off: number } {
  const h = v.h ?? 816;
  const H = 2 * Math.max(v.yh, h - v.yh);
  // 地平線が仮の画面の真ん中（H / 2）に来るように、参考画像の画面を置く
  return { H, off: H / 2 - v.yh };
}

/**
 * 画素 ↔ 場面の座標（ViewCam と同じ使い方。水平のカメラで、y だけ地平線の位置へずらす）
 */
export class ShiftCam {
  readonly v: ShiftView;
  readonly base: ViewCam;
  readonly off: number;
  constructor(v: ShiftView) {
    this.v = v;
    const { H, off } = fullFrame(v);
    const fovFull = THREE.MathUtils.radToDeg(2 * Math.atan(H / 2 / v.f));
    this.base = new ViewCam(v.eye, v.yaw, 0, fovFull, 0, v.w ?? 1456, H);
    this.off = off;
  }
  get f(): number {
    return this.v.f;
  }
  proj(p: [number, number, number]): [number, number] | null {
    const q = this.base.proj(p);
    return q ? [q[0], q[1] - this.off] : null;
  }
  hit(x: number, y: number, axis: 'x' | 'y' | 'z', val: number): [number, number, number] {
    return this.base.hit(x, y + this.off, axis, val);
  }
  /** 床（高さ h）の上の点 [x, z] */
  floor(x: number, y: number, h = 0): [number, number] {
    const p = this.hit(x, y, 'y', h);
    return [p[0], p[2]];
  }
  /** 目からの水平の奥行き d・横 X（右が正）・高さ h の点 → 場面の座標 */
  local(X: number, h: number, d: number): [number, number, number] {
    const [ex, , ez] = this.v.eye;
    const c = Math.cos(this.v.yaw);
    const s = Math.sin(this.v.yaw);
    // 前 = (-sin yaw, 0, -cos yaw)、右 = (cos yaw, 0, -sin yaw)
    return [ex - s * d + c * X, h, ez - c * d - s * X];
  }
}

const EPS_POS = 2e-3;
const EPS_ROT = 2e-4;

/**
 * 参考画像の視点にカメラがある間だけ、写す範囲をずらす。毎回の描画の前（beforeRender）に呼ぶ。
 * 場面の外（App）が画角・縦横比を変えたときはそれを基準にし、視点から離れたら元に戻す。
 */
export class ShiftLens {
  private applied: { fov: number; aspect: number; base: { fov: number; aspect: number } } | null = null;
  readonly views: ShiftView[];
  // パラメータプロパティは使わない（Node の型ストリップでも読めるように）
  constructor(views: ShiftView[]) {
    this.views = views;
  }

  apply(camera: THREE.Camera): void {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;
    // 前の描画でずらしていたら、まず元に戻す（App が途中で変えた値はそのまま基準にする）
    if (this.applied) {
      if (cam.fov === this.applied.fov) cam.fov = this.applied.base.fov;
      if (cam.aspect === this.applied.aspect) cam.aspect = this.applied.base.aspect;
      this.applied = null;
      cam.clearViewOffset();
    }
    const v = this.views.find((x) => this.at(cam, x));
    if (!v) return;
    const h = v.h ?? 816;
    const { H, off } = fullFrame(v);
    const k = H / h;
    const base = { fov: cam.fov, aspect: cam.aspect };
    const fovFull = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * k));
    cam.fov = fovFull;
    cam.aspect = base.aspect / k;
    // 画面の画素の寸法は比だけが効く（参考画像の寸法の単位で渡す）
    const W = (v.w ?? 1456) * 100;
    cam.setViewOffset(W, H * 100, 0, off * 100, W, h * 100);
    this.applied = { fov: cam.fov, aspect: cam.aspect, base };
  }

  private at(cam: THREE.PerspectiveCamera, v: ShiftView): boolean {
    const p = cam.position;
    if (Math.abs(p.x - v.eye[0]) > EPS_POS || Math.abs(p.y - v.eye[1]) > EPS_POS || Math.abs(p.z - v.eye[2]) > EPS_POS) return false;
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    const dy = Math.atan2(Math.sin(e.y - v.yaw), Math.cos(e.y - v.yaw));
    return Math.abs(dy) < EPS_ROT && Math.abs(e.x) < EPS_ROT;
  }
}
