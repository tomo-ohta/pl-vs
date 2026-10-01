import * as THREE from 'three';

/** Metric, room-local UVs. Box face groups stay fixed across bevels: interpolated
 * normals must not choose a different projection halfway across one face.
 * Kept independent of MaterialLibrary so coordinate contracts can be tested. */
export function writeSurfaceCoordinates(g: THREE.BufferGeometry, meters: number, material: string): void {
  const pos=g.getAttribute('position'), normals=g.getAttribute('normal');
  const uv=new Float32Array(pos.count*2), faces=new Int8Array(pos.count).fill(-1);
  const isBox=g.type==='BoxGeometry'||g.type==='RoundedBoxGeometry';
  if(isBox) for(const group of g.groups){
    const axis=Math.floor((group.materialIndex??0)/2);
    for(let j=group.start;j<group.start+group.count;j++) faces[g.index?g.index.getX(j):j]=axis;
  }
  let grainAxis=1;
  if(material==='floorWood')grainAxis=2;
  if(material==='trim'){
    g.computeBoundingBox();const size=g.boundingBox!.getSize(new THREE.Vector3());
    grainAxis=size.y>.3?1:size.x>=size.z?0:2;
  }
  const timber=/^(doorWood|trim|furnitureDark|furnitureLight|floorWood)$/.test(material);
  for(let i=0;i<pos.count;i++){
    const p=[pos.getX(i),pos.getY(i),pos.getZ(i)];
    const n=[Math.abs(normals.getX(i)),Math.abs(normals.getY(i)),Math.abs(normals.getZ(i))];
    const axis=faces[i]>=0?faces[i]:n[1]>=n[0]&&n[1]>=n[2]?1:n[0]>n[2]?0:2;
    let ua=axis===0?2:0, va=axis===1?2:1;
    if(timber&&grainAxis!==axis){va=grainAxis;ua=3-axis-grainAxis;}
    uv[i*2]=p[ua]/meters;uv[i*2+1]=p[va]/meters;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}

export const SURFACE_VARIATION_KEY = 'surface-environment-1';
export function usesSurfaceVariation(id: string): boolean {
  return /^(wall(Beige|White|Cream|Green|Dark|Concrete)|floor(CarpetGrey|CarpetRed|Concrete)|columnConcrete)$/.test(id);
}
export function usesSurfaceWear(id: string): boolean {
  return /^(door(Wood|Metal)|floor(CarpetGrey|CarpetRed|Concrete|Lino|Tile|Wood))$/.test(id);
}
/** Stateless appearance hash. Does not consume the layout/modifier RNG. */
export function appearanceSeed(worldSeed: number, roomId: string, surfaceId: string): number {
  const key=JSON.stringify([worldSeed>>>0,roomId,surfaceId]);
  let h=0x811c9dc5;
  for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return (h>>>0)%65521; // exactly representable in a float vertex attribute
}
/** The return panel uses the owner's ID before/after a target is generated. */
export function doorSurfaceId(roomId: string, portal: {portalId:string;isReturn:boolean;targetRoomId?:string;targetPortalId?:string;mirrorOf?:string}): string {
  return portal.isReturn && portal.targetRoomId && portal.targetPortalId
    ? `${portal.targetRoomId}/${portal.targetPortalId}` : `${roomId}/${portal.mirrorOf??portal.portalId}`;
}
export type WearRegion = [number,number,number,number];
/** x: 0=none, 1=path along Z, 2=path along X, +/-3=door (handedness).
 * Floor y/z/w: center across path / floor height / band radius.
 * Door y/z/w: canonical knob X / bottom Y / knob height above bottom. */
export function attachSurfaceAppearance(g: THREE.BufferGeometry, seed: number, region: WearRegion=[0,0,0,0], environment: WearRegion=[0,0,0,0]): void {
  const n=g.getAttribute('position').count, data=new Float32Array(n*4);
  for(let i=0;i<n;i++)data.set(region,i*4);
  const env=new Float32Array(n*4);for(let i=0;i<n;i++)env.set(environment,i*4);
  g.setAttribute('surfaceEnvironment',new THREE.Float32BufferAttribute(env,4));
  g.setAttribute('surfaceSeed',new THREE.Float32BufferAttribute(new Float32Array(n).fill(seed),1));
  g.setAttribute('surfaceWear',new THREE.Float32BufferAttribute(data,4));
}
export function corridorWearRegion(box: {min: number[];max: number[]}, rects: {x0:number;x1:number;z0:number;z1:number}[]): WearRegion {
  const x=(box.min[0]+box.max[0])/2,z=(box.min[2]+box.max[2])/2;
  const rect=rects.find(r=>x>=r.x0-.01&&x<=r.x1+.01&&z>=r.z0-.01&&z<=r.z1+.01);
  if(!rect)return [0,0,0,0];
  const alongZ=rect.z1-rect.z0>=rect.x1-rect.x0;
  return [alongZ?1:2,alongZ?(rect.x0+rect.x1)/2:(rect.z0+rect.z1)/2,box.max[1],
    Math.max(.3,Math.min(.85,(alongZ?rect.x1-rect.x0:rect.z1-rect.z0)*.27))];
}
/** Long wall junctions only; no dust at rectangle ends or shared cross-corridor boundaries. */
export function corridorDustRegion(box: {min:number[];max:number[]}, rects:{x0:number;x1:number;z0:number;z1:number}[]): WearRegion {
  if(rects.length!==1)return [0,0,0,0];
  const r=rects[0],alongZ=r.z1-r.z0>=r.x1-r.x0;
  return [alongZ?1:-1,alongZ?(r.x0+r.x1)/2:(r.z0+r.z1)/2,
    (alongZ?r.x1-r.x0:r.z1-r.z0)/2-.15,box.max[1]];
}
/** Split render-only wall boxes at real water coverage boundaries. No new collision boxes.
 * Each resulting wall keeps its room coordinates and metric UVs. */
export function wetWallBoxes<T extends {min:[number,number,number];max:[number,number,number];mat:string;environment?:WearRegion}>(boxes:T[], waters:{min:number[];max:number[]}[], wallMaterial:string): T[] {
  return boxes.flatMap(b=>{
    const dx=b.max[0]-b.min[0], dz=b.max[2]-b.min[2];
    if(b.mat!==wallMaterial || b.max[1]-b.min[1]<.6 || Math.min(dx,dz)>.2)return [b];
    const axis=dx>dz?0:2, cross=axis===0?2:0;
    const intervals=waters.filter(w=>w.max[cross]>=b.min[cross]-.01&&w.min[cross]<=b.max[cross]+.01&&w.max[1]>b.min[1])
      .map(w=>({lo:Math.max(b.min[axis],w.min[axis]),hi:Math.min(b.max[axis],w.max[axis]),level:w.max[1]})).filter(w=>w.hi-w.lo>.001);
    if(!intervals.length)return [b];
    const cuts=[...new Set([b.min[axis],b.max[axis],...intervals.flatMap(w=>[w.lo,w.hi])])].sort((a,b)=>a-b);
    return cuts.slice(0,-1).map((lo,i)=>{
      const hi=cuts[i+1],mid=(lo+hi)/2,covered=intervals.filter(w=>mid>=w.lo&&mid<=w.hi);
      const min=[...b.min] as [number,number,number],max=[...b.max] as [number,number,number];min[axis]=lo;max[axis]=hi;
      return {...b,min,max,...(covered.length?{environment:[2,Math.max(...covered.map(w=>w.level)),0,0] as WearRegion}:{})};
    });
  });
}
interface AppearanceShader { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform>; }
/** Shared material program; per-room/per-door state lives on geometry, not in the material cache. */
export function addSurfaceAppearance(shader: AppearanceShader, varied: boolean, variation: THREE.IUniform<number>, wear: THREE.IUniform<number>, environment: THREE.IUniform<number>={value:1}): void {
  shader.uniforms.surfaceVariationStrength=variation;
  shader.uniforms.surfaceWearStrength=wear;
  shader.uniforms.surfaceEnvironmentStrength=environment;
  shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 surfaceEnvironment; varying vec4 vSurfaceEnvironment; attribute float surfaceSeed; attribute vec4 surfaceWear; varying float vSurfaceSeed; varying vec4 vSurfaceWear;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfaceEnvironment=surfaceEnvironment; vSurfaceSeed=surfaceSeed; vSurfaceWear=surfaceWear;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>', `#include <common>
    uniform float surfaceEnvironmentStrength; varying vec4 vSurfaceEnvironment; uniform float surfaceVariationStrength; uniform float surfaceWearStrength;
    varying float vSurfaceSeed; varying vec4 vSurfaceWear;
    float appearanceHash(vec3 p) {
      p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
    }
    float appearanceNoise(vec3 p) {
      vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(mix(appearanceHash(i),appearanceHash(i+vec3(1,0,0)),f.x),
                     mix(appearanceHash(i+vec3(0,1,0)),appearanceHash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(appearanceHash(i+vec3(0,0,1)),appearanceHash(i+vec3(1,0,1)),f.x),
                     mix(appearanceHash(i+vec3(0,1,1)),appearanceHash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
  `);
  const regionCode=`
    vec3 appearanceOffset=vec3(mod(vSurfaceSeed,127.0),mod(floor(vSurfaceSeed/127.0),127.0),mod(vSurfaceSeed,71.0));
    float surfaceMacro=appearanceNoise(vRoomPos*0.22+appearanceOffset);
    float dustMask=0.0, wetMask=0.0;
    float surfaceWearMask=0.0, wearColor=1.0, wearRoughness=0.0;
    if(surfaceWearStrength>0.0 && abs(vSurfaceWear.x)>0.5) {
      vec3 wearPos=vRoomPos;
      if(abs(vSurfaceWear.x)>2.5)wearPos.xz*=sign(vSurfaceWear.x);
      float mottling=appearanceNoise(wearPos*vec3(15.0,35.0,15.0)+appearanceOffset);
      if(abs(vSurfaceWear.x)>2.5) {
        float height=wearPos.y-vSurfaceWear.z;
        float kick=(1.0-smoothstep(0.06,0.34,height))*smoothstep(0.30,0.72,mottling);
        vec2 atHandle=vec2((wearPos.x-vSurfaceWear.y)/0.13,(height-vSurfaceWear.w)/0.20);
        float hand=exp(-dot(atHandle,atHandle)*1.6)*(0.5+0.5*mottling);
        surfaceWearMask=max(kick,hand)*surfaceWearStrength;
        wearColor=1.0-(kick*0.17+hand*0.13)*surfaceWearStrength;
        wearRoughness=(kick*0.08-hand*0.14)*surfaceWearStrength;
      } else {
        float across=vSurfaceWear.x<1.5?wearPos.x:wearPos.z;
        float along=vSurfaceWear.x<1.5?wearPos.z:wearPos.x;
        float shift=(appearanceNoise(vec3(along*0.23,0.0,0.0)+appearanceOffset)-0.5)*0.12;
        float path=1.0-smoothstep(vSurfaceWear.w*0.3,vSurfaceWear.w,abs(across-vSurfaceWear.y-shift));
        float top=1.0-smoothstep(0.005,0.025,abs(wearPos.y-vSurfaceWear.z));
        surfaceWearMask=path*top*(0.35+0.65*mottling)*surfaceWearStrength;
        wearColor=1.0+surfaceWearMask*0.09;
        wearRoughness=-surfaceWearMask*0.09;
      }
    }
    if(surfaceEnvironmentStrength>0.0 && abs(vSurfaceEnvironment.x)>.5) {
      float envNoise=appearanceNoise(vRoomPos*vec3(8.0,13.0,8.0)+appearanceOffset);
      if(abs(vSurfaceEnvironment.x)==1.0) {
        float across=vSurfaceEnvironment.x>0.0?vRoomPos.x:vRoomPos.z;
        float distanceToWall=max(0.0,vSurfaceEnvironment.z-abs(across-vSurfaceEnvironment.y));
        float top=1.0-smoothstep(.005,.025,abs(vRoomPos.y-vSurfaceEnvironment.w));
        dustMask=(1.0-smoothstep(.025,.24,distanceToWall))*top*(.55+.45*envNoise)*surfaceEnvironmentStrength;
        wearColor*=1.0+dustMask*.12;
        wearRoughness+=dustMask*.12;
      } else if(vSurfaceEnvironment.x==2.0) {
        float rise=vRoomPos.y-vSurfaceEnvironment.y;
        wetMask=(1.0-smoothstep(.015,.16+(envNoise-.5)*.07,rise))*surfaceEnvironmentStrength;
        wearColor*=1.0-wetMask*.23;
      }
    }
  `;
  const sample=varied ? `vec4 sampledDiffuseColor=texture2D(map,vMapUv);
    vec4 offsetColor=texture2D(map,vMapUv+vec2(0.371,0.613));
    sampledDiffuseColor=mix(sampledDiffuseColor,offsetColor,smoothstep(0.15,0.85,surfaceMacro)*0.65*surfaceVariationStrength);
    sampledDiffuseColor.rgb*=1.0+(surfaceMacro-0.5)*0.08*surfaceVariationStrength;`
    : 'vec4 sampledDiffuseColor=texture2D(map,vMapUv);';
  const chunk=THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', sample+'\nsampledDiffuseColor.rgb*=wearColor;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',regionCode+chunk);
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',
    `roughnessFactor=mix(roughnessFactor,0.2,wetMask*.85);\nroughnessFactor=clamp(roughnessFactor+wearRoughness${varied?'+(surfaceMacro-0.5)*0.04*surfaceVariationStrength':''},0.04,1.0);\n#include <metalnessmap_fragment>`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', 'if(surfaceDiagnostic==6)outgoingLight=vec3(surfaceWearMask); if(surfaceDiagnostic==7)outgoingLight=vec3(dustMask,wetMask,0.0);\n#include <opaque_fragment>');
}
