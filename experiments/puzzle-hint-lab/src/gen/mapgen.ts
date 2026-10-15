/**
 * 100 部屋の地図を作る（DOM / three を使わない。Node の試験で確かめる）。
 *
 * 1. 最初の部屋から、すでにある部屋の壁に新しい長方形の部屋を接ぎ足して育てる（1 m の升目。重ならない）。
 *    候補をいくつか作り、接する部屋が多いもの・最初の部屋を中心にした横長の楕円（タブレットの地図の枠の縦横比）の内側に近いものを選ぶ（乱れも足す）
 * 2. つながり: 育てた元の部屋との間は必ず扉（全部屋がつながる木）。ほかに壁を共有する組から、部屋の数 × loopRatio 本を扉にして回り道を作る
 * 3. 番号: 最初の部屋から扉をたどる幅優先の順に並べ直す（近い部屋ほど近い番号）
 */
import type { Rng } from './rng.ts';
import { overlaps, SIDES, type Door, type Rect, type Side } from './types.ts';

export interface MapOptions {
  rooms: number;
  /** 一辺の長さ（m）の候補と重み */
  sizes: readonly (readonly [number, number])[];
  /** 長い辺 / 短い辺 の上限 */
  maxAspect: number;
  /** 回り道の扉の数（部屋の数に対する割合。木の外で壁を共有する組から選ぶ） */
  loopRatio: number;
  doorWidth: number;
  /** 扉の端から部屋の角までの最小の間（m） */
  doorMargin: number;
  /** 地図全体の 横 / 縦 の目安（タブレットの地図の枠に合わせる） */
  targetAspect: number;
  /** 部屋を寄せる楕円の大きさ（m。最初の部屋から、横と縦の半径の相乗平均） */
  spread: number;
  /** 1 部屋を足すときに比べる候補の数 */
  candidates: number;
}

export const MAP_DEFAULTS: MapOptions = {
  rooms: 100,
  sizes: [
    [5, 3], [6, 5], [7, 6], [8, 6], [9, 5], [10, 3], [11, 2], [12, 1.5], [13, 1],
  ],
  maxAspect: 2.2,
  loopRatio: 0.18,
  doorWidth: 1.2,
  doorMargin: 0.45,
  targetAspect: 2.1,
  spread: 56,
  candidates: 10,
};

export interface GenMap {
  rects: Rect[];
  /** 育てた元の部屋（木の親。最初の部屋は -1） */
  parent: number[];
  doors: Door[];
}

function pickSize(rng: Rng, o: MapOptions): [number, number] {
  for (;;) {
    const w = rng.weighted(o.sizes);
    const d = rng.weighted(o.sizes);
    if (Math.max(w, d) / Math.min(w, d) <= o.maxAspect) return [w, d];
  }
}

/** 部屋 p の side の壁に、大きさ w × d の部屋を share m 以上の壁を共有して接ぎ足す位置 */
function attach(p: Rect, side: Side, w: number, d: number, share: number, rng: Rng): Rect | null {
  if (side === 'E' || side === 'W') {
    const lo = p.z - d + share;
    const hi = p.z + p.d - share;
    if (hi < lo) return null;
    return { x: side === 'E' ? p.x + p.w : p.x - w, z: rng.int(lo, hi), w, d };
  }
  const lo = p.x - w + share;
  const hi = p.x + p.w - share;
  if (hi < lo) return null;
  return { x: rng.int(lo, hi), z: side === 'S' ? p.z + p.d : p.z - d, w, d };
}

/** 2 部屋が共有する壁（無ければ null）。s0〜s1 は境目に沿った範囲 */
export function sharedWall(a: Rect, b: Rect): { vertical: boolean; at: number; s0: number; s1: number } | null {
  if (a.x + a.w === b.x || b.x + b.w === a.x) {
    const s0 = Math.max(a.z, b.z);
    const s1 = Math.min(a.z + a.d, b.z + b.d);
    if (s1 > s0) return { vertical: true, at: a.x + a.w === b.x ? b.x : a.x, s0, s1 };
  }
  if (a.z + a.d === b.z || b.z + b.d === a.z) {
    const s0 = Math.max(a.x, b.x);
    const s1 = Math.min(a.x + a.w, b.x + b.w);
    if (s1 > s0) return { vertical: false, at: a.z + a.d === b.z ? b.z : a.z, s0, s1 };
  }
  return null;
}

function makeDoor(a: number, b: number, wall: { vertical: boolean; at: number; s0: number; s1: number }, o: MapOptions, rng: Rng): Door {
  const lo = wall.s0 + o.doorMargin + o.doorWidth / 2;
  const hi = wall.s1 - o.doorMargin - o.doorWidth / 2;
  const c = Math.round(rng.range(lo, hi) * 10) / 10;
  return { a, b, vertical: wall.vertical, at: wall.at, c: Math.min(hi, Math.max(lo, c)), width: o.doorWidth };
}

