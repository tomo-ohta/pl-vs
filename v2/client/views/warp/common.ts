/**
 * 空間のゆがみの部品の描画の共通の道具。
 *
 * cellBoxes: 部品が持つ箱（見ていない間に差し替える箱・異変の物）を、置かれた区画の箱と同じ見た目で作る。
 * 区画の材質（区画の鍵で選んだ色合い）・表面の質感の座標・区画の焼き込み陰影（SurfaceLighting）をそのまま使い、
 * メッシュの原点を区画の床の高さに置く（材質のシェーダは「メッシュの座標の y = 0 が床」）。差し替えた物が壁や床から浮いて見えない
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hashAll } from '../../../core/math/rng.ts';
import type { Box, MatId } from '../../../core/world/layout.ts';
import { boxGeometry } from '../../render/BoxShapes.ts';
import { materialOverridesFor, type MaterialLibrary } from '../../render/MaterialLibrary.ts';
import { appearanceSeed, attachSurfaceAppearance } from '../../render/SurfaceAppearance.ts';
import { cellAt, type BuiltCell, type BuiltFloor } from '../../world/FloorBuilder.ts';

export interface PartBox { min: number[]; max: number[]; mat: string; solid?: boolean }

const toBox = (b: PartBox): Box => ({ min: [b.min[0]!, b.min[1]!, b.min[2]!], max: [b.max[0]!, b.max[1]!, b.max[2]!], mat: b.mat as MatId, solid: !!b.solid });

/** 箱の組の真ん中にある区画（無ければ最初の箱の所） */
export function cellOfBoxes(built: BuiltFloor, boxes: readonly PartBox[], fallback?: string): BuiltCell | null {
  if (fallback) { const c = built.cells.get(fallback); if (c) return c; }
  const b = boxes[0];
  if (!b) return null;
  return cellAt(built, [(b.min[0]! + b.max[0]!) / 2, b.min[1]! + 0.1, (b.min[2]! + b.max[2]!) / 2]);
}

/**
 * 箱の組 → 区画の箱と同じ見た目のメッシュ（材質ごとに結合）。cell が無ければ共有の材質と一定の明るさ
 */
export function cellBoxes(materials: MaterialLibrary, built: BuiltFloor, boxes: readonly PartBox[], cell: BuiltCell | null): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const byMat = new Map<MatId, THREE.BufferGeometry[]>();
  const fy = cell?.layout.floorY ?? 0;
  const matKey = cell ? cell.layout.materialKey ?? cell.layout.id : 'warp';
  for (const pb of boxes) {
    const b = toBox(pb);
    if (b.max[0] - b.min[0] < 1e-4 || b.max[1] - b.min[1] < 1e-4 || b.max[2] - b.min[2] < 1e-4) continue;
    let g = boxGeometry(b);
    attachSurfaceAppearance(g, appearanceSeed(built.floor.seed, matKey, b.mat));
    if (cell) cell.lighting.on.bake(g, b);
    else g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(0.35), 3));
    if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
    // 区画の uv1（ライトマップ）は持たない: 結合の都合で、無い属性はそろえる
    g.deleteAttribute('uv1');
    g.translate(0, -fy, 0);
    const list = byMat.get(b.mat) ?? [];
    list.push(g);
    byMat.set(b.mat, list);
  }
  const geos: THREE.BufferGeometry[] = [];
  for (const [mat, list] of byMat) {
    const merged = list.length === 1 ? list[0]! : mergeGeometries(list, false);
    if (!merged) continue;
    if (list.length > 1) for (const g of list) g.dispose();
    geos.push(merged);
    const m = cell
      ? materials.forRoom(mat, { roomId: matKey, seed: hashAll(built.floor.seed, 'cell', matKey), palette: cell.layout.palette, height: cell.layout.height, overrides: materialOverridesFor(cell.layout.render, cell.layout.palette) })
      : materials.get(mat);
    const mesh = new THREE.Mesh(merged, m);
    mesh.position.y = fy;
    group.add(mesh);
  }
  return { group, dispose: () => { group.removeFromParent(); for (const g of geos) g.dispose(); } };
}

/** 照明に依らない色の小さな箱（表示灯・目印） */
export function glowBox(size: [number, number, number], color: number): { mesh: THREE.Mesh; dispose(): void } {
  const geo = new THREE.BoxGeometry(...size);
  const mat = new THREE.MeshBasicMaterial({ color, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, dispose: () => { mesh.removeFromParent(); geo.dispose(); mat.dispose(); } };
}
