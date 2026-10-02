// 箱の形の特別扱い（client/render/BoxShapes.ts）と FloorBuilder: 水面は上面だけ・水たまりは不定形・傾けた箱は剪断。
// FloorBuilder では、水面のメッシュの原点が水槽の底（材質の水深 = メッシュの座標の y）・傾けた手すりが段の勾配に沿う・焼き込みが有限
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';
import { BASIN } from '../core/gen/dress/basin.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { RAIL_HEIGHT } from '../core/gen/dress/kits/corridor.ts';
import { Rng } from '../core/math/rng.ts';
import type { Dir } from '../core/math/vec.ts';
import { makeCell, opening } from '../core/world/build.ts';
import { box, WALL_T, type Box, type CellLayout, type FloorLayout } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

const verts = (g: THREE.BufferGeometry): { p: number[][]; n: number[][] } => {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const out = { p: [] as number[][], n: [] as number[][] };
  for (let i = 0; i < p.count; i++) { out.p.push([p.getX(i), p.getY(i), p.getZ(i)]); out.n.push([n.getX(i), n.getY(i), n.getZ(i)]); }
  return out;
};

/** 三角形の面積の和（xz に投影） */
function areaXZ(g: THREE.BufferGeometry): number {
  const ng = g.index ? g.toNonIndexed() : g;
  const p = ng.getAttribute('position');
  let a = 0;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i + 1) - p.getX(i), az = p.getZ(i + 1) - p.getZ(i), bx = p.getX(i + 2) - p.getX(i), bz = p.getZ(i + 2) - p.getZ(i);
    a += Math.abs(ax * bz - az * bx) / 2;
  }
  return a;
}

test('水面は上面だけ（横・底の面が無い）・水壁と水膜は板のまま', async () => {
  const { boxGeometry, isWaterSurfaceMat, waterBase } = await import('../client/render/BoxShapes.ts');
  assert.ok(isWaterSurfaceMat('water') && isWaterSurfaceMat('waterShallow'));
  for (const m of ['waterWall', 'waterFilm', 'puddle', 'glass', 'floorTile'] as const) assert.ok(!isWaterSurfaceMat(m), m);
  const b: Box = { min: [1, -0.3, 2], max: [6, -0.06, 4.5], mat: 'waterShallow', solid: false };
  assert.equal(waterBase(b), -0.3);
  const g = boxGeometry(b);
  const { p, n } = verts(g);
  assert.ok(p.length > 0);
  assert.ok(n.every((v) => Math.abs(v[1]! - 1) < 1e-6), '法線は全部上向き');
  assert.ok(p.every((v) => Math.abs(v[1]! + 0.06) < 1e-6), '全部の頂点が水面の高さ');
  assert.ok(Math.abs(areaXZ(g) - 5 * 2.5) < 1e-6, '上面の広さ = 箱の足跡');
  assert.ok(g.getAttribute('uv'), 'UV（波紋の模様）がある');
  // 分割は surfaceBox と同じ（頂点焼き込みの細かさ。1.25 m ごと）: 4 × 2 枡 × 2 三角形
  assert.equal(p.length / 3, 16);
  // 水壁（流れ落ちる水）は 6 面のまま
  const wall = boxGeometry({ min: [0, 0, 0], max: [0.05, 2, 1], mat: 'waterWall', solid: false });
  assert.ok(verts(wall).n.some((v) => Math.abs(v[0]!) > 0.9), '水壁は横の面を持つ');
});

