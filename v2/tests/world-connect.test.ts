// 上下の階へ移る所（docs/endless-world.md 14 章）: エレベーター（引き戸のかご）・床の穴（v1 の Hole）・沈む床（エレベーター床）。
// どれも読み込みの画面なしに、1 つ下（エレベーターは上も）の階へ移る
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning, type TuningOverrides } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { WorldSession } from '../core/stream/session.ts';
import { syncSource } from '../core/stream/story.ts';
import { WorldPlanner, type RegionPlan, type StoryKey } from '../core/gen/world/plan.ts';
import { generateRegionReport } from '../core/gen/world/region.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import type { Tuning } from '../core/config/tuning.ts';
import type { Vec3 } from '../core/math/vec.ts';

const t = defaultTuning();

async function session(world: number, depth: number, tune: Tuning = t): Promise<WorldSession> {
  const R = await loadRapier();
  return new WorldSession(world, depth, { tuning: tune, source: syncSource(tune, { dress: dressCell }), physics: () => new PhysicsWorld(R, 1 / 60) });
}

/** 点 at を見る操作（調べる） */
function look(p: { pos: readonly number[] }, at: readonly number[], interact = true): InputCommand {
  const dx = at[0]! - p.pos[0]!, dy = at[1]! - (p.pos[1]! + 1.6), dz = at[2]! - p.pos[2]!;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return { ...IDLE_COMMAND, yaw, pitch, interact: interact ? { yaw, pitch } : null };
}

const center = (b: { min: number[]; max: number[] }): Vec3 => [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];

/** 深さ depth の、kind の下りのある区域（始まりの升目のまわりから探す） */
function findRegion(world: number, depth: number, pred: (p: RegionPlan) => boolean): RegionPlan | null {
  const pl = new WorldPlanner(t);
  for (let r = 0; r < 4; r++) for (let cx = -r; cx <= r; cx++) for (let cz = -r; cz <= r; cz++) {
    const p = pl.at({ world, depth, variant: 0 }, cx, cz);
    if (pred(p)) return p;
  }
  return null;
}

test('エレベーター: 呼ぶと戸が開き、乗って下の階のボタンを押すと戸が閉まって動き、下の階の同じかごに着いて戸が開く（上へも戻れる）', async () => {
  let done = false;
  for (const world of [3, 4, 5, 6, 7, 8]) {
    const depth = 2;
    const plan = findRegion(world, depth, (p) => p.airlocks.some((a) => a.role === 'down' && a.kind === 'lift'));
    if (!plan) continue;
    const s = await session(world, depth);
    s.active.ensure(plan);
    const info = s.active.regionInfo(plan.id)!;
    const a = info.airlocks.find((x) => x.role === 'down' && x.kind === 'lift')!;
    const L = s.active.regionLayout(plan.id)!;
    const car = L.entities.find((e) => e.id === a.car)!;
    const call = L.entities.find((e) => `${e.id}.pressed` === (car.inputs as { call: string }).call)!;
    const hall = car.params.hall as { min: number[]; max: number[] };
    const inside = car.params.inside as { min: number[]; max: number[] };
    // 戸の前（外）に立って、呼ぶボタンを押す
    const front = center(hall);
    s.active.sim.teleport(0, [front[0], hall.min[1]! + 0.25, front[2]], 0);
    const p = () => s.active.sim.players[0]!;
    for (let i = 0; i < 20; i++) s.step([]);
    s.step([look(p(), center(call.params.box as { min: number[]; max: number[] }))]);
    for (let i = 0; i < 90; i++) s.step([]);
    assert.ok(s.active.sim.outputOf(a.live, 'angle') > 0.9, '戸が開いた');
    // 乗る（かごの真ん中）・下の階のボタン（b1）を押す
    const c = center(inside);
    s.active.sim.teleport(0, [c[0], inside.min[1]! + 0.25, c[2]], 0);
    for (let i = 0; i < 20; i++) s.step([]);
    const b1 = L.entities.find((e) => `${e.id}.pressed` === (car.inputs as { go1: string }).go1)!;
    s.step([look(p(), center(b1.params.box as { min: number[]; max: number[] }))]);
    const from = s.active.story.depth;
    for (let i = 0; i < 60 * 10 && s.active.story.depth === from; i++) s.step([]);
    assert.equal(s.active.story.depth, depth + 1, '下の階へ');
    const ch = s.drainChanges();
    assert.ok(ch.length === 1 && ch[0]!.seamless, '暗転しない');
    // 下の階の写しのかごの中で、戸が開く
    const below = s.active.regions.flatMap((r) => r.layout.region!.airlocks).find((x) => x.id === a.id)!;
    assert.equal(below.role, 'up');
    for (let i = 0; i < 60 * 3; i++) s.step([]);
    assert.ok(s.active.sim.outputOf(below.live, 'angle') > 0.9, '着いて戸が開いた');
    // 上へ戻る: 出て、また乗って上の階のボタン（b0）
    const Lb = s.active.regions.find((r) => r.layout.region!.airlocks.some((x) => x.id === a.id))!.layout;
    const carB = Lb.entities.find((e) => e.id === below.car)!;
    const hallB = carB.params.hall as { min: number[]; max: number[] }, insideB = carB.params.inside as { min: number[]; max: number[] };
    const fb = center(hallB);
    s.active.sim.teleport(0, [fb[0], hallB.min[1]! + 0.25, fb[2]], 0);
    for (let i = 0; i < 30; i++) s.step([]);
    const cb = center(insideB);
    s.active.sim.teleport(0, [cb[0], insideB.min[1]! + 0.25, cb[2]], 0);
    for (let i = 0; i < 20; i++) s.step([]);
    const b0 = Lb.entities.find((e) => `${e.id}.pressed` === (carB.inputs as { go0: string }).go0)!;
    s.step([look(p(), center(b0.params.box as { min: number[]; max: number[] }))]);
    for (let i = 0; i < 60 * 10 && s.active.story.depth !== depth; i++) s.step([]);
    assert.equal(s.active.story.depth, depth, '上の階へ戻った');
    done = true;
    break;
  }
  assert.ok(done, 'エレベーターのある区域が見つからない');
});

