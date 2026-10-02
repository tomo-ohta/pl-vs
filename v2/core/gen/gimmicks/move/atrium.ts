/**
 * 吹き抜けを渡る部屋（atrium）。部屋の床ほぼ全体が深い穴（pit.ts の planPit: 入口・出口の壁沿いの固い床）。
 * 歩いて渡るなら、入口の床の階段で底へ下り、出口の床へ上る階段で上がる（遠回り）。穴の上を渡る乗り物が近道:
 *
 * - rope ロープ渡り [M16]: 入口の床から出口の床へ張ったロープ。調べてつかまり、両手でゆっくり進む（跳ぶと手を離して底へ）
 * - zip ジップライン [M17]: 入口の床の取っ手につかまると、吹き抜けを滑り下りて出口の階段の下へ（取っ手はしばらくで戻る）
 * - cart 台車に乗る [M29]: 入口の床の縁の坂の上の台車。乗ると坂を転がり下りて、底の車止めまで一気に（台車はしばらくで戻る）
 * - gondola ゴンドラ [M30]: 入口の床と出口の床の間を行き来する小さな箱。動いている間、床がゆっくり 1 回転する（景色が回る）
 *
 * どれも穴の底へ落ちても、出口の階段・入口の階段で歩いて戻れる（閉じ込めない）
 */
import type { Vec3 } from '../../../math/vec.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { buildPit, planPit } from '../pit.ts';
import { defineGimmick } from '../types.ts';
import { laneSide, slope } from './slopes.ts';
import { stripsFits } from './common.ts';

type Variant = 'rope' | 'zip' | 'cart' | 'gondola';

