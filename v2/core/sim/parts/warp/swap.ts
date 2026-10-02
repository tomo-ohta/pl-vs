/**
 * swapSet: 見ていない間に作り替える（振り返ると変わる・曲がると変わる・4 回曲がっても戻らない・異変の廊下）。
 *
 * params:
 *   slots … [{ region, variants: [[箱 …], …], init? }]。region は見え方を調べる範囲。variants は差し替える箱の組（JSON の Box）
 *   mode  … 'input'（入力 t<i> の値の組にする。配線が無ければ init のまま）/ 'random'（一度見られたあと、見ていない間に別の組へ）
 *   minUnseen … 見ていない時間がこれだけ続いたら差し替える（秒）
 *   chance … random のとき、差し替える機会ごとの確率
 * outputs: changes（差し替えた回数）・v<i>（区画 i の今の組）
 *
 * 当たる箱（solid）は動く当たり判定に置く。差し替えた先の当たる箱にプレイヤーが重なるときは差し替えない
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pStr, type PartContext } from '../../part.ts';
import { readAabb, seenBy } from './util.ts';

export interface SwapBox { min: number[]; max: number[]; mat: string; solid?: boolean }
interface Slot { region: AABB; variants: SwapBox[][]; init: number }

function slotsOf(v: Json | undefined): Slot[] {
  return ((v as unknown[] | undefined) ?? []).map((x) => {
    const o = x as { region: Json; variants: SwapBox[][]; init?: number };
    return { region: readAabb(o.region), variants: o.variants, init: o.init ?? 0 };
  });
}

function setVariant(ctx: PartContext, i: number, slot: Slot, from: number, to: number): void {
  (slot.variants[from] ?? []).forEach((_b, j) => ctx.setCollider(`s${i}:${from}:${j}`, null));
  (slot.variants[to] ?? []).forEach((b, j) => { if (b.solid) ctx.setCollider(`s${i}:${to}:${j}`, { min: [b.min[0]!, b.min[1]!, b.min[2]!], max: [b.max[0]!, b.max[1]!, b.max[2]!] }); });
}

/** 箱の組のどれかにプレイヤーの体が重なる */
function overlapsPlayer(ctx: PartContext, boxes: SwapBox[]): boolean {
  return ctx.players.some((p) => boxes.some((b) => b.solid && p.pos[0] + 0.4 > b.min[0]! && p.pos[0] - 0.4 < b.max[0]! && p.pos[2] + 0.4 > b.min[2]! && p.pos[2] - 0.4 < b.max[2]! && p.pos[1] + 1.8 > b.min[1]! && p.pos[1] < b.max[1]!));
}

definePart<{ cur: number[]; seen: number[]; unseen: number[]; changes: number }>({
  type: 'swapSet',
  init(ctx) {
    const slots = slotsOf(ctx.spec.params.slots);
    const cur = slots.map((s) => s.init);
    slots.forEach((s, i) => setVariant(ctx, i, s, cur[i]!, cur[i]!));
    return { cur, seen: slots.map(() => 0), unseen: slots.map(() => 0), changes: 0 };
  },
  step(s, ctx) {
    const slots = slotsOf(ctx.spec.params.slots);
    const mode = pStr(ctx.spec, 'mode', 'input');
    const minUnseen = pNum(ctx.spec, 'minUnseen', 0.3);
    const chance = pNum(ctx.spec, 'chance', 1);
    const sight = ctx.sightClear?.bind(ctx);
    slots.forEach((slot, i) => {
      const seen = ctx.players.some((p) => seenBy(p, slot.region, sight));
      if (seen) { s.seen[i] = 1; s.unseen[i] = 0; } else s.unseen[i] = (s.unseen[i] ?? 0) + ctx.dt;
      const cur = s.cur[i] ?? 0;
      let want = cur;
      if (mode === 'random') {
        if (s.seen[i] && (s.unseen[i] ?? 0) >= minUnseen && slot.variants.length > 1) {
          s.seen[i] = 0;
          if (ctx.random() < chance) want = (cur + 1 + Math.floor(ctx.random() * (slot.variants.length - 1))) % slot.variants.length;
        }
      } else if (ctx.wired(`t${i}`)) want = Math.max(0, Math.min(slot.variants.length - 1, Math.round(ctx.input(`t${i}`))));
      if (want !== cur && !seen && (s.unseen[i] ?? 0) >= minUnseen && !overlapsPlayer(ctx, slot.variants[want] ?? [])) {
        setVariant(ctx, i, slot, cur, want);
        s.cur[i] = want;
        s.changes++;
      }
      ctx.output(`v${i}`, s.cur[i] ?? 0);
    });
    ctx.output('changes', s.changes);
  },
});
