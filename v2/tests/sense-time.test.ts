/**
 * 時間の仕掛け（floodRise・rewindRoom・loopMinute・closingTime）: 水が満ちて引き、浮いた木箱が道になる・上に立つと運ばれる・
 * 頭まで浸かると入口へ・浮く箱から壁の口へ / 部屋が巻き戻る（場所もレバーも）/ 同じ 1 分のくり返し（電話・鍵の開く秒・入口へ戻る）/
 * 閉店で照明が消えていき、闇に捕まると入口へ戻って照明が戻る
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dir } from '../core/math/vec.ts';
import { closingStep, floodLevel, floodParams, loopSec } from '../core/sim/parts/sense/time.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { entitiesOf, goTo, labSimDoors, stand, T } from './sense-util.ts';

const opp = (d: Dir): Dir => ((d + 2) % 4) as Dir;
const size = (dir: Dir, w: number, d: number): { w: number; d: number } => (dir % 2 === 0 ? { w, d } : { w: d, d: w });
const out = (sim: Sim, ref: string): number => { const i = ref.lastIndexOf('.'); return sim.outputOf(ref.slice(0, i), ref.slice(i + 1)); };
const now = (sim: Sim): number => sim.tick * sim.dt;
function until(sim: Sim, f: (s: Sim) => boolean, maxSec: number, c = {}): boolean {
  for (let i = 0; i < maxSec * 60; i++) { if (f(sim)) return true; sim.step([{ ...IDLE_COMMAND, yaw: sim.players[0]!.yaw, ...c }]); }
  return f(sim);
}
function poke(sim: Sim, id: string): void {
  const e = sim.floor.entities.find((x) => x.id === id)!;
  const b = (e.params.box ?? e.params.phone) as { min: number[]; max: number[] };
  const c = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
  const bb = sim.floor.cells[0]!.bounds;
  const cx = (bb.min[0] + bb.max[0]) / 2, cz = (bb.min[2] + bb.max[2]) / 2;
  const l = Math.max(1e-6, Math.hypot(cx - c[0]!, cz - c[2]!));
  sim.teleport(0, [c[0]! + ((cx - c[0]!) / l) * 1.0, sim.floor.cells[0]!.floorY + 0.02, c[2]! + ((cz - c[2]!) / l) * 1.0], 0);
  stand(sim, 0.1);
  const pl = sim.players[0]!;
  const dx = c[0]! - pl.pos[0], dy = c[1]! - (pl.pos[1] + pl.eye), dz = c[2]! - pl.pos[2];
  const look = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  sim.step([{ ...IDLE_COMMAND, ...look, interact: look }]);
  stand(sim, 0.1, look);
}

test('増水: 水面は周期で満ちて引く（なめらかに）', () => {
  const o = { bottom: -2.4, top: -0.22, low: 5, rise: 7, high: 7, drain: 5, phase: 0 };
  assert.equal(floodLevel(1, o).stage, 'low');
  assert.equal(floodLevel(1, o).level, -2.4);
  assert.equal(floodLevel(13, o).stage, 'high');
  assert.equal(floodLevel(13, o).level, -0.22);
  const mid = floodLevel(8.5, o);
  assert.ok(mid.stage === 'rise' && mid.level > -2.4 && mid.level < -0.22);
  assert.equal(floodLevel(24 + 1, o).stage, 'low');
});

test('増水: 満ちると木箱が床の高さまで浮いて渡れる・箱に乗ると運ばれる・頭まで浸かると入口へ・浮く箱の前に壁の口', async () => {
  let rooms = 0, secrets = 0;
  for (const dir of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2, 3]) {
    const r = await labSimDoors('floodRise', { ...size(dir, 6.5, 9.5), entry: dir, exit: opp(dir), seed: seed * 3 + dir, entryAt: 0.45, exitAt: 0.55 });
    if (!r) continue;
    rooms++;
    const { room, sim } = r;
    const f = entitiesOf(room.floor, 'flood')[0]!;
    const o = floodParams({ spec: f });
    const y = room.cell.floorY;
    const cross = f.params.cross as number[][];
    // 水が引いている間: 手前の端から渡ると落ちる
    assert.ok(until(sim, (s) => floodLevel(now(s), o).stage === 'low', 30));
    sim.teleport(0, [cross[0]![0]!, y + 0.02, cross[0]![1]!], 0);
    goTo(sim, cross[1]![0]!, cross[1]![1]!, { maxSec: 4, until: (s) => s.players[0]!.pos[1] < y - 0.8 });
    assert.ok(sim.players[0]!.pos[1] < y - 0.8, `向き ${dir}: 水が引いていると落ちる`);
    // 底にいると、満ちて頭まで浸かり、入口へ戻される
    sim.drainEvents();
    assert.ok(until(sim, (s) => s.drainEvents().some((e) => e.type === 'cue' && e.data?.name === 'flood.drown') || s.players[0]!.pos[1] > y - 0.1, 30));
    assert.ok(sim.players[0]!.pos[1] > y - 0.1, '入口の床へ戻る');
    // 満ちている間: 手前の端から歩いて向こうの端へ
    assert.ok(until(sim, (s) => { const q = floodLevel(now(s), o); return q.stage === 'high' && q.left > 5; }, 40));
    sim.teleport(0, [cross[0]![0]!, y + 0.02, cross[0]![1]!], 0);
    assert.ok(goTo(sim, cross[1]![0]!, cross[1]![1]!, { maxSec: 6 }), `向き ${dir} seed ${seed}: 渡れる`);
    assert.ok(sim.players[0]!.pos[1] > y - 0.1, '浮いた木箱の上を渡った');
    // 引いている間に箱に乗って待つと、満ちるときに一緒に上がる
    assert.ok(until(sim, (s) => floodLevel(now(s), o).stage === 'low' && floodLevel(now(s), o).left > 2, 40));
    const c0 = (f.params.crates as number[][])[1]!;
    const tops = () => (sim.stateOf(f.id) as { tops: number[] }).tops;
    sim.teleport(0, [(c0[0]! + c0[2]!) / 2, tops()[1]! + 0.05, (c0[1]! + c0[3]!) / 2], 0);
    assert.ok(until(sim, (s) => floodLevel(now(s), o).stage === 'high', 30));
    stand(sim, 0.3);
    assert.ok(sim.players[0]!.pos[1] > y - 0.15, `向き ${dir}: 箱と一緒に上がる（${(sim.players[0]!.pos[1] - y).toFixed(2)}）`);
    const offer = room.offers.find((x) => x.hook === 'flood.high');
    if (offer) {
      secrets++;
      assert.deepEqual(offer.modes, ['present']);
      assert.equal(offer.doorway.y, y, '床の高さの口');
    }
  }
  assert.ok(rooms >= 4, `組めた部屋 ${rooms}`);
  assert.ok(secrets >= 2, `壁の口 ${secrets}`);
});

test('巻き戻る部屋: 周期で、部屋の中の人は前に巻き戻ったときの場所へ・レバーも戻る・レバーを引くと扉の鍵が開く', async () => {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const r = (await labSimDoors('rewindRoom', { ...size(dir, 6, 8), entry: dir, exit: opp(dir), seed: 4 + dir }))!;
    assert.ok(r);
    const { room, sim } = r;
    const time = entitiesOf(room.floor, 'rewind')[0]!;
    const lever = entitiesOf(room.floor, 'lever')[0]!;
    const period = Number(time.params.period);
    assert.ok(period >= T['sense.rewind.minSec'] && period <= T['sense.rewind.maxSec']);
    const lock = room.floor.entities.find((e) => e.id === 'door1')!.inputs!.lock!;
    // 巻き戻った直後まで待つ（入口の内側にいる）
    stand(sim, 0.1);
    assert.ok(until(sim, (s) => s.outputOf(time.id, 'pulse') > 0.5, period + 1));
    const anchor = [...sim.players[0]!.pos];
    stand(sim, 0.2);
    assert.equal(out(sim, lock), 1);
    poke(sim, lever.id);
    assert.equal(sim.outputOf(lever.id, 'on'), 1, '引ける');
    assert.equal(out(sim, lock), 0, '鍵が開く');
    // 次に巻き戻ると、さっきの場所へ戻り、レバーも戻る
    assert.ok(until(sim, (s) => s.outputOf(time.id, 'pulse') > 0.5, period + 1));
    stand(sim, 0.05);
    assert.ok(Math.hypot(sim.players[0]!.pos[0] - anchor[0]!, sim.players[0]!.pos[2] - anchor[2]!) < 0.3, `向き ${dir}: 前の場所へ戻る`);
    assert.equal(sim.outputOf(lever.id, 'on'), 0, 'レバーも戻る');
    assert.equal(out(sim, lock), 1, '鍵に戻る');
  }
});

test('同じ 1 分のくり返し: 決まった秒に電話が鳴り（出ると扉）、決まった秒に鍵が開く・終わりに中にいると入口へ', async () => {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const r = (await labSimDoors('loopMinute', { ...size(dir, 6, 7), entry: dir, exit: opp(dir), seed: 6 + dir }))!;
    assert.ok(r);
    const { room, sim } = r;
    const loop = entitiesOf(room.floor, 'loopClock')[0]!;
    const period = Number(loop.params.period), phase = Number(loop.params.phase);
    const lock = room.floor.entities.find((e) => e.id === 'door1')!.inputs!.lock!;
    const sec = (): number => loopSec(now(sim), period, phase);
    // 鍵の開く秒
    assert.ok(until(sim, () => sec() > T['sense.loop.openFrom'] + 0.5 && sec() < T['sense.loop.openTo'] - 0.5, period + 1));
    assert.equal(sim.outputOf(loop.id, 'open'), 1);
    assert.equal(out(sim, lock), 0, '鍵が開く');
    // 1 分の終わり: 中にいる人は入口へ
    const far = room.exitInside!;
    sim.teleport(0, [far[0], 0.02, far[2]], 0);
    assert.ok(until(sim, () => sec() < 1, period + 1));
    stand(sim, 0.1);
    assert.ok(Math.hypot(sim.players[0]!.pos[0] - room.inside[0], sim.players[0]!.pos[2] - room.inside[2]) < 0.6, `向き ${dir}: 入口へ戻る`);
    // 電話: 鳴っている間に出る
    const offer = room.offers.find((o) => o.hook === 'loop.phone');
    assert.ok(until(sim, () => sim.outputOf(loop.id, 'ringing') > 0.5, period + 1), '鳴る');
    assert.ok(sec() >= T['sense.loop.ringFrom'] && sec() < T['sense.loop.ringTo']);
    poke(sim, loop.id);
    assert.equal(sim.outputOf(loop.id, 'answered'), 1, '出られる');
    assert.equal(sim.outputOf(loop.id, 'ringing'), 0, '鳴りやむ');
    if (offer) assert.equal(out(sim, offer.revealOutput!), 1, '扉が開く');
  }
});

test('閉店のアナウンス: 奥へ入ると放送・少しして入口の側から消えていく・闇に捕まると入口へ戻り照明も戻る・走れば先に出口へ', async () => {
  assert.equal(closingStep(1, { delay: 3.5, speed: 2.2, seg: 2, n: 6 }), 0);
  assert.equal(closingStep(3.6, { delay: 3.5, speed: 2.2, seg: 2, n: 6 }), 1);
  assert.equal(closingStep(100, { delay: 3.5, speed: 2.2, seg: 2, n: 6 }), 5);
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const r = (await labSimDoors('closingTime', { ...size(dir, 5, 12), entry: dir, exit: opp(dir), seed: 2 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const closing = entitiesOf(room.floor, 'closing')[0]!;
    const lamps = room.floor.entities.filter((e) => e.type === 'lamp' && /\.lamp\d+$/.test(e.id)).sort((a, b) => Number(a.id.match(/\d+$/)![0]) - Number(b.id.match(/\d+$/)![0]));
    const ex = room.exitInside!;
    // 奥へ入って立ち止まる → 放送 → 入口の側から消える → 闇に捕まって入口へ・照明が戻る
    const mid: [number, number] = [(room.inside[0] + ex[0]) / 2, (room.inside[2] + ex[2]) / 2];
    sim.drainEvents();
    assert.ok(goTo(sim, mid[0], mid[1], { maxSec: 6 }));
    stand(sim, 0.2);
    assert.ok(sim.drainEvents().some((e) => e.type === 'cue' && e.data?.name === 'closing.announce'), '放送');
    assert.ok(until(sim, (s) => s.outputOf(lamps[0]!.id, 'on') < 0.5, 6), '入口の側から消える');
    assert.ok(sim.outputOf(lamps[lamps.length - 1]!.id, 'on') > 0.5, '奥はまだ点いている');
    assert.ok(until(sim, (s) => Math.hypot(s.players[0]!.pos[0] - room.inside[0], s.players[0]!.pos[2] - room.inside[2]) < 0.6, 20), `向き ${dir}: 闇に捕まって入口へ`);
    stand(sim, 0.2);
    assert.equal(sim.outputOf(closing.id, 'step'), 0, '照明が戻る');
    assert.ok(lamps.every((l) => sim.outputOf(l.id, 'on') > 0.5));
    // 走れば先に出口へ
    let caught = false;
    sim.drainEvents();
    assert.ok(goTo(sim, ex[0], ex[2], { maxSec: 10, dash: true, until: (s) => { caught ||= s.drainEvents().some((e) => e.type === 'player.respawn'); return caught; } }), '出口の前へ');
    assert.ok(!caught, '捕まらない');
  }
});
