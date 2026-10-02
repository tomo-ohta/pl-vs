/**
 * 物を運ぶ・パズルの判断の部品。
 * - carryLevel: 入力 hold が入っている間、入力 value の最大を覚える（水を注いだ量）。hold が切れて holdSec 秒で decay ずつ減る。
 *   出力 level・full（level ≥ fullAt。latch なら入ったまま）
 * - sameValue: 配線した入力（a〜h）の値が全部同じ（四捨五入して）なら out。params.target があれば、その値でそろったときだけ
 * - valueIs: 入力 in の四捨五入が params.value なら out
 */
import { definePart, pBool, pNum } from '../../part.ts';

const PORTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

definePart<{ level: number; idle: number; full: number }>({
  type: 'carryLevel',
  outputs: ['level', 'full'],
  inputs: ['value', 'hold'],
  init: () => ({ level: 0, idle: 0, full: 0 }),
  step(s, ctx) {
    const hold = ctx.input('hold') > 0.5;
    if (hold) { s.level = Math.max(s.level, ctx.input('value')); s.idle = 0; }
    else {
      s.idle += ctx.dt;
      if (s.idle > pNum(ctx.spec, 'holdSec', 6)) s.level = Math.max(0, s.level - pNum(ctx.spec, 'decay', 0.08) * ctx.dt);
    }
    if (s.level >= pNum(ctx.spec, 'fullAt', 0.999)) s.full = 1;
    else if (!pBool(ctx.spec, 'latch', true)) s.full = 0;
    ctx.output('level', s.level);
    ctx.output('full', s.full);
  },
});

definePart({
  type: 'sameValue',
  outputs: ['out'],
  inputs: PORTS,
  init: () => ({}),
  step(_s, ctx) {
    const ports = PORTS.filter((p) => ctx.wired(p));
    const vals = ports.map((p) => Math.round(ctx.input(p)));
    const target = ctx.spec.params.target;
    const same = vals.length > 0 && vals.every((v) => v === vals[0]) && (typeof target !== 'number' || vals[0] === target);
    ctx.output('out', same ? 1 : 0);
  },
});

definePart({
  type: 'valueIs',
  outputs: ['out'],
  inputs: ['in'],
  init: () => ({}),
  step(_s, ctx) {
    ctx.output('out', Math.round(ctx.input('in')) === pNum(ctx.spec, 'value', 0) ? 1 : 0);
  },
});
