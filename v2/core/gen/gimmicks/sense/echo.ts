/**
 * 音で形を知る迷路（段階 4・担当 sense）。部屋いっぱいの迷路（天井までの仕切り。完全迷路で行き止まりがある）。
 *
 * - echoMaze 反響で形が分かる [A07]・音が見える [A08]: 真っ暗な部屋の、光を返さない黒い仕切りの迷路（懐中電灯では何も見えない）。
 *     音を立てると、音が光の輪として広がり、輪が当たった仕切りの縁が一瞬光る（歩く = 小さな輪・跳んで着地 = 大きな輪・しゃがみ歩き = 音が無い）。
 *     出口の前では水の滴る音が鳴り続け、そこからも小さな輪が広がる（止まっていても出口の向きが分かる）。
 *     手を叩く操作は無いので、跳んで着地する音を手を叩く代わりにした
 * - pitchMaze 音の高さの部屋 [A11]: 濃い霧の迷路（懐中電灯は霧に吸われて先が見えない）。部屋に低い音が鳴っていて、
 *     出口に（迷路の道のりで）近いほど音が高くなる。音の高さで場所が分かる。音を消していても、仕切りは近くなら見えるので歩いて抜けられる
 */
import { box, type Box, type MatId } from '../../../world/layout.ts';
import { carveMaze, edgeKey, mazePath, treeDistance } from '../maze.ts';
import { mazeCount } from '../secret.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { frontOf, innerRect, rectD, rectW } from '../util.ts';
import { darkenRoom } from './util.ts';

interface Maze { nx: number; nz: number; x0: number; z0: number; cw: number; cd: number; open: Set<string>; start: number; goal: number; walls: Box[] }

/** 迷路を作る（仕切りの箱 walls を返す。まだ部屋には足さない）。開口の前の升目どうしはつなぐ。作れなければ null */
function planMaze(ctx: GimmickContext, cellM: number, mat: MatId): Maze | null {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const r = innerRect(s);
  const W = rectW(r), D = rectD(r);
  const nx = mazeCount(W, cellM), nz = mazeCount(D, cellM);
  if (nx * nz < 9) return null;
  const cw = W / nx, cd = D / nz;
  const cellOf = (x: number, z: number): number => Math.min(nz - 1, Math.max(0, Math.floor((z - r.z0) / cd))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - r.x0) / cw)));
  const regions: number[][] = [];
  for (const o of s.openings) {
    const wallC = o.dir === 0 ? s.rect.z1 : o.dir === 2 ? s.rect.z0 : o.dir === 1 ? s.rect.x1 : s.rect.x0;
    if (Math.abs((o.dir % 2 === 0 ? o.pos[2] : o.pos[0]) - wallC) > 0.3) return null;
    const at = o.dir % 2 === 0 ? o.pos[0] : o.pos[2];
    const hw = o.width / 2 + 0.35;
    const cells: number[] = [];
    if (o.dir % 2 === 0) { const k = o.dir === 0 ? nz - 1 : 0; for (let i = 0; i < nx; i++) if (r.x0 + i * cw < at + hw && r.x0 + (i + 1) * cw > at - hw) cells.push(k * nx + i); }
    else { const i = o.dir === 1 ? nx - 1 : 0; for (let k = 0; k < nz; k++) if (r.z0 + k * cd < at + hw && r.z0 + (k + 1) * cd > at - hw) cells.push(k * nx + i); }
    regions.push(cells);
  }
  const a = frontOf(s.entrance!, 0.9), b = frontOf(s.exit!, 0.9);
  const start = cellOf(a[0], a[2]), goal = cellOf(b[0], b[2]);
  if (start === goal) return null;
  const open = carveMaze(nx, nz, start, ctx.rng.fork('maze'));
  for (const cells of regions) for (let j = 1; j < cells.length; j++) open.add(edgeKey(cells[j - 1]!, cells[j]!));
  if (!mazePath(nx, nz, open, start, goal)) return null;
  const T = 0.1, H = s.cell.height;
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
  return { nx, nz, x0: r.x0, z0: r.z0, cw, cd, open, start, goal, walls };
}

function addMaze(ctx: GimmickContext, m: Maze): void {
  const s = ctx.slot;
  ctx.removeBoxes((bx) => !bx.solid && bx.mat === s.cell.palette.light && m.walls.some((w) => bx.min[0] < w.max[0] && bx.max[0] > w.min[0] && bx.min[2] < w.max[2] && bx.max[2] > w.min[2]));
  for (const w of m.walls) ctx.addBox(w);
  const r = innerRect(s);
  ctx.keepOut({ min: [r.x0, s.cell.floorY - 0.1, r.z0], max: [r.x1, s.cell.floorY + s.cell.height, r.z1] });
}

defineGimmick({
  id: 'echoMaze', name: '反響で形が分かる', axes: ['sound', 'light'], kinds: ['room', 'hall'], minSize: [4.6, 5.2], weight: 0.35, intensity: 1, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const m = planMaze(ctx, ctx.tuning['sense.maze.cellM'], 'void');
    if (!m) return;
    addMaze(ctx, m);
    darkenRoom(ctx);
    const ex = frontOf(s.exit!, 0.6);
    // 出口の前で滴る水の音（描画が音と、そこから広がる小さな輪を出す）
    const y = s.cell.floorY;
    ctx.addEntity('drip', { type: 'soundBeacon', params: { pos: [ex[0], y + 1.0, ex[2]], kind: 'drip', period: ctx.tuning['sense.maze.dripSec'] } });
    ctx.addEntity('echo', { type: 'senseFx', params: { fx: 'echo', walls: m.walls.map((w) => [w.min[0], w.min[2], w.max[0], w.max[2]]), y, h: s.cell.height, drip: [ex[0], y + 1.0, ex[2]] } });
  },
});

defineGimmick({
  id: 'pitchMaze', name: '音の高さの部屋', axes: ['sound', 'sight'], kinds: ['room', 'hall'], minSize: [4.6, 5.2], weight: 0.3, intensity: 1, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const m = planMaze(ctx, t['sense.maze.cellM'], s.cell.palette.wall);
    if (!m) return;
    addMaze(ctx, m);
    // 濃い霧（懐中電灯は霧に吸われる）
    s.cell.render = { ...s.cell.render, fog: { color: 0x9aa0a4, near: t['sense.pitch.fogNear'], far: t['sense.pitch.fogFar'] } };
    s.cell.palette = { ...s.cell.palette, fog: 0x9aa0a4 };
    // 出口の升目からの道のり（升目の数）
    const dist = Array.from(treeDistance(m.nx, m.nz, m.open, [m.goal]));
    const y = s.cell.floorY;
    ctx.addEntity('pitch', { type: 'senseFx', params: { fx: 'pitch', grid: [m.x0, m.z0, m.cw, m.cd, m.nx, m.nz], dist, y, h: s.cell.height } });
  },
});
