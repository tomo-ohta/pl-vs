/**
 * 天井の形: 天井井戸（S05）・低すぎる天井（S10）・高すぎる天井（S11）・天井の高さが場所で変わる（S30）。
 * どれも扉を開けた瞬間に「天井が違う」と分かる。開口の前（扉を開けて立つ所）は普通の高さのまま。
 */
import { box, WALL_T, type Box } from '../../../world/layout.ts';
import type { Rect } from '../../../world/footprint.ts';
import { fillRects } from '../../gimmicks/util.ts';
import { defineRoomShape } from '../types.ts';
import {
  clearCeilingLights, clearOfDoors, cutCeiling, frontRect, lightGridAt, mainAxisOf, MAZE_THEMES, raiseCeiling, rbox, rectArea, rectD, rectsHit, rectW, snap, subDress, useDress, WET_THEMES,
} from '../util.ts';

/** 光る物・家具を置かない（どれも家具の要らない異変） */
const LOOK = ['fog', 'tint'] as const;

/**
 * S05 天井井戸: 天井に四角い縦穴がいくつも開き、穴の上の灯りが床に光の溜まりを落とす（部屋の照明はそれだけ）。
 * 穴の下に立って見上げると、細長い井戸の底にいるよう。井戸の一つの下に椅子が 1 脚
 */
defineRoomShape({
  id: 'ceilingWells', idea: 'S05', name: '天井井戸', kinds: ['room', 'hall'], minSize: [4.4, 5], minHeight: 2.4, weight: 0.9,
  anomalies: ['fog', 'tint', 'clocks', 'giant', 'tiny', 'scatter', 'multiply'],
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const want = Math.min(t['rooms.wells.max'], Math.max(1, Math.round(rectArea(r) / 14)));
    const wells: Rect[] = [];
    for (let i = 0; i < 40 && wells.length < want; i++) {
      const s = snap(ctx.rng.float(t['rooms.wells.sizeMin'], Math.max(t['rooms.wells.sizeMin'], t['rooms.wells.sizeMax'])));
      if (rectW(r) < s + 0.8 || rectD(r) < s + 0.8) continue;
      const x = snap(ctx.rng.float(r.x0 + 0.4, r.x1 - 0.4 - s)), z = snap(ctx.rng.float(r.z0 + 0.4, r.z1 - 0.4 - s));
      const w: Rect = { x0: x, z0: z, x1: x + s, z1: z + s };
      if (wells.some((o) => rectsHit({ x0: o.x0 - 0.9, z0: o.z0 - 0.9, x1: o.x1 + 0.9, z1: o.z1 + 0.9 }, w))) continue;
      const depth = snap(ctx.rng.float(t['rooms.wells.depthMin'], Math.max(t['rooms.wells.depthMin'], t['rooms.wells.depthMax'])));
      if (!ctx.claim(fy + h, fy + h + depth + 0.25, w)) continue;
      wells.push(w);
      cutCeiling(cell, w);
      const y0 = fy + h, y1 = fy + h + depth;
      const mat = cell.palette.wall;
      const tw = 0.15;
      // 井戸の壁（穴の内側に厚さ 0.15）と蓋。蓋の下に強い灯り
      ctx.addBox(box([w.x0, y0, w.z0], [w.x0 + tw, y1, w.z1], mat));
      ctx.addBox(box([w.x1 - tw, y0, w.z0], [w.x1, y1, w.z1], mat));
      ctx.addBox(box([w.x0 + tw, y0, w.z0], [w.x1 - tw, y1, w.z0 + tw], mat));
      ctx.addBox(box([w.x0 + tw, y0, w.z1 - tw], [w.x1 - tw, y1, w.z1], mat));
      ctx.addBox(box([w.x0, y1, w.z0], [w.x1, y1 + 0.2, w.z1], cell.palette.ceiling));
      const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2;
      ctx.addBox(box([cx - (s - 0.4) / 2, y1 - 0.03, cz - (s - 0.4) / 2], [cx + (s - 0.4) / 2, y1, cz + (s - 0.4) / 2], cell.palette.light, false));
      ctx.addLight({ pos: [cx, y1 - 0.5, cz], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * t['rooms.wells.light'], distance: depth + h + 3 });
    }
    if (!wells.length) return false;
    // 部屋の照明は井戸の灯りだけ（井戸の下に光の溜まり、ほかは薄暗い）
    clearCeilingLights(cell);
    // 井戸の一つの下に、入口を向いた椅子（見上げる人のための）
    const w0 = wells[0]!;
    const cx = (w0.x0 + w0.x1) / 2, cz = (w0.z0 + w0.z1) / 2;
    const seat: Rect = { x0: cx - 0.25, z0: cz - 0.25, x1: cx + 0.25, z1: cz + 0.25 };
    if (clearOfDoors(ctx, seat, 1.6, 0.4)) {
      const add = (b: Box): void => { ctx.addBox(b); };
      add(box([cx - 0.22, fy + 0.41, cz - 0.22], [cx + 0.22, fy + 0.45, cz + 0.22], 'woodPanel'));
      add(box([cx - 0.22, fy + 0.45, cz - 0.22], [cx + 0.22, fy + 0.85, cz - 0.18], 'woodPanel'));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box([cx + sx * 0.19 - 0.015, fy, cz + sz * 0.19 - 0.015], [cx + sx * 0.19 + 0.015, fy + 0.41, cz + sz * 0.19 + 0.015], 'metalDark', false));
      ctx.keepOut({ min: [cx - 0.7, fy, cz - 0.7], max: [cx + 0.7, fy + 2, cz + 0.7] });
    }
    return true;
  },
});