test('水たまりは不定形の輪郭（四角でない）・箱の足跡に収まる・同じ場所なら同じ形', async () => {
  const { boxGeometry } = await import('../client/render/BoxShapes.ts');
  for (const [cx, cz] of [[0, 0], [3.3, -1.7], [12.05, 8.4], [-5, 20]] as const) {
    const b: Box = { min: [cx - 0.6, 0.001, cz - 0.4], max: [cx + 0.6, 0.004, cz + 0.4], mat: 'puddle', solid: false };
    const g = boxGeometry(b);
    const { p, n } = verts(g);
    assert.ok(n.every((v) => v[1]! > 0.999), '上向き');
    assert.ok(p.every((v) => Math.abs(v[1]! - 0.004) < 1e-9), '箱の上面の高さ');
    assert.ok(p.every((v) => v[0]! >= b.min[0] - 1e-6 && v[0]! <= b.max[0] + 1e-6 && v[2]! >= b.min[2] - 1e-6 && v[2]! <= b.max[2] + 1e-6), '箱の足跡に収まる');
    const a = areaXZ(g), box = 1.2 * 0.8;
    assert.ok(a < box * 0.8 && a > box * 0.3, `四角ではない広さ ${(a / box).toFixed(2)}`);
    // 楕円からの揺らぎ（中心からの距離 / 楕円の半径）がそろっていない = 不定形
    const r = p.filter((v) => Math.hypot(v[0]! - cx, v[2]! - cz) > 1e-6).map((v) => Math.hypot((v[0]! - cx) / 0.6, (v[2]! - cz) / 0.4));
    const mean = r.reduce((s, x) => s + x, 0) / r.length;
    const sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length);
    assert.ok(sd > 0.03, `輪郭が揺らぐ ${sd.toFixed(3)}`);
    assert.deepEqual(verts(boxGeometry(b)).p, p, '同じ場所なら同じ形');
  }
});

test('傾けた箱: 軸の min で 0、max で rise だけ上下にずれる・法線は傾いた面に直交・外接の箱', async () => {
  const { boxGeometry, slopeBounds } = await import('../client/render/BoxShapes.ts');
  for (const [axis, rise] of [['x', 1.8], ['z', 1.8], ['x', -1.2], ['z', -0.6]] as const) {
    const b: Box = axis === 'x'
      ? { min: [0, 1.0, 0.07], max: [3, 1.06, 0.12], mat: 'handrailWood', solid: false, slope: { axis, rise } }
      : { min: [0.07, 1.0, 0], max: [0.12, 1.06, 3], mat: 'handrailWood', solid: false, slope: { axis, rise } };
    const ai = axis === 'x' ? 0 : 2;
    const k = rise / 3;
    const { p, n } = verts(boxGeometry(b));
    for (const v of p) {
      const base = v[1]! - k * (v[ai]! - b.min[ai]);
      assert.ok(base >= b.min[1] - 1e-6 && base <= b.max[1] + 1e-6, `${axis} ${rise}: 傾きを戻すと元の箱の高さ ${base}`);
    }
    // 上面（法線が上向き）の法線は (-k, 1) の向き
    const want = [axis === 'x' ? -k : 0, 1, axis === 'z' ? -k : 0];
    const len = Math.hypot(...want);
    const tops = n.filter((v) => v[1]! > 0.5 && Math.abs(v[ai === 0 ? 2 : 0]!) < 1e-3 && Math.abs(v[1]! - 1 / len) < 1e-3);
    assert.ok(tops.length >= 4, `${axis} ${rise}: 上面の法線が傾いた面に直交`);
    for (const v of tops) assert.ok(Math.abs(v[ai]! - want[ai]! / len) < 1e-3);
    const sb = slopeBounds(b);
    assert.ok(Math.abs(sb.min[1] - (1.0 + Math.min(0, rise))) < 1e-9 && Math.abs(sb.max[1] - (1.06 + Math.max(0, rise))) < 1e-9, '外接の箱');
    const ys = p.map((v) => v[1]!);
    assert.ok(Math.min(...ys) >= sb.min[1] - 1e-6 && Math.max(...ys) <= sb.max[1] + 1e-6, '頂点は外接の箱の中');
  }
});

/** 階段の区画（1 本の段: 低い端 z0、蹴上げ 0.15 × 6、踏面 0.28） */
function stairCell(): CellLayout {
  const ops = [opening('a0', [1.1, 0, 0], 2 as Dir, 1.6, 2.4), opening('a1', [1.1, 0.9, 4.0], 0 as Dir, 1.6, 2.4)];
  const cell = makeCell({ id: 'stair', role: 'connector', rects: [{ x0: 0, z0: 0, x1: 2.2, z1: 4.0 }], height: 3.7, floorY: 0, palette: themePalette('CorridorHotel'), openings: ops, theme: 'CorridorHotel', lights: 'none' });
  for (let i = 0; i < 6; i++) { const b = box([WALL_T, 0, 0.8 + i * 0.28], [2.2 - WALL_T, (i + 1) * 0.15, 0.8 + (i + 1) * 0.28], 'floorTile'); b.kind = 'stairStep'; cell.boxes.push(b); }
  const l = box([WALL_T, 0, 0.8 + 6 * 0.28], [2.2 - WALL_T, 0.9, 4.0], 'floorTile');
  l.kind = 'landing';
  cell.boxes.push(l);
  cell.boxes.push(box([0.9, 3.5, 2], [1.3, 3.54, 2.6], 'lightPanel', false));
  dressCell({ cell, kind: 'stairs', openings: ops, keepOut: [], rng: new Rng(4), density: 0.5 });
  return cell;
}

