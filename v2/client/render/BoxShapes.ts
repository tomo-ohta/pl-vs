/**
 * 箱（Box）を描画のジオメトリにする時の、形の特別扱い（FloorBuilder が surfaceBox の代わりに使う）:
 *
 * - 水面（水の材質: SURFACES の water を持ち、流れ落ちる fall でない物 = 'water' / 'waterShallow'）: 箱の上面だけ。
 *   横・底の面は描かない（水槽の縁や部屋の壁と少しずれても、ガラスの板のような縦の面が見えない）。
 *   水の色の濃さ（水深）は箱の高さ（底 .. 水面）で決まる（FloorBuilder が水面のメッシュの原点を箱の底に置く。waterBase）
 * - 水たまり（'puddle'）: 箱の足跡に収まる不定形の輪郭の平面（v1 RoomBuilder の puddleGeometry を移植。中心の座標で決まる固定の形。
 *   v1 は揺らぎが重なると箱から少しはみ出したので、はみ出す分だけ縮める）
 * - 傾けた箱（Box.slope。階段の手すりなど）: 普通に箱を作ってから、頂点の y を軸に沿って 0 .. rise だけずらす（法線も合わせる）。
 *   表面の質感の座標・焼き込みは、ずらした後の形に掛ける
 */
import * as THREE from 'three';
import type { Box, MatId } from '../../core/world/layout.ts';
import { SURFACES } from './MaterialLibrary.ts';
import { writeSurfaceCoordinates } from './SurfaceAppearance.ts';
import { surfaceBox } from './SurfaceGeometry.ts';

/** 上面だけを描く水面の材質か（水壁・水膜のような流れ落ちる水は両面の板のまま） */
export function isWaterSurfaceMat(mat: MatId): boolean {
  const s = SURFACES[mat];
  return !!s?.water && !s.fall;
}

/** 水面のメッシュの原点の高さ（フロア座標）: 箱の底。水面でなければ null */
export function waterBase(b: Box): number | null {
  return isWaterSurfaceMat(b.mat) ? b.min[1] : null;
}

/** ジオメトリの三角形のうち、keep(法線) を満たす物だけの新しいジオメトリ（インデックス無し。元は捨てない） */
export function keepTriangles(g: THREE.BufferGeometry, keep: (nx: number, ny: number, nz: number) => boolean): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const n = src.getAttribute('normal');
  const tris: number[] = [];
  for (let t = 0; t < n.count / 3; t++) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3; k++) { nx += n.getX(t * 3 + k); ny += n.getY(t * 3 + k); nz += n.getZ(t * 3 + k); }
    if (keep(nx / 3, ny / 3, nz / 3)) tris.push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as THREE.BufferAttribute;
    const size = a.itemSize;
    const arr = new (a.array.constructor as Float32ArrayConstructor)(tris.length * 3 * size);
    tris.forEach((t, i) => arr.set((a.array as Float32Array).subarray(t * 3 * size, (t + 1) * 3 * size), i * 3 * size));
    out.setAttribute(name, new THREE.BufferAttribute(arr, size, a.normalized));
  }
  if (src !== g) src.dispose();
  return out;
}

/** 水面: 箱の上面だけ（分割・UV は surfaceBox と同じ） */
export function waterSurfaceGeometry(b: Box): THREE.BufferGeometry {
  const full = surfaceBox(b);
  const top = keepTriangles(full, (_x, y) => y > 0.5);
  full.dispose();
  return top;
}

/**
 * 水たまり: 箱の足跡（xz）の楕円に収まる不定形の輪郭（角の無い 28 角形）の平面を、箱の上面の高さに置く。
 * 形は中心の座標から決まる（同じ場所なら同じ形）。v1 RoomBuilder の puddleGeometry と同じ形（はみ出す分だけ縮める）
 */
export function puddleGeometry(b: Box): THREE.BufferGeometry {
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const rx = (b.max[0] - b.min[0]) / 2, rz = (b.max[2] - b.min[2]) / 2;
  let seed = ((Math.round(cx * 100) * 73856093) ^ (Math.round(cz * 100) * 19349663)) >>> 0;
  const rnd = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const a1 = rnd() * Math.PI * 2, a2 = rnd() * Math.PI * 2, a3 = rnd() * Math.PI * 2;
  const k1 = 0.14 + rnd() * 0.1, k2 = 0.07 + rnd() * 0.08;
  const N = 28;
  const rr: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    rr.push(0.78 + k1 * Math.sin(2 * t + a1) + k2 * Math.sin(3 * t + a2) + 0.05 * Math.sin(5 * t + a3));
  }
  // 揺らぎが重なって楕円の外へ出る所があれば全体を縮める（v1 は最大 1.2 倍まではみ出した。水槽の縁・壁に掛けない）
  const fit = 1 / Math.max(1, ...rr);
  const shape = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = Math.cos(t) * rx * rr[i]! * fit, y = Math.sin(t) * rz * rr[i]! * fit;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 1);
  // 形の y を -z に倒す（上向きの面）
  g.rotateX(-Math.PI / 2);
  g.translate(cx, b.max[1], cz);
  writeSurfaceCoordinates(g, SURFACES[b.mat].meters, b.mat);
  return g;
}

/** 傾けた箱のずれの行列（軸 axis の min で 0、max で rise。y だけを動かす剪断） */
function slopeMatrix(b: Box): THREE.Matrix4 | null {
  const s = b.slope;
  if (!s) return null;
  const ai = s.axis === 'x' ? 0 : 2;
  const len = b.max[ai] - b.min[ai];
  if (len < 1e-6) return null;
  const k = s.rise / len;
  const m = new THREE.Matrix4();
  // y' = y + k (a − a0)
  if (s.axis === 'x') m.set(1, 0, 0, 0, k, 1, 0, -k * b.min[0], 0, 0, 1, 0, 0, 0, 0, 1);
  else m.set(1, 0, 0, 0, 0, 1, k, -k * b.min[2], 0, 0, 1, 0, 0, 0, 0, 1);
  return m;
}

/** 傾けた箱の外接の箱（焼き込みの「自分の箱」・範囲の判定に使う）。傾いていなければ元の箱 */
export function slopeBounds(b: Box): Box {
  const s = b.slope;
  if (!s) return b;
  return { ...b, min: [b.min[0], b.min[1] + Math.min(0, s.rise), b.min[2]], max: [b.max[0], b.max[1] + Math.max(0, s.rise), b.max[2]] };
}

/** 傾けた箱: 普通の箱（面取り・UV）を作り、頂点の y をずらす（法線は逆転置で直す） */
export function slopedBoxGeometry(b: Box): THREE.BufferGeometry {
  const g = surfaceBox(b);
  const m = slopeMatrix(b);
  if (m) g.applyMatrix4(m);
  return g;
}

/**
 * 箱 → 描画のジオメトリ（FloorBuilder の 1 箱ぶん）。水面は上面だけ・水たまりは不定形・傾けた箱は剪断、ほかは surfaceBox
 */
export function boxGeometry(b: Box): THREE.BufferGeometry {
  if (b.mat === 'puddle') return puddleGeometry(b);
  if (isWaterSurfaceMat(b.mat)) return waterSurfaceGeometry(b);
  if (b.slope) return slopedBoxGeometry(b);
  return surfaceBox(b);
}
