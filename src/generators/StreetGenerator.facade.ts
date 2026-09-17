/** StreetGenerator の補助: 面（Face）に貼るファサード（窓帯・偽扉・外装板・看板）、街灯、停車中の車、路面標示。
 *  すべて RoomLayout の純データ（Box / LightSpec / SignSpec）を返すだけで、乱数は呼び出し側から渡された Rng のみ使う。
 *  - 窓は非ソリッドの薄板（厚 0.04、高さ 1.0 以上 = SurfaceLighting の emitter 条件「高さ < 0.3」に当たらない）。
 *    LightingPhase(allWindowsLit) が 'windowDark' の箱を 'windowLit' に差し替える契約なので、窓は L.instances ではなく L.boxes に出す。
 *  - 建物本体はソリッド箱（中には入れない）。外装板・窓・看板・街灯ポールは非ソリッド。 */
import type { Dir, Socket, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { along } from './footprint';
import { box, WALL_T, type Box, type LightSpec, type MatId, type RoomLayout, type SignSpec } from './layout';

/** 鉛直な面。alongX なら面は x 方向に伸び法線は z。normal は面が向く側（法線軸の符号） */
export interface Face {
  alongX: boolean;
  coord: number;
  normal: 1 | -1;
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

/** 面に貼る薄板（面から inset 離し、面の向く側へ thick 出す） */
export function faceBox(f: Face, t0: number, t1: number, y0: number, y1: number, mat: MatId, thick = 0.04, inset = 0.005, solid = false): Box {
  const lo = f.normal > 0 ? f.coord + inset : f.coord - inset - thick;
  const hi = lo + thick;
  return f.alongX ? box([t0, y0, lo], [t1, y1, hi], mat, solid) : box([lo, y0, t0], [hi, y1, t1], mat, solid);
}

/** 面が向く方向（サインの dir） */
export function faceDir(f: Face): Dir {
  return f.alongX ? (f.normal > 0 ? 0 : 2) : f.normal > 0 ? 1 : 3;
}

/** 面上の点（t は面に沿った座標、off は面から離す距離） */
export function facePoint(f: Face, t: number, y: number, off: number): Vec3 {
  const c = f.coord + f.normal * off;
  return f.alongX ? [t, y, c] : [c, y, t];
}

/** ソリッド箱の 4 側面（外向き） */
export function facesOfBox(b: Box): Face[] {
  return [
    { alongX: true, coord: b.max[2], normal: 1, a0: b.min[0], a1: b.max[0], y0: b.min[1], y1: b.max[1] },
    { alongX: true, coord: b.min[2], normal: -1, a0: b.min[0], a1: b.max[0], y0: b.min[1], y1: b.max[1] },
    { alongX: false, coord: b.max[0], normal: 1, a0: b.min[2], a1: b.max[2], y0: b.min[1], y1: b.max[1] },
    { alongX: false, coord: b.min[0], normal: -1, a0: b.min[2], a1: b.max[2], y0: b.min[1], y1: b.max[1] },
  ];
}

/** 部屋の外壁（buildShell が edge の内側 WALL_T に立てる壁）の内面。dir は辺の外向き方向 */
export function innerFaceOfEdge(dir: Dir, coord: number, a0: number, a1: number, h: number): Face {
  switch (dir) {
    case 0: return { alongX: true, coord: coord - WALL_T, normal: -1, a0, a1, y0: 0, y1: h };
    case 2: return { alongX: true, coord: coord + WALL_T, normal: 1, a0, a1, y0: 0, y1: h };
    case 1: return { alongX: false, coord: coord - WALL_T, normal: -1, a0, a1, y0: 0, y1: h };
    default: return { alongX: false, coord: coord + WALL_T, normal: 1, a0, a1, y0: 0, y1: h };
  }
}

/** 辺 dir / coord 上の開口（ソケット）を [t0, t1, y0, y1] の矩形で列挙する（外装板・窓の回避用） */
export function openingsOnEdge(sockets: Socket[], dir: Dir, coord: number, pad = 0.35): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const s of sockets) {
    if (s.type === 'hole' || s.dir !== dir) continue;
    const c = dir === 0 || dir === 2 ? s.pos[2] : s.pos[0];
    if (Math.abs(c - coord) > 0.05) continue;
    const t = along(dir, s.pos[0], s.pos[2]);
    const y0 = s.pos[1] + (s.sill ?? 0);
    out.push([t - s.width / 2 - pad, t + s.width / 2 + pad, y0 - 0.1, y0 + s.height + pad]);
  }
  return out;
}

