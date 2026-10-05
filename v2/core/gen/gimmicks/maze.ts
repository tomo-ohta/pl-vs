/**
 * 格子の迷路と、向きのある網（導く光の迷路・一方通行の歩道迷路・細い梁の網が使う）。どれも乱数 rng だけで決まる。
 * 升目の番号は k * nx + i（i: x の向き、k: z の向き）。
 */
import type { Rng } from '../../math/rng.ts';

/** 升目 c の隣（格子の中だけ） */
export function gridNeighbors(nx: number, nz: number, c: number): number[] {
  const i = c % nx, k = (c - i) / nx;
  const out: number[] = [];
  if (i + 1 < nx) out.push(c + 1);
  if (i > 0) out.push(c - 1);
  if (k + 1 < nz) out.push(c + nx);
  if (k > 0) out.push(c - nx);
  return out;
}

/** 無向の辺の鍵（小さい番号が先） */
export const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * 完全迷路（どの 2 升目の間も道が 1 本だけ）: 深さ優先で掘る（長い通路と行き止まりができる）。
 * 戻り値は開いている辺の鍵の集合
 */
export function carveMaze(nx: number, nz: number, start: number, rng: Rng): Set<string> {
  const open = new Set<string>();
  const seen = new Uint8Array(nx * nz);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1]!;
    const next = rng.shuffle(gridNeighbors(nx, nz, c).filter((n) => !seen[n]));
    if (!next.length) { stack.pop(); continue; }
    const n = next[0]!;
    seen[n] = 1;
    open.add(edgeKey(c, n));
    stack.push(n);
  }
  return open;
}

/** 開いた辺で a から b までの最短の升目の並び（届かなければ null） */
export function mazePath(nx: number, nz: number, open: ReadonlySet<string>, a: number, b: number): number[] | null {
  const prev = new Int32Array(nx * nz).fill(-1);
  prev[a] = a;
  const q = [a];
  for (let h = 0; h < q.length && prev[b]! < 0; h++) {
    const c = q[h]!;
    for (const n of gridNeighbors(nx, nz, c)) if (prev[n]! < 0 && open.has(edgeKey(c, n))) { prev[n] = c; q.push(n); }
  }
  if (prev[b]! < 0) return null;
  const out = [b];
  for (let c = b; c !== a; c = prev[c]!) out.unshift(prev[c]!);
  return out;
}

/** 升目の開いた辺の数 */
export function openDegree(nx: number, nz: number, open: ReadonlySet<string>, c: number): number {
  return gridNeighbors(nx, nz, c).filter((n) => open.has(edgeKey(c, n))).length;
}

/** 開いた辺の木の上で、集合 from からの升目ごとの距離（届かない升目は -1） */
export function treeDistance(nx: number, nz: number, open: ReadonlySet<string>, from: readonly number[]): Int32Array {
  const d = new Int32Array(nx * nz).fill(-1);
  const q = [...from];
  for (const c of from) d[c] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    for (const n of gridNeighbors(nx, nz, c)) if (d[n]! < 0 && open.has(edgeKey(c, n))) { d[n] = d[c]! + 1; q.push(n); }
  }
  return d;
}

// ---------------------------------------------------------------- 向きのある網（一方通行の歩道）

/** 向きのある辺の集合（`a>b` は a から b へ流れる） */
export type Arcs = Set<string>;
export const arcKey = (a: number, b: number): string => `${a}>${b}`;

/** 向きのある網で from から行ける升目 */
export function reachFrom(n: number, arcs: ReadonlySet<string>, from: number, reverse = false): Uint8Array {
  const out = new Map<number, number[]>();
  for (const k of arcs) {
    const [a, b] = k.split('>').map(Number) as [number, number];
    const [p, q] = reverse ? [b, a] : [a, b];
    out.set(p, [...(out.get(p) ?? []), q]);
  }
  const seen = new Uint8Array(n);
  seen[from] = 1;
  const q = [from];
  for (let h = 0; h < q.length; h++) for (const m of out.get(q[h]!) ?? []) if (!seen[m]) { seen[m] = 1; q.push(m); }
  return seen;
}

/** どの升目からもどの升目へも行ける（強連結）か */
export function stronglyConnected(n: number, arcs: ReadonlySet<string>, nodes: readonly number[]): boolean {
  if (!nodes.length) return true;
  const f = reachFrom(n, arcs, nodes[0]!), b = reachFrom(n, arcs, nodes[0]!, true);
  return nodes.every((c) => f[c] && b[c]);
}

