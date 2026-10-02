// 段階 4・oddity の部屋まるごとの異変を歩く: どの異変の部屋も入口から入って、ほかの開口から出られる（歩く人・実際の移動）。
// 触れられる異変の振る舞い: 虚空に落ちると入口へ・雪に足跡・海の波は浜へ押す・風は押す・水たまりは水・時刻は部屋の中だけ進む
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { ODDITY_CATALOG } from '../core/gen/catalog/oddity.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();

/** 範囲の中で、体（半径 0.45 m・高さ 1.8 m）が何にも当たらない床の点 */
function freeSpot(s: Sim, a: { min: number[]; max: number[] }, y: number): [number, number, number] {
  for (let k = 0; k <= 8; k++) for (let i = 0; i <= 8; i++) {
    const x = a.min[0]! + 0.5 + ((a.max[0]! - a.min[0]! - 1) * (i + 0.5)) / 9, z = a.min[2]! + 0.5 + ((a.max[2]! - a.min[2]! - 1) * ((k + 4) % 9 + 0.5)) / 9;
    if (!s.colliders.query(x - 0.45, y + 0.05, z - 0.45, x + 0.45, y + 1.8, z + 0.45).length) return [x, y + 0.02, z];
  }
  return [(a.min[0]! + a.max[0]!) / 2, y + 0.02, (a.min[2]! + a.max[2]!) / 2];
}
const EXISTING = new Set(['flood', 'fog', 'upsideDown', 'tint']);
const MINE = [...new Set(ODDITY_CATALOG.flatMap((e) => e.impl.filter((m) => m.kind === 'anomaly' && !EXISTING.has(m.id)).map((m) => m.id)))];

/** 異変 id を置いた見本のフロア（world を順に試す） */
function showcase(id: string, from = 1): GenReport | null {
  for (let w = from; w < from + 10; w++) {
    const r = generateFloorReport({ world: w, depth: 2, variant: 0 }, t, { showcase: { gimmicks: [], anomalies: [id] }, dress: dressCell });
    if (r.anomalies.some((a) => a.def === id)) return r;
  }
  return null;
}

test('oddity: どの異変の部屋も、入口から入ってほかの開口から出られる（歩く人）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let walks = 0;
  for (const id of MINE) {
    const r = showcase(id);
    if (!r) { fails.push(`${id}: 置けない`); continue; }
    const a = r.anomalies.find((x) => x.def === id)!;
    const stop = r.gimmicks!.tour.find((s) => s.cell === a.cell && s.label.startsWith('異変: '))!;
    const others = r.floor.portals.filter((p) => p.cells.includes(a.cell)).map((p) => (p.cells[0] === a.cell ? p.cells[1] : p.cells[0]));
    for (const to of others) {
      const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      sim.teleport(0, stop.pos, stop.yaw);
      for (let i = 0; i < 20; i++) sim.step([{ ...IDLE_COMMAND, yaw: stop.yaw }]);
      // まず部屋の中へ（入口の外から）。行き先が入口の向こうなら、入ってから戻る
      let res = walkTo(sim, a.cell, undefined, 60);
      if (res.ok) res = walkTo(sim, to, undefined, 90);
      walks++;
      if (!res.ok) fails.push(`${id}@${r.floor.id} ${a.cell} → ${to}: ${res.reason}`);
      sim.physics?.dispose();
    }
  }
  console.log(`  歩いた ${walks}`);
  assert.deepEqual(fails, []);
});

