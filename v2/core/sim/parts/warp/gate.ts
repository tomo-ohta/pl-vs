/**
 * warpGate: 面を横切ったら、同じ形の別の場所へ継ぎ目なく移す（空間のゆがみの基本の部品）。
 *
 * params:
 *   box   … 横切りを見る範囲（足元がこの中にいるときだけ。面は box の中心を通り dir を向く）
 *   dir   … 横切る向き（0:+Z 1:+X 2:-Z 3:-X）。面の裏（dir の逆側）から表へ出た tick に移す
 *   xform … 移し方（Xform: from → to、1/4 回転 q。向きも q だけ回す）
 *   seamless … 継ぎ目なく（既定 true。速度を保ち、カメラの補間をずらす）
 *   needs … この出力の id を、隠しの現す部品（reveal）が読んでいるときだけ働く（隠しが付いていない光の枠の裏は、ただの枠）
 * inputs: enable（配線したら、その間だけ働く）
 * outputs: count（移した回数）・pulse（移した tick だけ 1）
 *
 * 1 tick の動き（0.45 m 以下）より大きく側が変わったときは横切りとみなさない（別の部品で移された直後に誤って移さない）。
 * 側は box の中にいる間だけ覚える（box の外へ出たら忘れる）
 */
import { aabbCenter } from '../../../math/aabb.ts';
import type { Dir } from '../../../math/vec.ts';
import { definePart, pBool, pNum } from '../../part.ts';
import { inBox, readAabb, readXform, sideOf, xPoint, xYaw } from './util.ts';

definePart<{ side: Record<string, number>; count: number }>({
  type: 'warpGate',
  outputs: ['count', 'pulse'],
  inputs: ['enable'],
  init: () => ({ side: {}, count: 0 }),
  step(s, ctx) {
    const box = readAabb(ctx.spec.params.box);
    const dir = (pNum(ctx.spec, 'dir', 0) & 3) as Dir;
    const x = readXform(ctx.spec.params.xform);
    const needs = typeof ctx.spec.params.needs === 'string' ? ctx.spec.params.needs : null;
    const enabled = (!ctx.wired('enable') || ctx.input('enable') > 0.5) && (!needs || ctx.floor.entities.some((e) => e.type === 'reveal' && Object.values(e.inputs ?? {}).includes(needs)));
    const c = aabbCenter(box);
    let pulse = 0;
    for (const p of ctx.players) {
      // 横切りは box の中で続けて見ていたときだけ（box の外では側を忘れる。真上の別の空間で同じ面を横切っても、戻った tick に誤って移さない）
      if (!inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], box)) { delete s.side[p.id]; continue; }
      const now = sideOf(c, dir, p.pos);
      const prev = s.side[p.id];
      s.side[p.id] = now;
      if (!enabled || prev === undefined || Math.abs(now - prev) > 1) continue;
      if (!(prev < 0 && now >= 0)) continue;
      const to = xPoint(x, p.pos);
      ctx.warp(p, to, xYaw(x, p.yaw), pBool(ctx.spec, 'seamless', true));
      s.side[p.id] = sideOf(c, dir, to);
      s.count++;
      pulse = 1;
    }
    ctx.output('count', s.count);
    ctx.output('pulse', pulse);
  },
});
