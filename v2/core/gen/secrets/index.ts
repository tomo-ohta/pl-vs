/**
 * 隠し発見の仕組み（v2-plan.md 4.3）: 仕掛けが差し出した隠しの元（SecretOffer）に、隠し場所を付ける。
 *
 * - 入口は仕掛けの区画の壁の扉（開けるまで先は見えない）。存在型は壁と同じ色の扉が最初からある（見えにくいだけ）/
 *   出現型は入口を concealGroup の箱で塞ぎ、reveal 部品を裏の振る舞いの出力（offer.revealOutput）につなぐ（壁が消えると扉が現れる）
 * - 行き先（調整表 secrets.dest.*）:
 *     rareRoom    行き止まりのレア部屋（入口のすぐ先）
 *     passageRare 隠し通路（まっすぐ / 1 回曲がる）の先にレア部屋
 *     loop        隠し通路がフロアの別の部屋へ抜ける（通り抜け。出口は壁と同じ色の扉。出現型の出口は通路の側からしか開かない）
 *     floorLink   穴のある部屋（落ちると 2 つ先のフロア）
 *     bFloor      穴のある部屋（落ちると裏のフロア）
 *   置けない行き先は、通り抜け → 通路の先の部屋 → 入口のすぐ先の部屋 の順に小さくして試す
 * - レア部屋の種類（調整表 secrets.rare.*）: 区画の中身（core/gen/dress）がテーマで中身を置く。白い私室・長椅子の部屋・穴の部屋は、ここで中身を決める
 * - 隠し場所の区画は入るまで暗い（入ると灯り、点いたまま）
 * - 区画を作れなければ null（その隠しは付けない）
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { Dir } from '../../math/vec.ts';
import { doorPanel, lightPanel, makeCell, opening, portal, portalAabb } from '../../world/build.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type EntitySpec, type FloorExit, type Palette, type PortalSpec, type WallOpening } from '../../world/layout.ts';
import { themePalette } from '../../world/palettes.ts';
import type { DressKind } from '../dress/types.ts';
import type { GeoCell } from '../floor/geometry.ts';
import type { SecretMode, SecretOffer } from '../gimmicks/types.ts';

export type SecretDest = 'rareRoom' | 'passageRare' | 'loop' | 'floorLink' | 'bFloor';
export const SECRET_DESTS: readonly SecretDest[] = ['rareRoom', 'passageRare', 'loop', 'floorLink', 'bFloor'];
/** 行き止まりでない行き先（通り抜け・別のフロアへの穴） */
export const THROUGH_DESTS: ReadonlySet<SecretDest> = new Set<SecretDest>(['loop', 'floorLink', 'bFloor']);

export type RareKind = 'white' | 'theater' | 'pool' | 'gallery' | 'library' | 'machine' | 'play' | 'garden' | 'chapel' | 'nook';

export interface RareDef {
  id: RareKind;
  name: string;
  /** 区画のテーマ（中身の作り方を選ぶ。core/gen/dress の THEME_KITS） */
  theme: string;
  /** パレットの上書き（照明の色・明るさ・材質） */
  palette: Partial<Palette>;
  /** 中身をここで決める（区画の中身の作り方を使わない） */
  fixed: boolean;
  /** 最小の大きさ（奥行き・幅） */
  min: [number, number];
}

/** レア部屋の種類（増やすときはここと調整表 secrets.rare.* に足す） */
export const RARE_DEFS: readonly RareDef[] = [
  { id: 'white', name: '白い私室', theme: 'Gallery', fixed: true, min: [4.2, 4.4], palette: { wall: 'paintWhite', floor: 'marbleWhite', ceiling: 'paintWhite', lightColor: 0xf4f6ff, lightIntensity: 1.0 } },
  { id: 'theater', name: '小さな劇場', theme: 'Theater', fixed: false, min: [6.0, 5.6], palette: { lightColor: 0xffb070, lightIntensity: 0.5 } },
  { id: 'pool', name: '水の部屋', theme: 'PoolCorridor', fixed: false, min: [5.6, 5.6], palette: { lightColor: 0xc4ecff, lightIntensity: 0.9 } },
  { id: 'gallery', name: '展示室', theme: 'Gallery', fixed: false, min: [5.0, 5.6], palette: { lightColor: 0xfff0dc, lightIntensity: 1.0 } },
  { id: 'library', name: '書庫', theme: 'ShelfGrid', fixed: false, min: [5.6, 5.6], palette: { lightColor: 0xffd9a0, lightIntensity: 0.7 } },
  { id: 'machine', name: '機械の部屋', theme: 'ServerGrid', fixed: false, min: [5.6, 5.6], palette: { lightColor: 0xcfe0ff, lightIntensity: 0.75 } },
  { id: 'play', name: '遊戯室', theme: 'PlayArea', fixed: false, min: [5.6, 5.6], palette: { lightColor: 0xffe2b0, lightIntensity: 0.95 } },
  { id: 'garden', name: '温室', theme: 'OrganicZone', fixed: false, min: [5.6, 5.6], palette: { wall: 'wallGreen', ceiling: 'ceilingWhite', lightColor: 0xeaffe0, lightIntensity: 1.0 } },
  { id: 'chapel', name: '長椅子の部屋', theme: 'GenericRoom', fixed: true, min: [5.6, 4.4], palette: { floor: 'floorWood', wall: 'wallCream', lightColor: 0xffc080, lightIntensity: 0.45 } },
  { id: 'nook', name: '灯りの小部屋', theme: 'ApartmentCorridor', fixed: true, min: [3.0, 3.2], palette: { floor: 'floorCarpetRed', wall: 'wallBeige', lightColor: 0xffc890, lightIntensity: 0.5 } },
];

