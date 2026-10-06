/**
 * 地図の元（client/map/MapInfo.ts）と自分の地図（MapModel.ts）: 見た所だけ描く・調査率・足跡・保存・高さの層。
 * DOM・three を使わない（Node でそのまま動く）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { labFloor } from '../core/lab/lab.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { makeCell } from '../core/world/build.ts';
import type { CellLayout, FloorLayout } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';
import { buildMapInfo, cellAtPos, computeLayers } from '../client/map/MapInfo.ts';
import { bitsToHex, FloorMap, hexToBits, type MapObservation } from '../client/map/MapModel.ts';

const t = defaultTuning();

/** 決めた位置・向きの観測（扉は doors の開き具合、出現型の隠しは revealed） */
function obs(pos: [number, number, number], yaw: number, o: { doors?: Record<string, number>; revealed?: string[]; dt?: number } = {}): MapObservation {
  return { pos, yaw, dt: o.dt ?? 1 / 60, doorAngle: (id) => o.doors?.[id] ?? 0, revealed: (g) => (o.revealed ?? []).includes(g) };
}

test('地図の元: 実験場のフロアの区画・開口・隠しの壁・調査の升目', () => {
  const info = buildMapInfo(labFloor(), t);
  assert.equal(info.cells.length, 5);
  assert.equal(info.byId.get('hallA')!.kind, 'hall');
  assert.equal(info.byId.get('secret')!.kind, 'secret');
  assert.equal(info.byId.get('secret')!.counted, false, '隠し場所は調査率に数えない');
  assert.equal(info.portals.find((p) => p.id === 'p-sx')!.conceal, 'secretWall', '出現型の隠しの壁の組');
  assert.ok(info.portals.find((p) => p.id === 'p-sx')!.secret);
  assert.equal(info.layers, 1);
  const tl = info.tiles.get('hallA')!;
  assert.ok(tl.xs.length >= 24, `広間の升目 ${tl.xs.length}`);
  assert.ok(Math.abs(tl.total - (16 - 0.3) * (8 - 0.3)) < 1e-6, '升目の面積の合計は壁の内側の床の面積');
  assert.equal(cellAtPos(info, [0, 0, -14])!.id, 'hallA');
  assert.equal(cellAtPos(info, [0, 0, -5])!.id, 'entry');
  assert.equal(cellAtPos(info, [100, 0, 0]), null);
});

test('高さの層: 重なる上の区画は上の層・同じ高さでつながる区画も同じ層・重ならない段差は同じ層', () => {
  const pal = themePalette('GenericRoom');
  const cell = (id: string, x0: number, z0: number, x1: number, z1: number, y: number): CellLayout => makeCell({ id, role: 'rest', rects: [{ x0, z0, x1, z1 }], height: 2.8, floorY: y, palette: pal });
  const cells = [cell('low', 0, 0, 10, 10, 0), cell('mezz', 2, 2, 8, 8, 3.4), cell('upperHall', 8, 2, 14, 8, 3.4), cell('split', 10, 0, 16, 2, 1.6), cell('far', 20, 0, 26, 6, 0)];
  const portals = [{ cells: ['mezz', 'upperHall'] as [string, string] }, { cells: ['low', 'split'] as [string, string] }];
  const layers = computeLayers(cells, portals, 1.8);
  assert.deepEqual(layers, [0, 1, 1, 0, 0]);
});

test('見た所だけ描く: 入った区画・開いた扉の向こう・扉の無い開口の向こう。閉じた扉と隠しの壁の向こうは見えない', () => {
  const info = buildMapInfo(labFloor(), t);
  const map = new FloorMap(info, t);
  // 入口の廊下で奥（-Z）を向く: 扉 1 が閉じている → 廊下だけ
  map.update(obs([0, 0, -6], 0));
  assert.deepEqual([...map.seen].sort(), ['entry']);
  assert.ok(map.visited.has('entry'));
  // 扉 1 が開く → 前の広間が見える。広間の向こうの奥の広間（扉の向こうの先）はまだ
  map.update(obs([0, 0, -6], 0, { doors: { door1: 1 } }));
  assert.ok(map.seen.has('hallA'));
  assert.ok(!map.seen.has('hallB'), '扉の向こうのさらに先はたどらない');
  // 後ろを向いていても、すぐ近くの開口は向こうが見える
  const m2 = new FloorMap(info, t);
  m2.update(obs([0, 0, -9.2], Math.PI, { doors: { door1: 1 } }));
  assert.ok(m2.seen.has('hallA'));
  // 前の広間に入る → 広い開口の奥の広間が見える。ボタンの扉（閉）の小部屋・隠し場所は見えない
  map.update(obs([0, 0, -13], 0, { doors: { door1: 1 } }));
  assert.ok(map.seen.has('hallB'));
  assert.ok(!map.seen.has('side'));
  map.update(obs([-6, 0, -21], Math.PI / 2));
  assert.ok(!map.seen.has('secret'), '隠しの壁が現れるまで見えない');
  map.update(obs([-6, 0, -21], Math.PI / 2, { revealed: ['secretWall'] }));
  assert.ok(map.seen.has('secret'));
  assert.ok(map.drawn('secret'));
});

