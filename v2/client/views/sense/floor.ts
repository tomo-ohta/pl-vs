/**
 * 光の床（lightFloor）の描画: 床板は加算合成で光る薄い板（床がある間だけ光る。消えかけは暗くなる）。
 * - beam: 照らす前の床板はかすかに輪郭だけ光る（ここに床があると分かる）
 * - spot: 天井から床へ降りる光の円錐（薄い筒）。床板は円の中だけ光る
 * - bands: 天井の細い隙間（光る線）と、帯へ落ちる光の幕。消える前は瞬く
 * - seen: 橋は淡く光る板。見ていない間に消え、見た瞬間に浮かび上がる（0.25 秒で）
 */
import * as THREE from 'three';
import { bandPhase } from '../../../core/sim/parts/sense/floor.ts';
import { defineView } from '../views.ts';
import { glowMaterial, GlowBoxes, simTime } from './common.ts';

defineView('lightFloor', (spec, ctx) => {
  const tiles = (spec.params.tiles as number[][] | undefined) ?? [];
  if (!tiles.length) return null;
  const y = Number(spec.params.y ?? 0);
  const mode = String(spec.params.mode ?? 'beam');
  const grace = Math.max(0.05, Number(spec.params.grace ?? 0.8));
  const color = typeof spec.params.color === 'number' ? spec.params.color : 0xcfe8ff;
  const boxes = new GlowBoxes(ctx.root, tiles, y - 0.06, y - 0.005, color, mode === 'bands' ? 0.02 : 0.025);
  const shown = new Float32Array(tiles.length);
  const extras: { dispose(): void }[] = [];
  const ceiling = Number(spec.params.ceilingY ?? y + 2.8);

  // 光の円錐（spot）: 半径 R の筒を天井から床へ
  let cone: THREE.Mesh | null = null;
  if (mode === 'spot') {
    const R = Number(spec.params.spotRadius ?? 1);
    const g = new THREE.CylinderGeometry(R * 0.35, R, ceiling - y, 24, 1, true);
    const m = glowMaterial(color, 0.07);
    cone = new THREE.Mesh(g, m);
    ctx.root.add(cone);
    extras.push({ dispose: () => { cone!.removeFromParent(); g.dispose(); m.dispose(); } });
  }
  // 帯（bands）: 天井の隙間と、光の幕（帯ごと）
  const shafts: THREE.Mesh[] = [];
  if (mode === 'bands') {
    const g = new THREE.BoxGeometry(1, 1, 1);
    for (const r of tiles) {
      const slit = new THREE.Mesh(g, glowMaterial(color, 0.9));
      slit.scale.set(r[2]! - r[0]!, 0.02, r[3]! - r[1]!);
      slit.position.set((r[0]! + r[2]!) / 2, ceiling - 0.02, (r[1]! + r[3]!) / 2);
      const shaft = new THREE.Mesh(g, glowMaterial(color, 0.06));
      shaft.scale.set(r[2]! - r[0]! - 0.1, ceiling - y - 0.05, r[3]! - r[1]! - 0.1);
      shaft.position.set((r[0]! + r[2]!) / 2, (ceiling + y) / 2, (r[1]! + r[3]!) / 2);
      ctx.root.add(slit, shaft);
      shafts.push(slit, shaft);
    }
    extras.push({ dispose: () => { for (const m of shafts) { m.removeFromParent(); (m.material as THREE.Material).dispose(); } g.dispose(); } });
  }
  const phases = (spec.params.phase as number[] | undefined) ?? [];
  const onSec = Number(spec.params.onSec ?? 4), offSec = Number(spec.params.offSec ?? 2), warn = Number(spec.params.warnSec ?? 1);
  let t = 0;
  return {
    update(s, dt) {
      t += dt;
      const lit = (s.lit as number[] | undefined) ?? [];
      const now = simTime(ctx.sim);
      for (let i = 0; i < tiles.length; i++) {
        const l = lit[i] ?? 0;
        let target = l > 0 ? (mode === 'beam' ? 0.35 + 0.65 * Math.min(1, l / grace) : 1) : (mode === 'beam' ? 0.04 : 0);
        if (mode === 'bands' && l > 0) {
          // 消える前は瞬く
          const left = bandPhase(now, onSec, offSec, phases[i] ?? 0);
          if (left < warn) target *= 0.45 + 0.55 * (Math.sin(t * 38) > 0 ? 1 : 0.15);
        }
        // 見ている間だけある橋は 0.25 秒で浮かび上がる。ほかは速く
        const rate = mode === 'seen' ? 4 : 14;
        shown[i] = shown[i]! + (target - shown[i]!) * Math.min(1, dt * rate);
        boxes.set(i, shown[i]! * (mode === 'seen' ? 0.55 : 0.9));
      }
      boxes.commit();
      if (cone) {
        const sp = (s.spot as number[] | undefined) ?? [0, 0];
        cone.position.set(sp[0]!, (ceiling + y) / 2, sp[1]!);
        (cone.material as THREE.MeshBasicMaterial).opacity = 0.06 + Math.sin(t * 3.1) * 0.01;
      }
      if (shafts.length) {
        for (let b = 0; b < tiles.length; b++) {
          const on = (lit[b] ?? 0) > 0 ? shown[b]! : 0;
          (shafts[2 * b]!.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.8 * on;
          (shafts[2 * b + 1]!.material as THREE.MeshBasicMaterial).opacity = 0.07 * on;
        }
      }
    },
    dispose() { boxes.dispose(); for (const e of extras) e.dispose(); },
  };
});
