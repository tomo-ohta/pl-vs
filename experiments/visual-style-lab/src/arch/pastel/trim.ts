import type * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { DOORS, WINDOWS, type Rect, type RoomDef, type Side } from './layout.ts';
import type { Paints } from './paint.ts';
import type { RoomStyle } from './shell.ts';

/**
 * 躯体と造作の決まり（淡色の廊下の建築版。写っていない部屋すべてに同じ決まりで使う）。
 * 参考画像の語彙: 壁から出た柱型が 2〜3 m おきに並び、横の面が 1 段暗い・天井に梁の段・戸口の奥の暗い隙間・暗い幅木。
 * - 柱型: 部屋の隅の柱（0.28 m 角）と、長い向きを 3.5 m 以下に割る位置の柱型（両側の長い壁）、窓と窓の間の壁（0.5〜1.6 m）の柱型。
 *   扉・窓口・窓には掛けない（ずらすか、やめる）
 * - 梁: 柱型の位置で部屋の短い向きに渡す（下端は天井から 0.42 m）。灯りは梁の間の区画（bays）の真ん中に付ける
 * - 戸口の内側（壁の厚みの面）: 1 段暗い色で内張り
 * 家具の置き場（furnish.ts の Placer）は柱型の足元を避ける
 */

export interface Pil {
  /** 付く壁（'c' = 部屋の隅の柱） */
  side: Side | 'c';
  /** 足元の範囲（場面の座標） */
  rect: Rect;
  /** 暗くする面の軸（壁に垂直な面） */
  axis: 'x' | 'z';
}

export interface Struct {
  pils: Pil[];
  /** 梁の足元の範囲（天井の下） */
  beams: Rect[];
  /** 梁の間の区画（長い向きの座標の範囲） */
  bays: [number, number][];
  /** 長い向き */
  long: 'x' | 'z';
}

/** 柱型・梁を付ける部屋の種類 */
const KINDS = new Set(['lobby', 'office', 'doctor', 'store', 'consult', 'treat', 'lab']);
export const PIL_W = 0.36;
export const PIL_D = 0.13;
export const COL_W = 0.28;
export const BEAM_D = 0.42;
const BEAM_W = 0.34;

/** 部屋の辺の上の開口（扉・窓口・外の窓）の範囲（辺に沿った座標） */
export function openingsOn(r: RoomDef, s: Side): [number, number][] {
  const [x0, z0, x1, z1] = r.rect;
  const out: [number, number][] = [];
  const onSide = (wall: 'x' | 'z', line: number): boolean => {
    if (s === 'n') return wall === 'x' && Math.abs(line - z0) < 0.5;
    if (s === 's') return wall === 'x' && Math.abs(line - z1) < 0.5;
    if (s === 'w') return wall === 'z' && Math.abs(line - x0) < 0.5;
    return wall === 'z' && Math.abs(line - x1) < 0.5;
  };
  for (const d of DOORS) if ((d.rooms.includes(r.id) || (r.id === 'STAIR' && d.rooms.includes('STAIR'))) && onSide(d.wall, d.line)) out.push([d.a, d.b]);
  for (const w of WINDOWS) if (w.room === r.id && onSide(w.wall, w.line)) out.push([w.a, w.b]);
  return out.sort((a, b) => a[0] - b[0]);
}

const memo = new Map<string, Struct>();

