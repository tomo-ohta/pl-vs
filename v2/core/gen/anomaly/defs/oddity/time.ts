/**
 * 時間の異変（段階 4・oddity）: 時刻が進む部屋（T02）・古くなる部屋（T08）・去った人の残り（T09）。
 */
import { box, type Box, type Json, type MatId } from '../../../../world/layout.ts';
import { wallClock } from '../../../dress/decor.ts';
import { defineAnomaly } from '../../types.ts';
import { bbOf, doorFronts, hitsAny, interiorSolids, isCeilingPanel, LIGHT_OFF, mainRect, mixColor, objectGroups, overlaps, saveCoords, loadCoords, tipBox, moveBox, type Group } from '../../util.ts';
import { MAZE_THEMES } from '../scale.ts';
import {
  addGroup, aabbJ, blankFace, boxesJ, ceilingSheet, depthFrame, entranceOnMain, facesOf, floorSheet, freeSpans, gridPoints, lift, roomBox, roomFx, tops, wallSheet, type Face,
} from './common.ts';

const kindOf = (g: Group): string => g.boxes.find((b) => b.kind && b.kind !== 'colliderOnly')?.kind ?? '';

// ---------------------------------------------------------------- T02 時刻が進む部屋

/**
 * 時刻が進む部屋: 大きな窓のある部屋。部屋の中にいる間だけ時刻が進み、1 分半ほどで朝 → 昼 → 夕焼け → 夜になる。
 * 窓の空の色・差し込む日の筋・部屋の明るさ（日の光の照明）が移り、日が暮れると天井の照明が点く。壁の時計の針が速く回る。
 * 部屋を出ると時刻は止まり、また入ると続きから
 */
