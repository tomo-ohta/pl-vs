// 可視ライトの枠と影の枠（updateLightBudget は v1 tests/light-budget.mjs から移植。ShadowSlots は v2 で足した確認）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShadowSlots, updateLightBudget, type ShadowSlotLight } from '../client/render/LightBudget.ts';

test('減衰・上限・受け渡し・ヒステリシス・品質の引き下げ', () => {
  const a = { visible: true, intensity: 4, userData: { baseIntensity: 4 } };
  const b = { visible: false, intensity: 0, userData: { baseIntensity: 4 } };
  updateLightBudget([{ light: a, d: 10 }, { light: b, d: 1 }], 1, 1 / 60);
  assert.ok(a.visible && a.intensity > 0 && a.intensity < 4, '外れるライトは減衰している間も描く');
  assert.ok(!b.visible, '受け渡しの間も枠の数を超えない');
  for (let i = 0; i < 100; i++) {
    updateLightBudget([{ light: a, d: 10 }, { light: b, d: 1 }], 1, 1 / 60);
    assert.ok(Number(a.visible) + Number(b.visible) <= 1);
  }
  assert.ok(!a.visible && b.visible && b.intensity > 3.5, '減衰が終わったら枠が移る');
  updateLightBudget([{ light: a, d: 0.99 }, { light: b, d: 1 }], 1, 1 / 60);
  assert.ok(b.visible, '距離の小さな揺れでは枠を取り替えない');
  updateLightBudget([{ light: a, d: 1 }, { light: b, d: 1 }], 0, 1 / 60);
  assert.ok(!a.visible && !b.visible, '品質を下げたら 0 枠を守る');
});

test('影の枠: 影を落とすライトは常に枠の数以下・近いライトへ減光してから受け渡す', () => {
  const mk = (): ShadowSlotLight => ({ visible: true, intensity: 1, userData: { baseIntensity: 1 }, castShadow: false, shadow: { intensity: 1 } });
  const near = mk(), far = mk();
  const slots = new ShadowSlots<ShadowSlotLight>({ hysteresis: 0.6, holdSec: 0.2, fadeSec: 0.2 });
  const released: ShadowSlotLight[] = [];
  const step = (dNear: number, dFar: number) => slots.update([{ light: near, d: dNear, lit: true }, { light: far, d: dFar, lit: true }], 1, 1 / 60, () => {}, (l) => released.push(l));
  step(9, 4); // 空き枠は近い方（far）で即埋まる
  assert.deepEqual(slots.holders, [far]);
  assert.ok(far.castShadow && !near.castShadow);
  let maxCasting = 0;
  for (let i = 0; i < 120; i++) { step(1, 4); maxCasting = Math.max(maxCasting, Number(near.castShadow) + Number(far.castShadow)); }
  assert.equal(maxCasting, 1, '受け渡しの間も影を落とすライトは 1 灯');
  assert.deepEqual(slots.holders, [near], '保持時間と減光のあとで近いライトへ移る');
  assert.ok(released.includes(far) && !far.castShadow && far.shadow.intensity === 1);
  assert.equal(near.shadow.intensity, 1, '受け取った影は増光し終わる');
  slots.clear(() => {});
  assert.equal(slots.holders.length, 0);
});
