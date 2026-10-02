/**
 * 曲がると変わる景色（cornerSwap: W07）: 通路を抜けて角を曲がり、背を向けると通路が次の部屋に変わり、切れ目が反対の端へ移る・
 * 古い切れ目は通れない・新しい切れ目から来た扉へ戻れる・出て戻るたびに次の部屋・変わる瞬間は通路も切れ目も見えていない・
 * 通路の中にいる間は変わらない・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { aabbCenter, type AABB } from '../core/math/aabb.ts';
import type { Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import type { SwapBox } from '../core/sim/parts/warp/swap.ts';
import { inBox, readAabb, seenBy } from '../core/sim/parts/warp/util.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout, Json } from '../core/world/layout.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import type { Dir } from '../core/math/vec.ts';
import type { PortalSpec } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('cornerSwap', 5, { maxWorld: 300 });

const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;

interface Corner { swap: string; passage: AABB; also: AABB[]; plug: AABB[]; out: Vec3 }

function cornerOf(f: FloorLayout, id: string): Corner {
  const swap = `${id}.swap`;
  const slot = (ent(f, swap).params.slots as { region: Json; also: Json[]; variants: SwapBox[][] }[])[0]!;
  const passage = readAabb(slot.region);
  const also = slot.also.map(readAabb);
  // 組 0・1 の最初の箱が切れ目の塞ぎ（組 0 は遠い端・組 1 は近い端を塞ぐ）
  const plug = [0, 1].map((k) => { const b = slot.variants[k]![0]!; return { min: [b.min[0]!, b.min[1]!, b.min[2]!], max: [b.max[0]!, b.max[1]!, b.max[2]!] } as AABB; });
  // 部屋の奥の向き: 塞ぎの箱の薄い向き（仕切りの厚み）で、通路の真ん中から塞ぎへ
  const pc = aabbCenter(passage), bc = aabbCenter(plug[0]!);
  const ax = plug[0]!.max[0] - plug[0]!.min[0] < plug[0]!.max[2] - plug[0]!.min[2] ? 0 : 2;
  const out: Vec3 = [0, 0, 0];
  out[ax] = Math.sign(bc[ax]! - pc[ax]!);
  return { swap, passage, also, plug, out };
}

/** 開口（portal）の、区画の壁の外面の床位置と外向き */
function portalFloor(p: PortalSpec, b: AABB): Vec3 {
  const c = aabbCenter(p.aabb);
  const alongX = p.aabb.max[0] - p.aabb.min[0] > p.aabb.max[2] - p.aabb.min[2];
  if (alongX) return [c[0], p.aabb.min[1], Math.abs(c[2] - b.min[2]) < Math.abs(c[2] - b.max[2]) ? b.min[2] : b.max[2]];
  return [Math.abs(c[0] - b.min[0]) < Math.abs(c[0] - b.max[0]) ? b.min[0] : b.max[0], p.aabb.min[1], c[2]];
}
function outward(p: PortalSpec, b: AABB): Dir {
  const c = aabbCenter(p.aabb);
  const alongX = p.aabb.max[0] - p.aabb.min[0] > p.aabb.max[2] - p.aabb.min[2];
  if (alongX) return Math.abs(c[2] - b.min[2]) < Math.abs(c[2] - b.max[2]) ? 2 : 0;
  return Math.abs(c[0] - b.min[0]) < Math.abs(c[0] - b.max[0]) ? 3 : 1;
}

const cur = (sim: Sim, swap: string): number => Number((sim.stateOf(swap)?.cur as number[] | undefined)?.[0] ?? -1);

/** 点を順にたどって歩く */
function walkPath(sim: Sim, pts: Vec3[], each: () => void, maxSec = 30): boolean {
  let k = 0;
  for (let i = 0; i < 60 * maxSec && k < pts.length; i++) {
    const p = sim.players[0]!.pos;
    const q = pts[k]!;
    if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.3) { k++; continue; }
    stepWith(sim, 1, () => ({ yaw: faceTo(p, q), moveY: 1 }));
    each();
  }
  return k === pts.length;
}

