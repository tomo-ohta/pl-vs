/**
 * 奇妙さ生成（oddity）: 「見慣れた場所なのに何かおかしい」を直接的な怪異を描かずに出す層。
 * generateLayout で generateRaw → applyDressing の後、Modifier の前に走る（Common の部屋にも掛かる唯一の非日常層）。
 *
 * 予算と主題（ユーザー指示 5 章）:
 *  - 部屋ごとに主題（strong）1 つ + 添え物（weak）1〜2 つを別カテゴリから選ぶ。何も無い部屋は Common で 18%（たまに正常）。
 *  - Uncommon / Rare は Modifier が主題を持つので主題は確率を下げ、Epic 以上は添え物 1 つだけ。
 *  - 主題は入口から見た正面（Ctx.focus）に置く（視線誘導。入室直後の 1 秒で読めるように）。
 *  - 全部盛りにしない（1 部屋 1 主題）。
 * 動線: 奇妙さ 1 つ（巨大モニュメント・主題・添え物・空き床のモニュメントそれぞれ）を置いた後、それまで入口から歩いて届いた
 *  床の高さの扉に届かなくなったら（reachDoors の近似）その奇妙さを取り消す（主題・添え物は次の候補を試す）。
 *  個々の置き方（canPlace の動線帯）は直線の帯しか守らないので、間仕切りの開口・家具の間の通路をまとめて塞ぐことがあった。
 * 開発用: `?noodd=1` で無効化。結果は (L as OddLayout).oddity に記録（デバッグ HUD / 統計）。
 */
import type { GenParams, RoomLayout } from '../layout';
import { ctxOf, type Ctx, type OddCategory, type Oddity, type Strength } from './shared';
import { LAYOUT_ODDITIES } from './layout';
import { CONTENT_ODDITIES } from './contents';
import { SURFACE_ODDITIES } from './surfaces';
import { TRACE_ODDITIES } from './traces';
import { SPACE_ODDITIES, isLargeEmpty } from './space';
import { fillOpenSpace, monument, placeGiantMonument } from './monument';
import { DISORDER_ODDITIES } from './disorder';
import { reachDoors } from '../reach';

export interface OddRecord { theme: string | null; accents: string[]; notes: string[] }
export type OddLayout = RoomLayout & { oddity?: OddRecord };

const DISABLED = typeof window !== 'undefined' && typeof window.location !== 'undefined' && new URLSearchParams(window.location.search).has('noodd');
/** 開発用: `?odd=<id>`（例 disorder.scatter）でその奇妙さを主題として必ず試す（撮影・確認用） */
const FORCED = typeof window !== 'undefined' && typeof window.location !== 'undefined' ? new URLSearchParams(window.location.search).get('odd') : null;

export const ALL_ODDITIES: Oddity[] = [...LAYOUT_ODDITIES, ...CONTENT_ODDITIES, ...SURFACE_ODDITIES, ...TRACE_ODDITIES, ...SPACE_ODDITIES, monument, ...DISORDER_ODDITIES];

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
  const keep = reachKeeper(L);
  // 広い部屋の中央の巨大モニュメント（Legendary は必ず、他は大部屋で 5 割。正常判定より先 = 「正常な部屋」でも置く）
  if (guarded(c, keep, 'giant monument', () => placeGiantMonument(c))) rec.notes.push('giant monument');
  // 広くて空の部屋（Legendary / Mythic 以外）は「ただの広い空間」にしない: 正常判定を飛ばし、space の主題を必ず 1 つ入れる
  const exemptWide = p.def.rarity === 'Legendary' || p.def.rarity === 'Mythic';
  const largeEmpty = !exemptWide && isLargeEmpty(c);
  if (!FORCED && !largeEmpty && rng.chance(budget.normal)) { rec.notes.push('normal room'); guarded(c, keep, 'fillOpenSpace', () => fillOpenSpace(c) > 0); rec.notes.push(...c.notes); return; }
  const used = new Set<OddCategory>();
  // 主題
  const forced = FORCED ? ALL_ODDITIES.find((o) => o.id === FORCED) : undefined;
  if (forced) {
    rec.theme = tryApply(c, keep, [forced], 'strong', used);
  } else if (largeEmpty) {
    rec.theme = tryApply(c, keep, [...SPACE_ODDITIES, monument], 'strong', used) ?? tryApply(c, keep, ALL_ODDITIES.filter((o) => o.theme), 'strong', used);
    rec.notes.push('large empty room');
  } else if (rng.chance(budget.theme)) {
    const themeId = tryApply(c, keep, ALL_ODDITIES.filter((o) => o.theme), 'strong', used);
    rec.theme = themeId;
  }
  // 添え物（主題と別カテゴリ）
  const n = rng.int(budget.accents[0], budget.accents[1]);
  for (let i = 0; i < n; i++) {
    const id = tryApply(c, keep, ALL_ODDITIES.filter((o) => !used.has(o.category)), 'weak', used);
    if (id) rec.accents.push(id);
  }
  // 広く空いた床のモニュメント（主題・添え物とは別枠）
  guarded(c, keep, 'fillOpenSpace', () => fillOpenSpace(c) > 0);
  rec.notes.push(...c.notes);
}

