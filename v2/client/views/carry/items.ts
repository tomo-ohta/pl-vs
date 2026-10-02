/**
 * 持てる物（carryItem / carryBody）と受け（carryReceiver）の描画。
 *
 * - 置いてある・飛んでいる物は状態の位置と向き（poses）に描く。持ち出して置いた区画の外では、区画と一緒に隠れないよう場面の直下に移す
 * - 自分（p1）が持っている物はカメラに付けて、画面の右下（手の前）に描く。大きな物（椅子）は小さめに、下の方に
 * - 形は kind ごとに箱・円柱・球を組む（素材は CC0 の材質ライブラリの MatId）。水の入れ物は水面の高さ、運ぶと変わる物は段で形が変わる
 * - 音: 拾う・置く・投げる・落ちる・こぼれる・満ちる・変わる（AudioEngine の一発音）
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import type { EntitySpec, Json, MatId } from '../../../core/world/layout.ts';
import { defineView, type ViewContext } from '../views.ts';
import { lightAt, onCue, Parts, withBaked } from './common.ts';
import { receiverGlow } from './puzzle.ts';
import { tileTop } from './picture.ts';

type V3 = [number, number, number];

/** 形を組む: kind ごと。原点が物の中心、half は半分の寸法 */
export function buildShape(P: Parts, kind: string, half: V3, mat: MatId, params: { [k: string]: Json }, stage = 0): void {
  const [hx, hy, hz] = half;
  const W = hx * 2, H = hy * 2, D = hz * 2;
  const g = P.group;
  const cyl = (rt: number, rb: number, h: number, m: MatId | THREE.Material, at: V3, seg = 18, open = false): THREE.Mesh => P.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m, at);
  const ball = (r: number, m: MatId | THREE.Material, at: V3): THREE.Mesh => P.add(new THREE.SphereGeometry(r, 18, 12), m, at);
  const label = (params.label as MatId | undefined) ?? 'plasticRed';
  switch (kind) {
    case 'parcel': {
      P.box([W, H, D], mat);
      P.box([W + 0.004, H * 0.18, D + 0.004], 'yellowLine', [0, 0, 0]);
      P.box([W * 0.45, 0.012, D * 0.35], label, [0, hy + 0.004, 0]);
      break;
    }
    case 'book': {
      P.box([W, H, D * 0.92], 'paintWhite', [0, 0, 0]);
      P.box([W + 0.01, H * 0.16, D + 0.01], mat, [0, hy - H * 0.08, 0]);
      P.box([W + 0.01, H * 0.16, D + 0.01], mat, [0, -hy + H * 0.08, 0]);
      P.box([W + 0.01, H, D * 0.12], mat, [0, 0, -hz + D * 0.06]);
      break;
    }
    case 'bucket': {
      const r = Math.min(hx, hz);
      cyl(r, r * 0.8, H, mat, [0, 0, 0], 20, true);
      cyl(r * 0.8, r * 0.8, 0.02, mat, [0, -hy + 0.01, 0]);
      const handle = new THREE.TorusGeometry(r * 0.95, 0.008, 6, 20, Math.PI);
      P.add(handle, 'metal', [0, hy, 0]);
      const water = P.add(new THREE.CylinderGeometry(r * 0.94, r * 0.82, 0.01, 20), 'aquariumBlue', [0, -hy + 0.02, 0]);
      water.name = 'water';
      break;
    }
    case 'chair': {
      const seatY = -hy + H * 0.48;
      P.box([W, 0.05, D], mat, [0, seatY, 0]);
      // 背もたれは +z（物の前は -z: 置いた人と同じ向きを向く）
      P.box([W, H * 0.45, 0.05], mat, [0, seatY + H * 0.25, hz - 0.025]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box([0.035, H * 0.48, 0.035], 'metalDark', [sx * (hx - 0.03), -hy + H * 0.24, sz * (hz - 0.03)]);
      break;
    }
    case 'stool': {
      cyl(Math.min(hx, hz), Math.min(hx, hz), 0.05, mat, [0, hy - 0.025, 0]);
      for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; P.box([0.03, H - 0.05, 0.03], 'metalDark', [Math.cos(a) * hx * 0.7, -0.025, Math.sin(a) * hz * 0.7]); }
      break;
    }
    case 'bulb': {
      ball(Math.min(hx, hz) * 0.95, (params.glass as MatId | undefined) ?? 'lightWarm', [0, hy * 0.3, 0]);
      cyl(hx * 0.45, hx * 0.4, H * 0.35, 'metal', [0, -hy + H * 0.17, 0]);
      break;
    }
    case 'tile': {
      // 床のタイル（PZ04）: 上の面に絵の一部
      P.box([W, H, D], 'paintWhite');
      const top = tileTop(W * 0.96, Number(params.pic ?? 0), Number(params.picN ?? 3), Number(params.picSeed ?? 0));
      P.add(top.geometry, top.material as THREE.Material, [0, hy + 0.002, 0]);
      break;
    }
    case 'card': case 'ticket': {
      P.box([W, H, D], mat);
      P.box([W * 0.9, H + 0.002, D * 0.25], label, [0, 0, -hz * 0.4]);
      break;
    }
    case 'ball': {
      ball(hx, mat, [0, 0, 0]);
      break;
    }
    case 'pin': {
      cyl(hx * 0.55, hx, H * 0.6, 'paintWhite', [0, -hy + H * 0.3, 0]);
      cyl(hx * 0.35, hx * 0.55, H * 0.25, 'paintWhite', [0, -hy + H * 0.72, 0]);
      cyl(hx * 0.42, hx * 0.42, H * 0.06, 'plasticRed', [0, -hy + H * 0.66, 0]);
      ball(hx * 0.45, 'paintWhite', [0, hy - hx * 0.45, 0]);
      break;
    }
    case 'mirror': {
      P.box([W, H * 0.8, 0.03], 'metalDark', [0, hy * 0.2, 0]);
      P.box([W * 0.9, H * 0.72, 0.012], 'stainless', [0, hy * 0.2, 0.018]);
      P.box([0.06, H * 0.2, 0.06], 'metalDark', [0, -hy + H * 0.1, 0]);
      P.box([W * 0.7, 0.03, D], 'metalDark', [0, -hy + 0.015, 0]);
      break;
    }
    case 'cutout': {
      P.box([W, H * 0.85, 0.025], mat, [0, hy * 0.15, 0]);
      P.box([W * 0.5, H * 0.15, D], 'metalDark', [0, -hy + H * 0.075, 0]);
      break;
    }
    case 'weight': {
      P.box([W, H, D], mat);
      const dots = Math.max(1, Math.round(Number(params.dots ?? 1)));
      for (let i = 0; i < dots; i++) P.box([0.05, 0.006, 0.05], 'paintWhite', [(i - (dots - 1) / 2) * 0.08, hy + 0.003, 0]);
      break;
    }
    case 'lamp': {
      cyl(hx * 0.5, hx * 0.6, 0.04, 'metalDark', [0, -hy + 0.02, 0]);
      P.box([0.03, H * 0.6, 0.03], 'metalDark', [0, -hy + H * 0.3, 0]);
      cyl(hx * 0.5, hx, H * 0.35, 'whiteFabric', [0, hy - H * 0.175, 0], 16, true);
      break;
    }
    case 'plant': {
      cyl(hx * 0.8, hx * 0.6, H * 0.4, 'plasticRed', [0, -hy + H * 0.2, 0]);
      ball(Math.max(hx, hz) * 1.0, 'plantLeaf', [0, hy - Math.max(hx, hz), 0]);
      break;
    }
    case 'umbrella': {
      P.box([0.03, H, 0.03], 'metalDark', [0, 0, 0]);
      cyl(0.02, hx, H * 0.6, mat, [0, hy * 0.15, 0], 10);
      P.add(new THREE.TorusGeometry(0.035, 0.01, 6, 10, Math.PI), 'metalDark', [0.035, -hy, 0]);
      break;
    }
    case 'bag': {
      P.box([W, H * 0.75, D], mat, [0, -hy + H * 0.375, 0]);
      P.add(new THREE.TorusGeometry(hx * 0.5, 0.012, 6, 14, Math.PI), 'metalDark', [0, -hy + H * 0.75, 0]);
      break;
    }
    case 'toy': {
      ball(hx * 0.75, mat, [0, -hy + hx * 0.75, 0]);
      ball(hx * 0.55, mat, [0, hy - hx * 0.55, 0]);
      ball(hx * 0.22, mat, [-hx * 0.4, hy - hx * 0.05, 0]);
      ball(hx * 0.22, mat, [hx * 0.4, hy - hx * 0.05, 0]);
      break;
    }
    case 'morph': {
      // 運ぶと変わる物: 段ごとに別の形（コップ → 花瓶 → 鳥の置物 → 鍵）
      const forms = ((params.forms as string[] | undefined) ?? ['cup', 'vase', 'bird', 'key']);
      const f = forms[Math.min(forms.length - 1, stage)]!;
      buildShape(P, f, half, mat, params);
      break;
    }
    case 'cup': {
      cyl(hx, hx * 0.8, H, mat, [0, 0, 0], 16, true);
      cyl(hx * 0.8, hx * 0.8, 0.01, mat, [0, -hy + 0.005, 0]);
      break;
    }
    case 'vase': {
      cyl(hx * 0.5, hx * 0.6, H * 0.3, mat, [0, hy - H * 0.15, 0]);
      ball(hx, mat, [0, -hy + hx, 0]);
      break;
    }
    case 'bird': {
      ball(hx * 0.6, mat, [0, -hy + hx * 0.6, 0]);
      ball(hx * 0.35, mat, [0, -hy + hx * 1.4, hz * 0.4]);
      P.box([hx * 0.2, hx * 0.1, hz * 0.4], 'plasticYellow', [0, -hy + hx * 1.4, hz * 0.85]);
      P.box([W * 1.1, 0.02, hz * 0.6], mat, [0, -hy + hx * 0.8, -hz * 0.1]);
      break;
    }
    case 'key': {
      P.add(new THREE.TorusGeometry(hx * 0.45, hx * 0.12, 8, 18), 'goldTrim', [0, hy * 0.45, 0]);
      P.box([hx * 0.18, H * 0.55, hx * 0.12], 'goldTrim', [0, -hy * 0.25, 0]);
      P.box([hx * 0.35, hx * 0.14, hx * 0.12], 'goldTrim', [hx * 0.2, -hy * 0.75, 0]);
      break;
    }
    default:
      P.box([W, H, D], mat);
  }
  void g;
}

