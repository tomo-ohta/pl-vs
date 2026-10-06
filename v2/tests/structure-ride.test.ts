/**
 * フロアの形の動く所・一方通行の所を、実際に動かして確かめる（段階 4・フロアの形の担当）。
 * エレベーター（F24）・駅の車両（F35）・吹き抜けの縦穴への飛び込み（F31）・天井裏の網（F22）・下るだけのフロアの段差（F29）・
 * 一方通行の扉（F06 二重ループの近道・F29）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import type { PatternId } from '../core/gen/floor/themes.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout, PortalSpec } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();
type Rapier = Awaited<ReturnType<typeof loadRapier>>;
type V3 = [number, number, number];

const floorOf = (p: PatternId, w: number, dress = true): FloorLayout => generateFloorReport({ world: w, depth: 2 + (w % 6), variant: 0 }, t, { shape: p, noGimmicks: true, ...(dress ? { dress: dressCell } : {}) }).floor;
const simOf = (f: FloorLayout, R: Rapier): Sim => new Sim(f, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
const boxCenter = (b: { min: number[]; max: number[] }): V3 => [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
const exitsOf = (sim: Sim): string[] => sim.drainEvents().filter((e) => e.type === 'floor.exit').map((e) => String(e.data?.exit));

/** pos に立ち、少し待つ */
function stand(sim: Sim, pos: V3, yaw = 0): void {
  const p = sim.players[0]!;
  sim.teleport(0, [pos[0], pos[1] + 0.02, pos[2]], yaw);
  p.vel = [0, 0, 0];
  for (let i = 0; i < 20; i++) sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0 }]);
}

/** 今いる所から、target の方を向いて調べる（押す・開ける） */
function interactAt(sim: Sim, target: V3): void {
  const p = sim.players[0]!;
  const ex = target[0] - p.pos[0], ey = target[1] - (p.pos[1] + p.eye), ez = target[2] - p.pos[2];
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
}

/** yaw の向きへ sec 秒歩く（jump: 0.5 秒ごとに跳ぶ）。毎 tick に each を呼ぶ */
function walkDir(sim: Sim, yaw: number, sec: number, opts: { jump?: boolean; crouch?: boolean } = {}, each?: () => void): void {
  for (let i = 0; i < Math.round(sec / sim.dt); i++) {
    sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0, moveY: 1, jump: !!opts.jump && i % 30 === 0, crouch: !!opts.crouch }]);
    each?.();
  }
}
const yawTo = (from: V3, to: V3): number => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));

/** 扉の開口の、cell の側（0.9 m 手前）に立って扉を開けようとする。開いたか */
function tryOpen(sim: Sim, p: PortalSpec, cell: string): boolean {
  const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.dir]!;
  const c = [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2] as V3;
  const s = p.cells[0] === cell ? -1 : 1;
  stand(sim, [c[0] + s * d[0]! * 0.9, c[1], c[2] + s * d[1]! * 0.9]);
  interactAt(sim, [c[0], c[1] + 1.0, c[2]]);
  for (let i = 0; i < 90; i++) sim.step([{ ...IDLE_COMMAND }]);
  return sim.outputOf(p.doorId!, 'open') > 0.5 || ((sim.stateOf(p.doorId!) as { angle?: number } | undefined)?.angle ?? 0) > 0.3;
}