/** 向きのある網で a から b への最短の升目の並び（届かなければ null） */
export function arcPath(n: number, arcs: ReadonlySet<string>, a: number, b: number): number[] | null {
  const out = new Map<number, number[]>();
  for (const k of arcs) { const [p, q] = k.split('>').map(Number) as [number, number]; out.set(p, [...(out.get(p) ?? []), q]); }
  const prev = new Int32Array(n).fill(-1);
  prev[a] = a;
  const q = [a];
  for (let h = 0; h < q.length && prev[b]! < 0; h++) for (const m of out.get(q[h]!) ?? []) if (prev[m]! < 0) { prev[m] = q[h]!; q.push(m); }
  if (prev[b]! < 0) return null;
  const path = [b];
  for (let c = b; c !== a; c = prev[c]!) path.unshift(prev[c]!);
  return path;
}

/**
 * 格子の上の一方通行の網（一方通行の歩道迷路）を作る。
 * - 正しい道順（入口 e → 出口 x の、自分と交わらない道）の辺は前向き
 * - 道順の外の升目は、入口へ向かって流れる木にする（間違えた帯に乗ると、どこを選んでも入口へ戻される）。
 *   道順に囲まれて入口へ流せない升目は、近い道順の升目へ流す
 * - 道順の升目から外への辺は外向き（分かれ目で間違える帯）。道順どうしの飛び越しは後ろ向き（戻される帯）
 * - 残りの辺は一部を柵で塞ぐ（blockChance）
 * 条件: 強連結（閉じ込めない。どの升目からも入口・出口へ行ける）・道順の分かれ目が minChoices 以上。満たさなければ null
 */
