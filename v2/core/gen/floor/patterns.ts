/**
 * 段階 4 で足したフロアの骨組みの型（gimmicks-and-structures.md 2.1。skeleton.ts の buildSkeleton から呼ぶ）。
 * 型ごとに、区画の種類・作り（style）・つなぎ（作り・一方通行）・窓・入口と出口・高さの段を決める。
 * 形（位置・大きさ・箱）は geometry.ts と shapes/*.ts。螺旋・縮むくり返し・屋上は形を丸ごと shapes/ で作るので、ここでは決めない。
 *
 * どの型も「閉じ込めない」: 入口から出口へ、骨組みのつなぎだけで歩いて行ける（一方通行・飛び降りは出口の方へ向く）。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { Rng } from '../../math/rng.ts';
import type { FloorProfile } from './profile.ts';
import { addLoops, adjacency, bfs, linked, neighbors, nodeId, pathBetween, spanningTree, type LinkFn, type Skeleton, type SkelNode } from './skeleton.ts';

export function buildPatternSkeleton(sk: Skeleton, p: FloorProfile, rng: Rng, t: Tuning, link: LinkFn): void {
  const f = BUILDERS[p.pattern];
  if (!f) throw new Error(`骨組みの型がありません: ${p.pattern}`);
  f(sk, p, rng, t, link);
}

type Builder = (sk: Skeleton, p: FloorProfile, rng: Rng, t: Tuning, link: LinkFn) => void;

const at = (sk: Skeleton, c: number, r: number, s = 0): SkelNode => sk.nodes[nodeId(sk, c, r, s)]!;
const used = (n: SkelNode): boolean => n.kind !== 'none';

/** grid と同じ: 全部の区画の木 + ループ + 曲がり角 */
function gridLike(sk: Skeleton, rng: Rng, t: Tuning, link: LinkFn, s = 0, ok: (n: number) => boolean = () => true, start = sk.entry): void {
  const per = sk.cols * sk.rows;
  const inStory = (n: number): boolean => Math.floor(n / per) === s && ok(n);
  spanningTree(sk, rng, start, link, inStory);
  const count = Math.round((t['floor.loopsPer10'] * sk.nodes.filter((n) => inStory(n.id)).length) / 10);
  addLoops(sk, rng, count, link, (a, b) => inStory(a) && inStory(b));
  for (const n of sk.nodes) if (inStory(n.id) && n.id !== start && rng.chance(t['floor.junctionChance'])) n.kind = 'junction';
}

/** 葉（つなぎが 1 つの区画）を、確率で使わない区画にする（形の輪郭をでこぼこに）。keep は残す */
function pruneLeaves(sk: Skeleton, rng: Rng, chance: number, keep: ReadonlySet<number>): void {
  const adj = adjacency(sk);
  for (const n of rng.shuffle(sk.nodes.filter(used))) {
    if (keep.has(n.id) || (adj.get(n.id)?.length ?? 0) !== 1 || !rng.chance(chance)) continue;
    const m = adj.get(n.id)![0]!;
    if ((adj.get(m)?.length ?? 0) <= 1) continue;
    n.kind = 'none';
    sk.links = sk.links.filter((l) => l.a !== n.id && l.b !== n.id);
    adj.set(m, adj.get(m)!.filter((x) => x !== n.id));
    adj.delete(n.id);
  }
}

/** 形を丸ごと shapes/ で作る型（螺旋・縮むくり返し・屋上）: 骨組みは入口の区画だけ（使わない） */
const whole: Builder = (sk) => {
  for (const n of sk.nodes) n.kind = n.id === sk.entry ? 'room' : 'none';
  sk.exit = sk.entry;
  sk.fixedExit = true;
  sk.fixedLevels = true;
  sk.noRandomHalls = true;
};

