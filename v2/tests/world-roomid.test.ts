/**
 * ルーム ID（docs/endless-world.md 15 章）: 番号 ↔ 部屋の場所が往復する・殻の中で重ならない・seed で割り当てが変わる・
 * 番号の形でない物は弾く・区域の区画の番号が区域を作り直して戻る・番号の部屋の中から始めると、その部屋の床に立つ
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { localId } from '../core/gen/world/namespace.ts';
import { WorldPlanner } from '../core/gen/world/plan.ts';
import { cellIndexAt, decodeRoomId, encodeRoomId, isRoomCell, ROOM_CELLS, ROOM_ID_BASE, roomCellOk, roomIdOf, type RoomRef } from '../core/gen/world/roomId.ts';
import { Rng } from '../core/math/rng.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { WorldSession } from '../core/stream/session.ts';
import { syncSource, type StoryWorld } from '../core/stream/story.ts';

const t = defaultTuning();

test('ルーム ID: 番号 ↔ 部屋の場所が往復する（seed 3 つ・深さ 0〜60・升目 ±40・区画 0〜255）', () => {
  const rng = new Rng(7);
  for (const world of [1, 3, 99]) {
    for (let i = 0; i < 3000; i++) {
      const r: RoomRef = { depth: rng.int(0, 60), variant: rng.int(0, 1), cx: rng.int(-40, 40), cz: rng.int(-40, 40), cell: rng.int(0, ROOM_CELLS - 1) };
      const id = encodeRoomId(world, r);
      assert.ok(id !== null && id >= ROOM_ID_BASE && Number.isSafeInteger(id), `${JSON.stringify(r)} → ${id}`);
      assert.deepEqual(decodeRoomId(world, id!), r);
      assert.deepEqual(decodeRoomId(world, String(id)), r);
    }
  }
});

test('ルーム ID: 出発点の近く（殻 0〜2）の部屋の番号はどれも違い、短い番号の範囲を埋める', () => {
  const ids = new Set<number>();
  let n = 0;
  for (let d = 0; d <= 2; d++) for (const cx of [-1, 0, 1]) for (const cz of [-1, 0, 1]) for (const variant of [0, 1]) for (let cell = 0; cell < ROOM_CELLS; cell++) {
    const id = encodeRoomId(1, { depth: d, variant, cx, cz, cell })!;
    ids.add(id);
    n++;
  }
  assert.equal(ids.size, n, '重ならない');
  // 出発点の升目の深さ 0 は 4 桁
  const start = encodeRoomId(1, { depth: 0, variant: 0, cx: 0, cz: 0, cell: 5 })!;
  assert.ok(start >= 1000 && start < 10000, `出発点の部屋 ${start}`);
  // 深さ 10 の近くでも 7 桁まで
  const deep = encodeRoomId(1, { depth: 10, variant: 0, cx: 3, cz: -2, cell: 40 })!;
  assert.ok(String(deep).length <= 7, `深さ 10 の部屋 ${deep}`);
});

test('ルーム ID: seed が違えば割り当ても変わる・隣の区画の番号は続かない', () => {
  let same = 0, seq = 0;
  for (let cell = 0; cell < 100; cell++) {
    const r = { depth: 1, variant: 0, cx: 0, cz: 1, cell };
    if (encodeRoomId(1, r) === encodeRoomId(2, r)) same++;
    if (Math.abs(encodeRoomId(1, r)! - encodeRoomId(1, { ...r, cell: cell + 1 })!) === 1) seq++;
  }
  assert.ok(same <= 2, `seed 1 と 2 で同じ番号 ${same}/100`);
  assert.ok(seq <= 3, `続き番号 ${seq}/100`);
});

test('ルーム ID: 番号の形でない物・小さすぎる番号は部屋の場所にならない', () => {
  for (const bad of ['', 'abc', '12a', '-5', '1.5', '1e5', '999', '0', ' ', '99999999999999999999']) assert.equal(decodeRoomId(1, bad), null, `「${bad}」`);
  assert.ok(decodeRoomId(1, '1000'));
  assert.ok(decodeRoomId(1, ' 1234 '));
});

/** 試す区域（街区・寄せ集め・深さ・表と裏） */
function regions(): { story: { world: number; depth: number; variant: number }; cx: number; cz: number }[] {
  const out: { story: { world: number; depth: number; variant: number }; cx: number; cz: number }[] = [];
  for (const [depth, variant] of [[0, 0], [1, 0], [3, 1], [6, 0]] as const) for (const [cx, cz] of [[0, 0], [1, -1], [-2, 2]] as const) out.push({ story: { world: 5, depth, variant }, cx, cz });
  return out;
}

