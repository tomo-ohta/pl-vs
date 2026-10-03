// 果てしない階を歩く（docs/endless-world.md 5 章・9 章）: 区域の出し入れ・境目の扉・階段室の入れ替え（Node で、歩く人が歩く）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { WorldSession } from '../core/stream/session.ts';
import { syncSource } from '../core/stream/story.ts';
import { rotQ, type Dir, type Vec3 } from '../core/math/vec.ts';
import type { RegionPlan } from '../core/gen/world/plan.ts';
import { walkTo } from './helpers/bot.ts';
import { streamSim } from './helpers/world.ts';

const t = defaultTuning();

async function session(world: number, depth: number): Promise<WorldSession> {
  const R = await loadRapier();
  return new WorldSession(world, depth, { tuning: t, source: syncSource(t, { dress: dressCell }), physics: () => new PhysicsWorld(R, 1 / 60) });
}

const inRect = (r: RegionPlan['rect'], p: Vec3): boolean => p[0] >= r.x0 && p[0] <= r.x1 && p[2] >= r.z0 && p[2] <= r.z1;

test('最初は上から着く階段室の上の踊り場。区域を渡り歩くと、近くの区域を読み、遠くの区域を外す', async () => {
  for (const world of [3, 17]) {
    const s = await session(world, 2);
    const w = s.active;
    const p = s.active.sim.players[0]!;
    const start = w.planAt(p.pos[0], p.pos[2]);
    const air = w.regionInfo(start.id)!.airlocks.find((a) => a.role === 'up')!;
    assert.ok(air, '出てくる区域に、上から着く階段室がある');
    assert.ok(w.regionLayout(start.id)!.cells.find((c) => c.id === air.cell)!.footprint.some((f) => p.pos[0] >= f.x0 && p.pos[0] <= f.x1 && p.pos[2] >= f.z0 && p.pos[2] <= f.z1), '階段室の中から始まる');
    // 区域を 6 つ渡る: 今の区域の、まだ行っていない区域への境目の扉へ歩き、くぐる
    const visited = [start.id];
    let maxLoaded = 0, removed = 0, hops = 0;
    for (let hop = 0; hop < 6; hop++) {
      const cur = s.active.planAt(p.pos[0], p.pos[2]);
      const gates = cur.gates.filter((g) => !visited.includes(g.other));
      if (!gates.length) break;
      const g = gates[0]!;
      const info = s.active.regionInfo(cur.id)!;
      const mine = info.gates.find((x) => x.id === g.id)!;
      // 扉の手前（1 m 内側）まで
      const v = rotQ([0, 0, 1], mine.opening.dir as Dir);
      let res = walkTo(streamSim(s), mine.cell, [mine.opening.pos[0] - v[0] * 0.9, 0.02, mine.opening.pos[2] - v[2] * 0.9], 240);
      assert.ok(res.ok, `w${world} ${cur.id} → 扉 ${g.id}: ${res.reason}`);
      // 向こうの区域は読まれている（扉から 32 m 以内）
      const other = s.active.regionInfo(g.other);
      assert.ok(other, `向こうの区域 ${g.other} が読まれていない`);
      const theirs = other.gates.find((x) => x.id === g.id)!;
      res = walkTo(streamSim(s), theirs.cell, [theirs.opening.pos[0] + v[0] * 1.2, 0.02, theirs.opening.pos[2] + v[2] * 1.2], 60);
      assert.ok(res.ok, `w${world} 扉 ${g.id} をくぐる: ${res.reason}`);
      assert.ok(inRect(s.active.planAt(p.pos[0], p.pos[2]).rect, p.pos));
      assert.equal(s.active.planAt(p.pos[0], p.pos[2]).id, g.other, '向こうの区域に入った');
      visited.push(g.other);
      hops++;
      maxLoaded = Math.max(maxLoaded, s.active.regions.length);
      removed += s.active.drainChanges().filter((c) => c.type === 'remove').length;
    }
    assert.ok(hops >= 4, `w${world}: 渡った区域 ${hops}`);
    assert.ok(maxLoaded <= t['world.maxRegions'], `持つ区域 ${maxLoaded}`);
    assert.ok(removed >= 1, '遠くなった区域を外した');
  }
});

test('階段室: 下の半分に入り、扉が両方閉じると下の階の写しへ移る（同じ所・同じ向き）。上へ戻れる', async () => {
  // 世界 6（世界 5 は、歩く人が机の椅子と棚の間の 0.72 m の隙間に挟まって止まる。道探しの体の幅ぎりぎり）
  const world = 6;
  const s = await session(world, 1);
  const w = s.active;
  const p = () => s.active.sim.players[0]!;
  // 下りの階段室がある区域（今の区域か、そのとなり）
  const startPlan = w.planAt(p().pos[0], p().pos[2]);
  const target = [startPlan, ...startPlan.gates.map((g) => w.planner.byId(w.story, g.other))].find((pl) => pl.airlocks.some((a) => a.role === 'down' && a.kind === 'stairs'));
  assert.ok(target, '超ブロックの中に下りの階段室がある');
  w.ensure(target);
  const down = w.regionInfo(target.id)!.airlocks.find((a) => a.role === 'down' && a.kind === 'stairs')!;
  const L = (w.regionLayout(target.id)!.cells.find((c) => c.id === down.cell)!);
  void L;
  // 下の踊り場（局所 z = 長さ − 1）まで
  const local = (z: number): Vec3 => { const r = rotQ([0, 0, z], down.anchor.q); return [r[0] + down.anchor.offset[0], down.anchor.offset[1] - 1.6 + 0.02, r[2] + down.anchor.offset[2]]; };
  const res = walkTo(streamSim(s), down.cell, local(4.4), 400);
  assert.ok(res.ok, `下りの階段室まで: ${res.reason}`);
  // 扉が閉じるまで待つ
  for (let i = 0; i < 60 * 6 && s.active.story.depth === 1; i++) s.step([]);
  assert.equal(s.active.story.depth, 2, '下の階へ移った');
  const ch = s.drainChanges();
  assert.equal(ch.length, 1);
  assert.ok(ch[0]!.seamless);
  // 下の階の写しの中（局所の座標で同じ所）
  const below = s.active.regions.flatMap((r) => r.layout.region!.airlocks).find((a) => a.id === down.id)!;
  assert.equal(below.role, 'up');
  const cell = s.active.regions.flatMap((r) => r.layout.cells).find((c) => c.id === below.cell)!;
  assert.ok(cell.footprint.some((f) => p().pos[0] >= f.x0 - 0.01 && p().pos[0] <= f.x1 + 0.01 && p().pos[2] >= f.z0 - 0.01 && p().pos[2] <= f.z1 + 0.01), '下の階の階段室の中');
  // 上の踊り場へ戻ると、上の階へ戻る
  const up = (z: number): Vec3 => { const r = rotQ([0, 0, z], below.anchor.q); return [r[0] + below.anchor.offset[0], below.anchor.offset[1] + 0.02, r[2] + below.anchor.offset[2]]; };
  // （歩く人は階を移っても歩き続けて、また階段室に入ってしまうので、上の踊り場へ移してから待つ）
  for (let i = 0; i < 10; i++) s.step([]);
  s.active.sim.teleport(0, up(0.9), p().yaw);
  for (let i = 0; i < 60 * 6 && s.active.story.depth === 2; i++) s.step([]);
  assert.equal(s.active.story.depth, 1, '上の階へ戻った');
});
