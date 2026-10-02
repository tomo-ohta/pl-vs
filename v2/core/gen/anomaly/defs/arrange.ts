/**
 * 家具の並びがおかしい異変: 増殖（同じ椅子が部屋いっぱいに整列し、全部こちらを向く）・積み上げ（家具が真ん中に塔のように）・
 * 散乱（家具が倒れて散らばる）・逆さま（家具が天井に付き、照明は床）。
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Dir } from '../../../math/vec.ts';
import { box, type Box, type MatId } from '../../../world/layout.ts';
import { chair } from '../../dress/furniture.ts';
import { officeChair, schoolChair } from '../../dress/props.ts';
import { defineAnomaly, type AnomalyContext } from '../types.ts';
import {
  bbOf, boxSet, doorFronts, hitsAny, insideRects, interiorSolids, isCeilingPanel, isFloorFixture, isCeilingSlab, isFloorSlab, loadCoords, mirrorBoxY, moveBox, objectGroups,
  overlaps, rectArea, rotBoxY, saveCoords, tipBox, type Group,
} from '../util.ts';
import { MAZE_THEMES } from './scale.ts';

const POOL_THEMES = new Set(['PoolCorridor']);

/** 作業座標（床 = 0）で作った箱をフロア座標へ上げ、propGroup を区画の中で一意にする */
function lift(B: Box[], cellId: string, fy: number): Box[] {
  for (const b of B) {
    b.min = [b.min[0], b.min[1] + fy, b.min[2]];
    b.max = [b.max[0], b.max[1] + fy, b.max[2]];
    if (b.propGroup && !b.propGroup.startsWith(`${cellId}/`)) b.propGroup = `${cellId}/${b.propGroup}`;
  }
  return B;
}

// ---------------------------------------------------------------- 増殖

type ChairFn = (B: Box[], x: number, z: number, facing: Dir) => void;

/** テーマに合う椅子（教室なら学校の椅子、事務所なら事務椅子、劇場なら赤い椅子） */
function chairFor(theme: string, pick: MatId): ChairFn {
  if (/Office|DynamicGrid|LargeRoom/.test(theme)) return (B, x, z, f) => officeChair(B, x, z, f);
  if (/Classroom|School/.test(theme)) return (B, x, z, f) => schoolChair(B, x, z, f);
  if (/Theater|Entertainment/.test(theme)) return (B, x, z, f) => chair(B, x, z, f, 'seatRed');
  return (B, x, z, f) => chair(B, x, z, f, pick);
}

