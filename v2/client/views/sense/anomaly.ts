/**
 * 光・音・視線・時間の部屋まるごとの異変の描画（senseFx の種類）。
 * - rgbMarks: 壁の色の印。同じ色の照明（lamp）が点いている間は消え、ほかの色の光の下では黒く浮かぶ
 * - shadow: 壁を歩いて往復する人の影（頭・胴・脚の暗い板。歩くと揺れる）と、壁際の足音。じっと見ると止まって薄れる
 * - sunbeam: 窓から差す日の光の筒と、床の日だまり。日の向きが早回しのように動く
 * - thunder: 稲光の少し後に雷鳴
 * - anechoic: 壁と天井の吸音の楔（同じ形の四角錐を並べる）。部屋の中では一切の音を消す
 * - lateSteps: 部屋の中では足音を遅らせ、床の足跡も同じだけ遅れて現れる（しばらくで消える）
 * - chairs: 椅子（部品が描く）。見ていない間に、こちらを向く
 * - edgeFigure: 視界の端にだけ立つ人影。視線が近づくと消える（ささやき）
 * - slowTime: 足音を低く・遅く。塵がゆっくり舞う
 */
import * as THREE from 'three';
import { viewOffsetDeg } from '../../../core/sim/parts/sense/common.ts';
import type { MatId } from '../../../core/world/layout.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import type { ViewContext } from '../views.ts';
import { glowMaterial, LitParts, onCue, playerInCell, simTime } from './common.ts';
import { defineFx } from './fx.ts';

type Zone = { min: number[]; max: number[] };
const inZone = (ctx: ViewContext, z: Zone): boolean => {
  const p = ctx.sim.players[0];
  return !!p && p.pos[0] >= z.min[0]! && p.pos[0] <= z.max[0]! && p.pos[2] >= z.min[2]! && p.pos[2] <= z.max[2]! && p.pos[1] >= z.min[1]! && p.pos[1] <= z.max[1]!;
};

/** 壁の面（dir・face・inward）に貼る板の向きと位置: 壁に沿う at・高さ y・壁から out */
function onWall(m: THREE.Object3D, dir: number, face: number, inward: number, at: number, y: number, out: number): void {
  if (dir === 0 || dir === 2) { m.position.set(at, y, face + inward * out); m.rotation.set(0, inward > 0 ? 0 : Math.PI, 0); }
  else { m.position.set(face + inward * out, y, at); m.rotation.set(0, inward > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
}

// ---------------------------------------------------------------- 色の印
/** 印の形（板の中の小さな矩形の列 [x, y, w, h]。原点は印の真ん中） */
const SHAPES: Record<string, number[][]> = {
  hand: [[0, -0.05, 0.16, 0.18], [-0.075, 0.1, 0.03, 0.12], [-0.03, 0.13, 0.03, 0.16], [0.015, 0.135, 0.03, 0.17], [0.06, 0.12, 0.03, 0.13], [-0.11, 0.0, 0.03, 0.09]],
  arrow: [[-0.08, 0, 0.3, 0.05], [0.09, 0.04, 0.12, 0.04], [0.09, -0.04, 0.12, 0.04]],
  tally: [[-0.12, 0, 0.025, 0.26], [-0.06, 0, 0.025, 0.26], [0, 0, 0.025, 0.26], [0.06, 0, 0.025, 0.26], [-0.03, 0, 0.3, 0.025]],
};

defineFx('rgbMarks', (spec, ctx) => {
  const marks = (spec.params.marks as { dir: number; face: number; inward: number; at: number; y: number; kind: string; color: number; lamp: string }[] | undefined) ?? [];
  const geo = new THREE.PlaneGeometry(1, 1);
  const items = marks.map((m) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0, depthWrite: false, fog: true });
    for (const [x, y, w, h] of SHAPES[m.kind] ?? SHAPES.tally!) {
      const q = new THREE.Mesh(geo, mat);
      q.position.set(x!, y!, 0);
      q.scale.set(w!, h!, 1);
      if (m.kind === 'arrow' && (x ?? 0) > 0.05) q.rotation.z = (y! > 0 ? -1 : 1) * 0.7;
      if (m.kind === 'tally' && w! > 0.1) q.rotation.z = 0.45;
      g.add(q);
    }
    onWall(g, m.dir, m.face, m.inward, m.at, m.y, 0.006);
    ctx.root.add(g);
    return { m, g, mat };
  });
  return {
    update() {
      // 同じ色の光の下では印は壁と同じに見える（消える）。ほかの色の光では黒く浮かぶ
      for (const it of items) it.mat.opacity = 0.82 * Math.max(0, Math.min(1, 1 - ctx.levelOf(it.m.lamp)));
    },
    dispose() { for (const it of items) { it.g.removeFromParent(); it.mat.dispose(); } geo.dispose(); },
  };
});

