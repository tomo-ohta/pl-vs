/**
 * 時間の部品（段階 4・担当 sense）。
 * - flood: 穴の水が周期で満ちて引く（低い low 秒 → 満ちる rise 秒 → 高い high 秒 → 引く drain 秒）。水に浮く箱（crates）は水面に乗って上下し、
 *     上に立つ人を運ぶ。水の中は遅い（ゾーン water）。泳げないので、頭まで水に浸かって drown 秒で入口へ戻す（体力は減らさない）。
 *     出力 level（水面の高さ）・high（満ちている間 1）。状態 tops（箱の上面の高さ。描画が読む）
 * - rewind: period 秒ごとに部屋が巻き戻る。部屋の中の人は、前に巻き戻ったとき（後から入った人は入ったとき）の場所へ戻る。
 *     出力 pulse（巻き戻った tick だけ 1。レバーの reset につなぐ）・left（次に巻き戻るまでの秒）
 * - loopClock: 同じ 1 分（period 秒）のくり返し。秒 ring の間は電話が鳴り（調べると出る → answered）、秒 open の間は出口の鍵が開く（open）。
 *     周期の終わりに部屋の中にいる人（grace 秒より長くいた人）は入口へ戻る（同じ 1 分の始まり）。出力 open・ringing・answered・sec
 * - closing: 閉店のアナウンス。部屋の奥へ入ると放送が流れ、delay 秒の後、入口の側から照明が区間ごとに消えていく（速さ speed）。
 *     出力 step（消えた区間の数）。区間 i の照明は step が i より小さい間だけ点く（threshold で lamp へ）。
 *     闇に捕まって入口の前へ戻されると（入口の前に人がいて、もう消え始めている）、照明は全部戻り、もう一度奥へ入ると始まる
 */
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pVec, type PartContext } from '../../part.ts';
import type { PlayerState } from '../../types.ts';

const inRect = (r: readonly number[], x: number, z: number, m = 0): boolean => x >= r[0]! - m && x <= r[2]! + m && z >= r[1]! - m && z <= r[3]! + m;
const inBox = (p: PlayerState, b: { min: number[]; max: number[] }): boolean => p.pos[0] >= b.min[0]! && p.pos[0] <= b.max[0]! && p.pos[2] >= b.min[2]! && p.pos[2] <= b.max[2]! && p.pos[1] + 0.1 >= b.min[1]! && p.pos[1] <= b.max[1]!;
const toOf = (ctx: PartContext): { pos: Vec3; yaw: number } => ({ pos: pVec(ctx.spec, 'to'), yaw: pNum(ctx.spec, 'toYaw', 0) });

// ---------------------------------------------------------------- 増水
/** 時刻 t の水面の高さ（低い bottom・高い top。周期 low → rise → high → drain） */
export function floodLevel(t: number, o: { bottom: number; top: number; low: number; rise: number; high: number; drain: number; phase: number }): { level: number; stage: 'low' | 'rise' | 'high' | 'drain'; left: number } {
  const period = o.low + o.rise + o.high + o.drain;
  let u = (((t + o.phase) % period) + period) % period;
  if (u < o.low) return { level: o.bottom, stage: 'low', left: o.low - u };
  u -= o.low;
  if (u < o.rise) { const k = u / o.rise; return { level: o.bottom + (o.top - o.bottom) * (k * k * (3 - 2 * k)), stage: 'rise', left: o.rise - u }; }
  u -= o.rise;
  if (u < o.high) return { level: o.top, stage: 'high', left: o.high - u };
  u -= o.high;
  const k = u / o.drain;
  return { level: o.top - (o.top - o.bottom) * (k * k * (3 - 2 * k)), stage: 'drain', left: o.drain - u };
}

export const floodParams = (ctx: PartContext | { spec: { params: { [k: string]: Json } } }): Parameters<typeof floodLevel>[1] => {
  const p = ctx.spec.params as { [k: string]: number };
  return { bottom: p.bottom!, top: p.top!, low: p.low!, rise: p.rise!, high: p.high!, drain: p.drain!, phase: p.phase ?? 0 };
};

/** 箱の上面の高さ（水に浮く: 水面 + free。沈んでいれば底に置いた高さ） */
export const crateTop = (c: readonly number[], level: number, bottom: number): number => Math.max(bottom + c[4]!, level + c[5]!);

interface FloodState { level: number; tops: number[]; under: { [id: string]: number }; [k: string]: Json }

