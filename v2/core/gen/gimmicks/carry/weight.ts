/**
 * I10 重さで開く: 壁際の床に蓋（床下収納）。離れた所の床に金属の板。板に重さが掛かっている間だけ蓋が開く（左右へずれる）。
 * - 規則（見て分かる）: 板に乗ると蓋が開き、降りると閉まる（板と蓋は 3.5 m 以上離れていて、走っても間に合わない）
 * - 遊び方: 重い木箱（板の重さに足りる）か、軽い箱を何個か板に載せると、蓋が開いたままになる。穴の階段を下りると、底の壁に扉（存在型）
 * - 閉じ込めない: 穴の中に人がいる間は蓋は閉まらない。穴は階段で上がれる
 */
import type { Rect } from '../../../world/footprint.ts';
import { box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { innerRect } from '../util.ts';
import { buildHatch, hatchSecret, planHatch } from './hatch.ts';
import { aabbJ, addItem, floorSpots, offer, onMainWall } from './util.ts';

defineGimmick({
  id: 'weightHatch', name: '重さで開く床', axes: ['carry', 'floor'], kinds: ['room', 'hall'], minSize: [5.2, 6.4], weight: 0.3, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const plan = planHatch(ctx);
    if (!plan) return;
    const H = plan.hole;
    const hc: [number, number] = [(H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2];
    // 板: 蓋から離れた床（開口の前を避ける）
    const far = (floorSpots(ctx, 12, { margin: 1.0, avoid: [H], gap: 0.5, doorD: 1.7 }) ?? []).filter((p) => Math.hypot(p[0] - hc[0], p[2] - hc[1]) > t['carry.weight.plateM'] + 1.0);
    if (!far.length) return;
    const pc = far.sort((a, b) => Math.hypot(b[0] - hc[0], b[2] - hc[1]) - Math.hypot(a[0] - hc[0], a[2] - hc[1]))[0]!;
    const plate: Rect = { x0: pc[0] - 0.5, x1: pc[0] + 0.5, z0: pc[2] - 0.5, z1: pc[2] + 0.5 };
    ctx.addBox(box([plate.x0, y, plate.z0], [plate.x1, y + 0.025, plate.z1], 'metal', false));
    ctx.addBox(box([plate.x0 + 0.06, y + 0.025, plate.z0 + 0.06], [plate.x1 - 0.06, y + 0.03, plate.z1 - 0.06], 'metalDark', false));
    const need = t['carry.weight.need'];
    const scale = ctx.addEntity('plate', { type: 'carryReceiver', params: { region: aabbJ({ min: [plate.x0 - 0.05, y - 0.2, plate.z0 - 0.05], max: [plate.x1 + 0.05, y + 1.2, plate.z1 + 0.05] }), mark: false } });
    const heavy = ctx.addEntity('heavy', { type: 'threshold', params: { min: need - 1e-6 }, inputs: { in: `${scale}.weight` } });
    const stand = ctx.addEntity('stand', { type: 'zoneSensor', params: { aabb: aabbJ({ min: [plate.x0, y - 0.2, plate.z0], max: [plate.x1, y + 1.0, plate.z1] }) } });
    const inPit = ctx.addEntity('inPit', { type: 'zoneSensor', params: { aabb: aabbJ({ min: [H.x0, y - plan.depth - 0.2, H.z0], max: [H.x1, y - 0.25, H.z1] }) } });
    const any = ctx.addEntity('any', { type: 'or', params: {}, inputs: { a: `${heavy}.out`, b: `${stand}.in`, c: `${inPit}.in` } });
    const open = ctx.addEntity('open', { type: 'timer', params: { onDelay: 0.15, offDelay: t['carry.weight.closeSec'] }, inputs: { in: `${any}.out` } });
    buildHatch(ctx, plan, 'mover', `${open}.out`);
    // 箱: 重い木箱 1 つ（足りる）と軽い箱 2 つ（足すと足りる）
    const spots = floorSpots(ctx, 3, { avoid: [H, plate], gap: 1.0, doorD: 1.6 });
    if (!spots) return;
    addItem(ctx, 'crate', spots[0]!, { half: [0.3, 0.27, 0.3], kind: 'parcel', tag: 'box.heavy', mat: 'woodPanel', label: 'metalDark', weight: need, yaw: 0 });
    for (let i = 1; i < 3; i++) addItem(ctx, `box${i}`, spots[i]!, { half: [0.2, 0.17, 0.2], kind: 'parcel', tag: 'box.light', mat: 'boxCardboard', weight: Math.ceil(need / 2), yaw: ctx.rng.float(0, Math.PI) });
    offer(ctx, hatchSecret(plan, y, 'carry.weight.hold', '板の上の擦れた跡'));
    ctx.keepOut({ min: [r.x0, y - 3, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});
