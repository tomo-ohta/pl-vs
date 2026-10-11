import type { ViewCam } from '../../core/ViewCam.ts';
import type { V3 } from '../../scenes/Builder.ts';

/**
 * 参考画像の画素から、水路の局所の箱を求める道具（ViewCam で画素 → 面の上の点）。
 * どれも「参考画像を見て測った画素の値」を渡し、形は箱で返す（参考画像そのものは読まない）。
 */

export interface LBox {
  min: V3;
  max: V3;
  /** 材質の種類（'wall' 既定・'dark' 奥まった面・'glow' 光る） */
  kind?: string;
  /** 当たり判定を付けるか（歩ける高さに掛かる物） */
  collide?: boolean;
}

/**
 * 側面（水路に向く面）が x = X の平面にある塊。near / far = 手前と奥の縦の縁の画素 x、top = 手前の縁の上端の画素 y、
 * bot = 下端の画素 y（無ければ y0 の高さ）。左の壁（side 'L'）は面が +x を向き、塊は -x へ back だけ伸びる
 */
export function sideBlock(
  cam: ViewCam,
  o: { X: number; side: 'L' | 'R'; near: number; far?: number; zFar?: number; top: number; bot?: number; y0?: number; yTop?: number; back?: number; kind?: string },
): LBox {
  const row = o.bot !== undefined ? (o.top + o.bot) / 2 : o.top + 40;
  const zNear = cam.hit(o.near, row, 'x', o.X)[2];
  const zFar = o.zFar ?? cam.hit(o.far!, row, 'x', o.X)[2];
  const yTop = o.yTop ?? cam.hit(o.near, o.top, 'z', zNear)[1];
  const yBot = o.bot !== undefined ? cam.hit(o.near, o.bot, 'z', zNear)[1] : (o.y0 ?? 0);
  const back = o.back ?? 8;
  const x0 = o.side === 'L' ? o.X - back : o.X;
  const x1 = o.side === 'L' ? o.X : o.X + back;
  return { min: [x0, yBot, Math.min(zNear, zFar)], max: [x1, yTop, Math.max(zNear, zFar)], kind: o.kind };
}

/**
 * 正面（目の方を向く面）が見える塊。x0 / x1 = 左右の縦の縁の画素、top / bot = 上下の縁の画素。
 * 面の奥行き z は、下端が床（floorY）に接していれば床から、z を渡せばそれ。depth だけ奥へ伸びる
 */
export function frontBlock(
  cam: ViewCam,
  o: { x0: number; x1: number; top: number; bot?: number; z?: number; floorY?: number; y0?: number; yTop?: number; depth?: number; extL?: number; extR?: number; kind?: string },
): LBox {
  const mx = (o.x0 + o.x1) / 2;
  const z = o.z ?? cam.hit(mx, o.bot!, 'y', o.floorY ?? 0)[2];
  const yRow = o.bot ?? o.top + 30;
  const xa = cam.hit(o.x0, yRow, 'z', z)[0] - (o.extL ?? 0);
  const xb = cam.hit(o.x1, yRow, 'z', z)[0] + (o.extR ?? 0);
  const yTop = o.yTop ?? cam.hit(mx, o.top, 'z', z)[1];
  const yBot = o.y0 ?? (o.bot !== undefined && o.z !== undefined ? cam.hit(mx, o.bot, 'z', z)[1] : (o.floorY ?? 0));
  const d = o.depth ?? 6;
  return { min: [Math.min(xa, xb), yBot, z - d], max: [Math.max(xa, xb), yTop, z], kind: o.kind };
}

/**
 * 正面が見える塊で、内側（水路の側）の縦の縁が x = X の平面にあるもの（左の壁なら右の縁 x1、右の壁なら左の縁 x0）。
 * 正面の奥行き z はその縁から決まる。塊は外側へ ext、奥へ depth 伸びる。y0 / yTop で高さを直接渡せる
 */
export function wallBlock(
  cam: ViewCam,
  o: { side: 'L' | 'R'; X: number; x0: number; x1: number; top: number; bot?: number; y0?: number; yTop?: number; depth?: number; ext?: number; kind?: string },
): LBox {
  const inner = o.side === 'L' ? o.x1 : o.x0;
  const row = o.bot !== undefined ? (o.top + o.bot) / 2 : o.top + 30;
  const z = cam.hit(inner, row, 'x', o.X)[2];
  const outer = cam.hit(o.side === 'L' ? o.x0 : o.x1, row, 'z', z)[0];
  const ext = o.ext ?? 8;
  const xa = o.side === 'L' ? outer - ext : o.X;
  const xb = o.side === 'L' ? o.X : outer + ext;
  const mx = (o.x0 + o.x1) / 2;
  const yTop = o.yTop ?? cam.hit(mx, o.top, 'z', z)[1];
  const yBot = o.y0 ?? cam.hit(mx, o.bot!, 'z', z)[1];
  return { min: [xa, yBot, z - (o.depth ?? 6)], max: [xb, yTop, z], kind: o.kind };
}

/** 画素の点が、高さ y の床のどこに見えるか（局所の x, z） */
export function onFloor(cam: ViewCam, x: number, y: number, h: number): [number, number] {
  const p = cam.hit(x, y, 'y', h);
  return [p[0], p[2]];
}

/** 画素の点が x = X の平面（奥へ向かう壁）のどこに見えるか */
export function onSide(cam: ViewCam, x: number, y: number, X: number): V3 {
  return cam.hit(x, y, 'x', X);
}

/** 画素の点が z = Z の平面（正面の壁）のどこに見えるか */
export function onFront(cam: ViewCam, x: number, y: number, Z: number): V3 {
  return cam.hit(x, y, 'z', Z);
}
