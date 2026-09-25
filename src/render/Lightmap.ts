/**
 * テクセル単位のライトマップ（担当 L1）: アトラス割当・uv1・DataTexture・Web Worker との通信・キャンセル。
 *
 * 流れ（RoomBuilder.build）:
 *  1. 対象の箱（外殻 = 床・天井・壁の内面、対角 2 m 以上のソリッド家具）の 6 面ごとにアトラス矩形を割り当てる
 *     （`allocateLightmapAtlas`。テクセル 0.25 m（high）/ 0.5 m（mid）。maxSize² を超える巨大部屋はテクセルを粗くする）。
 *  2. 結合前の各箱ジオメトリに `uv1` を書く（`writeLightmapUV`。対象外の面・箱は常に 0 のテクセルを指す）。
 *  3. 部屋の DataTexture（RGBA HalfFloat、0 埋め）を作り、`materials.forRoom(mat, { lightMap })` の材質を結合メッシュへ付ける。
 *     到着前は lightMap = 0 なので従来の頂点焼き込み（bakedLight）だけで描かれる。
 *  4. Worker（`lightmap.worker.ts`）へ面矩形 + 遮蔽体 + 器具 + 環境光を転送。届いたらテクスチャの中身を差し替え
 *     （`texture.needsUpdate`）、ライトマップ対象の頂点の bakedLight を 0 にする（二重加算を避ける）。材質・ジオメトリの再構築は無い。
 *  5. 部屋が dispose されたら job を cancel し、テクスチャを dispose する。Worker の結果は捨てる。
 *
 * Worker が無い環境（Node の seam-stats、`typeof Worker === 'undefined'`）では `lightmapsSupported()` が false になり、
 * RoomBuilder は頂点焼き込みだけで動く。
 */
import * as THREE from 'three';
import type { AABB } from '../core/aabb';
import type { Box } from '../generators/layout';
import { inFootprint, type Rect } from '../generators/footprint';
import { FACE_STRIDE, fromHalf, type BakeRequest, type BakeResult } from './lightmap.worker';

export interface FaceRect { px: number; py: number; pw: number; ph: number }

export interface LightmapAtlas {
  width: number;
  height: number;
  /** 実際に使ったテクセルの一辺（m）。要求より粗くなることがある */
  texel: number;
  /** targets[i] の 6 面（BoxGeometry の materialIndex 順: +x, -x, +y, -y, +z, -z）。null = 頂点焼き込みのまま */
  rects: (FaceRect | null)[][];
  /** Worker へ渡す面の packed 配列 */
  faces: Float32Array;
  faceCount: number;
  /** 常に 0 のテクセルの uv（対象外の頂点はここを指す） */
  blackU: number;
  blackV: number;
  /** 内側のテクセル数（縁を含まない） */
  texelCount: number;
}

export interface AtlasOptions {
  texel: number;
  maxSize: number;
  footprint: Rect[];
  bounds: AABB;
  /** 外殻の箱（床・天井・壁）。家具の底面・スラブの外側の面など、外殻の中に埋まる面を捨てる判定に使う */
  shell: Box[];
}

const MIN_FACE_AREA = 0.02;
const MIN_ATLAS = 16;

/** ライトマップの対象にする箱か（外殻・大きな家具。発光箔・ガラス・水・空・デカールは対象外） */
export function isLightmapTarget(b: Box, emission: boolean, decal: boolean): boolean {
  if (emission || decal) return false;
  if (b.mat === 'glass' || b.mat === 'water' || b.mat === 'waterShallow' || b.mat === 'waterWall' || b.mat === 'waterFilm' || /^sky/.test(b.mat) || b.mat === 'carGlass') return false;
  const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
  const diag = Math.hypot(sx, sy, sz);
  if (b.solid && diag >= 2) return true;
  // 外殻らしい箱（材質が床 / 天井 / 壁 / 柱で、最大面 1 m² 以上）。shellCount が無い旧式 Generator にも効く
  if (/^(floor|ceiling|wall|column)/.test(b.mat) && Math.max(sx * sy, sy * sz, sx * sz) >= 1) return true;
  return false;
}

interface PendingRect { t: number; m: number; w: number; h: number; pw: number; ph: number; x: number; y: number }

