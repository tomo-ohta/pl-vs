/**
 * 物を運ぶ担当の描画（client/views/carry）: 仕掛けの実験室の部屋を描画の部品で組み、シミュレーションを進めながら毎フレームの更新を回して、
 * 捨てるまで例外が出ない（Node の three。GPU は使わない）。持つ（手の前に描く）・置く・投げるの所も通る
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultTuning } from '../core/config/tuning.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import type { SimEvent } from '../core/sim/types.ts';
import { rooms, CARRY_CASES } from './carry-cases.ts';
import { aimAt, center, cmd, SOLVERS } from './carry-solvers.ts';

const t = defaultTuning();

test('carry の描画: 全部の仕掛けの部品を描き、持つ・置く・投げるを通して、捨てるまで例外が出ない', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { createView } = await import('../client/views/index.ts');
  const lib = new MaterialLibrary();
  const R = await loadRapier();
  const drawn = new Set<string>();
  for (const c of CARRY_CASES) {
    const list = rooms(c.def, [c.exits[0]!], [1]).slice(0, 1);
    for (const { room } of list) {
      const physics = room.floor.entities.some((e) => partDef(e.type)?.physics) ? new PhysicsWorld(R, 1 / 60) : null;
      const sim = new Sim(room.floor, { tuning: t, physics });
      const built = new FloorBuilder(lib).build(room.floor);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      scene.add(camera, built.root);
      const listeners = new Set<(e: SimEvent) => void>();
      const views = room.floor.entities.map((e) => {
        const root = new THREE.Group();
        built.root.add(root);
        const v = createView(e, { root, materials: lib, built, sim, levelOf: () => 1, camera, scene, onEvent: (f) => { listeners.add(f); return () => listeners.delete(f); } });
        if (v) drawn.add(e.type);
        return { e, v };
      });
      const frame = (): void => {
        for (const ev of sim.drainEvents()) for (const f of listeners) f(ev);
        for (const { e, v } of views) { const st = sim.stateOf(e.id); if (v && st) v.update(st, 1 / 60); }
      };
      for (let i = 0; i < 30; i++) { sim.step([cmd()]); frame(); }
      // 持てる物を 1 つ拾って、置いて、投げる
      const item = room.floor.entities.find((e) => e.type === 'carryItem' || e.type === 'carryBody');
      if (item) {
        const c0 = center(sim, item.id);
        sim.teleport(0, [c0[0] + 0.8, room.cell.floorY + 0.02, c0[2]], 0);
        for (let i = 0; i < 5; i++) { sim.step([cmd()]); frame(); }
        const a = aimAt(sim, center(sim, item.id));
        sim.step([cmd({ ...a, interact: a })]);
        frame();
        for (let i = 0; i < 20; i++) { sim.step([cmd(a)]); frame(); }
        sim.step([cmd({ ...a, drop: true })]);
        for (let i = 0; i < 20; i++) { sim.step([cmd(a)]); frame(); }
        const b = aimAt(sim, center(sim, item.id));
        sim.step([cmd({ ...b, interact: b })]);
        sim.step([cmd({ ...b, pitch: 0.6, drop: true })]);
        for (let i = 0; i < 90; i++) { sim.step([cmd(b)]); frame(); }
      }
      // 決めた遊び方を、描画を毎 tick 更新しながら回す（解けた後の見た目も通る）
      const solver = SOLVERS[c.def]?.[0];
      if (solver) {
        const step = sim.step.bind(sim);
        (sim as unknown as { step: typeof sim.step }).step = (cs) => { step(cs); frame(); };
        await solver(sim, room);
        (sim as unknown as { step: typeof sim.step }).step = step;
      }
      for (const { v } of views) v?.dispose();
      built.dispose();
      physics?.dispose();
    }
  }
  console.log(`  描いた部品の種類: ${[...drawn].sort().join(', ')}`);
  assert.ok(drawn.has('carryItem'));
  lib.dispose();
});
