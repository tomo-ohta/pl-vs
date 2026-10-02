/**
 * 部屋の形を作る道具: 区画の殻（床板・天井板・壁・天井の照明）の見分けと付け替え、天井を上げる・床に穴を開けて下げる、
 * 段・手すり・台・柱、照明、家具の部品をフロア座標へ上げる、区画の一部だけに中身を置く（subDress）。
 * 高さはすべてフロア座標（床 = cell.floorY）。家具の部品（core/gen/dress/props.ts …）は床 = 0 で作るので lift で上げる。
 */
import type { AABB } from '../../math/aabb.ts';
import type { Dir } from '../../math/vec.ts';
import { along, buildShell, footprintAABB, spanForOpening, wallSpans, type Rect } from '../../world/footprint.ts';
import { box, WALL_T, type Box, type CellLayout, type LightSpec, type MatId, type WallOpening } from '../../world/layout.ts';
import { doorFronts } from '../anomaly/util.ts';
import { unreachableSpot } from '../gimmicks/util.ts';
import { insideFootprint } from '../dress/geom.ts';
import { dressCell } from '../dress/index.ts';
import type { DressKind } from '../dress/types.ts';
import type { RoomShapeContext } from './types.ts';

export const snap = (v: number): number => Math.round(v * 20) / 20;
export const rectW = (r: Rect): number => r.x1 - r.x0;
export const rectD = (r: Rect): number => r.z1 - r.z0;
export const rectArea = (r: Rect): number => rectW(r) * rectD(r);
export const shrink = (r: Rect, m: number): Rect => ({ x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m });
export const rectOk = (r: Rect, min = 0.05): boolean => r.x1 - r.x0 > min && r.z1 - r.z0 > min;
/** 矩形の xz の重なり（eps だけ縮めて見る） */
export const rectsHit = (a: Rect, b: Rect, eps = 1e-3): boolean => a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps;
/** 箱の xz の範囲 */
export const footOf = (b: Box | AABB): Rect => ({ x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2] });
/** 矩形と高さの範囲の箱 */
export const rbox = (r: Rect, y0: number, y1: number, mat: MatId, solid = true): Box => box([r.x0, y0, r.z0], [r.x1, y1, r.z1], mat, solid);
export const rectCenter = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

// ---------------------------------------------------------------- 区画の殻の見分け

/** 区画の床板（足跡の矩形を覆う当たる板） */
export function isFloorSlab(cell: CellLayout, b: Box): boolean {
  return b.solid && Math.abs(b.max[1] - cell.floorY) < 1e-3 && b.min[1] < cell.floorY - 0.1 && b.max[1] - b.min[1] <= 0.25;
}

export function isCeilingSlab(cell: CellLayout, b: Box): boolean {
  return b.solid && Math.abs(b.min[1] - (cell.floorY + cell.height)) < 1e-3 && b.max[1] > cell.floorY + cell.height + 0.1;
}

/** 外壁の箱（足跡の矩形の辺の内側 WALL_T の帯にある当たる箱。開口の上のまぐさ・腰壁を含む） */
export function isWallBox(cell: CellLayout, b: Box): boolean {
  if (!b.solid || b.min[1] < cell.floorY - 1e-3 || b.max[1] > cell.floorY + cell.height + 1e-3) return false;
  const e = 1e-3;
  return cell.footprint.some((r) => {
    const inX = b.min[0] >= r.x0 - e && b.max[0] <= r.x1 + e, inZ = b.min[2] >= r.z0 - e && b.max[2] <= r.z1 + e;
    if (!inX || !inZ) return false;
    const thinX = b.max[0] - b.min[0] <= WALL_T + e, thinZ = b.max[2] - b.min[2] <= WALL_T + e;
    return (thinX && (Math.abs(b.min[0] - r.x0) < e || Math.abs(b.max[0] - r.x1) < e)) || (thinZ && (Math.abs(b.min[2] - r.z0) < e || Math.abs(b.max[2] - r.z1) < e));
  });
}

/** 天井の照明パネル（区画の殻が付けた物。部品で入切する照明は除く） */
export function isCeilingPanel(cell: CellLayout, b: Box): boolean {
  return !b.solid && b.mat === cell.palette.light && !b.kind?.startsWith('lamp:') && b.min[1] > cell.floorY + cell.height - 0.12 && b.max[1] <= cell.floorY + cell.height + 1e-3;
}

/** 天井の照明の点光源（殻の lightGrid が付けた物: 天井の 0.4 m 下） */
export function isGridLight(cell: CellLayout, l: LightSpec): boolean {
  return !l.lampId && Math.abs(l.pos[1] - (cell.floorY + cell.height - 0.4)) < 1e-3;
}

