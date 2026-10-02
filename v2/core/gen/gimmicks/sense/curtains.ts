/**
 * 幕の部屋（段階 4・担当 sense）。出口の壁の手前に、厚い幕の下がった 3 つの口のある仕切り壁。幕の向こうは見えない。
 * 本物の口だけが出口へ通じ、ほかの口の奥は小さな袋小路で、入ると暗転して部屋の入口へ戻される（「扉が元の所へつながっていた」）。
 * どの口が本物かは、規則を知った人にだけ分かる手がかりで示す:
 *
 * - glowCurtains 暗闇で光る印 [L14]: 真っ暗な部屋。床に蓄光の矢印が並び、本物の口へ導く。矢印は懐中電灯を消している間だけ見える
 *     （点けると光に紛れて見えない）。
 *     裏の振る舞い [BL04]: 懐中電灯を消すと、横の壁に光る手形が浮かぶ。手形の壁に隠しの扉
 *     （存在型 = 最初からある・出現型 = 懐中電灯を消して手形の前に 2 秒いると壁が開く）
 * - blindCurtains 目を閉じる [O11]: ふつうの明るさの部屋。目を閉じる（真下を見て止まる）と画面が暗くなり、本物の口の奥から鈴の音が聞こえる
 *
 * 試験の歩く人は、形から出口への道を探すので本物の口を通る（袋小路の奥は出口へ通じない）
 */
import { box, type Box } from '../../../world/layout.ts';
import type { Rect } from '../../../world/footprint.ts';
import { defineGimmick, type GimmickContext, type GimmickSlot } from '../types.ts';
import { aabbJson, freeWallSpan, frontOf, innerRect, wallFrame } from '../util.ts';
import { darkenRoom, roomRegion, wallPoint } from './util.ts';

const DEPTH = 1.45, T = 0.1, OPEN = 0.9;

/** 置けるか: 入口が出口の壁に無く、出口の壁から 2.4 m より離れている。出口の壁の幅が 4.6 m 以上 */
function fitsCurtains(s: GimmickSlot): boolean {
  if (!s.entrance || !s.exit || s.entrance.dir === s.exit.dir) return false;
  const r = innerRect(s);
  const F = wallFrame(r, s.exit.dir);
  if (F.u1 - F.u0 < 4.6 || F.depth < 5) return false;
  return s.openings.every((o) => o === s.exit || F.v(o.pos[0], o.pos[2]) > DEPTH + 1.0 || o.dir === ((s.exit!.dir + 2) % 4));
}

interface CurtainPlan { right: number; us: number[]; alcoves: Rect[]; cross: number[][]; }

/** 仕切り壁・幕・袋小路を作る。戻り値は口の位置（壁に沿った u）と、本物の口の番号 */
function buildCurtains(ctx: GimmickContext): CurtainPlan | null {
  const s = ctx.slot, t = ctx.tuning;
  const y = s.cell.floorY, H = s.cell.height;
  const r = innerRect(s);
  const ex = s.exit!;
  const F = wallFrame(r, ex.dir);
  const ux = F.u(ex.pos[0], ex.pos[2]);
  const step = t['sense.curtains.spacingM'];
  // 口の位置: 出口の正面（本物）と、その両側か片側に 2 つ
  const cands = [ux - 2 * step, ux - step, ux + step, ux + 2 * step].filter((u) => u - OPEN / 2 - 0.35 >= F.u0 && u + OPEN / 2 + 0.35 <= F.u1);
  const near = cands.sort((a, b) => Math.abs(a - ux) - Math.abs(b - ux)).slice(0, 2);
  if (near.length < 2) return null;
  const us = [ux, ...near].sort((a, b) => a - b);
  // 並びをばらす: 本物の口を、3 つの口のどこに置くかは出口の位置で決まる（出口の正面）
  const right = us.indexOf(ux);
  const B: Box[] = [];
  const mat = s.cell.palette.wall;
  // 仕切り壁（天井まで）: 口を除いて
  let cur = F.u0;
  for (const u of us) {
    const a = u - OPEN / 2;
    if (a - cur > 0.02) { const q = F.rect(cur, DEPTH, a, DEPTH + T); B.push(box([q.x0, y, q.z0], [q.x1, y + H, q.z1], mat)); }
    // 口の上（垂れ壁）
    const top = F.rect(a, DEPTH, u + OPEN / 2, DEPTH + T);
    B.push(box([top.x0, y + 2.1, top.z0], [top.x1, y + H, top.z1], mat));
    cur = u + OPEN / 2;
  }
  if (F.u1 - cur > 0.02) { const q = F.rect(cur, DEPTH, F.u1, DEPTH + T); B.push(box([q.x0, y, q.z0], [q.x1, y + H, q.z1], mat)); }
  // 袋小路を分ける壁（出口の壁から仕切り壁まで。口と口の真ん中）
  const cuts = us.slice(1).map((u, i) => (u + us[i]!) / 2);
  for (const c of cuts) { const q = F.rect(c - T / 2, 0, c + T / 2, DEPTH); B.push(box([q.x0, y, q.z0], [q.x1, y + H, q.z1], mat)); }
  // 幕（当たらない。向こうが見えない）: 口ごと
  const curtainMat = ctx.rng.pick(['seatRed', 'upholstery', 'furnitureDark'] as const);
  for (const u of us) {
    const q = F.rect(u - OPEN / 2 + 0.02, DEPTH + 0.03, u + OPEN / 2 - 0.02, DEPTH + 0.07);
    const c = box([q.x0, y + 0.03, q.z0], [q.x1, y + 2.08, q.z1], curtainMat, false);
    c.kind = 'curtain';
    B.push(c);
  }
  for (const b of B) ctx.addBox(b);
  // 袋小路の範囲（u の区間 × 奥行き）
  const edges = [F.u0, ...cuts, F.u1];
  const alcoves = us.map((_u, i) => F.rect(edges[i]! + 0.05, 0.05, edges[i + 1]! - 0.05, DEPTH - 0.05));
  const ent = frontOf(s.entrance!, 1.0);
  const cross = [[ent[0], ent[2]], F.point(ux, DEPTH + 1.2), F.point(ux, 0.6)];
  return { right, us, alcoves, cross };
}

