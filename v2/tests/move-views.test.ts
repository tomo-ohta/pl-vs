/**
 * 移動と身体の部品の描画（client/views/move）: 実験室の部屋の部品から描画を作り、シミュレーションを進めながら update しても
 * 例外が出ない・数値が有限・dispose できる（Node で three を使う。画面には出さない）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultTuning, makeTuning, type Tuning } from '../core/config/tuning.ts';
import type { Dir } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import { partDef } from '../core/sim/part.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { labRoom } from './helpers/gimmick-lab.ts';

/** 描画を確かめる部屋（仕掛け・大きさ・調整） */
export const VIEW_ROOMS: { def: string; w: number; d: number; height?: number; entry: Dir; exit: Dir; kind?: 'room' | 'hall'; t?: Record<string, number> }[] = [
  { def: 'windTunnel', w: 4.2, d: 9, entry: 2, exit: 0, t: { 'move.crowd.chance': 0 } },
  { def: 'windTunnel', w: 4.5, d: 9.5, entry: 2, exit: 0, t: { 'move.crowd.chance': 1 } },
  { def: 'footingRoom', w: 6, d: 7.5, entry: 2, exit: 0, t: { 'move.foot.w.ice': 0, 'move.foot.w.wax': 0, 'move.foot.w.mud': 1 } },
  { def: 'trapdoorFloor', w: 6.6, d: 8, entry: 2, exit: 0 },
  { def: 'ghostBridge', w: 6.6, d: 8, entry: 2, exit: 0 },
  { def: 'swayBridge', w: 6.6, d: 8, entry: 2, exit: 0 },
  { def: 'pendulumHall', w: 6.6, d: 8, height: 4.6, entry: 2, exit: 0 },
  { def: 'riseHall', w: 8.6, d: 12, height: 5.2, kind: 'hall', entry: 2, exit: 0, t: { 'move.rise.w.springs': 0, 'move.rise.w.updraft': 1, 'move.rise.w.ladder': 0 } },
  { def: 'escalator', w: 5.2, d: 8.2, entry: 2, exit: 0 },
  { def: 'slideRoom', w: 8.6, d: 15, kind: 'hall', entry: 2, exit: 0, t: { 'move.slide.waterChance': 1 } },
  { def: 'turntable', w: 7.5, d: 7.5, entry: 2, exit: 0 },
  { def: 'revolvingDoor', w: 6.4, d: 9, entry: 2, exit: 0 },
  { def: 'pushWall', w: 4.2, d: 8, entry: 2, exit: 0 },
  { def: 'slantRoom', w: 6.4, d: 9, entry: 2, exit: 0 },
  { def: 'atrium', w: 5.6, d: 9.5, height: 3, entry: 2, exit: 0, t: { 'move.atrium.w.rope': 1, 'move.atrium.w.zip': 0, 'move.atrium.w.cart': 0, 'move.atrium.w.gondola': 0 } },
  { def: 'atrium', w: 5.6, d: 9.5, height: 3, entry: 2, exit: 0, t: { 'move.atrium.w.rope': 0, 'move.atrium.w.zip': 1, 'move.atrium.w.cart': 0, 'move.atrium.w.gondola': 0 } },
  { def: 'atrium', w: 8.6, d: 15, height: 3, kind: 'hall', entry: 2, exit: 0, t: { 'move.atrium.w.rope': 0, 'move.atrium.w.zip': 0, 'move.atrium.w.cart': 1, 'move.atrium.w.gondola': 0 } },
  { def: 'atrium', w: 8.6, d: 15, height: 3, kind: 'hall', entry: 2, exit: 0, t: { 'move.atrium.w.rope': 0, 'move.atrium.w.zip': 0, 'move.atrium.w.cart': 0, 'move.atrium.w.gondola': 1 } },
  { def: 'ballPool', w: 6.4, d: 9, entry: 2, exit: 0 },
  { def: 'ballRide', w: 5, d: 9, entry: 2, exit: 0, t: { 'move.ball.bubbleChance': 0 } },
  { def: 'ballRide', w: 5, d: 9, entry: 2, exit: 0, t: { 'move.ball.bubbleChance': 1 } },
  { def: 'sizeRoom', w: 5, d: 9, entry: 2, exit: 0 },
];

test('移動と身体の描画: 部品の描画を作って動かしても壊れない', async () => {
  const { MaterialLibrary } = await import('../client/render/MaterialLibrary.ts');
  const { FloorBuilder } = await import('../client/world/FloorBuilder.ts');
  const { createView } = await import('../client/views/index.ts');
  const R = await loadRapier();
  const lib = new MaterialLibrary();
  const made = new Set<string>();
  for (const r of VIEW_ROOMS) {
    const t: Tuning = r.t ? makeTuning(r.t).tuning : defaultTuning();
    const room = labRoom(r.def, { w: r.w, d: r.d, height: r.height, entry: r.entry, exit: r.exit, kind: r.kind, seed: 3, t });
    assert.ok(room, `${r.def}: 組める`);
    const needsPhysics = room.floor.entities.some((e) => partDef(e.type)?.physics);
    const sim = new Sim(room.floor, { tuning: t, physics: needsPhysics ? new PhysicsWorld(R, 1 / 60) : null });
    const built = new FloorBuilder(lib).build(room.floor);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 150);
    const views = [];
    for (const e of room.floor.entities) {
      const root = new THREE.Group();
      built.root.add(root);
      const v = createView(e, { root, materials: lib, built, sim, levelOf: () => 1, camera, onEvent: () => () => {} });
      if (!v) continue;
      made.add(e.type);
      views.push({ v, id: e.id, root });
    }
    sim.teleport(0, room.inside, 0);
    for (let i = 0; i < 90; i++) {
      sim.step([{ ...IDLE_COMMAND, moveY: i > 30 ? 1 : 0 }]);
      for (const { v, id } of views) v.update(sim.stateOf(id)!, 1 / 60);
    }
    // 位置・回転が有限
    built.root.traverse((o) => {
      assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z) && Number.isFinite(o.quaternion.x + o.quaternion.w), `${r.def}: ${o.name || o.type} の位置が有限`);
    });
    for (const { v } of views) v.dispose();
    built.dispose();
    sim.physics?.dispose();
  }
  for (const type of ['flowZone', 'trapTile', 'swayBridge', 'pendulum', 'dustCover', 'sinkTrap', 'ramp', 'turntable', 'revolvingDoor', 'pushBlock', 'tiltDeck', 'pathRide', 'cableCar', 'ballPit', 'rollBall', 'sizeGate']) assert.ok(made.has(type), `${type} の描画がある`);
  lib.dispose();
});
