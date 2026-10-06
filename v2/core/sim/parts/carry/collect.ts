/**
 * 触れて集める物（I03 本を集める）。拾う操作は要らない: 歩いて本の上を通ると拾う（スマホでもそのまま）。
 * params: items [[x, y, z, yaw], …]（底の中心）・r（拾う半径。体の中心から水平に）・desk（返却台の前の範囲）・deskSec・kind・mat
 * 出力: count（集めた数）・total・all（全部を集めて返却台の前に deskSec 秒いた）・none（1 つも集めずに返却台の前に deskSec 秒いた）・
 *   collected（拾った tick だけ 1）。all / none は入ったまま
 * イベント: carry.collect（data: index・count）
 */
import { aabbContains } from '../../../math/aabb.ts';
import { definePart, pNum } from '../../part.ts';
import { aabbParam, poseList } from './common.ts';

interface CollectState { got: number[]; count: number; t: number; all: number; none: number; [k: string]: number | number[] }

definePart<CollectState>({
  type: 'collectSet',
  outputs: ['count', 'total', 'all', 'none', 'collected'],
  init: (ctx) => ({ got: poseList(ctx.spec.params.items).map(() => 0), count: 0, t: 0, all: 0, none: 0 }),
  step(s, ctx) {
    const items = poseList(ctx.spec.params.items);
    const r = pNum(ctx.spec, 'r', 0.45);
    let collected = 0;
    for (const p of ctx.players) {
      for (let i = 0; i < items.length; i++) {
        if (s.got[i]) continue;
        const it = items[i]!;
        if (Math.hypot(p.pos[0] - it[0], p.pos[2] - it[2]) > r || Math.abs(p.pos[1] - it[1]) > 0.8) continue;
        s.got[i] = 1;
        s.count++;
        collected = 1;
        ctx.cue('carry.collect', [it[0], it[1] + 0.05, it[2]], { index: i, count: s.count, total: items.length });
      }
    }
    const desk = aabbParam(ctx.spec.params.desk);
    if (desk) {
      const at = ctx.players.some((p) => aabbContains(desk, [p.pos[0], p.pos[1] + 0.1, p.pos[2]]));
      s.t = at ? s.t + ctx.dt : 0;
      if (s.t >= pNum(ctx.spec, 'deskSec', 1.5)) {
        if (s.count >= items.length && !s.all) { s.all = 1; ctx.cue('carry.collect.all', [(desk.min[0] + desk.max[0]) / 2, desk.min[1] + 1, (desk.min[2] + desk.max[2]) / 2]); }
        if (s.count === 0 && !s.none) { s.none = 1; ctx.cue('carry.collect.none', [(desk.min[0] + desk.max[0]) / 2, desk.min[1] + 1, (desk.min[2] + desk.max[2]) / 2]); }
      }
    }
    ctx.output('count', s.count);
    ctx.output('total', items.length);
    ctx.output('all', s.all);
    ctx.output('none', s.none);
    ctx.output('collected', collected);
  },
});
