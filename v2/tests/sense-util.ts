/**
 * 担当 sense の試験の道具（tests/sense-*.test.ts が使う）: 実験室の部屋で仕掛けを組む・決めた入力で歩く・立ち止まる。
 */
import { defaultTuning, type Tuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { partDef } from '../core/sim/part.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import type { EntitySpec, FloorLayout, PortalSpec, WallOpening } from '../core/world/layout.ts';
import type { AABB } from '../core/math/aabb.ts';
import { Rng } from '../core/math/rng.ts';
import { doorPanel, makeCell, opening } from '../core/world/build.ts';
import { themePalette } from '../core/world/palettes.ts';
import '../core/gen/gimmicks/index.ts';
import { gimmickDef, type GimmickContext, type GimmickSlot, type SecretOffer } from '../core/gen/gimmicks/types.ts';
import { frontOf } from '../core/gen/gimmicks/util.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { intoCell, portalCenter, type GimmickRoom } from './helpers/gimmick-rooms.ts';

export const T = defaultTuning();

export async function simOf(floor: FloorLayout, t: Tuning = T): Promise<Sim> {
  const physics = floor.entities.some((e) => partDef(e.type)?.physics) ? new PhysicsWorld(await loadRapier(), 1 / t['physics.tickHz']) : null;
  return new Sim(floor, { tuning: t, physics });
}

/** 実験室の部屋（入口の向き entry・出口の向き exit）に仕掛けを組み、入口の内側に立つ Sim を作る */
export async function labSim(def: string, o: { w: number; d: number; height?: number; entry: Dir; exit: Dir | null; entryAt?: number; exitAt?: number; seed?: number; kind?: 'room' | 'hall'; t?: Tuning }): Promise<{ room: LabRoom; sim: Sim } | null> {
  const room = labRoom(def, { seed: 1, ...o });
  if (!room) return null;
  const sim = await simOf(room.floor, o.t);
  sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], yawTo(room.inside, room.exitInside ?? room.cell.bounds.max));
  return { room, sim };
}

/**
 * 扉のある実験室の部屋（helpers/gimmick-lab.ts の labRoom と同じ組み方に、開口ごとの扉の部品を足したもの）。
 * 出口の扉に鍵を掛ける仕掛け（時計・音で開く扉）を試す
 */
export function labRoomDoors(defId: string, o: { w: number; d: number; height?: number; entry: Dir; exit: Dir | null; entryAt?: number; exitAt?: number; seed?: number; kind?: 'room' | 'hall'; t?: Tuning }): LabRoom | null {
  const t = o.t ?? T;
  const seed = o.seed ?? 1;
  const at = (dir: Dir, f: number): Vec3 => { const x = 0.6 + (o.w - 1.2) * f, z = 0.6 + (o.d - 1.2) * f; return dir === 0 ? [x, 0, o.d] : dir === 2 ? [x, 0, 0] : dir === 1 ? [o.w, 0, z] : [0, 0, z]; };
  const openings: WallOpening[] = [opening('room:in', at(o.entry, o.entryAt ?? 0.5), o.entry, 1.0)];
  if (o.exit !== null) openings.push(opening('room:out', at(o.exit, o.exitAt ?? 0.5), o.exit, 1.0));
  const rect = { x0: 0, z0: 0, x1: o.w, z1: o.d };
  const cell = makeCell({ id: 'room', role: 'gimmick', rects: [rect], height: o.height ?? 2.8, palette: themePalette('GenericRoom'), openings });
  const slot: GimmickSlot = { cell, kind: o.kind ?? 'room', openings, main: true, entrance: openings[0]!, exit: openings[1] ?? null, rect };
  const def = gimmickDef(defId);
  if (!def) throw new Error(`仕掛けがありません: ${defId}`);
  const entities: EntitySpec[] = openings.map((op, i) => {
    const axis = op.dir === 0 || op.dir === 2 ? 'z' : 'x';
    const coord = axis === 'z' ? op.pos[2] : op.pos[0];
    const along = axis === 'z' ? op.pos[0] : op.pos[2];
    const pn = doorPanel(axis, coord, along, 1.0, 0, 2.1);
    return { id: `door${i}`, type: 'door', cell: 'room', params: { panel: { min: [...pn.min], max: [...pn.max] }, axis, mat: 'doorWood', hinge: 1, swing: 1 } };
  });
  const offers: SecretOffer[] = [];
  const keepOut: AABB[] = [];
  let added = 0;
  const ctx: GimmickContext = {
    slot, rng: new Rng(seed), tuning: t, id: `g:${defId}:room`,
    floor: { id: 'lab', seed, depth: 1, rarity: 'Common', family: 'lab' },
    addBox(b) { cell.boxes.push(b); added++; return b; },
    addEntity(name, e) { const id = `g:${defId}:room.${name}`; entities.push({ ...e, id, cell: e.cell ?? 'room' } as EntitySpec); added++; return id; },
    addZone(z) { cell.zones.push(z); },
    keepOut(a) { keepOut.push(a); },
    frontOf: (op, dd = 1.0) => frontOf(op, dd),
    offerSecret(of) { offers.push(of); },
    doorAt: (op) => entities[openings.indexOf(op)] ?? null,
    removeBoxes(pred) { cell.boxes = cell.boxes.filter((b) => !pred(b)); },
    reachAssist() {},
  };
  if (def.fits && !def.fits(slot)) return null;
  def.build(ctx);
  if (!added) return null;
  const floor: FloorLayout = {
    id: 'lab', seed, genVersion: 'lab', tuningVersion: 'lab',
    bounds: { min: [cell.bounds.min[0] - 2, cell.bounds.min[1] - 6, cell.bounds.min[2] - 2], max: [cell.bounds.max[0] + 2, cell.bounds.max[1], cell.bounds.max[2] + 2] },
    cells: [cell], portals: [], entities, surfaces: [], spawn: { pos: frontOf(openings[0]!, 1.0), yaw: 0, cell: 'room' }, exits: [],
  };
  const inside = frontOf(openings[0]!, 1.0);
  return { floor, cell, slot, offers, keepOut, inside: [inside[0], 0, inside[2]], exitInside: openings[1] ? (() => { const p = frontOf(openings[1]!, 1.0); return [p[0], 0, p[2]] as Vec3; })() : null };
}

