import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning, type Tuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { roomShapeDefs } from '../core/gen/rooms/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { PLAYER } from '../core/sim/player.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Box, CellLayout, FloorLayout, PortalSpec } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';

/**
 * 部屋の形の部屋を、実際の移動（Sim と歩く人）で確かめる:
 * - 入口から出口まで歩けるフロア（形の無い同じフロアで歩けるなら、形があっても歩ける）
 * - 形ごとに: 入口の外から部屋を横切って、ほかの開口の先へ抜けられる（低い天井はしゃがむ・傾いた床・円形の通り口 …）
 * - 落ちた先（穴の底・水の中・すり鉢の底）から歩いて出口へ戻れる（閉じ込めない）
 * - どの階段も真っすぐ歩いて上りきれ、上から下りきれる（ロフト・足場・上の層・階段の塔・屋根裏・舞台・穴・水。頭がつかえればしゃがむ）
 * - 開口は跳ばずに両向きに通れる
 */

type R = Awaited<ReturnType<typeof loadRapier>>;
const t = defaultTuning();
const none = makeTuning({ 'rooms.chance.room': 0, 'rooms.chance.hall': 0, 'rooms.chance.anomaly': 0 }).tuning;

function only(id: string): Tuning {
  const o: Record<string, number> = { 'rooms.chance.room': 1, 'rooms.chance.hall': 1, 'rooms.openMul': 1 };
  for (const d of roomShapeDefs()) o[`rooms.w.${d.id}`] = d.id === id ? 10 : 0;
  return makeTuning(o).tuning;
}

const gen = (w: number, d: number, tt: Tuning, v = 0): GenReport => generateFloorReport({ world: w, depth: d, variant: v }, tt, { dress: dressCell });
const center = (p: PortalSpec): [number, number, number] => [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2];
const other = (p: PortalSpec, id: string): string => (p.cells[0] === id ? p.cells[1] : p.cells[0]);

/** 区画の開口の p の内側 d の点（開口の高さ） */
function inside(p: PortalSpec, cell: CellLayout, d: number): [number, number, number] {
  const c = center(p);
  const cx = (cell.bounds.min[0] + cell.bounds.max[0]) / 2, cz = (cell.bounds.min[2] + cell.bounds.max[2]) / 2;
  if (p.dir % 2 === 1) return [c[0] + Math.sign(cx - c[0]) * d, c[1], c[2]];
  return [c[0], c[1], c[2] + Math.sign(cz - c[2]) * d];
}

function newSim(floor: FloorLayout, rr: R, tt = t): Sim {
  const sim = new Sim(floor, { tuning: tt, physics: new PhysicsWorld(rr, 1 / 60) });
  // 隠しは現しておく（歩く人はスイッチを探さない）
  for (const e of floor.entities) if (e.type === 'reveal') (sim as unknown as { revealGroup(g: string, b: string): void }).revealGroup(String(e.params.group), 'test');
  return sim;
}

/** 点 (x, y, z) に体が箱に埋まらずに立てるか */
function free(floor: FloorLayout, x: number, y: number, z: number, h = PLAYER.height): boolean {
  const r = PLAYER.radius;
  return !floor.cells.some((c) => c.boxes.some((b) => b.solid && !b.revealGroup && x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && y + 0.05 < b.max[1] && y + h > b.min[1]));
}

/** 形の部屋（tour の入口の外に立つ位置つき）を集める */
function shapedRooms(tt: Tuning, id: string | null, want: number, maxWorld = 120): { r: GenReport; cell: CellLayout; stand: { pos: [number, number, number]; yaw: number } }[] {
  const out: { r: GenReport; cell: CellLayout; stand: { pos: [number, number, number]; yaw: number } }[] = [];
  for (let w = 1; w <= maxWorld && out.length < want; w++) {
    const r = gen(w * 5 + 1, 1 + (w % 9), tt);
    for (const c of r.floor.cells) {
      if (!c.shape || (id && c.shape !== id) || out.length >= want) continue;
      const s = r.gimmicks?.tour.find((x) => x.cell === c.id && x.label.startsWith('部屋の形: '));
      if (s) out.push({ r, cell: c, stand: { pos: [...s.pos] as [number, number, number], yaw: s.yaw } });
    }
  }
  return out;
}

