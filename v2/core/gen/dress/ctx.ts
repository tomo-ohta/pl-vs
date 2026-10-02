/**
 * 中身を置く作業の文脈と、置いたあとの安全確認。v1 の「置く → 扉前を空ける（clearDoorways）→ 到達を確かめて取り消す」を
 * 1 か所にまとめた。
 *
 * - 作業中の箱は区画の床からの高さ（床 = 0）で持つ。finish で floorY を足して cell.boxes に入れる
 * - 置く単位（Unit）は「1 回の placeUnit に渡した箱の組」。当たる箱（solid）は 1 つずつ、扉前・keepOut・足跡の外・
 *   先に置いた物との重なりを見てから入れる（v1 RoomGenerator.placeUnit と同じ考え方）
 * - 最後に reachOpenings で開口どうしが歩いてつながるかを見る。だめなら v1 と同じく置いた物を外して取り消す。
 *   v1 は後から置いた物を順に外したが、ここでは置いた順に並べて「つながりを壊した最初の物」を二分探索で探して外し、
 *   それより後の物を戻して確かめ直す（8 回まで。それでもだめなら残りを外す）。物を外すほどつながりは良くなる、と見なす
 * - 乱数は渡された r.rng だけ。区画の id・テーマ・種類・大きさ・density で違いを出す（部屋 ID の直書きはしない）
 * - 床に沈めた水槽（basin.ts）は置く単位を通さずに区画へ直接足す（床より下なので到達に関係しない）。水面の範囲（basins）には
 *   床に置く物を置かない（canPlace）
 */
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import { rectArea, unionBounds, type Rect } from '../../world/footprint.ts';
import { WALL_T, type Box, type CellLayout, type WallOpening, type Zone } from '../../world/layout.ts';
import { reachOpenings } from '../reach.ts';
import { boxesOverlap, doorZones, hitsZone, innerFaces, innerRect, insideFootprint, insideRects, isFloorOpening, subtractIntervals, type Face } from './geom.ts';
import type { DressKind, DressKit, DressRoom } from './types.ts';

/** 家具を置かない扉前の奥行き（壁の室内面から。検査で見る 1.2 m より少し広く取り、扉の前に立てる余裕を残す） */
export const DOOR_CLEAR = 1.5;
/** 扉前の幅の余白（開口の両側） */
export const DOOR_PAD = 0.35;
/** 1 区画に足す箱の上限（描画の三角形と焼き込みの時間を抑える。v1 は 1 部屋 +300 の目安） */
export const MAX_BOXES = 1500;

/** 取り消しの単位（1 回の placeUnit に渡した箱の組。高さは床から） */
export interface Unit {
  boxes: Box[];
  /** 当たる箱を含むか（含まない物は到達に関係しないので取り消さない） */
  solid: boolean;
}

export interface DressCtx {
  room: DressRoom;
  cell: CellLayout;
  kind: DressKind;
  theme: string;
  /** 足跡（フロア座標の xz） */
  rects: Rect[];
  /** 足跡の外形 */
  bounds: Rect;
  /** 床面積（m²） */
  area: number;
  /** 天井の高さ（床から） */
  h: number;
  /** 床の高さ（フロア座標の y） */
  y0: number;
  rng: Rng;
  /** 物の多さ 0..1 */
  density: number;
  /** 壁の室内面 */
  faces: Face[];
  openings: WallOpening[];
  /** 扉前（床からの高さ） */
  doors: AABB[];
  /** 渡された keepOut（床からの高さ） */
  keepOut: AABB[];
  /** 当たる箱を置かない範囲（扉前 + keepOut + 間仕切りの通り抜けなど、作業中に足していく） */
  zones: AABB[];
  /** 先に置かれていた当たる箱（階段の段・仕掛けの物。床からの高さ） */
  fixed: Box[];
  units: Unit[];
  /** 足すゾーン（水面など。床からの高さ） */
  zonesOut: Zone[];
  /** 足した箱の数 */
  boxCount: number;
  /** 壁に付ける家具の壁からの離れ（壁の帯の出より前に出す。wallBands が更新する） */
  standoff: number;
  /**
   * 床に沈めた水槽の水面の範囲（basin.ts の sinkBasin が足す）。床に置く物（底が床から 0.05 m 未満の箱）はここに掛けない
   * （水の上に浮いて見えるので）。水の中・水面の物は sinkBasin の側で足す
   */
  basins: Rect[];
}

