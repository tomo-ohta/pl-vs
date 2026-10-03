/**
 * 落ちる穴（docs/endless-world.md 14 章）の試験の道具: 穴の上の、下に何も無い点と、そこから落とすと底の見えない縦穴を落ち続けるか。
 * 落ちる穴は底も階段も無い（落ちたら 1 つ下の階へ。フロア・実験室では縦穴の底の出口で暗転して移る）
 */
import { Rng } from '../../core/math/rng.ts';
import type { Vec3 } from '../../core/math/vec.ts';
import { IDLE_COMMAND } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { CellLayout, FloorLayout } from '../../core/world/layout.ts';
import { WALL_T } from '../../core/world/layout.ts';

/** 穴の上の、真下に何も無い（床から 25 m 下まで当たり判定も面も無い）・体が入る点を n 個 */
export function dropSpots(sim: Sim, cell: CellLayout, n: number, seed: number): Vec3[] {
  const fr = cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
  const y = cell.floorY;
  // 部品の当たり判定（橋・床板）は 1 歩目で入る
  if (sim.tick === 0) sim.step([{ ...IDLE_COMMAND }]);
  const rng = new Rng(seed);
  const out: Vec3[] = [];
  for (let i = 0; i < 600 && out.length < n; i++) {
    const x = rng.float(fr.x0 + WALL_T + 0.45, fr.x1 - WALL_T - 0.45), z = rng.float(fr.z0 + WALL_T + 0.45, fr.z1 - WALL_T - 0.45);
    const any = sim.colliders.query(x - 0.42, y - 25, z - 0.42, x + 0.42, y + 1.7, z + 0.42).some((b) => b.max[1] > y - 25 && b.min[1] < y + 1.7);
    // 面（吊り橋の橋板など）の上も除く
    const surf = [...sim.surfaces].some((f) => x > f.rect.x0 - 0.45 && x < f.rect.x1 + 0.45 && z > f.rect.z0 - 0.45 && z < f.rect.z1 + 0.45);
    if (!any && !surf) out.push([x, y + 0.3, z]);
  }
  return out;
}

/** 点 p から落とすと、縦穴（出口の shaft の範囲）を床から 6 m より下まで落ちる（振り子などに払われてから落ちることもあるので 2.5 秒まで見る） */
export function fallsDown(sim: Sim, floor: FloorLayout, p: Vec3, floorY: number): boolean {
  sim.teleport(0, p, 0);
  for (let i = 0; i < 150; i++) {
    sim.step([{ ...IDLE_COMMAND }]);
    const q = sim.players[0]!.pos;
    const inShaft = floor.exits.some((x) => x.shaft && q[0] >= x.shaft.zone.min[0] - 0.05 && q[0] <= x.shaft.zone.max[0] + 0.05 && q[2] >= x.shaft.zone.min[2] - 0.05 && q[2] <= x.shaft.zone.max[2] + 0.05 && x.to);
    if (q[1] < floorY - 6 && inShaft) return true;
  }
  return false;
}
