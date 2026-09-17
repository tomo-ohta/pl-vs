import assert from 'node:assert/strict';
import { updateLightBudget } from '../src/render/LightBudget.ts';
const a={visible:true,intensity:4,userData:{baseIntensity:4}},b={visible:false,intensity:0,userData:{baseIntensity:4}};
updateLightBudget([{light:a,d:10},{light:b,d:1}],1,1/60);
assert(a.visible && a.intensity>0 && a.intensity<4,'Outgoing light must still render during its fade');
assert(!b.visible,'Do not exceed the slot cap during transition');
for(let i=0;i<100;i++){
  updateLightBudget([{light:a,d:10},{light:b,d:1}],1,1/60);
  assert(Number(a.visible)+Number(b.visible)<=1);
}
assert(!a.visible && b.visible && b.intensity>3.5,'Slot must transfer after fade');
updateLightBudget([{light:a,d:.99},{light:b,d:1}],1,1/60);
assert(b.visible,'Small distance jitter must not exchange the slot');
updateLightBudget([{light:a,d:1},{light:b,d:1}],0,1/60);
assert(!a.visible && !b.visible,'Quality reduction must honor zero slots');
console.log('Light budget: fade, cap, handoff, hysteresis, quality reduction passed');
