/**
 * 仕切りの装置の部品（改札 D06・自動扉 D07・シャッター D08）。
 *
 * - ticketGates: 改札の列。人が仕切りの線（line・向き along）を越えたとき、どの通路（lanes）を通ったかを見る。ふつうの通路なら駅が 1 つ進む
 *     （出力 station。Cue gate.pass）、× の通路（cross）なら知らない駅（出力 other。一度入ったら戻らない。Cue gate.other）。
 *     扉（描画だけ。当たり判定は無い）は、通路の近く 1.3 m に人がいると開く（状態 flaps）
 * - autoDoor: 自動扉。前後の範囲（sensor）に人が入ると開き、いなくなると閉まる（扉の中に人がいる間は閉めない）。
 *     flaky の割合で、近づいても開かない（入り直すと、もう一度決める。出力 refused）。broken なら、しゃがんだ人が crouchSec 秒いると開いて、
 *     それからは開いたまま（出力 done）。閉じている間だけ当たり判定
 * - shutter: 部屋を横切るシャッター。決まった周期で 開いている → 下りる → 閉まっている → 上がる。下りるとき人の上では止まる（挟まない）。
 *     下の端より上が当たり判定（下りかけはしゃがんでくぐれる）。出力 h（下の端の高さ）・passable（開いていて、need 秒より長く開いている）
 */
import type { AABB } from '../../../math/aabb.ts';
import { aabbCenter, aabbExpand } from '../../../math/aabb.ts';
import { approach } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { PLAYER } from '../../player.ts';
import { definePart, pAabb, pBool, pNum, playerIn, pVec } from '../../part.ts';

// ---------------------------------------------------------------- 改札

interface GateState { side: number[]; station: number; other: number; passes: number; flaps: number[]; [k: string]: Json | undefined }

definePart<GateState>({
  type: 'ticketGates',
  outputs: ['station', 'other', 'passes'],
  init: () => ({ side: [], station: 0, other: 0, passes: 0, flaps: [] }),
  step(s, ctx) {
    const lanes = (ctx.spec.params.lanes as number[][] | undefined) ?? [];
    const cross = pNum(ctx.spec, 'cross', -1);
    const line = pVec(ctx.spec, 'line');
    const along = (ctx.spec.params.along as number[] | undefined) ?? [0, 1];
    const laneOf = (x: number, z: number, pad: number): number => lanes.findIndex((r) => x > r[0]! - pad && x < r[2]! + pad && z > r[1]! - pad && z < r[3]! + pad);
    ctx.players.forEach((p, i) => {
      const d = (p.pos[0] - line[0]) * along[0]! + (p.pos[2] - line[2]) * along[1]!;
      const sd = d >= 0 ? 1 : -1;
      const prev = s.side[i];
      s.side[i] = sd;
      if (prev === undefined || prev === sd || Math.abs(d) > 0.8) return;
      const k = laneOf(p.pos[0], p.pos[2], 0.1);
      if (k < 0) return;
      if (k === cross) {
        if (!s.other) { s.other = 1; ctx.cue('gate.other', [p.pos[0], p.pos[1] + 1, p.pos[2]]); }
      } else {
        s.station++;
        s.passes++;
        ctx.cue('gate.pass', [p.pos[0], p.pos[1] + 1, p.pos[2]], { station: s.station });
      }
    });
    // 扉: 通路の近くに人がいると開く（× の通路は開かない）
    lanes.forEach((r, k) => {
      const cx = (r[0]! + r[2]!) / 2, cz = (r[1]! + r[3]!) / 2;
      const near = k !== cross && ctx.players.some((p) => Math.hypot(p.pos[0] - cx, p.pos[2] - cz) < 1.3);
      s.flaps[k] = approach(s.flaps[k] ?? 0, near ? 1 : 0, ctx.dt / 0.35);
    });
    ctx.output('station', s.station);
    ctx.output('other', s.other);
    ctx.output('passes', s.passes);
  },
});

// ---------------------------------------------------------------- 自動扉

interface AutoState { k: number; refused: number; inside: number; crouch: number; done: number; idle: number; [k: string]: Json | undefined }

