/**
 * 部屋を横切る仕切りの装置（改札 D06・自動扉 D07・シャッター D08）。どれも入口の側と奥の側を仕切り、仕切りの決まった所だけを通れる。
 *
 * - ticketGates 改札: 部屋を横切る改札の列（腰の高さの機械と、近づくと開く扉）。通るたびに「少し別の駅」になる（駅名の看板・路線の色・
 *   時計が変わる）。1 つだけ × の付いた閉じた改札があり、しゃがんでバーの下をくぐると、知らない駅になって横の壁に出口が現れる
 *   （gate.under・出現型）
 * - autoDoors 自動扉: 部屋を横切るガラスの仕切りに自動扉が 2 つ。近づくと開くが、片方はたまに開かない（赤い灯り。もう片方へ回る）。
 *   横の壁に「故障中」の自動扉があり、前でしゃがんでいると（小さな物には反応する）開く（auto.crouch・出現型）
 * - shutterHall シャッター: 部屋を横切るシャッターが 2 枚、ゆっくり上下する（開いている間に通る・下りかけはしゃがんでくぐる。人の上では止まる）。
 *   横の壁に半分開いたまま止まったシャッター（物置）。しゃがんでくぐると隠し（shutter.side・存在型）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Json, type WallOpening } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, innerRect, wallFrame, type WallFrame } from '../util.ts';
import { botHint, enterAt, entranceFrame, onRectWall, openingAt, snap, type BotStepSpec } from './common.ts';

/** 入口の壁を手前にした座標で、奥行き v の線（仕切り）の手前（0）・奥（1）。線の近く（1.4 m）に開口があれば -1 */
function sideOf(F: WallFrame, o: WallOpening, v: number): number {
  const ov = F.v(o.pos[0], o.pos[2]);
  if (o.dir % 2 !== F.d % 2) return ov + o.width / 2 + 1.0 < v ? 0 : ov - o.width / 2 - 1.0 > v ? 1 : -1;
  return ov < v - 1.4 ? 0 : ov > v + 1.4 ? 1 : -1;
}

/** 仕切りの線 v を決める（入口の側と奥の側に開口が分かれ、線の近くに開口が無い）。置けなければ null */
function pickLine(ctx: GimmickContext, F: WallFrame, lo: number, hi: number): number | null {
  const s = ctx.slot;
  const cands: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += 0.1) if (s.openings.every((o) => sideOf(F, o, v) >= 0)) cands.push(snap(v));
  if (!cands.length) return null;
  const mid = (lo + hi) / 2;
  return cands.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]!;
}

/** 歩く人の手順: 仕切りの手前と奥の開口の組ごとに、通る所 u の手前（と、待つ出力）→ 奥 */
function crossHints(ctx: GimmickContext, F: WallFrame, v: number, laneOf: (a: WallOpening, b: WallOpening) => { u: number; until?: string; extra?: BotStepSpec[] } | null, depth = 0.9): Json[] {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const out: Json[] = [];
  for (const a of s.openings) for (const b of s.openings) {
    const sa = sideOf(F, a, v), sb = sideOf(F, b, v);
    if (a === b || sa === sb) continue;
    const lane = laneOf(a, b);
    if (!lane) continue;
    const near = F.point(lane.u, sa === 0 ? v - depth : v + depth), far = F.point(lane.u, sa === 0 ? v + depth : v - depth);
    const steps: BotStepSpec[] = [{ at: [near[0], y, near[1]], ...(lane.until ? { until: lane.until } : {}) }, ...(lane.extra ?? []), { at: [far[0], y, far[1]] }];
    out.push({ ...(botHint(steps, { enterAt: enterAt(a) }) as { [k: string]: Json }), exitAt: enterAt(b) });
  }
  return out;
}