/** 天井の照明（パネルと点光源）を外す。pred を渡すと、その位置（xz）の物だけ */
export function clearCeilingLights(cell: CellLayout, pred: (x: number, z: number) => boolean = () => true): void {
  cell.boxes = cell.boxes.filter((b) => !(isCeilingPanel(cell, b) && pred((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2)));
  cell.lights = cell.lights.filter((l) => !(isGridLight(cell, l) && pred(l.pos[0], l.pos[2])));
}

/** 天井の照明パネル（下面の高さ y）と、任意で点光源（パネルの 0.4 m 下） */
export function panelLight(ctx: RoomShapeContext, x: number, z: number, y: number, w: number, d: number, light: number | null = null, mat: MatId = ctx.cell.palette.light): void {
  ctx.addBox(box([x - w / 2, y - 0.035, z - d / 2], [x + w / 2, y, z + d / 2], mat, false));
  if (light !== null) ctx.addLight({ pos: [x, y - 0.4, z], color: ctx.cell.palette.lightColor, intensity: ctx.cell.palette.lightIntensity * light, distance: 7 });
}

/**
 * 矩形の列に、天井の照明を格子に並べる（殻の lightGrid と同じ並べ方。点光源はパネル 2 枚に 1 つ）。ceilY は天井の下面
 */
export function lightGridAt(ctx: RoomShapeContext, rects: readonly Rect[], ceilY: number, spacing: number, mul = 1): void {
  let n = 0;
  for (const r of rects) {
    const w = rectW(r), d = rectD(r);
    if (w < 0.6 || d < 0.6) continue;
    const nx = Math.max(1, Math.round(w / spacing)), nz = Math.max(1, Math.round(d / spacing));
    const alongZ = d >= w;
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = r.x0 + (w / nx) * (i + 0.5), z = r.z0 + (d / nz) * (k + 0.5);
      const pw = Math.min(alongZ ? 0.6 : 1.2, w - 0.1), pd = Math.min(alongZ ? 1.2 : 0.6, d - 0.1);
      ctx.addBox(box([x - pw / 2, ceilY - 0.035, z - pd / 2], [x + pw / 2, ceilY - 0.005, z + pd / 2], ctx.cell.palette.light, false));
      if (n++ % 2 === 0) ctx.addLight({ pos: [x, ceilY - 0.4, z], color: ctx.cell.palette.lightColor, intensity: ctx.cell.palette.lightIntensity * mul, distance: spacing * 2.6 });
    }
  }
}

// ---------------------------------------------------------------- 足跡を変える

/**
 * 区画の殻（床板・天井板・外壁・天井の照明）を、新しい足跡 rects で作り直す（L 字・コの字・細長い部屋）。
 * 開口（扉・廊下とのつなぎ目・隠しの通り抜けの出口）はどれも、新しい足跡の外壁の上に収まっていること（でなければ何もせず false）。
 * 殻でない箱で新しい足跡の外に出る物は外す。照明は lightGrid と同じ並べ方（spacing）
 */
export function reshell(ctx: RoomShapeContext, rects: Rect[], spacing = 2.6): boolean {
  const cell = ctx.cell, fy = cell.floorY, h = cell.height;
  const spans = wallSpans(rects);
  for (const o of ctx.geo.openings) {
    const sp = spanForOpening(spans, o);
    if (!sp) return false;
    const a = along(o.dir, o.pos[0], o.pos[2]);
    if (a - o.width / 2 < sp.a0 + 0.05 || a + o.width / 2 > sp.a1 - 0.05) return false;
  }
  const old = cell.boxes.filter((b) => !(isFloorSlab(cell, b) || isCeilingSlab(cell, b) || isWallBox(cell, b) || isCeilingPanel(cell, b)));
  cell.lights = cell.lights.filter((l) => !isGridLight(cell, l));
  const shell: Box[] = [];
  buildShell(shell, rects, h, ctx.geo.openings, { floor: cell.palette.floor, wall: cell.palette.wall, ceiling: cell.palette.ceiling, yBase: fy });
  cell.boxes = [...shell, ...old.filter((b) => insideFootprint(rects, b))];
  cell.footprint = rects.map((r) => ({ ...r }));
  // 照明（lightGrid と同じ並べ方。細い矩形ではパネルを矩形の中に収める）
  lightGridAt(ctx, rects.map((q) => shrink(q, WALL_T)), fy + h, spacing);
  const fb = footprintAABB(rects, h, fy);
  cell.bounds = { min: [fb.min[0], Math.min(cell.bounds.min[1], fb.min[1]), fb.min[2]], max: [fb.max[0], Math.max(cell.bounds.max[1], fb.max[1]), fb.max[2]] };
  return true;
}

// ---------------------------------------------------------------- 天井を上げる・床を下げる