/** 持っている物を手の前に描く位置（カメラの中）。大きい物ほど小さく・下に */
function handPlace(group: THREE.Group, half: V3): void {
  const size = Math.max(half[0], half[1], half[2]) * 2;
  const s = size > 0.45 ? 0.45 / size : 1;
  group.scale.setScalar(s);
  group.position.set(0.26, -0.3 - (size > 0.45 ? 0.08 : 0), -0.62);
  group.rotation.set(0.12, -0.35, 0);
}

function itemView(spec: EntitySpec, ctx: ViewContext): ReturnType<Parameters<typeof defineView>[1]> {
  const half = (spec.params.half as V3 | undefined) ?? [0.15, 0.15, 0.15];
  const kind = String(spec.params.kind ?? 'box');
  const mat = (spec.params.mat as MatId | undefined) ?? 'boxCardboard';
  let P = new Parts(ctx);
  let stage = -1;
  let relight = 0;
  let inHand = false;
  const build = (st: number): void => {
    P.dispose();
    P = new Parts(ctx);
    buildShape(P, kind, half, mat, spec.params, st);
    stage = st;
    relight = 0;
  };
  build(0);
  const cellBounds = ctx.built.cells.get(spec.cell ?? '')?.bounds ?? null;
  const q = new THREE.Quaternion();
  const offCue = onCue(ctx, spec.id, (name, e) => {
    const a = ctx.audio;
    if (!a) return;
    const pos = e.pos;
    if (name === 'carry.pick' || name === 'carry.swap') a.play('pageTurn', { pos, gain: 0.25 });
    else if (name === 'carry.drop') a.play('thud', { pos, gain: 0.25 });
    else if (name === 'carry.place') { a.play('clank', { pos, gain: 0.1 }); a.play('thud', { pos, gain: 0.2 }); }
    else if (name === 'carry.throw') a.play('pageTurn', { pos, gain: 0.18, pitch: 0.7 });
    else if (name === 'carry.land') a.play('thud', { pos, gain: Math.min(0.7, 0.15 + Number(e.data?.speed ?? 2) * 0.06) });
    else if (name === 'carry.spill') a.play('drip', { pos, gain: 0.6 });
    else if (name === 'carry.fill') { a.play('drip', { pos, gain: 0.5 }); a.play('drip', { pos, gain: 0.4 }); }
    else if (name === 'carry.morph') a.play('chime', { pos, gain: 0.15 });
    else if (name === 'carry.return') a.play('pageTurn', { pos, gain: 0.15 });
  });
  return {
    update(s: Readonly<PartState>, dt: number) {
      const st = typeof s.stage === 'number' ? s.stage : 0;
      if (kind === 'morph' && st !== stage) build(st);
      const g = P.group;
      const held = s.held === 'p1' && !!ctx.camera;
      if (held) {
        if (!inHand) { ctx.camera!.add(g); handPlace(g, half); inHand = true; relight = 0; }
      } else {
        const p = s.poses as number[];
        const out = !!cellBounds && (p[0]! < cellBounds.min[0] || p[0]! > cellBounds.max[0] || p[2]! < cellBounds.min[2] || p[2]! > cellBounds.max[2]);
        const parent = out && ctx.scene ? ctx.scene : ctx.root;
        if (g.parent !== parent || inHand) { parent.add(g); g.scale.setScalar(1); inHand = false; relight = 0; }
        g.position.set(p[0]!, p[1]!, p[2]!);
        q.set(p[3]!, p[4]!, p[5]!, p[6]!);
        g.quaternion.copy(q);
      }
      const water = g.getObjectByName('water');
      if (water) {
        const f = typeof s.fill === 'number' ? s.fill : 0;
        water.visible = f > 0.01;
        water.position.y = -half[1] + 0.02 + f * half[1] * 1.7;
      }
      relight -= dt;
      if (relight <= 0) {
        relight = 0.3;
        const wp = new THREE.Vector3();
        g.getWorldPosition(wp);
        P.relight(lightAt(ctx, [wp.x, wp.y, wp.z]));
      }
    },
    dispose() { offCue(); P.dispose(); },
  };
}