/** 扉のある実験室で Sim を作る（入口の内側に立つ） */
export async function labSimDoors(def: string, o: Parameters<typeof labRoomDoors>[1]): Promise<{ room: LabRoom; sim: Sim } | null> {
  const room = labRoomDoors(def, o);
  if (!room) return null;
  const sim = await simOf(room.floor, o.t);
  sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], yawTo(room.inside, room.exitInside ?? room.cell.bounds.max));
  return { room, sim };
}

/** a から b を向く yaw（yaw 0 で -Z） */
export const yawTo = (a: readonly number[], b: readonly number[]): number => Math.atan2(-(b[0]! - a[0]!), -(b[2]! - a[2]!));

export function entitiesOf(floor: FloorLayout, type: string): EntitySpec[] {
  return floor.entities.filter((e) => e.type === type);
}

export function stand(sim: Sim, sec: number, c: Partial<InputCommand> = {}): void {
  const p = sim.players[0]!;
  for (let i = 0; i < Math.round(sec / sim.dt); i++) sim.step([{ ...IDLE_COMMAND, yaw: p.yaw, pitch: p.pitch, ...c }]);
}

export interface GoOptions {
  pitch?: number;
  flashlight?: boolean;
  dash?: boolean;
  crouch?: boolean;
  maxSec?: number;
  /** 毎 tick 呼ぶ。true を返したらやめる */
  until?: (sim: Sim) => boolean;
  /** 向く先（無ければ進む先） */
  look?: Vec3;
}

/** 点 (x, z) へまっすぐ歩く。着いたら true（0.25 m 以内） */
export function goTo(sim: Sim, x: number, z: number, o: GoOptions = {}): boolean {
  const p = sim.players[0]!;
  const n = Math.round((o.maxSec ?? 20) / sim.dt);
  for (let i = 0; i < n; i++) {
    const dx = x - p.pos[0], dz = z - p.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.25) return true;
    if (o.until?.(sim)) return false;
    const moveYaw = Math.atan2(-dx, -dz);
    const yaw = o.look ? yawTo(p.pos, o.look) : moveYaw;
    // 向きと進む向きが違うときは、横歩き（moveX）を混ぜる
    const rel = moveYaw - yaw;
    sim.step([{ ...IDLE_COMMAND, yaw, pitch: o.pitch ?? 0, moveY: Math.cos(rel), moveX: -Math.sin(rel), dash: !!o.dash, crouch: !!o.crouch, flashlight: o.flashlight ?? true }]);
  }
  return false;
}

