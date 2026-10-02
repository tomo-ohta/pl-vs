/**
 * 部屋まるごとの異変を置く（docs/game-design.md 2・3 章。型は types.ts、異変の定義は defs/*.ts）。
 *
 * planAnomalies: 仕掛けと隠しを置いたあと、残りの部屋から異変を掛ける部屋を選び、pre を掛ける。
 * 戻り値の post を、区画の中身（家具）を置いた後に呼ぶ（区画ごとに、中身を置く前の箱の数を渡す）。
 *
 * 選び方:
 * - 候補: 部屋・広間（入口・出口・隠し部屋を除く）のうち、仕掛けの無い区画。扉の向こうの部屋を強く優先する
 *   （扉の無い入口の部屋は確率に anomaly.openMul を掛ける。扉を開けた瞬間の驚きが要）
 * - 確率: 扉の向こうの部屋のうち異変の部屋になる割合を anomaly.share.main / side に合わせる。仕掛けの部屋も数に入れ、
 *   空いている部屋の数で割り戻す（仕掛けの多さが変わっても、くじの「異変」の割合が保たれる）
 * - 緩急（本道の上、入口から順に）: 直前の部屋が異変なら確率を下げる（普通の部屋を挟む）・直前が強い仕掛け / 強い異変なら
 *   強い異変の重みを下げる・直前と同じ異変は出さない。同じ異変はフロアの中で anomaly.repeatMul ずつ出にくくする
 * - 珍しいフロアにだけ出る強い異変（def.minRarity）・物理の上限（gimmick.physicsMax を仕掛けと分け合う）
 * - 決定的: 区画ごとの乱数は (profile.seed, 区画 id) から作る
 *
 * 安全: pre の後と post の後に、区画の開口どうしが歩いてつながること（立ったまま。底の低い宙の箱は壁として見る）と、
 * 動かした・足した当たる箱が開口の前に掛からないことを確かめる。だめならその異変を取り消し（箱・照明・ゾーン・部品・色を戻す）、
 * 部屋は普通の部屋に戻る。post で取り消したときは、家具の要らない異変（暗闇・霧・色）に掛け替えてみる。
 *
 * - 異変が言う「家具を置かない範囲」（ctx.keepOut）は GimmickResult.keepOut に足す（フロアの生成が区画の中身へ渡す）
 * - 見本のフロア（showcase）: 頼んだ異変を頼んだ順に 1 つずつ、扉の向こうの部屋から置く（確率・緩急・物理の上限は見ない）。
 *   家具が合わずに post で外れた異変（post だけのもの）は、空いている部屋に掛け直す
 * - 見て回る順（tour）は区画の入口のすぐ外に立つ位置。外した異変は GimmickResult.tour からも外す
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Vec3 } from '../../math/vec.ts';
import type { Box, CellLayout, EntitySpec, LightingOverrides, LightSpec, Palette, RenderOverrides, WallOpening, Zone } from '../../world/layout.ts';
import { reachOpenings } from '../reach.ts';
import '../gimmicks/index.ts';
import { gimmickDefs } from '../gimmicks/types.ts';
import type { FloorGeometry, GeoCell } from '../floor/geometry.ts';
import type { GimmickResult, TourStop } from '../floor/gimmicks.ts';
import { rarityRank, type FloorProfile } from '../floor/profile.ts';
import { anomalyDef, anomalyDefs, type AnomalyContext, type AnomalyDef, type AnomalyFloor } from './types.ts';
import { doorFronts, hitsAny, innerRects, inwardOf, mainRect, objectGroups, rectArea, STAND_H } from './util.ts';
import './defs/index.ts';

export * from './types.ts';

export interface PlacedAnomaly { id: string; def: string; name: string; cell: string }

export interface AnomalyPlan {
  placed: PlacedAnomaly[];
  /** 区画の中身を置かない区画 */
  noDress: Set<string>;
  /** 見て回る順（見本のフロアのワープ） */
  tour: TourStop[];
  /** 区画の中身を置いた後に呼ぶ。dressedFrom: 区画 id → 中身を置く前の cell.boxes.length */
  post(dressedFrom: ReadonlyMap<string, number>): void;
  /**
   * post で掛けられずに掛け替えるとき、その区画に掛けてよい異変か（部屋の形 core/gen/rooms が、形と重ねてよい異変だけに絞る）。
   * 無ければどれでもよい
   */
  allow?(cellId: string, defId: string): boolean;
}

