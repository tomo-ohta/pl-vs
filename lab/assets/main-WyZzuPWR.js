const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/corridor-CZYCi_cO.js","assets/Builder-oYNvRoNC.js","assets/Style-CveiJv_g.js","assets/storage-DDoO1RSJ.js","assets/Decal-D6gcfeYQ.js","assets/glsl-Di_U4Tn9.js","assets/kit-CP4efg1_.js","assets/props-BfbX8LvY.js","assets/tex-DsxroQtv.js","assets/seg3-7JNZLLKt.js","assets/storage-BZPV8dPa.js","assets/station-CdHZVZiD.js","assets/kit-9HCdy0_i.js","assets/goods-DWMut89e.js","assets/pool-D7szzBA5.js","assets/zoneD-DFBJqyNq.js","assets/gear-DqAxyfGK.js","assets/equipment-DmtEGwp1.js","assets/alley-BgvYekFK.js","assets/PaintMaterial-DlPtqEpY.js","assets/place-wJ68nils.js","assets/layout-38lXOsiZ.js","assets/pastel-DP0wv-vj.js","assets/storage-BLnWLLOt.js","assets/waterpark-CqbxXtak.js","assets/ViewCam-C-7tSl54.js","assets/items-Cd36e6wJ.js","assets/three.module-2q-fESAx.js","assets/classroom-DeaRuF3j.js","assets/fixtures-A07RNwDr.js","assets/serverroom-krFNK-Yb.js","assets/spaces-C2R-Krau.js","assets/whiteroom-D3boS6uy.js","assets/interior-Bf9y61M1.js","assets/squareroom-cVhD_fh3.js","assets/machines-dKLzwSHw.js","assets/planetarium-3p28cZTH.js","assets/seats-CMyy1coP.js","assets/gallery-Co2SJir4.js","assets/gallery-Cn1CUK26.js","assets/gallery-BSxDKi7L.js","assets/gallery-WMyeZJUR.js","assets/gallery-BkGSW9yk.js","assets/gallery-DiPKfFBJ.js","assets/gallery-CWKW_5mW.js","assets/gallery-DWzNI0cn.js","assets/gallery-CCDi_nTr.js","assets/gallery-DZxF5t2_.js","assets/gallery-BuuCOyOE.js","assets/station-BwpgeSLo.js","assets/pool-Cqo-m9ra.js","assets/corridor-iT-fWHMY.js","assets/pastel-DP3CZazR.js","assets/alley-D6lSSOEd.js","assets/test-D9OttGyK.js"])))=>i.map(i=>d[i]);
import{B as e,Et as t,G as n,Jn as r,M as i,Mt as a,N as o,Nn as s,Rn as c,St as l,Tn as u,Un as d,Vn as f,W as p,Yn as m,Zn as h,at as g,c as _,ct as v,d as y,et as b,ht as x,j as S,jn as C,k as w,pt as T,qn as E,rt as D,s as O,st as k,t as ee,ut as te,v as A,wn as ne,xt as re,yt as ie,z as ae,zn as oe}from"./Builder-oYNvRoNC.js";import{n as se,r as ce}from"./three.module-2q-fESAx.js";import{n as le,r as ue,t as de}from"./glsl-Di_U4Tn9.js";import{a as j,i as M,n as fe}from"./Style-CveiJv_g.js";import{S as pe,_ as me,d as he,f as ge,g as _e,h as ve,l as ye,m as be,o as xe,p as Se,r as Ce,u as we,v as Te}from"./storage-DDoO1RSJ.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var Ee=class{boxes=[];add(e,t,n){let i={min:new r(Math.min(e.x,t.x),Math.min(e.y,t.y),Math.min(e.z,t.z)),max:new r(Math.max(e.x,t.x),Math.max(e.y,t.y),Math.max(e.z,t.z)),slow:n};return this.boxes.push(i),i}addCentered(e,t,n,r,i,a,o){return this.add({x:e-r/2,y:t-i/2,z:n-a/2},{x:e+r/2,y:t+i/2,z:n+a/2},o)}addObject(e,t=0){let n=new _().setFromObject(e);return n.expandByScalar(t),this.add(n.min,n.max)}remove(e){let t=this.boxes.indexOf(e);t>=0&&this.boxes.splice(t,1)}rayXZ(e,t,n,r,i,a){let o=a;for(let a of this.boxes){if(a.enabled===!1||a.slow!==void 0||n<a.min.y||n>a.max.y)continue;let s=0,c=o;for(let[n,o,l,u]of[[e,r,a.min.x,a.max.x],[t,i,a.min.z,a.max.z]])if(Math.abs(o)<1e-9){if(n<l||n>u){s=1/0;break}}else{let e=(l-n)/o,t=(u-n)/o;e>t&&([e,t]=[t,e]),s=Math.max(s,e),c=Math.min(c,t)}s<=c&&s<o&&s>.05&&(o=s)}return o}clear(){this.boxes.length=0}groundBelow(e,t,n,r){let i=-1/0,a=1,o=0;for(let s of this.boxes)s.enabled!==!1&&(s.max.y>r||e+n*.5<s.min.x||e-n*.5>s.max.x||t+n*.5<s.min.z||t-n*.5>s.max.z||s.max.y>i&&(i=s.max.y,a=s.slow??1,o=s.depth??0));return{y:i,slow:a,depth:o}}ceilingAbove(e,t,n,r){let i=1/0;for(let a of this.boxes)a.enabled!==!1&&(a.min.y<r||e+n<a.min.x||e-n>a.max.x||t+n<a.min.z||t-n>a.max.z||(i=Math.min(i,a.min.y)));return i}pushOut(e,t,n,r){let i=!1;for(let a=0;a<3;a++){let a=!1;for(let o of this.boxes){if(o.enabled===!1||o.slow!==void 0||o.max.y<=n||o.min.y>=r)continue;let s=Math.max(o.min.x,Math.min(e.x,o.max.x)),c=Math.max(o.min.z,Math.min(e.z,o.max.z)),l=e.x-s,u=e.z-c,d=l*l+u*u;if(!(d>=t*t)){if(d<1e-10){let n=[[e.x-o.min.x,-1,0],[o.max.x-e.x,1,0],[e.z-o.min.z,0,-1],[o.max.z-e.z,0,1]];n.sort((e,t)=>e[0]-t[0]);let[r,i,a]=n[0];e.x+=i*(r+t),e.z+=a*(r+t)}else{let n=Math.sqrt(d);l/=n,u/=n,e.x=s+l*t,e.z=c+u*t}a=!0,i=!0}}if(!a)break}return i}},De=class{keys=new Set;lookDX=0;lookDY=0;pressed=new Set;locked=!1;moveX=0;moveY=0;moveTouch=null;lookTouch=null;constructor(e){e.addEventListener(`touchstart`,e=>{for(let t of Array.from(e.changedTouches))t.clientX<window.innerWidth/2&&!this.moveTouch?this.moveTouch={id:t.identifier,x:t.clientX,y:t.clientY}:this.lookTouch||={id:t.identifier,x:t.clientX,y:t.clientY};e.preventDefault()},{passive:!1}),e.addEventListener(`touchmove`,e=>{for(let t of Array.from(e.changedTouches))this.moveTouch?.id===t.identifier?(this.moveX=Math.max(-1,Math.min(1,(t.clientX-this.moveTouch.x)/60)),this.moveY=Math.max(-1,Math.min(1,-(t.clientY-this.moveTouch.y)/60))):this.lookTouch?.id===t.identifier&&(this.lookDX+=(t.clientX-this.lookTouch.x)*1.6,this.lookDY+=(t.clientY-this.lookTouch.y)*1.6,this.lookTouch.x=t.clientX,this.lookTouch.y=t.clientY);e.preventDefault()},{passive:!1});let t=e=>{for(let t of Array.from(e.changedTouches))this.moveTouch?.id===t.identifier?(this.moveTouch=null,this.moveX=0,this.moveY=0):this.lookTouch?.id===t.identifier&&(this.lookTouch=null)};e.addEventListener(`touchend`,t),e.addEventListener(`touchcancel`,t),window.addEventListener(`keydown`,e=>{Oe(e)||(this.keys.has(e.code)||this.pressed.add(e.code),this.keys.add(e.code),(e.code===`Space`||e.code.startsWith(`Arrow`))&&e.preventDefault())}),window.addEventListener(`keyup`,e=>this.keys.delete(e.code)),window.addEventListener(`blur`,()=>this.keys.clear()),e.addEventListener(`click`,()=>{!this.locked&&!matchMedia(`(pointer: coarse)`).matches&&e.requestPointerLock?.()}),document.addEventListener(`pointerlockchange`,()=>{this.locked=document.pointerLockElement===e}),document.addEventListener(`mousemove`,e=>{this.locked&&(this.lookDX+=e.movementX,this.lookDY+=e.movementY)})}down(...e){return e.some(e=>this.keys.has(e))}hit(e){return this.pressed.has(e)}endFrame(){this.pressed.clear(),this.lookDX=0,this.lookDY=0}};function Oe(e){let t=e.target;return!!t&&(t.tagName===`INPUT`||t.tagName===`SELECT`||t.tagName===`TEXTAREA`)}var ke=1.72,Ae=1.12,je=.12,N=.26,Me=.36,Ne=18,Pe=5.2,Fe=class{camera;pos=new r;yaw=0;pitch=0;roll=0;vy=0;onGround=!1;fly=!1;height=ke;walkSpeed=1.55;runSpeed=3.6;sensitivity=.0022;bob=.6;bobPhase=0;bobAmp=0;vel=new r;spawn={pos:new r,yaw:0,pitch:0};constructor(e){this.camera=e}get eyeHeight(){return this.height-je}setSpawn(e,t,n=0){this.spawn={pos:new r(e.x,e.y,e.z),yaw:t,pitch:n},this.respawn()}respawn(){this.pos.copy(this.spawn.pos),this.yaw=this.spawn.yaw,this.pitch=this.spawn.pitch,this.roll=0,this.vy=0,this.vel.set(0,0,0)}placeEye(e,t,n,r=0,i){if(this.height=ke,this.pos.set(e.x,e.y-this.eyeHeight,e.z),i){let t=i.groundBelow(e.x,e.z,N,e.y-.3);if(Number.isFinite(t.y)){let n=e.y-t.y+je;this.height=g.clamp(n,.5,2.6),this.pos.y=t.y}}this.yaw=t,this.pitch=n,this.roll=r,this.vy=0,this.vel.set(0,0,0),this.bobAmp=0}externalCamera=!1;update(e,t,n){e=Math.min(e,.05),t.hit(`KeyF`)&&(this.fly=!this.fly),this.yaw-=t.lookDX*this.sensitivity,this.pitch-=t.lookDY*this.sensitivity,t.down(`KeyQ`)&&(this.yaw+=e*1.6),t.down(`KeyE`)&&(this.yaw-=e*1.6),this.pitch=g.clamp(this.pitch,-1.5,1.5),(t.lookDX!==0||t.lookDY!==0)&&(this.roll=0);let i=g.clamp(+!!t.down(`KeyW`,`ArrowUp`)-!!t.down(`KeyS`,`ArrowDown`)+t.moveY,-1,1),a=g.clamp(+!!t.down(`KeyD`,`ArrowRight`)-!!t.down(`KeyA`,`ArrowLeft`)+t.moveX,-1,1),o=t.down(`ShiftLeft`,`ShiftRight`),s=t.down(`KeyC`,`ControlLeft`,`ControlRight`),c=Math.sin(this.yaw),l=Math.cos(this.yaw),u=new r(-c*i+l*a,0,-l*i-c*a);if(u.lengthSq()>1&&u.normalize(),this.fly){let n=(o?8:3)*e,u=!!t.down(`Space`)-+!!s,d=Math.cos(this.pitch),f=new r(-c*d,Math.sin(this.pitch),-l*d);this.pos.addScaledVector(f,i*n),this.pos.x+=l*a*n,this.pos.z+=-c*a*n,this.pos.y+=u*n,this.vy=0,this.applyCamera(0);return}let d=n.ceilingAbove(this.pos.x,this.pos.z,N,this.pos.y+Ae-.05),f=s||d<this.pos.y+ke?Ae:ke;this.height+=(f-this.height)*Math.min(1,e*10);let p=n.groundBelow(this.pos.x,this.pos.z,N,this.pos.y+Me).slow,m=(s?this.walkSpeed*.55:o?this.runSpeed:this.walkSpeed)*p,h=this.onGround?14:3;this.vel.x+=(u.x*m-this.vel.x)*Math.min(1,h*e),this.vel.z+=(u.z*m-this.vel.z)*Math.min(1,h*e),this.onGround&&t.hit(`Space`)&&(this.vy=Pe,this.onGround=!1);let _=Math.max(1,Math.ceil(Math.hypot(this.vel.x,this.vel.z)*e/.1));for(let t=0;t<_;t++)this.pos.x+=this.vel.x*e/_,this.pos.z+=this.vel.z*e/_,n.pushOut(this.pos,N,this.pos.y+Me,this.pos.y+this.height);this.vy-=Ne*e;let v=this.pos.y+this.vy*e,y=n.groundBelow(this.pos.x,this.pos.z,N,this.pos.y+Me);v<=y.y?(v=this.onGround&&y.y>this.pos.y?Math.min(y.y,this.pos.y+e*4):y.y,y.y-v<.002&&(v=y.y),this.vy=0,this.onGround=!0):this.onGround=v-y.y<.02;let b=n.ceilingAbove(this.pos.x,this.pos.z,N,this.pos.y+this.height-.02);this.vy>0&&v+this.height>b&&(v=b-this.height,this.vy=0),this.pos.y=v,this.pos.y<-30&&this.respawn();let x=Math.hypot(this.vel.x,this.vel.z);this.bobAmp+=((this.onGround?Math.min(1,x/2):0)-this.bobAmp)*Math.min(1,e*6),this.bobPhase+=e*(5.2+x*1.4),this.applyCamera(this.externalCamera?0:this.bob*this.bobAmp)}applyCamera(e=0){let t=this.camera;if(t.position.set(this.pos.x,this.pos.y+this.eyeHeight,this.pos.z),e>0){t.position.y+=Math.sin(this.bobPhase*2)*.022*e;let n=Math.cos(this.bobPhase)*.018*e;t.position.x+=Math.cos(this.yaw)*n,t.position.z-=Math.sin(this.yaw)*n}t.rotation.set(this.pitch,this.yaw,this.roll,`YXZ`),t.updateMatrixWorld()}},Ie=class{scale;target;matrix=new k;camera=new re;hide=[];enabled=!0;skipLayer=1;plane=new l;normal;point;constructor(e,t={x:0,y:1,z:0},n=.5){this.scale=n,this.point=new r(e.x,e.y,e.z),this.normal=new r(t.x,t.y,t.z).normalize(),this.target=new h(16,16,{type:p,samples:0}),this.target.texture.colorSpace=D,this.target.texture.generateMipmaps=!1}setSize(e,t){this.target.setSize(Math.max(1,Math.round(e*this.scale)),Math.max(1,Math.round(t*this.scale)))}render(e,t,n){if(!this.enabled)return;let i=new r().setFromMatrixPosition(n.matrixWorld),a=i.clone().sub(this.point);if(a.dot(this.normal)<=0)return;let o=this.point.clone().sub(a.reflect(this.normal).negate()),s=new r(0,0,-1).applyMatrix4(new k().extractRotation(n.matrixWorld)),c=i.clone().add(s),l=this.point.clone().sub(c);l.reflect(this.normal).negate(),l.add(this.point);let u=new r(0,1,0).applyMatrix4(new k().extractRotation(n.matrixWorld)).reflect(this.normal),d=this.camera;d.position.copy(o),d.up.copy(u),d.lookAt(l),d.far=n.far,d.near=n.near,d.fov=n.fov,d.aspect=n.aspect,d.updateMatrixWorld(),d.projectionMatrix.copy(n.projectionMatrix),d.layers.mask=n.layers.mask,d.layers.disable(this.skipLayer),d.layers.enable(2),this.matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),this.matrix.multiply(d.projectionMatrix).multiply(d.matrixWorldInverse),this.plane.setFromNormalAndCoplanarPoint(this.normal,this.point).applyMatrix4(d.matrixWorldInverse);let f=new m(this.plane.normal.x,this.plane.normal.y,this.plane.normal.z,this.plane.constant),p=d.projectionMatrix,h=new m((Math.sign(f.x)+p.elements[8])/p.elements[0],(Math.sign(f.y)+p.elements[9])/p.elements[5],-1,(1+p.elements[10])/p.elements[14]);f.multiplyScalar(2/f.dot(h)),p.elements[2]=f.x,p.elements[6]=f.y,p.elements[10]=f.z+1-5e-4,p.elements[14]=f.w;let g=this.hide.map(e=>e.visible);this.hide.forEach(e=>e.visible=!1);let _=e.getRenderTarget(),v=e.shadowMap.autoUpdate;e.shadowMap.autoUpdate=!1,e.setRenderTarget(this.target),e.clear(),e.render(t,d),e.setRenderTarget(_),e.shadowMap.autoUpdate=v,this.hide.forEach((e,t)=>e.visible=g[t])}dispose(){this.target.dispose()}},Le=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},Re=new ie(-1,1,1,-1,0,1),ze=new class extends y{constructor(){super(),this.setAttribute(`position`,new ae([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new ae([0,2,0,0,2,0],2))}},P=class{constructor(e){this._mesh=new v(ze,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Re)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},Be=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;function F(e,t,n={}){return new P(new u({vertexShader:Be,fragmentShader:e,uniforms:t,defines:n,depthTest:!1,depthWrite:!1}))}function I(e,t,n={}){let r=new h(e,t,{type:p,depthBuffer:!1,...n});return r.texture.colorSpace=D,r.texture.generateMipmaps=!1,r}var Ve=class{prefilterUniforms;count;levels=[];ups=[];prefilter;down;up;constructor(e,t,n=6){this.prefilterUniforms=t,this.count=n,this.prefilter=F(e,{tSrc:{value:null},...t}),this.down=F(`
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0);
      }`,{tSrc:{value:null},uTexel:{value:new E}}),this.up=F(`
      uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
      void main() {
        vec2 o = uTexel * uRadius;
        vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
        c += texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
        c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
        gl_FragColor = vec4(c / 12.0 + texture2D(tBase, vUv).rgb, 1.0);
      }`,{tSrc:{value:null},tBase:{value:null},uTexel:{value:new E},uRadius:{value:1}})}setSize(e,t){this.dispose();let n=Math.max(1,e>>1),r=Math.max(1,t>>1);for(let e=0;e<this.count;e++)this.levels.push(I(n,r)),this.ups.push(I(n,r)),n=Math.max(1,n>>1),r=Math.max(1,r>>1)}render(e,t,n){let r=this.prefilter.material;r.uniforms.tSrc.value=t,e.setRenderTarget(this.levels[0]),this.prefilter.render(e);let i=this.down.material;for(let t=1;t<this.levels.length;t++){let n=this.levels[t-1];i.uniforms.tSrc.value=n.texture,i.uniforms.uTexel.value.set(1/n.width,1/n.height),e.setRenderTarget(this.levels[t]),this.down.render(e)}let a=this.up.material,o=this.levels[this.levels.length-1].texture;for(let t=this.levels.length-2;t>=0;t--){let r=this.levels[t+1];a.uniforms.tSrc.value=o,a.uniforms.tBase.value=this.levels[t].texture,a.uniforms.uTexel.value.set(1/r.width,1/r.height),a.uniforms.uRadius.value=n,e.setRenderTarget(this.ups[t]),this.up.render(e),o=this.ups[t].texture}return o}dispose(){for(let e of[...this.levels,...this.ups])e.dispose();this.levels.length=0,this.ups.length=0}},He=`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 s(vec2 o) { return clamp(texture2D(tSrc, vUv + o * uTexel).rgb, 0.0, 1.0); }
void main() {
  vec3 sx = (s(vec2(-1,-1)) + 2.0*s(vec2(-1,0)) + s(vec2(-1,1)) - s(vec2(1,-1)) - 2.0*s(vec2(1,0)) - s(vec2(1,1))) / 4.0;
  vec3 sy = (s(vec2(-1,-1)) + 2.0*s(vec2(0,-1)) + s(vec2(1,-1)) - s(vec2(-1,1)) - 2.0*s(vec2(0,1)) - s(vec2(1,1))) / 4.0;
  gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0);
}`,Ue=`
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv) * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846) * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846) * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308) * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c;
}`,We=`
uniform sampler2D tSrc; uniform sampler2D tTensor; uniform vec2 uTexel;
uniform float uRadius; uniform float uSharpness; uniform float uAlpha; uniform float uHardness;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tTensor, vUv);
  float d = sqrt(max(t.y * t.y - 2.0 * t.x * t.y + t.x * t.x + 4.0 * t.z * t.z, 0.0));
  float l1 = 0.5 * (t.y + t.x + d);
  float l2 = 0.5 * (t.y + t.x - d);
  vec2 v = vec2(l1 - t.x, -t.z);
  vec2 dir = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
  float phi = -atan(dir.y, dir.x);
  float A = (l1 + l2 > 0.0) ? (l1 - l2) / (l1 + l2) : 0.0;
  float r = uRadius;
  float a = r * clamp((uAlpha + A) / uAlpha, 0.1, 2.0);
  float b = r * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
  float cp = cos(phi), sp = sin(phi);
  mat2 R = mat2(cp, -sp, sp, cp);
  mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
  mat2 SR = S * R;
  int mx = int(sqrt(a * a * cp * cp + b * b * sp * sp));
  int my = int(sqrt(a * a * sp * sp + b * b * cp * cp));
  float zeta = 2.0 / max(r, 1.0);
  float zc = 0.58;
  float sz = sin(zc);
  float eta = (zeta + cos(zc)) / (sz * sz);
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  mx = min(mx, 12);
  my = min(my, 12);
  for (int y = -my; y <= my; y++) {
    for (int x = -mx; x <= mx; x++) {
      vec2 vv = SR * vec2(float(x), float(y));
      if (dot(vv, vv) > 0.25) continue;
      vec3 c = clamp(texture2D(tSrc, vUv + vec2(float(x), float(y)) * uTexel).rgb, 0.0, 1.0);
      float w[8]; float sum = 0.0; float z; float vxx; float vyy;
      vxx = zeta - eta * vv.x * vv.x; vyy = zeta - eta * vv.y * vv.y;
      z = max(0.0, vv.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -vv.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -vv.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, vv.x + vyy); w[6] = z * z; sum += w[6];
      vec2 v2 = 0.70710678 * vec2(vv.x - vv.y, vv.x + vv.y);
      vxx = zeta - eta * v2.x * v2.x; vyy = zeta - eta * v2.y * v2.y;
      z = max(0.0, v2.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -v2.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -v2.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, v2.x + vyy); w[7] = z * z; sum += w[7];
      float g = exp(-3.125 * dot(vv, vv)) / max(sum, 1e-6);
      for (int k = 0; k < 8; k++) {
        float wk = w[k] * g;
        m[k] += vec4(c * wk, wk);
        s[k] += c * c * wk;
      }
    }
  }
  vec4 o = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 0.0) continue;
    vec3 mu = m[k].rgb / m[k].w;
    vec3 sg = abs(s[k] / m[k].w - mu * mu);
    float s2 = sg.r + sg.g + sg.b;
    float w = 1.0 / (1.0 + pow(uHardness * 1000.0 * s2, 0.5 * uSharpness));
    o += vec4(mu * w, w);
  }
  vec3 src = texture2D(tSrc, vUv).rgb;
  vec3 res = o.w > 0.0 ? o.rgb / o.w : src;
  // HDR（光る板）はそのまま残す
  float hdr = max(max(src.r, src.g), src.b);
  gl_FragColor = vec4(hdr > 1.0 ? src : res, 1.0);
}`,Ge=`
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform float uTime;
uniform float uDebug;
// 線
uniform vec4 uLine;       // enabled, width, depth, normal
uniform vec4 uLine2;      // id, breakup, fadeFar, opacity
uniform vec3 uLineColor;
// ブルーム・ディフュージョン
uniform float uBloom;
uniform float uDiffusion;
// 画面のグラデーション
uniform vec4 uGradA[3];   // p0.xy, p1.xy
uniform vec4 uGradB[3];   // color.rgb, amount
uniform float uGradMode[3];
// 色調整
uniform vec4 uGrade1;     // exposure, lift, gamma, gain
uniform vec4 uGrade2;     // saturation, hue(rad), tint.a, tint.b
uniform vec4 uGrade3;     // posterize, sharpness, vignette, grain
uniform vec4 uHaze;       // color.rgb, amount
uniform float uToneMap;
uniform float uLinearOut;
uniform float uFilmScale;
varying vec2 vUv;
${le}
${de}

float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, uNear, uFar);
}
vec3 viewPos(vec2 uv, float d) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
vec3 decodeN(vec4 info) {
  vec2 xy = info.xy * 2.0 - 1.0;
  return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}
// AgX（three の実装と同じ係数の簡略版）
vec3 agx(vec3 color) {
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color = AgXInsetMatrix * max(color, 1e-10);
  color = clamp(log2(color), AgxMinEv, AgxMaxEv);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  vec3 x2 = color * color; vec3 x4 = x2 * x2;
  color = + 15.5 * x4 * x2 - 40.14 * x4 * color + 31.96 * x4 - 6.868 * x2 * color + 0.4298 * x2 + 0.1191 * color - 0.00232;
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  return clamp(color, 0.0, 1.0);
}
vec3 neutral(vec3 color) {
  const float StartCompression = 0.8 - 0.04;
  const float Desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < StartCompression) return color;
  float d = 1. - StartCompression;
  float newPeak = 1. - d * d / (peak + d - StartCompression);
  color *= newPeak / peak;
  float g = 1. - 1. / (Desaturation * (peak - newPeak) + 1.);
  return mix(color, vec3(newPeak), g);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  vec4 info = texture2D(tInfo, vUv);
  float rawD = texture2D(tDepth, vUv).x;
  float dC = -perspectiveDepthToViewZ(rawD, uNear, uFar);

  // ---- 線 ----
  float edge = 0.0;
  if (uLine.x > 0.5) {
    vec2 px = uLine.y / uRes;
    vec3 nC = decodeN(info);
    vec3 vp = viewPos(vUv, rawD);
    float ndv = abs(dot(nC, normalize(-vp)));
    float graze = 1.0 + clamp((1.0 - ndv - 0.5) / 0.5, 0.0, 1.0) * 7.0;
    float dTh = uLine.z * graze;
    float wMax = info.w;
    float dE = 0.0; float nE = 0.0; float iE = 0.0;
    // 深度は中心と周り 8 つ（深度は MSAA で平均されない）。
    // 法線と ID は向かい合う 2 つの組で比べる（縁の画素は MSAA で法線が平均されるので、中心と比べると線が点線になる）
    for (int i = 0; i < 4; i++) {
      vec2 o = i == 0 ? vec2(1,0) : i == 1 ? vec2(0,1) : i == 2 ? vec2(1,1) : vec2(1,-1);
      vec2 uvA = vUv + o * px;
      vec2 uvB = vUv - o * px;
      vec4 iA = texture2D(tInfo, uvA);
      vec4 iB = texture2D(tInfo, uvB);
      float dA = linDepth(uvA);
      float dB = linDepth(uvB);
      // 手前の物の線の重みを使う（線は奥側に描く）
      if (dA < dC) wMax = max(wMax, iA.w);
      if (dB < dC) wMax = max(wMax, iB.w);
      dE = max(dE, max((dC - dA) / max(dA, 1e-3), (dC - dB) / max(dB, 1e-3)));
      nE = max(nE, 1.0 - dot(decodeN(iA), decodeN(iB)));
      iE = max(iE, step(0.002, abs(iA.z - iB.z)) * step(0.001, iA.w * iB.w));
    }
    float e = max(step(dTh, dE), smoothstep(uLine.w * 0.85, uLine.w * 1.15, nE));
    e = max(e, iE * uLine2.x);
    // 遠くで消す・ワールド座標のノイズで途切れさせる
    float fade = 1.0 - smoothstep(uLine2.z * 0.6, uLine2.z, dC);
    vec3 wp = (uCamWorld * vec4(vp, 1.0)).xyz;
    float nz = sl_fbm(wp * 2.2, 3) * 0.5 + 0.5;
    float keep = smoothstep(uLine2.y - 0.08, uLine2.y + 0.08, nz + 0.0001) ;
    keep = uLine2.y <= 0.0 ? 1.0 : keep;
    edge = e * wMax * fade * keep * uLine2.w;
    col = mix(col, uLineColor, clamp(edge, 0.0, 1.0));
  }

  // ---- ブルーム・ディフュージョン ----
  col += texture2D(tBloom, vUv).rgb * uBloom;
  if (uDiffusion > 0.0) {
    vec3 dfz = texture2D(tDiffuse, vUv).rgb;
    vec3 sc = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - clamp(dfz, 0.0, 1.0));
    col = mix(col, max(sc, col), uDiffusion);
  }

  // ---- 露出・トーン ----
  col *= uGrade1.x;
  if (uToneMap > 1.5) col = neutral(col);
  else if (uToneMap > 0.5) col = agx(col);

  // ---- 画面のグラデーション（パラ・フレア） ----
  for (int i = 0; i < 3; i++) {
    if (uGradB[i].w <= 0.0) continue;
    vec2 a = uGradA[i].xy; vec2 b = uGradA[i].zw;
    vec2 ab = b - a;
    float t = clamp(dot(vUv - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float k = (1.0 - t) * uGradB[i].w;
    vec3 gc = uGradB[i].rgb;
    if (uGradMode[i] < 0.5) col = mix(col, col * gc, k);
    else if (uGradMode[i] < 1.5) col += gc * k;
    else col = mix(col, 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - gc), k);
  }

  // ---- 色調整（OKLab） ----
  vec3 lab = sl_linToOklab(max(col, 0.0));
  float L = lab.x * uGrade1.w;
  L = L + uGrade1.y * (1.0 - L);
  L = pow(max(L, 0.0), 1.0 / max(uGrade1.z, 1e-3));
  if (uGrade3.x > 0.0) {
    float n = uGrade3.x;
    float q = floor(L * n + 0.5) / n;
    L = q + (0.5 / n) * tanh(uGrade3.y * (L - q) * n);
  }
  float C = length(lab.yz) * uGrade2.x;
  float h = atan(lab.z, lab.y) + uGrade2.y;
  lab = vec3(L, cos(h) * C + uGrade2.z, sin(h) * C + uGrade2.w);
  col = sl_oklabToLin(lab);
  col = mix(col, uHaze.rgb, uHaze.w);

  // ---- 周辺減光・粒 ----
  vec2 cv = vUv - 0.5;
  col *= 1.0 - uGrade3.z * smoothstep(0.35, 0.95, length(cv * vec2(1.0, uRes.y / uRes.x) * 1.6));
  if (uLinearOut > 0.5) {
    // カメラ効果（Film）へ線形のまま渡す（sRGB・粒はその後）
    gl_FragColor = vec4(max(col, 0.0) * uFilmScale, 1.0);
    return;
  }
  vec3 outc = toSRGB(col);
  float gn = sl_hash12(vUv * uRes + fract(uTime) * 917.0) - 0.5;
  outc += gn * uGrade3.w;
  outc += (sl_hash12(vUv * uRes * 1.37) - 0.5) / 255.0;

  if (uDebug > 0.5) {
    if (uDebug < 1.5) outc = toSRGB(texture2D(tColor, vUv).rgb);
    else if (uDebug < 2.5) outc = info.xyz * vec3(1.0, 1.0, 0.0) + vec3(0.0, 0.0, 0.5);
    else if (uDebug < 3.5) outc = vec3(info.z, fract(info.z * 7.0), info.w);
    else if (uDebug < 4.5) outc = vec3(1.0 - clamp(dC / 60.0, 0.0, 1.0));
    else outc = vec3(1.0 - clamp(edge, 0.0, 1.0));
  }
  gl_FragColor = vec4(outc, 1.0);
}`,Ke=class{renderer;sceneRT;kuwaharaRT;tensorRT;tensorRT2;tensor;gauss;akf;bloom;diffusion;composite;reflectors=[];style;debug=0;enable={kuwahara:!0,lines:!0,bloom:!0,grade:!0};width=1;height=1;constructor(e){this.renderer=e,this.sceneRT=new h(1,1,{count:2,type:p,samples:4,depthBuffer:!0,depthTexture:new i(1,1,d)});for(let e of this.sceneRT.textures)e.colorSpace=D,e.generateMipmaps=!1,e.minFilter=b,e.magFilter=b;this.sceneRT.textures[1].minFilter=x,this.sceneRT.textures[1].magFilter=x,this.kuwaharaRT=I(1,1),this.tensorRT=I(1,1),this.tensorRT2=I(1,1),this.tensor=F(He,{tSrc:{value:null},uTexel:{value:new E}}),this.gauss=F(Ue,{tSrc:{value:null},uDir:{value:new E}}),this.akf=F(We,{tSrc:{value:null},tTensor:{value:null},uTexel:{value:new E},uRadius:{value:5},uSharpness:{value:8},uAlpha:{value:1},uHardness:{value:8}}),this.bloom=new Ve(`
      uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb;
        float l = max(max(c.r, c.g), c.b);
        float k = clamp((l - uThreshold) / max(l, 1e-4), 0.0, 1.0);
        gl_FragColor = vec4(c * k, 1.0);
      }`,{uThreshold:{value:1}}),this.diffusion=new Ve(`
      uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
      void main() {
        vec3 c = clamp(texture2D(tSrc, vUv).rgb, 0.0, 4.0);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor = vec4(c * smoothstep(uThreshold - 0.2, uThreshold + 0.2, l), 1.0);
      }`,{uThreshold:{value:.6}},5),this.composite=F(Ge,{tColor:{value:null},tInfo:{value:null},tDepth:{value:null},tBloom:{value:null},tDiffuse:{value:null},uRes:{value:new E},uNear:{value:.05},uFar:{value:1e3},uProjInv:{value:new k},uCamWorld:{value:new k},uTime:j.uTime,uDebug:{value:0},uLine:{value:new m},uLine2:{value:new m},uLineColor:{value:new A},uBloom:{value:0},uDiffusion:{value:0},uGradA:{value:[new m,new m,new m]},uGradB:{value:[new m,new m,new m]},uGradMode:{value:[0,0,0]},uGrade1:{value:new m(1,0,1,1)},uGrade2:{value:new m(1,0,0,0)},uGrade3:{value:new m(0,12,0,0)},uHaze:{value:new m},uToneMap:{value:0},uLinearOut:{value:0},uFilmScale:{value:1}})}film=null;setFilm(e){this.film=e,e?.setSize(this.width,this.height),e?.setDepthTexture(this.sceneRT.depthTexture)}setSize(e,t){this.width=e,this.height=t,this.sceneRT.setSize(e,t),this.bloom.setSize(e,t),this.diffusion.setSize(e,t);for(let n of this.reflectors)n.setSize(e,t);this.film?.setSize(e,t)}render(e,t){let n=this.renderer,r=this.style,i=r.post;for(let r of this.reflectors)r.render(n,e,t);n.setRenderTarget(this.sceneRT),n.setClearColor(r.background,1),n.clear(),n.render(e,t);let a=this.sceneRT.textures[0],o=r.post.kuwahara;if(o.enabled&&this.enable.kuwahara&&this.debug===0){let e=new E(1/this.width,1/this.height),t=g.clamp(o.scale??1,.25,1),r=Math.max(1,Math.round(this.width*t)),i=Math.max(1,Math.round(this.height*t));(this.kuwaharaRT.width!==r||this.kuwaharaRT.height!==i)&&(this.kuwaharaRT.setSize(r,i),this.tensorRT.setSize(r,i),this.tensorRT2.setSize(r,i));let s=new E(1/r,1/i),c=this.tensor.material;c.uniforms.tSrc.value=a,c.uniforms.uTexel.value.copy(e),n.setRenderTarget(this.tensorRT),this.tensor.render(n);let l=this.gauss.material;l.uniforms.tSrc.value=this.tensorRT.texture,l.uniforms.uDir.value.set(s.x,0),n.setRenderTarget(this.tensorRT2),this.gauss.render(n),l.uniforms.tSrc.value=this.tensorRT2.texture,l.uniforms.uDir.value.set(0,s.y),n.setRenderTarget(this.tensorRT),this.gauss.render(n);let u=this.akf.material;u.uniforms.tSrc.value=a,u.uniforms.tTensor.value=this.tensorRT.texture,u.uniforms.uRadius.value=Math.min(o.radius*t,12),u.uniforms.uTexel.value.copy(e).divideScalar(t),u.uniforms.uSharpness.value=o.sharpness,u.uniforms.uAlpha.value=o.aniso,n.setRenderTarget(this.kuwaharaRT),this.akf.render(n),a=this.kuwaharaRT.texture}let s=r.post.bloom,c=null;s.strength>0&&this.enable.bloom&&(this.bloom.prefilterUniforms.uThreshold.value=s.threshold,c=this.bloom.render(n,a,s.radius*1.5+.5));let l=null;i.diffusion.amount>0&&this.enable.bloom&&(this.diffusion.prefilterUniforms.uThreshold.value=i.diffusion.threshold,l=this.diffusion.render(n,a,i.diffusion.radius*1.5+.5));let u=this.composite.material.uniforms;u.tColor.value=a,u.tInfo.value=this.sceneRT.textures[1],u.tDepth.value=this.sceneRT.depthTexture,u.tBloom.value=c??this.sceneRT.textures[0],u.tDiffuse.value=l??this.sceneRT.textures[0],u.uBloom.value=c?s.strength:0,u.uDiffusion.value=l?i.diffusion.amount:0,u.uRes.value.set(this.width,this.height),u.uNear.value=t.near,u.uFar.value=t.far,u.uProjInv.value.copy(t.projectionMatrixInverse),u.uCamWorld.value.copy(t.matrixWorld),u.uDebug.value=this.debug;let d=r.post.lines,f=d.enabled&&this.enable.lines;u.uLine.value.set(+!!f,d.width*(this.height/816),d.depth,d.normal),u.uLine2.value.set(d.id,d.breakup,d.fadeFar,d.opacity),u.uLineColor.value.set(d.color);let p=r.post.grade,m=this.enable.grade;if(u.uGrade1.value.set(p.exposure,m?p.lift:0,m?p.gamma:1,m?p.gain:1),u.uGrade2.value.set(m?p.saturation:1,m?p.hue*Math.PI/180:0,m?p.tint[0]:0,m?p.tint[1]:0),u.uGrade3.value.set(m?p.posterize:0,i.posterizeSharpness,m?p.vignette:0,m?p.grain:0),p.haze&&m){let e=new A(p.haze.color);u.uHaze.value.set(e.r,e.g,e.b,p.haze.amount)}else u.uHaze.value.set(0,0,0,0);u.uToneMap.value=i.toneMap===`agx`?1:i.toneMap===`neutral`?2:0;for(let e=0;e<3;e++){let t=m?i.gradients[e]:void 0;if(!t){u.uGradB.value[e].set(0,0,0,0);continue}let n=new A(t.color);u.uGradA.value[e].set(t.p0[0],t.p0[1],t.p1[0],t.p1[1]),u.uGradB.value[e].set(n.r,n.g,n.b,t.amount),u.uGradMode.value[e]=t.blend===`mul`?0:t.blend===`add`?1:2}let h=this.film&&this.film.active&&this.debug===0?this.film:null;u.uLinearOut.value=+!!h,u.uFilmScale.value=h?h.inputScale:1,n.setRenderTarget(h?h.linearTarget:null),this.composite.render(n),h?.render(n)}dispose(){this.sceneRT.dispose(),this.kuwaharaRT.dispose(),this.tensorRT.dispose(),this.tensorRT2.dispose(),this.bloom.dispose(),this.diffusion.dispose()}},qe=`
uniform float uLampCount;
uniform vec4 uLampPos[16];
uniform vec4 uLampColor[16];
uniform vec3 uLampBoxMin[16];
uniform vec3 uLampBoxMax[16];
uniform vec4 uLampExtra[16]; // 影の効き, yaw, 四角, 硬い
uniform vec2 uLampParams;
uniform float uLampQuant;
uniform vec3 uLampAllMin;
uniform vec3 uLampAllMax;
// 灯りの明るさ（照明の倍率に足す。RGB）。sunVis = この画素の平行光源の影（1 = 日なた）
vec3 sl_lamps(vec3 p, vec3 n, float sunVis) {
  vec3 acc = vec3(0.0);
  // どの灯りの箱にも入らない画素は繰り返しをしない（全部の箱を包む箱で先に調べる）
  if (any(lessThan(p, uLampAllMin)) || any(greaterThan(p, uLampAllMax))) return acc;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uLampCount) break;
    vec3 q = p;
    float yw = uLampExtra[i].y;
    if (yw != 0.0) {
      // 回した箱: 点を箱の向きへ戻してから調べる
      vec3 bc = (uLampBoxMin[i] + uLampBoxMax[i]) * 0.5;
      vec3 r = p - bc;
      float cs = cos(yw);
      float sn = sin(yw);
      q = bc + vec3(cs * r.x - sn * r.z, r.y, sn * r.x + cs * r.z);
    }
    if (any(lessThan(q, uLampBoxMin[i])) || any(greaterThan(q, uLampBoxMax[i]))) continue;
    // 硬い縁: 面の上の点を影の升目の中心へ寄せる（縁が升目に沿って段になる）
    vec3 pp = p;
    if (uLampExtra[i].w > 0.5 && uLampQuant > 0.0) {
      vec3 an = abs(n);
      vec3 cell = (floor(p / uLampQuant) + 0.5) * uLampQuant;
      if (an.y >= an.x && an.y >= an.z) pp.xz = cell.xz; else if (an.x >= an.z) pp.zy = cell.zy; else pp.xy = cell.xy;
    }
    vec3 d = uLampPos[i].xyz - pp;
    float dist = length(d);
    float r = uLampPos[i].w;
    float x;
    if (uLampExtra[i].z > 0.5) {
      // 四角: 箱の向きで、横は大きい方の軸・縦は半分の重み
      vec3 e = -d;
      if (yw != 0.0) {
        float c2 = cos(yw);
        float s2 = sin(yw);
        e = vec3(c2 * e.x - s2 * e.z, e.y, s2 * e.x + c2 * e.z);
      }
      vec3 a = abs(e) / r;
      x = max(max(a.x, a.z), a.y * 0.5);
    } else {
      x = dist / r;
    }
    if (x >= 1.0) continue;
    vec3 l = d / max(dist, 1e-4);
    // なめらかに 0 へ（中心付近は平ら、縁で落ちる。塗りの光だまりの形）。硬い縁は途中で切る
    float att = 1.0 - x * x;
    att *= att;
    if (uLampExtra[i].w > 0.5) att = step(0.3, att);
    // 面の向き（回り込みを少し入れて、壁も淡く照らす）
    float ndl = max(dot(n, l), 0.0) * 0.7 + 0.3;
    // 下向きの灯り: 真下ほど明るい
    float cone = uLampColor[i].w > 0.5 ? smoothstep(0.15, 0.85, l.y) : 1.0;
    acc += uLampColor[i].rgb * att * ndl * cone * mix(1.0, sunVis, uLampExtra[i].x);
  }
  return acc;
}
`,Je=new A,Ye=class{list=[];maxDist=24;order=[];add(e){return this.list.push(e),e}clear(){this.list.length=0,this.maxDist=24}update(e){let t=j;this.order.length=0;for(let t of this.list){if(t.on===!1||t.intensity<=0)continue;let n=t.box??[t.pos[0]-t.radius,t.pos[1]-t.radius,t.pos[2]-t.radius,t.pos[0]+t.radius,t.pos[1]+t.radius,t.pos[2]+t.radius],r=Math.max(n[0]-e.x,0,e.x-n[3]),i=Math.max(n[1]-e.y,0,e.y-n[4]),a=Math.max(n[2]-e.z,0,e.z-n[5]);Math.hypot(r,i,a)>this.maxDist||this.order.push({l:t,d:Math.hypot(r,i,a)*4+Math.hypot(t.pos[0]-e.x,t.pos[1]-e.y,t.pos[2]-e.z)*.1})}this.order.sort((e,t)=>e.d-t.d);let n=Math.min(16,this.order.length),r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let e=0;e<n;e++){let n=this.order[e].l,i=n.box??[n.pos[0]-n.radius,n.pos[1]-n.radius,n.pos[2]-n.radius,n.pos[0]+n.radius,n.pos[1]+n.radius,n.pos[2]+n.radius];t.uLampPos.value[e].set(n.pos[0],n.pos[1],n.pos[2],n.radius),Je.set(n.color??16777215),t.uLampColor.value[e].set(Je.r*n.intensity,Je.g*n.intensity,Je.b*n.intensity,+!!n.down),t.uLampBoxMin.value[e].set(i[0],i[1],i[2]),t.uLampBoxMax.value[e].set(i[3],i[4],i[5]),t.uLampExtra.value[e].set(n.shadow??.8,n.yaw??0,+!!n.square,+!!n.hard);let a=(i[0]+i[3])/2,o=(i[2]+i[5])/2,s=Math.abs(Math.cos(n.yaw??0)),c=Math.abs(Math.sin(n.yaw??0)),l=(i[3]-i[0])/2*s+(i[5]-i[2])/2*c,u=(i[3]-i[0])/2*c+(i[5]-i[2])/2*s;r[0]=Math.min(r[0],a-l),r[1]=Math.min(r[1],i[1]),r[2]=Math.min(r[2],o-u),r[3]=Math.max(r[3],a+l),r[4]=Math.max(r[4],i[4]),r[5]=Math.max(r[5],o+u)}t.uLampAllMin.value.set(r[0],r[1],r[2]),t.uLampAllMax.value.set(r[3],r[4],r[5]),t.uLampCount.value=n}},Xe=0;function Ze(e,t){let n=new T({color:t.color,map:t.map??null,roughness:t.roughness??1,metalness:t.metalness??0,emissive:t.emissive??0,emissiveIntensity:t.emissiveIntensity??1,transparent:t.transparent??!1,opacity:t.opacity??1,side:t.side??0,vertexColors:t.vertexColors??!1,depthWrite:t.depthWrite??!0,alphaTest:t.alphaTest??0}),i=new A(t.color),a=t.shade===void 0?M(t.color,e.toon.shade):new A(t.shade),o=t.dark===void 0?M(t.color,e.toon.dark):new A(t.dark),s=t.hi===void 0?M(t.color,e.toon.hi):new A(t.hi),c=e=>new r(e.r/Math.max(i.r,1e-4),e.g/Math.max(i.g,1e-4),e.b/Math.max(i.b,1e-4)),l={};!t.unlit&&(t.toon??1)>0&&(l.SL_TOON=1),t.unlit&&(l.SL_UNLIT=1),t.noFog&&(l.SL_NOFOG=1),t.tiles&&(l.SL_TILES=1),t.flecks&&(l.SL_FLECKS=1),t.flecks?.color2!==void 0&&(l.SL_FLECKS2=1),t.blotch&&(l.SL_BLOTCH=1),t.puddle&&(l.SL_PUDDLE=1),t.reflection&&(l.SL_REFLECT=1),t.reflection?.puddleOnly&&(l.SL_REFLECT_PUDDLE=1),t.underwater&&(l.SL_UNDERWATER=1),n.defines={...n.defines??{},...l};let u=t.tiles?Array.isArray(t.tiles.size)?t.tiles.size:[t.tiles.size,t.tiles.size]:[1,1],d={uSlRatioShade:{value:c(a)},uSlRatioDark:{value:c(o)},uSlRatioHi:{value:c(s)},uSlToon:{value:t.toon??1},uSlNoiseMul:{value:new E(...t.noise??[1,1])},uSlSpecKill:{value:t.specKill??1},uSlBounce:{value:t.bounce??-1},uSlQuant:{value:t.shadowQuant===!1?0:1},uSlLine:{value:t.line??1},uSlId:{value:Xe++*.618034%1*.9+.05},uSlTile:{value:new m(u[0],u[1],t.tiles?.line??.01,t.tiles?.jitter??0)},uSlTileOffset:{value:new r(t.tiles?.offset?.[0]??0,t.tiles?.offset?.[1]??0,t.tiles?.broken??0)},uSlTileColor:{value:new A(t.tiles?.color??0)},uSlFleck:{value:new m(t.flecks?.scale??1,t.flecks?.density??0,t.flecks?.length??.3,t.flecks?.width??.05)},uSlFleckColor:{value:new A(t.flecks?.color??16777215)},uSlFleckColor2:{value:new A(t.flecks?.color2??0)},uSlFleckDensity2:{value:t.flecks?.density2??0},uSlBlotch:{value:new m(t.blotch?.scale??1,t.blotch?.threshold??1,t.blotch?.yGain??0,0)},uSlBlotchY:{value:new E(...t.blotch?.yRange??[0,0])},uSlBlotchO:{value:new r(...t.blotch?.grad?.origin??[0,0,0])},uSlBlotchLin:{value:new r(...t.blotch?.grad?.linear??[0,0,0])},uSlBlotchAbs:{value:new r(...t.blotch?.grad?.abs??[0,0,0])},uSlBlotchColor:{value:new A(t.blotch?.color??16777215)},uSlBlotchOnly:{value:t.blotch?.only===`floor`?1:t.blotch?.only===`wall`?2:0},uSlPuddle:{value:new r(t.puddle?.scale??1,t.puddle?.threshold??1,t.puddle?.wetDarken??0)},uSlReflTex:{value:t.reflection?.texture??null},uSlReflMatrix:{value:t.reflection?.matrix??new k},uSlRefl:{value:new m(t.reflection?.strength??0,t.reflection?.distort??0,t.reflection?.posterize??0,t.reflection?.fresnel??0)},uSlReflTint:{value:new A(t.reflection?.tint??16777215)},uSlReflKey:{value:new E(t.reflection?.key??0,t.reflection?.keySoft??.05)},uSlWater:{value:new m(t.underwater?.level??0,t.underwater?.depth??1,t.underwater?.caustics??0,0)},uSlWaterColor:{value:new A(t.underwater?.color??0)}};n.userData.sl=d,n.userData.slOptions=t,t.name&&(n.name=t.name);let f=`sl:`+Object.keys(l).sort().join(`,`);return n.customProgramCacheKey=()=>f,n.onBeforeCompile=e=>{Object.assign(e.uniforms,j,d),e.vertexShader=$e(e.vertexShader),e.fragmentShader=tt(e.fragmentShader)},n}function Qe(e,t,n){let i=e,a=i.userData.slOptions,o=i.userData.sl;if(!a||!o)return;Object.assign(a,n);let s=new A(a.color);i.color.copy(s);let c=e=>new r(e.r/Math.max(s.r,1e-4),e.g/Math.max(s.g,1e-4),e.b/Math.max(s.b,1e-4));o.uSlRatioShade.value=c(a.shade===void 0?M(a.color,t.toon.shade):new A(a.shade)),o.uSlRatioDark.value=c(a.dark===void 0?M(a.color,t.toon.dark):new A(a.dark)),o.uSlRatioHi.value=c(a.hi===void 0?M(a.color,t.toon.hi):new A(a.hi))}function L(e,t,n){let r=e.indexOf(t);if(r<0)throw Error(`StyleMaterial: chunk not found: `+t);return e.slice(0,r)+n+e.slice(r+t.length)}function $e(e){return e=L(e,`#include <common>`,`#include <common>
varying vec3 vSlWorld;`),e=L(e,`#include <project_vertex>`,`#include <project_vertex>
  {
    vec4 slw = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      slw = batchingMatrix * slw;
    #endif
    #ifdef USE_INSTANCING
      slw = instanceMatrix * slw;
    #endif
    vSlWorld = (modelMatrix * slw).xyz;
  }`),e}var et=`
uniform vec3 uFogHorizon;
uniform vec3 uFogZenith;
uniform vec3 uFogGround;
uniform vec4 uFogParams;
uniform vec4 uFogParams2;
uniform vec3 uFogGlowColor;
uniform vec3 uFogGlowDir;
uniform vec3 uFogExtinction;
vec3 sl_fogColor(vec3 rd) {
  float e = rd.y;
  vec3 c = e >= 0.0 ? mix(uFogHorizon, uFogZenith, smoothstep(0.0, 0.55, e)) : mix(uFogHorizon, uFogGround, smoothstep(0.0, 0.35, -e));
  if (uFogParams2.z > 0.0) c += uFogGlowColor * uFogParams2.z * pow(max(dot(rd, uFogGlowDir), 0.0), uFogParams2.w);
  return c;
}
// 光学的な厚さ（霧の濃さ × 距離）
float sl_fogOptical(vec3 wp, vec3 ro) {
  vec3 rd = wp - ro;
  float dist = length(rd);
  rd /= max(dist, 1e-5);
  float d = max(dist - uFogParams.w, 0.0);
  float dens = uFogParams.x;
  float b = uFogParams.y;
  if (b > 0.0) {
    float h0 = ro.y + rd.y * min(dist, uFogParams.w) - uFogParams.z;
    float k = dens * exp(-b * h0);
    float by = b * rd.y * d;
    float integ = abs(by) > 1e-4 ? (1.0 - exp(-by)) / (b * rd.y) : d;
    return k * integ;
  }
  return dens * d;
}
// 霧を掛ける。steps > 0 なら段にする（境目はワールド座標のノイズでずらす）
vec3 sl_applyFog(vec3 col, vec3 wp, vec3 ro) {
  float od = sl_fogOptical(wp, ro);
  float fa = 1.0 - exp(-od);
  if (uFogParams2.y > 0.0) {
    float st = uFogParams2.y;
    float nz = sl_warp(wp * 0.35, 3) * 0.7;
    fa = clamp(floor(fa * st + 0.5 + nz) / st, 0.0, 0.9999);
    od = -log(1.0 - fa);
  }
  fa = min(fa, uFogParams2.x);
  vec3 T = max(exp(-od * uFogExtinction), vec3(1.0 - uFogParams2.x));
  return col * T + sl_fogColor(normalize(wp - ro)) * fa;
}
`;function tt(e){e=L(e,`#include <common>`,`#include <common>
layout(location = 1) out highp vec4 gInfo;
varying vec3 vSlWorld;
uniform float uTime;
uniform float uToonAmount;
uniform vec4 uToonThresh;
uniform vec2 uToonNoise;
uniform float uToonBounce;
uniform float uSlBounce;
uniform float uSlQuant;
uniform float uShadowQuant;
uniform float uShadowJitter;
uniform mat4 uSunShadowMatrix;
uniform float uSunShadowNormalBias;
uniform vec3 uSlRatioShade;
uniform vec3 uSlRatioDark;
uniform vec3 uSlRatioHi;
uniform float uSlToon;
uniform vec2 uSlNoiseMul;
uniform float uSlSpecKill;
uniform float uSlLine;
uniform float uSlId;
uniform vec4 uSlTile;
uniform vec3 uSlTileOffset;
uniform vec3 uSlTileColor;
uniform vec4 uSlFleck;
uniform vec3 uSlFleckColor;
uniform vec3 uSlFleckColor2;
uniform float uSlFleckDensity2;
uniform vec4 uSlBlotch;
uniform vec2 uSlBlotchY;
uniform vec3 uSlBlotchO;
uniform vec3 uSlBlotchLin;
uniform vec3 uSlBlotchAbs;
uniform vec3 uSlBlotchColor;
uniform float uSlBlotchOnly;
uniform vec3 uSlPuddle;
uniform sampler2D uSlReflTex;
uniform mat4 uSlReflMatrix;
uniform vec4 uSlRefl;
uniform vec3 uSlReflTint;
uniform vec2 uSlReflKey;
uniform vec4 uSlWater;
uniform vec3 uSlWaterColor;
${le}
${de}
${ue}
${et}
${qe}
// 1 つ目の平行光源の影（灯りにも効かせる）。lights_fragment_begin の影の計算で入れる
float slSunShadow = 1.0;
float sl_recShadow(float v, int idx) {
  if (idx == 0) slSunShadow = v;
  return v;
}
vec3 sl_geoNormal() {
  vec3 n = normalize(cross(dFdx(vSlWorld), dFdy(vSlWorld)));
  if (dot(n, cameraPosition - vSlWorld) < 0.0) n = -n;
  return n;
}
vec4 sl_shadowCoord(vec4 c, int idx) {
  if (idx != 0 || uSlQuant <= 0.0 || (uShadowQuant <= 0.0 && uShadowJitter <= 0.0)) return c;
  vec3 wn = sl_geoNormal();
  vec3 a = abs(wn);
  vec3 q = vSlWorld;
  if (uShadowJitter > 0.0) {
    // 影の縁をちぎる: 調べる位置を面に沿ってノイズでずらす
    vec3 j = vec3(sl_fbm(q * 2.7, 3), sl_fbm(q * 2.7 + 11.3, 3), sl_fbm(q * 2.7 + 23.1, 3));
    j += 0.35 * vec3(sl_vnoise(q * 19.0), sl_vnoise(q * 19.0 + 5.1), sl_vnoise(q * 19.0 + 9.7));
    j -= wn * dot(j, wn);
    q += j * uShadowJitter;
  }
  if (uShadowQuant > 0.0) {
    vec3 cell = (floor(q / uShadowQuant) + 0.5) * uShadowQuant;
    if (a.y >= a.x && a.y >= a.z) q.xz = cell.xz; else if (a.x >= a.z) q.zy = cell.zy; else q.xy = cell.xy;
  }
  return uSunShadowMatrix * vec4(q + wn * uSunShadowNormalBias, 1.0);
}
float sl_puddleMask() {
  float n = sl_warp(vec3(vSlWorld.xz * uSlPuddle.x, 0.37), 5);
  return step(uSlPuddle.y, n);
}
`);let t=se.lights_fragment_begin,n=t.replace(/getShadow\( directionalShadowMap\[ i \], (.*?), vDirectionalShadowCoord\[ i \] \)/,`sl_recShadow( getShadow( directionalShadowMap[ i ], $1, sl_shadowCoord( vDirectionalShadowCoord[ i ], UNROLLED_LOOP_INDEX ) ), UNROLLED_LOOP_INDEX )`);if(n===t)throw Error(`StyleMaterial: shadow lookup not found in lights_fragment_begin`);return e=L(e,`#include <lights_fragment_begin>`,n),e=L(e,`#include <color_fragment>`,`#include <color_fragment>
  vec3 slN = sl_geoNormal();
  vec2 slUV = sl_planarUV(vSlWorld, slN);
  float slPuddle = 0.0;
#ifdef SL_TILES
  {
    vec2 tuv = (slUV + uSlTileOffset.xy) / uSlTile.xy;
    vec2 cell = floor(tuv);
    vec2 f = fract(tuv);
    vec2 lw = uSlTile.z / uSlTile.xy;
    vec2 dl = min(f, 1.0 - f);
    vec2 aa = fwidth(tuv) * 0.75;
    float gx = 1.0 - smoothstep(lw.x * 0.5 - aa.x, lw.x * 0.5 + aa.x, dl.x);
    float gy = 1.0 - smoothstep(lw.y * 0.5 - aa.y, lw.y * 0.5 + aa.y, dl.y);
    float g = max(gx, gy);
    if (uSlTileOffset.z > 0.0) g *= step(uSlTileOffset.z, sl_hash12(cell * 1.37 + floor(f * 3.0)));
    // 遠くでは目地を薄くする（ちらつき防止）
    g *= 1.0 - smoothstep(0.25, 0.6, max(aa.x, aa.y) / max(lw.x, 1e-4) * 0.08);
    float j = (sl_hash12(cell) - 0.5) * uSlTile.w;
    diffuseColor.rgb *= 1.0 + j;
    diffuseColor.rgb = mix(diffuseColor.rgb, uSlTileColor, g);
  }
#endif
#ifdef SL_BLOTCH
  {
    bool ok = uSlBlotchOnly < 0.5 || (uSlBlotchOnly < 1.5 ? slN.y > 0.7 : abs(slN.y) < 0.3);
    if (ok) {
      float th = uSlBlotch.y;
      if (uSlBlotchY.y > uSlBlotchY.x) th += smoothstep(uSlBlotchY.x, uSlBlotchY.y, vSlWorld.y) * uSlBlotch.z;
      vec3 dp = vSlWorld - uSlBlotchO;
      th += dot(dp, uSlBlotchLin) + dot(abs(dp), uSlBlotchAbs);
      float n = sl_warp(vSlWorld * uSlBlotch.x, 5);
      diffuseColor.rgb = mix(diffuseColor.rgb, uSlBlotchColor, step(th, n));
    }
  }
#endif
#ifdef SL_FLECKS
  {
    vec2 p = slUV * uSlFleck.x;
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    vec3 h = sl_hash33(vec3(cell, floor(dot(slN, vec3(1.0, 2.0, 3.0)) * 7.0)));
    vec2 c = (h.xy - 0.5) * 0.6;
    vec2 d = abs(f - c);
    float len = uSlFleck.z * (0.4 + h.z);
    float on = step(d.x, uSlFleck.w) * step(d.y, len * 0.5);
    if (h.z < uSlFleck.y) diffuseColor.rgb = mix(diffuseColor.rgb, uSlFleckColor, on);
#ifdef SL_FLECKS2
    else if (h.z > 1.0 - uSlFleckDensity2) diffuseColor.rgb = mix(diffuseColor.rgb, uSlFleckColor2, on);
#endif
  }
#endif
#ifdef SL_PUDDLE
  slPuddle = slN.y > 0.7 ? sl_puddleMask() : 0.0;
  diffuseColor.rgb *= 1.0 - uSlPuddle.z * (1.0 - slPuddle);
#endif
#ifdef SL_UNDERWATER
  float slUnder = max(uSlWater.x - vSlWorld.y, 0.0);
#endif
`),e=L(e,`#include <aomap_fragment>`,`#include <aomap_fragment>
#ifdef SL_UNLIT
  reflectedLight.directDiffuse = diffuseColor.rgb;
  reflectedLight.indirectDiffuse = vec3(0.0);
  reflectedLight.directSpecular = vec3(0.0);
  reflectedLight.indirectSpecular = vec3(0.0);
#endif
#if !defined(SL_UNLIT)
  vec3 slLamp = uLampCount > 0.0 ? sl_lamps(vSlWorld, slN, slSunShadow) * uLampParams.x : vec3(0.0);
#endif
#if !defined(SL_TOON) && !defined(SL_UNLIT)
  reflectedLight.directDiffuse += diffuseColor.rgb * slLamp;
#endif
#ifdef SL_TOON
  {
    vec3 F = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb * RECIPROCAL_PI * PI, vec3(1e-4));
    float s = sl_luma(F);
    s += (uSlBounce >= 0.0 ? uSlBounce : uToonBounce) * max(-slN.y, 0.0);
    float slLampL = sl_luma(slLamp);
    s += slLampL;
    float amt = uToonAmount * uSlToon;
    if (amt > 0.0) {
      float nz = sl_warp(vSlWorld * uToonNoise.y * uSlNoiseMul.y, 4);
      s *= exp2(nz * uToonNoise.x * uSlNoiseMul.x * 4.0);
      float soft = uToonThresh.w;
      vec3 base = diffuseColor.rgb;
      vec3 col = base * uSlRatioDark;
      col = mix(col, base * uSlRatioShade, sl_aastep(uToonThresh.z, s, soft));
      col = mix(col, base, sl_aastep(uToonThresh.y, s, soft));
      col = mix(col, base * uSlRatioHi, sl_aastep(uToonThresh.x, s, soft));
      // 灯りの色へ少し寄せる（灯りの強い所ほど）
      if (slLampL > 1e-3) col = mix(col, col * slLamp / slLampL, uLampParams.y * min(slLampL, 1.0));
      reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, col, amt);
      reflectedLight.indirectDiffuse *= 1.0 - amt;
      reflectedLight.directSpecular *= 1.0 - amt * uSlSpecKill;
      reflectedLight.indirectSpecular *= 1.0 - amt * uSlSpecKill;
    }
  }
#endif
#ifdef SL_UNDERWATER
  {
    vec3 vdir = normalize(vSlWorld - cameraPosition);
    float path = slUnder + slUnder / max(abs(vdir.y), 0.2);
    float k = 1.0 - exp(-path / max(uSlWater.y, 1e-3));
    vec3 tot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 tinted = mix(tot, uSlWaterColor, k);
    if (uSlWater.z > 0.0 && slUnder > 0.0) {
      vec2 v = sl_voronoi(vec3(vSlWorld.xz * 1.6, uTime * 0.35));
      float c = smoothstep(0.05, 0.0, v.y - v.x);
      tinted += uSlWaterColor * c * uSlWater.z * (1.0 - k * 0.5);
    }
    reflectedLight.directDiffuse = tinted;
    reflectedLight.indirectDiffuse = vec3(0.0);
  }
#endif
`),e=L(e,`#include <opaque_fragment>`,`#ifdef SL_REFLECT
  {
    float m = 1.0;
#ifdef SL_REFLECT_PUDDLE
    m = slPuddle;
#endif
    if (m > 0.0) {
      vec4 pc = uSlReflMatrix * vec4(vSlWorld, 1.0);
      vec2 ruv = pc.xy / pc.w;
      if (uSlRefl.y > 0.0) {
        vec3 q = vec3(vSlWorld.xz * 1.7, uTime * 0.25);
        ruv += vec2(sl_fbm(q, 3), sl_fbm(q + 7.3, 3)) * uSlRefl.y;
      }
      vec3 r = texture2D(uSlReflTex, ruv).rgb * uSlReflTint;
      if (uSlRefl.z > 0.0) {
        vec3 lab = sl_linToOklab(r);
        float lev = uSlRefl.z;
        float nz = sl_fbm(vec3(vSlWorld.xz * 2.3, uTime * 0.2), 3) * 0.6;
        lab.x = (floor(lab.x * lev + 0.5 + nz) / lev);
        r = sl_oklabToLin(lab);
      }
      if (uSlReflKey.x > 0.0) m *= smoothstep(uSlReflKey.x - uSlReflKey.y, uSlReflKey.x + uSlReflKey.y, sl_luma(r));
      vec3 vd = normalize(cameraPosition - vSlWorld);
      float fr = mix(1.0, pow(1.0 - max(vd.y, 0.0), 3.0) * 0.85 + 0.15, uSlRefl.w);
      outgoingLight = mix(outgoingLight, r, clamp(uSlRefl.x * fr * m, 0.0, 1.0));
    }
  }
#endif
#include <opaque_fragment>`),e=L(e,`#include <fog_fragment>`,`#ifndef SL_NOFOG
  gl_FragColor.rgb = sl_applyFog(gl_FragColor.rgb, vSlWorld, cameraPosition);
#endif
  {
    vec3 vn = normalize(normal);
    gInfo = vec4(vn.xy * 0.5 + 0.5, uSlId, uSlLine * gl_FragColor.a);
  }`),e}function nt(e={}){let t=new C(900,48,24),n=new u({uniforms:{...j,uClouds:{value:e.clouds??0},uCloudColor:{value:new A(e.cloudColor??16777215)},uCloudBand:{value:new E(...e.cloudBand??[.12,.12])},uCloudScale:{value:e.cloudScale??3},uSkyGain:{value:new r(e.gain??1,e.tintAmount??0,e.horizonBlend??.08)},uSkyTint:{value:new A(e.tint??16777215)}},vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,fragmentShader:`
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vDir;
      uniform float uTime;
      uniform float uClouds;
      uniform vec3 uCloudColor;
      uniform vec2 uCloudBand;
      uniform float uCloudScale;
      uniform vec3 uSkyGain;
      uniform vec3 uSkyTint;
      ${le}
      ${de}
      ${et}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = sl_fogColor(d);
        if (uClouds > 0.0) {
          float band = 1.0 - smoothstep(0.0, uCloudBand.y, abs(d.y - uCloudBand.x));
          vec2 p = d.xz / max(d.y + 0.25, 0.05) * uCloudScale;
          float n = sl_fbm(vec3(p, uTime * 0.01), 5) * 0.5 + 0.5;
          c = mix(c, uCloudColor, smoothstep(0.45, 0.8, n) * band * uClouds);
        }
        if (uSkyGain.x != 1.0 || uSkyGain.y > 0.0) {
          float k = smoothstep(0.0, max(uSkyGain.z, 1e-3), d.y);
          c = mix(c, mix(c * uSkyGain.x, uSkyTint, uSkyGain.y), k);
        }
        gl_FragColor = vec4(c, 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,side:1,depthWrite:!1,fog:!1}),i=new v(t,n);return i.name=`sky`,i.renderOrder=-1e3,i.frustumCulled=!1,i.onBeforeRender=(e,t,n)=>{i.position.setFromMatrixPosition(n.matrixWorld),i.updateMatrixWorld()},i}function rt(e){if(e.poly)return e.poly;let[t,n,r,i]=e.rect;return[[t,n],[r,n],[r,i],[t,i]]}function it(e,t=[]){let n=1/0,r=1/0,i=-1/0,a=-1/0,o=e=>{n=Math.min(n,e[0]),r=Math.min(r,e[1]),i=Math.max(i,e[0]),a=Math.max(a,e[1])};for(let t of e.spaces)rt(t).forEach(o);for(let t of e.walls??[])o(t.a),o(t.b);return t.forEach(o),[n,r,i,a]}var at={corridor:`#cfd8c4`,room:`#e7e1cc`,hall:`#d8e4dc`,stair:`#c9b8d8`,lift:`#b8b8d8`,platform:`#c8d2d6`,track:`#8a8f86`,water:`#7cc7c0`,outdoor:`#a8c49a`,service:`#b9b2a6`,void:`#3a4044`};function ot(e,t,n={}){let r=n.views??[],i=n.compact?2:4,a=n.bounds??it(e,r.map(e=>[e.eye[0],e.eye[2]])),o=a[0]-i,s=a[1]-i,c=a[2]+i,l=a[3]+i,u=n.px??1400,d=Math.min(u/(c-o),u/(l-s)),f=Math.round((c-o)*d),p=Math.round((l-s)*d);(t.width!==f||t.height!==p)&&(t.width=f,t.height=p);let m=t.getContext(`2d`),h=(e,t)=>[(e-o)*d,(t-s)*d];if(m.fillStyle=`#14191b`,m.fillRect(0,0,f,p),n.under){let[e,t,r,i]=n.under.bounds,[a,o]=h(e,t),[s,c]=h(r,i);m.globalAlpha=.85,m.drawImage(n.under.image,a,o,s-a,c-o),m.globalAlpha=1}if(!n.compact){for(let e=Math.ceil(o);e<=c;e++)m.strokeStyle=e%5==0?`rgba(255,255,255,0.10)`:`rgba(255,255,255,0.04)`,m.beginPath(),m.moveTo(...h(e,s)),m.lineTo(...h(e,l)),m.stroke();for(let e=Math.ceil(s);e<=l;e++)m.strokeStyle=e%5==0?`rgba(255,255,255,0.10)`:`rgba(255,255,255,0.04)`,m.beginPath(),m.moveTo(...h(o,e)),m.lineTo(...h(c,e)),m.stroke()}let _=e=>n.level===void 0||(e??0)===n.level;for(let t of e.spaces){if(!_(t.level))continue;let e=rt(t);if(m.beginPath(),e.forEach((e,t)=>t?m.lineTo(...h(e[0],e[1])):m.moveTo(...h(e[0],e[1]))),m.closePath(),m.globalAlpha=n.under?.25:.85,m.fillStyle=at[t.kind],m.fill(),m.globalAlpha=1,m.lineWidth=n.compact?1:1.5,m.strokeStyle=t.closed?`#6b5a4a`:`#2a3236`,n.under&&(m.strokeStyle=`#ffffff`),m.setLineDash(t.closed?[4,3]:[]),m.stroke(),m.setLineDash([]),!n.compact){let[r,i]=h(e.reduce((e,t)=>e+t[0],0)/e.length,e.reduce((e,t)=>e+t[1],0)/e.length);m.fillStyle=n.under?`#ffffff`:`#1d2427`,m.font=`${Math.max(10,Math.min(14,d*.9))}px sans-serif`,m.textAlign=`center`,m.fillText(t.label,r,i),m.font=`10px sans-serif`,m.fillStyle=n.under?`#dddddd`:`#4a5357`,m.fillText(`床 ${t.floor}${t.ceiling===void 0?``:` / 天井 ${t.ceiling}`} m`,r,i+13),m.textAlign=`start`}}for(let t of e.walls??[])_(t.level)&&(m.strokeStyle=t.kind===`glass`?`#7fd0e6`:t.kind===`fence`||t.kind===`railing`?`#c8b46a`:`#1a1f22`,n.under&&(m.strokeStyle=t.kind===`glass`?`#7fd0e6`:`#ffffff`),m.lineWidth=t.kind===`wall`||!t.kind?Math.max(2,d*.2):2,m.beginPath(),m.moveTo(...h(...t.a)),m.lineTo(...h(...t.b)),m.stroke());for(let t of e.openings){if(!_(t.level))continue;let[e,r]=h(t.at[0],t.at[1]),i=t.width/2*d,a=t.state===`locked`?`#e05a4f`:t.state===`closed`?`#e0a64f`:`#58c46b`;m.strokeStyle=a,m.lineWidth=n.compact?2:3,m.beginPath();let o=t.wall===`x`?0:t.wall===`z`?Math.PI/2:t.wall;m.moveTo(e-Math.cos(o)*i,r-Math.sin(o)*i),m.lineTo(e+Math.cos(o)*i,r+Math.sin(o)*i),m.stroke(),!n.compact&&t.kind!==`opening`&&(m.fillStyle=a,m.font=`9px sans-serif`,m.fillText(t.kind,e+3,r-3))}!n.compact&&e.tour.length&&(m.strokeStyle=`rgba(120,180,255,0.8)`,m.lineWidth=1.5,m.setLineDash([6,4]),m.beginPath(),e.tour.forEach((e,t)=>t?m.lineTo(...h(e.eye[0],e.eye[2])):m.moveTo(...h(e.eye[0],e.eye[2]))),m.stroke(),m.setLineDash([]),e.tour.forEach((e,t)=>{let[n,r]=h(e.eye[0],e.eye[2]);m.fillStyle=`#78b4ff`,m.beginPath(),m.arc(n,r,4,0,Math.PI*2),m.fill(),m.font=`10px sans-serif`,m.fillText(String(t+1),n+5,r+4)}));for(let e of r){let[t,r]=h(e.eye[0],e.eye[2]),i=Math.atan(Math.tan(g.degToRad(e.fov)/2)*(e.aspect??1456/816)),a=n.compact?10*d:Math.max(40,18*d);if(m.fillStyle=`rgba(255, 204, 51, 0.18)`,m.strokeStyle=`#ffcc33`,m.lineWidth=1.5,m.beginPath(),m.moveTo(t,r),e.reach?.length){let n=e.reach.length-1;for(let a=0;a<=n;a++){let o=e.yaw-i+2*i*a/n,s=e.reach[a]*d;m.lineTo(t-Math.sin(o)*s,r-Math.cos(o)*s)}}else for(let n of[-1,1]){let o=e.yaw+n*i;m.lineTo(t-Math.sin(o)*a,r-Math.cos(o)*a)}m.closePath(),m.fill(),m.stroke(),n.compact||(m.fillStyle=`#ffcc33`,m.font=`bold 12px sans-serif`,m.fillText(e.id,t+6,r+14))}if(n.player){let[e,t]=h(n.player.x,n.player.z);m.fillStyle=`#ff4fa0`,m.beginPath(),m.arc(e,t,n.compact?4:6,0,Math.PI*2),m.fill(),m.strokeStyle=`#ff4fa0`,m.lineWidth=2,m.beginPath(),m.moveTo(e,t),m.lineTo(e-Math.sin(n.player.yaw)*14,t-Math.cos(n.player.yaw)*14),m.stroke()}if(!n.compact){let t=10*d;m.fillStyle=`#ffffff`,m.fillRect(12,p-18,t,3),m.font=`11px sans-serif`,m.fillText(`10 m`,12,p-24),m.font=`bold 13px sans-serif`,m.fillText(`${e.title}${n.level===void 0?``:`（${n.level} 階）`}`,12,18),m.font=`11px sans-serif`,m.fillStyle=`#c8d0cc`,m.fillText(`上が奥（-Z）・黄 = 参考画像の視点・青 = 歩いて確かめる道順・緑 / 橙 / 赤 = 開いた / 閉じた / 鍵の開口`,12,34)}}var R=728,z=408;function st(e){let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function ct(e,t,n){let r=Math.cbrt(.4122214708*e+.5363325363*t+.0514459929*n),i=Math.cbrt(.2119034982*e+.6806995451*t+.1073969566*n),a=Math.cbrt(.0883024619*e+.2817188376*t+.6299787005*n);return[.2104542553*r+.793617785*i-.0040720468*a,1.9779984951*r-2.428592205*i+.4505937099*a,.0259040371*r+.7827717662*i-.808675766*a]}function B(e){let t=document.createElement(`canvas`);t.width=R,t.height=z;let n=t.getContext(`2d`,{willReadFrequently:!0});n.imageSmoothingQuality=`high`,n.drawImage(e,0,0,R,z);let r=n.getImageData(0,0,R,z).data,i=new Float32Array(R*z),a=new Float32Array(R*z),o=new Float32Array(R*z);for(let e=0;e<R*z;e++){let[t,n,s]=ct(st(r[e*4]),st(r[e*4+1]),st(r[e*4+2]));i[e]=t,a[e]=n,o[e]=s}return{L:i,A:a,B:o}}function lt(e,t,n,r){let i=Math.floor(t/r),a=Math.floor(n/r),o=new Float32Array(i*a);for(let n=0;n<a;n++)for(let a=0;a<i;a++){let s=0;for(let i=0;i<r;i++)for(let o=0;o<r;o++)s+=e[(n*r+i)*t+a*r+o];o[n*i+a]=s/(r*r)}return{d:o,w:i,h:a}}function ut(e,t,n){let r=new Float32Array(t*n);for(let i=1;i<n-1;i++)for(let n=1;n<t-1;n++){let a=i*t+n,o=e[a-t+1]+2*e[a+1]+e[a+t+1]-e[a-t-1]-2*e[a-1]-e[a+t-1],s=e[a+t-1]+2*e[a+t]+e[a+t+1]-e[a-t-1]-2*e[a-t]-e[a-t+1];r[a]=Math.hypot(o,s)/4}return r}function dt(e,t=16){let n=[];for(let t of e)for(let e=0;e<t.L.length;e+=37)n.push([t.L[e],t.A[e],t.B[e]]);if(!n.length)return[];n.sort((e,t)=>e[0]-t[0]);let r=Array.from({length:t},(e,r)=>[...n[Math.floor((r+.5)/t*n.length)]]),i=new Int32Array(n.length);for(let e=0;e<12;e++){for(let e=0;e<n.length;e++){let a=0,o=1/0;for(let i=0;i<t;i++){let t=(n[e][0]-r[i][0])**2+(n[e][1]-r[i][1])**2+(n[e][2]-r[i][2])**2;t<o&&(o=t,a=i)}i[e]=a}let e=r.map(()=>[0,0,0,0]);for(let t=0;t<n.length;t++){let r=e[i[t]];r[0]+=n[t][0],r[1]+=n[t][1],r[2]+=n[t][2],r[3]++}for(let n=0;n<t;n++)e[n][3]>0&&(r[n]=[e[n][0]/e[n][3],e[n][1]/e[n][3],e[n][2]/e[n][3]])}return r}function V(e,t){let{L:n,A:r,B:i}=e,a=R*z,o=ut(n,R,z),s=0,c=0;for(let e=0;e<a;e++)o[e]>.025&&s++,o[e]<.006&&c++;let l=lt(n,R,z,8),u=ut(l.d,l.w,l.h),d=0;for(let e=0;e<u.length;e++)u[e]>.02&&d++;let f=lt(n,R,z,32),p=0;for(let e of f.d)p+=e;p/=f.d.length;let m=0;for(let e of f.d)m+=(e-p)**2;let h=Float32Array.from(n).sort(),g=h[Math.floor(a*.95)]-h[Math.floor(a*.05)],_=0;for(let e=0;e<a;e++)_+=Math.hypot(r[e],i[e]);let v=0;if(t&&t.length){let e=0;for(let o=0;o<a;o+=7){let a=1/0;for(let e of t)a=Math.min(a,(n[o]-e[0])**2+(r[o]-e[1])**2+(i[o]-e[2])**2);v+=Math.sqrt(a),e++}v/=e}let y=(e,t=1e3)=>Math.round(e*t)/t;return{detail:y(s/a),shape:y(d/u.length),light:y(Math.sqrt(m/f.d.length)),contrast:y(g),flat:y(c/a),chroma:y(_/a),palette:y(v*100,10)}}function ft(e){let t=e>>>0||1;return()=>(t^=t<<13,t^=t>>>17,t^=t<<5,(t>>>0)/4294967296)}var H=(e,t,n,r,i=!1)=>({kind:`number`,default:e,min:t,max:n,note:r,...i?{integer:i}:{}}),pt=(e,t)=>({kind:`boolean`,default:e,note:t}),mt={"move.climb.speed":H(2,.5,5,`はしご: 上り下りの速さ（m/s）`),"move.swim.speed":H(1.9,.5,5,`泳ぐ: 水平の速さ（m/s）`),"move.swim.dashSpeed":H(2.5,.5,6,`泳ぐ: 走る操作のときの水平の速さ（m/s）`),"move.swim.depth":H(1.2,.6,2,`泳ぐ: 足元から水面までがこれより深いと泳ぐ（m。浅ければ水の中を歩く）`),"move.swim.float":H(1.38,1,1.7,`泳ぐ: 浮いたときの足元の深さ（m。目が水面の少し上に出る）`),"move.swim.rise":H(1.7,.5,4,`泳ぐ: 跳ぶ操作で浮き上がる速さ（m/s）`),"move.swim.dive":H(1.6,.5,4,`泳ぐ: しゃがむ操作で潜る速さ（m/s）`),"move.swim.mantle":H(.65,.2,1.2,`泳ぐ: 水面からこの高さまでの縁なら、前へ押すと這い上がれる（m）`),"move.grav.holdSec":H(.2,.05,1,`重力の向き: 磁力の面へ向かって押し続けると乗り移るまでの秒数`),"move.grav.leaveSec":H(.15,.05,1,`重力の向き: 磁力の面から足が離れて、普通の重力に戻るまでの秒数`),"move.scale.rate":H(1.6,.2,6,`身体の大きさ: 大きさが変わる速さ（倍率 / 秒）`),"move.updraft.accel":H(4,.5,20,`上昇気流: 上向きの流れの速さへ近づく強さ（/ 秒）`),"move.wind.gust":H(4.6,3,12,`送風の通路: 突風の速さ（m/s）。歩く（3）より強いので開けた所では押し戻され、立ち止まると入口まで飛ばされる。ダッシュ（5.5）なら少しずつ進める`),"move.wind.breeze":H(.6,0,3,`送風の通路: 突風の間の弱い風（m/s）`),"move.wind.period":H(4.6,2,12,`送風の通路: 突風の周期（秒）`),"move.wind.duty":H(.4,.1,.8,`送風の通路: 周期のうち突風の割合`),"move.wind.warn":H(.9,0,3,`送風の通路: 突風の予告（送風機がうなる）の秒数`),"move.wind.air":H(1.6,1,4,`送風の通路: 宙にいる間の風の倍率（跳ぶと飛ばされる）`),"move.wind.landingM":H(1.4,1,2.5,`送風の通路: 入口の前の風の来ない奥行き（m）`),"move.wind.pitchM":H(2.6,1.8,4,`送風の通路: 風よけの仕切りの間隔（m）`),"move.wind.blownSec":H(.45,.2,3,`送風の通路（出現型の隠し）: 突風の中で宙にいる秒数`),"move.crowd.chance":H(.35,0,1,`送風の通路: 人の流れ（見えない群衆）の変種になる確率（幅 3 m 以上の部屋）`),"move.crowd.speed":H(2.2,.5,2.6,`人の流れ: 横切る流れの速さ（m/s）。歩く速さより弱く（流されながら渡れる）`),"move.crowd.laneM":H(1.3,.8,2.5,`人の流れ: 流れの帯の幅（m）`),"move.crowd.period":H(3.4,1.5,10,`人の流れ: 流れが強まる周期（秒）`),"move.crowd.duty":H(.5,.1,.9,`人の流れ: 周期のうち流れのある割合`),"move.foot.w.ice":H(.45,0,10,`足元の部屋: 氷の重み`),"move.foot.w.wax":H(.25,0,10,`足元の部屋: 磨いて濡れた床の重み`),"move.foot.w.mud":H(.3,0,10,`足元の部屋: 泥の重み`),"move.foot.iceFriction":H(.22,.05,1,`氷: 足の効き（1 が普通。小さいほど止まれない）`),"move.foot.waxFriction":H(.35,.05,1,`滑る床: 足の効き`),"move.foot.holeDepthM":H(1.2,.6,2.5,`氷・滑る床: 落ちると入口からの穴の深さ（m）`),"move.foot.matM":H(.95,.6,1.6,`氷・滑る床: 止まれる敷物の大きさ（m）`),"move.foot.mats":H(5,1,12,`氷・滑る床: 止まれる敷物の数の上限`,!0),"move.foot.mudSlow":H(.4,.15,.9,`泥: 歩く速さの倍率`),"move.foot.mudSink":H(.2,0,.6,`泥: 足が沈む深さ（m。目が下がる）`),"move.foot.quickM":H(1.4,.8,2.5,`泥: 流砂の大きさ（m）`),"move.foot.quickSec":H(1.8,.5,6,`泥: 流砂で立ち止まって飲み込まれるまでの秒数`),"move.crawl.shrinkChance":H(.5,0,1,`這う部屋: 縮むトンネルになる確率（入口と出口が向かい合う細長い部屋。ほかはダクト）`),"move.crawl.widthM":H(.95,.8,1.4,`這う部屋: 這う所の幅（m）`),"move.crawl.heightM":H(1,.9,1.3,`這う部屋: 這う所の高さ（m。しゃがみの高さ 0.85 m より高く）`),"move.crawl.backwardSec":H(2,.5,8,`縮むトンネル（出現型の隠し）: 立ったまま後ろ向きに歩き続ける秒数`),"move.backward.push":H(5,3.2,10,`後ろ向きの通路: 前を向いたときに押し戻す速さ（m/s。歩く 3 より強く）`),"move.backward.coneDeg":H(65,30,89,`後ろ向きの通路: 前からこの角度の内を向いていると押される`),"move.stretch.periodM":H(1.8,1.2,3,`伸びる廊下: 柱と照明の間隔（m）。歩いて境目を越えると、この長さだけ戻される`),"move.stretch.stillSec":H(1,.3,4,`伸びる廊下: 立ち止まってから前へ滑り始めるまでの秒数`),"move.stretch.glide":H(1.3,.5,3,`伸びる廊下: 立ち止まっている間に前へ滑る速さ（m/s）`),"move.chasm.depthM":H(2.7,2.2,3.05,`溝・穴の部屋: 穴の深さ（m。3.1 m 以上は隠し部屋が隣の区画の下に入り込む）`),"move.chasm.tileM":H(1,.6,1.6,`抜ける床: 床板の大きさ（m）`),"move.chasm.trapSpeed":H(2.1,1.7,2.8,`抜ける床: これより速く動くと床板が軋んで開く（m/s。しゃがみ歩き 1.5 と歩く 3.0 の間）`),"move.chasm.trapCreakSec":H(.12,0,.5,`抜ける床: 速く動き続けて開くまでの軋み（秒）`),"move.chasm.trapStillSec":H(2,.8,6,`抜ける床: 床板の上で立ち止まって開くまで（秒）`),"move.chasm.trapOpenSec":H(3,1,10,`抜ける床: 開いた床板が閉じるまで（秒）`),"move.chasm.ghostCellM":H(.95,.9,1.4,`見えない足場: 足場の 1 升の大きさ（m）`),"move.chasm.bridgeW":H(.85,.75,1.4,`吊り橋: 橋板の幅（m）`),"move.chasm.swayGain":H(4,.5,20,`吊り橋: 歩くより速く動いたときに揺れが大きくなる強さ（度 / 秒 /（m/s）²）`),"move.chasm.swayMaxDeg":H(16,4,30,`吊り橋: 揺れの傾きの上限（度）`),"move.chasm.swayPush":H(.6,.1,2,`吊り橋: 傾きで横へ押す強さ（重さに対する割合）`),"move.chasm.walkW":H(1.2,.9,2,`振り子の通路: 橋の幅（m）`),"move.chasm.pendulumPitch":H(1.9,1.5,3,`振り子の通路: 振り子の間隔（m。間で待てる）`),"move.chasm.pendulumPeriod":H(2.6,1.6,5,`振り子の通路: 振り子の周期（秒）`),"move.chasm.rideSec":H(1.2,.3,5,`振り子の通路（出現型の隠し）: 振り子の板に乗っている秒数`),"move.rise.w.springs":H(.4,0,10,`高い所へ上がる部屋: 弾む床の重み`),"move.rise.w.updraft":H(.3,0,10,`高い所へ上がる部屋: 上昇気流の重み`),"move.rise.w.ladder":H(.3,0,10,`高い所へ上がる部屋: はしごの重み`),"move.rise.stepM":H(1.25,1,1.8,`高い所へ上がる部屋: 棚 1 段の高さ（m。跳んで届く 0.9 m より高く）`),"move.rise.ledgeDepthM":H(1.5,1.1,2.2,`高い所へ上がる部屋: 棚の奥行き（m）`),"move.rise.ledgeLenM":H(2,1.6,3,`高い所へ上がる部屋: 棚 1 段の長さ（m）`),"move.rise.overshootM":H(.7,.3,1.5,`弾む床: 次の棚より高く跳ね上がる分（m）`),"move.rise.updraftSpeed":H(3.2,1.5,6,`上昇気流: 吹き上がる速さ（m/s）`),"move.escalator.depthM":H(1.8,1.4,3,`逆走エスカレーター: 穴の深さ（m。エスカレーターで上る高さ）`),"move.escalator.speed":H(2.3,1,2.39,`逆走エスカレーター: 下りに動く速さ（m/s）。歩く 3.0 より少し遅く（歩くと少しずつ、走るとゆっくり上れる）`),"move.escalator.landingM":H(.9,.7,1.6,`逆走エスカレーター: 途中の踊り場の長さ（m）`),"move.escalator.stillSec":H(2.5,.5,8,`逆走エスカレーター（出現型の隠し）: 踊り場で立ち止まる秒数`),"move.slide.depthM":H(2.4,1.8,3,`滑り台: 穴の深さ（m）`),"move.slide.waterChance":H(.5,0,1,`滑り台: 水の流れる滑り台（ウォータースライダー）になる確率`),"move.slide.slopeDeg":H(38,25,45,`滑り台: 傾き（度）`),"move.slide.speed":H(4.5,2.5,8,`滑り台: 滑り落ちる流れの速さ（m/s。歩く速さより強く、上へは戻れない）`),"move.slide.chuteSpeed":H(3,2.5,6,`滑り台（隠し）: 横の溝の流れの速さ（m/s）`),"move.turn.radiusMaxM":H(3.2,1.9,5,`回る床: 円盤の半径の上限（m）`),"move.turn.omega":H(.42,.1,1.2,`回る床: 回る速さ（rad/s。縁で約 1.3 m/s）`),"move.turn.rimSec":H(9,2,30,`回る床（出現型の隠し）: 縁に乗り続ける秒数`),"move.revolve.radiusM":H(1.6,1.3,2.2,`回転扉: 筒の半径（m）`),"move.revolve.walkW":H(1.3,.4,3,`回転扉: 歩いて押したときの回る速さの上限（rad/s）`),"move.revolve.runW":H(2.8,1,5,`回転扉: 走って押したときの回る速さの上限（rad/s）`),"move.revolve.damp":H(.9,.2,4,`回転扉: 手を離した後に回る勢いが弱まる速さ（/ 秒）`),"move.push.travelM":H(1.8,1.2,3,`押せる壁: 板が動く距離（m）`),"move.push.speed":H(.7,.2,2,`押せる壁: 押しているときに動く速さ（m/s）`),"move.tilt.maxDeg":H(12,4,20,`傾いていく部屋: 床の傾きの上限（度）`),"move.tilt.rate":H(1.1,.2,5,`傾いていく部屋: 傾いていく速さ（度 / 秒。人がいなくなると半分の速さで戻る）`),"move.tilt.push":H(.35,0,1,`傾いていく部屋: 傾きで低い側へ押す強さ（重さに対する割合）`),"move.atrium.depthM":H(2,1.6,3.4,`吹き抜け: 穴の深さ（m）`),"move.atrium.w.rope":H(.3,0,10,`吹き抜け: ロープ渡りの重み`),"move.atrium.w.zip":H(.25,0,10,`吹き抜け: ジップラインの重み`),"move.atrium.w.cart":H(.2,0,10,`吹き抜け: 台車の重み`),"move.atrium.w.gondola":H(.25,0,10,`吹き抜け: ゴンドラの重み`),"move.atrium.ropeSpeed":H(1.1,.4,3,`ロープ渡り: つかまって進む速さ（m/s）`),"move.atrium.zipAccel":H(3,.5,10,`ジップライン: 加速（m/s²）`),"move.atrium.zipMax":H(6,2,12,`ジップライン: 速さの上限（m/s）`),"move.atrium.cartAccel":H(2.5,.5,8,`台車: 押されて走る加速（m/s²）`),"move.atrium.cartMax":H(7,2,12,`台車: 速さの上限（m/s）`),"move.atrium.carWait":H(3,1,10,`ゴンドラ: 乗り場で待つ秒数`),"move.pool.depthM":H(2.2,1.6,3,`深いプール: 深さ（m）`),"move.pool.surfaceM":H(.35,.15,.55,`深いプール: 水面が床より低い分（m。這い上がれる高さ move.swim.mantle より低く）`),"move.pool.stoneChance":H(.5,0,1,`深いプール: 跳び石になる確率`),"move.balls.shallowSlow":H(.8,.3,1,`ボールプール: 浅い道の速さの倍率`),"move.balls.deepSlow":H(.42,.15,1,`ボールプール: 深い所の速さの倍率`),"move.balls.jostle":H(.5,0,2,`ボールプール: 深い所で球に押される強さ（m/s）`),"move.balls.diveSec":H(2,.5,8,`ボールプール（出現型の隠し）: いちばん深い所でしゃがんでじっとしている秒数`),"move.heavy.scaleMin":H(1.6,1.2,2.5,`重い部屋: 重さの倍率の下限`),"move.heavy.scaleMax":H(1.85,1.2,2.8,`重い部屋: 重さの倍率の上限`),"move.heavy.slow":H(.78,.4,1,`重い部屋: 歩く速さの倍率`),"move.underwater.slow":H(.6,.3,1,`水の中の部屋: 速さの倍率`),"move.underwater.drag":H(1.8,.5,5,`水の中の部屋: 落ちる速さの上限（m/s）`),"move.underwater.gravity":H(.55,.2,1,`水の中の部屋: 重さの倍率（ふわりと跳ぶ）`),"move.underwater.fogFar":H(10,4,30,`水の中の部屋: 霧の届く距離（m）`),"move.ball.bubbleChance":H(.5,0,1,`球に乗る部屋: バブル（球の中に入る）になる確率`),"move.ball.accel":H(3.5,1,10,`玉乗り: 操作の向きへの加速（m/s²）`),"move.ball.bubbleAccel":H(4.5,1,10,`バブル: 操作の向きへの加速（m/s²）`),"move.ball.vmax":H(5,2,9,`球: 速さの上限（m/s）`),"move.ball.throwSpeed":H(2.6,1,6,`玉乗り: この速さより速く壁にぶつかると振り落とされる（m/s）`),"move.ball.paintSlow":H(.15,.05,.8,`球に乗る部屋: 塗りたてのペンキの床を歩く速さの倍率`),"move.size.small":H(.34,.2,.6,`大きさの門「小」: 身体の大きさの倍率（ネズミの穴 0.7 m を立ったまま通れる）`),"move.size.large":H(1.35,1.1,1.6,`大きさの門「大」: 身体の大きさの倍率（天井 2.6 m の部屋で立てる）`),"move.size.underSec":H(1,.3,5,`身体の大きさ（出現型の隠し）: 小さいまま戸棚の下にいる秒数`),"move.grav.w.loop":H(.4,0,10,`重力の部屋: 床・壁・天井をひと回りする帯（回廊）の重み`),"move.grav.w.maze":H(.3,0,10,`重力の部屋: 床の迷路と天井の道（迷路）の重み`),"move.grav.w.tube":H(.3,0,10,`重力の部屋: 回る筒の通路の重み`),"move.grav.mazeMinH":H(3.3,3,5,`重力の迷路: 天井の高さの下限（m。天井を歩く頭が床の仕切り 1.4 m に当たらない）`),"move.grav.ceilingSec":H(2,.5,8,`重力の回廊（出現型の隠し）: 天井の帯を歩く秒数`)},ht={"ground.collapse.depthM":H(2.8,2.4,3.05,`崩れていく帰り道: 穴の深さ（m）`),"ground.collapse.tileM":H(1,.6,1.6,`崩れていく帰り道: 床板の大きさ（m）`),"ground.collapse.delaySec":H(.1,0,2,`崩れていく帰り道: 装置に触れてから崩れ始めるまで（秒）`),"ground.collapse.shakeSec":H(.3,.1,2,`崩れていく帰り道: 崩れの前線が来てから床板が落ちるまで（秒。揺れて見せる）`),"ground.collapse.margin":H(.5,0,1,`崩れていく帰り道: 前線の速さ（0 = 歩く人をぎりぎり捕まえる / 1 = 走る人をぎりぎり逃がす。部屋の奥行きから速さを決める）`),"ground.collapse.speedMin":H(3.4,2,8,`崩れていく帰り道: 前線の速さの下限（m/s）`),"ground.collapse.speedMax":H(10,2,14,`崩れていく帰り道: 前線の速さの上限（m/s。浅い部屋ほど速い）`),"ground.collapse.restoreSec":H(8,2,60,`崩れていく帰り道: 全部落ちてから床板が戻るまで（秒。落ちて階段を上るあいだに戻る）`),"ground.domino.trenchM":H(1.9,1.4,2.6,`ドミノの橋: 溝の幅（m。橋の棚の長さ = 幅 + 0.65 が天井に収まること）`),"ground.domino.depthM":H(2.4,1.8,3.05,`ドミノの橋: 溝の深さ（m）`),"ground.domino.heightM":H(1.8,1.2,2.4,`ドミノの橋: 鎖の棚の高さ（m。隣の棚との間 1 m より高く）`),"ground.crate.cellM":H(1.2,1.2,1.5,`箱の橋: 升目の大きさ（m。溝は 2 升の幅。下がり天井の下で、しゃがんで跳んでも 2.4 m は越えられない）`),"ground.crate.heightM":H(.9,.6,1.2,`箱の橋: 箱の高さ（m。溝の深さ = 高さ + 5 cm。落ちた箱の上面が床の高さ）`),"ground.crate.soffitM":H(1.8,1.74,1.9,`箱の橋: 溝の上の下がり天井の高さ（m。走って跳んでも頭が当たって溝を越えられない）`),"ground.crate.minPush":H(4,1,20,`箱の橋: 解くのに要る押す回数の下限`,!0),"ground.crate.maxPush":H(14,2,40,`箱の橋: 解くのに要る押す回数の上限`,!0),"ground.weight.trenchM":H(2.4,2.4,3.2,`重りの床: 溝の幅（m。下がり天井の下で、跳んでも 2.4 m は越えられない）`),"ground.weight.depthM":H(1.8,1.2,3,`重りの床: 溝の深さ（m）`),"ground.weight.soffitM":H(1.8,1.74,1.9,`重りの床: 溝の上の下がり天井の高さ（m）`),"ground.weight.holdSec":H(.8,.2,4,`重りの床: 印から降りてから床板が沈み始めるまで（秒。走れば渡れ、歩くと沈む）`),"ground.weight.speed":H(1.6,.5,4,`重りの床: 床板の上下の速さ（m/s）`),"ground.weight.buttonSec":H(6,2,20,`重りの床: 向こう岸のボタンで床板が上がっている秒数`),"ground.still.trenchM":H(2.4,2.4,3.2,`立ち止まると見える道: 溝の幅（m）`),"ground.still.depthM":H(2.2,1.6,3,`立ち止まると見える道: 溝の深さ（m）`),"ground.still.soffitM":H(1.8,1.74,1.9,`立ち止まると見える道: 溝の上の下がり天井の高さ（m）`),"ground.still.firstSec":H(1.5,.5,5,`立ち止まると見える道: 光の四角で止まって 1 本目の橋が現れるまで（秒）`),"ground.still.secondSec":H(6,3,20,`立ち止まると見える道: さらに長く止まって 2 本目の橋が現れるまで（秒。止まり始めてから）`),"ground.sink.depthM":H(3,2,6,`沈む床: 縦穴の深さ（m）`),"ground.sink.speed":H(.35,.1,1.5,`沈む床: 沈む・戻る速さ（m/s。ゆっくり）`),"ground.sink.gotoSec":H(1.2,.2,5,`沈む床: 底で止まっていて、1 つ下のフロアへ移るまで（秒）`),"ground.rise.maxM":H(2,1.3,3,`せり上がる床: 高い扉の高さの上限（m。天井の高さ − 2.25 m まで）`),"ground.rise.speed":H(.45,.1,1.5,`せり上がる床: 上下の速さ（m/s）`),"ground.balance.holdSec":H(2,.5,8,`天秤の床: 釣り合ってから間の床が下がり始めるまで（秒）`),"ground.hatch.depthM":H(2.4,1.8,3.05,`床下の明かり: 地下の小部屋の深さ（m）`),"ground.chime.tileM":H(1.1,.8,1.6,`踏むと鳴る床: 升目の大きさ（m）`),"ground.chime.length":H(4,3,8,`踏むと鳴る床: 節の長さ（升目の数）`,!0),"ground.chime.demoSec":H(5,2,20,`踏むと鳴る床: 節を見せたあと、次に見せるまでの間（秒）`),"ground.avoid.tileM":H(1,.8,1.6,`踏まない区画: 升目の大きさ（m）`),"ground.avoid.decoy":H(.12,0,.6,`踏まない区画: 道の外の升目のうち、白い（踏んでよい）おとりの割合`),"ground.visit.stopSec":H(.6,.2,3,`順番の区画: 印の上で立ち止まって「訪れた」になるまで（秒）`),"ground.glow.fadeSec":H(30,5,120,`光る床: 踏んだ所が光って消えるまで（秒）`),"ground.trail.stopSec":H(1.5,.5,6,`足跡: 足跡の終わりで立ち止まって扉が現れるまで（秒）`),"ground.loop.corridorM":H(1.5,1.2,2.5,`足跡が残る床: 真ん中の塊のまわりの通路の幅（m）`),"ground.loop.prints":H(320,40,800,`足跡が残る床: 残る足跡の数の上限（古い物から消える）`,!0),"ground.mirror.gazeSec":H(1.2,.3,5,`水たまりの鏡: 水面に映った扉を見続けて、本当の扉が現れるまで（秒）`),"ground.press.bandM":H(1.2,.8,2,`落ちてくる天井: 落ちる天井の帯の奥行き（m）`),"ground.press.stripeM":H(1,.9,2,`落ちてくる天井: 帯と帯の間の、落ちてこない床の幅（m。黄色の線の間）`),"ground.press.upSec":H(2.6,1.6,8,`落ちてくる天井: 上がっている間（秒）`),"ground.press.warnSec":H(1,.5,3,`落ちてくる天井: 影と粉で予告する間（秒）`),"ground.press.fallSec":H(.25,.1,1,`落ちてくる天井: 落ち切るまで（秒）`),"ground.press.holdSec":H(.9,.3,3,`落ちてくる天井: 下りている間（秒）`),"ground.press.riseSec":H(1.4,.5,4,`落ちてくる天井: 上がり切るまで（秒）`),"ground.press.safeSec":H(1.2,.8,3,`落ちてくる天井: 歩く人が渡り始める、落ちてくるまでの残りの秒（予告の前）`),"ground.turn.depthM":H(2,1.6,3.05,`回る円盤: 穴の深さ（m）`),"ground.turn.pauseSec":H(4.5,2.5,10,`回る円盤: 橋が止まっている間（秒）`),"ground.turn.turnSec":H(5,2,12,`回る円盤: 橋が 90° 回るのに掛かる秒`),"ground.turn.needSec":H(2.6,1.5,5,`回る円盤: 歩く人が乗り降りを始める、止まっている残りの秒`),"ground.slide.tileM":H(1.2,1,1.8,`動く床タイル: 床板の升目の大きさ（m）`),"ground.slide.depthM":H(2.4,1.8,3.05,`動く床タイル: 床板の下の溝の深さ（m）`),"ground.slide.holes":H(.22,.1,.4,`動く床タイル: 空いた升目の割合`),"ground.slide.moveSec":H(1.2,.5,4,`動く床タイル: 床板が隣の升目へ滑るのに掛かる秒`),"ground.slide.pauseSec":H(.5,0,4,`動く床タイル: 滑り終えてから次の床板が滑り出すまで（秒）`),"ground.vend.keyAfter":H(5,3,12,`自販機: 同じボタンを続けて何回押すと鍵が出てくるか`,!0),"ground.auto.flaky":H(.4,0,.9,`自動扉: 調子の悪い扉が、近づいても開かない割合`),"ground.auto.crouchSec":H(1.2,.3,4,`自動扉: 故障中の扉の前でしゃがんで、開くまで（秒）`),"ground.shutter.openSec":H(3.5,1.5,10,`シャッター: 開いている間（秒）`),"ground.shutter.downSec":H(3.5,1,10,`シャッター: 下り切るまで（秒）`),"ground.shutter.closedSec":H(1.5,0,6,`シャッター: 閉まっている間（秒）`),"ground.shutter.upSec":H(2.5,1,8,`シャッター: 上がり切るまで（秒）`),"ground.shutter.needSec":H(1.6,.8,4,`シャッター: 歩く人がくぐり始める、開いている残りの秒`),"ground.alarm.sec":H(15,6,40,`回転灯と警報: 警報が鳴っている間（秒。鋼鉄の扉が開いている間）`),"ground.bell.delaySec":H(1.5,.3,5,`呼び出しボタン: 押してから遠くでベルが鳴り始めるまで（秒）`)},gt={"sense.lightPit.depthM":H(2.4,2,3,`光の床の部屋: 穴の深さ（m）`),"sense.beamFloor.tileM":H(.6,.4,1.2,`照らした所だけある床: 床板の大きさ（m）`),"sense.beamFloor.graceSec":H(1.4,.3,4,`照らした所だけある床: 照らすのをやめてから床板が消えるまで（秒。歩いて足元まで来る間はある）`),"sense.beamFloor.deg":H(26,10,40,`照らした所だけある床: 床を作る光の円錐の半角（度。懐中電灯の明るい芯の大きさ）`),"sense.beamFloor.rangeM":H(8,3,20,`照らした所だけある床: 床を作る光の届く距離（m）`),"sense.spotRide.radiusM":H(1.05,.7,2,`動く光の中だけ床: 光の円の半径（m）`),"sense.spotRide.speed":H(.85,.3,2.5,`動く光の中だけ床: 光の円の速さ（m/s。歩くより遅い）`),"sense.spotRide.pauseSec":H(2.5,.5,8,`動く光の中だけ床: 両端で止まる秒数（乗り降りする間）`),"sense.spotRide.tileM":H(.5,.3,1,`動く光の中だけ床: 床板の大きさ（m）`),"sense.lightBands.widthM":H(.75,.5,1.4,`光の帯の橋: 帯の幅（m）`),"sense.lightBands.gapM":H(.45,.2,1.2,`光の帯の橋: 帯の間（m。隣の帯へ乗り移れる）`),"sense.lightBands.onSec":H(4.5,2,12,`光の帯の橋: 帯が点いている秒数（長い穴では、歩いて渡り切れる長さまで延ばす）`),"sense.lightBands.offSec":H(2.5,.5,8,`光の帯の橋: 帯が消えている秒数`),"sense.lightBands.warnSec":H(1,0,3,`光の帯の橋: 消える前に瞬く秒数`),"sense.lookBridge.widthM":H(1,.6,1.6,`見ている間だけある橋: 橋の幅（m）`),"sense.lookBridge.graceSec":H(.9,.2,3,`見ている間だけある橋: 目を離してから橋の板が消えるまで（秒）`),"sense.blinkout.onSec":H(5.5,2,15,`消える照明: 照明が点いている秒数`),"sense.blinkout.offSec":H(3,1,10,`消える照明: 照明が消えている秒数`),"sense.blinkout.flickerSec":H(.9,0,3,`消える照明: 消える前に瞬く秒数（合図）`),"sense.blinkout.graceSec":H(1.3,.5,5,`消える照明: 暗闇にこれだけいると闇に捕まる（秒）`),"sense.blinkout.poolM":H(1.1,.7,2,`消える照明: 消えない灯りの島の半径（m）`),"sense.blinkout.spacingM":H(4.2,2.5,8,`消える照明: 消えない灯りの島の間隔（道に沿って m）`),"sense.lightWave.segmentM":H(2,1,4,`明滅の位相: 照明の区間の長さ（m）`),"sense.lightWave.speed":H(1.5,.6,2.6,`明滅の位相: 光の波の速さ（m/s。歩くより遅い）`),"sense.lightWave.windowM":H(3.2,2,6,`明滅の位相: 点いている帯の長さ（m）`),"sense.lightWave.restSec":H(3,0,10,`明滅の位相: 波と波の間の、全部消えている秒数`),"sense.lightWave.graceSec":H(1,.4,4,`明滅の位相: 暗闇にこれだけいると闇に捕まる（秒）`),"sense.lightWave.doorPoolM":H(1.3,.8,2,`明滅の位相: 開口の前の消えない灯りの半径（m）`),"sense.search.stripM":H(1.6,1.2,3,`サーチライト: 入口・出口の壁沿いの安全な床の奥行き（m）`),"sense.search.laneM":H(1.8,1.2,3,`サーチライト: 光の円が往復する帯の幅（m）`),"sense.search.safeM":H(1.4,1,3,`サーチライト: 帯と帯の間の安全な床の最小の幅（m）`),"sense.search.radiusM":H(.9,.5,1.6,`サーチライト: 光の円の半径（m）`),"sense.search.speedMin":H(1.6,.5,5,`サーチライト: 光の円の速さの下限（m/s）`),"sense.search.speedMax":H(2.6,.5,6,`サーチライト: 光の円の速さの上限（m/s）`),"sense.search.catchesToCorner":H(2,1,10,`サーチライト: これだけ見つかると、戻される先が隅（隠しの扉の前）になる`,!0),"sense.curtains.spacingM":H(1.5,1.2,2.5,`幕の部屋: 幕の口の間隔（m）`),"sense.daruma.chantMin":H(2.4,1,8,`だるまさん: 数え歌の長さの下限（秒）`),"sense.daruma.chantMax":H(5,1,10,`だるまさん: 数え歌の長さの上限（秒）`),"sense.daruma.watchMin":H(1.8,.5,6,`だるまさん: 振り返って見ている長さの下限（秒）`),"sense.daruma.watchMax":H(3.2,.5,8,`だるまさん: 振り返って見ている長さの上限（秒）`),"sense.daruma.tolM":H(.15,.05,.6,`だるまさん: 見られている間に動いてよい距離（m。止まりきれない分）`),"sense.daruma.catchesToCorner":H(3,1,10,`だるまさん: これだけ捕まると、入口ではなく隅（隠しの扉の前）へ連れて行かれる`,!0),"sense.clock.cycleSec":H(30,10,120,`見ていない間だけ進む時計: 見ていない間に針が 12 時間回る秒数`),"sense.clock.windowH":H(.35,.1,1.5,`見ていない間だけ進む時計: 12 時の前後この時間（時）の間に見ると、扉の鍵が開く`),"sense.clock.openSec":H(6,2,20,`見ていない間だけ進む時計: 鍵が開いている秒数`),"sense.clock.goneSec":H(45,10,180,`見ていない間だけ進む時計（BO03）: 一度も見ないまま部屋にこれだけいると、時計が消えて跡が扉になる`),"sense.zoom.sec":H(1.5,.5,5,`ズームで注視: 立ち止まって看板を見つめ続ける秒数（撮像がズームして小さな文字が読める）`),"sense.zoom.deg":H(4,1.5,10,`ズームで注視: 看板を見つめている判定の角度（度）`),"sense.gaze.sec":H(1.6,.5,5,`マネキンの視線の先・鏡の扉など: 見つめ続ける秒数`),"sense.lookBack.sec":H(1,.3,4,`出口の前で振り返る: 来た道を見ている秒数`),"sense.cctv.watchSec":H(2,.5,6,`監視カメラ: モニターを見つめる秒数（自分のいない所の扉が開いているのを見る）`),"sense.chime.intervalSec":H(.7,.3,2,`音をつなぐ扉: 旋律の音と音の間（秒）`),"sense.chime.periodSec":H(11,5,40,`音をつなぐ扉: 旋律をくり返す間隔（秒）`),"sense.gate.loudLevel":H(.55,.2,.95,`マイクで開く扉: 開く音量（0..1。走る 0.7・跳んで着地 1.0・歩く 0.35）`),"sense.gate.quietLevel":H(.08,.01,.3,`静かにすると開く: これより静かな間を数える（0..1）`),"sense.gate.quietSec":H(3,1,10,`静かにすると開く: 静かにしている秒数`),"sense.steps.sneakSec":H(3,1,10,`足音が増える（BA02）: しゃがんで歩き続ける秒数`),"sense.pa.periodSec":H(6,3,20,`遠くの館内放送: 放送をくり返す間隔（秒）`),"sense.living.leanSec":H(4,1.5,12,`壁の向こうの生活音（BA04）: 壁にもたれて止まる秒数`),"sense.silent.sec":H(3,1,10,`無音の隅（BA01）: 無音の隅で止まる秒数`),"sense.maze.cellM":H(1.8,1.6,2.4,`音で形を知る迷路: 迷路の 1 マス（m）`),"sense.maze.dripSec":H(2.2,.8,6,`反響で形が分かる: 出口の前の水の音の間隔（秒）`),"sense.pitch.fogNear":H(0,0,2,`音の高さの部屋: 霧の掛かり始め（m）`),"sense.pitch.fogFar":H(7,1.5,12,`音の高さの部屋: 何も見えなくなる距離（m）`),"sense.mirror.beamY":H(1.05,.6,1.6,`鏡で光を導く: 光の筋の高さ（床から m。腰の高さ）`),"sense.mirror.targetSec":H(1,.3,4,`鏡で光を導く（BL03）: 何も無い壁の印に光を当て続ける秒数`),"sense.power.minSec":H(7,4,20,`非常電源: 電源が持つ秒数の下限`),"sense.power.maxSec":H(14,6,30,`非常電源: 電源が持つ秒数の上限`),"sense.power.walkFactor":H(1.25,.8,2.5,`非常電源: 電源が持つ秒数 = レバーから出口までを歩く秒数 × これ + 2 秒（走れば余裕・歩くと際どい）`),"sense.beacon.depthM":H(2.4,1.6,4,`霧の誘導灯: 穴の深さ（m）`),"sense.beacon.walkM":H(1.15,.9,1.6,`霧の誘導灯: 穴の上の細い道の幅（m）`),"sense.beacon.spacingM":H(2.2,1.2,4,`霧の誘導灯: 誘導灯の間隔（m）`),"sense.beacon.fogNear":H(0,0,2,`霧の誘導灯: 霧の掛かり始め（m）`),"sense.beacon.fogFar":H(8,1.5,12,`霧の誘導灯: 何も見えなくなる距離（m）`),"sense.switch.darkSec":H(1,.2,4,`照明を消すと現れる扉: 照明を消してから扉が現れるまで（秒）`),"sense.sneak.speed":H(2,1.2,2.9,`人感センサーの灯りをつけずに進む: この速さ（m/s）より速く動くと灯りがつく（しゃがみ歩き 1.5・歩き 3.0）`),"sense.sneak.holdSec":H(5,1,15,`人感センサーの灯りをつけずに進む: ついた灯りが消えるまで（秒）`),"sense.rgb.sec":H(4,1.5,12,`色の照明: 赤・緑・青の照明が 1 色ずつ点いている秒数`),"sense.lightning.minSec":H(4,1.5,20,`雷: 稲光の間隔の下限（秒）`),"sense.lightning.maxSec":H(10,3,40,`雷: 稲光の間隔の上限（秒）`),"sense.shadow.speed":H(1.1,.4,2.5,`影だけ動く: 影の歩く速さ（m/s）`),"sense.late.delaySec":H(.45,.15,1.5,`足音が遅れて聞こえる: 足音と足跡の遅れ（秒）`),"sense.edge.showDeg":H(34,20,50,`視界の端の人影: 視線からこれ以上（度）ずれた所にだけ現れる`),"sense.edge.hideDeg":H(20,8,32,`視界の端の人影: 視線がこれより近づくと消える（度）`),"sense.chairs.max":H(8,3,16,`見ていない間に動く家具: 動く椅子の数の上限`,!0),"sense.slow.speed":H(.5,.2,.9,`遅い部屋: 動く速さの倍率`),"sense.slow.pitch":H(.62,.3,.95,`遅い部屋: 足音の高さの倍率（低く・ゆっくり聞こえる）`),"sense.flood.depthM":H(2.4,2,3.2,`増水: 穴の深さ（m。満ちると頭まで浸かる深さ）`),"sense.flood.lowSec":H(5,2,20,`増水: 水が引いている秒数`),"sense.flood.riseSec":H(7,2,20,`増水: 満ちていく秒数`),"sense.flood.highSec":H(7,3,20,`増水: 満ちている秒数（浮いた箱を渡る間）`),"sense.flood.drainSec":H(5,2,20,`増水: 引いていく秒数`),"sense.flood.drownSec":H(1.2,.4,4,`増水: 頭まで浸かってから入口へ戻されるまで（秒。泳げない）`),"sense.rewind.minSec":H(12,6,30,`巻き戻る部屋: 巻き戻る間隔の下限（秒）`),"sense.rewind.maxSec":H(28,10,60,`巻き戻る部屋: 巻き戻る間隔の上限（秒）`),"sense.rewind.factor":H(1.6,1.1,3,`巻き戻る部屋: 間隔 = 入口 → レバー → 出口を歩く秒数 × これ`),"sense.loop.sec":H(40,20,90,`同じ 1 分のくり返し: くり返しの長さ（秒）`),"sense.loop.ringFrom":H(8,0,60,`同じ 1 分のくり返し: 電話が鳴り始める秒`),"sense.loop.ringTo":H(17,1,60,`同じ 1 分のくり返し: 電話が鳴りやむ秒`),"sense.loop.openFrom":H(27,0,80,`同じ 1 分のくり返し: 出口の鍵が開く秒`),"sense.loop.openTo":H(36,1,85,`同じ 1 分のくり返し: 出口の鍵が閉まる秒（くり返しの終わりより前）`),"sense.closing.delaySec":H(3.5,1,10,`閉店のアナウンス: 放送から照明が消え始めるまで（秒）`),"sense.closing.speed":H(2.2,1,3,`閉店のアナウンス: 照明が消えていく速さ（m/s。歩き 3.0 より遅い）`),"sense.closing.segmentM":H(2,1,4,`閉店のアナウンス: 照明の区間の長さ（m）`),"sense.closing.graceSec":H(1,.3,3,`閉店のアナウンス: 暗闇にこれだけいると捕まって入口へ（秒）`)},_t={"anomaly.w.smoke":H(.7,0,10,`煙の層（E02）`),"anomaly.w.leak":H(.85,0,10,`雨漏り（E03）`),"anomaly.w.snow":H(.75,0,10,`雪の室内（E04）`),"anomaly.w.wind":H(.85,0,10,`風の向き（E08）`),"anomaly.w.thermal":H(.95,0,10,`温度（E07）`),"anomaly.w.meadow":H(.7,0,10,`草原・ひまわり畑（E05）`),"anomaly.w.overgrowth":H(.75,0,10,`植物に覆われる（E12）`),"anomaly.w.sand":H(.6,0,10,`砂の部屋（E11）`),"anomaly.w.sea":H(.9,0,10,`室内の海（E10）`),"anomaly.w.waterWall":H(.75,0,10,`水の壁（E09）`),"anomaly.w.miscount":H(.75,0,10,`数が合わない（X03）`),"anomaly.w.fakeSigns":H(1.3,0,10,`案内の嘘（X04）`),"anomaly.w.nameplate":H(.65,0,10,`自分の名前（X05）`),"anomaly.w.exitSign":H(.7,0,10,`正しい出口の印（X13）`),"anomaly.w.missingColor":H(.75,0,10,`色が抜ける（X07）`),"anomaly.w.mono":H(.5,0,10,`単色の部屋（X08。黒一色・1 色だけ）`),"anomaly.w.huddle":H(.7,0,10,`家具が一か所に集まる（X10）`),"anomaly.w.oddScale":H(.95,0,10,`回転と大きさ（X11）`),"anomaly.w.misplaced":H(.8,0,10,`別の部屋の家具（X12）`),"anomaly.w.carryover":H(.65,0,10,`前の部屋の物（X06）`),"anomaly.w.void":H(.75,0,10,`壁と床が欠ける（X09）`),"anomaly.w.vast":H(.65,0,10,`中が広い部屋（W04・W09・W18）`),"anomaly.w.mirror":H(1.1,0,10,`鏡の部屋（W16）`),"anomaly.w.sideways":H(.75,0,10,`横倒しの部屋（W17）`),"anomaly.w.perspective":H(.8,0,10,`遠近法の錯覚（W15）`),"anomaly.w.dayCycle":H(.6,0,10,`時刻が進む部屋（T02）`),"anomaly.w.aging":H(.8,0,10,`古くなる部屋（T08）`),"anomaly.w.justLeft":H(.65,0,10,`去った人の残り（T09）`),"anomaly.smoke.bottomMin":H(1.15,.9,1.5,`煙の層: 煙の底の高さの下限（床から m。しゃがんだ目 0.75 m より上・立った目 1.6 m より下）`),"anomaly.smoke.bottomMax":H(1.3,.9,1.5,`煙の層: 煙の底の高さの上限（床から m）`),"anomaly.smoke.far":H(5.5,.5,12,`煙の層: 目が煙の中にあるときに何も見えなくなる距離（m。近くはなんとか見える。しゃがむと煙の下がよく見える）`),"anomaly.leak.dripsMax":H(10,1,30,`雨漏り: 雨染みと水たまりの数の上限`,!0),"anomaly.leak.dropsMax":H(500,50,2e3,`雨漏り: 雨の筋の数の上限（描画の粒）`,!0),"anomaly.leak.slow":H(.9,.5,1,`雨漏り: 水たまりの中の歩く速さの倍率`),"anomaly.snow.depth":H(.05,.01,.15,`雪の室内: 床の雪の厚さ（m。当たらない。足が少し埋まって見える）`),"anomaly.snow.prints":H(180,20,600,`雪の室内: 残す足跡の数の上限（古い物から消える）`,!0),"anomaly.snow.flakesMax":H(450,50,2e3,`雪の室内: 降る雪の粒の数の上限（描画）`,!0),"anomaly.snow.fogFar":H(16,6,40,`雪の室内: 部屋の白い霞の見える距離（m）`),"anomaly.wind.push":H(.6,0,2.5,`風の向き: 体を押す風の強さ（m/s。歩く速さ 3.0 より十分弱く）`),"anomaly.wind.itemsMax":H(90,10,300,`風の向き: 流れる紙・葉の数の上限（描画）`,!0),"anomaly.thermal.fogFar":H(9,2,16,`温度: 冷たい霧の見える距離（m。先の開口は入口から見えない）`),"anomaly.thermal.frost":H(.85,0,1,`温度: いちばん寒い所の画面の霜の強さ`),"anomaly.meadow.sunflower":H(1,0,10,`草原: ひまわり畑（全部が入口を向く）の重み`),"anomaly.meadow.wheat":H(.8,0,10,`草原: 麦畑の重み`),"anomaly.meadow.flowers":H(.8,0,10,`草原: 野の花の重み`),"anomaly.meadow.boxesMax":H(700,100,1400,`草原: 草木の箱の数の上限（描画の量）`,!0),"anomaly.overgrowth.boxesMax":H(600,100,1400,`植物に覆われる: 草木の箱の数の上限`,!0),"anomaly.sand.slow":H(.85,.5,1,`砂の部屋: 砂の上の歩く速さの倍率`),"anomaly.sand.shift":H(.025,0,.2,`砂の部屋: 床の風紋が流れる速さ（m/s。描画）`),"anomaly.sea.depth":H(.5,.2,.7,`室内の海: 海の深さ（m）`),"anomaly.sea.slow":H(.5,.2,1,`室内の海: 海の中の歩く速さの倍率`),"anomaly.sea.push":H(1.1,0,2.5,`室内の海: 寄せる波が浜へ押し戻す強さ（m/s。海の中を歩く速さ 1.5 より弱く）`),"anomaly.sea.period":H(6.5,3,15,`室内の海: 波の周期（秒）`),"anomaly.mono.black":H(.5,0,1,`単色の部屋: 黒一色にする割合（残りは 1 色だけの部屋）`),"anomaly.oddScale.spin":H(.35,0,3,`回転と大きさ: 宙で回る家具の回る速さ（rad/s。描画）`),"anomaly.oddScale.giantMin":H(2.2,1.5,4,`回転と大きさ: 巨大な家具の倍率の下限`),"anomaly.oddScale.giantMax":H(2.8,1.5,4,`回転と大きさ: 巨大な家具の倍率の上限`),"anomaly.carryover.items":H(4,1,10,`前の部屋の物: 写す家具の数の上限（大きい順）`,!0),"anomaly.void.depth":H(2.8,1.5,3.05,`壁と床が欠ける: 虚空の穴の深さ（m。3.1 m 以上は隣の区画の下に入り込む）`),"anomaly.vast.heightMin":H(9,6,20,`中が広い部屋: 天井の高さの下限（m。部屋の上の空きが足りなければ低くする）`),"anomaly.vast.heightMax":H(14,6,20,`中が広い部屋: 天井の高さの上限（m）`),"anomaly.vast.pillarSpacing":H(4.5,2.5,10,`中が広い部屋: 太い柱の間隔の目安（m）`),"anomaly.vast.narrow":H(.5,0,1,`中が広い部屋: 入口のすぐ内側を狭く低い通り口にする割合（W09）`),"anomaly.vast.mapScale":H(.55,.2,1,`中が広い部屋: 地図に出す見かけの大きさ（主の矩形の辺の倍率。W18）`),"anomaly.perspective.bands":H(5,3,8,`遠近法の錯覚: 奥行きを分ける帯の数`,!0),"anomaly.perspective.minScale":H(.45,.2,.9,`遠近法の錯覚: いちばん奥の家具・照明の大きさの倍率`),"anomaly.perspective.ceilMin":H(2.25,2.21,3,`遠近法の錯覚: いちばん奥の天井の高さ（m。開口の前の空ける高さ 2.2 m より上）`),"anomaly.perspective.doorFar":H(.5,.2,1,`遠近法の錯覚: 奥の扉の、遠くから見た大きさの倍率`),"anomaly.dayCycle.daySec":H(90,20,600,`時刻が進む部屋: 部屋の中で朝から次の朝までの秒数（部屋にいる間だけ進む）`),"anomaly.justLeft.chairSpin":H(.7,0,4,`去った人の残り: まだ回っている椅子の回る速さ（rad/s。描画）`),"anomaly.oneDifferent.depthM":H(2.3,2,3.2,`一つだけ違う: ブースの奥行き（m）`),"anomaly.oneDifferent.boothM":H(2.2,2.1,3.2,`一つだけ違う: ブースの幅の目安（m。壁の長さをこの幅で割って 3〜5 つ）`)},vt={"carry.item.range":H(2.6,1.2,4,`持てる物: 調べて（E / タップ）拾える距離（m）`),"carry.item.dropM":H(.8,.4,1.5,`持てる物: Q で置く所（体の前 m）`),"carry.item.placeTopM":H(1.25,.6,2,`持てる物: Q で上に置ける台の高さの上限（足元から m。机・棚の上）`),"carry.item.slotAimM":H(2.8,1,5,`持てる物: 置き台・受けの枠を視線で狙える距離（m）`),"carry.item.throwSpeed":H(7.5,2,16,`持てる物: 投げる速さ（m/s。走っている速さを足す）`),"carry.item.throwPitch":H(.3,0,1.2,`持てる物: この角度（rad）より上を向いて Q なら投げる（走っていても投げる）`),"carry.item.runPitch":H(.18,0,.8,`持てる物: 走りながら投げるときの、いちばん低い投げ上げの角度（rad）`),"carry.item.gravity":H(9.8,1,20,`持てる物（物理を使わない物）: 投げた物に掛かる重さ（m/s²）`),"carry.item.flySec":H(8,1,30,`持てる物: 投げた物が止まらないとき、元の所へ戻すまでの秒数`),"carry.water.safeSpeed":H(1.9,.8,3.5,`水を運ぶ: この速さ（m/s）より速く歩くとこぼれる（しゃがみ歩き 1.5・歩き 3.0・走り 5.5）`),"carry.water.spillRate":H(.12,.05,2,`水を運ぶ: 速さの超えた分 1 m/s あたり、1 秒にこぼれる割合`),"carry.water.jumpSpill":H(.22,0,1,`水を運ぶ: 跳んで着地したときにこぼれる割合`),"carry.water.fillSec":H(1.2,.2,5,`水を運ぶ: 蛇口の下で満杯になるまでの秒数`),"carry.parcel.waitSec":H(2.5,.5,10,`荷物と待つ扉: 荷物を持って枠の中で待つ秒数`),"carry.hatch.depthM":H(2.4,2.2,3,`床下収納: 穴の深さ（m。底の壁に高さ 2 m の扉が入る）`),"carry.weight.need":H(3,1,10,`重さで開く: 板の上に要る重さ（重い木箱 1 つ = これ。軽い箱 2 つで足りる）`),"carry.weight.plateM":H(3.5,2,8,`重さで開く: 板と蓋の間の距離の下限（m。板から降りて走っても間に合わない）`),"carry.weight.closeSec":H(.6,.1,3,`重さで開く: 重さが無くなってから蓋が閉まり始めるまでの秒数`),"carry.replica.pitchM":H(.7,.4,1.5,`物を置くと増える: 並べる間隔（m）`),"carry.replica.max":H(64,8,200,`物を置くと増える: 並べる数の上限`,!0),"carry.home.stageM":H(12,3,60,`運ぶと変わる物: この道のり（m）を運ぶごとに次の形になる（4 段。最後は鍵）`),"carry.balance.min":H(4,1,10,`天秤: 釣り合わせる片側の重さの下限（軽い箱 1 つずつでは開かない）`),"carry.pinball.push":H(1.2,.3,2.8,`ピンボール: 床が手前へ押す速さ（m/s。歩き 3.0 より遅いので逆らって歩ける）`),"carry.pinball.friction":H(.45,.05,1,`ピンボール: 床の滑りやすさ（小さいほど滑る）`),"carry.pinball.kick":H(6.5,2,12,`ピンボール: 丸い柱が弾く速さ（m/s）`),"carry.cart.speed":H(1.4,.5,4,`カートの坂: 台車の速さ（m/s）`),"carry.cart.laps":H(3,1,10,`カートの坂: 降りずに乗り続けると隠しが現れる周の数`,!0),"carry.memory.showSec":H(10,3,30,`記憶の部屋: 照明が消えるまで見せる秒数`),"carry.memory.patientSec":H(20,5,90,`記憶の部屋: 暗い間に物に触れずにじっとしていると隠しが現れる秒数`),"carry.book.pickR":H(.45,.2,1,`本を集める: 本を拾う半径（体の中心から水平に m）`),"carry.book.routeClear":H(.45,.2,1.2,`本を集める: 1 冊も拾わずに返却台へ行く道から、本を離す余裕（拾う半径に足す m）`)},yt={"warp.loopHall.weight":H(.5,0,10,`閉じた輪の廊下: 出やすさ（相対）`),"warp.loopHall.periodM":H(12,6,24,`閉じた輪の廊下: 同じ物が並ぶ長さ = 戻される長さ（m。6 の倍数）`,!0),"warp.loopHall.periods":H(3,3,6,`閉じた輪の廊下: くり返しの数（霧の届く長さの 2 倍 + 1 周より長く）`,!0),"warp.loopHall.fogFarM":H(10,6,14,`閉じた輪の廊下: 霧で何も見えなくなる距離（m）`),"warp.loopHall.widthM":H(2.4,1.8,3.2,`閉じた輪の廊下: 廊下の幅（壁を含む）`),"warp.loopHall.heightM":H(2.7,2.4,3.2,`閉じた輪の廊下: 天井の高さ`),"warp.loopHall.lapsOut":H(4,1,12,`閉じた輪の廊下: 前へ何周すると輪がほどけて奥の扉へ進めるか`,!0),"warp.loopHall.lapsBack":H(3,1,12,`閉じた輪の廊下（BX02）: 輪が閉じたあと、後ろへ何周すると後ろの輪がほどけて隠しの入口が現れるか`,!0),"warp.loopHall.giveUpSec":H(80,20,600,`閉じた輪の廊下: 抜けられなくてもこの秒数で前も後ろもほどける（閉じ込めない）`),"warp.loopHall.secretWeight":H(1.4,0,5,`閉じた輪の廊下（BX02）: 隠しの元の重み`),"warp.lapHall.weight":H(.6,0,10,`異変の廊下: 出やすさ（相対）`),"warp.lapHall.goal":H(5,1,12,`異変の廊下: 何回続けて正しく進む・引き返すと出口の周になるか`,!0),"warp.lapHall.chance":H(.55,0,1,`異変の廊下: 周に異変がある確率（間違えた次の周と最初の周は異変なし）`),"warp.lapHall.secretRun":H(3,1,8,`異変の廊下（BX01）: 一度も引き返さずに、異変のある周を何回進むと、異変の部屋の扉が現れるか`,!0),"warp.lapHall.secretWeight":H(1.6,0,5,`異変の廊下（BX01）: 隠しの元の重み`),"warp.stairs.weight":H(.45,0,10,`階段の数: 出やすさ（相対）`),"warp.stairs.goal":H(6,1,20,`階段の数: 何階上ると、同じ踊り場から抜けて上の階へ出られるか`,!0),"warp.stairs.giveUpSec":H(150,30,900,`階段の数: 階段室に入ってからこの秒数で、上の階へ必ず抜けられる`),"warp.recede.weight":H(.45,0,10,`遠ざかる廊下: 出やすさ（相対）`),"warp.recede.periods":H(4,2,8,`遠ざかる廊下: 廊下の長さ（12 m のくり返しの数）`,!0),"warp.recede.startM":H(9,4,20,`遠ざかる廊下: 扉を開けたときに見える突き当たりまでの距離（m）`),"warp.recede.rate":H(.5,0,3,`遠ざかる廊下: 1 m 歩くごとに残りの距離が伸びる量（m。v1 E13 と同じ 0.5）`),"warp.recede.widthM":H(2.4,1.8,3.2,`遠ざかる廊下: 廊下の幅（壁を含む）`),"warp.recede.heightM":H(2.7,2.4,3.2,`遠ざかる廊下: 天井の高さ`),"warp.lookBack.weight":H(.6,0,10,`振り返ると変わる: 出やすさ（相対）`),"warp.lookBack.booths":H(6,3,8,`振り返ると変わる: 壁沿いの小部屋の数（多くて）`,!0),"warp.lookBack.unseenSec":H(.6,.1,5,`振り返ると変わる: 小部屋から目を離してこの秒数で別の場面に変わる`),"warp.fourRights.weight":H(.5,0,10,`4 回曲がっても戻らない: 出やすさ（相対）`),"warp.fourRights.ringM":H(1.5,1.1,2.2,`4 回曲がっても戻らない: 真ん中の塊のまわりの通路の幅（m）`),"warp.fourRights.secretWeight":H(1.5,0,5,`4 回曲がっても戻らない: 隠しの元（1 周回ると現れる扉）の重み`),"warp.cornerSwap.weight":H(.5,0,10,`曲がると変わる景色: 出やすさ（相対）`),"warp.cornerSwap.passageM":H(1.7,1.4,2.4,`曲がると変わる景色: 扉の壁と仕切りの間の通路の幅（m）`),"warp.cornerSwap.gapM":H(1.2,1,1.8,`曲がると変わる景色: 仕切りの端の切れ目の幅（m）`),"warp.cornerSwap.unseenSec":H(.5,.1,5,`曲がると変わる景色: 通路と切れ目が見えなくなってこの秒数で次の部屋に変わる`),"warp.turnRoom.weight":H(.8,0,10,`回転する部屋: 出やすさ（相対。置ける部屋が広い部屋だけなので重め）`),"warp.turnRoom.ringM":H(1.2,1,2,`回転する部屋: 筒の外の通路の幅（m）`),"warp.turnRoom.gapM":H(1.1,.9,1.6,`回転する部屋: 筒の入口の幅（m）`),"warp.turnRoom.periodSec":H(40,15,120,`回転する部屋: 1 回りの秒数`),"warp.turnRoom.secretWeight":H(1.2,0,5,`回転する部屋: 隠しの元（筒を通らないと行けない区切りの壁）の重み`),"warp.turnRoom.drift":H(.12,0,.6,`回転する部屋: 外へ押す強さ（軸から 1 m 離れるごとの m/s）`),"warp.twoDoors.weight":H(.5,0,10,`2 つの扉が同じ部屋へ: 出やすさ（相対）`),"warp.twoDoors.spacingM":H(2.6,2.2,4,`2 つの扉が同じ部屋へ: 並んだ扉の真ん中どうしの間隔（m）`),"warp.twoDoors.depthM":H(4.8,3.6,7,`2 つの扉が同じ部屋へ: 居間の奥行き（扉 A から扉 B まで。m）`),"warp.timedDoors.weight":H(.45,0,10,`時間で入れ替わる扉: 出やすさ（相対）`),"warp.timedDoors.spacingM":H(2,1.8,4,`時間で入れ替わる扉: 並んだ扉の真ん中どうしの間隔（m）`),"warp.timedDoors.periodSec":H(30,8,300,`時間で入れ替わる扉: 2 枚の扉の行き先が入れ替わる間隔（秒）`),"warp.timedDoors.secretWeight":H(1.4,0,5,`時間で入れ替わる扉: 隠しの元（琥珀の部屋の壁）の重み`),"warp.lightFrame.weight":H(.5,0,10,`距離を飛び越える扉: 出やすさ（相対）`),"warp.lightFrame.secretWeight":H(1.5,0,5,`距離を飛び越える扉（BX03）: 隠しの元（枠の裏から入る廊下）の重み`),"warp.pastWindow.weight":H(.5,0,10,`窓の向こうの自分: 出やすさ（相対）`),"warp.pastWindow.delaySec":H(4,1,15,`窓の向こうの自分: 窓の向こうの自分が、何秒前の自分か`),"warp.pastWindow.stillSec":H(18,5,120,`窓の向こうの自分（BX08）: 窓の前で何秒じっとしていると、向こうの自分が壁を叩きに行くか`),"warp.pastWindow.secretWeight":H(1.4,0,5,`窓の向こうの自分（BX08）: 隠しの元（向こうの自分が叩く壁）の重み`),"warp.floorLoop.chance":H(.2,0,1,`前の階に戻る輪: ふつうの出口が前の階（2〜3 階上）へ戻る確率（深さごと。同じ階からは 1 回だけ）`),"warp.floorLoop.minDepth":H(3,2,20,`前の階に戻る輪: この深さより浅い階では戻らない`,!0)},bt={"structure.w.chain":H(1,0,10,`くねる部屋の連なり（F03）`),"structure.w.courtyard":H(1,0,10,`中庭を囲む（F05）`),"structure.w.shortcut":H(1,0,10,`二重ループ・奥から開く近道（F06）`),"structure.w.loops":H(1,0,10,`入れ子のループ（F07）`),"structure.w.concentric":H(1,0,10,`同心円（F11）`),"structure.w.spiral":H(1,0,10,`螺旋（F12）`),"structure.w.skip":H(1,0,10,`スキップフロア（F13）`),"structure.w.gallery":H(1,0,10,`中二階（F14）`),"structure.w.crossing":H(1,0,10,`立体交差（F15）`),"structure.w.islands":H(1,0,10,`島と橋（F16）`),"structure.w.nest":H(1,0,10,`入れ子の部屋（F17）`),"structure.w.megahall":H(1,0,10,`巨大空間の中の建物（F18）`),"structure.w.mirror":H(1,0,10,`鏡写し（F19）`),"structure.w.shrink":H(1,0,10,`縮むくり返し（F20）`),"structure.w.staff":H(1,0,10,`表と裏の動線（F21）`),"structure.w.crawl":H(1,0,10,`天井裏の這う網（F22）`),"structure.w.tower":H(1,0,10,`縦に積んだビル（F23）`),"structure.w.elevator":H(1,0,10,`エレベーターホールの中心（F24）`),"structure.w.descent":H(1,0,10,`下るだけのフロア（F29）`),"structure.w.shaft":H(1,0,10,`吹き抜けの縦穴（F31）`),"structure.w.rooftop":H(1,0,10,`屋上（F33）`),"structure.w.arcade":H(1,0,10,`地下街（F34）`),"structure.w.wings":H(1,0,10,`分棟（F02）`),"structure.storyHeightM":H(4.4,4,6,`階の高さ（床から上の階の床まで。m）。上下に重なる区画の間は、天井 + 床板 + 余裕`),"structure.towerStoriesMin":H(2,2,4,`縦に積んだビル・エレベーターホールの階の数（最小）`,!0),"structure.towerStoriesMax":H(3,2,4,`縦に積んだビル・エレベーターホールの階の数（最大）`,!0),"structure.wellDoorChance":H(.8,0,1,`階段室の出入り口を防火扉にする確率（扉でないときは開口）`),"structure.chain.spacingM":H(8.5,7,12,`くねる部屋の連なり・中庭を囲む部屋の区画の間隔（m）。部屋は区画いっぱいで、隣と壁 1 枚でつながる`),"structure.chain.branchChance":H(.25,0,1,`くねる部屋の連なり: 本道の部屋から、行き止まりの部屋へ枝分かれする確率`),"structure.chain.loopChance":H(.12,0,1,`くねる部屋の連なり: 隣り合う部屋どうしに、もう 1 つ扉を足す確率（回り道）`),"structure.railM":H(1.1,1,1.4,`手すり・胸壁の高さ（m）。跳んだ足の高さ（約 0.9 m）より高く、越えられない`),"structure.walkway.widthM":H(2.2,1.6,3.2,`分棟の渡り廊下の幅（m）`),"structure.bridge.widthM":H(1.7,1.4,2.4,`島と橋の橋の幅（m）`),"structure.outdoor.fogNear":H(3,0,20,`屋外（渡り廊下・屋上）の霧の始まり（m）`),"structure.outdoor.fogFar":H(26,8,80,`屋外（渡り廊下・屋上）の霧の果て（m）`),"structure.concentric.innerWidthM":H(1.5,1.2,2.4,`同心円: いちばん内側の輪の廊下の幅（m）`),"structure.concentric.innerLight":H(.35,.05,1,`同心円: いちばん内側の明るさの倍率（外ほど 1 に近い）`),"structure.skip.spacingM":H(13,11,18,`スキップフロア: 区画の間隔（m。半階の階段が収まるように広め）`),"structure.staff.widthM":H(1.4,1.2,2,`表と裏の動線: 従業員用の通路の幅（m）`),"structure.staff.heightM":H(2.3,2.1,2.6,`表と裏の動線: 従業員用の通路の天井の高さ（m）`),"structure.staff.backDoorChance":H(.5,0,1,`表と裏の動線: 客用の部屋に、裏の通路への扉を付ける確率`),"structure.descent.dropM":H(1.6,1.3,3.2,`下るだけのフロア: 1 回の飛び降りの高さ（m。跳んでも上がれない）`),"structure.descent.spacingM":H(12,10,16,`下るだけのフロア: 区画の間隔（m）`),"structure.maze.extraExits":H(2,0,3,`迷路フロア: 出口の階段の数（本来の出口に足す数。それぞれ行き先が違う）`,!0),"structure.linear.narrowWidthM":H(1.25,1.1,2,`緊張と解放: 狭い通路の幅（m）`),"structure.linear.narrowHeightM":H(2.15,2,2.6,`緊張と解放: 狭い通路の天井の高さ（m）`),"structure.linear.wideHeightM":H(6,4,10,`緊張と解放: 広い空間の天井の高さ（m）`),"structure.arcade.widthM":H(4,3.6,5.5,`地下街: 通路の幅の下限（m。真ん中に柱の列が立つ）`),"structure.arcade.heightM":H(2.75,2.4,3.2,`地下街: 通路の天井の高さの上限（m。広くて低い）`),"structure.nest.depth":H(3,2,4,`入れ子の部屋: 部屋の入れ子の数（いちばん外の部屋を含む）`,!0),"structure.megahall.heightM":H(9,6,14,`巨大空間: 天井の高さ（m）`),"structure.building.heightM":H(2.6,2.4,3.2,`巨大空間の中の建物・屋上の小屋の天井の高さ（m）`),"structure.mirror.diffs":H(1,1,3,`鏡写し: 左右で違う所の数`,!0),"structure.mirror.cleanPairs":H(2,0,4,`鏡写し: 仕掛け・異変を置かず、家具まで鏡に写す対の部屋の数（入口に近い順）`,!0),"structure.shrink.ratio":H(.84,.7,.95,`縮むくり返し: くり返すたびに掛ける大きさの倍率`),"structure.shrink.count":H(5,3,7,`縮むくり返し: くり返しの数`,!0),"structure.shrink.minHeightM":H(1.15,1,1.6,`縮むくり返し: 天井の高さの下限（m。しゃがむ高さ 0.85 m より高く）`),"structure.shrink.lastHeightM":H(1.5,1.15,1.65,`縮むくり返し: 最後の部屋の天井の高さの目安（m。立った高さ 1.7 m より低く、しゃがんで進む）`),"structure.crawl.heightM":H(1,.95,1.3,`天井裏の這う網: 這う通路の天井の高さ（m。立てない）`),"structure.crawl.widthM":H(1.2,1,1.6,`天井裏の這う網: 這う通路の幅（m）`),"structure.crawl.hatches":H(3,2,5,`天井裏の這う網: 天井の点検口（上り下りの梯子段）の数`,!0),"structure.gallery.upperRooms":H(3,1,5,`中二階: 中二階から入る上の階の部屋の数`,!0),"structure.shaft.levels":H(3,1,5,`吹き抜けの縦穴: 上と下に見える、ほかの階の回廊の数（それぞれ）`,!0),"structure.spiral.laps":H(3,2,4,`螺旋: 吹き抜けの周りを回る数`,!0),"structure.spiral.voidM":H(7,5,12,`螺旋: 吹き抜けの一辺（m）`),"structure.elevator.rideSec":H(3.5,1,10,`エレベーター: 乗っている時間（秒）`),"structure.elevator.closeSec":H(1.2,.5,4,`エレベーター: 扉が閉まるまで（秒）`),"structure.station.chance":H(.2,0,1,`駅: 駅の続く線が始まる確率（深さ 1・5・9 … の 4 フロアごとの枠ごと。始まると 2〜3 フロア続けて駅）`),"structure.station.dwellSec":H(4,1,20,`駅: 車両に乗ってから扉が閉まるまで（秒）`),"structure.station.rideSec":H(9,3,30,`駅: 次の駅に着くまで（秒）`),"structure.privateRoom.parts":H(3,2,4,`別室: 1 つの部屋に重ねる異変の数`,!0)},xt={"rooms.chance.room":H(.55,0,1,`普通の部屋（仕掛け・異変の無い部屋）に部屋の形を掛ける確率`),"rooms.chance.hall":H(.6,0,1,`普通の広間に部屋の形を掛ける確率`),"rooms.chance.anomaly":H(.3,0,1,`異変の部屋（中身を置く前の段の無い異変）に、重ねてよい形を掛ける確率`),"rooms.openMul":H(.6,0,1,`入口に扉の無い部屋の確率の倍率（扉を開けた瞬間の驚きを優先する）`),"rooms.repeatMul":H(.3,0,1,`同じフロアに同じ形がすでにあるとき、1 つごとに重みに掛ける倍率`),"rooms.buildTries":H(6,1,12,`選んだ形がその部屋に組めないとき、次の候補を試す数（3 では当たった部屋の 1 割ほどが組めずに普通の部屋のままだった）`,!0),"rooms.maxBoxes":H(900,100,4e3,`1 つの形が区画に足す箱の上限（描画の三角形と焼き込みの時間。中身の家具は別に dress の上限）`,!0),"rooms.maxLights":H(18,4,64,`形を掛けた区画の点光源の上限（元の数より多くはしない。スマホの灯りの予算）`,!0),"rooms.w.pillars":H(1.2,0,10,`S01 柱林`),"rooms.w.grandHall":H(3,0,10,`S02 大広間（広間だけ）`),"rooms.w.tallHall":H(.6,0,10,`S03 縦長ホール`),"rooms.w.ceilingWells":H(.9,0,10,`S05 天井井戸`),"rooms.w.lowRoom":H(.7,0,10,`S10 低すぎる天井（形の id は lowRoom。仕掛けの lowCeiling と分ける）`),"rooms.w.highCeiling":H(.6,0,10,`S11 高すぎる天井`),"rooms.w.waveCeiling":H(.8,0,10,`S30 天井の高さが場所で変わる`),"rooms.w.splitHall":H(1,0,10,`S06 分割ホール`),"rooms.w.bentRoom":H(1.2,0,10,`S07 L 字・コの字・ロの字`),"rooms.w.doubleWall":H(.9,0,10,`S13 二重壁`),"rooms.w.halfBasement":H(.8,0,10,`S16 半地下`),"rooms.w.slantWalls":H(.9,0,10,`S17 斜めの壁`),"rooms.w.windows":H(.9,0,10,`S23 窓だらけ`),"rooms.w.hut":H(.8,0,10,`S21 部屋の中の小屋`),"rooms.w.eelBed":H(3,0,10,`S12 うなぎの寝床（長い区画だけ）`),"rooms.w.endless":H(1,0,10,`S26 果てしない通路（表のフロアだけ）`),"rooms.w.roundRoom":H(1.8,0,10,`S18 円形の部屋（開口が区画の中心線の上にあるとき）`),"rooms.w.centerHole":H(1.8,0,10,`S15 中央の穴`),"rooms.w.pitGallery":H(2,0,10,`S04 穴の回廊`),"rooms.w.grating":H(.7,0,10,`S14 全面グレーチングの床`),"rooms.w.sunkenWater":H(.9,0,10,`S28 水没した下半分`),"rooms.w.terraces":H(2.4,0,10,`S08 段々の部屋`),"rooms.w.theater":H(2.4,0,10,`S09 半円の劇場`),"rooms.w.loft":H(1,0,10,`S20 ロフト付き`),"rooms.w.scaffold":H(2,0,10,`S22 足場の部屋`),"rooms.w.layers":H(1.4,0,10,`S27 一つの部屋が何層も`),"rooms.w.stairsOnly":H(1.8,0,10,`S29 階段だけの部屋`),"rooms.w.atticStair":H(.9,0,10,`S19 天井から下がる階段`),"rooms.w.tilted":H(.9,0,10,`S25 傾いた部屋（開口が 1 本の線の上にあるとき）`),"rooms.tilt.deg":H(6,2,12,`傾いた部屋: 傾き（度）`),"rooms.theater.stageD":H(2,1.4,3.5,`半円の劇場: 舞台の奥行き（m）`),"rooms.theater.stageH":H(.7,.35,1,`半円の劇場: 舞台の高さ（m。前の段 2 段で上がる）`),"rooms.hole.rimM":H(1.25,1.1,2.5,`中央の穴: 縁の幅の下限（m。開口のある壁の側は扉の前を空ける広さ）`),"rooms.hole.depthM":H(2.2,1,3,`中央の穴: 穴の深さ（m。落ちたら壁沿いの段で戻る）`),"rooms.gallery.widthM":H(1.3,1.1,2.5,`穴の回廊: 回廊の幅（m）`),"rooms.gallery.depthM":H(2.6,2,3.05,`穴の回廊: 吹き抜けの深さ（m。下の部屋の高さ。3.1 m 以上は隣の区画の下に入り込みやすい）`),"rooms.grating.depthM":H(2.4,1.2,3.05,`全面グレーチング: 格子の下の空間の深さ（m）`),"rooms.grating.pitchM":H(.12,.06,.4,`全面グレーチング: 格子の棒の間隔（m）`),"rooms.sunken.depthM":H(1.4,.8,2.2,`水没した下半分: 床が下がる深さ（m。水は板の道の 0.15 m 下まで）`),"rooms.sunken.walkM":H(1,.8,1.6,`水没した下半分: 板の道の幅（m）`),"rooms.sunken.slow":H(.45,.2,1,`水没した下半分: 水の中の歩く速さの倍率`),"rooms.terrace.riseM":H(.33,.2,.35,`段々の部屋: 1 段の高さ（m。歩いて上れる 0.35 m 以下）`),"rooms.terrace.treadM":H(.85,.7,1.2,`段々の部屋: 1 段の奥行き（m。座席の列が載る）`),"rooms.terrace.max":H(6,2,10,`段々の部屋: 段の数の上限`,!0),"rooms.eel.widthM":H(1.2,.9,1.8,`うなぎの寝床: 帯の幅（m。壁の内側）`),"rooms.endless.widthMin":H(1.9,1.4,3,`果てしない通路: 通路の幅の下限（m）`),"rooms.endless.widthMax":H(2.4,1.4,3.5,`果てしない通路: 通路の幅の上限（m）`),"rooms.endless.fogMinM":H(7,2,20,`果てしない通路: 霧で何も見えなくなる距離の下限（m）`),"rooms.endless.fogMaxM":H(13,4,40,`果てしない通路: 霧で何も見えなくなる距離の上限（m。通路の長さの 6 割まで）`),"rooms.round.minR":H(2.4,1.8,6,`円形の部屋: 丸の半径の下限（m）`),"rooms.double.gapM":H(.85,.75,1.4,`二重壁: 壁と壁の間の幅（m。体の幅 0.7 m より少し広い）`),"rooms.pillars.sizeMin":H(.45,.3,1.2,`柱林: 柱の太さの下限（m）`),"rooms.pillars.sizeMax":H(.75,.3,1.2,`柱林: 柱の太さの上限（m）`),"rooms.pillars.gapM":H(1.15,1,3,`柱林: 柱と柱の間（m。体の幅 0.7 m より広く）`),"rooms.grand.heightMul":H(1.8,1.2,3,`大広間: 天井の高さの倍率`),"rooms.grand.heightMaxM":H(10,4,20,`大広間: 天井の高さの上限（m）`),"rooms.grand.columnPitchM":H(3.2,2,6,`大広間: 列柱の間隔（m）`),"rooms.grand.chandelier":H(1.4,0,4,`大広間: シャンデリアの明るさ（区画の照明の明るさに掛ける）`),"rooms.tall.heightMinM":H(9,5,20,`縦長ホール: 天井の高さの下限（m）`),"rooms.tall.heightMaxM":H(15,5,30,`縦長ホール: 天井の高さの上限（m）`),"rooms.tall.ratio":H(2.2,1,5,`縦長ホール: 天井の高さ ÷ 部屋の幅（狭い方）`),"rooms.wells.sizeMin":H(1.4,.8,4,`天井井戸: 井戸の一辺の下限（m）`),"rooms.wells.sizeMax":H(2.4,.8,4,`天井井戸: 井戸の一辺の上限（m）`),"rooms.wells.depthMin":H(4,1.5,15,`天井井戸: 井戸の高さ（天井から上）の下限（m）`),"rooms.wells.depthMax":H(9,1.5,15,`天井井戸: 井戸の高さの上限（m）`),"rooms.wells.max":H(4,1,9,`天井井戸: 井戸の数の上限`,!0),"rooms.wells.light":H(1.6,0,5,`天井井戸: 井戸の上の灯りの明るさ（区画の照明の明るさに掛ける）`),"rooms.low.heightM":H(1.6,1.1,2,`低すぎる天井: 天井の高さ（m。プレイヤーは 1.7 m なのでしゃがんで進む）`),"rooms.low.vestibuleM":H(1.4,1.2,2.5,`低すぎる天井: 開口の前の普通の高さの所の奥行き（m）`),"rooms.high.heightM":H(30,8,40,`高すぎる天井: 天井の高さ（m）`),"rooms.high.light":H(3.2,.5,10,`高すぎる天井: 天井の蛍光灯 1 本の点光源の明るさ（区画の照明の明るさに掛ける）`),"rooms.wave.stepM":H(1.1,.6,2.5,`天井の高さが変わる: 高さを変える間隔（m。部屋の奥行きの向き）`),"rooms.wave.lowM":H(1.9,1.75,2.4,`天井の高さが変わる: いちばん低い所（m。しゃがまずに通れる）`),"rooms.wave.highAddM":H(2.6,.5,6,`天井の高さが変わる: いちばん高い所（元の天井から上へ m）`)},St={"map.seen.distM":H(14,4,40,`地図: 開口の向こうの区画を「見た」にする距離（開口まで m）`),"map.seen.coneDeg":H(65,20,180,`地図: 開口が視線からこの角度の中にあれば向こうを見たことにする（度。すぐ近くの開口は向きによらない）`),"map.seen.hops":H(2,1,4,`地図: 扉の無い開口を続けてたどる数（扉の向こうは 1 つだけ）`,!0),"map.seen.doorOpen":H(.25,.02,1,`地図: 扉がこれより開いていれば向こうが見える（開く角度の割合）`),"map.layer.riseM":H(1.8,1,6,`地図: 上下に重なる区画を別の層に分ける高さの差（m。これより小さい段差は同じ層）`),"map.survey.tileM":H(2,1,4,`調査率: 区画の床を分ける升目の大きさ（m）`),"map.survey.radiusM":H(3,1,8,`調査率: 歩いた所からこの距離の升目を調べたことにする（m）`),"map.survey.cellFull":H(.85,.5,1,`調査率: 区画の升目のこの割合を調べると、その区画は調べ終わり（隅まで歩かなくてよい）`),"map.trail.stepM":H(1.2,.4,4,`足跡: 地図に足跡を 1 つ残す間隔（歩いた m）`),"map.trail.max":H(1500,100,6e3,`足跡: 1 フロアに残す足跡の数の上限（古いものから消える）`,!0),"map.save.floors":H(160,1,400,`地図の保存: 覚えておくフロア（果てしない階は区域）の数（古いものから忘れる）`,!0),"map.save.regions":H(150,1,400,`地図の保存: 階の地図（果てしない階）に覚えておく区域の数（古いものから忘れる）`,!0),"map.save.trail":H(600,50,6e3,`地図の保存: 区域・フロアごとに保存する足跡の数（新しいものから）`,!0),"map.story.keep":H(40,2,200,`階の地図: 地図の元を持っておく区域の数（超えたら古い区域から、見た所だけの写しにする）`,!0),"map.save.intervalSec":H(4,1,60,`地図の保存: 歩いている間の保存の間隔（秒）`),"map.erase.all":H(3,0,10,`地図が消える: 今いる部屋のほかを全部消す（重み）`),"map.erase.half":H(2,0,10,`地図が消える: 半分を消す（重み）`),"map.erase.far":H(2,0,10,`地図が消える: 遠くの部屋を消す（重み）`),"map.erase.farM":H(16,4,60,`地図が消える（遠く）: これより遠い区画を消す（m）`),"map.erase.sheets":H(48,8,120,`地図が消える: 壁と床の白紙の数の上限（箱の数）`,!0),"map.rotate.driftDeg":H(20,0,60,`地図が回る: 部屋の中で地図がゆれる幅（度）`),"map.rotate.driftSec":H(24,4,120,`地図が回る: ゆれの周期（秒）`),"map.rotate.easeSec":H(.8,.1,5,`地図が回る: 回り始め・戻りの時間（秒）`),"map.rotate.holdSec":H(30,0,300,`地図が回る: 部屋を出てから地図が戻り始めるまで（秒。出てしばらくは回ったまま）`),"map.guide.chance":H(.85,0,1,`案内図: 入口の部屋に案内図を置く確率`),"map.guide.hops":H(4,1,30,`案内図: 入口から開口をたどる数（これより先の廊下は描かない。フロア全部を描くと探す楽しみが減る）`,!0),"map.guide.lie.secret":H(3,0,10,`案内図の嘘: 隠し部屋の所に部屋を描く（重み。隠しのあるフロアだけ）`),"map.guide.lie.exit":H(1,0,10,`案内図の嘘: 出口の印を別の場所に描く（重み）`),"map.guide.lie.phantom":H(1.5,0,10,`案内図の嘘: 無い廊下を描く（重み）`),"map.guide.lie.missing":H(1.5,0,10,`案内図の嘘: ある廊下を描かない（重み）`),"map.here.chance":H(.55,0,1,`現在地の看板: 1 フロアに置く確率`),"map.here.max":H(2,0,6,`現在地の看板: 1 フロアの数の上限`,!0),"map.here.radiusM":H(16,6,40,`現在地の看板: 看板に描く範囲の半径（m）`),"map.note.chance":H(.45,0,1,`他人の地図: 1 フロアに落ちている確率`),"map.note.coverage":H(.5,.1,1,`他人の地図: 誰かが描いた区画の割合（入口から歩いた範囲）`),"map.note.wrongChance":H(.3,0,1,`他人の地図: 書き込みの 1 つが勘違い（違う所に「出口」）になる確率`),"map.fogTower.fogNearM":H(0,0,5,`霧の中の塔: 霧が掛かり始める距離（m）`),"map.fogTower.fogFarM":H(10,2,20,`霧の中の塔: 何も見えなくなる距離（m。塔の灯りだけは霧を通して見える）`),"map.fogTower.pillarPer10":H(2.2,0,8,`霧の中の塔: 床 10 m² あたり 1 本の背の高い仕切り・柱の数（迷わせる）`),"map.fogTower.awayM":H(9,3,30,`霧の中の塔（出現型の隠し）: 塔からこれより離れて`),"map.fogTower.awaySec":H(8,1,60,`霧の中の塔（出現型の隠し）: 霧の奥にいる秒数`),"map.fogTower.blinkSec":H(1.6,.3,6,`霧の中の塔: 塔の灯りの明滅の周期（秒）`),"map.blank.dwellSec":H(1.5,.3,10,`地図の空白: 空白の壁の前で立ち止まって、壁が扉になるまでの秒数（調べても開く）`)},Ct={"world.slotM":H(64,40,120,`升目の一辺（m）。区域は 1 × 1・2 × 1・1 × 2・2 × 2 升目`,!0),"world.marginM":H(4.5,3,8,`区域の縁の帯（m）。境目の扉までの道を通す`),"world.split.quad":H(50,0,100,`超ブロック（2 × 2 升目）の分け方の重み: 1 × 1 が 4 つ`),"world.split.pair":H(15,0,100,`超ブロックの分け方の重み: 2 × 1 が 2 つ・1 × 2 が 2 つ（合わせて）`),"world.split.mix":H(12,0,100,`超ブロックの分け方の重み: 2 × 1（か 1 × 2）1 つと 1 × 1 が 2 つ（合わせて）`),"world.split.big":H(8,0,100,`超ブロックの分け方の重み: 2 × 2 が 1 つ`),"world.kind.district":H(50,0,100,`区域の種類の重み: 街区（v2 のフロアの型。似た雰囲気が続く）`),"world.kind.patchwork":H(50,0,100,`区域の種類の重み: 寄せ集め（v1 風。部屋ごとに雰囲気と大きさが違う）`),"world.wardSlots":H(3,1,12,`町（似た雰囲気のまとまり）の一辺の升目の数`,!0),"world.wardCoherence":H(.4,0,1,`街区が町の系統を使う確率（残りは区域ごとにばらばら）`),"world.wildcardRoomChance":H(.3,0,1,`街区の部屋が別の系統のテーマになる確率（扉を開けると急に別の施設）`),"world.gate.perEdge":H(3,1,5,`境目の扉の数: 隣の区域と接する升目の辺 1 つあたり（寄せ集めどうし）`,!0),"world.gate.perEdgeDistrict":H(2,1,4,`境目の扉の数: 升目の辺 1 つあたり（どちらかが街区。境目の扉まで廊下を引く）`,!0),"world.gate.cornerM":H(8,3,20,`境目の扉を升目の角からこれ以上離す（m）`),"world.door.moodMats":H(2,1,3,`区域の開口を扉にする雰囲気の違い: 床・壁・天井の材質がこの数以上違えば扉（系統が違えばいつも扉）`,!0),"world.gate.stubWidthM":H(2,1.4,3.2,`区域の部屋から境目の扉までの廊下の幅（m）`),"world.airlock.widthM":H(1.6,1.4,2.4,`階段室の幅（壁を含む。m）`),"world.airlock.closeSec":H(1.5,.5,4,`階段室の扉が閉まるまで（秒）`),"world.connector.lift":H(.4,0,1,`升目ごとの下りが、階段室でなくエレベーターになる確率`),"world.lift.widthM":H(2.4,2,3.2,`エレベーター: かごの外の一辺（壁を含む。m）`),"world.lift.rideSec":H(4,1,15,`エレベーター: 戸が閉まってから着くまで（秒）`),"world.lift.arriveSec":H(1.2,.3,5,`エレベーター: 着いてから戸が開くまで（秒）`),"world.hole.sizeM":H(1.4,1,2.4,`隠しの穴・着く部屋の天井の穴の一辺（m）`),"world.hole.depthM":H(30,12,60,`隠しの穴の縦穴の深さ（m）。底の手前まで移れなければ暗転して移る`),"world.hole.transferM":H(7,2,12,`隠しの穴の床からこの深さまで落ちたら、行き先の階の縦穴へ移る（m）`),"world.hole.shaftM":H(11,6,24,`着く部屋の天井の上の縦穴の高さ（m）。移った所から天井まで shaftM − transferM 落ちる`),"world.landing.sizeM":H(2.2,1.6,3,`着く部屋の天井の穴の一辺（m。沈む床の床板 2 m が通る）`),"world.hole.liftSpeed":H(1,.3,3,`沈む床・着く部屋の床板が下りる速さ（m/s）`),"world.hole.openSizeM":H(1.6,1,3,`床の穴（v1 の Hole）の一辺（m）`),"world.hole.open":H(.7,0,1,`升目ごとに床の穴が 1 つある確率`),"world.hole.open2":H(.25,0,1,`升目ごとに床の穴がもう 1 つある確率`),"world.hole.prepareM":H(14,4,40,`隠しの穴からこの距離に入ったら、行き先の階を裏で作り始める（m）`),"world.hole.holdSec":H(8,0,30,`行き先の階が用意できるまで、暗い縦穴の中で落ち続ける長さの上限（秒）`),"world.hole.darkFarM":H(4,1,12,`縦穴の中の暗さ: 霧で何も見えなくなる距離（m）`),"world.load.gateM":H(32,8,80,`境目の扉からこの距離に入ったら、向こうの区域を読む（m）`),"world.unload.gateM":H(72,20,200,`どの境目の扉からもこれより遠い区域は外す（m）`),"world.maxRegions":H(6,2,16,`同時に持つ区域の数の上限`,!0),"world.cache.regions":H(6,0,32,`外した区域の layout を覚えておく数（行き来で作り直さない）`,!0),"world.prepare.airlockM":H(20,4,60,`下りの階段室の扉からこの距離に入ったら、下の階を裏で作り始める（m）`),"world.build.hops":H(3,1,8,`区画を作る範囲: 今の区画から portal をたどる数`,!0),"world.dispose.hops":H(5,2,12,`区画を捨てる範囲: これより遠い区画は捨てる`,!0),"world.buildMs":H(10,2,40,`1 フレームに区画を作る時間（ms）`),"world.patch.minM":H(3.6,3,6,`寄せ集め: 部屋の短い辺の最小（m）`),"world.patch.hallM":H(18,10,40,`寄せ集め: この大きさを超える部屋は広間（天井が高い）`),"world.patch.keepBig":H(.3,0,1,`寄せ集め: 大きい部屋をそれ以上分けずに残す確率`),"world.patch.corridor":H(.3,0,1,`寄せ集め: 細長い通路の部屋を切り出す確率（分けるごと）`),"world.patch.loops":H(.5,0,1,`寄せ集め: 木のつながりに足す扉の割合（行き止まりばかりにしない）`),"world.patch.deadEndFix":H(.85,0,1,`寄せ集め: 扉が 1 つだけの部屋に、隣の部屋への扉を足す確率`),"world.patch.maxAspect":H(3,1.5,8,`寄せ集め: 部屋の長い辺 / 短い辺の上限（これより細長い部屋はもう一度切る）`),"world.patch.corridorMaxM":H(28,12,64,`寄せ集め: 通路を切り出す矩形の長い辺の上限（m。長い矩形は先に切り分ける）`),"world.patch.shape.straight":H(1,0,10,`寄せ集め: 通路の形の重み: まっすぐ`),"world.patch.shape.bend":H(1.4,0,10,`寄せ集め: 通路の形の重み: L 字の曲がり角`),"world.patch.shape.branch":H(1.2,0,10,`寄せ集め: 通路の形の重み: T 字の分かれ道`),"world.patch.shape.cross":H(.5,0,10,`寄せ集め: 通路の形の重み: 十字路`),"world.patch.dimChance":H(.16,0,1,`寄せ集め: 部屋が暗い（照明 0.3〜0.55 倍）確率`),"world.patch.brightChance":H(.1,0,1,`寄せ集め: 部屋がまぶしい（照明 1.25〜1.6 倍）確率`),"world.patch.tallChance":H(.14,0,1,`寄せ集め: 部屋・広間の天井が 1.5〜3.5 m 高い確率`),"world.patch.lowChance":H(.08,0,1,`寄せ集め: 部屋の天井が低い（2.3〜2.5 m）確率`),"world.patch.openChance":H(.15,0,1,`寄せ集め: 部屋どうしの出入り口を扉でなく開口にする確率`),"world.patch.voidShare":H(.2,0,.5,`寄せ集め: 部屋にせず空けておく部屋の割合（壁の向こうの見えない空き。隠し場所（レア部屋・隠し通路）を置く所）`),"world.patch.voidMinM":H(6,3,10,`寄せ集め: 空ける部屋の短い辺の下限（m。どのレア部屋も入る大きさ。小さい部屋は部屋のまま残す: 小さい部屋向きの異変（物の海など）が出なくなる）`),"world.patch.voidMaxM":H(16,6,40,`寄せ集め: 空ける部屋の長い辺の上限（m）`)},wt={"secrets.perFloorMean":H(1.2,0,10,`1 フロアあたりの隠しの平均（ポアソン分布で引く。0 個のフロアもある）`),"secrets.perFloorMax":H(4,0,16,`1 フロアの隠しの上限`,!0),"secrets.depthGain":H(0,0,1,`深さ 1 階あたり、平均に足す量`),"secrets.rarityBonusLegendary":H(1,0,5,`Legendary 以上のフロアで平均に足す量`),"secrets.nestChance":H(.15,0,1,`隠し先の中に、さらに隠しを仕込む確率`),"secrets.maxNestDepth":H(2,0,4,`入れ子の深さの上限`,!0),"secrets.visibilityCheck":pt(!0,`隠し場所が本道から見えないかを確かめる（時間がかかるなら省いてよい。ユーザー了承済み）`),"secrets.visibilityBudgetMs":H(4,0,200,`1 フロアの視線検査に使える時間（ms）。超えたら残りの検査を省く`),"secrets.visibilitySamples":H(64,1,1024,`本道の上で視線を調べる点の数`,!0),"secrets.mode.present":H(70,0,100,`存在型: 扉や穴は最初からあり、見えにくいだけ`),"secrets.mode.appear":H(30,0,100,`出現型: 条件を満たして初めて道や扉が現れる`),"secrets.dest.rareRoom":H(25,0,100,`行き止まりのレア部屋`),"secrets.dest.passageRare":H(25,0,100,`隠し通路の先にレア部屋`),"secrets.dest.loop":H(30,0,100,`隠し通路がフロアの別の部屋へ抜ける（通り抜け）`),"secrets.dest.floorLink":H(12,0,100,`下のフロア（2 つ先）への穴`),"secrets.dest.bFloor":H(8,0,100,`裏のフロアへの穴`),"secrets.throughMin":H(1,0,4,`隠しが 2 つ以上のフロアで、行き止まりでない隠し（通り抜け・穴）の最低数`,!0),"secrets.passage.widthM":H(1.3,1,2.4,`隠し通路の幅（内側）`),"secrets.passage.maxLenM":H(14,4,30,`隠し通路の長さの上限（1 本の直線）`),"secrets.rare.white":H(14,0,100,`レア部屋: 白い私室（大きすぎる椅子）`),"secrets.rare.theater":H(12,0,100,`レア部屋: 小さな劇場`),"secrets.rare.pool":H(12,0,100,`レア部屋: 水の部屋`),"secrets.rare.gallery":H(12,0,100,`レア部屋: 展示室`),"secrets.rare.library":H(12,0,100,`レア部屋: 書庫`),"secrets.rare.machine":H(10,0,100,`レア部屋: 機械の部屋`),"secrets.rare.play":H(10,0,100,`レア部屋: 遊戯室`),"secrets.rare.garden":H(10,0,100,`レア部屋: 温室`),"secrets.rare.chapel":H(8,0,100,`レア部屋: 長椅子の並ぶ部屋`),"secrets.rare.nook":H(4,0,100,`レア部屋: 灯りの小部屋（ほかの部屋が収まらないときにも使う）`),"floor.sizeM":H(70,30,200,`1 フロアの一辺の目安（m）`),"floor.baySpacingM":H(11,6,24,`区画の間隔（m）。部屋はこの中に収まり、残りが廊下になる [QR は 8]`),"floor.colsMin":H(3,1,12,`区画の格子の列の数（最小）`,!0),"floor.colsMax":H(5,1,12,`区画の格子の列の数（最大）`,!0),"floor.rowsMin":H(3,1,12,`区画の格子の行の数（最小）`,!0),"floor.rowsMax":H(5,1,12,`区画の格子の行の数（最大）`,!0),"floor.loopsPer10":H(2,0,10,`区画 10 個あたりに足すループの数（行き止まりばかりにしない）`),"floor.junctionChance":H(.3,0,1,`部屋の代わりに曲がり角（廊下の交差）にする確率`),"floor.levelHeightM":H(1.6,.6,4,`高さの違う区画の段差（m）。階段でつなぐ`),"floor.genRetries":H(6,1,30,`検証に通らなかったときに作り直す回数`,!0),"floor.roomDoorChance":H(.92,0,1,`部屋（入口・出口の部屋を除く）の出入り口を扉にする確率（扉を開けるまで中が見えない）`),"floor.hallDoorChance":H(.35,0,1,`広間の出入り口を扉にする確率`),"rarity.w.common":H(33,0,100,`Common の重み`),"rarity.w.uncommon":H(24,0,100,`Uncommon の重み`),"rarity.w.rare":H(19,0,100,`Rare の重み`),"rarity.w.epic":H(18,0,100,`Epic の重み`),"rarity.w.legendary":H(4,0,100,`Legendary の重み`),"rarity.w.mythic":H(6.5,0,100,`Mythic の重み`),"tablet.raise.screenCover":H(.92,.7,1,`顔の前に上げたとき（カメラ・写真から移る）、画面が視界の狭い向きを覆う割合（残りに黒い縁が見える。本体は視界を覆ったまま）`),"tablet.travel.raiseSec":H(.55,.1,3,`写真から移る: タブレットを顔の前へ上げる時間（秒）`),"tablet.travel.holdMinSec":H(.8,0,5,`写真から移る: 視界いっぱいの写真を見せる最短の時間（秒。読み込みが早くてもこれだけは見せる）`),"tablet.travel.lowerSec":H(1.6,.2,6,`写真から移る: 着いてからタブレットを手元へ戻す時間（秒。ゆっくり）`),"tablet.travel.viewKeep":H(.4,0,.95,`写真から移る: 下ろし始めから写真の視点（位置・向き・画角）のまま保つ割合。残りで普通の視点へ戻す`),"tablet.travel.fadeOutSec":H(.8,.05,5,`写真から移る: 環境音を絞る時間（秒）`),"tablet.travel.fadeInSec":H(1.8,.05,6,`写真から移る: 着いてから環境音を戻す時間（秒）`),"tablet.travel.stowDelaySec":H(.25,0,3,`写真から移る: 手元へ戻し終えてから、しまうまでの間（秒。しまい方は Tab と同じ）`),"gimmick.chance.main":H(.36,0,1,`本道の上の部屋に仕掛けを置く確率`),"gimmick.chance.side":H(.45,0,1,`脇道の部屋（行き止まり・寄り道）に置く確率`),"gimmick.chance.hall":H(.7,0,1,`広間に置く確率`),"gimmick.chance.corridor":H(.3,0,1,`廊下に置く確率`),"gimmick.physicsMax":H(2,0,10,`1 フロアの物理を使う仕掛けの上限（重さ）`,!0),"gimmick.sameAxisMul":H(.3,0,1,`本道で直前の仕掛けと作用の軸が同じときの重みの倍率`),"gimmick.intenseRunMul":H(.4,0,1,`本道で強い仕掛け（強さ 2 以上）が続くときの重みの倍率`),"gimmick.secretBoost":H(3,1,20,`隠しの数に空きがある間、隠しを差し出す仕掛けの重みに掛ける倍率`),"gimmick.buildTries":H(3,1,8,`選んだ仕掛けがその部屋に組めないとき、次の候補を試す数（大きな仕掛けで部屋を空けない）`,!0),"gimmick.repeatMul":H(.35,0,1,`同じフロアに同じ仕掛けがすでにあるとき、1 つごとに重みに掛ける倍率（同じものが続かないように）`),"gimmick.tilt.slideAt":H(.55,.1,1,`傾く床: 物が滑り出す傾き（最大の傾きに対する割合。摩擦をこの傾きに合わせる）`),"gimmick.tilt.maxDeg":H(24,6,40,`傾く床: 傾きの最大（度）`),"gimmick.tilt.rateDeg":H(4,1,15,`傾く床: 傾く速さ（度/秒。立ち止まらずに渡れば大きくは傾かない）`),"gimmick.tilt.slipDeg":H(13,5,40,`傾く床: この傾きを超えると、乗っている人が低い方へ滑る（度）`),"gimmick.tilt.slipSpeed":H(3.5,.5,8,`傾く床: 最大の傾きで滑る速さ（m/s。歩いて登るのがやっと）`),"gimmick.tilt.trenchM":H(.9,.6,1.6,`傾く床: 開口も隠しも無い壁と板の間の、落ちる溝の幅（m）`),"gimmick.maze.cellM":H(1.8,1.6,2.2,`導く光の迷路: 迷路の 1 マスの大きさ（m）。仕切りは天井まで`),"gimmick.maze.lightSpeed":H(1.2,.4,3,`導く光の迷路: 光が進む速さ（m/s）`),"gimmick.maze.lead":H(2.2,1,6,`導く光の迷路: 光が先を行く距離（道に沿って m）。これより近づくと進む`),"gimmick.maze.waitDist":H(4,2,12,`導く光の迷路: これより遅れる・道から外れると光が待つ（道に沿って m）`),"gimmick.maze.ignoreSec":H(6,1,30,`導く光の迷路（出現型）: 迷路の中で光について行かない（道を外れる・遅れる）まま、行き止まりの扉が現れるまでの秒数`),"gimmick.maze.lightRange":H(4.5,2,10,`導く光の迷路: 光が照らす距離（m。仕切りの向こうへ漏れにくいよう短め）`),"gimmick.belt.speed":H(6.2,5.8,12,`一方通行の歩道: 帯の速さ（m/s）。ダッシュ（5.5）より速いので逆には進めない`),"gimmick.belt.padM":H(1.4,1.2,2,`一方通行の歩道: 乗り換えの床（分かれ目）の幅（m）`),"gimmick.belt.doorPadM":H(1.5,1.3,2.5,`一方通行の歩道: 開口の前の乗り換えの床の奥行き（m。扉を開ける間に帯へ流されない）`),"gimmick.belt.lenM":H(2,1,4,`一方通行の歩道: 帯の長さの目安（m）`),"gimmick.belt.railH":H(1.1,.95,1.6,`一方通行の歩道: 柵の高さ（m）。跳んだ高さ（約 0.9 m）より高く`),"gimmick.belt.blockChance":H(.25,0,.6,`一方通行の歩道: 道順に要らない帯を柵で塞ぐ割合`),"gimmick.belt.fightSec":H(2.5,.5,10,`一方通行の歩道（出現型）: 行き止まりの帯に逆らって歩き続けると扉が現れるまでの秒数`),"gimmick.pit.landingM":H(1.7,1.3,2.5,`穴の部屋: 開口の前の固い床の奥行き（m）`),"gimmick.pit.stairRise":H(.24,.15,.33,`穴の部屋: 戻る階段の 1 段の高さの上限（m）`),"gimmick.pit.stairTread":H(.3,.24,.45,`穴の部屋: 戻る階段の踏み面（m）`),"gimmick.pit.litM":H(3.4,2.6,6,`落ちる穴（14 章）: 穴の側壁のうち部屋の壁の続きの深さ（m。その下は暗い縦穴）`),"gimmick.pit.minGapM":H(5.6,3,9,`落ちる穴: 開口の前の固い床どうしがこれより近ければ、穴の上に低い下がり壁を付ける（m。走って跳んでも届かない間）`),"gimmick.pit.soffitM":H(2.05,1.95,2.4,`落ちる穴: 低い下がり壁の高さ（床から m。跳ぶと頭がつかえて遠くへ跳べない。歩いては通れる）`),"gimmick.pit.catwalkChance":H(.5,0,1,`落ちる穴: 穴の中に下の細い足場（隠しへの道）がある確率`),"gimmick.pit.catwalkDepthM":H(2.4,1.6,3,`落ちる穴: 下の細い足場の深さ（床から m）`),"gimmick.crumble.depthM":H(2.8,2.5,3.05,`崩れる床: 穴の深さ（m。3.1 m 以上にすると隠し部屋が隣の区画の下に入り込む）`),"gimmick.crumble.tileM":H(.9,.6,1.5,`崩れる床: 床板の大きさ（m）`),"gimmick.crumble.gapM":H(.09,.02,.2,`崩れる床: 床板の隙間（下の暗い穴が見える）`),"gimmick.crumble.standSec":H(.3,.1,2,`崩れる床: 道の床板に乗ってから揺れ始めるまで（秒。離れても止まらない。歩いて渡れば 1 枚あたり約 0.33 秒）`),"gimmick.crumble.shakeSec":H(.45,.2,3,`崩れる床: 揺れてから落ちるまで（秒）`),"gimmick.crumble.decoyChance":H(.65,0,1,`崩れる床: 道でない所が、見せかけの床板（ひび。乗るとすぐ抜ける）である確率（残りは抜けている）`),"gimmick.crumble.restChance":H(.5,0,1,`崩れる床: 道の真ん中に一息つける崩れない床板がある確率`),"gimmick.crumble.respawnSec":H(7,2,60,`崩れる床: 落ちた床板が戻るまで（秒。落ちて階段を上るあいだに戻る）`),"gimmick.narrow.depthM":H(2.6,2.1,3.05,`細い道・梁の網: 溝の深さ（m）`),"gimmick.beams.widthM":H(.46,.3,.8,`細い梁の網: 梁の幅（m）`),"gimmick.beams.platformM":H(1,.7,1.6,`細い梁の網: 分かれ目の足場の大きさ（m）`),"gimmick.beams.gapM":H(1.7,1,3,`細い梁の網: 梁の長さの目安（m）`),"gimmick.beams.loopChance":H(.12,0,.5,`細い梁の網: 木の形の網に足す余分な梁の割合（回り道）`),"anomaly.share.main":H(.42,0,1,`本道の扉の向こうの部屋（仕掛けの部屋を含む）のうち、異変の部屋にする割合の目安。空いた部屋の数で確率を割り戻す`),"anomaly.share.side":H(.35,0,1,`脇道の扉の向こうの部屋のうち、異変の部屋にする割合の目安`),"anomaly.chanceMax":H(.9,0,1,`空いた部屋 1 つに異変を掛ける確率の上限`),"anomaly.openMul":H(.25,0,1,`入口に扉の無い部屋・広間の確率の倍率（扉を開けた瞬間の驚きを優先する）`),"anomaly.runChanceMul":H(.6,0,1,`本道で直前の部屋が異変の部屋のときの確率の倍率（間に普通の部屋を挟む）`),"anomaly.intenseAfterMul":H(.25,0,1,`本道で直前の部屋が強い仕掛け・強い異変（強さ 2 以上）のとき、強い異変の重みの倍率`),"anomaly.sameRunMul":H(0,0,1,`本道で直前の部屋と同じ異変の重みの倍率（0 = 続けない）`),"anomaly.repeatMul":H(.3,0,1,`同じフロアに同じ異変がすでにあるとき、1 つごとに重みに掛ける倍率`),"anomaly.w.flood":H(1,0,10,`浸水`),"anomaly.w.giant":H(1,0,10,`巨大な家具`),"anomaly.w.tiny":H(.8,0,10,`小さな家具`),"anomaly.w.multiply":H(1,0,10,`増殖`),"anomaly.w.upsideDown":H(.8,0,10,`逆さま（Uncommon 以上）`),"anomaly.w.stack":H(.8,0,10,`積み上げ`),"anomaly.w.dark":H(1,0,10,`暗闇`),"anomaly.w.fog":H(.9,0,10,`霧`),"anomaly.w.doors":H(.7,0,10,`扉だらけ（Uncommon 以上）`),"anomaly.w.lowGravity":H(.8,0,10,`軽い部屋`),"anomaly.w.ballSea":H(.7,0,10,`物の海（物理を使う）`),"anomaly.w.tint":H(.9,0,10,`色の異変`),"anomaly.w.scatter":H(.9,0,10,`散乱`),"anomaly.w.clocks":H(.5,0,10,`時計だらけ`),"anomaly.flood.depthMin":H(.3,.1,.6,`浸水: 水深の下限（m）`),"anomaly.flood.depthMax":H(.45,.1,.6,`浸水: 水深の上限（m）`),"anomaly.flood.slow":H(.55,.2,1,`浸水: 水の中の歩く速さの倍率`),"anomaly.giant.scaleMin":H(2.5,1.5,4,`巨大な家具: 倍率の下限`),"anomaly.giant.scaleMax":H(3,1.5,4,`巨大な家具: 倍率の上限`),"anomaly.giant.max":H(5,1,12,`巨大な家具: 残す家具の数の上限（残りは片付ける）`,!0),"anomaly.tiny.scale":H(.3,.15,.6,`小さな家具: 倍率`),"anomaly.multiply.pitchMin":H(.75,.6,2,`増殖: 並べる間隔の下限（m）`),"anomaly.multiply.pitchMax":H(.95,.6,2,`増殖: 並べる間隔の上限（m）`),"anomaly.multiply.aisle":H(1.1,.9,3,`増殖: 開口から開口への通路の幅（m）`),"anomaly.multiply.max":H(150,10,400,`増殖: 並べる数の上限（広い部屋は間隔を広げる）`,!0),"anomaly.stack.towers":H(3,1,4,`積み上げ: 塔の数の上限（収まらない家具は片付ける）`,!0),"anomaly.dark.lampIntensity":H(.35,0,2,`暗闇: 遠くの小さな灯りの明るさ`),"anomaly.fog.near":H(0,0,5,`霧: 霧が掛かり始める距離（m。0 で目の前から少しずつ。近くはなんとか見える）`),"anomaly.fog.far":H(11,1,20,`霧: 何も見えなくなる距離（m。4 m で 3 割・7 m で 7 割ほど霞む）`),"anomaly.tint.red":H(1,0,10,`色の異変: 真っ赤な照明の重み`),"anomaly.tint.white":H(1,0,10,`色の異変: 色が抜けた（白い）部屋の重み`),"anomaly.lowGravity.scaleMin":H(.35,.1,1,`軽い部屋: 重さの倍率の下限`),"anomaly.lowGravity.scaleMax":H(.45,.1,1,`軽い部屋: 重さの倍率の上限`),"anomaly.lowGravity.float":H(4,0,12,`軽い部屋: 宙に浮かせる家具の数の上限`,!0),"anomaly.lowGravity.platformMinH":H(3.4,2.5,8,`軽い部屋: 宙の足場を置く天井の高さの下限（m）`),"anomaly.ballSea.max":H(100,10,300,`物の海: 転がる物（剛体）の数の上限`,!0),"anomaly.ballSea.sizeMin":H(.5,.2,.8,`物の海: 玉の直径の下限（m）`),"anomaly.ballSea.sizeMax":H(.65,.2,.8,`物の海: 玉の直径の上限（m）`),"anomaly.ballSea.doorClear":H(1.6,1.2,3,`物の海: 開口の前で玉を置かない奥行き（m）`),"anomaly.scatter.tipChance":H(.6,0,1,`散乱: 家具を倒す確率`),"anomaly.scatter.moveM":H(1.2,0,3,`散乱: 家具をずらす距離の上限（m）`),"anomaly.doors.gap":H(.25,.05,1,`扉だらけ: 扉と扉の間（m）`),"physics.tickHz":H(60,30,120,`シミュレーションの固定 tick`,!0),"physics.maxBodiesDesktop":H(400,0,4e3,`同時に動かす剛体の上限（PC）`,!0),"physics.maxBodiesMobile":H(120,0,2e3,`同時に動かす剛体の上限（スマホ）`,!0),...mt,...ht,...gt,..._t,...vt,...yt,...bt,...xt,...St,...Ct};Object.keys(wt);var Tt={height:1.7,eye:1.6,crouchHeight:.85,crouchEye:.75,crouchSpeed:.5,eyeLerpSec:.15,radius:.35,walk:3,dash:5.5,jump:4.2,gravity:9.8,step:.35,strideWalk:.75,strideDash:1.1,surfaceSnap:.35,surfaceThickness:.6,maxFall:25},Et=Math.PI/180,U=Math.PI*2,W={bobY:.015,bobRoll:.3*Et,bobAttackSec:.2,bobReleaseSec:.3,bobSmoothSec:.05,crouchMul:.6,dashMul:1.4,breathSec:4.5,breathY:.003,breathRollSec:6.3,breathRoll:.1*Et,wobble:.08*Et,wobbleSec:[3.1,1.3,2.3,.9],stillAfterSec:3,stillMul:.3,stillFallSec:1,stillRiseSec:.5,lagSec:.05,zoomDeg:.5,zoomSecMin:7,zoomSecMax:11},Dt={off:{wobble:1,zoom:0},clean:{wobble:1,zoom:0},homeVideo:{wobble:1,zoom:1},tape:{wobble:1.2,zoom:1.2}},Ot=.12,kt=.5,At=class{camera;feel={handheld:.6,lag:!0,preset:`homeVideo`};suppressed=!1;zoom=1;baseFov;hold=null;out={y:0,roll:0,yaw:0,pitch:0,fov:0};dispYaw=0;dispPitch=0;time=0;wasSuppressed=!1;stillScale=1;bobEnv=0;gaitPhase=0;gaitStep=0;bobY=0;bobRoll=0;phase=[0,1,2,3,4].map(()=>Math.random()*U);zoomPeriod=W.zoomSecMin+Math.random()*(W.zoomSecMax-W.zoomSecMin);gravQ=new t;gravTarget=new t;gravKey=``;gravBlend=0;camPrev=new r;tmpQ=new t;tmpV=new r;tmpP=new r;constructor(e){this.camera=e,this.baseFov=e.fov}snap(e){this.dispYaw=e.yaw,this.dispPitch=e.pitch}shiftYaw(e){this.dispYaw+=e}update(e,t){let n=W,r=this.suppressed;if(r||this.wasSuppressed||!this.feel.lag)this.dispYaw=t.yaw,this.dispPitch=t.pitch;else{let r=1-Math.exp(-e/n.lagSec);this.dispYaw+=(t.yaw-this.dispYaw)*r,this.dispPitch+=(t.pitch-this.dispPitch)*r}this.wasSuppressed=r,this.time+=e;let i=this.time,a=r?0:Math.max(0,Math.min(1,this.feel.handheld)),o=Dt[this.feel.preset]??Dt.homeVideo,s=t.stillSec>=n.stillAfterSec?n.stillMul:1,c=(1-n.stillMul)/(s<this.stillScale?n.stillFallSec:n.stillRiseSec);this.stillScale=jt(this.stillScale,s,c*e);let l=t.onGround&&t.moveRank!==`still`,u=0;if(l){let r=t.moveRank===`dash`?Tt.strideDash:Tt.strideWalk;this.gaitPhase=t.strideAcc/r,this.gaitStep=t.strideCount,u=t.horizontalSpeed/r,this.bobEnv+=(1-this.bobEnv)*Math.min(1,e/n.bobAttackSec)}else this.bobEnv-=this.bobEnv*Math.min(1,e/n.bobReleaseSec);let d=(t.crouching?n.crouchMul:1)*(l&&t.moveRank===`dash`?n.dashMul:1),f=a*this.bobEnv*d*this.stillScale,p=Math.min(1,e/n.bobSmoothSec),m=Math.min(2.5,Math.sqrt(1+(U*u*n.bobSmoothSec)**2)),h=Math.min(2.5,Math.sqrt(1+(Math.PI*u*n.bobSmoothSec)**2));this.bobY+=(-n.bobY*m*f*Math.cos(U*this.gaitPhase)-this.bobY)*p,this.bobRoll+=(n.bobRoll*h*f*Math.sin(Math.PI*(this.gaitStep+this.gaitPhase))-this.bobRoll)*p;let g=a*(t.crouching?n.crouchMul:1),_=n.breathY*g*Math.sin(U*i/n.breathSec),v=n.breathRoll*g*Math.sin(U*i/n.breathRollSec+this.phase[4]),y=this.phase,b=n.wobble*a*o.wobble*this.stillScale,x=b*(.6*Math.sin(U*i/n.wobbleSec[0]+y[0])+.4*Math.sin(U*i/n.wobbleSec[1]+y[1])),S=b*(.6*Math.sin(U*i/n.wobbleSec[2]+y[2])+.4*Math.sin(U*i/n.wobbleSec[3]+y[3])),C=n.zoomDeg*a*o.zoom,w=C>0?C*Math.sin(U*i/this.zoomPeriod+y[0]):0,T=this.out;T.y=this.bobY+_,T.roll=this.bobRoll+v,T.yaw=this.dispYaw+x,T.pitch=this.dispPitch+S,T.fov=w,this.camera.position.set(t.pos[0],t.pos[1]+t.eye+(r?0:T.y),t.pos[2]),r?this.camera.rotation.set(t.pitch,t.yaw,0,`YXZ`):this.camera.rotation.set(T.pitch,T.yaw,T.roll,`YXZ`),this.applyGravity(e,t,r?0:T.y);let E=this.baseFov+(r?0:T.fov),D=this.zoom===1?E:2*Math.atan(Math.tan(E*Math.PI/360)/Math.max(1,this.zoom))*180/Math.PI,O=this.hold;if(O&&O.k>0){let e=Math.min(1,O.k);this.camera.position.lerp(O.pos,e),this.camera.quaternion.slerp(O.quat,e),D+=(O.fov-D)*e}Math.abs(D-this.camera.fov)>1e-6&&(this.camera.fov=D,this.camera.updateProjectionMatrix())}applyGravity(e,t,n){let r=t.grav??null,i=r?`${r.axis}${r.k}`:``;if(i!==this.gravKey&&(this.gravKey=i,r?this.gravTarget.setFromAxisAngle(this.tmpV.set(+(r.axis===`x`),0,+(r.axis===`z`)),r.k*Math.PI/2):this.gravTarget.identity(),this.gravBlend=kt),!(this.gravBlend>0||this.gravQ.angleTo(this.gravTarget)>1e-4)&&!r){this.camPrev.copy(this.camera.position);return}this.gravQ.slerp(this.gravTarget,1-Math.exp(-e/Ot)),this.gravQ.angleTo(this.gravTarget)<.001&&this.gravQ.copy(this.gravTarget),this.tmpQ.setFromEuler(this.camera.rotation),this.camera.quaternion.copy(this.gravQ).multiply(this.tmpQ),this.tmpV.set(0,t.eye+n,0).applyQuaternion(this.gravQ).add(this.tmpP.set(t.pos[0],t.pos[1],t.pos[2])),this.gravBlend>0?(this.gravBlend=Math.max(0,this.gravBlend-e),this.camera.position.copy(this.camPrev).lerp(this.tmpV,1-Math.exp(-e/.07))):this.camera.position.copy(this.tmpV),this.camPrev.copy(this.camera.position)}};function jt(e,t,n){return e<t?Math.min(t,e+n):e>t?Math.max(t,e-n):e}var G=[`off`,`clean`,`homeVideo`,`tape`];function Mt(e){return e===`off`||e===`clean`||e===`homeVideo`||e===`tape`}var Nt=new Set;function Pt(){let e=[];for(let t of Nt){if(!t.parent){Nt.delete(t);continue}t.visible&&(t.visible=!1,e.push(t))}return()=>{for(let t of e)t.visible=!0}}var K=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,Ft=`
  float lensLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`,It={name:`LensDownsampleShader`,uniforms:{tDiffuse:{value:null},texel:{value:new E(1,1)}},vertexShader:K,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel)
             + texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel);
      // HDR の外れ値（NaN / 極端な値）が平均を壊さないように上限を置く
      gl_FragColor = vec4(min(c.rgb * 0.25, vec3(64.0)), 1.0);
    }`},Lt={name:`LensBrightShader`,uniforms:{tDiffuse:{value:null},texel:{value:new E(1,1)},threshold:{value:1},knee:{value:.4}},vertexShader:K,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float threshold;
    uniform float knee;
    varying vec2 vUv;
    ${Ft}
    void main() {
      vec3 c = (texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel).rgb
              + texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel).rgb) * 0.25;
      float l = lensLum(c);
      // 極端な明部（鏡面の峰・至近の光源）は輝度 3 から上を 6 へ頭打ちにしてから抽出する（にじみの面積が明るさに比例して際限なく広がらない）
      if (l > 3.0) { float lc = 3.0 + (l - 3.0) / (1.0 + (l - 3.0) / 3.0); c *= lc / l; l = lc; }
      float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
      soft = soft * soft / (4.0 * knee + 1e-4);
      float pass = max(soft, l - threshold);
      gl_FragColor = vec4(c * (pass / max(l, 1e-4)), 1.0);
    }`},Rt={name:`LensBlurShader`,uniforms:{tDiffuse:{value:null},texel:{value:new E(1,1)},direction:{value:new E(1,0)},spread:{value:1.5}},vertexShader:K,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform vec2 direction;
    uniform float spread;
    varying vec2 vUv;
    void main() {
      vec2 step = direction * texel * spread;
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      c += (texture2D(tDiffuse, vUv + step * 1.3846153846).rgb + texture2D(tDiffuse, vUv - step * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(tDiffuse, vUv + step * 3.2307692308).rgb + texture2D(tDiffuse, vUv - step * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }`},zt={name:`LensFlareShader`,uniforms:{tDiffuse:{value:null},texel:{value:new E(1,1)},aspect:{value:16/9},streakStep:{value:5}},vertexShader:K,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 texel;
    uniform float aspect;
    uniform float streakStep;
    varying vec2 vUv;
    const float STREAK_GAIN = 1.2;
    vec3 ghost(vec2 uv, float scale, vec3 tint, float weight) {
      vec2 g = 0.5 - (uv - 0.5) * scale;
      float m = 1.0 - smoothstep(0.30, 0.48, length(g - 0.5));
      return max(texture2D(tDiffuse, g).rgb - 0.05, vec3(0.0)) * (m * weight) * tint;
    }
    void main() {
      vec3 streak = vec3(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = 1.0 / (1.0 + abs(fi) * 0.7);
        vec3 s = texture2D(tDiffuse, vUv + vec2(fi * streakStep * texel.x, 0.0)).rgb;
        streak += max(s - vec3(0.05), vec3(0.0)) * w;
        wsum += w;
      }
      streak *= vec3(0.85, 0.95, 1.10) * (STREAK_GAIN / wsum);
      vec3 g = ghost(vUv, 1.8, vec3(0.70, 0.85, 1.20), 0.30) + ghost(vUv, 3.2, vec3(1.10, 0.90, 0.70), 0.20);
      gl_FragColor = vec4(streak + g, 1.0);
    }`},Bt={name:`LensStatShader`,uniforms:{tDiffuse:{value:null},cell:{value:new E(1/32,1/18)}},vertexShader:K,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 cell;
    varying vec2 vUv;
    ${Ft}
    void main() {
      vec3 sum = vec3(0.0);
      float lsum = 0.0;
      for (int j = 0; j < 4; j++) {
        for (int i = 0; i < 4; i++) {
          vec2 o = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;
          vec3 c = texture2D(tDiffuse, vUv + o * cell).rgb;
          sum += c;
          lsum += log2(max(lensLum(c), 1e-4));
        }
      }
      gl_FragColor = vec4(sum / 16.0, lsum / 16.0);
    }`},Vt={name:`LensReduceShader`,uniforms:{tStat:{value:null},tDepth:{value:null},statTexel:{value:new E(1/32,1/18)},depthMode:{value:0},cameraNear:{value:.05},cameraFar:{value:100}},vertexShader:K,fragmentShader:`
    uniform sampler2D tStat;
    uniform sampler2D tDepth;
    uniform vec2 statTexel;
    uniform int depthMode;
    uniform float cameraNear;
    uniform float cameraFar;
    float depthToDist(float d) { return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear)); }
    void main() {
      if (gl_FragCoord.x < 1.0) {
        vec4 acc = vec4(0.0);
        for (int j = 0; j < 9; j++) {
          for (int i = 0; i < 16; i++) {
            acc += texture2D(tStat, (vec2(float(i), float(j)) * 2.0 + 1.0) * statTexel);
          }
        }
        gl_FragColor = acc / 144.0;
      } else {
        float dmin = 1e4;
        float dsum = 0.0;
        if (depthMode > 0) {
          const vec2 taps[5] = vec2[5](vec2(0.0, 0.0), vec2(0.012, 0.0), vec2(-0.012, 0.0), vec2(0.0, 0.02), vec2(0.0, -0.02));
          for (int i = 0; i < 5; i++) {
            float dist = depthToDist(texture2D(tDepth, vec2(0.5) + taps[i]).x);
            dmin = min(dmin, dist);
            dsum += dist;
          }
          dsum /= 5.0;
        } else {
          dsum = 1e4;
        }
        gl_FragColor = vec4(dmin, dsum, 0.0, 1.0);
      }
    }`},Ht={name:`LensCompositeShader`,uniforms:{tDiffuse:{value:null},tGlow:{value:null},tFlare:{value:null},tDepth:{value:null},resolution:{value:new E(1,1)},aspect:{value:16/9},distortion:{value:0},distScale:{value:1},chromaK:{value:0},vignette:{value:0},blurOn:{value:0},blurA:{value:new E(0,0)},blurB:{value:new E(0,0)},blurDirA:{value:new E(1,0)},blurDirB:{value:new E(0,1)},dofAmount:{value:0},dofFocus:{value:1},dofMaxPx:{value:3},glow:{value:0},halation:{value:0},flare:{value:0},haze:{value:0},hazeLevel:{value:.5},hazeClamp:{value:40},cameraNear:{value:.05},cameraFar:{value:100},depthMode:{value:0},gain:{value:new r(1,1,1)}},vertexShader:K,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tGlow;
    uniform sampler2D tFlare;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float aspect;
    uniform float distortion;
    uniform float distScale;
    uniform float chromaK;
    uniform float vignette;
    uniform float blurOn;
    uniform vec2 blurA;
    uniform vec2 blurB;
    uniform vec2 blurDirA;
    uniform vec2 blurDirB;
    uniform float dofAmount;
    uniform float dofFocus;
    uniform float dofMaxPx;
    uniform float glow;
    uniform float halation;
    uniform float flare;
    uniform float haze;
    uniform float hazeLevel;
    uniform float hazeClamp;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform int depthMode;
    uniform vec3 gain;
    varying vec2 vUv;
    ${Ft}
    float depthToDist(float d) { return (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear)); }

    // 2 重リング（内 0.55 × 4、外 1.0 × 4）+ 中心。重みは中心 0.2 / 内 0.125 / 外 0.075（合計 1）
    const vec2 DISK[8] = vec2[8](
      vec2(0.55, 0.0), vec2(0.0, 0.55), vec2(-0.55, 0.0), vec2(0.0, -0.55),
      vec2(0.7071, 0.7071), vec2(-0.7071, 0.7071), vec2(-0.7071, -0.7071), vec2(0.7071, -0.7071));
    const float DISK_W[8] = float[8](0.125, 0.125, 0.125, 0.125, 0.075, 0.075, 0.075, 0.075);
    // ハレーションの暖色（輝度 1 に正規化した橙）
    const vec3 HALATION_TINT = vec3(1.45, 0.90, 0.50);

    void main() {
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r2 = dot(p, p);
      vec2 src = uv;
      if (distortion > 0.0) {
        // 樽型: 出力の半径が大きいほど外側を読む。distScale（= 1 / (1 + k1 rc²)）で四隅がちょうど元画像の隅に載る
        src = (p * (1.0 + distortion * r2) * distScale) / vec2(aspect, 1.0) + 0.5;
      }

      bool hasDepth = depthMode > 0;
      float dist = 0.0;
      if (hasDepth) dist = depthToDist(texture2D(tDepth, src).x);

      vec4 c0 = texture2D(tDiffuse, src);
      vec3 col = c0.rgb;
      if (blurOn > 0.5) {
        vec2 a = blurA;
        vec2 b = blurB;
        if (dofAmount > 0.0 && hasDepth) {
          float coc = dofAmount * dofMaxPx * smoothstep(dofFocus * 1.3, dofFocus * 4.0, dist);
          a += blurDirA * coc;
          b += blurDirB * coc;
        }
        vec2 texel = 1.0 / resolution;
        float R = max(length(a), length(b));
        if (R > 0.05) {
          if (R < 1.25) {
            vec2 d1 = (a + b) * texel;
            vec2 d2 = (a - b) * texel;
            col = 0.25 * (texture2D(tDiffuse, src + d1).rgb + texture2D(tDiffuse, src - d1).rgb
                        + texture2D(tDiffuse, src + d2).rgb + texture2D(tDiffuse, src - d2).rgb);
          } else {
            col *= 0.2;
            for (int i = 0; i < 8; i++) {
              vec2 o = (DISK[i].x * a + DISK[i].y * b) * texel;
              col += texture2D(tDiffuse, src + o).rgb * DISK_W[i];
            }
          }
        }
      }

      if (chromaK > 0.0) {
        vec2 off = (src - 0.5) * chromaK;
        col.r += texture2D(tDiffuse, src + off).r - c0.r;
        col.b += texture2D(tDiffuse, src - off).b - c0.b;
        col = max(col, vec3(0.0));
      }

      if (haze > 0.0 && hasDepth) {
        float h = haze * min(dist, hazeClamp) * 0.05;
        float l = lensLum(col);
        col = mix(col, vec3(l), min(1.0, h * 1.5));
        col = mix(col, vec3(hazeLevel), h);
      }

      if (glow > 0.0) {
        vec3 g = texture2D(tGlow, src).rgb;
        vec3 warm = lensLum(g) * HALATION_TINT;
        col += glow * mix(g, warm, halation);
      }
      if (flare > 0.0) col += flare * texture2D(tFlare, src).rgb;

      col *= gain;

      if (vignette > 0.0) {
        // 楕円（画面の縦横比に沿う）。四隅で vignette、辺の中央で約 0.4 倍
        vec2 q = (uv - 0.5) * 2.0;
        float rr = dot(q, q) * 0.5;
        col *= 1.0 - vignette * smoothstep(0.1, 1.0, rr);
      }

      gl_FragColor = vec4(max(col, vec3(0.0)), c0.a);
    }`},Ut={off:{distortion:0,chroma:0,vignette:0,softFocus:0,glow:0,halation:0,flare:0,dof:0,focusHunt:0,haze:0,flicker:0,motionBlur:0,autoExposure:0,autoWhiteBalance:0},clean:{distortion:0,chroma:0,vignette:0,softFocus:0,glow:0,halation:0,flare:0,dof:0,focusHunt:0,haze:.015,flicker:0,motionBlur:0,autoExposure:1,autoWhiteBalance:1},homeVideo:{distortion:.03,chroma:.7,vignette:.12,softFocus:.6,glow:.42,halation:.6,flare:.3,dof:.6,focusHunt:.6,haze:.025,flicker:.01,motionBlur:.5,autoExposure:1,autoWhiteBalance:1},tape:{distortion:.04,chroma:.7,vignette:.1,softFocus:.7,glow:.45,halation:.8,flare:.3,dof:.6,focusHunt:.8,haze:.025,flicker:.015,motionBlur:.6,autoExposure:1,autoWhiteBalance:1}},q={EXPOSURE_KEY:.032,EXPOSURE_ADAPT:.3,EXPOSURE_TAU:1.7,GAIN_MIN:.6,GAIN_MAX:1.2,WB_LIMIT:.08,WB_ADAPT:.6,WB_TAU:3,STAT_INTERVAL:4,GLOW_THRESHOLD:.8,GLOW_KNEE:.5,GLOW_SPREAD:1.5,FLARE_STEP:3,DOF_NEAR:.9,DOF_MAX_PX:3,DOF_TAU:.25,DOF_JUMP:.2,DOF_BLOCK_SEC:.35,DOF_TURN_RATE:.5,HUNT_SEC:.3,HUNT_PX:2.5,HAZE_DIST:20,HAZE_CLAMP_MAX:40,SHUTTER_SEC:1/60,MOTION_MAX_PX:24,MOTION_TAU:.06,DEPTH_SCALE:.5},Wt=32,Gt=18,Kt=new E;function qt(e){let t=Math.sin(e*12.9898)*43758.5453;return t-Math.floor(t)}var Jt=class extends Le{params={...Ut.off};exposureGain=1;luminance=0;whiteBalance=new r(1,1,1);centerDistance=1/0;statReads=0;statErrors=0;material;downMat;brightMat;blurMat;flareMat;statMat;reduceMat;depthMat;fsQuad;rtQuarter;rtEighthA;rtEighthB;rtFlare;rtStat;rtReduce=null;rtDepth=null;reduceIsFloat=!0;readBuf=new Float32Array(8);width=1;height=1;externalDepth=null;time=0;frame=0;yawRate=0;pitchRate=0;motionPx=new E;huntT=-1;logGain=0;flickPhase=0;meanColor=new r(0,0,0);statValid=!1;readPending=!1;disposed=!1;centerRaw=1/0;dofBlock=0;dofAmount=0;dofFocus=1;depthReady=!1;scene;camera;constructor(e,t){super(),this.scene=e,this.camera=t;let n=e=>new u({name:e.name,uniforms:c.clone(e.uniforms),vertexShader:e.vertexShader,fragmentShader:e.fragmentShader,depthTest:!1,depthWrite:!1,blending:0});this.material=n(Ht),this.downMat=n(It),this.brightMat=n(Lt),this.blurMat=n(Rt),this.flareMat=n(zt),this.statMat=n(Bt),this.reduceMat=n(Vt),this.fsQuad=new P(this.material),this.depthMat=new te({depthPacking:O,side:2}),this.depthMat.colorWrite=!1,this.depthMat.blending=0;let r=e=>{let t=new h(1,1,{type:p,minFilter:b,magFilter:b,depthBuffer:!1,stencilBuffer:!1});return t.texture.name=e,t};this.rtQuarter=r(`LensPass.quarter`),this.rtEighthA=r(`LensPass.eighthA`),this.rtEighthB=r(`LensPass.eighthB`),this.rtFlare=r(`LensPass.flare`),this.rtStat=new h(Wt,Gt,{type:p,minFilter:b,magFilter:b,depthBuffer:!1,stencilBuffer:!1}),this.rtStat.texture.name=`LensPass.stat`,this.material.uniforms.tGlow.value=this.rtEighthA.texture,this.material.uniforms.tFlare.value=this.rtFlare.texture,this.statMat.uniforms.cell.value.set(1/Wt,1/Gt),this.reduceMat.uniforms.statTexel.value.set(1/Wt,1/Gt),this.reduceMat.uniforms.tStat.value=this.rtStat.texture}applyPreset(e){Object.assign(this.params,Ut[e])}setDepthTexture(e){this.externalDepth=e}setCameraMotion(e,t){this.yawRate=Number.isFinite(e)?e:0,this.pitchRate=Number.isFinite(t)?t:0}notifyRoomEnter(){this.huntT=0,this.dofBlock=Math.max(this.dofBlock,q.DOF_BLOCK_SEC)}setSize(e,t){this.width=Math.max(1,Math.floor(e)),this.height=Math.max(1,Math.floor(t));let n=e=>Math.max(1,Math.round(e));this.rtQuarter.setSize(n(this.width/4),n(this.height/4)),this.rtEighthA.setSize(n(this.width/8),n(this.height/8)),this.rtEighthB.setSize(n(this.width/8),n(this.height/8)),this.rtFlare.setSize(n(this.width/8),n(this.height/8)),this.rtDepth&&this.rtDepth.setSize(n(this.width*q.DEPTH_SCALE),n(this.height*q.DEPTH_SCALE)),this.material.uniforms.resolution.value.set(this.width,this.height),this.material.uniforms.aspect.value=this.width/this.height,this.flareMat.uniforms.aspect.value=this.width/this.height}update(e,t){e=Math.max(0,Math.min(.1,e)),this.time+=e,this.frame=t;let n=this.params,r=this.material.uniforms,i=q,a=this.height/1080,o=this.width/this.height,s=Math.max(0,n.distortion);r.distortion.value=s,r.distScale.value=1/(1+s*(o*o+1)*.25);let c=Math.max(0,n.chroma)*a;r.chromaK.value=c>0?c*2/Math.hypot(this.width,this.height):0,r.vignette.value=Math.max(0,n.vignette);let l=0;this.huntT>=0&&(this.huntT+=e,this.huntT>=i.HUNT_SEC||n.focusHunt<=0?this.huntT=-1:l=n.focusHunt*i.HUNT_PX*a*Math.abs(Math.sin(2*Math.PI*this.huntT/i.HUNT_SEC))*(1-this.huntT/i.HUNT_SEC));let u=.5*this.height/Math.tan(g.degToRad(this.camera.fov)*.5),d=1-Math.exp(-e/i.MOTION_TAU);this.motionPx.x+=(this.yawRate*i.SHUTTER_SEC*u-this.motionPx.x)*d,this.motionPx.y+=(this.pitchRate*i.SHUTTER_SEC*u-this.motionPx.y)*d;let f=n.motionBlur>0?Math.min(i.MOTION_MAX_PX*a,this.motionPx.length()*n.motionBlur):0;f<.4*a&&(f=0);let p=Kt.copy(this.motionPx);f>0&&p.lengthSq()>1e-8?p.normalize():p.set(1,0);let m=Math.max(0,n.softFocus)*a+l;r.blurDirA.value.copy(p),r.blurDirB.value.set(-p.y,p.x),r.blurA.value.copy(p).multiplyScalar(m+f*.5),r.blurB.value.set(-p.y,p.x).multiplyScalar(m),this.dofBlock=Math.max(0,this.dofBlock-e);let h=Math.abs(this.yawRate)+Math.abs(this.pitchRate)>i.DOF_TURN_RATE,_=n.dof>0&&this.depthReady&&this.centerRaw<i.DOF_NEAR&&this.dofBlock<=0&&!h?Math.min(1,n.dof):0;this.dofAmount+=(_-this.dofAmount)*(1-Math.exp(-e/i.DOF_TAU)),_>0&&(this.dofFocus+=(this.centerRaw-this.dofFocus)*(1-Math.exp(-e/.15))),this.dofAmount<.01&&(this.dofAmount=0),r.dofAmount.value=this.dofAmount,r.dofFocus.value=Math.max(.1,this.dofFocus),r.dofMaxPx.value=i.DOF_MAX_PX*a,r.blurOn.value=+(m>.01||f>0||this.dofAmount>0),r.glow.value=Math.max(0,n.glow),r.halation.value=g.clamp(n.halation,0,1),r.flare.value=Math.max(0,n.flare),r.haze.value=Math.max(0,n.haze);let v=this.scene.fog,y=v&&v.isFog?v.far:i.HAZE_CLAMP_MAX;r.hazeClamp.value=Math.max(1,Math.min(y,i.HAZE_CLAMP_MAX)),r.hazeLevel.value=this.statValid?g.clamp(this.luminance*4,.02,.8):.4;let b=1-Math.exp(-e/i.EXPOSURE_TAU),x=0;if(n.autoExposure>0&&this.statValid&&this.luminance>0){let e=g.clamp((i.EXPOSURE_KEY/this.luminance)**+i.EXPOSURE_ADAPT,i.GAIN_MIN,i.GAIN_MAX);x=Math.log(e)*Math.min(1,n.autoExposure)}this.logGain+=(x-this.logGain)*b,this.exposureGain=Math.exp(this.logGain);let S=1-Math.exp(-e/i.WB_TAU),C=1,w=1,T=1;if(n.autoWhiteBalance>0&&this.statValid){let e=this.meanColor,t=.2126*e.x+.7152*e.y+.0722*e.z;if(t>1e-5){let r=e=>(t/Math.max(e,1e-5))**+i.WB_ADAPT,a=r(e.x),o=r(e.y),s=r(e.z),c=.2126*a+.7152*o+.0722*s,l=e=>g.clamp(e/c,1-i.WB_LIMIT,1+i.WB_LIMIT);a=l(a),o=l(o),s=l(s);let u=Math.min(1,n.autoWhiteBalance);C=1+(a-1)*u,w=1+(o-1)*u,T=1+(s-1)*u}}let E=this.whiteBalance;E.x+=(C-E.x)*S,E.y+=(w-E.y)*S,E.z+=(T-E.z)*S;let D=1;if(n.flicker>0){this.flickPhase+=(qt(t*.618+.13)-.5)*1.2;let e=Math.sin(2*Math.PI*60*this.time+this.flickPhase);D=1+n.flicker*(.7*e+.6*(qt(t*1.37+7.31)-.5))}r.gain.value.set(this.exposureGain*D*E.x,this.exposureGain*D*E.y,this.exposureGain*D*E.z),r.cameraNear.value=this.camera.near,r.cameraFar.value=this.camera.far}render(e,t,n){let r=this.params,i=q,a=r.dof>0||r.haze>0,o=r.glow>0||r.flare>0,s=r.autoExposure>0||r.autoWhiteBalance>0||r.haze>0||r.dof>0,c=e.autoClear;e.autoClear=!1;let l=this.externalDepth;if(!l&&a&&(l=this.renderOwnDepth(e)),this.depthReady=l!==null,this.material.uniforms.tDepth.value=l,this.material.uniforms.depthMode.value=+!!l,(o||s)&&(this.downMat.uniforms.tDiffuse.value=n.texture,this.downMat.uniforms.texel.value.set(1/this.width,1/this.height),this.draw(e,this.downMat,this.rtQuarter)),o){let t=this.rtQuarter.width,n=this.rtQuarter.height,a=this.rtEighthA.width,o=this.rtEighthA.height;this.brightMat.uniforms.tDiffuse.value=this.rtQuarter.texture,this.brightMat.uniforms.texel.value.set(1/t,1/n),this.brightMat.uniforms.threshold.value=i.GLOW_THRESHOLD,this.brightMat.uniforms.knee.value=i.GLOW_KNEE,this.draw(e,this.brightMat,this.rtEighthA),this.blurMat.uniforms.texel.value.set(1/a,1/o),this.blurMat.uniforms.spread.value=i.GLOW_SPREAD;for(let t=0;t<2;t++)this.blurMat.uniforms.tDiffuse.value=this.rtEighthA.texture,this.blurMat.uniforms.direction.value.set(1,0),this.draw(e,this.blurMat,this.rtEighthB),this.blurMat.uniforms.tDiffuse.value=this.rtEighthB.texture,this.blurMat.uniforms.direction.value.set(0,1),this.draw(e,this.blurMat,this.rtEighthA),t===0&&r.flare>0&&(this.flareMat.uniforms.tDiffuse.value=this.rtEighthA.texture,this.flareMat.uniforms.texel.value.set(1/a,1/o),this.flareMat.uniforms.streakStep.value=i.FLARE_STEP,this.draw(e,this.flareMat,this.rtFlare))}if(s&&!this.readPending&&this.statErrors<3&&this.frame%i.STAT_INTERVAL===0){let t=this.ensureReduceTarget(e);this.statMat.uniforms.tDiffuse.value=this.rtQuarter.texture,this.draw(e,this.statMat,this.rtStat);let n=this.reduceMat.uniforms;n.tDepth.value=l,n.depthMode.value=+!!l,n.cameraNear.value=this.camera.near,n.cameraFar.value=this.camera.far,this.draw(e,this.reduceMat,t),this.readPending=!0,e.readRenderTargetPixelsAsync(t,0,0,2,1,this.readBuf).then(e=>{this.readPending=!1,this.disposed||this.onStats(e)},e=>{this.readPending=!1,this.statErrors++,this.statErrors===1&&console.warn(`[LensPass] 統計の読み戻しに失敗（露出 / WB の追従を止める）`,e)})}this.material.uniforms.tDiffuse.value=n.texture,this.fsQuad.material=this.material,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear()),this.fsQuad.render(e),e.autoClear=c}ensureReduceTarget(t){if(this.rtReduce)return this.rtReduce;this.reduceIsFloat=t.extensions.has(`EXT_color_buffer_float`),this.readBuf=this.reduceIsFloat?new Float32Array(8):new Uint16Array(8);let n=new h(2,1,{type:this.reduceIsFloat?e:p,minFilter:x,magFilter:x,depthBuffer:!1,stencilBuffer:!1});return n.texture.name=`LensPass.reduce`,this.rtReduce=n,n}draw(e,t,n){this.fsQuad.material=t,e.setRenderTarget(n),this.fsQuad.render(e)}renderOwnDepth(e){if(!this.rtDepth){let e=Math.max(1,Math.round(this.width*q.DEPTH_SCALE)),t=Math.max(1,Math.round(this.height*q.DEPTH_SCALE)),n=new i(e,t,f);n.format=S,n.name=`LensPass.depth`,this.rtDepth=new h(e,t,{type:oe,minFilter:x,magFilter:x,depthBuffer:!0,stencilBuffer:!1,depthTexture:n}),this.rtDepth.texture.name=`LensPass.depthColor`}let t=this.scene,n=t.background,r=t.overrideMaterial;t.background=null,t.overrideMaterial=this.depthMat;let a=Pt();try{e.setRenderTarget(this.rtDepth),e.clear(!0,!0,!1),e.render(t,this.camera)}finally{a(),t.overrideMaterial=r,t.background=n}return this.rtDepth.depthTexture}onStats(e){let t=t=>this.reduceIsFloat?e[t]:w.fromHalfFloat(e[t]),n=t(0),r=t(1),i=t(2),a=t(3),o=t(4);if(![n,r,i,a].every(Number.isFinite))return;this.statReads++,this.meanColor.set(Math.max(0,n),Math.max(0,r),Math.max(0,i)),this.luminance=2**a,this.statValid=!0;let s=this.centerRaw;this.centerRaw=Number.isFinite(o)&&o<1e3?o:1/0,this.centerDistance=this.centerRaw,Number.isFinite(s)&&Number.isFinite(this.centerRaw)&&Math.abs(this.centerRaw-s)>q.DOF_JUMP&&(this.dofBlock=Math.max(this.dofBlock,q.DOF_BLOCK_SEC))}dispose(){this.disposed=!0,this.material.dispose(),this.downMat.dispose(),this.brightMat.dispose(),this.blurMat.dispose(),this.flareMat.dispose(),this.statMat.dispose(),this.reduceMat.dispose(),this.depthMat.dispose(),this.fsQuad.dispose(),this.rtQuarter.dispose(),this.rtEighthA.dispose(),this.rtEighthB.dispose(),this.rtFlare.dispose(),this.rtStat.dispose(),this.rtReduce?.dispose(),this.rtReduce=null,this.rtDepth&&=(this.rtDepth.depthTexture?.dispose(),this.rtDepth.dispose(),null)}};function Yt(){return{tDiffuse:{value:null},tPrev:{value:null},resolution:{value:new E(1,1)},seed:{value:0},desaturate:{value:0},tint:{value:new r(1,1,1)},chromaBlur:{value:0},noiseAmp:{value:0},colorNoise:{value:0},blackLift:{value:0},knee:{value:0},scanlines:{value:0},interlaceMix:{value:0},frameBlend:{value:0},dctBlocks:{value:0},blockSeed:{value:0},jitterBand:{value:new m(0,0,0,0)},headBand:{value:new m(0,0,0,0)},lumaBlur:{value:0},chromaShift:{value:0},smear:{value:0},ringing:{value:0},vignette:{value:0},lineJitter:{value:0},snow:{value:0},tracking:{value:0},chromaNoise:{value:0},timeSec:{value:0}}}var Xt={name:`VideoShader`,vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrev;
    uniform vec2 resolution;
    uniform float seed;
    uniform float desaturate;
    uniform vec3 tint;
    uniform float chromaBlur;
    uniform float noiseAmp;
    uniform float colorNoise;
    uniform float blackLift;
    uniform float knee;
    uniform float scanlines;
    uniform float interlaceMix;
    uniform float frameBlend;
    uniform float dctBlocks;
    uniform float blockSeed;
    uniform vec4 jitterBand;
    uniform vec4 headBand;
    uniform float lumaBlur;
    uniform float chromaShift;
    uniform float smear;
    uniform float ringing;
    uniform float vignette;
    uniform float lineJitter;
    uniform float snow;
    uniform float tracking;
    uniform float chromaNoise;
    uniform float timeSec;
    varying vec2 vUv;

    // BT.601（SD ビデオ）の輝度・色差
    const vec3 LUMA = vec3(0.299, 0.587, 0.114);
    const vec3 CB = vec3(-0.168736, -0.331264, 0.5);
    const vec3 CR = vec3(0.5, -0.418688, -0.081312);

    // PCG ハッシュ（整数）。ピクセル座標 + seed で解像度に依らない一様乱数
    uint pcg(uint v) {
      uint s = v * 747796405u + 2891336453u;
      uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
      return (w >> 22u) ^ w;
    }
    float hashU(uvec2 p, uint s) {
      return float(pcg(p.x + pcg(p.y + pcg(s)))) * (1.0 / 4294967296.0);
    }

    #ifdef COLOR_STAGE
    vec3 colorStage(vec2 uv, vec2 px, uvec2 ip) {
      float scale1080c = resolution.y / 1080.0;
      vec3 rgb = texture2D(tDiffuse, uv).rgb;
      float y0 = dot(rgb, LUMA);

      // 2a. 輝度の横ぼかし（VHS の輝度帯域 ≈ 240 本）: 5 タップ（1 2 3 2 1 / 9）。輪郭が横方向にだけ甘くなる
      float y = y0;
      float yWide = y0;
      if (lumaBlur > 0.0 || ringing > 0.0) {
        float lr = max(lumaBlur, 1.2) * scale1080c * px.x;
        float acc = 3.0 * y0;
        float accW = 0.0;
        for (int i = 1; i <= 2; i++) {
          float a = dot(texture2D(tDiffuse, vec2(uv.x - float(i) * lr * 0.5, uv.y)).rgb, LUMA);
          float b = dot(texture2D(tDiffuse, vec2(uv.x + float(i) * lr * 0.5, uv.y)).rgb, LUMA);
          float w = 3.0 - float(i);
          acc += w * (a + b);
          accW += a + b;
        }
        float yb = acc / 9.0;
        yWide = (accW + y0) / 5.0;
        y = mix(y0, yb, min(lumaBlur, 1.0));
      }

      // 2b. 色のにじみ（クロマサブサンプリング）: 色差だけ横に 7 タップ（1 2 3 4 3 2 1 / 16）ぼかし、右へ chromaShift ぶん遅らせる。
      //     行ごとの色相ずれ（chromaNoise）はテープの色同期の甘さ
      vec2 cc = vec2(dot(rgb, CB), dot(rgb, CR));
      if (chromaBlur > 0.0) {
        float r = chromaBlur * scale1080c;
        float stepX = r / 3.0 * px.x;
        float delay = (r * 0.35 + chromaShift * scale1080c) * px.x;
        cc = vec2(0.0);
        for (int i = -3; i <= 3; i++) {
          vec3 sm = texture2D(tDiffuse, vec2(uv.x - delay + float(i) * stepX, uv.y)).rgb;
          float w = 4.0 - abs(float(i));
          cc += w * vec2(dot(sm, CB), dot(sm, CR));
        }
        cc *= 1.0 / 16.0;
      }
      if (chromaNoise > 0.0) {
        float rowN = hashU(uvec2(ip.y / 2u, 3u), uint(seed) + 29u) - 0.5;
        float rowM = hashU(uvec2(ip.y / 2u, 4u), uint(seed) + 31u) - 0.5;
        cc += vec2(rowN, rowM) * chromaNoise * 0.05;
      }
      // 2c. 明部の右への滲み（テープの smear）: 左側 6 タップの明部（0.55 超）を減衰させて足す。暖色寄り
      float sm = 0.0;
      if (smear > 0.0) {
        float sstep = 3.0 * scale1080c * px.x;
        for (int i = 1; i <= 6; i++) {
          float l = dot(texture2D(tDiffuse, vec2(uv.x - float(i) * sstep, uv.y)).rgb, LUMA);
          sm += max(l - 0.55, 0.0) * (1.0 - float(i) / 7.0);
        }
        sm *= smear * 0.35;
      }
      // 2d. リンギング: 輝度と広いぼかしの差を足し戻して縁に明暗の線を出す（強調回路の出過ぎ）
      if (ringing > 0.0) y += (y0 - yWide) * ringing * 1.4;
      y += sm;
      rgb = vec3(y + 1.402 * cc.y, y - 0.344136 * cc.x - 0.714136 * cc.y, y + 1.772 * cc.x) + sm * vec3(0.10, 0.03, -0.04);

      // 1. 色調整: 彩度低下と白点の偏り（RGB ゲイン）
      float luma = dot(rgb, LUMA);
      rgb = mix(vec3(luma), rgb, 1.0 - desaturate) * tint;

      // 5. ハイライトのニー: 折れ点（knee 0→0.92、1→0.85）以上の傾きを 1 − 0.75 knee に落とす（肩ではなく折れ）。チャンネル別なので白に近い色は少し色が残る
      if (knee > 0.0) {
        float kp = mix(0.92, 0.85, knee);
        float slope = 1.0 - 0.75 * knee;
        vec3 over = max(rgb - kp, vec3(0.0));
        rgb += over * (slope - 1.0);
      }

      // 4. 黒レベルの浮きと圧縮: lift + (1 − lift) x のあと、toe（0.22）以下の傾きを二次曲線で緩める（0 での傾き ≈ 1 − 3 lift）
      if (blackLift > 0.0) {
        rgb = blackLift + (1.0 - blackLift) * rgb;
        const float toe = 0.22;
        vec3 d = max(toe - rgb, vec3(0.0));
        rgb += (blackLift * 1.5) * d * d / toe;
      }

      // 10. DCT ブロックの気配: 8 px ブロックごとに量子化（2/255 刻み）の位相をずらす → 暗部の緩い勾配に境界の段差が出る。
      //     ブロックごとの DC の偏り（±0.75/255）も足す。暗部だけ（luma 0.06→0.35 で消える）。位相は 0.5 s ごとに変わる（GOP のつもり）
      if (dctBlocks > 0.0) {
        uvec2 blk = ip / 8u;
        float bh = hashU(blk, uint(blockSeed) + 7u) - 0.5;
        float dark = 1.0 - smoothstep(0.06, 0.35, dot(rgb, LUMA));
        const float q = 128.0;
        vec3 qz = floor(rgb * q + 0.5 + bh) / q + bh * (1.5 / 255.0);
        rgb = mix(rgb, qz, dctBlocks * dark);
      }
      return rgb;
    }
    #endif

    void main() {
      vec2 px = 1.0 / resolution;
      uvec2 ip = uvec2(gl_FragCoord.xy);
      uint s = uint(seed);
      vec2 uv = vUv;
      float inHead = 0.0;

      #ifdef FINAL_STAGE
      float scale1080 = resolution.y / 1080.0;
      // 7a. 行ごとの横揺れ（トラッキングの甘さ）: 行のハッシュ + ゆっくり流れる波（2 行単位、下端ほど強い）
      if (lineJitter > 0.0) {
        float rowJ = hashU(uvec2(ip.y / 2u, 9u), s + 23u) - 0.5;
        float wave = sin(vUv.y * 40.0 + timeSec * 1.7) * 0.35 + sin(vUv.y * 7.0 - timeSec * 0.6) * 0.25;
        float bottom = 1.0 + 2.0 * smoothstep(0.35, 0.0, vUv.y);
        uv.x += (rowJ * 0.6 + wave * 0.4) * lineJitter * bottom * scale1080 * px.x;
      }
      // 7. テープの揺れ（水平同期ずれ）: 行帯の中だけ横にずらす。帯の上端で最大、下へ向かって同期が戻る（t^1.5）
      if (jitterBand.w > 0.0) {
        float t = (vUv.y - jitterBand.x) / max(jitterBand.y - jitterBand.x, 1e-4);
        float inJ = step(0.0, t) * step(t, 1.0) * jitterBand.w;
        uv.x += inJ * t * sqrt(t) * jitterBand.z * scale1080 * px.x;
      }
      // 8. ヘッド切替ノイズ: 画面下端の帯。行ごとに違う横ずれ（下へ行くほど大きい）
      if (headBand.z > 0.0) {
        inHead = step(vUv.y, headBand.x) * headBand.z;
        float k = 1.0 - vUv.y / max(headBand.x, 1e-4);
        float rowH = hashU(uvec2(ip.y, 0u), s + 11u) - 0.5;
        uv.x += inHead * (headBand.y * (0.5 + 0.5 * k) + rowH * headBand.y * 0.8) * scale1080 * px.x;
      }
      #endif

      #ifdef COLOR_STAGE
      vec3 rgb = colorStage(uv, px, ip);
      #ifdef HAS_PREV
      // 9. フレーム間引きの残像 / 6. コーミング（奇数行だけ前フレーム）。前フレームは揺れの無い座標で採る
      vec3 prev = texture2D(tPrev, vUv).rgb;
      if (frameBlend > 0.0) rgb = mix(rgb, prev, frameBlend);
      if (interlaceMix > 0.0) rgb = mix(rgb, prev, interlaceMix * float(ip.y & 1u));
      #endif
      #else
      vec3 rgb = texture2D(tDiffuse, uv).rgb;
      #endif

      #ifdef FINAL_STAGE
      // 12. 常時のトラッキング帯: 画面下端 0〜3% がざらつき、行ごとに横ずれし、上端がちらつく
      if (tracking > 0.0) {
        float th = tracking * 0.03;
        float inT = step(vUv.y, th);
        if (inT > 0.0) {
          float k = 1.0 - vUv.y / max(th, 1e-4);
          float rowT = hashU(uvec2(ip.y, 5u), s + 37u) - 0.5;
          vec3 shifted = texture2D(tDiffuse, vec2(uv.x + rowT * 14.0 * k * scale1080 * px.x, uv.y)).rgb;
          float tn = hashU(ip, s + 41u);
          rgb = mix(rgb, shifted * (0.6 + 0.8 * tn) + (tn - 0.5) * 0.5 * k, 0.85);
        }
      }
      // 14. スノー: 暗部に散る白い点（画素の 0.15% × snow）
      if (snow > 0.0) {
        float l = dot(rgb, LUMA);
        float dark = 1.0 - smoothstep(0.1, 0.5, l);
        float sn = hashU(ip, s + 61u);
        if (sn < 0.0015 * snow * (0.3 + 0.7 * dark)) rgb += vec3(0.35 + 0.45 * hashU(ip, s + 67u));
      }
      // 8. ヘッド切替の帯: 行ごとの明滅 + 粗いノイズ（白い線は出さない）
      if (inHead > 0.0) {
        float fl = 1.0 + (hashU(uvec2(ip.y, 1u), s + 13u) - 0.5) * 1.2 * headBand.w;
        vec3 noisy = rgb * fl + (hashU(ip, s + 17u) - 0.5) * 0.4;
        rgb = mix(rgb, noisy, inHead);
      }
      // 15. 四隅の減光: 楕円の外側だけ（辺の中央はほとんど変えない）
      if (vignette > 0.0) {
        vec2 q = (vUv - 0.5) * 2.0;
        float rr = dot(q, q) * 0.5;
        rgb *= 1.0 - vignette * smoothstep(0.32, 1.0, rr);
      }
      // 6. 走査線: 2 px 周期（出力ピクセル基準）の弱い暗線
      if (scanlines > 0.0) rgb *= 1.0 - scanlines * ${.15.toFixed(2)} * float(ip.y & 1u);
      // 3. 暗部ノイズ: 輝度が低いほど強い（暗部 1.0 / 明部 0.3）。色ノイズは青を多めに（0.8 / 0.7 / 1.3）
      if (noiseAmp > 0.0) {
        float l = dot(rgb, LUMA);
        float dark = 1.0 - smoothstep(0.04, 0.6, l);
        float amp = noiseAmp * (0.3 + 0.7 * dark) * 2.0;
        float n = hashU(ip, s) - 0.5;
        vec3 cn = (vec3(hashU(ip, s + 1u), hashU(ip, s + 2u), hashU(ip, s + 3u)) - 0.5) * vec3(0.8, 0.7, 1.3);
        rgb += amp * mix(vec3(n), cn, colorNoise);
      }
      #endif

      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
    }`},Zt={off:{desaturate:0,tint:[1,1,1],chromaBlur:0,noise:0,colorNoise:0,blackLift:0,knee:0,scanlines:0,interlace:0,jitter:0,headSwitch:0,dctBlocks:0,frameHold:0,frameBlend:0,lumaBlur:0,chromaShift:0,smear:0,ringing:0,vignette:0,lineJitter:0,snow:0,tracking:0,chromaNoise:0},clean:{desaturate:.05,tint:[1,1,1],chromaBlur:0,noise:0,colorNoise:0,blackLift:0,knee:0,scanlines:0,interlace:0,jitter:0,headSwitch:0,dctBlocks:0,frameHold:0,frameBlend:0,lumaBlur:0,chromaShift:0,smear:0,ringing:0,vignette:.12,lineJitter:0,snow:0,tracking:0,chromaNoise:0},homeVideo:{desaturate:.12,tint:[1,1,.97],chromaBlur:3.3,noise:.019,colorNoise:.4,blackLift:.012,knee:.45,scanlines:.2,interlace:.12,jitter:.025,headSwitch:.035,dctBlocks:0,frameHold:0,frameBlend:0,lumaBlur:.8,chromaShift:1,smear:.25,ringing:.2,vignette:.2,lineJitter:.3,snow:.05,tracking:0,chromaNoise:.15},tape:{desaturate:.24,tint:[1.03,1,.93],chromaBlur:10,noise:.046,colorNoise:.6,blackLift:.045,knee:.85,scanlines:.7,interlace:.4,jitter:.45,headSwitch:.5,dctBlocks:.2,frameHold:30,frameBlend:.06,lumaBlur:3.2,chromaShift:4.5,smear:1,ringing:.8,vignette:.32,lineJitter:2,snow:.15,tracking:.85,chromaNoise:.75}},Qt=.02,$t=.58,en=.6,tn=4,nn=3,rn=4096,an=class extends Le{params={...Zt.off,tint:[1,1,1]};frozenSeed=null;strength=1;eff={...Zt.off,tint:[1,1,1]};effective(){let e=this.params,t=this.strength,n=this.eff,r=(e,n)=>Math.min(n,e*t);return n.desaturate=r(e.desaturate,.6),n.tint=[1+(e.tint[0]-1)*t,1+(e.tint[1]-1)*t,1+(e.tint[2]-1)*t],n.chromaBlur=r(e.chromaBlur,24),n.noise=r(e.noise,.12),n.colorNoise=Math.min(1,e.colorNoise),n.blackLift=r(e.blackLift,.12),n.knee=r(e.knee,1),n.scanlines=r(e.scanlines,1),n.interlace=r(e.interlace,.6),n.jitter=r(e.jitter,1),n.headSwitch=r(e.headSwitch,1),n.dctBlocks=r(e.dctBlocks,1),n.frameHold=e.frameHold,n.frameBlend=r(e.frameBlend,.2),n.lumaBlur=r(e.lumaBlur,8),n.chromaShift=r(e.chromaShift,12),n.smear=r(e.smear,2.5),n.ringing=r(e.ringing,2),n.vignette=r(e.vignette,.55),n.lineJitter=r(e.lineJitter,5),n.snow=r(e.snow,.5),n.tracking=r(e.tracking,1.2),n.chromaNoise=r(e.chromaNoise,2),n}uniforms;singleMaterial;colorMaterial;finalMaterial;fsQuad;width=1;height=1;targets=null;readIndex=0;prevValid=!1;audioNoise=0;audioSmooth=0;stillness=0;time=0;holdAcc=0;captureThisFrame=!0;jitterLeft=0;jitterState={y0:0,y1:0,shift:0};headLeft=0;headState={height:.025,shift:0,flicker:1};forced=!1;rngState=2654435769;constructor(){super(),this.uniforms=Yt();let e=e=>new u({name:`VideoShader[${Object.keys(e).join(`+`)}]`,uniforms:this.uniforms,defines:e,vertexShader:Xt.vertexShader,fragmentShader:Xt.fragmentShader,depthTest:!1,depthWrite:!1});this.singleMaterial=e({COLOR_STAGE:``,FINAL_STAGE:``}),this.colorMaterial=e({COLOR_STAGE:``,HAS_PREV:``}),this.finalMaterial=e({FINAL_STAGE:``}),this.fsQuad=new P(this.singleMaterial)}applyPreset(e){let t=Zt[e];Object.assign(this.params,t,{tint:[...t.tint]})}setAudioNoise(e){this.audioNoise=Math.max(0,Math.min(1,e))}setStillness(e){this.stillness=Math.max(0,e)}forceJitter(e=30){this.jitterState.y0=.42,this.jitterState.y1=.5,this.jitterState.shift=4,this.jitterLeft=Math.max(1,e|0),this.forced=!0}forceHeadSwitch(e=30){this.headState.height=.025,this.headState.shift=8,this.headState.flicker=1,this.headLeft=Math.max(1,e|0),this.forced=!0}update(e,t){let n=this.effective(),r=this.uniforms;this.time+=e;let i=this.frozenSeed!==null,a=i?Math.floor(this.frozenSeed):t;r.seed.value=(a%rn+rn)%rn,this.audioSmooth+=(this.audioNoise-this.audioSmooth)*Math.min(1,e*4);let o=Math.max(0,Math.min(1,(this.audioSmooth-Qt)/$t));r.noiseAmp.value=n.noise*(1+en*o);let s=this.stillness>3;if(this.forced&&this.jitterLeft<=0&&this.headLeft<=0&&(this.forced=!1),s&&!this.forced?(this.jitterLeft=0,this.headLeft=0):!s&&!i&&(this.jitterLeft<=0&&n.jitter>0&&this.rng()<n.jitter*tn*e&&this.startJitter(),this.headLeft<=0&&n.headSwitch>0&&this.rng()<n.headSwitch*nn*e&&this.startHeadSwitch()),this.jitterLeft>0?(r.jitterBand.value.set(this.jitterState.y0,this.jitterState.y1,this.jitterState.shift,1),this.jitterLeft--):r.jitterBand.value.w=0,this.headLeft>0?(r.headBand.value.set(this.headState.height,this.headState.shift,1,this.headState.flicker),this.headLeft--):r.headBand.value.z=0,n.frameHold>0){let t=1/n.frameHold;this.holdAcc+=e,this.holdAcc>=t*.75?(this.captureThisFrame=!0,this.holdAcc=Math.min(this.holdAcc-t,t)):this.captureThisFrame=!1}else this.captureThisFrame=!0,this.holdAcc=0;r.desaturate.value=n.desaturate,r.tint.value.set(n.tint[0],n.tint[1],n.tint[2]),r.chromaBlur.value=n.chromaBlur,r.colorNoise.value=n.colorNoise,r.blackLift.value=n.blackLift,r.knee.value=n.knee,r.scanlines.value=n.scanlines,r.dctBlocks.value=n.dctBlocks,r.blockSeed.value=Math.floor(this.time*2)%rn,r.lumaBlur.value=n.lumaBlur,r.chromaShift.value=n.chromaShift,r.smear.value=n.smear,r.ringing.value=n.ringing,r.vignette.value=n.vignette,r.lineJitter.value=s&&!this.forced?n.lineJitter*.3:n.lineJitter,r.snow.value=n.snow,r.tracking.value=n.tracking,r.chromaNoise.value=n.chromaNoise,r.timeSec.value=this.time}setSize(e,t){if(this.width=Math.max(1,e|0),this.height=Math.max(1,t|0),this.uniforms.resolution.value.set(this.width,this.height),this.targets){for(let e of this.targets)e.setSize(this.width,this.height);this.prevValid=!1}}render(e,t,n){let r=this.effective(),i=this.uniforms,a=this.renderToScreen?null:t;if(!(r.interlace>0||r.frameHold>0)){this.releaseTargets(),i.tDiffuse.value=n.texture,i.interlaceMix.value=0,i.frameBlend.value=0,this.draw(e,this.singleMaterial,a,this.clear);return}let o=this.ensureTargets();if(this.captureThisFrame||!this.prevValid){let t=o[this.readIndex],a=o[1-this.readIndex];i.tDiffuse.value=n.texture,i.tPrev.value=t.texture,i.interlaceMix.value=this.prevValid?r.interlace:0,i.frameBlend.value=this.prevValid&&r.frameHold>0?r.frameBlend:0,this.draw(e,this.colorMaterial,a,!1),this.readIndex=1-this.readIndex,this.prevValid=!0}i.tDiffuse.value=o[this.readIndex].texture,this.draw(e,this.finalMaterial,a,this.clear)}dispose(){this.releaseTargets(),this.singleMaterial.dispose(),this.colorMaterial.dispose(),this.finalMaterial.dispose(),this.fsQuad.dispose()}draw(e,t,n,r){e.setRenderTarget(n),n&&r&&e.clear(),this.fsQuad.material=t,this.fsQuad.render(e)}ensureTargets(){if(this.targets)return this.targets;let e=e=>{let t=new h(this.width,this.height,{type:oe,format:a,minFilter:b,magFilter:b,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,colorSpace:``});return t.texture.name=`VideoPass.prev${e}`,t};return this.targets=[e(0),e(1)],this.readIndex=0,this.prevValid=!1,this.targets}releaseTargets(){if(this.targets){for(let e of this.targets)e.dispose();this.targets=null,this.prevValid=!1,this.uniforms.tPrev.value=null}}startJitter(){let e=.02+this.rng()*.1;this.jitterState.y0=this.rng()*(1-e),this.jitterState.y1=this.jitterState.y0+e,this.jitterState.shift=(2+this.rng()*4)*(this.rng()<.5?-1:1),this.jitterLeft=this.rng()<.4?2:1}startHeadSwitch(){this.headState.height=.02+this.rng()*.01,this.headState.shift=4+this.rng()*8,this.headState.flicker=.6+this.rng()*.4,this.headLeft=2+Math.floor(this.rng()*4)}rng(){this.rngState=this.rngState+1831565813|0;let e=this.rngState;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}},on=class{visible=!1;parent;date=`2003.07.14`;elapsed=0;root=null;dot=null;tc=null;lastTc=``;lastDotOn=!0;constructor(e=typeof document<`u`?document.body:null){this.parent=e}setVisible(e){if(e!==this.visible){if(this.visible=e,e){let e=this.ensureDom();e&&(e.style.display=``,this.lastTc=``,this.refresh())}else this.root&&(this.root.style.display=`none`)}}get isVisible(){return this.visible}update(e){this.elapsed+=Math.max(0,e),this.visible&&this.root&&this.refresh()}dispose(){this.root?.remove(),this.root=null,this.dot=null,this.tc=null,this.visible=!1}ensureDom(){if(this.root)return this.root;if(!this.parent||typeof document>`u`)return null;let e=this.parent.ownerDocument??document,t=e.createElement(`div`);t.id=`rec-overlay`,t.setAttribute(`aria-hidden`,`true`),t.style.cssText=[`position:fixed`,`inset:0`,`pointer-events:none`,`z-index:5`,`user-select:none`,`font:12px/1 ui-monospace, Menlo, Consolas, "Courier New", monospace`,`letter-spacing:0.08em`,`color:rgba(255,255,255,0.8)`,`text-shadow:0 1px 2px rgba(0,0,0,0.7)`].join(`;`);let n=e.createElement(`div`);n.style.cssText=`position:absolute;right:calc(16px + env(safe-area-inset-right, 0px));top:calc(14px + env(safe-area-inset-top, 0px));display:flex;align-items:center;gap:6px`;let r=e.createElement(`span`);r.style.cssText=`display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff2b2b;box-shadow:0 0 6px rgba(255,43,43,0.7)`;let i=e.createElement(`span`);i.textContent=`REC`,n.append(r,i);let a=e.createElement(`div`);return a.style.cssText=`position:absolute;left:calc(16px + env(safe-area-inset-left, 0px));bottom:calc(16px + env(safe-area-inset-bottom, 0px));white-space:pre`,t.append(n,a),this.parent.appendChild(t),this.root=t,this.dot=r,this.tc=a,t}refresh(){if(!this.dot||!this.tc)return;let e=this.elapsed%1<.5;e!==this.lastDotOn&&(this.lastDotOn=e,this.dot.style.opacity=e?`1`:`0`);let t=`${this.dateText()}  ${sn(this.elapsed)}`;t!==this.lastTc&&(this.lastTc=t,this.tc.textContent=t)}dateText(){if(this.date!==`auto`)return this.date;let e=new Date;return`${e.getFullYear()}.${J(e.getMonth()+1)}.${J(e.getDate())}`}};function sn(e){let t=Math.max(0,e),n=Math.floor(t/3600)%100,r=Math.floor(t/60)%60,i=Math.floor(t)%60,a=Math.floor((t-Math.floor(t))*30)%30;return`${J(n)}:${J(r)}:${J(i)}:${J(a)}`}function J(e){return e<10?`0${e}`:String(e)}var cn={preset:`off`,vhsStrength:2,handheld:.6,cameraLag:!0,frameHold:`off`,rec:!0,autoExposure:!1,autoWhiteBalance:!1,colorKeep:.85},ln=`vsl.film.v1`,un=`
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uScale; varying vec2 vUv;
${le}
void main() {
  vec3 c = clamp(texture2D(tSrc, vUv).rgb / uScale, 0.0, 1.0);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  c += (sl_hash12(vUv * uRes * 1.37) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`,dn=class{settings;lens;video;rig;rec;rtLinear;rtLens;rtDisplay;encode;frame=0;strideAcc=0;strideCount=0;stillSec=0;lastPos=new r;lastYaw=0;lastPitch=0;hasLast=!1;onChange=null;constructor(e,t,n,r=!0){this.settings={...cn,...r?fn():{}},this.persist=r,this.lens=new Jt(e,t),this.video=new an,this.video.renderToScreen=!0,this.adaptVideoShader(),this.rig=new At(t),this.rec=new on(n);let i=e=>{let t=new h(1,1,{type:p,depthBuffer:!1,stencilBuffer:!1});return t.texture.name=e,t.texture.colorSpace=``,t.texture.generateMipmaps=!1,t};this.rtLinear=i(`Film.linear`),this.rtLens=i(`Film.lens`),this.rtDisplay=i(`Film.display`),this.encode=new P(new u({vertexShader:`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:un,uniforms:{tSrc:{value:null},uRes:{value:new E},uScale:{value:1}},depthTest:!1,depthWrite:!1})),this.apply()}persist;inputScale=.5;smearKnee={value:.9};colorKeepU={value:.85};get active(){return this.settings.preset!==`off`}get linearTarget(){return this.rtLinear}set(e,t=!0){Object.assign(this.settings,e),Mt(this.settings.preset)||(this.settings.preset=`off`),this.settings.vhsStrength=g.clamp(this.settings.vhsStrength,0,2),this.settings.handheld=g.clamp(this.settings.handheld,0,1),this.settings.colorKeep=g.clamp(Number.isFinite(this.settings.colorKeep)?this.settings.colorKeep:cn.colorKeep,0,1),this.apply(),this.persist&&t&&pn(this.settings),this.onChange?.()}apply(){let e=this.settings;this.lens.applyPreset(e.preset),this.lens.params.autoExposure=e.autoExposure?this.lens.params.autoExposure:0,this.lens.params.autoWhiteBalance=e.autoWhiteBalance?this.lens.params.autoWhiteBalance:0,this.video.applyPreset(e.preset),this.video.strength=e.vhsStrength;let t=Zt[e.preset];this.video.params.frameHold=e.frameHold===`off`?t.frameHold:Number(e.frameHold),this.video.params.frameBlend=this.video.params.frameHold>0?Math.max(t.frameBlend,.06):t.frameBlend;let n=e.colorKeep,r=Math.max(e.vhsStrength,.001),i=(e,t,i)=>Math.min(t,e*r)*(1-i*n)/r;this.colorKeepU.value=n,this.video.params.chromaBlur=i(t.chromaBlur,24,.4),this.video.params.blackLift=i(t.blackLift,.12,.6),this.video.params.knee=i(t.knee,1,.5),this.video.params.chromaNoise=i(t.chromaNoise,2,.5),this.video.params.vignette=i(t.vignette,.55,.5),this.rig.feel.handheld=this.active?e.handheld:0,this.rig.feel.lag=this.active&&e.cameraLag,this.rig.feel.preset=e.preset,this.rec.setVisible(this.active&&e.rec)}adaptVideoShader(){let e=this.video;for(let t of[`singleMaterial`,`colorMaterial`,`finalMaterial`]){let n=e[t];if(!n)continue;let r=n.fragmentShader,i=r.replace(`max(l - 0.55, 0.0)`,`max(l - smearKnee, 0.0)`);i===r?t===`singleMaterial`&&console.warn(`[Film] VideoShader の滲みのしきい値が見つからない（v2 のまま使う）`):(r=i.replace(`uniform float smear;`,`uniform float smear;
uniform float smearKnee;`),n.uniforms.smearKnee=this.smearKnee);let a=r.replace(`rgb *= 1.0 - scanlines * 0.15 * float(ip.y & 1u);`,`rgb *= 1.0 - scanlines * 0.15 * (float(ip.y & 1u) - 0.5 * colorKeep);`);a===r&&t===`finalMaterial`&&console.warn(`[Film] VideoShader の走査線が見つからない（平均の明るさを保たない）`),r=a;let o=r.replace(`// 10. DCT ブロックの気配`,`// 検証ステージ: 元の色を残す（Film.colorKeep）。輝度は VHS の処理のまま、色差を元の映像の色差へ戻す
      if (colorKeep > 0.0) {
        float yk = dot(rgb, LUMA);
        // 黒浮きで明るくなった暗部は、明るくなった分だけ色差も増やす（暗い青緑が灰色の膜にならないように。最大 1.5 倍）
        float lift = clamp(yk / max(y, 0.02), 1.0, 1.5);
        vec2 ck = mix(vec2(dot(rgb, CB), dot(rgb, CR)), cc * mix(1.0, lift, 0.7), colorKeep);
        rgb = vec3(yk + 1.402 * ck.y, yk - 0.344136 * ck.x - 0.714136 * ck.y, yk + 1.772 * ck.x);
      }
      // 10. DCT ブロックの気配`);o===r?t===`singleMaterial`&&console.warn(`[Film] VideoShader の色段が見つからない（元の色を残す は効かない）`):(r=o.replace(`uniform float smear;`,`uniform float smear;
uniform float colorKeep;`),n.uniforms.colorKeep=this.colorKeepU),r!==n.fragmentShader&&(n.fragmentShader=r,n.needsUpdate=!0)}}setSize(e,t){for(let n of[this.rtLinear,this.rtLens,this.rtDisplay])n.setSize(e,t);this.lens.setSize(e,t),this.video.setSize(e,t),this.encode.material.uniforms.uRes.value.set(e,t)}setDepthTexture(e){this.lens.setDepthTexture(e)}snap(e,t,n){this.rig.baseFov=e.fov,this.rig.snap(this.subject(0,new r,t,n,1.6,!0,!1,0)),this.hasLast=!1}updateCamera(e,t){let n=this.hasLast?Math.hypot(t.pos.x-this.lastPos.x,t.pos.z-this.lastPos.z):0,r=e>0?n/e:0,i=this.hasLast&&(Math.abs(t.yaw-this.lastYaw)+Math.abs(t.pitch-this.lastPitch))/Math.max(e,.001)>.05;this.stillSec=r<.05&&!i?this.stillSec+e:0;let a=r>2.4?1.1:.75;for(this.strideAcc+=n;this.strideAcc>=a;)this.strideAcc-=a,this.strideCount++;this.hasLast&&e>0&&this.lens.setCameraMotion((t.yaw-this.lastYaw)/e,(t.pitch-this.lastPitch)/e),this.lastPos.copy(t.pos),this.lastYaw=t.yaw,this.lastPitch=t.pitch,this.hasLast=!0,this.video.setStillness(this.stillSec),this.video.setAudioNoise(.2),this.active&&(this.rig.update(e,this.subject(r,t.pos,t.yaw,t.pitch,t.eye,t.onGround,t.crouching,a)),this.rig.camera.updateMatrixWorld())}subject(e,t,n,r,i,a,o,s){return{pos:[t.x,t.y,t.z],eye:i,yaw:n,pitch:r,onGround:a,crouching:o,moveRank:e<.1?`still`:s>1?`dash`:`walk`,strideAcc:this.strideAcc,strideCount:this.strideCount,horizontalSpeed:e,stillSec:this.stillSec}}update(e){this.frame++,this.lens.update(e,this.frame),this.video.update(e,this.frame),this.rec.update(e)}render(e){this.lens.render(e,this.rtLens,this.rtLinear);let t=this.encode.material;t.uniforms.tSrc.value=this.rtLens.texture,t.uniforms.uScale.value=this.inputScale,e.setRenderTarget(this.rtDisplay),this.encode.render(e),this.video.render(e,this.rtLens,this.rtDisplay)}freezeNoise(e){this.video.frozenSeed=e}dispose(){this.lens.dispose(),this.video.dispose(),this.rec.dispose(),this.rtLinear.dispose(),this.rtLens.dispose(),this.rtDisplay.dispose(),this.encode.dispose()}};function fn(){try{let e=localStorage.getItem(ln);return e?JSON.parse(e):{}}catch{return{}}}function pn(e){try{localStorage.setItem(ln,JSON.stringify(e))}catch{}}var Y=1456,mn=class{container;scenes;renderer;camera=new re(60,Y/816,.05,1200);input;player;colliders=new Ee;post;film;scene=new ne;lamps=new Ye;def=null;built=null;view=null;style;sun=null;variant=`v1`;letterbox=!0;frozen=!1;time=0;fps=0;last=performance.now();frames=0;fpsT=0;pixelRatio=Math.min(window.devicePixelRatio,1.5);fixedSize=null;onChange=null;defs=new Map;loading=!1;constructor(e,t,n={}){this.container=e,this.scenes=t,this.renderer=new ce({antialias:!1,powerPreference:`high-performance`,preserveDrawingBuffer:!1}),this.renderer.outputColorSpace=D,this.renderer.toneMapping=0,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=1,this.renderer.autoClear=!1,this.renderer.info.autoReset=!1,e.appendChild(this.renderer.domElement),this.input=new De(this.renderer.domElement),this.player=new Fe(this.camera),this.camera.layers.enable(1),this.post=new Ke(this.renderer);let r=document.createElement(`div`);r.className=`film-frame`,e.appendChild(r),this.film=new dn(this.scene,this.camera,r,n.persistFilm??!0),this.post.setFilm(this.film),this.film.onChange=()=>{this.film.active||(this.camera.fov=this.film.rig.baseFov,this.camera.updateProjectionMatrix()),this.onChange?.()},window.addEventListener(`resize`,()=>this.resize())}async getDef(e){let t=this.scenes.find(t=>t.id===e)??this.scenes[0],n=this.defs.get(t.id);return n||(n=await t.load(),this.defs.set(t.id,n)),n}async load(e,t){this.loading=!0;let n;try{n=await this.getDef(e)}finally{this.loading=!1}this.unload(),this.def=n,this.style=n.style,fe(this.style),this.post.style=this.style,this.scene.clear(),this.colliders.clear(),this.lamps.clear(),this.sun=null;let r={style:n.style,renderer:this.renderer,colliders:this.colliders,mat:e=>Ze(n.style,e),addReflector:(e,t,n)=>{let r=new Ie(e,t,n);return r.setSize(this.post.width,this.post.height),this.post.reflectors.push(r),r},setSun:e=>this.sun=e,updateShadows:()=>this.renderer.shadowMap.needsUpdate=!0,addLamp:e=>this.lamps.add(e),setLampRange:e=>this.lamps.maxDist=e};this.renderer.shadowMap.autoUpdate=!0,this.built=n.build(r),this.built.staticShadows&&(this.renderer.shadowMap.autoUpdate=!1),this.scene.add(this.built.root),n.sky!==!1&&this.scene.add(nt(n.sky??{})),this.renderer.shadowMap.needsUpdate=!0;let i=this.built.spawn;this.player.setSpawn({x:i.pos[0],y:i.pos[1],z:i.pos[2]},i.yaw,i.pitch??0),this.camera.fov=n.views[0]?.fov??60,this.camera.updateProjectionMatrix(),this.film.snap(this.camera,this.player.yaw,this.player.pitch),this.view=null;let a=t===void 0?n.views[0]?.id:t;a?this.setView(a):this.player.applyCamera(),this.resize(),this.onChange?.()}unload(){this.built?.dispose?.();for(let e of this.post.reflectors)e.dispose();this.post.reflectors.length=0,this.scene.traverse(e=>{let t=e;if(t.isMesh){t.geometry.dispose();let e=Array.isArray(t.material)?t.material:[t.material];for(let t of e){for(let e of Object.values(t))e instanceof s&&e.dispose();t.dispose()}}}),this.built=null}setView(e){if(!this.def)return;let t=e?this.def.views.find(t=>t.id===e):void 0;this.view=t??null,this.setStyle(t?.style??this.def.style),t&&(this.camera.fov=t.fov,this.camera.updateProjectionMatrix(),this.player.placeEye({x:t.eye[0],y:t.eye[1],z:t.eye[2]},t.yaw,t.pitch,t.roll??0,this.colliders),this.player.applyCamera(),this.film.snap(this.camera,t.yaw,t.pitch),this.onChange?.())}refSize(e=this.view){return e?.size??this.def?.views[0]?.size??[1456,816]}setStyle(e){this.style=e,fe(e),this.post.style=e}resize(){let e,t,n=window.innerWidth,r=window.innerHeight;if(this.fixedSize)[e,t]=this.fixedSize;else if(this.letterbox){let[i,a]=this.refSize(),o=i/a;n/r>o?(t=r,e=Math.round(r*o)):(e=n,t=Math.round(n/o))}else e=n,t=r;let i=this.fixedSize?1:this.pixelRatio;this.renderer.setPixelRatio(i),this.renderer.setSize(e,t);let a=this.renderer.domElement;a.style.left=`${Math.round((n-e)/2)}px`,a.style.top=`${Math.round((r-t)/2)}px`,this.container.style.setProperty(`--vw`,`${e}px`),this.container.style.setProperty(`--vh`,`${t}px`),this.container.style.setProperty(`--vx`,`${Math.round((n-e)/2)}px`),this.container.style.setProperty(`--vy`,`${Math.round((r-t)/2)}px`),this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.post.setSize(Math.round(e*i),Math.round(t*i))}start(){let e=()=>{requestAnimationFrame(e);let t=performance.now(),n=Math.min((t-this.last)/1e3,.1);this.last=t,this.step(n),this.frames++,this.fpsT+=n,this.fpsT>.5&&(this.fps=this.frames/this.fpsT,this.frames=0,this.fpsT=0)};requestAnimationFrame(e)}step(e){this.frozen||(this.time+=e),j.uTime.value=this.time;let t=this.player.pos.clone();this.player.externalCamera=this.film.active,this.player.update(e,this.input,this.colliders),this.view&&t.distanceToSquared(this.player.pos)>1e-6&&(this.view=null,this.onChange?.()),this.input.endFrame();let n=this.player;this.film.updateCamera(e,{pos:n.pos,yaw:n.yaw,pitch:n.pitch,eye:n.eyeHeight,onGround:n.onGround,crouching:n.height<1.5}),this.film.update(e),this.built?.update?.(e,this.time,this.camera),this.applyZoneStyle(),this.renderFrame()}applyZoneStyle(){let e=this.built?.styleZones;if(!e)return;let t=this.camera.position,n=e.find(e=>t.x>=e.min[0]&&t.x<=e.max[0]&&t.y>=e.min[1]&&t.y<=e.max[1]&&t.z>=e.min[2]&&t.z<=e.max[2]);n&&n.style!==this.style&&this.setStyle(n.style)}renderFrame(){this.built?.beforeRender?.(this.camera),this.lamps.update(this.camera.position),this.sun&&(j.uSunShadowMatrix.value.copy(this.sun.shadow.matrix),j.uSunShadowNormalBias.value=this.sun.shadow.normalBias),this.camera.updateMatrixWorld(),this.renderer.info.reset(),this.post.render(this.scene,this.camera),this.sun&&j.uSunShadowMatrix.value.copy(this.sun.shadow.matrix)}async topDownMap(e=2.2,t=1400,n=!0){let i=new _;this.scene.traverse(e=>{let t=e;if(!t.isMesh||e.name===`sky`||!t.visible)return;let n=new _().setFromObject(t);Number.isFinite(n.min.x)&&n.max.x-n.min.x<300&&n.max.z-n.min.z<300&&i.union(n)});for(let e of this.def?.views??[])i.expandByPoint(new r(...e.eye));let a=i.min.x-2,o=i.max.x+2,s=i.min.z-2,c=i.max.z+2,u=o-a,d=c-s,f=u>=d?t:Math.round(t*u/d),p=u>=d?Math.round(t*d/u):t,m=new ie(a,o,-s,-c,.1,4e3);m.position.set(0,i.max.y+50,0),m.up.set(0,0,-1),m.lookAt(0,0,0),m.updateMatrixWorld();let h=this.renderer,v=h.getSize(new E),y=h.getPixelRatio();h.setPixelRatio(1),h.setSize(f,p,!1),h.clippingPlanes=[new l(new r(0,-1,0),e)];let b=this.scene.getObjectByName(`sky`);b&&(b.visible=!1),this.built?.beforeRender?.(m,{map:!0});let x=j.uFogParams.value.x;j.uFogParams.value.x=0,h.setRenderTarget(null),h.setClearColor(1053720,1),h.clear(),h.render(this.scene,m),j.uFogParams.value.x=x,this.built?.beforeRender?.(this.camera);let S=h.domElement.toDataURL(`image/png`);if(b&&(b.visible=!0),h.clippingPlanes=[],h.setPixelRatio(y),h.setSize(v.x,v.y,!1),this.resize(),!n)return{image:S,bounds:[a,s,o,c]};let C=await X(S),w=document.createElement(`canvas`);w.width=f,w.height=p;let T=w.getContext(`2d`);T.drawImage(C,0,0);let D=(e,t)=>[(e-a)/u*f,(t-s)/d*p];T.lineWidth=2,T.font=`bold 14px sans-serif`;for(let e of this.def?.views??[]){let[t,n]=D(e.eye[0],e.eye[2]),r=Math.atan(Math.tan(g.degToRad(e.fov)/2)*(this.refSize(e)[0]/this.refSize(e)[1])),i=Math.min(f,p)*.12;T.strokeStyle=`#ffcc33`,T.fillStyle=`rgba(255, 204, 51, 0.2)`,T.beginPath(),T.moveTo(t,n);for(let a of[-1,1]){let o=e.yaw+a*r;T.lineTo(t-Math.sin(o)*i,n-Math.cos(o)*i)}T.closePath(),T.fill(),T.stroke(),T.fillStyle=`#ffcc33`,T.fillText(e.id,t+6,n-6)}return T.fillStyle=`#ffffff`,T.fillText(`${u.toFixed(0)} × ${d.toFixed(0)} m（上が奥 -Z）・高さ ${e} m より上を切り取り`,10,p-10),{image:w.toDataURL(`image/png`),bounds:[a,s,o,c]}}async planImage(e={}){let t=this.def?.plan;if(!t)return null;let n=(this.def?.views??[]).map(e=>{let[t,n]=this.refSize(e);return{id:e.id,eye:e.eye,yaw:e.yaw,fov:e.fov,aspect:t/n,reach:this.viewFan(e.eye,e.yaw,e.fov,48,80,t/n)}}),r=document.createElement(`canvas`);if(e.top){let i=await this.topDownMap(e.cut??2.2,1600,!1),a=await X(i.image);ot(t,r,{level:e.level,views:n,under:{image:a,bounds:i.bounds},bounds:i.bounds,px:1600})}else ot(t,r,{level:e.level,views:n});return r.toDataURL(`image/png`)}reach(e=.3,t=1/0){let n=this.colliders.boxes.filter(e=>e.passable),r=n.map(e=>e.enabled);for(let e of n)e.enabled=!1;try{return this.reachInner(e,t)}finally{n.forEach((e,t)=>e.enabled=r[t])}}reachInner(e,t){let n=this.colliders,i=.26,a=.36,o=1.12,s=this.built?.spawn.pos??[0,0,0],c=n.groundBelow(s[0],s[2],i,s[1]+a),l=[s[0],Number.isFinite(c.y)?c.y:s[1],s[2]],u=(t,n,r)=>`${Math.round(t/e)},${Math.round(n/e)},${Math.round(r*5)}`,d=new Set([u(...l)]),f=[l],p=[l],m=new r;for(;p.length&&d.size<15e5;){let[r,s,c]=p.pop();for(let[l,h]of[[e,0],[-e,0],[0,e],[0,-e]]){let e=r+l,g=c+h,_=n.groundBelow(e,g,i,s+a);if(!Number.isFinite(_.y)||_.y<s-4||_.depth>t||(m.set(e,_.y,g),n.pushOut(m,i,_.y+a,_.y+o),Math.hypot(m.x-e,m.z-g)>.05)||_.y<s-a&&(m.set(e,s,g),n.pushOut(m,i,s+a,s+o),Math.hypot(m.x-e,m.z-g)>.05)||n.ceilingAbove(e,g,i,_.y+.3)<_.y+o)continue;let v=u(e,g,_.y);if(d.has(v))continue;d.add(v);let y=[e,_.y,g];f.push(y),p.push(y)}}let h=e=>{let t=n.groundBelow(e[0],e[2],i,e[1]-.3),r=Number.isFinite(t.y)?t.y:e[1]-1.6;return f.some(t=>Math.abs(t[1]-r)<.25&&Math.hypot(t[0]-e[0],t[2]-e[2])<.45)},g={};for(let e of this.def?.views??[])g[e.id]=h(e.eye);let _={};for(let e of this.def?.plan?.tour??[])_[e.label]=h(e.eye);return{views:g,tour:_,cells:d.size,points:f}}viewFan(e,t,n,r=48,i=80,a){let[o,s]=this.refSize(),c=Math.atan(Math.tan(g.degToRad(n)/2)*(a??o/s)),l=[];for(let n=0;n<=r;n++){let a=t-c+2*c*n/r;l.push(this.colliders.rayXZ(e[0],e[2],e[1],-Math.sin(a),-Math.cos(a),i))}return l}async shotAt(e,t,n=0,r=60,i=2){if(this.view=null,this.def&&this.setStyle(this.def.style),this.camera.fov=r,this.camera.updateProjectionMatrix(),this.player.placeEye({x:e[0],y:e[1],z:e[2]},t,n,0),this.player.applyCamera(),this.applyZoneStyle(),i>0&&this.built?.update)for(let e=0;e<i;e+=.1)this.built.update(.1,this.time+e,this.camera);this.frozen=!0,this.fixedSize=[Y,816],this.resize(),this.film.snap(this.camera,t,n);for(let e=0;e<3;e++)this.renderFrame();let a=await X(this.renderer.domElement.toDataURL(`image/png`));return this.fixedSize=null,this.resize(),a}async tourPerf(e=40){let t=[];for(let n of this.def?.plan?.tour??[]){await this.shotAt(n.eye,n.yaw,n.pitch??0,n.fov??60);let r=this.perf(e);t.push({label:n.label,ms:r.ms,calls:r.calls})}return t}async tourSheet(e=3){let t=this.def?.plan?.tour;return t?.length?this.stopsSheet(t,e):null}randomStops(e=18,t=1){let n=ft(t),r=this.reach().points,i=(this.def?.plan?.spaces??[]).filter(e=>e.kind!==`void`),a=(e,t,n)=>{let r=!1;for(let i=0,a=n.length-1;i<n.length;a=i++){let[o,s]=n[i],[c,l]=n[a];s>t!=l>t&&e<(c-o)*(t-s)/(l-s)+o&&(r=!r)}return r},o=i.map(e=>rt(e)),s=new Map;for(let e=0;e<r.length;e+=3){let[t,n,c]=r[e],l=-1;for(let e=0;e<i.length;e++){let r=i[e];if(!(n<r.floor-.7||r.ceiling!==void 0&&n>r.ceiling)&&a(t,c,o[e])){l=e;break}}let u=s.get(l)??[];u.push(r[e]),s.set(l,u)}let c=[...s.keys()];for(let e=c.length-1;e>0;e--){let t=Math.floor(n()*(e+1));[c[e],c[t]]=[c[t],c[e]]}let l=[],u=this.colliders.boxes.filter(e=>e.passable),d=(e,t)=>u.some(n=>Math.max(n.min.x-e,0,e-n.max.x)**2+Math.max(n.min.z-t,0,t-n.max.z)**2<.81),f=(e,t,n)=>{let r=0;for(let i=0;i<12;i++){let a=i/12*Math.PI*2;this.colliders.rayXZ(e,n,t,-Math.sin(a),-Math.cos(a),1.5)>=1.5&&r++}return r<4};for(let t=0;t<e&&c.length;t++){let e=c[t%c.length],r=s.get(e),[a,o,u]=r[Math.floor(n()*r.length)];for(let e=0;e<12&&(d(a,u)||f(a,o+1.6,u));e++)[a,o,u]=r[Math.floor(n()*r.length)];let p=o+1.6,m=[];for(let e=0;e<16;e++){let t=e/16*Math.PI*2+n()*.3,r=this.colliders.rayXZ(a,u,p,-Math.sin(t),-Math.cos(t),30);r>=2.5&&m.push([t,Math.min(r,20)**2])}let h=n()*Math.PI*2;if(m.length){let e=n()*m.reduce((e,t)=>e+t[1],0);for(let t of m)if(e-=t[1],e<=0){h=t[0];break}}let g=e>=0?i[e].label:`間取り図の外`;l.push({label:`無作為 ${t+1}: ${g}`,eye:[a,p,u],yaw:h,pitch:(n()-.5)*.16-.02,fov:60})}return l}palCache=null;async refPalette(){let e=this.def;if(this.palCache?.id===e.id)return this.palCache.pal;let t=[];for(let n of e.views)t.push(B(await X(`refs/${n.id}.jpg`)));let n=dt(t);return this.palCache={id:e.id,pal:n},n}async shotStats(e,t,n=0,r=60){let i=await this.refPalette(),a=await this.shotAt(e,t,n,r);return{src:a.src,stats:V(B(a),i)}}async stopsSheet(e,t=3,n,r){let i=Math.round(Y/t),a=Math.round(i*816/Y),o=Math.ceil(e.length/t),s=document.createElement(`canvas`);s.width=i*t,s.height=o*(a+20);let c=s.getContext(`2d`);c.fillStyle=`#101416`,c.fillRect(0,0,s.width,s.height);for(let o=0;o<e.length;o++){let s=e[o],l=await this.shotAt(s.eye,s.yaw,s.pitch??0,s.fov??60);n&&n.push(V(B(l),r));let u=o%t*i,d=Math.floor(o/t)*(a+20);c.fillStyle=`#e8efec`,c.font=`13px sans-serif`,c.fillText(`${o+1}. ${s.label}`,u+6,d+15),c.drawImage(l,u,d+20,i,a)}return s.toDataURL(`image/jpeg`,.86)}async qualityReport(e=18,t=1){let n=this.def,r=await this.refPalette(),i=[];for(let e of n.views)i.push({id:e.id,stats:V(B(await X(`refs/${e.id}.jpg`)),r)});let a=[];for(let e of n.views){let t=await this.capture(e.id);a.push({id:e.id,stats:V(B(await X(t.render)),r)})}let o=n.plan?.tour??[],s=[],c=o.length?await this.stopsSheet(o,3,s,r):null,l=this.randomStops(e,t),u=[],d=await this.stopsSheet(l,3,u,r);return{refs:i,views:a,tour:o.map((e,t)=>({label:e.label,stats:s[t]})),random:l.map((e,t)=>({label:e.label,stats:u[t]})),tourSheet:c,randomSheet:d}}perf(e=90){this.fixedSize=[Y,816],this.resize();let t=this.renderer.getContext(),n=new Uint8Array(4),r=()=>t.readPixels(0,0,1,1,t.RGBA,t.UNSIGNED_BYTE,n);this.renderFrame(),r();let i=performance.now();for(let t=0;t<e;t++)this.time+=1/60,j.uTime.value=this.time,this.renderFrame(),r();let a=(performance.now()-i)/e,{calls:o,triangles:s}=this.renderer.info.render;return this.fixedSize=null,this.resize(),{ms:Math.round(a*100)/100,calls:o,triangles:s}}async capture(e,t=4,n=3){if(e){let t=e.replace(/-\d+$/,``);this.def?.id!==t&&this.scenes.some(e=>e.id===t)?await this.load(t,e):this.setView(e)}let r=this.frozen;this.frozen=!0,this.player.bob=0;let[i,a]=this.refSize();this.fixedSize=[i,a],this.resize(),this.film.freezeNoise(7),this.film.active&&this.film.update(1/60);for(let e=0;e<3;e++)this.renderFrame();this.film.freezeNoise(null);let o=this.renderer.domElement.toDataURL(`image/png`),s=await X(o),c=``,l=``,u=``,d={},f=e??this.view?.id,p=f?await X(`refs/${f}.jpg`).catch(()=>null):null;if(p){let e=document.createElement(`canvas`);e.width=i,e.height=Math.round(a/2);let r=e.getContext(`2d`);r.drawImage(s,0,0,i/2,a/2),r.drawImage(p,i/2,0,i/2,a/2),r.fillStyle=`rgba(0,0,0,0.6)`,r.fillRect(0,0,70,18),r.fillRect(i/2,0,70,18),r.fillStyle=`#fff`,r.font=`12px sans-serif`,r.fillText(`render`,6,13),r.fillText(`reference`,i/2+6,13),c=e.toDataURL(`image/png`),d=vn(s,p,t,n),l=hn(s,p);let o=gn(s,p);u=o.image,Object.assign(d,{edgeF:o.f,edgeP:o.p,edgeR:o.r})}return this.fixedSize=null,this.frozen=r,this.resize(),{render:o,compare:c,diff:l,edges:u,metrics:d}}};function X(e){return new Promise((t,n)=>{let r=new Image;r.onload=()=>t(r),r.onerror=n,r.src=e})}function hn(e,t){let n=Math.round((t.naturalWidth||1456)/2),r=Math.round((t.naturalHeight||816)/2),i=e=>{let t=document.createElement(`canvas`);t.width=n,t.height=r;let i=t.getContext(`2d`);return i.drawImage(e,0,0,n,r),i.getImageData(0,0,n,r).data},a=i(e),o=i(t),s=document.createElement(`canvas`);s.width=n,s.height=r;let c=s.getContext(`2d`),l=c.createImageData(n,r),u=(e,t)=>{let n=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4};return _n(n(e[t]),n(e[t+1]),n(e[t+2]))};for(let e=0;e<n*r*4;e+=4){let t=u(a,e),n=u(o,e),r=(t[0]-n[0])*6,i=Math.hypot(t[1]-n[1],t[2]-n[2])*12,s=(o[e]+o[e+1]+o[e+2])/3*.25;l.data[e]=Math.min(255,s+Math.max(0,r)*255),l.data[e+1]=Math.min(255,s+Math.min(1,i)*200),l.data[e+2]=Math.min(255,s+Math.max(0,-r)*255),l.data[e+3]=255}return c.putImageData(l,0,0),s.toDataURL(`image/png`)}function gn(e,t){let n=Math.round((t.naturalWidth||1456)/2),r=Math.round((t.naturalHeight||816)/2),i=e=>{let t=document.createElement(`canvas`);t.width=n,t.height=r;let i=t.getContext(`2d`);i.imageSmoothingQuality=`high`,i.drawImage(e,0,0,n,r);let a=i.getImageData(0,0,n,r).data,o=new Float32Array(n*r);for(let e=0;e<n*r;e++)o[e]=(.2126*a[e*4]+.7152*a[e*4+1]+.0722*a[e*4+2])/255;return o},a=e=>{let t=new Float32Array(n*r);for(let i=1;i<r-1;i++)for(let r=1;r<n-1;r++){let a=i*n+r,o=e[a-n+1]+2*e[a+1]+e[a+n+1]-e[a-n-1]-2*e[a-1]-e[a+n-1],s=e[a+n-1]+2*e[a+n]+e[a+n+1]-e[a-n-1]-2*e[a-n]-e[a-n+1];t[a]=Math.hypot(o,s)}let i=[];for(let e=0;e<t.length;e+=7)i.push(t[e]);i.sort((e,t)=>e-t);let a=Math.max(.12,i[Math.floor(i.length*.92)]),o=new Uint8Array(n*r);for(let e=0;e<t.length;e++)o[e]=+(t[e]>a);return o},o=(e,t)=>{let i=new Uint8Array(n*r);for(let a=0;a<r;a++)for(let r=0;r<n;r++){let o=0;for(let i=-t;i<=t&&!o;i++){let t=r+i;t>=0&&t<n&&(o=e[a*n+t])}i[a*n+r]=o}let a=new Uint8Array(n*r);for(let e=0;e<r;e++)for(let o=0;o<n;o++){let s=0;for(let a=-t;a<=t&&!s;a++){let t=e+a;t>=0&&t<r&&(s=i[t*n+o])}a[e*n+o]=s}return a},s=i(e),c=i(t),l=a(s),u=a(c),d=o(l,3),f=o(u,3),p=0,m=0,h=0,g=0;for(let e=0;e<n*r;e++)l[e]&&(p++,f[e]&&h++),u[e]&&(m++,d[e]&&g++);let _=p?h/p:0,v=m?g/m:0,y=_+v>0?2*_*v/(_+v):0,b=document.createElement(`canvas`);b.width=n,b.height=r;let x=b.getContext(`2d`),S=x.createImageData(n,r);for(let e=0;e<n*r;e++){let t=c[e]*70,n=l[e],r=u[e];S.data[e*4]=n&&r||r?255:n?60:t,S.data[e*4+1]=n&&r?255:r?70:n?220:t,S.data[e*4+2]=n&&r?255:r?60:n?255:t,S.data[e*4+3]=255}x.putImageData(S,0,0);let C=e=>Math.round(e*1e3)/10;return{f:C(y),p:C(_),r:C(v),image:b.toDataURL(`image/png`)}}function _n(e,t,n){let r=Math.cbrt(.4122214708*e+.5363325363*t+.0514459929*n),i=Math.cbrt(.2119034982*e+.6806995451*t+.1073969566*n),a=Math.cbrt(.0883024619*e+.2817188376*t+.6299787005*n);return[.2104542553*r+.793617785*i-.0040720468*a,1.9779984951*r-2.428592205*i+.4505937099*a,.0259040371*r+.7827607001*i-.808675766*a]}function vn(e,t,n=4,r=3){let i=Math.round(182*(t.naturalHeight||816)/(t.naturalWidth||1456)),a=e=>{let t=document.createElement(`canvas`);t.width=182,t.height=i;let n=t.getContext(`2d`);n.imageSmoothingQuality=`high`,n.drawImage(e,0,0,182,i);let r=n.getImageData(0,0,182,i).data,a=new Float32Array(182*i*3);for(let e=0;e<182*i;e++){let t=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4},n=t(r[e*4]),i=t(r[e*4+1]),o=t(r[e*4+2]),s=Math.cbrt(.4122214708*n+.5363325363*i+.0514459929*o),c=Math.cbrt(.2119034982*n+.6806995451*i+.1073969566*o),l=Math.cbrt(.0883024619*n+.2817188376*i+.6299787005*o);a[e*3]=.2104542553*s+.793617785*c-.0040720468*l,a[e*3+1]=1.9779984951*s-2.428592205*c+.4505937099*l,a[e*3+2]=.0259040371*s+.7827607001*c-.808675766*l}return a},o=a(e),s=a(t),c=0,l=0,u=0,d=0,f=Array(n*r).fill(0),p=Array(n*r).fill(0),m=Array(n*r).fill(0);for(let e=0;e<i;e++)for(let t=0;t<182;t++){let a=(e*182+t)*3,h=Math.hypot(o[a]-s[a],o[a+1]-s[a+1],o[a+2]-s[a+2]);c+=h,l+=o[a]-s[a],u+=Math.hypot(o[a+1],o[a+2]),d+=Math.hypot(s[a+1],s[a+2]);let g=Math.min(r-1,Math.floor(e/i*r))*n+Math.min(n-1,Math.floor(t/182*n));f[g]+=h,p[g]+=o[a]-s[a],m[g]++}let h=182*i,g=e=>Math.round(e*1e3)/10;return{dE:g(c/h),dL:g(l/h),chromaRender:g(u/h),chromaRef:g(d/h),gridDE:f.map((e,t)=>g(e/m[t])),gridDL:p.map((e,t)=>g(e/m[t]))}}var yn=`modulepreload`,bn=function(e){return`/pl-vs/lab/`+e},xn={},Z=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=bn(t,n),t=s(t),t in xn)return;xn[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:yn,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},Sn=[{id:`corridor`,label:`病院の病棟（建築版）`,load:async()=>(await Z(async()=>{let{corridor:e}=await import(`./corridor-CZYCi_cO.js`);return{corridor:e}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10]))).corridor},{id:`station`,label:`霧の駅（建築版）`,load:async()=>(await Z(async()=>{let{station:e}=await import(`./station-CdHZVZiD.js`);return{station:e}},__vite__mapDeps([11,1,5,2,3,12,13]))).station},{id:`pool`,label:`屋内プール（建築版）`,load:async()=>(await Z(async()=>{let{pool:e}=await import(`./pool-D7szzBA5.js`);return{pool:e}},__vite__mapDeps([14,1,2,3,12,6,8,15,5,16,17]))).pool},{id:`alley`,label:`校舎の間の通路（建築版）`,load:async()=>(await Z(async()=>{let{alley:e}=await import(`./alley-BgvYekFK.js`);return{alley:e}},__vite__mapDeps([18,1,5,2,3,4,19,20,21]))).alley},{id:`pastel`,label:`淡色の廊下（建築版）`,load:async()=>(await Z(async()=>{let{pastel:e}=await import(`./pastel-DP0wv-vj.js`);return{pastel:e}},__vite__mapDeps([22,1,2,4,5,19,12,6,8,23,3]))).pastel},{id:`waterpark`,label:`地下のウォーターパーク`,load:async()=>(await Z(async()=>{let{waterpark:e}=await import(`./waterpark-CqbxXtak.js`);return{waterpark:e}},__vite__mapDeps([24,1,5,2,3,25,12,16,26,27]))).waterpark},{id:`classroom`,label:`海の見える教室`,load:async()=>(await Z(async()=>{let{classroom:e}=await import(`./classroom-DeaRuF3j.js`);return{classroom:e}},__vite__mapDeps([28,1,5,2,3,25,29,12]))).classroom},{id:`serverroom`,label:`サーバールーム`,load:async()=>(await Z(async()=>{let{serverroom:e}=await import(`./serverroom-krFNK-Yb.js`);return{serverroom:e}},__vite__mapDeps([30,1,2,3,25,12,31,5]))).serverroom},{id:`whiteroom`,label:`白いコンクリートの中庭`,load:async()=>(await Z(async()=>{let{whiteroom:e}=await import(`./whiteroom-D3boS6uy.js`);return{whiteroom:e}},__vite__mapDeps([32,1,5,2,3,12,33,25]))).whiteroom},{id:`squareroom`,label:`立方体の大広間と水路`,load:async()=>(await Z(async()=>{let{squareroom:e}=await import(`./squareroom-cVhD_fh3.js`);return{squareroom:e}},__vite__mapDeps([34,1,2,3,25,12,35]))).squareroom},{id:`planetarium`,label:`プラネタリウム`,load:async()=>(await Z(async()=>{let{planetarium:e}=await import(`./planetarium-3p28cZTH.js`);return{planetarium:e}},__vite__mapDeps([36,1,5,2,3,37,25]))).planetarium}];function Cn(e,t,n,r,i){let a=[];for(let o=0;o<=i;o++){let s=n+(r-n)*o/i;a.push([e[0]+Math.cos(s)*t,e[1]+Math.sin(s)*t])}return a}function wn(e,t,n,r,i=.28,a=.155,o=`#c9cfcc`){let s=a/2,c=[[i*.62,-s*.9],[i*.9,-s],[i,-s*.7],[i,s*.7],[i*.9,s],[i*.62,s*.9]];e.lathe(`#1f2626`,c,[n-r*s,i,t],{axis:`x`,seg:22}),e.cyl(o,[n-r*.01,i,t],i*.6,.03,{axis:`x`,seg:20}),e.cyl(`#7b8683`,[n+r*.008,i,t],i*.18,.02,{axis:`x`,seg:12});for(let a=0;a<4;a++){let o=a/4*Math.PI*2+.4;e.cyl(`#3a4444`,[n+r*.006,i+Math.sin(o)*i*.38,t+Math.cos(o)*i*.38],i*.09,.02,{axis:`x`,seg:8})}}function Tn(e,t,n,r,i,a,o,s,c){let l=r[0]-n[0],u=r[1]-n[1],d=Math.hypot(l,u),f=u/d,p=-l/d,m=o,h=o+s;e.extrude(t,[[n[0]+f*m,n[1]+p*m],[r[0]+f*m,r[1]+p*m],[r[0]+f*h,r[1]+p*h],[n[0]+f*h,n[1]+p*h]],`zy`,i,a,{kind:c,shadow:!1})}function En(e,t={}){let n=t.body??`#e7ebe6`,r=t.glass??`#2b3e45`,i=t.trim??`#2a3233`,a=(t.type??`wagon`)===`wagon`,o=1.47,s=3.39,c=.28,l=1.13,u=-1.12,d=.34,f=.2,p=a?1.66:1.5,m=a?1.02:.95,h=a?.98:.86,g=a?[1.2,1.02]:[1.05,.92],_=a?[.62,p-.04]:[.15,p-.04],v=[[-1.635,f]],y=Math.asin(-.08000000000000002/d);v.push(...Cn([u,c],d,Math.PI-y,y,12)),v.push(...Cn([l,c],d,Math.PI-y,y,12)),v.push([s/2-.06,.22],[s/2,.36],[s/2,.62],[s/2-.05,h-.08],[s/2-.3,h],g,_,[_[0]-.2,p],[-1.475,p],[-1.635,p-.07],[-3.39/2,m-.05],[-3.39/2,.42],[-1.655,.23]),e.extrude(n,v,`zy`,-1.47/2,o/2,{bevel:.05,collide:!0});for(let t of[l,u])e.box(`#141c1c`,[-.595,f,t-d],[o/2-.14,.5860000000000001,t+d],{shadow:!1});Tn(e,r,g,_,-.645,o/2-.09,.004,.006,`solid`),e.box(r,[-.615,m+.08,-3.39/2-.006],[o/2-.12,p-.12,-1.685],{shadow:!1});let b=(t,n,i=0)=>{for(let a of[-1,1]){let o=a*.737;e.extrude(r,[[t,m+.03],[n,m+.03],[n-i,p-.1],[t,p-.1]],`zy`,Math.min(o,o+a*.006),Math.max(o,o+a*.006),{shadow:!1})}},x=_[0];b(.12,g[0]-.08,g[0]-.08-x-.05),b(-.98,0),b(-3.39/2+.18,-1.08);for(let t of[-1,1]){let r=t*.738;for(let t of[.06,-1.03])e.box(i,[r-.003,.32,t-.006],[r+.003,p-.08,t+.006],{shadow:!1});for(let n of[-.05,-.92])e.box(i,[r-t*.004-.006,m-.12,n-.07],[r+t*.004+.006,m-.09,n+.07],{r:.008,shadow:!1});e.box(i,[r-.006,m+.01,-3.39/2+.15],[r+.006,m+.035,g[0]-.06],{shadow:!1});let a=e.sub([t*.815,m+.06,g[0]-.22]);a.box(i,[-.07,0,-.03],[.07,.03,.03],{r:.01}),a.box(n,[-.08,.03,-.05],[.08,.15,.04],{r:.03})}e.box(i,[-.715,.24,s/2-.06],[o/2-.02,.46,1.73],{r:.05}),e.box(`#1a2222`,[-.36,.52,s/2-.02],[.36,.66,1.707],{r:.02});for(let t of[-1,1])e.box(`#eef3ea`,[t*.48-.16,.66,s/2-.12],[t*.48+.16,.8,1.7],{r:.035}),e.box(`#e3a54a`,[t*.62-.05,.6,s/2-.05],[t*.62+.05,.64,1.707],{r:.01});e.box(`#f4f4ee`,[-.165,.29,1.73],[.165,.455,1.74],{r:.008}),e.box(`#5a7a52`,[-.15,.33,1.74],[.15,.42,1.743],{shadow:!1});for(let t of[-1,1]){let n=[g[0]-.03,g[1]+.02],r=t*.08;e.rod(i,[r,n[1]+.02,n[0]-.04],[r+t*.5,n[1]+.06,n[0]-.08],.008)}e.box(i,[-.715,.24,-3.39/2-.035],[o/2-.02,.48,-1.635],{r:.05});for(let t of[-1,1])e.box(`#c8463f`,[t*(o/2-.07)-.05,.62,-3.39/2-.01],[t*(o/2-.07)+.05,m+(a?.15:.02),-1.665],{r:.02});e.box(`#f4f4ee`,[-.165,.5,-3.39/2-.02],[.165,.665,-3.39/2-.01],{r:.008}),e.box(n,[-.635,p-.1,-3.39/2-.05],[o/2-.1,p-.04,-1.595],{r:.02});for(let t of[l,u])for(let n of[-1,1])wn(e,t,n*(o/2-.03),n,c)}function Dn(e,t={}){let n=t.body??`#eef0ea`,r=t.glass??`#2b3e45`,i=t.trim??`#2a3233`,a=1.47,o=3.39,s=.27,c=1.2,l=.33,u=.22,d=Math.asin(-.05000000000000002/l),f=[[.42,u],...Cn([c,s],l,Math.PI-d,d,12),[o/2-.04,.24],[o/2,.38],[o/2,.82],[o/2-.06,1],[o/2-.16,1.7],[o/2-.3,1.82],[.5,1.82],[.42,1.72]];e.extrude(n,f,`zy`,-1.47/2,a/2,{bevel:.04,collide:!0}),e.box(`#141c1c`,[-.595,u,.8699999999999999],[a/2-.14,.5670000000000001,1.53],{shadow:!1}),Tn(e,r,[o/2-.07,1.04],[o/2-.17,1.68],-.635,a/2-.1,.004,.006,`solid`);for(let t of[-1,1]){let a=t*.737;e.extrude(r,[[.62,1.08],[o/2-.2,1.08],[o/2-.26,1.7],[.62,1.7]],`zy`,Math.min(a,a+t*.006),Math.max(a,a+t*.006),{shadow:!1}),e.box(i,[t*.738-.003,.37,.58],[t*.738+.003,1.75,.59],{shadow:!1});let s=e.sub([t*.815,1.1,o/2-.3]);s.box(i,[-.07,0,-.03],[.07,.03,.03],{r:.01}),s.box(n,[-.08,.03,-.05],[.08,.15,.04],{r:.03})}e.box(r,[-1.47/2+.2,1.25,.415],[a/2-.2,1.65,.43],{shadow:!1}),e.box(i,[-.715,.24,o/2-.05],[a/2-.02,.44,1.73],{r:.04});for(let t of[-1,1])e.box(`#eef3ea`,[t*.5-.13,.62,o/2-.08],[t*.5+.13,.76,1.7],{r:.03});e.box(`#1a2222`,[-.3,.5,o/2-.02],[.3,.6,1.705],{r:.015}),e.box(`#f4f4ee`,[-.165,.27,1.73],[.165,.435,1.74],{r:.008});let p=-3.39/2,m=.4,h=.66;e.box(i,[-.635,.3,-1.595],[a/2-.1,.62,m],{}),e.box(n,[-1.47/2,.62,p],[a/2,h,m],{r:.01,collide:!0});for(let t of[-1,1]){e.box(n,[t*a/2-.02,h,-1.675],[t*a/2+.02,.96,.38],{r:.008});for(let n of[-1.0950000000000002,-.44500000000000006])e.box(i,[t*.755-.004,.68,n-.03],[t*.755+.004,.9400000000000001,n+.03],{shadow:!1})}e.box(n,[-.715,h,p],[a/2-.02,.96,-1.655],{r:.008}),e.box(`#c8463f`,[-1.47/2+.05,.42,-1.715],[-.485,.56,-1.675],{r:.01}),e.box(`#c8463f`,[a/2-.25,.42,-1.715],[a/2-.05,.56,-1.675],{r:.01});let g=1.86;for(let t of[-.675,a/2-.06])e.rod(i,[t,h,.36000000000000004],[t,g,.36000000000000004],.022);e.rod(i,[-.675,g,.36000000000000004],[a/2-.06,g,.36000000000000004],.022);for(let t=1;t<7;t++)e.rod(i,[-.675+t*1.35/7,.96,.36000000000000004],[-.675+t*1.35/7,g,.36000000000000004],.01);for(let t of[-1,1])e.box(i,[t*(a/2-.08)-.08,u,-1.35],[t*(a/2-.08)+.08,.62,-.69],{});for(let t of[c,-1.02])for(let n of[-1,1])wn(e,t,n*(a/2-.03),n,s)}function On(e,t={}){let n=t.detail===`low`,r=t.frame??`#cfd9d6`,i=`#1f2626`,a=`#b7c1bd`,o=.33,s=-.52,c=.55;for(let t of[s,c]){e.torus(i,[0,o,t],.312,.02,{axis:`x`,seg:n?16:28}),e.torus(a,[0,o,t],.28500000000000003,.008,{axis:`x`,seg:n?12:24});for(let r=0;r<(n?0:12);r++){let n=r/12*Math.PI*2;e.rod(a,[0,o,t],[0,o+Math.sin(n)*.28,t+Math.cos(n)*.28],.0025,{radial:4,shadow:!1})}e.cyl(a,[0,o,t],.03,.09,{axis:`x`,seg:10}),e.torus(r,[0,o,t],.35500000000000004,.018,{axis:`x`,seg:18,arc:Math.PI*.95})}let l=[0,.3,-.05],u=[0,.82,-.28],d=[0,.86,.38],f=[0,.66,.43];e.tube(r,[f,[0,.42,.22],[0,.3,.05],l],.02,{seg:18}),e.rod(r,l,u,.018),e.rod(r,l,[0,o,s],.012),e.rod(r,u,[0,o,s],.011),e.rod(r,d,f,.022),e.rod(a,f,[0,o,c],.013),e.rod(a,d,[0,1.02,.36],.012),e.tube(a,[[-.3,1.02,.22],[-.2,1.03,.33],[0,1.03,.36],[.2,1.03,.33],[.3,1.02,.22]],.011,{seg:16});for(let t of[-1,1])e.cyl(i,[t*.32,1.02,.21],.016,.1,{axis:`z`,seg:8});e.rod(a,u,[0,.95,-.31],.012),e.box(i,[-.08,.95,-.42],[.08,1,-.18],{r:.025}),e.box(r,[.03,.24,-.58],[.05,.38,.06],{r:.012}),e.cyl(a,[.06,.3,-.05],.09,.02,{axis:`x`,seg:16});for(let t of[-1,1])e.box(i,[t*.14-.05,.3+t*.12,-.08],[t*.14+.05,.32+t*.12,-.05+.03],{r:.005});let p=e.sub([0,.86,.62]),m=t.basket??a;for(let e of[0,.22])p.rod(m,[-.17,e,-.12],[.17,e,-.12],.005,{radial:4}),p.rod(m,[-.17,e,.14],[.17,e,.14],.005,{radial:4}),p.rod(m,[-.17,e,-.12],[-.17,e,.14],.005,{radial:4}),p.rod(m,[.17,e,-.12],[.17,e,.14],.005,{radial:4});for(let e=0;e<=(n?2:6);e++){let t=-.17+e*.34/(n?2:6);p.rod(m,[t,0,.14],[t,.22,.14],.004,{radial:4,shadow:!1}),p.rod(m,[t,0,-.12],[t,.22,-.12],.004,{radial:4,shadow:!1})}p.box(m,[-.17,-.005,-.12],[.17,.005,.14],{shadow:!1}),e.box(a,[-.08,.72,-.78],[.08,.74,-.42],{});for(let t of[-1,1])e.rod(a,[t*.08,.72,-.5],[t*.06,o,s],.006);if(t.standing!==!1)for(let t of[-1,1])e.rod(a,[t*.06,.31,-.47000000000000003],[t*.16,0,-.42000000000000004],.008);e.collide([-.32,0,-.9],[.32,1.05,.9])}var kn=[{id:`vending`,label:`飲料の自動販売機`,size:[1,1.85,.75],build:e=>we(e)},{id:`vending-snack`,label:`お菓子の自動販売機`,size:[1,1.85,.75],build:e=>we(e,{body:`#2f4a4c`,accent:`#d9a43a`,goods:`snack`})},{id:`ticket`,label:`券売機`,size:[.62,1.6,.6],build:e=>ye(e)},{id:`cooler`,label:`冷水機`,size:[.42,1.02,.42],build:e=>he(e)},{id:`car`,label:`軽自動車（ワゴン）`,size:[1.5,1.7,3.4],build:e=>En(e,{body:`#e7ebe6`})},{id:`car-hatch`,label:`軽自動車（低い型）`,size:[1.5,1.55,3.4],build:e=>En(e,{type:`hatch`,body:`#9fb7c0`})},{id:`truck`,label:`軽トラック`,size:[1.5,1.9,3.4],build:e=>Dn(e)},{id:`bicycle`,label:`自転車`,size:[.7,1.1,1.8],build:e=>On(e)},{id:`shelf-store`,label:`棚（段ボール・収納箱）`,size:[1.2,1.8,.45],build:e=>xe(e,{load:[`cardboard`,`bins`,`cardboard`,`cardboard`]})},{id:`shelf-office`,label:`棚（ファイル・紙・瓶）`,size:[1.2,1.8,.45],build:e=>xe(e,{load:[`paper`,`binders`,`binders`,`bottles`]})},{id:`shelf-linen`,label:`棚（リネン・タオル）`,size:[1.2,1.8,.45],build:e=>xe(e,{load:`linen`})},{id:`boxes`,label:`積んだ段ボール`,size:[.7,1,.6],build:e=>Ce(e)},{id:`bench-slat`,label:`ベンチ（板）`,size:[1.8,.45,.45],build:e=>ge(e)},{id:`bench-seats`,label:`待合いの椅子`,size:[2,.9,.55],build:e=>ge(e,{kind:`seats`,w:2})},{id:`chair-stack`,label:`椅子（積み重ね）`,size:[.5,.9,.5],build:e=>Se(e)},{id:`chair-office`,label:`事務椅子`,size:[.6,1.1,.6],build:e=>Se(e,{kind:`office`})},{id:`plant`,label:`鉢植え`,size:[.6,1.1,.6],build:e=>ve(e)},{id:`bin`,label:`ごみ箱`,size:[.45,.75,.45],build:e=>_e(e)},{id:`recycle`,label:`分別のごみ箱`,size:[1.1,.9,.45],build:e=>_e(e,{kind:`recycle`})},{id:`extinguisher`,label:`消火器`,size:[.3,.65,.3],build:e=>be(e)}],An=Object.assign({"../arch/alley/props/gallery.ts":()=>Z(()=>import(`./gallery-Co2SJir4.js`),__vite__mapDeps([38,3,1,20,19,5,2])),"../arch/classroom/props/gallery.ts":()=>Z(()=>import(`./gallery-Cn1CUK26.js`),__vite__mapDeps([39,3,1,29,2])),"../arch/corridor/props/gallery.ts":()=>Z(()=>import(`./gallery-BSxDKi7L.js`),__vite__mapDeps([40,3,1,10,6,7,2])),"../arch/pastel/props/gallery.ts":()=>Z(()=>import(`./gallery-WMyeZJUR.js`),__vite__mapDeps([41,23,1,2,3,4,5,19])),"../arch/planetarium/props/gallery.ts":()=>Z(()=>import(`./gallery-BkGSW9yk.js`),__vite__mapDeps([42,1,3,37,5,2,25])),"../arch/pool/props/gallery.ts":()=>Z(()=>import(`./gallery-DiPKfFBJ.js`),__vite__mapDeps([43,16,1,3,17])),"../arch/serverroom/props/gallery.ts":()=>Z(()=>import(`./gallery-CWKW_5mW.js`),__vite__mapDeps([44,3,1,31,5,2,12])),"../arch/squareroom/props/gallery.ts":()=>Z(()=>import(`./gallery-DWzNI0cn.js`),__vite__mapDeps([45,3,1,35])),"../arch/station/props/gallery.ts":()=>Z(()=>import(`./gallery-CCDi_nTr.js`),__vite__mapDeps([46,1,3,13,5,2])),"../arch/waterpark/props/gallery.ts":()=>Z(()=>import(`./gallery-DZxF5t2_.js`),__vite__mapDeps([47,16,1,3,26,27])),"../arch/whiteroom/props/gallery.ts":()=>Z(()=>import(`./gallery-BuuCOyOE.js`),__vite__mapDeps([48,1,3,33,2,25,12]))}),jn=[{id:`common`,label:`共通の小物`,load:async()=>Mn(`common`,{label:`共通の小物`,styleFrom:`corridor`,entries:kn})},...Object.keys(An).map(e=>{let t=e.split(`/`)[2];return{id:t,label:`${t} の小物`,load:async()=>Mn(t,(await An[e]()).gallery())}})];async function Mn(e,t){let r=await(Sn.find(e=>e.id===t.styleFrom)??Sn[0]).load(),i=structuredClone(r.style);i.fog.density*=.15,i.shadowQuant=0;let a=[],s=0;for(let e of t.entries)a.push(s+e.size[0]/2),s+=e.size[0]+1.6;let c=[];t.entries.forEach((e,t)=>{let[n,r,i]=e.size,o=Math.max(n,r*.8,i)*.9+.9,s=Math.min(r*.6,1.2),l=.6,u=a[t]+Math.sin(l)*o,d=Math.cos(l)*o,f=Math.max(.9,Math.min(1.6,r+.3));c.push({label:`${e.label}（近く）`,eye:[u,f,d],yaw:Math.atan2(u-a[t],d),pitch:Math.atan2(s-f,o),fov:50});let p=-.26,m=Math.max(4,o*1.8),h=a[t]+Math.sin(p)*m,g=Math.cos(p)*m;c.push({label:`${e.label}（${m.toFixed(0)} m）`,eye:[h,1.6,g],yaw:Math.atan2(h-a[t],g),pitch:Math.atan2(s-1.6,m),fov:50})});let l={id:`gallery-${e}`,title:`小物の見本帳（${t.label}）`,typology:`小物を並べて近くから確かめる見本帳`,spaces:[{id:`hall`,label:`見本帳`,kind:`hall`,rect:[-4,-6,s+4,12],floor:0,ceiling:8}],openings:[],tour:c,notes:[]};return{id:e,label:`小物の見本帳: ${t.label}`,plan:l,style:i,views:[],sky:!1,build(e){let r=new ee(e);t.setup?.(e);let i=t.mats?t.mats(e):pe(e),l=i.get(t.floor??`#9db0a8`),u=i.get(t.wall??`#c9d6cf`);r.boxMM(l,[-6,-.2,-8],[s+6,0,14],{collide:!0,shadow:`receive`}),r.boxMM(u,[-6,0,-8.2],[s+6,6,-8],{shadow:`receive`});let d=Te(r,e);t.entries.forEach((e,t)=>e.build(me.at(d,i,[a[t],0,0],0,1e3+t*17))),r.finalize();let f=new o(16777215,Math.PI*.9);f.position.set(s/2+8,14,10),f.target.position.set(s/2,0,0),f.castShadow=!0,f.shadow.mapSize.set(4096,4096);let p=Math.max(12,s/2+6);Object.assign(f.shadow.camera,{left:-p,right:p,top:p,bottom:-p,near:1,far:60}),f.shadow.camera.updateProjectionMatrix(),f.shadow.bias=-3e-4,f.shadow.normalBias=.02,r.root.add(f,f.target,new n(16777215,10135714,Math.PI*.55)),e.setSun(f);let m=c[0]?.eye??[0,1.6,4];return{root:r.root,spawn:{pos:[m[0],0,m[2]],yaw:c[0]?.yaw??0},staticShadows:!0}}}}var Nn=[{id:`station`,label:`霧の駅`,load:async()=>(await Z(async()=>{let{station:e}=await import(`./station-BwpgeSLo.js`);return{station:e}},__vite__mapDeps([49,1,5,2]))).station},{id:`pool`,label:`屋内プール`,load:async()=>(await Z(async()=>{let{pool:e}=await import(`./pool-Cqo-m9ra.js`);return{pool:e}},__vite__mapDeps([50,1,5,2,15]))).pool},{id:`corridor`,label:`病院の廊下`,load:async()=>(await Z(async()=>{let{corridor:e}=await import(`./corridor-iT-fWHMY.js`);return{corridor:e}},__vite__mapDeps([51,1,2,6,7,9,4,5,8]))).corridor},{id:`pastel`,label:`淡色の廊下`,load:async()=>(await Z(async()=>{let{pastel:e}=await import(`./pastel-DP3CZazR.js`);return{pastel:e}},__vite__mapDeps([52,1,2,19,5]))).pastel},{id:`alley`,label:`校舎の間の通路`,load:async()=>(await Z(async()=>{let{alley:e}=await import(`./alley-D6lSSOEd.js`);return{alley:e}},__vite__mapDeps([53,1,2,19,5,21]))).alley},{id:`test`,label:`基盤の確認`,load:async()=>(await Z(async()=>{let{test:e}=await import(`./test-D9OttGyK.js`);return{test:e}},__vite__mapDeps([54,1,2]))).test}],Pn={off:`オフ`,clean:`クリーン`,homeVideo:`ホームビデオ`,tape:`テープ（走査線・揺れ）`},Fn=class{film;el;preset;vhs;vhsOut;keep;keepOut;handheld;handheldOut;lag;hold;rec;ae;awb;constructor(e,t){this.film=e,this.el=document.createElement(`details`),this.el.className=`film`,this.el.open=!0,this.el.innerHTML=`
      <summary>カメラ効果（VHS）</summary>
      <label>描画効果 <select data-f="preset"></select></label>
      <label>VHS 効果 <input data-f="vhs" type="range" min="0" max="2" step="0.05"><span data-o="vhs"></span></label>
      <label>元の色を残す <input data-f="keep" type="range" min="0" max="1" step="0.05"><span data-o="keep"></span></label>
      <label>手持ち感 <input data-f="handheld" type="range" min="0" max="1" step="0.05"><span data-o="handheld"></span></label>
      <label>表示 fps <select data-f="hold">
        <option value="off">プリセットに従う</option><option value="30">30 fps</option><option value="24">24 fps</option>
      </select></label>
      <div class="row">
        <label><input type="checkbox" data-f="lag">視線の遅れ</label>
        <label><input type="checkbox" data-f="rec">REC 表示</label>
        <label><input type="checkbox" data-f="ae">露出の追従</label>
        <label><input type="checkbox" data-f="awb">色の追従</label>
      </div>
      <div class="note">オフ以外で、手持ち感・視線の遅れ・REC も入る。露出・色の追従はゲーム向けの値なので、ここでは既定で切っている。「元の色を残す」は VHS の色調整で消える色を元の映像から戻す（走査線・揺れ・色のにじみ・ノイズは残る）</div>`,t.appendChild(this.el);let n=e=>this.el.querySelector(`[data-f="${e}"]`),r=e=>this.el.querySelector(`[data-o="${e}"]`);this.preset=n(`preset`),this.vhs=n(`vhs`),this.vhsOut=r(`vhs`),this.keep=n(`keep`),this.keepOut=r(`keep`),this.handheld=n(`handheld`),this.handheldOut=r(`handheld`),this.lag=n(`lag`),this.hold=n(`hold`),this.rec=n(`rec`),this.ae=n(`ae`),this.awb=n(`awb`);for(let e of G)this.preset.add(new Option(Pn[e],e));let i=e=>e.target.blur();this.preset.onchange=t=>{e.set({preset:this.preset.value}),i(t)},this.vhs.oninput=()=>e.set({vhsStrength:Number(this.vhs.value)}),this.keep.oninput=()=>e.set({colorKeep:Number(this.keep.value)}),this.handheld.oninput=()=>e.set({handheld:Number(this.handheld.value)}),this.hold.onchange=t=>{e.set({frameHold:this.hold.value}),i(t)},this.lag.onchange=t=>{e.set({cameraLag:this.lag.checked}),i(t)},this.rec.onchange=t=>{e.set({rec:this.rec.checked}),i(t)},this.ae.onchange=t=>{e.set({autoExposure:this.ae.checked}),i(t)},this.awb.onchange=t=>{e.set({autoWhiteBalance:this.awb.checked}),i(t)};for(let e of[this.vhs,this.keep,this.handheld])e.addEventListener(`change`,i);window.addEventListener(`keydown`,t=>{let n=t.target;if(n.tagName!==`INPUT`&&n.tagName!==`SELECT`&&t.code===`KeyK`){let t=G.indexOf(e.settings.preset);e.set({preset:G[(t+1)%G.length]})}}),this.sync()}sync(){let e=this.film.settings;this.preset.value=e.preset,this.vhs.value=String(e.vhsStrength),this.vhsOut.textContent=e.vhsStrength<=0?`オフ`:`${Math.round(e.vhsStrength*100)}%`,this.keep.value=String(e.colorKeep),this.keepOut.textContent=e.colorKeep<=0?`オフ（ゲームと同じ）`:`${Math.round(e.colorKeep*100)}%`,this.handheld.value=String(e.handheld),this.handheldOut.textContent=e.handheld<=0?`オフ`:`${Math.round(e.handheld*100)}%`,this.hold.value=e.frameHold,this.lag.checked=e.cameraLag,this.rec.checked=e.rec,this.ae.checked=e.autoExposure,this.awb.checked=e.autoWhiteBalance;let t=e.preset===`off`;for(let e of[this.vhs,this.keep,this.handheld,this.hold,this.lag,this.rec,this.ae,this.awb])e.disabled=t}},In=[`off`,`overlay`,`swipe`,`diff`,`ref`],Ln={off:`なし`,overlay:`重ねる`,swipe:`左右で切る`,diff:`差分`,ref:`参考画像だけ`},Rn=[`完成`,`後処理なし`,`法線`,`ID・線の重み`,`深度`,`線`],zn=class{app;el;refImg;sceneSel;viewSel;modeSel;opacity;debugSel;info;help;filmPanel;minimap;minimapOn=!1;mode=`off`;swipeX=.5;refId=``;constructor(e,t){this.app=e,this.refImg=document.createElement(`img`),this.refImg.className=`ref`,t.appendChild(this.refImg),this.el=document.createElement(`div`),this.el.className=`panel`,this.el.innerHTML=`
      <div class="title">見た目の検証ステージ</div>
      <div class="variant"></div>
      <label>場面 <select data-k="scene"></select></label>
      <label>視点 <select data-k="view"></select></label>
      <label>比較 <select data-k="mode"></select></label>
      <label>濃さ <input data-k="opacity" type="range" min="0" max="1" step="0.01" value="0.5"></label>
      <div class="row">
        <label><input type="checkbox" data-p="kuwahara" checked>クワハラ</label>
        <label><input type="checkbox" data-p="lines" checked>線</label>
        <label><input type="checkbox" data-p="bloom" checked>にじみ</label>
        <label><input type="checkbox" data-p="grade" checked>色調整</label>
      </div>
      <label>表示 <select data-k="debug"></select></label>
      <div class="info"></div>
      <button data-k="copy">カメラの値をコピー</button>`,t.appendChild(this.el);let n=e.variant===`arch`,r=e.variant===`props`;this.el.querySelector(`.title`).textContent=r?`小物の見本帳`:n?`見た目の検証ステージ（建築版）`:`見た目の検証ステージ`,this.el.querySelector(`.variant`).innerHTML=r?`小物を並べて近くから確かめる ・ <a href="arch.html">建築版へ</a> ・ [ ] で次の物`:n?`間取り図から作った版 ・ <a href="index.html">元の版へ</a> ・ <a href="props.html">小物の見本帳</a> ・ M 間取り図`:`<a href="arch.html">建築版（間取り図から作った版）へ</a>`,this.minimap=document.createElement(`canvas`),this.minimap.className=`minimap`,t.appendChild(this.minimap),setInterval(()=>this.drawMinimap(),100),this.filmPanel=new Fn(e.film,this.el),this.help=document.createElement(`div`),this.help.className=`help`,this.help.innerHTML=`クリックで視点操作 ・ WASD 移動 ・ Shift 走る ・ C しゃがむ ・ Space ジャンプ ・ F 飛行<br>1〜6 場面 ・ [ ] 視点 ・ V 比較 ・ G 表示 ・ K カメラ効果 ・ L 画面いっぱい ・ R 視点に戻る ・ H 隠す`,t.appendChild(this.help);let i=e=>this.el.querySelector(`[data-k="${e}"]`);this.sceneSel=i(`scene`),this.viewSel=i(`view`),this.modeSel=i(`mode`),this.opacity=i(`opacity`),this.debugSel=i(`debug`),this.info=this.el.querySelector(`.info`);for(let t of e.scenes)this.sceneSel.add(new Option(t.label,t.id));for(let e of In)this.modeSel.add(new Option(Ln[e],e));Rn.forEach((e,t)=>this.debugSel.add(new Option(e,String(t)))),this.sceneSel.onchange=()=>{e.load(this.sceneSel.value),this.sceneSel.blur()},this.viewSel.onchange=()=>{e.setView(this.viewSel.value||null),this.viewSel.blur()},this.modeSel.onchange=()=>{this.setMode(this.modeSel.value),this.modeSel.blur()},this.opacity.oninput=()=>this.updateRef(),this.debugSel.onchange=()=>{e.post.debug=Number(this.debugSel.value),this.debugSel.blur()},this.el.querySelectorAll(`[data-p]`).forEach(t=>{t.onchange=()=>{e.post.enable[t.dataset.p]=t.checked,t.blur()}}),i(`copy`).onclick=()=>{navigator.clipboard?.writeText(this.cameraText()),console.log(this.cameraText())},t.addEventListener(`mousemove`,t=>{if(this.mode!==`swipe`||e.input.locked)return;let n=e.renderer.domElement.getBoundingClientRect();this.swipeX=Math.min(1,Math.max(0,(t.clientX-n.left)/n.width)),this.updateRef()}),window.addEventListener(`keydown`,e=>this.key(e)),e.onChange=()=>this.sync(),this.sync(),setInterval(()=>this.tick(),250)}key(e){let t=e.target;if(t.tagName===`INPUT`||t.tagName===`SELECT`)return;let n=this.app,r=n.def?.views??[],i=r.findIndex(e=>e.id===(n.view?.id??this.refId));if(/^Digit[1-9]$/.test(e.code)){let t=n.scenes[Number(e.code.slice(5))-1];t&&n.load(t.id)}else if(e.code===`BracketRight`&&r.length)n.setView(r[(i+1)%r.length].id);else if(e.code===`BracketLeft`&&r.length)n.setView(r[(i-1+r.length)%r.length].id);else if(e.code===`KeyV`)this.setMode(In[(In.indexOf(this.mode)+1)%In.length]);else if(e.code===`KeyG`)n.post.debug=(n.post.debug+1)%Rn.length,this.debugSel.value=String(n.post.debug);else if(e.code===`KeyL`)n.letterbox=!n.letterbox,n.resize();else if(e.code===`KeyR`)this.refId?n.setView(this.refId):n.player.respawn();else if(e.code===`KeyM`)this.minimapOn=!this.minimapOn&&!!n.def?.plan,this.minimap.style.display=this.minimapOn?`block`:`none`;else if(e.code===`KeyH`){let e=this.el.style.display!==`none`;this.el.style.display=e?`none`:``,this.help.style.display=e?`none`:``}}setMode(e){this.mode=e,this.modeSel.value=e,this.updateRef()}sync(){let e=this.app;if(this.filmPanel?.sync(),e.def){this.sceneSel.value=e.def.id,this.viewSel.innerHTML=``,this.viewSel.add(new Option(`（自由に歩く）`,``));for(let t of e.def.views)this.viewSel.add(new Option(`${t.id}  ${t.label}`,t.id));e.view?this.refId=e.view.id:e.def.views.some(e=>e.id===this.refId)||(this.refId=e.def.views[0]?.id??``),this.viewSel.value=e.view?.id??``,this.updateRef()}}updateRef(){let e=this.refImg;if(this.mode===`off`||!this.refId){e.style.display=`none`;return}let t=`refs/${this.refId}.jpg`;e.src.endsWith(t)||(e.src=t),e.style.display=`block`,e.style.opacity=this.mode===`overlay`?this.opacity.value:`1`,e.style.mixBlendMode=this.mode===`diff`?`difference`:`normal`,e.style.clipPath=this.mode===`swipe`?`inset(0 0 0 ${(this.swipeX*100).toFixed(1)}%)`:`none`}drawMinimap(){let e=this.app.def?.plan;if(!this.minimapOn||!e){this.minimapOn&&!e&&(this.minimap.style.display=`none`);return}let t=this.app.player;ot(e,this.minimap,{compact:!0,px:340,views:(this.app.def?.views??[]).map(e=>({id:e.id,eye:e.eye,yaw:e.yaw,fov:e.fov})),player:{x:t.pos.x,z:t.pos.z,yaw:t.yaw}})}cameraText(){let e=this.app.player,t=this.app.camera,n=e=>e.toFixed(3);return`eye: [${n(t.position.x)}, ${n(t.position.y)}, ${n(t.position.z)}], yaw: ${n(e.yaw)}, pitch: ${n(e.pitch)}, fov: ${t.fov.toFixed(1)}`}tick(){let e=this.app,t=e.renderer.info.render;this.info.textContent=`${e.fps.toFixed(0)} fps ・ 描画 ${t.calls} 回 ・ ${(t.triangles/1e3).toFixed(0)}k 三角形\n${this.cameraText()}\n比較: ${this.refId||`-`}${e.player.fly?` ・ 飛行中`:``}`}},Q=new URLSearchParams(location.search),Bn=document.getElementById(`app`),Vn=Q.has(`capture`),Hn=/arch\.html$/.test(location.pathname),Un=/props\.html$/.test(location.pathname),Wn=Un?jn:Hn?Sn:Nn,$=new mn(Bn,Wn,{persistFilm:!Vn});$.variant=Un?`props`:Hn?`arch`:`v1`,Vn&&document.body.classList.add(`capture`);function Gn(){let e={};return $.scene.traverse(t=>{let n=t.material;if(n)for(let t of Array.isArray(n)?n:[n])e[t.name||t.uuid.slice(0,8)]=t}),e}window.__lab={app:$,capture:(e,t,n)=>$.capture(e,t,n),ready:!1,mats:Gn,setColors:(e,t)=>{let n=Gn()[e];return n?(Qe(n,$.style,t),!0):!1}};var Kn=Q.get(`view`),qn=Q.get(`scene`)??(Kn?Kn.replace(/-\d+$/,``):Wn[0].id);function Jn(){let e=Q.get(`set`);if(e){for(let t of e.split(e.includes(`;`)?`;`:`,`)){let e=t.indexOf(`=`),n=t.slice(0,e),r=t.slice(e+1),i=n.split(`.`),a=$.style;for(let e of i.slice(0,-1))a=a[e];let o=/^[[{]/.test(r)?JSON.parse(r):r===`true`?!0:r===`false`?!1:Number.isNaN(Number(r))?r:Number(r);a[i[i.length-1]]=o}$.setStyle($.style)}Q.get(`debug`)&&($.post.debug=Number(Q.get(`debug`)));let t=Q.get(`film`);t&&$.film.set({preset:t,...Q.get(`vhs`)?{vhsStrength:Number(Q.get(`vhs`))}:{},...Q.get(`keep`)?{colorKeep:Number(Q.get(`keep`))}:{},...Q.get(`handheld`)?{handheld:Number(Q.get(`handheld`))}:{},...Q.get(`hold`)?{frameHold:Q.get(`hold`)}:{},...Q.get(`ae`)?{autoExposure:Q.get(`ae`)===`1`}:{},...Q.get(`awb`)?{autoWhiteBalance:Q.get(`awb`)===`1`}:{}},!1)}async function Yn(){await $.load(qn,Kn??void 0),Jn();let e=Vn?null:new zn($,Bn);e&&Q.get(`compare`)&&e.setMode(Q.get(`compare`)),Vn?($.frozen=!0,$.player.bob=0,$.renderFrame()):$.start(),window.__lab.ready=!0}Yn().catch(e=>{console.error(e),window.__lab.error=String(e)});export{Qe as a,et as i,En as n,qe as o,Dn as r,Ee as s,On as t};