test('F24 エレベーター: かごのボタンを押すと扉が閉まり、揺れて、1 つ下の階の同じかごへ継ぎ目なく着いて扉が開く', async () => {
  const R = await loadRapier();
  for (let w = 1; w <= 3; w++) {
    const f = floorOf('elevator', w);
    const lift = f.entities.find((e) => e.type === 'shaftLift')!;
    const stops = lift.params.stops as { y: number; aabb: { min: V3; max: V3 } }[];
    const btn = f.entities.find((e) => e.id === String(lift.inputs!.call0).replace(/\.pressed$/, ''))!;
    const bc = boxCenter(btn.params.box as { min: number[]; max: number[] });
    const cc = boxCenter(stops[0]!.aabb);
    const l = Math.hypot(cc[0] - bc[0], cc[2] - bc[2]);
    const sim = simOf(f, R);
    stand(sim, [bc[0] + ((cc[0] - bc[0]) / l) * 0.8, stops[0]!.y, bc[2] + ((cc[2] - bc[2]) / l) * 0.8]);
    const before = [...sim.players[0]!.pos] as V3;
    interactAt(sim, bc);
    let rode = false, shut = false;
    const door0 = f.portals.find((p) => p.cells.includes(btn.cell) && p.kind === 'door')!.doorId!;
    for (let i = 0; i < Math.round((Number(lift.params.closeSec) + Number(lift.params.rideSec) + 2) / sim.dt); i++) {
      sim.step([{ ...IDLE_COMMAND }]);
      if (sim.outputOf(lift.id, 'riding') > 0.5) { rode = true; if (((sim.stateOf(door0) as { angle: number }).angle ?? 1) < 0.05) shut = true; }
    }
    const after = sim.players[0]!.pos;
    assert.ok(rode && shut, `${f.id}: 扉が閉まって動いた`);
    assert.ok(Math.abs(after[1] - before[1] - (stops[1]!.y - stops[0]!.y)) < 0.15, `${f.id}: 1 つ下の階へ ${before[1].toFixed(2)} → ${after[1].toFixed(2)}`);
    assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) < 0.2, `${f.id}: かごの中の同じ所（継ぎ目なし）`);
    assert.equal(sim.outputOf(lift.id, 'at'), 1);
    assert.equal(sim.outputOf(lift.id, 'open1'), 1, '着いた階の扉が開く');
    sim.physics?.dispose();
  }
});

