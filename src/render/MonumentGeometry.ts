/**
 * モニュメント（src/generators/monument/types.ts の MonumentSpec）の描画ジオメトリ。
 * 部品ごとに three.js のプリミティブを作り、部品の回転・位置 → モニュメントの yaw・位置で部屋座標へ写す。
 * RoomBuilder は vehicles と同じ「special な部品（外接箱 + ジオメトリ）」として材質ごとに結合し、頂点焼き込みで陰影を付ける。
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box, MatId, RoomLayout } from '../generators/layout';
import type { MonumentPart } from '../generators/monument/types';
import { SURFACES } from './MaterialLibrary';
import { buildAppliance } from './props/ApplianceGeometry';

export interface MonumentSurface { box: Box; geometry: THREE.BufferGeometry }

const STEP_H = 0.18;

export function monumentSurfaces(layout: RoomLayout): MonumentSurface[] {
  const out: MonumentSurface[] = [];
  for (const m of layout.monuments ?? []) {
    // 材質ごとに部品を結合（描画呼び出しを減らす）
    const byMat = new Map<MatId, THREE.BufferGeometry[]>();
    const root = new THREE.Matrix4().makeRotationY(m.yaw).setPosition(m.pos[0], m.pos[1], m.pos[2]);
    for (const part of m.parts) {
      const local = new THREE.Matrix4();
      if (part.rot) local.makeRotationFromEuler(new THREE.Euler(part.rot[0], part.rot[1], part.rot[2], 'YXZ'));
      local.setPosition(part.pos[0], part.pos[1], part.pos[2]);
      if (part.prim === 'appliance' && part.appliance) {
        // 家電 1 台（材質ごとの形）。UV は家電側のもの（画面の絵・缶のラベル）を保つ
        for (const [mat, g] of buildAppliance(part.appliance.shape, part.size, { body: part.mat, accent: part.appliance.accent, screen: part.appliance.screen, variant: part.appliance.variant })) {
          g.applyMatrix4(local);
          g.applyMatrix4(root);
          g.userData.keepUV = true;
          (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(g);
        }
        continue;
      }
      const g = primitive(part);
      if (!g) continue;
      g.applyMatrix4(local);
      g.applyMatrix4(root);
      (byMat.get(part.mat) ?? byMat.set(part.mat, []).get(part.mat)!).push(g);
    }
    for (const [mat, geos] of byMat) {
      // UV を部屋座標の実寸（面の向きで 3 方向から投影 / 材質の meters）に（プリミティブの 0〜1 の UV では木目・石目が部品の大きさに引き伸ばされる）
      const meters = SURFACES[mat]?.meters ?? 1;
      for (const g of geos) if (!g.userData.keepUV) projectUV(g, meters);
      // ExtrudeGeometry（ribbon）は非インデックス、他はインデックス付きで mergeGeometries が混在を拒む（M3 の指摘）→ 全て非インデックスに揃える
      const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = flat.length === 1 ? flat[0] : mergeGeometries(flat, false);
      for (const g of geos) if (!flat.includes(g)) g.dispose();
      if (flat.length > 1) for (const g of flat) if (g !== merged) g.dispose();
      if (!merged) continue;
      // RoomBuilder は同じ材質の部屋ジオメトリ（インデックス付き）と再結合するので、インデックス付きに戻す（mergeVertices が index を作る）
      const indexed = merged.index ? merged : mergeVertices(merged, 1e-5);
      if (indexed !== merged) merged.dispose();
      indexed.computeBoundingBox();
      const bb = indexed.boundingBox!;
      const box: Box = { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z], mat, solid: false, kind: 'monument' };
      out.push({ box, geometry: indexed });
    }
  }
  return out;
}

/** 面の向き（法線の最大成分）で 3 方向から投影した UV（部屋座標 / meters）。非インデックスにしてから面ごとに決める（継ぎ目で UV を分ける） */
function projectUV(g: THREE.BufferGeometry, meters: number): void {
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) { for (const k of Object.keys(g.attributes)) g.deleteAttribute(k); for (const [k, v] of Object.entries(flat.attributes)) g.setAttribute(k, v); g.setIndex(null); }
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      const [u, w] = ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y];
      uv[(i + k) * 2] = u / meters; uv[(i + k) * 2 + 1] = w / meters;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** 位置から決まる 0..1 のハッシュ */
