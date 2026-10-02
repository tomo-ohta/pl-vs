/**
 * 描く物（draw.ts の DrawInput）を作る:
 * - sceneOfMap: 自分の地図（FloorMap）から。小さな地図・メニューの地図
 * - sceneOfReadable: 壁の地図・落ちている誰かの地図（部品の params）から。壁の板の絵・読んだときの写し（ghostOf）
 *
 * 壁の地図の params（core/gen/gimmicks/map/signs.ts・blank.ts が作る）:
 *   guide（入口の案内図 N07）: cells（描く区画）・here（本当の現在地）・exit（出口）・lie（嘘: 'secret' 隠し場所に部屋を描く /
 *     'exit' 出口の印を別の所に / 'phantom' 無い廊下を描く / 'missing' ある廊下を描かない）
 *   here（現在地の看板 N04）: cells・here（現在地の印。自分のいない場所）
 *   survey（測量図 BX04）: cells・here（机の位置）・blank（壁の向こうの隠し場所を空白として描く）
 *   note（誰かの地図 N09）: cells（誰かが描いた区画）・marks（書き込み）・trail（誰かの歩いた跡）・author・date
 */
import type { Rect } from '../../core/world/footprint.ts';
import type { Json } from '../../core/world/layout.ts';
import type { DrawCell, DrawDoor, DrawGhost, DrawInput, DrawMark } from './draw.ts';
import { rectsOf, type MapInfo, type MapReadable } from './MapInfo.ts';
import type { FloorMap, Ghost, GhostMark } from './MapModel.ts';

export const GHOST_COLORS: Record<Ghost['source'], string> = { guide: 'rgba(127,176,255,0.75)', here: 'rgba(255,150,130,0.75)', note: 'rgba(255,96,80,0.85)' };

const unionRects = (list: Rect[]): Rect | null => {
  if (!list.length) return null;
  return { x0: Math.min(...list.map((r) => r.x0)), z0: Math.min(...list.map((r) => r.z0)), x1: Math.max(...list.map((r) => r.x1)), z1: Math.max(...list.map((r) => r.z1)) };
};

export interface MapSceneOptions {
  /** 描く層（無ければ今いる層） */
  layer?: number;
  player?: { x: number; z: number; yaw: number } | null;
  /** 扉の開き具合（開いている扉を黄色に） */
  doorAngle?: (id: string) => number;
  /** 写しを描く */
  ghosts?: boolean;
}

