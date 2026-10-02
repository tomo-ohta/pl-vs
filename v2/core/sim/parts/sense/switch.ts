/**
 * レバー・スイッチの部品（段階 4・担当 sense）。
 * - lever: 調べると入る。sec > 0 なら sec 秒で自然に戻る（非常電源: 戻るまで電源が入っている）。sec = 0 なら調べるたびに入切（照明のスイッチ）。
 *     入力 reset が入ると切る（巻き戻る部屋）。出力 on・pulse（入った tick だけ 1）・left（戻るまでの残り秒。sec = 0 なら 0）
 */
import { definePart, pAabb, pNum } from '../../part.ts';

definePart<{ on: number; at: number }>({
  type: 'lever',
  outputs: ['on', 'pulse', 'left'],
  inputs: ['reset'],
  init(ctx) {
    ctx.setInteractable(pAabb(ctx.spec, 'box'), pNum(ctx.spec, 'range', 2.4));
    return { on: pNum(ctx.spec, 'initial', 0) ? 1 : 0, at: -1 };
  },
  step(s, ctx) {
    const sec = pNum(ctx.spec, 'sec', 0);
    const b = pAabb(ctx.spec, 'box');
    const c: [number, number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    let pulse = 0;
    if (ctx.wired('reset') && ctx.input('reset') > 0.5 && s.on) { s.on = 0; s.at = -1; ctx.cue('lever.reset', c); }
    if (ctx.interactedBy()) {
      if (sec > 0) {
        // 戻るまでの間に引き直すと、そこから数え直す
        s.on = 1; s.at = ctx.time; pulse = 1;
      } else { s.on = s.on ? 0 : 1; pulse = s.on; }
      ctx.cue('lever.pull', c, { on: s.on });
    }
    let left = 0;
    if (sec > 0 && s.on) {
      left = Math.max(0, sec - (ctx.time - s.at));
      if (left <= 0) { s.on = 0; s.at = -1; ctx.cue('lever.off', c); }
    }
    ctx.output('on', s.on);
    ctx.output('pulse', pulse);
    ctx.output('left', left);
  },
});