test('床の穴: 区域の床に穴があり、落ちると 1 つ下の階の同じ升目の着く部屋に着く', async () => {
  // 穴の多い調整で探す
  const { tuning } = makeTuning({ 'world.hole.open': 1 } as TuningOverrides);
  const world = 12, depth = 3;
  const s = await session(world, depth, tuning);
  const p = () => s.active.sim.players[0]!;
  const hole = s.active.regions.flatMap((r) => r.layout.exits).find((x) => x.kind === 'hole' && x.shaft && x.to?.floor === `${depth + 1}.0`);
  assert.ok(hole, '床の穴');
  const a = hole.shaft!.anchor;
  s.active.sim.teleport(0, [a[0], a[1] + 0.6, a[2]], 0);
  for (let i = 0; i < 60 * 4 && s.active.story.depth === depth; i++) s.step([]);
  assert.equal(s.active.story.depth, depth + 1, '下の階へ落ちた');
  assert.ok(s.drainChanges().some((c) => c.seamless));
  const slot = [Math.floor(a[0] / t['world.slotM']), Math.floor(a[2] / t['world.slotM'])];
  const ld = s.active.regions.flatMap((r) => r.layout.region!.landings ?? []).find((l) => l.id === `land:${depth + 1}:${slot[0]}:${slot[1]}`)!;
  assert.ok(ld, '同じ升目の着く部屋');
  for (let i = 0; i < 60 * 4 && !p().onGround; i++) s.step([]);
  const cell = s.active.regions.flatMap((r) => r.layout.cells).find((c) => c.id === ld.cell)!;
  assert.ok(p().onGround && Math.abs(p().pos[1] - cell.floorY) < 0.3, '着く部屋の床に立つ');
});

test('沈む床: 止まって立つと沈み、暗い縦穴の途中で下の階へ移り、着く部屋の床板に乗ったまま天井の穴から部屋の床まで下りる', async () => {
  const tuning = { ...t, 'gimmick.w.sinkFloor': 5000 } as Tuning;
  let done = false;
  for (const world of [5, 6, 7, 8, 9]) {
    const depth = 2;
    const s = await session(world, depth, tuning);
    const ex = s.active.regions.flatMap((r) => r.layout.exits).find((x) => x.shaft?.lift);
    if (!ex) continue;
    const L = s.active.regions.find((r) => r.layout.exits.includes(ex))!.layout;
    const lift = L.entities.find((e) => e.id === ex.shaft!.lift)!;
    const box = lift.params.box as { min: number[]; max: number[] };
    const c = center(box);
    s.active.sim.teleport(0, [c[0], box.max[1]! + 0.05, c[2]], 0);
    const p = () => s.active.sim.players[0]!;
    for (let i = 0; i < 60 * 25 && s.active.story.depth === depth; i++) s.step([]);
    assert.equal(s.active.story.depth, depth + 1, '下の階へ移った');
    assert.ok(s.drainChanges().some((x) => x.seamless));
    const ld = s.active.regions.flatMap((r) => r.layout.region!.landings ?? []).find((l) => l.zone.min[0] <= p().pos[0] && l.zone.max[0] >= p().pos[0] && l.zone.min[2] <= p().pos[2] && l.zone.max[2] >= p().pos[2])!;
    assert.ok(ld, '着く部屋の縦穴の中');
    s.step([]);
    let y0 = s.active.sim.outputOf(ld.lift!, 'y');
    assert.ok(Math.abs(y0 - p().pos[1]) < 0.4, `床板が足の下（${y0.toFixed(2)} / ${p().pos[1].toFixed(2)}）`);
    for (let i = 0; i < 60 * 15 && s.active.sim.outputOf(ld.lift!, 'atBottom') < 0.5; i++) { s.step([]); const y = s.active.sim.outputOf(ld.lift!, 'y'); assert.ok(y <= y0 + 1e-6); y0 = y; }
    assert.ok(s.active.sim.outputOf(ld.lift!, 'atBottom') > 0.5, '床板が部屋の床まで下りた');
    const cell = s.active.regions.flatMap((r) => r.layout.cells).find((x) => x.id === ld.cell)!;
    for (let i = 0; i < 30; i++) s.step([]);
    assert.ok(Math.abs(p().pos[1] - cell.floorY) < 0.4, `部屋の床の高さ（${p().pos[1].toFixed(2)}）`);
    done = true;
    break;
  }
  assert.ok(done, '沈む床が見つからない');
});
