/**
 * 見ていない間の差し替え（swapSet）の仕掛け:
 * - 振り返ると変わる（behindSwap: O05）: 見ている小部屋は変わらない・目を離すと変わる・変わる瞬間はどの小部屋も見えていない・決定的
 * - 4 回曲がっても戻らない（fourRights: W13）: 右へ 1 周すると来た扉が壁で埋まり開かない・左へ 1 周で戻る・埋まる瞬間は見えていない・
 *   その間もほかの開口から出られる（閉じ込めない）・隠しの扉は見ていない間に現れる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { aabbCenter, type AABB } from '../core/math/aabb.ts';
import type { Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { readAabb, seenBy } from '../core/sim/parts/warp/util.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout, Json } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { faceTo, stepWith } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
const LOOK = findRooms('behindSwap', 5, { maxWorld: 260 });
const RING = findRooms('fourRights', 6, { maxWorld: 320 });

const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const regions = (f: FloorLayout, swap: string): AABB[] => (ent(f, swap).params.slots as { region: Json }[]).map((s) => readAabb(s.region));
const curOf = (sim: Sim, swap: string): number[] => [...((sim.stateOf(swap)?.cur as number[] | undefined) ?? [])];

function simAt(room: GimmickRoom, pos: Vec3, yaw: number): Sim {
  const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
  sim.teleport(0, [pos[0], room.cell.floorY + 0.02, pos[2]], yaw);
  stepWith(sim, 5, () => ({}));
  return sim;
}

/** 差し替えが起きた tick に、その区画が見えていなかったか（見え方は部品と同じ視野と見通しで調べる） */
function watchSwaps(sim: Sim, swap: string, regs: AABB[], bad: string[]): () => void {
  let prev = curOf(sim, swap);
  return () => {
    const cur = curOf(sim, swap);
    cur.forEach((v, i) => {
      if (v === prev[i]) return;
      const p = sim.players[0]!;
      if (seenBy(p, regs[i]!, (a, b) => sim.sightClear(a, b))) bad.push(`tick ${sim.tick}: 区画 ${i} が見えている間に変わった`);
    });
    prev = cur;
  };
}

// ---------------------------------------------------------------- 振り返ると変わる
test('振り返ると変わる: 見ている小部屋は変わらず、目を離すと変わる・変わる瞬間は見えていない', () => {
  assert.ok(LOOK.length >= 3, `振り返ると変わる: ${LOOK.length}`);
  for (const room of LOOK) {
    const f = room.floor;
    const swap = `${room.id}.swap`;
    const regs = regions(f, swap);
    assert.ok(regs.length >= 3, `${room.cell.id}: 小部屋が 3 つ以上（${regs.length}）`);
    // 入口の内側に立ち、見えている小部屋を 1 つ選んで見続ける: 変わらない
    const mid = room.inside;
    const probe = simAt(room, mid, 0);
    // 向くと見え、背を向けると見えない小部屋（横の小部屋は、背を向けても視野の端に入ることがある）
    const seenFacing = (g: AABB, turn: number): boolean => { probe.teleport(0, [mid[0], room.cell.floorY + 0.02, mid[2]], faceTo(mid, aabbCenter(g)) + turn); return seenBy(probe.players[0]!, g, (a, b) => probe.sightClear(a, b)); };
    const pick = regs.findIndex((g) => seenFacing(g, 0) && !seenFacing(g, Math.PI));
    assert.ok(pick >= 0, `${room.cell.id}: 入口から見える小部屋がある`);
    const r0 = aabbCenter(regs[pick]!);
    const look0 = faceTo(mid, r0);
    const sim = simAt(room, mid, look0);
    const bad: string[] = [];
    const watch = watchSwaps(sim, swap, regs, bad);
    const v0 = curOf(sim, swap)[pick];
    for (let i = 0; i < 60 * 3; i++) { stepWith(sim, 1, () => ({ yaw: look0, pitch: -0.15 })); watch(); }
    assert.equal(curOf(sim, swap)[pick], v0, `${room.cell.id}: 見ている間は変わらない`);
    // 背を向ける: 変わる（音の合図も出る）
    let cues = 0;
    for (let i = 0; i < 60 * 2; i++) {
      sim.step([{ ...IDLE_COMMAND, yaw: look0 + Math.PI }]);
      for (const e of sim.drainEvents()) if (e.type === 'cue' && e.entity === swap && e.data?.name === 'swap.change') cues++;
      watch();
    }
    assert.notEqual(curOf(sim, swap)[pick], v0, `${room.cell.id}: 目を離すと変わる`);
    assert.ok(cues >= 1, `${room.cell.id}: 変わるとき物音の合図`);
    // 歩き回って振り返る: 何度も変わるが、変わる瞬間はいつも見えていない
    const before = Number(sim.stateOf(swap)?.changes ?? 0);
    for (let k = 0; k < 8; k++) {
      const yaw = look0 + (k * Math.PI) / 2.5;
      for (let i = 0; i < 50; i++) { stepWith(sim, 1, () => ({ yaw, moveY: i < 15 ? 0.6 : 0 })); watch(); }
    }
    assert.ok(Number(sim.stateOf(swap)?.changes ?? 0) > before, `${room.cell.id}: 振り返るたびに変わる`);
    assert.deepEqual(bad, [], `${room.cell.id}: ${bad.slice(0, 3).join(' / ')}`);
  }
});

