/**
 * 視線と観測の部品（段階 4・担当 sense）。
 * - daruma: だるまさんがころんだ。鬼（pos・壁を向く yaw）は数え歌（chant 秒。周期ごとに seed から長さが変わる）の間は壁を向き、歌が終わると振り返って
 *     watch 秒こちらを見る。見られている間に区画 region の中（safe の矩形 = 開口の前は除く）で動く（見られた所から tol m 以上・速さ 0.8 m/s 以上）と捕まり、
 *     入口 to へ戻される。catchesToCorner 回目からは隅 corner へ連れて行かれる（隠しの扉の前）。
 *     状態: phase（0 歌 / 1 振り返る / 2 見ている / 3 戻る）・t（phase の経過秒）・dur（phase の長さ）。出力 watching・caught・corner
 */
import { hashAll, Rng } from '../../../math/rng.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, type PartContext } from '../../part.ts';

interface DarumaState { phase: number; t: number; dur: number; cycle: number; caught: number; corner: number; anchor: { [id: string]: Json }; [k: string]: Json | undefined }

/** 周期 cycle の歌・見る時間（seed から決まる） */
export function darumaDurations(seed: number, cycle: number, p: { chantMin: number; chantMax: number; watchMin: number; watchMax: number }): { chant: number; watch: number } {
  const r = new Rng(hashAll(seed, 'daruma', cycle));
  return { chant: r.float(p.chantMin, p.chantMax), watch: r.float(p.watchMin, p.watchMax) };
}

const durParams = (ctx: PartContext): { chantMin: number; chantMax: number; watchMin: number; watchMax: number } => ({
  chantMin: pNum(ctx.spec, 'chantMin', 2.5), chantMax: pNum(ctx.spec, 'chantMax', 5), watchMin: pNum(ctx.spec, 'watchMin', 2), watchMax: pNum(ctx.spec, 'watchMax', 3.5),
});

const inSafe = (safe: number[][], x: number, z: number): boolean => safe.some((r) => x >= r[0]! && x <= r[2]! && z >= r[1]! && z <= r[3]!);

definePart<DarumaState>({
  type: 'daruma',
  outputs: ['watching', 'caught', 'corner'],
  init(ctx) {
    const d = darumaDurations(pNum(ctx.spec, 'seed', 1), 0, durParams(ctx));
    return { phase: 0, t: 0, dur: d.chant, cycle: 0, caught: 0, corner: 0, anchor: {} };
  },
  step(s, ctx) {
    const turn = pNum(ctx.spec, 'turnSec', 0.35);
    const seed = pNum(ctx.spec, 'seed', 1);
    s.t += ctx.dt;
    if (s.t >= s.dur) {
      s.t -= s.dur;
      s.phase = (s.phase + 1) % 4;
      if (s.phase === 0) { s.cycle++; s.dur = darumaDurations(seed, s.cycle, durParams(ctx)).chant; ctx.cue('daruma.chant', undefined, { dur: s.dur }); }
      else if (s.phase === 2) { s.dur = darumaDurations(seed, s.cycle, durParams(ctx)).watch; s.anchor = {}; ctx.cue('daruma.look', pOf(ctx)); }
      else s.dur = turn;
    }
    const watching = s.phase === 2;
    if (watching) {
      const region = pAabb(ctx.spec, 'region');
      const safe = (ctx.spec.params.safe as number[][] | undefined) ?? [];
      const tol = pNum(ctx.spec, 'tol', 0.15);
      for (const p of ctx.players) {
        if (!playerIn(p, region) || inSafe(safe, p.pos[0], p.pos[2])) { delete s.anchor[p.id]; continue; }
        const a = s.anchor[p.id] as number[] | undefined;
        if (!a) { s.anchor[p.id] = [p.pos[0], p.pos[2]]; continue; }
        const moved = Math.hypot(p.pos[0] - a[0]!, p.pos[2] - a[1]!) > tol || Math.hypot(p.vel[0], p.vel[2]) > 0.8;
        if (!moved) continue;
        s.caught++;
        ctx.cue('daruma.caught', [p.pos[0], p.pos[1] + 1, p.pos[2]]);
        const corner = ctx.spec.params.corner as number[] | undefined;
        if (corner && s.caught >= pNum(ctx.spec, 'catchesToCorner', 3)) {
          s.corner = 1;
          ctx.respawn(p, { pos: [corner[0]!, corner[1]!, corner[2]!], yaw: corner[3] ?? 0 });
        } else {
          const to = ctx.spec.params.to as number[];
          ctx.respawn(p, { pos: [to[0]!, to[1]!, to[2]!], yaw: pNum(ctx.spec, 'toYaw', 0) });
        }
        delete s.anchor[p.id];
      }
    }
    ctx.output('watching', s.phase === 1 || s.phase === 2 ? 1 : 0);
    ctx.output('caught', s.caught);
    ctx.output('corner', s.corner);
  },
});

const pOf = (ctx: PartContext): Vec3 => {
  const p = ctx.spec.params.pos as number[];
  return [p[0]!, p[1]! + 1.4, p[2]!];
};
