import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();

/** 隠しの壁を全部消し、スイッチで開く扉は開いたままにする（歩く人はスイッチを探さない） */
function prepare(sim: Sim, floor: FloorLayout): void {
  for (const e of floor.entities) if (e.type === 'reveal') (sim as unknown as { revealGroup(g: string, b: string): void }).revealGroup(String(e.params.group), 'test');
  const wired = floor.entities.filter((e) => e.type === 'door' && e.inputs?.open).map((e) => e.id);
  const step = sim.step.bind(sim);
  (sim as unknown as { step: typeof sim.step }).step = (c) => {
    for (const id of wired) { const st = sim.stateOf(id) as { angle: number; target: number }; st.angle = 1; st.target = 1; }
    step(c);
  };
}

test('開口と扉は、ジャンプせずに両向きに通れる（見えない段差・壁の切れ端が無い。家具・隠しを含む）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  for (let w = 1; w <= 16; w++) {
    const floor = generateFloorReport({ world: w, depth: 1 + (w % 8), variant: w % 5 === 0 ? 1 : 0 }, t, { dress: dressCell }).floor;
    // マネキンのいる区画は除く（捕まると戻される）
    const skip = new Set(floor.entities.filter((e) => e.type === 'mannequin').map((e) => e.cell));
    const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    prepare(sim, floor);
    for (const p of floor.portals) {
      if (p.cells.some((c) => skip.has(c))) continue;
      const axis = p.dir % 2 === 0 ? 2 : 0;
      const c = [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2];
      for (const s of [1, -1]) {
        n++;
        const from = [...c] as [number, number, number], to = [...c] as [number, number, number];
        from[axis] -= s * 0.9; to[axis] += s * 0.9;
        // 開口の高さに床が無い側（動く床で届く高い扉・床が下がると現れる低い扉。段階 4 の ground）は、立って歩いて通る開口ではないので見ない
        const floorAt = (q: [number, number, number]): boolean => sim.colliders.query(q[0] - 0.3, q[1] - 0.1, q[2] - 0.3, q[0] + 0.3, q[1] + 0.05, q[2] + 0.3).some((b) => Math.abs(b.max[1] - q[1]) < 0.06);
        if (!floorAt(from) || !floorAt(to)) { n--; continue; }
        sim.teleport(0, [from[0], from[1] + 0.4, from[2]], 0);
        const yaw = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
        let ok = false;
        for (let i = 0; i < 200 && !ok; i++) {
          if (p.doorId) { const st = sim.stateOf(p.doorId) as { angle: number; target: number }; st.angle = 1; st.target = 1; }
          sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0, moveY: i < 20 ? 0 : 1 }]);
          if ((sim.players[0]!.pos[axis] - c[axis]!) * s > 0.55) ok = true;
        }
        if (!ok) fails.push(`${floor.id} ${p.id} ${s > 0 ? '→' : '←'} ${sim.players[0]!.pos.map((v) => v.toFixed(2))}`);
      }
    }
    sim.physics?.dispose();
  }
  assert.deepEqual(fails, [], `${fails.length}/${n} の開口で止まった`);
});

test('隠し場所の奥まで歩いて行ける・通り抜けは出口の部屋まで抜けられる（一方通行の扉は通路の側から）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0, loops = 0;
  for (let w = 1; w <= 30; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 7), variant: w % 5 === 0 ? 1 : 0 }, t, { dress: dressCell });
    for (const s of r.gimmicks?.secrets ?? []) {
      n++;
      const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      prepare(sim, r.floor);
      // 崩れる床の穴の底の隠しは、床板が崩れて落ちてから行く（落ちた後に歩けることは gimmick-pit で確かめる）。ここでは穴の底から歩く
      if (s.hook === 'crumble.fall') {
        const host = r.floor.cells.find((c) => c.id === s.host)!;
        const door = r.floor.portals.find((p) => p.cells[0] === s.host && p.cells[1] === s.cell)!;
        const dc = [(door.aabb.min[0] + door.aabb.max[0]) / 2, (door.aabb.min[2] + door.aabb.max[2]) / 2];
        const hc = [(host.bounds.min[0] + host.bounds.max[0]) / 2, (host.bounds.min[2] + host.bounds.max[2]) / 2];
        const l = Math.hypot(hc[0]! - dc[0]!, hc[1]! - dc[1]!);
        sim.teleport(0, [dc[0]! + ((hc[0]! - dc[0]!) / l) * 1.2, door.aabb.min[1] + 0.05, dc[1]! + ((hc[1]! - dc[1]!) / l) * 1.2], 0);
        for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
      }
      let res = walkTo(sim, s.cells[s.cells.length - 1]!, undefined, 200);
      if (res.ok && s.dest === 'loop') { loops++; res = walkTo(sim, s.to!, undefined, 120); }
      if (!res.ok) fails.push(`${r.floor.id} ${s.id} ${s.dest}: ${res.reason}`);
      sim.physics?.dispose();
    }
  }
  console.log(`  隠し ${n}（通り抜け ${loops}）`);
  assert.ok(loops >= 3, `通り抜けが出る: ${loops}`);
  assert.deepEqual(fails, []);
});
