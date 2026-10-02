/**
 * 闇に捕まる部屋（段階 4・担当 sense）。暗闇に少し（grace 秒）いると「闇に捕まり」、部屋の入口へ戻される（部品 darkHazard。体力は減らさない）。
 * 懐中電灯の光は数えない（闇は小さな光を恐れない）。暗闇にいる間は鼓動と、画面の端から黒が寄ってくる（描画）。
 *
 * - blinkoutHall 消える照明 [L02]: 部屋の照明が周期で消える（消える前に瞬く）。消えない小さな灯り（非常灯の島）が道に沿ってあり、
 *     消えている間はその灯りの中で待つ。点いている間に次の灯りまで進む。
 *     裏の振る舞い [BL02]: 真っ暗な間にだけ、壁に光る扉の縁が浮かぶ（存在型 = 扉は最初からある・出現型 = 真っ暗な間にその壁の前にいると現れる）
 * - lightWave 明滅の位相 [L10]: 廊下の照明が、入口の側から出口の側へ波のように点いては消えていく（光の帯が流れる）。
 *     光の帯の中を、帯と一緒に歩く（追い越すと闇に捕まる・遅れても捕まる）。入口と出口の前は消えない灯り
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import { lineAt, lineLength } from '../../../sim/parts/sense/common.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, doorZone, freeWallSpan, frontOf, innerRect, mainAxis, rectD, rectW } from '../util.ts';
import { darkenRoom, roomRegion, routeBetween, routeRects } from './util.ts';

/** 消えない小さな灯り（床に立つ非常灯）: 細い柱と光る頭。点光源は焼き込みにも入る（消えない） */
function islandLamp(ctx: GimmickContext, x: number, z: number, color = 0xffd9a0): void {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const B: Box[] = [
    box([x - 0.03, y, z - 0.03], [x + 0.03, y + 1.15, z + 0.03], 'metalDark', false),
    box([x - 0.12, y + 1.15, z - 0.12], [x + 0.12, y + 1.32, z + 0.12], 'lightWarm', false),
    box([x - 0.18, y, z - 0.18], [x + 0.18, y + 0.04, z + 0.18], 'metalDark', false),
  ];
  for (const b of B) { b.propGroup = `${s.cell.id}/${ctx.id}.island${Math.round(x * 10)}_${Math.round(z * 10)}`; ctx.addBox(b); }
  s.cell.lights.push({ pos: [x, y + 1.25, z], color, intensity: 0.45, distance: 3.2 });
}

/** 開口の前（内側 1.0 m）の消えない灯りの円（ほかの区画から入ってきてすぐ捕まらない） */
const doorPools = (ctx: GimmickContext, r: number): number[][] => ctx.slot.openings.map((o) => { const f = frontOf(o, 1.0); return [f[0], f[2], r]; });

