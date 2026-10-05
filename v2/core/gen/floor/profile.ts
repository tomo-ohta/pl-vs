/**
 * フロアの性質を seed から引く: 希少度・系統・骨組みの型・格子の大きさ。
 * フロアは (worldSeed, depth, variant) だけで決まる（歩いた順番に依存しない。V2-1）。
 *
 * 段階 4（フロアの形）で足したこと:
 * - 型は系統の重み（FloorFamily.patterns）× 調整表 structure.w.<型> で引く。珍しい型は珍しいフロア・深い階にだけ（themes.ts の PATTERN_INFO）
 * - 駅の線: ある深さから 2〜3 フロア続けて駅（F35）。車両に乗ると隣の駅（次の深さ）の車両の中に着く。駅かどうかは
 *   (world, depth) のハッシュだけで決まる（前のフロアを作らなくても分かる）
 * - 階ごとに系統が違う型（縦に積んだビル・エレベーターホール・分棟）は、ほかの系統を families に足す（families[0] が主の系統）
 * - 型を指定して作る（確認用の ?shape=）: rollProfile の force
 */
import type { Tuning } from '../../config/tuning.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { FAMILIES, familyById, patternAllowed, type FloorFamily, type PatternId } from './themes.ts';

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
export const RARITIES: readonly Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const rarityRank = (r: Rarity): number => RARITIES.indexOf(r);

/** フロアの場所。variant 0 が表のフロア、1 以上は裏のフロアや別の分岐 */
export interface FloorKey {
  world: number;
  depth: number;
  variant: number;
}

export const floorId = (k: FloorKey): string => `${k.depth}.${k.variant}`;
export const floorSeed = (k: FloorKey): number => hashAll(k.world, 'floor', k.depth, k.variant);

export interface FloorProfile {
  key: FloorKey;
  id: string;
  seed: number;
  rarity: Rarity;
  family: FloorFamily;
  pattern: PatternId;
  cols: number;
  rows: number;
  spacing: number;
  /** 上下に重なる階の数（無ければ 1） */
  stories?: number;
  /** 階・棟ごとの系統（[0] は family と同じ）。縦に積んだビル・エレベーターホール・分棟 */
  families?: FloorFamily[];
  /** 区画の格子の原点（x と、入口の側の辺の z）。無ければ 0, 0（フロア）。果てしない階の区域は階の座標で直接作る */
  origin?: [number, number];
  /** 果てしない階の区域として作る（docs/endless-world.md 4 章）。無ければフロア（入口と出口の階段） */
  region?: RegionContext;
}

/** 区域の境目の扉（区域から見た向き。core/gen/world/plan.ts の GateEnd と同じ形） */
export interface RegionGate { id: string; side: Dir; line: number; at: number }
/** 区域の階段室（core/gen/world/plan.ts の AirlockEnd。to は向こうの階 'depth.variant'、null は上の階が無い） */
export interface RegionAirlock { id: string; kind: 'stairs' | 'lift'; role: 'down' | 'up'; slot: [number, number]; to: string | null }

/** 区域として作るときの情報 */
export interface RegionContext {
  id: string;
  kind: 'district' | 'patchwork';
  /** 区域の矩形（階の座標） */
  rect: Rect;
  /** 縁の帯（境目の扉までの道を通す） */
  margin: number;
  slotM: number;
  gates: RegionGate[];
  airlocks: RegionAirlock[];
  /** 隠しの穴から落ちてくる人が着く部屋（天井の穴と縦穴。core/gen/world/landing.ts） */
  landings?: { id: string; slot: [number, number] }[];
}

/** rollProfile の追加の指定（果てしない階の区域） */
export interface ProfileOptions {
  /** 系統を決めて引く（町の系統） */
  family?: FloorFamily;
  /** 使ってよい型（区域に置けない型を除く） */
  allow?: (p: PatternId) => boolean;
  /** 駅の線を見ない（区域の駅は区域の計画が決める） */
  noStation?: boolean;
}