export interface SecretWorld {
  cells: GeoCell[];
  portals: PortalSpec[];
  entities: EntitySpec[];
  exits: FloorExit[];
  depth: number;
  /** 通り抜けの出口にしない区画（仕掛けのある区画など） */
  avoid?: ReadonlySet<string>;
  /** 隠し場所を置いてよい範囲（果てしない階の区域の矩形。無ければどこでも） */
  bound?: Rect;
}

/** 範囲 bound の外に掛かるか */
const outOf = (bound: Rect | undefined, r: Rect): boolean => !!bound && (r.x0 < bound.x0 - 1e-6 || r.x1 > bound.x1 + 1e-6 || r.z0 < bound.z0 - 1e-6 || r.z1 > bound.z1 + 1e-6);

export interface PlacedSecret {
  id: string;
  host: string;
  hook: string;
  mode: SecretMode;
  dest: SecretDest;
  /** 入口の区画（入口の扉の向こうの最初の区画） */
  cell: string;
  /** 隠し場所の全部の区画 */
  cells: string[];
  /** レア部屋の種類（穴の部屋・通り抜けは無し） */
  rare?: RareKind;
  /** 通り抜けの出口の区画 */
  to?: string;
  /** 中身をここで決めた区画（区画の中身を置かない） */
  fixed: string[];
}

export interface AttachOptions {
  /** 行き先を決めて付ける（見本のフロア・行き止まりでない隠しを足すとき） */
  dest?: SecretDest;
  /** レア部屋の種類（見本のフロア。収まらなければ小さい種類になる） */
  rare?: RareKind;
  /** dest が作れなくても、ほかの行き先に小さくしない */
  strict?: boolean;
}

const snap = (v: number): number => Math.round(v * 20) / 20;
const AREA_H = 2.6;
const PASSAGE_H = 2.4;

function blocker(world: SecretWorld, r: Rect, y0: number, y1: number, ignore: readonly string[]): GeoCell | null {
  for (const g of world.cells) {
    if (ignore.includes(g.cell.id)) continue;
    const b = g.cell.bounds;
    if (b.max[1] <= y0 || b.min[1] >= y1) continue;
    if (r.x0 < b.max[0] - 0.02 && r.x1 > b.min[0] + 0.02 && r.z0 < b.max[2] - 0.02 && r.z1 > b.min[2] + 0.02) return g;
  }
  return null;
}

/** 向き d の進む軸（'x' / 'z'）と符号 */
const axisOf = (d: Dir): 'x' | 'z' => (d === 1 || d === 3 ? 'x' : 'z');
const signOf = (d: Dir): 1 | -1 => (d === 0 || d === 1 ? 1 : -1);
const dirOf = (axis: 'x' | 'z', sg: number): Dir => (axis === 'x' ? (sg > 0 ? 1 : 3) : (sg > 0 ? 0 : 2));
const back = (d: Dir): Dir => ((d + 2) % 4) as Dir;

/** 軸 n に沿って a0..a1、横の中心 c・半幅 hw の矩形 */
function segRect(n: 'x' | 'z', a0: number, a1: number, c: number, hw: number): Rect {
  const [p, q] = [snap(Math.min(a0, a1)), snap(Math.max(a0, a1))];
  return n === 'x' ? { x0: p, x1: q, z0: snap(c - hw), z1: snap(c + hw) } : { x0: snap(c - hw), x1: snap(c + hw), z0: p, z1: q };
}

/** 箱のうち a と重なる部分を切り取る（壁に開口を開ける） */
function carve(cell: CellLayout, a: AABB): void {
  const out: Box[] = [];
  for (const b of cell.boxes) {
    if (!b.solid || !(b.min[0] < a.max[0] && b.max[0] > a.min[0] && b.min[1] < a.max[1] && b.max[1] > a.min[1] && b.min[2] < a.max[2] && b.max[2] > a.min[2])) { out.push(b); continue; }
    // 6 方向に切り分けて、重なる部分を除く
    const put = (min: [number, number, number], max: [number, number, number]): void => { if (max[0] - min[0] > 1e-3 && max[1] - min[1] > 1e-3 && max[2] - min[2] > 1e-3) out.push({ ...b, min, max }); };
    const x0 = Math.max(b.min[0], a.min[0]), x1 = Math.min(b.max[0], a.max[0]);
    const y0 = Math.max(b.min[1], a.min[1]), y1 = Math.min(b.max[1], a.max[1]);
    put([b.min[0], b.min[1], b.min[2]], [x0, b.max[1], b.max[2]]);
    put([x1, b.min[1], b.min[2]], [b.max[0], b.max[1], b.max[2]]);
    put([x0, b.min[1], b.min[2]], [x1, y0, b.max[2]]);
    put([x0, y1, b.min[2]], [x1, b.max[1], b.max[2]]);
    put([x0, y0, b.min[2]], [x1, y1, Math.max(b.min[2], a.min[2])]);
    put([x0, y0, Math.min(b.max[2], a.max[2])], [x1, y1, b.max[2]]);
  }
  cell.boxes = out;
}

/**
 * 壁（軸 n の座標 coord の面）に扉の穴を開ける。下端は床の上面ちょうど（床は切らず、壁は残さない。
 * 以前は 1 cm 上から切っていたので、見えない 1 cm の壁の切れ端が残って入口でつまずいた）。inward: 区画の内側の向き（0.35 m まで切る）
 */
function cutDoorway(cell: CellLayout, n: 'x' | 'z', coord: number, inward: number, at: number, y: number, w: number, h: number): void {
  const a = Math.min(coord, coord + inward * 0.35), b = Math.max(coord, coord + inward * 0.35);
  carve(cell, n === 'x' ? { min: [a, y, at - w / 2], max: [b, y + h, at + w / 2] } : { min: [at - w / 2, y, a], max: [at + w / 2, y + h, b] });
}

// ---------------------------------------------------------------- 計画（全部置けると分かってから世界に足す）