/** 見本のフロア: 異変を決めた順に 1 つずつ置く */
export interface AnomalyShowcase { anomalies: string[] }

/** 異変の重み（調整表 anomaly.w.<id> があればそちら） */
export function anomalyWeight(def: AnomalyDef, t: Tuning): number {
  const v = (t as unknown as Record<string, number | boolean | undefined>)[`anomaly.w.${def.id}`];
  return typeof v === 'number' ? v : def.weight;
}

const ROOM_KINDS = new Set(['room', 'hall']);
const NOT_ROLES = new Set(['entry', 'exit', 'secret']);

/** 入口から出口の階段までの区画の並び（開口のつながりで。floor/gimmicks.ts の mainCells と同じ） */
function mainCells(geo: FloorGeometry): string[] {
  const by = new Map<string, string[]>();
  for (const p of geo.portals) { by.set(p.cells[0], [...(by.get(p.cells[0]) ?? []), p.cells[1]]); by.set(p.cells[1], [...(by.get(p.cells[1]) ?? []), p.cells[0]]); }
  const prev = new Map<string, string | null>([[geo.spawn.cell, null]]);
  const q = [geo.spawn.cell];
  for (let h = 0; h < q.length && !prev.has('exitStairs'); h++) for (const m of by.get(q[h]!) ?? []) if (!prev.has(m)) { prev.set(m, q[h]!); q.push(m); }
  if (!prev.has('exitStairs')) return [];
  const out: string[] = [];
  for (let c: string | null | undefined = 'exitStairs'; c; c = prev.get(c)) out.unshift(c);
  return out;
}

