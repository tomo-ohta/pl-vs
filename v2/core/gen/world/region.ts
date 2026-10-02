/**
 * 果てしない階の区域を作る（docs/endless-world.md 4 章）: 区域の計画（plan.ts）→ FloorLayout（区域の情報 region 付き）。
 *
 * - 街区（district）: 今のフロアの型（格子の組み立て geometry.ts）を、区域の矩形の縁の帯の内側に収まる列・行で作る。
 *   入口・出口の階段の代わりに、境目の扉までの廊下と階段室（ports.ts）。町の系統を world.wardCoherence の確率で使う
 * - 寄せ集め（patchwork）: 区域の矩形を部屋に切り分け、部屋ごとに全部の系統のテーマから引く（shapes/patchwork.ts）
 * どちらも、仕掛け・隠し・異変・部屋の形・家具・地図の看板・検証はフロアと同じ段の並び（floor/index.ts の runPipeline）。
 * 裏の階の区域は、表の区域（同じ計画の variant 0）の性質と形を使い、中身と調子を変える（フロアと同じ）。
 */
import type { Tuning } from '../../config/tuning.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import { runPipeline, type GenOptions, type GenReport } from '../floor/index.ts';
import { rollProfile, type FloorKey, type FloorProfile, type RegionContext } from '../floor/profile.ts';
import { familyById, type PatternId } from '../floor/themes.ts';
import { storyId, type RegionPlan } from './plan.ts';

/** 区域に置けない型（駅は区域の計画で決める・形を丸ごと作る型は入口と出口の階段で作る） */
const NOT_IN_REGION: ReadonlySet<PatternId> = new Set<PatternId>(['station', 'spiral', 'shrink', 'rooftop', 'patchwork']);
/** 出口へ向かうこと自体が見どころの型（下りの階段室のある区域だけ） */
const NEEDS_DOWN: ReadonlySet<PatternId> = new Set<PatternId>(['descent', 'tower', 'elevator', 'shaft']);
/** 区域が広ければ、列・行を増やして埋める型 */
const GROWS: ReadonlySet<PatternId> = new Set<PatternId>(['grid', 'maze', 'comb', 'chain', 'arcade', 'staff']);

const snap = (v: number): number => Math.round(v * 20) / 20;

/** 区域の情報（生成の性質に入れる） */
export function regionContext(plan: RegionPlan, t: Tuning): RegionContext {
  return {
    id: plan.id, kind: plan.kind, rect: { ...plan.rect }, margin: t['world.marginM'], slotM: t['world.slotM'],
    gates: plan.gates.map((g) => ({ id: g.id, side: g.side, line: g.line, at: g.at })),
    airlocks: plan.airlocks.map((a) => ({ id: a.id, role: a.role, slot: [a.slot[0], a.slot[1]], to: a.to ? storyId(a.to) : null })),
    landings: (plan.landings ?? []).map((l) => ({ id: l.id, slot: [l.slot[0], l.slot[1]] })),
  };
}

/** 区域の性質（作り直しの回数 salt ごと） */
export function rollRegionProfile(plan: RegionPlan, t: Tuning, salt: number): FloorProfile {
  const key: FloorKey = { ...plan.story, variant: 0 };
  const region = regionContext(plan, t);
  const m = region.margin;
  const inner = { x0: plan.rect.x0 + m, x1: plan.rect.x1 - m, z0: plan.rect.z0 + m, z1: plan.rect.z1 - m };
  const W = inner.x1 - inner.x0, D = inner.z1 - inner.z0;
  const ward = familyById(plan.ward);
  const useWard = new Rng(hashAll(plan.seed, 'ward', salt)).chance(t['world.wardCoherence']);
  const hasDown = plan.airlocks.some((a) => a.role === 'down');
  const base = { family: useWard ? ward : undefined, noStation: true } as const;
  if (plan.kind === 'patchwork') {
    const p = rollProfile(key, t, salt, undefined, base, plan.seed);
    return { ...p, id: plan.id, pattern: 'patchwork', cols: 1, rows: 1, origin: [snap((inner.x0 + inner.x1) / 2), inner.z1], region };
  }
  for (let k = 0; k < 12; k++) {
    const p = rollProfile(key, t, salt * 16 + k, undefined, { ...base, allow: (pt) => !NOT_IN_REGION.has(pt) && (hasDown || !NEEDS_DOWN.has(pt)) }, plan.seed);
    const maxC = Math.floor(W / p.spacing), maxR = Math.floor(D / p.spacing);
    if (GROWS.has(p.pattern) && (maxC > p.cols || maxR > p.rows)) {
      const r = new Rng(hashAll(plan.seed, 'grow', salt, k));
      p.cols = r.int(p.cols, Math.max(p.cols, Math.min(maxC, 9)));
      p.rows = r.int(p.rows, Math.max(p.rows, Math.min(maxR, 9)));
    }
    if (p.cols > maxC || p.rows > maxR) continue;
    // 格子を内側の矩形の真ん中に（行は -Z へ伸びる。原点 z は格子の +Z の辺）
    const oz = snap(inner.z1 - (D - p.rows * p.spacing) / 2);
    return { ...p, id: plan.id, origin: [snap((inner.x0 + inner.x1) / 2), oz], region };
  }
  // どの型も収まらない（狭い区域に広い型ばかり引いた）: 格子 3 × 3
  const p = rollProfile(key, t, salt, 'grid', base, plan.seed);
  p.cols = Math.min(3, Math.floor(W / p.spacing)); p.rows = Math.min(3, Math.floor(D / p.spacing));
  return { ...p, id: plan.id, origin: [snap((inner.x0 + inner.x1) / 2), snap(inner.z1 - (D - p.rows * p.spacing) / 2)], region };
}

/** 区域を作る */
export function generateRegionReport(plan: RegionPlan, t: Tuning, opts: GenOptions = {}): GenReport {
  const key: FloorKey = plan.story;
  const front = key.variant > 0 ? generateRegionReport({ ...plan, story: { ...key, variant: 0 } }, t, { ...(opts.dress ? { dress: opts.dress } : {}), ...(opts.noGimmicks ? { noGimmicks: true } : {}) }) : null;
  const r = runPipeline({
    key, id: plan.id, seedBase: hashAll(plan.seed, 'variant', key.variant), front,
    roll: (attempt) => (front ? { ...rollRegionProfile(plan, t, front.attempts - 1), key, id: plan.id } : rollRegionProfile(plan, t, attempt)),
  }, t, opts);
  // 図鑑に使う中身（区域の layout と一緒に、作業の糸から描く側へ渡る）
  if (r.floor.region) {
    r.floor.region.contents = {
      gimmicks: (r.gimmicks?.gimmicks ?? []).map((g) => [g.cell, g.def]),
      anomalies: r.anomalies.map((a) => [a.cell, a.def, a.name]),
      secrets: (r.gimmicks?.secrets ?? []).map((x) => ({ id: x.id, host: x.host, hook: x.hook, dest: x.dest, ...(x.rare ? { rare: x.rare } : {}), cells: x.cells.slice() })),
    };
  }
  return r;
}
