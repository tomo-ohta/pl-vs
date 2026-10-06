/**
 * 粒の配列 → Spark の ExtSplats（位置は単精度、色・不透明度・大きさは半精度。色は 1 を超えてよい＝発光・映り込みの HDR）。
 * SH も ExtSplats の形式（3 つの値で指数を共有する 32 bit）で詰める。並びは Spark の evaluateExtSH と同じ:
 *   sh1[i*4 + 0..2] = 帯 1 の係数 0..2、sh1[i*4 + 3] = 帯 2 の係数 0
 *   sh2[i*4 + 0..3] = 帯 2 の係数 1..4
 *   sh3a[i*4 + 0..3] = 帯 3 の係数 0..3、sh3b[i*4 + 0..2] = 帯 3 の係数 4..6
 */
import * as THREE from 'three';
import { ExtSplats, toHalf } from '@sparkjsdev/spark';
import { DIRS } from './capture.ts';
import type { SplatBatch } from './facegen.ts';
import { shCount, type ShOutput } from './sh.ts';

/** Spark の splat テクスチャの幅（ExtSplats の配列はこの倍数の大きさにする） */
const TEX_WIDTH = 2048;

/** 面の向きごとの回転（粒の x → u、y → v、z → 法線）を ExtSplats の形式で */
let QUAT_CODES: Uint32Array | null = null;
function quatCodes(): Uint32Array {
  if (QUAT_CODES) return QUAT_CODES;
  QUAT_CODES = new Uint32Array(6);
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) {
    const { u, v, d } = DIRS[i]!;
    q.setFromRotationMatrix(m.makeBasis(u, v, d));
    // Spark 自身の符号化を使う（1 粒だけの ExtSplats に入れて読み出す）
    const tmp = new ExtSplats({ maxSplats: 1 });
    tmp.pushSplat(new THREE.Vector3(), new THREE.Vector3(1, 1, 1), q, 1, new THREE.Color());
    QUAT_CODES[i] = tmp.extArrays[1][3]!;
  }
  return QUAT_CODES;
}

/** 面の向き 0..5 の粒の回転の 32 bit */
export const faceQuatCode = (dir: number): number => quatCodes()[dir]!;

/** Spark の encodeQuatOctXy1010R12 と同じ（ExtSplats の回転の 32 bit） */
export function encodeQuat(qx: number, qy: number, qz: number, qw: number): number {
  const ql = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  const s = qw < 0 ? -1 : 1;
  const nx = (s * qx) / ql, ny = (s * qy) / ql, nz = (s * qz) / ql, nw = (s * qw) / ql;
  const theta = 2 * Math.acos(Math.min(1, nw));
  const xyz = Math.sqrt(nx * nx + ny * ny + nz * nz);
  const ax = xyz < 1e-6 ? 1 : nx / xyz, ay = xyz < 1e-6 ? 0 : ny / xyz, az = xyz < 1e-6 ? 0 : nz / xyz;
  const sum = Math.abs(ax) + Math.abs(ay) + Math.abs(az);
  let px = ax / sum, py = ay / sum;
  if (az < 0) {
    const t = px;
    px = (1 - Math.abs(py)) * (px >= 0 ? 1 : -1);
    py = (1 - Math.abs(t)) * (py >= 0 ? 1 : -1);
  }
  const qu = Math.round((px * 0.5 + 0.5) * 1023), qv = Math.round((py * 0.5 + 0.5) * 1023);
  return ((Math.round(theta * (4095 / Math.PI)) << 20) | (qv << 10) | qu) >>> 0;
}

/** Spark の encodeExtRgb と同じ（3 つの値で指数を共有） */
function encodeExtRgb(r: number, g: number, b: number): number {
  const ar = Math.abs(r), ag = Math.abs(g), ab = Math.abs(b);
  const m = Math.max(ar, ag, ab);
  const biasedBase = Math.max(0, Math.min(31, Math.floor(Math.log2(m > 0 ? m : 1e-30)) + 15));
  const divisor = 2 ** (biasedBase - 15) / 255;
  const uR = Math.round(Math.max(0, Math.min(255, ar / divisor)));
  const uG = Math.round(Math.max(0, Math.min(255, ag / divisor)));
  const uB = Math.round(Math.max(0, Math.min(255, ab / divisor)));
  const expSigns = (biasedBase << 3) | ((r < 0 ? 1 : 0) | (g < 0 ? 2 : 0) | (b < 0 ? 4 : 0));
  return (uR | (uG << 8) | (uB << 16) | (expSigns << 24)) >>> 0;
}

