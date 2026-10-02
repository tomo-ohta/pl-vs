// 果てしない階の区域の生成（docs/endless-world.md 4 章・9 章）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { validateFloor, validateRegion, type GenReport } from '../core/gen/floor/index.ts';
import { planRegion, parseRegionId, type RegionPlan, type StoryKey } from '../core/gen/world/plan.ts';
import { generateRegionReport } from '../core/gen/world/region.ts';
import { namespaceLayout } from '../core/gen/world/namespace.ts';
import { rotQ, type Dir } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout } from '../core/world/layout.ts';

const t = defaultTuning();

/** 範囲の区域を全部作る（id → 計画と結果） */
function block(story: StoryKey, x0: number, z0: number, n: number, kind?: RegionPlan['kind']): Map<string, { plan: RegionPlan; r: GenReport }> {
  const out = new Map<string, { plan: RegionPlan; r: GenReport }>();
  for (let cx = x0; cx < x0 + n; cx++) for (let cz = z0; cz < z0 + n; cz++) {
    const p0 = planRegion(story, cx, cz, t);
    if (out.has(p0.id)) continue;
    const plan = kind ? { ...p0, kind } : p0;
    out.set(p0.id, { plan, r: generateRegionReport(plan, t, { dress: dressCell }) });
  }
  return out;
}

function reachable(f: FloorLayout): Set<string> {
  const adj = new Map<string, string[]>();
  for (const p of f.portals) { adj.set(p.cells[0], [...(adj.get(p.cells[0]) ?? []), p.cells[1]]); adj.set(p.cells[1], [...(adj.get(p.cells[1]) ?? []), p.cells[0]]); }
  const seen = new Set([f.spawn.cell]);
  const q = [f.spawn.cell];
  for (let h = 0; h < q.length; h++) for (const m of adj.get(q[h]!) ?? []) if (!seen.has(m)) { seen.add(m); q.push(m); }
  return seen;
}

test('区域（街区・寄せ集め）が検証に通り、区域の中で境目の扉・階段室・全部の区画へ行ける', () => {
  const fails: string[] = [];
  let n = 0;
  const kinds = new Map<string, number>();
  for (const [story, x0] of [[{ world: 2, depth: 1, variant: 0 }, -3], [{ world: 8, depth: 4, variant: 0 }, 1], [{ world: 13, depth: 9, variant: 1 }, -6]] as const) {
    for (const { plan, r } of block(story, x0, x0, 6).values()) {
      n++;
      kinds.set(r.profile.pattern === 'patchwork' ? 'patchwork' : 'district', (kinds.get(r.profile.pattern === 'patchwork' ? 'patchwork' : 'district') ?? 0) + 1);
      const f = r.floor;
      const issues = [...validateFloor(f), ...validateRegion(f, undefined as never)];
      if (issues.length) fails.push(`${plan.id} (${r.profile.pattern}): ${issues.slice(0, 2).join(' / ')}`);
      assert.equal(f.region?.gates.length, plan.gates.length, `${plan.id}: 境目の扉の数`);
      assert.equal(f.region?.airlocks.length, plan.airlocks.length, `${plan.id}: 階段室の数`);
      const seen = reachable(f);
      for (const g of f.region!.gates) if (!seen.has(g.cell)) fails.push(`${plan.id}: 境目の扉 ${g.id} へ行けない`);
      for (const a of f.region!.airlocks) if (!seen.has(a.cell)) fails.push(`${plan.id}: 階段室 ${a.id} へ行けない`);
    }
  }
  assert.deepEqual(fails, []);
  assert.ok((kinds.get('patchwork') ?? 0) >= 5 && (kinds.get('district') ?? 0) >= 10, `種類 ${[...kinds]}`);
  assert.ok(n >= 40);
});

test('境目の扉の開口は、隣り合う 2 つの区域で同じ位置・同じ大きさ・逆の向き。区域どうしは扉でたどれる', () => {
  const story: StoryKey = { world: 21, depth: 3, variant: 0 };
  const all = block(story, -2, -2, 6);
  const get = (id: string): GenReport => {
    if (!all.has(id)) { const [cx, cz] = parseRegionId(id)!; const plan = planRegion(story, cx, cz, t); all.set(id, { plan, r: generateRegionReport(plan, t, { dress: dressCell }) }); }
    return all.get(id)!.r;
  };
  let checked = 0;
  const ids = [...all.keys()];
  for (const id of ids) {
    const { plan, r } = all.get(id)!;
    for (const g of r.floor.region!.gates) {
      const other = plan.gates.find((x) => x.id === g.id)!.other;
      const o = get(other).floor.region!.gates.find((x) => x.id === g.id);
      assert.ok(o, `${g.id} の向こう側が無い`);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(o.opening.pos[k]! - g.opening.pos[k]!) < 1e-6, `${g.id} の位置 ${g.opening.pos} / ${o.opening.pos}`);
      assert.equal(o.opening.dir, (g.opening.dir + 2) % 4);
      assert.equal(o.opening.width, g.opening.width);
      assert.equal(o.opening.height, g.opening.height);
      checked++;
    }
  }
  assert.ok(checked >= 40, `扉 ${checked}`);
  // 区域どうしのつながり（範囲の区域）: 境目の扉の区画は区域の中で互いに行ける（前の試験）ので、計画の扉でたどれればよい
  const seen = new Set([ids[0]!]);
  const q = [ids[0]!];
  for (let h = 0; h < q.length; h++) for (const g of all.get(q[h]!)!.plan.gates) if (ids.includes(g.other) && !seen.has(g.other)) { seen.add(g.other); q.push(g.other); }
  assert.equal(seen.size, ids.length);
});

