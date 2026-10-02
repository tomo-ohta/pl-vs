/**
 * 視線と観測の部品の描画。
 * - daruma: 鬼（着物の背の高い人形。面の目は振り返っている間だけ赤く光る）。数え歌の間は壁を向き、歌の 10 の音を鬼の所で鳴らす
 *   （歌が速いほど早く振り返る）。振り返るときにきしみ、捕まえると叫んで画面が乱れる
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import { glowMaterial, LitParts, onCue, playerInCell } from './common.ts';

/** 「だ・る・ま・さ・ん・が・こ・ろ・ん・だ」の高さ */
const CHANT = [1, 1, 1.12, 1.12, 1, 1, 1.26, 1.12, 1, 0.89];

defineView('daruma', (spec, ctx) => {
  const pos = spec.params.pos as number[];
  const yawWall = Number(spec.params.yaw ?? 0), yawRoom = Number(spec.params.yawRoom ?? 0);
  const parts = new LitParts(ctx);
  // 着物（下が広い）・帯・頭・面（前）
  parts.box([0.62, 0.9, 0.42], [0, 0.45, 0], 'seatRed');
  parts.box([0.5, 0.5, 0.34], [0, 1.15, 0], 'seatRed');
  parts.box([0.52, 0.1, 0.36], [0, 0.92, 0], 'goldTrim');
  parts.box([0.12, 0.6, 0.12], [-0.3, 1.05, 0.02], 'seatRed');
  parts.box([0.12, 0.6, 0.12], [0.3, 1.05, 0.02], 'seatRed');
  parts.sphere(0.17, [0, 1.58, 0], 'marbleWhite');
  parts.box([0.2, 0.08, 0.2], [0, 1.74, 0], 'furnitureDark');
  const eyeMat = glowMaterial(0xff2a1a, 0);
  const eyeGeo = new THREE.BoxGeometry(0.035, 0.02, 0.01);
  for (const x of [-0.055, 0.055]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, 1.6, 0.165); parts.group.add(e); }
  parts.group.position.set(pos[0]!, pos[1]!, pos[2]!);
  ctx.root.add(parts.group);
  const head: [number, number, number] = [pos[0]!, pos[1]! + 1.55, pos[2]!];
  let lastSyl = -1, lastPhase = -1, relight = 0, cycle = -1;
  const off = onCue(ctx, spec.id, (name) => {
    if (name !== 'daruma.caught') return;
    ctx.audio?.play('shout', { pos: head, gain: 1 });
    ctx.audio?.play('rewind', { gain: 0.6 });
    ctx.postfx?.videoPass?.forceJitter?.(30);
  });
  /** 角度 a → b を k で（近い回り方） */
  const turn = (a: number, b: number, k: number): number => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
  return {
    update(s, dt) {
      const phase = Number(s.phase ?? 0), t = Number(s.t ?? 0), dur = Math.max(1e-3, Number(s.dur ?? 1));
      const k = Math.min(1, t / dur), e = k * k * (3 - 2 * k);
      parts.group.rotation.y = phase === 0 ? yawWall : phase === 1 ? turn(yawWall, yawRoom, e) : phase === 2 ? yawRoom : turn(yawRoom, yawWall, e);
      eyeMat.opacity = phase === 2 ? 1 : phase === 1 ? e : phase === 3 ? 1 - e : 0;
      const inside = playerInCell(ctx, spec.cell);
      // 数え歌: 歌の長さを 10 等分して 1 音ずつ（新しい歌の始まりで数え直す）
      if (phase === 0) {
        if (Number(s.cycle ?? 0) !== cycle) { cycle = Number(s.cycle ?? 0); lastSyl = -1; }
        const syl = Math.min(CHANT.length - 1, Math.floor((t / dur) * CHANT.length));
        if (syl !== lastSyl && inside) ctx.audio?.play('syllable', { pos: head, pitch: CHANT[syl]!, gain: syl === CHANT.length - 1 ? 1.1 : 0.85 });
        lastSyl = syl;
      }
      if (phase !== lastPhase && phase === 1 && inside) ctx.audio?.play('creak', { pos: head, gain: 0.7 });
      lastPhase = phase;
      relight -= dt;
      if (relight <= 0) { relight = 0.4; parts.relight([pos[0]!, pos[1]! + 1.2, pos[2]!]); }
    },
    dispose() { off(); parts.dispose(); eyeMat.dispose(); eyeGeo.dispose(); },
  };
});