export type Blocked = (t0: number, t1: number, y0: number, y1: number) => boolean;

export function blockedBy(openings: [number, number, number, number][]): Blocked {
  return (t0, t1, y0, y1) => openings.some((o) => t0 < o[1] && t1 > o[0] && y0 < o[3] && y1 > o[2]);
}

export interface FacadeStyle {
  /** 階高 */
  floorH: number;
  /** 1 階の窓の下端 */
  sill: number;
  winW: number;
  winH: number;
  /** 窓の横ピッチ */
  pitch: number;
  /** 点灯している窓の割合 */
  litChance: number;
  /** 1 階中央に偽扉を置く */
  fakeDoor: boolean;
  doorMat: MatId;
  /** 窓を置く上限（ロープライン） */
  maxY: number;
  /** 窓枠（桟）を付ける */
  frames?: boolean;
  /** 面からの離し（外装板の上に貼るときは板厚より大きく） */
  inset?: number;
}

export const DEFAULT_STYLE: FacadeStyle = { floorH: 3.0, sill: 1.0, winW: 1.0, winH: 1.3, pitch: 2.4, litChance: 0.45, fakeDoor: true, doorMat: 'doorWood', maxY: 100 };

/** 面に窓帯（階ごと）と偽扉を貼る。blocked に掛かる位置は避ける。置いた窓の数を返す */
export function facade(out: Box[], f: Face, st: FacadeStyle, rng: Rng, blocked?: Blocked): number {
  const len = f.a1 - f.a0;
  if (len < 1.6) return 0;
  const top = Math.min(f.y1 - 0.4, f.y0 + st.maxY);
  const ins = st.inset ?? 0.005;
  let count = 0;
  // 偽扉（1 階中央。開かない = 施錠扉と同じ見せ方）
  let doorT0 = Infinity;
  let doorT1 = -Infinity;
  if (st.fakeDoor && len >= 3.2) {
    const c = f.a0 + len / 2 + rng.float(-Math.min(1.2, len / 4), Math.min(1.2, len / 4));
    doorT0 = c - 0.5;
    doorT1 = c + 0.5;
    if (!blocked || !blocked(doorT0 - 0.3, doorT1 + 0.3, f.y0, f.y0 + 2.4)) {
      out.push(faceBox(f, doorT0, doorT1, f.y0, f.y0 + 2.1, st.doorMat, 0.05, ins));
      out.push(faceBox(f, doorT0 - 0.12, doorT1 + 0.12, f.y0 + 2.1, f.y0 + 2.25, 'trim', 0.08, ins));
      // 玄関灯
      if (rng.chance(0.5)) out.push(faceBox(f, doorT1 + 0.25, doorT1 + 0.45, f.y0 + 2.0, f.y0 + 2.15, 'lightWarm', 0.1, ins + 0.015));
    } else {
      doorT0 = Infinity;
      doorT1 = -Infinity;
    }
  }
  const n = Math.max(1, Math.floor((len - 0.8) / st.pitch));
  const start = f.a0 + (len - (n - 1) * st.pitch) / 2;
  for (let y = f.y0 + st.sill, floor = 0; y + st.winH < top; y += st.floorH, floor++) {
    for (let k = 0; k < n; k++) {
      const t = start + k * st.pitch;
      const t0 = t - st.winW / 2;
      const t1 = t + st.winW / 2;
      if (floor === 0 && t1 > doorT0 - 0.3 && t0 < doorT1 + 0.3) continue;
      if (blocked && blocked(t0, t1, y, y + st.winH)) continue;
      const mat: MatId = rng.chance(st.litChance) ? 'windowLit' : 'windowDark';
      out.push(faceBox(f, t0, t1, y, y + st.winH, mat, 0.04, ins));
      if (st.frames) {
        out.push(faceBox(f, t - 0.02, t + 0.02, y, y + st.winH, 'furnitureDark', 0.02, ins + 0.045));
        out.push(faceBox(f, t0, t1, y + st.winH / 2 - 0.02, y + st.winH / 2 + 0.02, 'furnitureDark', 0.02, ins + 0.045));
      }
      count++;
    }
  }
  return count;
}

