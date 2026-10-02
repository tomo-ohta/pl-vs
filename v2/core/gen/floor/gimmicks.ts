/**
 * 仕掛けと隠しをフロアに置く（v2-plan.md 5 章の ④⑤）。
 *
 * ④ 仕掛け: 区画（部屋・広間・廊下）ごとに確率で置く。本道の上では、直前の仕掛けと作用の軸が同じなら重みを下げ、
 *    強い仕掛け（強さ 2 以上）が続くなら下げる（緩急）。置いたら区画の開口どうしが歩いてつながるかを調べ、だめなら取り消す。
 * ⑤ 隠し: フロアの隠しの数をポアソン分布（調整表 secrets.*）で引き、差し出された元から重みで選んで付ける。
 *    必ず付ける元（謎のパズル）は数の外で付け、付けられなければその仕掛けを取り消す。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Box, EntitySpec, WallOpening, Zone } from '../../world/layout.ts';
import { reachOpenings } from '../reach.ts';
import { attachSecret, THROUGH_DESTS, type AttachOptions, type PlacedSecret, type RareKind, type SecretDest } from '../secrets/index.ts';
import '../gimmicks/index.ts';
import { gimmickDefs, type ClueCell, type GimmickContext, type GimmickDef, type GimmickSlot, type SecretMode, type SecretOffer } from '../gimmicks/types.ts';
import { frontOf, inward } from '../gimmicks/util.ts';
import type { Vec3 } from '../../math/vec.ts';
import type { FloorGeometry, GeoCell } from './geometry.ts';
import { rarityRank, type FloorProfile } from './profile.ts';

export interface PlacedGimmick { id: string; def: string; cell: string; main: boolean }

/** 見て回る順（確認用のワープ）: 区画の入口のすぐ外に、中を向いて立つ */
export interface TourStop { label: string; cell: string; pos: Vec3; yaw: number }

export interface GimmickResult {
  gimmicks: PlacedGimmick[];
  secrets: PlacedSecret[];
  /** 隠しの数（引いた値）と、置けなかった回数（調整用） */
  budget: number;
  attachFailures: number;
  /** 区画ごとの中身を置かない範囲 */
  keepOut: Map<string, AABB[]>;
  /** 仕掛けと、仕掛けとは別の隠し（暗がり）を見て回る順 */
  tour: TourStop[];
  /** 区画の中身（家具）を置かない区画（仕掛けが ctx.noDress で言う。warp の双子の区画。段階 4 で足した） */
  noDress: Set<string>;
}

/** 開口 o のすぐ外（0.6 m）に、区画の中を向いて立つ位置 */
function standAt(o: WallOpening): { pos: Vec3; yaw: number } {
  const [ix, iz] = inward(o);
  const p = frontOf(o, -0.6);
  return { pos: [p[0], p[1] + 0.02, p[2]], yaw: Math.atan2(-ix, -iz) };
}

const SLOT_KINDS = new Set(['room', 'hall', 'corridor']);

/** 入口から出口の階段までの区画の並び（開口のつながりで） */
function mainCells(geo: FloorGeometry): string[] {
  // 本道の終わり（フロアは出口の階段。果てしない階の区域は下りの階段室か、いちばん遠い境目の扉の区画）
  const goal = geo.mainTo ?? 'exitStairs';
  const by = new Map<string, string[]>();
  for (const p of geo.portals) { by.set(p.cells[0], [...(by.get(p.cells[0]) ?? []), p.cells[1]]); by.set(p.cells[1], [...(by.get(p.cells[1]) ?? []), p.cells[0]]); }
  const prev = new Map<string, string | null>([[geo.spawn.cell, null]]);
  const q = [geo.spawn.cell];
  for (let h = 0; h < q.length && !prev.has(goal); h++) for (const m of by.get(q[h]!) ?? []) if (!prev.has(m)) { prev.set(m, q[h]!); q.push(m); }
  const out: string[] = [];
  for (let c: string | null | undefined = goal; c; c = prev.get(c)) out.unshift(c);
  return out;
}