test('振り返ると変わる: 部屋の開口どうしは歩いてつながる（小部屋が塞がない）・決定的', () => {
  for (const room of LOOK.slice(0, 3)) {
    const sim = simAt(room, room.inside, faceTo(room.inside, aabbCenter(room.cell.bounds)));
    if (room.beyond) {
      const r = walkTo(sim, room.beyond, undefined, 60);
      assert.ok(r.ok, `${room.cell.id}: 入口から出口へ: ${r.reason}`);
    }
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(room.floor.entities.filter((e) => e.id.startsWith(room.id))));
  }
});

// ---------------------------------------------------------------- 4 回曲がっても戻らない
interface RingRoom { room: GimmickRoom; swap: string; ring: string; door: string; corners: Vec3[]; start: Vec3; center: Vec3 }

function ringRoom(room: GimmickRoom): RingRoom {
  const f = room.floor;
  const ring = `${room.id}.ring`, swap = `${room.id}.swap`;
  const P = ent(f, ring).params as { center: number[]; door: string; box: Json };
  const b = readAabb(P.box);
  const h = t['warp.fourRights.ringM'] / 2;
  const y = room.cell.floorY;
  const x0 = b.min[0] + h, x1 = b.max[0] - h, z0 = b.min[2] + h, z1 = b.max[2] - h;
  // 右回り（atan2(z, x) が増える向き）の順の角
  const corners: Vec3[] = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const pn = aabbCenter(ent(f, P.door).params.panel as never);
  const start: Vec3 = [Math.max(x0, Math.min(x1, pn[0])), y, Math.max(z0, Math.min(z1, pn[2]))];
  return { room, swap, ring, door: P.door, corners, start, center: [P.center[0]!, y, P.center[1]!] };
}

/** 点を順にたどって歩く（点に 0.3 m まで近づいたら次へ） */
function walkPath(sim: Sim, pts: Vec3[], each: () => void): void {
  let k = 0;
  for (let i = 0; i < 60 * 60 && k < pts.length; i++) {
    const p = sim.players[0]!.pos;
    const q = pts[k]!;
    if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.3) { k++; continue; }
    stepWith(sim, 1, () => ({ yaw: faceTo(p, q), moveY: 1 }));
    each();
  }
  assert.equal(k, pts.length, `点をたどり終える（${k} / ${pts.length}）`);
}

