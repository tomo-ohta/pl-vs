// SH の計算を別スレッドで（ゲームの描画を止めない）
// （lib "webworker" を参照すると、ページ側の addEventListener の型まで変わるので使わない）
import { computeSh, type ShEnv, type ShInput, type ShLight, type ShParams } from './sh.ts';

interface Job { id: number; input: ShInput; lights: ShLight[]; params: ShParams; env: ShEnv | null }
interface WorkerScope { onmessage: ((e: MessageEvent<Job>) => void) | null; postMessage(data: unknown, transfer: Transferable[]): void }

const scope = self as unknown as WorkerScope;
scope.onmessage = (e) => {
  const { id, input, lights, params, env } = e.data;
  const t0 = performance.now();
  const out = computeSh(input, lights, params, env);
  scope.postMessage({ id, out, ms: performance.now() - t0 }, [out.dc.buffer, out.sh.buffer]);
};
