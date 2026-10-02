/**
 * 音の部品（段階 4・担当 sense）。音そのものはクライアントが鳴らす（cue）。シミュレーションは「いつ・どこで鳴るか」と、音に関わる操作の判定だけ。
 * - chime: 調べると鳴る鐘（box）。出力 rung（鳴らした tick だけ 1）。cue 'chime.ring'（note = 音の高さの番号）
 * - melody: 区画 region に人がいる間、period 秒ごとに音の並び（notes の番号を order の順に interval 秒おき）を鳴らす。cue 'melody.note'
 * - noiseGate: 声（マイク。無ければ足音・着地から作る疑似の音量）の大きさで開く。mode 'loud' = 区画 zone で level 以上の音を出すと開く /
 *     'quiet' = 区画 zone で動かず level 以下の静けさを sec 秒保つと開く。開いたら開いたまま。出力 open・level（今の音量）
 * - ghostSteps: もう一人の足音。人の 1.2 秒前の位置をたどって歩き、歩幅ごとに cue 'ghost.step'。人がしゃがんで（音を立てずに）sec 秒歩くと、
 *     足音だけが離れて壁の点 target へ歩いて行き、壁を叩く（cue 'ghost.knock'）。出力 knocked（入ったまま）
 * - paChase: 館内放送が、スピーカー speakers のうち 1 つから period 秒ごとに鳴る。そのスピーカーに near m まで近づくと止み、次のスピーカーから鳴る。
 *     最後のスピーカーまで追うと found（入ったまま）。cue 'pa.voice'
 */
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, pStr } from '../../part.ts';
import type { PlayerState } from '../../types.ts';

definePart<{ n: number }>({
  type: 'chime',
  outputs: ['rung'],
  init(ctx) {
    ctx.setInteractable(pAabb(ctx.spec, 'box'), 2.6);
    return { n: 0 };
  },
  step(s, ctx) {
    const who = ctx.interactedBy();
    if (who) {
      s.n++;
      const b = pAabb(ctx.spec, 'box');
      ctx.cue('chime.ring', [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2], { note: pNum(ctx.spec, 'note', 0) });
    }
    ctx.output('rung', who ? 1 : 0);
  },
});

definePart<{ t: number; next: number }>({
  type: 'melody',
  outputs: ['playing'],
  init: () => ({ t: 0, next: 0 }),
  step(s, ctx) {
    const region = pAabb(ctx.spec, 'region');
    const order = (ctx.spec.params.order as number[] | undefined) ?? [];
    const pos = (ctx.spec.params.positions as number[][] | undefined) ?? [];
    const interval = pNum(ctx.spec, 'interval', 0.7), period = pNum(ctx.spec, 'period', 12);
    const inside = ctx.players.some((p) => playerIn(p, region));
    if (!inside) { s.t = 0; s.next = 0; ctx.output('playing', 0); return; }
    // 入ってから 1 秒後に 1 回目。あとは period 秒ごと
    const start = 1.0;
    s.t += ctx.dt;
    const u = s.t - start;
    if (u >= 0) {
      const cycle = Math.floor(u / period), within = u - cycle * period;
      const k = Math.floor(within / interval + 1e-9);
      // ここまでに鳴っているはずの音の数（周期ごとに order の数まで）
      const want = cycle * order.length + Math.min(order.length, k + 1);
      while (s.next < want) {
        const i = s.next % order.length;
        const note = order[i]!;
        const p = pos[note] ?? [0, 0, 0];
        ctx.cue('melody.note', [p[0]!, p[1]!, p[2]!], { note, i });
        s.next++;
      }
      ctx.output('playing', within < order.length * interval ? 1 : 0);
    }
  },
});

// ---------------------------------------------------------------- 音で開く
interface GateState { level: number; prevGround: number; prevVy: number; t: number; open: number; [k: string]: Json | undefined }

/** 疑似の音量（マイクの代わり）: 歩く 0.35・走る 0.7・跳ぶ 0.5・着地 1.0（v1 LoudnessSource.movementLoudness と同じ）。毎秒 1.5 ずつ下がる */
function movementLevel(s: GateState, p: PlayerState, dt: number): number {
  let level = Math.max(0, s.level - dt * 1.5);
  const base = p.moveRank === 'dash' ? 0.7 : p.moveRank === 'walk' ? (p.crouching ? 0.12 : 0.35) : 0;
  if (!p.onGround && p.vel[1] > 1.0) level = Math.max(level, 0.5);
  if (p.onGround && !s.prevGround && s.prevVy < -2.0) level = 1;
  level = Math.max(level, base);
  s.prevGround = p.onGround ? 1 : 0;
  s.prevVy = p.vel[1];
  return level;
}

definePart<GateState>({
  type: 'noiseGate',
  outputs: ['open', 'level'],
  init: () => ({ level: 0, prevGround: 1, prevVy: 0, t: 0, open: 0 }),
  step(s, ctx) {
    const zone = pAabb(ctx.spec, 'zone');
    const mode = pStr(ctx.spec, 'mode', 'loud');
    const p = ctx.players.find((x) => playerIn(x, zone));
    const pseudo = ctx.players[0] ? movementLevel(s, ctx.players[0], ctx.dt) : 0;
    // マイクがあればマイクの音量（大きい方。マイクで黙っていても、走れば足音で音は出る）
    const mic = ctx.players[0]?.voice ?? -1;
    s.level = mic >= 0 ? Math.max(mic, pseudo) : pseudo;
    if (!s.open && p) {
      if (mode === 'loud') {
        if (s.level >= pNum(ctx.spec, 'level', 0.55)) { s.open = 1; ctx.cue('gate.open', undefined, { mode }); }
      } else {
        const quiet = s.level <= pNum(ctx.spec, 'level', 0.08) && p.moveRank === 'still';
        s.t = quiet ? s.t + ctx.dt : 0;
        if (s.t >= pNum(ctx.spec, 'sec', 3)) { s.open = 1; ctx.cue('gate.open', undefined, { mode }); }
      }
    } else if (!p) s.t = 0;
    ctx.output('open', s.open);
    ctx.output('level', s.level);
  },
});