function hash3(x: number, y: number, z: number): number {
  let h = (Math.round(x * 97) * 73856093) ^ (Math.round(y * 97) * 19349663) ^ (Math.round(z * 97) * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** 不規則な塊: 正二十面体（分割 2）の頂点を方向の滑らかなノイズで ±28% 押し引きし、[w, h, d] に伸ばす */
function rockGeometry(w: number, h: number, d: number, seed: number): THREE.BufferGeometry {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  const lobes: THREE.Vector3[] = [];
  for (let k = 0; k < 7; k++) lobes.push(new THREE.Vector3(hash3(seed, k, 1) - 0.5, hash3(seed, k, 2) - 0.5, hash3(seed, k, 3) - 0.5).normalize());
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1;
    lobes.forEach((l, k) => { r += (hash3(seed, k, 4) - 0.45) * 0.55 * Math.max(0, v.dot(l)) ** 2; });
    r += (hash3(v.x * 3 + seed, v.y * 3, v.z * 3) - 0.5) * 0.08;
    pos.setXYZ(i, v.x * r * w / 2, v.y * r * h / 2, v.z * r * d / 2);
  }
  g.computeVertexNormals();
  return g;
}

function curveOf(path: readonly [number, number, number][] | undefined): THREE.CatmullRomCurve3 | null {
  if (!path || path.length < 2) return null;
  return new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.5);
}

function primitive(p: MonumentPart): THREE.BufferGeometry | null {
  const [a, b, c] = p.size;
  switch (p.prim) {
    case 'box':
      return new THREE.BoxGeometry(Math.max(0.01, a), Math.max(0.01, b), Math.max(0.01, c));
    case 'plate':
      return new THREE.BoxGeometry(Math.max(0.01, a), Math.max(0.01, b), Math.max(0.005, c || 0.03));
    case 'cylinder':
      return new THREE.CylinderGeometry(Math.max(0, c ?? a), Math.max(0.005, a), Math.max(0.01, b), 24, 1);
    case 'sphere':
      return new THREE.SphereGeometry(Math.max(0.01, a), 24, 16);
    case 'ring': {
      const arc = c && c > 0 ? c : Math.PI * 2;
      return new THREE.TorusGeometry(Math.max(0.05, a), Math.max(0.01, b), 12, Math.max(12, Math.round(48 * arc / (Math.PI * 2))), arc);
    }
    case 'stairs': {
      const steps = Math.max(2, Math.round(b / STEP_H));
      const sh = b / steps, sd = c / steps;
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < steps; i++) {
        const g = new THREE.BoxGeometry(a, sh, c - sd * i);
        // 段は −Z 側から +Z 側へ上がる: i 段目は z 方向に i×sd 分だけ短く、上へ sh ずつ
        g.translate(0, sh * (i + 0.5), (sd * i) / 2);
        geos.push(g);
      }
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (merged) merged.translate(0, 0, -c / 2);
      return merged;
    }
    case 'frame': {
      const bar = Math.max(0.03, c);
      const geos = [
        new THREE.BoxGeometry(a, bar, bar).translate(0, b / 2 - bar / 2, 0),
        new THREE.BoxGeometry(a, bar, bar).translate(0, -b / 2 + bar / 2, 0),
        new THREE.BoxGeometry(bar, b - 2 * bar, bar).translate(-a / 2 + bar / 2, 0, 0),
        new THREE.BoxGeometry(bar, b - 2 * bar, bar).translate(a / 2 - bar / 2, 0, 0),
      ];
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      return merged;
    }
    case 'ribbon': {
      const curve = curveOf(p.path);
      if (!curve) return null;
      const w = Math.max(0.02, a), t = Math.max(0.01, b);
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, -t / 2); shape.lineTo(w / 2, -t / 2); shape.lineTo(w / 2, t / 2); shape.lineTo(-w / 2, t / 2); shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { steps: 64, bevelEnabled: false, extrudePath: curve });
    }
    case 'tube': {
      const curve = curveOf(p.path);
      if (!curve) return null;
      return new THREE.TubeGeometry(curve, Math.max(48, (p.path?.length ?? 2) * 10), Math.max(0.01, a), 12, false);
    }
    case 'knot': {
      const code = Math.round(c || 23);
      const pk = Math.max(1, Math.floor(code / 10)), qk = Math.max(1, code % 10);
      return new THREE.TorusKnotGeometry(Math.max(0.05, a), Math.max(0.01, b), 140, 10, pk, qk);
    }
    case 'rock':
      return rockGeometry(Math.max(0.02, a), Math.max(0.02, b), Math.max(0.02, c), hash3(p.pos[0], p.pos[1], p.pos[2]) * 1000);
    case 'lathe': {
      const pts = (p.path ?? []).map((q) => new THREE.Vector2(Math.max(0, q[0]), q[1]));
      if (pts.length < 2) return null;
      return new THREE.LatheGeometry(pts, 24);
    }
    default:
      return null;
  }
}
