/**
 * 遠ざかる廊下（recedingHall: W05。v1 E13 の発展）。
 *
 * 遊び方: 控え室の 3 枚目の扉の向こうに、すぐ先で行き止まる廊下（突き当たりに非常口の扉）。歩いて近づくほど突き当たりが遠ざかり、
 * 椅子・扉・照明が突き当たりの陰から次々に現れる（廊下が伸びていく）。残りの距離は歩いた分 × rate ずつ伸びるが、ある所まで歩くと
 * 偽の突き当たりが本物の突き当たりに重なって消え、あとは普通に近づく（歩けば必ず着く）。扉を開けると最初の部屋（の双子）。
 * 走っても同じ（位置だけで決まる）。戻ると近づく。閉じ込めない: 来た扉はいつでも開く。
 *
 * 作り: 廊下は hall.ts（霧なし）。偽の突き当たり（部品 warpRecede）は本物の突き当たり（奥の壁・扉・非常口の灯り）を写した物で、
 * 描画は同じ箱と扉の見た目を、ずれ off だけ手前に置く
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import { WALL_T, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { buildAnteroom, planAnteroom } from './anteroom.ts';
import { buildStraightHall } from './hall.ts';

defineGimmick({
  id: 'recedingHall', name: '遠ざかる廊下', axes: ['move', 'sight'], kinds: ['room'], minSize: [3.8, 3.8], weight: WARP_TUNING['warp.recede.weight'].default, intensity: 1,
  onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const plan = planAnteroom(ctx);
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const W = t['warp.recede.widthM'];
    const hall = buildStraightHall(ctx, ante, { startLen: 3, period: 12, periods: t['warp.recede.periods'], endLen: 5, width: W, height: t['warp.recede.heightM'] }, 'far');
    const { f, cell, length: Lh } = hall;
    // 本物の突き当たり: 奥の壁（扉の穴のまわり）と非常口の灯り。偽の突き当たりはこれを手前へずらして描く
    const fv = f.p(1, 0, 0), o = f.o;
    const ax = Math.abs(fv[0] - o[0]) > 0.5 ? 0 : 2;
    const sg = ax === 0 ? Math.sign(fv[0] - o[0]) : Math.sign(fv[2] - o[2]);
    const uOf = (v: number): number => (v - o[ax]) * sg;
    const endBoxes: Json[] = [];
    for (const b of cell.boxes) {
      const u0 = Math.min(uOf(b.min[ax]), uOf(b.max[ax])), u1 = Math.max(uOf(b.min[ax]), uOf(b.max[ax]));
      if (u0 >= Lh - WALL_T - 0.06 && u1 <= Lh + 1e-6) endBoxes.push({ min: [...b.min], max: [...b.max], mat: b.mat, solid: b.solid });
    }
    const wall = f.aabb(Lh - WALL_T, 0, -W / 2, Lh, cell.height, W / 2);
    const door = hall.exit.pod;
    ctx.addEntity('recede', {
      type: 'warpRecede', cell: cell.id,
      params: {
        origin: f.p(0, 0, 0), fwd: plan.pod.dir,
        box: (() => { const a = f.aabb(0.2, -0.5, -W / 2, Lh - 0.2, 3.0, W / 2); return { min: [...a.min], max: [...a.max] }; })(),
        start: Math.min(-1, t['warp.recede.startM'] - Lh), rate: t['warp.recede.rate'], from: 1,
        wall: { min: [...wall.min], max: [...wall.max] },
        boxes: endBoxes, door,
      },
    });
    ante.finish();
  },
});
