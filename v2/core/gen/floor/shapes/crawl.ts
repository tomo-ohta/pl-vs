/**
 * 天井裏の這う網（F22）: いくつかの部屋の壁際に、天井の点検口へ上る急な段（梯子段）がある。上ると天井裏の低い通路（高さ 1 m。
 * しゃがまないと進めない）で、ほかの部屋の点検口へ抜けられる（部屋の上を這って渡る近道・抜け道）。
 *
 * 形: 天井裏の背骨（フロアの真ん中の区画の境の線に沿って横に 1 本）と、点検口から背骨までの枝（縦）。
 *     点検口の所は、部屋の天井と天井裏の床に穴があり、間を壁で囲む（外が見えない）。
 * 高さ: 天井裏の床は、フロアのいちばん高い天井より上（区画が重ならない）。
 */
import type { AABB } from '../../../math/aabb.ts';
import { opening, portal, portalAabb } from '../../../world/build.ts';
import { box, WALL_T, type Palette, type WallOpening } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import type { Skeleton } from '../skeleton.ts';
import { snap, type GeoBuild, type Placed, type StraightSpec } from '../geometry.ts';

const TREAD_C = 0.26;
const RISER_C = 0.3;
const CLEAR = 1.6;

interface Hatch { node: number; pl: Placed; x: number; zBottom: number; zTop: number; s: 1 | -1; hole: { x0: number; x1: number; z0: number; z1: number }; steps: number; riser: number }