/** 自分の地図の描く物 */
export function sceneOfMap(map: FloorMap, o: MapSceneOptions = {}): DrawInput {
  const info = map.info;
  const cur = map.current ? info.byId.get(map.current) : undefined;
  const layer = o.layer ?? cur?.layer ?? 0;
  const cells: DrawCell[] = [];
  const fitRects: Rect[] = [];
  for (const c of info.cells) {
    const erasing = map.erasing.get(c.id);
    if (c.hidden) {
      if (map.current === c.id) cells.push({ id: c.id, rects: c.shape, state: 'hidden', kind: c.kind });
      continue;
    }
    if (erasing !== undefined && map.erased.has(c.id)) {
      const a = 1 - (map.time - erasing) / 1.4;
      if (a > 0 && c.layer === layer) cells.push({ id: c.id, rects: c.shape, state: 'erasing', alpha: a * (0.6 + 0.4 * Math.abs(Math.sin(map.time * 37 + c.id.length))), kind: c.kind });
      continue;
    }
    if (!map.drawn(c.id)) continue;
    if (c.layer !== layer) {
      cells.push({ id: c.id, rects: c.shape, state: 'other', alpha: 0.3, kind: c.kind });
      continue;
    }
    const state: DrawCell['state'] = map.current === c.id ? 'current' : c.kind === 'secret' ? 'secret' : map.visited.has(c.id) ? 'visited' : 'seen';
    const dc: DrawCell = { id: c.id, rects: c.shape, state, kind: c.kind };
    // 入った区画の、調べていない升目（地図が見かけの形のときは描かない）
    const tl = info.tiles.get(c.id), bits = map.tiles.get(c.id);
    if (tl && bits && map.visited.has(c.id) && sameRects(c.shape, c.rects)) {
      const un: NonNullable<DrawCell['unsurveyed']> = [];
      for (let i = 0; i < bits.length; i++) if (!bits[i]) un.push({ x: tl.xs[i]!, z: tl.zs[i]!, w: tl.ws[i]!, d: tl.ds[i]! });
      if (un.length) dc.unsurveyed = un;
    }
    cells.push(dc);
    fitRects.push(...c.shape);
  }
  // 空白（BX04）: 空白のある区画が描かれていて、隠し場所にまだ入っていない
  const blanks: Rect[][] = [];
  for (const [host, b] of info.blanks) {
    if (!map.drawn(host) || b.cells.some((id) => map.visited.has(id))) continue;
    if (info.byId.get(host)?.layer !== layer) continue;
    blanks.push(b.rects);
  }
  // 開口・扉（隠し場所への開口は、隠し場所を見つけてから）
  const doors: DrawDoor[] = [];
  for (const p of info.portals) {
    const a = info.byId.get(p.cells[0]), b = info.byId.get(p.cells[1]);
    if (!a || !b) continue;
    const da = map.drawn(a.id) && a.layer === layer, db = map.drawn(b.id) && b.layer === layer;
    if (!da && !db) continue;
    if (p.secret && !(map.drawn(a.kind === 'secret' ? a.id : b.id))) continue;
    const open = p.doorId && o.doorAngle ? o.doorAngle(p.doorId) > 0.3 : false;
    doors.push({ x: p.x, z: p.z, dir: p.dir, width: p.width, kind: p.secret ? 'secret' : p.kind === 'opening' ? 'opening' : open ? 'open' : 'door' });
  }
  const marks: DrawMark[] = [];
  for (const x of info.exits) if (x.cell && map.drawn(x.cell) && info.byId.get(x.cell)?.layer === layer) marks.push({ x: x.x, z: x.z, kind: 'exit' });
  for (const l of info.landmarks) if (map.drawn(l.cell)) marks.push({ x: l.x, z: l.z, kind: 'landmark', text: l.name });
  const ghosts: DrawGhost[] = [];
  if (o.ghosts !== false) {
    for (const g of map.ghosts) {
      if (g.layer !== undefined && g.layer !== layer) continue;
      ghosts.push({ rects: g.cells, marks: g.marks.map((m) => ({ x: m.x, z: m.z, kind: m.kind, text: m.text })), trail: g.trail, color: GHOST_COLORS[g.source] });
      fitRects.push(...g.cells.flat());
    }
  }
  const trail: number[] = [];
  for (let i = 0; i + 2 < map.trail.length; i += 3) if (map.trail[i + 2] === layer) trail.push(map.trail[i]! / 10, map.trail[i + 1]! / 10);
  return { cells, blanks, ghosts, doors, marks, trail, player: o.player ?? null, bounds: unionRects(fitRects) };
}

function sameRects(a: readonly Rect[], b: readonly Rect[]): boolean {
  return a.length === b.length && a.every((r, i) => r.x0 === b[i]!.x0 && r.z0 === b[i]!.z0 && r.x1 === b[i]!.x1 && r.z1 === b[i]!.z1);
}

