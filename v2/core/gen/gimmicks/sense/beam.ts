/**
 * 鏡で光を導く [L05]（段階 4・担当 sense）。
 * 壁の光源から腰の高さの光の筋が出ている。部屋の鏡（2〜3 枚。調べると「／」と「＼」が入れ替わる）で筋を曲げて、出口の扉の脇の
 * 受光器に当てると扉の鍵が開く（開いたまま）。筋は家具でも止まる（家具は解の筋の上には置かない）。
 * 裏の振る舞い [BL03]: 鏡の別の並びで、筋が何も無い壁（うっすら焦げた跡）に当たる。そこに 1 秒当て続けると壁が開く（出現型）
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import { reflect, traceBeam } from '../../../sim/parts/sense/beam.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { frontOf, innerRect, wallFrame } from '../util.ts';
import { roomRegion, wallBox } from './util.ts';

type P2 = [number, number];

/** 軸に沿った向き（世界の x・z）から、筋が当たる壁の向き */
const wallOfDir = (d: readonly number[]): Dir => (d[0]! > 0.5 ? 1 : d[0]! < -0.5 ? 3 : d[1]! > 0.5 ? 0 : 2);

/** 線分 a→b（軸に沿う）を幅 w の矩形に */
function segBox(a: readonly number[], b: readonly number[], w: number, y0: number, y1: number): AABB {
  const h = w / 2;
  return { min: [Math.min(a[0]!, b[0]!) - h, y0, Math.min(a[1]!, b[1]!) - h], max: [Math.max(a[0]!, b[0]!) + h, y1, Math.max(a[1]!, b[1]!) + h] };
}

/** 点 m が線分 a→b の途中（両端を除く）にある */
function onSegment(m: readonly number[], a: readonly number[], b: readonly number[]): boolean {
  const ex = b[0]! - a[0]!, ez = b[1]! - a[1]!;
  const l = Math.hypot(ex, ez);
  if (l < 1e-6) return false;
  const t = ((m[0]! - a[0]!) * ex + (m[1]! - a[1]!) * ez) / l;
  const off = Math.abs((m[0]! - a[0]!) * ez - (m[1]! - a[1]!) * ex) / l;
  return off < 0.5 && t > 0.3 && t < l - 0.3;
}

interface Plan { mirrors: P2[]; solution: number[]; emitter: number[]; emitWall: Dir; emitAlong: number; receptor: P2; aR: number }

