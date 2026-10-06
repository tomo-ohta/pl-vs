/**
 * 上下する床・床の蓋の描画: stillLift（床板。scissor なら下に交差した脚。動いている間は低い唸り）・hatch（滑って床の下へ消える蓋と、
 * 閉じている間だけ継ぎ目から漏れる光）。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, disposeMesh, drone, glowMaterial, lightAt, noise, onCue, setBaked, type Drone } from './util.ts';

defineView('stillLift', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const travel = typeof spec.params.travel === 'number' ? spec.params.travel : -2.5;
  const mat = (spec.params.mat as MatId | undefined) ?? 'metal';
  const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const g = boxGeo(size, mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  const c: [number, number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  ctx.root.add(mesh);
  // せり上がる床: 交差した 2 本の脚（伸びると立つ）
  const legs: THREE.Mesh[] = [];
  const legGeo = boxGeo([0.06, 1, 0.06], 'metalDark');
  if (spec.params.scissor) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(legGeo, ctx.materials.get('metalDark'));
    m.userData = { sx, sz };
    legs.push(m);
    ctx.root.add(m);
  }
  let hum: Drone | null = null;
  let relight = 0;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'lift.start') { hum?.stop(); hum = drone(ctx.audio, { pos: at, freq: 52, type: 'sawtooth', lfoHz: 3, lfoDepth: 4, gain: 0.05 }); }
    else if (name === 'lift.stop') { hum?.stop(); hum = null; noise(ctx.audio, { pos: at, gain: 0.12, dur: 0.25, lowpass: 400 }); }
  });
  return {
    update(s, dt) {
      const t = Number(s.t ?? 0);
      const y = c[1] + travel * t;
      mesh.position.set(c[0], y, c[2]);
      if (legs.length) {
        // 脚: 床板の下（元の床の高さ）から床板の下面まで、斜めに交差
        const top = y - size[1] / 2, bot = b.min[1];
        const h = Math.max(0.05, top - bot);
        const span = Math.min(size[0], size[2]) * 0.8;
        const ang = Math.atan2(span, h);
        const len = Math.hypot(span, h);
        for (const m of legs) {
          const { sx, sz } = m.userData as { sx: number; sz: number };
          m.position.set(c[0] + sx * size[0] * 0.3, (top + bot) / 2, c[2]);
          m.scale.set(1, len, 1);
          m.rotation.set(0, 0, sz * ang);
        }
      }
      relight -= dt;
      if (relight <= 0) { relight = 0.3; setBaked(g, lightAt(ctx, [c[0], y + 0.4, c[2]])); }
    },
    dispose() { off(); hum?.stop(); mesh.removeFromParent(); g.dispose(); for (const m of legs) m.removeFromParent(); legGeo.dispose(); },
  };
});

defineView('hatch', (spec, ctx) => {
  const a = aabbOf(spec.params.panel);
  const slide = (spec.params.slide as number[] | undefined) ?? [1, 0, 0];
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorTile';
  const size: [number, number, number] = [a.max[0] - a.min[0], a.max[1] - a.min[1], a.max[2] - a.min[2]];
  const g = boxGeo(size, mat);
  const c: [number, number, number] = [(a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2, (a.min[2] + a.max[2]) / 2];
  setBaked(g, lightAt(ctx, [c[0], c[1] + 0.5, c[2]]));
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  mesh.position.set(...c);
  ctx.root.add(mesh);
  // 継ぎ目の光（照明に依らない暖色。ゆっくり明滅）
  const glowMat = glowMaterial(0xffb066, 0.9);
  const glow = new THREE.Group();
  for (const gb of (spec.params.glow as unknown[] | undefined) ?? []) {
    const bb = aabbOf(gb as never);
    const m = new THREE.Mesh(new THREE.BoxGeometry(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]), glowMat);
    m.position.set((bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2);
    glow.add(m);
  }
  ctx.root.add(glow);
  let t = 0;
  const off = onCue(ctx, spec.id, (name, at) => { if (name === 'hatch.open') noise(ctx.audio, { pos: at, gain: 0.25, dur: 1.2, lowpass: 900, attack: 0.1 }); });
  return {
    update(s, dt) {
      t += dt;
      const k = Math.min(1, Number(s.k ?? 0));
      // 先に少し沈み、それから横へ滑って床の下へ
      const sink = Math.min(1, k * 3), across = Math.max(0, (k - 0.2) / 0.8);
      mesh.position.set(c[0] + slide[0]! * across, c[1] + slide[1]! * sink, c[2] + slide[2]! * across);
      glow.visible = k < 0.05;
      glowMat.opacity = 0.65 + 0.25 * Math.sin(t * 1.3);
    },
    dispose() { off(); mesh.removeFromParent(); g.dispose(); disposeMesh(glow); },
  };
});
