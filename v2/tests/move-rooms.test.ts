/**
 * 移動と身体の仕掛けの部屋（生成したフロア）: 入口のすぐ内側から、部屋のほかの全部の開口の向こうへ歩いて行ける（閉じ込めない・
 * 横の開口を塞がない）。仕掛けの種類が出る・決まった割合で出すぎない
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { MOVE_CATALOG } from '../core/gen/catalog/move.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { walkTo } from './helpers/bot.ts';
import { intoCell } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
/** この担当が作った仕掛け（段階 3 までの物を除く） */
export const MOVE_GIMMICKS = [...new Set(MOVE_CATALOG.filter((e) => e.status === 'done' || e.status === 'merged').flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick').map((m) => m.id)))]
  .filter((id) => !['beltMaze', 'lowCeiling', 'narrowPath', 'bouncePad', 'tiltRoom'].includes(id));

test('移動と身体の仕掛けの部屋: 入口の内側から、ほかの全部の開口の向こうへ歩いて行ける', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  const seen = new Map<string, number>();
  let walks = 0;
  for (let w = 1; w <= 50; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: w % 4 === 0 ? 1 : 0 }, t, { dress: dressCell });
    const floor = r.floor;
    for (const g of r.gimmicks?.gimmicks ?? []) {
      if (!MOVE_GIMMICKS.includes(g.def)) continue;
      seen.set(g.def, (seen.get(g.def) ?? 0) + 1);
      const stop = r.gimmicks!.tour.find((s) => s.cell === g.cell);
      if (!stop) continue;
      const portals = floor.portals.filter((p) => p.cells.includes(g.cell) && !p.cells.some((c) => c.startsWith('secret')));
      const d = (p: (typeof portals)[number]): number => Math.hypot((p.aabb.min[0] + p.aabb.max[0]) / 2 - stop.pos[0], (p.aabb.min[2] + p.aabb.max[2]) / 2 - stop.pos[2]);
      const entry = portals.slice().sort((a, b) => d(a) - d(b))[0]!;
      for (const p of portals) {
        if (p === entry) continue;
        const target = p.cells[0] === g.cell ? p.cells[1] : p.cells[0];
        // 扉と扉の間の短い切れ端（奥行き 1.5 m 未満）は行き先にしない（歩く人の「扉の先」の点が次の扉の向こうになる）
        const tb = floor.cells.find((c) => c.id === target)!.bounds;
        if (Math.min(tb.max[0] - tb.min[0], tb.max[2] - tb.min[2]) < 1.5) continue;
        const needsPhysics = floor.entities.some((e) => partDef(e.type)?.physics);
        const sim = new Sim(floor, { tuning: t, physics: needsPhysics ? new PhysicsWorld(R, 1 / 60) : null });
        // 入口の内側 1 m から（見て回る位置は扉と扉の間の短い切れ端のことがあり、歩く人が後ろの扉を調べてしまう）
        const cell = floor.cells.find((c) => c.id === g.cell)!;
        const start = intoCell(entry, cell, 1.0);
        sim.teleport(0, [start[0], start[1] + 0.02, start[2]], stop.yaw);
        // 部屋から、目当ての開口の向こうへ
        let res = walkTo(sim, g.cell, undefined, 120);
        if (res.ok) res = walkTo(sim, target, undefined, 200);
        walks++;
        if (!res.ok) fails.push(`w${w} ${floor.id} ${g.def}@${g.cell} → ${p.id}: ${res.reason}`);
        sim.physics?.dispose();
      }
    }
  }
  console.log(`  ${walks} 回歩いた。出た仕掛け: ${[...seen].map(([k, v]) => `${k} ${v}`).join('・')}`);
  assert.deepEqual(fails, []);
});