export function rollRarity(rng: Rng, depth: number, t: Tuning): Rarity {
  const w: Record<Rarity, number> = {
    Common: t['rarity.w.common'],
    Uncommon: t['rarity.w.uncommon'],
    Rare: depth >= t['rarity.depth.rare'] ? t['rarity.w.rare'] : 0,
    Epic: depth >= t['rarity.depth.epic'] ? t['rarity.w.epic'] : 0,
    Legendary: depth >= t['rarity.depth.legendary'] ? t['rarity.w.legendary'] : 0,
    Mythic: depth >= t['rarity.depth.mythic'] ? t['rarity.w.mythic'] : 0,
  };
  return rng.weighted(RARITIES, (r) => w[r]);
}

/** 駅の線が始まれる間隔（深さ 1, 1 + 間隔, …。線の長さ 2〜3 より長くして、線どうしが重ならないように） */
const LINE_SLOT = 4;

/** 駅の線の長さ（線が始まる深さ d0 から何フロア駅が続くか。始まらなければ 0） */
function lineFrom(world: number, d0: number, t: Tuning): number {
  if (d0 < 1 || (d0 - 1) % LINE_SLOT !== 0) return 0;
  const r = new Rng(hashAll(world, 'stationLine', d0));
  return r.chance(t['structure.station.chance']) ? r.int(2, 3) : 0;
}

/** この深さが駅か（線の途中か） */
export function isStation(world: number, depth: number, t: Tuning): boolean {
  if (depth < 1) return false;
  const d0 = depth - ((depth - 1) % LINE_SLOT);
  return depth - d0 < lineFrom(world, d0, t);
}

/** 次の深さも同じ線の駅か（車両に乗ると次の駅に着く。線の終わりの駅の車両は、ふつうの次のフロアへ） */
export function stationContinues(world: number, depth: number, t: Tuning): boolean {
  return isStation(world, depth, t) && isStation(world, depth + 1, t);
}

export function rollProfile(key: FloorKey, t: Tuning, salt = 0, force?: PatternId, o: ProfileOptions = {}, seedBase = floorSeed(key)): FloorProfile {
  const seed = hashAll(seedBase, 'profile', salt);
  const rng = new Rng(seed);
  // 最初の 2 階は落ち着いたフロア（はじめての人が仕組みに慣れる）
  const rarity = key.depth <= 0 ? 'Common' : rollRarity(rng.fork('rarity'), key.depth, t);
  const famPick = rng.fork('family').weighted(FAMILIES.filter((f) => !f.minRarity || rarityRank(rarity) >= rarityRank(f.minRarity)), (f) => f.weight);
  let fam = o.family && (!o.family.minRarity || rarityRank(rarity) >= rarityRank(o.family.minRarity)) ? o.family : famPick;
  // 駅の線（F35）: 系統は駅の連絡通路
  const station = force ? force === 'station' : !o.noStation && isStation(key.world, key.depth, t);
  if (station) fam = familyById('transit');
  const mul = (p: PatternId): number => {
    const v = (t as unknown as Record<string, number | boolean | undefined>)[`structure.w.${p}`];
    return typeof v === 'number' ? v : 1;
  };
  const allowed = fam.patterns.filter(([p]) => p !== 'station' && patternAllowed(p, rarity, key.depth));
  const choices = o.allow ? allowed.filter(([p]) => o.allow!(p)) : allowed;
  const pattern: PatternId = force ?? (station ? 'station' : rng.fork('pattern').weighted(choices.length ? choices : ([['grid', 1]] as [PatternId, number][]), ([p, w]) => w * mul(p))[0]);
  const sz = rng.fork('size');
  let cols = sz.int(t['floor.colsMin'], Math.max(t['floor.colsMin'], t['floor.colsMax']));
  let rows = sz.int(t['floor.rowsMin'], Math.max(t['floor.rowsMin'], t['floor.rowsMax']));
  let spacing = t['floor.baySpacingM'];
  // 型ごとの形の都合
  if (pattern === 'linear') { cols = Math.max(cols, 5) + 1; rows = Math.min(rows, 2); }
  if (pattern === 'ring' || pattern === 'hub') { cols = Math.max(cols, 3) | 1; rows = Math.max(rows, 3) | 1; }
  if (pattern === 'comb') rows = Math.max(rows, 3);
  // 珍しいフロアは少し広い
  if (rarityRank(rarity) >= 3) { cols += 1; rows += 1; }
  const prof: FloorProfile = { key, id: floorId(key), seed, rarity, family: fam, pattern, cols, rows, spacing };
  shapeProfile(prof, t, rng.fork('shape'));
  return prof;
}

