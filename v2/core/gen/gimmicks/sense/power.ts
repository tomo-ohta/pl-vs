/**
 * 電源・スイッチ・人感センサーの仕掛け（段階 4・担当 sense）。
 *
 * - emergencyPower 非常電源 [L06]: 停電した暗い部屋。入口の脇の非常電源のレバーを引くと、赤い非常灯が点き、出口の扉の鍵が開く。
 *     電源は短い間しか持たない（レバーが少しずつ戻る。戻りきると非常灯が消え、扉は閉じたまま開かなくなる）。走って出口へ。
 *     鍵は部屋の中の人にだけ掛かる（出口の側から来た人は締め出さない）
 * - switchOffDoor 照明を消すと現れる扉 [L17]: 入口の脇に照明のスイッチ。消すと、暗がりに光る扉の縁が浮かび、壁が開く（出現型・必ず付ける）
 * - sneakLights 人感センサーの灯りをつけずに進む [BL01]: 廊下の灯りは、速く動いた区間だけつく（しゃがみ歩きならつかない）。
 *     一度も灯りをつけずに廊下の奥まで進むと、暗がりに光る扉の縁が浮かび、壁が開く（出現型・必ず付ける）。廊下を出ると数え直す
 */
import type { Dir } from '../../../math/vec.ts';
import { box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { doorZone, freeWallSpan, frontOf, innerRect, mainAxis, rectD, rectW } from '../util.ts';
import { addLever, besideEntrance, darkenRoom, freeWalls, roomRegion, routeBetween, wallCoord, wallPoint } from './util.ts';
import { lineAt, lineLength } from '../../../sim/parts/sense/common.ts';

defineGimmick({
  id: 'emergencyPower', name: '非常電源', axes: ['light', 'time'], kinds: ['room', 'hall'], minSize: [4, 6], weight: 0.4, intensity: 2, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const door = ctx.doorAt(s.exit!);
    if (!door) return;
    const at = besideEntrance(ctx);
    if (at === null) return;
    const e = s.entrance!;
    // 電源の持つ秒数: レバーの前から出口の前まで（軸に沿って）を歩く秒数 × walkFactor + 2
    const [lx, lz] = wallPoint(ctx, e.dir, at, 0.8);
    const xf = frontOf(s.exit!, 0.8);
    const walk = (Math.abs(xf[0] - lx) + Math.abs(xf[2] - lz)) / 3.0;
    const sec = Math.min(t['sense.power.maxSec'], Math.max(t['sense.power.minSec'], walk * t['sense.power.walkFactor'] + 2));
    const lever = addLever(ctx, 'lever', e.dir, at, 'lever', sec, { power: true, door: door.id });
    // 部屋の照明は消えたまま（停電）。非常灯（赤）は電源が入っている間だけ
    darkenRoom(ctx, 'mains', false);
    s.cell.palette = { ...s.cell.palette, ambient: 0x050405 };
    const emergency = ctx.addEntity('emergency', { type: 'lamp', params: { on: false, rate: 14 }, inputs: { on: `${lever}.on` } });
    const route = routeBetween(s, 1.0) ?? [[lx, lz], [xf[0], xf[2]]];
    const L = lineLength(route);
    const top = y + s.cell.height;
    const n = Math.max(2, Math.round(L / 3) + 1);
    for (let i = 0; i < n; i++) {
      const [x, z] = lineAt(route, (L * i) / (n - 1));
      const b = box([x - 0.16, top - 0.06, z - 0.08], [x + 0.16, top, z + 0.08], 'neonRed', false);
      b.kind = `lamp:${emergency}`;
      ctx.addBox(b);
      s.cell.lights.push({ pos: [x, top - 0.35, z], color: 0xff3324, intensity: 0.6, distance: 5.5, lampId: emergency });
    }
    // 出口の上の誘導灯（電源が入ると緑）
    const g = frontOf(s.exit!, 0.05);
    const sign = box([g[0] - 0.22, y + 2.18, g[2] - 0.22], [g[0] + 0.22, y + 2.32, g[2] + 0.22], 'lightGreen', false);
    sign.kind = `lamp:${emergency}`;
    ctx.addBox(sign);
    // 鍵は部屋の中の人にだけ（電源が入っている間は開く）
    const closed = ctx.addEntity('closed', { type: 'not', params: {}, inputs: { in: `${lever}.on` } });
    const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
    const lock = ctx.addEntity('lock', { type: 'and', params: {}, inputs: { a: `${closed}.out`, b: `${inside}.in` } });
    door.inputs = { ...(door.inputs ?? {}), lock: `${lock}.out` };
    ctx.addEntity('hum', { type: 'senseFx', params: { fx: 'power', lever, lamp: emergency, door: door.id } });
    ctx.keepOut(doorZone(e, y, 1.6, 0.9));
    ctx.keepOut(doorZone(s.exit!, y, 1.6, 0.5));
  },
});

