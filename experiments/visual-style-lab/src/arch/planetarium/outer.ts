import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { GeoBuf, type V3 } from './geo.ts';
import { doorAt, facing, onDrum } from './hall.ts';
import { DOME, DOORS, DRUM_R, LOBBY, LOGE, RING } from './layout.ts';
import { BAY_DEG, bayAt } from './zones.ts';

/**
 * ドラムのまわりの建物: 1 階の回廊（ホワイエ）・2 階の回廊・南の玄関ホール（吹き抜け）。
 * 回廊は円の帯（ドームの中心のまわり）で、玄関ホールの所は外の壁を空けてホールとつながる。
 * ドラムの壁の出入口には外の面の枠（抱き）を付ける。形の作り込みの決まり: 壁柱（出入口の両脇）・腰の帯・天井の梁・床の目地
 */

export interface OuterMats {
  cove: THREE.Material;
  floor: THREE.Material;
  /** 回廊の床の下地（石の板の目地の色。板は foyer.ts） */
  joint: THREE.Material;
  wall: THREE.Material;
  wallDark: THREE.Material;
  trim: THREE.Material;
  ceiling: THREE.Material;
  rail: THREE.Material;
  glass: THREE.Material;
  door: THREE.Material;
}

/** 点が玄関ホールの中か（xz） */
export function inLobby(x: number, z: number, pad = 0): boolean {
  return x > LOBBY.x0 - pad && x < LOBBY.x1 + pad && z > LOBBY.z0 - pad && z < LOBBY.z1 + pad;
}
/** ドームの中心からの距離・角度 */
export function rPhi(x: number, z: number): { r: number; phi: number } {
  return { r: Math.hypot(x - DOME.cx, z - DOME.cz), phi: Math.atan2(x - DOME.cx, -(z - DOME.cz)) };
}

const UP = (g: GeoBuf, a: V3, b: V3, c: V3, d: V3): void => facing(g, a, b, c, d, [(a[0] + c[0]) / 2, a[1] + 5, (a[2] + c[2]) / 2]);
const DOWN = (g: GeoBuf, a: V3, b: V3, c: V3, d: V3): void => facing(g, a, b, c, d, [(a[0] + c[0]) / 2, a[1] - 5, (a[2] + c[2]) / 2]);