export function structOf(r: RoomDef): Struct {
  const hit = memo.get(r.id);
  if (hit) return hit;
  const [x0, z0, x1, z1] = r.rect;
  const W = x1 - x0;
  const D = z1 - z0;
  const long: 'x' | 'z' = W >= D ? 'x' : 'z';
  const res: Struct = { pils: [], beams: [], bays: [], long };
  const lo = long === 'x' ? x0 : z0;
  const L = long === 'x' ? W : D;
  if (!KINDS.has(r.kind)) {
    res.bays = [[lo, lo + L]];
    memo.set(r.id, res);
    return res;
  }
  // 待合の北の壁は参考画像に写る塊（柱型を付けない）
  const skip = (s: Side | 'c'): boolean => r.id === 'LOBBY' && s === 'n';
  const ops: Record<Side, [number, number][]> = { n: openingsOn(r, 'n'), s: openingsOn(r, 's'), w: openingsOn(r, 'w'), e: openingsOn(r, 'e') };
  const free = (s: Side, u0: number, u1: number, m = 0.1): boolean => !skip(s) && ops[s].every(([a, b]) => u1 + m <= a || u0 - m >= b);
  const rectOn = (s: Side, u: number, w: number, d: number): Rect =>
    s === 'n' ? [u - w / 2, z0, u + w / 2, z0 + d] : s === 's' ? [u - w / 2, z1 - d, u + w / 2, z1] : s === 'w' ? [x0, u - w / 2, x0 + d, u + w / 2] : [x1 - d, u - w / 2, x1, u + w / 2];
  const axisOf = (s: Side): 'x' | 'z' => (s === 'n' || s === 's' ? 'x' : 'z');
  const near = (q: Rect, m: number): boolean => res.pils.some((p) => q[2] + m > p.rect[0] && q[0] - m < p.rect[2] && q[3] + m > p.rect[1] && q[1] - m < p.rect[3]);
  // 隅の柱
  for (const sx of ['w', 'e'] as const)
    for (const sz of ['n', 's'] as const) {
      if (skip(sz) || skip(sx)) continue;
      const ux: [number, number] = sx === 'w' ? [x0, x0 + COL_W] : [x1 - COL_W, x1];
      const uz: [number, number] = sz === 'n' ? [z0, z0 + COL_W] : [z1 - COL_W, z1];
      if (!free(sz, ux[0], ux[1], 0.2) || !free(sx, uz[0], uz[1], 0.2)) continue;
      res.pils.push({ side: 'c', rect: [ux[0], uz[0], ux[1], uz[1]], axis: long === 'x' ? 'x' : 'z' });
    }
  // 梁と、その両端の柱型（長い向きを 3.5 m 以下に割る）
  const sides: [Side, Side] = long === 'x' ? ['n', 's'] : ['w', 'e'];
  const n = Math.max(0, Math.ceil(L / 3.5) - 1);
  const cuts: number[] = [lo];
  for (let i = 1; i <= n; i++) {
    const u0 = lo + (L * i) / (n + 1);
    let best = u0;
    let score = -1;
    for (const off of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6]) {
      const u = u0 + off;
      const sc = sides.filter((s) => free(s, u - PIL_W / 2, u + PIL_W / 2)).length;
      if (sc > score) {
        best = u;
        score = sc;
      }
      if (sc === 2) break;
    }
    cuts.push(best);
    for (const s of sides) if (free(s, best - PIL_W / 2, best + PIL_W / 2)) res.pils.push({ side: s, rect: rectOn(s, best, PIL_W, PIL_D), axis: axisOf(s) });
    res.beams.push(long === 'x' ? [best - BEAM_W / 2, z0, best + BEAM_W / 2, z1] : [x0, best - BEAM_W / 2, x1, best + BEAM_W / 2]);
  }
  cuts.push(lo + L);
  for (let i = 0; i + 1 < cuts.length; i++) res.bays.push([cuts[i], cuts[i + 1]]);
  // 窓と窓（扉）の間の壁の柱型
  for (const s of ['n', 's', 'w', 'e'] as Side[]) {
    if (skip(s)) continue;
    const list = ops[s];
    for (let i = 0; i + 1 < list.length; i++) {
      const g0 = list[i][1];
      const g1 = list[i + 1][0];
      if (g1 - g0 < 0.5 || g1 - g0 > 1.6) continue;
      const w = Math.min(PIL_W, g1 - g0 - 0.12);
      const q = rectOn(s, (g0 + g1) / 2, w, PIL_D);
      if (near(q, 0.3)) continue;
      res.pils.push({ side: s, rect: q, axis: axisOf(s) });
    }
  }
  memo.set(r.id, res);
  return res;
}

