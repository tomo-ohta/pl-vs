/**
 * 音の仕掛け（chimeOrder・loudGate・quietGate・extraSteps・paChase・livingWall・silentCorner・echoMaze・pitchMaze）:
 * 旋律と同じ順に鳴らすと開く（逆順は別の扉）・音の大きさで開く扉（マイクが無ければ足音・着地）・もう一人の足音が離れて壁を叩く・
 * 放送を追う・壁にもたれる・無音の隅・迷路を歩く人が抜けられる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dir } from '../core/math/vec.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { walkTo } from './helpers/bot.ts';
import { entitiesOf, labRoomDoors, labSim, labSimDoors, stand } from './sense-util.ts';

const DIRS: Dir[] = [0, 1, 2, 3];
const size = (dir: Dir, w: number, d: number): { w: number; d: number } => (dir % 2 === 0 ? { w, d } : { w: d, d: w });
const opp = (d: Dir): Dir => ((d + 2) % 4) as Dir;
const out = (sim: Sim, ref: string): number => { const i = ref.lastIndexOf('.'); return sim.outputOf(ref.slice(0, i), ref.slice(i + 1)); };
function lookAt(sim: Sim, p: readonly number[]): { yaw: number; pitch: number } {
  const pl = sim.players[0]!;
  const dx = p[0]! - pl.pos[0], dy = p[1]! - (pl.pos[1] + pl.eye), dz = p[2]! - pl.pos[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
/** 鐘 id の前（0.9 m）に立って調べる */
function ring(sim: Sim, id: string): void {
  const e = sim.floor.entities.find((x) => x.id === id)!;
  const b = e.params.box as { min: number[]; max: number[] };
  const c = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
  const cell = sim.floor.cells[0]!.bounds;
  const cx = (cell.min[0] + cell.max[0]) / 2, cz = (cell.min[2] + cell.max[2]) / 2;
  const l = Math.hypot(cx - c[0]!, cz - c[2]!);
  sim.teleport(0, [c[0]! + ((cx - c[0]!) / l) * 1.1, 0.02, c[2]! + ((cz - c[2]!) / l) * 1.1], 0);
  stand(sim, 0.1);
  const look = lookAt(sim, c);
  sim.step([{ ...IDLE_COMMAND, ...look, interact: look }]);
  stand(sim, 0.1, look);
}

test('音をつなぐ扉: 入ると旋律が流れる・旋律と同じ順に鐘を鳴らすと出力・逆の順は別の出力・間違えると最初から', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('chimeOrder', { ...size(dir, 6, 6), entry: dir, exit: null, seed: 3 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const chimes = entitiesOf(room.floor, 'chime');
    assert.equal(chimes.length, 5);
    const melody = entitiesOf(room.floor, 'melody')[0]!;
    const order = melody.params.order as number[];
    // 旋律: 部屋に入ると、order の順に鳴る
    sim.drainEvents();
    stand(sim, 1.0 + 5 * 0.75 + 0.2);
    const notes = sim.drainEvents().filter((e) => e.type === 'cue' && e.data?.name === 'melody.note').map((e) => Number(e.data?.note));
    assert.deepEqual(notes, order, `向き ${dir}: 旋律の順`);
    const fwd = room.offers.find((o) => o.hook === 'chime.order')!;
    const rev = room.offers.find((o) => o.hook === 'chime.reverse');
    // 間違えた順 → 出ない
    for (const k of [order[1]!, order[0]!]) ring(sim, chimes[k]!.id);
    assert.equal(out(sim, fwd.revealOutput!), 0, '間違えた順では出ない');
    for (const k of order) ring(sim, chimes[k]!.id);
    assert.equal(out(sim, fwd.revealOutput!), 1, `向き ${dir}: 同じ順で出る`);
    if (rev) {
      for (const k of order.slice().reverse()) ring(sim, chimes[k]!.id);
      assert.equal(out(sim, rev.revealOutput!), 1, `向き ${dir}: 逆の順で別の扉`);
    }
  }
});

