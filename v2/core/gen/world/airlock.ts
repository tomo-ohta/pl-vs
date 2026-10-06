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

/** 階段室・エレベーターの形（id と種類だけで決まる） */
export interface AirlockShape {
  kind: 'stairs' | 'lift';
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

export function airlockShape(id: string, t: Tuning, kind: 'stairs' | 'lift' = 'stairs'): AirlockShape {
  const r = new Rng(hashAll(id, 'airlock'));
  if (kind === 'lift') {
    // エレベーターのかご: 外 2.4 m 角（壁を含む）・天井 2.5 m・上下の階で同じ（局所の座標で y = 0 が床）
    const W = t['world.lift.widthM'];
    const base = themePalette('CorridorService');
    return { kind, width: W, length: W, rise: 0, height: 2.5, landing: 0, steps: 0, palette: { ...base, floor: 'floorLino', wall: 'stainless', ceiling: 'ceilingWhite', door: 'stainless', lightIntensity: base.lightIntensity * 0.9 }, door: 'stainless' };
  }
  const rise = t['floor.levelHeightM'];
  const steps = Math.ceil(rise / RISER_MAX - 1e-9);
  const landing = 1.2;
  const inner = landing * 2 + (steps - 1) * TREAD;
  const pal = r.pick(PALETTES);
  const base = themePalette('CorridorService');
  return {
    kind, width: t['world.airlock.widthM'], length: Math.round((inner + 2 * WALL_T) * 20) / 20, rise, height: 2.6, landing, steps,
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
  /** 区域の区画（host）の側に置く物（扉の上の案内板・エレベーターの呼ぶボタン） */
  hostEntities: EntitySpec[];
  /** エレベーターのかごの部品 */
  car?: string;
}

const toWorld = (a: AirlockAnchor, p: Vec3): Vec3 => { const r = rotQ(p, a.q); return [r[0] + a.offset[0], r[1] + a.offset[1], r[2] + a.offset[2]]; };
function boxWorld(a: AirlockAnchor, min: Vec3, max: Vec3): AABB {
  const p = toWorld(a, min), q = toWorld(a, max);
  return { min: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], max: [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])] };
}
const r2 = (v: number): number => Math.round(v * 1e6) / 1e6;
const clean = (a: AABB): AABB => ({ min: [r2(a.min[0]), r2(a.min[1]), r2(a.min[2])], max: [r2(a.max[0]), r2(a.max[1]), r2(a.max[2])] });
const aj = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

/**
 * 階段室の置き方を、区域の区画（host）の壁の点 wall（host の床の高さ）と外向き side から決める。
 * down は上の扉を、up は下の扉を、その壁の点に当てる
 */
export function airlockAnchor(role: 'down' | 'up', wall: Vec3, side: Dir, s: AirlockShape): AirlockAnchor {
  if (role === 'down' || s.kind === 'lift') return { offset: [wall[0], wall[1], wall[2]], q: side };
  const q = addDir(side, 2);
  const b = rotQ([0, -s.rise, s.length], q);
  return { offset: [r2(wall[0] - b[0]), r2(wall[1] - b[1]), r2(wall[2] - b[2])], q };
}

/**
 * 階段室を置く。cellId は区域の中の区画の id、host は区域の側の区画（扉の向こう）、to は向こうの階（'depth.variant'。
 * null は向こうが無い = 入れ替えない）
 */
export function placeAirlock(id: string, role: 'down' | 'up', cellId: string, host: string, anchor: AirlockAnchor, s: AirlockShape, to: string | null, closeSec: number, t?: Tuning): PlacedAirlock {
  if (s.kind === 'lift') return placeLift(id, role, cellId, host, anchor, s, to, t);
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
  const hostEntities = hostSign(cellId, host, at, inDir, role, to, 'stairs');
  return { cell, openings, entities, portal: p, hostOpening, exit, anchor, live, sealed, rect, hostEntities };
}

/** 移る所の扉の前（区域の区画の側。家具を置かない範囲） */
export function hostFront(o: WallOpening): AABB {
  const n = rotQ([0, 0, 1], o.dir);
  const c: Vec3 = [o.pos[0] - n[0] * 1.2, o.pos[1], o.pos[2] - n[2] * 1.2];
  const half = n[0] !== 0 ? [1.3, 1.0] : [1.0, 1.3];
  return { min: [c[0] - half[0]!, c[1], c[2] - half[1]!], max: [c[0] + half[0]!, c[1] + 2.4, c[2] + half[1]!] };
}

/** 上から着く所の中の、出てくる位置（階段室は上の踊り場・エレベーターはかごの真ん中） */
export function airlockSpawn(a: { kind?: 'stairs' | 'lift'; anchor: AirlockAnchor; cell: string }, t: Tuning): { pos: Vec3; yaw: number; cell: string } {
  const q = a.anchor.q;
  const f = rotQ([0, 0, 1], q);
  const lp = rotQ(a.kind === 'lift' ? [0, 0.02, t['world.lift.widthM'] / 2] : [0, 0.02, WALL_T + 0.7], q);
  const s = (v: number): number => Math.round(v * 20) / 20;
  return { pos: [s(lp[0] + a.anchor.offset[0]), a.anchor.offset[1] + 0.02, s(lp[2] + a.anchor.offset[2])], yaw: Math.atan2(-f[0], -f[2]), cell: a.cell };
}

