/**
 * 部屋まるごとの異変の部品の描画（defineView）:
 * - oddRoom: params.fx の効果（fx.ts・labels.ts）を 1 つずつ作って動かす
 * - oddTrail: 雪・砂に残る足跡（部品の状態の足跡の列を、床の上の平らな跡にする）
 * - oddWaves: 寄せては返す波の白い泡の帯（部品の surge で浜へ寄る）
 * - oddClock: 部屋の中だけ進む時刻の、窓の空の色・差し込む光の筋・画面の色（朝 → 昼 → 夕 → 夜）
 * - oddTouch: 触れたときの音
 */
import * as THREE from 'three';
import { hashAll } from '../../../core/math/rng.ts';
import type { Json } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { createFx, type Fx } from './fx.ts';
import './labels.ts';
import { aabbOf, cloudTexture, eyeOf, glowMaterial, inside, num } from './util.ts';

defineView('oddRoom', (spec, ctx) => {
  const room = aabbOf(spec.params.aabb);
  const list = (spec.params.fx as { [k: string]: Json }[] | undefined) ?? [];
  const rects = (spec.params.rects as { x0: number; z0: number; x1: number; z1: number }[] | undefined) ?? [{ x0: room.min[0], z0: room.min[2], x1: room.max[0], z1: room.max[2] }];
  const fx: Fx[] = [];
  list.forEach((p, i) => {
    const f = createFx(String(p.kind), { p, ctx, room, spec, seed: hashAll(spec.id, i), key: `${spec.id}#${i}`, rects });
    if (f) fx.push(f);
  });
  if (!fx.length) return null;
  return {
    update(s, dt) { for (const f of fx) f.update(dt, s); },
    dispose() { for (const f of fx) f.dispose(); },
  };
});

