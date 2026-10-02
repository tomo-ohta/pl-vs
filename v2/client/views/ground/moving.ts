/**
 * 動く床の描画: turntable（軸のまわりを回る橋と軸の円盤・縁の黄色い線・回る間の唸り）・slideTiles（滑る床板・擦れる音）。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { boxGeo, drone, lightAt, noise, onCue, setBaked, tone, withBaked, type Drone } from './util.ts';

defineView('turntable', (spec, ctx) => {
  const c = (spec.params.center as number[] | undefined) ?? [0, 0, 0];
  const len = Number(spec.params.len ?? 5), wid = Number(spec.params.wid ?? 1.4);
  const mat = (spec.params.mat as MatId | undefined) ?? 'metal';
  const group = new THREE.Group();
  group.position.set(c[0]!, c[1]!, c[2]!);
  const deckGeo = boxGeo([len, 0.2, wid], mat);
  const deck = new THREE.Mesh(deckGeo, ctx.materials.get(mat));
  deck.position.y = -0.1;
  const lineGeo = boxGeo([len, 0.012, 0.06], 'yellowLine');
  const lines = [-1, 1].map((sd) => { const m = new THREE.Mesh(lineGeo, ctx.materials.get('yellowLine')); m.position.set(0, 0.006, sd * (wid / 2 - 0.06)); return m; });
  const hubGeo = withBaked(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 28));
  const hub = new THREE.Mesh(hubGeo, ctx.materials.get('metalDark'));
  hub.position.y = 0.015;
  const skirtGeo = withBaked(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 20));
  const skirt = new THREE.Mesh(skirtGeo, ctx.materials.get('metalDark'));
  skirt.position.y = -0.5;
  group.add(deck, ...lines, hub, skirt);
  ctx.root.add(group);
  const l = lightAt(ctx, [c[0]!, c[1]! + 0.6, c[2]!]);
  for (const g of [deckGeo, lineGeo, hubGeo, skirtGeo]) setBaked(g, l);
  let hum: Drone | null = null;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'turn.start') { hum?.stop(); hum = drone(ctx.audio, { pos: at, freq: 44, type: 'sawtooth', lfoHz: 2, lfoDepth: 3, gain: 0.06 }); }
    else if (name === 'turn.stop') { hum?.stop(); hum = null; noise(ctx.audio, { pos: at, gain: 0.18, dur: 0.3, lowpass: 380 }); }
    else if (name === 'turn.full') tone(ctx.audio, 392, { pos: at, gain: 0.08, dur: 1.6, partials: [[1, 1], [2.01, 0.3]] });
  });
  return {
    update(s) { group.rotation.y = -Number(s.prev ?? 0) || 0; },
    dispose() { off(); hum?.stop(); group.removeFromParent(); for (const g of [deckGeo, lineGeo, hubGeo, skirtGeo]) g.dispose(); },
  };
});

defineView('slideTiles', (spec, ctx) => {
  const cells = (spec.params.cells as number[][] | undefined) ?? [];
  const occ0 = (spec.params.occ as number[] | undefined) ?? [];
  const y = Number(spec.params.y ?? 0);
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorTile';
  const n = occ0.filter((v) => v >= 0).length;
  const c0 = cells[0] ?? [0, 0, 1, 1];
  const size: [number, number, number] = [c0[2]! - c0[0]! - 0.06, 0.15, c0[3]! - c0[1]! - 0.06];
  const g = boxGeo(size, mat);
  setBaked(g, lightAt(ctx, [(c0[0]! + c0[2]!) / 2, y + 0.6, (c0[1]! + c0[3]!) / 2]));
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(g, ctx.materials.get(mat)); meshes.push(m); ctx.root.add(m); }
  const center = (j: number): [number, number] => { const c = cells[j]!; return [(c[0]! + c[2]!) / 2, (c[1]! + c[3]!) / 2]; };
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'slide.move') noise(ctx.audio, { pos: at, gain: 0.07, dur: Number(spec.params.moveSec ?? 1.2), lowpass: 700, highpass: 120, attack: 0.15 });
    else if (name === 'slide.stop') noise(ctx.audio, { pos: at, gain: 0.14, dur: 0.18, lowpass: 500 });
  });
  return {
    update(s) {
      const occ = (s.occ as number[] | undefined) ?? occ0;
      const mv = (s.mv as number[] | undefined) ?? [];
      const t = Number(s.t ?? 0), k = t * t * (3 - 2 * t);
      occ.forEach((id, j) => {
        const m = meshes[id];
        if (!m || id < 0) return;
        let [x, z] = center(j);
        if (mv.length && mv[0] === id) { const a = center(mv[1]!), b = center(mv[2]!); x = a[0] + (b[0] - a[0]) * k; z = a[1] + (b[1] - a[1]) * k; }
        m.position.set(x, y - 0.075, z);
      });
    },
    dispose() { off(); for (const m of meshes) m.removeFromParent(); g.dispose(); },
  };
});
