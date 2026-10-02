/**
 * 光の床の部屋（beamFloor・spotRide・lightBands・lookBridge）: 4 つの向きで組める・規則どおりに渡れる・規則を破ると落ちる・
 * 落ちたら階段で入口の床へ戻れる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dir } from '../core/math/vec.ts';
import { bandPhase, spotCenter } from '../core/sim/parts/sense/floor.ts';
import type { Sim } from '../core/sim/sim.ts';
import { walkTo } from './helpers/bot.ts';
import { senseBotOptions } from './helpers/sense-bot.ts';
import { labRoom } from './helpers/gimmick-lab.ts';
import { entitiesOf, fell, goTo, labSim, stand, stepToward, T } from './sense-util.ts';

const DEFS = ['beamFloor', 'spotRide', 'lightBands', 'lookBridge'] as const;
const DIRS: Dir[] = [0, 1, 2, 3];
/** 入口の壁に沿う部屋の幅 w・奥行き d（入口から出口へ） */
const size = (dir: Dir, w: number, d: number): { w: number; d: number } => (dir % 2 === 0 ? { w, d } : { w: d, d: w });

test('光の床: 入口の向き 4 つ・部屋の大きさで組める（穴・固い床・床板・隠しの元）', () => {
  for (const def of DEFS) {
    let built = 0;
    for (const dir of DIRS) for (const [w, d] of [[6, 8], [8, 11], [5.2, 7]] as const) {
      const room = labRoom(def, { ...size(dir, w, d), entry: dir, exit: ((dir + 2) % 4) as Dir, seed: 3 + dir });
      if (!room) continue;
      built++;
      const lf = entitiesOf(room.floor, 'lightFloor');
      assert.equal(lf.length, 1, `${def}: 光の床の部品`);
      assert.ok((lf[0]!.params.tiles as number[][]).length >= 2, `${def}: 床板`);
      assert.ok(room.offers.some((o) => o.modes.includes('present')), `${def}: 穴の底の隠しの元`);
    }
    assert.ok(built >= 8, `${def}: 組めた部屋 ${built}`);
  }
});

/** 入口の床（入口の内側）から、出口の床（出口の内側）へ */
async function crossing(def: string, dir: Dir): Promise<{ sim: Sim; a: [number, number]; b: [number, number]; y: number; floor: string } | null> {
  const r = await labSim(def, { ...size(dir, 7, 9), entry: dir, exit: ((dir + 2) % 4) as Dir, seed: 11 });
  if (!r) return null;
  const { room, sim } = r;
  stand(sim, 0.3);
  return { sim, a: [room.inside[0], room.inside[2]], b: [room.exitInside![0], room.exitInside![2]], y: room.cell.floorY, floor: room.floor.entities.find((e) => e.type === 'lightFloor')!.id };
}

test('照らした所だけある床: 懐中電灯で前を照らして歩けば渡れる・消していると落ちる・落ちたら階段で戻れる', async () => {
  for (const dir of DIRS) {
    const c = (await crossing('beamFloor', dir))!;
    assert.ok(goTo(c.sim, c.b[0], c.b[1], { pitch: -0.8, flashlight: true }) && !fell(c.sim, c.y), `向き ${dir}: 照らして渡れる`);
    const d = (await crossing('beamFloor', dir))!;
    goTo(d.sim, d.b[0], d.b[1], { pitch: -0.8, flashlight: false, maxSec: 6 });
    assert.ok(fell(d.sim, d.y), `向き ${dir}: 懐中電灯を消していると落ちる`);
    stand(d.sim, 1);
    // 戻るときは懐中電灯を消して（照らした床の上を通る道を選ばず、階段だけで）
    senseBotOptions.flashlight = false;
    const back = walkTo(d.sim, d.sim.floor.cells[0]!.id, [d.a[0], d.y, d.a[1]], 60);
    senseBotOptions.flashlight = true;
    assert.ok(back.ok && Math.abs(d.sim.players[0]!.pos[1] - d.y) < 0.1, `向き ${dir}: 階段で入口の床へ戻れる（${back.reason}）`);
  }
});

test('照らした所だけある床: 床の上で止まって前を見続けると、足元が消えて落ちる / 足元を照らせば落ちない', async () => {
  const c = (await crossing('beamFloor', 0))!;
  const mid: [number, number] = [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2];
  goTo(c.sim, mid[0], mid[1], { pitch: -0.8 });
  assert.ok(!fell(c.sim, c.y));
  stand(c.sim, 0.6, { pitch: -1.45, flashlight: true });
  assert.ok(!fell(c.sim, c.y), '足元を照らしていれば落ちない');
  stand(c.sim, 3, { pitch: 0.6, flashlight: true });
  assert.ok(fell(c.sim, c.y), '上を照らしていると落ちる');
});

