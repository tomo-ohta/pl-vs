import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNING_SPEC, defaultTuning, diffFromDefault, makeTuning, parseTuneParam, tuningVersion } from '../core/config/tuning.ts';

test('既定値は範囲の中にある', () => {
  for (const [k, s] of Object.entries(TUNING_SPEC)) {
    if (s.kind === 'number') assert.ok(s.default >= s.min && s.default <= s.max, k);
  }
  assert.equal(defaultTuning()['secrets.perFloorMean'], 1.2);
});

test('URL の上書きを読む・誤りは返す', () => {
  const { tuning, errors } = makeTuning(parseTuneParam('secrets.perFloorMean=2.5,secrets.visibilityCheck=false,nope=1,floor.sizeM=9999'));
  assert.equal(tuning['secrets.perFloorMean'], 2.5);
  assert.equal(tuning['secrets.visibilityCheck'], false);
  assert.equal(tuning['floor.sizeM'], 70); // 範囲外は採用しない
  assert.equal(errors.length, 2);
  assert.deepEqual(diffFromDefault(tuning), { 'secrets.perFloorMean': 2.5, 'secrets.visibilityCheck': false });
});

test('識別子は値が同じなら同じ・違えば違う', () => {
  assert.equal(tuningVersion(defaultTuning()), tuningVersion(makeTuning({}).tuning));
  assert.notEqual(tuningVersion(defaultTuning()), tuningVersion(makeTuning({ 'secrets.perFloorMean': 1.3 }).tuning));
});
