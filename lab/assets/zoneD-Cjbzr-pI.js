import{a as e,i as t,t as n}from"./main-CWXRxuAn.js";import{$ as r,C as i,E as a,I as o,In as s,L as c,Ln as l,N as u,R as d,Rn as f,_t as p,a as m,ct as h,f as g,ft as _,gn as v,hn as y,ht as b,in as x,nt as S,rt as C,u as w,v as T,vn as E}from"./Style-DOuyqAVF.js";import{n as D,r as O}from"./Builder-dhC2zwri.js";var k=class{x0;z0;x1;z1;cell;base;data;nx;nz;constructor(e,t,n,r,i,a){this.x0=e,this.z0=t,this.x1=n,this.z1=r,this.cell=i,this.base=a,this.nx=Math.round((n-e)/i),this.nz=Math.round((r-t)/i),this.data=new Float32Array(this.nx*this.nz).fill(a)}rect(e,t,n,r,i,a=`set`){let o=Math.max(0,Math.round((Math.min(e,n)-this.x0)/this.cell)),s=Math.min(this.nx,Math.round((Math.max(e,n)-this.x0)/this.cell)),c=Math.max(0,Math.round((Math.min(t,r)-this.z0)/this.cell)),l=Math.min(this.nz,Math.round((Math.max(t,r)-this.z0)/this.cell));for(let e=c;e<l;e++)for(let t=o;t<s;t++){let n=e*this.nx+t;this.data[n]=a===`set`?i:a===`max`?Math.max(this.data[n],i):Math.min(this.data[n],i)}}at(e,t){let n=Math.floor((e-this.x0)/this.cell),r=Math.floor((t-this.z0)/this.cell);return n<0||r<0||n>=this.nx||r>=this.nz?this.base:this.data[r*this.nx+n]}texture(){let e=new a(this.data,this.nx,this.nz,x,d);return e.minFilter=h,e.magFilter=h,e.generateMipmaps=!1,e.needsUpdate=!0,e}addColliders(e,t,n=-1){let r=new Uint8Array(this.nx*this.nz),i=this.data;for(let a=0;a<this.nz;a++)for(let o=0;o<this.nx;o++){let s=a*this.nx+o;if(r[s]||i[s]>=0)continue;let c=i[s],l=1;for(;o+l<this.nx&&!r[s+l]&&i[s+l]===c;)l++;let u=1;grow:for(;a+u<this.nz;){for(let e=0;e<l;e++){let t=(a+u)*this.nx+o+e;if(r[t]||i[t]!==c)break grow}u++}for(let e=0;e<u;e++)for(let t=0;t<l;t++)r[(a+e)*this.nx+o+t]=1;let d=this.x0+o*this.cell,f=this.z0+a*this.cell,p=Math.max(c,n);e.add({x:d,y:p-2,z:f},{x:d+l*this.cell,y:p,z:f+u*this.cell},t).depth=-c}}},A=.25,j=e=>Math.round(e/A)*A,M=null;function N(){return M||=new C({colorWrite:!1,depthWrite:!1,side:2}),M}function P(e,t,n,r,i=[0,0,0]){if(t.length<3)return null;let a=t.map(e=>new l(...e)),o=new l;for(let e=0;e<a.length;e++)o.add(new l().crossVectors(a[e],a[(e+1)%a.length]));o.normalize();let u=Math.abs(o.y)<.9?new l(0,1,0).cross(o).normalize():new l(1,0,0),d=new l().crossVectors(o,u),f=a.map(e=>new s(e.dot(u),e.dot(d))),p=E.triangulateShape(f,[]),m=n.clone().normalize(),h=r/Math.max(Math.abs(m.dot(o)),.05),_=m.clone().multiplyScalar(-h),v=[];for(let e of p)for(let t of e)v.push(a[t].x+_.x+i[0],a[t].y+_.y+i[1],a[t].z+_.z+i[2]);let y=new g;y.setAttribute(`position`,new c(v,3)),y.computeVertexNormals();let b=new S(y,N());return b.castShadow=!0,b.receiveShadow=!1,b.name=`gobo`,e.root.add(b),b}function F(e,t,n){let r=t.clone().normalize(),i=(n-e[1])/Math.max(-r.y,.001);return[e[0]-r.x*i,e[2]-r.z*i]}function I(e,t,n){let r=!1;for(let i=0,a=n.length-1;i<n.length;a=i++){let[o,s]=n[i],[c,l]=n[a];s>t!=l>t&&e<(c-o)*(t-s)/(l-s)+o&&(r=!r)}return r}function L(e,t,n,r,i){let[a,o,s,c]=t,l=Math.ceil((s-a)/r),u=Math.ceil((c-o)/r),d=new Uint8Array(l*u);for(let e of i){let t=1/0,n=1/0,i=-1/0,s=-1/0;for(let[r,a]of e)t=Math.min(t,r),n=Math.min(n,a),i=Math.max(i,r),s=Math.max(s,a);let c=Math.max(0,Math.floor((t-a)/r)),f=Math.min(l-1,Math.ceil((i-a)/r)),p=Math.max(0,Math.floor((n-o)/r)),m=Math.min(u-1,Math.ceil((s-o)/r));for(let t=p;t<=m;t++)for(let n=c;n<=f;n++)I(a+(n+.5)*r,o+(t+.5)*r,e)&&(d[t*l+n]=1)}let f=[];for(let e=0;e<u;e++){let t=0;for(;t<l;){if(d[e*l+t]){t++;continue}let i=t;for(;i<l&&!d[e*l+i];)i++;let s=new w((i-t)*r,.05,r);s.translate(a+(t+i)/2*r,n,o+(e+.5)*r),f.push(s.toNonIndexed()),s.dispose(),t=i}}let p=O(f,!1)??new g;for(let e of f)e.dispose();let m=new S(p,N());return m.castShadow=!0,m.receiveShadow=!1,m.name=`gobo-roof`,e.root.add(m),m}var R=class{b;hf;r=D(7);constructor(e,t){this.b=e,this.hf=t}box(e,t,n,r={}){let i=this.b.boxMM(e,t,n,{collide:r.collide,shadow:r.shadow??!0});return t[1]<0&&this.hf.rect(t[0],t[2],n[0],n[2],n[1]>=0?50:n[1],`max`),i}deck(e,t,n,r,i,a=.15){return this.box(e,[t,-2,n],[r,a,i],{collide:!0})}shelf(e,t,n,r,i){this.hf.rect(e,t,n,r,i,`max`)}blobShelf(e,t,n,r,i,a=1,o=.5){let s=(e,t)=>{let n=Math.sin(e*12.9898+t*78.233+a*37.719)*43758.5453;return n-Math.floor(n)},c=(e,t)=>{let n=Math.floor(e/2),r=Math.floor(t/2),i=e/2-n,a=t/2-r,o=s(n,r),c=s(n+1,r),l=s(n,r+1),u=s(n+1,r+1),d=i*i*(3-2*i),f=a*a*(3-2*a);return(o*(1-d)+c*d)*(1-f)+(l*(1-d)+u*d)*f};for(let a=e-n*1.5;a<e+n*1.5;a+=o)for(let s=t-r*1.5;s<t+r*1.5;s+=o){let l=(a+o/2-e)/n,u=(s+o/2-t)/r;Math.hypot(l,u)+(c(a,s)-.5)*.8<1&&this.hf.rect(a,s,a+o,s+o,i,`max`)}}basin(e,t,n,r,i){this.hf.rect(e,t,n,r,i,`set`)}column(e,t,n,r,i,a,o,s={}){this.box(e,[t,a,n],[r,o,i],{collide:!0});let c=a,l=s.base??a;for(let[a,o]of s.plinth??[])this.box(e,[t-a,c,n-a],[r+a,l+o,i+a],{collide:!0}),l+=o,c=l;let u=o;for(let[a,o]of s.cap??[])this.box(s.capMat??e,[t-a,u-o,n-a],[r+a,u,i+a]),u-=o}greeble(e,t,n,r,i,a={}){let o=this.r,s=a.faces??[`x`,`-x`,`z`,`-z`,`-y`],[c,l]=a.size??[.25,.75],u=a.out??.25;for(let a=0;a<i;a++){let i=s[Math.floor(o()*s.length)],a=j(c+o()*(l-c))||.25,d=j(c+o()*(l-c))||.25,f=j(.25+o()*(u-.25))||.25,p=t&&o()<.25,m,h;if(i===`x`||i===`-x`){let e=j(n[2]+o()*Math.max(0,r[2]-n[2]-a)),t=j(n[1]+o()*Math.max(0,r[1]-n[1]-d)),s=i===`x`?r[0]:n[0];m=[i===`x`?s-(p?.1:0):s-f,t,e],h=[i===`x`?s+f:s+(p?.1:0),t+d,e+a]}else if(i===`z`||i===`-z`){let e=j(n[0]+o()*Math.max(0,r[0]-n[0]-a)),t=j(n[1]+o()*Math.max(0,r[1]-n[1]-d)),s=i===`z`?r[2]:n[2];m=[e,t,i===`z`?s-(p?.1:0):s-f],h=[e+a,t+d,i===`z`?s+f:s+(p?.1:0)]}else{let e=j(n[0]+o()*Math.max(0,r[0]-n[0]-a)),t=j(n[2]+o()*Math.max(0,r[2]-n[2]-d));m=[e,n[1]-f,t],h=[e+a,n[1]+(p?.1:0),t+d]}p?(i===`x`&&(m[0]=r[0]-.02,h[0]=r[0]+.02),i===`-x`&&(m[0]=n[0]-.02,h[0]=n[0]+.02),i===`z`&&(m[2]=r[2]-.02,h[2]=r[2]+.02),i===`-z`&&(m[2]=n[2]-.02,h[2]=n[2]+.02),i===`-y`&&(m[1]=n[1]-.02,h[1]=n[1]+.02),this.b.boxMM(t,m,h,{shadow:!1})):this.b.boxMM(e,m,h)}}},z={bottomLit:`#f4f6e8`,bottomShade:`#9fbcb2`,wallShade:`#8fb0a8`,grout:`#9fb1a5`,tile:.25,groutWidth:.014,absorb:[2.6,.55,.62],deep:`#1f5a5e`,r0:.04,reflGain:1,reflTint:`#ffffff`,distort:.012,waveScale:1.2,waveAmp:.12,waveQuant:0,posterize:0,posterNoise:.4,reflPosterize:0,caustics:.4,sunGain:1,aniso:2.5,foam:0,foamWidth:.3,foamColor:`#f4f7ec`,patch:[0,0,0,0],patchAmount:0,patchThreshold:0,patchScale:.8,litHoles:[0,.3,1.2,0],wallLit:1,reflKey:[1,0],reflOver:[0,.05],reflRect:[0,0,0,0],bottomWarp:[0,1]},B=`
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,V=`
layout(location = 1) out highp vec4 gInfo;
precision highp sampler2DShadow;
varying vec3 vWorld;
uniform float uTime;
uniform float uShadowQuant;
uniform mat4 uSunShadowMatrix;
uniform sampler2DShadow uShadowMap;
uniform float uHasShadow;
uniform vec3 uSunDir;
uniform highp sampler2D uHeight;
uniform vec4 uHGrid;     // x0, z0, cell, base
uniform vec2 uHSize;
uniform sampler2D uReflTex;
uniform mat4 uReflMatrix;
uniform vec3 uBottomLit;
uniform vec3 uBottomShade;
uniform vec3 uWallShade;
uniform vec3 uGrout;
uniform vec2 uTile;      // size, grout width
uniform vec3 uAbsorb;
uniform vec3 uDeep;
uniform vec4 uRefl;      // r0, gain, distort, reflPosterize
uniform vec3 uReflTint;
uniform vec4 uWave;      // scale, amp, quant, caustics
uniform vec4 uPoster;    // levels, noise, sunGain, id
uniform vec4 uFoam;      // strength, width, aniso, -
uniform vec3 uFoamColor;
uniform vec4 uPatch;     // x0, z0, x1, z1
uniform vec3 uPatchAmt;  // amount, threshold, scale
uniform vec4 uLitHoles;  // amount, threshold, scale, warp
uniform float uWallLit;
uniform vec2 uReflKey;
uniform vec2 uReflOver;
uniform vec4 uReflRect;
uniform vec2 uBottomWarp;
${e}
${t}
${n}

