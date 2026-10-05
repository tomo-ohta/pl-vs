/**
 * 一方通行の歩道迷路（beltMaze）: 網の作り（強連結・道順・分かれ目）・入口から出口へ抜けられる・どの乗り換えの床からも
 * 入口の床へ戻れる（閉じ込めない）・帯に逆らって進めない（歩いても・ダッシュでも・跳んでも）・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { arcPath, beltNet, reachFrom, stronglyConnected } from '../core/gen/gimmicks/maze.ts';
import { Rng } from '../core/math/rng.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { PLAYER } from '../core/sim/player.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { AABB } from '../core/math/aabb.ts';
import type { EntitySpec } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const ROOMS = findRooms('beltMaze', 18, { maxWorld: 600 });

test('網の作り: どの床からもどの床へも行ける・道順は入口から出口へ前向き・道順の上に分かれ目がある', () => {
  let n = 0, tried = 0;
  for (let s = 1; s <= 300; s++) {
    const rng = new Rng(s);
    const nx = rng.int(2, 6), nz = rng.int(2, 7);
    if (nx * nz < 6) continue;
    // 入口・出口は壁際の床（開口の前）
    const edge = [...Array(nx * nz).keys()].filter((c) => c % nx === 0 || c % nx === nx - 1 || c < nx || c >= nx * (nz - 1));
    const e = rng.pick(edge);
    const x = rng.pick(edge.filter((c) => c !== e));
    tried++;
    const net = beltNet(nx, nz, e, x, rng.fork('net'), { blockChance: 0.25, minChoices: nx * nz >= 12 ? 2 : 1 });
    if (!net) continue;
    n++;
    const all = [...Array(nx * nz).keys()];
    assert.ok(stronglyConnected(nx * nz, net.arcs, all), `${s}: 強連結`);
    assert.equal(net.route[0], e);
    assert.equal(net.route[net.route.length - 1], x);
    for (let i = 1; i < net.route.length; i++) assert.ok(net.arcs.has(`${net.route[i - 1]}>${net.route[i]}`), `${s}: 道順は前向き`);
    // 道順の外の床から入口へ戻れる
    const back = reachFrom(nx * nz, net.arcs, e, true);
    assert.ok(all.every((c) => back[c]), `${s}: どの床からも入口へ`);
    // 2 つの床の間は帯 1 本（向きは 1 つ）
    for (const a of net.arcs) { const [p, q] = a.split('>'); assert.ok(!net.arcs.has(`${q}>${p}`), `${s}: 両向きの帯は無い`); }
    assert.ok(arcPath(nx * nz, net.arcs, e, x)!.length >= 2);
  }
  assert.ok(n >= tried * 0.85, `網を作れた数: ${n}/${tried}`);
});

/** 帯の部品（forceZone）の一覧 */
const belts = (room: GimmickRoom): EntitySpec[] => room.floor.entities.filter((e) => e.type === 'forceZone' && e.cell === room.cell.id);
const aabbOf = (e: EntitySpec): AABB => e.params.aabb as unknown as AABB;

/** 乗り換えの床の中心（帯の両端）。帯の向きの網も作る（床の番号は中心の座標の鍵） */
function padGraph(room: GimmickRoom): { pads: Map<string, [number, number]>; arcs: Set<string> } {
  const pads = new Map<string, [number, number]>();
  const arcs = new Set<string>();
  const key = (x: number, z: number): string => `${x.toFixed(2)},${z.toFixed(2)}`;
  for (const e of belts(room)) {
    const a = aabbOf(e);
    const v = e.params.vector as number[];
    const cx = (a.min[0] + a.max[0]) / 2, cz = (a.min[2] + a.max[2]) / 2;
    // 帯の両端の外側 0.3 m の点を、その端の床の代わりにする（同じ床の別の帯とは、床の中心で揃える）
    const alongX = Math.abs(v[0]!) > 0.5;
    const ends: [number, number][] = alongX ? [[a.min[0] - 0.3, cz], [a.max[0] + 0.3, cz]] : [[cx, a.min[2] - 0.3], [cx, a.max[2] + 0.3]];
    const [from, to] = (alongX ? v[0]! : v[2]!) > 0 ? [ends[0]!, ends[1]!] : [ends[1]!, ends[0]!];
    arcs.add(`${key(...from)}>${key(...to)}`);
    pads.set(key(...from), from);
    pads.set(key(...to), to);
  }
  return { pads, arcs };
}

