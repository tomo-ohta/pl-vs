/**
 * 壁の形: 分割ホール（S06）・L 字 / コの字 / ロの字（S07）・二重壁（S13）・半地下（S16）・斜めの壁（S17）・窓だらけ（S23）。
 * - 分割ホール [QR]: 奥行きの向きに仕切り壁で 2〜4 室に分かれ、仕切りの通り口は左右互い違い（先が見えない）。室ごとに壁の色が違う
 * - L / コ / ロの字: 足跡の角を欠く（L）・壁の真ん中を欠く（コ）・真ん中に柱の塊（ロ）。入口から出口が見えない曲がり角
 * - 二重壁: 開口の無い壁の内側にもう 1 枚の壁。壁の割れ目から、壁と壁の間（幅 0.85 m・暗い）に入れる。奥に誰かの痕跡
 * - 半地下: 天井際の細長い窓の外が地面の高さ（外の景色の板）。窓には格子、壁はコンクリート、天井に配管、少し湿っている
 * - 斜めの壁: 開口の無い壁が床から天井へ傾く（屋根裏のように内へ / すり鉢のように外へ）。傾けた板（描画）と段の当たり判定
 * - 窓だらけ: 壁一面の窓。どの窓の奥にも別の部屋が見える（窓の奥の部屋の描画）。開口の無い壁は床から天井までのガラス
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId, type WallOpening } from '../../../world/layout.ts';
import { board, decorDoor } from '../../dress/decor.ts';
import { alongFace, boxesOverlap, freeRuns, innerFaces, lineFace, type Face } from '../../dress/geom.ts';
import { fillRects, wallFrame } from '../../gimmicks/util.ts';
import { defineRoomShape, type RoomShapeContext } from '../types.ts';
import {
  clearCeilingLights, clearOfDoors, frontPt, frontRect, freeWalls, isWallBox, lightGridAt, mainAxisOf, rbox, rectD, rectsHit, rectW, reshell, shrink, snap, subDress, useDress, WET_THEMES,
} from '../util.ts';

/** 家具の要らない異変と、家具を動かす異変（区画の中身をふつうに置く形） */
const ALL_POST = ['dark', 'fog', 'tint', 'clocks', 'giant', 'tiny', 'scatter', 'multiply'] as const;
const inRect = (r: Rect, x: number, z: number): boolean => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** 開口（扉の前の範囲）が矩形 q に掛からないか（q を壁や塊にしてよいか） */
function openingFree(ctx: RoomShapeContext, q: Rect, depth = 1.7, pad = 0.5): boolean {
  return !ctx.geo.openings.some((o) => rectsHit(frontRect(o, WALL_T + depth, pad), q));
}

