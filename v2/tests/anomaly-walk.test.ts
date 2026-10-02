import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
import { anomalyDefs } from '../core/gen/anomaly/index.ts';
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
/** 異変を置かない調整（比べる用） */
const none = makeTuning({ 'anomaly.share.main': 0, 'anomaly.share.side': 0, 'anomaly.openMul': 0 }).tuning;

function exitWalk(floor: FloorLayout, R: Awaited<ReturnType<typeof loadRapier>>, tt = t): { ok: boolean; reason: string } {
  const sim = new Sim(floor, { tuning: tt, physics: new PhysicsWorld(R, 1 / 60) });
  const ex = floor.exits.find((e) => e.id === 'down')!;
  const goal: [number, number, number] = [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2];
  const res = walkTo(sim, 'exitStairs', goal);
  const reached = sim.drainEvents().some((e) => e.type === 'floor.exit');
  sim.physics?.dispose();
  return { ok: res.ok && reached, reason: res.reason || '出口に入れない' };
}

test('異変のあるフロアを、入口から出口まで歩ける（異変の無い同じフロアで歩けるなら、異変があっても歩ける）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0, onMain = 0;
  for (let w = 1; w <= 40; w++) {
    const key = { world: w, depth: 1 + (w % 9), variant: 0 };
    const r = generateFloorReport(key, t, { dress: dressCell });
    if (!r.anomalies.length) continue;
    n++;
    const res = exitWalk(r.floor, R);
    if (res.ok) { onMain += r.anomalies.length; continue; }
    // 異変の無い同じフロアでも歩けないなら、異変のせいではない（スイッチの扉など、歩く人が解けない仕掛け）
    const base = exitWalk(generateFloorReport(key, none, { dress: dressCell }).floor, R, none);
    if (base.ok) fails.push(`w${w} ${r.floor.id}: ${res.reason}（異変 ${r.anomalies.map((a) => `${a.def}@${a.cell}`).join(' ')}）`);
  }
  console.log(`  異変のあるフロア ${n}（歩けたフロアの異変 ${onMain}）`);
  assert.ok(n >= 30);
  assert.deepEqual(fails, []);
});

test('異変の部屋の開口は、ジャンプせずに両向きに通れる・見て回る位置は床の上', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  const kinds = new Set<string>();
  let n = 0;
  for (let w = 1; w <= 60; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 8), variant: w % 5 === 0 ? 1 : 0 }, t, { dress: dressCell });
    if (!r.anomalies.length) continue;
    const floor = r.floor;
    const cells = new Set(r.anomalies.map((a) => a.cell));
    for (const a of r.anomalies) kinds.add(a.def);
    const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (const p of floor.portals) {
      if (!p.cells.some((c) => cells.has(c))) continue;
      const axis = p.dir % 2 === 0 ? 2 : 0;
      const c = [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2];
      for (const s of [1, -1]) {
        n++;
        const from = [...c] as [number, number, number], to = [...c] as [number, number, number];
        from[axis] -= s * 0.9; to[axis] += s * 0.9;
        sim.teleport(0, [from[0], from[1] + 0.4, from[2]], 0);
        const yaw = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
        let ok = false;
        for (let i = 0; i < 260 && !ok; i++) {
          if (p.doorId) { const st = sim.stateOf(p.doorId) as { angle: number; target: number }; st.angle = 1; st.target = 1; }
          sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0, moveY: i < 20 ? 0 : 1 }]);
          if ((sim.players[0]!.pos[axis] - c[axis]!) * s > 0.55) ok = true;
        }
        if (!ok) fails.push(`${floor.id}@w${w} ${p.id} ${s > 0 ? '→' : '←'} ${sim.players[0]!.pos.map((v) => v.toFixed(2))}`);
      }
    }
    // 見て回る位置（入口のすぐ外）に立てる
    for (const s of r.gimmicks!.tour.filter((x) => x.label.startsWith('異変: '))) {
      sim.teleport(0, s.pos, s.yaw);
      for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND, yaw: s.yaw, pitch: 0 }]);
      const pl = sim.players[0]!;
      if (!(pl.onGround && Math.hypot(pl.pos[0] - s.pos[0], pl.pos[2] - s.pos[2]) < 0.05)) fails.push(`${floor.id}@w${w} ${s.label}（${s.cell}）: 立てない`);
    }
    sim.physics?.dispose();
  }
  console.log(`  開口 ${n}・異変 ${kinds.size} 種`);
  assert.ok(kinds.size >= anomalyDefs().length - 2, [...kinds].join(','));
  assert.deepEqual(fails, []);
});

