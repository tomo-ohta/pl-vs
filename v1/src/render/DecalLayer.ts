/**
 * デカール層（担当 D）: generators/decals.ts が RoomLayout に置いた DecalItem（`L.decalItems`）を、面から数 mm 浮かせた半透明の四角形として描く。
 * RoomBuilder.build から 1 回呼ばれる。
 *
 * - 描き方: 1 アイテム = 四角形 1 枚（4 頂点 / 2 三角形）。同じチャンク × アトラス × 発光の組で 1 つの BufferGeometry / Mesh に結合する。
 *   材質は DecalAtlas.material（MeshStandardMaterial: map = RGBA アトラス、transparent、depthWrite false、polygonOffset。
 *   MaterialLibrary.adoptExternal で焼き込み光・部屋別霧・色欠損の注入を受ける）。誘導灯だけ発光材質。
 * - 焼き込み光: 頂点属性 bakedLight。SurfaceLighting.bake を 4 頂点の使い捨てジオメトリに対して「面から 0.45 m 離した点」で評価する
 *   （母面を接触陰影の遮蔽体として数えないため。ランバート・遮蔽・床際の暗さは母面と同じ規則）。箱が非常に多い部屋（> 1,200）の汚れ系は bake.sample。
 * - 透明度: 頂点色（RGBA）の alpha でアイテムごとに調整する（material.vertexColors）。
 * - Tier: tier.decals=false（low）では汚れ系（grime）を省き、設備・誘導灯・貼り紙だけ描く。
 * - E03 ロール（roll）/ legacy / untextured の部屋では何も描かない。
 * - mirrorIfReturn: そのソケットの Portal が戻り側（isReturn）なら、ソケット中心を通る面で左右を鏡像にする（扉パネルの取っ手側に合わせる）。
 */
import * as THREE from 'three';
import type { QualityTier, RoomDefinition, RoomInstance, Vec3 } from '../core/types';
import type { Box, RoomLayout } from '../generators/layout';
import { decalItemsOf, type DecalItem } from '../generators/decals';
import { SURFACES, type ExternalOverrides, type MaterialLibrary } from './MaterialLibrary';
import type { RoomEffect } from './RoomBuilder';
import type { SurfaceLighting } from './SurfaceGeometry';
import { getDecalAtlas, prewarmDecalAtlas, type DecalAtlas } from './DecalAtlas';

export interface DecalLayerContext {
  node: RoomInstance;
  layout: RoomLayout;
  definition: RoomDefinition | null;
  group: THREE.Group;
  chunkGroups: THREE.Group[];
  chunkIndexOf: (x: number, z: number) => number;
  placement: NonNullable<RoomInstance['placement']>;
  tier: QualityTier;
  materials: MaterialLibrary;
  bake: SurfaceLighting;
  legacy: boolean;
  untextured: boolean;
  roll: boolean;
}

/** 既定の浮かせ量（m） */
const LIFT = 0.004;
/** 焼き込みの評価点を面から離す距離（接触陰影の 0.45 m の外） */
const BAKE_LIFT = 0.46;
/** 箱がこれより多い部屋では汚れ系の焼き込みを bake.sample に切り替える（遮蔽判定のコスト抑制） */
const HEAVY_BOXES = 1200;

interface Bucket {
  chunk: number;
  atlas: 0 | 1;
  emissive: boolean;
  pos: number[];
  nrm: number[];
  uv: number[];
  col: number[];
  light: number[];
  idx: number[];
  quads: number;
}

// ブラウザではモジュール読込時にアトラスの描画を予約する（最初の部屋の構築時間に含めない）
prewarmDecalAtlas();

