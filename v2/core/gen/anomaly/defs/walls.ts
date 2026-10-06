/**
 * 壁の異変: 扉だらけ（壁が開かない扉で埋まっている。天井と床にも扉）・時計だらけ（壁一面の時計）。
 * 本物の開口（扉・隠しの扉）の前後は空ける。隠しの扉のある部屋なら、たくさんの扉の中に 1 つだけ本物が混じる。
 */
import { along } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { decorDoor, doorPlate, wallClock } from '../../dress/decor.ts';
import { alongFace, innerFaces, type Face } from '../../dress/geom.ts';
import { defineAnomaly, type AnomalyContext } from '../types.ts';
import { bbOf, doorFronts, groupsOf, hitsAny, interiorSolids, isCeilingPanel, isFloorFixture, overlaps } from '../util.ts';
import { MAZE_THEMES } from './scale.ts';

/** 面 f の上で、本物の開口（± pad）を除いた区間（壁の厚みの分だけ端を縮める） */
function freeSpans(ctx: AnomalyContext, f: Face, pad: number): [number, number][] {
  const cuts = ctx.geo.openings
    .filter((o) => o.dir === f.dir && Math.abs((o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0]) - f.coord) < 0.05)
    .map((o) => { const t = along(o.dir, o.pos[0], o.pos[2]); return [t - o.width / 2 - pad, t + o.width / 2 + pad] as [number, number]; })
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = f.a0 + WALL_T + 0.08;
  const end = f.a1 - WALL_T - 0.08;
  for (const [p, q] of cuts) { if (p > cur) out.push([cur, Math.min(p, end)]); cur = Math.max(cur, q); }
  if (end > cur) out.push([cur, end]);
  return out.filter(([p, q]) => q - p > 0.3);
}

/** 作業座標（床 = 0）の箱をフロア座標へ上げ、propGroup を区画の中で一意にする */
function lifted(B: Box[], cellId: string, fy: number): Box[] {
  for (const b of B) {
    b.min = [b.min[0], b.min[1] + fy, b.min[2]];
    b.max = [b.max[0], b.max[1] + fy, b.max[2]];
    if (b.propGroup && !b.propGroup.startsWith(`${cellId}/`)) b.propGroup = `${cellId}/${b.propGroup}`;
  }
  return B;
}

/** 壁の飾り（当たらない物）のうち、boxes に重なるものを組ごと外す（扉・時計の下に掲示板や窓が透けないように） */
function clearWallDecor(ctx: AnomalyContext, boxes: readonly Box[]): void {
  const bb = boxes.map((b) => ({ min: [b.min[0] - 0.03, b.min[1], b.min[2] - 0.03], max: [b.max[0] + 0.03, b.max[1], b.max[2] + 0.03] }) as Box);
  const hit = new Set<Box>();
  for (const g of groupsOf(ctx.furniture)) {
    if (g.solid || g.boxes.some(isFloorFixture)) continue;
    if (g.boxes.some((b) => hitsAny(bb, b))) for (const b of g.boxes) hit.add(b);
  }
  if (hit.size) ctx.removeBoxes((b) => hit.has(b));
}

/** 平らな扉（天井・床に貼る。当たらない）: 枠 + 板 + 取っ手。y は面の高さ、up は板を出す向き（+1 上 / -1 下） */
function flatDoor(B: Box[], x: number, z: number, alongX: boolean, y: number, up: 1 | -1, mat: MatId): void {
  const w = 0.9, l = 2.05;
  const hx = alongX ? l / 2 : w / 2, hz = alongX ? w / 2 : l / 2;
  const ys = (a: number, b: number): [number, number] => (up > 0 ? [y + a, y + b] : [y - b, y - a]);
  const [f0, f1] = ys(0, 0.02), [p0, p1] = ys(0.02, 0.045), [k0, k1] = ys(0.045, 0.07);
  B.push(box([x - hx - 0.065, f0, z - hz - 0.065], [x + hx + 0.065, f1, z + hz + 0.065], 'trim', false));
  B.push(box([x - hx, p0, z - hz], [x + hx, p1, z + hz], mat, false));
  const kx = alongX ? x + hx - 0.2 : x + hx - 0.12, kz = alongX ? z + hz - 0.12 : z + hz - 0.2;
  B.push(box([kx - 0.05, k0, kz - 0.015], [kx + 0.05, k1, kz + 0.015], 'metal', false));
}