test('oddity: 触れられる異変の振る舞い（虚空・雪の足跡・波・風・水たまり・時刻）', async () => {
  const R = await loadRapier();
  const sim = (r: GenReport): Sim => new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
  const run = (s: Sim, sec: number, c = { ...IDLE_COMMAND }): void => { for (let i = 0; i < Math.round(sec * 60); i++) s.step([c]); };

  // 壁と床が欠ける: 穴に落ちると、虚空の底で入口の前へ戻される
  {
    const r = showcase('void')!;
    const a = r.anomalies.find((x) => x.def === 'void')!;
    const fall = r.floor.entities.find((e) => e.id.startsWith(`${a.id}.`) && e.type === 'respawnZone')!;
    const z = fall.params.aabb as { min: number[]; max: number[] };
    const s = sim(r);
    const cell = r.floor.cells.find((c) => c.id === a.cell)!;
    s.teleport(0, [(z.min[0]! + z.max[0]!) / 2, cell.floorY + 0.3, (z.min[2]! + z.max[2]!) / 2], 0);
    let back = false;
    for (let i = 0; i < 240 && !back; i++) { s.step([{ ...IDLE_COMMAND }]); back = s.drainEvents().some((e) => e.type === 'player.respawn' && e.data?.cause !== 'teleport'); }
    assert.ok(back, '虚空に落ちると戻される');
    const to = fall.params.to as number[];
    const p = s.players[0]!.pos;
    assert.ok(Math.hypot(p[0] - to[0]!, p[2] - to[2]!) < 0.3 && p[1] >= cell.floorY - 0.05, `入口の前へ: ${p.map((v) => v.toFixed(2))}`);
    s.physics?.dispose();
  }
  // 雪の室内: 歩くと足跡が残る
  {
    const r = showcase('snow')!;
    const a = r.anomalies.find((x) => x.def === 'snow')!;
    const trail = r.floor.entities.find((e) => e.id === `${a.id}.trail`)!;
    const s = sim(r);
    const stop = r.gimmicks!.tour.find((x) => x.cell === a.cell)!;
    s.teleport(0, stop.pos, stop.yaw);
    walkTo(s, a.cell, undefined, 30);
    run(s, 1.5, { ...IDLE_COMMAND, yaw: s.players[0]!.yaw, moveY: 1 });
    const n = ((s.stateOf(trail.id)?.prints as number[] | undefined) ?? []).length / 4;
    assert.ok(n >= 2, `足跡 ${n}`);
    s.physics?.dispose();
  }
  // 室内の海: 寄せる波が浜へ押し戻す
  {
    const r = showcase('sea')!;
    const a = r.anomalies.find((x) => x.def === 'sea')!;
    const w = r.floor.entities.find((e) => e.id === `${a.id}.waves`)!;
    // 押す範囲（開口の前は押さないので、いちばん広い範囲）
    type B = { min: number[]; max: number[] };
    const area = (q: B): number => (q.max[0]! - q.min[0]!) * (q.max[2]! - q.min[2]!);
    const zb = ((w.params.aabbs as B[] | undefined) ?? [w.params.aabb as B]).slice().sort((p, q) => area(q) - area(p))[0]!;
    const v = w.params.vector as number[];
    const s = sim(r);
    const cell = r.floor.cells.find((c) => c.id === a.cell)!;
    s.teleport(0, freeSpot(s, zb, cell.floorY), 0);
    run(s, 0.1);
    assert.ok(s.players[0]!.inWater, '海の中は水');
    // 寄せている間を探す
    let pushed = 0;
    for (let i = 0; i < 60 * 10; i++) {
      const before = s.players[0]!.pos.slice();
      s.step([{ ...IDLE_COMMAND }]);
      if (s.outputOf(w.id, 'push')) pushed += (s.players[0]!.pos[0] - before[0]!) * v[0]! + (s.players[0]!.pos[2] - before[2]!) * v[2]!;
    }
    assert.ok(pushed > 0.5, `浜へ押し戻される ${pushed.toFixed(2)} m`);
    s.physics?.dispose();
  }
  // 風の向き: 部屋の中ほどで、風下へ押される
  {
    const r = showcase('wind')!;
    const a = r.anomalies.find((x) => x.def === 'wind')!;
    const cell = r.floor.cells.find((c) => c.id === a.cell)!;
    const z = cell.zones.find((x) => x.kind === 'force')!;
    const s = sim(r);
    s.teleport(0, freeSpot(s, z.aabb, cell.floorY), 0);
    run(s, 0.5);
    const p0 = s.players[0]!.pos.slice();
    run(s, 0.6);
    const d = (s.players[0]!.pos[0] - p0[0]!) * z.vector![0] + (s.players[0]!.pos[2] - p0[2]!) * z.vector![2];
    assert.ok(d > 0.2, `風下へ ${d.toFixed(2)} m`);
    s.physics?.dispose();
  }
  // 雨漏り: 床の水たまりは水（水の足音・少し遅い）
  {
    const r = showcase('leak')!;
    const a = r.anomalies.find((x) => x.def === 'leak')!;
    const cell = r.floor.cells.find((c) => c.id === a.cell)!;
    const z = cell.zones.find((x) => x.kind === 'water')!;
    const s = sim(r);
    s.teleport(0, [(z.aabb.min[0] + z.aabb.max[0]) / 2, cell.floorY + 0.02, (z.aabb.min[2] + z.aabb.max[2]) / 2], 0);
    run(s, 0.3);
    assert.ok(s.players[0]!.inWater && s.players[0]!.zoneSlow < 1, '水たまりの中');
    s.physics?.dispose();
  }
  // 時刻が進む部屋: 部屋の中にいる間だけ時刻が進む
  {
    const r = showcase('dayCycle')!;
    const a = r.anomalies.find((x) => x.def === 'dayCycle')!;
    const clock = r.floor.entities.find((e) => e.id === `${a.id}.clock`)!;
    const s = sim(r);
    run(s, 0.1);
    const ph0 = s.outputOf(clock.id, 'phase');
    run(s, 2);
    assert.equal(s.outputOf(clock.id, 'phase'), ph0, '外では進まない');
    const stop = r.gimmicks!.tour.find((x) => x.cell === a.cell)!;
    s.teleport(0, stop.pos, stop.yaw);
    walkTo(s, a.cell, undefined, 30);
    run(s, 5);
    assert.ok(s.outputOf(clock.id, 'phase') > ph0 + 0.03, `中では進む ${s.outputOf(clock.id, 'phase').toFixed(3)}`);
    s.physics?.dispose();
  }
});