float hAt(ivec2 c) {
  if (c.x < 0 || c.y < 0 || float(c.x) >= uHSize.x || float(c.y) >= uHSize.y) return uHGrid.w;
  return texelFetch(uHeight, c, 0).r;
}

// 底の升目を視線でたどる。戻り値: 道のり t、当たった面の法線 n
float marchBottom(vec3 ro, vec3 rd, out vec3 n) {
  vec2 pos = (ro.xz - uHGrid.xy) / uHGrid.z;
  vec2 dir = rd.xz / uHGrid.z;
  ivec2 cell = ivec2(floor(pos));
  vec2 st = vec2(dir.x >= 0.0 ? 1.0 : -1.0, dir.y >= 0.0 ? 1.0 : -1.0);
  vec2 tDelta = vec2(abs(dir.x) > 1e-6 ? abs(1.0 / dir.x) : 1e9, abs(dir.y) > 1e-6 ? abs(1.0 / dir.y) : 1e9);
  vec2 fr = pos - floor(pos);
  vec2 tMax = vec2(st.x > 0.0 ? (1.0 - fr.x) : fr.x, st.y > 0.0 ? (1.0 - fr.y) : fr.y) * tDelta;
  float h = hAt(cell);
  n = vec3(0.0, 1.0, 0.0);
  if (h >= ro.y - 1e-4) return 0.0;
  for (int i = 0; i < 64; i++) {
    float tn = min(tMax.x, tMax.y);
    float yExit = ro.y + rd.y * tn;
    if (yExit <= h) {
      n = vec3(0.0, 1.0, 0.0);
      return (h - ro.y) / rd.y;
    }
    if (tMax.x < tMax.y) { cell.x += int(st.x); tMax.x += tDelta.x; n = vec3(-st.x, 0.0, 0.0); }
    else { cell.y += int(st.y); tMax.y += tDelta.y; n = vec3(0.0, 0.0, -st.y); }
    float hn = hAt(cell);
    if (yExit <= hn) return tn;
    h = hn;
  }
  n = vec3(0.0, 1.0, 0.0);
  return (h - ro.y) / rd.y;
}

float waveH(vec2 p) {
  p.y *= uFoam.z;
  return sl_fbm(vec3(p * uWave.x, uTime * 0.22), 3) + 0.35 * sl_vnoise(vec3(p * uWave.x * 3.1 + 7.0, uTime * 0.5));
}
// 近くに水面より上へ出た物（通路・柱）があるか（0..1）
float nearSolid(vec2 p, float r) {
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 q = p + vec2(cos(a), sin(a)) * r;
    ivec2 c = ivec2(floor((q - uHGrid.xy) / uHGrid.z));
    s = max(s, step(0.0, hAt(c)));
  }
  return s;
}

float sunShadow(vec3 q, vec3 n) {
  if (uHasShadow < 0.5) return 1.0;
  vec3 a = abs(n);
  if (uShadowQuant > 0.0) {
    vec3 cell = (floor(q / uShadowQuant) + 0.5) * uShadowQuant;
    if (a.y >= a.x && a.y >= a.z) q.xz = cell.xz; else if (a.x >= a.z) q.zy = cell.zy; else q.xy = cell.xy;
  }
  vec4 sc = uSunShadowMatrix * vec4(q + n * 0.05, 1.0);
  sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  return texture(uShadowMap, vec3(sc.xy, sc.z - 0.0008));
}

