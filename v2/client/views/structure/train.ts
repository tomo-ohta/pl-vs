/**
 * trainRide（駅の車両。F35）の見た目と音: 走っている間、車両の奥の窓の外（暗いトンネル）を灯りの筋が流れる
 * （走り出しは遅く、だんだん速く。v1 VehicleRide の流光と同じ考え方）。走り出すと低い走行音、着く前にブレーキの音。
 * 音は Cue（train.depart / train.arrive / train.close / train.open）で鳴らす（区画が見えていなくても受け取る）。
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import type { SoundHandle } from '../../audio/AudioEngine.ts';

defineView('trainRide', (spec, ctx) => {
  const w = spec.params.windows as { x0: number; x1: number; z: number; y0: number; y1: number } | undefined;
  if (!w) return null;
  const aabb = spec.params.aabb as { min: number[]; max: number[] };
  const center: [number, number, number] = [(aabb.min[0]! + aabb.max[0]!) / 2, aabb.min[1]! + 1.2, (aabb.min[2]! + aabb.max[2]!) / 2];
  const ride = typeof spec.params.rideSec === 'number' ? spec.params.rideSec : 9;
  // 流れる灯り: 細長い光る板（照明に依らない色）。窓の帯の高さに、トンネルの壁ほどの奥に
  const n = 26;
  const geo = new THREE.BoxGeometry(1, 0.06, 0.04);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd29a, fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  mesh.visible = false;
  ctx.root.add(mesh);
  const span = w.x1 - w.x0 + 16;
  const seeds = Array.from({ length: n }, (_, i) => ({ u: (i / n) * span, y: w.y0 + ((i * 37) % 11) / 10 * (w.y1 - w.y0), len: 1.5 + ((i * 53) % 7) / 3, dz: ((i * 29) % 5) * 0.35 }));
  const m4 = new THREE.Matrix4();
  let shift = 0;
  let rumble: SoundHandle | null = null;
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id) return;
    const name = e.data?.name;
    if (name === 'train.depart') {
      rumble?.stop(0.5);
      rumble = ctx.audio?.play('subRumble', { loop: true, pos: center, gain: 0.9 }) ?? null;
      ctx.audio?.play('trainApproach', { pos: center, gain: 0.6 });
    } else if (name === 'train.arrive') {
      rumble?.stop(1.2);
      rumble = null;
      ctx.audio?.play('metalClank', { pos: center, gain: 0.5 });
    } else if (name === 'train.close' || name === 'train.open') {
      ctx.audio?.play('chime', { pos: center, gain: 0.35 });
    }
  });
  return {
    update(s, dt) {
      const riding = s.phase === 'ride';
      mesh.visible = riding;
      if (!riding) return;
      // 速さ: 走り出しと着く前はゆっくり（進み具合 0..1 の山）
      const p = Math.min(1, (typeof s.t === 'number' ? s.t : 0) / ride);
      const speed = 30 * Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
      shift = (shift + speed * dt) % span;
      seeds.forEach((q, i) => {
        const u = ((q.u + shift) % span + span) % span;
        m4.makeScale(q.len, 1, 1);
        m4.setPosition(w.x0 - 8 + u, q.y, w.z - q.dz);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { off?.(); rumble?.stop(0.2); mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});
