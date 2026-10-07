import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, rng, type V3 } from '../Builder.ts';
import type { HField } from './hfield.ts';

/** タイルの大きさ（m）。物の寸法と位置はこの倍数にそろえる（目地が角に合う・影の段が目地に合う） */
export const T = 0.25;
/** 水面の高さ */
export const WATER_Y = 0;

export const snap = (v: number): number => Math.round(v / T) * T;

/** 影だけを落とす見えない板の材質（色も深度も書かない。影の地図にだけ描かれる） */
let goboMat: THREE.MeshBasicMaterial | null = null;
function goboMaterial(): THREE.MeshBasicMaterial {
  if (!goboMat) goboMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  return goboMat;
}

/**
 * 影の形を決める見えない板（照明の「ゴボ」）。面の上の影にしたい多角形（区域の座標）を、日の来る方へ dist だけ戻した所に置く。
 * 面の上には多角形どおりの影が落ち（升目に丸める設定なら段々に）、ほかの面にも同じ光の向きで影が続く。
 */
export function gobo(b: Builder, pts: V3[], sun: THREE.Vector3, dist: number, offset: V3 = [0, 0, 0]): THREE.Mesh | null {
  if (pts.length < 3) return null;
  // 面の向き（多角形の法線）で 2 次元に直して三角形に分ける
  const p = pts.map((q) => new THREE.Vector3(...q));
  const n = new THREE.Vector3();
  for (let i = 0; i < p.length; i++) n.add(new THREE.Vector3().crossVectors(p[i], p[(i + 1) % p.length]));
  n.normalize();
  const u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0);
  const v = new THREE.Vector3().crossVectors(n, u);
  const flat = p.map((q) => new THREE.Vector2(q.dot(u), q.dot(v)));
  const tris = THREE.ShapeUtils.triangulateShape(flat, []);
  // 日の来る方へ戻す（面からの距離が dist になるように）
  const L = sun.clone().normalize();
  const t = dist / Math.max(Math.abs(L.dot(n)), 0.05);
  const back = L.clone().multiplyScalar(-t);
  const pos: number[] = [];
  for (const tri of tris) for (const i of tri) pos.push(p[i].x + back.x + offset[0], p[i].y + back.y + offset[1], p[i].z + back.z + offset[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, goboMaterial());
  m.castShadow = true;
  m.receiveShadow = false;
  m.name = 'gobo';
  b.root.add(m);
  return m;
}

/** 点 p から日の来る方へたどって、高さ y の面と交わる所（xz） */
export function towardSun(p: V3, sun: THREE.Vector3, y: number): [number, number] {
  const L = sun.clone().normalize();
  const t = (y - p[1]) / Math.max(-L.y, 1e-3);
  return [p[0] - L.x * t, p[2] - L.z * t];
}

