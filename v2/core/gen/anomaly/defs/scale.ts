/**
 * 家具の大きさが変わる異変: 巨大な家具（2.5〜3 倍。机の下をくぐれる）・小さな家具（0.3 倍。人形の家）。
 * 家具（区画の中身が置いた物）を物ごとに、床の上の足元を中心に拡大・縮小する。壁際の物は壁に付けたまま。
 */
import type { Rect } from '../../../world/footprint.ts';
import type { Box, MatId } from '../../../world/layout.ts';
import { innerFaces, alongFace, onFace, type Face } from '../../dress/geom.ts';
import { defineAnomaly, type AnomalyContext } from '../types.ts';
import { bbOf, boxSet, doorFronts, hitsAny, interiorSolids, moveBox, objectGroups, overlaps, saveCoords, loadCoords, scaleBox } from '../util.ts';

/** 迷路の作り（壁が造作なので、家具を動かす異変は掛けない） */
export const MAZE_THEMES = new Set(['MazeGrid', 'ServiceMaze']);

/** 物の足元の矩形（その物が載っている壁の内側の矩形） */
function rectOf(ctx: AnomalyContext, x: number, z: number): Rect {
  return ctx.rects.find((r) => x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05) ?? ctx.rects[0]!;
}

/** 拡大・縮小の中心: 壁に付いている辺はその辺（壁に付けたまま）、そうでなければ真ん中 */
function anchorOf(lo: number, hi: number, w0: number, w1: number): number {
  if (lo - w0 < 0.2) return lo;
  if (w1 - hi < 0.2) return hi;
  return (lo + hi) / 2;
}

/** 拡大した物の脚・側板（床に立つ太い縦の板）は当たるようにする（巨大な脚をすり抜けない） */
function solidLegs(boxes: Box[], fy: number): void {
  for (const b of boxes) {
    if (b.solid || b.kind === 'emitOnly' || b.slope) continue;
    const dx = b.max[0] - b.min[0], dy = b.max[1] - b.min[1], dz = b.max[2] - b.min[2];
    // 床の近くから立つ縦の部材（脚・支柱・側板）
    if (b.min[1] < fy + 0.3 && dy >= 0.5 && dy > Math.max(dx, dz) && Math.min(dx, dz) >= 0.06) b.solid = true;
  }
}

/**
 * 箱の組を、部屋の中・開口の前の外・ほかの当たる物と重ならない所へずらして収める（渦巻き状に探す）。収まれば true
 */
function fitInRoom(ctx: AnomalyContext, boxes: Box[], others: readonly Box[], doors: ReturnType<typeof doorFronts>): boolean {
  const bb = bbOf(boxes);
  const r = rectOf(ctx, (bb.min[0] + bb.max[0]) / 2, (bb.min[2] + bb.max[2]) / 2);
  if (bb.max[0] - bb.min[0] > r.x1 - r.x0 - 0.04 || bb.max[2] - bb.min[2] > r.z1 - r.z0 - 0.04) return false;
  // まず部屋の中へ
  const dx0 = Math.max(0, r.x0 + 0.02 - bb.min[0]) - Math.max(0, bb.max[0] - (r.x1 - 0.02));
  const dz0 = Math.max(0, r.z0 + 0.02 - bb.min[2]) - Math.max(0, bb.max[2] - (r.z1 - 0.02));
  for (const b of boxes) moveBox(b, dx0, 0, dz0);
  const solids = boxes.filter((b) => b.solid);
  const ok = (): boolean => {
    const c = bbOf(boxes);
    if (c.min[0] < r.x0 - 1e-6 || c.max[0] > r.x1 + 1e-6 || c.min[2] < r.z0 - 1e-6 || c.max[2] > r.z1 + 1e-6) return false;
    return solids.every((b) => !hitsAny(doors, b) && !others.some((o) => overlaps(o, b, 0.08)));
  };
  const step = 0.4;
  let px = 0, pz = 0;
  for (let ring = 0; ring <= 10; ring++) {
    for (let iz = -ring; iz <= ring; iz++) for (let ix = -ring; ix <= ring; ix++) {
      if (Math.max(Math.abs(ix), Math.abs(iz)) !== ring) continue;
      for (const b of boxes) moveBox(b, ix * step - px, 0, iz * step - pz);
      px = ix * step; pz = iz * step;
      if (ok()) return true;
    }
  }
  return false;
}