/** 面矩形のアトラス割当（shelf packing）。収まらなければテクセルを粗くして再試行し、それでも無理なら null */
export function allocateLightmapAtlas(targets: Box[], opts: AtlasOptions): LightmapAtlas | null {
  let texel = opts.texel;
  const faces: { t: number; m: number; w: number; h: number }[] = [];
  const b = opts.bounds;
  const pt: [number, number, number] = [0, 0, 0];
  for (let t = 0; t < targets.length; t++) {
    const box = targets[t];
    const size = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
    for (let m = 0; m < 6; m++) {
      const a = m >> 1, sign = m & 1 ? -1 : 1;
      const o1 = (a + 1) % 3, o2 = (a + 2) % 3;
      const w = size[o1], h = size[o2];
      if (w * h < MIN_FACE_AREA) continue;
      // 面の中心から法線方向へ 12 cm 出た点が部屋の外 / スラブの中なら見えない面
      pt[0] = (box.min[0] + box.max[0]) / 2; pt[1] = (box.min[1] + box.max[1]) / 2; pt[2] = (box.min[2] + box.max[2]) / 2;
      pt[a] = (sign > 0 ? box.max[a] : box.min[a]) + sign * 0.12;
      if (pt[1] < b.min[1] || pt[1] > b.max[1]) continue;
      if (a !== 1 && opts.footprint.length && !inFootprint(opts.footprint, pt[0], pt[2], 0.001)) continue;
      let hidden = false;
      for (const s of opts.shell) {
        if (s === box) continue;
        if (pt[0] > s.min[0] && pt[0] < s.max[0] && pt[1] > s.min[1] && pt[1] < s.max[1] && pt[2] > s.min[2] && pt[2] < s.max[2]) { hidden = true; break; }
      }
      if (hidden) continue;
      faces.push({ t, m, w, h });
    }
  }
  if (!faces.length) return null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const rects: PendingRect[] = faces.map((f) => ({ ...f, pw: Math.max(1, Math.ceil(f.w / texel - 1e-6)), ph: Math.max(1, Math.ceil(f.h / texel - 1e-6)), x: 0, y: 0 }));
    // 黒テクセル（2×2）
    rects.push({ t: -1, m: 0, w: 0, h: 0, pw: 0, ph: 0, x: 0, y: 0 });
    let area = 0, maxW = 0;
    for (const r of rects) { area += (r.pw + 2) * (r.ph + 2); maxW = Math.max(maxW, r.pw + 2); }
    let W = MIN_ATLAS;
    while (W < maxW || W * W < area * 1.15) W *= 2;
    if (W > opts.maxSize) { texel *= 1.3; continue; }
    // 高さ優先で並べる（決定論: 高さ → 幅 → 生成順）
    const order = rects.map((_, i) => i).sort((i, j) => (rects[j].ph - rects[i].ph) || (rects[j].pw - rects[i].pw) || (i - j));
    let x = 0, y = 0, shelf = 0;
    let ok = true;
    for (const i of order) {
      const r = rects[i];
      const rw = r.pw + 2, rh = r.ph + 2;
      if (x + rw > W) { y += shelf; x = 0; shelf = 0; }
      if (y + rh > opts.maxSize) { ok = false; break; }
      r.x = x; r.y = y;
      x += rw; shelf = Math.max(shelf, rh);
    }
    if (!ok) { texel *= 1.3; continue; }
    const used = y + shelf;
    let H = MIN_ATLAS;
    while (H < used) H *= 2;
    if (H > opts.maxSize) { texel *= 1.3; continue; }
    // 出力
    const out: (FaceRect | null)[][] = targets.map(() => [null, null, null, null, null, null]);
    const packed = new Float32Array(faces.length * FACE_STRIDE);
    let n = 0, texelCount = 0;
    let blackU = 0.5 / W, blackV = 0.5 / H;
    for (const r of rects) {
      if (r.t < 0) { blackU = (r.x + 1) / W; blackV = (r.y + 1) / H; continue; }
      const box = targets[r.t];
      out[r.t][r.m] = { px: r.x, py: r.y, pw: r.pw, ph: r.ph };
      const a = r.m >> 1, sign = r.m & 1 ? -1 : 1;
      const o1 = (a + 1) % 3, o2 = (a + 2) % 3;
      const o = n * FACE_STRIDE;
      packed[o] = r.x; packed[o + 1] = r.y; packed[o + 2] = r.pw; packed[o + 3] = r.ph;
      const origin = [box.min[0], box.min[1], box.min[2]];
      origin[a] = sign > 0 ? box.max[a] : box.min[a];
      packed[o + 4] = origin[0]; packed[o + 5] = origin[1]; packed[o + 6] = origin[2];
      packed[o + 7 + o1] = 1; // U 軸
      packed[o + 10 + o2] = 1; // V 軸
      packed[o + 13 + a] = sign; // 法線
      packed[o + 16] = r.w; packed[o + 17] = r.h; packed[o + 18] = -1; packed[o + 19] = 0;
      n++;
      texelCount += r.pw * r.ph;
    }
    return { width: W, height: H, texel, rects: out, faces: packed, faceCount: n, blackU, blackV, texelCount };
  }
  return null;
}