/**
 * S10 低すぎる天井: 扉を開けると、天井が胸の高さ（1.6 m）まで下がっている。立ったままでは入れず、しゃがんで進む（スマホはしゃがむボタン）。
 * 開口の前（扉を開けて立つ所）だけ普通の高さ。家具も低い物だけ（天井の下に収まる）
 */
defineRoomShape({
  id: 'lowRoom', idea: 'S10', name: '低すぎる天井', kinds: ['room', 'hall'], minSize: [4.2, 4.8], minHeight: 2.4, weight: 0.7,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const lowH = t['rooms.low.heightM'];
    const vest = ctx.geo.openings.map((o) => frontRect(o, WALL_T + t['rooms.low.vestibuleM'], 0.45));
    const low = fillRects(r, vest).filter((q) => rectW(q) > 0.05 && rectD(q) > 0.05);
    const area = low.reduce((a, q) => a + rectArea(q), 0);
    if (area < 0.55 * rectArea(r)) return false;
    for (const q of low) {
      const b = rbox(q, fy + lowH, fy + h, cell.palette.ceiling);
      b.kind = 'lowCeiling';
      ctx.addBox(b);
    }
    // 照明: 低い天井に埋めたパネル（元の天井の照明は低い天井の上に隠れるので外す）
    const inLow = (x: number, z: number): boolean => low.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
    clearCeilingLights(cell, inLow);
    lightGridAt(ctx, low.filter((q) => rectW(q) >= 1.2 && rectD(q) >= 1.2), fy + lowH, 2.4, 0.5);
    // 家具: 低い天井の下に収まる物だけ（仮の天井の高さで中身を置く）
    useDress(ctx, subDress(ctx, { rects: cell.footprint, height: lowH - 0.05, openings: ctx.geo.openings, tag: 'low', noHung: true }));
    return true;
  },
});

/**
 * S11 高すぎる天井: 天井が 30 m 上にあり、照明は天井の真ん中の蛍光灯 1 本だけ。床は薄暗く、見上げると遠くに小さな光。
 * 家具は普通の部屋のまま（だからこそ天井だけが異様に高い）
 */
defineRoomShape({
  id: 'highCeiling', idea: 'S11', name: '高すぎる天井', kinds: ['room', 'hall'], minSize: [3.8, 4.2], minHeight: 2.4, maxHeight: 6, weight: 0.6,
  anomalies: LOOK,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    let H = 0;
    for (const k of [1, 0.66, 0.45]) {
      const cand = snap(t['rooms.high.heightM'] * k);
      if (cand < h + 5) break;
      if (raiseCeiling(ctx, cand)) { H = cand; break; }
    }
    if (!H) return false;
    clearCeilingLights(cell);
    // 蛍光灯 1 本: 天井に直付けの細長い器具（遠くから見ても蛍光灯と分かる長さ）
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const alongX = rectW(r) >= rectD(r);
    const hx = alongX ? 0.62 : 0.07, hz = alongX ? 0.07 : 0.62;
    const y = fy + H - 0.1;
    ctx.addBox(box([cx - hx, y + 0.04, cz - hz], [cx + hx, fy + H, cz + hz], 'metal', false));
    ctx.addBox(box([cx - hx + 0.02, y, cz - hz + 0.02], [cx + hx - 0.02, y + 0.04, cz + hz - 0.02], cell.palette.light, false));
    ctx.addLight({ pos: [cx, y - 0.25, cz], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * t['rooms.high.light'], distance: H * 1.6 });
    // 家具は元の天井の高さの部屋として置く（吊り照明は除く）
    useDress(ctx, subDress(ctx, { rects: cell.footprint, height: h, openings: ctx.geo.openings, tag: 'high', noHung: true }));
    return true;
  },
});

/**
 * S30 天井の高さが場所で変わる: 天井が波のように上がったり下がったりする（部屋の奥行きの向き）。低い所は頭すれすれ（1.9 m）、
 * 高い所は元の天井より 2〜3 m 上。開口の前は扉より高い。天井は傾けた板（描画）と、当たり判定の箱（下の低い方の高さから上）
 */
