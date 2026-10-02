/**
 * 坂の部屋（2 種）。どちらも部屋の床ほぼ全体が穴（pit.ts の planPit: 入口・出口の壁に沿った固い床と、入口の床へ上る階段）。
 *
 * - escalator 逆走エスカレーター [QR M09]: 穴の底から出口の床へ上る、下りに動くエスカレーター（横の壁沿い）。歩いても少ししか
 *     進めず、走ればゆっくり上れる。立ち止まると下まで戻される。途中に平らな踊り場（流れない）。
 *     隠し escalator.landing [BM02]: 踊り場の横の壁の扉（存在型 = 最初からある / 出現型 = 踊り場でしばらく立ち止まると開く）
 * - slideRoom 滑り台の部屋 [M14・ウォータースライダー M12]: 入口の床から穴の底へ、一方通行の速い滑り台。底から出口の床へ階段で
 *     上る（滑り台を使わずに、入口の床の階段を下りてもよい）。降りた先から歩いて入口へも戻れる（閉じ込めない）。
 *     water: 水の流れる滑り台と、底の水たまり。dry: 遊具の滑り台と、底の砂場。
 *     隠し slide.branch [BM12]（存在型）: 滑り台の途中の横の切れ目から、流れに逆らって横の溝へ出ると、穴の壁の棚と扉
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box, type MatId } from '../../../world/layout.ts';
import { buildPit, planPit, type PitPlan } from '../pit.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, type WallFrame } from '../util.ts';
import { stripsFits } from './common.ts';


/** 入口の壁の座標の向き（u / v の単位）を世界の向きへ */
export function dirOf(F: WallFrame, du: number, dv: number): Vec3 {
  const a = F.point(0, 0), b = F.point(du, dv);
  return [b[0] - a[0], 0, b[1] - a[1]];
}

/** 階段の列（plan.lane）の横の範囲と、低い側（u0 の壁沿い）か */
export function laneSide(plan: PitPlan): { lo: number; hi: number; low: boolean } {
  const F = plan.frame;
  const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)].sort((a, b) => a - b) as [number, number];
  return { lo: lu[0], hi: lu[1], low: lu[0] <= F.u0 + 0.01 };
}

/**
 * 坂: u0..u1 × v0..v1 の、v の向きに高さ h0 → h1（床から）。坂の面（ramp 部品）と、面の下を埋める段の箱（当たる・見える）。
 * 返り値は坂の矩形
 */
export function slope(ctx: GimmickContext, F: WallFrame, name: string, u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, bottom: number, mat: MatId, visual: string): Rect {
  const y = ctx.slot.cell.floorY;
  const r = F.rect(u0, v0, u1, v1);
  const alongX = Math.abs(F.point(0, 1)[0] - F.point(0, 0)[0]) > 0.5;
  const pa = F.point(u0, v0), pb = F.point(u0, v1);
  const a0 = alongX ? pa[0] : pa[1], a1 = alongX ? pb[0] : pb[1];
  ctx.addEntity(name, { type: 'ramp', params: { rect: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, axis: alongX ? 0 : 2, a0, a1, y0: y + h0, y1: y + h1, visual, mat } });
  // 面の下を段で埋める（段の上面は、その段の低い端の面の高さの少し下）
  const n = Math.max(1, Math.ceil(Math.abs(v1 - v0) / 0.3));
  for (let i = 0; i < n; i++) {
    const va = v0 + ((v1 - v0) * i) / n, vb = v0 + ((v1 - v0) * (i + 1)) / n;
    const lowH = Math.min(h0 + ((h1 - h0) * i) / n, h0 + ((h1 - h0) * (i + 1)) / n);
    const s = F.rect(u0, va, u1, vb);
    if (lowH - 0.03 > bottom + 0.01) ctx.addBox(box([s.x0, y + bottom, s.z0], [s.x1, y + lowH - 0.03, s.z1], mat));
  }
  return r;
}

/**
 * 坂の上の流れ（flowZone）: 坂に沿って区切り、区切りごとに坂の高さの近くだけ（下 0.3 m・上 1.0 m）に置く
 * （一つの箱にすると、坂の下の床まで流れる）。坂の向きは v（h0 → h1）か u（axis 'u'）
 */