/**
 * 箱ジオメトリ（BoxGeometry / RoundedBoxGeometry、結合前・インデックス付き）に uv1 を書く。
 * 戻り値はライトマップ対象になった面の頂点範囲（インデックス空間 = toNonIndexed 後の頂点範囲）。対象外の面は黒テクセルを指す
 */
export function writeLightmapUV(g: THREE.BufferGeometry, box: Box, rects: (FaceRect | null)[], atlas: LightmapAtlas): [number, number][] {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = atlas.blackU; uv[i * 2 + 1] = atlas.blackV; }
  const ranges: [number, number][] = [];
  const W = atlas.width, H = atlas.height;
  for (const group of g.groups) {
    const m = group.materialIndex ?? 0;
    const r = rects[m];
    if (!r) continue;
    const a = m >> 1;
    const o1 = (a + 1) % 3, o2 = (a + 2) % 3;
    const w = box.max[o1] - box.min[o1], h = box.max[o2] - box.min[o2];
    const su = r.pw / Math.max(1e-6, w), sv = r.ph / Math.max(1e-6, h);
    for (let j = group.start; j < group.start + group.count; j++) {
      const vi = g.index ? g.index.getX(j) : j;
      const p1 = o1 === 0 ? pos.getX(vi) : o1 === 1 ? pos.getY(vi) : pos.getZ(vi);
      const p2 = o2 === 0 ? pos.getX(vi) : o2 === 1 ? pos.getY(vi) : pos.getZ(vi);
      const a1 = Math.min(w, Math.max(0, p1 - box.min[o1])), a2 = Math.min(h, Math.max(0, p2 - box.min[o2]));
      uv[vi * 2] = (r.px + 1 + a1 * su) / W;
      uv[vi * 2 + 1] = (r.py + 1 + a2 * sv) / H;
    }
    ranges.push([group.start, group.count]);
  }
  g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
  return ranges;
}

/** 対象外のジオメトリ: 全頂点が黒テクセルを指す uv1 */
export function writeConstantUV1(g: THREE.BufferGeometry, u: number, v: number): void {
  const n = g.getAttribute('position').count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { uv[i * 2] = u; uv[i * 2 + 1] = v; }
  g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
}

