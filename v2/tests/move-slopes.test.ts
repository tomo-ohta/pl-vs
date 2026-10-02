/**
 * 坂の部屋: 逆走エスカレーター（立ち止まると下まで戻される・走ると上れる・踊り場で隠し）と、滑り台の部屋（一方通行で底へ・
 * 出口の階段で上る・底から入口へ戻れる・途中の横の溝の先の棚に扉）。どちらも入口から出口へ歩いて渡れる・生成したフロアに出る
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
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

const t = defaultTuning();
const SIZES = [{ w: 5.2, d: 8.2, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

function rooms(def: string, tt = t): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom(def, { ...size, ...dims, entry, exit: ((entry + 2) % 4) as Dir, seed: seed * 5 + entry, entryAt: seed === 1 ? 0.5 : 0.4, exitAt: seed === 1 ? 0.5 : 0.6, t: tt });
    if (room) out.push({ room, tag: `${size.kind} 入口${entry} seed${seed}` });
  }
  return out;
}

/** 入口から奥への単位ベクトルと yaw */
function forward(room: LabRoom): { yaw: number; f: Vec3 } {
  const e = room.inside, x = room.exitInside!;
  const f: Vec3 = [x[0] - e[0], 0, x[2] - e[2]];
  const l = Math.hypot(f[0], f[2]);
  return { yaw: Math.atan2(-f[0] / l, -f[2] / l), f: [f[0] / l, 0, f[2] / l] };
}

for (const [def, tt] of [['escalator', t], ['slideRoom', makeTuning({ 'move.slide.waterChance': 1 }).tuning], ['slideRoom', makeTuning({ 'move.slide.waterChance': 0 }).tuning]] as const) {
  test(`${def}（実験室）: 入口から出口へ渡れる・穴の底から入口の床へ戻れる`, () => {
    const list = rooms(def, tt);
    const fails: string[] = [];
    const dirs = new Set<string>();
    for (const { room, tag } of list) {
      dirs.add(tag.split(' ')[1]!);
      const sim = new Sim(room.floor, { tuning: tt });
      sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const res = walkTo(sim, 'room', room.exitInside!, 150);
      if (!res.ok) fails.push(`${tag}: 渡れない ${res.reason}`);
      // 底から入口へ
      const bottom = Math.min(...room.cell.boxes.filter((b) => b.solid && b.max[1] < -1).map((b) => b.max[1]));
      const b = new Sim(room.floor, { tuning: tt });
      const c: Vec3 = [(room.inside[0] + room.exitInside![0]) / 2, bottom + 0.05, (room.inside[2] + room.exitInside![2]) / 2];
      b.teleport(0, c, 0);
      for (let i = 0; i < 20; i++) b.step([{ ...IDLE_COMMAND }]);
      if (b.players[0]!.pos[1] < -0.5) {
        const r2 = walkTo(b, 'room', room.inside, 120);
        if (!r2.ok || Math.abs(b.players[0]!.pos[1]) > 0.1) fails.push(`${tag}: 底から入口へ戻れない ${r2.reason}`);
      }
    }
    assert.ok(dirs.size === 4 && list.length >= 8, `組めた ${list.length}（入口の向き ${[...dirs].join(',')}）`);
    assert.deepEqual(fails, []);
  });
}

test('逆走エスカレーター: 立ち止まると下まで戻され、走ると上れる。踊り場で立ち止まると隠しが開く', () => {
  const room = rooms('escalator')[0]!.room;
  const flights = room.floor.entities.filter((e) => e.type === 'ramp');
  assert.equal(flights.length, 2);
  const sim = new Sim(room.floor, { tuning: t });
  const top = flights[1]!.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const c: Vec3 = [(top.x0 + top.x1) / 2, 0, (top.z0 + top.z1) / 2];
  sim.teleport(0, [c[0], 0.0, c[2]], 0);
  for (let i = 0; i < 400; i++) sim.step([{ ...IDLE_COMMAND }]);
  const depth = t['move.escalator.depthM'];
  assert.ok(sim.players[0]!.pos[1] < -depth / 2 + 0.05, `立ち止まると下へ（${sim.players[0]!.pos[1].toFixed(2)}）`);
  // 踊り場（途中の平らな所）で止まる → 踊り場から下へは流れない
  const offer = room.offers.find((o) => o.hook === 'escalator.landing')!;
  assert.ok(offer.modes.includes('appear') && offer.modes.includes('present'));
  const sensor = offer.revealOutput!.replace(/\.done$/, '');
  const st = room.floor.entities.find((e) => e.id === sensor)!;
  const a = st.params.aabb as { min: number[]; max: number[] };
  const s2 = new Sim(room.floor, { tuning: t });
  s2.teleport(0, [(a.min[0]! + a.max[0]!) / 2, -depth / 2 + 0.02, (a.min[2]! + a.max[2]!) / 2], 0);
  for (let i = 0; i < 240; i++) s2.step([{ ...IDLE_COMMAND }]);
  assert.equal(s2.outputOf(sensor, 'done'), 1, '踊り場で立ち止まると開く');
  // 走ると上れる（穴の底から出口の床まで）
  const { yaw } = forward(room);
  const s3 = new Sim(room.floor, { tuning: t });
  const low = flights[0]!.params.rect as { x0: number; z0: number; x1: number; z1: number };
  s3.teleport(0, [(low.x0 + low.x1) / 2, -depth + 0.02, (low.z0 + low.z1) / 2], yaw);
  for (let i = 0; i < 600 && s3.players[0]!.pos[1] < -0.02; i++) s3.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: true }]);
  assert.ok(s3.players[0]!.pos[1] > -0.05, `走ると上れる（${s3.players[0]!.pos[1].toFixed(2)}）`);
});

