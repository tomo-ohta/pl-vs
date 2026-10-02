/**
 * 移動と身体の見本のフロア（クライアントの ?try=a,b,…）: 目で見て確かめる組ごとに、頼んだ仕掛け・異変が全部置かれ、
 * フロアが検証に通り、同じ頼み方なら同じフロアになる。組は報告の「目で見て確かめてほしい所」と同じ
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { MOVE_CATALOG } from '../core/gen/catalog/move.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { validateFloor } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';

const t = defaultTuning();
export const MOVE_TRY_GROUPS: string[][] = [
  ['windTunnel', 'footingRoom', 'backwardHall', 'stretchHall', 'crawlTunnel'],
  ['trapdoorFloor', 'ghostBridge', 'swayBridge', 'pendulumHall'],
  ['riseHall', 'escalator', 'slideRoom', 'atrium'],
  ['turntable', 'revolvingDoor', 'pushWall', 'slantRoom'],
  ['poolRoom', 'ballPool', 'ballRide', 'sizeRoom', 'gravityHall'],
  ['heavyRoom', 'underwater'],
];

test('移動と身体の見本のフロア: 組ごとに頼んだ仕掛け・異変が全部置かれ、検証に通り、決定的', () => {
  for (const ids of MOVE_TRY_GROUPS) {
    const r = showcaseFloor(t, { ids, dress: dressCell });
    const placed = new Set([...(r.gimmicks?.gimmicks ?? []).map((g) => g.def), ...r.anomalies.map((a) => a.def)]);
    assert.deepEqual(ids.filter((x) => !placed.has(x)), [], `${ids.join(',')}: 置けなかった物`);
    assert.deepEqual(validateFloor(r.floor), [], `${ids.join(',')}: 検証`);
    assert.equal(JSON.stringify(showcaseFloor(t, { ids, dress: dressCell }).floor), JSON.stringify(r.floor));
  }
});

test('移動と身体の見本のフロアの組: この担当が作った仕掛け・異変を全部含む', () => {
  const mine = new Set(MOVE_CATALOG.filter((e) => e.status === 'done' || e.status === 'merged').flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick' || m.kind === 'anomaly').map((m) => m.id)));
  const listed = new Set(MOVE_TRY_GROUPS.flat());
  assert.deepEqual([...mine].filter((x) => !listed.has(x)), []);
});
