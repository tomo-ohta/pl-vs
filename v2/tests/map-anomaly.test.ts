/**
 * 地図の異変（core/gen/anomaly/defs/map）: 地図が消える（N02）・地図が回る（N03）・地図にない部屋（N08）。
 * 見本のフロアで置ける・見て分かる形（白紙・方位盤・白い空き部屋）・地図の部品（mapFx）・自分の地図が変わる・決定的。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { buildMapInfo, cellAtPos } from '../client/map/MapInfo.ts';
import { FloorMap } from '../client/map/MapModel.ts';

const t = defaultTuning();
const IDS = ['mapErase', 'mapRotate', 'unmapped'];

test('見本のフロア（?try=mapErase,mapRotate,unmapped）: 3 つとも置ける・見て分かる形・地図の部品', () => {
  const r = showcaseFloor(t, { ids: IDS, dress: dressCell });
  assert.deepEqual(new Set(r.anomalies.map((a) => a.def)), new Set(IDS));
  for (const a of r.anomalies) {
    const c = r.floor.cells.find((x) => x.id === a.cell)!;
    const fx = r.floor.entities.find((e) => e.id === `${a.id}.fx`);
    assert.ok(fx && fx.type === 'mapFx' && fx.cell === c.id, `${a.id}: 地図の部品`);
    if (a.def === 'mapErase') {
      assert.ok(c.boxes.filter((b) => b.mat === 'paintWhite' && !b.solid && b.propGroup?.includes('a-mapErase-sheet')).length >= 12, '壁と床の白紙');
      assert.ok(['all', 'half', 'far'].includes(String(fx.params.policy)));
    }
    if (a.def === 'mapRotate') {
      assert.ok(c.boxes.some((b) => b.mat === 'plasticRed' && b.propGroup?.includes('a-mapRotate-rose')), '方位盤の北の矢印');
      assert.ok([90, 135, 180, 225, 270].includes(Number(fx.params.angle)));
      // 盤の上に家具が無い
      const rose = c.boxes.filter((b) => b.propGroup?.includes('a-mapRotate-rose'));
      const x0 = Math.min(...rose.map((b) => b.min[0])), x1 = Math.max(...rose.map((b) => b.max[0])), z0 = Math.min(...rose.map((b) => b.min[2])), z1 = Math.max(...rose.map((b) => b.max[2]));
      assert.ok(!c.boxes.some((b) => b.solid && b.propGroup && !b.propGroup.includes('a-mapRotate') && b.min[0] < x1 && b.max[0] > x0 && b.min[2] < z1 && b.max[2] > z0 && b.min[1] < c.floorY + 0.5), '盤が家具に隠れない');
    }
    if (a.def === 'unmapped') {
      assert.ok(!c.boxes.some((b) => b.propGroup), '家具の無い空き部屋');
      assert.equal(c.palette.wall, 'paintWhite');
      assert.equal(c.audioPreset, '無音に近い');
      assert.ok(buildMapInfo(r.floor, t).byId.get(c.id)!.hidden, '地図に記録されない');
    }
  }
});

test('ふつうのフロアにも出る・同じ key なら同じ', () => {
  const by: Record<string, number> = {};
  // 150 フロア。異変の種類が増えて揃わなければ、どれも 3 回出るまで（400 フロアまで）
  for (let w = 1; w <= 150 || (w <= 400 && IDS.some((id) => (by[id] ?? 0) < 3)); w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, t);
    for (const a of r.anomalies) if (IDS.includes(a.def)) by[a.def] = (by[a.def] ?? 0) + 1;
  }
  console.log('  ', JSON.stringify(by));
  for (const id of IDS) assert.ok((by[id] ?? 0) >= 3, `${id} が出る`);
  const a = generateFloorReport({ world: 7, depth: 3, variant: 0 }, t, { dress: dressCell });
  const b = generateFloorReport({ world: 7, depth: 3, variant: 0 }, t, { dress: dressCell });
  assert.equal(JSON.stringify(a.floor), JSON.stringify(b.floor));
});

test('自分の地図: 地図が消える部屋に入ると、見ていた区画が消える・地図が回る部屋で地図が回る', () => {
  const r = showcaseFloor(t, { ids: IDS, dress: dressCell });
  const info = buildMapInfo(r.floor, t);
  const map = new FloorMap(info, t);
  const at = (cellId: string): [number, number, number] => {
    const c = r.floor.cells.find((x) => x.id === cellId)!;
    const fp = c.footprint[0]!;
    return [(fp.x0 + fp.x1) / 2, c.floorY, (fp.z0 + fp.z1) / 2];
  };
  const o = (pos: [number, number, number], dt = 1 / 60) => ({ pos, yaw: 0, dt, doorAngle: () => 1, revealed: () => false });
  // いくつかの区画を見ておく
  for (const c of r.floor.cells.slice(0, 12)) if (c.role !== 'secret') map.update(o(at(c.id)));
  const before = map.seen.size;
  assert.ok(before >= 6);
  const erase = r.anomalies.find((a) => a.def === 'mapErase')!;
  const ev = map.update(o(at(erase.cell)));
  assert.ok(ev.some((e) => e.type === 'fx' && e.fx === 'erase'));
  assert.ok(map.erased.size > 0, '消えた区画がある');
  assert.equal(cellAtPos(info, at(erase.cell))!.id, erase.cell);
  const rot = r.anomalies.find((a) => a.def === 'mapRotate')!;
  for (let i = 0; i < 40; i++) map.update(o(at(rot.cell), 0.1));
  assert.ok(Math.abs(map.rotation) > 0.5, `回った ${map.rotation}`);
});