/**
 * 天井を newH（床から）まで上げる: 外壁・まぐさの上端を伸ばし、天井板と天井の照明を上へ移す。区画の外形の上の空きを確かめる（claim）。
 * 上げられなければ false
 */
export function raiseCeiling(ctx: RoomShapeContext, newH: number): boolean {
  const cell = ctx.cell, fy = cell.floorY, h = cell.height;
  const dh = newH - h;
  if (dh <= 1e-3) return true;
  if (!ctx.claim(fy + h, fy + newH + 0.2, unionRect(cell.footprint))) return false;
  const top = fy + h;
  for (const b of cell.boxes) {
    if (isCeilingSlab(cell, b) || isCeilingPanel(cell, b)) { b.min = [b.min[0], b.min[1] + dh, b.min[2]]; b.max = [b.max[0], b.max[1] + dh, b.max[2]]; continue; }
    if (b.solid && Math.abs(b.max[1] - top) < 1e-3 && b.min[1] >= fy - 1e-3 && isWallBox(cell, b)) b.max = [b.max[0], b.max[1] + dh, b.max[2]];
  }
  for (const l of cell.lights) if (isGridLight(cell, l)) l.pos = [l.pos[0], l.pos[1] + dh, l.pos[2]];
  cell.height = newH;
  cell.bounds = { min: [...cell.bounds.min], max: [cell.bounds.max[0], Math.max(cell.bounds.max[1], fy + newH + 0.2), cell.bounds.max[2]] };
  return true;
}

export function unionRect(rects: readonly Rect[]): Rect {
  return { x0: Math.min(...rects.map((r) => r.x0)), z0: Math.min(...rects.map((r) => r.z0)), x1: Math.max(...rects.map((r) => r.x1)), z1: Math.max(...rects.map((r) => r.z1)) };
}

/** 区画の床板に穴を開ける（穴の周りの 4 枚に切り分ける。床板は区画の殻の物） */
export function cutFloor(cell: CellLayout, hole: Rect): void {
  cutSlab(cell, hole, (b) => isFloorSlab(cell, b));
}

/** 区画の天井板に穴を開ける */
export function cutCeiling(cell: CellLayout, hole: Rect): void {
  cutSlab(cell, hole, (b) => isCeilingSlab(cell, b));
}

function cutSlab(cell: CellLayout, hole: Rect, isSlab: (b: Box) => boolean): void {
  const out: Box[] = [];
  for (const b of cell.boxes) {
    if (!isSlab(b) || !rectsHit(footOf(b), hole)) { out.push(b); continue; }
    const h0 = { x0: Math.max(b.min[0], hole.x0), x1: Math.min(b.max[0], hole.x1), z0: Math.max(b.min[2], hole.z0), z1: Math.min(b.max[2], hole.z1) };
    const put = (x0: number, z0: number, x1: number, z1: number): void => { if (x1 - x0 > 1e-3 && z1 - z0 > 1e-3) out.push({ ...b, min: [x0, b.min[1], z0], max: [x1, b.max[1], z1] }); };
    put(b.min[0], b.min[2], b.max[0], h0.z0);
    put(b.min[0], h0.z1, b.max[0], b.max[2]);
    put(b.min[0], h0.z0, h0.x0, h0.z1);
    put(h0.x1, h0.z0, b.max[0], h0.z1);
  }
  cell.boxes = out;
}

/**
 * 床を下げる: 穴 hole（壁の内側の矩形の中）の床板を切り、深さ depth の底と側壁を作る。部屋の壁に接する辺の側壁は壁の厚みの中
 * （穴の内側に 0.15 m の縁が床の高さに残らないように。gimmicks/pit.ts の pitShell と同じ）。区画の外形を下へ広げる（claim）。
 * 下げられなければ false。戻り値の inner は底を歩ける範囲
 */
export function sinkFloor(ctx: RoomShapeContext, hole: Rect, depth: number, o: { wallMat?: MatId; floorMat?: MatId } = {}): Rect | null {
  const cell = ctx.cell, y = cell.floorY, r = ctx.inner;
  if (!ctx.claim(y - depth - 0.25, y, hole)) return null;
  cutFloor(cell, hole);
  const mat = o.wallMat ?? cell.palette.wall;
  const t = 0.15;
  ctx.addBox(box([hole.x0, y - depth - 0.2, hole.z0], [hole.x1, y - depth, hole.z1], o.floorMat ?? cell.palette.floor));
  const at = { x0: Math.abs(hole.x0 - r.x0) < 1e-3, x1: Math.abs(hole.x1 - r.x1) < 1e-3, z0: Math.abs(hole.z0 - r.z0) < 1e-3, z1: Math.abs(hole.z1 - r.z1) < 1e-3 };
  const xa = at.x0 ? [hole.x0 - WALL_T, hole.x0] : [hole.x0, hole.x0 + t];
  const xb = at.x1 ? [hole.x1, hole.x1 + WALL_T] : [hole.x1 - t, hole.x1];
  const za = at.z0 ? [hole.z0 - WALL_T, hole.z0] : [hole.z0, hole.z0 + t];
  const zb = at.z1 ? [hole.z1, hole.z1 + WALL_T] : [hole.z1 - t, hole.z1];
  ctx.addBox(box([xa[0]!, y - depth - 0.2, za[0]!], [xa[1]!, y, zb[1]!], mat));
  ctx.addBox(box([xb[0]!, y - depth - 0.2, za[0]!], [xb[1]!, y, zb[1]!], mat));
  ctx.addBox(box([xa[1]!, y - depth - 0.2, za[0]!], [xb[0]!, y, za[1]!], mat));
  ctx.addBox(box([xa[1]!, y - depth - 0.2, zb[0]!], [xb[0]!, y, zb[1]!], mat));
  return { x0: xa[1]!, x1: xb[0]!, z0: za[1]!, z1: zb[0]! };
}

