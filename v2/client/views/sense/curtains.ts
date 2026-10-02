/**
 * 幕の部屋の描画（senseFx curtains）。
 * - hint 'glow': 床の蓄光の矢印（本物の幕へ）と、横の壁の光る手形（BL04）。懐中電灯を消している間だけ見える
 * - hint 'listen': 目を閉じる（真下を見て止まる）と画面が暗くなり、まわりの音が遠のいて、本物の幕の奥から鈴が鳴る
 * - 違う幕の奥へ入って戻されたとき: 巻き戻しの音と暗転
 */
import * as THREE from 'three';
import { defineFx } from './fx.ts';
import { glowMaterial, playerInCell, ScreenVeil } from './common.ts';

defineFx('curtains', (spec, ctx) => {
  const hint = String(spec.params.hint);
  const wrong = new Set((spec.params.wrong as string[] | undefined) ?? []);
  const veil = new ScreenVeil(ctx, 0x000000);
  const objs: THREE.Object3D[] = [];
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  let glowMat: THREE.MeshBasicMaterial | null = null;
  if (hint === 'glow') {
    glowMat = glowMaterial(0x9dffb8, 0);
    mats.push(glowMat);
    // 矢印（「>」の形）: 床に貼る
    const shape = new THREE.Shape();
    shape.moveTo(0.22, 0); shape.lineTo(-0.18, 0.2); shape.lineTo(-0.26, 0.14); shape.lineTo(0.08, 0); shape.lineTo(-0.26, -0.14); shape.lineTo(-0.18, -0.2); shape.closePath();
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    geos.push(g);
    const y = ctx.sim.floor.cells.find((c) => c.id === spec.cell)?.floorY ?? 0;
    for (const m of (spec.params.marks as number[][] | undefined) ?? []) {
      const mesh = new THREE.Mesh(g, glowMat);
      mesh.position.set(m[0]!, y + 0.012, m[1]!);
      // 形の +x を、進む向き（yaw = atan2(dx, dz)）へ
      mesh.rotation.y = m[2]! - Math.PI / 2;
      objs.push(mesh);
    }
    // 手形（BL04）: 5 本の指と手のひら
    const hand = spec.params.hand as number[] | undefined;
    if (hand) {
      const d = hand[0]!, at = hand[1]!, wall = Number(spec.params.wall), hy = Number(spec.params.y ?? y) + 1.25;
      const inward = d === 0 || d === 1 ? -1 : 1;
      const alongX = d === 0 || d === 2;
      const bg = new THREE.BoxGeometry(1, 1, 1);
      geos.push(bg);
      const put = (u: number, v: number, w: number, h: number): void => {
        const m = new THREE.Mesh(bg, glowMat!);
        if (alongX) { m.scale.set(w, h, 0.005); m.position.set(at + u, hy + v, wall + inward * 0.01); } else { m.scale.set(0.005, h, w); m.position.set(wall + inward * 0.01, hy + v, at + u); }
        objs.push(m);
      };
      put(0, 0, 0.12, 0.12);
      for (const [u, h] of [[-0.06, 0.09], [-0.025, 0.12], [0.01, 0.13], [0.045, 0.11]] as const) put(u, 0.06 + h / 2, 0.022, h);
      put(-0.085, 0.0, 0.05, 0.022);
    }
  }
  for (const o of objs) ctx.root.add(o);
  const bell = spec.params.bell as number[] | undefined;
  const eyes = typeof spec.params.eyes === 'string' ? spec.params.eyes : null;
  let closed = 0, ring = 0, dark = 0, duck = 1;
  const off = ctx.onEvent?.((e) => {
    if (e.type === 'player.respawn' && wrong.has(String(e.data?.cause ?? ''))) {
      ctx.audio?.play('rewind', { gain: 0.8 });
      dark = 1;
    }
  }) ?? (() => {});
  return {
    update(_s, dt) {
      const inside = playerInCell(ctx, spec.cell);
      const p = ctx.sim.players[0];
      if (glowMat) {
        const want = inside && p && !p.flashlight ? 0.9 : 0;
        glowMat.opacity += (want - glowMat.opacity) * Math.min(1, dt * 2.5);
      }
      let eyesClosed = false;
      if (eyes) eyesClosed = inside && ctx.sim.outputOf(eyes, 'gazing') > 0.5;
      closed += ((eyesClosed ? 1 : 0) - closed) * Math.min(1, dt * (eyesClosed ? 1.8 : 6));
      const want = 1 - 0.45 * closed;
      if (eyes && Math.abs(want - duck) > 0.02) { duck = want; ctx.audio?.setDuck(`curtains:${spec.id}`, duck, 0.2); }
      ring -= dt;
      if (bell && closed > 0.6 && ring <= 0) { ctx.audio?.play('bell', { pos: bell as [number, number, number], gain: 1.4, pitch: 1.5 }); ring = 1.7; }
      dark = Math.max(0, dark - dt * 1.4);
      veil.set(Math.max(closed * 0.96, dark));
    },
    dispose() { off(); veil.dispose(); ctx.audio?.setDuck(`curtains:${spec.id}`, 1); for (const o of objs) o.removeFromParent(); for (const m of mats) m.dispose(); for (const g of geos) g.dispose(); },
  };
});
