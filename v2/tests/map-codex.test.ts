/**
 * 図鑑（client/map/Codex.ts）と地図の保存（MapStore.ts）: 保存名・初めて見つけたときだけ知らせる・壊れた保存値・古いものから忘れる。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_PREFIX } from '../client/env.ts';
import { Codex, CODEX_KEY, sanitizeCodex } from '../client/map/Codex.ts';
import { MAPS_KEY, MapStore } from '../client/map/MapStore.ts';
import type { MapSave } from '../client/map/MapModel.ts';

class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
}

test('保存名は liminal2.codex.v1 / liminal2.maps.v1（v1 の liminal.* と分ける）', () => {
  assert.equal(CODEX_KEY, 'liminal2.codex.v1');
  assert.equal(MAPS_KEY, 'liminal2.maps.v1');
  assert.ok(CODEX_KEY.startsWith(STORAGE_PREFIX) && MAPS_KEY.startsWith(STORAGE_PREFIX));
});

test('図鑑: 初めて見つけたときだけ true・数える・読み直すと同じ', () => {
  const mem = new MemoryStorage();
  const c = Codex.load(mem);
  c.now = () => '2026-10-02T00:00:00.000Z';
  let changes = 0;
  c.onChange(() => changes++);
  assert.equal(c.find('gimmick', 'tiltRoom', '傾く床', '1:2.0'), true);
  assert.equal(c.find('gimmick', 'tiltRoom'), false);
  assert.equal(c.get('gimmick', 'tiltRoom')!.count, 2);
  assert.equal(c.find('secret', 'tilt.clearProps', '傾く床（物の隙間から漏れる光）'), true);
  assert.equal(changes, 2, '新しく見つけたときだけ知らせる');
  const again = Codex.load(mem);
  assert.ok(again.has('gimmick', 'tiltRoom'));
  assert.equal(again.get('secret', 'tilt.clearProps')!.label, '傾く床（物の隙間から漏れる光）');
  assert.equal(again.count('anomaly'), 0);
});

test('図鑑: フロアの記録・調査率は下がらない・完成は 1 回だけ知らせる・隠しの数', () => {
  const mem = new MemoryStorage();
  const c = Codex.load(mem);
  const r = c.recordFloor('1:2.0', 'B3F', { rarity: 'Rare', family: 'office', secretsTotal: 2 });
  assert.equal(r.visits, 1);
  c.recordFloor('1:2.0', 'B3F');
  assert.equal(c.floor('1:2.0')!.visits, 2);
  assert.equal(c.setSurvey('1:2.0', 0.5, 1), false);
  assert.equal(c.setSurvey('1:2.0', 0.3), false);
  assert.equal(c.floor('1:2.0')!.survey, 0.5, '下がらない');
  assert.equal(c.setSurvey('1:2.0', 1), true);
  assert.equal(c.setSurvey('1:2.0', 1), false);
  assert.deepEqual(Codex.load(mem).floor('1:2.0')!.secrets, { found: 1, total: 2 });
  assert.equal(Codex.load(mem).floor('1:2.0')!.complete, true);
});

test('図鑑: 壊れた保存値・保存先なし・保存の失敗でも動く', () => {
  const broken = new MemoryStorage();
  broken.setItem(CODEX_KEY, '{not json');
  assert.equal(Codex.load(broken).count('gimmick'), 0);
  const odd = sanitizeCodex({ v: 1, found: { gimmick: { a: { first: 'x', count: -3 }, b: 5, c: { count: 1 } }, nope: {} }, floors: { k: { label: 'B1F', first: 'x', survey: 7 } } });
  assert.deepEqual(Object.keys(odd.found.gimmick), ['a']);
  assert.equal(odd.found.gimmick.a!.count, 1);
  assert.equal(odd.floors.k!.survey, 1);
  assert.equal(sanitizeCodex({ v: 2 }).floors && Object.keys(sanitizeCodex({ v: 2 }).floors).length, 0);
  const none = Codex.load(null);
  assert.equal(none.find('rare', 'white'), true);
  const full = Codex.load({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  assert.equal(full.find('anomaly', 'fog'), true);
  assert.equal(full.save(), false);
});

const save = (n: number): MapSave => ({ v: 1, seen: [`c${n}`], visited: [], erased: [], tiles: {}, trail: [n], ghosts: [], read: [], complete: false });

test('地図の保存: フロアごとに覚える・古いものから忘れる・読み直すと同じ', () => {
  const mem = new MemoryStorage();
  const s = MapStore.load(mem, 3);
  for (let i = 0; i < 5; i++) s.put(`f${i}`, save(i));
  assert.deepEqual(s.keys(), ['f4', 'f3', 'f2']);
  assert.equal(s.get('f0'), null);
  assert.ok(!mem.getItem(`${MAPS_KEY}:f0`), '忘れたフロアは保存先からも消す');
  assert.ok(mem.getItem(`${MAPS_KEY}:f4`), 'フロアごとに別の鍵で保存（歩いている間は今のフロアだけ書く）');
  s.put('f2', save(22));
  assert.deepEqual(s.keys(), ['f2', 'f4', 'f3'], '使ったものが先頭へ');
  const again = MapStore.load(mem, 3);
  assert.deepEqual(again.get('f2')!.trail, [22]);
  assert.deepEqual(again.keys(), ['f2', 'f4', 'f3']);
  const broken = new MemoryStorage();
  broken.setItem(MAPS_KEY, '[1,2');
  assert.equal(MapStore.load(broken).get('f1'), null);
  assert.equal(MapStore.load(null).put('x', save(1)), true);
});
