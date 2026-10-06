/**
 * 判断の部品（Logic）。入力は別の部品の出力（0..1）。0.5 より大きければ「入」とみなす。
 * - and / or / not: 配線された入力（a, b, c, d …）の論理
 * - latch: set で入り、reset で切れる（reset が無ければ入ったまま）
 * - timer: 入力が onDelay 秒続いたら入、切れて offDelay 秒で切
 * - pulse: 入力が入った瞬間だけ 1 tick 入
 * - toggle: 入力が入るたびに入切を反転
 * - threshold: 入力が min〜max の間なら入
 * - sequence: s1, s2 … の順に入ったら done（順番を間違えたら最初から）
 * - counter: 入力が入った回数が target に達したら done
 * - constant: 常に value
 */
import { definePart, pBool, pNum, type PartContext } from '../part.ts';

const ON = 0.5;
const PORTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const wiredPorts = (ctx: PartContext): string[] => PORTS.filter((p) => ctx.wired(p));

definePart({
  type: 'and',
  outputs: ['out'],
  inputs: PORTS,
  init: () => ({}),
  step(_s, ctx) {
    const ports = wiredPorts(ctx);
    ctx.output('out', ports.length > 0 && ports.every((p) => ctx.input(p) > ON) ? 1 : 0);
  },
});

definePart({
  type: 'or',
  outputs: ['out'],
  inputs: PORTS,
  init: () => ({}),
  step(_s, ctx) {
    ctx.output('out', wiredPorts(ctx).some((p) => ctx.input(p) > ON) ? 1 : 0);
  },
});

definePart({
  type: 'not',
  outputs: ['out'],
  inputs: ['in'],
  init: () => ({}),
  step(_s, ctx) {
    ctx.output('out', ctx.input('in') > ON ? 0 : 1);
  },
});

definePart<{ on: number }>({
  type: 'latch',
  outputs: ['out'],
  inputs: ['set', 'reset'],
  init: (ctx) => ({ on: pBool(ctx.spec, 'initial', false) ? 1 : 0 }),
  step(s, ctx) {
    if (ctx.input('set') > ON) s.on = 1;
    if (ctx.wired('reset') && ctx.input('reset') > ON) s.on = 0;
    ctx.output('out', s.on);
  },
});

definePart<{ t: number; on: number }>({
  type: 'timer',
  outputs: ['out', 'progress'],
  inputs: ['in'],
  init: () => ({ t: 0, on: 0 }),
  step(s, ctx) {
    const onDelay = pNum(ctx.spec, 'onDelay', 0);
    const offDelay = pNum(ctx.spec, 'offDelay', 0);
    const want = ctx.input('in') > ON;
    if (want === (s.on === 1)) s.t = 0;
    else {
      s.t += ctx.dt;
      if (s.t >= (want ? onDelay : offDelay)) { s.on = want ? 1 : 0; s.t = 0; }
    }
    ctx.output('out', s.on);
    ctx.output('progress', want && !s.on && onDelay > 0 ? Math.min(1, s.t / onDelay) : s.on);
  },
});

definePart<{ prev: number }>({
  type: 'pulse',
  outputs: ['out'],
  inputs: ['in'],
  init: () => ({ prev: 0 }),
  step(s, ctx) {
    const v = ctx.input('in') > ON ? 1 : 0;
    ctx.output('out', v && !s.prev ? 1 : 0);
    s.prev = v;
  },
});

definePart<{ prev: number; on: number }>({
  type: 'toggle',
  outputs: ['out'],
  inputs: ['in'],
  init: (ctx) => ({ prev: 0, on: pBool(ctx.spec, 'initial', false) ? 1 : 0 }),
  step(s, ctx) {
    const v = ctx.input('in') > ON ? 1 : 0;
    if (v && !s.prev) s.on = s.on ? 0 : 1;
    s.prev = v;
    ctx.output('out', s.on);
  },
});

definePart({
  type: 'threshold',
  outputs: ['out'],
  inputs: ['in'],
  init: () => ({}),
  step(_s, ctx) {
    const v = ctx.input('in');
    ctx.output('out', v >= pNum(ctx.spec, 'min', -Infinity) && v <= pNum(ctx.spec, 'max', Infinity) ? 1 : 0);
  },
});

/** 順番: s1 → s2 → … の立ち上がり。間違えたら最初から（resetOnWrong=false なら無視） */
definePart<{ step: number; prev: number[]; done: number }>({
  type: 'sequence',
  outputs: ['done', 'step', 'wrong'],
  inputs: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
  init: (ctx) => ({ step: 0, prev: new Array(pNum(ctx.spec, 'count', 3)).fill(0), done: 0 }),
  step(s, ctx) {
    const n = s.prev.length;
    let wrong = 0;
    for (let i = 0; i < n; i++) {
      const v = ctx.input(`s${i + 1}`) > ON ? 1 : 0;
      if (v && !s.prev[i] && !s.done) {
        if (i === s.step) s.step++;
        else if (pBool(ctx.spec, 'resetOnWrong', true)) { s.step = i === 0 ? 1 : 0; wrong = 1; }
      }
      s.prev[i] = v;
    }
    if (s.step >= n) s.done = 1;
    ctx.output('done', s.done);
    ctx.output('step', s.step);
    ctx.output('wrong', wrong);
  },
});

definePart<{ count: number; prev: number }>({
  type: 'counter',
  outputs: ['done', 'count'],
  inputs: ['in', 'reset'],
  init: () => ({ count: 0, prev: 0 }),
  step(s, ctx) {
    const v = ctx.input('in') > ON ? 1 : 0;
    if (v && !s.prev) s.count++;
    s.prev = v;
    if (ctx.wired('reset') && ctx.input('reset') > ON) s.count = 0;
    ctx.output('count', s.count);
    ctx.output('done', s.count >= pNum(ctx.spec, 'target', 1) ? 1 : 0);
  },
});

definePart({
  type: 'constant',
  outputs: ['out'],
  init: () => ({}),
  step(_s, ctx) {
    ctx.output('out', pNum(ctx.spec, 'value', 1));
  },
});
