import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecOverlay, formatTimecode } from '../client/ui/RecOverlay.ts';

test('タイムコードは HH:MM:SS:FF（FF は 30 fps）', () => {
  assert.equal(formatTimecode(0), '00:00:00:00');
  assert.equal(formatTimecode(3661.5), '01:01:01:15');
  assert.equal(formatTimecode(59.999), '00:00:59:29');
  assert.equal(formatTimecode(-3), '00:00:00:00');
  assert.equal(formatTimecode(100 * 3600 + 2), '00:00:02:00'); // 時は 2 桁で回る
});

test('document の無い環境（Node）では DOM を作らずに経過だけ進める', () => {
  const rec = new RecOverlay();
  assert.equal(rec.parent, null);
  assert.equal(rec.isVisible, false);
  rec.update(0.5); // 非表示でも経過は進む
  rec.setVisible(true);
  assert.equal(rec.isVisible, true);
  rec.update(1.25);
  assert.equal(rec.elapsed, 1.75);
  rec.update(-1); // 負の dt は無視
  assert.equal(rec.elapsed, 1.75);
  rec.dispose();
  assert.equal(rec.isVisible, false);
});
