/**
 * 移動と身体の部品: 身体に掛かる物。
 * - sinkTrap: 流砂。範囲の中で立ち止まっていると、だんだん沈む（目が下がる・足が重くなる）。sec 秒で飲み込まれ、to へ戻される。
 *     歩いていれば沈んだ分が少しずつ戻る（体力は減らさない）
 * - facingPush: 後ろ向きでしか進めない通路。範囲の中で前（fwd）を向いていると、向いている度合いに応じて後ろへ押し戻される
 * - stretchWarp: 歩くと伸びる廊下。歩いて境目（origin を通り fwd に垂直な面）を越えると、同じ形の 1 区切り（period）手前へ
 *     継ぎ目なく戻される（廊下が伸びたように見える）。立ち止まっていると（stillSec）、廊下が縮むように前へ滑っていく（glide）
 */
import { aabbCenter } from '../../../math/aabb.ts';
import { lookDir, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, pVec } from '../../part.ts';

interface SinkState { t: { [player: string]: number }; level: number; [k: string]: Json | undefined }

definePart<SinkState>({
  type: 'sinkTrap',
  outputs: ['level', 'swallowed'],
  init: () => ({ t: {}, level: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const sec = pNum(ctx.spec, 'sec', 2);
    const depth = pNum(ctx.spec, 'depth', 0.9);
    let level = 0, swallowed = 0;
    for (const p of ctx.players) {
      let t = s.t[p.id] ?? 0;
      const inside = playerIn(p, a) && p.onGround;
      const still = Math.abs(p.input.x) + Math.abs(p.input.y) < 0.05;
      t = inside && still ? t + ctx.dt : Math.max(0, t - ctx.dt * (inside ? 1.5 : 4));
      if (t >= sec) {
        t = 0;
        swallowed = 1;
        ctx.cue('sink.swallow', aabbCenter(a));
        ctx.respawn(p, ctx.spec.params.to ? { pos: pVec(ctx.spec, 'to'), yaw: pNum(ctx.spec, 'toYaw', p.yaw) } : undefined);
      }
      s.t[p.id] = t;
      level = Math.max(level, t / sec);
    }
    // 沈み具合をゾーンにする（目が下がる・遅くなる）
    if (Math.abs(level - s.level) > 0.01 || (level === 0) !== (s.level === 0)) {
      ctx.setZone('sink', level > 0 ? { kind: 'water', aabb: a, params: { dry: true, slow: 0.4 * (1 - level * 0.6), sink: 0.15 + depth * level } } : null);
      s.level = level;
    }
    ctx.output('level', level);
    ctx.output('swallowed', swallowed);
  },
});

definePart<{ pushing: number }>({
  type: 'facingPush',
  outputs: ['pushing'],
  init: () => ({ pushing: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const fwd = pVec(ctx.spec, 'fwd');
    const push = pNum(ctx.spec, 'push', 5);
    const cone = pNum(ctx.spec, 'cone', 0.34);
    let pushing = 0;
    for (const p of ctx.players) {
      if (!playerIn(p, a)) continue;
      const f = lookDir(p.yaw, 0);
      const d = f[0] * fwd[0] + f[2] * fwd[2];
      if (d <= cone) continue;
      const k = Math.min(1, ((d - cone) / (1 - cone)) * 1.6);
      p.carry = [p.carry[0] - fwd[0] * push * k, p.carry[1], p.carry[2] - fwd[2] * push * k];
      pushing = Math.max(pushing, k);
    }
    if (pushing > 0.5 && s.pushing <= 0.5) ctx.cue('facing.push', aabbCenter(a));
    s.pushing = pushing;
    ctx.output('pushing', pushing);
  },
});

interface StretchState { prev: { [player: string]: number }; still: { [player: string]: number }; warps: number; gliding: number; [k: string]: Json | undefined }

definePart<StretchState>({
  type: 'stretchWarp',
  outputs: ['warps', 'gliding'],
  init: () => ({ prev: {}, still: {}, warps: 0, gliding: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const fwd = pVec(ctx.spec, 'fwd');
    const o = pVec(ctx.spec, 'origin');
    const period = pNum(ctx.spec, 'period', 1.8);
    const stillSec = pNum(ctx.spec, 'stillSec', 1.0);
    const glide = pNum(ctx.spec, 'glide', 1.2);
    let gliding = 0;
    for (const p of ctx.players) {
      if (!playerIn(p, a)) { delete s.prev[p.id]; delete s.still[p.id]; continue; }
      const stepping = Math.abs(p.input.x) + Math.abs(p.input.y) > 0.05;
      const still = stepping ? 0 : (s.still[p.id] ?? 0) + ctx.dt;
      s.still[p.id] = still;
      // 立ち止まっている: 廊下が縮むように前へ滑る（足音は鳴らない）
      if (still >= stillSec) {
        p.carry = [p.carry[0] + fwd[0] * glide, p.carry[1], p.carry[2] + fwd[2] * glide];
        gliding = 1;
      }
      let now = (p.pos[0] - o[0]) * fwd[0] + (p.pos[2] - o[2]) * fwd[2];
      const prev = s.prev[p.id] ?? now;
      // 歩いて境目を越えた: 1 区切り手前へ（同じ形の所なので、見た目は変わらない。遠くの出口だけが遠のく）
      if (stepping && prev < 0 && now >= 0) {
        const to: Vec3 = [p.pos[0] - fwd[0] * period, p.pos[1], p.pos[2] - fwd[2] * period];
        ctx.warp(p, to);
        now -= period;
        s.warps++;
        ctx.cue('stretch.warp', to);
      }
      s.prev[p.id] = now;
    }
    s.gliding = gliding;
    ctx.output('warps', s.warps);
    ctx.output('gliding', gliding);
  },
});