/** 横の壁（入口の壁と直角）の、線 v から奥行き方向へ [v0, v1] の範囲に、幅 need の開口の無い所。壁の向きと、壁に沿った座標 */
function sideWallSpot(ctx: GimmickContext, F: WallFrame, v0: number, v1: number, need: number): { d: Dir; at: number } | null {
  const s = ctx.slot;
  if (v1 < v0) return null;
  const dirs = ctx.rng.shuffle((F.d % 2 === 0 ? [1, 3] : [0, 2]) as Dir[]);
  for (const d of dirs) {
    for (const v of ctx.rng.shuffle([0.25, 0.5, 0.75].map((k) => snap(v0 + (v1 - v0) * k)))) {
      const G = wallFrame(innerRect(s), d);
      const at = G.u(...F.point(F.u0, v));
      if (at - need / 2 < G.u0 + 0.3 || at + need / 2 > G.u1 - 0.3) continue;
      const clash = s.openings.some((o) => o.dir === d && Math.abs((d % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + need / 2 + 0.8);
      if (clash) continue;
      return { d, at: snap(at) };
    }
  }
  return null;
}

const STATIONS = ['日向台', '北浜町', '霧ヶ丘', '旧市場前', '白砂', '水門', '桜通', '東雲'];

defineGimmick({
  id: 'ticketGates', name: '改札', axes: ['puzzle', 'sight'], kinds: ['room', 'hall'], minSize: [4.4, 6.4], minHeight: 2.4, weight: 0.45, intensity: 0, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY, H = s.cell.height;
    if (!s.entrance || s.openings.some((o) => !onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const v = pickLine(ctx, F, 2.6, F.depth - 2.6);
    if (v === null) return;
    // 改札の列: 機械（幅 0.25・長さ 1.2・高さ 1.05）と通路（0.9）。端は背の高いガラスの柵
    const CAB = 0.25, LANE = 0.9, LEN = 1.2;
    const n = Math.floor((F.u1 - F.u0 - 0.6 - CAB) / (CAB + LANE));
    if (n < 3) return;
    const total = n * (CAB + LANE) + CAB;
    const u0 = snap((F.u0 + F.u1) / 2 - total / 2);
    const lanes: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = u0 + i * (CAB + LANE);
      const r = F.rect(a, v - LEN / 2, a + CAB, v + LEN / 2);
      ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + 1.05, r.z1], 'metalDark'));
      const top = F.rect(a + 0.03, v - LEN / 2 + 0.1, a + CAB - 0.03, v - LEN / 2 + 0.35);
      ctx.addBox(box([top.x0, y + 1.05, top.z0], [top.x1, y + 1.06, top.z1], 'ledBlue', false));
      if (i < n) lanes.push(a + CAB + LANE / 2);
    }
    for (const [a, b] of [[F.u0, u0], [u0 + total, F.u1]] as const) {
      if (b - a < 0.02) continue;
      const r = F.rect(a, v - 0.04, b, v + 0.04);
      ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + Math.min(2.2, H), r.z1], 'glass'));
      ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + 0.08, r.z1], 'metalDark'));
    }
    // × の付いた閉じた改札（腰の高さのバー。しゃがめばくぐれる）
    const xi = ctx.rng.chance(0.5) ? 0 : n - 1;
    const xu = lanes[xi]!;
    { const r = F.rect(xu - LANE / 2, v - 0.05, xu + LANE / 2, v + 0.05); ctx.addBox(box([r.x0, y + 0.95, r.z0], [r.x1, y + 1.05, r.z1], 'plasticRed')); }
    const laneRects = lanes.map((u) => { const r = F.rect(u - LANE / 2, v - LEN / 2, u + LANE / 2, v + LEN / 2); return [r.x0, r.z0, r.x1, r.z1]; });
    const mid = F.point((F.u0 + F.u1) / 2, v);
    const along: [number, number] = (() => { const a = F.point(0, 1), b = F.point(0, 0); return [a[0] - b[0], a[1] - b[1]]; })();
    const names = ctx.rng.shuffle([...STATIONS]);
    // 駅名の看板（仕切りの上、入口の側を向く）
    const sign = F.point((F.u0 + F.u1) / 2, v - 0.1);
    const gates = ctx.addEntity('gates', { type: 'ticketGates', params: { lanes: laneRects, cross: xi, line: [mid[0], y, mid[1]], along, names, sign: [sign[0], y + Math.min(2.45, H - 0.25), sign[1]], width: Math.min(2.4, total) } });
    // 隠し: 奥の側の横の壁（知らない駅の出口）
    const spot = sideWallSpot(ctx, F, v + 1.3, Math.min(F.depth - 1.0, v + 3.5), 1.0);
    const others = (a: WallOpening, b: WallOpening): { u: number } => {
      // 通る改札: 2 つの開口の真ん中に近い、× でない改札
      const ua = sideOf(F, a, v) >= 0 && a.dir % 2 === F.d % 2 ? openingAt(a) : (F.u0 + F.u1) / 2, ub = b.dir % 2 === F.d % 2 ? openingAt(b) : (F.u0 + F.u1) / 2;
      const want = (ua + ub) / 2;
      return { u: lanes.filter((_, i) => i !== xi).sort((p, q) => Math.abs(p - want) - Math.abs(q - want))[0]! };
    };
    const hints = crossHints(ctx, F, v, others, 1.2);
    if (spot) {
      for (const a of s.openings) {
        if (sideOf(F, a, v) !== 0) continue;
        const near = F.point(xu, v - 1.2), far = F.point(xu, v + 1.2);
        hints.push(botHint([{ at: [near[0], y, near[1]] }, { at: [far[0], y, far[1]] }], { enterAt: enterAt(a), only: 'secret' }));
      }
      ctx.offerSecret({ hook: 'gate.under', modes: ['appear'], weight: 1, revealOutput: `${gates}.other`, doorway: { dir: spot.d, at: spot.at, y, width: 1.0, height: 2.0 }, tell: '× の改札の向こうの、看板の無い出口' });
    }
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: hints } });
    const k = F.rect(F.u0, v - LEN / 2 - 1.3, F.u1, v + LEN / 2 + 1.3);
    ctx.keepOut({ min: [k.x0, y, k.z0], max: [k.x1, y + H, k.z1] });
  },
});

