import{a as e,r as t,t as n}from"./main-CWXRxuAn.js";import{Ct as r,E as i,J as a,Ln as o,Rn as s,Y as c,_ as l,a as u,hn as d,on as f,v as p}from"./Style-DOuyqAVF.js";var m=[`px`,`nx`,`py`,`ny`,`pz`,`nz`];function h(e){let t=m.map(()=>new p(16711935));if(typeof e!=`object`||e instanceof p){for(let n of t)n.set(e);return t}let n=e,r=Object.values(n)[0];if(r!==void 0)for(let e of t)e.set(r);return m.forEach((e,r)=>{let i=e[1],a=n[e]??(i===`x`?n.x:i===`z`?n.z:void 0)??(i===`y`?void 0:n.side)??n.all;a!==void 0&&t[r].set(a)}),t}var g=null;function _(){if(g)return g;let e=new Uint8Array(262144),t=(e,t)=>{let n=new Float32Array(e*e),r=t*9301+49297;for(let e=0;e<n.length;e++)r=r*16807%2147483647,n[e]=r/2147483647;return n},n=(e,n,r)=>{let i=new Float32Array(65536),a=.5,o=0;for(let s=0;s<n;s++){let n=e<<s;if(n>256)break;let c=t(n,r+s*31),l=256/n;for(let e=0;e<256;e++){let t=e/l,r=Math.floor(t),o=t-r;o=o*o*(3-2*o);let s=r%n,u=(r+1)%n;for(let t=0;t<256;t++){let r=t/l,d=Math.floor(r),f=r-d;f=f*f*(3-2*f);let p=d%n,m=(d+1)%n,h=(c[s*n+p]*(1-f)+c[s*n+m]*f)*(1-o)+(c[u*n+p]*(1-f)+c[u*n+m]*f)*o;i[e*256+t]+=h*a}}o+=a,a*=.5}let s=1/0,c=-1/0;for(let e=0;e<i.length;e++)i[e]/=o,s=Math.min(s,i[e]),c=Math.max(c,i[e]);for(let e=0;e<i.length;e++)i[e]=(i[e]-s)/(c-s);return i},o=[n(4,3,11),n(4,3,23),n(8,6,37),n(16,4,53)];for(let t=0;t<65536;t++)for(let n=0;n<4;n++)e[t*4+n]=Math.round(o[n][t]*255);let s=new i(e,256,256,r);return s.wrapS=s.wrapT=f,s.magFilter=a,s.minFilter=c,s.generateMipmaps=!0,s.colorSpace=``,s.needsUpdate=!0,g=s,s}var v=4,y=`
#include <clipping_planes_pars_vertex>
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vUv;
varying vec3 vVN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  vVN = normalize(normalMatrix * normal);
  vUv = uv;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`,b=`
layout(location = 1) out highp vec4 gInfo;
#include <clipping_planes_pars_fragment>
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vUv;
varying vec3 vVN;
uniform sampler2D uNoise;
uniform vec3 uCol[6];
uniform vec3 uLow[6];
uniform vec4 uBand;      // 高さ, 縁の振れ幅, 縁のノイズの大きさ, 垂れ
uniform int uLayerCount;
uniform vec3 uLCol[24];
uniform vec4 uLA[${v}];   // scale, threshold, yGain, warp
uniform vec4 uLY[${v}];   // y0, y1, only(0 all,1 floor,2 wall,3 ceil), seed
uniform vec3 uLO[${v}];
uniform vec3 uLLin[${v}];
uniform vec3 uLAbs[${v}];
uniform vec4 uLS[${v}];
uniform float uLCov[${v}];
uniform float uLCovCh[${v}];
uniform sampler2D uCov;
uniform vec4 uCovRect;
uniform vec4 uGrid;      // 層の番号, 横, 縦, 幅
uniform vec3 uGridColor;
uniform sampler2D uMap;
uniform float uMapFace;
uniform float uLine;
uniform float uId;
uniform float uFogMul;
uniform float uLampLit;
${e}
${n}
${t}

int faceIndex(vec3 n) {
  vec3 a = abs(n);
  if (a.x >= a.y && a.x >= a.z) return n.x > 0.0 ? 0 : 1;
  if (a.y >= a.z) return n.y > 0.0 ? 2 : 3;
  return n.z > 0.0 ? 4 : 5;
}
// 面に沿った 2D 座標
vec2 faceUV(vec3 p, int f) {
  if (f <= 1) return vec2(p.z, p.y);
  if (f <= 3) return p.xz;
  return vec2(p.x, p.y);
}
// ねじった fbm（テクスチャ引き）。0〜1
float pnoise(vec2 p, float warp, float seed, float detail) {
  p += seed * vec2(17.31, 41.7);
  vec2 w = texture2D(uNoise, p * 0.043).rg - 0.5;
  vec2 q = p + w * 6.0 * warp;
  float n = texture2D(uNoise, q * 0.11).b;
  n += (texture2D(uNoise, q * 0.47 + 0.3).a - 0.5) * detail;
  if (detail > 0.3) n += (texture2D(uNoise, q * 1.9 + 0.7).a - 0.5) * (detail - 0.3);
  return n;
}

void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vWN);
  int f = faceIndex(n);
  vec3 col = uCol[f];
  vec2 fuv = faceUV(vWorld, f);
  // 腰壁
  if (uBand.x > -50.0 && f != 2 && f != 3) {
    float e = uBand.x;
    if (uBand.y > 0.0) {
      float along = f <= 1 ? vWorld.z : vWorld.x;
      float nz = texture2D(uNoise, vec2(along * uBand.z, 0.37)).b - 0.5;
      // 垂れ: 細い縦の筋
      float dr = texture2D(uNoise, vec2(along * uBand.z * 5.0, 0.71)).a;
      e += nz * uBand.y - smoothstep(0.55, 0.85, dr) * uBand.w * (0.5 + texture2D(uNoise, vec2(along * 9.0, 0.2)).b);
    }
    float w = fwidth(vWorld.y) * 0.75;
    col = mix(uLow[f], col, smoothstep(e - w, e + w, vWorld.y));
  }
  // 塗りの層
  float gridOn = 0.0;
  for (int i = 0; i < ${v}; i++) {
    if (i >= uLayerCount) break;
    vec4 A = uLA[i];
    vec4 Y = uLY[i];
    bool ok = Y.z < 0.5 || (Y.z < 1.5 ? f == 2 : (Y.z < 2.5 ? (f != 2 && f != 3) : f == 3));
    if (!ok) continue;
    float th = A.y;
    if (Y.y > Y.x) th += smoothstep(Y.x, Y.y, vWorld.y) * A.z;
    vec3 dp = vWorld - uLO[i];
    th += dot(dp, uLLin[i]) + dot(abs(dp), uLAbs[i]);
    if (uLCov[i] != 0.0) {
      vec2 cuv = (vWorld.xz - uCovRect.xy) / (uCovRect.zw - uCovRect.xy);
      vec4 cv = texture2D(uCov, cuv);
      int ch = uLCovCh[i] >= 0.0 ? int(uLCovCh[i] + 0.5) : i;
      th -= uLCov[i] * (ch == 0 ? cv.r : ch == 1 ? cv.g : ch == 2 ? cv.b : cv.a);
    }
    vec2 pp = fuv * uLS[i].xy * A.x;
    float v = pnoise(pp, A.w, Y.w, uLS[i].z);
    float aa = fwidth(v) * 0.7 + 1e-4;
    float k = smoothstep(th - aa, th + aa, v);
    col = mix(col, uLCol[i * 6 + f], k);
    if (float(i) == uGrid.x) gridOn = k;
  }
  if (gridOn > 0.0) {
    vec2 gp = fuv / uGrid.yz;
    vec2 gf = abs(fract(gp) - 0.5);
    vec2 gw = 0.5 - uGrid.w / uGrid.yz * 0.5;
    vec2 gaa = fwidth(gp) * 0.75;
    float gl = max(smoothstep(gw.x - gaa.x, gw.x + gaa.x, gf.x), smoothstep(gw.y - gaa.y, gw.y + gaa.y, gf.y));
    col = mix(col, uGridColor, gl * gridOn);
  }
  if (uMapFace >= 0.0 && float(f) == uMapFace) {
    vec4 m = texture2D(uMap, vUv);
    col = mix(col, m.rgb, m.a);
  }
  // 灯りの光だまり: 色を明るくする。光の縁はノイズでちぎって、塗りの光だまりにする
  if (uLampCount > 0.0 && uLampLit > 0.0) {
    vec3 lp = sl_lamps(vWorld, n, 1.0) * uLampParams.x;
    float ll = dot(lp, vec3(0.2126, 0.7152, 0.0722));
    if (ll > 1e-3) {
      // 段で明るくする（弱い灯りで壁に筋のまだらが出ないように、なめらかな分は少しだけ。壁は模様を大きく）
      float nz = pnoise(fuv * (f == 2 || f == 3 ? 1.3 : 0.55), 1.0, 3.0, 0.3) - 0.5;
      float edge = smoothstep(0.18, 0.22, ll + nz * 0.12);
      col *= 1.0 + lp * (0.12 + 0.88 * edge) * uLampLit;
    }
  }
#ifndef PAINT_NOFOG
  col = mix(col, sl_applyFog(col, vWorld, cameraPosition), uFogMul);
#endif
  gl_FragColor = vec4(col, 1.0);
  gInfo = vec4(normalize(vVN).xy * 0.5 + 0.5, uId, uLine);
}`,x=0;function S(e){let t=e.layers??[];if(t.length>v)throw Error(`paint: too many layers`);let n=[],r=[],i=[],a=[],c=[],l=[],f=[],g=[],S=[];for(let u=0;u<v;u++){let d=t[u];n.push(...h(d?.color??16777215)),r.push(new s(d?.scale??1,d?.threshold??2,d?.yGain??0,d?.warp??1));let p=d?.only===`floor`?1:d?.only===`wall`?2:d?.only===`ceil`?3:0;i.push(new s(d?.yRange?.[0]??0,d?.yRange?.[1]??0,p,d?.seed??u*1.7)),a.push(new o(...d?.origin??[0,0,0])),c.push(new o(...d?.linear??[0,0,0])),l.push(new o(...d?.abs??[0,0,0])),f.push(new s(...d?.stretch??[1,1],d?.detail??.22,0)),g.push(e.cov?d?.cov??0:0),S.push(d?.covChannel??-1)}let C=e.mapFace?m.indexOf(e.mapFace):-1;return new d({uniforms:{...u,uNoise:{value:_()},uCol:{value:h(e.color)},uLow:{value:h(e.band?.color??e.color)},uBand:{value:new s(e.band?.y??-100,e.band?.amp??0,e.band?.scale??1,e.band?.drip??0)},uLayerCount:{value:t.length},uLCol:{value:n},uLA:{value:r},uLY:{value:i},uLO:{value:a},uLLin:{value:c},uLAbs:{value:l},uLS:{value:f},uLCov:{value:g},uLCovCh:{value:S},uCov:{value:e.cov?.texture??null},uCovRect:{value:new s(...e.cov?.rect??[0,0,1,1])},uGrid:{value:new s(e.grid?.layer??-1,e.grid?.size[0]??1,e.grid?.size[1]??1,e.grid?.width??.02)},uGridColor:{value:new p(e.grid?.color??0)},uMap:{value:e.map??null},uMapFace:{value:e.map?C:-1},uLine:{value:e.line??0},uFogMul:{value:e.fog??1},uLampLit:{value:e.lamp??1},uId:{value:x++*.618034%1*.9+.05}},clipping:!0,vertexShader:y,fragmentShader:b,defines:e.noFog?{PAINT_NOFOG:1}:{},side:e.side??0})}function C(e,t,n){let[o,s,c,u]=e,d=Math.max(4,Math.round(Math.abs(c-o)*t)),f=Math.max(4,Math.round(Math.abs(u-s)*t)),p=new Uint8Array(d*f*4),m=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};for(let e=0;e<f;e++)for(let t=0;t<d;t++){let r=o+(t+.5)/d*(c-o),i=s+(e+.5)/f*(u-s),a=[0,0,0,0];for(let e of n){let t=0,n=e.v??1;if(`e`in e){let[a,o,s,c]=e.e,l=Math.hypot((r-a)/s,(i-o)/c);t=n*(1-m(1-(e.soft??.5),1,l))}else{let[a,o,s,c]=e.seg,l=s-a,u=c-o,d=Math.min(1,Math.max(0,((r-a)*l+(i-o)*u)/Math.max(l*l+u*u,1e-9))),f=Math.hypot(r-(a+l*d),i-(o+u*d));t=n*(1-m(e.w,e.w+(e.soft??.3),f))}a[e.ch]=Math.max(a[e.ch],t)}for(let n=0;n<4;n++)p[(e*d+t)*4+n]=Math.round(Math.min(1,a[n])*255)}let h=new i(p,d,f,r);return h.magFilter=a,h.minFilter=a,h.wrapS=h.wrapT=l,h.colorSpace=``,h.needsUpdate=!0,h}export{_ as n,C as r,S as t};