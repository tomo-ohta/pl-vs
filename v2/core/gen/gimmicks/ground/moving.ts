/**
 * 動く床（回る円盤 G19・動く床タイル G18）。
 *
 * - turntable 回る円盤: 部屋の床が深い穴で、開口の前だけが足場。真ん中の軸で回る橋（円盤の床の帯）が、止まっては 90° 回る。
 *   橋が入口の足場を向いたときに乗り、乗ったまま回って出口の足場を向いたときに降りる（入口と出口の向きが変わる）。
 *   回っている間に降りると穴の底へ（入口の足場へ上る階段）。開口の無い壁の前にも小さな足場があり、橋がそちらを向くと扉が見える
 *   （turn.blank: 存在型 / 出現型 = 橋に乗ったまま 1 周すると現れる）
 * - slideTiles 動く床タイル: 部屋の床が深い穴の上の大きな床板の升目で、いくつかの升目が空いている。床板はゆっくり空いた升目へ滑り、
 *   道が変わっていく（乗っている床板は人を乗せたまま滑る）。人のすぐ近くの床は滑り出さず、乗っている人がいる間は、その人から両岸へ
 *   床板がつながったままの動きだけを選ぶ（閉じ込めない）。踏み外すと穴の底へ（入口側へ上る階段）。穴の底の壁に扉（slide.below・存在型）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Json, type WallOpening } from '../../../world/layout.ts';
import { pitShell } from '../pit.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { cutFloorSlab, innerRect, wallFrame } from '../util.ts';
import { botHint, buildTrench, enterAt, onRectWall, openingAt, planTrench, snap, type BotStepSpec } from './common.ts';

/** 壁 d の外向きの単位ベクトル [x, z] */
const outward = (d: Dir): [number, number] => ([[0, 1], [1, 0], [0, -1], [-1, 0]] as const)[d] as [number, number];

/**
 * 穴の底へ落ちた人が上る階段: 足場 land（壁 d に付いた矩形）の横に、壁沿いに足場の方へ上る段を並べる。置けなければ null（何も足さない）。
 * 戻り値の build で作る
 */
function planSideStairs(ctx: GimmickContext, land: Rect, d: Dir, depth: number, avoid: Rect[]): { build(): void; rect: Rect } | null {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY;
  const F = wallFrame(innerRect(s), d);
  const n = Math.max(1, Math.ceil(depth / t['gimmick.pit.stairRise']) - 1);
  const rise = depth / (n + 1), tread = 0.28, len = n * tread;
  const lu = [F.u(land.x0, land.z0), F.u(land.x1, land.z1)].sort((a, b) => a - b) as [number, number];
  const W = 0.95;
  for (const side of ctx.rng.shuffle([-1, 1] as const)) {
    const a0 = side < 0 ? lu[0] : lu[1];
    const a1 = a0 + side * len;
    if (Math.min(a0, a1) < F.u0 + 0.05 || Math.max(a0, a1) > F.u1 - 0.05) continue;
    const r = F.rect(Math.min(a0, a1), 0, Math.max(a0, a1), W);
    if (avoid.some((x) => r.x0 < x.x1 + 0.3 && r.x1 > x.x0 - 0.3 && r.z0 < x.z1 + 0.3 && r.z1 > x.z0 - 0.3)) continue;
    return {
      rect: r,
      build() {
        for (let j = 0; j < n; j++) {
          // 足場に近い段ほど高い
          const p = a0 + side * j * tread, q = a0 + side * (j + 1) * tread;
          const rr = F.rect(Math.min(p, q), 0, Math.max(p, q), W);
          ctx.addBox(box([rr.x0, y - depth, rr.z0], [rr.x1, y - rise * (j + 1), rr.z1], s.cell.palette.floor));
        }
      },
    };
  }
  return null;
}

