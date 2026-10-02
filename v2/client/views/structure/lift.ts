/**
 * shaftLift（エレベーター。F24）の音と揺れの見た目: 扉が閉まって動き出すと低い動作音、着くとベル。
 * かごは各階にある区画なので、乗っている階のかごが見えていなくても鳴るように Cue（lift.ride / lift.arrive）で鳴らす。
 */
import * as THREE from 'three';
import { defineView } from '../views.ts';
import type { SoundHandle } from '../../audio/AudioEngine.ts';
import { disposeMesh, textPlate } from '../ground/util.ts';

/** エレベーターの階の表示（扉の上の数字。光る板） */
defineView('liftSign', (spec, ctx) => {
  const pos = (spec.params.pos as number[] | undefined) ?? [0, 0, 0];
  const plate = textPlate(String(spec.params.label ?? ''), 0.3, 0.16, { fg: '#ffd27a', bg: '#141210', px: 96 });
  plate.position.set(pos[0]!, pos[1]!, pos[2]!);
  if (Number(spec.params.facing ?? 1) < 0) plate.rotation.y = Math.PI;
  ctx.root.add(plate);
  return { update() {}, dispose() { disposeMesh(plate); } };
});

defineView('shaftLift', (spec, ctx) => {
  let hum: SoundHandle | null = null;
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id) return;
    const name = e.data?.name;
    if (name === 'lift.ride') {
      ctx.audio?.elevator('move', e.pos);
      hum?.stop(0.3);
      hum = ctx.audio?.play('elevatorHum', { loop: true, ...(e.pos ? { pos: e.pos } : {}), gain: 0.8 }) ?? null;
    } else if (name === 'lift.arrive') {
      hum?.stop(0.6);
      hum = null;
      ctx.audio?.elevator('bell', e.pos);
    }
  });
  // 見た目は持たない（扉は door、ボタンは button の描画）
  const group = new THREE.Group();
  ctx.root.add(group);
  return {
    update() {},
    dispose() { off?.(); hum?.stop(0.2); group.removeFromParent(); },
  };
});