const BUILDERS: Partial<Record<string, Builder>> = {
  spiral: whole,
  shrink: whole,
  rooftop: whole,
  // 区域の寄せ集め（shapes/patchwork.ts）
  patchwork: whole,

  /**
   * F03 くねる部屋の連なり: 廊下が無い。区画いっぱいの部屋が壁 1 枚の扉で直接つながり、深さ優先の木なのでくねくねと続く。
   * 輪郭の葉を少し削り、隣どうしにたまに扉を足す（回り道）
   */
  chain(sk, _p, rng, t, link) {
    for (const n of sk.nodes) { n.kind = 'room'; n.style = 'full'; }
    spanningTree(sk, rng, sk.entry, link, () => true, 'direct');
    pruneLeaves(sk, rng.fork('prune'), 0.35, new Set([sk.entry]));
    for (const n of sk.nodes) {
      if (!used(n)) continue;
      for (const m of neighbors(sk, n.id)) if (m > n.id && used(sk.nodes[m]!) && !linked(sk, n.id, m) && rng.chance(t['structure.chain.loopChance'])) link(n.id, m, 'direct');
    }
    sk.fixedLevels = true;
  },

  /**
   * F05 中庭を囲む: 外周の部屋（区画いっぱい）が輪になって中庭を囲む。どの部屋にも中庭への窓があり、いくつかの部屋から中庭へ出られる。
   * 中庭は屋外（天井なし・霧・草木）。中庭を横切れば近道になる
   */
  courtyard(sk, _p, rng, _t, link) {
    const { cols, rows } = sk;
    const ring: number[] = [];
    for (let c = 0; c < cols; c++) ring.push(nodeId(sk, c, 0));
    for (let r = 1; r < rows; r++) ring.push(nodeId(sk, cols - 1, r));
    for (let c = cols - 2; c >= 0; c--) ring.push(nodeId(sk, c, rows - 1));
    for (let r = rows - 2; r >= 1; r--) ring.push(nodeId(sk, 0, r));
    for (const n of sk.nodes) {
      const inner = n.col > 0 && n.col < cols - 1 && n.row > 0 && n.row < rows - 1;
      if (inner) { n.kind = 'hall'; n.hall = 1; n.style = 'courtyard'; } else { n.kind = 'room'; n.style = 'full'; }
    }
    for (let i = 0; i < ring.length; i++) link(ring[i]!, ring[(i + 1) % ring.length]!, 'direct');
    // 中庭への扉: 4 辺のうち 2〜3 辺の真ん中あたりの部屋から
    const sides: number[][] = [
      ring.filter((n) => sk.nodes[n]!.row === 0 && sk.nodes[n]!.col > 0 && sk.nodes[n]!.col < cols - 1 && n !== sk.entry),
      ring.filter((n) => sk.nodes[n]!.col === cols - 1 && sk.nodes[n]!.row > 0 && sk.nodes[n]!.row < rows - 1),
      ring.filter((n) => sk.nodes[n]!.row === rows - 1 && sk.nodes[n]!.col > 0 && sk.nodes[n]!.col < cols - 1),
      ring.filter((n) => sk.nodes[n]!.col === 0 && sk.nodes[n]!.row > 0 && sk.nodes[n]!.row < rows - 1),
    ].filter((x) => x.length);
    const inward = (n: number): number => {
      const v = sk.nodes[n]!;
      const c = Math.min(cols - 2, Math.max(1, v.col)), r = Math.min(rows - 2, Math.max(1, v.row));
      return nodeId(sk, c, r);
    };
    for (const side of rng.shuffle(sides).slice(0, rng.int(2, 3))) {
      const n = rng.pick(side);
      link(n, inward(n), 'direct');
    }
    // 窓: 中庭に接する部屋すべて（扉の部屋も、扉の脇に窓）
    for (const n of ring) {
      const v = sk.nodes[n]!;
      const corner = (v.col === 0 || v.col === cols - 1) && (v.row === 0 || v.row === rows - 1);
      if (!corner) sk.windows.push({ a: n, b: inward(n) });
    }
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
  },

  /**
   * F06 二重ループ: 入口の部屋の隣に出口の部屋がある（ガラスの窓から出口の緑の灯りが見える）。間の扉は出口の側からしか開かない。
   * 入口から出口へは、フロアをぐるりと回る長い道。奥から戻ってきた人には、扉が近道として開く
   */
  shortcut(sk, _p, rng, t, link) {
    const { cols } = sk;
    const e = sk.entry, ec = sk.nodes[e]!.col;
    const xc = ec + (ec + 1 < cols && (ec === 0 || rng.chance(0.5)) ? 1 : -1);
    const x = nodeId(sk, xc, 0);
    // 入口と出口の部屋が隣どうしでも、木の上では遠くなるように: 何本か木を作って、入口から出口までが最も長いもの
    let best: { links: Skeleton['links']; kinds: SkelNode['kind'][]; len: number } | null = null;
    for (let k = 0; k < 6; k++) {
      sk.links = [];
      for (const n of sk.nodes) n.kind = 'room';
      const r = rng.fork(`tree${k}`);
      const linkNo: LinkFn = (a, b, s) => { if ((a === e && b === x) || (a === x && b === e)) return; link(a, b, s); };
      spanningTree(sk, r, e, linkNo);
      addLoops(sk, r, Math.max(0, Math.round((t['floor.loopsPer10'] * sk.nodes.length) / 10) - 1), linkNo, (a, b) => ![a, b].some((v) => v === e || v === x));
      for (const n of sk.nodes) if (n.id !== e && n.id !== x && r.chance(t['floor.junctionChance'])) n.kind = 'junction';
      const len = pathBetween(sk, e, x).length;
      if (!best || len > best.len) best = { links: sk.links.slice(), kinds: sk.nodes.map((n) => n.kind), len };
    }
    sk.links = best!.links;
    sk.nodes.forEach((n, i) => { n.kind = best!.kinds[i]!; });
    sk.nodes[e]!.style = 'full';
    sk.nodes[x]!.style = 'full';
    sk.nodes[x]!.kind = 'room';
    link(e, x, 'oneWay', { from: x });
    sk.windows.push({ a: e, b: x });
    sk.exit = x;
    sk.fixedExit = true;
    sk.fixedLevels = true;
    sk.noRandomHalls = true;
  },

  /**
   * F07 入れ子のループ: 外周を一周する大きな輪と、その片側の内に小さな輪（2×2）。小さな輪は大きな輪と 2 か所でつながり、
   * 回っているうちに同じ所へ戻ってくる。残りの区画は輪から枝分かれする部屋
   */
  loops(sk, _p, rng, _t, link) {
    const { cols, rows } = sk;
    for (const n of sk.nodes) n.kind = 'none';
    const ringOf = (c0: number, r0: number, c1: number, r1: number): number[] => {
      const out: number[] = [];
      for (let c = c0; c <= c1; c++) out.push(nodeId(sk, c, r0));
      for (let r = r0 + 1; r <= r1; r++) out.push(nodeId(sk, c1, r));
      for (let c = c1 - 1; c >= c0; c--) out.push(nodeId(sk, c, r1));
      for (let r = r1 - 1; r > r0; r--) out.push(nodeId(sk, c0, r));
      return out;
    };
    const outer = ringOf(0, 0, cols - 1, rows - 1);
    // 小さな輪: 右か左の内側の 2×2（外周から 1 区画内側）
    const right = rng.chance(0.5);
    const c0 = right ? cols - 3 : 1, r0 = 1;
    const inner = ringOf(c0, r0, c0 + 1, r0 + 1);
    for (const ring of [outer, inner]) {
      for (const n of ring) sk.nodes[n]!.kind = rng.chance(0.55) ? 'junction' : 'room';
      for (let i = 0; i < ring.length; i++) link(ring[i]!, ring[(i + 1) % ring.length]!);
    }
    // 外周と小さな輪を 2 か所でつなぐ（小さな輪の外周に接する辺から）
    const bridges = inner.flatMap((n) => neighbors(sk, n).filter((m) => outer.includes(m)).map((m) => [n, m] as const));
    for (const [a, b] of rng.shuffle(bridges.slice()).slice(0, 2)) link(a, b);
    // 残りの区画: 輪から枝の部屋
    for (const n of rng.shuffle(sk.nodes.filter((x) => x.kind === 'none'))) {
      const opts = neighbors(sk, n.id).filter((m) => used(sk.nodes[m]!));
      if (opts.length && rng.chance(0.8)) { n.kind = 'room'; link(n.id, rng.pick(opts)); }
    }
    for (const [c, r] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]] as const) at(sk, c, r).kind = 'junction';
    sk.nodes[sk.entry]!.kind = 'room';
  },

  /**
   * F11 同心円: 外の輪 → 内の輪 → 中心。中心へ行くほど通路は狭く、照明は暗く、材質は古くなる（geometry.ts が age で変える）。
   * 輪は左右の真ん中で切れていて、奥の半分へは中心を通らないと行けない（入口は手前、出口は奥。誰もが中心を通る）
   */
  concentric(sk, _p, rng, t, link) {
    const { cols, rows } = sk;
    const cc = Math.floor(cols / 2), cr = Math.floor(rows / 2);
    const ring = (n: SkelNode): number => Math.min(n.col, n.row, cols - 1 - n.col, rows - 1 - n.row);
    const maxRing = Math.min(cc, cr);
    for (const n of sk.nodes) {
      const k = ring(n);
      n.age = maxRing > 0 ? k / maxRing : 0;
      n.kind = k === maxRing ? 'room' : rng.chance(k === 0 ? 0.45 : 0.3) ? 'room' : 'junction';
      if (k > 0) n.style = 'old';
    }
    const widthOf = (k: number): number | undefined => (k === 0 ? undefined : k >= maxRing ? t['structure.concentric.innerWidthM'] : t['structure.concentric.innerWidthM'] + 0.5);
    for (let k = 0; k < maxRing; k++) {
      const c0 = k, r0 = k, c1 = cols - 1 - k, r1 = rows - 1 - k;
      const loop: number[] = [];
      for (let c = c0; c <= c1; c++) loop.push(nodeId(sk, c, r0));
      for (let r = r0 + 1; r <= r1; r++) loop.push(nodeId(sk, c1, r));
      for (let c = c1 - 1; c >= c0; c--) loop.push(nodeId(sk, c, r1));
      for (let r = r1 - 1; r > r0; r--) loop.push(nodeId(sk, c0, r));
      for (let i = 0; i < loop.length; i++) {
        const a = sk.nodes[loop[i]!]!, b = sk.nodes[loop[(i + 1) % loop.length]!]!;
        // 左右の真ん中の辺で輪を切る（手前の半分と奥の半分）
        const cut = a.col === b.col && (a.col === c0 || a.col === c1) && Math.min(a.row, b.row) === cr;
        if (!cut) link(a.id, b.id, k === 0 ? undefined : 'narrow', widthOf(k) ? { width: widthOf(k) } : undefined);
      }
    }
    // 輪から内の輪へ: 手前の半分は左右どちらかの横から、奥の半分は反対側の横から（中心を通って奥へ抜ける）
    const side = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < maxRing; k++) {
      const front = cr - 1, back = cr + 1;
      const cIn = side > 0 ? cols - 1 - k : k;
      const cOut = side > 0 ? k : cols - 1 - k;
      const step = (c: number, dc: number, r: number): void => { if (k + 1 < maxRing) link(nodeId(sk, c, r), nodeId(sk, c + dc, r), 'narrow', { width: widthOf(k + 1) }); };
      if (k + 1 < maxRing) {
        step(cIn, side > 0 ? -1 : 1, Math.max(k + 1, front));
        step(cOut, side > 0 ? 1 : -1, Math.min(rows - 2 - k, back));
      }
    }
    // 中心: いちばん内の輪の手前と奥からつなぐ
    const core = nodeId(sk, cc, cr);
    if (maxRing >= 1) {
      link(nodeId(sk, cc, cr - 1), core, 'narrow', { width: widthOf(maxRing) });
      link(core, nodeId(sk, cc, cr + 1), 'narrow', { width: widthOf(maxRing) });
    }
    sk.nodes[core]!.kind = 'room';
    sk.nodes[sk.entry]!.kind = 'room';
    sk.exit = nodeId(sk, cc, rows - 1);
    sk.nodes[sk.exit]!.kind = 'room';
    sk.fixedExit = true;
    sk.noRandomHalls = true;
  },

  /** F13 スキップフロア: どのつなぎも半階（floor.levelHeightM）上るか下る。市松に高さが交互になる */
  skip(sk, _p, rng, t, link) {
    gridLike(sk, rng, t, link);
    for (const n of sk.nodes) n.level = (n.col + n.row) % 2;
    sk.fixedLevels = true;
    sk.noRandomHalls = true;
  },

  /**
   * F14 中二階: 主の階（階 1）の真ん中に、上の階（階 0）まで吹き抜けた広間。広間の壁沿いに中二階の回廊があり、手すり越しに下が見える。
   * 回廊から上の階の部屋へ入れる（上の階は回廊からしか行けない。出口が上にあることもある）
   */
  gallery(sk, p, rng, t, link) {
    const { cols, rows } = sk;
    const main = 1;
    sk.entry = nodeId(sk, Math.floor(cols / 2), 0, main);
    for (const n of sk.nodes) n.kind = n.story === main ? 'room' : 'none';
    gridLike(sk, rng, t, link, main);
    // 広間: 入口の列から 1 つ奥の 2×1（広ければ 2×2）
    const hc = Math.min(cols - 2, Math.max(0, Math.floor(cols / 2) - (rng.chance(0.5) ? 1 : 0)));
    const members: [number, number][] = [[hc, 1], [hc + 1, 1]];
    if (rows >= 4 && rng.chance(0.5)) members.push([hc, 2], [hc + 1, 2]);
    for (const s of [0, main]) for (const [c, r] of members) { const n = at(sk, c, r, s); n.kind = 'hall'; n.hall = 1; n.style = 'gallery'; }
    // 広間の中のつなぎは要らない（広間の区画どうし）。上の階の広間の区画は、主の階の広間とつなぐ（同じ区画の印）
    for (const [c, r] of members) link(nodeId(sk, c, r, 0), nodeId(sk, c, r, main));
    // 上の階の部屋: 広間の区画の隣（広間の外）
    const cand: [number, number, number][] = [];
    for (const [c, r] of members) for (const m of neighbors(sk, nodeId(sk, c, r, 0))) {
      const v = sk.nodes[m]!;
      // 手前の行は入口の階段（主の階から上へ伸びる）と重なるので使わない
      if (v.kind === 'none' && v.row > 0 && !members.some(([mc, mr]) => mc === v.col && mr === v.row)) cand.push([m, nodeId(sk, c, r, 0), 0]);
    }
    const n = Math.min(cand.length, t['structure.gallery.upperRooms']);
    const picked = rng.shuffle(cand).slice(0, n);
    for (const [m, h] of picked) {
      if (sk.nodes[m]!.kind !== 'none') continue;
      sk.nodes[m]!.kind = 'room';
      link(h, m);
    }
    // 上の階の部屋どうし（隣なら）を廊下でつなぐ（回廊をぐるりと回らずに渡れる）
    for (const [m] of picked) for (const o of neighbors(sk, m)) if (o > m && sk.nodes[o]!.kind === 'room' && sk.nodes[o]!.story === 0 && rng.chance(0.5)) link(m, o);
    void p;
    // 出口は主の階（上の階の部屋から下りる階段は、下の階の区画と重なる）
    sk.exitStory = main;
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
  },

  /**
   * F15 立体交差: 上の階（入口）の廊下が奥の行を横切り、下の階の廊下が 1 つの列を縦に貫く。交わる所は上の床がガラスで、
   * 上からは下の廊下が、下からは上の廊下が見える。上の端の階段室で下りて、下の廊下を交差の下をくぐって出口へ
   */
  crossing(sk, _p, rng, t, link) {
    const { cols, rows } = sk;
    const cc = Math.floor(cols / 2);
    const ru = rows - 2;
    // 下の廊下の列は内側（外周の列だと交差にならない）
    const side = cc + 1 > cols - 2 ? -1 : cc - 1 < 1 ? 1 : rng.chance(0.5) ? 1 : -1;
    const cl = cc + side;
    const wc = side > 0 ? cols - 1 : 0;
    for (const n of sk.nodes) n.kind = 'none';
    // 上の階: 入口から奥への背骨（入口の列）と、奥の行の廊下
    for (let r = 0; r <= ru; r++) { at(sk, cc, r, 0).kind = r === 0 ? 'room' : 'junction'; if (r > 0) link(nodeId(sk, cc, r - 1, 0), nodeId(sk, cc, r, 0)); }
    for (let c = 0; c < cols; c++) { const n = at(sk, c, ru, 0); if (n.kind === 'none') n.kind = 'junction'; if (c > 0) link(nodeId(sk, c - 1, ru, 0), nodeId(sk, c, ru, 0)); }
    at(sk, cl, ru, 0).style = 'glassFloor';
    // 階段室（奥の端の角）: 上は奥の行の端と、下は奥の行の下の階の廊下とつなぐ
    for (const s of [0, 1]) { const w = at(sk, wc, rows - 1, s); w.kind = 'well'; w.well = 1; }
    link(nodeId(sk, wc, rows - 1, 0), nodeId(sk, wc, ru, 0));
    link(nodeId(sk, wc, rows - 1, 0), nodeId(sk, wc, rows - 1, 1));
    // 下の階: 階段室から奥の行を交差の列まで、そこから列を手前まで
    const dc = side > 0 ? -1 : 1;
    let prev = nodeId(sk, wc, rows - 1, 1);
    for (let c = wc + dc; ; c += dc) { const n = at(sk, c, rows - 1, 1); n.kind = 'junction'; link(prev, n.id); prev = n.id; if (c === cl) break; }
    for (let r = rows - 2; r >= 0; r--) { const n = at(sk, cl, r, 1); n.kind = r === 0 ? 'room' : 'junction'; link(prev, n.id); prev = n.id; }
    at(sk, cl, ru, 1).style = 'underpass';
    // 部屋: 上の階は背骨と奥の行の脇、下の階は列の脇（どれも行き止まり）
    for (const s of [0, 1]) {
      for (const n of rng.shuffle(sk.nodes.filter((x) => x.story === s && x.kind === 'none'))) {
        const opts = neighbors(sk, n.id).filter((m) => sk.nodes[m]!.kind === 'junction' && !sk.nodes[m]!.style);
        if (opts.length && rng.chance(s === 0 ? 0.55 : 0.5)) { n.kind = 'room'; link(n.id, rng.pick(opts)); }
      }
    }
    sk.exit = nodeId(sk, cl, 0, 1);
    sk.fixedExit = true;
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
    void t;
  },

  /** F16 島と橋: 部屋は奈落（か水）の上に浮かぶ島。つなぎは全部、手すりの付いた細い橋。曲がり角は小さな足場 */
  islands(sk, _p, rng, t, link) {
    spanningTree(sk, rng, sk.entry, link, () => true, 'bridge');
    addLoops(sk, rng, Math.max(1, Math.round((t['floor.loopsPer10'] * sk.nodes.length) / 10) - 1), link, () => true, 'bridge');
    for (const n of sk.nodes) { n.kind = n.id !== sk.entry && rng.chance(0.35) ? 'junction' : 'room'; n.style = 'island'; }
    pruneLeaves(sk, rng.fork('prune'), 0.3, new Set([sk.entry]));
    sk.below = rng.chance(0.5) ? 'water' : 'void';
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
  },

  /** F17 入れ子の部屋: 格子のフロアに、2×2 の大部屋が 1 つ。中に小部屋、その中にさらに小部屋（扉を開けるたびにまた部屋） */
  nest(sk, _p, rng, t, link) {
    gridLike(sk, rng, t, link);
    forceHall(sk, rng, 'nest', 2, 2);
    sk.noRandomHalls = true;
  },

  /** F18 巨大空間の中の建物: 天井の高い 3×2 の空間（体育館・倉庫）の中に、屋根のある小さな建物が建っている */
  megahall(sk, _p, rng, t, link) {
    gridLike(sk, rng, t, link);
    if (!forceHall(sk, rng, 'mega', 3, 2) && !forceHall(sk, rng, 'mega', 2, 3)) forceHall(sk, rng, 'mega', 2, 2);
    sk.noRandomHalls = true;
  },

  /**
   * F19 鏡写し: 真ん中の列で左右対称の骨組み（大きさ・テーマも鏡写し。家具は shapes/finish.ts が写す）。
   * 片側だけ少し違う: 片側の 1 つのつなぎが無い（その先の部屋も無い）・片側の 1 つの部屋だけ家具が違う
   */
  mirror(sk, _p, rng, t, link) {
    const { cols, rows } = sk;
    const cc = Math.floor(cols / 2);
    const mir = (n: number): number => { const v = sk.nodes[n]!; return nodeId(sk, cols - 1 - v.col, v.row, v.story); };
    const left = (n: number): boolean => sk.nodes[n]!.col <= cc;
    // 左半分（真ん中の列を含む）の木
    spanningTree(sk, rng, sk.entry, link, left);
    addLoops(sk, rng, Math.round((t['floor.loopsPer10'] * sk.nodes.length) / 20), link, (a, b) => left(a) && left(b));
    // 右へ写す
    for (const l of sk.links.slice()) {
      const ma = mir(l.a), mb = mir(l.b);
      if (ma === l.a && mb === l.b) continue;
      link(ma, mb);
    }
    for (const n of sk.nodes) {
      if (n.col <= cc) { if (n.id !== sk.entry && rng.chance(t['floor.junctionChance'])) n.kind = 'junction'; }
    }
    for (const n of sk.nodes) if (n.col > cc) n.kind = sk.nodes[mir(n.id)]!.kind;
    // 真ん中の列は奥で切る（左右どちらかへ回らないと奥へ行けない）。切ってつながりが無くなるなら切らない
    const connected = (): boolean => { const d = bfs(sk, sk.entry); return sk.nodes.every((n) => !used(n) || d[n.id] >= 0); };
    for (const l of rng.shuffle(sk.links.filter((x) => sk.nodes[x.a]!.col === cc && sk.nodes[x.b]!.col === cc && Math.min(sk.nodes[x.a]!.row, sk.nodes[x.b]!.row) >= 1))) {
      const i = sk.links.indexOf(l);
      sk.links.splice(i, 1);
      if (!connected()) sk.links.splice(i, 0, l);
    }
    // 片側だけ違う: 右側のつなぎを 1 つ外す（つながりが切れたら、その先の区画は使わない = 部屋が 1 つ無い）
    const diffs = t['structure.mirror.diffs'];
    const rightLinks = rng.shuffle(sk.links.filter((l) => sk.nodes[l.a]!.col > cc && sk.nodes[l.b]!.col > cc));
    let removed = 0;
    for (const l of rightLinks) {
      if (removed >= diffs) break;
      const i = sk.links.indexOf(l);
      sk.links.splice(i, 1);
      const d = bfs(sk, sk.entry);
      const lost = sk.nodes.filter((n) => used(n) && d[n.id] < 0);
      // 出口にできる区画（奥の行）まで消えるなら戻す
      if (lost.length > 2 || !sk.nodes.some((n) => used(n) && d[n.id] >= 0 && n.row === rows - 1)) { sk.links.splice(i, 0, l); continue; }
      removed++;
    }
    sk.mirror = true;
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
  },

  /**
   * F21 表と裏の動線: 手前から 2 行目が客用の廊下、いちばん奥の行が従業員用の裏の通路（狭い・設備の色・暗い）。間の部屋は客用の廊下から入り、
   * いくつかは裏の通路への裏口がある。裏の通路は両端（と真ん中の 1 か所）で客用とつながる。出口は裏の通路の奥
   */
  staff(sk, _p, rng, t, link) {
    const { cols, rows } = sk;
    const cc = Math.floor(cols / 2);
    const guest = 1, back = rows - 1, mid = rows - 2;
    for (const n of sk.nodes) n.kind = 'none';
    for (let c = 0; c < cols; c++) {
      const g = at(sk, c, guest); g.kind = rng.chance(0.6) ? 'junction' : 'room';
      if (c > 0) link(nodeId(sk, c - 1, guest), g.id);
      const b = at(sk, c, back); b.kind = 'junction'; b.style = 'staff';
      if (c > 0) link(nodeId(sk, c - 1, back), b.id, 'staff', { width: t['structure.staff.widthM'], height: t['structure.staff.heightM'] });
    }
    at(sk, cc, 0).kind = 'room';
    link(nodeId(sk, cc, 0), nodeId(sk, cc, guest));
    // 手前の行の部屋（客用の廊下の手前側）
    for (let c = 0; c < cols; c++) if (c !== cc && rng.chance(0.6)) { at(sk, c, 0).kind = 'room'; link(nodeId(sk, c, 0), nodeId(sk, c, guest)); }
    // 間の部屋: 客用から入る。裏口は確率で
    const ends = [0, cols - 1];
    const midJoin = cc + (rng.chance(0.5) ? 0 : 1) * (cols > 4 ? 1 : 0);
    for (let c = 0; c < cols; c++) {
      const m = at(sk, c, mid);
      if (ends.includes(c) || c === midJoin) {
        // 客用と裏をつなぐ従業員用の通路（客用の側に「関係者以外」の扉）
        m.kind = 'junction'; m.style = 'staff';
        link(nodeId(sk, c, guest), m.id, 'staff', { width: t['structure.staff.widthM'], height: t['structure.staff.heightM'] });
        link(m.id, nodeId(sk, c, back), 'staff', { width: t['structure.staff.widthM'], height: t['structure.staff.heightM'] });
        continue;
      }
      m.kind = 'room';
      link(nodeId(sk, c, guest), m.id);
      if (rng.chance(t['structure.staff.backDoorChance'])) link(m.id, nodeId(sk, c, back), 'staff', { width: t['structure.staff.widthM'], height: t['structure.staff.heightM'] });
    }
    // 出口: 裏の通路の奥の端の、設備の部屋（右か左）
    const ex = at(sk, rng.chance(0.5) ? 0 : cols - 1, back);
    ex.kind = 'room';
    sk.exit = ex.id;
    sk.fixedExit = true;
    sk.noRandomHalls = true;
  },

  /** F22 天井裏の這う網: 格子のフロアの部屋のいくつかに天井の点検口（梯子段）があり、天井裏の這う通路でつながる（shapes/crawl.ts） */
  crawl(sk, _p, rng, t, link) {
    gridLike(sk, rng, t, link);
    const rooms = sk.nodes.filter((n) => n.kind === 'room' && n.id !== sk.entry);
    // 候補は部屋の全部（混ぜた順）。置ける部屋から structure.crawl.hatches 個まで（shapes/crawl.ts）
    sk.hatches = rng.shuffle(rooms.map((n) => n.id));
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
  },

  /**
   * F23 縦に積んだビル: 階ごとに系統（施設）が違う。階段室（手前の角）でつながり、3 階なら階段室は 2 つ（左の角で 1 階下り、
   * 右の角でもう 1 階）なので、真ん中の階を横切る。入口は上の階、出口はいちばん下の階
   */
  tower(sk, p, rng, t, link) {
    stackedFloors(sk, p, rng, t, link, false);
  },

  /**
   * F24 エレベーターホールの中心: どの階も真ん中にエレベーターホール。乗ると別の階（別の系統の施設）へ。階段室もある（手前の角）
   */
  elevator(sk, p, rng, t, link) {
    stackedFloors(sk, p, rng, t, link, true);
  },

  /**
   * F29 下るだけのフロア: 本道のつなぎは飛び降りる段差か、下へしか開かない扉の階段。上へは戻れないが、どの区画からも出口へ行ける
   * （脇道は平らな行き止まり。ループは同じ高さの区画どうしだけ）
   */
  descent(sk, _p, rng, t, link) {
    spanningTree(sk, rng, sk.entry, link);
    // 出口（奥の行の、入口から最も遠い区画）までの本道
    const d = bfs(sk, sk.entry);
    let ex = -1, best = -1;
    for (const n of sk.nodes) {
      if (!(n.row === sk.rows - 1 || n.col === 0 || n.col === sk.cols - 1) || n.id === sk.entry) continue;
      const score = d[n.id]! + (n.row === sk.rows - 1 ? 0.5 : 0);
      if (score > best) { best = score; ex = n.id; }
    }
    const main = pathBetween(sk, sk.entry, ex);
    const onMain = new Set(main);
    // 本道に沿って 1 段ずつ下げる。脇道は付け根と同じ高さ
    main.forEach((n, i) => { sk.nodes[n]!.level = -i; });
    const adj = adjacency(sk);
    const q = [...main];
    const seen = new Set(main);
    for (let h = 0; h < q.length; h++) for (const m of adj.get(q[h]!) ?? []) if (!seen.has(m)) { seen.add(m); sk.nodes[m]!.level = sk.nodes[q[h]!]!.level; q.push(m); }
    for (let i = 0; i + 1 < main.length; i++) {
      const l = sk.links.find((x) => (x.a === main[i] && x.b === main[i + 1]) || (x.b === main[i] && x.a === main[i + 1]))!;
      l.style = rng.chance(0.7) ? 'drop' : 'oneWay';
      l.from = main[i]!;
    }
    // 同じ高さの区画どうしのループ（回り道）
    addLoops(sk, rng, 2, link, (a, b) => sk.nodes[a]!.level === sk.nodes[b]!.level && !(onMain.has(a) && onMain.has(b)));
    for (const n of sk.nodes) if (n.id !== sk.entry && n.id !== ex && rng.chance(t['floor.junctionChance'])) n.kind = 'junction';
    sk.exit = ex;
    sk.fixedExit = true;
    sk.fixedLevels = true;
    sk.noRandomHalls = true;
  },

  /** F31 吹き抜けの縦穴: 真ん中の区画が縦穴（上の階・下の階の回廊が見える）。まわりの回廊から四方へ廊下 */
  shaft(sk, _p, rng, t, link) {
    const cc = Math.floor(sk.cols / 2), cr = Math.max(1, Math.floor(sk.rows / 2));
    const v = at(sk, cc, cr);
    gridLike(sk, rng, t, link, 0, (n) => n !== v.id);
    v.kind = 'hall'; v.hall = 1; v.style = 'void';
    for (const m of neighbors(sk, v.id)) { if (sk.nodes[m]!.kind === 'none') continue; link(v.id, m); }
    sk.noRandomHalls = true;
    sk.fixedLevels = true;
  },

  /** F34 地下街: 広い低い通路の網（ループが多い）。部屋は店（geometry.ts が柱・店の構え・看板を通路に足す） */
  arcade(sk, _p, rng, t, link) {
    spanningTree(sk, rng, sk.entry, link);
    addLoops(sk, rng, Math.round((t['floor.loopsPer10'] * sk.nodes.length) / 10) + 3, link);
    for (const n of sk.nodes) if (n.id !== sk.entry && rng.chance(0.55)) n.kind = 'junction';
    sk.fixedLevels = true;
  },

  /**
   * F02 分棟: 2〜3 棟（2 列ずつ）が、間の列の上の屋外の渡り廊下でつながる。棟ごとに系統（施設）が違う。渡り廊下は手すりだけで、外は霧
   */
  wings(sk, p, rng, t, link) {
    const nWings = Math.floor((sk.cols + 1) / 3);
    const wingOf = (c: number): number => (c % 3 === 2 ? -1 : Math.floor(c / 3));
    sk.entry = nodeId(sk, 1, 0);
    for (const n of sk.nodes) { const w = wingOf(n.col); if (w < 0) n.kind = 'none'; else n.fam = Math.min(w, (p.families?.length ?? 1) - 1); }
    for (let w = 0; w < nWings; w++) {
      const start = nodeId(sk, w * 3 + (w === 0 ? 1 : 0), 0);
      gridLike(sk, rng.fork(`wing${w}`), t, link, 0, (n) => wingOf(sk.nodes[n]!.col) === w, start);
    }
    // 渡り廊下: 棟の間ごとに 1〜2 本（同じ行の、間の列をまたぐ）
    for (let w = 0; w + 1 < nWings; w++) {
      const rows = rng.shuffle([...Array(sk.rows).keys()]).slice(0, rng.chance(0.5) ? 2 : 1);
      for (const r of rows) link(nodeId(sk, w * 3 + 1, r), nodeId(sk, w * 3 + 3, r), 'walkway');
    }
    sk.nodes[sk.entry]!.kind = 'room';
    sk.fixedLevels = true;
    sk.noRandomHalls = true;
  },

  /**
   * F35 鉄道の駅と車両: 手前の行は入口と改札の前、真ん中の行はコンコース、奥の行がホーム（1 段下。階段で下りる）。
   * ホームに車両が止まっている（乗ると隣の駅へ。shapes/styles.ts）。ふつうの出口の階段はコンコースの端
   */
  station(sk, _p, rng, _t, link) {
    const { cols } = sk;
    const cc = Math.floor(cols / 2);
    for (const n of sk.nodes) n.kind = 'none';
    for (let c = 0; c < cols; c++) { const n = at(sk, c, 1); n.kind = rng.chance(0.5) ? 'junction' : 'room'; if (c > 0) link(nodeId(sk, c - 1, 1), n.id); }
    at(sk, cc, 0).kind = 'room';
    link(sk.entry, nodeId(sk, cc, 1));
    for (let c = 0; c < cols; c++) if (c !== cc && rng.chance(0.45)) { at(sk, c, 0).kind = 'room'; link(nodeId(sk, c, 0), nodeId(sk, c, 1)); }
    // ホーム: 奥の行の両端を除く（両端は出口の階段のため空ける）
    const p0 = 1, p1 = cols - 2;
    for (let c = p0; c <= p1; c++) { const n = at(sk, c, 2); n.kind = 'hall'; n.hall = 1; n.style = 'platform'; n.level = -1; }
    const downs = rng.shuffle([...Array(p1 - p0 + 1).keys()].map((k) => p0 + k)).slice(0, Math.min(2, p1 - p0 + 1));
    // ホームへ下りる階段は、コンコースの曲がり角から（階段が収まる長さ）
    for (const c of downs) { at(sk, c, 1).kind = 'junction'; link(nodeId(sk, c, 1), nodeId(sk, c, 2)); }
    // 出口: コンコースの端（左右）
    const ex = at(sk, rng.chance(0.5) ? 0 : cols - 1, 1);
    ex.kind = 'room';
    sk.exit = ex.id;
    sk.fixedExit = true;
    sk.fixedLevels = true;
    sk.noRandomHalls = true;
  },
};

