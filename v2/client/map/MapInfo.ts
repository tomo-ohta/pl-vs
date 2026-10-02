/**
 * 地図の元になる情報: フロアの形（FloorLayout の区画の足跡・開口・高さ・扉・出口）と、地図の部品（core/sim/parts/map）から作る。
 * 純粋な TypeScript（DOM・three を使わない）。Node の試験でそのまま使える。
 *
 * - 区画（MapCell）: 足跡（調査の升目・現在地の判定）と、地図に描く形（CellLayout.map.apparent があればそれ）
 * - 高さの層（layer）: 上下に重なる区画（中二階・立体交差）を別の層に分ける。重なる下の区画より map.layer.riseM 以上高ければ
 *   その上の層。同じ高さで開口でつながる区画は同じ層（上の階の廊下が中二階と同じ層になる）。重ならない段差（1.6 m の段違い）は同じ層
 * - 地図に記録されない区画（hidden）: CellLayout.map.hidden か、区画に mapFx（fx: 'hide'）の部品がある（N08）
 * - 地図の空白（blanks）: 測量図（mapBoard の mode 'survey'・blank）のある区画の壁の向こうの隠し場所の足跡（BX04）
 * - 調査の升目（tiles）: 区画の床を map.survey.tileM の升目に分けた中心と面積。隠し場所・記録されない区画・出口の階段は数えない
 */
import type { Tuning } from '../../core/config/tuning.ts';
import type { AABB } from '../../core/math/aabb.ts';
import type { Dir } from '../../core/math/vec.ts';
import type { Rect } from '../../core/world/footprint.ts';
import { WALL_T, type CellLayout, type CellRole, type EntitySpec, type FloorLayout, type Json } from '../../core/world/layout.ts';

export type MapCellKind = 'room' | 'hall' | 'corridor' | 'stairs' | 'entry' | 'exit' | 'secret';

export interface MapCell {
  id: string;
  role: CellRole;
  kind: MapCellKind;
  /** 本当の足跡（調査の升目・現在地の判定） */
  rects: Rect[];
  /** 地図に描く足跡（apparent があればそれ。無ければ rects） */
  shape: Rect[];
  bounds: AABB;
  floorY: number;
  height: number;
  /** 高さの層（0 が下） */
  layer: number;
  /** 地図に記録されない（N08） */
  hidden: boolean;
  /** 調査率に数える */
  counted: boolean;
  /** 地図に添える名前 */
  label?: string;
  /** 区画の名前（図鑑のレア部屋の判定に使う） */
  name?: string;
}

export interface MapPortal {
  id: string;
  cells: [string, string];
  /** 開口の床の真ん中 */
  x: number;
  y: number;
  z: number;
  dir: Dir;
  kind: 'opening' | 'door' | 'window' | 'hole';
  width: number;
  doorId?: string;
  /** 出現型の隠しの壁の組（現れるまで向こうが見えない） */
  conceal?: string;
  /** 隠し場所への開口（どちらかが隠し場所） */
  secret: boolean;
}

export interface MapExit { id: string; kind: string; x: number; y: number; z: number; cell: string | null }

export type MapFxKind = 'erase' | 'rotate' | 'hide';
export interface MapFxInfo { id: string; cell: string; fx: MapFxKind; params: { [k: string]: Json } }
export interface MapLandmark { id: string; cell: string; x: number; y: number; z: number; name: string }
/** 調べると読める地図（壁の案内図・現在地の看板・測量図・落ちている誰かの地図） */
export interface MapReadable { id: string; cell: string; type: 'mapBoard' | 'mapNote'; mode: string; params: { [k: string]: Json } }

export interface SurveyTiles {
  cell: string;
  /** 升目の中心と大きさ・面積 */
  xs: number[];
  zs: number[];
  ws: number[];
  ds: number[];
  area: number[];
  total: number;
}

export interface MapInfo {
  floorId: string;
  /** 保存の鍵（フロア・生成器・調整表の版。どれかが変わると別のフロアとして扱う） */
  key: string;
  cells: MapCell[];
  byId: Map<string, MapCell>;
  portals: MapPortal[];
  /** 区画 → その区画の開口 */
  byCell: Map<string, MapPortal[]>;
  exits: MapExit[];
  layers: number;
  /** 層ごとの代表の床の高さ（層の名前に使う） */
  layerY: number[];
  /** 全部の区画の外形 */
  bounds: Rect;
  fx: MapFxInfo[];
  landmarks: MapLandmark[];
  readables: MapReadable[];
  /** 地図の空白: 空白を描く区画（測量図のある区画）→ 壁の向こうの隠し場所の区画と足跡 */
  blanks: Map<string, { cells: string[]; rects: Rect[] }>;
  tiles: Map<string, SurveyTiles>;
  /** 調査率に数える升目の面積の合計 */
  surveyArea: number;
  spawn: { x: number; z: number; cell: string };
}

