// 隠しの穴（docs/endless-world.md 13 章）: 落ちる途中で、行き先の階の着く部屋の天井の上の縦穴へ移る（暗転しない）。
// 着く部屋は超ブロックごとに 1 つ。行き先がまだ用意できなければ、暗い縦穴の中で落ち続ける
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { WorldSession } from '../core/stream/session.ts';
import { syncSource, type StoryWorld } from '../core/stream/story.ts';
import { landingId, WorldPlanner } from '../core/gen/world/plan.ts';
import { generateRegionReport } from '../core/gen/world/region.ts';
import type { FloorExit } from '../core/world/layout.ts';

const t = defaultTuning();

test('着く部屋は升目ごとに 1 つ。天井に穴があり、その上の縦穴は塞がっていない（ほかの区画と重ならない）。縦穴の上に床板が待つ', () => {
  const pl = new WorldPlanner(t);
  let n = 0;
  for (const world of [2, 9]) {
    const story = { world, depth: 4, variant: 0 };
    const seen = new Set<string>();
    for (const [cx, cz] of [[0, 0], [1, 0], [-1, 1], [0, -2]] as const) {
      const p = pl.at(story, cx, cz);
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      assert.equal(p.landings.length, p.slots.w * p.slots.h, '升目ごと');
      const L = generateRegionReport(p, t, { dress: dressCell }).floor;
      assert.equal(L.region!.landings!.length, p.landings.length);
      for (const ld of L.region!.landings!) {
        assert.ok(p.landings.some((x) => x.id === ld.id && x.id === landingId(4, x.slot[0], x.slot[1])));
        const cell = L.cells.find((c) => c.id === ld.cell)!;
        assert.ok(cell.role !== 'secret', '部屋');
        const [x, , z] = ld.anchor;
        const ceil = cell.floorY + cell.height;
        assert.ok(!cell.boxes.some((b) => b.solid && b.min[1] >= ceil - 0.01 && b.min[1] < ceil + 0.3 && b.min[0] < x && b.max[0] > x && b.min[2] < z && b.max[2] > z), '天井の穴');
        assert.equal(cell.boxes.filter((b) => b.mat === 'void' && b.min[1] >= ceil - 0.01).length, 5, '縦穴の壁と蓋');
        assert.ok(!cell.boxes.some((b) => b.solid && b.max[1] > cell.floorY + 0.05 && b.min[1] < ceil - 0.3 && b.min[0] < x + 0.4 && b.max[0] > x - 0.4 && b.min[2] < z + 0.4 && b.max[2] > z - 0.4), '穴の真下が空いている');
        for (const c of L.cells) if (c !== cell && c.bounds.max[1] > ceil + 0.1) assert.ok(!c.footprint.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1), `縦穴の上に区画 ${c.id}`);
        const lift = L.entities.find((e) => e.id === ld.lift);
        assert.ok(lift && lift.type === 'dropLift', '床板');
        n++;
      }
    }
  }
  assert.ok(n >= 6, `着く部屋 ${n}`);
});

async function holeSession(ready?: (w: StoryWorld) => boolean): Promise<{ s: WorldSession; hole: FloorExit }> {
  const R = await loadRapier();
  const s = new WorldSession(2, 3, { tuning: t, source: syncSource(t, { dress: dressCell }), physics: () => new PhysicsWorld(R, 1 / 60), ...(ready ? { ready } : {}) });
  // 隠しの穴のある区域（世界 2・深さ 3 の x0z0）
  const plan = s.active.planner.byId(s.active.story, 'x0z0');
  s.active.ensure(plan);
  const hole = s.active.regionLayout(plan.id)!.exits.find((x) => x.shaft)!;
  assert.ok(hole, '隠しの穴がある');
  const a = hole.shaft!.anchor;
  s.active.sim.teleport(0, [a[0], a[1] + 0.2, a[2]], 0);
  return { s, hole };
}

test('隠しの穴に落ちると、途中で行き先の階の着く部屋の縦穴へ移り（速さはそのまま）、天井の穴から部屋の床に着く', async () => {
  const { s, hole } = await holeSession();
  const from = s.active.story;
  let vy = 0;
  for (let i = 0; i < 60 * 4 && s.active.story.depth === from.depth; i++) { s.step([]); vy = s.active.sim.players[0]!.vel[1]; }
  assert.equal(`${s.active.story.depth}.${s.active.story.variant}`, hole.to!.floor, '行き先の階へ移った');
  const ch = s.drainChanges();
  assert.equal(ch.length, 1);
  assert.ok(ch[0]!.seamless && ch[0]!.airlock.startsWith('drop:'), '暗転しない');
  const p = s.active.sim.players[0]!;
  assert.ok(vy < -5 && p.vel[1] < -5, `落ちる速さを保つ（${p.vel[1].toFixed(1)}）`);
  const ld = s.active.regions.flatMap((r) => r.layout.region?.landings ?? [])[0]!;
  const z = ld.zone;
  assert.ok(p.pos[0] >= z.min[0] && p.pos[0] <= z.max[0] && p.pos[2] >= z.min[2] && p.pos[2] <= z.max[2] && p.pos[1] > z.min[1], '着く部屋の縦穴の中');
  // 落ち続けて、着く部屋の床に立つ
  for (let i = 0; i < 60 * 4 && !p.onGround; i++) s.step([]);
  const cell = s.active.regions.flatMap((r) => r.layout.cells).find((c) => c.id === ld.cell)!;
  assert.ok(p.onGround && Math.abs(p.pos[1] - cell.floorY) < 0.3, `着く部屋の床に立つ（${p.pos[1].toFixed(2)}）`);
  assert.ok(cell.footprint.some((f) => p.pos[0] >= f.x0 && p.pos[0] <= f.x1 && p.pos[2] >= f.z0 && p.pos[2] <= f.z1));
});

test('行き先がまだ用意できない間は、暗い縦穴の中で落ち続ける（底の出口に着かない）。用意できたら移る', async () => {
  let ok = false;
  const { s, hole } = await holeSession(() => ok);
  const from = s.active.story.depth;
  const a = hole.shaft!.anchor;
  let lowest = Infinity;
  for (let i = 0; i < 60 * 4; i++) { s.step([]); lowest = Math.min(lowest, s.active.sim.players[0]!.pos[1]); }
  assert.equal(s.active.story.depth, from, 'まだ移らない');
  assert.ok(lowest > a[1] - t['world.hole.depthM'] + 4, `底の出口に着かない（${(a[1] - lowest).toFixed(1)} m）`);
  assert.ok(a[1] - s.active.sim.players[0]!.pos[1] > t['world.hole.transferM'], '縦穴の中');
  ok = true;
  for (let i = 0; i < 60 && s.active.story.depth === from; i++) s.step([]);
  assert.notEqual(s.active.story.depth, from, '用意できたら移る');
  assert.ok(s.drainChanges().some((c) => c.seamless));
});