/** 入口の前から出口の前への見通しを、矩形 q が遮るか */
function blocksSight(ctx: RoomShapeContext, q: Rect): boolean {
  if (!ctx.exit) return false;
  const a = frontPt(ctx.entrance, 1.0), b = frontPt(ctx.exit, 1.0);
  for (let i = 1; i < 40; i++) {
    const s = i / 40;
    if (inRect(q, a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- S06 分割ホール

defineRoomShape({
  id: 'splitHall', idea: 'S06', name: '分割ホール', kinds: ['room', 'hall'], minSize: [3.6, 6.2], minHeight: 2.4, weight: 1.0,
  anomalies: ALL_POST,
  build(ctx) {
    const cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const axis = mainAxisOf(ctx);
    const A0 = axis === 'x' ? r.x0 : r.z0, A1 = axis === 'x' ? r.x1 : r.z1;
    const C0 = axis === 'x' ? r.z0 : r.x0, C1 = axis === 'x' ? r.z1 : r.x1;
    const L = A1 - A0, Wc = C1 - C0;
    if (Wc < 2.6 || L < 5.6) return false;
    let k = Math.max(2, Math.min(4, Math.round(L / 3.3)));
    while (k > 2 && L / k < 2.4) k--;
    // 仕切りを置かない所: 開口の前（奥行きの向きの範囲）
    const forbid = ctx.geo.openings.map((o) => frontRect(o, WALL_T + 1.75, 0.5)).map((fr) => (axis === 'x' ? [fr.x0, fr.x1] : [fr.z0, fr.z1]) as [number, number]);
    const ok = (p: number): boolean => !forbid.some(([a, b]) => p > a - 0.12 && p < b + 0.12);
    const ps: number[] = [];
    for (let j = 1; j < k; j++) {
      const base = A0 + (L * j) / k + ctx.rng.float(-0.3, 0.3);
      const p = [0, 0.4, -0.4, 0.8, -0.8].map((d) => snap(base + d)).find((q) => ok(q) && q - A0 >= 1.9 && A1 - q >= 1.9 && ps.every((x) => Math.abs(x - q) >= 2.2));
      if (p !== undefined) ps.push(p);
    }
    if (!ps.length) return false;
    ps.sort((a, b) => a - b);
    const wall = cell.palette.wall;
    const seg = (a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, mat: MatId, solid = true): Box =>
      (axis === 'x' ? box([a0, y0, c0], [a1, y1, c1], mat, solid) : box([c0, y0, a0], [c1, y1, a1], mat, solid));
    let side = ctx.rng.chance(0.5) ? 0 : 1;
    const head = Math.min(h - 0.05, 2.2);
    const doorways = new Map<number, [number, number]>();
    for (const p of ps) {
      const dw = snap(ctx.rng.float(1.0, Math.min(1.6, Wc - 1.4)));
      const off = snap(ctx.rng.float(0.35, Math.max(0.36, Wc * 0.22)));
      const d0 = side === 0 ? C0 + off : C1 - off - dw, d1 = d0 + dw;
      doorways.set(p, [d0, d1]);
      const t0 = p - WALL_T / 2, t1 = p + WALL_T / 2;
      if (d0 - C0 > 0.01) ctx.addBox(seg(t0, t1, C0, d0, fy, fy + h, wall));
      if (C1 - d1 > 0.01) ctx.addBox(seg(t0, t1, d1, C1, fy, fy + h, wall));
      if (h - head > 0.02) ctx.addBox(seg(t0, t1, d0, d1, fy + head, fy + h, wall));
      // 通り口の枠
      ctx.addBox(seg(t0 - 0.02, t1 + 0.02, d0, d0 + 0.05, fy, fy + head, 'trim', false));
      ctx.addBox(seg(t0 - 0.02, t1 + 0.02, d1 - 0.05, d1, fy, fy + head, 'trim', false));
      ctx.addBox(seg(t0 - 0.02, t1 + 0.02, d0, d1, fy + head - 0.05, fy + head, 'trim', false));
      // 通り口の前は家具を置かない
      const ko = seg(p - 1.1, p + 1.1, d0 - 0.3, d1 + 0.3, fy, fy + 2.2, 'void', false);
      ctx.keepOut({ min: ko.min, max: ko.max });
      side ^= 1;
    }
    // 室ごとに壁の色を変える（奇数の室に塗りの板を重ねる。開口は避ける）
    const paints: MatId[] = (['wallGreen', 'wallCream', 'wallBeige', 'wallWhite', 'woodPanel'] as MatId[]).filter((m) => m !== wall);
    const paint = ctx.rng.pick(paints);
    const bounds = [A0, ...ps, A1];
    for (let j = 1; j + 1 < bounds.length; j += 2) {
      const a0 = bounds[j]!, a1 = bounds[j + 1]!;
      // 室の端の仕切りの、この室の側の面（通り口は避ける）
      for (const [pp, sgn] of [[a0, 1], [a1, -1]] as const) {
        const dwy = doorways.get(pp);
        if (!dwy) continue;
        const t0 = sgn > 0 ? pp + WALL_T / 2 : pp - WALL_T / 2 - 0.006, t1 = t0 + 0.006;
        if (dwy[0] - C0 > 0.01) ctx.addBox(seg(t0, t1, C0, dwy[0], fy, fy + h - 0.01, paint, false));
        if (C1 - dwy[1] > 0.01) ctx.addBox(seg(t0, t1, dwy[1], C1, fy, fy + h - 0.01, paint, false));
        if (h - head > 0.02) ctx.addBox(seg(t0, t1, dwy[0], dwy[1], fy + head, fy + h - 0.01, paint, false));
      }
      for (const f of innerFaces(cell.footprint)) {
        if ((axis === 'x') !== f.horizontal) {
          // 仕切りと平行な壁（室の端の壁）: 室の端にあるものだけ
          const fa = f.face;
          if (Math.abs(fa - a0) > 0.2 && Math.abs(fa - a1) > 0.2) continue;
          for (const [p, q] of freeRuns(f, ctx.geo.openings, 0.05, 0)) ctx.addBox(alongFace(f, p, q - p, 0, 0.006, fy, fy + h - 0.01, paint, false));
          continue;
        }
        const lo = Math.max(a0 + WALL_T / 2, f.a0), hi = Math.min(a1 - WALL_T / 2, f.a1);
        if (hi - lo < 0.3) continue;
        for (const [p, q] of freeRuns(f, ctx.geo.openings, 0.05, 0)) {
          const s0 = Math.max(p, lo), s1 = Math.min(q, hi);
          if (s1 - s0 > 0.1) ctx.addBox(alongFace(f, s0, s1 - s0, 0, 0.006, fy, fy + h - 0.01, paint, false));
        }
      }
    }
    // 照明: 仕切りに重なる天井の照明を外し、室ごとに並べ直す
    const near = (x: number, z: number): boolean => ps.some((p) => Math.abs((axis === 'x' ? x : z) - p) < 0.8);
    clearCeilingLights(cell, near);
    const rooms = bounds.slice(1).map((a1, i): Rect => {
      const a0 = bounds[i]!;
      return axis === 'x' ? { x0: a0 + 0.1, x1: a1 - 0.1, z0: C0, z1: C1 } : { x0: C0, x1: C1, z0: a0 + 0.1, z1: a1 - 0.1 };
    });
    for (const q of rooms) {
      const lit = cell.lights.some((l) => inRect(q, l.pos[0], l.pos[2]));
      if (!lit) lightGridAt(ctx, [q], fy + h, 3.2);
    }
    return true;
  },
});

// ---------------------------------------------------------------- S07 L 字・コの字・ロの字

/** L 字: 主の矩形の角を 1 つ欠く（見通しを遮る角を選ぶ） */
function ell(ctx: RoomShapeContext): boolean {
  const R = ctx.rect;
  const W = rectW(R), D = rectD(R);
  let best: { cut: Rect; score: number } | null = null;
  for (const kx of [0, 1]) for (const kz of [0, 1]) for (let i = 0; i < 3; i++) {
    const cw = snap(W * ctx.rng.float(0.36, 0.55)), cd = snap(D * ctx.rng.float(0.36, 0.55));
    if (W - cw < 2.3 || D - cd < 2.3 || cw < 1.4 || cd < 1.4) continue;
    const cut: Rect = { x0: kx ? R.x1 - cw : R.x0, x1: kx ? R.x1 : R.x0 + cw, z0: kz ? R.z1 - cd : R.z0, z1: kz ? R.z1 : R.z0 + cd };
    if (!openingFree(ctx, cut)) continue;
    const score = (blocksSight(ctx, cut) ? 10 : 1) + ctx.rng.next();
    if (!best || score > best.score) best = { cut, score };
  }
  return !!best && reshell(ctx, fillRects(R, [best.cut]));
}

/** コの字: 開口の無い壁の真ん中を、内側へ欠く */
function notch(ctx: RoomShapeContext): boolean {
  const R = ctx.rect;
  for (const d of ctx.rng.shuffle(freeWalls(ctx))) {
    const alongX = d === 0 || d === 2;
    const len = alongX ? rectW(R) : rectD(R), dep = alongX ? rectD(R) : rectW(R);
    const nw = snap(len * ctx.rng.float(0.3, 0.42)), nd = snap(dep * ctx.rng.float(0.32, 0.48));
    if ((len - nw) / 2 < 1.7 || dep - nd < 2.2 || nw < 1.2) continue;
    const mid = (alongX ? (R.x0 + R.x1) : (R.z0 + R.z1)) / 2 + snap(ctx.rng.float(-1, 1) * Math.max(0, (len - nw) / 2 - 1.7));
    const a0 = mid - nw / 2, a1 = mid + nw / 2;
    const cut: Rect = d === 0 ? { x0: a0, x1: a1, z0: R.z1 - nd, z1: R.z1 } : d === 2 ? { x0: a0, x1: a1, z0: R.z0, z1: R.z0 + nd }
      : d === 1 ? { x0: R.x1 - nd, x1: R.x1, z0: a0, z1: a1 } : { x0: R.x0, x1: R.x0 + nd, z0: a0, z1: a1 };
    if (!openingFree(ctx, cut)) continue;
    if (reshell(ctx, fillRects(R, [cut]))) return true;
  }
  return false;
}

/** ロの字: 真ん中に天井までの塊（部屋は塊を囲む回廊になる）。塊の面に開かない扉と掲示板 */
function ring(ctx: RoomShapeContext): boolean {
  const cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
  const wr = snap(ctx.rng.float(1.5, 1.9));
  const core = shrink(r, wr);
  if (rectW(core) < 1.2 || rectD(core) < 1.2 || !clearOfDoors(ctx, core, 1.7, 0.45)) return false;
  const b = rbox(core, fy, fy + h, cell.palette.wall);
  b.kind = 'core';
  ctx.addBox(b);
  clearCeilingLights(cell, (x, z) => inRect(shrink(core, -0.35), x, z));
  // 塊の面: 入口を向いた面に開かない扉、別の面に掲示板。根元に巾木
  const faces: Face[] = [
    lineFace(true, core.z1, 1, core.x0, core.x1), lineFace(true, core.z0, -1, core.x0, core.x1),
    lineFace(false, core.x1, 1, core.z0, core.z1), lineFace(false, core.x0, -1, core.z0, core.z1),
  ];
  const [ex, ez] = frontPt(ctx.entrance, 1.0);
  const facing = faces.slice().sort((p, q) => {
    const c = (f: Face): [number, number] => (f.horizontal ? [(f.a0 + f.a1) / 2, f.face] : [f.face, (f.a0 + f.a1) / 2]);
    const [px, pz] = c(p), [qx, qz] = c(q);
    return Math.hypot(px - ex, pz - ez) - Math.hypot(qx - ex, qz - ez);
  });
  const B: Box[] = [];
  const f0 = facing[0]!;
  if (f0.a1 - f0.a0 >= 1.1) decorDoor(B, f0, (f0.a0 + f0.a1) / 2, cell.palette.door);
  const f1 = facing[1]!;
  if (f1.a1 - f1.a0 >= 1.2) board(B, f1, (f1.a0 + f1.a1) / 2, Math.min(1.2, f1.a1 - f1.a0 - 0.3), 1.2, 1.9, 'noticeGreen');
  for (const f of faces) B.push(alongFace(f, f.a0, f.a1 - f.a0, 0, 0.02, 0, 0.09, 'trim', false));
  for (const x of B) { x.min = [x.min[0], x.min[1] + fy, x.min[2]]; x.max = [x.max[0], x.max[1] + fy, x.max[2]]; delete x.propGroup; ctx.addBox(x); }
  return true;
}

defineRoomShape({
  id: 'bentRoom', idea: 'S07', name: 'L 字・コの字・ロの字', kinds: ['room', 'hall'], minSize: [4.4, 5.0], minHeight: 2.3, weight: 1.2,
  anomalies: ALL_POST,
  build(ctx) {
    const order = ctx.rng.shuffle<'L' | 'U' | 'O'>(['L', 'L', 'U', 'O']);
    for (const v of [...new Set(order)]) if (v === 'L' ? ell(ctx) : v === 'U' ? notch(ctx) : ring(ctx)) return true;
    return false;
  },
});

// ---------------------------------------------------------------- S13 二重壁

defineRoomShape({
  id: 'doubleWall', idea: 'S13', name: '二重壁', kinds: ['room', 'hall'], minSize: [4.2, 4.8], minHeight: 2.4, weight: 0.9,
  anomalies: ['dark', 'fog', 'tint'],
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner, R = ctx.rect;
    const g = t['rooms.double.gapM'];
    const free = freeWalls(ctx);
    if (!free.length) return false;
    const pairs = ([[0, 1], [1, 2], [2, 3], [3, 0]] as [Dir, Dir][]).filter(([a, b]) => free.includes(a) && free.includes(b));
    const order: Dir[][] = [...ctx.rng.shuffle(pairs.slice()), ...ctx.rng.shuffle(free.map((d) => [d]))];
    for (const ds of order) {
      const has = (d: Dir): boolean => ds.includes(d);
      // 壁と壁の間（strip）と、内側の壁（厚さ WALL_T）
      const strip = (d: Dir): Rect => (d === 3 ? { x0: r.x0, x1: r.x0 + g, z0: r.z0, z1: r.z1 } : d === 1 ? { x0: r.x1 - g, x1: r.x1, z0: r.z0, z1: r.z1 }
        : d === 2 ? { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z0 + g } : { x0: r.x0, x1: r.x1, z0: r.z1 - g, z1: r.z1 });
      const inner = (d: Dir): Rect => {
        if (d === 3 || d === 1) {
          const x0 = d === 3 ? r.x0 + g : r.x1 - g - WALL_T;
          return { x0, x1: x0 + WALL_T, z0: has(2) ? r.z0 + g : r.z0, z1: has(0) ? r.z1 - g : r.z1 };
        }
        const z0 = d === 2 ? r.z0 + g : r.z1 - g - WALL_T;
        return { z0, z1: z0 + WALL_T, x0: has(3) ? r.x0 + g : r.x0, x1: has(1) ? r.x1 - g : r.x1 };
      };
      const strips = ds.map(strip), walls = ds.map(inner);
      if ([...strips, ...walls].some((q) => !openingFree(ctx, q, 1.6, 0.45))) continue;
      // 内側の部屋（中身を置く足跡。外の辺 = 内側の壁の外面）
      const room: Rect = { x0: has(3) ? r.x0 + g : R.x0, x1: has(1) ? r.x1 - g : R.x1, z0: has(2) ? r.z0 + g : R.z0, z1: has(0) ? r.z1 - g : R.z1 };
      if (rectW(room) < 2.8 || rectD(room) < 2.8) continue;
      // 割れ目（壁と壁の間への入口）: 内側の壁の 1 枚に、高い割れ目（0.8 × 2.0）か、しゃがんで入る穴（0.8 × 0.95）
      const wi = ctx.rng.int(0, walls.length - 1);
      const crackW = 0.8, crackH = ctx.rng.chance(0.5) ? 2.0 : 0.95;
      const cracks: { wall: number; at: number }[] = [];
      for (let i = 0; i < walls.length; i++) {
        if (i !== wi && !ctx.rng.chance(0.4)) continue;
        const w = walls[i]!;
        const alongX = rectW(w) > rectD(w);
        const a0 = (alongX ? w.x0 : w.z0) + 0.7, a1 = (alongX ? w.x1 : w.z1) - 0.7 - crackW;
        if (a1 <= a0) continue;
        cracks.push({ wall: i, at: snap(ctx.rng.float(a0, a1)) });
      }
      if (!cracks.length) continue;
      const crackFronts: Rect[] = [];
      const virtual: WallOpening[] = [];
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i]!, d = ds[i]!;
        const alongX = rectW(w) > rectD(w);
        const cs = cracks.filter((c) => c.wall === i).map((c) => c.at).sort((a, b) => a - b);
        let cur = alongX ? w.x0 : w.z0;
        const end = alongX ? w.x1 : w.z1;
        const piece = (p: number, q: number, y0: number, y1: number): void => {
          if (q - p < 0.01 || y1 - y0 < 0.01) return;
          ctx.addBox(alongX ? box([p, y0, w.z0], [q, y1, w.z1], cell.palette.wall) : box([w.x0, y0, p], [w.x1, y1, q], cell.palette.wall));
        };
        for (const a of cs) {
          piece(cur, a, fy, fy + h);
          piece(a, a + crackW, fy + crackH, fy + h);
          const mid = a + crackW / 2;
          // 割れ目の前（部屋の側）は空ける
          const [ix, iz] = d === 3 ? [1, 0] : d === 1 ? [-1, 0] : d === 2 ? [0, 1] : [0, -1];
          const fx = alongX ? mid : (ix > 0 ? w.x1 : w.x0), fz = alongX ? (iz > 0 ? w.z1 : w.z0) : mid;
          const fr: Rect = alongX ? { x0: a - 0.3, x1: a + crackW + 0.3, z0: Math.min(fz, fz + iz * 1.2), z1: Math.max(fz, fz + iz * 1.2) } : { x0: Math.min(fx, fx + ix * 1.2), x1: Math.max(fx, fx + ix * 1.2), z0: a - 0.3, z1: a + crackW + 0.3 };
          crackFronts.push(fr);
          // 中身を置くときの開口（内側の部屋の外の辺 = 内側の壁の外面に）
          const ox = alongX ? mid : (d === 3 ? w.x0 : w.x1), oz = alongX ? (d === 2 ? w.z0 : w.z1) : mid;
          virtual.push({ id: `${ctx.id}.crack${virtual.length}`, pos: [ox, fy, oz], dir: d, width: crackW, height: crackH });
          cur = a + crackW;
        }
        piece(cur, end, fy, fy + h);
      }
      // 壁と壁の間は暗い（天井の照明を外し、奥に薄暗い裸電球）。奥に誰かの痕跡
      const gapAll = [...strips, ...walls];
      clearCeilingLights(cell, (x, z) => gapAll.some((q) => inRect(shrink(q, -0.3), x, z)));
      const c0 = cracks[0]!, w0 = walls[c0.wall]!, s0 = strips[c0.wall]!;
      const alongX = rectW(w0) > rectD(w0);
      const sa0 = alongX ? s0.x0 : s0.z0, sa1 = alongX ? s0.x1 : s0.z1;
      const farEnd = Math.abs(c0.at - sa0) > Math.abs(sa1 - c0.at) ? sa0 + 0.5 : sa1 - 0.5;
      const sc = alongX ? (s0.z0 + s0.z1) / 2 : (s0.x0 + s0.x1) / 2;
      const [px, pz] = alongX ? [farEnd, sc] : [sc, farEnd];
      ctx.addBox(box([px - 0.005, fy + h - 0.5, pz - 0.005], [px + 0.005, fy + h, pz + 0.005], 'metalDark', false));
      ctx.addBox(box([px - 0.04, fy + h - 0.58, pz - 0.04], [px + 0.04, fy + h - 0.5, pz + 0.04], 'lightWarm', false));
      ctx.addLight({ pos: [px, fy + h - 0.7, pz], color: 0xffc27a, intensity: 0.28, distance: 3.5 });
      const find = ctx.rng.pick(['chair', 'tally', 'papers', 'radio'] as const);
      const outerFace = (d: Dir): number => (d === 3 ? r.x0 : d === 1 ? r.x1 : d === 2 ? r.z0 : r.z1);
      const d0 = ds[c0.wall]!;
      const of = outerFace(d0), sg = d0 === 3 || d0 === 2 ? 1 : -1;
      if (find === 'chair') {
        // 外の壁を向いた木の椅子
        const cx = alongX ? px : of + sg * 0.45, cz = alongX ? of + sg * 0.45 : pz;
        ctx.addBox(box([cx - 0.2, fy + 0.42, cz - 0.2], [cx + 0.2, fy + 0.46, cz + 0.2], 'woodPanel'));
        const bx = alongX ? [cx - 0.2, cx + 0.2] : [cx + sg * 0.2 - 0.03, cx + sg * 0.2 + 0.03], bz = alongX ? [cz + sg * 0.2 - 0.03, cz + sg * 0.2 + 0.03] : [cz - 0.2, cz + 0.2];
        ctx.addBox(box([Math.min(...bx), fy + 0.46, Math.min(...bz)], [Math.max(...bx), fy + 0.9, Math.max(...bz)], 'woodPanel'));
        for (const ox of [-0.17, 0.17]) for (const oz of [-0.17, 0.17]) ctx.addBox(box([cx + ox - 0.015, fy, cz + oz - 0.015], [cx + ox + 0.015, fy + 0.42, cz + oz + 0.015], 'woodPanel', false));
      } else if (find === 'tally') {
        // 外の壁の正の字（数を数えた線）
        const n = ctx.rng.int(12, 26);
        for (let i = 0; i < n; i++) {
          const a = farEnd + (farEnd < (sa0 + sa1) / 2 ? 1 : -1) * (0.1 + Math.floor(i / 5) * 0.32 + (i % 5) * 0.05);
          const y0 = fy + 1.1 + ctx.rng.float(-0.03, 0.03);
          const th = i % 5 === 4 ? 0.02 : 0.012;
          ctx.addBox(alongX ? box([a - th, y0, Math.min(of, of + sg * 0.004)], [a + th, y0 + 0.28, Math.max(of, of + sg * 0.004)], 'metalDark', false)
            : box([Math.min(of, of + sg * 0.004), y0, a - th], [Math.max(of, of + sg * 0.004), y0 + 0.28, a + th], 'metalDark', false));
        }
      } else if (find === 'papers') {
        for (let i = 0; i < 14; i++) {
          const a = farEnd + ctx.rng.float(-1.2, 1.2), c = sc + ctx.rng.float(-0.25, 0.25);
          const [x, z] = alongX ? [a, c] : [c, a];
          if (!inRect(s0, x, z)) continue;
          ctx.addBox(box([x - 0.105, fy + 0.002 + i * 0.001, z - 0.148], [x + 0.105, fy + 0.004 + i * 0.001, z + 0.148], 'signPlate', false));
        }
      } else {
        ctx.addBox(box([px - 0.14, fy, pz - 0.09], [px + 0.14, fy + 0.18, pz + 0.09], 'furnitureDark'));
        ctx.addBox(box([px - 0.03, fy + 0.18, pz - 0.03], [px + 0.03, fy + 0.2, pz + 0.03], 'ledBlue', false));
      }
      // 内側の部屋に中身（割れ目の前は空ける）
      const keep = crackFronts.map((q) => ({ min: [q.x0, fy, q.z0] as [number, number, number], max: [q.x1, fy + 2.2, q.z1] as [number, number, number] }));
      useDress(ctx, subDress(ctx, { rects: [room], openings: [...ctx.geo.openings, ...virtual], keepOut: keep, tag: 'dbl' }));
      return true;
    }
    return false;
  },
});

// ---------------------------------------------------------------- S16 半地下

defineRoomShape({
  id: 'halfBasement', idea: 'S16', name: '半地下', kinds: ['room', 'hall'], minSize: [3.8, 4.2], minHeight: 2.75, weight: 0.8,
  anomalies: ALL_POST,
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const cell = ctx.cell, fy = ctx.fy, h = ctx.h;
    const y1 = fy + h - 0.15, y0 = y1 - snap(ctx.rng.float(0.5, 0.7));
    if (y0 - fy < 2.0) return false;
    let made = 0;
    const lit: [number, number, number][] = [];
    for (const f of innerFaces(cell.footprint)) {
      if (f.a1 - f.a0 < 1.6) continue;
      for (const [p, q] of freeRuns(f, ctx.geo.openings, 0.3, 0.3)) {
        const n = Math.floor((q - p + 0.6) / 2.3);
        for (let i = 0; i < n; i++) {
          const w = snap(Math.min(1.5, (q - p) / n - 0.5));
          if (w < 0.8) continue;
          const at = p + ((q - p) * (i + 0.5)) / n;
          // 外の景色の板（窓の下端が外の地面の高さ）・コンクリートの抱き（明かり取りの奥行き）・格子
          ctx.addBox(alongFace(f, at - w / 2, w, 0, 0.012, y0, y1, 'outsideView', false));
          ctx.addBox(alongFace(f, at - w / 2 - 0.12, w + 0.24, 0, 0.22, y0 - 0.1, y0, 'wallConcrete', false));
          ctx.addBox(alongFace(f, at - w / 2 - 0.12, w + 0.24, 0, 0.22, y1, Math.min(fy + h, y1 + 0.1), 'wallConcrete', false));
          ctx.addBox(alongFace(f, at - w / 2 - 0.12, 0.12, 0, 0.22, y0, y1, 'wallConcrete', false));
          ctx.addBox(alongFace(f, at + w / 2, 0.12, 0, 0.22, y0, y1, 'wallConcrete', false));
          for (let k = 1; k <= 3; k++) ctx.addBox(alongFace(f, at - w / 2 + (w * k) / 4 - 0.012, 0.024, 0.08, 0.1, y0, y1, 'metalDark', false));
          const [lx, lz] = f.horizontal ? [at, f.face + f.inward * 0.6] : [f.face + f.inward * 0.6, at];
          lit.push([lx, y0 - 0.3, lz]);
          made++;
        }
      }
    }
    if (made < 2) return false;
    // 窓からの昼の光（2 つまで）。天井の照明は暗め
    for (const l of cell.lights) l.intensity *= 0.7;
    for (const [x, y, z] of ctx.rng.shuffle(lit).slice(0, 2)) ctx.addLight({ pos: [x, y, z], color: 0xdfe9ff, intensity: 0.7, distance: 5 });
    // 壁はコンクリート、少し湿っている。天井の配管
    for (const b of cell.boxes) if (isWallBox(cell, b)) b.mat = 'wallConcrete';
    cell.palette = { ...cell.palette, wall: 'wallConcrete' };
    cell.render = { ...cell.render, wetness: Math.max(cell.render?.wetness ?? 0, 0.25) };
    const r = ctx.inner;
    const alongX = rectW(r) >= rectD(r);
    for (const off of [0.35, 0.55]) {
      const c = alongX ? r.z0 + off : r.x0 + off;
      const py = fy + h - 0.22 - (off > 0.4 ? 0.04 : 0);
      ctx.addBox(alongX ? box([r.x0, py - 0.05, c - 0.05], [r.x1, py + 0.05, c + 0.05], 'metal', false) : box([c - 0.05, py - 0.05, r.z0], [c + 0.05, py + 0.05, r.z1], 'metal', false));
    }
    return true;
  },
});

