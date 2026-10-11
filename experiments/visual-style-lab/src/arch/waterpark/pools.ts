import * as THREE from 'three';
import type { Colliders } from '../../core/Colliders.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { closedCurve, signedArea, sweep, type P2 } from './sweep.ts';

/**
 * 自由な形のプール（スライダーの着水プール・円いプール・流れの水路）。
 * 輪郭（x, z の制御点）をなめらかな曲線にして、縁（断面を掃く）・内側の壁・水面を作り、床に穴を空ける。
 * 当たり判定: 床と水の底を升目（0.5 m）の長方形にまとめる（greedy に大きな長方形へ。箱の数を少なく）。
 */
export interface PoolDef {
  id: string;
  /** 水の縁（内側の縁）の制御点（ワールドの x, z）。なめらかな閉じた曲線になる */
  ctrl: P2[];
  /** 折れ線のまま（直線の水路・角のある槽）。既定はなめらか */
  sharp?: boolean;
  /** 水面の高さ・底の高さ */
  water: number;
  bottom: number;
  /** 縁の形: round = 床から少し盛り上がった丸い縁、raised = 腰の高さの段（タイル張り）、flush = 床と同じ高さ */
  coping: 'round' | 'raised' | 'flush';
  /** 縁の幅・高さ（床より上） */
  cw: number;
  ch: number;
}

export interface PoolBuilt {
  def: PoolDef;
  /** 水の縁の点の列（上から見て反時計回り） */
  inner: THREE.Vector3[];
  /** 縁の外側（床の穴） */
  outer: THREE.Vector3[];
}

export interface PoolMats {
  coping: THREE.Material;
  copingTop?: THREE.Material;
  wall: THREE.Material;
  water: THREE.Material;
}

/** 輪郭を上から見て反時計回り（x 右・-z 奥の図で。signedArea が負）にそろえる */
function ccw(pts: THREE.Vector3[]): THREE.Vector3[] {
  return signedArea(pts) > 0 ? pts.slice().reverse() : pts;
}

/** 折れ線の輪郭を均等な点に（角は残す） */
function polyPts(ctrl: P2[], y: number, step = 0.3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < ctrl.length; i++) {
    const a = ctrl[i];
    const b = ctrl[(i + 1) % ctrl.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) out.push(new THREE.Vector3(a[0] + ((b[0] - a[0]) * k) / n, y, a[1] + ((b[1] - a[1]) * k) / n));
  }
  return out;
}

/** 点の列を外へ d だけずらす（反時計回りの輪郭。外 = 進む向きの右 = 接線 × 上） */
export function offsetOut(pts: THREE.Vector3[], d: number): THREE.Vector3[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const t = b.clone().sub(a).setY(0).normalize();
    const s = new THREE.Vector3(-t.z, 0, t.x); // t × up（右）
    return p.clone().addScaledVector(s, d);
  });
}

export function poolOutline(def: PoolDef): THREE.Vector3[] {
  return ccw(def.sharp ? polyPts(def.ctrl, 0) : closedCurve(def.ctrl, 0, Math.max(48, Math.round(perimeter(def.ctrl) / 0.25))));
}

function perimeter(c: P2[]): number {
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    const a = c[i];
    const b = c[(i + 1) % c.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s * 1.1;
}

/** プールの形を置く（縁・内側の壁・水面）。床の穴は返す outer で */
export function buildPool(b: Builder, m: PoolMats, def: PoolDef): PoolBuilt {
  const inner = poolOutline(def);
  const path = { pts: inner.map((p) => p.clone()), closed: true };
  const w = def.cw;
  const h = def.ch;
  // 断面（横 = 外へ、上）。輪郭の点は水の縁（内側の縁）
  let prof: P2[];
  if (def.coping === 'round') {
    // 床から少し盛り上がった丸い縁: 内側の壁の上端 → 丸い頂 → 外の床へ
    prof = [
      [0, def.water - 0.05],
      [0, h * 0.55],
      [w * 0.12, h * 0.92],
      [w * 0.3, h],
      [w * 0.6, h * 0.94],
      [w * 0.85, h * 0.5],
      [w, 0.0],
    ];
  } else if (def.coping === 'raised') {
    // 腰の段: 内側の壁 → 上面 → 外側の壁 → 床。上面の材質が別なら、上面（笠木）と壁を分ける
    if (m.copingTop) {
      b.mesh(sweep(path, [[0, def.water - 0.05], [0, h - 0.03]]), m.coping, [0, 0, 0], { shadow: false });
      b.mesh(sweep(path, [[0, h - 0.03], [0.03, h], [w - 0.03, h], [w, h - 0.03]]), m.copingTop, [0, 0, 0], { shadow: false });
      prof = [
        [w, h - 0.03],
        [w, 0.0],
      ];
    } else {
      prof = [
        [0, def.water - 0.05],
        [0, h - 0.03],
        [0.03, h],
        [w - 0.03, h],
        [w, h - 0.03],
        [w, 0.0],
      ];
    }
  } else {
    prof = [
      [0, def.water - 0.05],
      [0, h - 0.02],
      [0.03, h],
      [w, h],
    ];
  }
  b.mesh(sweep(path, prof), m.coping, [0, 0, 0], { shadow: false });
  // 内側の壁（水面より下）
  b.mesh(sweep(path, [[0, def.bottom], [0, def.water - 0.04]]), m.wall, [0, 0, 0], { shadow: false });
  // 水面
  const shape = new THREE.Shape(inner.map((p) => new THREE.Vector2(p.x, -p.z)));
  const wg = new THREE.ShapeGeometry(shape, 1);
  wg.rotateX(-Math.PI / 2);
  b.mesh(wg, m.water, [0, def.water, 0], { shadow: false, name: `water-${def.id}` });
  const outer = offsetOut(inner, w);
  return { def, inner, outer };
}

/** 長方形の床から穴（プールの外側の輪郭）を抜いた床の板（上面 y） */
export function floorWithHoles(outline: P2[], holes: THREE.Vector3[][], y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.z))));
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// ------------------------------------------------------------------ 当たり判定（升目 → 長方形）

