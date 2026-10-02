/**
 * 家具の異変（段階 4・oddity）: 家具が一か所に集まる（X10）・回転と大きさ（X11）・別の部屋の家具（X12）・前の部屋の物（X06）。
 * 家具（区画の中身が置いた物）を物ごとに動かす・大きくする・宙で回す・よその部屋の物を持ち込む。
 */
import type { AABB } from '../../../../math/aabb.ts';
import type { Rect } from '../../../../world/footprint.ts';
import { themePalette } from '../../../../world/palettes.ts';
import { box, WALL_T, type Box, type CellLayout } from '../../../../world/layout.ts';
import { shelfIsland } from '../../../dress/props.ts';
import { dressCell } from '../../../dress/index.ts';
import { defineAnomaly, type AnomalyContext } from '../../types.ts';
import {
  bbOf, boxSet, doorFronts, groupsOf, hitsAny, interiorSolids, isFloorFixture, isWallDecor, loadCoords, mainRect, mirrorBoxY, moveBox, objectGroups, overlaps, saveCoords, scaleBox, tipBox, type Group,
} from '../../util.ts';
import { MAZE_THEMES } from '../scale.ts';
import { addGroup, boxesJ, centerXZ, floorSheet, lanes, lift, roomFx } from './common.ts';

const POOL_THEMES = new Set(['PoolCorridor']);
const hasSlope = (g: Group): boolean => g.boxes.some((b) => b.slope);

/** 組の xz の中心を (x, z) へ、底を y へ */
function placeAt(g: readonly Box[], x: number, y: number, z: number): void {
  const bb = bbOf(g);
  const dx = x - (bb.min[0] + bb.max[0]) / 2, dz = z - (bb.min[2] + bb.max[2]) / 2, dy = y - bb.min[1];
  for (const b of g) moveBox(b, dx, dy, dz);
}

/** 組を倒す（axis 軸の sign の側へ）。倒した後の底は床 */
function tipGroup(boxes: readonly Box[], axis: 'x' | 'z', sign: 1 | -1, fy: number): void {
  const bb = bbOf(boxes);
  const k = axis === 'x' ? 0 : 2;
  const p = sign > 0 ? bb.max[k]! : bb.min[k]!;
  for (const b of boxes) tipBox(b, axis, sign, p, fy);
  const nb = bbOf(boxes);
  for (const b of boxes) moveBox(b, 0, fy - nb.min[1], 0);
}

/** 組が部屋の中・開口の前の外・ほかの当たる物と重ならない所にあるか */
function free(ctx: AnomalyContext, boxes: readonly Box[], others: readonly Box[], doors: readonly AABB[], gap = 0.03): boolean {
  const bb = bbOf(boxes);
  if (bb.max[1] > ctx.cell.floorY + ctx.cell.height - 0.02) return false;
  if (!ctx.rects.some((r) => bb.min[0] >= r.x0 + 0.01 && bb.max[0] <= r.x1 - 0.01 && bb.min[2] >= r.z0 + 0.01 && bb.max[2] <= r.z1 - 0.01)) return false;
  return boxes.every((b) => !b.solid || (!hitsAny(doors, b) && !others.some((o) => overlaps(o, b, gap))));
}

/** 点 (x, z) からいちばん近い置ける所へ組を動かす（0.2 m の格子を近い順に）。置けたら true、だめなら元に戻して false */
function nearestFit(ctx: AnomalyContext, boxes: Box[], x: number, z: number, others: readonly Box[], doors: readonly AABB[], maxR = 6): boolean {
  const saved = saveCoords(boxes);
  const fy = ctx.cell.floorY;
  const cand: [number, number, number][] = [];
  const step = 0.2;
  for (let i = -Math.ceil(maxR / step); i <= Math.ceil(maxR / step); i++) for (let k = -Math.ceil(maxR / step); k <= Math.ceil(maxR / step); k++) {
    const d = Math.hypot(i, k) * step;
    if (d <= maxR) cand.push([x + i * step, z + k * step, d]);
  }
  cand.sort((a, b) => a[2] - b[2]);
  const y0 = Math.max(fy, bbOf(boxes).min[1]);
  for (const [cx, cz] of cand) {
    placeAt(boxes, cx, y0, cz);
    if (free(ctx, boxes, others, doors)) return true;
  }
  loadCoords(boxes, saved);
  return false;
}