// ---------------------------------------------------------------- 壁の地図・誰かの地図
const strs = (v: Json | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const xz = (v: Json | undefined): [number, number] | null => (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' ? [v[0], v[1]] : null);
const nums = (v: Json | undefined): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);

export interface ReadableContent {
  /** 区画ごとの形 */
  cells: Rect[][];
  /** 描く区画の id（嘘の区画は含まない） */
  ids: string[];
  marks: GhostMark[];
  trail: number[];
  blanks: Rect[][];
  title: string;
  author?: string;
  date?: string;
}

/** 壁の地図・誰かの地図の中身（嘘を含めて、描かれているとおり） */
export function readableContent(info: MapInfo, r: MapReadable): ReadableContent {
  const p = r.params;
  const lie = (p.lie && typeof p.lie === 'object' && !Array.isArray(p.lie) ? p.lie : {}) as { [k: string]: Json };
  const lieKind = typeof lie.kind === 'string' ? lie.kind : '';
  let ids = strs(p.cells).filter((id) => info.byId.has(id) && !info.byId.get(id)!.hidden);
  if (lieKind === 'missing') { const miss = new Set(strs(lie.cells)); ids = ids.filter((id) => !miss.has(id)); }
  const cells = ids.map((id) => info.byId.get(id)!.shape);
  if (lieKind === 'secret') for (const id of strs(lie.cells)) { const c = info.byId.get(id); if (c) cells.push(c.rects); }
  if (lieKind === 'phantom') { const rs = rectsOf(lie.rects); if (rs) for (const x of rs) cells.push([x]); }
  const marks: GhostMark[] = [];
  const here = xz(p.here);
  const exit = lieKind === 'exit' ? xz(lie.exit) : xz(p.exit);
  if (here && r.mode !== 'note') marks.push({ x: here[0], z: here[1], kind: 'here', text: '現在地' });
  if (exit) marks.push({ x: exit[0], z: exit[1], kind: 'exit', text: '出口' });
  if (Array.isArray(p.marks)) {
    for (const m of p.marks) {
      const o = m as { [k: string]: Json };
      if (o && typeof o.x === 'number' && typeof o.z === 'number') marks.push({ x: o.x, z: o.z, text: typeof o.text === 'string' ? o.text : '', kind: o.kind === 'x' || o.kind === 'exit' ? o.kind : 'note' });
    }
  }
  const blanks: Rect[][] = [];
  if (r.mode === 'survey' && p.blank === true) { const b = info.blanks.get(r.cell); if (b) blanks.push(b.rects); }
  const title = r.mode === 'guide' ? 'フロア案内図' : r.mode === 'here' ? '現在地' : r.mode === 'survey' ? '測量図' : '誰かの地図';
  const out: ReadableContent = { cells, ids, marks, trail: nums(p.trail), blanks, title };
  if (typeof p.author === 'string') out.author = p.author;
  if (typeof p.date === 'string') out.date = p.date;
  return out;
}

/** 壁の地図の板の絵（印刷の地図。誰かの地図は鉛筆の紙） */
export function sceneOfReadable(info: MapInfo, r: MapReadable): DrawInput {
  const c = readableContent(info, r);
  const cells: DrawCell[] = c.cells.map((rects, i) => ({ id: c.ids[i] ?? `x${i}`, rects, state: 'plain' }));
  const all = [...c.cells.flat(), ...c.blanks.flat()];
  return {
    cells, blanks: c.blanks, ghosts: [], doors: [], marks: c.marks.map((m) => ({ x: m.x, z: m.z, kind: m.kind, text: m.text })),
    trail: [], player: null, bounds: unionRects(all),
    ...(c.trail.length ? { ghosts: [{ rects: [], marks: [], trail: c.trail, color: 'rgba(170,40,30,0.7)' }] } : {}),
  };
}

/** 読んだときに自分の地図に入る写し。現在地の印は「現在地？」（看板の嘘ごと写す）・案内図の現在地は写さない */
export function ghostOf(info: MapInfo, r: MapReadable): Ghost {
  const c = readableContent(info, r);
  const source: Ghost['source'] = r.mode === 'note' ? 'note' : r.mode === 'guide' ? 'guide' : 'here';
  const marks = c.marks.filter((m) => !(m.kind === 'here' && r.mode !== 'here')).map((m) => (m.kind === 'here' ? { ...m, text: '現在地？' } : m));
  const g: Ghost = { source, id: r.id, cells: c.cells, marks, trail: c.trail };
  if (c.author) g.author = c.author;
  return g;
}
