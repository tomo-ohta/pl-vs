/**
 * 足跡の形: うなぎの寝床（S12）・果てしない通路（S26）・円形の部屋（S18）。
 * - うなぎの寝床: 部屋が幅 1.2 m の細長い帯になる（長い区画だけ。広間なら 20〜40 m）。ほかの開口へは帯から細い枝。
 *   一定の間隔の鴨居・続く絨毯・奥に椅子が 1 脚
 * - 果てしない通路 [QR]: 幅 2 m ほどの長い通路で、先は霧で見えない。同じ額・同じ灯りがくり返す（表のフロアだけ）
 * - 円形の部屋: 丸い壁（細かい段の箱）の部屋に、扉が等間隔に 8 つ（入口・出口のほかは開かない扉。どれが本物か）。
 *   開口が区画の中心線の上にあるときだけ（丸の中心から真っすぐの通路で開口へつながる）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_H, WALL_T, type Box, type MatId, type WallOpening } from '../../../world/layout.ts';
import { mixColor } from '../../anomaly/util.ts';
import { board } from '../../dress/decor.ts';
import { alongFace, innerFaces } from '../../dress/geom.ts';
import { fillRects } from '../../gimmicks/util.ts';
import { defineRoomShape, type RoomShapeContext } from '../types.ts';
import { clearCeilingLights, clearOfDoors, rectD, rectW, reshell, snap, WET_THEMES } from '../util.ts';

/** 開口の、帯の向き（axis）に沿った座標と、横の座標 */
const coordOf = (o: WallOpening, axis: 'x' | 'z'): [number, number] => (axis === 'x' ? [o.pos[0], o.pos[2]] : [o.pos[2], o.pos[0]]);

/**
 * 帯の足跡: 主の矩形の長い向きに、外の幅 wo（壁の厚みを含む）の帯。帯に収まらない開口へは、開口の幅 + 0.7 m の枝を足す。
 * 帯と枝の和を、重ならない矩形の列にして返す（足跡）。帯の位置は、枝の長さの合計が短い所
 */
function stripFootprint(ctx: RoomShapeContext, inner: number): { rects: Rect[]; axis: 'x' | 'z'; c: number; a0: number; a1: number } | null {
  const R = ctx.rect;
  const axis: 'x' | 'z' = rectW(R) >= rectD(R) ? 'x' : 'z';
  const A0 = axis === 'x' ? R.x0 : R.z0, A1 = axis === 'x' ? R.x1 : R.z1;
  const C0 = axis === 'x' ? R.z0 : R.x0, C1 = axis === 'x' ? R.z1 : R.x1;
  const wo = inner + 2 * WALL_T;
  if (C1 - C0 < wo + 0.5) return null;
  const isEnd = (o: WallOpening): boolean => (axis === 'x' ? o.dir === 1 || o.dir === 3 : o.dir === 0 || o.dir === 2);
  const ops = ctx.geo.openings;
  const cands = [...new Set([...ops.filter(isEnd).map((o) => coordOf(o, axis)[1]), (C0 + C1) / 2].map((c) => snap(Math.min(C1 - wo / 2, Math.max(C0 + wo / 2, c)))))];
  const mk = (a0: number, a1: number, c0: number, c1: number): Rect => (axis === 'x' ? { x0: a0, x1: a1, z0: c0, z1: c1 } : { x0: c0, x1: c1, z0: a0, z1: a1 });
  let best: { rects: Rect[]; c: number; cost: number } | null = null;
  for (const c of cands) {
    const pieces: Rect[] = [mk(A0, A1, c - wo / 2, c + wo / 2)];
    let cost = 0;
    for (const o of ops) {
      const [oa, oc] = coordOf(o, axis);
      const sw = Math.max(wo, o.width + 0.7 + 2 * WALL_T);
      if (isEnd(o)) {
        if (Math.abs(oc - c) + o.width / 2 <= wo / 2 - WALL_T - 0.1) continue;
        // 端の壁の開口: 端に沿った枝
        const atA1 = Math.abs(oa - A1) < Math.abs(oa - A0);
        pieces.push(mk(atA1 ? A1 - sw : A0, atA1 ? A1 : A0 + sw, Math.max(C0, Math.min(c - wo / 2, oc - sw / 2)), Math.min(C1, Math.max(c + wo / 2, oc + sw / 2))));
        cost += Math.abs(oc - c);
      } else {
        // 横の壁の開口: 帯から壁へ真っすぐの枝
        const atC1 = Math.abs(oc - C1) < Math.abs(oc - C0);
        pieces.push(mk(Math.max(A0, oa - sw / 2), Math.min(A1, oa + sw / 2), atC1 ? c : C0, atC1 ? C1 : c));
        cost += atC1 ? C1 - c : c - C0;
      }
    }
    if (!best || cost < best.cost) best = { rects: fillRects(R, fillRects(R, pieces)), c, cost };
  }
  return best ? { rects: best.rects, axis, c: best.c, a0: A0, a1: A1 } : null;
}

