/**
 * パズル その 2 の描画: 影絵の影（灯りから切り抜きの角を壁へ写した四角）・光の筋（升目の折れ線）と壁の目・天秤の竿・
 * 迷路の模型（机の上の小さな壁と玉と穴）・踏む升目の灯り（足跡の模様・ピアノの床の音）
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import { defineView } from '../views.ts';
import { lightAt, noteHz, onCue, Parts, playTone } from './common.ts';
import { DECOR } from './puzzle.ts';

// ---------------------------------------------------------------- 天秤の竿（carryDecor の view 'balance'）
DECOR.balance = (spec, ctx, root, P) => {
  // 竿は壁と平行（root は壁の向きに回っている。局所の x が壁に沿う）
  const beam = new THREE.Group();
  root.add(beam);
  P.box([1.8, 0.05, 0.05], 'goldTrim', [0, 0.05, 0], beam);
  for (const sg of [-1, 1]) P.box([0.01, 0.4, 0.01], 'metalDark', [sg * 0.85, -0.15, 0], beam);
  P.box([0.02, 0.28, 0.02], 'neonRed', [0, 0.2, 0], beam);
  const L = String(spec.params.left ?? ''), R = String(spec.params.right ?? '');
  // 局所の +x がどちらの皿か（世界で右の皿の位置と比べる）
  const right = ctx.sim.floor.entities.find((e) => e.id === R)?.params.region as { min: number[]; max: number[] } | undefined;
  const at = spec.params.at as number[];
  const lx = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y);
  const sgn = right ? Math.sign(((right.min[0]! + right.max[0]!) / 2 - at[0]!) * lx.x + ((right.min[2]! + right.max[2]!) / 2 - at[2]!) * lx.z) || 1 : 1;
  let ang = 0;
  return {
    update(dt: number) {
      const want = Math.max(-0.3, Math.min(0.3, (ctx.sim.outputOf(R, 'weight') - ctx.sim.outputOf(L, 'weight')) * 0.07)) * sgn;
      ang += (want - ang) * Math.min(1, dt * 3);
      beam.rotation.z = -ang;
    },
    dispose() {},
  };
};

// ---------------------------------------------------------------- 影絵の影（carryDecor の view 'shadow'）: 灯りから切り抜きの 4 隅を壁の面へ写す
DECOR.shadow = (spec, ctx) => {
  const lamp = spec.params.lamp as number[];
  const face = spec.params.face as number[];
  const d = Number(spec.params.wall ?? 0);
  const n: [number, number, number] = ([[0, 0, -1], [-1, 0, 0], [0, 0, 1], [1, 0, 0]] as [number, number, number][])[d]!;
  const item = String(spec.params.item ?? '');
  const e = ctx.sim.floor.entities.find((x) => x.id === item);
  const half = (e?.params.half as number[] | undefined) ?? [0.2, 0.4, 0.02];
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(12);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mat = new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  ctx.root.add(mesh);
  const c = new THREE.Vector3(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  const planeD = (face[0]! - lamp[0]!) * n[0] + (face[1]! - lamp[1]!) * n[1] + (face[2]! - lamp[2]!) * n[2];
  return {
    update() {
      const p = ctx.sim.stateOf(item)?.poses as number[] | undefined;
      if (!p) { mesh.visible = false; return; }
      c.set(p[0]!, p[1]!, p[2]!);
      q.set(p[3]!, p[4]!, p[5]!, p[6]!);
      let ok = true;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => {
        v.set(sx! * half[0]!, sy! * half[1]!, 0).applyQuaternion(q).add(c);
        const dd = (v.x - lamp[0]!) * n[0] + (v.y - lamp[1]!) * n[1] + (v.z - lamp[2]!) * n[2];
        // 灯りより壁の側で、壁より手前のときだけ
        if (Math.abs(dd) < 1e-4 || planeD / dd < 1) { ok = false; return; }
        const t = planeD / dd;
        pos[i * 3] = lamp[0]! + (v.x - lamp[0]!) * t - n[0] * 0.004;
        pos[i * 3 + 1] = lamp[1]! + (v.y - lamp[1]!) * t;
        pos[i * 3 + 2] = lamp[2]! + (v.z - lamp[2]!) * t - n[2] * 0.004;
      });
      mesh.visible = ok;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      geo.computeBoundingSphere();
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
};

// ---------------------------------------------------------------- 光の筋
defineView('beamGrid', (spec, ctx) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.85 });
  const unit = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  unit.rotateX(Math.PI / 2);
  const segs: THREE.Mesh[] = [];
  const eyeAt = spec.params.eye as number[] | undefined;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x302a20 });
  const eyeGeo = new THREE.CircleGeometry(0.1, 18);
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  if (eyeAt) { eye.position.set(eyeAt[0]!, eyeAt[1]!, eyeAt[2]!); eye.lookAt(eyeAt[0]! * 2, eyeAt[1]!, eyeAt[2]! * 2); ctx.root.add(eye); }
  let key = '';
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.beam.hit') ctx.audio?.play('chime', { pos: e.pos, gain: 0.3 }); });
  return {
    update(s: Readonly<PartState>) {
      const path = (s.path as number[] | undefined) ?? [];
      const k = path.map((v) => v.toFixed(2)).join(',');
      eyeMat.color.setHex(s.hit ? 0xfff2a0 : 0x302a20);
      if (k === key) return;
      key = k;
      for (const m of segs) m.removeFromParent();
      segs.length = 0;
      for (let i = 3; i + 2 < path.length; i += 3) {
        a.set(path[i - 3]!, path[i - 2]!, path[i - 1]!);
        b.set(path[i]!, path[i + 1]!, path[i + 2]!);
        const l = a.distanceTo(b);
        if (l < 1e-3) continue;
        const m = new THREE.Mesh(unit, mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.scale.set(1, 1, l);
        m.lookAt(b);
        ctx.root.add(m);
        segs.push(m);
      }
    },
    dispose() { off(); for (const m of segs) m.removeFromParent(); eye.removeFromParent(); unit.dispose(); mat.dispose(); eyeGeo.dispose(); eyeMat.dispose(); },
  };
});

// ---------------------------------------------------------------- 迷路の模型
defineView('marbleModel', (spec, ctx) => {
  const t = spec.params.table as { min: number[]; max: number[] };
  const nu = Number(spec.params.nx), nv = Number(spec.params.nz);
  const open = new Set((spec.params.open as string[] | undefined) ?? []);
  const ax = (spec.params.axes as number[] | undefined) ?? [1, 0, 0, 1];
  const hole = Number(spec.params.hole ?? -1);
  const cx = (t.min[0]! + t.max[0]!) / 2, cz = (t.min[2]! + t.max[2]!) / 2, top = t.max[1]!;
  // 升目の大きさ: 机の上に収まるように（+i の向きの机の長さ / nu と、+k の向きの長さ / nv の小さい方）
  const lenAlong = (dx: number, dz: number): number => Math.abs(dx) * (t.max[0]! - t.min[0]!) + Math.abs(dz) * (t.max[2]! - t.min[2]!);
  const cs = Math.min(lenAlong(ax[0]!, ax[1]!) / nu, lenAlong(ax[2]!, ax[3]!) / nv) * 0.9;
  const P = new Parts(ctx);
  const model = new THREE.Group();
  model.position.set(cx, top, cz);
  P.group.add(model);
  const local = (i: number, k: number): [number, number] => [((i - (nu - 1) / 2) * ax[0]! + (k - (nv - 1) / 2) * ax[2]!) * cs, ((i - (nu - 1) / 2) * ax[1]! + (k - (nv - 1) / 2) * ax[3]!) * cs];
  // 板
  const W = Math.abs(ax[0]!) * nu * cs + Math.abs(ax[2]!) * nv * cs, D = Math.abs(ax[1]!) * nu * cs + Math.abs(ax[3]!) * nv * cs;
  P.box([W + 0.04, 0.03, D + 0.04], 'woodPanel', [0, 0.015, 0], model);
  const wallH = 0.05, wt = 0.012;
  const wall = (x: number, z: number, along: 'x' | 'z'): void => { P.box(along === 'x' ? [cs + wt, wallH, wt] : [wt, wallH, cs + wt], 'paintWhite', [x, 0.03 + wallH / 2, z], model); };
  // 閉じた辺の壁（升目の境目）と外周
  for (let k = 0; k < nv; k++) for (let i = 0; i < nu; i++) {
    const c = k * nu + i;
    const [x, z] = local(i, k);
    const nb: [number, number, number][] = [[1, 0, c + 1], [0, 1, c + nu], [-1, 0, c - 1], [0, -1, c - nu]];
    for (const [di, dk, n] of nb) {
      const ii = i + di, kk = k + dk;
      const inside = ii >= 0 && kk >= 0 && ii < nu && kk < nv;
      if (inside && (di < 0 || dk < 0)) continue;
      if (inside && open.has(c < n ? `${c}-${n}` : `${n}-${c}`)) continue;
      const wx = x + (di * ax[0]! + dk * ax[2]!) * cs / 2, wz = z + (di * ax[1]! + dk * ax[3]!) * cs / 2;
      const alongX = Math.abs(di * ax[0]! + dk * ax[2]!) < 0.5;
      wall(wx, wz, alongX ? 'x' : 'z');
    }
  }
  // 穴
  const [hx, hz] = local(hole % nu, Math.floor(hole / nu));
  const holeM = new THREE.Mesh(new THREE.CircleGeometry(cs * 0.28, 16), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  holeM.rotation.x = -Math.PI / 2;
  holeM.position.set(hx, 0.032, hz);
  model.add(holeM);
  // 玉
  const ball = P.add(new THREE.SphereGeometry(cs * 0.2, 14, 10), 'stainless', [0, 0, 0], model);
  ctx.root.add(P.group);
  P.relight(lightAt(ctx, [cx, top + 0.3, cz]));
  const off = onCue(ctx, spec.id, (name, e) => { if (name === 'carry.marble.hole') { ctx.audio?.play('clank', { pos: e.pos, gain: 0.2 }); ctx.audio?.play('chime', { pos: e.pos, gain: 0.2 }); } });
  let tx = 0, tz = 0;
  return {
    update(s: Readonly<PartState>, dt: number) {
      const wait = Number(s.wait ?? 0);
      const [x, z] = local(Number(s.x ?? 0), Number(s.z ?? 0));
      ball.position.set(x, 0.03 + cs * 0.2 - (wait > 0 ? Math.min(0.06, (1.2 - wait) * 0.2) : 0), z);
      ball.visible = !(wait > 0 && wait < 0.9);
      // 傾き（見た目）
      const tilt = Number(s.tilt ?? -1);
      const g: [number, number] = tilt === 0 ? [ax[0]!, ax[1]!] : tilt === 1 ? [ax[2]!, ax[3]!] : tilt === 2 ? [-ax[0]!, -ax[1]!] : tilt === 3 ? [-ax[2]!, -ax[3]!] : [0, 0];
      tx += (g[0] * 0.08 - tx) * Math.min(1, dt * 4);
      tz += (g[1] * 0.08 - tz) * Math.min(1, dt * 4);
      model.rotation.set(tz, 0, -tx);
    },
    dispose() { off(); P.dispose(); holeM.geometry.dispose(); (holeM.material as THREE.Material).dispose(); },
  };
});

// ---------------------------------------------------------------- 踏む升目
defineView('stepPattern', (spec, ctx) => {
  const o = spec.params.origin as number[];
  const C = Number(spec.params.cell ?? 0.8), nx = Number(spec.params.nx ?? 4), nz = Number(spec.params.nz ?? 4);
  const pattern = (spec.params.pattern as number[] | undefined) ?? [];
  const notes = spec.params.notes as number[] | undefined;
  const geo = new THREE.PlaneGeometry(C * 0.86, C * 0.86);
  geo.rotateX(-Math.PI / 2);
  const mats: THREE.MeshBasicMaterial[] = [];
  const meshes: THREE.Mesh[] = [];
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const m = new THREE.MeshBasicMaterial({ color: notes ? (((i + k) % 2) ? 0xf0f0e8 : 0x20201c) : 0xfff0b0, transparent: true, opacity: notes ? 0.0 : 0, depthWrite: false });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(o[0]! + (i + 0.5) * C, o[1]! + 0.012, o[2]! + (k + 0.5) * C);
    ctx.root.add(mesh);
    mats.push(m);
    meshes.push(mesh);
  }
  let flash = 0, wrong = 0;
  const pressed = new Map<number, number>();
  const base = Number(spec.params.baseNote ?? 0);
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'carry.note') { const c = Number(e.data?.cell ?? -1); pressed.set(c, 0.4); playTone(ctx, noteHz(base + Number(e.data?.note ?? 0)), { pos: e.pos, dur: 1.2, gain: 0.7 }); }
    else if (name === 'carry.step.ok') ctx.audio?.play('beep', { gain: 0.1 });
    else if (name === 'carry.step.wrong') { wrong = 0.5; ctx.audio?.play('clank', { gain: 0.15 }); }
    else if (name === 'carry.step.done') { flash = 1.5; ctx.audio?.play('chime', { gain: 0.3 }); }
  });
  return {
    update(s: Readonly<PartState>, dt: number) {
      const prog = Number(s.prog ?? 0);
      wrong = Math.max(0, wrong - dt);
      flash = Math.max(0, flash - dt);
      for (const [c, t] of pressed) { if (t - dt <= 0) pressed.delete(c); else pressed.set(c, t - dt); }
      mats.forEach((m, c) => {
        if (notes) { m.opacity = pressed.has(c) ? 0.55 : 0.0; m.color.setHex(0xfff0b0); return; }
        const j = pattern.indexOf(c);
        const lit = s.done === 1 || (j >= 0 && j < prog);
        m.color.setHex(wrong > 0 ? 0xff5040 : 0xfff0b0);
        m.opacity = wrong > 0 ? 0.25 : lit ? (flash > 0 ? 0.6 : 0.35) : 0;
      });
    },
    dispose() { off(); for (const m of meshes) m.removeFromParent(); geo.dispose(); for (const m of mats) m.dispose(); },
  };
});
