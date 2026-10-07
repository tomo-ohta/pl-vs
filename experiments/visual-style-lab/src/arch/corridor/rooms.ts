import * as THREE from 'three';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import { CAM0 } from '../../scenes/corridor/seg0.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { Doors } from './doors.ts';
import type { DoorDef, RoomDef, Side } from './layout.ts';
import { Leg } from './leg.ts';

/**
 * 部屋の内側（壁の内の面・床・天井・幅木・開口の枠・外壁の窓・部屋の側で作る扉）。
 * 廊下の側の面は脚（legA〜D）が作る。壁は「両側の面 + 開口の内側の面」で、中は空（どこからも見えない）。
 * 当たり判定: 床の箱と、壁の面から外へ 0.12 m の薄い箱（扉の所は空ける）。
 */

type M = THREE.Material;

export interface RoomPalette {
  wall: M;
  /** 辺ごとの壁の色（北の廊下の 2 色: +X を向く面は陰の色） */
  wallSide?: Partial<Record<Side, M>>;
  floor: M;
  ceil: M;
  base: M;
  frame: M;
  door: M;
  doorEdge: M;
  glassIn: M;
  sky: M;
  metal: M;
  dark: M;
  /** 壁の足元の帯（区域の描き方の貼り絵。dress.ts の zoneDecals） */
  band?: RoomBand;
  /** 窓の前の床の光の四角（貼り絵） */
  windowLight?: M;
}

/** 壁の足元の帯: A〜C は床の上の暗い帯（外の縁がちぎれる）、D は壁の足元の紺の帯（上の縁がちぎれる） */
export interface RoomBand {
  band: M;
  bandLight?: M;
  bandOnWall?: boolean;
  bandW: number;
}

/** 帯を壁の面（座標系 s の z = 0、部屋は +z）の x0〜x1 に */
export function roomBand(s: Leg, dec: RoomBand, x0: number, x1: number): void {
  if (x1 - x0 < 0.05) return;
  if (dec.bandOnWall) {
    const hh = 0.15;
    s.quad(dec.band, [x0, 0, 0.004], [x1, 0, 0.004], [x1, hh, 0.004], [x0, hh, 0.004]);
    return;
  }
  const bw = dec.bandW;
  // u = 0 が壁の側、u = 1 が部屋の側（ちぎれる縁）。上から見て反時計回り
  s.quad(dec.band, [x0, 0.003, 0], [x0, 0.003, bw], [x1, 0.003, bw], [x1, 0.003, 0]);
  if (dec.bandLight) s.quad(dec.bandLight, [x0, 0.0015, bw - 0.03], [x0, 0.0015, bw + 0.08], [x1, 0.0015, bw + 0.08], [x1, 0.0015, bw - 0.03]);
}

/**
 * 外壁の柱（構造の柱。外壁の辺の両端の角に、部屋の内へ出る）。参考画像の廊下の柱型と同じ「壁から出た箱」のリズムを部屋にも。
 * 2 つの外壁が出会う角は 1 本。場面の座標の長方形 [x0, z0, x1, z1]
 */
export function extColumns(r: RoomDef): [number, number, number, number][] {
  if (r.kind === 'stair' || r.kind === 'shaft' || !r.ext?.length) return [];
  const [x0, z0, x1, z1] = r.rect;
  const W = 0.32;
  const Dp = 0.38;
  const out: [number, number, number, number][] = [];
  const ext = new Set(r.ext);
  const corner = (cx: 'a' | 'b', cz: 'a' | 'b', side: Side): void => {
    const sq = (side === 'n' || side === 's' ? ext.has(cx === 'a' ? 'w' : 'e') : ext.has(cz === 'a' ? 'n' : 's'));
    const wx = side === 'n' || side === 's' ? (sq ? Dp : W) : Dp;
    const wz = side === 'n' || side === 's' ? Dp : sq ? Dp : W;
    const ax = cx === 'a' ? x0 : x1 - wx;
    const az = cz === 'a' ? z0 : z1 - wz;
    const rc: [number, number, number, number] = [ax, az, ax + wx, az + wz];
    if (!out.some((o) => Math.abs(o[0] - rc[0]) < 1e-3 && Math.abs(o[1] - rc[1]) < 1e-3 && Math.abs(o[2] - rc[2]) < 1e-3)) out.push(rc);
  };
  for (const side of r.ext) {
    if (side === 'n') (corner('a', 'a', side), corner('b', 'a', side));
    if (side === 's') (corner('a', 'b', side), corner('b', 'b', side));
    if (side === 'w') (corner('a', 'a', side), corner('a', 'b', side));
    if (side === 'e') (corner('b', 'a', side), corner('b', 'b', side));
  }
  return out;
}