export function buildDecalLayer(ctx: DecalLayerContext): { triangles: number; effects: RoomEffect[] } {
  const none = { triangles: 0, effects: [] as RoomEffect[] };
  const items = decalItemsOf(ctx.layout);
  if (!items.length || ctx.roll || ctx.legacy || ctx.untextured) return none;
  const atlas = getDecalAtlas();
  if (!atlas) return none;

  const showGrime = ctx.tier.decals;
  const heavy = ctx.layout.boxes.length > HEAVY_BOXES;
  const overrides: ExternalOverrides = {};
  if (ctx.layout.render?.fog) overrides.fog = ctx.layout.render.fog;
  if (ctx.layout.render?.colorMask) overrides.colorMask = ctx.layout.render.colorMask;

  // 汚れの見え方は母面の明るさで決まる: 明るい床・壁（タイル・白壁）は HDR で 1 を超え、トーンマップ後に 50% の暗い重ねでも
  // ほとんど差が出ない。母面（パレットの床 / 壁 / 天井）の材質色の輝度でアルファを増幅する（暗いカーペット ×1.2、白タイル ×1.9）
  const pal = ctx.layout.palette;
  const lum = (id: keyof typeof SURFACES): number => {
    const c = SURFACES[id]?.color ?? 0x808080;
    const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const grimeGain = { floor: 1 + lum(pal.floor) * 0.9, wall: 1 + lum(pal.wall) * 0.9, ceiling: 1 + lum(pal.ceiling) * 0.9 };

  const buckets = new Map<string, Bucket>();
  const probe = new THREE.BufferGeometry();
  probe.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  probe.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(12), 3));
  const own: Box = { min: [0, 0, 0], max: [0, 0, 0], mat: 'shadowDecal', solid: false };

  const corners: Vec3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let quads = 0;
  for (const item of items) {
    if (item.grime && !showGrime) continue;
    const cell = atlas.cell(item.kind, item.variant ?? 0);
    const n = item.normal;
    const u = item.tangent;
    // v = n × u
    const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    let pos = item.pos;
    if (item.mirrorIfReturn) pos = mirrorForReturn(ctx, item, pos);
    const lift = item.offset ?? LIFT;
    const cx = pos[0] + n[0] * lift, cy = pos[1] + n[1] * lift, cz = pos[2] + n[2] * lift;
    const hw = item.size[0] / 2, hh = item.size[1] / 2;
    // c0 (-u,-v) → uv(0,0) / c1 (+u,-v) → (1,0) / c2 (+u,+v) → (1,1) / c3 (-u,+v) → (0,1)
    const su = [-1, 1, 1, -1], sv = [-1, -1, 1, 1];
    for (let k = 0; k < 4; k++) {
      corners[k][0] = cx + u[0] * hw * su[k] + v[0] * hh * sv[k];
      corners[k][1] = cy + u[1] * hw * su[k] + v[1] * hh * sv[k];
      corners[k][2] = cz + u[2] * hw * su[k] + v[2] * hh * sv[k];
    }
    // 焼き込み光
    const light = bakeQuad(ctx.bake, probe, own, corners, n, heavy && !!item.grime);
    const ci = ctx.chunkIndexOf(cx, cz);
    const key = `${ci}|${cell.atlas}|${item.emissive ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, b = { chunk: ci, atlas: cell.atlas, emissive: !!item.emissive, pos: [], nrm: [], uv: [], col: [], light: [], idx: [], quads: 0 });
    const base = b.quads * 4;
    const gain = item.grime ? (n[1] > 0.5 ? grimeGain.floor : n[1] < -0.5 ? grimeGain.ceiling : grimeGain.wall) : 1;
    const alpha = Math.max(0, Math.min(1, (item.alpha ?? 1) * gain));
    const uu = item.flip ? [cell.u1, cell.u0, cell.u0, cell.u1] : [cell.u0, cell.u1, cell.u1, cell.u0];
    const vv = [cell.v0, cell.v0, cell.v1, cell.v1];
    for (let k = 0; k < 4; k++) {
      b.pos.push(corners[k][0], corners[k][1], corners[k][2]);
      b.nrm.push(n[0], n[1], n[2]);
      b.uv.push(uu[k], vv[k]);
      b.col.push(1, 1, 1, alpha);
      b.light.push(light[k * 3], light[k * 3 + 1], light[k * 3 + 2]);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    b.quads++;
    quads++;
  }
  probe.dispose();
  if (!quads) return none;

  for (const b of buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 4));
    g.setAttribute('bakedLight', new THREE.Float32BufferAttribute(b.light, 3));
    g.setIndex(b.idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, atlas.material(ctx.materials, b.atlas, b.emissive, overrides));
    mesh.name = `decals/${b.atlas === 0 ? (b.emissive ? 'emissive' : 'fixtures') : 'grime'}`;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.frustumCulled = true;
    // 汚れは母面の直後、設備・紙・誘導灯はその上（同じ面に重なるときの順序を固定する）
    mesh.renderOrder = b.atlas === 1 ? 1 : 2;
    (ctx.chunkGroups[b.chunk] ?? ctx.group).add(mesh);
  }
  return { triangles: quads * 2, effects: [] };
}

/** ソケットの Portal が戻り側なら、ソケット中心を通る「法線 = tangent」の面で pos を鏡像にする */
function mirrorForReturn(ctx: DecalLayerContext, item: DecalItem, pos: Vec3): Vec3 {
  const portal = ctx.node.portals.find((p) => p.socketId === item.mirrorIfReturn);
  if (!portal?.isReturn) return pos;
  const s = ctx.layout.sockets.find((x) => x.id === item.mirrorIfReturn);
  if (!s) return pos;
  const t = item.tangent;
  const d = (pos[0] - s.pos[0]) * t[0] + (pos[1] - s.pos[1]) * t[1] + (pos[2] - s.pos[2]) * t[2];
  return [pos[0] - 2 * d * t[0], pos[1] - 2 * d * t[1], pos[2] - 2 * d * t[2]];
}

/**
 * 四角形 4 頂点の焼き込み光。面から BAKE_LIFT 離した点で SurfaceLighting.bake を評価し（母面を接触遮蔽体として数えない）、
 * sampleOnly なら bake.sample（遮蔽なし）を法線で補正した定数。
 */
function bakeQuad(bake: SurfaceLighting, probe: THREE.BufferGeometry, own: Box, corners: Vec3[], n: Vec3, sampleOnly: boolean): Float32Array | number[] {
  if (sampleOnly) {
    const c: Vec3 = [
      (corners[0][0] + corners[2][0]) / 2 + n[0] * BAKE_LIFT,
      (corners[0][1] + corners[2][1]) / 2 + n[1] * BAKE_LIFT,
      (corners[0][2] + corners[2][2]) / 2 + n[2] * BAKE_LIFT,
    ];
    const l = bake.sample(c);
    // sample は法線を見ないので、壁 0.7 / 天井 0.45 / 床 1.0 の粗い係数で母面の明るさに寄せる
    const k = n[1] > 0.5 ? 1 : n[1] < -0.5 ? 0.45 : 0.7;
    const out: number[] = [];
    for (let i = 0; i < 4; i++) out.push(l[0] * k, l[1] * k, l[2] * k);
    return out;
  }
  const p = probe.getAttribute('position') as THREE.BufferAttribute;
  const nn = probe.getAttribute('normal') as THREE.BufferAttribute;
  own.min = [Infinity, Infinity, Infinity];
  own.max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 4; k++) {
    const x = corners[k][0] + n[0] * BAKE_LIFT, y = corners[k][1] + n[1] * BAKE_LIFT, z = corners[k][2] + n[2] * BAKE_LIFT;
    p.setXYZ(k, x, y, z);
    nn.setXYZ(k, n[0], n[1], n[2]);
    for (let a = 0; a < 3; a++) {
      const val = a === 0 ? x : a === 1 ? y : z;
      if (val < own.min[a]) own.min[a] = val;
      if (val > own.max[a]) own.max[a] = val;
    }
  }
  for (let a = 0; a < 3; a++) { own.min[a] -= 0.01; own.max[a] += 0.01; }
  bake.bake(probe, own);
  const out = probe.getAttribute('bakedLight').array as Float32Array;
  return out;
}

export type { DecalAtlas };
