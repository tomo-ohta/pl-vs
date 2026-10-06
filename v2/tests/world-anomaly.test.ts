// v1 風の寄せ集めの区域（部屋ごとに雰囲気と大きさが違う）でも、v2 の異変が出る（docs/endless-world.md 7 章）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning, type TuningOverrides } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { anomalyDefs } from '../core/gen/anomaly/index.ts';
import { planRegion, type RegionPlan } from '../core/gen/world/plan.ts';
import { generateRegionReport } from '../core/gen/world/region.ts';

test('異変 57 種がどれも、寄せ集めの区域の部屋に掛かる（掛けたあと開口どうしが歩いてつながる）', () => {
  const base = defaultTuning();
  // 珍しい区域にだけ出る異変も出られる深さ。出にくい異変（横倒しの部屋など、開口の無い長い壁が要る物）は 30 区域に数回なので、32 区域まで
  const plans: RegionPlan[] = [];
  for (let w = 1; plans.length < 32; w++) plans.push({ ...planRegion({ world: 700 + w, depth: 22, variant: 0 }, 0, 0, base), kind: 'patchwork' });
  const missing: string[] = [];
  let placed = 0;
  for (const d of anomalyDefs()) {
    const { tuning } = makeTuning({ [`anomaly.w.${d.id}`]: 5000, 'anomaly.share.main': 0.9, 'anomaly.share.side': 0.9 } as TuningOverrides);
    let hit = 0;
    for (const p of plans) {
      const r = generateRegionReport(p, tuning, { dress: dressCell });
      assert.equal(r.profile.pattern, 'patchwork');
      hit += r.anomalies.filter((a) => a.def === d.id).length;
      if (hit) break;
    }
    if (!hit) missing.push(d.id);
    placed += hit;
  }
  assert.deepEqual(missing, [], '寄せ集めの部屋に掛からない異変');
  assert.ok(placed >= anomalyDefs().length);
});
