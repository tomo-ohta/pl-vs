/**
 * 足跡と光る床・水たまりの鏡（G11〜G14・BG05）。どれも本道に置ける（通り抜けるだけでも遊べる。普通でない歩き方で隠しが現れる）。
 *
 * - glowMaze 光る床の迷路 [G11]: 照明の消えた迷路（天井までの仕切り）。踏んだ所だけ床がしばらく光る（自分の通った道が分かる）。
 *   青白い「誰か」の足跡が、出口とは違う行き止まりへ続いていて、その奥の壁に扉（trail.glow: 存在型 / 出現型 = 足跡の終わりで立ち止まる）
 * - footLoop 足跡が残る床 [WS G12]・逆回り（BG05）: 部屋の真ん中に大きな柱の塊。床は埃っぽく、歩いた所に足跡が残る（一周すると分かる）。
 *   塊のまわりを 1 周したあと、逆向きに 1 周すると、壁に扉が現れる（loop.reverse・出現型）
 * - strangerTrail 他人の足跡 [G13]: 普通の部屋の床に、誰かの足跡が入口から部屋を横切って壁まで続き、壁の前で止まっている。
 *   その壁に扉（trail.stranger: 存在型 = 壁と同じ色の扉 / 出現型 = 足跡の終わりで立ち止まると現れる）。
 *   足跡は作り置きの「誰か」（印の列は stepTrail と同じ形。のちに他の遊び手の足跡を入れられる。非同期マルチプレイの下地）
 * - mirrorPuddle 水たまりの鏡 [G14]: 雨漏りの水たまりがいくつもある部屋。水面にだけ「別の部屋」が映る（同じ部屋の鏡像だが、照明の色が違い、
 *   壁に開いた明るい扉と、そこに立つ誰か）。水面越しに映った扉をしばらく見ると、本当の壁に扉が現れる（mirror.door: 存在型 / 出現型）。
 *   描画は床の下に部屋の鏡像を組む（映り込みの描画を別に回さないので軽い。画質の段が low なら家具を映さない）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W, type Box, type Json } from '../../../world/layout.ts';
import { carveMaze, edgeKey, mazePath, openDegree, treeDistance } from '../maze.ts';
import { mazeCount } from '../secret.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, cutFloorSlab, doorZone, freeWallSpan, frontOf, hitsDoorZones, innerRect } from '../util.ts';
import { botHint, linkRoomLights, onRectWall, wallCoord, type BotStepSpec } from './common.ts';

/** 壁 d の、壁に沿った位置 at の前の、壁から inset m の点 */
function wallFront(ctx: GimmickContext, d: Dir, at: number, inset: number): [number, number] {
  const r = innerRect(ctx.slot);
  const w = wallCoord(r, d);
  const sg = d === 0 || d === 1 ? -1 : 1;
  return d % 2 === 0 ? [at, w + sg * inset] : [w + sg * inset, at];
}

/** 足跡の列（[x, z, 向き] × n）: 折れ線に沿って pitch m ごと、左右へ 0.11 m ずつ交互に */
function trailMarks(pts: [number, number][], pitch = 0.34): number[] {
  const out: number[] = [];
  let side = 1, carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    const yaw = Math.atan2(-ux, -uz);
    for (let s = carry; s <= L; s += pitch) {
      side = -side;
      out.push(Math.round((a[0] + ux * s + Math.cos(yaw) * 0.11 * side) * 1000) / 1000, Math.round((a[1] + uz * s - Math.sin(yaw) * 0.11 * side) * 1000) / 1000, Math.round(yaw * 1000) / 1000);
      carry = s + pitch - L;
    }
  }
  return out;
}

/** 開口の無い壁の、扉の幅 + 余裕の空いた所（入口の壁を除く。向かいの壁を後に） */
function sideWall(ctx: GimmickContext, avoidOpp = true): { dir: Dir; at: number } | null {
  const s = ctx.slot;
  const ent = s.entrance!;
  const dirs = ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => d !== ent.dir)).sort((a, b) => (avoidOpp ? Number(a === (ent.dir + 2) % 4) - Number(b === (ent.dir + 2) % 4) : 0));
  for (const d of dirs) {
    const span = freeWallSpan(s, d, DOOR_W + 0.8, 0.9);
    if (span) return { dir: d, at: ctx.rng.float(span.a0 + 0.9, Math.max(span.a0 + 0.9, span.a1 - 0.9)) };
  }
  return null;
}

