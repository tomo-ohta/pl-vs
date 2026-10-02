/**
 * 担当 sense の部品の描画（client/views/sense）: Node で、見本のフロア（担当の仕掛け・異変を全部）を組み、部品ごとに描画を作って
 * シミュレーションを進めながら何フレームか更新できる（例外が出ない・作った物を片付けられる）。WebGL は使わない
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import type { SimEvent } from '../core/sim/types.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { simOf, T } from './sense-util.ts';

test('担当 sense の描画: 見本のフロアの全部の部品で、描画を作って更新できる', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { createView } = await import('../client/views/index.ts');
  const ids = [...new Set((CATALOG_BY_WS.sense ?? []).flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick' || m.kind === 'anomaly').map((m) => m.id)))];
  // 一度に全部は入らないので、いくつかずつ見本のフロアに置く
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 8) chunks.push(ids.slice(i, i + 8));
  const seen = new Set<string>();
  for (const chunk of chunks.length ? chunks : [['beamFloor', 'spotRide', 'lightBands', 'lookBridge']]) {
    const r = showcaseFloor(T, { ids: chunk, dress: dressCell });
    const floor = r.floor;
    const sim = await simOf(floor);
    const materials = new MaterialLibrary();
    const built = new FloorBuilder(materials).build(floor);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 150);
    scene.add(camera, built.root);
    const listeners = new Set<(e: SimEvent) => void>();
    const views = [];
    for (const e of floor.entities) {
      const root = new THREE.Group();
      built.root.add(root);
      const v = createView(e, { root, materials, built, sim, levelOf: (id) => sim.outputOf(id, 'level'), camera, scene, onEvent: (f) => { listeners.add(f); return () => listeners.delete(f); } });
      if (v) { views.push({ v, id: e.id }); seen.add(e.type); }
    }
    for (let f = 0; f < 40; f++) {
      const p = sim.players[0]!;
      sim.step([{ ...IDLE_COMMAND, yaw: p.yaw + 0.05, moveY: f % 2, flashlight: true }]);
      for (const e of sim.drainEvents()) for (const l of listeners) l(e);
      for (const { v, id } of views) v.update(sim.stateOf(id)!, 1 / 60);
    }
    for (const { v } of views) v.dispose();
    built.dispose();
    sim.physics?.dispose();
  }
  assert.ok(seen.has('lightFloor'), [...seen].join(','));
});
