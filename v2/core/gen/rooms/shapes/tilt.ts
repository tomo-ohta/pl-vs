/**
 * 傾いた部屋（S25）[QR]: 部屋ごと数度傾いている。床と天井は平行な斜めの面になり、家具もいっしょに傾き、軽い物は低い壁際に寄っている。
 * 立って歩くと、自分だけがまっすぐで部屋が傾いているように見える（船の中のよう）。
 *
 * - 開口がどれも 1 本の線の上（南北の壁の開口は同じ x、東西の壁の開口は同じ z）にあるときだけ。傾きの軸はその線（扉の所の床は元の高さ）
 * - 歩く面は部品 roomSurface（core/sim/parts/rooms/surface.ts）の斜めの面。床板・天井板は描画だけの傾けた板（Box.slope）
 * - 家具: 区画の中身を平らに置いてから、傾きの分だけ剪断する（傾けた箱は描画だけ。当たる物は見えない当たりの箱を別に置く）
 */
import type { Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { defineRoomShape } from '../types.ts';
import { frontRect, isCeilingPanel, isCeilingSlab, isFloorSlab, isGridLight, isWallBox, MAZE_THEMES, rbox, rectD, rectsHit, rectW, subDress, WET_THEMES } from '../util.ts';

/** 剪断しない物（水・水たまり・影） */
const FLAT: ReadonlySet<MatId> = new Set<MatId>(['water', 'waterShallow', 'puddle', 'shadowDecal']);

defineRoomShape({
  id: 'tilted', idea: 'S25', name: '傾いた部屋', kinds: ['room', 'hall'], minSize: [4.0, 4.4], minHeight: 2.45, maxHeight: 4.2, weight: 0.9,
  anomalies: ['fog', 'tint'],
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? '') && !MAZE_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner, R = ctx.rect;
    const ops = ctx.geo.openings;
    if (ops.some((o) => Math.abs(o.pos[1] - fy) > 0.05)) return false;
    const ns = ops.filter((o) => o.dir === 0 || o.dir === 2), ew = ops.filter((o) => o.dir === 1 || o.dir === 3);
    if (ns.length && ew.length) return false;
    // 傾きの向き axis と、高さ 0 の線 a0（扉の線）
    const axis: 'x' | 'z' = ns.length ? 'x' : 'z';
    const line = ns.length ? ns.map((o) => o.pos[0]) : ew.map((o) => o.pos[2]);
    if (line.some((v) => Math.abs(v - line[0]!) > 0.05)) return false;
    const d0 = line[0]!;
    const k = Math.tan((t['rooms.tilt.deg'] * Math.PI) / 180) * (ctx.rng.chance(0.5) ? 1 : -1);
    const A0 = axis === 'x' ? R.x0 : R.z0, A1 = axis === 'x' ? R.x1 : R.z1;
    const off = (a: number): number => k * (a - d0);
    const lo = Math.min(off(A0), off(A1)), hi = Math.max(off(A0), off(A1));
    if (hi - lo < 0.3) return false;
    if (!ctx.claim(fy + lo - 0.7, fy + h + hi + 0.35, R)) return false;
    // 中身を平らに置く（あとで剪断する）
    const dressed = subDress(ctx, { rects: cell.footprint, openings: ops, tag: 'tilt', noHung: true });
    // 殻: 床板・天井板・天井の照明を外し、外壁を上下に伸ばす（開口の下は詰める）
    const floorMat = cell.palette.floor, ceilMat = cell.palette.ceiling;
    cell.lights = cell.lights.filter((l) => !isGridLight(cell, l));
    cell.boxes = cell.boxes.filter((b) => !(isFloorSlab(cell, b) || isCeilingSlab(cell, b) || isCeilingPanel(cell, b)));
    const yLo = fy + lo - 0.45, yHi = fy + h + hi + 0.1;
    for (const b of cell.boxes) {
      if (!isWallBox(cell, b)) continue;
      if (Math.abs(b.max[1] - (fy + h)) < 1e-3) b.max = [b.max[0], yHi, b.max[2]];
      if (Math.abs(b.min[1] - fy) < 1e-3) b.min = [b.min[0], yLo, b.min[2]];
    }
    for (const o of ops) {
      const hw = o.width / 2;
      const [x, z] = [o.pos[0], o.pos[2]];
      const sg = o.dir === 0 || o.dir === 1 ? -1 : 1;
      const w0 = o.dir === 0 || o.dir === 2 ? z : x, w1 = w0 + sg * WALL_T;
      const fill = o.dir === 0 || o.dir === 2 ? box([x - hw, yLo, Math.min(w0, w1)], [x + hw, fy, Math.max(w0, w1)], cell.palette.wall) : box([Math.min(w0, w1), yLo, z - hw], [Math.max(w0, w1), fy, z + hw], cell.palette.wall);
      ctx.addBox(fill);
    }
    // 床: 傾けた板（描画）・下の受けの板（当たる。面の下へ抜けない）・歩く面（部品）
    const lowAtMin = off(A0) < off(A1);
    const yA0 = fy + off(A0);
    const floor = box([R.x0, yA0 - 0.12, R.z0], [R.x1, yA0, R.z1], floorMat, false);
    floor.slope = { axis, rise: off(A1) - off(A0) };
    ctx.addBox(floor);
    ctx.addBox(rbox(R, yLo - 0.2, yLo, floorMat));
    const n: Vec3 = axis === 'x' ? [-k, 1, 0] : [0, 1, -k];
    const nl = Math.hypot(n[0], n[1], n[2]);
    const origin: Vec3 = axis === 'x' ? [d0, fy, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, fy, d0];
    ctx.addEntity('floor', { type: 'roomSurface', params: { rect: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, origin: [...origin], normal: [n[0] / nl, n[1] / nl, n[2] / nl], thickness: 0.6 } });
    // 天井: 平行な傾けた板（描画）・上の蓋（当たる）・頭を止める段の当たり
    const ceil = box([R.x0, fy + h + off(A0), R.z0], [R.x1, fy + h + off(A0) + 0.12, R.z1], ceilMat, false);
    ceil.slope = { axis, rise: off(A1) - off(A0) };
    ctx.addBox(ceil);
    ctx.addBox(rbox(R, yHi, yHi + 0.2, ceilMat));
    const strips = 8;
    for (let i = 0; i < strips; i++) {
      const a = A0 + ((A1 - A0) * i) / strips, b2 = A0 + ((A1 - A0) * (i + 1)) / strips;
      let y = fy + h + Math.min(off(a), off(b2));
      const q: Rect = axis === 'x' ? { x0: a, x1: b2, z0: R.z0, z1: R.z1 } : { x0: R.x0, x1: R.x1, z0: a, z1: b2 };
      // 開口の前では、開口の上端より上から（扉の前に当たる物を置かない）
      for (const o of ops) {
        const fr = frontRect(o, WALL_T + 1.6, 0.4);
        if (rectsHit(fr, q)) y = Math.max(y, fy + o.height + 0.15);
      }
      if (y >= yHi - 0.02) continue;
      const c = rbox(q, y, yHi, ceilMat);
      c.kind = 'colliderOnly';
      ctx.addBox(c);
    }
    // 天井の照明: 傾けた細い灯りと点光源
    const along = axis === 'x' ? rectD(r) : rectW(r);
    const cross0 = axis === 'x' ? r.z0 : r.x0;
    const nl2 = Math.max(1, Math.round(along / 2.8)), na = Math.max(1, Math.round((A1 - A0) / 2.8));
    for (let i = 0; i < na; i++) for (let j = 0; j < nl2; j++) {
      const a = A0 + 0.3 + ((A1 - A0 - 0.6) * (i + 0.5)) / na, c = cross0 + (along * (j + 0.5)) / nl2;
      const a0p = a - 0.6, a1p = a + 0.6;
      const y0 = fy + h + off(a0p) - 0.035;
      const p = axis === 'x' ? box([a0p, y0, c - 0.3], [a1p, y0 + 0.03, c + 0.3], cell.palette.light, false) : box([c - 0.3, y0, a0p], [c + 0.3, y0 + 0.03, a1p], cell.palette.light, false);
      p.slope = { axis, rise: off(a1p) - off(a0p) };
      ctx.addBox(p);
      if ((i + j) % 2 === 0) ctx.addLight({ pos: axis === 'x' ? [a, fy + h + off(a) - 0.4, c] : [c, fy + h + off(a) - 0.4, a], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity, distance: 7 });
    }
    // 家具を剪断する（当たる物は見えない当たりの箱を別に）
    const ai = axis === 'x' ? 0 : 2;
    for (const b of dressed.boxes) {
      if (FLAT.has(b.mat)) continue;
      if (b.slope && b.slope.axis !== axis) continue;
      const o0 = off(b.min[ai]!), o1 = off(b.max[ai]!);
      const vis: Box = { ...b, min: [b.min[0], b.min[1] + o0, b.min[2]], max: [b.max[0], b.max[1] + o0, b.max[2]], solid: false, slope: { axis, rise: o1 - o0 + (b.slope?.rise ?? 0) } };
      ctx.addBox(vis);
      if (b.solid && b.kind !== 'colliderOnly') {
        const c: Box = { min: [b.min[0], b.min[1] + Math.min(o0, o1), b.min[2]], max: [b.max[0], b.max[1] + Math.max(o0, o1), b.max[2]], mat: b.mat, solid: true, kind: 'colliderOnly' };
        ctx.addBox(c);
      } else if (b.solid) {
        ctx.addBox({ ...b, min: [b.min[0], b.min[1] + Math.min(o0, o1), b.min[2]], max: [b.max[0], b.max[1] + Math.max(o0, o1), b.max[2]] });
      }
    }
    for (const z of dressed.zones) ctx.addZone(z);
    // 低い壁際に寄った物（缶・玉・紙）
    const lowA = lowAtMin ? A0 + WALL_T + 0.25 : A1 - WALL_T - 0.25;
    for (let i = 0; i < 14; i++) {
      const c = ctx.rng.float(cross0 + 0.4, cross0 + along - 0.4), a = lowA + (lowAtMin ? 1 : -1) * ctx.rng.float(0, 0.5);
      const s = ctx.rng.float(0.07, 0.16);
      const y = fy + off(a);
      const m = ctx.rng.pick<MatId>(['canLabel', 'plasticRed', 'plasticBlue', 'signPlate', 'boxCardboard']);
      const it = axis === 'x' ? box([a - s, y, c - s], [a + s, y + (m === 'signPlate' ? 0.004 : s * 1.6), c + s], m, false) : box([c - s, y, a - s], [c + s, y + (m === 'signPlate' ? 0.004 : s * 1.6), a + s], m, false);
      ctx.addBox(it);
    }
    ctx.skipDress();
    return true;
  },
});
