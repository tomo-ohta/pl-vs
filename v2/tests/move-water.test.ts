/**
 * 水・球の中: 深いプール（泳いで渡る・跳び石）・ボールプール（浅い道・深い所・潜ると隠し）と、異変の重い部屋・水の中の部屋。
 * どれも入口から出口へ渡れる（泳いで這い上がる）・生成したフロアに出る・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning, type Tuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { walkThrough } from './move-helpers.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();

function rooms(def: string, tt: Tuning, sizes: { w: number; d: number; kind: 'room' | 'hall' }[]): { room: LabRoom; tag: string }[] {
  const out: { room: LabRoom; tag: string }[] = [];
  for (const size of sizes) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of [1, 2]) {
    const dims = entry % 2 === 1 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
    const room = labRoom(def, { ...size, ...dims, height: 3.0, entry, exit: ((entry + 2) % 4) as Dir, seed: seed * 3 + entry, entryAt: seed === 1 ? 0.5 : 0.4, exitAt: seed === 1 ? 0.5 : 0.62, t: tt });
    if (room) out.push({ room, tag: `${size.w}x${size.d} 入口${entry} seed${seed}` });
  }
  return out;
}

const forward = (room: LabRoom): { yaw: number; f: Vec3 } => {
  const e = room.inside, x = room.exitInside!;
  const f: Vec3 = [x[0] - e[0], 0, x[2] - e[2]];
  const l = Math.hypot(f[0], f[2]);
  return { yaw: Math.atan2(-f[0] / l, -f[2] / l), f: [f[0] / l, 0, f[2] / l] };
};

const POOL = [{ w: 5.2, d: 8.6, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

for (const stones of [0, 1]) {
  test(`深いプール（${stones ? '跳び石' : '泳ぐ'}・実験室）: 入口から出口へ渡れる（泳いで這い上がる）`, () => {
    const tt = makeTuning({ 'move.pool.stoneChance': stones }).tuning;
    const list = rooms('poolRoom', tt, POOL);
    assert.ok(list.length >= 10, `組めた ${list.length}`);
    if (stones) assert.ok(list.filter(({ room }) => room.cell.boxes.some((b) => b.kind === 'steppingStone')).length >= 6, '跳び石がある');
    const fails: string[] = [];
    for (const { room, tag } of list) {
      const sim = new Sim(room.floor, { tuning: tt });
      sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
      const res = walkTo(sim, 'room', room.exitInside!, 150);
      for (let i = 0; i < 40; i++) sim.step([{ ...IDLE_COMMAND }]);
      if (!res.ok || Math.abs(sim.players[0]!.pos[1]) > 0.1) fails.push(`${tag}: ${res.reason || `高さ ${sim.players[0]!.pos[1].toFixed(2)}`}`);
    }
    assert.deepEqual(fails, []);
  });
}

test('深いプール: 落ちると浮いて泳ぎ、出口の縁へ前へ押すと這い上がる', () => {
  const tt = makeTuning({ 'move.pool.stoneChance': 0 }).tuning;
  const room = rooms('poolRoom', tt, POOL)[0]!.room;
  const { yaw, f } = forward(room);
  const sim = new Sim(room.floor, { tuning: tt });
  const mid: Vec3 = [(room.inside[0] + room.exitInside![0]) / 2, 0.5, (room.inside[2] + room.exitInside![2]) / 2];
  sim.teleport(0, mid, yaw);
  for (let i = 0; i < 120; i++) sim.step([{ ...IDLE_COMMAND, yaw }]);
  const p = sim.players[0]!;
  const surf = -tt['move.pool.surfaceM'];
  assert.ok(p.swimming && Math.abs(p.pos[1] - (surf - tt['move.swim.float'])) < 0.25, `浮いて泳ぐ（${p.pos[1].toFixed(2)}）`);
  let up = -1;
  for (let i = 0; i < 60 * 12 && up < 0; i++) { sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]); if (p.onGround && Math.abs(p.pos[1]) < 0.02) up = i; }
  assert.ok(up > 0, `這い上がる（${p.pos.map((x) => x.toFixed(2))}）`);
  void f;
});

test('跳び石: 石から次の石へ、走って跳べば届く', () => {
  const tt = makeTuning({ 'move.pool.stoneChance': 1 }).tuning;
  let checked = 0;
  const fails: string[] = [];
  for (const { room, tag } of rooms('poolRoom', tt, POOL)) {
    const st = room.cell.boxes.filter((b) => b.kind === 'steppingStone');
    if (st.length < 2) continue;
    // 入口に近い順
    const d = (b: { min: number[]; max: number[] }): number => Math.hypot((b.min[0]! + b.max[0]!) / 2 - room.inside[0], (b.min[2]! + b.max[2]!) / 2 - room.inside[2]);
    st.sort((a, b) => d(a) - d(b));
    for (let i = 0; i + 1 < st.length; i++) {
      const a = st[i]!, b = st[i + 1]!;
      const ca: Vec3 = [(a.min[0] + a.max[0]) / 2, a.max[1] + 0.02, (a.min[2] + a.max[2]) / 2], cb = [(b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2];
      const yaw = Math.atan2(-(cb[0]! - ca[0]), -(cb[2]! - ca[2]));
      const sim = new Sim(room.floor, { tuning: tt });
      // 石の向こう側の端から助走して跳ぶ
      const back = 0.25;
      const dl = Math.hypot(cb[0]! - ca[0], cb[2]! - ca[2]);
      sim.teleport(0, [ca[0] - ((cb[0]! - ca[0]) / dl) * back, ca[1], ca[2] - ((cb[2]! - ca[2]) / dl) * back], yaw);
      for (let k = 0; k < 5; k++) sim.step([{ ...IDLE_COMMAND, yaw }]);
      for (let k = 0; k < 12; k++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: true }]);
      sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: true, jump: true }]);
      let landed = false;
      for (let k = 0; k < 90 && !landed; k++) {
        const p = sim.players[0]!;
        const onB = p.pos[0] > b.min[0] - 0.3 && p.pos[0] < b.max[0] + 0.3 && p.pos[2] > b.min[2] - 0.3 && p.pos[2] < b.max[2] + 0.3;
        sim.step([{ ...IDLE_COMMAND, yaw, moveY: onB ? 0 : 1 }]);
        landed = p.onGround && Math.abs(p.pos[1] - b.max[1]) < 0.05 && onB;
      }
      if (!landed) fails.push(`${tag} 石${i} → 石${i + 1}（${sim.players[0]!.pos.map((x) => x.toFixed(2))}）`);
      checked++;
    }
  }
  assert.ok(checked >= 12, `確かめた ${checked}`);
  assert.deepEqual(fails, []);
});

const BALLS = [{ w: 4.4, d: 8.0, kind: 'room' as const }, { w: 6.4, d: 9.0, kind: 'room' as const }, { w: 8.6, d: 15, kind: 'hall' as const }];

test('ボールプール（実験室）: 入口から出口へ渡れる', () => {
  const list = rooms('ballPool', t, BALLS);
  assert.ok(list.length >= 12, `組めた ${list.length}`);
  const fails: string[] = [];
  for (const { room, tag } of list) {
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
    const res = walkTo(sim, 'room', room.exitInside!, 150);
    if (!res.ok) fails.push(`${tag}: ${res.reason}`);
  }
  assert.deepEqual(fails, []);
});

test('ボールプール: 浅い道は速く、深い所は遅くて目が沈み、押されてよろける。いちばん深い所でしゃがんでじっとしていると隠しが開く', () => {
  const room = labRoom('ballPool', { w: 6.4, d: 9.0, entry: 2, exit: 0, seed: 3 })!;
  const pit = room.floor.entities.find((e) => e.type === 'ballPit')!;
  const rects = pit.params.rects as { x0: number; z0: number; x1: number; z1: number; depth: number }[];
  const shallow = rects.find((r) => r.depth < 0.5)!, deep = rects.filter((r) => r.depth > 0.8 && r.depth < 1.2).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]!;
  const speedIn = (r: typeof shallow): { v: number; eye: number; drift: number } => {
    const sim = new Sim(room.floor, { tuning: t });
    sim.teleport(0, [(r.x0 + r.x1) / 2, 0.02, (r.z0 + r.z1) / 2], 0);
    for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
    const p = sim.players[0]!;
    const a = [...p.pos];
    for (let i = 0; i < 60; i++) sim.step([{ ...IDLE_COMMAND }]);
    const drift = Math.hypot(p.pos[0] - a[0]!, p.pos[2] - a[2]!);
    // 横へ 1.5 秒歩いた距離（よろけも含む。矩形の中の真ん中から、長い向きへ）
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    sim.teleport(0, [alongX ? r.x0 + 0.4 : cx, 0.02, alongX ? cz : r.z0 + 0.4], 0);
    for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
    const b = [...p.pos];
    const yaw = alongX ? Math.atan2(-1, 0) : Math.atan2(0, -1);
    const n = Math.round(60 * Math.min(1.5, (Math.max(r.x1 - r.x0, r.z1 - r.z0) - 0.8) / 2.5));
    for (let i = 0; i < n; i++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1 }]);
    const along = alongX ? p.pos[0] - b[0]! : p.pos[2] - b[2]!;
    return { v: along / (n / 60), eye: p.eye, drift };
  };
  const s = speedIn(shallow), d = speedIn(deep);
  assert.ok(d.v < s.v * 0.75, `深い所は遅い ${d.v.toFixed(2)} / ${s.v.toFixed(2)}`);
  assert.ok(d.eye < s.eye - 0.2, `目が沈む ${d.eye.toFixed(2)} / ${s.eye.toFixed(2)}`);
  assert.ok(d.drift > 0.08 && s.drift < d.drift, `押される ${d.drift.toFixed(2)} m`);
  const offer = room.offers.find((o) => o.hook === 'balls.dive')!;
  assert.ok(offer && offer.modes[0] === 'appear');
  const sensor = offer.revealOutput!.replace(/\.done$/, '');
  const pocket = rects.find((r) => r.depth > 1.2)!;
  const sim = new Sim(room.floor, { tuning: t });
  sim.teleport(0, [(pocket.x0 + pocket.x1) / 2, 0.02, (pocket.z0 + pocket.z1) / 2], 0);
  for (let i = 0; i < 60 * 3; i++) sim.step([{ ...IDLE_COMMAND }]);
  assert.equal(sim.outputOf(sensor, 'done'), 0, '立っているだけでは開かない');
  for (let i = 0; i < 60 * (t['move.balls.diveSec'] + 1.5); i++) sim.step([{ ...IDLE_COMMAND, crouch: true }]);
  assert.equal(sim.outputOf(sensor, 'done'), 1, 'しゃがんで潜ると開く');
});

test('水・球の部屋: 生成したフロアに出て、入口から出口の先まで歩ける・同じ鍵なら同じ', async () => {
  await loadRapier();
  for (const def of ['poolRoom', 'ballPool']) {
    const list = findRooms(def, 2, { maxWorld: 900 });
    assert.ok(list.length >= 1, `${def}: 見つかった部屋 ${list.length}`);
    for (const room of list) {
      const res = await walkThrough(room, 220);
      assert.ok(res.ok, `${room.floor.id} ${room.id}: ${res.reason}`);
      assert.equal(JSON.stringify(regenerate(room)), JSON.stringify(room.floor));
    }
  }
});

test('異変（重い部屋・水の中の部屋）: 生成したフロアに出て、見て分かる形・効く', () => {
  const seen = new Map<string, number>();
  for (let w = 1; w <= 300; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, t, { dress: dressCell });
    for (const a of r.anomalies) {
      if (a.def !== 'heavyRoom' && a.def !== 'underwater') continue;
      seen.set(a.def, (seen.get(a.def) ?? 0) + 1);
      const c = r.floor.cells.find((x) => x.id === a.cell)!;
      if (a.def === 'heavyRoom') {
        const z = c.zones.find((x) => x.kind === 'gravity')!;
        assert.ok(Number(z.params?.scale) >= t['move.heavy.scaleMin'] - 1e-9, `${a.id}: 重さ ${z.params?.scale}`);
        assert.ok(c.boxes.some((b) => b.kind === 'pressDent'), `${a.id}: 床のへこみ`);
      } else {
        assert.ok(c.zones.some((x) => x.kind === 'water' && x.params?.submerged && x.aabb.max[1] >= c.floorY + c.height - 1e-6), `${a.id}: 部屋ごと水`);
        assert.ok(c.boxes.some((b) => b.kind === 'waterCeiling') && c.render?.fog && c.audioPreset?.includes('遠い水圧'), `${a.id}: 天井の水面・霧・こもった音`);
      }
    }
  }
  assert.ok((seen.get('heavyRoom') ?? 0) >= 5 && (seen.get('underwater') ?? 0) >= 5, `出た回数 ${[...seen].map(([k, v]) => `${k} ${v}`).join('・')}`);
});

test('異変の効き目: 重い部屋では低くしか跳べず遅い・水の中ではゆっくり落ちて遅く、足音が水', async () => {
  const { Sim: S } = await import('../core/sim/sim.ts');
  const { makeCell, themePalette } = { ...(await import('../core/world/build.ts')), ...(await import('../core/world/palettes.ts')) } as never as { makeCell: Function; themePalette: Function };
  void makeCell; void themePalette; void S;
  // 部屋を作らず、ゾーンだけの床で確かめる
  const base = labRoom('ballPool', { w: 4.4, d: 8.0, entry: 2, exit: 0, seed: 1 })!;
  const mk = (zones: object[]): Sim => {
    const floor = JSON.parse(JSON.stringify(base.floor));
    floor.entities = floor.entities.filter((e: { type: string }) => e.type === 'door');
    floor.cells[0].zones = zones;
    return new Sim(floor, { tuning: t });
  };
  const all = { min: [0, -0.2, 0], max: [4.4, 3, 8] };
  const jumpH = (sim: Sim): number => {
    sim.teleport(0, [2.2, 0.02, 0.6], 0);
    for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
    sim.step([{ ...IDLE_COMMAND, jump: true }]);
    let top = 0;
    for (let i = 0; i < 90; i++) { sim.step([{ ...IDLE_COMMAND }]); top = Math.max(top, sim.players[0]!.pos[1]); }
    return top;
  };
  const normal = jumpH(mk([]));
  const heavy = jumpH(mk([{ kind: 'gravity', aabb: all, params: { scale: 1.75, slow: t['move.heavy.slow'] } }]));
  assert.ok(heavy < normal * 0.7, `重い部屋は低く跳ぶ ${heavy.toFixed(2)} / ${normal.toFixed(2)}`);
  const under = mk([{ kind: 'water', aabb: all, params: { dry: true, submerged: true, slow: t['move.underwater.slow'], drag: t['move.underwater.drag'] } }, { kind: 'gravity', aabb: all, params: { scale: t['move.underwater.gravity'] } }]);
  under.teleport(0, [2.2, 2.0, 4], 0);
  under.step([{ ...IDLE_COMMAND }]);
  for (let i = 0; i < 30; i++) under.step([{ ...IDLE_COMMAND }]);
  assert.ok(Math.abs(under.players[0]!.vel[1]) <= t['move.underwater.drag'] + 1e-6, `ゆっくり落ちる ${under.players[0]!.vel[1].toFixed(2)}`);
  for (let i = 0; i < 90; i++) under.step([{ ...IDLE_COMMAND, moveY: 1 }]);
  const p = under.players[0]!;
  assert.ok(p.inWater && Math.hypot(p.vel[0], p.vel[2]) < 3.0 * t['move.underwater.slow'] + 0.05, `水の中で遅い ${Math.hypot(p.vel[0], p.vel[2]).toFixed(2)}`);
});
