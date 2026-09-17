import * as THREE from 'three';

export type DetailKind = 'wallpaper' | 'carpet' | 'ceiling' | 'wood' | 'concrete' | 'tile' | 'metal' | 'linoleum' | 'cardboard' | 'foliage' | 'diffuser' | 'water' | 'sky' | 'paint' | 'rubber' | 'glass' | 'night';
/** Authored microstructure, independent of albedo stains/printing. Not a measured scan.
 * R: height, G: relative roughness. Periodic signals use integer frequencies.
 */
export function createSurfaceDetail(kind: DetailKind): THREE.DataTexture {
  const n = 256, data = new Uint8Array(n * n * 4);
  const noise = (x: number, y: number) => {
    let v = Math.imul(x & 255, 374761393) ^ Math.imul(y & 255, 668265263) ^ 7127;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u=x/n*Math.PI*2, v=y/n*Math.PI*2, grain=noise(x,y);
    let height=.5, rough=1;
    if(kind==='wallpaper') { height=.5+.13*Math.sin(u*64)+.08*Math.sin(v*48)+.045*(grain-.5);rough=.91+.07*grain; }
    if(kind==='carpet') { height=.5+.16*Math.sin(u*48)*Math.sin(v*48)+.13*(grain-.5);rough=.95+.05*grain; }
    if(kind==='ceiling') { const pore=grain>.93 ? .23 : .52; height=pore+.04*Math.sin(u*35)*Math.sin(v*29);rough=.94+.06*grain; }
    if(kind==='wood') { height=.5+.07*Math.sin(u*55+.6*Math.sin(v*2))+.025*(grain-.5);rough=.88+.08*grain; }
    if(kind==='concrete') {height=.5+.12*(grain-.5)+.035*Math.sin(u*19)*Math.sin(v*23);rough=.9+.1*grain;}
    if(kind==='tile') {height=.5+.015*Math.sin(u*3)*Math.sin(v*4);rough=.92+.06*grain;}
    if(kind==='metal') {height=.5+.035*Math.sin(u*91)+.008*(grain-.5);rough=.78+.18*grain;}
    if(kind==='linoleum') {height=.5+.025*(grain-.5);rough=.9+.09*grain;}
    if(kind==='cardboard') {height=.5+.055*Math.sin(u*63)*Math.sin(v*57)+.06*(grain-.5);rough=.94+.06*grain;}
    if(kind==='foliage') {height=.5+.055*Math.sin(u*16)*Math.sin(v*4);rough=.9+.08*grain;}
    if(kind==='diffuser') {height=.5+.07*Math.sin(u*32)*Math.sin(v*32);rough=.93+.06*grain;}
    if(kind==='water') {height=.5+.12*Math.sin(u*3+.4*Math.sin(v*2))+.07*Math.sin(v*5);rough=.96;}
    if(kind==='paint') {height=.5+.018*Math.sin(u*43)*Math.sin(v*47);rough=.94+.04*grain;}
    if(kind==='rubber') {height=.5+.055*(grain-.5);rough=.96+.04*grain;}
    if(kind==='glass'||kind==='sky'||kind==='night') {height=.5;rough=1;} // 平坦（ガラス・空箔・夜景の裏板）
    const i=(y*n+x)*4;data[i]=Math.round(height*255);data[i+1]=Math.round(rough*255);data[i+2]=0;data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
  t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;
  t.name=`authored/${kind}/height-R-roughness-G`;t.needsUpdate=true;return t;
}
export function hasAuthoredDetail(id: string): id is DetailKind {
  return ['wallpaper','carpet','ceiling','wood','concrete','tile','metal','linoleum','cardboard','foliage','diffuser','water','sky','paint','rubber','glass','night'].includes(id);
}

/** Tangent-space OpenGL +Y; periodic central differences, independent of albedo.
 * AO describes only authored microcavities, not room-scale contact shadow. UV channel 0. */
export function createSurfaceMaps(kind: DetailKind) {
  const detail=createSurfaceDetail(kind),src=detail.image.data as Uint8Array,n=detail.image.width;
  const normal=new Uint8Array(n*n*4),occlusion=new Uint8Array(n*n*4);
  const h=(x:number,y:number)=>src[(((y+n)%n)*n+(x+n)%n)*4]/255;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const dx=(h(x+1,y)-h(x-1,y))*n/2,dy=(h(x,y+1)-h(x,y-1))*n/2;
    const inv=1/Math.hypot(dx,dy,1),i=(y*n+x)*4;
    normal.set([Math.round((-dx*inv*.5+.5)*255),Math.round((-dy*inv*.5+.5)*255),Math.round((inv*.5+.5)*255),255],i);
    const cavity=Math.max(0,(h(x+1,y)+h(x-1,y)+h(x,y+1)+h(x,y-1))/4-h(x,y));
    const ao=Math.round((1-Math.min(.14,cavity*.4))*255);occlusion.set([ao,ao,ao,255],i);
  }
  const texture=(data:Uint8Array,name:string)=>{const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.name=`authored/${kind}/${name}`;t.colorSpace=THREE.NoColorSpace;t.channel=0;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  return {detail,normal:texture(normal,'normal-OpenGL'),ao:texture(occlusion,'micro-AO-uv0')};
}