/**
 * F32 迷路フロア: 本来の出口のほかに、外周の行き止まりに近い所へ出口の階段を足す（structure.maze.extraExits）。
 * 行き先: 2 つ目は次の深さの裏のフロア、3 つ目は 2 つ先のフロア（どの出口を選ぶかで行き先が変わる）。
 * 入口・本来の出口・ほかの出口から骨組みで 3 つ以上離れた、外周の部屋（曲がり角なら部屋にする）
 */
export function addMazeExits(sk: Skeleton, p: FloorProfile, rng: Rng, t: Tuning): void {
  const want = t['structure.maze.extraExits'];
  if (want <= 0) return;
  const depth = p.key.depth;
  const dests = [`${depth + 1}.1`, `${depth + 2}.0`, `${depth + 1}.2`];
  const taken = [sk.entry, sk.exit];
  // 外向きの辺のうち、つなぎに使っていない向きがある外周の区画（出口の階段をその向きに付ける）
  const adj0 = adjacency(sk);
  const boundary = (n: SkelNode): boolean => {
    const used = new Set((adj0.get(n.id) ?? []).map((m) => { const o = sk.nodes[m]!; return o.col > n.col ? 1 : o.col < n.col ? 3 : o.row > n.row ? 2 : 0; }));
    return (n.row === sk.rows - 1 && !used.has(2)) || (n.col === 0 && !used.has(3)) || (n.col === sk.cols - 1 && !used.has(1));
  };
  for (let k = 0; k < want; k++) {
    const dists = taken.map((x) => bfs(sk, x));
    const cand = sk.nodes.filter((n) => used(n) && n.kind !== 'hall' && boundary(n) && !taken.includes(n.id) && dists.every((d) => d[n.id]! >= 3));
    if (!cand.length) break;
    // 行き止まりを優先（迷路の奥）
    const deg = adjacency(sk);
    const n = rng.weighted(cand, (c) => ((deg.get(c.id)?.length ?? 0) <= 1 ? 3 : 1));
    if (n.kind === 'junction') n.kind = 'room';
    sk.extraExits.push({ node: n.id, to: dests[k]! });
    taken.push(n.id);
  }
}

