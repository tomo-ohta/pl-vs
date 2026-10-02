/**
 * 地図の画面（小さな地図・メニューの地図・図鑑）と取りまとめ（client/map/MapController.ts）。DOM の無い環境（Node）で:
 * 画面の部品は何も作らずに状態だけ持つ・図鑑に記録して知らせる・壁の地図を写す・M / 地図ボタンで地図のタブ。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { labFloor } from '../core/lab/lab.ts';
import { Codex } from '../client/map/Codex.ts';
import { codexDefs, ideasOf } from '../client/map/codexDefs.ts';
import { contentsOf, floorLabel, MapController, type GameLike } from '../client/map/MapController.ts';
import { MapStore } from '../client/map/MapStore.ts';
import { buildMapInfo } from '../client/map/MapInfo.ts';
import { FloorMap } from '../client/map/MapModel.ts';
import { CodexPanel, codexSections, floorLine } from '../client/ui/CodexPanel.ts';
import { MapPanel } from '../client/ui/MapPanel.ts';
import { Minimap } from '../client/ui/Minimap.ts';
import type { PauseTab, UiRefs } from '../client/ui/dom.ts';
import type { InputState } from '../client/input/InputController.ts';

const t = defaultTuning();

class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
}

test('DOM の無い環境: 小さな地図・メニューの地図・図鑑は何も作らずに動く', () => {
  const info = buildMapInfo(labFloor(), t);
  const map = new FloorMap(info, t);
  map.update({ pos: [0, 0, -3], yaw: 0, dt: 0.1, doorAngle: () => 0, revealed: () => false });
  const mini = new Minimap(null, null);
  mini.update(map, 0.1, { player: { x: 0, z: -3, yaw: 0 } });
  assert.equal(mini.draws, 0);
  assert.match(mini.surveyText, /^調査 \d+%$/);
  const panel = new MapPanel(null);
  panel.show({ map, floorLabel: 'B1F', player: null });
  panel.update(0.1);
  assert.equal(panel.headText().title, 'B1F');
  assert.match(panel.headText().sub, /^調査 \d+% ・ 入った区画 1 \/ 4$/);
  assert.equal(panel.onKey('ArrowUp'), false, '層が 1 つなら ↑↓ は使わない');
  const cp = new CodexPanel(null);
  cp.render(Codex.load(null), codexDefs());
  assert.equal(cp.renders, 1);
});

test('図鑑の中身: 見つけていない物は伏せる・案の番号は台帳から・フロアの記録の 1 行', () => {
  const codex = Codex.load(null);
  const defs = codexDefs();
  assert.ok(defs.some((d) => d.kind === 'gimmick' && d.id === 'tiltRoom'));
  assert.ok(defs.some((d) => d.kind === 'anomaly' && d.id === 'fog'));
  assert.equal(defs.filter((d) => d.kind === 'dest').length, 5);
  codex.find('gimmick', 'tiltRoom');
  const sec = codexSections(codex, defs);
  const g = sec.find((s) => s.kind === 'gimmick')!;
  assert.equal(g.found, 1);
  assert.equal(g.items.find((i) => i.id === 'tiltRoom')!.name, '傾く床');
  assert.equal(g.items.find((i) => i.id === 'narrowPath')!.name, '？？？');
  assert.deepEqual(ideasOf('gimmick', 'nope'), []);
  assert.equal(floorLine({ key: 'k', label: 'B2F', first: 'x', visits: 1, survey: 0.426, complete: false, secrets: { found: 0, total: 2 } }), 'B2F ・ 調査 42%');
  assert.equal(floorLine({ key: 'k', label: 'B2F 裏', first: 'x', visits: 3, survey: 1, complete: true, secrets: { found: 1, total: 2 } }), 'B2F 裏 ・ 調査 100% ✓ ・ 隠し 1 / 2 ・ 3 回');
  assert.equal(floorLabel({ world: 1, depth: 3, variant: 1 }), 'B4F 裏');
});

/** 偽のゲーム（位置を書き換えて歩かせる） */
function fakeGame(outputs: Record<string, number> = {}): GameLike & { pos: [number, number, number]; pauses: number } {
  const g = {
    pos: [0, 0, 0] as [number, number, number], pauses: 0, paused: false,
    sim: null as GameLike['sim'],
    pause() { g.paused = true; g.pauses++; },
  };
  g.sim = { players: [{ get pos() { return g.pos; }, yaw: 0 }], outputOf: (id, port) => outputs[`${id}.${port}`] ?? 0, isRevealed: () => false, focusedInteractable: () => null };
  return g;
}

