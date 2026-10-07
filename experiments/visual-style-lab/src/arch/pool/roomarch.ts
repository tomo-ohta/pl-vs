import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { CAVE, HALL, HALL_DOORS, ROOMS, TERRACE, type RoomDef } from './layout.ts';
import { holeHeight } from './walls.ts';

/**
 * 部屋の骨組み（写っていない所をホールと同じ言葉で作る決まり）。どの部屋も同じ規則で:
 * - 梁: 部屋の長い向きに 3.6 m 前後おきに、短い向きへ架ける段付きの梁（下に一段細い段）。両端は壁の柱型と段々の柱頭で受ける
 * - 柱型: 梁の両端の壁に、床からの角柱（タイル張り・暗い台座）。扉・窓の所は少しずらし、ずらしても当たるなら上だけの持ち送り
 * - 天井: 梁の間の格間。1 つおきに天窓の井戸（タイル張りの浅い井戸・ガラスと細い桟・上に明るい空）。日の光が井戸から差し込み、
 *   床と壁に日なたを落とす（参考画像の天窓の帯と同じ）。天窓の無い格間には吊り下げの灯りと、その光だまり（ctx.addLamp。部屋の箱の中だけ）
 * - 壁の上の段々の蛇腹（2 段）と、扉・窓の厚い額縁
 * 家具の置き場（furnish.ts の along）は柱型を避ける（pierSpans）。
 */

export type Side = 'n' | 's' | 'w' | 'e';

export interface Opening {
  a: number;
  b: number;
  bottom: number;
  top: number;
  window: boolean;
}

/** 部屋の辺の壁の線 */
export function sideLine(r: RoomDef, side: Side): number {
  return side === 'n' ? r.rect[1] : side === 's' ? r.rect[3] : side === 'w' ? r.rect[0] : r.rect[2];
}

/** 辺の上の開口（場面の座標の範囲）。隣の部屋の扉（同じ壁の線）・ホールどうしの開口も */
export function sideOpenings(r: RoomDef, side: Side): Opening[] {
  const along = side === 'n' || side === 's';
  const line = sideLine(r, side);
  const [lo, hi] = along ? [r.rect[0], r.rect[2]] : [r.rect[1], r.rect[3]];
  const out: Opening[] = [];
  // 間取りの部屋のほか、ホールの中の小さな空間（前室・回廊。ROOMS に無い）は自分の扉も見る
  for (const o of ROOMS.includes(r) ? ROOMS : [...ROOMS, r]) {
    for (const d of o.doors) {
      if ((d.side === 'n' || d.side === 's') !== along) continue;
      const dl = sideLine(o, d.side);
      if (Math.abs(dl - line) > 1.05 || Math.abs(o.floor - r.floor) > 1) continue;
      if (d.b < lo || d.a > hi) continue;
      const hh = holeHeight(d, o.floor);
      out.push({ a: d.a, b: d.b, bottom: hh.bottom, top: hh.top + (d.kind === 'auto' ? 0.25 : 0), window: d.kind === 'window' });
    }
  }
  for (const h of HALL_DOORS) {
    if ((h.wall === 'x') !== along) continue;
    if (Math.abs((along ? h.at[1] : h.at[0]) - line) > 1.05) continue;
    const m = along ? h.at[0] : h.at[1];
    if (m + h.width / 2 < lo || m - h.width / 2 > hi) continue;
    out.push({ a: m - h.width / 2, b: m + h.width / 2, bottom: h.bottom, top: h.top + 0.25, window: h.kind === 'window' });
  }
  return out;
}

export interface Pier {
  side: Side;
  /** 壁に沿った中心（場面の座標） */
  t: number;
  /** 床からの柱型か（false = 梁の下の持ち送りだけ） */
  full: boolean;
  /** 梁を受ける柱型か、梁の無い壁（端の壁）の柱型（蛇腹まで） */
  wall?: boolean;
}

export interface RoomFrame {
  /** 梁を並べる向き（梁はこれと直交する向きに架ける） */
  axis: 'x' | 'z';
  /** 梁の中心 */
  beams: number[];
  /** 大梁（梁と直交。梁の架かる向きの座標） */
  girders: number[];
  piers: Pier[];
  /** 角の柱型（開口の近くは無し）: 部屋の角の (x, z) と、内側への向き */
  corners: { x: number; z: number; sx: number; sz: number }[];
  /** 梁の幅・柱型の幅と出 */
  bw: number;
  pw: number;
  pd: number;
  /** 梁の下端（下の段の下端は bottom - step） */
  bottom: number;
  step: number;
}

const cache = new Map<string, RoomFrame | null>();

