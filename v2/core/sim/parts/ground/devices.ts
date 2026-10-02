/**
 * 装置の部品（エレベーター D04・自販機 D05 ほか）。
 *
 * - pushButton: 押しボタン（壁の小さな箱）。調べると押した tick だけ pressed、litSec 秒だけ lit（押したと分かる光）。トグルしない。
 *     入力 disable が入っている間は調べられない
 * - liftCabin: エレベーターのかご。入力 call（外の ▼）で arriveSec 秒後に来て戸が開く（中に人がいれば、呼ばなくても来て開く）。
 *     入力 b0..bn（中のボタン）。本当の階のボタンを押すと、引き戸が閉まり（戸の所に人がいれば閉めない）、
 *     rideSec 秒動いて（Cue lift.ride。表示の数字が流れる）、Cue floor.goto でフロアを移る（行き先は buttons[i].to。無ければ 1 つ下）。
 *     かごに誰もいなければ動かない。移らなかった（試験・実験室）ときは、しばらくで戸が開く。誰もいなければ idleSec 秒で閉まって行ってしまう。
 *     存在しない階のボタン（buttons[i].fake）を order の順に押すと secret（一度入ったら戻らない）。違う順は最初から（Cue lift.buzz）。
 *     出力 open（戸が開いている）・riding・secret・lit（かごの照明。動いている間は揺れる）・shown（表示の階の番号の位置 0..1）
 * - vending: 自販機。入力 b0..b2（色のボタン）・slot（取り出し口）。押すと缶が落ちる（Cue vend.drop。data.color）、部屋の照明がその色になる
 *     （出力 c0 = 色が無い / c1..c3）。同じボタンを keyAfter 回続けて押すと、缶の代わりに鍵（出力 key）。取り出し口を調べると鍵を取る（taken）
 */
import { aabbCenter } from '../../../math/aabb.ts';
import { approach } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn } from '../../part.ts';

const ON = 0.5;

definePart<{ lit: number; off: number; [k: string]: Json | undefined }>({
  type: 'pushButton',
  outputs: ['pressed', 'lit'],
  inputs: ['disable'],
  init(ctx) {
    const b = pAabb(ctx.spec, 'box');
    ctx.setInteractable(b, pNum(ctx.spec, 'range', 2.2));
    return { lit: 0, off: 0 };
  },
  step(s, ctx) {
    // 使えなくなった（金庫が開いた後のダイヤル。後ろの扉を調べられるように）
    const off = ctx.input('disable') > ON ? 1 : 0;
    if (off !== s.off) { s.off = off; ctx.setInteractable(off ? null : pAabb(ctx.spec, 'box'), pNum(ctx.spec, 'range', 2.2)); }
    const pressed = !s.off && !!ctx.interactedBy();
    if (pressed) { s.lit = pNum(ctx.spec, 'litSec', 0.6); ctx.cue('push.press', aabbCenter(pAabb(ctx.spec, 'box'))); }
    else s.lit = Math.max(0, s.lit - ctx.dt);
    ctx.output('pressed', pressed ? 1 : 0);
    ctx.output('lit', s.lit > 0 || pressed ? 1 : 0);
  },
});

// ---------------------------------------------------------------- エレベーター

interface CabinState { phase: number; t: number; door: number; target: number; seq: number; secret: number; idle: number; [k: string]: Json | undefined }
interface CabinButton { label: string; to: string | null; cur: boolean; fake: boolean }