// ---------------------------------------------------------------- S12 うなぎの寝床

defineRoomShape({
  id: 'eelBed', idea: 'S12', name: 'うなぎの寝床', kinds: ['hall', 'room'], minSize: [2.6, 11.5], minHeight: 2.3, weight: 1.6,
  anomalies: ['dark', 'fog', 'tint'],
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, fy = ctx.fy, h = ctx.h;
    const plan = stripFootprint(ctx, t['rooms.eel.widthM']);
    if (!plan) return false;
    if (!reshell(ctx, plan.rects, 2.4)) return false;
    const { axis, c } = plan;
    const half = t['rooms.eel.widthM'] / 2;
    const a0 = plan.a0 + WALL_T, a1 = plan.a1 - WALL_T;
    const seg = (p: number, q: number, c0: number, c1: number, y0: number, y1: number, mat: MatId, solid = false): Box => (axis === 'x' ? box([p, y0, c0], [q, y1, c1], mat, solid) : box([c0, y0, p], [c1, y1, q], mat, solid));
    // 続く絨毯・一定の間隔の鴨居（幅いっぱいの枠）・壁の額
    ctx.addBox(seg(a0 + 0.1, a1 - 0.1, c - half + 0.15, c + half - 0.15, fy, fy + 0.012, ctx.rng.pick<MatId>(['carpetPattern', 'floorCarpetRed']), false));
    const pitch = snap(ctx.rng.float(2.6, 3.4));
    const head = Math.min(h - 0.15, 2.15);
    let k = 0;
    for (let a = a0 + pitch; a < a1 - 1.0; a += pitch, k++) {
      ctx.addBox(seg(a - 0.04, a + 0.04, c - half, c - half + 0.06, fy, fy + head, 'woodPanel'));
      ctx.addBox(seg(a - 0.04, a + 0.04, c + half - 0.06, c + half, fy, fy + head, 'woodPanel'));
      ctx.addBox(seg(a - 0.05, a + 0.05, c - half, c + half, fy + head - 0.08, fy + head, 'woodPanel', false));
      // 額（左右互い違い。帯の端を越えない）
      if (a + pitch / 2 + 0.4 > a1) continue;
      const side = k % 2 === 0 ? -1 : 1;
      const fc = side < 0 ? c - half : c + half;
      ctx.addBox(seg(a + pitch / 2 - 0.3, a + pitch / 2 + 0.3, Math.min(fc, fc - side * 0.03), Math.max(fc, fc - side * 0.03), fy + 1.3, fy + 1.75, ctx.rng.pick<MatId>(['wallDark', 'skyDusk', 'upholstery', 'noticeGreen']), false));
      ctx.addBox(seg(a + pitch / 2 - 0.34, a + pitch / 2 + 0.34, Math.min(fc, fc - side * 0.02), Math.max(fc, fc - side * 0.02), fy + 1.26, fy + 1.79, 'goldTrim', false));
    }
    // 奥（入口から遠い端）に椅子が 1 脚、こちらを向いて
    const [ea] = coordOf(ctx.entrance, axis);
    const farA = Math.abs(ea - a0) > Math.abs(ea - a1) ? a0 + 0.5 : a1 - 0.5;
    const sg = farA < (a0 + a1) / 2 ? 1 : -1;
    const seat = seg(farA - 0.25, farA + 0.25, c - 0.25, c + 0.25, fy, fy + 1, 'void');
    // 奥の端に開口があれば（扉の前は空ける）椅子は置かない
    if (clearOfDoors(ctx, { x0: seat.min[0], x1: seat.max[0], z0: seat.min[2], z1: seat.max[2] }, 1.6, 0.4)) {
      ctx.addBox(seg(farA - 0.22, farA + 0.22, c - 0.22, c + 0.22, fy + 0.41, fy + 0.45, 'woodPanel', true));
      ctx.addBox(seg(farA - sg * 0.22 - 0.03, farA - sg * 0.22 + 0.03, c - 0.22, c + 0.22, fy + 0.45, fy + 0.9, 'woodPanel', true));
      for (const da of [-0.18, 0.18]) for (const dc of [-0.18, 0.18]) ctx.addBox(seg(farA + da - 0.015, farA + da + 0.015, c + dc - 0.015, c + dc + 0.015, fy, fy + 0.41, 'woodPanel', false));
    }
    ctx.skipDress();
    return true;
  },
});

