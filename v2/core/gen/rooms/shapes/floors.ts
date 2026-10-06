/**
 * 床の高さの形: 中央の穴（S15）・穴の回廊（S04）・全面グレーチング（S14）・水没した下半分（S28）・段々の部屋（S08）。
 * どれも閉じ込めない: 落ちた先（穴の底・水の中・すり鉢の底）から、段で上の床へ戻れる。開口の前は元の床のまま。
 * - 中央の穴: 部屋の真ん中が深さ 2.2 m の穴。手すりは無く、縁（1.25 m 以上）を回って進む。落ちたら壁沿いの段で縁へ。底に落とし物
 * - 穴の回廊 [QR]: 部屋のほとんどが深さ 3 m の吹き抜け。手すりの回廊が囲み、下は家具の置かれた別の部屋（段で下りられる）
 * - 全面グレーチング: 床が全部、鉄の格子。2.4 m 下の設備（配管・ポンプ・水たまり・橙の灯り）が透けて見える
 * - 水没した下半分: 床が 1.4 m 下がって水に沈み、家具は水の中。扉の前の台と、台をつなぐ板の道を歩く。落ちたら段で台へ
 * - 段々の部屋: 講堂のすり鉢。開口の側から舞台へ、段（0.35 m）が下がり、段ごとに座席の列（通路は両端）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { seatRow } from '../../dress/props.ts';
import { wallFrame } from '../../gimmicks/util.ts';
import { defineRoomShape, type RoomShapeContext } from '../types.ts';
import {
  clearBottom, clearOfDoors, footOf, frontRect, freeWalls, lift, pitStair, platform, railing, rbox, rectD, rectsHit, rectW, sinkFloor, snap, stairs, subDress, useDress, WET_THEMES,
} from '../util.ts';

const LOOK = ['dark', 'fog', 'tint'] as const;
const inRect = (r: Rect, x: number, z: number): boolean => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** 壁 d に開口があるか */
const hasOpening = (ctx: RoomShapeContext, d: Dir): boolean => ctx.geo.openings.some((o) => o.dir === d);

/** 縁の幅: 開口のある壁の側は扉の前を空ける広さ */
function rimHole(ctx: RoomShapeContext, rimMin: number, rimMax: number): Rect {
  const r = ctx.inner;
  const rim = (d: Dir): number => (hasOpening(ctx, d) ? Math.max(1.65, rimMin) : snap(ctx.rng.float(rimMin, rimMax)));
  return { x0: r.x0 + rim(3), x1: r.x1 - rim(1), z0: r.z0 + rim(2), z1: r.z1 - rim(0) };
}

/** 穴の縁の注意の線（縁の床の上、穴の外側 0.1 m） */
function edgeLines(ctx: RoomShapeContext, hole: Rect, mat: MatId = 'yellowLine'): void {
  const y = ctx.fy;
  for (const q of [{ x0: hole.x0 - 0.12, x1: hole.x1 + 0.12, z0: hole.z0 - 0.12, z1: hole.z0 }, { x0: hole.x0 - 0.12, x1: hole.x1 + 0.12, z0: hole.z1, z1: hole.z1 + 0.12 }, { x0: hole.x0 - 0.12, x1: hole.x0, z0: hole.z0, z1: hole.z1 }, { x0: hole.x1, x1: hole.x1 + 0.12, z0: hole.z0, z1: hole.z1 }]) {
    ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + 0.006, q.z1], mat, false));
  }
}

// ---------------------------------------------------------------- S15 中央の穴