test('ルーム ID: 区域の区画の番号から、同じ区域の同じ区画へ戻る（階段室・別の空間は番号なし。区画は 256 未満）', () => {
  const src = syncSource(t, { dress: dressCell });
  const P = new WorldPlanner(t);
  const all = new Set<number>();
  let rooms = 0;
  for (const g of regions()) {
    const plan = P.at(g.story, g.cx, g.cz);
    const L = src.get(plan)!;
    assert.ok(L.cells.length < ROOM_CELLS, `${plan.id}: 区画 ${L.cells.length}`);
    L.cells.forEach((c, i) => {
      const id = roomIdOf(g.story.world, L, g.story, i);
      if (!isRoomCell(L, c)) { assert.equal(id, null, `${c.id}: 番号なし`); return; }
      assert.ok(id !== null && !all.has(id), `${c.id}: ${id}`);
      all.add(id!);
      rooms++;
      const r = decodeRoomId(g.story.world, id!)!;
      assert.deepEqual([r.depth, r.variant, r.cell], [g.story.depth, g.story.variant, i]);
      const back = src.get(P.at({ world: g.story.world, depth: r.depth, variant: r.variant }, r.cx, r.cz))!;
      assert.ok(roomCellOk(back, r) && back.cells[r.cell]!.id === c.id, `${c.id}: 戻る`);
    });
    // 区画の並びより後ろ・区域のいちばん小さい升目でない升目は、部屋が無い
    const o = plan.slots;
    assert.equal(roomCellOk(L, { depth: g.story.depth, variant: g.story.variant, cx: o.cx, cz: o.cz, cell: L.cells.length + 3 }), false);
    if (o.w > 1) assert.equal(roomCellOk(L, { depth: g.story.depth, variant: g.story.variant, cx: o.cx + 1, cz: o.cz, cell: 0 }), false);
  }
  assert.ok(rooms > 300, `部屋 ${rooms}`);
});

test('ルーム ID: 番号の部屋の中から始めると、その部屋の床に立つ（穴の部屋・隠し場所も。出現型の隠しは入口が開いている）', async () => {
  const R = await loadRapier();
  const src = syncSource(t, { dress: dressCell });
  const P = new WorldPlanner(t);
  const rng = new Rng(11);
  const fails: string[] = [];
  let n = 0, secrets = 0, pits = 0;
  for (const g of regions().slice(0, 8)) {
    const plan = P.at(g.story, g.cx, g.cz);
    const L = src.get(plan)!;
    const secretCells = new Set((L.region?.contents?.secrets ?? []).flatMap((s) => s.cells));
    const pitCells = new Set(L.exits.filter((x) => x.shaft).map((x) => L.cells.find((c) => c.footprint.some((f) => x.shaft!.anchor[0] >= f.x0 && x.shaft!.anchor[0] <= f.x1 && x.shaft!.anchor[2] >= f.z0 && x.shaft!.anchor[2] <= f.z1) && Math.abs(c.floorY - x.shaft!.anchor[1]) < 4)?.id).filter((x): x is string => !!x));
    const idx = L.cells.map((c, i) => ({ c, i })).filter(({ c }) => isRoomCell(L, c));
    // 隠し場所・穴の部屋は全部、ほかは 4 つ
    const pick = [...idx.filter(({ c }) => secretCells.has(c.id) || pitCells.has(c.id)), ...rng.shuffle(idx.filter(({ c }) => !secretCells.has(c.id) && !pitCells.has(c.id))).slice(0, 4)];
    for (const { c, i } of pick) {
      n++;
      if (secretCells.has(c.id)) secrets++;
      if (pitCells.has(c.id)) pits++;
      const s = new WorldSession(g.story.world, 0, { tuning: t, source: src, physics: () => new PhysicsWorld(R, 1 / 60), start: { story: g.story, plan, cell: c.id } });
      for (let k = 0; k < 40; k++) s.step([{ ...IDLE_COMMAND }]);
      const p = s.active.sim.players[0]!;
      const at = cellIndexAt(L, p.pos);
      if (at !== i || !p.onGround || Math.abs(p.pos[1] - c.floorY) > 0.3) fails.push(`${c.id}（${c.role}${secretCells.has(c.id) ? '・隠し' : ''}${pitCells.has(c.id) ? '・穴' : ''}）: 区画 ${at === -1 ? 'なし' : L.cells[at]!.id} y=${p.pos[1].toFixed(2)} 床 ${c.floorY} 立つ ${p.onGround}`);
      // 出現型の隠し場所: 入口の壁が消えている
      for (const sec of L.region?.contents?.secrets ?? []) {
        if (!sec.cells.includes(c.id)) continue;
        const rev = L.entities.find((e) => e.type === 'reveal' && localId(e.id) === `${sec.id}.reveal`);
        if (rev && !s.active.sim.isRevealed(String(rev.params.group))) fails.push(`${c.id}: 出現型の隠しの入口が閉じたまま`);
      }
      s.active.sim.physics?.dispose();
    }
  }
  assert.deepEqual(fails, []);
  assert.ok(n >= 30 && secrets >= 2, `部屋 ${n}・隠し場所 ${secrets}・穴の部屋 ${pits}`);
});