interface PlanCell {
  id: string;
  rect: Rect;
  role: 'passage' | 'junction' | 'room';
}
interface PlanLink {
  a: string;
  b: string;
  /** 壁の軸（その座標の面に開口がある）と座標・横の位置 */
  n: 'x' | 'z';
  coord: number;
  at: number;
  width: number;
  height: number;
  /** a → b の向き */
  dir: Dir;
  door?: { mat: Box['mat']; oneWay?: boolean };
}
interface Plan {
  cells: PlanCell[];
  links: PlanLink[];
  /** 通り抜けの出口（区画・壁） */
  exit?: { target: GeoCell; n: 'x' | 'z'; coord: number; at: number; dir: Dir };
  room?: string;
}

interface PlanCtx { n: 'x' | 'z'; sg: number; edge: number; at: number; y: number; id: string; t: Tuning; rng: Rng; mode: SecretMode; level: boolean }

/** 計画の区画の矩形が、互いにも世界とも重ならない */
function planFree(world: SecretWorld, rects: Rect[], y: number, ignore: readonly string[]): boolean {
  // 外形で見ない区画（入口の区画・抜ける先の区画）も、足跡の矩形とは重ならないこと（接するのはよい）。
  // 段階 4: 隣と壁 1 枚で接する部屋（くねる部屋の連なり・中庭）では、U 字の通路が入口の部屋へ戻って重なることがあった
  for (const id of ignore) {
    const g = world.cells.find((c) => c.cell.id === id);
    if (!g || g.cell.bounds.max[1] <= y - 0.3 || g.cell.bounds.min[1] >= y + AREA_H + 0.3) continue;
    if (rects.some((r) => g.cell.footprint.some((q) => r.x0 < q.x1 - 0.02 && r.x1 > q.x0 + 0.02 && r.z0 < q.z1 - 0.02 && r.z1 > q.z0 + 0.02))) return false;
  }
  for (let i = 0; i < rects.length; i++) {
    if (outOf(world.bound, rects[i]!) || blocker(world, rects[i]!, y - 0.3, y + AREA_H + 0.3, ignore)) return false;
    for (let j = 0; j < i; j++) {
      const a = rects[i]!, b = rects[j]!;
      if (a.x0 < b.x1 - 0.02 && a.x1 > b.x0 + 0.02 && a.z0 < b.z1 - 0.02 && a.z1 > b.z0 + 0.02) return false;
    }
  }
  return true;
}

/** from（軸 n の座標）から符号 sg の向きへ、横 c・半幅 hw の通路を伸ばせる長さと、ぶつかった区画 */
function march(world: SecretWorld, n: 'x' | 'z', sg: number, from: number, c: number, hw: number, y: number, maxLen: number, ignore: readonly string[]): { len: number; hit: GeoCell | null } {
  let len = 0;
  for (let l = 0.5; l <= maxLen + 1e-6; l += 0.25) {
    if (outOf(world.bound, segRect(n, from, from + sg * l, c, hw))) return { len, hit: null };
    const hit = blocker(world, segRect(n, from, from + sg * l, c, hw), y - 0.3, y + PASSAGE_H + 0.3, ignore);
    if (hit) return { len, hit };
    len = l;
  }
  return { len, hit: null };
}

/**
 * 通り抜けの出口にできるか: 区画 g の、軸 n の向き sg から当たった壁（座標 face）の横 at に扉を開けられる。
 * ふつうの部屋・広間・廊下で、床の高さが同じ・仕掛けが無い・壁の端と既存の開口から離れている
 */
function exitFace(world: SecretWorld, g: GeoCell, n: 'x' | 'z', sg: number, near: number, at: number, y: number, host: string): { coord: number } | null {
  if (g.cell.id === host || g.cell.role === 'secret') return null;
  // 入口・出口の部屋は出口にしてよい（階段は除く）
  if (g.kind !== 'room' && g.kind !== 'hall' && g.kind !== 'corridor' && g.kind !== 'junction') return null;
  if (Math.abs(g.cell.floorY - y) > 0.01 || g.cell.height < DOOR_H + 0.2 || world.avoid?.has(g.cell.id)) return null;
  // 当たった面: 区画の足跡の矩形のうち、横 at を含み、こちらを向いた面
  let coord: number | null = null;
  for (const r of g.cell.footprint) {
    const [l0, l1] = n === 'x' ? [r.z0, r.z1] : [r.x0, r.x1];
    if (at - DOOR_W / 2 - 0.4 < l0 || at + DOOR_W / 2 + 0.4 > l1) continue;
    const f = n === 'x' ? (sg > 0 ? r.x0 : r.x1) : (sg > 0 ? r.z0 : r.z1);
    if ((f - near) * sg < -0.05 || (f - near) * sg > 0.6) continue;
    // その面の外側が同じ区画の別の矩形なら壁ではない
    const out = f - sg * 0.2;
    if (g.cell.footprint.some((o) => o !== r && (n === 'x' ? out > o.x0 && out < o.x1 && at > o.z0 && at < o.z1 : out > o.z0 && out < o.z1 && at > o.x0 && at < o.x1))) continue;
    coord = f;
  }
  if (coord === null) return null;
  // 同じ壁の開口から離す
  const wallDir = dirOf(n, -sg);
  for (const o of g.openings) {
    if (o.dir !== wallDir) continue;
    const oa = n === 'x' ? o.pos[2] : o.pos[0];
    if (Math.abs(oa - at) < o.width / 2 + DOOR_W / 2 + 0.5) return null;
  }
  return { coord };
}