/** 区画の開口のうち、隣の区画 other との間のもの */
function openingTo(geo: FloorGeometry, g: GeoCell, other: string): WallOpening | null {
  const p = geo.portals.find((x) => x.cells.includes(g.cell.id) && x.cells.includes(other));
  if (!p) return null;
  const c: [number, number] = [(p.aabb.min[0] + p.aabb.max[0]) / 2, (p.aabb.min[2] + p.aabb.max[2]) / 2];
  return g.openings.slice().sort((a, b) => Math.hypot(a.pos[0] - c[0], a.pos[2] - c[1]) - Math.hypot(b.pos[0] - c[0], b.pos[2] - c[1]))[0] ?? null;
}

/**
 * 見本のフロア（確認用）: 仕掛けを決めた順に 1 つずつ置き、差し出された隠しを全部付ける。
 * 型を選べる隠しは存在 / 出現を交互に（flip で逆から）。仕掛けとは別の隠し（暗がり）は 1 つだけ
 */
export interface ShowcaseOptions {
  gimmicks: string[]; flip?: boolean;
  /** 段階 4（carry）: 選んだ仕掛けだけを見る（?try / ?group）。区画に GimmickSlot.showcase を付ける（全種の見本では付けない） */
  pick?: boolean;
  /** 部屋の形（core/gen/rooms）: 見本に置く形の id（か案の番号）。無ければ形を掛けない（段階 4・rooms が足した） */
  rooms?: string[];
}
/** 見本のフロアの隠しの行き先（付けた順。行き先ごとの見た目・つながりを全部見られるように） */
const SHOWCASE_DESTS: SecretDest[] = ['bFloor', 'passageRare', 'loop', 'rareRoom', 'loop', 'floorLink'];
const SHOWCASE_RARE: RareKind[] = ['white', 'theater', 'pool', 'gallery', 'library', 'chapel', 'machine', 'play', 'garden'];

/** 仕掛けの重み（調整表に gimmick.w.<id> があればそちら。異変の anomalyWeight と同じ。試験で 1 つの仕掛けを出やすくするのにも使う） */
export function gimmickWeight(def: GimmickDef, t: Tuning): number {
  const v = (t as unknown as Record<string, number | boolean | undefined>)[`gimmick.w.${def.id}`];
  return typeof v === 'number' ? v : def.weight;
}

