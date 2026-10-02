/**
 * 雷の部品（段階 4・担当 sense）。
 * - lightning: min〜max 秒ごとに稲光（短く 2〜3 回瞬く）。出力 out（光っている間 1）。光った瞬間に cue 'lightning.flash'
 *     （data.delay = 雷鳴までの秒。描画が雷鳴を鳴らす）。間隔は部品ごとの決定論の乱数
 */
import { definePart, pNum } from '../../part.ts';

/** 稲光の瞬き（光り始めからの秒 → 光っているか）: 0.07 秒光る・0.09 秒消える・0.12 秒光る（3 回目は半分の確率） */
function flashAt(u: number, third: boolean): boolean {
  if (u < 0.07) return true;
  if (u < 0.16) return false;
  if (u < 0.28) return true;
  if (!third) return false;
  return u > 0.4 && u < 0.46;
}

definePart<{ next: number; at: number; third: number }>({
  type: 'lightning',
  outputs: ['out'],
  init(ctx) {
    const r = ctx.rng();
    return { next: r.float(1.5, pNum(ctx.spec, 'max', 9)), at: -10, third: 0 };
  },
  step(s, ctx) {
    if (ctx.time >= s.next) {
      s.at = ctx.time;
      s.third = ctx.random() < 0.5 ? 1 : 0;
      s.next = ctx.time + pNum(ctx.spec, 'min', 4) + ctx.random() * (pNum(ctx.spec, 'max', 9) - pNum(ctx.spec, 'min', 4));
      ctx.cue('lightning.flash', undefined, { delay: 0.4 + ctx.random() * 2.2 });
    }
    ctx.output('out', flashAt(ctx.time - s.at, !!s.third) ? 1 : 0);
  },
});