/** 重み付きで候補を試し、最初に apply が true を返した id。カテゴリを used に登録 */
function tryApply(c: Ctx, keep: ReachKeeper | null, candidates: Oddity[], strength: Strength, used: Set<OddCategory>): string | null {
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
    const undo = keep ? snapshot(c.L) : null;
    try { ok = o.apply(c, strength); } catch (e) { c.note(`${o.id}: ${String(e)}`); ok = false; }
    if (ok && keep && undo && !keep.intact()) { undo(); c.note(`${o.id}: undone (blocked a door)`); ok = false; }
    if (ok) { used.add(o.category); return o.id; }
  }
  return null;
}

/** 奇妙さを置く前に入口から届いた扉が、今も全部届くか */
interface ReachKeeper { intact(): boolean }

/** 入口から届く扉が 1 つも無い（入口が床に無い・もともと塞がっている）部屋は見張らない（null） */
function reachKeeper(L: RoomLayout): ReachKeeper | null {
  const r0 = reachDoors(L);
  if (!r0) return null;
  const was = r0.doors.filter((s) => !r0.blocked.includes(s.id)).map((s) => s.id);
  if (!was.length) return null;
  return {
    intact() {
      const r = reachDoors(L, undefined, was);
      return !r || r.blocked.length === 0;
    },
  };
}

/** fn（true = 何か置いた）を試し、扉に届かなくなったら取り消して false */
function guarded(c: Ctx, keep: ReachKeeper | null, label: string, fn: () => boolean): boolean {
  const undo = keep ? snapshot(c.L) : null;
  const ok = fn();
  if (ok && keep && undo && !keep.intact()) { undo(); c.note(`${label}: undone (blocked a door)`); return false; }
  return ok;
}

/**
 * layout の控え（取り消し用）。浅い複製で足りる: 奇妙さは箱・照明などを新しく作って配列に足すか配列ごと差し替え、
 * 既存の物を書き換えるのは乱れ（disorder）の propGroup / kind の付け替えと instances の transforms の splice だけなので、
 * その 2 つは別に控える。戻すときは元の配列・オブジェクトの参照に中身を戻す（ctx が L.sockets などの参照を握っているため）。
 * oddity の記録は控えない。控えの後に足されたフィールドは消す
 */
function snapshot(L: RoomLayout): () => void {
  const T = L as unknown as Record<string, unknown>;
  const saved: [string, unknown, unknown][] = [];
  for (const [k, v] of Object.entries(T)) {
    if (k === 'oddity') continue;
    saved.push([k, v, Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? { ...v } : v]);
  }
  const boxes = L.boxes.slice();
  const tags = boxes.map((b) => [b.propGroup, b.kind] as const);
  const transforms = (L.instances ?? []).map((sp) => [sp, sp.transforms.slice()] as const);
  return () => {
    for (const k of Object.keys(T)) if (k !== 'oddity' && !saved.some(([sk]) => sk === k)) delete T[k];
    for (const [k, ref, copy] of saved) {
      if (Array.isArray(ref)) {
        ref.length = 0;
        for (const x of copy as unknown[]) ref.push(x);
      } else if (ref && typeof ref === 'object') {
        const o = ref as Record<string, unknown>;
        for (const kk of Object.keys(o)) delete o[kk];
        Object.assign(o, copy);
      }
      T[k] = Array.isArray(ref) || (ref && typeof ref === 'object') ? ref : copy;
    }
    boxes.forEach((b, i) => {
      const [g, kind] = tags[i];
      if (g === undefined) delete b.propGroup; else b.propGroup = g;
      if (kind === undefined) delete b.kind; else b.kind = kind;
    });
    for (const [sp, tr] of transforms) { sp.transforms.length = 0; for (const t of tr) sp.transforms.push(t); }
  };
}