export function placeGimmicks(p: FloorProfile, geo: FloorGeometry, t: Tuning, depth: number, showcase?: ShowcaseOptions): GimmickResult {
  const rng = new Rng(hashAll(p.seed, 'gimmicks'));
  const main = mainCells(geo);
  const mainSet = new Set(main);
  const keepOut = new Map<string, AABB[]>();
  const result: GimmickResult = { gimmicks: [], secrets: [], keepOut, budget: 0, attachFailures: 0, tour: [], noDress: new Set() };
  const offers: { offer: SecretOffer; host: GeoCell; gimmick: string }[] = [];
  const defs = gimmickDefs();
  let physicsUsed = 0;
  let prevMain: GimmickDef | null = null;
  // 隠しの数（フロア全体）を先に決める。隠しが無いと成り立たない仕掛けは、この数に空きがあるときだけ置く
  const sr = new Rng(hashAll(p.seed, 'secrets'));
  const mean = t['secrets.perFloorMean'] + t['secrets.depthGain'] * depth + (rarityRank(p.rarity) >= rarityRank('Legendary') ? t['secrets.rarityBonusLegendary'] : 0);
  let budget = showcase ? 999 : Math.min(t['secrets.perFloorMax'], sr.poisson(mean));
  result.budget = budget;
  let alternate = showcase?.flip ? 1 : 0;
  // 通り抜けの出口にしない区画: 仕掛けのある区画（置くたびに足す）
  const avoid = new Set<string>(geo.reserved ?? []);
  const world = { cells: geo.cells, portals: geo.portals, entities: geo.entities, exits: geo.exits, depth, avoid, ...(p.region ? { bound: p.region.rect } : {}) };
  // 行き止まりでない隠し（通り抜け・穴）の数。隠しが 2 つ以上になるフロアでは secrets.throughMin 以上にする
  let through = 0;
  /**
   * 隠しを付ける（left: これを含めて残りの数）。隠しが 2 つ以上になりそうなフロアで、行き止まりでない隠しがまだ足りなければ、
   * 行き止まりでない行き先を先に試す（後の隠しは置けないことがあるので、最初の方で満たしておく）
   */
  const attach = (g: GeoCell, o: SecretOffer, mode: SecretMode, rng: Rng, left: number): PlacedSecret | null => {
    // 隠しの入口を付ける区画が別にある（warp の別の空間）
    if (o.cell) g = geo.cells.find((c) => c.cell.id === o.cell) ?? g;
    const opts: AttachOptions = {};
    if (showcase) { opts.dest = SHOWCASE_DESTS[index % SHOWCASE_DESTS.length]!; opts.rare = SHOWCASE_RARE[index % SHOWCASE_RARE.length]!; }
    const needThrough = result.secrets.length + left >= 2 && through < t['secrets.throughMin'];
    let sec: PlacedSecret | null = null;
    if (needThrough && !showcase) {
      // 調整表の重みの順に（重みで引いて、引いたものを外していく）
      const pool = [...THROUGH_DESTS], order: SecretDest[] = [];
      const tr = rng.fork('through');
      while (pool.length) { const x = tr.weighted(pool, (k) => t[`secrets.dest.${k}` as const] + 1e-6); order.push(x); pool.splice(pool.indexOf(x), 1); }
      for (const dest of order) {
        sec = attachSecret(world, g, o, mode, rng.fork(`t:${dest}`), t, index, { ...opts, dest, strict: true });
        if (sec) break;
      }
    }
    sec ??= attachSecret(world, g, o, mode, rng, t, index, opts);
    if (sec && THROUGH_DESTS.has(sec.dest)) through++;
    return sec;
  };
  let index = 0;
  const modeOf = (o: SecretOffer): SecretMode => {
    const modes = o.modes;
    if (modes.length === 1) return modes[0]!;
    if (showcase) return modes[alternate++ % modes.length]!;
    return sr.weighted(modes, (m) => (m === 'present' ? t['secrets.mode.present'] : t['secrets.mode.appear']));
  };

  // 置く順: 本道の上（入口から）→ ほか
  const slots = geo.cells.filter((g) => SLOT_KINDS.has(g.kind) && g.cell.role !== 'entry' && g.cell.role !== 'exit' && g.openings.length > 0 && !geo.reserved?.has(g.cell.id));
  slots.sort((a, b) => (mainSet.has(a.cell.id) ? main.indexOf(a.cell.id) : 1e6) - (mainSet.has(b.cell.id) ? main.indexOf(b.cell.id) : 1e6));

  const todo = showcase ? showcase.gimmicks.slice() : null;
  for (const g of slots) {
    const onMain = mainSet.has(g.cell.id);
    const chance = g.kind === 'hall' ? t['gimmick.chance.hall'] : g.kind === 'corridor' ? t['gimmick.chance.corridor'] : onMain ? t['gimmick.chance.main'] : t['gimmick.chance.side'];
    const r = rng.fork(`slot:${g.cell.id}`);
    if (todo && !todo.length) break;
    if (!todo && !r.chance(chance)) continue;
    const idx = main.indexOf(g.cell.id);
    const entrance = onMain && idx > 0 ? openingTo(geo, g, main[idx - 1]!) : g.openings[0] ?? null;
    const exit = onMain && idx >= 0 && idx < main.length - 1 ? openingTo(geo, g, main[idx + 1]!) : g.openings.find((o) => o !== entrance) ?? null;
    const rect = g.cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
    const slot: GimmickSlot = { cell: g.cell, kind: g.kind, openings: g.openings, main: onMain, entrance, exit, rect, ...(showcase?.pick ? { showcase: true } : {}) };
    const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
    const fit = defs.filter((def) =>
      def.kinds.includes(g.kind) &&
      (!def.minSize || (Math.min(w, d) >= def.minSize[0] && Math.max(w, d) >= def.minSize[1])) &&
      (!def.minHeight || g.cell.height >= def.minHeight) &&
      (!def.minRarity || rarityRank(p.rarity) >= rarityRank(def.minRarity)) &&
      (def.onMainPath !== false || !onMain) &&
      (!def.physics || physicsUsed < t['gimmick.physicsMax']) &&
      (!def.requiresSecret || budget > 0) &&
      (!def.fits || def.fits(slot)) &&
      (!todo || todo.includes(def.id)));
    if (!fit.length) continue;
    // 見本: 残りの一覧の先頭から、この区画に置けるもの
    const weightOf = (x: GimmickDef): number => {
      let wt = gimmickWeight(x, t);
      if (x.offersSecret && budget > offers.length) wt *= t['gimmick.secretBoost'];
      wt *= t['gimmick.repeatMul'] ** result.gimmicks.filter((y) => y.def === x.id).length;
      if (onMain && prevMain) {
        if (x.axes.some((a) => prevMain!.axes.includes(a))) wt *= t['gimmick.sameAxisMul'];
        if (x.intensity >= 2 && prevMain.intensity >= 2) wt *= t['gimmick.intenseRunMul'];
      }
      return wt;
    };
    // 重みで引き、その部屋に組めなければ次の候補（部屋の形に合わせて作る大きな仕掛けは組めないことがあるので、部屋を空けない）
    const order: GimmickDef[] = [];
    if (todo) order.push(fit.sort((a, b) => todo.indexOf(a.id) - todo.indexOf(b.id))[0]!);
    else {
      const pool = fit.slice();
      for (let k = 0; k < t['gimmick.buildTries'] && pool.length; k++) { const x = r.weighted(pool, weightOf); order.push(x); pool.splice(pool.indexOf(x), 1); }
    }
    let def = order[0]!;
    let built: Built | null = null;
    // 段階 4（carry）: 手がかりを置ける別の区画（置く順が過ぎた区画など）
    const clue = (): ClueCell[] => clueCellsFor(geo, g, slots.slice(0, slots.indexOf(g)), result.gimmicks);
    for (const cand of order) { built = tryBuild(cand, slot, g, geo, r, t, p, depth, clue); if (built) { def = cand; break; } }
    if (!built) continue;
    // 隠しが無いと成り立たない仕掛けは、ここで隠しを付ける（付けられなければ仕掛けごと取り消す）
    const required = built.offers.filter((o) => o.required);
    // 隠しが無いと成り立たない仕掛けが、途中で組むのをやめて隠しの元を出さなかったときは取り消す
    if (def.requiresSecret && !required.length) { built.restore(); continue; }
    let ok = true;
    for (const o of required) {
      const sec = attach(g, o, modeOf(o), sr.fork(`req${index}`), Math.max(1, budget));
      if (!sec) { ok = false; result.attachFailures++; break; }
      result.secrets.push(sec);
      index++;
      budget--;
    }
    if (!ok) { built.restore(); continue; }
    keepOut.set(g.cell.id, [...(keepOut.get(g.cell.id) ?? []), ...built.keepOut]);
    for (const [c, a] of built.keepOutOther) keepOut.set(c, [...(keepOut.get(c) ?? []), a]);
    for (const c of built.noDress) result.noDress.add(c);
    for (const o of built.offers) if (!o.required) offers.push({ offer: o, host: g, gimmick: built.id });
    const placed = built.id;
    if (def.physics) physicsUsed++;
    if (onMain) prevMain = def;
    if (todo) todo.splice(todo.indexOf(def.id), 1);
    avoid.add(g.cell.id);
    result.gimmicks.push({ id: placed, def: def.id, cell: g.cell.id, main: onMain });
    const door = entrance ?? g.openings[0];
    if (door) result.tour.push({ label: def.name, cell: g.cell.id, ...standAt(door) });
  }

  // ⑤ 隠し（残りの数だけ、差し出された元から重みで選ぶ）
  const pool = offers.slice();
  while (budget > 0 && pool.length) {
    const pick = sr.weighted(pool, (x) => x.offer.weight);
    pool.splice(pool.indexOf(pick), 1);
    const s = attach(pick.host, pick.offer, modeOf(pick.offer), sr.fork(`s${index}`), budget);
    if (s) { result.secrets.push(s); index++; budget--; } else result.attachFailures++;
  }
  // 足りなければ、仕掛けとは別の元: 脇道・寄り道の部屋の暗がりの入口（存在型。近くの照明を外して暗くする）
  if (showcase) budget = Math.min(budget, 1);
  if (budget > 0) {
    const hosts = sr.shuffle(geo.cells.filter((g) => g.kind === 'room' && (g.cell.role === 'side' || g.cell.role === 'rest') && !result.gimmicks.some((x) => x.cell === g.cell.id) && !geo.reserved?.has(g.cell.id)));
    for (const g of hosts) {
      if (budget <= 0) break;
      const offer = darkCornerOffer(g, sr);
      if (!offer) continue;
      const s = attach(g, offer, 'present', sr.fork(`d${index}`), budget);
      if (!s) { result.attachFailures++; continue; }
      result.secrets.push(s);
      index++;
      budget--;
      if (g.openings[0]) result.tour.push({ label: '暗がりの隠し', cell: g.cell.id, ...standAt(g.openings[0]) });
      // 入口の近くの照明を外す（暗がり）
      const c = offer.doorway;
      const near = (x: number, z: number): boolean => (c.dir === 0 || c.dir === 2 ? Math.abs(x - c.at) < 2.2 : Math.abs(z - c.at) < 2.2);
      g.cell.lights = g.cell.lights.filter((l) => !near(l.pos[0], l.pos[2]));
      g.cell.boxes = g.cell.boxes.filter((b) => !(b.mat === g.cell.palette.light && !b.solid && near((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2)));
    }
  }
  return result;
}

interface Built { id: string; offers: SecretOffer[]; keepOut: AABB[]; restore(): void; /** 段階 4（carry）: 別の区画の家具を置かない範囲 */ keepOutOther: [string, AABB][]; /** 段階 4（warp）: 中身を置かない区画 */ noDress: string[] }

/**
 * 段階 4（carry）: 手がかりを置ける区画。置く順が過ぎて仕掛けの無い区画（before）・仕掛けを置かない区画（入口と出口の部屋・曲がり角）。
 * 後から仕掛けで作り変わらない所だけ。階段・隠し場所は除く。仕掛けの区画から開口をたどる数の少ない順
 */
function clueCellsFor(geo: FloorGeometry, host: GeoCell, before: readonly GeoCell[], placed: readonly PlacedGimmick[]): ClueCell[] {
  const busy = new Set(placed.map((x) => x.cell));
  const hops = new Map<string, number>([[host.cell.id, 0]]);
  const q = [host.cell.id];
  for (let h = 0; h < q.length; h++) for (const pt of geo.portals) {
    if (!pt.cells.includes(q[h]!)) continue;
    const o = pt.cells[0] === q[h] ? pt.cells[1] : pt.cells[0];
    if (!hops.has(o)) { hops.set(o, hops.get(q[h]!)! + 1); q.push(o); }
  }
  const earlier = new Set(before.map((x) => x.cell.id));
  const out: ClueCell[] = [];
  for (const c of geo.cells) {
    if (c === host || c.cell.role === 'secret' || c.kind === 'stairs' || c.kind === 'exit' || c.kind === 'secret' || busy.has(c.cell.id) || !hops.has(c.cell.id)) continue;
    const fixed = c.kind === 'junction' || c.cell.role === 'entry' || c.cell.role === 'exit';
    if (!fixed && !earlier.has(c.cell.id)) continue;
    out.push({ cell: c.cell, kind: c.kind, openings: c.openings, hops: hops.get(c.cell.id)! });
  }
  return out.sort((a, b) => a.hops - b.hops);
}

/** 暗がりの入口の元: 開口の無い壁の、入口から遠い端 */
function darkCornerOffer(g: GeoCell, rng: Rng): SecretOffer | null {
  const rect = g.cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
  const ent = g.openings[0];
  if (!ent) return null;
  const dirs = ([0, 1, 2, 3] as const).filter((d) => !g.openings.some((o) => o.dir === d));
  for (const d of rng.shuffle([...dirs])) {
    const [a0, a1] = d === 0 || d === 2 ? [rect.x0 + 0.9, rect.x1 - 0.9] : [rect.z0 + 0.9, rect.z1 - 0.9];
    if (a1 - a0 < 1.2) continue;
    const e = d === 0 || d === 2 ? ent.pos[0] : ent.pos[2];
    const at = Math.abs(a0 - e) > Math.abs(a1 - e) ? a0 + 0.1 : a1 - 0.1;
    return { hook: 'generic.darkCorner', modes: ['present'], weight: 0.5, doorway: { dir: d, at, y: g.cell.floorY, width: 0.9, height: 2.0 }, tell: '暗がり' };
  }
  return null;
}

/** 仕掛けを組む。区画の開口どうしが歩いてつながらなければ取り消して null */
function tryBuild(def: GimmickDef, slot: GimmickSlot, g: GeoCell, geo: FloorGeometry, rng: Rng, t: Tuning, p: FloorProfile, depth: number, clue?: () => ClueCell[]): Built | null {
  const id = `g:${def.id}:${g.cell.id}`;
  const snapshot = { boxes: g.cell.boxes.slice(), lights: g.cell.lights.map((l) => ({ ...l })), zones: g.cell.zones.slice(), entities: geo.entities.length, doors: JSON.stringify(geo.entities.filter((e) => e.type === 'door' && e.cell === g.cell.id)) };
  // 穴の仕掛けは区画の外形の下端を下げる（pit.ts の pitShell）ので、取り消すときに戻す
  const boundsMinY = g.cell.bounds.min[1];
  const myKeep: AABB[] = [];
  const myOffers: SecretOffer[] = [];
  const assist: Box[] = [];
  // 段階 4（carry）: 別の区画に足した箱（取り消しのときに戻す）と、その区画の家具を置かない範囲
  const touched = new Map<string, { g: GeoCell; boxes: Box[] }>();
  const keepOther: [string, AABB][] = [];
  const myNoDress: string[] = [];
  let added = 0;
  const ctx: GimmickContext = {
    slot, rng, tuning: t, id,
    floor: { id: p.id, seed: p.seed, depth, rarity: p.rarity, family: p.family.id, variant: p.key.variant },
    addBox(b) { g.cell.boxes.push(b); added++; return b; },
    addEntity(name, e) { const eid = `${id}.${name}`; geo.entities.push({ ...e, id: eid, cell: e.cell ?? g.cell.id } as EntitySpec); added++; return eid; },
    addZone(z: Zone) { g.cell.zones.push(z); },
    keepOut(a) { myKeep.push(a); },
    frontOf: (o, d = 1.0) => frontOf(o, d),
    offerSecret(o) { myOffers.push(o); },
    doorAt(o) {
      const c: [number, number] = [o.pos[0], o.pos[2]];
      return geo.entities.find((e) => e.type === 'door' && (() => { const pn = e.params.panel as { min: number[]; max: number[] }; return Math.hypot((pn.min[0]! + pn.max[0]!) / 2 - c[0], (pn.min[2]! + pn.max[2]!) / 2 - c[1]) < 0.5; })()) ?? null;
    },
    removeBoxes(pred) { g.cell.boxes = g.cell.boxes.filter((b) => !pred(b)); },
    reachAssist(b) { assist.push(b); },
    ...(clue ? {
      clueCells: clue,
      addToCell(cellId: string, b: Box): Box {
        const o = geo.cells.find((x) => x.cell.id === cellId);
        if (!o) throw new Error(`区画がありません: ${cellId}`);
        if (!touched.has(cellId)) touched.set(cellId, { g: o, boxes: o.cell.boxes.slice() });
        o.cell.boxes.push(b);
        added++;
        return b;
      },
      keepOutIn(cellId: string, a: AABB): void { keepOther.push([cellId, a]); },
    } : {}),
    addCell(cell, kind, ops) { geo.cells.push({ cell, kind, openings: ops, node: -1 }); added++; },
    addPortal(p) { geo.portals.push(p); },
    cells: () => geo.cells.map((c) => c.cell),
    noDress(cellId) { myNoDress.push(cellId ?? g.cell.id); },
  };
  // 仕掛けが足す区画・開口（warp）は、組む前の数まで戻す
  const cellsAtStart = geo.cells.length, portalsAtStart = geo.portals.length;
  def.build(ctx);
  const openingsBefore = g.openings.length;
  const portalsBefore = geo.portals.length;
  const cellsBefore = geo.cells.length;
  const exitsBefore = geo.exits.length;
  const restore = (): void => {
    g.cell.bounds.min[1] = boundsMinY;
    g.cell.boxes = snapshot.boxes;
    g.cell.lights = snapshot.lights;
    g.cell.zones = snapshot.zones;
    geo.entities.length = snapshot.entities;
    g.openings.length = openingsBefore;
    geo.portals.length = portalsBefore;
    geo.cells.length = cellsBefore;
    geo.cells.length = Math.min(geo.cells.length, cellsAtStart);
    geo.portals.length = Math.min(geo.portals.length, portalsAtStart);
    geo.exits.length = exitsBefore;
    const doors = JSON.parse(snapshot.doors) as EntitySpec[];
    for (const d of doors) { const e = geo.entities.find((x) => x.id === d.id); if (e) { e.params = d.params; if (d.inputs) e.inputs = d.inputs; else delete e.inputs; } }
    for (const x of touched.values()) x.g.cell.boxes = x.boxes;
  };
  if (!added) { restore(); return null; }
  // 段階 4（フロアの形）: 下に別の階の区画がある区画では、床の下に掘れる深さより深く掘る仕掛け（穴・溝）は置かない
  const free = geo.belowFree?.get(g.cell.id);
  if (free !== undefined && g.cell.boxes.some((b) => b.min[1] < g.cell.floorY - Math.max(0.2, free - 0.05))) { restore(); return null; }
  // 閉じ込めない: 開口どうしが歩いてつながる（部品が作る床は reachAssist で足す）
  if (g.openings.length >= 2) {
    const reach = reachOpenings({ footprint: g.cell.footprint, floorY: g.cell.floorY, boxes: assist.length ? [...g.cell.boxes, ...assist] : g.cell.boxes }, g.openings, 0.1);
    if (reach && reach.blocked.length) { restore(); return null; }
  }
  // 段階 4（carry）: 手がかりを足した別の区画も、開口どうしが歩いてつながる（足す前より届かない開口が増えない）
  for (const x of touched.values()) {
    if (x.g.openings.length < 2) continue;
    const after = reachOpenings(x.g.cell, x.g.openings, 0.1)?.blocked.length ?? 0;
    if (!after) continue;
    const before = reachOpenings({ ...x.g.cell, boxes: x.boxes }, x.g.openings, 0.1)?.blocked.length ?? 0;
    if (after > before) { restore(); return null; }
  }
  return { id, offers: myOffers, keepOut: myKeep, restore, keepOutOther: keepOther, noDress: myNoDress };
}