defineGimmick({
  id: 'turntable', name: '回る円盤', axes: ['move', 'floor'], kinds: ['room', 'hall'], minSize: [6.4, 6.4], minHeight: 2.6, weight: 0.7, intensity: 2, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    if (!s.entrance || s.openings.some((o) => !onRectWall(s, o))) return;
    const r = innerRect(s);
    const A = Math.min(r.x1 - r.x0, r.z1 - r.z0);
    const C: [number, number] = [snap((r.x0 + r.x1) / 2), snap((r.z0 + r.z1) / 2)];
    const L = 1.2, p = A / 2 - L;
    if (p < 1.8) return;
    const depth = t['ground.turn.depthM'];
    // 開口の壁ごとの足場（壁から穴の縁まで。開口の前と、橋の端の来る壁の真ん中をつなぐ）
    const walls = new Map<Dir, WallOpening[]>();
    for (const o of s.openings) walls.set(o.dir, [...(walls.get(o.dir) ?? []), o]);
    const landOf = (d: Dir, extra: [number, number][] = []): Rect => {
      const F = wallFrame(r, d);
      const cu = F.u(C[0], C[1]);
      let a = cu - 0.8, b = cu + 0.8;
      for (const [u0, u1] of extra) { a = Math.min(a, u0); b = Math.max(b, u1); }
      const edge = F.v(C[0] + outward(d)[0] * p, C[1] + outward(d)[1] * p);
      return F.rect(Math.max(F.u0, a), 0, Math.min(F.u1, b), edge);
    };
    const lands = new Map<Dir, Rect>();
    for (const [d, os] of walls) lands.set(d, landOf(d, os.map((o) => [openingAt(o) - o.width / 2 - 0.35, openingAt(o) + o.width / 2 + 0.35])));
    // 開口の無い壁の前の小さな足場（隠しの扉の前）
    const blank = ([0, 1, 2, 3] as Dir[]).filter((d) => !walls.has(d));
    const secretWall = blank.length ? ctx.rng.pick(blank) : null;
    if (secretWall !== null) lands.set(secretWall, landOf(secretWall));
    // 落ちた人が上る階段（入口の足場の横）
    const ent = s.entrance;
    const stairs = planSideStairs(ctx, lands.get(ent.dir)!, ent.dir, depth, [...lands.entries()].filter(([d]) => d !== ent.dir).map(([, x]) => x));
    if (!stairs) return;
    // ---- ここから作る
    cutFloorSlab(s, r);
    pitShell(ctx, r, depth);
    for (const [, land] of lands) ctx.addBox(box([land.x0, y - depth, land.z0], [land.x1, y, land.z1], s.cell.palette.floor));
    stairs.build();
    // 真ん中の軸の柱（橋の下）
    ctx.addBox(box([C[0] - 0.3, y - depth, C[1] - 0.3], [C[0] + 0.3, y - 0.25, C[1] + 0.3], 'metalDark'));
    // 足場の縁の黄色い線（乗り降りする所）
    for (const [d, land] of lands) {
      const o = outward(d);
      const ex = C[0] + o[0] * p, ez = C[1] + o[1] * p;
      const q = d % 2 === 0 ? { x0: land.x0, x1: land.x1, z0: ez - 0.05 * Math.sign(o[1]) - 0.025, z1: ez - 0.05 * Math.sign(o[1]) + 0.025 } : { z0: land.z0, z1: land.z1, x0: ex - 0.05 * Math.sign(o[0]) - 0.025, x1: ex - 0.05 * Math.sign(o[0]) + 0.025 };
      ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + 0.004, q.z1], 'yellowLine', false));
    }
    // 穴の底の灯り（暗い穴の深さが分かる）
    s.cell.lights.push({ pos: [C[0], y - depth + 1.4, C[1]], color: 0x9fb4d0, intensity: 0.35, distance: 6 });
    s.cell.bounds.min[1] = Math.min(s.cell.bounds.min[1], y - depth - 0.2);
    const len = 2 * (p + 0.4), wid = 1.4;
    const tt = ctx.addEntity('disc', { type: 'turntable', params: { center: [C[0], y, C[1]], len, wid, radius: p, pause: t['ground.turn.pauseSec'], turn: t['ground.turn.turnSec'], dir: ctx.rng.chance(0.5) ? 1 : -1, offset: ctx.rng.float(0, 30), start: ctx.rng.chance(0.5) ? 1 : 0, mat: ctx.rng.pick(['metal', 'floorTile', 'marbleFloor'] as const), need: t['ground.turn.needSec'] } });
    const alignOf = (d: Dir): string => `${tt}.${d % 2 === 0 ? 'alignZ' : 'alignX'}`;
    // 橋の端で待つ所（足場の上。穴の縁から 0.6 m）と、真ん中
    const standAt = (d: Dir): [number, number, number] => { const o = outward(d); return [C[0] + o[0] * (p + 0.6), y, C[1] + o[1] * (p + 0.6)]; };
    const pivot: [number, number, number] = [C[0], y, C[1]];
    const ride = (a: Dir, b: Dir, extra: BotStepSpec[] = []): BotStepSpec[] => {
      if (a === b) return extra.length ? [{ at: standAt(a), until: alignOf(a) }, { at: pivot }, ...extra, { at: pivot, until: alignOf(b) }] : [];
      if (a % 2 === b % 2 && !extra.length) return [{ at: standAt(a), until: alignOf(a) }];
      return [{ at: standAt(a), until: alignOf(a) }, { at: pivot }, ...extra, { at: pivot, until: alignOf(b) }];
    };
    const hints: Json[] = [];
    for (const a of s.openings) for (const b of s.openings) {
      if (a === b) continue;
      const steps = ride(a.dir, b.dir);
      if (steps.length) hints.push({ ...(botHint(steps, { enterAt: enterAt(a) }) as { [k: string]: Json }), exitAt: enterAt(b) });
    }
    if (secretWall !== null) {
      const sw = secretWall;
      const F = wallFrame(r, sw);
      const atU = F.u(C[0], C[1]);
      const door = F.point(atU, 0);
      const dw = [door[0] + outward(sw)[0] * 0.1, door[1] + outward(sw)[1] * 0.1] as [number, number];
      for (const a of s.openings) hints.push({ ...(botHint(ride(a.dir, sw, [{ at: pivot, until: `${tt}.fullTurn` }]), { enterAt: enterAt(a), only: 'secret' }) as { [k: string]: Json }), exitAt: dw });
      ctx.offerSecret({ hook: 'turn.blank', modes: ['present', 'appear'], weight: 1, revealOutput: `${tt}.fullTurn`, doorway: { dir: sw, at: sw % 2 === 0 ? door[0] : door[1], y, width: 1.0, height: 2.0 }, tell: '橋が向くと、扉の無い壁の前に小さな足場' });
    }
    if (hints.length) ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: hints } });
    ctx.keepOut({ min: [r.x0, y - depth, r.z0], max: [r.x1, y + s.cell.height, r.z1] });
  },
});