/** 解の並び（受光器から逆にたどる）。置けなければ null */
function planChain(ctx: GimmickContext, K: number): Plan | null {
  const s = ctx.slot;
  const r = innerRect(s);
  const ex = s.exit!;
  const F = wallFrame(r, ex.dir);
  const alongX = ex.dir === 0 || ex.dir === 2;
  const exAt = alongX ? ex.pos[0] : ex.pos[2];
  // 受光器: 出口の扉の脇（広い側）
  const sides = [-1, 1].map((sg) => exAt + sg * (ex.width / 2 + 0.65)).filter((a) => a > F.u0 + 0.8 && a < F.u1 - 0.8 &&
    !s.openings.some((o) => o !== ex && o.dir === ex.dir && Math.abs((alongX ? o.pos[0] : o.pos[2]) - a) < o.width / 2 + 0.5));
  if (!sides.length) return null;
  const aR = ctx.rng.pick(sides);
  const U = (): number => ctx.rng.float(F.u0 + 1.0, F.u1 - 1.0);
  const V = (): number => ctx.rng.float(1.6, F.depth - 1.0);
  if (F.u1 - F.u0 < 3.4 || F.depth < 4.2) return null;
  const fronts = s.openings.map((o) => { const f = frontOf(o, 0.9); return [f[0], f[2]] as P2; });
  const wallDirOf = (side: 'u0' | 'u1' | 'v0' | 'vD'): Dir => {
    if (side === 'v0') return ex.dir;
    if (side === 'vD') return ((ex.dir + 2) % 4) as Dir;
    if (alongX) return side === 'u0' ? 3 : 1;
    return side === 'u0' ? 2 : 0;
  };
  for (let attempt = 0; attempt < 40; attempt++) {
    // 逆順に: 最後の鏡は受光器の線の上（筋は u に沿って入ってくる）
    const uv: P2[] = [[aR, V()]];
    let inAxis: 'u' | 'v' = 'u';
    for (let j = 1; j < K; j++) {
      const q = uv[uv.length - 1]!;
      if (inAxis === 'u') { uv.push([U(), q[1]]); inAxis = 'v'; } else { uv.push([q[0], V()]); inAxis = 'u'; }
    }
    // 最初の鏡に入る筋の光源
    const first = uv[uv.length - 1]!;
    let side: 'u0' | 'u1' | 'v0' | 'vD';
    let src: P2;
    if (inAxis === 'u') { side = ctx.rng.chance(0.5) ? 'u0' : 'u1'; src = [side === 'u0' ? F.u0 : F.u1, first[1]]; }
    else { side = 'vD'; src = [first[0], F.depth]; }
    const chain = uv.slice().reverse();
    // 鏡どうし・開口の前から離す
    const W = chain.map((q) => F.point(q[0], q[1]) as P2);
    let bad = false;
    for (let i = 0; i < W.length && !bad; i++) {
      for (let j = 0; j < i; j++) if (Math.hypot(W[i]![0] - W[j]![0], W[i]![1] - W[j]![1]) < 1.5) bad = true;
      if (fronts.some((f) => Math.hypot(W[i]![0] - f[0], W[i]![1] - f[1]) < 1.4)) bad = true;
    }
    if (bad) continue;
    // 光源の壁: その壁の開口から離す
    const ew = wallDirOf(side);
    const eAlong = ew % 2 === 0 ? F.point(src[0], src[1])[0] : F.point(src[0], src[1])[1];
    if (s.openings.some((o) => o.dir === ew && Math.abs((ew % 2 === 0 ? o.pos[0] : o.pos[2]) - eAlong) < o.width / 2 + 0.7)) continue;
    // 光源は壁から 0.235 m（レンズの面）
    const Ew = F.point(src[0], src[1]);
    const toFirst = [W[0]![0] - Ew[0], W[0]![1] - Ew[1]];
    const L = Math.hypot(toFirst[0]!, toFirst[1]!);
    const d0: P2 = [Math.round(toFirst[0]! / L), Math.round(toFirst[1]! / L)];
    const emitter = [Ew[0] + d0[0] * 0.235, Ew[1] + d0[1] * 0.235, d0[0], d0[1]];
    const recW = F.point(aR, 0) as P2;
    // 解の向き: 各鏡で入る向き → 出る向き
    const pts: P2[] = [[emitter[0]!, emitter[1]!], ...W, recW];
    const solution: number[] = [];
    for (let i = 1; i <= W.length; i++) {
      const a = pts[i - 1]!, m = pts[i]!, b = pts[i + 1]!;
      const din: P2 = [Math.sign(m[0] - a[0]), Math.sign(m[1] - a[1])];
      const dout: P2 = [Math.sign(b[0] - m[0]), Math.sign(b[1] - m[1])];
      const r0 = reflect(din, 0);
      solution.push(r0[0] === dout[0] && r0[1] === dout[1] ? 0 : 1);
    }
    // 筋の途中に別の鏡が無い（たどって確かめる）
    const rects = [[r.x0, r.z0, r.x1, r.z1]];
    const tr = traceBeam(emitter, W, solution, rects);
    const end = tr.path[tr.path.length - 1]!;
    if (tr.path.length !== W.length + 2 || Math.hypot(end[0]! - recW[0], end[1]! - recW[1]) > 0.05) continue;
    if (W.some((m, i) => pts.some((_a, k) => k + 1 < pts.length && k !== i && k !== i + 1 && onSegment(m, pts[k]!, pts[k + 1]!)))) continue;
    return { mirrors: W, solution, emitter, emitWall: ew, emitAlong: eAlong, receptor: recW, aR };
  }
  return null;
}