test('滑り台: 入口の床から乗ると速く底へ（上へは戻れない）・横の溝の先の棚の扉まで行ける', () => {
  const tw = makeTuning({ 'move.slide.waterChance': 1 }).tuning;
  const list = rooms('slideRoom', tw);
  const room = list[0]!.room;
  const slide = room.floor.entities.find((e) => e.id.endsWith('.slide'))!;
  const r = slide.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const { yaw, f } = forward(room);
  const sim = new Sim(room.floor, { tuning: tw });
  // 滑り台の上の端の手前（入口の床）から前へ
  const start: Vec3 = [(r.x0 + r.x1) / 2 - f[0] * 0.6 * (Math.abs(f[0]) > 0.5 ? 1 : 0), 0.02, (r.z0 + r.z1) / 2];
  const sv: Vec3 = Math.abs(f[0]) > 0.5 ? [f[0] > 0 ? r.x0 - 0.3 : r.x1 + 0.3, 0.02, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, 0.02, f[2] > 0 ? r.z0 - 0.3 : r.z1 + 0.3];
  void start;
  sim.teleport(0, sv, yaw);
  let t0 = -1;
  for (let i = 0; i < 300; i++) { sim.step([{ ...IDLE_COMMAND, yaw, moveY: i < 30 ? 1 : 0 }]); if (t0 < 0 && sim.players[0]!.pos[1] < -t['move.slide.depthM'] + 0.1) t0 = i; }
  assert.ok(t0 > 0 && t0 < 150, `速く底へ（${t0} tick）`);
  // 上へは戻れない: 底から滑り台を上る向きに走っても上がれない
  for (let i = 0; i < 180; i++) sim.step([{ ...IDLE_COMMAND, yaw: yaw + Math.PI, moveY: 1, dash: true }]);
  assert.ok(sim.players[0]!.pos[1] < -1.0, `上へは戻れない（${sim.players[0]!.pos[1].toFixed(2)}）`);
  // 横の溝の先の棚（隠しの存在型）へ歩いて行ける
  let found = 0;
  for (const { room: rm, tag } of list) {
    const offer = rm.offers.find((o) => o.hook === 'slide.branch');
    if (!offer) continue;
    found++;
    const d = offer.doorway;
    const inw: [number, number] = ([[0, -1], [-1, 0], [0, 1], [1, 0]] as const)[d.dir] as [number, number];
    const wall = d.dir === 0 ? rm.slot.rect.z1 - 0.15 : d.dir === 2 ? rm.slot.rect.z0 + 0.15 : d.dir === 1 ? rm.slot.rect.x1 - 0.15 : rm.slot.rect.x0 + 0.15;
    const goal: Vec3 = d.dir === 0 || d.dir === 2 ? [d.at, d.y, wall + inw[1] * 0.5] : [wall + inw[0] * 0.5, d.y, d.at];
    const s2 = new Sim(rm.floor, { tuning: tw });
    s2.teleport(0, [rm.inside[0], 0.02, rm.inside[2]], 0);
    const res = walkTo(s2, 'room', goal, 90);
    for (let i = 0; i < 30; i++) s2.step([{ ...IDLE_COMMAND }]);
    assert.ok(res.ok && Math.abs(s2.players[0]!.pos[1] - d.y) < 0.1, `${tag}: 棚へ ${res.reason}（${s2.players[0]!.pos.map((v) => v.toFixed(2))}）`);
  }
  assert.ok(found >= 2, `横の溝 ${found}`);
});

test('坂の部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  const R = await loadRapier();
  for (const def of ['escalator', 'slideRoom']) {
    const list = findRooms(def, 2, { maxWorld: 900 });
    assert.ok(list.length >= 1, `${def}: 見つかった部屋 ${list.length}`);
    for (const room of list) {
      const res = await walkThrough(room, 220);
      assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
      assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
    }
  }
});