// ---------------------------------------------------------------- 光る床の迷路
defineGimmick({
  id: 'glowMaze', name: '光る床の迷路', axes: ['light', 'floor'], kinds: ['room', 'hall'], minSize: [4.6, 5.2], weight: 0.6, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    if (!s.openings.every((o) => onRectWall(s, o))) return;
    const W = r.x1 - r.x0, D = r.z1 - r.z0;
    const nx = mazeCount(W, 1.8), nz = mazeCount(D, 1.8);
    if (nx * nz < 6) return;
    const cw = W / nx, cd = D / nz;
    const cellOf = (x: number, z: number): number => Math.min(nz - 1, Math.max(0, Math.floor((z - r.z0) / cd))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - r.x0) / cw)));
    const center = (c: number): [number, number] => [r.x0 + ((c % nx) + 0.5) * cw, r.z0 + (Math.floor(c / nx) + 0.5) * cd];
    // 開口の前の升目どうしはつなぐ（扉の前を塞がない）
    const regions: number[][] = s.openings.map((o) => {
      const at = o.dir % 2 === 0 ? o.pos[0] : o.pos[2], hw = o.width / 2 + 0.35;
      const cells: number[] = [];
      if (o.dir % 2 === 0) { const k = o.dir === 0 ? nz - 1 : 0; for (let i = 0; i < nx; i++) if (r.x0 + i * cw < at + hw && r.x0 + (i + 1) * cw > at - hw) cells.push(k * nx + i); }
      else { const i = o.dir === 1 ? nx - 1 : 0; for (let k = 0; k < nz; k++) if (r.z0 + k * cd < at + hw && r.z0 + (k + 1) * cd > at - hw) cells.push(k * nx + i); }
      return cells;
    });
    const doorCells = new Set(regions.flat());
    const a = frontOf(s.entrance!, 0.9), b = frontOf(s.exit!, 0.9);
    const start = cellOf(a[0], a[2]), goal = cellOf(b[0], b[2]);
    if (start === goal) return;
    // 迷路を掘り、出口の道から遠い壁際の行き止まり（足跡の行き先）を選ぶ
    type Plan = { open: Set<string>; path: number[]; dead: { cell: number; dir: Dir; at: number } };
    let plan = null as Plan | null, bestFar = -1;
    for (let tr = 0; tr < 12; tr++) {
      const open = carveMaze(nx, nz, start, ctx.rng.fork(`m${tr}`));
      for (const cells of regions) for (let j = 1; j < cells.length; j++) open.add(edgeKey(cells[j - 1]!, cells[j]!));
      const path = mazePath(nx, nz, open, start, goal);
      if (!path) continue;
      const on = new Set(path);
      const far = treeDistance(nx, nz, open, path);
      for (let c = 0; c < nx * nz; c++) {
        if (on.has(c) || doorCells.has(c) || openDegree(nx, nz, open, c) !== 1) continue;
        const i = c % nx, k = Math.floor(c / nx);
        const [x, z] = center(c);
        const walls: [Dir, number][] = [];
        if (k === nz - 1) walls.push([0, x]);
        if (k === 0) walls.push([2, x]);
        if (i === nx - 1) walls.push([1, z]);
        if (i === 0) walls.push([3, z]);
        for (const [dir, at] of walls) {
          if (s.openings.some((o) => o.dir === dir && Math.abs((dir % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + DOOR_W / 2 + 0.6)) continue;
          if (far[c]! > bestFar) { bestFar = far[c]!; plan = { open, path, dead: { cell: c, dir, at } }; }
        }
      }
      if (plan && bestFar >= 2) break;
    }
    if (!plan) return;
    const { open, dead } = plan;
    // 仕切り（天井まで）
    const T = 0.1, H = s.cell.height, mat = s.cell.palette.wall;
    const walls: Box[] = [];
    for (let i = 1; i < nx; i++) {
      const x = r.x0 + i * cw;
      let k0 = -1;
      for (let k = 0; k <= nz; k++) {
        const closed = k < nz && !open.has(edgeKey(k * nx + i - 1, k * nx + i));
        if (closed && k0 < 0) k0 = k;
        if (!closed && k0 >= 0) { walls.push(box([x - T / 2, y, Math.max(r.z0, r.z0 + k0 * cd - T / 2)], [x + T / 2, y + H, Math.min(r.z1, r.z0 + k * cd + T / 2)], mat)); k0 = -1; }
      }
    }
    for (let k = 1; k < nz; k++) {
      const z = r.z0 + k * cd;
      let i0 = -1;
      for (let i = 0; i <= nx; i++) {
        const closed = i < nx && !open.has(edgeKey((k - 1) * nx + i, k * nx + i));
        if (closed && i0 < 0) i0 = i;
        if (!closed && i0 >= 0) { walls.push(box([Math.max(r.x0, r.x0 + i0 * cw - T / 2), y, z - T / 2], [Math.min(r.x1, r.x0 + i * cw + T / 2), y + H, z + T / 2], mat)); i0 = -1; }
      }
    }
    ctx.removeBoxes((bx) => !bx.solid && bx.mat === s.cell.palette.light && walls.some((w) => bx.min[0] < w.max[0] && bx.max[0] > w.min[0] && bx.min[2] < w.max[2] && bx.max[2] > w.min[2]));
    for (const w of walls) ctx.addBox(w);
    // 照明は消えたまま（懐中電灯と、光る足跡で進む）
    const dark = ctx.addEntity('dark', { type: 'lamp', params: { on: false } });
    linkRoomLights(ctx, dark);
    // 自分の足跡（光って消える）
    ctx.addEntity('trail', { type: 'stepTrail', params: { room: aabbJson({ min: [r.x0, y - 0.2, r.z0], max: [r.x1, y + 2.5, r.z1] }), stride: 0.5, max: 140, style: 'glow', fadeSec: t['ground.glow.fadeSec'], y } });
    // 誰かの足跡: 入口から、出口の道を外れて行き止まりの奥まで
    const route = mazePath(nx, nz, open, start, dead.cell)!;
    const wf = wallFront(ctx, dead.dir, dead.at, 0.45);
    const pts: [number, number][] = [[a[0], a[2]], ...route.map(center), wf];
    ctx.addEntity('stranger', { type: 'footMarks', params: { marks: trailMarks(pts), style: 'glowFaint', y } });
    // 出現型: 足跡の終わりで立ち止まる
    const endZ = aabbJson({ min: [wf[0] - 0.6, y - 0.1, wf[1] - 0.6], max: [wf[0] + 0.6, y + 1.5, wf[1] + 0.6] });
    const stop = ctx.addEntity('stop', { type: 'dwellSensor', params: { aabb: endZ, sec: t['ground.trail.stopSec'], still: true } });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: [wf[0], y, wf[1]], wait: 0.3, until: `${stop}.done` }], { only: 'secret' }) } });
    ctx.offerSecret({ hook: 'trail.glow', modes: ['present', 'appear'], weight: 1.1, revealOutput: `${stop}.done`, doorway: { dir: dead.dir, at: dead.at, y, width: 1.0, height: 2.0 }, tell: '暗がりに続く、青白い誰かの足跡' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + H, r.z1] });
  },
});

