/**
 * 試験用の仕掛けの実験室: 1 部屋だけのフロアを作り、入口・出口の向きと位置を決めて仕掛けを組む（生成の偶然に頼らず、
 * 入口の向き 4 つ・出口の向き・部屋の大きさを全部試すため）。組み方は core/gen/floor/gimmicks.ts の tryBuild と同じ道具を渡す。
 */
import { defaultTuning, type Tuning } from '../../core/config/tuning.ts';
import '../../core/gen/gimmicks/index.ts';
import { gimmickDef, type GimmickContext, type GimmickSlot, type SecretOffer } from '../../core/gen/gimmicks/types.ts';
import { frontOf } from '../../core/gen/gimmicks/util.ts';
import type { AABB } from '../../core/math/aabb.ts';
import { Rng } from '../../core/math/rng.ts';
import type { Dir, Vec3 } from '../../core/math/vec.ts';
import { makeCell, opening } from '../../core/world/build.ts';
import type { CellLayout, EntitySpec, FloorLayout, WallOpening } from '../../core/world/layout.ts';
import { themePalette } from '../../core/world/palettes.ts';

export interface LabRoom {
  floor: FloorLayout;
  cell: CellLayout;
  slot: GimmickSlot;
  offers: SecretOffer[];
  keepOut: AABB[];
  /** 入口・出口の内側 1.0 m の点 */
  inside: Vec3;
  exitInside: Vec3 | null;
}

/** 壁 d の、壁に沿った位置 f（0..1）の開口 */
function wallOpening(id: string, w: number, d: number, dir: Dir, f: number, width: number): WallOpening {
  const x = 0.6 + (w - 1.2) * f, z = 0.6 + (d - 1.2) * f;
  const pos: Vec3 = dir === 0 ? [x, 0, d] : dir === 2 ? [x, 0, 0] : dir === 1 ? [w, 0, z] : [0, 0, z];
  return opening(id, pos, dir, width);
}

/** 部屋（w × d、高さ height）に仕掛け defId を組む。組めなければ null */
export function labRoom(defId: string, o: { w: number; d: number; height?: number; entry: Dir; exit: Dir | null; entryAt?: number; exitAt?: number; seed: number; kind?: 'room' | 'hall'; doorW?: number; t?: Tuning }): LabRoom | null {
  const t = o.t ?? defaultTuning();
  const openings: WallOpening[] = [wallOpening('room:in', o.w, o.d, o.entry, o.entryAt ?? 0.5, o.doorW ?? 1.0)];
  if (o.exit !== null) openings.push(wallOpening('room:out', o.w, o.d, o.exit, o.exitAt ?? 0.5, o.doorW ?? 1.0));
  const rect = { x0: 0, z0: 0, x1: o.w, z1: o.d };
  const cell = makeCell({ id: 'room', role: 'gimmick', rects: [rect], height: o.height ?? 2.8, palette: themePalette('GenericRoom'), openings });
  const slot: GimmickSlot = { cell, kind: o.kind ?? 'room', openings, main: true, entrance: openings[0]!, exit: openings[1] ?? null, rect };
  const def = gimmickDef(defId);
  if (!def) throw new Error(`仕掛けがありません: ${defId}`);
  const entities: EntitySpec[] = [];
  const offers: SecretOffer[] = [];
  const keepOut: AABB[] = [];
  let added = 0;
  const ctx: GimmickContext = {
    slot, rng: new Rng(o.seed), tuning: t, id: `g:${defId}:room`,
    floor: { id: 'lab', seed: o.seed, depth: 1, rarity: 'Common', family: 'lab' },
    addBox(b) { cell.boxes.push(b); added++; return b; },
    addEntity(name, e) { const id = `g:${defId}:room.${name}`; entities.push({ ...e, id, cell: e.cell ?? 'room' } as EntitySpec); added++; return id; },
    addZone(z) { cell.zones.push(z); },
    keepOut(a) { keepOut.push(a); },
    frontOf: (op, dd = 1.0) => frontOf(op, dd),
    offerSecret(of) { offers.push(of); },
    doorAt: () => null,
    removeBoxes(pred) { cell.boxes = cell.boxes.filter((b) => !pred(b)); },
    reachAssist() {},
  };
  if (def.fits && !def.fits(slot)) return null;
  def.build(ctx);
  if (!added) return null;
  const floor: FloorLayout = {
    id: 'lab', seed: o.seed, genVersion: 'lab', tuningVersion: 'lab',
    bounds: { min: [cell.bounds.min[0], cell.bounds.min[1] - 6, cell.bounds.min[2]], max: cell.bounds.max },
    cells: [cell], portals: [], entities, surfaces: [], spawn: { pos: frontOf(openings[0]!, 1.0), yaw: 0, cell: 'room' }, exits: [],
  };
  const inside = frontOf(openings[0]!, 1.0);
  return { floor, cell, slot, offers, keepOut, inside: [inside[0], 0, inside[2]], exitInside: openings[1] ? (() => { const p = frontOf(openings[1]!, 1.0); return [p[0], 0, p[2]] as Vec3; })() : null };
}
