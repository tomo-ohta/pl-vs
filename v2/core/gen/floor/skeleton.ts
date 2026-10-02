/**
 * フロアの骨組み（v2-plan.md 4.2・gimmicks-and-structures.md 2.1）: 区画の格子（[QR] と同じ考え方）の上に、
 * どの区画を使い、どれとどれをつなぐかを決める。位置・大きさはまだ決めない（geometry.ts）。
 *
 * 型（PatternId）:
 * - grid: 全部の区画を深さ優先で迷路状につなぎ、ループを足す [QR F01]
 * - maze: grid と同じつなぎ方で、曲がり角（junction）が多い狭い通路の網（部屋が少ない）[QR loopMaze / serviceMaze]
 * - comb: 真ん中の行が背骨の廊下。ほかの行の部屋は背骨にだけつながる（行き止まりの小部屋が並ぶ）[F09 櫛形]
 * - ring: 外周を一周できる。内側の区画は外周から枝分かれ [F10 環状]
 * - hub: 中央の広間から十字に廊下が伸び、先に部屋がある [F08 ハブ]
 * - linear: 一列（か 2 列）に並べ、広い所と狭い所を交互に [F25 緊張と解放]
 * 入口は手前の行（row 0）、出口は入口から最も遠い区画。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { Rng } from '../../math/rng.ts';
import type { FloorProfile } from './profile.ts';

export type NodeKind = 'room' | 'junction' | 'hall' | 'none';

export interface SkelNode {
  id: number;
  col: number;
  row: number;
  kind: NodeKind;
  /** 高さの段（0 が基準。段差は floor.levelHeightM） */
  level: number;
  /** 広間の組（同じ組の区画は 1 つの大部屋になる） */
  hall: number;
}

export interface SkelLink { a: number; b: number }

export interface Skeleton {
  cols: number;
  rows: number;
  nodes: SkelNode[];
  links: SkelLink[];
  entry: number;
  exit: number;
  /** 入口 → 出口の区画の並び */
  main: number[];
}

const id = (cols: number, c: number, r: number): number => r * cols + c;

export function neighbors(sk: Pick<Skeleton, 'cols' | 'rows'>, n: number): number[] {
  const c = n % sk.cols, r = Math.floor(n / sk.cols);
  const out: number[] = [];
  if (c > 0) out.push(n - 1);
  if (c < sk.cols - 1) out.push(n + 1);
  if (r > 0) out.push(n - sk.cols);
  if (r < sk.rows - 1) out.push(n + sk.cols);
  return out;
}

export function linked(sk: Skeleton, a: number, b: number): boolean {
  return sk.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
}

export function adjacency(sk: Skeleton): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const n of sk.nodes) if (n.kind !== 'none') m.set(n.id, []);
  for (const l of sk.links) { m.get(l.a)?.push(l.b); m.get(l.b)?.push(l.a); }
  return m;
}

/** 幅優先の距離（つながっていない区画は -1） */
export function bfs(sk: Skeleton, from: number): number[] {
  const adj = adjacency(sk);
  const dist = new Array(sk.nodes.length).fill(-1);
  dist[from] = 0;
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const n = q[h]!;
    for (const m of adj.get(n) ?? []) if (dist[m] < 0) { dist[m] = dist[n] + 1; q.push(m); }
  }
  return dist;
}

export function pathBetween(sk: Skeleton, from: number, to: number): number[] {
  const adj = adjacency(sk);
  const prev = new Map<number, number>([[from, from]]);
  const q = [from];
  for (let h = 0; h < q.length && !prev.has(to); h++) {
    for (const m of adj.get(q[h]!) ?? []) if (!prev.has(m)) { prev.set(m, q[h]!); q.push(m); }
  }
  if (!prev.has(to)) return [];
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev.get(path[path.length - 1]!)!);
  return path.reverse();
}