defineGimmick({
  id: 'blinkoutHall', name: '消える照明', axes: ['light', 'time'], kinds: ['room', 'hall'], minSize: [4.2, 6.5], weight: 0.4, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const route = routeBetween(s, 1.0);
    if (!route) return;
    const L = lineLength(route);
    if (L < 3) return;
    // 消えない灯りの島: 道に沿って spacing ごと（入口・出口の前は開口の前の灯り）
    const R = t['sense.blinkout.poolM'];
    const n = Math.max(1, Math.round(L / t['sense.blinkout.spacingM']));
    const islands: [number, number][] = [];
    for (let i = 1; i < n; i++) islands.push(lineAt(route, (L * i) / n));
    const on = t['sense.blinkout.onSec'], off = t['sense.blinkout.offSec'], flicker = t['sense.blinkout.flickerSec'];
    const phase = ctx.rng.float(0, on + off);
    const clock = ctx.addEntity('clock', { type: 'pattern', params: { on, off, phase, flicker } });
    const lamp = darkenRoom(ctx, 'lights', true, { on: `${clock}.out` }, 30);
    for (const [x, z] of islands) islandLamp(ctx, x, z);
    const r = innerRect(s);
    const pools = [[r.x0, r.z0, r.x1, r.z1], ...doorPools(ctx, R + 0.2), ...islands.map(([x, z]) => [x, z, R])];
    const poolLamps = [lamp, ...pools.slice(1).map(() => null)];
    const ent = frontOf(s.entrance!, 0.8);
    ctx.addEntity('dark', {
      type: 'darkHazard',
      params: { region: roomRegion(s), pools, poolLamps, grace: t['sense.blinkout.graceSec'], to: [ent[0], y + 0.02, ent[2]], toYaw: Math.atan2(-(ent[0] - s.entrance!.pos[0]), -(ent[2] - s.entrance!.pos[2])), clock: { on, off, phase, flicker }, route, kind: 'blink', lamp },
    });
    // 道・灯りの島の周りに家具を置かない
    for (const q of routeRects(route, 1.4)) ctx.keepOut({ min: [q.x0, y, q.z0], max: [q.x1, y + 2.5, q.z1] });
    for (const [x, z] of islands) ctx.keepOut({ min: [x - R, y, z - R], max: [x + R, y + 2.5, z + R] });
    // 裏の振る舞い（BL02）: 真っ暗な間にだけ縁が光る扉。開口の無い壁の、入口から遠い所
    const far = ([0, 1, 2, 3] as const).filter((d) => !s.openings.some((o) => o.dir === d)).sort((p, q) => wallDist(ctx, q) - wallDist(ctx, p));
    for (const d of far) {
      const span = freeWallSpan(s, d, 1.8, 0.8);
      if (!span) continue;
      const front = wallFront(ctx, d, span.at, 0.9);
      const zone = ctx.addEntity('secretZone', { type: 'zoneSensor', params: { aabb: aabbJson({ min: [front[0] - 0.9, y - 0.1, front[1] - 0.9], max: [front[0] + 0.9, y + 2, front[1] + 0.9] }) } });
      const darkNow = ctx.addEntity('secretDark', { type: 'not', params: {}, inputs: { in: `${clock}.out` } });
      const both = ctx.addEntity('secretBoth', { type: 'and', params: {}, inputs: { a: `${zone}.in`, b: `${darkNow}.out` } });
      const hold = ctx.addEntity('secretHold', { type: 'timer', params: { onDelay: 0.5, offDelay: 0 }, inputs: { in: `${both}.out` } });
      ctx.addEntity('mark', { type: 'senseFx', params: { fx: 'glowDoor', dir: d, at: span.at, y, w: 1.0, h: 2.0, wall: wallCoordOf(ctx, d), lamp, color: 0x9dffb8 } });
      ctx.offerSecret({ hook: 'blinkout.dark', modes: ['present', 'appear'], weight: 1, revealOutput: `${hold}.out`, doorway: { dir: d, at: span.at, y, width: 1.0, height: 2.0 }, tell: '真っ暗な間だけ浮かぶ、扉の形の光の縁' });
      ctx.keepOut({ min: [front[0] - 0.8, y, front[1] - 0.8], max: [front[0] + 0.8, y + 2.5, front[1] + 0.8] });
      break;
    }
  },
});

/** 壁 d の室内面の座標 */
function wallCoordOf(ctx: GimmickContext, d: Dir): number {
  const r = innerRect(ctx.slot);
  return d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
}

/** 壁 d の at の前（内側 out m）の点 */
function wallFront(ctx: GimmickContext, d: Dir, at: number, out: number): [number, number] {
  const w = wallCoordOf(ctx, d);
  const sg = d === 0 || d === 1 ? -1 : 1;
  return d === 0 || d === 2 ? [at, w + sg * out] : [w + sg * out, at];
}

/** 入口から壁 d までの距離（遠い壁を先に） */
function wallDist(ctx: GimmickContext, d: Dir): number {
  const e = ctx.slot.entrance!.pos;
  const w = wallCoordOf(ctx, d);
  return d === 0 || d === 2 ? Math.abs(w - e[2]) : Math.abs(w - e[0]);
}

