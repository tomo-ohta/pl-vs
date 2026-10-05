/**
 * 床と足場・装置（ground）の部品の描画: 実験室の部屋を FloorBuilder で組み、部品ごとの描画（defineView）を作って、
 * シミュレーションを進めながら update を呼んで壊れないこと（Node。音・画面効果は無し）。描画の無い部品の種類が無いこと（見た目の要る物）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GROUND_CATALOG } from '../core/gen/catalog/ground.ts';
import { disposeSim, idle, labRooms, newSim } from './ground-lab.ts';

test('ground の部品の描画: 作れて、動かしても壊れない', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { createView } = await import('../client/views/index.ts');
  const lib = new MaterialLibrary();
  const gimmicks = [...new Set(GROUND_CATALOG.flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick').map((m) => m.id)))];
  const viewed = new Set<string>();
  let rooms = 0;
  for (const def of gimmicks) {
    const list = [...labRooms(def, { exit: 'opposite', sizes: [{ w: 7.2, d: 8.4, height: 4.0 }], seeds: [1] }), ...labRooms(def, { sizes: [{ w: 7.2, d: 8.4, height: 4.0 }], seeds: [1] })].slice(0, 2);
    for (const room of list) {
      rooms++;
      const sim = await newSim(room.floor);
      const built = new FloorBuilder(lib).build(room.floor);
      const scene = new THREE.Scene();
      const views = room.floor.entities.map((e) => {
        const v = createView(e, { root: new THREE.Group(), materials: lib, built, sim, levelOf: () => 1, scene });
        if (v) viewed.add(e.type);
        return { e, v };
      });
      sim.teleport(0, room.inside, 0);
      for (let k = 0; k < 6; k++) {
        idle(sim, 0.25, { moveY: k % 2 ? 1 : 0 });
        for (const { e, v } of views) v?.update(sim.stateOf(e.id) ?? {}, 0.25);
      }
      for (const { v } of views) v?.dispose();
      built.dispose();
      disposeSim(sim);
    }
  }
  assert.ok(rooms >= 10, `部屋: ${rooms}`);
  // ground の部品のうち、見た目の要る物には描画がある
  const NEED = ['collapseFloor', 'domino', 'crate', 'stillLift', 'hatch', 'chimeFloor', 'avoidFloor', 'visitOrder', 'stepTrail', 'footMarks', 'mirrorRoom', 'ceilingPress', 'turntable', 'slideTiles', 'pushButton', 'liftCabin', 'vending', 'ticketGates', 'autoDoor', 'shutter', 'alarm', 'securityDoor', 'breaker', 'dialLock', 'callBell'];
  for (const n of NEED) assert.ok(viewed.has(n), `${n} の描画`);
  lib.dispose();
});