defineGimmick({
  id: 'autoDoors', name: '自動扉', axes: ['move', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.6, 6.0], minHeight: 2.4, weight: 0.45, intensity: 0, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY, H = s.cell.height;
    if (!s.entrance || s.openings.some((o) => !onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const v = pickLine(ctx, F, 2.4, F.depth - 2.4);
    if (v === null) return;
    const W = 1.2, DH = Math.min(2.2, H - 0.1);
    const ua = snap(F.u0 + (F.u1 - F.u0) * 0.27), ub = snap(F.u0 + (F.u1 - F.u0) * 0.73);
    if (ub - ua < W + 1.2) return;
    // ガラスの仕切り（扉の所を空ける）。扉の上は壁
    const cuts: [number, number][] = [[ua - W / 2, ua + W / 2], [ub - W / 2, ub + W / 2]];
    let cur = F.u0;
    for (const [a, b] of [...cuts, [F.u1, F.u1] as [number, number]]) {
      if (a - cur > 0.02) { const r = F.rect(cur, v - 0.04, a, v + 0.04); ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + H, r.z1], 'glass')); ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + 0.08, r.z1], 'metalDark')); }
      cur = b;
    }
    for (const [a, b] of cuts) { const r = F.rect(a, v - 0.06, b, v + 0.06); ctx.addBox(box([r.x0, y + DH, r.z0], [r.x1, y + H, r.z1], 'metalDark')); }
    // 自動扉: A はいつも開く・B はたまに開かない
    const door = (name: string, u: number, flaky: number): string => {
      const p = F.rect(u - W / 2, v - 0.03, u + W / 2, v + 0.03);
      const z = F.rect(u - W / 2 - 0.2, v - 1.5, u + W / 2 + 0.2, v + 1.5);
      return ctx.addEntity(name, { type: 'autoDoor', params: { panel: aabbJson({ min: [p.x0, y, p.z0], max: [p.x1, y + DH, p.z1] }), sensor: aabbJson({ min: [z.x0, y - 0.2, z.z0], max: [z.x1, y + 2, z.z1] }), flaky, slide: (F.d % 2 === 0 ? [1, 0, 0] : [0, 0, 1]) as Json } });
    };
    const flakyA = ctx.rng.chance(0.5);
    const A = door('doorA', ua, flakyA ? t['ground.auto.flaky'] : 0), B = door('doorB', ub, flakyA ? 0 : t['ground.auto.flaky']);
    const reliable = flakyA ? { u: ub, id: B } : { u: ua, id: A };
    const hints = crossHints(ctx, F, v, () => ({ u: reliable.u, until: `${reliable.id}.open` }), 1.0);
    // 隠し: 横の壁の「故障中」の自動扉（しゃがむと開く）
    const spot = ctx.rng.chance(0.5) ? sideWallSpot(ctx, F, 1.3, v - 1.4, 1.2) ?? sideWallSpot(ctx, F, v + 1.4, F.depth - 1.3, 1.2) : sideWallSpot(ctx, F, v + 1.4, F.depth - 1.3, 1.2) ?? sideWallSpot(ctx, F, 1.3, v - 1.4, 1.2);
    if (spot) {
      const G = wallFrame(innerRect(s), spot.d);
      const p = G.rect(spot.at - 0.55, 0.0, spot.at + 0.55, 0.05);
      const z = G.rect(spot.at - 0.6, 0, spot.at + 0.6, 1.2);
      const broken = ctx.addEntity('broken', { type: 'autoDoor', params: { panel: aabbJson({ min: [p.x0, y, p.z0], max: [p.x1, y + 2.0, p.z1] }), sensor: aabbJson({ min: [z.x0, y - 0.2, z.z0], max: [z.x1, y + 2, z.z1] }), crouchSec: t['ground.auto.crouchSec'], broken: true, slide: (spot.d % 2 === 0 ? [1, 0, 0] : [0, 0, 1]) as Json } });
      const st = G.point(spot.at, 0.6);
      const vs = F.v(st[0], st[1]);
      for (const a of s.openings) {
        const pre = sideOf(F, a, v) === (vs < v ? 0 : 1) ? [] : [{ at: ((): [number, number, number] => { const q = F.point(reliable.u, sideOf(F, a, v) === 0 ? v - 1.0 : v + 1.0); return [q[0], y, q[1]]; })(), until: `${reliable.id}.open` }, { at: ((): [number, number, number] => { const q = F.point(reliable.u, sideOf(F, a, v) === 0 ? v + 1.0 : v - 1.0); return [q[0], y, q[1]]; })() }];
        hints.push(botHint([...pre, { at: [st[0], y, st[1]], crouch: true, wait: 0.3, until: `${broken}.done` }], { enterAt: enterAt(a), only: 'secret' }));
      }
      ctx.offerSecret({ hook: 'auto.crouch', modes: ['appear'], weight: 1, revealOutput: `${broken}.done`, doorway: { dir: spot.d, at: spot.at, y, width: 1.0, height: 2.0 }, tell: '「故障中」の札の自動扉' });
      ctx.keepOut({ min: [Math.min(z.x0, z.x1), y, Math.min(z.z0, z.z1)], max: [Math.max(z.x0, z.x1), y + 2.5, Math.max(z.z0, z.z1)] });
    }
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: hints } });
    const k = F.rect(F.u0, v - 1.4, F.u1, v + 1.4);
    ctx.keepOut({ min: [k.x0, y, k.z0], max: [k.x1, y + H, k.z1] });
  },
});