defineRoomShape({
  id: 'centerHole', idea: 'S15', name: '中央の穴', kinds: ['room', 'hall'], minSize: [5.0, 6.2], minHeight: 2.3, weight: 1.0,
  anomalies: LOOK, water: false,
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, fy = ctx.fy;
    const hole = rimHole(ctx, t['rooms.hole.rimM'], t['rooms.hole.rimM'] + 0.35);
    if (rectW(hole) < 2.2 || rectD(hole) < 2.2 || !clearOfDoors(ctx, hole, 1.6, 0.45)) return false;
    const depth = t['rooms.hole.depthM'];
    // 段が収まるか先に確かめる（穴を開けてからでは戻しにくい）
    if (Math.max(rectW(hole), rectD(hole)) - 0.3 < Math.ceil(depth / 0.25) * 0.27 + 0.9) return false;
    const P = sinkFloor(ctx, hole, depth);
    if (!P) return false;
    const st = pitStair(ctx, P, fy - depth, fy, [0, 1, 2, 3], { riseMax: 0.25, tread: 0.27 });
    if (!st) return false;
    edgeLines(ctx, hole);
    // 底: 薄暗い灯りと落とし物（段から遠い隅に小さな金の物・倒れた椅子・紙）
    const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
    ctx.addLight({ pos: [cx, fy - depth + 1.4, cz], color: 0xbfd0e0, intensity: 0.3, distance: Math.max(4, Math.hypot(rectW(P), rectD(P)) * 0.7) });
    const corners: [number, number][] = [[P.x0 + 0.35, P.z0 + 0.35], [P.x1 - 0.35, P.z0 + 0.35], [P.x0 + 0.35, P.z1 - 0.35], [P.x1 - 0.35, P.z1 - 0.35]];
    const far = corners.filter(([x, z]) => !rectsHit(st.rect, { x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 }) && !rectsHit(st.foot, { x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 }));
    const yb = fy - depth;
    if (far.length) {
      const [x, z] = ctx.rng.pick(far);
      ctx.addBox(box([x - 0.06, yb, z - 0.06], [x + 0.06, yb + 0.1, z + 0.06], 'goldTrim', false));
    }
    for (let i = 0; i < 9; i++) {
      const x = ctx.rng.float(P.x0 + 0.3, P.x1 - 0.3), z = ctx.rng.float(P.z0 + 0.3, P.z1 - 0.3);
      if (inRect(st.rect, x, z) || inRect(st.foot, x, z)) continue;
      ctx.addBox(box([x - 0.105, yb + 0.002, z - 0.148], [x + 0.105, yb + 0.004, z + 0.148], 'signPlate', false));
    }
    // 家具は縁に置かない（穴の周り 1 m。縁を回る道を塞がない）
    ctx.keepOut({ min: [hole.x0 - 1.0, fy - depth, hole.z0 - 1.0], max: [hole.x1 + 1.0, fy + 3, hole.z1 + 1.0] });
    return true;
  },
});

// ---------------------------------------------------------------- S04 穴の回廊