const kindOf = (c: CellLayout): MapCellKind => {
  if (c.role === 'secret') return 'secret';
  if (c.role === 'entry') return c.name?.includes('階段') ? 'stairs' : 'entry';
  if (c.role === 'exit') return c.name?.includes('階段') ? 'stairs' : 'exit';
  if (c.role === 'hub') return 'hall';
  if (c.role === 'connector') return c.name?.includes('階段') ? 'stairs' : 'corridor';
  return 'room';
};

const overlapXZ = (a: Rect[], b: Rect[], eps = 0.1): boolean =>
  a.some((p) => b.some((q) => p.x0 < q.x1 - eps && p.x1 > q.x0 + eps && p.z0 < q.z1 - eps && p.z1 > q.z0 + eps));

/** 高さの層を決める（MapInfo の説明のとおり）。戻り値は区画の並びの順の層の番号（0 から詰めた番号） */
export function computeLayers(cells: readonly CellLayout[], portals: readonly { cells: [string, string] }[], riseM: number): number[] {
  const n = cells.length;
  const idx = new Map(cells.map((c, i) => [c.id, i]));
  const layer = new Array<number>(n).fill(0);
  const isSecret = (i: number): boolean => cells[i]!.role === 'secret';
  const order = [...Array(n).keys()].filter((i) => !isSecret(i)).sort((a, b) => cells[a]!.floorY - cells[b]!.floorY);
  const adj: number[][] = cells.map(() => []);
  for (const p of portals) {
    const a = idx.get(p.cells[0]), b = idx.get(p.cells[1]);
    if (a === undefined || b === undefined) continue;
    adj[a]!.push(b);
    adj[b]!.push(a);
  }
  for (let round = 0; round < 8; round++) {
    let changed = false;
    // 重なる下の区画より高ければ、その上の層
    for (const i of order) {
      for (const j of order) {
        if (i === j || cells[j]!.floorY + riseM > cells[i]!.floorY) continue;
        if (!overlapXZ(cells[i]!.footprint, cells[j]!.footprint)) continue;
        if (layer[i]! < layer[j]! + 1) { layer[i] = layer[j]! + 1; changed = true; }
      }
    }
    // 同じ高さで開口でつながる区画は同じ層
    for (const i of order) {
      for (const j of adj[i]!) {
        if (isSecret(j) || Math.abs(cells[i]!.floorY - cells[j]!.floorY) > 0.3) continue;
        const m = Math.max(layer[i]!, layer[j]!);
        if (layer[i] !== m || layer[j] !== m) { layer[i] = m; layer[j] = m; changed = true; }
      }
    }
    if (!changed) break;
  }
  // 隠し場所は、つながる区画の層（つながりをたどる）
  for (let round = 0; round < n; round++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (!isSecret(i)) continue;
      const m = adj[i]!.reduce((a, j) => Math.max(a, layer[j]!), 0);
      if (m > layer[i]!) { layer[i] = m; changed = true; }
    }
    if (!changed) break;
  }
  const used = [...new Set(layer)].sort((a, b) => a - b);
  return layer.map((l) => used.indexOf(l));
}

/** 足跡の床（壁の内側）を升目に分ける */
function tilesOf(id: string, rects: readonly Rect[], tileM: number): SurveyTiles {
  const out: SurveyTiles = { cell: id, xs: [], zs: [], ws: [], ds: [], area: [], total: 0 };
  for (const r0 of rects) {
    const r = { x0: r0.x0 + WALL_T, z0: r0.z0 + WALL_T, x1: r0.x1 - WALL_T, z1: r0.z1 - WALL_T };
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    if (w <= 0.05 || d <= 0.05) continue;
    const nx = Math.max(1, Math.round(w / tileM)), nz = Math.max(1, Math.round(d / tileM));
    const a = (w / nx) * (d / nz);
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        out.xs.push(r.x0 + ((i + 0.5) * w) / nx);
        out.zs.push(r.z0 + ((k + 0.5) * d) / nz);
        out.ws.push(w / nx);
        out.ds.push(d / nz);
        out.area.push(a);
        out.total += a;
      }
    }
  }
  return out;
}

