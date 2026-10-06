/**
 * I08 物を置くと増える: 台（受け params.from の枠）に物が置かれると、この区画（params.region）が同じ物で埋まる。
 * 増えるのは、区画の中に誰もいないとき（扉を開けた瞬間に、もう並んでいる）。台から取ると、やはり誰もいないときに消える。
 * params: from（受けの部品 id）・region（この区画の範囲）・spots [[x, y, z, yaw], …]（並べる所。見た目は client/views/carry）
 * 出力: shown（並んでいる）・ever（一度でも並んだ）
 * 状態: item（並べている物の部品 id。描画が形を読む）
 */
import { definePart, pAabb, playerIn, pStr } from '../../part.ts';

interface ReplicaState { item: string | null; ever: number; [k: string]: string | number | null }

definePart<ReplicaState>({
  type: 'replicaField',
  outputs: ['shown', 'ever'],
  init: () => ({ item: null, ever: 0 }),
  step(s, ctx) {
    const region = pAabb(ctx.spec, 'region');
    const from = ctx.stateOf(pStr(ctx.spec, 'from', ''));
    const occ = from && Array.isArray(from.occ) ? (from.occ as (string | null)[]) : [];
    const want = occ.find((x) => !!x) ?? null;
    const watched = ctx.players.some((p) => playerIn(p, region));
    if (!watched && want !== s.item) {
      s.item = want;
      if (want) { s.ever = 1; ctx.cue('carry.replica', undefined, { item: want }); }
    }
    ctx.output('shown', s.item ? 1 : 0);
    ctx.output('ever', s.ever);
  },
});
