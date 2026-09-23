/**
 * モニュメント（src/generators/monument/types.ts の MonumentSpec）の描画ジオメトリ。
 * 部品ごとに three.js のプリミティブを作り、部品の回転・位置 → モニュメントの yaw・位置で部屋座標へ写す。
 * RoomBuilder は vehicles と同じ「special な部品（外接箱 + ジオメトリ）」として材質ごとに結合し、頂点焼き込みで陰影を付ける。
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box, MatId, RoomLayout } from '../generators/layout';
import type { MonumentPart } from '../generators/monument/types';

export interface MonumentSurface { box: Box; geometry: THREE.BufferGeometry }

const STEP_H = 0.18;

export function monumentSurfaces(layout: RoomLayout): MonumentSurface[] {
  const out: MonumentSurface[] = [];
  for (const m of layout.monuments ?? []) {
    // 材質ごとに部品を結合（描画呼び出しを減らす）
    const byMat = new Map<MatId, THREE.BufferGeometry[]>();
    const root = new THREE.Matrix4().makeRotationY(m.yaw).setPosition(m.pos[0], m.pos[1], m.pos[2]);
    for (const part of m.parts) {
      const g = primitive(part);
      if (!g) continue;
      const local = new THREE.Matrix4();
      if (part.rot) local.makeRotationFromEuler(new THREE.Euler(part.rot[0], part.rot[1], part.rot[2], 'YXZ'));
      local.setPosition(part.pos[0], part.pos[1], part.pos[2]);
      g.applyMatrix4(local);
      g.applyMatrix4(root);
      (byMat.get(part.mat) ?? byMat.set(part.mat, []).get(part.mat)!).push(g);
    }
    for (const [mat, geos] of byMat) {
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
      return new THREE.TubeGeometry(curve, 48, Math.max(0.01, a), 12, false);
    }
    default:
      return null;
  }
}