// ---------------------------------------------------------------- S26 果てしない通路

defineRoomShape({
  id: 'endless', idea: 'S26', name: '果てしない通路', kinds: ['room', 'hall'], minSize: [3.4, 6.8], minHeight: 2.3, weight: 1.0, frontOnly: true,
  anomalies: ['tint'],
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h;
    const inner = snap(ctx.rng.float(t['rooms.endless.widthMin'], Math.max(t['rooms.endless.widthMin'], t['rooms.endless.widthMax'])));
    const plan = stripFootprint(ctx, inner);
    if (!plan) return false;
    if (!reshell(ctx, plan.rects, 2.2)) return false;
    const { axis, c } = plan;
    const L = plan.a1 - plan.a0;
    // 霧: 通路の長さの 6 割で何も見えなくなる（入口からは突き当たりが見えない）
    const color = mixColor(0xc8cacc, cell.palette.lightColor, 0.2);
    const far = Math.max(t['rooms.endless.fogMinM'], Math.min(t['rooms.endless.fogMaxM'], L * 0.6));
    cell.render = { ...cell.render, fog: { color, near: Math.min(1.5, far * 0.3), far } };
    cell.palette = { ...cell.palette, fog: color };
    // 同じ額・同じ巾木がくり返す（両側の壁。枝の口は避ける）
    const mat = ctx.rng.pick<MatId>(['noticeGreen', 'wallDark', 'skyDusk']);
    for (const f of innerFaces(cell.footprint)) {
      if (f.horizontal !== (axis === 'x') || f.a1 - f.a0 < 2) continue;
      if (Math.abs(f.face - (c - inner / 2)) > 0.02 && Math.abs(f.face - (c + inner / 2)) > 0.02) continue;
      ctx.addBox(alongFace(f, f.a0, f.a1 - f.a0, 0, 0.02, fy, fy + 0.1, 'trim', false));
      for (let a = f.a0 + 1.5; a < f.a1 - 0.6; a += 3.0) {
        const B: Box[] = [];
        board(B, f, a, 0.7, 1.25, 1.85, mat, 'metalDark');
        for (const b of B) { b.min = [b.min[0], b.min[1] + fy, b.min[2]]; b.max = [b.max[0], b.max[1] + fy, b.max[2]]; delete b.propGroup; ctx.addBox(b); }
      }
    }
    if (h > 2.6) {
      // 天井を少し低く見せる帯（両側の壁の上）
      for (const f of innerFaces(cell.footprint)) if (f.horizontal === (axis === 'x') && f.a1 - f.a0 >= 2) ctx.addBox(alongFace(f, f.a0, f.a1 - f.a0, 0, 0.05, fy + h - 0.15, fy + h, 'trim', false));
    }
    ctx.skipDress();
    return true;
  },
});

// ---------------------------------------------------------------- S18 円形の部屋

