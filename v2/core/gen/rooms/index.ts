/**
 * 部屋の形を掛ける段（gimmicks-and-structures.md 2.2。型は types.ts、形の定義は shapes/*.ts）。
 *
 * フロアの生成（core/gen/floor/index.ts）が、仕掛け・隠し・異変（pre）を決めた後、区画の中身（家具）を置く前に shapeRooms を呼ぶ。
 *
 * 掛ける順と決まり:
 * - 候補: 部屋・広間（入口・出口・隠し部屋を除く）のうち、仕掛けの無い区画（仕掛けは部屋の形を自分で作るので掛けない）・
 *   隠しの入口のある区画（暗がりの隠し。照明を外してある）でない区画・異変が中身を自分で埋める区画でない区画
 * - 異変の部屋: 中身を置く前の段（pre）の無い異変だけ（pre の取り消しで形が消えないように）。形の anomalies に書いた異変とだけ重ねる
 *   （浸水・軽い部屋・扉だらけのような pre のある異変の部屋には掛けない）
 * - 確率: 普通の部屋 rooms.chance.room / 広間 rooms.chance.hall / 異変の部屋 rooms.chance.anomaly。扉の無い入口は rooms.openMul 倍
 *   （扉を開けた瞬間の「こういう部屋か」を優先）。同じ形はフロアの中で rooms.repeatMul ずつ出にくい
 * - 置ける形: 区画の種類・大きさ・天井の高さ・珍しさ・表のフロアだけ・水（プールのフロアでは使わない）・fits
 * - 組めなければ次の候補（rooms.buildTries まで）。組んだ後に確かめる（だめなら取り消して部屋は元のまま）:
 *     開口どうしが歩いてつながる（前より悪くない。異変の部屋は立ったままでも）・開口の前（1.2 m）に当たる物を足していない・
 *     開口の前が床のまま・足した箱と灯りの数が予算（rooms.maxBoxes / rooms.maxLights）の中
 * - 決定的: 部屋を選ぶ乱数は (profile.seed, 'rooms', 区画 id)、形を組む乱数は (profile.seed, 'rooms', 区画 id, 形の id)
 * - 裏のフロア（variant ≥ 1。front に表のフロアを渡す）: 表のフロアと同じ形を、同じ部屋に同じ乱数で組む（同じ建物の照明・材質違い）。
 *   裏で仕掛けの置かれた部屋などには組まない。区画の外形は表と同じにする決まり（tests/gen-showcase）なので、最後に表の外形を写す
 * - 見本のフロア（showcase）: 頼んだ形を頼んだ順に 1 つずつ、置ける部屋から置く（確率は見ない）
 * - 掛けた区画は cell.shape に形の id を書く（地図・図鑑・試験が読む）。見て回る順（gimmicks.tour）に足す
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Vec3 } from '../../math/vec.ts';
import type { Box, CellLayout, EntitySpec, FloorLayout, WallOpening } from '../../world/layout.ts';
import { anomalyDef, type AnomalyPlan } from '../anomaly/index.ts';
import { doorFronts, hitsAny, STAND_H } from '../anomaly/util.ts';
import type { FloorGeometry, GeoCell } from '../floor/geometry.ts';
import type { GimmickResult } from '../floor/gimmicks.ts';
import { rarityRank, type FloorProfile } from '../floor/profile.ts';
import { reachOpenings } from '../reach.ts';
import { roomShapeByIdea, roomShapeDef, roomShapeDefs, type RoomFloor, type RoomShapeContext, type RoomShapeDef } from './types.ts';
import { footOf, isWallBox, rectsHit } from './util.ts';
import './shapes/index.ts';

export * from './types.ts';

export interface PlacedShape { id: string; def: string; idea: string; name: string; cell: string }

/** 調べる用: 形を組めなかったとき（形の id・区画・理由 build / reach / doors / floor / boxes / lights） */
export const roomsDebug: { fail?: (def: string, cell: string, why: string) => void } = {};