test('階段室の上の階の写しと下の階の写しは、局所の座標で同じ形（箱・照明・扉）', () => {
  const world = 33;
  let compared = 0;
  for (const depth of [0, 3]) {
    const upper = block({ world, depth, variant: 0 }, -2, -2, 4);
    for (const { r } of upper.values()) for (const a of r.floor.region!.airlocks.filter((x) => x.role === 'down')) {
      const slot = r.floor.region!.airlocks.find((x) => x.id === a.id)!;
      void slot;
      const plan = upper.get(r.floor.region!.id)!.plan.airlocks.find((x) => x.id === a.id)!;
      const below = generateRegionReport(planRegion({ world, depth: depth + 1, variant: 0 }, plan.slot[0], plan.slot[1], t), t, { dress: dressCell });
      const b = below.floor.region!.airlocks.find((x) => x.id === a.id && x.role === 'up');
      assert.ok(b, `${a.id} が下の階に無い`);
      const shapeOf = (f: FloorLayout, cellId: string, an: { offset: number[]; q: Dir }): string[] => {
        const cell = f.cells.find((c) => c.id === cellId)!;
        const back = (p: readonly number[]): number[] => rotQ([p[0]! - an.offset[0]!, p[1]! - an.offset[1]!, p[2]! - an.offset[2]!], ((4 - an.q) % 4) as Dir).map((v) => Math.round(v * 1000) / 1000 + 0);
        const boxes = cell.boxes.map((x) => { const p = back(x.min), q = back(x.max); return `${x.mat}:${[0, 1, 2].map((k) => `${Math.min(p[k]!, q[k]!)},${Math.max(p[k]!, q[k]!)}`).join('|')}`; });
        const lights = cell.lights.map((l) => `L:${back(l.pos).join(',')}:${l.intensity}`);
        const doors = f.entities.filter((e) => e.cell === cellId && e.type === 'door').map((e) => { const pn = e.params.panel as { min: number[]; max: number[] }; const p = back(pn.min), q = back(pn.max); return `D:${[0, 1, 2].map((k) => `${Math.min(p[k]!, q[k]!)},${Math.max(p[k]!, q[k]!)}`).join('|')}`; });
        return [...boxes, ...lights, ...doors, `h:${cell.height}`].sort();
      };
      assert.deepEqual(shapeOf(below.floor, b.cell, b.anchor), shapeOf(r.floor, a.cell, a.anchor), `${a.id}`);
      // 上の階の写しは上の扉、下の階の写しは下の扉が区域につながる。上に階が無い階の着く階段室には入れ替えが無い
      assert.ok(a.live.endsWith(':top') && b.live.endsWith(':bottom'));
      compared++;
    }
  }
  assert.ok(compared >= 6, `比べた階段室 ${compared}`);
});

test('id を付け替えた区域は Sim に入り、裏の階の区域は表と同じ区画の形', async () => {
  const R = await loadRapier();
  const story: StoryKey = { world: 41, depth: 5, variant: 0 };
  for (const { plan, r } of block(story, 0, 0, 4).values()) {
    const L = namespaceLayout(r.floor, plan.id);
    assert.ok(L.cells.every((c) => c.id.endsWith(`#${plan.id}`)) && L.entities.every((e) => e.id.endsWith(`#${plan.id}`)));
    const sim = new Sim(L, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
    sim.physics?.dispose();
    const back = generateRegionReport({ ...plan, story: { ...story, variant: 1 } }, t, { dress: dressCell });
    const outline = (f: FloorLayout): string[] => f.cells.filter((c) => c.role !== 'secret' && !c.pocket).map((c) => `${c.id}:${JSON.stringify(c.footprint)}`).sort();
    // 隠し・仕掛けの区画（裏の seed で置き直す）を除いた、形の区画
    const shapeCells = (f: FloorLayout): string[] => outline(f).filter((x) => !/^(secret|gs|gl|warp|pocket)/.test(x));
    const front = shapeCells(r.floor), bside = shapeCells(back.floor);
    const common = front.filter((x) => bside.includes(x)).length;
    assert.ok(common >= front.length * 0.8, `${plan.id}: 裏の区画の形 ${common}/${front.length}`);
  }
});
