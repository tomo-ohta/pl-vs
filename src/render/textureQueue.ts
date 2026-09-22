/**
 * 画像取得の並列数制限とリトライ（担当: 公開時の 503 対策）
 *
 * 背景: 起動時に CC0 セットの先頭候補（材質 ID ごとに 1 セット）を一斉に読むと、テクスチャ 160 枚前後の
 * リクエストがほぼ同時に飛ぶ。GitHub Pages のような配信元はこのバーストをレート制限し、数件が 503 を返す。
 * three の ImageBitmapLoader / TextureLoader は HTTP ステータスを表に出さないので、ここで fetch を直接使い、
 * 再試行できる失敗（5xx・429・通信エラー）だけを指数バックオフで読み直す。
 *
 * - 同時に走らせるのは maxConcurrent 件まで。残りは待ち行列（優先度 0 が先、同じ優先度なら投入順）
 * - リトライは maxRetries 回まで。待ち時間は baseDelayMs × 2^n にジッタを足す（Retry-After があればそれを優先）
 * - createImageBitmap / fetch が無い環境（Node のテスト・古いブラウザ）では fallbackLoad を使う
 */

/** 再試行する価値のある HTTP ステータス（一時的な過負荷・レート制限・タイムアウト） */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** 待ち時間の上限（ms）。これ以上待たせると起動が目に見えて遅くなる */
const MAX_DELAY_MS = 8000;

class HttpStatusError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  constructor(status: number, retryAfterMs: number | null) {
    super(`HTTP ${status}`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Retry-After（秒数、または HTTP 日付）を ms に。解釈できなければ null */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

interface Task {
  url: string;
  priority: number;
  /** 投入順（同じ優先度の中での順序を保つ） */
  seq: number;
  resolve: (image: TexImageSource) => void;
  reject: (err: unknown) => void;
}

export interface ImageRequestQueueOptions {
  /** 同時に走らせる最大数 */
  maxConcurrent?: number;
  /** 1 枚あたりの再試行回数（初回は含まない） */
  maxRetries?: number;
  /** 指数バックオフの基準待ち時間（ms） */
  baseDelayMs?: number;
  /** createImageBitmap / fetch が使えないときの読込（three の TextureLoader 経由） */
  fallbackLoad?: (url: string) => Promise<TexImageSource>;
  /** false なら createImageBitmap を使わず fallbackLoad だけで読む（計測用スイッチ）。既定 true */
  useBitmap?: boolean;
}

export class ImageRequestQueue {
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly fallbackLoad: ((url: string) => Promise<TexImageSource>) | null;
  private readonly useBitmap: boolean;
  private readonly waiting: Task[] = [];
  /** 走っている分の優先度（idle の判定に使う） */
  private readonly runningPriorities: number[] = [];
  /** idle() の待ち合わせ */
  private readonly idleWaiters: { maxPriority: number; resolve: () => void }[] = [];
  private running = 0;
  private seq = 0;
  /** 計測用: 再試行した回数と、再試行しても駄目だった数 */
  readonly stats = { retries: 0, failures: 0, loaded: 0 };

  constructor(options: ImageRequestQueueOptions = {}) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 6);
    this.maxRetries = Math.max(0, options.maxRetries ?? 3);
    this.baseDelayMs = Math.max(1, options.baseDelayMs ?? 300);
    this.fallbackLoad = options.fallbackLoad ?? null;
    this.useBitmap = options.useBitmap ?? true;
  }

  /** 待ち行列に残っている数と、走っている数 */
  get status(): { waiting: number; running: number } { return { waiting: this.waiting.length, running: this.running }; }

  /**
   * 優先度 maxPriority 以下の読込が全て終わるまで待つ。
   * 「今の画面に要るテクスチャ（優先度 0）が揃うまで待ち、先読み（優先度 1）は待たない」ために使う。
   */
  idle(maxPriority = Number.POSITIVE_INFINITY): Promise<void> {
    if (!this.hasWork(maxPriority)) return Promise.resolve();
    return new Promise<void>((resolve) => { this.idleWaiters.push({ maxPriority, resolve }); });
  }

