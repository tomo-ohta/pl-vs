/**
 * パズル（4.7 のパズル）その 2: 行き止まりの部屋の、部屋まるごとのパズル。解くと隠しの扉が現れる（出現型・必ず付ける）。
 *
 * - tilePicture PZ04 床のタイルの絵: 床の 3×3 の升目のタイルの絵がばらばら。タイルを持って別のタイルを調べると入れ替わる。
 *     絵がつながると扉。完成した絵は、別の部屋の壁に額に入って掛かっている
 * - shadowPuzzle PZ05 影絵: 壁際の強い灯りと、向かいの白い壁の扉の形の線。間に高さの同じ台が 3 つ。扉の形の切り抜きを
 *     どの台に置くかで、壁に落ちる影の大きさが変わる。影が線にぴったり重なると、影が扉になる
 * - mirrorPuzzle PZ06 鏡の光: 壁の穴から床の升目に沿って光の筋。柱に当たって止まっている。鏡（持てる物）を斜めに置くと
 *     光が曲がる（置いた人の向きに置かれる。45° 刻み）。光を奥の壁の目に届けると扉
 * - furnitureMatch PZ08 写真と同じ配置: 椅子・丸椅子・鉢植え・電気スタンド。壁の写真（上から見た部屋の図）と同じ所に置く
 * - balanceScale PZ09 天秤: 真ん中の天秤の両側の皿。重さの違う箱（点の数が重さ）。両側を同じ重さ（4 以上）にすると扉
 * - mazeModel PZ10 迷路の模型: 部屋の奥は天井までの迷路。手前の机に同じ迷路の模型と玉。机の辺に立つと模型が傾き、玉が転がる。
 *     模型の行き止まりの 1 つに穴があり、玉が落ちると、本物の迷路の同じ行き止まりに扉が現れる
 * - footPattern PZ12 足跡の模様: 床の 4×4 の升目。別の部屋の図の足跡の順に踏むと扉。違う升目を踏むと最初から
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W, type Box, type MatId } from '../../../world/layout.ts';
import { carveMaze, edgeKey, gridNeighbors, mazePath, openDegree, treeDistance } from '../maze.ts';
import { defineGimmick, type GimmickContext, type GimmickSlot } from '../types.ts';
import { doorZone, innerRect, wallFrame } from '../util.ts';
import { puzzleBase } from './puzzles.ts';
import { aabbJ, addClueBox, addItem, clueWall, floorSpots, freeSpans, keepClueFront, offer, onMainWall, snap, wallBox, wallPoint } from './util.ts';

/** 行き止まりの部屋（見本のフロアでは、脇の部屋の開口 2 つまで） */
const deadEnd = (s: GimmickSlot): boolean => (s.openings.length === 1 || (!!s.showcase && !s.main && s.openings.length === 2)) && s.openings.every((o) => onMainWall(s, o));

/** 手がかりの額（壁 w）に canvas の絵を掛ける */
function cluePicture(ctx: GimmickContext, name: string, draw: string, extra: { [k: string]: import('../../../world/layout.ts').Json }, avoid: Dir[], w0 = 0.8, h0 = 0.6): boolean {
  const w = clueWall(ctx, w0 + 0.2, { avoidDirs: avoid });
  if (!w) return false;
  addClueBox(ctx, w, wallBox(w.rect, w.dir, w.at, w0 / 2 + 0.05, w.y + 1.45 - h0 / 2 - 0.05, w.y + 1.45 + h0 / 2 + 0.05, 0.015, 'woodPanel'));
  keepClueFront(ctx, w, w0 / 2);
  const p = wallPoint(w.rect, w.dir, w.at, 0.02, w.y + 1.45);
  ctx.addEntity(name, { type: 'carryDecor', cell: w.cell, params: { view: 'canvas', draw, at: p, dir: w.dir, w: w0, h: h0, ...extra } });
  return true;
}

