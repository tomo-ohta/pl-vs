/**
 * ライトマップ焼き込みの計算カーネル + Web Worker 入口（担当 L1）。
 *
 * - three.js に依存しない純関数。`SurfaceLighting`（頂点焼き込み）と Worker（テクセル焼き込み）が同じ関数を使うので、
 *   到着前（頂点）と到着後（テクセル）の明るさの平均が一致する。
 * - モジュールとして import しても副作用は無い。Worker として起動されたとき（WorkerGlobalScope 内）だけ onmessage を登録する。
 * - 近似の内容（GI ではない）: 環境光 × 反射光の広がり（器具からの距離で環境光を減らす）× AO（半球レイ）
 *   + 直接光（器具を面としてサンプル、配光、距離減衰、遮蔽レイ）+ 器具まわりの天井の滲み（halo）+ 平行光（FakeSky）。
 *   数値は docs/lighting-lightmap.md。
 */

// ---------------------------------------------------------------- 調整値

export const LIGHT_TUNING = {
  /** 器具のパワー倍率（7 × 発光面積 m² × これ）。担当 P の露出 1.0 / 半球光 0.06、担当 M の envMap 拡散 0 を前提に、
   *  器具直下の床の照度が旧方式（頂点焼き込み + envMap + 半球光）の 0.6 倍程度になる値 */
  powerScale: 1.6,
  /** 器具の到達距離（m）。これより遠い器具は寄与しない */
  range: 14,
  /** 距離減衰 1 / (c + d²) × (1 − d²/range²)²（range で滑らかに 0。突き当たりが沈む） */
  falloffC: 0.5,
  /** 器具の中心 1 点で近似してよい距離: d > nearFactor × 器具の最大辺 なら 1 点 */
  nearFactor: 3,
  /** palette.ambient に掛ける係数（従来 .75）。器具から遠い所は bounceFloor 倍まで下がる */
  ambientScale: 0.7,
  /** 環境光のうち器具位置に依らず残す割合（廊下の突き当たりの床）*/
  bounceFloor: 0.15,
  /** 反射光の正規化: 1.2 × 0.6 m トロファー 1 台のパワー（7 × 0.72 × powerScale） */
  bounceP0: 8,
  /** 反射光の広がり（m）と飽和 */
  bounceR0: 4,
  bounceK: 2.5,
  /** 遮蔽された直接光 / 反射光の残り */
  occludedDirect: 0.06,
  occludedBounce: 0.5,
  /** 器具まわりの天井の滲み: 器具縁からの距離 r に対し H / (1 + (r / haloR)²)^1.5。天井側 haloBand（m）まで */
  haloR: 0.4,
  haloBand: 0.35,
  haloTight: 0.035,
  haloWide: 0.07,
  haloCutoff: 1.6,
  /** AO レイの到達距離（m）と AO の下限（完全遮蔽でも残す割合） */
  aoRadius: 2.2,
  aoFloor: 0.15,
  /** 上向きの面ほど環境光を受ける: base + (1 - base) × max(0, ny) */
  hemiBase: 0.65,
  /** 配光 D(c) = mix × c + (1 − mix) × c^exp。tight = 埋め込みトロファー / ダウンライト、wide = 露出管 / 壁灯 */
  beamTightMix: 0.1,
  beamTightExp: 8,
  beamWideMix: 0.45,
  beamWideExp: 3,
};

/** 器具 1 台の packed 表現（Float32Array、FIXTURE_STRIDE 個ずつ） */
export const FIXTURE_STRIDE = 16;
// [0..2] 発光面の中心（面から 3 cm 手前）、[3..5] 発光矩形の半径（法線軸は 0）、[6..8] 発光法線（omni は 0）、
// [9..11] 色（linear）、[12] パワー、[13] beam（0 omni / 1 wide / 2 tight）、[14] サンプル数 nu、[15] サンプル数 nv
export const F_CX = 0, F_HX = 3, F_NX = 6, F_R = 9, F_POWER = 12, F_BEAM = 13, F_NU = 14, F_NV = 15;

/** 面（アトラス矩形）の packed 表現 */
export const FACE_STRIDE = 20;
// [0] px [1] py [2] pw [3] ph（内側の画素矩形。外側 1 画素の縁は Worker が埋める）
// [4..6] 原点（面の角）、[7..9] U 軸（単位）、[10..12] V 軸（単位）、[13..15] 法線、[16] w（m） [17] h（m） [18] boxId [19] 予約

/** 遮蔽体のフラグ */
export const OCC_SHADOW = 1; // 直接光の遮蔽判定に使う（isOccluder）
export const OCC_AO = 2;     // AO レイに使う（薄い天板・棚板も含む）