/** 部屋のライトマップ用 DataTexture（RGBA HalfFloat、0 埋め、Linear、uv1 = channel 1） */
export function createLightmapTexture(width: number, height: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint16Array(width * height * 4), width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.channel = 1;
  tex.name = 'lightmap';
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- 到着後の利用（担当 P3）: 床のサンプル / インスタンス照明 / クロスフェード

/** クロスフェードの長さ（ms）。頂点焼き込み → ライトマップ、インスタンスの定数サンプル → 床のライトマップ値 */
export const LIGHTMAP_FADE_MS = 500;

/**
 * 焼けたライトマップを CPU 側で読む（上向きの面 = 床・大きな家具の天板）。InstancedMesh / glTF プロップの足元の明るさに使う。
 * 面矩形は atlas.faces（packed）から上向き（法線 y > 0.5）だけを拾っておく
 */
export class LightmapSampler {
  private readonly up: number[] = [];
  private readonly f: Float32Array;
  private readonly atlas: LightmapAtlas;
  private readonly data: Uint16Array;
  // TS のパラメータプロパティは使わない（Node のバンドル実行で読めるように。lightmap.worker.ts と同じ方針）
  constructor(atlas: LightmapAtlas, data: Uint16Array) {
    this.atlas = atlas;
    this.data = data;
    this.f = atlas.faces;
    for (let i = 0; i < atlas.faceCount; i++) if (this.f[i * FACE_STRIDE + 14] > 0.5) this.up.push(i);
  }

  /** テクセル (u, v)（アトラス座標、連続値。テクセル中心が +0.5）の双一次補間。矩形 [px..px+pw+1] × [py..py+ph+1]（縁を含む）にクランプ */
  private bilinear(u: number, v: number, px: number, py: number, pw: number, ph: number, out: [number, number, number]): void {
    const W = this.atlas.width;
    const x = Math.min(px + pw, Math.max(px, Math.floor(u - 0.5)));
    const y = Math.min(py + ph, Math.max(py, Math.floor(v - 0.5)));
    const fx = Math.min(1, Math.max(0, u - 0.5 - x)), fy = Math.min(1, Math.max(0, v - 0.5 - y));
    const d = this.data;
    for (let c = 0; c < 3; c++) {
      const i00 = ((y) * W + x) * 4 + c, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
      const a = fromHalf(d[i00]) * (1 - fx) + fromHalf(d[i10]) * fx;
      const b = fromHalf(d[i01]) * (1 - fx) + fromHalf(d[i11]) * fx;
      out[c] = a * (1 - fy) + b * fy;
    }
  }

  /**
   * 点 (x, z) の真下（y + 0.05 以下、y − maxDrop 以上）にある最も高い上向きの面のライトマップ値。無ければ null。
   * 面の縁は 1 cm はみ出しても拾う（壁際のインスタンス）
   */
  sampleBelow(x: number, y: number, z: number, out: [number, number, number], maxDrop = 2.5): boolean {
    const f = this.f;
    let best = -1, bestY = -Infinity;
    for (const i of this.up) {
      const o = i * FACE_STRIDE;
      const oy = f[o + 5];
      if (oy > y + 0.05 || oy < y - maxDrop || oy <= bestY) continue;
      const a = (x - f[o + 4]) * f[o + 7] + (z - f[o + 6]) * f[o + 9];
      const b = (x - f[o + 4]) * f[o + 10] + (z - f[o + 6]) * f[o + 12];
      if (a < -0.01 || a > f[o + 16] + 0.01 || b < -0.01 || b > f[o + 17] + 0.01) continue;
      best = i; bestY = oy;
    }
    if (best < 0) return false;
    const o = best * FACE_STRIDE;
    const a = Math.min(f[o + 16], Math.max(0, (x - f[o + 4]) * f[o + 7] + (z - f[o + 6]) * f[o + 9]));
    const b = Math.min(f[o + 17], Math.max(0, (x - f[o + 4]) * f[o + 10] + (z - f[o + 6]) * f[o + 12]));
    const pw = f[o + 2], ph = f[o + 3];
    const u = f[o] + 1 + (a / Math.max(1e-6, f[o + 16])) * pw;
    const v = f[o + 1] + 1 + (b / Math.max(1e-6, f[o + 17])) * ph;
    this.bilinear(u, v, f[o], f[o + 1], pw, ph, out);
    return true;
  }

  /**
   * インスタンスの足元の明るさ: 底面中心 + 足跡の外周 4 点（半幅 + ring）の床のライトマップ値の平均。
   * 自分の真下（自分の AO で暗い）だけでなく周囲の床も見ることで、器具の間 / 隅 / 大きな遮蔽の影は拾い、自分の接地陰影で全体が沈むのは避ける。
   * 1 点も床が見つからなければ false
   */
  sampleFootprint(x: number, y: number, z: number, hx: number, hz: number, out: [number, number, number], ring = 0.25): boolean {
    const tmp: [number, number, number] = [0, 0, 0];
    let n = 0;
    out[0] = out[1] = out[2] = 0;
    const rx = hx + ring, rz = hz + ring;
    const pts = [[x, z], [x - rx, z - rz], [x + rx, z - rz], [x - rx, z + rz], [x + rx, z + rz]];
    for (const [px, pz] of pts) {
      if (!this.sampleBelow(px, y, pz, tmp)) continue;
      out[0] += tmp[0]; out[1] += tmp[1]; out[2] += tmp[2]; n++;
    }
    if (!n) return false;
    out[0] /= n; out[1] /= n; out[2] /= n;
    return true;
  }
}

interface InstanceEntry {
  mesh: THREE.InstancedMesh;
  attr: THREE.InstancedBufferAttribute;
  /** インスタンスごとの [x, 底面 y, z, 半幅 x, 半幅 z] */
  probes: Float32Array;
  /** フェード中の始点 / 終点（完了で捨てる） */
  from: Float32Array | null;
  to: Float32Array | null;
}

/**
 * 1 部屋の InstancedMesh（反復配置・glTF プロップ）の照明（InstancedBufferAttribute 'bakedLight' = インスタンスごとの一定値）。
 * - ライトマップ到着前: 登録時の値（SurfaceLighting.sample の定数サンプル）のまま
 * - 到着時（apply）: 各インスタンスの足元の床のライトマップ値（LightmapSampler.sampleFootprint）を目標にし、LIGHTMAP_FADE_MS で補間する。
 *   目標値には「旧値の平均 / 新値の平均」（0.5〜1.2 にクランプ）を掛け、部屋全体の明るさは変えずに位置による濃淡だけを足す
 * - 到着後の登録（遅延読込の glTF）は目標値を即書く
 * 補間は各 InstancedMesh の onBeforeRender で行う（見えているものだけ更新。属性の GPU 反映は次フレーム）
 */
export class InstanceLighting {
  private readonly entries: InstanceEntry[] = [];
  private sampler: LightmapSampler | null = null;
  private fadeStart = 0;
  /** 検証用: 旧値 / 新値の平均輝度の比 */
  ratio = 1;
  /** 検証用: 目標値を床から拾えたインスタンス数 / 全数 */
  readonly stats = { sampled: 0, total: 0 };

  register(mesh: THREE.InstancedMesh, probes: Float32Array): void {
    const attr = mesh.geometry.getAttribute('bakedLight') as THREE.InstancedBufferAttribute | undefined;
    if (!attr) return;
    const entry: InstanceEntry = { mesh, attr, probes, from: null, to: null };
    this.entries.push(entry);
    if (this.sampler) {
      const to = this.targets(entry, this.sampler, this.ratio);
      (attr.array as Float32Array).set(to);
      attr.needsUpdate = true;
    }
  }

  private targets(entry: InstanceEntry, sampler: LightmapSampler, ratio: number): Float32Array {
    const arr = entry.attr.array as Float32Array;
    const n = entry.probes.length / 5;
    const to = new Float32Array(n * 3);
    const c: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const p = i * 5;
      this.stats.total++;
      if (sampler.sampleFootprint(entry.probes[p], entry.probes[p + 1], entry.probes[p + 2], entry.probes[p + 3], entry.probes[p + 4], c)) {
        to[i * 3] = c[0] * ratio; to[i * 3 + 1] = c[1] * ratio; to[i * 3 + 2] = c[2] * ratio;
        this.stats.sampled++;
      } else { to[i * 3] = arr[i * 3]; to[i * 3 + 1] = arr[i * 3 + 1]; to[i * 3 + 2] = arr[i * 3 + 2]; }
    }
    return to;
  }

  /** ライトマップ到着。now は performance.now() */
  apply(sampler: LightmapSampler, now: number): void {
    this.sampler = sampler;
    this.fadeStart = now;
    this.stats.sampled = 0; this.stats.total = 0;
    // 比率: 旧値（定数サンプル）と床の値の平均輝度を揃える
    const c: [number, number, number] = [0, 0, 0];
    let oldSum = 0, newSum = 0;
    for (const e of this.entries) {
      const arr = e.attr.array as Float32Array;
      const n = e.probes.length / 5;
      for (let i = 0; i < n; i++) {
        const p = i * 5;
        if (!sampler.sampleFootprint(e.probes[p], e.probes[p + 1], e.probes[p + 2], e.probes[p + 3], e.probes[p + 4], c)) continue;
        oldSum += 0.2126 * arr[i * 3] + 0.7152 * arr[i * 3 + 1] + 0.0722 * arr[i * 3 + 2];
        newSum += 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      }
    }
    this.ratio = newSum > 1e-6 ? Math.min(1.2, Math.max(0.5, oldSum / newSum)) : 1;
    for (const e of this.entries) {
      e.from = (e.attr.array as Float32Array).slice();
      e.to = this.targets(e, sampler, this.ratio);
      e.mesh.onBeforeRender = () => this.tick(e, performance.now());
    }
  }

  private tick(e: InstanceEntry, now: number): void {
    if (!e.from || !e.to) return;
    const t = Math.min(1, (now - this.fadeStart) / LIGHTMAP_FADE_MS);
    const arr = e.attr.array as Float32Array;
    if (t >= 1) {
      arr.set(e.to);
      e.from = e.to = null;
      e.mesh.onBeforeRender = () => {};
    } else {
      const f = e.from, to = e.to;
      for (let k = 0; k < arr.length; k++) arr[k] = f[k] + (to[k] - f[k]) * t;
    }
    e.attr.needsUpdate = true;
  }

  get pending(): number { return this.entries.filter((e) => e.from).length; }
}

