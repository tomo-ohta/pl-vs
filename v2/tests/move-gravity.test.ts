/**
 * 重力の向きが変わる部屋（gravityHall）: 帯をたどって床 → 壁 → 天井 → 壁 → 床とひと回りできる（天井で横道の隠し）・
 * 迷路の上の天井を渡れる・筒の通路は歩くだけで立つ面が一周して床へ戻る。どれも歩いて渡れる・生成したフロアに出る・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTuning, type Tuning } from '../core/config/tuning.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import '../core/sim/parts/index.ts';
import { gravUp, rotQuarter } from '../core/sim/player.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const V = ['loop', 'maze', 'tube'] as const;
const only = (v: (typeof V)[number]): Tuning => makeTuning(Object.fromEntries(V.map((k) => [`move.grav.w.${k}`, k === v ? 1 : 0]))).tuning;
const SIZES = [{ w: 4.2, d: 10, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

function rooms(tt: Tuning, height: number): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of SIZES) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom('gravityHall', { ...size, ...dims, height, entry, exit: ((entry + 2) % 4) as Dir, seed: seed * 5 + entry, entryAt: 0.5, exitAt: 0.5, t: tt });
    if (room) out.push({ room, tag: `${size.w}x${size.d} 入口${entry} seed${seed}` });
  }
  return out;
}

/** 世界の向き want へ進む操作（今の重力の向きの中の yaw） */
function toward(sim: Sim, want: Readonly<Vec3>): { yaw: number } {
  const g = sim.players[0]!.grav;
  const l = g ? rotQuarter(want, g.axis, 4 - g.k) : [...want];
  return { yaw: Math.atan2(-l[0]!, -l[2]!) };
}

/** want の向きへ押し続け、cond になるまで（最大 sec 秒） */
function pushUntil(sim: Sim, want: Readonly<Vec3>, cond: () => boolean, sec: number): boolean {
  for (let i = 0; i < sec * 60; i++) {
    if (cond()) return true;
    sim.step([{ ...IDLE_COMMAND, ...toward(sim, want), moveY: 1 }]);
  }
  return cond();
}

const upIs = (sim: Sim, v: Readonly<Vec3>): boolean => { const u = gravUp(sim.players[0]!.grav); return u[0] * v[0] + u[1] * v[1] + u[2] * v[2] > 0.9; };

for (const v of V) {
  test(`重力の部屋（${v}・実験室）: 入口の向き 4 つ × 大きさで、入口から出口へ歩いて渡れる`, () => {
    const tt = only(v);
    const list = rooms(tt, 3.5).filter(({ room }) => (v === 'tube' ? room.cell.zones.some((z) => z.kind === 'twist') : v === 'maze' ? room.cell.boxes.some((b) => b.kind === 'mazeWall') : room.cell.zones.some((z) => z.kind === 'magnet')));
    assert.ok(list.length >= 8, `組めた ${list.length}`);
    const fails: string[] = [];
    for (const { room, tag } of list) {
      const sim = new Sim(room.floor, { tuning: tt });
      sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const res = walkTo(sim, 'room', room.exitInside!, 150);
      for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
      if (!res.ok) fails.push(`${tag}: ${res.reason}`);
      else if (sim.players[0]!.grav) fails.push(`${tag}: 出口で重力が戻っていない`);
    }
    assert.deepEqual(fails, []);
  });
}

test('重力の回廊: 帯をたどって床 → 横の壁 → 天井 → 反対の壁 → 床とひと回りできる。天井をしばらく歩くと横道が開く', () => {
  const tt = only('loop');
  const list = rooms(tt, 3.5).filter(({ room }) => room.offers.some((o) => o.hook === 'grav.ceiling'));
  assert.ok(list.length >= 4, `横道のある部屋 ${list.length}`);
  for (const { room, tag } of list.slice(0, 4)) {
    const sim = new Sim(room.floor, { tuning: tt });
    const p = sim.players[0]!;
    const zones = room.cell.zones.filter((z) => z.kind === 'magnet');
    const lo = zones.find((z) => z.vector && Math.abs(z.vector[1]) < 0.5 && z === zones.filter((x) => x.vector && Math.abs(x.vector[1]) < 0.5)[0])!;
    const side: Vec3 = [lo.vector![0], 0, lo.vector![2]]; // 低い側の壁の内向き
    const band = lo.aabb;
    const bc: Vec3 = [(band.min[0] + band.max[0]) / 2, 0, (band.min[2] + band.max[2]) / 2];
    // 帯の上、低い側の壁の 1.2 m 手前から
    sim.teleport(0, [bc[0] + side[0] * 0.7, 0.02, bc[2] + side[2] * 0.7], 0);
    for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(pushUntil(sim, [-side[0], 0, -side[2]], () => upIs(sim, side), 4), `${tag}: 壁に乗る`);
    assert.ok(pushUntil(sim, [0, 1, 0], () => upIs(sim, [0, -1, 0]), 6), `${tag}: 天井に乗る（${p.pos.map((x) => x.toFixed(2))}）`);
    const sensor = room.offers.find((o) => o.hook === 'grav.ceiling')!.revealOutput!.replace(/\.done$/, '');
    for (let i = 0; i < 60 * (tt['move.grav.ceilingSec'] + 0.5) && !sim.outputOf(sensor, 'done'); i++) sim.step([{ ...IDLE_COMMAND, ...toward(sim, side), moveY: 0.3 }]);
    assert.equal(sim.outputOf(sensor, 'done'), 1, `${tag}: 天井を歩くと横道が開く`);
    assert.ok(pushUntil(sim, side, () => upIs(sim, [-side[0], 0, -side[2]]), 8), `${tag}: 反対の壁に乗る（${p.pos.map((x) => x.toFixed(2))}）`);
    assert.ok(pushUntil(sim, [0, -1, 0], () => !p.grav && p.onGround, 8), `${tag}: 床へ戻る（${p.pos.map((x) => x.toFixed(2))}）`);
    assert.ok(Math.abs(p.pos[1]) < 0.05);
  }
});

