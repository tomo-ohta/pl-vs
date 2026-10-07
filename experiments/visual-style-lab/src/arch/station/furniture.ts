import * as THREE from 'three';
import type { Builder, V3 } from '../../scenes/Builder.ts';

/**
 * ベンチ。向きは yaw（0 で座る人が -Z を向く、正で左回り）。位置はベンチの中心（座面の下の床）。
 * 座席は 1 席ずつの樹脂の殻（座面から背もたれへ曲がって立ち上がる 1 枚の面。背もたれは上へ少し広がり、上の角は丸い）。
 * 座席の間に隙間があり、細い金属の梁と脚で支える（下と間から向こうが見える）。
 */

const tmpM = new THREE.Matrix4();

/** ローカル座標（x = 右、z = 後ろ）で作った形を、位置と向きに合わせて置く */
function put(b: Builder, geo: THREE.BufferGeometry, mat: THREE.Material, base: V3, yaw: number, local: V3, rotX = 0): void {
  const g = geo.clone();
  if (rotX) g.applyMatrix4(tmpM.makeRotationX(rotX));
  g.translate(...local);
  g.applyMatrix4(tmpM.makeRotationY(yaw));
  b.mesh(g, mat, base);
}

/** 管（ローカル座標の点列） */
function tube(b: Builder, mat: THREE.Material, base: V3, yaw: number, pts: V3[], r: number): void {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.3), 16, r, 6, false);
  g.applyMatrix4(tmpM.makeRotationY(yaw));
  b.mesh(g, mat, base);
}

export interface ShellOptions {
  /** 座面の幅 */
  width: number;
  /** 座面の高さ・奥行き */
  seatY?: number;
  /** 背もたれの上端の高さ */
  backTop?: number;
  /** 背もたれの上で広がる割合 */
  taper?: number;
  /** 上の角の丸み（m） */
  corner?: number;
}

/**
 * 座席の殻（両面の 1 枚の曲面）。断面の中心線を Catmull-Rom で結び、幅方向に面を張る。
 * 前の縁は少し下へ巻く。原点は座席の中心の床、前が -Z。
 */
