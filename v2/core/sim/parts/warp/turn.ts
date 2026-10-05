/**
 * warpTurnRoom: 回転する部屋（W11）。部屋の真ん中の丸い部屋（筒の壁・床・家具）が、真ん中を軸にゆっくり回る。
 *
 * - 角度 angle は omega（rad/s。atan2(z, x) が増える向きが正）で増える。筒の壁は segs 枚の板（切れ目 gaps の所は無い）で、
 *   板・家具の当たり判定は回した 4 隅を囲む箱（毎 tick 置き直す）
 * - 筒の中（床の上）にいる人は、床と一緒に回る（位置を軸のまわりに回し、向きも同じだけ回す。継ぎ目の無い移動で送る）。
 *   軸から離れるほど外へ押される（drift × 軸からの距離 m/s。軸の近く（calm m 以内）では押さない = 真ん中にいれば立っていられる）
 *
 * params:
 *   center … [x, z]・radius … 筒の壁の真ん中の半径・wallT … 壁の厚み・floorY・height（壁の高さ）
 *   gaps … [{ at, half }]（切れ目の真ん中の角度と半分の幅。angle = 0 のとき）・segs … 壁の板の数
 *   omega・drift・calm
 *   items … [{ min, max, mat, solid, rot }]（家具。angle = 0・rot = 0 のときの箱を、軸のまわりに rot 回した所に置く）
 * outputs: angle（今の角度 rad。0..2π）
 */
import type { AABB } from '../../../math/aabb.ts';
import { definePart, pNum, type PartContext } from '../../part.ts';

export interface TurnItem { min: number[]; max: number[]; mat: string; solid?: boolean; rot?: number }
export interface TurnGap { at: number; half: number }

/** 点 (x, z) を軸 c のまわりに a（atan2(z, x) が増える向き）だけ回す */
export function turnXZ(c: readonly number[], x: number, z: number, a: number): [number, number] {
  const dx = x - c[0]!, dz = z - c[1]!;
  const ca = Math.cos(a), sa = Math.sin(a);
  return [c[0]! + dx * ca - dz * sa, c[1]! + dx * sa + dz * ca];
}

/** 箱（y は保つ）を軸のまわりに a 回した 4 隅を囲む箱 */
export function turnedAabb(c: readonly number[], min: readonly number[], max: readonly number[], a: number): AABB {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of [[min[0]!, min[2]!], [max[0]!, min[2]!], [min[0]!, max[2]!], [max[0]!, max[2]!]] as const) {
    const [px, pz] = turnXZ(c, x, z, a);
    x0 = Math.min(x0, px); z0 = Math.min(z0, pz); x1 = Math.max(x1, px); z1 = Math.max(z1, pz);
  }
  return { min: [x0, min[1]!, z0], max: [x1, max[1]!, z1] };
}

/** 角度 a が切れ目の中か（angle = 0 のときの角度で。margin だけ狭める） */
export function inGap(gaps: readonly TurnGap[], a: number, margin = 0): boolean {
  return gaps.some((g) => { let d = (a - g.at) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) < g.half - margin; });
}

/** 壁の板（angle = 0 のとき）: 板 k の真ん中の角度と、板を x 軸の上に置いたときの箱（軸から半径 radius の所・接線の向きに長い） */
export function wallSegments(P: { center: number[]; radius: number; wallT: number; segs: number; gaps: TurnGap[]; floorY: number; height: number }): { at: number; min: number[]; max: number[] }[] {
  const out: { at: number; min: number[]; max: number[] }[] = [];
  const len = (2 * Math.PI * P.radius) / P.segs + 0.03;
  for (let k = 0; k < P.segs; k++) {
    const at = ((k + 0.5) * 2 * Math.PI) / P.segs;
    if (inGap(P.gaps, at, -Math.PI / P.segs)) continue;
    const cx = P.center[0]!, cz = P.center[1]!;
    out.push({ at, min: [cx + P.radius - P.wallT / 2, P.floorY, cz - len / 2], max: [cx + P.radius + P.wallT / 2, P.floorY + P.height, cz + len / 2] });
  }
  return out;
}

const params = (ctx: PartContext) => {
  const p = ctx.spec.params;
  return {
    center: p.center as number[], radius: pNum(ctx.spec, 'radius', 2.5), wallT: pNum(ctx.spec, 'wallT', 0.12), segs: Math.round(pNum(ctx.spec, 'segs', 72)),
    gaps: (p.gaps as unknown as TurnGap[] | undefined) ?? [], floorY: pNum(ctx.spec, 'floorY', 0), height: pNum(ctx.spec, 'height', 2.6),
    omega: pNum(ctx.spec, 'omega', 0.15), drift: pNum(ctx.spec, 'drift', 0.1), calm: pNum(ctx.spec, 'calm', 0.6),
    items: (p.items as unknown as TurnItem[] | undefined) ?? [],
  };
};

function place(ctx: PartContext, a: number): void {
  const P = params(ctx);
  for (const [k, w] of wallSegments(P).entries()) ctx.setCollider(`w${k}`, turnedAabb(P.center, w.min, w.max, w.at + a));
  P.items.forEach((it, i) => { if (it.solid) ctx.setCollider(`i${i}`, turnedAabb(P.center, it.min, it.max, (it.rot ?? 0) + a)); });
}

definePart<{ angle: number }>({
  type: 'warpTurnRoom',
  outputs: ['angle'],
  init(ctx) {
    place(ctx, 0);
    return { angle: 0 };
  },
  step(s, ctx) {
    const P = params(ctx);
    const da = P.omega * ctx.dt;
    s.angle = (s.angle + da) % (2 * Math.PI);
    if (s.angle < 0) s.angle += 2 * Math.PI;
    place(ctx, s.angle);
    // 筒の中の床の上にいる人は一緒に回る（向きも）。軸から離れるほど外へ押される（壁の手前まで）
    const inner = P.radius - P.wallT / 2;
    for (const p of ctx.players) {
      if (p.pos[1] < P.floorY - 0.3 || p.pos[1] > P.floorY + 0.6) continue;
      const dx = p.pos[0] - P.center[0]!, dz = p.pos[2] - P.center[1]!;
      const r = Math.hypot(dx, dz);
      if (r > inner + 0.05) continue;
      let [x, z] = turnXZ(P.center, p.pos[0], p.pos[2], da);
      if (r > P.calm && r < inner - 0.45) {
        const push = Math.min(P.drift * (r - P.calm) * ctx.dt, inner - 0.45 - r);
        x += (dx / r) * push; z += (dz / r) * push;
      }
      // 向き: atan2(z, x) が増える向きに da 回ると、視線の yaw は da 減る（yaw が増える = 左を向く）
      ctx.warp(p, [x, p.pos[1], z], p.yaw - da, true);
    }
    ctx.output('angle', s.angle);
  },
});
