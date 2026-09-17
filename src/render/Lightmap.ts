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
import { FACE_STRIDE, type BakeRequest, type BakeResult } from './lightmap.worker';

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
  if (b.mat === 'glass' || b.mat === 'water' || b.mat === 'waterShallow' || b.mat === 'waterWall' || /^sky/.test(b.mat) || b.mat === 'carGlass') return false;
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