defineAnomaly({
  id: 'dayCycle', name: '時刻が進む部屋', weight: 0.7, intensity: 0, kinds: ['room', 'hall'], minSize: [3.4, 4], minHeight: 2.4,
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const y0 = fy + 0.9, y1 = fy + Math.min(h - 0.35, 2.35);
    // 窓: 開口の無い壁を優先して 1〜2 面、1 面に 1〜2 枚
    const faces = facesOf(ctx).filter((f) => freeSpans(ctx, f, 0.5).some(([p, q]) => q - p >= 1.6)).sort((a, b) => Number(blankFace(ctx, b)) - Number(blankFace(ctx, a)) || b.a1 - b.a0 - (a.a1 - a.a0));
    const solids = interiorSolids(cell);
    const panes: { min: number[]; max: number[]; dir: number; f: Face }[] = [];
    const F: Box[] = [];
    for (const f of faces.slice(0, 2)) for (const [p, q] of freeSpans(ctx, f, 0.5)) {
      if (q - p < 1.6) continue;
      const n = q - p > 4.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const c = p + ((q - p) * (i + 0.5)) / n, w = Math.min(2.8, (q - p) / n - 0.5);
        const a0 = c - w / 2, a1 = c + w / 2;
        // 窓の前に背の高い家具があれば避ける
        const probe = wallSheet(f, a0, a1, y0, y1, 'void', 0, 0.3);
        if (solids.some((s) => overlaps(s, probe, 0.02))) continue;
        const pane = wallSheet(f, a0, a1, y0, y1, 'void', 0.006, 0.006);
        panes.push({ min: [...pane.min], max: [...pane.max], dir: f.dir, f });
        // 枠・窓台・方立て（当たらない）
        F.push(wallSheet(f, a0 - 0.05, a1 + 0.05, y0 - 0.05, y0, 'trim', 0, 0.1), wallSheet(f, a0 - 0.05, a1 + 0.05, y1, y1 + 0.05, 'trim', 0, 0.05));
        F.push(wallSheet(f, a0 - 0.05, a0, y0, y1, 'trim', 0, 0.05), wallSheet(f, a1, a1 + 0.05, y0, y1, 'trim', 0, 0.05));
        for (let k = 1; k < Math.round(w / 0.9); k++) { const a = a0 + (w * k) / Math.round(w / 0.9); F.push(wallSheet(f, a - 0.02, a + 0.02, y0, y1, 'trim', 0, 0.04)); }
        F.push(wallSheet(f, a0, a1, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, 'trim', 0, 0.04));
      }
    }
    // 窓を付けられる壁が無ければ、天井の天窓（下を向く窓。dir -1）
    if (!panes.length) {
      const r = mainRect(cell);
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, top = fy + h;
      const w = Math.min(2.2, r.x1 - r.x0 - 1.6), d = Math.min(1.6, r.z1 - r.z0 - 1.6);
      if (w < 0.8 || d < 0.8) return false;
      ctx.removeBoxes((b) => isCeilingPanel(cell, b) && (b.min[0] + b.max[0]) / 2 > cx - w / 2 - 0.4 && (b.min[0] + b.max[0]) / 2 < cx + w / 2 + 0.4 && (b.min[2] + b.max[2]) / 2 > cz - d / 2 - 0.4 && (b.min[2] + b.max[2]) / 2 < cz + d / 2 + 0.4);
      panes.push({ min: [cx - w / 2, top - 0.012, cz - d / 2], max: [cx + w / 2, top - 0.012, cz + d / 2], dir: -1, f: null as unknown as Face });
      F.push(box([cx - w / 2 - 0.08, top - 0.03, cz - d / 2 - 0.08], [cx + w / 2 + 0.08, top - 0.005, cz - d / 2], 'trim', false), box([cx - w / 2 - 0.08, top - 0.03, cz + d / 2], [cx + w / 2 + 0.08, top - 0.005, cz + d / 2 + 0.08], 'trim', false));
      F.push(box([cx - w / 2 - 0.08, top - 0.03, cz - d / 2], [cx - w / 2, top - 0.005, cz + d / 2], 'trim', false), box([cx + w / 2, top - 0.03, cz - d / 2], [cx + w / 2 + 0.08, top - 0.005, cz + d / 2], 'trim', false));
    }
    addGroup(ctx, F, 'windows');
    const clock = ctx.addEntity('clock', { type: 'oddClock', params: { aabb: aabbJ(roomBox(ctx)), rects: ctx.rects.map((r) => ({ ...r })), daySec: t['anomaly.dayCycle.daySec'], startPhase: 0.02, panes: panes.map((p) => ({ min: p.min, max: p.max, dir: p.dir })) } });
    const night = ctx.addEntity('night', { type: 'oddLevel', params: {}, inputs: { in: `${clock}.night` } });
    // 夜の灯り: 天井の照明と点光源（夜に点く）。日の光: 窓の前の点光源（昼に明るい）
    for (const b of cell.boxes) if (isCeilingPanel(cell, b)) b.kind = `lamp:${night}`;
    for (const l of cell.lights) l.lampId = night;
    for (const p of panes) {
      const cx = (p.min[0]! + p.max[0]!) / 2, cz = (p.min[2]! + p.max[2]!) / 2, f = p.f;
      const pos: [number, number, number] = p.dir < 0 ? [cx, fy + h - 0.8, cz] : [cx + (f.horizontal ? 0 : f.inward * 1.1), fy + 1.7, cz + (f.horizontal ? f.inward * 1.1 : 0)];
      cell.lights.push({ pos, color: 0xfff0d8, intensity: 0.9, distance: 7, lampId: clock });
    }
    // 速く回る時計の針（描画で回す）
    const cf = facesOf(ctx).filter((f) => !panes.some((p) => p.f === f)).map((f) => ({ f, s: freeSpans(ctx, f, 0.6).find(([p, q]) => q - p > 0.8) })).find((x) => x.s);
    if (cf?.s) {
      const at = (cf.s[0] + cf.s[1]) / 2, y = fy + Math.min(h - 0.5, 2.1);
      const C: Box[] = [];
      wallClock(C, cf.f, at, 0, 0.42);
      // 文字盤と縁だけ残す（針は回す）
      const face = lift(C.slice(0, 2), y);
      addGroup(ctx, face, 'dayClock');
      const n = cf.f.face + cf.f.inward * 0.045;
      const [cx, cz] = cf.f.horizontal ? [at, n] : [n, at];
      const hand = (len: number, w: number): Box => (cf.f.horizontal ? box([cx - w / 2, y, cz - 0.004], [cx + w / 2, y + len, cz + 0.004], 'metalDark', false) : box([cx - 0.004, y, cz - w / 2], [cx + 0.004, y + len, cz + w / 2], 'metalDark', false));
      const axis = cf.f.horizontal ? 'z' : 'x';
      const day = t['anomaly.dayCycle.daySec'];
      roomFx(ctx,
        { kind: 'spin', boxes: boxesJ([hand(0.17, 0.016)]), center: [cx, y, cz], axis, speed: -(Math.PI * 4) / day },
        { kind: 'spin', boxes: boxesJ([hand(0.19, 0.01)]), center: [cx, y, cz], axis, speed: -(Math.PI * 48) / day },
      );
    }
    cell.audioPreset = '微かな時計・微風';
    return true;
  },
});

