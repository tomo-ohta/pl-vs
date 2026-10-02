/**
 * 床の升目の描画: chimeFloor（踏んだ升目・見せている升目が光って鳴る。解けると全部が光って和音）・avoidFloor（始まりで印が光る、
 * 赤を踏むと赤く明滅して低い音、着くと目当てが光る）・visitOrder（柱の上の灯り。正しい順に訪れた印が点いていく）。
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { disposeMesh, glowMaterial, noise, onCue, tone } from './util.ts';

/** 升目の上に重ねる光（InstancedMesh。強さは不透明度ではなく大きさで出す） */
function tileGlow(tiles: number[][], y: number, color: number): { mesh: THREE.InstancedMesh; set(i: number, k: number): void; flush(): void; dispose(): void } {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = glowMaterial(color, 0.55);
  mat.blending = THREE.AdditiveBlending;
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, tiles.length));
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  const set = (i: number, k: number): void => {
    const r = tiles[i]!;
    const w = (r[2]! - r[0]!) * 0.86 * k, d = (r[3]! - r[1]!) * 0.86 * k;
    m4.makeScale(Math.max(1e-4, w), 1, Math.max(1e-4, d));
    m4.setPosition((r[0]! + r[2]!) / 2, y + 0.012, (r[1]! + r[3]!) / 2);
    mesh.setMatrixAt(i, m4);
  };
  for (let i = 0; i < tiles.length; i++) set(i, 0);
  return { mesh, set, flush: () => { mesh.instanceMatrix.needsUpdate = true; }, dispose: () => { mesh.removeFromParent(); geo.dispose(); mat.dispose(); } };
}

defineView('chimeFloor', (spec, ctx) => {
  const tiles = (spec.params.tiles as number[][] | undefined) ?? [];
  const notes = (spec.params.notes as number[] | undefined) ?? [];
  const y = typeof spec.params.y === 'number' ? spec.params.y : 0;
  const glow = tileGlow(tiles, y, 0xbfe6ff);
  ctx.root.add(glow.mesh);
  const level = new Float32Array(tiles.length);
  let solvedT = -1;
  const off = onCue(ctx, spec.id, (name, at, data) => {
    const i = Number(data.tile ?? -1);
    if (name === 'chime.demo' || name === 'chime.step') {
      if (i >= 0) level[i] = 1;
      const ok = name === 'chime.demo' || data.ok !== false;
      tone(ctx.audio, ok ? (notes[i] ?? 440) : 110, { pos: at, gain: ok ? 0.14 : 0.1, dur: ok ? 1.1 : 0.4, type: ok ? 'sine' : 'square', partials: ok ? [[1, 1], [2, 0.3], [3, 0.12]] : [[1, 1]] });
    } else if (name === 'chime.solved') {
      solvedT = 0;
      for (const [k, f] of [261.6, 329.6, 392, 523.2].entries()) tone(ctx.audio, f, { pos: at, gain: 0.1, dur: 2.4, delay: k * 0.08, partials: [[1, 1], [2, 0.25]] });
    }
  });
  return {
    update(s, dt) {
      const lit = Number(s.lit ?? -1);
      for (let i = 0; i < tiles.length; i++) {
        if (i === lit) level[i] = Math.max(level[i]!, 0.9);
        level[i] = Math.max(0, level[i]! - dt * 1.6);
        if (solvedT >= 0) level[i] = Math.max(level[i]!, 0.6 + 0.4 * Math.sin(solvedT * 4 + i));
        glow.set(i, level[i]!);
      }
      if (solvedT >= 0) { solvedT += dt; if (solvedT > 3) solvedT = -1; }
      glow.flush();
    },
    dispose() { off(); glow.dispose(); },
  };
});

defineView('avoidFloor', (spec, ctx) => {
  const tiles = (spec.params.tiles as number[][] | undefined) ?? [];
  const y = typeof spec.params.y === 'number' ? spec.params.y : 0;
  const red = tileGlow(tiles, y, 0xff2a1a);
  const green = tileGlow(tiles, y, 0x7dff9a);
  ctx.root.add(red.mesh, green.mesh);
  const start = Number(spec.params.start ?? 0), goal = Number(spec.params.goal ?? 0);
  let failT = -1, failTile = -1, doneT = -1;
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'avoid.fail') { failT = 0; failTile = Number(data.tile ?? -1); tone(ctx.audio, 90, { pos: at, gain: 0.16, dur: 0.6, type: 'sawtooth', freqTo: 60 }); }
    else if (name === 'avoid.arm') tone(ctx.audio, 660, { pos: at, gain: 0.08, dur: 0.3 });
    else if (name === 'avoid.step') noise(ctx.audio, { pos: at, gain: 0.03, dur: 0.08, highpass: 2000 });
    else if (name === 'avoid.done') { doneT = 0; tone(ctx.audio, 523, { pos: at, gain: 0.12, dur: 1.4 }); tone(ctx.audio, 784, { pos: at, gain: 0.1, dur: 1.6, delay: 0.15 }); }
  });
  let t = 0;
  return {
    update(s, dt) {
      t += dt;
      const armed = Number(s.armed ?? 0) > 0;
      for (let i = 0; i < tiles.length; i++) { red.set(i, 0); green.set(i, 0); }
      green.set(start, armed ? 0.7 + 0.2 * Math.sin(t * 5) : 0.3);
      green.set(goal, 0.4 + 0.3 * Math.sin(t * 2));
      if (failT >= 0) { failT += dt; if (failTile >= 0) red.set(failTile, Math.max(0, 1 - failT) * (Math.sin(failT * 30) > 0 ? 1 : 0.3)); if (failT > 1) failT = -1; }
      if (doneT >= 0) { doneT += dt; green.set(goal, 1); if (doneT > 2) doneT = -1; }
      red.flush(); green.flush();
    },
    dispose() { off(); red.dispose(); green.dispose(); },
  };
});

defineView('visitOrder', (spec, ctx) => {
  const posts = (spec.params.posts as number[][] | undefined) ?? [];
  const colors = (spec.params.colors as number[] | undefined) ?? [];
  const order = (spec.params.order as number[] | undefined) ?? [];
  const caps = posts.map((p, i) => {
    const mat = glowMaterial(colors[i] ?? 0xffffff);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), mat);
    m.position.set(p[0]!, p[1]! + 0.12, p[2]!);
    ctx.root.add(m);
    return { m, mat, base: new THREE.Color(colors[i] ?? 0xffffff) };
  });
  const off = onCue(ctx, spec.id, (name, at, data) => {
    if (name === 'visit.ok') tone(ctx.audio, 392 * Math.pow(1.26, Number(data.n ?? 1) - 1), { pos: at, gain: 0.12, dur: 0.9 });
    else if (name === 'visit.wrong') tone(ctx.audio, 120, { pos: at, gain: 0.12, dur: 0.5, type: 'square' });
    else if (name === 'visit.done') for (const [k, f] of [392, 494, 587, 784].entries()) tone(ctx.audio, f, { pos: at, gain: 0.08, dur: 2, delay: k * 0.1 });
  });
  const dim = new THREE.Color(0x222222);
  return {
    update(s) {
      const prog = Number(s.prog ?? 0), done = Number(s.done ?? 0) > 0;
      caps.forEach((c, i) => {
        const on = done || order.slice(0, prog).includes(i);
        c.mat.color.copy(on ? c.base : dim).lerp(c.base, on ? 0 : 0.18);
      });
    },
    dispose() { off(); for (const c of caps) disposeMesh(c.m); },
  };
});

