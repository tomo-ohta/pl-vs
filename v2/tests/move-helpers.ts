/**
 * 移動と身体の試験の共通の道具（試験ではない）: 生成したフロアの仕掛けの部屋を、入口の内側から出口の先まで歩く。
 * 入口の外が扉と扉の間の短い切れ端のことがあるので（歩く人の「扉の手前」の点がもう一つの扉の向こうになる）、入口の内側から歩く。
 * 出口の先も短い切れ端なら、部屋の出口の内側まで
 */
import { defaultTuning } from '../core/config/tuning.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { walkTo, type WalkResult } from './helpers/bot.ts';
import { intoCell, type GimmickRoom } from './helpers/gimmick-rooms.ts';

export async function walkThrough(room: GimmickRoom, maxSec = 220): Promise<WalkResult> {
  const R = await loadRapier();
  const t = defaultTuning();
  const physics = room.floor.entities.some((e) => partDef(e.type)?.physics) ? new PhysicsWorld(R, 1 / 60) : null;
  const sim = new Sim(room.floor, { tuning: t, physics });
  sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
  const beyond = room.beyond ? room.floor.cells.find((c) => c.id === room.beyond) : null;
  const tiny = !beyond || Math.min(beyond.bounds.max[0] - beyond.bounds.min[0], beyond.bounds.max[2] - beyond.bounds.min[2]) < 1.5;
  const res = tiny || !room.exit ? walkTo(sim, room.cell.id, room.exit ? intoCell(room.exit, room.cell, 1.0) : undefined, maxSec) : walkTo(sim, room.beyond!, undefined, maxSec);
  physics?.dispose();
  return res;
}
