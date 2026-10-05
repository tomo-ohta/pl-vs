// 表面の見え方（v1 tests/surface-appearance.mjs から移植。v1 の扉に固有だった doorSurfaceId の確認は除いた）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  addSurfaceAppearance, appearanceSeed, attachSurfaceAppearance, corridorDustRegion, corridorWearRegion, usesSurfaceVariation, wetWallBoxes, writeSurfaceCoordinates,
} from '../client/render/SurfaceAppearance.ts';
import type { Box } from '../core/world/layout.ts';

test('面取りした扉の木目・まぐさの向き・チャンクの継ぎ目・配置の回転・形は変えない', () => {
  // 面取りした扉の側面は、丸い角でも縦の木目のまま
  const door = new RoundedBoxGeometry(1, 2.1, 0.12, 1, 0.018);
  const topology = Array.from(door.getAttribute('position').array);
  writeSurfaceCoordinates(door, 1.1, 'doorWood');
  for (const group of door.groups) {
    if (Math.floor((group.materialIndex ?? 0) / 2) === 1) continue;
    for (let i = group.start; i < group.start + group.count; i++) assert.ok(Math.abs(door.getAttribute('uv').getY(i) - door.getAttribute('position').getY(i) / 1.1) < 1e-6);
  }
  assert.deepEqual(Array.from(door.getAttribute('position').array), topology, 'UV の修正で輪郭（当たり判定の形）は変わらない');
  const saved = Array.from(door.getAttribute('uv').array);
  door.rotateY(Math.PI / 2);
  assert.deepEqual(Array.from(door.getAttribute('uv').array), saved, '配置の回転で木目も一緒に回る');

  // まぐさは横の木目（枠の縦材の木目ではない）
  const lintel = new THREE.BoxGeometry(1.2, 0.065, 0.18);
  writeSurfaceCoordinates(lintel, 1.1, 'trim');
  for (const group of lintel.groups) {
    if (Math.floor((group.materialIndex ?? 0) / 2) === 0) continue;
    for (let j = group.start; j < group.start + group.count; j++) {
      const i = lintel.index!.getX(j);
      assert.ok(Math.abs(lintel.getAttribute('uv').getY(i) - lintel.getAttribute('position').getX(i) / 1.1) < 1e-6);
    }
  }

  // 描画のチャンクはテクスチャの原点にならない: 隣り合う壁の辺で UV が一致する
  const edge = (x: number): number[][] => {
    const g = new THREE.BoxGeometry(4, 3, 0.15);
    g.translate(x, 1.5, 0);
    writeSurfaceCoordinates(g, 1, 'wallWhite');
    const p = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const result: number[][] = [];
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - 4) < 1e-6 && p.getZ(i) > 0) result.push([p.getY(i), uv.getX(i), uv.getY(i)]);
    g.dispose();
    return result.sort((a, b) => a[0] - b[0]);
  };
  assert.deepEqual(edge(2), edge(6));
  door.dispose();
  lintel.dispose();
});

test('色ムラを掛ける材質・シェーダの注入（既存のコードを消さない）', () => {
  assert.ok(usesSurfaceVariation('wallWhite'));
  assert.ok(usesSurfaceVariation('floorCarpetGrey'));
  for (const id of ['water', 'skyWhite', 'floorWood', 'floorTile', 'lightPanel', 'doorWood', 'untextured']) assert.ok(!usesSurfaceVariation(id), `${id} は対象外`);
  const shader = {
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n// existing gradient/fog code',
    uniforms: {},
  };
  addSurfaceAppearance(shader, true, { value: 1 }, { value: 1 });
  assert.ok(shader.fragmentShader.includes('// existing gradient/fog code'));
  assert.ok(shader.fragmentShader.includes('vRoomPos*0.22'));
  assert.ok(!shader.fragmentShader.includes('surfaceTime'));
});

