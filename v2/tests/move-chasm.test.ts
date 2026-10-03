/**
 * 溝・穴を渡る部屋: 抜ける床・見えない足場・吊り橋・振り子の通路。
 * 遊び方どおりに渡れる（落ちない）・穴は底の見えない落ちる穴（落ちたら 1 つ下の階へ）・それぞれの規則（ふつうに歩くと開く・速いと揺れて落ちる・
 * 当たると弾かれる・板に乗ると隠し）・生成したフロアに出て、渡れる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';
import { dropSpots, fallsDown } from './helpers/drop.ts';

const t = defaultTuning();
const SIZES: { w: number; d: number; kind: 'room' | 'hall' }[] = [{ w: 6.6, d: 8.0, kind: 'room' }, { w: 8.6, d: 15.0, kind: 'hall' }];

const CASES: { def: string; exits: ('opposite' | 'side')[] }[] = [
  { def: 'trapdoorFloor', exits: ['opposite', 'side'] },
  { def: 'ghostBridge', exits: ['opposite'] },
  { def: 'swayBridge', exits: ['opposite'] },
  { def: 'pendulumHall', exits: ['opposite'] },
];

for (const c of CASES) {
  test(`${c.def}（実験室）: 入口の向き 4 つ × 出口 × 大きさで、落ちずに渡れる・穴へ落ちると縦穴を落ちる`, async () => {
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
      // 抜ける床は穴の上が床板で埋まっている（落ちる所は専用の試験）
      if (c.def === 'trapdoorFloor') continue;
      const probe = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      const spots = dropSpots(probe, room.cell, 2, seed + entry * 10);
      probe.physics?.dispose();
      if (spots.length < 2) fails.push(`${tag}: 落ちる点が無い`);
      for (const p of spots) {
        const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        if (!fallsDown(sim, room.floor, p, 0)) fails.push(`${tag} (${p.map((v) => v.toFixed(1)).join(', ')}): 縦穴を落ちない（y=${sim.players[0]!.pos[1].toFixed(2)}）`);
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

test('抜ける床: しゃがんで止まらずに渡れば開かない。ふつうに歩くと軋んで開き、縦穴へ落ちる。上で立ち止まっても開く', () => {
  const room = labRoom('trapdoorFloor', { w: 6.6, d: 8.0, entry: 2, exit: 0, seed: 3 })!;
  const { yaw } = forward(room);
  const opened = (sim: Sim): boolean => sim.drainEvents().some((e) => e.type === 'cue' && e.data?.name === 'trap.open');
  // 歩く人（しゃがんで渡る手順）
  const crouch = new Sim(room.floor, { tuning: t });
  crouch.teleport(0, [room.inside[0], 0.02, room.inside[2]], yaw);
  assert.ok(walkTo(crouch, 'room', room.exitInside!, 60).ok);
  assert.ok(!opened(crouch) && Math.abs(crouch.players[0]!.pos[1]) < 0.1, 'しゃがんで渡れば開かない');
  // ふつうに歩く・走る
  for (const dash of [false, true]) {
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], yaw);
    let minY = 0;
    for (let i = 0; i < 150; i++) { sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash }]); minY = Math.min(minY, sim.players[0]!.pos[1]); }
    assert.ok(opened(sim) && minY < -6, `${dash ? '走る' : '歩く'}と落ちる（${minY.toFixed(2)}）`);
  }
  // しゃがんで床板の上へ出て、立ち止まる
  const stop = new Sim(room.floor, { tuning: t });
  stop.teleport(0, [room.inside[0], 0.02, room.inside[2]], yaw);
  let minY = 0;
  for (let i = 0; i < 70; i++) stop.step([{ ...IDLE_COMMAND, yaw, moveY: 1, crouch: true }]);
  for (let i = 0; i < 60 * (t['move.chasm.trapStillSec'] + 1.5); i++) { stop.step([{ ...IDLE_COMMAND, yaw, crouch: true }]); minY = Math.min(minY, stop.players[0]!.pos[1]); }
  assert.ok(minY < -1.5, `立ち止まると落ちる（${minY.toFixed(2)}）`);
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
  // 出口の床まで歩く（部屋の外へは出ない）
  const ex = room.exitInside!;
  for (let i = 0; i < 180 && Math.hypot(walk.players[0]!.pos[0] - ex[0], walk.players[0]!.pos[2] - ex[2]) > 0.4; i++) { walk.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]); maxAmp = Math.max(maxAmp, walk.outputOf(bridge.id, 'amp')); minY = Math.min(minY, walk.players[0]!.pos[1]); }
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
      const res = await walkThrough(room, 200);
      assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
      assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
    }
  }
});
