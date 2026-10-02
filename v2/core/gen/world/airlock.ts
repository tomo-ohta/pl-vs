/**
 * 階段室（docs/endless-world.md 3.2）: 上の階と下の階の区域に同じ形で置き、中で人を入れ替える（読み込みの画面なしに階を移る）。
 *
 * 形は階段室の id だけで決まる（上の階の写しと下の階の写しで同じ）。区域の中の置き場所は写しごとに違うので、
 * 決まった形（局所の座標）を 1/4 回転 q とずらし offset で置く。区画の uvFrame も同じ写し方にして、模様をそろえる。
 *
 * 局所の座標: 上の扉の床の中心が原点、+z が上の扉から下の扉へ。上の踊り場の床が y = 0、下の踊り場の床が y = −rise。
 * - role 'down'（上の階の区域）: 上の扉が区域につながり、下の扉は開かない。下の半分に入り、扉が両方閉じていたら下の階へ
 * - role 'up'（下の階の区域）: 下の扉が区域につながり、上の扉は開かない（上に階が無ければ、上へは行けない）
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import { addDir, rotQ, type Dir, type Vec3 } from '../../math/vec.ts';
import { doorPanel, lightPanel, makeCell, opening, portal, portalAabb } from '../../world/build.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type EntitySpec, type FloorExit, type Json, type MatId, type Palette, type PortalSpec, type WallOpening } from '../../world/layout.ts';
import { themePalette } from '../../world/palettes.ts';

const RISER_MAX = 0.17;
const TREAD = 0.28;

/** 階段室の形（id だけで決まる） */
export interface AirlockShape {
  /** 外の幅（壁を含む） */
  width: number;
  /** 外の長さ（両端の壁を含む） */
  length: number;
  /** 上の踊り場から下の踊り場までの高さ */
  rise: number;
  /** 上の踊り場から天井まで */
  height: number;
  landing: number;
  steps: number;
  palette: Palette;
  door: MatId;
}

/** 階段室の色の組（どちらの写しも同じ組を引く） */
const PALETTES: { floor: MatId; wall: MatId; ceiling: MatId; door: MatId }[] = [
  { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  { floor: 'floorConcrete', wall: 'paintWhite', ceiling: 'ceilingWhite', door: 'doorMetal' },
  { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorMetal' },
  { floor: 'floorConcrete', wall: 'wallGreen', ceiling: 'ceilingDark', door: 'doorMetal' },
];

export function airlockShape(id: string, t: Tuning): AirlockShape {
  const r = new Rng(hashAll(id, 'airlock'));
  const rise = t['floor.levelHeightM'];
  const steps = Math.ceil(rise / RISER_MAX - 1e-9);
  const landing = 1.2;
  const inner = landing * 2 + (steps - 1) * TREAD;
  const pal = r.pick(PALETTES);
  const base = themePalette('CorridorService');
  return {
    width: t['world.airlock.widthM'], length: Math.round((inner + 2 * WALL_T) * 20) / 20, rise, height: 2.6, landing, steps,
    palette: { ...base, floor: pal.floor, wall: pal.wall, ceiling: pal.ceiling, door: pal.door, lightIntensity: base.lightIntensity * 0.85 },
    door: pal.door,
  };
}

/** 階段室の置き方: 局所の点 p → 階の座標 rotQ(p, q) + offset */
export interface AirlockAnchor { offset: Vec3; q: Dir }

export interface PlacedAirlock {
  cell: CellLayout;
  /** 区画の開口（両端の扉） */
  openings: WallOpening[];
  entities: EntitySpec[];
  /** 区域の区画（host）とのつなぎ */
  portal: PortalSpec;
  /** 区域の区画（host）の壁の開口 */
  hostOpening: WallOpening;
  exit: FloorExit | null;
  anchor: AirlockAnchor;
  /** 区域につながる扉 / 開かない扉 */
  live: string;
  sealed: string;
  /** 階段室の外形（区域の中で場所を取る） */
  rect: Rect;
}

const toWorld = (a: AirlockAnchor, p: Vec3): Vec3 => { const r = rotQ(p, a.q); return [r[0] + a.offset[0], r[1] + a.offset[1], r[2] + a.offset[2]]; };
function boxWorld(a: AirlockAnchor, min: Vec3, max: Vec3): AABB {
  const p = toWorld(a, min), q = toWorld(a, max);
  return { min: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], max: [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])] };
}
const r2 = (v: number): number => Math.round(v * 1e6) / 1e6;
const clean = (a: AABB): AABB => ({ min: [r2(a.min[0]), r2(a.min[1]), r2(a.min[2])], max: [r2(a.max[0]), r2(a.max[1]), r2(a.max[2])] });

