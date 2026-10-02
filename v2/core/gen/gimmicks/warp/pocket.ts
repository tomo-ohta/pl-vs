/**
 * 空間のゆがみの「別の空間」（pocket）を作る道具。
 *
 * - 別の空間はフロアの上空（仕掛けの部屋の真上、POCKET_STEP の倍数だけ上）に置く。高さだけずらした双子の部屋は、
 *   床・壁の模様（UV）・汚れの模様（区画の床からの高さで決まる）が仕掛けの部屋とまったく同じになる
 * - 別の空間の区画は role 'secret'（開口でフロアにつながらない）・pocket に仕掛けの id。地図には出さない
 * - copyCell: 区画を写し方（Xform）で写した双子（箱・照明・ゾーン・足跡。模様の基準 uvFrame は元の区画）
 * - 箱・扉・開口を作る補助（区画の座標の向き u/v で書くための frame）
 */
import type { AABB } from '../../../math/aabb.ts';
import { rotQ, type Dir, type Vec3 } from '../../../math/vec.ts';
import { doorPanel, makeCell, opening, portal, portalAabb } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type EntitySpec, type Json, type LightSpec, type MatId, type Palette, type PortalSpec, type UvFrame, type WallOpening, type Zone } from '../../../world/layout.ts';
import type { DressKind } from '../../dress/types.ts';
import { xBox, xCompose, xPoint, xVec, type Xform } from '../../../sim/parts/warp/util.ts';
import type { GimmickContext } from '../types.ts';

/**
 * 別の空間の高さの刻み（m）。床・壁の模様の繰り返しの長さ（0.24・0.6・1・1.1・1.2・2 m …）の公倍数にして、
 * 高さだけずらした双子の模様が揃うようにする（区画の uvFrame でも揃えるが、念のため）
 */
export const POCKET_STEP = 66;

/** 仕掛けが使える（区画を足せる）か */
export function canPocket(ctx: GimmickContext): boolean {
  return !!(ctx.addCell && ctx.addPortal && ctx.cells && ctx.noDress);
}

/** 裏のフロア（variant ≥ 1）か。裏のフロアは区画ごとに照明が消えるので、双子の部屋が揃わない */
export function isBSide(ctx: GimmickContext): boolean {
  const m = /\.(\d+)$/.exec(ctx.floor.id);
  return !!m && Number(m[1]) > 0;
}

/** 次の別の空間の高さ（仕掛けの部屋の床からの差）。すでにある別の空間の数 + 1 段 */
export function nextPocketRise(ctx: GimmickContext): number {
  const ids = new Set((ctx.cells?.() ?? []).map((c) => c.pocket).filter((x): x is string => !!x));
  return POCKET_STEP * (ids.size + 1);
}

export const toUv = (x: Xform): UvFrame => ({ pivot: [...x.from], offset: [x.to[0] - x.from[0], x.to[1] - x.from[1], x.to[2] - x.from[2]], q: x.q });
export const fromUv = (f: UvFrame): Xform => { const p = f.pivot ?? [0, 0, 0]; return { from: [...p], to: [p[0] + f.offset[0], p[1] + f.offset[1], p[2] + f.offset[2]], q: f.q }; };

export function xRect(x: Xform, r: Rect, y = 0): Rect {
  const b = xBox(x, { min: [r.x0, y, r.z0], max: [r.x1, y, r.z1] });
  return { x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2] };
}

export function xDir(x: Xform, d: Dir): Dir {
  return ((d + x.q) % 4) as Dir;
}

/** 箱を写す（模様の基準は元の箱の位置） */
export function xBoxOf(x: Xform, b: Box, srcFrame?: UvFrame): Box {
  const a = xBox(x, b);
  const out: Box = { ...b, min: a.min, max: a.max };
  const base = b.uvFrame ?? srcFrame;
  out.uvFrame = toUv(base ? xCompose(fromUv(base), x) : x);
  if (b.slope && x.q !== 0) delete out.slope;
  delete out.environment;
  return out;
}

