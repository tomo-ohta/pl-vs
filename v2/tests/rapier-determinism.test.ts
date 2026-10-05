import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadRapier } from '../core/physics/rapier.ts';

/** 傾く床の上に箱を積んで転がす。同じ条件で 2 回回し、スナップショットのハッシュが一致することを確かめる */
async function run(bodies: number, steps: number): Promise<{ hash: string; ms: number }> {
  const R = await loadRapier();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const floor = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  world.createCollider(R.ColliderDesc.cuboid(5, 0.1, 5), floor);
  for (let i = 0; i < bodies; i++) {
    const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation((i % 10) * 0.5 - 2.25, 0.4 + Math.floor(i / 10) * 0.45, ((i * 7) % 10) * 0.5 - 2.25));
    world.createCollider(R.ColliderDesc.cuboid(0.2, 0.2, 0.2).setFriction(0.6), b);
  }
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) {
    const a = Math.min(0.25, s / 240); // 4 秒かけて約 14° まで傾ける
    floor.setNextKinematicRotation({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) });
    world.step();
  }
  const ms = performance.now() - t0;
  const hash = createHash('md5').update(world.takeSnapshot()).digest('hex');
  world.free();
  return { hash, ms };
}

test('Rapier（決定論版）は同じ条件で同じ結果になる', async () => {
  const a = await run(120, 300);
  const b = await run(120, 300);
  assert.equal(a.hash, b.hash);
  console.log(`  120 体 × 300 step: ${a.ms.toFixed(0)} ms（1 step ${(a.ms / 300).toFixed(2)} ms）`);
});