/** 巨大な家具: 家具が 2.5〜3 倍。座る物・置く物を優先して数個だけ残し、ほかは片付ける（巨大な物しか入らない） */
defineAnomaly({
  id: 'giant', name: '巨大な家具', weight: 1, intensity: 2, kinds: ['room', 'hall'], needsFurniture: true, minHeight: 2.4, minSize: [3.8, 4.2],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const s = ctx.rng.float(t['anomaly.giant.scaleMin'], Math.max(t['anomaly.giant.scaleMin'], t['anomaly.giant.scaleMax']));
    const groups = objectGroups(ctx.furniture, cell);
    const mine = boxSet(groups);
    const fixed = interiorSolids(cell, mine);
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.35);
    // 背の低い物（椅子・机・ゴミ箱・鉢植え）を先に。背の高い物（棚・ロッカー）は天井につかえて小さくしか大きくならない
    const order = ctx.rng.shuffle(groups.slice()).sort((a, b) => Number(bbOf(a.boxes).max[1] - fy > 1.3) - Number(bbOf(b.boxes).max[1] - fy > 1.3));
    ctx.removeBoxes((b) => mine.has(b));
    const placed: Box[] = [];
    let kept = 0;
    for (const g of order) {
      if (kept >= t['anomaly.giant.max']) break;
      const bb = bbOf(g.boxes);
      const H = bb.max[1] - fy;
      if (H < 0.1 || bb.min[1] < fy - 0.05) continue;
      const sg = Math.min(s, (h - 0.06) / H);
      if (sg < 1.8) continue;
      const saved = saveCoords(g.boxes);
      const r = rectOf(ctx, (bb.min[0] + bb.max[0]) / 2, (bb.min[2] + bb.max[2]) / 2);
      const ax = anchorOf(bb.min[0], bb.max[0], r.x0, r.x1), az = anchorOf(bb.min[2], bb.max[2], r.z0, r.z1);
      for (const b of g.boxes) scaleBox(b, sg, ax, fy, az);
      solidLegs(g.boxes, fy);
      if (!fitInRoom(ctx, g.boxes, [...fixed, ...placed], doors)) { loadCoords(g.boxes, saved); continue; }
      for (const b of g.boxes) ctx.addBox(b);
      if (!ctx.reachOk()) {
        const set = new Set(g.boxes);
        ctx.removeBoxes((b) => set.has(b));
        loadCoords(g.boxes, saved);
        continue;
      }
      placed.push(...g.boxes.filter((b) => b.solid));
      kept++;
    }
    // 1 つだけでは「巨大な家具の部屋」に見えない（背の高い棚ばかりの部屋など）
    return kept >= 2;
  },
});

/** 小さな扉（人形の家の扉）: 枠 + 板 + 取っ手（当たらない）。面 f の t に、床から */
function tinyDoor(B: Box[], f: Face, t: number, fy: number, mat: MatId): void {
  const dw = 0.27, dh = 0.62;
  B.push(alongFace(f, t - dw / 2 - 0.03, dw + 0.06, 0, 0.03, fy, fy + dh + 0.03, 'trim', false));
  B.push(alongFace(f, t - dw / 2, dw, 0.03, 0.05, fy + 0.005, fy + dh, mat, false));
  B.push(alongFace(f, t + dw / 2 - 0.07, 0.035, 0.05, 0.075, fy + 0.3, fy + 0.32, 'goldTrim', false));
  for (const b of B) b.propGroup = `a-tinyDoor@${f.dir},${t.toFixed(2)}`;
}

/** 小さな家具: 家具が 0.3 倍（人形の家）。部屋の殻と壁の飾りは元の大きさのまま。壁の根元に小さな扉 */
defineAnomaly({
  id: 'tiny', name: '小さな家具', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], needsFurniture: true,
  post(ctx) {
    const s = ctx.tuning['anomaly.tiny.scale'];
    const cell = ctx.cell, fy = cell.floorY;
    const groups = objectGroups(ctx.furniture, cell);
    for (const g of groups) {
      const bb = bbOf(g.boxes);
      const r = rectOf(ctx, (bb.min[0] + bb.max[0]) / 2, (bb.min[2] + bb.max[2]) / 2);
      const ax = anchorOf(bb.min[0], bb.max[0], r.x0, r.x1), az = anchorOf(bb.min[2], bb.max[2], r.z0, r.z1);
      // 段階 4（フロアの形の担当が直した）: 背の高い物（倉庫の棚）は膝より低くなるまで縮める
      const k = Math.min(s, 0.7 / Math.max(1e-3, bb.max[1] - fy));
      for (const b of g.boxes) scaleBox(b, k, ax, fy, az);
    }
    // 壁の根元の小さな扉（開口の前後と家具の陰を避ける）
    const solids = interiorSolids(cell);
    const faces = innerFaces(cell.footprint).filter((f) => f.a1 - f.a0 > 1.4);
    for (let i = 0; i < 12 && faces.length; i++) {
      const f = ctx.rng.pick(faces);
      if (ctx.geo.openings.some((o) => onFace(f, o))) continue;
      const tt = ctx.rng.float(f.a0 + 0.5, f.a1 - 0.5);
      const B: Box[] = [];
      tinyDoor(B, f, tt, fy, cell.palette.door);
      const near = bbOf(B);
      if (solids.some((x) => overlaps(x, near, 0.15))) continue;
      for (const b of B) { b.propGroup = `${cell.id}/${b.propGroup}`; ctx.addBox(b); }
      break;
    }
    return groups.length > 0;
  },
});