/** 外装板（面全体に貼る薄板）。開口（openings）は避けて左右・上の 3 片に分ける。ロープライン y1 で切る */
export function cladding(out: Box[], f: Face, t0: number, t1: number, y1: number, mat: MatId, openings: [number, number, number, number][], thick = 0.06): void {
  const cuts = openings.filter((o) => o[0] < t1 && o[1] > t0).sort((a, b) => a[0] - b[0]);
  let cur = t0;
  for (const o of cuts) {
    const a = Math.max(t0, o[0]);
    const b = Math.min(t1, o[1]);
    if (a > cur + 0.05) out.push(faceBox(f, cur, a, f.y0, y1, mat, thick));
    // 開口の上
    if (o[3] < y1 - 0.05) out.push(faceBox(f, a, b, o[3], y1, mat, thick));
    cur = Math.max(cur, b);
  }
  if (t1 > cur + 0.05) out.push(faceBox(f, cur, t1, f.y0, y1, mat, thick));
}

/** 発光サイン（店名・パビリオン名） */
export function signOn(L: RoomLayout, f: Face, t: number, y: number, text: string, width: number, kind: SignSpec['kind'] = 'emissive', color?: number, background?: number, id?: string): void {
  if ((L.signs?.length ?? 0) >= 44) return;
  L.signs ??= [];
  const spec: SignSpec = { text, pos: facePoint(f, t, y, 0.09), dir: faceDir(f), width, kind };
  if (color !== undefined) spec.color = color;
  if (background !== undefined) spec.background = background;
  if (id) spec.id = id;
  L.signs.push(spec);
}

/** 街灯。ポール（非ソリッド）+ アーム + 灯具箱（発光）。withLight なら LightSpec も置く */
export function streetLamp(L: RoomLayout, x: number, z: number, h: number, headMat: MatId, color: number, intensity: number, withLight: boolean, arm: Dir = 0): void {
  const B = L.boxes;
  B.push(box([x - 0.07, 0, z - 0.07], [x + 0.07, h, z + 0.07], 'metal', false));
  const ax = arm === 1 ? 0.6 : arm === 3 ? -0.6 : 0;
  const az = arm === 0 ? 0.6 : arm === 2 ? -0.6 : 0;
  B.push(box([Math.min(x, x + ax) - 0.04, h - 0.08, Math.min(z, z + az) - 0.04], [Math.max(x, x + ax) + 0.04, h, Math.max(z, z + az) + 0.04], 'metal', false));
  const hx = x + ax;
  const hz = z + az;
  B.push(box([hx - 0.28, h - 0.3, hz - 0.18], [hx + 0.28, h - 0.06, hz + 0.18], headMat, false));
  if (withLight) L.lights.push({ pos: [hx, h - 0.6, hz], color, intensity, distance: 18 } satisfies LightSpec);
}

/** 停車中の車（ParkingGenerator の車箱と同じ造形）。alongZ なら車軸が z 方向 */
export function car(out: Box[], cx: number, cz: number, alongZ: boolean, rng: Rng): void {
  const paint: MatId = rng.pick(['carPaint', 'doorMetal', 'carPaint', 'wallDark']);
  const hl = 2.2;
  const hw = 0.9;
  const P = (ax: number, ay: number, az: number): Vec3 => (alongZ ? [cx + ax, ay, cz + az] : [cx + az, ay, cz + ax]);
  let body = true;
  const push = (a: Vec3, b: Vec3, mat: MatId, solid = true) => {
    out.push({ ...box(P(a[0], a[1], a[2]), P(b[0], b[1], b[2]), mat, solid), vehicle: { id: `street:${cx}:${cz}`, body } });
    body = false;
  };
  push([-hw, 0, -hl], [hw, 0.7, hl], paint);
  push([-hw + 0.1, 0.7, -1.0], [hw - 0.1, 1.35, 1.2], 'carGlass');
  push([-0.65, 1.29, -0.78], [0.65, 1.37, 0.98], paint, false);
  for (const wx of [-0.96, 0.78]) for (const wz of [-1.45, 1.35]) push([wx, 0.08, wz - 0.32], [wx + 0.18, 0.64, wz + 0.32], 'rubber', false);
}

