/**
 * 感じる部品（Sensor）。プレイヤー（前の tick の位置）や物を見て、出力を 0..1 で出す。
 * latch: true の部品は、一度条件を満たしたら入ったまま（done）。隠し発見の「裏の振る舞い」をとらえるのに使う。
 *
 * - zoneSensor: 区画に入っている（in）・入った瞬間（entered）
 * - dwellSensor: 区画に sec 秒いる（still: true なら止まっている間だけ数える）
 * - lookSensor: 点 target を見ている（mode 'avoid' なら見ていない）時間が sec に達した
 * - speedSensor: 区画の中で速さが min〜max の間に sec 秒（後ろ向き backward: true も）
 * - fallSensor: 区画に落ちて入った（下向きの速さ minSpeed 以上）
 * - distanceSensor: 点・部品から dist より遠い（mode 'near' なら近い）時間が sec に達した
 * - countSensor: 区画の中にある転がる物（propPile）の数と、最初の数に対する割合
 */
import { aabbContains } from '../../math/aabb.ts';
import { dist3, lookDir, type Vec3 } from '../../math/vec.ts';
import { definePart, pAabb, pBool, pNum, playerIn, pStr, pVec, type PartContext } from '../part.ts';
import type { PlayerState } from '../types.ts';

const anyPlayer = (ctx: PartContext, f: (p: PlayerState) => boolean): PlayerState | null => ctx.players.find(f) ?? null;

/** 条件が sec 秒続いたら done。latch なら入ったまま */
function hold(s: { t: number; done: number }, ctx: PartContext, ok: boolean): void {
  const sec = pNum(ctx.spec, 'sec', 0);
  const latch = pBool(ctx.spec, 'latch', true);
  if (ok) s.t += ctx.dt;
  else s.t = pBool(ctx.spec, 'keepProgress', false) ? s.t : 0;
  if (s.t >= sec && ok) s.done = 1;
  else if (!latch) s.done = 0;
  ctx.output('done', s.done);
  ctx.output('progress', sec > 0 ? Math.min(1, s.t / sec) : ok ? 1 : 0);
}

