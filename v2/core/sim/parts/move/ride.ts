/**
 * 移動と身体の部品: 乗り物（PlayerState.ride）。
 * - pathRide: 折れ線 path に沿って人を運ぶ。乗るのは調べる（E / タップ）。乗っている間、位置と速度は部品が決める（足元 = 線の点 + foot）。
 *     mode zip: ジップライン。線の始まりでつかまると、加速しながら終わりまで滑る（終わりで手を離す）。誰もいないと取っ手は始まりへ戻る
 *     mode rope: ロープ渡り。どちらの端でもつかまれる。線に沿う向きの操作でゆっくり進む（両手でつかまっている）。端で岸へ上がる
 *     mode cart: 台車。坂の上で乗ると、坂で加速して終わりの車止めまで転がる。誰もいないと台車は始まりへ戻る。
 *       both: 両方の端で乗れる（今いる端から向こうの端へ。accel で押されて走る）。誰も乗らずに returnSec たち、向こうの端の
 *       乗り場（端から callM）に人が待っていれば、空のままそちらへ転がる（呼ばなくても来る）。始まりへは戻らない
 *     zip・rope は跳ぶ操作で手を離す（落ちる）
 * - cableCar: ゴンドラ。二つの乗り場の間を、待つ → 動く をくり返す箱の床。動いている間は床がゆっくり 1 回転し、乗っている人も
 *     一緒に回る（景色が回る）。動いている間は乗り口の柵が閉じる
 */
import type { AABB } from '../../../math/aabb.ts';
import { clamp, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pStr, pVec, type PartContext } from '../../part.ts';
import type { PlayerState } from '../../types.ts';
import { inputDir } from './mech.ts';

// ---------------------------------------------------------------- 折れ線
export interface Polyline { pts: Vec3[]; acc: number[]; len: number }

export function polyline(path: readonly (readonly number[])[]): Polyline {
  const pts = path.map((p) => [p[0]!, p[1]!, p[2]!] as Vec3);
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1], pts[i]![2] - pts[i - 1]![2]));
  return { pts, acc, len: acc[acc.length - 1]! };
}

/** 線の上の点と、その所の向き（単位） */
export function pointAt(L: Polyline, s: number): { p: Vec3; t: Vec3 } {
  const d = clamp(s, 0, L.len);
  let i = 1;
  while (i < L.pts.length - 1 && L.acc[i]! < d) i++;
  const a = L.pts[i - 1]!, b = L.pts[i]!;
  const seg = Math.max(1e-6, L.acc[i]! - L.acc[i - 1]!);
  const k = (d - L.acc[i - 1]!) / seg;
  const t: Vec3 = [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg, (b[2] - a[2]) / seg];
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], t };
}

/** 点 q に一番近い線の上の距離 */
export function nearestS(L: Polyline, q: Readonly<Vec3>): number {
  let best = 0, bd = Infinity;
  for (let i = 1; i < L.pts.length; i++) {
    const a = L.pts[i - 1]!, b = L.pts[i]!;
    const e: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l2 = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
    const k = l2 > 1e-9 ? clamp(((q[0] - a[0]) * e[0] + (q[1] - a[1]) * e[1] + (q[2] - a[2]) * e[2]) / l2, 0, 1) : 0;
    const d = Math.hypot(a[0] + e[0] * k - q[0], a[1] + e[1] * k - q[1], a[2] + e[2] * k - q[2]);
    if (d < bd) { bd = d; best = L.acc[i - 1]! + Math.sqrt(l2) * k; }
  }
  return best;
}

// ---------------------------------------------------------------- 線に沿う乗り物
interface RideState { rider: string; s: number; v: number; idle: number; dir?: number; [k: string]: Json | undefined }

const lineOf = (ctx: PartContext): Polyline => polyline(ctx.spec.params.path as number[][]);

/** 乗り物の今の位置で調べられる箱（取っ手・台車。ロープは線全体） */
function setBoard(ctx: PartContext, L: Polyline, s: number): void {
  const mode = pStr(ctx.spec, 'mode', 'zip');
  if (mode === 'rope') {
    let lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of L.pts) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1]), Math.min(lo[2], p[2])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1]), Math.max(hi[2], p[2])]; }
    ctx.setInteractable({ min: [lo[0] - 0.15, lo[1] - 0.2, lo[2] - 0.15], max: [hi[0] + 0.15, hi[1] + 0.15, hi[2] + 0.15] }, pNum(ctx.spec, 'range', 2.4));
    return;
  }
  const { p } = pointAt(L, s);
  const h = mode === 'cart' ? [0.45, 0.0, 0.45, 0.7] : [0.25, -0.35, 0.25, 0.1];
  ctx.setInteractable({ min: [p[0] - h[0]!, p[1] + h[1]!, p[2] - h[2]!], max: [p[0] + h[0]!, p[1] + h[3]!, p[2] + h[2]!] }, pNum(ctx.spec, 'range', 2.6));
}