/** 入口の外から、区画の中を通って開口 p の内側へ、そこから p の先の区画へ */
function cross(sim: Sim, cell: CellLayout, p: PortalSpec): { ok: boolean; reason: string } {
  const goal = inside(p, cell, 1.0);
  const a = walkTo(sim, cell.id, goal, 120);
  if (!a.ok) return { ok: false, reason: `中: ${a.reason}` };
  const b = walkTo(sim, other(p, cell.id), undefined, 60);
  return b.ok ? { ok: true, reason: '' } : { ok: false, reason: `出口: ${b.reason}` };
}

test('部屋の形: 形のあるフロアを、入口から出口まで歩ける（形の無い同じフロアで歩けるなら）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0, shaped = 0;
  // 形のあるフロアが 20 になるまで（異変の部屋には重ねられない形が多いので、異変の種類が増えると形の部屋は少し減る）
  for (let w = 1; w <= 36 || (n < 20 && w <= 80); w++) {
    const key = { world: w + 300, depth: 1 + (w % 9), variant: 0 };
    const r = generateFloorReport(key, t, { dress: dressCell });
    const sh = r.floor.cells.filter((c) => c.shape);
    if (!sh.length) continue;
    n++;
    shaped += sh.length;
    const walk = (floor: FloorLayout, tt: Tuning): { ok: boolean; reason: string } => {
      const sim = newSim(floor, R, tt);
      const ex = floor.exits.find((e) => e.id === 'down')!;
      const goal: [number, number, number] = [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2];
      const res = walkTo(sim, 'exitStairs', goal);
      const reached = sim.drainEvents().some((e) => e.type === 'floor.exit');
      sim.physics?.dispose();
      return { ok: res.ok && reached, reason: res.reason || '出口に入れない' };
    };
    const res = walk(r.floor, t);
    if (res.ok) continue;
    const base = walk(generateFloorReport(key, none, { dress: dressCell }).floor, none);
    if (base.ok) fails.push(`w${key.world} ${r.floor.id}: ${res.reason}（形 ${sh.map((c) => `${c.shape}@${c.id}`).join(' ')}）`);
  }
  console.log(`  形のあるフロア ${n}（形の部屋 ${shaped}）`);
  assert.ok(n >= 20);
  assert.deepEqual(fails, []);
});

test('部屋の形: 形ごとに、入口の外から部屋を横切ってほかの開口の先へ抜けられる', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let walks = 0;
  for (const def of roomShapeDefs()) {
    const rooms = shapedRooms(only(def.id), def.id, 2);
    for (const { r, cell, stand } of rooms) {
      const ports = r.floor.portals.filter((p) => p.cells.includes(cell.id) && !p.cells.some((c) => c.startsWith('secret')) && Math.abs(p.aabb.min[1] - cell.floorY) < 0.05);
      const entry = ports.slice().sort((a, b) => Math.hypot(center(a)[0] - stand.pos[0], center(a)[2] - stand.pos[2]) - Math.hypot(center(b)[0] - stand.pos[0], center(b)[2] - stand.pos[2]))[0];
      const exits = ports.filter((p) => p !== entry).slice(0, 2);
      for (const p of exits) {
        walks++;
        const sim = newSim(r.floor, R);
        sim.teleport(0, stand.pos, stand.yaw);
        for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND, yaw: stand.yaw }]);
        const res = cross(sim, cell, p);
        if (!res.ok) fails.push(`${def.id} ${r.floor.id} ${cell.id} → ${p.id}: ${res.reason}`);
        sim.physics?.dispose();
      }
    }
  }
  console.log(`  横切った ${walks}`);
  assert.ok(walks >= roomShapeDefs().length);
  assert.deepEqual(fails, []);
});

