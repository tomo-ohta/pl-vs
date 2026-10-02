/**
 * 落ちてくる天井の部品（G05）。
 *
 * - ceilingPress: 帯の天井の塊。決まった周期で 上がっている（up）→ 影と粉の予告（warn）→ 落ちる（fall）→ 下りている（hold）→ 上がる（rise）。
 *     周期は時刻と offset から決まる（決定的）。下りてくる塊の下に体があれば潰されて、入ってきた開口の前（fronts のうち、最後に近くにいた物）へ戻す。
 *     塊は床から天井までの箱（下りている間は帯が塞がる）。出力 h（塊の下の端の床からの高さ）・phase（0..4）・warn（予告の進み 0..1）・
 *     safe（上がっていて、safeSec 秒より長く落ちてこない。歩く人が待つ）・hit（潰した tick）
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { PLAYER } from '../../player.ts';
import { definePart, pAabb, pNum } from '../../part.ts';

interface PressState { phase: number; last: number[]; [k: string]: Json | undefined }

/** 周期の中の時刻 τ から、段階と塊の高さ（床から） */
export function pressAt(tau: number, c: { up: number; warn: number; fall: number; hold: number; rise: number; top: number }): { phase: number; h: number; k: number } {
  let x = tau;
  if (x < c.up) return { phase: 0, h: c.top, k: x / c.up };
  x -= c.up;
  if (x < c.warn) return { phase: 1, h: c.top, k: x / c.warn };
  x -= c.warn;
  if (x < c.fall) { const k = x / c.fall; return { phase: 2, h: c.top * (1 - k * k), k }; }
  x -= c.fall;
  if (x < c.hold) return { phase: 3, h: 0, k: x / c.hold };
  x -= c.hold;
  const k = Math.min(1, x / c.rise);
  return { phase: 4, h: c.top * k, k };
}

definePart<PressState>({
  type: 'ceilingPress',
  outputs: ['h', 'phase', 'warn', 'safe', 'hit'],
  init: () => ({ phase: -1, last: [] }),
  step(s, ctx) {
    const b = pAabb(ctx.spec, 'box');
    const y = pNum(ctx.spec, 'y', b.min[1]);
    const c = { up: pNum(ctx.spec, 'up', 2.6), warn: pNum(ctx.spec, 'warn', 1), fall: pNum(ctx.spec, 'fall', 0.25), hold: pNum(ctx.spec, 'hold', 0.9), rise: pNum(ctx.spec, 'rise', 1.4), top: pNum(ctx.spec, 'top', 2.4) };
    const period = c.up + c.warn + c.fall + c.hold + c.rise;
    const tau = (((ctx.time + pNum(ctx.spec, 'offset', 0)) % period) + period) % period;
    const st = pressAt(tau, c);
    const center: Vec3 = [(b.min[0] + b.max[0]) / 2, y + st.h, (b.min[2] + b.max[2]) / 2];
    if (st.phase !== s.phase) {
      if (st.phase === 1) ctx.cue('press.warn', center);
      else if (st.phase === 3) ctx.cue('press.land', [center[0], y, center[2]]);
      else if (st.phase === 4) ctx.cue('press.rise', center);
      s.phase = st.phase;
    }
    const fronts = (ctx.spec.params.fronts as number[][] | undefined) ?? [];
    let hit = 0;
    ctx.players.forEach((p, i) => {
      // 最後に近くにいた開口（潰されたらそこへ戻す）
      let best = -1, bd = 1.6;
      fronts.forEach((f, j) => { const d = Math.hypot(p.pos[0] - f[0]!, p.pos[2] - f[2]!); if (d < bd) { bd = d; best = j; } });
      if (best >= 0) s.last[i] = best;
      // 潰される: 体の真ん中が帯の上（縁から 0.2 m の内側まで）で、塊の下の端が頭より下へ来た
      const inside = p.pos[0] > b.min[0] - 0.2 && p.pos[0] < b.max[0] + 0.2 && p.pos[2] > b.min[2] - 0.2 && p.pos[2] < b.max[2] + 0.2;
      const head = p.pos[1] - y + (p.crouching ? PLAYER.crouchHeight : PLAYER.height);
      if (inside && st.h < head - 0.05 && p.pos[1] < y + c.top && (st.phase === 2 || st.phase === 3)) {
        const f = fronts[s.last[i] ?? 0] ?? fronts[0];
        ctx.cue('press.hit', [p.pos[0], p.pos[1] + 1, p.pos[2]]);
        if (f) ctx.respawn(p, { pos: [f[0]!, f[1]!, f[2]!], yaw: f[3] ?? p.yaw });
        else ctx.respawn(p);
        hit = 1;
      }
    });
    const a: AABB = { min: [b.min[0], y + st.h, b.min[2]], max: [b.max[0], y + st.h + (b.max[1] - b.min[1]), b.max[2]] };
    ctx.setCollider('slab', a);
    ctx.output('h', st.h);
    ctx.output('phase', st.phase);
    ctx.output('warn', st.phase === 1 ? st.k : st.phase === 2 || st.phase === 3 ? 1 : 0);
    ctx.output('safe', st.phase === 0 && c.up - tau >= pNum(ctx.spec, 'safeSec', 1.2) ? 1 : 0);
    ctx.output('hit', hit);
  },
});