defineRoomShape({
  id: 'roundRoom', idea: 'S18', name: '円形の部屋', kinds: ['room', 'hall'], minSize: [5.2, 5.2], maxSize: [12.5, 12.5], minHeight: 2.4, weight: 1.0,
  anomalies: ['dark', 'fog', 'tint'],
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const ops = ctx.geo.openings;
    // 丸の中心: 南北の壁の開口の x・東西の壁の開口の z（中心線）。揃っていなければ組めない
    const xs = ops.filter((o) => o.dir === 0 || o.dir === 2).map((o) => o.pos[0]);
    const zs = ops.filter((o) => o.dir === 1 || o.dir === 3).map((o) => o.pos[2]);
    if (xs.some((x) => Math.abs(x - xs[0]!) > 0.05) || zs.some((z) => Math.abs(z - zs[0]!) > 0.05)) return false;
    const cx = xs.length ? xs[0]! : (r.x0 + r.x1) / 2, cz = zs.length ? zs[0]! : (r.z0 + r.z1) / 2;
    const R = snap(Math.min(cx - r.x0, r.x1 - cx, cz - r.z0, r.z1 - cz) - 0.08);
    if (R < t['rooms.round.minR']) return false;
    // 8 つの通り口（0°・45° …）: 真っすぐの 4 つは開口（無ければ開かない扉）へ、斜めの 4 つは角の開かない扉へ
    const card: Record<Dir, WallOpening | undefined> = { 0: ops.find((o) => o.dir === 0), 1: ops.find((o) => o.dir === 1), 2: ops.find((o) => o.dir === 2), 3: ops.find((o) => o.dir === 3) };
    const pw = (d: Dir): number => Math.max(0.9, (card[d]?.width ?? 1.0) / 2 + 0.4);
    const dh = 0.6; // 斜めの通り口の半分の幅
    const diag: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    // 斜めの通り口の行き止まり: 光線が矩形の壁に当たる所（角から 0.7 m 以上離す）。扉の前に平らな床
    const ends = diag.map(([sx, sz]) => {
      const tx = ((sx > 0 ? r.x1 : r.x0) - cx) / sx, tz = ((sz > 0 ? r.z1 : r.z0) - cz) / sz;
      const onX = tx <= tz; // x の壁に先に当たる
      const tt = Math.min(tx, tz);
      let px = cx + sx * tt, pz = cz + sz * tt;
      if (onX) pz = Math.min(r.z1 - 0.75, Math.max(r.z0 + 0.75, pz)); else px = Math.min(r.x1 - 0.75, Math.max(r.x0 + 0.75, px));
      const dir: Dir = onX ? (sx > 0 ? 1 : 3) : (sz > 0 ? 0 : 2);
      const land: Rect = onX ? { x0: sx > 0 ? r.x1 - 1.1 : r.x0, x1: sx > 0 ? r.x1 : r.x0 + 1.1, z0: pz - 0.65, z1: pz + 0.65 } : { x0: px - 0.65, x1: px + 0.65, z0: sz > 0 ? r.z1 - 1.1 : r.z0, z1: sz > 0 ? r.z1 : r.z0 + 1.1 };
      return { sx, sz, px, pz, dir, land };
    });
    const step = Math.max(0.1, rectD(r) / 72);
    const rows: { z0: number; z1: number; runs: [number, number][] }[] = [];
    for (let z = r.z0; z < r.z1 - 1e-6; z += step) {
      const z1 = Math.min(r.z1, z + step), zm = (z + z1) / 2;
      const cuts: [number, number][] = [];
      const dz = zm - cz;
      if (Math.abs(dz) < R) { const s = Math.sqrt(R * R - dz * dz); cuts.push([cx - s, cx + s]); }
      if (dz > 0) cuts.push([cx - pw(0), cx + pw(0)]);
      if (dz < 0) cuts.push([cx - pw(2), cx + pw(2)]);
      if (Math.abs(dz) <= pw(1)) cuts.push([cx, r.x1]);
      if (Math.abs(dz) <= pw(3)) cuts.push([r.x0, cx]);
      for (const e of ends) {
        // 斜めの帯: 中心からの光線に沿って半幅 dh（光線の向きの側だけ）
        if (Math.sign(dz) !== Math.sign(e.sz) && Math.abs(dz) > dh) continue;
        const mid = cx + e.sx * e.sz * dz;
        const w = dh * Math.SQRT2;
        cuts.push([mid - w, mid + w]);
        if (zm >= e.land.z0 && zm <= e.land.z1) cuts.push([e.land.x0, e.land.x1]);
      }
      // 残りが当たる壁（矩形の内側から切り取った物）
      cuts.sort((a, b) => a[0] - b[0]);
      const out: [number, number][] = [];
      let cur = r.x0;
      for (const [a, b] of cuts) { if (a > cur + 0.02) out.push([cur, Math.min(a, r.x1)]); cur = Math.max(cur, b); }
      if (r.x1 > cur + 0.02) out.push([cur, r.x1]);
      rows.push({ z0: z, z1, runs: out.map(([a, b]) => [snap(a * 2) / 2, snap(b * 2) / 2] as [number, number]) });
    }
    // 上下に同じ並びの行はまとめる
    const wall = cell.palette.wall;
    let made = 0;
    for (let i = 0; i < rows.length;) {
      let j = i + 1;
      const key = JSON.stringify(rows[i]!.runs);
      while (j < rows.length && JSON.stringify(rows[j]!.runs) === key) j++;
      for (const [a, b] of rows[i]!.runs) { if (b - a > 0.02) { ctx.addBox(box([a, fy, rows[i]!.z0], [b, fy + h, rows[j - 1]!.z1], wall)); made++; } }
      i = j;
    }
    if (made < 20) return false;
    // 開かない扉: 真っすぐの通り口で開口の無い所と、斜めの 4 つ（矩形の壁の室内面に板。調べると鍵が掛かっている）
    const fakes: { dir: Dir; at: number }[] = [];
    for (const d of [0, 1, 2, 3] as Dir[]) if (!card[d]) fakes.push({ dir: d, at: d === 0 || d === 2 ? cx : cz });
    for (const e of ends) fakes.push({ dir: e.dir, at: e.dir === 0 || e.dir === 2 ? e.px : e.pz });
    fakes.forEach((f, i) => {
      const wallC = f.dir === 0 ? r.z1 : f.dir === 2 ? r.z0 : f.dir === 1 ? r.x1 : r.x0;
      const sg = f.dir === 0 || f.dir === 1 ? -1 : 1;
      const p0 = wallC + sg * 0.005, p1 = wallC + sg * 0.055;
      const ax: 'x' | 'z' = f.dir === 1 || f.dir === 3 ? 'x' : 'z';
      const panel = ax === 'x' ? { min: [Math.min(p0, p1), fy, f.at - 0.45], max: [Math.max(p0, p1), fy + DOOR_H - 0.05, f.at + 0.45] } : { min: [f.at - 0.45, fy, Math.min(p0, p1)], max: [f.at + 0.45, fy + DOOR_H - 0.05, Math.max(p0, p1)] };
      ctx.addEntity(`door${i}`, { type: 'door', params: { panel, axis: ax, mat: cell.palette.door, locked: true, autoCloseSec: 0, hinge: i % 2 ? 1 : -1 } });
      // 枠
      const q0 = wallC, q1 = wallC + sg * 0.07;
      const fr = (a0: number, a1: number, y0: number, y1: number): Box => (ax === 'x' ? box([Math.min(q0, q1), y0, a0], [Math.max(q0, q1), y1, a1], 'trim', false) : box([a0, y0, Math.min(q0, q1)], [a1, y1, Math.max(q0, q1)], 'trim', false));
      ctx.addBox(fr(f.at - 0.53, f.at - 0.46, fy, fy + DOOR_H + 0.03));
      ctx.addBox(fr(f.at + 0.46, f.at + 0.53, fy, fy + DOOR_H + 0.03));
      ctx.addBox(fr(f.at - 0.53, f.at + 0.53, fy + DOOR_H - 0.04, fy + DOOR_H + 0.03));
    });
    // 照明: 丸の真ん中と、丸の内側の輪（壁に埋まる照明は外す）
    clearCeilingLights(cell);
    ctx.addBox(box([cx - 0.4, fy + h - 0.035, cz - 0.4], [cx + 0.4, fy + h - 0.005, cz + 0.4], cell.palette.light, false));
    ctx.addLight({ pos: [cx, fy + h - 0.4, cz], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity, distance: R * 2.4 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const x = cx + Math.cos(a) * R * 0.62, z = cz + Math.sin(a) * R * 0.62;
      ctx.addBox(box([x - 0.18, fy + h - 0.035, z - 0.18], [x + 0.18, fy + h - 0.005, z + 0.18], cell.palette.light, false));
      if (k % 2 === 0) ctx.addLight({ pos: [x, fy + h - 0.4, z], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * 0.6, distance: R * 1.6 });
    }
    // 床の真ん中に丸い敷物（細い帯で）と、真ん中の台
    for (let i = -5; i <= 5; i++) {
      const zz = cz + i * 0.2, s = Math.sqrt(Math.max(0, 1.2 * 1.2 - (i * 0.2) ** 2));
      if (s > 0.05) ctx.addBox(box([cx - s, fy, zz - 0.1], [cx + s, fy + 0.01, zz + 0.1], 'carpetPattern', false));
    }
    ctx.addBox(box([cx - 0.25, fy, cz - 0.25], [cx + 0.25, fy + 0.9, cz + 0.25], 'marbleWhite'));
    ctx.addBox(box([cx - 0.08, fy + 0.9, cz - 0.08], [cx + 0.08, fy + 1.05, cz + 0.08], 'goldTrim', false));
    ctx.skipDress();
    return true;
  },
});