test('マイクで開く扉 / 静かにすると開く: 扉の前で跳んで着地すると開く（歩くだけでは開かない）/ 止まって静かにすると開く・マイクの音量でも開く・歩く人が抜けられる', async () => {
  for (const dir of DIRS) {
    // loud
    const r = (await labSimDoors('loudGate', { ...size(dir, 5, 6), entry: dir, exit: opp(dir), seed: 5 + dir }))!;
    const g = entitiesOf(r.room.floor, 'noiseGate')[0]!;
    const z = g.params.zone as { min: number[]; max: number[] };
    const zc: [number, number, number] = [(z.min[0]! + z.max[0]!) / 2, 0.02, (z.min[2]! + z.max[2]!) / 2];
    r.sim.teleport(0, zc, 0);
    // 歩き回るだけ（音量 0.35）では開かない
    for (let i = 0; i < 120; i++) r.sim.step([{ ...IDLE_COMMAND, moveX: i % 40 < 20 ? 1 : -1 }]);
    assert.equal(r.sim.outputOf(g.id, 'open'), 0, `向き ${dir}: 歩くだけでは開かない`);
    r.sim.step([{ ...IDLE_COMMAND, jump: true }]);
    stand(r.sim, 1.2);
    assert.equal(r.sim.outputOf(g.id, 'open'), 1, `向き ${dir}: 跳んで着地すると開く`);
    // マイク（声）でも開く
    const m = (await labSimDoors('loudGate', { ...size(dir, 5, 6), entry: dir, exit: opp(dir), seed: 5 + dir }))!;
    m.sim.teleport(0, zc, 0);
    stand(m.sim, 0.5, { voice: 0.1 });
    assert.equal(m.sim.outputOf(g.id, 'open'), 0, '小さな声では開かない');
    stand(m.sim, 0.2, { voice: 0.8 });
    assert.equal(m.sim.outputOf(g.id, 'open'), 1, '大きな声で開く');
    // quiet
    const q = (await labSimDoors('quietGate', { ...size(dir, 5, 6), entry: dir, exit: opp(dir), seed: 5 + dir }))!;
    const qg = entitiesOf(q.room.floor, 'noiseGate')[0]!;
    q.sim.teleport(0, zc, 0);
    stand(q.sim, 1.5, { voice: 0.3 });
    assert.equal(q.sim.outputOf(qg.id, 'open'), 0, `向き ${dir}: 声を出していると開かない`);
    stand(q.sim, 3.5, { voice: 0.02 });
    assert.equal(q.sim.outputOf(qg.id, 'open'), 1, `向き ${dir}: 静かにしていると開く`);
    // 歩く人（足音で代わり）
    for (const def of ['loudGate', 'quietGate']) {
      const c = (await labSimDoors(def, { ...size(dir, 5, 6), entry: dir, exit: opp(dir), seed: 5 + dir }))!;
      const gg = entitiesOf(c.room.floor, 'noiseGate')[0]!;
      const res = walkTo(c.sim, c.room.cell.id, [c.room.exitInside![0]!, 0, c.room.exitInside![2]!], 60);
      for (let i = 0; i < 300 && !c.sim.outputOf(gg.id, 'open'); i++) { const cmd = { ...IDLE_COMMAND, jump: def === 'loudGate' && i % 40 === 0 }; c.sim.step([cmd]); }
      assert.ok(res.ok && c.sim.outputOf(gg.id, 'open') === 1, `${def} 向き ${dir}: 開けられる`);
    }
  }
});

