/**
 * 見本のフロア（段階 3 の確認用。クライアントの ?showcase=1 / 2）: 仕掛けを全種 1 つずつ置き、差し出された隠しを全部付け、
 * 残りの部屋に部屋まるごとの異変を 1 種ずつ掛けたフロア。
 * 全種が置ける世界の seed を from から順に探す（決定的。見つからなければいちばん多く置けたもの）。
 * flip: 型を選べる隠しの存在型 / 出現型を逆にする（1 と 2 で両方の型を見られる）。異変は全種が 1 つのフロアに入らないので、
 * 1 では前半・2 では後半を置く
 */
import type { Tuning } from '../../config/tuning.ts';
import '../gimmicks/index.ts';
import { gimmickDefs } from '../gimmicks/types.ts';
import { anomalyDefs } from '../anomaly/index.ts';
import { generateFloorReport, type GenOptions, type GenReport } from './index.ts';

export function showcaseFloor(t: Tuning, opts: { flip?: boolean; from?: number; dress?: GenOptions['dress'] } = {}): GenReport {
  const all = gimmickDefs().map((d) => d.id);
  const ids = anomalyDefs().map((d) => d.id);
  const half = Math.ceil(ids.length / 2);
  const anomalies = opts.flip ? ids.slice(half) : ids.slice(0, half);
  // 仕掛けを全種置けたかを先に見て、同じなら異変の種類の多い方
  const placed = (r: GenReport): number => new Set(r.gimmicks?.gimmicks.map((g) => g.def)).size * 100 + new Set(r.anomalies.map((a) => a.def)).size;
  let best: GenReport | null = null;
  const from = opts.from ?? 1;
  for (let w = from; w < from + 24; w++) {
    const r = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: all, flip: opts.flip, anomalies }, dress: opts.dress });
    if (!best || placed(r) > placed(best)) best = r;
    if (placed(r) === all.length * 100 + anomalies.length) break;
  }
  return best!;
}