test('浸水は遅く、軽い部屋は高く跳べる（ゾーンが効く）', async () => {
  const R = await loadRapier();
  const found = { flood: false, lowGravity: false };
  for (let w = 1; w <= 80 && !(found.flood && found.lowGravity); w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, t, { dress: dressCell });
    for (const a of r.anomalies) {
      if (a.def !== 'flood' && a.def !== 'lowGravity') continue;
      if (found[a.def]) continue;
      const cell = r.floor.cells.find((c) => c.id === a.cell)!;
      const z = cell.zones.find((x) => x.kind === (a.def === 'flood' ? 'water' : 'gravity'))!;
      const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      let p0: [number, number, number] = [(z.aabb.min[0] + z.aabb.max[0]) / 2, cell.floorY + 0.02, (z.aabb.min[2] + z.aabb.max[2]) / 2];
      // 段階 4 で足した: 頭の上に当たる物（浮かんだ家具・宙の足場）の無い所を選ぶ（真ん中の上に物が浮いていると跳んでも頭を打つ）
      const clear = (x: number, zz: number): boolean => !cell.boxes.some((b) => b.solid && b.min[1] > cell.floorY + 0.05 && b.min[1] < cell.floorY + cell.height - 0.2 && x + 0.6 > b.min[0] && x - 0.6 < b.max[0] && zz + 0.6 > b.min[2] && zz - 0.6 < b.max[2]) && !cell.boxes.some((b) => b.solid && b.max[1] > cell.floorY + 0.05 && b.min[1] < cell.floorY + 0.05 && x + 0.4 > b.min[0] && x - 0.4 < b.max[0] && zz + 0.4 > b.min[2] && zz - 0.4 < b.max[2]);
      if (a.def === 'lowGravity' && !clear(p0[0], p0[2])) {
        outer: for (let k = 1; k < 12; k++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
          const x = p0[0] + dx * k * 0.3, zz = p0[2] + dz * k * 0.3;
          if (x < z.aabb.min[0] + 0.5 || x > z.aabb.max[0] - 0.5 || zz < z.aabb.min[2] + 0.5 || zz > z.aabb.max[2] - 0.5) continue;
          if (clear(x, zz)) { p0 = [x, p0[1], zz]; break outer; }
        }
      }
      sim.teleport(0, p0, 0);
      for (let i = 0; i < 20; i++) sim.step([{ ...IDLE_COMMAND }]);
      const pl = sim.players[0]!;
      if (a.def === 'flood') {
        assert.ok(pl.inWater && pl.zoneSlow < 0.8, `${a.id}: 水の中`);
      } else {
        // 跳ぶ: 普通の重さの頂点（約 0.9 m）より高く上がる
        let top = pl.pos[1];
        sim.step([{ ...IDLE_COMMAND, jump: true }]);
        for (let i = 0; i < 120; i++) { sim.step([{ ...IDLE_COMMAND }]); top = Math.max(top, sim.players[0]!.pos[1]); }
        assert.ok(top - p0[1] > 1.4 || top >= cell.floorY + cell.height - 1.8, `${a.id}: 高く跳べる（${(top - p0[1]).toFixed(2)} m）`);
      }
      sim.physics?.dispose();
      found[a.def] = true;
    }
  }
  assert.ok(found.flood && found.lowGravity);
});
