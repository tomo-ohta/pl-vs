/**
 * 写し取った面の画像から粒（2D ガウシアン = 面に貼り付いた楕円の粒）を作る。
 *
 * - 面ごとにテクセル 1 つ = 粒 1 つから始め、色・粗さ・地の色が揃っている所は 2×2・4×4・8×8 の大きな粒にまとめる
 *   （撮影データの 3DGS も、模様の無い所は大きな粒・模様のある所は細かい粒になる。粒の数を抑えるため）
 * - 面の縁に接する所は大きくまとめない（箱の輪郭がぼけないように）
 * - 他の箱・壁・床に接して見えない所（家具の底・壁に付けた背中・棚に載せた物の接地面・箱どうしの重なり）は粒を作らない
 */
import type { Atlas, CaptureBox, CaptureResult } from './capture.ts';
import { DIRS } from './capture.ts';

/** 遮るものの箱（区画の入れ物の座標）。id は小物の箱なら CaptureBox.id、構造なら −1 */
export interface Occluder { id: number; minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }

/** 0.5 m の格子で引く */
export class OccluderGrid {
  private readonly cells = new Map<number, Occluder[]>();
  private readonly size = 0.5;
  /** 格子の原点（果てしない階の遠い区域は座標が大きいので、区画の隅からの相対で引く） */
  private readonly ox: number;
  private readonly oy: number;
  private readonly oz: number;
  constructor(list: Occluder[]) {
    let ox = Infinity, oy = Infinity, oz = Infinity;
    for (const o of list) { ox = Math.min(ox, o.minX); oy = Math.min(oy, o.minY); oz = Math.min(oz, o.minZ); }
    this.ox = Number.isFinite(ox) ? ox - 1 : 0;
    this.oy = Number.isFinite(oy) ? oy - 1 : 0;
    this.oz = Number.isFinite(oz) ? oz - 1 : 0;
    for (const o of list) {
      const x0 = this.cx(o.minX), x1 = this.cx(o.maxX);
      const y0 = this.cy(o.minY), y1 = this.cy(o.maxY);
      const z0 = this.cz(o.minZ), z1 = this.cz(o.maxZ);
      // 大きすぎる箱（床・壁の板）は格子をまたいで入れる（区画の大きさなので数百程度）
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const k = this.key(x, y, z);
        const l = this.cells.get(k);
        if (l) l.push(o);
        else this.cells.set(k, [o]);
      }
    }
  }
  private cx(x: number): number { return Math.floor((x - this.ox) / this.size); }
  private cy(y: number): number { return Math.floor((y - this.oy) / this.size); }
  private cz(z: number): number { return Math.floor((z - this.oz) / this.size); }
  private key(x: number, y: number, z: number): number {
    return (x * 4096 + y) * 4096 + z;
  }
  /** 点が自分（self）以外の箱の内側にあるか */
  inside(x: number, y: number, z: number, self: number): boolean {
    const l = this.cells.get(this.key(this.cx(x), this.cy(y), this.cz(z)));
    if (!l) return false;
    for (const o of l) {
      if (o.id === self && self >= 0) continue;
      if (x > o.minX && x < o.maxX && y > o.minY && y < o.maxY && z > o.minZ && z < o.maxZ) return true;
    }
    return false;
  }
}

export interface FaceGenParams {
  /** まとめる最大の段（3 = 8×8 テクセル） */
  maxLevel: number;
  /** 面の縁に接する所の最大の段 */
  edgeLevel: number;
  /** まとめてよい色の差（1/2.2 乗した値で） */
  tolerance: number;
  /** 粒の広がり（ガウシアンの標準偏差 ÷ 粒の間隔） */
  sigma: number;
  /** 不透明度（1 より大きいと粒の芯が平らになり、すき間が透けにくい。Spark の拡張） */
  opacity: number;
  /** 接していると見なす距離（m） */
  contact: number;
  /** 植物の葉（plantLeaf の箱）を、箱の中に散らした向きばらばらの葉の粒にする */
  foliage: boolean;
}

export const DEFAULT_FACEGEN: FaceGenParams = { maxLevel: 3, edgeLevel: 1, tolerance: 0.022, sigma: 0.55, opacity: 1.6, contact: 0.004, foliage: true };