/** レア部屋の矩形: 入口の壁（軸 n の座標 face）から sg の向きに、入口（横 at）を壁の中に含む大きさを、大きい順に */
function roomRects(def: RareDef, n: 'x' | 'z', sg: number, face: number, at: number, rng: Rng): Rect[] {
  const sizes: [number, number][] = ([[8, 9], [7, 8], [6.4, 7], [5.6, 6.2], [5, 5.6], [4.4, 4.8], [3.8, 4.2], [3.4, 3.6], [3.0, 3.2]] as [number, number][]).filter(([d, w]) => d >= def.min[0] && w >= def.min[1]);
  if (!sizes.length) sizes.push([def.min[0], def.min[1]]);
  const out: Rect[] = [];
  for (const [d, w] of sizes) {
    const room = Math.max(0, w / 2 - DOOR_W / 2 - 0.7);
    for (const off of rng.shuffle([0, room, -room, room / 2, -room / 2])) out.push(segRect(n, face, face + sg * d, at + off, w / 2));
  }
  return out;
}

export function pickRare(t: Tuning, rng: Rng): RareDef {
  return rng.weighted(RARE_DEFS, (r) => t[`secrets.rare.${r.id}` as const]);
}

/** 行き先 dest の計画を作る。作れなければ null */
function planArea(world: SecretWorld, host: GeoCell, dest: SecretDest, rare: RareDef, ctx: PlanCtx): Plan | null {
  const { n, sg, edge, at, y, id, t, rng } = ctx;
  const hw = t['secrets.passage.widthM'] / 2 + WALL_T;
  const inner = 2 * hw - 2 * WALL_T;
  const maxLen = t['secrets.passage.maxLenM'];
  const lat: 'x' | 'z' = n === 'x' ? 'z' : 'x';
  const ignoreHost = [host.cell.id];
  const doorMat = themePalette(rare.theme).door ?? 'doorWood';
  const entryLink = (to: string): PlanLink => ({ a: host.cell.id, b: to, n, coord: edge, at, width: DOOR_W, height: DOOR_H, dir: dirOf(n, sg) });
  const roomPlan = (cells: PlanCell[], links: PlanLink[], face: number, faceN: 'x' | 'z', faceSg: number, faceAt: number, from: string | null): Plan | null => {
    for (const r of roomRects(rare, faceN, faceSg, face, faceAt, rng)) {
      if (!planFree(world, [...cells.map((c) => c.rect), r], y, ignoreHost)) continue;
      // 段階 4（フロアの形）: 穴の部屋は、穴の下（6 m）に別の階の区画が無い所だけ（縦に積んだビルの上の階など）
      if ((dest === 'floorLink' || dest === 'bFloor') && blocker(world, r, y - 6.3, y - 0.25, ignoreHost)) continue;
      const room: PlanCell = { id: `${id}r`, rect: r, role: 'room' };
      const l: PlanLink = from
        ? { a: from, b: room.id, n: faceN, coord: face, at: faceAt, width: DOOR_W, height: DOOR_H, dir: dirOf(faceN, faceSg), door: { mat: doorMat } }
        : entryLink(room.id);
      return { cells: [...cells, room], links: [...links, l], room: room.id };
    }
    return null;
  };

  if (dest === 'rareRoom') return roomPlan([], [], edge, n, sg, at, null);
  // 穴の部屋: 入口のすぐ先に置けなければ、通路の先に置く（下の passageRare と同じ作り）
  if (dest === 'floorLink' || dest === 'bFloor') {
    const direct = roomPlan([], [], edge, n, sg, at, null);
    if (direct) return direct;
  }

  const straight = march(world, n, sg, edge, at, hw, y, maxLen, ignoreHost);
  if (dest === 'loop') {
    if (!ctx.level) return null;
    // まっすぐ伸ばして当たった区画に抜ける
    if (straight.hit && straight.len >= 1.5) {
      const f = exitFace(world, straight.hit, n, sg, edge + sg * straight.len, at, y, host.cell.id);
      if (f && Math.abs(f.coord - edge) >= 1.5) {
        const p: PlanCell = { id: `${id}p0`, rect: segRect(n, edge, f.coord, at, hw), role: 'passage' };
        if (planFree(world, [p.rect], y, [...ignoreHost, straight.hit.cell.id])) {
          return {
            cells: [p],
            links: [entryLink(p.id), { a: p.id, b: straight.hit.cell.id, n, coord: f.coord, at, width: DOOR_W, height: DOOR_H, dir: dirOf(n, sg), door: { mat: straight.hit.cell.palette.wall, oneWay: ctx.mode === 'appear' } }],
            exit: { target: straight.hit, n, coord: f.coord, at, dir: dirOf(n, sg) },
          };
        }
      }
    }
    // 途中で曲がってから当たった区画に抜ける
    for (const L1 of rng.shuffle([2, 2.5, 3, 4, 5])) {
      if (L1 + 2 * hw > straight.len) continue;
      const j0 = edge + sg * L1, j1 = j0 + sg * 2 * hw, jc = (j0 + j1) / 2;
      const p0: PlanCell = { id: `${id}p0`, rect: segRect(n, edge, j0, at, hw), role: 'passage' };
      const jn: PlanCell = { id: `${id}j`, rect: segRect(n, j0, j1, at, hw), role: 'junction' };
      for (const s2 of rng.shuffle([1, -1])) {
        const from2 = at + s2 * hw;
        const m = march(world, lat, s2, from2, jc, hw, y, maxLen, ignoreHost);
        if (!m.hit || m.len < 1.5) continue;
        const f = exitFace(world, m.hit, lat, s2, from2 + s2 * m.len, jc, y, host.cell.id);
        if (!f || Math.abs(f.coord - from2) < 1.5) continue;
        const p1: PlanCell = { id: `${id}p1`, rect: segRect(lat, from2, f.coord, jc, hw), role: 'passage' };
        if (!planFree(world, [p0.rect, jn.rect, p1.rect], y, [...ignoreHost, m.hit.cell.id])) continue;
        return {
          cells: [p0, jn, p1],
          links: [
            entryLink(p0.id),
            { a: p0.id, b: jn.id, n, coord: j0, at, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(n, sg) },
            { a: jn.id, b: p1.id, n: lat, coord: from2, at: jc, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(lat, s2) },
            { a: p1.id, b: m.hit.cell.id, n: lat, coord: f.coord, at: jc, width: DOOR_W, height: DOOR_H, dir: dirOf(lat, s2), door: { mat: m.hit.cell.palette.wall, oneWay: ctx.mode === 'appear' } },
          ],
          exit: { target: m.hit, n: lat, coord: f.coord, at: jc, dir: dirOf(lat, s2) },
        };
      }
    }
    // U 字: 外へ出て、壁に沿って横へ進み、フロアの方へ戻って当たった区画に抜ける（フロアの端の部屋から隣の部屋へ）
    for (const L1 of [1.5, 2, 3]) {
      if (L1 + 2 * hw > straight.len) continue;
      const j0 = edge + sg * L1, jc = j0 + sg * hw;
      const p0: PlanCell = { id: `${id}p0`, rect: segRect(n, edge, j0, at, hw), role: 'passage' };
      const ja: PlanCell = { id: `${id}j`, rect: segRect(n, j0, j0 + sg * 2 * hw, at, hw), role: 'junction' };
      for (const s2 of rng.shuffle([1, -1])) {
        const from2 = at + s2 * hw;
        const m = march(world, lat, s2, from2, jc, hw, y, maxLen, ignoreHost);
        for (const L2 of [3, 5, 7, 9]) {
          if (L2 + 2 * hw > m.len) continue;
          const k0 = from2 + s2 * L2, kc = k0 + s2 * hw;
          const p1: PlanCell = { id: `${id}p1`, rect: segRect(lat, from2, k0, jc, hw), role: 'passage' };
          const jb: PlanCell = { id: `${id}k`, rect: segRect(lat, k0, k0 + s2 * 2 * hw, jc, hw), role: 'junction' };
          const from3 = jc - sg * hw;
          const m3 = march(world, n, -sg, from3, kc, hw, y, maxLen, ignoreHost);
          if (!m3.hit || m3.len < 1.0) continue;
          const f = exitFace(world, m3.hit, n, -sg, from3 - sg * m3.len, kc, y, host.cell.id);
          if (!f || Math.abs(f.coord - from3) < 1.0) continue;
          const p2: PlanCell = { id: `${id}p2`, rect: segRect(n, from3, f.coord, kc, hw), role: 'passage' };
          if (!planFree(world, [p0.rect, ja.rect, p1.rect, jb.rect, p2.rect], y, [...ignoreHost, m3.hit.cell.id])) continue;
          return {
            cells: [p0, ja, p1, jb, p2],
            links: [
              entryLink(p0.id),
              { a: p0.id, b: ja.id, n, coord: j0, at, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(n, sg) },
              { a: ja.id, b: p1.id, n: lat, coord: from2, at: jc, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(lat, s2) },
              { a: p1.id, b: jb.id, n: lat, coord: k0, at: jc, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(lat, s2) },
              { a: jb.id, b: p2.id, n, coord: from3, at: kc, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(n, -sg) },
              { a: p2.id, b: m3.hit.cell.id, n, coord: f.coord, at: kc, width: DOOR_W, height: DOOR_H, dir: dirOf(n, -sg), door: { mat: m3.hit.cell.palette.wall, oneWay: ctx.mode === 'appear' } },
            ],
            exit: { target: m3.hit, n, coord: f.coord, at: kc, dir: dirOf(n, -sg) },
          };
        }
      }
    }
    return null;
  }

  // passageRare（と穴の部屋）: 通路の先に部屋（まっすぐ / 曲がって）
  for (const Lp of rng.shuffle([2.5, 3.5, 4.5, 6, 8])) {
    if (Lp > straight.len) continue;
    const p0: PlanCell = { id: `${id}p0`, rect: segRect(n, edge, edge + sg * Lp, at, hw), role: 'passage' };
    const plan = roomPlan([p0], [entryLink(p0.id)], edge + sg * Lp, n, sg, at, p0.id);
    if (plan) return plan;
  }
  for (const L1 of rng.shuffle([2, 3, 4])) {
    if (L1 + 2 * hw > straight.len) continue;
    const j0 = edge + sg * L1, j1 = j0 + sg * 2 * hw, jc = (j0 + j1) / 2;
    const p0: PlanCell = { id: `${id}p0`, rect: segRect(n, edge, j0, at, hw), role: 'passage' };
    const jn: PlanCell = { id: `${id}j`, rect: segRect(n, j0, j1, at, hw), role: 'junction' };
    for (const s2 of rng.shuffle([1, -1])) {
      const from2 = at + s2 * hw;
      const m = march(world, lat, s2, from2, jc, hw, y, maxLen, ignoreHost);
      for (const L2 of [3, 4.5, 6]) {
        if (L2 > m.len) continue;
        const p1: PlanCell = { id: `${id}p1`, rect: segRect(lat, from2, from2 + s2 * L2, jc, hw), role: 'passage' };
        if (!planFree(world, [p0.rect, jn.rect, p1.rect], y, ignoreHost)) continue;
        const links: PlanLink[] = [
          entryLink(p0.id),
          { a: p0.id, b: jn.id, n, coord: j0, at, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(n, sg) },
          { a: jn.id, b: p1.id, n: lat, coord: from2, at: jc, width: inner, height: PASSAGE_H - 0.1, dir: dirOf(lat, s2) },
        ];
        const plan = roomPlan([p0, jn, p1], links, from2 + s2 * L2, lat, s2, jc, p1.id);
        if (plan) return plan;
      }
    }
  }
  return null;
}

