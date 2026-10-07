import * as THREE from 'three';
import { LocalFrame } from './frame.ts';
import { ANNEX, CLUB, COURT, EAST, FAR, MAIN, NORTH, roofAt, STREET, WALKWAY, WEST, type V3 } from './layout.ts';
import type { SunMask } from './mats.ts';
import type { PaintLayer } from '../../render/PaintMaterial.ts';

/**
 * 日なたの形（場面専用）。午後の日（西南西・高さ約 48°）が建物・塀・屋根・木の冠に遮られるかを、作る時に光線で調べて
 * 「日なたの分布の絵」を作る（上から見た地面の絵・壁の座標の絵）。絵は少しぼかし、材質の側でノイズのしきい値で切って
 * ちぎれた縁・木漏れ日にする（参考画像の床の日の差し込み・日なたの壁と同じ描き方）。
 * 通路（参考画像の視点）の日なたは元の版の手で描いた形のまま（alley/reflect.ts）。ここの日は中庭・裏庭・道路・
 * 建物の外の開けた所に使う。木の冠は日を半分通す（木漏れ日）。
 */

/** 日の方へ向かう単位ベクトル */
export const SUN_DIR = new THREE.Vector3(-0.75, 0.95, 0.45).normalize();

type Occ =
  | { kind: 'box'; min: V3; max: V3 }
  | { kind: 'frame'; fr: LocalFrame; u: [number, number]; w: [number, number]; y: [number, number] }
  | { kind: 'ell'; c: V3; r: V3; pass: number };

let occCache: Occ[] | null = null;
let occLow: Occ[] | null = null;

export function resetSunCache(): void {
  occCache = null;
  occLow = null;
}

/**
 * 見通しの確かめ用の控えめな遮る物（斜めの屋根の段は低い方の高さ・木の冠は小さめ）。
 * 「見えないと判定したのに実は見える」を避ける（参考画像の視点の見た目を変えないため）
 */
function occludersLow(): Occ[] {
  if (occLow) return occLow;
  occLow = occluders(true);
  return occLow;
}

/** 日を遮る物（建物の箱・道路斜線の斜めの屋根は段に分ける・塀・屋根・木の冠） */
function occluders(low = false): Occ[] {
  if (occCache && !low) return occCache;
  const o: Occ[] = [];
  const wing = (f: typeof WEST): void => {
    const fr = new LocalFrame(f);
    const s = f.slope;
    o.push({ kind: 'frame', fr, u: [f.u0, s.u0], w: [-f.depth, 0], y: [-1, f.parapet] });
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = s.u0 + ((f.u1 - s.u0) * i) / n;
      const c = s.u0 + ((f.u1 - s.u0) * (i + 1)) / n;
      o.push({ kind: 'frame', fr, u: [a, c], w: [-f.depth, 0], y: [-1, low ? Math.min(roofAt(f, a), roofAt(f, c)) - 0.3 : roofAt(f, (a + c) / 2)] });
    }
  };
  wing(WEST);
  wing(EAST);
  o.push({ kind: 'box', min: [MAIN.x[0], 0, MAIN.z[0]], max: [MAIN.x[1], MAIN.parapet, MAIN.z[1]] });
  o.push({ kind: 'box', min: [ANNEX.x[0], 0, ANNEX.z[0]], max: [ANNEX.x[1], ANNEX.h, ANNEX.z[1]] });
  o.push({ kind: 'box', min: [CLUB.x[0], 0, CLUB.z[0]], max: [CLUB.x[1], CLUB.h, CLUB.z[1]] });
  o.push({ kind: 'box', min: [FAR.x[0], 0, FAR.z[0]], max: [FAR.x[1], FAR.h, FAR.z[1]] });
  o.push({ kind: 'box', min: [FAR.left.x[0], 0, FAR.z[0]], max: [FAR.left.x[1], FAR.left.h, FAR.z[1] + 3] });
  // 中庭の西の家とアパート・塀（south.ts と同じ寸法）
  const cx0 = COURT.x[0];
  for (const [z0, z1, h] of [
    [17, 25, 6.55],
    [27, 34, 6.15],
    [36, 46, 10.85],
  ] as const)
    o.push({ kind: 'box', min: [cx0 - 11.3, 0, z0 - 0.3], max: [cx0 - 2.2, h, z1 + 0.3] });
  o.push({ kind: 'box', min: [cx0 - 0.2, 0, 17], max: [cx0, 2.0, COURT.z[1]] });
  // 裏庭の西の塀・北のフェンスの基礎（低い）
  o.push({ kind: 'box', min: [NORTH.x0, 0, -48], max: [NORTH.x0 + 0.2, 2.0, -33] });
  // 渡り廊下の屋根（細い帯の影）
  o.push({ kind: 'box', min: [WALKWAY.x[0] - 0.3, WALKWAY.h, LANE_Z0 + 0.4], max: [WALKWAY.x[1] + 0.3, WALKWAY.h + 0.16, WALKWAY.z[1]] });
  o.push({ kind: 'box', min: [-15.5, WALKWAY.h, 18.3], max: [WALKWAY.x[0], WALKWAY.h + 0.16, 21.5] });
  // 木の冠（日を半分通す）
  for (const [x, y, z, rx, ry] of [
    [-14, 8.5, 28.5, 4.6, 4.4],
    [8.8, 7.6, 29, 3.9, 3.9],
    [-5.0, 5.4, 36.2, 2.6, 2.4],
    [0.6, 6.4, -42.2, 3.6, 3.7],
  ] as const)
    o.push({ kind: 'ell', c: [x, y, z], r: [rx * (low ? 0.6 : 0.8), ry * (low ? 0.6 : 0.8), rx * (low ? 0.6 : 0.8)], pass: 0.38 });
  if (low) return o;
  occCache = o;
  return o;
}
const LANE_Z0 = 18;

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