test('ルーム ID: 番号の部屋へ移る（タブレットの探索）: 別の階・同じ階のどちらでも、その部屋の床に立つ。捨てる階の区域は書き残す', async () => {
  const R = await loadRapier();
  const src = syncSource(t, { dress: dressCell });
  const P = new WorldPlanner(t);
  const saved: string[] = [];
  const s = new WorldSession(5, 0, { tuning: t, source: src, physics: () => new PhysicsWorld(R, 1 / 60), regionRemoving: (w, id) => saved.push(`${w.story.depth}.${w.story.variant}:${id}`) });
  for (let k = 0; k < 10; k++) s.step([{ ...IDLE_COMMAND }]);
  for (const g of [{ story: { world: 5, depth: 3, variant: 1 }, cx: 1, cz: -1 }, { story: { world: 5, depth: 3, variant: 1 }, cx: -2, cz: 2 }]) {
    const plan = P.at(g.story, g.cx, g.cz);
    const L = src.get(plan)!;
    const idx = L.cells.findIndex((c, i) => i > 3 && isRoomCell(L, c) && c.role !== 'secret' && c.role !== 'connector');
    assert.ok(idx >= 0);
    const before = saved.length;
    assert.ok(s.prepareGotoRoom(g.story, plan, L.cells[idx]!.id), '用意できる');
    assert.ok(s.commitGoto(), '移れる');
    for (let k = 0; k < 30; k++) s.step([{ ...IDLE_COMMAND }]);
    const p = s.active.sim.players[0]!;
    const here = s.active.regionLayout(plan.id)!;
    assert.equal(s.storyId, '3.1');
    assert.equal(cellIndexAt(here, p.pos), idx, `${L.cells[idx]!.id} の中`);
    assert.ok(p.onGround && Math.abs(p.pos[1] - L.cells[idx]!.floorY) < 0.3, `床に立つ（y=${p.pos[1].toFixed(2)}）`);
    assert.ok(saved.length > before, '捨てた階の区域を書き残した');
  }
  s.active.sim.physics?.dispose();
});

test('ルーム ID: 移る先の階が、階段室の向こうに用意した階と同じでも、移る先は描く対象（beyondWorlds）に入り、移れる', async () => {
  const R = await loadRapier();
  const src = syncSource(t, { dress: dressCell });
  const P = new WorldPlanner(t);
  // クライアントの描画のまね: 今の階と、beyondWorlds に入っている階だけ描ける（入っていない階の描画は毎フレーム捨てる）
  const drawn = new Set<StoryWorld>();
  let s: WorldSession | null = null;
  s = new WorldSession(5, 0, { tuning: t, source: src, physics: () => new PhysicsWorld(R, 1 / 60), ready: (w) => w === s?.active || drawn.has(w) });
  const frame = (): void => { drawn.clear(); for (const w of s!.beyondWorlds()) drawn.add(w); };
  // 下りの階段室のそば: 向こうの階 1.0 を用意させる
  const air = s.active.regions.flatMap((r) => r.layout.region!.airlocks).find((a) => a.to === '1.0');
  assert.ok(air, '下りの階段室');
  s.active.sim.teleport(0, [air.anchor.offset[0], air.anchor.offset[1] + 0.2, air.anchor.offset[2]], 0);
  for (let k = 0; k < 20; k++) { s.step([{ ...IDLE_COMMAND }]); frame(); }
  assert.ok(s.otherStory('1.0'), '階段室の向こうの階 1.0 を用意した');
  // 同じ階 1.0 の番号の部屋へ
  const story = { world: 5, depth: 1, variant: 0 };
  const plan = P.at(story, 1, -1);
  const L = src.get(plan)!;
  const idx = L.cells.findIndex((c) => isRoomCell(L, c) && c.role !== 'secret' && c.role !== 'connector');
  assert.ok(s.prepareGotoRoom(story, plan, L.cells[idx]!.id), '用意できる');
  assert.ok(s.gotoTarget && s.beyondWorlds().includes(s.gotoTarget), '移る先も描く対象');
  let moved = false;
  for (let k = 0; k < 5 && !moved; k++) { frame(); moved = s.commitGoto(); }
  assert.ok(moved, '移れる');
  assert.equal(s.storyId, '1.0');
  s.active.sim.physics?.dispose();
});