/** 袋小路に入ると入口へ戻す（暗転。描画は senseFx curtains が戻された合図で見せる） */
function wrongAlcoves(ctx: GimmickContext, p: CurtainPlan): string[] {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const ent = frontOf(s.entrance!, 0.8);
  const yaw = Math.atan2(-(ent[0] - s.entrance!.pos[0]), -(ent[2] - s.entrance!.pos[2]));
  const ids: string[] = [];
  p.alcoves.forEach((a, i) => {
    if (i === p.right) return;
    ids.push(ctx.addEntity(`wrong${i}`, { type: 'respawnZone', params: { aabb: aabbJson({ min: [a.x0, y - 0.2, a.z0], max: [a.x1, y + 2, a.z1] }), to: [ent[0], y + 0.02, ent[2]], toYaw: yaw } }));
  });
  return ids;
}

defineGimmick({
  id: 'glowCurtains', name: '暗闇で光る印', axes: ['light', 'sight'], kinds: ['room', 'hall'], minSize: [4.6, 5], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: true,
  fits: fitsCurtains,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const plan = buildCurtains(ctx);
    if (!plan) return;
    darkenRoom(ctx);
    const wrong = wrongAlcoves(ctx, plan);
    // 矢印: 入口の前から本物の口の前まで、1.3 m ごと
    const marks: number[][] = [];
    const [a, b] = [plan.cross[0]!, plan.cross[1]!];
    const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
    const n = Math.max(2, Math.floor(len / 1.3));
    for (let i = 1; i <= n; i++) marks.push([a[0]! + ((b[0]! - a[0]!) * i) / n, a[1]! + ((b[1]! - a[1]!) * i) / n, Math.atan2(b[0]! - a[0]!, b[1]! - a[1]!)]);
    // 裏の振る舞い（BL04）: 横の壁の手形
    let hand: number[] | null = null;
    const sideDirs = ([0, 1, 2, 3] as const).filter((d) => d % 2 !== s.exit!.dir % 2 && !s.openings.some((o) => o.dir === d));
    for (const d of sideDirs) {
      const span = freeWallSpan(s, d, 1.6, 0.8);
      if (!span) continue;
      const [fx, fz] = wallPoint(ctx, d, span.at, 0.8);
      const zone = aabbJson({ min: [fx - 0.8, y - 0.1, fz - 0.8], max: [fx + 0.8, y + 2, fz + 0.8] });
      const dark = ctx.addEntity('handDark', { type: 'flashlightSensor', params: { region: zone, mode: 'off', sec: 2 } });
      hand = [d, span.at];
      ctx.offerSecret({ hook: 'glow.hand', modes: ['present', 'appear'], weight: 1, revealOutput: `${dark}.done`, doorway: { dir: d, at: span.at, y, width: 1.0, height: 2.0 }, tell: '懐中電灯を消すと浮かぶ、光る手形' });
      ctx.keepOut({ min: [fx - 0.8, y, fz - 0.8], max: [fx + 0.8, y + 2.5, fz + 0.8] });
      break;
    }
    ctx.addEntity('fx', { type: 'senseFx', params: { fx: 'curtains', hint: 'glow', marks, wrong, right: plan.right, us: plan.us, ...(hand ? { hand, wall: wallFace(ctx, hand[0] as 0 | 1 | 2 | 3), y } : {}), cross: plan.cross } });
    keepRoute(ctx, plan);
  },
});

defineGimmick({
  id: 'blindCurtains', name: '目を閉じる', axes: ['sound', 'sight'], kinds: ['room', 'hall'], minSize: [4.6, 5], weight: 0.3, intensity: 1, onMainPath: true,
  fits: fitsCurtains,
  build(ctx) {
    const s = ctx.slot;
    const plan = buildCurtains(ctx);
    if (!plan) return;
    const wrong = wrongAlcoves(ctx, plan);
    const F = wallFrame(innerRect(s), s.exit!.dir);
    const bell = F.point(plan.us[plan.right]!, 0.6);
    const eyes = ctx.addEntity('eyes', { type: 'gazeSensor', params: { region: roomRegion(s), mode: 'down', still: true, stillSec: 0.5, sec: 1.2, downPitch: -1.0 } });
    ctx.addEntity('fx', { type: 'senseFx', params: { fx: 'curtains', hint: 'listen', wrong, right: plan.right, us: plan.us, bell: [bell[0], s.cell.floorY + 1.4, bell[1]], eyes, cross: plan.cross } });
    keepRoute(ctx, plan);
  },
});

/** 壁 d の室内面の座標 */
function wallFace(ctx: GimmickContext, d: 0 | 1 | 2 | 3): number {
  const r = innerRect(ctx.slot);
  return d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
}

/** 仕切り壁の手前 1.2 m と、袋小路には家具を置かない */
function keepRoute(ctx: GimmickContext, _plan: CurtainPlan): void {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const F = wallFrame(innerRect(s), s.exit!.dir);
  const q = F.rect(F.u0, 0, F.u1, DEPTH + 1.4);
  ctx.keepOut({ min: [q.x0, y, q.z0], max: [q.x1, y + 3, q.z1] });

}
