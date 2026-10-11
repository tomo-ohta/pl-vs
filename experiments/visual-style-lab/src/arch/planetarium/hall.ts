import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { GeoBuf, pt, ptAt, type V3 } from './geo.ts';
import { BOOTH, CATWALK_Y, DOME, DOORS, DRUM_R, FLOOR, HOUSE, LOGE, PULPIT, STAGE, TIERS, VIEW } from './layout.ts';
import { floorY, rWall, tierAt } from './profile.ts';

/**
 * 大ドームの客席の形: 舞台・まわりの通路・平土間（大きな床のタイル）・段床（舞台の裏・北西の壁ぎわ）・
 * ドラムの壁（壁柱・1 階の回廊・2 階の柱の回廊・上の壁・輪の通路と手すり）。
 * 段床は舞台の中心のまわりの輪、ドラムの壁はドームの中心のまわりの円。
 */

function up(g: GeoBuf, a: V3, b: V3, c: V3, d: V3): void {
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
  if (n.y >= 0) g.quad(a, b, c, d);
  else g.quad(a, d, c, b);
}
function down(g: GeoBuf, a: V3, b: V3, c: V3, d: V3): void {
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
  if (n.y <= 0) g.quad(a, b, c, d);
  else g.quad(a, d, c, b);
}
/** 向き toward（点）の側を表にした四角 */
export function facing(g: GeoBuf, a: V3, b: V3, c: V3, d: V3, toward: V3): void {
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
  const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
  const t = new THREE.Vector3(toward[0] - m[0], toward[1] - m[1], toward[2] - m[2]);
  if (n.dot(t) >= 0) g.quad(a, b, c, d);
  else g.quad(a, d, c, b);
}

export interface HallMats {
  floor: THREE.Material; // 平土間（大きなタイル）
  tread: THREE.Material; // 段床の踏み面
  riser: THREE.Material; // 段床の蹴上げ
  stage: THREE.Material;
  stageEdge: THREE.Material;
  walk: THREE.Material; // 舞台のまわりの通路
  wall: THREE.Material; // ドラムの壁（暗い）
  pier: THREE.Material; // 壁柱・柱
  slab: THREE.Material; // 回廊の床の縁・下面
  rail: THREE.Material; // 手すり
  ceiling: THREE.Material;
  nosing: THREE.Material; // 段鼻
}

const DA = (0.6 * Math.PI) / 180;

