import assert from 'node:assert/strict';
import {vehicleSurfaces,foliageGeometry,grassGeometry} from '../src/render/ObjectGeometry.ts';
const car=[{min:[-.86,.3,-2.15],max:[.86,.78,2.15],mat:'carPaint',solid:true,vehicle:{id:'test',body:true}},{min:[-.76,.78,-1],max:[.76,1.38,1.1],mat:'carGlass',solid:false,vehicle:{id:'test',body:false}},{min:[-.86,0,-1.8],max:[-.64,.62,-1.18],mat:'rubber',solid:false,vehicle:{id:'test',body:false}}];
for(const rotate of [false,true]){
 const input=structuredClone(car);if(rotate)for(const b of input){[b.min[0],b.min[2]]=[b.min[2],b.min[0]];[b.max[0],b.max[2]]=[b.max[2],b.max[0]];}
 const before=JSON.stringify(input),out=vehicleSurfaces(input);assert.equal(JSON.stringify(input),before,'render must not mutate collision boxes');
 let tris=0;
 for(const {geometry:g} of out){g.computeBoundingBox();const a=g.boundingBox;const widths=rotate?[2.15,1.38,.86]:[.86,1.38,2.15];for(let k=0;k<3;k++){assert(a.max.getComponent(k)<=widths[k]+.001);assert(a.min.getComponent(k)>=(k===1?-.001:-widths[k]-.001));}for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));tris+=g.getAttribute('position').count/3;g.dispose();}
 assert(tris<18000);assert(out.some(p=>p.box.mat==='carGlass'));console.log('car',rotate?'X':'Z',tris,'triangles, bounds and immutable colliders pass');
}
for(const size of [[.48,.95,.48],[3,.7,2],[.4,2,.4],[5,1.6,.4],[.2,.03,.5]]){
 const b={min:[3,.45,-2],max:[3+size[0],.45+size[1],-2+size[2]],mat:'plant',solid:false};const a=foliageGeometry(b),same=foliageGeometry(b),low=foliageGeometry(b,.45);assert.deepEqual(a.getAttribute('position').array,same.getAttribute('position').array);assert(low.getAttribute('position').count<=a.getAttribute('position').count);a.computeBoundingBox();for(let k=0;k<3;k++){assert(a.boundingBox.min.getComponent(k)>=b.min[k]-.001);assert(a.boundingBox.max.getComponent(k)<=b.max[k]+.001);}for(const g of [a,same,low])g.dispose();
}
console.log('foliage: 5 envelopes, deterministic leaf shape, low tier reduction pass');

for(const density of [.5,1]){const b={min:[-.2,0,-.3],max:[.2,.22,.3],mat:'grass',solid:false};const g=grassGeometry(b,density);g.computeBoundingBox();for(let k=0;k<3;k++){assert(g.boundingBox.min.getComponent(k)>=b.min[k]-.001);assert(g.boundingBox.max.getComponent(k)<=b.max[k]+.001);}assert(g.getAttribute('position').count/3<=132);g.dispose();}
console.log('grass: original envelope retained, <=132 triangles per clump');