// ---------------------------------------------------------------- 影だけ動く
defineFx('shadow', (spec, ctx) => {
  const dir = Number(spec.params.dir), face = Number(spec.params.face), inward = Number(spec.params.inward);
  const a0 = Number(spec.params.a0), a1 = Number(spec.params.a1), y = Number(spec.params.y);
  const speed = Number(spec.params.speed ?? 1.1), phase = Number(spec.params.phase ?? 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const disc = new THREE.CircleGeometry(0.5, 20);
  const plane = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.Group();
  const head = new THREE.Mesh(disc, mat); head.scale.set(0.24, 0.3, 1); head.position.set(0, 1.62, 0);
  const body = new THREE.Mesh(plane, mat); body.scale.set(0.42, 0.62, 1); body.position.set(0, 1.18, 0);
  const legL = new THREE.Mesh(plane, mat); legL.scale.set(0.13, 0.82, 1);
  const legR = new THREE.Mesh(plane, mat); legR.scale.set(0.13, 0.82, 1);
  g.add(head, body, legL, legR);
  ctx.root.add(g);
  const len = a1 - a0;
  let fade = 0, stopT = 0, stepAcc = 0, u = 0, lastT = -1;
  return {
    update(_s, dt) {
      const t = simTime(ctx.sim) + phase;
      if (lastT < 0) lastT = t;
      const p = ctx.sim.players[0];
      const at = a0 + u;
      const pos: [number, number, number] = dir === 0 || dir === 2 ? [at, y + 1.2, face + inward * 0.01] : [face + inward * 0.01, y + 1.2, at];
      // じっと見られると止まって薄れる
      const seen = !!p && playerInCell(ctx, spec.cell) && (() => { const o = viewOffsetDeg(p, pos); return o.front && Math.abs(o.h) < 12 && Math.abs(o.v) < 20; })();
      stopT = seen ? stopT + dt : Math.max(0, stopT - dt * 0.5);
      const walking = stopT < 0.6;
      if (walking) {
        // 往復（端で 1.5 秒止まる）
        const leg = len / speed, period = 2 * (leg + 1.5);
        const w = (((t % period) + period) % period);
        u = w < leg ? w * speed : w < leg + 1.5 ? len : w < 2 * leg + 1.5 ? len - (w - leg - 1.5) * speed : 0;
      }
      const target = playerInCell(ctx, spec.cell) ? (walking ? 0.42 : Math.max(0, 0.42 - (stopT - 0.6) * 0.5)) : 0;
      fade += (target - fade) * Math.min(1, dt * 3);
      mat.opacity = fade;
      const moving = walking && Math.abs(t - lastT) > 0;
      const swing = moving ? Math.sin(t * speed * 5.2) * 0.22 : 0;
      legL.position.set(-0.09, 0.42, 0); legL.rotation.z = swing;
      legR.position.set(0.09, 0.42, 0); legR.rotation.z = -swing;
      onWall(g, dir, face, inward, a0 + u, y + Math.abs(swing) * 0.03, 0.01);
      // 足音: 壁際の床から（歩いている間・部屋にいる間）
      stepAcc += moving ? dt * speed : 0;
      if (stepAcc > 0.75 && playerInCell(ctx, spec.cell)) {
        stepAcc = 0;
        const fp: [number, number, number] = dir === 0 || dir === 2 ? [a0 + u, y, face + inward * 0.4] : [face + inward * 0.4, y, a0 + u];
        ctx.audio?.footstep(undefined, 'walk', false, false, fp);
      }
      lastT = t;
    },
    dispose() { g.removeFromParent(); mat.dispose(); disc.dispose(); plane.dispose(); },
  };
});

// ---------------------------------------------------------------- 窓の光の向き
defineFx('sunbeam', (spec, ctx) => {
  const dir = Number(spec.params.dir), face = Number(spec.params.face), inward = Number(spec.params.inward);
  const at = Number(spec.params.at), w = Number(spec.params.w), y0 = Number(spec.params.y0), y1 = Number(spec.params.y1), fy = Number(spec.params.y);
  const phase = Number(spec.params.phase ?? 0);
  const alongX = dir === 0 || dir === 2;
  // 床の日だまり（窓の形を日の向きで床へ写した四角形）と、窓から日だまりへの光の筒（4 つの角を結ぶ）
  const patchGeo = new THREE.BufferGeometry();
  patchGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  patchGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const patchMat = glowMaterial(0xffdc9a, 0.32);
  const patch = new THREE.Mesh(patchGeo, patchMat);
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
  shaftGeo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  const shaftMat = glowMaterial(0xffe6b0, 0.07);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  patch.frustumCulled = false; shaft.frustumCulled = false;
  ctx.root.add(patch, shaft);
  // 窓の 4 隅（壁の面の上）
  const corner = (a: number, yy: number): THREE.Vector3 => (alongX ? new THREE.Vector3(a, yy, face) : new THREE.Vector3(face, yy, a));
  const win = [corner(at - w / 2, y1), corner(at + w / 2, y1), corner(at + w / 2, y0), corner(at - w / 2, y0)];
  const n = alongX ? new THREE.Vector3(0, 0, inward) : new THREE.Vector3(inward, 0, 0);
  const side = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3();
  // 窓のある床の矩形（窓に近い矩形）
  const rs = (spec.params.rects as number[][] | undefined) ?? [];
  const wr = rs.slice().sort((p, q) => Math.hypot((p[0]! + p[2]!) / 2 - win[0]!.x, (p[1]! + p[3]!) / 2 - win[0]!.z) - Math.hypot((q[0]! + q[2]!) / 2 - win[0]!.x, (q[1]! + q[3]!) / 2 - win[0]!.z))[0] ?? [-1e9, -1e9, 1e9, 1e9];
  const [bx0, bz0, bx1, bz1] = [wr[0]! + 0.05, wr[1]! + 0.05, wr[2]! - 0.05, wr[3]! - 0.05];
  return {
    update() {
      // 日の向き: 窓から部屋の中へ。横の向きが ±65° を 36 秒で往復し、高さも 25°〜55° で揺れる（早回し）
      const t = simTime(ctx.sim) + phase;
      const yaw = Math.sin((t / 36) * Math.PI * 2) * 1.13;
      const el = 0.7 + 0.26 * Math.sin((t / 23) * Math.PI * 2);
      d.copy(n).multiplyScalar(Math.cos(yaw) * Math.cos(el)).addScaledVector(side, Math.sin(yaw) * Math.cos(el));
      d.y = -Math.sin(el);
      const pa = patchGeo.getAttribute('position') as THREE.BufferAttribute, sa = shaftGeo.getAttribute('position') as THREE.BufferAttribute;
      win.forEach((c, i) => {
        const k = (c.y - (fy + 0.015)) / -d.y;
        // 日だまりは部屋の床の中だけ（壁の向こうの床に写らない）
        const fx = Math.min(bx1, Math.max(bx0, c.x + d.x * k)), fz = Math.min(bz1, Math.max(bz0, c.z + d.z * k));
        pa.setXYZ(i, fx, fy + 0.015, fz);
        sa.setXYZ(i, c.x + n.x * 0.02, c.y, c.z + n.z * 0.02);
        sa.setXYZ(i + 4, fx, fy + 0.02, fz);
      });
      pa.needsUpdate = true; sa.needsUpdate = true;
      const inside = playerInCell(ctx, spec.cell);
      shaftMat.opacity = inside ? 0.06 : 0.03;
    },
    dispose() { patch.removeFromParent(); shaft.removeFromParent(); patchGeo.dispose(); shaftGeo.dispose(); patchMat.dispose(); shaftMat.dispose(); },
  };
});

// ---------------------------------------------------------------- 雷鳴
defineFx('thunder', (spec, ctx) => {
  const storm = String(spec.params.storm);
  const pending: number[] = [];
  const off = onCue(ctx, storm, (name, e) => {
    if (name !== 'lightning.flash' || !playerInCell(ctx, spec.cell)) return;
    pending.push(simTime(ctx.sim) + Number(e.data?.delay ?? 1));
    ctx.postfx?.videoPass?.forceJitter?.(6);
  });
  return {
    update() {
      const t = simTime(ctx.sim);
      for (let i = pending.length - 1; i >= 0; i--) if (t >= pending[i]!) { pending.splice(i, 1); ctx.audio?.play('thunder', { gain: 0.8 }); }
    },
    dispose() { off(); },
  };
});

// ---------------------------------------------------------------- 完全な無音
defineFx('anechoic', (spec, ctx) => {
  const faces = (spec.params.faces as { dir: number; face: number; inward: number; a0: number; a1: number }[] | undefined) ?? [];
  const y = Number(spec.params.y), h = Number(spec.params.h);
  const rects = (spec.params.rects as number[][] | undefined) ?? [];
  const zone = spec.params.zone as Zone;
  const S = 0.4;
  // 四角錐の楔（底 S × S・高さ 0.3）を壁と天井に並べる
  const cone = new THREE.ConeGeometry(S * 0.7, 0.3, 4, 1);
  cone.rotateY(Math.PI / 4);
  cone.translate(0, 0.15, 0);
  const at: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (const f of faces) {
    for (let a = f.a0 + S / 2; a <= f.a1 - S / 2 + 1e-6; a += S) for (let yy = y + S / 2; yy <= y + h - S / 2 + 1e-6; yy += S) {
      // 楔は壁から内側（inward）へ向く
      if (f.dir === 0 || f.dir === 2) { p.set(a, yy, f.face); e.set(f.inward > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0); }
      else { p.set(f.face, yy, a); e.set(0, 0, f.inward > 0 ? -Math.PI / 2 : Math.PI / 2); }
      at.push(m.compose(p, q.setFromEuler(e), one).clone());
    }
  }
  for (const r of rects) for (let x = r[0]! + S / 2; x <= r[2]! - S / 2 + 1e-6; x += S) for (let z = r[1]! + S / 2; z <= r[3]! - S / 2 + 1e-6; z += S) {
    p.set(x, y + h, z); e.set(Math.PI, 0, 0);
    at.push(m.compose(p, q.setFromEuler(e), one).clone());
  }
  const n = Math.min(at.length, 4000);
  const light = new Float32Array(cone.getAttribute('position').count * 3).fill(0.3);
  cone.setAttribute('bakedLight', new THREE.BufferAttribute(light, 3));
  const mesh = new THREE.InstancedMesh(cone, ctx.materials.get('furnitureDark' as MatId), Math.max(1, n));
  mesh.count = n;
  for (let i = 0; i < n; i++) mesh.setMatrixAt(i, at[i]!);
  mesh.instanceMatrix.needsUpdate = true;
  ctx.root.add(mesh);
  // 明るさは部屋の真ん中の陰影
  const c0 = rects[0] ?? [0, 0, 0, 0];
  const mid: [number, number, number] = [(c0[0]! + c0[2]!) / 2, y + h / 2, (c0[1]! + c0[3]!) / 2];
  const cell = cellAt(ctx.built, mid);
  const lv = cell ? sampleCellLight(cell, mid, ctx.levelOf) : [0.3, 0.3, 0.3];
  for (let i = 0; i < light.length; i += 3) { light[i] = lv[0]!; light[i + 1] = lv[1]!; light[i + 2] = lv[2]!; }
  let on = false;
  return {
    update() {
      const inside = inZone(ctx, zone);
      if (inside !== on) { on = inside; ctx.audio?.setDuck(`anechoic:${spec.id}`, inside ? 0.0 : 1, inside ? 0.35 : 0.3); }
    },
    dispose() { ctx.audio?.setDuck(`anechoic:${spec.id}`, 1); mesh.removeFromParent(); cone.dispose(); },
  };
});

// ---------------------------------------------------------------- 足音が遅れる
defineFx('lateSteps', (spec, ctx) => {
  const zone = spec.params.zone as Zone;
  const delay = Number(spec.params.delay ?? 0.45);
  const fy = Number(spec.params.y);
  const geo = new THREE.PlaneGeometry(0.11, 0.26);
  geo.rotateX(-Math.PI / 2);
  const MAX = 28;
  const prints: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; at: number }[] = [];
  const queue: { at: number; x: number; z: number; yaw: number; side: number }[] = [];
  let side = 1, on = false;
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'player.stride' || !e.pos || !inZone(ctx, zone)) return;
    const p = ctx.sim.players[0];
    side = -side;
    queue.push({ at: simTime(ctx.sim) + delay, x: e.pos[0]!, z: e.pos[2]!, yaw: p?.yaw ?? 0, side });
  }) ?? (() => {});
  return {
    update() {
      const inside = inZone(ctx, zone);
      if (inside !== on && ctx.audio) { on = inside; ctx.audio.stepDelaySec = inside ? delay : 0; }
      const t = simTime(ctx.sim);
      while (queue.length && queue[0]!.at <= t) {
        const q = queue.shift()!;
        let pr = prints.length < MAX ? null : prints.shift()!;
        if (!pr) { const mat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0, depthWrite: false, fog: true }); pr = { mesh: new THREE.Mesh(geo, mat), mat, at: 0 }; ctx.root.add(pr.mesh); }
        const ox = Math.cos(q.yaw) * 0.12 * q.side, oz = -Math.sin(q.yaw) * 0.12 * q.side;
        pr.mesh.position.set(q.x + ox, fy + 0.006, q.z + oz);
        pr.mesh.rotation.y = q.yaw;
        pr.at = t;
        prints.push(pr);
      }
      for (const pr of prints) pr.mat.opacity = Math.max(0, 0.55 * (1 - (t - pr.at) / 7));
    },
    dispose() { off(); if (on && ctx.audio) ctx.audio.stepDelaySec = 0; for (const pr of prints) { pr.mesh.removeFromParent(); pr.mat.dispose(); } geo.dispose(); },
  };
});