export function xOpening(x: Xform, o: WallOpening, id: string): WallOpening {
  const out: WallOpening = { ...o, id, pos: xPoint(x, o.pos), dir: xDir(x, o.dir) };
  return out;
}

/**
 * 区画を写した双子（id・役割・pocket を付け替える）。箱・照明・ゾーン・足跡を写し、模様の基準（uvFrame）を元の区画の位置にする。
 * 照明の lampId と出現型の組（revealGroup / concealGroup）はそのまま（双子の照明は同じ部品に従う）
 */
export function copyCell(src: CellLayout, x: Xform, o: { id: string; pocket: string; role?: CellLayout['role']; name?: string }): CellLayout {
  const lights: LightSpec[] = src.lights.map((l) => ({ ...l, pos: xPoint(x, l.pos) }));
  const zones: Zone[] = src.zones.map((z) => { const zz: Zone = { ...z, aabb: xBox(x, z.aabb) }; if (z.vector) zz.vector = xVec(x, z.vector); return zz; });
  const boxes = src.boxes.map((b) => {
    const nb = xBoxOf(x, b, src.uvFrame);
    if (nb.propGroup?.startsWith(`${src.id}/`)) nb.propGroup = `${o.id}/${nb.propGroup.slice(src.id.length + 1)}`;
    return nb;
  });
  const cell: CellLayout = {
    ...src,
    id: o.id,
    role: o.role ?? 'secret',
    bounds: xBox(x, src.bounds),
    footprint: src.footprint.map((r) => xRect(x, r)),
    floorY: src.floorY + (x.to[1] - x.from[1]),
    palette: { ...src.palette },
    boxes,
    lights,
    zones,
    pocket: o.pocket,
  };
  delete cell.uvFrame;
  if (o.name) cell.name = o.name;
  return cell;
}

/** 別の空間の区画（壁・床・天井。照明は自分で置く） */
export function pocketCell(o: { id: string; pocket: string; rects: Rect[]; height: number; floorY: number; palette: Palette; openings: WallOpening[]; theme?: string; name: string; materialKey?: string; audio?: string; noCeiling?: boolean }): CellLayout {
  const cell = makeCell({ id: o.id, role: 'secret', rects: o.rects, height: o.height, floorY: o.floorY, palette: o.palette, openings: o.openings, lights: 'none', name: o.name, ...(o.theme ? { theme: o.theme } : {}), ...(o.materialKey ? { materialKey: o.materialKey } : {}), audioPreset: o.audio ?? '静かな空調', ...(o.noCeiling ? { noCeiling: true } : {}) });
  cell.pocket = o.pocket;
  return cell;
}

/** 区画を足す（ctx.addCell。中身は置かない） */
export function addPocketCell(ctx: GimmickContext, cell: CellLayout, kind: DressKind, openings: WallOpening[]): void {
  ctx.addCell!(cell, kind, openings);
  ctx.noDress!(cell.id);
}

/** 向き d の進む軸と符号 */
export const axisOf = (d: Dir): 'x' | 'z' => (d === 1 || d === 3 ? 'x' : 'z');
export const signOf = (d: Dir): 1 | -1 => (d === 0 || d === 1 ? 1 : -1);

/**
 * 局所の座標（u: 前 = 向き fwd、v: 左 = fwd を 1/4 回した向き）→ フロアの座標。原点 o（y は床の高さ）。
 * 廊下・階段を「入口から前へ」の向きで書くために使う
 */
