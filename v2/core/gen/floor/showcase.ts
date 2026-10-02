/**
 * 見本のフロア（段階 3 の確認用。クライアントの ?showcase=1 / 2）: 仕掛けを全種 1 つずつ置き、差し出された隠しを全部付けたフロア。
 * 全種が置ける世界の seed を from から順に探す（決定的。見つからなければいちばん多く置けたもの）。
 * flip: 型を選べる隠しの存在型 / 出現型を逆にする（1 と 2 で両方の型を見られる）
 */
import type { Tuning } from '../../config/tuning.ts';
import '../gimmicks/index.ts';
import { gimmickDefs } from '../gimmicks/types.ts';
import { generateFloorReport, type GenOptions, type GenReport } from './index.ts';

export function showcaseFloor(t: Tuning, opts: { flip?: boolean; from?: number; dress?: GenOptions['dress'] } = {}): GenReport {
  const all = gimmickDefs().map((d) => d.id);
  const placed = (r: GenReport): number => new Set(r.gimmicks?.gimmicks.map((g) => g.def)).size;
  let best: GenReport | null = null;
  const from = opts.from ?? 1;
  for (let w = from; w < from + 24; w++) {
    const r = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: all, flip: opts.flip }, dress: opts.dress });
    if (!best || placed(r) > placed(best)) best = r;
    if (placed(r) === all.length) break;
  }
  return best!;
}
