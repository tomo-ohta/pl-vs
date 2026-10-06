/**
 * パズルの部品（4.7 のパズル PZ01〜PZ12・ミニゲームの一部）。どれも調べる（E / タップ）・歩く・持てる物を置く、だけで遊べる。
 *
 * - dial: 調べるたびに値が 1 進む（0..n-1 を回る）。数字錠の 1 桁・時計の針。出力 value・pressed
 * - matchBits: 入力 a〜h（0.5 より大きければ 1）が params.want（[1, 0, 1] …）と同じなら out
 * - bell: 調べると鳴る（Cue carry.bell・data.freq）。出力 pressed（鳴らした tick だけ）・count
 * - beamGrid: 床の升目を進む光の筋。持てる物の鏡（tag mirror）に当たると向きを変える（鏡の向き = 置いた人の向き。45° 刻み）。
 *     柱（params.blocks の升目）で止まる。params.target の升目に入ると hit。状態 path（描く折れ線）
 * - marbleModel: 机の上の迷路の模型と玉。机の 4 辺のどれかに立つと模型がそちらへ傾き、玉は壁に当たるまで転がる。
 *     玉が穴（params.hole）に落ちると done（入ったまま）。玉は少しして始めの升目へ戻る
 * - stepPattern: 床の升目（params.origin・cell・nx・nz）。params.pattern の順に升目を踏むと進み、違う升目を踏むと最初から。
 *     出力 progress（踏めた数）・done（入ったまま）・step（踏んだ tick だけ升目の番号 + 1）。params.notes があれば踏むたびに音（Cue carry.note）
 * - carryDecor: 何もしない部品（手がかりの絵・色の札・影絵の画面など、描画だけ。client/views/carry）
 */
import { aabbExpand } from '../../../math/aabb.ts';
import { definePart, pAabb, pNum, pStr } from '../../part.ts';
import { carryIndex, HELD, tagMatch, type ItemState } from './common.ts';
import { itemCfg } from './item.ts';

const PORTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

// ---------------------------------------------------------------- 回す（数字錠・時計）
definePart<{ v: number }>({
  type: 'dial',
  outputs: ['value', 'pressed'],
  init(ctx) {
    ctx.setInteractable(pAabb(ctx.spec, 'box'), pNum(ctx.spec, 'range', 2.4));
    return { v: Math.round(pNum(ctx.spec, 'start', 0)) };
  },
  step(s, ctx) {
    const n = Math.max(1, Math.round(pNum(ctx.spec, 'n', 10)));
    const who = ctx.interactedBy();
    if (who) {
      s.v = (s.v + 1) % n;
      const b = pAabb(ctx.spec, 'box');
      ctx.cue('carry.dial', [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2], { value: s.v, mode: pStr(ctx.spec, 'mode', 'digit') });
    }
    ctx.output('value', s.v);
    ctx.output('pressed', who ? 1 : 0);
  },
});