/** 粒と SH から ExtSplats を作る（sh が無ければ見る向きで色が変わらない粒） */
export function buildExtSplats(batch: SplatBatch, shade: ShOutput): ExtSplats {
  const n = batch.n;
  const cap = Math.max(TEX_WIDTH, Math.ceil(n / TEX_WIDTH) * TEX_WIDTH);
  const a = new Uint32Array(cap * 4);
  const b = new Uint32Array(cap * 4);
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  const codes = quatCodes();
  const opacity = toHalf(batch.opacity);
  const opacities = (batch as { opacities?: Float32Array }).opacities;
  const negInf = toHalf(-Infinity);
  for (let i = 0; i < n; i++) {
    const i4 = i * 4;
    f32[0] = batch.center[i * 3]!; a[i4] = u32[0]!;
    f32[0] = batch.center[i * 3 + 1]!; a[i4 + 1] = u32[0]!;
    f32[0] = batch.center[i * 3 + 2]!; a[i4 + 2] = u32[0]!;
    a[i4 + 3] = opacities ? toHalf(opacities[i]!) : opacity;
    const r = shade.dc[i * 3]!, g = shade.dc[i * 3 + 1]!, bl = shade.dc[i * 3 + 2]!;
    b[i4] = (toHalf(r) | (toHalf(g) << 16)) >>> 0;
    // 法線の向きの大きさ 0（log = −∞）= 2D ガウシアン（SparkRenderer の enable2DGS）
    b[i4 + 1] = (toHalf(bl) | (toHalf(Math.log(batch.scale[i * 2]!)) << 16)) >>> 0;
    b[i4 + 2] = (toHalf(Math.log(batch.scale[i * 2 + 1]!)) | (negInf << 16)) >>> 0;
    // 面の粒は面の向き、葉の粒は粒ごとの回転
    b[i4 + 3] = batch.quat ? batch.quat[i]! : codes[batch.dir[i]!]!;
  }
  const extra: Record<string, unknown> = {};
  const K = shCount(shade.degree);
  if (K > 0) {
    const sh = shade.sh;
    const c = (i: number, k: number): number => encodeExtRgb(sh[(i * K + k) * 3]!, sh[(i * K + k) * 3 + 1]!, sh[(i * K + k) * 3 + 2]!);
    const sh1 = new Uint32Array(cap * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) sh1[i * 4 + k] = c(i, k);
    extra.sh1 = sh1;
    if (K >= 8) {
      const sh2 = new Uint32Array(cap * 4);
      for (let i = 0; i < n; i++) {
        sh1[i * 4 + 3] = c(i, 3);
        for (let k = 0; k < 4; k++) sh2[i * 4 + k] = c(i, 4 + k);
      }
      extra.sh2 = sh2;
    }
    if (K >= 15) {
      const sh3a = new Uint32Array(cap * 4), sh3b = new Uint32Array(cap * 4);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 4; k++) sh3a[i * 4 + k] = c(i, 8 + k);
        for (let k = 0; k < 3; k++) sh3b[i * 4 + k] = c(i, 12 + k);
      }
      extra.sh3a = sh3a;
      extra.sh3b = sh3b;
    }
  }
  return new ExtSplats({ extArrays: [a, b], numSplats: n, extra });
}

/**
 * 粒ごとの材質（懐中電灯で照らし直すため）: 2 層の半精度テクスチャ。粒の番号 i の位置は Spark の splatTexCoord と同じ
 * （x = i % 2048、y = i / 2048）。層 0 = 地の色 RGB + 粗さ、層 1 = 金属度
 */
export function buildMaterialTexture(batch: SplatBatch): THREE.DataArrayTexture {
  const n = batch.n;
  const rows = Math.max(1, Math.ceil(n / TEX_WIDTH));
  const layer = TEX_WIDTH * rows * 4;
  const data = new Uint16Array(layer * 2);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    data[o] = toHalf(batch.albedo[i * 3]!);
    data[o + 1] = toHalf(batch.albedo[i * 3 + 1]!);
    data[o + 2] = toHalf(batch.albedo[i * 3 + 2]!);
    data[o + 3] = toHalf(batch.rough[i]!);
    data[layer + o] = toHalf(batch.metal[i]!);
  }
  const tex = new THREE.DataArrayTexture(data, TEX_WIDTH, rows, 2);
  tex.type = THREE.HalfFloatType;
  tex.format = THREE.RGBAFormat;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
