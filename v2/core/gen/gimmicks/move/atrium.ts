/**
 * 吹き抜けを渡る部屋（atrium）。部屋の床ほぼ全体が、底の見えない落ちる穴（14 章。pit.ts の planPit: 入口・出口の壁沿いの固い床）。
 * 穴は走って跳んでも届かない幅で、階段も無い: 穴の上を渡る乗り物を使わないと向こうへ行けない（落ちたら 1 つ下の階へ）:
 *
 * - rope ロープ渡り [M16]: 入口の床から出口の床へ張ったロープ。どちらの端でも調べてつかまり、両手でゆっくり進む（跳ぶと手を離して落ちる）
 * - zip ジップライン [M17]: 行きと帰りの 2 本。高い端の取っ手につかまると、吹き抜けを滑り下りて向こうの床へ（取っ手はしばらくで戻る）
 * - cart 台車に乗る [M29]: 穴に渡した線路の上の台車。どちらの端でも乗れ、押されて向こうの床まで走る。向こうの乗り場で待っていると
 *   空の台車がこちらへ来る
 * - gondola ゴンドラ [M30]: 入口の床と出口の床の間を行き来する小さな箱。動いている間、床がゆっくり 1 回転する（景色が回る）
 *
 * どの乗り物も両方の向きに渡れる（区域の入口どうしを、この部屋がどちら向きにもつなぐ）
 */
import type { Vec3 } from '../../../math/vec.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { buildPit, planPit } from '../pit.ts';
import { defineGimmick } from '../types.ts';
import { stripsFits } from './common.ts';
import { botHint, type BotStepSpec } from '../ground/common.ts';

type Variant = 'rope' | 'zip' | 'cart' | 'gondola';

