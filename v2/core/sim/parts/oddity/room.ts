/**
 * 部屋まるごとの異変の部品（段階 4・oddity）。見た目（雨・雪・煙・画面の色）はクライアントの描画（client/views/oddity）が作り、
 * ここは「部屋にいるか・いた時間」「部屋の中だけ進む時刻」「足跡」「触れた」「寄せる波」の状態だけを持つ。
 *
 * - oddRoom: 部屋（aabb）に人がいるか（in）・入った瞬間（entered）・今回いる秒数（sec）・いた秒数の合計（total）。
 *            params.fx は描画だけが読む（雨・雪・煙・画面の色 …。client/views/oddity/room.ts）
 * - oddClock: 部屋の中だけ進む時刻（T02）。部屋にいる間だけ進み、daySec 秒で朝 → 昼 → 夕 → 夜。phase 0..1・
 *            level（日の明るさ。窓の灯りの照明 lampId に使う）・night（夜の灯り。oddLevel を通して天井の照明に使う）
 * - oddLevel: 入力 in をそのまま level に出す（照明の lampId に使う。照明の明るさは部品の出力 level で決まる）
 * - oddTrail: 部屋の中を歩いた足跡（雪・砂）。stride m ごとに左右交互に [x, z, yaw, 左右] を記録する（max 個まで。古い物から消える）
 * - oddTouch: 調べられる箱（違う家具に触れる）。調べたら touched が入ったまま（隠しの出現型の条件）
 * - oddWaves: 寄せては返す波（E10）。period 秒ごとに surge 秒だけ、浜へ押し戻す外力（force ゾーン）を置く
 */
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import type { AABB } from '../../../math/aabb.ts';
import type { PlayerState } from '../../types.ts';
import { definePart, pAabb, pNum, playerIn, type PartContext } from '../../part.ts';

const ON = 0.5;

/** 部屋にいるか: aabb の中で、params.rects（床の矩形）があればそのどれかの上（L 字の部屋の外形の欠けた隅は部屋の外） */
function inRoom(ctx: PartContext, a: AABB, p: PlayerState): boolean {
  if (!playerIn(p, a)) return false;
  const rs = ctx.spec.params.rects as { x0: number; z0: number; x1: number; z1: number }[] | undefined;
  return !rs || rs.some((r) => p.pos[0] >= r.x0 - 0.05 && p.pos[0] <= r.x1 + 0.05 && p.pos[2] >= r.z0 - 0.05 && p.pos[2] <= r.z1 + 0.05);
}

