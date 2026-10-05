/**
 * 上下する床の部品（沈む床 G16・せり上がる床 G17）と床の蓋（床下の明かり G15）。
 *
 * - stillLift: 上に止まって立っていると（stillSec 秒）、行き先（travel だけ上下した所）へ動く。上で歩き回ると戻る。誰も乗っていなければ
 *     idleSec 秒で戻る。乗っている人を運ぶ（上がるときは押し上げる。下がるときは重さで付いてくる）。
 *     出力 t（0 = 元の位置 / 1 = 行き先）・atFar・occupied・still。規則は「止まると動く・歩くと戻る」（ボタンを使わないのでスマホでも同じ）
 * - hatch: 床の蓋。調べると（E / タップ）横へ滑って開き、開いたまま。閉じている間だけ当たり判定。出力 open
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import { approach } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum } from '../../part.ts';

interface LiftState { t: number; still: number; idle: number; moving: number; [k: string]: Json | undefined }

function liftBox(b: AABB, dy: number): AABB {
  return { min: [b.min[0], b.min[1] + dy, b.min[2]], max: [b.max[0], b.max[1] + dy, b.max[2]] };
}

definePart<LiftState>({
  type: 'stillLift',
  outputs: ['t', 'atFar', 'occupied', 'still'],
  init(ctx) {
    ctx.setCollider('box', pAabb(ctx.spec, 'box'));
    return { t: 0, still: 0, idle: 0, moving: 0 };
  },
  step(s, ctx) {
    const b = pAabb(ctx.spec, 'box');
    const travel = pNum(ctx.spec, 'travel', -2.5);
    const L = Math.max(0.01, Math.abs(travel));
    const top = b.max[1] + travel * s.t;
    // 乗っている人（上面に立っている）
    // 押し上げられている間は接地が切れることがあるので、足元の高さだけで見る
    const on = ctx.players.filter((p) => Math.abs(p.pos[1] - top) < 0.15 && p.pos[0] > b.min[0] - 0.1 && p.pos[0] < b.max[0] + 0.1 && p.pos[2] > b.min[2] - 0.1 && p.pos[2] < b.max[2] + 0.1);
    const stillNow = on.some((p) => p.moveRank === 'still');
    s.still = stillNow ? s.still + ctx.dt : 0;
    const still = s.still >= pNum(ctx.spec, 'stillSec', 0.4);
    let target = s.t;
    // commitT: ここより先へ動いたら、歩いても戻らない（沈む床で 1 つ下の階へ。14 章）
    const commit = pNum(ctx.spec, 'commitT', 2);
    if (still) { target = 1; s.idle = 0; }
    else if (on.length) { target = s.t >= commit && s.t < 1 ? 1 : 0; s.idle = 0; }
    else { s.idle += ctx.dt; if (s.idle >= pNum(ctx.spec, 'idleSec', 3)) target = 0; }
    const prevT = s.t;
    // fastAfter m より先は fastSpeed で（暗い縦穴の中は速く）
    const far = Math.abs(travel) * s.t > pNum(ctx.spec, 'fastAfter', Infinity);
    s.t = approach(s.t, target, ((far ? pNum(ctx.spec, 'fastSpeed', 1) : pNum(ctx.spec, 'speed', 0.35)) * ctx.dt) / L);
    const moving = s.t !== prevT ? 1 : 0;
    if (moving !== s.moving) ctx.cue(moving ? 'lift.start' : 'lift.stop', aabbCenter(liftBox(b, travel * s.t)));
    s.moving = moving;
    const dy = travel * s.t;
    ctx.setCollider('box', liftBox(b, dy));
    // 上がるときは乗っている人を押し上げる（mover と同じ）
    const vy = ((s.t - prevT) * travel) / ctx.dt;
    if (vy > 0) for (const p of on) p.carry = [0, vy, 0];
    ctx.output('t', s.t);
    ctx.output('atFar', s.t >= 0.99 ? 1 : 0);
    ctx.output('occupied', on.length ? 1 : 0);
    ctx.output('still', still ? 1 : 0);
  },
});

definePart<{ k: number; open: number; [k: string]: Json | undefined }>({
  type: 'hatch',
  outputs: ['open'],
  inputs: ['open'],
  init(ctx) {
    const a = pAabb(ctx.spec, 'panel');
    ctx.setCollider('panel', a);
    ctx.setInteractable(a, 2.4);
    return { k: 0, open: 0 };
  },
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'panel');
    if (!s.open && (ctx.interactedBy() || (ctx.wired('open') && ctx.input('open') > 0.5))) {
      s.open = 1;
      ctx.cue('hatch.open', aabbCenter(a));
      ctx.setInteractable(null);
    }
    s.k = approach(s.k, s.open, ctx.dt / pNum(ctx.spec, 'openSec', 1.2));
    // 半分開いたら当たり判定を外す（滑っている板は描画だけ）
    ctx.setCollider('panel', s.k < 0.5 ? a : null);
    ctx.output('open', s.k >= 0.5 ? 1 : 0);
  },
});
