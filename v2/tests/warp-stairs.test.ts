/**
 * 階段の数（endlessStairs: W14）: 2 階と 1 階の見える範囲の箱が同じ（真下へずらすだけ）・上っても同じ踊り場（何度も移される）・
 * goal 回で上の階へ抜けて双子の部屋から元の部屋へ（歩く人）・下りれば来た扉へ戻れる・時間で抜けられる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
import { aabbCenter, type AABB } from '../core/math/aabb.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { faceTo, twinMismatch } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const ROOMS = findRooms('endlessStairs', 5, { maxWorld: 300 });
const cellOf = (f: FloorLayout, id: string) => f.cells.find((c) => c.id === id)!;

function simIn(room: GimmickRoom, tt = t): Sim {
  const sim = new Sim(room.floor, { tuning: tt, physics: new PhysicsWorld(RAPIER, 1 / 60) });
  sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], faceTo(room.inside, aabbCenter(room.cell.bounds)));
  return sim;
}

test('階段の数: 2 階の見える範囲は、真下の 1 階とまったく同じ箱（模様も 1 階と同じ基準）', () => {
  assert.ok(ROOMS.length >= 3, `階段の数: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const f = room.floor;
    const S = cellOf(f, `${room.cell.id}~stairs`);
    const r = S.footprint[0]!, y = S.floorY;
    // 2 階の右の段の途中から見える所: 右の段（面の箱 up.box の横の範囲）と、両端の踊り場（左の段の所は間の壁で見えない）
    const up = (room.floor.entities.find((e) => e.id === `${room.id}.stairs`)!.params.up as { box: AABB; dir: number }).box;
    const along = up.max[0] - up.min[0] > up.max[2] - up.min[2] ? 0 : 2;
    const lo = 5.8, hi = 10.4;
    const regions: AABB[] = [];
    const laneA: AABB = { min: [...up.min], max: [...up.max] };
    laneA.min[1] = y + lo; laneA.max[1] = y + hi;
    regions.push(laneA);
    for (const side of [0, 1]) {
      const a: AABB = { min: [r.x0 + 0.01, y + lo, r.z0 + 0.01], max: [r.x1 - 0.01, y + hi, r.z1 - 0.01] };
      if (side === 0) a.max[along] = up.min[along] - 0.01; else a.min[along] = up.max[along] + 0.01;
      regions.push(a);
    }
    for (const region of regions) assert.deepEqual(twinMismatch(f, { from: [0, 0, 0], to: [0, -3, 0], q: 0 }, region), [], `${f.id} ${room.cell.id}: 2 階 → 1 階`);
    // 1 階より上の段・踊り場は、0 階と同じ模様の基準（uvFrame で 3 m ごとに戻す）
    const framed = S.boxes.filter((b) => b.min[1] > y + 2.5 && b.uvFrame);
    assert.ok(framed.length > 20 && framed.every((b) => Math.abs(b.uvFrame!.offset[1] % 3) < 1e-9), '上の階の箱は 0 階の模様');
  }
});

test('階段の数: 上っても同じ踊り場（何度も 1 階ぶん戻される）・goal 回で上の階の扉から双子の部屋へ、元の部屋へ（歩く人）', () => {
  for (const room of ROOMS) {
    const sim = simIn(room);
    const ctl = `${room.id}.stairs`;
    const res = walkTo(sim, `${room.cell.id}~sq`, undefined, 240);
    assert.ok(res.ok, `${room.floor.id} ${room.cell.id}: 上の階の双子の部屋へ: ${res.reason}`);
    assert.equal(sim.outputOf(ctl, 'climbs'), t['warp.stairs.goal'], '上った回数');
    assert.equal(sim.outputOf(ctl, 'open'), 1);
    const back = walkTo(sim, room.cell.id, undefined, 60);
    assert.ok(back.ok, `${room.cell.id}: 元の部屋へ: ${back.reason}`);
    assert.ok(Math.abs(sim.players[0]!.pos[1] - room.cell.floorY) < 0.5);
  }
});

test('階段の数: 何階か上ったあと下りれば、上った回数だけ下りたところで来た扉に着く', () => {
  // 上の階へ抜けないように goal を大きく（上の階の扉を目指して 25 秒上り、そこから下りる）
  const tt = makeTuning({ 'warp.stairs.goal': 20 }).tuning;
  for (const room of findRooms('endlessStairs', 3, { t: tt, maxWorld: 300 })) {
    const sim = simIn(room, tt);
    const S = cellOf(room.floor, `${room.cell.id}~stairs`);
    const ctl = `${room.id}.stairs`;
    assert.ok(walkTo(sim, S.id, undefined, 60).ok);
    const top = room.floor.portals.find((p) => p.cells.includes(S.id) && p.cells.includes(`${room.cell.id}~sq`))!;
    // 上の階の扉の内側 0.9 m（開口の向きは双子の部屋から階段室へ）
    const dv = [[0, 1], [1, 0], [0, -1], [-1, 0]][top.dir]!;
    const goal: [number, number, number] = [(top.aabb.min[0] + top.aabb.max[0]) / 2 + dv[0]! * 0.9, top.aabb.min[1], (top.aabb.min[2] + top.aabb.max[2]) / 2 + dv[1]! * 0.9];
    const up = walkTo(sim, S.id, goal, 25);
    assert.ok(!up.ok, '上の階へは抜けない');
    const climbs = Number(sim.outputOf(ctl, 'climbs'));
    assert.ok(climbs >= 2, `${room.cell.id}: 何度も上った（${climbs}）`);
    // 下りて来た扉（R' の扉）へ
    const res = walkTo(sim, `${room.cell.id}~a1`, undefined, 120);
    assert.ok(res.ok, `${room.cell.id}: 来た扉へ: ${res.reason}`);
    assert.equal(sim.outputOf(ctl, 'climbs'), 0, '下りた分だけ数が減る');
  }
});

test('階段の数: 抜けられなくても giveUpSec 秒で上へ抜けられる・決定的', () => {
  const tt = makeTuning({ 'warp.stairs.giveUpSec': 30, 'warp.stairs.goal': 20 }).tuning;
  const room = findRooms('endlessStairs', 1, { t: tt })[0]!;
  const sim = simIn(room, tt);
  assert.ok(walkTo(sim, `${room.cell.id}~stairs`, undefined, 60).ok);
  for (let i = 0; i < 60 * 32; i++) sim.step([{ moveX: 0, moveY: 0, yaw: 0, pitch: 0, jump: false, dash: false, crouch: false, interact: null }]);
  assert.equal(sim.outputOf(`${room.id}.stairs`, 'open'), 1);
  for (const r of ROOMS.slice(0, 2)) assert.equal(JSON.stringify(regenerate(r).cells.filter((c) => c.pocket === r.id).map((c) => c.boxes.length)), JSON.stringify(r.floor.cells.filter((c) => c.pocket === r.id).map((c) => c.boxes.length)));
});
