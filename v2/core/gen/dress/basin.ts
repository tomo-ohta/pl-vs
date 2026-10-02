/**
 * 床に沈めた水槽（屋内プールの水面・プールの回廊の水路）と水たまり。
 *
 * v1 から移した「床の上に半透明の水の板（waterShallow）を敷き、扉前を四角く切り抜く」形は、切り抜いた所で水の縦の面が見え、
 * 床の目地が透けた四角い板が床に立っているように見えた。v2 では水を必ず囲う:
 *
 * - 床板（外殻の床のスラブ）を水槽の範囲 R だけ切り抜き、R の内側に縁（厚み BASIN.wall。上端は床と同じ高さの笠石）と、
 *   底（床から BASIN.depth 下）を作る。水面は床より BASIN.level 下（数 cm）。水は縁と底に囲われ、まわりのデッキ（床）は普通の高さ
 * - 深さ BASIN.depth はプレイヤーの登れる段差（PLAYER.step = 0.35 m）より浅いので、どこからでも歩いて上がれる（段は要らない）
 * - 水の箱は「底 .. 水面」（描画は上面だけ。水深 = 箱の高さで水の色の濃さが決まる）。水のゾーン（遅くなる）は水面の範囲と高さに合わせる
 * - 扉前・keepOut・予約・先に置かれていた物の所には作らない（水槽を切って、乾いた床の渡りにする）
 * - 床より下の箱は置く単位（Unit）を通さずに区画へ足す（到達の判定は床より下を見ない。深さが段差以下なので歩ける）。
 *   描画・地図・焼き込みの範囲に入るよう、区画の外形（cell.bounds）の下端を水槽の底まで下げる
 * - 水槽の箱には kind 'basin'（切った床板の残りは 'basinSlab'）を付ける（家具を変形する異変などが、床の造作として見分けられるように）
 * - 水槽の水面の範囲は c.basins に入れる。あとから床に置く物（底が床の近く）は水の上に置かれない（ctx.ts canPlace）
 */
import type { AABB } from '../../math/aabb.ts';
import type { Rect } from '../../world/footprint.ts';
import type { Box, MatId } from '../../world/layout.ts';
import { addDecor } from './decor.ts';
import type { DressCtx } from './ctx.ts';

/** 水槽の寸法（床からの高さ。床 = 0） */
export const BASIN = {
  /** 底の上面（床から下へ）。PLAYER.step（0.35 m）より浅くして、どこからでも歩いて上がれるようにする */
  depth: 0.3,
  /** 水面（床から下へ） */
  level: 0.06,
  /** 縁の厚み */
  wall: 0.15,
  /** 縁の上の笠石の高さ */
  coping: 0.04,
  /** 底の板の厚み */
  slab: 0.1,
} as const;

/** 水槽の縁・底の材質（プールのタイル）と笠石 */
const BASIN_MAT: MatId = 'floorTile';
const COPING_MAT: MatId = 'marbleWhite';
/** 水面として描く材質（描画は上面だけ。client/render/BoxShapes.ts の isWaterSurfaceMat と同じ組） */
export const WATER_SURFACE_MATS: ReadonlySet<MatId> = new Set<MatId>(['water', 'waterShallow']);

const area = (r: Rect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
const overlapRect = (a: Rect, b: Rect, eps = 1e-6): boolean => a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps;
const rectOfBox = (b: Box | AABB): Rect => ({ x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2] });
const grow = (r: Rect, d: number): Rect => ({ x0: r.x0 - d, z0: r.z0 - d, x1: r.x1 + d, z1: r.z1 + d });
const intersect = (a: Rect, b: Rect): Rect => ({ x0: Math.max(a.x0, b.x0), z0: Math.max(a.z0, b.z0), x1: Math.min(a.x1, b.x1), z1: Math.min(a.z1, b.z1) });

