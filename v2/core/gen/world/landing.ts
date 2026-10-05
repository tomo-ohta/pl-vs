/**
 * 上の階から落ちてくる人が着く部屋（docs/endless-world.md 13・14 章）: 升目ごとに 1 つ（plan.ts）。
 * 部屋の天井の真ん中に穴を開け、その上に暗い縦穴（world.hole.shaftM）を立てる。隠しの穴の縦穴（secrets/index.ts）と同じ大きさ。
 * 落ちる人は、隠しの穴の縦穴の途中（world.hole.transferM の深さ）で、この縦穴の同じ所へ移り（WorldSession）、天井の穴から部屋へ落ちる。
 *
 * - 置く部屋: 部屋か広間・地面の階（上に別の区画が無い）・天井の穴の真下に人が立てる広さ。着く升目の中の部屋を先に
 * - 穴の真下は家具を置かない。仕掛け・異変も置かない（落ちる所が変わらない・天井の高さが変わらない）
 * - 天井の照明のうち、穴に掛かる物は外す
 */
import type { Tuning } from '../../config/tuning.ts';
import { hashAll, Rng } from '../../math/rng.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, type RegionLandingCell } from '../../world/layout.ts';
import { GenError, snap, type GeoBuild, type Placed } from '../floor/geometry.ts';
import { dropShaft, lowerBounds, storyBelow } from './drop.ts';

const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 - 0.05 && a.x1 > b.x0 + 0.05 && a.z0 < b.z1 - 0.05 && a.z1 > b.z0 + 0.05;

/** 区域の着く部屋を置く（hosts の中から）。置けなければ GenError（形を作り直す） */
export function placeLanding(g: GeoBuild, hosts: readonly Placed[], t: Tuning): RegionLandingCell[] {
  const reg = g.p.region;
  if (!reg?.landings?.length) return [];
  const half = t['world.landing.sizeM'] / 2;
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
    // 沈む床で降りてくる人を乗せる床板（縦穴のいちばん上で待つ）
    const ph = half - 0.12;
    const lift = `${pl.cellId}:landLift`;
    g.out.entities.push({ id: lift, type: 'dropLift', cell: pl.cellId, params: { box: { min: [x - ph, ceil + shaftM - 0.2, z - ph], max: [x + ph, ceil + shaftM, z + ph] }, floorY: y0 + 0.02, speed: t['world.hole.liftSpeed'], idleSec: 4, mat: 'metal' } });
    out.push({ id: ld.id, cell: pl.cellId, anchor: [x, ceil + shaftM, z], zone: { min: [x - half, ceil - 0.2, z - half], max: [x + half, ceil + shaftM, z + half] }, lift });
  }
  return out;
}

/**
 * 床の穴（v1 の Hole。14 章）: 部屋の床に開いた穴。落ちると 1 つ下の階の同じ升目の着く部屋へ（暗い縦穴の途中で入れ替える）。
 * 升目ごとに world.hole.open の確率で 1 つ（もう 1 つは world.hole.open2）。部屋か広間の、壁と開口から離れた所。穴の縁に暗い枠と、
 * 欠けた床の破片。仕掛け・異変は置かない（穴の部屋そのものが見どころ）
 */
