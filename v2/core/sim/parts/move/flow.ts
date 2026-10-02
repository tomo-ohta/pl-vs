/**
 * 移動と身体の部品: 流れと、プレイヤーの状態を感じる部品。
 * - flowZone: 押し流すゾーン（風・群衆・エスカレーター・滑り台・上昇気流）。forceZone に、周期の強弱（突風）と予告を足したもの。
 *     period 秒ごとに duty の間だけ強い（speed）。それ以外は base（0 なら消える）。強くなる warn 秒前に予告（出力 warn・Cue）。
 *     入力 enable を配線すると、入っている間だけ効く。air: 宙にいる間の倍率（風に飛ばされる）。描画は visual で選ぶ
 * - stateSensor: 区画 aabb の中で、プレイヤーが条件 when（宙にいる・泳いでいる・小さい・天井を歩いている …）を満たす時間が
 *     sec に達したら done（隠しの「普通でない振る舞い」をとらえる）。条件は全部満たすこと
 */
import { aabbCenter } from '../../../math/aabb.ts';
import { lookDir } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, playerIn, pStr, pVec, type PartContext } from '../../part.ts';
import { gravUp } from '../../player.ts';
import type { PlayerState } from '../../types.ts';

const ON = 0.5;

interface FlowState { on: number; warn: number; strength: number; [k: string]: Json | undefined }

/** 周期の中の位置（0..period）。period 0 は常に強い */
function cyclePhase(ctx: PartContext): { strong: boolean; warn: boolean } {
  const period = pNum(ctx.spec, 'period', 0);
  if (period <= 0) return { strong: true, warn: false };
  const duty = pNum(ctx.spec, 'duty', 0.5);
  const warn = pNum(ctx.spec, 'warn', 0);
  const t = (((ctx.time + pNum(ctx.spec, 'phase', 0)) % period) + period) % period;
  const strong = t < duty * period;
  return { strong, warn: !strong && t > period - warn };
}

definePart<FlowState>({
  type: 'flowZone',
  outputs: ['on', 'warn', 'strength'],
  inputs: ['enable'],
  init: () => ({ on: -1, warn: 0, strength: 0 }),
  step(s, ctx) {
    const enabled = ctx.wired('enable') ? ctx.input('enable') > ON : true;
    const c = cyclePhase(ctx);
    const on = enabled && c.strong ? 1 : 0;
    const warn = enabled && c.warn ? 1 : 0;
    const speed = on ? pNum(ctx.spec, 'speed', 1.2) : enabled ? pNum(ctx.spec, 'base', 0) : 0;
    const aabb = pAabb(ctx.spec, 'aabb');
    if (on !== s.on) {
      const air = ctx.spec.params.air;
      ctx.setZone('flow', speed > 1e-6 ? { kind: 'force', aabb, vector: pVec(ctx.spec, 'vector'), params: { speed, ...(typeof air === 'number' ? { air } : {}) } } : null);
      if (s.on >= 0 && pBool(ctx.spec, 'cue', true)) ctx.cue(on ? 'flow.on' : 'flow.off', aabbCenter(aabb), { visual: pStr(ctx.spec, 'visual', 'wind') });
      s.on = on;
    }
    if (warn && !s.warn && pBool(ctx.spec, 'cue', true)) ctx.cue('flow.warn', aabbCenter(aabb), { visual: pStr(ctx.spec, 'visual', 'wind') });
    s.warn = warn;
    s.strength = speed;
    ctx.output('on', on);
    ctx.output('warn', warn);
    ctx.output('strength', speed);
  },
});

// ---------------------------------------------------------------- プレイヤーの状態
/** 条件 1 つ（when の要素）。'gravUp:x,y,z' は重力の上の向き、'scaleBelow:0.5' / 'scaleAbove:1.2' は身体の大きさ、'ride:<部品 id の頭>' は乗り物 */
export function playerCond(p: PlayerState, cond: string): boolean {
  const [k, arg] = cond.split(':') as [string, string | undefined];
  switch (k) {
    case 'air': return !p.onGround && !p.climbing && !p.swimming;
    case 'ground': return p.onGround;
    case 'swim': return p.swimming;
    case 'climb': return p.climbing;
    case 'crouch': return p.crouching;
    case 'stand': return !p.crouching;
    case 'still': return p.moveRank === 'still';
    case 'moving': return p.moveRank !== 'still';
    case 'dash': return p.moveRank === 'dash';
    case 'backward': {
      // 後ろ向きに進んでいる: 進む向きと視線の向きが逆
      const hs = Math.hypot(p.vel[0], p.vel[2]);
      if (hs < 0.5) return false;
      const f = lookDir(p.yaw, 0);
      return (f[0] * p.vel[0] + f[2] * p.vel[2]) / hs < -0.5;
    }
    case 'scaleBelow': return p.scale < Number(arg ?? 0.6);
    case 'scaleAbove': return p.scale > Number(arg ?? 1.2);
    case 'gravUp': {
      const v = (arg ?? '0,1,0').split(',').map(Number);
      const u = gravUp(p.grav);
      return u[0] * v[0]! + u[1] * v[1]! + u[2] * v[2]! > 0.9;
    }
    case 'ride': return !!p.ride && (!arg || p.ride.startsWith(arg));
    case 'submerged': return p.swimming && p.mantle === null && p.vel[1] < 0.2 && p.input.crouch;
    default: return false;
  }
}

definePart<{ t: number; done: number }>({
  type: 'stateSensor',
  outputs: ['done', 'progress', 'ok'],
  inputs: ['enable'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const a = ctx.spec.params.aabb ? pAabb(ctx.spec, 'aabb') : null;
    const raw = ctx.spec.params.when;
    const when = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
    const enabled = ctx.wired('enable') ? ctx.input('enable') > ON : true;
    const ok = enabled && ctx.players.some((p) => (!a || playerIn(p, a)) && when.every((c) => playerCond(p, c)));
    const sec = pNum(ctx.spec, 'sec', 0);
    const latch = pBool(ctx.spec, 'latch', true);
    if (ok) s.t += ctx.dt;
    else if (!pBool(ctx.spec, 'keepProgress', false)) s.t = 0;
    if (ok && s.t >= sec) s.done = 1;
    else if (!latch) s.done = 0;
    ctx.output('done', s.done);
    ctx.output('ok', ok ? 1 : 0);
    ctx.output('progress', sec > 0 ? Math.min(1, s.t / sec) : ok ? 1 : 0);
  },
});

