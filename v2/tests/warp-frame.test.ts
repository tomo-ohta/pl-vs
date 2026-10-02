/**
 * 距離を飛び越える扉（lightFrame: W03・BX03）: 枠の表からくぐると展望室へ（継ぎ目なく・同じ所の関係のまま）・振り返ってくぐると戻る・
 * 枠の横や外を回っても移されない・裏は隠しが付いているときだけ白い廊下へ（くぐった tick に突き当たりの扉が現れる）・展望室と廊下の枠は部屋の枠と同じ形・
 * 歩く人が展望室・隠しの奥まで行ける・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import type { AABB } from '../core/math/aabb.ts';
import { rotQ, type Dir, type Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { readXform, xBox, xPoint, type Xform } from '../core/sim/parts/warp/util.ts';
import { Sim } from '../core/sim/sim.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { cellAtPos, walkTo } from './helpers/bot.ts';
import { findRooms, regenerate, type GimmickRoom } from './helpers/gimmick-rooms.ts';
import { stepWith, twinMismatch } from './helpers/warp.ts';

const t = defaultTuning();
const RAPIER = await loadRapier();
// 隠しを多めに（段階 4 で隠しを差し出す仕掛けが増え、ふつうの調整では隠しの付いた枠・窓が少ない）
const ROOMS = findRooms('lightFrame', 6, { maxWorld: 300, t: { ...t, 'secrets.perFloorMean': 3 } as typeof t });
const ent = (f: FloorLayout, id: string) => f.entities.find((e) => e.id === id)!;
const here = (sim: Sim): string => cellAtPos(sim.floor, sim.players[0]!.pos)?.id ?? '?';

interface FrameInfo { c: Vec3; ts: Dir; xSD: Xform; xSE: Xform; box: AABB }
function frameOf(room: GimmickRoom): FrameInfo {
  const g = ent(room.floor, `${room.id}.gSF`).params as { box: AABB; dir: number; xform: unknown };
  const gb = ent(room.floor, `${room.id}.gSB`).params as { xform: unknown };
  const b = g.box;
  return { c: [(b.min[0] + b.max[0]) / 2, room.cell.floorY, (b.min[2] + b.max[2]) / 2], ts: (g.dir & 3) as Dir, xSD: readXform(g.xform as never), xSE: readXform(gb.xform as never), box: b };
}
function simAt(room: GimmickRoom, pos: Vec3, yaw: number): Sim {
  const sim = new Sim(room.floor, { tuning: t, physics: new PhysicsWorld(RAPIER, 1 / 60) });
  sim.teleport(0, [pos[0], room.cell.floorY + 0.02, pos[2]], yaw);
  stepWith(sim, 5, () => ({}));
  return sim;
}
const yawOf = (d: readonly number[]): number => Math.atan2(-d[0]!, -d[2]!);

test('距離を飛び越える扉: 表からくぐると展望室へ（継ぎ目なく）・振り返ってくぐると元の部屋の表へ', () => {
  assert.ok(ROOMS.length >= 3, `距離を飛び越える扉: ${ROOMS.length}`);
  for (const room of ROOMS) {
    const F = frameOf(room);
    const u = rotQ([0, 0, 1], F.ts);
    const start: Vec3 = [F.c[0] - u[0] * 1.2, F.c[1], F.c[2] - u[2] * 1.2];
    const sim = simAt(room, start, yawOf(u));
    const w: ReturnType<typeof stepWith> = [];
    for (let i = 0; i < 120 && !w.length; i++) w.push(...stepWith(sim, 1, () => ({ yaw: yawOf(u), moveY: 1 })));
    assert.equal(w.length, 1, `${room.cell.id}: くぐると移る`);
    assert.ok(w[0]!.data?.seamless, '継ぎ目なく');
    assert.equal(here(sim), `${room.cell.id}~view`, '展望室へ');
    // 移った所は、枠からの関係が同じ（真上へ平行に移す）
    const p = sim.players[0]!.pos;
    const back = xPoint({ from: F.xSD.to, to: F.xSD.from, q: 0 }, p);
    assert.ok(Math.abs(((back[0] - F.c[0]) * u[0] + (back[2] - F.c[2]) * u[2])) < 3, '枠のすぐ先');
    // 振り返ってくぐると戻る（枠の表の側へ）
    const w2: ReturnType<typeof stepWith> = [];
    for (let i = 0; i < 240 && !w2.length; i++) w2.push(...stepWith(sim, 1, () => ({ yaw: yawOf([-u[0], 0, -u[2]]), moveY: 1 })));
    assert.equal(w2.length, 1, `${room.cell.id}: 展望室から戻る`);
    assert.equal(here(sim), room.cell.id);
    const q = sim.players[0]!.pos;
    assert.ok((q[0] - F.c[0]) * u[0] + (q[2] - F.c[2]) * u[2] < 0, '枠の表の側に出る');
  }
});

test('距離を飛び越える扉: 枠の外を回っても移されない・裏は隠しがあるときだけ白い廊下へ（くぐった tick に扉が現れる）', () => {
  let secrets = 0;
  for (const room of ROOMS) {
    const F = frameOf(room);
    const u = rotQ([0, 0, 1], F.ts), l = rotQ([0, 0, 1], ((F.ts + 1) % 4) as Dir);
    // 枠の横（1.5 m 横）を表から裏へ歩いても移されない
    const side: Vec3 = [F.c[0] - u[0] * 1.2 + l[0] * 1.5, F.c[1], F.c[2] - u[2] * 1.2 + l[2] * 1.5];
    const sim = simAt(room, side, yawOf(u));
    assert.equal(stepWith(sim, 120, () => ({ yaw: yawOf(u), moveY: 1 })).length, 0, `${room.cell.id}: 枠の外は移されない`);
    // 裏から表へくぐる
    const sec = room.r.gimmicks?.secrets.find((s) => s.host === `${room.cell.id}~white`);
    const behind: Vec3 = [F.c[0] + u[0] * 1.2, F.c[1], F.c[2] + u[2] * 1.2];
    const s2 = simAt(room, behind, yawOf([-u[0], 0, -u[2]]));
    const w = stepWith(s2, 90, () => ({ yaw: yawOf([-u[0], 0, -u[2]]), moveY: 1 }));
    if (!sec) {
      assert.equal(w.length, 0, `${room.cell.id}: 隠しが無ければ裏はただの枠`);
      continue;
    }
    secrets++;
    assert.equal(w.length, 1, `${room.cell.id}: 裏からくぐると白い廊下へ`);
    assert.equal(here(s2), `${room.cell.id}~white`);
    assert.ok(s2.isRevealed(`${sec.id}.wall`), '突き当たりの扉が現れる');
    const r = walkTo(s2, sec.cells[sec.cells.length - 1]!, undefined, 120);
    assert.ok(r.ok, `${room.cell.id}: 隠しの奥へ: ${r.reason}`);
    const home = walkTo(s2, room.cell.id, undefined, 120);
    assert.ok(home.ok, `${room.cell.id}: 廊下から戻れる: ${home.reason}`);
  }
  assert.ok(secrets >= 1, `隠しの付いた枠 ${secrets}`);
});

test('距離を飛び越える扉: 展望室・廊下の枠は部屋の枠と同じ形（枠の中から見える所が揃う）・歩く人が展望室へ行って戻れる・決定的', () => {
  for (const room of ROOMS) {
    const f = room.floor;
    const F = frameOf(room);
    const frame: AABB = { min: [F.box.min[0] - 0.2, room.cell.floorY + 0.05, F.box.min[2] - 0.2], max: [F.box.max[0] + 0.2, room.cell.floorY + 2.32, F.box.max[2] + 0.2] };
    // 枠のまわり（床の上）の箱は、写した先でも同じ（展望室・廊下は区画の床を除く）
    const only = (bad: string[]): string[] => bad.filter((b) => b.includes('lightPanel'));
    assert.deepEqual(only(twinMismatch(f, F.xSD, frame)), [], `${room.cell.id}: 展望室の枠`);
    assert.ok(xBox(F.xSD, frame).min[1] > room.cell.floorY + 10, '展望室は上空');
    const sim = simAt(room, room.inside, 0);
    const r = walkTo(sim, `${room.cell.id}~view`, undefined, 80);
    assert.ok(r.ok, `${room.cell.id}: 歩く人が展望室へ: ${r.reason}`);
    const b = walkTo(sim, room.beyond ?? room.cell.id, undefined, 80);
    assert.ok(b.ok, `w${room.key.world} ${room.cell.id}: 展望室から戻れる: ${b.reason}`);
    const again = regenerate(room, { t: { ...t, 'secrets.perFloorMean': 3 } as typeof t });
    assert.equal(JSON.stringify(again.entities.filter((e) => e.id.startsWith(room.id))), JSON.stringify(f.entities.filter((e) => e.id.startsWith(room.id))));
  }
});
