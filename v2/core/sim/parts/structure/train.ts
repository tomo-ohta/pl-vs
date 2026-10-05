/**
 * trainRide: 駅の車両（F35 鉄道の駅と車両。core/gen/floor/shapes/train.ts が置く。v1 VehicleRide の発展）。
 *
 * - 初め（着いた直後）は扉が閉まっていて、arriveSec で開く（次の駅に着いた人は、閉まった車両の中から扉が開くのを見る）
 * - 車両の中（params.aabb）に dwellSec いると扉が閉まり（closeSec）、走り出す（rideSec。Cue 'train.depart'。窓の外を灯りが流れる
 *   見た目は client/views/structure/train.ts）。走っている間に降りることはできない（扉は閉まっている）
 * - 着いたら、プレイヤーを params.exit（車両の床の下の FloorExit 'train' の中）へ移す → 次のフロア（隣の駅）へ
 * - 誰も乗っていなければ扉は開いたまま。扉が閉まる前に降りれば、走り出さない
 * 出力: open（扉を開けるか）, riding（走っている間 1）, progress（走った割合 0..1）
 */
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, pVec, playerIn } from '../../part.ts';

interface TrainState { phase: string; t: number; [k: string]: Json | undefined }

definePart<TrainState>({
  type: 'trainRide',
  outputs: ['open', 'riding', 'progress'],
  init: () => ({ phase: 'arrive', t: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const inside = ctx.players.some((p) => playerIn(p, a));
    const dwell = pNum(ctx.spec, 'dwellSec', 4), close = pNum(ctx.spec, 'closeSec', 1.2), ride = pNum(ctx.spec, 'rideSec', 9), arrive = pNum(ctx.spec, 'arriveSec', 2.5);
    s.t += ctx.dt;
    // 線の終わりの駅: 着いたら扉を開けたまま止まる（走らない）
    if (pBool(ctx.spec, 'terminal', false) && s.phase !== 'arrive') s.phase = 'wait';
    else switch (s.phase) {
      case 'arrive':
        if (s.t >= arrive) { s.phase = 'wait'; s.t = 0; ctx.cue('train.open', undefined); }
        break;
      case 'wait':
        if (pBool(ctx.spec, 'terminal', false)) break;
        if (!inside) s.t = 0;
        else if (s.t >= dwell) { s.phase = 'closing'; s.t = 0; ctx.cue('train.close', undefined); }
        break;
      case 'closing':
        if (!inside) { s.phase = 'wait'; s.t = 0; ctx.cue('train.open', undefined); break; }
        if (s.t >= close) { s.phase = 'ride'; s.t = 0; ctx.cue('train.depart', undefined, { sec: ride }); }
        break;
      case 'ride':
        if (s.t >= ride) {
          const to = pVec(ctx.spec, 'exit');
          for (const p of ctx.players) if (playerIn(p, a, 0.3)) ctx.warp(p, to, p.yaw, false);
          s.phase = 'gone'; s.t = 0;
          ctx.cue('train.arrive', undefined);
        }
        break;
      case 'gone':
        // 次のフロアへ移る間（クライアントが暗転して読み込む）。移らなかったとき（実験場など）は、しばらくで着いた所から
        if (s.t >= 3) { s.phase = 'arrive'; s.t = 0; }
        break;
      default: s.phase = 'wait';
    }
    ctx.output('open', s.phase === 'wait' ? 1 : 0);
    ctx.output('riding', s.phase === 'ride' ? 1 : 0);
    ctx.output('progress', s.phase === 'ride' ? Math.min(1, s.t / ride) : s.phase === 'gone' ? 1 : 0);
  },
});
