import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kit, MAX_BOXES, placeUnit, type DressCtx } from '../core/gen/dress/ctx.ts';
import { DRESS_KINDS, DRESS_THEMES, dressCell, kitFor } from '../core/gen/dress/index.ts';
import type { DressKind } from '../core/gen/dress/types.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import { Rng } from '../core/math/rng.ts';
import type { Dir } from '../core/math/vec.ts';
import { makeCell, opening } from '../core/world/build.ts';
import { box, type Box, type CellLayout, type WallOpening } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

/**
 * 中身の安全装置の検査: 開口のつながりを壊した物だけが外されること、変わった入力（知らないテーマ・小さな区画・
 * 部屋いっぱいの keepOut・高い位置の開口・先に置かれた物）でも壊れないこと、箱の数の上限、水のゾーンの高さ
 */

/** 10 × 6 の部屋。西の壁と東の壁に扉 */
function room(theme = 'GenericRoom', floorY = 0, extra: WallOpening[] = []): { cell: CellLayout; openings: WallOpening[] } {
  const openings = [opening('w', [0, floorY, 3], 3 as Dir), opening('e', [10, floorY, 3], 1 as Dir), ...extra];
  const cell = makeCell({ id: 'safe', role: 'rest', rects: [{ x0: 0, z0: 0, x1: 10, z1: 6 }], height: 3, floorY, palette: themePalette(theme), openings, theme });
  return { cell, openings };
}

const run = (fn: (c: DressCtx) => void, floorY = 0): { cell: CellLayout; openings: WallOpening[]; added: Box[] } => {
  const r = room('GenericRoom', floorY);
  const n0 = r.cell.boxes.length;
  kit(fn)({ cell: r.cell, kind: 'room', openings: r.openings, keepOut: [], rng: new Rng(1), density: 0.5 });
  return { ...r, added: r.cell.boxes.slice(n0) };
};

test('部屋を横切る壁（開口のつながりを壊す物）だけが外され、ほかの物は残る', () => {
  for (const floorY of [0, -3.6]) {
    const { cell, openings, added } = run((c) => {
      // 前に 2 つ・壁・後に 2 つ（どれも扉前には掛からない）
      placeUnit(c, [box([2.0, 0, 0.3], [2.6, 0.8, 0.9], 'furnitureDark')]);
      placeUnit(c, [box([7.0, 0, 5.1], [7.6, 0.8, 5.7], 'furnitureDark')]);
      placeUnit(c, [{ ...box([4.9, 0, 0.15], [5.1, 2.4, 5.85], 'wallWhite'), kind: 'blocker' }]);
      placeUnit(c, [box([3.0, 0, 5.1], [3.6, 0.8, 5.7], 'furnitureLight')]);
      placeUnit(c, [box([8.0, 0, 0.3], [8.6, 0.8, 0.9], 'furnitureLight')]);
    }, floorY);
    assert.equal(added.length, 4, '壁だけが外れる');
    assert.ok(!added.some((b) => b.kind === 'blocker'));
    assert.ok(added.every((b) => b.min[1] >= floorY - 1e-9), '高さはフロア座標（floorY を足してある）');
    const r = reachOpenings(cell, openings);
    assert.ok(r && r.blocked.length === 0);
  }
});

test('つながりを壊す物が 2 つあれば 2 つとも外れる', () => {
  const { added } = run((c) => {
    placeUnit(c, [{ ...box([3.9, 0, 0.15], [4.1, 2.4, 5.85], 'wallWhite'), kind: 'blocker' }]);
    placeUnit(c, [box([5.5, 0, 0.3], [6.1, 0.8, 0.9], 'furnitureDark')]);
    placeUnit(c, [{ ...box([6.9, 0, 0.15], [7.1, 2.4, 5.85], 'wallWhite'), kind: 'blocker' }]);
  });
  assert.deepEqual(added.map((b) => b.kind ?? ''), ['']);
});

test('扉前・keepOut・足跡の外・先に置いた物との重なりは置けない', () => {
  run((c) => {
    assert.equal(placeUnit(c, [box([0.2, 0, 2.5], [0.8, 0.8, 3.5], 'furnitureDark')]), false, '西の扉の前');
    assert.equal(placeUnit(c, [box([-0.5, 0, 1], [0.5, 0.8, 2], 'furnitureDark')]), false, '足跡の外');
    assert.equal(placeUnit(c, [box([0.05, 0, 0.5], [0.6, 0.8, 1.0], 'furnitureDark')]), false, '壁の中');
    assert.equal(placeUnit(c, [box([4, 0, 1], [5, 0.8, 2], 'furnitureDark')]), true);
    assert.equal(placeUnit(c, [box([4.5, 0, 1.5], [5.5, 0.8, 2.5], 'furnitureDark')]), false, '重なり');
    assert.equal(placeUnit(c, [box([4, 0, 1], [5, 3.5, 2], 'furnitureDark', false)]), false, '天井より上');
    // 当たらない飾りは扉前でもよい（床の線など）
    assert.equal(placeUnit(c, [box([0.2, 0.001, 2.5], [0.8, 0.01, 3.5], 'yellowLine', false)]), true);
  });
});