test('見え方の seed は決定論・部屋 / 材質で変わる・擦れはチャンクをまたいで連続・頂点属性だけ足す', () => {
  const seed = appearanceSeed(42, 'room-a', 'wallWhite');
  const [ws, room, surface] = JSON.parse(JSON.stringify([42, 'room-a', 'wallWhite'])) as [number, string, string];
  assert.equal(seed, appearanceSeed(ws, room, surface));
  assert.notEqual(seed, appearanceSeed(43, 'room-a', 'wallWhite'));
  assert.notEqual(seed, appearanceSeed(42, 'room-b', 'wallWhite'));
  assert.notEqual(seed, appearanceSeed(42, 'room-a', 'floorCarpetGrey'));
  const rects = [{ x0: 0, x1: 3, z0: 0, z1: 12 }];
  assert.deepEqual(corridorWearRegion({ min: [0, -0.1, 0], max: [3, 0, 4] }, rects), corridorWearRegion({ min: [0, -0.1, 4], max: [3, 0, 8] }, rects));
  assert.deepEqual(corridorWearRegion({ min: [20, 0, 20], max: [21, 0, 21] }, rects), [0, 0, 0, 0]);
  const g = new THREE.BoxGeometry(1, 2, 0.1);
  const positions = Array.from(g.attributes.position.array);
  attachSurfaceAppearance(g, seed, [3, 0.38, -1, 1]);
  assert.deepEqual(Array.from(g.attributes.position.array), positions);
  assert.equal(g.attributes.surfaceSeed.count, g.attributes.position.count);
  assert.equal(g.attributes.surfaceWear.getX(0), 3);
  assert.equal(g.attributes.surfaceSeed.getX(0), seed);
  g.dispose();
});

test('壁際の埃: チャンクで同じ範囲・交差部は除く・濡れの高さを属性に持つ', () => {
  const rects = [{ x0: 0, x1: 3, z0: 0, z1: 12 }];
  const dust = corridorDustRegion({ min: [0, -0.1, 0], max: [3, 0, 4] }, rects);
  assert.deepEqual(dust, [1, 1.5, 1.35, 0]);
  assert.deepEqual(dust, corridorDustRegion({ min: [0, -0.1, 4], max: [3, 0, 8] }, rects));
  assert.deepEqual(corridorDustRegion({ min: [0, 0, 0], max: [3, 0, 4] }, [...rects, { x0: 3, x1: 6, z0: 0, z1: 3 }]), [0, 0, 0, 0]);
  const envGeo = new THREE.BoxGeometry(1, 1, 1);
  attachSurfaceAppearance(envGeo, 123, [0, 0, 0, 0], [2, 0.25, 0, 0]);
  assert.equal(envGeo.attributes.surfaceEnvironment.getY(0), 0.25);
  assert.equal(envGeo.attributes.surfaceEnvironment.count, envGeo.attributes.position.count);
  envGeo.dispose();
});

test('濡れた壁: 実際の水の範囲で描画用の壁だけを分ける（当たり判定の元は変えない）', () => {
  const originalWall: Box = { min: [0, 0, 0], max: [10, 3, 0.15], mat: 'floorTile', solid: true };
  const originalJSON = JSON.stringify(originalWall);
  const waterPieces = [{ min: [2, 0.23, 0], max: [4, 0.25, 5] }, { min: [6, 0.23, 0], max: [8, 0.25, 5] }];
  const walls = wetWallBoxes([originalWall], waterPieces, 'floorTile');
  assert.equal(JSON.stringify(originalWall), originalJSON, '描画の分割で当たり判定の元を書き換えない');
  assert.deepEqual(walls.map((b) => [b.min[0], b.max[0], b.environment?.[1] ?? null]), [[0, 2, null], [2, 4, 0.25], [4, 6, null], [6, 8, 0.25], [8, 10, null]]);
  assert.equal(walls.reduce((sum, b) => sum + b.max[0] - b.min[0], 0), 10);
  assert.deepEqual(wetWallBoxes([originalWall], [], 'floorTile'), [originalWall]);
  assert.deepEqual(wetWallBoxes([originalWall], [{ min: [0, 0.23, 10], max: [10, 0.25, 12] }], 'floorTile'), [originalWall]);
  const crossWall: Box = { min: [0, 0, 0], max: [0.15, 3, 10], mat: 'floorTile', solid: true };
  assert.deepEqual(wetWallBoxes([crossWall], [{ min: [0, 0.23, 2], max: [5, 0.25, 4] }], 'floorTile').map((b) => [b.min[2], b.max[2], !!b.environment]), [[0, 2, false], [2, 4, true], [4, 10, false]]);
});