definePart<AutoState>({
  type: 'autoDoor',
  outputs: ['open', 'refused', 'done'],
  init(ctx) {
    ctx.setCollider('panel', pAabb(ctx.spec, 'panel'));
    return { k: 0, refused: 0, inside: 0, crouch: 0, done: 0, idle: 0 };
  },
  step(s, ctx) {
    const panel = pAabb(ctx.spec, 'panel'), sensor = pAabb(ctx.spec, 'sensor');
    const center = aabbCenter(panel);
    const who = ctx.players.filter((p) => playerIn(p, sensor));
    const inDoor = ctx.players.some((p) => playerIn(p, aabbExpand(panel, 0.45)));
    let want = 0;
    if (pBool(ctx.spec, 'broken', false)) {
      // 故障中: しゃがんだ人（小さな物）にだけ反応する
      s.crouch = who.some((p) => p.crouching) ? s.crouch + ctx.dt : 0;
      if (!s.done && s.crouch >= pNum(ctx.spec, 'crouchSec', 1.2)) { s.done = 1; ctx.cue('auto.open', center); }
      if (!s.done && who.length && !s.inside) ctx.cue('auto.refuse', center);
      want = s.done;
    } else {
      // 入ってきたときに、開くかどうかを決める（たまに開かない）
      if (who.length && !s.inside) {
        s.refused = ctx.random() < pNum(ctx.spec, 'flaky', 0) ? 1 : 0;
        ctx.cue(s.refused ? 'auto.refuse' : 'auto.open', center);
      }
      if (!who.length) s.refused = 0;
      want = who.length && !s.refused ? 1 : 0;
    }
    s.inside = who.length ? 1 : 0;
    // 閉まるのは少し待ってから。扉の中に人がいる間は閉めない
    if (want || inDoor) s.idle = 0; else s.idle += ctx.dt;
    const target = want || inDoor || (s.k > 0.05 && s.idle < 0.6) ? 1 : 0;
    s.k = approach(s.k, target, ctx.dt / 0.7);
    ctx.setCollider('panel', s.k < 0.5 ? panel : null);
    ctx.output('open', s.k >= 0.9 ? 1 : 0);
    ctx.output('refused', s.refused);
    ctx.output('done', s.done);
  },
});

// ---------------------------------------------------------------- シャッター

interface ShutterState { h: number; [k: string]: Json | undefined }

/** 周期の中の時刻 τ のシャッターの下の端（床からの高さ）と段階（0 開いている / 1 下りる / 2 閉まっている / 3 上がる）と、その段階の残りの秒 */
export function shutterAt(tau: number, c: { open: number; down: number; closed: number; up: number; top: number }): { h: number; phase: number; left: number } {
  let x = tau;
  if (x < c.open) return { h: c.top, phase: 0, left: c.open - x };
  x -= c.open;
  if (x < c.down) return { h: c.top * (1 - x / c.down), phase: 1, left: c.down - x };
  x -= c.down;
  if (x < c.closed) return { h: 0, phase: 2, left: c.closed - x };
  x -= c.closed;
  return { h: c.top * Math.min(1, x / c.up), phase: 3, left: c.up - x };
}

definePart<ShutterState>({
  type: 'shutter',
  outputs: ['h', 'passable', 'phase'],
  init(ctx) { return { h: pAabb(ctx.spec, 'box').max[1] - pAabb(ctx.spec, 'box').min[1] }; },
  step(s, ctx) {
    const b = pAabb(ctx.spec, 'box');
    const y = b.min[1], top = b.max[1] - b.min[1];
    const c = { open: pNum(ctx.spec, 'open', 3.5), down: pNum(ctx.spec, 'down', 3.5), closed: pNum(ctx.spec, 'closed', 1.5), up: pNum(ctx.spec, 'up', 2.5), top };
    const period = c.open + c.down + c.closed + c.up;
    const tau = (((ctx.time + pNum(ctx.spec, 'offset', 0)) % period) + period) % period;
    const st = shutterAt(tau, c);
    // 人の上では止まる（下の端を頭の上に）
    const thin = pNum(ctx.spec, 'thin', 0.45);
    const under: AABB = { min: [b.min[0] - (b.max[0] - b.min[0] < 0.5 ? thin : 0), y - 0.5, b.min[2] - (b.max[2] - b.min[2] < 0.5 ? thin : 0)], max: [b.max[0] + (b.max[0] - b.min[0] < 0.5 ? thin : 0), y + top, b.max[2] + (b.max[2] - b.min[2] < 0.5 ? thin : 0)] };
    let safe = 0;
    for (const p of ctx.players) if (playerIn(p, under)) safe = Math.max(safe, p.pos[1] - y + (p.crouching ? PLAYER.crouchHeight : PLAYER.height) + 0.05);
    const want = Math.min(top, Math.max(st.h, safe));
    const prev = s.h;
    s.h = want >= s.h ? want : Math.max(want, s.h - (top / c.down) * 1.5 * ctx.dt);
    if (prev >= top - 0.01 && s.h < top - 0.01) ctx.cue('shutter.down', [(b.min[0] + b.max[0]) / 2, y + top, (b.min[2] + b.max[2]) / 2]);
    if (prev <= 0.01 && s.h > 0.01) ctx.cue('shutter.up', [(b.min[0] + b.max[0]) / 2, y + 0.5, (b.min[2] + b.max[2]) / 2]);
    ctx.setCollider('slat', s.h >= top - 0.02 ? null : { min: [b.min[0], y + s.h, b.min[2]], max: [b.max[0], b.max[1], b.max[2]] });
    ctx.output('h', s.h);
    ctx.output('phase', st.phase);
    ctx.output('passable', st.phase === 0 && st.left >= pNum(ctx.spec, 'need', 1.6) ? 1 : 0);
  },
});
