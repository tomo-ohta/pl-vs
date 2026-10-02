/**
 * 試験用: 生成したフロアから、ある仕掛けの部屋を集める。入口（仕掛けの区画の入口 = 見て回る位置の開口）と出口の開口を添える。
 * - 入口: 見て回る位置（tour。入口のすぐ外で中を向いて立つ）にいちばん近い開口
 * - 出口: 本道の上なら次の区画への開口、そうでなければ入口から遠い開口
 */
import { defaultTuning, type Tuning } from '../../core/config/tuning.ts';
import { dressCell } from '../../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../../core/gen/floor/index.ts';
import type { Vec3 } from '../../core/math/vec.ts';
import type { CellLayout, FloorLayout, PortalSpec } from '../../core/world/layout.ts';

export interface GimmickRoom {
  /** フロアの鍵（同じ鍵で作り直せる） */
  key: { world: number; depth: number; variant: number };
  r: GenReport;
  floor: FloorLayout;
  cell: CellLayout;
  id: string;
  main: boolean;
  /** 入口のすぐ外（隣の区画）に立つ位置と向き */
  outside: Vec3;
  yaw: number;
  /** 入口の開口と、その内側 1.0 m の点（入口の固い床・升目） */
  entry: PortalSpec;
  inside: Vec3;
  exit: PortalSpec | null;
  /** 出口の向こうの区画 */
  beyond: string | null;
}

export const portalCenter = (p: PortalSpec): Vec3 => [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2];

/** 開口 p の、区画 cell の内側へ d m の点 */
export function intoCell(p: PortalSpec, cell: CellLayout, d: number): Vec3 {
  const c = portalCenter(p);
  const cx = (cell.bounds.min[0] + cell.bounds.max[0]) / 2, cz = (cell.bounds.min[2] + cell.bounds.max[2]) / 2;
  if (p.dir % 2 === 1) return [c[0] + Math.sign(cx - c[0]) * d, cell.floorY, c[2]];
  return [c[0], cell.floorY, c[2] + Math.sign(cz - c[2]) * d];
}

function mainCells(floor: FloorLayout): string[] {
  const prev = new Map<string, string | null>([[floor.spawn.cell, null]]);
  const q = [floor.spawn.cell];
  for (let h = 0; h < q.length && !prev.has('exitStairs'); h++) for (const p of floor.portals) {
    if (!p.cells.includes(q[h]!)) continue;
    const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
    if (!prev.has(o)) { prev.set(o, q[h]!); q.push(o); }
  }
  const out: string[] = [];
  for (let c: string | null | undefined = 'exitStairs'; c; c = prev.get(c)) out.unshift(c);
  return out;
}

export function findRooms(def: string, want: number, o: { maxWorld?: number; dress?: boolean; t?: Tuning; from?: number } = {}): GimmickRoom[] {
  const t = o.t ?? defaultTuning();
  const out: GimmickRoom[] = [];
  for (let w = o.from ?? 1; w <= (o.maxWorld ?? 400) && out.length < want; w++) {
    const key = { world: w, depth: 1 + (w % 9), variant: w % 3 === 0 ? 1 : 0 };
    const r = generateFloorReport(key, t, o.dress === false ? {} : { dress: dressCell });
    const main = mainCells(r.floor);
    for (const g of r.gimmicks?.gimmicks ?? []) {
      if (g.def !== def || out.length >= want) continue;
      const cell = r.floor.cells.find((c) => c.id === g.cell)!;
      const stop = r.gimmicks!.tour.find((s) => s.cell === g.cell)!;
      const portals = r.floor.portals.filter((p) => p.cells.includes(g.cell) && !p.cells.some((c) => c.startsWith('secret')));
      const d = (p: PortalSpec): number => { const c = portalCenter(p); return Math.hypot(c[0] - stop.pos[0], c[2] - stop.pos[2]); };
      const entry = portals.slice().sort((a, b) => d(a) - d(b))[0]!;
      const idx = main.indexOf(g.cell);
      let exit: PortalSpec | null = null;
      if (g.main && idx >= 0 && idx + 1 < main.length) exit = portals.find((p) => p.cells.includes(main[idx + 1]!)) ?? null;
      exit ??= portals.filter((p) => p !== entry).sort((a, b) => d(b) - d(a))[0] ?? null;
      const other = (p: PortalSpec | null): string | null => (p ? (p.cells[0] === g.cell ? p.cells[1] : p.cells[0]) : null);
      out.push({ key, r, floor: r.floor, cell, id: g.id, main: g.main, outside: stop.pos, yaw: stop.yaw, entry, inside: intoCell(entry, cell, 1.0), exit, beyond: other(exit) });
    }
  }
  return out;
}

/** 同じ鍵・同じ作り方でフロアを作り直す（決定的かを見る） */
export function regenerate(room: GimmickRoom, o: { dress?: boolean; t?: Tuning } = {}): FloorLayout {
  return generateFloorReport(room.key, o.t ?? defaultTuning(), o.dress === false ? {} : { dress: dressCell }).floor;
}
