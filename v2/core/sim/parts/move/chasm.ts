/**
 * 移動と身体の部品: 溝・穴の上を渡る仕掛け。
 * - trapTile: 抜ける床板。上で速く動く（speed m/s より速い。しゃがみ歩きより速い）と軋み、creakSec 続くと蝶番で下へ開く。
 *     跳んで着地しても、上で立ち止まって stillSec たっても開く（しゃがんで、止まらずに渡る）。openSec 秒で閉じる
 *     （中に人がいる間は閉じない）
 * - swayBridge: 吊り橋。橋板は面（SupportSurface）で、横に傾いて揺れる。揺れは上を歩く速さで大きくなり（走ると大きい）、
 *     立ち止まると収まる。傾きの分だけ横へ押す（大きく揺れると橋から落ちる）
 * - pendulum: 振り子の板（当たり判定の箱）。軸 pivot から長さ len で、向き swing（水平）に角度 amp で揺れる。
 *     当たると板の速さで弾き飛ばす。上に立つと一緒に揺れる（ride 出力: 乗っている間 1）
 * - dustCover: 見えない足場の上の埃（見た目だけ。描画が rects の上に埃の粒を置く）
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import { clamp, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, pVec, type PartContext } from '../../part.ts';
import { bodyAabb, PLAYER } from '../../player.ts';

// ---------------------------------------------------------------- 抜ける床板
interface TrapState { open: number; t: number; angle: number; air: { [player: string]: number }; creak?: number; still?: number; [k: string]: Json | undefined }

definePart<TrapState>({
  type: 'trapTile',
  outputs: ['open'],
  init(ctx) {
    ctx.setCollider('tile', pAabb(ctx.spec, 'box'));
    return { open: 0, t: 0, angle: 0, air: {} };
  },
  step(s, ctx) {
    const b = pAabb(ctx.spec, 'box');
    // 体が少しでも掛かっていれば床板の上とみなす（継ぎ目の上・床板の縁に立っていても、掛かっている床板はどれも開く）
    const R = PLAYER.radius - 0.05;
    const top: AABB = { min: [b.min[0] - R, b.max[1] - 0.05, b.min[2] - R], max: [b.max[0] + R, b.max[1] + 0.3, b.max[2] + R] };
    const speedMax = pNum(ctx.spec, 'speed', 4.0);
    if (!s.open) {
      let fast = false, still = false, landedAny = false;
      for (const p of ctx.players) {
        // 宙にいた時間（跳んで着地したかを見る）
        if (!p.onGround) s.air[p.id] = (s.air[p.id] ?? 0) + ctx.dt;
        const landed = p.onGround && (s.air[p.id] ?? 0) > pNum(ctx.spec, 'airSec', 0.3);
        if (p.onGround) s.air[p.id] = 0;
        if (!playerIn(p, top)) continue;
        const hs = Math.hypot(p.vel[0], p.vel[2]);
        if (landed) landedAny = true;
        if (hs > speedMax) fast = true;
        else if (hs < 0.3) still = true;
      }
      // 速く動いている間は軋み（初めに 1 回音）、続くと開く。止まっている間も数える
      if (fast && !s.creak) ctx.cue('trap.creak', aabbCenter(b));
      s.creak = fast ? (s.creak ?? 0) + ctx.dt : 0;
      s.still = still ? (s.still ?? 0) + ctx.dt : 0;
      if (landedAny || (fast && s.creak >= pNum(ctx.spec, 'creakSec', 0)) || (still && s.still >= pNum(ctx.spec, 'stillSec', Infinity))) {
        s.open = 1; s.t = 0; s.creak = 0; s.still = 0;
        ctx.setCollider('tile', null);
        ctx.cue('trap.open', aabbCenter(b), { by: landedAny ? 'land' : fast ? 'run' : 'still' });
      }
    } else {
      s.t += ctx.dt;
      const busy = ctx.players.some((p) => playerIn(p, { min: [b.min[0] - 0.3, b.min[1] - 2.5, b.min[2] - 0.3], max: [b.max[0] + 0.3, b.max[1] + 2, b.max[2] + 0.3] }));
      if (s.t >= pNum(ctx.spec, 'openSec', 3) && !busy) { s.open = 0; ctx.setCollider('tile', b); ctx.cue('trap.close', aabbCenter(b)); }
    }
    s.angle += clamp((s.open ? 1 : 0) - s.angle, -ctx.dt * 6, ctx.dt * 2);
    ctx.output('open', s.open);
  },
});

// ---------------------------------------------------------------- 吊り橋
interface SwayState { amp: number; phase: number; roll: number; [k: string]: Json | undefined }

definePart<SwayState>({
  type: 'swayBridge',
  outputs: ['amp', 'roll'],
  init(ctx) {
    setDeck(ctx, 0);
    return { amp: 0, phase: 0, roll: 0 };
  },
  step(s, ctx) {
    const alongX = pNum(ctx.spec, 'axis', 0) === 0;
    const period = pNum(ctx.spec, 'period', 1.7);
    const id = `${ctx.id}:deck`;
    // 揺れの大きさ: 歩けば小さく揺れ（速さに比例）、歩くより速い（thresh m/s 超え）と大きく揺れ出す。止まると収まる
    let speed = 0;
    for (const p of ctx.players) if (p.surfaceId === id) speed = Math.max(speed, Math.hypot(p.vel[0], p.vel[2]));
    const excite = Math.max(0, speed - pNum(ctx.spec, 'thresh', 3.3)) ** 2 * pNum(ctx.spec, 'gain', 4);
    s.amp = clamp(s.amp + (excite - s.amp * pNum(ctx.spec, 'damp', 0.8)) * ctx.dt, 0, pNum(ctx.spec, 'maxDeg', 16));
    s.phase = (s.phase + (ctx.dt / period) * Math.PI * 2) % (Math.PI * 2);
    s.roll = Math.sin(s.phase) * (s.amp + speed * pNum(ctx.spec, 'base', 1.0));
    setDeck(ctx, s.roll);
    // 傾いた分だけ、低い側へ押す（大きく揺れると橋から落ちる）
    const push = pNum(ctx.spec, 'push', 0.32);
    for (const p of ctx.players) {
      if (p.surfaceId !== id) continue;
      const v = Math.sin((s.roll * Math.PI) / 180) * 9.8 * push;
      if (alongX) p.carry = [p.carry[0], p.carry[1], p.carry[2] + v];
      else p.carry = [p.carry[0] + v, p.carry[1], p.carry[2]];
    }
    ctx.output('amp', s.amp);
    ctx.output('roll', s.roll);
  },
});

/** 橋板の面: 長い向き（axis 0 = x）を軸に roll 度傾ける。軸は橋の真ん中の線 */
function setDeck(ctx: PartContext, roll: number): void {
  const r = ctx.spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const y = pNum(ctx.spec, 'y', 0);
  const alongX = pNum(ctx.spec, 'axis', 0) === 0;
  const a = (roll * Math.PI) / 180;
  const origin: Vec3 = [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2];
  // 横（z または x）へ傾ける: 法線を横へ倒す
  const normal: Vec3 = alongX ? [0, Math.cos(a), Math.sin(a)] : [Math.sin(a), Math.cos(a), 0];
  ctx.setSurface('deck', { id: `${ctx.id}:deck`, rect: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, origin, normal, thickness: 0.5 });
}

