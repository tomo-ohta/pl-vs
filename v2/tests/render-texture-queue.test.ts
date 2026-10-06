// 画像取得の並列数制限とリトライ（v1 tests/texture-queue.mjs から移植）
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ImageRequestQueue } from '../client/render/textureQueue.ts';

const load = (queue: ImageRequestQueue, url: string, priority = 0): Promise<unknown> => new Promise((resolve, reject) => queue.load(url, priority, resolve, reject));
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

// fetch / createImageBitmap を差し替えて配信元の振る舞いを作る。fetchImage は両方が関数のときだけ fetch 経路を使う
const g = globalThis as unknown as { fetch: unknown; createImageBitmap: unknown };
const realFetch = g.fetch;
const realBitmap = g.createImageBitmap;
function stubServer(handler: (url: string) => number): { peak: () => number } {
  let inFlight = 0;
  let peak = 0;
  g.createImageBitmap = async (blob: unknown) => ({ bitmap: blob });
  g.fetch = async (url: string) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      await settle();
      const status = handler(url);
      return { ok: status === 200, status, headers: { get: () => null }, blob: async () => `body:${url}` };
    } finally {
      inFlight--;
    }
  };
  return { peak: () => peak };
}
afterEach(() => { g.fetch = realFetch; g.createImageBitmap = realBitmap; });

test('並列数: 同時に走るのは maxConcurrent 件まで', async () => {
  const server = stubServer(() => 200);
  const queue = new ImageRequestQueue({ maxConcurrent: 6 });
  const urls = Array.from({ length: 40 }, (_, i) => `/tex/${i}.jpg`);
  await Promise.all(urls.map((u) => load(queue, u)));
  assert.equal(server.peak(), 6, `同時実行は 6 まで（実際 ${server.peak()}）`);
  assert.equal(queue.stats.loaded, 40, '全件が解決する');
});

test('503 は指数バックオフで読み直し、成功に転じる', async () => {
  const attempts = new Map<string, number>();
  stubServer((url) => {
    const n = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, n);
    return n < 3 ? 503 : 200;
  });
  const queue = new ImageRequestQueue({ maxConcurrent: 4, maxRetries: 3, baseDelayMs: 1 });
  const image = await load(queue, '/tex/flaky.jpg');
  assert.ok(image, '503 は成功するまで読み直す');
  assert.equal(attempts.get('/tex/flaky.jpg'), 3, '配信元が失敗しなくなるまでちょうど読み直す');
  assert.equal(queue.stats.retries, 2, '再試行の回数を数える');
  assert.equal(queue.stats.failures, 0, '回復したものは失敗に数えない');
});

test('404 は恒久的な失敗なので読み直さない', async () => {
  let calls = 0;
  stubServer(() => { calls++; return 404; });
  const queue = new ImageRequestQueue({ maxConcurrent: 4, maxRetries: 3, baseDelayMs: 1 });
  await assert.rejects(load(queue, '/tex/missing.jpg'), /404/, '404 は reject する');
  assert.equal(calls, 1, '404 は読み直さない');
  assert.equal(queue.stats.failures, 1, '失敗の数を数える');
});

test('再試行を使い切ったら失敗として返す（呼び出し側が代替の単色へ落とせる）', async () => {
  stubServer(() => 503);
  const queue = new ImageRequestQueue({ maxConcurrent: 2, maxRetries: 2, baseDelayMs: 1 });
  await assert.rejects(load(queue, '/tex/down.jpg'), /503/, '再試行を使い切ったら reject');
  assert.equal(queue.stats.retries, 2, '設定の上限まで読み直す');
});

test('優先度: 今すぐ要るもの（0）が先読み（1）を追い越す', async () => {
  stubServer(() => 200);
  const queue = new ImageRequestQueue({ maxConcurrent: 1 });
  const order: string[] = [];
  const record = (url: string) => load(queue, url, url.startsWith('/eager') ? 0 : 1).then(() => order.push(url));
  await Promise.all([record('/prefetch/a.jpg'), record('/prefetch/b.jpg'), record('/eager/c.jpg')]);
  // 先頭の 1 件は既に走り出しているので、待ち行列で追い越せるのは残りの中
  assert.equal(order[0], '/prefetch/a.jpg', '走り出していたものが先に終わる');
  assert.equal(order[1], '/eager/c.jpg', '優先度 0 は待っている先読みを追い越す');
});

test('createImageBitmap が無い環境では fallbackLoad を使う', async () => {
  g.createImageBitmap = undefined;
  const seen: string[] = [];
  const queue = new ImageRequestQueue({ maxConcurrent: 2, fallbackLoad: async (url) => { seen.push(url); return { fallback: url } as unknown as TexImageSource; } });
  const image = await load(queue, '/tex/legacy.jpg');
  assert.deepEqual(image, { fallback: '/tex/legacy.jpg' }, '代わりの読込が画像を返す');
  assert.deepEqual(seen, ['/tex/legacy.jpg'], '代わりの読込はちょうど 1 回');
});
