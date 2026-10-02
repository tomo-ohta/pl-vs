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
import { generateFloorReport, type GenOptions, type GenReport } from './index.ts';

/**
 * 段階 3 までの仕掛け・異変（?showcase=1 / 2 は段階 3 の見本のまま。段階 4 の担当の物は ?try= / ?group= で見る。
 * 段階 4 で種類が増え、1 つのフロアに全種は入らない）。担当 sense が足した（統合で見直す）
 */
export const STAGE3_GIMMICKS: readonly string[] = ['sensorLights', 'lowCeiling', 'soundGuide', 'switchDoor', 'mannequin', 'beltMaze', 'crumbleFloor', 'bouncePad', 'appearPath', 'tiltRoom', 'narrowPath', 'beamNetwork', 'guideLight', 'puzzleRoom'];
export const STAGE3_ANOMALIES: readonly string[] = ['flood', 'giant', 'tiny', 'multiply', 'upsideDown', 'stack', 'dark', 'fog', 'tint', 'doors', 'lowGravity', 'ballSea', 'scatter', 'clocks'];

export function showcaseFloor(t: Tuning, opts: { flip?: boolean; from?: number; dress?: GenOptions['dress']; ids?: string[] } = {}): GenReport {
  let all: string[], anomalies: string[];
  if (opts.ids) {
    all = opts.ids.filter((id) => gimmickDef(id));
    anomalies = opts.ids.filter((id) => anomalyDef(id));
  } else {
    all = gimmickDefs().map((d) => d.id).filter((id) => STAGE3_GIMMICKS.includes(id));
    const ids = anomalyDefs().map((d) => d.id).filter((id) => STAGE3_ANOMALIES.includes(id));
    const half = Math.ceil(ids.length / 2);
    anomalies = opts.flip ? ids.slice(half) : ids.slice(0, half);
  }
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
