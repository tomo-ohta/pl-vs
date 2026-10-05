// 生成テクスチャの微細構造（v1 tests/surface-detail.mjs から移植）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSurfaceMaps, type DetailKind } from '../client/render/SurfaceDetail.ts';

const KINDS: DetailKind[] = ['wallpaper', 'carpet', 'ceiling', 'wood', 'concrete', 'tile', 'metal', 'linoleum', 'cardboard', 'foliage', 'diffuser', 'water', 'sky', 'paint', 'rubber', 'glass'];

test('16 種: 決定論・線形色空間・AO は UV0・法線 +Y は高さの勾配と逆向き（繰り返しの境目も）・AO / 粗さは範囲内', () => {
  for (const kind of KINDS) {
    const maps = createSurfaceMaps(kind);
    const again = createSurfaceMaps(kind);
    for (const key of ['detail', 'normal', 'ao'] as const) {
      const t = maps[key];
      assert.equal(t.colorSpace, THREE.NoColorSpace);
      assert.equal(t.channel, 0);
      assert.deepEqual(t.image.data, again[key].image.data);
      assert.equal(t.wrapS, THREE.RepeatWrapping);
    }
    const d = maps.detail.image.data as Uint8Array;
    const n = maps.normal.image.data as Uint8Array;
    const ao = maps.ao.image.data as Uint8Array;
    for (let y = 0; y < 256; y += 7) for (let x = 0; x < 256; x += 7) {
      const i = (y * 256 + x) * 4;
      const delta = d[(((y + 1) % 256) * 256 + x) * 4] - d[(((y + 255) % 256) * 256 + x) * 4];
      if (Math.abs(delta) > 2) assert.equal(Math.sign(127.5 - n[i + 1]), Math.sign(delta), `${kind}: 法線 +Y は高さの正の勾配と逆向き`);
      assert.ok(n[i + 2] >= 128);
      assert.ok(ao[i] >= 219);
      assert.ok(d[i + 1] >= 190);
    }
    for (const t of [...Object.values(maps), ...Object.values(again)]) t.dispose();
  }
});