defineRoomShape({
  id: 'pitGallery', idea: 'S04', name: '穴の回廊', kinds: ['room', 'hall'], minSize: [6.0, 6.6], minHeight: 2.4, weight: 1.0,
  anomalies: LOOK,
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy;
    const hole = rimHole(ctx, t['rooms.gallery.widthM'], t['rooms.gallery.widthM'] + 0.2);
    if (rectW(hole) < 3.2 || rectD(hole) < 3.2 || !clearOfDoors(ctx, hole, 1.6, 0.45)) return false;
    const depth = t['rooms.gallery.depthM'];
    if (Math.max(rectW(hole), rectD(hole)) - 0.3 < Math.ceil(depth / 0.26) * 0.26 + 0.9) return false;
    const P = sinkFloor(ctx, hole, depth);
    if (!P) return false;
    const st = pitStair(ctx, P, fy - depth, fy, [0, 1, 2, 3], { mat: cell.palette.floor, riseMax: 0.26, tread: 0.26 });
    if (!st) return false;
    // 回廊の手すり（穴の縁の 4 辺）。段の沿う辺は、段の上の 1.2 m（縁と同じ高さに近い段）の横を出入りのために空ける
    const edges: [Dir, number, number, number, number][] = [[2, hole.x0, hole.z0, hole.x1, hole.z0], [0, hole.x0, hole.z1, hole.x1, hole.z1], [3, hole.x0, hole.z0, hole.x0, hole.z1], [1, hole.x1, hole.z0, hole.x1, hole.z1]];
    for (const [side, x0, z0, x1, z1] of edges) {
      const alongX = side === 0 || side === 2;
      if (side !== st.side) { railing(ctx, x0, z0, x1, z1, fy, { mat: 'metalDark' }); continue; }
      const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
      const up = st.dir === 1 || st.dir === 0;
      const high = up ? (alongX ? st.rect.x1 : st.rect.z1) : (alongX ? st.rect.x0 : st.rect.z0);
      const g0 = up ? high - 1.2 : high, g1 = up ? high + 0.2 : high + 1.2;
      const seg = (p: number, q: number): void => { if (q - p > 0.1) railing(ctx, alongX ? p : x0, alongX ? z0 : p, alongX ? q : x0, alongX ? z0 : q, fy, { mat: 'metalDark' }); };
      seg(a0, Math.max(a0, g0 - (up ? 0 : 0.2)));
      seg(Math.min(a1, g1), a1);
    }
    // 下の部屋: 家具（段とその足元は空ける）と灯り
    const keep = [st.rect, st.foot].map((q) => ({ min: [q.x0 - 0.2, fy - depth, q.z0 - 0.2] as [number, number, number], max: [q.x1 + 0.2, fy, q.z1 + 0.2] as [number, number, number] }));
    const d = subDress(ctx, { rects: [hole], floorY: fy - depth, height: depth - 0.02, openings: [], keepOut: keep, tag: 'pit', noHung: true });
    // 下の部屋のどこからでも段の足元へ歩ける（家具で囲まれた所を作らない）
    const removed = clearBottom(P, fy - depth, [st.rect], [(st.foot.x0 + st.foot.x1) / 2, (st.foot.z0 + st.foot.z1) / 2], d.boxes);
    if (!removed) return false;
    const gone = new Set(removed);
    d.boxes = d.boxes.filter((b) => !gone.has(b));
    const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
    ctx.addLight({ pos: [cx, fy - depth + 2.2, cz], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * 0.7, distance: Math.max(6, Math.hypot(rectW(P), rectD(P)) * 0.8) });
    useDress(ctx, d);
    return true;
  },
});

// ---------------------------------------------------------------- S14 全面グレーチング