defineGimmick({
  id: 'mirrorBeam', name: '鏡で光を導く', axes: ['light', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.6, 6], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.cell.footprint.length === 1,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const door = ctx.doorAt(s.exit!);
    if (!door) return;
    const K = ctx.rng.chance(0.55) ? 3 : 2;
    const plan = planChain(ctx, K) ?? planChain(ctx, 2);
    if (!plan) return;
    const r = innerRect(s);
    const rects = [[r.x0, r.z0, r.x1, r.z1]];
    const bY = y + t['sense.mirror.beamY'];
    const n = plan.mirrors.length;
    // はじめの並び: 解でも、裏の壁の並びでもない
    const all = [...Array(1 << n).keys()].map((k) => [...Array(n).keys()].map((i) => (k >> i) & 1));
    const solKey = plan.solution.join('');
    // 裏の振る舞い（BL03）: 解でない並びのうち、筋が開口の無い壁の、角と開口から離れた所に当たるもの
    let target: { at: number; d: Dir; end: number[]; path: number[][]; key: string } | null = null;
    for (const st of ctx.rng.shuffle(all.filter((a) => a.join('') !== solKey))) {
      const tr = traceBeam(plan.emitter, plan.mirrors, st, rects);
      const end = tr.path[tr.path.length - 1]!;
      const d = wallOfDir(tr.dir);
      const at = d % 2 === 0 ? end[0]! : end[1]!;
      const [a0, a1] = d % 2 === 0 ? [r.x0, r.x1] : [r.z0, r.z1];
      if (tr.path.length < 3 || at < a0 + 0.9 || at > a1 - 0.9) continue;
      if (Math.hypot(end[0]! - plan.receptor[0], end[1]! - plan.receptor[1]) < 1.4 || Math.hypot(end[0]! - plan.emitter[0]!, end[1]! - plan.emitter[1]!) < 1.0) continue;
      if (d === plan.emitWall && Math.abs(at - plan.emitAlong) < 1.0) continue;
      if (s.openings.some((o) => o.dir === d && Math.abs((d % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + 1.1)) continue;
      target = { at, d, end, path: tr.path, key: st.join('') };
      break;
    }
    let init = all[ctx.rng.int(0, all.length - 1)]!;
    for (let k = 0; k < all.length && (init.join('') === solKey || init.join('') === target?.key || traceBeam(plan.emitter, plan.mirrors, init, rects).path.length < 2); k++) init = all[(all.indexOf(init) + 1) % all.length]!;
    if (init.join('') === solKey) return;
    // 鏡（調べると向きが変わる）・光の筋・解けたら開いたままの鍵
    const mirrorIds = plan.mirrors.map(([x, z], i) => ctx.addEntity(`mirror${i}`, { type: 'mirror', params: { box: { min: [x - 0.42, bY - 0.32, z - 0.42], max: [x + 0.42, bY + 0.32, z + 0.42] }, initial: init[i]!, pos: [x, bY, z] } }));
    const inputs: { [k: string]: string } = {};
    mirrorIds.forEach((m, i) => { inputs[`m${i}`] = `${m}.state`; });
    const beam = ctx.addEntity('beam', {
      type: 'beam', inputs,
      params: { emitter: plan.emitter, mirrors: plan.mirrors, rects, y: bY, receptor: [plan.receptor[0], plan.receptor[1], 0.3], target: target ? [target.end[0]!, target.end[1]!, 0.3] : null, solution: plan.solution, mirrorIds, door: door.id },
    });
    const solved = ctx.addEntity('solved', { type: 'latch', params: {}, inputs: { set: `${beam}.lit` } });
    const closed = ctx.addEntity('closed', { type: 'not', params: {}, inputs: { in: `${solved}.out` } });
    const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
    const lock = ctx.addEntity('lock', { type: 'and', params: {}, inputs: { a: `${closed}.out`, b: `${inside}.in` } });
    door.inputs = { ...(door.inputs ?? {}), lock: `${lock}.out` };
    const lamp = ctx.addEntity('lamp', { type: 'lamp', params: { on: false, rate: 6 }, inputs: { on: `${solved}.out` } });
    // 光源・受光器（緑の輪が解けると灯る）・鏡の台
    const B: Box[] = [];
    B.push(wallBox(ctx, plan.emitWall, plan.emitAlong, 0.16, bY - 0.16, bY + 0.16, 0, 0.22, 'metalDark'));
    B.push(wallBox(ctx, plan.emitWall, plan.emitAlong, 0.07, bY - 0.07, bY + 0.07, 0.22, 0.235, 'lightWarm'));
    const exDir = s.exit!.dir;
    B.push(wallBox(ctx, exDir, plan.aR, 0.18, bY - 0.18, bY + 0.18, 0, 0.07, 'metalDark'));
    const ring = wallBox(ctx, exDir, plan.aR, 0.09, bY - 0.09, bY + 0.09, 0.07, 0.085, 'lightGreen');
    ring.kind = `lamp:${lamp}`;
    B.push(ring);
    for (const [x, z] of plan.mirrors) {
      B.push(box([x - 0.26, y, z - 0.26], [x + 0.26, y + 0.04, z + 0.26], 'metalDark', true));
      B.push(box([x - 0.06, y + 0.04, z - 0.06], [x + 0.06, bY - 0.3, z + 0.06], 'metalDark', true));
    }
    for (const b of B) ctx.addBox(b);
    // 家具を置かない: 解の筋・裏の壁への筋・鏡の周り・光源と受光器の前
    const solPath = traceBeam(plan.emitter, plan.mirrors, plan.solution, rects).path;
    for (let i = 1; i < solPath.length; i++) ctx.keepOut(segBox(solPath[i - 1]!, solPath[i]!, 0.9, y, bY + 0.5));
    if (target) for (let i = 1; i < target.path.length; i++) ctx.keepOut(segBox(target.path[i - 1]!, target.path[i]!, 0.9, y, bY + 0.5));
    for (const [x, z] of plan.mirrors) ctx.keepOut({ min: [x - 1.0, y, z - 1.0], max: [x + 1.0, y + 2.4, z + 1.0] });
    if (target) {
      // 焦げた跡（うっすら）と、当て続けると開く壁
      ctx.addBox(wallBox(ctx, target.d, target.at, 0.14, bY - 0.14, bY + 0.14, 0, 0.004, 'shadowDecal'));
      const hold = ctx.addEntity('targetHold', { type: 'timer', params: { onDelay: t['sense.mirror.targetSec'], offDelay: 0 }, inputs: { in: `${beam}.target` } });
      ctx.offerSecret({ hook: 'mirror.blankWall', modes: ['appear'], weight: 1, revealOutput: `${hold}.out`, doorway: { dir: target.d, at: target.at, y, width: 1.0, height: 2.0 }, tell: '何も無い壁の、うっすら焦げた丸い跡' });
    }
  },
});
