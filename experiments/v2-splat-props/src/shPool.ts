/** SH の計算を複数の Worker に分けて流す */
import { shCount, type ShEnv, type ShInput, type ShLight, type ShOutput, type ShParams } from './sh.ts';

interface Reply { id: number; out: ShOutput; ms: number }

export class ShPool {
  private readonly workers: Worker[] = [];
  private readonly pending = new Map<number, (r: Reply) => void>();
  private nextId = 1;
  private turn = 0;

  constructor(size = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 2))) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./sh.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<Reply>) => {
        const done = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        done?.(e.data);
      };
      this.workers.push(w);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  /** 粒を Worker の数に分けて計算し、つなげて返す */
  async run(input: ShInput, lights: ShLight[], params: ShParams, env: ShEnv | null): Promise<ShOutput & { ms: number }> {
    const n = input.n;
    const K = shCount(params.degree);
    const parts = Math.max(1, Math.min(this.workers.length, Math.ceil(n / 8000)));
    const per = Math.ceil(n / parts);
    const jobs: Promise<Reply>[] = [];
    for (let p = 0; p < parts; p++) {
      const s = p * per, e = Math.min(n, s + per);
      if (e <= s) continue;
      const part: ShInput = {
        n: e - s,
        center: input.center.slice(s * 3, e * 3),
        dir: input.dir.slice(s, e),
        base: input.base.slice(s * 3, e * 3),
        albedo: input.albedo.slice(s * 3, e * 3),
        rough: input.rough.slice(s, e),
        metal: input.metal.slice(s, e),
        mat: input.mat.slice(s, e),
        ...(input.normal ? { normal: input.normal.slice(s * 3, e * 3) } : {}),
        ...(input.lowLayer ? { lowLayer: true } : {}),
      };
      const id = this.nextId++;
      const w = this.workers[this.turn++ % this.workers.length]!;
      jobs.push(new Promise<Reply>((resolve) => this.pending.set(id, resolve)));
      const transfer: Transferable[] = [part.center.buffer, part.dir.buffer, part.base.buffer, part.albedo.buffer, part.rough.buffer, part.metal.buffer, part.mat.buffer];
      if (part.normal) transfer.push(part.normal.buffer);
      w.postMessage({ id, input: part, lights, params, env }, transfer);
    }
    const replies = await Promise.all(jobs);
    const dc = new Float32Array(n * 3);
    const sh = new Float32Array(n * K * 3);
    let off = 0, glossy = 0, ms = 0;
    for (const r of replies) {
      const m = r.out.dc.length / 3;
      dc.set(r.out.dc, off * 3);
      sh.set(r.out.sh, off * K * 3);
      off += m;
      glossy += r.out.glossy;
      ms = Math.max(ms, r.ms);
    }
    return { dc, sh, degree: params.degree, glossy, ms };
  }
}
