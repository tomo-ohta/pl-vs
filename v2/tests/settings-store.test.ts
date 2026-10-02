import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_PREFIX } from '../client/env.ts';
import { DEFAULT_SETTINGS, SETTINGS_KEY, Settings, sanitize } from '../client/settings/Settings.ts';

/** localStorage の代わり（getItem / setItem だけ） */
class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
}

test('保存名は liminal2.settings.v1（v1 の liminal.* と分ける）', () => {
  assert.equal(SETTINGS_KEY, 'liminal2.settings.v1');
  assert.ok(SETTINGS_KEY.startsWith(STORAGE_PREFIX));
  assert.equal(STORAGE_PREFIX, 'liminal2.');
});

test('localStorage（差し替え）から読み、変更はすぐ保存して通知する', () => {
  const mem = new MemoryStorage();
  (globalThis as { localStorage?: unknown }).localStorage = mem;
  const s = Settings.load();
  assert.deepEqual(s.data, DEFAULT_SETTINGS);
  assert.equal(s.data.masterVolume, 0.25);

  const seen: string[][] = [];
  s.onChange((_d, changed) => seen.push(changed));
  s.set({ masterVolume: 0.5, tier: 'low' });
  assert.deepEqual(seen, [['masterVolume', 'tier']]);
  const saved = JSON.parse(mem.getItem(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
  assert.equal(saved.masterVolume, 0.5);
  assert.equal(saved.tier, 'low');

  // 変化が無ければ保存も通知もしない
  s.set({ masterVolume: 0.5 });
  assert.equal(seen.length, 1);

  // 読み直すと同じ値
  const again = Settings.load();
  assert.equal(again.data.masterVolume, 0.5);
  assert.equal(again.data.tier, 'low');

  // 既定に戻す
  s.reset();
  assert.deepEqual(s.data, DEFAULT_SETTINGS);
  assert.deepEqual(JSON.parse(mem.getItem(SETTINGS_KEY) ?? '{}'), { ...DEFAULT_SETTINGS });
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

test('型が違う・範囲外・知らない選択肢は丸める（sanitize）', () => {
  const mem = new MemoryStorage();
  mem.setItem(SETTINGS_KEY, JSON.stringify({
    masterVolume: 3, ambientVolume: -1, sfxVolume: 'loud', lookSensitivity: 10, tier: 'ultra', postfx: 'archival',
    handheld: NaN, cameraLag: 'yes', recOverlay: 0, frameHold: '60', vhsStrength: 5, toneMapping: 'reinhard',
  }));
  const s = Settings.load(mem);
  assert.deepEqual(s.data, {
    masterVolume: 1, ambientVolume: 0, sfxVolume: 1, lookSensitivity: 3, tier: 'auto', postfx: 'tape',
    handheld: 0.6, cameraLag: true, recOverlay: true, frameHold: 'off', vhsStrength: 2, toneMapping: 'agx',
  });
  // 下限側
  const low = sanitize({ ...DEFAULT_SETTINGS, lookSensitivity: 0.01, vhsStrength: -1, handheld: -0.5 });
  assert.equal(low.lookSensitivity, 0.3);
  assert.equal(low.vhsStrength, 0);
  assert.equal(low.handheld, 0);
  // 正しい値はそのまま
  const ok = sanitize({ ...DEFAULT_SETTINGS, tier: 'mid', postfx: 'homeVideo', frameHold: '24', toneMapping: 'aces', cameraLag: false });
  assert.equal(ok.tier, 'mid');
  assert.equal(ok.postfx, 'homeVideo');
  assert.equal(ok.frameHold, '24');
  assert.equal(ok.toneMapping, 'aces');
  assert.equal(ok.cameraLag, false);
  // 部分更新も丸める
  s.set({ masterVolume: -5 });
  assert.equal(s.data.masterVolume, 0);
});

test('壊れた保存値・保存先なし・保存の失敗でも既定値で動く', () => {
  const broken = new MemoryStorage();
  broken.setItem(SETTINGS_KEY, '{not json');
  assert.deepEqual(Settings.load(broken).data, DEFAULT_SETTINGS);

  const none = Settings.load(null);
  assert.deepEqual(none.data, DEFAULT_SETTINGS);
  none.set({ sfxVolume: 0.3 });
  assert.equal(none.data.sfxVolume, 0.3);

  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const s = Settings.load(full);
  assert.equal(s.save(), false);
  s.set({ ambientVolume: 0.2 }); // 投げない
  assert.equal(s.data.ambientVolume, 0.2);
});

test('v1 の保存（liminal.settings.*）は読まない（v2 は新しく始める）', () => {
  const mem = new MemoryStorage();
  mem.setItem('liminal.settings.v3', JSON.stringify({ ...DEFAULT_SETTINGS, masterVolume: 0.9 }));
  mem.setItem('liminal.settings.v1', JSON.stringify({ ...DEFAULT_SETTINGS, masterVolume: 0.7 }));
  const s = Settings.load(mem);
  assert.deepEqual(s.data, DEFAULT_SETTINGS);
  s.set({ masterVolume: 0.4 });
  assert.ok(mem.map.has(SETTINGS_KEY));
  assert.equal(JSON.parse(mem.getItem('liminal.settings.v3') ?? '{}').masterVolume, 0.9); // v1 の保存には触らない
});