/** 箱の高さを床からの値にする / フロア座標に戻す */
const shiftY = (b: Box, dy: number): Box => ({ ...b, min: [b.min[0], b.min[1] + dy, b.min[2]], max: [b.max[0], b.max[1] + dy, b.max[2]] });
/** フロア座標の範囲を床からの高さにする */
const localAabb = (a: AABB, y0: number): AABB => ({ min: [a.min[0], a.min[1] - y0, a.min[2]], max: [a.max[0], a.max[1] - y0, a.max[2]] });

export function makeCtx(r: DressRoom): DressCtx {
  const cell = r.cell;
  const y0 = cell.floorY;
  const h = cell.height;
  const rects = cell.footprint.map((q) => ({ ...q }));
  const doors = doorZones(r.openings, y0, DOOR_CLEAR, DOOR_PAD);
  const keepOut = r.keepOut.map((a) => localAabb(a, y0));
  // 先に置かれていた当たる箱: 床板・天井板・外壁（矩形の内側に掛からない）を除いた物
  const insides = rects.map((q) => innerRect(q, WALL_T));
  const fixed: Box[] = [];
  for (const b of cell.boxes) {
    if (!b.solid) continue;
    const lb = shiftY(b, -y0);
    if (lb.max[1] <= 0.01 || lb.min[1] >= h - 0.01) continue;
    if (!insides.some((q) => lb.min[0] < q.x1 - 1e-4 && lb.max[0] > q.x0 + 1e-4 && lb.min[2] < q.z1 - 1e-4 && lb.max[2] > q.z0 + 1e-4)) continue;
    fixed.push(lb);
  }
  return {
    room: r, cell, kind: r.kind, theme: cell.theme ?? '', rects, bounds: unionBounds(rects), area: rects.reduce((a, q) => a + rectArea(q), 0),
    h, y0, rng: r.rng, density: Math.min(1, Math.max(0, r.density)), faces: innerFaces(rects), openings: r.openings.slice(),
    doors, keepOut, zones: [...doors, ...keepOut], fixed, units: [], zonesOut: [], boxCount: 0, standoff: 0.02, basins: [],
  };
}

/**
 * 当たる物を置かない範囲（v1 keepOutZones = 扉前 + 通り抜けの予約）: 開口の前（壁の室内面から depth）+ r.keepOut。
 * 高さは区画の床から（床 = 0）。中身を置く作業（makeCtx）はこれに間仕切りの通り抜けなどを足していく
 */
export function keepOutZones(r: DressRoom, depth = DOOR_CLEAR, pad = DOOR_PAD): AABB[] {
  const y0 = r.cell.floorY;
  return [...doorZones(r.openings, y0, depth, pad), ...r.keepOut.map((a) => localAabb(a, y0))];
}

/** 中身を置けないほど小さい区画（v2 フロアの曲がり角・廊下の切れ端。フロアの検証も 2.4 m 未満は見ない） */
export function tooSmall(c: DressCtx): boolean {
  const b = c.bounds;
  if (Math.max(b.x1 - b.x0, b.z1 - b.z0) < 2.4) return true;
  return !c.rects.some((q) => Math.min(q.x1 - q.x0, q.z1 - q.z0) - 2 * WALL_T >= 0.9);
}

// ---------------------------------------------------------------- 物の多さ

/** density で確率を伸び縮みする（0.5 で base のまま、0 で 1/4、1 で 1.75 倍。上限 1） */
export function dense(c: DressCtx, base: number): number {
  return Math.min(1, Math.max(0, base * (0.25 + 1.5 * c.density)));
}

export function maybe(c: DressCtx, base: number): boolean {
  return c.rng.chance(dense(c, base));
}

/** 列に並べる物（机・座席・棚）の埋まり方。0.5 でほぼ全部、廃墟・空き室（0 に近い）は 3 割ほど */
export function occupancy(c: DressCtx): number {
  return Math.min(1, 0.3 + 1.35 * c.density);
}

// ---------------------------------------------------------------- 置く

export interface PlaceOpts {
  /** 先に置いた当たる物との隙間（既定 0 = 接してよい） */
  gap?: number;
  /** 足跡の矩形の内側の余白（既定 WALL_T = 壁の室内面に付けてよい） */
  margin?: number;
  /** この unit だけで避ける範囲（床からの高さ） */
  avoid?: readonly AABB[];
}