defineView('carryItem', itemView);
defineView('carryBody', itemView);

// ---------------------------------------------------------------- 受け（枠の印）
/**
 * 受けの枠: 床・台の上の薄い四角の印（params.mark が false なら描かない）。合う物が置かれた枠は印が明るくなる
 */
defineView('carryReceiver', (spec, ctx) => {
  const glow = receiverGlow(spec, ctx);
  const slots = Array.isArray(spec.params.slots) ? (spec.params.slots as { pos: number[]; r?: number }[]) : [];
  if (spec.params.mark === false || !slots.length) return glow ? { update: (s: Readonly<PartState>) => glow.update(s), dispose: () => glow.dispose() } : null;
  const P = new Parts(ctx);
  const size = typeof spec.params.markM === 'number' ? spec.params.markM : 0.42;
  const markMat = (spec.params.markMat as MatId | undefined) ?? 'yellowLine';
  const lit = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.7, depthWrite: false });
  const meshes: THREE.Mesh[] = [];
  for (const sl of slots) {
    const ring = new THREE.RingGeometry(size * 0.48, size * 0.56, 4, 1);
    ring.rotateX(-Math.PI / 2);
    ring.rotateY(Math.PI / 4);
    const m = P.add(withBaked(ring), markMat, [sl.pos[0]!, sl.pos[1]! + 0.006, sl.pos[2]!]);
    meshes.push(m);
  }
  ctx.root.add(P.group);
  const base = ctx.materials.get(markMat);
  let relight = 0;
  return {
    update(s: Readonly<PartState>, dt: number) {
      const occ = (s.occ as (string | null)[] | undefined) ?? [];
      meshes.forEach((m, i) => { m.material = occ[i] ? lit : base; });
      glow?.update(s);
      relight -= dt;
      if (relight <= 0) { relight = 0.5; const c = slots[0]!.pos; P.relight(lightAt(ctx, [c[0]!, c[1]! + 0.3, c[2]!])); }
    },
    dispose() { P.dispose(); lit.dispose(); glow?.dispose(); },
  };
});
