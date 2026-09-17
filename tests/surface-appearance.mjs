import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { writeSurfaceCoordinates } from '../src/render/SurfaceAppearance.ts';
import { usesSurfaceVariation, addSurfaceAppearance, appearanceSeed, doorSurfaceId, attachSurfaceAppearance, corridorWearRegion, corridorDustRegion, wetWallBoxes } from '../src/render/SurfaceAppearance.ts';

// Side faces of a rounded door retain vertical grain even at the curved corners.
const door=new RoundedBoxGeometry(1,2.1,.12,1,.018);
const topology=Array.from(door.getAttribute('position').array);
writeSurfaceCoordinates(door,1.1,'doorWood');
for(const group of door.groups){
  if(Math.floor(group.materialIndex/2)===1)continue;
  for(let i=group.start;i<group.start+group.count;i++)assert(Math.abs(door.getAttribute('uv').getY(i)-door.getAttribute('position').getY(i)/1.1)<1e-6);
}
assert.deepEqual(Array.from(door.getAttribute('position').array),topology,'UV repair cannot change silhouette/collision geometry');
const saved=Array.from(door.getAttribute('uv').array);
door.rotateY(Math.PI/2);assert.deepEqual(Array.from(door.getAttribute('uv').array),saved,'Placement rotation carries the grain with the object');

// A lintel should have longitudinal grain, not the vertical grain of its jambs.
const lintel=new THREE.BoxGeometry(1.2,.065,.18);writeSurfaceCoordinates(lintel,1.1,'trim');
for(const group of lintel.groups){
  if(Math.floor(group.materialIndex/2)===0)continue;
  for(let j=group.start;j<group.start+group.count;j++){const i=lintel.index.getX(j);assert(Math.abs(lintel.getAttribute('uv').getY(i)-lintel.getAttribute('position').getX(i)/1.1)<1e-6);}
}

// Rendering chunks are not a new texture origin: shared wall edges match exactly.
function edge(x){const g=new THREE.BoxGeometry(4,3,.15);g.translate(x,1.5,0);writeSurfaceCoordinates(g,1,'wallWhite');const p=g.getAttribute('position'),uv=g.getAttribute('uv');const result=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-4)<1e-6&&p.getZ(i)>0)result.push([p.getY(i),uv.getX(i),uv.getY(i)]);g.dispose();return result.sort((a,b)=>a[0]-b[0]);}
assert.deepEqual(edge(2),edge(6));
assert(usesSurfaceVariation('wallWhite'));assert(usesSurfaceVariation('floorCarpetGrey'));
for(const id of ['water','skyWhite','floorWood','floorTile','lightPanel','doorWood','untextured'])assert(!usesSurfaceVariation(id),`Exclude ${id}`);
const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n// existing gradient/fog code',uniforms:{}};
addSurfaceAppearance(shader,true,{value:1},{value:1});assert(shader.fragmentShader.includes('// existing gradient/fog code'));
assert(shader.fragmentShader.includes('vRoomPos*0.22'));assert(!shader.fragmentShader.includes('surfaceTime'));
door.dispose();lintel.dispose();console.log('V03: bevel grain, lintel direction, chunk seams, rigid placement, geometry preservation and material exclusions passed');

const seed=appearanceSeed(42,'room-a','wallWhite');
assert.equal(seed,appearanceSeed(...JSON.parse(JSON.stringify([42,'room-a','wallWhite']))));
assert.notEqual(seed,appearanceSeed(43,'room-a','wallWhite'));
assert.notEqual(seed,appearanceSeed(42,'room-b','wallWhite'));
assert.notEqual(seed,appearanceSeed(42,'room-a','floorCarpetGrey'));
const owner={portalId:'p0',isReturn:false};
assert.equal(doorSurfaceId('a',owner),doorSurfaceId('b',{portalId:'back',isReturn:true,targetRoomId:'a',targetPortalId:'p0'}));
assert.equal(doorSurfaceId('a',owner),doorSurfaceId('a',{...owner,targetRoomId:'b',targetPortalId:'back'}));
const rects=[{x0:0,x1:3,z0:0,z1:12}];
assert.deepEqual(corridorWearRegion({min:[0,-.1,0],max:[3,0,4]},rects),corridorWearRegion({min:[0,-.1,4],max:[3,0,8]},rects));
assert.deepEqual(corridorWearRegion({min:[20,0,20],max:[21,0,21]},rects),[0,0,0,0]);
const g=new THREE.BoxGeometry(1,2,.1),positions=Array.from(g.attributes.position.array);
attachSurfaceAppearance(g,seed,[3,.38,-1,1]);
assert.deepEqual(Array.from(g.attributes.position.array),positions);
assert.equal(g.attributes.surfaceSeed.count,g.attributes.position.count);
assert.equal(g.attributes.surfaceWear.getX(0),3);
assert.equal(g.attributes.surfaceSeed.getX(0),seed);
g.dispose();
console.log('Appearance: stable seed, room/material independence, return door ownership, chunk-continuous wear and topology passed');

const dust=corridorDustRegion({min:[0,-.1,0],max:[3,0,4]},rects);
assert.deepEqual(dust,[1,1.5,1.35,0]);
assert.deepEqual(dust,corridorDustRegion({min:[0,-.1,4],max:[3,0,8]},rects));
assert.deepEqual(corridorDustRegion({min:[0,0,0],max:[3,0,4]},[...rects,{x0:3,x1:6,z0:0,z1:3}]),[0,0,0,0]);
const envGeo=new THREE.BoxGeometry(1,1,1);
attachSurfaceAppearance(envGeo,123,[0,0,0,0],[2,.25,0,0]);
assert.equal(envGeo.attributes.surfaceEnvironment.getY(0),.25);
assert.equal(envGeo.attributes.surfaceEnvironment.count,envGeo.attributes.position.count);
envGeo.dispose();
console.log('Environment: chunk-consistent dust bounds, junction exclusion and wet-level attributes passed');

const originalWall={min:[0,0,0],max:[10,3,.15],mat:'floorTile',solid:true};
const originalJSON=JSON.stringify(originalWall);
const waterPieces=[{min:[2,.23,0],max:[4,.25,5]},{min:[6,.23,0],max:[8,.25,5]}];
const walls=wetWallBoxes([originalWall],waterPieces,'floorTile');
assert.equal(JSON.stringify(originalWall),originalJSON,'render split cannot mutate collision source');
assert.deepEqual(walls.map(b=>[b.min[0],b.max[0],b.environment?.[1]??null]),[[0,2,null],[2,4,.25],[4,6,null],[6,8,.25],[8,10,null]]);
assert.equal(walls.reduce((sum,b)=>sum+b.max[0]-b.min[0],0),10);
assert.deepEqual(wetWallBoxes([originalWall],[],'floorTile'),[originalWall]);
assert.deepEqual(wetWallBoxes([originalWall],[{min:[0,.23,10],max:[10,.25,12]}],'floorTile'),[originalWall]);
const crossWall={min:[0,0,0],max:[.15,3,10],mat:'floorTile',solid:true};
assert.deepEqual(wetWallBoxes([crossWall],[{min:[0,.23,2],max:[5,.25,4]}],'floorTile').map(b=>[b.min[2],b.max[2],!!b.environment]),[[0,2,false],[2,4,true],[4,10,false]]);
console.log('Wet walls: real water coverage, dry gaps, perpendicular walls, empty water, original geometry contract passed');