/** 区画 id の開口 o に重なる portal */
function portalAt(geo: FloorGeometry, id: string, o: WallOpening): FloorGeometry['portals'][number] | null {
  let best: FloorGeometry['portals'][number] | null = null, bd = 0.6;
  for (const p of geo.portals) {
    if (!p.cells.includes(id)) continue;
    const d = Math.hypot((p.aabb.min[0] + p.aabb.max[0]) / 2 - o.pos[0], (p.aabb.min[2] + p.aabb.max[2]) / 2 - o.pos[2]);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** 区画の開口のうち、隣の区画 other との間のもの */
function openingTo(geo: FloorGeometry, g: GeoCell, other: string): WallOpening | null {
  const p = geo.portals.find((x) => x.cells.includes(g.cell.id) && x.cells.includes(other));
  if (!p) return null;
  const c: [number, number] = [(p.aabb.min[0] + p.aabb.max[0]) / 2, (p.aabb.min[2] + p.aabb.max[2]) / 2];
  return g.openings.slice().sort((a, b) => Math.hypot(a.pos[0] - c[0], a.pos[2] - c[1]) - Math.hypot(b.pos[0] - c[0], b.pos[2] - c[1]))[0] ?? null;
}

/** 開口 o のすぐ外（0.6 m）に、区画の中を向いて立つ位置（見て回る順） */
function standAt(o: WallOpening): { pos: Vec3; yaw: number } {
  const [ix, iz] = inwardOf(o);
  return { pos: [o.pos[0] - ix * 0.6, o.pos[1] + 0.02, o.pos[2] - iz * 0.6], yaw: Math.atan2(-ix, -iz) };
}

// ---------------------------------------------------------------- 取り消しのための写し

/** JSON にできる値の深い写し（箱・照明・ゾーン・描画の上書きは JSON の値だけでできている） */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

interface Snapshot {
  boxes: Box[];
  data: Box[];
  lights: LightSpec[];
  zones: Zone[];
  palette: Palette;
  render: RenderOverrides | undefined;
  lighting: LightingOverrides | undefined;
  /** 天井の高さ・外形・環境音・地図の情報（部屋の形を変える異変 vast・環境音を変える異変が書き換える。段階 4 で足した） */
  shape: Pick<CellLayout, 'height' | 'bounds' | 'audioPreset' | 'map'>;
}

function snapshot(cell: CellLayout): Snapshot {
  return {
    boxes: cell.boxes.slice(), data: clone(cell.boxes), lights: clone(cell.lights), zones: clone(cell.zones),
    palette: { ...cell.palette }, render: cell.render ? clone(cell.render) : undefined, lighting: cell.lighting ? clone(cell.lighting) : undefined,
    shape: clone({ height: cell.height, bounds: cell.bounds, audioPreset: cell.audioPreset, map: cell.map }),
  };
}

/** 写しに戻す（箱は同じ物を使い回す: ほかの所が持っている参照を壊さない） */
function restore(cell: CellLayout, s: Snapshot): void {
  cell.boxes = s.boxes.map((b, i) => {
    for (const k of Object.keys(b)) delete (b as unknown as Record<string, unknown>)[k];
    return Object.assign(b, clone(s.data[i]!));
  });
  cell.lights = clone(s.lights);
  cell.zones = clone(s.zones);
  cell.palette = { ...s.palette };
  if (s.render) cell.render = clone(s.render); else delete cell.render;
  if (s.lighting) cell.lighting = clone(s.lighting); else delete cell.lighting;
  cell.height = s.shape.height;
  cell.bounds = clone(s.shape.bounds);
  if (s.shape.audioPreset !== undefined) cell.audioPreset = s.shape.audioPreset; else delete cell.audioPreset;
  if (s.shape.map) cell.map = clone(s.shape.map); else delete cell.map;
}

// ---------------------------------------------------------------- 到達の確認

interface ReachBase { loose: Set<string>; strict: Set<string> }

/** 立ったまま通れるかを見る形: 底が床より上・STAND_H より下にある宙の当たる箱は、床まである物として見る */
function strictBoxes(cell: CellLayout): Box[] {
  const fy = cell.floorY;
  return cell.boxes.map((b) => (b.solid && b.min[1] > fy + 0.05 && b.min[1] < fy + STAND_H && b.max[1] > fy + 0.05 ? { ...b, min: [b.min[0], fy, b.min[2]] as Vec3 } : b));
}

/** 区画の中で届かない開口（loose: 到達判定そのまま / strict: 立ったまま）。見ない区画は null */
function reachState(g: GeoCell): ReachBase | null {
  if (g.openings.length < 2) return null;
  const b = g.cell.bounds;
  // フロアの検証と同じく、開口の奥行きの向きに 2.4 m 未満の区画は見ない
  if (g.openings.some((o) => (o.dir === 1 || o.dir === 3 ? b.max[0] - b.min[0] : b.max[2] - b.min[2]) < 2.4)) return null;
  const loose = reachOpenings(g.cell, g.openings, 0.1);
  const strict = reachOpenings({ footprint: g.cell.footprint, floorY: g.cell.floorY, boxes: strictBoxes(g.cell) }, g.openings, 0.1);
  if (!loose || !strict) return null;
  return { loose: new Set(loose.blocked), strict: new Set(strict.blocked) };
}

/** 前より悪くなっていない（届かない開口が増えていない） */
function reachNotWorse(g: GeoCell, base: ReachBase | null): boolean {
  if (!base) return true;
  const now = reachState(g);
  if (!now) return true;
  return [...now.loose].every((id) => base.loose.has(id)) && [...now.strict].every((id) => base.strict.has(id));
}

/** 足した・動かした当たる箱が開口の前に掛からないか（写しと比べる） */
function doorsClear(g: GeoCell, s: Snapshot): boolean {
  const zones = doorFronts(g.cell, g.openings, 1.2, 0.3);
  const before = new Map(s.boxes.map((b, i) => [b, s.data[i]!]));
  for (const b of g.cell.boxes) {
    // 床の高さより上に出ない箱（切り分けた床板・床の穴の底と側面）は通り道を塞がない
    if (!b.solid || b.max[1] <= g.cell.floorY + 1e-3) continue;
    const o = before.get(b);
    const moved = !o || !o.solid || o.min.some((v, k) => Math.abs(v - b.min[k]!) > 1e-6) || o.max.some((v, k) => Math.abs(v - b.max[k]!) > 1e-6);
    if (moved && hitsAny(zones, b)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- 掛ける

interface Active {
  def: AnomalyDef;
  g: GeoCell;
  id: string;
  entrance: WallOpening;
  main: boolean;
  rng: Rng;
  memo: Record<string, unknown>;
  placed: PlacedAnomaly;
  stop: TourStop;
  /** pre の前の写し（post で取り消すときに pre の分も戻す） */
  pre: Snapshot | null;
  /** この部屋の前に通る部屋（AnomalyContext.prev） */
  prev?: GeoCell | null;
}

/** 脇道の部屋の前の部屋: 入ってくる開口の向こうから開口をたどって、いちばん近い部屋・広間（この部屋は除く） */
function roomBehind(geo: FloorGeometry, g: GeoCell, entrance: WallOpening): GeoCell | null {
  const first = portalAt(geo, g.cell.id, entrance);
  if (!first) return null;
  const start = first.cells[0] === g.cell.id ? first.cells[1] : first.cells[0];
  const seen = new Set([g.cell.id, start]);
  const q = [start];
  for (let h = 0; h < q.length && h < 64; h++) {
    const c = geo.cells.find((x) => x.cell.id === q[h]);
    if (c && ROOM_KINDS.has(c.kind)) return c;
    for (const p of geo.portals) {
      if (!p.cells.includes(q[h]!)) continue;
      const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
      if (!seen.has(o)) { seen.add(o); q.push(o); }
    }
  }
  return null;
}

interface Env {
  geo: FloorGeometry;
  gimmicks: GimmickResult | null;
  t: Tuning;
  floor: AnomalyFloor;
  noDress: Set<string>;
}

/** 異変の 1 段（pre / post）を掛けて確かめる。だめなら取り消して false */
function runStage(stage: 'pre' | 'post', a: Active, env: Env, furniture: Box[]): boolean {
  const fn = stage === 'pre' ? a.def.pre : a.def.post;
  if (!fn) return true;
  const { geo, gimmicks } = env;
  const cell = a.g.cell;
  const snap = snapshot(cell);
  const base = reachState(a.g);
  const keep: AABB[] = [];
  let skip = false;
  const prefix = `${a.id}.`;
  const ctx: AnomalyContext = {
    geo: a.g, cell, rng: a.rng.fork(stage), tuning: env.t, floor: env.floor, id: a.id, entrance: a.entrance, main: a.main,
    rects: innerRects(cell), furniture, memo: a.memo,
    addBox(b) { cell.boxes.push(b); return b; },
    removeBoxes(pred) {
      cell.boxes = cell.boxes.filter((b) => !pred(b));
      for (let i = furniture.length - 1; i >= 0; i--) if (pred(furniture[i]!)) furniture.splice(i, 1);
    },
    addEntity(name, e) { const eid = `${prefix}${name}`; geo.entities.push({ ...e, id: eid, cell: e.cell ?? cell.id } as EntitySpec); return eid; },
    addZone(z) { cell.zones.push(z); },
    skipDress() { if (stage === 'pre') skip = true; },
    keepOut(x) { if (stage === 'pre') keep.push(x); },
    reachOk: () => reachNotWorse(a.g, base),
    world: geo,
    prev: a.prev ?? null,
  };
  const ok = fn(ctx) !== false && reachNotWorse(a.g, base) && doorsClear(a.g, snap);
  if (!ok) {
    restore(cell, snap);
    for (let i = geo.entities.length - 1; i >= 0; i--) if (geo.entities[i]!.id.startsWith(prefix)) geo.entities.splice(i, 1);
    return false;
  }
  if (skip) env.noDress.add(cell.id);
  if (keep.length && gimmicks) gimmicks.keepOut.set(cell.id, [...(gimmicks.keepOut.get(cell.id) ?? []), ...keep]);
  return true;
}

/** 異変を区画に掛けられるか（大きさ・高さ・珍しさ・物理・テーマ） */
function fitsCell(def: AnomalyDef, g: GeoCell, p: FloorProfile, physicsLeft: boolean, floor: AnomalyFloor): boolean {
  const r = mainRect(g.cell);
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  return def.kinds.includes(g.kind) &&
    (!def.minSize || (Math.min(w, d) >= def.minSize[0] && Math.max(w, d) >= def.minSize[1])) &&
    (!def.minHeight || g.cell.height >= def.minHeight) &&
    (!def.maxArea || g.cell.footprint.reduce((a, q) => a + rectArea(q), 0) <= def.maxArea) &&
    (!def.minRarity || rarityRank(p.rarity) >= rarityRank(def.minRarity)) &&
    (!def.physics || physicsLeft) &&
    (!def.frontOnly || p.key.variant === 0) &&
    (!def.fits || def.fits(g, floor));
}

export function planAnomalies(p: FloorProfile, geo: FloorGeometry, gimmicks: GimmickResult | null, t: Tuning, depth: number, showcase?: AnomalyShowcase): AnomalyPlan {
  const defs = anomalyDefs();
  const main = mainCells(geo);
  const mainIdx = new Map(main.map((id, i) => [id, i]));
  const gim = new Map((gimmicks?.gimmicks ?? []).map((g) => [g.cell, g]));
  const gdefs = new Map(gimmickDefs().map((d) => [d.id, d]));
  const physicsMax = t['gimmick.physicsMax'];
  let physicsUsed = (gimmicks?.gimmicks ?? []).filter((g) => gdefs.get(g.def)?.physics).length;
  const floor: AnomalyFloor = { id: p.id, seed: p.seed, depth, rarity: p.rarity, family: p.family.id };
  const env: Env = { geo, gimmicks, t, floor, noDress: new Set() };
  const plan: AnomalyPlan = { placed: [], noDress: env.noDress, tour: [], post: () => {} };
  const active: Active[] = [];
  const byCell = new Map<string, Active>();

  const rooms = geo.cells.filter((g) => ROOM_KINDS.has(g.kind) && !NOT_ROLES.has(g.cell.role) && g.openings.length > 0);
  /** 入ってくる開口: 本道なら前の区画の側、そうでなければ扉のある開口（無ければ最初の開口） */
  const entranceOf = (g: GeoCell): WallOpening => {
    const i = mainIdx.get(g.cell.id);
    if (i !== undefined && i > 0) { const o = openingTo(geo, g, main[i - 1]!); if (o) return o; }
    return g.openings.find((o) => portalAt(geo, g.cell.id, o)?.kind === 'door') ?? g.openings[0]!;
  };
  const isDoor = (g: GeoCell, o: WallOpening): boolean => portalAt(geo, g.cell.id, o)?.kind === 'door';
  const info = new Map(rooms.map((g) => { const e = entranceOf(g); return [g.cell.id, { entrance: e, door: isDoor(g, e), main: mainIdx.has(g.cell.id) }]; }));
  const free = rooms.filter((g) => !gim.has(g.cell.id));
  // 扉の向こうの部屋の数（仕掛けの部屋を含む）と、そのうち空いている部屋の数 → 空いた部屋 1 つの確率
  const chanceOf = (onMain: boolean): number => {
    const all = rooms.filter((g) => info.get(g.cell.id)!.door && info.get(g.cell.id)!.main === onMain).length;
    const open = free.filter((g) => info.get(g.cell.id)!.door && info.get(g.cell.id)!.main === onMain).length;
    const share = onMain ? t['anomaly.share.main'] : t['anomaly.share.side'];
    return open ? Math.min(t['anomaly.chanceMax'], (share * all) / open) : 0;
  };
  const chance = { main: chanceOf(true), side: chanceOf(false) };
  // 本道の上で、この区画の前の部屋（廊下・曲がり角・階段は飛ばす）
  const prevRoom = (id: string): string | null => {
    const i = mainIdx.get(id);
    if (i === undefined) return null;
    for (let k = i - 1; k > 0; k--) {
      const c = geo.cells.find((x) => x.cell.id === main[k]);
      if (c && ROOM_KINDS.has(c.kind)) return c.cell.id;
    }
    return null;
  };
  // 置く順: 本道の上（入口から）→ ほか（区画の並びのまま）
  const order = free.slice().sort((a, b) => (mainIdx.get(a.cell.id) ?? 1e6) - (mainIdx.get(b.cell.id) ?? 1e6));
  const todo = showcase ? showcase.anomalies.filter((id) => anomalyDef(id)) : null;
  if (todo) {
    // 見本: 扉の向こうの、中くらいの部屋から（広間は最後）
    order.sort((a, b) => (a.kind === 'hall' ? 1 : 0) - (b.kind === 'hall' ? 1 : 0) || rectArea(mainRect(a.cell)) - rectArea(mainRect(b.cell)));
  }
  const count = (id: string): number => active.filter((x) => x.def.id === id).length;

  const create = (def: AnomalyDef, g: GeoCell, rng: Rng): Active => {
    const inf = info.get(g.cell.id)!;
    const id = `a:${def.id}:${g.cell.id}`;
    const placed: PlacedAnomaly = { id, def: def.id, name: def.name, cell: g.cell.id };
    const prevId = inf.main ? prevRoom(g.cell.id) : null;
    const prev = prevId ? geo.cells.find((x) => x.cell.id === prevId) ?? null : roomBehind(geo, g, inf.entrance);
    return { def, g, id, entrance: inf.entrance, main: inf.main, rng: rng.fork(def.id), memo: {}, placed, stop: { label: `異変: ${def.name}`, cell: g.cell.id, ...standAt(inf.entrance) }, pre: def.pre ? snapshot(g.cell) : null, prev };
  };
  const start = (def: AnomalyDef, g: GeoCell, rng: Rng): Active | null => {
    const a = create(def, g, rng);
    return runStage('pre', a, env, []) ? a : null;
  };
  const commit = (a: Active): void => {
    active.push(a);
    byCell.set(a.g.cell.id, a);
    plan.placed.push(a.placed);
    plan.tour.push(a.stop);
    if (a.def.physics) physicsUsed++;
  };

  for (const g of order) {
    if (todo && !todo.length) break;
    const inf = info.get(g.cell.id)!;
    const r = new Rng(hashAll(p.seed, 'anomaly', g.cell.id));
    const prevId = inf.main ? prevRoom(g.cell.id) : null;
    const prevA = prevId ? byCell.get(prevId) ?? null : null;
    const prevG = prevId ? gim.get(prevId) : undefined;
    const prevIntense = (prevA && prevA.def.intensity >= 2) || (prevG && (gdefs.get(prevG.def)?.intensity ?? 0) >= 2);
    if (!todo) {
      let ch = inf.main ? chance.main : chance.side;
      if (!inf.door) ch *= t['anomaly.openMul'];
      if (prevA) ch *= t['anomaly.runChanceMul'];
      if (!r.chance(ch)) continue;
    }
    // 見本のフロアは物理の上限を見ない（確認用）
    let fit = defs.filter((d) => fitsCell(d, g, p, !!todo || physicsUsed < physicsMax, floor) && (!todo || todo.includes(d.id)));
    // 決めた異変が組めなければ、次に重いものを 1 回だけ試す（見本は残りを全部試す）
    for (let tries = 0; fit.length && tries < (todo ? fit.length : 2); tries++) {
      const def = todo ? fit.sort((x, y) => todo.indexOf(x.id) - todo.indexOf(y.id))[0]! : r.weighted(fit, (d) => {
        let w = anomalyWeight(d, t) * t['anomaly.repeatMul'] ** count(d.id);
        if (prevA && prevA.def.id === d.id) w *= t['anomaly.sameRunMul'];
        if (prevIntense && d.intensity >= 2) w *= t['anomaly.intenseAfterMul'];
        return w;
      });
      fit = fit.filter((d) => d !== def);
      const a = start(def, g, r);
      if (!a) continue;
      commit(a);
      if (todo) todo.splice(todo.indexOf(def.id), 1);
      break;
    }
  }

  /** 異変を外す（部屋は普通の部屋に戻る。見て回る順からも外す） */
  const drop = (a: Active): void => {
    active.splice(active.indexOf(a), 1);
    byCell.delete(a.g.cell.id);
    plan.placed.splice(plan.placed.indexOf(a.placed), 1);
    plan.tour.splice(plan.tour.indexOf(a.stop), 1);
    const i = gimmicks ? gimmicks.tour.indexOf(a.stop) : -1;
    if (i >= 0) gimmicks!.tour.splice(i, 1);
  };
  /** post で取り消したとき、pre の分も戻す（中身が足した家具はそのまま残す）。戻した後の家具の箱を返す */
  const undoPre = (a: Active, from: number | undefined): Box[] => {
    const cell = a.g.cell;
    const furniture = from === undefined ? [] : cell.boxes.slice(from);
    const pre = a.pre;
    if (!pre) return furniture;
    restore(cell, pre);
    cell.boxes.push(...furniture);
    for (let i = geo.entities.length - 1; i >= 0; i--) if (geo.entities[i]!.id.startsWith(`${a.id}.`)) geo.entities.splice(i, 1);
    env.noDress.delete(cell.id);
    return furniture;
  };

  plan.post = (dressedFrom) => {
    // フロアの生成が見て回る順を post の前に仕掛けの順へ足したか（足した後なら、post で足す異変は直接そちらへも足す）
    const merged = !!gimmicks && plan.tour.some((s) => gimmicks.tour.includes(s));
    for (const a of active.slice()) {
      if (!a.def.post) continue;
      const from = dressedFrom.get(a.g.cell.id);
      const furniture = from === undefined ? [] : a.g.cell.boxes.slice(from);
      if ((!a.def.needsFurniture || objectGroups(furniture, a.g.cell).length > 0) && runStage('post', a, env, furniture)) continue;
      // 掛けられなかった: pre の分も戻し、家具の要らない異変（post だけのもの）に掛け替えてみる
      const rest = undoPre(a, from);
      if (a.def.physics) physicsUsed--;
      const r = a.rng.fork('fallback');
      const pool = showcase ? defs.filter((d) => showcase.anomalies.includes(d.id) && !active.some((x) => x.def === d)) : defs;
      const left = pool.filter((d) => d !== a.def && d.post && !d.pre && !d.needsFurniture && (plan.allow?.(a.g.cell.id, d.id) ?? true) && fitsCell(d, a.g, p, !!showcase || physicsUsed < physicsMax, floor));
      let swapped = false;
      if (left.length) {
        const def = r.weighted(left, (d) => anomalyWeight(d, t) * t['anomaly.repeatMul'] ** count(d.id));
        const b: Active = { ...a, def, id: `a:${def.id}:${a.g.cell.id}`, rng: a.rng.fork(def.id), memo: {}, pre: null };
        if (runStage('post', b, env, rest)) {
          // 同じ物（placed・見て回る順）を書き換える（フロアの生成はもう参照を持っている）
          Object.assign(a.placed, { id: b.id, def: def.id, name: def.name });
          a.stop.label = `異変: ${def.name}`;
          Object.assign(a, { def, id: b.id, pre: null });
          if (def.physics) physicsUsed++;
          swapped = true;
        }
      }
      if (!swapped) drop(a);
    }
    // 見本: 置けなかった異変（post だけのもの）を、空いている部屋に掛け直す
    if (!showcase) return;
    for (const id of showcase.anomalies) {
      const def = anomalyDef(id);
      if (!def || def.pre || !def.post || active.some((x) => x.def === def)) continue;
      for (const g of order) {
        if (byCell.has(g.cell.id) || !fitsCell(def, g, p, true, floor)) continue;
        const from = dressedFrom.get(g.cell.id);
        const furniture = from === undefined ? [] : g.cell.boxes.slice(from);
        if (def.needsFurniture && !objectGroups(furniture, g.cell).length) continue;
        const a = create(def, g, new Rng(hashAll(p.seed, 'anomaly', g.cell.id)));
        if (!runStage('post', a, env, furniture)) continue;
        commit(a);
        if (merged) gimmicks!.tour.push(a.stop);
        break;
      }
    }
  };
  return plan;
}
