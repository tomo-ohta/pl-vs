/**
 * 装置の描画: pushButton（押すと光るボタン）・liftCabin（引き戸・階の表示・ボタンの横の階の名前と引っかき傷・案内板・呼ぶ音や着く音）・
 * vending（落ちてくる缶・鍵）。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, disposeMesh, drone, glowMaterial, lightAt, noise, onCue, setBaked, textPlate, tone, withBaked, type Drone } from './util.ts';

defineView('pushButton', (spec, ctx) => {
  if (spec.params.hidden) return null;
  const b = aabbOf(spec.params.box);
  const mat = (spec.params.mat as MatId | undefined) ?? 'stainless';
  const size: [number, number, number] = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const g = boxGeo(size, mat);
  const c: [number, number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  setBaked(g, lightAt(ctx, c));
  const off = ctx.materials.get(mat);
  const on = glowMaterial(Number(spec.params.glow ?? 0xffd890));
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(g, off);
  mesh.position.set(...c);
  ctx.root.add(mesh);
  const unsub = onCue(ctx, spec.id, (name, at) => { if (name === 'push.press') tone(ctx.audio, 1320, { pos: at, gain: 0.04, dur: 0.08, type: 'square' }); });
  return {
    update(s) { mesh.material = s.lit ? on : off; },
    dispose() { unsub(); mesh.removeFromParent(); g.dispose(); on.dispose(); },
  };
});

/** 面の向き（外向きの法線 [x, 0, z]）に向けた板 */
function facePlate(m: THREE.Object3D, n: readonly number[]): void {
  m.rotation.set(0, Math.atan2(n[0]!, n[2]!), 0);
}

defineView('liftCabin', (spec, ctx) => {
  const panel = aabbOf(spec.params.panel);
  const slide = (spec.params.slide as number[] | undefined) ?? [1, 0, 0];
  const face = (spec.params.facing as number[] | undefined) ?? [0, 0, 1];
  const buttons = (spec.params.buttons as unknown as { label: string; fake: boolean; cur: boolean; scratches: number; center: number[] }[] | undefined) ?? [];
  const group = new THREE.Group();
  ctx.root.add(group);
  // 引き戸 2 枚（開くと横へ）
  const pw = (slide[0] ? panel.max[0] - panel.min[0] : panel.max[2] - panel.min[2]) / 2;
  const pt = slide[0] ? panel.max[2] - panel.min[2] : panel.max[0] - panel.min[0];
  const ph = panel.max[1] - panel.min[1];
  const doorGeo = boxGeo(slide[0] ? [pw, ph, pt] : [pt, ph, pw], 'stainless');
  const pc: [number, number, number] = [(panel.min[0] + panel.max[0]) / 2, (panel.min[1] + panel.max[1]) / 2, (panel.min[2] + panel.max[2]) / 2];
  setBaked(doorGeo, lightAt(ctx, [pc[0] + face[0]! * 0.4, pc[1], pc[2] + face[2]! * 0.4]));
  const doors = [-1, 1].map((sd) => { const m = new THREE.Mesh(doorGeo, ctx.materials.get('stainless')); m.userData.sd = sd; group.add(m); return m; });
  // 階の表示（扉の上・外）と、かごの中の表示
  const ind = (spec.params.indicator as number[] | undefined) ?? pc;
  const cache = new Map<string, THREE.Mesh>();
  const showLabel = (label: string): void => {
    for (const [k, m] of cache) m.visible = k === label;
    if (!cache.has(label)) {
      const m = textPlate(label, 0.34, 0.16, { fg: '#ff9a3c', bg: '#120d08', px: 64 });
      m.position.set(ind[0]! + face[0]! * 0.01, ind[1]!, ind[2]! + face[2]! * 0.01);
      facePlate(m, face);
      group.add(m);
      cache.set(label, m);
    }
  };
  const cur = String(spec.params.cur ?? 'B1');
  showLabel(cur);
  // ボタンの横の階の名前（かごの中を向く）と、存在しない階の横の引っかき傷
  const inward = [-face[0]!, 0, -face[2]!];
  const side = [face[2]!, 0, -face[0]!];
  const scratchMat = new THREE.MeshBasicMaterial({ color: 0x2a2622 });
  for (const b of buttons) {
    const m = textPlate(b.label, 0.07, 0.05, { fg: '#e8e4da', bg: '#3a3d42', px: 48 });
    m.position.set(b.center[0]! + side[0]! * 0.065 + inward[0]! * 0.012, b.center[1]!, b.center[2]! + side[2]! * 0.065 + inward[2]! * 0.012);
    facePlate(m, inward);
    group.add(m);
    for (let k = 0; k < b.scratches; k++) {
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.055), scratchMat);
      sm.position.set(b.center[0]! - side[0]! * (0.05 + k * 0.012) + inward[0]! * 0.014, b.center[1]!, b.center[2]! - side[2]! * (0.05 + k * 0.012) + inward[2]! * 0.014);
      facePlate(sm, inward);
      sm.rotation.z = 0.25;
      group.add(sm);
    }
  }
  // 外の ▼ と案内板（本当の階だけ）
  const call = (spec.params.call as number[] | undefined) ?? null;
  if (call) {
    const arrow = textPlate('▼', 0.06, 0.06, { fg: '#ffb050', bg: '#2a2d32', px: 48 });
    arrow.position.set(call[0]! + face[0]! * 0.035, call[1]! + 0.09, call[2]! + face[2]! * 0.035);
    facePlate(arrow, face);
    group.add(arrow);
    const reals = buttons.filter((b) => !b.fake).map((b) => b.label);
    reals.forEach((label, i) => {
      const m = textPlate(`${label}${label === cur ? '  ◀' : ''}`, 0.24, 0.07, { fg: '#e8e4da', bg: '#20242a', px: 40 });
      m.position.set(call[0]! + face[0]! * 0.012, call[1]! + 0.62 - i * 0.075, call[2]! + face[2]! * 0.012);
      facePlate(m, face);
      group.add(m);
    });
  }
  let hum: Drone | null = null;
  let flip = 0, shownIdx = 0;
  const reals = buttons.filter((b) => !b.fake);
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'lift.call') tone(ctx.audio, 880, { pos: at, gain: 0.05, dur: 0.12 });
    else if (name === 'lift.arrive') { tone(ctx.audio, 988, { pos: at, gain: 0.08, dur: 0.6 }); tone(ctx.audio, 784, { pos: at, gain: 0.08, dur: 0.9, delay: 0.35 }); hum?.stop(); hum = null; }
    else if (name === 'lift.close') noise(ctx.audio, { pos: at, gain: 0.06, dur: 1.1, lowpass: 900, attack: 0.3 });
    else if (name === 'lift.ride') { hum?.stop(); hum = drone(ctx.audio, { pos: at, freq: 58, type: 'sawtooth', lfoHz: 0.7, lfoDepth: 5, gain: 0.07 }); }
    else if (name === 'lift.ding') tone(ctx.audio, 1046 + Number(data.n ?? 0) * 120, { pos: at, gain: 0.05, dur: 0.25 });
    else if (name === 'lift.buzz') tone(ctx.audio, 110, { pos: at, gain: 0.08, dur: 0.4, type: 'square' });
    else if (name === 'lift.ghost') { for (const [f, dl] of [[220, 0], [261.6, 0.1], [311, 0.2]] as const) tone(ctx.audio, f, { pos: at, gain: 0.06, dur: 2.4, delay: dl, type: 'triangle' }); }
  });
  return {
    update(s, dt) {
      const k = Math.max(0, Math.min(1, Number(s.door ?? 0)));
      for (const m of doors) {
        const sd = m.userData.sd as number;
        const o = sd * (pw / 2 + k * (pw - 0.04));
        m.position.set(pc[0] + slide[0]! * o, pc[1], pc[2] + slide[2]! * o);
      }
      // 表示: 動いている間は数字が流れ、着いたら押していない階
      const phase = Number(s.phase ?? 0);
      if (phase === 4) {
        flip += dt;
        if (flip > 0.7 && reals.length) { flip = 0; shownIdx = (shownIdx + 1) % reals.length; showLabel(reals[shownIdx]!.label); }
      } else if (phase === 5) showLabel('?');
      else if (phase !== 4) showLabel(cur);
    },
    dispose() { off(); hum?.stop(); disposeMesh(group); doorGeo.dispose(); scratchMat.dispose(); },
  };
});

