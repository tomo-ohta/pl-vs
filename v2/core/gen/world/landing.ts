/**
 * 隠しの穴から落ちてくる人が着く部屋（docs/endless-world.md 13 章）: 超ブロックごとに 1 つ（plan.ts の landingSlot）。
 * 部屋の天井の真ん中に穴を開け、その上に暗い縦穴（world.hole.shaftM）を立てる。隠しの穴の縦穴（secrets/index.ts）と同じ大きさ。
 * 落ちる人は、隠しの穴の縦穴の途中（world.hole.transferM の深さ）で、この縦穴の同じ所へ移り（WorldSession）、天井の穴から部屋へ落ちる。
 *
 * - 置く部屋: 部屋か広間・地面の階（上に別の区画が無い）・天井の穴の真下に人が立てる広さ。着く升目の中の部屋を先に
 * - 穴の真下は家具を置かない。仕掛け・異変も置かない（落ちる所が変わらない・天井の高さが変わらない）
 * - 天井の照明のうち、穴に掛かる物は外す
 */
import type { Tuning } from '../../config/tuning.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, type RegionLandingCell } from '../../world/layout.ts';
import { GenError, snap, type GeoBuild, type Placed } from '../floor/geometry.ts';

const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 - 0.05 && a.x1 > b.x0 + 0.05 && a.z0 < b.z1 - 0.05 && a.z1 > b.z0 + 0.05;

/** 区域の着く部屋を置く（hosts の中から）。置けなければ GenError（形を作り直す） */
export function placeLanding(g: GeoBuild, hosts: readonly Placed[], t: Tuning): RegionLandingCell[] {
  const reg = g.p.region;
  if (!reg?.landings?.length) return [];
  const half = t['world.hole.sizeM'] / 2;
  const shaftM = t['world.hole.shaftM'];
  const out: RegionLandingCell[] = [];
  const all = [...new Set([...g.cellsToBuild, ...hosts])];
  for (const ld of reg.landings) {
    const sx = (ld.slot[0] + 0.5) * reg.slotM, sz = (ld.slot[1] + 0.5) * reg.slotM;
    let best: { pl: Placed; x: number; z: number; score: number } | null = null;
    for (const pl of hosts) {
      if ((pl.kind !== 'room' && pl.kind !== 'hall') || pl.node.story !== 0 || g.reserved.has(pl.cellId) || g.fixedSize.has(pl.cellId)) continue;
      const rects = pl.rects ?? [pl.rect];
      const big = rects.reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
      if (Math.min(big.x1 - big.x0, big.z1 - big.z0) < 2 * half + 2.6) continue;
      // 上に別の区画（中二階・上の階）が重なる部屋は使わない（縦穴が通らない）
      const top = pl.y + pl.height;
      if (all.some((o) => o !== pl && o.y + 0.05 >= top - 0.05 && (o.rects ?? [o.rect]).some((r) => rects.some((q) => overlaps(r, q))))) continue;
      if (g.straights.some((s) => s.y + 0.05 >= top - 0.05 && rects.some((q) => overlaps(q, s.axis === 'x' ? { x0: s.a0, x1: s.a1, z0: s.center - s.width / 2, z1: s.center + s.width / 2 } : { x0: s.center - s.width / 2, x1: s.center + s.width / 2, z0: s.a0, z1: s.a1 })))) continue;
      const x = snap((big.x0 + big.x1) / 2), z = snap((big.z0 + big.z1) / 2);
      const inSlot = x >= ld.slot[0] * reg.slotM && x < (ld.slot[0] + 1) * reg.slotM && z >= ld.slot[1] * reg.slotM && z < (ld.slot[1] + 1) * reg.slotM;
      const score = (inSlot ? 0 : 1000) + Math.hypot(x - sx, z - sz) + (pl.kind === 'hall' ? 4 : 0);
      if (!best || score < best.score) best = { pl, x, z, score };
    }
    if (!best) throw new GenError(`着く部屋を置けません: ${ld.id}`);
    const { pl, x, z } = best;
    const y0 = pl.y, ceil = pl.y + pl.height;
    const hole = { min: [x - half, ceil - 0.05, z - half] as [number, number, number], max: [x + half, ceil + 0.3, z + half] as [number, number, number] };
    pl.opts = { ...(pl.opts ?? {}), ceilingHoles: [...(pl.opts?.ceilingHoles ?? []), hole] };
    (pl.post ??= []).push((cell) => {
      // 穴に掛かる天井の照明を外す
      cell.boxes = cell.boxes.filter((b) => !(b.min[1] >= ceil - 0.25 && b.max[1] <= ceil + 0.05 && b.min[0] < x + half + 0.15 && b.max[0] > x - half - 0.15 && b.min[2] < z + half + 0.15 && b.max[2] > z - half - 0.15));
      cell.lights = cell.lights.filter((l) => Math.hypot(l.pos[0] - x, l.pos[2] - z) > half + 0.4);
      // 暗い縦穴（4 枚の壁と蓋）。壁は穴の縁から外へ
      const T = 0.12, top = ceil + shaftM;
      cell.boxes.push(
        box([x - half - T, ceil, z - half - T], [x - half, top, z + half + T], 'void'),
        box([x + half, ceil, z - half - T], [x + half + T, top, z + half + T], 'void'),
        box([x - half, ceil, z - half - T], [x + half, top, z - half], 'void'),
        box([x - half, ceil, z + half], [x + half, top, z + half + T], 'void'),
        box([x - half - T, top, z - half - T], [x + half + T, top + 0.15, z + half + T], 'void'),
      );
    });
    // 穴の真下は家具を置かない。仕掛け・異変も置かない
    g.keep(pl.cellId, { min: [x - half - 0.6, y0, z - half - 0.6], max: [x + half + 0.6, ceil, z + half + 0.6] });
    g.reserved.add(pl.cellId);
    g.fixedSize.add(pl.cellId);
    out.push({ id: ld.id, cell: pl.cellId, anchor: [x, ceil + shaftM, z], zone: { min: [x - half, ceil - 0.2, z - half], max: [x + half, ceil + shaftM, z + half] } });
  }
  return out;
}
