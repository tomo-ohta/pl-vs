/**
 * 時間の仕掛け（段階 4・担当 sense）。
 *
 * - floodRise 増水 [T03]: 入口と出口の床の間が深い穴。穴の水が周期で満ちて引く。水に浮く木箱が一列に並び、満ちると床の高さまで浮いて
 *     向こう岸への道になる（引くと沈む）。泳げないので、頭まで浸かると入口へ戻される。水が満ちるのを待って渡る。
 *     裏の振る舞い [BM11]: 穴の横の壁の、床の高さの暗い口（水が引いていると手が届かない）。満ちたときだけ、口の前に浮く箱から入れる（存在型）
 * - rewindRoom 巻き戻る部屋 [T05]: 部屋は周期で巻き戻る（壁の時計が一回りすると、部屋の中の人は前に巻き戻ったときの場所へ戻り、レバーも戻る）。
 *     出口の扉は、奥の壁のレバーを引いている間だけ開く。巻き戻る前に、レバーを引いて扉を抜ける
 * - loopMinute 同じ 1 分のくり返し [T07]: 壁の時計は 11:59 の 1 分をくり返す。決まった秒に電話が鳴り、決まった秒に出口の鍵が開く。
 *     1 分が終わるときに部屋の中にいると、入口へ戻される（同じ 1 分の始まり）。鳴っている電話に出ると、隠しの扉が開く（出現型）
 * - closingTime 閉店のアナウンス [T10]: 細長い部屋の奥へ入ると閉店の放送が流れ、少しして入口の側から照明が区間ごとに消えていく。
 *     暗闇に捕まると入口へ戻る（照明は戻る）。消えていく闇より先に出口へ
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import type { Rect } from '../../../world/footprint.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, doorZone, frontOf, innerRect, mainAxis, rectD, rectGap, rectW } from '../util.ts';
import { addLever, buildPit, freeWalls, lightPit, roomRegion, wallBox, wallPoint } from './util.ts';

defineGimmick({
  id: 'floodRise', name: '増水', axes: ['time', 'floor'], kinds: ['room', 'hall'], minSize: [4.5, 6.5], weight: 0.4, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.cell.footprint.length === 1,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const D = t['sense.flood.depthM'];
    const plan = lightPit(ctx, D);
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const v0 = landD, v1 = F.depth - landD;
    const L = v1 - v0;
    if (L < 2.4) return;
    // 階段（横の壁沿い）の側を避け、もう片方の横の壁の近くに木箱の列（浮く箱を壁際に 1 つ置ける距離）
    const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)];
    const laneLow = Math.min(...lu) - F.u0 < F.u1 - Math.max(...lu);
    const wallU = laneLow ? F.u1 : F.u0, sg = laneLow ? -1 : 1;
    const C = 0.9, G = 0.3;
    const uRow = wallU + sg * (1.0 + G + C / 2);
    const laneEdge = laneLow ? Math.max(...lu) : Math.min(...lu);
    if (Math.abs(uRow - laneEdge) < C / 2 + 0.6) return;
    let n = Math.max(2, Math.floor((L + G) / (C + G)));
    let gap = (L - n * C) / (n + 1);
    while (gap > 0.34) { n++; gap = (L - n * C) / (n + 1); }
    if (gap < 0.05) return;
    const H = 0.6, FREE = 0.22;
    const crates: number[][] = [];
    const crateRects: Rect[] = [];
    for (let i = 0; i < n; i++) {
      const a = v0 + gap + i * (C + gap);
      const r = F.rect(uRow - C / 2, a, uRow + C / 2, a + C);
      crateRects.push(r);
      crates.push([r.x0, r.z0, r.x1, r.z1, H, FREE]);
    }
    const stairs = plan.solidTop.filter((q) => !plan.landings.some((l) => l.rect === q));
    if (crateRects.some((r) => stairs.some((q) => rectGap(q, r) < 0.4))) return;
    // 浮く箱（BM11）: 真ん中の木箱の横、横の壁際（壁の口の前）
    const mid = crateRects[Math.floor(n / 2)]!;
    const mv0 = Math.min(F.v(mid.x0, mid.z0), F.v(mid.x1, mid.z1));
    const side = F.rect(wallU, mv0 - 0.05, wallU + sg * 1.0, mv0 + C + 0.05);
    const alongX = F.d === 0 || F.d === 2;
    const sideDir: Dir = alongX ? (laneLow ? 1 : 3) : (laneLow ? 0 : 2);
    const sideAt = alongX ? (side.z0 + side.z1) / 2 : (side.x0 + side.x1) / 2;
    const withSide = !s.openings.some((o) => o.dir === sideDir);
    if (withSide) crates.push([side.x0, side.z0, side.x1, side.z1, H, FREE]);
    buildPit(ctx, plan);
    const ent = frontOf(s.entrance!, 0.8);
    const flood = ctx.addEntity('water', {
      type: 'flood',
      params: {
        bottom: y - D, top: y - FREE, low: t['sense.flood.lowSec'], rise: t['sense.flood.riseSec'], high: t['sense.flood.highSec'], drain: t['sense.flood.drainSec'],
        phase: ctx.rng.float(0, 24), crates, hole: [plan.hole.x0, plan.hole.z0, plan.hole.x1, plan.hole.z1], drown: t['sense.flood.drownSec'],
        to: [ent[0], y + 0.02, ent[2]], toYaw: Math.atan2(-(ent[0] - s.entrance!.pos[0]), -(ent[2] - s.entrance!.pos[2])),
        // 渡る列（入口の床の縁 → 出口の床の縁）。歩く人と描画が読む
        cross: [F.point(uRow, v0 - 0.45), F.point(uRow, v1 + 0.45)], y,
      },
    });
    void flood;
    // 到達判定: 満ちたときの箱の上を床として見る
    for (const c of crates) ctx.reachAssist(box([c[0]!, y - 0.12, c[1]!], [c[2]!, y, c[3]!], s.cell.palette.floor));
    ctx.keepOut({ min: [plan.hole.x0, y - D, plan.hole.z0], max: [plan.hole.x1, y + 2.6, plan.hole.z1] });
    if (withSide) ctx.offerSecret({ hook: 'flood.high', modes: ['present'], weight: 1.2, doorway: { dir: sideDir, at: sideAt, y, width: 1.0, height: 2.0 }, tell: '水が引いている間は届かない、穴の壁の暗い口' });
  },
});

defineGimmick({
  id: 'rewindRoom', name: '巻き戻る部屋', axes: ['time', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.5, 6], weight: 0.35, intensity: 2, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const door = ctx.doorAt(s.exit!);
    if (!door) return;
    const e = frontOf(s.entrance!, 0.8), x = frontOf(s.exit!, 0.8);
    // レバー: 入口と出口から遠い壁（回り道になる所）
    const far = (d: Dir, at: number): number => { const [px, pz] = wallPoint(ctx, d, at, 0.8); return Math.hypot(px - e[0], pz - e[2]) + Math.hypot(px - x[0], pz - x[2]); };
    const w = freeWalls(ctx, 1.2).filter((c) => c.d !== s.entrance!.dir && c.d !== s.exit!.dir).sort((p, q) => far(q.d, q.at) - far(p.d, p.at))[0];
    if (!w) return;
    const [lx, lz] = wallPoint(ctx, w.d, w.at, 0.8);
    const walk = (Math.abs(lx - e[0]) + Math.abs(lz - e[2]) + Math.abs(x[0] - lx) + Math.abs(x[2] - lz)) / 3.0 + 1.5;
    const period = Math.min(t['sense.rewind.maxSec'], Math.max(t['sense.rewind.minSec'], walk * t['sense.rewind.factor']));
    const rewind = `${ctx.id}.time`;
    const lever = addLever(ctx, 'lever', w.d, w.at, 'lever', 999, { rewind: true, door: door.id }, { reset: `${rewind}.pulse` });
    ctx.addEntity('time', { type: 'rewind', params: { region: roomRegion(s), period, phase: ctx.rng.float(0, period) } });
    const closed = ctx.addEntity('closed', { type: 'not', params: {}, inputs: { in: `${lever}.on` } });
    const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
    const lock = ctx.addEntity('lock', { type: 'and', params: {}, inputs: { a: `${closed}.out`, b: `${inside}.in` } });
    door.inputs = { ...(door.inputs ?? {}), lock: `${lock}.out` };
    // 壁の時計（入口の向かいの壁か、開口の無い壁）と、床の紙（巻き戻る間に散って、巻き戻ると元へ）
    const cw = freeWalls(ctx, 1.0).find((c) => c.d !== w.d) ?? w;
    const cy = y + Math.min(2.1, s.cell.height - 0.5);
    const [cx, cz] = wallPoint(ctx, cw.d, cw.d === w.d ? w.at + 0.9 : cw.at, 0.05);
    const r = innerRect(s, 0.8);
    const papers: number[][] = [];
    for (let i = 0; i < 7; i++) papers.push([ctx.rng.float(r.x0, r.x1), ctx.rng.float(r.z0, r.z1), ctx.rng.float(0, Math.PI * 2)]);
    ctx.addEntity('clock', { type: 'senseFx', params: { fx: 'rewindRoom', time: rewind, period, clock: [cx, cy, cz], dir: cw.d, papers, y } });
    ctx.keepOut(doorZone(s.exit!, y, 1.6, 0.5));
  },
});

defineGimmick({
  id: 'loopMinute', name: '同じ 1 分のくり返し', axes: ['time'], kinds: ['room', 'hall'], minSize: [4, 5], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const door = ctx.doorAt(s.exit!);
    if (!door) return;
    const walls = freeWalls(ctx, 1.2).filter((c) => c.d !== s.entrance!.dir);
    const pw = walls[0];
    if (!pw) return;
    const period = t['sense.loop.sec'];
    const e = frontOf(s.entrance!, 0.8);
    // 電話（壁掛け）
    const phone = wallBox(ctx, pw.d, pw.at, 0.11, y + 1.15, y + 1.45, 0, 0.12, 'furnitureDark');
    ctx.addBox(phone);
    ctx.addBox(wallBox(ctx, pw.d, pw.at, 0.04, y + 1.47, y + 1.53, 0.02, 0.1, 'furnitureDark'));
    const loop = ctx.addEntity('loop', {
      type: 'loopClock',
      params: {
        region: roomRegion(s), period, phase: ctx.rng.float(0, period), ring: [t['sense.loop.ringFrom'], t['sense.loop.ringTo']], open: [t['sense.loop.openFrom'], t['sense.loop.openTo']],
        phone: aabbJson(phone), to: [e[0], y + 0.02, e[2]], toYaw: Math.atan2(-(e[0] - s.entrance!.pos[0]), -(e[2] - s.entrance!.pos[2])), grace: 3, door: door.id,
      },
    });
    const closed = ctx.addEntity('closed', { type: 'not', params: {}, inputs: { in: `${loop}.open` } });
    const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
    const lock = ctx.addEntity('lock', { type: 'and', params: {}, inputs: { a: `${closed}.out`, b: `${inside}.in` } });
    door.inputs = { ...(door.inputs ?? {}), lock: `${lock}.out` };
    // 扉の上の灯り（鍵の開いている間は緑）
    const lamp = ctx.addEntity('lamp', { type: 'lamp', params: { on: false, rate: 12 }, inputs: { on: `${loop}.open` } });
    const top = frontOf(s.exit!, 0.04);
    const g = box([top[0] - 0.09, y + 2.2, top[2] - 0.09], [top[0] + 0.09, y + 2.3, top[2] + 0.09], 'lightGreen', false);
    g.kind = `lamp:${lamp}`;
    ctx.addBox(g);
    // 壁の時計（11:59:SS）: 電話と別の壁（無ければ電話の壁の脇）
    const cw = walls.find((c) => c.d !== pw.d) ?? pw;
    const [cx, cz] = wallPoint(ctx, cw.d, cw === pw ? pw.at + 0.9 : cw.at, 0.03);
    ctx.addEntity('clock', { type: 'senseFx', params: { fx: 'loopClock', loop, clock: [cx, y + Math.min(2.05, s.cell.height - 0.45), cz], dir: cw.d, phone: [(phone.min[0] + phone.max[0]) / 2, (phone.min[1] + phone.max[1]) / 2, (phone.min[2] + phone.max[2]) / 2] } });
    // 電話に出ると開く扉（電話の壁の脇か、別の壁）
    const sw = walls.find((c) => c.d !== pw.d && c.d !== cw.d) ?? null;
    if (sw) ctx.offerSecret({ hook: 'loop.phone', modes: ['appear'], weight: 1, revealOutput: `${loop}.answered`, doorway: { dir: sw.d, at: sw.at, y, width: 1.0, height: 2.0 }, tell: 'くり返す 1 分の中で鳴る電話' });
    const [fx, fz] = wallPoint(ctx, pw.d, pw.at, 0.7);
    ctx.keepOut({ min: [fx - 0.7, y, fz - 0.7], max: [fx + 0.7, y + 2.2, fz + 0.7] });
    ctx.keepOut(doorZone(s.exit!, y, 1.6, 0.5));
  },
});

defineGimmick({
  id: 'closingTime', name: '閉店のアナウンス', axes: ['light', 'time'], kinds: ['corridor', 'room', 'hall'], minSize: [1.4, 8], weight: 0.35, intensity: 2, onMainPath: true,
  // 細長い部屋: 入口と出口が長い向きの両端（向かい合う）
  fits: (s) => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4 && (s.entrance.dir % 2 === 0 ? rectD(s.rect) : rectW(s.rect)) >= 8,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const { axis, sign } = mainAxis(s);
    const a0 = axis === 'x' ? r.x0 : r.z0, a1 = axis === 'x' ? r.x1 : r.z1;
    const len = a1 - a0;
    const n = Math.max(4, Math.round(len / t['sense.closing.segmentM']));
    const seg = len / n;
    const start = sign > 0 ? a0 : a1;
    const closing = `${ctx.id}.closing`;
    const lamps: string[] = [];
    const pools: number[][] = [];
    for (let i = 0; i < n; i++) {
      const th = ctx.addEntity(`th${i}`, { type: 'threshold', params: { min: -1, max: i + 0.5 }, inputs: { in: `${closing}.step` } });
      lamps.push(ctx.addEntity(`lamp${i}`, { type: 'lamp', params: { on: true, rate: 9 }, inputs: { on: `${th}.out` } }));
      const p0 = start + sign * seg * i, p1 = start + sign * seg * (i + 1);
      pools.push(axis === 'x' ? [Math.min(p0, p1), r.z0, Math.max(p0, p1), r.z1] : [r.x0, Math.min(p0, p1), r.x1, Math.max(p0, p1)]);
    }
    const segOf = (x: number, z: number): number => Math.min(n - 1, Math.max(0, Math.floor(Math.abs((axis === 'x' ? x : z) - start) / seg)));
    for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06 && !b.kind?.startsWith('lamp:')) b.kind = `lamp:${lamps[segOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2)]}`;
    for (const l of s.cell.lights) if (!l.lampId) l.lampId = lamps[segOf(l.pos[0], l.pos[2])]!;
    // 始まり: 入口の壁から 1.8 m より奥へ入る。入口の前（捕まって戻される所）
    const region = roomRegion(s);
    const deep = axis === 'x' ? { min: [sign > 0 ? a0 + 1.8 : a0, y - 0.5, r.z0], max: [sign > 0 ? a1 : a1 - 1.8, y + 3, r.z1] } : { min: [r.x0, y - 0.5, sign > 0 ? a0 + 1.8 : a0], max: [r.x1, y + 3, sign > 0 ? a1 : a1 - 1.8] };
    const e = frontOf(s.entrance!, 0.8), x = frontOf(s.exit!, 0.8);
    const home = { min: [e[0] - 0.9, y - 0.5, e[2] - 0.9], max: [e[0] + 0.9, y + 3, e[2] + 0.9] };
    ctx.addEntity('closing', { type: 'closing', params: { region, start: deep, home, delay: t['sense.closing.delaySec'], speed: t['sense.closing.speed'], seg, n } });
    // 闇に捕まる: 区間の照明・開口の前（出口・ほかの開口）は消えない灯り
    const dp = s.openings.filter((o) => o !== s.entrance).map((o) => { const f = frontOf(o, 1.0); return [f[0], f[2], 1.3]; });
    for (const o of s.openings) if (o !== s.entrance) { const f = frontOf(o, 0.35); s.cell.lights.push({ pos: [f[0], y + 2.1, f[2]], color: 0x9dffb8, intensity: 0.35, distance: 2.6 }); ctx.addBox(box([f[0] - 0.2, y + 2.16, f[2] - 0.2], [f[0] + 0.2, y + 2.26, f[2] + 0.2], 'lightGreen', false)); }
    ctx.addEntity('dark', {
      type: 'darkHazard',
      params: { region, pools: [...pools, ...dp], poolLamps: [...lamps, ...dp.map(() => null)], grace: t['sense.closing.graceSec'], to: [e[0], y + 0.02, e[2]], toYaw: Math.atan2(-(x[0] - e[0]), -(x[2] - e[2])), kind: 'closing', route: [[e[0], e[2]], [x[0], x[2]]] },
    });
    // 天井のスピーカー
    const B: Box[] = [];
    const top = y + s.cell.height;
    for (let i = 1; i < n; i += 2) {
      const c = start + sign * seg * (i + 0.5);
      const [px, pz] = axis === 'x' ? [c, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, c];
      B.push(box([px - 0.14, top - 0.05, pz - 0.14], [px + 0.14, top, pz + 0.14], 'metal', false));
    }
    for (const b of B) ctx.addBox(b);
    ctx.addEntity('pa', { type: 'senseFx', params: { fx: 'closing', closing, speakers: B.map((b) => [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2]) } });
    for (const o of s.openings) ctx.keepOut(doorZone(o, y, 1.6, 0.4));
  },
});
