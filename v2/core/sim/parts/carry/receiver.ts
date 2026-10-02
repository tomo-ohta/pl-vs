/**
 * 受けの部品（置き台・枠・重さの床・持って待つ枠）。持てる物（item.ts）の状態を読んで出力を出す（持てる物は書き換えない）。
 *
 * - carryReceiver: 枠（params.slots: [{ pos（底の中心）, r（吸い付く半径）, accept, want, yaw }]）と範囲（params.region）に
 *   置いてある物を数える。Q で置く・投げた物が枠の近くに落ちると、枠へ吸い付く（item.ts）。
 *   出力: count（合う物の数）・full（count ≥ need）・ok（全部の枠に、その枠の want に合う物）・any（何か置いてある数）・
 *   wrong（accept に合わない物の数）・weight（置いてある物の重さの和）・fill（置いた水の量の最大）・stage（運ぶと変わる物の段の最大）・
 *   aligned（合う物が need 個以上あり、全部が同じ向き。alignDeg 度以内）・place（合う物が増えた tick だけ 1）・
 *   present（範囲の中の合う物の数。持っている・飛んでいる物も数える）
 * - carrySensor: 範囲（params.aabb）の中に、物を持って sec 秒いる。出力: match（want に合う物）・other（合わない物）・
 *   empty（何も持たずに）・holding（今持っているか）。latch（既定 true）なら入ったまま
 */
import { aabbContains } from '../../../math/aabb.ts';
import { definePart, pAabb, pBool, pNum, playerIn } from '../../part.ts';
import { aabbParam, angleDiff, carryIndex, centerOf, REST, slotsOf, strList, tagMatch, type ItemState } from './common.ts';
import { itemCfg } from './item.ts';

interface ReceiverState { occ: (string | null)[]; count: number; [k: string]: import('../../../world/layout.ts').Json | undefined }

definePart<ReceiverState>({
  type: 'carryReceiver',
  outputs: ['count', 'full', 'ok', 'any', 'wrong', 'weight', 'fill', 'aligned', 'stage', 'place', 'present'],
  init: (ctx) => ({ occ: slotsOf(ctx.spec).map(() => null), count: 0 }),
  step(s, ctx) {
    const ix = carryIndex(ctx.floor);
    const slots = slotsOf(ctx.spec);
    const region = aabbParam(ctx.spec.params.region);
    const accept = strList(ctx.spec.params.accept);
    const only = strList(ctx.spec.params.items);
    const occ: (string | null)[] = slots.map(() => null);
    const good: boolean[] = slots.map(() => false);
    let count = 0, wrong = 0, any = 0, weight = 0, fill = 0, stage = 0;
    const yaws: number[] = [];
    let present = 0;
    for (const id of ix.items) {
      if (only && !only.includes(id)) continue;
      const st = ctx.stateOf(id) as ItemState | null;
      if (!st) continue;
      // present: 範囲の中の合う物（持っている・飛んでいる物も）
      if (region && aabbContains(region, centerOf(st)) && tagMatch(itemCfg(ix.specs.get(id)!).tag, accept)) present++;
      if (st.mode !== REST) continue;
      const cfg = itemCfg(ix.specs.get(id)!);
      const bx = st.poses[0]!, by = st.poses[1]! - cfg.half[1], bz = st.poses[2]!;
      let inside = false, ok = false;
      for (let k = 0; k < slots.length; k++) {
        const sl = slots[k]!;
        if (occ[k] || Math.hypot(bx - sl.pos[0], bz - sl.pos[2]) > 0.2 || Math.abs(by - sl.pos[1]) > 0.3) continue;
        occ[k] = id;
        inside = true;
        ok = tagMatch(cfg.tag, sl.accept);
        good[k] = tagMatch(cfg.tag, sl.want);
        break;
      }
      if (!inside && region && aabbContains(region, centerOf(st))) { inside = true; ok = tagMatch(cfg.tag, accept); }
      if (!inside) continue;
      any++;
      weight += cfg.weight;
      if (ok) { count++; fill = Math.max(fill, st.fill); stage = Math.max(stage, st.stage); yaws.push(st.yaw); } else wrong++;
    }
    const need = pNum(ctx.spec, 'need', slots.length || 1);
    const tol = (pNum(ctx.spec, 'alignDeg', 20) * Math.PI) / 180;
    const aligned = yaws.length >= Math.max(2, need) && yaws.every((y) => angleDiff(y, yaws[0]!) <= tol);
    ctx.output('place', count > s.count ? 1 : 0);
    s.occ = occ;
    s.count = count;
    ctx.output('count', count);
    ctx.output('full', count >= need ? 1 : 0);
    ctx.output('ok', slots.length > 0 && good.every((g) => g) ? 1 : 0);
    ctx.output('any', any);
    ctx.output('wrong', wrong);
    ctx.output('weight', weight);
    ctx.output('fill', fill);
    ctx.output('stage', stage);
    ctx.output('aligned', aligned ? 1 : 0);
    ctx.output('present', present);
  },
});

interface SensorState { tm: number; to: number; te: number; m: number; o: number; e: number; [k: string]: number }

definePart<SensorState>({
  type: 'carrySensor',
  outputs: ['match', 'other', 'empty', 'holding', 'progress'],
  init: () => ({ tm: 0, to: 0, te: 0, m: 0, o: 0, e: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const want = strList(ctx.spec.params.want);
    const sec = pNum(ctx.spec, 'sec', 1.5);
    const latch = pBool(ctx.spec, 'latch', true);
    const ix = carryIndex(ctx.floor);
    let m = false, o = false, e = false, holding = false;
    for (const p of ctx.players) {
      if (!playerIn(p, a)) continue;
      const spec = p.holding ? ix.specs.get(p.holding) : undefined;
      if (!spec) { if (!p.holding) e = true; continue; }
      holding = true;
      if (tagMatch(itemCfg(spec).tag, want)) m = true; else o = true;
    }
    s.tm = m ? s.tm + ctx.dt : 0;
    s.to = o ? s.to + ctx.dt : 0;
    s.te = e ? s.te + ctx.dt : 0;
    const on = (t: number, prev: number): number => (t >= sec ? 1 : latch ? prev : 0);
    s.m = on(s.tm, s.m);
    s.o = on(s.to, s.o);
    s.e = on(s.te, s.e);
    ctx.output('match', s.m);
    ctx.output('other', s.o);
    ctx.output('empty', s.e);
    ctx.output('holding', holding ? 1 : 0);
    ctx.output('progress', Math.min(1, Math.max(s.tm, s.to) / Math.max(1e-6, sec)));
  },
});
