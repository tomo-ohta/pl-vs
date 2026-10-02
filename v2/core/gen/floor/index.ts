/**
 * フロアを丸ごと作る（V2-1。v2-plan.md 5 章）: (worldSeed, depth, variant) → FloorLayout。
 *
 *   ① 性質（希少度・系統・骨組みの型・大きさ）→ ② 骨組み → ③ 形（部屋・廊下・階段・扉）→ ④ 仕掛け → ⑤ 隠し →
 *   ⑥ 中身（家具。仕掛けの場所は空ける）→ ⑦ 検証
 * 検証に通らなければ、別の候補（profile の salt を変える）で作り直す。候補の並びも seed で決まるので、同じ key なら同じフロア。
 *
 * 裏のフロア（variant ≥ 1）: 表のフロア（同じ深さの variant 0）と同じ形を作る（表が合格した性質と形の作り直しの回数を使う）。
 * 仕掛け・隠し・中身は裏の seed で置き、だめなら置き直す（形は変えない）。見た目は bside.ts の調子で変える
 */
import { tuningVersion, type Tuning } from '../../config/tuning.ts';
import { aabbUnion, type AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import { rectsOverlap } from '../../world/footprint.ts';
import type { FloorLayout } from '../../world/layout.ts';
import type { DressRoom } from '../dress/types.ts';
import { planAnomalies, type AnomalyShowcase, type PlacedAnomaly } from '../anomaly/index.ts';
import { reachOpenings } from '../reach.ts';
import { applyBSide } from './bside.ts';
import { buildGeometry, GenError, type FloorGeometry } from './geometry.ts';
import { placeGimmicks, type GimmickResult, type ShowcaseOptions } from './gimmicks.ts';
import { floorId, floorSeed, rollProfile, type FloorKey, type FloorProfile } from './profile.ts';
import { familyById, type PatternId } from './themes.ts';
import { buildSkeleton } from './skeleton.ts';
import { placeMapSigns } from '../gimmicks/map/signs.ts';
import { shapeRooms } from '../rooms/index.ts';
import { liftArrival } from './arrival.ts';

export const GEN_VERSION = 'gen-1';

export interface GenOptions {
  /** 区画の中身を置く（既定: なし。core/gen/dress の dressCell を渡す） */
  dress?: (r: DressRoom) => void;
  /** 仕掛けと隠しを置かない（段階 2 の確認用） */
  noGimmicks?: boolean;
  /** 見本のフロア（確認用）: 仕掛けを 1 つずつ置き、隠しを全部付ける。系統・型・大きさも見本用に決める */
  showcase?: ShowcaseOptions & Partial<AnomalyShowcase>;
  /** フロアの形の型を決めて作る（確認用。クライアントの ?shape=。段階 4 のフロアの形の担当） */
  shape?: PatternId;
  /** 着き方（'lift': エレベーターで着いた。入口の階段の手前をかごにして、かごの中から始める。arrival.ts） */
  arrival?: 'lift';
}

export interface GenReport {
  floor: FloorLayout;
  profile: FloorProfile;
  gimmicks: GimmickResult | null;
  /** 部屋まるごとの異変（core/gen/anomaly） */
  anomalies: PlacedAnomaly[];
  attempts: number;
  /** 合格した形の作り直しの回数（同じ性質のまま。裏のフロアが表と同じ形を作るのに使う） */
  geoTry: number;
  /** 裏のフロアの調子（bside.ts の BSIDE_TONES の id） */
  tone?: string;
  issues: string[];
  ms: number;
}

export function generateFloor(key: FloorKey, t: Tuning, opts: GenOptions = {}): FloorLayout {
  return generateFloorReport(key, t, opts).floor;
}

export function generateFloorReport(key: FloorKey, t: Tuning, opts: GenOptions = {}): GenReport {
  const r = generateFloorReportInner(key, t, opts);
  if (opts.arrival === 'lift') liftArrival(r.floor);
  return r;
}

function generateFloorReportInner(key: FloorKey, t: Tuning, opts: GenOptions): GenReport {
  // 裏のフロア: 表のフロアが合格した性質と形を使う（表を一度作って確かめる。裏へ入るときだけなので軽い）
  const front = key.variant > 0 && !opts.showcase ? generateFloorReport({ ...key, variant: 0 }, t, { dress: opts.dress, noGimmicks: opts.noGimmicks, ...(opts.shape ? { shape: opts.shape } : {}) }) : null;
  return runPipeline({
    key, id: floorId(key), seedBase: floorSeed(key), front,
    roll: (attempt) => (front ? { ...rollProfile({ ...key, variant: 0 }, t, front.attempts - 1, opts.shape), key, id: floorId(key) } : rollProfile(key, t, attempt, opts.shape)),
  }, t, opts);
}

/** 生成の段の並びに渡すもの（フロアと、果てしない階の区域 core/gen/world/region.ts で共通） */
export interface PipelineMode {
  key: FloorKey;
  /** フロア・区域の id */
  id: string;
  /** 裏の中身・調子の seed の元 */
  seedBase: number;
  /** 裏のとき、表の結果（同じ性質と形を作る） */
  front: GenReport | null;
  /** 作り直しの回数 attempt の性質 */
  roll(attempt: number): FloorProfile;
}

export function runPipeline(mode: PipelineMode, t: Tuning, opts: GenOptions): GenReport {
  const t0 = Date.now();
  const tries = t['floor.genRetries'];
  const { key, front } = mode;
  let last: Omit<GenReport, 'attempts' | 'issues' | 'ms'> | null = null;
  const errors: string[] = [];
  for (let attempt = 0; attempt < tries; attempt++) {
    const profile = mode.roll(attempt);
    if (opts.showcase) {
      // 見本: 天井の高い系統（弾む床が置けるように）・格子・広め
      // 仕掛け 13 種 + 異変の部屋が入るように 6×6
      Object.assign(profile, { family: { ...familyById('library'), hallChance: 0.3, levelChance: 0, doorChance: 0.4 }, pattern: 'grid', cols: 6, rows: 6, spacing: 15, rarity: 'Rare' });
    }
    const rng = new Rng(profile.seed);
    // 形がうまく行かない（階段が収まらない・区画が近すぎる）ときは、性質と骨組みはそのままで形だけ作り直す（系統の出方を偏らせない）
    let geo: FloorGeometry | null = null;
    let geoTry = front ? front.geoTry : 0;
    const sk = buildSkeleton(profile, rng.fork('skeleton'), t);
    for (; geoTry < 4 && !geo; geoTry++) {
      try {
        geo = buildGeometry(profile, sk, rng.fork(geoTry === 0 ? 'geometry' : `geometry${geoTry}`), t);
      } catch (e) {
        if (e instanceof GenError) { errors.push(`#${attempt}.${geoTry}: ${e.message}`); continue; }
        throw e;
      }
    }
    if (!geo) continue;
    geoTry--;
    // 区域: 下りの階段室が無ければ、本道の終わりは入口からいちばん遠い境目の扉の区画
    if (profile.region && !geo.mainTo && geo.region?.gates.length) geo.mainTo = farthestCell(geo, geo.region.gates.map((x) => x.cell));
    // 中身の seed: 表は性質の seed、裏は裏の seed（置き直すたびに変える）
    const content: FloorProfile = front ? { ...profile, seed: hashAll(mode.seedBase, 'content', attempt) } : profile;
    const gimmicks = opts.noGimmicks ? null : placeGimmicks(content, geo, t, key.depth, opts.showcase);
    // 部屋まるごとの異変: 残りの部屋から選び、中身を置く前の変化（pre）を掛ける
    const anomalies = opts.noGimmicks ? null : planAnomalies(content, geo, gimmicks, t, key.depth, opts.showcase?.anomalies ? { anomalies: opts.showcase.anomalies } : undefined);
    // 見て回る順（見本のフロアのワープ）に異変の部屋も入れる
    if (gimmicks && anomalies) gimmicks.tour.push(...anomalies.tour);
    // 部屋の形（core/gen/rooms。仕掛けと異変を決めた後、中身を置く前。見本のフロアでは頼んだ形だけ。裏のフロアは表と同じ形）
    if (gimmicks && anomalies) shapeRooms(content, geo, gimmicks, anomalies, t, key.depth, opts.showcase ? opts.showcase.rooms ?? [] : undefined, front?.floor);
    const dressedFrom = new Map<string, number>();
    if (opts.dress) {
      // 隠し部屋のうち、中身が決まっているもの（別のフロアへの穴・私室）と、異変が自分で埋める部屋には置かない
      const fixed = new Set(gimmicks?.secrets.flatMap((x) => x.fixed));
      for (const g of geo.cells) {
        if (fixed.has(g.cell.id) || anomalies?.noDress.has(g.cell.id) || geo.sealed?.has(g.cell.id)) continue;
        // 仕掛けが中身を置かない区画（warp の双子の区画。見た目を揃えるため仕掛けが自分で置く）
        if (gimmicks?.noDress.has(g.cell.id)) continue;
        dressedFrom.set(g.cell.id, g.cell.boxes.length);
        opts.dress({ cell: g.cell, kind: g.kind, openings: g.openings, keepOut: [...(gimmicks?.keepOut.get(g.cell.id) ?? []), ...(geo.keepOut?.get(g.cell.id) ?? [])], rng: new Rng(hashAll(content.seed, 'dress', g.cell.id)), density: 0.5 });
      }
    }
    // 異変の中身を置いた後の変化（post: 家具の変形）
    anomalies?.post(dressedFrom);
    // フロアの形の仕上げ（鏡写しの家具など。仕掛け・異変・隠しのある区画は触らない）
    geo.afterDress?.({ ...(opts.dress ? { dress: opts.dress } : {}), dressedFrom, busy: new Set([...(gimmicks?.gimmicks.map((x) => x.cell) ?? []), ...(anomalies?.placed.map((x) => x.cell) ?? []), ...(gimmicks?.secrets.flatMap((x) => [x.host, ...x.cells, ...(x.to ? [x.to] : [])]) ?? [])]) });
    // 地図の看板（入口の案内図・現在地の看板）と落ちている誰かの地図（段階 4・地図の担当。家具の後に空いている壁と床へ）
    if (gimmicks) placeMapSigns(content, geo, gimmicks, anomalies?.placed ?? [], t);
    const floor = assemble(mode.id, content, geo, t);
    // 裏の調子は、異変の部屋と階段室（上下の階の写しで同じ見た目）には掛けない
    const tone = front ? applyBSide(floor, new Rng(hashAll(mode.seedBase, 'tone')), new Set([...(anomalies?.placed.map((x) => x.cell) ?? []), ...(geo.sealed ?? [])])).id : undefined;
    // 仕掛けを置いた区画は置くときに到達を確かめている（部品が作る床を含めて）ので、ここでは見ない
    const checked = new Set(gimmicks?.gimmicks.map((g) => g.cell) ?? []);
    const issues = validateFloor(floor, geo, checked);
    if (profile.region) issues.push(...validateRegion(floor, geo));
    const res = { floor, profile: content, gimmicks, anomalies: anomalies?.placed ?? [], geoTry, ...(tone ? { tone } : {}) };
    if (!issues.length) return { ...res, attempts: attempt + 1, issues: errors, ms: Date.now() - t0 };
    errors.push(...issues.map((s) => `#${attempt}: ${s}`));
    last = res;
  }
  if (!last) throw new Error(`フロアを作れませんでした（${mode.id}）: ${errors.join(' / ')}`);
  return { ...last, attempts: tries, issues: errors, ms: Date.now() - t0 };
}

function assemble(id: string, profile: FloorProfile, geo: FloorGeometry, t: Tuning): FloorLayout {
  const cells = geo.cells.map((g) => g.cell);
  const bounds: AABB = cells.map((c) => c.bounds).reduce((a, b) => aabbUnion(a, b));
  const layout: FloorLayout = {
    id,
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
  const reg = profile.region;
  if (reg && geo.region) {
    layout.region = {
      id, kind: reg.kind, rect: { ...reg.rect }, gates: geo.region.gates, airlocks: geo.region.airlocks, ...(geo.region.landings?.length ? { landings: geo.region.landings } : {}),
      name: reg.kind === 'patchwork' ? '入り組んだ区画' : profile.family.name, family: profile.family.id, pattern: profile.pattern, rarity: profile.rarity,
    };
  }
  return layout;
}

/** 開口のつながりで、出てくる区画からいちばん遠い区画（cands の中から） */
function farthestCell(geo: FloorGeometry, cands: string[]): string {
  const adj = new Map<string, string[]>();
  for (const p of geo.portals) { adj.set(p.cells[0], [...(adj.get(p.cells[0]) ?? []), p.cells[1]]); adj.set(p.cells[1], [...(adj.get(p.cells[1]) ?? []), p.cells[0]]); }
  const dist = new Map<string, number>([[geo.spawn.cell, 0]]);
  const q = [geo.spawn.cell];
  for (let h = 0; h < q.length; h++) for (const m of adj.get(q[h]!) ?? []) if (!dist.has(m)) { dist.set(m, dist.get(q[h]!)! + 1); q.push(m); }
  return cands.slice().sort((a, b) => (dist.get(b) ?? -1) - (dist.get(a) ?? -1))[0]!;
}

/** 区域の検証: 区画が区域の矩形からはみ出さない（別の空間は除く）・境目の扉と階段室が全部ある */
export function validateRegion(floor: FloorLayout, geo: FloorGeometry): string[] {
  const issues: string[] = [];
  const reg = floor.region;
  if (!reg) return ['区域の情報がありません'];
  const r = reg.rect;
  for (const c of floor.cells) {
    if (c.pocket) continue;
    for (const f of c.footprint) if (f.x0 < r.x0 - 0.01 || f.x1 > r.x1 + 0.01 || f.z0 < r.z0 - 0.01 || f.z1 > r.z1 + 0.01) { issues.push(`区画が区域からはみ出しています: ${c.id}`); break; }
  }
  const ids = new Set(floor.cells.map((c) => c.id));
  for (const g of reg.gates) if (!ids.has(g.cell)) issues.push(`境目の扉の区画がありません: ${g.id}`);
  for (const a of reg.airlocks) if (!ids.has(a.cell)) issues.push(`階段室がありません: ${a.id}`);
  for (const l of reg.landings ?? []) if (!ids.has(l.cell)) issues.push(`着く部屋がありません: ${l.id}`);
  void geo;
  return issues;
}

/** 検証。問題の一覧（空なら合格） */
export function validateFloor(floor: FloorLayout, geo?: FloorGeometry, skipReach: ReadonlySet<string> = new Set()): string[] {
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
  if (!floor.exits.length && !floor.region && !geo?.region) issues.push('出口がありません');
  // 区画の中で開口どうしが歩いてつながる
  if (geo) {
    for (const g of geo.cells) {
      if (g.openings.length < 2 || skipReach.has(g.cell.id)) continue;
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
