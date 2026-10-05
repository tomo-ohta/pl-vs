/**
 * 仕切りの装置の描画: ticketGates（通路の扉・駅名の看板と路線の色・通る音。知らない駅では看板が空になり照明が赤く）・
 * autoDoor（左右に開くガラスの扉と枠・上の灯り（緑 = 開く / 赤 = 開かない）・故障中の札）・shutter（上下する板と、動く音）。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, disposeMesh, drone, glowMaterial, lightAt, noise, onCue, setBaked, textPlate, tone, type Drone } from './util.ts';

const LINE_COLORS = [0x2f9e5a, 0xe0582a, 0x2a6fd6, 0xc9a227, 0x8e44ad, 0x16a3a3, 0xd63a6f, 0x6b7280];

defineView('ticketGates', (spec, ctx) => {
  const lanes = (spec.params.lanes as number[][] | undefined) ?? [];
  const cross = Number(spec.params.cross ?? -1);
  const along = (spec.params.along as number[] | undefined) ?? [0, 1];
  const names = (spec.params.names as string[] | undefined) ?? ['駅'];
  const sign = (spec.params.sign as number[] | undefined) ?? [0, 2.4, 0];
  const width = Number(spec.params.width ?? 2.4);
  const y = Number((spec.params.line as number[] | undefined)?.[1] ?? 0);
  const group = new THREE.Group();
  ctx.root.add(group);
  // 扉: 通路ごとに左右 2 枚の板（開くと機械の中へ回る）
  const flapGeo = boxGeo([0.32, 0.5, 0.03], 'plasticRed');
  setBaked(flapGeo, [0.8, 0.8, 0.8]);
  const flaps: { hinge: THREE.Group; k: number; sd: number }[] = [];
  const yaw = Math.atan2(along[0]!, along[1]!);
  lanes.forEach((r, k) => {
    const cx = (r[0]! + r[2]!) / 2, cz = (r[1]! + r[3]!) / 2;
    const w = Math.abs(along[0]!) > 0.5 ? r[3]! - r[1]! : r[2]! - r[0]!;
    for (const sd of [-1, 1]) {
      // 通路の真ん中を原点に、通路を横切る向きを x にした入れ物 → 機械の縁の蝶番 → 扉の板
      const lane = new THREE.Group();
      lane.position.set(cx, y + 0.55, cz);
      lane.rotation.y = yaw;
      const hinge = new THREE.Group();
      hinge.position.set(sd * (w / 2), 0, 0);
      const m = new THREE.Mesh(flapGeo, ctx.materials.get(k === cross ? 'plasticRed' : 'plasticYellow'));
      m.position.set(-sd * 0.16, 0, 0);
      hinge.add(m);
      lane.add(hinge);
      group.add(lane);
      flaps.push({ hinge, k, sd });
    }
    if (k === cross) {
      const x = textPlate('×', 0.16, 0.16, { fg: '#ff3b30', bg: '#160a0a', px: 64 });
      x.position.set(cx, y + 1.25, cz);
      x.rotation.y = yaw + Math.PI;
      group.add(x);
    }
  });
  // 駅名の看板（入口の側を向く）と路線の色の帯
  const plates = new Map<string, THREE.Mesh>();
  const show = (label: string, color: number): void => {
    for (const [k, m] of plates) m.visible = k === label;
    if (!plates.has(label)) {
      const m = textPlate(label, width, 0.36, { fg: '#1b1d22', bg: '#f2f2ee', px: 72 });
      m.position.set(sign[0]!, sign[1]!, sign[2]!);
      m.rotation.y = yaw + Math.PI;
      group.add(m);
      plates.set(label, m);
    }
    stripeMat.color.setHex(color);
  };
  const stripeMat = new THREE.MeshBasicMaterial({ color: LINE_COLORS[0]!, fog: true });
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.06), stripeMat);
  stripe.position.set(sign[0]!, sign[1]! - 0.22, sign[2]!);
  stripe.rotation.y = yaw + Math.PI;
  group.add(stripe);
  let station = -1, other = 0;
  show(names[0]!, LINE_COLORS[0]!);
  let hum: Drone | null = null;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'gate.pass') { tone(ctx.audio, 2093, { pos: at, gain: 0.05, dur: 0.09 }); tone(ctx.audio, 2637, { pos: at, gain: 0.05, dur: 0.12, delay: 0.1 }); }
    else if (name === 'gate.other') { hum = drone(ctx.audio, { pos: at, freq: 49, type: 'triangle', lfoHz: 0.2, lfoDepth: 2, gain: 0.05 }); tone(ctx.audio, 196, { pos: at, gain: 0.07, dur: 3, type: 'triangle' }); }
  });
  return {
    update(s) {
      const st = Number(s.station ?? 0), ot = Number(s.other ?? 0);
      if (ot && !other) show('　', 0x7a1010);
      else if (!ot && st !== station) show(names[st % names.length]!, LINE_COLORS[st % LINE_COLORS.length]!);
      station = st; other = ot;
      const fl = (s.flaps as number[] | undefined) ?? [];
      for (const f of flaps) f.hinge.rotation.y = f.sd * (fl[f.k] ?? 0) * 1.45;
    },
    dispose() { off(); hum?.stop(); disposeMesh(group); flapGeo.dispose(); },
  };
});

defineView('autoDoor', (spec, ctx) => {
  const p = aabbOf(spec.params.panel);
  const slide = (spec.params.slide as number[] | undefined) ?? [1, 0, 0];
  const broken = !!spec.params.broken;
  const alongX = !!slide[0];
  const len = alongX ? p.max[0] - p.min[0] : p.max[2] - p.min[2];
  const th = Math.max(0.02, alongX ? p.max[2] - p.min[2] : p.max[0] - p.min[0]);
  const h = p.max[1] - p.min[1];
  const c: [number, number, number] = [(p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2];
  const group = new THREE.Group();
  ctx.root.add(group);
  // 戸の材質（既定はガラス。エレベーターのかごの引き戸はステンレス: core/gen/floor/arrival.ts）
  const leafMat = (spec.params.mat as MatId | undefined) ?? 'glass';
  const glassGeo = boxGeo(alongX ? [len / 2, h - 0.05, th] : [th, h - 0.05, len / 2], leafMat);
  const frameGeo = boxGeo(alongX ? [len / 2, 0.05, th + 0.02] : [th + 0.02, 0.05, len / 2], 'metalDark');
  const l = lightAt(ctx, [c[0], c[1], c[2]]);
  setBaked(glassGeo, l); setBaked(frameGeo, l);
  const leaves = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(glassGeo, ctx.materials.get(leafMat));
    const bottom = new THREE.Mesh(frameGeo, ctx.materials.get('metalDark'));
    bottom.position.y = -(h - 0.05) / 2;
    const top = new THREE.Mesh(frameGeo, ctx.materials.get('metalDark'));
    top.position.y = (h - 0.05) / 2;
    g.add(glass, bottom, top);
    g.userData.sd = sd;
    group.add(g);
    return g;
  });
  // 上の灯り（緑 = 開く / 赤 = 開かない）
  const green = glowMaterial(0x3cff7a), red = glowMaterial(0xff3030), dark = glowMaterial(0x222222);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), dark);
  lamp.position.set(c[0], p.max[1] + 0.08, c[2]);
  group.add(lamp);
  if (broken) {
    const tag = textPlate('故障中', 0.36, 0.14, { fg: '#c02020', bg: '#f4f0e0', px: 56 });
    tag.position.set(c[0], p.min[1] + 1.35, c[2]);
    tag.rotation.y = alongX ? 0 : Math.PI / 2;
    group.add(tag);
    const back = tag.clone();
    back.rotation.y += Math.PI;
    group.add(back);
  }
  let flash = 0;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'auto.open') noise(ctx.audio, { pos: at, gain: 0.05, dur: 0.6, lowpass: 1400, highpass: 300, attack: 0.1 });
    else if (name === 'auto.refuse') { flash = 1.2; tone(ctx.audio, 330, { pos: at, gain: 0.04, dur: 0.18, type: 'square' }); }
  });
  return {
    update(s, dt) {
      const k = Math.max(0, Math.min(1, Number(s.k ?? 0)));
      for (const g of leaves) {
        const sd = g.userData.sd as number;
        const o = sd * (len / 4 + k * (len / 2 - 0.05));
        g.position.set(c[0] + slide[0]! * o, c[1], c[2] + slide[2]! * o);
      }
      flash = Math.max(0, flash - dt);
      lamp.material = flash > 0 || Number(s.refused ?? 0) ? red : k > 0.1 ? green : dark;
    },
    dispose() { off(); disposeMesh(group); glassGeo.dispose(); frameGeo.dispose(); green.dispose(); red.dispose(); dark.dispose(); },
  };
});

defineView('shutter', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const top = b.max[1] - b.min[1];
  const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2];
  const g = boxGeo([w, 1, d], 'redShutter');
  const mesh = new THREE.Mesh(g, ctx.materials.get('redShutter'));
  const barGeo = boxGeo([w + 0.01, 0.06, d + 0.03], 'metalDark');
  const bar = new THREE.Mesh(barGeo, ctx.materials.get('metalDark'));
  ctx.root.add(mesh, bar);
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const l = lightAt(ctx, [cx, b.min[1] + 1.2, cz]);
  setBaked(g, l); setBaked(barGeo, l);
  let hum: Drone | null = null;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'shutter.down' || name === 'shutter.up') { hum?.stop(); hum = drone(ctx.audio, { pos: at, freq: 70, type: 'square', lfoHz: 9, lfoDepth: 6, gain: 0.025 }); }
  });
  let prev = top, still = 0;
  return {
    update(s, dt) {
      const h = Number(s.h ?? top);
      const len = Math.max(0.12, top - h);
      mesh.scale.set(1, len, 1);
      mesh.position.set(cx, b.min[1] + h + len / 2, cz);
      bar.position.set(cx, b.min[1] + h + 0.03, cz);
      still = Math.abs(h - prev) < 1e-4 ? still + dt : 0;
      if (still > 0.2 && hum) { hum.stop(); hum = null; noise(ctx.audio, { pos: [cx, b.min[1] + h, cz], gain: 0.08, dur: 0.2, lowpass: 500 }); }
      prev = h;
    },
    dispose() { off(); hum?.stop(); mesh.removeFromParent(); bar.removeFromParent(); g.dispose(); barGeo.dispose(); },
  };
});