/** 増殖: 区画の中身の代わりに、同じ椅子を格子に並べる。全部が入口を向く。開口から開口へは通路を残す */
defineAnomaly({
  id: 'multiply', name: '増殖', weight: 1, intensity: 2, kinds: ['room', 'hall'], minSize: [3.6, 4],
  pre(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY;
    ctx.skipDress();
    const make = chairFor(cell.theme ?? '', ctx.rng.pick<MatId>(['seatBlue', 'furnitureDark', 'plasticRed', 'furnitureLight', 'seatRed']));
    const facing = ctx.entrance.dir;
    const doors = doorFronts(cell, ctx.geo.openings, 1.6, 0.4);
    const fixed = interiorSolids(cell);
    // 通路: 開口ごとに、開口の中心線に沿って部屋の端から端まで（向きの違う通路は交わる）。
    // 平行で重ならない通路の組は、部屋の真ん中を横切る通路でつなぐ
    const aisle = t['anomaly.multiply.aisle'] / 2;
    const lanes: AABB[] = [];
    const lane = (alongZ: boolean, at: number): void => {
      for (const r of ctx.rects) lanes.push(alongZ ? { min: [at - aisle, fy, r.z0], max: [at + aisle, fy + 3, r.z1] } : { min: [r.x0, fy, at - aisle], max: [r.x1, fy + 3, at + aisle] });
    };
    const ops = ctx.geo.openings.map((o) => ({ alongZ: o.dir === 0 || o.dir === 2, at: o.dir === 0 || o.dir === 2 ? o.pos[0] : o.pos[2] }));
    for (const o of ops) lane(o.alongZ, o.at);
    const r0 = ctx.rects[0]!;
    for (const flag of [true, false]) {
      const par = ops.filter((o) => o.alongZ === flag);
      if (par.length >= 2 && par.some((o) => Math.abs(o.at - par[0]!.at) > 2 * aisle - 0.05) && !ops.some((o) => o.alongZ !== flag)) lane(!flag, flag ? (r0.z0 + r0.z1) / 2 : (r0.x0 + r0.x1) / 2);
    }
    // 間隔: 数が多すぎる部屋は広げる
    let pitch = ctx.rng.float(t['anomaly.multiply.pitchMin'], Math.max(t['anomaly.multiply.pitchMin'], t['anomaly.multiply.pitchMax']));
    const est = ctx.rects.reduce((a, r) => a + rectArea(r), 0) / (pitch * pitch);
    if (est > t['anomaly.multiply.max']) pitch *= Math.sqrt(est / t['anomaly.multiply.max']);
    // 列の位置: 壁から通路をまたいで詰めて並べ、余りを両端に振り分ける（通路の両側に椅子が寄り添う）
    const HALF = 0.3;
    const lineUp = (a0: number, a1: number, cuts: [number, number][]): number[] => {
      const out: number[] = [];
      let x = a0 + HALF;
      while (x <= a1 - HALF + 1e-6) {
        const cut = cuts.find(([p, q]) => x + HALF > p && x - HALF < q);
        if (cut) { x = cut[1] + HALF + 0.02; continue; }
        out.push(x);
        x += pitch;
      }
      // 右の余りの半分だけ寄せる（壁際の余白を左右でそろえる）。通路に掛かるならずらさない
      const slack = out.length ? (a1 - HALF - out[out.length - 1]!) / 2 : 0;
      return out.map((v) => (cuts.some(([p, q]) => v + slack + HALF > p && v + slack - HALF < q) ? v : v + slack));
    };
    let n = 0;
    for (const r of ctx.rects) {
      const xs = lineUp(r.x0, r.x1, lanes.filter((l) => l.max[2] - l.min[2] > l.max[0] - l.min[0]).map((l) => [l.min[0], l.max[0]]));
      const zs = lineUp(r.z0, r.z1, lanes.filter((l) => l.max[0] - l.min[0] >= l.max[2] - l.min[2]).map((l) => [l.min[2], l.max[2]]));
      for (const x of xs) for (const z of zs) {
        if (n >= t['anomaly.multiply.max']) break;
        const B: Box[] = [];
        make(B, x, z, facing);
        lift(B, cell.id, fy);
        const bb = bbOf(B);
        if (!insideRects(ctx.rects, bb, 0.02) || hitsAny(lanes, bb) || hitsAny(doors, bb) || fixed.some((f) => overlaps(f, bb, 0.05))) continue;
        for (const b of B) ctx.addBox(b);
        n++;
      }
    }
    return n >= 6;
  },
});

// ---------------------------------------------------------------- 積み上げ

/** 組の xz の中心が (x, z)、底が y になるように動かす */
function placeGroupAt(g: Group, x: number, y: number, z: number): void {
  const bb = bbOf(g.boxes);
  const dx = x - (bb.min[0] + bb.max[0]) / 2, dz = z - (bb.min[2] + bb.max[2]) / 2, dy = y - bb.min[1];
  for (const b of g.boxes) moveBox(b, dx, dy, dz);
}

const hasSlope = (g: Group): boolean => g.boxes.some((b) => b.slope);

/** 塔の候補の位置（部屋の中心から順に、少しずつ外へ） */
function towerSpots(ctx: AnomalyContext): [number, number][] {
  const out: [number, number][] = [];
  for (const r of ctx.rects) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0;
    out.push([cx, cz]);
    for (const [fx, fz] of [[-0.25, -0.25], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [0, -0.3], [0, 0.3], [-0.3, 0], [0.3, 0]] as const) out.push([cx + fx * w, cz + fz * d]);
  }
  return out;
}