export interface BakeRequest {
  type: 'bake';
  id: number;
  width: number;
  height: number;
  faces: Float32Array;
  fixtures: Float32Array;
  occluders: Float32Array;
  occluderFlags: Uint8Array;
  /** [dx dy dz r g b power] × n */
  directionals: Float32Array;
  ambient: [number, number, number];
  skyAmbient: [number, number, number] | null;
  occlusion: boolean;
  aoRays: number;
  bounds: [number, number, number, number, number, number];
}

export interface BakeResult {
  type: 'done';
  id: number;
  data: Uint16Array;
  ms: number;
  /** mean = 面の内側テクセルの平均輝度（到着時の明るさの飛びの検証用） */
  stats: { texels: number; faces: number; rays: number; mean: number };
}

// ---------------------------------------------------------------- 器具のサンプル点

/** 発光矩形のサンプル数（サイズに応じて 1×1〜4×2）。tangent 軸は法線以外の 2 軸 */
export function fixtureSampleGrid(hu: number, hv: number): [number, number] {
  const nu = Math.max(1, Math.min(4, Math.ceil((2 * hu) / 0.35)));
  const nv = Math.max(1, Math.min(2, Math.ceil((2 * hv) / 0.35)));
  return [nu, nv];
}

/** packed fixtures → 各器具のサンプル点（[x y z] × ns）と先頭オフセット。maxPerAxis で 1 軸のサンプル数を抑えられる（頂点焼き込みは 2×2 まで） */
export function buildFixtureSamples(fx: Float32Array, maxPerAxis = 4): { samples: Float32Array; offset: Int32Array } {
  const n = fx.length / FIXTURE_STRIDE;
  const offset = new Int32Array(n + 1);
  let total = 0;
  for (let i = 0; i < n; i++) {
    offset[i] = total;
    total += Math.min(maxPerAxis, fx[i * FIXTURE_STRIDE + F_NU]) * Math.min(maxPerAxis, fx[i * FIXTURE_STRIDE + F_NV]);
  }
  offset[n] = total;
  const samples = new Float32Array(total * 3);
  for (let i = 0; i < n; i++) {
    const o = i * FIXTURE_STRIDE;
    const nu = Math.min(maxPerAxis, fx[o + F_NU]), nv = Math.min(maxPerAxis, fx[o + F_NV]);
    const hx = fx[o + F_HX], hy = fx[o + F_HX + 1], hz = fx[o + F_HX + 2];
    // tangent 軸: 半径の大きい順に 2 軸（法線軸の半径は 0）
    const axes = [hx, hy, hz].map((h, k) => [h, k] as [number, number]).sort((a, b) => b[0] - a[0]);
    const [hu, au] = axes[0], [hv, av] = axes[1];
    let s = offset[i] * 3;
    for (let a = 0; a < nu; a++) {
      for (let b = 0; b < nv; b++) {
        const du = nu === 1 ? 0 : (-hu + (2 * hu * (a + 0.5)) / nu);
        const dv = nv === 1 ? 0 : (-hv + (2 * hv * (b + 0.5)) / nv);
        const p = [fx[o + F_CX], fx[o + F_CX + 1], fx[o + F_CX + 2]];
        p[au] += du; p[av] += dv;
        samples[s++] = p[0]; samples[s++] = p[1]; samples[s++] = p[2];
      }
    }
  }
  return { samples, offset };
}

/** 整数乗（Math.pow より速い。配光の内側ループ用） */
export function powi(c: number, n: number): number {
  let r = 1, b = c, e = n | 0;
  while (e > 0) { if (e & 1) r *= b; b *= b; e >>= 1; }
  return r;
}

/** 配光: 発光法線と方向の cos に対する相対強度 */
export function beamDistribution(beam: number, c: number): number {
  if (beam === 0) return 1;
  if (c <= 0) return 0;
  const T = LIGHT_TUNING;
  if (beam === 1) return T.beamWideMix * c + (1 - T.beamWideMix) * powi(c, T.beamWideExp);
  return T.beamTightMix * c + (1 - T.beamTightMix) * powi(c, T.beamTightExp);
}

