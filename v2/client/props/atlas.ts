/**
 * 形の関数が書いた曲面（MeshPatch）を、描画にそのまま渡せる配列にまとめる（three.js を使わない。Worker でも動く）。
 *
 * - テクスチャ: 曲面ごとの模様を 1 枚（大きければ数枚）のアトラスに詰める。地の色 + 不透明度（sRGB）・粗さと金属度・光る分
 * - 形: アトラスの頁 × 材質の番号 × 透けるか でまとめた頂点（位置・法線・UV）と三角形の番号
 * 焼き込み光（bakedLight）は別に足す（bake.ts）。
 */
import type { MeshPatch } from './shape.ts';

/** アトラスの頁の大きさ（高さは 1024 まで: 1 頁ずつ GPU へ載せるので、1 フレームの止まりを小さく） */
const PAGE_W = 2048, PAGE_MAX_H = 1024, PAD = 2;

export interface AtlasPage {
  w: number;
  h: number;
  /** 地の色（sRGB）+ 不透明度 */
  albedo: Uint8Array;
  /** 粗さ（G）・金属度（B）。R は 1（遮蔽は使わない） */
  orm: Uint8Array;
  /** 光る分（sRGB。maxEmit で割った値）。光る曲面が無ければ null */
  emit: Uint8Array | null;
}

export interface MeshGroup {
  page: number;
  /** 材質の番号（Look.mat） */
  mat: number;
  /** 透ける（不透明度 < 1） */
  clear: boolean;
  pos: Float32Array;
  nor: Float32Array;
  uv: Float32Array;
  index: Uint16Array | Uint32Array;
  /** 頂点の焼き込み光（RGB）。焼く前は null */
  baked: Float32Array | null;
}

export interface PropMeshData {
  pages: AtlasPage[];
  /** 光る分の強さ（テクスチャの 1 = この値） */
  maxEmit: number;
  groups: MeshGroup[];
  triangles: number;
  vertices: number;
  /** GPU に置く量（頂点・三角形の番号・テクスチャ。ミップマップ込み。計算値） */
  bytes: number;
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
  // 幅は使った分まで（小さな物は 2048 も要らない）。高さ・幅とも 4 の倍数
  const usedW = new Array<number>(pages.length).fill(0);
  for (const p of own) { const pl = at.get(p)!; usedW[pl.page] = Math.max(usedW[pl.page]!, pl.x + p.texW + PAD * 2); }
  pages.forEach((pg, i) => { pg.w = Math.max(4, Math.ceil(usedW[i]! / 4) * 4); pg.h = Math.max(4, Math.ceil(pg.h / 4) * 4); });
  for (const p of patches) if (p.share) at.set(p, at.get(p.share)!);
  return { at, pages };
}

const srgb = (c: number): number => {
  const v = Math.max(0, Math.min(1, c));
  return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
};

/** 曲面の並びを、描画に渡す配列にまとめる */
export function buildMeshData(patches: MeshPatch[]): PropMeshData {
  const { at, pages } = pack(patches);
  let maxEmit = 0;
  for (const p of patches) if (p.look.emit) maxEmit = Math.max(maxEmit, ...p.look.emit);
  const out: AtlasPage[] = pages.map((pg) => ({ w: pg.w, h: pg.h, albedo: new Uint8Array(pg.w * pg.h * 4), orm: new Uint8Array(pg.w * pg.h * 4), emit: maxEmit > 0 ? new Uint8Array(pg.w * pg.h * 4) : null }));
  for (const p of patches) {
    if (p.share) continue;
    const pl = at.get(p)!, T = out[pl.page]!;
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
        const o = ((pl.y + PAD + j) * T.w + (pl.x + PAD + i)) * 4;
        T.albedo[o] = srgb(p.albedo[k * 3]!); T.albedo[o + 1] = srgb(p.albedo[k * 3 + 1]!); T.albedo[o + 2] = srgb(p.albedo[k * 3 + 2]!); T.albedo[o + 3] = alpha;
        T.orm[o] = 255; T.orm[o + 1] = Math.round(Math.max(0.03, Math.min(1, p.rough[k]!)) * 255); T.orm[o + 2] = metal; T.orm[o + 3] = 255;
        if (T.emit) { T.emit[o] = er; T.emit[o + 1] = eg; T.emit[o + 2] = eb; T.emit[o + 3] = 255; }
      }
    }
  }
  // 形（頁 × 材質の番号 × 透けるか）
  const byKey = new Map<string, { page: number; mat: number; clear: boolean; list: MeshPatch[] }>();
  for (const p of patches) {
    const pl = at.get(p)!;
    const clear = p.look.opacity < 1;
    const key = `${pl.page}|${p.look.mat}|${clear}`;
    let g = byKey.get(key);
    if (!g) byKey.set(key, g = { page: pl.page, mat: p.look.mat, clear, list: [] });
    g.list.push(p);
  }
  const groups: MeshGroup[] = [];
  let triangles = 0, vertices = 0, bytes = 0;
  for (const g of byKey.values()) {
    const nv = g.list.reduce((a, p) => a + p.pos.length / 3, 0);
    const ni = g.list.reduce((a, p) => a + p.index.length, 0);
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const index = nv < 65536 ? new Uint16Array(ni) : new Uint32Array(ni);
    let vo = 0, io = 0;
    const T = out[g.page]!;
    for (const p of g.list) {
      const pl = at.get(p)!;
      const cnt = p.pos.length / 3;
      pos.set(p.pos, vo * 3);
      nor.set(p.nor, vo * 3);
      for (let k = 0; k < cnt; k++) {
        uv[(vo + k) * 2] = (pl.x + PAD + p.uv[k * 2]! * p.texW) / T.w;
        uv[(vo + k) * 2 + 1] = (pl.y + PAD + p.uv[k * 2 + 1]! * p.texH) / T.h;
      }
      for (let k = 0; k < p.index.length; k++) index[io + k] = p.index[k]! + vo;
      vo += cnt;
      io += p.index.length;
    }
    groups.push({ page: g.page, mat: g.mat, clear: g.clear, pos, nor, uv, index, baked: null });
    triangles += ni / 3;
    vertices += nv;
    bytes += nv * (12 + 12 + 8 + 12) + ni * index.BYTES_PER_ELEMENT;
  }
  for (const pg of out) bytes += pg.w * pg.h * 4 * (pg.emit ? 3 : 2) * (4 / 3);
  return { pages: out, maxEmit, groups, triangles, vertices, bytes };
}

/** Worker から送るときに移す（写さない）配列 */
export function transferablesOf(d: PropMeshData): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const p of d.pages) { out.push(p.albedo.buffer as ArrayBuffer, p.orm.buffer as ArrayBuffer); if (p.emit) out.push(p.emit.buffer as ArrayBuffer); }
  for (const g of d.groups) { out.push(g.pos.buffer as ArrayBuffer, g.nor.buffer as ArrayBuffer, g.uv.buffer as ArrayBuffer, g.index.buffer as ArrayBuffer); if (g.baked) out.push(g.baked.buffer as ArrayBuffer); }
  return out;
}
