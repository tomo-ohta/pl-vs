/**
 * ミニゲームの部品の描画と音: 傾く床の穴・転がる球と旗の穴・鬼ごっこの灯り・探しに来る灯りの光の扇・弾く柱・台車・的・
 * 自分の影・宙の輪・合図の音（carryChime / pinSetter / memoryGame）。
 * 灯りの玉は、その部品の区画の中の点光源を 1 つだけ持つ（導く光と同じ。灯りの数は読み込みのときに決まる）
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import type { EntitySpec } from '../../../core/world/layout.ts';
import { defineView, type ViewContext } from '../views.ts';
import { lightAt, noteHz, onCue, Parts, playTone } from './common.ts';

const basic = (color: number, o: Partial<THREE.MeshBasicMaterialParameters> = {}): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, ...o });

// ---------------------------------------------------------------- 合図の音
defineView('carryChime', (spec, ctx) => {
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'carry.chime') { playTone(ctx, noteHz(0), { pos: e.pos, dur: 1.4, gain: 0.5, bell: true }); setTimeout(() => playTone(ctx, noteHz(4), { pos: e.pos, dur: 1.4, gain: 0.5, bell: true }), 160); setTimeout(() => playTone(ctx, noteHz(7), { pos: e.pos, dur: 2.0, gain: 0.5, bell: true }), 320); }
    else if (name === 'carry.foul') ctx.audio?.play('beep', { pos: e.pos, gain: 0.3 });
  });
  return { update() {}, dispose() { off(); } };
});

defineView('pinSetter', (spec, ctx) => {
  const off = onCue(ctx, spec.id, (name) => {
    if (name === 'carry.strike') { ctx.audio?.play('chime', { gain: 0.4 }); }
    else if (name === 'carry.pins.reset') ctx.audio?.play('shutter', { gain: 0.25 });
  });
  return { update() {}, dispose() { off(); } };
});

defineView('memoryGame', (spec, ctx) => {
  const off = onCue(ctx, spec.id, (name) => {
    if (name === 'carry.memory.show') ctx.audio?.play('beep', { gain: 0.15 });
    else if (name === 'carry.memory.dark') ctx.audio?.play('clank', { gain: 0.25 });
    else if (name === 'carry.memory.solved') ctx.audio?.play('chime', { gain: 0.35 });
  });
  return { update() {}, dispose() { off(); } };
});

// ---------------------------------------------------------------- 傾く床の穴（板と一緒に傾く）
defineView('ballHole', (spec, ctx) => {
  const holes = (spec.params.holes as number[][] | undefined) ?? [];
  const lit = (spec.params.lit as number[] | undefined) ?? [];
  const plate = String(spec.params.plate ?? '');
  // 傾く床の上面の中心（傾きの中心）。穴はそこからのずれで置き、床と同じ向きに回す
  const ps = ctx.sim.floor.entities.find((e) => e.id === plate);
  const rect = ps?.params.rect as { x0: number; z0: number; x1: number; z1: number } | undefined;
  const cx = rect ? (rect.x0 + rect.x1) / 2 : 0, cz = rect ? (rect.z0 + rect.z1) / 2 : 0, cy = Number(ps?.params.y ?? 0);
  const group = new THREE.Group();
  group.position.set(cx, cy, cz);
  const disc = new THREE.CircleGeometry(1, 24);
  disc.rotateX(-Math.PI / 2);
  const ring = new THREE.RingGeometry(1, 1.18, 28);
  ring.rotateX(-Math.PI / 2);
  const black = basic(0x050505), glow = basic(0xffe9a0);
  holes.forEach((h, i) => {
    const m = new THREE.Mesh(disc, black);
    m.scale.setScalar(h[3]!);
    m.position.set(h[0]! - cx, 0.012, h[2]! - cz);
    group.add(m);
    if (lit[i]) { const r = new THREE.Mesh(ring, glow); r.scale.setScalar(h[3]!); r.position.set(h[0]! - cx, 0.014, h[2]! - cz); group.add(r); }
  });
  ctx.root.add(group);
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.hole') ctx.audio?.play('thud', { pos: e.pos, gain: 0.5 }); });
  return {
    update() {
      const rr = ctx.sim.stateOf(plate)?.rot as number[] | undefined;
      if (rr) group.quaternion.set(rr[0]!, rr[1]!, rr[2]!, rr[3]!);
    },
    dispose() { off(); group.removeFromParent(); disc.dispose(); ring.dispose(); black.dispose(); glow.dispose(); },
  };
});

// ---------------------------------------------------------------- 転がる球（ゴルフ）
defineView('rollBall', (spec, ctx) => {
  const r = Number(spec.params.r ?? 0.09);
  const P = new Parts(ctx);
  const ball = P.add(new THREE.SphereGeometry(r, 18, 12), 'paintWhite', [0, 0, 0]);
  const cups = (spec.params.cups as number[][] | undefined) ?? [];
  const disc = new THREE.CircleGeometry(1, 20);
  disc.rotateX(-Math.PI / 2);
  const black = basic(0x050505);
  const marks = cups.slice(0, 1).map((c) => { const m = new THREE.Mesh(disc, black); m.scale.setScalar(c[2]!); m.position.set(c[0]!, Number((spec.params.tee as number[])[1]) - r + 0.008, c[1]!); ctx.root.add(m); return m; });
  ctx.root.add(P.group);
  let spin = 0, relight = 0;
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'carry.golf.hit') ctx.audio?.play('clank', { pos: e.pos, gain: 0.25 });
    else if (name === 'carry.golf.bump') ctx.audio?.play('thud', { pos: e.pos, gain: 0.15 });
    else if (name === 'carry.golf.cup') ctx.audio?.play('chime', { pos: e.pos, gain: 0.3 });
    else if (name === 'carry.golf.foul') ctx.audio?.play('beep', { pos: e.pos, gain: 0.3 });
  });
  return {
    update(s: Readonly<PartState>, dt: number) {
      const p = s.pos as number[];
      const v = s.vel as number[];
      ball.position.set(p[0]!, p[1]!, p[2]!);
      ball.visible = !(Number(s.sink ?? 0) > 0.3);
      spin += Math.hypot(v[0]!, v[1]!) * dt / r;
      ball.rotation.set(spin, 0, 0);
      relight -= dt;
      if (relight <= 0) { relight = 0.3; P.relight(lightAt(ctx, [p[0]!, p[1]! + 0.3, p[2]!])); }
    },
    dispose() { off(); P.dispose(); for (const m of marks) m.removeFromParent(); disc.dispose(); black.dispose(); },
  };
});

// ---------------------------------------------------------------- 灯りの玉（鬼ごっこ・探しに来る灯り）
function orb(ctx: ViewContext, color: number, range: number): { group: THREE.Group; light: THREE.PointLight; dispose(): void } {
  const geo = new THREE.SphereGeometry(0.12, 16, 12);
  const mat = basic(color, { fog: true });
  const m = new THREE.Mesh(geo, mat);
  const light = new THREE.PointLight(color, 2.0, range, 2);
  m.add(light);
  const group = new THREE.Group();
  group.add(m);
  ctx.root.add(group);
  return { group, light, dispose() { group.removeFromParent(); geo.dispose(); mat.dispose(); } };
}

defineView('tagLight', (spec, ctx) => {
  const o = orb(ctx, Number(spec.params.color ?? 0xffe9b0), Number(spec.params.range ?? 5));
  let t = 0;
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'carry.tag.caught') playTone(ctx, noteHz(7 + (Number(e.data?.count ?? 0) % 5) * 2), { pos: e.pos, dur: 0.6, gain: 0.5 });
    else if (name === 'carry.tag.touch') ctx.audio?.play('chime', { pos: e.pos, gain: 0.4 });
  });
  return {
    update(s: Readonly<PartState>, dt: number) {
      t += dt;
      const p = s.pos as number[];
      o.group.position.set(p[0]!, p[1]! + Math.sin(t * 2.7) * 0.08, p[2]!);
      o.light.intensity = 1.8 + Math.sin(t * 9) * 0.2;
    },
    dispose() { off(); o.dispose(); },
  };
});

defineView('seeker', (spec, ctx) => {
  const o = orb(ctx, 0xcfe4ff, Number(spec.params.viewM ?? 6) + 1);
  // 光の扇（床に薄く）
  const R = Number(spec.params.viewM ?? 6), deg = Number(spec.params.viewDeg ?? 38);
  const fan = new THREE.CircleGeometry(R, 20, -((deg * Math.PI) / 180), (2 * deg * Math.PI) / 180);
  fan.rotateX(-Math.PI / 2);
  const fanMat = basic(0xbfdcff, { transparent: true, opacity: 0.12, depthWrite: false });
  const fanM = new THREE.Mesh(fan, fanMat);
  ctx.root.add(fanM);
  const floorY = Number(((spec.params.area as { min: number[] }).min)[1]) + 0.32;
  let alarm = 0;
  const off = onCue(ctx, spec.id, (name) => {
    if (name === 'carry.seek.caught') { alarm = 1.2; ctx.audio?.play('beep', { gain: 0.4 }); setTimeout(() => ctx.audio?.play('beep', { gain: 0.4 }), 180); }
    else if (name === 'carry.seek.hidden') ctx.audio?.play('chime', { gain: 0.35 });
  });
  return {
    update(s: Readonly<PartState>, dt: number) {
      const p = s.pos as number[], d = s.dir as number[];
      o.group.position.set(p[0]!, p[1]!, p[2]!);
      fanM.position.set(p[0]!, floorY, p[2]!);
      // 円の 0 rad は +x。扇の向き（d）へ回す
      fanM.rotation.y = -Math.atan2(d[1]!, d[0]!);
      alarm = Math.max(0, alarm - dt);
      fanMat.color.setHex(alarm > 0 ? 0xff6050 : 0xbfdcff);
      fanMat.opacity = alarm > 0 ? 0.25 : 0.12;
    },
    dispose() { off(); o.dispose(); fanM.removeFromParent(); fan.dispose(); fanMat.dispose(); },
  };
});

// ---------------------------------------------------------------- 弾く柱
defineView('bumper', (spec, ctx) => {
  const c = spec.params.pos as number[];
  const geo = new THREE.TorusGeometry(0.3, 0.035, 8, 24);
  geo.rotateX(Math.PI / 2);
  const mat = basic(0x803020);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(c[0]!, c[1]! + 0.55, c[2]!);
  ctx.root.add(m);
  let flash = 0;
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.bumper') { flash = 0.25; playTone(ctx, noteHz(12), { pos: e.pos, dur: 0.25, gain: 0.5, type: 'square' }); } });
  return {
    update(_s: Readonly<PartState>, dt: number) { flash = Math.max(0, flash - dt); mat.color.setHex(flash > 0 ? 0xffe060 : 0x803020); },
    dispose() { off(); m.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 台車
defineView('cartTrack', (spec, ctx) => {
  const h = (spec.params.half as number[] | undefined) ?? [0.5, 0.15, 0.5];
  const P = new Parts(ctx);
  P.box([h[0]! * 2, h[1]! * 2, h[2]! * 2], 'plasticYellow', [0, h[1]!, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12).rotateZ(Math.PI / 2), 'rubber', [sx * (h[0]! - 0.1), 0.06, sz * (h[2]! - 0.12)]);
  ctx.root.add(P.group);
  let relight = 0;
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.cart.lap') playTone(ctx, noteHz(Number(e.data?.laps ?? 1) * 2), { pos: e.pos, dur: 0.5, gain: 0.4 }); });
  return {
    update(s: Readonly<PartState>, dt: number) {
      const p = s.pos as number[], v = s.vel as number[];
      P.group.position.set(p[0]!, p[1]!, p[2]!);
      if (Math.hypot(v[0]!, v[2]!) > 0.05) P.group.rotation.y = Math.atan2(v[0]!, v[2]!);
      relight -= dt;
      if (relight <= 0) { relight = 0.3; P.relight(lightAt(ctx, [p[0]!, p[1]! + 0.5, p[2]!])); }
    },
    dispose() { off(); P.dispose(); },
  };
});

// ---------------------------------------------------------------- 的
defineView('throwTarget', (spec, ctx) => {
  const targets = (spec.params.targets as { min: number[]; max: number[] }[] | undefined) ?? [];
  const d = Number(spec.params.dir ?? 0);
  const P = new Parts(ctx);
  const pivots = targets.map((t) => {
    const piv = new THREE.Group();
    piv.position.set((t.min[0]! + t.max[0]!) / 2, t.min[1]!, (t.min[2]! + t.max[2]!) / 2);
    const w = Math.max(t.max[0]! - t.min[0]!, t.max[2]! - t.min[2]!);
    const disc = new THREE.CylinderGeometry(w / 2, w / 2, 0.03, 24);
    disc.rotateX(Math.PI / 2);
    P.add(disc, 'paintWhite', [0, (t.max[1]! - t.min[1]!) / 2, 0], piv);
    const ring = new THREE.CylinderGeometry(w / 4, w / 4, 0.035, 20);
    ring.rotateX(Math.PI / 2);
    P.add(ring, 'plasticRed', [0, (t.max[1]! - t.min[1]!) / 2, 0], piv);
    piv.rotation.y = [0, Math.PI / 2, 0, Math.PI / 2][d]!;
    P.group.add(piv);
    return piv;
  });
  ctx.root.add(P.group);
  const c = targets[0] ? [(targets[0].min[0]! + targets[0].max[0]!) / 2, targets[0].min[1]!, (targets[0].min[2]! + targets[0].max[2]!) / 2] as [number, number, number] : [0, 0, 0] as [number, number, number];
  P.relight(lightAt(ctx, c));
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.target.hit') { ctx.audio?.play('clank', { pos: e.pos, gain: 0.3 }); } else if (name === 'carry.target.reset') ctx.audio?.play('shutter', { gain: 0.15 }); });
  const ang = targets.map(() => 0);
  return {
    update(s: Readonly<PartState>, dt: number) {
      const down = (s.down as number[] | undefined) ?? [];
      pivots.forEach((p, i) => { ang[i] = ang[i]! + ((down[i] ? 1.4 : 0) - ang[i]!) * Math.min(1, dt * 8); p.rotation.x = -ang[i]!; });
    },
    dispose() { off(); P.dispose(); },
  };
});

// ---------------------------------------------------------------- 自分の影（影絵）と線の灯り
defineView('shadowPose', (spec, ctx) => {
  const lamp = spec.params.lamp as number[];
  const face = spec.params.face as number[];
  const wd = Number(spec.params.wall ?? 0);
  const n = ([[0, 0, -1], [-1, 0, 0], [0, 0, 1], [1, 0, 0]] as number[][])[wd]!;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(12);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mat = basic(0x040302, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  ctx.root.add(mesh);
  const planeD = (face[0]! - lamp[0]!) * n[0]! + (face[1]! - lamp[1]!) * n[1]! + (face[2]! - lamp[2]!) * n[2]!;
  const right: number[] = [n[2]!, 0, -n[0]!];
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.pose') ctx.audio?.play('chime', { pos: e.pos, gain: 0.3 }); });
  return {
    update() {
      const p = ctx.sim.players[0];
      if (!p) return;
      const h = p.crouching ? 0.85 : 1.7, w = 0.36;
      let ok = true;
      // 体の箱の、壁と平行な面の 4 隅を灯りから壁へ写す
      [[-1, 0], [1, 0], [1, h], [-1, h]].forEach(([sx, hy], i) => {
        const vx = p.pos[0] + right[0]! * sx! * w, vy = p.pos[1] + hy!, vz = p.pos[2] + right[2]! * sx! * w;
        const dd = (vx - lamp[0]!) * n[0]! + (vy - lamp[1]!) * n[1]! + (vz - lamp[2]!) * n[2]!;
        if (Math.abs(dd) < 1e-4 || planeD / dd < 1) { ok = false; return; }
        const t = planeD / dd;
        pos[i * 3] = lamp[0]! + (vx - lamp[0]!) * t - n[0]! * 0.004;
        pos[i * 3 + 1] = lamp[1]! + (vy - lamp[1]!) * t;
        pos[i * 3 + 2] = lamp[2]! + (vz - lamp[2]!) * t - n[2]! * 0.004;
      });
      mesh.visible = ok;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      geo.computeBoundingSphere();
    },
    dispose() { off(); mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 宙の輪
defineView('ringSensor', (spec, ctx) => {
  const rings = (spec.params.rings as { c: number[]; n: number[]; r: number }[] | undefined) ?? [];
  const meshes = rings.map((r) => {
    const g = new THREE.TorusGeometry(r.r, 0.04, 10, 36);
    const m = new THREE.Mesh(g, basic(0x7080a0));
    m.position.set(r.c[0]!, r.c[1]!, r.c[2]!);
    // 輪の面の法線（n）へ向ける（Torus は +z が法線）
    m.lookAt(r.c[0]! + r.n[0]!, r.c[1]! + r.n[1]!, r.c[2]! + r.n[2]!);
    ctx.root.add(m);
    return m;
  });
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'carry.ring') playTone(ctx, noteHz(Number(e.data?.ring ?? 0) * 3), { pos: e.pos, dur: 0.8, gain: 0.5, bell: true });
    else if (name === 'carry.ring.done' || name === 'carry.ring.reverse') ctx.audio?.play('chime', { gain: 0.35 });
  });
  let t = 0;
  return {
    update(s: Readonly<PartState>, dt: number) {
      t += dt;
      const seq = (s.seq as number[] | undefined) ?? [];
      const next = seq.length && seq[0] === rings.length - 1 && rings.length > 1 ? rings.length - 1 - seq.length : seq.length;
      meshes.forEach((m, i) => {
        const done = seq.includes(i);
        (m.material as THREE.MeshBasicMaterial).color.setHex(done ? 0xfff0a0 : i === next ? (Math.sin(t * 5) > 0 ? 0x9fd0ff : 0x506080) : 0x506070);
      });
    },
    dispose() { off(); for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } },
  };
});

export type { EntitySpec };
