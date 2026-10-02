/**
 * 壁の装置の部品（回転灯と警報 D09・ブレーカー D10・ダイヤル錠 D11・呼び出しボタン D12）。
 *
 * - alarm: 入力 press が入ると sec 秒鳴る（鳴っている間にもう一度押すと、また sec 秒）。出力 on・off（Cue alarm.start / alarm.stop）
 * - securityDoor: 鋼鉄の引き戸。入力 open が入っている間、または中の側（out の向き）から人が近づいたとき・戸の所に人がいるときに開く。
 *     閉じている間だけ当たり判定。出力 open
 * - breaker: 入力 press のたびに入・切。出力 on（照明）・off（Cue breaker.off / breaker.on）
 * - dialLock: 入力 d0..d2（ダイヤル）のたびに、その桁が 1 つ進む（0..9）。code と同じになったら開く（出力 open。一度開いたら戻らない）
 * - callBell: 入力 press から delay 秒でベルが鳴り始め（Cue bell.ring を 3 回。data.n）、鳴り終わると出力 open（一度入ったら戻らない）
 */
import { aabbCenter, aabbExpand } from '../../../math/aabb.ts';
import { approach } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, pVec } from '../../part.ts';

const ON = 0.5;

definePart<{ left: number; [k: string]: Json | undefined }>({
  type: 'alarm',
  outputs: ['on', 'off'],
  inputs: ['press'],
  init: () => ({ left: 0 }),
  step(s, ctx) {
    if (ctx.input('press') > ON) {
      if (s.left <= 0) ctx.cue('alarm.start');
      s.left = pNum(ctx.spec, 'sec', 15);
    } else if (s.left > 0) {
      s.left -= ctx.dt;
      if (s.left <= 0) ctx.cue('alarm.stop');
    }
    ctx.output('on', s.left > 0 ? 1 : 0);
    ctx.output('off', s.left > 0 ? 0 : 1);
  },
});

definePart<{ k: number; [k: string]: Json | undefined }>({
  type: 'securityDoor',
  outputs: ['open', 'angle'],
  inputs: ['open'],
  init(ctx) {
    ctx.setCollider('panel', pAabb(ctx.spec, 'panel'));
    return { k: 0 };
  },
  step(s, ctx) {
    const panel = pAabb(ctx.spec, 'panel');
    const c = aabbCenter(panel);
    const out = (ctx.spec.params.out as number[] | undefined) ?? [0, 1];
    // 中の側（壁の向こう）から近づいた・戸の所にいる
    const inner = ctx.players.some((p) => {
      const dx = p.pos[0] - c[0], dz = p.pos[2] - c[2];
      return dx * out[0]! + dz * out[1]! > 0.05 && Math.hypot(dx, dz) < 1.8;
    });
    const inDoor = ctx.players.some((p) => playerIn(p, aabbExpand(panel, 0.4)));
    const want = ctx.input('open') > ON || inner || (inDoor && s.k > 0.2);
    const prev = s.k;
    s.k = approach(s.k, want ? 1 : 0, ctx.dt / 1.1);
    if (prev === 0 && s.k > 0) ctx.cue('steel.open', c);
    if (prev > 0 && s.k === 0) ctx.cue('steel.close', c);
    ctx.setCollider('panel', s.k < 0.6 ? panel : null);
    ctx.output('open', s.k >= 0.95 ? 1 : 0);
    // 開き具合（扉 door と同じ名前。区画と開口の見え方が、閉じている間は向こうを描かない）
    ctx.output('angle', s.k);
  },
});

definePart<{ on: number; [k: string]: Json | undefined }>({
  type: 'breaker',
  outputs: ['on', 'off'],
  inputs: ['press'],
  init: () => ({ on: 1 }),
  step(s, ctx) {
    if (ctx.input('press') > ON) {
      s.on = s.on ? 0 : 1;
      ctx.cue(s.on ? 'breaker.on' : 'breaker.off', ctx.spec.params.lever ? pVec(ctx.spec, 'lever') : undefined);
    }
    ctx.output('on', s.on);
    ctx.output('off', s.on ? 0 : 1);
  },
});

definePart<{ digits: number[]; open: number; [k: string]: Json | undefined }>({
  type: 'dialLock',
  outputs: ['open'],
  init: () => ({ digits: [0, 0, 0], open: 0 }),
  step(s, ctx) {
    const code = (ctx.spec.params.code as number[] | undefined) ?? [1, 2, 3];
    const dials = (ctx.spec.params.dials as number[][] | undefined) ?? [];
    for (let i = 0; i < 3; i++) {
      if (s.open || ctx.input(`d${i}`) < ON) continue;
      s.digits[i] = ((s.digits[i] ?? 0) + 1) % 10;
      const d = dials[i];
      ctx.cue('dial.click', d ? [d[0]!, d[1]!, d[2]!] : undefined, { i, digit: s.digits[i]! });
      if (code.every((c, k) => s.digits[k] === c)) { s.open = 1; ctx.cue('dial.open', ctx.spec.params.vault ? pVec(ctx.spec, 'vault') : undefined); }
    }
    ctx.output('open', s.open);
  },
});

definePart<{ t: number; rung: number; open: number; [k: string]: Json | undefined }>({
  type: 'callBell',
  outputs: ['open', 'ringing'],
  inputs: ['press'],
  init: () => ({ t: -1, rung: 0, open: 0 }),
  step(s, ctx) {
    if (ctx.input('press') > ON && s.t < 0 && !s.open) { s.t = 0; s.rung = 0; ctx.cue('bell.call'); }
    if (s.t >= 0) {
      s.t += ctx.dt;
      const delay = pNum(ctx.spec, 'delay', 1.5);
      // 0.9 秒おきに 3 回
      while (s.rung < 3 && s.t >= delay + s.rung * 0.9) { s.rung++; ctx.cue('bell.ring', pVec(ctx.spec, 'at'), { n: s.rung }); }
      if (s.t >= delay + 3 * 0.9 + 0.4) { s.open = 1; s.t = -1; ctx.cue('bell.open', pVec(ctx.spec, 'at')); }
    }
    ctx.output('open', s.open);
    ctx.output('ringing', s.t >= 0 ? 1 : 0);
  },
});
