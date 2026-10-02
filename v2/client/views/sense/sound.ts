/**
 * 音の部品の描画（音は WebAudio の合成。音を消していても分かるよう、光の印も付ける）。
 * - senseFx chimes: 鐘を鳴らした・旋律で鳴った鐘が光り、その高さで鳴る
 * - senseFx gateMeter: 扉の脇の音量の目盛り（今の音量・開く所の線）。扉を調べたとき、マイクを使ってよいか尋ねる（使えなければ足音で代わり）。
 *     マイクの音は外へ送らない（音量だけをシミュレーションへ渡す）
 * - ghostSteps: もう一人の足音（自分の足音と同じ床の音）。離れて行った足音のノック
 * - paChase: 放送のチャイムと、意味の取れない声（スピーカーの所。近づくと止む）
 * - senseFx living: 壁の向こうの食器・テレビ・話し声（くぐもった音）
 * - senseFx silence: 区画 zone の中では、一切の音が消える
 * - senseFx echo: 音が光の輪として広がり、輪が当たった黒い仕切りの縁が光る（反響）
 * - senseFx pitch: 出口に近いほど高い音（鳴り続ける）
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { defineFx } from './fx.ts';
import { glowMaterial, onCue, playerInCell } from './common.ts';

defineFx('chimes', (spec, ctx) => {
  const ids = (spec.params.chimes as string[] | undefined) ?? [];
  const pos = (spec.params.positions as number[][] | undefined) ?? [];
  const pitches = (spec.params.pitches as number[] | undefined) ?? [];
  const mat = ids.map(() => glowMaterial(0xffe6a0, 0));
  const geo = new THREE.SphereGeometry(0.2, 14, 10);
  const glows = pos.map((p, i) => { const m = new THREE.Mesh(geo, mat[i]!); m.position.set(p[0]!, p[1]!, p[2]!); ctx.root.add(m); return m; });
  const level = ids.map(() => 0);
  const ring = (i: number, gain: number): void => {
    level[i] = 1;
    ctx.audio?.play('bell', { pos: pos[i] as [number, number, number], pitch: pitches[i] ?? 1, gain });
  };
  const offs = ids.map((id, i) => onCue(ctx, id, (name) => { if (name === 'chime.ring') ring(i, 1); }));
  const melody = ctx.sim.floor.entities.find((e) => e.cell === spec.cell && e.type === 'melody');
  if (melody) offs.push(onCue(ctx, melody.id, (name, e) => { if (name === 'melody.note') ring(Number(e.data?.note ?? 0), 0.7); }));
  return {
    update(_s, dt) {
      for (let i = 0; i < level.length; i++) { level[i] = Math.max(0, level[i]! - dt * 1.4); mat[i]!.opacity = 0.7 * level[i]!; }
    },
    dispose() { for (const o of offs) o(); for (const m of glows) m.removeFromParent(); for (const m of mat) m.dispose(); geo.dispose(); },
  };
});

defineFx('gateMeter', (spec, ctx) => {
  const gate = String(spec.params.gate);
  const door = String(spec.params.door);
  const pos = spec.params.pos as number[];
  const dir = Number(spec.params.dir);
  const threshold = Number(spec.params.level ?? 0.5);
  const quiet = spec.params.mode === 'quiet';
  const n = 8;
  const alongX = dir === 0 || dir === 2;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const bars = Array.from({ length: n }, (_v, i) => {
    const m = new THREE.Mesh(geo, glowMaterial(i / n >= threshold ? (quiet ? 0x60ff90 : 0xff5040) : (quiet ? 0xff7040 : 0x70ff90), 0.15));
    if (alongX) m.scale.set(0.16, 0.05, 0.005); else m.scale.set(0.005, 0.05, 0.16);
    m.position.set(pos[0]!, pos[1]! - 0.28 + i * 0.075, pos[2]!);
    ctx.root.add(m);
    return m;
  });
  let asked = false;
  const off = ctx.onEvent?.((e) => {
    // 扉を調べたとき、初めの 1 回だけマイクを尋ねる（ユーザーの操作の中で呼ぶ）
    if (e.type === 'interact' && e.entity === door && !asked && ctx.audio) { asked = true; void ctx.audio.requestMic(); }
  }) ?? (() => {});
  let opened = 0;
  return {
    update(_s, dt) {
      const lv = ctx.sim.outputOf(gate, 'level');
      const open = ctx.sim.outputOf(gate, 'open') > 0.5;
      opened = open ? Math.min(1, opened + dt) : 0;
      bars.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = open ? 0.6 : (i + 0.5) / n <= lv ? 0.9 : 0.12; });
    },
    dispose() { off(); for (const m of bars) { m.removeFromParent(); (m.material as THREE.Material).dispose(); } geo.dispose(); },
  };
});

defineView('ghostSteps', (spec, ctx) => {
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'ghost.step' && e.pos) ctx.audio?.footstep(undefined, 'walk', !!e.data?.crouch, undefined, e.pos as [number, number, number]);
    else if (name === 'ghost.knock' && e.pos) ctx.audio?.play('knockWall', { pos: e.pos as [number, number, number], gain: 1 });
  });
  return { update() {}, dispose() { off(); } };
});

defineView('paChase', (spec, ctx) => {
  const off = onCue(ctx, spec.id, (name, e) => {
    if (!e.pos) return;
    const p = e.pos as [number, number, number];
    if (name === 'pa.voice') { ctx.audio?.play('paChime', { pos: p, gain: 0.7 }); setTimeout(() => ctx.audio?.play('paVoice', { pos: p, gain: 0.9 }), 1500); }
    else if (name === 'pa.move') ctx.audio?.play('radioHiss', { pos: p, gain: 0.3 });
    else if (name === 'pa.found') ctx.audio?.play('whisper', { pos: p, gain: 0.8 });
  });
  return { update() {}, dispose() { off(); } };
});

defineFx('living', (spec, ctx) => {
  const pos = spec.params.pos as [number, number, number];
  let t = 0, k = 0;
  const kinds = ['dish', 'tv', 'tv', 'dish', 'knock'] as const;
  return {
    update(_s, dt) {
      if (!playerInCell(ctx, spec.cell)) return;
      t -= dt;
      if (t <= 0) {
        const kind = kinds[k++ % kinds.length]!;
        // 壁の向こう: 小さく、こもった音（残響を多め）
        ctx.audio?.play(kind, { pos, gain: kind === 'knock' ? 0.25 : 0.55, send: 0.8 });
        t = 2.2 + ((k * 7919) % 13) / 5;
      }
    },
    dispose() {},
  };
});

defineFx('silence', (spec, ctx) => {
  const z = spec.params.zone as { min: number[]; max: number[] };
  let on = false;
  return {
    update() {
      const p = ctx.sim.players[0];
      const inside = !!p && p.pos[0] >= z.min[0]! && p.pos[0] <= z.max[0]! && p.pos[2] >= z.min[2]! && p.pos[2] <= z.max[2]! && p.pos[1] >= z.min[1]! && p.pos[1] <= z.max[1]!;
      if (inside !== on) { on = inside; ctx.audio?.setDuck(`silence:${spec.id}`, inside ? 0.02 : 1, inside ? 0.6 : 0.3); }
    },
    dispose() { ctx.audio?.setDuck(`silence:${spec.id}`, 1); },
  };
});

/**
 * 反響: 黒い仕切りの縁（線）を、音の輪が通り過ぎる間だけ光らせる（輪の半径との距離で明るさ。輪はいくつも重なる）
 */