/**
 * 階段室の置き方を、区域の区画（host）の壁の点 wall（host の床の高さ）と外向き side から決める。
 * down は上の扉を、up は下の扉を、その壁の点に当てる
 */
export function airlockAnchor(role: 'down' | 'up', wall: Vec3, side: Dir, s: AirlockShape): AirlockAnchor {
  if (role === 'down') return { offset: [wall[0], wall[1], wall[2]], q: side };
  const q = addDir(side, 2);
  const b = rotQ([0, -s.rise, s.length], q);
  return { offset: [r2(wall[0] - b[0]), r2(wall[1] - b[1]), r2(wall[2] - b[2])], q };
}

/**
 * 階段室を置く。cellId は区域の中の区画の id、host は区域の側の区画（扉の向こう）、to は向こうの階（'depth.variant'。
 * null は向こうが無い = 入れ替えない）
 */
export function placeAirlock(id: string, role: 'down' | 'up', cellId: string, host: string, anchor: AirlockAnchor, s: AirlockShape, to: string | null, closeSec: number): PlacedAirlock {
  const W = s.width, L = s.length, top = 0, low = -s.rise;
  const xi0 = -W / 2 + WALL_T, xi1 = W / 2 - WALL_T;
  const outer = boxWorld(anchor, [-W / 2, low, 0], [W / 2, top + s.height, L]);
  const rect: Rect = { x0: outer.min[0], x1: outer.max[0], z0: outer.min[2], z1: outer.max[2] };
  // 両端の扉の開口（区画の外面の床の位置・外向き）
  const topPos = toWorld(anchor, [0, top, 0]), lowPos = toWorld(anchor, [0, low, L]);
  const topDir = addDir(2, anchor.q), lowDir = addDir(0, anchor.q);
  const openings = [opening(`${cellId}:top`, topPos, topDir, DOOR_W, DOOR_H), opening(`${cellId}:bottom`, lowPos, lowDir, DOOR_W, DOOR_H)];
  const cell = makeCell({
    id: cellId, role: role === 'down' ? 'exit' : 'entry', rects: [rect], height: s.rise + s.height, floorY: anchor.offset[1] + low,
    palette: s.palette, openings, lights: 'none', name: '階段室', theme: 'CorridorService', audioPreset: '換気・反響', materialKey: `air:${id}`,
  });
  // 模様の基準（どちらの写しも同じ局所の座標で模様を作る）
  cell.uvFrame = { offset: [...anchor.offset], q: anchor.q, pivot: [0, 0, 0] };
  cell.frame = 'group';
  const add = (min: Vec3, max: Vec3, mat: MatId, kind?: string, solid = true): void => {
    const a = boxWorld(anchor, min, max);
    const b: Box = box(a.min, a.max, mat, solid);
    if (kind) b.kind = kind;
    cell.boxes.push(b);
  };
  // 上の踊り場・段・下の踊り場（下の踊り場は区画の床）
  const riser = s.rise / s.steps;
  const z0 = WALL_T, z1 = WALL_T + s.landing;
  add([xi0, low, z0], [xi1, top, z1], s.palette.floor, 'landing');
  for (let i = 0; i < s.steps - 1; i++) add([xi0, low, z1 + i * TREAD], [xi1, top - (i + 1) * riser, z1 + (i + 1) * TREAD], s.palette.floor, 'stairStep');
  // 照明（上と下）・扉の上の非常口の灯り（内側）
  const ceil = top + s.height;
  for (const [zc, y] of [[z0 + s.landing * 0.6, ceil], [L - WALL_T - s.landing * 0.6, ceil]] as const) {
    const c = toWorld(anchor, [0, 0, zc]);
    const panels: Box[] = [];
    lightPanel(panels, c[0], c[2], anchor.q % 2 === 0 ? 0.5 : 1.0, anchor.q % 2 === 0 ? 1.0 : 0.5, anchor.offset[1] + y, s.palette.light);
    cell.boxes.push(...panels);
    cell.lights.push({ pos: [c[0], anchor.offset[1] + y - 0.4, c[2]], color: s.palette.lightColor, intensity: s.palette.lightIntensity, distance: 6 });
  }
  add([-0.22, top + DOOR_H + 0.1, WALL_T], [0.22, top + DOOR_H + 0.24, WALL_T + 0.04], 'lightGreen', undefined, false);
  add([-0.22, low + DOOR_H + 0.1, L - WALL_T - 0.04], [0.22, low + DOOR_H + 0.24, L - WALL_T], 'lightGreen', undefined, false);
  // 扉（局所で蝶番は +x の端・内へ開く）。階の座標の向きへ写す
  const door = (end: 'top' | 'bottom', live: boolean): EntitySpec => {
    const pos = end === 'top' ? topPos : lowPos;
    const odd = anchor.q % 2 === 1;
    const axis: 'x' | 'z' = odd ? 'x' : 'z';
    const hingeL = end === 'top' ? 1 : -1, swingL = 1;
    const hv = rotQ([hingeL, 0, 0], anchor.q);
    const hingeW = Math.sign(odd ? hv[2] : hv[0]) || 1;
    const panel = doorPanel(axis, odd ? pos[0] : pos[2], odd ? pos[2] : pos[0], DOOR_W, pos[1], DOOR_H);
    const params: { [k: string]: Json } = { panel: { min: [...panel.min], max: [...panel.max] }, axis, mat: s.door, hinge: hingeW, swing: (hingeL * swingL) / hingeW, autoCloseSec: closeSec };
    // 描画は局所の座標で作る（どちらの写しも同じ向きの板・同じ模様）。局所: 扉は z = 0 か L の面、板は x に沿う
    const lz = end === 'top' ? 0 : L;
    const lp = doorPanel('z', lz, 0, DOOR_W, end === 'top' ? top : low, DOOR_H);
    params.local = { panel: { min: [...lp.min], max: [...lp.max] }, axis: 'z', hinge: hingeL, swing: swingL };
    params.frame = { offset: [...anchor.offset], q: anchor.q };
    if (!live) params.locked = true;
    return { id: `${cellId}:${end}`, type: 'door', cell: cellId, params };
  };
  const liveEnd = role === 'down' ? 'top' : 'bottom';
  const entities = [door('top', liveEnd === 'top'), door('bottom', liveEnd === 'bottom')];
  const live = `${cellId}:${liveEnd}`, sealed = `${cellId}:${liveEnd === 'top' ? 'bottom' : 'top'}`;
  // 区域の区画との portal（区域の区画 → 階段室の向き）。host の壁の開口は同じ位置で逆向き
  const at = liveEnd === 'top' ? topPos : lowPos;
  const inDir = liveEnd === 'top' ? addDir(topDir, 2) : addDir(lowDir, 2);
  const axisW: 'x' | 'z' = inDir % 2 === 1 ? 'x' : 'z';
  const coord = axisW === 'x' ? at[0] : at[2], along = axisW === 'x' ? at[2] : at[0];
  const p = portal(`p:${host}:${cellId}`, host, cellId, portalAabb(axisW, coord, along, DOOR_W, at[1], DOOR_H), inDir, 'door', live);
  const hostOpening = opening(`${host}:${cellId}`, [...at], inDir, DOOR_W, DOOR_H);
  // 入れ替えの範囲（down は下の半分、up は上の半分）
  let exit: FloorExit | null = null;
  if (to) {
    const [za, zb] = role === 'down' ? [L / 2, L - WALL_T] : [WALL_T, L / 2];
    exit = { id: `${cellId}:exit`, kind: 'stairs', aabb: clean(boxWorld(anchor, [xi0, low - 0.3, za], [xi1, top + 2.2, zb])), to: { floor: to, exitId: id }, airlock: id };
  }
  return { cell, openings, entities, portal: p, hostOpening, exit, anchor, live, sealed, rect };
}