/** 扉だらけ: 壁が開かない扉で埋まっている（家具は壁から離して置かせる）。天井に 1〜2 枚、床に 1 枚の扉も */
defineAnomaly({
  id: 'doors', name: '扉だらけ', weight: 0.7, intensity: 2, kinds: ['room', 'hall'], minHeight: 2.3, minRarity: 'Uncommon',
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  pre(ctx) {
    // 壁際に家具を置かせない（扉の前を空ける）
    const fy = ctx.cell.floorY;
    for (const f of innerFaces(ctx.cell.footprint)) {
      const b = alongFace(f, f.a0, f.a1 - f.a0, 0, 0.6, fy, fy + 2.3, 'void', false);
      ctx.keepOut({ min: b.min, max: b.max });
    }
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height, t = ctx.tuning;
    const dw = 0.9, pitch = dw + 0.13 + t['anomaly.doors.gap'];
    const solids = interiorSolids(cell);
    const all: Box[] = [];
    const mats: MatId[] = [cell.palette.door, cell.palette.door, cell.palette.door, 'doorWood', 'doorMetal'];
    for (const f of innerFaces(cell.footprint)) {
      for (const [p, q] of freeSpans(ctx, f, 0.35)) {
        const n = Math.floor((q - p + t['anomaly.doors.gap']) / pitch);
        if (n <= 0) continue;
        const start = (p + q) / 2 - ((n - 1) * pitch) / 2;
        for (let i = 0; i < n; i++) {
          const at = start + i * pitch;
          const B: Box[] = [];
          decorDoor(B, f, at, ctx.rng.pick(mats));
          if (ctx.rng.chance(0.5)) doorPlate(B, f, at);
          lifted(B, cell.id, fy);
          // 壁際に残った当たる物（造作・先に置かれた物）の所には付けない
          const bb = bbOf(B);
          if (solids.some((s) => overlaps(s, bb, 0.02))) continue;
          all.push(...B);
        }
      }
    }
    if (all.length < 12) return false;
    clearWallDecor(ctx, all);
    for (const b of all) ctx.addBox(b);
    // 天井の扉（照明のパネルに重ねない）と床の扉（開口の前・家具に重ねない）
    const panels = cell.boxes.filter((b) => isCeilingPanel(cell, b));
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.35);
    const flat = (y: number, up: 1 | -1, count: number): void => {
      for (let i = 0, made = 0; i < 16 && made < count; i++) {
        const r = ctx.rng.pick(ctx.rects);
        const alongX = ctx.rng.chance(0.5);
        const hx = alongX ? 1.1 : 0.55, hz = alongX ? 0.55 : 1.1;
        if (r.x1 - r.x0 < 2 * hx + 0.4 || r.z1 - r.z0 < 2 * hz + 0.4) continue;
        const x = ctx.rng.float(r.x0 + hx + 0.2, r.x1 - hx - 0.2), z = ctx.rng.float(r.z0 + hz + 0.2, r.z1 - hz - 0.2);
        const B: Box[] = [];
        flatDoor(B, x, z, alongX, y, up, ctx.rng.pick(mats));
        const bb = bbOf(B);
        const probe = { min: [bb.min[0], fy - 0.05, bb.min[2]], max: [bb.max[0], fy + h + 0.05, bb.max[2]] } as Box;
        if (up < 0 ? panels.some((p) => overlaps(p, probe, 0.1)) : hitsAny(doors, bb) || interiorSolids(cell).some((s) => s.min[1] < fy + 0.1 && overlaps(s, probe, 0.1))) continue;
        for (const b of B) { b.propGroup = `${cell.id}/a-flatDoor@${x.toFixed(2)},${z.toFixed(2)}`; ctx.addBox(b); }
        made++;
      }
    };
    flat(fy + h, -1, ctx.rng.int(1, 2));
    flat(fy, 1, 1);
    return true;
  },
});

/** 時計だらけ: 壁一面に、大きさも高さもばらばらの時計（どれも同じ時刻）。家具の陰と開口の前後は避ける */
defineAnomaly({
  id: 'clocks', name: '時計だらけ', weight: 0.5, intensity: 0, kinds: ['room', 'hall'], minHeight: 2.3,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const solids = interiorSolids(cell);
    const placed: Box[] = [];
    const all: Box[] = [];
    const faces = innerFaces(cell.footprint).filter((f) => f.a1 - f.a0 > 1.2);
    const per = faces.reduce((a, f) => a + (f.a1 - f.a0), 0);
    const want = Math.min(90, Math.round(per * 1.4));
    for (let i = 0; i < want * 4 && placed.length < want; i++) {
      const f = ctx.rng.pick(faces);
      const spans = freeSpans(ctx, f, 0.3);
      if (!spans.length) continue;
      const [p, q] = ctx.rng.pick(spans);
      const size = ctx.rng.float(0.22, 0.55);
      if (q - p < size + 0.1) continue;
      const at = ctx.rng.float(p + size / 2, q - size / 2);
      const y = ctx.rng.float(0.9 + size / 2, Math.max(0.95 + size / 2, h - 0.25 - size / 2));
      const B: Box[] = [];
      wallClock(B, f, at, y, size);
      lifted(B, cell.id, fy);
      const bb = bbOf(B);
      if (bb.max[1] > fy + h - 0.05 || solids.some((s) => overlaps(s, bb, 0.04)) || placed.some((c) => overlaps(c, bb, 0.03))) continue;
      for (const b of B) b.propGroup = `${cell.id}/a-clock@${f.dir},${at.toFixed(2)},${y.toFixed(2)}`;
      placed.push(bb as Box);
      all.push(...B);
    }
    if (placed.length < 10) return false;
    clearWallDecor(ctx, all);
    for (const b of all) ctx.addBox(b);
    return true;
  },
});