/** 直接光の照度係数（色を掛ける前）。near=true なら面サンプル、false なら中心 1 点 */
export function fixtureIrradiance(
  fx: Float32Array, i: number, samples: Float32Array, sOff: Int32Array,
  px: number, py: number, pz: number, nx: number, ny: number, nz: number, near: boolean,
): number {
  const o = i * FIXTURE_STRIDE;
  const beam = fx[o + F_BEAM];
  const enx = fx[o + F_NX], eny = fx[o + F_NX + 1], enz = fx[o + F_NX + 2];
  const power = fx[o + F_POWER];
  const c = LIGHT_TUNING.falloffC;
  const range2 = LIGHT_TUNING.range * LIGHT_TUNING.range;
  let s0: number, s1: number;
  if (near) { s0 = sOff[i]; s1 = sOff[i + 1]; } else { s0 = -1; s1 = 0; }
  const count = near ? s1 - s0 : 1;
  let sum = 0;
  for (let s = s0; s < s1; s++) {
    let sx: number, sy: number, sz: number;
    if (s < 0) { sx = fx[o + F_CX]; sy = fx[o + F_CX + 1]; sz = fx[o + F_CX + 2]; }
    else { sx = samples[s * 3]; sy = samples[s * 3 + 1]; sz = samples[s * 3 + 2]; }
    const dx = sx - px, dy = sy - py, dz = sz - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > range2) continue;
    const d = Math.sqrt(Math.max(1e-4, d2));
    const lambert = (dx * nx + dy * ny + dz * nz) / d;
    if (lambert <= 0.005) continue;
    const src = beam === 0 ? 1 : beamDistribution(beam, -(dx * enx + dy * eny + dz * enz) / d);
    if (src <= 0) continue;
    const win = 1 - d2 / range2;
    sum += src * lambert * win * win / (c + d2);
  }
  return (power / count) * sum;
}

/** 反射光の重み（器具の中心からの距離。方向を問わない） */
export function bounceWeight(fx: Float32Array, i: number, px: number, py: number, pz: number): number {
  const o = i * FIXTURE_STRIDE;
  const dx = fx[o + F_CX] - px, dy = fx[o + F_CX + 1] - py, dz = fx[o + F_CX + 2] - pz;
  const d2 = dx * dx + dy * dy + dz * dz;
  const r0 = LIGHT_TUNING.bounceR0;
  return (fx[o + F_POWER] / LIGHT_TUNING.bounceP0) / (1 + d2 / (r0 * r0));
}

/** 反射光の合計 B → 環境光の倍率 S（bounceFloor..1） */
export function bounceScale(B: number): number {
  const f = LIGHT_TUNING.bounceFloor;
  return f + (1 - f) * (1 - Math.exp(-B / LIGHT_TUNING.bounceK));
}

/** 器具まわりの滲み（器具の発光面より奥、天井側 haloBand 以内の面）。照度係数 */
export function fixtureHalo(fx: Float32Array, i: number, px: number, py: number, pz: number, nx: number, ny: number, nz: number): number {
  const o = i * FIXTURE_STRIDE;
  const beam = fx[o + F_BEAM];
  if (beam === 0) return 0;
  const enx = fx[o + F_NX], eny = fx[o + F_NX + 1], enz = fx[o + F_NX + 2];
  const dx = px - fx[o + F_CX], dy = py - fx[o + F_CX + 1], dz = pz - fx[o + F_CX + 2];
  const s = dx * enx + dy * eny + dz * enz; // 発光面からの符号付き距離（発光方向が正）
  if (s > 0.03 || s < -LIGHT_TUNING.haloBand) return 0;
  // 面内の矩形縁からの距離
  const ex = Math.max(0, Math.abs(dx) - fx[o + F_HX]), ey = Math.max(0, Math.abs(dy) - fx[o + F_HX + 1]), ez = Math.max(0, Math.abs(dz) - fx[o + F_HX + 2]);
  // 法線軸方向の成分は除く（面内距離）
  const r = Math.sqrt(ex * ex * (1 - Math.abs(enx)) + ey * ey * (1 - Math.abs(eny)) + ez * ez * (1 - Math.abs(enz)));
  if (r > LIGHT_TUNING.haloCutoff) return 0;
  const facing = Math.max(0, Math.min(1, 0.4 + 0.6 * (nx * enx + ny * eny + nz * enz)));
  if (facing <= 0) return 0;
  const q = 1 + (r * r) / (LIGHT_TUNING.haloR * LIGHT_TUNING.haloR);
  const H = beam === 1 ? LIGHT_TUNING.haloWide : LIGHT_TUNING.haloTight;
  return fx[o + F_POWER] * H * facing / (q * Math.sqrt(q));
}

/** 上向きの面ほど環境光を受ける係数 */
export function hemiWeight(ny: number): number {
  return LIGHT_TUNING.hemiBase + (1 - LIGHT_TUNING.hemiBase) * Math.max(0, ny);
}

/** 器具 i を面サンプルで扱うか（近い / 大きい器具） */
export function fixtureIsNear(fx: Float32Array, i: number, px: number, py: number, pz: number): boolean {
  const o = i * FIXTURE_STRIDE;
  const size = 2 * Math.max(fx[o + F_HX], fx[o + F_HX + 1], fx[o + F_HX + 2]);
  if (size < 0.2) return false;
  const dx = fx[o + F_CX] - px, dy = fx[o + F_CX + 1] - py, dz = fx[o + F_CX + 2] - pz;
  const lim = LIGHT_TUNING.nearFactor * size;
  return dx * dx + dy * dy + dz * dz < lim * lim;
}