definePart<{ inside: number }>({
  type: 'zoneSensor',
  outputs: ['in', 'entered', 'count'],
  init: () => ({ inside: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const count = ctx.players.filter((p) => playerIn(p, a)).length;
    const inside = count > 0 ? 1 : 0;
    ctx.output('entered', inside && !s.inside ? 1 : 0);
    ctx.output('in', inside);
    ctx.output('count', count);
    s.inside = inside;
  },
});

definePart<{ t: number; done: number }>({
  type: 'dwellSensor',
  outputs: ['done', 'progress'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const still = pBool(ctx.spec, 'still', true);
    hold(s, ctx, !!anyPlayer(ctx, (p) => playerIn(p, a) && (!still || (p.moveRank === 'still' && p.onGround))));
  },
});

/** 見ている: 目から target への向きと視線の角度が、半径 radius の円を見込む角（最小 minDeg）より小さい */
export function isLooking(p: PlayerState, target: Vec3, radius: number, maxDist: number, minDeg = 3): boolean {
  const eye: Vec3 = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  const d = dist3(eye, target);
  if (d > maxDist || d < 1e-3) return false;
  const v = lookDir(p.yaw, p.pitch);
  const to: Vec3 = [(target[0] - eye[0]) / d, (target[1] - eye[1]) / d, (target[2] - eye[2]) / d];
  const cos = v[0] * to[0] + v[1] * to[1] + v[2] * to[2];
  const half = Math.max(Math.atan2(radius, d), (minDeg * Math.PI) / 180);
  return cos >= Math.cos(half);
}

definePart<{ t: number; done: number }>({
  type: 'lookSensor',
  outputs: ['done', 'progress', 'looking'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const target = pVec(ctx.spec, 'target');
    const radius = pNum(ctx.spec, 'radius', 0.4);
    const maxDist = pNum(ctx.spec, 'maxDist', 30);
    const avoid = pStr(ctx.spec, 'mode', 'look') === 'avoid';
    const looking = !!anyPlayer(ctx, (p) => isLooking(p, target, radius, maxDist));
    const region = ctx.spec.params.aabb ? pAabb(ctx.spec, 'aabb') : null;
    const present = region ? !!anyPlayer(ctx, (p) => playerIn(p, region)) : true;
    ctx.output('looking', looking ? 1 : 0);
    hold(s, ctx, present && (avoid ? !looking : looking));
  },
});

definePart<{ t: number; done: number }>({
  type: 'speedSensor',
  outputs: ['done', 'progress', 'ok'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const region = ctx.spec.params.aabb ? pAabb(ctx.spec, 'aabb') : null;
    const min = pNum(ctx.spec, 'min', 0);
    const max = pNum(ctx.spec, 'max', Infinity);
    const backward = pBool(ctx.spec, 'backward', false);
    const ok = !!anyPlayer(ctx, (p) => {
      if (region && !playerIn(p, region)) return false;
      const hs = Math.hypot(p.vel[0], p.vel[2]);
      if (hs < min || hs > max) return false;
      if (!backward) return true;
      // 後ろ向き: 進む向きと視線の向きが逆（内積が負）
      const f = lookDir(p.yaw, 0);
      return (f[0] * p.vel[0] + f[2] * p.vel[2]) / Math.max(hs, 1e-6) < -0.5;
    });
    ctx.output('ok', ok ? 1 : 0);
    hold(s, ctx, ok);
  },
});

definePart<{ done: number }>({
  type: 'fallSensor',
  outputs: ['done'],
  init: () => ({ done: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const minSpeed = pNum(ctx.spec, 'minSpeed', 2.5);
    if (anyPlayer(ctx, (p) => playerIn(p, a) && -p.vel[1] >= minSpeed)) s.done = 1;
    else if (!pBool(ctx.spec, 'latch', true)) s.done = 0;
    ctx.output('done', s.done);
  },
});

definePart<{ t: number; done: number }>({
  type: 'distanceSensor',
  outputs: ['done', 'progress', 'ok'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    // 基準: 部品 entity の状態 pos（動く光など）か、点 target
    const entity = pStr(ctx.spec, 'entity', '');
    const st = entity ? ctx.stateOf(entity) : null;
    const pos = st && Array.isArray(st.pos) ? (st.pos as Vec3) : pVec(ctx.spec, 'target', [0, 0, 0]);
    const dist = pNum(ctx.spec, 'dist', 6);
    const near = pStr(ctx.spec, 'mode', 'far') === 'near';
    const region = ctx.spec.params.aabb ? pAabb(ctx.spec, 'aabb') : null;
    const ok = !!anyPlayer(ctx, (p) => (!region || playerIn(p, region)) && (near ? dist3(p.pos, pos) <= dist : dist3(p.pos, pos) >= dist));
    ctx.output('ok', ok ? 1 : 0);
    hold(s, ctx, ok);
  },
});

definePart<{ initial: number }>({
  type: 'countSensor',
  outputs: ['count', 'ratio', 'below', 'above'],
  init: () => ({ initial: -1 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const piles = ctx.spec.params.of;
    const ids = Array.isArray(piles) ? (piles as string[]) : typeof piles === 'string' ? [piles] : [];
    let count = 0;
    for (const id of ids) {
      const st = ctx.stateOf(id);
      const poses = st && Array.isArray(st.poses) ? (st.poses as number[]) : [];
      for (let i = 0; i + 2 < poses.length; i += 7) if (aabbContains(a, [poses[i]!, poses[i + 1]!, poses[i + 2]!])) count++;
    }
    // 最初の数は、物が落ち着いてから数える（settleSec 秒後。params.initial があればその値）
    if (s.initial < 0 && (typeof ctx.spec.params.initial === 'number' || ctx.time >= pNum(ctx.spec, 'settleSec', 1))) s.initial = pNum(ctx.spec, 'initial', count);
    const ratio = s.initial > 0 ? count / s.initial : count > 0 ? 1 : 0;
    ctx.output('count', count);
    ctx.output('ratio', ratio);
    ctx.output('below', ratio <= pNum(ctx.spec, 'belowRatio', 0.3) ? 1 : 0);
    ctx.output('above', count >= pNum(ctx.spec, 'aboveCount', Infinity) ? 1 : 0);
  },
});
