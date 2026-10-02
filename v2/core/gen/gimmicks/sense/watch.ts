/**
 * 見る・見ないの仕掛け（段階 4・担当 sense）。
 *
 * - watchClock 時計を見る / 見ない [O03]: 壁の大きな時計は、見ていない間だけ進む（見ていない間はコチコチと速い音）。出口の扉は鍵が掛かっていて、
 *     12 時の前後に時計を見ると数秒だけ開く（扉の上の灯りが緑）。見ないで待ち、ちらっと見て、12 時ちょうどで見つめて止め、扉へ。
 *     裏の振る舞い [BO03]: 一度も時計を見ないまま長くいると、時計が消え、時計の跡が扉になる（出現型）
 * - zoomSign ズームで注視 [O04]: 長い部屋の奥の壁に小さな札。立ち止まって見つめると撮像がズームし、札の小さな数字が読める。
 *     横の壁に番号付きの扉の形が並び、札の数字の所が隠しの扉 [BO04]（存在型 = その番号の扉だけ開く・出現型 = 読み終えると開く）。
 *     エレベーターの番号の代わりに、同じ部屋の番号の壁にした
 * - mannequinGaze マネキンの視線の先 [BO01]: 部屋のマネキンが全員、壁の同じ一点を見つめている（目を離すとこちらを向く。描画）。
 *     その一点に隠しの扉（存在型 = 最初からある・出現型 = 同じ所を見つめると開く）
 * - lookBack 出口の前で振り返る [BO05]: 廊下の出口の前で振り返って、来た道を見ていると、来た道の横の壁に扉が現れる（出現型）
 */
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, doorZone, frontOf, innerRect, mainAxis, rectD, rectW } from '../util.ts';
import { digitBoxes, freeWalls, roomRegion, routeBetween, routeRects, wallBox, wallPoint } from './util.ts';

defineGimmick({
  id: 'watchClock', name: '見ていない間だけ進む時計', axes: ['sight', 'time'], kinds: ['room', 'hall'], minSize: [4, 5], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const door = ctx.doorAt(s.exit!);
    if (!door) return;
    // 時計の壁: 開口の無い壁のうち、出口の壁の隣（出口へ向かう途中で目に入る）
    const ex = s.exit!.dir;
    const walls = freeWalls(ctx, 1.6, (d) => (d % 2 !== ex % 2 ? 0 : 1));
    const w = walls[0];
    if (!w) return;
    const cy = y + Math.min(2.05, s.cell.height - 0.55);
    const [cx, cz] = wallPoint(ctx, w.d, w.at, 0.06);
    const clock = ctx.addEntity('clock', { type: 'watchClock', params: { pos: [cx, cy, cz], dir: w.d, region: roomRegion(s), start: ctx.rng.float(2, 9), cycleSec: t['sense.clock.cycleSec'], window: t['sense.clock.windowH'], radius: 0.36, door: door.id, unlock: `${ctx.id}.unlock`, gone: `${ctx.id}.goneLatch` } });
    const both = ctx.addEntity('seenAt12', { type: 'and', params: {}, inputs: { a: `${clock}.twelve`, b: `${clock}.seen` } });
    const open = ctx.addEntity('unlock', { type: 'timer', params: { onDelay: 0, offDelay: t['sense.clock.openSec'] }, inputs: { in: `${both}.out` } });
    // 鍵は部屋の中にいる人にだけ掛かる（出口の側から入ってくる人は締め出さない）
    const closed = ctx.addEntity('closed', { type: 'not', params: {}, inputs: { in: `${open}.out` } });
    const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
    const lock = ctx.addEntity('lock', { type: 'and', params: {}, inputs: { a: `${closed}.out`, b: `${inside}.in` } });
    door.inputs = { ...(door.inputs ?? {}), lock: `${lock}.out` };
    // 扉の上の灯り: 開いている間だけ緑
    const lamp = ctx.addEntity('lamp', { type: 'lamp', params: { on: false, rate: 12 }, inputs: { on: `${open}.out` } });
    const top = frontOf(s.exit!, 0.04);
    const g = box([top[0] - 0.09, y + 2.2, top[2] - 0.09], [top[0] + 0.09, y + 2.3, top[2] + 0.09], 'lightGreen', false);
    g.kind = `lamp:${lamp}`;
    ctx.addBox(g);
    // 裏の振る舞い（BO03）: 一度も見ないまま goneSec 秒 → 時計が消え、跡が扉に
    const gone = ctx.addEntity('gone', { type: 'threshold', params: { min: t['sense.clock.goneSec'] }, inputs: { in: `${clock}.unseen` } });
    const goneLatch = ctx.addEntity('goneLatch', { type: 'latch', params: {}, inputs: { set: `${gone}.out` } });
    ctx.offerSecret({ hook: 'clock.unseen', modes: ['appear'], weight: 1, revealOutput: `${goneLatch}.out`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '時計の後ろの壁の、四角い日焼けの跡' });
    // 時計の前 2.2 m は家具を置かない（時計がよく見える。隠しの扉の前も空く）
    const [fx, fz] = wallPoint(ctx, w.d, w.at, 1.1);
    ctx.keepOut(w.d % 2 === 0 ? { min: [fx - 1.0, y, fz - 1.1], max: [fx + 1.0, y + 2.6, fz + 1.1] } : { min: [fx - 1.1, y, fz - 1.0], max: [fx + 1.1, y + 2.6, fz + 1.0] });
  },
});