const rectsOf = (v: Json | undefined): Rect[] | null => {
  if (!Array.isArray(v)) return null;
  const out: Rect[] = [];
  for (const x of v) {
    const o = x as { [k: string]: Json };
    if (o && typeof o.x0 === 'number' && typeof o.z0 === 'number' && typeof o.x1 === 'number' && typeof o.z1 === 'number') out.push({ x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1 });
  }
  return out;
};

export function buildMapInfo(floor: FloorLayout, t: Tuning): MapInfo {
  const ents = floor.entities;
  const inCell = (type: string): EntitySpec[] => ents.filter((e) => e.type === type && e.cell);
  const fx: MapFxInfo[] = inCell('mapFx').map((e) => ({ id: e.id, cell: e.cell!, fx: (e.params.fx === 'rotate' ? 'rotate' : e.params.fx === 'hide' ? 'hide' : 'erase') as MapFxKind, params: e.params }));
  const hideCells = new Set(fx.filter((f) => f.fx === 'hide').map((f) => f.cell));
  const exits: MapExit[] = floor.exits.map((x) => ({ id: x.id, kind: x.kind, x: (x.aabb.min[0] + x.aabb.max[0]) / 2, y: x.aabb.min[1], z: (x.aabb.min[2] + x.aabb.max[2]) / 2, cell: null }));
  const layers = computeLayers(floor.cells, floor.portals, t['map.layer.riseM']);
  const cells: MapCell[] = floor.cells.map((c, i) => {
    const kind = kindOf(c);
    const hidden = !!c.map?.hidden || hideCells.has(c.id);
    const hasExit = floor.exits.some((x) => {
      const cx = (x.aabb.min[0] + x.aabb.max[0]) / 2, cz = (x.aabb.min[2] + x.aabb.max[2]) / 2;
      return cx >= c.bounds.min[0] && cx <= c.bounds.max[0] && cz >= c.bounds.min[2] && cz <= c.bounds.max[2] && x.aabb.max[1] >= c.bounds.min[1] - 7 && x.aabb.min[1] <= c.bounds.max[1];
    });
    const mc: MapCell = {
      id: c.id, role: c.role, kind, rects: c.footprint.map((r) => ({ ...r })), shape: (c.map?.apparent ?? c.footprint).map((r) => ({ ...r })),
      bounds: { min: [...c.bounds.min], max: [...c.bounds.max] }, floorY: c.floorY, height: c.height, layer: layers[i] ?? 0,
      hidden, counted: kind !== 'secret' && !hidden && !hasExit,
    };
    if (c.map?.label) mc.label = c.map.label;
    if (c.name) mc.name = c.name;
    return mc;
  });
  const byId = new Map(cells.map((c) => [c.id, c]));
  for (const x of exits) x.cell = cellAtPos({ cells } as Pick<MapInfo, 'cells'>, [x.x, x.y + 0.5, x.z])?.id ?? null;
  const portals: MapPortal[] = floor.portals.map((p) => {
    const a = p.aabb;
    const mp: MapPortal = {
      id: p.id, cells: [p.cells[0], p.cells[1]], x: (a.min[0] + a.max[0]) / 2, y: a.min[1], z: (a.min[2] + a.max[2]) / 2, dir: p.dir, kind: p.kind,
      width: p.dir === 0 || p.dir === 2 ? a.max[0] - a.min[0] : a.max[2] - a.min[2],
      secret: p.cells.some((id) => byId.get(id)?.kind === 'secret'),
    };
    if (p.doorId) mp.doorId = p.doorId;
    for (const cell of floor.cells) {
      if (!p.cells.includes(cell.id)) continue;
      for (const b of cell.boxes) {
        if (!b.concealGroup) continue;
        if (b.min[0] < a.max[0] && b.max[0] > a.min[0] && b.min[1] < a.max[1] && b.max[1] > a.min[1] && b.min[2] < a.max[2] && b.max[2] > a.min[2]) mp.conceal = b.concealGroup;
      }
    }
    return mp;
  });
  const byCell = new Map<string, MapPortal[]>();
  for (const p of portals) for (const c of p.cells) byCell.set(c, [...(byCell.get(c) ?? []), p]);
  const readables: MapReadable[] = ents.filter((e) => (e.type === 'mapBoard' || e.type === 'mapNote') && e.cell).map((e) => ({ id: e.id, cell: e.cell!, type: e.type as 'mapBoard' | 'mapNote', mode: typeof e.params.mode === 'string' ? e.params.mode : e.type === 'mapNote' ? 'note' : 'guide', params: e.params }));
  const landmarks: MapLandmark[] = inCell('landmark').map((e) => {
    const p = Array.isArray(e.params.pos) ? (e.params.pos as number[]) : [0, 0, 0];
    return { id: e.id, cell: e.cell!, x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0, name: typeof e.params.name === 'string' ? e.params.name : '塔' };
  });
  // 地図の空白: 測量図（blank）のある区画から、隠し場所の区画をたどる
  const blanks = new Map<string, { cells: string[]; rects: Rect[] }>();
  for (const r of readables) {
    if (r.mode !== 'survey' || r.params.blank !== true) continue;
    const seen = new Set<string>([r.cell]);
    const q = [r.cell];
    const out: Rect[] = [];
    const ids: string[] = [];
    for (let h = 0; h < q.length; h++) {
      for (const p of byCell.get(q[h]!) ?? []) {
        const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
        const oc = byId.get(o);
        if (!oc || seen.has(o) || oc.kind !== 'secret') continue;
        seen.add(o);
        q.push(o);
        ids.push(o);
        out.push(...oc.rects.map((x) => ({ ...x })));
      }
    }
    if (out.length) blanks.set(r.cell, { cells: ids, rects: out });
  }
  const tiles = new Map<string, SurveyTiles>();
  let surveyArea = 0;
  for (const c of cells) {
    if (!c.counted) continue;
    const tl = tilesOf(c.id, c.rects, t['map.survey.tileM']);
    if (tl.total <= 0) { c.counted = false; continue; }
    tiles.set(c.id, tl);
    surveyArea += tl.total;
  }
  const layerY: number[] = [];
  const nLayers = cells.reduce((a, c) => Math.max(a, c.layer + 1), 1);
  for (let l = 0; l < nLayers; l++) {
    const ys = cells.filter((c) => c.layer === l && c.kind !== 'secret').map((c) => c.floorY).sort((a, b) => a - b);
    layerY.push(ys.length ? ys[Math.floor(ys.length / 2)]! : 0);
  }
  const all = cells.flatMap((c) => c.rects);
  const bounds = all.length ? { x0: Math.min(...all.map((r) => r.x0)), z0: Math.min(...all.map((r) => r.z0)), x1: Math.max(...all.map((r) => r.x1)), z1: Math.max(...all.map((r) => r.z1)) } : { x0: 0, z0: 0, x1: 1, z1: 1 };
  return {
    floorId: floor.id, key: `${floor.seed}:${floor.id}:${floor.genVersion}:${floor.tuningVersion}`,
    cells, byId, portals, byCell, exits, layers: nLayers, layerY, bounds, fx, landmarks, readables, blanks, tiles, surveyArea,
    spawn: { x: floor.spawn.pos[0], z: floor.spawn.pos[2], cell: floor.spawn.cell },
  };
}