defineGimmick({
  id: 'lightWave', name: '明滅の位相', axes: ['light', 'time'], kinds: ['corridor', 'room', 'hall'], minSize: [1.4, 9], weight: 0.45, intensity: 1, onMainPath: true,
  // 細長い区画: 入口と出口が長い向きの両端（向かい合う）
  fits: (s) => {
    if (!s.entrance || !s.exit || s.exit.dir !== (s.entrance.dir + 2) % 4) return false;
    const long = Math.max(rectW(s.rect), rectD(s.rect)), short = Math.min(rectW(s.rect), rectD(s.rect));
    return long >= 9 && (s.kind === 'corridor' || short <= 4.5) && (s.entrance.dir % 2 === 0 ? rectD(s.rect) >= rectW(s.rect) : rectW(s.rect) >= rectD(s.rect));
  },
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const { axis, sign } = mainAxis(s);
    const a0 = axis === 'x' ? r.x0 : r.z0, a1 = axis === 'x' ? r.x1 : r.z1;
    const len = a1 - a0;
    const segM = t['sense.lightWave.segmentM'];
    const n = Math.max(3, Math.round(len / segM));
    const v = t['sense.lightWave.speed'], W = t['sense.lightWave.windowM'];
    // 波の始まりは入口の側の端。位置 u（入口の端から）の区間 i が点くのは、波の前が区間の始まりに来てから、後ろが区間の終わりを過ぎるまで
    const start = sign > 0 ? a0 : a1;
    const period = (len + W) / v + t['sense.lightWave.restSec'];
    const phase0 = ctx.rng.float(0, period);
    const lamps: string[] = [];
    const segOf = (x: number, z: number): number => { const u = (axis === 'x' ? x : z) - start; return Math.min(n - 1, Math.max(0, Math.floor((Math.abs(u) / len) * n))); };
    const pools: number[][] = [];
    for (let i = 0; i < n; i++) {
      const u0 = (len * i) / n, u1 = (len * (i + 1)) / n;
      const onSec = (u1 - u0 + W) / v;
      const clock = ctx.addEntity(`clock${i}`, { type: 'pattern', params: { on: onSec, off: period - onSec, phase: phase0 - u0 / v } });
      lamps.push(ctx.addEntity(`lamp${i}`, { type: 'lamp', params: { on: false, rate: 10 }, inputs: { on: `${clock}.out` } }));
      const p0 = start + sign * u0, p1 = start + sign * u1;
      pools.push(axis === 'x' ? [Math.min(p0, p1), r.z0, Math.max(p0, p1), r.z1] : [r.x0, Math.min(p0, p1), r.x1, Math.max(p0, p1)]);
    }
    // 区画の照明を区間の照明に結び付ける
    for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06 && !b.kind?.startsWith('lamp:')) b.kind = `lamp:${lamps[segOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2)]}`;
    for (const l of s.cell.lights) if (!l.lampId) l.lampId = lamps[segOf(l.pos[0], l.pos[2])]!;
    // 消えない灯り: 開口の前（入口・出口の前で待てる）
    const R = t['sense.lightWave.doorPoolM'];
    const dp = doorPools(ctx, R);
    for (const o of s.openings) { const f = frontOf(o, 0.35); s.cell.lights.push({ pos: [f[0], y + 2.1, f[2]], color: 0x9dffb8, intensity: 0.35, distance: 2.6 }); ctx.addBox(box([f[0] - 0.15, y + 2.15, f[2] - 0.15], [f[0] + 0.15, y + 2.22, f[2] + 0.15], 'lightGreen', false)); }
    const ent = frontOf(s.entrance!, 0.8), ex = frontOf(s.exit!, 0.8);
    const route = [[ent[0], ent[2]], [ex[0], ex[2]]];
    ctx.addEntity('dark', {
      type: 'darkHazard',
      params: {
        region: roomRegion(s), pools: [...pools, ...dp], poolLamps: [...lamps, ...dp.map(() => null)], grace: t['sense.lightWave.graceSec'],
        to: [ent[0], y + 0.02, ent[2]], toYaw: Math.atan2(-(ex[0] - ent[0]), -(ex[2] - ent[2])), kind: 'wave',
        wave: { start: axis === 'x' ? [start, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, start], axis, sign, len, speed: v, window: W, period, phase: phase0 }, route,
      },
    });
    for (const o of s.openings) ctx.keepOut(doorZone(o, y, 1.6, 0.4));
  },
});
