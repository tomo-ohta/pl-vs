/**
 * 物を運ぶ担当の試験の道具: 1 部屋だけのフロア（部品を手で並べる）と、拾う・置く・投げるを実際の入力（E / Q）で行う操作。
 * 道を探さずに、物の近くへ移ってから視線を合わせて調べる（拾う・置くの規則そのものを確かめるため）。
 */
import { defaultTuning } from '../core/config/tuning.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import { makeCell } from '../core/world/build.ts';
import type { Box, EntitySpec, FloorLayout } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';
import type { Vec3 } from '../core/math/vec.ts';

export const tuning = defaultTuning();

/** w × d の部屋（x 0..w・z 0..d、床 y = 0）。boxes と entities を足したフロア */
export function carryFloor(o: { w?: number; d?: number; height?: number; boxes?: Box[]; entities: EntitySpec[]; seed?: number }): FloorLayout {
  const w = o.w ?? 10, d = o.d ?? 10;
  const cell = makeCell({ id: 'room', role: 'lab', rects: [{ x0: 0, z0: 0, x1: w, z1: d }], height: o.height ?? 2.8, palette: themePalette('GenericRoom') });
  cell.boxes.push(...(o.boxes ?? []));
  return {
    id: 'carry-lab', seed: o.seed ?? 1, genVersion: 'lab', tuningVersion: 'lab',
    bounds: { min: [0, -6, 0], max: [w, cell.bounds.max[1], d] },
    cells: [cell], portals: [], entities: o.entities.map((e) => ({ cell: 'room', ...e })), surfaces: [],
    spawn: { pos: [w / 2, 0.02, d - 1], yaw: 0, cell: 'room' }, exits: [],
  };
}

export async function makeSim(floor: FloorLayout): Promise<Sim> {
  const physics = floor.entities.some((e) => partDef(e.type)?.physics) ? new PhysicsWorld(await loadRapier(), 1 / tuning['physics.tickHz']) : null;
  return new Sim(floor, { tuning, physics });
}

export const cmd = (o: Partial<InputCommand> = {}): InputCommand => ({ ...IDLE_COMMAND, ...o });

/** sec 秒進める（操作 c は固定か、時刻の関数） */
export function run(sim: Sim, sec: number, c: InputCommand | ((t: number) => InputCommand) = cmd()): void {
  const n = Math.round(sec / sim.dt);
  for (let i = 0; i < n; i++) {
    const p = sim.players[0]!;
    sim.step([typeof c === 'function' ? c(i * sim.dt) : { ...c, yaw: c.yaw ?? p.yaw }]);
  }
}

/** プレイヤーを足元 pos へ移す（向き yaw） */
export function put(sim: Sim, pos: Vec3, yaw = 0): void {
  sim.teleport(0, [pos[0], pos[1] + 0.02, pos[2]], yaw);
  for (let i = 0; i < 3; i++) sim.step([cmd({ yaw })]);
}

/** 目から点 at を見る向き */
export function aim(sim: Sim, at: Vec3): { yaw: number; pitch: number } {
  const p = sim.players[0]!;
  const ex = at[0] - p.pos[0], ey = at[1] - (p.pos[1] + p.eye), ez = at[2] - p.pos[2];
  return { yaw: Math.atan2(-ex, -ez), pitch: Math.atan2(ey, Math.hypot(ex, ez)) };
}

/** 部品の中心（状態の poses） */
export function centerOf(sim: Sim, id: string): Vec3 {
  const p = sim.stateOf(id)!.poses as number[];
  return [p[0]!, p[1]!, p[2]!];
}

/** 物 id の 1.4 m 手前（水平の向き from から）へ移り、見て調べる（拾う / 入れ替える） */
export function pickUp(sim: Sim, id: string, from: Vec3 | null = null): boolean {
  const c = centerOf(sim, id);
  const p = sim.players[0]!;
  const dir = from ?? [p.pos[0] - c[0], 0, p.pos[2] - c[2]];
  const l = Math.hypot(dir[0], dir[2]) || 1;
  put(sim, [c[0] + (dir[0] / l) * 1.2, 0, c[2] + (dir[2] / l) * 1.2]);
  const a = aim(sim, c);
  sim.step([cmd({ ...a, interact: a })]);
  sim.step([cmd(a)]);
  return sim.players[0]!.holding === id;
}

/** 今の向きで Q（pitch を変えると投げる） */
export function drop(sim: Sim, o: { yaw?: number; pitch?: number; dash?: boolean } = {}): void {
  const p = sim.players[0]!;
  const yaw = o.yaw ?? p.yaw, pitch = o.pitch ?? 0;
  sim.step([cmd({ yaw, pitch })]);
  sim.step([cmd({ yaw, pitch, drop: true, dash: o.dash ?? false })]);
  sim.step([cmd({ yaw, pitch })]);
}

/** 点 at（足元）に立って、点 look を見て Q */
export function placeAt(sim: Sim, stand: Vec3, look: Vec3): void {
  put(sim, stand);
  const a = aim(sim, look);
  sim.step([cmd(a)]);
  sim.step([cmd({ ...a, drop: true })]);
  sim.step([cmd(a)]);
}

/** 持っている物をまっすぐ点 to へ歩いて運ぶ（壁の無い所。速さは moveY と dash） */
export function walk(sim: Sim, to: Vec3, o: { moveY?: number; dash?: boolean; crouch?: boolean; maxSec?: number } = {}): void {
  const p = sim.players[0]!;
  for (let i = 0; i < Math.round((o.maxSec ?? 20) / sim.dt); i++) {
    const dx = to[0] - p.pos[0], dz = to[2] - p.pos[2];
    if (Math.hypot(dx, dz) < 0.2) break;
    sim.step([cmd({ yaw: Math.atan2(-dx, -dz), moveY: o.moveY ?? 1, dash: o.dash ?? false, crouch: o.crouch ?? false })]);
  }
  for (let i = 0; i < 20; i++) sim.step([cmd({ yaw: p.yaw, crouch: o.crouch ?? false })]);
}

/** 溜まったイベントのうち、Cue の名前の一覧 */
export function cues(sim: Sim): string[] {
  return sim.drainEvents().filter((e) => e.type === 'cue').map((e) => String(e.data?.name));
}
