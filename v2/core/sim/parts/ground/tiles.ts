/**
 * 床の升目の部品（踏むと鳴る床 G09・踏まない区画 D03・順番の区画 D02）。床は普通の床のまま（踏んでも落ちない）。
 *
 * - chimeFloor: 升目ごとに音の高さが違う。部屋に入ると、升目が順に光って鳴り、節を見せる（demoSec ごと）。同じ順に踏むと solved。
 *     違う升目を踏むと最初から（その升目が節の最初なら 1 つ目として数える）
 * - avoidFloor: 印（start）に立つと「始まり」。そのまま悪い升目（bad）を 1 つも踏まずに目当て（goal）まで行くと done。
 *     悪い升目を踏むと失敗（印に戻ってやり直し）
 * - visitOrder: 場所（stations）を決まった順（order）に訪れる（上で visitSec 秒立ち止まる）と done。違う場所で立ち止まると最初から
 * 足元の升目は、体の真ん中（足元）が升目の中（縁から 0.05 m 内側）にあるかで決める
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, type PartContext } from '../../part.ts';
import type { PlayerState } from '../../types.ts';

const rectsOf = (ctx: PartContext, key: string): number[][] => (Array.isArray(ctx.spec.params[key]) ? (ctx.spec.params[key] as number[][]) : []);

/** 足元の升目の番号（どれでもなければ -1） */
function tileUnder(tiles: number[][], p: PlayerState, y: number): number {
  if (p.pos[1] < y - 0.3 || p.pos[1] > y + 0.6) return -1;
  for (let i = 0; i < tiles.length; i++) {
    const r = tiles[i]!;
    if (p.pos[0] > r[0]! + 0.05 && p.pos[0] < r[2]! - 0.05 && p.pos[2] > r[1]! + 0.05 && p.pos[2] < r[3]! - 0.05) return i;
  }
  return -1;
}

const tileCenter = (r: number[], y: number): Vec3 => [(r[0]! + r[2]!) / 2, y, (r[1]! + r[3]!) / 2];

// ---------------------------------------------------------------- 踏むと鳴る床
interface ChimeState { cur: number; prog: number; solved: number; demoT: number; demoI: number; lit: number; [k: string]: Json | undefined }

definePart<ChimeState>({
  type: 'chimeFloor',
  outputs: ['solved', 'progress', 'wrong'],
  init: () => ({ cur: -1, prog: 0, solved: 0, demoT: 1.5, demoI: -1, lit: -1 }),
  step(s, ctx) {
    const tiles = rectsOf(ctx, 'tiles');
    const seq = (ctx.spec.params.seq as number[] | undefined) ?? [];
    const y = pNum(ctx.spec, 'y', 0);
    const room = pAabb(ctx.spec, 'room');
    const inRoom = ctx.players.some((p) => playerIn(p, room));
    let wrong = 0;
    // 踏んだ升目（入った瞬間）
    const p0 = ctx.players[0];
    const t = p0 ? tileUnder(tiles, p0, y) : -1;
    if (t !== s.cur) {
      s.cur = t;
      if (t >= 0 && !s.solved) {
        if (t === seq[s.prog]) {
          s.prog++;
          ctx.cue('chime.step', tileCenter(tiles[t]!, y), { tile: t, ok: true, n: s.prog });
          if (s.prog >= seq.length) { s.solved = 1; ctx.cue('chime.solved', aabbCenter(room)); }
        } else {
          if (s.prog > 0) wrong = 1;
          s.prog = t === seq[0] ? 1 : 0;
          ctx.cue('chime.step', tileCenter(tiles[t]!, y), { tile: t, ok: false, n: s.prog });
        }
      } else if (t >= 0) ctx.cue('chime.step', tileCenter(tiles[t]!, y), { tile: t, ok: true, n: 0 });
    }
    // 見せる: 部屋にいて、まだ解けていなくて、踏み始めていない間。節を順に光らせて鳴らし、少し休む
    s.lit = -1;
    if (inRoom && !s.solved && s.prog === 0) {
      s.demoT -= ctx.dt;
      if (s.demoT <= 0) {
        s.demoI++;
        if (s.demoI >= seq.length) { s.demoI = -1; s.demoT = pNum(ctx.spec, 'demoSec', 6); }
        else { s.demoT = pNum(ctx.spec, 'noteSec', 0.7); ctx.cue('chime.demo', tileCenter(tiles[seq[s.demoI]!]!, y), { tile: seq[s.demoI]! }); }
      }
      if (s.demoI >= 0) s.lit = seq[s.demoI]!;
    } else if (!inRoom) { s.demoI = -1; s.demoT = 1.0; }
    ctx.output('solved', s.solved);
    ctx.output('progress', seq.length ? s.prog / seq.length : 0);
    ctx.output('wrong', wrong);
  },
});

