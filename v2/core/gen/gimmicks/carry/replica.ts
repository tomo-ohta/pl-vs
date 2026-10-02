/**
 * I08 物を置くと増える: 手前の部屋（隣の区画。無ければこの部屋の入口の脇）に、小さな台と、台に載せられそうな物（コップ・花瓶 …）。
 * 台に何か置いてから扉を開けると、この部屋の床一面に同じ物がずらりと並んでいる（並ぶのは部屋に誰もいない間に）。
 * 並んだ物の列の間に、壁の扉が現れる（出現型）。台から取ると、次に来たときには消えている。
 * どの持てる物でも置ける（水のバケツ・椅子・荷物 …。別の仕掛けの物を置くと、その物で埋まる）
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { doorZone, innerRect } from '../util.ts';
import { aabbJ, addItem, clueFloorSpot, freeSpans, mainRectOf, offer, onMainWall, snap, wallPoint } from './util.ts';

const SMALL: { kind: string; half: Vec3; mat: MatId }[] = [
  { kind: 'cup', half: [0.05, 0.06, 0.05], mat: 'paintWhite' },
  { kind: 'vase', half: [0.08, 0.13, 0.08], mat: 'plasticBlue' },
  { kind: 'plant', half: [0.12, 0.18, 0.12], mat: 'plantLeaf' },
  { kind: 'toy', half: [0.1, 0.14, 0.08], mat: 'plasticYellow' },
];

defineGimmick({
  id: 'replicaRoom', name: '物を置くと増える', axes: ['carry', 'sight'], kinds: ['room', 'hall'], minSize: [4.4, 5.2], weight: 0.3, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    // 台: 隣の区画（入口の向こうが先）。無ければこの部屋の入口の脇
    const near = clueFloorSpot(ctx, { minHops: 1, maxHops: 1 });
    let ped: { cell: string; pos: Vec3; own: boolean };
    if (near) ped = { cell: near.cell, pos: near.pos, own: false };
    else {
      const sp = freeSpans(r, s.openings, ent.dir, 0.8, 0.6)[0];
      if (!sp) return;
      const p = wallPoint(r, ent.dir, sp.at, 0.4, y);
      ped = { cell: s.cell.id, pos: [snap(p[0]), y, snap(p[2])], own: true };
    }
    const H = 0.85;
    const pb = box([ped.pos[0] - 0.2, ped.pos[1], ped.pos[2] - 0.2], [ped.pos[0] + 0.2, ped.pos[1] + H, ped.pos[2] + 0.2], 'marbleWhite');
    if (ped.own || !ctx.addToCell) ctx.addBox(pb); else ctx.addToCell(ped.cell, pb);
    const pedestal = ctx.addEntity('pedestal', { type: 'carryReceiver', cell: ped.cell, params: { slots: [{ pos: [ped.pos[0], ped.pos[1] + H, ped.pos[2]], r: 0.55 }], markMat: 'goldTrim', markM: 0.3 } });
    // 台の脇の小さな物（置けそうな物）
    const sm = ctx.rng.pick(SMALL);
    // 台の横（区画の内側・開口の前を避ける）
    const pcell = ped.own ? s.cell : ctx.clueCells?.().find((c) => c.cell.id === ped.cell)?.cell ?? s.cell;
    const pr = mainRectOf(pcell);
    const inner = { x0: pr.x0 + 0.4, z0: pr.z0 + 0.4, x1: pr.x1 - 0.4, z1: pr.z1 - 0.4 };
    const offs = ctx.rng.shuffle([[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]).map(([dx, dz]) => [ped.pos[0] + dx!, ped.pos[2] + dz!] as [number, number]);
    const tp = offs.find(([x, z]) => x > inner.x0 && x < inner.x1 && z > inner.z0 && z < inner.z1);
    if (!tp) return;
    addItem(ctx, 'thing', [tp[0], ped.pos[1], tp[1]], { half: sm.half, kind: sm.kind, tag: `thing.${sm.kind}`, mat: sm.mat, yaw: ctx.rng.float(-3, 3), cell: ped.cell });
    if (!ped.own && ctx.keepOutIn) ctx.keepOutIn(ped.cell, { min: [ped.pos[0] - 0.9, ped.pos[1] - 0.1, ped.pos[2] - 0.9], max: [ped.pos[0] + 0.9, ped.pos[1] + 2, ped.pos[2] + 0.9] });
    // 隠しの扉の壁
    const wall = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).filter((d) => d !== ent.dir).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 1.4, 0.9)[0] })).find((w) => w.sp);
    if (!wall) return;
    const dz = wall.d;
    const dp = wallPoint(r, dz, wall.sp!.at, 0.6, y);
    // 並べる所: 床の升目（開口の前・扉の前・台の周りを空ける）
    const zones = s.openings.map((o) => doorZone(o, y, 1.4, 0.4));
    const spots: number[][] = [];
    const pitch = ctx.tuning['carry.replica.pitchM'];
    for (let x = r.x0 + 0.45; x <= r.x1 - 0.45 + 1e-6; x += pitch) for (let z = r.z0 + 0.45; z <= r.z1 - 0.45 + 1e-6; z += pitch) {
      if (zones.some((a) => x > a.min[0] && x < a.max[0] && z > a.min[2] && z < a.max[2])) continue;
      if (Math.hypot(x - dp[0], z - dp[2]) < 1.1) continue;
      if (ped.own && Math.hypot(x - ped.pos[0], z - ped.pos[2]) < 1.0) continue;
      spots.push([snap(x), y, snap(z), 0]);
    }
    if (spots.length < 12) return;
    const field = ctx.addEntity('field', { type: 'replicaField', params: { from: pedestal, region: aabbJ({ min: [s.rect.x0, y - 0.3, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] }), spots: spots.slice(0, ctx.tuning['carry.replica.max']) } });
    offer(ctx, { hook: 'carry.replica', modes: ['appear'], weight: 1, revealOutput: `${field}.shown`, doorway: { dir: dz, at: wall.sp!.at, y, width: 1.0, height: 2.0 }, tell: '台の上の、何かが置かれていた丸い跡' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});