// ---------------------------------------------------------------- レイ / AABB

/** 線分 a→b（両端 1.5% を除く）が箱 boxes[o..o+6) を通るか */
export function segmentHitsBox(ax: number, ay: number, az: number, bx: number, by: number, bz: number, boxes: Float32Array, o: number): boolean {
  let lo = 0.015, hi = 0.985;
  for (let k = 0; k < 3; k++) {
    const org = k === 0 ? ax : k === 1 ? ay : az;
    const d = (k === 0 ? bx : k === 1 ? by : bz) - org;
    const mn = boxes[o + k], mx = boxes[o + 3 + k];
    if (Math.abs(d) < 1e-7) { if (org < mn || org > mx) return false; }
    else {
      const inv = 1 / d;
      let t0 = (mn - org) * inv, t1 = (mx - org) * inv;
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      if (t0 > lo) lo = t0;
      if (t1 < hi) hi = t1;
      if (hi <= lo) return false;
    }
  }
  return true;
}

/** レイ o + t·d（d 単位、inv = 1/d）と箱の交点距離。無ければ -1。tMax まで */
export function rayBoxT(ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, boxes: Float32Array, o: number, tMin: number, tMax: number): number {
  let lo = tMin, hi = tMax;
  let t0 = (boxes[o] - ox) * ix, t1 = (boxes[o + 3] - ox) * ix;
  if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
  if (t0 > lo) lo = t0; if (t1 < hi) hi = t1; if (hi <= lo) return -1;
  t0 = (boxes[o + 1] - oy) * iy; t1 = (boxes[o + 4] - oy) * iy;
  if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
  if (t0 > lo) lo = t0; if (t1 < hi) hi = t1; if (hi <= lo) return -1;
  t0 = (boxes[o + 2] - oz) * iz; t1 = (boxes[o + 5] - oz) * iz;
  if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
  if (t0 > lo) lo = t0; if (t1 < hi) hi = t1; if (hi <= lo) return -1;
  return lo;
}

/** cos 重み付き半球方向（tangent 空間、z が法線）。決定論の固定列 */
export function hemisphereDirections(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u1 = (i + 0.5) / n;
    const u2 = (i * 0.6180339887498949) % 1;
    const r = Math.sqrt(u1), phi = 2 * Math.PI * u2;
    out[i * 3] = r * Math.cos(phi); out[i * 3 + 1] = r * Math.sin(phi); out[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - u1));
  }
  return out;
}