function slab(o0: number, d0: number, a: number, b: number, t: [number, number]): boolean {
  if (Math.abs(d0) < 1e-9) return o0 >= a && o0 <= b;
  let t0 = (a - o0) / d0;
  let t1 = (b - o0) / d0;
  if (t0 > t1) [t0, t1] = [t1, t0];
  t[0] = Math.max(t[0], t0);
  t[1] = Math.min(t[1], t1);
  return t[0] <= t[1];
}

/**
 * 点 o から向き d（単位）へ距離 tMax まで、遮る物があるか。返す値: 1 = 遮られない、0 = 建物などに遮られる、
 * 木の冠だけを通るときは pass（solidTrees なら 0）
 */
function traceVis(o: V3, d: THREE.Vector3, tMax: number, solidTrees: boolean): number {
  const occ = solidTrees ? occludersLow() : occluders();
  _o.set(o[0], o[1], o[2]);
  _d.copy(d);
  let vis = 1;
  for (const oc of occ) {
    const t: [number, number] = [0.02, tMax];
    if (oc.kind === 'box') {
      if (slab(_o.x, _d.x, oc.min[0], oc.max[0], t) && slab(_o.y, _d.y, oc.min[1], oc.max[1], t) && slab(_o.z, _d.z, oc.min[2], oc.max[2], t)) return 0;
    } else if (oc.kind === 'frame') {
      const fr = oc.fr;
      const ou = (_o.x - fr.O.x) * fr.T.x + (_o.z - fr.O.z) * fr.T.z;
      const ow = (_o.x - fr.O.x) * fr.N.x + (_o.z - fr.O.z) * fr.N.z;
      const du = _d.x * fr.T.x + _d.z * fr.T.z;
      const dw = _d.x * fr.N.x + _d.z * fr.N.z;
      if (slab(ou, du, oc.u[0], oc.u[1], t) && slab(ow, dw, oc.w[0], oc.w[1], t) && slab(_o.y, _d.y, oc.y[0], oc.y[1], t)) return 0;
    } else {
      // 楕円体（単位球へ直して交わるか）
      const ox = (_o.x - oc.c[0]) / oc.r[0];
      const oy = (_o.y - oc.c[1]) / oc.r[1];
      const oz = (_o.z - oc.c[2]) / oc.r[2];
      const dx = _d.x / oc.r[0];
      const dy = _d.y / oc.r[1];
      const dz = _d.z / oc.r[2];
      const a = dx * dx + dy * dy + dz * dz;
      const b = ox * dx + oy * dy + oz * dz;
      const c = ox * ox + oy * oy + oz * oz - 1;
      const disc = b * b - a * c;
      if (disc > 0) {
        const t1 = (-b - Math.sqrt(disc)) / a;
        const t2 = (-b + Math.sqrt(disc)) / a;
        if (t2 > 0 && t1 < tMax) {
          if (solidTrees) return 0;
          vis = Math.min(vis, oc.pass);
        }
      }
    }
  }
  return vis;
}