// ---------------------------------------------------------------- 段・手すり・台

/** 向き d の単位ベクトル [x, z]（0:+Z 1:+X 2:-Z 3:-X） */
export const dxz = (d: Dir): [number, number] => (d === 0 ? [0, 1] : d === 1 ? [1, 0] : d === 2 ? [0, -1] : [-1, 0]);

export interface StairOpts {
  /** 上り始め（いちばん下の段の手前の辺）の中心 */
  x: number;
  z: number;
  /** 上る向き */
  dir: Dir;
  width: number;
  /** 下の床・上の床の高さ */
  y0: number;
  y1: number;
  /** 1 段の高さの上限・踏み面 */
  riseMax: number;
  tread: number;
  mat: MatId;
  /** 段を宙に浮いた薄い板にする（下が空く。天井から下がる階段）。厚み */
  thin?: number;
  /** 手すり: 両側 'both' / 左右どちらか（上る向きに見て 'left' | 'right'）/ 無し */
  rails?: 'both' | 'left' | 'right' | 'none';
  railMat?: MatId;
}

export interface Stair { rect: Rect; steps: number; top: Rect; run: number }

/** 上る向き d・幅 w の段の並びで、上り始めから a..b（上る向きの距離）の矩形 */
export function stairRect(o: Pick<StairOpts, 'x' | 'z' | 'dir' | 'width'>, a: number, b: number): Rect {
  const [ux, uz] = dxz(o.dir);
  const hw = o.width / 2;
  const p0x = o.x + ux * a, p0z = o.z + uz * a, p1x = o.x + ux * b, p1z = o.z + uz * b;
  return ux !== 0 ? { x0: Math.min(p0x, p1x), x1: Math.max(p0x, p1x), z0: o.z - hw, z1: o.z + hw } : { x0: o.x - hw, x1: o.x + hw, z0: Math.min(p0z, p1z), z1: Math.max(p0z, p1z) };
}

/** 段の数（n 段で上がりきる。最後の段の上面 = y1） */
export function stepCount(rise: number, riseMax: number): number {
  return Math.max(1, Math.ceil(rise / riseMax - 1e-9));
}

/**
 * まっすぐな段（kind 'roomStep'。廊下の階段の区画の 'stairStep' とは分ける: 上の台は 'landing' にして歩く人が上の面として見る）。段は下の床から積んだ箱（thin なら宙に浮いた薄い板）。最後の段の上面が y1。
 * 手すりは段鼻の線に沿った傾いた棒（描画だけ）と、段の外側の当たる柵（落ちない）
 */
