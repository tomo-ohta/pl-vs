/**
 * 見本の部屋の粒の明るさ（部屋ごとに 1 つの SplatMesh）。
 *
 * 1. 展示物の形の関数（gen/*.ts）で粒を作る（位置・法線・向き・大きさ・地の色・粗さ・金属度・不透明度）
 * 2. v2 の焼き込み照明（SurfaceLighting。器具の配光・遮蔽・接触の陰・反射光の広がり）を粒ごとに当てる。
 *    0.4 m の升目ごとに「小さな箱」として焼く（v2 の小物の箱と同じ速い焼き方: 遮蔽は升目の中心で 1 回）。
 *    v2 の箱（見比べ用）・深さの代役は遮蔽に入れない
 * 3. v2 の材質と同じ式で下の層を作る: 地の色 × 焼き込み / π + 地の色 × 環境マップの拡散（× 0.12）+ 光る分
 * 4. 点光源の拡散（× 0.4）・鏡面（GGX・頭打ち）・環境マップの映り込み・クリアコートを、見る向きごとに求めて SH にする（sh.ts。Worker）
 * 5. Spark の ExtSplats（粒ごとの向き・不透明度）にして、懐中電灯・霧の後処理付きの SplatMesh を作る（splatMaterial.ts）
 * 6. 同じ形のメッシュも作る（meshes.ts。形の関数を走らせたときに曲面ごとの三角形とテクスチャを書き足してある）
 */
import * as THREE from 'three';
import type { SplatMesh } from '@sparkjsdev/spark';
import { DYNAMIC_LIGHT_SCALE } from '../../../../v2/client/world/FloorBuilder.ts';
import type { MaterialLibrary } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { CellLayout } from '../../../../v2/core/world/layout.ts';
import type { SplatBatch } from '../facegen.ts';
import { envAdd, type ShEnv, type ShInput, type ShLight, type ShMaterial, type ShParams } from '../sh.ts';
import type { ShPool } from '../shPool.ts';
import { buildExtSplats, buildMaterialTexture } from '../splatbuild.ts';
import type { SplatLighting } from '../splatMaterial.ts';
import { ENV_H, ENV_LEVELS, ENV_W, envProbe } from '../env.ts';
import { meshRecordStats, Rand, Surfels } from './surfel.ts';
import type { Exhibit } from './layout.ts';
import { bakePoints, exhibitLighting, nextTask } from './bake.ts';
import { buildRoomMeshes, type RoomMeshes } from './meshes.ts';

export { nextTask };

/** 環境マップの拡散の倍率（v2 の MaterialLibrary の liminalIblDiffuse） */
const IBL_DIFFUSE = 0.12;

/** 部屋の環境マップ（v2 の材質から借りる。envMapIntensity は v2 の既定の材質の値） */
export interface EnvSource { texture: THREE.Texture; intensity: number }

export interface RoomSplats {
  room: string;
  mesh: SplatMesh;
  batch: SplatBatch & { opacities: Float32Array };
  input: ShInput;
  lights: ShLight[];
  env: ShEnv | null;
  matTex: THREE.DataArrayTexture;
  /** 展示物ごとの粒の範囲 */
  ranges: Map<string, [number, number]>;
  glossy: number;
  /** gen は形の関数の全体、meshGen はそのうち同じ形のメッシュの曲面（格子とテクスチャ）にかかった分 */
  ms: { gen: number; meshGen: number; bake: number; sh: number; total: number };
  /** 同じ形のメッシュ（メッシュ表示） */
  meshes: RoomMeshes | null;
}

export interface BuildContext {
  renderer: THREE.WebGLRenderer;
  pool: ShPool;
  lighting: SplatLighting;
  params: ShParams;
  env: EnvSource | null;
  /** v2 の材質（同じ形のメッシュに v2 の注入を施す） */
  materials: MaterialLibrary;
}

/** 文字列 → 乱数の種 */
const seedOf = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/**
 * 材質表（Look.mat の番号）: 0 つや消し・1 プラスチック・2 陶器（釉薬 = クリアコート）・3 金属・4 透ける物（ペットボトル・ガラス）。
 * 映り込みの強さは v2 の既定の材質と同じ（envMapIntensity）を基準にする
 */
function materials(env: EnvSource | null): ShMaterial[] {
  const e = env ? 0 : -1, k = env?.intensity ?? 0;
  return [
    { env: e, envIntensity: k, clearcoat: 0, clearcoatRoughness: 0 },
    { env: e, envIntensity: k, clearcoat: 0.25, clearcoatRoughness: 0.2 },
    { env: e, envIntensity: k, clearcoat: 0.9, clearcoatRoughness: 0.06 },
    { env: e, envIntensity: k * 1.5, clearcoat: 0, clearcoatRoughness: 0 },
    { env: e, envIntensity: k, clearcoat: 1, clearcoatRoughness: 0.04 },
  ];
}

