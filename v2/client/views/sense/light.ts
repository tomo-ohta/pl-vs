/**
 * 光と闇の部品の描画。
 * - darkHazard: 暗闇にいる間、画面が端から黒くなり（たまった暗さ）、鼓動が速くなる。捕まると巻き戻しの音と画面の乱れ
 * - searchlight: 帯ごとに、床の光の円と、壁の器具から円へ落ちる光の筒。円の近くで低いうなり。見つかると警報と赤い閃光
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { glowMaterial, onCue, playerInCell, ScreenVeil } from './common.ts';

defineView('darkHazard', (spec, ctx) => {
  const veil = new ScreenVeil(ctx, 0x000000);
  const grace = Number(spec.params.grace ?? 1.3);
  let beat = 0, flash = 0;
  const off = onCue(ctx, spec.id, (name) => {
    if (name !== 'dark.caught') return;
    ctx.audio?.play('rewind', { gain: 0.8 });
    ctx.audio?.play('whisper', { gain: 0.6 });
    ctx.postfx?.videoPass?.forceJitter?.(40);
    flash = 1;
  });
  return {
    update(s, dt) {
      const inside = playerInCell(ctx, spec.cell);
      const d = inside ? Math.min(1, Number((s.dark as Record<string, number> | undefined)?.p1 ?? 0) / grace) : 0;
      flash = Math.max(0, flash - dt * 1.6);
      veil.set(Math.max(d * 0.8, flash));
      // 鼓動: 暗さがたまるほど速く・大きく
      beat -= dt;
      if (d > 0.12 && beat <= 0) { ctx.audio?.play('heartbeat', { gain: 0.35 + 0.6 * d }); beat = 0.95 - 0.5 * d; }
    },
    dispose() { off(); veil.dispose(); },
  };
});

defineView('searchlight', (spec, ctx) => {
  const lanes = (spec.params.lanes as number[][] | undefined) ?? [];
  const rects = (spec.params.laneRects as number[][] | undefined) ?? [];
  const R = Number(spec.params.radius ?? 0.9);
  const y = Number(spec.params.y ?? 0);
  const discGeo = new THREE.CircleGeometry(R, 32);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = glowMaterial(0xfff2c0, 0.55);
  const beamGeo = new THREE.CylinderGeometry(0.09, R * 0.85, 1, 20, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beamMat = glowMaterial(0xfff2c0, 0.06);
  const items = lanes.map((l, k) => {
    const disc = new THREE.Mesh(discGeo, discMat);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    ctx.root.add(disc, beam);
    // 器具: 帯の両端の壁のうち近い方（円が往復する道の両端 a・b の外）
    const r = rects[k]!;
    const alongX = Math.abs(l[2]! - l[0]!) > Math.abs(l[3]! - l[1]!);
    const fixtures: [number, number][] = alongX ? [[r[0]!, (r[1]! + r[3]!) / 2], [r[2]!, (r[1]! + r[3]!) / 2]] : [[(r[0]! + r[2]!) / 2, r[1]!], [(r[0]! + r[2]!) / 2, r[3]!]];
    return { disc, beam, fixtures };
  });
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  let hum: ReturnType<NonNullable<typeof ctx.audio>['beacon']> | null = null;
  let red = 0;
  const veil = new ScreenVeil(ctx, 0xff2010, true);
  const off = onCue(ctx, spec.id, (name, e) => {
    if (name !== 'search.caught') return;
    ctx.audio?.play('alarm', { pos: e.pos as [number, number, number] | undefined, gain: 0.9 });
    red = 1;
  });
  return {
    update(s, dt) {
      const spots = (s.spots as number[][] | undefined) ?? [];
      let nearest: number[] | null = null, best = Infinity;
      const p = ctx.sim.players[0]!;
      items.forEach((it, k) => {
        const sp = spots[k] ?? [0, 0];
        it.disc.position.set(sp[0]!, y + 0.02, sp[1]!);
        // 光の筒: 近い方の器具から円へ
        const f = it.fixtures.slice().sort((a, b) => Math.hypot(a[0] - sp[0]!, a[1] - sp[1]!) - Math.hypot(b[0] - sp[0]!, b[1] - sp[1]!))[0]!;
        from.set(sp[0]!, y + 0.02, sp[1]!);
        to.set(f[0], y + 2.2, f[1]);
        dir.subVectors(to, from);
        const len = dir.length();
        it.beam.position.copy(from);
        it.beam.quaternion.setFromUnitVectors(up, dir.normalize());
        it.beam.scale.set(1, len, 1);
        const d = Math.hypot(sp[0]! - p.pos[0], sp[1]! - p.pos[2]);
        if (d < best) { best = d; nearest = sp; }
      });
      // うなり: 区画にいる間だけ、いちばん近い円の所
      const inside = playerInCell(ctx, spec.cell);
      if (inside && nearest && ctx.audio) {
        const pos: [number, number, number] = [nearest[0]!, y + 1.2, nearest[1]!];
        if (!hum || !hum.active) hum = ctx.audio.beacon('electricHum', pos, 0.5);
        else hum.setPos(pos);
      } else if (hum) { hum.stop(0.6); hum = null; }
      red = Math.max(0, red - dt * 1.5);
      veil.set(red * 0.45);
    },
    dispose() { off(); hum?.stop(0.2); veil.dispose(); for (const it of items) { it.disc.removeFromParent(); it.beam.removeFromParent(); } discGeo.dispose(); discMat.dispose(); beamGeo.dispose(); beamMat.dispose(); },
  };
});