/** 形の重み（調整表 rooms.w.<id> があればそちら） */
export function shapeWeight(def: RoomShapeDef, t: Tuning): number {
  const v = (t as unknown as Record<string, number | boolean | undefined>)[`rooms.w.${def.id}`];
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

/** 区画の開口 o に重なる portal */
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
  const [ix, iz] = o.dir === 0 ? [0, -1] : o.dir === 1 ? [-1, 0] : o.dir === 2 ? [0, 1] : [1, 0];
  return { pos: [o.pos[0] - ix * 0.6, o.pos[1] + 0.02, o.pos[2] - iz * 0.6], yaw: Math.atan2(-ix, -iz) };
}

/** 主の矩形（足跡の最大の矩形） */
const mainRect = (c: CellLayout) => c.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));

/** 立ったまま通れるかを見る形: 底が床より上・STAND_H より下にある宙の当たる箱は、床まである物として見る（anomaly/index.ts と同じ） */
function strictBoxes(cell: CellLayout): Box[] {
  const fy = cell.floorY;
  return cell.boxes.map((b) => (b.solid && b.min[1] > fy + 0.05 && b.min[1] < fy + STAND_H && b.max[1] > fy + 0.05 ? { ...b, min: [b.min[0], fy, b.min[2]] as Vec3 } : b));
}

interface ReachBase { loose: Set<string>; strict: Set<string> }

/** 区画の中で届かない開口（loose: 到達判定そのまま / strict: 立ったまま） */
function reachState(g: GeoCell): ReachBase | null {
  if (g.openings.length < 2) return null;
  const loose = reachOpenings(g.cell, g.openings, 0.1);
  const strict = reachOpenings({ footprint: g.cell.footprint, floorY: g.cell.floorY, boxes: strictBoxes(g.cell) }, g.openings, 0.1);
  if (!loose || !strict) return null;
  return { loose: new Set(loose.blocked), strict: new Set(strict.blocked) };
}

function reachNotWorse(g: GeoCell, base: ReachBase | null, strict: boolean): boolean {
  if (!base) return true;
  const now = reachState(g);
  if (!now) return true;
  return [...now.loose].every((id) => base.loose.has(id)) && (!strict || [...now.strict].every((id) => base.strict.has(id)));
}

/** 形を掛ける前の写し（区画の中身・フロアの区画・開口・部品の数） */
interface Snap {
  cell: string;
  keys: string[];
  boxes: Set<Box>;
  openings: number;
  cells: number;
  portals: number;
  entities: number;
  exits: number;
  keep: number;
  noDress: boolean;
}

function snapshot(g: GeoCell, geo: FloorGeometry, gim: GimmickResult, an: AnomalyPlan): Snap {
  return {
    cell: JSON.stringify(g.cell), keys: Object.keys(g.cell), boxes: new Set(g.cell.boxes), openings: g.openings.length,
    cells: geo.cells.length, portals: geo.portals.length, entities: geo.entities.length, exits: geo.exits.length,
    keep: gim.keepOut.get(g.cell.id)?.length ?? 0, noDress: an.noDress.has(g.cell.id),
  };
}

function restore(g: GeoCell, geo: FloorGeometry, gim: GimmickResult, an: AnomalyPlan, s: Snap): void {
  const data = JSON.parse(s.cell) as Record<string, unknown>;
  const cell = g.cell as unknown as Record<string, unknown>;
  for (const k of Object.keys(cell)) if (!s.keys.includes(k)) delete cell[k];
  Object.assign(cell, data);
  g.openings.length = s.openings;
  geo.cells.length = s.cells;
  geo.portals.length = s.portals;
  geo.entities.length = s.entities;
  geo.exits.length = s.exits;
  const k = gim.keepOut.get(g.cell.id);
  if (k) k.length = s.keep;
  if (!s.noDress) an.noDress.delete(g.cell.id);
}