/** 段階 4 の型の大きさ・区画の間隔・階の数・ほかの系統（型ごとの形の都合） */
function shapeProfile(p: FloorProfile, t: Tuning, rng: Rng): void {
  const big = rarityRank(p.rarity) >= 3 ? 1 : 0;
  const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
  const otherFamilies = (n: number): FloorFamily[] => {
    const pool = FAMILIES.filter((f) => f.id !== p.family.id && (!f.minRarity || rarityRank(p.rarity) >= rarityRank(f.minRarity)));
    const out: FloorFamily[] = [p.family];
    while (out.length < n && pool.length) {
      const f = rng.weighted(pool, (x) => x.weight);
      pool.splice(pool.indexOf(f), 1);
      out.push(f);
    }
    return out;
  };
  switch (p.pattern) {
    case 'chain':
      p.spacing = t['structure.chain.spacingM'];
      p.cols = clamp(p.cols + 1, 4, 6); p.rows = clamp(p.rows, 3, 5);
      break;
    case 'courtyard':
      p.spacing = t['structure.chain.spacingM'];
      p.cols = clamp(p.cols, 4, 5 + big); p.rows = clamp(p.rows, 4, 5);
      break;
    case 'shortcut':
      p.cols = clamp(p.cols, 4, 5 + big); p.rows = clamp(p.rows, 3, 4 + big);
      break;
    case 'loops':
      p.cols = 5 + big; p.rows = clamp(p.rows, 4, 5);
      break;
    case 'concentric':
      p.cols = 5; p.rows = 5;
      break;
    case 'skip':
      p.spacing = t['structure.skip.spacingM'];
      p.cols = clamp(p.cols, 3, 4); p.rows = clamp(p.rows, 3, 4);
      break;
    case 'gallery':
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 3, 4);
      p.stories = 2;
      break;
    case 'megahall':
    case 'nest':
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 3, 4);
      break;
    case 'crossing':
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 4, 5);
      p.stories = 2;
      break;
    case 'islands':
      p.spacing = t['floor.baySpacingM'] + 1;
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 3, 4);
      break;
    case 'mirror':
      p.cols = p.cols >= 5 ? 5 : 3; p.rows = clamp(p.rows, 3, 4);
      if (p.cols === 3) p.rows = clamp(p.rows + 1, 4, 5);
      break;
    case 'staff':
      p.cols = clamp(p.cols + 1, 4, 6); p.rows = 4;
      break;
    case 'crawl':
      p.cols = clamp(p.cols, 3, 4); p.rows = clamp(p.rows, 3, 4);
      break;
    case 'tower':
    case 'elevator':
      p.cols = 3; p.rows = 3;
      p.stories = rng.int(t['structure.towerStoriesMin'], Math.max(t['structure.towerStoriesMin'], t['structure.towerStoriesMax']));
      p.families = otherFamilies(p.stories);
      break;
    case 'descent':
      p.spacing = t['structure.descent.spacingM'];
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 3, 4);
      break;
    case 'shaft':
      p.cols = 5; p.rows = clamp(p.rows, 4, 5);
      break;
    case 'rooftop':
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 3, 4);
      break;
    case 'arcade':
      p.cols = clamp(p.cols, 4, 5); p.rows = clamp(p.rows, 4, 5);
      break;
    case 'wings':
      // 棟（2 列ずつ）の間に渡り廊下の列を挟む: 2 棟なら 5 列、3 棟なら 8 列
      p.cols = big ? 8 : 5; p.rows = clamp(p.rows, 3, 4);
      p.families = otherFamilies(big ? 3 : 2);
      break;
    case 'station':
      p.cols = clamp(p.cols, 4, 5); p.rows = 3;
      break;
    default:
      break;
  }
}
