/**
 * 担当 sense の仕掛け・異変が、ふつうのフロアの生成で出る・歩く人が仕掛けの部屋を入口から出口の向こうまで抜けられる（遊び方どおり）・
 * 見本のフロア（?try=）に置ける・同じ鍵なら同じフロア
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import { gimmickDef } from '../core/gen/gimmicks/types.ts';
import { anomalyDef } from '../core/gen/anomaly/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { walkTo } from './helpers/bot.ts';
import { regenerate } from './helpers/gimmick-rooms.ts';
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
    const r = showcaseFloor(T, { ids });
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