defineRoomShape({
  id: 'waveCeiling', idea: 'S30', name: '天井の高さが変わる', kinds: ['room', 'hall'], minSize: [3.8, 5.4], minHeight: 2.4, maxHeight: 6, weight: 0.8,
  anomalies: ['fog', 'dark'],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const axis = mainAxisOf(ctx);
    const a0 = axis === 'x' ? r.x0 : r.z0, a1 = axis === 'x' ? r.x1 : r.z1;
    const c0 = axis === 'x' ? r.z0 : r.x0, c1 = axis === 'x' ? r.z1 : r.x1;
    const L = a1 - a0;
    const n = Math.max(4, Math.round(L / t['rooms.wave.stepM']));
    const low = t['rooms.wave.lowM'], high = snap(h + t['rooms.wave.highAddM'] * ctx.rng.float(0.8, 1.1));
    // 開口の前（奥行き 1.6 m）に掛かる位置の下限: 開口の上端 + 0.2（隣の点との間の板も低くならないよう、1 区間ぶん広げて見る）
    const doorMin = (a: number): number => {
      let m = low;
      for (const o of ctx.geo.openings) {
        const fr = frontRect(o, WALL_T + 1.6, 0.4);
        const p0 = axis === 'x' ? fr.x0 : fr.z0, p1 = axis === 'x' ? fr.x1 : fr.z1;
        if (a >= p0 - L / n - 0.05 && a <= p1 + L / n + 0.05) m = Math.max(m, o.pos[1] - fy + (o.sill ?? 0) + o.height + 0.2);
      }
      return m;
    };
    // 波: ゆるい正弦と揺らぎ。両端と開口の前は下限を守る
    const phase = ctx.rng.float(0, Math.PI * 2), freq = ctx.rng.float(0.9, 1.4) * (Math.PI * 2) / Math.max(3, n * 0.55);
    const hs: number[] = [];
    for (let i = 0; i <= n; i++) {
      const s = 0.5 + 0.5 * Math.sin(phase + i * freq) + ctx.rng.float(-0.18, 0.18);
      const v = low + (high - 0.3 - low) * Math.min(1, Math.max(0, s));
      hs.push(snap(Math.max(v, doorMin(a0 + (L * i) / n))));
    }
    // 低い所と高い所を必ず作る（変化が分かるように）
    const lowAt = hs.indexOf(Math.min(...hs)), highAt = hs.indexOf(Math.max(...hs));
    if (doorMin(a0 + (L * lowAt) / n) <= low + 1e-6) hs[lowAt] = low;
    hs[highAt] = Math.max(hs[highAt]!, high - 0.3);
    if (Math.max(...hs) - Math.min(...hs) < 1.0) return false;
    if (!raiseCeiling(ctx, high)) return false;
    clearCeilingLights(cell);
    const mat = cell.palette.ceiling;
    for (let i = 0; i < n; i++) {
      const p = a0 + (L * i) / n, q = a0 + (L * (i + 1)) / n;
      const y0 = fy + hs[i]!, y1 = fy + hs[i + 1]!;
      const seg = (u0: number, u1: number, v0: number, v1: number): [number, number, number, number] => (axis === 'x' ? [u0, v0, u1, v1] : [v0, u0, v1, u1]);
      const [x0, z0, x1, z1] = seg(p, q, c0, c1);
      // 傾けた天井の板（描画だけ）: 下面が y0 → y1
      const slab = box([x0, y0, z0], [x1, y0 + 0.12, z1], mat, false);
      if (Math.abs(y1 - y0) > 1e-3) slab.slope = { axis, rise: y1 - y0 };
      ctx.addBox(slab);
      // 当たり判定: 低い方の高さから上（頭は傾いた板より先に当たる）
      const col = box([x0, Math.min(y0, y1), z0], [x1, fy + high, z1], mat, true);
      col.kind = 'colliderOnly';
      ctx.addBox(col);
      // 照明: 1 つおきに、板に沿って傾けた細い灯りと点光源
      if (i % 2 === 1 || n <= 4) {
        const m = (p + q) / 2, mid = (c0 + c1) / 2;
        const pw = Math.min(0.5, (c1 - c0) / 4);
        const [lx0, lz0, lx1, lz1] = seg(p + 0.15, q - 0.15, mid - pw, mid + pw);
        const k = (y1 - y0) / (q - p);
        const yl = y0 + k * 0.15 - 0.04;
        const lp = box([lx0, yl, lz0], [lx1, yl + 0.035, lz1], cell.palette.light, false);
        if (Math.abs(k) > 1e-4) lp.slope = { axis, rise: k * (q - p - 0.3) };
        ctx.addBox(lp);
        const ly = (y0 + y1) / 2 - 0.45;
        ctx.addLight({ pos: axis === 'x' ? [m, ly, mid] : [mid, ly, m], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * 0.8, distance: 6 });
      }
    }
    // 家具はいちばん低い天井の下に収まる物だけ
    const minH = Math.min(...hs);
    useDress(ctx, subDress(ctx, { rects: cell.footprint, height: Math.min(h, minH - 0.08), openings: ctx.geo.openings, tag: 'wave', noHung: true }));
    return true;
  },
});