export interface Frame {
  o: Vec3;
  fwd: Dir;
  /** 局所の点 (u, y, v) → フロアの点（y は o からの高さ） */
  p(u: number, y: number, v: number): Vec3;
  /** 局所の矩形 → フロアの矩形 */
  rect(u0: number, v0: number, u1: number, v1: number): Rect;
  /** 局所の箱 → フロアの箱 */
  box(u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, mat: MatId, solid?: boolean): Box;
  aabb(u0: number, y0: number, v0: number, u1: number, y1: number, v1: number): AABB;
  /** 局所の向き（0: 前 / 1: 左 / 2: 後ろ / 3: 右）→ フロアの向き */
  dir(local: 0 | 1 | 2 | 3): Dir;
  /** 局所の写し方（局所の点 from → to、回転 q）→ フロアの写し方 */
  xform(from: [number, number, number], to: [number, number, number], q: Dir): Xform;
}

/** fwd の向きの単位ベクトル（rotQ([0,0,1], …) の並び: 0:+Z 1:+X 2:-Z 3:-X） */
const unit = (d: Dir): Vec3 => rotQ([0, 0, 1], d);

export function makeFrame(o: Vec3, fwd: Dir): Frame {
  const f = unit(fwd);
  // 左 = 前を 1/4 回した向き（yaw が増える向き。前 +Z なら左 +X）
  const l = unit(((fwd + 1) % 4) as Dir);
  const p = (u: number, y: number, v: number): Vec3 => [o[0] + f[0] * u + l[0] * v, o[1] + y, o[2] + f[2] * u + l[2] * v];
  const rect = (u0: number, v0: number, u1: number, v1: number): Rect => {
    const a = p(u0, 0, v0), b = p(u1, 0, v1);
    return { x0: Math.min(a[0], b[0]), z0: Math.min(a[2], b[2]), x1: Math.max(a[0], b[0]), z1: Math.max(a[2], b[2]) };
  };
  const aabb = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number): AABB => {
    const r = rect(u0, v0, u1, v1);
    return { min: [r.x0, o[1] + Math.min(y0, y1), r.z0], max: [r.x1, o[1] + Math.max(y0, y1), r.z1] };
  };
  return {
    o: [...o], fwd, p, rect, aabb,
    box: (u0, y0, v0, u1, y1, v1, mat, solid = true) => { const a = aabb(u0, y0, v0, u1, y1, v1); return box(a.min, a.max, mat, solid); },
    dir: (local) => ((fwd + local) % 4) as Dir,
    xform: (from, to, q) => ({ from: p(from[0], from[1], from[2]), to: p(to[0], to[1], to[2]), q }),
  };
}

/** 扉の部品（閉じた位置の板）。軸 axis の座標 coord の面、横 at、床 y */
export function doorSpec(axis: 'x' | 'z', coord: number, at: number, y: number, mat: MatId, extra: Record<string, Json> = {}): Omit<EntitySpec, 'id' | 'cell'> {
  const pn = doorPanel(axis, coord, at, DOOR_W, y, DOOR_H);
  return { type: 'door', params: { panel: { min: [...pn.min], max: [...pn.max] }, axis, mat, hinge: 1, swing: 1, autoCloseSec: 6, ...extra } };
}

/** 2 つの区画の境目（向き dir の壁の外面 pos）の開口と portal。扉があれば doorId */
export function joinCells(ctx: GimmickContext, a: string, b: string, pos: Vec3, dir: Dir, width: number, height: number, doorId?: string): PortalSpec {
  const axis = axisOf(dir);
  const coord = axis === 'x' ? pos[0] : pos[2];
  const at = axis === 'x' ? pos[2] : pos[0];
  const p = portal(`p:${a}:${b}`, a, b, portalAabb(axis, coord, at, width, pos[1], height), dir, doorId ? 'door' : 'opening', doorId);
  ctx.addPortal!(p);
  return p;
}

/** 壁の開口の組（両側の区画の開口。dir は a から b への向き） */
export function openingPair(a: string, b: string, pos: Vec3, dir: Dir, width = DOOR_W, height = DOOR_H): [WallOpening, WallOpening] {
  return [opening(`${a}:${b}`, [...pos], dir, width, height), opening(`${b}:${a}`, [...pos], ((dir + 2) % 4) as Dir, width, height)];
}