// ---------------------------------------------------------------- 足跡が残る床・逆回り
defineGimmick({
  id: 'footLoop', name: '足跡が残る床', axes: ['floor', 'sight'], kinds: ['room', 'hall'], minSize: [4.4, 4.4], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const m = t['ground.loop.corridorM'];
    const blk: Rect = { x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m };
    if (blk.x1 - blk.x0 < 1.2 || blk.z1 - blk.z0 < 1.2) return;
    if (hitsDoorZones(s, blk, 1.35)) return;
    const wall = sideWall(ctx, false);
    if (!wall) return;
    // 真ん中の塊（天井まで。棚の背中のような壁）
    ctx.removeBoxes((bx) => !bx.solid && bx.mat === s.cell.palette.light && bx.min[0] < blk.x1 && bx.max[0] > blk.x0 && bx.min[2] < blk.z1 && bx.max[2] > blk.z0);
    s.cell.lights = s.cell.lights.filter((l) => !(l.pos[0] > blk.x0 && l.pos[0] < blk.x1 && l.pos[2] > blk.z0 && l.pos[2] < blk.z1));
    ctx.addBox(box([blk.x0, y, blk.z0], [blk.x1, y + s.cell.height, blk.z1], s.cell.palette.wall));
    const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
    ctx.addEntity('trail', { type: 'stepTrail', params: { room: aabbJson({ min: [r.x0, y - 0.2, r.z0], max: [r.x1, y + 2.5, r.z1] }), stride: 0.42, max: t['ground.loop.prints'], style: 'print', y } });
    const loop = ctx.addEntity('loop', { type: 'loopCounter', params: { center: [cx, y, cz], region: aabbJson({ min: [r.x0, y - 0.3, r.z0], max: [r.x1, y + 2.5, r.z1] }) } });
    // 歩く人（隠しへ行くとき）: 塊のまわりを 1 周と少し、逆向きに 1 周と少し
    const cs: [number, number][] = [[r.x0 + m / 2, r.z0 + m / 2], [r.x1 - m / 2, r.z0 + m / 2], [r.x1 - m / 2, r.z1 - m / 2], [r.x0 + m / 2, r.z1 - m / 2]];
    const lap = [0, 1, 2, 3, 0, 1, 2], back = [1, 0, 3, 2, 1, 0, 3, 2];
    const steps: BotStepSpec[] = [...lap, ...back].map((i) => ({ at: [cs[i]![0], y, cs[i]![1]], wait: 0 }));
    steps.push({ at: [cs[2]![0], y, cs[2]![1]], wait: 0.2, until: `${loop}.reversed` });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint(steps, { only: 'secret', doneIf: `${loop}.reversed` }) } });
    ctx.offerSecret({ hook: 'loop.reverse', modes: ['appear'], weight: 1.1, revealOutput: `${loop}.reversed`, doorway: { dir: wall.dir, at: wall.at, y, width: 1.0, height: 2.0 }, tell: '自分の足跡の輪の外の、踏まれていない床' });
    // 通路に家具を置かない
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 3, r.z1] });
  },
});