defineGimmick({
  id: 'switchOffDoor', name: '照明を消すと現れる扉', axes: ['light', 'puzzle'], kinds: ['room', 'hall'], minSize: [3.5, 4], weight: 0.35, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const at = besideEntrance(ctx, 0.35);
    if (at === null) return;
    const w = freeWalls(ctx, 1.8).find((x) => x.d !== s.entrance!.dir);
    if (!w) return;
    const sw = addLever(ctx, 'switch', s.entrance!.dir, at, 'switch', 0);
    const lit = ctx.addEntity('lit', { type: 'not', params: {}, inputs: { in: `${sw}.on` } });
    const lights = darkenRoom(ctx, 'lights', true, { on: `${lit}.out` }, 10);
    const { wall } = wallCoord(ctx, w.d);
    ctx.addEntity('mark', { type: 'senseFx', params: { fx: 'glowDoor', dir: w.d, at: w.at, y, w: 1.0, h: 2.0, wall, lamp: lights, color: 0x9dffb8 } });
    const hold = ctx.addEntity('dark', { type: 'timer', params: { onDelay: t['sense.switch.darkSec'], offDelay: 0 }, inputs: { in: `${sw}.on` } });
    ctx.offerSecret({ hook: 'switch.off', modes: ['appear'], weight: 1, required: true, revealOutput: `${hold}.out`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '照明を消すと浮かぶ、扉の形の光る縁' });
    const [fx, fz] = wallPoint(ctx, w.d, w.at, 0.8);
    ctx.keepOut({ min: [fx - 0.9, y, fz - 0.9], max: [fx + 0.9, y + 2.4, fz + 0.9] });
  },
});

defineGimmick({
  id: 'sneakLights', name: '人感センサーの灯りをつけずに進む', axes: ['light', 'body'], kinds: ['corridor'], minSize: [1.4, 7], weight: 0.4, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const r = innerRect(s);
    const { axis, sign } = mainAxis(s);
    const len = axis === 'x' ? rectW(r) : rectD(r);
    const n = Math.min(8, Math.max(2, Math.round(len / 3)));
    const y = s.cell.floorY;
    const base = axis === 'x' ? r.x0 : r.z0;
    const segOf = (x: number, z: number): number => Math.min(n - 1, Math.max(0, Math.floor((((axis === 'x' ? x : z) - base) / len) * n)));
    // 奥（出口の側）の横の壁の、光る扉の縁
    const sides: Dir[] = axis === 'x' ? [0, 2] : [1, 3];
    const atDoor = (sign > 0 ? base + len : base) - sign * 1.7;
    const side = sides.find((d) => { const sp = freeWallSpan(s, d, 1.2, 0.6); return sp && atDoor > sp.a0 + 0.5 && atDoor < sp.a1 - 0.5; });
    if (side === undefined) return;
    const lamps: string[] = [];
    const oks: string[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = base + (len / n) * i, a1 = base + (len / n) * (i + 1);
      const zone = axis === 'x' ? { min: [a0, y - 0.2, r.z0], max: [a1, y + 2.5, r.z1] } : { min: [r.x0, y - 0.2, a0], max: [r.x1, y + 2.5, a1] };
      const sensor = ctx.addEntity(`move${i}`, { type: 'speedSensor', params: { aabb: zone, min: t['sense.sneak.speed'], sec: 0 } });
      oks.push(`${sensor}.ok`);
      const hold = ctx.addEntity(`hold${i}`, { type: 'timer', params: { onDelay: 0, offDelay: t['sense.sneak.holdSec'] }, inputs: { in: `${sensor}.ok` } });
      lamps.push(ctx.addEntity(`lamp${i}`, { type: 'lamp', params: { on: false, rate: 6 }, inputs: { on: `${hold}.out` } }));
    }
    for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06 && !b.kind?.startsWith('lamp:')) b.kind = `lamp:${lamps[segOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2)]}`;
    for (const l of s.cell.lights) if (!l.lampId) l.lampId = lamps[segOf(l.pos[0], l.pos[2])]!;
    // 灯りをつけた（廊下を出ると数え直す）
    const anyOn: { [k: string]: string } = {};
    oks.forEach((o, i) => { anyOn['abcdefgh'[i]!] = o; });
    const moved = ctx.addEntity('moved', { type: 'or', params: {}, inputs: anyOn });
    const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
    const out = ctx.addEntity('out', { type: 'not', params: {}, inputs: { in: `${inside}.in` } });
    const tripped = ctx.addEntity('tripped', { type: 'latch', params: {}, inputs: { set: `${moved}.out`, reset: `${out}.out` } });
    const clean = ctx.addEntity('clean', { type: 'not', params: {}, inputs: { in: `${tripped}.out` } });
    const [fx, fz] = wallPoint(ctx, side, atDoor, 0.6);
    const far = ctx.addEntity('far', { type: 'zoneSensor', params: { aabb: { min: [fx - 0.9, y - 0.1, fz - 0.9], max: [fx + 0.9, y + 2, fz + 0.9] } } });
    const both = ctx.addEntity('both', { type: 'and', params: {}, inputs: { a: `${far}.in`, b: `${clean}.out` } });
    const hold = ctx.addEntity('reveal', { type: 'timer', params: { onDelay: 0.5, offDelay: 0 }, inputs: { in: `${both}.out` } });
    const { wall } = wallCoord(ctx, side);
    const lampAt = lamps[segOf(fx, fz)]!;
    ctx.addEntity('mark', { type: 'senseFx', params: { fx: 'glowDoor', dir: side, at: atDoor, y, w: 1.0, h: 2.0, wall, lamp: lampAt, color: 0x9dffb8 } });
    ctx.offerSecret({ hook: 'sneak.dark', modes: ['appear'], weight: 1, required: true, revealOutput: `${hold}.out`, doorway: { dir: side, at: atDoor, y, width: 1.0, height: 2.0 }, tell: '灯りがつかないままの暗がりにだけ浮かぶ、扉の形の光る縁' });
  },
});