test('動く光の中だけ床: 光の円が来るのを待ち、円の真ん中について歩けば渡れる / 円から外れると落ちる', async () => {
  for (const dir of DIRS) {
    const c = (await crossing('spotRide', dir))!;
    const spec = c.sim.floor.entities.find((e) => e.id === c.floor)!;
    const path = spec.params.spotPath as number[][];
    const near = path[0]!, far = path[1]!;
    // 入口側の端で止まっている円を待つ（入口の床の上で）
    const atStart = (): boolean => { const sp = spotCenter(spec.params, c.sim.tick * c.sim.dt); return Math.hypot(sp[0] - near[0]!, sp[1] - near[1]!) < 0.05; };
    for (let i = 0; i < 60 * 30 && !atStart(); i++) stand(c.sim, c.sim.dt);
    assert.ok(atStart() && !fell(c.sim, c.y), '円が入口側に来る');
    // 円の真ん中について歩く（止まっている間に乗り、動いたらついて行き、向こうで止まったら降りる）
    let ok = false, left = false;
    for (let i = 0; i < 60 * 40 && !ok; i++) {
      const sp = spotCenter(spec.params, (c.sim.tick + 1) * c.sim.dt);
      if (Math.hypot(sp[0] - far[0]!, sp[1] - far[1]!) < 0.05) left = true;
      const target: [number, number] = left ? c.b : sp;
      stepToward(c.sim, target[0], target[1]);
      if (fell(c.sim, c.y)) break;
      const p = c.sim.players[0]!.pos;
      if (Math.hypot(p[0] - c.b[0], p[2] - c.b[1]) < 0.4) ok = true;
    }
    assert.ok(ok, `向き ${dir}: 円について渡れる`);
    // 円の道の真ん中で止まって待つと、円が去って落ちる
    const d = (await crossing('spotRide', dir))!;
    const mid = [(path[0]![0]! + path[1]![0]!) / 2, (path[0]![1]! + path[1]![1]!) / 2];
    // 円が真ん中を通る時に乗って、そのまま止まる
    for (let i = 0; i < 60 * 40; i++) {
      const sp = spotCenter(spec.params, (d.sim.tick + 1) * d.sim.dt);
      if (Math.hypot(sp[0] - mid[0]!, sp[1] - mid[1]!) < 0.2) break;
      stand(d.sim, d.sim.dt);
    }
    d.sim.teleport(0, [mid[0]!, d.y + 0.02, mid[1]!], 0);
    stand(d.sim, 6);
    assert.ok(fell(d.sim, d.y), `向き ${dir}: 止まっていると円が去って落ちる`);
  }
});

test('光の帯の橋: 点いたばかりの帯をまっすぐ渡れば渡れる・消えた帯の上では落ちる', async () => {
  for (const dir of DIRS) {
    const c = (await crossing('lightBands', dir))!;
    const spec = c.sim.floor.entities.find((e) => e.id === c.floor)!;
    const tiles = spec.params.tiles as number[][];
    const phase = spec.params.phase as number[];
    const on = spec.params.onSec as number, off = spec.params.offSec as number;
    // 帯 0 の入口側の端へ行き、帯 0 が点いた瞬間に渡る
    const r = tiles[0]!;
    const cx = (r[0]! + r[2]!) / 2, cz = (r[1]! + r[3]!) / 2;
    const alongX = r[2]! - r[0]! > r[3]! - r[1]!;
    const nearEnd: [number, number] = alongX ? [Math.abs(r[0]! - c.a[0]) < Math.abs(r[2]! - c.a[0]) ? r[0]! - 0.5 : r[2]! + 0.5, cz] : [cx, Math.abs(r[1]! - c.a[1]) < Math.abs(r[3]! - c.a[1]) ? r[1]! - 0.5 : r[3]! + 0.5];
    const farEnd: [number, number] = alongX ? [nearEnd[0] < cx ? r[2]! + 0.5 : r[0]! - 0.5, cz] : [cx, nearEnd[1] < cz ? r[3]! + 0.5 : r[1]! - 0.5];
    goTo(c.sim, nearEnd[0], nearEnd[1]);
    assert.ok(!fell(c.sim, c.y), '入口の床の上');
    for (let i = 0; i < 60 * 20; i++) {
      const left = bandPhase((c.sim.tick + 1) * c.sim.dt, on, off, phase[0]!);
      if (left > on - 0.1) break;
      stand(c.sim, c.sim.dt);
    }
    assert.ok(goTo(c.sim, farEnd[0], farEnd[1], { maxSec: 8 }) && !fell(c.sim, c.y), `向き ${dir}: 点いた帯を渡れる`);
    // 帯の真ん中で、消えるまで待つと落ちる
    const d = (await crossing('lightBands', dir))!;
    d.sim.teleport(0, [cx, d.y + 0.02, cz], 0);
    stand(d.sim, on + off + 0.5);
    assert.ok(fell(d.sim, d.y), `向き ${dir}: 帯が消えると落ちる`);
  }
});