defineFx('echo', (spec, ctx) => {
  const walls = (spec.params.walls as number[][] | undefined) ?? [];
  const y = Number(spec.params.y ?? 0), h = Number(spec.params.h ?? 2.8);
  const drip = spec.params.drip as number[] | undefined;
  // 縁の線: 仕切りの箱の上下の縁と縦の角
  const pts: number[] = [];
  for (const w of walls) {
    const [x0, z0, x1, z1] = [w[0]!, w[1]!, w[2]!, w[3]!];
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (const yy of [y + 0.02, y + Math.min(h, 2.6)]) for (let i = 0; i < 4; i++) { const a = corners[i]!, b = corners[(i + 1) % 4]!; pts.push(a[0]!, yy, a[1]!, b[0]!, yy, b[1]!); }
    for (const c of corners) pts.push(c[0]!, y, c[1]!, c[0]!, y + Math.min(h, 2.6), c[1]!);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const MAX = 6;
  const uniforms = { centers: { value: Array.from({ length: MAX }, () => new THREE.Vector4(0, 0, 0, -100)) }, color: { value: new THREE.Color(0x9fd8ff) } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec4 centers[${MAX}]; uniform vec3 color; varying vec3 vW;
      void main(){ float a = 0.0; for (int i = 0; i < ${MAX}; i++) { vec4 c = centers[i]; if (c.w < 0.0) continue; float d = distance(vW, c.xyz); float band = 1.0 - smoothstep(0.0, 0.6, abs(d - c.w)); float fade = 1.0 - smoothstep(c.w * 0.4, 9.0, c.w); a += band * fade; } gl_FragColor = vec4(color * a, a); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  ctx.root.add(lines);
  // 床の上の光の輪（音が見える）
  const ringGeo = new THREE.RingGeometry(0.96, 1.0, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; r: number; max: number }[] = [];
  const pulses: { c: THREE.Vector3; r: number; max: number }[] = [];
  const pulse = (x: number, yy: number, z: number, max: number): void => {
    if (pulses.length >= MAX) pulses.shift();
    pulses.push({ c: new THREE.Vector3(x, yy, z), r: 0, max });
    const m = glowMaterial(0x9fd8ff, 0.5);
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.position.set(x, y + 0.02, z);
    ctx.root.add(mesh);
    rings.push({ mesh, mat: m, r: 0, max });
  };
  const off = ctx.onEvent?.((e) => {
    if (!playerInCell(ctx, spec.cell) || !e.pos) return;
    if (e.type === 'player.land') pulse(e.pos[0], e.pos[1] + 0.5, e.pos[2], 9);
    else if (e.type === 'player.stride' && !e.data?.crouch) pulse(e.pos[0], e.pos[1] + 0.5, e.pos[2], e.data?.rank === 'dash' ? 4.5 : 2.6);
    else if (e.type === 'cue' && e.data?.name === 'beacon' && drip) pulse(drip[0]!, drip[1]!, drip[2]!, 3.2);
  }) ?? (() => {});
  return {
    update(_s, dt) {
      for (const p of pulses) p.r += dt * 6.5;
      while (pulses.length && pulses[0]!.r > pulses[0]!.max + 1) pulses.shift();
      for (let i = 0; i < MAX; i++) { const p = pulses[i]; uniforms.centers.value[i]!.set(p ? p.c.x : 0, p ? p.c.y : 0, p ? p.c.z : 0, p ? p.r : -100); }
      for (const r of rings) { r.r += dt * 6.5; r.mesh.scale.setScalar(Math.max(0.01, r.r)); r.mat.opacity = 0.45 * Math.max(0, 1 - r.r / r.max); }
      for (let i = rings.length - 1; i >= 0; i--) if (rings[i]!.r > rings[i]!.max) { rings[i]!.mesh.removeFromParent(); rings[i]!.mat.dispose(); rings.splice(i, 1); }
    },
    dispose() { off(); lines.removeFromParent(); geo.dispose(); mat.dispose(); for (const r of rings) { r.mesh.removeFromParent(); r.mat.dispose(); } ringGeo.dispose(); },
  };
});

defineFx('pitch', (spec, ctx) => {
  const g = spec.params.grid as number[];
  const dist = (spec.params.dist as number[] | undefined) ?? [];
  const [x0, z0, cw, cd, nx, nz] = [g[0]!, g[1]!, g[2]!, g[3]!, g[4]!, g[5]!];
  const maxD = Math.max(1, ...dist);
  let drone: ReturnType<NonNullable<typeof ctx.audio>['drone']> | null = null;
  return {
    update() {
      const inside = playerInCell(ctx, spec.cell);
      if (!inside) { if (drone) { drone.stop(); drone = null; } return; }
      const p = ctx.sim.players[0]!;
      const i = Math.min(nx - 1, Math.max(0, Math.floor((p.pos[0] - x0) / cw))), k = Math.min(nz - 1, Math.max(0, Math.floor((p.pos[2] - z0) / cd)));
      const d = dist[k * nx + i] ?? maxD;
      // 出口に近いほど高い（遠い 110 Hz → 出口 440 Hz。1 マスごとに目で分かるほど変わる）
      const hz = 110 * Math.pow(4, 1 - d / maxD);
      if (!drone && ctx.audio?.context) drone = ctx.audio.drone(hz, 0.22);
      drone?.setFreq(hz, 0.4);
    },
    dispose() { drone?.stop(); },
  };
});