// ---------------------------------------------------------------- 踏まない区画
interface AvoidState { cur: number; armed: number; done: number; fails: number; [k: string]: Json | undefined }

definePart<AvoidState>({
  type: 'avoidFloor',
  outputs: ['done', 'armed', 'failed'],
  init: () => ({ cur: -1, armed: 0, done: 0, fails: 0 }),
  step(s, ctx) {
    const tiles = rectsOf(ctx, 'tiles');
    const bad = new Set((ctx.spec.params.bad as number[] | undefined) ?? []);
    const start = pNum(ctx.spec, 'start', 0), goal = pNum(ctx.spec, 'goal', 0);
    const y = pNum(ctx.spec, 'y', 0);
    const p0 = ctx.players[0];
    const t = p0 ? tileUnder(tiles, p0, y) : -1;
    let failed = 0;
    if (t !== s.cur) {
      s.cur = t;
      if (!s.done && t >= 0) {
        if (t === start) { if (!s.armed) ctx.cue('avoid.arm', tileCenter(tiles[t]!, y)); s.armed = 1; }
        else if (s.armed && bad.has(t)) { s.armed = 0; s.fails++; failed = 1; ctx.cue('avoid.fail', tileCenter(tiles[t]!, y), { tile: t }); }
        else if (s.armed && t === goal) { s.done = 1; s.armed = 0; ctx.cue('avoid.done', tileCenter(tiles[t]!, y)); }
        else if (s.armed) ctx.cue('avoid.step', tileCenter(tiles[t]!, y), { tile: t });
      }
    }
    ctx.output('done', s.done);
    ctx.output('armed', s.armed);
    ctx.output('failed', failed);
  },
});

// ---------------------------------------------------------------- 順番の区画
interface VisitState { inside: number; prog: number; done: number; t: number; counted: number; [k: string]: Json | undefined }

definePart<VisitState>({
  type: 'visitOrder',
  outputs: ['done', 'progress', 'wrong'],
  init: () => ({ inside: -1, prog: 0, done: 0, t: 0, counted: 0 }),
  step(s, ctx) {
    const st = (ctx.spec.params.stations as Json[] | undefined) ?? [];
    const order = (ctx.spec.params.order as number[] | undefined) ?? [];
    const boxes: AABB[] = st.map((b) => { const o = b as { min: number[]; max: number[] }; return { min: [o.min[0]!, o.min[1]!, o.min[2]!], max: [o.max[0]!, o.max[1]!, o.max[2]!] }; });
    const p0 = ctx.players[0];
    const at = p0 ? boxes.findIndex((b) => playerIn(p0, b)) : -1;
    let wrong = 0;
    // 訪れた = 印の上で visitSec 秒立ち止まった（通り過ぎるだけでは数えない）
    if (at !== s.inside) { s.inside = at; s.t = 0; s.counted = 0; }
    if (at >= 0 && p0 && p0.moveRank === 'still') s.t += ctx.dt;
    if (at >= 0 && !s.counted && s.t >= pNum(ctx.spec, 'visitSec', 0.5)) {
      s.counted = 1;
      if (!s.done) {
        if (at === order[s.prog]) {
          s.prog++;
          ctx.cue('visit.ok', aabbCenter(boxes[at]!), { station: at, n: s.prog });
          if (s.prog >= order.length) { s.done = 1; ctx.cue('visit.done', aabbCenter(boxes[at]!)); }
        } else if (s.prog > 0 && order.slice(0, s.prog).includes(at)) {
          // もう訪れた場所に戻っただけなら数え直さない
        } else {
          if (s.prog > 0) { wrong = 1; ctx.cue('visit.wrong', aabbCenter(boxes[at]!), { station: at }); }
          s.prog = at === order[0] ? 1 : 0;
          if (s.prog) ctx.cue('visit.ok', aabbCenter(boxes[at]!), { station: at, n: 1 });
        }
      }
    }
    ctx.output('done', s.done);
    ctx.output('progress', order.length ? s.prog / order.length : 0);
    ctx.output('wrong', wrong);
  },
});