/** 段階: 0 = 来ていない（戸が閉まっている）/ 1 = 呼ばれて来る途中 / 2 = 戸が開いている / 3 = 戸が閉まる / 4 = 動いている / 5 = 着いた */
definePart<CabinState>({
  type: 'liftCabin',
  outputs: ['open', 'riding', 'secret', 'lit', 'shown', 'phase'],
  inputs: ['call'],
  init: () => ({ phase: 0, t: 0, door: 0, target: -1, seq: 0, secret: 0, idle: 0 }),
  step(s, ctx) {
    const buttons = (ctx.spec.params.buttons as unknown as CabinButton[] | undefined) ?? [];
    const order = (ctx.spec.params.order as number[] | undefined) ?? [];
    const gap = pAabb(ctx.spec, 'gap'), panel = pAabb(ctx.spec, 'panel'), inside = pAabb(ctx.spec, 'inside');
    const center = aabbCenter(inside);
    const anyoneIn = ctx.players.some((p) => playerIn(p, inside));
    const blocked = ctx.players.some((p) => playerIn(p, gap));
    const go = (phase: number): void => { s.phase = phase; s.t = 0; };
    // 呼ぶ（外の ▼）・中に人がいるのに戸が閉まっている（来ていない）: 来て開く
    if (s.phase === 0 && (ctx.input('call') > ON || anyoneIn)) { go(1); ctx.cue('lift.call', center); }
    let pressed = -1;
    for (let i = 0; i < buttons.length; i++) if (ctx.input(`b${i}`) > ON) pressed = i;
    if (pressed >= 0 && anyoneIn) {
      const b = buttons[pressed]!;
      if (b.fake) {
        // 存在しない階: 傷の数の順に押すと奥の壁が開く
        if (order[s.seq] === pressed) {
          s.seq++;
          ctx.cue('lift.ding', center, { n: s.seq });
          if (s.seq >= order.length && !s.secret) { s.secret = 1; ctx.cue('lift.ghost', center); }
        } else { s.seq = order[0] === pressed ? 1 : 0; ctx.cue('lift.buzz', center); }
      } else {
        s.seq = 0;
        if (!b.cur && s.phase === 2) { go(3); s.target = pressed; ctx.cue('lift.close', center); }
        else if (b.cur) ctx.cue('lift.ding', center, { n: 0 });
      }
    }
    s.t += ctx.dt;
    if (s.phase === 1) {
      s.door = 0;
      if (s.t >= pNum(ctx.spec, 'arriveSec', 2.5)) { go(2); s.idle = 0; ctx.cue('lift.arrive', center); }
    } else if (s.phase === 2) {
      s.door = approach(s.door, 1, ctx.dt / 1.0);
      // 誰もいなければ、しばらくで戸が閉まって行ってしまう
      s.idle = anyoneIn || blocked ? 0 : s.idle + ctx.dt;
      if (s.idle >= pNum(ctx.spec, 'idleSec', 12)) { go(3); s.target = -1; ctx.cue('lift.close', center); }
    } else if (s.phase === 3) {
      // 戸が閉まる（戸の所に人がいれば開け直す）
      if (blocked) { s.door = approach(s.door, 1, ctx.dt / 0.5); s.t = 0; }
      else s.door = approach(s.door, 0, ctx.dt / 1.2);
      if (s.door <= 0 && s.t > 1.2) {
        if (s.target >= 0 && anyoneIn) { go(4); ctx.cue('lift.ride', center); }
        else go(anyoneIn ? 1 : 0);
      }
    } else if (s.phase === 4) {
      s.door = 0;
      if (s.t >= pNum(ctx.spec, 'rideSec', 5)) {
        const b = buttons[s.target];
        ctx.cue('lift.arrive', center);
        ctx.cue('floor.goto', center, { kind: 'elevator', ...(b?.to ? { to: b.to } : {}) });
        go(5);
      }
    } else if (s.phase === 5) {
      // 着いた（フロアを移らなかったときは、戸が開く）
      if (s.t > 1.5) { go(2); s.idle = 0; s.target = -1; }
    } else s.door = approach(s.door, 0, ctx.dt / 1.2);
    ctx.setCollider('panel', s.door < 0.4 ? panel : null);
    ctx.output('shown', s.phase === 4 ? Math.min(1, s.t / pNum(ctx.spec, 'rideSec', 5)) : s.phase === 5 ? 1 : 0);
    ctx.output('open', s.door >= 0.9 ? 1 : 0);
    ctx.output('riding', s.phase === 4 ? 1 : 0);
    ctx.output('secret', s.secret);
    ctx.output('phase', s.phase);
    // かごの照明: 動いている間は細かく揺れる（部品の乱数）
    ctx.output('lit', s.phase === 4 ? (ctx.random() < 0.08 ? 0 : 1) : 1);
  },
});

// ---------------------------------------------------------------- 自販機

interface VendState { color: number; last: number; same: number; key: number; taken: number; [k: string]: Json | undefined }

definePart<VendState>({
  type: 'vending',
  outputs: ['c0', 'c1', 'c2', 'c3', 'key', 'taken', 'drops'],
  init: () => ({ color: 0, last: -1, same: 0, key: 0, taken: 0, drops: 0 }),
  step(s, ctx) {
    const slot = (ctx.spec.params.slot as number[] | undefined) ?? [0, 0, 0];
    const at: [number, number, number] = [slot[0]!, slot[1]!, slot[2]!];
    for (let i = 0; i < 3; i++) {
      if (ctx.input(`b${i}`) < ON) continue;
      s.same = s.last === i ? s.same + 1 : 1;
      s.last = i;
      if (!s.taken && !s.key && s.same >= pNum(ctx.spec, 'keyAfter', 5)) {
        // 鍵が落ちてくる（缶の代わり）
        s.key = 1;
        ctx.cue('vend.key', at);
      } else {
        s.color = i + 1;
        s.drops = Number(s.drops ?? 0) + 1;
        ctx.cue('vend.drop', at, { color: i + 1 });
      }
    }
    if (ctx.input('slot') > ON && s.key && !s.taken) { s.taken = 1; s.key = 0; ctx.cue('vend.take', at); }
    for (let k = 0; k <= 3; k++) ctx.output(`c${k}`, s.color === k ? 1 : 0);
    ctx.output('key', s.key);
    ctx.output('taken', s.taken);
    ctx.output('drops', Number(s.drops ?? 0));
  },
});