/** 塊を 1 周する道（start から、dir = 1 右回り / -1 左回り） */
function lap(rr: RingRoom, dir: 1 | -1): Vec3[] {
  const th = (p: Vec3): number => Math.atan2(p[2] - rr.center[2], p[0] - rr.center[0]);
  const s = th(rr.start);
  const order = rr.corners.map((c, i) => ({ c, i, d: ((((th(c) - s) * dir) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) })).sort((a, b) => a.d - b.d);
  return [...order.map((o) => o.c), rr.start];
}

test('4 回曲がっても戻らない: 右へ 1 周すると来た扉が壁で埋まる（開かない）・左へ 1 周で戻る・埋まる瞬間は見えていない', () => {
  assert.ok(RING.length >= 3, `4 回曲がっても戻らない: ${RING.length}`);
  let secrets = 0;
  for (const room of RING) {
    const rr = ringRoom(room);
    const f = room.floor;
    const regs = regions(f, rr.swap);
    const sim = simAt(room, rr.start, faceTo(rr.start, rr.center));
    const bad: string[] = [];
    const watch = watchSwaps(sim, rr.swap, regs, bad);
    // 半周では変わらない（来た扉は見えている）
    assert.equal(curOf(sim, rr.swap)[0], 0);
    walkPath(sim, lap(rr, 1), watch);
    assert.equal(Number(sim.stateOf(rr.ring)?.level), 1, `${room.cell.id}: 右へ 1 周で段 1（${Number(sim.stateOf(rr.ring)?.wind).toFixed(2)}）`);
    stepWith(sim, 30, () => ({ yaw: faceTo(sim.players[0]!.pos, rr.start) }));
    assert.equal(curOf(sim, rr.swap)[0], 1, `${room.cell.id}: 来た扉が壁で埋まっている`);
    // 扉へ向かって押しても、調べても出られない
    const pn = aabbCenter(ent(f, rr.door).params.panel as never);
    const p = sim.players[0]!;
    const eye: Vec3 = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
    const yaw = faceTo(eye, pn);
    stepWith(sim, 1, () => ({ yaw, interact: { yaw, pitch: 0 } }));
    stepWith(sim, 60 * 2, () => ({ yaw, moveY: 1 }));
    assert.ok(Number(sim.stateOf(rr.door)?.angle ?? 0) < 0.02, `${room.cell.id}: 埋まっている扉は開かない`);
    const q = sim.players[0]!.pos;
    const bb = room.cell.bounds;
    assert.ok(q[0] > bb.min[0] && q[0] < bb.max[0] && q[2] > bb.min[2] && q[2] < bb.max[2], `${room.cell.id}: 部屋から出ていない`);
    // 隠しの扉（付いていれば）: 見ていない間に現れている
    const rev = f.entities.find((e) => e.type === 'reveal' && e.inputs?.show === `${rr.swap}.v1`);
    if (rev) { assert.equal(Number(sim.stateOf(rev.id)?.shown), 1, `${room.cell.id}: 隠しの扉が現れた`); secrets++; }
    // 左へ 1 周すると戻る
    walkPath(sim, [rr.start], watch);
    walkPath(sim, lap(rr, -1), watch);
    stepWith(sim, 30, () => ({ yaw: faceTo(sim.players[0]!.pos, pn) }));
    assert.equal(curOf(sim, rr.swap)[0], 0, `${room.cell.id}: 左へ 1 周で来た扉が戻る`);
    assert.deepEqual(bad, [], `${room.cell.id}: ${bad.slice(0, 3).join(' / ')}`);
  }
  assert.ok(secrets >= 1, `隠しの扉の付いた部屋も確かめる（${secrets}）`);
});

test('4 回曲がっても戻らない: 右へ何周しても左へ 1 周で戻る・埋まっている間もほかの開口から出られる・決定的', () => {
  for (const room of RING.slice(0, 4)) {
    const rr = ringRoom(room);
    const f = room.floor;
    const sim = simAt(room, rr.start, faceTo(rr.start, rr.center));
    walkPath(sim, [...lap(rr, 1), ...lap(rr, 1), ...lap(rr, 1)], () => {});
    walkPath(sim, lap(rr, -1), () => {});
    stepWith(sim, 30, () => ({}));
    assert.equal(Number(sim.stateOf(rr.ring)?.level), 0, `${room.cell.id}: 右へ 3 周しても左へ 1 周で戻る`);
    // もう一度右へ 1 周して埋めてから、ほかの開口へ出る
    walkPath(sim, lap(rr, 1), () => {});
    stepWith(sim, 30, () => ({}));
    assert.equal(curOf(sim, rr.swap)[0], 1);
    const doorPortal = f.portals.find((p) => p.doorId === rr.door);
    const other = f.portals.find((p) => p.cells.includes(room.cell.id) && p !== doorPortal && !p.cells.some((c) => c.startsWith('secret')));
    assert.ok(other, `${room.cell.id}: ほかの開口`);
    const to = other!.cells[0] === room.cell.id ? other!.cells[1] : other!.cells[0];
    const r = walkTo(sim, to, undefined, 60);
    assert.ok(r.ok, `${room.cell.id}: 埋まっている間もほかの開口から出られる: ${r.reason}`);
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(f.entities.filter((e) => e.id.startsWith(room.id))));
  }
});