/** 階の名前（深さ 0 が B1F） */
const floorName = (to: string): string => `B${Number(to.split('.')[0]) + 1}F`;

/**
 * 扉の上の案内板（区域の区画の側の壁）: 「▼ 階段 B5F」「▲ エレベーター B3F」。緑の非常口の色で、遠くから見える。
 * at は扉の床の真ん中（区画どうしの境の面）、inDir は区域の区画から移る所へ向かう向き
 */
function hostSign(cellId: string, host: string, at: Vec3, inDir: Dir, role: 'down' | 'up', to: string | null, kind: 'stairs' | 'lift'): EntitySpec[] {
  if (!to) return [];
  const n = rotQ([0, 0, 1], inDir);
  const face = WALL_T + 0.025;
  const pos: Vec3 = [r2(at[0] - n[0] * face), r2(at[1] + DOOR_H + 0.32), r2(at[2] - n[2] * face)];
  const text = `${role === 'down' ? '▼' : '▲'} ${kind === 'lift' ? 'エレベーター' : '階段'} ${floorName(to)}`;
  return [{ id: `${cellId}:sign`, type: 'signPlate', cell: host, params: { pos: [...pos], dir: addDir(inDir, 2), w: kind === 'lift' ? 1.5 : 1.25, h: 0.3, text, fg: '#eafff0', bg: '#0f7a3c', glow: true } }];
}

/**
 * エレベーター（14 章）: 引き戸のかご。上の階と下の階の区域に同じ形で置き、戸が閉まって動いている間に、向こうの階の写しへ移す。
 * 局所の座標: 戸の床の真ん中が原点、+z がかごの奥。かごの床が y = 0（どちらの写しも同じ）。
 * かごの中のボタンは上の階と下の階の 2 つ（どちらの写しも同じ表示）。外の呼ぶボタンで戸が開く（区域の区画の側）
 */