void main() {
  vec3 P = vWorld;
  vec3 V = normalize(P - cameraPosition);
  // 波（勾配。段に丸めると平らな面になる）
  float e = 0.06;
  float h0 = waveH(P.xz);
  vec2 g = vec2(waveH(P.xz + vec2(e, 0.0)) - h0, waveH(P.xz + vec2(0.0, e)) - h0) / e;
  if (uWave.z > 0.0) g = floor(g * uWave.z + 0.5) / uWave.z;
  vec3 N = normalize(vec3(-g.x * uWave.y, 1.0, -g.y * uWave.y));

  // 映り込み
  vec4 pc = uReflMatrix * vec4(P, 1.0);
  vec2 ruv = pc.xy / pc.w + N.xz * uRefl.z;
  vec3 reflRaw = texture2D(uReflTex, ruv).rgb;
  vec3 refl = reflRaw * uReflTint;
  if (uRefl.w > 0.0) {
    vec3 lab = sl_linToOklab(max(refl, 0.0));
    float nz = sl_fbm(vec3(P.xz * vec2(1.9, 1.9 * uFoam.z), uTime * 0.15), 3) * uPoster.y;
    lab.x = floor(lab.x * uRefl.w + 0.5 + nz) / uRefl.w;
    refl = sl_oklabToLin(lab);
  }

  // 屈折して底へ
  vec3 R = refract(V, N, 1.0 / 1.333);
  vec3 n;
  vec3 Pm = P;
  if (uBottomWarp.x > 0.0) {
    vec2 wq = P.xz * vec2(1.0, uFoam.z) * uBottomWarp.y;
    Pm.x += sl_fbm(vec3(wq, 3.1 + uTime * 0.06), 3) * uBottomWarp.x;
    Pm.z += sl_fbm(vec3(wq + 7.7, 5.3 + uTime * 0.06), 3) * uBottomWarp.x * 0.5;
  }
  float t = marchBottom(Pm, R, n);
  vec3 Q = Pm + R * t;
  vec2 tuv = n.y > 0.5 ? Q.xz : (abs(n.x) > 0.5 ? vec2(Q.z, Q.y) : vec2(Q.x, Q.y));
  vec2 tc = tuv / uTile.x;
  vec2 f = fract(tc);
  vec2 dl = min(f, 1.0 - f);
  vec2 aa = fwidth(tc) * 0.75;
  float lw = uTile.y / uTile.x * 0.5;
  float grout = max(1.0 - smoothstep(lw - aa.x, lw + aa.x, dl.x), 1.0 - smoothstep(lw - aa.y, lw + aa.y, dl.y));
  grout *= 1.0 - smoothstep(0.3, 0.7, max(aa.x, aa.y));
  float ndl = max(dot(n, uSunDir), 0.0);
  // 日の光も波で曲がる: 影を調べる位置を波の傾きでずらす（光の縁が波打つ）
  vec3 Qs = Q + vec3(N.x, 0.0, N.z) * uLitHoles.w * 10.0;
  float sh = ndl > 0.0 ? sunShadow(Qs, n) : 0.0;
  float lit = sh * step(0.05, ndl);
  if (uLitHoles.x > 0.0 && n.y > 0.5) {
    float hn = sl_warp(vec3(Q.xz * vec2(1.0, uFoam.z) * uLitHoles.z + N.xz * 3.0, uTime * 0.05), 3);
    lit *= 1.0 - uLitHoles.x * step(hn, uLitHoles.y);
  }
  if (uPatchAmt.x > 0.0 && n.y > 0.5) {
    vec2 pq = Q.xz;
    vec2 e2 = min(pq - uPatch.xy, uPatch.zw - pq);
    float edge = min(e2.x, e2.y);
    float nz = sl_warp(vec3(pq * vec2(1.0, uFoam.z) * uPatchAmt.z + N.xz * 2.0, uTime * 0.08), 4);
    float mk = step(uPatchAmt.y - clamp(edge, -2.0, 1.5) * 0.25, nz);
    lit = max(lit, mk * uPatchAmt.x);
  }
  if (n.y < 0.5) lit *= uWallLit;
  vec3 base = n.y > 0.5 ? uBottomShade : uWallShade;
  base = mix(base, uBottomLit * uPoster.z, lit);
  // コースティクス（日の当たる底だけ）
  if (uWave.w > 0.0) {
    vec2 vo = sl_voronoi(vec3(Q.xz * 1.5 + N.xz * 0.6, uTime * 0.3)).xy;
    float c = smoothstep(0.12, 0.0, vo.y - vo.x);
    base += uBottomLit * c * uWave.w * (0.25 + 0.75 * lit);
  }
  base = mix(base, base * uGrout, grout);
  // 吸収: 視線の水中の道のり + 日の光の水中の道のり（底まで）
  float depthQ = max(-Q.y, 0.0);
  float path = t + depthQ / max(uSunDir.y, 0.3) * 0.5;
  vec3 tr = exp(-uAbsorb * path);
  vec3 under = base * tr + uDeep * (1.0 - tr);

  // フレネル
  float cosi = clamp(-dot(V, N), 0.0, 1.0);
  float F = uRefl.x + (1.0 - uRefl.x) * pow(1.0 - cosi, 5.0);
  F = clamp(F * uRefl.y, 0.0, 1.0);
  vec3 col = mix(under, refl, F);
  if (uReflOver.x > 0.0) {
    float lu = sl_linToOklab(max(under, 0.0)).x;
    float lr2 = sl_linToOklab(max(reflRaw, 0.0)).x;
    float nz2 = sl_fbm(vec3(P.xz * vec2(1.6, 1.6 * uFoam.z), uTime * 0.15), 3) * 0.06;
    float inR = 1.0;
    if (uReflRect.z > uReflRect.x) {
      vec2 e3 = min(P.xz - uReflRect.xy, uReflRect.zw - P.xz);
      inR = step(0.0, min(e3.x, e3.y) + nz2 * 4.0);
    }
    col = mix(col, reflRaw, step(lu + uReflOver.y + nz2, lr2) * uReflOver.x * inR);
  }
  if (uReflKey.y > 0.0) {
    // 明るい映り込み（白い物）だけを強く重ねる。境目はワールド座標のノイズでちぎる
    float lr = sl_linToOklab(max(reflRaw, 0.0)).x;
    float nz = sl_fbm(vec3(P.xz * vec2(2.2, 2.2 * uFoam.z), uTime * 0.2), 3) * 0.05;
    col = mix(col, reflRaw * mix(uReflTint, vec3(1.0), 0.6), step(uReflKey.x + nz, lr) * uReflKey.y);
  }

  // 物の際の白い泡（ギザギザ）
  if (uFoam.x > 0.0) {
    float n = sl_fbm(vec3(P.xz * vec2(3.0, 3.0 * uFoam.z), uTime * 0.3), 3);
    float r = uFoam.y * (0.55 + 0.45 * n);
    float f = max(nearSolid(P.xz, r * 0.5), nearSolid(P.xz, r)) * step(0.0, n + 0.25);
    col = mix(col, uFoamColor, f * uFoam.x);
  }

  // 明るさを段に丸める（ちぎれた平らな色面）
  if (uPoster.x > 0.0) {
    vec3 lab = sl_linToOklab(max(col, 0.0));
    float nz = sl_warp(vec3(P.xz * vec2(0.9, 0.9 * uFoam.z), 0.5 + uTime * 0.05), 3) * uPoster.y;
    float q = floor(lab.x * uPoster.x + nz + 0.5);
    lab.x = (q - nz) / uPoster.x;
    col = sl_oklabToLin(lab);
  }

  col = sl_applyFog(col, P, cameraPosition);
  gl_FragColor = vec4(col, 1.0);
  vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  gInfo = vec4(vn.xy * 0.5 + 0.5, uPoster.w, 0.0);
}`;function H(e,t,n,r={}){let i={...z,...r},a={...m,uShadowMap:{value:null},uHasShadow:{value:0},uSunDir:{value:new l(0,1,0)},uHeight:{value:e.texture()},uHGrid:{value:new f(e.x0,e.z0,e.cell,e.base)},uHSize:{value:new s(e.nx,e.nz)},uReflTex:{value:t.target.texture},uReflMatrix:{value:t.matrix},uBottomLit:{value:new T},uBottomShade:{value:new T},uWallShade:{value:new T},uGrout:{value:new T},uTile:{value:new s},uAbsorb:{value:new l},uDeep:{value:new T},uRefl:{value:new f},uReflTint:{value:new T},uWave:{value:new f},uPoster:{value:new f(0,0,1,.37)},uFoam:{value:new f},uFoamColor:{value:new T},uPatch:{value:new f},uPatchAmt:{value:new l},uLitHoles:{value:new f},uWallLit:{value:1},uReflKey:{value:new s(1,0)},uReflOver:{value:new s(0,.05)},uReflRect:{value:new f},uBottomWarp:{value:new s(0,1)}},o=new y({uniforms:a,vertexShader:B,fragmentShader:V,fog:!1}),c=e=>{a.uBottomLit.value.set(e.bottomLit),a.uBottomShade.value.set(e.bottomShade),a.uWallShade.value.set(e.wallShade);let t=new T(e.grout),n=new T(e.bottomLit);a.uGrout.value.setRGB(t.r/Math.max(n.r,.001),t.g/Math.max(n.g,.001),t.b/Math.max(n.b,.001)),a.uTile.value.set(e.tile,e.groutWidth),a.uAbsorb.value.set(...e.absorb),a.uDeep.value.set(e.deep),a.uRefl.value.set(e.r0,e.reflGain,e.distort,e.reflPosterize),a.uReflTint.value.set(e.reflTint),a.uWave.value.set(e.waveScale,e.waveAmp,e.waveQuant,e.caustics),a.uPoster.value.set(e.posterize,e.posterNoise,e.sunGain,.37),a.uFoam.value.set(e.foam,e.foamWidth,e.aniso,0),a.uFoamColor.value.set(e.foamColor),a.uPatch.value.set(...e.patch),a.uPatchAmt.value.set(e.patchAmount,e.patchThreshold,e.patchScale),a.uLitHoles.value.set(...e.litHoles),a.uWallLit.value=e.wallLit,a.uReflKey.value.set(...e.reflKey),a.uReflOver.value.set(...e.reflOver),a.uReflRect.value.set(...e.reflRect),a.uBottomWarp.value.set(...e.bottomWarp)};c(i);let[u,d,p,h]=n,g=new b(p-u,h-d);g.rotateX(-Math.PI/2),g.translate((u+p)/2,0,(d+h)/2);let _=new S(g,o);return _.name=`water`,_.renderOrder=10,_.castShadow=!1,_.receiveShadow=!1,t.hide.push(_),{material:o,mesh:_,update(e){let t=e.shadow.map?.depthTexture??null;a.uShadowMap.value=t,a.uHasShadow.value=+!!t,a.uSunDir.value.copy(e.position).sub(e.target.position).normalize()},set(e){Object.assign(i,z,r,e),c(i)}}}var U=1456,W=class{eye;yaw;pitch;fov;f;q;qi;constructor(e,t,n,i){this.eye=e,this.yaw=t,this.pitch=n,this.fov=i,this.f=408/Math.tan(r.degToRad(i)/2),this.q=new p().setFromEuler(new u(n,t,0,`YXZ`)),this.qi=this.q.clone().invert()}ray(e,t){return new l((e-U/2)/this.f,-(t-408)/this.f,-1).applyQuaternion(this.q).normalize()}hit(e,t,n,r){let i=this.ray(e,t),a=n===`x`?0:n===`y`?1:2,o=[i.x,i.y,i.z][a],s=(r-this.eye[a])/(Math.abs(o)<1e-9?1e-9:o);return[this.eye[0]+i.x*s,this.eye[1]+i.y*s,this.eye[2]+i.z*s]}proj(e){let t=new l(e[0]-this.eye[0],e[1]-this.eye[1],e[2]-this.eye[2]).applyQuaternion(this.qi);return[U/2+this.f*t.x/-t.z,408-this.f*t.y/-t.z]}def(e,t){return{eye:[this.eye[0]+e,this.eye[1],this.eye[2]+t],yaw:this.yaw,pitch:this.pitch,fov:this.fov}}},G=new W([0,1.92,0],.021,-.041,53.5),K=[-.5,-.65,-.55];function q(e,t){let n=e.b,r=.15,i=3.45,a=4.4,o=4.8,s=e.b.ctx.mat({name:`a-beamFar`,color:`#eef3e7`,hi:`#e8eedf`,shade:`#6c9c92`,dark:`#62948b`,tiles:{size:2*A,line:.01,color:`#c3cfc0`,jitter:.015,broken:.35}});e.deck(t.deck,-2,-7.5,22,8,r),e.deck(t.deck,7,-30,22,-19,r),e.deck(t.deckDeep,-22,-40,-10,8,r),e.basin(-10,-36,-2,8,-.8),e.basin(-2,-36,3.5,-7.5,-.45),e.basin(-2,-36,3.5,-16,-.3);let c=[-6.25,-12.25,-18.25,-24.25,-30.25];for(let a of c){if(a===-6.25){e.column(t.col,3.25,a-.5,4.25,a,-2,i,{base:r,plinth:[[0,.25]]}),e.box(t.col,[3,3.4000000000000004,a-.4],[4.1,4.5,a+.35]),e.box(t.col,[2.8,3.7,a-.3],[3.25,4.300000000000001,a+.5]),e.box(t.col,[3.6,3.6,a-.3],[4.15,4.15,a+.55]),e.box(t.col,[3.25,4.050000000000001,a-.3],[3.6,4.5,a+.45]),n.boxMM(t.dark,[3.25,3.8000000000000003,a+.36],[3.31,4.5,a+.52],{shadow:!1}),n.boxMM(t.dark,[2.7,4.3500000000000005,a+0],[3.6,4.42,a+.5],{shadow:!1}),n.boxMM(t.dark,[3.55,3.95,a+.4],[3.62,4.15,a+.6],{shadow:!1});continue}e.column(t.col,3.5,a-1.5,4.25,a,-2,i,{base:0,plinth:[[0,.25]]}),e.greeble(t.col,t.dark,[3.25,2.45,a-1.75],[4.5,i,a+.25],4,{faces:[`x`,`-x`,`z`],size:[.25,.75],out:.25})}e.box(t.ped,[-4.5,-2,-14],[-2.75,2.5,-12.5],{collide:!0}),e.box(t.colDeep,[-5.25,-2,-14.5],[-4.5,2.5,-14],{collide:!0}),e.box(t.col,[-7,-2,-12.5],[-2.5,.05,-11.75],{collide:!0}),e.box(t.ped,[-6.75,-2,-13.75],[-5.25,2.5,-12.25],{collide:!0}),n.boxMM(t.dark,[-4.4,2.5,-13.4],[-3.9,3,-12.9]);for(let e of[-6.4,-5.7,-3.2])n.boxMM(t.dark,[e,2.5,-13],[e+.06,i,-12.94],{shadow:`cast`});for(let n of[-18.5,-24.5,-30.5])e.column(t.colDeep,-3.75,n-1,-2.75,n,-2,i);for(let n of[-12.5,-24.5])e.column(t.colDeep,-8,n-1,-7,n,-2,i);e.column(t.colDeep,-11.5,-12,-10.5,-11,-2,i),e.box(t.colDeep,[-19,-2,-40],[-18,i,-30],{collide:!0}),e.box(t.colDeep,[-19,-2,-26],[-18,i,8],{collide:!0}),e.box(t.colDeep,[-19,2.5,-30],[-18,i,-26]);for(let n of[-18.25,-24.25,-30.25])e.column(t.col,9.75,n-1.5,11.25,n,-2,i);e.box(t.farWall,[-22,-2,-37],[6,a,-36],{collide:!0}),e.box(t.farWall,[8,-2,-37],[22,a,-36],{collide:!0}),e.box(t.farWall,[6,2.5,-37],[8,a,-36]);for(let[e,r]of[[-1.5,.5],[2,2.75],[8.5,10]])n.boxMM(t.glow,[e,0,-35.98],[r,2.2,-35.94],{shadow:!1});e.shelf(-2,8,6,8.75,-.15),e.shelf(-10,4,-9.5,8,-.15);for(let n of c)e.box(t.beamDeep,[-22,i,n-1.5],[-2,a,n]),e.box(n<-6.25?s:t.beam,[-2,i,n-1.5],[22,a,n]);e.box(t.beam,[3,3.7,-36],[4.5,a,-7]),e.box(t.beamDeep,[-5,i,-36],[-2,a,-11],{shadow:`receive`}),e.box(t.beamDeep,[-5,i,-8],[-2,a,2],{shadow:`receive`}),e.box(t.beamDeep,[-5,i,-11],[-2,a,-8],{shadow:`receive`}),e.box(t.beam,[9.75,i,-36],[11.25,a,-3.5]),e.box(t.beamDeep,[-8.5,i,-36],[-7,a,8]);for(let n of c)e.greeble(t.beam,null,[-2,3.7,n-1.75],[12,4.15,n+.25],6,{faces:[`z`],size:[.25,.5],out:.25}),e.greeble(t.beamDeep,t.dark,[-16,3.2,n-1.75],[-2,3.95,n+.25],14,{faces:[`z`,`-y`],size:[.25,.5],out:.25});e.greeble(t.beamDeep,null,[-5.25,3.2,-36],[-2,3.85,2],0,{faces:[`-x`,`-y`,`-y`],size:[.25,.5],out:.25}),e.greeble(t.beam,t.dark,[2.25,3.2,-36],[5.25,3.85,-6.25],14,{faces:[`x`,`-x`,`-y`],size:[.25,.75],out:.25});for(let n of c)e.greeble(t.beam,t.dark,[-2,3.2,n-1.75],[3,i,n+.25],4,{faces:[`-y`],size:[.25,.5],out:.25});for(let e=-2;e>-34;e-=2.5)for(let r of[-1.9,-5.1])n.boxMM(t.dark,[r,1.9+(e*7%3==0?.4:.9),e-.03],[r+.06,i,e+.03],{shadow:`cast`});let u=(n,r,i,c)=>{e.box(c<=-6.25?s:t.beam,[n,a,r],[i,o,c])},d=(n,r,i,s)=>{e.box(t.beamDeep,[n,a,r],[i,o,s])};d(-22,-36,-13.5,8),d(-10,-36,-8.5,8),d(-7,-36,-2,-11),d(-7,-8,-2,8),e.box(t.beamDeep,[-7,a,-11],[-2,o,-8],{shadow:`receive`}),u(-2,-6.25,2.75,8),u(-2,-36,.5,-11.75),u(-2,-8,.5,-6.25),e.box(s,[-2,a,-11.75],[.5,o,-8],{shadow:`receive`}),u(2,-36,2.5,-6.25),u(2.5,-36,5,-12.25),u(9.5,-36,22,-12.25);for(let e=-36;e<=-12.25;e+=1)n.boxMM(t.bar,[5,a,e-.05],[9.5,4.5,e+.05],{shadow:`cast`});u(2.5,-12.25,5,-6.25),u(12,-12.25,22,-6.25),u(2.5,-6.25,5,-3.5),u(2.75,-3.5,6,-2.75);for(let e=-36;e<=-6.25;e+=.75)n.boxMM(t.bar,[.5,a,e-.04],[2,4.5,e+.04],{shadow:`cast`});for(let e=-36;e<=8;e+=1.5)n.boxMM(t.bar,[-13.5,a,e-.15],[-10,4.5,e+.15],{shadow:`cast`});n.box(t.beam,[5.35,4.5,-1.3],[3.2,.2,.3],{rotY:-.2}),n.box(t.beam,[12,4.5,2],[18,.2,.3]);let f=new l(...K),p=(e,t)=>t.map(([t,n])=>G.hit(t,n,`z`,e));P(n,p(-12.25,[[296,326],[404,326],[404,352],[342,418],[312,452],[296,452]]),f,.3),P(n,p(-12.5,[[452,326],[582,326],[582,338],[540,382],[505,418],[470,452],[452,452]]),f,.3);let m=p(-12.25,[[404,352],[404,505],[296,505],[296,452],[312,452],[342,418]]),h=p(-12.5,[[582,338],[582,505],[452,505],[452,452],[470,452],[505,418],[540,382]]),g=e=>e.map(e=>F(e,f,4.8999999999999995));L(n,[-7,-12,.5,-8],4.8999999999999995,.0625,[g(m),g(h)]),P(n,p(-6.25,[[1150,170],[1295,170],[1295,362],[1250,420],[1200,495],[1162,560],[1150,560]]),f,.25)}var J=new W([0,1.33,0],-.7,0,60),Y=[.3,-.85,-.45],X=8;function ee(e,t,n){let r=e.b.ctx.mat,i=(e,t=A)=>({size:t,line:.014,color:e,jitter:.02}),a=r({name:`b-shaft`,color:`#80b8ae`,hi:`#80b8ae`,shade:`#7eb7ad`,dark:`#6aa29c`,tiles:i(`#6ea69c`)}),c=r({name:`b-col`,color:`#f2f8f1`,hi:`#fbfdf9`,shade:`#7eb7ad`,dark:`#5f9893`,tiles:i(`#d3e2db`)}),u=r({name:`b-cap`,color:`#8cc0b6`,hi:`#8cc0b6`,shade:`#84bbb2`,dark:`#6aa29c`,tiles:i(`#79ada3`)}),d=r({name:`b-beam`,color:`#97c6bc`,hi:`#97c6bc`,shade:`#8fc0b6`,dark:`#76aaa2`,tiles:i(`#80b2a8`,2*A)}),f=r({name:`b-block`,color:`#f3f7ef`,hi:`#fcfefa`,shade:`#a9cdc4`,dark:`#86b4aa`,tiles:i(`#d9e4dc`)}),p=r({name:`b-recess`,color:`#4c7b84`,unlit:!0,tiles:{size:A,line:.012,color:`#44717a`}}),m=r({name:`b-colNL`,color:`#a8cbc2`,hi:`#b9d6cd`,shade:`#6e9b96`,dark:`#5f8e89`,tiles:i(`#8fb3ab`)}),h=r({name:`b-ceil`,color:`#d4e8e2`,hi:`#e2f0ec`,shade:`#a9cfc7`,dark:`#93c1b8`,tiles:i(`#b9d6cf`,2*A)}),g=r({name:`b-sky`,color:`#a9d3d0`,unlit:!0,noFog:!0,line:0,blotch:{color:`#f4fbf7`,scale:.12,threshold:-.05}}),y=e=>t+e,b=e=>n+e,x=(t,n,r,i,a,o,s,c=!1)=>{let l=t===d||t===u||t===m?`receive`:!0;e.box(t,[y(Math.min(n,a)),Math.min(r,o),b(Math.min(i,s))],[y(Math.max(n,a)),Math.max(r,o),b(Math.max(i,s))],{collide:c,shadow:l})},S=(t,n,r,i,a,o,s,c,l)=>{let u=(i+a)/2,d=(o+s)/2,f=Math.cos(r),p=Math.sin(r),m=n[0]+u*f+d*p,h=n[1]-u*p+d*f;e.b.box(t,[y(m),(c+l)/2,b(h)],[a-i,l-c,s-o],{rotY:r,collide:!0});let g=(a-i)/2,_=(s-o)/2,v=Math.abs(g*f)+Math.abs(_*p),x=Math.abs(g*p)+Math.abs(_*f);if(c<0){let t=e.hf.cell;for(let n=Math.floor((h-x)/t)*t;n<h+x;n+=t)for(let r=Math.floor((m-v)/t)*t;r<m+v;r+=t){let i=r+t/2-m,a=n+t/2-h,o=i*f-a*p,s=i*p+a*f;Math.abs(o)<=g&&Math.abs(s)<=_&&e.hf.rect(y(r),b(n),y(r+t),b(n+t),l>=0?50:l,`max`)}}let S=[];for(let[e,t]of[[i,o],[a,o],[a,s],[i,s]])S.push([n[0]+e*f+t*p,l,n[1]-e*p+t*f]);return S},C=e=>6+e*7.6,w=e=>-7-e*9,T=.5625,E=2.82,D=3.05,O=3.35,k=4.1,j=.9,M=-.6;e.basin(y(-30),b(-70),y(60),b(10),M),e.basin(y(-1),b(-1),y(1),b(1.5),-.3);let N=(e,t)=>e>=-4&&e<=6&&t>=-1&&t<=6&&!(t===-1&&e<=0)&&(t!==0||e!==-1);for(let e=-1;e<=6;e++)for(let t=-4;t<=6;t++){if(!N(t,e))continue;let n=C(t),r=w(e);x(c,n-1.6,-2,r-1.6,n+1.6,-.05,r+1.6,!0),x(c,n-1.1,-.05,r-1.1,n+1.1,.25,r+1.1,!0),x(c,n-.8,.25,r-.8,n+.8,.52,r+.8,!0),x(a,n-T,.52,r-T,n+T,E,r+T,!0),x(u,n-.85,E,r-.85,n+.85,D,r+.85),x(u,n-1.25,D,r-1.25,n+1.25,O,r+1.25)}for(let e=0;e<=6;e++)x(d,C(-4)-1.25,O,w(e)-j,C(6)+1.25,k,w(e)+j);for(let e=-4;e<=6;e++)x(d,C(e)-j,O,w(6)-1.25,C(e)+j,k,e<=0?w(0)+1.25:6);x(u,5.07,3.3000000000000003,-7.35,8.44,3.84,-4.71),x(d,C(0)-j,k,w(0)-j,C(0)+j,5,6);{let e=J.hit(140,408+J.f*1.33/6,`y`,0);x(m,e[0]-2*T,-2,e[2]-2*T,e[0],k,e[2],!0),x(u,e[0]-2*T-.35,3.44,e[2]-2*T-.35,e[0]+.6,k,e[2]+.35)}{let t=k,n=new v([new s(-30,70),new s(60,70),new s(60,-8),new s(-30,-8)]);for(let e of[[[-40,-60],[140,-60],[140,30],[60,55],[-40,60]],[[170,-60],[570,-60],[560,30],[420,45],[170,30]],[[590,-60],[960,-60],[950,25],[800,125],[600,125]],[[1090,-60],[1290,-60],[1280,45],[1100,50]],[[1150,185],[1400,118],[1480,110],[1480,250],[1150,250]],[[150,140],[470,160],[470,240],[150,240]]])n.holes.push(new _(e.map(([e,n])=>{let r=J.hit(e,n,`y`,t);return new s(r[0],-r[2])})));let r=new o(n,{depth:.3,bevelEnabled:!1});r.rotateX(-Math.PI/2),e.b.mesh(r,h,[y(0),t,b(0)],{shadow:`receive`})}e.b.boxMM(g,[y(-60),14,b(-120)],[y(80),14.2,b(40)],{shadow:!1}),x(p,-16,-2,-21.5,2,O,-20.5,!0),x(p,9,-2,-41.5,60,O,-40.5,!0),x(p,45.5,-2,-40,46.5,O,8,!0);let P=J.yaw,I=[0,0],R=(e,t)=>(e-728)*t/J.f,z=(e,t,n,r,i,a,o)=>S(e,I,P,R(t,r),R(n,r),-i,-r,a,o),B=[];B.push(z(f,75,330,4.5,5,-2,.12)),B.push(z(f,75,290,5,5.67,-2,.43)),B.push(z(f,80,140,5,5.5,.43,1.07));for(let e=0;e<5;e++){let t=[.2,.21,.19,.21,.2][e];B.push(z(f,1100+e*63,1161+e*63,2.86,3.1,0,t))}x(f,3,-2,-.6,10,.1,3,!0),B.push([[3,.1,-.6],[10,.1,-.6],[10,.1,3],[3,.1,3]]),x(f,8,-2,-1.6,10,.35,-.6,!0),B.push([[8,.35,-1.6],[10,.35,-1.6],[10,.35,-.6],[8,.35,-.6]]),B.push(z(f,1300,1390,5.6,6.2,-2,.12));let V=new l(...Y),H=e=>e.map(e=>F(e,V,X)),U=e=>e.map(([e,t])=>{let n=J.hit(e,t,`y`,0),r=J.ray(e,t),i=1/1.333,a=r.y,o=1-i*i*(1-a*a),s=r.clone().multiplyScalar(i).sub(new l(0,i*a+Math.sqrt(Math.max(o,0)),0)),c=M/s.y;return[n[0]+s.x*c,M,n[2]+s.z*c]}),W=(e,t,n,r,i)=>[[e,i,t],[n,i,t],[n,i,r],[e,i,r]],G=[H(U([[600,705],[752,688],[880,688],[912,712],[1072,728],[1120,740],[1250,750],[1300,764],[1312,792],[1290,830],[270,830],[440,790],[464,756],[544,740],[576,716]])),H(U([[370,522],[560,520],[578,560],[500,582],[400,584],[350,566]])),H(U([[1050,524],[1270,522],[1270,556],[1200,568],[1100,568],[1050,548]])),H(U([[1300,536],[1385,536],[1385,556],[1300,556]])),H(U([[-10,466],[60,466],[60,545],[-10,545]])),...B.map(e=>H(e)),H(W(C(0)-1.6,w(0)+1.1,C(0)+1.6,w(0)+1.6,.25))];L(e.b,[y(-40),b(-80),y(70),b(20)],X,.125,G.map(e=>e.map(([e,t])=>[y(e),b(t)])))}var Z=new W([0,1.6,0],.53,-.057,56.4),Q=[-.55,-.75,.1];function te(e,t,n){let r=e.b.ctx.mat,i=(e,t=A)=>({size:t,line:.012,color:e,jitter:.02}),a=r({name:`c-walk`,shadowQuant:!1,color:`#fdfaef`,hi:`#fffcf3`,shade:`#c3d4c8`,dark:`#8fb0a3`,tiles:i(`#e0e0d2`,2*A)}),c=r({name:`c-deck`,color:`#ebe8dc`,hi:`#fdfbf1`,shade:`#c3d4c8`,dark:`#8fb0a3`,tiles:i(`#d9dacb`,2*A)}),u=r({name:`c-col`,color:`#f8f5e8`,hi:`#fefbf0`,shade:`#a6bcab`,dark:`#7d9d92`,tiles:i(`#d8d9c9`)}),d=r({name:`c-cap`,color:`#9fbfac`,hi:`#9fbfac`,shade:`#93b8a7`,dark:`#7fa898`,tiles:i(`#87aa98`,2*A)}),f=r({name:`c-ceil`,color:`#b5cfc0`,hi:`#b5cfc0`,shade:`#adc9ba`,dark:`#a6c4b5`,tiles:i(`#9bbaaa`,4*A)}),p=r({name:`c-beam`,color:`#a9c9bb`,hi:`#a9c9bb`,shade:`#a1c3b4`,dark:`#9abeaf`,tiles:i(`#90b2a3`,2*A)}),m=r({name:`c-colFar`,color:`#f4f2e6`,hi:`#fbf9ee`,shade:`#72aaa8`,dark:`#5f9496`,tiles:i(`#cfd6c8`)}),h=r({name:`c-ceilDark`,color:`#3e7a77`,unlit:!0,tiles:{size:2*A,line:.015,color:`#36706d`}}),g=r({name:`c-litWall`,color:`#c6d9ce`,unlit:!0,tiles:{size:2*A,line:.02,color:`#a9c1b3`}}),y=r({name:`c-wall`,color:`#eef2e6`,hi:`#f8f8ef`,shade:`#6aa096`,dark:`#3f7877`,tiles:i(`#c9d6cb`)}),b=r({name:`c-wallDeep`,color:`#e3ebe0`,hi:`#f5f5f0`,shade:`#5a8d89`,dark:`#456b74`,tiles:i(`#c3d1c6`)}),x=r({name:`c-farDark`,color:`#2a6274`,unlit:!0,noFog:!0,tiles:{size:A,line:.01,color:`#255c6d`}}),S=r({name:`c-dark`,color:`#0f4a5c`,unlit:!0,noFog:!0}),C=r({name:`c-recess`,color:`#4d7a80`,unlit:!0,tiles:{size:A,line:.01,color:`#46727a`}}),w=r({name:`c-sky`,color:`#fdfbf0`,unlit:!0,noFog:!0,line:0}),T=e=>t+e,E=e=>n+e,D=(t,n,r,i,a,o,s,c=!1,l=`receive`)=>{let u=t===d||t===f||t===p?`receive`:l;e.box(t,[T(Math.min(n,a)),Math.min(r,o),E(Math.min(i,s))],[T(Math.max(n,a)),Math.max(r,o),E(Math.max(i,s))],{collide:c,shadow:u})},O=4.2;e.basin(T(-30),E(-45),T(20),E(10),-1.1),e.basin(T(-1.5),E(-30),T(20),E(-1.6),-2.6);let k=[[-1.75,-1.55],[-2.9,-1.5],[-3.8,-1.5],[-5.1,-1.9],[-5.6,-2.6]],j=e=>{for(let t=0;t<k.length-1;t++)if(e<=k[t][0]&&e>=k[t+1][0])return k[t][1]+(e-k[t][0])/(k[t+1][0]-k[t][0])*(k[t+1][1]-k[t][1]);return k[k.length-1][1]};for(let t=-1.75;t>-5.6;t-=A){let n=Math.sin(t*2.3)*.12+Math.sin(t*5.1+1)*.08;e.shelf(T(-4.75),E(t-A),T(Math.round((j(t)+n)/A)*A),E(t),-.28)}e.shelf(T(-1.75),E(-1.75),T(2),E(3),-.2),e.deck(c,T(-14),E(-1.67),T(-1.75),E(8),.15);let M=[[-6.4,-1.67],[-3.3,-1.67],[-3.2,-3.6],[-4.75,-5.6],[-4.75,-12],[-6.4,-12]];{let t=new v(M.map(([e,t])=>new s(e,-t))),n=new o(t,{depth:2.36,bevelEnabled:!1});n.rotateX(-Math.PI/2),e.b.mesh(n,a,[T(0),-2,E(0)],{shadow:!0});let r=e.hf.cell;for(let t=-12;t<-1.67;t+=r){let n=t+r/2,i=-6.4;for(let e=1;e<M.length-1;e++){let[t,r]=M[e],[a,o]=M[e+1];(n<=r&&n>=o||n>=r&&n<=o)&&(i=Math.max(i,t+(n-r)/(o-r)*(a-t)))}e.hf.rect(T(-6.4),E(t),T(i),E(t+r),50,`max`),e.b.ctx.colliders.add({x:T(-6.4),y:-2,z:E(t)},{x:T(i),y:.36,z:E(t+r)})}}D(b,-14,-2,-30,-13,O,4,!0),D(u,-13,-2,-7,-12.3,O,-5.6,!0,!0),D(C,-12.98,-2,-5.4,-12.9,3.2,2),D(u,-5.6,.36,-3.8,-4.4,3,-2.8,!0,!0),D(d,-5.85,3,-4.05,-4.15,3.4,-2.55,!1,!0),D(d,-6.1,3.4,-4.3,-3.9,O,-2.3,!1,!0);let N=[-8.4,-12.7,-17,-21.3,-25.6],I=(e,t,n)=>{D(m,e-n-.25,-2,t-n-.25,e+n+.25,.05,t+n+.25,!0,!0),D(m,e-n,.05,t-n,e+n,3,t+n,!0,!0),D(d,e-n-.25,3,t-n-.25,e+n+.25,3.4,t+n+.25),D(d,e-n-.5,3.4,t-n-.5,e+n+.5,O,t+n+.5)};I(-3.3,-8.4,.4),I(-5.3,-22.3,.45);for(let e of[-11,-16,-21,-26])I(-9,e,.45);for(let e of[-15.6,-21.6,-27.6])I(-14.5,e,.45);D(p,-3.7,3.5,-30,-2.9,O,-12),D(p,-9.4,3.5,-30,-8.6,O,-8);for(let e of N.slice(1))D(p,-20,3.5,e-.4,1,O,e+.4);let R=[Z.hit(712,72,`y`,O),Z.hit(900,-12,`y`,O),Z.hit(885,162,`y`,O),Z.hit(840,162,`y`,O),Z.hit(760,110,`y`,O)],z=new v([new s(-20,-8),new s(6,-8),new s(6,40),new s(-20,40)]);z.holes.push(new _(R.map(e=>new s(e[0],-e[2]))));let B=[Z.hit(905,-40,`y`,O),Z.hit(1185,-40,`y`,O),Z.hit(1185,115,`y`,O),Z.hit(905,115,`y`,O)];z.holes.push(new _(B.map(e=>new s(e[0],-e[2])).reverse()));let V=new o(z,{depth:.06,bevelEnabled:!1});V.rotateX(-Math.PI/2),e.b.mesh(V,f,[T(0),O,E(0)],{shadow:`receive`}),e.b.boxMM(w,[T(-30),9,E(-50)],[T(20),9.2,E(10)],{shadow:!1}),D(g,-2.9,4.6000000000000005,-14.5,2,8.9,-14,!1,!1),D(h,.4,3.8,-10.5,3.5,4.19,-6.2,!1,!1),D(y,.3,-2,-9,8,.95,-7.3,!0),D(y,1,.95,-9,8,1.25,-8.25,!0),D(b,1.4,-2,-12,8,1.6,-9,!0),D(b,1,2.9,-12,8,O,-7.3,!0),e.greeble(b,null,[T(1),2.9,E(-12)],[T(1.6),O,E(-7.3)],6,{faces:[`-x`,`z`],size:[.25,.75],out:.25});for(let e=0;e<9;e++)D(b,.35+e*.28,-2,-24,8,.73+(e+1)*.32,-21.5,!0);D(b,3.2,-2,-21.5,8,O,-12,!0),D(b,-16,-2,-25.5,-8,O,-24,!0);for(let[e,t]of[[-12.5,-11.5],[-10.5,-9]])D(w,e,.3,-24.02,t,3.2,-23.98);D(x,-8,-2,-26.5,-3.2,3.6,-26,!0),D(b,-8,3.6,-26.5,-3.2,O,-24),D(b,-3.2,3.4,-25.5,1.6,O,-24),D(S,-3.2,-2,-32,.8,3.4,-31.5),D(S,-3.7,-2,-32,-3.2,3.4,-25.5),D(S,.8,-2,-32,1.3,3.4,-25.5),D(S,-3.7,3.4,-32,1.3,3.9,-25.5);let H=new l(...Q),U=9.5,W=e=>e.map(e=>F(e,H,U)),G=(e,t,n,r,i)=>[[e,i,t],[n,i,t],[n,i,r],[e,i,r]],K=(e,t)=>t.map(([t,n])=>Z.hit(t,n,`x`,e)),q=[W(G(-14,-1.7,-1.7,8,.15)),W(M.map(([e,t])=>[Math.max(e,t>-3.8?-5:-5.6),.36,t])),...[1,2].map(e=>{let[t,n]=M[e],[r,i]=M[e+1];return W([[t,.36,n],[r,.36,i],[r+.15,-.05,i],[t+.15,-.05,n]])}),W([[-4.75,-.28,-1.6],...k.map(([e,t])=>[t+.3,-.28,e]),[-4.75,-.28,-5.6]]),W(K(-4.4,[[345,452],[452,298],[452,525],[345,548]])),W([[-12.3,.2,-7],[-12.3,.2,-5.6],[-12.3,3,-5.6],[-12.3,3,-7]])].map(e=>{let t=e.reduce((e,t)=>e+t[0],0)/e.length,n=e.reduce((e,t)=>e+t[1],0)/e.length;return e.map(([e,r])=>[e+Math.sign(e-t)*.05,r+Math.sign(r-n)*.05])});L(e.b,[T(-40),E(-60),T(30),E(20)],U,.125,q.map(e=>e.map(([e,t])=>[T(e),E(t)]))),P(e.b,K(-4.4,[[340,455],[455,296],[455,60],[340,60]]).map(e=>[T(e[0]),e[1],E(e[2])]),H,.3)}var $=new W([0,1.2,0],-.018,.087,60),ne=[-.25,-.65,-.72];function re(e,t,n,r){let a=e=>n+e,o=e=>r+e,s=e.b,c=(t,n,r,i,s,c,l,u=!1,d=`receive`)=>{e.box(t,[a(Math.min(n,s)),Math.min(r,c),o(Math.min(i,l))],[a(Math.max(n,s)),Math.max(r,c),o(Math.max(i,l))],{collide:u,shadow:d})},u=7.5;e.basin(a(-20),o(-40),a(20),o(6),-.5),e.basin(a(-1.25),o(-40),a(2),o(6),-3),c(t.wall,-5,-2,-6.8,-1.76,.6,-5.85,!0,!0),c(t.wall,-4.08,.6,-6.6,-2.44,u,-5.8,!0,!0),c(t.wall,-4.08,6.1,-8,-2.44,u,-6.6),c(t.side,-2.44,.6,-6.6,-2.41,6.1,-5.8),c(t.wall,1.82,-2,-7.8,5.27,.48,-6.65,!0,!0),c(t.wall,2.73,.48,-8,4.46,u,-6.8,!0,!0),c(t.wall,3.4,5.47,-8.5,6.5,6.5,-3.5,!1,!0),((e,t,n,r,i,a,o,s,l,u,d={})=>{let f=d.steps??4,p=d.sw??.375,m=(l-s)/f;c(e,r,-2,t,a,u,n,!0),c(e,o,-2,t,i,u,n,!0),c(e,a,l,t,o,u,n);for(let r=0;r<f;r++){let i=s+r*m,l=(r+1)*p;(d.stepL??!0)&&c(e,a,i,t,a+l,i+m,n),(d.stepR??!0)&&c(e,o-l,i,t,o,i+m,n)}})(t.wall,-8.75,-8,-3.6,4.5,-3.5,1.5,3.35,4.85,6.1,{steps:4,sw:.4,stepR:!1}),c(t.wall,-14,-2,-8.75,-9.5,6.1,-8,!0),c(t.wall,-9.5,3,-8.75,-3.6,6.1,-8),c(t.wall,-3.6,-2,-8.75,-3.5,3.35,-8,!0),c(t.inner,-10,-2,-24,-9.5,3,-8.75,!0),c(t.shadow,-9.52,-2,-11.2,-9.48,3,-8.75),c(t.inner,-10,-2,-24.5,-3,3,-24,!0),c(t.shadow,-9.5,-2,-23.98,-6,2.4,-23.9),c(t.inner,-10,3,-24.5,-3,3.4,-8.75),c(t.wall,-14,6.1,-8.75,-1.95,u,-8),c(t.wall,-1.95,6.1,-8.75,1.75,6.85,-8),c(t.wall,1.75,6.1,-8.75,6,u,-8),c(t.wall,6,6.1,-8.75,14,u,-8),c(t.inner,4.5,3.75,-8.75,6,6.1,-8),c(t.wall,6,4.2,-8.75,7,6.1,-8),c(t.wall,7,4.6,-8.75,14,6.1,-8);let d=(e,t)=>$.hit(e,470,`z`,t)[0],f=(e,t)=>$.hit(715,e,`z`,t)[1],p=-14.5,m=d(560,-13),h=d(850,-13),g=f(285,-13),_=d(625,-13),v=d(800,-13),y=f(235,-13);c(t.inner,-14,-2,p,m,u,-13,!0),c(t.inner,h,-2,p,14,u,-13,!0),c(t.inner,m,g,p,_,u,-13),c(t.inner,v,g,p,h,u,-13),c(t.inner,_,g,p,v,y,-13),c(t.inner,m,f(330,-13),p,d(600,-13),g,-13),c(t.inner,d(600,-13),f(300,-13),p,d(640,-13),g,-13);let b=d(640,-18),x=d(832,-18),S=f(345,-18);c(t.inner,-14,-2,-19,b,9,-18,!0),c(t.inner,x,-2,-19,14,9,-18,!0),c(t.inner,b,S,-19,x,9,-18),c(t.inner,b,f(360,-18),-19,d(660,-18),S,-18),c(t.inner,d(812,-18),f(360,-18),-19,x,S,-18),c(t.dark,b,-2,-40,x,S,-39.5),c(t.dark,b-.5,-2,-40,b,S,-19),c(t.dark,x,-2,-40,x+.5,S,-19),c(t.dark,b-.5,S,-40,x+.5,S+.5,-19),c(t.inner,-8,-2,-18,-7,9,p,!0),c(t.inner,7,-2,-18,8,9,p,!0),c(t.reveal,-3.52,-2,-8.74,-3.48,3.35,-8.01,!1,!1);for(let e=0;e<4;e++){let n=3.35+e*.375,r=-3.5+(e+1)*.4;c(t.reveal,r-.02,n,-8.74,r+.02,n+.375,-8.01,!1,!1),c(t.reveal,-3.5,n-.02,-8.74,r,n+.02,-8.01,!1,!1)}c(t.reveal,-1.9,4.83,-8.74,1.5,4.87,-8.01,!1,!1),c(t.shadow,4.5,-2,-12.5,14,4.6,-12),c(t.shadow,4.5,3.25,-12,14,4.6,-9.5),c(t.roomPillar,7.5,-2,-12,8.25,3.25,-11,!0),c(t.roomPillar,10.5,-2,-12,11.25,3.25,-11,!0),c(t.side,5.5,-2,-9.6,14,.3,-8.8,!0);let C=(e,n,r,c,l=-.1,u=1)=>{for(let i=e;i>=n-1e-6;i-=u)for(let e=0;e<12;e++){let n=(e+.5)/12*Math.PI;s.box(t.glass,[a(l+Math.cos(n)*c),r+Math.sin(n)*c,o(i)],[.07,Math.PI*c/12+.02,.07],{rotZ:n,shadow:!1})}for(let i=1;i<12;i+=2){let u=i/12*Math.PI,d=l+Math.cos(u)*c,f=r+Math.sin(u)*c;s.boxMM(t.glass,[a(d-.03),f-.03,o(n)],[a(d+.03),f+.03,o(e)],{shadow:!1})}let d=new i(c+.05,c+.05,e-n,24,1,!0,-Math.PI/2,Math.PI);d.rotateX(Math.PI/2),s.mesh(d,t.pane,[a(l),r,o((e+n)/2)],{shadow:!1})};C(0,-8.75,6.85,1.85),C(-14.5,-18,5.6,1.75,-.15,1.5),c(t.wall,-14,u,-8,-1.95,8,6),c(t.wall,1.75,u,-8,14,8,6),c(t.wall,-2.2,6.85,-8,-1.95,8,6),c(t.wall,1.75,6.85,-8,2,8,6),c(t.wall,-14,u,-26,-2.15,8,-8),c(t.wall,1.85,u,-26,14,8,-8),c(t.wall,-14,9,-40,14,9.5,-26),s.boxMM(t.sky,[a(-30),14,o(-60)],[a(30),14.2,o(10)],{shadow:!1});let w=new l(...ne),T=(e,t)=>t.map(([t,n])=>{let r=$.hit(t,n,`z`,e);return[a(r[0]),r[1],o(r[2])]});P(e.b,T(-6.8,[[975,60],[1190,60],[1190,335],[1160,340],[1160,360],[1150,365],[1145,400],[1135,420],[1110,440],[1090,460],[1072,480],[1052,500],[1045,552],[975,552]]),w,.25),P(e.b,T(-8,[[835,-20],[985,-20],[985,552],[850,552],[850,150],[795,150],[795,125],[812,90],[825,40]]),w,.2),P(e.b,T(-13,[[380,240],[585,262],[578,285],[560,300],[545,330],[530,360],[510,400],[490,430],[470,460],[450,492],[380,492]]),w,.3),P(e.b,T(-13,[[860,120],[860,492],[765,492],[745,400],[735,335],[760,280],[785,230],[810,180],[830,140]]),w,.3),P(e.b,T(-8,[[1180,-40],[1480,-40],[1480,40],[1440,75],[1405,100],[1375,125],[1335,152],[1300,178],[1265,200],[1180,205]]),w,.2),P(e.b,T(-8,[[1290,200],[1310,175],[1350,150],[1480,145],[1480,260],[1180,260],[1180,205]]),w,.2),P(e.b,((e,t)=>t.map(([t,n])=>{let r=$.hit(t,n,`x`,e);return[a(r[0]),r[1],o(r[2])]}))(-9.5,[[100,270],[215,270],[215,335],[190,370],[160,420],[130,470],[110,505],[100,505]]),w,.2),P(e.b,T(-8,[[-20,145],[75,142],[80,155],[130,180],[165,185],[170,195],[150,200],[90,215],[70,245],[80,260],[150,262],[205,265],[205,560],[-20,560]]),w,.2)}export{L as _,Q as a,Y as c,K as d,q as f,P as g,A as h,Z as i,ee as l,R as m,ne as n,te as o,H as p,re as r,J as s,$ as t,G as u,F as v,k as y};