/** 点 (x, z) の方へ 1 tick だけ歩く（近ければ止まる。必ず 1 tick 進める） */
export function stepToward(sim: Sim, x: number, z: number, o: GoOptions = {}): void {
  const p = sim.players[0]!;
  const dx = x - p.pos[0], dz = z - p.pos[2];
  const d = Math.hypot(dx, dz);
  const moveYaw = d > 1e-6 ? Math.atan2(-dx, -dz) : p.yaw;
  const yaw = o.look ? yawTo(p.pos, o.look) : moveYaw;
  const rel = moveYaw - yaw;
  const k = d < 0.08 ? 0 : 1;
  sim.step([{ ...IDLE_COMMAND, yaw, pitch: o.pitch ?? 0, moveY: Math.cos(rel) * k, moveX: -Math.sin(rel) * k, dash: !!o.dash, crouch: !!o.crouch, flashlight: o.flashlight ?? true }]);
}

/**
 * 生成したフロアから、いくつかの仕掛けの部屋を一度に集める（helpers/gimmick-rooms.ts の findRooms と同じ部屋の読み方。
 * フロアを作るのは 1 回ずつ）。仕掛けごとに want 個まで
 */
const ROOM_CACHE = new Map<string, Map<string, GimmickRoom[]>>();
export function findSenseRooms(defs: readonly string[], want: number, maxWorld = 600): Map<string, GimmickRoom[]> {
  const key = `${defs.join(',')}|${want}|${maxWorld}`;
  const hit = ROOM_CACHE.get(key);
  if (hit) return hit;
  const out = new Map<string, GimmickRoom[]>(defs.map((d) => [d, []]));
  for (let w = 1; w <= maxWorld && defs.some((d) => out.get(d)!.length < want); w++) {
    const floorKey = { world: w, depth: 1 + (w % 9), variant: w % 3 === 0 ? 1 : 0 };
    const r = generateFloorReport(floorKey, T, { dress: dressCell });
    if (!r.gimmicks?.gimmicks.some((g) => defs.includes(g.def) && out.get(g.def)!.length < want)) continue;
    for (const room of roomsOf(r, floorKey)) if (defs.includes(room.def) && out.get(room.def)!.length < want) out.get(room.def)!.push(room.room);
  }
  ROOM_CACHE.set(key, out);
  return out;
}

function roomsOf(r: GenReport, key: { world: number; depth: number; variant: number }): { def: string; room: GimmickRoom }[] {
  const floor = r.floor;
  const prev = new Map<string, string | null>([[floor.spawn.cell, null]]);
  const q = [floor.spawn.cell];
  for (let h = 0; h < q.length && !prev.has('exitStairs'); h++) for (const p of floor.portals) {
    if (!p.cells.includes(q[h]!)) continue;
    const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
    if (!prev.has(o)) { prev.set(o, q[h]!); q.push(o); }
  }
  const main: string[] = [];
  for (let c: string | null | undefined = 'exitStairs'; c; c = prev.get(c)) main.unshift(c);
  const out: { def: string; room: GimmickRoom }[] = [];
  for (const g of r.gimmicks?.gimmicks ?? []) {
    const cell = floor.cells.find((c) => c.id === g.cell)!;
    const stop = r.gimmicks!.tour.find((s) => s.cell === g.cell)!;
    const portals = floor.portals.filter((p) => p.cells.includes(g.cell) && !p.cells.some((c) => c.startsWith('secret')));
    const d = (p: PortalSpec): number => { const c = portalCenter(p); return Math.hypot(c[0] - stop.pos[0], c[2] - stop.pos[2]); };
    const entry = portals.slice().sort((a, b) => d(a) - d(b))[0]!;
    const idx = main.indexOf(g.cell);
    let exit: PortalSpec | null = null;
    if (g.main && idx >= 0 && idx + 1 < main.length) exit = portals.find((p) => p.cells.includes(main[idx + 1]!)) ?? null;
    exit ??= portals.filter((p) => p !== entry).sort((a, b) => d(b) - d(a))[0] ?? null;
    const other = (p: PortalSpec | null): string | null => (p ? (p.cells[0] === g.cell ? p.cells[1] : p.cells[0]) : null);
    out.push({ def: g.def, room: { key, r, floor, cell, id: g.id, main: g.main, outside: stop.pos, yaw: stop.yaw, entry, inside: intoCell(entry, cell, 1.0), exit, beyond: other(exit) } });
  }
  return out;
}

/** 区画の床から下へ落ちたか */
export const fell = (sim: Sim, floorY: number): boolean => sim.players[0]!.pos[1] < floorY - 0.8;