definePart<FloodState>({
  type: 'flood',
  outputs: ['level', 'high'],
  init(ctx) {
    const o = floodParams(ctx);
    const crates = (ctx.spec.params.crates as number[][] | undefined) ?? [];
    const lv = floodLevel(0, o).level;
    const tops = crates.map((c) => crateTop(c, lv, o.bottom));
    crates.forEach((c, i) => ctx.setCollider(`c${i}`, { min: [c[0]!, tops[i]! - c[4]!, c[1]!], max: [c[2]!, tops[i]!, c[3]!] }));
    return { level: lv, tops, under: {} };
  },
  step(s, ctx) {
    const o = floodParams(ctx);
    const r = floodLevel(ctx.time, o);
    const crates = (ctx.spec.params.crates as number[][] | undefined) ?? [];
    const hole = ctx.spec.params.hole as number[];
    crates.forEach((c, i) => {
      const prev = s.tops[i]!;
      const top = crateTop(c, r.level, o.bottom);
      const vy = (top - prev) / ctx.dt;
      ctx.setCollider(`c${i}`, { min: [c[0]!, top - c[4]!, c[1]!], max: [c[2]!, top, c[3]!] });
      // 上に立つ人を運ぶ（上がるときだけ。下がるときは落ちて付いていく）
      for (const p of ctx.players) if (p.onGround && Math.abs(p.pos[1] - prev) < 0.1 && inRect(c, p.pos[0], p.pos[2], 0.15)) p.carry = [p.carry[0], Math.max(p.carry[1], vy), p.carry[2]];
      s.tops[i] = top;
    });
    s.level = r.level;
    ctx.setZone('water', r.level > o.bottom + 0.05 ? { kind: 'water', aabb: { min: [hole[0]!, o.bottom - 0.2, hole[1]!], max: [hole[2]!, r.level, hole[3]!] }, params: { slow: 0.6 } } : null);
    // 泳げない: 頭まで浸かって drown 秒で入口へ
    for (const p of ctx.players) {
      const under = inRect(hole, p.pos[0], p.pos[2]) && p.pos[1] + p.eye < r.level - 0.05;
      const t = under ? (s.under[p.id] ?? 0) + ctx.dt : 0;
      s.under[p.id] = t;
      if (t >= pNum(ctx.spec, 'drown', 1.2)) {
        s.under[p.id] = 0;
        ctx.cue('flood.drown', [p.pos[0], r.level, p.pos[2]]);
        ctx.respawn(p, toOf(ctx));
      }
    }
    if (r.stage === 'rise' && r.left > o.rise - ctx.dt * 1.5) ctx.cue('flood.rise');
    if (r.stage === 'drain' && r.left > o.drain - ctx.dt * 1.5) ctx.cue('flood.drain');
    ctx.output('level', r.level);
    ctx.output('high', r.stage === 'high' ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 巻き戻る部屋
interface RewindState { k: number; anchors: { [id: string]: number[] }; [k: string]: Json }

/** 次に巻き戻るまでの秒（周期 period・位相 phase） */
export const rewindLeft = (t: number, period: number, phase: number): number => period - ((((t + phase) % period) + period) % period);

definePart<RewindState>({
  type: 'rewind',
  outputs: ['pulse', 'left'],
  init: (ctx) => ({ k: Math.floor((0 + pNum(ctx.spec, 'phase', 0)) / pNum(ctx.spec, 'period', 15)), anchors: {} }),
  step(s, ctx) {
    const period = pNum(ctx.spec, 'period', 15), phase = pNum(ctx.spec, 'phase', 0);
    const region = ctx.spec.params.region as { min: number[]; max: number[] };
    const k = Math.floor((ctx.time + phase) / period);
    let pulse = 0;
    for (const p of ctx.players) {
      const inside = inBox(p, region);
      if (!inside) { delete s.anchors[p.id]; continue; }
      if (!s.anchors[p.id]) s.anchors[p.id] = [p.pos[0], p.pos[1], p.pos[2], p.yaw];
    }
    if (k !== s.k) {
      s.k = k;
      pulse = 1;
      ctx.cue('rewind.back');
      for (const p of ctx.players) {
        const a = s.anchors[p.id];
        if (!a) continue;
        ctx.respawn(p, { pos: [a[0]!, a[1]! + 0.02, a[2]!], yaw: a[3]! });
      }
    }
    ctx.output('pulse', pulse);
    ctx.output('left', rewindLeft(ctx.time, period, phase));
  },
});

// ---------------------------------------------------------------- 同じ 1 分のくり返し
interface LoopState { k: number; answered: number; inside: { [id: string]: number }; [k: string]: Json }

/** 時刻 t の、くり返しの中の秒 */
export const loopSec = (t: number, period: number, phase: number): number => (((t + phase) % period) + period) % period;

definePart<LoopState>({
  type: 'loopClock',
  outputs: ['open', 'ringing', 'answered', 'sec'],
  init(ctx) {
    const phone = ctx.spec.params.phone as { min: number[]; max: number[] } | undefined;
    if (phone) ctx.setInteractable({ min: [phone.min[0]!, phone.min[1]!, phone.min[2]!], max: [phone.max[0]!, phone.max[1]!, phone.max[2]!] }, 2.4);
    return { k: Math.floor(pNum(ctx.spec, 'phase', 0) / pNum(ctx.spec, 'period', 40)), answered: 0, inside: {} };
  },
  step(s, ctx) {
    const period = pNum(ctx.spec, 'period', 40), phase = pNum(ctx.spec, 'phase', 0);
    const region = ctx.spec.params.region as { min: number[]; max: number[] };
    const ring = ctx.spec.params.ring as number[], open = ctx.spec.params.open as number[];
    const sec = loopSec(ctx.time, period, phase);
    const ringing = sec >= ring[0]! && sec < ring[1]! && !s.answered;
    if (ringing && ctx.interactedBy()) { s.answered = 1; ctx.cue('loop.answer'); }
    for (const p of ctx.players) s.inside[p.id] = inBox(p, region) ? (s.inside[p.id] ?? 0) + ctx.dt : 0;
    const k = Math.floor((ctx.time + phase) / period);
    if (k !== s.k) {
      s.k = k;
      ctx.cue('loop.reset');
      for (const p of ctx.players) if ((s.inside[p.id] ?? 0) > pNum(ctx.spec, 'grace', 3)) { s.inside[p.id] = 0; ctx.respawn(p, toOf(ctx)); }
    }
    ctx.output('open', sec >= open[0]! && sec < open[1]! ? 1 : 0);
    ctx.output('ringing', ringing ? 1 : 0);
    ctx.output('answered', s.answered);
    ctx.output('sec', sec);
  },
});

// ---------------------------------------------------------------- 閉店のアナウンス
interface ClosingState { t0: number; step: number; [k: string]: Json }

/** 始まってから u 秒の、消えた区間の数（delay 秒の後、速さ speed で区間 seg m ずつ。最後の区間は消えない） */
export const closingStep = (u: number, o: { delay: number; speed: number; seg: number; n: number }): number => (u < o.delay ? 0 : Math.min(o.n - 1, Math.floor(((u - o.delay) * o.speed) / o.seg) + 1));

definePart<ClosingState>({
  type: 'closing',
  outputs: ['step', 'on'],
  init: () => ({ t0: -1, step: 0 }),
  step(s, ctx) {
    const region = ctx.spec.params.region as { min: number[]; max: number[] };
    const start = ctx.spec.params.start as { min: number[]; max: number[] };
    const home = ctx.spec.params.home as { min: number[]; max: number[] };
    const o = { delay: pNum(ctx.spec, 'delay', 3.5), speed: pNum(ctx.spec, 'speed', 2.2), seg: pNum(ctx.spec, 'seg', 2), n: pNum(ctx.spec, 'n', 4) };
    const anyIn = ctx.players.some((p) => inBox(p, region));
    if (s.t0 < 0) {
      if (ctx.players.some((p) => inBox(p, start))) { s.t0 = ctx.time; ctx.cue('closing.announce'); }
    } else if (!anyIn || (s.step >= 1 && ctx.players.some((p) => inBox(p, home)))) {
      // 誰もいなくなった・闇に捕まって入口へ戻された: 照明を戻す
      s.t0 = -1;
      if (s.step > 0) ctx.cue('closing.reset');
    }
    const step = s.t0 < 0 ? 0 : closingStep(ctx.time - s.t0, o);
    if (step > s.step) ctx.cue('closing.off', undefined, { step });
    s.step = step;
    ctx.output('step', step);
    ctx.output('on', s.t0 >= 0 ? 1 : 0);
  },
});
