/**
 * 見本のフロア（段階 3 の確認用。クライアントの ?showcase=1 / 2）: 仕掛けを全種 1 つずつ置き、差し出された隠しを全部付け、
 * 残りの部屋に部屋まるごとの異変を 1 種ずつ掛けたフロア。
 * 全種が置ける世界の seed を from から順に探す（決定的。見つからなければいちばん多く置けたもの）。
 * flip: 型を選べる隠しの存在型 / 出現型を逆にする（1 と 2 で両方の型を見られる）。異変は全種が 1 つのフロアに入らないので、
 * 1 では前半・2 では後半を置く。
 * ids: 置く仕掛け・異変の id を指定する（クライアントの ?try=a,b / ?group=<担当>。段階 4 で種類が増えたので、全種ではなく選んで見る）
 */
import type { Tuning } from '../../config/tuning.ts';
import '../gimmicks/index.ts';
import { gimmickDef, gimmickDefs } from '../gimmicks/types.ts';
import { anomalyDef, anomalyDefs } from '../anomaly/index.ts';
import { roomShapeByIdea, roomShapeDef } from '../rooms/index.ts';
import { generateFloorReport, type GenOptions, type GenReport } from './index.ts';

export function showcaseFloor(t: Tuning, opts: { flip?: boolean; from?: number; dress?: GenOptions['dress']; ids?: string[] } = {}): GenReport {
  let all: string[], anomalies: string[];
  let rooms: string[] = [];
  if (opts.ids) {
    all = opts.ids.filter((id) => gimmickDef(id));
    anomalies = opts.ids.filter((id) => anomalyDef(id));
    // 部屋の形（core/gen/rooms）: 形の id か案の番号（?try=S08）
    rooms = opts.ids.filter((id) => roomShapeDef(id) || roomShapeByIdea(id));
  } else {
    all = gimmickDefs().map((d) => d.id);
    const ids = anomalyDefs().map((d) => d.id);
    const half = Math.ceil(ids.length / 2);
    anomalies = opts.flip ? ids.slice(half) : ids.slice(0, half);
  }
  // 仕掛けを全種置けたかを先に見て、同じなら異変の種類の多い方
  const placed = (r: GenReport): number => new Set(r.gimmicks?.gimmicks.map((g) => g.def)).size * 100 + new Set(r.anomalies.map((a) => a.def)).size;
  let best: GenReport | null = null;
  const from = opts.from ?? 1;
  for (let w = from; w < from + 24; w++) {
    const r = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: all, flip: opts.flip, anomalies, rooms }, dress: opts.dress });
    if (!best || placed(r) > placed(best)) best = r;
    if (placed(r) === all.length * 100 + anomalies.length) break;
  }
  return best!;
}
