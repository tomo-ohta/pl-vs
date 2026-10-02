/**
 * 見た目の空間のゆがみ（段階 4・oddity）: 中が広い部屋（W04・W09・W18）・鏡の部屋（W16）・横倒しの部屋（W17）・遠近法の錯覚（W15）。
 * どれも重力はそのまま。部屋の形（天井の高さ・仕切り・家具の向き）を変えて、開けた瞬間に「おかしい」と分かるようにする。
 */
import type { Dir } from '../../../../math/vec.ts';
import { along, rectsOverlap, wallSpans } from '../../../../world/footprint.ts';
import { box, WALL_T, type Box, type MatId } from '../../../../world/layout.ts';
import { decorDoor } from '../../../dress/decor.ts';
import { chair } from '../../../dress/furniture.ts';
import { officeChair, schoolChair, schoolDesk } from '../../../dress/props.ts';
import { defineAnomaly } from '../../types.ts';
import {
  bbOf, boxSet, doorFronts, groupsOf, hitsAny, interiorSolids, isCeilingPanel, isCeilingSlab, isWallDecor, mainRect, objectGroups, overlaps, scaleBox, type Group,
} from '../../util.ts';
import { MAZE_THEMES } from '../scale.ts';
import { addGroup, blankFace, boxesJ, ceilingSheet, depthFrame, entranceOnMain, facesOf, faceOfOpening, floorSheet, freeSpans, lanes, lift, roomFx, wallSheet } from './common.ts';

const POOL_THEMES = new Set(['PoolCorridor']);
const hasSlope = (g: Group): boolean => g.boxes.some((b) => b.slope);

// ---------------------------------------------------------------- W04・W09・W18 中が広い部屋

/**
 * 中が広い部屋: 扉は普通の大きさなのに、中の天井が 9〜14 m もある（廊下や隣の部屋の天井より、ずっと上まで続いている）。
 * 天井の照明は遥か上、太い柱が並ぶ。割合 anomaly.vast.narrow で、入口のすぐ内側が狭く低い通り口になっていて、
 * 抜けた途端に巨大な空間が開ける（W09 扉の大きさと中の大きさ）。地図には小さな部屋として出る（CellLayout.mapFootprint。W18）
 */
