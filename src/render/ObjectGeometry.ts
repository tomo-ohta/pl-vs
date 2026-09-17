/** Render-only anonymous late-1990s sedan. Generator boxes remain the collision authority. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box, MatId } from '../generators/layout';

export interface VehicleSurface { box: Box; geometry: THREE.BufferGeometry }
export function vehicleSurfaces(boxes: Box[]): VehicleSurface[] {
  const groups = new Map<string, Box[]>();
  for (const b of boxes) if (b.vehicle) { const list = groups.get(b.vehicle.id) ?? []; list.push(b); groups.set(b.vehicle.id, list); }
  const result: VehicleSurface[] = [];
  for (const members of groups.values()) {
    const body = members.find(b => b.vehicle?.body); if (!body) continue;
    const alongZ = body.max[2] - body.min[2] > body.max[0] - body.min[0];
    const width = alongZ ? body.max[0] - body.min[0] : body.max[2] - body.min[2];
    const length = alongZ ? body.max[2] - body.min[2] : body.max[0] - body.min[0];
    const bottom = Math.min(...members.map(b => b.min[1]));
    const height = Math.max(...members.map(b => b.max[1])) - bottom;
    const surfaces = sedan(body.mat);
    const envelope=new THREE.Box3();
    for(const g of surfaces.values()){g.computeBoundingBox();envelope.union(g.boundingBox!);}
    const size=envelope.getSize(new THREE.Vector3()), center=envelope.getCenter(new THREE.Vector3());
    for (const [mat, geometry] of surfaces) {
      geometry.translate(-center.x,-envelope.min.y,-center.z);
      geometry.scale(width / size.x, height / size.y, length / size.z);
      if (!alongZ) geometry.rotateY(Math.PI / 2);
      geometry.translate((body.min[0] + body.max[0]) / 2, bottom, (body.min[2] + body.max[2]) / 2);
      geometry.computeBoundingBox(); const bounds = geometry.boundingBox!;
      result.push({ box: { min: bounds.min.toArray(), max: bounds.max.toArray(), mat, solid: false }, geometry });
    }
  }
  return result;
}

function sedan(paint: MatId): Map<MatId, THREE.BufferGeometry> {
  const parts = new Map<MatId, THREE.BufferGeometry[]>();
  const add = (g: THREE.BufferGeometry, mat: MatId) => {
    if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
    const list = parts.get(mat) ?? []; list.push(g); parts.set(mat, list);
  };
  const block = (x: number,y: number,z: number,w: number,h: number,d: number,mat: MatId,r=.025) => {
    const g = new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)); g.translate(x,y,z); add(g,mat);
  };
  const quad = (v: number[][],mat: MatId) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i => v[i]),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));
    g.computeVertexNormals(); add(g,mat);
  };
  const rod = (a: number[], b: number[], radius: number, mat: MatId) => {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const g = new THREE.CylinderGeometry(radius,radius,delta.length(),8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    g.translate(...av.add(bv).multiplyScalar(.5).toArray()); add(g,mat);
  };
  // Side profile includes real wheel-arch openings (not wheels buried in a rectangular chassis).
  const profile = new THREE.Shape();
  profile.moveTo(-2.15,.26); profile.lineTo(-2.2,.55); profile.quadraticCurveTo(-2.12,.75,-1.8,.77);
  profile.lineTo(-.98,.8); profile.lineTo(1.05,.8); profile.lineTo(1.97,.7); profile.quadraticCurveTo(2.2,.66,2.2,.46); profile.lineTo(2.13,.25);
  for (const z of [1.4,-1.4]) {
    profile.lineTo(z+.39,.25); profile.lineTo(z+.39,.33);
    profile.absarc(z,.33,.39,0,Math.PI,false); profile.lineTo(z-.39,.25);
  }
  profile.closePath();
  const shell = new THREE.ExtrudeGeometry(profile,{depth:1.69,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.035,bevelThickness:.035,curveSegments:12});
  // shape coordinates (longitudinal,height,depth) -> (width,height,longitudinal)
  shell.applyMatrix4(new THREE.Matrix4().set(0,0,1,-.845, 0,1,0,0, -1,0,0,0, 0,0,0,1)); add(shell,paint);
  block(0,.28,0,1.42,.12,3.8,'metalDark');
  // Cabin: tapered roof, sloping front/rear glass and separated side lights.
  block(0,1.365,-.05,1.36,.07,1.48,paint,.035);
  quad([[-.78,.79,1.03],[.78,.79,1.03],[.65,1.33,.67],[-.65,1.33,.67]],'carGlass');
  quad([[.78,.79,-1.12],[-.78,.79,-1.12],[-.65,1.33,-.77],[.65,1.33,-.77]],'carGlass');
  for (const sign of [-1,1]) {
    const x = (y:number) => sign*(.79-(y-.8)*.25);
    const panels = [[-.98,-.12,-.12,-.69],[-.07,.92,.59,-.07]];
    for (const [a,b,c,d] of panels) {
      let vs = [[x(.84),.84,a],[x(.84),.84,b],[x(1.3),1.3,c],[x(1.3),1.3,d]];
      if(sign>0)vs=vs.reverse(); quad(vs,'carGlass');
    }
    for (const [a,b] of [[-1.11,-.77],[1.03,.67]]) rod([sign*.79,.8,a],[sign*.66,1.34,b],.029,paint);
    rod([sign*.785,.82,-.095],[sign*.658,1.33,-.095],.034,'rubber');
    rod([sign*.79,.81,-1.1],[sign*.79,.81,1.02],.017,'rubber');
    // Panel seams, handles and door mirrors: thin, dark gaps rather than oversized grooves.
    for(const z of [-1.0,-.095,.96]) rod([sign*.888,.39,z],[sign*.876,.73,z],.004,'metalDark');
    for(const z of [-.77,.15]) block(sign*.889,.705,z,.024,.035,.14,'metal');
    block(sign*.9,.88,.77,.12,.085,.16,paint,.025);
    block(sign*.9,.885,.715,.09,.055,.014,'carGlass',.008);
    for (const z of [-1.4,1.4]) {
      const tire = new THREE.TorusGeometry(.255,.075,10,32); tire.rotateY(Math.PI/2); tire.translate(sign*.815,.33,z); add(tire,'rubber');
      const wheel = new THREE.CylinderGeometry(.203,.203,.035,32); wheel.rotateZ(Math.PI/2); wheel.translate(sign*.876,.33,z); add(wheel,'metalDark');
      const rim = new THREE.TorusGeometry(.18,.015,6,32); rim.rotateY(Math.PI/2); rim.translate(sign*.9,.33,z); add(rim,'stainless');
      for (let k=0;k<8;k++){const t=k*Math.PI/4; rod([sign*.902,.33,z],[sign*.902,.33+Math.cos(t)*.165,z+Math.sin(t)*.165],.016,'metal');}
      const hub = new THREE.CylinderGeometry(.055,.055,.035,16); hub.rotateZ(Math.PI/2);hub.translate(sign*.902,.33,z);add(hub,'metal');
    }
  }
  block(0,.43,2.17,1.65,.12,.05,paint);
  block(0,.44,-2.17,1.65,.12,.05,paint);
  block(0,.57,2.16,.64,.13,.035,'metalDark');
  for(let k=0;k<4;k++)block(0,.525+k*.028,2.184,.6,.008,.012,'metal',.002);
  for(const sign of [-1,1]) {
    block(sign*.61,.625,2.11,.38,.125,.06,'lightOff',.018);
    block(sign*.61,.65,-2.135,.38,.11,.05,'plasticRed',.015);
  }
  block(0,.43,2.202,.38,.075,.009,'paintWhite',.002);
  block(0,.51,-2.204,.38,.075,.009,'paintWhite',.002);
  // Dark interior prevents the transmissive windows from revealing an empty shell.
  block(0,.73,.05,1.42,.12,1.9,'metalDark');
  block(0,.86,.76,1.35,.14,.22,'rubber');
  for(const x of [-.38,.38]) {block(x,1.0,-.17,.48,.43,.16,'upholstery',.06);block(x,1.23,-.17,.25,.16,.12,'upholstery',.035);}
  const merged = new Map<MatId,THREE.BufferGeometry>();
  for(const [mat,geos] of parts){const g=mergeGeometries(geos,false);geos.forEach(x=>x.dispose());if(g)merged.set(mat,g);}
  return merged;
}

/** Botanical fallback: curved lanceolate leaves along forked shoots, within the old foliage envelope. */
export function foliageGeometry(b: Box, density = 1, maxLeaves = 260): THREE.BufferGeometry {
  const w=b.max[0]-b.min[0], h=b.max[1]-b.min[1], d=b.max[2]-b.min[2];
  const center=new THREE.Vector3((b.min[0]+b.max[0])/2,b.min[1],(b.min[2]+b.max[2])/2);
  // Local deterministic stream; never touches the generator RNG.
  let seed=(Math.imul(Math.round(center.x*1000),73856093)^Math.imul(Math.round(center.z*1000),19349663)^Math.round(h*1000))>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const pos:number[]=[],uv:number[]=[];
  const triangle=(a:THREE.Vector3,c:THREE.Vector3,e:THREE.Vector3)=>{pos.push(...a.toArray(),...c.toArray(),...e.toArray());uv.push(0,0,.5,1,1,0);};
  const count=Math.max(12,Math.min(maxLeaves,Math.round((w*d*85+40)*density)));
  for(let i=0;i<count;i++){
    const angle=rand()*Math.PI*2, radius=Math.sqrt(rand());
    const y=.18+rand()*.67;
    const canopy=Math.sqrt(Math.max(.1,1-((y-.55)/.55)**2));
    const p=new THREE.Vector3(Math.cos(angle)*radius*w*.30*canopy,y*h,Math.sin(angle)*radius*d*.30*canopy).add(center);
    const len=Math.min(.24,h*.24,Math.min(w,d)*.18)*(.65+rand()*.7), breadth=len*(.22+rand()*.1);
    const forward=new THREE.Vector3(Math.cos(angle),rand()*.8-.25,Math.sin(angle)).normalize();
    const side=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
    const root=p.clone().addScaledVector(forward,-len*.5),tip=p.clone().addScaledVector(forward,len*.5);
    const ridge=p.clone().add(new THREE.Vector3(0,len*.1,0));
    const left=p.clone().addScaledVector(side,breadth),right=p.clone().addScaledVector(side,-breadth);
    for(const [a,c,e] of [[root,left,ridge],[left,tip,ridge],[tip,right,ridge],[right,root,ridge]]){triangle(a,c,e);triangle(e,c,a);}
    // Thin petiole connects the leaf to its shoot.
    const stem=p.clone().addScaledVector(forward,-len*.75).add(new THREE.Vector3(0,-Math.min(.05,h*.08),0));
    const offset=side.clone().multiplyScalar(.004);
    triangle(stem.clone().add(offset),root,stem.clone().sub(offset));
    triangle(stem.clone().sub(offset),root,stem.clone().add(offset));
    const shoot=center.clone().add(new THREE.Vector3(0,h*(.12+rand()*.2),0));
    triangle(shoot.clone().add(offset),stem,shoot.clone().sub(offset));
    triangle(shoot.clone().sub(offset),stem,shoot.clone().add(offset));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

/** Small overgrowth instances become bent grass blades, retaining their original envelope. */
export function grassGeometry(b: Box, density = 1): THREE.BufferGeometry {
  const w=b.max[0]-b.min[0],h=b.max[1]-b.min[1],d=b.max[2]-b.min[2];
  const positions:number[]=[],uv:number[]=[];
  for(let i=0;i<Math.max(6,Math.round(22*density));i++){
    const a=i*2.39996323, r=Math.sqrt(((i*37)%101)/101)*.32;
    const x=(b.min[0]+b.max[0])/2+Math.cos(a)*r*w,z=(b.min[2]+b.max[2])/2+Math.sin(a)*r*d;
    const length=h*(.55+((i*13)%17)/40),width=Math.min(w,d)*.035;
    const sides=new THREE.Vector3(Math.sin(a)*width,0,-Math.cos(a)*width),lean=new THREE.Vector3(Math.cos(a)*w*.1,0,Math.sin(a)*d*.1);
    const root=new THREE.Vector3(x,b.min[1],z),mid=root.clone().addScaledVector(lean,.4).add(new THREE.Vector3(0,length*.55,0)),tip=root.clone().add(lean).add(new THREE.Vector3(0,length,0));
    const v=[root.clone().sub(sides),root.clone().add(sides),mid.clone().addScaledVector(sides,.55),mid.clone().addScaledVector(sides,-.55),tip];
    for(const face of [[0,1,2],[0,2,3],[3,2,4]])for(const ids of [face,[...face].reverse()]){positions.push(...ids.flatMap(k=>v[k].toArray()));uv.push(0,0,1,0,.5,1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
