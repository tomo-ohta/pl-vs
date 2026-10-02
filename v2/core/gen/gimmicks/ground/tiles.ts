/**
 * 床の升目の仕掛け（踏むと鳴る床 G09・踏まない区画 D03・順番の区画 D02）。どれも床は普通の床で、通り抜けるだけなら何も起きない
 * （本道に置ける）。普通でない歩き方をすると、隠しの扉が現れる（出現型）。
 *
 * - chimeTiles 踏むと鳴る床 [WS G09]: 部屋の床いっぱいの升目。升目ごとに音の高さが違う。部屋に入ると升目が順に光って鳴り、
 *   短い節を見せる（隣どうしの升目をたどる節）。同じ順に踏むと和音が鳴って扉が現れる（chime.melody）
 * - avoidTiles 踏まない区画 [QR D03]: 赤い升目と白い升目の床。入口の前の黄色い印に立ってから、赤い升目を 1 つも踏まずに
 *   奥の光る印まで行くと扉が現れる（avoid.clean）。赤を踏むと低い音で失敗（印からやり直し）。白い升目は奥まで 1 本つながっている
 *   （記録の代わりに隠し: 報酬を置かない決まり）
 * - visitOrder 順番の区画 [QR D02]: 部屋の床に色の付いた 3〜4 か所の印（柱の灯り付き）。壁の板に色の並び（左から順）。
 *   その順に印の上で立ち止まると、訪れた印の灯りが点いていき、全部点くと扉が現れる（visit.order）。違う印で立ち止まると灯りが消えて最初から
 *   （通り過ぎるだけでは数えない）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W, type MatId } from '../../../world/layout.ts';
import { carveMaze, gridNeighbors, mazePath } from '../maze.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, freeWallSpan, hitsDoorZones, innerRect, wallFrame } from '../util.ts';
import { botHint, entranceFrame, onRectWall, snap } from './common.ts';

/** 床の升目（入口の壁からの座標で、入口の扉の前 1.4 m と出口の扉の前を空ける）。world の矩形と、升目の並び（a: u の番号 / b: v の番号） */
function tileGrid(ctx: GimmickContext, size: number): { tiles: Rect[]; nu: number; nv: number; at: (a: number, b: number) => number } | null {
  const s = ctx.slot;
  if (!s.entrance || !s.openings.every((o) => onRectWall(s, o))) return null;
  const F = entranceFrame(s);
  const farDoor = s.openings.some((o) => o !== s.entrance && o.dir === (s.entrance!.dir + 2) % 4);
  const v0 = 1.4, v1 = F.depth - (farDoor ? 1.4 : 0.4);
  const nu = Math.floor((F.u1 - F.u0 - 0.4) / size), nv = Math.floor((v1 - v0) / size);
  if (nu < 3 || nv < 3) return null;
  const T = Math.min((F.u1 - F.u0 - 0.4) / nu, (v1 - v0) / nv, size * 1.15);
  const ua = snap((F.u0 + F.u1) / 2 - (nu * T) / 2), va = snap(v0 + (v1 - v0 - nv * T) / 2);
  const tiles: Rect[] = [];
  for (let b = 0; b < nv; b++) for (let a = 0; a < nu; a++) tiles.push(F.rect(ua + a * T, va + b * T, ua + (a + 1) * T, va + (b + 1) * T));
  return { tiles, nu, nv, at: (a, b) => b * nu + a };
}

/** 入口の壁以外の、扉の幅 + 余裕の空いた壁（奥の壁を先に）。扉の位置（壁の向き・壁に沿った位置） */
function secretWall(ctx: GimmickContext, prefer?: [number, number]): { dir: Dir; at: number } | null {
  const s = ctx.slot;
  const ent = s.entrance!;
  const dirs = ([0, 1, 2, 3] as Dir[]).filter((d) => d !== ent.dir).sort((a, b) => Number(b === (ent.dir + 2) % 4) - Number(a === (ent.dir + 2) % 4));
  for (const d of dirs) {
    const span = freeWallSpan(s, d, DOOR_W + 0.6, 0.9);
    if (!span) continue;
    let at = span.at;
    if (prefer) { const want = d % 2 === 0 ? prefer[0] : prefer[1]; at = Math.min(Math.max(want, span.a0 + 0.8), span.a1 - 0.8); }
    return { dir: d, at };
  }
  return null;
}

const centerOf = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