test('部屋の形: 落ちた先（穴の底・水の中・すり鉢の底）から、歩いてほかの開口の先へ戻れる', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  for (const id of ['centerHole', 'pitGallery', 'sunkenWater', 'terraces']) {
    for (const { r, cell } of shapedRooms(only(id), id, 3)) {
      const fy = cell.floorY;
      // 底: 床より下の、上に何も無い所（3 点）
      const bottom = Math.min(...cell.boxes.filter((b) => b.solid && b.max[1] < fy - 0.5).map((b) => b.max[1]));
      if (!Number.isFinite(bottom)) { fails.push(`${id} ${cell.id}: 床より下の面が無い`); continue; }
      const pts: [number, number, number][] = [];
      const b = cell.bounds;
      for (let i = 0; i < 400 && pts.length < 3; i++) {
        const x = b.min[0] + 0.5 + ((b.max[0] - b.min[0] - 1) * ((i * 37) % 97)) / 97, z = b.min[2] + 0.5 + ((b.max[2] - b.min[2] - 1) * ((i * 53) % 89)) / 89;
        const top = Math.max(-Infinity, ...cell.boxes.filter((q) => q.solid && x > q.min[0] && x < q.max[0] && z > q.min[2] && z < q.max[2] && q.max[1] < fy - 0.05).map((q) => q.max[1]));
        if (top !== bottom || !free(r.floor, x, bottom, z)) continue;
        if (cell.boxes.some((q) => q.solid && x > q.min[0] - 0.4 && x < q.max[0] + 0.4 && z > q.min[2] - 0.4 && z < q.max[2] + 0.4 && q.min[1] > bottom - 0.01 && q.max[1] > bottom + 0.05 && q.min[1] < bottom + 2.0)) continue;
        pts.push([x, bottom + 0.02, z]);
      }
      const exit = r.floor.portals.find((p) => p.cells.includes(cell.id) && !p.cells.some((c) => c.startsWith('secret')) && Math.abs(p.aabb.min[1] - fy) < 0.05)!;
      for (const p0 of pts) {
        n++;
        const sim = newSim(r.floor, R);
        sim.teleport(0, p0, 0);
        for (let i = 0; i < 20; i++) sim.step([{ ...IDLE_COMMAND }]);
        const res = walkTo(sim, other(exit, cell.id), undefined, 120);
        if (!res.ok) fails.push(`${id} ${r.floor.id} ${cell.id} (${p0.map((v) => v.toFixed(2))}): ${res.reason}`);
        sim.physics?.dispose();
      }
    }
  }
  console.log(`  落ちた所から戻った ${n}`);
  assert.ok(n >= 12, `試した点 ${n}`);
  assert.deepEqual(fails, []);
});

/** 段（kind 'roomStep'）を 1 本ずつの階段にまとめる: 隣り合い（辺が接し、幅が同じ）、上面が 0.05〜0.4 m ずつ上がる並び */
interface Flight { steps: Box[]; axis: 0 | 2; sign: 1 | -1; bottom: number; top: number }
function flights(cell: CellLayout): Flight[] {
  const steps = cell.boxes.filter((b) => b.kind === 'roomStep');
  // a の次の段: 軸 ax の向き sg に接し、横の幅が同じで、上面が 0.05〜0.4 m 高い段
  const nextOf = (a: Box, ax: 0 | 2, sg: 1 | -1): Box | undefined => steps.find((b) => {
    if (b === a) return false;
    const dy = b.max[1] - a.max[1];
    const o = ax === 0 ? 2 : 0;
    return dy > 0.05 && dy < 0.4 && Math.abs(a.min[o] - b.min[o]) < 0.02 && Math.abs(a.max[o] - b.max[o]) < 0.02 && (sg > 0 ? Math.abs(a.max[ax] - b.min[ax]) < 0.02 : Math.abs(a.min[ax] - b.max[ax]) < 0.02);
  });
  const prevOf = (b: Box, ax: 0 | 2, sg: 1 | -1): boolean => steps.some((a) => a !== b && nextOf(a, ax, sg) === b);
  const out: Flight[] = [];
  for (const s0 of steps) for (const ax of [0, 2] as const) for (const sg of [1, -1] as const) {
    if (prevOf(s0, ax, sg)) continue;
    const chain = [s0];
    for (let c = nextOf(s0, ax, sg); c; c = nextOf(c, ax, sg)) chain.push(c);
    if (chain.length < 3) continue;
    const rise = chain[1]!.max[1] - s0.max[1];
    out.push({ steps: chain, axis: ax, sign: sg, bottom: s0.max[1] - rise, top: chain[chain.length - 1]!.max[1] });
  }
  return out;
}

/** 決めた入力で、向き yaw へ sec 秒歩く（しゃがむ）。届いたいちばん高い・低い高さ */
function walkLine(sim: Sim, pos: [number, number, number], yaw: number, sec: number, crouch: boolean): { hi: number; lo: number } {
  sim.teleport(0, pos, yaw);
  // しゃがんで歩くときは、置いた時からしゃがんでいる（屋根裏のような低い所に立った姿勢で置くと、天井から押し出される）
  if (crouch) sim.players[0]!.crouching = true;
  let hi = -Infinity, lo = Infinity;
  for (let i = 0; i < sec * 60; i++) {
    sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0, moveY: i < 5 ? 0 : 1, crouch }]);
    const y = sim.players[0]!.pos[1];
    if (sim.players[0]!.onGround) { hi = Math.max(hi, y); lo = Math.min(lo, y); }
  }
  return { hi, lo };
}