defineAnomaly({
  id: 'vast', name: '中が広い部屋', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], minSize: [4.2, 5],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && g.cell.height <= 4.5,
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h0 = cell.height;
    // 部屋の上の空き: 足跡の重なるほかの区画の床まで
    let H = ctx.rng.float(t['anomaly.vast.heightMin'], Math.max(t['anomaly.vast.heightMin'], t['anomaly.vast.heightMax']));
    for (const g of ctx.world.cells) {
      // 上にある区画（足跡が重なり、床がこの部屋の床より上）
      if (g.cell === cell || g.cell.bounds.min[1] < fy + 0.5) continue;
      if (!g.cell.footprint.some((a) => cell.footprint.some((b) => rectsOverlap(a, b, -0.3)))) continue;
      H = Math.min(H, g.cell.bounds.min[1] - fy - 0.4);
    }
    if (H < h0 + 4) return false;
    const dh = H - h0;
    const top0 = fy + h0;
    const lift1 = (b: Box): void => { b.min = [b.min[0], b.min[1] + dh, b.min[2]]; b.max = [b.max[0], b.max[1] + dh, b.max[2]]; };
    for (const b of cell.boxes) {
      if (isCeilingSlab(cell, b)) { lift1(b); continue; }
      if (b.solid) continue;
      const thin = b.max[0] - b.min[0] < 0.06 && b.max[2] - b.min[2] < 0.06;
      // 天井の照明・天井に付いた物は上へ。天井から吊る細い棒は伸ばす
      if (b.min[1] > top0 - 0.6 && b.max[1] <= top0 + 0.01) lift1(b);
      else if (thin && Math.abs(b.max[1] - top0) < 0.02) b.max = [b.max[0], b.max[1] + dh, b.max[2]];
    }
    // 壁を上へ継ぎ足す（足跡の外周の壁の帯）
    const W: Box[] = [];
    for (const s of wallSpans(cell.footprint)) {
      const e = s.edge;
      const lo = e.dir === 0 || e.dir === 1 ? e.coord - WALL_T : e.coord, hi = lo + WALL_T;
      W.push(e.dir === 0 || e.dir === 2 ? box([s.a0, top0, lo], [s.a1, fy + H, hi], cell.palette.wall) : box([lo, top0, s.a0], [hi, fy + H, s.a1], cell.palette.wall));
    }
    for (const b of W) ctx.addBox(b);
    cell.height = H;
    cell.bounds = { min: [...cell.bounds.min], max: [cell.bounds.max[0], fy + H + 0.2, cell.bounds.max[2]] };
    cell.lights = cell.lights.map((l) => ({ ...l, pos: [l.pos[0], l.pos[1] + dh, l.pos[2]], distance: Math.max(l.distance, H * 1.7), intensity: l.intensity * 1.5 }));
    // 太い柱（天井まで）
    const doors = doorFronts(cell, ctx.geo.openings, 1.8, 0.6);
    const ways = lanes(ctx, 1.6, 1.2);
    const r = mainRect(cell);
    const sp = t['anomaly.vast.pillarSpacing'];
    const nx = Math.floor((r.x1 - r.x0 - 1.6) / sp), nz = Math.floor((r.z1 - r.z0 - 1.6) / sp);
    let pillars = 0;
    for (let i = 1; i <= nx; i++) for (let k = 1; k <= nz; k++) {
      const x = r.x0 + (r.x1 - r.x0) * (i / (nx + 1)), z = r.z0 + (r.z1 - r.z0) * (k / (nz + 1));
      const p = box([x - 0.35, fy, z - 0.35], [x + 0.35, fy + H, z + 0.35], 'columnConcrete', true);
      if (hitsAny(doors, p) || hitsAny(ways, p) || interiorSolids(cell).some((s) => overlaps(s, p, 0.15))) continue;
      ctx.addBox(p);
      if (!ctx.reachOk()) { ctx.removeBoxes((b) => b === p); continue; }
      pillars++;
    }
    // 狭く低い通り口（W09）: 入口のすぐ内側に幅 1.7 m・高さ 1.95 m・奥行き 1.8 m の通り口
    let narrow = false;
    const f = faceOfOpening(ctx, ctx.entrance);
    if (f && ctx.rng.chance(t['anomaly.vast.narrow'])) {
      const at = along(ctx.entrance.dir, ctx.entrance.pos[0], ctx.entrance.pos[2]);
      const half = 0.86, deep = 1.8, wall = 0.14;
      const P = [wallSheet(f, at - half - wall, at - half, fy, top0, cell.palette.wall, 0, deep), wallSheet(f, at + half, at + half + wall, fy, top0, cell.palette.wall, 0, deep)];
      for (const b of P) b.solid = true;
      // 天井（当たらない）と、通り口の上の壁（元の天井の高さまで）
      const roof = wallSheet(f, at - half, at + half, fy + 1.95, top0, cell.palette.wall, 0, deep);
      const lamp = wallSheet(f, at - 0.25, at + 0.25, fy + 1.93, fy + 1.95, 'lightWarm', deep * 0.4, deep * 0.6);
      const ok = at - half - wall > f.a0 + 0.05 && at + half + wall < f.a1 - 0.05;
      if (ok) {
        // 通り口に掛かる家具はどける
        const zone = bbOf([...P, roof]);
        const hit = new Set(objectGroups(ctx.furniture, cell).filter((g) => g.boxes.some((b) => overlaps(b, zone, 0.2))).flatMap((g) => g.boxes));
        ctx.removeBoxes((b) => hit.has(b));
        addGroup(ctx, [...P, roof, lamp], 'narrowEntry');
        if (ctx.reachOk()) narrow = true;
        else { const set = new Set([...P, roof, lamp]); ctx.removeBoxes((b) => set.has(b)); }
      }
    }
    // 地図の見かけ: 主の矩形を真ん中に向けて縮めた小部屋（W18）
    const k = t['anomaly.vast.mapScale'];
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    cell.mapFootprint = [{ x0: cx - ((r.x1 - r.x0) * k) / 2, x1: cx + ((r.x1 - r.x0) * k) / 2, z0: cz - ((r.z1 - r.z0) * k) / 2, z1: cz + ((r.z1 - r.z0) * k) / 2 }];
    cell.render = { ...cell.render, fog: { color: mixFog(cell.palette.fog), near: 6, far: Math.max(30, H * 3) } };
    cell.audioPreset = '巨大反響・低い空調';
    ctx.memo.height = H;
    ctx.memo.narrow = narrow;
    ctx.memo.pillars = pillars;
    return true;
  },
});