test('調査率: 歩いた所の近くの升目を調べる・区画は cellFull で調べ終わり・100% で完成の知らせ', () => {
  const info = buildMapInfo(labFloor(), t);
  const map = new FloorMap(info, t);
  map.update(obs([0, 0, -2], 0));
  const s0 = map.survey();
  assert.ok(s0 > 0 && s0 < 0.2, `入口の一歩 ${s0}`);
  // 数えるすべての区画の升目の中心を歩く
  const events: string[] = [];
  for (const [id, tl] of info.tiles) {
    for (let i = 0; i < tl.xs.length; i++) {
      const c = info.byId.get(id)!;
      for (const e of map.update(obs([tl.xs[i]!, c.floorY, tl.zs[i]!], 0))) events.push(e.type);
    }
  }
  assert.equal(map.survey(), 1);
  assert.equal(events.filter((e) => e === 'complete').length, 1, '完成の知らせは 1 回');
  assert.ok(map.complete);
  for (const id of info.tiles.keys()) assert.equal(map.cellSurvey(id), 1);
});

test('足跡: 歩いた間隔ごとに残る・上限で古いものから消える', () => {
  const info = buildMapInfo(labFloor(), t);
  const map = new FloorMap(info, t);
  for (let z = -1; z > -9; z -= 0.1) map.update(obs([0, 0, z], 0));
  const n = map.trail.length / 3;
  const step = t['map.trail.stepM'];
  assert.ok(n >= Math.floor(7.9 / step) && n <= Math.ceil(8 / step) + 1, `足跡 ${n}`);
  const small = { ...t, 'map.trail.max': 5 };
  const m2 = new FloorMap(info, small);
  for (let z = -1; z > -9; z -= 0.1) m2.update(obs([0, 0, z], 0));
  assert.equal(m2.trail.length, 15);
  assert.ok(m2.trail[1]! < -25 && m2.trail[13]! < -75, '残っているのは新しい方（奥）');
});

test('保存: 見た所・入った所・調べた升目・足跡・写しが戻る', () => {
  const info = buildMapInfo(labFloor(), t);
  const map = new FloorMap(info, t);
  map.update(obs([0, 0, -3], 0, { doors: { door1: 1 } }));
  map.update(obs([0, 0, -13], 0, { doors: { door1: 1 } }));
  map.addGhost({ source: 'guide', id: 'b1', cells: [[{ x0: 0, z0: 0, x1: 1, z1: 1 }]], marks: [], trail: [] });
  const s = JSON.parse(JSON.stringify(map.save()));
  const back = new FloorMap(info, t, s);
  assert.deepEqual([...back.seen].sort(), [...map.seen].sort());
  assert.deepEqual([...back.visited].sort(), [...map.visited].sort());
  assert.equal(back.survey(), map.survey());
  assert.deepEqual(back.trail, map.trail);
  assert.equal(back.ghosts.length, 1);
  assert.equal(back.addGhost({ source: 'guide', id: 'b1', cells: [], marks: [], trail: [] }), false, '同じ写しは 2 回入らない');
  // 知らない区画・壊れた値は捨てる
  const broken = new FloorMap(info, t, { ...s, seen: ['nope', 'entry', 3], tiles: { hallA: 'zz', nope: 'ff' } });
  assert.deepEqual([...broken.seen], ['entry']);
  // 升目の 16 進
  const bits = new Uint8Array([1, 0, 1, 1, 0, 0, 0, 1, 1]);
  assert.deepEqual([...hexToBits(bitsToHex(bits), bits.length)], [...bits]);
});

test('生成したフロア: 層は 1 つ・出口の階段と隠し場所は調査に数えない・入口から歩いた所は見える', () => {
  for (const w of [1, 2, 3, 4, 5]) {
    const r = generateFloorReport({ world: w, depth: 2, variant: 0 }, t);
    const info = buildMapInfo(r.floor, t);
    assert.ok(info.cells.every((c) => !c.counted || info.tiles.has(c.id)));
    const exitCell = info.exits.find((x) => x.kind === 'stairs')?.cell;
    assert.ok(exitCell && !info.byId.get(exitCell)!.counted, `${r.floor.id}: 出口の階段は数えない（${exitCell}）`);
    for (const c of info.cells) if (c.kind === 'secret') assert.ok(!c.counted);
    assert.ok(info.surveyArea > 50);
    const map = new FloorMap(info, t);
    const sp = r.floor.spawn;
    map.update(obs(sp.pos, sp.yaw));
    assert.ok(map.seen.has(sp.cell), `${r.floor.id}: 入口の区画は見えている`);
    assert.ok(map.survey() > 0);
  }
});