/** 開口の前の床が残っているか（床の高さの当たる面が開口の前 0.3〜1.1 m にある） */
function doorFloorsOk(g: GeoCell, geo: FloorGeometry): boolean {
  const cell = g.cell, fy = cell.floorY;
  // 部屋の形の面（傾いた床。roomSurface 部品）も床として見る
  const surfaces = geo.entities.filter((e) => e.type === 'roomSurface' && e.cell === cell.id).map((e) => {
    const r = e.params.rect as unknown as { x0: number; z0: number; x1: number; z1: number };
    const o = e.params.origin as number[], n = e.params.normal as number[];
    return { r, at: (x: number, z: number): number => o[1]! - (n[0]! * (x - o[0]!) + n[2]! * (z - o[2]!)) / n[1]! };
  });
  for (const o of g.openings) {
    if (Math.abs(o.pos[1] - fy) > 0.05) continue;
    const [ix, iz] = o.dir === 0 ? [0, -1] : o.dir === 1 ? [-1, 0] : o.dir === 2 ? [0, 1] : [1, 0];
    for (const d of [0.3, 0.7, 1.1]) {
      const x = o.pos[0] + ix * d, z = o.pos[2] + iz * d;
      const ok = cell.boxes.some((b) => b.solid && b.kind !== 'emitOnly' && Math.abs(b.max[1] - fy) < 0.02 && x >= b.min[0] - 1e-6 && x <= b.max[0] + 1e-6 && z >= b.min[2] - 1e-6 && z <= b.max[2] + 1e-6)
        || surfaces.some((sf) => x >= sf.r.x0 && x <= sf.r.x1 && z >= sf.r.z0 && z <= sf.r.z1 && Math.abs(sf.at(x, z) - fy) < 0.15);
      if (!ok) return false;
    }
  }
  return true;
}

/** 足した・書き換えた当たる箱が、開口の前（壁の内側 1.2 m）に掛からないか（床の高さより上に出る物。作り直した外壁は除く） */
function doorsClear(g: GeoCell, s: Snap): boolean {
  // 開口ごとの範囲（下端は開口の下端: 床より高い開口（舞台の奥の扉）は、その前の台の上だけを見る）
  // 到達の目印（util.reachMark。段の足元）は家具のための物なので、形の箱（段）は見ない
  const ops = g.openings.filter((o) => !o.id.includes('.reach'));
  const zones = doorFronts(g.cell, ops, 1.2, 0.3).map((z, i) => {
    const o = ops[i]!;
    return { min: [z.min[0], o.pos[1] + (o.sill ?? 0) + 0.02, z.min[2]] as [number, number, number], max: z.max };
  });
  for (const b of g.cell.boxes) {
    if (!b.solid || s.boxes.has(b) || isWallBox(g.cell, b)) continue;
    if (hitsAny(zones, b)) return false;
  }
  return true;
}

