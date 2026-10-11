import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { slab, wallWithHoles, type WallHole } from '../kit.ts';
import { DOORS, WALL, WALLS, type DoorDef, type WallDef } from './layout.ts';
import { PAL, type VcMats } from './mats.ts';

/**
 * 建物の壁（間取り図の壁の線から。扉の穴は DOORS から求める）と、扉の枠・巾木。
 * サーバー室どうしの壁も 1 回だけ作る（同じ所に 2 枚の面が重なってちらつかないように）。
 */

/** 壁の上の扉（壁の線と向きが同じで、範囲が壁の中にある） */
function doorsOn(w: WallDef): DoorDef[] {
  const alongX = Math.abs(w.a[1] - w.b[1]) < 1e-6;
  const line = alongX ? w.a[1] : w.a[0];
  const lo = alongX ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]);
  const hi = alongX ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1]);
  return DOORS.filter((d) => (alongX ? d.wall === 'x' : d.wall === 'z') && Math.abs(d.line - line) < 0.08 && d.a >= lo - 1e-6 && d.b <= hi + 1e-6);
}

export function buildWalls(b: Builder, vc: VcMats, wallMat: THREE.Material, outerMat: THREE.Material): void {
  const sink = vc.sink(b);
  const P = new Prop(sink, vc, new THREE.Matrix4(), 3);
  for (const w of WALLS) {
    const alongX = Math.abs(w.a[1] - w.b[1]) < 1e-6;
    const start = alongX ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]);
    const ds = doorsOn(w);
    const holes: WallHole[] = ds.map((d) => ({ at: (d.a + d.b) / 2 - start, width: d.b - d.a + (d.kind === 'opening' ? 0 : 0.1), bottom: d.y0, top: d.y0 + d.h + (d.kind === 'opening' ? 0 : 0.05) }));
    const a: [number, number] = alongX ? [start, w.a[1]] : [w.a[0], start];
    const c: [number, number] = alongX ? [Math.max(w.a[0], w.b[0]), w.a[1]] : [w.a[0], Math.max(w.a[1], w.b[1])];
    wallWithHoles(b, w.outer ? outerMat : wallMat, a, c, w.y0, w.y1, WALL, holes);
    // 扉の枠（両面の額縁）
    for (const d of ds) {
      if (d.kind === 'opening') continue;
      const fw = 0.05;
      const top = d.y0 + d.h;
      for (const s of [-1, 1]) {
        const n = s * (WALL / 2 + 0.012);
        const jamb = (u0: number, u1: number, y0: number, y1: number): void => {
          if (alongX) P.box(PAL.doorFrame, [u0, y0, d.line + n - 0.012], [u1, y1, d.line + n + 0.012], { shadow: false });
          else P.box(PAL.doorFrame, [d.line + n - 0.012, y0, u0], [d.line + n + 0.012, y1, u1], { shadow: false });
        };
        jamb(d.a - fw, d.a, d.y0, top + fw);
        jamb(d.b, d.b + fw, d.y0, top + fw);
        jamb(d.a - fw, d.b + fw, top, top + fw);
      }
    }
  }
}

/** 床・天井の板（長方形の部屋） */
export function floorCeil(b: Builder, floorMat: THREE.Material, ceilMat: THREE.Material | null, rect: [number, number, number, number], floorY: number, ceilY: number): THREE.Mesh {
  const f = slab(b, floorMat, rect, floorY, 0.3, { shadow: 'receive' });
  if (ceilMat) slab(b, ceilMat, rect, ceilY + 0.2, 0.2, { shadow: false });
  return f;
}
