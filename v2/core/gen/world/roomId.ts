/**
 * ルーム ID（docs/endless-world.md 15 章）: 果てしない階の部屋（区画）ごとの番号。URL（`?id=`）とタブの名前（`Room 1234`）に出し、
 * その番号から部屋へ直接飛べる。
 *
 * 部屋は (階の深さ, 表・裏, 区域のいちばん小さい升目 cx・cz, 区域の区画の並びの番号) で決まる。これを 1 つの番号にして、
 * 世界の seed を鍵にした並べ替え（Feistel の暗号の形。往復できる）を通す: 隣の部屋どうしでも番号は無関係になり、seed が違えば
 * 割り当ても変わる。世界は果てしないので、殻（深さ・|cx|・|cz| のいちばん大きい物 s）ごとに番号の範囲を分け、殻の中だけで並べ替える
 * （出発点に近い部屋ほど番号が短い。s = 0 は 4 桁、深さ 10 ほどで 7 桁）。
 *
 * 番号はあるが部屋の無い所（区域のいちばん小さい升目でない・区画の並びの数より大きい・階段室やエレベーターのかご・別の空間）は
 * 「存在しない ID」（飛べない）。
 */
import { hashAll } from '../../math/rng.ts';
import type { CellLayout, FloorLayout } from '../../world/layout.ts';
import { parseRegionId, type StoryKey } from './plan.ts';

/** 区域 1 つの区画の数の上限（これより後ろの区画は番号を持たない。区域の区画は多くて 120 ほど） */
export const ROOM_CELLS = 256;
const VARIANTS = 2;
const PER = VARIANTS * ROOM_CELLS;
/** いちばん小さい番号（4 桁から） */
export const ROOM_ID_BASE = 1000;
/** 殻の上限（深さ・|cx|・|cz| がこれ未満の部屋だけ番号を持つ。数の誤差の出ない範囲） */
const MAX_SHELL = 20000;

/** 部屋の場所 */
export interface RoomRef {
  depth: number;
  variant: number;
  /** 区域のいちばん小さい升目（区域の id） */
  cx: number;
  cz: number;
  /** 区域の layout の区画の並びの番号 */
  cell: number;
}

const zig = (v: number): number => (v >= 0 ? 2 * v : -2 * v - 1);
const unzig = (v: number): number => (v % 2 === 0 ? v / 2 : -(v + 1) / 2);

/** 殻 s の (d, x, z)（どれも 0 以上・いちばん大きい物が s）の数 */
const shellTriples = (s: number): number => 3 * s * s + 3 * s + 1;

function tripleIndex(d: number, x: number, z: number, s: number): number {
  const A = (s + 1) * (s + 1), B = s * (s + 1);
  if (d === s) return x * (s + 1) + z;
  if (x === s) return A + d * (s + 1) + z;
  return A + B + d * s + x;
}

function tripleAt(t: number, s: number): [number, number, number] {
  const A = (s + 1) * (s + 1), B = s * (s + 1);
  if (t < A) return [s, Math.floor(t / (s + 1)), t % (s + 1)];
  const u = t - A;
  if (u < B) return [Math.floor(u / (s + 1)), s, u % (s + 1)];
  const w = u - B;
  return [Math.floor(w / s), w % s, s];
}

// ---------------------------------------------------------------- 範囲 [0, n) の並べ替え（Feistel 4 段 + はみ出したらもう一度）
const ROUNDS = 4;

function halves(n: number): number {
  let bits = 1;
  while (2 ** bits < n) bits++;
  return Math.max(1, Math.ceil(bits / 2));
}

function feistel(v: number, h: number, key: number, inverse: boolean): number {
  const M = 2 ** h, mask = M - 1;
  let L = Math.floor(v / M), R = v % M;
  if (!inverse) {
    for (let r = 0; r < ROUNDS; r++) { const f = hashAll(key, r, R) & mask; [L, R] = [R, (L ^ f) >>> 0]; }
  } else {
    for (let r = ROUNDS - 1; r >= 0; r--) { const f = hashAll(key, r, L) & mask; [L, R] = [(R ^ f) >>> 0, L]; }
  }
  return L * M + R;
}

function permute(v: number, n: number, key: number, inverse: boolean): number {
  const h = halves(n);
  let x = feistel(v, h, key, inverse);
  while (x >= n) x = feistel(x, h, key, inverse);
  return x;
}

