import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneContext } from '../../scenes/types.ts';
import { hash } from './geo.ts';

/**
 * 客席の椅子（劇場の椅子・机つきの椅子）を 1 席ずつ、列の輪の上に置く（InstancedMesh で材質ごとに 1 回の描画）。
 * 椅子の局所の座標: 床 y = 0、正面（座る人が向く向き）が +z、背が -z、幅 0.55 m。
 * 部位: 座面（下ろした状態）・背もたれ（後ろへ 12° 倒す）・背の殻・肘掛け・脚（側板）・机つきは右の肘掛けの外に畳んだ机
 */

export const SEAT_W = 0.6;

function rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0): THREE.BufferGeometry {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  // RoundedBoxGeometry は index つき、Box も index つき → まとめるために揃える
  return g.index ? g.toNonIndexed() : g;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') p.deleteAttribute(k);
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

/** 椅子の部位の形（布 = 座面と背のクッション、殻 = 背の裏と肘掛けと側板、机 = 畳んだ机の板） */
export function seatParts(tablet: boolean): { fabric: THREE.BufferGeometry; shell: THREE.BufferGeometry; cap: THREE.BufferGeometry; tablet?: THREE.BufferGeometry } {
  const tilt = -0.21;
  // 背もたれ（クッション）: 下端 0.42、上端 0.98
  // 背のクッションだけ角を丸める（上の縁の丸みが光を受ける）。ほかは箱（席が多いので三角形を抑える）
  const fabric = merged([
    rbox(0.47, 0.56, 0.08, 0.03, 0, 0.72, -0.2, tilt),
    rbox(0.46, 0.09, 0.44, 0, 0, 0.45, 0.02),
  ]);
  const shell = merged([
    // 背の殻（クッションの裏）
    rbox(0.5, 0.6, 0.035, 0, 0, 0.71, -0.255, tilt),
    // 肘掛け（左右）と側板（脚）
    rbox(0.05, 0.05, 0.42, 0, -0.265, 0.66, 0.02),
    rbox(0.05, 0.05, 0.42, 0, 0.265, 0.66, 0.02),
    rbox(0.04, 0.64, 0.3, 0, -0.265, 0.32, -0.03),
    rbox(0.04, 0.64, 0.3, 0, 0.265, 0.32, -0.03),
    // 座面の下の受け
    rbox(0.46, 0.05, 0.3, 0, 0, 0.38, -0.02),
  ]);
  // 背の上の縁の笠木（つやのある樹脂。ドームの光を受けて細い明るい線に見える。参考画像の席の列の光の粒）
  const cap = merged([rbox(0.5, 0.035, 0.07, 0.012, 0, 0.995, -0.29, tilt)]);
  // 席の幅 0.6 m（リクライニングのプラネタリウムの椅子）
  fabric.scale(1.12, 1, 1);
  shell.scale(1.12, 1, 1);
  cap.scale(1.12, 1, 1);
  if (!tablet) return { fabric, shell, cap };
  // 畳んだ机: 右の肘掛けの外に縦に立てた板（上の縁が明るく見える）
  const t = merged([rbox(0.02, 0.26, 0.34, 0, 0.33, 0.56, 0.04), rbox(0.3, 0.018, 0.22, 0, 0.45, 0.68, 0.12)]);
  return { fabric, shell, cap, tablet: t };
}

export interface SeatMats {
  cap: THREE.Material;
  fabric: THREE.Material;
  shell: THREE.Material;
  tablet: THREE.Material;
}

export interface SeatPlace {
  m: THREE.Matrix4;
  tablet: boolean;
  /** 席の位置（当たり判定・置かない所の確かめ） */
  x: number;
  z: number;
  y: number;
}

/** 席の区画: 角度の範囲・列の半径・席の種類・通路の角度（ラジアン） */
export interface SeatBlock {
  a0: number;
  a1: number;
  rows: { r: number; y: number }[];
  tablet: boolean;
  aisles: number[];
}

/** 通路の幅（m） */
export const AISLE_W = 1.2;

function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}
function inRange(a: number, a0: number, a1: number): boolean {
  // a0 → a1 を正の向きに回る範囲（π をまたいでよい）
  const span = (a1 - a0 + Math.PI * 4) % (Math.PI * 2);
  const d = (a - a0 + Math.PI * 4) % (Math.PI * 2);
  return d <= span;
}

/** 席を置かない所（操作卓のまわりなど）。呼ぶ側が渡す */
export type SeatSkip = (x: number, z: number, r: number, a: number) => boolean;

