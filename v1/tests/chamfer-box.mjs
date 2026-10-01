import assert from 'node:assert/strict';
import { chamferBoxGeometry } from '../src/render/ChamferBox.ts';
import { writeSurfaceCoordinates } from '../src/render/SurfaceAppearance.ts';
import { bevelRadius, setBevelQuality } from '../src/render/ChamferBox.ts';

// 長い巾木: 輪郭は元の箱の内側、面の group は 6 つのまま、長辺方向は 1.25 m 以下で分割（頂点焼き込みが粗くならない）
const g = chamferBoxGeometry(10, .08, .015, .004);
g.computeBoundingBox();
const bb = g.boundingBox;
assert(Math.abs(bb.max.x - 5) < 1e-6 && Math.abs(bb.min.y + .04) < 1e-6 && Math.abs(bb.max.z - .0075) < 1e-6, 'silhouette stays inside the collision box');
assert.equal(g.type, 'BoxGeometry');
assert.deepEqual(g.groups.map((x) => x.materialIndex), [0, 1, 2, 3, 4, 5]);
const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
const xs = new Set();
for (let i = 0; i < pos.count; i++) {
  const n = Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
  assert(Math.abs(n - 1) < 1e-5, 'unit normals');
  if (Math.abs(pos.getY(i) - .04) < 1e-6 && Math.abs(pos.getZ(i)) < .003) xs.add(pos.getX(i).toFixed(3));
}
const sorted = [...xs].map(Number).sort((a, b) => a - b);
for (let i = 1; i < sorted.length; i++) assert(sorted[i] - sorted[i - 1] <= 1.25 + 1e-6, 'long face subdivided');
// 辺の頂点は 45° の法線（ハイライトを拾う）
let diagonal = 0;
for (let i = 0; i < pos.count; i++) if (Math.abs(Math.abs(nrm.getY(i)) - Math.SQRT1_2) < 1e-3 && Math.abs(Math.abs(nrm.getZ(i)) - Math.SQRT1_2) < 1e-3) diagonal++;
assert(diagonal > 0, 'edge normals are diagonal');

// 面ごとの UV はそのまま書ける
writeSurfaceCoordinates(g, 1.1, 'trim');
assert(g.getAttribute('uv'));
// uv1（writeLightmapUV）は group の範囲と箱の寸法だけを使う: 全頂点が箱の内側にあれば面矩形の外へ出ない
for (let i = 0; i < pos.count; i++) assert(Math.abs(pos.getX(i)) <= 5 + 1e-9 && Math.abs(pos.getY(i)) <= .04 + 1e-9 && Math.abs(pos.getZ(i)) <= .0075 + 1e-9);

// 品質ごとの足切り: 脚（3 cm 角）は high だけ、low は従来どおり最小辺 8 cm 超のみ
const leg = [.03, .7, .03];
setBevelQuality('high'); assert(bevelRadius('furnitureDark', leg) > 0);
setBevelQuality('mid'); assert.equal(bevelRadius('furnitureDark', leg), 0);
assert(bevelRadius('furnitureDark', [1.2, .75, .6]) > 0);
setBevelQuality('low'); assert.equal(bevelRadius('trim', [3, .08, .015]), 0);
assert(bevelRadius('doorWood', [.9, 2.1, .09]) > 0);
assert.equal(bevelRadius('wallWhite', [4, 3, .15]), 0, 'shell walls are never bevelled');
console.log('chamfer-box ok');