function slopeFlow(ctx: GimmickContext, F: WallFrame, name: string, a0: number, a1: number, b0: number, b1: number, h0: number, h1: number, axis: 'v' | 'u', vector: Vec3, speed: number, visual: string): void {
  const y = ctx.slot.cell.floorY;
  const n = Math.max(1, Math.ceil(Math.abs(axis === 'v' ? b1 - b0 : a1 - a0) / 0.5));
  // 描画用: 坂の全体（世界の座標の矩形・坂の向きの軸・高さ h0 の端と h1 の端の座標）
  const all = F.rect(a0, b0, a1, b1);
  const p0 = axis === 'v' ? F.point(a0, b0) : F.point(a0, b0), p1 = axis === 'v' ? F.point(a0, b1) : F.point(a1, b0);
  const wx = Math.abs(p1[0] - p0[0]) > 0.5;
  const strip = { rect: { x0: all.x0, z0: all.z0, x1: all.x1, z1: all.z1 }, axis: wx ? 0 : 2, c0: wx ? p0[0] : p0[1], c1: wx ? p1[0] : p1[1], y0: y + h0, y1: y + h1 };
  for (let i = 0; i < n; i++) {
    const k0 = i / n, k1 = (i + 1) / n;
    const lo = Math.min(h0 + (h1 - h0) * k0, h0 + (h1 - h0) * k1), hi = Math.max(h0 + (h1 - h0) * k0, h0 + (h1 - h0) * k1);
    const r = axis === 'v' ? F.rect(a0, b0 + (b1 - b0) * k0, a1, b0 + (b1 - b0) * k1) : F.rect(a0 + (a1 - a0) * k0, b0, a0 + (a1 - a0) * k1, b1);
    ctx.addEntity(`${name}${i}`, { type: 'flowZone', params: { aabb: aabbJson({ min: [r.x0, y + lo - 0.3, r.z0], max: [r.x1, y + hi + 1.0, r.z1] }), vector, speed, visual, cue: false, ...(i === 0 ? { strip } : {}) } });
  }
}

/** 坂の横の低い壁（u = u の線、v0..v1、坂の高さ h0 → h1 の上に wallH）。段ごとの箱 */
export function sideWall(ctx: GimmickContext, F: WallFrame, u: number, v0: number, v1: number, h0: number, h1: number, bottom: number, wallH: number, mat: MatId, skip?: [number, number]): void {
  const y = ctx.slot.cell.floorY;
  const n = Math.max(1, Math.ceil(Math.abs(v1 - v0) / 0.3));
  for (let i = 0; i < n; i++) {
    const va = v0 + ((v1 - v0) * i) / n, vb = v0 + ((v1 - v0) * (i + 1)) / n;
    if (skip && Math.max(va, vb) > skip[0] && Math.min(va, vb) < skip[1]) continue;
    const hiH = Math.max(h0 + ((h1 - h0) * i) / n, h0 + ((h1 - h0) * (i + 1)) / n);
    const s = F.rect(u - 0.05, va, u + 0.05, vb);
    ctx.addBox(box([s.x0, y + bottom, s.z0], [s.x1, y + hiH + wallH, s.z1], mat));
  }
}

