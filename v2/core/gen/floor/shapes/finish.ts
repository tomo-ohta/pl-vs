/**
 * 中身を置いた後の仕上げ（FloorGeometry.afterDress。index.ts が区画の中身・異変の後に呼ぶ）。
 *
 * 鏡写し（F19）: 左半分の区画の中身（家具の箱・照明）を、対になる右半分の区画へ鏡に写す（x = 0 で反転）。
 * 仕掛け・異変・隠しのある区画と、その対は写さない（そこが「片側だけ違う」所になる）。さらに、写せる対のうち 1 つは
 * わざと写さない（家具だけが違う部屋）。水槽（床に沈めた水）のある区画は写さない（ゾーンと床の切り欠きが要るため）。
 * 開口の位置が鏡写しになっていない対（片側だけの出口の階段など）も写さない（写した家具が開口を塞ぐ）。
 */
import { hashAll, Rng } from '../../../math/rng.ts';
import type { Box, CellLayout, LightSpec } from '../../../world/layout.ts';
import type { Skeleton } from '../skeleton.ts';
import type { AfterDressEnv, GeoBuild, GeoCell, Placed } from '../geometry.ts';

const mirrorBox = (b: Box): Box => {
  const out: Box = { ...b, min: [-b.max[0], b.min[1], b.min[2]], max: [-b.min[0], b.max[1], b.max[2]] };
  if (b.slope?.axis === 'x') { out.slope = { axis: 'x', rise: -b.slope.rise }; out.min = [out.min[0], out.min[1] + b.slope.rise, out.min[2]]; out.max = [out.max[0], out.max[1] + b.slope.rise, out.max[2]]; }
  if (b.propGroup) out.propGroup = `${b.propGroup}:m`;
  return out;
};
const mirrorLight = (l: LightSpec): LightSpec => ({ ...l, pos: [-l.pos[0], l.pos[1], l.pos[2]] });

/**
 * 右の区画の開口が、どれも左の区画の開口の鏡写しの所にあるか。左に無い開口（片側だけの出口の階段など）があると、
 * 左の壁際の家具を写したときにその開口の前を塞ぐ（2026-10-06: 出口の階段の扉を店の棚が塞いで、出口へ行けないフロアがあった）
 */
function openingsMirrored(a: GeoCell, b: GeoCell): boolean {
  const mdir = (d: number): number => (d === 1 ? 3 : d === 3 ? 1 : d);
  return b.openings.every((o) => a.openings.some((q) => mdir(q.dir) === o.dir && Math.abs(-q.pos[0] - o.pos[0]) < 0.05 && Math.abs(q.pos[2] - o.pos[2]) < 0.05 && Math.abs(q.width - o.width) < 0.05));
}

/** 右の区画が、左の区画の鏡写しの形か（足跡・床・天井の高さ） */
function sameShape(a: CellLayout, b: CellLayout): boolean {
  if (Math.abs(a.floorY - b.floorY) > 1e-3 || Math.abs(a.height - b.height) > 1e-3 || a.footprint.length !== b.footprint.length) return false;
  return a.footprint.every((r) => b.footprint.some((q) => Math.abs(q.x0 + r.x1) < 1e-3 && Math.abs(q.x1 + r.x0) < 1e-3 && Math.abs(q.z0 - r.z0) < 1e-3 && Math.abs(q.z1 - r.z1) < 1e-3));
}

export function mirrorFinish(g: GeoBuild, sk: Skeleton, placed: Map<number, Placed>, env: AfterDressEnv): void {
  const mid = (sk.cols - 1) / 2;
  const pairs: [CellLayout, CellLayout][] = [];
  for (const n of sk.nodes) {
    if (n.kind === 'none' || n.col >= mid) continue;
    const m = sk.nodes.find((o) => o.col === sk.cols - 1 - n.col && o.row === n.row && o.story === n.story);
    const a = placed.get(n.id), b = m ? placed.get(m.id) : undefined;
    if (!a || !b || a === b || m!.kind === 'none') continue;
    const ga = g.geo(a.cellId), gb = g.geo(b.cellId);
    const ca = ga?.cell, cb = gb?.cell;
    if (!ca || !cb || env.busy.has(ca.id) || env.busy.has(cb.id)) continue;
    if (!openingsMirrored(ga!, gb!)) continue;
    if (!env.dressedFrom.has(ca.id) || !env.dressedFrom.has(cb.id)) continue;
    if (ca.zones.length || cb.zones.length || ca.bounds.min[1] < ca.floorY - 0.25 || cb.bounds.min[1] < cb.floorY - 0.25) continue;
    if (!sameShape(ca, cb)) continue;
    pairs.push([ca, cb]);
  }
  if (!pairs.length) return;
  // わざと写さない対（家具だけが違う部屋）
  const keep = new Rng(hashAll(g.p.seed, 'mirrorDiff')).int(0, pairs.length - 1);
  pairs.forEach(([a, b], i) => {
    if (i === keep && pairs.length > 1) return;
    const fa = env.dressedFrom.get(a.id)!, fb = env.dressedFrom.get(b.id)!;
    b.boxes = [...b.boxes.slice(0, fb), ...a.boxes.slice(fa).map(mirrorBox)];
    b.lights = a.lights.map(mirrorLight);
  });
}