function release(ctx: PartContext, s: RideState, p: PlayerState | undefined, at?: Vec3): void {
  if (p && p.ride === ctx.id) {
    p.ride = null;
    if (at) { p.pos = [at[0], at[1], at[2]]; p.vel = [0, 0, 0]; }
  }
  s.rider = '';
  s.idle = 0;
  ctx.cue('ride.release', p ? [p.pos[0], p.pos[1] + 1, p.pos[2]] : undefined);
}

definePart<RideState>({
  type: 'pathRide',
  outputs: ['riding', 's', 'v', 'done', 'atA', 'atB'],
  init(ctx) {
    const L = lineOf(ctx);
    setBoard(ctx, L, 0);
    return { rider: '', s: 0, v: 0, idle: 0, done: 0, dir: 1 };
  },
  step(s, ctx) {
    const L = lineOf(ctx);
    const mode = pStr(ctx.spec, 'mode', 'zip');
    const foot = pVec(ctx.spec, 'foot', [0, -2.0, 0]);
    let p = s.rider ? ctx.players.find((x) => x.id === s.rider) : undefined;
    if (s.rider && (!p || p.ride !== ctx.id)) { release(ctx, s, p); p = undefined; }
    const both = mode === 'cart' && !!ctx.spec.params.both;
    if (!s.rider) {
      const who = ctx.interactedBy();
      const atStart = s.s < 0.05, atEnd = s.s > L.len - 0.05;
      if (who && !who.ride && (mode === 'rope' || atStart || (both && atEnd))) {
        s.rider = who.id; who.ride = ctx.id; s.v = 0; s.done = 0;
        s.dir = both && atEnd ? -1 : 1;
        if (mode === 'rope') s.s = nearestS(L, [who.pos[0] - foot[0], who.pos[1] - foot[1], who.pos[2] - foot[2]]);
        p = who;
        ctx.cue('ride.board', [who.pos[0], who.pos[1] + 1, who.pos[2]]);
      } else if (both) {
        // 誰も乗っていない: 向こうの端の乗り場で人が待っていれば、空のままそちらへ（着いたら止まる）
        const callM = pNum(ctx.spec, 'callM', 2.2);
        const near = (q: Vec3): boolean => ctx.players.some((x) => !x.ride && Math.hypot(x.pos[0] - q[0], x.pos[2] - q[2]) < callM && Math.abs(x.pos[1] - q[1]) < 1.2);
        const a = L.pts[0]!, b = L.pts[L.pts.length - 1]!;
        if (s.v !== 0) {
          s.s = clamp(s.s + s.v * ctx.dt, 0, L.len);
          if (s.s <= 0 || s.s >= L.len) s.v = 0;
        } else if ((atStart && near(b) && !near(a)) || (atEnd && near(a) && !near(b))) {
          s.idle += ctx.dt;
          if (s.idle > pNum(ctx.spec, 'returnSec', 3)) { s.v = (atStart ? 1 : -1) * pNum(ctx.spec, 'returnSpeed', 2.5); s.idle = 0; }
        } else s.idle = 0;
      } else if (mode !== 'rope' && s.s > 0) {
        // 誰も乗っていない: しばらくすると始まりへ戻る（取っ手・台車を引き戻す綱）
        s.idle += ctx.dt;
        if (s.idle > pNum(ctx.spec, 'returnSec', 3)) s.s = Math.max(0, s.s - pNum(ctx.spec, 'returnSpeed', 2.5) * ctx.dt);
      }
    }
    if (p && s.rider) {
      const { t } = pointAt(L, s.s);
      if (mode === 'zip') {
        s.v = Math.min(pNum(ctx.spec, 'vmax', 6), s.v + pNum(ctx.spec, 'accel', 3) * ctx.dt);
        s.s += s.v * ctx.dt;
      } else if (mode === 'rope') {
        const d = inputDir(p);
        const h = Math.hypot(t[0], t[2]);
        const along = h > 1e-6 ? (d[0] * t[0] + d[1] * t[2]) / h : 0;
        s.v = Math.abs(along) > 0.2 ? Math.sign(along) * pNum(ctx.spec, 'speed', 1.1) * Math.min(1, Math.abs(along)) : 0;
        s.s = clamp(s.s + s.v * ctx.dt, 0, L.len);
      } else if (both) {
        // 台車（両方の端）: 押されて向こうの端へ（速さは向きの符号付き）
        const dir = s.dir ?? 1;
        s.v = dir * Math.min(pNum(ctx.spec, 'vmax', 7), Math.abs(s.v) + pNum(ctx.spec, 'accel', 2.5) * ctx.dt);
        s.s = clamp(s.s + s.v * ctx.dt, 0, L.len);
      } else {
        // 台車: 坂で加速し、平らな所では転がり抵抗でゆっくりになる（止まりきらない速さは残す）
        const a = -9.8 * t[1] - pNum(ctx.spec, 'roll', 0.6);
        s.v = clamp(s.v + a * ctx.dt, pNum(ctx.spec, 'vmin', 1.2), pNum(ctx.spec, 'vmax', 7));
        s.s += s.v * ctx.dt;
      }
      const back = both && (s.dir ?? 1) < 0;
      // ロープは進む向きの端でだけ岸へ上がる（向こうの端でつかまった直後は上がらない）
      const end = back ? s.s <= 1e-4 : s.s >= L.len - 1e-4 && (mode !== 'rope' || s.v > 0), start = mode === 'rope' && s.s <= 1e-4 && s.v < 0;
      const { p: q, t: tt } = pointAt(L, s.s);
      p.pos = [q[0] + foot[0], q[1] + foot[1], q[2] + foot[2]];
      p.vel = [tt[0] * s.v, tt[1] * s.v, tt[2] * s.v];
      p.onGround = false;
      if (end || start) {
        if (end) ctx.cue(mode === 'cart' ? 'cart.bump' : 'ride.arrive', [q[0], q[1], q[2]]);
        s.done = 1;
        const at = end ? (ctx.spec.params.endAt as number[] | undefined) : (ctx.spec.params.startAt as number[] | undefined);
        release(ctx, s, p, at ? [at[0]!, at[1]!, at[2]!] : undefined);
        if (end && !at) p.vel = [tt[0] * Math.max(-2, Math.min(s.v, 2)), 0, tt[2] * Math.max(-2, Math.min(s.v, 2))];
        s.s = clamp(s.s, 0, L.len);
        s.v = 0;
      } else if (p.input.jump && mode !== 'cart') {
        release(ctx, s, p);
        p.vel = [tt[0] * s.v, 0, tt[2] * s.v];
      }
    }
    setBoard(ctx, L, s.s);
    ctx.output('riding', s.rider ? 1 : 0);
    ctx.output('s', s.s);
    ctx.output('v', s.v);
    // 端まで乗って降りた（次に乗るまで 1。歩く人が待つのに使う）
    ctx.output('done', s.done ? 1 : 0);
    // 空の乗り物が端に止まっている（歩く人が待つのに使う）
    ctx.output('atA', !s.rider && s.v === 0 && s.s < 0.05 ? 1 : 0);
    ctx.output('atB', !s.rider && s.v === 0 && s.s > L.len - 0.05 ? 1 : 0);
  },
});