// ---------------------------------------------------------------- PZ04 タイルの絵
defineGimmick({
  id: 'tilePicture', name: 'タイルの絵', axes: ['puzzle', 'carry'], kinds: ['room'], minSize: [3.8, 4.2], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door, ent } = b;
    const N = 3, T = 0.62;
    // 升目: 部屋の真ん中（開口の前を避ける）
    const cx = snap((r.x0 + r.x1) / 2), cz = snap((r.z0 + r.z1) / 2);
    const area: Rect = { x0: cx - (N * T) / 2, x1: cx + (N * T) / 2, z0: cz - (N * T) / 2, z1: cz + (N * T) / 2 };
    const zones = s.openings.map((o) => doorZone(o, y, 1.4, 0.4));
    if (zones.some((z) => area.x0 < z.max[0] && area.x1 > z.min[0] && area.z0 < z.max[2] && area.z1 > z.min[2])) return;
    const seed = ctx.rng.int(0, 999);
    const slots: { pos: number[]; r: number; accept: string[]; want: string[]; yaw: number }[] = [];
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) slots.push({ pos: [area.x0 + (i + 0.5) * T, y, area.z0 + (k + 0.5) * T], r: 0.34, accept: ['tile'], want: [`tile.${k * N + i}`], yaw: 0 });
    // 置き場の枠（床に細い溝）
    ctx.addBox(box([area.x0 - 0.05, y, area.z0 - 0.05], [area.x1 + 0.05, y + 0.006, area.z1 + 0.05], 'metalDark', false));
    const grid = ctx.addEntity('grid', { type: 'carryReceiver', params: { slots, mark: false } });
    // ばらばら: 自分の升目に無い並べ方
    let perm: number[] = [];
    for (let tr = 0; tr < 50; tr++) { perm = ctx.rng.shuffle([...Array(N * N).keys()]); if (perm.every((p, i) => p !== i)) break; }
    perm.forEach((pic, at) => addItem(ctx, `tile${pic}`, slots[at]!.pos as Vec3, { half: [0.29, 0.02, 0.29], kind: 'tile', tag: `tile.${pic}`, mat: 'paintWhite', pic, picN: N, picSeed: seed, yaw: 0, throwable: false, snap: Math.PI / 2 }));
    cluePicture(ctx, 'painting', 'tiles', { picSeed: seed }, [ent.dir], 0.7, 0.7);
    offer(ctx, { hook: 'puzzle.tiles', modes: ['appear'], weight: 1, required: true, revealOutput: `${grid}.ok`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '額の中の絵' });
    ctx.keepOut({ min: [area.x0 - 0.8, y - 0.1, area.z0 - 0.8], max: [area.x1 + 0.8, y + 2.6, area.z1 + 0.8] });
  },
});

// ---------------------------------------------------------------- PZ05 影絵
defineGimmick({
  id: 'shadowPuzzle', name: '影絵の扉', axes: ['puzzle', 'light'], kinds: ['room', 'hall'], minSize: [3.8, 5.2], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.openings[0]!;
    // 影の壁（扉の壁）: 奥行き 4 m 以上の壁
    let pick: { d: Dir; at: number; D: number } | null = null;
    for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
      const F = wallFrame(r, d);
      if (F.depth < 4.2) continue;
      for (const sp of freeSpans(r, s.openings, d, 1.8, 0.8)) {
        // 灯りの位置（壁から D）が開口の前でない
        const D = F.depth - 0.5;
        const lp = wallPoint(r, d, sp.at, D, y);
        const zone = s.openings.map((o) => doorZone(o, y, 1.4, 0.6));
        if (zone.some((z) => lp[0] > z.min[0] && lp[0] < z.max[0] && lp[2] > z.min[2] && lp[2] < z.max[2])) continue;
        if (!pick || D > pick.D) pick = { d, at: sp.at, D };
      }
    }
    if (!pick) return;
    const { d, at, D } = pick;
    const lampH = y + 1.0;
    const lp = wallPoint(r, d, at, D, y);
    // 灯り（強い・低い）
    ctx.addBox(box([lp[0] - 0.15, y, lp[2] - 0.15], [lp[0] + 0.15, y + 0.05, lp[2] + 0.15], 'metalDark'));
    ctx.addBox(box([lp[0] - 0.02, y + 0.05, lp[2] - 0.02], [lp[0] + 0.02, lampH - 0.08, lp[2] + 0.02], 'metalDark'));
    ctx.addBox(box([lp[0] - 0.09, lampH - 0.09, lp[2] - 0.09], [lp[0] + 0.09, lampH + 0.09, lp[2] + 0.09], 'lightWarm', false));
    s.cell.lights.push({ pos: [lp[0], lampH, lp[2]], color: 0xfff0d0, intensity: 1.4, distance: D + 2 });
    // 台: 灯りと壁の間（灯りからの距離の割合）。正しい台の上の切り抜きの影が、扉と同じ大きさになる
    const fr = [0.3, 0.45, 0.62];
    const right = ctx.rng.int(0, 2);
    const dk = D * fr[right]!;
    const cutH = 2.0 * (dk / D), cutW = 1.0 * (dk / D);
    const top = y + 1.0 - cutH / 2;
    const peds = fr.map((f, i) => {
      const p = wallPoint(r, d, at, D * (1 - f), y);
      ctx.addBox(box([p[0] - 0.16, y, p[2] - 0.16], [p[0] + 0.16, top, p[2] + 0.16], 'marbleWhite'));
      return ctx.addEntity(`ped${i}`, { type: 'carryReceiver', params: { slots: [{ pos: [p[0], top, p[2]], r: 0.5, accept: ['cutout'], yaw: (d * Math.PI) / 2 }], mark: false } });
    });
    // 扉の形の線（壁の、扉が現れる所）
    const line = (a0: number, a1: number, y0: number, y1: number): Box => wallBox(r, d, (a0 + a1) / 2, (a1 - a0) / 2, y0, y1, 0.008, 'yellowLine');
    ctx.addBox(line(at - 0.5, at + 0.5, y + 1.98, y + 2.0));
    ctx.addBox(line(at - 0.5, at - 0.48, y, y + 2.0));
    ctx.addBox(line(at + 0.48, at + 0.5, y, y + 2.0));
    // 切り抜き（扉の形の板）: 床の別の所
    const spot = floorSpots(ctx, 1, { margin: 0.6, doorD: 1.6, avoid: [{ x0: Math.min(lp[0], wallPoint(r, d, at, 0, y)[0]) - 0.5, x1: Math.max(lp[0], wallPoint(r, d, at, 0, y)[0]) + 0.5, z0: Math.min(lp[2], wallPoint(r, d, at, 0, y)[2]) - 0.5, z1: Math.max(lp[2], wallPoint(r, d, at, 0, y)[2]) + 0.5 }] })?.[0];
    if (!spot) return;
    addItem(ctx, 'cutout', spot, { half: [cutW / 2, cutH / 2, 0.02], kind: 'cutout', tag: 'cutout', mat: 'furnitureDark', yaw: ctx.rng.float(-3, 3), snap: Math.PI / 2 });
    // 影（描くだけ）: 灯り・壁・切り抜き
    ctx.addEntity('shadow', { type: 'carryDecor', params: { view: 'shadow', lamp: [lp[0], lampH, lp[2]], wall: d, face: wallPoint(r, d, at, 0.005, y), item: `${ctx.id}.cutout`, at: wallPoint(r, d, at, 0.01, y + 1.0), dir: d } });
    offer(ctx, { hook: 'puzzle.shadow', modes: ['appear'], weight: 1, required: true, revealOutput: `${peds[right]}.count`, doorway: { dir: d, at, y, width: 1.0, height: 2.0 }, tell: '壁の扉の形の線' });
    const a = wallPoint(r, d, at - 0.8, 0, y), bb = wallPoint(r, d, at + 0.8, D + 0.4, y);
    ctx.keepOut({ min: [Math.min(a[0], bb[0]), y - 0.1, Math.min(a[2], bb[2])], max: [Math.max(a[0], bb[0]), y + 2.6, Math.max(a[2], bb[2])] });
    void ent;
  },
});