/** 柱型・隅の柱・梁と、柱型に回した幅木を作る */
export function buildStructure(b: Builder, p: Paints, r: RoomDef, st: RoomStyle): void {
  const s = structOf(r);
  const [x0, z0, x1, z1] = r.rect;
  const H = r.ceil;
  const baseM = st.base ? p.baseboard(st.base) : null;
  const o = { shadow: false } as const;
  for (const pl of s.pils) {
    const m = st.pil ? st.pil(pl.axis) : st.wall;
    const [a, c, e, f] = pl.rect;
    // 柱型は当たり判定つき（歩いて抜けない）。壁の面から少し埋めて隙間を出さない
    b.boxMM(m, [a - (a <= x0 + 1e-3 ? 0.02 : 0), 0, c - (c <= z0 + 1e-3 ? 0.02 : 0)], [e + (e >= x1 - 1e-3 ? 0.02 : 0), H, f + (f >= z1 - 1e-3 ? 0.02 : 0)], { ...o, collide: true });
    if (!baseM) continue;
    // 幅木（壁に付いていない面だけ。角を包む）
    const t = 0.014;
    const bh = 0.1;
    if (a > x0 + 1e-3) b.boxMM(baseM, [a - t, 0, c - (c > z0 + 1e-3 ? t : 0)], [a, bh, f + (f < z1 - 1e-3 ? t : 0)], o);
    if (e < x1 - 1e-3) b.boxMM(baseM, [e, 0, c - (c > z0 + 1e-3 ? t : 0)], [e + t, bh, f + (f < z1 - 1e-3 ? t : 0)], o);
    if (c > z0 + 1e-3) b.boxMM(baseM, [a, 0, c - t], [e, bh, c], o);
    if (f < z1 - 1e-3) b.boxMM(baseM, [a, 0, f], [e, bh, f + t], o);
  }
  const beamM = p.beam(st.ceilColor);
  for (const q of s.beams) b.boxMM(beamM, [q[0], H - BEAM_D, q[1]], [q[2], H + 0.01, q[3]], o);
}

/**
 * 戸口・窓口・通り抜けの内側（壁の厚みの面）を 1 段暗い色で内張りする（両側の枠の間）。
 * 参考画像の視点の区画の壁にある開口も、内側の面はどれも視点から見えない（柱型・枠の陰）
 */
export function buildReveals(b: Builder, p: Paints): void {
  const m = p.reveal();
  const sillM = p.solid('#8f9e98', 0.5);
  const o = { shadow: false } as const;
  const t = 0.012;
  for (const d of DOORS) {
    if (d.kind === 'window') continue;
    const f0 = d.line - d.thick / 2 + 0.002;
    const f1 = d.line + d.thick / 2 - 0.002;
    const put = (m: THREE.Material, u0: number, u1: number, y0: number, y1: number): void => {
      if (d.wall === 'x') b.boxMM(m, [u0, y0, f0], [u1, y1, f1], o);
      else b.boxMM(m, [f0, y0, u0], [f1, y1, u1], o);
    };
    put(m, d.a, d.a + t, d.y0, d.y1);
    put(m, d.b - t, d.b, d.y0, d.y1);
    put(m, d.a, d.b, d.y1 - t, d.y1);
    // 敷居（床の上の細い暗い帯）
    if (d.y0 < 0.1) put(sillM, d.a, d.b, d.y0, d.y0 + 0.008);
  }
}

/** 家具を置く道具が避ける柱型の足元（少し広げる） */
export function pilasterRects(r: RoomDef): Rect[] {
  return structOf(r).pils.map((q) => [q.rect[0] - 0.03, q.rect[1] - 0.03, q.rect[2] + 0.03, q.rect[3] + 0.03] as Rect);
}