export function buildCrawl(g: GeoBuild, sk: Skeleton, placed: Map<number, Placed>, e: { S: number; cx(c: number): number; cz(r: number): number }): void {
  const t = g.t;
  const W = t['structure.crawl.widthM'];
  const H = t['structure.crawl.heightM'];
  const all = [...new Set(placed.values())];
  const yA = snap(Math.max(...all.map((p) => p.y + p.height)) + 0.45);
  // 背骨: フロアの真ん中の、区画の行の境
  const zs = snap(e.cz(Math.max(1, Math.floor(sk.rows / 2))) + e.S / 2);
  const hatches: Hatch[] = [];
  // 候補の部屋（並びは骨組みで混ぜてある）を順に試し、点検口を structure.crawl.hatches 個まで置く
  for (const id of sk.hatches ?? []) {
    if (hatches.length >= t['structure.crawl.hatches']) break;
    const pl = placed.get(id);
    if (!pl || pl.kind !== 'room') continue;
    // 枝が近すぎる（同じ列）所には置かない
    const h = placeHatch(g, pl, yA, zs, (x) => !hatches.some((o) => Math.abs(o.x - x) < W + 0.6));
    if (h) hatches.push(h);
  }
  if (hatches.length < 2) return;
  hatches.sort((a, b) => a.x - b.x);
  const pal: Palette = { ...themePalette('CorridorService'), floor: 'metalDark', wall: 'wallConcrete', ceiling: 'ceilingDark', lightIntensity: 0.3, lightColor: 0xffd9a8 };
  const mk = (id: string, axis: 'x' | 'z', a0: number, a1: number, center: number, extra: Partial<StraightSpec> = {}): StraightSpec => ({
    id, axis, a0: snap(Math.min(a0, a1)), a1: snap(Math.max(a0, a1)), center, width: W, y: yA, height: H, kind: 'corridor', role: 'connector', name: '天井裏', palette: pal,
    theme: 'CorridorService', audio: '換気・反響', materialKey: `crawl:${g.p.id}`, lightMat: 'lightWarm', lightMul: 0.6, ...extra,
  });
  const add = (s: StraightSpec, ops: WallOpening[]): void => { g.straights.push(s); for (const o of ops) g.addOpening(s.id, o); g.reserved.add(s.id); };
  // 背骨の曲がり角（枝の付け根）と、間の背骨
  hatches.forEach((h, i) => {
    const jid = `crawlJ${i}`;
    const jOps: WallOpening[] = [];
    if (i > 0) jOps.push(opening(`${jid}:w`, [h.x - W / 2, yA, zs], 3, W - 2 * WALL_T, H - 0.05));
    if (i + 1 < hatches.length) jOps.push(opening(`${jid}:e`, [h.x + W / 2, yA, zs], 1, W - 2 * WALL_T, H - 0.05));
    const bDir = h.s > 0 ? 2 : 0; // 枝は点検口の側（背骨から見て、点検口の向き）
    const edgeZ = zs + (bDir === 0 ? W / 2 : -W / 2);
    jOps.push(opening(`${jid}:b`, [h.x, yA, edgeZ], bDir, W - 2 * WALL_T, H - 0.05));
    add(mk(jid, 'z', zs - W / 2, zs + W / 2, h.x), jOps);
    // 枝: 付け根から点検口の手前（穴の向こう 0.3 m）まで。穴の所は床が無い
    const bid = `crawlB${i}`;
    const far = h.s > 0 ? h.hole.z0 - 0.3 : h.hole.z1 + 0.3;
    const holeBox: AABB = { min: [h.hole.x0, yA - 0.3, h.hole.z0], max: [h.hole.x1, yA + 0.1, h.hole.z1] };
    const b = mk(bid, 'z', edgeZ, far, h.x, { floorHoles: [holeBox] });
    const near = h.s > 0 ? Math.max(edgeZ, far) : Math.min(edgeZ, far);
    void near;
    add(b, [opening(`${bid}:j`, [h.x, yA, edgeZ], ((bDir + 2) % 4) as 0 | 2, W - 2 * WALL_T, H - 0.05)]);
    g.out.portals.push(portal(`p:${jid}:${bid}`, jid, bid, portalAabb('z', edgeZ, h.x, W - 2 * WALL_T, yA, H - 0.05), bDir === 0 ? 0 : 2, 'opening'));
    // 部屋と枝の間の点検口（穴の portal）。portal の向きは、梯子段を上る向き（歩く人が上り下りの向きを知る）
    const roomTop = h.pl.y + h.pl.height;
    g.out.portals.push(portal(`p:${h.pl.cellId}:${bid}:hatch`, h.pl.cellId, bid, { min: [h.hole.x0, roomTop, h.hole.z0], max: [h.hole.x1, yA, h.hole.z1] }, h.s > 0 ? 0 : 2, 'hole'));
    if (i + 1 < hatches.length) {
      const n = hatches[i + 1]!;
      const sid = `crawlS${i}`;
      add(mk(sid, 'x', h.x + W / 2, n.x - W / 2, zs), [
        opening(`${sid}:a0`, [h.x + W / 2, yA, zs], 3, W - 2 * WALL_T, H - 0.05),
        opening(`${sid}:a1`, [n.x - W / 2, yA, zs], 1, W - 2 * WALL_T, H - 0.05),
      ]);
      g.out.portals.push(portal(`p:${jid}:${sid}`, jid, sid, portalAabb('x', h.x + W / 2, zs, W - 2 * WALL_T, yA, H - 0.05), 1, 'opening'));
      g.out.portals.push(portal(`p:${sid}:crawlJ${i + 1}`, sid, `crawlJ${i + 1}`, portalAabb('x', n.x - W / 2, zs, W - 2 * WALL_T, yA, H - 0.05), 1, 'opening'));
    }
  });
}