// ---------------------------------------------------------------- PZ06 鏡の光
defineGimmick({
  id: 'mirrorPuzzle', name: '鏡の光', axes: ['puzzle', 'light', 'carry'], kinds: ['room', 'hall'], minSize: [4.2, 4.8], weight: 0.25, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const C = 1.0;
    const nx = Math.floor((r.x1 - r.x0) / C), nz = Math.floor((r.z1 - r.z0) / C);
    if (nx < 4 || nz < 4) return;
    const o: Vec3 = [snap(r.x0 + ((r.x1 - r.x0) - nx * C) / 2), y, snap(r.z0 + ((r.z1 - r.z0) - nz * C) / 2)];
    const cellC = (i: number, k: number): Vec3 => [o[0] + (i + 0.5) * C, y, o[2] + (k + 0.5) * C];
    const ent = s.openings[0]!;
    const entZone = doorZone(ent, y, 1.6, 0.4);
    const nearDoor = (i: number, k: number): boolean => { const c = cellC(i, k); return c[0] > entZone.min[0] - 0.5 && c[0] < entZone.max[0] + 0.5 && c[2] > entZone.min[2] - 0.5 && c[2] < entZone.max[2] + 0.5; };
    // 壁の升目: 向き d の壁に接する升目と、その壁の向き。0:+x 1:+z 2:-x 3:-z の筋の向き
    const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const edge = (side: number): { i: number; k: number }[] => {
      const out: { i: number; k: number }[] = [];
      if (side === 0) for (let k = 0; k < nz; k++) out.push({ i: 0, k });
      if (side === 2) for (let k = 0; k < nz; k++) out.push({ i: nx - 1, k });
      if (side === 1) for (let i = 0; i < nx; i++) out.push({ i, k: 0 });
      if (side === 3) for (let i = 0; i < nx; i++) out.push({ i, k: nz - 1 });
      return out;
    };
    // 筋の向き → 光源の壁の Dir（筋が +x へ進むなら -X の壁から）
    const srcWall = (dir: number): Dir => (dir === 0 ? 3 : dir === 2 ? 1 : dir === 1 ? 2 : 0);
    let plan: { src: [number, number, number]; tgt: [number, number]; tgtWall: Dir; mirrors: [number, number][]; yaws: number[]; path: Set<number> } | null = null;
    for (let tr = 0; tr < 60 && !plan; tr++) {
      const dir0 = ctx.rng.int(0, 3);
      const starts = edge(dir0).filter((c) => !nearDoor(c.i, c.k));
      if (!starts.length) continue;
      const st = ctx.rng.pick(starts);
      // 1 枚か 2 枚の鏡で曲げて、別の壁の升目に届く道
      const turns = ctx.rng.int(1, 2);
      let i = st.i, k = st.k, d = dir0;
      const path = new Set<number>([k * nx + i]);
      const mirrors: [number, number][] = [];
      const yaws: number[] = [];
      let ok = true;
      for (let t = 0; t <= turns && ok; t++) {
        const [dx, dz] = STEP[d]!;
        // 進む升目の数: 最後は壁まで、途中は 1〜残り
        let maxRun = 0;
        while (i + dx * (maxRun + 1) >= 0 && i + dx * (maxRun + 1) < nx && k + dz * (maxRun + 1) >= 0 && k + dz * (maxRun + 1) < nz) maxRun++;
        if (maxRun < 1) { ok = false; break; }
        const run = t === turns ? maxRun : ctx.rng.int(1, Math.max(1, maxRun - 1));
        for (let m = 0; m < run; m++) { i += dx; k += dz; if (path.has(k * nx + i)) { ok = false; break; } path.add(k * nx + i); }
        if (!ok) break;
        if (t < turns) {
          mirrors.push([i, k]);
          const nd = ctx.rng.chance(0.5) ? (d + 1) % 4 : (d + 3) % 4;
          // 鏡の面の法線は（出る向き − 入る向き）。向き yaw の物の前は (-sin yaw, -cos yaw)
          const nxm = STEP[nd]![0] - STEP[d]![0], nzm = STEP[nd]![1] - STEP[d]![1];
          yaws.push(Math.atan2(-nxm, -nzm));
          d = nd;
        }
      }
      if (!ok) continue;
      // 届く先: 最後の升目の、進む向きの壁
      const tgtWall = srcWall((d + 2) % 4);
      if (nearDoor(i, k) || tgtWall === srcWall(dir0) && Math.abs(i - st.i) + Math.abs(k - st.k) < 2) continue;
      if (mirrors.some(([a, c]) => nearDoor(a, c))) continue;
      plan = { src: [st.i, st.k, dir0], tgt: [i + STEP[d]![0], k + STEP[d]![1]], tgtWall, mirrors, yaws, path };
    }
    if (!plan) return;
    // 柱: 光源からまっすぐ進んだ先（最初の鏡の 1 つ先）と、道の外に少し
    const blocks: number[] = [];
    {
      const [mi, mk] = plan.mirrors[0]!;
      const [dx, dz] = STEP[plan.src[2]]!;
      const bi = mi + dx, bk = mk + dz;
      if (bi >= 0 && bk >= 0 && bi < nx && bk < nz && !plan.path.has(bk * nx + bi)) blocks.push(bk * nx + bi);
    }
    // 鏡を置く升目のまわり（8 近傍）には柱を置かない（斜めに立って置けるように）
    const nearMirror = (i: number, k: number): boolean => plan!.mirrors.some(([a, c]) => Math.abs(a - i) <= 1 && Math.abs(c - k) <= 1);
    if (blocks.length && nearMirror(blocks[0]! % nx, Math.floor(blocks[0]! / nx))) blocks.length = 0;
    for (let tr = 0; tr < 30 && blocks.length < 3; tr++) {
      const i = ctx.rng.int(0, nx - 1), k = ctx.rng.int(0, nz - 1);
      const c = k * nx + i;
      if (plan.path.has(c) || blocks.includes(c) || nearDoor(i, k) || nearMirror(i, k) || i === 0 || k === 0 || i === nx - 1 || k === nz - 1) continue;
      blocks.push(c);
    }
    for (const c of blocks) {
      const p = cellC(c % nx, Math.floor(c / nx));
      ctx.addBox(box([p[0] - 0.22, y, p[2] - 0.22], [p[0] + 0.22, y + s.cell.height, p[2] + 0.22], 'columnConcrete'));
    }
    // 光源（壁の光る穴）と、届く先の目（壁）。届く先の横に扉
    const sp = cellC(plan.src[0], plan.src[1]);
    const sW = srcWall(plan.src[2]);
    const along = (w: Dir, p: Vec3): number => (w % 2 === 0 ? p[0] : p[2]);
    ctx.addBox(wallBox(r, sW, along(sW, sp), 0.12, y + 0.88, y + 1.12, 0.06, 'lightYellow'));
    const tW = plan.tgtWall;
    const tAt = along(tW, cellC(Math.min(nx - 1, Math.max(0, plan.tgt[0])), Math.min(nz - 1, Math.max(0, plan.tgt[1]))));
    ctx.addBox(wallBox(r, tW, tAt, 0.14, y + 0.86, y + 1.14, 0.03, 'screenDark'));
    // 扉: 目の横（壁の区間の中で目から 1.0 m）
    const tspan = freeSpans(r, s.openings, tW, 1.2, 0.8).find((x) => x.a0 <= tAt + 1e-6 && x.a1 >= tAt - 1e-6) ?? freeSpans(r, s.openings, tW, 1.2, 0.8)[0];
    if (!tspan) return;
    const doorAt = Math.min(Math.max(tAt + (tAt + 1.1 <= tspan.a1 ? 1.1 : -1.1), tspan.a0 + 0.55), tspan.a1 - 0.55);
    const slots: { pos: number[]; r: number; accept: string[] }[] = [];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (!blocks.includes(k * nx + i)) { const c = cellC(i, k); slots.push({ pos: [c[0], y, c[2]], r: 0.5, accept: ['mirror'] }); }
    ctx.addEntity('floor', { type: 'carryReceiver', params: { slots, mark: false } });
    // 解き方（試験と調整用）: 鏡の升目と向き
    const solution = plan.mirrors.map(([i, k], j) => [i, k, plan!.yaws[j]!]);
    const beam = ctx.addEntity('beam', { type: 'beamGrid', params: { origin: [...o], cell: C, nx, nz, h: 1.0, blocks, source: plan.src, target: plan.tgt, eye: wallPoint(r, tW, tAt, 0.04, y + 1.0), solution } });
    // 鏡: 道の外の升目に、まっすぐ（光を止める向き）
    const free: number[] = [];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const c = k * nx + i; if (!plan.path.has(c) && !blocks.includes(c) && !nearDoor(i, k)) free.push(c); }
    const n = plan.mirrors.length + 1;
    if (free.length < n) return;
    ctx.rng.shuffle(free).slice(0, n).forEach((c, j) => addItem(ctx, `mirror${j}`, cellC(c % nx, Math.floor(c / nx)), { half: [0.2, 0.32, 0.06], kind: 'mirror', tag: 'mirror', mat: 'metalDark', yaw: 0, snap: Math.PI / 4, throwable: false }));
    offer(ctx, { hook: 'puzzle.mirror', modes: ['appear'], weight: 1, required: true, revealOutput: `${beam}.hit`, doorway: { dir: tW, at: doorAt, y, width: 1.0, height: 2.0 }, tell: '壁の暗い目' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- PZ08 写真と同じ配置
const FURN: { kind: string; half: Vec3; mat: MatId }[] = [
  { kind: 'chair', half: [0.22, 0.43, 0.22], mat: 'woodPanel' }, { kind: 'stool', half: [0.18, 0.3, 0.18], mat: 'plasticRed' },
  { kind: 'plant', half: [0.18, 0.42, 0.18], mat: 'plantLeaf' }, { kind: 'lamp', half: [0.17, 0.6, 0.17], mat: 'whiteFabric' },
];

defineGimmick({
  id: 'furnitureMatch', name: '写真と同じ配置', axes: ['puzzle', 'carry'], kinds: ['room'], minSize: [3.8, 4.4], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door, ent } = b;
    const n = 3;
    const kinds = ctx.rng.shuffle(FURN.slice()).slice(0, n);
    const all = floorSpots(ctx, n * 2, { margin: 0.6, gap: 1.15, doorD: 1.8 });
    if (!all) return;
    const targets = all.slice(0, n), starts = all.slice(n);
    const slots = kinds.map((k, i) => ({ pos: targets[i]!, r: 0.55, accept: ['furn'], want: [`furn.${k.kind}`], yaw: 0 }));
    const room = ctx.addEntity('layout', { type: 'carryReceiver', params: { slots, mark: false } });
    kinds.forEach((k, i) => addItem(ctx, `furn${i}`, starts[i]!, { half: k.half, kind: k.kind, tag: `furn.${k.kind}`, mat: k.mat, yaw: (ctx.rng.int(0, 3) * Math.PI) / 2 }));
    // 写真（この部屋の壁。上から見た部屋の図: 写真の壁が上、左右は写真を見て左右）
    const pw = ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => d !== door.d)).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 1.0, 0.6)[0] })).find((x) => x.sp);
    if (!pw) return;
    ctx.addBox(wallBox(r, pw.d, pw.sp!.at, 0.42, y + 1.18, y + 1.72, 0.015, 'woodPanel'));
    const F = wallFrame(r, pw.d);
    const right = pw.d === 2 || pw.d === 1 ? 1 : -1;
    const toImg = (p: Vec3): [number, number] => {
      const u = F.u(p[0], p[2]), v = F.v(p[0], p[2]);
      const fu = (u - F.u0) / (F.u1 - F.u0);
      return [right > 0 ? fu : 1 - fu, v / F.depth];
    };
    const marks = kinds.map((k, i) => [k.kind, ...toImg(targets[i]!)]);
    const e0 = toImg([ent.pos[0], y, ent.pos[2]]), d0 = toImg(wallPoint(r, door.d, door.at, 0, y));
    ctx.addEntity('photo', { type: 'carryDecor', params: { view: 'canvas', draw: 'plan', at: wallPoint(r, pw.d, pw.sp!.at, 0.02, y + 1.45), dir: pw.d, w: 0.8, h: 0.5, marks, ent: e0, door: d0, aspect: (F.u1 - F.u0) / F.depth } });
    offer(ctx, { hook: 'puzzle.layout', modes: ['appear'], weight: 1, required: true, revealOutput: `${room}.ok`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '色あせた部屋の写真' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- PZ09 天秤
defineGimmick({
  id: 'balanceScale', name: '天秤', axes: ['puzzle', 'carry'], kinds: ['room'], minSize: [3.8, 4.4], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const { y, r, door } = b;
    const s = ctx.slot;
    // 天秤: 部屋の真ん中（長い向きに、両側の皿は 1.7 m 離す）。両端は壁から 1.0 m 以上空ける（回り込んで扉へ行ける）
    const cx0 = snap((r.x0 + r.x1) / 2), cz0 = snap((r.z0 + r.z1) / 2);
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    if ((alongX ? r.x1 - r.x0 : r.z1 - r.z0) < 2.45 + 2.0) return;
    const c: Vec3 = [cx0, y, cz0];
    const along: [number, number] = alongX ? [1, 0] : [0, 1];
    const pan = (sg: number): Vec3 => [c[0] + along[0] * sg * 0.85, y, c[2] + along[1] * sg * 0.85];
    const L = pan(-1), R = pan(1);
    for (const p of [L, R, c]) {
      if (s.openings.some((o) => { const z = doorZone(o, y, 1.5, 0.5); return p[0] > z.min[0] - 0.5 && p[0] < z.max[0] + 0.5 && p[2] > z.min[2] - 0.5 && p[2] < z.max[2] + 0.5; })) return;
    }
    ctx.addBox(box([c[0] - 0.1, y, c[2] - 0.1], [c[0] + 0.1, y + 1.2, c[2] + 0.1], 'goldTrim'));
    const pans = [L, R].map((p, i) => {
      ctx.addBox(box([p[0] - 0.36, y, p[2] - 0.36], [p[0] + 0.36, y + 0.5, p[2] + 0.36], 'woodPanel'));
      ctx.addBox(box([p[0] - 0.38, y + 0.5, p[2] - 0.38], [p[0] + 0.38, y + 0.53, p[2] + 0.38], 'goldTrim'));
      return ctx.addEntity(`pan${i}`, { type: 'carryReceiver', params: { region: aabbJ({ min: [p[0] - 0.4, y + 0.45, p[2] - 0.4], max: [p[0] + 0.4, y + 1.6, p[2] + 0.4] }), mark: false } });
    });
    const eq = ctx.addEntity('equal', { type: 'sameValue', params: {}, inputs: { a: `${pans[0]}.weight`, b: `${pans[1]}.weight` } });
    const heavy = ctx.addEntity('heavy', { type: 'threshold', params: { min: ctx.tuning['carry.balance.min'] - 1e-6 }, inputs: { in: `${pans[0]}.weight` } });
    const ok = ctx.addEntity('balanced', { type: 'and', params: {}, inputs: { a: `${eq}.out`, b: `${heavy}.out` } });
    ctx.addEntity('beam', { type: 'carryDecor', params: { view: 'balance', at: [c[0], y + 1.2, c[2]], dir: alongX ? 2 : 1, left: pans[0], right: pans[1] } });
    // 箱: 重さ 1〜4（上の点の数。大きさは重さと関係ない）
    const spots = floorSpots(ctx, 4, { margin: 0.6, gap: 0.8, doorD: 1.6, avoid: [{ x0: Math.min(L[0], R[0]) - 0.6, x1: Math.max(L[0], R[0]) + 0.6, z0: Math.min(L[2], R[2]) - 0.6, z1: Math.max(L[2], R[2]) + 0.6 }] });
    if (!spots) return;
    const sizes = ctx.rng.shuffle([0.13, 0.15, 0.17, 0.19]);
    [1, 2, 3, 4].forEach((w, i) => addItem(ctx, `weight${w}`, spots[i]!, { half: [sizes[i]!, sizes[i]! * 0.8, sizes[i]!], kind: 'weight', tag: `weight.${w}`, mat: 'metalDark', weight: w, dots: w, yaw: 0 }));
    offer(ctx, { hook: 'puzzle.balance', modes: ['appear'], weight: 1, required: true, revealOutput: `${ok}.out`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '天秤の真ん中の針' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

/**
 * 迷路の模型の玉の道（氷の上のように、傾けた向きへ壁まで転がる。穴の升目に入ると落ちる）: start から hole への傾きの並び（升目の向き
 * 0:+i 1:+k 2:-i 3:-k）。届かなければ null
 */
export function slideSolve(nu: number, nv: number, open: ReadonlySet<string>, start: number, hole: number): number[] | null {
  const STEP: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const slide = (c: number, d: number): number => {
    let cur = c;
    for (;;) {
      const i = cur % nu, k = Math.floor(cur / nu);
      const ni = i + STEP[d]![0], nk = k + STEP[d]![1];
      if (ni < 0 || nk < 0 || ni >= nu || nk >= nv) return cur;
      const n = nk * nu + ni;
      if (!open.has(edgeKey(cur, n))) return cur;
      cur = n;
      if (cur === hole) return cur;
    }
  };
  const prev = new Map<number, [number, number]>([[start, [-1, -1]]]);
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    if (c === hole) break;
    for (let d = 0; d < 4; d++) {
      const n = slide(c, d);
      if (n === c || prev.has(n)) continue;
      prev.set(n, [c, d]);
      q.push(n);
    }
  }
  if (!prev.has(hole)) return null;
  const out: number[] = [];
  for (let c = hole; c !== start; c = prev.get(c)![0]) out.unshift(prev.get(c)![1]);
  return out;
}

// ---------------------------------------------------------------- PZ10 迷路の模型
defineGimmick({
  id: 'mazeModel', name: '迷路の模型', axes: ['puzzle', 'sight'], kinds: ['room', 'hall'], minSize: [4.2, 5.4], weight: 0.45, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.openings[0]!;
    const F = wallFrame(r, ent.dir);
    const ante = 2.6;
    const W = F.u1 - F.u0, Dm = F.depth - ante;
    const cellM = 1.5;
    const nu = Math.max(2, Math.round(W / cellM)), nv = Math.max(2, Math.round(Dm / cellM));
    if (nu * nv < 6 || W / nu < 1.25 || Dm / nv < 1.25) return;
    const cu = W / nu, cv = Dm / nv;
    // 迷路の升目（局所 u, v）。番号は k * nu + i（i: u の向き、k: v の向き。k = 0 が手前）
    const cellRect = (i: number, k: number): Rect => F.rect(F.u0 + i * cu, ante + k * cv, F.u0 + (i + 1) * cu, ante + (k + 1) * cv);
    const eu = F.u(ent.pos[0], ent.pos[2]);
    const startI = Math.min(nu - 1, Math.max(0, Math.floor((eu - F.u0) / cu)));
    const start = startI;
    let plan: { open: Set<string>; hole: number; wall: Dir; at: number } | null = null;
    for (let tr = 0; tr < 12 && !plan; tr++) {
      const open = carveMaze(nu, nv, start, ctx.rng.fork(`m${tr}`));
      const dist = treeDistance(nu, nv, open, [start]);
      // 穴: 外の壁に接する行き止まりのうち、入口からいちばん遠い（入口の壁でない）
      let best = -1, bd = -1, bw: Dir = 0, bat = 0;
      for (let c = 0; c < nu * nv; c++) {
        if (c === start || openDegree(nu, nv, open, c) !== 1) continue;
        const i = c % nu, k = Math.floor(c / nu);
        const rc = cellRect(i, k);
        const cands: [Dir, number][] = [];
        // 局所の向き: k = nv-1 は奥の壁、i = 0 / nu-1 は横の壁
        const back = ((ent.dir + 2) % 4) as Dir;
        const midU = F.u0 + (i + 0.5) * cu, midV = ante + (k + 0.5) * cv;
        if (k === nv - 1) cands.push([back, back % 2 === 0 ? (rc.x0 + rc.x1) / 2 : (rc.z0 + rc.z1) / 2]);
        for (const side of [0, 1, 2, 3] as Dir[]) {
          if (side === ent.dir || side === back) continue;
          const Fs = wallFrame(r, side);
          const p = F.point(midU, midV);
          if (Fs.v(p[0], p[1]) < cu * 0.6 + 0.05) cands.push([side, side % 2 === 0 ? p[0] : p[1]]);
        }
        for (const [w, at] of cands) {
          if (s.openings.some((o) => o.dir === w && Math.abs((w % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + DOOR_W / 2 + 0.6)) continue;
          if (dist[c]! > bd) { bd = dist[c]!; best = c; bw = w; bat = at; }
        }
      }
      // 玉が転がって届く行き止まりだけ（氷の迷路は届かない所がある）
      if (best >= 0 && mazePath(nu, nv, open, start, best) && slideSolve(nu, nv, open, start, best)) plan = { open, hole: best, wall: bw, at: bat };
    }
    if (!plan) return;
    const { open } = plan;
    // 仕切り（天井まで）: 迷路の中の閉じた辺と、手前の部屋との境（入口の升目だけ開ける）
    const H = s.cell.height, T = 0.1, mat = s.cell.palette.wall;
    const walls: Box[] = [];
    const seg = (u0: number, v0: number, u1: number, v1: number): void => { const q = F.rect(u0, v0, u1, v1); walls.push(box([q.x0, y, q.z0], [q.x1, y + H, q.z1], mat)); };
    for (let k = 0; k < nv; k++) for (let i = 1; i < nu; i++) if (!open.has(edgeKey(k * nu + i - 1, k * nu + i))) seg(F.u0 + i * cu - T / 2, ante + k * cv, F.u0 + i * cu + T / 2, ante + (k + 1) * cv);
    for (let k = 1; k < nv; k++) for (let i = 0; i < nu; i++) if (!open.has(edgeKey((k - 1) * nu + i, k * nu + i))) seg(F.u0 + i * cu, ante + k * cv - T / 2, F.u0 + (i + 1) * cu, ante + k * cv + T / 2);
    for (let i = 0; i < nu; i++) if (i !== startI) seg(F.u0 + i * cu, ante - T / 2, F.u0 + (i + 1) * cu, ante + T / 2);
    ctx.removeBoxes((bx) => !bx.solid && bx.mat === s.cell.palette.light && walls.some((w) => bx.min[0] < w.max[0] && bx.max[0] > w.min[0] && bx.min[2] < w.max[2] && bx.max[2] > w.min[2]));
    for (const w of walls) ctx.addBox(w);
    // 模型の机: 手前の部屋の真ん中（入口の升目の前を避けて、横へずらす）
    // 机: 4 辺のまわりに立てる（0.9 m 空ける）。入口から横へ離れた方（扉の前を空ける）
    const tw = 0.5, td = 0.4;
    const tu = [F.u0 + 1.4, F.u1 - 1.4].sort((a, b) => Math.abs(b - eu) - Math.abs(a - eu))[0]!;
    if (Math.abs(tu - eu) < 1.3) return;
    const tc = F.point(tu, 1.3);
    const alongX = ent.dir % 2 === 0;
    const table = alongX ? box([tc[0] - tw, y, tc[1] - td], [tc[0] + tw, y + 0.85, tc[1] + td], 'woodPanel') : box([tc[0] - td, y, tc[1] - tw], [tc[0] + td, y + 0.85, tc[1] + tw], 'woodPanel');
    if (s.openings.some((o) => { const z = doorZone(o, y, 1.4, 0.3); return table.min[0] < z.max[0] && table.max[0] > z.min[0] && table.min[2] < z.max[2] && table.max[2] > z.min[2]; })) return;
    ctx.addBox(table);
    // 模型（描くだけ）と玉（部品）。模型の升目は本物と同じ並び（u, v を机の上へ縮めて写す）
    const toWorld = (i: number, k: number): number[] => { const p = F.point(F.u0 + (i + 0.5) * cu, ante + (k + 0.5) * cv); return [p[0], p[1]]; };
    const cells = [...Array(nu * nv).keys()].map((c) => toWorld(c % nu, Math.floor(c / nu)));
    // 升目の向き（+i・+k）の世界の向き。机のそばの人の向きを升目の向きに直すのに使う
    const p00 = F.point(0, 0), p10 = F.point(1, 0), p01 = F.point(0, 1);
    const axes = [p10[0] - p00[0], p10[1] - p00[1], p01[0] - p00[0], p01[1] - p00[1]];
    const marble = ctx.addEntity('marble', { type: 'marbleModel', params: { nx: nu, nz: nv, open: [...open], start, hole: plan.hole, table: aabbJ(table), speed: 2.5, cells, axes } });
    offer(ctx, { hook: 'puzzle.mazeModel', modes: ['appear'], weight: 1, required: true, revealOutput: `${marble}.done`, doorway: { dir: plan.wall, at: plan.at, y, width: 1.0, height: 2.0 }, tell: '模型の行き止まりの小さな穴' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + H, r.z1] });
  },
});

// ---------------------------------------------------------------- PZ12 足跡の模様
defineGimmick({
  id: 'footPattern', name: '足跡の模様', axes: ['puzzle', 'floor'], kinds: ['room', 'hall'], minSize: [4.4, 4.8], weight: 0.3, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door, ent } = b;
    const N = 4, C = 0.8;
    const cx = snap((r.x0 + r.x1) / 2), cz = snap((r.z0 + r.z1) / 2);
    const o: Vec3 = [cx - (N * C) / 2, y, cz - (N * C) / 2];
    const area: Rect = { x0: o[0], x1: o[0] + N * C, z0: o[2], z1: o[2] + N * C };
    const zones = s.openings.map((op) => doorZone(op, y, 1.2, 0.3));
    if (zones.some((z) => area.x0 < z.max[0] && area.x1 > z.min[0] && area.z0 < z.max[2] && area.z1 > z.min[2])) return;
    // 模様: 入口に近い縁の升目から、隣へ 6〜8 歩（同じ升目を 2 度踏まない）
    const e0 = ent.pos;
    const edgeCells = [...Array(N * N).keys()].filter((c) => { const i = c % N, k = Math.floor(c / N); return i === 0 || k === 0 || i === N - 1 || k === N - 1; });
    edgeCells.sort((a, bb) => { const pa = [o[0] + ((a % N) + 0.5) * C, o[2] + (Math.floor(a / N) + 0.5) * C], pb = [o[0] + ((bb % N) + 0.5) * C, o[2] + (Math.floor(bb / N) + 0.5) * C]; return Math.hypot(pa[0]! - e0[0], pa[1]! - e0[2]) - Math.hypot(pb[0]! - e0[0], pb[1]! - e0[2]); });
    let pattern: number[] = [];
    const len = ctx.rng.int(6, 8);
    for (let tr = 0; tr < 40 && pattern.length < len; tr++) {
      const p = [edgeCells[ctx.rng.int(0, Math.min(2, edgeCells.length - 1))]!];
      while (p.length < len) {
        const nb = ctx.rng.shuffle(gridNeighbors(N, N, p[p.length - 1]!).filter((c) => !p.includes(c)));
        if (!nb.length) break;
        p.push(nb[0]!);
      }
      if (p.length >= len) pattern = p;
    }
    if (pattern.length < len) return;
    // 床の升目（薄い板。目地の線）
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
      const x0 = o[0] + i * C, z0 = o[2] + k * C;
      ctx.addBox(box([x0 + 0.03, y, z0 + 0.03], [x0 + C - 0.03, y + 0.008, z0 + C - 0.03], (i + k) % 2 ? 'marbleWhite' : 'floorTile', false));
    }
    const steps = ctx.addEntity('steps', { type: 'stepPattern', params: { origin: [...o], cell: C, nx: N, nz: N, pattern } });
    // 手がかり: 別の部屋の足跡の図（升目と入口の向き）
    cluePicture(ctx, 'feet', 'feet', { n: N, pattern, entDir: ent.dir }, [ent.dir], 0.6, 0.6);
    offer(ctx, { hook: 'puzzle.feet', modes: ['appear'], weight: 1, required: true, revealOutput: `${steps}.done`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '床の升目の、すり減った所' });
    ctx.keepOut({ min: [area.x0 - 0.5, y - 0.1, area.z0 - 0.5], max: [area.x1 + 0.5, y + 2.6, area.z1 + 0.5] });
  },
});
