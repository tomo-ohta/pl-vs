import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { walkTo } from './helpers/bot.ts';

const t = defaultTuning();

/** 入口から開口をたどって行ける区画（concealed: 隠しの壁で塞がっている開口を通らない） */
function reachable(floor: FloorLayout, blocked: Set<string>): Set<string> {
  const seen = new Set([floor.spawn.cell]);
  const q = [floor.spawn.cell];
  for (let h = 0; h < q.length; h++) for (const p of floor.portals) {
    if (blocked.has(p.id) || !p.cells.includes(q[h]!)) continue;
    const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
    if (!seen.has(o)) { seen.add(o); q.push(o); }
  }
  return seen;
}

test('隠し: 出現型は現れる前は行けない・存在型は最初から行ける', () => {
  let present = 0, appear = 0;
  for (let w = 1; w <= 80; w++) {
    const r = generateFloorReport({ world: w, depth: 3, variant: 0 }, t);
    for (const s of r.gimmicks?.secrets ?? []) {
      const portal = r.floor.portals.find((p) => p.cells.includes(s.cell))!;
      const sealed = reachable(r.floor, new Set(s.mode === 'appear' ? [portal.id] : []));
      if (s.mode === 'appear') {
        appear++;
        assert.ok(!sealed.has(s.cell), `${r.floor.id} ${s.id}: 出現型なのに最初から行ける`);
        const rev = r.floor.entities.find((e) => e.id === `${s.id}.reveal`);
        assert.ok(rev && rev.inputs?.show, `${s.id}: 現す部品と配線がある`);
        assert.ok(r.floor.cells.some((c) => c.boxes.some((b) => b.concealGroup === `${s.id}.wall`)), `${s.id}: 入口を塞ぐ壁がある`);
      } else {
        present++;
        assert.ok(sealed.has(s.cell), `${r.floor.id} ${s.id}: 存在型なのに行けない`);
      }
    }
  }
  console.log(`  存在型 ${present}・出現型 ${appear}`);
  assert.ok(present > 5 && appear > 5);
});

test('謎のパズル: 手がかりの順にボタンを押すと扉が現れる（間違えると現れない）', async () => {
  const R = await loadRapier();
  let solved = 0;
  for (let w = 1; w <= 60 && solved < 4; w++) {
    const r = generateFloorReport({ world: w, depth: 2, variant: 0 }, t);
    const sec = r.gimmicks?.secrets.find((s) => s.hook === 'puzzle.sequence');
    if (!sec) continue;
    const floor = r.floor;
    const seqSpec = floor.entities.find((e) => e.type === 'sequence' && e.cell === sec.host)!;
    const order = [1, 2, 3].map((i) => String(seqSpec.inputs![`s${i}`]).replace(/\.pressed$/, ''));
    const press = (sim: Sim, id: string): void => {
      const b = floor.entities.find((e) => e.id === id)!.params.box as { min: number[]; max: number[] };
      const c = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
      const host = floor.cells.find((x) => x.id === sec.host)!;
      // ボタンの前（部屋の中心の方へ 0.9 m）に立つ
      const mid = [(host.bounds.min[0] + host.bounds.max[0]) / 2, (host.bounds.min[2] + host.bounds.max[2]) / 2];
      const dx = mid[0]! - c[0]!, dz = mid[1]! - c[2]!, l = Math.hypot(dx, dz);
      const p = sim.players[0]!;
      p.pos = [c[0]! + (dx / l) * 0.9, host.floorY + 0.02, c[2]! + (dz / l) * 0.9];
      p.vel = [0, 0, 0];
      for (let i = 0; i < 20; i++) sim.step([{ ...IDLE_COMMAND, yaw: p.yaw, pitch: 0 }]);
      const ex = c[0]! - p.pos[0], ey = c[1]! - (p.pos[1] + p.eye), ez = c[2]! - p.pos[2];
      const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
      sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
      for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND, yaw, pitch }]);
    };
    // 間違った順: 現れない
    const wrong = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (const id of [order[1]!, order[0]!, order[2]!]) press(wrong, id);
    assert.ok(!wrong.isRevealed(`${sec.id}.wall`), `${floor.id}: 間違った順では現れない`);
    // 正しい順: 現れる
    const sim = new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    for (const id of order) press(sim, id);
    assert.ok(sim.isRevealed(`${sec.id}.wall`), `${floor.id}: 正しい順で現れる（${order.join(' → ')}）`);
    solved++;
  }
  assert.ok(solved >= 3, `パズルのあるフロアを ${solved} 件解いた`);
});

test('細い道: 落ちた先の隠し部屋まで歩いて行ける（存在型）', async () => {
  const R = await loadRapier();
  let ok = 0, n = 0;
  for (let w = 1; w <= 150 && n < 4; w++) {
    const r = generateFloorReport({ world: w, depth: 5, variant: 0 }, t);
    const sec = r.gimmicks?.secrets.find((s) => s.hook === 'fall.below');
    if (!sec) continue;
    n++;
    const sim = new Sim(r.floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });
    const res = walkTo(sim, sec.cell);
    if (res.ok) ok++;
    else console.log(`  ${r.floor.id}: ${res.reason}`);
  }
  assert.ok(n >= 2, `細い道の隠しがあるフロア: ${n}`);
  assert.equal(ok, n);
});