// ---------------------------------------------------------------- S17 斜めの壁

defineRoomShape({
  id: 'slantWalls', idea: 'S17', name: '斜めの壁', kinds: ['room', 'hall'], minSize: [4.2, 4.4], minHeight: 2.4, maxHeight: 6, weight: 0.9,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'giant', 'tiny', 'scatter'],
  build(ctx) {
    const cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const free = freeWalls(ctx);
    if (!free.length) return false;
    const attic = ctx.rng.chance(0.6);
    const opp = ([[0, 2], [1, 3]] as [Dir, Dir][]).filter(([a, b]) => free.includes(a) && free.includes(b));
    const ds: Dir[] = opp.length && ctx.rng.chance(0.7) ? [...ctx.rng.pick(opp)] : [ctx.rng.pick(free)];
    for (const d of ds) {
      const F = wallFrame(r, d);
      const dep = F.depth;
      const reach = snap(Math.min(attic ? 2.0 : 1.6, ctx.rng.float(1.1, 2.0), dep * (ds.length > 1 ? 0.28 : 0.36)));
      if (reach < 0.9) return false;
      const zone = F.rect(F.u0, 0, F.u1, reach);
      if (!clearOfDoors(ctx, zone, 1.6, 0.45)) return false;
      const axis: 'x' | 'z' = d === 1 || d === 3 ? 'x' : 'z';
      // 高さ: 壁からの距離 v の関数（屋根裏: 壁際 0 → reach で天井 / すり鉢: 壁際で天井 → reach で床）
      const yAt = (v: number): number => (attic ? fy + (h * v) / reach : fy + h * (1 - v / reach));
      // 箱の軸の min の端が壁の側か（壁 1・0 は max 側が壁）
      const wallAtMin = d === 3 || d === 2;
      const yMin = wallAtMin ? yAt(0) : yAt(reach), yMax = wallAtMin ? yAt(reach) : yAt(0);
      const slab = box([zone.x0, yMin - 0.12, zone.z0], [zone.x1, yMin, zone.z1], cell.palette.wall, false);
      slab.slope = { axis, rise: yMax - yMin };
      ctx.addBox(slab);
      // 当たり判定: 壁からの帯ごとに（屋根裏: 斜めの板より上 / すり鉢: 斜めの板より下）。少し大きめに塞ぐ
      const n = Math.ceil(reach / 0.2);
      for (let k = 0; k < n; k++) {
        const v0 = (reach * k) / n, v1 = (reach * (k + 1)) / n;
        const q = F.rect(F.u0, v0, F.u1, v1);
        const b = attic ? rbox(q, Math.min(yAt(v0), yAt(v1)), fy + h, cell.palette.wall) : rbox(q, fy, Math.max(yAt(v0), yAt(v1)), cell.palette.wall);
        b.kind = 'colliderOnly';
        if (b.max[1] - b.min[1] > 0.02) ctx.addBox(b);
      }
      if (attic) {
        clearCeilingLights(cell, (x, z) => inRect(zone, x, z));
        // 屋根の窓（傾いた板の下面に沿って。夜の空）
        const mid = (F.u0 + F.u1) / 2;
        for (const s of ctx.rng.chance(0.5) ? [0] : [-1, 1]) {
          const u = mid + s * Math.min(1.4, (F.u1 - F.u0) / 4);
          const v0 = reach * 0.35, v1 = reach * 0.75;
          const w = F.rect(u - 0.45, v0, u + 0.45, v1);
          const len = axis === 'x' ? w.x1 - w.x0 : w.z1 - w.z0;
          const ya = wallAtMin ? yAt(v0) : yAt(v1);
          const win = box([w.x0, ya - 0.135, w.z0], [w.x1, ya - 0.125, w.z1], 'windowNight', false);
          win.slope = { axis, rise: ((yMax - yMin) * len) / reach };
          ctx.addBox(win);
        }
      }
    }
    // 屋根裏は真ん中の天井が残ること（向かい合う 2 枚の間）
    return true;
  },
});

