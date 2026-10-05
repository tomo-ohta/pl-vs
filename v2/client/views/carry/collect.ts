/**
 * 持って待つ枠（carrySensor）の灯りと、触れて集める物（collectSet: 本を集める）の描画。
 * - 枠: 床の枠の中が、荷物を持って立っている間だけだんだん明るくなる（progress）。開くと灯りが残る
 * - 本: 床に散らばった本。拾った本は床から消えて、画面の左下（腕の中）に積み上がる。全部そろうと返却台の灯りがつく
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { buildShape } from './items.ts';
import { lightAt, onCue, Parts } from './common.ts';

defineView('carrySensor', (spec, ctx) => {
  const g = spec.params.glow as { min: number[]; max: number[] } | undefined;
  if (!g) return null;
  const geo = new THREE.PlaneGeometry(g.max[0]! - g.min[0]!, g.max[2]! - g.min[2]!);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((g.min[0]! + g.max[0]!) / 2, g.min[1]! + 0.012, (g.min[2]! + g.max[2]!) / 2);
  ctx.root.add(mesh);
  let beep = 0;
  return {
    update(s: Readonly<PartState>, dt: number) {
      const sec = typeof spec.params.sec === 'number' ? spec.params.sec : 1.5;
      const prog = Math.min(1, Math.max(Number(s.tm ?? 0), Number(s.to ?? 0)) / sec);
      const done = s.m === 1 || s.o === 1;
      mat.opacity = done ? 0.5 : prog * 0.45;
      mat.color.setHex(s.o === 1 && s.m !== 1 ? 0xa0c8ff : 0xffe9a0);
      // 満ちていく間の音（1 秒に 2 回）
      if (prog > 0 && prog < 1 && !done) {
        beep -= dt;
        if (beep <= 0) { beep = 0.5; ctx.audio?.play('beep', { pos: [mesh.position.x, mesh.position.y + 1, mesh.position.z], gain: 0.15 }); }
      } else beep = 0;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

defineView('collectSet', (spec, ctx) => {
  const items = (spec.params.items as number[][] | undefined) ?? [];
  const mats = (spec.params.mats as MatId[] | undefined) ?? [];
  const kind = String(spec.params.kind ?? 'book');
  const half: [number, number, number] = kind === 'book' ? [0.11, 0.025, 0.15] : [0.1, 0.1, 0.1];
  const floorParts: Parts[] = [];
  items.forEach((it, i) => {
    const P = new Parts(ctx);
    buildShape(P, kind, half, mats[i] ?? 'plasticRed', {});
    P.group.position.set(it[0]!, it[1]! + half[1], it[2]!);
    P.group.rotation.y = it[3] ?? 0;
    ctx.root.add(P.group);
    P.relight(lightAt(ctx, [it[0]!, it[1]! + 0.3, it[2]!]));
    floorParts.push(P);
  });
  // 腕の中の本（カメラに付ける）
  const hand = new THREE.Group();
  const handParts: Parts[] = [];
  if (ctx.camera) { ctx.camera.add(hand); hand.position.set(-0.24, -0.34, -0.55); hand.rotation.set(0.25, 0.3, 0); }
  // 返却台の灯り（光る笠。点光源は足さない: 灯りの数が変わると材質が作り直される）
  const lampAt = spec.params.lamp as number[] | undefined;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3a3226 });
  const lampGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.12, 14, 1, true);
  const lamp = lampAt ? new THREE.Mesh(lampGeo, glowMat) : null;
  if (lamp && lampAt) { lamp.position.set(lampAt[0]!, lampAt[1]! + 0.32, lampAt[2]!); ctx.root.add(lamp); }
  let shown = -1;
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name === 'carry.collect') ctx.audio?.play('pageTurn', { pos: e.pos, gain: 0.35 });
    else if (name === 'carry.collect.all' || name === 'carry.collect.none') ctx.audio?.play('chime', { pos: e.pos, gain: 0.35 });
  });
  return {
    update(s: Readonly<PartState>) {
      const got = (s.got as number[] | undefined) ?? [];
      floorParts.forEach((P, i) => { P.group.visible = !got[i]; });
      const n = Number(s.count ?? 0);
      if (n !== shown) {
        // 腕の中に n 冊（最大 10 冊まで描く）
        while (handParts.length < Math.min(10, n)) {
          const i = handParts.length;
          const P = new Parts(ctx);
          buildShape(P, kind, half, mats[i] ?? 'plasticRed', {});
          P.group.position.set((i % 2) * 0.01, i * half[1] * 2.05, 0);
          P.group.rotation.y = (i % 3) * 0.08;
          P.relight([0.7, 0.68, 0.62]);
          hand.add(P.group);
          handParts.push(P);
        }
        shown = n;
      }
      glowMat.color.setHex(s.all === 1 ? 0xffd08a : 0x3a3226);
    },
    dispose() {
      off();
      for (const P of [...floorParts, ...handParts]) P.dispose();
      hand.removeFromParent();
      lamp?.removeFromParent();
      lampGeo.dispose();
      glowMat.dispose();
    },
  };
});
