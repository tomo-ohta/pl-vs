/**
 * 窓の向こうの自分（warpPastWindow）の描画: 窓の板に「この部屋を向かいの壁の外から見た所」を描き（client/world/Portals.ts）、
 * そこにだけ少し前の自分（幽霊。layers 2）を描く。本当の部屋のカメラは layers 2 を見ないので、幽霊は窓の向こうにしかいない。
 * 壁を叩く合図（past.knock）で、本当の部屋のその所から音がする。
 */
import * as THREE from 'three';
import { rotQ, type Dir } from '../../../core/math/vec.ts';
import { defineView } from '../views.ts';
import { cellBoxes, cellOfBoxes, type PartBox } from './common.ts';
import { addPortal } from './portal.ts';

const GHOST_LAYER = 2;

/** 人の形（足元が原点・視線 -Z の向き） */
function figure(cx: number, cz: number, y: number): PartBox[] {
  const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: string): PartBox => ({ min: [cx + x0, y + y0, cz + z0], max: [cx + x1, y + y1, cz + z1], mat });
  return [
    B(-0.13, 0, -0.07, -0.03, 0.85, 0.07, 'whiteFabric'),
    B(0.03, 0, -0.07, 0.13, 0.85, 0.07, 'whiteFabric'),
    B(-0.2, 0.85, -0.11, 0.2, 1.45, 0.11, 'whiteFabric'),
    B(-0.28, 0.82, -0.05, -0.2, 1.42, 0.05, 'whiteFabric'),
    B(0.2, 0.82, -0.05, 0.28, 1.42, 0.05, 'whiteFabric'),
    B(-0.09, 1.47, -0.1, 0.09, 1.7, 0.1, 'marbleWhite'),
  ];
}

defineView('warpPastWindow', (spec, ctx) => {
  const p = spec.params;
  const w = p.window as { center: number[]; dir: number; w: number; h: number; depth: number };
  const dir = (Number(w.dir) & 3) as Dir;
  const u = rotQ([0, 0, 1], dir);
  // 窓の向こう = この部屋を、向かいの壁の外（部屋の奥行きだけ部屋の中へずらした所）から見る。向かいの壁は切る（内面より 2 cm 手前で）
  const portal = addPortal(ctx, {
    center: w.center, dir, w: Number(w.w), h: Number(w.h),
    xform: { from: [0, 0, 0], to: [u[0] * Number(w.depth), 0, u[2] * Number(w.depth)], q: 0 },
    ...(spec.cell ? { cells: [spec.cell] } : {}), layers: [GHOST_LAYER], clipShift: 0.024,
  });
  // 幽霊（部屋の真ん中で作って、入れ物で動かす）
  const room = p.room as { min: number[]; max: number[] };
  const cx = (room.min[0]! + room.max[0]!) / 2, cz = (room.min[2]! + room.max[2]!) / 2, fy = room.min[1]! + 0.3;
  const boxes = figure(cx, cz, fy);
  const g = cellBoxes(ctx.materials, ctx.built, boxes, cellOfBoxes(ctx.built, boxes, spec.cell));
  const pivot = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.set(-cx, 0, -cz);
  inner.add(g.group);
  pivot.add(inner);
  pivot.traverse((o) => o.layers.set(GHOST_LAYER));
  pivot.visible = false;
  ctx.root.add(pivot);
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || e.data?.name !== 'past.knock') return;
    ctx.audio?.play('knock', { pos: e.pos, gain: 0.7 });
  });
  return {
    update(s) {
      const gh = (s.ghost as number[] | undefined) ?? [0, 0, 0, 0];
      pivot.visible = !!gh[3];
      pivot.position.set(gh[0]!, 0, gh[1]!);
      pivot.rotation.y = gh[2]!;
    },
    dispose() { off?.(); portal.dispose(); g.dispose(); pivot.removeFromParent(); },
  };
});