defineView('oddTrail', (spec, ctx) => {
  const max = Math.max(4, Math.round(num(spec.params.max, 160)));
  const y = num(spec.params.y, 0) + 0.004;
  const geo = new THREE.CircleGeometry(0.5, 10);
  geo.rotateX(-Math.PI / 2);
  const mat = glowMaterial(num(spec.params.color, 0x8d97a6), num(spec.params.opacity, 0.5));
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  mesh.count = 0;
  ctx.root.add(mesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(0.1, 1, 0.24);
  let shown = -1;
  return {
    update(s) {
      const prints = (s.prints as number[] | undefined) ?? [];
      const n = Math.min(max, Math.floor(prints.length / 4));
      // 足跡の列は 1 歩ごとに伸びる（古い物から消える）。数か最後の位置が変わったら置き直す
      const key = n * 100000 + Math.round((prints[prints.length - 4] ?? 0) * 100);
      if (key === shown) return;
      shown = key;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        pos.set(prints[o]!, y, prints[o + 1]!);
        q.setFromAxisAngle(up, prints[o + 2]!);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

defineView('oddWaves', (spec, ctx) => {
  const sea = spec.params.sea as { x0: number; z0: number; x1: number; z1: number } | undefined;
  if (!sea) return null;
  const dir = (spec.params.dir as number[] | undefined) ?? [0, 1];
  const reach = num(spec.params.reach, 1.2);
  const y = num(spec.params.y, 0) + 0.01;
  const alongX = Math.abs(dir[2] ?? dir[1] ?? 0) >= Math.abs(dir[0] ?? 0);
  const len = alongX ? sea.x1 - sea.x0 : sea.z1 - sea.z0;
  const geo = new THREE.PlaneGeometry(alongX ? len : 0.5, alongX ? 0.5 : len);
  geo.rotateX(-Math.PI / 2);
  const tex = cloudTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(alongX ? len / 1.5 : 1, alongX ? 1 : len / 1.5);
  const mat = glowMaterial(0xf4f8f8, 0.75, { map: tex });
  const foam = new THREE.Mesh(geo, mat);
  ctx.root.add(foam);
  const dx = dir[0] ?? 0, dz = dir[2] ?? dir[1] ?? 0;
  // 波打ち際（海の浜の側の縁）
  const shoreX = dx > 0 ? sea.x1 : dx < 0 ? sea.x0 : (sea.x0 + sea.x1) / 2;
  const shoreZ = dz > 0 ? sea.z1 : dz < 0 ? sea.z0 : (sea.z0 + sea.z1) / 2;
  let t = 0;
  return {
    update(s, dt) {
      t += dt;
      const k = typeof s.t === 'number' ? Math.max(0, Math.sin(Math.min(1, (s.t as number) / num(spec.params.surge, 2.2)) * Math.PI)) : 0;
      foam.position.set(shoreX + dx * k * reach, y, shoreZ + dz * k * reach);
      mat.opacity = 0.35 + 0.45 * k;
      tex.offset.set(t * 0.03, t * 0.02);
    },
    dispose() { foam.removeFromParent(); geo.dispose(); mat.dispose(); tex.dispose(); },
  };
});

/** 1 日の中の位置 → 空の色（朝・昼・夕・夜） */
const SKY: [number, number][] = [[0, 0xc7d9ea], [0.25, 0x8ec0f0], [0.45, 0xf2b070], [0.53, 0xe0704a], [0.62, 0x3a3570], [0.72, 0x070b1e], [0.86, 0x1a1f3e], [0.93, 0x9a8aa8], [1, 0xc7d9ea]];
export function skyColor(phase: number, out = new THREE.Color()): THREE.Color {
  const p = ((phase % 1) + 1) % 1;
  for (let i = 1; i < SKY.length; i++) {
    const [p1, c1] = SKY[i]!, [p0, c0] = SKY[i - 1]!;
    if (p <= p1) return out.set(c0).lerp(new THREE.Color(c1), (p - p0) / (p1 - p0));
  }
  return out.set(SKY[0]![1]);
}

defineView('oddClock', (spec, ctx) => {
  const room = aabbOf(spec.params.aabb);
  const panes = (spec.params.panes as { min: number[]; max: number[]; dir: number }[] | undefined) ?? [];
  const meshes: THREE.Mesh[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const paneMat = new THREE.MeshBasicMaterial({ color: 0xc7d9ea, fog: false });
  // 差し込む光の筋（窓から床へ斜めに。日の高さで傾き、夜は消える）
  const beamMat = glowMaterial(0xfff0d0, 0.0, { additive: true });
  const beams: { m: THREE.Mesh; c: THREE.Vector3; dir: number; h: number }[] = [];
  for (const pn of panes) {
    const sky = pn.dir < 0;
    const w = sky ? pn.max[0]! - pn.min[0]! : Math.max(pn.max[0]! - pn.min[0]!, pn.max[2]! - pn.min[2]!), h = sky ? pn.max[2]! - pn.min[2]! : pn.max[1]! - pn.min[1]!;
    const g = new THREE.PlaneGeometry(w, h);
    geos.push(g);
    const m = new THREE.Mesh(g, paneMat);
    const c = new THREE.Vector3((pn.min[0]! + pn.max[0]!) / 2, (pn.min[1]! + pn.max[1]!) / 2, (pn.min[2]! + pn.max[2]!) / 2);
    m.position.copy(c);
    // 板は壁の室内面に沿う（dir は壁の外向き）。天窓（dir -1）は下を向く
    if (sky) m.rotation.x = Math.PI / 2;
    else m.rotation.y = pn.dir === 0 ? Math.PI : pn.dir === 1 ? -Math.PI / 2 : pn.dir === 2 ? 0 : Math.PI / 2;
    ctx.root.add(m);
    meshes.push(m);
    const bg = new THREE.PlaneGeometry(w * 0.9, 3.2);
    bg.translate(0, -1.6, 0);
    geos.push(bg);
    const b = new THREE.Mesh(bg, beamMat);
    b.position.copy(c);
    ctx.root.add(b);
    beams.push({ m: b, c, dir: pn.dir, h });
  }
  const key = `${spec.id}#sky`;
  const clockRects = spec.params.rects as { x0: number; z0: number; x1: number; z1: number }[] | undefined;
  const col = new THREE.Color();
  return {
    update(s) {
      const phase = typeof spec.params.daySec === 'number' ? ((s.t as number) / (spec.params.daySec as number)) % 1 : 0;
      skyColor(phase, col);
      paneMat.color.copy(col);
      const sun = ctx.sim.outputOf(spec.id, 'level');
      beamMat.opacity = 0.12 * sun;
      // 日の高さ: 朝と夕は低く（筋が寝る）、昼は高い
      const tilt = 0.35 + 0.9 * Math.sin(Math.min(1, phase / 0.5) * Math.PI);
      for (const b of beams) {
        // 天窓の筋は真下へ（日の高さで少し傾く）、壁の窓の筋は窓から床へ斜めに
        if (b.dir < 0) b.m.rotation.set(0, 0, (phase < 0.25 ? 1 : -1) * (1.35 - Math.min(1.35, tilt)) * 0.4);
        else {
          b.m.rotation.set(0, b.dir === 0 ? Math.PI : b.dir === 1 ? -Math.PI / 2 : b.dir === 2 ? 0 : Math.PI / 2, 0);
          b.m.rotateX(-(Math.PI / 2 - Math.min(1.35, tilt)));
        }
        b.m.visible = sun > 0.02;
      }
      const e = eyeOf(ctx);
      if (inside(room, e, 0.05) && (!clockRects || clockRects.some((q) => e!.x >= q.x0 - 0.05 && e!.x <= q.x1 + 0.05 && e!.z >= q.z0 - 0.05 && e!.z <= q.z1 + 0.05))) {
        // 画面: 夕方は橙、夜は青く暗く
        const dusk = Math.max(0, 1 - Math.abs(phase - 0.5) / 0.09);
        const night = phase > 0.6 && phase < 0.9 ? Math.min(1, (phase - 0.6) / 0.06, (0.9 - phase) / 0.06) : 0;
        ctx.postfx?.setRoomGrade(key, { tint: [1 + 0.2 * dusk - 0.15 * night, 1 - 0.05 * dusk - 0.08 * night, 1 - 0.25 * dusk + 0.12 * night], saturation: 1 - 0.3 * night, vignette: 0.25 * night });
      }
    },
    dispose() { for (const m of meshes) m.removeFromParent(); for (const b of beams) b.m.removeFromParent(); for (const g of geos) g.dispose(); paneMat.dispose(); beamMat.dispose(); ctx.postfx?.setRoomGrade(key, null); },
  };
});

defineView('oddTouch', (spec, ctx) => {
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id) return;
    if (e.data?.name === 'odd.touch') ctx.audio?.play('chime', { ...(e.pos ? { pos: e.pos } : {}), gain: 0.5 });
    else if (e.data?.name === 'odd.touch.again') ctx.audio?.play('beep', { ...(e.pos ? { pos: e.pos } : {}), gain: 0.4 });
  });
  return { update() {}, dispose() { off?.(); } };
});