/**
 * 頂点焼き込み → ライトマップのクロスフェード（到着時に呼ぶ）。
 * 対象頂点（ranges）の bakedLight を orig × (1 − t) に書き、材質の lightMapIntensity を t にする（t: 0 → 1、LIGHTMAP_FADE_MS）。
 * 属性の GPU 反映は書いた次のフレームなので、uniform（即時）は「前フレームに書いた t」（gpuT）を使い、頂点側と揃える。
 * 毎フレームの処理は見えているメッシュの onBeforeRender で行い、完了したメッシュは 0 埋めで確定する。
 * 見えていない間に完了時刻を過ぎたメッシュは最初の描画前に確定する（共有材質の intensity を巻き戻さない）
 */
export function startLightmapCrossfade(meshes: { mesh: THREE.Mesh; ranges: number[] }[], now: number): void {
  const state = { start: now, frame: -1, gpuT: 0, nextT: 0 };
  for (const { mesh, ranges } of meshes) {
    const attr = mesh.geometry.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!attr || Array.isArray(mesh.material)) continue;
    const arr = attr.array as Float32Array;
    let total = 0;
    for (let i = 0; i < ranges.length; i += 2) total += ranges[i + 1] * 3;
    const orig = new Float32Array(total);
    for (let i = 0, o = 0; i < ranges.length; i += 2) {
      const s = ranges[i] * 3, n = ranges[i + 1] * 3;
      orig.set(arr.subarray(s, s + n), o);
      o += n;
    }
    mat.lightMapIntensity = 0;
    const finish = () => {
      for (let i = 0; i < ranges.length; i += 2) arr.fill(0, ranges[i] * 3, (ranges[i] + ranges[i + 1]) * 3);
      attr.needsUpdate = true;
      mat.lightMapIntensity = 1;
      mesh.onBeforeRender = () => {};
      mesh.userData.lightmapFadeDoneAt = performance.now(); // 検証用（開始からの経過 = フェードが見えていた時間）
    };
    mesh.onBeforeRender = (renderer) => {
      const t = Math.min(1, (performance.now() - state.start) / LIGHTMAP_FADE_MS);
      if (t >= 1) { finish(); return; }
      // フレームごとに 1 回だけ進める（同じ材質を共有する複数メッシュが同じ t を使う）
      const frame = renderer.info.render.frame;
      if (frame !== state.frame) { state.frame = frame; state.gpuT = state.nextT; state.nextT = t; }
      mat.lightMapIntensity = state.gpuT;
      const k = 1 - state.nextT;
      for (let i = 0, o = 0; i < ranges.length; i += 2) {
        const s = ranges[i] * 3, n = ranges[i + 1] * 3;
        for (let j = 0; j < n; j++) arr[s + j] = orig[o + j] * k;
        o += n;
      }
      attr.needsUpdate = true;
    };
  }
}

