/**
 * 移動と身体の描画: 身体の大きさを変える門（sizeGate）。門の中にゆらめく膜、くぐると音（小さくなると高く・大きくなると低く）
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { lightAt, nearCamera, setBaked, withBaked } from './util.ts';

defineView('sizeGate', (spec, ctx) => {
  const gates = (spec.params.gates as unknown as { min: number[]; max: number[]; scale: number }[] | undefined) ?? [];
  const meshes: THREE.Mesh[] = [];
  const geos: THREE.BufferGeometry[] = [];
  for (const g of gates) {
    if (Math.abs(g.scale - 1) < 1e-6) continue;
    const w = Math.max(g.max[0]! - g.min[0]!, g.max[2]! - g.min[2]!);
    const h = Math.min(2.15, g.max[1]! - Math.max(0, g.min[1]!));
    const geo = withBaked(new THREE.PlaneGeometry(w, h));
    geos.push(geo);
    const m = new THREE.Mesh(geo, ctx.materials.get('waterFilm'));
    m.position.set((g.min[0]! + g.max[0]!) / 2, g.min[1]! + 0.1 + h / 2, (g.min[2]! + g.max[2]!) / 2);
    if (g.max[0]! - g.min[0]! < g.max[2]! - g.min[2]!) m.rotation.y = Math.PI / 2;
    ctx.root.add(m);
    setBaked(geo, lightAt(ctx, [m.position.x, m.position.y, m.position.z]));
    meshes.push(m);
  }
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || !ctx.audio || !e.pos || !nearCamera(ctx, e.pos as [number, number, number])) return;
    const at = e.pos as [number, number, number];
    if (e.data?.name === 'size.shrink') ctx.audio.play('chime', { pos: at, gain: 0.35, pitch: 1.8 });
    else if (e.data?.name === 'size.grow') ctx.audio.play('chime', { pos: at, gain: 0.35, pitch: 0.55 });
    else if (e.data?.name === 'size.normal') ctx.audio.play('chime', { pos: at, gain: 0.2, pitch: 1.0 });
  });
  let t = 0;
  return {
    update(_s, dt) {
      t += dt;
      // 膜がゆらめく（薄く伸び縮み）
      meshes.forEach((m, i) => { const k = 1 + Math.sin(t * 2.3 + i) * 0.02; m.scale.set(k, 2 - k, 1); });
    },
    dispose() { off?.(); for (const m of meshes) m.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});