test('FloorBuilder: 水面は上面だけで原点は水槽の底（水深 = メッシュの y）・傾けた手すりは段に沿う・焼き込みは有限', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const floorY = 1.8;
  const ops = [opening('a', [0, floorY, 6], 3 as Dir), opening('b', [16, floorY, 6], 1 as Dir, 2.2, 2.6)];
  const pool = makeCell({ id: 'pool', role: 'hub', rects: [{ x0: 0, z0: 0, x1: 16, z1: 12 }], height: 4.5, floorY, palette: themePalette('PoolCorridor'), openings: ops, theme: 'PoolCorridor' });
  dressCell({ cell: pool, kind: 'hall', openings: ops, keepOut: [], rng: new Rng(3), density: 0.5 });
  const waters = pool.boxes.filter((b) => b.mat === 'waterShallow');
  assert.ok(waters.length >= 1, '水槽ができる');
  const stair = stairCell();
  const floor: FloorLayout = {
    id: 'shapes', seed: 5, genVersion: 'test', tuningVersion: 'test', bounds: { min: [-1, -3, -1], max: [20, 8, 20] },
    cells: [pool, stair], portals: [], entities: [], surfaces: [], spawn: { pos: [1, floorY, 6], yaw: 0, cell: 'pool' }, exits: [],
  };
  const lib = new MaterialLibrary();
  const built = new FloorBuilder(lib).build(floor);
  const meshes = (id: string): THREE.Mesh[] => built.cells.get(id)!.group.children as THREE.Mesh[];
  // 水面
  const wm = meshes('pool').filter((m) => m.name.includes('waterShallow'));
  assert.equal(wm.length, 1, '同じ底の高さの水面は 1 つのメッシュ');
  const m = wm[0]!;
  assert.ok(Math.abs(m.position.y - (waters[0]!.min[1] - floorY)) < 1e-9, 'メッシュの原点は水槽の底（区画の Group から）');
  const { p, n } = verts(m.geometry);
  assert.ok(n.every((v) => Math.abs(v[1]! - 1) < 1e-6), '水面は上面だけ');
  const depth = BASIN.depth - BASIN.level;
  assert.ok(p.every((v) => Math.abs(v[1]! - depth) < 1e-6), `メッシュの y = 水深 ${depth}`);
  assert.ok(Math.abs(built.cells.get('pool')!.group.position.y + m.position.y + depth - waters[0]!.max[1]) < 1e-9, '描く高さ = 水面');
  // 区画の外形は水槽の底を含む
  assert.ok(pool.bounds.min[1] <= floorY - BASIN.depth - BASIN.slab, '外形の下端');
  // 傾けた手すり: 頂点の高さは、段鼻の線（z = 0.8 で 0.15、勾配 0.15 / 0.28）+ RAIL_HEIGHT の少し下まで
  const rail = meshes('stair').filter((x) => x.name.includes('handrailWood'));
  assert.ok(rail.length >= 1);
  const rp = rail.flatMap((x) => verts(x.geometry).p);
  const nosing = (z: number): number => 0.15 + (0.15 / 0.28) * (z - 0.8);
  const onSlope = rp.filter((v) => v[2]! > 1.0 && v[2]! < 2.0);
  assert.ok(onSlope.length > 0);
  for (const v of onSlope) {
    const h = v[1]! - nosing(v[2]!);
    assert.ok(h <= RAIL_HEIGHT + 1e-3 && h >= RAIL_HEIGHT - 0.07, `段鼻の線からの高さ ${h.toFixed(3)}（z ${v[2]!.toFixed(2)}）`);
  }
  // 焼き込みは全部有限・水面と手すりにも付く
  for (const c of built.cells.values()) {
    for (const x of c.group.children as THREE.Mesh[]) {
      const baked = x.geometry.getAttribute('bakedLight');
      assert.ok(baked, `${x.name}: bakedLight`);
      assert.ok((baked.array as Float32Array).every(Number.isFinite), `${x.name}: 焼き込みが有限`);
    }
  }
  built.dispose();
  lib.dispose();
});