/** 部屋の梁と柱型の位置（決まった規則。家具の置き場と形の両方から使う） */
export function roomFrame(r: RoomDef): RoomFrame | null {
  if (cache.has(r.id)) return cache.get(r.id)!;
  const [x0, z0, x1, z1] = r.rect;
  const W = x1 - x0;
  const D = z1 - z0;
  const H = r.ceil - r.floor;
  const axis: 'x' | 'z' = W >= D ? 'x' : 'z';
  const len = axis === 'x' ? W : D;
  const lo = axis === 'x' ? x0 : z0;
  const n = Math.max(2, Math.round(len / 3.6));
  const bw = 0.6;
  const pw = 0.5;
  const pd = 0.25;
  const depth = Math.min(0.36, H * 0.11);
  const bottom = r.ceil - depth;
  const step = 0.1;
  const walls: [Side, Side] = axis === 'x' ? ['n', 's'] : ['w', 'e'];
  const ops = walls.map((s) => sideOpenings(r, s));
  // 柱型の下端の高さまでに開口があるか（t の前後 half）
  const hits = (wi: number, t: number, half: number, below: number): boolean => ops[wi].some((o) => t + half > o.a - 0.15 && t - half < o.b + 0.15 && o.bottom < below);
  const beams: number[] = [];
  const piers: Pier[] = [];
  for (let i = 1; i < n; i++) {
    const t0 = lo + (i * len) / n;
    let best: number | null = null;
    // 両方の壁で床からの柱型が置ける位置を、少しずつずらして探す（窓と窓の間の壁・扉の脇）
    const maxShift = Math.min(1.7, len / n / 2 - 0.3);
    const prev = beams.length ? beams[beams.length - 1] : -Infinity;
    for (let k = 0; k <= Math.ceil(maxShift / 0.2) * 2; k++) {
      const dt = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.2;
      const t = t0 + dt;
      if (Math.abs(dt) > maxShift + 1e-6 || t - prev < 2.6 || t < lo + 1.0 || t > lo + len - 1.0) continue;
      if (!hits(0, t, pw / 2 + 0.1, bottom) && !hits(1, t, pw / 2 + 0.1, bottom)) {
        best = t;
        break;
      }
    }
    if (best !== null) {
      beams.push(best);
      for (const s of walls) piers.push({ side: s, t: best, full: true });
      continue;
    }
    // 置けなければ元の位置で: 開口の無い壁は柱型、開口の上が持ち送りの分だけ空いていれば持ち送り、
    // 開口の上にまぐさの壁が残っていれば梁をそのまま壁に架ける。どれでもなければ梁を省く
    const cb = bottom - step - 0.56;
    const kind = (wi: number): 'full' | 'corbel' | 'none' | 'no' => {
      const os = ops[wi].filter((o) => t0 + pw / 2 + 0.2 > o.a && t0 - pw / 2 - 0.2 < o.b);
      if (!os.length) return 'full';
      const top = Math.max(...os.map((o) => o.top));
      return top < cb ? 'corbel' : top < bottom - step - 0.05 ? 'none' : 'no';
    };
    const ks = [kind(0), kind(1)];
    if (t0 - prev >= 2.6 && !ks.includes('no')) {
      beams.push(t0);
      walls.forEach((s, wi) => {
        if (ks[wi] !== 'none') piers.push({ side: s, t: t0, full: ks[wi] === 'full' });
      });
    }
  }
  // 広い部屋（梁の架かる向きが 9 m 超）は、梁と直交する大梁で格間を分ける。大梁は端の壁の柱型で受ける
  const span = axis === 'x' ? D : W;
  const vlo = axis === 'x' ? z0 : x0;
  const girders: number[] = [];
  const ends: [Side, Side] = axis === 'x' ? ['w', 'e'] : ['n', 's'];
  const eops = ends.map((sd) => sideOpenings(r, sd));
  if (span > 9) {
    const m = Math.ceil(span / 7.5);
    for (let j = 1; j < m; j++) {
      const v0 = vlo + (j * span) / m;
      for (const dv of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
        const v = v0 + dv;
        const ks = eops.map((os) => {
          const hit = os.filter((o) => v + pw / 2 + 0.2 > o.a && v - pw / 2 - 0.2 < o.b);
          return !hit.length ? 'full' : Math.max(...hit.map((o) => o.top)) < bottom - step - 0.05 ? 'none' : 'no';
        });
        if (ks.includes('no')) continue;
        girders.push(v);
        ends.forEach((sd, wi) => {
          if (ks[wi] === 'full') piers.push({ side: sd, t: v, full: true });
        });
        break;
      }
    }
  }
  // 端の壁（梁と平行な 2 面）にも 3.6 m 前後おきに柱型（蛇腹まで。大梁の柱型の近くは省く）
  const elen = span;
  const elo = vlo;
  const ne = Math.round(elen / 3.6);
  for (const sd of ends) {
    const eo = sideOpenings(r, sd);
    for (let i = 1; i < ne; i++) {
      const t0 = elo + (i * elen) / ne;
      for (const dt of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) {
        const t = t0 + dt;
        if (girders.some((g) => Math.abs(g - t) < 1.6)) break;
        if (eo.some((o) => t + pw / 2 + 0.25 > o.a && t - pw / 2 - 0.25 < o.b)) continue;
        piers.push({ side: sd, t, full: true, wall: true });
        break;
      }
    }
  }
  // 角の柱型
  const CW = 0.35;
  const corners: RoomFrame['corners'] = [];
  for (const [cx, cz, sx, sz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]] as [number, number, number, number][]) {
    const near = (sd: Side, t: number): boolean => sideOpenings(r, sd).some((o) => t + CW + 0.3 > o.a && t - CW - 0.3 < o.b);
    if (near(sz > 0 ? 'n' : 's', cx) || near(sx > 0 ? 'w' : 'e', cz)) continue;
    corners.push({ x: cx, z: cz, sx, sz });
  }
  const f: RoomFrame = { axis, beams, girders, piers, corners, bw, pw, pd, bottom, step };
  cache.set(r.id, f);
  return f;
}