const shellKey = (world: number, s: number): number => hashAll('roomId', world >>> 0, s);

// ---------------------------------------------------------------- 番号 ↔ 部屋の場所
/** 部屋の場所の番号（番号を持たない場所は null） */
export function encodeRoomId(world: number, r: RoomRef): number | null {
  if (r.cell < 0 || r.cell >= ROOM_CELLS || r.variant < 0 || r.variant >= VARIANTS || r.depth < 0) return null;
  const d = r.depth, x = zig(r.cx), z = zig(r.cz);
  const s = Math.max(d, x, z);
  if (s >= MAX_SHELL) return null;
  const local = (tripleIndex(d, x, z, s) * VARIANTS + r.variant) * ROOM_CELLS + r.cell;
  return ROOM_ID_BASE + PER * s ** 3 + permute(local, PER * shellTriples(s), shellKey(world, s), false);
}

/** 番号の部屋の場所（番号の形でなければ null。部屋があるかは区域を作って roomCellOk で確かめる） */
export function decodeRoomId(world: number, id: number | string): RoomRef | null {
  const str = String(id).trim();
  if (!/^\d{1,16}$/.test(str)) return null;
  const n = Number(str) - ROOM_ID_BASE;
  if (!Number.isSafeInteger(n) || n < 0) return null;
  let s = Math.floor(Math.cbrt(n / PER));
  while (s > 0 && PER * s ** 3 > n) s--;
  while (PER * (s + 1) ** 3 <= n) s++;
  if (s >= MAX_SHELL) return null;
  const j = permute(n - PER * s ** 3, PER * shellTriples(s), shellKey(world, s), true);
  const t = Math.floor(j / PER), rem = j % PER;
  const [d, x, z] = tripleAt(t, s);
  return { depth: d, variant: Math.floor(rem / ROOM_CELLS), cx: unzig(x), cz: unzig(z), cell: rem % ROOM_CELLS };
}

// ---------------------------------------------------------------- 区域の区画
/** ルーム ID を持つ区画か（階段室・エレベーターのかご（上下の階の写し）と、warp の別の空間は持たない） */
export function isRoomCell(L: FloorLayout, c: CellLayout): boolean {
  if (c.pocket) return false;
  return !(L.region?.airlocks ?? []).some((a) => a.cell === c.id);
}

/** 区域の区画 index の部屋の場所（番号を持たない区画は null） */
export function roomRefOf(L: FloorLayout, story: Pick<StoryKey, 'depth' | 'variant'>, index: number): RoomRef | null {
  const c = L.cells[index];
  const o = L.region ? parseRegionId(L.region.id) : null;
  if (!c || !o || !isRoomCell(L, c)) return null;
  return { depth: story.depth, variant: story.variant, cx: o[0], cz: o[1], cell: index };
}

/** 区域の区画 index のルーム ID（番号を持たない区画は null） */
export function roomIdOf(world: number, L: FloorLayout, story: Pick<StoryKey, 'depth' | 'variant'>, index: number): number | null {
  const r = roomRefOf(L, story, index);
  return r ? encodeRoomId(world, r) : null;
}

/** 部屋の場所 r が、区域 L（r の区域を作った物）の中に本当にあるか */
export function roomCellOk(L: FloorLayout, r: RoomRef): boolean {
  const o = L.region ? parseRegionId(L.region.id) : null;
  if (!o || o[0] !== r.cx || o[1] !== r.cz) return false;
  const c = L.cells[r.cell];
  return !!c && isRoomCell(L, c);
}

/**
 * 点 p のいる区画の index（区域 L の中。いなければ -1）。足元の高さで、上下に重なる区画（中二階・塔）を分ける:
 * 床の高さが足元より 0.6 m 下までの区画のうち、いちばん高い床
 */
export function cellIndexAt(L: FloorLayout, p: readonly number[]): number {
  let best = -1, bestY = -Infinity;
  L.cells.forEach((c, i) => {
    if (c.floorY > p[1]! + 0.6 || c.floorY <= bestY) return;
    if (p[1]! > c.floorY + c.height + 0.5 && p[1]! > c.bounds.max[1]) return;
    if (!c.footprint.some((f) => p[0]! >= f.x0 && p[0]! <= f.x1 && p[2]! >= f.z0 && p[2]! <= f.z1)) return;
    best = i;
    bestY = c.floorY;
  });
  return best;
}