// ---------------------------------------------------------------- T08 古くなる部屋

/** 年代の帯の見た目（0 = 新しい … 3 = 廃墟） */
const AGE = [
  { wall: null as MatId | null, floor: null as MatId | null, light: 'lightPanel' as MatId, mul: 1 },
  { wall: 'wallCream' as MatId, floor: null, light: 'lightYellow' as MatId, mul: 0.8 },
  { wall: 'wallBeige' as MatId, floor: 'floorConcrete' as MatId, light: 'lightYellow' as MatId, mul: 0.5 },
  { wall: 'wallConcrete' as MatId, floor: 'floorConcrete' as MatId, light: 'lightOff' as MatId, mul: 0.15 },
];

/**
 * 古くなる部屋: 入口のあたりは新しいのに、奥へ進むほど年代が古くなる。壁紙は黄ばみ、染みが広がり、奥では漆喰が剥がれて煉瓦が見える。
 * 照明は黄ばんで暗くなり、いちばん奥は切れている。家具は奥ほど倒れ、埃をかぶり、隅には蜘蛛の巣。空気に埃が舞い、画面の色も奥ほど褪せる
 */
defineAnomaly({
  id: 'aging', name: '古くなる部屋', weight: 0.8, intensity: 0, kinds: ['room', 'hall'], minSize: [3.4, 6], minHeight: 2.3,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    if (!entranceOnMain(ctx)) return false;
    const D = depthFrame(mainRect(cell), ctx.entrance.dir);
    if (D.depth < 5.5) return false;
    const n = AGE.length;
    const bandOf = (x: number, z: number): number => Math.max(0, Math.min(n - 1, Math.floor((D.v(x, z) / D.depth) * n)));
    const B: Box[] = [];
    // 壁: 帯ごとに上張り（横の壁は帯の範囲、奥の壁はいちばん古い帯）
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.06, 0, 0.1)) {
      for (let a = p; a < q - 0.01;) {
        const [x, z] = f.horizontal ? [a + 0.01, f.face] : [f.face, a + 0.01];
        const k = bandOf(x, z);
        // 同じ帯が続く所まで
        let b = a + 0.25;
        while (b < q && bandOf(f.horizontal ? b : f.face, f.horizontal ? f.face : b) === k) b += 0.25;
        b = Math.min(q, b);
        const age = AGE[k]!;
        if (age.wall) B.push(wallSheet(f, a, b, fy, fy + h, age.wall, 0.004, 0.01));
        if (k >= 2) for (let s = a; s < b - 0.3; s += ctx.rng.float(0.5, 1.2)) if (ctx.rng.chance(0.5)) { const w = ctx.rng.float(0.25, 0.7), y = ctx.rng.float(0.2, h - 0.8); B.push(wallSheet(f, s, Math.min(b, s + w), fy + y, fy + y + ctx.rng.float(0.3, 0.8), 'shadowDecal', 0.01, 0.014)); }
        if (k === 3) for (let s = a; s < b - 0.4; s += ctx.rng.float(0.8, 1.6)) { const w = ctx.rng.float(0.4, 0.9), y = ctx.rng.float(0.4, h - 1.2); B.push(wallSheet(f, s, Math.min(b, s + w), fy + y, fy + y + ctx.rng.float(0.4, 0.9), 'wallBrick', 0.01, 0.016)); }
        a = b;
      }
    }
    // 床と天井
    for (let k = 1; k < n; k++) {
      const r = D.rect((D.depth * k) / n, (D.depth * (k + 1)) / n);
      const age = AGE[k]!;
      if (age.floor) B.push(floorSheet(r, fy, age.floor, 0.006));
      if (k >= 2) B.push(ceilingSheet(r, fy + h, 'ceilingDark', 0.006));
      if (k === 3) {
        for (let i = 0; i < 6; i++) {
          const x = ctx.rng.float(r.x0 + 0.3, r.x1 - 0.3), z = ctx.rng.float(r.z0 + 0.3, r.z1 - 0.3), s = ctx.rng.float(0.4, 0.9);
          B.push(box([x - s / 2, fy + 0.007, z - s / 2], [x + s / 2, fy + 0.012, z + s / 2], 'plantSoil', false));
          // 天井の剥がれと垂れた配線
          B.push(ceilingSheet({ x0: x - s / 3, z0: z - s / 3, x1: x + s / 3, z1: z + s / 3 }, fy + h - 0.001, 'void', 0.004));
          if (ctx.rng.chance(0.5)) B.push(box([x - 0.006, fy + h - ctx.rng.float(0.4, 0.9), z - 0.006], [x + 0.006, fy + h, z + 0.006], 'metalDark', false));
        }
      }
    }
    // 照明: 帯ごとに黄ばみ・暗くなり・切れる
    for (const b of cell.boxes) {
      if (!isCeilingPanel(cell, b) || !LIGHT_OFF[b.mat]) continue;
      const k = bandOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
      b.mat = AGE[k]!.light;
    }
    cell.lights = cell.lights.filter((l) => bandOf(l.pos[0], l.pos[2]) < n - 1).map((l) => {
      const k = bandOf(l.pos[0], l.pos[2]);
      return { ...l, intensity: l.intensity * AGE[k]!.mul, color: mixColor(l.color, 0xffd890, k / (n - 1)) };
    });
    // 家具: 古い帯ほど倒れ、天板に埃
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
    for (const g of objectGroups(ctx.furniture, cell)) {
      const bb = bbOf(g.boxes);
      const k = bandOf((bb.min[0] + bb.max[0]) / 2, (bb.min[2] + bb.max[2]) / 2);
      if (k < 2 || g.boxes.some((b) => b.slope) || !ctx.rng.chance(k === 3 ? 0.7 : 0.35) || bb.max[1] - fy > 2.2) continue;
      const saved = saveCoords(g.boxes);
      const axis = ctx.rng.chance(0.5) ? 'x' : 'z', sign = ctx.rng.chance(0.5) ? 1 : -1;
      const kk = axis === 'x' ? 0 : 2;
      for (const b of g.boxes) tipBox(b, axis, sign as 1 | -1, sign > 0 ? bb.max[kk]! : bb.min[kk]!, fy);
      const nb = bbOf(g.boxes);
      for (const b of g.boxes) moveBox(b, 0, fy - nb.min[1], 0);
      const others = interiorSolids(cell, new Set(g.boxes));
      const fitsRoom = ctx.rects.some((r) => bbOf(g.boxes).min[0] >= r.x0 && bbOf(g.boxes).max[0] <= r.x1 && bbOf(g.boxes).min[2] >= r.z0 && bbOf(g.boxes).max[2] <= r.z1);
      if (!fitsRoom || g.boxes.some((b) => b.solid && (hitsAny(doors, b) || others.some((o) => overlaps(o, b, 0.02)))) || !ctx.reachOk()) loadCoords(g.boxes, saved);
    }
    for (const b of tops(ctx.furniture, fy, 0.2, 2.3, 0.04)) {
      const k = bandOf((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
      if (k >= 2) B.push(box([b.min[0], b.max[1], b.min[2]], [b.max[0], b.max[1] + 0.004, b.max[2]], 'wallConcrete', false));
    }
    // 蜘蛛の巣（奥の天井の隅）
    const far = D.rect(D.depth * 0.75, D.depth);
    for (const [x, z] of [[far.x0, far.z0], [far.x1, far.z0], [far.x0, far.z1], [far.x1, far.z1]] as const) {
      const sx = x === far.x0 ? 1 : -1, sz = z === far.z0 ? 1 : -1;
      const web = box([Math.min(x, x + sx * 0.5), fy + h - 0.5, Math.min(z, z + sz * 0.012)], [Math.max(x, x + sx * 0.5), fy + h - 0.49, Math.max(z, z + sz * 0.012)], 'whiteFabric', false);
      web.slope = { axis: 'x', rise: sx > 0 ? 0.45 : -0.45 };
      if (sx < 0) { web.min[1] += 0.45; web.max[1] += 0.45; }
      B.push(web);
    }
    addGroup(ctx, B, 'aging');
    const v0 = D.point((D.u0 + D.u1) / 2, 0), v1 = D.point((D.u0 + D.u1) / 2, D.depth);
    const old = D.rect(D.depth * 0.45, D.depth);
    roomFx(ctx,
      { kind: 'dust', aabb: aabbJ({ min: [old.x0, fy + 0.2, old.z0], max: [old.x1, fy + h - 0.1, old.z1] }), count: 220, color: 0xd8cbb0 },
      { kind: 'gradient', from: [v0[0], v0[1]], to: [v1[0], v1[1]], a: {}, b: { saturation: 0.42, tint: [1.08, 1.0, 0.82], vignette: 0.35, contrast: 0.92 } },
    );
    cell.audioPreset = '蛍光灯・遠い時計';
    return true;
  },
});