function inPoly(x: number, z: number, poly: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/**
 * 影だけを落とす見えない屋根。区域を覆い、穴（xz の多角形）の所だけ日が差し込む。
 * 穴は升目（cell）に塗り、塞がった升目を横につないだ薄い箱にする（穴どうしが重なってもよい）
 */
export function roofGobo(b: Builder, rect: [number, number, number, number], y: number, cell: number, holes: [number, number][][]): THREE.Mesh {
  const [x0, z0, x1, z1] = rect;
  const nx = Math.ceil((x1 - x0) / cell);
  const nz = Math.ceil((z1 - z0) / cell);
  const open = new Uint8Array(nx * nz);
  for (const h of holes) {
    let ax = Infinity;
    let az = Infinity;
    let bx = -Infinity;
    let bz = -Infinity;
    for (const [x, z] of h) {
      ax = Math.min(ax, x);
      az = Math.min(az, z);
      bx = Math.max(bx, x);
      bz = Math.max(bz, z);
    }
    const i0 = Math.max(0, Math.floor((ax - x0) / cell));
    const i1 = Math.min(nx - 1, Math.ceil((bx - x0) / cell));
    const j0 = Math.max(0, Math.floor((az - z0) / cell));
    const j1 = Math.min(nz - 1, Math.ceil((bz - z0) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) if (inPoly(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell, h)) open[j * nx + i] = 1;
  }
  const geos: THREE.BufferGeometry[] = [];
  for (let j = 0; j < nz; j++) {
    let i = 0;
    while (i < nx) {
      if (open[j * nx + i]) {
        i++;
        continue;
      }
      let e = i;
      while (e < nx && !open[j * nx + e]) e++;
      const g = new THREE.BoxGeometry((e - i) * cell, 0.05, cell);
      g.translate(x0 + ((i + e) / 2) * cell, y, z0 + (j + 0.5) * cell);
      geos.push(g.toNonIndexed());
      g.dispose();
      i = e;
    }
  }
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  for (const g of geos) g.dispose();
  const m = new THREE.Mesh(merged, goboMaterial());
  m.castShadow = true;
  m.receiveShadow = false;
  m.name = 'gobo-roof';
  b.root.add(m);
  return m;
}

/**
 * プールの部品を置く道具。箱はタイルの升目にそろえ、水に浸かる物は底の升目（HField）にも書く
 * （水面のシェーダーが水中の側面・底を塗るため）。
 */
export class Kit {
  readonly r = rng(7);
  constructor(
    readonly b: Builder,
    readonly hf: HField,
  ) {}

  /** 角の座標で箱。水に浸かる物は底の升目にも書く（水面を貫く物は「詰まっている」= 50） */
  box(mat: THREE.Material, min: V3, max: V3, o: { collide?: boolean; shadow?: boolean | 'cast' | 'receive' } = {}): THREE.Mesh {
    const m = this.b.boxMM(mat, min, max, { collide: o.collide, shadow: o.shadow ?? true });
    if (min[1] < WATER_Y) this.hf.rect(min[0], min[2], max[0], max[2], max[1] >= WATER_Y ? 50 : max[1], 'max');
    return m;
  }

  /** 通路（水面より上の床）。底から上面まで */
  deck(mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, top = 0.15): THREE.Mesh {
    return this.box(mat, [x0, -2, z0], [x1, top, z1], { collide: true });
  }

  /** 水中の段（底より高いが水面より下）。当たり判定は底の升目から作る */
  shelf(x0: number, z0: number, x1: number, z1: number, top: number): void {
    this.hf.rect(x0, z0, x1, z1, top, 'max');
  }

  /**
   * 不定形の浅い段（タイル単位の階段状の縁）。中心 (cx, cz)、半径 (rx, rz) の楕円をノイズでゆがめる
   */
  blobShelf(cx: number, cz: number, rx: number, rz: number, top: number, seed = 1, step = 0.5): void {
    const h = (x: number, z: number): number => {
      const v = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };
    // 粗い升目の値ノイズ（2 m 間隔）
    const noise = (x: number, z: number): number => {
      const gx = Math.floor(x / 2);
      const gz = Math.floor(z / 2);
      const fx = x / 2 - gx;
      const fz = z / 2 - gz;
      const a = h(gx, gz);
      const b = h(gx + 1, gz);
      const c = h(gx, gz + 1);
      const d = h(gx + 1, gz + 1);
      const ux = fx * fx * (3 - 2 * fx);
      const uz = fz * fz * (3 - 2 * fz);
      return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
    };
    for (let x = cx - rx * 1.5; x < cx + rx * 1.5; x += step)
      for (let z = cz - rz * 1.5; z < cz + rz * 1.5; z += step) {
        const dx = (x + step / 2 - cx) / rx;
        const dz = (z + step / 2 - cz) / rz;
        const r = Math.hypot(dx, dz) + (noise(x, z) - 0.5) * 0.8;
        if (r < 1) this.hf.rect(x, z, x + step, z + step, top, 'max');
      }
  }

  /** 底を深くする */
  basin(x0: number, z0: number, x1: number, z1: number, y: number): void {
    this.hf.rect(x0, z0, x1, z1, y, 'set');
  }

  /**
   * 角柱。[x0, z0]〜[x1, z1] の断面、y0〜y1。台座（plinth: [張り出し, 高さ]）と柱頭（cap: [張り出し, 高さ]）
   */
  column(
    mat: THREE.Material,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y0: number,
    y1: number,
    o: { plinth?: [number, number][]; base?: number; cap?: [number, number][]; capMat?: THREE.Material } = {},
  ): void {
    this.box(mat, [x0, y0, z0], [x1, y1, z1], { collide: true });
    // 台座: 1 段目は y0 から（base + 高さ）まで、2 段目からは前の段の上から
    let yb = y0;
    let y = o.base ?? y0;
    for (const [out, h] of o.plinth ?? []) {
      this.box(mat, [x0 - out, yb, z0 - out], [x1 + out, y + h, z1 + out], { collide: true });
      y += h;
      yb = y;
    }
    let yt = y1;
    for (const [out, h] of o.cap ?? []) {
      this.box(o.capMat ?? mat, [x0 - out, yt - h, z0 - out], [x1 + out, yt, z1 + out]);
      yt -= h;
    }
  }

  /**
   * 角を階段状に欠いた塊（ボクセルのような張り出し）。面ごとに小さな箱を出し入れする
   */
  greeble(mat: THREE.Material, darkMat: THREE.Material | null, min: V3, max: V3, n: number, o: { out?: number; size?: [number, number]; faces?: ('x' | '-x' | 'z' | '-z' | '-y')[] } = {}): void {
    const r = this.r;
    const faces = o.faces ?? ['x', '-x', 'z', '-z', '-y'];
    const [smin, smax] = o.size ?? [0.25, 0.75];
    const out = o.out ?? 0.25;
    for (let i = 0; i < n; i++) {
      const f = faces[Math.floor(r() * faces.length)];
      const w = snap(smin + r() * (smax - smin)) || T;
      const h = snap(smin + r() * (smax - smin)) || T;
      const d = snap(T + r() * (out - T)) || T;
      const dark = darkMat && r() < 0.25;
      let a: V3;
      let c: V3;
      if (f === 'x' || f === '-x') {
        const z = snap(min[2] + r() * Math.max(0, max[2] - min[2] - w));
        const y = snap(min[1] + r() * Math.max(0, max[1] - min[1] - h));
        const x = f === 'x' ? max[0] : min[0];
        a = [f === 'x' ? x - (dark ? 0.1 : 0) : x - d, y, z];
        c = [f === 'x' ? x + d : x + (dark ? 0.1 : 0), y + h, z + w];
      } else if (f === 'z' || f === '-z') {
        const x = snap(min[0] + r() * Math.max(0, max[0] - min[0] - w));
        const y = snap(min[1] + r() * Math.max(0, max[1] - min[1] - h));
        const z = f === 'z' ? max[2] : min[2];
        a = [x, y, f === 'z' ? z - (dark ? 0.1 : 0) : z - d];
        c = [x + w, y + h, f === 'z' ? z + d : z + (dark ? 0.1 : 0)];
      } else {
        const x = snap(min[0] + r() * Math.max(0, max[0] - min[0] - w));
        const z = snap(min[2] + r() * Math.max(0, max[2] - min[2] - h));
        a = [x, min[1] - d, z];
        c = [x + w, min[1] + (dark ? 0.1 : 0), z + h];
      }
      if (dark) {
        // 暗い凹み（奥まった所）: 面に薄く貼る
        if (f === 'x') { a[0] = max[0] - 0.02; c[0] = max[0] + 0.02; }
        if (f === '-x') { a[0] = min[0] - 0.02; c[0] = min[0] + 0.02; }
        if (f === 'z') { a[2] = max[2] - 0.02; c[2] = max[2] + 0.02; }
        if (f === '-z') { a[2] = min[2] - 0.02; c[2] = min[2] + 0.02; }
        if (f === '-y') { a[1] = min[1] - 0.02; c[1] = min[1] + 0.02; }
        this.b.boxMM(darkMat, a, c, { shadow: false });
      } else this.b.boxMM(mat, a, c);
    }
  }
}
