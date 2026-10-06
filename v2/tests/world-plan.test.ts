// 果てしない階の区域の計画（docs/endless-world.md 3 章・9 章）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { planRegion, regionSlots, WorldPlanner, type RegionPlan, type StoryKey } from '../core/gen/world/plan.ts';

const t = defaultTuning();
const N = 16;

/** -N/2 .. N/2 の升目の区域を全部（id → 計画） */
function regionsIn(story: StoryKey): Map<string, RegionPlan> {
  const out = new Map<string, RegionPlan>();
  for (let cx = -N / 2; cx < N / 2; cx++) for (let cz = -N / 2; cz < N / 2; cz++) {
    const p = planRegion(story, cx, cz, t);
    out.set(p.id, p);
  }
  return out;
}

test('升目はどれもちょうど 1 つの区域に入り、区域の升目はどこから引いても同じ', () => {
  for (const world of [1, 7, 42]) for (const depth of [0, 3, 8]) {
    const owner = new Map<string, string>();
    for (const p of regionsIn({ world, depth, variant: 0 }).values()) {
      for (let x = p.slots.cx; x < p.slots.cx + p.slots.w; x++) for (let z = p.slots.cz; z < p.slots.cz + p.slots.h; z++) {
        const k = `${x},${z}`;
        assert.ok(!owner.has(k) || owner.get(k) === p.id, `升目 ${k} が 2 つの区域に入っている`);
        owner.set(k, p.id);
        assert.deepEqual(regionSlots(world, depth, x, z, t), p.slots, `升目 ${k} から引いた区域`);
      }
      assert.ok(p.slots.w >= 1 && p.slots.w <= 2 && p.slots.h >= 1 && p.slots.h <= 2);
    }
  }
});

test('境目の扉は両側の区域で同じ id・同じ位置・逆の向き。どの区域にも扉があり、区域はつながっている', () => {
  for (const world of [3, 11]) for (const depth of [1, 5]) {
    const all = regionsIn({ world, depth, variant: 0 });
    let gates = 0;
    for (const p of all.values()) {
      assert.ok(p.gates.length >= 1, `${p.id} に境目の扉が無い`);
      for (const g of p.gates) {
        gates++;
        const o = all.get(g.other) ?? planRegion({ world, depth, variant: 0 }, ...(/x(-?\d+)z(-?\d+)/.exec(g.other)!.slice(1).map(Number) as [number, number]), t);
        const m = o.gates.find((x) => x.id === g.id);
        assert.ok(m, `${g.id} の向こう側が無い`);
        assert.equal(m.other, p.id);
        assert.equal(m.line, g.line);
        assert.equal(m.at, g.at);
        assert.equal(m.side, (g.side + 2) % 4);
        // 扉は区域の辺の上
        const r = p.rect;
        const onEdge = g.side === 0 ? g.line === r.z1 : g.side === 2 ? g.line === r.z0 : g.side === 1 ? g.line === r.x1 : g.line === r.x0;
        assert.ok(onEdge, `${g.id} が区域の辺に無い`);
        const [lo, hi] = g.side % 2 === 0 ? [r.x0, r.x1] : [r.z0, r.z1];
        assert.ok(g.at > lo + 2 && g.at < hi - 2, `${g.id} が辺の外`);
      }
      assert.equal(new Set(p.gates.map((g) => g.id)).size, p.gates.length, '扉の id が重なる');
    }
    // つながり（範囲の中の区域どうし）
    const start = [...all.keys()][0]!;
    const seen = new Set([start]);
    const q = [start];
    for (let h = 0; h < q.length; h++) for (const g of all.get(q[h]!)!.gates) if (all.has(g.other) && !seen.has(g.other)) { seen.add(g.other); q.push(g.other); }
    assert.equal(seen.size, all.size, '境目の扉でたどれない区域がある');
    assert.ok(gates > all.size, `扉の数 ${gates}`);
  }
});