export function buildSkeleton(p: FloorProfile, rng: Rng, t: Tuning): Skeleton {
  const { cols, rows } = p;
  const nodes: SkelNode[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) nodes.push({ id: id(cols, c, r), col: c, row: r, kind: 'room', level: 0, hall: -1 });
  const sk: Skeleton = { cols, rows, nodes, links: [], entry: id(cols, Math.floor(cols / 2), 0), exit: -1, main: [] };
  const link = (a: number, b: number): void => { if (a !== b && !linked(sk, a, b)) sk.links.push({ a, b }); };

  switch (p.pattern) {
    case 'grid':
    case 'maze': {
      spanningTree(sk, rng, sk.entry, link);
      addLoops(sk, rng, Math.round((t['floor.loopsPer10'] * nodes.length) / 10) + (p.pattern === 'maze' ? 2 : 0), link);
      const jc = p.pattern === 'maze' ? 0.75 : t['floor.junctionChance'];
      for (const n of nodes) if (n.id !== sk.entry && rng.chance(jc)) n.kind = 'junction';
      break;
    }
    case 'comb': {
      // 背骨: 真ん中の行（入口から背骨までは縦につなぐ）
      const spine = Math.max(1, Math.floor(rows / 2));
      for (let c = 0; c + 1 < cols; c++) link(id(cols, c, spine), id(cols, c + 1, spine));
      for (let c = 0; c < cols; c++) nodes[id(cols, c, spine)]!.kind = rng.chance(0.7) ? 'junction' : 'room';
      for (let c = 0; c < cols; c++) {
        // 背骨の手前と奥へ、部屋の列を枝で伸ばす（途中で止まることがある）
        for (const dir of [-1, 1]) {
          let prev = id(cols, c, spine);
          for (let r = spine + dir; r >= 0 && r < rows; r += dir) {
            if (r !== 0 && !rng.chance(r === spine + dir ? 0.92 : 0.55)) { for (let rr = r; rr >= 0 && rr < rows; rr += dir) nodes[id(cols, c, rr)]!.kind = 'none'; break; }
            link(prev, id(cols, c, r));
            prev = id(cols, c, r);
          }
        }
      }
      // 入口の列は必ず背骨まで通す
      for (let r = 0; r < spine; r++) { nodes[id(cols, Math.floor(cols / 2), r)]!.kind = r === 0 ? 'room' : 'junction'; link(id(cols, Math.floor(cols / 2), r), id(cols, Math.floor(cols / 2), r + 1)); }
      break;
    }
    case 'ring': {
      // 外周を一周
      const ring: number[] = [];
      for (let c = 0; c < cols; c++) ring.push(id(cols, c, 0));
      for (let r = 1; r < rows; r++) ring.push(id(cols, cols - 1, r));
      for (let c = cols - 2; c >= 0; c--) ring.push(id(cols, c, rows - 1));
      for (let r = rows - 2; r >= 1; r--) ring.push(id(cols, 0, r));
      for (let i = 0; i < ring.length; i++) link(ring[i]!, ring[(i + 1) % ring.length]!);
      for (const n of ring) if (rng.chance(0.55)) nodes[n]!.kind = 'junction';
      // 角は曲がり角
      for (const [c, r] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]] as const) nodes[id(cols, c, r)]!.kind = 'junction';
      // 内側: 外周から枝
      const inner = nodes.filter((n) => n.col > 0 && n.col < cols - 1 && n.row > 0 && n.row < rows - 1);
      for (const n of inner) n.kind = 'none';
      for (const n of rng.shuffle([...inner])) {
        const opts = neighbors(sk, n.id).filter((m) => nodes[m]!.kind !== 'none');
        if (opts.length && rng.chance(0.75)) { n.kind = 'room'; link(n.id, rng.pick(opts)); }
      }
      nodes[sk.entry]!.kind = 'room';
      break;
    }
    case 'hub': {
      const cc = Math.floor(cols / 2), cr = Math.floor(rows / 2);
      for (const n of nodes) n.kind = 'none';
      const hub = id(cols, cc, cr);
      nodes[hub]!.kind = 'hall';
      nodes[hub]!.hall = 0;
      // 十字の腕
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        let prev = hub;
        for (let k = 1; ; k++) {
          const c = cc + dc * k, r = cr + dr * k;
          if (c < 0 || r < 0 || c >= cols || r >= rows) break;
          const n = id(cols, c, r);
          const end = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
          nodes[n]!.kind = end ? 'room' : 'junction';
          link(prev, n);
          prev = n;
        }
      }
      // 腕の脇の部屋
      for (const n of nodes) {
        if (n.kind !== 'none') continue;
        const opts = neighbors(sk, n.id).filter((m) => nodes[m]!.kind === 'junction');
        if (opts.length && rng.chance(0.6)) { n.kind = 'room'; link(n.id, rng.pick(opts)); }
      }
      break;
    }
    case 'linear': {
      for (let c = 0; c + 1 < cols; c++) link(id(cols, c, 0), id(cols, c + 1, 0));
      // 狭い所（曲がり角）と広い所（部屋・広間）を交互に
      for (let c = 0; c < cols; c++) nodes[id(cols, c, 0)]!.kind = c % 2 === 0 ? 'room' : 'junction';
      if (rows > 1) for (let c = 0; c < cols; c++) {
        const n = id(cols, c, 1);
        if (rng.chance(0.45)) link(id(cols, c, 0), n); else nodes[n]!.kind = 'none';
      }
      sk.entry = id(cols, 0, 0);
      break;
    }
  }

  // 入口から届かない区画は使わない
  const d0 = bfs(sk, sk.entry);
  for (const n of nodes) if (d0[n.id] < 0) n.kind = 'none';
  sk.links = sk.links.filter((l) => nodes[l.a]!.kind !== 'none' && nodes[l.b]!.kind !== 'none');

  // 広間: 隣り合う部屋を 2×1 / 2×2 にまとめる（つなぎがあれば）
  let hallId = Math.max(0, ...nodes.map((n) => n.hall)) + 1;
  for (const n of rng.shuffle(nodes.filter((x) => x.kind === 'room' && x.id !== sk.entry))) {
    if (n.kind !== 'room' || !rng.chance(p.family.hallChance)) continue;
    const right = n.col + 1 < cols ? nodes[n.id + 1] : undefined;
    const down = n.row + 1 < rows ? nodes[n.id + cols] : undefined;
    const cand = [right, down].filter((m): m is SkelNode => !!m && m.kind === 'room' && m.id !== sk.entry && linked(sk, n.id, m.id));
    if (!cand.length) continue;
    const m = rng.pick(cand);
    n.kind = 'hall'; m.kind = 'hall';
    n.hall = hallId; m.hall = hallId;
    hallId++;
  }
  // 出口: 外周の区画のうち、入口から最も遠いもの（出口の階段を外側に付けるため外周に限る）。奥の辺（最後の行）を少し優先
  const dist = bfs(sk, sk.entry);
  const boundary = (n: SkelNode): boolean => n.row === rows - 1 || n.col === 0 || n.col === cols - 1 || (n.row === 0 && n.id !== sk.entry);
  let best = -1;
  let bestScore = -1;
  for (const n of nodes) {
    if (n.kind === 'none' || n.id === sk.entry || dist[n.id] < 0 || !boundary(n) || n.kind === 'hall') continue;
    const score = dist[n.id] + (n.row === rows - 1 ? 0.5 : 0);
    if (score > bestScore) { bestScore = score; best = n.id; }
  }
  sk.exit = best >= 0 ? best : sk.entry;
  if (nodes[sk.exit]!.kind === 'junction') nodes[sk.exit]!.kind = 'room';
  sk.main = pathBetween(sk, sk.entry, sk.exit);

  // 高さの段: つなぎごとに levelChance で段差（同じ広間の中は同じ段）。入口からの木で決める
  assignLevels(sk, rng, p.family.levelChance);
  return sk;
}

