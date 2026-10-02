// 面取り箱（v1 tests/chamfer-box.mjs から移植）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bevelRadius, chamferBoxGeometry, setBevelQuality } from '../client/render/ChamferBox.ts';
import { writeSurfaceCoordinates } from '../client/render/SurfaceAppearance.ts';

test('長い巾木: 輪郭は元の箱の内側・面の group は 6 つのまま・長辺は 1.25 m 以下で分割', () => {
  const g = chamferBoxGeometry(10, 0.08, 0.015, 0.004);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  assert.ok(Math.abs(bb.max.x - 5) < 1e-6 && Math.abs(bb.min.y + 0.04) < 1e-6 && Math.abs(bb.max.z - 0.0075) < 1e-6, '輪郭が当たり判定の箱の内側');
  assert.equal(g.type, 'BoxGeometry');
  assert.deepEqual(g.groups.map((x) => x.materialIndex), [0, 1, 2, 3, 4, 5]);
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const xs = new Set<string>();
  for (let i = 0; i < pos.count; i++) {
    const n = Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    assert.ok(Math.abs(n - 1) < 1e-5, '法線は単位長');
    if (Math.abs(pos.getY(i) - 0.04) < 1e-6 && Math.abs(pos.getZ(i)) < 0.003) xs.add(pos.getX(i).toFixed(3));
  }
  const sorted = [...xs].map(Number).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] <= 1.25 + 1e-6, '長い面を分割している');
  // 辺の頂点は 45° の法線（ハイライトを拾う）
  let diagonal = 0;
  for (let i = 0; i < pos.count; i++) if (Math.abs(Math.abs(nrm.getY(i)) - Math.SQRT1_2) < 1e-3 && Math.abs(Math.abs(nrm.getZ(i)) - Math.SQRT1_2) < 1e-3) diagonal++;
  assert.ok(diagonal > 0, '辺の法線が斜め');

  // 面ごとの UV はそのまま書ける
  writeSurfaceCoordinates(g, 1.1, 'trim');
  assert.ok(g.getAttribute('uv'));
  // uv1（writeLightmapUV）は group の範囲と箱の寸法だけを使う: 全頂点が箱の内側にあれば面矩形の外へ出ない
  for (let i = 0; i < pos.count; i++) assert.ok(Math.abs(pos.getX(i)) <= 5 + 1e-9 && Math.abs(pos.getY(i)) <= 0.04 + 1e-9 && Math.abs(pos.getZ(i)) <= 0.0075 + 1e-9);
});

test('品質ごとの足切り: 脚（3 cm 角）は high だけ、low は従来どおり最小辺 8 cm 超のみ、外殻の壁は面取りしない', () => {
  try {
    const leg = [0.03, 0.7, 0.03];
    setBevelQuality('high'); assert.ok(bevelRadius('furnitureDark', leg) > 0);
    setBevelQuality('mid'); assert.equal(bevelRadius('furnitureDark', leg), 0);
    assert.ok(bevelRadius('furnitureDark', [1.2, 0.75, 0.6]) > 0);
    setBevelQuality('low'); assert.equal(bevelRadius('trim', [3, 0.08, 0.015]), 0);
    assert.ok(bevelRadius('doorWood', [0.9, 2.1, 0.09]) > 0);
    assert.equal(bevelRadius('wallWhite', [4, 3, 0.15]), 0, '外殻の壁は面取りしない');
  } finally {
    setBevelQuality('high');
  }
});