test('F24 エレベーター: 誰も乗っていなければ動かない（扉が開き直す）', async () => {
  const R = await loadRapier();
  const f = floorOf('elevator', 2);
  const lift = f.entities.find((e) => e.type === 'shaftLift')!;
  const stops = lift.params.stops as { y: number; aabb: { min: V3; max: V3 } }[];
  const btn = f.entities.find((e) => e.id === String(lift.inputs!.call0).replace(/\.pressed$/, ''))!;
  const bc = boxCenter(btn.params.box as { min: number[]; max: number[] });
  const cc = boxCenter(stops[0]!.aabb);
  const sim = simOf(f, R);
  const l = Math.hypot(cc[0] - bc[0], cc[2] - bc[2]);
  stand(sim, [bc[0] + ((cc[0] - bc[0]) / l) * 0.8, stops[0]!.y, bc[2] + ((cc[2] - bc[2]) / l) * 0.8]);
  interactAt(sim, bc);
  // 押してすぐ、かごの外（ホール）へ出る
  sim.teleport(0, [cc[0], stops[0]!.y + 0.02, stops[0]!.aabb.max[2] + 2.0], 0);
  for (let i = 0; i < Math.round((Number(lift.params.closeSec) + Number(lift.params.rideSec) + 1) / sim.dt); i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.equal(sim.outputOf(lift.id, 'at'), 0, '動かない');
  assert.equal(sim.outputOf(lift.id, 'open0'), 1, '扉が開き直す');
  sim.physics?.dispose();
});

test('F35 駅: ホームから車両に乗ると、しばらくして扉が閉まり、走って、車両の出口から次のフロアへ', async () => {
  const R = await loadRapier();
  for (let w = 1; w <= 2; w++) {
    const f = floorOf('station', w);
    const ride = f.entities.find((e) => e.type === 'trainRide')!;
    const sim = simOf(f, R);
    const inner = boxCenter(ride.params.aabb as { min: number[]; max: number[] });
    const res = walkTo(sim, ride.cell, [inner[0], (ride.params.aabb as { min: number[] }).min[1]! + 0.1, inner[2] + 0.3], 300);
    assert.ok(res.ok, `${f.id}: 車両まで歩ける ${res.reason}`);
    sim.drainEvents();
    let rode = false, shut = true;
    const doors = f.entities.filter((e) => e.type === 'door' && String(e.inputs?.open ?? '').startsWith(ride.id)).map((e) => e.id);
    const total = Number(ride.params.dwellSec) + Number(ride.params.closeSec) + Number(ride.params.rideSec) + 3;
    const exits: string[] = [];
    for (let i = 0; i < Math.round(total / sim.dt) && !exits.length; i++) {
      sim.step([{ ...IDLE_COMMAND }]);
      if (sim.outputOf(ride.id, 'riding') > 0.5) {
        rode = true;
        for (const d of doors) if (((sim.stateOf(d) as { angle: number }).angle ?? 0) > 0.05) shut = false;
      }
      exits.push(...exitsOf(sim));
    }
    assert.ok(rode && shut, `${f.id}: 扉を閉めて走った`);
    assert.deepEqual(exits, ['train'], `${f.id}: 車両の出口`);
    sim.physics?.dispose();
  }
});

test('F31 吹き抜けの縦穴: 手すりの壊れた所から飛び込むと 2 つ先のフロアへ。手すりのある所からは落ちない', async () => {
  const R = await loadRapier();
  for (let w = 1; w <= 3; w++) {
    const f = floorOf('shaft', w);
    const gal = f.cells.find((c) => c.name === '吹き抜けの回廊')!;
    const v = f.cells.find((c) => c.name === '縦穴')!;
    const line = gal.boxes.find((b) => b.mat === 'yellowLine')!;
    const hc: V3 = [(v.footprint[0]!.x0 + v.footprint[0]!.x1) / 2, gal.floorY, (v.footprint[0]!.z0 + v.footprint[0]!.z1) / 2];
    const lc = boxCenter(line);
    const l = Math.hypot(lc[0] - hc[0], lc[2] - hc[2]);
    const out = (k: number): V3 => [hc[0] + ((lc[0] - hc[0]) / l) * k, gal.floorY, hc[2] + ((lc[2] - hc[2]) / l) * k];
    // 壊れた所から
    const sim = simOf(f, R);
    stand(sim, out(l + 0.8), yawTo(out(l + 0.8), hc));
    const exits: string[] = [];
    walkDir(sim, yawTo(out(l + 0.8), hc), 6, {}, () => exits.push(...exitsOf(sim)));
    assert.deepEqual(exits, ['shaft'], `${f.id}: 縦穴の底の出口`);
    // 反対側（手すりがある）から: 跳んでも落ちない
    const opp: V3 = [2 * hc[0] - out(l + 0.8)[0], gal.floorY, 2 * hc[2] - out(l + 0.8)[2]];
    stand(sim, opp, yawTo(opp, hc));
    sim.drainEvents();
    walkDir(sim, yawTo(opp, hc), 4, { jump: true });
    assert.deepEqual(exitsOf(sim), [], `${f.id}: 手すりから落ちない`);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - gal.floorY) < 0.5, `${f.id}: 回廊の床の上`);
    sim.physics?.dispose();
  }
});

test('F22 天井裏の網: 点検口の梯子段を上ると天井裏（しゃがんで進む）、ほかの部屋の点検口から下りられる', async () => {
  const R = await loadRapier();
  for (let w = 1; w <= 3; w++) {
    const f = floorOf('crawl', w);
    const holes = f.portals.filter((p) => p.kind === 'hole');
    assert.ok(holes.length >= 2, `${f.id}: 点検口`);
    const sim = simOf(f, R);
    const a = holes.find((p) => p.cells[1] === 'crawlB0')!, b = holes.find((p) => p.cells[1] === 'crawlB1')!;
    // 点検口のある部屋まで歩き、天井裏の背骨へ上る
    assert.ok(walkTo(sim, a.cells[0], undefined, 200).ok, `${f.id}: 点検口の部屋まで`);
    const up = walkTo(sim, 'crawlS0', undefined, 200);
    assert.ok(up.ok, `${f.id}: 天井裏へ ${up.reason}`);
    assert.ok(up.route.includes(a.id) || up.route.includes(b.id), `${f.id}: 点検口を通った ${up.route.join(' ')}`);
    assert.ok(sim.players[0]!.crouching, '天井裏ではしゃがんでいる（立てない）');
    // もう一方の点検口から下の部屋へ
    const down = walkTo(sim, b.cells[0], undefined, 200);
    assert.ok(down.ok, `${f.id}: 下の部屋へ ${down.reason}`);
    assert.ok(down.route.includes(b.id), `${f.id}: 点検口から下りた ${down.route.join(' ')}`);
    sim.physics?.dispose();
  }
});