test('知らないテーマ・テーマ無し・小さな区画・部屋いっぱいの keepOut でも壊れない', () => {
  for (const theme of ['NoSuchTheme', '']) {
    for (const kind of DRESS_KINDS) {
      const r = room(theme);
      if (!theme) delete r.cell.theme;
      assert.doesNotThrow(() => dressCell({ cell: r.cell, kind, openings: r.openings, keepOut: [], rng: new Rng(3), density: 0.6 }));
    }
  }
  // 2 m 角の切れ端: 何も置かない
  const ops = [opening('a', [1, 0, 0], 2 as Dir, 1.6, 2.4), opening('b', [1, 0, 2], 0 as Dir, 1.6, 2.4)];
  const tiny = makeCell({ id: 'tiny', role: 'connector', rects: [{ x0: 0, z0: 0, x1: 2, z1: 2 }], height: 2.6, palette: themePalette('CorridorOffice'), openings: ops, theme: 'CorridorOffice' });
  const n0 = tiny.boxes.length;
  dressCell({ cell: tiny, kind: 'junction', openings: ops, keepOut: [], rng: new Rng(1), density: 1 });
  assert.equal(tiny.boxes.length, n0);
  // keepOut が部屋全体: 当たる物は置かない
  for (const theme of ['OfficeGrid', 'Theater', 'WarehouseGrid', 'MazeGrid', 'PoolCorridor']) {
    const r = room(theme);
    const n1 = r.cell.boxes.length;
    dressCell({ cell: r.cell, kind: 'hall', openings: r.openings, keepOut: [{ min: [0, 0, 0], max: [10, 3, 6] }], rng: new Rng(5), density: 1 });
    assert.ok(!r.cell.boxes.slice(n1).some((b) => b.solid), `${theme}: keepOut の中に当たる物`);
  }
});

test('高い位置の開口（窓・上の階）があっても置ける。床の高さの開口どうしはつながる', () => {
  const high = [opening('win', [5, 0, 6], 0 as Dir, 2.0, 1.0, 1.2), opening('up', [5, 1.6, 0], 2 as Dir, 1.0, 2.1)];
  for (const theme of ['OfficeGrid', 'Classroom', 'Restroom', 'RetailRoom']) {
    const r = room(theme, 0, high);
    dressCell({ cell: r.cell, kind: 'room', openings: r.openings, keepOut: [], rng: new Rng(7), density: 0.8 });
    const res = reachOpenings(r.cell, r.openings);
    assert.ok(res && res.blocked.length === 0, theme);
  }
});

test('先に置かれていた当たる物（仕掛けの台）には重ねない', () => {
  for (const theme of DRESS_THEMES) {
    const r = room(theme);
    const obstacle = box([4, 0, 2], [6, 1.0, 4], 'metal');
    obstacle.kind = 'gimmick';
    r.cell.boxes.push(obstacle);
    const n0 = r.cell.boxes.length;
    dressCell({ cell: r.cell, kind: 'room', openings: r.openings, keepOut: [], rng: new Rng(11), density: 1 });
    for (const b of r.cell.boxes.slice(n0)) {
      if (!b.solid) continue;
      const hit = b.min[0] < obstacle.max[0] - 1e-3 && b.max[0] > obstacle.min[0] + 1e-3 && b.min[1] < obstacle.max[1] - 1e-3 && b.max[1] > obstacle.min[1] + 1e-3 && b.min[2] < obstacle.max[2] - 1e-3 && b.max[2] > obstacle.min[2] + 1e-3;
      assert.ok(!hit, `${theme}: ${b.mat} が先に置かれた物に重なる`);
    }
  }
});

test('箱の数は上限まで。プールの水面のゾーンはフロア座標の高さ', () => {
  for (const kind of ['room', 'hall'] as DressKind[]) {
    for (const theme of DRESS_THEMES) {
      const openings = [opening('a', [0, 1.8, 12], 3 as Dir), opening('b', [30, 1.8, 12], 1 as Dir, 2.2, 2.6)];
      const cell = makeCell({ id: 'big', role: 'hub', rects: [{ x0: 0, z0: 0, x1: 30, z1: 24 }], height: 4.5, floorY: 1.8, palette: themePalette(theme), openings, theme });
      const n0 = cell.boxes.length;
      kitFor(theme, kind)({ cell, kind, openings, keepOut: [], rng: new Rng(2), density: 1 });
      assert.ok(cell.boxes.length - n0 <= MAX_BOXES, `${theme} ${kind}: ${cell.boxes.length - n0} 箱`);
      if (theme === 'PoolCorridor') {
        assert.ok(cell.zones.some((z) => z.kind === 'water'), '水のゾーン');
        for (const z of cell.zones) assert.ok(z.aabb.min[1] >= 1.8 - 0.11 && z.aabb.max[1] <= 1.8 + 0.5, `ゾーンの高さ ${z.aabb.min[1]}..${z.aabb.max[1]}`);
      }
    }
  }
});