/** 積み上げ: 部屋の家具を全部、真ん中に塔のように積む（大きい物が下）。塔に載らない物は塔の足元に倒れている */
defineAnomaly({
  id: 'stack', name: '積み上げ', weight: 0.8, intensity: 2, kinds: ['room', 'hall'], needsFurniture: true, minSize: [3.8, 4.2],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const groups = objectGroups(ctx.furniture, cell).filter((g) => !hasSlope(g));
    if (groups.length < 3) return false;
    const mine = boxSet(groups);
    const fixed = interiorSolids(cell, mine);
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.35);
    ctx.removeBoxes((b) => mine.has(b));
    // 背の高い物（棚・ロッカー）は寝かせて積む。たまに 90° 回して載せる（積み方の乱れ）。大きい物（足元の面積）が下
    for (const g of groups) {
      const bb = bbOf(g.boxes), H = bb.max[1] - bb.min[1];
      if (H > 1.1 && H < 2.6) tipGroup(g, ctx.rng.chance(0.5) ? 'x' : 'z', ctx.rng.chance(0.5) ? 1 : -1, fy);
      if (ctx.rng.chance(0.4)) { const c = bbOf(g.boxes); for (const b of g.boxes) rotBoxY(b, 1, (c.min[0] + c.max[0]) / 2, (c.min[2] + c.max[2]) / 2); }
    }
    const foot = (g: Group): number => { const bb = bbOf(g.boxes); return (bb.max[0] - bb.min[0]) * (bb.max[2] - bb.min[2]); };
    const sorted = groups.slice().sort((a, b) => foot(b) - foot(a));
    // 塔に分ける（天井の手前まで）: 載る塔のうち低い方へ。どの塔にも載らなければ新しい塔（上限まで）、それも無理なら足元に倒れている物
    const maxTowers = ctx.tuning['anomaly.stack.towers'];
    const piles: { gs: Group[]; y: number }[] = [];
    const left: Group[] = [];
    for (const g of sorted) {
      const bb = bbOf(g.boxes), H = bb.max[1] - bb.min[1];
      if (H > h - 0.1) { left.push(g); continue; }
      let pile = piles.filter((x) => x.y + H <= h - 0.08).sort((a, b) => a.y - b.y)[0];
      if (!pile && piles.length < maxTowers) piles.push((pile = { gs: [], y: 0 }));
      if (!pile) { left.push(g); continue; }
      pile.gs.push(g);
      pile.y += H;
    }
    const towers = piles.map((x) => x.gs);
    const placed: Box[] = [];
    const spots = towerSpots(ctx);
    let built = 0;
    for (const tw of towers) {
      // 1 つしか載らない塔は塔に見えないので、足元に倒れている物にする
      if (tw.length < 2) { left.push(...tw); continue; }
      let ok = false;
      for (const [x, z] of spots) {
        const saved = tw.map((g) => saveCoords(g.boxes));
        let yy = fy;
        for (const g of tw) {
          const bb = bbOf(g.boxes);
          placeGroupAt(g, x + ctx.rng.float(-0.06, 0.06), yy, z + ctx.rng.float(-0.06, 0.06));
          yy += bb.max[1] - bb.min[1];
        }
        const boxes = tw.flatMap((g) => g.boxes);
        const bb = bbOf(boxes);
        const inside = ctx.rects.some((r) => bb.min[0] >= r.x0 && bb.max[0] <= r.x1 && bb.min[2] >= r.z0 && bb.max[2] <= r.z1);
        const solids = boxes.filter((b) => b.solid);
        if (inside && !solids.some((b) => hitsAny(doors, b) || fixed.some((f) => overlaps(f, b, 0.05)) || placed.some((p) => overlaps(p, b, 0.3))) && addIfReachable(ctx, boxes)) {
          ok = true;
          placed.push(...solids);
          break;
        }
        tw.forEach((g, i) => loadCoords(g.boxes, saved[i]!));
      }
      if (ok) built++;
      else left.push(...tw);
    }
    if (!built) return false;
    // 段階 4（フロアの形の担当が足した）: 低い物 2 つだけの塔（膝の高さ）は塔に見えないので掛けない
    if (!placed.some((b) => b.min[1] > fy + 0.9)) return false;
    // 塔に載らなかった物: 塔の足元に倒れている（置けなければ片付ける）
    const base = bbOf(placed);
    for (const g of left) {
      const saved = saveCoords(g.boxes);
      const bb0 = bbOf(g.boxes);
      if (bb0.max[1] - bb0.min[1] > 2.2) continue;
      let ok = false;
      for (let i = 0; i < 10 && !ok; i++) {
        loadCoords(g.boxes, saved);
        const a = ctx.rng.float(0, Math.PI * 2), rr = ctx.rng.float(0.9, 2.2);
        const x = (base.min[0] + base.max[0]) / 2 + Math.cos(a) * rr, z = (base.min[2] + base.max[2]) / 2 + Math.sin(a) * rr;
        tipGroup(g, ctx.rng.chance(0.5) ? 'x' : 'z', ctx.rng.chance(0.5) ? 1 : -1, fy);
        placeGroupAt(g, x, fy, z);
        ok = fitsFree(ctx, g.boxes, [...fixed, ...placed], doors) && addIfReachable(ctx, g.boxes);
      }
      if (ok) placed.push(...g.boxes.filter((b) => b.solid));
    }
    return true;
  },
});