defineGimmick({
  id: 'chimeTiles', name: '踏むと鳴る床', axes: ['sound', 'floor'], kinds: ['room', 'hall'], minSize: [4.4, 5.6], weight: 0.6, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const g = tileGrid(ctx, t['ground.chime.tileM']);
    if (!g) return;
    const wall = secretWall(ctx);
    if (!wall) return;
    // 節: 隣どうしの升目をたどる（すぐには戻らない・同じ升目を続けない）
    const L = Math.min(t['ground.chime.length'], g.nu * g.nv - 1);
    let seq: number[] = [];
    for (let tr = 0; tr < 20 && seq.length < L; tr++) {
      const r = ctx.rng.fork(`seq${tr}`);
      seq = [r.int(0, g.tiles.length - 1)];
      while (seq.length < L) {
        const prev = seq[seq.length - 2];
        const n = gridNeighbors(g.nu, g.nv, seq[seq.length - 1]!).filter((m) => m !== prev && !seq.slice(-3).includes(m));
        if (!n.length) break;
        seq.push(r.pick(n));
      }
    }
    if (seq.length < L) return;
    // 音の高さ: 五音音階を升目に（行で 1 オクターブずつ上がる）
    const SCALE = [261.6, 293.7, 329.6, 392.0, 440.0];
    const notes = g.tiles.map((_, i) => { const a = i % g.nu, b = Math.floor(i / g.nu); return SCALE[(a + b * 2) % 5]! * (b % 3 === 2 ? 2 : 1) * (a >= 5 ? 2 : 1); });
    // 升目の見た目（縁に細い溝）
    const mats: MatId[] = ['marbleWhite', 'floorTile'];
    g.tiles.forEach((r, i) => ctx.addBox(box([r.x0 + 0.03, y, r.z0 + 0.03], [r.x1 - 0.03, y + 0.006, r.z1 - 0.03], mats[(i + Math.floor(i / g.nu)) % 2]!, false)));
    const room = innerRect(s);
    const chime = ctx.addEntity('floor', { type: 'chimeFloor', params: { tiles: g.tiles.map((r) => [r.x0, r.z0, r.x1, r.z1]), seq, notes, y, room: aabbJson({ min: [room.x0, y - 0.5, room.z0], max: [room.x1, y + 3, room.z1] }), demoSec: t['ground.chime.demoSec'], noteSec: 0.7 } });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint(seq.map((i) => { const c = centerOf(g.tiles[i]!); return { at: [c[0], y, c[1]], wait: 0.25 }; }), { only: 'secret', doneIf: `${chime}.solved` }) } });
    ctx.offerSecret({ hook: 'chime.melody', modes: ['appear'], weight: 1.1, revealOutput: `${chime}.solved`, doorway: { dir: wall.dir, at: wall.at, y, width: 1.0, height: 2.0 }, tell: '升目が順に光って鳴る' });
    const all = g.tiles.reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), z0: Math.min(a.z0, r.z0), x1: Math.max(a.x1, r.x1), z1: Math.max(a.z1, r.z1) }));
    ctx.keepOut({ min: [all.x0, y - 0.1, all.z0], max: [all.x1, y + 3, all.z1] });
  },
});