// ---------------------------------------------------------------- 他人の足跡
defineGimmick({
  id: 'strangerTrail', name: '他人の足跡', axes: ['sight'], kinds: ['room', 'hall'], minSize: [4.0, 4.4], weight: 0.15, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const wall = sideWall(ctx);
    if (!wall) return;
    const a = frontOf(s.entrance!, 1.0);
    const wf = wallFront(ctx, wall.dir, wall.at, 0.4);
    // 途中で一度向きを変える（部屋の真ん中寄りを通る）
    const r = innerRect(s, 0.8);
    const mid: [number, number] = [Math.min(r.x1, Math.max(r.x0, (a[0] + wf[0]) / 2 + ctx.rng.float(-0.8, 0.8))), Math.min(r.z1, Math.max(r.z0, (a[2] + wf[1]) / 2 + ctx.rng.float(-0.8, 0.8)))];
    const pts: [number, number][] = [[a[0], a[2]], mid, wf];
    const marks = trailMarks(pts, 0.36);
    // 終わり: 壁の前で両足をそろえて、壁の方を向いて止まる
    const yawEnd = Math.atan2(-(wf[0] - mid[0]), -(wf[1] - mid[1]));
    marks.push(wf[0] + Math.cos(yawEnd) * 0.11, wf[1] - Math.sin(yawEnd) * 0.11, yawEnd, wf[0] - Math.cos(yawEnd) * 0.11, wf[1] + Math.sin(yawEnd) * 0.11, yawEnd);
    ctx.addEntity('marks', { type: 'footMarks', params: { marks, style: 'dust', y } });
    const endZ = aabbJson({ min: [wf[0] - 0.55, y - 0.1, wf[1] - 0.55], max: [wf[0] + 0.55, y + 1.5, wf[1] + 0.55] });
    const stop = ctx.addEntity('stop', { type: 'dwellSensor', params: { aabb: endZ, sec: t['ground.trail.stopSec'], still: true } });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: [wf[0], y, wf[1]], wait: 0.3, until: `${stop}.done` }], { only: 'secret' }) } });
    ctx.offerSecret({ hook: 'trail.stranger', modes: ['present', 'appear'], weight: 1.1, revealOutput: `${stop}.done`, doorway: { dir: wall.dir, at: wall.at, y, width: 1.0, height: 2.0 }, tell: '壁の前で途切れた、誰かの足跡' });
    // 足跡の上に家具を置かない
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!, q = pts[i]!;
      ctx.keepOut({ min: [Math.min(p[0], q[0]) - 0.45, y - 0.1, Math.min(p[1], q[1]) - 0.45], max: [Math.max(p[0], q[0]) + 0.45, y + 3, Math.max(p[1], q[1]) + 0.45] });
    }
  },
});