/** 矩形 a から矩形 b を引いた残り（最大 4 つ。minSide より細い切れ端は捨てる） */
export function subtractRect(a: Rect, b: Rect, minSide = 0.05): Rect[] {
  if (b.x1 <= a.x0 || b.x0 >= a.x1 || b.z1 <= a.z0 || b.z0 >= a.z1) return [a];
  const out: Rect[] = [];
  if (b.z0 > a.z0) out.push({ x0: a.x0, z0: a.z0, x1: a.x1, z1: b.z0 });
  if (b.z1 < a.z1) out.push({ x0: a.x0, z0: b.z1, x1: a.x1, z1: a.z1 });
  const z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  if (b.x0 > a.x0) out.push({ x0: a.x0, z0, x1: b.x0, z1 });
  if (b.x1 < a.x1) out.push({ x0: b.x1, z0, x1: a.x1, z1 });
  return out.filter((r) => r.x1 - r.x0 > minSide && r.z1 - r.z0 > minSide);
}

/** 区画にもう水面（水・浅い水）があるか（浸水の異変など。水槽を重ねない） */
export function hasWater(c: DressCtx): boolean {
  return c.cell.boxes.some((b) => WATER_SURFACE_MATS.has(b.mat));
}

/** 矩形 p から k の掛かる所を、x の向き（x に直交する帯ごと）か z の向きに切り除いた残り */
function cutBand(p: Rect, k: Rect, axis: 'x' | 'z'): Rect[] {
  const out: Rect[] = [];
  if (axis === 'x') {
    if (k.x0 > p.x0) out.push({ ...p, x1: Math.min(p.x1, k.x0) });
    if (k.x1 < p.x1) out.push({ ...p, x0: Math.max(p.x0, k.x1) });
  } else {
    if (k.z0 > p.z0) out.push({ ...p, z1: Math.min(p.z1, k.z0) });
    if (k.z1 < p.z1) out.push({ ...p, z0: Math.max(p.z0, k.z1) });
  }
  return out;
}

/**
 * 矩形 r の中で水槽にしてよい範囲（矩形の列）。扉前・keepOut・予約（c.zones）と、先に置かれていた物（当たる物と床の上の飾り）を
 * pad だけ広げて除く。除き方は、掛かる所を x の帯か z の帯ごと切る 2 通りのうち、残り（minSide 以上の物）の面積が広い方
 * （細い廊下は長い向きに切れて「扉の前は乾いた渡り」になり、広い水槽は端だけ削られる）
 */
export function basinAreas(c: DressCtx, r: Rect, pad = 0.25, minSide = 1.2): Rect[] {
  const blocks: Rect[] = [];
  for (const z of c.zones) if (z.min[1] < 0.5) blocks.push(grow(rectOfBox(z), pad));
  for (const b of c.fixed) blocks.push(grow(rectOfBox(b), pad));
  // 先に置かれていた床の上の飾り（仕掛けの印・床の模様など。床板と外殻は除く）
  for (const b of c.cell.boxes) {
    if (b.solid) continue;
    const y = b.min[1] - c.y0;
    if (y < -0.01 || y > 0.05) continue;
    blocks.push(grow(rectOfBox(b), pad));
  }
  // もう作った水槽（縁を含む）とは離す
  for (const w of c.basins) blocks.push(grow(w, BASIN.wall + 0.3));
  const ok = (q: Rect): boolean => q.x1 - q.x0 >= minSide && q.z1 - q.z0 >= minSide;
  let pieces = ok(r) ? [r] : [];
  for (const k of blocks) {
    pieces = pieces.flatMap((p) => {
      if (!overlapRect(p, k)) return [p];
      const ax = cutBand(p, k, 'x').filter(ok), az = cutBand(p, k, 'z').filter(ok);
      const sum = (l: Rect[]): number => l.reduce((a, q) => a + area(q), 0);
      return sum(ax) >= sum(az) ? ax : az;
    });
  }
  return pieces;
}

/** 床より下に掛かる箱（水槽の造作・水の中の物）を区画へ足す。高さは床から（置く単位を通さない）。kind が無ければ 'basin' */
export function addSunk(c: DressCtx, boxes: readonly Box[]): void {
  for (const b of boxes) {
    const w: Box = { ...b, min: [b.min[0], b.min[1] + c.y0, b.min[2]], max: [b.max[0], b.max[1] + c.y0, b.max[2]] };
    if (!w.kind) w.kind = 'basin';
    c.cell.boxes.push(w);
  }
  c.boxCount += boxes.length;
}