/** 路面の白線（非ソリッドの薄板）。alongZ なら z 方向に伸びる線 */
export function roadLine(out: Box[], a: number, b: number, at: number, alongZ: boolean, width = 0.12, mat: MatId = 'wallWhite', dash = 0): void {
  const y0 = 0.002;
  const y1 = 0.012;
  const seg = (s0: number, s1: number) => {
    if (alongZ) out.push(box([at - width / 2, y0, s0], [at + width / 2, y1, s1], mat, false));
    else out.push(box([s0, y0, at - width / 2], [s1, y1, at + width / 2], mat, false));
  };
  if (dash <= 0) {
    seg(Math.min(a, b), Math.max(a, b));
    return;
  }
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let s = lo; s < hi; s += dash * 2) seg(s, Math.min(hi, s + dash));
}

/** 横断歩道（縞）。alongZ なら縞が z 方向に伸び、x 方向に並ぶ。center は横断方向の中心、span は横断する幅 */
export function crosswalk(out: Box[], center: number, span: number, at0: number, at1: number, alongZ: boolean, max = 6): void {
  const stripe = 0.45;
  const gap = 0.45;
  const n = Math.min(max, Math.floor((span - 0.6) / (stripe + gap)));
  if (n <= 0) return;
  const total = n * stripe + (n - 1) * gap;
  const start = center - total / 2;
  for (let i = 0; i < n; i++) {
    const s0 = start + i * (stripe + gap);
    if (alongZ) out.push(box([s0, 0.002, at0], [s0 + stripe, 0.012, at1], 'wallWhite', false));
    else out.push(box([at0, 0.002, s0], [at1, 0.012, s0 + stripe], 'wallWhite', false));
  }
}

/** 段の列（外階段・斜路）。from → to へ z（または x）方向に上る。各段は床から段の上面まで詰めたソリッド箱（下に空洞を作らない） */
export function stepRun(out: Box[], o: { x0: number; x1: number; z0: number; z1: number; alongZ: boolean; rise: number; stepH: number; mat: MatId; yBase?: number; reverse?: boolean }): number {
  const yBase = o.yBase ?? 0;
  const n = Math.max(1, Math.round(o.rise / o.stepH));
  const len = o.alongZ ? o.z1 - o.z0 : o.x1 - o.x0;
  const stepD = len / n;
  for (let i = 0; i < n; i++) {
    const k = o.reverse ? n - 1 - i : i;
    const top = yBase + (k + 1) * (o.rise / n);
    if (o.alongZ) out.push(box([o.x0, yBase - 0.2, o.z0 + i * stepD], [o.x1, top, o.z0 + (i + 1) * stepD], o.mat));
    else out.push(box([o.x0 + i * stepD, yBase - 0.2, o.z0], [o.x0 + (i + 1) * stepD, top, o.z1], o.mat));
  }
  return n;
}

/** 手すり（非ソリッドの細い横棒 + 支柱） */
export function railing(out: Box[], a: Vec3, b: Vec3, h = 1.0, mat: MatId = 'metal'): void {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const z0 = Math.min(a[2], b[2]);
  const z1 = Math.max(a[2], b[2]);
  const y = Math.min(a[1], b[1]);
  out.push(box([x0 - 0.03, y + h - 0.05, z0 - 0.03], [x1 + 0.03, y + h, z1 + 0.03], mat, false));
  const len = Math.max(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x0 + (x1 - x0) * t;
    const pz = z0 + (z1 - z0) * t;
    out.push(box([px - 0.03, y, pz - 0.03], [px + 0.03, y + h - 0.05, pz + 0.03], mat, false));
  }
}