defineGimmick({
  id: 'escalator', name: '逆走エスカレーター', axes: ['move'], kinds: ['room', 'hall'], minSize: [4.2, 7.0], minHeight: 2.4, weight: 0.7, intensity: 2, offersSecret: true, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const depth = t['move.escalator.depthM'];
    const plan = planPit(ctx, { depth, strips: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const side = laneSide(plan);
    const EW = 1.1;
    // エスカレーターは階段と反対の横の壁沿い
    const [eu0, eu1] = side.low ? [F.u1 - EW, F.u1] : [F.u0, F.u0 + EW];
    if (side.low ? eu0 < side.hi + 1.0 : eu1 > side.lo - 1.0) return;
    const vb = landD + 0.3, vt = F.depth - landD;
    const midW = t['move.escalator.landingM'];
    const f = (vt - vb - midW) / 2;
    // 坂は 40° より急にしない
    if (f < depth / 2 / Math.tan((40 * Math.PI) / 180)) return;
    buildPit(ctx, plan);
    const mat: MatId = 'stainless';
    const down = dirOf(F, 0, -1);
    const speed = t['move.escalator.speed'];
    const v1 = vb + f, v2 = v1 + midW;
    const flights: [number, number, number, number][] = [[vb, v1, -depth, -depth / 2], [v2, vt, -depth / 2, 0]];
    flights.forEach(([a, b, h0, h1], i) => {
      slope(ctx, F, `flight${i}`, eu0, eu1, a, b, h0, h1, -depth, mat, 'escalator');
      slopeFlow(ctx, F, `flow${i}_`, eu0, eu1, a, b, h0, h1, 'v', down, speed, 'escalator');
    });
    // 踊り場（平ら・流れない）
    const L = F.rect(eu0, v1, eu1, v2);
    ctx.addBox(box([L.x0, y - depth, L.z0], [L.x1, y - depth / 2, L.z1], 'floorTile'));
    // 内側の手すり（低い壁）: 穴の底の側。踊り場の横は開いている（踊り場から底へ降りられる）
    const innerU = side.low ? eu0 : eu1;
    sideWall(ctx, F, innerU, vb, v1, -depth, -depth / 2, -depth, 0.95, 'metalDark');
    sideWall(ctx, F, innerU, v2, vt, -depth / 2, 0, -depth, 0.95, 'metalDark');
    // 隠し: 踊り場の横の壁の扉（存在型 / 踊り場で立ち止まり続けると開く）
    const still = ctx.addEntity('landing', { type: 'stateSensor', params: { aabb: aabbJson({ min: [L.x0, y - depth / 2 - 0.1, L.z0], max: [L.x1, y - depth / 2 + 1.0, L.z1] }), when: ['still', 'ground'], sec: t['move.escalator.stillSec'] } });
    const wallDir = sideDirOf(F, !side.low);
    const [dx, dz] = F.point(side.low ? F.u1 : F.u0, (v1 + v2) / 2);
    ctx.offerSecret({ hook: 'escalator.landing', modes: ['present', 'appear'], weight: 1.0, revealOutput: `${still}.done`, doorway: { dir: wallDir, at: wallDir === 0 || wallDir === 2 ? dx : dz, y: y - depth / 2, width: 1.0, height: 2.0 }, tell: '踊り場の横の壁だけ、エスカレーターの音がこもる' });
    ctx.keepOut({ min: [plan.hole.x0, y - depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});

/** 入口の壁の座標で、u1 側（hi）/ u0 側の横の壁の外向き */
export function sideDirOf(F: WallFrame, hi: boolean): Dir {
  const v = dirOf(F, hi ? 1 : -1, 0);
  return Math.abs(v[0]) > 0.5 ? (v[0] > 0 ? 1 : 3) : v[2] > 0 ? 0 : 2;
}

defineGimmick({
  id: 'slideRoom', name: '滑り台の部屋', axes: ['move', 'floor'], kinds: ['room', 'hall'], minSize: [5.2, 7.2], minHeight: 2.4, weight: 0.7, intensity: 1, offersSecret: true, onMainPath: true,
  fits: stripsFits,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const depth = t['move.slide.depthM'];
    const water = ctx.rng.chance(t['move.slide.waterChance']);
    const plan = planPit(ctx, { depth, strips: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const side = laneSide(plan);
    const vt = F.depth - landD;
    // 出口の床へ上る階段: 入口の階段と反対の横の壁沿いに、出口の床から入口の側へ下りる
    const riseMax = t['gimmick.pit.stairRise'], tread = t['gimmick.pit.stairTread'];
    const n = Math.max(1, Math.ceil(depth / riseMax) - 1);
    const rise = depth / (n + 1);
    const SW = 1.1;
    const [xu0, xu1] = side.low ? [F.u1 - SW, F.u1] : [F.u0, F.u0 + SW];
    const xs0 = vt - n * tread;
    // 滑り台: 二つの階段の列の間の真ん中。入口の床の縁から 40° で穴の底へ
    const W = 1.0;
    const freeLo = side.low ? side.hi + 0.35 : xu1 + 0.35, freeHi = side.low ? xu0 - 0.35 : side.lo - 0.35;
    if (freeHi - freeLo < W + 0.2) return;
    const su = (freeLo + freeHi) / 2;
    const run = depth / Math.tan((t['move.slide.slopeDeg'] * Math.PI) / 180);
    const sv0 = landD, sv1 = landD + run;
    if (sv1 + 1.2 > xs0 && Math.abs(su - (xu0 + xu1) / 2) < W / 2 + SW / 2 + 0.3) return;
    if (sv1 + 1.0 > vt) return;
    buildPit(ctx, plan);
    for (let j = 0; j < n; j++) {
      const top = -rise * (j + 1);
      const r = F.rect(xu0, vt - (j + 1) * tread, xu1, vt - j * tread);
      ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y + top, r.z1], s.cell.palette.floor));
    }
    const mat: MatId = water ? 'paintWhite' : 'plasticRed';
    const visual = water ? 'water' : 'slide';
    const r = slope(ctx, F, 'slide', su - W / 2, su + W / 2, sv0, sv1, 0, -depth, -depth, mat, visual);
    const downDir = dirOf(F, 0, 1);
    slopeFlow(ctx, F, 'flow', su - W / 2, su + W / 2, sv0, sv1, 0, -depth, 'v', downDir, t['move.slide.speed'], visual);
    s.cell.zones.push({ kind: 'friction', aabb: { min: [r.x0, y - depth - 0.1, r.z0], max: [r.x1, y + 1.0, r.z1] }, params: { friction: 0.3 } });
    // 隠し（存在型）: 滑り台の途中の横の切れ目 → 横の溝 → 穴の壁の棚の扉。出口の階段の側の壁（階段より入口寄り）
    const bv = sv0 + run * 0.45, bh = -depth * 0.45;
    // 出口の階段の側（入口の階段が u0 側なら u1 側）。出口の階段より入口寄りに置く
    const towardHi = side.low;
    const ledgeU0 = towardHi ? F.u1 - 1.1 : F.u0, ledgeU1 = towardHi ? F.u1 : F.u0 + 1.1;
    const chuteA = towardHi ? su + W / 2 : ledgeU1, chuteB = towardHi ? ledgeU0 : su - W / 2;
    const branch: [number, number] = [bv - 0.9, bv + 0.9];
    let branched = false;
    if (bv + 0.9 + 0.4 < xs0 && chuteB - chuteA > 0.3) {
      const ledgeY = bh - 0.45;
      // 横の溝（横へ下る坂）と棚
      const cr = F.rect(chuteA, branch[0], chuteB, branch[1]);
      const pa = F.point(chuteA, 0), pb = F.point(chuteB, 0);
      const alongX = Math.abs(pb[0] - pa[0]) > 0.5;
      ctx.addEntity('chute', { type: 'ramp', params: { rect: { x0: cr.x0, z0: cr.z0, x1: cr.x1, z1: cr.z1 }, axis: alongX ? 0 : 2, a0: alongX ? pa[0] : pa[1], a1: alongX ? pb[0] : pb[1], y0: y + bh, y1: y + ledgeY, visual, mat } });
      const side2 = dirOf(F, towardHi ? 1 : -1, 0);
      slopeFlow(ctx, F, 'chuteFlow', chuteA, chuteB, branch[0], branch[1], bh, ledgeY, 'u', side2, t['move.slide.chuteSpeed'], visual);
      const lr = F.rect(ledgeU0, branch[0] - 0.2, ledgeU1, branch[1] + 0.2);
      ctx.addBox(box([lr.x0, y - depth, lr.z0], [lr.x1, y + ledgeY, lr.z1], s.cell.palette.floor));
      const dir = sideDirOf(F, towardHi);
      const [dx, dz] = F.point(towardHi ? F.u1 : F.u0, bv);
      ctx.offerSecret({ hook: 'slide.branch', modes: ['present'], weight: 1.0, doorway: { dir, at: dir === 0 || dir === 2 ? dx : dz, y: y + ledgeY, width: 1.0, height: 2.0 }, floorY: y + ledgeY, tell: '滑り台の途中の切れ目の先から、灯りが漏れる' });
      branched = true;
    }
    // 滑り台の横の低い壁（切れ目を除く）。上の端の 0.6 m は壁なし（入口の床の縁を歩いて回り込める）
    const wv0 = sv0 + 0.6, wh0 = -depth * (0.6 / run);
    sideWall(ctx, F, su - W / 2 - 0.05, wv0, sv1, wh0, -depth, -depth, 0.55, mat, branched && !towardHi ? branch : undefined);
    sideWall(ctx, F, su + W / 2 + 0.05, wv0, sv1, wh0, -depth, -depth, 0.55, mat, branched && towardHi ? branch : undefined);
    // 底: 水たまり（水の滑り台）/ 砂場（遊具の滑り台）。遅くなる
    const pr = F.rect(su - 1.0, sv1, su + 1.0, Math.min(sv1 + 1.4, vt - 0.2));
    const pool: Box = box([pr.x0, y - depth, pr.z0], [pr.x1, y - depth + 0.02, pr.z1], water ? 'aquariumBlue' : 'snow', false);
    pool.kind = water ? 'splashPool' : 'sandPit';
    ctx.addBox(pool);
    // dry: 水の足音にしない（浅い水槽の水 water とは別の物。水の音は描画が鳴らす）
    s.cell.zones.push({ kind: 'water', aabb: { min: [pr.x0, y - depth - 0.1, pr.z0], max: [pr.x1, y - depth + 0.4, pr.z1] }, params: { slow: 0.55, dry: true } });
    ctx.keepOut({ min: [plan.hole.x0, y - depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});
