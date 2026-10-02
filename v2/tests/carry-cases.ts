/**
 * 物を運ぶ担当の仕掛けの試験の一覧（試す仕掛けと出口の向き）と、実験室の部屋を作る道具（carry-gimmicks / carry-views が使う）
 */
import { defaultTuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { bodyFree } from './carry-solvers.ts';

const t = defaultTuning();
const SIZES: { w: number; d: number; kind: 'room' | 'hall'; height?: number }[] = [{ w: 6.6, d: 8.0, kind: 'room' }, { w: 8.6, d: 12.0, kind: 'hall', height: 3.4 }];

/** 仕掛けと、試す出口の向き（opposite: 入口の向かい / side: 隣の壁 / none: 行き止まり） */
/** walk 'exit': 何もしないで通る代わりに、部屋のあちこちから入口へ歩いて戻れる（押される床・弾く柱の部屋） */
export const CARRY_CASES: { def: string; exits: ('opposite' | 'side' | 'none')[]; minDirs?: number; walk?: 'exit' }[] = [
  { def: 'carryWater', exits: ['opposite', 'side', 'none'] },
  { def: 'parcelGate', exits: ['opposite', 'side', 'none'] },
  { def: 'bookCollect', exits: ['opposite', 'side', 'none'] },
  { def: 'chairRoom', exits: ['opposite', 'side', 'none'] },
  { def: 'alignChairs', exits: ['opposite', 'side', 'none'] },
  { def: 'weightHatch', exits: ['opposite', 'side', 'none'] },
  { def: 'keycardGate', exits: ['opposite', 'side', 'none'] },
  { def: 'lostItem', exits: ['none', 'side'] },
  { def: 'bulbRoom', exits: ['opposite', 'side', 'none'] },
  { def: 'replicaRoom', exits: ['opposite', 'side', 'none'] },
  { def: 'homeObject', exits: ['opposite', 'side', 'none'] },
  { def: 'dialLock', exits: ['none'] },
  { def: 'colorMix', exits: ['none'] },
  { def: 'clockRoom', exits: ['none'] },
  { def: 'bellOrder', exits: ['none'] },
  { def: 'bulbOrder', exits: ['none'] },
  { def: 'tilePicture', exits: ['none'] },
  { def: 'shadowPuzzle', exits: ['none'] },
  { def: 'mirrorPuzzle', exits: ['none'] },
  { def: 'furnitureMatch', exits: ['none'] },
  { def: 'balanceScale', exits: ['none'] },
  { def: 'mazeModel', exits: ['none'] },
  { def: 'footPattern', exits: ['none'] },
  { def: 'tiltMarble', exits: ['none', 'side'] },
  { def: 'bowlingLane', exits: ['none', 'side'], minDirs: 2 },
  { def: 'golfRoom', exits: ['none', 'side'] },
  { def: 'tagRoom', exits: ['none', 'side'] },
  { def: 'hideSeek', exits: ['none', 'side'] },
  { def: 'pinballHall', exits: ['none'], walk: 'exit' },
  { def: 'cartLoop', exits: ['none', 'side'] },
  { def: 'targetGallery', exits: ['none', 'side'] },
  { def: 'memoryRoom', exits: ['none'] },
  { def: 'shadowPose', exits: ['none', 'side'] },
  { def: 'pianoFloor', exits: ['none', 'side'] },
  { def: 'ringRoom', exits: ['none', 'side'] },
];

/** 行き止まりの部屋の奥: 入口からいちばん遠い、体を置ける床の点（0.5 m 格子） */
export function farPoint(sim: Sim, room: LabRoom): Vec3 {
  const r = room.slot.rect;
  let best: Vec3 = [(r.x0 + r.x1) / 2, room.cell.floorY, (r.z0 + r.z1) / 2], bd = -1;
  for (let x = r.x0 + 0.6; x < r.x1 - 0.5; x += 0.5) for (let z = r.z0 + 0.6; z < r.z1 - 0.5; z += 0.5) {
    const p: Vec3 = [x, room.cell.floorY, z];
    const d = Math.hypot(x - room.inside[0], z - room.inside[2]);
    if (d > bd && bodyFree(sim, p)) { bd = d; best = p; }
  }
  return best;
}

export async function newSim(room: LabRoom): Promise<Sim> {
  const physics = room.floor.entities.some((e) => partDef(e.type)?.physics) ? new PhysicsWorld(await loadRapier(), 1 / 60) : null;
  return new Sim(room.floor, { tuning: t, physics });
}

export function rooms(def: string, exits: ('opposite' | 'side' | 'none')[], seeds = [1]): { room: LabRoom; tag: string; entry: Dir }[] {
  const out: { room: LabRoom; tag: string; entry: Dir }[] = [];
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const ex of exits) for (const seed of seeds) {
    const exit = ex === 'none' ? null : ((ex === 'opposite' ? (entry + 2) % 4 : (entry + 1) % 4) as Dir);
    const room = labRoom(def, { ...size, entry, exit, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.3, exitAt: seed === 1 ? 0.5 : 0.65 });
    if (room) out.push({ room, tag: `${size.kind} 入口${entry} 出口${exit} seed${seed}`, entry });
  }
  return out;
}