/** 箱を区画に足して、開口どうしがつながったままなら true（だめなら外す） */
function addIfReach(ctx: AnomalyContext, boxes: readonly Box[]): boolean {
  for (const b of boxes) ctx.addBox(b);
  if (ctx.reachOk()) return true;
  const set = new Set(boxes);
  ctx.removeBoxes((b) => set.has(b));
  return false;
}

// ---------------------------------------------------------------- X10 家具が一か所に集まる

/**
 * 家具が一か所に集まる: 部屋の家具が全部、入口からいちばん遠い隅にぎっしり寄せられている。部屋の残りはがらんと空いて、
 * 床には家具を引きずった跡が隅へ向かって残っている
 */
defineAnomaly({
  id: 'huddle', name: '家具が一か所に集まる', weight: 0.7, intensity: 1, kinds: ['room', 'hall'], needsFurniture: true, minSize: [3.6, 4],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const groups = objectGroups(ctx.furniture, cell).filter((g) => !hasSlope(g) && bbOf(g.boxes).min[1] < fy + 0.05);
    if (groups.length < 3) return false;
    const r = mainRect(cell);
    const e = ctx.entrance.pos;
    const corners: [number, number][] = [[r.x0 + 0.4, r.z0 + 0.4], [r.x1 - 0.4, r.z0 + 0.4], [r.x0 + 0.4, r.z1 - 0.4], [r.x1 - 0.4, r.z1 - 0.4]];
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
    const okCorner = corners.filter(([x, z]) => !hitsAny(doors, { min: [x - 1, fy, z - 1], max: [x + 1, fy + 1, z + 1] }));
    const [kx, kz] = (okCorner.length ? okCorner : corners).sort((a, b) => Math.hypot(b[0] - e[0], b[1] - e[2]) - Math.hypot(a[0] - e[0], a[1] - e[2]))[0]!;
    const mine = boxSet(groups);
    const fixed = interiorSolids(cell, mine);
    ctx.removeBoxes((b) => mine.has(b));
    const foot = (g: Group): number => { const bb = bbOf(g.boxes); return (bb.max[0] - bb.min[0]) * (bb.max[2] - bb.min[2]); };
    const placed: Box[] = [];
    const marks: Box[] = [];
    let moved = 0;
    for (const g of groups.slice().sort((a, b) => foot(b) - foot(a))) {
      const [ox, oz] = centerXZ(g.boxes);
      if (!nearestFit(ctx, g.boxes, kx, kz, [...fixed, ...placed], doors, 7)) continue;
      if (!addIfReach(ctx, g.boxes)) continue;
      placed.push(...g.boxes.filter((b) => b.solid));
      moved++;
      // 引きずった跡（元の位置から隅へ。L 字の 2 本）
      const [nx, nz] = centerXZ(g.boxes);
      if (Math.hypot(nx - ox, nz - oz) > 1) {
        const w = 0.05, y = fy + 0.001;
        marks.push(box([Math.min(ox, nx) - w, y, oz - w], [Math.max(ox, nx) + w, y + 0.003, oz + w], 'shadowDecal', false));
        marks.push(box([nx - w, y, Math.min(oz, nz) - w], [nx + w, y + 0.003, Math.max(oz, nz) + w], 'shadowDecal', false));
      }
    }
    if (moved < 3) return false;
    addGroup(ctx, marks, 'dragMarks');
    return true;
  },
});

// ---------------------------------------------------------------- X11 回転と大きさ

/**
 * 回転と大きさ: 普通の部屋の中で、1 つの家具だけが巨大（2.2〜2.8 倍）、1 つは頭の上の宙に浮いてゆっくり回っている。
 * ほかにも逆さまに置かれた物・横倒しの物が混じる
 */
