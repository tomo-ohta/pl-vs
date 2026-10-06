/**
 * 果てしない階の、上下の階へ移る所の部品（docs/endless-world.md 14 章）。
 *
 * - liftCar: エレベーターのかご（上の階と下の階に同じ形で置く。core/gen/world/airlock.ts）。戸（door 部品・入力 open）を開け閉めする。
 *     phase 0 閉じて待つ / 1 開いている / 2 閉まりかけ / 3 動いている / 4 着いた（arriveSec で開く）。
 *     外の呼ぶボタン（入力 call）か、閉じた戸を調べる（入力 touch）と開く。中のボタン（go0・go1）を押すと閉まって動く。
 *     rideSec 動いたら出力 ready（WorldSession が向こうの階の同じかごへ移す）。かごの中に人が現れたら（移ってきた）着いたとして開く。
 *     誰もいなければ closeSec で閉まる。live が false（向こうの階が無い）なら動かない
 * - signPlate: 案内板（描画だけ。扉の上の「▼ 階段 B5F」）
 * - dropLift: 着く部屋の天井の上の縦穴の床板。普段は縦穴のいちばん上（box）で待つ。沈む床に乗ったまま落ちてきた人が移ってくると
 *     （WorldSession が y・riding を書く）、足の下から speed で部屋の床（floorY）まで下りる。誰も乗っていなければ idleSec で上へ戻る
 */
import { aabbCenter, type AABB } from '../../math/aabb.ts';
import type { Json } from '../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, playerIn } from '../part.ts';

const ON = 0.5;

interface CarState { phase: number; t: number; idle: number; pc: number; pg: number; [k: string]: Json | undefined }

definePart<CarState>({
  type: 'liftCar',
  outputs: ['open', 'ready', 'riding', 'phase'],
  inputs: ['call', 'touch', 'go0', 'go1', 'door'],
  init: () => ({ phase: 0, t: 0, idle: 0, pc: 0, pg: 0 }),
  step(s, ctx) {
    const inside = pAabb(ctx.spec, 'inside'), hall = pAabb(ctx.spec, 'hall');
    const center = aabbCenter(inside);
    const anyIn = ctx.players.some((p) => playerIn(p, inside));
    const nearHall = ctx.players.some((p) => playerIn(p, hall));
    const call = ctx.input('call') > ON || ctx.input('touch') > ON, go = ctx.input('go0') > ON || ctx.input('go1') > ON;
    const callE = call && !s.pc, goE = go && !s.pg;
    s.pc = call ? 1 : 0;
    s.pg = go ? 1 : 0;
    const rideSec = pNum(ctx.spec, 'rideSec', 4), arriveSec = pNum(ctx.spec, 'arriveSec', 1.2);
    const set = (ph: number): void => { s.phase = ph; s.t = 0; s.idle = 0; };
    switch (s.phase) {
      case 0:
        if (anyIn) set(4);
        else if (callE) { set(1); ctx.cue('lift.arrive', center); }
        break;
      case 1:
        if (anyIn && goE && pBool(ctx.spec, 'live', true)) { set(2); ctx.cue('lift.close', center); }
        else if (!anyIn && !nearHall) { s.idle += ctx.dt; if (s.idle >= pNum(ctx.spec, 'closeSec', 5)) set(0); }
        else s.idle = 0;
        break;
      case 2:
        if (ctx.input('door') < 0.01) {
          if (anyIn) { set(3); ctx.cue('lift.ride', center, { sec: rideSec + arriveSec }); }
          else set(0);
        }
        break;
      case 3:
        s.t += ctx.dt;
        // 移った（かごに誰もいない）: 閉じて待つ
        if (!anyIn) set(0);
        break;
      default:
        s.t += ctx.dt;
        if (s.t >= arriveSec) { set(1); ctx.cue('lift.arrive', center); }
    }
    ctx.output('open', s.phase === 1 ? 1 : 0);
    ctx.output('riding', s.phase === 3 ? 1 : 0);
    ctx.output('ready', s.phase === 3 && s.t >= rideSec ? 1 : 0);
    ctx.output('phase', s.phase);
  },
});

definePart({
  type: 'signPlate',
  outputs: [],
  init: () => ({}),
  step() { /* 描画だけ */ },
});

interface DropLiftState { y: number; riding: number; idle: number; [k: string]: Json | undefined }

const shifted = (b: AABB, top: number): AABB => ({ min: [b.min[0], top - (b.max[1] - b.min[1]), b.min[2]], max: [b.max[0], top, b.max[2]] });

definePart<DropLiftState>({
  type: 'dropLift',
  outputs: ['y', 'occupied', 'atBottom'],
  init(ctx) {
    const b = pAabb(ctx.spec, 'box');
    ctx.setCollider('box', b);
    return { y: b.max[1], riding: 0, idle: 0 };
  },
  step(s, ctx) {
    const b = pAabb(ctx.spec, 'box');
    const bottom = pNum(ctx.spec, 'floorY', b.max[1] - 10);
    const top = b.max[1];
    const on = ctx.players.filter((p) => Math.abs(p.pos[1] - s.y) < 0.3 && p.pos[0] > b.min[0] - 0.1 && p.pos[0] < b.max[0] + 0.1 && p.pos[2] > b.min[2] - 0.1 && p.pos[2] < b.max[2] + 0.1);
    const speed = pNum(ctx.spec, 'speed', 1.2);
    if (s.riding) {
      const prev = s.y;
      s.y = Math.max(bottom, s.y - speed * ctx.dt);
      if (s.y <= bottom + 1e-6) { s.riding = 0; ctx.cue('lift.stop', [(b.min[0] + b.max[0]) / 2, s.y, (b.min[2] + b.max[2]) / 2]); }
      void prev;
      s.idle = 0;
    } else if (s.y < top) {
      // 着いた床板: 降りた人がいなくなってから idleSec で、上へ戻る（暗い縦穴の中へ）
      if (on.length) s.idle = 0;
      else { s.idle += ctx.dt; if (s.idle >= pNum(ctx.spec, 'idleSec', 4)) s.y = Math.min(top, s.y + speed * 2 * ctx.dt); }
    }
    ctx.setCollider('box', shifted(b, s.y));
    ctx.output('y', s.y);
    ctx.output('occupied', on.length ? 1 : 0);
    ctx.output('atBottom', s.y <= bottom + 1e-3 ? 1 : 0);
  },
});
