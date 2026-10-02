/**
 * 溝を渡る手段の描画: ドミノの棚（dominoChain。倒れる棚は手前の下の縁を軸に回る）・押す箱（crate）・音。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, lightAt, noise, onCue, setBaked, tone } from './util.ts';

defineView('domino', (spec, ctx) => {
  const st = aabbOf(spec.params.stand);
  const mat = (spec.params.mat as MatId | undefined) ?? 'bookshelfWood';
  const size: [number, number, number] = [st.max[0] - st.min[0], st.max[1] - st.min[1], st.max[2] - st.min[2]];
  const g = boxGeo(size, mat);
  const c: [number, number, number] = [(st.min[0] + st.max[0]) / 2, (st.min[1] + st.max[1]) / 2, (st.min[2] + st.max[2]) / 2];
  setBaked(g, lightAt(ctx, c));
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  // 倒れる向き（立った箱の真ん中から寝た箱の真ん中へ）ごとの、回る軸（手前の下の縁）
  const pivotOf = (lie: unknown): { pivot: THREE.Vector3; axis: THREE.Vector3 } => {
    const l = aabbOf(lie as never);
    const fx = (l.min[0] + l.max[0]) / 2 - c[0], fz = (l.min[2] + l.max[2]) / 2 - c[2];
    const dx = Math.abs(fx) > Math.abs(fz) ? Math.sign(fx) : 0, dz = dx ? 0 : Math.sign(fz);
    const pivot = new THREE.Vector3(dx > 0 ? st.max[0] : dx < 0 ? st.min[0] : c[0], st.min[1], dz > 0 ? st.max[2] : dz < 0 ? st.min[2] : c[2]);
    return { pivot, axis: new THREE.Vector3(dz, 0, -dx) };
  };
  const fwd = pivotOf(spec.params.lieP), bwd = spec.params.lieN ? pivotOf(spec.params.lieN) : fwd;
  const fixed = typeof spec.params.fixed === 'number';
  const group = new THREE.Group();
  group.add(mesh);
  ctx.root.add(group);
  const q = new THREE.Quaternion();
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'domino.push') noise(ctx.audio, { pos: at, gain: 0.12, dur: 0.25, lowpass: 1200 });
    else if (name === 'domino.land') { noise(ctx.audio, { pos: at, gain: data.bridge ? 0.5 : 0.3, dur: data.bridge ? 0.9 : 0.5, lowpass: 420 }); tone(ctx.audio, data.bridge ? 70 : 95, { pos: at, gain: 0.16, dur: 0.35, freqTo: 45 }); }
  });
  return {
    update(s) {
      const a = Math.min(1, Number(s.ang ?? 0));
      const pv = fixed || Number(s.dir ?? 0) >= 0 ? fwd : bwd;
      q.setFromAxisAngle(pv.axis, (a * Math.PI) / 2);
      group.position.copy(pv.pivot);
      group.quaternion.copy(q);
      mesh.position.set(c[0] - pv.pivot.x, c[1] - pv.pivot.y, c[2] - pv.pivot.z);
    },
    dispose() { off(); group.removeFromParent(); g.dispose(); },
  };
});

defineView('crate', (spec, ctx) => {
  const half = typeof spec.params.half === 'number' ? spec.params.half : 0.45;
  const h = typeof spec.params.h === 'number' ? spec.params.h : 0.9;
  const mat = (spec.params.mat as MatId | undefined) ?? 'boxCardboard';
  const g = boxGeo([half * 2, h, half * 2], mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  ctx.root.add(mesh);
  const grid = spec.params.grid as { x0: number; z0: number; c: number };
  const y = typeof spec.params.y === 'number' ? spec.params.y : 0;
  let relight = 0;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'crate.push') noise(ctx.audio, { pos: at, gain: 0.16, dur: 0.4, lowpass: 700 });
    else if (name === 'crate.drop') { noise(ctx.audio, { pos: at, gain: 0.4, dur: 0.6, lowpass: 300 }); tone(ctx.audio, 60, { pos: at, gain: 0.2, dur: 0.3 }); }
    else if (name === 'crate.blocked') tone(ctx.audio, 150, { pos: at, gain: 0.05, dur: 0.12, type: 'square' });
    else if (name === 'crate.reset') tone(ctx.audio, 520, { pos: at, gain: 0.06, dur: 0.4 });
  });
  return {
    update(s, dt) {
      const k = Math.min(1, Number(s.t ?? 1));
      const ax = grid.x0 + (Number(s.fi) + 0.5) * grid.c, az = grid.z0 + (Number(s.fk) + 0.5) * grid.c;
      const bx = grid.x0 + (Number(s.i) + 0.5) * grid.c, bz = grid.z0 + (Number(s.k) + 0.5) * grid.c;
      const top = s.dropped ? y - 0.04 : y + h + Number(s.dy ?? 0);
      mesh.position.set(ax + (bx - ax) * k, top - h / 2, az + (bz - az) * k);
      relight -= dt;
      if (relight <= 0) { relight = 0.3; setBaked(g, lightAt(ctx, [mesh.position.x, y + 0.6, mesh.position.z])); }
    },
    dispose() { off(); mesh.removeFromParent(); g.dispose(); },
  };
});
