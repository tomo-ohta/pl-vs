/**
 * 奇妙さ生成（oddity）: 「見慣れた場所なのに何かおかしい」を直接的な怪異を描かずに出す層。
 * generateLayout で generateRaw → applyDressing の後、Modifier の前に走る（Common の部屋にも掛かる唯一の非日常層）。
 *
 * 予算と主題（ユーザー指示 5 章）:
 *  - 部屋ごとに主題（strong）1 つ + 添え物（weak）1〜2 つを別カテゴリから選ぶ。何も無い部屋は Common で 18%（たまに正常）。
 *  - Uncommon / Rare は Modifier が主題を持つので主題は確率を下げ、Epic 以上は添え物 1 つだけ。
 *  - 主題は入口から見た正面（Ctx.focus）に置く（視線誘導。入室直後の 1 秒で読めるように）。
 *  - 全部盛りにしない（1 部屋 1 主題）。
 * 開発用: `?noodd=1` で無効化。結果は (L as OddLayout).oddity に記録（デバッグ HUD / 統計）。
 */
import type { GenParams, RoomLayout } from '../layout';
import { ctxOf, type Ctx, type OddCategory, type Oddity, type Strength } from './shared';
import { LAYOUT_ODDITIES } from './layout';
import { CONTENT_ODDITIES } from './contents';
import { SURFACE_ODDITIES } from './surfaces';
import { TRACE_ODDITIES } from './traces';
import { SPACE_ODDITIES, isLargeEmpty } from './space';
import { monument } from './monument';

export interface OddRecord { theme: string | null; accents: string[]; notes: string[] }
export type OddLayout = RoomLayout & { oddity?: OddRecord };

const DISABLED = typeof window !== 'undefined' && typeof window.location !== 'undefined' && new URLSearchParams(window.location.search).has('noodd');

export const ALL_ODDITIES: Oddity[] = [...LAYOUT_ODDITIES, ...CONTENT_ODDITIES, ...SURFACE_ODDITIES, ...TRACE_ODDITIES, ...SPACE_ODDITIES, monument];

/** 希少度ごとの予算 */
const BUDGET: Record<string, { normal: number; theme: number; accents: [number, number] }> = {
  Common: { normal: 0.18, theme: 1.0, accents: [1, 2] },
  Uncommon: { normal: 0.1, theme: 0.5, accents: [1, 2] },
  Rare: { normal: 0.1, theme: 0.35, accents: [1, 1] },
  Epic: { normal: 0.3, theme: 0, accents: [1, 1] },
  Legendary: { normal: 0.3, theme: 0, accents: [1, 1] },
  Mythic: { normal: 1, theme: 0, accents: [0, 0] },
};

export function applyOddity(L: RoomLayout, p: GenParams): void {
  if (DISABLED) return;
  if (L.roll || L.render?.style === 'untextured' || !L.footprint.length) return;
  const rng = p.rng.fork('odd');
  const budget = BUDGET[p.def.rarity] ?? BUDGET.Common;
  const rec: OddRecord = { theme: null, accents: [], notes: [] };
  (L as OddLayout).oddity = rec;
  const c = ctxOf(L, p, rng);
  // 広くて空の部屋（Legendary / Mythic 以外）は「ただの広い空間」にしない: 正常判定を飛ばし、space の主題を必ず 1 つ入れる
  const exemptWide = p.def.rarity === 'Legendary' || p.def.rarity === 'Mythic';
  const largeEmpty = !exemptWide && isLargeEmpty(c);
  if (!largeEmpty && rng.chance(budget.normal)) { rec.notes.push('normal room'); return; }
  const used = new Set<OddCategory>();
  // 主題
  if (largeEmpty) {
    rec.theme = tryApply(c, [...SPACE_ODDITIES, monument], 'strong', used) ?? tryApply(c, ALL_ODDITIES.filter((o) => o.theme), 'strong', used);
    rec.notes.push('large empty room');
  } else if (rng.chance(budget.theme)) {
    const themeId = tryApply(c, ALL_ODDITIES.filter((o) => o.theme), 'strong', used);
    rec.theme = themeId;
  }
  // 添え物（主題と別カテゴリ）
  const n = rng.int(budget.accents[0], budget.accents[1]);
  for (let i = 0; i < n; i++) {
    const id = tryApply(c, ALL_ODDITIES.filter((o) => !used.has(o.category)), 'weak', used);
    if (id) rec.accents.push(id);
  }
  rec.notes.push(...c.notes);
}

/** 重み付きで候補を試し、最初に apply が true を返した id。カテゴリを used に登録 */
function tryApply(c: Ctx, candidates: Oddity[], strength: Strength, used: Set<OddCategory>): string | null {
  const pool = candidates.filter((o) => {
    try { return o.applicable(c); } catch { return false; }
  });
  while (pool.length) {
    const total = pool.reduce((a, o) => a + o.weight, 0);
    let r = c.rng.float(0, total);
    let idx = 0;
    for (; idx < pool.length - 1; idx++) { r -= pool[idx].weight; if (r <= 0) break; }
    const o = pool.splice(idx, 1)[0];
    let ok = false;
    try { ok = o.apply(c, strength); } catch (e) { c.note(`${o.id}: ${String(e)}`); ok = false; }
    if (ok) { used.add(o.category); return o.id; }
  }
  return null;
}