test('重力の迷路: 入口の近くの壁の帯から天井へ上がり、迷路の上を渡って出口の近くで床へ下りられる', () => {
  const tt = only('maze');
  const list = rooms(tt, 3.5).filter(({ room }) => room.cell.boxes.some((b) => b.kind === 'mazeWall'));
  assert.ok(list.length >= 4, `迷路の部屋 ${list.length}`);
  for (const { room, tag } of list.slice(0, 4)) {
    const sim = new Sim(room.floor, { tuning: tt });
    const p = sim.players[0]!;
    const walls = room.cell.zones.filter((z) => z.kind === 'magnet' && z.vector && Math.abs(z.vector[1]) < 0.5);
    const near = (z: (typeof walls)[number]): number => Math.hypot((z.aabb.min[0] + z.aabb.max[0]) / 2 - room.inside[0], (z.aabb.min[2] + z.aabb.max[2]) / 2 - room.inside[2]);
    walls.sort((a, b) => near(a) - near(b));
    const w0 = walls[0]!, w1 = walls[1]!;
    const s0: Vec3 = [w0.vector![0], 0, w0.vector![2]];
    const c0: Vec3 = [(w0.aabb.min[0] + w0.aabb.max[0]) / 2, 0, (w0.aabb.min[2] + w0.aabb.max[2]) / 2];
    sim.teleport(0, [c0[0] + s0[0] * 0.6, 0.02, c0[2] + s0[2] * 0.6], 0);
    for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(pushUntil(sim, [-s0[0], 0, -s0[2]], () => upIs(sim, s0), 4), `${tag}: 壁に乗る`);
    assert.ok(pushUntil(sim, [0, 1, 0], () => upIs(sim, [0, -1, 0]), 6), `${tag}: 天井に乗る`);
    // 天井を出口の帯の上まで（迷路の仕切りの上を通る）
    const c1: Vec3 = [(w1.aabb.min[0] + w1.aabb.max[0]) / 2, 0, (w1.aabb.min[2] + w1.aabb.max[2]) / 2];
    const s1: Vec3 = [w1.vector![0], 0, w1.vector![2]];
    const dest: Vec3 = [c1[0] + s1[0] * 0.6, 0, c1[2] + s1[2] * 0.6];
    for (let i = 0; i < 60 * 15; i++) {
      const dx = dest[0] - p.pos[0], dz = dest[2] - p.pos[2];
      if (Math.hypot(dx, dz) < 0.3) break;
      const l = Math.hypot(dx, dz);
      sim.step([{ ...IDLE_COMMAND, ...toward(sim, [dx / l, 0, dz / l]), moveY: 1 }]);
    }
    assert.ok(upIs(sim, [0, -1, 0]) && Math.hypot(dest[0] - p.pos[0], dest[2] - p.pos[2]) < 0.4, `${tag}: 天井を渡る（${p.pos.map((x) => x.toFixed(2))}）`);
    assert.ok(pushUntil(sim, [-s1[0], 0, -s1[2]], () => upIs(sim, s1), 6), `${tag}: 出口の側の壁に乗る`);
    assert.ok(pushUntil(sim, [0, -1, 0], () => !p.grav && p.onGround, 8), `${tag}: 床へ下りる（${p.pos.map((x) => x.toFixed(2))}）`);
  }
});

test('筒の通路: 前へ歩くだけで、立つ面が壁 → 天井 → 反対の壁と回り、出口の側で床へ戻る', () => {
  const tt = only('tube');
  const list = rooms(tt, 3.0).filter(({ room }) => room.cell.zones.some((z) => z.kind === 'twist'));
  assert.ok(list.length >= 4, `筒の部屋 ${list.length}`);
  for (const { room, tag } of list.slice(0, 4)) {
    const sim = new Sim(room.floor, { tuning: tt });
    const p = sim.players[0]!;
    const ups = new Set<string>();
    const a = room.inside, b = room.exitInside!;
    const ax = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]) ? 0 : 2;
    const sg = Math.sign(ax === 0 ? b[0] - a[0] : b[2] - a[2]);
    const yaw = ax === 0 ? Math.atan2(-sg, 0) : Math.atan2(0, -sg);
    sim.teleport(0, [a[0], 0.02, a[2]], yaw);
    for (let i = 0; i < 60 * 12; i++) {
      sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
      ups.add(gravUp(p.grav).map((x) => Math.round(x)).join(','));
      if ((ax === 0 ? p.pos[0] - b[0] : p.pos[2] - b[2]) * sg > -0.2) break;
    }
    for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
    assert.ok(ups.size === 4 && ups.has('0,-1,0'), `${tag}: 四つの面に立つ（${[...ups].join(' / ')}）`);
    assert.ok(!p.grav && Math.abs(p.pos[1]) < 0.05 && (ax === 0 ? p.pos[0] - b[0] : p.pos[2] - b[2]) * sg > -0.5, `${tag}: 出口の側で床へ（${p.pos.map((x) => x.toFixed(2))}）`);
  }
});

test('重力の部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  await loadRapier();
  const list = findRooms('gravityHall', 3, { maxWorld: 900 });
  assert.ok(list.length >= 1, `見つかった部屋 ${list.length}`);
  for (const room of list) {
    const res = await walkThrough(room, 220);
    assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
    assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
  }
});