// ---------------------------------------------------------------- Worker との通信

export interface LightmapJobHandle {
  cancel(): void;
  readonly done: boolean;
  readonly cancelled: boolean;
}

interface Job {
  id: number;
  req: BakeRequest;
  visible: () => boolean;
  onDone: (res: BakeResult) => void;
  onFail: (reason: string) => void;
  done: boolean;
  cancelled: boolean;
  worker: Worker | null;
}

let disabledReason: string | null = null;

/** この環境でライトマップ（Worker）が使えるか */
export function lightmapsSupported(): boolean {
  return disabledReason === null && typeof Worker !== 'undefined' && typeof window !== 'undefined';
}

/** ライトマップの Worker プール（1〜2 本）。見えている部屋（group.visible）の job を先に処理する */
export class LightmapBaker {
  private static instance: LightmapBaker | null = null;
  static get shared(): LightmapBaker {
    if (!LightmapBaker.instance) {
      LightmapBaker.instance = new LightmapBaker();
      // 検証用（ブラウザのコンソールから window.__lightmapBaker.stats / pending）
      (globalThis as unknown as { __lightmapBaker?: LightmapBaker }).__lightmapBaker = LightmapBaker.instance;
    }
    return LightmapBaker.instance;
  }

  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly queue: Job[] = [];
  private readonly inflight = new Map<Worker, Job>();
  private nextId = 1;
  /** 統計（デバッグ HUD / 検証用）: 完了数・累計 ms・失敗数 */
  readonly stats = { done: 0, failed: 0, cancelled: 0, workerMs: 0, lastMs: 0 };