// ---------------------------------------------------------------- ゴンドラ
interface CarState { t: number; pos: number[]; angle: number; [k: string]: Json | undefined }

/** ゴンドラの位置と、動いているか（時刻 t。待つ wait → 動く travel → 待つ → 戻る） */
export function cableCarAt(spec: { params: { [k: string]: Json } }, time: number): { pos: Vec3; moving: boolean; angle: number } {
  const a = spec.params.a as number[], b = spec.params.b as number[];
  const wait = Number(spec.params.wait ?? 3), travel = Number(spec.params.travel ?? 6);
  const cyc = 2 * (wait + travel);
  const t = ((time % cyc) + cyc) % cyc;
  let k = 0, moving = false, turn = 0;
  if (t < wait) k = 0;
  else if (t < wait + travel) { const u = (t - wait) / travel; k = u * u * (3 - 2 * u); moving = true; turn = k; }
  else if (t < 2 * wait + travel) { k = 1; turn = 1; }
  else { const u = (t - 2 * wait - travel) / travel; k = 1 - u * u * (3 - 2 * u); moving = true; turn = 1 + u * u * (3 - 2 * u); }
  const spin = Number(spec.params.spin ?? Math.PI * 2);
  return { pos: [a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k, a[2]! + (b[2]! - a[2]!) * k], moving, angle: (turn * spin) % (Math.PI * 2) };
}