/** 地図の異変の部品を足したフロア（実験場の小部屋に mapFx を置く） */
function labWithFx(fx: string, params: Record<string, number | string> = {}): FloorLayout {
  const f = labFloor();
  const side = f.cells.find((c) => c.id === 'side')!;
  f.entities.push({ id: 'fx1', type: 'mapFx', cell: 'side', params: { fx, aabb: { min: [...side.bounds.min], max: [...side.bounds.max] }, ...params } });
  return f;
}

test('地図が消える（N02）: 部屋に入ると、今いる部屋のほかが消える・調査率は残る・もう一度見ると戻る', () => {
  const info = buildMapInfo(labWithFx('erase', { policy: 'all' }), t);
  const map = new FloorMap(info, t);
  map.update(obs([0, 0, -3], 0, { doors: { door1: 1 } }));
  map.update(obs([0, 0, -13], 0, { doors: { door1: 1 } }));
  map.update(obs([4, 0, -17], Math.PI, { doors: { door1: 1 } }));
  const survey = map.survey();
  assert.ok(map.drawn('entry') && map.drawn('hallA') && map.drawn('hallB'));
  // 小部屋（消える部屋）に入る。扉 2 は開いている。小部屋の奥を向く（+X）
  const ev = map.update(obs([11, 0, -17], -Math.PI / 2, { doors: { door2: 1 } }));
  assert.ok(ev.some((e) => e.type === 'fx' && e.fx === 'erase'));
  assert.ok(map.drawn('side'), '今いる部屋は残る');
  assert.ok(!map.drawn('entry') && !map.drawn('hallB'), '見えていない区画は消える');
  assert.ok(map.survey() >= survey, '調べた記録は残る');
  assert.ok(map.trail.length > 0, '足跡は残る');
  // 振り返ると、開いた扉の向こうの広間がまた見える
  map.update(obs([9.5, 0, -17], Math.PI / 2, { doors: { door2: 1 } }));
  assert.ok(map.drawn('hallA'), 'もう一度見ると戻る');
  assert.ok(!map.drawn('entry'));
});

test('地図が消える（半分）: 決定的に半分', () => {
  const run = (): string[] => {
    const info = buildMapInfo(labWithFx('erase', { policy: 'half' }), t);
    const map = new FloorMap(info, t);
    map.update(obs([0, 0, -3], 0, { doors: { door1: 1 } }));
    map.update(obs([0, 0, -13], 0, { doors: { door1: 1 } }));
    map.update(obs([11, 0, -17], -Math.PI / 2));
    return [...map.erased].sort();
  };
  const a = run();
  assert.equal(a.length, 2, '見ていた 3 つ（入口・前・奥の広間）の半分（切り上げ）');
  assert.deepEqual(run(), a);
});

test('地図が回る（N03）: 部屋の中で回る・出てもしばらく回ったまま・その後に戻る', () => {
  const tt = { ...t, 'map.rotate.holdSec': 5, 'map.rotate.driftDeg': 0 };
  const info = buildMapInfo(labWithFx('rotate', { angle: 90 }), tt);
  const map = new FloorMap(info, tt);
  map.update(obs([0, 0, -13], 0));
  map.update(obs([11, 0, -17], 0, { dt: 0.1 }));
  for (let i = 0; i < 30; i++) map.update(obs([11, 0, -17], 0, { dt: 0.1 }));
  assert.ok(Math.abs(map.rotation - Math.PI / 2) < 1e-3, `回った ${map.rotation}`);
  map.update(obs([4, 0, -17], 0, { dt: 0.1 }));
  assert.equal(map.rotationPhase, 'hold');
  for (let i = 0; i < 40; i++) map.update(obs([4, 0, -17], 0, { dt: 0.1 }));
  assert.ok(Math.abs(map.rotation - Math.PI / 2) < 1e-3, '出て 4 秒はそのまま');
  for (let i = 0; i < 60; i++) map.update(obs([4, 0, -17], 0, { dt: 0.1 }));
  assert.equal(map.rotation, 0);
  assert.equal(map.rotationPhase, 'idle');
});

test('地図に記録されない部屋（N08）: 入っても見ても描かない・調査率に数えない・図鑑の知らせ（visit）は出る', () => {
  const info = buildMapInfo(labWithFx('hide'), t);
  assert.ok(info.byId.get('side')!.hidden);
  assert.ok(!info.tiles.has('side'));
  const map = new FloorMap(info, t);
  map.update(obs([4, 0, -17], -Math.PI / 2, { doors: { door2: 1 } }));
  assert.ok(!map.seen.has('side'));
  const ev = map.update(obs([11, 0, -17], 0, { doors: { door2: 1 } }));
  assert.ok(ev.some((e) => e.type === 'visit' && e.cell === 'side'));
  assert.ok(!map.drawn('side'));
  const n = map.trail.length;
  map.update(obs([13, 0, -15], 0, { doors: { door2: 1 } }));
  assert.equal(map.trail.length, n, '足跡も残らない');
});