defineView('vending', (spec, ctx) => {
  const slot = (spec.params.slot as number[] | undefined) ?? [0, 0, 0];
  const colors = (spec.params.colors as number[] | undefined) ?? [0xff3b30, 0x2f7bff, 0x34c759];
  const canGeo = withBaked(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12));
  canGeo.rotateZ(Math.PI / 2);
  const canMats = colors.map((c) => new THREE.MeshBasicMaterial({ color: c, fog: true }));
  const can = new THREE.Mesh(canGeo, canMats[0]);
  can.visible = false;
  const keyMat = new THREE.MeshBasicMaterial({ color: 0xd9b24a, fog: true });
  const key = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.012), keyMat);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), keyMat);
  bow.position.x = -0.06;
  key.add(shaft, bow);
  key.visible = false;
  ctx.root.add(can, key);
  let drop = -1;
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'vend.drop') { const c = Number(data.color ?? 1) - 1; can.material = canMats[c] ?? canMats[0]!; can.visible = true; drop = 0; noise(ctx.audio, { pos: at, gain: 0.3, dur: 0.25, lowpass: 600, delay: 0.25 }); }
    else if (name === 'vend.key') { key.visible = true; can.visible = false; drop = 0; tone(ctx.audio, 2400, { pos: at, gain: 0.05, dur: 0.5, delay: 0.3, partials: [[1, 1], [1.5, 0.4]] }); }
    else if (name === 'vend.take') { key.visible = false; tone(ctx.audio, 660, { pos: at, gain: 0.06, dur: 0.8 }); }
  });
  return {
    update(_s, dt) {
      // 落ちてくる（0.3 秒）
      if (drop >= 0) drop = Math.min(0.3, drop + dt);
      const yy = slot[1]! + (0.3 - Math.max(0, drop)) * 2.2;
      can.position.set(slot[0]!, Math.max(slot[1]! - 0.03, yy - 0.03), slot[2]!);
      key.position.set(slot[0]!, Math.max(slot[1]! - 0.05, yy - 0.05), slot[2]!);
    },
    dispose() { off(); can.removeFromParent(); key.removeFromParent(); canGeo.dispose(); for (const m of canMats) m.dispose(); shaft.geometry.dispose(); bow.geometry.dispose(); keyMat.dispose(); },
  };
});
