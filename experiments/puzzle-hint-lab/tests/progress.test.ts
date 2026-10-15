/**
 * 進行の計算の試験: ヒントの段階の境目・次の境目・デバッグで制圧する部屋の選び方
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintStage, nextTarget, percent, pickDebugSolves } from '../src/gen/progress.ts';
import { makeRng } from '../src/gen/rng.ts';
import type { Difficulty } from '../src/gen/types.ts';

test('ヒントの段階: 制圧 50 / 75 / 95 部屋で 1 / 2 / 3', () => {
  assert.equal(hintStage(0), 0);
  assert.equal(hintStage(49), 0);
  assert.equal(hintStage(50), 1);
  assert.equal(hintStage(74), 1);
  assert.equal(hintStage(75), 2);
  assert.equal(hintStage(94), 2);
  assert.equal(hintStage(95), 3);
  assert.equal(hintStage(100), 3);
  // 境目を変えたとき
  assert.equal(hintStage(10, [10, 20, 30]), 1);
});

test('次の境目: 50 → 75 → 95 → 100 → なし', () => {
  assert.equal(nextTarget(0, 100), 50);
  assert.equal(nextTarget(50, 100), 75);
  assert.equal(nextTarget(80, 100), 95);
  assert.equal(nextTarget(95, 100), 100);
  assert.equal(nextTarget(100, 100), null);
});

test('率は切り捨て（全部そろったときだけ 100 %）', () => {
  assert.equal(percent(0, 100), 0);
  assert.equal(percent(42, 100), 42);
  assert.equal(percent(199, 200), 99);
  assert.equal(percent(200, 200), 100);
});

test('デバッグの制圧: 未制圧を難易度の低い順に、今いる部屋は後回し', () => {
  const diff: Difficulty[] = [0, 0, 1, 2, 3, 0, 1, 2];
  const solved = [true, false, false, false, false, false, false, false];
  const picked = pickDebugSolves(diff, solved, 4, 5, makeRng(1));
  assert.equal(picked.length, 4);
  assert.ok(!picked.includes(0), '制圧済みは選ばない');
  assert.ok(!picked.includes(5), '今いる部屋は、ほかで足りる間は選ばない');
  assert.deepEqual(picked.map((i) => diff[i]), [0, 1, 1, 2]);
  // 足りないときは今いる部屋も使う
  const all = pickDebugSolves(diff, solved, 7, 5, makeRng(2));
  assert.equal(all.length, 7);
  assert.equal(all[6], 5);
});