/** 辺の座標系: 壁に沿って local x、部屋の内へ local +z（外へ -z）。原点は壁の面の上 */
export function sideFrame(b: Builder, ctx: SceneContext, r: RoomDef, side: Side): { leg: Leg; sgn: 1 | -1 } {
  const [x0, z0, x1, z1] = r.rect;
  if (side === 'n') return { leg: new Leg(b, ctx, [0, 0, z0], CAM0, 0), sgn: 1 };
  if (side === 's') return { leg: new Leg(b, ctx, [0, 0, z1], CAM0, Math.PI), sgn: -1 };
  if (side === 'w') return { leg: new Leg(b, ctx, [x0, 0, 0], CAM0, Math.PI / 2), sgn: -1 };
  return { leg: new Leg(b, ctx, [x1, 0, 0], CAM0, -Math.PI / 2), sgn: 1 };
}

/** 辺の長さの範囲（u: n/s は x、w/e は z） */
function sideRange(r: RoomDef, side: Side): [number, number] {
  const [x0, z0, x1, z1] = r.rect;
  return side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
}

interface Hole {
  a: number;
  b: number;
  y0: number;
  y1: number;
  depth: number;
  door: boolean;
  glass?: M;
  sky?: boolean;
}

/** 外壁の窓の並び（辺の長さから） */
export function extWindows(r: RoomDef, side: Side): Hole[] {
  const [u0, u1] = sideRange(r, side);
  const L = u1 - u0;
  const n = Math.max(1, Math.floor(L / 3.1));
  const seg = L / n;
  const w = Math.min(2.3, seg - 0.7);
  const out: Hole[] = [];
  const sill = r.kind === 'day' ? 0.45 : r.kind === 'stair' ? 1.0 : r.kind === 'toilet' || r.kind === 'bath' || r.kind === 'dress' ? 1.3 : 0.8;
  for (let i = 0; i < n; i++) {
    const c = u0 + seg * (i + 0.5);
    out.push({ a: c - w / 2, b: c + w / 2, y0: sill, y1: 2.2, depth: 0.3, door: false, sky: true });
  }
  return out;
}