definePart<{ inside: number; sec: number; total: number }>({
  type: 'oddRoom',
  outputs: ['in', 'entered', 'sec', 'total'],
  init: () => ({ inside: 0, sec: 0, total: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const inside = ctx.players.some((p) => inRoom(ctx, a, p)) ? 1 : 0;
    ctx.output('entered', inside && !s.inside ? 1 : 0);
    s.sec = inside ? s.sec + ctx.dt : 0;
    if (inside) s.total += ctx.dt;
    s.inside = inside;
    ctx.output('in', inside);
    ctx.output('sec', s.sec);
    ctx.output('total', s.total);
  },
});

/** 1 日の中の位置 phase（0 = 朝・0.25 = 昼・0.5 = 夕・0.75 = 夜）→ 日の明るさ */
export function sunLevel(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  // 朝（0）から昼（0.25）へ上がり、夕（0.5）で傾き、夜（0.62〜0.86）は 0、夜明けに戻る
  if (p < 0.25) return 0.55 + 0.45 * (p / 0.25);
  if (p < 0.5) return 1 - 0.55 * ((p - 0.25) / 0.25);
  if (p < 0.62) return 0.45 * (1 - (p - 0.5) / 0.12);
  if (p < 0.86) return 0;
  return 0.55 * ((p - 0.86) / 0.14);
}

definePart<{ t: number; inside: number }>({
  type: 'oddClock',
  outputs: ['phase', 'level', 'night', 'in'],
  init: (ctx) => ({ t: pNum(ctx.spec, 'startPhase', 0) * pNum(ctx.spec, 'daySec', 90), inside: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const day = Math.max(1, pNum(ctx.spec, 'daySec', 90));
    const inside = ctx.players.some((p) => inRoom(ctx, a, p)) ? 1 : 0;
    if (inside) s.t += ctx.dt;
    if (inside !== s.inside) ctx.cue(inside ? 'odd.clock.enter' : 'odd.clock.leave');
    s.inside = inside;
    const phase = (s.t / day) % 1;
    const sun = sunLevel(phase);
    ctx.output('phase', phase);
    ctx.output('level', sun);
    // 夜の灯り: 日が傾いたら点き、明るくなったら消える
    ctx.output('night', sun < 0.3 ? 1 : 0);
    ctx.output('in', inside);
  },
});

definePart({
  type: 'oddLevel',
  outputs: ['level', 'on'],
  inputs: ['in'],
  init: () => ({}),
  step(_s, ctx) {
    const v = Math.max(0, Math.min(1, ctx.input('in')));
    ctx.output('level', v);
    ctx.output('on', v > ON ? 1 : 0);
  },
});

interface TrailState { prints: number[]; acc: number; last: number[]; side: number; [k: string]: Json | undefined }

definePart<TrailState>({
  type: 'oddTrail',
  outputs: ['count'],
  init: () => ({ prints: [], acc: 0, last: [], side: 1 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const stride = pNum(ctx.spec, 'stride', 0.62);
    const max = Math.max(4, Math.round(pNum(ctx.spec, 'max', 160)));
    const p = ctx.players.find((q) => inRoom(ctx, a, q) && q.onGround && !q.surfaceId);
    if (!p) { s.last = []; ctx.output('count', s.prints.length / 4); return; }
    if (s.last.length === 2) s.acc += Math.hypot(p.pos[0] - s.last[0]!, p.pos[2] - s.last[1]!);
    s.last = [p.pos[0], p.pos[2]];
    if (s.acc >= stride) {
      s.acc -= stride;
      // 足の位置: 進む向きの左右 0.13 m（向きは視線ではなく動いた向き）
      const vx = p.vel[0], vz = p.vel[2];
      const yaw = Math.hypot(vx, vz) > 0.2 ? Math.atan2(-vx, -vz) : p.yaw;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      s.side = -s.side;
      s.prints.push(p.pos[0] + rx * 0.13 * s.side, p.pos[2] + rz * 0.13 * s.side, yaw, s.side);
      if (s.prints.length > max * 4) s.prints.splice(0, s.prints.length - max * 4);
    }
    ctx.output('count', s.prints.length / 4);
  },
});

definePart<{ touched: number }>({
  type: 'oddTouch',
  outputs: ['touched', 'pressed'],
  init(ctx) {
    ctx.setInteractable(pAabb(ctx.spec, 'box'), pNum(ctx.spec, 'range', 2.6));
    return { touched: 0 };
  },
  step(s, ctx) {
    const who = ctx.interactedBy();
    if (who) {
      const b = pAabb(ctx.spec, 'box');
      const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
      ctx.cue(s.touched ? 'odd.touch.again' : 'odd.touch', c);
      s.touched = 1;
    }
    ctx.output('pressed', who ? 1 : 0);
    ctx.output('touched', s.touched);
  },
});

definePart<{ t: number; push: number }>({
  type: 'oddWaves',
  outputs: ['surge', 'push'],
  init: () => ({ t: 0, push: 0 }),
  step(s, ctx) {
    const period = Math.max(1, pNum(ctx.spec, 'period', 7));
    const surge = Math.min(period * 0.9, pNum(ctx.spec, 'surge', 2.2));
    s.t = (s.t + ctx.dt) % period;
    // 波の高さ: 寄せる間（0..surge）に上がって戻る。押すのは寄せている間だけ
    const k = s.t < surge ? Math.sin((s.t / surge) * Math.PI) : 0;
    const push = s.t < surge ? 1 : 0;
    if (push !== s.push) {
      const v = ctx.spec.params.vector as number[] | undefined;
      ctx.setZone('surge', push ? { kind: 'force', aabb: pAabb(ctx.spec, 'aabb'), vector: [v?.[0] ?? 0, 0, v?.[2] ?? 1], params: { speed: pNum(ctx.spec, 'speed', 1.4) } } : null);
      if (push) ctx.cue('odd.wave');
      s.push = push;
    }
    ctx.output('surge', k);
    ctx.output('push', push);
  },
});
