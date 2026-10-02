/**
 * 果てしない階の区域の計画（docs/endless-world.md 3 章）。
 *
 * 階（world, depth, variant）の平面を world.slotM 角の升目に分ける。2 × 2 升目の組（超ブロック）ごとに分け方を引き、
 * 区域（1 × 1・2 × 1・1 × 2・2 × 2 升目）にする。区域・境目の扉・階段室は升目のハッシュだけで決まり、歩いた順に依存しない。
 * どれも軽い（区域の中身を作らずに、隣の区域・扉の位置・階段室の升目が分かる）。
 *
 * - 区域の形（升目の分け方・種類・境目の扉・階段室）は表と裏（variant）で同じ。中身は区域の生成（region.ts）が variant ごとに変える
 * - 境目の扉: 隣り合う 2 つの区域の境目の升目の辺ごとに数個（辺を等分した区間ごとに 1 つ）。位置は境目の id のハッシュ（両側で同じ）
 * - 階段室: 超ブロックごとに下りが 1 つ。偶数の深さは斜めの升目（0,0）（1,1）、奇数は（1,0）（0,1）のどちらか。
 *   下の階の着く升目と、その階の下りの升目が同じにならない（着いてすぐ下りにならない）
 */
import type { Tuning } from '../../config/tuning.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { FAMILIES } from '../floor/themes.ts';

/** 階の鍵。variant 0 が表の階 */
export interface StoryKey { world: number; depth: number; variant: number }
export const storyId = (s: StoryKey): string => `${s.depth}.${s.variant}`;

export type RegionKind = 'district' | 'patchwork';

/** 升目の矩形（cx, cz はいちばん小さい升目。w, h は升目の数） */
export interface SlotBox { cx: number; cz: number; w: number; h: number }

/** 区域から見た境目の扉 */
export interface GateEnd {
  /** 境目の扉の id（両側の区域で同じ） */
  id: string;
  /** 向こうの区域の id */
  other: string;
  /** この区域から見た外向き（0 +Z / 1 +X / 2 −Z / 3 −X） */
  side: Dir;
  /** 境目の線の座標（side 0・2 は z、1・3 は x） */
  line: number;
  /** 境目に沿った扉の中心（side 0・2 は x、1・3 は z） */
  at: number;
}

/** 区域から見た階段室 */
export interface AirlockEnd {
  /** 階段室の id（上の階と下の階の写しで同じ）: air:<上の深さ>:<bx>:<bz> */
  id: string;
  /** down: 上の扉がこの区域につながる（降りていく）/ up: 下の扉がこの区域につながる（上から着く） */
  role: 'down' | 'up';
  /** 置く升目 */
  slot: [number, number];
  /** 向こうの階（down は 1 つ下の表、up は 1 つ上の表）。null は上に階が無い（上の扉は開かない） */
  to: StoryKey | null;
}

/** 区域から見た、隠しの穴から落ちてくる人が着く部屋（超ブロックごとに 1 つ。どの階の隠しの穴もここへ落ちる） */
export interface LandingEnd {
  /** land:<深さ>:<bx>:<bz>（表と裏で同じ） */
  id: string;
  /** 置く升目 */
  slot: [number, number];
}

export interface RegionPlan {
  story: StoryKey;
  /** 区域の id（階の中で一意）: x<cx>z<cz> */
  id: string;
  slots: SlotBox;
  /** 階の座標の矩形（m） */
  rect: Rect;
  kind: RegionKind;
  /** 形の seed（表と裏で同じ） */
  seed: number;
  /** 町の系統の id（街区はこの系統を world.wardCoherence の確率で使う） */
  ward: string;
  gates: GateEnd[];
  airlocks: AirlockEnd[];
  landings: LandingEnd[];
}

export const regionIdOf = (b: Pick<SlotBox, 'cx' | 'cz'>): string => `x${b.cx}z${b.cz}`;

/** 区域の id → いちばん小さい升目 */
export function parseRegionId(id: string): [number, number] | null {
  const m = /^x(-?\d+)z(-?\d+)$/.exec(id);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const fdiv = (a: number, b: number): number => Math.floor(a / b);
const mod = (a: number, b: number): number => ((a % b) + b) % b;

/** 超ブロックの分け方（升目の [x, z, w, h]。超ブロックの左下からの相対） */
const SPLITS: Record<string, [number, number, number, number][]> = {
  quad: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]],
  rows: [[0, 0, 2, 1], [0, 1, 2, 1]],
  cols: [[0, 0, 1, 2], [1, 0, 1, 2]],
  mixA: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]],
  mixB: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 2, 1]],
  mixC: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]],
  mixD: [[0, 0, 1, 1], [0, 1, 1, 1], [1, 0, 1, 2]],
  big: [[0, 0, 2, 2]],
};

function splitWeight(id: string, t: Tuning): number {
  if (id === 'quad') return t['world.split.quad'];
  if (id === 'rows' || id === 'cols') return t['world.split.pair'] / 2;
  if (id.startsWith('mix')) return t['world.split.mix'] / 4;
  return t['world.split.big'];
}

