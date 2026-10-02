/**
 * 物を運ぶ・パズル・ミニゲームの仕掛け（core/gen/gimmicks/carry）を、仕掛けの実験室（1 部屋だけのフロア）で全部試す:
 * - 入口の向き 4 つ × 出口（向かい・隣・行き止まり）× 大きさで組める
 * - 何もしない（運ばない・遊ばない）まま、入口から出口まで歩いて通れる（行き止まりなら奥まで行って入口へ戻れる）
 * - 差し出す隠しの入口は部屋の壁の上・出現型の出力は部品の出力につながっている
 * - 何もしなければ隠しは現れない・決めた遊び方（solve）をすると現れる
 * - 同じ seed なら同じ部屋（決定的）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Vec3 } from '../core/math/vec.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import type { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { walkTo } from './helpers/bot.ts';
import { ANTI, SOLVERS } from './carry-solvers.ts';
import { CARRY_CASES, farPoint, newSim, rooms } from './carry-cases.ts';

for (const c of CARRY_CASES) {
  test(`carry ${c.def}: 組める・何もしなくても通れる・隠しの入口は壁の上・何もしなければ現れず、解くと現れる`, async () => {
    const list = rooms(c.def, c.exits);
    const dirs = new Set(list.map((x) => x.entry));
    assert.ok(dirs.size >= (c.minDirs ?? 4), `${c.def}: 入口の向き ${[...dirs].join(',')}`);
    const fails: string[] = [];
    let solved = 0, offered = 0;
    for (const { room, tag } of list) {
      // 何もしないで通る（行き止まりなら奥へ行って戻る）
      {
        const sim = await newSim(room);
        sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], 0);
        const goal: Vec3 = room.exitInside ?? farPoint(sim, room);
        const res = walkTo(sim, 'room', goal, 120);
        if (!res.ok) fails.push(`${tag}: 通れない ${res.reason}`);
        else if (!room.exitInside) {
          const back = walkTo(sim, 'room', room.inside, 120);
          if (!back.ok) fails.push(`${tag}: 入口へ戻れない ${back.reason}`);
        }
        sim.physics?.dispose();
      }
      // 隠しの入口
      const r = room.slot.rect;
      for (const o of room.offers) {
        offered++;
        const d = o.doorway;
        const along = d.dir % 2 === 0 ? [r.x0, r.x1] : [r.z0, r.z1];
        if (d.at - d.width / 2 < along[0]! + 0.1 || d.at + d.width / 2 > along[1]! - 0.1) fails.push(`${tag}: 隠しの入口が壁の外 ${o.hook}`);
        if (room.slot.openings.some((op) => op.dir === d.dir && Math.abs((d.dir % 2 === 0 ? op.pos[0] : op.pos[2]) - d.at) < op.width / 2 + d.width / 2 + 0.2)) fails.push(`${tag}: 隠しの入口が開口に重なる ${o.hook}`);
        if (o.revealOutput) {
          const [eid, port] = [o.revealOutput.slice(0, o.revealOutput.lastIndexOf('.')), o.revealOutput.slice(o.revealOutput.lastIndexOf('.') + 1)];
          const e = room.floor.entities.find((x) => x.id === eid);
          if (!e || !(partDef(e.type)?.outputs ?? []).includes(port)) fails.push(`${tag}: 出現型の出力が無い ${o.revealOutput}`);
        }
      }
      // 何もしなければ現れない・解くと現れる
      const appear = room.offers.filter((o) => o.revealOutput);
      if (appear.length) {
        const idle = await newSim(room);
        idle.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], 0);
        for (let i = 0; i < 6 * 60; i++) idle.step([{ ...IDLE_COMMAND }]);
        for (const o of appear) { const i = o.revealOutput!.lastIndexOf('.'); if (idle.outputOf(o.revealOutput!.slice(0, i), o.revealOutput!.slice(i + 1)) > 0.5) fails.push(`${tag}: 何もしないのに現れる ${o.hook}`); }
        idle.physics?.dispose();
      }
      const out = (sim: Sim, o: { revealOutput?: string }): number => { const i = o.revealOutput!.lastIndexOf('.'); return sim.outputOf(o.revealOutput!.slice(0, i), o.revealOutput!.slice(i + 1)); };
      for (const solver of SOLVERS[c.def] ?? []) {
        const sim = await newSim(room);
        const want = await solver(sim, room);
        // 'group:<組>' は仕掛けが自分で現す物（床下収納の蓋など）
        const groups = want.filter((h) => h.startsWith('group:')).map((h) => h.slice(6));
        // 'out:<部品>.<出力>' は出力が入っていること
        for (const h of want.filter((x) => x.startsWith('out:'))) { const k = h.lastIndexOf('.'); groups.length; if (sim.outputOf(h.slice(4, k), h.slice(k + 1)) < 0.5) want.push('（出力が入らない）'); }
        const hit = appear.filter((o) => want.includes(o.hook));
        const outs = want.filter((h) => h.startsWith('out:'));
        if (!want.some((h) => h.startsWith('（')) && !hit.length && !groups.length && !outs.length) { sim.physics?.dispose(); continue; }
        if (want.some((h) => h.startsWith('（')) || (!hit.length && !groups.length && !outs.length) || !hit.every((o) => out(sim, o) > 0.5) || !groups.every((g) => sim.isRevealed(g))) fails.push(`${tag}: 解いても現れない（${want.join(', ')}）`);
        else solved++;
        sim.physics?.dispose();
      }
      for (const anti of ANTI[c.def] ?? []) {
        const sim = await newSim(room);
        const not = await anti(sim, room);
        for (const o of appear.filter((x) => not.includes(x.hook))) if (out(sim, o) > 0.5) fails.push(`${tag}: 普通の遊び方なのに現れる ${o.hook}`);
        for (const g of not.filter((h) => h.startsWith('group:')).map((h) => h.slice(6))) if (sim.isRevealed(g)) fails.push(`${tag}: 普通の遊び方なのに現れる ${g}`);
        for (const h of not.filter((x) => x.startsWith('out:'))) { const k = h.lastIndexOf('.'); if (sim.outputOf(h.slice(4, k), h.slice(k + 1)) > 0.5) fails.push(`${tag}: 普通の遊び方なのに入る ${h}`); }
        sim.physics?.dispose();
      }
    }
    console.log(`  ${c.def}: 組めた ${list.length}・隠しの元 ${offered}・解けた ${solved}`);
    assert.deepEqual(fails, []);
  });
}

test('carry: 同じ seed なら同じ部屋（決定的）', () => {
  for (const c of CARRY_CASES) {
    const a = rooms(c.def, [c.exits[0]!], [3]), b = rooms(c.def, [c.exits[0]!], [3]);
    assert.equal(JSON.stringify(a.map((x) => [x.room.cell.boxes, x.room.floor.entities, x.room.offers])), JSON.stringify(b.map((x) => [x.room.cell.boxes, x.room.floor.entities, x.room.offers])), c.def);
  }
});
