/**
 * 溝・穴を渡る部屋: 走ると抜ける床・見えない足場・吊り橋・振り子の通路。
 * 歩いて渡れる（落ちない）・穴の底のどこからでも入口の床へ戻れる・それぞれの規則（走ると開く・速いと揺れて落ちる・
 * 当たると弾かれる・板に乗ると隠し）・生成したフロアに出て、渡れる・決定的
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
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const SIZES: { w: number; d: number; kind: 'room' | 'hall' }[] = [{ w: 6.6, d: 8.0, kind: 'room' }, { w: 8.6, d: 15.0, kind: 'hall' }];

/** 穴の底の、体が入る点 */
function fallSpots(sim: Sim, room: LabRoom, n: number, seed: number): Vec3[] {
  const y = Math.min(...room.cell.boxes.filter((b) => b.solid && b.max[1] < -1).map((b) => b.max[1]));
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

const CASES: { def: string; exits: ('opposite' | 'side')[] }[] = [
  { def: 'trapdoorFloor', exits: ['opposite', 'side'] },
  { def: 'ghostBridge', exits: ['opposite'] },
  { def: 'swayBridge', exits: ['opposite'] },
  { def: 'pendulumHall', exits: ['opposite'] },
];

for (const c of CASES) {
  test(`${c.def}（実験室）: 入口の向き 4 つ × 出口 × 大きさで、落ちずに渡れる・落ちても入口の床へ戻れる`, async () => {
    const R = await loadRapier();
    const fails: string[] = [];
    const dirs = new Set<number>();
    for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const ex of c.exits) for (const seed of [1, 2]) {
      const exit = (ex === 'opposite' ? (entry + 2) % 4 : (entry + 1) % 4) as Dir;
      const dims = c.def === 'trapdoorFloor' || entry % 2 === 0 ? { w: size.w, d: size.d } : { w: size.d, d: size.w };
      const room = labRoom(c.def, { ...size, ...dims, entry, exit, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.35, exitAt: seed === 1 ? 0.5 : 0.6 });
      if (!room) continue;
      dirs.add(entry);
      const tag = `${size.kind} 入口${entry} 出口${exit} seed${seed}`;
      {
        const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
        let minY = Infinity;
        const step = sim.step.bind(sim);
        (sim as unknown as { step: typeof sim.step }).step = (cmd) => { step(cmd); minY = Math.min(minY, sim.players[0]!.pos[1]); };
        const res = walkTo(sim, 'room', room.exitInside!, 150);
        if (!res.ok) fails.push(`${tag}: 渡れない ${res.reason}`);
        else if (minY < -0.5) fails.push(`${tag}: 渡る途中で落ちた`);
        sim.physics?.dispose();
      }
      const probe = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      const spots = fallSpots(probe, room, 2, seed + entry * 10);
      probe.physics?.dispose();
      if (spots.length < 2) fails.push(`${tag}: 落ちる点が無い`);
      for (const p of spots) {
        const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        sim.teleport(0, p, 0);
        for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
        const res = walkTo(sim, 'room', room.inside, 90);
        if (!res.ok || Math.abs(sim.players[0]!.pos[1]) > 0.1) fails.push(`${tag} (${p.map((v) => v.toFixed(1)).join(', ')}): 入口の床へ戻れない ${res.reason}`);
        sim.physics?.dispose();
      }
    }
    assert.equal(dirs.size, 4, `${c.def}: 入口の向き 4 つとも組めた（${[...dirs].join(',')}）`);
    assert.deepEqual(fails, []);
  });
}

/** 入口から奥への向き（yaw）と単位ベクトル */
function forward(room: LabRoom): { yaw: number; f: Vec3 } {
  const e = room.inside, x = room.exitInside!;
  const f: Vec3 = [x[0] - e[0], 0, x[2] - e[2]];
  const l = Math.hypot(f[0], f[2]);
  return { yaw: Math.atan2(-f[0] / l, -f[2] / l), f: [f[0] / l, 0, f[2] / l] };
}

test('走ると抜ける床: 歩けば開かず、走ると床板が開いて落ちる', () => {
  const room = labRoom('trapdoorFloor', { w: 6.6, d: 8.0, entry: 2, exit: 0, seed: 3 })!;
  const { yaw } = forward(room);
  const walk = new Sim(room.floor, { tuning: t });
  walk.teleport(0, [room.inside[0], 0.02, room.inside[2]], yaw);
  assert.ok(walkTo(walk, 'room', room.exitInside!, 60).ok);
  assert.ok(!walk.drainEvents().some((e) => e.type === 'cue' && e.data?.name === 'trap.open'), '歩けば開かない');
  const run = new Sim(room.floor, { tuning: t });
  run.teleport(0, [room.inside[0], 0.02, room.inside[2]], yaw);
  let minY = 0;
  for (let i = 0; i < 120; i++) { run.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: true }]); minY = Math.min(minY, run.players[0]!.pos[1]); }
  assert.ok(run.drainEvents().some((e) => e.type === 'cue' && e.data?.name === 'trap.open') && minY < -1.5, `走ると落ちる（${minY.toFixed(2)}）`);
});