export function shellGeometry(o: ShellOptions): THREE.BufferGeometry {
  const W = o.width;
  const sy = o.seatY ?? 0.43;
  const top = o.backTop ?? 0.86;
  const taper = o.taper ?? 0.12;
  const r = o.corner ?? 0.07;
  const prof = new THREE.CatmullRomCurve3(
    [
      [0, sy - 0.04, -0.22],
      [0, sy, -0.19],
      [0, sy + 0.01, -0.1],
      [0, sy - 0.005, 0.04],
      [0, sy, 0.14],
      [0, sy + 0.05, 0.2],
      [0, sy + 0.16, 0.235],
      [0, (sy + top) / 2 + 0.08, 0.26],
      [0, top, 0.3],
    ].map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.4,
  );
  const NT = 24;
  const NS = 8;
  const pts = prof.getSpacedPoints(NT);
  const len = prof.getLength();
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= NT; i++) {
    const p = pts[i];
    // 上の角の丸み（上端からの道のり d が r より小さい所で幅を狭める）
    const d = (1 - i / NT) * len;
    const hw0 = (W / 2) * (1 + taper * Math.max(0, (p.y - (sy + 0.1)) / (top - sy)));
    const hw = d < r ? hw0 - r + Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))) : hw0;
    for (let j = 0; j <= NS; j++) {
      const x = -hw + (2 * hw * j) / NS;
      // 座面は左右がわずかに上がる（くぼみ）
      const dish = 0.012 * Math.pow((2 * j) / NS - 1, 2);
      pos.push(x, p.y + dish, p.z);
    }
  }
  for (let i = 0; i < NT; i++) {
    for (let j = 0; j < NS; j++) {
      const a = i * (NS + 1) + j;
      const c = a + NS + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** 樹脂の座席が並ぶベンチ（station-1・station-3 の長い列）。n 席、席の間隔 pitch */
export function seatRow(b: Builder, mat: THREE.Material, frame: THREE.Material, base: V3, yaw: number, n: number, pitch = 0.56): void {
  const len = n * pitch;
  const shell = shellGeometry({ width: pitch - 0.07, backTop: 0.84, taper: 0.1, corner: 0.06 });
  for (let i = 0; i < n; i++) put(b, shell, mat, base, yaw, [-len / 2 + pitch * (i + 0.5), 0, 0]);
  // 座席の下の梁（細い 2 本）と、端と途中の脚（T 字の脚と足）
  put(b, new THREE.BoxGeometry(len - 0.1, 0.04, 0.04), frame, base, yaw, [0, 0.37, -0.02]);
  put(b, new THREE.BoxGeometry(len - 0.1, 0.04, 0.04), frame, base, yaw, [0, 0.37, 0.17]);
  const legs = Math.max(2, Math.round(len / 1.8) + 1);
  for (let k = 0; k < legs; k++) {
    const x = -len / 2 + 0.2 + ((len - 0.4) * k) / (legs - 1);
    put(b, new THREE.BoxGeometry(0.05, 0.36, 0.05), frame, base, yaw, [x, 0.18, 0.08]);
    put(b, new THREE.BoxGeometry(0.04, 0.03, 0.46), frame, base, yaw, [x, 0.015, 0.06]);
    put(b, new THREE.BoxGeometry(0.04, 0.04, 0.3), frame, base, yaw, [x, 0.37, 0.08]);
  }
}

/** 2 人掛けの座席（肘掛けの輪・脚）。station-0 */
export function twinSeat(b: Builder, mat: THREE.Material, frame: THREE.Material, base: V3, yaw: number): void {
  const shell = shellGeometry({ width: 0.53, seatY: 0.42, backTop: 0.86, taper: 0.1, corner: 0.08 });
  for (const x of [-0.28, 0.28]) put(b, shell, mat, base, yaw, [x, 0, 0]);
  // 座席の下の梁と、両端の脚（前後に開いた脚と足）・肘掛けの輪
  put(b, new THREE.BoxGeometry(1.2, 0.035, 0.035), frame, base, yaw, [0, 0.37, 0.05]);
  put(b, new THREE.BoxGeometry(1.2, 0.035, 0.035), frame, base, yaw, [0, 0.37, -0.12]);
  for (const x of [-0.55, 0.55]) {
    const s = Math.sign(x);
    tube(b, frame, base, yaw, [
      [x, 0.0, -0.16],
      [x, 0.2, -0.13],
      [x, 0.38, -0.08],
    ], 0.016);
    tube(b, frame, base, yaw, [
      [x, 0.0, 0.2],
      [x, 0.2, 0.17],
      [x, 0.38, 0.1],
    ], 0.016);
    put(b, new THREE.BoxGeometry(0.03, 0.02, 0.4), frame, base, yaw, [x, 0.01, 0.02]);
    // 肘掛け（座面の外の縁から上がって前へ回る輪）
    tube(b, frame, base, yaw, [
      [x + s * 0.03, 0.4, 0.16],
      [x + s * 0.06, 0.55, 0.12],
      [x + s * 0.065, 0.6, 0.0],
      [x + s * 0.065, 0.58, -0.14],
      [x + s * 0.04, 0.44, -0.2],
    ], 0.016);
  }
}

/**
 * 板を並べたベンチ（曲がった座面と背もたれ・開いた脚）。station-2 の小さな上屋。
 * 板は断面の曲線に沿って並べる。
 */
export function slatBench(b: Builder, mat: THREE.Material, frame: THREE.Material, base: V3, yaw: number, len = 1.8): void {
  const prof = new THREE.CatmullRomCurve3(
    [
      [0, 0.4, -0.22],
      [0, 0.43, -0.1],
      [0, 0.42, 0.08],
      [0, 0.46, 0.2],
      [0, 0.62, 0.27],
      [0, 0.8, 0.33],
      [0, 0.92, 0.38],
    ].map((p) => new THREE.Vector3(p[0], p[1], p[2])),
  );
  const N = 10;
  for (let i = 0; i <= N; i++) {
    if (i === 4) continue; // 座面と背もたれの間のすき間
    const t = i / N;
    const p = prof.getPointAt(t);
    const tg = prof.getTangentAt(t);
    const ang = Math.atan2(tg.y, tg.z);
    put(b, new THREE.BoxGeometry(len, 0.02, 0.075), mat, base, yaw, [0, p.y, p.z], -ang);
  }
  // 脚: 前後に開いた 2 本と、座面と背もたれを支える曲がった腕
  for (const x of [-len / 2 + 0.15, len / 2 - 0.15]) {
    tube(b, frame, base, yaw, [
      [x, 0.0, -0.28],
      [x, 0.2, -0.16],
      [x, 0.4, -0.05],
    ], 0.022);
    tube(b, frame, base, yaw, [
      [x, 0.0, 0.32],
      [x, 0.2, 0.2],
      [x, 0.4, 0.06],
    ], 0.022);
    tube(b, frame, base, yaw, [
      [x, 0.39, -0.2],
      [x, 0.41, 0.1],
      [x, 0.58, 0.25],
      [x, 0.9, 0.36],
    ], 0.02);
  }
}