/** 部屋の点光源（v2 の動的な PointLight と同じ強さ。区画と、扉の無い開口でつながる隣の区画の照明） */
function pointLights(cell: CellLayout, neighbors: CellLayout[]): ShLight[] {
  const c = new THREE.Color();
  return [...cell.lights, ...neighbors.flatMap((n) => n.lights)].map((l) => {
    c.set(l.color);
    const k = l.intensity * DYNAMIC_LIGHT_SCALE;
    return { x: l.pos[0], y: l.pos[1], z: l.pos[2], r: c.r * k, g: c.g * k, b: c.b * k, distance: l.distance };
  });
}

/** 部屋 1 つ分の展示物を粒にする */
export async function buildRoom(ctx: BuildContext, cell: CellLayout, neighbors: CellLayout[], exhibits: Exhibit[], progress?: (msg: string) => void): Promise<RoomSplats> {
  const t0 = performance.now();
  // 1. 形
  const S = new Surfels();
  const rec0 = meshRecordStats.ms;
  // 同じ形のメッシュの曲面も、形の関数を 1 回走らせる間に書き足す（粒と全く同じ形・乱数）
  S.patches = [];
  const ranges = new Map<string, [number, number]>();
  const patchRanges = new Map<string, [number, number]>();
  for (const e of exhibits) {
    progress?.(`${e.name} の形`);
    const from = S.n, pf = S.patches.length;
    e.gen(S, new Rand(seedOf(e.id)));
    ranges.set(e.id, [from, S.n]);
    patchRanges.set(e.id, [pf, S.patches.length]);
    await nextTask();
  }
  const n = S.n;
  const t1 = performance.now();
  const meshGen = meshRecordStats.ms - rec0;

  // 2. 焼き込み
  progress?.('焼き込み照明');
  const L = exhibitLighting(cell, neighbors);
  const baked = new Float32Array(n * 3);
  await bakePoints(L, S.center, S.normal, 0, n, baked);
  const t2 = performance.now();

  // 3. 下の層（v2 の材質の拡散と同じ式）
  let env: ShEnv | null = null;
  const table = materials(ctx.env);
  if (ctx.env) env = { levels: ENV_LEVELS, w: ENV_W, h: ENV_H, probes: [envProbe(ctx.renderer, ctx.env.texture)], materials: table, rot: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  const base = new Float32Array(n * 3);
  const ibl = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    ibl[0] = ibl[1] = ibl[2] = 0;
    if (env) envAdd(env, env.probes[0]!, S.normal[i * 3]!, S.normal[i * 3 + 1]!, S.normal[i * 3 + 2]!, 1, IBL_DIFFUSE * ctx.env!.intensity, ibl);
    const kd = 1 - S.metal[i]!;
    for (let c = 0; c < 3; c++) {
      const a = S.albedo[i * 3 + c]!;
      base[i * 3 + c] = kd * a * (baked[i * 3 + c]! / Math.PI + ibl[c]!) + S.emit[i * 3 + c]!;
    }
  }

  // 4. 見る向きで変わる色（SH）
  progress?.('つや（SH）');
  const lights = pointLights(cell, neighbors);
  const slice = <T extends Float32Array | Uint16Array | Uint32Array>(a: T, k: number): T => a.slice(0, n * k) as T;
  const input: ShInput = {
    n, center: slice(S.center, 3), dir: new Uint8Array(n), base, albedo: slice(S.albedo, 3), rough: slice(S.rough, 1), metal: slice(S.metal, 1), mat: slice(S.mat, 1),
    normal: slice(S.normal, 3), lowLayer: true,
  };
  const shade = await ctx.pool.run(input, lights, ctx.params, env);
  const t3 = performance.now();

  // 5. Spark の粒
  const batch = {
    n, center: input.center, scale: slice(S.scale, 2), dir: input.dir, base, albedo: input.albedo, rough: input.rough, metal: input.metal, mat: input.mat,
    quat: slice(S.quat, 1), opacity: 1, opacities: slice(S.opacity, 1),
  };
  const matTex = buildMaterialTexture(batch);
  const mesh = ctx.lighting.createMesh(buildExtSplats(batch, shade), matTex, `splat-showroom:${cell.id}`, null);
  const t4 = performance.now();

  // 6. 同じ形のメッシュ
  progress?.('同じ形のメッシュ');
  let meshes: RoomMeshes | null = null;
  try {
    meshes = await buildRoomMeshes(S.patches, patchRanges, L, ctx.materials, ctx.renderer, `splat-showroom-mesh:${cell.id}`);
  } catch (e) {
    console.error('[showroom] メッシュを作れなかった', cell.id, e);
  }
  S.patches = null;
  return { room: cell.id, mesh, batch, input, lights, env, matTex, ranges, glossy: shade.glossy, ms: { gen: t1 - t0, meshGen, bake: t2 - t1, sh: t3 - t2, total: t4 - t0 }, meshes };
}

/** つや・粗さ・SH の段数を変えた: 粒の形と焼き込みはそのまま、SH だけ計算し直して SplatMesh を作り直す */
export async function reshadeRoom(ctx: BuildContext, r: RoomSplats): Promise<SplatMesh> {
  const shade = await ctx.pool.run(r.input, r.lights, ctx.params, r.env);
  r.glossy = shade.glossy;
  return ctx.lighting.createMesh(buildExtSplats(r.batch, shade), r.matTex, `splat-showroom:${r.room}`, null);
}