function carBoxes(spec: { params: { [k: string]: Json } }, c: Readonly<Vec3>, moving: boolean): { [k: string]: AABB | null } {
  const h = Number(spec.params.half ?? 0.75);
  const axis = Number(spec.params.axis ?? 0);
  const w = 0.08, wh = 1.05;
  const out: { [k: string]: AABB | null } = {
    floor: { min: [c[0] - h, c[1] - 0.12, c[2] - h], max: [c[0] + h, c[1], c[2] + h] },
  };
  // 柵: 動く向き（axis）の両端は乗り口（止まっている間は開く）。横の 2 辺はいつも閉じている
  const side = (k: string, lo: boolean, alongMove: boolean): void => {
    const ax = alongMove ? axis : axis === 0 ? 2 : 0;
    const min: Vec3 = [c[0] - h, c[1], c[2] - h], max: Vec3 = [c[0] + h, c[1] + wh, c[2] + h];
    if (lo) max[ax] = c[ax] - h + w; else min[ax] = c[ax] + h - w;
    out[k] = { min, max };
  };
  side('sideA', true, false); side('sideB', false, false);
  if (moving) { side('gateA', true, true); side('gateB', false, true); } else { out.gateA = null; out.gateB = null; }
  return out;
}

definePart<CarState>({
  type: 'cableCar',
  outputs: ['moving', 'angle', 'riders', 'atA', 'atB'],
  init(ctx) {
    const at = cableCarAt(ctx.spec, 0);
    for (const [k, b] of Object.entries(carBoxes(ctx.spec, at.pos, at.moving))) ctx.setCollider(k, b);
    return { t: 0, pos: at.pos, angle: 0 };
  },
  step(s, ctx) {
    s.t += ctx.dt;
    const at = cableCarAt(ctx.spec, s.t);
    const prev = s.pos as Vec3;
    const h = Number(ctx.spec.params.half ?? 0.75);
    let dA = at.angle - s.angle;
    if (dA < -Math.PI) dA += Math.PI * 2;
    if (dA > Math.PI) dA -= Math.PI * 2;
    const cs = Math.cos(dA), sn = Math.sin(dA);
    let riders = 0;
    for (const p of ctx.players) {
      const inside = p.pos[0] > prev[0] - h && p.pos[0] < prev[0] + h && p.pos[2] > prev[2] - h && p.pos[2] < prev[2] + h;
      const standing = p.onGround ? Math.abs(p.pos[1] - prev[1]) < 0.1 : p.vel[1] <= 0.5 && p.pos[1] >= prev[1] - 0.05 && p.pos[1] - prev[1] < 0.3;
      if (!inside || !standing || p.ride) continue;
      // 箱の真ん中のまわりに回し、箱と一緒に動かす（位置をそのまま動かす）
      const dx = p.pos[0] - prev[0], dz = p.pos[2] - prev[2];
      p.pos = [at.pos[0] + dx * cs + dz * sn, at.pos[1] + (p.onGround ? 0 : p.pos[1] - prev[1]), at.pos[2] - dx * sn + dz * cs];
      riders++;
    }
    const was = s.moving as unknown as number | undefined;
    if (at.moving && !was) ctx.cue('car.depart', [at.pos[0], at.pos[1] + 1, at.pos[2]]);
    if (!at.moving && was) ctx.cue('car.arrive', [at.pos[0], at.pos[1] + 1, at.pos[2]]);
    s.moving = at.moving ? 1 : 0;
    for (const [k, b] of Object.entries(carBoxes(ctx.spec, at.pos, at.moving))) ctx.setCollider(k, b);
    s.pos = at.pos; s.angle = at.angle;
    ctx.output('moving', at.moving ? 1 : 0);
    ctx.output('angle', at.angle);
    ctx.output('riders', riders);
    // 乗り場に止まっている（a / b）
    const pa = pVec(ctx.spec, 'a', [0, 0, 0]), pb = pVec(ctx.spec, 'b', [0, 0, 0]);
    ctx.output('atA', !at.moving && Math.hypot(at.pos[0] - pa[0], at.pos[2] - pa[2]) < 0.2 ? 1 : 0);
    ctx.output('atB', !at.moving && Math.hypot(at.pos[0] - pb[0], at.pos[2] - pb[2]) < 0.2 ? 1 : 0);
  },
});