export function stairs(ctx: RoomShapeContext, o: StairOpts): Stair {
  const rise = o.y1 - o.y0;
  const n = stepCount(rise, o.riseMax);
  const rs = rise / n;
  for (let i = 0; i < n; i++) {
    const r = stairRect(o, i * o.tread, (i + 1) * o.tread);
    const top = o.y0 + rs * (i + 1);
    const b = rbox(r, o.thin ? top - o.thin : o.y0, top, o.mat);
    b.kind = 'roomStep';
    ctx.addBox(b);
  }
  const run = n * o.tread;
  const rect = stairRect(o, 0, run);
  const rails = o.rails ?? 'both';
  if (rails !== 'none') {
    const [ux, uz] = dxz(o.dir);
    // 上る向きに見て左右（左 = 上る向きを 90° 左へ回した向き）
    const left: [number, number] = [-uz, ux];
    const sides: (1 | -1)[] = rails === 'both' ? [1, -1] : rails === 'left' ? [1] : [-1];
    const mat = o.railMat ?? 'handrailWood';
    for (const s of sides) {
      const off = s * (o.width / 2 - 0.04);
      const cx = o.x + left[0] * off, cz = o.z + left[1] * off;
      // 傾いた棒: 最初の段鼻の 1 段手前（0.9 m の高さ）から最後の段鼻まで
      const a0 = -0.0, a1 = run;
      const y0 = o.y0 + 0.9, y1 = o.y0 + 0.9 + rise;
      const along = ux !== 0;
      const lo = Math.min(cx + ux * a0, cx + ux * a1), hi = Math.max(cx + ux * a0, cx + ux * a1);
      const zlo = Math.min(cz + uz * a0, cz + uz * a1), zhi = Math.max(cz + uz * a0, cz + uz * a1);
      const bar: Box = along ? box([lo, y0 - 0.05, cz - 0.025], [hi, y0, cz + 0.025], mat, false) : box([cx - 0.025, y0 - 0.05, zlo], [cx + 0.025, y0, zhi], mat, false);
      // 低い端は上り始めの側（上る向きが負なら max の側が低い）
      const positive = (along ? ux : uz) > 0;
      bar.min = [bar.min[0], positive ? y0 - 0.05 : y1 - 0.05, bar.min[2]];
      bar.max = [bar.max[0], positive ? y0 : y1, bar.max[2]];
      bar.slope = { axis: along ? 'x' : 'z', rise: positive ? y1 - y0 : -(y1 - y0) };
      ctx.addBox(bar);
      // 支柱（段の上。当たらない細い柱）
      for (let i = 0; i < n; i += 3) {
        const a = (i + 0.5) * o.tread;
        const px = cx + ux * a, pz = cz + uz * a;
        const top = o.y0 + rs * (i + 1);
        ctx.addBox(box([px - 0.02, top, pz - 0.02], [px + 0.02, top + 0.88, pz + 0.02], 'metalDark', false));
      }
    }
  }
  return { rect, steps: n, top: stairRect(o, run, run + 0.01), run };
}

/**
 * 穴の底（歩ける範囲 P・底の高さ yb）から縁（高さ yt）へ上がる段: 穴の壁沿いに 1 本、穴の角の方へ上る（上の段から横へ縁に出られる）。
 * 段の下の端の先は 0.9 m 空ける。sides: 段を沿わせてよい穴の壁（その向こうが縁の床の壁）。置けなければ null
 */
export function pitStair(ctx: RoomShapeContext, P: Rect, yb: number, yt: number, sides: readonly Dir[], o: { width?: number; mat?: MatId; riseMax?: number; tread?: number } = {}): (Stair & { side: Dir; dir: Dir; foot: Rect }) | null {
  const w = o.width ?? 0.9, riseMax = o.riseMax ?? 0.24, tread = o.tread ?? 0.3;
  const n = stepCount(yt - yb, riseMax);
  const run = n * tread;
  const cands: { side: Dir; dir: Dir; x: number; z: number; foot: Rect }[] = [];
  for (const side of sides) {
    const alongX = side === 0 || side === 2;
    const len = alongX ? rectW(P) : rectD(P);
    if (run + 0.9 > len) continue;
    const c = side === 2 ? P.z0 + w / 2 : side === 0 ? P.z1 - w / 2 : side === 3 ? P.x0 + w / 2 : P.x1 - w / 2;
    if (alongX) {
      cands.push({ side, dir: 1, x: P.x1 - run, z: c, foot: { x0: P.x1 - run - 0.9, x1: P.x1 - run, z0: c - w / 2, z1: c + w / 2 } });
      cands.push({ side, dir: 3, x: P.x0 + run, z: c, foot: { x0: P.x0 + run, x1: P.x0 + run + 0.9, z0: c - w / 2, z1: c + w / 2 } });
    } else {
      cands.push({ side, dir: 0, x: c, z: P.z1 - run, foot: { x0: c - w / 2, x1: c + w / 2, z0: P.z1 - run - 0.9, z1: P.z1 - run } });
      cands.push({ side, dir: 2, x: c, z: P.z0 + run, foot: { x0: c - w / 2, x1: c + w / 2, z0: P.z0 + run, z1: P.z0 + run + 0.9 } });
    }
  }
  if (!cands.length) return null;
  const k = ctx.rng.pick(cands);
  const st = stairs(ctx, { x: k.x, z: k.z, dir: k.dir, width: w, y0: yb, y1: yt, riseMax, tread, mat: o.mat ?? ctx.cell.palette.floor, rails: 'both', railMat: 'metal' });
  return { ...st, side: k.side, dir: k.dir, foot: k.foot };
}

/**
 * 下の床（穴の底・水の底）の、どこからでも段の足元 from へ歩いて行けるか（閉じ込めない）。blocks: 底で体を塞ぐ物の足跡。
 * 家具 furniture（当たる箱）のうち底の上で体に掛かる物も塞ぐ物として見て、行けない所があれば家具を外して確かめ直す
 * （外した家具の箱を返す。家具を全部外しても行けなければ null）
 */
