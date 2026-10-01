import assert from 'node:assert/strict';
import { ImageRequestQueue } from '../src/render/textureQueue.ts';

const load = (queue, url, priority = 0) => new Promise((resolve, reject) => queue.load(url, priority, resolve, reject));
const settle = () => new Promise((resolve) => setImmediate(resolve));

// fetch / createImageBitmap を差し替えて配信元の振る舞いを作る。fetchImage は両方が関数のときだけ fetch 経路を使う
const realFetch = globalThis.fetch, realBitmap = globalThis.createImageBitmap;
function stubServer(handler) {
  let inFlight = 0, peak = 0;
  globalThis.createImageBitmap = async (blob) => ({ bitmap: blob });
  globalThis.fetch = async (url) => {
    inFlight++; peak = Math.max(peak, inFlight);
    try {
      await settle();
      const status = handler(url);
      return {
        ok: status === 200,
        status,
        headers: { get: () => null },
        blob: async () => `body:${url}`,
      };
    } finally { inFlight--; }
  };
  return { peak: () => peak };
}
function restore() { globalThis.fetch = realFetch; globalThis.createImageBitmap = realBitmap; }

try {
  // 並列数: 同時に走るのは maxConcurrent 件まで
  {
    const server = stubServer(() => 200);
    const queue = new ImageRequestQueue({ maxConcurrent: 6 });
    const urls = Array.from({ length: 40 }, (_, i) => `/tex/${i}.jpg`);
    await Promise.all(urls.map((u) => load(queue, u)));
    assert.equal(server.peak(), 6, `Concurrency must be capped at 6, saw ${server.peak()}`);
    assert.equal(queue.stats.loaded, 40, 'Every request must resolve');
  }

  // 503 は指数バックオフで読み直し、成功に転じる
  {
    const attempts = new Map();
    stubServer((url) => {
      const n = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, n);
      return n < 3 ? 503 : 200;
    });
    const queue = new ImageRequestQueue({ maxConcurrent: 4, maxRetries: 3, baseDelayMs: 1 });
    const image = await load(queue, '/tex/flaky.jpg');
    assert.ok(image, '503 must be retried until it succeeds');
    assert.equal(attempts.get('/tex/flaky.jpg'), 3, 'Must retry exactly until the server stops failing');
    assert.equal(queue.stats.retries, 2, 'Retry count must be reported');
    assert.equal(queue.stats.failures, 0, 'A recovered request is not a failure');
  }

  // 404 は恒久的な失敗なので読み直さない
  {
    let calls = 0;
    stubServer(() => { calls++; return 404; });
    const queue = new ImageRequestQueue({ maxConcurrent: 4, maxRetries: 3, baseDelayMs: 1 });
    await assert.rejects(load(queue, '/tex/missing.jpg'), /404/, 'A 404 must reject');
    assert.equal(calls, 1, 'A 404 must not be retried');
    assert.equal(queue.stats.failures, 1, 'Failure count must be reported');
  }

  // 再試行を使い切ったら失敗として返す（呼び出し側が代替の単色へ落とせる）
  {
    stubServer(() => 503);
    const queue = new ImageRequestQueue({ maxConcurrent: 2, maxRetries: 2, baseDelayMs: 1 });
    await assert.rejects(load(queue, '/tex/down.jpg'), /503/, 'Exhausted retries must reject');
    assert.equal(queue.stats.retries, 2, 'Must retry up to the configured limit');
  }

  // 優先度: 今すぐ要るもの（0）が先読み（1）を追い越す
  {
    stubServer(() => 200);
    const queue = new ImageRequestQueue({ maxConcurrent: 1 });
    const order = [];
    const record = (url) => load(queue, url, url.startsWith('/eager') ? 0 : 1).then(() => order.push(url));
    const all = [record('/prefetch/a.jpg'), record('/prefetch/b.jpg'), record('/eager/c.jpg')];
    await Promise.all(all);
    // 先頭の 1 件は既に走り出しているので、待ち行列で追い越せるのは残りの中
    assert.equal(order[0], '/prefetch/a.jpg', 'The already-running request finishes first');
    assert.equal(order[1], '/eager/c.jpg', 'A priority-0 request must jump ahead of queued prefetches');
  }

  // createImageBitmap が無い環境では fallbackLoad を使う
  {
    restore();
    globalThis.createImageBitmap = undefined;
    const seen = [];
    const queue = new ImageRequestQueue({ maxConcurrent: 2, fallbackLoad: async (url) => { seen.push(url); return { fallback: url }; } });
    const image = await load(queue, '/tex/legacy.jpg');
    assert.deepEqual(image, { fallback: '/tex/legacy.jpg' }, 'Fallback loader must supply the image');
    assert.deepEqual(seen, ['/tex/legacy.jpg'], 'Fallback loader must be called exactly once');
  }

  console.log('texture-queue: ok');
} finally {
  restore();
}
