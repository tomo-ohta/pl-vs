/**
 * 見る・見ないの描画。
 * - watchClock: 壁の丸い時計（文字盤・12 の目盛り・長針と短針）。見ていない間は針が進み、コチコチと速い音（区画にいる間）。
 *     見ないまま長くいて隠しが現れると（gone）、時計は消える
 * - senseFx zoom: 立ち止まって札を見つめると、撮像のズーム（画角を狭める。見つめるのをやめると戻る）
 * - senseFx mannequins: 白いマネキン。見られている間は壁の一点を見つめ、目を離すとこちらへ首を向ける
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { defineFx } from './fx.ts';
import { LitParts, playerInCell } from './common.ts';

defineView('watchClock', (spec, ctx) => {
  const pos = spec.params.pos as number[];
  const dir = Number(spec.params.dir ?? 0);
  const R = Number(spec.params.radius ?? 0.36);
  const inward: [number, number] = dir === 0 ? [0, -1] : dir === 2 ? [0, 1] : dir === 1 ? [-1, 0] : [1, 0];
  const parts = new LitParts(ctx);
  // 文字盤は局所の xy 面（法線 +z）。group を壁の内向きへ回す
  const face = parts.cylinder(R, 0.04, [0, 0, 0], 'paintWhite');
  face.rotation.x = Math.PI / 2;
  const rim = parts.cylinder(R + 0.03, 0.035, [0, 0, -0.008], 'metalDark');
  rim.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = parts.box([0.025, i % 3 === 0 ? 0.08 : 0.045, 0.01], [Math.sin(a) * R * 0.82, Math.cos(a) * R * 0.82, 0.025], 'furnitureDark');
    m.rotation.z = -a;
  }
  const hourPivot = new THREE.Group(), minPivot = new THREE.Group();
  hourPivot.position.z = 0.03; minPivot.position.z = 0.035;
  const hour = parts.box([0.028, R * 0.5, 0.01], [0, R * 0.25, 0], 'furnitureDark');
  const min = parts.box([0.018, R * 0.78, 0.01], [0, R * 0.39, 0], 'furnitureDark');
  hour.removeFromParent(); min.removeFromParent();
  hourPivot.add(hour); minPivot.add(min);
  parts.group.add(hourPivot, minPivot);
  parts.group.position.set(pos[0]!, pos[1]!, pos[2]!);
  parts.group.rotation.y = Math.atan2(inward[0], inward[1]);
  ctx.root.add(parts.group);
  let lastHand = -1, tick = 0, relight = 0, fade = 1;
  const goneId = typeof spec.params.gone === 'string' ? spec.params.gone : null;
  return {
    update(s, dt) {
      const hand = Number(s.hand ?? 0);
      hourPivot.rotation.z = -(hand / 12) * Math.PI * 2;
      minPivot.rotation.z = -((hand % 1) * Math.PI * 2);
      // 進んでいる間はコチコチ（速さは針の速さ。区画にいる間だけ）
      const moving = lastHand >= 0 && Math.abs(hand - lastHand) > 1e-6;
      lastHand = hand;
      tick -= dt;
      if (moving && tick <= 0 && playerInCell(ctx, spec.cell)) { ctx.audio?.play('tick', { pos: pos as [number, number, number], gain: 0.6 }); tick = 0.13; }
      // 見ないまま長くいた: 時計が消える
      if (goneId && ctx.sim.outputOf(goneId, 'out') > 0.5) fade = Math.max(0, fade - dt * 1.2);
      parts.group.visible = fade > 0.02;
      parts.group.scale.setScalar(0.4 + 0.6 * fade);
      relight -= dt;
      if (relight <= 0) { relight = 0.5; parts.relight([pos[0]! + inward[0] * 0.3, pos[1]!, pos[2]! + inward[1] * 0.3]); }
    },
    dispose() { parts.dispose(); },
  };
});

defineFx('zoom', (spec, ctx) => {
  const cam = ctx.camera;
  if (!cam) return null;
  const gaze = String(spec.params.gaze);
  let applied = 0, lastFov = cam.fov, k = 0;
  return {
    update(_s, dt) {
      const gazing = ctx.sim.outputOf(gaze, 'gazing') > 0.5;
      const prog = ctx.sim.outputOf(gaze, 'progress');
      const target = gazing ? Math.min(1, prog * 1.3) : 0;
      k += (target - k) * Math.min(1, dt * (gazing ? 2.2 : 5));
      // 画角: カメラの揺れ（CameraRig）が書いた値を基に、ズームの分だけ狭める（前のフレームに自分が足した分は引く）
      const base = Math.abs(cam.fov - lastFov) < 1e-6 ? cam.fov - applied : cam.fov;
      applied = -k * (base - 22);
      cam.fov = base + applied;
      lastFov = cam.fov;
      cam.updateProjectionMatrix();
    },
    dispose() {
      if (Math.abs(cam.fov - lastFov) < 1e-6) { cam.fov -= applied; cam.updateProjectionMatrix(); }
    },
  };
});

defineFx('mannequins', (spec, ctx) => {
  const figs = (spec.params.figures as number[][] | undefined) ?? [];
  const P = spec.params.target as number[];
  const cam = ctx.camera;
  const items = figs.map((f) => {
    const parts = new LitParts(ctx);
    parts.box([0.36, 0.55, 0.22], [0, 1.22, 0], 'marbleWhite');
    parts.box([0.32, 0.2, 0.2], [0, 0.88, 0], 'marbleWhite');
    parts.box([0.12, 0.78, 0.13], [-0.09, 0.39, 0], 'marbleWhite');
    parts.box([0.12, 0.78, 0.13], [0.09, 0.39, 0], 'marbleWhite');
    parts.box([0.09, 0.6, 0.09], [-0.25, 1.18, 0], 'marbleWhite');
    parts.box([0.09, 0.6, 0.09], [0.25, 1.18, 0], 'marbleWhite');
    parts.box([0.4, 0.04, 0.4], [0, 0.02, 0], 'metalDark');
    const neck = new THREE.Group();
    neck.position.set(0, 1.56, 0);
    const head = parts.sphere(0.12, [0, 0.12, 0], 'marbleWhite');
    head.removeFromParent();
    neck.add(head);
    parts.group.add(neck);
    parts.group.position.set(f[0]!, f[1]!, f[2]!);
    parts.group.rotation.y = f[3]!;
    ctx.root.add(parts.group);
    parts.relight([f[0]!, f[1]! + 1.2, f[2]!]);
    // 首の向き（体に対する角度）: 一点を見る角度 = 0
    return { parts, neck, yaw: 0, body: f[3]!, x: f[0]!, z: f[2]!, y: f[1]! };
  });
  const frustum = new THREE.Frustum(), mtx = new THREE.Matrix4(), v = new THREE.Vector3();
  let relight = 0;
  return {
    update(_s, dt) {
      const p = ctx.sim.players[0];
      if (cam) { mtx.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(mtx); }
      for (const it of items) {
        v.set(it.x, it.y + 1.6, it.z);
        const seen = !!cam && frustum.containsPoint(v);
        // 見られていない間はこちらへ首を向け（速く）、見られている間は一点へ戻す（ゆっくり）
        let want = 0;
        if (!seen && p) {
          let d = Math.atan2(p.pos[0] - it.x, p.pos[2] - it.z) - it.body;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          want = Math.max(-1.6, Math.min(1.6, d));
        }
        it.yaw += (want - it.yaw) * Math.min(1, dt * (seen ? 0.7 : 6));
        it.neck.rotation.y = it.yaw;
        // 一点を見上げる・見下ろす（頭の高さと一点の高さの差）
        it.neck.rotation.x = seen ? -Math.atan2(P[1]! - (it.y + 1.68), Math.hypot(P[0]! - it.x, P[2]! - it.z)) * 0.6 : 0;
      }
      relight -= dt;
      if (relight <= 0) { relight = 0.6; for (const it of items) it.parts.relight([it.x, it.y + 1.2, it.z]); }
    },
    dispose() { for (const it of items) it.parts.dispose(); },
  };
});