export function clearBottom(area: Rect, yb: number, blocks: readonly Rect[], from: [number, number], furniture: Box[]): Box[] | null {
  const solid = (b: Box): boolean => b.solid && b.min[1] < yb + 1.6 && b.max[1] > yb + 0.3;
  const groupKey = (b: Box): Box | string => b.propGroup ?? b;
  let fb = furniture.filter(solid);
  const removed: Box[] = [];
  for (let round = 0; round < 6; round++) {
    const spot = unreachableSpot(area, [...blocks, ...fb.map(footOf)], from);
    if (spot === null) return removed;
    if (spot === 'start') return null;
    if (!fb.length) return null;
    // 行けない所にいちばん近い家具の物（組）を外す。3 回目からは全部
    const near = round >= 2 ? fb : [fb.slice().sort((a, b) => Math.hypot((a.min[0] + a.max[0]) / 2 - spot[0], (a.min[2] + a.max[2]) / 2 - spot[1]) - Math.hypot((b.min[0] + b.max[0]) / 2 - spot[0], (b.min[2] + b.max[2]) / 2 - spot[1]))[0]!];
    const keys = new Set(near.map(groupKey));
    for (const b of furniture) if (keys.has(groupKey(b))) removed.push(b);
    fb = fb.filter((b) => !keys.has(groupKey(b)));
  }
  return unreachableSpot(area, [...blocks, ...fb.map(footOf)], from) === null ? removed : null;
}

/**
 * 当たる柵（手すり）: 線分（軸に平行）x0,z0 → x1,z1 の上に、床 y から高さ h。当たり判定は描かない箱 1 つ（跳んでも越えない高さ）、
 * 見た目は上の棒・中の棒・支柱
 */
export function railing(ctx: RoomShapeContext, x0: number, z0: number, x1: number, z1: number, y: number, o: { h?: number; mat?: MatId; posts?: number } = {}): void {
  const h = o.h ?? 1.05, mat = o.mat ?? 'metalDark';
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const lo = alongX ? Math.min(x0, x1) : Math.min(z0, z1), hi = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  if (hi - lo < 0.05) return;
  const c = alongX ? z0 : x0;
  const put = (a0: number, a1: number, y0: number, y1: number, t: number, m: MatId, solid: boolean, kind?: string): void => {
    const b = alongX ? box([a0, y0, c - t], [a1, y1, c + t], m, solid) : box([c - t, y0, a0], [c + t, y1, a1], m, solid);
    if (kind) b.kind = kind;
    ctx.addBox(b);
  };
  put(lo, hi, y, y + h, 0.04, mat, true, 'colliderOnly');
  put(lo, hi, y + h - 0.05, y + h, 0.025, mat, false);
  put(lo, hi, y + h * 0.5 - 0.02, y + h * 0.5 + 0.02, 0.012, mat, false);
  const pitch = o.posts ?? 1.2;
  const n = Math.max(1, Math.round((hi - lo) / pitch));
  for (let i = 0; i <= n; i++) {
    const a = lo + ((hi - lo) * i) / n;
    put(Math.max(lo, a - 0.02), Math.min(hi, a + 0.02), y, y + h - 0.05, 0.02, mat, false);
  }
}

/**
 * 台（床板 + 下の支え）。top は上面、thick は板の厚み。supports: 支柱の間隔（0 なら下まで詰めた箱）。
 * postsSolid: 支柱を当たる物にするか（既定 true。水の中の板の道は当たらない細い支柱にして、下の水を歩いて回れるようにする）
 */
export function platform(ctx: RoomShapeContext, r: Rect, top: number, o: { thick?: number; mat?: MatId; under?: MatId; supports?: number; base?: number; postsSolid?: boolean } = {}): void {
  const thick = o.thick ?? 0.15;
  const base = o.base ?? ctx.cell.floorY;
  const mat = o.mat ?? ctx.cell.palette.floor;
  if (!o.supports) {
    ctx.addBox(rbox(r, base, top - thick, o.under ?? ctx.cell.palette.wall));
    ctx.addBox(rbox(r, top - thick, top, mat));
    return;
  }
  ctx.addBox(rbox(r, top - thick, top, mat));
  const p = o.supports;
  const nx = Math.max(1, Math.round(rectW(r) / p)), nz = Math.max(1, Math.round(rectD(r) / p));
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
    if (i > 0 && i < nx && k > 0 && k < nz) continue;
    const x = Math.min(r.x1 - 0.06, Math.max(r.x0 + 0.06, r.x0 + (rectW(r) * i) / nx)), z = Math.min(r.z1 - 0.06, Math.max(r.z0 + 0.06, r.z0 + (rectD(r) * k) / nz));
    ctx.addBox(box([x - 0.05, base, z - 0.05], [x + 0.05, top - thick, z + 0.05], o.under ?? 'metalDark', o.postsSolid ?? true));
  }
}

