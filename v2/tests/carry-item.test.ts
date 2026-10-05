/**
 * 物を持つ仕組み（core/sim/parts/carry）: 調べて拾う・Q で置く（台の上・枠へ吸い付く・壁の中には置かない）・上を向いて / 走って投げる・
 * 入れ替える・持ち出せない範囲・水を運ぶ（走るとこぼれる）・持って待つ枠・剛体（物理）・置いた物が残る（保存と復元）・決定論
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carryRestore, carrySave } from '../core/sim/parts/carry/index.ts';
import { box, type EntitySpec } from '../core/world/layout.ts';
import { aim, carryFloor, centerOf, cmd, cues, drop, makeSim, pickUp, placeAt, put, run, walk } from './carry-helpers.ts';

const item = (id: string, pos: [number, number, number], extra: EntitySpec['params'] = {}): EntitySpec => ({ id, type: 'carryItem', params: { pos, half: [0.15, 0.15, 0.15], kind: 'box', tag: 'box', ...extra } });

test('調べると拾い、Q で目の前の床に置く（イベント・holding）', async () => {
  const sim = await makeSim(carryFloor({ entities: [item('a', [5, 0, 5])] }));
  assert.ok(pickUp(sim, 'a'), '拾える');
  const ev = cues(sim);
  assert.ok(ev.includes('carry.pick'), `拾うイベント: ${ev}`);
  assert.equal(sim.outputOf('a', 'held'), 1);
  // 持って歩くと手の前について来る
  walk(sim, [3, 0, 3]);
  const p = sim.players[0]!;
  const c = centerOf(sim, 'a');
  assert.ok(Math.hypot(c[0] - p.pos[0], c[2] - p.pos[2]) < 0.7 && c[1] > 1, `手の前: ${c.map((v) => v.toFixed(2))}`);
  drop(sim);
  assert.equal(p.holding, null);
  const d = centerOf(sim, 'a');
  assert.ok(Math.abs(d[1] - 0.15) < 1e-6, `床の上: y=${d[1]}`);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  assert.ok(Math.abs((d[0] - p.pos[0]) * fx + (d[2] - p.pos[2]) * fz - 0.8) < 0.05, '体の前 0.8 m');
  assert.ok(cues(sim).includes('carry.drop'));
  assert.equal(sim.outputOf('a', 'moved'), 1);
});

test('机の前で Q なら机の上に置く・壁に向いて Q なら壁の中に置かない', async () => {
  const table = box([4, 0, 2], [6, 0.75, 3], 'furnitureLight');
  const sim = await makeSim(carryFloor({ boxes: [table], entities: [item('a', [5, 0, 6])] }));
  assert.ok(pickUp(sim, 'a'));
  // 机の手前 0.8 m に立って机の方（-Z）を向く
  put(sim, [5, 0, 3.75], 0);
  drop(sim, { yaw: 0 });
  const c = centerOf(sim, 'a');
  assert.ok(Math.abs(c[1] - (0.75 + 0.15)) < 1e-6 && c[2] > 2 && c[2] < 3, `机の上: ${c.map((v) => v.toFixed(2))}`);
  // 壁（x = 10）に体を付けて壁を向く
  assert.ok(pickUp(sim, 'a'));
  put(sim, [9.45, 0, 5], -Math.PI / 2);
  drop(sim, { yaw: -Math.PI / 2 });
  const w = centerOf(sim, 'a');
  assert.ok(w[0] + 0.15 <= 10 - 0.15 + 1e-6, `壁の中に置かない: x=${w[0].toFixed(2)}`);
});

test('枠（受け）へ吸い付き、受けは数・重さ・合う物を出す', async () => {
  const sim = await makeSim(carryFloor({ entities: [
    item('red', [2, 0, 8], { tag: 'parcel.red', weight: 3 }),
    item('blue', [8, 0, 8], { tag: 'parcel.blue', weight: 2 }),
    { id: 'rack', type: 'carryReceiver', params: { slots: [{ pos: [5, 0.9, 2], r: 0.5, want: ['parcel.red'] }, { pos: [6, 0.9, 2], r: 0.5 }], need: 2 } },
  ] }));
  assert.ok(pickUp(sim, 'blue'));
  // 枠を見て Q（少しずれていても吸い付く）
  placeAt(sim, [5.2, 0, 3.4], [5, 1.0, 2]);
  assert.deepEqual(centerOf(sim, 'blue').map((v) => Math.round(v * 100) / 100), [5, 1.05, 2]);
  assert.ok(cues(sim).includes('carry.place'));
  run(sim, 0.1);
  assert.equal(sim.outputOf('rack', 'count'), 1);
  assert.equal(sim.outputOf('rack', 'ok'), 0, '合わない物が正しい枠に');
  assert.ok(pickUp(sim, 'red'));
  placeAt(sim, [6, 0, 3.4], [6, 1.0, 2]);
  run(sim, 0.1);
  assert.equal(sim.outputOf('rack', 'count'), 2);
  assert.equal(sim.outputOf('rack', 'full'), 1);
  assert.equal(sim.outputOf('rack', 'weight'), 5);
  assert.equal(sim.outputOf('rack', 'ok'), 0);
  // 入れ替え: 赤を持って青を調べる → 赤が青の枠へ、青が手に
  assert.ok(pickUp(sim, 'red', [0, 0, 1]));
  assert.ok(pickUp(sim, 'blue', [0, 0, 1]), '入れ替えて手に取る');
  run(sim, 0.1);
  assert.deepEqual(centerOf(sim, 'red').map((v) => Math.round(v * 100) / 100), [5, 1.05, 2], '赤が青のあった枠へ');
  placeAt(sim, [6, 0, 3.4], [6, 1.0, 2]);
  run(sim, 0.1);
  assert.equal(sim.outputOf('rack', 'ok'), 1, '赤が正しい枠に');
});

test('上を向いて Q・走りながら Q なら投げる（放物線で飛び、床に落ちる。壁で跳ね返る）', async () => {
  const sim = await makeSim(carryFloor({ w: 14, d: 14, entities: [item('a', [7, 0, 12])] }));
  assert.ok(pickUp(sim, 'a'));
  put(sim, [7, 0, 12], 0);
  drop(sim, { yaw: 0, pitch: 0.5 });
  assert.equal(sim.outputOf('a', 'flying'), 1, '飛んでいる');
  assert.ok(cues(sim).includes('carry.throw'));
  run(sim, 3);
  const c = centerOf(sim, 'a');
  assert.equal(sim.outputOf('a', 'flying'), 0);
  assert.ok(12 - c[2] > 3.5, `遠くへ飛ぶ: z=${c[2].toFixed(2)}`);
  assert.ok(Math.abs(c[1] - 0.15) < 1e-6 && c[2] > 0.15, `床に落ちる（壁の外へ出ない）: ${c.map((v) => v.toFixed(2))}`);
  // 走りながら
  assert.ok(pickUp(sim, 'a'));
  put(sim, [7, 0, 12], 0);
  run(sim, 0.8, cmd({ yaw: 0, moveY: 1, dash: true }));
  sim.step([cmd({ yaw: 0, moveY: 1, dash: true, drop: true })]);
  assert.equal(sim.outputOf('a', 'flying'), 1, '走りながらでも投げる');
});

test('持ち出せない範囲（bounds）から出ると、元の所へ戻る', async () => {
  const sim = await makeSim(carryFloor({ entities: [item('a', [3, 0, 3], { bounds: { min: [0, -1, 0], max: [5, 3, 5] } })] }));
  assert.ok(pickUp(sim, 'a'));
  walk(sim, [8, 0, 8]);
  assert.equal(sim.players[0]!.holding, null);
  assert.deepEqual(centerOf(sim, 'a').map((v) => Math.round(v * 100) / 100), [3, 0.15, 3]);
  assert.ok(cues(sim).includes('carry.return'));
});

test('水を運ぶ: 蛇口の下で満ち、しゃがみ歩きならこぼれない・走るとこぼれる・跳ぶとこぼれる', async () => {
  const bucket = (): EntitySpec => item('b', [2, 0, 2], { kind: 'bucket', tag: 'bucket', fluid: true, fill: 0, fillZone: { min: [1, -0.5, 1], max: [3, 2, 3] } });
  const sim = await makeSim(carryFloor({ entities: [bucket()] }));
  assert.ok(pickUp(sim, 'b', [1, 0, 1]));
  put(sim, [2, 0, 2]);
  run(sim, 1.6);
  assert.equal(sim.outputOf('b', 'fill'), 1, '満杯');
  walk(sim, [8, 0, 8], { crouch: true });
  assert.equal(sim.outputOf('b', 'fill'), 1, 'しゃがみ歩きならこぼれない');
  walk(sim, [2, 0, 8], { dash: true });
  const f = sim.outputOf('b', 'fill');
  assert.ok(f < 0.9 && f > 0.2, `走るとこぼれる（空にはならない）: ${f.toFixed(2)}`);
  assert.ok(cues(sim).includes('carry.spill'));
  sim.step([cmd({ jump: true })]);
  run(sim, 1.0);
  assert.ok(sim.outputOf('b', 'fill') < f - 0.1, '跳ぶとこぼれる');
});

test('持って待つ枠（carrySensor）: 合う物・合わない物・何も持たない', async () => {
  const sim = await makeSim(carryFloor({ entities: [
    item('red', [2, 0, 8], { tag: 'parcel.red' }), item('blue', [8, 0, 8], { tag: 'parcel.blue' }),
    { id: 'frame', type: 'carrySensor', params: { aabb: { min: [4, -0.5, 1], max: [6, 2, 3] }, want: ['parcel.red'], sec: 1.0 } },
  ] }));
  assert.ok(pickUp(sim, 'blue'));
  put(sim, [5, 0, 2]);
  run(sim, 1.2);
  assert.equal(sim.outputOf('frame', 'other'), 1);
  assert.equal(sim.outputOf('frame', 'match'), 0);
  drop(sim);
  assert.ok(pickUp(sim, 'red'));
  put(sim, [5, 0, 2]);
  run(sim, 0.5);
  assert.equal(sim.outputOf('frame', 'match'), 0, 'まだ');
  run(sim, 0.7);
  assert.equal(sim.outputOf('frame', 'match'), 1);
});

test('剛体（carryBody）: 拾うと物理から外れ、投げると飛んで転がり、範囲の外へは出ない。決定的', async () => {
  const ball = (): EntitySpec => ({ id: 'ball', type: 'carryBody', params: { pos: [5, 0, 7], half: [0.12, 0.12, 0.12], kind: 'ball', tag: 'ball', persist: false } });
  const script = async (): Promise<{ hash: string; z: number }> => {
    const sim = await makeSim(carryFloor({ w: 10, d: 12, entities: [ball()] }));
    run(sim, 0.5);
    assert.ok(pickUp(sim, 'ball', [0, 0, 1]), '剛体を拾える');
    put(sim, [5, 0, 10], 0);
    run(sim, 0.5, cmd({ yaw: 0, moveY: 1, dash: true }));
    sim.step([cmd({ yaw: 0, moveY: 1, dash: true, drop: true })]);
    run(sim, 4, cmd({ yaw: 0 }));
    const z = centerOf(sim, 'ball')[2];
    const h = sim.stateHash();
    sim.physics?.dispose();
    return { hash: h, z };
  };
  const a = await script(), b = await script();
  assert.ok(a.z < 7, `投げると奥へ転がる: z=${a.z.toFixed(2)}`);
  assert.equal(a.hash, b.hash, '同じ操作なら同じ状態');
});

test('置いた物が残る（I09）: 保存して、作り直したフロアに戻すと同じ所にある。違うフロアには戻さない', async () => {
  const floor = (): ReturnType<typeof carryFloor> => carryFloor({ entities: [item('a', [3, 0, 3]), item('b', [7, 0, 3]), item('ball', [5, 0, 5], { persist: false })] });
  const sim = await makeSim(floor());
  assert.ok(pickUp(sim, 'a'));
  put(sim, [8, 0, 8], 0);
  drop(sim, { yaw: 0 });
  assert.ok(pickUp(sim, 'ball'));
  drop(sim);
  const save = carrySave(sim)!;
  assert.deepEqual(Object.keys(save.items), ['a'], '動かした物だけ（persist: false は除く）');
  assert.ok(JSON.stringify(save).length < 200, '保存は小さい');
  const again = await makeSim(floor());
  assert.equal(carryRestore(again, save), 1);
  const a0 = centerOf(sim, 'a'), a1 = centerOf(again, 'a');
  assert.ok(Math.hypot(a0[0] - a1[0], a0[2] - a1[2]) < 0.02 && Math.abs(a0[1] - a1[1]) < 0.02, '同じ所');
  assert.equal(again.outputOf('a', 'moved'), 0, '出力は次の tick から');
  run(again, 0.1);
  assert.equal(again.outputOf('a', 'moved'), 1);
  const other = await makeSim({ ...floor(), id: 'other' });
  assert.equal(carryRestore(other, save), 0, '別のフロアには戻さない');
  const aim0 = aim(again, centerOf(again, 'a'));
  assert.ok(Number.isFinite(aim0.yaw));
});
