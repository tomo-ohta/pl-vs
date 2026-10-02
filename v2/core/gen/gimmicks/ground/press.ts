/**
 * 落ちてくる天井（G05・ceilingPress）: 部屋を横切る帯ごとに、天井の塊がくり返し落ちてくる部屋。
 *
 * - 入口から奥へ、落ちる天井の帯（奥行き bandM）と落ちてこない床（黄色と黒の線の帯 stripeM）が交互に並ぶ。帯ごとに落ちる時刻がずれていて、
 *   影が濃くなり粉が降ってきたら（予告）、すぐに落ちる。下りている間は帯が天井まで塞がる。読めれば歩いて抜けられるが、立ち止まると潰される
 * - 潰されたら、入ってきた開口の前へ戻される（失敗の代償。体力は減らさない）
 * - 横の壁の開口の前・入口と奥の壁際は落ちてこない（扉の前で待てる。閉じ込めない: 天井は必ず上がる）
 * - 歩く人: 開口の組（入る・出る）ごとに、帯の手前の線の上で「しばらく落ちてこない」を待ってから渡る手順（params.bot）
 */
import type { Rect } from '../../../world/footprint.ts';
import { box, type Json, type WallOpening } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson } from '../util.ts';
import { botHint, enterAt, entranceFrame, onRectWall, openingAt, snap, type BotStepSpec } from './common.ts';

defineGimmick({
  id: 'ceilingPress', name: '落ちてくる天井', axes: ['move', 'time'], kinds: ['room', 'hall'], minSize: [3.6, 6.4], minHeight: 2.6, weight: 0.45, intensity: 2, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY, H = s.cell.height;
    if (!s.entrance || s.openings.some((o) => !onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const B = t['ground.press.bandM'], S = t['ground.press.stripeM'];
    // 落ちてこない奥行きの範囲: 入口の壁際・奥の壁際・横の壁の開口の前
    const safe: [number, number][] = [[-1, 1.3], [F.depth - 1.3, F.depth + 1]];
    const sideOf = (o: WallOpening): boolean => o.dir % 2 !== F.d % 2;
    for (const o of s.openings) if (sideOf(o)) { const v = F.v(o.pos[0], o.pos[2]); safe.push([v - o.width / 2 - 0.7, v + o.width / 2 + 0.7]); }
    const bands: [number, number][] = [];
    for (let v = 1.3; v + B <= F.depth - 1.3 + 1e-6;) {
      if (safe.some(([a, b]) => v < b && v + B > a)) { v = snap(v + 0.05); continue; }
      bands.push([v, v + B]);
      v = snap(v + B + S);
    }
    if (bands.length < 2) return;
    const cyc = { up: t['ground.press.upSec'], warn: t['ground.press.warnSec'], fall: t['ground.press.fallSec'], hold: t['ground.press.holdSec'], rise: t['ground.press.riseSec'] };
    const period = cyc.up + cyc.warn + cyc.fall + cyc.hold + cyc.rise;
    // 戻す位置: 開口の前（部屋の内向き）
    const fronts: Json = s.openings.map((o) => { const f = ctx.frontOf(o, 0.9); return [f[0], y, f[2], [0, Math.PI / 2, Math.PI, -Math.PI / 2][o.dir]!]; });
    // 帯の天井の照明は外し、点光源は近くの線の上へ
    const rects: Rect[] = bands.map(([a, b]) => F.rect(F.u0, a, F.u1, b));
    const inBand = (x: number, z: number): number => rects.findIndex((r) => x > r.x0 - 0.3 && x < r.x1 + 0.3 && z > r.z0 - 0.3 && z < r.z1 + 0.3);
    ctx.removeBoxes((b) => !b.solid && b.min[1] > y + H - 0.4 && inBand((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2) >= 0);
    for (const l of s.cell.lights) {
      const k = inBand(l.pos[0], l.pos[2]);
      if (k < 0) continue;
      const v = F.v(l.pos[0], l.pos[2]), u = F.u(l.pos[0], l.pos[2]);
      const nv = v - bands[k]![0] < bands[k]![1] - v ? bands[k]![0] - 0.45 : bands[k]![1] + 0.45;
      const p = F.point(u, nv);
      l.pos = [p[0], l.pos[1], p[1]];
    }
    const base = ctx.rng.float(0, period);
    const ids: string[] = [];
    bands.forEach(([a, b], k) => {
      const r = rects[k]!;
      // 帯の天井の縁（塊が収まる溝の黒い縁取り）と、床の線（黄色と黒。落ちてこない所の印）
      for (const v of [a - 0.06, b]) { const q = F.rect(F.u0, v, F.u1, v + 0.06); ctx.addBox(box([q.x0, y + H - 0.02, q.z0], [q.x1, y + H, q.z1], 'metalDark', false)); }
      for (const v of [a - 0.12, b + 0.04]) { const q = F.rect(F.u0, v, F.u1, v + 0.08); ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + 0.004, q.z1], 'yellowLine', false)); }
      // 落ちる時刻は奥の帯ほど遅れる（入口から見ると、落ちる波が奥へ流れていく）
      const offset = (base + k * period * 0.31) % period;
      ids.push(ctx.addEntity(`band${k}`, { type: 'ceilingPress', params: { box: aabbJson({ min: [r.x0, y, r.z0], max: [r.x1, y + H, r.z1] }), y, top: H - 0.3, ...cyc, offset, fronts, safeSec: t['ground.press.safeSec'] } }));
    });
    // 歩く人の手順: 開口の組ごとに、渡る帯の手前で待ってから渡る
    const hints: Json[] = [];
    for (const a of s.openings) for (const b of s.openings) {
      if (a === b) continue;
      const va = sideOf(a) ? F.v(a.pos[0], a.pos[2]) : a.dir === F.d ? 0.9 : F.depth - 0.9;
      const vb = sideOf(b) ? F.v(b.pos[0], b.pos[2]) : b.dir === F.d ? 0.9 : F.depth - 0.9;
      const ua = sideOf(a) ? null : openingAt(a), ub = sideOf(b) ? null : openingAt(b);
      const lane = Math.min(F.u1 - 0.6, Math.max(F.u0 + 0.6, ub ?? ua ?? (F.u0 + F.u1) / 2));
      const fwd = vb > va ? 1 : -1;
      const crossed = bands.map((bd, k) => ({ bd, k })).filter(({ bd }) => (fwd > 0 ? bd[0] > va && bd[1] < vb : bd[1] < va && bd[0] > vb));
      if (fwd < 0) crossed.reverse();
      const steps: BotStepSpec[] = [];
      for (const { bd, k } of crossed) {
        const before = F.point(lane, fwd > 0 ? bd[0] - 0.5 : bd[1] + 0.5), after = F.point(lane, fwd > 0 ? bd[1] + 0.5 : bd[0] - 0.5);
        steps.push({ at: [before[0], y, before[1]], until: `${ids[k]}.safe` }, { at: [after[0], y, after[1]] });
      }
      if (steps.length) hints.push({ ...(botHint(steps, { enterAt: enterAt(a) }) as { [k: string]: Json }), exitAt: enterAt(b) });
    }
    if (hints.length) ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: hints } });
    const all = F.rect(F.u0, 0, F.u1, F.depth);
    ctx.keepOut({ min: [all.x0, y, all.z0], max: [all.x1, y + H, all.z1] });
  },
});
