// 果てしない階の試験の道具: 今入っている区域をまとめたフロア（歩く人 bot.ts が道順を引く）と、tick ごとに区域を出し入れする Sim の包み
import type { WorldSession } from '../../core/stream/session.ts';
import type { StoryWorld } from '../../core/stream/story.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { EntitySpec, FloorLayout } from '../../core/world/layout.ts';

/** 入っている区域と、両側のそろった境目の扉をまとめたフロア */
export function compositeFloor(w: StoryWorld): FloorLayout {
  const ls = w.regions.map((r) => r.layout);
  const doors = w.portals.map((p) => w.sim.entitySpec(p.doorId!)).filter((x): x is EntitySpec => !!x);
  return {
    ...w.sim.floor,
    cells: ls.flatMap((l) => l.cells),
    portals: [...ls.flatMap((l) => l.portals), ...w.portals],
    entities: [...ls.flatMap((l) => l.entities), ...doors],
    exits: ls.flatMap((l) => l.exits),
    surfaces: ls.flatMap((l) => l.surfaces),
  };
}

/** 歩く人に渡す Sim: floor は今の区域のまとめ、step は session（無ければ階）を 1 tick 進める */
export function streamSim(session: WorldSession): Sim {
  const target = (): Sim => session.active.sim;
  let floor: FloorLayout | null = null;
  return new Proxy({} as Sim, {
    get(_o, k) {
      if (k === 'floor') return (floor ??= compositeFloor(session.active));
      if (k === 'step') return (cmds: Parameters<Sim['step']>[0]) => session.step(cmds);
      const s = target() as unknown as Record<string | symbol, unknown>;
      const v = s[k];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(s) : v;
    },
  });
}
