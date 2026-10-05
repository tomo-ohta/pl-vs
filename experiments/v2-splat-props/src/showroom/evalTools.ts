/**
 * 作り方の比べ方（開発用。見本の部屋の console から読む: `const t = await import('/src/showroom/evalTools.ts')`）。
 * 他の作り方で作った物（Blender の GLB など）を、見本の部屋の展示物と同じ条件（v2 の材質の注入・v2 の焼き込み照明）で置く。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MaterialLibrary } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { BuiltFloor } from '../../../../v2/client/world/FloorBuilder.ts';
import type { CellLayout, FloorLayout } from '../../../../v2/core/world/layout.ts';
import { bakePoints, exhibitLighting } from './bake.ts';
import { buildRoomMeshes } from './meshes.ts';
import { place, Rand, Surfels, type V3 } from './surfel.ts';

interface Game { renderer: THREE.WebGLRenderer; materials: MaterialLibrary; readonly built: BuiltFloor | null; readonly sim: { floor: FloorLayout } | null }
const game = (): Game => (window as unknown as { game: Game }).game;

function cellAndNeighbors(room: string): { cell: CellLayout; neighbors: CellLayout[] } {
  const floor = game().sim!.floor;
  const cell = floor.cells.find((c) => c.id === room)!;
  const neighbors = floor.portals.filter((p) => p.kind === 'opening' && p.cells.includes(room)).map((p) => floor.cells.find((c) => c.id === (p.cells[0] === room ? p.cells[1] : p.cells[0]))!).filter(Boolean);
  return { cell, neighbors };
}

/** GLB を部屋の座標 at・向き yaw（局所 +z が前）に置く。v2 の材質の注入と、頂点への v2 の焼き込み照明を施す */
export async function placeGlb(url: string, at: V3, yaw: number, room: string): Promise<{ object: THREE.Object3D; triangles: number; ms: number }> {
  const t0 = performance.now();
  const g = game();
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.position.set(at[0], at[1], at[2]);
  root.rotation.y = yaw;
  root.updateMatrixWorld(true);
  const { cell, neighbors } = cellAndNeighbors(room);
  const L = exhibitLighting(cell, neighbors);
  let triangles = 0;
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
    const n = pos.count;
    const wp = new Float32Array(n * 3), wn = new Float32Array(n * 3);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); wp.set([v.x, v.y, v.z], i * 3);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); wn.set([v.x, v.y, v.z], i * 3);
    }
    const baked = new Float32Array(n * 3);
    await bakePoints(L, wp, wn, 0, n, baked);
    geo.setAttribute('bakedLight', new THREE.BufferAttribute(baked, 3));
    mesh.material = g.materials.adoptExternal(mesh.material as THREE.MeshStandardMaterial);
    triangles += (geo.index ? geo.index.count : n) / 3;
  }
  (g.built?.cells.get(room)?.group ?? root.parent)?.add(root);
  return { object: root, triangles, ms: performance.now() - t0 };
}

/** 形の関数（gen/*.ts）で作った物を、同じ形のメッシュとして置く（見本の部屋の「メッシュ」表示と同じ作り方） */
export async function placeProcedural(gen: (S: Surfels, R: Rand, xf: (p: V3) => V3) => void, at: V3, yaw: number, room: string, seed = 1): Promise<{ object: THREE.Object3D; triangles: number; ms: number }> {
  const t0 = performance.now();
  const g = game();
  const S = new Surfels();
  S.patches = [];
  gen(S, new Rand(seed), place(at, yaw));
  const { cell, neighbors } = cellAndNeighbors(room);
  const m = await buildRoomMeshes(S.patches, new Map([['eval', [0, S.patches.length]]]), exhibitLighting(cell, neighbors), g.materials, g.renderer, 'eval');
  g.built?.cells.get(room)?.group.add(m.group);
  return { object: m.group, triangles: m.triangles, ms: performance.now() - t0 };
}
