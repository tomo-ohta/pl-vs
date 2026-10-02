/**
 * 担当 sense の仕掛け・異変が、ふつうのフロアの生成で出る・歩く人が仕掛けの部屋を入口から出口の向こうまで抜けられる（遊び方どおり）・
 * 見本のフロア（?try=）に置ける・同じ鍵なら同じフロア
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import { gimmickDef } from '../core/gen/gimmicks/types.ts';
import { anomalyDef } from '../core/gen/anomaly/index.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { walkTo } from './helpers/bot.ts';
import { regenerate } from './helpers/gimmick-rooms.ts';
import type { Sim } from '../core/sim/sim.ts';
import { findSenseRooms, simOf, T } from './sense-util.ts';

const IDS = [...new Set((CATALOG_BY_WS.sense ?? []).filter((e) => e.status === 'done').flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick' || m.kind === 'anomaly').map((m) => m.id)))];
const GIMMICKS = IDS.filter((id) => gimmickDef(id));
const ANOMALIES = IDS.filter((id) => anomalyDef(id) && !gimmickDef(id));
/** 生成の偶然で出にくい物（部屋の形の条件が厳しい）は、見本のフロアで置けることだけ確かめる */
const RARE = new Set(['lightBands']);

test('担当 sense の仕掛け: ふつうのフロアに出る・歩く人が部屋を抜けられる', async () => {
  const found = findSenseRooms(GIMMICKS, 2, 900);
  const fails: string[] = [], missing: string[] = [];
  for (const def of GIMMICKS) {
    const rooms = found.get(def)!;
    if (!rooms.length) { if (!RARE.has(def)) missing.push(def); continue; }
    for (const room of rooms.filter((x) => x.beyond)) {
      const sim = await simOf(room.floor);
      sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
      const res = walkTo(sim, room.beyond!, undefined, 150);
      if (!res.ok || !res.route.includes(room.exit!.id)) fails.push(`${def} ${room.floor.id}@w${room.key.world} ${room.cell.id}: ${res.reason || '部屋を通らない道順'}`);
      sim.physics?.dispose();
    }
  }
  assert.deepEqual(missing, [], 'ふつうのフロアに出ない仕掛け');
  assert.deepEqual(fails, []);
});

test('担当 sense の仕掛け・異変: 見本のフロア（?try=）に置ける・同じ鍵なら同じフロア', () => {
  const placed = new Set<string>();
  for (let i = 0; i < IDS.length; i += 6) {
    const ids = IDS.slice(i, i + 6);
    const r = showcaseFloor(T, { ids, dress: dressCell });
    for (const g of r.gimmicks?.gimmicks ?? []) placed.add(g.def);
    for (const a of r.anomalies) placed.add(a.def);
  }
  assert.deepEqual(IDS.filter((id) => !placed.has(id)), [], '見本のフロアに置けない');
  const found = findSenseRooms(GIMMICKS, 1, 900);
  for (const def of GIMMICKS) {
    const room = found.get(def)?.[0];
    if (!room) continue;
    const again = regenerate(room);
    assert.equal(JSON.stringify(again.cells.find((c) => c.id === room.cell.id)), JSON.stringify(room.cell), `${def}: 同じ区画`);
    assert.equal(JSON.stringify(again.entities.filter((e) => e.cell === room.cell.id)), JSON.stringify(room.floor.entities.filter((e) => e.cell === room.cell.id)), `${def}: 同じ部品`);
  }
  void ANOMALIES;
});

/** 隠しの壁を全部消す（出現型は、裏の振る舞いの出力で現れることを仕掛けごとの試験で確かめる。ここでは現れた後に歩けるか） */
function revealAll(sim: Sim): void {
  for (const e of sim.floor.entities) if (e.type === 'reveal') (sim as unknown as { revealGroup(g: string, b: string): void }).revealGroup(String(e.params.group), 'test');
}

test('担当 sense の隠し: 仕掛けの部屋から隠しの奥まで歩いて行ける（存在型・出現型は現れた後）', async () => {
  const found = findSenseRooms(GIMMICKS, 8, 1200);
  const seen = new Map<string, number>();
  const fails: string[] = [];
  let n = 0;
  for (const def of GIMMICKS) for (const room of found.get(def) ?? []) {
    for (const sec of room.r.gimmicks?.secrets.filter((x) => x.host === room.cell.id) ?? []) {
      const key = `${sec.hook}|${sec.mode}`;
      if ((seen.get(key) ?? 0) >= 2) continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      n++;
      const sim = await simOf(room.floor);
      revealAll(sim);
      sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
      const res = walkTo(sim, sec.cells[sec.cells.length - 1]!, undefined, 150);
      if (!res.ok) fails.push(`${def} ${sec.hook}(${sec.mode}) ${room.floor.id}@w${room.key.world} ${room.cell.id}: ${res.reason}`);
      sim.physics?.dispose();
    }
  }
  console.log(`  隠し ${n}: ${[...seen.keys()].join('・')}`);
  assert.ok(n >= 10, `隠し ${n}`);
  assert.deepEqual(fails, []);
});