/** 辺の上の柱型の範囲（場面の座標。家具を避ける） */
export function pierSpans(r: RoomDef, side: Side): [number, number][] {
  const f = roomFrame(r);
  if (!f) return [];
  const out: [number, number][] = f.piers.filter((p) => p.side === side && p.full).map((p) => [p.t - f.pw / 2 - 0.12, p.t + f.pw / 2 + 0.12]);
  const ns = side === 'n' || side === 's';
  for (const c of f.corners) {
    if (ns ? (side === 'n') !== c.sz > 0 : (side === 'w') !== c.sx > 0) continue;
    const t = ns ? c.x : c.z;
    const sg = ns ? c.sx : c.sz;
    out.push(sg > 0 ? [t, t + 0.42] : [t - 0.42, t]);
  }
  return out;
}

/** 建物の外か（ホールとその壁・部屋・テラス・洞窟のどれにも入らない点） */
function outside(x: number, z: number, upper: boolean): boolean {
  for (const h of Object.values(HALL)) if (x > h.rect[0] - 1.05 && x < h.rect[2] + 1.05 && z > h.rect[1] - 1.05 && z < h.rect[3] + 1.05) return false;
  for (const o of ROOMS) if (x > o.rect[0] - 0.3 && x < o.rect[2] + 0.3 && z > o.rect[1] - 0.3 && z < o.rect[3] + 0.3 && (o.floor > 2) === upper) return false;
  if (x > TERRACE[0] - 0.3 && x < TERRACE[2] + 0.3 && z > TERRACE[1] - 0.3 && z < TERRACE[3] + 0.3) return false;
  if (!upper && x > CAVE.crossX[0] - 0.6 && x < CAVE.tunnelX[1] + 0.6 && z > CAVE.tunnelZ[0] - 0.6 && z < CAVE.tunnelZ[1]) return false;
  return true;
}

export interface Clerestory {
  side: Side;
  a: number;
  b: number;
  bottom: number;
  top: number;
}

const clCache = new Map<string, Clerestory[]>();

/**
 * 外に面した壁の高窓（柱型と開口の間に）と、外に面した通路の突き当たりの縦長の窓（明るい突き当たり）。
 * 部屋の間仕切りの壁に穴を開ける（rooms.ts の buildPartitions）
 */