defineGimmick({
  id: 'zoomSign', name: 'ズームで注視', axes: ['sight'], kinds: ['room', 'hall'], minSize: [4, 8], weight: 0.3, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const e = s.entrance!;
    const far = ((e.dir + 2) % 4) as 0 | 1 | 2 | 3;
    // 札: 入口の向かいの壁（開口があればその脇）。入口から 6 m 以上
    const r = innerRect(s);
    const depth = e.dir % 2 === 0 ? rectD(r) : rectW(r);
    if (depth < 6) return;
    const farAlong = (far === 0 || far === 2 ? r.x0 + r.x1 : r.z0 + r.z1) / 2;
    const blocked = s.openings.filter((o) => o.dir === far).map((o) => (far === 0 || far === 2 ? o.pos[0] : o.pos[2]));
    const signAt = blocked.length ? farAlong + (blocked.every((b) => b < farAlong) ? 1.2 : -1.2) : farAlong;
    // 番号の扉の形: 横の壁（開口の無い壁で、長さ 4.4 m 以上）
    const side = freeWalls(ctx, 4.4, (d) => (d % 2 !== e.dir % 2 ? 0 : 1)).find((w) => w.d % 2 !== e.dir % 2);
    if (!side) return;
    const n = Math.min(4, Math.floor((side.a1 - side.a0) / 1.25));
    if (n < 3) return;
    const right = ctx.rng.int(0, n - 1);
    const pitch = (side.a1 - side.a0) / n;
    const B: Box[] = [];
    const sy = y + 1.62;
    B.push(wallBox(ctx, far, signAt, 0.15, sy - 0.1, sy + 0.1, 0, 0.02, 'signPlate'));
    // 札の小さな数字（立ち止まって見つめないと読めない大きさ）
    B.push(...digitBoxes(ctx, far, signAt, sy, 0.05, right + 1, 'furnitureDark'));
    for (let i = 0; i < n; i++) {
      const at = side.a0 + pitch * (i + 0.5);
      // 番号の札（大きい）は扉の形の上
      B.push(wallBox(ctx, side.d, at, 0.18, y + 2.18, y + 2.5, 0, 0.015, 'signPlate'));
      B.push(...digitBoxes(ctx, side.d, at, y + 2.34, 0.22, i + 1, 'furnitureDark'));
      if (i === right) continue;
      // 開かない扉の形（枠と板）
      B.push(wallBox(ctx, side.d, at, 0.5, y, y + 2.1, 0, 0.02, 'trim'));
      B.push(wallBox(ctx, side.d, at, 0.45, y, y + 2.05, 0, 0.035, s.cell.palette.wall));
      B.push(wallBox(ctx, side.d, at + 0.32, 0.05, y + 0.98, y + 1.04, 0.035, 0.07, 'metal'));
    }
    for (const b of B) ctx.addBox(b);
    const [qx, qz] = wallPoint(ctx, far, signAt, 0.01);
    const gaze = ctx.addEntity('gaze', { type: 'gazeSensor', params: { target: [qx, sy, qz], deg: t['sense.zoom.deg'], maxDist: 40, still: true, stillSec: 0.4, sec: t['sense.zoom.sec'], region: roomRegion(s) } });
    ctx.addEntity('zoom', { type: 'senseFx', params: { fx: 'zoom', gaze, target: [qx, sy, qz] } });
    const at = side.a0 + pitch * (right + 0.5);
    ctx.offerSecret({ hook: 'zoom.sign', modes: ['present', 'appear'], weight: 1, required: true, revealOutput: `${gaze}.done`, doorway: { dir: side.d, at, y, width: 1.0, height: 2.0 }, tell: '札の小さな数字と、壁の番号' });
    const [fx, fz] = wallPoint(ctx, side.d, (side.a0 + side.a1) / 2, 0.6);
    const half = (side.a1 - side.a0) / 2;
    ctx.keepOut(side.d % 2 === 0 ? { min: [fx - half, y, fz - 0.6], max: [fx + half, y + 2.6, fz + 0.6] } : { min: [fx - 0.6, y, fz - half], max: [fx + 0.6, y + 2.6, fz + half] });
    const route = routeBetween(s, 1.0);
    if (route) for (const q of routeRects(route, 1.2)) ctx.keepOut({ min: [q.x0, y, q.z0], max: [q.x1, y + 2.5, q.z1] });
  },
});

