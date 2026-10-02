/**
 * 光の仕掛けの続き（mirrorBeam・emergencyPower・switchOffDoor・sneakLights・fogBeacons）:
 * 鏡で筋を受光器へ導くと扉の鍵が開く・何も無い壁に当て続けると開く・筋は箱で止まる / 非常電源は短い間だけ扉の鍵を開ける /
 * 照明を消すと扉が現れる / 灯りをつけずに廊下を進むと扉が現れる / 霧の誘導灯の道を歩けば渡れ、外れると落ちる
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dir } from '../core/math/vec.ts';
import { traceBeam } from '../core/sim/parts/sense/beam.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { entitiesOf, goTo, labSimDoors, stand, T } from './sense-util.ts';

const opp = (d: Dir): Dir => ((d + 2) % 4) as Dir;
const size = (dir: Dir, w: number, d: number): { w: number; d: number } => (dir % 2 === 0 ? { w, d } : { w: d, d: w });
const out = (sim: Sim, ref: string): number => { const i = ref.lastIndexOf('.'); return sim.outputOf(ref.slice(0, i), ref.slice(i + 1)); };
function lookAt(sim: Sim, p: readonly number[]): { yaw: number; pitch: number } {
  const pl = sim.players[0]!;
  const dx = p[0]! - pl.pos[0], dy = p[1]! - (pl.pos[1] + pl.eye), dz = p[2]! - pl.pos[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
/** 部品 id の箱（params.box）の前（部屋の真ん中の側へ 1.0 m）に立って調べる */
function poke(sim: Sim, id: string): void {
  const e = sim.floor.entities.find((x) => x.id === id)!;
  const b = e.params.box as { min: number[]; max: number[] };
  const c = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
  const cell = sim.floor.cells[0]!.bounds;
  const cx = (cell.min[0] + cell.max[0]) / 2, cz = (cell.min[2] + cell.max[2]) / 2;
  const l = Math.max(1e-6, Math.hypot(cx - c[0]!, cz - c[2]!));
  sim.teleport(0, [c[0]! + ((cx - c[0]!) / l) * 1.0, sim.floor.cells[0]!.floorY + 0.02, c[2]! + ((cz - c[2]!) / l) * 1.0], 0);
  stand(sim, 0.1);
  const look = lookAt(sim, c);
  sim.step([{ ...IDLE_COMMAND, ...look, interact: look }]);
  stand(sim, 0.1, look);
}

test('光の筋: 鏡で 90° ずつ曲がる・壁か箱で止まる', () => {
  const rects = [[-1, -1, 5, 5]];
  assert.deepEqual(traceBeam([0, 0, 1, 0], [[2, 0]], [0], rects).path, [[0, 0], [2, 0], [2, 5]]);
  assert.deepEqual(traceBeam([0, 0, 1, 0], [[2, 0]], [1], rects).path, [[0, 0], [2, 0], [2, -1]]);
  assert.deepEqual(traceBeam([0, 0, 1, 0], [[2, 0]], [0], rects, [[1, -0.5, 1.5, 0.5]]).path, [[0, 0], [1, 0]]);
  // 2 枚で折り返す
  assert.deepEqual(traceBeam([0, 0, 1, 0], [[2, 0], [2, 3]], [0, 1], rects).path, [[0, 0], [2, 0], [2, 3], [-1, 3]]);
});

