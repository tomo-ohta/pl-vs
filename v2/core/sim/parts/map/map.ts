/**
 * 地図の部品（段階 4・地図と道案内）。どれも当たり判定・剛体を持たない。地図の見た目と記録はクライアント（client/map）が
 * 部品の params と出力を読んで作る（地図は 1 人ずつの持ち物なので、シミュレーションの状態には入れない）。
 *
 * - mapFx: 部屋まるごとの地図の異変の印（params.fx: 'erase' 地図が消える / 'rotate' 地図が回る / 'hide' 地図に記録されない）。
 *          区画の中（params.aabb）にいる間 in、入った瞬間 entered。異変の取り消しで部品ごと消えるので、地図の異変はこの部品で表す
 * - mapBoard: 壁の地図（params.mode: 'guide' 入口の案内図 / 'here' 現在地の看板 / 'survey' 机の上の測量図）。
 *          調べる（E / タップ）と read が入る（クライアントが自分の地図に写す）。params.box は板の面
 * - mapNote: 落ちている誰かの地図（N09 他人の地図）。調べると read（クライアントが書き込みを自分の地図に写す）。
 *          持ち運ぶ仕組み（carry の担当）とは後でつなぐ: いまは「調べると読める物」
 * - landmark: 霧の中の塔の灯り（N05）。見た目だけ（クライアントが霧を通して見える灯りを描く）。出力 on（明滅）
 */
import { aabbCenter, aabbExpand } from '../../../math/aabb.ts';
import { definePart, pAabb, pNum, pStr, playerIn } from '../../part.ts';

definePart<{ inside: number }>({
  type: 'mapFx',
  outputs: ['in', 'entered'],
  init: () => ({ inside: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const inside = ctx.players.some((p) => playerIn(p, a)) ? 1 : 0;
    ctx.output('entered', inside && !s.inside ? 1 : 0);
    ctx.output('in', inside);
    s.inside = inside;
  },
});

/** 調べると読める物（壁の地図・落ちている地図）。一度読んだら read は入ったまま */
function readable(type: string): void {
  definePart<{ read: number; at: number }>({
    type,
    outputs: ['read'],
    init(ctx) {
      ctx.setInteractable(aabbExpand(pAabb(ctx.spec, 'box'), 0.06), pNum(ctx.spec, 'range', 2.8));
      return { read: 0, at: -1 };
    },
    step(s, ctx) {
      if (ctx.interactedBy()) {
        if (!s.read) s.at = ctx.tick;
        s.read = 1;
        ctx.cue('map.read', aabbCenter(pAabb(ctx.spec, 'box')), { kind: pStr(ctx.spec, 'mode', type) });
      }
      ctx.output('read', s.read);
    },
  });
}
readable('mapBoard');
readable('mapNote');

definePart({
  type: 'landmark',
  outputs: ['on'],
  init: () => ({}),
  step(_s, ctx) {
    const period = Math.max(0.2, pNum(ctx.spec, 'blinkSec', 1.6));
    ctx.output('on', (ctx.time % period) < period * 0.55 ? 1 : 0);
  },
});