defineAnomaly({
  id: 'oddScale', name: '回転と大きさ', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], needsFurniture: true, minSize: [3.6, 4], minHeight: 2.4,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const groups = ctx.rng.shuffle(objectGroups(ctx.furniture, cell).filter((g) => !hasSlope(g) && !isWallDecor(g, cell) && bbOf(g.boxes).min[1] < fy + 0.05));
    if (groups.length < 3) return false;
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
    const done = new Set<Group>();
    // 宙で回る物（小さい物）
    const small = groups.find((g) => { const bb = bbOf(g.boxes); return bb.max[1] - bb.min[1] <= 0.95 && (bb.max[0] - bb.min[0]) * (bb.max[2] - bb.min[2]) <= 1.0; });
    let spun = false;
    if (small && h >= 2.4) {
      const bb = bbOf(small.boxes);
      const H = bb.max[1] - bb.min[1];
      const cy = fy + Math.min(h - H / 2 - 0.12, 1.9 + H / 2);
      const [cx, cz] = centerXZ(small.boxes);
      const set = new Set(small.boxes);
      ctx.removeBoxes((b) => set.has(b));
      const boxes = small.boxes.map((b): Box => ({ ...b, min: [b.min[0], b.min[1] - bb.min[1] + cy - H / 2, b.min[2]], max: [b.max[0], b.max[1] - bb.min[1] + cy - H / 2, b.max[2]], solid: false }));
      roomFx(ctx, { kind: 'spin', boxes: boxesJ(boxes), center: [cx, cy, cz], axis: 'y', speed: t['anomaly.oddScale.spin'], bob: 0.06 });
      done.add(small);
      spun = true;
    }
    // 巨大な物（低い物を 1 つ）
    let giant = false;
    const fixedAll = (): Box[] => interiorSolids(cell);
    for (const g of groups) {
      if (done.has(g) || giant) continue;
      const bb = bbOf(g.boxes);
      const H = bb.max[1] - fy;
      if (H > 1.3 || H < 0.3) continue;
      const s = Math.min(ctx.rng.float(t['anomaly.oddScale.giantMin'], Math.max(t['anomaly.oddScale.giantMin'], t['anomaly.oddScale.giantMax'])), (h - 0.1) / H);
      if (s < 1.8) continue;
      const saved = saveCoords(g.boxes);
      const set = new Set(g.boxes);
      ctx.removeBoxes((b) => set.has(b));
      const [cx, cz] = centerXZ(g.boxes);
      for (const b of g.boxes) scaleBox(b, s, cx, fy, cz);
      // 拡大した脚・側板は当たる
      for (const b of g.boxes) if (!b.solid && b.min[1] < fy + 0.3 && b.max[1] - b.min[1] >= 0.5 && b.max[1] - b.min[1] > Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2])) b.solid = true;
      if (nearestFit(ctx, g.boxes, cx, cz, fixedAll(), doors, 5) && addIfReach(ctx, g.boxes)) { giant = true; done.add(g); continue; }
      loadCoords(g.boxes, saved);
      for (const b of g.boxes) ctx.addBox(b);
    }
    // 逆さま・横倒し（2 つまで）
    let odd = 0;
    for (const g of groups) {
      if (done.has(g) || odd >= 2) continue;
      const saved = saveCoords(g.boxes);
      const bb = bbOf(g.boxes);
      if (ctx.rng.chance(0.5)) for (const b of g.boxes) mirrorBoxY(b, bb.min[1], bb.max[1] - bb.min[1]);
      else tipGroup(g.boxes, ctx.rng.chance(0.5) ? 'x' : 'z', ctx.rng.chance(0.5) ? 1 : -1, fy);
      const others = interiorSolids(cell, new Set(g.boxes));
      if (free(ctx, g.boxes, others, doors) && ctx.reachOk()) { odd++; done.add(g); continue; }
      loadCoords(g.boxes, saved);
    }
    // 宙で回る物か巨大な物のどちらかがあれば、扉を開けた瞬間に分かる
    return spun || giant;
  },
});

// ---------------------------------------------------------------- X12 別の部屋の家具

/** 持ち込む「よその部屋」のテーマ（区画の中身の作り方）。プール・迷路・駐車場は除く */
const FOREIGN = ['ShelfGrid', 'Theater', 'Classroom', 'OfficeGrid', 'Restroom', 'LockerRoom', 'PlayArea', 'Gallery', 'ServerGrid', 'RetailGrid', 'WarehouseGrid', 'Terminal', 'CorridorHospital', 'CorridorHotel'];

/**
 * 別の部屋の家具: 部屋の一角が、まるごとよその部屋になっている（プールに図書館の本棚、事務所に劇場の座席、教室にトイレの個室）。
 * その一角だけ床もよその部屋の床。よその部屋の中身は、その部屋のテーマの作り方でそのまま置く
 */