defineGimmick({
  id: 'atrium', name: '吹き抜けを渡る部屋', axes: ['move'], kinds: ['room', 'hall'], minSize: [5.2, 9.0], minHeight: 2.6, weight: 1.4, intensity: 2, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning, y = s.cell.floorY, h = s.cell.height;
    const depth = t['move.atrium.depthM'];
    const plan = planPit(ctx, { depth, strips: true, drop: true, soffit: false });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const vt = F.depth - landD;
    const freeLo = F.u0 + 0.8, freeHi = F.u1 - 0.8;
    if (freeHi - freeLo < 1.6) return;
    const su = (freeLo + freeHi) / 2;
    const span = vt - landD;
    // 乗り物を選ぶ（収まらない物は除く）
    const ok: Variant[] = ['rope', 'zip', 'cart'];
    if (span >= 1.6 * 2 + 1.4 && freeHi - freeLo >= 1.8) ok.push('gondola');
    const v = ctx.rng.weighted(ok, (k) => t[`move.atrium.w.${k}`] + 1e-6);
    buildPit(ctx, plan);
    const P = (u: number, vv: number, yy: number): Vec3 => { const [x, z] = F.point(u, vv); return [x, y + yy, z]; };
    // 歩く人（試験）の渡り方: 入口から入ったとき（fwd）と、出口から入ったとき（back）
    const route = (fwd: BotStepSpec[], back: BotStepSpec[]): void => {
      const e = s.entrance!.pos, x = s.exit!.pos;
      ctx.addEntity('route', { type: 'constant', params: { value: 0, bot: [botHint(fwd, { enterAt: [e[0], e[2]], exitAt: [x[0], x[2]] }), botHint(back, { enterAt: [x[0], x[2]], exitAt: [e[0], e[2]] })] } });
    };
    const metal: MatId = 'metalDark';
    // 柱（乗り場の目印）: 床の縁の横に
    const post = (u: number, vv: number, top: number): void => {
      const [x, z] = F.point(u, vv);
      ctx.addBox(box([x - 0.07, y, z - 0.07], [x + 0.07, y + top, z + 0.07], metal));
    };
    if (v === 'rope') {
      const ry = Math.min(h - 0.25, 1.95);
      const a = P(su, landD - 0.45, ry), b = P(su, vt + 0.45, ry);
      const rope = ctx.addEntity('rope', { type: 'pathRide', params: { mode: 'rope', path: [a, b], foot: [0, -2.05, 0], speed: t['move.atrium.ropeSpeed'], startAt: P(su, landD - 0.6, 0), endAt: P(su, vt + 0.6, 0), range: 2.4 } });
      // 歩く人（試験）: つかまって、向こうへ進み続ける
      const yaw = Math.atan2(-(b[0] - a[0]), -(b[2] - a[2]));
      route([{ at: P(su, landD - 0.6, 0), look: a, wait: 0.3, until: `${rope}.done`, hold: [yaw, 1] }],
        [{ at: P(su, vt + 0.6, 0), look: b, wait: 0.3, until: `${rope}.done`, hold: [yaw + Math.PI, 1] }]);
      for (const vv of [landD - 0.2, vt + 0.2]) { post(su - 0.45, vv, ry + 0.1); post(su + 0.45, vv, ry + 0.1); }
    } else if (v === 'zip') {
      // 行き（入口の床の高い所から出口の床へ）と帰り（出口の床の高い所から入口の床へ）の 2 本。足が向こうの床に着く
      const top = Math.min(h - 0.2, 2.6);
      const line = (u: number, from: number, to: number, name: string): string => {
        const a = P(u, from, top), b = P(u, to, 2.05);
        return ctx.addEntity(name, { type: 'pathRide', params: { mode: 'zip', path: [a, b], foot: [0, -2.05, 0], accel: t['move.atrium.zipAccel'], vmax: t['move.atrium.zipMax'], returnSec: 2.5, returnSpeed: 3, range: 2.6 } });
      };
      const du = Math.min(0.75, (freeHi - freeLo) / 2 - 0.55);
      const ua = su - du, ub = su + du;
      const zipA = line(ua, landD - 0.5, vt + 0.55, 'zip'), zipB = line(ub, vt + 0.5, landD - 0.55, 'zipBack');
      route([{ at: P(ua, landD - 0.75, 0), look: P(ua, landD - 0.5, top), wait: 0.3, until: `${zipA}.done` }],
        [{ at: P(ub, vt + 0.75, 0), look: P(ub, vt + 0.5, top), wait: 0.3, until: `${zipB}.done` }]);
      for (const [u, hi, lo] of [[ua, landD, vt], [ub, vt, landD]] as const) {
        const sg = hi < lo ? -1 : 1;
        post(u - 0.4, hi + sg * 0.12, top + 0.1); post(u + 0.4, hi + sg * 0.12, top + 0.1);
        post(u - 0.4, lo - sg * 0.12, 2.25); post(u + 0.4, lo - sg * 0.12, 2.25);
      }
    } else if (v === 'cart') {
      // 穴に渡した線路（見た目。歩いては渡れない細い 2 本）の上を、台車が出口の床まで転がる
      const rail = (u: number): void => {
        const r = F.rect(u - 0.03, landD - 0.4, u + 0.03, vt + 0.4);
        ctx.addBox(box([r.x0, y - 0.06, r.z0], [r.x1, y - 0.02, r.z1], 'metal', false));
      };
      rail(su - 0.35); rail(su + 0.35);
      const path = [P(su, landD - 0.75, 0), P(su, landD + 0.2, 0), P(su, vt - 0.2, 0), P(su, vt + 0.75, 0)];
      const cart = ctx.addEntity('cart', { type: 'pathRide', params: { mode: 'cart', both: true, path, foot: [0, 0.28, 0], vmax: t['move.atrium.cartMax'], accel: t['move.atrium.cartAccel'], returnSec: 2, returnSpeed: 2.4, callM: 2.4, range: 2.4 } });
      const c0 = path[0]!, c1 = path[path.length - 1]!;
      // 歩く人（試験）: 台車がこちらの端に来るのを待って乗り、向こうの端に着くのを待つ
      route([{ at: P(su, landD - 1.3, 0), until: `${cart}.atA` }, { at: P(su, landD - 1.3, 0), look: [c0[0], c0[1] + 0.5, c0[2]], wait: 0.3, until: `${cart}.done` }],
        [{ at: P(su, vt + 1.3, 0), until: `${cart}.atB` }, { at: P(su, vt + 1.3, 0), look: [c1[0], c1[1] + 0.5, c1[2]], wait: 0.3, until: `${cart}.done` }]);
    } else {
      const half = 0.75;
      const alongX = Math.abs(F.point(0, 1)[0] - F.point(0, 0)[0]) > 0.5;
      const a = P(su, landD + half + 0.02, 0), b = P(su, vt - half - 0.02, 0);
      const car = ctx.addEntity('car', { type: 'cableCar', params: { a, b, half, axis: alongX ? 0 : 2, wait: t['move.atrium.carWait'], travel: Math.max(4, span * 0.9), spin: Math.PI * 2, top: Math.min(h - 0.1, 2.6) } });
      // 箱が乗り場に来るのを待って乗り、向こうの乗り場に着くのを待つ
      route([{ at: P(su, landD - 0.5, 0), until: `${car}.atA` }, { at: a, wait: 1.0, until: `${car}.atB` }],
        [{ at: P(su, vt + 0.5, 0), until: `${car}.atB` }, { at: b, wait: 1.0, until: `${car}.atA` }]);
      // 乗り場の柵の切れ目の目印
      for (const vv of [landD - 0.15, vt + 0.15]) { post(su - half - 0.1, vv, 1.1); post(su + half + 0.1, vv, 1.1); }
    }
    // 吹き抜けの照明（底をぼんやり、上を明るく）
    const mid = P(su, (landD + vt) / 2, h - 0.5);
    s.cell.lights.push({ pos: mid, color: 0xfff0d8, intensity: 0.6, distance: Math.max(8, span * 1.2) });
    ctx.keepOut({ min: [plan.hole.x0, y - depth, plan.hole.z0], max: [plan.hole.x1, y + h, plan.hole.z1] });
  },
});
