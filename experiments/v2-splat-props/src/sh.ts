/**
 * 見る向きで変わる色（球面調和 = SH）を、粒ごとに計算する（DOM・three を使わない。Worker からも呼ぶ）。
 *
 * 粒の色 = 写し取った見た目（焼き込み陰影・環境光・発光）+ 点光源の拡散 + 点光源の鏡面反射（見る向きで変わる）。
 * 点光源の扱いは v2 の材質（three.js の MeshStandardMaterial + v2 の注入）に合わせる:
 *   - 強さ = LightSpec.intensity × 3（FloorBuilder の DYNAMIC_LIGHT_SCALE）、距離の減衰は three の getDistanceAttenuation（decay 2）
 *   - 拡散は × 0.4（MaterialLibrary の liminalDirectDiffuse）、鏡面は GGX（three の BRDF_GGX）
 *   - 鏡面の合計は膝 0.4・上限 1.0 で頭打ち（MaterialLibrary の liminalSpecCap）
 * Spark は「粒の色は sRGB」として描く（線形の RenderTarget へは pow(色, 2.2) して書く）ので、ここでは
 * 線形の値を 1/2.2 乗した値で SH を合わせる（v2 の RenderPass の線形 HDR と同じ明るさになる）。
 * SH の向き・係数の並びは Spark（3DGS と同じ）: viewDir = 粒の中心 − 視点（正規化、粒の座標系）。
 */

export const SH_C1 = 0.4886025;

/** 帯 1〜3 の 15 個の基底（Spark の evaluateExtSH と同じ並び・符号） */
export function shBasis(x: number, y: number, z: number, out: Float64Array): void {
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, yz = y * z, zx = z * x;
  out[0] = -SH_C1 * y;
  out[1] = SH_C1 * z;
  out[2] = -SH_C1 * x;
  out[3] = 1.0925484 * xy;
  out[4] = -1.0925484 * yz;
  out[5] = 0.3153915 * (2 * zz - xx - yy);
  out[6] = -1.0925484 * zx;
  out[7] = 0.5462742 * (xx - yy);
  out[8] = -0.5900436 * y * (3 * xx - yy);
  out[9] = 2.8906114 * xy * z;
  out[10] = -0.4570458 * y * (4 * zz - xx - yy);
  out[11] = 0.3731763 * z * (2 * zz - 3 * xx - 3 * yy);
  out[12] = -0.4570458 * x * (4 * zz - xx - yy);
  out[13] = 1.4453057 * z * (xx - yy);
  out[14] = -0.5900436 * x * (xx - 3 * yy);
}

/** 帯の数（1..3）→ 基底の数 */
export const shCount = (degree: number): number => (degree >= 3 ? 15 : degree === 2 ? 8 : degree === 1 ? 3 : 0);

/** 球面上にほぼ均等に散らした向き（フィボナッチ） */
export function sphereDirs(n: number): Float64Array {
  const out = new Float64Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out[i * 3] = Math.cos(golden * i) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(golden * i) * r;
  }
  return out;
}

/**
 * 法線 n の面について、表から見える向き（viewDir）の組と、その向きの値 g_j から [DC, 係数…] を出す行列（最小二乗 + 高い帯ほど強い正則化）。
 * 返す P は (1 + K) × M（M は表の向きの数）。
 */
export function fitMatrix(nx: number, ny: number, nz: number, dirs: Float64Array, degree: number, lambda = 0.02): { P: Float64Array; front: Int32Array; rows: number } {
  const K = shCount(degree);
  const B = 1 + K;
  const front: number[] = [];
  for (let j = 0; j < dirs.length / 3; j++) {
    // viewDir（視点 → 粒）の逆が粒から視点への向き。表から見えるのは (−viewDir)·n > 0
    const c = -(dirs[j * 3]! * nx + dirs[j * 3 + 1]! * ny + dirs[j * 3 + 2]! * nz);
    if (c > 0.06) front.push(j);
  }
  const M = front.length;
  const phi = new Float64Array(M * B);
  const y = new Float64Array(15);
  for (let r = 0; r < M; r++) {
    const j = front[r]!;
    shBasis(dirs[j * 3]!, dirs[j * 3 + 1]!, dirs[j * 3 + 2]!, y);
    phi[r * B] = 1;
    for (let k = 0; k < K; k++) phi[r * B + 1 + k] = y[k]!;
  }
  // A = ΦᵀΦ + Λ（帯 1: λ, 帯 2: 2λ, 帯 3: 4λ）
  const A = new Float64Array(B * B);
  for (let a = 0; a < B; a++) for (let b = 0; b < B; b++) {
    let s = 0;
    for (let r = 0; r < M; r++) s += phi[r * B + a]! * phi[r * B + b]!;
    A[a * B + b] = s;
  }
  for (let k = 1; k < B; k++) A[k * B + k] = A[k * B + k]! + lambda * M * (k <= 3 ? 1 : k <= 8 ? 2 : 4);
  const inv = invert(A, B);
  // P = A⁻¹ Φᵀ
  const P = new Float64Array(B * M);
  for (let a = 0; a < B; a++) for (let r = 0; r < M; r++) {
    let s = 0;
    for (let b = 0; b < B; b++) s += inv[a * B + b]! * phi[r * B + b]!;
    P[a * M + r] = s;
  }
  return { P, front: Int32Array.from(front), rows: B };
}

