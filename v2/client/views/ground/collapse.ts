/**
 * 崩れていく帰り道（collapseFloor）の描画: 床板（InstancedMesh。揺れて落ちる）・奥の装置（脈打つ光の玉。崩れている間は赤）・
 * 警報（鳴り続ける音）・崩れる音。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, disposeMesh, drone, lightAt, noise, onCue, tone, type Drone } from './util.ts';

defineView('collapseFloor', (spec, ctx) => {
  const tiles = (spec.params.tiles as number[][] | undefined) ?? [];
  const y = typeof spec.params.y === 'number' ? spec.params.y : 0;
  const th = typeof spec.params.thick === 'number' ? spec.params.thick : 0.12;
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorTile';
  const geo = boxGeo([1, 1, 1], mat);
  geo.deleteAttribute('bakedLight');
  geo.setAttribute('bakedLight', new THREE.InstancedBufferAttribute(new Float32Array(tiles.length * 3).fill(0.3), 3));
  const mesh = new THREE.InstancedMesh(geo, ctx.materials.get(mat), Math.max(1, tiles.length));
  mesh.frustumCulled = false;
  const baked = geo.getAttribute('bakedLight') as THREE.InstancedBufferAttribute;
  tiles.forEach((r, i) => { const c = lightAt(ctx, [(r[0]! + r[2]!) / 2, y + 0.3, (r[1]! + r[3]!) / 2]); baked.setXYZ(i, c[0], c[1], c[2]); });
  ctx.root.add(mesh);
  // 装置: 台の上の光の玉
  const dev = aabbOf(spec.params.device);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, fog: true });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), orbMat);
  orb.position.set((dev.min[0] + dev.max[0]) / 2, dev.min[1] + 0.14, (dev.min[2] + dev.max[2]) / 2);
  const glow = new THREE.PointLight(0x9fe8ff, 0.8, 3.2, 2);
  orb.add(glow);
  ctx.root.add(orb);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let t = 0;
  let siren: Drone | null = null;
  const pos = orb.position.toArray() as [number, number, number];
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'collapse.trigger') { tone(ctx.audio, 220, { pos, gain: 0.2, dur: 1.2, type: 'square', freqTo: 110 }); }
    else if (name === 'collapse.shake') noise(ctx.audio, { pos: at, gain: 0.12, dur: 0.35, lowpass: 900 });
    else if (name === 'collapse.fall') noise(ctx.audio, { pos: at, gain: Math.min(0.5, 0.18 + 0.04 * Number(data.n ?? 1)), dur: 0.7, lowpass: 380, attack: 0.02 });
    else if (name === 'collapse.restore') { noise(ctx.audio, { pos, gain: 0.25, dur: 1.4, lowpass: 600, attack: 0.3 }); tone(ctx.audio, 330, { pos, gain: 0.08, dur: 1.2 }); }
  });
  return {
    update(s, dt) {
      t += dt;
      const phase = (s.phase as number[] | undefined) ?? [];
      const drop = (s.drop as number[] | undefined) ?? [];
      const active = (s.mode as number) >= 1;
      for (let i = 0; i < tiles.length; i++) {
        const r = tiles[i]!;
        const ph = phase[i] ?? 0, d = drop[i] ?? 0;
        let ox = 0, oy = 0, oz = 0;
        e.set(0, 0, 0);
        if (ph === 1) { ox = Math.sin(t * 61 + i) * 0.014; oy = Math.sin(t * 47 + i * 2) * 0.01; oz = Math.cos(t * 53 + i) * 0.014; }
        else if (ph === 2) { oy = -d * d * 0.5; e.set(d * 0.4 * ((i % 3) - 1), 0, d * 0.3 * ((i % 2) * 2 - 1)); }
        p.set((r[0]! + r[2]!) / 2 + ox, y - th / 2 + oy, (r[1]! + r[3]!) / 2 + oz);
        q.setFromEuler(e);
        sc.set(ph === 2 && d > 4 ? 0 : r[2]! - r[0]!, ph === 2 && d > 4 ? 0 : th, ph === 2 && d > 4 ? 0 : r[3]! - r[1]!);
        m4.compose(p, q, sc);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      // 装置の光: 普段は青白く脈打つ。崩れている間は赤く速く
      const k = active ? 0.5 + 0.5 * Math.sin(t * 14) : 0.6 + 0.4 * Math.sin(t * 2.2);
      orbMat.color.setHex(active ? 0xff3020 : 0x9fe8ff);
      glow.color.setHex(active ? 0xff3020 : 0x9fe8ff);
      glow.intensity = 0.4 + 0.9 * k;
      orb.position.y = dev.min[1] + 0.14 + Math.sin(t * 1.7) * 0.02;
      if (active && !siren) siren = drone(ctx.audio, { pos, freq: 640, type: 'square', lfoHz: 1.6, lfoDepth: 180, gain: 0.05 });
      if (!active && siren) { siren.stop(); siren = null; }
    },
    dispose() {
      off();
      siren?.stop();
      mesh.removeFromParent();
      geo.dispose();
      disposeMesh(orb);
    },
  };
});