/**
 * 隣り合う区画の w×h の組を 1 つの広間（作り style）にする。入口・出口の候補（外周の手前の行）を避け、
 * 組の区画どうしがつながっていて、組の外ともつながっているもの。作れなければ false
 */
function forceHall(sk: Skeleton, rng: Rng, style: SkelNode['style'], w: number, h: number): boolean {
  const { cols, rows } = sk;
  const cands: number[][] = [];
  for (let r = 1; r + h <= rows; r++) for (let c = 0; c + w <= cols; c++) {
    const ids: number[] = [];
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) ids.push(nodeId(sk, c + dc, r + dr));
    if (ids.some((n) => sk.nodes[n]!.kind === 'none' || n === sk.entry)) continue;
    cands.push(ids);
  }
  if (!cands.length) return false;
  const ids = rng.pick(cands);
  const hallId = Math.max(0, ...sk.nodes.map((n) => n.hall)) + 1;
  for (const n of ids) { const v = sk.nodes[n]!; v.kind = 'hall'; v.hall = hallId; v.style = style; }
  // 組の中はつながっている扱い（同じ区画）。組の中のつなぎを足しておく（入口から届くように）
  for (const a of ids) for (const b of neighbors(sk, a)) if (ids.includes(b) && !linked(sk, a, b)) sk.links.push({ a, b });
  return true;
}

