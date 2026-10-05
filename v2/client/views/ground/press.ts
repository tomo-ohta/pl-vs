/**
 * 落ちてくる天井の描画: ceilingPress（天井から下りてくるコンクリートの塊と下の端の黄色い縁・床に落ちる影・予告の粉・落ちる音）。
 * 塊は天井から下の端までだけを描く（天井の上へはみ出さない）。影は予告の間に濃くなる（規則を見せる: 影が濃い所に立たない）
 */
import * as THREE from 'three';
import { IS_MOBILE } from '../../device.ts';
import { defineView } from '../views.ts';
import { aabbOf, boxGeo, glowMaterial, lightAt, noise, onCue, setBaked, tone } from './util.ts';

defineView('ceilingPress', (spec, ctx) => {
  const b = aabbOf(spec.params.box);
  const y = typeof spec.params.y === 'number' ? spec.params.y : b.min[1];
  const H = b.max[1] - b.min[1];
  const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2];
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const g = boxGeo([w, 1, d], 'wallConcrete');
  const block = new THREE.Mesh(g, ctx.materials.get('wallConcrete'));
  const edgeGeo = boxGeo([w + 0.02, 0.1, d + 0.02], 'yellowLine');
  const edge = new THREE.Mesh(edgeGeo, ctx.materials.get('yellowLine'));
  ctx.root.add(block, edge);
  // 床の影（予告の間に濃くなる）
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.96), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(cx, y + 0.006, cz);
  ctx.root.add(shadow);
  // 予告の粉: 塊の下の端から落ちる点
  const N = IS_MOBILE ? 24 : 60;
  const dustPos = new Float32Array(N * 3);
  const seeds = new Float32Array(N * 3);
  let k = 7;
  const rnd = (): number => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (let i = 0; i < N; i++) { seeds[i * 3] = rnd(); seeds[i * 3 + 1] = rnd(); seeds[i * 3 + 2] = rnd(); }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xb8b2a6, size: 0.035, transparent: true, opacity: 0.8, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  ctx.root.add(dust);
  // 潰されたときの一瞬の赤
  const flashMat = glowMaterial(0xff2a1a, 0);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(w, d), flashMat);
  flash.rotation.x = -Math.PI / 2;
  flash.position.set(cx, y + 0.01, cz);
  ctx.root.add(flash);
  let flashT = 0, dustT = 0, relight = 0;
  const off = onCue(ctx, spec.id, (name, at) => {
    if (name === 'press.warn') noise(ctx.audio, { pos: at, gain: 0.1, dur: 1.1, lowpass: 220, attack: 0.3 });
    else if (name === 'press.land') { noise(ctx.audio, { pos: at, gain: 0.45, dur: 0.6, lowpass: 320 }); tone(ctx.audio, 46, { pos: at, gain: 0.25, dur: 0.5, type: 'sine', freqTo: 30 }); }
    else if (name === 'press.rise') noise(ctx.audio, { pos: at, gain: 0.05, dur: 1.3, lowpass: 600, attack: 0.2 });
    else if (name === 'press.hit') { flashT = 0.5; tone(ctx.audio, 70, { gain: 0.3, dur: 0.35, type: 'square', freqTo: 40 }); }
  });
  return {
    update(s, dt) {
      const h = Number(s.h ?? H - 0.3);
      const phase = Number(s.phase ?? 0);
      const warn = Number(s.warn ?? 0);
      const len = Math.max(0.3, H - h);
      block.scale.set(1, len, 1);
      block.position.set(cx, y + h + len / 2, cz);
      edge.position.set(cx, y + h + 0.05, cz);
      shadowMat.opacity = phase === 1 ? 0.15 + 0.5 * warn : phase === 2 ? 0.75 : phase === 4 ? 0.4 * (1 - h / Math.max(0.1, H - 0.3)) : 0;
      // 粉: 予告と落ちる間だけ。帯の上を散らばって落ちる
      dustT += dt;
      const on = phase === 1 || phase === 2;
      dust.visible = on;
      if (on) {
        for (let i = 0; i < N; i++) {
          const fall = ((dustT * (0.9 + seeds[i * 3 + 2]! * 0.8) + seeds[i * 3 + 2]!) % 1) * (y + h - y);
          dustPos[i * 3] = b.min[0] + seeds[i * 3]! * w;
          dustPos[i * 3 + 1] = y + h - fall;
          dustPos[i * 3 + 2] = b.min[2] + seeds[i * 3 + 1]! * d;
        }
        (dustGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }
      flashT = Math.max(0, flashT - dt);
      flashMat.opacity = flashT;
      relight -= dt;
      if (relight <= 0) { relight = 0.25; const l = lightAt(ctx, [cx, y + Math.max(0.5, h - 0.2), cz]); setBaked(g, l); setBaked(edgeGeo, l); }
    },
    dispose() {
      off();
      for (const m of [block, edge, shadow, dust, flash]) m.removeFromParent();
      g.dispose(); edgeGeo.dispose(); shadow.geometry.dispose(); shadowMat.dispose(); dustGeo.dispose(); dustMat.dispose(); flash.geometry.dispose(); flashMat.dispose();
    },
  };
});
