/**
 * 移動と身体の部品: 身体の大きさを変える門（sizeGate）。gates（aabb と scale）のどれかに入ると、身体がその大きさへ変わっていく
 * （PlayerState.scaleTo。大きくなるのは、大きくなった身体が箱に埋まらないときだけ = player.ts）。
 * 開口の前に scale 1 の門を置けば、部屋を出るときに元の大きさに戻る
 */
import type { Json } from '../../../world/layout.ts';
import { definePart } from '../../part.ts';

interface Gate { min: number[]; max: number[]; scale: number }

definePart<{ last: { [player: string]: number }; [k: string]: Json | undefined }>({
  type: 'sizeGate',
  outputs: ['scale'],
  init: () => ({ last: {} }),
  step(s, ctx) {
    const gates = (ctx.spec.params.gates as unknown as Gate[] | undefined) ?? [];
    let scale = 1;
    for (const p of ctx.players) {
      for (const g of gates) {
        if (p.pos[0] < g.min[0]! || p.pos[0] > g.max[0]! || p.pos[2] < g.min[2]! || p.pos[2] > g.max[2]! || p.pos[1] + 0.1 < g.min[1]! || p.pos[1] > g.max[1]!) continue;
        if (Math.abs(p.scaleTo - g.scale) > 1e-6) {
          p.scaleTo = g.scale;
          ctx.cue(g.scale < 1 ? 'size.shrink' : g.scale > 1 ? 'size.grow' : 'size.normal', [p.pos[0], p.pos[1] + 1, p.pos[2]], { scale: g.scale });
        }
        break;
      }
      s.last[p.id] = p.scale;
      scale = p.scale;
    }
    ctx.output('scale', scale);
  },
});