/** 柱（四角）。mat は柱の材質、cap があれば天井の下に台輪 */
export function column(ctx: RoomShapeContext, x: number, z: number, size: number, y0: number, y1: number, mat: MatId = 'columnConcrete', cap: MatId | null = null): void {
  const s = size / 2;
  ctx.addBox(box([x - s, y0, z - s], [x + s, y1, z + s], mat));
  if (cap) {
    ctx.addBox(box([x - s - 0.08, y1 - 0.18, z - s - 0.08], [x + s + 0.08, y1, z + s + 0.08], cap, false));
    ctx.addBox(box([x - s - 0.05, y0, z - s - 0.05], [x + s + 0.05, y0 + 0.12, z + s + 0.05], cap, false));
  }
}

// ---------------------------------------------------------------- 開口の前

/** 開口の前の空けておく範囲（フロア座標。anomaly/util の doorFronts と同じ形） */
export function doorZonesOf(ctx: RoomShapeContext, depth = 1.5, pad = 0.35): AABB[] {
  return doorFronts(ctx.cell, ctx.geo.openings, depth, pad);
}

/** 矩形が開口の前の範囲に掛からないか */
export function clearOfDoors(ctx: RoomShapeContext, r: Rect, depth = 1.5, pad = 0.35): boolean {
  return !doorZonesOf(ctx, depth, pad).some((z) => rectsHit(r, footOf(z)));
}

/** 開口の内向きの単位ベクトル [x, z]（開口の dir は外向き） */
export const inwardOf = (o: WallOpening): [number, number] => (o.dir === 0 ? [0, -1] : o.dir === 1 ? [-1, 0] : o.dir === 2 ? [0, 1] : [1, 0]);

/** 開口の前の矩形（壁の外面から内側へ depth、幅は開口 + 両側 pad） */
export function frontRect(o: WallOpening, depth: number, pad = 0.3): Rect {
  const hw = o.width / 2 + pad;
  const [x, z] = [o.pos[0], o.pos[2]];
  switch (o.dir) {
    case 0: return { x0: x - hw, x1: x + hw, z0: z - depth, z1: z };
    case 2: return { x0: x - hw, x1: x + hw, z0: z, z1: z + depth };
    case 1: return { x0: x - depth, x1: x, z0: z - hw, z1: z + hw };
    default: return { x0: x, x1: x + depth, z0: z - hw, z1: z + hw };
  }
}

/** 開口の前の点（内側へ d） */
export function frontPt(o: WallOpening, d: number): [number, number] {
  const [ix, iz] = inwardOf(o);
  return [o.pos[0] + ix * d, o.pos[2] + iz * d];
}

/** 開口が壁 dir（外向き）にあるか */
export const onWall = (o: WallOpening, d: Dir): boolean => o.dir === d;

/** 部屋の主な向き: 入口から出口へ（出口が無ければ長い辺の向き） */
export function mainAxisOf(ctx: RoomShapeContext): 'x' | 'z' {
  const a = ctx.entrance, b = ctx.exit;
  if (b) {
    const dx = Math.abs(b.pos[0] - a.pos[0]), dz = Math.abs(b.pos[2] - a.pos[2]);
    if (Math.abs(dx - dz) > 0.5) return dx > dz ? 'x' : 'z';
  }
  if (a.dir === 1 || a.dir === 3) return 'x';
  if (a.dir === 0 || a.dir === 2) return rectD(ctx.inner) >= rectW(ctx.inner) * 0.6 ? 'z' : 'x';
  return rectW(ctx.inner) >= rectD(ctx.inner) ? 'x' : 'z';
}

/**
 * 到達の目印: 壁 d（主の矩形の壁）の位置 at に、穴の無い開口を足す（段の足元・上り口）。区画の中身は開口の前を空け、
 * 開口どうしが歩いてつながるように置くので、目印の前（壁から 0.9 m）まで床から歩いて行けるようになる。壁は切らない
 */
export function reachMark(ctx: RoomShapeContext, d: Dir, at: number): void {
  const R = ctx.rect;
  const pos: [number, number, number] = d === 0 ? [at, ctx.fy, R.z1] : d === 2 ? [at, ctx.fy, R.z0] : d === 1 ? [R.x1, ctx.fy, at] : [R.x0, ctx.fy, at];
  const n = ctx.geo.openings.filter((o) => o.id.startsWith(`${ctx.id}.reach`)).length;
  ctx.geo.openings.push({ id: `${ctx.id}.reach${n}`, pos, dir: d, width: 0.9, height: 2.0 });
}