defineRoomShape({
  id: 'grating', idea: 'S14', name: '全面グレーチングの床', kinds: ['room', 'hall'], minSize: [3.8, 4.2], minHeight: 2.3, weight: 0.9,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'giant', 'tiny', 'scatter', 'multiply'],
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, r = ctx.inner;
    const depth = t['rooms.grating.depthM'];
    const P = sinkFloor(ctx, r, depth, { wallMat: 'wallConcrete', floorMat: 'floorConcrete' });
    if (!P) return false;
    // 歩く面: 見えない当たりの板 1 枚（上面が元の床）と、格子の棒（描画だけ）
    const plate = rbox(r, fy - 0.04, fy, 'metalDark');
    plate.kind = 'colliderOnly';
    ctx.addBox(plate);
    const alongX = rectW(r) >= rectD(r);
    const pitch = t['rooms.grating.pitchM'];
    const L = alongX ? rectD(r) : rectW(r), A = alongX ? rectW(r) : rectD(r);
    const n = Math.floor(L / pitch);
    for (let i = 0; i <= n; i++) {
      const c = (alongX ? r.z0 : r.x0) + (L * i) / n;
      ctx.addBox(alongX ? box([r.x0, fy - 0.04, c - 0.012], [r.x1, fy, c + 0.012], 'metalDark', false) : box([c - 0.012, fy - 0.04, r.z0], [c + 0.012, fy, r.z1], 'metalDark', false));
    }
    for (let a = 0; a <= A + 1e-6; a += 1.0) {
      const c = (alongX ? r.x0 : r.z0) + Math.min(a, A);
      ctx.addBox(alongX ? box([c - 0.02, fy - 0.06, r.z0], [c + 0.02, fy - 0.005, r.z1], 'metal', false) : box([r.x0, fy - 0.06, c - 0.02], [r.x1, fy - 0.005, c + 0.02], 'metal', false));
    }
    // 下の設備: 長い配管・ポンプ・タンク・水たまり・橙の灯り
    const yb = fy - depth;
    const mats: MatId[] = ['metal', 'stainless', 'plasticRed', 'metalDark'];
    for (let k = 0; k < 3; k++) {
      const off = ctx.rng.float(0.4, (alongX ? rectD(P) : rectW(P)) - 0.4);
      const y = yb + ctx.rng.float(0.4, depth - 0.6), s = ctx.rng.float(0.12, 0.26);
      const c = (alongX ? P.z0 : P.x0) + off;
      ctx.addBox(alongX ? box([P.x0, y, c - s / 2], [P.x1, y + s, c + s / 2], ctx.rng.pick(mats), false) : box([c - s / 2, y, P.z0], [c + s / 2, y + s, P.z1], ctx.rng.pick(mats), false));
    }
    for (let k = 0; k < 3; k++) {
      const x = ctx.rng.float(P.x0 + 0.6, P.x1 - 0.6), z = ctx.rng.float(P.z0 + 0.6, P.z1 - 0.6);
      const big = ctx.rng.chance(0.5);
      ctx.addBox(box([x - (big ? 0.5 : 0.3), yb, z - (big ? 0.5 : 0.3)], [x + (big ? 0.5 : 0.3), yb + (big ? 1.3 : 0.7), z + (big ? 0.5 : 0.3)], big ? 'metal' : 'plasticBlue', false));
    }
    for (let k = 0; k < 4; k++) {
      const x = ctx.rng.float(P.x0 + 0.4, P.x1 - 0.4), z = ctx.rng.float(P.z0 + 0.4, P.z1 - 0.4), s = ctx.rng.float(0.4, 1.1);
      ctx.addBox(box([x - s / 2, yb, z - s * 0.4], [x + s / 2, yb + 0.004, z + s * 0.4], 'puddle', false));
    }
    const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
    ctx.addBox(box([cx - 0.12, yb + depth - 0.45, cz - 0.12], [cx + 0.12, yb + depth - 0.3, cz + 0.12], 'lightYellow', false));
    ctx.addLight({ pos: [cx, yb + 0.8, cz], color: 0xffa060, intensity: 0.7, distance: Math.max(5, Math.hypot(rectW(P), rectD(P)) * 0.7) });
    for (const l of cell.lights) if (l.pos[1] > fy) l.intensity *= 0.75;
    return true;
  },
});

// ---------------------------------------------------------------- S28 水没した下半分