/** 部屋 pl の壁際（x の壁に沿う）に、背骨の向きへ上る梯子段と天井の穴を置く。開口の前と okX が拒む列を避ける。置けなければ null（何も足さない） */
function placeHatch(g: GeoBuild, pl: Placed, yA: number, zs: number, okX: (x: number) => boolean): Hatch | null {
  const r = pl.rect, y = pl.y;
  const rise = yA - y;
  const steps = Math.ceil(rise / RISER_C - 1e-9);
  const riser = rise / steps;
  const run = steps * TREAD_C;
  const s: 1 | -1 = zs < (r.z0 + r.z1) / 2 ? -1 : 1;
  if (r.z1 - r.z0 < run + 1.2 + 2 * WALL_T) return null;
  const ops = g.openings.get(pl.cellId) ?? [];
  const fronts: AABB[] = ops.map((o) => {
    const ix = [0, -1, 0, 1][o.dir]!, iz = [-1, 0, 1, 0][o.dir]!;
    const hw = o.width / 2 + 0.4;
    const x0 = o.pos[0] + (iz !== 0 ? -hw : Math.min(0, ix * CLEAR)), x1 = o.pos[0] + (iz !== 0 ? hw : Math.max(0, ix * CLEAR));
    const z0 = o.pos[2] + (ix !== 0 ? -hw : Math.min(0, iz * CLEAR)), z1 = o.pos[2] + (ix !== 0 ? hw : Math.max(0, iz * CLEAR));
    return { min: [x0, y, z0], max: [x1, y + 2, z1] };
  });
  for (const side of [-1, 1]) {
    const x = side < 0 ? r.x0 + WALL_T + 0.5 : r.x1 - WALL_T - 0.5;
    if (!okX(x)) continue;
    // 段の下の端は、背骨と反対の壁から 0.6 m
    const zBottom = s > 0 ? r.z0 + WALL_T + 0.6 : r.z1 - WALL_T - 0.6;
    const zTop = zBottom + s * run;
    const foot = { x0: x - 0.5, x1: x + 0.5, z0: Math.min(zBottom - s * 0.9, zTop), z1: Math.max(zBottom - s * 0.9, zTop) };
    if (fronts.some((f) => foot.x0 < f.max[0] && foot.x1 > f.min[0] && foot.z0 < f.max[2] && foot.z1 > f.min[2])) continue;
    const holeLen = run - 2 * TREAD_C;
    const hz0 = Math.min(zTop, zTop - s * holeLen), hz1 = Math.max(zTop, zTop - s * holeLen);
    const hole = { x0: snap(x - 0.45), x1: snap(x + 0.45), z0: snap(hz0), z1: snap(hz1) };
    // 段（地面から積んだ箱）・天井の穴・穴のまわりの壁（天井と天井裏の床の間）
    for (let i = 1; i <= steps; i++) {
      const z0 = zBottom + s * (i - 1) * TREAD_C, z1 = zBottom + s * i * TREAD_C;
      const b = box([x - 0.45, y, Math.min(z0, z1)], [x + 0.45, y + i * riser, Math.max(z0, z1)], 'metalDark');
      b.kind = 'stairStep';
      g.addBox(pl.cellId, b);
    }
    const top = y + pl.height;
    for (const [x0, z0, x1, z1] of [[hole.x0 - WALL_T, hole.z0 - WALL_T, hole.x1 + WALL_T, hole.z0], [hole.x0 - WALL_T, hole.z1, hole.x1 + WALL_T, hole.z1 + WALL_T], [hole.x0 - WALL_T, hole.z0, hole.x0, hole.z1], [hole.x1, hole.z0, hole.x1 + WALL_T, hole.z1]] as const) {
      g.addBox(pl.cellId, box([x0, top, z0], [x1, yA - 0.2, z1], 'wallConcrete'));
    }
    // 手すり（段の開いた側）
    const rx = side < 0 ? x + 0.47 : x - 0.47;
    g.addBox(pl.cellId, box([Math.min(rx, rx + 0.04), y + 0.9, Math.min(zBottom, zTop)], [Math.max(rx, rx + 0.04), y + 0.95, Math.max(zBottom, zTop)], 'metal', false));
    pl.opts = { ...(pl.opts ?? {}), ceilingHoles: [...(pl.opts?.ceilingHoles ?? []), { min: [hole.x0, top, hole.z0], max: [hole.x1, top + 0.2, hole.z1] }] };
    g.keep(pl.cellId, { min: [foot.x0 - 0.2, y, foot.z0 - 0.2], max: [foot.x1 + 0.2, y + 3, foot.z1 + 0.2] });
    g.reserved.add(pl.cellId);
    return { node: pl.node.id, pl, x, zBottom, zTop, s, hole, steps, riser };
  }
  return null;
}
