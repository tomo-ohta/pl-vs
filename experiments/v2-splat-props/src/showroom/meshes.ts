/**
 * 同じ形のメッシュ（見本の部屋の「メッシュ」表示）。スプラットと同じ形の関数が surface() で書き足した曲面（MeshPatch）から、
 * v2 と同じ作り方（v2/client/props の atlas.ts・propMeshes.ts）でメッシュにする。
 *
 * - 形: 曲面ごとの三角形の格子（頂点は粒の間隔の 2.5 倍。平らな面は焼き込み光の分だけ）
 * - 色: 粒と同じ細かさのテクスチャ（地の色 + 不透明度・粗さと金属度・光る分）。部屋ごとのアトラスに詰める
 * - 明るさ: v2 の材質そのもの（MaterialLibrary.adoptExternal）。頂点に v2 の焼き込み照明（bakedLight）を焼く
 * スプラットとの違い（形の関数では同じでも出ない物）: ぬいぐるみの毛羽（粒だけで作った）、粒の縁の柔らかさ
 */
import type * as THREE from 'three';
import type { MaterialLibrary } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { SurfaceLighting } from '../../../../v2/client/render/SurfaceGeometry.ts';
import { buildMeshData } from '../../../../v2/client/props/atlas.ts';
import { buildPropMeshes } from '../../../../v2/client/props/propMeshes.ts';
import { nextTask } from './bake.ts';
import type { MeshPatch } from './surfel.ts';

export { disposeInstance, instanceOf, relightMeshes } from '../../../../v2/client/props/propMeshes.ts';

export interface RoomMeshes {
  group: THREE.Group;
  triangles: number;
  vertices: number;
  /** 展示物ごとの三角形の数 */
  trianglesOf: Map<string, number>;
  /** アトラスの大きさ */
  pages: { w: number; h: number }[];
  /** GPU に置く量（頂点・三角形の番号・テクスチャ。ミップマップ込み。計算値） */
  bytes: number;
  ms: number;
}

/**
 * 部屋 1 つ分の曲面からメッシュを作る。ranges は展示物ごとの曲面の範囲（patches の添字）。
 * L が null なら焼き込みはせず、頂点の焼き込み光を一定の値にする（動く物。後から relightMeshes で当て直す）
 */
export async function buildRoomMeshes(patches: MeshPatch[], ranges: Map<string, [number, number]>, L: SurfaceLighting | null, materials: MaterialLibrary, renderer: THREE.WebGLRenderer, name: string): Promise<RoomMeshes> {
  const t0 = performance.now();
  const data = buildMeshData(patches);
  await nextTask();
  let t = performance.now();
  const pause = async (): Promise<void> => { if (performance.now() - t > 12) { await nextTask(); t = performance.now(); } };
  const m = await buildPropMeshes(data, { materials, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()), lighting: L, name, pause });
  const trianglesOf = new Map<string, number>();
  for (const [id, [from, to]] of ranges) {
    let n = 0;
    for (let i = from; i < to; i++) n += patches[i]!.index.length / 3;
    trianglesOf.set(id, n);
  }
  return { group: m.group, triangles: data.triangles, vertices: data.vertices, trianglesOf, pages: data.pages.map((p) => ({ w: p.w, h: p.h })), bytes: data.bytes, ms: performance.now() - t0 };
}