defineAnomaly({
  id: 'misplaced', name: '別の部屋の家具', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], minSize: [4, 4.6], minHeight: 2.4,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  pre(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const r = mainRect(cell);
    const ins = { x0: r.x0 + 0.2, z0: r.z0 + 0.2, x1: r.x1 - 0.2, z1: r.z1 - 0.2 };
    const doors = doorFronts(cell, ctx.geo.openings, 1.6, 0.5);
    const ways = lanes(ctx, 1.1, 1.2);
    const W = ins.x1 - ins.x0, D = ins.z1 - ins.z0;
    const e = ctx.entrance.pos;
    let best: { r: Rect; d: number } | null = null;
    for (let k = 0; k < 90; k++) {
      // 大きい一角から試し、だめなら小さく
      const big = k < 45;
      const w = Math.min(W - 1.0, ctx.rng.float(big ? 2.4 : 1.8, big ? 4.2 : 2.6)), d = Math.min(D - 1.0, ctx.rng.float(big ? 2.4 : 1.8, big ? 4.2 : 2.6));
      if (w < 1.8 || d < 1.8) continue;
      const x0 = ctx.rng.float(ins.x0, ins.x1 - w), z0 = ctx.rng.float(ins.z0, ins.z1 - d);
      const sub: Rect = { x0, z0, x1: x0 + w, z1: z0 + d };
      const a: AABB = { min: [sub.x0, fy, sub.z0], max: [sub.x1, fy + 2.5, sub.z1] };
      if (hitsAny(doors, a) || hitsAny(ways, a) || interiorSolids(cell).some((s) => overlaps(s, a))) continue;
      const dist = Math.hypot((sub.x0 + sub.x1) / 2 - e[0], (sub.z0 + sub.z1) / 2 - e[2]);
      if (!best || dist > best.d) best = { r: sub, d: dist };
    }
    if (!best) return false;
    ctx.memo.sub = best.r;
    ctx.keepOut({ min: [best.r.x0 - 0.3, fy - 0.1, best.r.z0 - 0.3], max: [best.r.x1 + 0.3, fy + cell.height, best.r.z1 + 0.3] });
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const sub = ctx.memo.sub as Rect | undefined;
    if (!sub) return false;
    const pool = FOREIGN.filter((th) => th !== cell.theme);
    const theme = ctx.rng.pick(pool);
    ctx.memo.theme = theme;
    // よその部屋を、その一角だけの仮の区画として作り、中身を写す
    // 仮の区画の足跡は一角を壁の厚みだけ広げる（中身の作り方は壁の内側に置くので、置ける所がちょうど一角になる）
    const X = { x0: sub.x0 - WALL_T, z0: sub.z0 - WALL_T, x1: sub.x1 + WALL_T, z1: sub.z1 + WALL_T };
    const tmp: CellLayout = {
      id: `${cell.id}~${theme}`, role: cell.role, bounds: { min: [X.x0, fy - 0.2, X.z0], max: [X.x1, fy + cell.height + 0.2, X.z1] },
      footprint: [X], height: cell.height, floorY: fy, palette: { ...themePalette(theme), light: cell.palette.light }, boxes: [], lights: [], zones: [], theme,
    };
    dressCell({ cell: tmp, kind: 'room', openings: [], keepOut: [], rng: ctx.rng.fork('foreign'), density: 0.65 });
    const items = tmp.boxes.filter((b) => !isFloorFixture(b) && b.min[1] >= fy - 0.01 && b.max[1] <= fy + cell.height - 0.01);
    if (items.filter((b) => b.solid).length < 2) {
      // よその部屋の作り方が何も置けない狭い一角: 書庫の本棚の島（どの部屋にあっても場違い）
      items.length = 0;
      const B: Box[] = [];
      const alongX = sub.x1 - sub.x0 >= sub.z1 - sub.z0;
      const cx = (sub.x0 + sub.x1) / 2, cz = (sub.z0 + sub.z1) / 2;
      const hl = Math.min(1.6, (alongX ? sub.x1 - sub.x0 : sub.z1 - sub.z0) / 2 - 0.1);
      shelfIsland(B, ctx.rng, alongX ? cx - hl : cx - 0.45, alongX ? cz - 0.45 : cz - hl, alongX ? cx + hl : cx + 0.45, alongX ? cz + 0.45 : cz + hl, Math.min(2.0, cell.height - 0.3), 'bookshelfWood', 'books');
      for (const b of lift(B, fy)) items.push(b);
      ctx.memo.theme = 'ShelfGrid';
    }
    if (items.filter((b) => b.solid).length < 1) return false;
    for (const b of items) b.propGroup = `${cell.id}/x-${b.propGroup ?? 'item'}`;
    const floor = floorSheet(sub, fy, themePalette(theme).floor, 0.008);
    floor.propGroup = `${cell.id}/x-floor`;
    ctx.addBox(floor);
    for (const b of items) ctx.addBox(b);
    if (!ctx.reachOk()) return false;
    return true;
  },
});

