/**
 * 果てしない階の、上下の階へ移る所の描画（docs/endless-world.md 14 章）: liftCar（エレベーターの音）・signPlate（案内板）・
 * dropLift（着く部屋の縦穴の床板）。
 */
import * as THREE from 'three';
import { rotQ, type Dir } from '../../core/math/vec.ts';
import type { MatId } from '../../core/world/layout.ts';
import { defineView } from './views.ts';
import { aabbOf, boxGeo, disposeMesh, drone, lightAt, noise, onCue, setBaked, textPlate, tone, type Drone } from './ground/util.ts';

defineView('liftCar', (spec, ctx) => {
  let hum: Drone | null = null;
  let left = 0;
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'lift.arrive') { tone(ctx.audio, 988, { pos: at, gain: 0.08, dur: 0.6 }); tone(ctx.audio, 784, { pos: at, gain: 0.08, dur: 0.9, delay: 0.35 }); }
    else if (name === 'lift.close') noise(ctx.audio, { pos: at, gain: 0.06, dur: 1.1, lowpass: 900, attack: 0.3 });
    else if (name === 'lift.ride') {
      // 動く音: 着くまで（階を移った後も、前の階の描画が鳴らし切る）
      hum?.stop();
      hum = drone(ctx.audio, { pos: at, freq: 58, type: 'sawtooth', lfoHz: 0.7, lfoDepth: 5, gain: 0.07 });
      left = Number(data.sec ?? 5);
    }
  });
  const timer = setInterval(() => { if (!hum) return; left -= 0.25; if (left <= 0) { hum.stop(); hum = null; } }, 250);
  return {
    update() {},
    dispose() { off(); clearInterval(timer); hum?.stop(); hum = null; },
  };
});

defineView('signPlate', (spec, ctx) => {
  const p = spec.params.pos as number[] | undefined;
  if (!p) return null;
  const n = rotQ([0, 0, 1], (Number(spec.params.dir ?? 0) | 0) as Dir);
  const w = Number(spec.params.w ?? 1.2), h = Number(spec.params.h ?? 0.3);
  const m = textPlate(String(spec.params.text ?? ''), w, h, { fg: String(spec.params.fg ?? '#eafff0'), bg: String(spec.params.bg ?? '#0f7a3c'), px: 64 });
  m.position.set(p[0]!, p[1]!, p[2]!);
  m.rotation.set(0, Math.atan2(n[0], n[2]), 0);
  ctx.root.add(m);
  return {
    update() {},
    dispose() { disposeMesh(m); },
  };
});

defineView('dropLift', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const mat = (spec.params.mat as MatId | undefined) ?? 'metal';
  const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const g = boxGeo(size, mat);
  const c: [number, number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  setBaked(g, lightAt(ctx, [c[0], Number(spec.params.floorY ?? c[1]) + 1, c[2]]));
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  mesh.position.set(...c);
  ctx.root.add(mesh);
  return {
    update(s) { const y = typeof s.y === 'number' ? s.y : b.max[1]; mesh.position.y = y - size[1] / 2; },
    dispose() { mesh.removeFromParent(); g.dispose(); },
  };
});