defineGimmick({
  id: 'avoidTiles', name: '踏まない区画', axes: ['floor', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.4, 5.6], weight: 0.6, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const g = tileGrid(ctx, t['ground.avoid.tileM']);
    if (!g) return;
    const F = entranceFrame(s);
    // 印: 入口に近い手前の行の升目 → 目当て: 奥の行の升目。白い升目は迷路の 1 本道（掘った迷路の道）
    const ue = F.u(s.entrance!.pos[0], s.entrance!.pos[2]);
    const centersU = g.tiles.slice(0, g.nu).map((r) => F.u((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2));
    const a0 = centersU.reduce((bi, u, i) => (Math.abs(u - ue) < Math.abs(centersU[bi]! - ue) ? i : bi), 0);
    const start = g.at(a0, 0);
    // 白い道は、入口からまっすぐ奥へ歩く列（印の列）を何度も外れる道を選ぶ（まっすぐ歩くと赤を踏む）
    let best: number[] | null = null, goal = -1, bestScore = -Infinity;
    for (let tr = 0; tr < 16; tr++) {
      const open = carveMaze(g.nu, g.nv, start, ctx.rng.fork(`maze${tr}`));
      const gc = g.at(ctx.rng.int(0, g.nu - 1), g.nv - 1);
      const path = mazePath(g.nu, g.nv, open, start, gc);
      if (!path) continue;
      const off = [...Array(g.nv).keys()].filter((b) => b > 0 && !path.includes(g.at(a0, b))).length;
      const score = off * 3 + Math.min(path.length, g.nu * g.nv * 0.6);
      if (score > bestScore) { bestScore = score; best = path; goal = gc; }
    }
    if (!best) return;
    if ([...Array(g.nv).keys()].filter((b) => b > 0 && !best!.includes(g.at(a0, b))).length < Math.min(2, g.nv - 1)) return;
    const wall = secretWall(ctx, centerOf(g.tiles[goal]!));
    if (!wall) return;
    const onPath = new Set(best);
    // 道の外: たいてい赤。少しだけ白（行き止まりのおとり）。扉の前に掛かる升目は白（ほかの開口から来た人が困らない）
    const bad: number[] = [];
    g.tiles.forEach((r, i) => { if (onPath.has(i) || hitsDoorZones(s, r, 1.3)) return; if (!ctx.rng.chance(t['ground.avoid.decoy'])) bad.push(i); });
    const badSet = new Set(bad);
    g.tiles.forEach((r, i) => ctx.addBox(box([r.x0 + 0.03, y, r.z0 + 0.03], [r.x1 - 0.03, y + 0.006, r.z1 - 0.03], badSet.has(i) ? 'plasticRed' : 'marbleWhite', false)));
    // 印（黄色の枠）と目当て（光る小さな台）
    const sr = g.tiles[start]!, gr = g.tiles[goal]!;
    for (const [x0, z0, x1, z1] of [[sr.x0 + 0.08, sr.z0 + 0.08, sr.x1 - 0.08, sr.z0 + 0.16], [sr.x0 + 0.08, sr.z1 - 0.16, sr.x1 - 0.08, sr.z1 - 0.08], [sr.x0 + 0.08, sr.z0 + 0.16, sr.x0 + 0.16, sr.z1 - 0.16], [sr.x1 - 0.16, sr.z0 + 0.16, sr.x1 - 0.08, sr.z1 - 0.16]] as const) ctx.addBox(box([x0, y + 0.006, z0], [x1, y + 0.01, z1], 'yellowLine', false));
    const gc = centerOf(gr);
    ctx.addBox(box([gc[0] - 0.15, y, gc[1] - 0.15], [gc[0] + 0.15, y + 0.1, gc[1] + 0.15], 'lightGreen', false));
    const floor = ctx.addEntity('floor', { type: 'avoidFloor', params: { tiles: g.tiles.map((r) => [r.x0, r.z0, r.x1, r.z1]), bad, start, goal, y } });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint(best.map((i) => { const c = centerOf(g.tiles[i]!); return { at: [c[0], y, c[1]], wait: 0.05 }; }), { only: 'secret', doneIf: `${floor}.done` }) } });
    ctx.offerSecret({ hook: 'avoid.clean', modes: ['appear'], weight: 1.1, revealOutput: `${floor}.done`, doorway: { dir: wall.dir, at: wall.at, y, width: 1.0, height: 2.0 }, tell: '赤い升目の床の奥の、光る印' });
    const all = g.tiles.reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), z0: Math.min(a.z0, r.z0), x1: Math.max(a.x1, r.x1), z1: Math.max(a.z1, r.z1) }));
    ctx.keepOut({ min: [all.x0, y - 0.1, all.z0], max: [all.x1, y + 3, all.z1] });
  },
});