/** 舞台・通路・平土間・段床 */
export function buildFloors(b: Builder, m: HallMats): void {
  const floor = new GeoBuf();
  const tread = new GeoBuf();
  const riser = new GeoBuf();
  const walk = new GeoBuf();
  const stage = new GeoBuf();
  const edge = new GeoBuf();
  const nose = new GeoBuf();
  const n = Math.round((Math.PI * 2) / DA);
  const C: V3 = [0, 3, 0];
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI + i * DA;
    const a1 = a0 + DA;
    const am = (a0 + a1) / 2;
    const rw = rWall(am) + 0.05;
    facing(edge, pt(STAGE.r, a0, 0), pt(STAGE.r, a1, 0), pt(STAGE.r, a1, STAGE.top), pt(STAGE.r, a0, STAGE.top), pt(STAGE.r + 5, am, 0.2));
    up(walk, pt(STAGE.r, a0, 0), pt(FLOOR.r0, a0, 0), pt(FLOOR.r0, a1, 0), pt(STAGE.r, a1, 0));
    const t = tierAt(am);
    const r0 = Math.min(t ? t.start : Infinity, rw);
    if (r0 > FLOOR.r0) up(floor, pt(FLOOR.r0, a0, 0), pt(r0, a0, 0), pt(r0, a1, 0), pt(FLOOR.r0, a1, 0));
    if (t && r0 < rw) {
      let yPrev = 0;
      for (const row of t.rows) {
        const ra = t.start + row.d0;
        if (ra >= rw) break;
        const rb = Math.min(t.start + row.d1, rw);
        // 舞台の裏の塔の中は段を作らない（前室の床）。この向きで塔が占める半径の区間を除いて描く
        const hr = houseSpan(am);
        const parts: [number, number][] = hr ? ([[ra, Math.min(rb, hr[0])], [Math.max(ra, hr[1]), rb]] as [number, number][]).filter(([u, v]) => v - u > 1e-3) : [[ra, rb]];
        const riserIn = hr && ra > hr[0] - 0.02 && ra < hr[1] + 0.02;
        if (!riserIn) facing(riser, pt(ra, a0, yPrev), pt(ra, a1, yPrev), pt(ra, a1, row.y), pt(ra, a0, row.y), C);
        for (const [u, v] of parts) up(tread, pt(u, a0, row.y), pt(v, a0, row.y), pt(v, a1, row.y), pt(u, a1, row.y));
        // 段鼻の明るい細い帯（段の形が暗い中でも見える）
        if (!riserIn) up(nose, pt(ra, a0, row.y + 0.005), pt(ra + 0.04, a0, row.y + 0.005), pt(ra + 0.04, a1, row.y + 0.005), pt(ra, a1, row.y + 0.005));
        yPrev = row.y;
      }
    }
  }
  // 段床の端（角度の境の縦の面）。低い側を表に
  for (const ab of [TIERS.back.a0, TIERS.back.a1, TIERS.west.a0, TIERS.west.a1]) {
    const rw = rWall(ab);
    const step = 0.1;
    for (let r = FLOOR.r0; r < rw - 1e-3; r += step) {
      const rr = Math.min(r + step, rw);
      const yP = floorY(...xz(r + step / 2, ab + 0.003));
      const yM = floorY(...xz(r + step / 2, ab - 0.003));
      if (Math.abs(yP - yM) < 1e-3) continue;
      const lo = Math.min(yP, yM);
      const hi = Math.max(yP, yM);
      const lowSide = yP < yM ? 1 : -1;
      facing(riser, pt(r, ab, lo), pt(rr, ab, lo), pt(rr, ab, hi), pt(r, ab, hi), pt((r + rr) / 2, ab + lowSide * 0.3, (lo + hi) / 2));
    }
  }
  b.mesh(floor.build(), m.floor, [0, 0, 0], { shadow: 'receive' });
  b.mesh(tread.build(), m.tread, [0, 0, 0], { shadow: 'receive' });
  b.mesh(riser.build(), m.riser, [0, 0, 0], { shadow: 'receive' });
  b.mesh(walk.build(), m.walk, [0, 0, 0], { shadow: 'receive' });
  // 舞台の円盤（大理石の模様の絵を貼るので uv つきの円）
  const disc = new THREE.CircleGeometry(STAGE.r, 96);
  disc.rotateX(-Math.PI / 2);
  b.mesh(disc, m.stage, [0, STAGE.top, 0], { shadow: 'receive' });
  void stage;
  b.mesh(edge.build(), m.stageEdge, [0, 0, 0], { shadow: 'receive' });
  b.mesh(nose.build(), m.nosing, [0, 0, 0], { shadow: false });
}
/** 舞台の中心から向き a へ進む光線が、舞台の裏の塔（長方形）の中にいる半径の区間（無ければ null） */
function houseSpan(a: number): [number, number] | null {
  const ux = Math.sin(a);
  const uz = -Math.cos(a);
  let t0 = 0;
  let t1 = 1e3;
  for (const [o, d, lo, hi] of [
    [0, ux, HOUSE.x0, HOUSE.x1],
    [0, uz, HOUSE.back, HOUSE.front],
  ] as [number, number, number, number][]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let ta = (lo - o) / d;
    let tb = (hi - o) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  return t1 > t0 ? [t0, t1] : null;
}

function xz(r: number, a: number): [number, number] {
  return [r * Math.sin(a), -r * Math.cos(a)];
}

/**
 * 舞台の床の大理石の絵（手続きで描く: 地の明るさのむら・細いひびのような暗い筋・明るい筋）。参考画像は使わない
 */
export function marbleTexture(): THREE.CanvasTexture {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = '#d8dde0';
  g.fillRect(0, 0, S, S);
  // 地のむら（大きな柔らかい斑）
  for (let i = 0; i < 160; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 40 + rnd() * 160;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const v = rnd() > 0.5 ? 255 : 150;
    grd.addColorStop(0, `rgba(${v},${v},${v},0.10)`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 筋（曲がりながら枝分かれする細い線）
  const vein = (x: number, y: number, ang: number, len: number, w: number, dark: boolean, depth: number): void => {
    g.strokeStyle = dark ? `rgba(40,55,62,${0.55 - depth * 0.12})` : 'rgba(255,255,255,0.35)';
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < len; i++) {
      ang += (rnd() - 0.5) * 0.7;
      x += Math.cos(ang) * 6;
      y += Math.sin(ang) * 6;
      g.lineTo(x, y);
      if (depth < 3 && rnd() < 0.025) vein(x, y, ang + (rnd() - 0.5) * 1.6, len * 0.5, w * 0.7, dark, depth + 1);
    }
    g.stroke();
  };
  for (let i = 0; i < 26; i++) vein(rnd() * S, rnd() * S, rnd() * Math.PI * 2, 60 + rnd() * 90, 1.2 + rnd() * 1.6, true, 0);
  for (let i = 0; i < 14; i++) vein(rnd() * S, rnd() * S, rnd() * Math.PI * 2, 40 + rnd() * 60, 1.0, false, 1);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** ドームの中心のまわりの角度 φ（-Z が 0、+X が正） */
export function phiOf(x: number, z: number): number {
  return Math.atan2(x - DOME.cx, -(z - DOME.cz));
}
export function onDrum(r: number, phi: number, y: number): V3 {
  return ptAt(DOME.cx, DOME.cz, r, phi, y);
}

/** カメラの φ と、演台の中心 */
export const CAM_PHI = Math.atan2(VIEW.eye[0] - DOME.cx, -(VIEW.eye[2] - DOME.cz));
export const PULPIT_C: [number, number] = (() => {
  const ux = DOME.cx - VIEW.eye[0];
  const uz = DOME.cz - VIEW.eye[2];
  const l = Math.hypot(ux, uz);
  return [VIEW.eye[0] + (ux / l) * PULPIT.ahead, VIEW.eye[2] + (uz / l) * PULPIT.ahead];
})();
/** カメラのまわり（細い通路）か */
export function inCamZone(phi: number): boolean {
  let d = Math.abs(phi - CAM_PHI) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d < (PULPIT.zone * Math.PI) / 180;
}
/** 1 階の回廊の手すりの半径（ドームの中心から） */
export function l1R(phi: number): number {
  return inCamZone(phi) ? PULPIT.narrowR : LOGE.l1R;
}
export function inPulpit(x: number, z: number, pad = 0): boolean {
  return Math.hypot(x - PULPIT_C[0], z - PULPIT_C[1]) <= PULPIT.r + pad;
}

export function inPoly(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** ドラムの壁の出入口: 角度 φ（ラジアン）が出入口の幅の中なら、その出入口の [下端, 上端] */
export function doorAt(phi: number, pad = 0): [number, number] | null {
  const half = DOORS.w / 2 / DRUM_R + pad;
  const near = (deg: number): boolean => {
    let d = Math.abs(phi - (deg * Math.PI) / 180) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d < half;
  };
  if (DOORS.ground.some(near)) return [0, DOORS.h];
  if (DOORS.upper.some(near)) return [LOGE.l1, LOGE.l1 + DOORS.h];
  return null;
}
/** ドラムの壁の高さの帯（出入口を除く） */
export function wallBands(phi: number): [number, number][] {
  const d = doorAt(phi);
  if (!d) return [[-0.1, CATWALK_Y]];
  return [
    [-0.1, Math.max(d[0], -0.1)],
    [d[1], CATWALK_Y],
  ].filter(([a, b]) => b - a > 1e-3) as [number, number][];
}

/** 壁柱の数（ドラムを 48 等分） */
export const PIERS = 48;

/** ドラムの壁・回廊・輪の通路（全周）。出入口（扉の位置 φ）は壁を空けずに扉の板を別に置く */
export function buildDrum(b: Builder, m: HallMats): void {
  const wall = new GeoBuf();
  const slab = new GeoBuf();
  const rail = new GeoBuf();
  const ceil = new GeoBuf();
  const c: V3 = [DOME.cx, 8, DOME.cz];
  const N = 360;
  const R2 = DRUM_R - LOGE.l2Depth;
  for (let i = 0; i < N; i++) {
    const p0 = (i / N) * Math.PI * 2;
    const p1 = ((i + 1) / N) * Math.PI * 2;
    const W = (r: number, p: number, y: number): V3 => onDrum(r, p, y);
    // 壁は出入口の所を空ける（高さの帯ごと）
    for (const [y0, y1] of wallBands((p0 + p1) / 2)) facing(wall, W(DRUM_R, p0, y0), W(DRUM_R, p1, y0), W(DRUM_R, p1, y1), W(DRUM_R, p0, y1), c);
    // 1 階の回廊: 床（上・下・縁）。カメラのまわりは細い通路
    const R1 = l1R((p0 + p1) / 2);
    up(slab, W(R1, p0, LOGE.l1), W(DRUM_R, p0, LOGE.l1), W(DRUM_R, p1, LOGE.l1), W(R1, p1, LOGE.l1));
    down(slab, W(R1, p0, LOGE.l1 - 0.35), W(DRUM_R, p0, LOGE.l1 - 0.35), W(DRUM_R, p1, LOGE.l1 - 0.35), W(R1, p1, LOGE.l1 - 0.35));
    facing(slab, W(R1, p0, LOGE.l1 - 0.35), W(R1, p1, LOGE.l1 - 0.35), W(R1, p1, LOGE.l1), W(R1, p0, LOGE.l1), c);
    // 1 階の手すりの上の横木（灯りが付く）。演台の所は演台の手すりが代わる
    const inBox = inPulpit(...(onDrum(R1, (p0 + p1) / 2, 0).filter((_, k) => k !== 1) as [number, number]), 0.05);
    if (!inBox) facing(rail, W(R1 + 0.03, p0, LOGE.l1 + 0.98), W(R1 + 0.03, p1, LOGE.l1 + 0.98), W(R1 + 0.03, p1, LOGE.l1 + 1.06), W(R1 + 0.03, p0, LOGE.l1 + 1.06), c);
    if (!inBox) up(rail, W(R1 - 0.02, p0, LOGE.l1 + 1.06), W(R1 + 0.1, p0, LOGE.l1 + 1.06), W(R1 + 0.1, p1, LOGE.l1 + 1.06), W(R1 - 0.02, p1, LOGE.l1 + 1.06));
    if (!inBox) facing(rail, W(R1 + 0.03, p0, LOGE.l1 + 0.45), W(R1 + 0.03, p1, LOGE.l1 + 0.45), W(R1 + 0.03, p1, LOGE.l1 + 0.49), W(R1 + 0.03, p0, LOGE.l1 + 0.49), c);
    const pd = (((p0 + p1) / 2) * 180) / Math.PI;
    const pdn = pd > 180 ? pd - 360 : pd;
    const hasL2 = pdn >= LOGE.l2Phi[0] && pdn <= LOGE.l2Phi[1];
    const inBooth = pdn >= BOOTH.phi[0] && pdn <= BOOTH.phi[1];
    if (hasL2) {
    // 2 階の回廊
    up(slab, W(R2, p0, LOGE.l2), W(DRUM_R, p0, LOGE.l2), W(DRUM_R, p1, LOGE.l2), W(R2, p1, LOGE.l2));
    down(slab, W(R2, p0, LOGE.l2 - 0.45), W(DRUM_R, p0, LOGE.l2 - 0.45), W(DRUM_R, p1, LOGE.l2 - 0.45), W(R2, p1, LOGE.l2 - 0.45));
    facing(slab, W(R2, p0, LOGE.l2 - 0.45), W(R2, p1, LOGE.l2 - 0.45), W(R2, p1, LOGE.l2), W(R2, p0, LOGE.l2), c);
    // 2 階の手すり（手すり子の並び + 笠木 + 下の横木）
    facing(slab, W(R2, p0, LOGE.l2), W(R2, p1, LOGE.l2), W(R2, p1, LOGE.l2 + 0.12), W(R2, p0, LOGE.l2 + 0.12), c);
    up(slab, W(R2 - 0.06, p0, LOGE.l2 + 0.95), W(R2 + 0.2, p0, LOGE.l2 + 0.95), W(R2 + 0.2, p1, LOGE.l2 + 0.95), W(R2 - 0.06, p1, LOGE.l2 + 0.95));
    // 2 階の天井（柱の上の梁の下面）
    down(ceil, W(R2, p0, LOGE.l2 + 3.4), W(DRUM_R, p0, LOGE.l2 + 3.4), W(DRUM_R, p1, LOGE.l2 + 3.4), W(R2, p1, LOGE.l2 + 3.4));
    facing(slab, W(R2, p0, LOGE.l2 + 3.4), W(R2, p1, LOGE.l2 + 3.4), W(R2, p1, LOGE.l2 + 4.0), W(R2, p0, LOGE.l2 + 4.0), c);
    }
    if (inBooth) continue;
    // 輪の通路の床・輪の梁の前の面・手すりの横木
    const R0 = DOME.R;
    up(slab, W(R0, p0, CATWALK_Y), W(DRUM_R, p0, CATWALK_Y), W(DRUM_R, p1, CATWALK_Y), W(R0, p1, CATWALK_Y));
    facing(slab, W(R0, p0, CATWALK_Y - 1.2), W(R0, p1, CATWALK_Y - 1.2), W(R0, p1, CATWALK_Y), W(R0, p0, CATWALK_Y), c);
    down(slab, W(R0, p0, CATWALK_Y - 1.2), W(DRUM_R, p0, CATWALK_Y - 1.2), W(DRUM_R, p1, CATWALK_Y - 1.2), W(R0, p1, CATWALK_Y - 1.2));
    facing(rail, W(R0, p0, DOME.ringY - 0.06), W(R0, p1, DOME.ringY - 0.06), W(R0, p1, DOME.ringY), W(R0, p0, DOME.ringY), c);
    facing(rail, W(R0, p0, DOME.ringY - 0.55), W(R0, p1, DOME.ringY - 0.55), W(R0, p1, DOME.ringY - 0.51), W(R0, p0, DOME.ringY - 0.51), c);
  }
  b.mesh(wall.build(), m.wall, [0, 0, 0], { shadow: true });
  b.mesh(slab.build(), m.slab, [0, 0, 0], { shadow: 'receive' });
  b.mesh(rail.build(), m.rail, [0, 0, 0], { shadow: false });
  b.mesh(ceil.build(), m.ceiling, [0, 0, 0], { shadow: false });
  // 支柱: 1 階の手すり（1.2 m おき）・輪の手すり（1.4 m おき）
  const posts: THREE.BufferGeometry[] = [];
  const posts2: THREE.BufferGeometry[] = [];
  const post = (r: number, phi: number, y0: number, h: number, w: number): void => {
    const p = onDrum(r, phi, y0 + h / 2);
    const g = new THREE.BoxGeometry(w, h, w);
    g.rotateY(-phi);
    posts.push(g.translate(p[0], p[1], p[2]));
  };
  const n1 = Math.round((Math.PI * 2 * LOGE.l1R) / 1.2);
  for (let i = 0; i < n1; i++) {
    const ph = (i / n1) * Math.PI * 2;
    const R1 = l1R(ph);
    const q = onDrum(R1, ph, 0);
    if (inPulpit(q[0], q[2], 0.05)) continue;
    post(R1 + 0.03, ph, LOGE.l1, 1.0, 0.045);
  }
  // 細い通路と広い回廊の境（放射の向きの縁と手すり）
  for (const sg of [-1, 1]) {
    const ph = CAM_PHI + (sg * PULPIT.zone * Math.PI) / 180;
    const a = onDrum(LOGE.l1R, ph, 0);
    const c2 = onDrum(PULPIT.narrowR, ph, 0);
    const len = Math.hypot(c2[0] - a[0], c2[2] - a[2]);
    const g1 = new THREE.BoxGeometry(0.1, 0.35, len);
    g1.rotateY(-ph);
    posts.push(g1.translate((a[0] + c2[0]) / 2, LOGE.l1 - 0.175, (a[2] + c2[2]) / 2));
    const g2 = new THREE.BoxGeometry(0.08, 0.06, len);
    g2.rotateY(-ph);
    posts.push(g2.translate((a[0] + c2[0]) / 2, LOGE.l1 + 1.03, (a[2] + c2[2]) / 2));
    const g3 = new THREE.BoxGeometry(0.045, 1.0, 0.045);
    posts.push(g3.translate(c2[0], LOGE.l1 + 0.5, c2[2]));
  }
  const n0 = Math.round((Math.PI * 2 * DOME.R) / 1.0);
  const boothRad = BOOTH.phi.map((d) => (d * Math.PI) / 180);
  for (let i = 0; i < n0; i++) {
    const ph = (i / n0) * Math.PI * 2;
    if (ph >= boothRad[0] && ph <= boothRad[1]) continue;
    post(DOME.R, ph, CATWALK_Y, 1.1, 0.05);
  }
  // 2 階の手すり子（0.28 m おき。柱の回廊の範囲）
  {
    const R2b = DRUM_R - LOGE.l2Depth;
    const nb = Math.round((Math.PI * 2 * R2b) / 0.28);
    for (let i = 0; i < nb; i++) {
      const ph = (i / nb) * Math.PI * 2;
      const deg = ((ph * 180) / Math.PI + 540) % 360 - 180;
      if (deg < LOGE.l2Phi[0] || deg > LOGE.l2Phi[1]) continue;
      const p = onDrum(R2b + 0.04, ph, LOGE.l2 + 0.535);
      const g = new THREE.CylinderGeometry(0.035, 0.05, 0.83, 6);
      posts2.push(g.translate(p[0], p[1], p[2]));
    }
  }
  for (const g of posts) b.mesh(g, m.rail, [0, 0, 0], { shadow: false });
  for (const g of posts2) b.mesh(g, m.slab, [0, 0, 0], { shadow: false });
  // 壁柱（床から輪の梁まで）と、2 階の柱（手すりから梁まで。柱頭と柱礎）
  const piers: THREE.BufferGeometry[] = [];
  for (let i = 0; i < PIERS; i++) {
    const phi = ((i + 0.5) / PIERS) * Math.PI * 2;
    const add = (r: number, y0: number, y1: number, w: number, d: number): void => {
      const p = onDrum(r, phi, (y0 + y1) / 2);
      const g = new THREE.BoxGeometry(w, y1 - y0, d);
      g.rotateY(-phi);
      piers.push(g.translate(p[0], p[1], p[2]));
    };
    if (!doorAt(phi, 0.02)) {
      add(DRUM_R - 0.2, -0.1, CATWALK_Y - 1.2, 0.7, 0.4);
      // 壁柱の当たり判定（回した柱を、幅の向きに並べた 3 つの小さな軸に沿った箱で表す。柱の中や脇の隙間に入らない）
      for (const t of [-0.22, 0, 0.22]) {
        const c = onDrum(DRUM_R - 0.16, phi + t / DRUM_R, 0);
        const h = 0.13;
        b.ctx.colliders.add({ x: c[0] - h, y: -0.1, z: c[2] - h }, { x: c[0] + h, y: CATWALK_Y - 1.2, z: c[2] + h });
      }
    }
    const pdn = ((phi * 180) / Math.PI + 540) % 360 - 180;
    if (pdn < LOGE.l2Phi[0] || pdn > LOGE.l2Phi[1]) continue;
    // 2 階の柱（回廊の前の縁）
    add(R2 + 0.25, LOGE.l2 + 0.95, LOGE.l2 + 3.4, 0.36, 0.36);
    add(R2 + 0.25, LOGE.l2 + 3.15, LOGE.l2 + 3.4, 0.56, 0.5);
    add(R2 + 0.25, LOGE.l2 + 0.95, LOGE.l2 + 1.2, 0.5, 0.46);
  }
  for (const g of piers) b.mesh(g, m.pier, [0, 0, 0], { shadow: 'receive' });
}

/** カメラの立つ丸い演台（操作席のバルコニー）: 床の円盤・縁・手すり（細い通路の手すりの内側の弧） */
export function buildPulpit(b: Builder, m: HallMats): void {
  const [cx, cz] = PULPIT_C;
  const g = new THREE.CylinderGeometry(PULPIT.r, PULPIT.r, 0.35, 40);
  b.mesh(g, m.slab, [cx, LOGE.l1 - 0.175, cz], { shadow: 'receive' });
  // 手すり: 円の弧のうち細い通路の外（ドームの中心の側）
  const n = 40;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * (PULPIT.r - 0.03);
    const z = cz + Math.sin(a) * (PULPIT.r - 0.03);
    const d = Math.hypot(x - DOME.cx, z - DOME.cz);
    if (d < PULPIT.narrowR - 0.02) pts.push(new THREE.Vector3(x, 0, z));
  }
  // 弧を順につなぐ（円の始点をまたぐ並びを直す）
  const arc: THREE.Vector3[] = [];
  let start = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].distanceTo(pts[i - 1]) > 0.3) start = i;
  for (let i = 0; i < pts.length; i++) arc.push(pts[(start + i) % pts.length]);
  if (arc.length > 1) {
    const top = new THREE.CatmullRomCurve3(arc.map((p) => p.clone().setY(LOGE.l1 + 1.0)));
    b.mesh(new THREE.TubeGeometry(top, 24, 0.035, 6, false), m.rail, [0, 0, 0], { shadow: false });
    const mid = new THREE.CatmullRomCurve3(arc.map((p) => p.clone().setY(LOGE.l1 + 0.5)));
    b.mesh(new THREE.TubeGeometry(mid, 24, 0.018, 5, false), m.rail, [0, 0, 0], { shadow: false });
    for (let i = 0; i < arc.length; i += 3) b.box(m.rail, [arc[i].x, LOGE.l1 + 0.5, arc[i].z], [0.035, 1.0, 0.035], { shadow: false });
  }
}

/** 投影室の塔（ドラムの壁から張り出す箱。内側の面は円弧、両脇は放射の面、下面） */
export function buildBooth(b: Builder, m: HallMats): void {
  const g = new GeoBuf();
  const c: V3 = [DOME.cx, 12, DOME.cz];
  const p0 = (BOOTH.phi[0] * Math.PI) / 180;
  const p1 = (BOOTH.phi[1] * Math.PI) / 180;
  const Ri = DRUM_R - BOOTH.depth;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = p0 + ((p1 - p0) * i) / n;
    const bb = p0 + ((p1 - p0) * (i + 1)) / n;
    facing(g, onDrum(Ri, a, BOOTH.y0), onDrum(Ri, bb, BOOTH.y0), onDrum(Ri, bb, BOOTH.y1), onDrum(Ri, a, BOOTH.y1), c);
    down(g, onDrum(Ri, a, BOOTH.y0), onDrum(DRUM_R, a, BOOTH.y0), onDrum(DRUM_R, bb, BOOTH.y0), onDrum(Ri, bb, BOOTH.y0));
    up(g, onDrum(Ri, a, BOOTH.y1), onDrum(DRUM_R + 0.5, a, BOOTH.y1), onDrum(DRUM_R + 0.5, bb, BOOTH.y1), onDrum(Ri, bb, BOOTH.y1));
  }
  for (const [p, side] of [[p0, -1], [p1, 1]] as const) {
    facing(g, onDrum(Ri, p, BOOTH.y0), onDrum(DRUM_R + 0.5, p, BOOTH.y0), onDrum(DRUM_R + 0.5, p, BOOTH.y1), onDrum(Ri, p, BOOTH.y1), onDrum(Ri, p + side * -0.3, 12));
  }
  // 塔の外の壁（ドラムの上へ出た所の外側。ドームの殻の外は見えないが、輪の通路から見上げた所）
  for (let i = 0; i < n; i++) {
    const a = p0 + ((p1 - p0) * i) / n;
    const bb = p0 + ((p1 - p0) * (i + 1)) / n;
    facing(g, onDrum(DRUM_R + 0.5, a, CATWALK_Y), onDrum(DRUM_R + 0.5, bb, CATWALK_Y), onDrum(DRUM_R + 0.5, bb, BOOTH.y1), onDrum(DRUM_R + 0.5, a, BOOTH.y1), c);
  }
  b.mesh(g.build(), m.wall, [0, 0, 0], { shadow: 'receive' });
}

/**
 * 升目の当たり判定: 0.5 m の升目ごとに箱の [下端, 上端]（無ければ null）を求め、x の向きに同じ箱が続く所をまとめる。
 * 床（上面が歩ける高さ）・壁（背より高い箱）・手すりを同じ道具で作る（曲がった壁・回廊を軸に沿った小さな箱で表す）
 */
export function gridColliders(ctx: SceneContext, box: (x: number, z: number) => [number, number] | null, x0: number, z0: number, x1: number, z1: number, cell = 0.5): number {
  let count = 0;
  for (let z = z0; z < z1; z += cell) {
    let runStart = x0;
    let run: [number, number] | null = null;
    const flush = (xe: number): void => {
      if (run) {
        ctx.colliders.add({ x: runStart, y: run[0], z }, { x: xe, y: run[1], z: z + cell });
        count++;
      }
    };
    for (let x = x0; x < x1 + 1e-6; x += cell) {
      const h = x < x1 ? box(x + cell / 2, z + cell / 2) : null;
      const same = h && run && Math.abs(h[0] - run[0]) < 1e-4 && Math.abs(h[1] - run[1]) < 1e-4;
      if (!same) {
        flush(x);
        runStart = x;
        run = h;
      }
    }
  }
  return count;
}