export function buildOuter(b: Builder, m: OuterMats): void {
  const floor = new GeoBuf();
  const wall = new GeoBuf();
  const dark = new GeoBuf();
  const ceil = new GeoBuf();
  const trim = new GeoBuf();
  const W = (r: number, p: number, y: number): V3 => onDrum(r, p, y);
  const C: V3 = [DOME.cx, 2, DOME.cz];
  const N = 360;
  for (let i = 0; i < N; i++) {
    const p0 = (i / N) * Math.PI * 2;
    const p1 = ((i + 1) / N) * Math.PI * 2;
    const pm = (p0 + p1) / 2;
    const mid1 = W((RING.wallOut + RING.r1) / 2, pm, 0);
    const lob1 = inLobby(mid1[0], mid1[2]);
    // ドラムの壁の外の面（1 階・2 階）。出入口は空ける
    const d = doorAt(pm);
    const bands: [number, number][] = [];
    if (!d) bands.push([0, RING.ceil2]);
    else {
      if (d[0] > 0) bands.push([0, d[0]]);
      bands.push([d[1], RING.ceil2]);
    }
    for (const [y0, y1] of bands) facing(wall, W(RING.wallOut, p0, y0), W(RING.wallOut, p1, y0), W(RING.wallOut, p1, y1), W(RING.wallOut, p0, y1), [W(40, pm, 0)[0], y0, W(40, pm, 0)[2]]);
    // 腰の暗い帯（1 階・2 階）
    if (!d || d[0] > 0) facing(dark, W(RING.wallOut + 0.01, p0, 0), W(RING.wallOut + 0.01, p1, 0), W(RING.wallOut + 0.01, p1, 0.9), W(RING.wallOut + 0.01, p0, 0.9), W(40, pm, 0));
    if (!d || d[0] === 0) facing(dark, W(RING.wallOut + 0.01, p0, LOGE.l1), W(RING.wallOut + 0.01, p1, LOGE.l1), W(RING.wallOut + 0.01, p1, LOGE.l1 + 0.9), W(RING.wallOut + 0.01, p0, LOGE.l1 + 0.9), W(40, pm, 0));
    // 1 階の回廊: 床・天井（= 2 階の床の下面）・外の壁
    UP(floor, W(RING.wallOut, p0, 0), W(RING.r1, p0, 0), W(RING.r1, p1, 0), W(RING.wallOut, p1, 0));
    const mid2 = W((RING.wallOut + RING.r2) / 2, pm, 0);
    const lob2 = inLobby(mid2[0], mid2[2]);
    DOWN(ceil, W(RING.wallOut, p0, RING.ceil1), W(lob1 ? RING.r2 : RING.r1, p0, RING.ceil1), W(lob1 ? RING.r2 : RING.r1, p1, RING.ceil1), W(RING.wallOut, p1, RING.ceil1));
    if (!lob1) facing(wall, W(RING.r1, p0, 0), W(RING.r1, p1, 0), W(RING.r1, p1, RING.ceil1), W(RING.r1, p0, RING.ceil1), C);
    if (!lob1) facing(dark, W(RING.r1 - 0.01, p0, 0), W(RING.r1 - 0.01, p1, 0), W(RING.r1 - 0.01, p1, 0.9), W(RING.r1 - 0.01, p0, 0.9), C);
    // 1 階と 2 階の間の帯（2 階の床の厚み）: 外へ
    if (!lob1) facing(wall, W(RING.r1, p0, RING.ceil1), W(RING.r1, p1, RING.ceil1), W(RING.r1, p1, RING.floor2), W(RING.r1, p0, RING.floor2), [W(60, pm, 0)[0], 3, W(60, pm, 0)[2]]);
    // 2 階の回廊: 床・天井・外の壁（玄関ホールの所は手すりの縁）
    UP(floor, W(RING.wallOut, p0, RING.floor2), W(RING.r2, p0, RING.floor2), W(RING.r2, p1, RING.floor2), W(RING.wallOut, p1, RING.floor2));
    DOWN(ceil, W(RING.wallOut, p0, RING.ceil2), W(RING.r2, p0, RING.ceil2), W(RING.r2, p1, RING.ceil2), W(RING.wallOut, p1, RING.ceil2));
    if (!lob2 && !lob1) facing(wall, W(RING.r2, p0, RING.floor2), W(RING.r2, p1, RING.floor2), W(RING.r2, p1, RING.ceil2), W(RING.r2, p0, RING.ceil2), C);
    else {
      // 吹き抜けへの縁（床の縁の帯と手すり）
      facing(trim, W(RING.r2, p0, RING.ceil1), W(RING.r2, p1, RING.ceil1), W(RING.r2, p1, RING.floor2), W(RING.r2, p0, RING.floor2), [W(60, pm, 0)[0], 3, W(60, pm, 0)[2]]);
      facing(trim, W(RING.r2 - 0.03, p0, RING.floor2 + 0.98), W(RING.r2 - 0.03, p1, RING.floor2 + 0.98), W(RING.r2 - 0.03, p1, RING.floor2 + 1.06), W(RING.r2 - 0.03, p0, RING.floor2 + 1.06), [W(60, pm, 0)[0], 5, W(60, pm, 0)[2]]);
      UP(trim, W(RING.r2 - 0.08, p0, RING.floor2 + 1.06), W(RING.r2 + 0.02, p0, RING.floor2 + 1.06), W(RING.r2 + 0.02, p1, RING.floor2 + 1.06), W(RING.r2 - 0.08, p1, RING.floor2 + 1.06));
      // 2 階の天井の縁（吹き抜けの上へ）
      facing(trim, W(RING.r2, p0, RING.ceil2 - 0.4), W(RING.r2, p1, RING.ceil2 - 0.4), W(RING.r2, p1, RING.ceil2), W(RING.r2, p0, RING.ceil2), [W(60, pm, 0)[0], 5, W(60, pm, 0)[2]]);
    }
    // 2 階の外の腰の帯
    if (!lob2 && !lob1) facing(dark, W(RING.r2 - 0.01, p0, RING.floor2), W(RING.r2 - 0.01, p1, RING.floor2), W(RING.r2 - 0.01, p1, RING.floor2 + 0.9), W(RING.r2 - 0.01, p0, RING.floor2 + 0.9), C);
  }
  // 出入口の抱き（ドラムの壁の厚み）と枠
  const jamb = (deg: number, y0: number): void => {
    const ph = (deg * Math.PI) / 180;
    const half = DOORS.w / 2 / DRUM_R;
    for (const sg of [-1, 1]) {
      const p = ph + sg * half;
      facing(trim, W(DRUM_R, p, y0), W(RING.wallOut, p, y0), W(RING.wallOut, p, y0 + DOORS.h), W(DRUM_R, p, y0 + DOORS.h), W(DRUM_R + 0.3, ph, y0 + 1));
    }
    DOWN(trim, W(DRUM_R, ph - half, y0 + DOORS.h), W(RING.wallOut, ph - half, y0 + DOORS.h), W(RING.wallOut, ph + half, y0 + DOORS.h), W(DRUM_R, ph + half, y0 + DOORS.h));
    // 外の枠（額縁）
    for (const sg of [-1, 1]) {
      const p = ph + sg * (half + 0.1 / DRUM_R);
      const a = W(RING.wallOut + 0.04, p - 0.1 / DRUM_R, y0);
      const c = W(RING.wallOut + 0.04, p + 0.1 / DRUM_R, y0 + DOORS.h + 0.15);
      facing(trim, a, [c[0], y0, c[2]], c, [a[0], y0 + DOORS.h + 0.15, a[2]], W(40, ph, y0 + 1));
    }
    const a = W(RING.wallOut + 0.04, ph - half - 0.2 / DRUM_R, y0 + DOORS.h);
    const c = W(RING.wallOut + 0.04, ph + half + 0.2 / DRUM_R, y0 + DOORS.h + 0.18);
    facing(trim, a, [c[0], a[1], c[2]], c, [a[0], c[1], a[2]], W(40, ph, y0 + 1));
  };
  // 出入口の抱きの戸当たり（抱きの中ほどの細い縦の帯と上の帯）・蹴り板（下の金物）・遮光の幕の吊りの溝（客席の側の上）
  const stops = (deg: number, y0: number): void => {
    const ph = (deg * Math.PI) / 180;
    const half = DOORS.w / 2 / DRUM_R;
    const rm = (DRUM_R + RING.wallOut) / 2;
    for (const sg of [-1, 1]) {
      const p = ph + sg * (half - 0.02 / DRUM_R);
      const a = W(rm - 0.03, p, y0);
      const c = W(rm + 0.03, p, y0 + DOORS.h);
      facing(trim, a, [c[0], y0, c[2]], c, [a[0], y0 + DOORS.h, a[2]], W(rm, ph, y0 + 1));
      const k0 = W(DRUM_R + 0.02, p, y0);
      const k1 = W(RING.wallOut - 0.02, p, y0 + 0.25);
      facing(dark, k0, [k1[0], y0, k1[2]], k1, [k0[0], y0 + 0.25, k0[2]], W(rm, ph, y0 + 1));
    }
    DOWN(trim, W(rm - 0.03, ph - half, y0 + DOORS.h - 0.04), W(rm + 0.03, ph - half, y0 + DOORS.h - 0.04), W(rm + 0.03, ph + half, y0 + DOORS.h - 0.04), W(rm - 0.03, ph + half, y0 + DOORS.h - 0.04));
    DOWN(dark, W(DRUM_R + 0.02, ph - half, y0 + DOORS.h - 0.02), W(DRUM_R + 0.12, ph - half, y0 + DOORS.h - 0.02), W(DRUM_R + 0.12, ph + half, y0 + DOORS.h - 0.02), W(DRUM_R + 0.02, ph + half, y0 + DOORS.h - 0.02));
  };
  for (const deg of DOORS.ground) stops(deg, 0);
  for (const deg of DOORS.upper) stops(deg, LOGE.l1);
  for (const deg of DOORS.ground) jamb(deg, 0);
  for (const deg of DOORS.upper) jamb(deg, LOGE.l1);
  // 間接照明の帯（回廊の天井ぎわ。器具は梁と梁の間に 1 本ずつ（梁の所で切れる）。外の壁は展示の区間以外、
  // ドラムの面は休む区間と玄関ホールだけ（展示は格天井とスポット、出入口は案内の箱が代わる）。zones.ts のベイの種類
  const cove = new GeoBuf();
  for (let i = 0; i < N; i++) {
    const p0 = (i / N) * Math.PI * 2;
    const p1 = ((i + 1) / N) * Math.PI * 2;
    const pm = (p0 + p1) / 2;
    const degM = (pm * 180) / Math.PI;
    const toBeam = Math.abs(degM / BAY_DEG - Math.round(degM / BAY_DEG)) * BAY_DEG;
    if (toBeam < 0.6) continue;
    const mid1 = W((RING.wallOut + RING.r1) / 2, pm, 0);
    const lob1 = inLobby(mid1[0], mid1[2]);
    const mid2 = W((RING.wallOut + RING.r2) / 2, pm, 0);
    const lob2 = inLobby(mid2[0], mid2[2]);
    const z1 = bayAt(1, pm).zone;
    const z2 = bayAt(2, pm).zone;
    const band = (r: number, y0: number, y1: number, toward: V3): void => facing(cove, W(r, p0, y0), W(r, p1, y0), W(r, p1, y1), W(r, p0, y1), toward);
    if (!lob1 && z1 !== 'exhibit') band(RING.r1 - 0.02, RING.ceil1 - 0.32, RING.ceil1 - 0.2, C);
    if (z1 === 'rest' || z1 === 'lobby') band(RING.wallOut + 0.02, RING.ceil1 - 0.32, RING.ceil1 - 0.2, W(40, pm, 0));
    if (!lob2 && !lob1 && z2 !== 'exhibit') band(RING.r2 - 0.02, RING.ceil2 - 0.32, RING.ceil2 - 0.2, C);
    if (z2 === 'rest' || z2 === 'lobby') band(RING.wallOut + 0.02, RING.ceil2 - 0.32, RING.ceil2 - 0.2, W(40, pm, 0));
  }
  b.mesh(cove.build(), m.cove, [0, 0, 0], { shadow: false });
  b.mesh(floor.build(), m.joint, [0, 0, 0], { shadow: 'receive' });
  b.mesh(wall.build(), m.wall, [0, 0, 0], { shadow: true });
  b.mesh(dark.build(), m.wallDark, [0, 0, 0], { shadow: false });
  b.mesh(ceil.build(), m.ceiling, [0, 0, 0], { shadow: true });
  b.mesh(trim.build(), m.trim, [0, 0, 0], { shadow: false });
}

