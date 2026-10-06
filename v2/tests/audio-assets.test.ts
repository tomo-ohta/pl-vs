import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssetManifest } from '../client/audio/AssetManifest.ts';
import { assetUrl } from '../client/env.ts';

type Res = { ok: boolean; json?: () => Promise<unknown>; arrayBuffer?: () => Promise<ArrayBuffer> };
const json = (obj: unknown): Res => ({ ok: true, json: async () => obj });

/** fetch を差し替えて fn を回す（読んだ URL を返す） */
async function withFetch(routes: Record<string, unknown>, fn: () => Promise<void>): Promise<string[]> {
  const requested: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    requested.push(url);
    if (url in routes) return json(routes[url]);
    if (url.endsWith('.mp3')) return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    return { ok: false };
  }) as unknown as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
  return requested;
}

/** decodeAudioData だけを持つ AudioContext の代わり */
const fakeCtx = { decodeAudioData: async () => ({ duration: 0.4 }) } as unknown as BaseAudioContext;

test('既定の表の場所は素材の配信元（client/env.ts の ASSET_BASE）の audio/manifest.json', async () => {
  assert.equal(assetUrl('audio/manifest.json'), '/audio/manifest.json'); // Node では ASSET_BASE = '/'
  const m = new AssetManifest();
  const requested = await withFetch({ '/audio/manifest.json': {} }, () => m.load()); // shared/public/audio/manifest.json は空 {} で出荷
  assert.deepEqual(requested, ['/audio/manifest.json', '/audio/steps/index.json']);
  assert.deepEqual(m.keys, []);
});

test('足音の表（steps/index.json）も読み、表のファイル名は manifest.json の場所から相対で解決する', async () => {
  const m = new AssetManifest('/pl-vs/audio/manifest.json'); // 本番（VITE_ASSET_BASE=/pl-vs/）と同じ形
  const requested = await withFetch({
    '/pl-vs/audio/manifest.json': { hvac: 'loops/hvac.mp3', 'step.carpet.0': 'override.mp3', empty: '' },
    '/pl-vs/audio/steps/index.json': {
      'step.carpet.0': 'steps/step.carpet.0.mp3', // manifest.json の方が優先
      'step.carpet.1': 'steps/step.carpet.1.mp3',
      'land.wood.0': 'steps/land.wood.0.mp3',
      'move.jump.0': '/abs/move.jump.0.mp3', // / で始まるものはそのまま
    },
  }, async () => {
    await m.load();
    assert.deepEqual([...m.keys].sort(), ['hvac', 'land.wood.0', 'move.jump.0', 'step.carpet.0', 'step.carpet.1']);
    await m.decodeAll(fakeCtx);
  });
  assert.ok(requested.includes('/pl-vs/audio/loops/hvac.mp3'));
  assert.ok(requested.includes('/pl-vs/audio/override.mp3'));
  assert.ok(requested.includes('/pl-vs/audio/steps/step.carpet.1.mp3'));
  assert.ok(requested.includes('/abs/move.jump.0.mp3'));
  assert.equal(m.decodedCount, 5);
  assert.equal(m.variants('step.carpet.').length, 2);
  assert.equal(m.variants('step.carpet.'), m.variants('step.carpet.')); // デコードが進むまでは同じ配列（キャッシュ）
  assert.equal(m.variants('land.').length, 1);
  assert.ok(m.has('hvac'));
  assert.equal(m.get('nope'), undefined);
});

test('表が読めない・壊れていても投げない（合成だけになる）', async () => {
  const m = new AssetManifest('https://cdn.invalid/audio/manifest.json');
  const real = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('network'); }) as unknown as typeof fetch;
  try {
    await m.load();
  } finally {
    globalThis.fetch = real;
  }
  assert.deepEqual(m.keys, []);
  // fetch を差し替えなくても Node では相対 URL の fetch が失敗するだけ
  const n = new AssetManifest();
  await n.load();
  assert.deepEqual(n.keys, []);
});
