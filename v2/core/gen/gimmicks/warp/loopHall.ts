/**
 * 閉じた輪の廊下（loopHall: W06・BX02）。
 *
 * 遊び方: 部屋の 3 枚目の扉（ほかの扉が閉じているときだけ開く。控え室 anteroom.ts）の向こうに、まっすぐな長い廊下。
 * 歩いても歩いても、同じ椅子・同じ扉・同じ照明が 12 m ごとにくり返す（霧で先は見えない）。前へ lapsOut 周すると輪がほどけ、
 * 廊下の奥の扉が霧の中から現れる。開けると、最初の部屋（の双子）に出る — まっすぐ進んだのに元の場所に戻っている。
 * 1 周したあとは後ろへ戻っても輪の中（輪が閉じる）。後ろへ lapsBack 周すると後ろの輪がほどけ、廊下の入口の壁に隠しの扉が現れる（BX02）。
 * 閉じ込めない: 輪が閉じる前は来た扉へ戻れる。giveUpSec 秒で前も後ろもほどける。双子の部屋の扉はいつでも元の部屋へ戻す。
 *
 * 作り: 廊下は 1 つの区画（別の空間。hall.ts）。くり返す所の外の霧（render.fog）で、戻される前と後の見える範囲がまったく同じになる
 * （前の面 front から period 戻すとき、[front − period − 霧, front + 霧] がくり返しの中）。部品は warpTreadmill。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import { defineGimmick } from '../types.ts';
import { buildAnteroom, anteroomFits, planAnteroom } from './anteroom.ts';
import { buildStraightHall } from './hall.ts';
import { axisOf } from './pocket.ts';

defineGimmick({
  id: 'loopHall', name: '閉じた輪の廊下', axes: ['move', 'sight'], kinds: ['room'], minSize: [3.8, 3.8], weight: WARP_TUNING['warp.loopHall.weight'].default, intensity: 1,
  fits: (s) => anteroomFits(s),
  offersSecret: true, onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const plan = planAnteroom(ctx);
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const P = t['warp.loopHall.periodM'], F = t['warp.loopHall.fogFarM'];
    // くり返しは、戻す前と後の見える範囲（霧まで）が両方くり返しの中に入る数（(M − 1)·P ≥ 2·霧）
    const M = Math.max(t['warp.loopHall.periods'], Math.ceil((2 * F) / P) + 1);
    const W = t['warp.loopHall.widthM'];
    const a0 = 4;
    const hall = buildStraightHall(ctx, ante, { startLen: a0, period: P, periods: M, endLen: 4, width: W, height: t['warp.loopHall.heightM'], fogFar: F });
    const { f, cell } = hall;
    const tread = ctx.addEntity('loop', {
      type: 'warpTreadmill', cell: cell.id,
      params: {
        origin: f.p(0, 0, 0), fwd: plan.pod.dir,
        box: (() => { const a = f.aabb(0.2, -0.5, -W / 2, hall.length - 0.2, 3.0, W / 2); return { min: [...a.min], max: [...a.max] }; })(),
        period: P, front: a0 + M * P - F, back: a0 + F,
        lapsOut: t['warp.loopHall.lapsOut'], lapsBack: t['warp.loopHall.lapsBack'], giveUpSec: t['warp.loopHall.giveUpSec'],
      },
    });
    // 隠し（BX02）: 後ろの輪をほどくと、入口の所の左の壁に扉が現れる（出現型）
    const sd = f.dir(1);
    const sp = f.p(2.4, 0, W / 2);
    ctx.offerSecret({ hook: 'loop.backward', modes: ['appear'], weight: t['warp.loopHall.secretWeight'], revealOutput: `${tread}.back`, doorway: { dir: sd, at: axisOf(sd) === 'x' ? sp[2] : sp[0], y: cell.floorY, width: 1.0, height: 2.0 }, cell: cell.id, tell: '入口の壁だけ、霧が薄い' });
    ante.finish();
  },
});