/** 玄関ホール（吹き抜け）: 床・壁・天井・南の玄関のガラス戸・東の階段と 2 階の渡り廊下 */
export function buildLobby(b: Builder, m: OuterMats): { stair: { x0: number; x1: number; z0: number; z1: number } } {
  const { x0, x1, z0, z1, ceil } = LOBBY;
  // 床（回廊の帯の外の所。回廊の床と重ならないように 1 cm 下げる）
  b.boxMM(m.floor, [x0, -0.3, z0], [x1, -0.005, z1], { shadow: 'receive' });
  // 天井と梁
  b.boxMM(m.ceiling, [x0 - 0.3, ceil, z0], [x1 + 0.3, ceil + 0.3, z1 + 0.3], { shadow: false });
  for (let x = x0 + 3.6; x < x1 - 1; x += 3.6) b.boxMM(m.trim, [x - 0.2, ceil - 0.6, z0], [x + 0.2, ceil, z1], { shadow: false });
  // 壁: 南（玄関）・西・東。南はガラス戸の帯
  const wallPart = (a: [number, number], c: [number, number], y0: number, y1: number, mat = m.wall): void => {
    b.boxMM(mat, [Math.min(a[0], c[0]), y0, Math.min(a[1], c[1])], [Math.max(a[0], c[0]), y1, Math.max(a[1], c[1])], { collide: true });
  };
  // 西の壁・東の壁（回廊の外の壁から南の壁まで）
  wallPart([x0 - 0.3, z0 - 4], [x0, z1], 0, ceil);
  wallPart([x1, z0 - 4], [x1 + 0.3, z1], 0, ceil);
  // 南の壁: 玄関（中ほどの 9 m はガラス戸。閉じている）
  const gx0 = (x0 + x1) / 2 - 4.5;
  const gx1 = (x0 + x1) / 2 + 4.5;
  wallPart([x0, z1], [gx0, z1 + 0.3], 0, ceil);
  wallPart([gx1, z1], [x1, z1 + 0.3], 0, ceil);
  wallPart([gx0, z1], [gx1, z1 + 0.3], 3.2, ceil);
  b.boxMM(m.glass, [gx0, 0, z1 + 0.1], [gx1, 3.2, z1 + 0.14], { collide: true, shadow: false });
  for (let x = gx0; x <= gx1 + 1e-6; x += 1.5) b.boxMM(m.trim, [x - 0.04, 0, z1 + 0.06], [x + 0.04, 3.2, z1 + 0.2], { shadow: false });
  b.boxMM(m.trim, [gx0, 2.3, z1 + 0.06], [gx1, 2.36, z1 + 0.2], { shadow: false });
  // 階段（東の壁ぎわ。南から北へ上がる）と 2 階の渡り廊下（東の壁ぎわを回廊まで）
  const sx0 = x1 - 2.4;
  const sx1 = x1;
  const n = Math.round(LOGE.l1 / 0.18);
  const rise = LOGE.l1 / n;
  const tread = 0.28;
  const zStart = z1 - 1.2;
  for (let i = 0; i < n; i++) {
    const zA = zStart - i * tread;
    b.boxMM(m.floor, [sx0, 0, zA - tread], [sx1, rise * (i + 1), zA], { collide: true });
  }
  const zTop = zStart - n * tread;
  // 渡り廊下（階段の上から北へ、回廊の 2 階の床まで）
  b.boxMM(m.floor, [sx0, LOGE.l1 - 0.35, z0 - 4], [sx1, LOGE.l1, zTop], { collide: true });
  // 階段と渡り廊下の手すり（西の縁）
  b.boxMM(m.rail, [sx0 - 0.06, LOGE.l1 + 0.98, z0 - 1], [sx0, LOGE.l1 + 1.06, zTop], { shadow: false });
  for (let z = zTop - 0.1; z > z0 - 1; z -= 1.0) b.boxMM(m.rail, [sx0 - 0.05, LOGE.l1, z - 0.02], [sx0 - 0.01, LOGE.l1 + 1.0, z + 0.02], { shadow: false });
  // 階段の手すり（斜めの笠木）
  {
    const len = Math.hypot(n * tread, LOGE.l1);
    const g = new THREE.BoxGeometry(0.06, 0.08, len);
    g.rotateX(Math.atan2(LOGE.l1, n * tread));
    b.mesh(g, m.rail, [sx0 - 0.03, LOGE.l1 / 2 + 1.0, zStart - (n * tread) / 2], { shadow: false });
  }
  return { stair: { x0: sx0, x1: sx1, z0: zTop, z1: zStart } };
}