function invert(m: Float64Array, n: number): Float64Array {
  const a = Float64Array.from(m);
  const inv = new Float64Array(n * n);
  for (let i = 0; i < n; i++) inv[i * n + i] = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r * n + c]!) > Math.abs(a[p * n + c]!)) p = r;
    if (p !== c) for (let k = 0; k < n; k++) {
      [a[c * n + k], a[p * n + k]] = [a[p * n + k]!, a[c * n + k]!];
      [inv[c * n + k], inv[p * n + k]] = [inv[p * n + k]!, inv[c * n + k]!];
    }
    const d = a[c * n + c]!;
    for (let k = 0; k < n; k++) { a[c * n + k] = a[c * n + k]! / d; inv[c * n + k] = inv[c * n + k]! / d; }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r * n + c]!;
      if (!f) continue;
      for (let k = 0; k < n; k++) { a[r * n + k] = a[r * n + k]! - f * a[c * n + k]!; inv[r * n + k] = inv[r * n + k]! - f * inv[c * n + k]!; }
    }
  }
  return inv;
}

/** 点光源（粒の座標系）。color は線形の色 × 強さ（× 3 済み） */
export interface ShLight { x: number; y: number; z: number; r: number; g: number; b: number; distance: number }

/** 材質ごとの映り込みの値（v2 の材質オブジェクトから読む） */
export interface ShMaterial {
  /** 環境マップの番号（ShEnv.probes の添字。無ければ −1） */
  env: number;
  envIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

/** 環境マップ（env.ts の緯度経度の画像）と、粒の座標系 → ワールドの回転（行優先 3×3） */
export interface ShEnv {
  levels: number[];
  w: number;
  h: number;
  probes: Float32Array[][];
  materials: ShMaterial[];
  rot: number[];
}

export interface ShParams {
  degree: number;
  /** 見る向きで変わる分（点光源の鏡面反射・環境の映り込み）の倍率。v2 と同じは 1 */
  gloss: number;
  /** 粗さの倍率（小さいほど映り込みが鋭い。v2 と同じは 1） */
  roughScale: number;
  /** 動的な点光源の拡散の倍率（v2 の liminalDirectDiffuse） */
  directDiffuse: number;
  /** 球面の向きの数 */
  dirCount: number;
  /** 粒ごとに使う点光源の数（強く当たる順。v2 も動的な点光源は 8 灯まで） */
  maxLights: number;
}

export const DEFAULT_SH_PARAMS: ShParams = { degree: 3, gloss: 1, roughScale: 1, directDiffuse: 0.4, dirCount: 48, maxLights: 8 };

/** 6 方向の面の法線（capture.ts の DIRS と同じ並び） */
export const FACE_NORMALS: readonly [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export interface ShInput {
  n: number;
  center: Float32Array; // 3n（粒の座標系）
  dir: Uint8Array; // n（面の向き 0..5）
  base: Float32Array; // 3n（写し取った見た目。線形）
  albedo: Float32Array; // 3n（線形）
  rough: Float32Array; // n
  metal: Float32Array; // n
  mat: Uint16Array; // n（ShEnv.materials の添字）
  /** 粒ごとの法線（3n。無ければ dir の面の向き） */
  normal?: Float32Array;
  /**
   * base が「下の層（拡散 + 光る分）」そのもの（コードで作った粒）。false なら base は v2 の材質を正面から写した値で、
   * 正面の映り込み・クリアコートを含む（そこから下の層を取り出す）
   */
  lowLayer?: boolean;
}

export interface ShOutput {
  dc: Float32Array; // 3n（1/2.2 乗した値）
  sh: Float32Array; // n × K × 3（rgb を並べる）
  degree: number;
  glossy: number;
}

const SPEC_KNEE = 0.4, SPEC_MAX = 1.0;
const INV_PI = 1 / Math.PI;
const GAMMA = 1 / 2.2;

/** v2 の liminalSpecCap（最大の成分に対して膝から上を柔らかく頭打ち）。out に書く */
function cap(r: number, g: number, b: number, out: number[]): void {
  const m = Math.max(r, g, b);
  let k = 1;
  if (m > SPEC_KNEE) { const e = m - SPEC_KNEE; k = (SPEC_KNEE + e / (1 + e / (SPEC_MAX - SPEC_KNEE))) / m; }
  out[0] = r * k; out[1] = g * k; out[2] = b * k;
}

/** three の DFGApprox（環境光の鏡面反射の係数 fab） */
function dfg(ndv: number, rough: number, out: number[]): void {
  const r0 = rough * -1 + 1, r1 = rough * -0.0275 + 0.0425, r2 = rough * -0.572 + 1.04, r3 = rough * 0.022 - 0.04;
  const a004 = Math.min(r0 * r0, Math.pow(2, -9.28 * ndv)) * r0 + r1;
  out[0] = -1.04 * a004 + r2;
  out[1] = 1.04 * a004 + r3;
}

/** three の getDistanceAttenuation（decay 2） */
function falloff(d: number, cutoff: number): number {
  let f = 1 / Math.max(d * d, 0.01);
  if (cutoff > 0) { const t = Math.max(0, 1 - (d / cutoff) ** 4); f *= t * t; }
  return f;
}

/** 緯度経度の画像を引く（粗さの段の間は線形に混ぜる）。out に足す（× k） */
export function envAdd(env: ShEnv, probe: Float32Array[], x: number, y: number, z: number, rough: number, k: number, out: number[]): void {
  const { w, h, levels } = env;
  const th = Math.acos(Math.max(-1, Math.min(1, y)));
  let ph = Math.atan2(z, x);
  if (ph < 0) ph += Math.PI * 2;
  const fu = (ph / (Math.PI * 2)) * w - 0.5, fv = (th / Math.PI) * h - 0.5;
  const u0 = Math.floor(fu), v0 = Math.floor(fv);
  const tu = fu - u0, tv = fv - v0;
  const ua = ((u0 % w) + w) % w, ub = (ua + 1) % w;
  const va = Math.max(0, Math.min(h - 1, v0)), vb = Math.max(0, Math.min(h - 1, v0 + 1));
  let li = 0;
  while (li < levels.length - 2 && rough > levels[li + 1]!) li++;
  const t = Math.max(0, Math.min(1, (rough - levels[li]!) / (levels[li + 1]! - levels[li]!)));
  for (let s = 0; s < 2; s++) {
    const img = probe[li + s]!;
    const ws = (s === 0 ? 1 - t : t) * k;
    if (ws === 0) continue;
    for (let c = 0; c < 3; c++) {
      const a = img[(va * w + ua) * 3 + c]!, b = img[(va * w + ub) * 3 + c]!, cc = img[(vb * w + ua) * 3 + c]!, d = img[(vb * w + ub) * 3 + c]!;
      out[c] = out[c]! + ws * ((a * (1 - tu) + b * tu) * (1 - tv) + (cc * (1 - tu) + d * tu) * tv);
    }
  }
}

/**
 * 見る向き v（粒から視点、粒の座標系）での「動的な光と映り込み」を out（線形 RGB）に書く。
 * v2 の材質（three の MeshStandard / MeshPhysical + v2 の頭打ち）に合わせた式:
 *   鏡面（点光源）= Σ 照度 × GGX、映り込み = 環境マップ（粗さでぼかした値）× DFG、クリアコートはその上に重ね、下の層を (1 − cc·F) だけ弱める
 */
function viewTerms(
  px: number, py: number, pz: number, nx: number, ny: number, nz: number, vx: number, vy: number, vz: number,
  ar: number, ag: number, ab: number, metal: number, rough: number, mat: ShMaterial, probe: Float32Array[] | null, env: ShEnv | null,
  lights: ShLight[], out: ViewTerms,
): void {
  const ndv = Math.max(1e-3, vx * nx + vy * ny + vz * nz);
  const f0r = 0.04 + (ar - 0.04) * metal, f0g = 0.04 + (ag - 0.04) * metal, f0b = 0.04 + (ab - 0.04) * metal;
  const a2 = rough * rough * rough * rough;
  const cc = mat.clearcoat;
  const ccRough = Math.min(1, Math.max(0.0525, mat.clearcoatRoughness));
  const ca2 = ccRough ** 4;
  let sr = 0, sg = 0, sb = 0, cr = 0, cg = 0, cb = 0;
  for (const L of lights) {
    let lx = L.x - px, ly = L.y - py, lz = L.z - pz;
    const dist = Math.hypot(lx, ly, lz);
    lx /= dist; ly /= dist; lz /= dist;
    const ndl = lx * nx + ly * ny + lz * nz;
    if (ndl <= 0) continue;
    let hx = lx + vx, hy = ly + vy, hz = lz + vz;
    const hl = Math.hypot(hx, hy, hz) || 1;
    hx /= hl; hy /= hl; hz /= hl;
    const ndh = Math.max(0, hx * nx + hy * ny + hz * nz);
    const vdh = Math.max(0, hx * vx + hy * vy + hz * vz);
    const fw = Math.pow(1 - vdh, 5);
    const irr = ndl * falloff(dist, L.distance);
    // three の V_GGX_SmithCorrelated と D_GGX
    const vis = 0.5 / Math.max(ndl * Math.sqrt(a2 + (1 - a2) * ndv * ndv) + ndv * Math.sqrt(a2 + (1 - a2) * ndl * ndl), 1e-6);
    const den = ndh * ndh * (a2 - 1) + 1;
    const k = irr * vis * INV_PI * a2 / (den * den);
    sr += k * L.r * (f0r + (1 - f0r) * fw);
    sg += k * L.g * (f0g + (1 - f0g) * fw);
    sb += k * L.b * (f0b + (1 - f0b) * fw);
    if (cc > 0) {
      const cvis = 0.5 / Math.max(ndl * Math.sqrt(ca2 + (1 - ca2) * ndv * ndv) + ndv * Math.sqrt(ca2 + (1 - ca2) * ndl * ndl), 1e-6);
      const cden = ndh * ndh * (ca2 - 1) + 1;
      const ck = irr * cvis * INV_PI * ca2 / (cden * cden) * (0.04 + 0.96 * fw);
      cr += ck * L.r; cg += ck * L.g; cb += ck * L.b;
    }
  }
  cap(sr, sg, sb, out.spec);
  // 映り込み（環境マップ）
  const e = out.envSpec;
  e[0] = e[1] = e[2] = 0;
  const ce = [0, 0, 0];
  if (probe && env) {
    const fab = [0, 0];
    // reflect(−v, n) を粗さで法線へ寄せる（three の getIBLRadiance）
    const reflect = (r2: number, target: number[], k: number): void => {
      let rx = 2 * ndv * nx - vx, ry = 2 * ndv * ny - vy, rz = 2 * ndv * nz - vz;
      const m = r2 * r2;
      rx += (nx - rx) * m; ry += (ny - ry) * m; rz += (nz - rz) * m;
      const rl = Math.hypot(rx, ry, rz) || 1;
      rx /= rl; ry /= rl; rz /= rl;
      const R = env.rot;
      envAdd(env, probe, R[0]! * rx + R[1]! * ry + R[2]! * rz, R[3]! * rx + R[4]! * ry + R[5]! * rz, R[6]! * rx + R[7]! * ry + R[8]! * rz, r2, k, target);
    };
    reflect(rough, e, mat.envIntensity);
    dfg(ndv, rough, fab);
    e[0] = e[0]! * (f0r * fab[0]! + fab[1]!); e[1] = e[1]! * (f0g * fab[0]! + fab[1]!); e[2] = e[2]! * (f0b * fab[0]! + fab[1]!);
    cap(e[0]!, e[1]!, e[2]!, e);
    if (cc > 0) {
      reflect(ccRough, ce, mat.envIntensity);
      dfg(ndv, ccRough, fab);
      const kk = 0.04 * fab[0]! + fab[1]!;
      ce[0] = ce[0]! * kk; ce[1] = ce[1]! * kk; ce[2] = ce[2]! * kk;
    }
  }
  // クリアコートは直接光・映り込みをそれぞれ頭打ちしてから厚さ（cc）を掛ける（v2 と同じ）
  cap(cr, cg, cb, out.ccDirect);
  cap(ce[0]!, ce[1]!, ce[2]!, out.ccEnv);
  for (let c = 0; c < 3; c++) { out.ccDirect[c] = out.ccDirect[c]! * cc; out.ccEnv[c] = out.ccEnv[c]! * cc; }
  // クリアコートのフレネル（下の層を弱める割合）
  out.att = 1 - cc * (0.04 + 0.96 * Math.pow(1 - ndv, 5));
}

interface ViewTerms { spec: number[]; envSpec: number[]; ccDirect: number[]; ccEnv: number[]; att: number }

/** 粒ごとの DC と SH 係数を計算する */
export function computeSh(input: ShInput, lights: ShLight[], p: ShParams, env: ShEnv | null): ShOutput {
  const { n } = input;
  const K = shCount(p.degree);
  const dirs = sphereDirs(p.dirCount);
  const fits = FACE_NORMALS.map(([x, y, z]) => fitMatrix(x, y, z, dirs, p.degree));
  // 粒ごとの法線: 1/8 刻みに丸めた向きごとに行列を作って使い回す
  const fitCache = new Map<number, ReturnType<typeof fitMatrix>>();
  const fitFor = (x: number, y: number, z: number): ReturnType<typeof fitMatrix> => {
    const qx = Math.round(x * 8), qy = Math.round(y * 8), qz = Math.round(z * 8);
    const key = ((qx + 8) * 17 + (qy + 8)) * 17 + (qz + 8);
    let f = fitCache.get(key);
    if (!f) { const l = Math.hypot(qx, qy, qz) || 1; f = fitMatrix(qx / l, qy / l, qz / l, dirs, p.degree); fitCache.set(key, f); }
    return f;
  };
  const dc = new Float32Array(n * 3);
  const sh = new Float32Array(n * K * 3);
  const maxM = dirs.length / 3;
  const gR = new Float64Array(maxM), gG = new Float64Array(maxM), gB = new Float64Array(maxM);
  const noMat: ShMaterial = { env: -1, envIntensity: 0, clearcoat: 0, clearcoatRoughness: 0 };
  const at: ViewTerms = { spec: [0, 0, 0], envSpec: [0, 0, 0], ccDirect: [0, 0, 0], ccEnv: [0, 0, 0], att: 1 };
  const near: ShLight[] = [];
  const weight = new Float64Array(lights.length);
  const order = lights.map((_, k) => k);
  let glossy = 0;
  for (let i = 0; i < n; i++) {
    const px = input.center[i * 3]!, py = input.center[i * 3 + 1]!, pz = input.center[i * 3 + 2]!;
    const [nx, ny, nz] = input.normal ? [input.normal[i * 3]!, input.normal[i * 3 + 1]!, input.normal[i * 3 + 2]!] : FACE_NORMALS[input.dir[i]!]!;
    const ar = input.albedo[i * 3]!, ag = input.albedo[i * 3 + 1]!, ab = input.albedo[i * 3 + 2]!;
    const metal = input.metal[i]!;
    const mat = env?.materials[input.mat[i]!] ?? noMat;
    const probe = env && mat.env >= 0 ? env.probes[mat.env] ?? null : null;
    // この粒に強く当たる点光源を選ぶ（照度の大きい順に maxLights 灯）
    for (let k = 0; k < lights.length; k++) {
      const L = lights[k]!;
      const lx = L.x - px, ly = L.y - py, lz = L.z - pz;
      const dist = Math.hypot(lx, ly, lz);
      const ndl = (lx * nx + ly * ny + lz * nz) / dist;
      weight[k] = ndl <= 0 ? 0 : ndl * falloff(dist, L.distance) * Math.max(L.r, L.g, L.b);
    }
    near.length = 0;
    if (lights.length <= p.maxLights) { for (let k = 0; k < lights.length; k++) if (weight[k]! > 0) near.push(lights[k]!); }
    else {
      order.sort((a, b) => weight[b]! - weight[a]!);
      for (let k = 0; k < p.maxLights && weight[order[k]!]! > 0; k++) near.push(lights[order[k]!]!);
    }
    // 点光源の拡散（向きに依らない）
    let dr = 0, dg = 0, db = 0;
    const kd = (1 - metal) * INV_PI * p.directDiffuse;
    for (const L of near) {
      const lx = L.x - px, ly = L.y - py, lz = L.z - pz;
      const dist = Math.hypot(lx, ly, lz);
      const ndl = (lx * nx + ly * ny + lz * nz) / dist;
      if (ndl <= 0) continue;
      const k = ndl * falloff(dist, L.distance) * kd;
      dr += k * L.r * ar; dg += k * L.g * ag; db += k * L.b * ab;
    }
    const cr = input.base[i * 3]!, cg = input.base[i * 3 + 1]!, cb = input.base[i * 3 + 2]!;
    const br = cr + dr, bg = cg + dg, bb = cb + db;
    const rough = Math.min(1, Math.max(0.0525, input.rough[i]! * p.roughScale));
    const m2: ShMaterial = p.roughScale === 1 ? mat : { ...mat, clearcoatRoughness: mat.clearcoatRoughness * p.roughScale };
    const isGlossy = K > 0 && p.gloss > 0 && (near.length > 0 || !!probe) && (metal > 0.3 || rough < 0.85 || mat.clearcoat > 0);
    if (!isGlossy) {
      dc[i * 3] = Math.pow(Math.max(0, br), GAMMA);
      dc[i * 3 + 1] = Math.pow(Math.max(0, bg), GAMMA);
      dc[i * 3 + 2] = Math.pow(Math.max(0, bb), GAMMA);
      continue;
    }
    glossy++;
    // 写し取った見た目 C は「正面から・点光源なし」の値: C = (下の層 + 映り込み(正面)) × att(正面) + クリアコートの映り込み(正面)。
    // ここから向きに依らない下の層を取り出す
    let lowR = cr, lowG = cg, lowB = cb;
    if (!input.lowLayer) {
      viewTerms(px, py, pz, nx, ny, nz, nx, ny, nz, ar, ag, ab, metal, rough, m2, probe, env, near, at);
      const att0 = Math.max(1e-3, at.att);
      lowR = Math.max(0, (cr - at.ccEnv[0]!) / att0 - at.envSpec[0]!);
      lowG = Math.max(0, (cg - at.ccEnv[1]!) / att0 - at.envSpec[1]!);
      lowB = Math.max(0, (cb - at.ccEnv[2]!) / att0 - at.envSpec[2]!);
    }
    const fit = input.normal ? fitFor(nx, ny, nz) : fits[input.dir[i]!]!;
    const M = fit.front.length;
    for (let r = 0; r < M; r++) {
      const j = fit.front[r]!;
      const vx = -dirs[j * 3]!, vy = -dirs[j * 3 + 1]!, vz = -dirs[j * 3 + 2]!;
      viewTerms(px, py, pz, nx, ny, nz, vx, vy, vz, ar, ag, ab, metal, rough, m2, probe, env, near, at);
      // この向きの見た目（v2 と同じ式）と、向きに依らない部分（写し + 点光源の拡散）の差に「つや」を掛ける
      const fr = (lowR + dr + at.spec[0]! + at.envSpec[0]!) * at.att + at.ccDirect[0]! + at.ccEnv[0]!;
      const fg = (lowG + dg + at.spec[1]! + at.envSpec[1]!) * at.att + at.ccDirect[1]! + at.ccEnv[1]!;
      const fb = (lowB + db + at.spec[2]! + at.envSpec[2]!) * at.att + at.ccDirect[2]! + at.ccEnv[2]!;
      gR[r] = Math.pow(Math.max(0, br + (fr - br) * p.gloss), GAMMA);
      gG[r] = Math.pow(Math.max(0, bg + (fg - bg) * p.gloss), GAMMA);
      gB[r] = Math.pow(Math.max(0, bb + (fb - bb) * p.gloss), GAMMA);
    }
    const P = fit.P;
    for (let a = 0; a < fit.rows; a++) {
      let xr = 0, xg = 0, xb = 0;
      const row = a * M;
      for (let r = 0; r < M; r++) { const w = P[row + r]!; xr += w * gR[r]!; xg += w * gG[r]!; xb += w * gB[r]!; }
      if (a === 0) { dc[i * 3] = xr; dc[i * 3 + 1] = xg; dc[i * 3 + 2] = xb; }
      else { const o = (i * K + a - 1) * 3; sh[o] = xr; sh[o + 1] = xg; sh[o + 2] = xb; }
    }
  }
  return { dc, sh, degree: p.degree, glossy };
}