const flat = (r: Rect, y0: number, y1: number, mat: MatId, solid: boolean): Box => ({ min: [r.x0, y0, r.z0], max: [r.x1, y1, r.z1], mat, solid });

/**
 * 床に水槽を沈める（範囲 R は縁を含む。区画の床からの xz）。作れたら水面の範囲（縁の内側）を返す。
 * R が床板で埋まっていない（床の穴・別の床がある）・ほかの水槽に掛かる・小さすぎるときは作らない（null）
 */
export function sinkBasin(c: DressCtx, R: Rect, o: { slow?: number } = {}): Rect | null {
  const t = BASIN.wall;
  if (R.x1 - R.x0 < 2 * t + 0.9 || R.z1 - R.z0 < 2 * t + 0.9) return null;
  if (c.basins.some((w) => overlapRect(grow(w, t), R, -0.01))) return null;
  // 床板: 外殻の床のスラブ（当たる・上面が床・床より下へ厚みがある・印の無い箱。先に切った床板の残り 'basinSlab' も）
  const y0 = c.y0;
  const slabs = c.cell.boxes.filter((b) => b.solid && (!b.kind || b.kind === 'basinSlab') && !b.revealGroup && !b.concealGroup
    && Math.abs(b.max[1] - y0) < 1e-6 && b.min[1] < y0 - 0.05 && overlapRect(rectOfBox(b), R));
  const covered = slabs.reduce((a, b) => a + area(intersect(rectOfBox(b), R)), 0);
  if (covered < area(R) - 1e-4) return null;
  // ほかに R に掛かる、床より下・床の高さの物があれば作らない（床の穴の縁・仕掛けの床）
  for (const b of c.cell.boxes) {
    if (slabs.includes(b) || !overlapRect(rectOfBox(b), R)) continue;
    if (b.min[1] < y0 + 0.05 && b.max[1] > y0 - 0.5) return null;
  }
  // 床板を切る: 元の箱を残りの 1 つ目に縮め、残りは足す（区画の箱の並びを変えない）
  for (const s of slabs) {
    const rest = subtractRect(rectOfBox(s), R, 1e-4);
    const [first, ...more] = rest;
    if (!first) continue; // R は足跡の矩形の内側（壁の下の床板は残る）なので、ここには来ない
    const sy0 = s.min[1], sy1 = s.max[1];
    s.min = [first.x0, sy0, first.z0];
    s.max = [first.x1, sy1, first.z1];
    for (const q of more) c.cell.boxes.push({ ...s, min: [q.x0, sy0, q.z0], max: [q.x1, sy1, q.z1], kind: 'basinSlab' });
  }
  const W: Rect = { x0: R.x0 + t, z0: R.z0 + t, x1: R.x1 - t, z1: R.z1 - t };
  const yb = -BASIN.depth, ys = -BASIN.level, yc = -BASIN.coping, ybot = yb - BASIN.slab;
  // 縁（4 辺。重ならないように x の向きの辺を長く取る）と笠石・底・水
  const ring: Rect[] = [
    { x0: R.x0, z0: R.z0, x1: R.x1, z1: W.z0 }, { x0: R.x0, z0: W.z1, x1: R.x1, z1: R.z1 },
    { x0: R.x0, z0: W.z0, x1: W.x0, z1: W.z1 }, { x0: W.x1, z0: W.z0, x1: R.x1, z1: W.z1 },
  ];
  const B: Box[] = [];
  for (const q of ring) B.push(flat(q, ybot, yc, BASIN_MAT, true), flat(q, yc, 0, COPING_MAT, true));
  B.push(flat(W, ybot, yb, BASIN_MAT, true));
  B.push(flat(W, yb, ys, 'waterShallow', false));
  addSunk(c, B);
  c.zonesOut.push({ kind: 'water', aabb: { min: [W.x0, yb - 0.1, W.z0], max: [W.x1, ys + 0.1, W.z1] }, params: { slow: o.slow ?? 0.7, depth: ys - yb } });
  c.basins.push(W);
  // 区画の外形の下端を水槽の底まで下げる（描画・地図・焼き込みの範囲）
  c.cell.bounds.min[1] = Math.min(c.cell.bounds.min[1], y0 + ybot - 0.02);
  return W;
}