defineGimmick({
  id: 'visitOrder', name: '順番の区画', axes: ['puzzle'], kinds: ['room', 'hall'], minSize: [5.0, 5.6], weight: 0.6, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s, 0.3);
    const ent = s.entrance!;
    // 壁の板（色の並び）: 入口の向かいの壁か横の壁の、空いた所。隠しの扉: 板と別の壁（無ければ板の壁の端）
    const board = (() => {
      for (const d of ([((ent.dir + 2) % 4), (ent.dir + 1) % 4, (ent.dir + 3) % 4] as Dir[])) {
        const span = freeWallSpan(s, d, 1.6, 0.6);
        if (span) return { d, at: span.at };
      }
      return null;
    })();
    if (!board) return;
    const wallS = (() => {
      for (const d of ([0, 1, 2, 3] as Dir[]).filter((x) => x !== ent.dir && x !== board.d)) { const sp = freeWallSpan(s, d, DOOR_W + 0.6, 0.9); if (sp) return { dir: d, at: sp.at }; }
      const sp = freeWallSpan(s, board.d, DOOR_W + 3.2, 0.9);
      return sp ? { dir: board.d, at: sp.a0 + 0.9 } : null;
    })();
    if (!wallS) return;
    // 隠しの扉の前（出来てから開ける扉。印を置かない）
    const R0 = innerRect(s);
    const wc = wallS.dir === 0 ? R0.z1 : wallS.dir === 2 ? R0.z0 : wallS.dir === 1 ? R0.x1 : R0.x0;
    const secretFront: Rect = wallS.dir % 2 === 0
      ? { x0: wallS.at - 1.0, x1: wallS.at + 1.0, z0: Math.min(wc, wc + (wallS.dir === 0 ? -1.6 : 1.6)), z1: Math.max(wc, wc + (wallS.dir === 0 ? -1.6 : 1.6)) }
      : { z0: wallS.at - 1.0, z1: wallS.at + 1.0, x0: Math.min(wc, wc + (wallS.dir === 1 ? -1.6 : 1.6)), x1: Math.max(wc, wc + (wallS.dir === 1 ? -1.6 : 1.6)) };
    // 印の置き場所: 部屋の 4 隅と辺の真ん中から、開口・隠しの扉の前に掛からない所を 3〜4 か所（離れた所）
    const S = 1.2;
    const spots: [number, number][] = [];
    for (const fx of [0, 0.5, 1]) for (const fz of [0, 0.5, 1]) {
      if (fx === 0.5 && fz === 0.5) continue;
      const cx = r.x0 + S / 2 + (r.x1 - r.x0 - S) * fx, cz = r.z0 + S / 2 + (r.z1 - r.z0 - S) * fz;
      const rr: Rect = { x0: cx - S / 2 - 0.3, z0: cz - S / 2 - 0.3, x1: cx + S / 2 + 0.3, z1: cz + S / 2 + 0.3 };
      if (hitsDoorZones(s, rr, 1.4)) continue;
      if (rr.x0 < secretFront.x1 && rr.x1 > secretFront.x0 && rr.z0 < secretFront.z1 && rr.z1 > secretFront.z0) continue;
      spots.push([cx, cz]);
    }
    const want = s.kind === 'hall' && spots.length >= 4 ? 4 : 3;
    const pick: [number, number][] = [];
    for (const p of ctx.rng.shuffle(spots.slice())) if (pick.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 2.2)) { pick.push(p); if (pick.length >= want) break; }
    if (pick.length < 3) return;
    const COLORS: MatId[] = ['neonRed', 'lightGreen', 'neonBlue', 'lightYellow'];
    const COLOR_HEX = [0xff3b30, 0x5ee07a, 0x4aa8ff, 0xffd84a];
    const order = ctx.rng.shuffle([...pick.keys()]);
    const stations = pick.map(([cx, cz]) => aabbJson({ min: [cx - S / 2, y - 0.2, cz - S / 2], max: [cx + S / 2, y + 2.0, cz + S / 2] }));
    // 印の床の色の枠と、柱
    pick.forEach(([cx, cz], i) => {
      const m = COLORS[i]!;
      for (const [x0, z0, x1, z1] of [[-0.6, -0.6, 0.6, -0.5], [-0.6, 0.5, 0.6, 0.6], [-0.6, -0.5, -0.5, 0.5], [0.5, -0.5, 0.6, 0.5]] as const) ctx.addBox(box([cx + x0, y, cz + z0], [cx + x1, y + 0.008, cz + z1], m, false));
      // 柱は印の隅（真ん中に人が立てる）
      ctx.addBox(box([cx + 0.38, y, cz + 0.38], [cx + 0.5, y + 1.2, cz + 0.5], 'metalDark'));
    });
    // 壁の板: 見る人の左から右へ順に（壁 d に向かって立つと、右手は d = 0: -x / 1: +z / 2: +x / 3: -z）
    const F = wallFrame(innerRect(s), board.d);
    const rightSign = board.d === 0 || board.d === 3 ? -1 : 1;
    const plate = F.rect(board.at - 0.75, 0, board.at + 0.75, 0.02);
    ctx.addBox(box([plate.x0, y + 1.35, plate.z0], [plate.x1, y + 1.85, plate.z1], 'furnitureDark', false));
    order.forEach((st, k) => {
      const u = board.at + rightSign * (k - (order.length - 1) / 2) * 0.32;
      const q = F.rect(u - 0.1, 0.02, u + 0.1, 0.035);
      ctx.addBox(box([q.x0, y + 1.5, q.z0], [q.x1, y + 1.7, q.z1], COLORS[st]!, false));
    });
    const visit = ctx.addEntity('visit', { type: 'visitOrder', params: { stations, order, visitSec: ctx.tuning['ground.visit.stopSec'], colors: pick.map((_, i) => COLOR_HEX[i]!), posts: pick.map(([cx, cz]) => [cx + 0.44, y + 1.2, cz + 0.44]) } });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint(order.map((i) => ({ at: [pick[i]![0], y, pick[i]![1]], wait: ctx.tuning['ground.visit.stopSec'] + 0.3 })), { only: 'secret', doneIf: `${visit}.done` }) } });
    ctx.offerSecret({ hook: 'visit.order', modes: ['appear'], weight: 1.1, revealOutput: `${visit}.done`, doorway: { dir: wallS.dir, at: wallS.at, y, width: 1.0, height: 2.0 }, tell: '壁の板の色の並び' });
    for (const [cx, cz] of pick) ctx.keepOut({ min: [cx - S / 2 - 0.3, y - 0.1, cz - S / 2 - 0.3], max: [cx + S / 2 + 0.3, y + 3, cz + S / 2 + 0.3] });
  },
});
