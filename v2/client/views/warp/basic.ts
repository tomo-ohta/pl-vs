/**
 * 空間のゆがみの基本の部品の描画: 控え室の表示灯（warpIndicator）・見ていない間に差し替える箱（swapSet）・
 * くり返す廊下の音（warpTreadmill: 輪がほどけたときの遠い音）。
 */
import * as THREE from 'three';
import type { EntitySpec } from '../../../core/world/layout.ts';
import { defineView, type ViewContext } from '../views.ts';
import { cellBoxes, cellOfBoxes, glowBox, type PartBox } from './common.ts';

// ---------------------------------------------------------------- 控え室の表示灯（入れるとき緑・入れないとき赤）
defineView('warpIndicator', (spec, ctx) => {
  const p = (spec.params.pos as number[] | undefined) ?? [0, 0, 0];
  const dir = typeof spec.params.dir === 'number' ? spec.params.dir : 0;
  const alongX = dir === 0 || dir === 2;
  const g = glowBox(alongX ? [0.14, 0.05, 0.03] : [0.03, 0.05, 0.14], 0x4cff7a);
  g.mesh.position.set(p[0]!, p[1]!, p[2]!);
  ctx.root.add(g.mesh);
  const on = new THREE.Color(0x4cff7a), off = new THREE.Color(0xff3a30);
  const m = g.mesh.material as THREE.MeshBasicMaterial;
  return {
    update(s) { m.color.copy(s.on ? on : off); },
    dispose() { g.dispose(); },
  };
});

// ---------------------------------------------------------------- 見ていない間に差し替える箱
/** 差し替える箱の組（区画 i・組 j）ごとのメッシュ。状態 cur[i] の組だけを見せる */
export function swapView(spec: EntitySpec, ctx: ViewContext, slotsKey = 'slots'): { update(cur: readonly number[]): void; dispose(): void } {
  const slots = (spec.params[slotsKey] as unknown as { variants: PartBox[][] }[] | undefined) ?? [];
  const groups: { group: THREE.Group; dispose(): void }[][] = slots.map((slot) => slot.variants.map((boxes) => {
    const cell = cellOfBoxes(ctx.built, boxes, spec.cell);
    const g = cellBoxes(ctx.materials, ctx.built, boxes.filter((b) => b.mat !== 'colliderOnly'), cell);
    g.group.visible = false;
    ctx.root.add(g.group);
    return g;
  }));
  return {
    update(cur) { groups.forEach((vs, i) => vs.forEach((g, j) => { g.group.visible = (cur[i] ?? 0) === j; })); },
    dispose() { for (const vs of groups) for (const g of vs) g.dispose(); },
  };
}

defineView('swapSet', (spec, ctx) => {
  const v = swapView(spec, ctx);
  // 変わったとき、その場所で小さな物音（params.sound: 'none' で鳴らさない）。背後で何かが動いた気配
  const sound = typeof spec.params.sound === 'string' ? spec.params.sound : 'thud';
  const off = sound === 'none' ? undefined : ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || e.data?.name !== 'swap.change') return;
    ctx.audio?.play(sound, { pos: e.pos, gain: 0.18, lowpassHz: 900 });
  });
  return {
    update(s) { v.update((s.cur as number[] | undefined) ?? []); },
    dispose() { off?.(); v.dispose(); },
  };
});

// ---------------------------------------------------------------- くり返す廊下（輪がほどけた音）
defineView('warpTreadmill', (spec, ctx) => {
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || e.data?.name !== 'loop.open') return;
    ctx.audio?.play('clank', { gain: 0.5 });
  });
  return { update() {}, dispose() { off?.(); } };
});