export interface SplatBatch {
  n: number;
  center: Float32Array; // 3n
  scale: Float32Array; // 2n（面の u・v の向きの標準偏差。法線の向きは 0 = 2D ガウシアン）
  dir: Uint8Array; // n
  base: Float32Array; // 3n（線形の見た目）
  albedo: Float32Array; // 3n
  rough: Float32Array; // n
  metal: Float32Array; // n
  /** 材質の番号（manager の材質表の添字。映り込みの強さ・クリアコート） */
  mat: Uint16Array; // n
  /** 粒ごとの回転（ExtSplats の 32 bit。葉の粒だけが向きばらばら。無ければ面の向き） */
  quat?: Uint32Array; // n
  opacity: number;
}

const GAMMA = 1 / 2.2;

class Grow {
  n = 0;
  cap = 0;
  center = new Float32Array(0);
  scale = new Float32Array(0);
  dir = new Uint8Array(0);
  base = new Float32Array(0);
  albedo = new Float32Array(0);
  rough = new Float32Array(0);
  metal = new Float32Array(0);
  mat = new Uint16Array(0);
  quat = new Uint32Array(0);
  ensure(n: number): void {
    if (n <= this.cap) return;
    const cap = Math.max(n, this.cap * 2, 4096);
    const g = <T extends Float32Array | Uint8Array | Uint16Array | Uint32Array>(a: T, k: number): T => { const b = new (a.constructor as new (n: number) => T)(cap * k); b.set(a); return b; };
    this.center = g(this.center, 3); this.scale = g(this.scale, 2); this.dir = g(this.dir, 1); this.base = g(this.base, 3);
    this.albedo = g(this.albedo, 3); this.rough = g(this.rough, 1); this.metal = g(this.metal, 1); this.mat = g(this.mat, 1); this.quat = g(this.quat, 1);
    this.cap = cap;
  }
}

/** 箱の材質の値（金属度と、材質表の番号。葉なら foliage） */
export type MaterialOf = (box: CaptureBox) => { metal: number; index: number; foliage?: boolean };

/** 面の粒の回転の 32 bit（facegen の外で決める。splatbuild の面の向きの表） */
export type QuatCode = (dir: number) => number;

/**
 * 写し取った結果から粒を作る。yieldEvery ミリ秒ごとに止まる（呼び出し側が次のフレームへ回す）
 */