/** 箱を区画に足し、開口どうしが歩いてつながったままなら true（だめなら外して false） */
function addIfReachable(ctx: AnomalyContext, boxes: readonly Box[]): boolean {
  for (const b of boxes) ctx.addBox(b);
  if (ctx.reachOk()) return true;
  const set = new Set(boxes);
  ctx.removeBoxes((b) => set.has(b));
  return false;
}

/** 箱の組が部屋の中・開口の前の外・ほかの当たる物と重ならないか */
function fitsFree(ctx: AnomalyContext, boxes: Box[], others: readonly Box[], doors: readonly AABB[]): boolean {
  const bb = bbOf(boxes);
  if (bb.max[1] > ctx.cell.floorY + ctx.cell.height - 0.02) return false;
  if (!ctx.rects.some((r) => bb.min[0] >= r.x0 && bb.max[0] <= r.x1 && bb.min[2] >= r.z0 && bb.max[2] <= r.z1)) return false;
  return boxes.every((b) => !b.solid || (!hitsAny(doors, b) && !others.some((o) => overlaps(o, b, 0.02))));
}

/** 組を倒す（axis 軸の sign の側へ。倒れる側の下の辺を支点に）。倒した後の底は床 */
function tipGroup(g: Group, axis: 'x' | 'z', sign: 1 | -1, fy: number): void {
  const bb = bbOf(g.boxes);
  const k = axis === 'x' ? 0 : 2;
  const p = sign > 0 ? bb.max[k]! : bb.min[k]!;
  for (const b of g.boxes) tipBox(b, axis, sign, p, fy);
  const nb = bbOf(g.boxes);
  for (const b of g.boxes) moveBox(b, 0, fy - nb.min[1], 0);
}

// ---------------------------------------------------------------- 散乱

/** 散乱: 家具が倒れ、ずれ、散らばっている。床に紙が散り、照明が 1 つ切れている */
defineAnomaly({
  id: 'scatter', name: '散乱', weight: 0.9, intensity: 1, kinds: ['room', 'hall'], needsFurniture: true,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY;
    const groups = ctx.rng.shuffle(objectGroups(ctx.furniture, cell).filter((g) => !hasSlope(g)));
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.35);
    const mine = boxSet(groups);
    const fixed = interiorSolids(cell, mine);
    let moved = 0;
    for (const g of groups) {
      const saved = saveCoords(g.boxes);
      const others = [...fixed, ...groups.filter((x) => x !== g).flatMap((x) => x.boxes.filter((b) => b.solid))];
      const H = bbOf(g.boxes).max[1] - fy;
      // 倒す + 回す + ずらす → 回す + ずらす → ずらすだけ、の順に試す
      const tries: { tip: boolean; rot: boolean }[] = [{ tip: H < 2.2 && ctx.rng.chance(t['anomaly.scatter.tipChance']), rot: true }, { tip: false, rot: true }, { tip: false, rot: false }];
      let ok = false;
      for (const tr of tries) {
        for (let i = 0; i < 4 && !ok; i++) {
          loadCoords(g.boxes, saved);
          const bb = bbOf(g.boxes);
          if (tr.tip) tipGroup(g, ctx.rng.chance(0.5) ? 'x' : 'z', ctx.rng.chance(0.5) ? 1 : -1, fy);
          if (tr.rot) { const c = bbOf(g.boxes); for (const b of g.boxes) rotBoxY(b, ctx.rng.int(1, 3), (c.min[0] + c.max[0]) / 2, (c.min[2] + c.max[2]) / 2); }
          const a = ctx.rng.float(0, Math.PI * 2), rr = ctx.rng.float(0.2, t['anomaly.scatter.moveM']);
          placeGroupAt(g, (bb.min[0] + bb.max[0]) / 2 + Math.cos(a) * rr, fy + Math.max(0, bbOf(g.boxes).min[1] - fy), (bb.min[2] + bb.max[2]) / 2 + Math.sin(a) * rr);
          ok = fitsFree(ctx, g.boxes, others, doors) && ctx.reachOk();
        }
        if (ok) break;
      }
      if (ok) moved++;
      else loadCoords(g.boxes, saved);
    }
    if (!moved) return false;
    // 床に散った紙（当たらない）
    const solids = interiorSolids(cell);
    const area = ctx.rects.reduce((a, r) => a + rectArea(r), 0);
    for (let i = 0, n = Math.min(40, Math.round(area / 1.5)); i < n; i++) {
      const r = ctx.rng.pick(ctx.rects);
      const x = ctx.rng.float(r.x0 + 0.2, r.x1 - 0.2), z = ctx.rng.float(r.z0 + 0.2, r.z1 - 0.2);
      const along = ctx.rng.chance(0.5);
      const b = box([x - (along ? 0.15 : 0.105), fy + 0.002, z - (along ? 0.105 : 0.15)], [x + (along ? 0.15 : 0.105), fy + 0.005, z + (along ? 0.105 : 0.15)], 'signPlate', false);
      if (solids.some((s) => s.min[1] < fy + 0.05 && overlaps(s, { min: [b.min[0], s.min[1], b.min[2]], max: [b.max[0], s.max[1], b.max[2]] }))) continue;
      b.kind = 'scatteredPaper';
      ctx.addBox(b);
    }
    // 照明が 1 つ切れている（いちばん入口から遠いパネルと、その近くの点光源）
    const panels = cell.boxes.filter((b) => isCeilingPanel(cell, b));
    if (panels.length >= 3) {
      const e = ctx.entrance.pos;
      const far = panels.reduce((a, b) => (Math.hypot((b.min[0] + b.max[0]) / 2 - e[0], (b.min[2] + b.max[2]) / 2 - e[2]) > Math.hypot((a.min[0] + a.max[0]) / 2 - e[0], (a.min[2] + a.max[2]) / 2 - e[2]) ? b : a));
      far.mat = 'lightOff';
      const fx = (far.min[0] + far.max[0]) / 2, fz = (far.min[2] + far.max[2]) / 2;
      cell.lights = cell.lights.filter((l) => Math.hypot(l.pos[0] - fx, l.pos[2] - fz) > 1.2);
    }
    return true;
  },
});