export function generateMap(rng: Rng, o: MapOptions = MAP_DEFAULTS): GenMap {
  // 木のつながりは扉の幅と両側の余白より 0.6 m 以上広く共有させる（整数の m）
  const share = Math.ceil(o.doorWidth + 2 * o.doorMargin + 0.6);
  const [w0, d0] = [rng.int(7, 9), rng.int(7, 9)];
  const rects: Rect[] = [{ x: 0, z: 0, w: w0, d: d0 }];
  const parent: number[] = [-1];
  const ax = o.spread * Math.sqrt(o.targetAspect);
  const az = o.spread / Math.sqrt(o.targetAspect);
  for (let guard = 0; rects.length < o.rooms && guard < 200000; guard++) {
    let best: { r: Rect; p: number; score: number } | null = null;
    for (let k = 0; k < o.candidates; k++) {
      const p = rng.int(0, rects.length - 1);
      const [w, d] = pickSize(rng, o);
      const r = attach(rects[p], rng.pick(SIDES), w, d, share, rng);
      if (!r || rects.some((q) => overlaps(q, r))) continue;
      // 楕円の内側へ寄せる（外へ行くほど減点）
      const ex = (r.x + r.w / 2 - w0 / 2) / ax;
      const ez = (r.z + r.d / 2 - d0 / 2) / az;
      // 接する部屋が多いほど詰まった地図になり、回り道の候補（壁を共有する組）も増える
      let contacts = 0;
      for (const q of rects) {
        const wall = sharedWall(q, r);
        if (wall && wall.s1 - wall.s0 >= share) contacts++;
      }
      const score = contacts * 2.2 - (ex * ex + ez * ez) * 8 + rng.next() * 2.5;
      if (!best || score > best.score) best = { r, p, score };
    }
    if (!best) continue;
    rects.push(best.r);
    parent.push(best.p);
  }
  if (rects.length < o.rooms) throw new Error(`部屋を ${o.rooms} 個置けなかった（${rects.length} 個）`);

  // つながり: 木（育てた元）＋ 回り道
  const doors: Door[] = [];
  const linked = new Set<string>();
  const key = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let i = 1; i < rects.length; i++) {
    const wall = sharedWall(rects[i], rects[parent[i]]);
    if (!wall) throw new Error('育てた元の部屋と壁を共有していない');
    doors.push(makeDoor(parent[i], i, wall, o, rng));
    linked.add(key(i, parent[i]));
  }
  const extra: [number, number, { vertical: boolean; at: number; s0: number; s1: number }][] = [];
  const minShared = o.doorWidth + 2 * o.doorMargin + 0.4;
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      if (linked.has(key(a, b))) continue;
      const wall = sharedWall(rects[a], rects[b]);
      if (wall && wall.s1 - wall.s0 >= minShared) extra.push([a, b, wall]);
    }
  }
  rng.shuffle(extra);
  for (const [a, b, wall] of extra.slice(0, Math.round(o.rooms * o.loopRatio))) doors.push(makeDoor(a, b, wall, o, rng));

  return renumber({ rects, parent, doors });
}

/** 最初の部屋から扉をたどる幅優先の順に並べ直す（隣は北から時計回り） */
function renumber(m: GenMap): GenMap {
  const n = m.rects.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const d of m.doors) {
    adj[d.a].push(d.b);
    adj[d.b].push(d.a);
  }
  const center = (r: Rect): [number, number] => [r.x + r.w / 2, r.z + r.d / 2];
  const order: number[] = [0];
  const seen = new Set([0]);
  for (let i = 0; i < order.length; i++) {
    const [cx, cz] = center(m.rects[order[i]]);
    const next = adj[order[i]]
      .filter((j) => !seen.has(j))
      .map((j) => {
        const [x, z] = center(m.rects[j]);
        // 北（-z）から時計回りの角度
        return { j, ang: (Math.atan2(x - cx, -(z - cz)) + Math.PI * 2) % (Math.PI * 2) };
      })
      .sort((p, q) => p.ang - q.ang);
    for (const { j } of next) {
      seen.add(j);
      order.push(j);
    }
  }
  if (order.length !== n) throw new Error('つながっていない部屋がある');
  const to = new Array<number>(n);
  order.forEach((old, i) => (to[old] = i));
  return {
    rects: order.map((old) => m.rects[old]),
    parent: order.map((old) => (m.parent[old] < 0 ? -1 : to[m.parent[old]])),
    doors: m.doors.map((d) => ({ ...d, a: to[d.a], b: to[d.b] })),
  };
}