export function roomShell(b: Builder, ctx: SceneContext, r: RoomDef, p: RoomPalette, doors: Doors, o: { skirting?: boolean; floor?: boolean; ceil?: boolean } = {}): void {
  const [x0, z0, x1, z1] = r.rect;
  const h = r.h;
  // 床・天井
  if (o.floor !== false) b.boxMM(p.floor, [x0, -0.1, z0], [x1, 0, z1], { collide: true, shadow: 'receive' });
  if (o.ceil !== false) b.plane(p.ceil, [(x0 + x1) / 2, h, (z0 + z1) / 2], x1 - x0, z1 - z0, '-y', { shadow: false });
  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    const holes: Hole[] = [];
    for (const d of r.doors.filter((dd) => dd.side === side)) holes.push({ a: d.a, b: d.b, y0: 0, y1: d.top, depth: d.depth, door: true });
    for (const g of r.glaze?.filter((gg) => gg.side === side) ?? []) holes.push({ a: g.a, b: g.b, y0: g.y0, y1: g.y1, depth: g.depth, door: false, glass: ctx.mat({ color: g.color, line: 0.5 }) });
    if (r.ext?.includes(side)) {
      const ws = extWindows(r, side);
      holes.push(...ws);
      // 窓の光の四角（参考画像 corridor-1 の床の光の描き方。区域 B の部屋だけ）
      if (r.zone === 'B' && r.kind !== 'stair' && p.windowLight) {
        const { leg: f, sgn } = sideFrame(b, ctx, r, side);
        for (const w of ws) {
          const xa = Math.min(sgn * w.a, sgn * w.b) + 0.1;
          const xb = Math.max(sgn * w.a, sgn * w.b) - 0.1;
          const sk = 0.35;
          f.quad(p.windowLight, [xa, 0.004, 0.25], [xa + sk, 0.004, 1.75], [xb + sk, 0.004, 1.75], [xb, 0.004, 0.25]);
        }
      }
    }
    buildSide(b, ctx, r, side, holes, p.wallSide?.[side] ?? p.wall, p, o.skirting ?? true);
  }
  // 外壁の柱（部屋の内へ出る箱と足元の帯）
  const g = new Leg(b, ctx, [0, 0, 0], CAM0, 0);
  for (const [cx0, cz0, cx1, cz1] of extColumns(r)) {
    g.faces([cx0, 0, cz0], [cx1, h, cz1], { px: p.wall, nx: p.wall, pz: p.wall, nz: p.wall }, { collide: true });
    if (!p.band) continue;
    // 部屋の内を向く面だけに帯（座標系: 面が z = 0、部屋が +z）
    if (cx1 < x1 - 1e-3) roomBand(new Leg(b, ctx, [cx1, 0, (cz0 + cz1) / 2], CAM0, Math.PI / 2), p.band, -(cz1 - cz0) / 2, (cz1 - cz0) / 2);
    if (cx0 > x0 + 1e-3) roomBand(new Leg(b, ctx, [cx0, 0, (cz0 + cz1) / 2], CAM0, -Math.PI / 2), p.band, -(cz1 - cz0) / 2, (cz1 - cz0) / 2);
    if (cz1 < z1 - 1e-3) roomBand(new Leg(b, ctx, [(cx0 + cx1) / 2, 0, cz1], CAM0, 0), p.band, -(cx1 - cx0) / 2, (cx1 - cx0) / 2);
    if (cz0 > z0 + 1e-3) roomBand(new Leg(b, ctx, [(cx0 + cx1) / 2, 0, cz0], CAM0, Math.PI), p.band, -(cx1 - cx0) / 2, (cx1 - cx0) / 2);
  }
  // 部屋の側で作る扉
  for (const d of r.doors) {
    if (d.leaf === 'slide') slideLeaf(b, ctx, r, d, p, doors);
    else if (d.leaf === 'swing2') swingLeaves(b, ctx, r, d, p, doors);
    else if (d.leaf === 'locked') lockedLeaf(b, ctx, r, d, p);
  }
}