/** 置けるか（置かない）。当たる箱は扉前・keepOut・足跡の外・先の物との重なりを、当たらない箱は足跡と高さの範囲を見る */
export function canPlace(c: DressCtx, boxes: readonly Box[], o: PlaceOpts = {}): boolean {
  if (!boxes.length || c.boxCount + boxes.length > MAX_BOXES) return false;
  const margin = o.margin ?? WALL_T;
  const gap = o.gap ?? 0;
  for (const b of boxes) {
    if (b.min[1] < -1e-3 || b.max[1] > c.h + 1e-3) return false;
    if (!(b.max[0] > b.min[0] && b.max[1] > b.min[1] && b.max[2] > b.min[2])) return false;
    if (b.min[1] < 0.05 && overWater(c, b)) return false;
    if (!b.solid) {
      if (!insideFootprint(c.rects, b)) return false;
      continue;
    }
    if (!insideRects(c.rects, b, margin)) return false;
    if (hitsZone(c.zones, b) || (o.avoid && hitsZone(o.avoid, b))) return false;
    for (const f of c.fixed) if (boxesOverlap(f, b, -1e-3)) return false;
    for (const u of c.units) {
      if (!u.solid) continue;
      for (const s of u.boxes) if (s.solid && boxesOverlap(s, b, gap - 1e-3)) return false;
    }
  }
  return true;
}

/** 箱の水平の範囲が沈めた水槽の水面（c.basins）に掛かるか（2 cm までの掛かりは見ない: 縁石の上の物） */
export function overWater(c: DressCtx, b: Box | AABB, eps = 0.02): boolean {
  return c.basins.some((w) => b.min[0] < w.x1 - eps && b.max[0] > w.x0 + eps && b.min[2] < w.z1 - eps && b.max[2] > w.z0 + eps);
}

/** 置けたら区画に足す（取り消しの 1 単位）。propGroup には区画の id を前に付けて、フロアの中で一意にする */
export function placeUnit(c: DressCtx, boxes: Box[], o: PlaceOpts = {}): boolean {
  if (!canPlace(c, boxes, o)) return false;
  for (const b of boxes) if (b.propGroup && !b.propGroup.startsWith(`${c.cell.id}/`)) b.propGroup = `${c.cell.id}/${b.propGroup}`;
  c.units.push({ boxes, solid: boxes.some((b) => b.solid) });
  c.boxCount += boxes.length;
  return true;
}

/** 箱の組を作って置く（作る関数に一時の配列を渡す） */
export function build(c: DressCtx, make: (B: Box[]) => void, o: PlaceOpts = {}): boolean {
  const tmp: Box[] = [];
  make(tmp);
  return tmp.length > 0 && placeUnit(c, tmp, o);
}

/** 作業の印（ここまでに置いた物の数）。revert で印のあとに置いた物を外す */
export function mark(c: DressCtx): number {
  return c.units.length;
}

export function revert(c: DressCtx, m: number): void {
  while (c.units.length > m) c.boxCount -= c.units.pop()!.boxes.length;
}

/** 範囲 a（margin だけ広げる）に、もう置いた当たる物か先に置かれていた当たる物が掛かるか（壁の飾りを家具の陰に貼らない） */
export function touchesSolid(c: DressCtx, a: AABB | Box, margin = 0): boolean {
  for (const u of c.units) if (u.solid) for (const b of u.boxes) if (b.solid && boxesOverlap(a, b, margin)) return true;
  return c.fixed.some((b) => boxesOverlap(a, b, margin));
}

/**
 * 列（axis の向きに a0..a1、横の範囲 c0..c1）から、当たる物を置かない範囲（c.zones: 扉前・keepOut・予約）に掛かる所を
 * pad だけ広げて除いた区間（minLen より短い切れ端は捨てる）。扉の前で列を切って通路にする
 * （v1 は扉に近い区切りを丸ごと除いていた）
 */
export function splitByZones(c: DressCtx, axis: 'x' | 'z', a0: number, a1: number, c0: number, c1: number, pad = 0.3, minLen = 1.0, solids = true): [number, number][] {
  const cuts: [number, number][] = [];
  const cut = (z: AABB, p: number): void => {
    const zc0 = axis === 'x' ? z.min[2] : z.min[0], zc1 = axis === 'x' ? z.max[2] : z.max[0];
    if (zc1 <= c0 + 1e-4 || zc0 >= c1 - 1e-4 || z.max[1] <= 0.02) return;
    const za0 = axis === 'x' ? z.min[0] : z.min[2], za1 = axis === 'x' ? z.max[0] : z.max[2];
    cuts.push([za0 - p, za1 + p]);
  };
  for (const z of c.zones) cut(z, pad);
  // 先に置いた当たる物（柱・受付・机）と、先に置かれていた物の所も切る（列が丸ごと置けなくなるのを防ぐ）
  if (solids) {
    for (const u of c.units) if (u.solid) for (const b of u.boxes) if (b.solid && b.max[1] > 0.36) cut(b, 0.1);
    for (const b of c.fixed) if (b.max[1] > 0.36) cut(b, 0.1);
  }
  return subtractIntervals(a0, a1, cuts, minLen);
}

