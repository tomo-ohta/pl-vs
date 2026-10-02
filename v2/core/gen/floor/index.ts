/**
 * フロアを丸ごと作る（V2-1。v2-plan.md 5 章）: (worldSeed, depth, variant) → FloorLayout。
 *
 *   ① 性質（希少度・系統・骨組みの型・大きさ）→ ② 骨組み → ③ 形（部屋・廊下・階段・扉）→ ⑥ 中身（家具）→ ⑦ 検証
 *   （④ 仕掛けと ⑤ 隠しは段階 3 で足す）
 * 検証に通らなければ、別の候補（profile の salt を変える）で作り直す。候補の並びも seed で決まるので、同じ key なら同じフロア。
 */
import { tuningVersion, type Tuning } from '../../config/tuning.ts';
import { aabbUnion, type AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import { rectsOverlap } from '../../world/footprint.ts';
import type { FloorLayout } from '../../world/layout.ts';
import type { DressRoom } from '../dress/types.ts';
import { reachOpenings } from '../reach.ts';
import { buildGeometry, GenError, type FloorGeometry } from './geometry.ts';
import { floorId, rollProfile, type FloorKey, type FloorProfile } from './profile.ts';
import { buildSkeleton } from './skeleton.ts';

export const GEN_VERSION = 'gen-1';

export interface GenOptions {
  /** 区画の中身を置く（既定: なし。core/gen/dress の dressCell を渡す） */
  dress?: (r: DressRoom) => void;
}

export interface GenReport {
  floor: FloorLayout;
  profile: FloorProfile;
  attempts: number;
  issues: string[];
  ms: number;
}

export function generateFloor(key: FloorKey, t: Tuning, opts: GenOptions = {}): FloorLayout {
  return generateFloorReport(key, t, opts).floor;
}

export function generateFloorReport(key: FloorKey, t: Tuning, opts: GenOptions = {}): GenReport {
  const t0 = Date.now();
  const tries = t['floor.genRetries'];
  let last: { floor: FloorLayout; profile: FloorProfile; issues: string[] } | null = null;
  const errors: string[] = [];
  for (let attempt = 0; attempt < tries; attempt++) {
    const profile = rollProfile(key, t, attempt);
    const rng = new Rng(profile.seed);
    let geo: FloorGeometry;
    try {
      const sk = buildSkeleton(profile, rng.fork('skeleton'), t);
      geo = buildGeometry(profile, sk, rng.fork('geometry'), t);
    } catch (e) {
      if (e instanceof GenError) { errors.push(`#${attempt}: ${e.message}`); continue; }
      throw e;
    }
    if (opts.dress) {
      for (const g of geo.cells) {
        opts.dress({ cell: g.cell, kind: g.kind, openings: g.openings, keepOut: [], rng: new Rng(hashAll(profile.seed, 'dress', g.cell.id)), density: 0.5 });
      }
    }
    const floor = assemble(key, profile, geo, t);
    const issues = validateFloor(floor, geo);
    if (!issues.length) return { floor, profile, attempts: attempt + 1, issues: errors, ms: Date.now() - t0 };
    errors.push(...issues.map((s) => `#${attempt}: ${s}`));
    last = { floor, profile, issues };
  }
  if (!last) throw new Error(`フロアを作れませんでした（${floorId(key)}）: ${errors.join(' / ')}`);
  return { floor: last.floor, profile: last.profile, attempts: tries, issues: errors, ms: Date.now() - t0 };
}

function assemble(key: FloorKey, profile: FloorProfile, geo: FloorGeometry, t: Tuning): FloorLayout {
  const cells = geo.cells.map((g) => g.cell);
  const bounds: AABB = cells.map((c) => c.bounds).reduce((a, b) => aabbUnion(a, b));
  return {
    id: floorId(key),
    seed: profile.seed,
    genVersion: GEN_VERSION,
    tuningVersion: tuningVersion(t),
    bounds: { min: [bounds.min[0], bounds.min[1] - 2, bounds.min[2]], max: bounds.max },
    cells,
    portals: geo.portals,
    entities: geo.entities,
    surfaces: [],
    spawn: geo.spawn,
    exits: geo.exits,
    fog: { color: cells.find((c) => c.id === geo.spawn.cell)?.palette.fog ?? 0x0b0d14, near: 8, far: 46 },
  };
}

/** 検証。問題の一覧（空なら合格） */
export function validateFloor(floor: FloorLayout, geo?: FloorGeometry): string[] {
  const issues: string[] = [];
  // 区画の足跡が重ならない（接しているのはよい）。高さが違えば重なってよい（上下の階）
  for (let i = 0; i < floor.cells.length; i++) {
    for (let j = i + 1; j < floor.cells.length; j++) {
      const a = floor.cells[i]!, b = floor.cells[j]!;
      if (a.bounds.max[1] <= b.bounds.min[1] + 0.05 || b.bounds.max[1] <= a.bounds.min[1] + 0.05) continue;
      if (a.footprint.some((ra) => b.footprint.some((rb) => rectsOverlap(ra, rb, 0.05)))) issues.push(`区画が重なっています: ${a.id} / ${b.id}`);
    }
  }
  // 開口をたどって全部の区画へ行ける
  const adj = new Map<string, string[]>();
  for (const c of floor.cells) adj.set(c.id, []);
  for (const p of floor.portals) { adj.get(p.cells[0])?.push(p.cells[1]); adj.get(p.cells[1])?.push(p.cells[0]); }
  const seen = new Set<string>([floor.spawn.cell]);
  const q = [floor.spawn.cell];
  for (let h = 0; h < q.length; h++) for (const m of adj.get(q[h]!) ?? []) if (!seen.has(m)) { seen.add(m); q.push(m); }
  for (const c of floor.cells) if (!seen.has(c.id) && c.role !== 'secret') issues.push(`入口から行けない区画: ${c.id}`);
  if (!floor.exits.length) issues.push('出口がありません');
  // 区画の中で開口どうしが歩いてつながる
  if (geo) {
    for (const g of geo.cells) {
      if (g.openings.length < 2) continue;
      // 開口の奥行きの向きに 2.4 m 未満の小さな区画（廊下の切れ端・曲がり角）は、開口の前が区画からはみ出すので見ない（中身も置かない）
      const b = g.cell.bounds;
      if (g.openings.some((o) => (o.dir === 1 || o.dir === 3 ? b.max[0] - b.min[0] : b.max[2] - b.min[2]) < 2.4)) continue;
      const r = reachOpenings(g.cell, g.openings, 0.1);
      if (r && r.blocked.length) issues.push(`区画 ${g.cell.id} の中で届かない開口: ${r.blocked.join(', ')}`);
    }
  }
  // 出てくる位置が箱に埋まっていない
  const sp = floor.spawn.pos;
  for (const c of floor.cells) for (const b of c.boxes) {
    if (!b.solid) continue;
    if (sp[0] > b.min[0] - 0.3 && sp[0] < b.max[0] + 0.3 && sp[2] > b.min[2] - 0.3 && sp[2] < b.max[2] + 0.3 && sp[1] + 0.5 > b.min[1] && sp[1] + 0.5 < b.max[1]) {
      issues.push(`出てくる位置が箱に埋まっています: ${c.id}`);
      break;
    }
  }
  return issues;
}