defineGimmick({
  id: 'shutterHall', name: 'シャッター', axes: ['time', 'body'], kinds: ['room', 'hall'], minSize: [4.0, 7.6], minHeight: 2.4, weight: 0.6, intensity: 1, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY, H = s.cell.height;
    if (!s.entrance || s.openings.some((o) => !onRectWall(s, o))) return;
    const F = entranceFrame(s);
    // 2 枚のシャッターの線（奥行きの 1/3 と 2/3 の近く）
    const v1 = pickLine(ctx, F, 2.0, F.depth / 2 - 0.6), v2 = pickLine(ctx, F, F.depth / 2 + 0.6, F.depth - 2.0);
    if (v1 === null || v2 === null || v2 - v1 < 2.2) return;
    const top = Math.min(H, 2.6);
    const cyc = { open: t['ground.shutter.openSec'], down: t['ground.shutter.downSec'], closed: t['ground.shutter.closedSec'], up: t['ground.shutter.upSec'] };
    const period = cyc.open + cyc.down + cyc.closed + cyc.up;
    const base = ctx.rng.float(0, period);
    const ids: string[] = [];
    for (const [k, v] of [v1, v2].entries()) {
      const r = F.rect(F.u0, v - 0.05, F.u1, v + 0.05);
      // シャッターの箱（上の巻き取り）と、両脇のレール
      { const q = F.rect(F.u0, v - 0.18, F.u1, v + 0.18); ctx.addBox(box([q.x0, y + top, q.z0], [q.x1, y + H, q.z1], 'metalDark')); }
      for (const u of [F.u0, F.u1 - 0.06]) { const q = F.rect(u, v - 0.08, u + 0.06, v + 0.08); ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + top, q.z1], 'metal', false)); }
      { const q = F.rect(F.u0, v - 0.45, F.u1, v - 0.37); ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + 0.004, q.z1], 'yellowLine', false)); }
      { const q = F.rect(F.u0, v + 0.37, F.u1, v + 0.45); ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + 0.004, q.z1], 'yellowLine', false)); }
      ids.push(ctx.addEntity(`sh${k}`, { type: 'shutter', params: { box: aabbJson({ min: [r.x0, y, r.z0], max: [r.x1, y + top, r.z1] }), ...cyc, offset: (base + k * period * 0.45) % period, need: t['ground.shutter.needSec'], axis: F.d % 2 === 0 ? 'x' : 'z' } }));
    }
    // 歩く人: 渡るシャッターの手前で、しばらく開いているのを待つ
    const hints: Json[] = [];
    for (const a of s.openings) for (const b of s.openings) {
      if (a === b) continue;
      const va = F.v(a.pos[0], a.pos[2]), vb = F.v(b.pos[0], b.pos[2]);
      const lane = b.dir % 2 === F.d % 2 ? openingAt(b) : a.dir % 2 === F.d % 2 ? openingAt(a) : (F.u0 + F.u1) / 2;
      const u = Math.min(F.u1 - 0.6, Math.max(F.u0 + 0.6, lane));
      const steps: BotStepSpec[] = [];
      const lines = [v1, v2].map((v, k) => ({ v, k })).filter(({ v }) => (va < v) !== (vb < v));
      if (va > vb) lines.reverse();
      for (const { v, k } of lines) {
        const fw = vb > va ? 1 : -1;
        const p = F.point(u, v - fw * 0.9), q = F.point(u, v + fw * 0.9);
        steps.push({ at: [p[0], y, p[1]], until: `${ids[k]}.passable` }, { at: [q[0], y, q[1]] });
      }
      if (steps.length) hints.push({ ...(botHint(steps, { enterAt: enterAt(a) }) as { [k: string]: Json }), exitAt: enterAt(b) });
    }
    // 隠し: 横の壁の、半分開いたまま止まったシャッター（しゃがんでくぐる）
    const spot = sideWallSpot(ctx, F, v1 + 1.0, v2 - 1.0, 1.2);
    if (spot) {
      const G = wallFrame(innerRect(s), spot.d);
      const q = G.rect(spot.at - 0.6, 0, spot.at + 0.6, 0.06);
      ctx.addBox(box([q.x0, y + 0.95, q.z0], [q.x1, y + 2.2, q.z1], 'redShutter'));
      const q2 = G.rect(spot.at - 0.7, 0, spot.at + 0.7, 0.2);
      ctx.addBox(box([q2.x0, y + 2.2, q2.z0], [q2.x1, y + 2.45, q2.z1], 'metalDark', false));
      ctx.offerSecret({ hook: 'shutter.side', modes: ['present'], weight: 1, doorway: { dir: spot.d, at: spot.at, y, width: 1.0, height: 2.0 }, tell: '半分開いたまま止まった物置のシャッター' });
      const z = G.rect(spot.at - 0.8, 0, spot.at + 0.8, 1.4);
      ctx.keepOut({ min: [z.x0, y, z.z0], max: [z.x1, y + 2.5, z.z1] });
    }
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: hints } });
    for (const v of [v1, v2]) { const k = F.rect(F.u0, v - 1.3, F.u1, v + 1.3); ctx.keepOut({ min: [k.x0, y, k.z0], max: [k.x1, y + H, k.z1] }); }
  },
});
