import type { V3 } from '../../scenes/Builder.ts';
import type { LBox } from './author.ts';
import { Frame } from './frame.ts';
import { VIEWS, WATER, localCam } from './layout.ts';
import { visibleIn } from './stack.ts';

/**
 * 参考画像の視点から見えるか（写っていない所の作り込みを、参考画像の視点の見た目を変えずに置くための判定）。
 * 1. 視点の画角の中（10 画素の余白）で、目から near m より近い
 * 2. しかも、置いた塊（壁・積んだ箱・床）に隠れずに目から見える点がある（物の箱の 3 × 3 × 3 の点を、目からの線分で調べる）。
 *    水面の映り込み（水面で折り返した目から）も調べる
 * 塊は place()（env.ts）が置くたびに登録する。場面を組み立て直すときは clearOccluders()
 */

const views = [VIEWS.v0, VIEWS.v1, VIEWS.v2, VIEWS.v3].map((v) => {
  const f = new Frame(v.frame);
  const cam = localCam(v);
  const eye = f.p(cam.eye[0], cam.eye[1], cam.eye[2]);
  return { f, cam, eye, mirror: [eye[0], 2 * WATER - eye[1], eye[2]] as V3 };
});

/** 視線を遮る塊（世界の箱） */
const occluders: { min: V3; max: V3 }[] = [];

export function clearOccluders(): void {
  occluders.length = 0;
}

/** 塊を登録する（薄い板・小さな物は登録しない） */
export function addOccluder(min: V3, max: V3): void {
  if (max[0] - min[0] < 0.15 || max[1] - min[1] < 0.15 || max[2] - min[2] < 0.15) return;
  occluders.push({ min: [...min] as V3, max: [...max] as V3 });
}

/** 線分 a → b が箱を通るか（端の点の近くは除く） */
function hits(a: V3, b: V3, o: { min: V3; max: V3 }): boolean {
  let t0 = 1e-4;
  let t1 = 1 - 1e-3;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) {
      if (a[i] <= o.min[i] || a[i] >= o.max[i]) return false;
      continue;
    }
    let u = (o.min[i] - a[i]) / d;
    let v = (o.max[i] - a[i]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 >= t1) return false;
  }
  return true;
}

/** 目から箱のどこかの点が見えるか（塊に遮られない点が 1 つでもあれば見える） */
function anyVisible(eye: V3, min: V3, max: V3): boolean {
  const lo: V3 = [Math.min(eye[0], min[0]), Math.min(eye[1], min[1]), Math.min(eye[2], min[2])];
  const hi: V3 = [Math.max(eye[0], max[0]), Math.max(eye[1], max[1]), Math.max(eye[2], max[2])];
  const near = occluders.filter((o) => o.max[0] > lo[0] && o.min[0] < hi[0] && o.max[1] > lo[1] && o.min[1] < hi[1] && o.max[2] > lo[2] && o.min[2] < hi[2]);
  const fr = [0.04, 0.5, 0.96];
  for (const fx of fr)
    for (const fy of fr)
      for (const fz of fr) {
        const p: V3 = [min[0] + (max[0] - min[0]) * fx, min[1] + (max[1] - min[1]) * fy, min[2] + (max[2] - min[2]) * fz];
        if (!near.some((o) => hits(eye, p, o))) return true;
      }
  return false;
}

/** 世界の箱が参考画像の視点から近く（near m 以内）に見えるか（塊に隠れる所・映り込みも調べる） */
export function seenFromViews(min: V3, max: V3, near = 40): boolean {
  return views.some(({ f, cam, eye, mirror }) => {
    const l = f.boxInv(min, max);
    const bx: LBox = { min: l.min, max: l.max };
    if (!visibleIn(cam, bx, 10)) return false;
    let d = 0;
    for (let i = 0; i < 3; i++) d += Math.max(bx.min[i] - cam.eye[i], 0, cam.eye[i] - bx.max[i]) ** 2;
    if (Math.sqrt(d) >= near) return false;
    return anyVisible(eye, min, max) || anyVisible(mirror, min, max);
  });
}

/**
 * 灯りの光だまりが参考画像の視点に効くか: 照らす箱が視点の目から 25 m 以内（LampSet は 24 m より遠い箱の灯りを送らないので、
 * それより遠い光だまりは視点の描画を変えない）
 */
export function lampNearViews(min: V3, max: V3): boolean {
  return views.some(({ eye }) => {
    const d = Math.hypot(Math.max(min[0] - eye[0], 0, eye[0] - max[0]), Math.max(min[1] - eye[1], 0, eye[1] - max[1]), Math.max(min[2] - eye[2], 0, eye[2] - max[2]));
    return d < 25;
  });
}