function spanningTree(sk: Skeleton, rng: Rng, start: number, link: (a: number, b: number) => void): void {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const n = stack[stack.length - 1]!;
    const opts = neighbors(sk, n).filter((m) => !seen.has(m));
    if (!opts.length) { stack.pop(); continue; }
    const m = rng.pick(opts);
    link(n, m);
    seen.add(m);
    stack.push(m);
  }
}

function addLoops(sk: Skeleton, rng: Rng, count: number, link: (a: number, b: number) => void): void {
  const cand: [number, number][] = [];
  for (const n of sk.nodes) for (const m of neighbors(sk, n.id)) if (m > n.id && !linked(sk, n.id, m)) cand.push([n.id, m]);
  rng.shuffle(cand);
  for (const [a, b] of cand.slice(0, count)) link(a, b);
}

function assignLevels(sk: Skeleton, rng: Rng, chance: number): void {
  if (chance <= 0) return;
  const adj = adjacency(sk);
  const seen = new Set<number>([sk.entry]);
  const q = [sk.entry];
  for (let h = 0; h < q.length; h++) {
    const n = sk.nodes[q[h]!]!;
    for (const mId of adj.get(n.id) ?? []) {
      if (seen.has(mId)) continue;
      const m = sk.nodes[mId]!;
      seen.add(mId);
      q.push(mId);
      const sameHall = n.hall >= 0 && n.hall === m.hall;
      m.level = sameHall ? n.level : n.level + (rng.chance(chance) ? rng.pick([-1, 1]) : 0);
      m.level = Math.max(-2, Math.min(2, m.level));
    }
  }
}