// ---------------------------------------------------------------- T09 去った人の残り

/**
 * 去った人の残り: 誰もいないのに、ついさっきまで誰かがいた。机の上には湯気の立つコーヒー・食べかけの皿・点いたままの画面、
 * 椅子がまだゆっくり回っていて、卓上の扇風機が回る。部屋にいる間、どこかで電話が鳴り続ける
 */
defineAnomaly({
  id: 'justLeft', name: '去った人の残り', weight: 0.8, intensity: 0, kinds: ['room', 'hall'], needsFurniture: true, minSize: [3, 3.6],
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const T = ctx.rng.shuffle(tops(ctx.furniture, fy, 0.4, 1.2, 0.15).filter((b) => b.solid && b.max[0] - b.min[0] > 0.4 && b.max[2] - b.min[2] > 0.3));
    if (T.length < 1) {
      // 机の無い部屋: 小さな卓を 1 つ（通り道を塞がない所）
      const solids = interiorSolids(cell);
      const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
      for (const [x, z] of ctx.rng.shuffle(gridPoints(ctx, 0.6, 0.6))) {
        const top = box([x - 0.4, fy + 0.7, z - 0.35], [x + 0.4, fy + 0.74, z + 0.35], 'furnitureLight', true);
        const leg = box([x - 0.05, fy, z - 0.05], [x + 0.05, fy + 0.7, z + 0.05], 'metalDark', true);
        const probe = { min: [x - 0.45, fy, z - 0.4] as [number, number, number], max: [x + 0.45, fy + 1, z + 0.4] as [number, number, number] };
        if (hitsAny(doors, probe) || solids.some((o) => overlaps(o, probe, 0.05))) continue;
        addGroup(ctx, [top, leg], 'sideTable');
        if (!ctx.reachOk()) { ctx.removeBoxes((b) => b === top || b === leg); continue; }
        T.push(top);
        break;
      }
      if (!T.length) return false;
    }
    const B: Box[] = [];
    const steam: number[][] = [];
    const fx: { [k: string]: Json }[] = [];
    T.slice(0, 4).forEach((tp, i) => {
      const y = tp.max[1];
      const cx = (tp.min[0] + tp.max[0]) / 2, cz = (tp.min[2] + tp.max[2]) / 2;
      const mx = cx + ctx.rng.float(-0.12, 0.12), mz = cz + ctx.rng.float(-0.08, 0.08);
      // マグ（白い器 + コーヒーの面 + 取っ手）と湯気
      B.push(box([mx - 0.04, y, mz - 0.04], [mx + 0.04, y + 0.095, mz + 0.04], 'paintWhite', false), box([mx - 0.033, y + 0.08, mz - 0.033], [mx + 0.033, y + 0.088, mz + 0.033], 'furnitureDark', false), box([mx + 0.04, y + 0.025, mz - 0.006], [mx + 0.06, y + 0.07, mz + 0.006], 'paintWhite', false));
      steam.push([mx, y + 0.12, mz]);
      if (i === 0) {
        // 点いたままの画面（開いたノートパソコン）
        const lx = cx - 0.2, lz = cz;
        B.push(box([lx - 0.16, y, lz - 0.11], [lx + 0.16, y + 0.015, lz + 0.11], 'metalDark', false), box([lx - 0.16, y + 0.015, lz - 0.115], [lx + 0.16, y + 0.22, lz - 0.105], 'screenLcd', false));
      } else if (i === 1) {
        // 食べかけの皿
        B.push(box([cx + 0.08, y, cz - 0.11], [cx + 0.3, y + 0.012, cz + 0.11], 'paintWhite', false), box([cx + 0.14, y + 0.012, cz - 0.05], [cx + 0.22, y + 0.04, cz + 0.03], 'boxCardboard', false));
      } else if (i === 2) {
        // 卓上の扇風機（羽は回す）
        const fx0 = cx + 0.15, fz0 = cz;
        B.push(box([fx0 - 0.07, y, fz0 - 0.07], [fx0 + 0.07, y + 0.03, fz0 + 0.07], 'paintWhite', false), box([fx0 - 0.012, y + 0.03, fz0 - 0.012], [fx0 + 0.012, y + 0.22, fz0 + 0.012], 'paintWhite', false));
        const hub = y + 0.27;
        fx.push({ kind: 'spin', boxes: boxesJ([box([fx0 - 0.15, hub - 0.025, fz0 - 0.004], [fx0 + 0.15, hub + 0.025, fz0 + 0.004], 'paintWhite', false), box([fx0 - 0.025, hub - 0.15, fz0 - 0.004], [fx0 + 0.025, hub + 0.15, fz0 + 0.004], 'paintWhite', false)]), center: [fx0, hub, fz0], axis: 'z', speed: 14 });
      }
    });
    addGroup(ctx, B, 'leftovers');
    // まだ回っている椅子（当たり判定は外す。描画だけで回す）
    const chairs = objectGroups(ctx.furniture, cell).filter((g) => kindOf(g) === 'chair' && bbOf(g.boxes).max[1] - fy < 1.3);
    if (chairs.length) {
      const g = ctx.rng.pick(chairs);
      const bb = bbOf(g.boxes);
      const c = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2];
      const set = new Set(g.boxes);
      ctx.removeBoxes((b) => set.has(b));
      fx.push({ kind: 'spin', boxes: boxesJ(g.boxes), center: c, axis: 'y', speed: ctx.tuning['anomaly.justLeft.chairSpin'] });
    }
    // 消えた画面を点ける
    for (const b of cell.boxes) if (b.mat === 'screenDark' && b.max[1] - b.min[1] > 0.12) b.mat = 'screenLcd';
    const room = roomFx(ctx, { kind: 'steam', items: steam }, ...fx);
    // 部屋にいる間、どこかで電話が鳴る
    const p = gridPoints(ctx, 1, 0.6)[0];
    if (p) ctx.addEntity('phone', { type: 'soundBeacon', params: { pos: [p[0], fy + 0.8, p[1]], kind: 'phoneRing', period: 3.6 }, inputs: { enable: `${room}.in` } });
    cell.audioPreset = '微かなコーヒーマシン・時計';
    return true;
  },
});