/** 面 f に沿った帯（辺に沿って a0..a1、室内面から d0..d1）を、置かない範囲で切った区間 */
export function splitAlongFace(c: DressCtx, f: Face, a0: number, a1: number, d0: number, d1: number, pad = 0.3, minLen = 1.0): [number, number][] {
  const n0 = f.face + f.inward * d0, n1 = f.face + f.inward * d1;
  return splitByZones(c, f.horizontal ? 'x' : 'z', a0, a1, Math.min(n0, n1), Math.max(n0, n1), pad, minLen);
}

/** 当たる物を置かない範囲を足す（間仕切りの通り抜け・中央の通路など。床からの高さ） */
export function reserve(c: DressCtx, a: AABB): void {
  c.zones.push(a);
}

/**
 * (cx, cz) の近くで、make(x, z) の物が置ける所を渦巻き状に探して置く。置けた位置を返す（無ければ null）。
 * step 間隔で半径 maxR まで
 */
export function placeNear(c: DressCtx, cx: number, cz: number, make: (B: Box[], x: number, z: number) => void, step = 0.4, maxR = 3, o: PlaceOpts = {}): [number, number] | null {
  for (let ring = 0; ring * step <= maxR + 1e-6; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const x = cx + dx * step, z = cz + dz * step;
        if (build(c, (B) => make(B, x, z), o)) return [x, z];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- 仕上げ（到達の確認・取り消し・区画へ足す）

/**
 * 置いた物を区画に足す。床の高さの開口が 2 つ以上あれば reachOpenings で歩いてつながるかを見て、
 * 置く前よりつながりが悪くなっていたら、つながりを壊した物を外す（selectReachable）。高さは floorY を足してフロア座標に戻す
 */
export function finish(c: DressCtx): void {
  const world = c.units.map((u) => u.boxes.map((b) => shiftY(b, c.y0)));
  const keep = selectReachable(c, world);
  for (let i = 0; i < c.units.length; i++) if (keep[i]) for (const b of world[i]!) c.cell.boxes.push(b);
  for (const z of c.zonesOut) c.cell.zones.push({ ...z, aabb: { min: [z.aabb.min[0], z.aabb.min[1] + c.y0, z.aabb.min[2]], max: [z.aabb.max[0], z.aabb.max[1] + c.y0, z.aabb.max[2]] } });
}

/** 残す unit（true）。開口のつながりを置く前より悪くしない組を選ぶ */
function selectReachable(c: DressCtx, world: Box[][]): boolean[] {
  const all = c.units.map(() => true);
  const solidIdx = c.units.map((u, i) => (u.solid ? i : -1)).filter((i) => i >= 0);
  // 始まりは床の高さの開口（reachOpenings は 1 つ目の開口から見る）
  const doors = c.openings.filter((s) => isFloorOpening(s, c.y0));
  if (!solidIdx.length || doors.length < 2) return all;
  const blockedWith = (inc: ReadonlySet<number> | null): string[] => {
    const boxes = c.cell.boxes.slice();
    for (const i of solidIdx) if (!inc || inc.has(i)) for (const b of world[i]!) boxes.push(b);
    const res = reachOpenings({ footprint: c.rects, floorY: c.y0, boxes }, doors);
    return res ? res.blocked : [];
  };
  const full = blockedWith(null);
  if (!full.length) return all;
  const base = new Set(blockedWith(new Set()));
  if (full.every((id) => base.has(id))) return all; // 置く前から届かない開口だけ（置いた物のせいではない）
  const ok = (set: ReadonlySet<number>): boolean => blockedWith(set).every((id) => base.has(id));
  // accepted だけなら通る / accepted + rest では通らない、を保って、rest の中で最初に壊す物を二分探索で探して外す
  const accepted = new Set<number>();
  let rest = solidIdx.slice();
  for (let round = 0; round < 8 && rest.length; round++) {
    let lo = 0, hi = rest.length;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ok(new Set([...accepted, ...rest.slice(0, mid)]))) lo = mid;
      else hi = mid;
    }
    for (const i of rest.slice(0, lo)) accepted.add(i);
    rest = rest.slice(lo + 1);
    if (rest.length && ok(new Set([...accepted, ...rest]))) {
      for (const i of rest) accepted.add(i);
      rest = [];
    }
  }
  return c.units.map((u, i) => !u.solid || accepted.has(i));
}

/** 中身の作り方（DressCtx を受け取る）を DressKit にする: 文脈を作り、置き、到達を確かめて区画に足す */
export function kit(fn: (c: DressCtx) => void): DressKit {
  return (r: DressRoom): void => {
    const c = makeCtx(r);
    if (!tooSmall(c)) fn(c);
    finish(c);
  };
}