/** 点 p の日の当たり方（1 = 日なた、0 = 影、木の冠の中は半分） */
export function sunAt(p: V3): number {
  return traceVis(p, SUN_DIR, 400, false);
}

const _seg = new THREE.Vector3();
/** a から b までの見通し（建物・塀・屋根・木の冠に遮られないか。b の手前 margin m まで調べる） */
export function lineClear(a: V3, b: V3, margin = 0.3): boolean {
  _seg.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _seg.length();
  _seg.normalize();
  return traceVis(a, _seg, Math.max(0.05, len - margin), true) > 0.5;
}

/** 少しぼかす（縁をノイズで切ったときに、ちぎれた帯になるように） */
function blur(src: Float32Array, W: number, H: number, rad: number): Float32Array {
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        let n = 0;
        for (let k = -rad; k <= rad; k++) {
          const xx = pass === 0 ? Math.min(W - 1, Math.max(0, x + k)) : x;
          const yy = pass === 1 ? Math.min(H - 1, Math.max(0, y + k)) : y;
          s += a[yy * W + xx];
          n++;
        }
        out[y * W + x] = s / n;
      }
    a = out;
  }
  return a;
}

/**
 * 地面の日なたの絵（上から見た XZ。rect = [x0, z0, x1, z1]。R = 日なたの度合い）。PaintMaterial の cov に使う。
 * 木の冠の下は 0.38（材質の側のノイズで木漏れ日になる）
 */
export function groundSun(rect: [number, number, number, number], ppm: number, y = 0.02): THREE.DataTexture {
  const [x0, z0, x1, z1] = rect;
  const W = Math.max(4, Math.round(Math.abs(x1 - x0) * ppm));
  const H = Math.max(4, Math.round(Math.abs(z1 - z0) * ppm));
  const v = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0);
      const z = z0 + ((j + 0.5) / H) * (z1 - z0);
      v[j * W + i] = sunAt([x, y, z]);
    }
  const b = blur(v, W, H, Math.max(1, Math.round(ppm * 0.15)));
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const c = Math.round(Math.min(1, b[i]) * 255);
    data[i * 4] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * 壁の日なたの絵（壁の座標 u・y。facadeMat の sunMask に使う）。壁が日の方を向いていなければ全部影。
 * 木の葉の影のちぎれは、木の冠の中の値（0.38）と材質の側の縁のノイズで出る
 */
export function wallSun(fr: LocalFrame, u0: number, u1: number, y0: number, y1: number, ppm: number, w = 0.05): SunMask {
  const W = Math.max(4, Math.round((u1 - u0) * ppm));
  const H = Math.max(4, Math.round((y1 - y0) * ppm));
  const facing = SUN_DIR.x * fr.N.x + SUN_DIR.z * fr.N.z;
  const v = new Float32Array(W * H);
  if (facing > 0.05) {
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const u = u0 + ((i + 0.5) / W) * (u1 - u0);
        const y = y0 + ((j + 0.5) / H) * (y1 - y0);
        v[j * W + i] = sunAt(fr.w(u, y, w)) * Math.min(1, facing * 3);
      }
  }
  const b = blur(v, W, H, Math.max(1, Math.round(ppm * 0.12)));
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const c = Math.round(Math.min(1, b[i]) * 255);
    data[i * 4] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return { texture: t, rect: [u0, y0, u1, y1] };
}

/** 道路（敷地の外）も同じ日（北の道路は建物の北なので、向かいの建物の前だけ日なた） */
export const STREET_RECT: [number, number, number, number] = [-40, STREET.z[1] + 0.5, 30, FAR.z[1] + 0.1];
export const COURT_RECT: [number, number, number, number] = [COURT.x[0] - 0.5, 10, COURT.x[1] + 0.5, COURT.z[1] + 0.2];
export const YARD_RECT: [number, number, number, number] = [NORTH.x0 - 0.2, -48.2, NORTH.x1 + 0.2, -32.8];