defineGimmick({
  id: 'mannequinGaze', name: 'マネキンの視線の先', axes: ['sight'], kinds: ['room', 'hall'], minSize: [5, 6], weight: 0.3, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const w = freeWalls(ctx, 1.6)[0];
    if (!w) return;
    const [px, pz] = wallPoint(ctx, w.d, w.at, 0);
    const P: [number, number, number] = [px, y + 1.15, pz];
    // マネキン: 部屋の中の、開口の前・道・見つめる一点の前を避けた所に 3〜5 体
    const r = innerRect(s, 0.6);
    const avoid = [...s.openings.map((o) => doorZone(o, y, 1.6, 0.5)), ...(routeBetween(s, 1.0) ? routeRects(routeBetween(s, 1.0)!, 1.3).map((q) => ({ min: [q.x0, y, q.z0], max: [q.x1, y + 2, q.z1] })) : [])];
    const near = (x: number, z: number): boolean => avoid.some((a) => x > a.min[0]! - 0.35 && x < a.max[0]! + 0.35 && z > a.min[2]! - 0.35 && z < a.max[2]! + 0.35);
    const figures: number[][] = [];
    const want = ctx.rng.int(3, 5);
    for (let tries = 0; tries < 80 && figures.length < want; tries++) {
      const x = ctx.rng.float(r.x0, r.x1), z = ctx.rng.float(r.z0, r.z1);
      if (near(x, z) || Math.hypot(x - px, z - pz) < 1.8 || figures.some((f) => Math.hypot(f[0]! - x, f[2]! - z) < 1.3)) continue;
      figures.push([x, y, z, Math.atan2(px - x, pz - z)]);
    }
    if (figures.length < 3) return;
    for (const f of figures) {
      const c = box([f[0]! - 0.24, y, f[2]! - 0.24], [f[0]! + 0.24, y + 1.75, f[2]! + 0.24], 'marbleWhite');
      c.kind = 'colliderOnly';
      ctx.addBox(c);
      ctx.keepOut({ min: [f[0]! - 0.6, y, f[2]! - 0.6], max: [f[0]! + 0.6, y + 2, f[2]! + 0.6] });
    }
    ctx.addEntity('figures', { type: 'senseFx', params: { fx: 'mannequins', figures, target: P } });
    const gaze = ctx.addEntity('gaze', { type: 'gazeSensor', params: { target: P, deg: 7, maxDist: 20, still: false, sec: t['sense.gaze.sec'], region: roomRegion(s) } });
    ctx.offerSecret({ hook: 'mannequin.gaze', modes: ['present', 'appear'], weight: 1, revealOutput: `${gaze}.done`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: 'マネキンが全員見つめている壁の一点' });
    const [fx, fz] = wallPoint(ctx, w.d, w.at, 0.9);
    ctx.keepOut({ min: [fx - 0.9, y, fz - 0.9], max: [fx + 0.9, y + 2.6, fz + 0.9] });
  },
});

defineGimmick({
  id: 'lookBack', name: '出口の前で振り返る', axes: ['sight'], kinds: ['corridor'], minSize: [1.4, 7], weight: 0.3, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const { axis } = mainAxis(s);
    const r = innerRect(s);
    const len = axis === 'x' ? rectW(r) : rectD(r);
    if (len < 6.5) return;
    // 来た道の横の壁: 入口から 1.5〜3 m の所
    const e = s.entrance!;
    const ea = axis === 'x' ? e.pos[0] : e.pos[2];
    const sg = axis === 'x' ? (r.x0 + r.x1) / 2 > ea ? 1 : -1 : (r.z0 + r.z1) / 2 > ea ? 1 : -1;
    const sides = axis === 'x' ? ([0, 2] as const) : ([1, 3] as const);
    for (const d of ctx.rng.shuffle([...sides])) {
      if (s.openings.some((o) => o.dir === d)) continue;
      const at = ea + sg * ctx.rng.float(2.0, Math.min(3.5, len / 2));
      const exitZone = doorZone(s.exit!, y, 1.8, 0.5);
      const back = frontOf(e, 0.6);
      const look = ctx.addEntity('look', { type: 'lookSensor', params: { target: [back[0], y + 1.4, back[2]], radius: 0.9, maxDist: 40, mode: 'look', aabb: aabbJson(exitZone), sec: t['sense.lookBack.sec'], latch: true } });
      ctx.offerSecret({ hook: 'look.back', modes: ['appear'], weight: 1, required: true, revealOutput: `${look}.done`, doorway: { dir: d, at, y, width: 1.0, height: 2.0 }, tell: '出口の前で振り返ると、来た道の壁に扉' });
      return;
    }
  },
});