test('部屋の形: どの階段も、真っすぐ歩いて上りきれ、上から下りきれる（ロフト・足場・層・塔・屋根裏・舞台・穴・水）', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  const kinds = new Set<string>();
  for (const id of ['loft', 'scaffold', 'layers', 'stairsOnly', 'atticStair', 'theater', 'centerHole', 'pitGallery', 'sunkenWater']) {
    for (const { r, cell } of shapedRooms(only(id), id, 2, 160)) {
      const sim = newSim(r.floor, R);
      for (const f of flights(cell)) {
        n++;
        kinds.add(id);
        const s0 = f.steps[0]!, sl = f.steps[f.steps.length - 1]!;
        const o = f.axis === 0 ? 2 : 0;
        const c = (s0.min[o] + s0.max[o]) / 2;
        const yawUp = f.axis === 0 ? (f.sign > 0 ? -Math.PI / 2 : Math.PI / 2) : (f.sign > 0 ? Math.PI : 0);
        const at = (a: number, y: number): [number, number, number] => (f.axis === 0 ? [a, y, c] : [c, y, a]);
        const startA = (f.sign > 0 ? s0.min[f.axis]! : s0.max[f.axis]!) - f.sign * 0.55;
        const run = Math.abs(sl.max[f.axis]! - s0.min[f.axis]!) + 1;
        // 上り: 段の手前から（立って、だめならしゃがんで）
        let up = walkLine(sim, at(startA, f.bottom + 0.02), yawUp, run / 1.4 + 1.5, false);
        if (up.hi < f.top - 0.12) up = walkLine(sim, at(startA, f.bottom + 0.02), yawUp, run / 0.7 + 2, true);
        if (up.hi < f.top - 0.12) fails.push(`${id} ${r.floor.id} ${cell.id}: 上りきれない（${up.hi.toFixed(2)} / ${f.top.toFixed(2)}）`);
        // 下り: いちばん上の段から下の床まで
        const topA = (sl.min[f.axis]! + sl.max[f.axis]!) / 2;
        let dn = walkLine(sim, at(topA, f.top + 0.02), yawUp + Math.PI, run / 1.4 + 1.5, false);
        if (dn.lo > f.bottom + 0.12) dn = walkLine(sim, at(topA, f.top + 0.02), yawUp + Math.PI, run / 0.7 + 2, true);
        if (dn.lo > f.bottom + 0.12) fails.push(`${id} ${r.floor.id} ${cell.id}: 下りきれない（${dn.lo.toFixed(2)} / ${f.bottom.toFixed(2)}）`);
      }
      sim.physics?.dispose();
    }
  }
  console.log(`  階段 ${n}（${[...kinds].join('・')}）`);
  assert.ok(kinds.size >= 8, [...kinds].join(','));
  assert.deepEqual(fails, []);
});

test('部屋の形: 開口は、ジャンプせずに両向きに通れる', async () => {
  const R = await loadRapier();
  const fails: string[] = [];
  let n = 0;
  for (const def of roomShapeDefs()) {
    for (const { r, cell } of shapedRooms(only(def.id), def.id, 2)) {
      const sim = newSim(r.floor, R);
      for (const p of r.floor.portals.filter((x) => x.cells.includes(cell.id))) {
        const axis = p.dir % 2 === 0 ? 2 : 0;
        const c = center(p);
        for (const s of [1, -1]) {
          n++;
          const from = [...c] as [number, number, number], to = [...c] as [number, number, number];
          from[axis] -= s * 0.9; to[axis] += s * 0.9;
          sim.teleport(0, [from[0], from[1] + 0.4, from[2]], 0);
          const yaw = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
          let ok = false;
          for (let i = 0; i < 260 && !ok; i++) {
            if (p.doorId) { const st = sim.stateOf(p.doorId) as { angle: number; target: number }; st.angle = 1; st.target = 1; }
            sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0, moveY: i < 20 ? 0 : 1 }]);
            if ((sim.players[0]!.pos[axis] - c[axis]!) * s > 0.55) ok = true;
          }
          if (!ok) fails.push(`${def.id} ${r.floor.id} ${p.id} ${s > 0 ? '→' : '←'} ${sim.players[0]!.pos.map((v) => v.toFixed(2))}`);
        }
      }
      sim.physics?.dispose();
    }
  }
  console.log(`  開口 ${n}`);
  assert.deepEqual(fails, []);
});