test('見えない足場: 足場は描かない当たり判定で、その上にだけ埃がある', () => {
  const room = labRoom('ghostBridge', { w: 6.6, d: 8.0, entry: 2, exit: 0, seed: 3 })!;
  const ghosts = room.cell.boxes.filter((b) => b.kind === 'colliderOnly' && b.solid);
  const dust = room.floor.entities.find((e) => e.type === 'dustCover')!;
  assert.ok(ghosts.length >= 4 && (dust.params.rects as unknown[]).length === ghosts.length, `足場 ${ghosts.length}`);
});

test('吊り橋: 歩けば揺れは小さく渡れる。走ると大きく揺れて振り落とされる', () => {
  const room = labRoom('swayBridge', { w: 6.6, d: 8.0, entry: 2, exit: 0, seed: 3 })!;
  const bridge = room.floor.entities.find((e) => e.type === 'swayBridge')!;
  const { yaw } = forward(room);
  const r = bridge.params.rect as { x0: number; x1: number };
  const cx = (r.x0 + r.x1) / 2;
  const walk = new Sim(room.floor, { tuning: t });
  walk.teleport(0, [cx, 0.02, room.inside[2]], yaw);
  let maxAmp = 0, minY = 0;
  for (let i = 0; i < 180; i++) { walk.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]); maxAmp = Math.max(maxAmp, walk.outputOf(bridge.id, 'amp')); minY = Math.min(minY, walk.players[0]!.pos[1]); }
  assert.ok(minY > -0.3 && maxAmp < 2, `歩けば渡れる（揺れ ${maxAmp.toFixed(1)}°・${minY.toFixed(2)}）`);
  let fell = 0;
  for (const phase of [0, 20, 40]) {
    const run = new Sim(room.floor, { tuning: t });
    run.teleport(0, [cx, 0.02, room.inside[2]], yaw);
    for (let i = 0; i < phase; i++) run.step([{ ...IDLE_COMMAND, yaw }]);
    let y = 0;
    for (let i = 0; i < 150; i++) { run.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: true }]); y = Math.min(y, run.players[0]!.pos[1]); }
    if (y < -1) fell++;
  }
  assert.ok(fell >= 2, `走ると振り落とされる（${fell}/3）`);
});

test('振り子の通路: 橋の上で立ち止まると弾かれて落ちる。板に乗っていると隠しが開く（出現型）', () => {
  const room = labRoom('pendulumHall', { w: 6.6, d: 8.0, entry: 2, exit: 0, seed: 3 })!;
  const pend = room.floor.entities.filter((e) => e.type === 'pendulum');
  assert.ok(pend.length >= 1);
  const piv = pend[0]!.params.pivot as number[];
  const sim = new Sim(room.floor, { tuning: t });
  sim.teleport(0, [piv[0]!, 0.02, piv[2]!], 0);
  let minY = 0;
  for (let i = 0; i < 240; i++) { sim.step([{ ...IDLE_COMMAND }]); minY = Math.min(minY, sim.players[0]!.pos[1]); }
  assert.ok(minY < -1, `弾かれて落ちる（${minY.toFixed(2)}）`);
  // 天井の低い部屋では、板に乗る隠しは出さない（乗ると頭がつかえる）
  assert.ok(!room.offers.some((o) => o.hook === 'pendulum.ride'));
  const tall = labRoom('pendulumHall', { w: 6.6, d: 8.0, height: 4.6, entry: 2, exit: 0, seed: 3 })!;
  const offer = tall.offers.find((o) => o.hook === 'pendulum.ride');
  assert.ok(offer && offer.modes[0] === 'appear' && offer.revealOutput);
  const pend2 = tall.floor.entities.filter((e) => e.type === 'pendulum');
  // 板の上に乗せる（振れの端）
  const ride = new Sim(tall.floor, { tuning: t });
  const half = pend2[0]!.params.half as number[];
  let done = false, placed = false;
  for (let i = 0; i < 900 && !done; i++) {
    ride.step([{ ...IDLE_COMMAND }]);
    const st = ride.stateOf(pend2[0]!.id)!;
    const c = st.pos as number[];
    // 振れの端（遅い所）で、板の上へ跳び乗る
    if (!placed && i > 5 && Math.abs(Number(st.angle)) > Number(pend2[0]!.params.amp) * 0.97) { ride.teleport(0, [c[0]!, c[1]! + half[1]! + 0.03, c[2]!], 0); placed = true; }
    done = ride.outputOf(offer.revealOutput!.split('.out')[0]!, 'out') === 1;
  }
  assert.ok(done, '振り子に乗っていると開く');
});

test('溝・穴を渡る部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  const R = await loadRapier();
  for (const c of CASES) {
    const rooms = findRooms(c.def, 2, { maxWorld: 900 });
    assert.ok(rooms.length >= 1, `${c.def}: 見つかった部屋 ${rooms.length}`);
    for (const room of rooms) {
      const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      sim.teleport(0, room.outside, room.yaw);
      const res = walkTo(sim, room.beyond ?? room.cell.id, undefined, 200);
      assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
      sim.physics?.dispose();
      assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
    }
  }
});