/** 行き先が作れないときに試す順（小さい方へ） */
const FALLBACK: Record<SecretDest, SecretDest[]> = {
  loop: ['loop', 'passageRare', 'rareRoom'],
  passageRare: ['passageRare', 'rareRoom'],
  rareRoom: ['rareRoom'],
  floorLink: ['floorLink'],
  bFloor: ['bFloor'],
};

/** 穴の部屋の作り（設備室の系統） */
const HOLE_ROOM: RareDef = { id: 'machine', name: '穴のある部屋', theme: 'CorridorService', fixed: true, min: [3.4, 3.6], palette: { lightColor: 0xdfe8ff, lightIntensity: 0.7 } };

export function attachSecret(world: SecretWorld, host: GeoCell, offer: SecretOffer, mode: SecretMode, rng: Rng, t: Tuning, index: number, opts: AttachOptions = {}): PlacedSecret | null {
  const d = offer.doorway;
  const hr = host.cell.footprint.reduce((a, r) => ((r.x1 - r.x0) * (r.z1 - r.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? r : a));
  const n = axisOf(d.dir), sg = signOf(d.dir);
  const edge = d.dir === 0 ? hr.z1 : d.dir === 2 ? hr.z0 : d.dir === 1 ? hr.x1 : hr.x0;
  const y = offer.floorY ?? d.y;
  const id = `secret${index}`;
  const first = opts.dest ?? rng.weighted(SECRET_DESTS, (k) => t[`secrets.dest.${k}` as const]);
  const picked = opts.rare ? RARE_DEFS.find((r) => r.id === opts.rare)! : pickRare(t, rng);
  let plan: Plan | null = null;
  let dest: SecretDest = first;
  let rare = picked;
  // 選んだレア部屋が収まらなければ、それより小さい種類を大きい順に
  const area = (r: RareDef): number => r.min[0] * r.min[1];
  const kinds = [picked, ...RARE_DEFS.filter((r) => r !== picked && area(r) < area(picked)).sort((a, b) => area(b) - area(a))];
  search: for (const cand of opts.strict ? [first] : FALLBACK[first]) {
    for (const def of cand === 'floorLink' || cand === 'bFloor' ? [HOLE_ROOM] : cand === 'loop' ? [picked] : kinds) {
      plan = planArea(world, host, cand, def, { n, sg, edge, at: d.at, y, id, t, rng, mode, level: Math.abs(y - d.y) < 0.01 });
      if (plan) { dest = cand; rare = def; break search; }
    }
  }
  if (!plan) return null;

  // ---- 世界に足す
  const doorPos: [number, number, number] = n === 'z' ? [d.at, d.y, edge] : [edge, d.y, d.at];
  const isHole = dest === 'floorLink' || dest === 'bFloor';
  const placed: PlacedSecret = { id, host: host.cell.id, hook: offer.hook, mode, dest, cell: plan.cells[0]!.id, cells: plan.cells.map((c) => c.id), fixed: [] };
  if (plan.exit) placed.to = plan.exit.target.cell.id;
  if (plan.room && !isHole) placed.rare = rare.id;
  // 入口: 仕掛けの区画の壁を開ける
  cutDoorway(host.cell, n, edge, -sg, d.at, d.y, DOOR_W, DOOR_H);
  host.openings.push(opening(`${host.cell.id}:${id}`, doorPos, d.dir, DOOR_W, DOOR_H));
  // 区画ごとの開口（扉・通路のつなぎ目）
  const ops = new Map<string, WallOpening[]>(plan.cells.map((c) => [c.id, []]));
  for (const l of plan.links) {
    const pos: [number, number, number] = l.n === 'z' ? [l.at, l.a === host.cell.id ? d.y : y, l.coord] : [l.coord, l.a === host.cell.id ? d.y : y, l.at];
    ops.get(l.a)?.push(opening(`${l.a}:${l.b}`, pos, l.dir, l.width, l.height));
    ops.get(l.b)?.push(opening(`${l.b}:${l.a}`, pos, back(l.dir), l.width, l.height));
  }
  // 区画（入るまで暗い。入ると灯り、そのまま点いている）
  const servicePal: Palette = { ...themePalette('CorridorService'), lightIntensity: 0.85 };
  for (const c of plan.cells) {
    const room = c.role === 'room';
    const palette: Palette = room ? { ...themePalette(rare.theme), ...rare.palette } : servicePal;
    const lamp = `${c.id}.lamp`;
    const cell = makeCell({
      id: c.id, role: 'secret', rects: [c.rect], height: room ? AREA_H : PASSAGE_H, floorY: y, palette,
      theme: room ? rare.theme : 'CorridorService', name: room ? rare.name : '隠し通路', audioPreset: '静かな空調',
      openings: ops.get(c.id)!, lightSpacing: room ? 2.6 : 2.6, lampId: lamp,
    });
    const r = c.rect;
    world.entities.push(
      { id: `${c.id}.enter`, type: 'zoneSensor', cell: c.id, params: { aabb: { min: [r.x0 + 0.2, y - 0.1, r.z0 + 0.2], max: [r.x1 - 0.2, y + 2.4, r.z1 - 0.2] } } },
      { id: `${c.id}.seen`, type: 'latch', cell: c.id, params: {}, inputs: { set: `${c.id}.enter.in` } },
      { id: lamp, type: 'lamp', cell: c.id, params: { on: false, rate: 2.5, pos: [(r.x0 + r.x1) / 2, y + 2.2, (r.z0 + r.z1) / 2] }, inputs: { on: `${c.id}.seen.out` } },
    );
    let kind: DressKind = c.role === 'passage' ? 'corridor' : c.role === 'junction' ? 'junction' : 'room';
    if (room && rare.fixed) {
      kind = 'secret';
      placed.fixed.push(c.id);
      furnishFixed(world, cell, c.rect, y, isHole ? dest : rare.id, plan.links.find((l) => l.b === c.id)!, rng, id, t);
    }
    world.cells.push({ cell, kind, openings: ops.get(c.id)!, node: -1 });
  }
  // 入口から隠し場所の床への段差（入口の y と床の y が違うとき）
  const firstCell = world.cells.find((g) => g.cell.id === placed.cell)!.cell;
  if (y < d.y - 0.01) firstCell.boxes.push(n === 'z' ? box([d.at - DOOR_W / 2, y, Math.min(edge, edge + sg * 0.6)], [d.at + DOOR_W / 2, d.y, Math.max(edge, edge + sg * 0.6)], firstCell.palette.floor) : box([Math.min(edge, edge + sg * 0.6), y, d.at - DOOR_W / 2], [Math.max(edge, edge + sg * 0.6), d.y, d.at + DOOR_W / 2], firstCell.palette.floor));
  // つなぎ目: portal と扉（扉は進む向き＝奥へ開く。views の door: 'x' の扉は swing +1 で +x、'z' の扉は swing +1 で -z）
  for (const l of plan.links) {
    const isEntry = l.a === host.cell.id;
    const ly = isEntry ? d.y : y;
    const toward = signOf(l.dir);
    const swing = l.n === 'x' ? toward : -toward;
    const pn = doorPanel(l.n, l.coord, l.at, DOOR_W, ly, DOOR_H);
    const panel = { min: [...pn.min], max: [...pn.max] };
    let doorId: string | undefined;
    if (isEntry && offer.ownDoor) {
      // 入口の扉は仕掛けが置いている（隠しの扉は足さず、開口の扉はその部品）
      doorId = offer.ownDoor;
    } else if (isEntry) {
      // 存在型は壁と同じ色の扉（見えにくい）。出現型は壁が消えると現れるふつうの扉
      doorId = `${id}.door`;
      world.entities.push({ id: doorId, type: 'door', cell: host.cell.id, params: { panel, axis: l.n, mat: mode === 'present' ? host.cell.palette.wall : host.cell.palette.door, hinge: rng.chance(0.5) ? 1 : -1, swing, autoCloseSec: 6 } });
    } else if (l.door) {
      doorId = `${id}.door:${l.b}`;
      const params: EntitySpec['params'] = { panel, axis: l.n, mat: l.door.mat, hinge: rng.chance(0.5) ? 1 : -1, swing, autoCloseSec: 6 };
      // 一方通行: 通路の側（進む向きの反対）からだけ開く
      if (l.door.oneWay) params.openSide = -toward;
      world.entities.push({ id: doorId, type: 'door', cell: l.a, params });
    }
    world.portals.push(portal(`p:${l.a}:${l.b}`, l.a, l.b, portalAabb(l.n, l.coord, l.at, l.width, ly, l.height), l.dir, doorId ? 'door' : 'opening', doorId));
  }
  // 通り抜けの出口: 行き先の区画の壁を開ける
  if (plan.exit) {
    const e = plan.exit;
    cutDoorway(e.target.cell, e.n, e.coord, signOf(e.dir), e.at, y, DOOR_W, DOOR_H);
    e.target.openings.push(opening(`${e.target.cell.id}:${id}`, e.n === 'z' ? [e.at, y, e.coord] : [e.coord, y, e.at], back(e.dir), DOOR_W, DOOR_H));
  }
  // 出現型: 入口を塞ぐ箱（入口の区画の壁の厚み + 隠し場所の壁の厚み）。中に扉が埋まっていて、壁が消えると現れる
  if (mode === 'appear') {
    const group = `${id}.wall`;
    const plug = (cellRef: CellLayout, a: number, b: number): void => {
      const pb: Box = n === 'z'
        ? box([d.at - DOOR_W / 2, d.y, Math.min(a, b)], [d.at + DOOR_W / 2, d.y + DOOR_H, Math.max(a, b)], cellRef.palette.wall)
        : box([Math.min(a, b), d.y, d.at - DOOR_W / 2], [Math.max(a, b), d.y + DOOR_H, d.at + DOOR_W / 2], cellRef.palette.wall);
      pb.concealGroup = group;
      cellRef.boxes.push(pb);
    };
    plug(host.cell, edge, edge - sg * WALL_T);
    plug(firstCell, edge, edge + sg * WALL_T);
    world.entities.push({ id: `${id}.reveal`, type: 'reveal', cell: host.cell.id, params: { group, pos: [...doorPos], style: 'slideOpen' }, inputs: { show: offer.revealOutput! } });
  }
  return placed;
}

/** 中身を決める部屋: 白い私室・長椅子の部屋・穴の部屋。entry は部屋への入口のつなぎ目（向き dir は部屋の奥へ） */
function furnishFixed(world: SecretWorld, cell: CellLayout, r: Rect, y: number, what: RareKind | SecretDest, entry: PlanLink, rng: Rng, id: string, t: Tuning): void {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const n = entry.n, sg = signOf(entry.dir);
  // 奥の壁の内側の面と、横の中心
  const far = (n === 'x' ? (sg > 0 ? r.x1 : r.x0) : (sg > 0 ? r.z1 : r.z0)) - sg * WALL_T;
  const lc = n === 'x' ? cz : cx;
  /** 奥の壁から a0..a1 手前・横 l0..l1 の箱 */
  const at = (a0: number, a1: number, l0: number, l1: number, y0: number, y1: number, mat: Box['mat'], solid = true): Box => {
    const p = far - sg * a0, q = far - sg * a1;
    return n === 'x' ? box([Math.min(p, q), y0, l0], [Math.max(p, q), y1, l1], mat, solid) : box([l0, y0, Math.min(p, q)], [l1, y1, Math.max(p, q)], mat, solid);
  };
  switch (what) {
    case 'white': {
      // 白一色の部屋に、大きすぎる椅子が 1 脚。奥の壁際で入口を向く [QR]
      const s = rng.float(2.2, 2.9);
      const hw = 0.25 * s;
      cell.boxes.push(at(0.1, 0.1 + 0.5 * s, lc - hw, lc + hw, y, y + 0.45 * s, 'whiteFabric'));
      cell.boxes.push(at(0.1, 0.1 + 0.06 * s, lc - hw, lc + hw, y + 0.45 * s, y + 0.95 * s, 'whiteFabric'));
      break;
    }
    case 'chapel': {
      // 長椅子の列が奥の台を向く。台の上に小さな灯り
      const depth = n === 'x' ? r.x1 - r.x0 : r.z1 - r.z0;
      const width = n === 'x' ? r.z1 - r.z0 : r.x1 - r.x0;
      cell.boxes.push(at(0.45, 1.05, lc - 0.6, lc + 0.6, y, y + 0.95, 'woodPanel'));
      cell.boxes.push(at(0.65, 0.85, lc - 0.08, lc + 0.08, y + 0.95, y + 1.12, 'lightWarm', false));
      cell.lights.push({ pos: n === 'x' ? [far - sg * 0.75, y + 1.6, lc] : [lc, y + 1.6, far - sg * 0.75], color: 0xffb060, intensity: 0.6, distance: 5 });
      const bw = Math.min(1.8, (width - 2 * WALL_T - 1.6) / 2);
      if (bw > 0.6) {
        for (let a = 2.0; a < depth - 2 * WALL_T - 1.9; a += 1.05) {
          for (const side of [-1, 1]) {
            const l0 = side < 0 ? lc - 0.5 - bw : lc + 0.5, l1 = l0 + bw;
            cell.boxes.push(at(a, a + 0.42, l0, l1, y, y + 0.45, 'woodPanel'));
            cell.boxes.push(at(a + 0.38, a + 0.45, l0, l1, y + 0.45, y + 0.9, 'woodPanel'));
          }
        }
      }
      break;
    }
    case 'floorLink':
    case 'bFloor': {
      // 別のフロアへ: 床の真ん中の下りの穴（落ちると次へ）。裏のフロアは同じ深さの別の版
      // 果てしない階の区域（地面の階）: 深い暗い縦穴。落ちる途中で行き先の階の着く部屋の縦穴へ移る（暗転しない。13 章）。
      // 移れなければ（行き先がまだ用意できない）底の手前で暗転して移る。フロア（区域でない・上の階）は今までどおり浅い穴で暗転
      const half = t['world.hole.sizeM'] / 2;
      const hole: Rect = { x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half };
      const seamless = !!world.bound && Math.abs(y) < 0.05;
      const D = seamless ? t['world.hole.depthM'] : 6;
      cell.boxes = cell.boxes.filter((b) => !(b.solid && Math.abs(b.max[1] - y) < 1e-3 && b.max[1] - b.min[1] <= 0.25));
      for (const [x0, z0, x1, z1] of [[r.x0, r.z0, r.x1, hole.z0], [r.x0, hole.z1, r.x1, r.z1], [r.x0, hole.z0, hole.x0, hole.z1], [hole.x1, hole.z0, r.x1, hole.z1]] as const) cell.boxes.push(box([x0, y - 0.2, z0], [x1, y, z1], cell.palette.floor));
      cell.boxes.push(box([hole.x0, y - D, hole.z0], [hole.x0 + 0.1, y, hole.z1], 'void'), box([hole.x1 - 0.1, y - D, hole.z0], [hole.x1, y, hole.z1], 'void'), box([hole.x0, y - D, hole.z0], [hole.x1, y, hole.z0 + 0.1], 'void'), box([hole.x0, y - D, hole.z1 - 0.1], [hole.x1, y, hole.z1], 'void'));
      if (seamless) cell.boxes.push(box([hole.x0, y - D - 0.2, hole.z0], [hole.x1, y - D, hole.z1], 'void'));
      // 区画の外形の下端を縦穴の底まで（落下の判定で戻されない）
      cell.bounds.min[1] = Math.min(cell.bounds.min[1], y - D - 0.2);
      const to = what === 'bFloor' ? { floor: `${world.depth + 1}.1` } : { floor: `${world.depth + 2}.0` };
      world.exits.push(seamless
        ? { id: `${id}:hole`, kind: 'secret', aabb: { min: [hole.x0, y - D, hole.z0], max: [hole.x1, y - D + 3, hole.z1] }, to, shaft: { anchor: [cx, y, cz], zone: { min: [hole.x0, y - D - 0.2, hole.z0], max: [hole.x1, y - 0.3, hole.z1] } } }
        : { id: `${id}:hole`, kind: 'secret', aabb: { min: [hole.x0, y - 6, hole.z0], max: [hole.x1, y - 1.2, hole.z1] }, to });
      // 穴の縁の光（目印）
      lightPanel(cell.boxes, cx, cz, 0.5, 0.5, y + 2.6, 'lightGreen');
      break;
    }
    case 'nook': {
      // 小さな部屋に椅子が 1 脚と、床に置いた灯り
      cell.boxes.push(at(0.5, 0.95, lc - 0.22, lc + 0.22, y, y + 0.45, 'upholstery'));
      cell.boxes.push(at(0.5, 0.56, lc - 0.22, lc + 0.22, y + 0.45, y + 0.95, 'upholstery'));
      const lx = lc + 0.75;
      cell.boxes.push(at(0.35, 0.47, lx - 0.06, lx + 0.06, y, y + 1.35, 'metalDark'));
      cell.boxes.push(at(0.25, 0.57, lx - 0.16, lx + 0.16, y + 1.35, y + 1.6, 'lightWarm', false));
      cell.lights.push({ pos: n === 'x' ? [far - sg * 0.41, y + 1.4, lx] : [lx, y + 1.4, far - sg * 0.41], color: 0xffb870, intensity: 0.55, distance: 4 });
      break;
    }
    default: break;
  }
}
