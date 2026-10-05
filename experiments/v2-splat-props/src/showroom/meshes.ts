/**
 * 同じ形のメッシュ（見本の部屋の「メッシュ」表示）。スプラットと同じ形の関数が surface() で書き足した曲面（MeshPatch）から作る。
 *
 * - 形: 曲面ごとの三角形の格子（頂点は粒の間隔の 2.5 倍。曲がり具合は頂点の法線で滑らかに）
 * - 色: 粒と同じ細かさのテクスチャ（地の色 + 不透明度・粗さと金属度・光る分）。部屋ごとに 1 枚のアトラス（大きければ数枚）に詰める
 * - 明るさ: v2 の材質そのもの（MaterialLibrary.adoptExternal で焼き込み光・霧・色が抜ける異変・診断の注入を施す）。
 *   頂点に v2 の焼き込み照明（bakedLight）を焼く。点光源・懐中電灯・環境マップの映り込み・GTAO は v2 の描画がそのまま掛ける
 * - 材質は粒の材質の番号ごと（つや消し・プラスチック・陶器・金属・透ける物）。陶器・透ける物はクリアコート（MeshPhysicalMaterial）
 * スプラットとの違い（形の関数では同じでも出ない物）: ぬいぐるみの毛羽（粒だけで作った）、粒の縁の柔らかさ
 */
import * as THREE from 'three';
import type { MaterialLibrary } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { SurfaceLighting } from '../../../../v2/client/render/SurfaceGeometry.ts';
import { bakePoints, nextTask } from './bake.ts';
import type { MeshPatch } from './surfel.ts';

const PAGE_W = 2048, PAGE_MAX_H = 4096, PAD = 2;

/** 材質の番号ごとのクリアコート（light.ts の SH の材質表と同じ値） */
const COAT: { cc: number; ccr: number }[] = [
  { cc: 0, ccr: 0 },
  { cc: 0.25, ccr: 0.2 },
  { cc: 0.9, ccr: 0.06 },
  { cc: 0, ccr: 0 },
  { cc: 1, ccr: 0.04 },
];

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

interface Placed { page: number; x: number; y: number }

/** 曲面のテクスチャをアトラスに詰める（高さの順に棚へ並べる） */
function pack(patches: MeshPatch[]): { at: Map<MeshPatch, Placed>; pages: { w: number; h: number }[] } {
  const own = patches.filter((p) => !p.share).sort((a, b) => b.texH - a.texH);
  const at = new Map<MeshPatch, Placed>();
  const pages: { w: number; h: number }[] = [{ w: PAGE_W, h: 0 }];
  let x = 0, y = 0, shelf = 0;
  for (const p of own) {
    const w = p.texW + PAD * 2, h = p.texH + PAD * 2;
    if (x + w > PAGE_W) { y += shelf; x = 0; shelf = 0; }
    if (y + h > PAGE_MAX_H) { pages.push({ w: PAGE_W, h: 0 }); x = 0; y = 0; shelf = 0; }
    const page = pages.length - 1;
    at.set(p, { page, x, y });
    x += w;
    shelf = Math.max(shelf, h);
    pages[page]!.h = Math.max(pages[page]!.h, y + h);
  }
  for (const p of pages) p.h = Math.max(4, Math.ceil(p.h / 4) * 4);
  for (const p of patches) if (p.share) at.set(p, at.get(p.share)!);
  return { at, pages };
}

const srgb = (c: number): number => {
  const v = Math.max(0, Math.min(1, c));
  return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
};

