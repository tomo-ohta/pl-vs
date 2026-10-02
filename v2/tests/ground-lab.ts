/**
 * 床と足場・装置（ground）の試験の道具（*.test.ts ではないので、これ自体は試験として走らない）。
 * - 実験室の部屋（tests/helpers/gimmick-lab.ts の labRoom）を、入口の向き 4 つ × 大きさで組む
 * - Sim を作る・まっすぐ走る・調べる・待つ
 * - 見本のフロア（showcase）にその仕掛けだけを置いて、部屋と隠しを集める（生成の偶然に頼らず、フロアの中で確かめる）
 */
import { defaultTuning, type Tuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import type { CellLayout, EntitySpec, FloorLayout } from '../core/world/layout.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';

export const T = defaultTuning();
let rapier: Awaited<ReturnType<typeof loadRapier>> | null = null;

export async function newSim(floor: FloorLayout, t: Tuning = T): Promise<Sim> {
  rapier ??= await loadRapier();
  return new Sim(floor, { tuning: t, physics: new PhysicsWorld(rapier, 1 / 60) });
}

export function disposeSim(sim: Sim): void { sim.physics?.dispose(); }

/** 実験室の部屋を、入口の向き 4 つ × 大きさ × seed で組む（組めた物だけ） */
export function labRooms(def: string, o: { sizes?: { w: number; d: number; height?: number; kind?: 'room' | 'hall' }[]; exit?: 'none' | 'opposite' | 'side'; seeds?: number[]; t?: Tuning } = {}): (LabRoom & { tag: string; entry: Dir })[] {
  const out: (LabRoom & { tag: string; entry: Dir })[] = [];
  const sizes = o.sizes ?? [{ w: 6.6, d: 8.0 }, { w: 8.6, d: 12.0, kind: 'hall' as const }];
  for (const size of sizes) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of o.seeds ?? [1, 2]) {
    const exit: Dir | null = o.exit === 'opposite' ? ((entry + 2) % 4) as Dir : o.exit === 'side' ? ((entry + 1) % 4) as Dir : null;
    const room = labRoom(def, { ...size, entry, exit, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.35, exitAt: seed === 1 ? 0.5 : 0.62, ...(o.t ? { t: o.t } : {}) });
    if (room) out.push({ ...room, tag: `${size.w}x${size.d} 入口${entry} seed${seed}`, entry });
  }
  return out;
}

export const entitiesOf = (floor: FloorLayout, type: string): EntitySpec[] => floor.entities.filter((e) => e.type === type);

/** 何もせずに sec 秒 */
export function idle(sim: Sim, sec: number, cmd: Partial<InputCommand> = {}): void {
  const p = sim.players[0]!;
  for (let i = 0; i < Math.round(sec / sim.dt); i++) sim.step([{ ...IDLE_COMMAND, yaw: p.yaw, pitch: p.pitch, ...cmd }]);
}

/** 点 at を調べる（その方を向いて E） */
export function press(sim: Sim, at: readonly number[]): void {
  const p = sim.players[0]!;
  const ex = at[0]! - p.pos[0], ez = at[2]! - p.pos[2], ey = at[1]! - (p.pos[1] + p.eye);
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
}

/** 点 to へまっすぐ進む（着くか maxSec 秒まで）。最も低かった足元の高さを返す */
export function runTo(sim: Sim, to: readonly number[], o: { dash?: boolean; maxSec?: number; stopAt?: number; crouch?: boolean } = {}): { reached: boolean; minY: number } {
  const p = sim.players[0]!;
  let minY = p.pos[1];
  for (let i = 0; i < Math.round((o.maxSec ?? 10) / sim.dt); i++) {
    const dx = to[0]! - p.pos[0], dz = to[2]! - p.pos[2];
    if (Math.hypot(dx, dz) < (o.stopAt ?? 0.25)) return { reached: true, minY };
    sim.step([{ ...IDLE_COMMAND, yaw: Math.atan2(-dx, -dz), pitch: 0, moveY: 1, dash: !!o.dash, crouch: !!o.crouch }]);
    minY = Math.min(minY, p.pos[1]);
  }
  return { reached: false, minY };
}

/** 見本のフロアに仕掛け def だけを置く（隠しは差し出された物を全部付ける）。仕掛けの部屋と、その部屋に付いた隠し */
export interface ShowRoom { r: GenReport; floor: FloorLayout; cell: CellLayout; id: string; main: boolean }
export function showcaseRooms(def: string, worlds: number[] = [1, 2, 3], o: { flip?: boolean; dress?: boolean; t?: Tuning } = {}): ShowRoom[] {
  const out: ShowRoom[] = [];
  for (const w of worlds) {
    const r = generateFloorReport({ world: w, depth: 0, variant: 0 }, o.t ?? T, { showcase: { gimmicks: [def], ...(o.flip ? { flip: true } : {}) }, ...(o.dress === false ? {} : { dress: dressCell }) });
    for (const g of r.gimmicks?.gimmicks ?? []) {
      if (g.def !== def) continue;
      out.push({ r, floor: r.floor, cell: r.floor.cells.find((c) => c.id === g.cell)!, id: g.id, main: g.main });
    }
  }
  return out;
}

/** ふつうのフロアの生成で、仕掛け def が置かれた数（worlds 個のフロア） */
export function countInFloors(defs: string[], worlds: number): Map<string, number> {
  const out = new Map<string, number>(defs.map((d) => [d, 0]));
  for (let w = 1; w <= worlds; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, T, {});
    for (const g of r.gimmicks?.gimmicks ?? []) if (out.has(g.def)) out.set(g.def, out.get(g.def)! + 1);
  }
  return out;
}

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z];