export interface BeltNet { arcs: Arcs; route: number[]; blocked: Set<string> }
export function beltNet(nx: number, nz: number, e: number, x: number, rng: Rng, o: { blockChance: number; minChoices: number; tries?: number }): BeltNet | null {
  const n = nx * nz;
  const all: number[] = [...Array(n).keys()];
  const manh = Math.abs((e % nx) - (x % nx)) + Math.abs(Math.floor(e / nx) - Math.floor(x / nx));
  for (let t = 0; t < (o.tries ?? 40); t++) {
    const r = rng.fork(t);
    // 道順: 自分と交わらない道を何本か引き、長すぎず短すぎないものを選ぶ（升目の半分くらいまで）
    let route: number[] | null = null;
    let bestScore = Infinity;
    for (let c = 0; c < 10; c++) {
      const p = randomSimplePath(nx, nz, e, x, r.fork(`p${c}`));
      if (!p) continue;
      const len = p.length - 1;
      const want = Math.min(Math.max(manh + 2, Math.round(n * 0.35)), Math.max(manh, Math.floor(n * 0.6)));
      const score = Math.abs(len - want) + (len > n * 0.65 ? 50 : 0);
      if (score < bestScore) { bestScore = score; route = p; }
    }
    if (!route) continue;
    const onRoute = new Map(route.map((c, i) => [c, i] as const));
    const arcs: Arcs = new Set();
    const used = new Set<string>();
    for (let i = 1; i < route.length; i++) { arcs.add(arcKey(route[i - 1]!, route[i]!)); used.add(edgeKey(route[i - 1]!, route[i]!)); }
    // 入口へ流れる木（道順の外の升目。道順の辺は使わない）
    const depth = new Int32Array(n).fill(-1);
    depth[e] = 0;
    const q = [e];
    for (let h = 0; h < q.length; h++) {
      const c = q[h]!;
      for (const m of r.shuffle(gridNeighbors(nx, nz, c))) {
        if (depth[m]! >= 0 || onRoute.has(m)) continue;
        depth[m] = depth[c]! + 1;
        arcs.add(arcKey(m, c));
        used.add(edgeKey(m, c));
        q.push(m);
      }
    }
    // 囲まれた升目: 道順の升目（出口を除く）から外へ広げ、そこへ流す
    const pocket = new Int32Array(n).fill(-1);
    const pq: number[] = [];
    for (const c of route) if (c !== x) { pocket[c] = 0; pq.push(c); }
    for (let h = 0; h < pq.length; h++) {
      const c = pq[h]!;
      for (const m of r.shuffle(gridNeighbors(nx, nz, c))) {
        if (depth[m]! >= 0 || onRoute.has(m) || pocket[m]! >= 0) continue;
        pocket[m] = pocket[c]! + 1;
        arcs.add(arcKey(m, c));
        used.add(edgeKey(m, c));
        pq.push(m);
      }
    }
    const blocked = new Set<string>();
    // 残りの辺
    for (const c of all) {
      for (const m of gridNeighbors(nx, nz, c)) {
        if (m < c) continue;
        const k = edgeKey(c, m);
        if (used.has(k)) continue;
        const rc = onRoute.get(c), rm = onRoute.get(m);
        if (rc !== undefined && rm !== undefined) {
          // 道順どうしの飛び越し: 後ろへ戻される帯（先の升目 → 手前の升目）
          if (r.chance(o.blockChance)) { blocked.add(k); continue; }
          arcs.add(rc > rm ? arcKey(c, m) : arcKey(m, c));
        } else if (rc !== undefined || rm !== undefined) {
          // 道順から外へ: 分かれ目の間違いの帯（出口からの辺は、戻る道として外向き）
          const [from, to] = rc !== undefined ? [c, m] : [m, c];
          if (from === e) { arcs.add(arcKey(to, from)); continue; } // 入口へは流れ込むだけ
          if (r.chance(o.blockChance * 0.5)) { blocked.add(k); continue; }
          arcs.add(arcKey(from, to));
        } else {
          // 道順の外どうし: 入口に近い方へ（同じなら乱数）
          if (r.chance(o.blockChance)) { blocked.add(k); continue; }
          const dc = depth[c]! >= 0 ? depth[c]! : 1000 + pocket[c]!, dm = depth[m]! >= 0 ? depth[m]! : 1000 + pocket[m]!;
          arcs.add(dc > dm || (dc === dm && r.chance(0.5)) ? arcKey(c, m) : arcKey(m, c));
        }
      }
    }
    // 直す: 入口から行けない床・入口へ戻れない床があれば、木でも道順でもない辺（帯・柵）の向きを変えてつなぐ
    // （行ける床 → 行けない床 / 戻れない床 → 戻れる床）。木の辺は変えないので、入口へ流れ戻る道はそのまま残る
    for (let guard = 0; guard < n * 3; guard++) {
      const f = reachFrom(n, arcs, e), bk = reachFrom(n, arcs, e, true);
      let fixed = false;
      for (const c of r.shuffle([...all])) {
        for (const m of gridNeighbors(nx, nz, c)) {
          const k = edgeKey(c, m);
          if (used.has(k)) continue;
          const set = (p: number, q: number): void => { arcs.delete(arcKey(q, p)); arcs.add(arcKey(p, q)); blocked.delete(k); fixed = true; };
          if (f[c] && !f[m] && !arcs.has(arcKey(c, m))) set(c, m);
          else if (!bk[c] && bk[m] && !arcs.has(arcKey(c, m))) set(c, m);
          if (fixed) break;
        }
        if (fixed) break;
      }
      if (!fixed) break;
    }
    if (!stronglyConnected(n, arcs, all)) continue;
    // 分かれ目（道順の上で出ていく帯が 2 本以上の升目）
    let choices = 0;
    for (const c of route) if (c !== x && [...arcs].filter((k) => k.startsWith(`${c}>`)).length >= 2) choices++;
    if (choices < o.minChoices) continue;
    return { arcs, route, blocked };
  }
  return null;
}

/** e から x への、自分と交わらない道（深さ優先。行き詰まったら戻る）。見つからなければ null */
function randomSimplePath(nx: number, nz: number, e: number, x: number, rng: Rng): number[] | null {
  const seen = new Uint8Array(nx * nz);
  const path = [e];
  seen[e] = 1;
  const options: number[][] = [rng.shuffle(gridNeighbors(nx, nz, e))];
  let guard = 0;
  while (path.length && guard++ < 20000) {
    const c = path[path.length - 1]!;
    if (c === x) return path;
    const opts = options[options.length - 1]!;
    const m = opts.pop();
    if (m === undefined) { seen[c] = 0; path.pop(); options.pop(); continue; }
    if (seen[m]) continue;
    seen[m] = 1;
    path.push(m);
    // 出口に近い向きを少しだけ先に試す（長すぎる道を減らす）
    const next = rng.shuffle(gridNeighbors(nx, nz, m));
    if (rng.chance(0.5)) next.sort((a, b) => dist(nx, b, x) - dist(nx, a, x));
    options.push(next);
  }
  return null;
}

const dist = (nx: number, a: number, b: number): number => Math.abs((a % nx) - (b % nx)) + Math.abs(Math.floor(a / nx) - Math.floor(b / nx));
