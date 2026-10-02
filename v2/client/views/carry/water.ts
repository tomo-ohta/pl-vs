/**
 * 水を運ぶ（I01）の描画: 台の皿に溜まった水（carryLevel の level。台と一緒に沈む）。満杯になると水面が光る
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import { defineView } from '../views.ts';
import { lightAt, onCue, Parts } from './common.ts';

defineView('carryLevel', (spec, ctx) => {
  const b = spec.params.basin as { min: number[]; max: number[] } | undefined;
  if (!b) return null;
  const P = new Parts(ctx);
  const w = b.max[0]! - b.min[0]!, h = b.max[1]! - b.min[1]!, d = b.max[2]! - b.min[2]!;
  // 皿（縁）
  const rim = 0.03;
  P.box([w + 2 * rim, 0.02, d + 2 * rim], 'stainless', [0, -0.01, 0]);
  for (const [sx, sz, ww, dd] of [[0, -(d / 2 + rim / 2), w + 2 * rim, rim], [0, d / 2 + rim / 2, w + 2 * rim, rim], [-(w / 2 + rim / 2), 0, rim, d], [w / 2 + rim / 2, 0, rim, d]] as const) P.box([ww, h, dd], 'stainless', [sx, h / 2, sz]);
  const water = P.box([w, 1, d], 'aquariumBlue', [0, 0, 0]);
  const glow = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.85 });
  ctx.root.add(P.group);
  const base: [number, number, number] = [(b.min[0]! + b.max[0]!) / 2, b.min[1]!, (b.min[2]! + b.max[2]!) / 2];
  const follow = typeof spec.params.follow === 'string' ? spec.params.follow : null;
  let relight = 0;
  const off = onCue(ctx, spec.id, () => {});
  let wasFull = false;
  return {
    update(s: Readonly<PartState>, dt: number) {
      const off = follow ? (ctx.sim.stateOf(follow)?.pos as number[] | undefined) ?? [0, 0, 0] : [0, 0, 0];
      P.group.position.set(base[0] + off[0]!, base[1] + off[1]!, base[2] + off[2]!);
      const level = typeof s.level === 'number' ? s.level : 0;
      water.visible = level > 0.01;
      water.scale.y = Math.max(0.001, h * level);
      water.position.y = (h * level) / 2;
      const full = s.full === 1;
      if (full !== wasFull) { water.material = full ? glow : ctx.materials.get('aquariumBlue'); wasFull = full; if (full) ctx.audio?.play('chime', { pos: [base[0], base[1], base[2]], gain: 0.3 }); }
      relight -= dt;
      if (relight <= 0) { relight = 0.4; P.relight(lightAt(ctx, [P.group.position.x, P.group.position.y + 0.2, P.group.position.z])); }
    },
    dispose() { off(); P.dispose(); glow.dispose(); },
  };
});
