// 階の地図（果てしない階。docs/endless-world.md 13 章）: 区域が替わっても地図は消えず、歩いた区域を全部つないで描く。
// 覚えておく数を超えた区域・前に遊んだときの区域は、見た所だけの写し（保存に入る）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTuning, type TuningOverrides } from '../core/config/tuning.ts';
import { WorldPlanner } from '../core/gen/world/plan.ts';
import { generateRegionReport } from '../core/gen/world/region.ts';
import { namespaceLayout } from '../core/gen/world/namespace.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { MapController, type GameLike } from '../client/map/MapController.ts';
import { MapStore } from '../client/map/MapStore.ts';
import { Codex } from '../client/map/Codex.ts';

class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

const { tuning: t } = makeTuning({ 'map.story.keep': 2 } as TuningOverrides);
const story = { world: 41, depth: 2, variant: 0 };
const planner = new WorldPlanner(t);
const region = (cx: number, cz: number): FloorLayout => { const p = planner.at(story, cx, cz); return namespaceLayout(generateRegionReport(p, t).floor, p.id); };

function game(): GameLike & { pos: [number, number, number] } {
  const g = {
    pos: [0, 0, 0] as [number, number, number], paused: false, pause() {},
    sim: null as GameLike['sim'],
  };
  g.sim = { players: [{ get pos() { return g.pos; }, yaw: 0 }], outputOf: () => 0, isRevealed: () => false, focusedInteractable: () => null };
  return g;
}

/** 区域の中の部屋の真ん中へ立って、地図を 1 回進める */
function stand(mc: MapController, g: ReturnType<typeof game>, L: FloorLayout): void {
  const c = L.cells.find((x) => x.role !== 'secret' && x.footprint.length)!;
  const f = c.footprint[0]!;
  g.pos = [(f.x0 + f.x1) / 2, c.floorY + 0.02, (f.z0 + f.z1) / 2];
  mc.frame(null, 0.1);
}

test('区域が替わっても地図は残り、歩いた区域をつないで描く。戻ると同じ地図', () => {
  const mem = new MemoryStorage();
  const g = game();
  const mc = new MapController({ game: g, ui: null, tuning: t, codex: Codex.load(mem), store: MapStore.load(mem, 50) });
  const A = region(0, 0);
  const B = planner.at(story, 0, 0).gates.map((x) => x.other).map((id) => planner.byId(story, id))[0]!;
  const LB = region(B.slots.cx, B.slots.cz);
  const meta = (L: FloorLayout) => ({ ...story, region: L.region!.id, name: L.region!.name });
  mc.setRegion(A, null, meta(A));
  stand(mc, g, A);
  const mapA = mc.map!;
  assert.ok(mapA.visited.size >= 1);
  mc.setRegion(LB, null, meta(LB));
  stand(mc, g, LB);
  assert.notEqual(mc.map, mapA);
  // 描く物に、両方の区域の見た区画が入る
  const sc = mc.sceneFor({ player: { x: g.pos[0], z: g.pos[2], yaw: 0 } })!;
  const ids = new Set(sc.cells.map((c) => c.id));
  assert.ok([...mapA.visited].every((id) => ids.has(id)), '前の区域の入った区画も描く');
  assert.ok([...mc.map!.visited].every((id) => ids.has(id)), '今の区域の区画');
  assert.equal(mc.storyRegions, 2);
  // 前の区域へ戻ると、同じ地図（作り直さない）
  mc.setRegion(A, null, meta(A));
  assert.equal(mc.map, mapA);
  // 境目の扉も地図の扉として描く
  assert.ok(sc.doors.length > 0);
  assert.ok(mc.info!.portals.some((p) => p.id.startsWith('p:gate:')), '境目の扉');
});

test('覚えておく数を超えた区域は写しになり、次に遊んだときも保存の写しから描ける', () => {
  const mem = new MemoryStorage();
  const g = game();
  const mc = new MapController({ game: g, ui: null, tuning: t, codex: Codex.load(mem), store: MapStore.load(mem, 50) });
  const plans = [planner.at(story, 0, 0)];
  for (const gt of plans[0]!.gates) { const p = planner.byId(story, gt.other); if (!plans.some((x) => x.id === p.id)) plans.push(p); if (plans.length >= 3) break; }
  const layouts = plans.map((p) => region(p.slots.cx, p.slots.cz));
  const meta = (L: FloorLayout) => ({ ...story, region: L.region!.id, name: L.region!.name });
  for (const L of layouts) { mc.setRegion(L, null, meta(L)); stand(mc, g, L); }
  mc.saveNow();
  const first = layouts[0]!.region!.id;
  // 3 つ目に入った時点で、いちばん古い区域は写し（keep = 2）
  const sc = mc.sceneFor({ player: null })!;
  assert.ok(sc.cells.some((c) => c.id.endsWith(`#${first}`)), '写しの区域も描く');
  // 遊び直す: 新しい MapController（保存だけが残る）。今いる区域だけ読んでも、前の区域が写しで描ける
  const mc2 = new MapController({ game: g, ui: null, tuning: t, codex: Codex.load(mem), store: MapStore.load(mem, 50) });
  const last = layouts[layouts.length - 1]!;
  mc2.setRegion(last, null, meta(last));
  const sc2 = mc2.sceneFor({ player: null })!;
  for (const L of layouts) assert.ok(sc2.cells.some((c) => c.id.endsWith(`#${L.region!.id}`)), `区域 ${L.region!.id} を描く`);
  assert.equal(mc2.storyRegions, layouts.length);
});