defineRoomShape({
  id: 'sunkenWater', idea: 'S28', name: '水没した下半分', kinds: ['room', 'hall'], minSize: [4.6, 5.0], minHeight: 2.4, weight: 0.9, water: true,
  anomalies: LOOK,
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const D = t['rooms.sunken.depthM'];
    const yb = fy - D;
    const ops = ctx.geo.openings;
    if (ops.length < 1) return false;
    // 開口の前の台（深さ 1.5 m）と、台をつなぐ板の道（真ん中の点を通る L 字）
    const pads = ops.map((o) => {
      const fr = frontRect(o, WALL_T + 1.5, 0.45);
      return { x0: Math.max(r.x0, fr.x0), x1: Math.min(r.x1, fr.x1), z0: Math.max(r.z0, fr.z0), z1: Math.min(r.z1, fr.z1) };
    });
    const hub: [number, number] = [snap((r.x0 + r.x1) / 2 + ctx.rng.float(-0.6, 0.6)), snap((r.z0 + r.z1) / 2 + ctx.rng.float(-0.6, 0.6))];
    const pw = t['rooms.sunken.walkM'] / 2;
    const walks: Rect[] = [];
    pads.forEach((p, i) => {
      const o = ops[i]!;
      const [ex, ez] = [(p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2];
      // 台の奥の辺の真ん中から、中心へ（開口の向きに進んでから曲がる）
      if (o.dir === 0 || o.dir === 2) {
        const zEdge = o.dir === 0 ? p.z0 : p.z1;
        walks.push({ x0: ex - pw, x1: ex + pw, z0: Math.min(zEdge, hub[1]) - pw, z1: Math.max(zEdge, hub[1]) + pw });
        walks.push({ x0: Math.min(ex, hub[0]) - pw, x1: Math.max(ex, hub[0]) + pw, z0: hub[1] - pw, z1: hub[1] + pw });
      } else {
        const xEdge = o.dir === 1 ? p.x0 : p.x1;
        walks.push({ x0: Math.min(xEdge, hub[0]) - pw, x1: Math.max(xEdge, hub[0]) + pw, z0: ez - pw, z1: ez + pw });
        walks.push({ x0: hub[0] - pw, x1: hub[0] + pw, z0: Math.min(ez, hub[1]) - pw, z1: Math.max(ez, hub[1]) + pw });
      }
    });
    const P = sinkFloor(ctx, r, D, { wallMat: cell.palette.wall });
    if (!P) return false;
    // 台（底から積んだ箱。上面が元の床）
    for (const p of pads) platform(ctx, p, fy, { base: yb, mat: cell.palette.floor, under: cell.palette.wall });
    // 板の道（上面が床。下に支柱）
    for (const w of walks) {
      const q = { x0: Math.max(r.x0, w.x0), x1: Math.min(r.x1, w.x1), z0: Math.max(r.z0, w.z0), z1: Math.min(r.z1, w.z1) };
      if (rectW(q) < 0.1 || rectD(q) < 0.1) continue;
      platform(ctx, q, fy, { base: yb, thick: 0.08, mat: 'woodPanel', under: 'metalDark', supports: 2.0, postsSolid: false });
    }
    // 水: 底から床の 0.15 m 下まで（歩く速さを落とすゾーンも同じ範囲）
    const top = fy - 0.15;
    const wb = rbox(P, yb + 0.005, top, 'water', false);
    ctx.addBox(wb);
    ctx.addZone({ kind: 'water', aabb: { min: [P.x0, yb - 0.1, P.z0], max: [P.x1, top + 0.05, P.z1] }, params: { slow: t['rooms.sunken.slow'] } });
    // 水から上がる段: 台の横（水の側）に 1〜2 本
    const used: Rect[] = [];
    const stairRects: Rect[] = [];
    let foot0: [number, number] | null = null;
    let ups = 0;
    for (const p of ctx.rng.shuffle(pads.slice())) {
      if (ups >= 2) break;
      for (const side of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
        // 段を台の辺に沿わせ、台の方へ上る（段の上の端が台に接する）
        const n = Math.ceil(D / 0.24 - 1e-9), run = n * 0.3;
        const along = side === 0 || side === 2;
        const len = along ? rectW(p) : rectD(p);
        if (len < 0.95) continue;
        const sw = Math.min(0.9, len);
        const c = along ? (p.x0 + p.x1) / 2 : (p.z0 + p.z1) / 2;
        const start = side === 0 ? p.z1 + run : side === 2 ? p.z0 - run : side === 1 ? p.x1 + run : p.x0 - run;
        const dir: Dir = side === 0 ? 2 : side === 2 ? 0 : side === 1 ? 3 : 1;
        const sx = along ? c : start, sz = along ? start : c;
        const fr: Rect = along ? { x0: c - sw / 2, x1: c + sw / 2, z0: Math.min(start, side === 0 ? p.z1 : p.z0) - (side === 0 ? 0 : 0.9), z1: Math.max(start, side === 0 ? p.z1 : p.z0) + (side === 0 ? 0.9 : 0) }
          : { z0: c - sw / 2, z1: c + sw / 2, x0: Math.min(start, side === 1 ? p.x1 : p.x0) - (side === 1 ? 0 : 0.9), x1: Math.max(start, side === 1 ? p.x1 : p.x0) + (side === 1 ? 0.9 : 0) };
        if (fr.x0 < P.x0 + 0.05 || fr.x1 > P.x1 - 0.05 || fr.z0 < P.z0 + 0.05 || fr.z1 > P.z1 - 0.05) continue;
        if ([...pads, ...used].some((q) => q !== p && rectsHit(q, fr))) continue;
        if (walks.some((w) => rectsHit(w, fr))) continue;
        const st = stairs(ctx, { x: sx, z: sz, dir, width: sw, y0: yb, y1: fy, riseMax: 0.24, tread: 0.3, mat: 'stainless', rails: 'both', railMat: 'metal' });
        used.push(fr);
        stairRects.push(st.rect);
        if (!foot0) foot0 = along ? [c, side === 0 ? start + 0.45 : start - 0.45] : [side === 1 ? start + 0.45 : start - 0.45, c];
        ups++;
        break;
      }
    }
    if (!ups) return false;
    // 水の中の家具（沈んだ部屋。背の高い物は水から出る）・水面の紙
    const keep = [...used, ...pads].map((q) => ({ min: [q.x0 - 0.3, yb, q.z0 - 0.3] as [number, number, number], max: [q.x1 + 0.3, fy + 3, q.z1 + 0.3] as [number, number, number] }));
    const d = subDress(ctx, { rects: cell.footprint, floorY: yb, height: D + h - 0.1, openings: [], keepOut: keep, tag: 'sunk', noHung: true });
    // 水の中のどこからでも段の足元へ歩ける（台・家具で囲まれた水溜まりを作らない。板の道の下はしゃがんで通れる）
    const removed = clearBottom(P, yb, [...pads, ...stairRects], foot0!, d.boxes);
    if (!removed) return false;
    const gone = new Set(removed);
    d.boxes = d.boxes.filter((b) => !gone.has(b));
    for (let i = 0; i < 16; i++) {
      const x = ctx.rng.float(P.x0 + 0.3, P.x1 - 0.3), z = ctx.rng.float(P.z0 + 0.3, P.z1 - 0.3);
      const b = box([x - 0.105, top + 0.003, z - 0.148], [x + 0.105, top + 0.006, z + 0.148], 'signPlate', false);
      if ([...walks, ...pads].some((q) => inRect(q, x, z)) || d.boxes.some((x2) => x2.solid && x2.min[1] < top && x2.max[1] > top && rectsHit(footOf(x2), footOf(b)))) continue;
      b.kind = 'floatingPaper';
      ctx.addBox(b);
    }
    cell.render = { ...cell.render, wetness: Math.max(cell.render?.wetness ?? 0, 0.5) };
    useDress(ctx, d);
    return true;
  },
});