/** 区画の列の輪の上の席の位置を全部求める */
export function seatPlaces(blocks: SeatBlock[], skip: SeatSkip, wallR: (a: number) => number): SeatPlace[] {
  const out: SeatPlace[] = [];
  blocks.forEach((bl, bi) => {
    bl.rows.forEach((rw, k) => {
      const r = rw.r;
      const span = (bl.a1 - bl.a0 + Math.PI * 4) % (Math.PI * 2);
      const n = Math.floor((span * r) / SEAT_W);
      const da = span / n;
      for (let i = 0; i < n; i++) {
        const a = bl.a0 + (i + 0.5) * da;
        if (!inRange(a, bl.a0, bl.a1)) continue;
        // 区画の端は通路の半分あける
        if (Math.min(angDist(a, bl.a0), angDist(a, bl.a1)) * r < AISLE_W / 2 + SEAT_W / 2 - 0.05) continue;
        if (bl.aisles.some((al) => angDist(a, al) * r < AISLE_W / 2 + SEAT_W / 2)) continue;
        if (r > wallR(a) - 0.5) continue;
        const x = r * Math.sin(a);
        const z = -r * Math.cos(a);
        if (skip(x, z, r, a)) continue;
        const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, rw.y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + (hash(i + bi * 31, k) - 0.5) * 0.03, 0)), new THREE.Vector3(1, 1, 1));
        out.push({ m, tablet: bl.tablet, x, z, y: rw.y });
      }
    });
  });
  return out;
}

/** 席を置く（材質ごとに InstancedMesh） */
export function buildSeats(ctx: SceneContext, root: THREE.Object3D, mats: SeatMats, places: SeatPlace[]): THREE.InstancedMesh[] {
  void ctx;
  const out: THREE.InstancedMesh[] = [];
  for (const tablet of [false, true]) {
    const list = places.filter((p) => p.tablet === tablet);
    if (!list.length) continue;
    const parts = seatParts(tablet);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, cast: boolean): void => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => im.setMatrixAt(i, p.m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = cast;
      im.receiveShadow = true;
      im.frustumCulled = false;
      root.add(im);
      out.push(im);
    };
    add(parts.fabric, mats.fabric, true);
    add(parts.shell, mats.shell, true);
    add(parts.cap, mats.cap, false);
    if (parts.tablet) add(parts.tablet, mats.tablet, false);
  }
  return out;
}

/**
 * 裏の段床のベンチの席（成形の座面と低い背の帯が段ごとに続く。0.5 m おきに背の小さな切れ目）。
 * 遠くから見る所なので、続いた帯で段の縞を見せる（1 席ずつの箱にすると点々に見える）
 */
export function bleacherSeatGeometry(rows: { r0: number; r1: number; y: number }[], aMin: number, aMax: number, gaps: (a: number, r: number) => boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const P = (r: number, a: number, y: number): THREE.Vector3 => new THREE.Vector3(r * Math.sin(a), y, -r * Math.cos(a));
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): void => {
    tri(a, b, c);
    tri(a, c, d);
  };
  for (const rw of rows) {
    const depth = rw.r1 - rw.r0;
    const r = rw.r0 + depth * 0.55;
    const seatW = 0.5;
    const n = Math.floor(((aMax - aMin) * r) / seatW);
    const da = (aMax - aMin) / n;
    for (let i = 0; i < n; i++) {
      const am = aMin + (i + 0.5) * da;
      if (gaps(am, r)) continue;
      // 背の切れ目は小さく（0.03 m）
      const g = 0.015 / r;
      const a0 = aMin + i * da + g;
      const a1 = aMin + (i + 1) * da - g;
      const ys = rw.y + 0.42;
      const f = r - depth * 0.3;
      const bk = r + depth * 0.18;
      // 座面（上面）・前の面・背（舞台を向く面）・背の上の縁
      quad(P(f, a0, ys), P(f, a1, ys), P(bk, a1, ys), P(bk, a0, ys));
      quad(P(f, a0, rw.y), P(f, a1, rw.y), P(f, a1, ys), P(f, a0, ys));
      quad(P(bk - 0.02, a0, ys), P(bk - 0.02, a1, ys), P(bk + 0.06, a1, ys + 0.34), P(bk + 0.06, a0, ys + 0.34));
      quad(P(bk + 0.06, a0, ys + 0.34), P(bk + 0.06, a1, ys + 0.34), P(bk + 0.12, a1, ys + 0.34), P(bk + 0.12, a0, ys + 0.34));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // 面の向きを舞台側（上・内向き）に揃える
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i);
    const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const toward = new THREE.Vector3(-mid.x, 8 - mid.y, -mid.z);
    if (nrm.dot(toward) < 0) {
      p.setXYZ(i + 1, c.x, c.y, c.z);
      p.setXYZ(i + 2, b.x, b.y, b.z);
    }
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}