function buildSide(b: Builder, ctx: SceneContext, r: RoomDef, side: Side, holes: Hole[], wall: M, p: RoomPalette, skirting: boolean): void {
  const { leg: f, sgn } = sideFrame(b, ctx, r, side);
  const [u0, u1] = sideRange(r, side);
  const h = r.h;
  // 区域の x（辺の座標 u → local x）
  const lx = (u: number): number => sgn * u;
  const hs = [...holes].sort((a, c) => a.a - c.a);
  // 壁の面（開口を除いた長方形に分ける）
  const rect = (ua: number, ub: number, ya: number, yb: number): void => {
    if (ub - ua < 1e-3 || yb - ya < 1e-3) return;
    const xa = Math.min(lx(ua), lx(ub));
    const xb = Math.max(lx(ua), lx(ub));
    f.faces([xa, ya, -0.05], [xb, yb, 0], { pz: wall }, { shadow: 'receive' });
  };
  let u = u0;
  for (const hl of hs) {
    const a = Math.max(u0, hl.a);
    const c = Math.min(u1, hl.b);
    rect(u, a, 0, h);
    rect(a, c, 0, hl.y0);
    rect(a, c, hl.y1, h);
    u = Math.max(u, c);
  }
  rect(u, u1, 0, h);
  // 当たり判定（扉の所は空ける）
  let cu = u0;
  const col = (ua: number, ub: number): void => {
    if (ub - ua < 0.02) return;
    f.collider([Math.min(lx(ua), lx(ub)), 0, -0.12], [Math.max(lx(ua), lx(ub)), h, 0]);
  };
  for (const hl of hs.filter((x) => x.door)) {
    col(cu, hl.a);
    cu = hl.b;
  }
  col(cu, u1);
  // 幅木（扉の所は空ける）
  if (skirting) {
    let su = u0;
    const sk = (ua: number, ub: number): void => {
      if (ub - ua < 0.02) return;
      f.faces([Math.min(lx(ua), lx(ub)), 0, 0], [Math.max(lx(ua), lx(ub)), 0.08, 0.012], { pz: p.base, py: p.base }, { shadow: 'receive' });
    };
    for (const hl of hs.filter((x) => x.door)) {
      sk(su, hl.a);
      su = hl.b;
    }
    sk(su, u1);
    // 足元の帯（扉の所は空ける）
    if (p.band) {
      let bu = u0;
      const bd = (ua: number, ub: number): void => roomBand(f, p.band!, Math.min(lx(ua), lx(ub)), Math.max(lx(ua), lx(ub)));
      for (const hl of hs.filter((x) => x.door)) {
        bd(bu, hl.a);
        bu = hl.b;
      }
      bd(bu, u1);
    }
  }
  // 開口の内側の面（枠）・窓のガラス
  for (const hl of hs) {
    const xa = Math.min(lx(hl.a), lx(hl.b));
    const xb = Math.max(lx(hl.a), lx(hl.b));
    const d = hl.depth;
    const jamb = hl.door ? p.frame : wall;
    f.faces([xa - 0.002, hl.y0, -d], [xa, hl.y1, 0], { px: jamb }, { shadow: 'receive' });
    f.faces([xb, hl.y0, -d], [xb + 0.002, hl.y1, 0], { nx: jamb }, { shadow: 'receive' });
    f.faces([xa, hl.y1, -d], [xb, hl.y1 + 0.002, 0], { ny: jamb }, { shadow: 'receive' });
    if (hl.door) {
      // 敷居
      f.faces([xa, -0.1, -d - 0.02], [xb, 0.004, 0.02], { py: p.base }, { shadow: 'receive', collide: true });
      // 扉の枠（部屋の側）
      const fw = 0.05;
      f.faces([xa - fw, 0, 0], [xa, hl.y1 + fw, 0.02], { pz: p.frame, nx: p.frame }, { shadow: 'receive' });
      f.faces([xb, 0, 0], [xb + fw, hl.y1 + fw, 0.02], { pz: p.frame, px: p.frame }, { shadow: 'receive' });
      f.faces([xa, hl.y1, 0], [xb, hl.y1 + fw, 0.02], { pz: p.frame, ny: p.frame }, { shadow: 'receive' });
    } else {
      f.faces([xa, hl.y0 - 0.002, -d], [xb, hl.y0, 0], { py: hl.sky ? p.frame : wall }, { shadow: 'receive' });
      if (hl.sky) window(f, xa, xb, hl.y0, hl.y1, d, p, r);
      else if (hl.glass) {
        // 廊下の窓の裏（部屋の側）: 型板ガラスと縦・横の桟
        f.faces([xa, hl.y0, -d * 0.5 - 0.005], [xb, hl.y1, -d * 0.5], { pz: hl.glass }, { shadow: false });
        const n = Math.max(1, Math.round((xb - xa) / 0.75));
        for (let i = 1; i < n; i++) {
          const x = xa + ((xb - xa) * i) / n;
          f.faces([x - 0.025, hl.y0, -d * 0.5], [x + 0.025, hl.y1, -d * 0.5 + 0.04], { pz: p.frame, px: p.frame, nx: p.frame });
        }
        const ym = hl.y0 + (hl.y1 - hl.y0) * 0.55;
        f.faces([xa, ym - 0.02, -d * 0.5], [xb, ym + 0.02, -d * 0.5 + 0.04], { pz: p.frame, py: p.frame, ny: p.frame });
      }
    }
  }
}

/** 外壁の窓: 空の色のガラス・縦の桟・横の桟・窓台。病室はカーテン（片側に寄せる） */
function window(f: Leg, xa: number, xb: number, y0: number, y1: number, d: number, p: RoomPalette, r: RoomDef): void {
  const gz = -d + 0.08;
  f.faces([xa, y0, gz - 0.01], [xb, y1, gz], { pz: p.sky }, { shadow: false });
  const w = xb - xa;
  const n = Math.max(2, Math.round(w / 0.9));
  for (let i = 1; i < n; i++) {
    const x = xa + (w * i) / n;
    f.faces([x - 0.025, y0, gz], [x + 0.025, y1, gz + 0.05], { pz: p.frame, px: p.frame, nx: p.frame }, { shadow: 'receive' });
  }
  const ym = y0 + (y1 - y0) * (r.kind === 'stair' ? 0.5 : 0.62);
  f.faces([xa, ym - 0.025, gz], [xb, ym + 0.025, gz + 0.05], { pz: p.frame, py: p.frame, ny: p.frame }, { shadow: 'receive' });
  // 窓台
  f.faces([xa - 0.05, y0 - 0.03, -0.02], [xb + 0.05, y0, 0.06], { py: p.frame, pz: p.frame }, { shadow: 'receive' });
}

