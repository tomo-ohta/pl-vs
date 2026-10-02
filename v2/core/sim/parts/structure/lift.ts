/**
 * shaftLift: エレベーター（F24 エレベーターホールの中心。core/gen/floor/shapes/lift.ts が置く）。
 *
 * かごは各階の同じ場所にある小さな区画（上下に重なる）で、ふだんは扉が開いている（出力 open<i> = 1）。
 * かご i のボタン（入力 call<i>）が押されると、かご i の扉を閉め（closeSec）、中に人がいれば揺れ（rideSec。Cue 'lift.ride'）、
 * 次の止まる所（i + 1。いちばん下からは上へ）のかごへ継ぎ目なく移して（ctx.warp。同じ形のかごなので見た目は変わらない）、
 * そこの扉を開ける。中に誰もいなければ扉を開け直す。
 * params: stops [{ y, aabb }]（上から順）, closeSec, rideSec
 * 出力: open<i>（扉 i を開けるか）, riding（乗っている間 1）, at（いまのかごの番号）
 */
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, playerIn, type PartContext } from '../../part.ts';

interface LiftState { phase: string; at: number; to: number; t: number; [k: string]: Json | undefined }
interface Stop { y: number; aabb: { min: Vec3; max: Vec3 } }

function stopsOf(ctx: PartContext): Stop[] {
  const raw = ctx.spec.params.stops;
  if (!Array.isArray(raw)) return [];
  return (raw as { y: number; aabb: { min: number[]; max: number[] } }[]).map((s) => ({ y: s.y, aabb: { min: [s.aabb.min[0]!, s.aabb.min[1]!, s.aabb.min[2]!], max: [s.aabb.max[0]!, s.aabb.max[1]!, s.aabb.max[2]!] } }));
}

definePart<LiftState>({
  type: 'shaftLift',
  outputs: ['riding', 'at', 'open0', 'open1', 'open2', 'open3', 'open4'],
  init: () => ({ phase: 'idle', at: 0, to: 0, t: 0 }),
  step(s, ctx) {
    const stops = stopsOf(ctx);
    const n = stops.length;
    if (!n) return;
    const close = pNum(ctx.spec, 'closeSec', 1.2), ride = pNum(ctx.spec, 'rideSec', 3.5);
    s.t += ctx.dt;
    switch (s.phase) {
      case 'idle': {
        for (let i = 0; i < n; i++) {
          if (ctx.input(`call${i}`) > 0.5) {
            s.phase = 'closing'; s.at = i; s.to = (i + 1) % n; s.t = 0;
            ctx.cue('lift.close', centerOf(stops[i]!));
            break;
          }
        }
        break;
      }
      case 'closing': {
        if (s.t < close) break;
        const inside = ctx.players.some((p) => playerIn(p, stops[s.at]!.aabb));
        if (!inside) { s.phase = 'idle'; s.t = 0; ctx.cue('lift.open', centerOf(stops[s.at]!)); break; }
        s.phase = 'ride'; s.t = 0;
        ctx.cue('lift.ride', centerOf(stops[s.at]!), { sec: ride });
        break;
      }
      case 'ride': {
        if (s.t < ride) break;
        // 次の止まる所のかごへ（同じ形なので継ぎ目なく）
        const from = stops[s.at]!, to = stops[s.to]!;
        for (const p of ctx.players) {
          if (!playerIn(p, from.aabb, 0.2)) continue;
          ctx.warp(p, [p.pos[0], p.pos[1] + (to.y - from.y), p.pos[2]], p.yaw, true);
        }
        s.at = s.to; s.phase = 'opening'; s.t = 0;
        ctx.cue('lift.arrive', centerOf(to));
        break;
      }
      case 'opening': {
        if (s.t >= 0.6) { s.phase = 'idle'; s.t = 0; ctx.cue('lift.open', centerOf(stops[s.at]!)); }
        break;
      }
      default: s.phase = 'idle';
    }
    // 乗る間は、乗ったかごと着くかごの両方の扉を閉める（着いたとき、同じ閉じたかごの中から扉が開く）
    for (let i = 0; i < n; i++) {
      const shut = ((s.phase === 'closing' || s.phase === 'ride') && (i === s.at || i === s.to)) || (s.phase === 'opening' && i === s.at);
      ctx.output(`open${i}`, shut ? 0 : 1);
    }
    ctx.output('riding', s.phase === 'ride' ? 1 : 0);
    ctx.output('at', s.at);
  },
});

function centerOf(s: Stop): Vec3 {
  return [(s.aabb.min[0] + s.aabb.max[0]) / 2, s.aabb.min[1] + 1.2, (s.aabb.min[2] + s.aabb.max[2]) / 2];
}