/**
 * 地面の分布の絵（PaintMaterial の cov。makeCoverage の絵）の 1 つのチャンネルに、z > zMin の所だけ日なたを足す（大きい方）。
 * 通路の参考画像の視点に写る所（z < zMin）は元の手で描いた日の差し込みのまま
 */
export function addGroundSun(tex: THREE.DataTexture, rect: [number, number, number, number], ch: number, zMin: number, y = 0.02): void {
  const img = tex.image as { data: Uint8Array; width: number; height: number };
  const [x0, z0, x1, z1] = rect;
  const W = img.width;
  const H = img.height;
  const v = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const z = z0 + ((j + 0.5) / H) * (z1 - z0);
    if (z < zMin - 0.5) continue;
    for (let i = 0; i < W; i++) {
      const x = x0 + ((i + 0.5) / W) * (x1 - x0);
      v[j * W + i] = sunAt([x, y, z]) * Math.min(1, Math.max(0, (z - zMin) / 1.0 + 0.5));
    }
  }
  const ppm = W / Math.abs(x1 - x0);
  const b = blur(v, W, H, Math.max(1, Math.round(ppm * 0.15)));
  for (let i = 0; i < W * H; i++) img.data[i * 4 + ch] = Math.max(img.data[i * 4 + ch], Math.round(Math.min(1, b[i]) * 255));
  tex.needsUpdate = true;
}

/**
 * 壁の日なたの絵を広げる: 元の手で描いた絵（hand。参考画像の視点に写る所）はそのまま写し、u < uEnd の所は光線で調べた日なた
 * （facadeMat の sunEdge・sunEdgeU = uEnd で縁をちぎる）。絵の 1 m あたりの画素は hand と同じ
 */
export function extendWallSun(fr: LocalFrame, hand: SunMask, u0: number, uEnd: number, w = 0.05): SunMask {
  const src = hand.texture.image as HTMLCanvasElement;
  const [hu0, y0, hu1, y1] = hand.rect;
  const ppm = src.width / (hu1 - hu0);
  const off = Math.round((hu0 - u0) * ppm);
  const c = document.createElement('canvas');
  c.width = src.width + off;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, off, 0);
  const facing = SUN_DIR.x * fr.N.x + SUN_DIR.z * fr.N.z;
  if (facing > 0.05) {
    // 粗く調べて拡大して描く（0.25 m の升）
    const step = 0.25;
    const nu = Math.ceil((uEnd - u0) / step);
    const ny = Math.ceil((y1 - y0) / step);
    const v = new Float32Array(nu * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nu; i++) {
        const u = u0 + (i + 0.5) * step;
        const y = y1 - (j + 0.5) * step;
        v[j * nu + i] = sunAt(fr.w(u, y, w)) * Math.min(1, facing * 3);
      }
    const b = blur(v, nu, ny, 1);
    const t = document.createElement('canvas');
    t.width = nu;
    t.height = ny;
    const tg = t.getContext('2d')!;
    const id = tg.createImageData(nu, ny);
    for (let i = 0; i < nu * ny; i++) {
      const k = Math.round(Math.min(1, b[i]) * 255);
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = k;
      id.data[i * 4 + 3] = 255;
    }
    tg.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(t, 0, 0, Math.round((uEnd - u0) * ppm), c.height);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return { texture: tex, rect: [hu0 - off / ppm, y0, hu1, y1] };
}

/**
 * 地面の日なたの層（PaintMaterial の cov の 0 番の値で塗る）。日なたの中もノイズのしきい値で小さな葉の影が抜け、
 * 木の冠の下（0.38）は木漏れ日の小さな斑だけになる。ねじりは弱く（大きな渦の模様にしない）
 */
export function sunLayer(color: string, seed: number): PaintLayer {
  return { color, scale: 2.0, threshold: 1.3, cov: 1.0, covChannel: 0, only: 'floor', detail: 0.45, warp: 0.45, seed };
}