test('曲がると変わる景色: 角を曲がって背を向けると、通路が次の部屋になり切れ目が反対の端へ・古い切れ目は通れず新しい切れ目から戻れる', () => {
  assert.ok(ROOMS.length >= 3, `曲がると変わる景色: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor;
    const c = cornerOf(f, room.id);
    const y = room.cell.floorY;
    const sim = new Sim(f, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
    const pc = aabbCenter(c.passage);
    const start: Vec3 = inBox([room.inside[0], c.passage.min[1] + 0.2, room.inside[2]], c.passage) ? room.inside : [pc[0], y, pc[2]];
    sim.teleport(0, [start[0], y + 0.02, start[2]], faceTo(start, pc));
    stepWith(sim, 5, () => ({}));
    const bad: string[] = [];
    let prev = cur(sim, c.swap);
    const watch = (): void => {
      const v = cur(sim, c.swap);
      if (v !== prev) {
        const p = sim.players[0]!;
        if ([c.passage, ...c.also].some((a) => seenBy(p, a, (q, r) => sim.sightClear(q, r)))) bad.push(`tick ${sim.tick}: 見えている間に変わった`);
        if (inBox([p.pos[0], p.pos[1] + 0.9, p.pos[2]], c.passage)) bad.push(`tick ${sim.tick}: 通路の中で変わった`);
      }
      prev = v;
    };
    assert.equal(cur(sim, c.swap), 0);
    // 組 0 の切れ目 = 組 1 の塞ぎの所。切れ目を抜けて部屋の奥へ
    const gap = (k: number): Vec3 => { const g = aabbCenter(c.plug[(k + 1) % 2]!); return [g[0], y, g[2]]; };
    const beyond = (k: number, d: number): Vec3 => { const g = gap(k); return [g[0] + c.out[0] * d, y, g[2] + c.out[2] * d]; };
    const inner = (k: number): Vec3 => { const g = gap(k); return [g[0] - c.out[0] * 0.8, y, g[2] - c.out[2] * 0.8]; };
    assert.ok(walkPath(sim, [inner(0), gap(0), beyond(0, 0.7), beyond(0, 1.9)], watch), `${room.cell.id}: 切れ目を抜けて部屋の奥へ`);
    // 部屋の奥を向いて立つ（通路と切れ目に背を向ける）: 次の部屋に変わる
    const away = Math.atan2(-c.out[0], -c.out[2]);
    for (let i = 0; i < 90 && cur(sim, c.swap) === 0; i++) { stepWith(sim, 1, () => ({ yaw: away })); watch(); }
    assert.equal(cur(sim, c.swap), 1, `${room.cell.id}: 背を向けると次の部屋に変わる`);
    // 振り返って古い切れ目へ向かっても、通路に入れない
    const g0 = gap(0);
    for (let i = 0; i < 60 * 3; i++) { stepWith(sim, 1, () => ({ yaw: faceTo(sim.players[0]!.pos, g0), moveY: 1 })); watch(); }
    const p = sim.players[0]!.pos;
    assert.ok(!inBox([p[0], p[1] + 0.9, p[2]], c.passage, -0.05), `${room.cell.id}: 古い切れ目は塞がっている`);
    // 新しい切れ目（組 1 の切れ目）から通路へ入り、来た扉へ戻れる（歩く人）
    assert.ok(walkPath(sim, [beyond(1, 1.3), beyond(1, 0.6), gap(1), inner(1)], watch), `${room.cell.id}: 新しい切れ目から通路へ`);
    const r = walkTo(sim, room.entry.cells[0] === room.cell.id ? room.entry.cells[1] : room.entry.cells[0], undefined, 60);
    assert.ok(r.ok, `${room.cell.id}: 来た扉から出られる: ${r.reason}`);
    sim.drainEvents();
    // 扉の外へ出て（扉が閉まって通路が見えなくなると）、通路はまた次の部屋になる
    for (let i = 0; i < 60 * 6 && cur(sim, c.swap) === 1; i++) { stepWith(sim, 1, () => ({})); watch(); }
    assert.equal(cur(sim, c.swap), 2, `${room.cell.id}: 出て戻ると次の部屋`);
    assert.deepEqual(bad, [], `${room.cell.id}: ${bad.slice(0, 3).join(' / ')}`);
  }
});

test('曲がると変わる景色: 出て戻るたびに次の部屋（4 つの部屋を順に）・どの部屋でも開口どうしは歩いてつながる・決定的', () => {
  for (const room of ROOMS.slice(0, 3)) {
    const f = room.floor;
    const c = cornerOf(f, room.id);
    const y = room.cell.floorY;
    const sim = new Sim(f, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
    const gap = (k: number): Vec3 => { const g = aabbCenter(c.plug[(k + 1) % 2]!); return [g[0], y, g[2]]; };
    const beyond = (k: number, d: number): Vec3 => { const g = gap(k); return [g[0] + c.out[0] * d, y, g[2] + c.out[2] * d]; };
    const inner = (k: number): Vec3 => { const g = gap(k); return [g[0] - c.out[0] * 0.8, y, g[2] - c.out[2] * 0.8]; };
    const pc = aabbCenter(c.passage);
    sim.teleport(0, [pc[0], y + 0.02, pc[2]], 0);
    stepWith(sim, 5, () => ({}));
    const away = Math.atan2(-c.out[0], -c.out[2]);
    for (let k = 0; k < 4; k++) {
      assert.equal(cur(sim, c.swap), k % 4);
      assert.ok(walkPath(sim, [inner(k), gap(k), beyond(k, 0.7), beyond(k, 1.9)], () => {}), `${room.cell.id}: 組 ${k} の切れ目を抜ける`);
      for (let i = 0; i < 90 && cur(sim, c.swap) === k % 4; i++) stepWith(sim, 1, () => ({ yaw: away }));
      assert.equal(cur(sim, c.swap), (k + 1) % 4, `${room.cell.id}: 組 ${k} → ${(k + 1) % 4}`);
      // 次の切れ目から通路へ戻る
      assert.ok(walkPath(sim, [beyond(k + 1, 1.3), beyond(k + 1, 0.6), gap(k + 1), inner(k + 1)], () => {}), `${room.cell.id}: 組 ${k + 1} の切れ目から通路へ`);
    }
    // どの部屋（組）でも、区画の開口どうしは歩いてつながる
    const slot = (ent(f, c.swap).params.slots as { variants: SwapBox[][] }[])[0]!;
    for (const [k, vs] of slot.variants.entries()) {
      const boxes = [...room.cell.boxes, ...vs.map((b) => ({ min: [b.min[0]!, b.min[1]!, b.min[2]!] as Vec3, max: [b.max[0]!, b.max[1]!, b.max[2]!] as Vec3, mat: b.mat as never, solid: !!b.solid }))];
      const openings = f.portals.filter((q) => q.cells.includes(room.cell.id)).map((q, i) => ({ id: `p${i}`, pos: portalFloor(q, room.cell.bounds), dir: outward(q, room.cell.bounds), width: Math.max(q.aabb.max[0] - q.aabb.min[0], q.aabb.max[2] - q.aabb.min[2]), height: q.aabb.max[1] - q.aabb.min[1] }));
      const res = reachOpenings({ footprint: room.cell.footprint, floorY: y, boxes }, openings, 0.1);
      assert.ok(!res || res.blocked.length === 0, `${room.cell.id}: 組 ${k} でも開口どうしが歩いてつながる（${res?.blocked.length}）`);
    }
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(f.entities.filter((e) => e.id.startsWith(room.id))));
  }
});