/** 点が多角形の中か（x, z） */
export function inPoly(x: number, z: number, poly: THREE.Vector3[] | P2[]): boolean {
  let inside = false;
  const P = (i: number): P2 => {
    const v = poly[i] as THREE.Vector3 | P2;
    return Array.isArray(v) ? v : [v.x, v.z];
  };
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = P(i);
    const [xj, zj] = P(j);
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 升目の真偽の地図を、大きな長方形の列にまとめる（[x0, z0, x1, z1]） */
export function maskRects(rect: [number, number, number, number], cell: number, test: (x: number, z: number) => boolean): [number, number, number, number][] {
  const [x0, z0, x1, z1] = rect;
  const nx = Math.max(1, Math.round((x1 - x0) / cell));
  const nz = Math.max(1, Math.round((z1 - z0) / cell));
  const cx = (x1 - x0) / nx;
  const cz = (z1 - z0) / nz;
  const m = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) m[j * nx + i] = test(x0 + (i + 0.5) * cx, z0 + (j + 0.5) * cz) ? 1 : 0;
  const out: [number, number, number, number][] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!m[j * nx + i]) continue;
      let w = 1;
      while (i + w < nx && m[j * nx + i + w]) w++;
      let h = 1;
      outer: while (j + h < nz) {
        for (let k = 0; k < w; k++) if (!m[(j + h) * nx + i + k]) break outer;
        h++;
      }
      for (let jj = 0; jj < h; jj++) for (let k = 0; k < w; k++) m[(j + jj) * nx + i + k] = 0;
      out.push([x0 + i * cx, z0 + j * cz, x0 + (i + w) * cx, z0 + (j + h) * cz]);
    }
  }
  return out;
}

/**
 * 床とプールの当たり判定: rect の中で、プールの外は床（上面 floorY）、プールの中は水の底（遅い・水深つき）。
 * 縁の段（raised）は段の上面
 */
export function floorColliders(col: Colliders, rect: [number, number, number, number], floorY: number, pools: PoolBuilt[], cell = 0.5, skip?: (x: number, z: number) => boolean): void {
  const inAny = (x: number, z: number): PoolBuilt | null => pools.find((p) => inPoly(x, z, p.inner)) ?? null;
  for (const r of maskRects(rect, cell, (x, z) => !inAny(x, z) && !(skip?.(x, z) ?? false))) col.add({ x: r[0], y: floorY - 0.4, z: r[1] }, { x: r[2], y: floorY, z: r[3] });
  for (const p of pools) {
    // 水の中の床: 見た目の底は深くても、歩く高さは床から 0.65 m まで（水に入った目が広間の中に数えられる・段で上がれる）
    const walkBottom = Math.max(p.def.bottom, floorY - 0.65);
    for (const r of maskRects(rect, cell, (x, z) => inPoly(x, z, p.inner))) {
      const bx = col.add({ x: r[0], y: walkBottom - 0.4, z: r[1] }, { x: r[2], y: walkBottom, z: r[3] }, 0.5);
      bx.depth = p.def.water - walkBottom;
    }
    if (p.def.coping === 'raised') {
      // 段の上面（輪郭に沿った小さな箱）
      const n = p.inner.length;
      for (let i = 0; i < n; i += 2) {
        const a = p.inner[i];
        const o = p.outer[i];
        const x0 = Math.min(a.x, o.x) - 0.12;
        const x1 = Math.max(a.x, o.x) + 0.12;
        const z0 = Math.min(a.z, o.z) - 0.12;
        const z1 = Math.max(a.z, o.z) + 0.12;
        col.add({ x: x0, y: floorY, z: z0 }, { x: x1, y: floorY + p.def.ch, z: z1 });
      }
    }
  }
}