/** 水面の範囲 W の辺 side（0: z0 / 1: x1 / 2: z1 / 3: x0）の、位置 at（辺に沿った座標）に、水槽のはしご（縁を越えてデッキに下りる手すり + 水の中の踏み段）を足す */
export function basinLadder(c: DressCtx, W: Rect, side: 0 | 1 | 2 | 3, at: number, mat: MatId = 'stainless'): void {
  const t = BASIN.wall;
  const yb = -BASIN.depth, top = 0.62;
  const B: Box[] = [];
  // 辺の内向き: 水面の中へ（d > 0）。外向き: デッキへ（d < 0）
  const put = (a0: number, a1: number, d0: number, d1: number, y0: number, y1: number): void => {
    const lo = Math.min(d0, d1), hi = Math.max(d0, d1);
    switch (side) {
      case 0: B.push({ min: [a0, y0, W.z0 + lo], max: [a1, y1, W.z0 + hi], mat, solid: false }); return;
      case 2: B.push({ min: [a0, y0, W.z1 - hi], max: [a1, y1, W.z1 - lo], mat, solid: false }); return;
      case 3: B.push({ min: [W.x0 + lo, y0, a0], max: [W.x0 + hi, y1, a1], mat, solid: false }); return;
      default: B.push({ min: [W.x1 - hi, y0, a0], max: [W.x1 - lo, y1, a1], mat, solid: false });
    }
  };
  for (const s of [-0.25, 0.25]) {
    const a = at + s;
    put(a - 0.02, a + 0.02, 0.05, 0.09, yb + 0.02, top); // 水の中の柱
    put(a - 0.02, a + 0.02, -t - 0.25, 0.09, top - 0.04, top); // 縁を越える横の管
    put(a - 0.02, a + 0.02, -t - 0.25, -t - 0.21, 0, top); // デッキに下りる柱
  }
  for (const y of [yb + 0.1, yb + 0.2]) put(at - 0.23, at + 0.23, 0.02, 0.1, y, y + 0.025); // 踏み段
  addSunk(c, B);
}

/**
 * 水槽のまわりのデッキ（乾いた床）に水たまりを n 個まで置く（材質 'puddle'。描画は不定形の輪郭）。
 * 水面にも縁にも掛けない。当たらない飾りなので扉前に掛かってもよい
 */
export function poolsidePuddles(c: DressCtx, n: number): void {
  if (!c.basins.length) return;
  const placed: Rect[] = [];
  for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
    const W = c.rng.pick(c.basins);
    const side = c.rng.int(0, 3);
    const sx = c.rng.float(0.45, 1.3), sz = c.rng.float(0.35, 0.9);
    const off = BASIN.wall + c.rng.float(0.15, 0.9);
    const along = side % 2 === 0 ? c.rng.float(W.x0, W.x1) : c.rng.float(W.z0, W.z1);
    const [cx, cz] = side === 0 ? [along, W.z0 - off - sz / 2] : side === 2 ? [along, W.z1 + off + sz / 2] : side === 3 ? [W.x0 - off - sx / 2, along] : [W.x1 + off + sx / 2, along];
    const r: Rect = { x0: cx - sx / 2, z0: cz - sz / 2, x1: cx + sx / 2, z1: cz + sz / 2 };
    if (c.basins.some((w) => overlapRect(grow(w, BASIN.wall + 0.05), r)) || placed.some((q) => overlapRect(grow(q, 0.2), r))) continue;
    if (addDecor(c, [flat(r, 0.001, 0.004, 'puddle', false)])) { placed.push(r); k++; }
  }
}
