/**
 * I02 荷物と待つ扉 [WS] + BI02 待つ扉で違う荷物を持って待つ → 別の扉。
 *
 * 配達の部屋: 壁際の棚に色の札の付いた荷物が 3 つ。別の壁に、色の札の付いた「受け取り口」（閉じた壁の前の床に黄色い枠）。
 * - 遊び方: 札と同じ色の荷物を持って枠の中で待つと、枠の灯りがだんだん満ちて、壁が開く（出現型・必ず付ける）
 * - 規則: 枠の灯りは、荷物を持って立っている間だけ満ちる（離れると最初から）。何も持たずに立っても何も起きない
 * - 隠し（裏）: 違う色の荷物を持って待つと、受け取り口ではなく別の壁の「返品口」が開く（出現型・付けば）
 * 運ばなくても部屋は普通に通れる（荷物の部屋は本道の上にあってよい）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { innerRect } from '../util.ts';
import { aabbJ, addItem, freeSpans, offer, onMainWall, wallBox, wallPoint } from './util.ts';

export const PARCEL_COLORS: { id: string; mat: MatId }[] = [
  { id: 'red', mat: 'plasticRed' }, { id: 'blue', mat: 'plasticBlue' }, { id: 'yellow', mat: 'plasticYellow' }, { id: 'green', mat: 'lightGreen' },
];

defineGimmick({
  id: 'parcelGate', name: '荷物と待つ扉', axes: ['carry'], kinds: ['room', 'hall'], minSize: [4.2, 5.2], weight: 0.4, intensity: 1, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const walls = ([0, 1, 2, 3] as Dir[]).map((d) => ({ d, spans: freeSpans(r, s.openings, d, 1.5, 0.8) })).filter((w) => w.spans.length);
    // 受け取り口: 入口の向かいの壁を先に。棚・返品口は残りの壁
    const ent = s.entrance!;
    const opp = ((ent.dir + 2) % 4) as Dir;
    const order = walls.slice().sort((a, b) => (a.d === opp ? -1 : 0) - (b.d === opp ? -1 : 0));
    const gate = order.find((w) => w.spans[0]!.a1 - w.spans[0]!.a0 >= 1.8);
    if (!gate) return;
    const gateAt = gate.spans[0]!.at;
    const rest = walls.filter((w) => w.d !== gate.d);
    const shelfW = rest.find((w) => w.spans[0]!.a1 - w.spans[0]!.a0 >= 1.8) ?? null;
    if (!shelfW) return;
    const backW = rest.find((w) => w !== shelfW) ?? null;
    // 返品口: 別の壁（無ければ受け取り口と同じ壁の離れた所）
    let back: { d: Dir; at: number } | null = backW ? { d: backW.d, at: backW.spans[0]!.at } : null;
    if (!back) {
      const sp = gate.spans[0]!;
      if (sp.a1 - sp.a0 >= 4.2) back = { d: gate.d, at: gateAt > (sp.a0 + sp.a1) / 2 ? sp.a0 + 0.7 : sp.a1 - 0.7 };
    }
    // 荷物の色: 3 つ。受け取り口の札はそのうち 1 つ
    const colors = ctx.rng.shuffle(PARCEL_COLORS.slice()).slice(0, 3);
    const want = colors[ctx.rng.int(0, 2)]!;
    // 棚（当たる）と荷物
    const sp = shelfW.spans[0]!;
    const len = Math.min(2.4, sp.a1 - sp.a0 - 0.2);
    const shelfAt = sp.at;
    ctx.addBox(wallBox(r, shelfW.d, shelfAt, len / 2, y, y + 0.88, 0.5, 'shelfMetal', true));
    ctx.addBox(wallBox(r, shelfW.d, shelfAt, len / 2 + 0.02, y + 0.86, y + 0.9, 0.52, 'metal', true));
    colors.forEach((c, i) => {
      const at = shelfAt + (i - 1) * Math.min(0.75, len / 3);
      const p = wallPoint(r, shelfW.d, at, 0.27, y + 0.9);
      addItem(ctx, `parcel${i}`, p, { half: [0.2, 0.15, 0.17], kind: 'parcel', tag: `parcel.${c.id}`, mat: 'boxCardboard', label: c.mat, yaw: (shelfW.d * Math.PI) / 2, weight: 2 });
    });
    // 受け取り口: 壁の札（色）・床の黄色い枠・枠の灯り（待つほど満ちる）
    ctx.addBox(wallBox(r, gate.d, gateAt, 0.6, y + 2.15, y + 2.32, 0.03, 'signPlate'));
    ctx.addBox(wallBox(r, gate.d, gateAt, 0.24, y + 2.17, y + 2.3, 0.04, want.mat));
    const f0 = wallPoint(r, gate.d, gateAt - 0.65, 0.1, y), f1 = wallPoint(r, gate.d, gateAt + 0.65, 1.5, y);
    const frame = { min: [Math.min(f0[0], f1[0]), y - 0.3, Math.min(f0[2], f1[2])], max: [Math.max(f0[0], f1[0]), y + 2, Math.max(f0[2], f1[2])] };
    for (const [a0, a1, v0, v1] of [[-0.65, 0.65, 0.1, 0.16], [-0.65, 0.65, 1.44, 1.5], [-0.65, -0.59, 0.1, 1.5], [0.59, 0.65, 0.1, 1.5]] as const) {
      const p = wallPoint(r, gate.d, gateAt + a0, v0, y), q = wallPoint(r, gate.d, gateAt + a1, v1, y);
      ctx.addBox(box([Math.min(p[0], q[0]), y, Math.min(p[2], q[2])], [Math.max(p[0], q[0]), y + 0.006, Math.max(p[2], q[2])], 'yellowLine', false));
    }
    const sec = ctx.tuning['carry.parcel.waitSec'];
    const sensor = ctx.addEntity('frame', { type: 'carrySensor', params: { aabb: frame, want: [`parcel.${want.id}`], sec, latch: true, glow: aabbJ({ min: [frame.min[0]! + 0.1, y, frame.min[2]! + 0.1], max: [frame.max[0]! - 0.1, y + 0.01, frame.max[2]! - 0.1] }) } });
    offer(ctx, { hook: 'carry.parcel.match', modes: ['appear'], weight: 1, required: true, revealOutput: `${sensor}.match`, doorway: { dir: gate.d, at: gateAt, y, width: 1.0, height: 2.0 }, tell: '受け取り口の色の札' });
    if (back) {
      ctx.addBox(wallBox(r, back.d, back.at, 0.35, y + 2.15, y + 2.3, 0.03, 'signPlate'));
      offer(ctx, { hook: 'carry.parcel.wrong', modes: ['appear'], weight: 0.8, revealOutput: `${sensor}.other`, doorway: { dir: back.d, at: back.at, y, width: 1.0, height: 2.0 }, tell: '札の無い返品口' });
    }
    ctx.keepOut({ min: [frame.min[0]! - 0.4, y - 0.1, frame.min[2]! - 0.4], max: [frame.max[0]! + 0.4, y + 2.6, frame.max[2]! + 0.4] });
    const s0 = wallPoint(r, shelfW.d, shelfAt - len / 2, 0, y), s1 = wallPoint(r, shelfW.d, shelfAt + len / 2, 1.5, y);
    ctx.keepOut({ min: [Math.min(s0[0], s1[0]) - 0.2, y - 0.1, Math.min(s0[2], s1[2]) - 0.2], max: [Math.max(s0[0], s1[0]) + 0.2, y + 2.6, Math.max(s0[2], s1[2]) + 0.2] });
    if (back) { const b0 = wallPoint(r, back.d, back.at - 0.8, 0, y), b1 = wallPoint(r, back.d, back.at + 0.8, 1.3, y); ctx.keepOut({ min: [Math.min(b0[0], b1[0]), y - 0.1, Math.min(b0[2], b1[2])], max: [Math.max(b0[0], b1[0]), y + 2.6, Math.max(b0[2], b1[2])] }); }
  },
});
