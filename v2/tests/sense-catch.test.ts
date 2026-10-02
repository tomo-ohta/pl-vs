/**
 * 捕まると戻される部屋（消える照明 blinkoutHall・明滅の位相 lightWave・サーチライト searchlight・だるまさん daruma）:
 * 規則を破ると戻される・守れば捕まらない・歩く人が遊び方どおりに捕まらずに抜けられる・わざと何度も捕まると隅（隠しの扉の前）へ
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dir } from '../core/math/vec.ts';
import { patternAt, searchSpot } from '../core/sim/parts/sense/light.ts';
import type { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { labRoom } from './helpers/gimmick-lab.ts';
import { entitiesOf, labSim, stand } from './sense-util.ts';

const DIRS: Dir[] = [0, 1, 2, 3];
const size = (dir: Dir, w: number, d: number): { w: number; d: number } => (dir % 2 === 0 ? { w, d } : { w: d, d: w });
const opp = (d: Dir): Dir => ((d + 2) % 4) as Dir;
/** 照明が点いてから消えるまで待つ（消えた瞬間に戻る） */
function waitDark(sim: Sim, c: { on: number; off: number; phase: number; flicker: number }): void {
  const left = (): number => patternAt(sim.tick * sim.dt, c.on, c.off, c.phase, c.flicker).left;
  for (let i = 0; i < 60 * 20 && left() < 0; i++) stand(sim, sim.dt);
  for (let i = 0; i < 60 * 20 && left() > 0; i++) stand(sim, sim.dt);
}
const respawns = (sim: Sim, from: number): number => sim.drainEvents().filter((e) => e.type === 'player.respawn' && e.tick >= from).length;

/** 歩く人で、入口の内側から出口の内側まで。戻された回数を数える */
function botCross(sim: Sim, room: { cell: { id: string; floorY: number }; exitInside: number[] | null }, sec = 120): { ok: boolean; reason: string; caught: number } {
  sim.drainEvents();
  let caught = 0;
  const step = sim.step.bind(sim);
  (sim as unknown as { step: typeof sim.step }).step = (c) => { step(c); for (const e of sim.drainEvents()) if (e.type === 'player.respawn') caught++; };
  const res = walkTo(sim, room.cell.id, [room.exitInside![0]!, room.cell.floorY, room.exitInside![2]!], sec);
  (sim as unknown as { step: typeof sim.step }).step = step;
  return { ok: res.ok, reason: res.reason, caught };
}

test('消える照明: 組める・消えている間に島の外にいると入口へ戻される・島の中なら戻されない・歩く人が捕まらずに抜けられる', async () => {
  let n = 0;
  for (const dir of DIRS) {
    const r = await labSim('blinkoutHall', { ...size(dir, 7, 13), entry: dir, exit: opp(dir), seed: 3 + dir });
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const dark = entitiesOf(room.floor, 'darkHazard')[0]!;
    const clock = dark.params.clock as { on: number; off: number; phase: number; flicker: number };
    const pools = (dark.params.pools as number[][]).filter((q) => q.length === 3);
    assert.ok(pools.length >= 3, '消えない灯りの島がある');
    // 消えるのを待って、島から離れた所（部屋の真ん中の、道から外れた所）に立つ
    waitDark(sim, clock);
    // 島・開口の前の灯りから離れた点
    const b = room.cell.bounds;
    let spot: [number, number, number] = [0, 0, 0], far = -1;
    for (let gx = b.min[0] + 0.8; gx < b.max[0] - 0.8; gx += 0.25) for (let gz = b.min[2] + 0.8; gz < b.max[2] - 0.8; gz += 0.25) {
      const m = Math.min(...pools.map((q) => Math.hypot(gx - q[0]!, gz - q[1]!) - q[2]!));
      if (m > far) { far = m; spot = [gx, room.cell.floorY + 0.02, gz]; }
    }
    const t0 = sim.tick;
    sim.teleport(0, spot, 0);
    sim.drainEvents();
    stand(sim, 2.0);
    assert.ok(respawns(sim, t0 + 1) >= 1, `向き ${dir}: 暗闇にいると戻される`);
    // 島の中で暗闇を過ごす
    const isle = pools[pools.length - 1]!;
    waitDark(sim, clock);
    sim.teleport(0, [isle[0]!, room.cell.floorY + 0.02, isle[1]!], 0);
    const t1 = sim.tick;
    stand(sim, clock.off);
    assert.equal(respawns(sim, t1 + 1), 0, `向き ${dir}: 島の中なら戻されない`);
    // 歩く人
    const c2 = (await labSim('blinkoutHall', { ...size(dir, 7, 13), entry: dir, exit: opp(dir), seed: 3 + dir }))!;
    const res = botCross(c2.sim, c2.room);
    assert.ok(res.ok && res.caught === 0, `向き ${dir}: 歩く人が抜けられる（${res.reason} 捕まった ${res.caught}）`);
    n++;
  }
  assert.equal(n, 4);
});