/**
 * 縦に積んだビル・エレベーターホール: 3×3 の区画を階の数だけ積む。階ごとに系統が違う（node.fam = 階）。
 * - 階段室: 手前の行の角（左右）。3 階なら左で 0→1、右で 1→2（真ん中の階を横切る）
 * - エレベーターホール（lift）: 真ん中の区画がホール（どの階も）。ホールの奥の壁にエレベーター（shapes/styles.ts）
 */
function stackedFloors(sk: Skeleton, p: FloorProfile, rng: Rng, t: Tuning, link: LinkFn, lift: boolean): void {
  const { cols, rows, stories } = sk;
  const cc = Math.floor(cols / 2);
  for (const n of sk.nodes) { n.kind = 'room'; n.fam = Math.min(n.story, (p.families?.length ?? 1) - 1); }
  // 階段室の位置: 階の組ごとに左右の角を交互に
  const wellSpan: { c: number; s0: number; s1: number }[] = [];
  if (lift || stories === 2) wellSpan.push({ c: rng.chance(0.5) ? 0 : cols - 1, s0: 0, s1: stories - 1 });
  else {
    const first = rng.chance(0.5) ? 0 : cols - 1;
    for (let s = 0; s + 1 < stories; s++) wellSpan.push({ c: s % 2 === 0 ? first : cols - 1 - first, s0: s, s1: s + 1 });
  }
  wellSpan.forEach((w, i) => {
    for (let s = w.s0; s <= w.s1; s++) { const n = at(sk, w.c, 0, s); n.kind = 'well'; n.well = i + 1; }
    for (let s = w.s0; s < w.s1; s++) link(nodeId(sk, w.c, 0, s), nodeId(sk, w.c, 0, s + 1));
  });
  const isWell = (n: number): boolean => sk.nodes[n]!.kind === 'well';
  // エレベーターホールの奥（かごの並ぶ側）にはつながない
  const lobbyBack = (a: number, b: number): boolean => {
    if (!lift) return false;
    const x = sk.nodes[a]!, y = sk.nodes[b]!;
    const hit = (h: SkelNode, o: SkelNode): boolean => h.col === cc && h.row === 1 && o.col === cc && o.row === 2;
    return hit(x, y) || hit(y, x);
  };
  // 階ごとの区画の木（階段室を除く）。階段室は横の区画と奥の区画につなぐ
  for (let s = 0; s < stories; s++) {
    const start = nodeId(sk, cc, 0, s);
    const r = rng.fork(`story${s}`);
    const per = cols * rows;
    spanningTree(sk, r, start, link, (n) => Math.floor(n / per) === s && !isWell(n), undefined, (a, b) => !lobbyBack(a, b));
    addLoops(sk, r, 1, link, (a, b) => Math.floor(a / per) === s && Math.floor(b / per) === s && !isWell(a) && !isWell(b) && !lobbyBack(a, b));
    for (const n of sk.nodes) if (n.story === s && !isWell(n.id) && n.id !== start && r.chance(0.3)) n.kind = 'junction';
    for (const w of wellSpan) {
      if (s < w.s0 || s > w.s1) continue;
      const wid = nodeId(sk, w.c, 0, s);
      const side = nodeId(sk, w.c === 0 ? 1 : cols - 2, 0, s);
      link(wid, side);
      if (r.chance(0.5)) link(wid, nodeId(sk, w.c, 1, s));
    }
    if (lift) {
      const hall = at(sk, cc, 1, s);
      hall.kind = 'hall'; hall.hall = 10 + s; hall.style = 'lobby';
      if (!linked(sk, start, hall.id)) link(start, hall.id);
    }
  }
  sk.entry = nodeId(sk, cc, 0, 0);
  sk.nodes[sk.entry]!.kind = 'room';
  // 出口: いちばん下の階の外周（奥の行を優先）で、入口から最も遠い区画
  const d = bfs(sk, sk.entry);
  let ex = -1;
  for (const n of sk.nodes) {
    if (n.story !== stories - 1 || n.kind === 'well' || n.kind === 'hall' || d[n.id] < 0) continue;
    if (!(n.row === rows - 1 || n.col === 0 || n.col === cols - 1)) continue;
    if (n.row === 0 && neighbors(sk, n.id).some((m) => isWell(m))) continue;
    const score = d[n.id] + (n.row === rows - 1 ? 0.5 : 0);
    if (ex < 0 || score > d[ex]! + (sk.nodes[ex]!.row === rows - 1 ? 0.5 : 0)) ex = n.id;
  }
  sk.exit = ex;
  sk.nodes[ex]!.kind = 'room';
  sk.fixedExit = true;
  sk.fixedLevels = true;
  sk.noRandomHalls = true;
  void t;
}