/** 超ブロックの分け方の id（深さごとに違う。表と裏で同じ） */
export function superblockSplit(world: number, depth: number, bx: number, bz: number, t: Tuning): string {
  const ids = Object.keys(SPLITS);
  return new Rng(hashAll(world, 'split', depth, bx, bz)).weighted(ids, (id) => splitWeight(id, t));
}

/** 升目 (cx, cz) を持つ区域の升目の矩形 */
export function regionSlots(world: number, depth: number, cx: number, cz: number, t: Tuning): SlotBox {
  const bx = fdiv(cx, 2), bz = fdiv(cz, 2);
  const lx = cx - bx * 2, lz = cz - bz * 2;
  for (const [x, z, w, h] of SPLITS[superblockSplit(world, depth, bx, bz, t)]!) {
    if (lx >= x && lx < x + w && lz >= z && lz < z + h) return { cx: bx * 2 + x, cz: bz * 2 + z, w, h };
  }
  throw new Error(`升目が区域に入っていません: ${cx},${cz}`);
}

/** 深さ depth の超ブロック (bx, bz) の下りの階段室の升目（偶数の深さは斜め、奇数は逆の斜め） */
export function downSlot(world: number, depth: number, bx: number, bz: number): [number, number] {
  const h = hashAll(world, 'down', depth, bx, bz);
  const k = mod(depth, 2) === 0 ? (h & 1 ? 0 : 3) : (h & 1 ? 1 : 2);
  return [bx * 2 + (k & 1), bz * 2 + (k >> 1)];
}

export const airlockId = (upperDepth: number, bx: number, bz: number): string => `air:${upperDepth}:${bx}:${bz}`;

/** 深さ depth の超ブロック (bx, bz) の、隠しの穴から落ちてくる人が着く部屋の升目（表と裏で同じ） */
export function landingSlot(world: number, depth: number, bx: number, bz: number): [number, number] {
  const h = hashAll(world, 'land', depth, bx, bz);
  return [bx * 2 + (h & 1), bz * 2 + ((h >> 1) & 1)];
}
export const landingId = (depth: number, bx: number, bz: number): string => `land:${depth}:${bx}:${bz}`;

/** 階段室の id → 上の深さ・超ブロック */
export function parseAirlockId(id: string): { depth: number; bx: number; bz: number } | null {
  const m = /^air:(-?\d+):(-?\d+):(-?\d+)$/.exec(id);
  return m ? { depth: Number(m[1]), bx: Number(m[2]), bz: Number(m[3]) } : null;
}

const inBox = (b: SlotBox, cx: number, cz: number): boolean => cx >= b.cx && cx < b.cx + b.w && cz >= b.cz && cz < b.cz + b.h;

/** 町の系統（3 × 3 升目ごと。表と裏で同じ） */
export function wardFamily(world: number, depth: number, cx: number, cz: number, t: Tuning): string {
  const W = Math.max(1, t['world.wardSlots']);
  const pool = FAMILIES.filter((f) => f.id !== 'transit');
  return new Rng(hashAll(world, 'ward', depth, fdiv(cx, W), fdiv(cz, W))).weighted(pool, (f) => f.weight).id;
}

/** 升目 (cx, cz) を持つ区域の計画 */
export function planRegion(story: StoryKey, cx: number, cz: number, t: Tuning): RegionPlan {
  const { world, depth } = story;
  const L = t['world.slotM'];
  const slots = regionSlots(world, depth, cx, cz, t);
  const id = regionIdOf(slots);
  const rect: Rect = { x0: slots.cx * L, x1: (slots.cx + slots.w) * L, z0: slots.cz * L, z1: (slots.cz + slots.h) * L };
  const kind = regionKind(world, depth, slots, t);
  const gates = gatesOf(story, slots, id, kind, t);
  // 階段室: 区域はかならず 1 つの超ブロックの中にある
  const bx = fdiv(slots.cx, 2), bz = fdiv(slots.cz, 2);
  const airlocks: AirlockEnd[] = [];
  const dn = downSlot(world, depth, bx, bz);
  if (inBox(slots, dn[0], dn[1])) airlocks.push({ id: airlockId(depth, bx, bz), role: 'down', slot: dn, to: { world, depth: depth + 1, variant: 0 } });
  const up = downSlot(world, depth - 1, bx, bz);
  if (inBox(slots, up[0], up[1])) airlocks.push({ id: airlockId(depth - 1, bx, bz), role: 'up', slot: up, to: depth >= 1 ? { world, depth: depth - 1, variant: 0 } : null });
  const landings: LandingEnd[] = [];
  const ls = landingSlot(world, depth, bx, bz);
  if (inBox(slots, ls[0], ls[1])) landings.push({ id: landingId(depth, bx, bz), slot: ls });
  return { story, id, slots, rect, kind, seed: hashAll(world, 'region', depth, slots.cx, slots.cz), ward: wardFamily(world, depth, slots.cx, slots.cz, t), gates, airlocks, landings };
}

