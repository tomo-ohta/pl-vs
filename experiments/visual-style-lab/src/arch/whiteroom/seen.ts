import type { Colliders } from '../../core/Colliders.ts';
import { CAM0, CAM1, CAM2 } from './layout.ts';
import type { ShiftCam } from './shiftcam.ts';

/**
 * 参考画像の視点から見える所には足さない（docs/07・lessons の「視点の画素は変えない」）。
 * 写っていない所の決まり（どこにでも同じ規則で置く物）を「後で置く」列に積み、全部の形（当たり判定の箱）ができてから、
 * 参考画像の 3 視点のどれかから見える物だけを外して置く。見えるか = 画角の中（あおりの画面）で、目から点までの線が
 * 当たり判定の箱（壁・床・屋根）に遮られない。物の外形の隅の点のどれかが見えれば「見える」
 */
type V3 = [number, number, number];

const CAMS: ShiftCam[] = [CAM0, CAM1, CAM2];
const W = 1456;
const H = 816;

/** 線分（a → b の t ∈ [0, tMax]）が箱に当たるか */
function segHits(a: V3, d: V3, tMax: number, mn: { x: number; y: number; z: number }, mx: { x: number; y: number; z: number }): boolean {
  let t0 = 0;
  let t1 = tMax;
  const lo = [mn.x, mn.y, mn.z];
  const hi = [mx.x, mx.y, mx.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (a[i] < lo[i] || a[i] > hi[i]) return false;
      continue;
    }
    let ta = (lo[i] - a[i]) / d[i];
    let tb = (hi[i] - a[i]) / d[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export function seenFromViews(col: Colliders, pts: V3[], pad = 40): boolean {
  for (const cam of CAMS) {
    const eye = cam.v.eye;
    for (const p of pts) {
      const q = cam.proj(p);
      if (!q || q[0] < -pad || q[0] > W + pad || q[1] < -pad || q[1] > H + pad) continue;
      const d: V3 = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
      const len = Math.hypot(d[0], d[1], d[2]);
      // 点のすぐ手前（壁に付けた物の後ろの壁に当たらないように 8 cm 手前まで）
      const tMax = Math.max(0, 1 - 0.08 / len);
      let blocked = false;
      for (const b of col.boxes) {
        // 扉の板（近づくと開く扉も）は参考画像の撮影では閉じているので遮る物に数える
        if (b.enabled === false) continue;
        if (segHits(eye, d, tMax, b.min, b.max)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
  }
  return false;
}

/** 後で置く物の列（全部の形ができてから、視点から見えない物だけ置く） */
export class Later {
  private readonly list: { pts: V3[]; fn: () => void }[] = [];
  add(pts: V3[], fn: () => void): void {
    this.list.push({ pts, fn });
  }
  /** 箱の 8 隅（物の外形） */
  addBox(min: V3, max: V3, fn: () => void): void {
    const pts: V3[] = [];
    for (let i = 0; i < 8; i++) pts.push([i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
    pts.push([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]);
    this.add(pts, fn);
  }
  run(col: Colliders): { placed: number; skipped: number } {
    let placed = 0;
    let skipped = 0;
    for (const it of this.list) {
      if (seenFromViews(col, it.pts)) skipped++;
      else {
        it.fn();
        placed++;
      }
    }
    this.list.length = 0;
    return { placed, skipped };
  }
}