// ---------------------------------------------------------------- X06 前の部屋の物

/**
 * 前の部屋の物: さっき通った部屋の大きな家具（自販機・ソファ・棚 …）が、同じ並びでこの部屋にもある。床・壁・照明の色も前の部屋と同じ。
 * 「さっきの部屋に戻った？」と思わせて、扉の位置が違う
 */
defineAnomaly({
  id: 'carryover', name: '前の部屋の物', weight: 0.6, intensity: 0, kinds: ['room', 'hall'], minSize: [3.4, 4],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const prev = ctx.prev;
    if (!prev || prev.cell === cell) return false;
    const pc = prev.cell;
    const theirs = groupsOf(pc.boxes.filter((b) => b.propGroup && !b.propGroup.includes('/a-') && !isFloorFixture(b) && b.min[1] >= pc.floorY - 0.01)).filter((g) => g.solid && !isWallDecor(g, pc) && !hasSlope(g));
    if (theirs.length < 2) return false;
    const vol = (g: Group): number => { const bb = bbOf(g.boxes); return (bb.max[0] - bb.min[0]) * (bb.max[1] - bb.min[1]) * (bb.max[2] - bb.min[2]); };
    const pick = theirs.sort((a, b) => vol(b) - vol(a)).slice(0, ctx.tuning['anomaly.carryover.items']);
    // 前の部屋の中心から見た位置を、この部屋の中心から同じだけずらした所へ
    const pr = mainRect(pc), r = mainRect(cell);
    const pcx = (pr.x0 + pr.x1) / 2, pcz = (pr.z0 + pr.z1) / 2, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
    let copied = 0;
    for (const g of pick) {
      const boxes = g.boxes.map((b) => ({ ...b, min: [...b.min], max: [...b.max] } as Box));
      for (const b of boxes) moveBox(b, cx - pcx, fy - pc.floorY, cz - pcz);
      const [x, z] = centerXZ(boxes);
      // この部屋の家具とぶつかるなら、この部屋の家具の方をどける
      const bb = bbOf(boxes);
      const clash = new Set(objectGroups(ctx.furniture, cell).filter((o) => o.boxes.some((b) => b.solid && overlaps(b, bb, 0.05))).flatMap((o) => o.boxes));
      if (clash.size) ctx.removeBoxes((b) => clash.has(b));
      if (!nearestFit(ctx, boxes, x, z, interiorSolids(cell), doors, 3)) continue;
      for (const b of boxes) b.propGroup = `${cell.id}/c-${g.key}`;
      if (!addIfReach(ctx, boxes)) continue;
      copied++;
    }
    if (copied < 1) return false;
    // 床・壁・天井・照明の色も前の部屋と同じ
    const old = cell.palette;
    for (const b of cell.boxes) {
      if (b.propGroup) continue;
      if (b.mat === old.floor) b.mat = pc.palette.floor;
      else if (b.mat === old.wall) b.mat = pc.palette.wall;
      else if (b.mat === old.ceiling) b.mat = pc.palette.ceiling;
    }
    cell.palette = { ...old, floor: pc.palette.floor, wall: pc.palette.wall, ceiling: pc.palette.ceiling, lightColor: pc.palette.lightColor, ambient: pc.palette.ambient };
    cell.lights = cell.lights.map((l) => ({ ...l, color: pc.palette.lightColor }));
    if (pc.audioPreset) cell.audioPreset = pc.audioPreset;
    ctx.memo.from = pc.id;
    return true;
  },
});
