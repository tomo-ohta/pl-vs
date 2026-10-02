/**
 * 長い部屋・這う部屋: 後ろ向きの通路（前を向くと押し戻される）・伸びる廊下（歩くと戻され、止まると前へ滑る）・
 * 縮むトンネル（自動でしゃがむ・後ろ向きに歩くと別の出口）・ダクト（脇の隙間の先に扉）。どれも渡れる・生成したフロアに出る
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
const SIZES = [{ w: 3.6, d: 9.0, kind: 'room' as const }, { w: 2.2, d: 9.5, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

function crossAll(def: string, tt = t, sizes = SIZES, exits: ('opposite' | 'side')[] = ['opposite']): { built: number; fails: string[] } {
  const fails: string[] = [];
  let built = 0;
  for (const size of sizes) for (const entry of [0, 1, 2, 3] as Dir[]) for (const ex of exits) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const exit = ((entry + (ex === 'opposite' ? 2 : 1)) % 4) as Dir;
    const room = labRoom(def, { ...size, ...dims, entry, exit, seed: 5 + entry, t: tt });
    if (!room) continue;
    built++;
    const sim = new Sim(room.floor, { tuning: tt });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', room.exitInside!, 150);
    if (!res.ok) fails.push(`${size.w}x${size.d} 入口${entry} 出口${exit}: ${res.reason}`);
  }
  return { built, fails };
}

/** 入口から奥への向き（yaw）と、奥への単位ベクトル */
function forward(room: LabRoom): { yaw: number; f: Vec3 } {
  const e = room.inside, x = room.exitInside!;
  const f: Vec3 = [x[0] - e[0], 0, x[2] - e[2]];
  const l = Math.hypot(f[0], f[2]);
  return { yaw: Math.atan2(-f[0] / l, -f[2] / l), f: [f[0] / l, 0, f[2] / l] };
}

for (const def of ['backwardHall', 'stretchHall']) {
  test(`${def}（実験室）: 入口の向き 4 つ × 大きさで、入口から出口へ渡れる`, () => {
    const { built, fails } = crossAll(def);
    assert.ok(built >= 10, `組めた ${built}`);
    assert.deepEqual(fails, []);
  });
}

test('後ろ向きの通路: 前を向いて歩くと押し戻され、後ろ向きなら進める', () => {
  const room = labRoom('backwardHall', { w: 3.6, d: 9, entry: 2, exit: 0, seed: 1 })!;
  const { yaw, f } = forward(room);
  const start: Vec3 = [room.inside[0] + f[0] * 1.5, 0.02, room.inside[2] + f[2] * 1.5];
  const s1 = new Sim(room.floor, { tuning: t });
  s1.teleport(0, start, yaw);
  for (let i = 0; i < 120; i++) s1.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
  const d1 = (s1.players[0]!.pos[2] - start[2]) * f[2] + (s1.players[0]!.pos[0] - start[0]) * f[0];
  const s2 = new Sim(room.floor, { tuning: t });
  s2.teleport(0, start, yaw + Math.PI);
  for (let i = 0; i < 120; i++) s2.step([{ ...IDLE_COMMAND, yaw: yaw + Math.PI, moveY: -1 }]);
  const d2 = (s2.players[0]!.pos[2] - start[2]) * f[2] + (s2.players[0]!.pos[0] - start[0]) * f[0];
  assert.ok(d1 < 0.2 && d2 > 4, `前向き ${d1.toFixed(2)} m / 後ろ向き ${d2.toFixed(2)} m`);
});

test('伸びる廊下: 歩き続けても境目を越えられず（戻される）、立ち止まると前へ滑って越え、出口まで歩ける', () => {
  const room = labRoom('stretchHall', { w: 2.4, d: 11, entry: 2, exit: 0, seed: 2 })!;
  const spec = room.floor.entities.find((e) => e.type === 'stretchWarp')!;
  const origin = spec.params.origin as number[];
  const { yaw, f } = forward(room);
  const along = (p: Vec3): number => (p[0] - origin[0]!) * f[0] + (p[2] - origin[2]!) * f[2];
  const sim = new Sim(room.floor, { tuning: t });
  sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], yaw);
  for (let i = 0; i < 360; i++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
  assert.ok(along(sim.players[0]!.pos) < 0.05 && sim.outputOf(spec.id, 'warps') >= 2, `歩くと戻される（${along(sim.players[0]!.pos).toFixed(2)}・${sim.outputOf(spec.id, 'warps')} 回）`);
  const warps = sim.drainEvents().filter((e) => e.type === 'player.respawn' && e.data?.cause === 'warp');
  assert.ok(warps.length >= 2 && warps.every((e) => e.data?.seamless === true), '継ぎ目なく戻す');
  for (let i = 0; i < 240; i++) sim.step([{ ...IDLE_COMMAND, yaw }]);
  assert.ok(along(sim.players[0]!.pos) > 0.3, `止まると前へ滑る（${along(sim.players[0]!.pos).toFixed(2)}）`);
  assert.ok(!sim.drainEvents().some((e) => e.type === 'player.stride'), '滑っている間は足音が鳴らない');
  const res = walkTo(sim, 'room', room.exitInside!, 30);
  assert.ok(res.ok, res.reason);
});