// ---------------------------------------------------------------- 動く椅子
defineFx('chairs', (spec, ctx) => {
  const list = (spec.params.chairs as { c: number[]; facing: number; boxes: { min: number[]; max: number[]; mat: MatId }[] }[] | undefined) ?? [];
  const items = list.map((ch) => {
    const parts = new LitParts(ctx);
    for (const b of ch.boxes) parts.box([b.max[0]! - b.min[0]!, b.max[1]! - b.min[1]!, b.max[2]! - b.min[2]!], [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2], b.mat);
    const pivot = new THREE.Group();
    pivot.position.set(ch.c[0]!, 0, ch.c[1]!);
    pivot.add(parts.group);
    ctx.root.add(pivot);
    parts.relight([ch.c[0]!, Number(spec.params.y) + 0.5, ch.c[1]!]);
    return { ch, parts, pivot, rot: 0 };
  });
  let relit = 0;
  return {
    update(_s, dt) {
      const p = ctx.sim.players[0];
      if (!p) return;
      for (const it of items) {
        const pos: [number, number, number] = [it.ch.c[0]!, Number(spec.params.y) + 0.5, it.ch.c[1]!];
        const o = viewOffsetDeg(p, pos);
        const seen = o.front && Math.abs(o.h) < 56 && Math.abs(o.v) < 40;
        if (seen) continue;
        // 見ていない間: 座った人がこちらを向く向きへ（背もたれを反対側へ）
        const want = Math.atan2(-(p.pos[0] - it.ch.c[0]!), -(p.pos[2] - it.ch.c[1]!)) - it.ch.facing;
        it.rot = want;
        it.pivot.rotation.y = it.rot;
      }
      relit -= dt;
      if (relit <= 0) { relit = 1; for (const it of items) it.parts.relight([it.ch.c[0]!, Number(spec.params.y) + 0.5, it.ch.c[1]!]); }
    },
    dispose() { for (const it of items) { it.pivot.removeFromParent(); it.parts.dispose(); } },
  };
});

