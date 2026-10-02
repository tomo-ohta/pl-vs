/**
 * swapSet: 見ていない間に作り替える（振り返ると変わる・曲がると変わる・4 回曲がっても戻らない・異変の廊下）。
 *
 * params:
 *   slots … [{ region, also?, variants: [[箱 …], …], init?, stayOut? }]。region は見え方を調べる範囲（also は足して調べる範囲の列。
 *           壁の向こうの差し替えの、こちら側の面など）。variants は差し替える箱の組（JSON の Box）。
 *           stayOut なら、region の中（0.3 m の余裕）に人がいる間は差し替えない
 *   mode  … 'input'（入力 t<i> の値の組にする。配線が無ければ init のまま）/ 'random'（一度見られたあと、見ていない間に別の組へ）
 *   minUnseen … 見ていない時間がこれだけ続いたら差し替える（秒）
 *   chance … random のとき、差し替える機会ごとの確率
 *   order … random のときの次の組: 'random'（既定。今と違う組から選ぶ）/ 'cycle'（次の番号の組）
 *   every … 見え方を調べる間隔（tick。既定 4）
 * outputs: changes（差し替えた回数）・v<i>（区画 i の今の組）
 *
 * 当たる箱（solid）は動く当たり判定に置く。差し替えた先の当たる箱にプレイヤーが重なるときは差し替えない
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pStr, type PartContext } from '../../part.ts';
import { inBox, readAabb, seenBy } from './util.ts';

export interface SwapBox { min: number[]; max: number[]; mat: string; solid?: boolean }
interface Slot { region: AABB; also: AABB[]; variants: SwapBox[][]; init: number; stayOut: boolean }

function slotsOf(v: Json | undefined): Slot[] {
  return ((v as unknown[] | undefined) ?? []).map((x) => {
    const o = x as { region: Json; also?: Json[]; variants: SwapBox[][]; init?: number; stayOut?: boolean };
    return { region: readAabb(o.region), also: (o.also ?? []).map(readAabb), variants: o.variants, init: o.init ?? 0, stayOut: !!o.stayOut };
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

definePart<{ cur: number[]; seen: number[]; unseen: number[]; vis: number[]; changes: number }>({
  type: 'swapSet',
  init(ctx) {
    const slots = slotsOf(ctx.spec.params.slots);
    const cur = slots.map((s) => s.init);
    slots.forEach((s, i) => setVariant(ctx, i, s, cur[i]!, cur[i]!));
    return { cur, seen: slots.map(() => 0), unseen: slots.map(() => 0), vis: slots.map(() => 1), changes: 0 };
  },
  step(s, ctx) {
    const slots = slotsOf(ctx.spec.params.slots);
    const mode = pStr(ctx.spec, 'mode', 'input');
    const minUnseen = pNum(ctx.spec, 'minUnseen', 0.3);
    const chance = pNum(ctx.spec, 'chance', 1);
    const sight = ctx.sightClear?.bind(ctx);
    // 見え方は every tick ごとに調べる（見通しの検査は重いので）。間の tick は前の結果
    const every = Math.max(1, Math.round(pNum(ctx.spec, 'every', 4)));
    const check = ctx.tick % every === 0;
    s.vis ??= slots.map(() => 1);
    const order = pStr(ctx.spec, 'order', 'random');
    slots.forEach((slot, i) => {
      const regions = [slot.region, ...slot.also];
      const look = (): boolean => ctx.players.some((p) => regions.some((a) => seenBy(p, a, sight)));
      if (check) s.vis[i] = look() ? 1 : 0;
      const seen = !!s.vis[i];
      // 見られた印は、実際に調べた tick だけ付ける（調べる前の既定の「見えている」では付けない。一度も見ていない物は変えない）
      if (seen) { if (check) s.seen[i] = 1; s.unseen[i] = 0; } else s.unseen[i] = (s.unseen[i] ?? 0) + ctx.dt;
      const cur = s.cur[i] ?? 0;
      const n = slot.variants.length;
      let want = cur;
      let chanceOk = true;
      if (mode === 'random') {
        if (s.seen[i] && (s.unseen[i] ?? 0) >= minUnseen && n > 1) {
          chanceOk = ctx.random() < chance;
          if (chanceOk) want = order === 'cycle' ? (cur + 1) % n : (cur + 1 + Math.floor(ctx.random() * (n - 1))) % n;
          else s.seen[i] = 0;
        }
      } else if (ctx.wired(`t${i}`)) want = Math.max(0, Math.min(n - 1, Math.round(ctx.input(`t${i}`))));
      // 差し替える直前には見え方を調べ直す（間の tick に視野へ入っていたら差し替えない）。中に人がいる間は差し替えない（stayOut）
      const inside = slot.stayOut && ctx.players.some((p) => inBox([p.pos[0], p.pos[1] + 0.9, p.pos[2]], slot.region, 0.3));
      if (want !== cur && !seen && (s.unseen[i] ?? 0) >= minUnseen && !inside && !overlapsPlayer(ctx, slot.variants[want] ?? []) && (check || !look())) {
        setVariant(ctx, i, slot, cur, want);
        s.cur[i] = want;
        s.seen[i] = 0;
        s.changes++;
        ctx.cue("swap.change", aabbCenter(slot.region), { slot: i, variant: want });
      }
      ctx.output(`v${i}`, s.cur[i] ?? 0);
    });
    ctx.output('changes', s.changes);
  },
});
