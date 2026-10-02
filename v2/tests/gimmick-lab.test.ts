/**
 * 仕掛けの実験室（1 部屋だけのフロア）で、入口の向き 4 つ・出口の向き（向かい・隣の壁）・部屋の大きさを全部試す:
 * 部屋まるごとの仕掛け（崩れる床・細い道・細い梁の網・一方通行の歩道迷路・導く光の迷路）は、
 * 入口の内側から出口の内側まで歩いて渡れる（穴・溝では落ちずに）・穴の底のどこからでも入口の床へ戻れる・
 * 歩道迷路はどの乗り換えの床からも入口の床へ戻れる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { Rng } from '../core/math/rng.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { WALL_T } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';

const t = defaultTuning();
const SIZES: { w: number; d: number; kind: 'room' | 'hall' }[] = [{ w: 6.6, d: 8.0, kind: 'room' }, { w: 8.6, d: 15.0, kind: 'hall' }];

/** 穴の底の、体が入る点 */
function fallSpots(sim: Sim, room: LabRoom, n: number, seed: number): Vec3[] {
  const y = Math.min(...room.cell.boxes.filter((b) => b.solid && b.max[1] < -1).map((b) => b.max[1]));
  if (!Number.isFinite(y)) return [];
  const r = room.slot.rect;
  const rng = new Rng(seed);
  const out: Vec3[] = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const x = rng.float(r.x0 + WALL_T + 0.4, r.x1 - WALL_T - 0.4), z = rng.float(r.z0 + WALL_T + 0.4, r.z1 - WALL_T - 0.4);
    const under = sim.colliders.query(x - 0.12, y - 0.1, z - 0.12, x + 0.12, y + 0.05, z + 0.12).some((b) => Math.abs(b.max[1] - y) < 1e-3);
    const body = sim.colliders.query(x - 0.37, y + 0.05, z - 0.37, x + 0.37, y + 1.7, z + 0.37).some((b) => b.max[1] > y + 0.05 && b.min[1] < y + 1.7);
    if (under && !body) out.push([x, y + 0.02, z]);
  }
  return out;
}

const CASES: { def: string; exits: ('opposite' | 'side')[]; pit: boolean }[] = [
  { def: 'crumbleFloor', exits: ['opposite', 'side'], pit: true },
  { def: 'narrowPath', exits: ['opposite'], pit: true },
  { def: 'beamNetwork', exits: ['opposite'], pit: true },
  { def: 'beltMaze', exits: ['opposite', 'side'], pit: false },
  { def: 'guideLight', exits: ['opposite', 'side'], pit: false },
];

for (const c of CASES) {
  test(`実験室 ${c.def}: 入口の向き 4 つ × 出口の向き × 大きさで、渡れる・落ちても入口へ戻れる`, async () => {
    const R = await loadRapier();
    const fails: string[] = [];
    const builtDirs = new Set<number>();
    let builds = 0, walks = 0;
    for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const ex of c.exits) for (const seed of [1, 2]) {
      const exit = (ex === 'opposite' ? (entry + 2) % 4 : (entry + 1) % 4) as Dir;
      const room = labRoom(c.def, { ...size, entry, exit, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.3, exitAt: seed === 1 ? 0.5 : 0.65 });
      if (!room) continue;
      builds++;
      builtDirs.add(entry);
      const tag = `${size.kind} 入口${entry} 出口${exit} seed${seed}`;
      // 渡る
      {
        const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
        let minY = Infinity;
        const step = sim.step.bind(sim);
        (sim as unknown as { step: typeof sim.step }).step = (cmd) => { step(cmd); minY = Math.min(minY, sim.players[0]!.pos[1]); };
        const res = walkTo(sim, 'room', room.exitInside!, 120);
        walks++;
        if (!res.ok) fails.push(`${tag}: 渡れない ${res.reason}`);
        else if (c.pit && minY < -0.5) fails.push(`${tag}: 渡る途中で落ちた`);
        sim.physics?.dispose();
      }
      // 落ちた所から入口の床へ / 乗り換えの床から入口の床へ
      const starts: Vec3[] = [];
      if (c.pit) {
        const probe = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        starts.push(...fallSpots(probe, room, 3, seed + entry * 10));
        probe.physics?.dispose();
        if (starts.length < 2) fails.push(`${tag}: 落ちる点が無い`);
      } else if (c.def === 'beltMaze') {
        for (const e of room.floor.entities.filter((x) => x.type === 'forceZone')) {
          const a = e.params.aabb as { min: number[]; max: number[] };
          const v = e.params.vector as number[];
          // 帯の下流の端の先（乗り換えの床）
          const cx = (a.min[0]! + a.max[0]!) / 2, cz = (a.min[2]! + a.max[2]!) / 2;
          starts.push(Math.abs(v[0]!) > 0.5 ? [v[0]! > 0 ? a.max[0]! + 0.4 : a.min[0]! - 0.4, 0.02, cz] : [cx, 0.02, v[2]! > 0 ? a.max[2]! + 0.4 : a.min[2]! - 0.4]);
        }
      }
      for (const p of starts) {
        const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        sim.teleport(0, p, 0);
        for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
        const res = walkTo(sim, 'room', room.inside, 90);
        walks++;
        if (!res.ok || Math.abs(sim.players[0]!.pos[1]) > 0.1) fails.push(`${tag} (${p.map((v) => v.toFixed(1)).join(', ')}): 入口の床へ戻れない ${res.reason}`);
        sim.physics?.dispose();
      }
    }
    console.log(`  ${c.def}: 組めた ${builds}、歩いた ${walks}、入口の向き ${[...builtDirs].sort().join(',')}`);
    assert.equal(builtDirs.size, 4, `${c.def}: 入口の向き 4 つとも組めた`);
    assert.deepEqual(fails, []);
  });
}
