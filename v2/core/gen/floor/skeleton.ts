/**
 * フロアの骨組み（v2-plan.md 4.2・gimmicks-and-structures.md 2.1）: 区画の格子（[QR] と同じ考え方）の上に、
 * どの区画を使い、どれとどれをつなぐかを決める。位置・大きさはまだ決めない（geometry.ts）。
 *
 * 型（PatternId）:
 * - grid: 全部の区画を深さ優先で迷路状につなぎ、ループを足す [QR F01]
 * - maze: grid と同じつなぎ方で、曲がり角（junction）が多い狭い通路の網（部屋が少ない）[QR loopMaze / serviceMaze]。
 *   出口の階段が複数あり、それぞれ行き先が違う [F32]
 * - comb: 真ん中の行が背骨の廊下。ほかの行の部屋は背骨にだけつながる（行き止まりの小部屋が並ぶ）[F09 櫛形]
 * - ring: 外周を一周できる。内側の区画は外周から枝分かれ [F10 環状]
 * - hub: 中央の広間から十字に廊下が伸び、先に部屋がある [F08 ハブ]
 * - linear: 一列（か 2 列）に並べ、狭く長い通路と広い空間を交互に [F25 緊張と解放]
 * - 段階 4 で足した型は patterns.ts（くねる部屋の連なり・中庭・二重ループ・同心円・縦に積んだビル …）
 * 入口は手前の行（row 0）、出口は入口から最も遠い区画。
 *
 * 段階 4 で足した骨組みの性質:
 * - 階（story）: 区画は (列, 行, 階) の格子。階 s の床は -s × structure.storyHeightM（入口の階が上、下へ降りていく）。
 *   ふつうの型は 1 階だけ
 * - 区画の作り（style）: 区画いっぱいの部屋（full）・中庭・吹き抜け・巨大空間・入れ子 …（geometry.ts と shapes/styles.ts）
 * - つなぎの作り（SkelLink.style）: 廊下（既定）・壁 1 枚の扉（direct）・屋外の渡り廊下・橋・飛び降り・一方通行の扉・裏の通路 …
 * - 窓（windows）: 通れない、見えるだけのつなぎ（中庭の窓・出口の見える窓）
 */
import type { Tuning } from '../../config/tuning.ts';
import type { Rng } from '../../math/rng.ts';
import type { FloorProfile } from './profile.ts';
import { addMazeExits, buildPatternSkeleton } from './patterns.ts';

export type NodeKind = 'room' | 'junction' | 'hall' | 'none' | 'well';

/**
 * 区画の作り（geometry.ts / shapes/styles.ts が読む）:
 * full 区画いっぱいの部屋（隣の部屋と壁 1 枚で接する）/ courtyard 屋外の中庭 / void 吹き抜けの縦穴とまわりの回廊 /
 * mega 巨大空間（中に建物）/ nest 入れ子の部屋 / gallery 中二階のある広間 / glassFloor ガラスの床の曲がり角（立体交差の上）/
 * underpass 立体交差の下の曲がり角（天井が抜けて上が見える）/ lobby エレベーターホール / platform 駅のホーム /
 * island 島の部屋（下は奈落か水）/ staff 裏の通路の曲がり角・部屋 / old 古い区画（同心円の内側）
 */
export type NodeStyle = 'full' | 'courtyard' | 'void' | 'mega' | 'nest' | 'gallery' | 'glassFloor' | 'underpass' | 'lobby' | 'platform' | 'island' | 'staff' | 'old';

export interface SkelNode {
  id: number;
  col: number;
  row: number;
  kind: NodeKind;
  /** 高さの段（0 が基準。段差は floor.levelHeightM） */
  level: number;
  /** 広間の組（同じ組の区画は 1 つの大部屋になる）。階をまたぐ組は背の高い 1 つの区画（中二階の広間） */
  hall: number;
  /** 階（0 が入口の階）。高さは -story × structure.storyHeightM */
  story: number;
  style?: NodeStyle;
  /** 区画の系統（profile.families の番号。無ければ 0 = フロアの系統） */
  fam?: number;
  /** 古さ 0..1（同心円の内側ほど 1。暗く・狭く・古い材質に） */
  age?: number;
  /** 階段室の組（同じ組の区画は、階をまたぐ 1 つの階段室） */
  well?: number;
}

/**
 * つなぎの作り: corridor 廊下（既定）/ direct 隣り合う区画の壁の扉（廊下なし）/ walkway 屋外の渡り廊下（手すり・霧）/
 * bridge 奈落の上の橋 / drop 飛び降りる段差（上へは戻れない。from が上の区画）/ oneWay 一方通行の扉（from の側からだけ開く）/
 * staff 裏の通路（狭い・設備の色）/ narrow 狭い通路（幅・高さは width / height）
 */
export type LinkStyle = 'corridor' | 'direct' | 'walkway' | 'bridge' | 'drop' | 'oneWay' | 'staff' | 'narrow';