// ---------------------------------------------------------------- 視界の端の人影
defineFx('edgeFigure', (spec, ctx) => {
  const spots = (spec.params.spots as number[][] | undefined) ?? [];
  const y = Number(spec.params.y);
  const show = Number(spec.params.show ?? 34), hide = Number(spec.params.hide ?? 20);
  const mat = new THREE.MeshBasicMaterial({ color: 0x050506, transparent: true, opacity: 0, fog: true });
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 1.0, 4, 10);
  const headGeo = new THREE.SphereGeometry(0.13, 12, 10);
  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, mat); body.position.y = 0.75;
  const head = new THREE.Mesh(headGeo, mat); head.position.y = 1.58;
  g.add(body, head);
  g.visible = false;
  ctx.root.add(g);
  let at = -1, cool = 2, op = 0;
  return {
    update(_s, dt) {
      const p = ctx.sim.players[0];
      const inside = playerInCell(ctx, spec.cell);
      cool -= dt;
      if (!p || !inside) { at = -1; op = 0; g.visible = false; return; }
      if (at >= 0) {
        const s = spots[at]!;
        const o = viewOffsetDeg(p, [s[0]!, y + 1.2, s[1]!]);
        const ang = Math.hypot(o.h, o.v * 0.8);
        if (!o.front || ang > 62) { at = -1; cool = 1.5; }
        else if (ang < hide) { at = -1; cool = 6; ctx.audio?.play('whisper', { pos: [s[0]!, y + 1.5, s[1]!], gain: 0.35 }); }
      } else if (cool <= 0) {
        // 視界の端（show〜show+16°）・3〜9 m の所
        const cand = spots.map((s, i) => ({ i, o: viewOffsetDeg(p, [s[0]!, y + 1.2, s[1]!]) })).filter((c) => c.o.front && c.o.dist > 3 && c.o.dist < 9 && Math.abs(c.o.h) > show && Math.abs(c.o.h) < show + 16 && Math.abs(c.o.v) < 30);
        if (cand.length) { at = cand[Math.floor((simTime(ctx.sim) * 7.3) % cand.length)]!.i; op = 0; }
        else cool = 0.4;
      }
      op += ((at >= 0 ? 0.92 : 0) - op) * Math.min(1, dt * (at >= 0 ? 2 : 14));
      mat.opacity = op;
      g.visible = op > 0.01;
      if (at >= 0) {
        const s = spots[at]!;
        g.position.set(s[0]!, y, s[1]!);
        g.rotation.y = Math.atan2(-(p.pos[0] - s[0]!), -(p.pos[2] - s[1]!));
      }
    },
    dispose() { g.removeFromParent(); mat.dispose(); bodyGeo.dispose(); headGeo.dispose(); },
  };
});

