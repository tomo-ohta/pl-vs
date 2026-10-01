/** レア度抽選（07 シート）: 基礎重み / 最低深度 / 高レア連続抑制 / 救済。バイオームは無い（D4）。
 *
 *  開発用フック '?force=<ROOM_ID>': 次の部屋抽選をその定義に固定する（1 回使ったら解除）。
 *  存在しない ID / オミット部屋は無視してコンソールに警告を出す。
 *  統合担当向け: URL は module 読み込み時に自動で読む。プログラムからは setForcedRoomId('R16') でも指定できる。
 */
import type { Rng } from '../core/rng';
import type { GeneratorContext, Rarity, RoomDefinition } from '../core/types';
import { RARITIES } from '../core/types';
import { isImplemented, isOmitted, RARITY_MIN_DEPTH, RARITY_WEIGHT, ROOM_BY_ID, ROOMLIKE_GENERATORS, ROOMS_BY_RARITY, SMALL_TEMPLATES } from '../data';

export function rollRarity(rng: Rng, ctx: GeneratorContext): Rarity {
  const hasHighRecent = ctx.recentRarities.some((r) => r === 'Epic' || r === 'Legendary' || r === 'Mythic');
  const candidates = RARITIES.filter((r) => ctx.depth >= RARITY_MIN_DEPTH[r]);
  return rng.weighted(candidates, (r) => {
    let w = RARITY_WEIGHT[r];
    if (hasHighRecent && (r === 'Epic' || r === 'Legendary' || r === 'Mythic')) w *= 0.5;
    if (r === 'Rare' && ctx.roomsSinceRare >= 6) w *= 1 + 0.25 * (ctx.roomsSinceRare - 5);
    return w;
  });
}

export interface DefinitionPick {
  def: RoomDefinition;
  fallback: boolean;
}

export interface PickOptions {
  /** 親が廊下なら部屋を、親が部屋なら廊下をやや優先（単調な連鎖を避ける） */
  prefer?: 'room' | 'corridor' | null;
  /** hole の落下先など、天井穴の入口を持てる Generator に限定 */
  roomLikeOnly?: boolean;
  /** SEAM-4: SmallRoom / Restroom 系（Common / Uncommon・実装済み）から一様抽選。レア度は無視する */
  smallOnly?: boolean;
  /** 抽選を固定する定義 id（?force= / ConnectHook）。存在しなければ通常抽選 */
  forceDefinitionId?: string;
}

/** SEAM-4 用の小部屋定義（決定論のため定義順は rooms.json のまま） */
export const SMALL_DEFS: readonly RoomDefinition[] = [...ROOM_BY_ID.values()].filter(
  (d) => SMALL_TEMPLATES.has(d.baseTemplate) && isImplemented(d) && !isOmitted(d) && (d.rarity === 'Common' || d.rarity === 'Uncommon'),
);

/** レア度内は一様抽選。実装済み Generator の定義を優先し、無ければ fallback（LargeRoom 代替）。 */
export function pickDefinition(rng: Rng, rarity: Rarity, ctx: GeneratorContext, opts: PickOptions = {}): DefinitionPick {
  if (opts.forceDefinitionId) {
    const forced = ROOM_BY_ID.get(opts.forceDefinitionId);
    if (forced) return { def: forced, fallback: !isImplemented(forced) };
  }
  if (opts.smallOnly && SMALL_DEFS.length > 0) {
    const def = rng.pick(SMALL_DEFS);
    return { def, fallback: false };
  }
  const all = (ROOMS_BY_RARITY.get(rarity) ?? []).filter((d) => !isOmitted(d));
  let pool = all.filter(isImplemented);
  if (pool.length === 0) pool = all;
  if (opts.roomLikeOnly) {
    const rl = pool.filter((d) => ROOMLIKE_GENERATORS.has(d.generator));
    if (rl.length > 0) pool = rl;
  }
  const def = rng.weighted(pool, (d) => {
    let w = ctx.discoveredIds.has(d.id) ? 0.6 : 1.0;
    const isCorridor = d.generator === 'CorridorGenerator';
    if (opts.prefer === 'room' && !isCorridor) w *= 2.2;
    if (opts.prefer === 'corridor' && isCorridor) w *= 1.6;
    return w;
  });
  return { def, fallback: !isImplemented(def) };
}

// ------------------------------------------------------------ 開発用フック ?force=<ROOM_ID>
let forcedRoomId: string | null = null;

/** 次の抽選を固定する（存在しない ID / オミット部屋は無視して警告） */
export function setForcedRoomId(id: string | null): void {
  if (id === null) {
    forcedRoomId = null;
    return;
  }
  const def = ROOM_BY_ID.get(id);
  if (!def || isOmitted(def)) {
    console.warn(`[force] unknown or omitted room id: ${id}`);
    forcedRoomId = null;
    return;
  }
  forcedRoomId = id;
  console.info(`[force] next room roll fixed to ${id} (${def.name})`);
}

/** 現在固定中の定義 id（消費しない） */
export function peekForcedRoomId(): string | null {
  return forcedRoomId;
}

/** 固定を解除する（WorldManager.finalize が固定した部屋を配置し終えたとき） */
export function clearForcedRoomId(): void {
  forcedRoomId = null;
}

/** URL の ?force=<ROOM_ID> を読む（ブラウザのみ。Node では何もしない） */
export function readForceParam(): void {
  if (typeof location === 'undefined' || typeof location.search !== 'string') return;
  try {
    const v = new URLSearchParams(location.search).get('force');
    if (v) setForcedRoomId(v.toUpperCase());
  } catch {
    /* URL が読めない環境では無視 */
  }
}

readForceParam();