test('這う部屋（縮むトンネル・ダクト）: 入口の向き 4 つ × 出口の向き × 大きさで、自動でしゃがんで渡れる', () => {
  for (const shrink of [1, 0]) {
    const tt = makeTuning({ 'move.crawl.shrinkChance': shrink }).tuning;
    const sizes = [{ w: 3.6, d: 8.0, kind: 'room' as const }, { w: 6, d: 7.5, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];
    const { built, fails } = crossAll('crawlTunnel', tt, sizes, shrink ? ['opposite'] : ['opposite', 'side']);
    assert.ok(built >= 10, `組めた ${built}`);
    assert.deepEqual(fails, [], shrink ? '縮むトンネル' : 'ダクト');
  }
});

test('縮むトンネル（出現型の隠し）: 立ったまま後ろ向きに歩き続けると開く。普通に通るだけでは開かない', () => {
  const tt = makeTuning({ 'move.crawl.shrinkChance': 1 }).tuning;
  const room = labRoom('crawlTunnel', { w: 3.6, d: 9.0, entry: 2, exit: 0, seed: 3, t: tt })!;
  assert.ok(room.cell.zones.some((z) => z.kind === 'crawl'), '低い所がある');
  const offer = room.offers.find((o) => o.hook === 'tunnel.backward')!;
  assert.ok(offer && offer.modes[0] === 'appear');
  const sensor = offer.revealOutput!.replace(/\.done$/, '');
  const a = new Sim(room.floor, { tuning: tt });
  a.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
  let crouched = false;
  const step = a.step.bind(a);
  (a as unknown as { step: typeof a.step }).step = (c) => { step(c); crouched ||= a.players[0]!.crouching; };
  assert.ok(walkTo(a, 'room', room.exitInside!, 120).ok);
  assert.ok(crouched, '途中で自動でしゃがむ');
  assert.equal(a.outputOf(sensor, 'done'), 0, '普通に通るだけでは開かない');
  // 出口を向いたまま、入口の方へ下がる（入口の前から 1 m 奥 → 入口の前へ、を往復）
  const { yaw } = forward(room);
  const b = new Sim(room.floor, { tuning: tt });
  b.teleport(0, [room.inside[0], 0.02, room.inside[2] + 1.6], yaw);
  for (let i = 0; i < 300 && !b.outputOf(sensor, 'done'); i++) b.step([{ ...IDLE_COMMAND, yaw, moveY: Math.floor(i / 40) % 2 ? 1 : -1 }]);
  assert.equal(b.outputOf(sensor, 'done'), 1, '後ろ向きに歩き続けると開く');
});

test('ダクト（存在型の隠し）: 脇の低い隙間の先の小部屋まで、しゃがんで行ける', () => {
  const tt = makeTuning({ 'move.crawl.shrinkChance': 0 }).tuning;
  let found = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const room = labRoom('crawlTunnel', { w: 6, d: 7.5, entry: 2, exit: 1, seed, t: tt });
    const offer = room?.offers.find((o) => o.hook === 'duct.gap');
    if (!room || !offer) continue;
    found++;
    const d = offer.doorway;
    const inward: [number, number] = ([[0, -1], [-1, 0], [0, 1], [1, 0]] as const)[d.dir] as [number, number];
    const goal: Vec3 = d.dir === 0 || d.dir === 2 ? [d.at, 0, (d.dir === 0 ? room.slot.rect.z1 : room.slot.rect.z0) + inward[1] * 0.8] : [(d.dir === 1 ? room.slot.rect.x1 : room.slot.rect.x0) + inward[0] * 0.8, 0, d.at];
    const sim = new Sim(room.floor, { tuning: tt });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', goal, 120);
    assert.ok(res.ok, `seed ${seed}: ${res.reason}`);
  }
  assert.ok(found >= 3, `隙間の小部屋 ${found}`);
});

test('長い部屋・這う部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  const R = await loadRapier();
  for (const def of ['backwardHall', 'stretchHall', 'crawlTunnel']) {
    const rooms = findRooms(def, 2, { maxWorld: 800 });
    assert.ok(rooms.length >= 1, `${def}: 見つかった部屋 ${rooms.length}`);
    for (const room of rooms) {
      const res = await walkThrough(room, 200);
      assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
      assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
    }
  }
});