test('鏡で光を導く: はじめは受光器に当たらず扉は開かない・鏡を解の向きにすると当たり、鍵が開いたまま・何も無い壁の印に当て続けると開く', async () => {
  let targets = 0;
  for (const dir of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2, 3]) {
    const r = await labSimDoors('mirrorBeam', { ...size(dir, 6, 8), entry: dir, exit: opp(dir), seed: seed * 7 + dir });
    assert.ok(r, `向き ${dir} seed ${seed}: 組める`);
    const { room, sim } = r;
    const beam = entitiesOf(room.floor, 'beam')[0]!;
    const door = room.floor.entities.find((e) => e.id === 'door1')!;
    stand(sim, 0.2);
    assert.equal(sim.outputOf(beam.id, 'lit'), 0, 'はじめは当たらない');
    const lock = door.inputs!.lock!;
    assert.equal(out(sim, lock), 1, '部屋の中の人には鍵');
    const ids = beam.params.mirrorIds as string[], sol = beam.params.solution as number[];
    // 裏の壁の並び（解でない並びのうち、筋の止まる所が target の印）
    const target = beam.params.target as number[] | null;
    const offer = room.offers.find((o) => o.hook === 'mirror.blankWall');
    if (target && offer) {
      const ms = beam.params.mirrors as number[][];
      const n = ms.length;
      let key: number[] | null = null;
      for (let k = 0; k < 1 << n && !key; k++) {
        const st = [...Array(n).keys()].map((i) => (k >> i) & 1);
        const path = traceBeam(beam.params.emitter as number[], ms, st, beam.params.rects as number[][]).path;
        const end = path[path.length - 1]!;
        if (Math.hypot(end[0]! - target[0]!, end[1]! - target[1]!) < 0.3) key = st;
      }
      assert.ok(key, '印に当たる並びがある');
      ids.forEach((id, i) => { if ((sim.outputOf(id, 'state') > 0.5 ? 1 : 0) !== key![i]) poke(sim, id); });
      assert.equal(sim.outputOf(beam.id, 'target'), 1, '印に当たる');
      stand(sim, T['sense.mirror.targetSec'] + 0.2);
      assert.equal(out(sim, offer.revealOutput!), 1, '当て続けると開く');
      targets++;
    }
    ids.forEach((id, i) => { if ((sim.outputOf(id, 'state') > 0.5 ? 1 : 0) !== sol[i]) poke(sim, id); });
    assert.equal(sim.outputOf(beam.id, 'lit'), 1, `向き ${dir} seed ${seed}: 解の向きで当たる`);
    stand(sim, 0.1);
    assert.equal(out(sim, lock), 0, '鍵が開く');
    // 鏡を回しても開いたまま
    poke(sim, ids[0]!);
    assert.equal(sim.outputOf(beam.id, 'lit'), 0);
    assert.equal(out(sim, lock), 0, '開いたまま');
  }
  assert.ok(targets >= 4, `何も無い壁の印のある部屋: ${targets}`);
});

test('非常電源: レバーを引く間だけ非常灯が点き、出口の扉の鍵が開く・残り時間で戻る・戻ると鍵', async () => {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const r = (await labSimDoors('emergencyPower', { ...size(dir, 6, 9), entry: dir, exit: opp(dir), seed: 5 + dir }))!;
    assert.ok(r);
    const { room, sim } = r;
    const lever = entitiesOf(room.floor, 'lever')[0]!;
    const sec = Number(lever.params.sec);
    assert.ok(sec >= T['sense.power.minSec'] && sec <= T['sense.power.maxSec'], `持つ秒数 ${sec}`);
    const lock = room.floor.entities.find((e) => e.id === 'door1')!.inputs!.lock!;
    const lamp = room.floor.entities.find((e) => e.type === 'lamp' && e.id.endsWith('.emergency'))!;
    stand(sim, 0.2);
    assert.equal(out(sim, lock), 1);
    assert.equal(sim.outputOf(lamp.id, 'on'), 0);
    poke(sim, lever.id);
    assert.equal(sim.outputOf(lever.id, 'on'), 1, `向き ${dir}: 引ける`);
    assert.equal(out(sim, lock), 0, '鍵が開く');
    assert.equal(sim.outputOf(lamp.id, 'on'), 1, '非常灯');
    stand(sim, sec / 2);
    const left = sim.outputOf(lever.id, 'left');
    assert.ok(left > 0 && left < sec * 0.6, `残り ${left}`);
    stand(sim, sec / 2 + 0.3);
    assert.equal(sim.outputOf(lever.id, 'on'), 0, '戻る');
    assert.equal(out(sim, lock), 1, '鍵に戻る');
    // 部屋の外（出口の側）にいる人には鍵を掛けない
    sim.teleport(0, [room.cell.bounds.max[0] + 3, 0.02, room.cell.bounds.max[2] + 3], 0);
    stand(sim, 0.1);
    assert.equal(out(sim, lock), 0);
  }
});

test('照明を消すと現れる扉: スイッチで照明が消え、少しして壁が開く・点け直すと照明が戻る', async () => {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const r = (await labSimDoors('switchOffDoor', { ...size(dir, 5, 6), entry: dir, exit: null, seed: 2 + dir }))!;
    assert.ok(r);
    const { room, sim } = r;
    const sw = entitiesOf(room.floor, 'lever')[0]!;
    const offer = room.offers.find((o) => o.hook === 'switch.off')!;
    assert.ok(offer.required, '必ず付ける');
    const lights = room.floor.entities.find((e) => e.type === 'lamp' && e.id.endsWith('.lights'))!;
    stand(sim, 0.3);
    assert.equal(sim.outputOf(lights.id, 'on'), 1);
    poke(sim, sw.id);
    assert.equal(sim.outputOf(lights.id, 'on'), 0, '消える');
    assert.equal(out(sim, offer.revealOutput!), 0, 'すぐには開かない');
    stand(sim, T['sense.switch.darkSec'] + 0.1);
    assert.equal(out(sim, offer.revealOutput!), 1, '開く');
    poke(sim, sw.id);
    assert.equal(sim.outputOf(lights.id, 'on'), 1, '点け直せる');
    assert.ok(room.floor.entities.some((e) => e.type === 'senseFx' && e.params.fx === 'glowDoor' && e.params.lamp === lights.id), '光る縁は照明が消えると見える');
  }
});