test('消える照明（BL02）: 真っ暗な間に印の壁の前にいると、隠しの出力が入る', async () => {
  const r = (await labSim('blinkoutHall', { w: 7, d: 13, entry: 0, exit: 2, seed: 5 }))!;
  const offer = r.room.offers.find((o) => o.hook === 'blinkout.dark');
  assert.ok(offer && offer.modes.includes('appear'), '隠しの元');
  const [id, port] = [offer.revealOutput!.slice(0, offer.revealOutput!.lastIndexOf('.')), offer.revealOutput!.slice(offer.revealOutput!.lastIndexOf('.') + 1)];
  const zone = entitiesOf(r.room.floor, 'zoneSensor').find((e) => e.id.endsWith('.secretZone'))!;
  const a = zone.params.aabb as { min: number[]; max: number[] };
  const dark = entitiesOf(r.room.floor, 'darkHazard')[0]!;
  const clock = dark.params.clock as { on: number; off: number; phase: number; flicker: number };
  const { sim } = r;
  sim.teleport(0, [(a.min[0]! + a.max[0]!) / 2, r.room.cell.floorY + 0.02, (a.min[2]! + a.max[2]!) / 2], 0);
  // 明るい間は入らない
  for (let i = 0; i < 60 * 20 && patternAt(sim.tick * sim.dt, clock.on, clock.off, clock.phase, clock.flicker).left > 1.5; i++) stand(sim, sim.dt);
  assert.equal(sim.outputOf(id, port), 0, '明るい間は現れない');
  for (let i = 0; i < 60 * 3 && !sim.outputOf(id, port); i++) stand(sim, sim.dt);
  assert.equal(sim.outputOf(id, port), 1, '真っ暗になると現れる');
});

test('明滅の位相: 光の帯が来ない所で止まっていると戻される・入口の灯りでは戻されない・歩く人が帯について抜けられる', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('lightWave', { ...size(dir, 2.4, 15), entry: dir, exit: opp(dir), seed: 7 + dir, kind: 'room' }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    assert.ok(entitiesOf(room.floor, 'pattern').length >= 5, '区間ごとの照明');
    // 入口の灯りの中で、波の 2 周期待つ
    const dark = entitiesOf(room.floor, 'darkHazard')[0]!;
    const w = dark.params.wave as { period: number };
    const t0 = sim.tick;
    stand(sim, w.period * 2);
    assert.equal(respawns(sim, t0 + 1), 0, `向き ${dir}: 入口の灯りでは戻されない`);
    // 真ん中で止まる
    const b = room.cell.bounds;
    sim.teleport(0, [(b.min[0] + b.max[0]) / 2, room.cell.floorY + 0.02, (b.min[2] + b.max[2]) / 2], 0);
    const t1 = sim.tick;
    stand(sim, w.period * 1.2);
    assert.ok(respawns(sim, t1 + 1) >= 1, `向き ${dir}: 真ん中で止まっていると戻される`);
    const c2 = (await labSim('lightWave', { ...size(dir, 2.4, 15), entry: dir, exit: opp(dir), seed: 7 + dir, kind: 'room' }))!;
    const res = botCross(c2.sim, c2.room);
    assert.ok(res.ok && res.caught === 0, `向き ${dir}: 歩く人が帯について抜けられる（${res.reason} 捕まった ${res.caught}）`);
  }
});

