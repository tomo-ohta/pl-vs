/**
 * 壁の装置の描画: alarm（回る回転灯と警報の音）・securityDoor（黄色と黒の縁の鋼鉄の引き戸）・breaker（レバーと、暗いときだけ光る非常口の印・
 * 床の蓄光の矢印）・dialLock（ダイヤルの数字・壁の色の数字の張り紙・開く金庫の扉）・callBell（遠くで鳴るベルの音）。
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, disposeMesh, drone, glowMaterial, lightAt, noise, onCue, setBaked, textPlate, tone, type Drone } from './util.ts';

defineView('alarm', (spec, ctx) => {
  const beacons = (spec.params.beacons as number[][] | undefined) ?? [];
  const group = new THREE.Group();
  ctx.root.add(group);
  const capMat = glowMaterial(0x501010), litMat = glowMaterial(0xff2a1a);
  const flareMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const items = beacons.map((p) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 12), capMat);
    cap.position.set(p[0]!, p[1]!, p[2]!);
    const rot = new THREE.Group();
    rot.position.copy(cap.position);
    const flare = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), flareMat);
    flare.position.x = 0.8;
    rot.add(flare);
    rot.visible = false;
    group.add(cap, rot);
    return { cap, rot };
  });
  let siren: Drone | null = null;
  const off = onCue(ctx, spec.id, (name) => {
    if (name === 'alarm.start') { siren?.stop(); siren = drone(ctx.audio, { pos: beacons[0], freq: 660, type: 'square', lfoHz: 1.6, lfoDepth: 180, gain: 0.05 }); }
    else if (name === 'alarm.stop') { siren?.stop(); siren = null; }
  });
  return {
    update(s, dt) {
      const on = Number(s.left ?? 0) > 0;
      for (const it of items) { it.rot.visible = on; it.cap.material = on ? litMat : capMat; if (on) it.rot.rotation.y += dt * 7; }
    },
    dispose() { off(); siren?.stop(); disposeMesh(group); capMat.dispose(); litMat.dispose(); flareMat.dispose(); },
  };
});

defineView('securityDoor', (spec, ctx) => {
  const p = aabbOf(spec.params.panel);
  const slide = (spec.params.slide as number[] | undefined) ?? [1, 0, 0];
  const size: [number, number, number] = [p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2]];
  const g = boxGeo(size, 'metalDark');
  const c: [number, number, number] = [(p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2];
  setBaked(g, lightAt(ctx, c));
  const door = new THREE.Mesh(g, ctx.materials.get('metalDark'));
  const stripeGeo = boxGeo([size[0] + 0.01, 0.12, size[2] + 0.01], 'yellowLine');
  setBaked(stripeGeo, lightAt(ctx, c));
  const stripe = new THREE.Mesh(stripeGeo, ctx.materials.get('yellowLine'));
  stripe.position.y = -size[1] / 2 + 0.25;
  door.add(stripe);
  ctx.root.add(door);
  const w = slide[0] ? size[0] : size[2];
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'steel.open' || name === 'steel.close') noise(ctx.audio, { pos: at, gain: 0.12, dur: 1.1, lowpass: 380, attack: 0.15 });
  });
  return {
    update(s) {
      const k = Math.max(0, Math.min(1, Number(s.k ?? 0)));
      door.position.set(c[0] + slide[0]! * w * 0.95 * k, c[1], c[2] + slide[2]! * w * 0.95 * k);
    },
    dispose() { off(); door.removeFromParent(); g.dispose(); stripeGeo.dispose(); },
  };
});

defineView('breaker', (spec, ctx) => {
  const lever = (spec.params.lever as number[] | undefined) ?? [0, 1.5, 0];
  const signs = (spec.params.signs as number[][] | undefined) ?? [];
  const arrows = (spec.params.arrows as number[][] | undefined) ?? [];
  const group = new THREE.Group();
  ctx.root.add(group);
  // レバー（上 = 入 / 下 = 切）
  const handle = new THREE.Mesh(boxGeo([0.05, 0.16, 0.05], 'plasticRed'), ctx.materials.get('plasticRed'));
  handle.position.set(lever[0]!, lever[1]!, lever[2]!);
  group.add(handle);
  // 非常口の印（暗いときほど明るい）と、床の蓄光の矢印
  const signMat = new THREE.MeshBasicMaterial({ color: 0x2bd46a, transparent: true, opacity: 0.6, fog: true });
  for (const sg of signs) {
    const m = textPlate('非常口', 0.42, 0.16, { fg: '#ffffff', bg: '#16a34a', px: 56 });
    m.position.set(sg[0]!, sg[1]!, sg[2]!);
    m.rotation.y = sg[3]! + Math.PI;
    group.add(m);
  }
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.28); arrowShape.lineTo(0.16, 0.06); arrowShape.lineTo(0.06, 0.06); arrowShape.lineTo(0.06, -0.24); arrowShape.lineTo(-0.06, -0.24); arrowShape.lineTo(-0.06, 0.06); arrowShape.lineTo(-0.16, 0.06); arrowShape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  arrowGeo.rotateX(-Math.PI / 2);
  for (const a of arrows) {
    const m = new THREE.Mesh(arrowGeo, signMat);
    m.position.set(a[0]!, a[1]!, a[2]!);
    m.rotation.y = a[3]! + Math.PI;
    group.add(m);
  }
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'breaker.off' || name === 'breaker.on') { noise(ctx.audio, { pos: at, gain: 0.25, dur: 0.12, lowpass: 2500 }); tone(ctx.audio, 60, { pos: at, gain: 0.06, dur: 0.4, type: 'sawtooth', freqTo: 30 }); }
  });
  return {
    update(s) {
      const on = Number(s.on ?? 1);
      handle.position.y = lever[1]! + (on ? 0.06 : -0.06);
      signMat.opacity = on ? 0.25 : 0.95;
    },
    dispose() { off(); disposeMesh(group); arrowGeo.dispose(); signMat.dispose(); },
  };
});

const HEX = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

defineView('dialLock', (spec, ctx) => {
  const dials = (spec.params.dials as number[][] | undefined) ?? [];
  const colors = (spec.params.colors as number[] | undefined) ?? [0xd83a2e, 0x2f6fd8, 0x2f9e4f];
  const code = (spec.params.code as number[] | undefined) ?? [];
  const clues = (spec.params.clues as number[][] | undefined) ?? [];
  const vault = (spec.params.vault as number[] | undefined) ?? [0, 1, 0];
  const out = (spec.params.out as number[] | undefined) ?? [0, 0, 1];
  const yaw = Math.atan2(out[0]!, out[2]!);
  const group = new THREE.Group();
  ctx.root.add(group);
  // 金庫の扉（丸い鋼鉄の板。開くと壁の向こうへ回って消える）
  const doorGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 28);
  doorGeo.rotateX(Math.PI / 2);
  const doorMesh = new THREE.Mesh(doorGeo, ctx.materials.get('metal'));
  doorMesh.position.set(vault[0]! + out[0]! * 0.06, vault[1]!, vault[2]! + out[2]! * 0.06);
  doorMesh.rotation.y = yaw;
  group.add(doorMesh);
  // ダイヤルの数字（0..9。ダイヤルの上）
  const digits: THREE.Mesh[][] = dials.map((d, i) => Array.from({ length: 10 }, (_, k) => {
    const m = textPlate(String(k), 0.08, 0.08, { fg: '#ffffff', bg: HEX(colors[i] ?? 0x444444), px: 48 });
    m.position.set(d[0]! + out[0]! * 0.07, d[1]! + 0.11, d[2]! + out[2]! * 0.07);
    m.rotation.y = yaw;
    m.visible = k === 0;
    group.add(m);
    return m;
  }));
  // 張り紙: 色の付いた大きな数字
  for (const c of clues) {
    const i = c[4]!;
    const m = textPlate(String(code[i] ?? 0), 0.34, 0.44, { fg: HEX(colors[i] ?? 0x444444), bg: '#efe9da', px: 128 });
    m.position.set(c[0]!, c[1]!, c[2]!);
    m.rotation.y = c[3]! + Math.PI;
    group.add(m);
  }
  let shown = [0, 0, 0], k = 0;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'dial.click') tone(ctx.audio, 1800, { pos: at, gain: 0.03, dur: 0.04, type: 'square' });
    else if (name === 'dial.open') { noise(ctx.audio, { pos: at, gain: 0.2, dur: 1.4, lowpass: 300, attack: 0.3 }); tone(ctx.audio, 520, { pos: at, gain: 0.05, dur: 0.6, delay: 0.1 }); }
  });
  return {
    update(s, dt) {
      const d = (s.digits as number[] | undefined) ?? [0, 0, 0];
      for (let i = 0; i < digits.length; i++) if (d[i] !== shown[i]) { for (const [j, m] of digits[i]!.entries()) m.visible = j === d[i]; }
      shown = [...d];
      if (Number(s.open ?? 0)) k = Math.min(1, k + dt / 1.5);
      doorMesh.rotation.y = yaw + k * 1.7;
      doorMesh.position.set(vault[0]! + out[0]! * (0.06 + k * 0.5), vault[1]!, vault[2]! + out[2]! * (0.06 + k * 0.5));
      for (const ds of digits) for (const m of ds) if (k > 0.05) m.visible = false;
    },
    dispose() { off(); disposeMesh(group); },
  };
});

defineView('callBell', (spec, ctx) => {
  const at = (spec.params.at as number[] | undefined) ?? [0, 2, 0];
  const off = onCue(ctx, spec.id, (name) => {
    // 遠くのベル（音の向きで扉を探す）
    if (name === 'bell.ring') tone(ctx.audio, 1318, { pos: at, gain: 0.35, dur: 1.4, partials: [[1, 1], [2.76, 0.35], [5.4, 0.15]] });
    else if (name === 'bell.call') tone(ctx.audio, 880, { gain: 0.04, dur: 0.15 });
    else if (name === 'bell.open') noise(ctx.audio, { pos: at, gain: 0.12, dur: 0.9, lowpass: 600, attack: 0.2 });
  });
  return { update() {}, dispose() { off(); } };
});