// ---------------------------------------------------------------- 逆さま

/**
 * 逆さま: 部屋の中身が上下に鏡写し。家具は天井に付き、腰壁は天井際へ、照明のパネルは床に（当たらないので踏んで歩ける）。
 * 床と天井の材質も入れ替える。造作（組の無い当たる箱: 間仕切り・柱）はそのまま
 */
defineAnomaly({
  id: 'upsideDown', name: '逆さま', weight: 0.8, intensity: 3, kinds: ['room', 'hall'], needsFurniture: true, minRarity: 'Uncommon',
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const flip = ctx.furniture.filter((b) => !(b.solid && !b.propGroup) && !b.kind?.startsWith('lamp:') && !isFloorFixture(b));
    if (!flip.some((b) => b.solid)) return false;
    const flipped = new Set(flip);
    // 区画の殻: 天井の照明は床へ、床板と天井板の材質を入れ替える（家具を鏡写しにする前に、殻の照明を選んでおく）
    const pal = cell.palette;
    const shellPanels = cell.boxes.filter((b) => !flipped.has(b) && isCeilingPanel(cell, b));
    for (const b of flip) mirrorBoxY(b, fy, h);
    for (const b of shellPanels) mirrorBoxY(b, fy, h);
    for (const b of cell.boxes) {
      if (flipped.has(b)) continue;
      if (isFloorSlab(cell, b)) b.mat = pal.ceiling;
      else if (isCeilingSlab(cell, b)) b.mat = pal.floor;
    }
    cell.palette = { ...pal, floor: pal.ceiling, ceiling: pal.floor };
    cell.lights = cell.lights.map((l) => ({ ...l, pos: [l.pos[0], 2 * fy + h - l.pos[1], l.pos[2]] }));
    // 立って通れなくなったら、低く垂れ下がった物（背の高い棚・ロッカー）を片付ける
    if (!ctx.reachOk()) {
      const low = new Set(objectGroups(ctx.furniture, cell).filter((g) => g.boxes.some((b) => b.solid && b.min[1] < fy + 1.8)).flatMap((g) => g.boxes));
      ctx.removeBoxes((b) => low.has(b));
    }
    return true;
  },
});