/** 区域の種類（升目の矩形のハッシュ。表と裏で同じ） */
export function regionKind(world: number, depth: number, slots: SlotBox, t: Tuning): RegionKind {
  return new Rng(hashAll(world, 'kind', depth, slots.cx, slots.cz)).weighted<RegionKind>(['district', 'patchwork'], (k) => (k === 'district' ? t['world.kind.district'] : t['world.kind.patchwork']));
}

/**
 * 区域の境目の扉: 隣の区域と接する升目の辺ごとに、world.gate.perEdge 個（どちらかが街区なら world.gate.perEdgeDistrict 個）。
 * 辺を等分した区間ごとに 1 つ（扉どうしが寄らない）。考えずに歩いても、どこかの壁で次の区域への扉に行き当たる
 */
function gatesOf(story: StoryKey, b: SlotBox, id: string, kind: RegionKind, t: Tuning): GateEnd[] {
  const { world, depth } = story;
  const L = t['world.slotM'];
  const corner = Math.min(t['world.gate.cornerM'], L / 2 - 2);
  // 隣の区域ごとの境目: 向き・線の座標・升目の辺の始まり（境目に沿った座標）・隣の種類
  const borders = new Map<string, { side: Dir; line: number; starts: number[]; kind: RegionKind }>();
  const add = (side: Dir, ncx: number, ncz: number, line: number, start: number): void => {
    const ob = regionSlots(world, depth, ncx, ncz, t);
    const other = regionIdOf(ob);
    if (other === id) return;
    const e = borders.get(other) ?? { side, line, starts: [], kind: regionKind(world, depth, ob, t) };
    e.starts.push(start);
    borders.set(other, e);
  };
  for (let j = 0; j < b.h; j++) {
    add(1, b.cx + b.w, b.cz + j, (b.cx + b.w) * L, (b.cz + j) * L);
    add(3, b.cx - 1, b.cz + j, b.cx * L, (b.cz + j) * L);
  }
  for (let i = 0; i < b.w; i++) {
    add(0, b.cx + i, b.cz + b.h, (b.cz + b.h) * L, (b.cx + i) * L);
    add(2, b.cx + i, b.cz - 1, b.cz * L, (b.cx + i) * L);
  }
  const out: GateEnd[] = [];
  for (const [other, e] of [...borders].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const border = [id, other].sort().join('|');
    const starts = e.starts.slice().sort((x, y) => x - y);
    const r = new Rng(hashAll(world, 'gate', depth, border));
    const n = Math.max(1, Math.round(kind === 'district' || e.kind === 'district' ? t['world.gate.perEdgeDistrict'] : t['world.gate.perEdge']));
    // 区間の間（隣の区間の扉と、扉の幅 + 壁の分は離す）
    const seg = (L - 2 * corner) / n, gap = Math.min(seg / 2, 2.4);
    starts.forEach((s0, k) => {
      for (let i = 0; i < n; i++) {
        const at = Math.round((s0 + corner + i * seg + gap / 2 + r.float(0, 1) * (seg - gap)) * 20) / 20;
        out.push({ id: `gate:${border}:${k}.${i}`, other, side: e.side, line: e.line, at });
      }
    });
  }
  return out;
}

/**
 * 計画の覚え書き（同じ区域の計画を何度も作らない。区域の計画は軽いが、隣の扉を求めるのに隣の升目の分け方を引く）。
 * 覚える数は max まで（古いものから忘れる）
 */
export class WorldPlanner {
  private readonly cache = new Map<string, RegionPlan>();
  readonly t: Tuning;
  private readonly max: number;
  constructor(t: Tuning, max = 512) { this.t = t; this.max = max; }

  /** 升目 (cx, cz) を持つ区域の計画 */
  at(story: StoryKey, cx: number, cz: number): RegionPlan {
    const b = regionSlots(story.world, story.depth, cx, cz, this.t);
    const key = `${story.world}:${story.depth}:${story.variant}:${b.cx}:${b.cz}`;
    const hit = this.cache.get(key);
    if (hit) { this.cache.delete(key); this.cache.set(key, hit); return hit; }
    const p = planRegion(story, b.cx, b.cz, this.t);
    this.cache.set(key, p);
    while (this.cache.size > this.max) this.cache.delete(this.cache.keys().next().value!);
    return p;
  }

  /** 区域の id の計画 */
  byId(story: StoryKey, id: string): RegionPlan {
    const c = parseRegionId(id);
    if (!c) throw new Error(`区域の id ではありません: ${id}`);
    return this.at(story, c[0], c[1]);
  }

  /** 階の座標 (x, z) を持つ区域の計画 */
  atPos(story: StoryKey, x: number, z: number): RegionPlan {
    const L = this.t['world.slotM'];
    return this.at(story, Math.floor(x / L), Math.floor(z / L));
  }
}