/** 偽の画面（タブ・知らせ・一時停止の表示だけ） */
function fakeUi(): UiRefs & { toasts: string[] } {
  let tab: PauseTab = 'settings';
  let visible = false;
  const ui = {
    toasts: [] as string[], minimap: null, survey: null, pause: { panes: { map: null, codex: null, settings: null } },
    toast(s: string) { ui.toasts.push(s); }, setHint() {}, setPauseVisible(v: boolean) { visible = v; },
    get pauseVisible() { return visible; }, setTab(x: PauseTab) { tab = x; ui.onTabChange?.(x); }, get tab() { return tab; }, onTabChange: null as ((t: PauseTab) => void) | null,
  };
  return ui as unknown as UiRefs & { toasts: string[] };
}

const noInput: InputState = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, jump: false, dash: false, crouch: false, interact: false, flashlight: false, drop: false, menu: false, map: false, tap: null };

test('取りまとめ: 区画に入ると図鑑に記録して知らせる（2 回目は知らせない）・フロアの記録・保存', () => {
  let r = generateFloorReport({ world: 1, depth: 2, variant: 0 }, t);
  for (let w = 2; w < 40 && !r.gimmicks?.gimmicks.length; w++) r = generateFloorReport({ world: w, depth: 2, variant: 0 }, t);
  const g0 = r.gimmicks!.gimmicks[0]!;
  const game = fakeGame();
  const ui = fakeUi();
  const mem = new MemoryStorage();
  const codex = Codex.load(mem);
  const mc = new MapController({ game, ui, tuning: t, codex, store: MapStore.load(mem), defs: codexDefs() });
  mc.setFloor(r.floor, r, { world: 1, depth: 2, variant: 0 });
  assert.equal(codex.floor('1:2.0')!.label, 'B3F');
  assert.equal(codex.floor('1:2.0')!.secrets!.total, r.gimmicks!.secrets.length);
  const cell = r.floor.cells.find((c) => c.id === g0.cell)!;
  const fp = cell.footprint[0]!;
  game.pos = [(fp.x0 + fp.x1) / 2, cell.floorY, (fp.z0 + fp.z1) / 2];
  mc.frame(noInput, 1 / 60);
  assert.ok(codex.has('gimmick', g0.def), '仕掛けを記録');
  assert.ok(ui.toasts.some((s) => s.startsWith('図鑑に記録')), ui.toasts.join(' / '));
  const n = ui.toasts.length;
  game.pos = [...r.floor.spawn.pos];
  mc.frame(noInput, 1 / 60);
  game.pos = [(fp.x0 + fp.x1) / 2, cell.floorY, (fp.z0 + fp.z1) / 2];
  mc.frame(noInput, 1 / 60);
  assert.equal(ui.toasts.length, n, '2 回目は知らせない');
  mc.saveNow();
  const again = MapStore.load(mem).get(mc.info!.key)!;
  assert.ok(again.visited.includes(g0.cell));
  // 同じフロアをもう一度読むと、地図は続きから
  mc.setFloor(r.floor, r, { world: 1, depth: 2, variant: 0 });
  assert.ok(mc.map!.visited.has(g0.cell));
  assert.equal(codex.floor('1:2.0')!.visits, 2);
  assert.ok(contentsOf(null).gimmicks.size === 0);
});

test('取りまとめ: 壁の地図を読む（部品の read）と写す・M / 地図ボタンで地図のタブを開く', () => {
  const f = labFloor();
  f.entities.push({ id: 'board1', type: 'mapBoard', cell: 'entry', params: { mode: 'guide', box: { min: [1.3, 1, -4], max: [1.35, 2, -2] }, cells: ['entry', 'hallA'], here: [0, -3], exit: [0, -25] } });
  const outputs: Record<string, number> = {};
  const game = fakeGame(outputs);
  const ui = fakeUi();
  const mc = new MapController({ game, ui, tuning: t, codex: Codex.load(null), store: MapStore.load(null), defs: [] });
  mc.setFloor(f, null, { world: 1, depth: 0, variant: 0 });
  game.pos = [0, 0, -3];
  mc.frame(noInput, 1 / 60);
  assert.equal(mc.map!.ghosts.length, 0);
  outputs['board1.read'] = 1;
  mc.frame(noInput, 1 / 60);
  assert.equal(mc.map!.ghosts.length, 1);
  assert.ok(ui.toasts.some((s) => s.includes('案内図')));
  mc.frame(noInput, 1 / 60);
  assert.equal(mc.map!.ghosts.length, 1, '1 回だけ写す');
  mc.frame({ ...noInput, map: true }, 1 / 60);
  assert.equal(game.pauses, 1);
  assert.equal(ui.pauseVisible, true);
  assert.equal(ui.tab, 'map');
  // 開いている間に押しても、もう一度は止めない
  ui.setTab('codex');
  mc.frame({ ...noInput, map: true }, 1 / 60);
  assert.equal(game.pauses, 1);
  assert.equal(ui.tab, 'map');
});
