/**
 * 区域を作る Worker（docs/endless-world.md 5.2）: 区域の計画を受け取り、区域を作って id を付け替えた layout を返す。
 * 生成（core/gen）は純粋な処理なので、そのまま Worker で動く。画面の 1 フレームを止めずに区域を作るため
 */
import type { Tuning } from '../../core/config/tuning.ts';
import { dressCell } from '../../core/gen/dress/index.ts';
import { namespaceLayout } from '../../core/gen/world/namespace.ts';
import type { RegionPlan } from '../../core/gen/world/plan.ts';
import { generateRegionReport } from '../../core/gen/world/region.ts';

let tuning: Tuning | null = null;
let dress = true;

interface GenMsg { type: 'gen'; key: string; plan: RegionPlan }
interface InitMsg { type: 'init'; tuning: Tuning; dress: boolean }

self.onmessage = (e: MessageEvent<GenMsg | InitMsg>): void => {
  const m = e.data;
  if (m.type === 'init') { tuning = m.tuning; dress = m.dress; return; }
  if (!tuning) { postMessage({ type: 'error', key: m.key, message: '調整表を受け取っていません' }); return; }
  try {
    const r = generateRegionReport(m.plan, tuning, dress ? { dress: dressCell } : {});
    const layout = namespaceLayout(r.floor, m.plan.id);
    postMessage({ type: 'done', key: m.key, layout, ms: r.ms, attempts: r.attempts, pattern: r.profile.pattern, family: r.profile.family.name, rarity: r.profile.rarity, cells: r.floor.cells.length });
  } catch (err) {
    postMessage({ type: 'error', key: m.key, message: String(err) });
  }
};