test('見ている間だけある橋: 前を見て渡れば渡れる / 途中で振り返ると落ちる', async () => {
  for (const dir of DIRS) {
    const c = (await crossing('lookBridge', dir))!;
    const spec = c.sim.floor.entities.find((e) => e.id === c.floor)!;
    const tiles = spec.params.tiles as number[][];
    const first = tiles[0]!, last = tiles[tiles.length - 1]!;
    const s: [number, number] = [(first[0]! + first[2]!) / 2, (first[1]! + first[3]!) / 2];
    const e: [number, number] = [(last[0]! + last[2]!) / 2, (last[1]! + last[3]!) / 2];
    // 橋の手前（入口の床の上）から、橋の向こう（出口の床の上）へ
    const ux = e[0] - s[0], uz = e[1] - s[1], l = Math.hypot(ux, uz);
    const before: [number, number] = [s[0] - (ux / l) * 0.9, s[1] - (uz / l) * 0.9];
    const after: [number, number] = [e[0] + (ux / l) * 0.9, e[1] + (uz / l) * 0.9];
    goTo(c.sim, before[0], before[1]);
    stand(c.sim, 0.3, { yaw: Math.atan2(-ux, -uz), pitch: -0.4 });
    assert.ok(goTo(c.sim, after[0], after[1], { maxSec: 10, pitch: -0.4 }) && !fell(c.sim, c.y), `向き ${dir}: 前を見て渡れる`);
    const d = (await crossing('lookBridge', dir))!;
    goTo(d.sim, before[0], before[1]);
    stand(d.sim, 0.3, { yaw: Math.atan2(-ux, -uz), pitch: -0.4 });
    const mid: [number, number] = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2];
    goTo(d.sim, mid[0], mid[1], { maxSec: 6, pitch: -0.4 });
    assert.ok(!fell(d.sim, d.y), '真ん中までは渡れる');
    stand(d.sim, 2.5, { yaw: Math.atan2(ux, uz) });
    assert.ok(fell(d.sim, d.y), `向き ${dir}: 振り返ると橋が消えて落ちる`);
  }
});

test('光の床: 隣り合う壁に入口と出口がある部屋（L 字に渡る）でも、歩く人が遊び方どおりに渡れる', async () => {
  const fails: string[] = [];
  let n = 0;
  for (const def of ['beamFloor', 'spotRide', 'lookBridge'] as const) {
    for (const dir of DIRS) for (const turn of [1, 3]) {
      const r = await labSim(def, { w: 8, d: 8, entry: dir, exit: ((dir + turn) % 4) as Dir, entryAt: 0.35, exitAt: 0.65, seed: 21 + dir });
      if (!r) continue;
      n++;
      const { room, sim } = r;
      const res = walkTo(sim, room.cell.id, [room.exitInside![0], room.cell.floorY, room.exitInside![2]], 90);
      if (!res.ok || fell(sim, room.cell.floorY)) fails.push(`${def} 向き ${dir}→${(dir + turn) % 4}: ${res.reason || '落ちた'}`);
    }
  }
  assert.ok(n >= 12, `L 字の部屋: ${n}`);
  assert.deepEqual(fails, []);
});

test('光の床: 同じ seed なら同じ部屋（決定的）', () => {
  for (const def of DEFS) {
    const a = labRoom(def, { w: 7, d: 9, entry: 0, exit: 2, seed: 5 })!, b = labRoom(def, { w: 7, d: 9, entry: 0, exit: 2, seed: 5 })!;
    assert.equal(JSON.stringify(a.floor), JSON.stringify(b.floor));
  }
  assert.ok(T['sense.lightPit.depthM'] > 2);
});