export function* generateSplats(cap: CaptureResult, boxes: CaptureBox[], grid: OccluderGrid, materialOf: MaterialOf, p: FaceGenParams, quatOf: QuatCode, encode: (x: number, y: number, z: number, w: number) => number): Generator<void, SplatBatch, void> {
  const out = new Grow();
  const t = cap.texel;
  let slice = performance.now();
  // 面 1 つ分の作業用
  let valid = new Uint8Array(0);
  let gam = new Float32Array(0);
  for (const box of boxes) {
    const rects = cap.rects.get(box.id)!;
    const { metal, index: matIndex, foliage } = materialOf(box);
    if (foliage && p.foliage) {
      leaves(out, cap, box, rects, metal, matIndex, encode);
      continue;
    }
    for (let dir = 0; dir < 6; dir++) {
      if (performance.now() - slice > 6) { yield; slice = performance.now(); }
      const r = rects[dir]!;
      const atlas: Atlas = cap.atlases[dir]!;
      const { u, v, d } = DIRS[dir]!;
      const dmax = Math.max(box.aabb.min.dot(d), box.aabb.max.dot(d));
      const W = r.w, H = r.h;
      if (valid.length < W * H) { valid = new Uint8Array(W * H * 2); gam = new Float32Array(W * H * 2 * 3); }
      valid.fill(0, 0, W * H);
      // テクセル（葉）ごとに: 写っているか・接して隠れていないか・色
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const ai = ((r.y + j) * atlas.width + (r.x + i)) * 4;
        if (atlas.beauty[ai + 3]! < 0.5) continue;
        const cu = r.u0 + (i + 0.5) * t, cv = r.v0 + (j + 0.5) * t;
        const px = u.x * cu + v.x * cv + d.x * dmax, py = u.y * cu + v.y * cv + d.y * dmax, pz = u.z * cu + v.z * cv + d.z * dmax;
        if (grid.inside(px + d.x * p.contact, py + d.y * p.contact, pz + d.z * p.contact, box.id)) continue;
        const li = j * W + i;
        valid[li] = 1;
        gam[li * 3] = Math.pow(Math.max(0, atlas.beauty[ai]!), GAMMA);
        gam[li * 3 + 1] = Math.pow(Math.max(0, atlas.beauty[ai + 1]!), GAMMA);
        gam[li * 3 + 2] = Math.pow(Math.max(0, atlas.beauty[ai + 2]!), GAMMA);
      }
      // 大きな塊から順にまとめる（covered = 2 で印）
      for (let L = p.maxLevel; L >= 0; L--) {
        const k = 1 << L;
        for (let bj = 0; bj + k <= H; bj += k) for (let bi = 0; bi + k <= W; bi += k) {
          if (L > 0) {
            const border = bi === 0 || bj === 0 || bi + k === W || bj + k === H;
            if (border && L > p.edgeLevel) continue;
            if (!uniform(valid, gam, atlas, r, W, bi, bj, k, p.tolerance)) continue;
          } else if (valid[bj * W + bi] !== 1) continue;
          // 粒を 1 つ: 塊の平均（線形）
          let br = 0, bg = 0, bb = 0, ar = 0, ag = 0, ab = 0, ro = 0;
          for (let jj = 0; jj < k; jj++) for (let ii = 0; ii < k; ii++) {
            const li = (bj + jj) * W + bi + ii;
            valid[li] = 2;
            const ai = ((r.y + bj + jj) * atlas.width + (r.x + bi + ii)) * 4;
            br += atlas.beauty[ai]!; bg += atlas.beauty[ai + 1]!; bb += atlas.beauty[ai + 2]!;
            ar += atlas.albedo[ai]!; ag += atlas.albedo[ai + 1]!; ab += atlas.albedo[ai + 2]!;
            ro += atlas.rough[ai]!;
          }
          const inv = 1 / (k * k);
          const n = out.n;
          out.ensure(n + 1);
          const cu = r.u0 + (bi + k / 2) * t, cv = r.v0 + (bj + k / 2) * t;
          out.center[n * 3] = u.x * cu + v.x * cv + d.x * dmax;
          out.center[n * 3 + 1] = u.y * cu + v.y * cv + d.y * dmax;
          out.center[n * 3 + 2] = u.z * cu + v.z * cv + d.z * dmax;
          out.scale[n * 2] = out.scale[n * 2 + 1] = k * t * p.sigma;
          out.dir[n] = dir;
          out.base[n * 3] = br * inv; out.base[n * 3 + 1] = bg * inv; out.base[n * 3 + 2] = bb * inv;
          const a255 = inv / 255;
          out.albedo[n * 3] = ar * a255; out.albedo[n * 3 + 1] = ag * a255; out.albedo[n * 3 + 2] = ab * a255;
          out.rough[n] = ro * a255;
          out.metal[n] = metal;
          out.mat[n] = matIndex;
          out.quat[n] = quatOf(dir);
          out.n = n + 1;
        }
      }
    }
  }
  const n = out.n;
  return {
    n,
    center: out.center.slice(0, n * 3), scale: out.scale.slice(0, n * 2), dir: out.dir.slice(0, n),
    base: out.base.slice(0, n * 3), albedo: out.albedo.slice(0, n * 3), rough: out.rough.slice(0, n), metal: out.metal.slice(0, n),
    mat: out.mat.slice(0, n), quat: out.quat.slice(0, n), opacity: p.opacity,
  };
}

/**
 * 葉の箱 → 箱に内接する楕円体の中に、向きばらばらの小さな円盤（2D ガウシアン）を散らす。外側ほど多く・明るく（中は陰）。
 * 色は写し取った面の画像から、その粒に近い面の位置を引く（v2 の葉の模様・焼き込み陰影の色のまま）
 */
