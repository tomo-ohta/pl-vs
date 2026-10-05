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

/** 段階 3 の見本に置く仕掛け・異変（?showcase=1 / 2） */
export const STAGE3_GIMMICKS: readonly string[] = ['sensorLights', 'lowCeiling', 'soundGuide', 'switchDoor', 'mannequin', 'beltMaze', 'crumbleFloor', 'bouncePad', 'appearPath', 'tiltRoom', 'narrowPath', 'beamNetwork', 'guideLight', 'puzzleRoom'];
export const STAGE3_ANOMALIES: readonly string[] = ['flood', 'giant', 'tiny', 'multiply', 'upsideDown', 'stack', 'dark', 'fog', 'tint', 'doors', 'lowGravity', 'ballSea', 'scatter', 'clocks'];

export function showcaseFloor(t: Tuning, opts: { flip?: boolean; from?: number; dress?: GenOptions['dress']; ids?: string[] } = {}): GenReport {
  let all: string[], anomalies: string[];
  let rooms: string[] = [];
  if (opts.ids) {
    all = opts.ids.filter((id) => gimmickDef(id));
    anomalies = opts.ids.filter((id) => anomalyDef(id));
    // 部屋の形（core/gen/rooms）: 形の id か案の番号（?try=S08）
    rooms = opts.ids.filter((id) => roomShapeDef(id) || roomShapeByIdea(id));
  } else {
    // 段階 3 の見本（仕掛け 14 種・異変 14 種）。段階 4 で増えた物は ?try / ?group で見る（全種は 1 つのフロアに入らない）
    all = gimmickDefs().map((d) => d.id).filter((id) => STAGE3_GIMMICKS.includes(id));
    const ids = anomalyDefs().map((d) => d.id).filter((id) => STAGE3_ANOMALIES.includes(id));
    const half = Math.ceil(ids.length / 2);
    anomalies = opts.flip ? ids.slice(half) : ids.slice(0, half);
  }
  // 仕掛けを全種置けたかを先に見て、同じなら異変の種類の多い方
  const placed = (r: GenReport): number => new Set(r.gimmicks?.gimmicks.map((g) => g.def)).size * 100 + new Set(r.anomalies.map((a) => a.def)).size;
  // 段階 4（carry）: 一覧の前の方（登録の順なので段階 3 の仕掛け）を途切れずに置けたフロアを先に選ぶ。
  // 段階 4 で種類が増えて全種は 1 つのフロアに入らないので、数だけで選ぶと段階 3 の仕掛けが押し出されることがある
  const lead = (r: GenReport): number => { const s = new Set(r.gimmicks?.gimmicks.map((g) => g.def)); const i = all.findIndex((id) => !s.has(id)); return i < 0 ? all.length : i; };
  let best: GenReport | null = null;
  const from = opts.from ?? 1;
  for (let w = from; w < from + 24; w++) {
    const r = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: all, flip: opts.flip, anomalies, rooms, ...(opts.ids ? { pick: true } : {}) }, dress: opts.dress });
    if (!best || lead(r) > lead(best) || (lead(r) === lead(best) && placed(r) > placed(best))) best = r;
    if (placed(r) === all.length * 100 + anomalies.length) break;
  }
  return best!;
}