test('歩道迷路: 帯はダッシュより速い・柵は跳んでも越えられない高さ・帯の矢印の向きの情報がある', () => {
  assert.ok(ROOMS.length >= 6, `歩道迷路の部屋: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const bs = belts(room);
    assert.ok(bs.length >= 5, `${room.cell.id}: 帯が 5 本以上（${bs.length}）`);
    for (const b of bs) {
      assert.ok((b.params.speed as number) > PLAYER.dash, '帯はダッシュより速い');
      assert.equal(b.params.visual, 'belt');
      const a = aabbOf(b);
      assert.ok(a.max[1] - room.cell.floorY >= 2.0, '帯の力は跳んだ高さまで効く');
    }
    const rails = room.cell.boxes.filter((x) => x.solid && x.mat === 'rubber' && x.max[1] - room.cell.floorY > 0.9 && x.max[1] - room.cell.floorY < 1.7);
    assert.ok(rails.length > 0 && rails.every((x) => x.max[1] - room.cell.floorY > PLAYER.jump ** 2 / (2 * PLAYER.gravity) + 0.05), '柵は跳んでも越えられない');
  }
});

test('歩道迷路: 歩く人が入口から出口まで抜けられる（帯の向きに従って道を選ぶ）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  for (const room of ROOMS.filter((x) => x.beyond)) {
    const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    // 入口の内側（入口の床・升目）から出口の向こうの区画へ
    sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
    const res = walkTo(sim, room.beyond!, undefined, 150);
    if (!res.ok || !res.route.includes(room.exit!.id)) fails.push(`${room.floor.id} ${room.cell.id}: ${res.reason || '歩道迷路を通らない道順'}`);
    sim.physics?.dispose();
  }
  assert.deepEqual(fails, []);
});

test('歩道迷路: どの乗り換えの床からも、入口の床へ歩いて戻れる（閉じ込めない）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  for (const room of ROOMS.slice(0, 10)) {
    const { pads } = padGraph(room);
    for (const [k, p] of pads) {
      n++;
      const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      sim.teleport(0, [p[0], room.cell.floorY + 0.02, p[1]], 0);
      for (let i = 0; i < 20; i++) sim.step([{ ...IDLE_COMMAND }]);
      const res = walkTo(sim, room.cell.id, [room.inside[0], room.cell.floorY, room.inside[2]], 90);
      if (!res.ok) fails.push(`${room.floor.id} ${room.cell.id} 床 ${k}: ${res.reason}`);
      sim.physics?.dispose();
    }
  }
  console.log(`  床 ${n} 枚から入口へ`);
  assert.deepEqual(fails, []);
});

test('歩道迷路: 帯に逆らって進めない（歩く・ダッシュ・跳ぶ）', async () => {
  const R = await loadRapier();
  let n = 0;
  for (const room of ROOMS.slice(0, 8)) {
    for (const b of belts(room).slice(0, 4)) {
      const a = aabbOf(b);
      const v = b.params.vector as number[];
      const alongX = Math.abs(v[0]!) > 0.5;
      const sg = alongX ? Math.sign(v[0]!) : Math.sign(v[2]!);
      const lo = alongX ? a.min[0] : a.min[2], hi = alongX ? a.max[0] : a.max[2];
      const c = alongX ? (a.min[2] + a.max[2]) / 2 : (a.min[0] + a.max[0]) / 2;
      // 帯の下流の端の外（乗り換えの床）から、上流へ向かう
      const startU = sg > 0 ? hi + 0.4 : lo - 0.4;
      for (const mode of ['walk', 'dash', 'jump'] as const) {
        n++;
        const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
        sim.teleport(0, alongX ? [startU, room.cell.floorY + 0.02, c] : [c, room.cell.floorY + 0.02, startU], 0);
        const yaw = alongX ? Math.atan2(sg, 0) : Math.atan2(0, sg); // 上流（-sg）の向き: 前 = (-sin yaw, -cos yaw)
        let deepest = 0;
        for (let i = 0; i < 60 * 4; i++) {
          sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: mode !== 'walk', jump: mode === 'jump' && i % 50 === 10 }]);
          const p = sim.players[0]!.pos;
          const u = alongX ? p[0] : p[2];
          // 帯の中へ入り込んだ深さ（下流の端から上流へ）
          deepest = Math.max(deepest, sg > 0 ? hi - u : u - lo);
        }
        assert.ok(deepest < 0.8, `${room.cell.id} ${b.id} ${mode}: 帯に逆らって ${deepest.toFixed(2)} m 入り込んだ（長さ ${(hi - lo).toFixed(2)}）`);
        sim.physics?.dispose();
      }
    }
  }
  assert.ok(n >= 30);
});

test('歩道迷路: 同じ key なら同じ帯（決定的）', () => {
  for (const room of ROOMS.slice(0, 3)) {
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.cell === room.cell.id)), JSON.stringify(room.floor.entities.filter((e) => e.cell === room.cell.id)));
    assert.equal(JSON.stringify(again.cells.find((c) => c.id === room.cell.id)!.boxes), JSON.stringify(room.cell.boxes));
  }
});

test('歩道迷路（出現型の隠し）: 行き止まりの床へ流れ込む帯に逆らって歩き続けると扉が現れる・流れに乗るだけでは現れない', async () => {
  const R = await loadRapier();
  let n = 0;
  for (let w = 1; w <= 1500 && n < 2; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: w % 3 === 0 ? 1 : 0 }, t);
    for (const sec of r.gimmicks?.secrets ?? []) {
      if (sec.hook !== 'belt.deadEnd' || sec.mode !== 'appear') continue;
      const fight = r.floor.entities.find((e) => e.type === 'dwellSensor' && e.cell === sec.host)!;
      const a = fight.params.aabb as unknown as AABB;
      const belt = r.floor.entities.find((e) => e.type === 'forceZone' && e.cell === sec.host && (() => { const b = e.params.aabb as unknown as AABB; return b.min[0] <= a.min[0] + 1e-6 && b.max[0] >= a.max[0] - 1e-6 && b.min[2] <= a.min[2] + 1e-6 && b.max[2] >= a.max[2] - 1e-6; })())!;
      const v = belt.params.vector as number[];
      const y = r.floor.cells.find((c) => c.id === sec.host)!.floorY;
      const c: [number, number, number] = [(a.min[0] + a.max[0]) / 2, y + 0.02, (a.min[2] + a.max[2]) / 2];
      // 流れに乗るだけ（帯の上流から流される）: 現れない
      const ride = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      ride.teleport(0, [c[0] - v[0]! * 0.6, c[1], c[2] - v[2]! * 0.6], 0);
      for (let i = 0; i < 60 * 3; i++) ride.step([{ ...IDLE_COMMAND }]);
      assert.ok(!ride.isRevealed(`${sec.id}.wall`), `${r.floor.id}: 流されるだけでは現れない`);
      ride.physics?.dispose();
      // 帯の終わり（行き止まりの床の側）で、流れに逆らってダッシュし続ける
      const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
      sim.teleport(0, c, 0);
      const yaw = Math.atan2(v[0]!, v[2]!); // 前 = (-sin yaw, -cos yaw) = 流れの逆
      for (let i = 0; i < 60 * t['gimmick.belt.fightSec'] * 4; i++) sim.step([{ ...IDLE_COMMAND, yaw, moveY: 1, dash: true }]);
      assert.ok(sim.isRevealed(`${sec.id}.wall`), `${r.floor.id} ${sec.id}: 逆らい続けると現れる`);
      sim.physics?.dispose();
      n++;
    }
  }
  assert.ok(n >= 1, `出現型の歩道迷路の隠し: ${n}`);
});