/** 回廊・玄関ホールの当たり判定の箱の関数（gridColliders へ） */
export function outerColliders(): {
  ground: (x: number, z: number) => [number, number] | null;
  upper: (x: number, z: number) => [number, number] | null;
  walls: (x: number, z: number) => [number, number] | null;
  walls2: (x: number, z: number) => [number, number] | null;
} {
  return {
    ground: (x, z) => {
      const { r } = rPhi(x, z);
      // 回廊と玄関ホール。ドラムの壁の厚みの所も床（出入口を通れる）
      if ((r > DRUM_R - 0.05 && r < RING.r1) || inLobby(x, z)) return [-1, 0];
      return null;
    },
    upper: (x, z) => {
      const { r } = rPhi(x, z);
      if (r > DRUM_R - 0.05 && r < RING.r2) return [RING.floor2 - 0.35, RING.floor2];
      return null;
    },
    walls: (x, z) => {
      const { r, phi } = rPhi(x, z);
      // ドラムの壁（出入口は空ける）
      if (r >= DRUM_R && r <= RING.wallOut) {
        const d = doorAt(phi, -0.1 / DRUM_R);
        if (!d) return [-1, RING.ceil2 + 4];
        if (d[0] === 0) return [d[1], RING.ceil2 + 4];
        return [-1, d[0]];
      }
      // 1 階の回廊の外の壁（玄関ホールは空ける）
      if (r >= RING.r1 && r <= RING.r1 + 0.6 && !inLobby(x, z, -0.3)) return [-1, RING.ceil1];
      return null;
    },
    walls2: (x, z) => {
      const { r, phi } = rPhi(x, z);
      if (r >= DRUM_R && r <= RING.wallOut) {
        const d = doorAt(phi, -0.1 / DRUM_R);
        if (d && d[0] > 0) return [d[1], RING.ceil2 + 4];
        return null;
      }
      // 2 階の回廊の外の壁（天井まで）・吹き抜けの手すり（玄関ホールの上だけ。腰の高さ）
      if (r >= RING.r2 && r <= RING.r2 + 0.5) return inLobby(x, z, 0.6) ? [RING.floor2, RING.floor2 + 1.1] : [RING.floor2, RING.ceil2];
      return null;
    },
  };
}
