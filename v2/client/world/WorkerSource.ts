/**
 * 区域の受け取り先（core/stream/story.ts の RegionSource）: 区域を Worker で作る（region.worker.ts）。
 * get は作り終わった物を返し、まだなら Worker に頼んで null を返す（階は次の tick にまた頼む）。作った物は覚えておく（行き来で作り直さない）
 */
import type { Tuning } from '../../core/config/tuning.ts';
import { storyId, type RegionPlan } from '../../core/gen/world/plan.ts';
import type { RegionSource } from '../../core/stream/story.ts';
import type { FloorLayout } from '../../core/world/layout.ts';

interface Done { type: 'done'; key: string; layout: FloorLayout; ms: number; attempts: number; pattern: string; family: string; rarity: string; cells: number }
interface Fail { type: 'error'; key: string; message: string }

export class WorkerSource implements RegionSource {
  private readonly cache = new Map<string, FloorLayout>();
  private readonly pending = new Map<string, ((l: FloorLayout) => void)[]>();
  private readonly workers: Worker[] = [];
  private next = 0;
  private readonly max: number;
  /** 作った区域の記録（開発用） */
  log: ((msg: string) => void) | null = (m) => console.info(m);

  constructor(t: Tuning, o: { dress?: boolean; workers?: number; cache?: number } = {}) {
    this.max = o.cache ?? 24;
    const n = Math.max(1, o.workers ?? 2);
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./region.worker.ts', import.meta.url), { type: 'module' });
      w.postMessage({ type: 'init', tuning: t, dress: o.dress ?? true });
      w.onmessage = (e: MessageEvent<Done | Fail>) => this.receive(e.data);
      this.workers.push(w);
    }
  }

  private keyOf(plan: RegionPlan): string {
    return `${storyId(plan.story)}:${plan.id}`;
  }

  private receive(m: Done | Fail): void {
    const waiters = this.pending.get(m.key) ?? [];
    this.pending.delete(m.key);
    if (m.type === 'error') { console.error(`[区域] ${m.key} を作れません: ${m.message}`); return; }
    this.cache.set(m.key, m.layout);
    while (this.cache.size > this.max) this.cache.delete(this.cache.keys().next().value!);
    this.log?.(`[区域] ${m.key} ${m.rarity} ${m.family}/${m.pattern} 区画 ${m.cells} 作り直し ${m.attempts - 1} ${m.ms} ms`);
    for (const f of waiters) f(m.layout);
  }

  private request(plan: RegionPlan, then?: (l: FloorLayout) => void): void {
    const key = this.keyOf(plan);
    const list = this.pending.get(key);
    if (list) { if (then) list.push(then); return; }
    this.pending.set(key, then ? [then] : []);
    const w = this.workers[this.next++ % this.workers.length]!;
    w.postMessage({ type: 'gen', key, plan });
  }

  get(plan: RegionPlan): FloorLayout | null {
    const key = this.keyOf(plan);
    const hit = this.cache.get(key);
    if (hit) { this.cache.delete(key); this.cache.set(key, hit); return hit; }
    this.request(plan);
    return null;
  }

  /** 作り終わるのを待つ（最初の区域・向こうの階の最初の区域） */
  prefetch(plan: RegionPlan): Promise<FloorLayout> {
    const hit = this.cache.get(this.keyOf(plan));
    if (hit) return Promise.resolve(hit);
    return new Promise((res) => this.request(plan, res));
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
  }
}