test('サーチライト: 光の円に入ると帯の手前へ戻される・歩く人は円が遠ざかるのを待って捕まらずに渡れる・何度も捕まると隅へ', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('searchlight', { ...size(dir, 8, 12), entry: dir, exit: opp(dir), seed: 9 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const e = entitiesOf(room.floor, 'searchlight')[0]!;
    const lanes = e.params.lanes as number[][];
    assert.ok(lanes.length >= 2, `向き ${dir}: 帯 ${lanes.length}`);
    // 帯 0 の円の上に立つ → 戻される（帯の手前へ）
    const sp = searchSpot(lanes[0]!, (sim.tick + 1) * sim.dt);
    const t0 = sim.tick;
    sim.teleport(0, [sp[0], room.cell.floorY + 0.02, sp[1]], 0);
    stand(sim, 0.1);
    assert.ok(respawns(sim, t0 + 1) >= 1, `向き ${dir}: 見つかって戻される`);
    assert.equal(sim.outputOf(e.id, 'caught'), 1);
    const p = sim.players[0]!;
    const back = (e.params.backs as number[][])[0]!;
    assert.ok(p.pos[0] >= back[0]! - 0.01 && p.pos[0] <= back[2]! + 0.01 && p.pos[2] >= back[1]! - 0.01 && p.pos[2] <= back[3]! + 0.01, '帯の手前の床へ');
    // もう一度 → 隅へ
    const sp2 = searchSpot(lanes[0]!, (sim.tick + 1) * sim.dt);
    sim.teleport(0, [sp2[0], room.cell.floorY + 0.02, sp2[1]], 0);
    stand(sim, 0.1);
    const corner = e.params.corner as number[];
    assert.ok(Math.hypot(p.pos[0] - corner[0]!, p.pos[2] - corner[1]!) < 0.05 && sim.outputOf(e.id, 'corner') === 1, `向き ${dir}: 2 回目は隅へ`);
    // 歩く人
    const c2 = (await labSim('searchlight', { ...size(dir, 8, 12), entry: dir, exit: opp(dir), seed: 9 + dir }))!;
    const res = botCross(c2.sim, c2.room);
    assert.ok(res.ok && res.caught === 0, `向き ${dir}: 歩く人が渡れる（${res.reason} 捕まった ${res.caught}）`);
  }
});

test('だるまさん: 見られている間に動くと入口へ・止まっていれば捕まらない・歩く人が捕まらずに抜けられる・3 回捕まると隅へ', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('daruma', { ...size(dir, 7, 11), entry: dir, exit: opp(dir), seed: 13 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const e = entitiesOf(room.floor, 'daruma')[0]!;
    const st = (): { phase: number; t: number; dur: number } => sim.stateOf(e.id) as { phase: number; t: number; dur: number };
    // 部屋の真ん中へ
    const b = room.cell.bounds;
    const mid: [number, number, number] = [(b.min[0] + b.max[0]) / 2, room.cell.floorY + 0.02, (b.min[2] + b.max[2]) / 2];
    sim.teleport(0, mid, 0);
    // 見ている間、止まっている → 捕まらない
    for (let i = 0; i < 60 * 10 && st().phase !== 2; i++) stand(sim, sim.dt);
    const t0 = sim.tick;
    stand(sim, 0.6);
    assert.equal(sim.outputOf(e.id, 'caught'), 0, `向き ${dir}: 止まっていれば捕まらない`);
    assert.equal(st().phase, 2, '見ている間');
    // 見ている間に動く → 入口へ
    for (let i = 0; i < 12; i++) sim.step([{ ...IDLE_COMMAND, moveY: 1, yaw: 0 }]);
    assert.equal(sim.outputOf(e.id, 'caught'), 1, `向き ${dir}: 動くと捕まる`);
    assert.ok(respawns(sim, t0) >= 1);
    // あと 2 回捕まると隅へ
    for (let k = 0; k < 2; k++) {
      sim.teleport(0, mid, 0);
      for (let i = 0; i < 60 * 12 && st().phase !== 2; i++) stand(sim, sim.dt);
      stand(sim, 0.1);
      for (let i = 0; i < 12; i++) sim.step([{ ...IDLE_COMMAND, moveY: 1, yaw: 0 }]);
    }
    const corner = e.params.corner as number[] | undefined;
    if (corner) {
      const p = sim.players[0]!;
      assert.ok(sim.outputOf(e.id, 'corner') === 1 && Math.hypot(p.pos[0] - corner[0]!, p.pos[2] - corner[2]!) < 0.3, `向き ${dir}: 3 回目は隅へ（${sim.outputOf(e.id, 'caught')} 回）`);
    }
    const c2 = (await labSim('daruma', { ...size(dir, 7, 11), entry: dir, exit: opp(dir), seed: 13 + dir }))!;
    const res = botCross(c2.sim, c2.room);
    assert.ok(res.ok && res.caught === 0, `向き ${dir}: 歩く人が抜けられる（${res.reason} 捕まった ${res.caught}）`);
  }
});

test('捕まる部屋: 同じ seed なら同じ部屋（決定的）', () => {
  for (const def of ['blinkoutHall', 'lightWave', 'searchlight', 'daruma']) {
    const o = { w: 7, d: 13, entry: 0 as Dir, exit: 2 as Dir, seed: 5, kind: 'room' as const };
    assert.equal(JSON.stringify(labRoom(def, o)?.floor), JSON.stringify(labRoom(def, o)?.floor), def);
  }
});