function dataTexture(data: Uint8Array, w: number, h: number, color: boolean, aniso: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/**
 * 部屋 1 つ分の曲面からメッシュを作る。ranges は展示物ごとの曲面の範囲（patches の添字）。
 * L が null なら焼き込みはせず、頂点の焼き込み光を一定の値にする（動く物。v2 と同じく後から relightMeshes で当て直す）
 */
export async function buildRoomMeshes(patches: MeshPatch[], ranges: Map<string, [number, number]>, L: SurfaceLighting | null, materials: MaterialLibrary, renderer: THREE.WebGLRenderer, name: string): Promise<RoomMeshes> {
  const t0 = performance.now();
  const { at, pages } = pack(patches);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // 1. テクスチャ（地の色 + 不透明度 / 粗さ・金属度 / 光る分）
  let maxEmit = 0;
  for (const p of patches) if (p.look.emit) maxEmit = Math.max(maxEmit, ...p.look.emit);
  const tex = pages.map((pg) => ({
    albedo: new Uint8Array(pg.w * pg.h * 4),
    orm: new Uint8Array(pg.w * pg.h * 4),
    emit: maxEmit > 0 ? new Uint8Array(pg.w * pg.h * 4) : null,
  }));
  for (const p of patches) {
    if (p.share) continue;
    const pl = at.get(p)!, pg = pages[pl.page]!, T = tex[pl.page]!;
    const alpha = Math.round(Math.min(1, p.look.opacity) * 255);
    const metal = Math.round(p.look.metal * 255);
    const e = p.look.emit;
    const er = e ? srgb(e[0] / maxEmit) : 0, eg = e ? srgb(e[1] / maxEmit) : 0, eb = e ? srgb(e[2] / maxEmit) : 0;
    // 余白（PAD）は端の texel を伸ばす（縮小したときに隣の曲面の色が混ざりにくいように）
    for (let j = -PAD; j < p.texH + PAD; j++) {
      const sj = Math.max(0, Math.min(p.texH - 1, j));
      for (let i = -PAD; i < p.texW + PAD; i++) {
        const si = Math.max(0, Math.min(p.texW - 1, i));
        const k = sj * p.texW + si;
        const o = ((pl.y + PAD + j) * pg.w + (pl.x + PAD + i)) * 4;
        T.albedo[o] = srgb(p.albedo[k * 3]!); T.albedo[o + 1] = srgb(p.albedo[k * 3 + 1]!); T.albedo[o + 2] = srgb(p.albedo[k * 3 + 2]!); T.albedo[o + 3] = alpha;
        T.orm[o] = 255; T.orm[o + 1] = Math.round(Math.max(0.03, Math.min(1, p.rough[k]!)) * 255); T.orm[o + 2] = metal; T.orm[o + 3] = 255;
        if (T.emit) { T.emit[o] = er; T.emit[o + 1] = eg; T.emit[o + 2] = eb; T.emit[o + 3] = 255; }
      }
    }
  }
  const textures = tex.map((T, i) => ({
    map: dataTexture(T.albedo, pages[i]!.w, pages[i]!.h, true, aniso),
    orm: dataTexture(T.orm, pages[i]!.w, pages[i]!.h, false, aniso),
    emit: T.emit ? dataTexture(T.emit, pages[i]!.w, pages[i]!.h, true, aniso) : null,
  }));
  await nextTask();

  // 2. 形（アトラスの頁 × 材質の番号 × 透けるか でまとめる）
  const groups = new Map<string, { page: number; mat: number; clear: boolean; list: MeshPatch[] }>();
  for (const p of patches) {
    const pl = at.get(p)!;
    const clear = p.look.opacity < 1;
    const key = `${pl.page}|${p.look.mat}|${clear}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { page: pl.page, mat: p.look.mat, clear, list: [] });
    g.list.push(p);
  }
  const root = new THREE.Group();
  root.name = name;
  let triangles = 0, vertices = 0, bytes = 0;
  for (const [key, g] of groups) {
    const nv = g.list.reduce((a, p) => a + p.pos.length / 3, 0);
    const ni = g.list.reduce((a, p) => a + p.index.length, 0);
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), index = new Uint32Array(ni);
    let vo = 0, io = 0;
    const pg = pages[g.page]!;
    for (const p of g.list) {
      const pl = at.get(p)!;
      const n = p.pos.length / 3;
      pos.set(p.pos, vo * 3);
      nor.set(p.nor, vo * 3);
      for (let k = 0; k < n; k++) {
        uv[(vo + k) * 2] = (pl.x + PAD + p.uv[k * 2]! * p.texW) / pg.w;
        uv[(vo + k) * 2 + 1] = (pl.y + PAD + p.uv[k * 2 + 1]! * p.texH) / pg.h;
      }
      for (let k = 0; k < p.index.length; k++) index[io + k] = p.index[k]! + vo;
      vo += n;
      io += p.index.length;
    }
    const baked = new Float32Array(nv * 3);
    if (L) await bakePoints(L, pos, nor, 0, nv, baked); else baked.fill(0.6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('bakedLight', new THREE.BufferAttribute(baked, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    const T = textures[g.page]!;
    const coat = COAT[g.mat] ?? COAT[0]!;
    const params: THREE.MeshStandardMaterialParameters = {
      map: T.map, roughnessMap: T.orm, metalnessMap: T.orm, roughness: 1, metalness: 1,
      transparent: g.clear, depthWrite: !g.clear, side: THREE.FrontSide,
      ...(T.emit ? { emissiveMap: T.emit, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: maxEmit } : {}),
    };
    const base = coat.cc > 0 ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: coat.cc, clearcoatRoughness: coat.ccr }) : new THREE.MeshStandardMaterial(params);
    const mat = materials.adoptExternal(base);
    base.dispose();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${name}|${key}`;
    if (g.clear) mesh.renderOrder = 1;
    root.add(mesh);
    triangles += ni / 3;
    vertices += nv;
    bytes += nv * (12 + 12 + 8 + 12) + ni * 4;
  }
  for (const pg of pages) bytes += pg.w * pg.h * 4 * (maxEmit > 0 ? 3 : 2) * (4 / 3);
  const trianglesOf = new Map<string, number>();
  for (const [id, [from, to]] of ranges) {
    let t = 0;
    for (let i = from; i < to; i++) t += patches[i]!.index.length / 3;
    trianglesOf.set(id, t);
  }
  return { group: root, triangles, vertices, trianglesOf, pages, bytes, ms: performance.now() - t0 };
}

/** 動く物: メッシュの組の焼き込み光を一定の色にする（v2 の Parts.relight と同じ） */
export function relightMeshes(root: THREE.Object3D, rgb: [number, number, number]): void {
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    const a = g?.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
    if (!a) return;
    const arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
    a.needsUpdate = true;
  });
}