export function clerestories(r: RoomDef): Clerestory[] {
  const hit = clCache.get(r.id);
  if (hit) return hit;
  const out: Clerestory[] = [];
  const f = roomFrame(r);
  const [x0, z0, x1, z1] = r.rect;
  const H = r.ceil - r.floor;
  if (f && r.kind !== 'sauna' && r.kind !== 'toilet' && r.kind !== 'changing' && r.kind !== 'shower') {
    for (const side of ['n', 's', 'w', 'e'] as Side[]) {
      const ns = side === 'n' || side === 's';
      const line = sideLine(r, side);
      const sg = side === 'n' || side === 'w' ? -1 : 1;
      const [lo, hi] = ns ? [x0, x1] : [z0, z1];
      // 窓のある面には足さない
      if (sideOpenings(r, side).some((o) => o.window)) continue;
      // 壁の外 1.35 m（間仕切りなら隣の部屋の中、ホールの壁なら壁の外）
      const ext = (t: number): boolean => (ns ? outside(t, line + sg * 1.35, r.floor > 2) : outside(line + sg * 1.35, t, r.floor > 2));
      // 障害（開口・柱型・角の柱型）
      const block: [number, number][] = sideOpenings(r, side).map((o) => [o.a - 0.35, o.b + 0.35]);
      for (const p of f.piers) if (p.side === side) block.push([p.t - f.pw / 2 - 0.35, p.t + f.pw / 2 + 0.35]);
      block.push([lo - 1, lo + 0.75], [hi - 0.75, hi + 1]);
      block.sort((p, q) => p[0] - q[0]);
      // 障害の間のすき間
      let t = lo;
      const gaps: [number, number][] = [];
      for (const [a, c] of block) {
        if (a > t) gaps.push([t, a]);
        t = Math.max(t, c);
      }
      const corridorEnd = r.kind === 'corridor' && !ns === (f.axis === 'x');
      for (const [a, c] of gaps) {
        if (c - a < 0.9) continue;
        if (!ext(a + 0.1) || !ext(c - 0.1) || !ext((a + c) / 2)) continue;
        if (corridorEnd) {
          const m = (a + c) / 2;
          const w = Math.min(1.8, c - a);
          out.push({ side, a: m - w / 2, b: m + w / 2, bottom: r.floor + 0.35, top: r.ceil - 0.45 });
          continue;
        }
        const n = Math.max(1, Math.round((c - a) / 2.6));
        const w = (c - a) / n;
        // 高窓: 家具（ロッカー 1.8 m）より上、天井の際まで（蛇腹はここで切る）
        for (let k = 0; k < n; k++) out.push({ side, a: a + k * w + (k ? 0.15 : 0), b: a + (k + 1) * w - (k < n - 1 ? 0.15 : 0), bottom: r.floor + Math.max(1.95, H - 1.6), top: r.ceil - 0.12 });
      }
    }
  }
  clCache.set(r.id, out);
  return out;
}

export interface ArchMats {
  ceil: THREE.Material;
  beam: THREE.Material;
  pier: THREE.Material;
  plinth: THREE.Material;
  well: THREE.Material;
  frame: THREE.Material;
  glass: THREE.Material;
  bar: THREE.Material;
  sky: THREE.Material;
  /** 窓の外の明るい面（照明なし） */
  glow: THREE.Material;
  body: THREE.Material;
  lens: THREE.Material;
  /** 深い青緑（開口の見込み・換気口の奥・物の下の影） */
  reveal: THREE.Material;
}

export interface ArchOpts {
  /** 天窓を開ける（採暖室などは無し） */
  skylights?: boolean;
  /** 灯りの強さ・色 */
  lamp?: number;
  lampColor?: THREE.ColorRepresentation;
}