  private hasWork(maxPriority: number): boolean {
    for (const t of this.waiting) if (t.priority <= maxPriority) return true;
    for (const p of this.runningPriorities) if (p <= maxPriority) return true;
    return false;
  }

  private notifyIdle(): void {
    for (let i = this.idleWaiters.length - 1; i >= 0; i--) {
      const w = this.idleWaiters[i];
      if (this.hasWork(w.maxPriority)) continue;
      this.idleWaiters.splice(i, 1);
      w.resolve();
    }
  }

  /** 読込を予約する。priority が小さいものから走る（0: 今すぐ要る、1: 先読み） */
  load(url: string, priority: number, onLoad: (image: TexImageSource) => void, onError: (err: unknown) => void): void {
    this.waiting.push({ url, priority, seq: this.seq++, resolve: onLoad, reject: onError });
    this.pump();
  }

  private pump(): void {
    while (this.running < this.maxConcurrent && this.waiting.length) {
      // 優先度（小さい順）→ 投入順。件数は高々数百なので毎回の線形探索で足りる
      let best = 0;
      for (let i = 1; i < this.waiting.length; i++) {
        const a = this.waiting[i], b = this.waiting[best];
        if (a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq)) best = i;
      }
      const task = this.waiting.splice(best, 1)[0];
      this.running++;
      this.runningPriorities.push(task.priority);
      this.run(task).finally(() => {
        this.running--;
        const at = this.runningPriorities.indexOf(task.priority);
        if (at >= 0) this.runningPriorities.splice(at, 1);
        this.pump();
        this.notifyIdle();
      });
    }
  }

  private async run(task: Task): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const image = await this.fetchImage(task.url);
        this.stats.loaded++;
        task.resolve(image);
        return;
      } catch (err) {
        lastError = err;
        if (attempt === this.maxRetries || !isRetryable(err)) break;
        this.stats.retries++;
        await sleep(this.delayFor(attempt, err));
      }
    }
    this.stats.failures++;
    task.reject(lastError);
  }

  /** n 回目の再試行までの待ち時間。Retry-After があればそれに従う */
  private delayFor(attempt: number, err: unknown): number {
    const after = err instanceof HttpStatusError ? err.retryAfterMs : null;
    if (after !== null) return Math.min(after, MAX_DELAY_MS);
    const backoff = this.baseDelayMs * Math.pow(2, attempt);
    // ジッタ: 同時に落ちた分が再び揃って飛ばないように 0.5〜1.5 倍へ散らす
    return Math.min(backoff * (0.5 + Math.random()), MAX_DELAY_MS);
  }

  private async fetchImage(url: string): Promise<TexImageSource> {
    if (!this.useBitmap || typeof fetch !== 'function' || typeof createImageBitmap !== 'function') {
      if (!this.fallbackLoad) throw new Error('no image loader available');
      return this.fallbackLoad(url);
    }
    const res = await fetch(url);
    if (!res.ok) throw new HttpStatusError(res.status, parseRetryAfter(res.headers.get('retry-after')));
    const blob = await res.blob();
    // three の TextureLoader（flipY = true）と同じ向きに揃える（three は ImageBitmap の flipY を無視する）
    return createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  }
}

/** 一時的な失敗か（5xx・429 などのステータス、または通信エラー）。404 のような恒久的な失敗は再試行しない */
function isRetryable(err: unknown): boolean {
  if (err instanceof HttpStatusError) return RETRYABLE_STATUS.has(err.status);
  // fetch が投げるのは通信断・CORS・中断。中断以外は読み直す価値がある
  if (err instanceof Error && err.name === 'AbortError') return false;
  return true;
}