/** 同じ形の写し（位置・法線・UV・三角形は共有し、焼き込み光だけ別に持つ。材質も共有） */
export function instanceOf(src: THREE.Object3D): THREE.Object3D {
  const copy = (o: THREE.Object3D): THREE.Object3D => {
    let out: THREE.Object3D;
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const sg = m.geometry as THREE.BufferGeometry;
      const g = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'uv']) { const a = sg.getAttribute(k); if (a) g.setAttribute(k, a); }
      if (sg.index) g.setIndex(sg.index);
      const baked = sg.getAttribute('bakedLight') as THREE.BufferAttribute;
      g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(baked.array as Float32Array), 3));
      g.boundingSphere = sg.boundingSphere?.clone() ?? null;
      const mm = new THREE.Mesh(g, m.material);
      mm.renderOrder = m.renderOrder;
      out = mm;
    } else out = new THREE.Group();
    out.name = o.name;
    out.position.copy(o.position); out.quaternion.copy(o.quaternion); out.scale.copy(o.scale);
    for (const c of o.children) out.add(copy(c));
    return out;
  };
  return copy(src);
}

/** instanceOf の写しを捨てる（焼き込み光の属性だけ。共有の部分は残す） */
export function disposeInstance(root: THREE.Object3D): void {
  // 共有の属性・三角形は外してから捨てる（GPU の共有の buffer を消さないように）
  root.traverse((o) => { const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; if (g) { for (const k of ['position', 'normal', 'uv']) g.deleteAttribute(k); g.setIndex(null); g.dispose(); } });
}