/** 点 pos のいる区画（区画の外形の中。重なるときは小さい区画。client/world/FloorBuilder.ts の cellAt と同じ決め方） */
export function cellAtPos(info: Pick<MapInfo, 'cells'>, pos: readonly [number, number, number]): MapCell | null {
  let best: MapCell | null = null;
  let bestA = Infinity;
  for (const c of info.cells) {
    const b = c.bounds;
    if (pos[0] < b.min[0] || pos[0] > b.max[0] || pos[2] < b.min[2] || pos[2] > b.max[2] || pos[1] < b.min[1] - 3.2 || pos[1] > b.max[1] + 0.5) continue;
    const a = (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);
    // 重なるときは足跡の中にいる方、同じなら小さい方
    const inside = c.rects.some((r) => pos[0] >= r.x0 && pos[0] <= r.x1 && pos[2] >= r.z0 && pos[2] <= r.z1);
    const score = inside ? a : a + 1e6;
    if (score < bestA) { best = c; bestA = score; }
  }
  return best;
}

/** 区画の足跡の外接矩形 */
export function rectsBounds(rects: readonly Rect[]): Rect {
  return { x0: Math.min(...rects.map((r) => r.x0)), z0: Math.min(...rects.map((r) => r.z0)), x1: Math.max(...rects.map((r) => r.x1)), z1: Math.max(...rects.map((r) => r.z1)) };
}

export { rectsOf };
