/**
 * 2 つの扉が同じ部屋へ（twoDoors: W12。v1 MultiEdge の発展）。部品は warpAnteroom（扉 2 枚の控え室）。
 *
 * 遊び方: 部屋の壁に、並んだ 2 枚の扉（どちらも上に緑の灯り）。左の扉を開けると、赤い絨毯と緑の壁の居間（長椅子・テレビ・鉢植え）。
 * 戻って右の扉を開けると、同じ居間に反対側の壁から入る（さっき見た長椅子が、今度は向こうを向いている）。並んだ扉が、同じ部屋の両端につながる。
 * 居間を通り抜けて向かいの扉を出ると、もう一方の扉から元の部屋に出る（右から入ったら左から出る）。居間は 1 つだけ（何かを動かせば、どちらから入っても動いたまま）。
 *
 * 作り: 扉 2 枚の控え室。左の扉は真上の双子の部屋 H1 の左の扉へ（その向こうが居間の扉 A）、右の扉は H1 の向こう側に 180° 回して置いた
 * 双子の部屋 H2 の右の扉へ（その向こうが居間の扉 B）。H1 の右の扉・H2 の左の扉は、もう一方の双子の部屋へ移す（向こうに何も無いので）。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import { DOOR_H, DOOR_W, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { attachToPod, buildAnteroom, anteroomFits, planAnteroom } from './anteroom.ts';
import { frontPoint, joinCells, makeFrame } from './pocket.ts';
import { buildThroughRoom } from './throughRoom.ts';

defineGimmick({
  id: 'twoDoors', name: '2 つの扉が同じ部屋へ', axes: ['move', 'sight'], kinds: ['room'], minSize: [4.2, 5.2], weight: WARP_TUNING['warp.twoDoors.weight'].default, intensity: 1,
  fits: (s) => anteroomFits(s, { count: 2, spacing: WARP_TUNING['warp.twoDoors.spacingM'].default }),
  onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const spacing = t['warp.twoDoors.spacingM'];
    const plan = planAnteroom(ctx, { count: 2, spacing });
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const H1 = ante.entry;
    const n = plan.pods[0]!.dir;
    const y = H1.cell.floorY;
    const H = Math.min(plan.host.height, 2.8);
    // 居間 P: H1 の左の扉（pods[0]）の外。局所の座標 u = 外向き・v = 左。扉 A は u = 0・v = 0、扉 B は向かいの壁の v = vb
    const f = makeFrame(H1.podOuts[0]!.pos, n);
    // 右の扉（pods[1]）の向き: 局所の v の符号（pods[1] は pods[0] から spacing 離れた所）
    const p1 = H1.podOuts[1]!.pos, p0 = H1.podOuts[0]!.pos;
    const lv = f.p(0, 0, 1);
    const side = Math.sign((p1[0] - p0[0]) * (lv[0] - p0[0]) + (p1[2] - p0[2]) * (lv[2] - p0[2])) || 1;
    const Dp = t['warp.twoDoors.depthM'];
    const vb = 1.2 * side;
    const id = `${plan.host.id}~same`;
    buildThroughRoom(ctx, f, { id, depth: Dp, width: 4.8, vb, floorY: y, height: H, style: 'lounge' });
    attachToPod(ctx, H1, id);
    // H2: H を 180° 回して、右の扉（pods[1]）が居間の扉 B に来るように置く
    const H2 = ante.addCopy({ from: plan.pods[1]!.pos, to: f.p(Dp, 0, vb), q: 2 }, 'a2', { entry: true });
    joinCells(ctx, H2.cell.id, id, H2.podOuts[1]!.pos, H2.podOuts[1]!.dir, DOOR_W, DOOR_H, H2.pods[1]!);
    // 歩く人の道順: H1 の右の扉 → H2・H2 の左の扉 → H1
    const links: Json[] = [
      { from: H1.cell.id, to: H2.cell.id, at: [...frontPoint(H1.podOuts[1]!, 0.75)], interact: H1.pods[1]! },
      { from: H2.cell.id, to: H1.cell.id, at: [...frontPoint(H2.podOuts[0]!, 0.75)], interact: H2.pods[0]! },
    ];
    ante.finish({ entries: [0, 1], warpLinks: links });
  },
});