/** 決定論の整数ハッシュ → [0,1) */
export function hash01(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- half float

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
/** float → IEEE half（丸めは切り捨て。0 以上の照度値向け） */
export function toHalf(v: number): number {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 127 + 15;
  const mant = x & 0x7fffff;
  if (exp <= 0) {
    if (exp < -10) return sign;
    const m = (mant | 0x800000) >>> (1 - exp);
    return sign | (m >>> 13);
  }
  if (exp >= 31) return sign | 0x7bff; // clamp to max half
  return sign | (exp << 10) | (mant >>> 13);
}

/** IEEE half → float（統計・検証用） */
export function fromHalf(h: number): number {
  const sgn = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return sgn * Math.pow(2, -14) * (m / 1024);
  if (e === 31) return m ? NaN : sgn * Infinity;
  return sgn * Math.pow(2, e - 15) * (1 + m / 1024);
}

// ---------------------------------------------------------------- 遮蔽体グリッド（xz の 2D）

class OccluderGrid {
  readonly boxes: Float32Array;
  readonly flags: Uint8Array;
  readonly cell: number;
  readonly nx: number;
  readonly nz: number;
  readonly x0: number;
  readonly z0: number;
  /** CSR: cellStart[c]..cellStart[c+1] が cellItems の範囲 */
  readonly cellStart: Int32Array;
  readonly cellItems: Int32Array;
  readonly stamp: Int32Array;
  stampId = 1;

  // TS のパラメータプロパティは使わない（Node の型ストリップ実行で読めるように）
  constructor(boxes: Float32Array, flags: Uint8Array, bounds: number[], cell = 2) {
    this.boxes = boxes;
    this.flags = flags;
    this.cell = cell;
    this.x0 = bounds[0] - 1; this.z0 = bounds[2] - 1;
    this.nx = Math.max(1, Math.ceil((bounds[3] - bounds[0] + 2) / cell));
    this.nz = Math.max(1, Math.ceil((bounds[5] - bounds[2] + 2) / cell));
    const n = boxes.length / 6;
    const counts = new Int32Array(this.nx * this.nz);
    const cellOf = (x: number, z: number): [number, number] => [
      Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / cell))),
      Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.z0) / cell))),
    ];
    const ranges: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const [ax, az] = cellOf(boxes[i * 6], boxes[i * 6 + 2]);
      const [bx, bz] = cellOf(boxes[i * 6 + 3], boxes[i * 6 + 5]);
      ranges.push([ax, az, bx, bz]);
      for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) counts[z * this.nx + x]++;
    }
    this.cellStart = new Int32Array(this.nx * this.nz + 1);
    for (let c = 0; c < counts.length; c++) this.cellStart[c + 1] = this.cellStart[c] + counts[c];
    this.cellItems = new Int32Array(this.cellStart[counts.length]);
    const fill = new Int32Array(counts.length);
    for (let i = 0; i < n; i++) {
      const [ax, az, bx, bz] = ranges[i];
      for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
        const c = z * this.nx + x;
        this.cellItems[this.cellStart[c] + fill[c]++] = i;
      }
    }
    this.stamp = new Int32Array(n);
  }

  cellX(x: number): number { return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / this.cell))); }
  cellZ(z: number): number { return Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.z0) / this.cell))); }

  /** 線分 a→b が flag を持つ箱に遮られるか（2D DDA でセルを辿る） */
  segmentBlocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number, flag: number, skip: number): boolean {
    const boxes = this.boxes, flags = this.flags;
    const id = ++this.stampId;
    const stamp = this.stamp;
    let cx = this.cellX(ax), cz = this.cellZ(az);
    const ex = this.cellX(bx), ez = this.cellZ(bz);
    const dx = bx - ax, dz = bz - az;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    // 次のセル境界までの t（線分パラメータ）
    let tMaxX = dx !== 0 ? ((this.x0 + (cx + (stepX > 0 ? 1 : 0)) * this.cell) - ax) / dx : Infinity;
    let tMaxZ = dz !== 0 ? ((this.z0 + (cz + (stepZ > 0 ? 1 : 0)) * this.cell) - az) / dz : Infinity;
    const tDeltaX = dx !== 0 ? Math.abs(this.cell / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(this.cell / dz) : Infinity;
    for (let guard = 0; guard < 512; guard++) {
      const c = cz * this.nx + cx;
      const s0 = this.cellStart[c], s1 = this.cellStart[c + 1];
      for (let k = s0; k < s1; k++) {
        const i = this.cellItems[k];
        if (stamp[i] === id || i === skip || !(flags[i] & flag)) continue;
        stamp[i] = id;
        if (segmentHitsBox(ax, ay, az, bx, by, bz, boxes, i * 6)) return true;
      }
      if (cx === ex && cz === ez) return false;
      if (tMaxX < tMaxZ) { if (tMaxX > 1) return false; cx += stepX; tMaxX += tDeltaX; }
      else { if (tMaxZ > 1) return false; cz += stepZ; tMaxZ += tDeltaZ; }
      if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) return false;
    }
    return false;
  }

  /** 点 p の半径 r 内のセルにある箱（flag 付き）を out に集める。戻り値は個数 */
  gather(px: number, pz: number, r: number, flag: number, out: Int32Array): number {
    const id = ++this.stampId;
    const x0 = this.cellX(px - r), x1 = this.cellX(px + r), z0 = this.cellZ(pz - r), z1 = this.cellZ(pz + r);
    let n = 0;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const c = z * this.nx + x;
      for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) {
        const i = this.cellItems[k];
        if (this.stamp[i] === id || !(this.flags[i] & flag)) continue;
        this.stamp[i] = id;
        if (n < out.length) out[n++] = i;
      }
    }
    return n;
  }
}

// ---------------------------------------------------------------- テクセル焼き込み