/** 扉の葉の形（部屋の側で作る引き戸）: 板・縦長の小窓・取っ手・足元の板 */
function leafBody(s: Leg, xa: number, xb: number, top: number, z0: number, z1: number, p: RoomPalette, glass: boolean): void {
  s.faces([xa, 0.005, z0], [xb, top - 0.005, z1], { pz: p.door, nz: p.door, px: p.doorEdge, nx: p.doorEdge, py: p.doorEdge });
  const w = xb - xa;
  if (glass) {
    const gx = xa + w * 0.62;
    for (const zz of [z1 + 0.002, z0 - 0.002]) s.faces([gx, 1.05, zz], [gx + Math.min(0.16, w * 0.15), 1.85, zz], zz > z1 ? { pz: p.glassIn } : { nz: p.glassIn });
  }
  // 取っ手（縦の棒）
  const hx = xa + 0.1;
  for (const [zz, sg] of [[z1, 1], [z0, -1]] as [number, 1 | -1][]) {
    s.faces([hx - 0.015, 0.85, sg > 0 ? zz : zz - 0.04], [hx + 0.015, 1.25, sg > 0 ? zz + 0.04 : zz], { pz: p.metal, nz: p.metal, px: p.metal, nx: p.metal });
    s.faces([xa + 0.02, 0.05, sg > 0 ? zz : zz - 0.004], [xb - 0.02, 0.3, sg > 0 ? zz + 0.004 : zz], sg > 0 ? { pz: p.doorEdge } : { nz: p.doorEdge });
  }
}

function slideLeaf(b: Builder, ctx: SceneContext, r: RoomDef, d: DoorDef, p: RoomPalette, doors: Doors): void {
  const { leg: f, sgn } = sideFrame(b, ctx, r, d.side);
  const xa = Math.min(sgn * d.a, sgn * d.b);
  const xb = Math.max(sgn * d.a, sgn * d.b);
  const w = xb - xa;
  // 葉は壁の厚さの中ほど（向こう側の面から 0.08）。滑る向きは辺の座標の dir → local x
  const zc = -d.depth + 0.1;
  const dir = (d.dir ?? 1) * sgn;
  doors.add(f, [(xa + xb) / 2, 0, -d.depth / 2], [
    {
      pivot: [xa, 0, zc],
      slide: { dir: [dir, 0], dist: w - 0.08 },
      build: (s) => leafBody(s, xa, xb, d.top, zc - 0.02, zc + 0.02, p, r.kind === 'ward' || r.kind === 'obs'),
    },
  ]);
}