  private ensureWorkers(): void {
    if (this.workers.length) return;
    const n = Math.max(1, Math.min(2, Math.floor((typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 2 : 2) / 2)));
    for (let i = 0; i < n; i++) {
      try {
        const w = new Worker(new URL('./lightmap.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent) => this.onMessage(w, e.data as BakeResult | { type: 'error'; id: number; message: string });
        w.onerror = (e: ErrorEvent) => { this.disable(`worker error: ${e.message ?? 'unknown'}`); };
        this.workers.push(w);
        this.idle.push(w);
      } catch (err) {
        this.disable(`worker unavailable: ${String(err)}`);
        break;
      }
    }
  }

  private disable(reason: string): void {
    if (disabledReason === null) console.warn(`[lightmap] disabled: ${reason}`);
    disabledReason = reason;
    for (const w of this.workers) { try { w.terminate(); } catch { /* ignore */ } }
    this.workers.length = 0;
    this.idle.length = 0;
    for (const j of this.inflight.values()) if (!j.done && !j.cancelled) { j.done = true; this.stats.failed++; j.onFail(reason); }
    this.inflight.clear();
    for (const j of this.queue) if (!j.cancelled) { j.done = true; this.stats.failed++; j.onFail(reason); }
    this.queue.length = 0;
  }

  enqueue(req: Omit<BakeRequest, 'type' | 'id'>, visible: () => boolean, onDone: (res: BakeResult) => void, onFail: (reason: string) => void = () => {}): LightmapJobHandle {
    const job: Job = { id: this.nextId++, req: { ...req, type: 'bake', id: 0 }, visible, onDone, onFail, done: false, cancelled: false, worker: null };
    job.req.id = job.id;
    const handle: LightmapJobHandle = {
      cancel: () => {
        if (job.done || job.cancelled) return;
        job.cancelled = true;
        this.stats.cancelled++;
        const i = this.queue.indexOf(job);
        if (i >= 0) this.queue.splice(i, 1);
      },
      get done() { return job.done; },
      get cancelled() { return job.cancelled; },
    };
    if (!lightmapsSupported()) { job.done = true; queueMicrotask(() => onFail(disabledReason ?? 'unsupported')); return handle; }
    this.ensureWorkers();
    if (!this.workers.length) { job.done = true; queueMicrotask(() => onFail(disabledReason ?? 'unsupported')); return handle; }
    this.queue.push(job);
    this.pump();
    return handle;
  }

  get pending(): number { return this.queue.length + this.inflight.size; }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      // 見えている部屋を優先、同順位なら古いものから
      let pick = this.queue.findIndex((j) => j.visible());
      if (pick < 0) pick = 0;
      const job = this.queue.splice(pick, 1)[0];
      const w = this.idle.pop()!;
      job.worker = w;
      this.inflight.set(w, job);
      const r = job.req;
      try {
        w.postMessage(r, [r.faces.buffer, r.fixtures.buffer, r.occluders.buffer, r.occluderFlags.buffer, r.directionals.buffer]);
      } catch (err) {
        this.inflight.delete(w);
        this.idle.push(w);
        job.done = true;
        this.stats.failed++;
        job.onFail(String(err));
      }
    }
  }

  private onMessage(w: Worker, msg: BakeResult | { type: 'error'; id: number; message: string }): void {
    const job = this.inflight.get(w);
    this.inflight.delete(w);
    this.idle.push(w);
    if (job && !job.done) {
      job.done = true;
      if (msg.type === 'done') {
        this.stats.workerMs += msg.ms;
        this.stats.lastMs = msg.ms;
        if (!job.cancelled) { this.stats.done++; try { job.onDone(msg); } catch (err) { console.warn('[lightmap] apply failed', err); } }
      } else if (!job.cancelled) {
        this.stats.failed++;
        job.onFail(msg.message);
      }
    }
    this.pump();
  }
}