/** 1 部屋のライトマップを焼く（Worker 内でも Node でも呼べる純関数）。戻り値は RGBA half float */
export function bakeLightmap(req: BakeRequest): BakeResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const W = req.width, H = req.height;
  const out = new Uint16Array(W * H * 4);
  const fx = req.fixtures;
  const nf = fx.length / FIXTURE_STRIDE;
  const { samples, offset: sOff } = buildFixtureSamples(fx);
  const grid = new OccluderGrid(req.occluders, req.occluderFlags, req.bounds);
  const dirs = hemisphereDirections(Math.max(4, req.aoRays));
  const nRays = req.aoRays;
  const T = LIGHT_TUNING;
  const amb = req.ambient, sky = req.skyAmbient;
  const dl = req.directionals;
  const nd = dl.length / 7;
  const range2 = T.range * T.range;
  const cand = new Int32Array(512);
  let rays = 0;
  let texels = 0;
  let lumSum = 0, lumN = 0;
  let ao = new Float32Array(64);
  let aoBlur = new Float32Array(64);
  /** 面ごとの色バッファと有効マスク（遮蔽体の中に埋まったテクセルは近傍の有効テクセルで埋める = dilation） */
  let col = new Float32Array(64 * 3);
  let valid = new Uint8Array(64);
  const cand2 = new Int32Array(512);
  /** 点が遮蔽体（AO 用フラグ）の内部にあるか（面から 2 cm 浮かせた点なので自分の箱には入らない） */
  const insideAny = (X: number, Y: number, Z: number, n: number, list: Int32Array): boolean => {
    const bx = req.occluders;
    for (let k = 0; k < n; k++) {
      const o = list[k] * 6;
      if (X > bx[o] + 0.004 && X < bx[o + 3] - 0.004 && Y > bx[o + 1] + 0.004 && Y < bx[o + 4] - 0.004 && Z > bx[o + 2] + 0.004 && Z < bx[o + 5] - 0.004) return true;
    }
    return false;
  };
  const nFaces = req.faces.length / FACE_STRIDE;
  // 近い器具（面サンプル + 4 本の遮蔽レイ）の遮蔽レイの向け先: サンプルの 4 隅相当
  const shadowSampleIdx = (i: number): number[] => {
    const s0 = sOff[i], n = sOff[i + 1] - s0;
    if (n <= 1) return [s0];
    if (n === 2) return [s0, s0 + 1];
    return [s0, s0 + Math.floor(n / 3), s0 + Math.floor((2 * n) / 3), s0 + n - 1];
  };
  const shadowIdx: number[][] = [];
  for (let i = 0; i < nf; i++) shadowIdx.push(shadowSampleIdx(i));
  // 遠い器具（d > farShadow）と反射光だけの組（E = 0）の遮蔽は、セル（2 m）中心 × 器具ごとに 1 回だけ判定して共有する
  // （食堂の 53k テクセル × 器具 48 台で遮蔽レイが半減）。0 = 未計算 / 1 = 見える / 2 = 遮られる
  const farShadow2 = 7 * 7;
  const cellVis = new Uint8Array(grid.nx * grid.nz * Math.max(1, nf));
  const cellVisible = (cell: number, k: number, y: number): boolean => {
    const idx = cell * nf + k;
    let v = cellVis[idx];
    if (v === 0) {
      const cx = grid.x0 + ((cell % grid.nx) + 0.5) * grid.cell, cz = grid.z0 + (Math.floor(cell / grid.nx) + 0.5) * grid.cell;
      const o = k * FIXTURE_STRIDE;
      rays++;
      v = grid.segmentBlocked(cx, y, cz, fx[o + F_CX], fx[o + F_CX + 1], fx[o + F_CX + 2], OCC_SHADOW, -1) ? 2 : 1;
      cellVis[idx] = v;
    }
    return v === 1;
  };

  for (let f = 0; f < nFaces; f++) {
    const fo = f * FACE_STRIDE;
    const px0 = req.faces[fo], py0 = req.faces[fo + 1], pw = req.faces[fo + 2], ph = req.faces[fo + 3];
    const ox = req.faces[fo + 4], oy = req.faces[fo + 5], oz = req.faces[fo + 6];
    const ux = req.faces[fo + 7], uy = req.faces[fo + 8], uz = req.faces[fo + 9];
    const vx = req.faces[fo + 10], vy = req.faces[fo + 11], vz = req.faces[fo + 12];
    const nx = req.faces[fo + 13], ny = req.faces[fo + 14], nz = req.faces[fo + 15];
    const fw = req.faces[fo + 16], fh = req.faces[fo + 17];
    const boxId = req.faces[fo + 18];
    const tw = fw / pw, th = fh / ph; // テクセルの実寸
    const PW = pw + 2, PH = ph + 2;
    if (ao.length < PW * PH) { ao = new Float32Array(PW * PH); aoBlur = new Float32Array(PW * PH); col = new Float32Array(PW * PH * 3); valid = new Uint8Array(PW * PH); }
    const hemi = hemiWeight(ny);
    // 有効マスク: 遮蔽体の中に埋まるテクセル（壁の下の床、隅の壁端など）は計算せず、後で近傍から埋める
    let invalidCount = 0;
    {
      let lastCell = -1, nc = 0;
      for (let j = -1; j <= ph; j++) {
        const b = Math.min(fh - 0.005, Math.max(0.005, (j + 0.5) * th));
        for (let i = -1; i <= pw; i++) {
          const a = Math.min(fw - 0.005, Math.max(0.005, (i + 0.5) * tw));
          const X = ox + ux * a + vx * b + nx * 0.02, Y = oy + uy * a + vy * b + ny * 0.02, Z = oz + uz * a + vz * b + nz * 0.02;
          const cell = grid.cellZ(Z) * grid.nx + grid.cellX(X);
          if (cell !== lastCell) { nc = grid.gather(X, Z, 0.3, OCC_AO, cand2); lastCell = cell; }
          const ok = nc === 0 || !insideAny(X, Y, Z, nc, cand2) ? 1 : 0;
          valid[(j + 1) * PW + (i + 1)] = ok;
          if (!ok) invalidCount++;
        }
      }
    }
    // ---- pass 1: AO（縁の画素は面の縁の位置で評価）
    const doAO = req.occlusion && nRays > 0;
    if (doAO) {
      let lastCell = -1, nc = 0;
      for (let j = -1; j <= ph; j++) {
        const b = Math.min(fh - 0.005, Math.max(0.005, (j + 0.5) * th));
        for (let i = -1; i <= pw; i++) {
          const a = Math.min(fw - 0.005, Math.max(0.005, (i + 0.5) * tw));
          const X = ox + ux * a + vx * b + nx * 0.02, Y = oy + uy * a + vy * b + ny * 0.02, Z = oz + uz * a + vz * b + nz * 0.02;
          if (!valid[(j + 1) * PW + (i + 1)]) { ao[(j + 1) * PW + (i + 1)] = 1; continue; }
          const cell = grid.cellZ(Z) * grid.nx + grid.cellX(X);
          if (cell !== lastCell) { nc = grid.gather(X, Z, T.aoRadius, OCC_AO, cand); lastCell = cell; }
          let occ = 0;
          if (nc > 0) {
            const rot = hash01(i + 7, j + 13, f) * Math.PI * 2;
            const cr = Math.cos(rot), sr = Math.sin(rot);
            for (let r = 0; r < nRays; r++) {
              const lx = dirs[r * 3], ly = dirs[r * 3 + 1], lz = dirs[r * 3 + 2];
              const tx = lx * cr - ly * sr, ty = lx * sr + ly * cr;
              const dx = ux * tx + vx * ty + nx * lz, dy = uy * tx + vy * ty + ny * lz, dz = uz * tx + vz * ty + nz * lz;
              const ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9);
              let best = T.aoRadius;
              for (let k = 0; k < nc; k++) {
                const bi = cand[k];
                if (bi === boxId) continue;
                const t = rayBoxT(X, Y, Z, ix, iy, iz, req.occluders, bi * 6, 0.005, best);
                if (t >= 0 && t < best) best = t;
              }
              rays++;
              if (best < T.aoRadius) occ += 1 - best / T.aoRadius;
            }
          }
          ao[(j + 1) * PW + (i + 1)] = 1 - occ / nRays;
        }
      }
      // 3×3 ぼかし（縁はクランプ、無効テクセルは除く）
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const jj = Math.min(PH - 1, Math.max(0, j + dj)), ii = Math.min(PW - 1, Math.max(0, i + di));
          if (!valid[jj * PW + ii]) continue;
          s += ao[jj * PW + ii]; n++;
        }
        aoBlur[j * PW + i] = n ? s / n : 1;
      }
    }
    // ---- pass 2: 環境光 × 反射光の広がり × AO + 直接光 + 滲み + 平行光
    for (let j = -1; j <= ph; j++) {
      const b = Math.min(fh - 0.005, Math.max(0.005, (j + 0.5) * th));
      for (let i = -1; i <= pw; i++) {
        const ci = (j + 1) * PW + (i + 1);
        if (!valid[ci]) continue;
        const a = Math.min(fw - 0.005, Math.max(0.005, (i + 0.5) * tw));
        const X = ox + ux * a + vx * b + nx * 0.02, Y = oy + uy * a + vy * b + ny * 0.02, Z = oz + uz * a + vz * b + nz * 0.02;
        let dr = 0, dg = 0, db = 0; // 直接光（色付き）
        let B = 0; // 反射光の重み
        for (let k = 0; k < nf; k++) {
          const o = k * FIXTURE_STRIDE;
          const cx = fx[o + F_CX], cy = fx[o + F_CX + 1], cz = fx[o + F_CX + 2];
          const ddx = cx - X, ddy = cy - Y, ddz = cz - Z;
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 > range2) continue;
          const bw = bounceWeight(fx, k, X, Y, Z);
          const near = fixtureIsNear(fx, k, X, Y, Z);
          const E = fixtureIrradiance(fx, k, samples, sOff, X, Y, Z, nx, ny, nz, near);
          const halo = fixtureHalo(fx, k, X, Y, Z, nx, ny, nz);
          let vis = 1;
          if (req.occlusion) {
            if (near && E > 0) {
              const idx = shadowIdx[k];
              let hit = 0;
              for (const s of idx) {
                rays++;
                if (grid.segmentBlocked(X, Y, Z, samples[s * 3], samples[s * 3 + 1], samples[s * 3 + 2], OCC_SHADOW, boxId)) hit++;
              }
              vis = 1 - hit / idx.length;
            } else if (E > 0 && d2 < farShadow2) {
              rays++;
              vis = grid.segmentBlocked(X, Y, Z, cx, cy, cz, OCC_SHADOW, boxId) ? 0 : 1;
            } else if (E > 0 || bw > 0.02) {
              vis = cellVisible(grid.cellZ(Z) * grid.nx + grid.cellX(X), k, Math.min(Math.max(Y, cy - 2.5), cy - 0.3)) ? 1 : 0;
            }
          }
          const dirF = T.occludedDirect + (1 - T.occludedDirect) * vis;
          const bF = T.occludedBounce + (1 - T.occludedBounce) * vis;
          B += bw * bF;
          const e = E * dirF + halo; // 滲みは天井側の面なので遮蔽判定しない
          if (e > 0) { dr += fx[o + F_R] * e; dg += fx[o + F_R + 1] * e; db += fx[o + F_R + 2] * e; }
        }
        const S = bounceScale(B);
        const aoV = doAO ? aoBlur[(j + 1) * PW + (i + 1)] : 1;
        const aoF = T.aoFloor + (1 - T.aoFloor) * aoV;
        const ambK = T.ambientScale * S * hemi * aoF;
        let r = amb[0] * ambK + dr, g = amb[1] * ambK + dg, bl = amb[2] * ambK + db;
        if (sky) { const up = (0.5 + 0.5 * ny) * aoF; r += sky[0] * up; g += sky[1] * up; bl += sky[2] * up; }
        for (let k = 0; k < nd; k++) {
          const o = k * 7;
          const lambert = -(dl[o] * nx + dl[o + 1] * ny + dl[o + 2] * nz);
          if (lambert <= 0.01) continue;
          let occ = false;
          if (req.occlusion) { rays++; occ = grid.segmentBlocked(X, Y, Z, X - dl[o] * 40, Y - dl[o + 1] * 40, Z - dl[o + 2] * 40, OCC_SHADOW, boxId); }
          const e = dl[o + 6] * lambert * (occ ? 0.08 : 1);
          r += dl[o + 3] * e; g += dl[o + 4] * e; bl += dl[o + 5] * e;
        }
        col[ci * 3] = r; col[ci * 3 + 1] = g; col[ci * 3 + 2] = bl;
        if (i >= 0 && j >= 0 && i < pw && j < ph) { lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * bl; lumN++; }
      }
    }
    // dilation: 無効テクセルを最も近い有効テクセルの色で埋める（無ければ環境光の下限）
    if (invalidCount) {
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const ci = j * PW + i;
        if (valid[ci]) continue;
        let found = -1;
        for (let r = 1; r <= 4 && found < 0; r++) {
          for (let dj = -r; dj <= r && found < 0; dj++) for (let di = -r; di <= r; di++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
            const jj = j + dj, ii = i + di;
            if (jj < 0 || ii < 0 || jj >= PH || ii >= PW) continue;
            if (valid[jj * PW + ii]) { found = jj * PW + ii; break; }
          }
        }
        if (found >= 0) { col[ci * 3] = col[found * 3]; col[ci * 3 + 1] = col[found * 3 + 1]; col[ci * 3 + 2] = col[found * 3 + 2]; }
        else { const k = T.ambientScale * T.bounceFloor * hemi; col[ci * 3] = amb[0] * k; col[ci * 3 + 1] = amb[1] * k; col[ci * 3 + 2] = amb[2] * k; }
      }
    }
    // 書き出し（half float）
    for (let j = -1; j <= ph; j++) {
      const row = (py0 + 1 + j) * W;
      for (let i = -1; i <= pw; i++) {
        const ci = (j + 1) * PW + (i + 1);
        const idx = (row + px0 + 1 + i) * 4;
        out[idx] = toHalf(col[ci * 3]); out[idx + 1] = toHalf(col[ci * 3 + 1]); out[idx + 2] = toHalf(col[ci * 3 + 2]); out[idx + 3] = 0x3c00; // alpha 1
        texels++;
      }
    }
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { type: 'done', id: req.id, data: out, ms: t1 - t0, stats: { texels, faces: nFaces, rays, mean: lumN ? lumSum / lumN : 0 } };
}

// ---------------------------------------------------------------- Worker 入口

interface WorkerScope { onmessage: ((e: MessageEvent) => void) | null; postMessage(msg: unknown, transfer?: Transferable[]): void }
declare const WorkerGlobalScope: unknown;

if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined') {
  const scope = self as unknown as WorkerScope;
  scope.onmessage = (e: MessageEvent) => {
    const msg = e.data as BakeRequest;
    if (!msg || msg.type !== 'bake') return;
    try {
      const res = bakeLightmap(msg);
      scope.postMessage(res, [res.data.buffer]);
    } catch (err) {
      scope.postMessage({ type: 'error', id: msg.id, message: String(err) });
    }
  };
}