const mixFog = (c: number): number => c || 0x0b0d14;

// ---------------------------------------------------------------- W16 鏡の部屋

/**
 * 鏡の部屋: 部屋の真ん中に大きな鏡の枠。向こうに映っているのは、こちらの半分をそのまま鏡写しにした部屋（扉の位置まで同じ）。
 * でも鏡の中に自分が映らない ―― 影のような人影が、こちらと鏡写しに動いている。枠をくぐると鏡の中の部屋に入れる
 * （扉は開かない飾り）。向こうへ入ると、人影はこちら側に現れる
 */
defineAnomaly({
  id: 'mirror', name: '鏡の部屋', weight: 0.7, intensity: 1, kinds: ['room', 'hall'], minSize: [3.6, 4.6], minHeight: 2.4,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? ''),
  pre(ctx) {
    // 鏡の面を決め、鏡の向こうの半分には区画の中身を置かせない（こちらの半分の中身を、後で鏡写しにする）
    const cell = ctx.cell, fy = cell.floorY;
    const r = mainRect(cell);
    const ops = ctx.geo.openings;
    const e = ctx.entrance.pos;
    // 入口から奥を向いたときに正面に鏡が来る向きを先に
    const first: 'x' | 'z' = ctx.entrance.dir % 2 === 0 ? 'z' : 'x';
    for (const axis of [first, first === 'x' ? 'z' : 'x'] as const) {
      const lo = axis === 'x' ? r.x0 : r.z0, hi = axis === 'x' ? r.x1 : r.z1;
      for (const f of [0.5, 0.45, 0.55, 0.4, 0.6]) {
        const at = lo + (hi - lo) * f;
        if (at - lo < 2.0 || hi - at < 2.0) continue;
        const side = Math.sign((axis === 'x' ? e[0] : e[2]) - at) || 1;
        // 鏡の面をまたぐ壁の開口は、面から開口の幅の半分 + 0.6 m 以上離れている（鏡の枠が開口に掛からない）。入口はこちら側
        const ok = ops.every((o) => {
          const c = axis === 'x' ? o.pos[0] : o.pos[2];
          const across = (axis === 'x' ? o.dir % 2 === 0 : o.dir % 2 === 1);
          return !across || Math.abs(c - at) > o.width / 2 + 0.6;
        }) && Math.abs((axis === 'x' ? e[0] : e[2]) - at) > 1.2;
        if (!ok) continue;
        ctx.memo.plane = { axis, at, side };
        // 鏡の向こうの半分（こちらの半分の鏡写しが入る範囲だけ）
        const span = Math.min(at - lo, hi - at);
        const a0 = side > 0 ? at - span : at, a1 = side > 0 ? at : at + span;
        ctx.keepOut(axis === 'x' ? { min: [a0 - 0.1, fy - 0.1, r.z0], max: [a1 + 0.1, fy + cell.height, r.z1] } : { min: [r.x0, fy - 0.1, a0 - 0.1], max: [r.x1, fy + cell.height, a1 + 0.1] });
        return;
      }
    }
    return false;
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const r = mainRect(cell);
    const ops = ctx.geo.openings;
    const pl = ctx.memo.plane as { axis: 'x' | 'z'; at: number; side: number } | undefined;
    if (!pl) return false;
    const { axis, at, side } = pl;
    const k = axis === 'x' ? 0 : 2;
    const onReal = (b: { min: number[]; max: number[] }): boolean => side < 0 ? b.max[k]! < at - 0.05 : b.min[k]! > at + 0.05;
    const groups = objectGroups(ctx.furniture, cell).filter((g) => !hasSlope(g));
    const decor = groupsOf(ctx.furniture).filter((g) => !g.solid && g.boxes.every((b) => b.propGroup) && isWallDecor(g, cell) && !g.boxes.some((b) => b.slope));
    // 鏡の向こうの家具・飾りは片付け、こちら側の物を鏡写しにして置く
    const away = new Set([...groups, ...decor].filter((g) => !onReal(bbOf(g.boxes))).flatMap((g) => g.boxes));
    ctx.removeBoxes((b) => away.has(b));
    const real = [...groups, ...decor].filter((g) => onReal(bbOf(g.boxes)));
    const reflect = (b: Box): Box => {
      const c: Box = { ...b, min: [...b.min], max: [...b.max] };
      c.min[k] = 2 * at - b.max[k]!;
      c.max[k] = 2 * at - b.min[k]!;
      c.propGroup = `${b.propGroup}~m`;
      return c;
    };
    const fixed = interiorSolids(cell);
    const doorZ = doorFronts(cell, ops, 1.5, 0.4);
    let copied = 0;
    const inRoom = (b: Box): boolean => ctx.rects.some((q) => b.min[0] >= q.x0 - 1e-6 && b.max[0] <= q.x1 + 1e-6 && b.min[2] >= q.z0 - 1e-6 && b.max[2] <= q.z1 + 1e-6);
    for (const g of real) {
      const copy = g.boxes.map(reflect);
      // 壁際の物の鏡写しが壁に少しめり込むなら内へ寄せる。それでも部屋の外に出る物（鏡から遠い物）は写さない
      const cb = bbOf(copy);
      const q = ctx.rects.find((x) => (cb.min[0] + cb.max[0]) / 2 > x.x0 && (cb.min[0] + cb.max[0]) / 2 < x.x1 && (cb.min[2] + cb.max[2]) / 2 > x.z0 && (cb.min[2] + cb.max[2]) / 2 < x.z1);
      if (q) {
        const lo = k === 0 ? q.x0 : q.z0, hi = k === 0 ? q.x1 : q.z1;
        const d = cb.min[k]! < lo ? lo - cb.min[k]! : cb.max[k]! > hi ? hi - cb.max[k]! : 0;
        if (Math.abs(d) < 0.15) for (const b of copy) { b.min[k] = b.min[k]! + d; b.max[k] = b.max[k]! + d; }
      }
      if (!copy.every(inRoom) || copy.some((b) => b.solid && (fixed.some((o) => overlaps(o, b, 0.02)) || hitsAny(doorZ, b)))) continue;
      for (const b of copy) ctx.addBox(b);
      if (!ctx.reachOk()) { const set = new Set(copy); ctx.removeBoxes((b) => set.has(b)); continue; }
      copied++;
    }
    if (copied < 1) return false;
    // 開口の鏡写しの位置に、開かない扉
    const B: Box[] = [];
    for (const o of ops) {
      const md = (axis === 'x' ? (o.dir === 1 || o.dir === 3 ? (o.dir + 2) % 4 : o.dir) : (o.dir === 0 || o.dir === 2 ? (o.dir + 2) % 4 : o.dir)) as Dir;
      const mx = axis === 'x' ? 2 * at - o.pos[0] : o.pos[0], mz = axis === 'z' ? 2 * at - o.pos[2] : o.pos[2];
      const f = facesOf(ctx).find((x) => x.dir === md && Math.abs(x.coord - (md === 0 || md === 2 ? (md === 0 ? r.z1 : r.z0) : (md === 1 ? r.x1 : r.x0))) < 0.05);
      if (!f) continue;
      const a = md === 0 || md === 2 ? mx : mz;
      if (a - 0.6 < f.a0 + WALL_T || a + 0.6 > f.a1 - WALL_T) continue;
      // 鏡写しの位置に本物の開口があれば（左右対称の部屋）、扉は要らない
      if (ops.some((q) => q.dir === md && Math.abs(along(q.dir, q.pos[0], q.pos[2]) - a) < (q.width + 0.9) / 2 + 0.2)) continue;
      const D: Box[] = [];
      decorDoor(D, f, a, cell.palette.door, Math.min(o.width, 1.2) - 0.1, Math.min(2.05, o.height - 0.05));
      B.push(...lift(D, fy));
    }
    // 鏡の枠（柱・梁・床の縁）と、ほとんど透明な面
    const span = axis === 'x' ? [r.z0 + WALL_T, r.z1 - WALL_T] : [r.x0 + WALL_T, r.x1 - WALL_T];
    const frame = (a0: number, a1: number, y0: number, y1: number, d: number, mat: MatId): Box => (axis === 'x' ? box([at - d, y0, a0], [at + d, y1, a1], mat, false) : box([a0, y0, at - d], [a1, y1, at + d], mat, false));
    B.push(frame(span[0]!, span[0]! + 0.12, fy, fy + h, 0.06, 'goldTrim'), frame(span[1]! - 0.12, span[1]!, fy, fy + h, 0.06, 'goldTrim'));
    B.push(frame(span[0]!, span[1]!, fy + h - 0.14, fy + h, 0.06, 'goldTrim'), frame(span[0]!, span[1]!, fy, fy + 0.02, 0.06, 'goldTrim'));
    B.push(frame(span[0]! + 0.12, span[1]! - 0.12, fy + 0.02, fy + h - 0.14, 0.004, 'glass'));
    addGroup(ctx, B, 'mirror');
    roomFx(ctx, { kind: 'figure', axis, at, floorY: fy });
    ctx.memo.plane = { axis, at };
    return true;
  },
});

