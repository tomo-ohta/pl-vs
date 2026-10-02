/**
 * 区画（CellLayout）を作る補助。足跡の矩形と開口から、床・天井・外壁・天井の照明を作る。
 * フロアの生成（core/gen）と実験場（core/lab）が共通で使う。
 */
import type { AABB } from '../math/aabb.ts';
import type { Dir, Vec3 } from '../math/vec.ts';
import { buildShell, footprintAABB, type Rect } from './footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type CellRole, type LightSpec, type MatId, type Palette, type PortalSpec, type WallOpening, type Zone } from './layout.ts';

export interface CellOptions {
  id: string;
  role: CellRole;
  rects: Rect[];
  height: number;
  floorY?: number;
  palette: Palette;
  openings?: WallOpening[];
  floorHoles?: AABB[];
  ceilingHoles?: AABB[];
  noCeiling?: boolean;
  /** 天井の照明: 'grid'（格子に並べる）/ 'none' */
  lights?: 'grid' | 'none';
  /** 照明の間隔（m） */
  lightSpacing?: number;
  /** 照明を部品で入切する（lamp 部品の id） */
  lampId?: string;
  name?: string;
  theme?: string;
  audioPreset?: string;
  materialKey?: string;
}

export function makeCell(o: CellOptions): CellLayout {
  const y = o.floorY ?? 0;
  const boxes: Box[] = [];
  buildShell(boxes, o.rects, o.height, (o.openings ?? []).map((op) => ({ ...op, pos: [op.pos[0], op.pos[1], op.pos[2]] as Vec3 })), {
    floor: o.palette.floor, wall: o.palette.wall, ceiling: o.palette.ceiling,
    ...(o.floorHoles ? { floorHoles: o.floorHoles } : {}),
    ...(o.ceilingHoles ? { ceilingHoles: o.ceilingHoles } : {}),
    ...(o.noCeiling ? { noCeiling: true } : {}),
    yBase: y,
  });
  const lights: LightSpec[] = [];
  if ((o.lights ?? 'grid') === 'grid' && !o.noCeiling) lightGrid(boxes, lights, o.rects, y + o.height, o.lightSpacing ?? 2.4, o.palette, o.lampId);
  const cell: CellLayout = {
    id: o.id,
    role: o.role,
    bounds: footprintAABB(o.rects, o.height, y),
    footprint: o.rects.map((r) => ({ ...r })),
    height: o.height,
    floorY: y,
    palette: { ...o.palette },
    boxes,
    lights,
    zones: [],
  };
  if (o.name) cell.name = o.name;
  if (o.theme) cell.theme = o.theme;
  if (o.audioPreset) cell.audioPreset = o.audioPreset;
  if (o.materialKey) cell.materialKey = o.materialKey;
  return cell;
}

/** 天井の発光パネル（非ソリッド）。lampId があれば kind 'lamp:<id>'（部品で入切） */
export function lightPanel(out: Box[], cx: number, cz: number, w: number, d: number, h: number, mat: MatId, lampId?: string): Box {
  const b = box([cx - w / 2, h - 0.04, cz - d / 2], [cx + w / 2, h - 0.005, cz + d / 2], mat, false);
  if (lampId) b.kind = `lamp:${lampId}`;
  out.push(b);
  return b;
}

/** 矩形ごとに格子で照明を並べる（v1 の lightGrid に近い。パネル 2 枚に 1 つ点光源） */
export function lightGrid(out: Box[], lights: LightSpec[], rects: Rect[], ceilingY: number, spacing: number, p: Palette, lampId?: string): void {
  let n = 0;
  for (const r of rects) {
    const w = r.x1 - r.x0 - 2 * WALL_T, d = r.z1 - r.z0 - 2 * WALL_T;
    const nx = Math.max(1, Math.round(w / spacing));
    const nz = Math.max(1, Math.round(d / spacing));
    const alongZ = d >= w;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = r.x0 + WALL_T + (w / nx) * (i + 0.5);
        const z = r.z0 + WALL_T + (d / nz) * (j + 0.5);
        lightPanel(out, x, z, alongZ ? 0.6 : 1.2, alongZ ? 1.2 : 0.6, ceilingY, p.light, lampId);
        if (n++ % 2 === 0) {
          const l: LightSpec = { pos: [x, ceilingY - 0.4, z], color: p.lightColor, intensity: p.lightIntensity, distance: spacing * 2.6 };
          if (lampId) l.lampId = lampId;
          lights.push(l);
        }
      }
    }
  }
}

/** 壁の開口（pos は壁の外面の床位置、dir は外向き） */
export function opening(id: string, pos: Vec3, dir: Dir, width = DOOR_W, height = DOOR_H, sill?: number): WallOpening {
  const o: WallOpening = { id, pos, dir, width, height };
  if (sill) o.sill = sill;
  return o;
}

/**
 * 2 つの区画の境目（座標 coord の壁）にある開口の範囲。axis 'x' は x = coord の壁（z に沿う）、'z' は z = coord の壁。
 * 両側の区画がそれぞれ厚さ WALL_T の壁を持つので、開口は境目から両側へ WALL_T ずつ
 */
export function portalAabb(axis: 'x' | 'z', coord: number, at: number, width: number, y: number, height: number): AABB {
  return axis === 'x'
    ? { min: [coord - WALL_T, y, at - width / 2], max: [coord + WALL_T, y + height, at + width / 2] }
    : { min: [at - width / 2, y, coord - WALL_T], max: [at + width / 2, y + height, coord + WALL_T] };
}

export function portal(id: string, a: string, b: string, aabb: AABB, dir: Dir, kind: PortalSpec['kind'] = 'opening', doorId?: string): PortalSpec {
  const p: PortalSpec = { id, cells: [a, b], aabb, dir, kind };
  if (doorId) p.doorId = doorId;
  return p;
}

/** 扉の板（閉じた位置。境目の面に厚さ 0.05） */
export function doorPanel(axis: 'x' | 'z', coord: number, at: number, width: number, y: number, height: number): AABB {
  return axis === 'x'
    ? { min: [coord - 0.025, y, at - width / 2], max: [coord + 0.025, y + height, at + width / 2] }
    : { min: [at - width / 2, y, coord - 0.025], max: [at + width / 2, y + height, coord + 0.025] };
}

export function zone(kind: Zone['kind'], aabb: AABB, extra: Partial<Zone> = {}): Zone {
  return { kind, aabb, ...extra };
}