function placeLift(id: string, role: 'down' | 'up', cellId: string, host: string, anchor: AirlockAnchor, s: AirlockShape, to: string | null, t?: Tuning): PlacedAirlock {
  const W = s.width, L = s.length, H = s.height, T = WALL_T;
  const outer = boxWorld(anchor, [-W / 2, 0, 0], [W / 2, H, L]);
  const rect: Rect = { x0: outer.min[0], x1: outer.max[0], z0: outer.min[2], z1: outer.max[2] };
  const doorPos = toWorld(anchor, [0, 0, 0]);
  const outDir = addDir(2, anchor.q);
  const openings = [opening(`${cellId}:door`, doorPos, outDir, DOOR_W, DOOR_H)];
  const cell = makeCell({
    id: cellId, role: role === 'down' ? 'exit' : 'entry', rects: [rect], height: H, floorY: anchor.offset[1],
    palette: s.palette, openings, lights: 'none', name: 'エレベーター', theme: 'CorridorService', audioPreset: '換気・反響', materialKey: `lift:${id}`,
  });
  cell.uvFrame = { offset: [...anchor.offset], q: anchor.q, pivot: [0, 0, 0] };
  cell.frame = 'group';
  const add = (min: Vec3, max: Vec3, mat: MatId, solid = false): void => { const a = boxWorld(anchor, min, max); cell.boxes.push(box(a.min, a.max, mat, solid)); };
  const xi0 = -W / 2 + T, xi1 = W / 2 - T, zi0 = T, zi1 = L - T;
  // 内張り（横と奥）・手すり・床の敷物・天井の灯り
  add([xi0, 0.06, zi0], [xi0 + 0.01, H - 0.05, zi1], 'stainless');
  add([xi1 - 0.01, 0.06, zi0], [xi1, H - 0.05, zi1], 'stainless');
  add([xi0, 0.06, zi1 - 0.01], [xi1, H - 0.05, zi1], 'stainless');
  add([xi0 + 0.25, 0.88, zi1 - 0.07], [xi1 - 0.25, 0.93, zi1 - 0.02], 'handrailWood');
  add([xi0 + 0.01, 0.88, zi0 + 0.3], [xi0 + 0.06, 0.93, zi1 - 0.3], 'handrailWood');
  add([xi0, 0, zi0], [xi1, 0.004, zi1], 'carpetPattern');
  add([-0.5, H - 0.03, (zi0 + zi1) / 2 - 0.35], [0.5, H, (zi0 + zi1) / 2 + 0.35], 'lightPanel');
  const lc = toWorld(anchor, [0, H - 0.35, (zi0 + zi1) / 2]);
  cell.lights.push({ pos: lc, color: 0xf4f0e6, intensity: 0.55, distance: 3.2 });
  // 戸（引き戸。局所で作って写す）。かごの部品が開け閉めする
  const odd = anchor.q % 2 === 1;
  const axis: 'x' | 'z' = odd ? 'x' : 'z';
  const panel = doorPanel(axis, odd ? doorPos[0] : doorPos[2], odd ? doorPos[2] : doorPos[0], DOOR_W, doorPos[1], DOOR_H);
  const lp = doorPanel('z', 0, 0, DOOR_W, 0, DOOR_H);
  const door = `${cellId}:door`, car = `${cellId}:car`, call = `${cellId}:call`;
  const doorSpec: EntitySpec = {
    id: door, type: 'door', cell: cellId,
    params: { panel: { min: [...panel.min], max: [...panel.max] }, axis, mat: 'stainless', hinge: 1, swing: 1, autoCloseSec: 0, slide: true, openSec: 0.9, local: { panel: { min: [...lp.min], max: [...lp.max] }, axis: 'z', hinge: 1, swing: 1 }, frame: { offset: [...anchor.offset], q: anchor.q } },
    inputs: { open: `${car}.open` },
  };
  // かごの中のボタン（戸の横の壁の内側）: 上の階と下の階（どちらの写しも同じ）
  const upper = role === 'down' ? Number((to ?? '1.0').split('.')[0]) - 1 : Number((to ?? '0.0').split('.')[0]);
  const labels = [`B${upper + 1}`, `B${upper + 2}`];
  const buttons: EntitySpec[] = labels.map((label, i) => {
    const bx = 0.78, by = 1.35 - i * 0.22;
    const a = boxWorld(anchor, [bx - 0.04, by - 0.04, zi0], [bx + 0.04, by + 0.04, zi0 + 0.03]);
    return { id: `${cellId}:b${i}`, type: 'pushButton', cell: cellId, params: { box: { min: [...a.min], max: [...a.max] }, mat: 'stainless', glow: 0xffd890, range: 1.8, litSec: 0.6, label } };
  });
  add([0.66, 1.0, zi0], [0.9, 1.5, zi0 + 0.012], 'metalDark');
  // ボタンの横の階の名前（かごの中。どちらの写しも同じ）
  const labelSpecs: EntitySpec[] = labels.map((label, i) => ({ id: `${cellId}:l${i}`, type: 'signPlate', cell: cellId, params: { pos: [...toWorld(anchor, [0.62, 1.35 - i * 0.22, zi0 + 0.016])], dir: anchor.q, w: 0.16, h: 0.07, text: label, fg: '#e8e4da', bg: '#20242a' } }));
  // 呼ぶボタン（外。区域の区画の壁の、戸の横）
  const ca = boxWorld(anchor, [0.85 - 0.045, 1.1, -T - 0.03], [0.85 + 0.045, 1.2, -T]);
  const callSpec: EntitySpec = { id: call, type: 'pushButton', cell: host, params: { box: { min: [...ca.min], max: [...ca.max] }, mat: 'stainless', glow: 0xffb050, range: 2.2, litSec: 3, label: role === 'down' ? '▼' : '▲' } };
  const inside = boxWorld(anchor, [xi0 + 0.05, -0.2, zi0 + 0.05], [xi1 - 0.05, 2.2, zi1 - 0.05]);
  const hall = boxWorld(anchor, [-1.6, -0.2, -T - 2.6], [1.6, 2.2, 0]);
  const carSpec: EntitySpec = {
    id: car, type: 'liftCar', cell: cellId,
    params: { inside: aj(clean(inside)), hall: aj(clean(hall)), rideSec: t?.['world.lift.rideSec'] ?? 4, arriveSec: t?.['world.lift.arriveSec'] ?? 1.2, live: !!to },
    inputs: { call: `${call}.pressed`, touch: `${door}.touched`, go0: `${cellId}:b0.pressed`, go1: `${cellId}:b1.pressed`, door: `${door}.angle` },
  };
  const entities = [doorSpec, carSpec, ...buttons, ...labelSpecs];
  const inDir = addDir(outDir, 2);
  const axisW: 'x' | 'z' = inDir % 2 === 1 ? 'x' : 'z';
  const coord = axisW === 'x' ? doorPos[0] : doorPos[2], along = axisW === 'x' ? doorPos[2] : doorPos[0];
  const p = portal(`p:${host}:${cellId}`, host, cellId, portalAabb(axisW, coord, along, DOOR_W, doorPos[1], DOOR_H), inDir, 'door', door);
  const hostOpening = opening(`${host}:${cellId}`, [...doorPos], inDir, DOOR_W, DOOR_H);
  const exit: FloorExit | null = to ? { id: `${cellId}:exit`, kind: 'elevator', aabb: clean(inside), to: { floor: to, exitId: id }, airlock: id } : null;
  const callLabel: EntitySpec = { id: `${call}:label`, type: 'signPlate', cell: host, params: { pos: [...toWorld(anchor, [0.85, 1.32, -T - 0.02])], dir: outDir, w: 0.12, h: 0.12, text: role === 'down' ? '▼' : '▲', fg: '#ffb050', bg: '#2a2d32' } };
  return { cell, openings, entities, portal: p, hostOpening, exit, anchor, live: door, sealed: door, rect, hostEntities: [callSpec, callLabel, ...hostSign(cellId, host, doorPos, inDir, role, to, 'lift')], car };
}