// ---------------------------------------------------------------- 遅い部屋
defineFx('slowTime', (spec, ctx) => {
  const zone = spec.params.zone as Zone;
  const rects = (spec.params.rects as number[][] | undefined) ?? [];
  const y = Number(spec.params.y), h = Number(spec.params.h);
  const pitch = Number(spec.params.pitch ?? 0.62);
  const N = 220;
  const pos = new Float32Array(N * 3);
  const seed: number[] = [];
  const r0 = rects[0] ?? [0, 0, 1, 1];
  for (let i = 0; i < N; i++) {
    const r = rects[i % rects.length] ?? r0;
    const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.678, c = Math.sin(i * 39.425) * 9876.54;
    const fr = (v: number): number => v - Math.floor(v);
    seed.push(r[0]! + fr(a) * (r[2]! - r[0]!), r[1]! + fr(b) * (r[3]! - r[1]!), fr(c));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  ctx.root.add(pts);
  let on = false;
  return {
    update() {
      const t = simTime(ctx.sim);
      for (let i = 0; i < N; i++) {
        const k = seed[i * 3 + 2]!;
        const yy = y + h - ((t * 0.04 + k * h) % h);
        pos[i * 3] = seed[i * 3]! + Math.sin(t * 0.21 + k * 9) * 0.25;
        pos[i * 3 + 1] = yy;
        pos[i * 3 + 2] = seed[i * 3 + 1]! + Math.cos(t * 0.17 + k * 7) * 0.25;
      }
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      const inside = inZone(ctx, zone);
      if (inside !== on && ctx.audio) { on = inside; ctx.audio.stepPitch = inside ? pitch : 1; ctx.audio.setMuffle(`slow:${spec.id}`, inside ? 1800 : null, 0.5); }
    },
    dispose() { if (on && ctx.audio) { ctx.audio.stepPitch = 1; ctx.audio.setMuffle(`slow:${spec.id}`, null); } pts.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});