/** 開口の無い壁の向き（主の矩形の 4 辺のうち） */
export function freeWalls(ctx: RoomShapeContext): Dir[] {
  return ([0, 1, 2, 3] as Dir[]).filter((d) => !ctx.geo.openings.some((o) => o.dir === d));
}

/** 壁 d の室内面の座標と、内側への符号 */
export function wallFace(r: Rect, d: Dir): { coord: number; sg: 1 | -1 } {
  // r は壁の内側の矩形
  return d === 0 ? { coord: r.z1, sg: -1 } : d === 1 ? { coord: r.x1, sg: -1 } : d === 2 ? { coord: r.z0, sg: 1 } : { coord: r.x0, sg: 1 };
}

// ---------------------------------------------------------------- 家具の部品

/** 床 = 0 で作った箱の組をフロア座標の高さ dy へ上げ、propGroup を区画の中で一意にする */
export function lift(B: Box[], cellId: string, dy: number, tag?: string): Box[] {
  for (const b of B) {
    b.min = [b.min[0], b.min[1] + dy, b.min[2]];
    b.max = [b.max[0], b.max[1] + dy, b.max[2]];
    if (b.propGroup && !b.propGroup.startsWith(`${cellId}/`)) b.propGroup = `${cellId}/${tag ? `${tag}-` : ''}${b.propGroup}`;
  }
  return B;
}

/** 部品（床 = 0 で作る関数）を、高さ dy に置く */
export function prop(ctx: RoomShapeContext, dy: number, make: (B: Box[]) => void, tag = 'shape'): Box[] {
  const B: Box[] = [];
  make(B);
  lift(B, ctx.cell.id, dy, tag);
  for (const b of B) ctx.addBox(b);
  return B;
}

/**
 * 区画の一部（rects・床の高さ floorY）だけに、区画の中身（家具）を置く。置いた箱を返す（ctx の区画に足すのは呼ぶ側）。
 * 先に置いた当たる物（この形の箱）は避ける。openings は、その範囲の開口（本物の開口と、内側の壁の通り抜け）。
 * プールの作り（床に水槽を沈める）は使わない（汎用の部屋にする）
 */
export function subDress(ctx: RoomShapeContext, o: { rects: Rect[]; floorY?: number; height?: number; openings: WallOpening[]; keepOut?: AABB[]; kind?: DressKind; theme?: string; tag: string; noHung?: boolean }): { boxes: Box[]; zones: CellLayout['zones'] } {
  const cell = ctx.cell;
  const fy = o.floorY ?? cell.floorY;
  const h = o.height ?? cell.height;
  const U = unionRect(o.rects);
  const fixed = cell.boxes.filter((b) => b.solid && b.max[1] > fy + 0.01 && b.min[1] < fy + h - 0.01 && rectsHit(footOf(b), U));
  const theme = o.theme ?? (cell.theme === 'PoolCorridor' ? 'GenericRoom' : cell.theme ?? 'GenericRoom');
  const temp: CellLayout = {
    ...cell, footprint: o.rects.map((r) => ({ ...r })), floorY: fy, height: h, bounds: footprintAABB(o.rects, h, fy),
    boxes: fixed.slice(), lights: [], zones: [], theme,
  };
  dressCell({ cell: temp, kind: o.kind ?? (ctx.geo.kind === 'hall' ? 'hall' : 'room'), openings: o.openings, keepOut: o.keepOut ?? [], rng: ctx.rng.fork(`dress:${o.tag}`), density: 0.5 });
  let boxes = temp.boxes.slice(fixed.length);
  // 天井から下がる物（吊り照明など、上端が仮の天井に届く物）は外す（本当の天井はもっと高い・低い）
  if (o.noHung) {
    const hung = new Set(boxes.filter((b) => b.max[1] > fy + h - 0.06 && b.min[1] > fy + 0.3).map((b) => b.propGroup ?? b));
    boxes = boxes.filter((b) => !hung.has(b.propGroup ?? b));
  }
  for (const b of boxes) if (b.propGroup && !b.propGroup.includes(`/${o.tag}-`)) b.propGroup = b.propGroup.replace(`${cell.id}/`, `${cell.id}/${o.tag}-`);
  return { boxes, zones: temp.zones };
}

/** subDress の結果を区画に足し、区画の中身を置かないことにする */
export function useDress(ctx: RoomShapeContext, d: { boxes: Box[]; zones: CellLayout['zones'] }): void {
  for (const b of d.boxes) ctx.addBox(b);
  for (const z of d.zones) ctx.addZone(z);
  ctx.skipDress();
}

/** 迷路の作り（壁が造作。天井を変える・中身を置き直す形は掛けない） */
export const MAZE_THEMES: ReadonlySet<string> = new Set(['MazeGrid', 'ServiceMaze']);
/** 水のある作り（プール） */
export const WET_THEMES: ReadonlySet<string> = new Set(['PoolCorridor']);
