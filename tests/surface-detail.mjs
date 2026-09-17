import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSurfaceMaps} from '../src/render/SurfaceDetail.ts';
for(const kind of ['wallpaper','carpet','ceiling','wood','concrete','tile','metal','linoleum','cardboard','foliage','diffuser','water','sky','paint','rubber','glass']) {
 const maps=createSurfaceMaps(kind),again=createSurfaceMaps(kind);
 for(const key of ['detail','normal','ao']){const t=maps[key];assert.equal(t.colorSpace,THREE.NoColorSpace);assert.equal(t.channel,0);assert.deepEqual(t.image.data,again[key].image.data);assert.equal(t.wrapS,THREE.RepeatWrapping);}
 const d=maps.detail.image.data,n=maps.normal.image.data,ao=maps.ao.image.data;
 for(let y=0;y<256;y+=7)for(let x=0;x<256;x+=7){const i=(y*256+x)*4;const delta=d[(((y+1)%256)*256+x)*4]-d[(((y+255)%256)*256+x)*4];if(Math.abs(delta)>2)assert.equal(Math.sign(127.5-n[i+1]),Math.sign(delta),'normal +Y must oppose positive height slope, including wrapped border');assert(n[i+2]>=128);assert(ao[i]>=219);assert(d[i+1]>=190);}
 for(const t of [...Object.values(maps),...Object.values(again)])t.dispose();
}
console.log('16 detail families: deterministic maps, linear colorspace, AO UV0, wrapped +Y normal derivatives, bounded AO/roughness passed');