/** 部屋の天井（格間・天窓の井戸）・梁・柱型・蛇腹・額縁・灯り */
export function buildRoomArch(b: Builder, m: ArchMats, r: RoomDef, o: ArchOpts = {}): void {
  const f = roomFrame(r);
  if (!f) return;
  const [x0, z0, x1, z1] = r.rect;
  const y0 = r.floor;
  const yc = r.ceil;
  const P = 0.25;
  const PART = 0.25;
  const along = f.axis === 'x';
  // 局所 (u = 梁を並べる向き, v = 梁の架かる向き) → 場面
  const U = along ? [x0, x1] : [z0, z1];
  const V = along ? [z0, z1] : [x0, x1];
  const boxUV = (mat: THREE.Material, u0: number, u1: number, ya: number, yb: number, v0: number, v1: number, sh: boolean | 'receive' | 'cast' = true, collide = false): void => {
    if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3 || yb - ya < 1e-3) return;
    if (along) b.boxMM(mat, [u0, ya, v0], [u1, yb, v1], { shadow: sh, collide });
    else b.boxMM(mat, [v0, ya, u0], [v1, yb, u1], { shadow: sh, collide });
  };
  const box = (mat: THREE.Material, a: [number, number, number], c: [number, number, number], sh: boolean | 'receive' | 'cast' = true): void => {
    b.boxMM(mat, [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])], { shadow: sh });
  };
  const lampBox: [number, number, number, number, number, number] = [x0 - 0.05, y0 - 0.2, z0 - 0.05, x1 + 0.05, yc + 0.3, z1 + 0.05];
  const lampOn = o.lamp ?? 0.45;

  // ---- 梁（段付き）と柱型・柱頭 ----
  const sb = f.bottom - f.step;
  for (const t of f.beams) {
    boxUV(m.beam, t - f.bw / 2, t + f.bw / 2, f.bottom, yc + 0.01, V[0], V[1], true);
    boxUV(m.beam, t - f.bw / 2 + 0.13, t + f.bw / 2 - 0.13, sb, f.bottom, V[0] + f.pd, V[1] - f.pd, true);
  }
  for (const p of f.piers) {
    const line = sideLine(r, p.side);
    const sgn = p.side === 'n' || p.side === 'w' ? 1 : -1;
    // 壁からの出（場面の座標の、壁に直交する向き）
    const out = (d: number): number => line + sgn * d;
    const put = (mat: THREE.Material, hw: number, ya: number, yb: number, d: number, sh: boolean | 'receive' = true): void => {
      if (p.side === 'n' || p.side === 's') box(mat, [p.t - hw, ya, line], [p.t + hw, yb, out(d)], sh);
      else box(mat, [line, ya, p.t - hw], [out(d), yb, p.t + hw], sh);
    };
    const hw = f.pw / 2;
    if (p.wall) {
      // 端の壁の柱型: 蛇腹の下まで、上に 1 段の柱頭
      const top = yc - 0.32;
      put(m.pier, hw, y0, top - 0.14, f.pd);
      put(m.plinth, hw + 0.05, y0, y0 + 0.16, f.pd + 0.05);
      put(m.pier, hw + 0.1, top - 0.14, top, f.pd + 0.1);
      continue;
    }
    if (p.full) {
      put(m.pier, hw, y0, sb, f.pd);
      put(m.plinth, hw + 0.05, y0, y0 + 0.16, f.pd + 0.05);
    } else {
      // 持ち送り（段々に下へ細る）
      put(m.pier, hw, sb - 0.32, sb, f.pd);
      put(m.pier, hw - 0.12, sb - 0.56, sb - 0.32, f.pd - 0.1);
    }
    // 段々の柱頭（梁の下で 2 段に広がる）
    put(m.pier, hw + 0.1, sb - 0.16, sb, f.pd + 0.1);
    put(m.beam, hw + 0.2, sb, f.bottom, f.pd + 0.2);
  }

  // 角の柱型（L 字に見える太い角）
  for (const c of f.corners) {
    const top = yc - 0.32;
    const cw = 0.35;
    box(m.pier, [c.x, y0, c.z], [c.x + c.sx * cw, top, c.z + c.sz * cw]);
    box(m.plinth, [c.x, y0, c.z], [c.x + c.sx * (cw + 0.05), y0 + 0.16, c.z + c.sz * (cw + 0.05)]);
    box(m.pier, [c.x, top - 0.14, c.z], [c.x + c.sx * (cw + 0.1), top, c.z + c.sz * (cw + 0.1)]);
  }

  // ---- 壁の柱型の間の換気口（蛇腹のすぐ下の暗い凹みと桟。参考画像の梁・柱の暗い欠き）----
  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    const line = sideLine(r, side);
    const sgn = side === 'n' || side === 'w' ? 1 : -1;
    const ns = side === 'n' || side === 's';
    const [lo, hi] = ns ? [x0, x1] : [z0, z1];
    const stops = [lo + 0.45, hi - 0.45, ...f.piers.filter((p) => p.side === side).map((p) => p.t)].sort((p, q) => p - q);
    const busy = [...sideOpenings(r, side).map((op) => [op.a - 0.3, op.b + 0.3]), ...clerestories(r).filter((w) => w.side === side).map((w) => [w.a - 0.3, w.b + 0.3])];
    const yv0 = yc - 0.62;
    const yv1 = yc - 0.38;
    for (let i = 0; i < stops.length - 1; i++) {
      const ta = stops[i] + 0.45;
      const tb = stops[i + 1] - 0.45;
      if (tb - ta < 0.9) continue;
      const tm = (ta + tb) / 2;
      const hwv = Math.min(0.6, (tb - ta) / 2);
      if (busy.some(([p, q]) => tm + hwv > p && tm - hwv < q)) continue;
      const at = (t0: number, t1: number, ya: number, yb: number, d0: number, d1: number, mat: THREE.Material): void => {
        if (ns) box(mat, [t0, ya, line + sgn * d0], [t1, yb, line + sgn * d1], false);
        else box(mat, [line + sgn * d0, ya, t0], [line + sgn * d1, yb, t1], false);
      };
      at(tm - hwv, tm + hwv, yv0, yv1, 0, 0.012, m.reveal);
      for (let k = 1; k < 4; k++) {
        const y = yv0 + ((yv1 - yv0) * k) / 4;
        at(tm - hwv, tm + hwv, y - 0.012, y + 0.012, 0.012, 0.03, m.bar);
      }
      at(tm - hwv - 0.05, tm + hwv + 0.05, yv0 - 0.05, yv0, 0, 0.05, m.frame);
      at(tm - hwv - 0.05, tm + hwv + 0.05, yv1, yv1 + 0.05, 0, 0.05, m.frame);
    }
  }

  // ---- 外に面した高窓・突き当たりの窓（ガラス・桟・深い窓台と額縁・外の明るい面） ----
  for (const w of clerestories(r)) {
    const line = sideLine(r, w.side);
    const sgn = w.side === 'n' || w.side === 'w' ? 1 : -1;
    const ns = w.side === 'n' || w.side === 's';
    const at = (t0: number, t1: number, ya: number, yb: number, d0: number, d1: number, mat: THREE.Material, sh: boolean | 'receive' | 'cast' = 'receive'): void => {
      if (ns) box(mat, [t0, ya, line + sgn * d0], [t1, yb, line + sgn * d1], sh);
      else box(mat, [line + sgn * d0, ya, t0], [line + sgn * d1, yb, t1], sh);
    };
    const T = 0.25;
    at(w.a - 0.12, w.b + 0.12, w.bottom - 0.12, w.bottom, -T, 0.14, m.frame);
    at(w.a - 0.12, w.b + 0.12, w.top, w.top + 0.12, -T, 0.08, m.frame);
    at(w.a - 0.12, w.a, w.bottom, w.top, -T, 0.08, m.frame);
    at(w.b, w.b + 0.12, w.bottom, w.top, -T, 0.08, m.frame);
    at(w.a, w.b, w.bottom, w.top, -T * 0.6 - 0.01, -T * 0.6, m.glass, false);
    const nb = Math.max(1, Math.round((w.b - w.a) / 0.8));
    for (let k = 1; k < nb; k++) {
      const t = w.a + (k * (w.b - w.a)) / nb;
      at(t - 0.03, t + 0.03, w.bottom, w.top, -T * 0.6 - 0.04, -T * 0.6 + 0.03, m.bar, 'cast');
    }
    if (w.top - w.bottom > 1.4) at(w.a, w.b, (w.bottom + w.top) / 2 - 0.03, (w.bottom + w.top) / 2 + 0.03, -T * 0.6 - 0.04, -T * 0.6 + 0.03, m.bar, 'cast');
    // 外の明るい面（空と霧の色。影は落とさない）
    at(w.a - 0.8, w.b + 0.8, w.bottom - 0.8, w.top + 0.8, -T - 0.9, -T - 0.85, m.glow, false);
  }

  // ---- 壁の上の段々の蛇腹（梁の無い 4 辺に 2 段） ----
  // 開口の上端が蛇腹より高い所は切る
  const cor = (d: number, ya: number, yb: number): void => {
    for (const side of ['n', 's', 'w', 'e'] as Side[]) {
      const ns = side === 'n' || side === 's';
      const [lo, hi] = ns ? [x0, x1] : [z0 + d, z1 - d];
      const gaps = [...sideOpenings(r, side), ...clerestories(r).filter((w) => w.side === side).map((w) => ({ a: w.a - 0.12, b: w.b + 0.12, top: w.top + 0.12 }))]
        .filter((op) => op.top > ya - 0.02)
        .map((op) => [op.a, op.b] as [number, number])
        .sort((p, q) => p[0] - q[0]);
      const seg = (a: number, c: number): void => {
        if (c - a < 0.05) return;
        if (side === 'n') box(m.beam, [a, ya, z0], [c, yb, z0 + d], 'receive');
        else if (side === 's') box(m.beam, [a, ya, z1 - d], [c, yb, z1], 'receive');
        else if (side === 'w') box(m.beam, [x0, ya, a], [x0 + d, yb, c], 'receive');
        else box(m.beam, [x1 - d, ya, a], [x1, yb, c], 'receive');
      };
      let t = lo;
      for (const [a, c] of gaps) {
        if (c <= t || a >= hi) continue;
        if (a > t) seg(t, Math.min(a, hi));
        t = Math.max(t, c);
      }
      if (t < hi) seg(t, hi);
    }
  };
  cor(0.25, yc - 0.18, yc + 0.01);
  cor(0.12, yc - 0.32, yc - 0.18);

  // ---- 扉・窓の厚い額縁（部屋の側） ----
  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    const line = sideLine(r, side);
    const sgn = side === 'n' || side === 'w' ? 1 : -1;
    const [lo, hi] = side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
    for (const op of sideOpenings(r, side)) {
      const a = Math.max(lo, op.a);
      const c = Math.min(hi, op.b);
      if (c - a < 0.3) continue;
      const top = Math.min(op.top, yc - 0.34);
      const fr = (t0: number, t1: number, ya: number, yb: number, d: number): void => {
        if (side === 'n' || side === 's') box(m.frame, [t0, ya, line], [t1, yb, line + sgn * d], 'receive');
        else box(m.frame, [line, ya, t0], [line + sgn * d, yb, t1], 'receive');
      };
      // 見込み（開口の中の壁の厚さの面）は深い青緑（参考画像の深い陰）
      const rv = (t0: number, t1: number, ya: number, yb: number): void => {
        if (side === 'n' || side === 's') box(m.reveal, [t0, ya, line - sgn * PART], [t1, yb, line], false);
        else box(m.reveal, [line - sgn * PART, ya, t0], [line, yb, t1], false);
      };
      const ht = Math.min(op.top, yc - 0.05);
      if (op.a > lo) rv(op.a, op.a + 0.03, op.bottom, ht);
      if (op.b < hi) rv(op.b - 0.03, op.b, op.bottom, ht);
      rv(Math.max(lo, op.a), Math.min(hi, op.b), ht - 0.03, ht);
      if (op.window) rv(Math.max(lo, op.a), Math.min(hi, op.b), op.bottom, op.bottom + 0.03);
      const w = 0.16;
      const d = 0.09;
      if (a - w > lo) fr(a - w, a, op.bottom, top + w, d);
      if (c + w < hi) fr(c, c + w, op.bottom, top + w, d);
      fr(Math.max(lo, a - w), Math.min(hi, c + w), top, top + w, d);
      if (op.window) fr(a, c, op.bottom - 0.08, op.bottom, 0.16);
    }
  }

  // 大梁（梁と直交）と、大梁で分けた架かる向きの区間
  const GW = 0.3;
  const subs: [number, number][] = [];
  {
    let va = V[0];
    for (const g of f.girders) {
      boxUV(m.beam, U[0], U[1], f.bottom, yc + 0.01, g - GW, g + GW, true);
      if (along) box(m.beam, [U[0] + f.pd, sb, g - GW + 0.13], [U[1] - f.pd, f.bottom, g + GW - 0.13]);
      else box(m.beam, [g - GW + 0.13, sb, U[0] + f.pd], [g + GW - 0.13, f.bottom, U[1] - f.pd]);
      subs.push([va, g - GW]);
      va = g + GW;
    }
    subs.push([va, V[1]]);
  }

  // 吊り下げの灯り（梁の向きに直交する長い箱）と光だまり。u = 中心、yTop = 吊る面の高さ
  function pendants(u: number, room: number, yTop: number): void {
    for (const [va, vb] of subs) {
      const sl = vb - va;
      const nl = sl > 7.5 ? 2 : 1;
      for (let k = 0; k < nl; k++) {
        const vm = va + ((k + 0.5) * sl) / nl;
        const lw = Math.min(1.4, Math.max(0.9, room * 0.5));
        const yb = Math.min(yTop - 0.14, yc - 0.5);
        boxUV(m.body, u - 0.17, u + 0.17, yb, yb + 0.1, vm - lw / 2, vm + lw / 2, false);
        boxUV(m.lens, u - 0.13, u + 0.13, yb - 0.012, yb, vm - lw / 2 + 0.04, vm + lw / 2 - 0.04, false);
        for (const s of [-1, 1]) boxUV(m.body, u - 0.012, u + 0.012, yb + 0.1, yTop, vm + s * (lw / 2 - 0.15) - 0.012, vm + s * (lw / 2 - 0.15) + 0.012, false);
        // 光だまり: 器具の真下の四角い日なた（縁は硬く、影の升目に沿って段になる。1.6 m 角ほど）。
        // 光の中心は床から 1.1 m（四角の縦の届きが床に収まる高さ）
        const ly = y0 + 1.1;
        const pos: [number, number, number] = along ? [u, ly, vm] : [vm, ly, u];
        const hw = 1.05;
        b.ctx.addLamp({ pos, radius: hw / 0.672, intensity: lampOn, color: o.lampColor, box: lampBox, down: true, shadow: 0.15, square: true, hard: true });
      }
    }
  }

  // ---- 天井（格間）・天窓の井戸・灯り ----
  const edges = [U[0] - P, ...f.beams, U[1] + P];
  const sky = o.skylights ?? true;
  const v0 = V[0] - P;
  const v1 = V[1] + P;
  for (let i = 0; i < edges.length - 1; i++) {
    // 格間の範囲（梁の下の部分を除く）
    const ua = i === 0 ? edges[0] : edges[i] + f.bw / 2;
    const ub = i === edges.length - 2 ? edges[i + 1] : edges[i + 1] - f.bw / 2;
    const ia = i === 0 ? U[0] : ua;
    const ib = i === edges.length - 2 ? U[1] : ub;
    const bayW = ib - ia;
    const mid = (ia + ib) / 2;
    // 天窓は 1 つおきの格間（日なたは床の 2〜3 割）
    const isSky = sky && bayW >= 1.6;
    if (!isSky) {
      boxUV(m.ceil, ua, ub, yc, yc + 0.25, v0, v1, true, true);
      if (f.beams.length === 0 || !sky) pendants(mid, bayW, yc);
      continue;
    }
    // 天窓: 格間の真ん中の帯（梁の向き sw、架かる向きに大梁の区間ごとに分割）
    const sw = Math.min(2.4, bayW - 0.9);
    const sa = mid - sw / 2;
    const sc = mid + sw / 2;
    const holes: [number, number][] = [];
    for (const [va, vb] of subs) {
      const sl = vb - va;
      const margin = Math.min(0.6, sl * 0.12);
      const total = sl - 2 * margin;
      const ns = Math.max(1, Math.round(total / 3.0));
      const rib = 0.5;
      const segL = (total - (ns - 1) * rib) / ns;
      for (let k = 0; k < ns; k++) {
        const h0 = va + margin + k * (segL + rib);
        holes.push([h0, h0 + segL]);
      }
    }
    boxUV(m.ceil, ua, sa, yc, yc + 0.25, v0, v1, true, true);
    boxUV(m.ceil, sc, ub, yc, yc + 0.25, v0, v1, true, true);
    let vv = v0;
    for (const [h0, h1] of holes) {
      boxUV(m.ceil, sa, sc, yc, yc + 0.25, vv, h0, true, true);
      vv = h1;
    }
    boxUV(m.ceil, sa, sc, yc, yc + 0.25, vv, v1, true, true);
    const WT = 0.12;
    const wy1 = yc + 0.62;
    for (const [h0, h1] of holes) {
      // 井戸の 4 面（タイル張り）
      boxUV(m.well, sa - WT, sc + WT, yc, wy1, h0 - WT, h0, true);
      boxUV(m.well, sa - WT, sc + WT, yc, wy1, h1, h1 + WT, true);
      boxUV(m.well, sa - WT, sa, yc, wy1, h0, h1, true);
      boxUV(m.well, sc, sc + WT, yc, wy1, h0, h1, true);
      // 井戸の口の縁（天井の面に一段の額縁）
      boxUV(m.frame, sa - 0.1, sc + 0.1, yc - 0.06, yc, h0 - 0.1, h0, 'receive');
      boxUV(m.frame, sa - 0.1, sc + 0.1, yc - 0.06, yc, h1, h1 + 0.1, 'receive');
      boxUV(m.frame, sa - 0.1, sa, yc - 0.06, yc, h0, h1, 'receive');
      boxUV(m.frame, sc, sc + 0.1, yc - 0.06, yc, h0, h1, 'receive');
      // ガラスと細い桟（桟は影を落とす = 日なたに細い縞）
      boxUV(m.glass, sa, sc, wy1 - 0.02, wy1, h0, h1, false);
      // 細い桟は影を落とさない（影の升目より細い影は点々になる）。1 m おきに、タイル 1 枚の幅の見えない板で縞の影を落とす
      for (let v = h0 + 0.5; v < h1 - 0.2; v += 0.5) {
        boxUV(m.bar, sa, sc, wy1 - 0.06, wy1, v - 0.025, v + 0.025, false);
        if (Math.round((v - h0) / 0.5) % 2 === 0) {
          const cu = (sa + sc) / 2;
          const c: [number, number, number] = along ? [cu, wy1 - 0.03, v] : [v, wy1 - 0.03, cu];
          const sz: [number, number, number] = along ? [sc - sa, 0.05, 0.25] : [0.25, 0.05, sc - sa];
          b.shadowCaster(c, sz);
        }
      }
      boxUV(m.bar, mid - 0.025, mid + 0.025, wy1 - 0.06, wy1, h0, h1, false);
      // 空（照明なしの明るい面。影は落とさない）
      boxUV(m.sky, sa - 1.2, sc + 1.2, wy1 + 1.4, wy1 + 1.45, h0 - 1.2, h1 + 1.2, false);
    }
  }
  // 天窓のある部屋の灯りは梁の下に吊る
  if (sky) for (const t of f.beams) pendants(t, 0.6, sb);
}