test('足音が増える: 歩くと後ろにもう一人の足音・しゃがんで歩き続けると足音だけが壁へ行って叩く（BA02）', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('extraSteps', { ...size(dir, 6, 8), entry: dir, exit: opp(dir), seed: 7 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const ghost = entitiesOf(room.floor, 'ghostSteps')[0]!;
    sim.drainEvents();
    for (let i = 0; i < 240; i++) sim.step([{ ...IDLE_COMMAND, moveY: 1, yaw: sim.players[0]!.yaw + (i === 100 ? Math.PI : 0) }]);
    const steps = sim.drainEvents().filter((e) => e.type === 'cue' && e.data?.name === 'ghost.step').length;
    assert.ok(steps >= 2, `向き ${dir}: もう一人の足音 ${steps}`);
    const offer = room.offers.find((o) => o.hook === 'steps.sneak')!;
    // しゃがんで行き来する
    const b = room.cell.bounds;
    const a: [number, number] = [b.min[0] + 1.5, (b.min[2] + b.max[2]) / 2], c: [number, number] = [b.max[0] - 1.5, (b.min[2] + b.max[2]) / 2];
    for (let k = 0; k < 6 && !out(sim, `${ghost.id}.gone`); k++) {
      const tgt = k % 2 ? a : c;
      for (let i = 0; i < 120; i++) { const p = sim.players[0]!; sim.step([{ ...IDLE_COMMAND, crouch: true, moveY: 1, yaw: Math.atan2(-(tgt[0] - p.pos[0]), -(tgt[1] - p.pos[2])) }]); }
    }
    assert.equal(sim.outputOf(ghost.id, 'gone'), 1, `向き ${dir}: 足音が離れる`);
    stand(sim, 15);
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: 壁を叩く`);
  }
});

test('遠くの館内放送: 放送はスピーカーから流れ、近づくと次のスピーカーへ・最後まで追うと出力', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('paChase', { ...size(dir, 9, 11), entry: dir, exit: opp(dir), seed: 9 + dir, kind: 'hall' }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const pa = entitiesOf(room.floor, 'paChase')[0]!;
    const sp = pa.params.speakers as number[][];
    assert.ok(sp.length >= 3);
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i]!;
      const b = room.cell.bounds;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      const l = Math.hypot(cx - s[0]!, cz - s[2]!);
      sim.teleport(0, [s[0]! + ((cx - s[0]!) / l) * 1.0, 0.02, s[2]! + ((cz - s[2]!) / l) * 1.0], 0);
      stand(sim, 1.3);
    }
    assert.equal(sim.outputOf(pa.id, 'found'), 1, `向き ${dir}: 最後まで追うと見つかる`);
  }
});

test('壁の向こうの生活音（BA04）: その壁の前で 4 秒止まると出力（歩いていると入らない）・無音の隅（BA01）: 隅で 3 秒止まると出力', async () => {
  for (const dir of DIRS) {
    for (const [def, hook] of [['livingWall', 'living.lean'], ['silentCorner', 'silent.corner']] as const) {
      const r = (await labSim(def, { ...size(dir, 6, 7), entry: dir, exit: opp(dir), seed: 11 + dir }))!;
      assert.ok(r, `${def} 向き ${dir}: 組める`);
      const { room, sim } = r;
      const offer = room.offers.find((o) => o.hook === hook)!;
      const sensor = room.floor.entities.find((e) => offer.revealOutput!.startsWith(e.id))!;
      const a = sensor.params.aabb as { min: number[]; max: number[] };
      const c: [number, number, number] = [(a.min[0]! + a.max[0]!) / 2, 0.02, (a.min[2]! + a.max[2]!) / 2];
      sim.teleport(0, c, 0);
      for (let i = 0; i < 300; i++) sim.step([{ ...IDLE_COMMAND, moveX: i % 30 < 15 ? 0.6 : -0.6 }]);
      assert.equal(out(sim, offer.revealOutput!), 0, `${def}: 動いていると入らない`);
      stand(sim, 5);
      assert.equal(out(sim, offer.revealOutput!), 1, `${def} 向き ${dir}: 止まっていると入る`);
    }
  }
});

test('音で形を知る迷路: 黒い仕切り（反響）/ 霧（音の高さ）の迷路を、歩く人が入口から出口まで抜けられる・出口に近いほど道のりが短い', async () => {
  for (const def of ['echoMaze', 'pitchMaze'] as const) {
    for (const dir of DIRS) {
      const r = (await labSim(def, { ...size(dir, 7, 9), entry: dir, exit: opp(dir), entryAt: 0.3, exitAt: 0.7, seed: 13 + dir }))!;
      assert.ok(r, `${def} 向き ${dir}: 組める`);
      const { room, sim } = r;
      if (def === 'echoMaze') assert.ok(room.cell.boxes.some((b) => b.mat === 'void' && b.solid), '黒い仕切り');
      else {
        const fx = entitiesOf(room.floor, 'senseFx').find((e) => e.params.fx === 'pitch')!;
        const dist = fx.params.dist as number[];
        assert.ok(dist.includes(0) && Math.max(...dist) >= 3, '出口からの道のり');
        assert.ok(room.cell.render?.fog && room.cell.render.fog.far < 4, '濃い霧');
      }
      const res = walkTo(sim, room.cell.id, [room.exitInside![0]!, 0, room.exitInside![2]!], 90);
      assert.ok(res.ok, `${def} 向き ${dir}: 抜けられる（${res.reason}）`);
    }
  }
});

test('音の仕掛け: 同じ seed なら同じ部屋（決定的）', () => {
  for (const def of ['chimeOrder', 'loudGate', 'quietGate', 'extraSteps', 'paChase', 'livingWall', 'silentCorner', 'echoMaze', 'pitchMaze']) {
    const o = { w: 9, d: 11, entry: 0 as Dir, exit: (def === 'chimeOrder' ? null : 2) as Dir | null, seed: 5 };
    assert.equal(JSON.stringify(labRoomDoors(def, o)?.floor), JSON.stringify(labRoomDoors(def, o)?.floor), def);
  }
});