// ---------------------------------------------------------------- W17 横倒しの部屋

/**
 * 横倒しの部屋: 部屋が横に倒れている。開口の無い壁の 1 枚が床（絨毯・床材）で、家具はその壁から横向きに生えている。
 * 向かいの壁が天井（照明のパネルが縦に並んで光る）。本当の床と天井は壁紙で、壁の飾り（掲示・時計・窓）は床に寝ている。
 * 重力はそのまま（開口は普通に通れる）
 */
defineAnomaly({
  id: 'sideways', name: '横倒しの部屋', weight: 0.6, intensity: 2, kinds: ['room', 'hall'], needsFurniture: true, minSize: [3.6, 4.2], minHeight: 2.4,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const pal = cell.palette;
    const faces = facesOf(ctx).filter((f) => blankFace(ctx, f) && f.a1 - f.a0 > 3);
    const W = faces.sort((a, b) => b.a1 - b.a0 - (a.a1 - a.a0))[0];
    if (!W) return false;
    const opp = facesOf(ctx).filter((f) => f.dir === (W.dir + 2) % 4).sort((a, b) => b.a1 - b.a0 - (a.a1 - a.a0))[0];
    const depth = opp ? Math.abs(opp.face - W.face) : 4;
    const kAxis = W.horizontal ? 2 : 0;
    // 家具: 床からの高さ → 壁 W からの出、壁 W からの距離 → 高さ（部屋の高さに収まるよう縮める）
    const groups = objectGroups(ctx.furniture, cell).filter((g) => !hasSlope(g) && !isWallDecor(g, cell));
    const mine = boxSet(groups);
    ctx.removeBoxes((b) => mine.has(b));
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
    let kept = 0;
    for (const g of groups) {
      const bb = bbOf(g.boxes);
      const H = bb.max[1] - fy;
      const dist0 = Math.min(Math.abs(bb.min[kAxis]! - W.face), Math.abs(bb.max[kAxis]! - W.face));
      const thick = bb.max[kAxis]! - bb.min[kAxis]!;
      if (H > 1.35 || thick > h - 0.3) continue;
      // 新しい高さの中心: 壁からの距離を部屋の高さへ写す
      const yc = fy + 0.15 + thick / 2 + Math.min(1, dist0 / Math.max(1, depth)) * (h - 0.3 - thick);
      const vc = (Math.abs(bb.min[kAxis]! - W.face) + Math.abs(bb.max[kAxis]! - W.face)) / 2;
      const boxes = g.boxes.map((b) => {
        const u0 = b.min[1] - fy, u1 = b.max[1] - fy;
        const v0 = Math.abs(b.min[kAxis]! - W.face), v1 = Math.abs(b.max[kAxis]! - W.face);
        const n0 = W.face + W.inward * u0, n1 = W.face + W.inward * u1;
        const y0 = yc + (Math.min(v0, v1) - vc), y1 = yc + (Math.max(v0, v1) - vc);
        const c: Box = { ...b, min: [...b.min], max: [...b.max] };
        c.min[kAxis] = Math.min(n0, n1); c.max[kAxis] = Math.max(n0, n1);
        c.min[1] = y0; c.max[1] = y1;
        return c;
      });
      const nb = bbOf(boxes);
      if (nb.min[1] < fy || nb.max[1] > fy + h - 0.05) continue;
      if (boxes.some((b) => b.solid && (hitsAny(doors, b) || interiorSolids(cell).some((o) => overlaps(o, b, 0.02))))) continue;
      for (const b of boxes) ctx.addBox(b);
      if (!ctx.reachOk()) { const set = new Set(boxes); ctx.removeBoxes((b) => set.has(b)); continue; }
      kept++;
    }
    if (kept < 2) return false;
    // 壁の飾りは床に寝ている（壁の前の床に、高さを壁からの距離にして）
    for (const g of groupsOf(ctx.furniture).filter((x) => !x.solid && isWallDecor(x, cell))) {
      const f = facesOf(ctx).find((x) => g.boxes.every((b) => Math.abs((x.horizontal ? (b.min[2] + b.max[2]) / 2 : (b.min[0] + b.max[0]) / 2) - x.face) < 0.3));
      if (!f || f === W) continue;
      const ka = f.horizontal ? 2 : 0;
      for (const b of g.boxes) {
        const u0 = (b.min[1] - fy) * 0.55, u1 = (b.max[1] - fy) * 0.55, d = Math.abs((b.min[ka]! + b.max[ka]!) / 2 - f.face);
        const n0 = f.face + f.inward * u0, n1 = f.face + f.inward * u1;
        b.min[ka] = Math.min(n0, n1); b.max[ka] = Math.max(n0, n1);
        b.min[1] = fy + 0.003 + d * 0.2; b.max[1] = fy + 0.006 + d * 0.25;
      }
    }
    // 床と天井は壁紙、壁 W は床材、向かいの壁は天井（照明のパネルが縦に光る）
    const Sh: Box[] = [];
    for (const r of ctx.rects) Sh.push(floorSheet(r, fy, pal.wall, 0.006), ceilingSheet(r, fy + h, pal.wall));
    for (const [p, q] of freeSpans(ctx, W, 0, 0, 0.2)) Sh.push(wallSheet(W, p, q, fy, fy + h, pal.floor, 0.004, 0.012));
    const panels = cell.boxes.filter((b) => isCeilingPanel(cell, b));
    ctx.removeBoxes((b) => panels.includes(b));
    if (opp) {
      for (const [p, q] of freeSpans(ctx, opp, 0.15, 0, 0.3)) {
        Sh.push(wallSheet(opp, p, q, fy, fy + h, pal.ceiling, 0.004, 0.012));
        for (let a = p + 0.6; a + 0.6 < q; a += 2.2) Sh.push(wallSheet(opp, a - 0.3, a + 0.3, fy + h / 2 - 0.6, fy + h / 2 + 0.6, pal.light, 0.012, 0.05));
      }
      cell.lights = cell.lights.map((l) => {
        const [x, z] = opp.horizontal ? [l.pos[0], opp.face + opp.inward * 0.5] : [opp.face + opp.inward * 0.5, l.pos[2]];
        return { ...l, pos: [x, fy + h / 2, z] };
      });
    }
    addGroup(ctx, Sh, 'sideways');
    ctx.memo.wall = W.dir;
    return true;
  },
});