test('人感センサーの灯りをつけずに進む: 歩くと灯りがつき扉は出ない・廊下を出て、しゃがみ歩きで奥まで進むと灯りがつかず扉が出る', async () => {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const r = (await labSimDoors('sneakLights', { ...size(dir, 2.2, 11), entry: dir, exit: opp(dir), seed: 3 + dir, kind: 'corridor' as 'room' }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const offer = room.offers.find((o) => o.hook === 'sneak.dark')!;
    assert.ok(offer.required);
    const far = room.floor.entities.find((e) => e.id.endsWith('.far'))!;
    const a = far.params.aabb as { min: number[]; max: number[] };
    const fx = (a.min[0]! + a.max[0]!) / 2, fz = (a.min[2]! + a.max[2]!) / 2;
    const lamps = room.floor.entities.filter((e) => e.type === 'lamp' && /\.lamp\d+$/.test(e.id));
    // 歩く: 灯りがつく
    assert.ok(goTo(sim, fx, fz, { maxSec: 10 }), '奥まで歩ける');
    stand(sim, 0.8);
    assert.ok(lamps.some((l) => sim.outputOf(l.id, 'on') > 0.5), '歩いた所の灯りがつく');
    assert.equal(out(sim, offer.revealOutput!), 0, '扉は出ない');
    // 廊下を出て、入口からしゃがみ歩き
    sim.teleport(0, [room.cell.bounds.max[0] + 4, 0.02, room.cell.bounds.max[2] + 4], 0);
    stand(sim, T['sense.sneak.holdSec'] + 0.3);
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    stand(sim, 0.2, { crouch: true });
    assert.ok(goTo(sim, fx, fz, { maxSec: 20, crouch: true }), '奥までしゃがみ歩き');
    stand(sim, 0.7, { crouch: true });
    assert.ok(lamps.every((l) => sim.outputOf(l.id, 'on') < 0.5), `向き ${dir}: 灯りはつかない`);
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: 扉が出る`);
  }
});

test('霧の誘導灯: 霧が濃い・道の脇に誘導灯・道をたどると出口の床へ渡れる・まっすぐ進むと落ちる・偽の道は横の壁へ', async () => {
  let fakes = 0, ok = 0;
  for (const dir of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const r = await labSimDoors('fogBeacons', { ...size(dir, 6.5, 11), entry: dir, exit: opp(dir), seed: seed * 5 + dir, entryAt: 0.4, exitAt: 0.6 });
    if (!r) continue;
    ok++;
    const { room, sim } = r;
    assert.ok(room.cell.render?.fog && room.cell.render.fog.far <= T['sense.beacon.fogFar'] + 1e-9, '霧');
    const fx = entitiesOf(room.floor, 'senseFx').find((e) => e.params.fx === 'beacons')!;
    const beacons = fx.params.beacons as { pos: number[]; order: number; fake: boolean }[];
    assert.ok(beacons.filter((b) => !b.fake).length >= 4, '誘導灯');
    const path = fx.params.path as number[][];
    const y = room.cell.floorY;
    for (const p of path) assert.ok(goTo(sim, p[0]!, p[1]!, { maxSec: 10 }), `向き ${dir}: 道をたどれる`);
    assert.ok(sim.players[0]!.pos[1] > y - 0.1, `向き ${dir} seed ${seed}: 落ちない`);
    if (fx.params.fake) { fakes++; assert.ok(room.offers.some((o) => o.hook === 'beacon.fake'), '偽の道の先に隠しの元'); }
    // 入口の床の端からまっすぐ出口の方へ: 折れ点があれば落ちる
    if (path.length > 2) {
      sim.teleport(0, [path[0]![0]!, y + 0.02, path[0]![1]!], 0);
      const last = path[path.length - 1]!;
      goTo(sim, last[0]!, last[1]!, { maxSec: 6, until: (s) => s.players[0]!.pos[1] < y - 0.8 });
      assert.ok(sim.players[0]!.pos[1] < y - 0.8, `向き ${dir}: 道を外れると落ちる`);
    }
  }
  assert.ok(ok >= 6, `組めた部屋 ${ok}`);
  assert.ok(fakes >= 2, `偽の道 ${fakes}`);
});
