/**
 * warpTreadmill: まっすぐな廊下の輪（閉じた輪の廊下 W06・逆向きに何周もすると輪がほどける BX02）。
 *
 * 廊下は向き fwd に、長さ period ごとに同じ物が並ぶ（霧で遠くは見えない）。
 * - 前へ進んで面 front（廊下の座標 u）を越えると、period だけ後ろへ戻す（同じ所なので継ぎ目が見えない）。lapsOut 回で輪がほどけ、奥へ進める
 * - 1 度前へ戻されたあとは、後ろへ戻って面 back を越えても period だけ前へ移す（輪が閉じる）。lapsBack 回で後ろの輪もほどけ、
 *   出力 back が 1 になる（隠しの入口が現れる）
 * - giveUpSec 秒たっても抜けられなければ、前も後ろもほどける（閉じ込めない。隠しは現れない）
 *
 * params: origin（廊下の座標の原点。床の高さ）・fwd（前の向き）・box（廊下の中。足元がこの中のときだけ）・period・front・back・
 *         lapsOut・lapsBack・giveUpSec
 * outputs: laps（前の周の数）・lapsBack・out（前がほどけた）・back（後ろの輪をほどいた）・open（どちらかがほどけた）
 */
import { rotQ, type Dir, type Vec3 } from '../../../math/vec.ts';
import { definePart, pNum, pVec } from '../../part.ts';
import { inBox, readAabb } from './util.ts';

definePart<{ u: Record<string, number>; laps: number; lapsBack: number; armed: number; out: number; back: number; backOpen: number; t: number; started: number }>({
  type: 'warpTreadmill',
  outputs: ['laps', 'lapsBack', 'out', 'back', 'open'],
  init: () => ({ u: {}, laps: 0, lapsBack: 0, armed: 0, out: 0, back: 0, backOpen: 0, t: 0, started: 0 }),
  step(s, ctx) {
    const o = pVec(ctx.spec, 'origin');
    const fwd = (pNum(ctx.spec, 'fwd', 0) & 3) as Dir;
    const f = rotQ([0, 0, 1], fwd);
    const box = readAabb(ctx.spec.params.box);
    const P = pNum(ctx.spec, 'period', 12);
    const front = pNum(ctx.spec, 'front', 30), back = pNum(ctx.spec, 'back', 14);
    const lapsOut = pNum(ctx.spec, 'lapsOut', 4), lapsBack = pNum(ctx.spec, 'lapsBack', 3);
    const giveUp = pNum(ctx.spec, 'giveUpSec', 80);
    for (const p of ctx.players) {
      const inside = inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], box);
      const u = (p.pos[0] - o[0]) * f[0] + (p.pos[2] - o[2]) * f[2];
      const prev = s.u[p.id];
      s.u[p.id] = u;
      if (!inside || prev === undefined || Math.abs(u - prev) > 1) continue;
      if (!s.started && u > back) s.started = 1;
      const shift = (d: number): void => {
        const to: Vec3 = [p.pos[0] + f[0] * d, p.pos[1], p.pos[2] + f[2] * d];
        ctx.warp(p, to, p.yaw);
        s.u[p.id] = u + d;
      };
      if (prev < front && u >= front && !s.out) {
        shift(-P);
        s.laps++;
        s.armed = 1;
        if (s.laps >= lapsOut) { s.out = 1; ctx.cue('loop.open', p.pos, { dir: 'front' }); }
      } else if (prev > back && u <= back && s.armed && !s.backOpen) {
        shift(P);
        s.lapsBack++;
        if (s.lapsBack >= lapsBack) { s.back = 1; s.backOpen = 1; ctx.cue('loop.open', p.pos, { dir: 'back' }); }
      }
    }
    if (s.started && !(s.out && s.backOpen)) {
      s.t += ctx.dt;
      if (s.t >= giveUp) {
        if (!s.out || !s.backOpen) ctx.cue('loop.open', undefined, { dir: 'both' });
        s.out = 1;
        s.backOpen = 1;
      }
    }
    ctx.output('laps', s.laps);
    ctx.output('lapsBack', s.lapsBack);
    ctx.output('out', s.out);
    ctx.output('back', s.back);
    ctx.output('open', s.out || s.backOpen ? 1 : 0);
  },
});