test('上下の階へ移る所: 升目ごとに下りが 1 つ（階段室かエレベーター）。下の階の同じ升目に着き、どの区域にも下りと上りがある', () => {
  const world = 9;
  const kinds = new Map<string, number>();
  for (const depth of [0, 1, 2, 6]) {
    const upper = regionsIn({ world, depth, variant: 0 });
    const lower = regionsIn({ world, depth: depth + 1, variant: 0 });
    const downs = new Map<string, RegionPlan>();
    for (const p of upper.values()) for (const a of p.airlocks.filter((x) => x.role === 'down')) {
      assert.ok(!downs.has(a.id), `${a.id} が 2 つ`);
      downs.set(a.id, p);
      assert.deepEqual(a.to, { world, depth: depth + 1, variant: 0 });
      kinds.set(a.kind, (kinds.get(a.kind) ?? 0) + 1);
    }
    // 範囲の中の升目の数だけ
    assert.equal(downs.size, N * N);
    for (const p of upper.values()) assert.equal(p.airlocks.filter((a) => a.role === 'down').length, p.slots.w * p.slots.h, `${p.id} の下り`);
    for (const p of lower.values()) assert.equal(p.landings.length, p.slots.w * p.slots.h, `${p.id} の着く部屋`);
    for (const [id, p] of downs) {
      const a = p.airlocks.find((x) => x.id === id)!;
      const below = lower.get(planRegion({ world, depth: depth + 1, variant: 0 }, a.slot[0], a.slot[1], t).id)!;
      const up = below.airlocks.find((x) => x.id === id);
      assert.ok(up && up.role === 'up', `${id} が下の階に着かない`);
      assert.deepEqual(up.slot, a.slot);
      assert.equal(up.kind, a.kind, '上と下で同じ種類');
      assert.deepEqual(up.to, { world, depth, variant: 0 });
    }
  }
  assert.ok((kinds.get('stairs') ?? 0) > 0 && (kinds.get('lift') ?? 0) > 0, `種類 ${[...kinds]}`);
  // いちばん上の階に着く階段室は始まりの升目だけで、上の扉が開かない
  const top = regionsIn({ world, depth: 0, variant: 0 });
  const ups = [...top.values()].flatMap((p) => p.airlocks.filter((a) => a.role === 'up'));
  assert.ok(ups.length === 1 && ups[0]!.to === null && ups[0]!.kind === 'stairs');
});

test('計画は歩いた順・裏表に左右されない（覚え書きを使っても同じ）', () => {
  const s0: StoryKey = { world: 5, depth: 4, variant: 0 };
  const s1: StoryKey = { ...s0, variant: 1 };
  const planner = new WorldPlanner(t, 16);
  const order = [];
  for (let i = 0; i < 60; i++) order.push([((i * 37) % 13) - 6, ((i * 11) % 9) - 4] as const);
  for (const [cx, cz] of order) {
    const a = planRegion(s0, cx, cz, t);
    const b = planner.at(s0, cx, cz);
    assert.deepEqual(b, a);
    const c = planRegion(s1, cx, cz, t);
    assert.deepEqual({ ...c, story: s0 }, a, '裏の階の区域の形は表と同じ');
  }
  assert.equal(planner.atPos(s0, 0.5 * t['world.slotM'], -0.5 * t['world.slotM']).id, planRegion(s0, 0, -1, t).id);
});

test('区域の種類と大きさの割合（街区と寄せ集め・1 × 1 から 2 × 2）', () => {
  const kinds = new Map<string, number>(), sizes = new Map<string, number>();
  for (const world of [1, 2, 3, 4]) for (const p of regionsIn({ world, depth: 3, variant: 0 }).values()) {
    kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1);
    const s = `${p.slots.w}x${p.slots.h}`;
    sizes.set(s, (sizes.get(s) ?? 0) + 1);
  }
  const total = [...kinds.values()].reduce((a, b) => a + b, 0);
  const patch = (kinds.get('patchwork') ?? 0) / total;
  assert.ok(patch > 0.2 && patch < 0.5, `寄せ集めの割合 ${patch.toFixed(2)}`);
  for (const s of ['1x1', '2x1', '1x2', '2x2']) assert.ok((sizes.get(s) ?? 0) > 0, `${s} が出ない`);
});