/** 壁の開口の前（区画の内側へ d m）の点 */
export function frontPoint(o: { pos: Vec3; dir: Dir }, d: number): Vec3 {
  const u = unit(o.dir);
  return [o.pos[0] - u[0] * d, o.pos[1], o.pos[2] - u[2] * d];
}

/**
 * 区画の壁の箱を切って、扉の穴を開ける（secrets の cutDoorway と同じ考え方: 床は切らず、壁の厚みの中だけ）。
 * pos は壁の外面の床位置、dir は外向き
 */
export function carveDoorway(cell: CellLayout, pos: Vec3, dir: Dir, width = DOOR_W, height = DOOR_H): void {
  const axis = axisOf(dir);
  const sg = signOf(dir);
  const coord = axis === 'x' ? pos[0] : pos[2];
  const at = axis === 'x' ? pos[2] : pos[0];
  const a0 = Math.min(coord, coord - sg * (WALL_T + 0.05)), a1 = Math.max(coord, coord - sg * (WALL_T + 0.05));
  const cut: AABB = axis === 'x' ? { min: [a0, pos[1], at - width / 2], max: [a1, pos[1] + height, at + width / 2] } : { min: [at - width / 2, pos[1], a0], max: [at + width / 2, pos[1] + height, a1] };
  const out: Box[] = [];
  for (const b of cell.boxes) {
    if (!b.solid || !(b.min[0] < cut.max[0] && b.max[0] > cut.min[0] && b.min[1] < cut.max[1] && b.max[1] > cut.min[1] && b.min[2] < cut.max[2] && b.max[2] > cut.min[2])) { out.push(b); continue; }
    const put = (min: Vec3, max: Vec3): void => { if (max[0] - min[0] > 1e-3 && max[1] - min[1] > 1e-3 && max[2] - min[2] > 1e-3) out.push({ ...b, min, max }); };
    const x0 = Math.max(b.min[0], cut.min[0]), x1 = Math.min(b.max[0], cut.max[0]);
    const y0 = Math.max(b.min[1], cut.min[1]), y1 = Math.min(b.max[1], cut.max[1]);
    put([b.min[0], b.min[1], b.min[2]], [x0, b.max[1], b.max[2]]);
    put([x1, b.min[1], b.min[2]], [b.max[0], b.max[1], b.max[2]]);
    put([x0, b.min[1], b.min[2]], [x1, y0, b.max[2]]);
    put([x0, y1, b.min[2]], [x1, b.max[1], b.max[2]]);
    put([x0, y0, b.min[2]], [x1, y1, Math.max(b.min[2], cut.min[2])]);
    put([x0, y0, Math.min(b.max[2], cut.max[2])], [x1, y1, b.max[2]]);
  }
  cell.boxes = out;
}

/**
 * 区画の箱（床・天井・壁）を、局所の座標 u の切れ目 cuts で切り分ける（frame の前の向きに長い箱だけ）。
 * くり返す所の箱の分け方（描画の分割・頂点の焼き込み）を、くり返しごとに同じにする（双子の見た目が揃う）
 */
