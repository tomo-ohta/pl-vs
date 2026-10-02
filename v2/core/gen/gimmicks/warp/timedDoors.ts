/**
 * 時間で入れ替わる扉（timedDoors: T04。F27 時間で変わる接続も同じ作り）。部品は warpAnteroom（扉 2 枚・行き先を時間で入れ替える）と warpPhaseLamp。
 *
 * 遊び方: 部屋の壁に並んだ 2 枚の扉。扉の上の細い灯りが、青と琥珀に光っている。青い灯りの扉は白い壁に青い帯の部屋へ、琥珀の灯りの扉は
 * 木の床と本棚の琥珀の部屋へ。periodSec 秒ごとに小さなチャイムが鳴り、2 枚の灯りの色が入れ替わる（行き先も入れ替わる）。
 * 同じ扉で 2 つの部屋へ行くと（入れ替わりに気づくと）、琥珀の部屋の奥の壁に隠しの扉が現れることがある（出現型）。
 * 閉じ込めない: 青い部屋・琥珀の部屋は、どちらも向かい合う 2 枚の扉で（いつ開けても）元の部屋の双子へ戻れる。
 *
 * 作り: 双子の部屋 4 つ（X→青・Y→琥珀・X→琥珀・Y→青）。組 0 は [X→0, Y→2]、組 1 は [X→3, Y→1]
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { DOOR_H, DOOR_W, WALL_T, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { attachToPod, buildAnteroom, anteroomFits, planAnteroom, type RoomCopy } from './anteroom.ts';
import { frontPoint, joinCells, makeFrame } from './pocket.ts';
import { buildThroughRoom } from './throughRoom.ts';

const BLUE = 0x5aa8ff, AMBER = 0xffb347;

defineGimmick({
  id: 'timedDoors', name: '時間で入れ替わる扉', axes: ['move', 'time'], kinds: ['room'], minSize: [4.2, 5.2], weight: WARP_TUNING['warp.timedDoors.weight'].default, intensity: 1,
  fits: (s) => anteroomFits(s, { count: 2, spacing: WARP_TUNING['warp.timedDoors.spacingM'].default }),
  offersSecret: true, onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const spacing = t['warp.timedDoors.spacingM'];
    const plan = planAnteroom(ctx, { count: 2, spacing });
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const C0 = ante.entry;
    const n = plan.pods[0]!.dir;
    const y = C0.cell.floorY;
    const H = Math.min(plan.host.height, 2.8);
    const f = makeFrame(C0.podOuts[0]!.pos, n);
    const p1 = C0.podOuts[1]!.pos, p0 = C0.podOuts[0]!.pos;
    const lv = f.p(0, 0, 1);
    const side = Math.sign((p1[0] - p0[0]) * (lv[0] - p0[0]) + (p1[2] - p0[2]) * (lv[2] - p0[2])) || 1;
    const D = 4.8, vb = 1.2 * side;
    const host = plan.host.id;
    // 青い部屋 A（C0 の X の向こう）と、180° 回した双子 C1（Y が A の扉 B）
    const A = buildThroughRoom(ctx, f, { id: `${host}~blue`, depth: D, width: 4.8, vb, floorY: y, height: H, style: 'blue' });
    attachToPod(ctx, C0, A.cell.id);
    const C1 = ante.addCopy({ from: plan.pods[1]!.pos, to: f.p(D, 0, vb), q: 2 }, 'a2', { entry: true });
    joinCells(ctx, C1.cell.id, A.cell.id, C1.podOuts[1]!.pos, C1.podOuts[1]!.dir, DOOR_W, DOOR_H, C1.pods[1]!);
    // 琥珀の部屋 B は横へ離して（双子の部屋どうしが重ならない距離）。C2 は Y が B の扉 A、C3 は 180° 回して X が B の扉 B
    const r = plan.host.footprint[0]!;
    const ext = Math.max(r.x1 - r.x0, r.z1 - r.z0) + spacing;
    const fb = makeFrame(f.p(0, 0, side * (2 * ext + 8)), n);
    const C2 = ante.addCopy({ from: plan.pods[1]!.pos, to: fb.p(0, 0, 0), q: 0 }, 'b1', { entry: true });
    const B = buildThroughRoom(ctx, fb, { id: `${host}~amber`, depth: D, width: 4.8, vb, floorY: y, height: H, style: 'amber' });
    joinCells(ctx, C2.cell.id, B.cell.id, C2.podOuts[1]!.pos, C2.podOuts[1]!.dir, DOOR_W, DOOR_H, C2.pods[1]!);
    const C3 = ante.addCopy({ from: plan.pods[0]!.pos, to: fb.p(D, 0, vb), q: 2 }, 'b2', { entry: true });
    joinCells(ctx, C3.cell.id, B.cell.id, C3.podOuts[0]!.pos, C3.podOuts[0]!.dir, DOOR_W, DOOR_H, C3.pods[0]!);
    // 行き先の色の灯り（部屋と双子の部屋の全部の扉の上。X は 組 0 で青・組 1 で琥珀、Y は逆）
    const colors = [[BLUE, AMBER], [AMBER, BLUE]];
    const lamp = (cell: string, pos: Vec3, dir: Dir, k: number, name: string): void => {
      const fp = frontPoint({ pos, dir }, WALL_T + 0.025);
      ctx.addEntity(name, { type: 'warpPhaseLamp', cell, params: { pos: [fp[0], pos[1] + DOOR_H + 0.07, fp[2]], dir, colors: colors[k]! }, inputs: { phase: `${ante.ctrl}.phase` } });
    };
    plan.pods.forEach((pd, k) => lamp(host, pd.pos, pd.dir, k, `tint${k}`));
    for (const c of [C0, C1, C2, C3] as RoomCopy[]) c.podOuts.forEach((po, k) => lamp(c.cell.id, po.pos, po.dir, k, `${c.cell.id.split('~').pop()}.tint${k}`));
    // 隠し: 琥珀の部屋の、扉 B の側の横の壁（奥の方）
    const v0 = Math.min(0, vb) - (4.8 - Math.abs(vb)) / 2, v1 = v0 + 4.8;
    const wallV = side > 0 ? v1 : v0;
    const sd = fb.dir(side > 0 ? 1 : 3) as Dir;
    const sp = fb.p(D - 0.85, 0, wallV);
    // 同じ扉で 2 つの部屋へ行くと（入れ替わりに気づくと）、琥珀の部屋の奥の壁に扉が現れる（現れるのは双子の部屋へ移した tick。見えない所で）
    ctx.offerSecret({ hook: 'timed.amber', modes: ['appear'], weight: t['warp.timedDoors.secretWeight'], revealOutput: `${ante.ctrl}.multi`, cell: B.cell.id, doorway: { dir: sd, at: sd === 0 || sd === 2 ? sp[0] : sp[2], y, width: 1.0, height: 2.0 }, tell: '同じ扉で、2 つの部屋へ行く' });
    // 歩く人の道順（組 0 のとき）: 双子の部屋のつながっていない扉 → 行き先の双子の部屋
    const links: Json[] = [
      { from: C0.cell.id, to: C2.cell.id, at: [...frontPoint(C0.podOuts[1]!, 0.75)], interact: C0.pods[1]! },
      { from: C2.cell.id, to: C0.cell.id, at: [...frontPoint(C2.podOuts[0]!, 0.75)], interact: C2.pods[0]! },
    ];
    ante.finish({ phase: { sec: t['warp.timedDoors.periodSec'], entries: [[0, 2], [3, 1]] }, warpLinks: links });
  },
});