/** 両開きの防火戸（階段）: 部屋（階段室）の内へ開く */
function swingLeaves(b: Builder, ctx: SceneContext, r: RoomDef, d: DoorDef, p: RoomPalette, doors: Doors): void {
  const { leg: f, sgn } = sideFrame(b, ctx, r, d.side);
  const xa = Math.min(sgn * d.a, sgn * d.b);
  const xb = Math.max(sgn * d.a, sgn * d.b);
  const xm = (xa + xb) / 2;
  const z0 = -0.06;
  const z1 = -0.01;
  const body = (s: Leg, a: number, c: number): void => {
    s.faces([a + 0.005, 0.005, z0], [c - 0.005, d.top - 0.005, z1], { pz: p.door, nz: p.door, px: p.doorEdge, nx: p.doorEdge, py: p.doorEdge });
    const gx0 = a + (c - a) * 0.3;
    const gx1 = c - (c - a) * 0.3;
    s.faces([gx0, 1.25, z1], [gx1, 1.75, z1 + 0.003], { pz: p.glassIn });
    s.faces([gx0, 1.25, z0 - 0.003], [gx1, 1.75, z0], { nz: p.glassIn });
    s.faces([a + 0.1, 0.95, z1], [c - 0.1, 1.0, z1 + 0.05], { pz: p.metal, py: p.metal, ny: p.metal });
    // 足元の板（両面）・小窓の枠・上のドアクローザー（防火戸の金物）
    s.faces([a + 0.03, 0.04, z1], [c - 0.03, 0.32, z1 + 0.004], { pz: p.doorEdge });
    s.faces([a + 0.03, 0.04, z0 - 0.004], [c - 0.03, 0.32, z0], { nz: p.doorEdge });
    for (const [zz, n] of [[z1, 1], [z0, -1]] as [number, 1 | -1][]) {
      const za = n > 0 ? zz : zz - 0.012;
      const zb = n > 0 ? zz + 0.012 : zz;
      const fr = p.doorEdge;
      const fm = n > 0 ? { pz: fr, py: fr, ny: fr, px: fr, nx: fr } : { nz: fr, py: fr, ny: fr, px: fr, nx: fr };
      // 小窓の下の表示の札（暗い地に明るい帯）
      s.faces([gx0, 1.02, za], [gx1, 1.12, zb], n > 0 ? { pz: p.dark } : { nz: p.dark });
      s.faces([gx0 + 0.03, 1.055, n > 0 ? zb : za - 0.002], [gx1 - 0.06, 1.075, n > 0 ? zb + 0.002 : za], n > 0 ? { pz: p.frame } : { nz: p.frame });
      s.faces([gx0 - 0.03, 1.22, za], [gx1 + 0.03, 1.25, zb], fm);
      s.faces([gx0 - 0.03, 1.75, za], [gx1 + 0.03, 1.78, zb], fm);
      s.faces([gx0 - 0.03, 1.25, za], [gx0, 1.75, zb], fm);
      s.faces([gx1, 1.25, za], [gx1 + 0.03, 1.75, zb], fm);
    }
    // 防火戸の表示の板（両面。腰の高さ）と、吊り元の側の蝶番の帯
    s.faces([gx0, 0.55, z1], [gx1, 0.72, z1 + 0.003], { pz: p.frame });
    s.faces([gx0 + 0.04, 0.6, z1 + 0.003], [gx1 - 0.08, 0.63, z1 + 0.005], { pz: p.dark });
    s.faces([gx0, 0.55, z0 - 0.003], [gx1, 0.72, z0], { nz: p.frame });
    s.faces([gx0 + 0.04, 0.6, z0 - 0.005], [gx1 - 0.08, 0.63, z0 - 0.003], { nz: p.dark });
    const hx = Math.abs(a - xa) < 1e-6 ? a + 0.08 : c - 0.38;
    s.faces([hx, d.top - 0.16, z0 - 0.06], [hx + 0.3, d.top - 0.07, z0], { nz: p.metal, ny: p.metal, py: p.metal, px: p.metal, nx: p.metal });
  };
  doors.add(f, [xm, 0, -d.depth / 2], [
    { pivot: [xa, 0, z1], swing: -Math.PI / 2 + 0.05, build: (s) => body(s, xa, xm) },
    { pivot: [xb, 0, z1], swing: Math.PI / 2 - 0.05, build: (s) => body(s, xm, xb) },
  ]);
}

/** 開かない扉（下の階・上の階へ出る扉など） */
function lockedLeaf(b: Builder, ctx: SceneContext, r: RoomDef, d: DoorDef, p: RoomPalette): void {
  const { leg: f, sgn } = sideFrame(b, ctx, r, d.side);
  const xa = Math.min(sgn * d.a, sgn * d.b);
  const xb = Math.max(sgn * d.a, sgn * d.b);
  f.faces([xa, 0, -0.06], [xb, d.top, -0.02], { pz: p.door }, { collide: true });
  f.faces([xa + 0.1, 0.95, -0.02], [xb - 0.1, 1.0, 0.02], { pz: p.metal, py: p.metal });
}

/** 部屋の真ん中の座標系（local -z が基準の辺へ向く。家具を置く）。W = 横幅、D = 奥行き */
export function roomFrame(b: Builder, ctx: SceneContext, r: RoomDef, toward: Side): { f: Leg; W: number; D: number } {
  const [x0, z0, x1, z1] = r.rect;
  const c: V3 = [(x0 + x1) / 2, 0, (z0 + z1) / 2];
  const yaw = toward === 'n' ? 0 : toward === 's' ? Math.PI : toward === 'w' ? Math.PI / 2 : -Math.PI / 2;
  const f = new Leg(b, ctx, c, CAM0, yaw);
  const ns = toward === 'n' || toward === 's';
  return { f, W: ns ? x1 - x0 : z1 - z0, D: ns ? z1 - z0 : x1 - x0 };
}