// ---------------------------------------------------------------- もう一人の足音
interface GhostState { trail: number[]; pos: number[]; acc: number; sneak: number; gone: number; knocks: number; t: number; [k: string]: Json | undefined }

definePart<GhostState>({
  type: 'ghostSteps',
  outputs: ['knocked', 'gone'],
  init: () => ({ trail: [], pos: [0, 0, 0], acc: 0, sneak: 0, gone: 0, knocks: 0, t: 0 }),
  step(s, ctx) {
    const region = pAabb(ctx.spec, 'region');
    const p = ctx.players.find((x) => playerIn(x, region));
    const lag = Math.round(pNum(ctx.spec, 'lagSec', 1.2) / ctx.dt);
    const stride = 0.75;
    const prev = s.pos as number[];
    if (!s.gone) {
      if (!p) { s.trail = []; s.sneak = 0; ctx.output('knocked', s.knocks >= 3 ? 1 : 0); ctx.output('gone', 0); return; }
      // 人の位置の記録（lag tick 分）。足音は記録の一番古い位置
      s.trail.push(p.pos[0], p.pos[1], p.pos[2]);
      while (s.trail.length > lag * 3) s.trail.splice(0, 3);
      if (s.trail.length >= lag * 3) s.pos = s.trail.slice(0, 3);
      // しゃがんで歩く（音を立てずに）時間
      s.sneak = p.crouching && p.moveRank !== 'still' ? s.sneak + ctx.dt : Math.max(0, s.sneak - ctx.dt * 0.5);
      if (s.sneak >= pNum(ctx.spec, 'sneakSec', 3) && ctx.spec.params.target) { s.gone = 1; s.t = 0; ctx.cue('ghost.leave', s.pos as Vec3); }
    } else if (s.knocks < 3) {
      // 足音だけが壁の点へ歩いて行く
      const t = ctx.spec.params.target as number[];
      const dx = t[0]! - prev[0]!, dz = t[2]! - prev[2]!;
      const d = Math.hypot(dx, dz);
      const v = 1.1 * ctx.dt;
      if (d > 0.4) s.pos = [prev[0]! + (dx / d) * v, prev[1]!, prev[2]! + (dz / d) * v];
      else {
        s.t += ctx.dt;
        if (s.t >= 1.0 + s.knocks * 1.2) { s.knocks++; ctx.cue('ghost.knock', [t[0]!, t[1]! + 1.2, t[2]!]); }
      }
    }
    const now = s.pos as number[];
    if (prev.length === 3 && now.length === 3) {
      const m = Math.hypot(now[0]! - prev[0]!, now[2]! - prev[2]!);
      if (m < 1.5) s.acc += m;
      if (s.acc >= stride) { s.acc -= stride; ctx.cue('ghost.step', [now[0]!, now[1]!, now[2]!], { crouch: !!s.gone || (p?.crouching ?? false) }); }
    }
    ctx.output('knocked', s.knocks >= 3 ? 1 : 0);
    ctx.output('gone', s.gone);
  },
});

// ---------------------------------------------------------------- 館内放送を追う
definePart<{ idx: number; t: number; found: number; wait: number }>({
  type: 'paChase',
  outputs: ['found', 'idx'],
  init: () => ({ idx: 0, t: 0, found: 0, wait: 0 }),
  step(s, ctx) {
    const sp = (ctx.spec.params.speakers as number[][] | undefined) ?? [];
    const region = pAabb(ctx.spec, 'region');
    const near = pNum(ctx.spec, 'near', 2.2), period = pNum(ctx.spec, 'period', 6);
    const inside = ctx.players.filter((p) => playerIn(p, region));
    if (!inside.length || !sp.length) { ctx.output('found', s.found); ctx.output('idx', s.idx); return; }
    const cur = sp[Math.min(s.idx, sp.length - 1)]!;
    if (s.wait > 0) s.wait -= ctx.dt;
    else {
      s.t -= ctx.dt;
      if (s.t <= 0) { s.t = period; ctx.cue('pa.voice', [cur[0]!, cur[1]!, cur[2]!], { idx: s.idx }); }
    }
    // 近づくと止み、次のスピーカーへ（最後まで追うと見つかる）
    if (inside.some((p) => Math.hypot(p.pos[0] - cur[0]!, p.pos[2] - cur[2]!) < near) && s.wait <= 0) {
      if (s.idx >= sp.length - 1) { if (!s.found) { s.found = 1; ctx.cue('pa.found', [cur[0]!, cur[1]!, cur[2]!]); } }
      else { s.idx++; s.wait = 1.0; s.t = 0; ctx.cue('pa.move', [cur[0]!, cur[1]!, cur[2]!]); }
    }
    ctx.output('found', s.found);
    ctx.output('idx', s.idx);
  },
});