defineGimmick({
  id: 'atrium', name: '吹き抜けを渡る部屋', axes: ['move'], kinds: ['room', 'hall'], minSize: [5.2, 8.0], minHeight: 2.6, weight: 2, intensity: 2, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning, y = s.cell.floorY, h = s.cell.height;
    const depth = t['move.atrium.depthM'];
    const plan = planPit(ctx, { depth, strips: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const side = laneSide(plan);
    const vt = F.depth - landD;
    // 出口の床へ上る階段（入口の階段と反対の横の壁沿い。出口の床から入口の側へ下りる）
    const riseMax = t['gimmick.pit.stairRise'], tread = t['gimmick.pit.stairTread'];
    const n = Math.max(1, Math.ceil(depth / riseMax) - 1);
    const rise = depth / (n + 1);
    const SW = 1.1;
    const [xu0, xu1] = side.low ? [F.u1 - SW, F.u1] : [F.u0, F.u0 + SW];
    const xs0 = vt - n * tread;
    const freeLo = side.low ? side.hi + 0.4 : xu1 + 0.4, freeHi = side.low ? xu0 - 0.4 : side.lo - 0.4;
    if (freeHi - freeLo < 1.6 || xs0 < landD + 2.0) return;
    const su = (freeLo + freeHi) / 2;
    const span = vt - landD;
    // 乗り物を選ぶ（収まらない物は除く）
    const cartRun = depth / Math.tan((t['move.atrium.cartDeg'] * Math.PI) / 180);
    const ok: Variant[] = ['rope', 'zip'];
    if (span >= cartRun + 1.8) ok.push('cart');
    if (span >= 1.6 * 2 + 1.4 && freeHi - freeLo >= 1.8) ok.push('gondola');
    const v = ctx.rng.weighted(ok, (k) => t[`move.atrium.w.${k}`] + 1e-6);
    buildPit(ctx, plan);
    for (let j = 0; j < n; j++) {
      const top = -rise * (j + 1);
      const r = F.rect(xu0, vt - (j + 1) * tread, xu1, vt - j * tread);
      ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y + top, r.z1], s.cell.palette.floor));
    }
    const P = (u: number, vv: number, yy: number): Vec3 => { const [x, z] = F.point(u, vv); return [x, y + yy, z]; };
    const metal: MatId = 'metalDark';
    // 柱（乗り場の目印）: 床の縁の横に
    const post = (u: number, vv: number, top: number): void => {
      const [x, z] = F.point(u, vv);
      ctx.addBox(box([x - 0.07, y, z - 0.07], [x + 0.07, y + top, z + 0.07], metal));
    };
    if (v === 'rope') {
      const ry = Math.min(h - 0.25, 1.95);
      const a = P(su, landD - 0.45, ry), b = P(su, vt + 0.45, ry);
      ctx.addEntity('rope', { type: 'pathRide', params: { mode: 'rope', path: [a, b], foot: [0, -2.05, 0], speed: t['move.atrium.ropeSpeed'], startAt: P(su, landD - 0.6, 0), endAt: P(su, vt + 0.6, 0), range: 2.4 } });
      for (const vv of [landD - 0.2, vt + 0.2]) { post(su - 0.45, vv, ry + 0.1); post(su + 0.45, vv, ry + 0.1); }
    } else if (v === 'zip') {
      const top = Math.min(h - 0.2, 2.35);
      const endV = Math.max(landD + 2.2, xs0 - 0.8);
      const a = P(su, landD - 0.5, top), b = P(su, endV, -depth + 2.05);
      ctx.addEntity('zip', { type: 'pathRide', params: { mode: 'zip', path: [a, b], foot: [0, -2.05, 0], accel: t['move.atrium.zipAccel'], vmax: t['move.atrium.zipMax'], returnSec: 2.5, returnSpeed: 3, range: 2.6 } });
      post(su - 0.55, landD - 0.12, top + 0.1); post(su + 0.55, landD - 0.12, top + 0.1);
      // 終わりの車止め（底の柱）
      const [ex, ez] = F.point(su, endV + 0.45);
      ctx.addBox(box([ex - 0.25, y - depth, ez - 0.25], [ex + 0.25, y - depth + 0.9, ez + 0.25], 'plasticYellow'));
    } else if (v === 'cart') {
      const W = 1.2;
      const v0 = landD, v1 = landD + cartRun, v2 = Math.min(vt - 1.0, v1 + Math.max(1.2, span - cartRun - 1.0));
      slope(ctx, F, 'ramp', su - W / 2, su + W / 2, v0, v1, 0, -depth, -depth, 'metal', 'cart');
      // 坂と底の線路（見た目）
      const rail = (u: number): void => {
        const r = F.rect(u - 0.03, v1, u + 0.03, v2);
        ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y - depth + 0.04, r.z1], 'metal', false));
      };
      rail(su - 0.35); rail(su + 0.35);
      const path = [P(su, landD - 0.75, 0), P(su, v0, 0), P(su, v1, -depth), P(su, v2, -depth)];
      ctx.addEntity('cart', { type: 'pathRide', params: { mode: 'cart', path, foot: [0, 0.28, 0], vmax: t['move.atrium.cartMax'], vmin: 1.2, roll: 0.5, returnSec: 3, returnSpeed: 1.6, range: 2.4 } });
      const [bx, bz] = F.point(su, v2 + 0.55);
      ctx.addBox(box([bx - 0.6, y - depth, bz - 0.15], [bx + 0.6, y - depth + 0.5, bz + 0.15], 'plasticYellow'));
    } else {
      const half = 0.75;
      const alongX = Math.abs(F.point(0, 1)[0] - F.point(0, 0)[0]) > 0.5;
      const a = P(su, landD + half + 0.02, 0), b = P(su, vt - half - 0.02, 0);
      ctx.addEntity('car', { type: 'cableCar', params: { a, b, half, axis: alongX ? 0 : 2, wait: t['move.atrium.carWait'], travel: Math.max(4, span * 0.9), spin: Math.PI * 2, top: Math.min(h - 0.1, 2.6) } });
      // 乗り場の柵の切れ目の目印
      for (const vv of [landD - 0.15, vt + 0.15]) { post(su - half - 0.1, vv, 1.1); post(su + half + 0.1, vv, 1.1); }
    }
    // 吹き抜けの照明（底をぼんやり、上を明るく）
    const mid = P(su, (landD + vt) / 2, h - 0.5);
    s.cell.lights.push({ pos: mid, color: 0xfff0d8, intensity: 0.6, distance: Math.max(8, span * 1.2) });
    ctx.keepOut({ min: [plan.hole.x0, y - depth, plan.hole.z0], max: [plan.hole.x1, y + h, plan.hole.z1] });
  },
});