export function splitAlong(cell: CellLayout, f: Frame, cuts: readonly number[]): void {
  const fv = unit(f.fwd);
  const ax = Math.abs(fv[0]) > 0.5 ? 0 : 2;
  const sg = ax === 0 ? fv[0] : fv[2];
  // 局所の u → フロアの座標（軸 ax）
  const world = cuts.map((u) => f.o[ax] + sg * u);
  const out: Box[] = [];
  for (const b of cell.boxes) {
    let pieces: Box[] = [b];
    for (const w of world) {
      const next: Box[] = [];
      for (const p of pieces) {
        if (p.min[ax] < w - 1e-3 && p.max[ax] > w + 1e-3 && !p.propGroup && !p.slope) {
          const lo: Box = { ...p, min: [...p.min], max: [...p.max] };
          const hi: Box = { ...p, min: [...p.min], max: [...p.max] };
          lo.max[ax] = w;
          hi.min[ax] = w;
          next.push(lo, hi);
        } else next.push(p);
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  cell.boxes = out;
}

/** 区画の箱を、フロアの座標の軸 axis（0: x / 1: y / 2: z）の値 coords で切り分ける（縦に積んだ階の壁を階ごとに分ける） */
export function splitAt(cell: CellLayout, axis: 0 | 1 | 2, coords: readonly number[]): void {
  const out: Box[] = [];
  for (const b of cell.boxes) {
    let pieces: Box[] = [b];
    for (const w of coords) {
      const next: Box[] = [];
      for (const p of pieces) {
        if (p.min[axis] < w - 1e-3 && p.max[axis] > w + 1e-3 && !p.propGroup && !p.slope) {
          const lo: Box = { ...p, min: [...p.min], max: [...p.max] };
          const hi: Box = { ...p, min: [...p.min], max: [...p.max] };
          lo.max[axis] = w;
          hi.min[axis] = w;
          next.push(lo, hi);
        } else next.push(p);
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  cell.boxes = out;
}

/**
 * 模様の繰り返しの長さが 12 m を割り切る材質（client/render/MaterialLibrary の SURFACES の meters。くり返す廊下を 12 m・6 m ずらしても
 * 模様が揃う）。木目（1.1 m）・座面（0.45 m）・白い塗装（0.7 m）などは揃わないので、別の空間の廊下の色の組には使わない
 */
export const TWIN_SAFE: ReadonlySet<MatId> = new Set<MatId>([
  'floorCarpetRed', 'floorCarpetGrey', 'floorLino', 'floorConcrete', 'floorTile', 'floorWood', 'marbleFloor', 'marbleWhite',
  'wallBeige', 'wallWhite', 'wallCream', 'wallConcrete', 'wallGreen', 'wallDark', 'wainscotCream', 'wallBrick',
  'ceilingWhite', 'ceilingTile', 'ceilingDark', 'doorMetal', 'metal', 'metalDark', 'stainless', 'columnConcrete',
  'lightPanel', 'lightWarm', 'lightGreen', 'lightYellow', 'sodiumLight', 'ledBlue', 'neonRed', 'neonBlue', 'lightOff',
  'signPlate', 'plasticRed', 'plasticYellow', 'plasticBlue', 'noticeGreen', 'lockerGreen', 'lockerBlue', 'yellowLine', 'boxCardboard',
]);

/** 別の空間の廊下の色の組（模様が揃う材質だけ。元の組の色温度・明るさは保つ） */
export function safePalette(p: Palette): Palette {
  const pick = (m: MatId, alt: MatId): MatId => (TWIN_SAFE.has(m) ? m : alt);
  return { ...p, floor: pick(p.floor, 'floorCarpetGrey'), wall: pick(p.wall, 'wallBeige'), ceiling: pick(p.ceiling, 'ceilingTile'), light: pick(p.light, 'lightPanel'), door: p.door };
}

/** 天井の照明（発光パネル + 点光源）。frame の局所の座標 (u, v)、天井の高さ h */
export function ceilingLight(cell: CellLayout, f: Frame, u: number, v: number, h: number, alongU: boolean, light = true, intensityMul = 1, distance = 6): void {
  const c = f.p(u, h, v);
  const wU = alongU ? 1.2 : 0.6, wV = alongU ? 0.6 : 1.2;
  const a = f.aabb(u - wU / 2, h - 0.04, v - wV / 2, u + wU / 2, h - 0.005, v + wV / 2);
  cell.boxes.push(box(a.min, a.max, cell.palette.light, false));
  if (light) cell.lights.push({ pos: [c[0], c[1] - 0.4, c[2]], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * intensityMul, distance });
}