export function shapeRooms(p: FloorProfile, geo: FloorGeometry, gimmicks: GimmickResult, anomalies: AnomalyPlan, t: Tuning, depth: number, showcase?: readonly string[], front?: FloorLayout | null): PlacedShape[] {
  const defs = roomShapeDefs();
  const main = mainCells(geo);
  const mainIdx = new Map(main.map((id, i) => [id, i]));
  const gimCells = new Set(gimmicks.gimmicks.map((g) => g.cell));
  const hosts = new Set(gimmicks.secrets.map((s) => s.host));
  const anomalyOf = new Map(anomalies.placed.map((a) => [a.cell, a.def]));
  const floor: RoomFloor = { id: p.id, seed: p.seed, depth, rarity: p.rarity, family: p.family.id, variant: p.key.variant };
  // 形を組む乱数の元（裏のフロアは表と同じ形になるよう、表の seed）
  const seed = front ? front.seed : p.seed;
  const out: PlacedShape[] = [];
  const count = (id: string): number => out.filter((x) => x.def === id).length;

  const cands = geo.cells.filter((g) => ROOM_KINDS.has(g.kind) && !NOT_ROLES.has(g.cell.role) && g.openings.length > 0 && !gimCells.has(g.cell.id) && !hosts.has(g.cell.id) && !anomalies.noDress.has(g.cell.id));
  cands.sort((a, b) => (mainIdx.get(a.cell.id) ?? 1e6) - (mainIdx.get(b.cell.id) ?? 1e6));

  const entranceOf = (g: GeoCell): WallOpening => {
    const i = mainIdx.get(g.cell.id);
    if (i !== undefined && i > 0) { const o = openingTo(geo, g, main[i - 1]!); if (o) return o; }
    return g.openings.find((o) => portalAt(geo, g.cell.id, o)?.kind === 'door') ?? g.openings[0]!;
  };
  const exitOf = (g: GeoCell, ent: WallOpening): WallOpening | null => {
    const i = mainIdx.get(g.cell.id);
    if (i !== undefined && i + 1 < main.length) { const o = openingTo(geo, g, main[i + 1]!); if (o && o !== ent) return o; }
    const rest = g.openings.filter((o) => o !== ent);
    return rest.sort((a, b) => Math.hypot(b.pos[0] - ent.pos[0], b.pos[2] - ent.pos[2]) - Math.hypot(a.pos[0] - ent.pos[0], a.pos[2] - ent.pos[2]))[0] ?? null;
  };
  /** 異変の部屋に重ねられるか（中身を置く前の段のある異変の部屋には掛けない） */
  const anomalyOk = (an: string | null): boolean => !an || !anomalyDef(an)?.pre;
  const fitsCell = (def: RoomShapeDef, g: GeoCell, an: string | null): boolean => {
    const r = mainRect(g.cell);
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    return def.kinds.includes(g.kind) &&
      (!def.minSize || (Math.min(w, d) >= def.minSize[0] && Math.max(w, d) >= def.minSize[1])) &&
      (!def.maxSize || (Math.min(w, d) <= def.maxSize[0] && Math.max(w, d) <= def.maxSize[1])) &&
      (!def.minHeight || g.cell.height >= def.minHeight) &&
      (!def.maxHeight || g.cell.height <= def.maxHeight) &&
      (!def.minRarity || rarityRank(p.rarity) >= rarityRank(def.minRarity)) &&
      (!def.frontOnly || p.key.variant === 0) &&
      (!def.water || p.family.id !== 'pool') &&
      (!an || !!def.anomalies?.includes(an)) &&
      (!def.fits || def.fits(g, floor));
  };

  /** 形を組む。だめなら取り消して false */
  const tryBuild = (def: RoomShapeDef, g: GeoCell, an: string | null): boolean => {
    const cell = g.cell;
    const snap = snapshot(g, geo, gimmicks, anomalies);
    const base = reachState(g);
    const lights0 = cell.lights.length;
    const entrance = entranceOf(g);
    const id = `s:${def.id}:${cell.id}`;
    const rect = mainRect(cell);
    const ctx: RoomShapeContext = {
      geo: g, cell, world: geo, rng: new Rng(hashAll(seed, 'rooms', cell.id, def.id)), tuning: t, floor, id, entrance, exit: exitOf(g, entrance), main: mainIdx.has(cell.id), anomaly: an,
      rect: { ...rect }, inner: { x0: rect.x0 + 0.15, z0: rect.z0 + 0.15, x1: rect.x1 - 0.15, z1: rect.z1 - 0.15 }, fy: cell.floorY, h: cell.height,
      addBox(b) { cell.boxes.push(b); return b; },
      removeBoxes(pred) { cell.boxes = cell.boxes.filter((b) => !pred(b)); },
      addEntity(name, e) { const eid = `${id}.${name}`; geo.entities.push({ ...e, id: eid, cell: e.cell ?? cell.id } as EntitySpec); return eid; },
      addZone(z) { cell.zones.push(z); },
      addLight(l) { cell.lights.push(l); },
      keepOut(a: AABB) { gimmicks.keepOut.set(cell.id, [...(gimmicks.keepOut.get(cell.id) ?? []), a]); },
      skipDress(cellId) { anomalies.noDress.add(cellId ?? cell.id); },
      claim(y0, y1, r = rect) {
        for (const o of geo.cells) {
          if (o === g) continue;
          const b = o.cell.bounds;
          if (b.max[1] <= y0 + 0.02 || b.min[1] >= y1 - 0.02) continue;
          if (rectsHit(r, footOf(b), 0.02)) return false;
        }
        const cb = cell.bounds;
        cell.bounds = { min: [cb.min[0], Math.min(cb.min[1], y0), cb.min[2]], max: [cb.max[0], Math.max(cb.max[1], y1), cb.max[2]] };
        return true;
      },
      reachOk: () => reachNotWorse(g, base, !!an),
    };
    const why = def.build(ctx) === false ? 'build' : !reachNotWorse(g, base, !!an) ? 'reach' : !doorsClear(g, snap) ? 'doors' : !doorFloorsOk(g, geo) ? 'floor'
      : cell.boxes.length - snap.boxes.size > t['rooms.maxBoxes'] ? 'boxes' : cell.lights.length > Math.max(lights0, t['rooms.maxLights']) ? 'lights' : '';
    if (why) { roomsDebug.fail?.(def.id, cell.id, why); restore(g, geo, gimmicks, anomalies, snap); return false; }
    cell.shape = def.id;
    out.push({ id, def: def.id, idea: def.idea, name: def.name, cell: cell.id });
    gimmicks.tour.push({ label: `部屋の形: ${def.name}`, cell: cell.id, ...standAt(entrance) });
    return true;
  };

  if (showcase) {
    // 見本: 頼んだ形を頼んだ順に、置ける部屋から（形の id か案の番号）
    const want = showcase.map((s) => roomShapeDef(s) ?? roomShapeByIdea(s)).filter((d): d is RoomShapeDef => !!d);
    const used = new Set<string>();
    for (const def of want) {
      for (const g of cands) {
        if (used.has(g.cell.id)) continue;
        const an = anomalyOf.get(g.cell.id) ?? null;
        if (!anomalyOk(an) || !fitsCell(def, g, an)) continue;
        if (tryBuild(def, g, an)) { used.add(g.cell.id); break; }
      }
    }
    return out;
  }

  if (front) {
    // 裏のフロア: 表の部屋の形を、同じ部屋に同じ乱数で（裏で空いている部屋だけ）。外形は表と同じにする
    const frontCells = new Map(front.cells.map((c) => [c.id, c]));
    for (const g of cands) {
      const def = roomShapeDef(frontCells.get(g.cell.id)?.shape ?? '');
      const an = anomalyOf.get(g.cell.id) ?? null;
      if (def && anomalyOk(an) && fitsCell(def, g, an)) tryBuild(def, g, an);
    }
    for (const g of geo.cells) {
      const fc = frontCells.get(g.cell.id);
      if (fc && g.cell.role !== 'secret' && fc.role !== 'secret') g.cell.bounds = { min: [...fc.bounds.min], max: [...fc.bounds.max] };
    }
    return out;
  }

  for (const g of cands) {
    const r = new Rng(hashAll(seed, 'rooms', g.cell.id));
    const an = anomalyOf.get(g.cell.id) ?? null;
    if (!anomalyOk(an)) continue;
    const ent = entranceOf(g);
    let ch = an ? t['rooms.chance.anomaly'] : g.kind === 'hall' ? t['rooms.chance.hall'] : t['rooms.chance.room'];
    if (portalAt(geo, g.cell.id, ent)?.kind !== 'door') ch *= t['rooms.openMul'];
    if (!r.chance(ch)) continue;
    const pool = defs.filter((d) => fitsCell(d, g, an));
    for (let k = 0; k < t['rooms.buildTries'] && pool.length; k++) {
      const def = r.weighted(pool, (d) => shapeWeight(d, t) * t['rooms.repeatMul'] ** count(d.id));
      pool.splice(pool.indexOf(def), 1);
      if (tryBuild(def, g, an)) break;
    }
  }
  return out;
}