// ---------------------------------------------------------------- S23 窓だらけ

defineRoomShape({
  id: 'windows', idea: 'S23', name: '窓だらけ', kinds: ['room', 'hall'], minSize: [3.8, 4.2], minHeight: 2.4, weight: 0.9,
  anomalies: ['dark', 'fog', 'tint'],
  build(ctx) {
    const cell = ctx.cell, fy = ctx.fy, h = ctx.h;
    const wins: Box[] = [];
    const free = new Set(freeWalls(ctx));
    const glass = free.size && ctx.rng.chance(0.6) ? ctx.rng.pick([...free]) : null;
    const add = (b: Box): void => { ctx.addBox(b); wins.push(b); };
    const mat = (): MatId => (ctx.rng.chance(0.55) ? 'windowLit' : 'windowDark');
    for (const f of innerFaces(cell.footprint)) {
      if (f.a1 - f.a0 < 1.3) continue;
      const full = glass !== null && f.dir === glass;
      for (const [p, q] of freeRuns(f, ctx.geo.openings, full ? 0.1 : 0.45, full ? 0.05 : 0.3)) {
        if (full) {
          // 床から天井までのガラスの壁（縦の桟で区切る。どの区画の奥にも別の部屋）
          const n = Math.max(1, Math.round((q - p) / 1.4));
          const w = (q - p) / n;
          for (let i = 0; i < n; i++) {
            const a = p + w * i;
            add(alongFace(f, a + 0.04, w - 0.08, 0, 0.012, fy + 0.15, fy + h - 0.12, mat(), false));
            add(alongFace(f, a, 0.04, 0, 0.06, fy, fy + h, 'trim', false));
          }
          add(alongFace(f, q - 0.04, 0.04, 0, 0.06, fy, fy + h, 'trim', false));
          add(alongFace(f, p, q - p, 0, 0.08, fy, fy + 0.15, 'trim', false));
          add(alongFace(f, p, q - p, 0, 0.06, fy + h - 0.12, fy + h, 'trim', false));
          continue;
        }
        const rows: [number, number][] = [[0.95, Math.min(2.15, h - 0.25)]];
        if (h >= 3.6) rows.push([2.55, Math.min(h - 0.25, 3.45)]);
        const n = Math.floor((q - p + 0.25) / 1.25);
        for (let i = 0; i < n; i++) {
          const at = p + ((q - p) * (i + 0.5)) / n;
          for (const [a, b] of rows) {
            if (b - a < 0.5) continue;
            add(alongFace(f, at - 0.5, 1.0, 0, 0.012, fy + a, fy + b, mat(), false));
            add(alongFace(f, at - 0.55, 0.05, 0, 0.05, fy + a - 0.05, fy + b + 0.05, 'trim', false));
            add(alongFace(f, at + 0.5, 0.05, 0, 0.05, fy + a - 0.05, fy + b + 0.05, 'trim', false));
            add(alongFace(f, at - 0.55, 1.1, 0, 0.08, fy + a - 0.06, fy + a, 'trim', false));
            add(alongFace(f, at - 0.55, 1.1, 0, 0.05, fy + b, fy + b + 0.05, 'trim', false));
          }
        }
      }
    }
    if (wins.length < 25) return false;
    // 家具: 窓に重なる物は置かない（壁の飾り・背の高い家具）
    const d = subDress(ctx, { rects: cell.footprint, openings: ctx.geo.openings, tag: 'win' });
    const panes = wins.map((b) => ({ min: [b.min[0] - 0.04, b.min[1], b.min[2] - 0.04] as [number, number, number], max: [b.max[0] + 0.04, b.max[1], b.max[2] + 0.04] as [number, number, number] }));
    const bad = new Set(d.boxes.filter((b) => panes.some((w) => boxesOverlap(w, b, -0.005))).map((b) => b.propGroup ?? b));
    d.boxes = d.boxes.filter((b) => !bad.has(b.propGroup ?? b));
    useDress(ctx, d);
    return true;
  },
});