// ---------------------------------------------------------------- S08 段々の部屋

defineRoomShape({
  id: 'terraces', idea: 'S08', name: '段々の部屋', kinds: ['room', 'hall'], minSize: [4.8, 5.6], minHeight: 2.4, weight: 1.0,
  anomalies: LOOK,
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const free = freeWalls(ctx);
    if (!free.length) return false;
    // 舞台の壁: 入口の向かいの壁を先に
    const opp = ((ctx.entrance.dir + 2) % 4) as Dir;
    const order = free.includes(opp) ? [opp, ...free.filter((d) => d !== opp)] : free;
    for (const sd of order) {
      const F = wallFrame(r, sd);
      // すり鉢の奥行き V: 開口の前（奥行き 1.75 m）に掛からない所まで
      let V = F.depth - 1.7;
      for (const o of ctx.geo.openings) {
        const fr = frontRect(o, WALL_T + 1.75, 0.45);
        const vs = [F.v(fr.x0, fr.z0), F.v(fr.x1, fr.z1), F.v(fr.x0, fr.z1), F.v(fr.x1, fr.z0)];
        V = Math.min(V, Math.min(...vs) - 0.15);
      }
      const rise = t['rooms.terrace.riseM'], tread = t['rooms.terrace.treadM'];
      const stageD = 1.5;
      const k = Math.min(t['rooms.terrace.max'], Math.floor((V - stageD) / tread));
      if (k < 2) continue;
      const D = k * rise;
      const bowl = F.rect(F.u0, 0, F.u1, stageD + k * tread);
      if (!clearOfDoors(ctx, bowl, 1.6, 0.45)) continue;
      const P = sinkFloor(ctx, bowl, D);
      if (!P) return false;
      // 段: 上から 1 段ずつ 0.35 m 下がる（段の上に座席の列。両端は通路）
      const seatMat = ctx.rng.pick<MatId>(['seatRed', 'seatBlue', 'upholstery']);
      const facing = sd;
      const aisle = 0.95;
      for (let j = 1; j <= k; j++) {
        const v0 = stageD + (k - j) * tread, v1 = v0 + tread;
        const topY = fy - j * rise;
        const q = F.rect(F.u0, v0, F.u1, v1);
        const b = rbox(q, fy - D - 0.2, topY, cell.palette.floor);
        b.kind = 'terrace';
        ctx.addBox(b);
        // 座席の列（段の奥側。床 = 0 で作って段の上面へ上げる）
        const B: Box[] = [];
        const along = sd === 0 || sd === 2;
        const a0 = F.u0 + aisle, a1 = F.u1 - aisle;
        if (a1 - a0 < 1.2) continue;
        const [, cz] = F.point(0, v0 + tread * 0.62);
        const cc = along ? cz : F.point(0, v0 + tread * 0.62)[0];
        seatRow(B, along, a0, a1, cc, 0, facing, seatMat);
        lift(B, cell.id, topY, `row${j}`);
        for (const x of B) { delete x.propGroup; ctx.addBox(x); }
      }
      // いちばん上の段の縁の手すり（両端の通路の上は空ける）
      const [ax, az] = F.point(F.u0 + aisle, stageD + k * tread), [bx, bz] = F.point(F.u1 - aisle, stageD + k * tread);
      railing(ctx, ax, az, bx, bz, fy, { h: 0.9 });
      // 舞台: すり鉢の底の奥に低い台（0.4 m）と幕、演台
      const stage = F.rect(F.u0 + 0.6, 0, F.u1 - 0.6, 1.0);
      const sb = rbox(stage, fy - D, fy - D + 0.34, 'woodPanel');
      sb.kind = 'terrace';
      ctx.addBox(sb);
      const curtain = F.rect(F.u0, 0, F.u1, 0.1);
      ctx.addBox(rbox(curtain, fy - D + 0.34, Math.min(fy + h - 0.1, fy - D + 3.4), 'seatRed', false));
      const [lx, lz] = F.point((F.u0 + F.u1) / 2 + 0.6, 0.55);
      ctx.addBox(box([lx - 0.25, fy - D + 0.34, lz - 0.2], [lx + 0.25, fy - D + 1.4, lz + 0.2], 'woodPanel', false));
      const [sx, sz] = F.point((F.u0 + F.u1) / 2, 1.2);
      ctx.addLight({ pos: [sx, fy - D + 2.6, sz], color: 0xffd9a0, intensity: cell.palette.lightIntensity * 1.1, distance: 6 });
      ctx.skipDress();
      return true;
    }
    return false;
  },
});

