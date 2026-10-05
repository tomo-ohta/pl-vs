/**
 * warpStairs: 終わらない階段（W14）。上っても上っても同じ踊り場。
 *
 * 階段室は同じ階が縦に積み重なっている（1 階ぶんの高さ rise）。上の面（2 つ目の階の上りの途中）を上へ越えると、1 階ぶん下の同じ所へ
 * 継ぎ目なく移す（真下へずらすだけなので、床・壁の模様も汚れも同じ）。上った回数を数え、goal 回で上の面が消えて上の階へ抜けられる。
 * 下の面（1 つ目の階の上りの途中）を下へ越えると、上った回数が残っている間は 1 階ぶん上へ移して数を 1 つ減らす（下りれば必ず来た扉へ戻れる）。
 * giveUpSec 秒たっても抜けなければ、上の面は消える（閉じ込めない）。
 *
 * params: up / down … { center, dir, box }（面と向き。up は上る向き、down は下る向き）・rise・goal・giveUpSec・area（階段室の中。入ったら時間を数え始める）
 * outputs: climbs（いま上っている回数）・open（上へ抜けられる）
 */
import { type Dir } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum } from '../../part.ts';
import { inBox, readAabb, sideOf } from './util.ts';

definePart<{ climbs: number; open: number; t: number; started: number; su: Record<string, number>; sd: Record<string, number> }>({
  type: 'warpStairs',
  outputs: ['climbs', 'open'],
  init: () => ({ climbs: 0, open: 0, t: 0, started: 0, su: {}, sd: {} }),
  step(s, ctx) {
    const up = ctx.spec.params.up as { center: number[]; dir: number; box: Json }, down = ctx.spec.params.down as { center: number[]; dir: number; box: Json };
    const bu = readAabb(up.box), bd = readAabb(down.box);
    const rise = pNum(ctx.spec, 'rise', 3), goal = pNum(ctx.spec, 'goal', 6);
    for (const p of ctx.players) {
      const foot = [p.pos[0], p.pos[1] + 0.1, p.pos[2]];
      const nu = sideOf(up.center, (up.dir & 3) as Dir, p.pos), nd = sideOf(down.center, (down.dir & 3) as Dir, p.pos);
      const pu = s.su[p.id], pd = s.sd[p.id];
      s.su[p.id] = nu;
      s.sd[p.id] = nd;
      if (ctx.spec.params.area ? inBox(foot, readAabb(ctx.spec.params.area)) : inBox(foot, bu) || inBox(foot, bd)) s.started = 1;
      if (!s.open && pu !== undefined && Math.abs(nu - pu) < 1 && pu < 0 && nu >= 0 && inBox(foot, bu)) {
        ctx.warp(p, [p.pos[0], p.pos[1] - rise, p.pos[2]], p.yaw);
        s.climbs++;
        if (s.climbs >= goal) { s.open = 1; ctx.cue('stairs.open', p.pos); }
      } else if (s.climbs > 0 && pd !== undefined && Math.abs(nd - pd) < 1 && pd < 0 && nd >= 0 && inBox(foot, bd)) {
        ctx.warp(p, [p.pos[0], p.pos[1] + rise, p.pos[2]], p.yaw);
        s.climbs--;
      } else continue;
      s.su[p.id] = sideOf(up.center, (up.dir & 3) as Dir, p.pos);
      s.sd[p.id] = sideOf(down.center, (down.dir & 3) as Dir, p.pos);
    }
    if (s.started && !s.open) {
      s.t += ctx.dt;
      if (s.t >= pNum(ctx.spec, 'giveUpSec', 150)) { s.open = 1; ctx.cue('stairs.open'); }
    }
    ctx.output('climbs', s.climbs);
    ctx.output('open', s.open);
  },
});
