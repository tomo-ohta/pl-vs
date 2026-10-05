/**
 * 回転する部屋（warpTurnRoom）の描画: 筒の壁の板・入口の枠と垂れ壁・丸い床と敷物・家具を、軸のまわりに回す。
 * 箱は区画の箱と同じ見た目（cellBoxes / cellGeometries）。回すのは軸に置いた入れ物（rotation.y = −angle）。
 * 低い機械の音（筒の真ん中で小さく鳴り続ける）
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { inGap, wallSegments, type TurnGap, type TurnItem } from '../../../core/sim/parts/warp/turn.ts';
import { SURFACES } from '../../render/MaterialLibrary.ts';
import { writeSurfaceCoordinates } from '../../render/SurfaceAppearance.ts';
import { defineView } from '../views.ts';
import { cellBoxes, cellGeometries, cellOfBoxes, type PartBox } from './common.ts';

defineView('warpTurnRoom', (spec, ctx) => {
  const p = spec.params;
  const c = p.center as number[];
  const P = {
    center: c, radius: Number(p.radius), wallT: Number(p.wallT ?? 0.12), segs: Number(p.segs ?? 72), gaps: (p.gaps as unknown as TurnGap[]) ?? [],
    floorY: Number(p.floorY ?? 0), height: Number(p.height ?? 2.6),
  };
  const wallMat = String(p.wallMat ?? 'woodPanel'), floorMat = String(p.floorMat ?? 'floorCarpetRed') as MatId, rugMat = String(p.rugMat ?? 'carpetPattern') as MatId, trimMat = String(p.trimMat ?? 'trim');
  const pivot: number[] = [c[0]!, c[1]!];
  const boxes: PartBox[] = [];
  for (const w of wallSegments(P)) boxes.push({ min: w.min, max: w.max, mat: wallMat, rot: w.at, pivot });
  // 入口の上の垂れ壁（2.15 m より上）と、入口の両側の枠
  const len = (2 * Math.PI * P.radius) / P.segs + 0.03;
  for (let k = 0; k < P.segs; k++) {
    const at = ((k + 0.5) * 2 * Math.PI) / P.segs;
    if (!inGap(P.gaps, at, -Math.PI / P.segs)) continue;
    if (P.height > 2.2) boxes.push({ min: [c[0]! + P.radius - P.wallT / 2, P.floorY + 2.15, c[1]! - len / 2], max: [c[0]! + P.radius + P.wallT / 2, P.floorY + P.height, c[1]! + len / 2], mat: wallMat, rot: at, pivot });
  }
  for (const g of P.gaps) {
    for (const sg of [-1, 1]) {
      const at = g.at + sg * (g.half + Math.PI / P.segs);
      boxes.push({ min: [c[0]! + P.radius - P.wallT / 2 - 0.03, P.floorY, c[1]! - 0.06], max: [c[0]! + P.radius + P.wallT / 2 + 0.03, P.floorY + Math.min(2.2, P.height), c[1]! + 0.06], mat: trimMat, rot: at, pivot });
    }
  }
  for (const it of ((p.items as unknown as TurnItem[]) ?? []).filter((x) => x.mat !== 'colliderOnly')) boxes.push({ min: it.min, max: it.max, mat: it.mat, solid: it.solid, rot: it.rot ?? 0, pivot });
  const cell = cellOfBoxes(ctx.built, boxes, spec.cell);
  const walls = cellBoxes(ctx.materials, ctx.built, boxes, cell);
  // 丸い床と真ん中の敷物（区画の床の少し上）
  const disk = (r: number, y: number, mat: MatId): { g: THREE.BufferGeometry; mat: MatId } => {
    const g = new THREE.CircleGeometry(r, Math.max(48, P.segs));
    g.rotateX(-Math.PI / 2);
    g.translate(c[0]!, y, c[1]!);
    writeSurfaceCoordinates(g, SURFACES[mat].meters, mat);
    return { g, mat };
  };
  const floors = cellGeometries(ctx.materials, ctx.built, [disk(P.radius - P.wallT / 2 + 0.005, P.floorY + 0.012, floorMat), disk(1.0, P.floorY + 0.018, rugMat)], cell);
  // 軸に置いた入れ物を回す（中身はフロアの座標のまま、入れ物の中で軸の分だけずらす）
  const turn = new THREE.Group();
  turn.position.set(c[0]!, 0, c[1]!);
  const inner = new THREE.Group();
  inner.position.set(-c[0]!, 0, -c[1]!);
  inner.add(walls.group, floors.group);
  turn.add(inner);
  ctx.root.add(turn);
  const hum = ctx.audio?.play('machineryLow', { loop: true, pos: [c[0]!, P.floorY + 1.2, c[1]!], gain: 0.12 });
  return {
    update(s) { turn.rotation.y = -Number(s.angle ?? 0); },
    dispose() { hum?.stop?.(); walls.dispose(); floors.dispose(); turn.removeFromParent(); },
  };
});
