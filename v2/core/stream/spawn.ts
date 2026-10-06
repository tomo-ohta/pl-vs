/**
 * 部屋の中へ出す（ルーム ID で飛んだとき。docs/endless-world.md 15 章）: 区画の開口（扉）の内側の、床がある・体が入る所に立たせる。
 *
 * 開口の前は、穴の部屋でも固い床が残してある（pit.ts）ので、開口から少し入った所を先に探す。見つからなければ区画の床を格子で探す。
 * 出現型の隠し場所の中なら、入口の壁を消しておく（出られなくならないように）
 */
import { dirVec, type Vec3 } from '../math/vec.ts';
import type { Sim } from '../sim/sim.ts';
import type { CellLayout, FloorLayout, PortalSpec } from '../world/layout.ts';
import { localId } from '../gen/world/namespace.ts';

const R = 0.36;

/** 点 (x, y, z) に立てるか: 足元に床（上面が y の近く）があり、体の箱に何も無い */
function standable(sim: Sim, x: number, y: number, z: number): boolean {
  const body = sim.colliders.query(x - R, y + 0.1, z - R, x + R, y + 1.75, z + R).some((b) => b.max[1] > y + 0.1 && b.min[1] < y + 1.75);
  if (body) return false;
  return sim.colliders.query(x - 0.15, y - 0.3, z - 0.15, x + 0.15, y + 0.02, z + 0.15).some((b) => b.max[1] >= y - 0.12 && b.max[1] <= y + 0.02);
}

const inside = (c: CellLayout, x: number, z: number, m: number): boolean => c.footprint.some((f) => x >= f.x0 + m && x <= f.x1 - m && z >= f.z0 + m && z <= f.z1 - m);

/** 区画 c の中の立てる所と、部屋の奥を向く向き（見つからなければ区画の真ん中） */
export function spawnInCell(sim: Sim, c: CellLayout, portals: readonly PortalSpec[]): { pos: Vec3; yaw: number } {
  const y = c.floorY;
  const own = portals.filter((p) => p.kind !== 'window' && p.cells.includes(c.id) && Math.abs(p.aabb.min[1] - y) < 0.35).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const p of own) {
    const v = dirVec(p.dir);
    const s = p.cells[1] === c.id ? 1 : -1;
    const px = (p.aabb.min[0] + p.aabb.max[0]) / 2, pz = (p.aabb.min[2] + p.aabb.max[2]) / 2;
    for (const d of [1.0, 1.4, 0.7, 1.9]) {
      const x = px + v[0] * s * d, z = pz + v[2] * s * d;
      if (inside(c, x, z, R) && standable(sim, x, y, z)) return { pos: [x, y + 0.02, z], yaw: Math.atan2(-v[0] * s, -v[2] * s) };
    }
  }
  // 区画の床を格子で（真ん中に近い所から）
  const cx = (c.bounds.min[0] + c.bounds.max[0]) / 2, cz = (c.bounds.min[2] + c.bounds.max[2]) / 2;
  const spots: [number, number][] = [];
  for (const f of c.footprint) for (let x = f.x0 + 0.5; x <= f.x1 - 0.5; x += 0.5) for (let z = f.z0 + 0.5; z <= f.z1 - 0.5; z += 0.5) spots.push([x, z]);
  spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
  const at = spots.find(([x, z]) => standable(sim, x, y, z));
  if (at) return { pos: [at[0], y + 0.02, at[1]], yaw: 0 };
  return { pos: [cx, y + 0.4, cz], yaw: 0 };
}

/** 区画が出現型の隠し場所なら、入口を塞ぐ壁を消す（Sim の見え隠れの組。まだ現れていなければ） */
export function openSecretOf(sim: Sim, L: FloorLayout, cellId: string): void {
  for (const s of L.region?.contents?.secrets ?? []) {
    if (!s.cells.includes(cellId)) continue;
    const rev = L.entities.find((e) => e.type === 'reveal' && localId(e.id) === `${s.id}.reveal`);
    const group = rev?.params.group;
    if (typeof group === 'string') sim.revealNow(group);
  }
}
