/**
 * 光の筋と鏡の描画。
 * - mirror: 台の上の鏡（枠と、ガラスの板）。向き（state 0 = ／・1 = ＼）へ 0.25 秒で回る。回すと金属の音
 * - beam: 光源からの光の筋（芯の細い線と、にじむ太い線）と、止まった所の光の点。受光器に当たると鐘の音
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { glowMaterial, LitParts, onCue } from './common.ts';

defineView('mirror', (spec, ctx) => {
  const p = spec.params.pos as number[];
  const pivot = new THREE.Group();
  pivot.position.set(p[0]!, p[1]!, p[2]!);
  // 枠（上下左右）と鏡の板
  const frame = new LitParts(ctx);
  frame.box([0.74, 0.04, 0.05], [0, 0.29, 0], 'metalDark');
  frame.box([0.74, 0.04, 0.05], [0, -0.29, 0], 'metalDark');
  frame.box([0.04, 0.62, 0.05], [-0.37, 0, 0], 'metalDark');
  frame.box([0.04, 0.62, 0.05], [0.37, 0, 0], 'metalDark');
  frame.box([0.7, 0.54, 0.02], [0, 0, -0.012], 'metalDark');
  pivot.add(frame.group);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.55, fog: true });
  const glassGeo = new THREE.PlaneGeometry(0.68, 0.52);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.z = 0.004;
  const glassBack = glass.clone();
  glassBack.rotation.y = Math.PI;
  glassBack.position.z = -0.03;
  pivot.add(glass, glassBack);
  ctx.root.add(pivot);
  frame.relight([p[0]!, p[1]!, p[2]!]);
  // 状態 0（／）: 鏡の面は (1, 1) の向き = rotation.y -45°・1（＼）: (1, -1) = +45°
  const target = (s: number): number => (s ? Math.PI / 4 : -Math.PI / 4);
  let rot = target(Number(spec.params.initial ?? 0));
  pivot.rotation.y = rot;
  let relit = 0;
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'mirror.turn') ctx.audio?.play('clank', { pos: e.pos as [number, number, number] | undefined, gain: 0.35 });
  });
  return {
    update(s, dt) {
      const want = target(Number(s.s ?? 0));
      rot += (want - rot) * Math.min(1, dt * 10);
      pivot.rotation.y = rot;
      relit -= dt;
      if (relit <= 0) { relit = 0.5; frame.relight([p[0]!, p[1]!, p[2]!]); }
    },
    dispose() { off(); pivot.removeFromParent(); frame.dispose(); glassGeo.dispose(); glassMat.dispose(); },
  };
});

defineView('beam', (spec, ctx) => {
  const y = Number(spec.params.y ?? 1);
  const color = 0xffe7a8;
  const core = glowMaterial(color, 0.95);
  const halo = glowMaterial(color, 0.16);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const segs: { c: THREE.Mesh; h: THREE.Mesh }[] = [];
  const dotGeo = new THREE.SphereGeometry(0.07, 12, 10);
  const dot = new THREE.Mesh(dotGeo, glowMaterial(0xfff4d0, 0.9));
  ctx.root.add(dot);
  let key = '';
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'beam.lit') ctx.audio?.play('bell', { pos: e.pos as [number, number, number] | undefined, gain: 0.5 });
  });
  const draw = (path: number[][]): void => {
    for (const s of segs) { s.c.visible = false; s.h.visible = false; }
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!, b = path[i]!;
      let s = segs[i - 1];
      if (!s) { s = { c: new THREE.Mesh(geo, core), h: new THREE.Mesh(geo, halo) }; segs.push(s); ctx.root.add(s.c, s.h); }
      const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
      const alongX = Math.abs(b[0]! - a[0]!) > Math.abs(b[1]! - a[1]!);
      for (const [m, w] of [[s.c, 0.022], [s.h, 0.09]] as const) {
        m.visible = true;
        m.position.set((a[0]! + b[0]!) / 2, y, (a[1]! + b[1]!) / 2);
        m.scale.set(alongX ? len : w, w, alongX ? w : len);
      }
    }
    const end = path[path.length - 1];
    if (end) dot.position.set(end[0]!, y, end[1]!);
  };
  let pulse = 0;
  return {
    update(s, dt) {
      const path = (s.path as number[][] | undefined) ?? [];
      const k = String(s.key ?? '');
      if (k !== key) { key = k; draw(path); }
      pulse += dt;
      halo.opacity = 0.13 + 0.04 * Math.sin(pulse * 7.3);
    },
    dispose() { off(); for (const s of segs) { s.c.removeFromParent(); s.h.removeFromParent(); } dot.removeFromParent(); geo.dispose(); dotGeo.dispose(); core.dispose(); halo.dispose(); (dot.material as THREE.Material).dispose(); },
  };
});
