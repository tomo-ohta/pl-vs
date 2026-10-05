/**
 * 移動と身体の描画: 転がる球（rideBall）。玉乗りは縞の大きな球（転がった分だけ回る）、バブルは透明な球（ゆらゆら揺れる）。
 * ぶつかる音・ひびの入る音・割れる音
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { lightAt, nearCamera, setBaked, withBaked } from './util.ts';

defineView('rideBall', (spec, ctx) => {
  const R = Number(spec.params.radius ?? 0.55);
  const bubble = String(spec.params.mode ?? 'on') === 'in';
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const geos: THREE.BufferGeometry[] = [];
  if (bubble) {
    const g = withBaked(new THREE.SphereGeometry(R, 24, 16));
    const ring = withBaked(new THREE.TorusGeometry(R * 0.98, 0.012, 6, 32));
    geos.push(g, ring);
    spin.add(new THREE.Mesh(g, ctx.materials.get('glass')));
    const rm = new THREE.Mesh(ring, ctx.materials.get('ledBlue'));
    rm.rotation.x = Math.PI / 2;
    spin.add(rm);
  } else {
    // 縞の球: 経線の向きに 6 つに分けて色を変える
    const mats: MatId[] = ['plasticRed', 'paintWhite', 'plasticBlue', 'paintWhite', 'plasticYellow', 'paintWhite'];
    mats.forEach((m, i) => {
      const g = withBaked(new THREE.SphereGeometry(R, 8, 12, (i * Math.PI) / 3, Math.PI / 3));
      geos.push(g);
      spin.add(new THREE.Mesh(g, ctx.materials.get(m)));
    });
  }
  ctx.root.add(group);
  const home = spec.params.home as number[];
  const light = lightAt(ctx, [home[0]!, home[1]!, home[2]!]);
  for (const g of geos) setBaked(g, light);
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || !ctx.audio || !e.pos || !nearCamera(ctx, e.pos as [number, number, number])) return;
    const at = e.pos as [number, number, number];
    switch (e.data?.name) {
      case 'ball.board': ctx.audio.play('knock', { pos: at, gain: 0.25, pitch: bubble ? 1.6 : 0.8 }); break;
      case 'ball.bump': ctx.audio.play('thud', { pos: at, gain: Math.min(0.8, 0.15 + Number(e.data?.speed ?? 1) * 0.12), pitch: bubble ? 1.5 : 0.9 }); break;
      case 'ball.crack': ctx.audio.play('knock', { pos: at, gain: 0.7, pitch: 0.7 }); break;
      case 'ball.break': ctx.audio.play('thud', { pos: at, gain: 1, pitch: 0.6 }); ctx.audio.play('clank', { pos: at, gain: 0.6 }); break;
      case 'ball.thrown': ctx.audio.play('thud', { pos: at, gain: 0.6 }); break;
      case 'ball.area': ctx.audio.play('chime', { pos: at, gain: 0.3 }); break;
    }
  });
  const q = new THREE.Quaternion(), ax = new THREE.Vector3();
  let t = 0, relight = 0, rumble = 0;
  return {
    update(s, dt) {
      t += dt;
      const p = (s.pos as number[] | undefined) ?? home;
      const v = (s.vel as number[] | undefined) ?? [0, 0, 0];
      group.position.set(p[0]!, p[1]!, p[2]!);
      const sp = Math.hypot(v[0]!, v[2]!);
      if (!bubble && sp > 1e-3) {
        // 転がる: 進む向きに垂直な水平の軸のまわりに、進んだ距離 / 半径だけ回す
        ax.set(v[2]! / sp, 0, -v[0]! / sp);
        q.setFromAxisAngle(ax, (sp * dt) / R);
        spin.quaternion.premultiply(q);
      }
      if (bubble) {
        const k = 1 + Math.sin(t * 3.1) * 0.015;
        spin.scale.set(k, 2 - k, k);
        spin.rotation.y += dt * 0.3;
      }
      relight -= dt;
      if (relight <= 0) { relight = 0.3; const c = lightAt(ctx, [p[0]!, p[1]!, p[2]!]); for (const g of geos) setBaked(g, c); }
      rumble -= dt;
      if (sp > 0.8 && rumble <= 0 && ctx.audio && nearCamera(ctx, [p[0]!, p[1]!, p[2]!], 10)) { ctx.audio.play('knock', { pos: [p[0]!, p[1]! - R, p[2]!], gain: 0.04 + sp * 0.02, pitch: 0.35 }); rumble = Math.max(0.12, 0.6 - sp * 0.08); }
    },
    dispose() { off?.(); group.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});