// ---------------------------------------------------------------- 振り子
interface PendState { angle: number; vel: number[]; pos: number[]; ride: number; [k: string]: Json | undefined }

/** 振り子の板の真ん中（角度 θ） */
function bobAt(pivot: Vec3, swing: Vec3, len: number, th: number): Vec3 {
  return [pivot[0] + swing[0] * Math.sin(th) * len, pivot[1] - Math.cos(th) * len, pivot[2] + swing[2] * Math.sin(th) * len];
}

definePart<PendState>({
  type: 'pendulum',
  outputs: ['angle', 'ride'],
  init(ctx) {
    const pivot = pVec(ctx.spec, 'pivot'), swing = pVec(ctx.spec, 'swing');
    const len = pNum(ctx.spec, 'len', 2), amp = pNum(ctx.spec, 'amp', 0.8);
    const th = amp * Math.sin(pNum(ctx.spec, 'phase', 0));
    const c = bobAt(pivot, swing, len, th);
    ctx.setCollider('bob', boxAround(ctx, c));
    return { angle: th, vel: [0, 0, 0], pos: c, ride: 0 };
  },
  step(s, ctx) {
    const pivot = pVec(ctx.spec, 'pivot'), swing = pVec(ctx.spec, 'swing');
    const len = pNum(ctx.spec, 'len', 2), amp = pNum(ctx.spec, 'amp', 0.8), period = pNum(ctx.spec, 'period', 2.6);
    const th = amp * Math.sin((ctx.time / period) * Math.PI * 2 + pNum(ctx.spec, 'phase', 0));
    const c = bobAt(pivot, swing, len, th);
    const prev = s.pos as Vec3;
    const v: Vec3 = [(c[0] - prev[0]) / ctx.dt, (c[1] - prev[1]) / ctx.dt, (c[2] - prev[2]) / ctx.dt];
    const now = boxAround(ctx, c);
    let ride = 0;
    for (const p of ctx.players) {
      const b = bodyAabb(p);
      // 上に乗っている: 板と一緒に動かす（速いので速度で運ぶと滑り落ちる。位置をそのまま動かす）
      const top = now.max[1] - (c[1] - prev[1]);
      // 立っている、または上へ降りてくる途中（跳び乗った直後）
      const standing = p.onGround ? Math.abs(p.pos[1] - top) < 0.1 : p.vel[1] <= 0.5 && p.pos[1] >= top - 0.05 && p.pos[1] - top < 0.25;
      const onTop = standing && p.pos[0] > now.min[0] - (c[0] - prev[0]) - 0.2 && p.pos[0] < now.max[0] - (c[0] - prev[0]) + 0.2 && p.pos[2] > now.min[2] - (c[2] - prev[2]) - 0.2 && p.pos[2] < now.max[2] - (c[2] - prev[2]) + 0.2;
      if (onTop) {
        p.pos = [p.pos[0] + c[0] - prev[0], now.max[1], p.pos[2] + c[2] - prev[2]];
        ride = 1;
        continue;
      }
      // 当たった（板が体に入り込む）: 板の速さで弾き飛ばす
      // 板の真ん中より上に足がある（板に跳び乗った）なら弾かない
      const hit = p.pos[1] < c[1] && b.min[0] < now.max[0] && b.max[0] > now.min[0] && b.min[1] < now.max[1] && b.max[1] > now.min[1] && b.min[2] < now.max[2] && b.max[2] > now.min[2];
      if (hit) {
        const k = pNum(ctx.spec, 'knock', 1.4);
        p.vel = [v[0] * k, Math.max(p.vel[1], pNum(ctx.spec, 'lift', 2.6)), v[2] * k];
        p.onGround = false;
        ctx.cue('pendulum.hit', [p.pos[0], p.pos[1] + 1, p.pos[2]]);
      }
    }
    ctx.setCollider('bob', now);
    s.angle = th; s.vel = v; s.pos = c; s.ride = ride;
    ctx.output('angle', th);
    ctx.output('ride', ride);
  },
});

/** 振り子の板の箱（真ん中 c、大きさ half） */
function boxAround(ctx: { spec: { params: { [k: string]: Json } } }, c: Vec3): AABB {
  const h = ctx.spec.params.half as number[];
  return { min: [c[0] - h[0]!, c[1] - h[1]!, c[2] - h[2]!], max: [c[0] + h[0]!, c[1] + h[1]!, c[2] + h[2]!] };
}

// ---------------------------------------------------------------- 見えない足場の埃（見た目だけ）
definePart({
  type: 'dustCover',
  init: () => ({}),
});