// ---------------------------------------------------------------- 水たまりの鏡
defineGimmick({
  id: 'mirrorPuddle', name: '水たまりの鏡', axes: ['sight', 'light'], kinds: ['room', 'hall'], minSize: [4.4, 5.0], weight: 0.4, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const wall = sideWall(ctx);
    if (!wall) return;
    const r = innerRect(s, 0.3);
    // 扉の前の水たまり（壁から 1.4〜2.6 m）と、ほかに 2〜3 個
    const R0 = innerRect(s);
    const wc = wallCoord(R0, wall.dir), sg = wall.dir === 0 || wall.dir === 1 ? -1 : 1;
    const along = (u0: number, u1: number, v0: number, v1: number): Rect => wall.dir % 2 === 0
      ? { x0: u0, x1: u1, z0: Math.min(wc + sg * v0, wc + sg * v1), z1: Math.max(wc + sg * v0, wc + sg * v1) }
      : { z0: u0, z1: u1, x0: Math.min(wc + sg * v0, wc + sg * v1), x1: Math.max(wc + sg * v0, wc + sg * v1) };
    const main = along(wall.at - 0.7, wall.at + 0.7, 1.35, 2.65);
    const pud: Rect[] = [];
    const clear = (q: Rect): boolean => q.x0 >= r.x0 && q.x1 <= r.x1 && q.z0 >= r.z0 && q.z1 <= r.z1 && !hitsDoorZones(s, { x0: q.x0 - 0.2, z0: q.z0 - 0.2, x1: q.x1 + 0.2, z1: q.z1 + 0.2 }, 1.4) && pud.every((p) => q.x0 > p.x1 + 0.6 || q.x1 < p.x0 - 0.6 || q.z0 > p.z1 + 0.6 || q.z1 < p.z0 - 0.6);
    if (!clear(main)) return;
    pud.push(main);
    for (let k = 0; k < 30 && pud.length < 4; k++) {
      const w = ctx.rng.float(0.9, 1.5), d = ctx.rng.float(0.8, 1.3);
      const x = ctx.rng.float(r.x0, r.x1 - w), z = ctx.rng.float(r.z0, r.z1 - d);
      const q = { x0: x, z0: z, x1: x + w, z1: z + d };
      if (clear(q)) pud.push(q);
    }
    // 床板を切り、見えない床（当たり判定だけ）を入れる。水面は描画（view mirrorRoom）が鏡像と一緒に描く
    for (const q of pud) {
      cutFloorSlab(s, q);
      const c = box([q.x0, y - 0.2, q.z0], [q.x1, y, q.z1], 'metalDark');
      c.kind = 'colliderOnly';
      ctx.addBox(c);
    }
    // 雨漏りの染み（天井）と、床の濡れ
    s.cell.render = { ...(s.cell.render ?? {}), floorWetness: Math.max(s.cell.render?.floorWetness ?? 0, 0.6) };
    const door = { dir: wall.dir, at: wall.at, y, w: 1.0, h: 2.1 };
    const dc = wallFront(ctx, wall.dir, wall.at, 0);
    // 歩く人が見る所: 鏡に映った扉の上の方（床から 1.8 m 下）。扉の前の水たまりの真ん中越しに見える所に立つ
    const target: [number, number, number] = [dc[0], y - 1.8, dc[1]];
    const vMid = 2.0, eyeH = 1.6;
    const vStand = Math.min(vMid / (1 - eyeH / (eyeH + 1.8)), (wall.dir % 2 === 0 ? R0.z1 - R0.z0 : R0.x1 - R0.x0) - 0.5);
    ctx.addEntity('mirror', { type: 'mirrorRoom', params: { puddles: pud.map((q) => [q.x0, q.z0, q.x1, q.z1]), floorY: y, door: door as unknown as Json, tint: ctx.rng.pick([0xff8f7a, 0x8fb4ff, 0x9dffb0]) } });
    const gaze = ctx.addEntity('gaze', { type: 'mirrorGaze', params: { floorY: y, puddles: pud.map((q) => [q.x0, q.z0, q.x1, q.z1]), door: { dir: wall.dir, at: wall.at, w: 1.0, h: 2.1, wall: wc } as unknown as Json, region: aabbJson({ min: [R0.x0, y - 0.3, R0.z0], max: [R0.x1, y + 2.5, R0.z1] }), sec: t['ground.mirror.gazeSec'] } });
    // 歩く人（隠しへ行くとき）: 扉の前の水たまりの向こうに立って、水面の扉を見る
    const st = (() => { const p = wallFront(ctx, wall.dir, wall.at, vStand); return [p[0], y, p[1]] as [number, number, number]; })();
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: st, look: target, wait: 0.2, until: `${gaze}.done` }], { only: 'secret', doneIf: `${gaze}.done` }) } });
    ctx.offerSecret({ hook: 'mirror.door', modes: ['present', 'appear'], weight: 1.1, revealOutput: `${gaze}.done`, doorway: { dir: wall.dir, at: wall.at, y, width: 1.0, height: 2.0 }, tell: '水たまりにだけ映る、開いた扉' });
    for (const q of pud) ctx.keepOut({ min: [q.x0 - 0.2, y - 0.3, q.z0 - 0.2], max: [q.x1 + 0.2, y + 3, q.z1 + 0.2] });
    const zz = doorZone({ id: 'x', pos: [dc[0], y, dc[1]], dir: wall.dir, width: 1.0, height: 2.0 }, y, 3.6, 0.4);
    ctx.keepOut(zz);
  },
});
