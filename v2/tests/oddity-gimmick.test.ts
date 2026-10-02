// 段階 4・oddity の仕掛け「一つだけ違う」（X02・BX05）: 同じブースが並び、1 つだけ違う家具に触れると隠しの扉。
// 実験室（入口・出口の向きと部屋の大きさを全部）で組める・閉じ込めない・違いは 1 か所だけ / 生成したフロアで、触れると現れ奥まで行ける
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning } from '../core/config/tuning.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Dir } from '../core/math/vec.ts';
import { labRoom } from './helpers/gimmick-lab.ts';
import { findRooms } from './helpers/gimmick-rooms.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();
const DIRS: Dir[] = [0, 1, 2, 3];

test('一つだけ違う: 実験室のどの向き・大きさでも、組めれば開口どうしがつながり、違う家具は 1 つ・隠しの元を 1 つ差し出す', () => {
  let built = 0;
  const fails: string[] = [];
  for (const [w, d] of [[8, 7], [7, 9], [10, 6.8], [9, 9], [12, 8]] as const) for (const entry of DIRS) for (const exit of [...DIRS, null] as const) {
    if (exit === entry) continue;
    const r = labRoom('oneDifferent', { w, d, entry, exit, seed: w * 100 + d * 10 + entry, kind: 'hall' });
    if (!r) continue;
    built++;
    const tag = `${w}x${d} ${entry}→${exit}`;
    const reach = reachOpenings(r.cell, r.slot.openings, 0.1);
    if (reach?.blocked.length) fails.push(`${tag}: 届かない開口 ${reach.blocked.join(',')}`);
    const touch = r.floor.entities.filter((e) => e.type === 'oddTouch');
    if (touch.length !== 1) fails.push(`${tag}: 触れる部品 ${touch.length}`);
    if (r.offers.length !== 1) { fails.push(`${tag}: 隠しの元 ${r.offers.length}`); continue; }
    const o = r.offers[0]!;
    if (!o.modes.includes('appear') || o.revealOutput !== `${touch[0]?.id}.touched`) fails.push(`${tag}: 出現型は触れた出力で現れる`);
    // 隠しの入口は、開口の無い壁
    if (r.slot.openings.some((op) => op.dir === o.doorway.dir)) fails.push(`${tag}: 隠しの入口の壁に開口`);
    // ブースは 3〜5 つ・違うのは 1 つ（ブースごとの家具の並びを、ブースの左端からの位置で比べる）
    const booths = new Map<string, string[]>();
    for (const b of r.cell.boxes) {
      const m = b.propGroup?.match(/g-od-(desk|chair|lamp|pic|plant)(\d)$/);
      if (!m) continue;
      const k = m[2]!;
      booths.set(k, [...(booths.get(k) ?? []), `${m[1]}:${b.mat}`]);
    }
    if (booths.size < 3 || booths.size > 5) fails.push(`${tag}: ブース ${booths.size}`);
    const sig = [...booths.values()].map((x) => x.sort().join('|'));
    const counts = new Map<string, number>();
    for (const s of sig) counts.set(s, (counts.get(s) ?? 0) + 1);
    const hasExtra = r.cell.boxes.some((b) => b.propGroup?.endsWith('g-od-extra'));
    // 違いが材質に出る種類（色・灯り・絵）は、ブースの並びが 2 通り（多い方 n − 1・少ない方 1）。向き・赤い玉は並びが同じ
    const sizes = [...counts.values()].sort((a, b) => a - b);
    if (!(sizes.length === 1 || (sizes.length === 2 && sizes[0] === 1)) ) fails.push(`${tag}: ブースの違いが 1 つでない ${sizes.join(',')}`);
    void hasExtra;
  }
  console.log(`  組めた ${built}`);
  assert.ok(built >= 40, `組めた ${built}`);
  assert.deepEqual(fails, []);
});

test('一つだけ違う: 生成したフロアに出て、出現型は違う家具に触れるまで隠しへ行けず、触れると現れて奥まで歩いて行ける', async () => {
  const R = await loadRapier();
  assert.ok(findRooms('oneDifferent', 6, { maxWorld: 300 }).length >= 6, 'ふつうの調整で出る');
  // 隠しを多めに・型を選んで（出現型と存在型の両方を確かめる）
  const tt = (present: number): ReturnType<typeof makeTuning>['tuning'] => makeTuning({ 'secrets.perFloorMean': 4, 'secrets.mode.present': present, 'secrets.mode.appear': 100 - present }).tuning;
  const rooms = [...findRooms('oneDifferent', 6, { maxWorld: 300, t: tt(0) }).map((r) => ({ r, t: tt(0) })), ...findRooms('oneDifferent', 4, { maxWorld: 300, t: tt(100) }).map((r) => ({ r, t: tt(100) }))];
  const fails: string[] = [];
  let appear = 0, present = 0;
  for (const { r: room, t } of rooms) {
    const sec = room.r.gimmicks!.secrets.find((s) => s.host === room.cell.id && s.hook.startsWith('oneDifferent.'));
    if (!sec) continue;
    const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    const touch = room.floor.entities.find((e) => e.type === 'oddTouch' && e.cell === room.cell.id)!;
    const box = touch.params.box as { min: number[]; max: number[] };
    const c = [(box.min[0]! + box.max[0]!) / 2, (box.min[1]! + box.max[1]!) / 2, (box.min[2]! + box.max[2]!) / 2];
    if (sec.mode === 'appear') {
      appear++;
      // 触れる前は、隠しへの入口が塞がっている
      const before = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 25);
      if (before.ok) fails.push(`${room.floor.id} ${sec.id}: 触れる前に隠しへ行けた`);
      // 違う家具の前（1.2〜1.8 m）に立って、見て調べる
      let touched = false;
      for (const dist of [1.3, 1.7, 1.0]) for (let k = 0; k < 8 && !touched; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = c[0]! + Math.cos(a) * dist, z = c[2]! + Math.sin(a) * dist;
        if (sim.colliders.query(x - 0.4, room.cell.floorY + 0.05, z - 0.4, x + 0.4, room.cell.floorY + 1.8, z + 0.4).length) continue;
        if (x < room.cell.bounds.min[0] + 0.4 || x > room.cell.bounds.max[0] - 0.4 || z < room.cell.bounds.min[2] + 0.4 || z > room.cell.bounds.max[2] - 0.4) continue;
        sim.teleport(0, [x, room.cell.floorY + 0.02, z], 0);
        for (let i = 0; i < 10; i++) sim.step([{ ...IDLE_COMMAND }]);
        const p = sim.players[0]!;
        const ex = c[0]! - p.pos[0], ez = c[2]! - p.pos[2], ey = c[1]! - (p.pos[1] + p.eye);
        const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
        sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
        touched = sim.outputOf(touch.id, 'touched') === 1;
      }
      if (!touched) { fails.push(`${room.floor.id} ${sec.id}: 違う家具に触れられない`); sim.physics?.dispose(); continue; }
      for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND }]);
    } else present++;
    const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 200);
    if (!res.ok) fails.push(`${room.floor.id} ${sec.id} ${sec.mode}: ${res.reason}`);
    sim.physics?.dispose();
  }
  console.log(`  隠し: 出現型 ${appear}・存在型 ${present}`);
  assert.ok(appear >= 2 && present >= 1, `隠しの付いた一つだけ違う: 出現型 ${appear}・存在型 ${present}`);
  assert.deepEqual(fails, []);
});
