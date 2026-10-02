/**
 * フロアの性質を seed から引く: 希少度・系統・骨組みの型・格子の大きさ。
 * フロアは (worldSeed, depth, variant) だけで決まる（歩いた順番に依存しない。V2-1）。
 */
import type { Tuning } from '../../config/tuning.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import { FAMILIES, type FloorFamily, type PatternId } from './themes.ts';

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

export function rollProfile(key: FloorKey, t: Tuning, salt = 0): FloorProfile {
  const seed = hashAll(floorSeed(key), 'profile', salt);
  const rng = new Rng(seed);
  // 最初の 2 階は落ち着いたフロア（はじめての人が仕組みに慣れる）
  const rarity = key.depth <= 0 ? 'Common' : rollRarity(rng.fork('rarity'), key.depth, t);
  const fam = rng.fork('family').weighted(FAMILIES.filter((f) => !f.minRarity || rarityRank(rarity) >= rarityRank(f.minRarity)), (f) => f.weight);
  const pattern = rng.fork('pattern').weighted(fam.patterns, ([, w]) => w)[0];
  const sz = rng.fork('size');
  let cols = sz.int(t['floor.colsMin'], Math.max(t['floor.colsMin'], t['floor.colsMax']));
  let rows = sz.int(t['floor.rowsMin'], Math.max(t['floor.rowsMin'], t['floor.rowsMax']));
  // 型ごとの形の都合
  if (pattern === 'linear') { cols = Math.max(cols, 5) + 1; rows = Math.min(rows, 2); }
  if (pattern === 'ring' || pattern === 'hub') { cols = Math.max(cols, 3) | 1; rows = Math.max(rows, 3) | 1; }
  if (pattern === 'comb') rows = Math.max(rows, 3);
  // 珍しいフロアは少し広い
  if (rarityRank(rarity) >= 3) { cols += 1; rows += 1; }
  return { key, id: floorId(key), seed, rarity, family: fam, pattern, cols, rows, spacing: t['floor.baySpacingM'] };
}