test('F29 下るだけのフロア: 段差は飛び降りられるが、下からは跳んでも上がれない', async () => {
  const R = await loadRapier();
  let n = 0;
  for (let w = 1; w <= 3; w++) {
    const f = floorOf('descent', w, false);
    for (const c of f.cells.filter((x) => x.name === '段差')) {
      const top = c.boxes.filter((b) => b.kind === 'landing' && b.solid).reduce((a, b) => (b.max[1] > a.max[1] ? b : a));
      const F = c.footprint[0]!;
      // 段差の軸: 高い所（踊り場）が区画の途中で切れている向き
      const alongX = top.max[0] - top.min[0] < F.x1 - F.x0 - 0.6;
      // 段の面（高い所の端）と、低い側の向き
      const [lo, tlo, thi] = alongX ? [F.x0, top.min[0], top.max[0]] : [F.z0, top.min[2], top.max[2]];
      const s = tlo > lo + 0.5 ? -1 : 1; // 低い側が軸の負の向きなら -1
      const face = s < 0 ? tlo : thi;
      const mid = alongX ? (F.z0 + F.z1) / 2 : (F.x0 + F.x1) / 2;
      const at = (a: number, y: number): V3 => (alongX ? [a, y, mid] : [mid, y, a]);
      const sim = simOf(f, R);
      // 下から段の面へ向かって跳ぶ
      const low = at(face + s * 0.9, c.floorY);
      stand(sim, low, yawTo(low, at(face, c.floorY)));
      walkDir(sim, yawTo(low, at(face, c.floorY)), 4, { jump: true });
      assert.ok(sim.players[0]!.pos[1] < top.max[1] - 0.5, `${f.id} ${c.id}: 下から上がれない（${sim.players[0]!.pos[1].toFixed(2)}）`);
      // 上から飛び降りる
      const high = at(face - s * 0.9, top.max[1]);
      stand(sim, high, yawTo(high, low));
      walkDir(sim, yawTo(high, low), 2);
      assert.ok(sim.players[0]!.pos[1] < c.floorY + 0.3, `${f.id} ${c.id}: 飛び降りられる（${sim.players[0]!.pos[1].toFixed(2)}）`);
      n++;
      sim.physics?.dispose();
    }
  }
  assert.ok(n >= 3, `段差 ${n}`);
});

test('F06 二重ループの近道・F29 の扉: 一方通行の扉は、片側からだけ開けられる（近道は出口の側から）', async () => {
  const R = await loadRapier();
  let n = 0;
  for (let w = 1; w <= 3; w++) {
    for (const p of ['shortcut', 'descent'] as const) {
      const f = floorOf(p, w, false);
      const sim = simOf(f, R);
      for (const q of f.portals.filter((x) => x.doorId && !x.doorId.includes('secret'))) {
        const door = f.entities.find((e) => e.id === q.doorId)!;
        if (typeof door.params.openSide !== 'number') continue;
        const opens = q.cells.map((c) => { const s = simOf(f, R); const ok = tryOpen(s, q, c); s.physics?.dispose(); return ok; });
        assert.equal(opens.filter(Boolean).length, 1, `${f.id} ${q.id}: 片側だけ開く（${opens.join(',')}）`);
        if (p === 'shortcut' && q.cells.includes(f.spawn.cell)) assert.ok(!opens[q.cells.indexOf(f.spawn.cell)], `${f.id}: 入口の部屋の側からは開かない`);
        n++;
      }
      sim.physics?.dispose();
    }
  }
  assert.ok(n >= 3, `一方通行の扉 ${n}`);
});