export interface SkelLink {
  a: number;
  b: number;
  style?: LinkStyle;
  /** drop: 上の区画 / oneWay: 開けられる側の区画 */
  from?: number;
  /** 廊下の幅・天井の高さ（m。無ければ系統の値） */
  width?: number;
  height?: number;
}

export interface Skeleton {
  cols: number;
  rows: number;
  /** 階の数（無ければ 1） */
  stories: number;
  nodes: SkelNode[];
  links: SkelLink[];
  entry: number;
  exit: number;
  /** 入口 → 出口の区画の並び */
  main: number[];
  /** 見えるだけのつなぎ（窓。通れない） */
  windows: SkelLink[];
  /** 本来の出口のほかの出口（迷路フロア）: 区画と行き先のフロア（'depth.variant'） */
  extraExits: { node: number; to: string }[];
  /** 鏡写し（列の真ん中で左右対称）。geometry.ts が左右で同じ大きさにする */
  mirror?: boolean;
  /** 入口から出口へ行くのに必ず通る区画（F11 同心円の中心）。隠しの通り抜けは、ここを通らずに行き来できる 2 つの所をつながない */
  mustPass?: number[];
  /** 天井裏の這う網の点検口のある部屋（geometry.ts / shapes/crawl.ts） */
  hatches?: number[];
  /** 骨組みの型が決めたもの: 出口・高さの段・広間（決めていれば後でいじらない） */
  fixedExit?: boolean;
  /** 出口を置く階（無ければどの階でも） */
  exitStory?: number;
  fixedLevels?: boolean;
  noRandomHalls?: boolean;
  /** 島と橋の下（奈落か水） */
  below?: 'void' | 'water';
}

const id = (cols: number, c: number, r: number): number => r * cols + c;

/** 区画の番号（階を含む） */
export function nodeId(sk: Pick<Skeleton, 'cols' | 'rows'>, c: number, r: number, s = 0): number {
  return s * sk.cols * sk.rows + r * sk.cols + c;
}

/** 同じ階の上下左右の区画 */
export function neighbors(sk: Pick<Skeleton, 'cols' | 'rows'>, n: number): number[] {
  const per = sk.cols * sk.rows;
  const base = Math.floor(n / per) * per;
  const k = n - base;
  const c = k % sk.cols, r = Math.floor(k / sk.cols);
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

export type LinkFn = (a: number, b: number, style?: LinkStyle, extra?: Partial<SkelLink>) => void;

export function buildSkeleton(p: FloorProfile, rng: Rng, t: Tuning): Skeleton {
  const { cols, rows } = p;
  const stories = Math.max(1, p.stories ?? 1);
  const nodes: SkelNode[] = [];
  for (let s = 0; s < stories; s++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) nodes.push({ id: s * cols * rows + id(cols, c, r), col: c, row: r, kind: 'room', level: 0, hall: -1, story: s });
  const sk: Skeleton = { cols, rows, stories, nodes, links: [], entry: id(cols, Math.floor(cols / 2), 0), exit: -1, main: [], windows: [], extraExits: [] };
  const link: LinkFn = (a, b, style, extra) => {
    if (a === b || linked(sk, a, b)) return;
    const l: SkelLink = { a, b, ...(extra ?? {}) };
    if (style && style !== 'corridor') l.style = style;
    sk.links.push(l);
  };

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
      // 段階 4（F25 の強め）: 曲がり角につながる廊下は狭く低い通路、部屋は天井の高い広い空間
      tensionAndRelease(sk, rng.fork('tension'), t);
      break;
    }
    default:
      buildPatternSkeleton(sk, p, rng, t, link);
      break;
  }

  // 入口から届かない区画は使わない
  const d0 = bfs(sk, sk.entry);
  for (const n of nodes) if (d0[n.id] < 0) n.kind = 'none';
  sk.links = sk.links.filter((l) => nodes[l.a]!.kind !== 'none' && nodes[l.b]!.kind !== 'none');
  sk.windows = sk.windows.filter((l) => nodes[l.a]!.kind !== 'none' && nodes[l.b]!.kind !== 'none');

  // 広間: 隣り合う部屋を 2×1 / 2×2 にまとめる（つなぎがあれば）
  if (!sk.noRandomHalls) {
    let hallId = Math.max(0, ...nodes.map((n) => n.hall)) + 1;
    const plain = (x: SkelNode): boolean => !x.style || x.style === 'full';
    for (const n of rng.shuffle(nodes.filter((x) => x.kind === 'room' && x.id !== sk.entry))) {
      if (n.kind !== 'room' || !plain(n) || !rng.chance(p.family.hallChance)) continue;
      const right = n.col + 1 < cols ? nodes[n.id + 1] : undefined;
      const down = n.row + 1 < rows ? nodes[n.id + cols] : undefined;
      const cand = [right, down].filter((m): m is SkelNode => !!m && m.kind === 'room' && m.style === n.style && m.id !== sk.entry && linked(sk, n.id, m.id) && sameLinkKind(sk, n.id, m.id));
      if (!cand.length) continue;
      const m = rng.pick(cand);
      n.kind = 'hall'; m.kind = 'hall';
      n.hall = hallId; m.hall = hallId;
      hallId++;
    }
  }
  if (!sk.fixedExit) {
    // 出口: 外周の区画のうち、入口から最も遠いもの（出口の階段を外側に付けるため外周に限る）。奥の辺（最後の行）を少し優先
    const dist = bfs(sk, sk.entry);
    const boundary = (n: SkelNode): boolean => n.row === rows - 1 || n.col === 0 || n.col === cols - 1 || (n.row === 0 && n.id !== sk.entry);
    let best = -1;
    let bestScore = -1;
    for (const n of nodes) {
      if (n.kind === 'none' || n.kind === 'well' || n.id === sk.entry || dist[n.id] < 0 || !boundary(n) || n.kind === 'hall' || (n.style && SPECIAL_STYLES.has(n.style))) continue;
      if (sk.exitStory !== undefined && n.story !== sk.exitStory) continue;
      const score = dist[n.id] + (n.row === rows - 1 ? 0.5 : 0);
      if (score > bestScore) { bestScore = score; best = n.id; }
    }
    sk.exit = best >= 0 ? best : sk.entry;
  }
  if (nodes[sk.exit]!.kind === 'junction') nodes[sk.exit]!.kind = 'room';
  sk.main = pathBetween(sk, sk.entry, sk.exit);
  // 段階 4（F32 迷路フロア）: 出口が複数（それぞれ行き先が違う）
  if (p.pattern === 'maze') addMazeExits(sk, p, rng.fork('exits'), t);

  // 高さの段: つなぎごとに levelChance で段差（同じ広間の中は同じ段）。入口からの木で決める
  if (!sk.fixedLevels) assignLevels(sk, rng, p.family.levelChance);
  return sk;
}