definePart({
  type: 'matchBits',
  outputs: ['out'],
  inputs: PORTS,
  init: () => ({}),
  step(_s, ctx) {
    const want = Array.isArray(ctx.spec.params.want) ? (ctx.spec.params.want as number[]) : [];
    const ok = want.length > 0 && want.every((w, i) => (ctx.input(PORTS[i]!) > 0.5 ? 1 : 0) === (w ? 1 : 0));
    ctx.output('out', ok ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 鐘
definePart<{ count: number }>({
  type: 'bell',
  outputs: ['pressed', 'count'],
  init(ctx) {
    ctx.setInteractable(aabbExpand(pAabb(ctx.spec, 'box'), 0.06), pNum(ctx.spec, 'range', 2.6));
    return { count: 0 };
  },
  step(s, ctx) {
    const who = ctx.interactedBy();
    if (who) {
      s.count++;
      const b = pAabb(ctx.spec, 'box');
      ctx.cue('carry.bell', [(b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2], { freq: pNum(ctx.spec, 'freq', 523.25) });
    }
    ctx.output('pressed', who ? 1 : 0);
    ctx.output('count', s.count);
  },
});

// ---------------------------------------------------------------- 光の筋（鏡）
interface BeamState { path: number[]; hit: number; [k: string]: number | number[] }

/** 4 方向（升目の i, k の進み）: 0:+x 1:+z 2:-x 3:-z */
const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

definePart<BeamState>({
  type: 'beamGrid',
  outputs: ['hit', 'turns'],
  init: () => ({ path: [], hit: 0 }),
  step(s, ctx) {
    // 10 tick ごとに引き直す（鏡は置いたときだけ動く）
    if (ctx.tick % 6 !== 1 && s.path.length) { ctx.output('hit', s.hit); return; }
    const o = ctx.spec.params.origin as number[];
    const cell = pNum(ctx.spec, 'cell', 1);
    const nx = Math.round(pNum(ctx.spec, 'nx', 5)), nz = Math.round(pNum(ctx.spec, 'nz', 5));
    const y = o[1]! + pNum(ctx.spec, 'h', 1.0);
    const blocks = new Set((ctx.spec.params.blocks as number[] | undefined) ?? []);
    const src = ctx.spec.params.source as number[]; // [i, k, dir]
    const tgt = ctx.spec.params.target as number[]; // [i, k]
    // 鏡: 持てる物（tag mirror）の置いてある升目と向き
    const ix = carryIndex(ctx.floor);
    const mirrors = new Map<number, number>();
    for (const id of ix.items) {
      const spec = ix.specs.get(id)!;
      if (!tagMatch(itemCfg(spec).tag, ['mirror'])) continue;
      const st = ctx.stateOf(id) as ItemState | null;
      if (!st || st.mode === HELD) continue;
      const i = Math.floor((st.poses[0]! - o[0]!) / cell), k = Math.floor((st.poses[2]! - o[2]!) / cell);
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      mirrors.set(k * nx + i, st.yaw);
    }
    let i = src[0]!, k = src[1]!, d = src[2]!;
    const pts: number[] = [o[0]! + (i + 0.5) * cell, y, o[2]! + (k + 0.5) * cell];
    let hit = 0, turns = 0;
    for (let n = 0; n < 4 * (nx + nz); n++) {
      const yaw = mirrors.get(k * nx + i);
      if (yaw !== undefined && n > 0) {
        // 鏡の面の法線（物の前 = -z を向きで回した向き）。両面で反射する。斜め 45° でないと止まる
        const nxm = -Math.sin(yaw), nzm = -Math.cos(yaw);
        const [dx, dz] = STEP[d]!;
        const dot = dx * nxm + dz * nzm;
        if (Math.abs(dot) < 0.3 || Math.abs(dot) > 0.9) break;
        const rx = dx - 2 * dot * nxm, rz = dz - 2 * dot * nzm;
        d = Math.abs(rx) > Math.abs(rz) ? (rx > 0 ? 0 : 2) : (rz > 0 ? 1 : 3);
        turns++;
        pts.push(o[0]! + (i + 0.5) * cell, y, o[2]! + (k + 0.5) * cell);
      }
      const [dx, dz] = STEP[d]!;
      const ni = i + dx, nk = k + dz;
      if (ni === tgt[0] && nk === tgt[1]) { hit = 1; pts.push(o[0]! + (ni + 0.5) * cell, y, o[2]! + (nk + 0.5) * cell); break; }
      if (ni < 0 || nk < 0 || ni >= nx || nk >= nz || blocks.has(nk * nx + ni)) {
        // 壁・柱の面まで
        pts.push(o[0]! + (i + 0.5 + dx * 0.5) * cell, y, o[2]! + (k + 0.5 + dz * 0.5) * cell);
        break;
      }
      i = ni; k = nk;
    }
    if (hit && !s.hit) ctx.cue('carry.beam.hit', [pts[pts.length - 3]!, y, pts[pts.length - 1]!]);
    s.path = pts;
    s.hit = hit;
    ctx.output('hit', hit);
    ctx.output('turns', turns);
  },
});

// ---------------------------------------------------------------- 迷路の模型の玉
interface MarbleState { c: number; x: number; z: number; dir: number; wait: number; done: number; tilt: number; [k: string]: number }

definePart<MarbleState>({
  type: 'marbleModel',
  outputs: ['done', 'moving', 'tilt'],
  init: (ctx) => {
    const c = Math.round(pNum(ctx.spec, 'start', 0));
    const nx = Math.round(pNum(ctx.spec, 'nx', 3));
    return { c, x: c % nx, z: Math.floor(c / nx), dir: -1, wait: 0, done: 0, tilt: -1 };
  },
  step(s, ctx) {
    const nx = Math.round(pNum(ctx.spec, 'nx', 3)), nz = Math.round(pNum(ctx.spec, 'nz', 3));
    const open = new Set((ctx.spec.params.open as string[] | undefined) ?? []);
    const hole = Math.round(pNum(ctx.spec, 'hole', -1));
    const start = Math.round(pNum(ctx.spec, 'start', 0));
    const table = pAabb(ctx.spec, 'table');
    const cx = (table.min[0] + table.max[0]) / 2, cz = (table.min[2] + table.max[2]) / 2;
    const hw = (table.max[0] - table.min[0]) / 2, hd = (table.max[2] - table.min[2]) / 2;
    // 傾き: 机のそばに立っている人のいる辺の方へ（世界の 4 方向）。升目の向き（params.axes: +i・+k の世界の向き）に直す
    // （升目の 0:+i 1:+k 2:-i 3:-k）
    const ax = (ctx.spec.params.axes as number[] | undefined) ?? [1, 0, 0, 1];
    let tilt = -1;
    for (const p of ctx.players) {
      const dx = p.pos[0] - cx, dz = p.pos[2] - cz;
      if (Math.abs(dx) > hw + 1.4 || Math.abs(dz) > hd + 1.4 || !p.onGround) continue;
      const wx = Math.abs(dx) / hw > Math.abs(dz) / hd ? Math.sign(dx) : 0, wz = wx ? 0 : Math.sign(dz);
      const di = wx * ax[0]! + wz * ax[1]!, dk = wx * ax[2]! + wz * ax[3]!;
      tilt = Math.abs(di) > Math.abs(dk) ? (di > 0 ? 0 : 2) : (dk > 0 ? 1 : 3);
    }
    s.tilt = tilt;
    let moving = 0;
    if (s.wait > 0) {
      s.wait -= ctx.dt;
      if (s.wait <= 0) { s.c = start; s.x = start % nx; s.z = Math.floor(start / nx); s.dir = -1; }
    } else {
      if (s.dir < 0 && tilt >= 0) s.dir = tilt;
      if (s.dir >= 0) {
        const [dx, dz] = STEP[s.dir]!;
        const ci = s.c % nx, ck = Math.floor(s.c / nx);
        const ni = ci + dx, nk = ck + dz;
        const n = nk * nx + ni;
        const can = ni >= 0 && nk >= 0 && ni < nx && nk < nz && open.has(s.c < n ? `${s.c}-${n}` : `${n}-${s.c}`);
        if (can) {
          // 氷の上のように、壁に当たるまで転がり続ける
          moving = 1;
          const sp = pNum(ctx.spec, 'speed', 3) * ctx.dt;
          s.x += dx * sp; s.z += dz * sp;
          if ((dx && Math.abs(s.x - ci) >= 1) || (dz && Math.abs(s.z - ck) >= 1)) {
            s.c = n; s.x = ni; s.z = nk;
            if (n === hole) { s.done = 1; s.wait = 1.2; s.dir = -1; ctx.cue('carry.marble.hole', [cx, table.max[1], cz]); }
          }
        } else {
          s.x = ci; s.z = ck;
          s.dir = tilt >= 0 && tilt !== s.dir ? tilt : -1;
        }
      }
    }
    ctx.output('done', s.done);
    ctx.output('moving', moving);
    ctx.output('tilt', tilt);
  },
});

// ---------------------------------------------------------------- 踏む順
interface StepState { cur: number; prog: number; done: number; [k: string]: number }

definePart<StepState>({
  type: 'stepPattern',
  outputs: ['progress', 'done', 'step'],
  init: () => ({ cur: -1, prog: 0, done: 0 }),
  step(s, ctx) {
    const o = ctx.spec.params.origin as number[];
    const cell = pNum(ctx.spec, 'cell', 0.8);
    const nx = Math.round(pNum(ctx.spec, 'nx', 4)), nz = Math.round(pNum(ctx.spec, 'nz', 4));
    const pattern = (ctx.spec.params.pattern as number[] | undefined) ?? [];
    const notes = ctx.spec.params.notes as number[] | undefined;
    const p = ctx.players[0];
    let c = -1;
    if (p && p.onGround && Math.abs(p.pos[1] - o[1]!) < 0.4) {
      const i = Math.floor((p.pos[0] - o[0]!) / cell), k = Math.floor((p.pos[2] - o[2]!) / cell);
      if (i >= 0 && k >= 0 && i < nx && k < nz) c = k * nx + i;
    }
    let step = 0;
    if (c !== s.cur) {
      if (c >= 0) {
        step = c + 1;
        if (notes) ctx.cue('carry.note', [o[0]! + ((c % nx) + 0.5) * cell, o[1]!, o[2]! + (Math.floor(c / nx) + 0.5) * cell], { note: notes[c] ?? 0, cell: c });
        if (!s.done && pattern.length) {
          if (pattern[s.prog] === c) { s.prog++; ctx.cue('carry.step.ok', undefined, { progress: s.prog }); }
          else if (s.prog > 0 && pattern[s.prog - 1] === c) { /* 同じ升目に戻っただけ */ }
          else { if (s.prog > 0) ctx.cue('carry.step.wrong'); s.prog = pattern[0] === c ? 1 : 0; }
          if (s.prog >= pattern.length) { s.done = 1; ctx.cue('carry.step.done'); }
        }
      }
      s.cur = c;
    }
    ctx.output('progress', s.prog);
    ctx.output('done', s.done);
    ctx.output('step', step);
  },
});

// ---------------------------------------------------------------- 描くだけ
definePart({
  type: 'carryDecor',
  outputs: [],
  init: () => ({}),
});
