/**
 * 球に乗る部屋（ballRide）。入口の床から先の床一面が塗りたてのペンキ（「ペンキ塗りたて」の札。歩くととても遅い）。
 * 入口の床に置いてある大きな球に乗れば、ペンキの上を転がって速く渡れる（歩いても渡れる）。
 * - ball 玉乗り [M05]: 球の上に立って転がす（止まりにくい。速いまま壁にぶつかると振り落とされる）。
 *     隠し ball.slope [BM07]（出現型）: 横の壁際の、低い所へ下る坂を球に乗ったまま下りると、坂の下の壁に扉が開く
 * - bubble バブル [M06]: 透明な球の中に入って転がす（よく弾む）。
 *     隠し bubble.wall [BM08]（出現型）: 横の壁の、ひびの入った薄い所へ、バブルのまま何度も速くぶつかると割れて扉が開く
 */
import { box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, cutFloorSlab, innerRect } from '../util.ts';
import { pitShell } from '../pit.ts';
import { hallAabb, hallBox, hallOf, hallPoint, sideDir, wallAt } from './common.ts';
import { slope } from './slopes.ts';


defineGimmick({
  id: 'ballRide', name: '球に乗る部屋', axes: ['move', 'body'], kinds: ['room', 'hall'], minSize: [4.4, 7.0], minHeight: 2.6, weight: 0.6, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s, false);
    if (!H || H.W < 4.4 || H.L < 7) return;
    const bubble = ctx.rng.chance(t['move.ball.bubbleChance']);
    const R = bubble ? 0.85 : 0.55;
    const land = 1.4, v0 = land, v1 = H.L - 1.2;
    const y = H.y;
    // 球の置き場所: 入口の床の、扉の前を外した横
    const off = H.entU - H.F.u0 > H.F.u1 - H.entU ? -1 : 1;
    const bu = Math.min(H.F.u1 - R - 0.15, Math.max(H.F.u0 + R + 0.15, H.entU + off * (0.6 + R + 0.2)));
    const home = hallPoint(H, bu, Math.max(R + 0.15, land - R - 0.05), R);
    // 横の壁: 横の開口の無い側
    const sideFree = (hi: boolean): boolean => !s.openings.some((o) => o.dir === sideDir(H, hi));
    const hiFirst = ctx.rng.chance(0.5);
    const hi = sideFree(hiFirst) ? hiFirst : sideFree(!hiFirst) ? !hiFirst : null;
    let area: ReturnType<typeof hallAabb> | null = null;
    let thin: ReturnType<typeof hallAabb> | null = null;
    // 玉乗り: 横の壁際の低い所と坂
    if (!bubble && hi !== null) {
      const D = 0.9, AW = 1.6, ramp = 1.8;
      const va = v0 + 0.8, vb = Math.min(v1 - 0.4, va + 4.2);
      if (vb - va >= ramp + 1.5 && H.W >= AW + 2.8) {
        const wallU = hi ? H.F.u1 : H.F.u0;
        const au0 = hi ? wallU - AW : wallU, au1 = hi ? wallU : wallU + AW;
        const hole = H.F.rect(au0, va, au1, vb);
        cutFloorSlab(s, hole);
        pitShell(ctx, hole, D);
        slope(ctx, H.F, 'slope', au0, au1, va + 0.15, va + 0.15 + ramp, 0, -D, -D, 'woodPanel', 'paint');
        // 部屋の側の縁の低い手すり（坂の上の口だけ開いている）
        const ru = hi ? au0 : au1;
        ctx.addBox(hallBox(H, ru - 0.05, va + 0.15, ru + 0.05, vb, 0, 0.55, 'metalDark'));
        ctx.addBox(hallBox(H, au0, vb - 0.1, au1, vb, 0, 0.55, 'metalDark'));
        area = hallAabb(H, au0, va + 0.15 + ramp + 0.2, au1, vb - 0.15, -D - 0.1, -D + 1.2);
        const dir = sideDir(H, hi);
        ctx.offerSecret({ hook: 'ball.slope', modes: ['appear'], weight: 1.0, revealOutput: `${ctx.id}.ball.inArea`, doorway: { dir, at: wallAt(H, dir, wallU, (va + 0.15 + ramp + vb) / 2), y: y - D, width: 1.0, height: 2.0 }, floorY: y - D, tell: '坂の下の壁の前だけ、球の転がった跡が残る' });
      }
    }
    // バブル: 横の壁のひびの入った薄い所
    if (bubble && hi !== null) {
      const vm = (v0 + v1) / 2;
      const wallU = hi ? H.F.u1 : H.F.u0;
      thin = hallAabb(H, hi ? wallU - 0.02 : wallU - 0.4, vm - 0.7, hi ? wallU + 0.4 : wallU + 0.02, vm + 0.7, 0, 2.1);
      // ひび（壁の面の細い線）
      for (let i = 0; i < 6; i++) {
        const v = vm + ctx.rng.float(-0.55, 0.55), yy = ctx.rng.float(0.3, 1.8), len = ctx.rng.float(0.2, 0.5);
        const u = hi ? wallU - 0.006 : wallU;
        ctx.addBox(hallBox(H, u, v, u + 0.006, v + 0.012, yy, yy + len, 'shadowDecal', false));
      }
      const dir = sideDir(H, hi);
      ctx.offerSecret({ hook: 'bubble.wall', modes: ['appear'], weight: 1.0, revealOutput: `${ctx.id}.ball.broke`, doorway: { dir, at: wallAt(H, dir, wallU, vm), y, width: 1.0, height: 2.0 }, tell: '横の壁の一か所だけ、ひびが入って薄い' });
    }
    const inner = innerRect(s);
    ctx.addEntity('ball', {
      type: 'rollBall', params: {
        home, radius: R, mode: bubble ? 'in' : 'on', bounds: { x0: inner.x0, z0: inner.z0, x1: inner.x1, z1: inner.z1 },
        accel: bubble ? t['move.ball.bubbleAccel'] : t['move.ball.accel'], vmax: t['move.ball.vmax'], friction: bubble ? 0.4 : 0.55,
        throwSpeed: t['move.ball.throwSpeed'], hitSpeed: 1.5, hitsNeed: 3,
        ...(area ? { area: aabbJson(area) } : {}), ...(thin ? { thin: aabbJson(thin) } : {}),
      },
    });
    // 塗りたてのペンキの床（とても遅い）と、札
    const paint = H.F.rect(H.F.u0, v0, H.F.u1, v1);
    s.cell.zones.push({ kind: 'water', aabb: { min: [paint.x0, y - 0.1, paint.z0], max: [paint.x1, y + 0.6, paint.z1] }, params: { dry: true, slow: t['move.ball.paintSlow'], sink: 0.02 } });
    const pb = ctx.addBox(box([paint.x0, y + 0.001, paint.z0], [paint.x1, y + 0.004, paint.z1], 'plasticYellow', false));
    pb.kind = 'wetPaint';
    // 札（当たらない。球の通り道を塞がない）: 球と反対の横
    const signU = H.entU - off * 0.9;
    ctx.addBox(hallBox(H, signU - 0.02, v0 - 0.15, signU + 0.02, v0 - 0.11, 0, 0.9, 'metalDark', false));
    const sign = ctx.addBox(hallBox(H, signU - 0.25, v0 - 0.16, signU + 0.25, v0 - 0.15, 0.6, 0.95, 'signPlate', false));
    sign.kind = 'paintSign';
    ctx.keepOut(hallAabb(H, H.F.u0, 0.3, H.F.u1, H.L, -1.2, H.h));
  },
});