/** 出口・広間にしない区画の作り（形そのものが見どころの区画） */
export const SPECIAL_STYLES: ReadonlySet<NodeStyle> = new Set<NodeStyle>(['courtyard', 'void', 'mega', 'nest', 'gallery', 'glassFloor', 'underpass', 'lobby', 'platform']);

/** 2 つの区画の間のつなぎが、ふつうの廊下か（壁 1 枚の扉・窓などの区画は広間にまとめない） */
function sameLinkKind(sk: Skeleton, a: number, b: number): boolean {
  const l = sk.links.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  return !!l && (!l.style || l.style === 'direct');
}

export function spanningTree(sk: Skeleton, rng: Rng, start: number, link: LinkFn, ok: (n: number) => boolean = () => true, style?: LinkStyle, okEdge?: (a: number, b: number) => boolean): void {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const n = stack[stack.length - 1]!;
    const opts = neighbors(sk, n).filter((m) => !seen.has(m) && ok(m) && (!okEdge || okEdge(n, m)));
    if (!opts.length) { stack.pop(); continue; }
    const m = rng.pick(opts);
    link(n, m, style);
    seen.add(m);
    stack.push(m);
  }
}

export function addLoops(sk: Skeleton, rng: Rng, count: number, link: LinkFn, ok: (a: number, b: number) => boolean = () => true, style?: LinkStyle): void {
  const cand: [number, number][] = [];
  for (const n of sk.nodes) for (const m of neighbors(sk, n.id)) if (m > n.id && !linked(sk, n.id, m) && ok(n.id, m)) cand.push([n.id, m]);
  rng.shuffle(cand);
  for (const [a, b] of cand.slice(0, count)) link(a, b, style);
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
  // 段階 4（フロアの形の担当が直した）: 広間の区画が、広間の外から先に別々の段で届いたとき、広間の中で段がばらばらになっていた
  // （広間の床はいちばん低い段なので、高い段の区画の開口が床から浮いて上れない）。広間は、入口からいちばん先に届いた区画の段にそろえる
  const hallLevel = new Map<number, number>();
  for (const id of q) { const v = sk.nodes[id]!; if (v.hall >= 0 && !hallLevel.has(v.hall)) hallLevel.set(v.hall, v.level); }
  for (const v of sk.nodes) { const l = v.hall >= 0 ? hallLevel.get(v.hall) : undefined; if (l !== undefined) v.level = l; }
}

/**
 * F25 緊張と解放（段階 3 の linear を強めた）: 曲がり角（狭い所）につながる廊下は、幅の狭い低い通路にする。
 * 部屋（広い所）は geometry.ts が天井の高い広い空間にする（style なしの linear の部屋）
 */
function tensionAndRelease(sk: Skeleton, rng: Rng, t: Tuning): void {
  for (const l of sk.links) {
    const a = sk.nodes[l.a]!, b = sk.nodes[l.b]!;
    if (a.row !== 0 || b.row !== 0) continue;
    if (a.kind === 'junction' || b.kind === 'junction') {
      l.style = 'narrow';
      l.width = t['structure.linear.narrowWidthM'];
      l.height = t['structure.linear.narrowHeightM'] + rng.float(-0.05, 0.05);
    }
  }
}
