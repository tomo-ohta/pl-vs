/**
 * 地図の絵（client/map/draw.ts）と描く物（scene.ts）: 見た区画だけ・回転・空白・写し・壁の地図の嘘。
 * 描く先は命令を記録する偽物（DOM の無い Node で動く）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { labFloor } from '../core/lab/lab.ts';
import { drawMap, type Ctx2D, type DrawInput } from '../client/map/draw.ts';
import { buildMapInfo } from '../client/map/MapInfo.ts';
import { FloorMap, type MapObservation } from '../client/map/MapModel.ts';
import { ghostOf, readableContent, sceneOfMap, sceneOfReadable } from '../client/map/scene.ts';
import { MapPanel } from '../client/ui/MapPanel.ts';
import { makeCell, portal, portalAabb } from '../core/world/build.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

const t = defaultTuning();

interface Op { op: string; args: unknown[]; fill: unknown; stroke: unknown; alpha: number }
/** 命令を記録する描く先 */
function fakeCtx(): Ctx2D & { ops: Op[] } {
  const ops: Op[] = [];
  const st = { fillStyle: '#000' as unknown, strokeStyle: '#000' as unknown, lineWidth: 1, globalAlpha: 1, font: '', textAlign: 'left', textBaseline: 'top' };
  const rec = (op: string) => (...args: unknown[]): void => { ops.push({ op, args, fill: st.fillStyle, stroke: st.strokeStyle, alpha: st.globalAlpha }); };
  return Object.assign(st, {
    ops,
    setLineDash: rec('setLineDash'), fillRect: rec('fillRect'), strokeRect: rec('strokeRect'), clearRect: rec('clearRect'), beginPath: rec('beginPath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), arc: rec('arc'), closePath: rec('closePath'), fill: rec('fill'), stroke: rec('stroke'), save: rec('save'),
    restore: rec('restore'), translate: rec('translate'), rotate: rec('rotate'), fillText: rec('fillText'),
  }) as unknown as Ctx2D & { ops: Op[] };
}

const obs = (pos: [number, number, number], yaw: number, doors: Record<string, number> = {}): MapObservation => ({ pos, yaw, dt: 1 / 60, doorAngle: (id) => doors[id] ?? 0, revealed: () => false });

test('描く: 中心と縮尺どおりの位置に区画を塗る・回転は rotate・プレイヤーの矢印', () => {
  const ctx = fakeCtx();
  const input: DrawInput = {
    cells: [{ id: 'a', rects: [{ x0: 0, z0: 0, x1: 4, z1: 2 }], state: 'visited' }], blanks: [], ghosts: [], doors: [], marks: [], trail: [],
    player: { x: 1, z: 1, yaw: 0 }, bounds: null,
  };
  const r = drawMap(ctx, input, { width: 200, height: 100, center: [0, 0], pxPerM: 10, style: 'panel', rotation: 0.5 });
  assert.equal(r.scale, 10);
  assert.deepEqual(r.toPx(0, 0), [100, 50]);
  const fills = ctx.ops.filter((o) => o.op === 'fillRect' && o.args[0] === 100 && o.args[1] === 50);
  assert.equal(fills.length, 1, '区画の塗り');
  assert.deepEqual(fills[0]!.args, [100, 50, 40, 20]);
  assert.ok(ctx.ops.some((o) => o.op === 'rotate' && o.args[0] === 0.5), '地図の回転');
  assert.ok(ctx.ops.some((o) => o.op === 'translate' && o.args[0] === 110 && o.args[1] === 60), 'プレイヤーの位置');
});

test('描く: 範囲に合わせる（回転しても収まる）', () => {
  const ctx = fakeCtx();
  const input: DrawInput = { cells: [{ id: 'a', rects: [{ x0: 0, z0: 0, x1: 40, z1: 10 }], state: 'seen' }], blanks: [], ghosts: [], doors: [], marks: [], trail: [], player: null, bounds: { x0: 0, z0: 0, x1: 40, z1: 10 } };
  const flat = drawMap(ctx, input, { width: 420, height: 420, center: null, pxPerM: 100, style: 'panel', pad: 10 });
  assert.equal(flat.scale, 10);
  const turned = drawMap(fakeCtx(), input, { width: 420, height: 420, center: null, pxPerM: 100, style: 'panel', pad: 10, rotation: Math.PI / 2 });
  assert.equal(turned.scale, 10, '90° 回っても同じ大きさで収まる');
});

test('自分の地図の描く物: 見た区画だけ・隠し場所への扉は見つけるまで描かない・足跡', () => {
  const info = buildMapInfo(labFloor(), t);
  const map = new FloorMap(info, t);
  map.update(obs([0, 0, -3], 0, { door1: 1 }));
  map.update(obs([0, 0, -13], 0, { door1: 1 }));
  const s = sceneOfMap(map, { player: { x: 0, z: -13, yaw: 0 } });
  const ids = s.cells.map((c) => c.id).sort();
  assert.deepEqual(ids, ['entry', 'hallA', 'hallB']);
  assert.equal(s.cells.find((c) => c.id === 'hallA')!.state, 'current');
  assert.equal(s.cells.find((c) => c.id === 'hallB')!.state, 'seen');
  assert.ok(s.cells.find((c) => c.id === 'entry')!.unsurveyed!.length > 0, '入った区画の調べていない升目');
  assert.ok(!s.doors.some((d) => d.kind === 'secret'), '隠し場所への扉は描かない');
  assert.ok(s.trail.length >= 2);
  assert.ok(s.bounds && s.bounds.z0 <= -26 && s.bounds.z1 >= 0);
  // 描ける
  drawMap(fakeCtx(), s, { width: 300, height: 300, center: null, pxPerM: 8, style: 'panel', north: true, label: 'B1F' });
});

test('地図の空白（BX04）: 測量図の区画が見えたら、壁の向こうの隠し場所を白く描く・入ったら空白は消える', () => {
  const f = labFloor();
  f.entities.push({ id: 'g:mapBlank:hallB.table', type: 'mapBoard', cell: 'hallB', params: { mode: 'survey', blank: true, box: { min: [0, 0.8, -22], max: [1, 0.82, -21] }, center: [0, -22], radius: 12, cells: ['hallA', 'hallB'], here: [0, -22] } });
  const info = buildMapInfo(f, t);
  assert.deepEqual(info.blanks.get('hallB')!.cells, ['secret']);
  const map = new FloorMap(info, t);
  map.update(obs([0, 0, -13], 0));
  assert.equal(sceneOfMap(map).blanks.length, 1);
  const ctx = fakeCtx();
  drawMap(ctx, sceneOfMap(map), { width: 300, height: 300, center: null, pxPerM: 8, style: 'panel' });
  assert.ok(ctx.ops.some((o) => o.op === 'fillRect' && o.fill === '#f1eee4'), '白い紙の地');
  map.update(obs([-11, 0, -21], 0));
  assert.equal(sceneOfMap(map).blanks.length, 0, '隠し場所に入ったら空白ではない');
  // 測量図の中身にも空白
  const r = info.readables.find((x) => x.mode === 'survey')!;
  assert.equal(readableContent(info, r).blanks.length, 1);
});

test('壁の地図の中身: 案内図の嘘（隠し場所に部屋・出口の場所・無い廊下・描かない廊下）と写し', () => {
  const f = labFloor();
  const add = (id: string, params: Record<string, unknown>): void => { f.entities.push({ id, type: 'mapBoard', cell: 'entry', params: { box: { min: [1.3, 1, -4], max: [1.35, 2, -2] }, ...params } as never }); };
  add('b-secret', { mode: 'guide', cells: ['entry', 'hallA', 'hallB'], here: [0, -3], exit: [0, -25], lie: { kind: 'secret', cells: ['secret'] } });
  add('b-exit', { mode: 'guide', cells: ['entry', 'hallA', 'hallB'], here: [0, -3], exit: [0, -25], lie: { kind: 'exit', exit: [11, -17] } });
  add('b-phantom', { mode: 'guide', cells: ['entry', 'hallA'], here: [0, -3], exit: [0, -25], lie: { kind: 'phantom', rects: [{ x0: -14, z0: -12, x1: -8, z1: -10 }] } });
  add('b-missing', { mode: 'guide', cells: ['entry', 'hallA', 'hallB'], here: [0, -3], exit: [0, -25], lie: { kind: 'missing', cells: ['hallB'] } });
  add('b-here', { mode: 'here', cells: ['hallA', 'side'], here: [11, -17] });
  const info = buildMapInfo(f, t);
  const get = (id: string) => readableContent(info, info.readables.find((r) => r.id === id)!);
  assert.equal(get('b-secret').cells.length, 4, '隠し場所の所にも部屋');
  assert.deepEqual(get('b-exit').marks.find((m) => m.kind === 'exit'), { x: 11, z: -17, kind: 'exit', text: '出口' });
  assert.equal(get('b-phantom').cells.length, 3);
  assert.deepEqual(get('b-missing').ids, ['entry', 'hallA']);
  const here = info.readables.find((r) => r.id === 'b-here')!;
  const g = ghostOf(info, here);
  assert.equal(g.source, 'here');
  assert.deepEqual(g.marks.map((m) => m.text), ['現在地？'], '看板の現在地は嘘ごと写す');
  const guide = ghostOf(info, info.readables.find((r) => r.id === 'b-secret')!);
  assert.ok(!guide.marks.some((m) => m.kind === 'here'), '案内図の現在地は写さない');
  // 板の絵
  const sc = sceneOfReadable(info, info.readables.find((r) => r.id === 'b-secret')!);
  assert.equal(sc.cells.length, 4);
  drawMap(fakeCtx(), sc, { width: 512, height: 512, center: null, pxPerM: 30, style: 'sign', label: 'フロア案内図' });
});

test('誰かの地図（N09）: 書き込み・歩いた跡・名前', () => {
  const f = labFloor();
  f.entities.push({ id: 'note1', type: 'mapNote', cell: 'side', params: { box: { min: [11, 0, -18], max: [11.3, 0.02, -17.7] }, author: 'K.', date: '2003.07.13', cells: ['entry', 'hallA'], marks: [{ x: 0, z: -14, text: 'ここで迷った', kind: 'note' }, { x: -10, z: -21, text: '壁の向こう、音がする', kind: 'x' }], trail: [0, -2, 0, -8, 0, -14] } });
  const info = buildMapInfo(f, t);
  const r = info.readables.find((x) => x.id === 'note1')!;
  assert.equal(r.mode, 'note');
  const c = readableContent(info, r);
  assert.equal(c.author, 'K.');
  assert.equal(c.marks.length, 2);
  const g = ghostOf(info, r);
  assert.equal(g.source, 'note');
  assert.deepEqual(g.trail, [0, -2, 0, -8, 0, -14]);
  const map = new FloorMap(info, t);
  assert.ok(map.addGhost(g));
  map.update(obs([0, 0, -3], 0));
  const s = sceneOfMap(map);
  assert.equal(s.ghosts.length, 1);
  assert.ok(s.bounds!.z0 <= -14, '写しも範囲に入る');
});

test('上下に重なる区画: 層ごとに描く（ほかの層は薄い破線）・メニューの地図は ↑↓ で層を変える', () => {
  const pal = themePalette('GenericRoom');
  const low = makeCell({ id: 'low', role: 'rest', rects: [{ x0: 0, z0: 0, x1: 10, z1: 10 }], height: 6.5, floorY: 0, palette: pal });
  const mezz = makeCell({ id: 'mezz', role: 'rest', rects: [{ x0: 2, z0: 2, x1: 8, z1: 6 }], height: 2.8, floorY: 3.4, palette: pal });
  const hall = makeCell({ id: 'upHall', role: 'connector', name: '廊下', rects: [{ x0: 8, z0: 3, x1: 14, z1: 5 }], height: 2.8, floorY: 3.4, palette: pal });
  const floor: FloorLayout = {
    id: 'test', seed: 1, genVersion: 't', tuningVersion: 't', bounds: { min: [0, 0, 0], max: [14, 7, 10] }, cells: [low, mezz, hall],
    portals: [portal('p1', 'mezz', 'upHall', portalAabb('x', 8, 4, 1.0, 3.4, 2.1), 1)], entities: [], surfaces: [], spawn: { pos: [1, 0.02, 1], yaw: 0, cell: 'low' }, exits: [],
  };
  const info = buildMapInfo(floor, t);
  assert.equal(info.layers, 2);
  assert.deepEqual(info.cells.map((c) => c.layer), [0, 1, 1]);
  const map = new FloorMap(info, t);
  map.update(obs([5, 3.42, 4], -Math.PI / 2));
  assert.equal(map.current, 'mezz', '中二階の上（重なるときは小さい区画）');
  map.update(obs([5, 0.02, 4], 0));
  assert.equal(map.current, 'low', '中二階の下にいれば下の区画');
  map.update(obs([1, 0.02, 1], 0));
  assert.equal(map.current, 'low');
  const s0 = sceneOfMap(map);
  assert.equal(s0.cells.find((c) => c.id === 'low')!.state, 'current');
  assert.equal(s0.cells.find((c) => c.id === 'mezz')!.state, 'other');
  const s1 = sceneOfMap(map, { layer: 1 });
  assert.equal(s1.cells.find((c) => c.id === 'mezz')!.state, 'visited');
  assert.equal(s1.cells.find((c) => c.id === 'low')!.state, 'other');
  const panel = new MapPanel(null);
  panel.show({ map, floorLabel: 'B1F', player: null });
  assert.equal(panel.shownLayer, 0);
  assert.ok(panel.onKey('ArrowUp'));
  assert.equal(panel.shownLayer, 1);
  assert.ok(!panel.onKey('ArrowUp'), '一番上');
  assert.ok(panel.onKey('ArrowDown'));
  assert.equal(panel.shownLayer, 0);
});