// ---------------------------------------------------------------- W15 遠近法の錯覚

type ChairFn = (B: Box[], x: number, z: number, facing: Dir) => void;
function seatFor(theme: string): ChairFn {
  if (/Office|DynamicGrid|LargeRoom/.test(theme)) return (B, x, z, f) => officeChair(B, x, z, f);
  if (/Classroom|School/.test(theme)) return (B, x, z, f) => { schoolDesk(B, x, z, f); schoolChair(B, x + (f === 1 ? -0.42 : f === 3 ? 0.42 : 0), z + (f === 0 ? -0.42 : f === 2 ? 0.42 : 0), f); };
  if (/Theater|Entertainment/.test(theme)) return (B, x, z, f) => chair(B, x, z, f, 'seatRed');
  return (B, x, z, f) => chair(B, x, z, f, 'seatBlue');
}

/**
 * 遠近法の錯覚: 入口から奥へ、家具の列・天井の照明・床の絨毯・腰壁が少しずつ小さく低くなり、天井も下がっていく。
 * 入口から見ると部屋が何倍も奥深く見える。奥の壁の小さな扉は、遠くからは小さく、近づくにつれて普通の大きさになる（描画 'grow'）。
 * 奥の家具は人形のように小さい
 */
defineAnomaly({
  id: 'perspective', name: '遠近法の錯覚', weight: 0.6, intensity: 1, kinds: ['room', 'hall'], minSize: [3.6, 5.4], minHeight: 2.6,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? ''),
  pre(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    if (!entranceOnMain(ctx)) return false;
    const F = depthFrame(mainRect(cell), ctx.entrance.dir);
    if (F.depth < 5) return false;
    ctx.skipDress();
    const n = t['anomaly.perspective.bands'];
    const sMin = t['anomaly.perspective.minScale'];
    // 帯: 奥ほど短く（等比）
    const ratio = 0.82;
    const total = (1 - ratio ** n) / (1 - ratio);
    const lens = Array.from({ length: n }, (_v, i) => (F.depth * ratio ** i) / total);
    const v: number[] = [0];
    for (const l of lens) v.push(v[v.length - 1]! + l);
    const sc = (i: number): number => 1 - (1 - sMin) * (i / (n - 1));
    const uc = along(ctx.entrance.dir, ctx.entrance.pos[0], ctx.entrance.pos[2]);
    const lowest = fy + t['anomaly.perspective.ceilMin'];
    const B: Box[] = [];
    ctx.removeBoxes((b) => isCeilingPanel(cell, b));
    const make = seatFor(cell.theme ?? '');
    const facing = ((ctx.entrance.dir + 2) % 4) as Dir;
    const doors = doorFronts(cell, ctx.geo.openings, 1.4, 0.4);
    for (let i = 0; i < n; i++) {
      const s = sc(i);
      const ceil = fy + h - (fy + h - lowest) * (i / (n - 1));
      // 下がった天井（帯ごとの段）
      if (i > 0) { const q = F.rect(v[i]!, v[i + 1]!); B.push(box([q.x0, ceil, q.z0], [q.x1, fy + h, q.z1], cell.palette.ceiling, true)); }
      // 天井の照明（小さく）
      const vm = (v[i]! + v[i + 1]!) / 2;
      for (const du of [-1.2, 1.2]) {
        const [x, z] = F.point(uc + du * s, vm);
        B.push(box([x - 0.3 * s, ceil - 0.04, z - 0.3 * s], [x + 0.3 * s, ceil - 0.005, z + 0.3 * s], cell.palette.light, false));
      }
      // 絨毯（真ん中の通り道。奥ほど細い）
      const rw = 1.4 * s;
      B.push(floorSheet(F.rect(v[i]!, v[i + 1]!, uc - rw / 2, uc + rw / 2), fy, 'carpetPattern', 0.008));
      for (const du of [-rw / 2 - 0.05, rw / 2]) B.push(floorSheet(F.rect(v[i]!, v[i + 1]!, uc + du, uc + du + 0.05), fy, 'goldTrim', 0.01));
      // 家具の列（絨毯の両側。奥ほど小さく、間隔も詰まる）
      if (i === 0 || i === n - 1) continue;
      for (const sideSign of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const u = uc + sideSign * (rw / 2 + (0.6 + k * 1.0) * s);
          if (u < F.u0 + 0.3 || u > F.u1 - 0.3) continue;
          const [x, z] = F.point(u, vm);
          const P: Box[] = [];
          make(P, x, z, facing);
          for (const b of P) scaleBox(b, s, x, 0, z);
          lift(P, fy);
          const bb = bbOf(P);
          if (bb.max[1] > ceil - 0.05 || hitsAny(doors, bb) || !ctx.rects.some((q) => bb.min[0] > q.x0 + 0.1 && bb.max[0] < q.x1 - 0.1 && bb.min[2] > q.z0 + 0.1 && bb.max[2] < q.z1 - 0.1)) continue;
          for (const b of P) b.propGroup = `${cell.id}/a-row${i}.${sideSign}.${k}`;
          B.push(...P);
        }
      }
    }
    // 腰壁（横の壁。奥ほど低い）
    for (const f of facesOf(ctx)) {
      if (f.dir % 2 === ctx.entrance.dir % 2) continue;
      for (const [p, q] of freeSpans(ctx, f, 0.08, 0, 0.2)) for (let i = 0; i < n; i++) {
        const [x0, z0] = F.point(uc, v[i]!), [x1, z1] = F.point(uc, v[i + 1]!);
        const b0 = f.horizontal ? Math.min(x0, x1) : Math.min(z0, z1), b1 = f.horizontal ? Math.max(x0, x1) : Math.max(z0, z1);
        const a0 = Math.max(p, b0), a1 = Math.min(q, b1);
        if (a1 - a0 > 0.05) B.push(wallSheet(f, a0, a1, fy, fy + 1.0 * sc(i), 'woodPanel', 0.004, 0.02));
      }
    }
    for (const b of B) { b.propGroup ??= `${cell.id}/a-perspective`; ctx.addBox(b); }
    // 奥の壁の小さな扉（近づくと普通の大きさに）
    const far = facesOf(ctx).find((f) => f.dir === (ctx.entrance.dir + 2) % 4 && freeSpans(ctx, f, 0.4).some(([p, q]) => q - p > 1.4));
    if (far) {
      const [p, q] = freeSpans(ctx, far, 0.4).sort((a, b) => Math.abs((a[0] + a[1]) / 2 - uc) - Math.abs((b[0] + b[1]) / 2 - uc))[0]!;
      const at = Math.min(Math.max(uc, p + 0.7), q - 0.7);
      const D: Box[] = [];
      decorDoor(D, far, at, cell.palette.door);
      lift(D, fy);
      const [ax, az] = far.horizontal ? [at, far.face] : [far.face, at];
      roomFx(ctx, { kind: 'grow', boxes: boxesJ(D), anchor: [ax, fy, az], far: t['anomaly.perspective.doorFar'], near: 1.6, from: F.depth, to: 1.6 });
    }
    cell.lights = cell.lights.map((l) => ({ ...l, pos: [l.pos[0], Math.min(l.pos[1], lowest - 0.3), l.pos[2]] }));
    return ctx.reachOk();
  },
});