export function placeOpenHoles(g: GeoBuild, hosts: readonly Placed[], t: Tuning): void {
  const reg = g.p.region;
  if (!reg) return;
  const size = t['world.hole.openSizeM'], half = size / 2;
  const all = [...new Set([...g.cellsToBuild, ...hosts])];
  const r = new Rng(hashAll(g.p.seed, 'openHoles'));
  const slots: [number, number][] = [];
  for (let i = 0; i * reg.slotM < reg.rect.x1 - reg.rect.x0 - 1; i++) for (let j = 0; j * reg.slotM < reg.rect.z1 - reg.rect.z0 - 1; j++) slots.push([Math.round(reg.rect.x0 / reg.slotM) + i, Math.round(reg.rect.z0 / reg.slotM) + j]);
  let n = 0;
  for (const slot of slots) {
    const want = Number(r.chance(t['world.hole.open'])) + Number(r.chance(t['world.hole.open2']));
    for (let k = 0; k < want; k++) {
      const cands = r.shuffle(hosts.filter((pl) => {
        if ((pl.kind !== 'room' && pl.kind !== 'hall') || pl.node.story !== 0 || g.reserved.has(pl.cellId) || g.fixedSize.has(pl.cellId)) return false;
        const cx = (pl.rect.x0 + pl.rect.x1) / 2, cz = (pl.rect.z0 + pl.rect.z1) / 2;
        if (cx < slot[0] * reg.slotM || cx >= (slot[0] + 1) * reg.slotM || cz < slot[1] * reg.slotM || cz >= (slot[1] + 1) * reg.slotM) return false;
        const rects = pl.rects ?? [pl.rect];
        // 下に別の区画（下の階・下がった床）が重なる部屋は使わない
        return !all.some((o) => o !== pl && o.y < pl.y - 0.05 && (o.rects ?? [o.rect]).some((q) => rects.some((w) => overlaps(q, w))));
      }));
      for (const pl of cands) {
        const big = (pl.rects ?? [pl.rect]).reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
        if ((big.x1 - big.x0) * (big.z1 - big.z0) < 30 || Math.min(big.x1 - big.x0, big.z1 - big.z0) < size + 3.2) continue;
        const ops = g.openings.get(pl.cellId) ?? [];
        const m = half + 1.6;
        let spot: [number, number] | null = null;
        for (let tries = 0; tries < 12 && !spot; tries++) {
          const x = snap(r.float(big.x0 + m, big.x1 - m)), z = snap(r.float(big.z0 + m, big.z1 - m));
          if (ops.every((o) => Math.hypot(o.pos[0] - x, o.pos[2] - z) > half + 2.4)) spot = [x, z];
        }
        if (!spot) continue;
        const [x, z] = spot;
        const hole: Rect = { x0: x - half, x1: x + half, z0: z - half, z1: z + half };
        const y = pl.y;
        pl.opts = { ...(pl.opts ?? {}), floorHoles: [...(pl.opts?.floorHoles ?? []), { min: [hole.x0, y - 0.3, hole.z0], max: [hole.x1, y + 0.05, hole.z1] }] };
        const ds = dropShaft(`${pl.cellId}:hole${n}`, hole, y, y - 0.25, storyBelow(g.p.key.depth, g.p.key.variant), t);
        n++;
        const rim = r.pick(['metalDark', 'floorConcrete', 'wallDark'] as const);
        (pl.post ??= []).push((cell) => {
          // 穴の縁（床の厚みの切り口）と、欠けた床の破片
          cell.boxes.push(
            box([hole.x0 - 0.06, y - 0.25, hole.z0 - 0.06], [hole.x1 + 0.06, y + 0.01, hole.z0], rim),
            box([hole.x0 - 0.06, y - 0.25, hole.z1], [hole.x1 + 0.06, y + 0.01, hole.z1 + 0.06], rim),
            box([hole.x0 - 0.06, y - 0.25, hole.z0], [hole.x0, y + 0.01, hole.z1], rim),
            box([hole.x1, y - 0.25, hole.z0], [hole.x1 + 0.06, y + 0.01, hole.z1], rim),
            box([hole.x0, y - 0.25, hole.z0], [hole.x1, y - 0.24, hole.z1], 'void', false),
          );
          cell.boxes.push(...ds.boxes.map((b) => ({ ...b, min: [b.min[0], b.min[1], b.min[2]] as [number, number, number], max: [b.max[0], Math.min(b.max[1], y - 0.25), b.max[2]] as [number, number, number] })));
          for (let i = 0; i < 4; i++) {
            const a = r.float(0, Math.PI * 2), d = half + r.float(0.15, 0.7), s = r.float(0.08, 0.22);
            const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
            cell.boxes.push(box([px - s, y, pz - s], [px + s, y + r.float(0.02, 0.06), pz + s], cell.palette.floor, false));
          }
          lowerBounds(cell, ds.minY);
        });
        g.out.exits.push(ds.exit);
        g.keep(pl.cellId, { min: [hole.x0 - 0.7, y - 0.3, hole.z0 - 0.7], max: [hole.x1 + 0.7, y + pl.height, hole.z1 + 0.7] });
        g.reserved.add(pl.cellId);
        g.fixedSize.add(pl.cellId);
        break;
      }
    }
  }
  void GenError;
}