function leaves(out: Grow, cap: CaptureResult, box: CaptureBox, rects: readonly { x: number; y: number; w: number; h: number; u0: number; v0: number }[], metal: number, matIndex: number, encode: (x: number, y: number, z: number, w: number) => number): void {
  const t = cap.texel;
  const c = box.aabb.getCenter(box.aabb.min.clone());
  const hs = box.aabb.getSize(box.aabb.min.clone()).multiplyScalar(0.5);
  const leafSize = 0.016;
  const count = Math.max(40, Math.min(60000, Math.round((hs.x * hs.y * hs.z * 8) / 0.00004)));
  let seed = (box.id * 2654435761) >>> 0;
  const rnd = (): number => { seed = (seed + 0x6d2b79f5) >>> 0; let z = seed; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  for (let k = 0; k < count; k++) {
    // 楕円体の中の点（外側の殻に寄せる: 半径 = 0.45..1 の 3 乗根寄り）
    let x = 0, y = 0, z = 0, l = 2;
    while (l > 1 || l < 1e-6) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; }
    const r = 0.45 + 0.55 * Math.cbrt(rnd());
    const len = Math.sqrt(l);
    x = (x / len) * r; y = (y / len) * r; z = (z / len) * r;
    const px = c.x + x * hs.x, py = c.y + y * hs.y, pz = c.z + z * hs.z;
    // いちばん近い面（中心から見た向きで決める）
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    const dir = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5);
    const { u, v } = DIRS[dir]!;
    const rc = rects[dir]!;
    const atlas = cap.atlases[dir]!;
    const pu = px * u.x + py * u.y + pz * u.z, pv = px * v.x + py * v.y + pz * v.z;
    // 葉の模様の「すき間」（透けている・真っ暗なテクセル）は避けて、近くの葉の色を拾う
    let ai = -1, bestL = -1;
    for (let tries = 0; tries < 6; tries++) {
      const jitter = tries === 0 ? 0 : 0.04;
      const i = Math.max(0, Math.min(rc.w - 1, Math.floor((pu - rc.u0 + (rnd() - 0.5) * jitter) / t)));
      const j = Math.max(0, Math.min(rc.h - 1, Math.floor((pv - rc.v0 + (rnd() - 0.5) * jitter) / t)));
      const k = ((rc.y + j) * atlas.width + (rc.x + i)) * 4;
      if (atlas.beauty[k + 3]! < 0.5) continue;
      const lum = atlas.beauty[k]! + atlas.beauty[k + 1]! + atlas.beauty[k + 2]!;
      if (lum > bestL) { bestL = lum; ai = k; }
      if (lum > 0.02) break;
    }
    if (ai < 0) continue;
    // 中ほど少し暗く（葉の重なりの陰）。少しばらつかせる
    const shade = (0.7 + 0.3 * r) * (0.88 + rnd() * 0.24);
    const n = out.n;
    out.ensure(n + 1);
    out.center[n * 3] = px; out.center[n * 3 + 1] = py; out.center[n * 3 + 2] = pz;
    const s = leafSize * (0.7 + rnd() * 0.7);
    out.scale[n * 2] = s; out.scale[n * 2 + 1] = s * (0.45 + rnd() * 0.3);
    out.dir[n] = dir;
    out.base[n * 3] = atlas.beauty[ai]! * shade; out.base[n * 3 + 1] = atlas.beauty[ai + 1]! * shade; out.base[n * 3 + 2] = atlas.beauty[ai + 2]! * shade;
    out.albedo[n * 3] = atlas.albedo[ai]! / 255; out.albedo[n * 3 + 1] = atlas.albedo[ai + 1]! / 255; out.albedo[n * 3 + 2] = atlas.albedo[ai + 2]! / 255;
    out.rough[n] = atlas.rough[ai]! / 255;
    out.metal[n] = metal;
    out.mat[n] = matIndex;
    // 向きばらばら（一様な回転）
    const u1 = rnd(), u2 = rnd() * Math.PI * 2, u3 = rnd() * Math.PI * 2;
    const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    out.quat[n] = encode(a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3));
    out.n = n + 1;
  }
}

/** 塊の葉が全部「まだ使っていない・写っている」で、色・粗さ・地の色が揃っているか */
function uniform(valid: Uint8Array, gam: Float32Array, atlas: Atlas, r: { x: number; y: number }, W: number, bi: number, bj: number, k: number, tol: number): boolean {
  let minR = Infinity, minG = Infinity, minB = Infinity, maxR = -Infinity, maxG = -Infinity, maxB = -Infinity;
  let minRo = 255, maxRo = 0, minA = 255, maxA = 0;
  for (let jj = 0; jj < k; jj++) for (let ii = 0; ii < k; ii++) {
    const li = (bj + jj) * W + bi + ii;
    if (valid[li] !== 1) return false;
    const c0 = gam[li * 3]!, c1 = gam[li * 3 + 1]!, c2 = gam[li * 3 + 2]!;
    if (c0 < minR) minR = c0; if (c0 > maxR) maxR = c0;
    if (c1 < minG) minG = c1; if (c1 > maxG) maxG = c1;
    if (c2 < minB) minB = c2; if (c2 > maxB) maxB = c2;
    const ai = ((r.y + bj + jj) * atlas.width + (r.x + bi + ii)) * 4;
    const ro = atlas.rough[ai]!, al = atlas.albedo[ai]! + atlas.albedo[ai + 1]! + atlas.albedo[ai + 2]!;
    if (ro < minRo) minRo = ro; if (ro > maxRo) maxRo = ro;
    if (al < minA) minA = al; if (al > maxA) maxA = al;
    if (maxR - minR > tol || maxG - minG > tol || maxB - minB > tol) return false;
  }
  return maxRo - minRo <= 30 && maxA - minA <= 60;
}