defineGimmick({
  id: 'slideTiles', name: '動く床タイル', axes: ['move', 'floor'], kinds: ['room', 'hall'], minSize: [4.4, 6.8], minHeight: 2.4, weight: 0.6, intensity: 2, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const ent = s.entrance;
    if (!ent || s.openings.some((o) => !onRectWall(s, o))) return;
    const F = wallFrame(innerRect(s), ent.dir);
    const c = t['ground.slide.tileM'], depth = t['ground.slide.depthM'];
    const rows = Math.min(6, Math.floor((F.depth - 2.9) / c));
    if (rows < 3) return;
    const v0 = 1.4, v1 = v0 + rows * c + 0.3;
    const sideOf = (o: WallOpening): number => { const v = F.v(o.pos[0], o.pos[2]); return v < v0 ? 0 : v > v1 ? 1 : -1; };
    if (s.openings.some((o) => sideOf(o) < 0)) return;
    // 階段は出口から遠い方の端
    const ex = s.openings.find((o) => sideOf(o) === 1);
    const stairSide: -1 | 1 = ex ? (openingAt(ex) - F.u0 > F.u1 - openingAt(ex) ? -1 : 1) : ctx.rng.chance(0.5) ? -1 : 1;
    const plan = planTrench(ctx, { v0, v1, depth, stairSide, laneW: 1.0 });
    if (!plan) return;
    const iu = [F.u(plan.inner.x0, plan.inner.z0), F.u(plan.inner.x1, plan.inner.z1)].sort((a, b) => a - b) as [number, number];
    const iv = [F.v(plan.inner.x0, plan.inner.z0), F.v(plan.inner.x1, plan.inner.z1)].sort((a, b) => a - b) as [number, number];
    const cols = Math.max(3, Math.round((iu[1] - iu[0]) / c));
    const cw = (iu[1] - iu[0]) / cols, rh = (iv[1] - iv[0]) / rows;
    // 升目（行 0 が手前の岸）。階段の上の升目は床板を置かない
    const cells: number[][] = [];
    const blocked: boolean[] = [];
    for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
      const r = F.rect(iu[0] + i * cw, iv[0] + k * rh, iu[0] + (i + 1) * cw, iv[0] + (k + 1) * rh);
      cells.push([r.x0, r.z0, r.x1, r.z1]);
      const st = plan.stairs;
      blocked.push(r.x0 < st.x1 + 0.05 && r.x1 > st.x0 - 0.05 && r.z0 < st.z1 + 0.05 && r.z1 > st.z0 - 0.05);
    }
    const free = blocked.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);
    const holes = Math.max(2, Math.round(free.length * t['ground.slide.holes']));
    if (free.length - holes < cols + rows) return;
    // 最初の並び: 両岸がつながる並び（つながらなければ何度か選び直す）
    let occ: number[] = [];
    for (let tries = 0; tries < 40; tries++) {
      const hs = new Set(ctx.rng.shuffle([...free]).slice(0, holes));
      let id = 0;
      occ = blocked.map((b, i) => (b ? -2 : hs.has(i) ? -1 : id++));
      if (slideLinked(occ, cols, rows)) break;
    }
    // ---- ここから作る
    buildTrench(ctx, plan);
    const mat = ctx.rng.pick((['floorTile', 'marbleFloor', 'metal', 'floorWood'] as const).filter((m) => m !== s.cell.palette.floor));
    const tiles = ctx.addEntity('tiles', { type: 'slideTiles', params: { cells, cols, rows, occ, y, moveSec: t['ground.slide.moveSec'], pauseSec: t['ground.slide.pauseSec'], near: 2.0, mat } });
    // 歩く人: 岸の真ん中で、両岸がつながるのを待ってから渡る（道は動く床に合わせて引き直す）
    const hints: Json[] = [];
    const um = (iu[0] + iu[1]) / 2;
    for (const a of s.openings) for (const b of s.openings) {
      if (a === b || sideOf(a) === sideOf(b)) continue;
      const p = F.point(um, sideOf(a) === 0 ? v0 - 0.55 : v1 + 0.55);
      hints.push({ ...(botHint([{ at: [p[0], y, p[1]], until: `${tiles}.connected` }], { enterAt: enterAt(a), replanSec: 0.3 }) as { [k: string]: Json }), exitAt: enterAt(b) });
    }
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: [...hints, { steps: [], replanSec: 0.3 }] } });
    // 隠し: 階段と反対の横の壁の、溝の底
    const sd: Dir = ent.dir % 2 === 0 ? (stairSide < 0 ? 1 : 3) : (stairSide < 0 ? 0 : 2);
    const mid = F.point(F.u0, (v0 + v1) / 2);
    ctx.offerSecret({ hook: 'slide.below', modes: ['present'], weight: 1, doorway: { dir: sd, at: sd % 2 === 0 ? mid[0] : mid[1], y: y - depth, width: 1.0, height: 2.0 }, floorY: y - depth, tell: '床板の隙間の下、溝の底の壁に灯り' });
  },
});

/** 動く床タイルの並びで、手前の岸（行 0）から奥の岸（行 rows-1）まで床板がつながるか（occ: 床板の番号 / -1 空き / -2 置かない） */
export function slideLinked(occ: readonly number[], cols: number, rows: number): boolean {
  const seen = new Set<number>();
  const q: number[] = [];
  for (let i = 0; i < cols; i++) if (occ[i]! >= 0) { seen.add(i); q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const j = q[h]!, ci = j % cols, rk = Math.floor(j / cols);
    if (rk === rows - 1) return true;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = ci + di, nk = rk + dk;
      if (ni < 0 || nk < 0 || ni >= cols || nk >= rows) continue;
      const n = nk * cols + ni;
      if (occ[n]! >= 0 && !seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return false;
}
