/**
 * warpRecede: 遠ざかる廊下の偽の突き当たり（W05。v1 E13 DynamicLength と同じ式）。
 *
 * 廊下の本物の突き当たり（壁・扉・非常口の灯り）をそのまま写した偽の突き当たりを、廊下の手前に置く。
 * プレイヤーが廊下を進んだ距離 d に対して、偽の突き当たりのずれ off = clamp(start + (1 + rate)·d, start, 0)
 * （0 で本物と重なる。start は負）。残りの距離は 歩いた分 × rate だけ伸びるので、歩くほど扉が遠ざかる。
 * off が 0 に着くと偽の突き当たりは消え、同じ所にある本物の扉が残る（歩けば必ず着く）。戻ると近づく（位置だけで決まる）。
 *
 * params: origin（廊下の座標の原点）・fwd・box（廊下の中）・start（最初のずれ。負）・rate・from（進んだ距離を数え始める u）・
 *         wall（偽の壁の当たり判定: 本物の突き当たりの壁の箱）
 * 状態: off（今のずれ）・gone（消えた）
 */
import { rotQ, type Dir } from '../../../math/vec.ts';
import { definePart, pNum, pVec } from '../../part.ts';
import { inBox, readAabb } from './util.ts';

definePart<{ off: number; gone: number }>({
  type: 'warpRecede',
  outputs: ['off', 'gone'],
  init(ctx) {
    const start = pNum(ctx.spec, 'start', -30);
    return { off: start, gone: 0 };
  },
  step(s, ctx) {
    const o = pVec(ctx.spec, 'origin');
    const f = rotQ([0, 0, 1], (pNum(ctx.spec, 'fwd', 0) & 3) as Dir);
    const box = readAabb(ctx.spec.params.box);
    const start = pNum(ctx.spec, 'start', -30), rate = pNum(ctx.spec, 'rate', 0.5), from = pNum(ctx.spec, 'from', 0);
    // いちばん奥まで進んだプレイヤー（廊下の中にいる人だけ）
    let d = 0;
    for (const p of ctx.players) {
      if (!inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], box)) continue;
      d = Math.max(d, (p.pos[0] - o[0]) * f[0] + (p.pos[2] - o[2]) * f[2] - from);
    }
    s.off = Math.min(0, Math.max(start, start + (1 + rate) * d));
    const wasGone = s.gone;
    s.gone = s.off > -0.05 ? 1 : 0;
    if (s.gone && !wasGone) ctx.cue('recede.arrive');
    const w = readAabb(ctx.spec.params.wall);
    ctx.setCollider('wall', s.gone ? null : { min: [w.min[0] + f[0] * s.off, w.min[1], w.min[2] + f[2] * s.off], max: [w.max[0] + f[0] * s.off, w.max[1], w.max[2] + f[2] * s.off] });
    ctx.output('off', s.off);
    ctx.output('gone', s.gone);
  },
});
