import{a as e,i as t,t as n}from"./main-CWXRxuAn.js";import{C as r,Cn as i,G as a,I as o,In as s,L as c,Ln as l,M as u,N as d,Rn as f,W as p,_t as m,a as h,bn as g,d as _,f as v,fn as y,g as b,gn as x,gt as ee,h as te,hn as S,l as ne,m as re,nt as ie,r as ae,t as oe,tt as se,u as C,v as w,wn as ce,xn as le}from"./Style-DOuyqAVF.js";import{i as ue,n as de,r as fe,t as pe}from"./Builder-dhC2zwri.js";import{n as me,r as he,t as ge}from"./kit-9HCdy0_i.js";function T(e,t,n,r,i,a,o={}){let s=new l(...n),c=new l(...r),u=c.clone().sub(s),d=u.length();u.normalize();let f=new l(...o.up??[0,1,0]);Math.abs(f.dot(u))>.99&&f.set(1,0,0);let p=new l().crossVectors(u,f).normalize(),m=new l().crossVectors(p,u).normalize(),h=new se().makeBasis(u,m,p),g=new C(d,a,i);g.applyMatrix4(h);let _=s.add(c).multiplyScalar(.5);return e.mesh(g,t,[_.x,_.y,_.z],o)}function _e(e,t,n,r,i={}){let a=new b(n.map(e=>new l(...e)),!1,`catmullrom`,.2),o=new ce(a,i.seg??Math.max(8,n.length*6),r,i.radial??6,!1);return e.mesh(o,t,[0,0,0],i)}function ve(e,t,n,r,i,a,o=.3,s=.3,c={}){let l=a-i,u=(i+a)/2,d=Math.min(o,s)*.12,f=c.rotY??0,p=Math.cos(f),m=Math.sin(f),h=(e,t)=>[n+e*p+t*m,u,r-e*m+t*p];e.box(t,h(0,s/2-d/2),[o,l,d],{...c,rotY:f}),e.box(t,h(0,-s/2+d/2),[o,l,d],{...c,rotY:f}),e.box(t,h(0,0),[d,l,s-2*d],{...c,rotY:f})}function E(e,t,n,r){let i=new a(t,n,r.length);return r.forEach((e,t)=>i.setMatrixAt(t,e)),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),e.add(i),i}function D(e,t,n,r=0,i=1,a=1,o=1){return new se().compose(new l(e,t,n),new m().setFromEuler(new d(0,r,0)),new l(i,a,o))}function ye(e=7,t=1){let n=[],r=t,i=()=>(r=r*16807%2147483647,r/2147483647);for(let t=0;t<e;t++){let r=t/e*Math.PI*2+i()*.8,a=.15+i()*.35,o=.6+i()*.4,s=.035+i()*.02,c=Math.cos(r),l=Math.sin(r),u=-l*s,d=c*s;n.push(u,0,d,-u,0,-d,c*a,o,l*a)}let a=new v;a.setAttribute(`position`,new c(n,3)),a.computeVertexNormals();let o=a.getAttribute(`normal`);for(let e=0;e<o.count;e++)o.setXYZ(e,o.getX(e)*.3,1,o.getZ(e)*.3);return a.setAttribute(`uv`,new c(Array(n.length/3*2).fill(0),2)),a}function be(e,t,n,r,i,a,s,c,l,u,d={}){let f=new x;f.moveTo(0,a);for(let e=1;e<=16;e++){let t=e/16;f.lineTo(s*t,a+c*(1-(1-t)*(1-t)))}f.lineTo(s,l),f.lineTo(0,l),f.lineTo(0,a);let p=new o(f,{depth:u,bevelEnabled:!1});if(p.translate(0,0,-u/2),r<0&&p.scale(-1,1,1),r<0){let e=p.index;if(e)for(let t=0;t<e.count;t+=3){let n=e.getX(t+1);e.setX(t+1,e.getX(t+2)),e.setX(t+2,n)}else{let e=p.getAttribute(`position`),t=p.getAttribute(`normal`);for(let n=0;n<e.count;n+=3)for(let r of[e,t]){let e=r.getX(n+1),t=r.getY(n+1),i=r.getZ(n+1);r.setXYZ(n+1,r.getX(n+2),r.getY(n+2),r.getZ(n+2)),r.setXYZ(n+2,e,t,i)}}p.computeVertexNormals()}return e.mesh(p,t,[n,0,i],d)}var xe=new C(1,1,1),Se=class{mats=[];box(e,t,n=0){this.mats.push(D(e[0],e[1],e[2],n,t[0],t[1],t[2]))}mm(e,t){this.box([(e[0]+t[0])/2,(e[1]+t[1])/2,(e[2]+t[2])/2],[Math.abs(t[0]-e[0]),Math.abs(t[1]-e[1]),Math.abs(t[2]-e[2])])}build(e,t,n=0){if(!this.mats.length)return null;let r=new a(xe,t,this.mats.length);return this.mats.forEach((e,t)=>r.setMatrixAt(t,e)),r.instanceMatrix.needsUpdate=!0,r.computeBoundingSphere(),n&&r.layers.set(n),e.add(r),r}};function Ce(e,t,n){let r=de(e.seed??1),i=e.along===`x`,a=i?e.x0:e.z0,o=i?e.x1:e.z1,s=i?e.z0:e.x0,c=i?e.z1:e.x1,l=e.y,u=(e,t,n)=>i?[e,t,n]:[n,t,e],d=(e,t,n)=>i?[e,t,n]:[n,t,e];if(e.rib&&e.rib[0]>0){let[n,r]=e.rib;for(let e=a+n/2;e<o;e+=n)t.box(u(e,l-r/2,(s+c)/2),d(.05,r,c-s))}for(let[n,r,i]of e.beams??[])t.box(u((a+o)/2,l-r/2,n),d(o-a,r,i));for(let[n,r,i]of e.cross??[])t.box(u(n,l-r/2,(s+c)/2),d(i,r,c-s));for(let[r,i,s]of e.trays??[]){let e=l-i;for(let t of[-1,1])n.box(u((a+o)/2,e,r+t*s/2),d(o-a,.06,.025));for(let n=a+.15;n<o;n+=.3)t.box(u(n,e-.02,r),d(.025,.02,s));for(let e=a+.6;e<o;e+=1.8)for(let n of[-1,1])t.box(u(e,l-i/2,r+n*s/2),d(.015,i,.015))}for(let[r,i,s]of e.pipes??[]){n.box(u((a+o)/2,l-i,r),d(o-a,s,s));for(let e=a+1;e<o;e+=2.4)t.box(u(e,l-i/2,r),d(.04,i,s*1.6))}if(e.boxes){let{n,size:i,drop:f,lanes:p}=e.boxes;for(let e=0;e<n;e++){let e=a+.5+r()*(o-a-1),n=p&&p.length?p[Math.floor(r()*p.length)]+(r()-.5)*.4:s+.5+r()*(c-s-1),m=i[0]+r()*(i[1]-i[0]),h=i[0]+r()*(i[1]-i[0]),g=f[0]+r()*(f[1]-f[0]);t.box(u(e,l-g-h/2,n),d(m,h,m*(.6+r()*.6))),t.box(u(e,l-g/2,n),d(.03,g,.03))}}if(e.hangers)for(let i=a+e.hangers/2;i<o;i+=e.hangers){let e=s+.4+r()*(c-s-.8),a=.15+r()*.35;t.box(u(i,l-a/2,e),d(.02,a,.02)),n.box(u(i,l-a-.03,e),d(.08,.06,.05))}}var O={top:0,rail:-.92,ballast:-1.06,ground:-1.15,road:-.55},k={half:3.2,z0:-86,z1:95},A={t1:-5.3,t2:5.3,t3:-12.35,t6:12.35,t4:-5.3,t5:5.3,t0:-70.8,t7:-74.8,gauge:1.067},j={t12:43,t36:45,t45:57.8,t0:44.4,t7:-14.6},M={z0:-12.4,z1:11.6,half:11.9,colX:10.6,soffit:4.5,knee:3.9},N={z0:11.6,z1:37,half:3.9,center:3.3,edge:4},P={xIn:3.9,xOut:10.5,z0:45.3,z1:57.5},F={x:-62,z0:2,z1:45,half:7.2,soffit:3.9},we={xEnd:-64,zc:0},I={x0:-54.8,x1:-40,z0:0,z1:28,eave:3.6,ridge:6.2},L={zA:9.1,zB:14.1,zC:24.5,xOff:-46.4},R={z0:.4,z1:3,floor:-4.25,ceil:-1.85,x0:-44.2,x1:1.3},z={xTop:-51.2,xBot:-44.2},B={half:1.2,zTop:11.2,zBot:3},V={x0:-40,x1:-16,z0:-8,z1:38},H={z0:-8,z1:-3,x0:-100},U={x0:-26,x1:-21.7,z1:53.4},W={x0:-88,x1:-76.4,z0:-40,z1:-14},G={x0:-100,x1:40,z0:-100,z1:105},K={x:10.8,z0:-24,step:18,n:9},q={uRects:{value:Array.from({length:8},()=>new f)},uRectH:{value:Array(8).fill(-1e3)},uRectL:{value:Array(8).fill(0)},uRectF:{value:Array(8).fill(1)},uLampCol:{value:new w(`#bff0e0`)},uSkyCol:{value:new w(`#b8efe2`)},uOutCol:{value:new w(`#5d9c94`)},uInCol:{value:new w(`#0d2a2e`)},uFloorY:{value:0},uStHorizon:{value:new w(`#b4efe4`)},uStUpper:{value:new w(`#c4f8ea`)},uStZenith:{value:new w(`#d0fbee`)},uStGround:{value:new w(`#57a3a0`)},uStFogShape:{value:new f(.08,.025,.12,1.6)},uStGlowA:{value:new f(-1,.15,0,0)},uStGlowACol:{value:new w(`#ffffff`)},uStGlowB:{value:new f(-1,.15,0,6)},uStGlowBCol:{value:new w(`#000000`)},uStClouds:{value:0},uStHills:{value:0},uStStripRefl:{value:1},uStTubeCol:{value:new w(`#fff8d0`)},uStFieldGain:{value:1},uStTubeGlow:{value:new s(1,1)},uStStripGain:{value:1},uStPudLift:{value:0},uStLampMul:{value:1},uStWet:{value:0},uStFloorRefl:{value:1},uStDens:{value:new f(1,0,.1,2)},uStFarMul:{value:.26},uStStream:{value:1}},Te=[];function Ee(e){Te.push(e)}function De(){Te.length=0}var Oe={uPoolP:{value:Array.from({length:10},()=>new f)},uPoolA:{value:Array.from({length:10},()=>new f)},uPoolC:{value:Array.from({length:10},()=>new f)},uPoolB0:{value:Array.from({length:10},()=>new f)},uPoolB1:{value:Array.from({length:10},()=>new f)},uPoolN:{value:0}},ke=``;function Ae(e,t,n){let r=`${e.toFixed(2)},${t.toFixed(2)},${n.toFixed(2)},${Te.length}`;if(r===ke)return;ke=r;let i=Te.map((r,i)=>{let a=r.box,o=Math.max(a[0]-e,0,e-a[3]),s=Math.max(a[1]-t,0,t-a[4]),c=Math.max(a[2]-n,0,n-a[5]);return[Math.hypot(o,s,c)+Math.hypot(r.c[0]-e,r.c[2]-n)*.01,i]});i.sort((e,t)=>e[0]-t[0]);let a=Math.min(10,Te.length);for(let e=0;e<a;e++){let t=Te[i[e][1]];Oe.uPoolP.value[e].set(t.c[0],t.c[1],t.c[2],t.half),Oe.uPoolA.value[e].set(t.axis[0],t.axis[1],t.axis[2],t.radius),Oe.uPoolC.value[e].set(t.color[0],t.color[1],t.color[2],t.kind),Oe.uPoolB0.value[e].set(t.box[0],t.box[1],t.box[2],t.halfH??0),Oe.uPoolB1.value[e].set(t.box[3],t.box[4],t.box[5],t.side??1)}Oe.uPoolN.value=a}var je=`
uniform vec4 uPoolP[10];
uniform vec4 uPoolA[10];
uniform vec4 uPoolC[10];
uniform vec4 uPoolB0[10];
uniform vec4 uPoolB1[10];
uniform int uPoolN;
// 灯り i の形の上で p に一番近い点（蛍光灯 = 線分、窓 = 縦の長方形）
vec3 st_poolNear(int i, vec3 p) {
  vec3 d = p - uPoolP[i].xyz;
  vec3 a = uPoolA[i].xyz;
  return uPoolP[i].xyz + a * clamp(dot(d, a), -uPoolP[i].w, uPoolP[i].w) + vec3(0.0, clamp(d.y, -uPoolB0[i].w, uPoolB0[i].w), 0.0);
}
// 窓の内側の向き
vec3 st_poolIn(int i) {
  vec3 a = uPoolA[i].xyz;
  return vec3(a.z, 0.0, -a.x) * uPoolB1[i].w;
}
bool st_poolOut(int i, vec3 p) {
  return any(lessThan(p, uPoolB0[i].xyz - 0.06)) || any(greaterThan(p, uPoolB1[i].xyz + 0.06));
}
// 光だまりの明るさ（色）。縁はちぎれ、明るさは柔らかく 3 段に寄せる（段は灯りの和で 1 回だけ）
vec3 st_pools(vec3 p, vec3 n) {
  vec3 acc = vec3(0.0);
  float fs = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= uPoolN) break;
    if (st_poolOut(i, p)) continue;
    vec3 v = p - st_poolNear(i, p);
    float dist = length(v);
    vec3 l = -v / max(dist, 1e-3);
    float x = dist / uPoolA[i].w;
    if (x >= 1.0) continue;
    float f = 1.0 / (1.0 + 5.0 * x * x) * (1.0 - smoothstep(0.6, 1.0, x));
    if (uPoolC[i].w > 0.5) {
      // 窓: 部屋の内側だけ。窓の面に沿った壁は暗い（逆光）
      vec3 m = st_poolIn(i);
      f *= smoothstep(-0.02, 0.15, dot(v, m));
      f *= clamp(dot(n, l) * 0.85 + 0.15, 0.0, 1.0) * (1.0 - 0.6 * max(-n.y, 0.0));
    } else {
      f *= clamp(dot(n, l) * 0.75 + 0.25, 0.0, 1.0);
    }
    acc += uPoolC[i].rgb * f;
    fs += f;
  }
  if (fs <= 1e-4) return acc;
  float g = fs * (1.0 + sl_vnoise(p * 1.6) * 0.08);
  float q = smoothstep(0.05, 0.08, g) * 0.3 + smoothstep(0.22, 0.26, g) * 0.35 + smoothstep(0.5, 0.56, g) * 0.35;
  return acc * mix(1.0, q / fs, 0.35);
}
// 濡れた床に映る蛍光灯と窓（床 = 上向きの平らな面）。k = 映る強さ
vec3 st_poolRefl(vec3 p, float k) {
  vec3 vd = normalize(p - cameraPosition);
  vec3 r = reflect(vd, vec3(0.0, 1.0, 0.0));
  vec3 acc = vec3(0.0);
  if (r.y <= 0.0) return acc;
  for (int i = 0; i < 10; i++) {
    if (i >= uPoolN) break;
    if (st_poolOut(i, p)) continue;
    if (uPoolC[i].w < 0.5) {
      float t = (uPoolP[i].y - p.y) / r.y;
      if (t <= 0.0) continue;
      vec3 h = p + r * t;
      vec3 q = st_poolNear(i, h);
      float w = 0.05 + 0.025 * t;
      // 映り込みは見る向きに縦に伸びる（濡れた床の光の筋）
      vec2 e = h.xz - q.xz;
      vec2 fw = normalize(vd.xz + vec2(1e-4));
      float ea = dot(e, fw);
      float eb = dot(e, vec2(-fw.y, fw.x));
      float dd = length(vec2(ea * 0.35, eb));
      acc += uPoolC[i].rgb * exp(-dd * dd / (w * w)) * 2.2 + uPoolC[i].rgb * exp(-dd / (w * 6.0)) * 0.25;
    } else {
      vec3 m = st_poolIn(i);
      float dn = dot(r, m);
      if (dn >= -1e-3) continue;
      float t = dot(uPoolP[i].xyz - p, m) / dn;
      if (t <= 0.0) continue;
      vec3 h = p + r * t;
      vec3 d = h - uPoolP[i].xyz;
      float u = abs(dot(d, uPoolA[i].xyz)) - uPoolP[i].w;
      float yy = abs(d.y) - uPoolB0[i].w;
      float w = 0.03 + 0.02 * t;
      float inside = (1.0 - smoothstep(-w, w, u)) * (1.0 - smoothstep(-w, w, yy));
      acc += st_fogColor(r) * inside * 0.9;
    }
  }
  return acc * k;
}
`;function Me(e){for(let t=0;t<8;t++){let n=e[t];n?(q.uRects.value[t].set(Math.min(n.x0,n.x1),Math.min(n.z0,n.z1),Math.max(n.x0,n.x1),Math.max(n.z0,n.z1)),q.uRectH.value[t]=n.h,q.uRectL.value[t]=n.lamp??0,q.uRectF.value[t]=n.fog===!1?0:1):(q.uRectL.value[t]=0,q.uRects.value[t].set(0,0,0,0),q.uRectH.value[t]=-1e3)}}var Ne=`
uniform vec4 uRects[8];
uniform float uRectH[8];
uniform float uRectL[8];
uniform float uRectF[8];
uniform vec3 uLampCol;
uniform float uStLampMul;
uniform vec3 uStTubeCol;
uniform vec3 uSkyCol;
uniform vec3 uOutCol;
uniform vec3 uInCol;
uniform float uFloorY;
// 点の真上に角がある長方形（辺 a, b、距離 h）の形態係数（符号付き: 角の向きで足し引きする）
float st_fc(float a, float b, float h) {
  float X = abs(a) / h;
  float Y = abs(b) / h;
  float sx = sqrt(1.0 + X * X);
  float sy = sqrt(1.0 + Y * Y);
  float f = (X / sx) * atan(Y / sx) + (Y / sy) * atan(X / sy);
  return sign(a) * sign(b) * f * 0.15915494;
}
float st_rect(vec2 p, vec4 r, float h) {
  vec2 a = r.xy - p;
  vec2 b = r.zw - p;
  return st_fc(b.x, b.y, h) - st_fc(a.x, b.y, h) - st_fc(b.x, a.y, h) + st_fc(a.x, a.y, h);
}
// 上の空が見える割合（0〜1）
// 屋根の下面より上 0.8 m までは屋根の骨組みの中とみなす（ほぼ隠れる）
float st_visUp(vec3 p) {
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    float h = uRectH[i] - p.y;
    if (h <= -0.8) continue;
    h = max(h, 0.05);
    // 屋根から横に高さの 5 倍より離れた点は、隠される量がほぼ 0（重い計算を飛ばす）
    vec4 r = uRects[i];
    vec2 dd = max(max(r.xy - p.xz, p.xz - r.zw), vec2(0.0));
    if (max(dd.x, dd.y) > h * 5.0) continue;
    occ += st_rect(p.xz, r, h);
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}
// 下を見たとき、屋根の外（明るい所）が見える割合
float st_visDown(vec3 p) {
  float occ = 0.0;
  float h = max(p.y - uFloorY, 0.05);
  for (int i = 0; i < 8; i++) {
    if (uRectH[i] <= p.y - 0.8) continue;
    vec4 r = uRects[i];
    vec2 dd = max(max(r.xy - p.xz, p.xz - r.zw), vec2(0.0));
    if (max(dd.x, dd.y) > h * 5.0) continue;
    occ += st_rect(p.xz, r, h);
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}
// 霧の色（視線の向きの関数）。地平線の上で急に明るく、下で急に暗い（野原の上の霧）
uniform vec3 uStHorizon;
uniform vec3 uStUpper;
uniform vec3 uStZenith;
uniform vec3 uStGround;
uniform vec4 uStFogShape;
uniform vec4 uStGlowA;
uniform vec3 uStGlowACol;
uniform vec4 uStGlowB;
uniform vec3 uStGlowBCol;
uniform vec4 uStDens;
vec3 st_fogColor(vec3 rd) {
  float e = rd.y;
  vec3 c;
  // 地平線は遠くの野や林の分だけ少し上にずらす（uStDens.y）
  e -= uStDens.y;
  if (e >= 0.0) {
    c = mix(uStHorizon, uStUpper, smoothstep(0.0, uStFogShape.x, e));
    c = mix(c, uStZenith, smoothstep(uStFogShape.x, 0.9, e));
  } else {
    c = mix(uStHorizon, uStGround, 1.0 - exp(e / uStFogShape.y));
  }
  // 霧の向こうの光源のにじみ（広い・狭い）
  float above = smoothstep(-0.005, 0.035, e);
  vec3 ga = normalize(uStGlowA.xyz + vec3(0.0, 1e-4, 0.0));
  c += uStGlowACol * pow(max(dot(rd, ga), 0.0), uStGlowA.w) * above;
  vec3 gb = normalize(uStGlowB.xyz + vec3(0.0, 1e-4, 0.0));
  c += uStGlowBCol * pow(max(dot(rd, gb), 0.0), uStGlowB.w) * above;
  return c;
}
// 屋根の下か（0〜1）。箱のどの面でもなめらかに減る（横は 2·s m、上下は屋根の下面の上下 1 m でぼかす）。
// 床より下の点（映り込みを描くとき、鏡に映したカメラから床までの道のり）は床で折り返して調べる
// 視線の道のり（ro → wp）の近くにある屋根だけを調べる（屋根ごとの印。道のりの箱と屋根の影の範囲が重なる物）
int st_mask = 0;
void st_buildMask(vec3 ro, vec3 wp) {
  float s = max(uStFogShape.w, 1.2) + 0.5;
  vec2 lo = min(ro.xz, wp.xz) - s;
  vec2 hi = max(ro.xz, wp.xz) + s;
  float a = ro.y - uFloorY;
  float b = wp.y - uFloorY;
  float ymin = uFloorY + (a * b <= 0.0 ? 0.0 : min(abs(a), abs(b)));
  st_mask = 0;
  for (int i = 0; i < 8; i++) {
    float h = uRectH[i];
    if (h < -100.0 || uRectF[i] < 0.5) continue;
    vec4 r = uRects[i];
    if (r.z < lo.x || r.x > hi.x || r.w < lo.y || r.y > hi.y || ymin > h + 1.0) continue;
    st_mask |= (1 << i);
  }
}
float st_roofShade(vec3 q) {
  float sh = 0.0;
  float s = max(uStFogShape.w, 1.2);
  q.y = uFloorY + abs(q.y - uFloorY);
  for (int i = 0; i < 8; i++) {
    if ((st_mask & (1 << i)) == 0) continue;
    vec4 r = uRects[i];
    float h = uRectH[i];
    float dx = min(q.x - r.x, r.z - q.x);
    float dz = min(q.z - r.y, r.w - q.z);
    float v = smoothstep(-s, s, dx) * smoothstep(-s, s, dz) * smoothstep(h + 1.0, h - 1.0, q.y);
    sh = max(sh, v);
  }
  return sh;
}
// 視線をそのまま延ばすと屋根の下面に当たるか（縁はぼかす）。当たるなら、その方向から来る光は屋根に遮られている
// 下を向く視線は床（y = 0）に当たる所が屋根の下なら遮られているとみなす（屋根の下の暗い床を見ている）。
// 遠くの縁は浅い角度で見るので、ぼかしの幅は当たる所までの距離とともに広げる（画面の上で縁が線にならない）。
// ぼかしは主に屋根の内側に置く（屋根の外の明るい所を暗くしない）
// 屋根の外へはみ出すぼかしの幅（内側の幅に対する割合）
#define ST_BIAS 0.3
float st_rayBlocked(vec3 ro, vec3 rd) {
  if (abs(rd.y) <= 1e-4) return 0.0;
  float s0 = max(uStFogShape.w, 1.2);
  float bl = 0.0;
  for (int i = 0; i < 8; i++) {
    float h = uRectH[i];
    if (h < -100.0 || uRectF[i] < 0.5) continue;
    float yt = rd.y > 0.0 ? h : uFloorY;
    if (rd.y < 0.0 && ro.y < uFloorY) continue;
    float dy = yt - ro.y;
    // 屋根より上から見上げる視線は遮られない（屋根の下面の近くはなめらかに）
    float under = rd.y > 0.0 ? smoothstep(0.0, 0.6, dy) : 1.0;
    if (under <= 0.0) continue;
    float t = dy / rd.y;
    vec4 r = uRects[i];
    vec2 q = ro.xz + rd.xz * t;
    // 浅い角度で縮むのは視線の向き（水平成分）だけなので、x・z それぞれその向きの分だけ広げる
    vec2 hd = abs(rd.xz) / max(length(rd.xz), 1e-4);
    vec2 sw = s0 + hd * (0.03 * t * t / max(abs(dy), 0.5));
    float dx = min(q.x - r.x, r.z - q.x);
    float dz = min(q.y - r.y, r.w - q.y);
    bl = max(bl, smoothstep(-sw.x * ST_BIAS, sw.x, dx) * smoothstep(-sw.y * ST_BIAS, sw.y, dz) * under);
  }
  return bl;
}
// 霧を掛ける。色ごとに散乱の強さが違う（中くらいの距離の暗い物は青緑に寄る）。
// 屋根の下面を見上げる視線の霧は暗い（その向きから来る空の光が屋根に遮られる。開いた側を見る視線は明るいまま）
float st_fogMul = 1.0;
float st_lastT = 1.0;
vec3 st_applyFog(vec3 col, vec3 wp, vec3 ro) {
  // 霧の始まる距離は場所ごと（uStDens.w）。高さによる変化は小さいので無視する
  float od = uFogParams.x * uStDens.x * st_fogMul * max(length(wp - ro) - uStDens.w, 0.0);
  // 色ごとの差は中くらいの距離まで。遠くでは霧の色にそろう
  vec3 ext = mix(uFogExtinction, vec3(1.0), smoothstep(0.2, 1.8, od));
  vec3 T = max(exp(-od * ext), vec3(1.0 - uFogParams2.x));
  vec3 rd = normalize(wp - ro);
  // 道のりのうち屋根の下を通る部分の霧は暗い（開いた縁から奥へ入るほど暗い）。
  // 霧の溜まる量が等しくなる 6 点で調べる（近くの屋根の下を取りこぼさない）
  float total = 1.0 - exp(-od);
  float k = 1.0;
  st_buildMask(ro, wp);
  if (total > 1e-4 && st_mask != 0) {
    float acc = 0.0;
    for (int i = 0; i < 6; i++) {
      float t = -log(1.0 - (float(i) + 0.5) / 6.0 * total) / max(od, 1e-5);
      acc += mix(1.0, uStFogShape.z, st_roofShade(mix(ro, wp, clamp(t, 0.0, 1.0))));
    }
    k = acc / 6.0;
  }
  k = mix(k, uStDens.z, st_rayBlocked(ro, rd));
  st_lastT = dot(T, vec3(0.2126, 0.7152, 0.0722));
  return col * T + st_fogColor(rd) * (1.0 - T) * k;
}
vec3 st_light(vec3 p, vec3 n) {
  float up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  // 縦の面は面の向きへずらした点で調べる（屋根の外を向いた面は明るい）。
  // 重みが 0 になる項は計算しない（上向きの面は地面の項、下向きの面は空の項、水平な面はずらした点が要らない）
  vec3 q = p + vec3(n.x, 0.0, n.z) * 1.4;
  float ay = abs(n.y);
  float vu = 0.0;
  float vd = 0.0;
  if (up > 0.001) vu = (ay < 0.999 ? st_visUp(q) * (1.0 - ay) : 0.0) + (ay > 0.001 ? st_visUp(p) * ay : 0.0);
  if (up < 0.999) vd = (ay < 0.999 ? st_visDown(q) * (1.0 - ay) : 0.0) + (ay > 0.001 ? st_visDown(p) * ay : 0.0);
  vec3 sky = uSkyCol * vu;
  vec3 gnd = mix(uInCol, uOutCol, vd);
  // 屋根の下の蛍光灯（屋根の範囲の中、屋根より下を一様に照らす）
  float lamp = 0.0;
  for (int i = 0; i < 8; i++) {
    if (uRectL[i] <= 0.0 || p.y > uRectH[i] + 0.3) continue;
    vec4 r = uRects[i];
    float d = min(min(p.x - r.x, r.z - p.x), min(p.z - r.y, r.w - p.z));
    lamp += uRectL[i] * smoothstep(-1.5, 1.0, d);
  }
  // 蛍光灯は下を向いた面（屋根の下面）を弱く照らす
  return sky * up + gnd * (1.0 - up) + uLampCol * lamp * uStLampMul * mix(0.4, 1.0, smoothstep(-0.6, 0.0, n.y));
}
// 室内（駅舎・地下道。屋根に完全に覆われる所）: 空は見えないので空の割合の計算を省き、暗い照り返しと屋根の下の一様な灯りだけ。
// 明るさは光だまり（st_pools: 器具と窓）が足す
vec3 st_lightIn(vec3 p, vec3 n) {
  float up = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  float lamp = 0.0;
  for (int i = 0; i < 8; i++) {
    if (uRectL[i] <= 0.0 || p.y > uRectH[i] + 0.3) continue;
    vec4 r = uRects[i];
    float d = min(min(p.x - r.x, r.z - p.x), min(p.z - r.y, r.w - p.z));
    lamp += uRectL[i] * smoothstep(-1.5, 1.0, d);
  }
  return uInCol * (1.0 - up) + uLampCol * lamp * uStLampMul * mix(0.4, 1.0, smoothstep(-0.6, 0.0, n.y));
}
`,Pe=0,Fe=`
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec3 vColor;
#endif
void main() {
  vec4 lp = vec4(position, 1.0);
  vec3 ln = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  ln = mat3(instanceMatrix) * ln;
#endif
  vec4 wp = modelMatrix * lp;
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * ln);
  vUv = uv;
#ifdef USE_COLOR
  vColor = color;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;function Ie(r){let i={...r.defines??{}};r.unlit&&(i.ST_UNLIT=1),r.noFog&&(i.ST_NOFOG=1),r.map&&(i.ST_MAP=1),r.mottle&&(i.ST_MOTTLE=1),r.farFog&&(i.ST_FARFOG=1),r.pool&&(i.ST_POOL=1),r.wet&&(i.ST_WET=1);let a=new w(r.emissive??0).multiplyScalar(r.emissiveIntensity??1),o={...h,...q,uAlbedo:{value:new w(r.color)},uEmissive:{value:a},uGain:{value:r.gain??1},uMap:{value:r.map??null},uMottle:{value:new s(...r.mottle??[0,1])},uOpacity:{value:r.opacity??1},uId:{value:Pe++*.618034%1*.9+.05},uLineW:{value:r.line??0},uFogMul:{value:r.fogMul??1},uSheen:{value:r.sheen??0},...r.pool?Oe:{},uWet:{value:new l(...r.wet??[0,0,1])},...r.uniforms??{}},c=`
layout(location = 1) out highp vec4 gInfo;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec3 vColor;
#endif
uniform float uTime;
uniform vec3 uAlbedo;
uniform vec3 uEmissive;
uniform float uGain;
uniform sampler2D uMap;
uniform vec2 uMottle;
uniform float uOpacity;
uniform float uId;
uniform float uLineW;
uniform float uFogMul;
uniform float uSheen;
uniform float uStFarMul;
${e}
${t}
${n}
${Ne}
#ifdef ST_POOL
${je}
#endif
uniform vec3 uWet;
${r.fragHead??``}
void main() {
  vec3 p = vWorld;
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 albedo = uAlbedo;
#ifdef USE_COLOR
  albedo *= vColor;
#endif
#ifdef ST_MAP
  vec4 tx = texture2D(uMap, vUv);
  albedo *= tx.rgb;
#endif
#ifdef ST_MOTTLE
  {
    vec3 a = abs(n);
    vec2 uv = a.y > 0.7 ? p.xz : (a.x > a.z ? p.zy : p.xy);
    float m = sl_fbm(vec3(uv * uMottle.y, 0.5), 4);
    albedo *= 1.0 + m * uMottle.x;
  }
#endif
  float alpha = uOpacity;
  vec3 emis = uEmissive;
${r.fragAlbedo??``}
#ifdef ST_WET
  // 濡れた床の水たまり（ちぎれた縁）。水たまりは暗く、蛍光灯と窓が映る
  float wetM = 0.0;
  if (n.y > 0.7) {
    vec2 wq = p.xz * uWet.z;
    wq += vec2(sl_vnoise(vec3(wq * 0.8, 1.7)), sl_vnoise(vec3(wq * 0.8, 8.3))) * 0.9;
    float wn = sl_fbm(vec3(wq, 6.3), 3) + sl_vnoise(vec3(p.xz * 7.0, 2.2)) * 0.06;
    float th = mix(0.45, -0.15, uWet.x);
    float ww = fwidth(wn) * 0.8 + 0.002;
    wetM = smoothstep(th - ww, th + ww, wn);
    albedo *= mix(1.0, 0.86, wetM);
  }
#endif
#ifdef ST_UNLIT
  vec3 col = albedo;
#elif defined(ST_POOL)
  vec3 col = albedo * (st_lightIn(p, n) + st_pools(p, n)) * uGain;
#else
  vec3 col = albedo * st_light(p, n) * uGain;
#endif
#ifdef ST_WET
  {
    vec3 vd0 = normalize(cameraPosition - p);
    float fr = 0.25 + 0.75 * pow(1.0 - clamp(vd0.y, 0.0, 1.0), 3.0);
    col += st_poolRefl(p, uWet.y * fr * mix(0.12, 1.0, wetM));
    // 水たまりのつや（まわりの壁の明るさをぼんやり映す）
    col += uLampCol * 0.05 * wetM * fr * uWet.y;
  }
#endif
  col += emis;
  if (uSheen > 0.0) {
    vec3 vd = normalize(cameraPosition - p);
    vec3 rd = reflect(-vd, n);
    float fr = pow(1.0 - clamp(dot(n, vd), 0.0, 1.0), 5.0);
    float open = 1.0 - st_rayBlocked(p, rd);
    // 映すのは空の色（光源のにじみは入れない）
    col += uSkyCol * uSheen * fr * open * smoothstep(-0.1, 0.15, rd.y);
  }
${r.fragFinal??``}
#ifndef ST_NOFOG
  // 真上から見た図（正射影）では霧を掛けない（間取り図との重ねを見やすく）
  if (!isOrthographic) {
#ifdef ST_FARFOG
  st_fogMul = uStFarMul;
#else
  st_fogMul = uFogMul;
#endif
  col = st_applyFog(col, p, cameraPosition);
  }
#endif
${r.fragPostFog??``}
  gl_FragColor = vec4(col, alpha);
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  gInfo = vec4(vn.xy * 0.5 + 0.5, uId, uLineW * alpha);
}`;return new S({uniforms:o,defines:i,vertexShader:Fe,fragmentShader:c,side:r.side??0,transparent:r.transparent??!1,depthWrite:r.depthWrite??!0,vertexColors:r.vertexColors??!1})}function Le(e,t,n,r,i){let a=Ie,o=new Se,s=new Se,c=new Se,l=new Se,u=new Se,d=new Se;{let r=M.z0,a=M.z1,o=M.soffit;e.boxMM(n.roof,[-M.half,o+.3,r-.2],[M.half,o+.5,a]),e.boxMM(n.frontS,[-M.half,o-.02,r-.2],[M.half,o+.5,r+.1]);for(let t=r+3;t<a;t+=3)e.boxMM(n.beam,[-M.colX,o,t-.12],[M.colX,o+.3,t+.12]);for(let t=r+1;t<a;t+=1)e.boxMM(n.beam,[-M.colX,o+.2,t-.04],[M.colX,o+.3,t+.04]);for(let t of[-7.5,-4.6,-1.6,1.6,4.6,7.5])e.boxMM(n.beam,[t-.08,o+.15,r],[t+.08,o+.3,a]);for(let i of[r,(r+a)/2,a])for(let r of[-1,1]){let a=r<0?-M.colX:M.colX+.45;ve(e,r<0?n.shedColL:n.shedCol,a,i,O.ground+.45,o+.3,r<0?.34:.26,.3),e.box(n.pedestal,[a,O.ground+.22,i],[.9,.45,.9],{collide:!0}),t.colliders.addCentered(a,1.5,i,.4,5,.4),r<0?(T(e,n.shedCol,[a+.1,3.4,i],[a+2.2,o-.05,i],.3,.38),be(e,n.shedCol,a-r*.17,-r,i,3.2,.5,.45,3.9,.3)):T(e,n.shedCol,[a-.1,3.45,i],[a-1.4,o-.05,i],.16,.2),e.boxMM(n.beam,[Math.min(a+r*.6,r*6.5),o-.1,i-.15],[Math.max(a+r*.6,r*6.5),o+.5,i+.15])}for(let t of[-3.5,3.75])for(let s=r+.2;s<a-1;s+=2.65)e.box(n.housing,[t,o-.02,s],[.34,.1,1.45],{shadow:!1}),i([t,o-.1,s],1.25,`z`,.2,.04,!0),e.box(n.board,[t,o-.06,s+.68],[.36,.12,.12],{shadow:!1});Ce({x0:-M.colX,x1:M.colX,z0:r+.2,z1:a,y:o+.3,along:`z`,rib:[.25,.06],trays:[[.7,.25,.35],[-5.9,.2,.3]],pipes:[[-2.6,.18,.06],[2.45,.22,.05],[6.1,.15,.08]],boxes:{n:14,size:[.25,.6],drop:[.05,.3],lanes:[-2.4,.4,2,5.5,-6.5]},hangers:.9,seed:11},c,l),c.box([1.9,o-.05,-7],[1,.45,.9]),c.box([1,o-0,-6.6],[1.6,.2,.25]);for(let t of[-3.45,3.9]){e.box(n.frontS,[t,4.2,r+.25],[1.07,.28,.08],{shadow:!1});for(let i of[-.4,.4])e.box(n.steel,[t+i,4.4,r+.25],[.02,.12,.02])}for(let t of[-1.9,-1.2,-.3,.5,1.1,2.4])e.cyl(n.beam,[t,o-.12,r+0],.13,.2,{segments:10});{let t=r+.8;for(let r of[-.07,.07])e.box(n.lattice,[-9.2+r,1.25,t],[.04,4.8,.04]);for(let r=O.ground;r<3.6;r+=.32)T(e,n.lattice,[-9.27,r,t],[-9.129999999999999,r+.32,t],.02,.02);e.box(n.sign,[-9.95,1,r+.15],[.45,.55,.3]),e.box(n.signal,[-10.35,.15,r+.25],[.12,.3,.05]),e.box(n.sign,[10.5,1,r+.2],[.25,.3,.25]),e.box(n.sign,[10.55,2.35,r+.2],[.25,.3,.25])}}{let i=N.z0,a=N.z1,c={};e.boxMM(n.beamT,[-.35,N.center-.35,i],[.35,N.center+.05,a],c);for(let t of[-1,1]){T(e,n.roofT,[0,N.center+.05,(i+a)/2],[t*N.half,N.edge+.04,(i+a)/2],a-i,.14,c),e.boxMM(n.beamT,[t>0?N.half-.1:-N.half,N.edge-.18,i],[t>0?N.half:-N.half+.1,N.edge+.14,a],c);for(let r=i+6.4;r<a-.5;r+=4.15){let i=t*(N.half-.12),a=N.edge-.15;_e(e,n.hookT,[[i,a,r],[i+t*.02,a-.3,r],[i-t*.12,a-.42,r],[i-t*.6,a-.43,r],[i-t*1,a-.43,r]],.03,c),e.box(n.hookT,[i-t*1,a-.52,r],[.05,.18,.05],c)}for(let r=i+2;r<a;r+=4)T(e,n.beamT,[0,N.center-.1,r],[t*(N.half-.1),N.edge-.12,r],.12,.22,c);for(let r of[.3,.55]){let o=t*N.half*r,s=N.center+(N.edge-N.center)*r-.12;e.boxMM(n.beamT,[o-.07,s-.2,i],[o+.07,s+.1,a],c)}}for(let e of[-1,1]){for(let[t,n]of[[.18,.05],[.5,.035],[.86,.04]]){let r=e*N.half*t,s=N.center+(N.edge-N.center)*t-.22;o.box([r,s,(i+a)/2],[n,n,a-i-.4])}for(let t=i+.9;t<a;t+=1.3){let n=.2+t*7.31%1*.6,r=e*N.half*n,i=N.center+(N.edge-N.center)*n-.1;o.box([r,i-.12,t],[.02,.24,.02]),s.box([r,i-.26,t],[.07,.05,.05])}}for(let r of[20.5,28.5,36.4])ve(e,n.columnT,0,r,O.top,N.center-.35,.15,.15),t.colliders.addCentered(0,1.5,r,.25,3,.25);for(let t of[-1,1])T(e,n.beamT,[0,2.3,36.4],[t*1.3,2.85,36.4],.1,.1,c);e.boxMM(n.beamT,[-.95,2.85,19],[-.1,3.42,20.2],c),e.boxMM(n.beamT,[-1.8,2.3,23.6],[-.25,3.35,25],c);for(let t of[-1.6,-.5])e.box(n.beamT,[t,3.45,24.3],[.04,.3,.04],c);for(let t of[-1,1])T(e,n.beamT,[0,N.center-.1,a-.05],[t*N.half,N.edge,a-.05],.1,.3,c);e.boxMM(n.endT,[-3.8,2.65,a-.3],[3,N.center,a-.1],c),e.boxMM(n.endT,[-3,2.4,a-1.6],[-1.1,2.65,a-.3],c),e.boxMM(n.endT,[.6,2.75,a-2.6],[2.4,2.95,a-.3],c);for(let t of[-2.95,2.95])for(let i=21.4;i<a-.8;i+=4.15){e.box(n.housingT,[t,3.66,i],[.34,.06,1.7],{shadow:!1});for(let r of[-.08,.08])e.box(n.tubeT,[t+r,3.6,i],[.05,.04,1.55],{shadow:!1});r.push({c:[t,3.6,i],axis:[0,0,1],len:1.55})}}{let t=a({color:`#183444`,unlit:!0,fogMul:.7,transparent:!0,depthWrite:!0,fragAlbedo:`  alpha *= smoothstep(36.0, 28.0, cameraPosition.z);`}),n={layer:2,shadow:!1},r=N.z1;for(let i of[-1,1]){T(e,t,[0,N.center+.05,(r+46)/2],[i*N.half,N.edge+.04,(r+46)/2],46-r,.14,n),e.boxMM(t,[i>0?N.half-.1:-N.half,N.edge-.18,r],[i>0?N.half:-N.half+.1,N.edge+.14,46],n);let a=1.9/N.half;T(e,t,[0,N.center+.05,98],[i*1.9,N.center+(N.edge-N.center)*a+.04,98],104,.14,n)}e.boxMM(t,[-.35,N.center-.35,r],[.35,N.center+.05,150],n)}for(let t of[-1,1]){let r=t*6.55,a=51.4,o=3.56,s=3.68,c=t<0?-10.1:2,l=t<0?-2:10.1,f=46.5,p=56.05;e.box(n.columnBase,[r,.6,a],[.6,1.2,.6],{collide:!0}),e.box(n.columnBase,[r,1.22,a],[.64,.05,.64]),e.box(n.columnB,[r,4.76/2,a],[.36,2.3600000000000003,.36],{collide:!0}),e.box(n.columnEdge,[r-.17,4.8100000000000005/2,51.23],[.03,2.31,.03]),e.cyl(n.bcFunnel,[r,3.2600000000000002,a],.28,.6,{radiusTop:1.5,segments:4,rotY:Math.PI/4});for(let t of[-1,1])T(e,n.columnB,[r,2.1,a],[r+t*2.2,3.5,a],.12,.16),T(e,n.columnB,[r,2.35,a],[r,3.5,a+t*1.9],.12,.16,{up:[1,0,0]}),T(e,n.columnB,[r,2.75,a],[r,3.5,a+t*2.8],.08,.1,{up:[1,0,0]});e.boxMM(n.roofB,[c,o,f],[l,3.6500000000000004,p]),e.boxMM(n.fasciaN,[c-.04,3.54,46.46],[l+.04,s,46.54]),e.boxMM(n.fasciaN,[c-.04,3.54,56.01],[l+.04,s,56.089999999999996]),e.boxMM(n.beamB,[c-.04,3.54,f],[c+.04,s,p]),e.boxMM(n.beamB,[l-.04,3.54,f],[l+.04,s,p]);for(let t of[46.55,56])e.boxMM(n.bcValance,[c,3.08,t-.05],[l,o,t+.05]);Ce({x0:c+.1,x1:l-.1,z0:46.6,z1:55.949999999999996,y:o,along:`z`,rib:[0,0],beams:[[r,.3,.3],[r-2.4,.16,.1],[r+2.4,.16,.1],[c+.6,.12,.08],[l-.6,.12,.08]],cross:[[47.1,.18,.1],[49.4,.18,.1],[51.7,.18,.1],[54,.18,.1],[55.449999999999996,.18,.1]],pipes:[[r-1.2,.1,.05],[r+1.4,.12,.04]],boxes:{n:6,size:[.2,.45],drop:[.05,.3],lanes:[r-1.5,r+1.6,r-2.2,r+2.2]},hangers:1.1,seed:t<0?21:22},u,d),e.box(n.steel,[t*8.5,4.3,50.6],[.05,1.25,.05]),e.box(n.steel,[t*7.5,3.7800000000000002,51.05],[.08,.2,.08]),T(e,n.steel,[t*9.5,s,56],[t*9.5,4.88,55.45],.05,.05),T(e,n.steel,[t*9.5,s,55.65],[t*9.5,4.58,55.55],.03,.03);let m=t*4.75,h=t*7.2,g=Math.min(m,h),_=Math.max(m,h);e.boxMM(n.booth,[g,0,49.45],[_,2.55,50.6],{collide:!0}),e.boxMM(n.shelterDark,[g-.06,2.55,49.39],[_+.06,2.85,50.660000000000004]);let v=h,y=t,b=e=>[Math.min(v+y*e,v+y*(e+.02)),Math.max(v+y*e,v+y*(e+.02))],[x,ee]=b(0),te=49.53,S=50.52;e.boxMM(n.doorFrame,[x,.02,49.49],[ee,2,te]),e.boxMM(n.doorFrame,[x,.02,S],[ee,2,50.56]),e.boxMM(n.doorFrame,[x,1.96,49.49],[ee,2,50.56]);let[ne,re]=b(.01);e.boxMM(n.doorLeaf,[ne,.04,te],[re,1.96,S]),e.boxMM(n.doorFrame,[ne,.04,50.010000000000005],[re,1.96,50.040000000000006]);let[ie,ae]=b(.02);for(let[t,r]of[[49.6,49.965],[50.08500000000001,50.45]])e.boxMM(n.glass,[ie,1.08,t],[ae,1.78,r]);e.box(n.board,[v+y*.04,1,49.955000000000005],[.02,.1,.025]),e.boxMM(n.board,[ie,2.12,49.57],[ae,2.3,49.95]),e.boxMM(n.board,[ie,2.08,50.010000000000005],[ae,2.2,50.27]),e.cyl(n.board,[v+y*.05,2.22,50.46],.085,.03,{axis:`x`,segments:16});let oe=49.43;for(let[t,r]of[[g+.2,g+1.12],[_-1.12,_-.2]]){e.boxMM(n.glass,[t,1,49.42],[r,2.15,oe]);for(let i=1;i<4;i++){let a=t+i*(r-t)/4;e.boxMM(n.shelterDark,[a-.02,1,49.4],[a+.02,2.15,oe])}}e.boxMM(n.booth,[Math.min(t*4,t*5.05),0,51.8],[Math.max(t*4,t*5.05),2.1,53.3],{collide:!0}),e.boxMM(n.shelterDark,[Math.min(t*4,t*5.05)-.04,2.1,51.76],[Math.max(t*4,t*5.05)+.04,2.25,53.34]);for(let r of[52.35,52.85]){e.boxMM(n.ticket,[t<0?-5.45:5.05,0,r-.21],[t<0?-5.05:5.45,1.55,r+.21],{collide:!0});let i=t<0?-5.45:5.45;e.boxMM(n.ticketScreen,[i-.012,1,r-.13],[i+.012,1.22,r+.13]),e.boxMM(n.shelterDark,[i-.06,1.55,r-.21],[i+.06,1.68,r+.21])}for(let[r,a]of[[48.77,1.95],[53.76,1.95]])i([t*9.55,3.22,r],a,`z`,.12,.09),e.box(n.shelterDark,[t*9.55,3.34,r],[.04,.18,a*.9],{shadow:!1});for(let[r,a]of[[48.7,1.6],[53.9,2.2]])i([t*3.6,3.2,r],a,`z`,.08),e.box(n.shelterDark,[t*3.6,3.32,r],[.04,.22,a*.9],{shadow:!1});e.box(n.steel,[t*3.5,o/2,47.4],[.08,o,.08]),e.box(n.steel,[r,1.3,54.5],[.07,2.6,.07]),e.box(n.shelterDark,[r,1.6,54.5],[.12,.38,.12]),e.box(n.tube,[r-t*.08,2.55,54.3],[.06,.24,.5],{shadow:!1}),e.box(n.shelterDark,[r-t*.08,2.55,54.95],[.07,.24,.85],{shadow:!1}),e.box(n.lampBox,[t<0?-9:9,2.35,49],[.12,.3,.18],{shadow:!1})}return{canDark:o,canLite:s,shedDark:c,shedLite:l,bcDark:u,bcLite:d}}function Re(e,t,n){return(r,i,a,o,s=.04,c=!1)=>{if(c){let n=new te(o/2,Math.max(i-o,.01),4,10);a===`x`?n.rotateZ(Math.PI/2):n.rotateX(Math.PI/2),e.mesh(n,t.tube,r,{shadow:!1})}else e.box(t.tube,r,a===`x`?[i,s,o]:[o,s,i],{shadow:!1});n.push({c:r,axis:a===`x`?[1,0,0]:[0,0,1],len:i})}}function ze(e,t,n,r){let i=new pe(e);return r(i),Ge(i.root),i.finalize(),n&&i.root.traverse(e=>e.layers.set(1)),t.add(i.root),i.root}var Be=null,Ve=null,He=new Map,Ue=null;function We(e){let t=e;if(!t.isShaderMaterial||!t.uniforms?.uAlbedo)return null;let n=Object.keys(t.defines??{}),r=``;if(n.length===0){if(Be??=Ie({color:`#ffffff`}),t.fragmentShader!==Be.fragmentShader)return null}else if(n.length===1&&n[0]===`ST_POOL`){if(Ve??=Ie({color:`#ffffff`,pool:!0}),t.fragmentShader!==Ve.fragmentShader)return null;r=`pool`}else if(n.length===1&&n[0]===`ST_UNLIT`){if(Ue??=Ie({color:`#ffffff`,unlit:!0}),t.fragmentShader!==Ue.fragmentShader)return null;r=`unlit`}else return null;if(t.transparent||t.vertexColors)return null;let i=t.uniforms,a=i.uEmissive.value;return r!==`unlit`&&(a.r!==0||a.g!==0||a.b!==0)||i.uGain.value!==1||i.uSheen.value!==0||i.uOpacity.value!==1||i.uMap.value||r===``&&i.uFogMul.value!==1?null:`${t.side}|${r}|${r?i.uFogMul.value:``}`}function Ge(e){for(let t of[...e.children]){let e=t;if(!e.isMesh||e.isInstancedMesh||Array.isArray(e.material))continue;let n=e.material,r=We(n);if(r===null)continue;let i=He.get(r),a=r.includes(`unlit`);if(!i){let e=r.includes(`pool`);i=Ie({color:`#ffffff`,vertexColors:!0,side:n.side,pool:e,unlit:a,fogMul:e||a?n.uniforms.uFogMul.value:1}),He.set(r,i)}let o=n.uniforms.uAlbedo.value.clone();a&&o.add(n.uniforms.uEmissive.value);let s=e.geometry.clone(),c=s.getAttribute(`position`).count,l=new Float32Array(c*3);for(let e=0;e<c;e++)l.set([o.r,o.g,o.b],e*3);s.setAttribute(`color`,new _(l,3)),e.geometry.dispose(),e.geometry=s,e.material=i,e.castShadow=!1,e.receiveShadow=!1}}function Ke(e,t,n,r){let i=[],a=new pe(e);r(a);let o=new se;for(let e of[...a.root.children]){let t=e;if(t.isInstancedMesh){for(let e=0;e<t.count;e++){t.getMatrixAt(e,o);let n=t.geometry.clone();n.applyMatrix4(o),a.root.add(new ie(n,t.material))}t.removeFromParent()}}Ge(a.root);for(let e of a.root.children){let t=e,n=t.material;if(t.isMesh&&n?.vertexColors&&n.side===0)for(let[e,r]of He){if(r!==n)continue;let i=`2${e.slice(1)}`,a=He.get(i);a||(a=Ie({color:`#ffffff`,vertexColors:!0,side:2,pool:e.includes(`pool`),unlit:e.includes(`unlit`),fogMul:n.uniforms.uFogMul.value}),He.set(i,a)),t.material=a;break}}let s=(e,t)=>`${Math.floor(e/n)},${Math.floor(t/n)}`,c=new Map,u=new ne,d=new l;for(let e of[...a.root.children]){let n=e;if(!n.isMesh||Array.isArray(n.material)){e.layers.set(1),e.renderOrder=1,t.add(e),i.push(e);continue}n.updateMatrixWorld(!0),n.geometry.boundingBox||n.geometry.computeBoundingBox(),u.copy(n.geometry.boundingBox).applyMatrix4(n.matrixWorld),u.getCenter(d);let r=`${s(d.x,d.z)}|${n.material.uuid}`,a=c.get(r);a||c.set(r,a=[]),a.push(n)}for(let e of c.values()){let n=Object.keys(e[0].geometry.attributes).filter(t=>e.every(n=>n.geometry.attributes[t]?.itemSize===e[0].geometry.attributes[t].itemSize)),r=e.map(e=>{let t=e.geometry.index?e.geometry.toNonIndexed():e.geometry.clone();t.applyMatrix4(e.matrixWorld);for(let e of Object.keys(t.attributes))n.includes(e)||t.deleteAttribute(e);return t}),a=r.length>1?fe(r,!1):r[0];if(!a)continue;a.computeBoundingSphere();let o=new ie(a,e[0].material);o.layers.set(1),o.castShadow=!1,o.receiveShadow=!1,o.renderOrder=1,t.add(o),i.push(o);for(let t of e)t.removeFromParent(),t.geometry.dispose();if(r.length>1)for(let e of r)e.dispose()}return i}var qe=class{b;T;boxes=[];constructor(e,t){this.T=t;let n=this,r={add(e,t){return n.boxes.push(new ne(new l(e.x,e.y,e.z),new l(t.x,t.y,t.z))),null},addCentered(e,t,r,i,a,o){return n.boxes.push(new ne(new l(e-i/2,t-a/2,r-o/2),new l(e+i/2,t+a/2,r+o/2))),null},addObject(e){return n.boxes.push(new ne().setFromObject(e)),null}};this.b=new pe({...e,colliders:r})}p(e){let t=new l(...e).applyMatrix4(this.T);return[t.x,t.y,t.z]}dir(e){let t=new l(...e).transformDirection(this.T);return[t.x,t.y,t.z]}m(e){return new se().multiplyMatrices(this.T,e)}finish(e,t){for(let e of[...this.b.root.children])e.applyMatrix4(this.T),e.updateMatrixWorld(!0);Ge(this.b.root),this.b.finalize(),e.add(this.b.root);for(let e of this.boxes){let n=e.clone().applyMatrix4(this.T);t.add(n.min,n.max)}}};function Je(e,t,n,r,i){return new se().makeTranslation(n,0,r).multiply(new se().makeRotationY(i)).multiply(new se().makeTranslation(-e,0,-t))}var Ye=new se;function Xe(e,t,n,r,i,a,o=0){let s=t.clone();o&&s.applyMatrix4(Ye.makeRotationX(o)),s.translate(...a),s.applyMatrix4(Ye.makeRotationY(i)),e.mesh(s,n,r)}function Ze(e,t,n,r,i,a){let o=new ce(new b(i.map(e=>new l(...e)),!1,`catmullrom`,.3),16,a,6,!1);o.applyMatrix4(Ye.makeRotationY(r)),e.mesh(o,t,n)}function Qe(e){let t=e.width,n=e.seatY??.43,r=e.backTop??.86,i=e.taper??.12,a=e.corner??.07,o=new b([[0,n-.04,-.22],[0,n,-.19],[0,n+.01,-.1],[0,n-.005,.04],[0,n,.14],[0,n+.05,.2],[0,n+.16,.235],[0,(n+r)/2+.08,.26],[0,r,.3]].map(e=>new l(e[0],e[1],e[2])),!1,`catmullrom`,.4),s=o.getSpacedPoints(24),u=o.getLength(),d=[],f=[];for(let e=0;e<=24;e++){let o=s[e],c=(1-e/24)*u,l=t/2*(1+i*Math.max(0,(o.y-(n+.1))/(r-n))),f=c<a?l-a+Math.sqrt(Math.max(0,a*a-(a-c)*(a-c))):l;for(let e=0;e<=8;e++){let t=-f+2*f*e/8,n=.012*(2*e/8-1)**2;d.push(t,o.y+n,o.z)}}for(let e=0;e<24;e++)for(let t=0;t<8;t++){let n=e*9+t,r=n+8+1;f.push(n,r,n+1,n+1,r,r+1)}let p=new v;return p.setAttribute(`position`,new c(d,3)),p.setAttribute(`uv`,new c(Array(d.length/3*2).fill(0),2)),p.setIndex(f),p.computeVertexNormals(),p.toNonIndexed()}function $e(e,t,n,r,i,a,o=.56){let s=a*o,c=Qe({width:o-.07,backTop:.84,taper:.1,corner:.06});for(let n=0;n<a;n++)Xe(e,c,t,r,i,[-s/2+o*(n+.5),0,0]);Xe(e,new C(s-.1,.04,.04),n,r,i,[0,.37,-.02]),Xe(e,new C(s-.1,.04,.04),n,r,i,[0,.37,.17]);let l=Math.max(2,Math.round(s/1.8)+1);for(let t=0;t<l;t++){let a=-s/2+.2+(s-.4)*t/(l-1);Xe(e,new C(.05,.36,.05),n,r,i,[a,.18,.08]),Xe(e,new C(.04,.03,.46),n,r,i,[a,.015,.06]),Xe(e,new C(.04,.04,.3),n,r,i,[a,.37,.08])}}function et(e,t,n,r,i){let a=Qe({width:.53,seatY:.42,backTop:.86,taper:.1,corner:.08});for(let n of[-.28,.28])Xe(e,a,t,r,i,[n,0,0]);Xe(e,new C(1.2,.035,.035),n,r,i,[0,.37,.05]),Xe(e,new C(1.2,.035,.035),n,r,i,[0,.37,-.12]);for(let t of[-.55,.55]){let a=Math.sign(t);Ze(e,n,r,i,[[t,0,-.16],[t,.2,-.13],[t,.38,-.08]],.016),Ze(e,n,r,i,[[t,0,.2],[t,.2,.17],[t,.38,.1]],.016),Xe(e,new C(.03,.02,.4),n,r,i,[t,.01,.02]),Ze(e,n,r,i,[[t+a*.03,.4,.16],[t+a*.06,.55,.12],[t+a*.065,.6,0],[t+a*.065,.58,-.14],[t+a*.04,.44,-.2]],.016)}}function tt(e,t,n,r,i,a=1.8){let o=new b([[0,.4,-.22],[0,.43,-.1],[0,.42,.08],[0,.46,.2],[0,.62,.27],[0,.8,.33],[0,.92,.38]].map(e=>new l(e[0],e[1],e[2])));for(let n=0;n<=10;n++){if(n===4)continue;let s=n/10,c=o.getPointAt(s),l=o.getTangentAt(s),u=Math.atan2(l.y,l.z);Xe(e,new C(a,.02,.075),t,r,i,[0,c.y,c.z],-u)}for(let t of[-a/2+.15,a/2-.15])Ze(e,n,r,i,[[t,0,-.28],[t,.2,-.16],[t,.4,-.05]],.022),Ze(e,n,r,i,[[t,0,.32],[t,.2,.2],[t,.4,.06]],.022),Ze(e,n,r,i,[[t,.39,-.2],[t,.41,.1],[t,.58,.25],[t,.9,.36]],.02)}var J={xEnd:we.xEnd,zc:we.zc,half:F.half,soffit:F.soffit};function nt(e,t,n,r){let i=new qe(e,Je(J.xEnd,J.zc,F.x,F.z1,Math.PI/2)),a=i.b,o=new Se,s=new Se,c=[],l=(e,t,r,i,o=.04,s=!1)=>{if(s){let o=new te(i/2,Math.max(t-i,.01),4,10);r===`x`?o.rotateZ(Math.PI/2):o.rotateX(Math.PI/2),a.mesh(o,n.tube,e,{shadow:!1})}else a.box(n.tube,e,r===`x`?[t,o,i]:[i,o,t],{shadow:!1});c.push({c:e,axis:r===`x`?[1,0,0]:[0,0,1],len:t})},u=J.soffit,d=J.xEnd+.5,f=J.xEnd+41,p=J.zc;a.boxMM(n.roof,[d,u,p-J.half+.2],[f,u+.25,p+J.half-.2]),a.boxMM(n.frontD,[d,3.43,p-J.half+.2],[d+.4,u+.25,p+J.half-.2]);for(let e of[-1.38,1.2])a.boxMM(n.beam,[d,3.5,p+e-.1],[f,u,p+e+.1]);for(let e of[-2.2,2.2])a.boxMM(n.beam,[d,3.55,p+e-.12],[f,u,p+e+.12]);for(let e of[-4.6,4.6])a.boxMM(n.beam,[d,3.15,p+e-.14],[f,u,p+e+.14]);for(let e=d+6;e<f;e+=6)a.boxMM(n.beam,[e-.1,u-.25,p-J.half+.3],[e+.1,u,p+J.half-.3]);a.boxMM(n.frontD,[f-.4,3.43,p-J.half+.2],[f,u+.25,p+J.half-.2]);for(let e of[2.15,4.25,13.5,22.5,31.5,40]){let t=J.xEnd+e;for(let r of[-4.6,4.6]){let i=e===4.25&&r>0?4.65:r;ve(a,n.steelD,t,p+i,1.1,u,.18,.2,{rotY:Math.PI/2}),a.box(n.pedestalD,[t,.55,p+i],[.3,1.1,.3],{collide:!0}),a.ctx.colliders.addCentered(t,2,p+i,.3,4,.3)}}Ce({x0:d+.4,x1:f,z0:p-J.half+.3,z1:p+J.half-.3,y:u,along:`x`,rib:[.22,.05],beams:[[-3.3,.18,.12],[3.3,.18,.12],[-5.8,.25,.14],[5.8,.25,.14]],trays:[[.05,.3,.42]],pipes:[[-.6,.2,.05],[.7,.24,.04],[-2.7,.15,.06],[2.6,.12,.05]],boxes:{n:18,size:[.2,.5],drop:[.05,.25],lanes:[-2.6,-.4,.5,2.7,-4.8,4.9]},hangers:.8,seed:5},o,s);for(let e of[-4.6,4.6]){let t=Math.sign(e);be(a,n.steelD,J.xEnd+2.15,t,p+e-t*.1,2.95,.5,.48,u,.12,{rotY:Math.PI/2});for(let t=0;t<4;t++){let r=2.85+t%2*.28;T(a,n.steelD,[J.xEnd+2.15+t*.7,r,p+e*.98],[J.xEnd+2.85+t*.7,3.41-t%2*.28,p+e*.98],.03,.03)}e>0?a.box(n.sign,[J.xEnd+2.15,2.35,p+e*.96],[.14,.35,.2]):a.box(n.signLight,[J.xEnd+2.05,2.23,p-4.3],[.04,.16,.55]),a.box(n.sign,[J.xEnd+2.155,.68,p+e*.95],[.08,.2,.06])}a.cyl(n.steelD,[J.xEnd+4.6,.95,p+4.75],.06,1.9,{segments:8}),a.box(n.steelD,[J.xEnd+4.6,2.5,p+4.7],[.05,.05,.4]),a.boxMM(n.steelD,[J.xEnd+2.15,2.9,p-4.7],[J.xEnd+4.25,u,p-4.5]),T(a,n.steelD,[J.xEnd+2.15,2.35,p-4.6],[J.xEnd+3.2,2.95,p-4.6],.05,.05),a.boxMM(n.steelD,[J.xEnd+2.15,2.66,p+4.48],[J.xEnd+4.25,2.72,p+4.52]);for(let e=0;e<6;e++){let t=J.xEnd+2.15+e*.35;T(a,n.steelD,[t,2.69,p+4.5],[t+.35,3.15,p+4.5],.025,.025)}_e(a,n.steel,[[d+.2,3.42,p+3.6],[d+.2,3.22,p+3.3],[d+.2,3.3,p+2.9],[d+.2,3.42,p+2.6]],.03),_e(a,n.steel,[[d+.2,3.42,p-2.5],[d+.2,3.27,p-2.75],[d+.2,3.38,p-3.1]],.03),_e(a,n.steel,[[d+.25,3.42,p+.6],[d+.25,3.1,p+.6],[d+.25,3.05,p+.25],[d+.25,3.05,p-.55]],.035),a.box(n.sign,[d+.3,3.15,p-4.06],[.15,.42,.82]);for(let e of[-.3,.3])a.box(n.steel,[d+.3,3.4,p-4.06+e],[.03,.12,.03]);let m=[-61.6,-60.1,-57.1,-54.75,-52.5,-49.9,-47.3,-44.7,-42.1,-39.5,-36.9,-34.3,-31.7,-29.1,-26.5,-23.9];for(let e of[-1.38,1.2])for(let t of m)t>f-.8||(a.box(n.housing,[t,3.53,p+e],[1.25,.08,.2],{shadow:!1}),l([t,3.46,p+e],1,`x`,.11,.04,!0));for(let e of[.99,-1.07])et(a,n.benchD,n.frameD,[-60.05,0,p+e],Math.PI/2),a.ctx.colliders.addCentered(-60.05,.45,p+e,.6,.9,1.3);for(let e of[-38.5,-30])et(a,n.benchD,n.frameD,[e,0,p-3.2],0),a.ctx.colliders.addCentered(e,.45,p-3.2,1.3,.9,.6);i.finish(t,e.colliders);for(let e of c)r.push({c:i.p(e.c),axis:i.dir(e.axis),len:e.len});let h=e=>{let t=new Se;for(let n of e.mats)t.mats.push(i.m(n));return t};return{dark:h(o),lite:h(s)}}function rt(e){let t=Array.from({length:12},(t,n)=>{let r=e.strips[n];return r?new f(Math.min(r.u0,r.u1),Math.max(r.u0,r.u1),Math.min(r.v0,r.v1),Math.max(r.v0,r.v1)):new f(0,0,0,0)}),n=Array.from({length:12},(t,n)=>e.strips[n]?.kind??0),r=e.shapes??[],i=Array.from({length:16},(e,t)=>{let n=r[t];return n?new f(n.x,n.z,n.rx,n.rz):new f(0,0,0,0)}),a=Array.from({length:16},(e,t)=>r[t]?.rot??0),o={uFrame:{value:new l(e.frame.cx,e.frame.cz,+!!e.frame.alongX)},uStrips:{value:t},uStripKind:{value:n},uYellow:{value:new w(e.yellow??`#c8c062`)},uWhite:{value:new w(e.white??`#80aab0`)},uJoint:{value:e.joint??0},uYShift:{value:new f(...e.yShift??[0,1,0,0])},uPud:{value:new f(...e.puddle??[.3,.2,.3,3])},uPud2:{value:new s(...e.puddleVar??[.05,0])},uPE:{value:i},uPER:{value:a},uPEN:{value:r.length},uDry:{value:new l(...e.dryZone??[0,0,0])},uReflTex:{value:e.refl.target.texture},uReflMatrix:{value:e.refl.matrix},uRefl:{value:new l(e.wetRefl??1,e.dryRefl??.25,.85)},uStripRefl:{value:e.stripRefl??.6},uLookRefl:{value:e.lookRefl===!1?0:1},uReflTint:{value:new w(e.reflTint??`#a8f0ff`)},uOldFrame:{value:new l(e.oldFrame?.ox??0,e.oldFrame?.oz??0,+!!e.oldFrame)},uOldSign:{value:new s(e.oldFrame?.su??1,e.oldFrame?.sv??1)}};return Ie({color:e.color,line:0,uniforms:o,fragHead:`
uniform vec3 uFrame;
uniform vec4 uStrips[12];
uniform float uStripKind[12];
uniform vec3 uYellow;
uniform vec3 uWhite;
uniform float uJoint;
uniform vec4 uYShift;
uniform vec4 uPud;
uniform vec2 uPud2;
uniform vec4 uPE[16];
uniform float uPER[16];
uniform int uPEN;
uniform vec3 uDry;
uniform sampler2D uReflTex;
uniform mat4 uReflMatrix;
uniform vec3 uRefl;
uniform float uStripRefl;
uniform float uLookRefl;
uniform float uStStripRefl;
uniform float uStFloorRefl;
uniform float uStWet;
uniform float uStPudLift;
uniform float uStStripGain;
uniform vec3 uReflTint;
uniform vec3 uOldFrame;
uniform vec2 uOldSign;
// 水たまりの形（正 = 水）。ノイズのしきい値と、手で置いた楕円の和
float fl_puddle(vec2 xz, float u, float v) {
  // 横（u）に長い塊（長手 v に細かく）
  float nz = sl_warp(vec3(vec2(u * 0.7, v * 1.3) * uPud.x, 0.37), 5);
  float th = uPud.y + uPud.z * smoothstep(0.3, 0.9, abs(u) / uPud.w) + sl_fbm(vec3(xz * uPud2.x, 2.1), 3) * uPud2.y;
  th += uDry.z * smoothstep(uDry.x - 2.0, uDry.x, v) * (1.0 - smoothstep(uDry.y, uDry.y + 2.0, v));
  float f = nz - th;
  // 手で置いた水たまりの縁と中の乾いた島（横に長い、ちぎれた形）。
  // 縁のノイズは、どれかの水たまりの近く（楕円の 1.45 倍の内側。外では値が水にならない）でだけ計算する
  float rag = 0.0;
  bool ragDone = false;
  for (int i = 0; i < 16; i++) {
    if (i >= uPEN) break;
    vec4 e = uPE[i];
    vec2 d = xz - e.xy;
    float c = cos(uPER[i]);
    float s = sin(uPER[i]);
    d = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / e.zw;
    float L = length(d);
    if (L > 1.45) continue;
    if (!ragDone) {
      rag = sl_warp(vec3(vec2(u * 0.9, v * 2.6), 5.1), 4) * 0.8 + sl_vnoise(vec3(u * 3.0, v * 9.0, 8.3)) * 0.25;
      ragDone = true;
    }
    f = max(f, (1.0 - L) * 0.4 + rag * 0.18 - 0.02);
  }
  // 縁をぎざぎざに
  f += sl_vnoise(vec3(xz * 9.0, 1.3)) * 0.025 + sl_vnoise(vec3(xz * 31.0, 4.1)) * 0.012;
  return f;
}
`,fragAlbedo:`
  float puddle = 0.0;
  float strip = 0.0;
  {
    vec2 rel = p.xz - uFrame.xy;
    float u = uFrame.z > 0.5 ? rel.y : rel.x;
    float v = uFrame.z > 0.5 ? rel.x : rel.y;
    // 模様に使う xz（回して置いたホームは回す前の座標）
    vec2 pxz = p.xz;
    if (uOldFrame.z > 0.5) {
      u *= uOldSign.x;
      v *= uOldSign.y;
      pxz = vec2(uOldFrame.x + v, uOldFrame.y + u);
    }
    vec2 aa = fwidth(vec2(u, v));
    for (int i = 0; i < 12; i++) {
      vec4 s = uStrips[i];
      float k = uStripKind[i];
      if (k < 0.5) continue;
      float uu = u;
      if (k < 1.5) uu = sign(u) * (abs(u) - mix(uYShift.z, uYShift.w, clamp((v - uYShift.x) / (uYShift.y - uYShift.x), 0.0, 1.0)));
      if (uu < s.x || uu > s.y || v < s.z || v > s.w) continue;
      if (k < 2.5) strip = 1.0;
      if (k < 1.5) {
        // 黄色の線状ブロック（長手の筋）
        float r = abs(fract((uu - s.x) / 0.075) - 0.5);
        float rid = smoothstep(0.18, 0.3, r);
        float blk = step(0.012, abs(fract(v / 0.3 + 0.5) - 0.5) * 0.3);
        albedo = uYellow * uStStripGain * mix(0.72, 1.0, rid) * mix(0.8, 1.0, blk);
      } else if (k < 2.5) {
        // 白い縁の警告ブロック（長手の筋）
        float r = abs(fract((u - s.x) / 0.06) - 0.5);
        albedo = uWhite * uStStripGain * mix(0.7, 1.0, smoothstep(0.15, 0.3, r));
      } else if (k < 3.5) {
        // 黄色の点状ブロック
        vec2 c = fract(vec2(u - s.x, v) / 0.075) - 0.5;
        float dots = smoothstep(0.32, 0.22, length(c));
        float blk = step(0.012, min(abs(fract((u - s.x) / 0.3 + 0.5) - 0.5), abs(fract(v / 0.3 + 0.5) - 0.5)) * 0.3);
        albedo = uYellow * mix(0.78, 1.05, dots) * mix(0.75, 1.0, blk);
      } else if (k < 4.5) {
        albedo = uWhite;
      } else {
        // 目地の線（暗い）
        albedo *= 0.55;
      }
    }
    if (uJoint > 0.0) {
      float j = abs(fract(v / uJoint + 0.5) - 0.5) * uJoint;
      albedo *= mix(0.7, 1.0, smoothstep(0.004, 0.004 + aa.y * 1.5, j));
    }
    {
      float f = fl_puddle(pxz, u, v);
      float w = fwidth(f) * 0.8 + 0.002;
      puddle = smoothstep(-w, w, f);
    }
    // 水たまりの外は少し暗く（濡れ）
    albedo *= mix(uRefl.z, 1.0, puddle);
  }
`,fragFinal:`
  {
    vec4 pc = uReflMatrix * vec4(p, 1.0);
    vec2 ruv = pc.xy / pc.w;
    vec3 r = texture2D(uReflTex, ruv).rgb * uReflTint;
    vec3 vd = normalize(cameraPosition - p);
    float c = clamp(vd.y, 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - c, 5.0);
    // 水たまりの映り込み: 物理的なフレネルと、近くでも鏡のように映す絵の強さを場所ごとに混ぜる（uStWet）
    float fresW = mix(fres, 0.5 + 0.5 * pow(1.0 - c, 3.0), uStWet);
    // 乾いた所は浅い角度でだけ映す（荒れた面のつや）
    float k = mix(uRefl.y * mix(1.0, uStFloorRefl, uLookRefl) * pow(1.0 - c, 9.0), uRefl.x * fresW, puddle);
    // 点字ブロックの帯は濡れてつやがある
    k = max(k, uStripRefl * uStStripRefl * pow(1.0 - c, 12.0) * strip);
    col = mix(col, r, clamp(k, 0.0, 1.0));
    // 水たまりの明るさの持ち上げ（場所ごと。浅い角度で明るい霧を映す絵の表現）
    col += uSkyCol * uStPudLift * puddle * (0.4 + 0.6 * pow(1.0 - c, 3.0));
  }
`})}function it(r,i){let a=r.length,o=new Float32Array(a*4*3),s=new Float32Array(a*4*4),c=new Float32Array(a*4*2),u=[];r.forEach((e,t)=>{for(let n=0;n<4;n++){let r=t*4+n;o.set(e.c,r*3),s.set([...e.axis,e.len/2],r*4),c.set([n&1?1:-1,n&2?1:-1],r*2)}let n=t*4;u.push(n,n+1,n+2,n+2,n+1,n+3)});let d=new v;d.setAttribute(`position`,new _(o,3)),d.setAttribute(`aAxis`,new _(s,4)),d.setAttribute(`aCorner`,new _(c,2)),d.setIndex(u),d.boundingSphere=new g(new l,1e5);let f=new S({uniforms:{...h,...q,uR:{value:i.radius},uColor:{value:new w(i.color).multiplyScalar(i.strength)}},vertexShader:`
      attribute vec4 aAxis;
      attribute vec2 aCorner;
      uniform float uR;
      uniform vec2 uStTubeGlow;
      varying vec2 vUV;
      varying float vHalf;
      varying vec3 vWorld;
      void main() {
        vec3 c = position;
        vec3 ax = aAxis.xyz;
        vec3 toCam = normalize(cameraPosition - c);
        vec3 side = normalize(cross(ax, toCam));
        // 軸の方向から見るときは丸く広がる
        float endOn = abs(dot(ax, toCam));
        float h = aAxis.w;
        float r = uR * uStTubeGlow.y;
        vec3 wp = c + ax * aCorner.x * (h + r) + side * aCorner.y * r;
        vUV = vec2(aCorner.x * (h + r), aCorner.y * r);
        vHalf = h * (1.0 - endOn * 0.85);
        vWorld = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,fragmentShader:`
      layout(location = 1) out highp vec4 gInfo;
      uniform vec3 uColor;
      uniform float uR;
      uniform vec2 uStTubeGlow;
      uniform vec3 uStTubeCol;
      varying vec2 vUV;
      varying float vHalf;
      varying vec3 vWorld;
      ${e}
      ${t}
      ${n}
      void main() {
        float d = length(vec2(max(abs(vUV.x) - vHalf, 0.0), vUV.y)) / (uR * uStTubeGlow.y);
        // 芯に近い明るいにじみと、広く薄いにじみ
        float a = exp(-d * d * 9.0) * 0.6 + exp(-d * 3.2) * 0.4;
        a *= smoothstep(1.0, 0.75, d);
        float od = sl_fogOptical(vWorld, cameraPosition);
        gl_FragColor = vec4(uColor * uStTubeCol * uStTubeGlow.x * a * exp(-od), 1.0);
        gInfo = vec4(0.0);
      }`,transparent:!0,blending:2,depthWrite:!1}),p=new ie(d,f);return p.name=`tube-glow`,p.frustumCulled=!1,p.renderOrder=10,p}var at=[`horizon`,`upper`,`zenith`,`ground`,`glowA`,`glowB`,`sky`,`out`,`in`];function ot(e){let t=(e,t=1)=>new w(e).multiplyScalar(t);return{at:e.at,cols:[t(e.horizon),t(e.upper),t(e.zenith),t(e.ground),t(e.glowA.color,e.glowA.strength),t(e.glowB.color,e.glowB.strength),t(e.sky),t(e.out),t(e.in)],vecs:[new f(...e.shape),new f(...e.glowA.dir,e.glowA.power),new f(...e.glowB.dir,e.glowB.power)],dens:e.dens,lift:e.lift,clouds:e.clouds,blockFog:e.blockFog,start:e.start,floorRefl:e.floorRefl,hills:e.hills,stripRefl:e.stripRefl,tubeGlow:e.tubeGlow,fieldGain:e.fieldGain,tubeColor:new w(e.tubeColor).multiplyScalar(e.tubePower),wet:e.wet,lampMul:e.lampMul,pudLift:e.pudLift,stripGain:e.stripGain,farMul:e.farMul??.26,stream:e.stream??1}}var st=class{packed;tc=at.map(()=>new w);tv=[new f,new f,new f];lastX=NaN;lastZ=NaN;constructor(e){this.packed=e.map(ot)}apply(e,t){if(e===this.lastX&&t===this.lastZ)return;this.lastX=e,this.lastZ=t;let n=this.packed.map(n=>1/(1+(Math.hypot(e-n.at[0],t-n.at[1])/5)**3)),r=n.reduce((e,t)=>e+t,0);this.tc.forEach(e=>e.setRGB(0,0,0)),this.tv.forEach(e=>e.set(0,0,0,0));let i=0,a=0,o=0,s=0,c=0,l=0,u=0,d=0,f=[0,0],p=0,m=new w(0,0,0),h=0,g=0,_=0,v=0,y=0,b=0;this.packed.forEach((e,t)=>{let x=n[t]/r;e.cols.forEach((e,t)=>{this.tc[t].r+=e.r*x,this.tc[t].g+=e.g*x,this.tc[t].b+=e.b*x}),e.vecs.forEach((e,t)=>this.tv[t].addScaledVector(e,x)),i+=e.dens*x,a+=e.lift*x,o+=e.clouds*x,s+=e.blockFog*x,c+=e.start*x,l+=e.floorRefl*x,u+=e.hills*x,d+=e.stripRefl*x,f[0]+=e.tubeGlow[0]*x,f[1]+=e.tubeGlow[1]*x,p+=e.fieldGain*x,m.r+=e.tubeColor.r*x,m.g+=e.tubeColor.g*x,m.b+=e.tubeColor.b*x,h+=e.wet*x,g+=e.lampMul*x,_+=e.pudLift*x,v+=e.stripGain*x,y+=e.farMul*x,b+=e.stream*x});let[x,ee,te,S,ne,re,ie,ae,oe]=this.tc;q.uStHorizon.value.copy(x),q.uStUpper.value.copy(ee),q.uStZenith.value.copy(te),q.uStGround.value.copy(S),q.uStGlowACol.value.copy(ne),q.uStGlowBCol.value.copy(re),q.uSkyCol.value.copy(ie),q.uOutCol.value.copy(ae),q.uInCol.value.copy(oe),q.uStFogShape.value.copy(this.tv[0]),q.uStGlowA.value.copy(this.tv[1]),q.uStGlowB.value.copy(this.tv[2]),q.uStDens.value.set(i,a,s,c),q.uStClouds.value=o,q.uStFloorRefl.value=l,q.uStHills.value=u,q.uStStripRefl.value=d,q.uStTubeGlow.value.set(f[0],f[1]),q.uStFieldGain.value=p,q.uStTubeCol.value.copy(m),q.uStWet.value=h,q.uStLampMul.value=g,q.uStPudLift.value=_,q.uStStripGain.value=v,q.uStFarMul.value=y,q.uStStream.value=b}},ct=[{at:[-62,29.3],horizon:`#b6f0e6`,upper:`#c2f8ec`,zenith:`#ccfbef`,ground:`#86d0cc`,shape:[.06,.035,.15,3],glowA:{dir:[-1,.1,0],power:6,color:`#ffffff`,strength:0},glowB:{dir:[-1,.12,0],power:8,color:`#fff4d0`,strength:0},sky:`#5ccfe0`,out:`#1c6070`,in:`#1e6680`,dens:1,lift:.009,clouds:0,blockFog:.1,start:2,floorRefl:1,stripRefl:0,tubeGlow:[.5,.8],fieldGain:1,tubeColor:`#e8fcd8`,tubePower:2.4,wet:0,lampMul:1,pudLift:0,stripGain:1,hills:0,stream:1},{at:[0,0],horizon:`#98d4c6`,upper:`#98dccd`,zenith:`#9adccd`,ground:`#78b6ae`,shape:[.12,.012,.15,2],glowA:{dir:[-.35,.15,-.92],power:3,color:`#a29889`,strength:1},glowB:{dir:[-.6,.15,-.78],power:8,color:`#3a2a00`,strength:1},sky:`#74d6e2`,out:`#2a8590`,in:`#04161e`,dens:1,lift:.008,clouds:0,blockFog:.1,start:2,floorRefl:8,stripRefl:8,tubeGlow:[1.6,1.6],fieldGain:.7,tubeColor:`#fffcc4`,tubePower:1.15,wet:0,lampMul:1,pudLift:.12,stripGain:1,hills:0,stream:0},{at:[-23.7,51.4],horizon:`#82cfcc`,upper:`#a0e0d8`,zenith:`#e2f6e8`,ground:`#3f9d9b`,shape:[.16,.02,.1,1.6],glowA:{dir:[1,.55,0],power:5,color:`#24200c`,strength:1},glowB:{dir:[-1,.12,0],power:8,color:`#fff4d0`,strength:0},sky:`#6cd8c8`,out:`#226e6a`,in:`#062420`,dens:.9,lift:.012,clouds:0,blockFog:.1,start:9,floorRefl:1,stripRefl:.5,tubeGlow:[7,2.6],fieldGain:1,tubeColor:`#fff8d8`,tubePower:2.4,wet:0,lampMul:1,pudLift:0,stripGain:1,hills:.35,stream:0},{at:[0,12],horizon:`#aee8ea`,upper:`#d4fdf9`,zenith:`#ecfffc`,ground:`#5a9ea4`,shape:[.12,.07,.92,1.6],glowA:{dir:[-1,.15,.3],power:4,color:`#204840`,strength:1},glowB:{dir:[-.6,.2,.8],power:6,color:`#203830`,strength:1},sky:`#5cc0d0`,out:`#2a7684`,in:`#051520`,dens:.8,lift:.004,clouds:1,blockFog:.16,start:2,floorRefl:8,stripRefl:4,tubeGlow:[1,1],fieldGain:.6,tubeColor:`#ecfae0`,tubePower:2.4,wet:.4,lampMul:.3,pudLift:.25,stripGain:1.8,hills:0,stream:0}];function lt(e){let t=Array.from({length:12},(t,n)=>new s(...e.stream[Math.min(n,e.stream.length-1)]??[0,0]));return Ie({color:e.color,uniforms:{uFDark:{value:new w(e.dark)},uFLight:{value:new w(e.light)},uStream:{value:t},uStreamN:{value:e.stream.length},uFKeep:{value:e.keep},uFFarT:{value:new s(...e.farT??[.563,.506])}},fragHead:`
uniform vec3 uFDark;
uniform vec3 uFLight;
uniform vec2 uStream[12];
uniform int uStreamN;
uniform float uFKeep;
uniform vec2 uFFarT;
uniform float uStFieldGain;
uniform float uStStream;
float fd_pat;
float fd_water;
// 2 次元の値ノイズ（-1..1。草の塊用の軽いもの）
float fd_vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = sl_hash12(i);
  float b = sl_hash12(i + vec2(1.0, 0.0));
  float c = sl_hash12(i + vec2(0.0, 1.0));
  float d = sl_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}
// 折れ線までの距離と、その点の折れ線に沿った位置（0〜1）
vec2 fd_stream(vec2 p) {
  float best = 1e9;
  float t = 0.0;
  for (int i = 0; i < 11; i++) {
    if (i + 1 >= uStreamN) break;
    vec2 a = uStream[i];
    vec2 b = uStream[i + 1];
    vec2 ab = b - a;
    float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    float d = length(p - a - ab * h);
    if (d < best) { best = d; t = (float(i) + h) / float(uStreamN - 1); }
  }
  return vec2(best, t);
}
`,fragAlbedo:`
  fd_water = 0.0;
  fd_pat = 0.0;
  albedo *= uStFieldGain;
  {
    vec2 xz = p.xz;
    // 筋の向き: 東の野原（station-2 の奥）は z 向き、ほか（線路沿い・D の先の北の野原）は x 向き
    // （どちらも、その場所をよく見る視点に対して横向き）
    float wz = smoothstep(18.0, 30.0, xz.x) * smoothstep(20.0, 35.0, xz.y);
    vec2 sa = vec2(xz.x * 0.06, xz.y * 0.012);
    vec2 sb = vec2(xz.x * 0.012, xz.y * 0.06);
    vec2 sq = mix(sb, sa, wz);
    // 画面の 1 画素の大きさ（遠くでは細かい模様を消す）
    float fw = length(fwidth(xz));
    float lodM = 1.0 - smoothstep(0.6, 3.0, fw);
    float lodF = 1.0 - smoothstep(0.08, 0.5, fw);
    // 大きなむら・筋・塊（平均 0 の模様。正 = 明るい草、負 = 暗い草）
    float big = sl_fbm(vec3(xz * 0.01, 1.7), 3);
    float streak = sl_fbm(vec3(sq, 4.1), 4);
    // 遠く（1 画素が数 m）では細かい塊を計算しない（lodM = 0 で消える物）
    float clump = lodM > 0.0 ? sl_warp(vec3(xz * 0.07, 2.3), 4) : 0.0;
    float pat = big * 0.6 + streak * 1.1 + clump * 0.5 * lodM;
    fd_pat = big * 0.6 + streak * 1.1;
    vec3 c = pat < 0.0 ? mix(albedo, uFDark * uStFieldGain, clamp(-pat * 1.4, 0.0, 1.0)) : mix(albedo, uFLight * uStFieldGain, clamp(pat * 1.0, 0.0, 1.0));
    // 明るい草の房（筋の縁に多い）
    float edge = 1.0 - smoothstep(0.0, 0.12, abs(streak + 0.05));
    if (lodF > 0.0) {
      float tuft = sl_vnoise(vec3(xz * 1.7, 7.7)) * 0.5 + 0.5;
      c = mix(c, uFLight, smoothstep(0.6, 0.88, tuft) * (0.3 + edge * 0.7) * lodF);
    }
    if (lodM > 0.0) {
      float tuftM = sl_vnoise(vec3(sq * 6.0, 9.3)) * 0.5 + 0.5;
      c = mix(c, uFLight, smoothstep(0.65, 0.92, tuftM) * edge * 0.6 * lodM);
    }
    // 草の小さな塊（絵の具で置いたような 0.2〜0.5 m のやわらかい暗い塊と、短い筆の跡・明るい房）。ワールド座標に固定。
    // 低い視線では地面の模様が縦につぶれるので、その場所をよく見る向き（筋と直交する向き）に 2.5 倍長くして、画面で丸く見せる。
    // 差は小さく、1 画素が粗くなる距離では消す（ちらつき・縞の防止）
    {
      float lodC = 1.0 - smoothstep(0.12, 0.35, fw);
      float lodS = 1.0 - smoothstep(0.05, 0.15, fw);
      if (lodC > 0.0) {
        // 見る向きに沿う軸を u、横を v にした座標（u を縮めて塊を長くする）
        vec2 uv = mix(vec2(xz.y, xz.x), xz, wz);
        vec2 w = vec2(fd_vn(xz * 0.9 + 3.1), fd_vn(xz * 0.9 + 17.4));
        vec2 g = vec2(uv.x * 0.4, uv.y) * 3.0 + w * 1.2;
        float a = fd_vn(g) * 0.65 + fd_vn(g * 2.1 + 5.3) * 0.35;
        float dk = smoothstep(0.0, 0.5, a);
        // 短い筆の跡（幅 8 cm・長さ 25 cm ほど）と明るい房
        vec2 gs = vec2(uv.x * 4.0, uv.y * 12.0) + w * 2.0;
        float st = fd_vn(gs);
        float lt = smoothstep(0.35, 0.85, -a) * 0.6 + smoothstep(0.55, 0.95, st) * 0.4 * lodS;
        dk = max(dk, smoothstep(0.6, 0.95, -st) * 0.5 * lodS);
        c = mix(c, uFDark * 0.75 * uStFieldGain, dk * 0.42 * lodC);
        c = mix(c, uFLight * uStFieldGain, lt * 0.3 * lodC);
      }
    }
    // 暗い草の塊（はっきりした縁）
    if (lodM > 0.0) {
      float blob = sl_warp(vec3(xz * 0.35, 8.8), 4);
      c = mix(c, uFDark * 0.75, smoothstep(0.12, 0.2, blob) * 0.55 * lodM);
    }
    // 小川: 遠く（西）は空を映す白い線、近くは暗い溝と湿った縁
    if (uStreamN > 1 && uStStream > 0.0) {
      vec2 ds = fd_stream(xz);
      float wob = sl_fbm(vec3(xz * 0.08, 5.5), 3);
      float w = mix(2.2, 1.4, ds.y) + wob * 0.8;
      // 折れ線の始め（遠い所）は空を映す白い線
      float far = smoothstep(uFFarT.x, uFFarT.y, ds.y);
      float core = 1.0 - smoothstep(w * 0.5, w * 0.5 + max(fw, 0.2), ds.x);
      float wet = (1.0 - smoothstep(w * 0.6, w * 3.5 + wob * 3.0, ds.x)) * uStStream;
      c = mix(c, uFDark * 0.6, wet * (1.0 - far) * 0.7);
      fd_pat -= wet * (1.0 - far) * 1.2;
      fd_water = core * far * uStStream;
    }
    // 近く（5〜13 m）: 歩いて足元を見たときの草（濃い緑の細かい葉の筋・明るい葉先・土の見える所）。
    // 遠くの絵の具の塊（水たまりのように見える縁のはっきりした塊）は近くでは弱める。視点の参考画像の範囲はほぼ 13 m より遠い
    {
      float dN = length(p - cameraPosition);
      float wN = 1.0 - smoothstep(5.0, 13.0, dN);
      if (wN > 0.0) {
        vec2 w2 = vec2(fd_vn(xz * 1.3 + 7.1), fd_vn(xz * 1.3 + 2.9));
        float blades = fd_vn(vec2(xz.x * 26.0, xz.y * 7.0) + w2 * 3.0) * 0.6 + fd_vn(vec2(xz.x * 9.0 + xz.y * 3.0, xz.y * 30.0) + w2 * 2.0) * 0.4;
        float pch = fd_vn(xz * 0.6 + w2) * 0.5 + 0.5;
        float soil = smoothstep(0.78, 0.92, fd_vn(xz * 1.1 + 33.0) * 0.5 + 0.5);
        vec3 g = mix(uFDark * 0.85, mix(albedo, uFLight, 0.25), 0.35 + pch * 0.35);
        g = mix(g, uFDark * 0.55, smoothstep(0.1, 0.6, -blades) * 0.55);
        g = mix(g, uFLight * 0.95, smoothstep(0.35, 0.8, blades) * 0.35);
        g = mix(g, vec3(0.16, 0.2, 0.17), soil * 0.35);
        c = mix(c, g * uStFieldGain, wN);
      }
    }
    albedo = c;
  }
`,fragFinal:`
  {
    // 遠くの小川は空（霧の色）を映す
    vec3 vd = normalize(p - cameraPosition);
    vec3 sky = st_fogColor(reflect(vd, vec3(0.0, 1.0, 0.0)));
    col = mix(col, sky * 0.92, fd_water);
  }
`,fragPostFog:`
  // 霧の向こうでも大きな模様（むら・筋・小川）を少し残す（平均 0 の模様で明るさだけを変える）
  {
    float w = max(pow(st_lastT, 0.4) - st_lastT, 0.0) * uFKeep;
    col *= 1.0 + fd_pat * 0.25 * w;
    vec3 vd = normalize(p - cameraPosition);
    col = mix(col, st_fogColor(reflect(vd, vec3(0.0, 1.0, 0.0))) * 1.02, fd_water * w * 0.8);
  }
`})}var Y=`#1c3a4a`,ut=`#7a8a88`,dt=`"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;function ft(e,t,n,r,i,a,o,s=ut){let c=o,l=()=>(c=c*16807%2147483647,c/2147483647);e.strokeStyle=s,e.lineWidth=Math.max(1.5,i/a/4);for(let o=0;o<a;o++){let s=n+(o+.5)*(i/a),c=r*(.55+l()*.45);e.beginPath(),e.moveTo(t,s);for(let n=0;n<c;n+=6)e.lineTo(t+n,s+Math.sin(n*.35+l()*6)*(i/a)*.18);e.stroke()}}function X(e,t,n,r,i,a,o=`center`){e.fillStyle=a,e.font=`bold ${i}px ${dt}`,e.textAlign=o,e.textBaseline=`middle`,e.fillText(t,n,r)}function pt(e,t,n,r,i,a){e.fillStyle=a,e.beginPath(),e.moveTo(t+i*r,n),e.lineTo(t,n-r*.6),e.lineTo(t,n-r*.25),e.lineTo(t-i*r*.8,n-r*.25),e.lineTo(t-i*r*.8,n+r*.25),e.lineTo(t,n+r*.25),e.lineTo(t,n+r*.6),e.closePath(),e.fill()}var mt=[`kippu`,`guide`,`under`,`arrowA`,`arrowGate`,`exit`,`name`,`deadend`,`closed`,`ja`,`hangGate`,`depart`],ht=[`fare`,`timetable`,`posters`,`bus`,`map`,`warn`,`dengon`,`ad`],gt=[`ekimei`,`notice`];function _t(e){let t=document.createElement(`canvas`),n=mt.includes(e),r=gt.includes(e);t.width=n||r?1024:512,t.height=n?128:r?340:384;let i=t.getContext(`2d`),a=t.width,o=t.height;switch(i.fillStyle=`#e8f0ec`,i.fillRect(0,0,a,o),e){case`fare`:i.strokeStyle=Y,i.lineWidth=6,i.beginPath(),i.moveTo(40,190),i.lineTo(470,190),i.moveTo(256,190),i.lineTo(256,40),i.moveTo(256,190),i.lineTo(120,340),i.moveTo(256,190),i.lineTo(400,340),i.stroke();for(let[e,t]of[[60,190],[130,190],[200,190],[330,190],[400,190],[460,190],[256,60],[256,120],[170,285],[340,285],[130,330],[390,330]])i.fillStyle=`#ffffff`,i.beginPath(),i.arc(e,t,10,0,Math.PI*2),i.fill(),i.strokeStyle=Y,i.lineWidth=3,i.stroke();i.fillStyle=`#c04838`,i.beginPath(),i.arc(256,190,14,0,Math.PI*2),i.fill(),ft(i,290,30,180,120,6,3);break;case`kippu`:i.fillStyle=Y,i.fillRect(0,0,a,o),X(i,`きっぷうりば`,a/2,o/2,72,`#ffffff`);break;case`timetable`:i.fillStyle=Y,i.fillRect(0,0,a,50),X(i,`時刻表`,a/2,26,32,`#ffffff`);for(let e=0;e<12;e++)i.fillStyle=e%2?`#dde8e4`:`#eef4f0`,i.fillRect(0,50+e*27,a,27),X(i,String(5+e*1.5|0),30,64+e*27,18,Y),ft(i,60,52+e*27,420,24,1,11+e);break;case`posters`:{i.fillStyle=`#c8d4d0`,i.fillRect(0,0,a,o);let e=[`#e8f0ec`,`#f0e8d8`,`#dcecf0`,`#e8f0ec`];for(let t=0;t<4;t++){let n=12+t*125;i.fillStyle=e[t],i.fillRect(n,30,112,320),i.fillStyle=t===1?`#c04838`:t===2?`#2a6a8a`:`#3a7a5a`,i.fillRect(n+10,44,92,t===3?30:90),ft(i,n+10,150,92,180,8,21+t)}break}case`guide`:i.fillStyle=Y,i.fillRect(0,0,a,o),X(i,`0 番線`,150,o/2,58,`#ffffff`),i.fillStyle=`#e8c048`,i.fillRect(300,30,6,68),X(i,`1・2 番線　3〜6 番線は地下道`,640,o/2,46,`#ffffff`),pt(i,960,o/2,34,1,`#ffffff`);break;case`under`:i.fillStyle=Y,i.fillRect(0,0,a,o),pt(i,90,o/2,40,1,`#ffffff`),X(i,`1・2 番線　3〜6 番線`,560,o/2,58,`#ffffff`);break;case`arrowA`:i.fillStyle=Y,i.fillRect(0,0,a,o),X(i,`1・2・3〜6 番線のりば`,460,o/2,56,`#ffffff`),pt(i,940,o/2,40,1,`#ffffff`);break;case`arrowGate`:i.fillStyle=Y,i.fillRect(0,0,a,o),pt(i,84,o/2,40,-1,`#ffffff`),X(i,`改札口・0 番線`,560,o/2,56,`#ffffff`);break;case`exit`:i.fillStyle=`#e8c048`,i.fillRect(0,0,a,o),X(i,`改札口　0 番線`,560,o/2,58,`#1a2a30`),pt(i,120,o/2,40,-1,`#1a2a30`);break;case`name`:i.fillStyle=`#f2f6f4`,i.fillRect(0,0,a,o),X(i,`きりはら　霧原駅`,a/2,o/2,70,`#1a2a30`);break;case`bus`:i.fillStyle=`#f2f6f4`,i.fillRect(0,0,a,o),i.fillStyle=`#2a6a8a`,i.beginPath(),i.arc(a/2,130,110,0,Math.PI*2),i.fill(),X(i,`バス`,a/2,130,70,`#ffffff`),ft(i,60,260,390,100,4,41);break;case`map`:i.fillStyle=`#dce8e2`,i.fillRect(0,0,a,o),i.fillStyle=Y,i.fillRect(0,0,a,46),X(i,`駅周辺のご案内`,a/2,24,28,`#ffffff`),i.strokeStyle=`#8a9a96`,i.lineWidth=10,i.beginPath(),i.moveTo(20,220),i.lineTo(490,210),i.moveTo(300,60),i.lineTo(300,370),i.stroke(),i.strokeStyle=`#3a4a50`,i.lineWidth=4,i.setLineDash([14,8]),i.beginPath(),i.moveTo(340,50),i.lineTo(350,380),i.stroke(),i.setLineDash([]);for(let[e,t,n,r]of[[60,80,90,60],[170,260,70,50],[400,100,70,80],[80,290,60,50]])i.fillStyle=`#b8c8c0`,i.fillRect(e,t,n,r);i.fillStyle=`#c04838`,i.beginPath(),i.arc(318,200,12,0,Math.PI*2),i.fill();break;case`warn`:i.fillStyle=`#e8c048`,i.fillRect(0,0,a,o),i.fillStyle=`#1a1a1a`;for(let e=-o;e<a;e+=60)i.beginPath(),i.moveTo(e,o),i.lineTo(e+30,o),i.lineTo(e+30+o*.3,o-40),i.lineTo(e+o*.3,o-40),i.closePath(),i.fill();X(i,`とまれみよ`,a/2,o/2-30,80,`#1a1a1a`),X(i,`列車に注意`,a/2,o/2+60,56,`#c03020`);break;case`deadend`:i.fillStyle=`#f2f6f4`,i.fillRect(0,0,a,o),i.fillStyle=`#c03020`,i.fillRect(0,0,30,o),i.fillRect(a-30,0,30,o),X(i,`この先 行き止まり（踏切は廃止しました）`,a/2,o/2,46,`#1a2a30`);break;case`closed`:i.fillStyle=`#f2f6f4`,i.fillRect(0,0,a,o),X(i,`この先 通行止め`,a/2,o/2,64,`#c03020`);break;case`ja`:i.fillStyle=`#f2f6f4`,i.fillRect(0,0,a,o),i.fillStyle=`#2a7a4a`,i.fillRect(0,0,120,o),X(i,`JA`,60,o/2,64,`#ffffff`),X(i,`霧原 農業倉庫`,580,o/2,62,`#1a2a30`);break;case`ekimei`:i.fillStyle=`#f4f8f6`,i.fillRect(0,0,a,o),X(i,`霧原`,a/2,46,44,`#1a2a30`),X(i,`きりはら`,a/2,138,112,`#1a2a30`),X(i,`Kirihara`,a/2,220,40,`#3a4a50`),i.fillStyle=`#2a7a5a`,i.fillRect(0,262,a,78),X(i,`◀ きたはら`,30,301,40,`#ffffff`,`left`),X(i,`みなみだ ▶`,a-30,301,40,`#ffffff`,`right`);break;case`hangGate`:i.fillStyle=Y,i.fillRect(0,0,a,o),pt(i,80,o/2,38,-1,`#ffffff`),X(i,`改札口　0 番線`,330,o/2,52,`#ffffff`),i.fillStyle=`#e8c048`,i.fillRect(560,26,6,76),X(i,`出口　バスのりば`,790,o/2,52,`#ffffff`),pt(i,975,o/2,38,1,`#ffffff`);break;case`depart`:i.fillStyle=`#10181a`,i.fillRect(0,0,a,o),[[`普通`,`10:42`,`みなみだ`,`#e89848`],[`快速`,`11:05`,`きたはら`,`#78d0a0`]].forEach((e,t)=>{let n=34+t*60;X(i,e[0],90,n,40,e[3]),X(i,e[1],260,n,40,e[3]),X(i,e[2],520,n,40,e[3]),i.fillStyle=e[3];for(let e=0;e<7;e++)i.fillRect(700+e*42,n-12,26,24)});break;case`dengon`:i.fillStyle=`#2a5a48`,i.fillRect(0,0,a,o),i.strokeStyle=`#6a5a3a`,i.lineWidth=18,i.strokeRect(9,9,a-18,o-18),X(i,`伝言板`,a/2,44,34,`#d8e4dc`),ft(i,40,80,430,270,7,77,`#c8d6ce`);break;case`ad`:{let e=i.createLinearGradient(0,0,0,o);e.addColorStop(0,`#c8eee4`),e.addColorStop(.55,`#9ad2c4`),e.addColorStop(1,`#4a8a7c`),i.fillStyle=e,i.fillRect(0,0,a,o),i.fillStyle=`#2a5a5a`,i.fillRect(60,200,160,26),i.fillRect(130,120,8,80),i.fillStyle=`#e8f4ee`,i.fillRect(0,o-96,a,96),X(i,`きりはら 霧の里めぐり`,a/2,o-62,34,`#1a3a40`),ft(i,60,o-40,390,30,1,91);break}case`notice`:i.fillStyle=`#d8e4de`,i.fillRect(0,0,a,o),i.fillStyle=Y,i.fillRect(0,0,a,44),X(i,`お知らせ`,90,22,28,`#ffffff`);for(let e=0;e<3;e++){let t=24+e*330;i.fillStyle=[`#f2f4ee`,`#eef0e4`,`#f4ece4`][e],i.fillRect(t,60,300,260),i.fillStyle=[`#2a6a8a`,`#c04838`,`#3a7a5a`][e],i.fillRect(t+14,74,272,40),ft(i,t+14,130,272,170,7,61+e)}}return t}var vt=null;function yt(){if(!vt){let e=2048,t=2048,n=document.createElement(`canvas`);n.width=e,n.height=t;let r=n.getContext(`2d`);r.fillStyle=`#808080`,r.fillRect(0,0,e,t);let i=new Map,a=(n,a,o,s,c)=>{r.drawImage(_t(n),a+6,o+6,s-12,c-12),i.set(n,[(a+6)/e,1-(o+c-6)/t,(a+s-6)/e,1-(o+6)/t])};mt.forEach((e,t)=>a(e,t%2*1024,Math.floor(t/2)*140,1024,140)),ht.forEach((e,t)=>a(e,t%4*512,860+Math.floor(t/4)*400,512,400)),gt.forEach((e,t)=>a(e,t%2*1024,1660+Math.floor(t/2)*360,1024,360));let o=new re(n);o.colorSpace=y,o.anisotropy=4,vt={texture:o,rects:i}}let e=vt;return{texture:e.texture,rect:t=>e.rects.get(t)}}function bt(e,t){let[n,r,i,a]=yt().rect(t),o=e.getAttribute(`uv`);for(let e=0;e<o.count;e++)o.setXY(e,n+o.getX(e)*(i-n),r+o.getY(e)*(a-r));return o.needsUpdate=!0,e}function Z(e,t){return bt(new C(...t),e)}var xt=`
  albedo *= mix(0.3, 1.0, smoothstep(0.3, 2.2, p.y)) * mix(1.0, 0.4, smoothstep(2.2, 3.3, p.y));
`,St=`
  {
    vec3 a = abs(n);
    vec2 uv = a.x > 0.5 ? p.zy : (a.z > 0.5 ? p.xy : p.xz);
    vec2 g = abs(fract(uv / 0.15) - 0.5) * 0.15;
    vec2 w = fwidth(uv) * 0.8 + 0.004;
    float line = 1.0 - smoothstep(0.0, w.x, g.x) * smoothstep(0.0, w.y, g.y);
    float h = sl_hash12(floor(uv / 0.15) + floor(a.x * 3.0) * 17.0);
    albedo *= mix(1.0, 0.72, line) * (0.93 + 0.12 * h);
  }
`,Ct=`
  if (abs(n.y) < 0.5) {
    float hx = abs(n.x) > 0.5 ? p.z : p.x;
    float H = uSpan.y - uSpan.x;
    float ci = floor(hx / 0.6);
    float run = 0.0;
    if (sl_hash12(vec2(ci, 3.7 + uSpan.x)) > 0.68) {
      float cx = (ci + 0.2 + 0.6 * sl_hash12(vec2(ci, 9.1))) * 0.6;
      float w = 0.018 + 0.03 * sl_hash12(vec2(ci, 5.3));
      float len = (0.25 + 0.55 * sl_hash12(vec2(ci, 1.1))) * H;
      float d = abs(hx - cx + sl_vnoise(vec3(p.y * 3.0, ci, 2.0)) * 0.012);
      float aw = fwidth(hx) + 1e-4;
      float core = 1.0 - smoothstep(w - aw, w + aw, d);
      float fromTop = uSpan.y - p.y;
      float endN = len * (1.0 + sl_vnoise(vec3(hx * 9.0, 0.0, ci)) * 0.2);
      float vert = 1.0 - smoothstep(endN - 0.04, endN + 0.04, fromTop);
      run = core * vert * mix(0.55, 1.0, 1.0 - fromTop / max(len, 0.01));
    }
    albedo *= 1.0 - run * 0.42 * uSpan.z;
    float band = 0.12 + uSpan.w * 0.18 + sl_vnoise(vec3(hx * 1.7, 0.0, 5.1)) * 0.06 + sl_vnoise(vec3(hx * 9.0, 0.0, 3.3)) * 0.02;
    float aw2 = fwidth(p.y) + 1e-4;
    albedo *= mix(1.0, 0.76, (1.0 - smoothstep(band - aw2, band + aw2, p.y - uSpan.x)) * uSpan.z);
  }
`,wt=`
  if (n.y > 0.9) {
    // ねじったノイズは重いので、2 つの値ノイズでずらした 3 段の fbm（形は同じく、ちぎれた縁の不定形）
    vec2 pq = p.xz * uPud.x;
    pq += vec2(sl_vnoise(vec3(pq * 0.7, 3.1)), sl_vnoise(vec3(pq * 0.7, 9.4))) * 1.1;
    // 縁をちぎる細かいノイズ（ホームの水たまりと同じ: 9 /m と 31 /m）
    float wn = sl_fbm(vec3(pq, 3.7), 3) * 0.8 + sl_vnoise(vec3(p.xz * 9.0, 1.1)) * 0.06 + sl_vnoise(vec3(p.xz * 31.0, 4.1)) * 0.03;
    float ww = fwidth(wn) * 0.8 + 0.002;
    pudM = smoothstep(uPud.y - ww, uPud.y + ww, wn);
    // 補修の跡（4.3 m の升目に、ときどき四角い暗い継ぎ当て。縁は 1 画素ぼかす）
    {
      vec2 cl = floor(p.xz / 4.3);
      if (sl_hash12(cl) > 0.66) {
        vec2 f = fract(p.xz / 4.3);
        vec2 lo = vec2(0.08 + 0.3 * sl_hash12(cl + 7.1), 0.08 + 0.3 * sl_hash12(cl + 3.3));
        vec2 hi = lo + vec2(0.22 + 0.32 * sl_hash12(cl + 1.9), 0.18 + 0.38 * sl_hash12(cl + 5.7));
        vec2 aw = fwidth(f) + 1e-4;
        vec2 e = smoothstep(lo - aw, lo + aw, f) * (1.0 - smoothstep(hi - aw, hi + aw, f));
        float patchM = e.x * e.y;
        albedo *= mix(1.0, 0.8, patchM);
        // 継ぎ当ての縁の細い線（目地の砂）
        vec2 ed = min(abs(f - lo), abs(f - hi)) / aw;
        albedo *= mix(1.0, 1.25, (1.0 - smoothstep(0.5, 1.5, min(ed.x, ed.y))) * step(0.01, patchM + 0.02) * 0.6);
      }
    }
    // 水たまりのまわりは濡れて暗い（縁はちぎれる）
    float wm = smoothstep(uPud.y - 0.1 - ww, uPud.y - 0.1 + ww, wn);
    albedo *= mix(1.0, 0.72, wm) * mix(1.0, 0.85, pudM);
  }
`,Tt=`
  if (pudM > 0.0) {
    vec3 vdp = normalize(p - cameraPosition);
    vec3 rp = reflect(vdp, vec3(0.0, 1.0, 0.0));
    float frp = 0.35 + 0.65 * pow(1.0 - clamp(-vdp.y, 0.0, 1.0), 3.0);
    // 映るのは霧の空。濡れた路面より少しだけ明るい（白く飛ばない）
    col = mix(col, st_fogColor(rp) * 0.62, pudM * frp * uPud.z);
  }
`,Et=`
  {
    vec3 a = abs(n);
    float u = a.y > 0.6 ? p.x : (a.x > a.z ? p.z : p.x);
    float k = 1.0 - smoothstep(0.015, 0.05, fwidth(u));
    albedo *= mix(1.0, 0.8 + 0.34 * (0.5 + 0.5 * sin(u * 82.0)), k * 0.8);
    if (a.y < 0.5) {
      float st = smoothstep(0.2, 0.7, sl_vnoise(vec3(u * 1.6, p.y * 0.3, 4.2)) * 0.5 + 0.5) * smoothstep(0.0, 0.8, sl_vnoise(vec3(u * 7.0, p.y * 0.9, 1.3)) * 0.5 + 0.5);
      albedo *= mix(vec3(1.0), vec3(0.82, 0.74, 0.66), st * 0.6);
    }
  }
`,Dt=`
  if (n.y < -0.5) {
    vec2 uv = p.xz / 0.91;
    vec2 g = abs(fract(uv) - 0.5) * 0.91;
    vec2 w = fwidth(p.xz) * 0.8 + 0.003;
    float line = 1.0 - smoothstep(0.0, w.x, g.x) * smoothstep(0.0, w.y, g.y);
    albedo *= mix(1.0, 0.6, line) * (0.92 + 0.14 * sl_hash12(floor(uv)));
  }
`;function Ot(e,t){return[F.x+(t-we.zc),F.z1-(e-we.xEnd)]}var kt=[[-480,200],[-383,131],[-306,66],[-258,29],[-212,5],[-187,-3],[-152,-6],[-119,-9.5],[-99,-11.4],[-86,-12],[-70,-12.6]];function At(){let e=e=>Ie(e);return{concrete:e({color:`#1a2e40`,mottle:[.12,1.3]}),coping:e({color:`#2e4e54`}),roof:e({color:`#3a6878`}),beam:e({color:`#3e6c7c`}),steel:e({color:`#3d6e7c`}),pedestal:e({color:`#3f6a74`,mottle:[.1,2]}),bench:e({color:`#1a6878`,emissive:`#04222c`,emissiveIntensity:1,side:2,sheen:.3}),frameD:e({color:`#2a6670`,emissive:`#0a3c44`,emissiveIntensity:1}),benchB:e({color:`#123238`,sheen:.2}),benchT:e({color:`#1e4450`,side:2,sheen:.6}),benchD:e({color:`#2a6670`,emissive:`#0a3c44`,emissiveIntensity:1,side:2,sheen:.3}),housing:e({color:`#3a5a5e`}),tube:e({color:`#000000`,unlit:!0,fragAlbedo:`  emis = uStTubeCol * (0.65 + 0.45 * abs(dot(n, normalize(cameraPosition - p))));`}),sign:e({color:`#1d3a40`}),rail:e({color:`#24383c`}),railTop:e({color:`#a8c8c6`,gain:1}),railRust:e({color:`#4a4a40`,mottle:[.3,4]}),clip:e({color:`#3a5c60`,gain:1}),sleeper:e({color:`#25393a`,mottle:[.15,3]}),ballast:e({color:`#0e1a20`,mottle:[.35,6]}),ballastA:e({color:`#4a8088`,mottle:[.35,6],fragAlbedo:`  albedo *= mix(1.0, 0.4, smoothstep(4.0, 14.0, p.z));`}),field:lt({color:`#8ab6ae`,dark:`#4c766a`,light:`#b4d8b8`,stream:kt.map(([e,t])=>Ot(e,t)),keep:2}),far:e({color:`#3d5e5c`}),farHaze:e({color:`#2a5a5c`,farFog:!0}),booth:e({color:`#1e4a50`}),glass:e({color:`#5a9890`,gain:1}),wire:e({color:`#2a4a50`}),steelD:e({color:`#6a9aa0`,gain:5.5,fragAlbedo:xt}),pedestalD:e({color:`#3a6a7a`,gain:5,fragAlbedo:xt}),roofB:e({color:`#3a96a0`}),columnB:e({color:`#1a4a54`,fragAlbedo:`  albedo *= mix(0.6, 1.0, smoothstep(0.5, 2.0, p.y)) * mix(1.0, 0.7, smoothstep(2.4, 3.4, p.y));`}),columnBase:e({color:`#164a50`}),columnEdge:e({color:`#3a7a80`}),bcFunnel:e({color:`#24646c`}),shelterDark:e({color:`#2a5a60`}),lampBox:e({color:`#000000`,unlit:!0,emissive:`#f4f0c0`,emissiveIntensity:1.3}),beamB:e({color:`#2a6466`}),roofT:e({color:`#2c4c70`}),columnT:e({color:`#3a7488`,emissive:`#16505e`,emissiveIntensity:1,sheen:.3}),endT:e({color:`#1a3848`,fogMul:.55}),shedCol:e({color:`#24505a`}),shedColL:e({color:`#3a7480`,emissive:`#103a42`,emissiveIntensity:1}),lattice:e({color:`#4a8088`,emissive:`#14424a`,emissiveIntensity:1}),underDark:e({color:`#1c3646`}),bcUnderDark:e({color:`#2a7078`}),ticket:e({color:`#1c4a4e`}),ticketScreen:e({color:`#000000`,unlit:!0,emissive:`#9ad0c8`,emissiveIntensity:.8}),doorFrame:e({color:`#4a8a84`}),doorLeaf:e({color:`#1a4c50`}),fasciaN:e({color:`#8ab4a0`,emissive:`#2a4a40`,emissiveIntensity:1}),bcValance:e({color:`#2a6a72`}),bcUnderLite:e({color:`#4a9aa0`}),underLite:e({color:`#3a6a7a`}),hookT:e({color:`#5aa0a8`,emissive:`#0a2a30`,emissiveIntensity:1}),beamT:e({color:`#2a4a68`}),steelT:e({color:`#2a4c58`}),housingT:e({color:`#3a5a5e`}),tubeT:e({color:`#000000`,unlit:!0,fragAlbedo:`  emis = uStTubeCol;`}),board:e({color:`#b6d6d0`}),frontS:e({color:`#2a5a64`,emissive:`#16383e`,emissiveIntensity:1}),frontD:e({color:`#2a6a74`,emissive:`#28626a`,emissiveIntensity:1}),signLight:e({color:`#94b4aa`,unlit:!0}),signal:e({color:`#c06050`,unlit:!0}),signalG:e({color:`#60c0a0`,unlit:!0}),wallExt:e({color:`#5a8a88`,mottle:[.08,1.5]}),wallBase:e({color:`#2a4a50`,mottle:[.1,2]}),roofTile:e({color:`#1e3a48`,mottle:[.08,3]}),sash:e({color:`#2a4a4e`}),winGlass:e({color:`#5a9890`,transparent:!0,opacity:.2,depthWrite:!1,sheen:.9,side:2}),winLit:e({color:`#000000`,unlit:!0,emissive:`#8ab8a8`,emissiveIntensity:.55}),wallInt:e({color:`#94b4aa`,mottle:[.05,2],fogMul:.18,pool:!0,fragHead:`uniform vec4 uSpan;`,fragAlbedo:Ct,uniforms:{uSpan:{value:new f(0,3.1,.7,0)}}}),floorInt:e({color:`#2c4648`,mottle:[.08,1.5],fogMul:.18,pool:!0,wet:[.35,.8,.35],fragAlbedo:St.replace(/0\.15/g,`0.3`).replace(`0.72`,`0.8`)}),ceilInt:e({color:`#2c4244`,fogMul:.18,pool:!0,fragAlbedo:Dt}),tileTun:e({color:`#86acae`,fogMul:.15,pool:!0,fragHead:`uniform vec4 uSpan;`,fragAlbedo:St+Ct,uniforms:{uSpan:{value:new f(-4.25,-1.85,1,1)}}}),floorTun:e({color:`#243c3e`,mottle:[.12,1.2],fogMul:.15,pool:!0,wet:[.4,1,.45]}),ceilTun:e({color:`#2c4040`,fogMul:.15,pool:!0,fragAlbedo:Dt}),trimTun:e({color:`#2a4a50`,fogMul:.15,pool:!0}),wallBaseIn:e({color:`#2a4a50`,fogMul:.18,pool:!0}),steelIn:e({color:`#3d6e7c`,fogMul:.18,pool:!0}),woodIn:e({color:`#2e3a36`,fogMul:.18,pool:!0}),sashIn:e({color:`#2a4a4e`,fogMul:.18,pool:!0}),doorIn:e({color:`#1a4c50`,fogMul:.18,pool:!0}),benchIn:e({color:`#1e4450`,side:2,fogMul:.18,pool:!0}),ticketIn:e({color:`#1c4a4e`,fogMul:.18,pool:!0}),vendingIn:e({color:`#b8ccc8`,fogMul:.18,pool:!0}),lockerIn:e({color:`#7e9e9a`,fogMul:.18,pool:!0}),boardIn:e({color:`#b6d6d0`,fogMul:.18,pool:!0}),blackIn:e({color:`#141e20`,fogMul:.18,pool:!0}),housingIn:e({color:`#3a5a5e`,fogMul:.18,pool:!0}),concreteIn:e({color:`#2a4048`,fogMul:.15,pool:!0}),greenIn:e({color:`#2a6a50`,fogMul:.18,pool:!0}),signLitIn:e({color:`#ffffff`,map:yt().texture,gain:.95,fogMul:.18,pool:!0}),signBright:e({color:`#ffffff`,map:yt().texture,unlit:!0,fogMul:.15,gain:1,emissive:`#1a2a28`}),signGlowIn:e({color:`#c8d8d4`,map:yt().texture,unlit:!0,fogMul:.18}),tactileX:e({color:`#a8a060`,fogMul:.18,pool:!0,fragAlbedo:`  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.z / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.x / 0.3 + 0.5) - 0.5) * 0.3));`}),tactileZ:e({color:`#a8a060`,fogMul:.18,pool:!0,fragAlbedo:`  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.x / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.z / 0.3 + 0.5) - 0.5) * 0.3));`}),tactileDot:e({color:`#a8a060`,fogMul:.18,pool:!0,fragAlbedo:`  albedo *= mix(0.75, 1.05, smoothstep(0.32, 0.22, length(fract(p.xz / 0.075) - 0.5)));`}),concreteW:e({color:`#1a2e40`,mottle:[.12,1.3],fragHead:`uniform vec4 uSpan;`,fragAlbedo:Ct,uniforms:{uSpan:{value:new f(-1.15,0,.9,.6)}}}),concreteDark:e({color:`#0f1e28`}),cabinet:e({color:`#4a6a6c`}),film:e({color:`#a8d4cc`,transparent:!0,opacity:.22,depthWrite:!1,side:2,sheen:.5}),straw:e({color:`#6a6c4c`,side:2}),woodP:e({color:`#3a4a44`}),tactileXo:e({color:`#a8a060`,fragAlbedo:`  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.z / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.x / 0.3 + 0.5) - 0.5) * 0.3));`}),tactileZo:e({color:`#a8a060`,fragAlbedo:`  albedo *= mix(0.72, 1.0, smoothstep(0.18, 0.3, abs(fract(p.x / 0.075) - 0.5))) * mix(0.8, 1.0, step(0.012, abs(fract(p.z / 0.3 + 0.5) - 0.5) * 0.3));`}),tactileDoto:e({color:`#a8a060`,fragAlbedo:`  albedo *= mix(0.75, 1.05, smoothstep(0.32, 0.22, length(fract(p.xz / 0.075) - 0.5)));`}),redIn:e({color:`#8a3a34`,fogMul:.18,pool:!0}),wallExtW:e({color:`#5a8a88`,mottle:[.08,1.5],fragHead:`uniform vec4 uSpan;`,fragAlbedo:Ct,uniforms:{uSpan:{value:new f(0,3.6,.9,.3)}}}),asphalt:e({color:`#22363a`,mottle:[.14,.7],sheen:.5,fragAlbedo:wt,fragFinal:Tt,uniforms:{uPud:{value:new l(.7,.22,.5)}},fragHead:`uniform vec3 uPud;
float pudM = 0.0;`}),gravel:e({color:`#3a5050`,mottle:[.3,5]}),curb:e({color:`#5a7a78`}),paint:e({color:`#a8c8c0`}),yellowPaint:e({color:`#a8a060`}),fence:e({color:`#3a5a5c`}),wood:e({color:`#3a4a44`,mottle:[.2,3]}),tin:e({color:`#3a5a60`,mottle:[.15,2],fragAlbedo:Et}),rust:e({color:`#4a4038`,mottle:[.25,3],fragAlbedo:Et}),bush:e({color:`#4a7464`,vertexColors:!0,side:2}),ridge:e({color:`#4e7a6a`}),poleConc:e({color:`#5a7470`}),signWhite:e({color:`#c8dcd4`}),red:e({color:`#8a3a34`}),redLit:e({color:`#c04838`,unlit:!0}),yellow:e({color:`#b0a050`}),black:e({color:`#141e20`}),vending:e({color:`#b8ccc8`}),vendingLit:e({color:`#000000`,unlit:!0,emissive:`#c8e8e0`,emissiveIntensity:.7}),green:e({color:`#2a6a50`}),water:e({color:`#3a6a6c`,sheen:1}),hedge:e({color:`#1e3e36`,side:2}),grass:e({color:`#4a7a62`,side:2}),signLit:e({color:`#ffffff`,map:yt().texture,gain:.95}),signUnlit:e({color:`#ffffff`,map:yt().texture,unlit:!0}),signGlow:e({color:`#b8c8c4`,map:yt().texture,unlit:!0}),signLitTun:e({color:`#ffffff`,map:yt().texture,gain:.85,fogMul:.25}),signUnlitTun:e({color:`#ffffff`,map:yt().texture,unlit:!0,fogMul:.25}),grassDark:e({color:`#0c2a2e`,unlit:!0,side:2})}}function jt(r){let i=new le(900,48,24),a=new S({uniforms:{...h,...q,uCloudColor:{value:new w(r.cloudColor)},uHillColor:{value:new w(r.hillColor)}},vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,fragmentShader:`
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vDir;
      uniform float uTime;
      uniform vec3 uCloudColor;
      uniform float uStClouds;
      uniform float uStHills;
      uniform vec3 uHillColor;
      ${e}
      ${t}
      ${n}
      ${Ne}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = st_fogColor(d);
        float az = atan(d.x, d.z);
        if (uStClouds > 0.0 && d.y > -0.02) {
          // 地平線の少し上の雲のかたまり（空より少し暗く青い）。上の縁は丸く盛り上がる
          float top = 0.06 + 0.055 * (sl_fbm(vec3(az * 1.6, 7.7, 1.0), 4) * 0.5 + 0.5);
          float n = sl_fbm(vec3(az * 3.0, d.y * 14.0, 3.1), 4) * 0.5 + 0.5;
          float body = 1.0 - smoothstep(top - 0.03, top + 0.004, d.y + (n - 0.5) * 0.04);
          float k = body * smoothstep(0.0, 0.02, d.y) * uStClouds;
          // 雲の上の縁は少し明るい（日を受ける）
          vec3 cc = mix(uCloudColor, c, smoothstep(top - 0.05, top, d.y) * 0.5);
          c = mix(c, cc, k);
        }
        if (uStHills > 0.0 && d.y > -0.03) {
          // 遠くの低い丘（地平線の少し上まで、なだらかな上の縁）
          float h = 0.002 + 0.02 * smoothstep(0.45, 0.8, sl_fbm(vec3(az * 2.4, 3.3, 9.1), 4) * 0.5 + 0.5);
          float k = 1.0 - smoothstep(h - 0.002, h + 0.002, d.y);
          c = mix(c, uHillColor, k * uStHills);
        }
        gl_FragColor = vec4(c, 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,side:1,depthWrite:!1}),o=new ie(i,a);return o.name=`station-sky`,o.renderOrder=-1e3,o.frustumCulled=!1,o.onBeforeRender=(e,t,n)=>{o.position.setFromMatrixPosition(n.matrixWorld),o.updateMatrixWorld(),r.looks.apply(o.position.x,o.position.z)},o}function Mt(e,t,n){let r=[],i=[],a=new C(2,.14,.22),o=(t,a=n.ballast,o={})=>{let s=o.rail??n.rail,c=o.railTop??n.railTop,l=.3;for(let n=0;n+1<t.length;n++){let[u,d]=t[n],[f,p]=t[n+1],m=f-u,h=p-d,g=Math.hypot(m,h),_=m/g,v=h/g,y=Math.atan2(_,v),b=(u+f)/2,x=(d+p)/2,ee=Math.abs(m)<1e-6,te=ee?0:.6;o.bed!==!1&&(ee?e.boxMM(a,[u-2.1,O.ground-.1,Math.min(d,p)],[u+2.1,O.ballast-.02,Math.max(d,p)],{shadow:!1}):e.box(a,[b,(O.ground-.1+O.ballast-.02)/2,x],[4.2,O.ballast-.02-O.ground+.1,g+te],{rotY:y,shadow:!1}));for(let t of[-1,1]){let n=v*t*(A.gauge/2),r=-_*t*(A.gauge/2);if(ee){let t=u+n;e.boxMM(s,[t-.035,O.ballast,Math.min(d,p)],[t+.035,O.rail-.012,Math.max(d,p)],{shadow:!1}),e.boxMM(c,[t-.033,O.rail-.012,Math.min(d,p)],[t+.033,O.rail,Math.max(d,p)],{shadow:!1})}else e.box(s,[b+n,(O.ballast+O.rail-.012)/2,x+r],[.07,O.rail-.012-O.ballast,g+.05],{rotY:y,shadow:!1}),e.box(c,[b+n,O.rail-.006,x+r],[.066,.012,g+.05],{rotY:y,shadow:!1})}let S=l;for(;S<g;S+=.6){let e=u+_*S,t=d+v*S;if(!(Math.hypot(e+30,t)>260)&&(r.push(D(e,O.ballast-.07,t,y)),!(Math.hypot(e+30,t-10)>160)))for(let n of[-1,1]){let r=e+v*n*(A.gauge/2),a=t-_*n*(A.gauge/2);for(let e of[-.09,.09])i.push(D(r+v*e,O.ballast+.02,a-_*e,y,1,1,1))}}l=S-g}},s=(t,r,i)=>{let a=r;for(let r of[-1,1]){let o=t+r*(A.gauge/2);T(e,n.rail,[o,O.ballast,a-i*1.6],[o,O.ballast+.95,a],.08,.08),e.box(n.rail,[o,O.ballast+.5,a],[.08,1,.08])}e.box(n.wood,[t,O.ballast+.88,a],[1.9,.26,.22],{collide:!0}),e.box(n.redLit,[t,O.ballast+.88,a-i*.12],[.5,.2,.01]),e.box(n.signWhite,[t-.4,O.ballast+.88,a-i*.12],[.3,.2,.01]),e.box(n.signWhite,[t+.4,O.ballast+.88,a-i*.12],[.3,.2,.01])},c=-330;o([[A.t1,c],[A.t1,j.t12]],n.ballastA),o([[A.t2,c],[A.t2,j.t12]],n.ballastA),o([[A.t2,-150],[A.t1,-122]],n.ballastA,{bed:!1});for(let t of[A.t1,A.t2])e.boxMM(n.steel,[t-.9,O.ballast,j.t12],[t+.9,O.ballast+.9,j.t12+.3],{collide:!0});for(let e of[-1,1]){let t=e*Math.abs(A.t3),n=e*Math.abs(A.t4),r=e*8.8;o([[t,j.t36],[t,105],[e*10.6,132],[r,150]]),o([[n,j.t45],[n,112],[e*7.2,138],[r,150]]),o([[r,150],[e*11,205],[e*30,280],[e*70,350],[e*130,420]]),s(t,j.t36,-1),s(n,j.t45,-1)}o([[A.t0,j.t0],[A.t0,72],[-72.5,105],[-80,150],[-100,205],[-140,270],[-200,340]]),s(A.t0,j.t0,-1),o([[A.t7,j.t7],[A.t7,50],[-73.6,60],[-71.6,68]],n.ballast,{rail:n.railRust,railTop:n.railRust}),s(A.t7,j.t7,-1),E(e.root,a,n.sleeper,r),E(e.root,new C(.09,.05,.12),n.clip,i);for(let r=0;r<K.n;r++){let i=K.z0-r*K.step;for(let r of[-1,1]){let a=r>0?.9:0,o=r*(K.x+.4+a),s=r*(K.x-.8+a);ve(e,n.steel,o,i,O.ground,5.4,.3,.3),ve(e,n.steel,s,i,O.ground,4.7,.22,.22),e.box(n.pedestal,[o,O.ground+.3,i],[.7,.6,.7]),e.boxMM(n.steel,[Math.min(o,r*4.8),5.25,i-.1],[Math.max(o,r*4.8),5.45,i+.1]),T(e,n.steel,[s,3.4,i],[r*5.2,4.6,i],.08,.08),T(e,n.steel,[s,4,i],[r*5,3.95,i],.07,.07),i>-100&&t.colliders.addCentered(o,0,i,.7,3,.7)}}for(let t=K.z0-K.n*K.step-32;t>c;t-=50)for(let r of[-1,1]){let i=r*(K.x+.4+(r>0?.9:0));ve(e,n.steel,i,t,O.ground,5.4,.3,.3),e.boxMM(n.steel,[Math.min(i,r*4.8),5.25,t-.1],[Math.max(i,r*4.8),5.45,t+.1])}let l=c,u=M.z0+2,d=M.z1-.8;for(let t of[A.t1,A.t2]){e.boxMM(n.wire,[t-.012,5.3,l],[t+.012,5.324,u]),e.boxMM(n.wire,[t-.012,4.1,l],[t+.012,4.12,d]);for(let r=u-2;r>l;r-=4.5)e.boxMM(n.wire,[t-.006,4.12,r-.006],[t+.006,5.3,r+.006]);T(e,n.wire,[t,5.3,u],[t,4.38,u+3],.024,.024),e.boxMM(n.wire,[t-.012,4.37,u+3],[t+.012,4.39,d]);for(let r=u+4;r<d;r+=3)e.boxMM(n.wire,[t-.006,4.12,r-.006],[t+.006,4.37,r+.006]);e.box(n.steel,[t,4.25,d],[.08,.3,.08])}for(let t of[-1,1])for(let[r,i]of[[0,5.55],[-.6,5.2],[.5,5.35]]){let a=t*(K.x+.4+r);e.boxMM(n.wire,[a-.012,i,l],[a+.012,i+.024,u])}for(let t=0;t<K.n;t++){let r=K.z0-t*K.step;for(let t of[-1,1]){let i=t*(K.x-.8);e.box(n.steel,[i-t*.15,2.8,r],[.22,.4,.22]),e.box(n.steel,[i-t*.15,3.6,r],[.18,.25,.18]),e.box(n.steel,[t*5.3,4.95,r],[.12,.3,.12])}}for(let t of[-1,1]){let r=t*7.6;e.box(n.poleConc,[r,O.ground+2.6,-92],[.22,5.2,.22]),e.box(n.black,[r,O.ground+4.6,-91.85],[.42,1.1,.12]);for(let t=0;t<3;t++)e.box(t===2?n.redLit:n.black,[r,O.ground+4.25+t*.33,-91.78],[.18,.18,.02]);e.box(n.steel,[r,O.ground+4.6,-91.67],[.5,.04,.3])}{let t=A.t0-2.2;e.box(n.poleConc,[t,O.ground+2.2,-14],[.2,4.4,.2]),e.box(n.black,[t,O.ground+3.9,-13.86],[.4,.95,.1]);for(let r=0;r<2;r++)e.box(r===1?n.redLit:n.black,[t,O.ground+3.65+r*.38,-13.8],[.17,.17,.02]);e.box(n.board,[t,O.ground+2.6,-13.88],[.3,.3,.02])}let f=(t,r,i,a,o)=>{e.boxMM(n.far,[t-i/2,O.ground,r-a/2],[t+i/2,O.ground+o,r+a/2])};f(-75,-150,60,14,6),f(-130,-170,40,12,5),f(85,-160,50,16,7),f(140,-190,30,12,5);let p=(t,r,i,a)=>{for(let o of[-a/2,a/2])for(let s of[-a/2,a/2])T(e,n.far,[t+o*1.6,O.ground,r+s*1.6],[t+o*.5,O.ground+i,r+s*.5],.12,.12);for(let o=.9;o<i-.3;o+=1.3)e.box(n.far,[t,O.ground+o,r],[a*(1.6-o/i*1.1),.1,a*(1.6-o/i*1.1)]);e.box(n.far,[t,O.ground+i+.4,r],[a*1.3,.8,a*1.3])};e.box(n.far,[76.3,(O.ground+12.6)/2,8.5],[.4,12.6-O.ground,.4]),e.box(n.far,[76.3,11.3,9.1],[.25,.25,3.2]),e.box(n.far,[76.3,10,8.8],[.6,1,.7]),p(96.3,2.5,11,1.6),p(116.3,12.3,10.5,1.6),e.boxMM(n.far,[123,O.ground,-21.9],[129,O.ground+4.6,-15.5]),e.box(n.far,[86.3,(O.ground+8.7)/2,97.7],[.25,8.7-O.ground,.25]);{let t=-230,r=O.ground;e.boxMM(n.farHaze,[-204,r,-250],[-126,6.6,t]),e.boxMM(n.farHaze,[-128,r,-244],[-106,7.2,-226]),e.boxMM(n.farHaze,[119,r,-254],[260,5.8,t]),e.boxMM(n.farHaze,[167,r,-248],[187,10,-232]),e.boxMM(n.farHaze,[60,r,-260],[100,4.5,-240]);for(let t of[-198,-169,-163,-137])e.box(n.farHaze,[t,(r+12.3)/2,-220],[.5,12.3-r,.5]),e.box(n.farHaze,[t,11.8,-220],[3.2,.3,.3]);for(let i of[77,96,120,148,185])e.box(n.farHaze,[i,(r+8.1)/2,t],[.4,8.1-r,.4]),e.box(n.farHaze,[i,7.7,t],[2.4,.25,.25])}}function Nt(e,t,n,r){ze(e,t,!1,t=>It(t,e,n));let i=ze(e,t,!0,t=>Pt(t,e,n,Re(t,n,r))),a=ze(e,t,!0,t=>Gt(t,e,n,Re(t,n,r))),o=ze(e,t,!0,e=>Kt(e,n,Re(e,n,r))),s=e=>e.x>I.x0&&e.x<I.x1&&e.z>I.z0&&e.z<I.z1&&e.y<3.2,c=[],u=[];for(let e=B.zBot+.2;e<=B.zTop;e+=.8)for(let t of[-B.half,0,B.half])c.push(new l(t,0,e));for(let e=z.xTop;e<=z.xBot;e+=.8)for(let t of[R.z0,(R.z0+R.z1)/2,R.z1])u.push(new l(e,0,t));let d=new se,p=new f,m=e=>(p.set(e.x,e.y,e.z,1).applyMatrix4(d),p.w<=.05?!1:Math.abs(p.x/p.w)<1.1&&Math.abs(p.y/p.w)<1.1);return e=>{e.updateMatrixWorld();let t=e.position,n=t.y<-.3;a.renderOrder=s(t)?-1:1;let r=Math.max(I.x0-t.x,0,t.x-I.x1),l=Math.max(I.z0-t.z,0,t.z-I.z1),f=Math.hypot(r,l);if(a.visible=f<30||n,i.visible=f<70&&t.x>I.x0+2,o.renderOrder=n?-1:1,n){o.visible=!0;return}d.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),o.visible=c.some(m)||s(t)&&u.some(m)}}function Pt(e,t,n,r){let{x0:a,x1:o,z0:s,z1:c,eave:l}=I,u=s+18.8;for(let t of[-1,1]){let r=t>0?o:a;for(let i=s-.3;i<=c+.3;i+=.9)e.box(n.roofTile,[r+t*.38,l-.03,i],[.7,.1,.07],{shadow:!1});e.box(n.sash,[r+t*.72,l+.02,(s+c)/2],[.05,.2,c-s+1.2],{shadow:!1})}for(let t of[-1.6,1.6])e.box(n.housing,[o+1.2,2.56,u+t],[.3,.06,1.3],{shadow:!1}),r([o+1.2,2.5,u+t],1.1,`z`,.06,.04,!0);e.boxMM(n.wood,[o+.1,.95,s+7.9],[o+.16,2.05,s+10.4]),e.mesh(Z(`notice`,[2.4,1,.02]),n.signLit,[o+.18,1.5,s+9.15],{rotY:Math.PI/2,shadow:!1}),e.mesh(Z(`timetable`,[1,.8,.02]),n.signLit,[o+.13,1.4,s+13.6],{rotY:Math.PI/2,shadow:!1}),e.boxMM(n.housing,[o+.1,.85,s+24.05],[o+.18,2.15,s+24.95]),e.mesh(Z(`ad`,[.8,1.2,.02]),n.signGlow,[o+.19,1.5,s+24.5],{rotY:Math.PI/2,shadow:!1});for(let t of[-3.6,3.6])e.box(n.steel,[o+.25,2.3,u+t],[.3,.04,.04],{shadow:!1}),e.box(n.housing,[o+.4,2.22,u+t],[.18,.14,.18],{shadow:!1}),e.box(n.lampBox,[o+.4,2.15,u+t],[.14,.02,.14],{shadow:!1});$e(e,n.benchT,n.steel,[o+.55,O.road+.12,s+10.6],-Math.PI/2,3,.55),t.colliders.add({x:o+.2,y:O.road,z:s+9.7},{x:o+.9,y:O.road+1,z:s+11.5});for(let t=0;t<3;t++){let r=s+13+t*.52;e.boxMM(n.steel,[o+.25,O.road+.12,r-.22],[o+.7,O.road+.97,r+.22],{collide:!0}),e.boxMM([n.board,n.signWhite,n.green][t],[o+.23,O.road+.97,r-.23],[o+.72,O.road+1.02,r+.23]),e.box(n.black,[o+.71,O.road+.82,r],[.01,.06,.22],{shadow:!1})}for(let t=0;t<4;t++){let r=s+22.2+t*.75;e.boxMM(n.wood,[o+.2,O.road+.12,r-.3],[o+.7,O.road+.55,r+.3],{collide:!0});for(let i=0;i<3;i++)e.mesh(new p(.2+(t+i)%3*.04,0),n.hedge,[o+.45+(i-1)*.1,O.road+.68+i%2*.08,r+(i-1)*.15],{shadow:!1})}for(let t of[s+2.2,s+3])e.mesh(new i(.33,.02,4,16),n.black,[o+.3,O.road+.46,t-.45],{shadow:!1}),e.mesh(new i(.33,.02,4,16),n.black,[o+.3,O.road+.46,t+.55],{shadow:!1}),e.box(n.steel,[o+.3,O.road+.75,t+.05],[.03,.03,.9],{shadow:!1}),e.box(n.steel,[o+.3,O.road+.98,t+.45],[.5,.03,.03],{shadow:!1});let d={x:n.tactileXo,z:n.tactileZo,dot:n.tactileDoto},f=O.road+.12;Ft(e,d,o+1.85,V.z0+.5,o+2.15,u-.15,f,`start`),Ft(e,d,o+1.85,u+.15,o+2.15,V.z1-.5,f,`end`),e.boxMM(n.tactileDoto,[o+1.85,f,u-.15],[o+2.15,f+.004,u+.15],{shadow:!1}),Ft(e,d,o+1,u-.15,o+1.85,u+.15,f,`none`)}function Ft(e,t,n,r,i,a,o,s=`both`){let c=i-n>a-r,l=o+.004,u=s===`both`||s===`start`?.3:0,d=s===`both`||s===`end`?.3:0;c?(u&&e.boxMM(t.dot,[n,o,r],[n+u,l,a],{shadow:!1}),d&&e.boxMM(t.dot,[i-d,o,r],[i,l,a],{shadow:!1}),e.boxMM(t.x,[n+u,o,r],[i-d,l,a],{shadow:!1})):(u&&e.boxMM(t.dot,[n,o,r],[i,l,r+u],{shadow:!1}),d&&e.boxMM(t.dot,[n,o,a-d],[i,l,a],{shadow:!1}),e.boxMM(t.z,[n,o,r+u],[i,l,a-d],{shadow:!1}))}function It(e,t,n){let{x0:r,x1:i,z0:a,z1:s,eave:c,ridge:l}=I,u=.2,d=(r+i)/2,f=[z.xTop,R.z0,z.xBot,R.z1],p=[[r,a,i,f[1]],[r,f[3],i,s],[r,f[1],f[0],f[3]],[f[2],f[1],i,f[3]]];for(let r of p)e.boxMM(n.wallBase,[r[0],O.ground,r[1]],[r[2],-.04,r[3]]),e.boxMM(n.floorInt,[r[0],-.04,r[1]],[r[2],0,r[3]],{layer:1}),t.colliders.add({x:r[0],y:O.ground,z:r[1]},{x:r[2],y:0,z:r[3]});let m=(t,r,i)=>{he(e,n.wallExtW,t,r,0,c,u,i);let o=r[0]-t[0],l=r[1]-t[1],f=Math.hypot(o,l),p=-l/f,m=o/f,h=(t[0]+r[0])/2,g=(t[1]+r[1])/2,_=((h+p-d)**2+(g+m-(a+s)/2)**2>(h-d)**2+(g-(a+s)/2)**2?1:-1)*.12000000000000001,v=[t[0]+p*_,t[1]+m*_],y=[r[0]+p*_,r[1]+m*_];he(e,n.wallBase,v,y,0,.9,.04,i.map(e=>({...e,bottom:Math.min(e.bottom,0),top:Math.max(e.top,.9)})),{collide:!1})};m([r,a],[r,s],[{at:6,width:5.2,bottom:0,top:2.6},{at:11.6,width:3.2,bottom:.9,top:2.1},{at:18.5,width:6.6,bottom:0,top:2.5},{at:26.2,width:1.6,bottom:1.7,top:2.3}]),m([i,a],[i,s],[{at:4.5,width:6,bottom:1.6,top:2.5},{at:11.6,width:1.6,bottom:1,top:2},{at:15.7,width:1.8,bottom:.9,top:2.3},{at:18.8,width:3,bottom:0,top:2.4},{at:22.4,width:2.6,bottom:.9,top:2.3},{at:26.2,width:1.6,bottom:1.7,top:2.3}]),m([r-u/2,a],[i+u/2,a],[{at:7.5,width:6,bottom:1.7,top:2.5}]),m([r-u/2,s],[i+u/2,s],[{at:4,width:1.2,bottom:1.7,top:2.3},{at:10.8,width:1.2,bottom:1.7,top:2.3}]);let h=(t,o,c,l,u,d,f=!0)=>{let p=c===`z`?[.04,d-u,l]:[l,d-u,.04];e.box(f?n.winGlass:n.glass,[t,(u+d)/2,o],p,{shadow:!1});let m=Math.max(1,Math.round(l/.9));for(let r=1;r<m;r++){let i=-l/2+r*l/m;e.box(n.sash,c===`z`?[t,(u+d)/2,o+i]:[t+i,(u+d)/2,o],c===`z`?[.07,d-u,.05]:[.05,d-u,.07],{shadow:!1})}e.box(n.sash,[t,(u+d)/2,o],c===`z`?[.09,.06,l]:[l,.06,.09],{shadow:!1});let h=c===`z`?t>(r+i)/2?1:-1:0,g=c===`x`?o>(a+s)/2?1:-1:0,_=(e,t)=>c===`z`?[e,t,l+.2]:[l+.2,t,e];e.box(n.sash,[t+h*.13,u-.03,o+g*.13],_(.16,.06),{shadow:!1}),e.box(n.sash,[t+h*.11,d+.04,o+g*.11],_(.12,.08),{shadow:!1});for(let r of[-1,1]){let i=c===`z`?[t+h*.105,(u+d)/2,o+r*(l/2+.04)]:[t+r*(l/2+.04),(u+d)/2,o+g*.105];e.box(n.sash,i,c===`z`?[.05,d-u,.08]:[.08,d-u,.05],{shadow:!1})}};h(i,a+4.5,`z`,6,1.6,2.5),h(i,a+11.6,`z`,1.6,1,2),h(i,a+15.7,`z`,1.8,.9,2.3),h(i,a+22.4,`z`,2.6,.9,2.3),h(i,a+26.2,`z`,1.6,1.7,2.3,!1),h(r,a+11.6,`z`,3.2,.9,2.1),h(r,a+26.2,`z`,1.6,1.7,2.3,!1),h(r+7.5,a,`x`,6,1.7,2.5),h(r+4,s,`x`,1.2,1.7,2.3,!1),h(r+10.8,s,`x`,1.2,1.7,2.3,!1);{let t=a+18.8;for(let r of[-1,1])e.box(n.sash,[i+.12,1.2,t+r*1.15],[.05,2.4,.7]),e.box(n.winGlass,[i+.12,1.3,t+r*1.15],[.03,1.9,.55],{shadow:!1});e.boxMM(n.roofTile,[i,2.6,t-3.2],[i+2.4,2.75,t+3.2]),e.boxMM(n.sash,[i+2.3,2.45,t-3.2],[i+2.4,2.75,t+3.2]);for(let r of[-1,1])e.box(n.steel,[i+2.25,1.3,t+r*3.05],[.1,2.6,.1]);e.mesh(Z(`name`,[.06,.6,4.8]),n.signLit,[i+.14,3.35,t]);for(let r=0;r<3;r++){let a=O.road+(r+1)*(0-O.road)/3;e.boxMM(n.curb,[i+.1+(2-r)*.32,O.road-.05,t-3],[i+.1+(3-r)*.32,a,t+3],{collide:!0})}}{let t=.7,f=(i-r)/2+t,p=l-c+t*(l-c)/((i-r)/2),m=Math.atan2(p,f),h=Math.hypot(f,p);for(let t of[-1,1]){let r=d+f/2*t,i=l-p/2+.1;e.box(n.roofTile,[r,i,(a+s)/2],[h,.18,s-a+1.2],{rotZ:-t*m});for(let o=a-.4;o<s+.5;o+=.45)e.box(n.sash,[r,i+.1,o],[h,.04,.05],{rotZ:-t*m,shadow:!1})}e.box(n.sash,[d,l+.2,(a+s)/2],[.3,.2,s-a+1.2]);let g=new x;g.moveTo(r,c),g.lineTo(d,l),g.lineTo(i,c),g.lineTo(r,c);for(let t of[a,s]){let r=new o(g,{depth:u,bevelEnabled:!1});r.translate(0,0,-.2/2),e.mesh(r,n.wallExtW,[0,0,t])}ge(e,n.ceilInt,[r,a,i,s],3.1,.1,{shadow:!1,collide:!1,layer:1});for(let[t,o]of[[r+.2,a-.15],[i-.2,a-.15],[r+.2,s+.15],[i-.2,s+.15]])e.cyl(n.steel,[t,c/2,o],.05,c,{segments:8});e.boxMM(n.vending,[i-3.6,0,s+.15],[i-2.8,.62,s+.45],{collide:!0}),e.box(n.black,[i-3.2,.31,s+.46],[.5,.5,.01]),e.boxMM(n.steel,[i-2.75,.4,s+.12],[i-2.68,2.4,s+.18]),e.boxMM(n.wallBase,[i-6.2,1.2,a-.3],[i-5.4,2,a-.12]),e.box(n.board,[i-5.8,1.6,a-.31],[.3,.2,.01]),e.boxMM(n.steel,[r+2,.5,s+.12],[r+2.1,.6,s+.3]),e.boxMM(n.roof,[F.x+F.half-.25,F.soffit,a],[r,F.soffit+.25,s]);for(let o of[-1,1])e.box(n.steel,[d+o*((i-r)/2+t-.05),c-.18,(a+s)/2],[.12,.1,s-a+1.2])}}var Lt=[.96,1.28,1.22],Rt=[.6,1.04,.99],zt=(e,t)=>[e[0]*t,e[1]*t,e[2]*t];function Bt(e,t,n,r,i,a,o,s,c=1.25,l=4.2,u=1.2){let d=o===`x`?[u+.2,.07,.34]:[.34,.07,u+.2];e.box(t.housingIn,[r,i-.035,a],d,{shadow:!1});for(let e of[-.08,.08])n(o===`x`?[r,i-.1,a+e]:[r+e,i-.1,a],u,o,.055,.04,!0);Ee({kind:0,c:[r,i-.12,a],axis:o===`x`?[1,0,0]:[0,0,1],half:u/2,radius:l,color:zt(Lt,c),box:s})}function Vt(e,t,n,r,i,a,o=1,s=4.5){let c=t===`x`?[1,0,0]:[0,0,1],l=t===`x`?-i:i;Ee({kind:1,c:e,axis:c,half:n/2,halfH:r/2,radius:s,color:zt(Rt,o),box:a,side:l})}function Q(e,t,n,r,i,a,o,s=!1){let c=o===`x`?Math.PI/2:o===`-x`?-Math.PI/2:o===`-z`?Math.PI:0,l=o===`x`?1:o===`-x`?-1:0,u=o===`z`?1:o===`-z`?-1:0;e.mesh(new C(i+.08,a+.08,.04),t.housingIn,[r[0]-l*.01,r[1],r[2]-u*.01],{rotY:c,shadow:!1}),e.mesh(Z(n,[i,a,.02]),s?t.signGlowIn:t.signLitIn,[r[0]+l*.02,r[1],r[2]+u*.02],{rotY:c,shadow:!1,layer:1})}function Ht(e,t,n,r,i,a,o){for(let o of[-1,1]){let s=i===`x`?[0,0,o*.026]:[o*.026,0,0],c=i===`x`?o>0?0:Math.PI:o>0?Math.PI/2:-Math.PI/2;e.mesh(Z(n,[a,.3,.02]),t.signGlowIn,[r[0]+s[0],r[1],r[2]+s[2]],{rotY:c,shadow:!1,layer:1})}e.box(t.blackIn,r,i===`x`?[a+.06,.36,.03]:[.03,.36,a+.06],{shadow:!1});for(let n of[-1,1]){let s=i===`x`?[r[0]+n*(a/2-.15),(r[1]+.18+o)/2,r[2]]:[r[0],(r[1]+.18+o)/2,r[2]+n*(a/2-.15)];e.box(t.steelIn,s,[.02,o-r[1]-.18,.02],{shadow:!1})}}function Ut(e,t,n,r,i,a,o,s=`both`){Ft(e,{x:t.tactileX,z:t.tactileZ,dot:t.tactileDot},n,r,i,a,o,s)}function Wt(e,t,n,r,i,a,o=.22,s=.18){for(let c of i)n===`x`?e.boxMM(t.woodIn,[r[0],a-o,c-s/2],[r[1],a,c+s/2],{shadow:!1}):e.boxMM(t.woodIn,[c-s/2,a-o,r[0]],[c+s/2,a,r[1]],{shadow:!1})}function Gt(e,t,n,i){let{x0:a,x1:o,z0:s,z1:c}=I,l=.2,u=(a+o)/2,d=a+l/2,f=o-l/2,m=(t,r,i)=>he(e,n.wallInt,t,r,0,3.1,.12,i);m([d,L.zA],[f,L.zA],[{at:3,width:.9,bottom:0,top:2},{at:11.5,width:.9,bottom:0,top:2}]),m([d,L.zB],[f,L.zB],[{at:3.2,width:1.8,bottom:.85,top:1.95}]),m([L.xOff,L.zA],[L.xOff,L.zB],[]),m([d,L.zC],[f,L.zC],[{at:4.2,width:1,bottom:0,top:2.1},{at:9.6,width:1,bottom:0,top:2.1}]),m([u,L.zC],[u,c-l/2],[]);for(let t of[d+3,d+11.5])e.box(n.doorIn,[t,1,L.zA+.08],[.9,2,.04],{collide:!0}),e.box(n.sashIn,[t,2.04,L.zA+.08],[1.04,.08,.06],{shadow:!1}),e.box(n.steelIn,[t+.32,1,L.zA+.11],[.12,.03,.03],{shadow:!1});for(let t of[d+4.2,d+9.6])e.box(n.sashIn,[t,1.05,L.zC-.08],[1,2.1,.04],{collide:!0}),e.box(t<u?n.signal:n.signalG,[t,2.3,L.zC-.1],[.3,.3,.02]);{let r=L.zB,c=L.zC,l=[d,-.1,r+.06,f,3.1,c-.06];Wt(e,n,`x`,[d,f],[r+1.3,r+3.9,r+6.5,r+9.1],3),Wt(e,n,`z`,[r+.06,c-.06],[u],3,.16,.22);for(let t of[r+2.6,r+7.8])for(let r of[d+2.6,u-2.2,f-2.6])Bt(e,n,i,r,3,t,`x`,l);for(let[t,i]of[[u+3.4,r+5.2],[d+4.4,r+5.2]])e.cyl(n.boardIn,[t,2.97,i],.09,.05,{segments:12,shadow:!1});e.boxMM(n.blackIn,[f-1.6,2.92,r+5],[f-1.2,3,r+5.4],{shadow:!1}),Vt([o,1.6,r+1.6],`z`,1.8,1.4,-1,l,.9),Vt([o,1.2,s+18.8],`z`,3,2.4,-1,l,1.1,5.5),Vt([o,1.6,s+22.4],`z`,2.6,1.4,-1,l,.9),Vt([a,1.25,s+18.5],`z`,6.6,2.5,1,l,.75,5.5),$e(e,n.benchIn,n.steelIn,[u+1.6,0,(r+c)/2-.35],0,6,.55),$e(e,n.benchIn,n.steelIn,[u+1.6,0,(r+c)/2+.35],Math.PI,6,.55),t.colliders.add({x:u+1.6-1.75,y:0,z:(r+c)/2-.7},{x:u+1.6+1.75,y:.9,z:(r+c)/2+.7}),$e(e,n.benchIn,n.steelIn,[o-.55,0,c-2],Math.PI/2,4,.55),t.colliders.add({x:o-.9,y:0,z:c-3.2},{x:o-.2,y:.9,z:c-.8});for(let t of[a+6.4,a+7.4])e.boxMM(n.ticketIn,[t-.42,0,r+.06],[t+.42,1.65,r+.62],{collide:!0}),e.box(n.ticketScreen,[t,1.15,r+.63],[.5,.36,.02],{shadow:!1}),e.box(n.blackIn,[t,.75,r+.63],[.3,.12,.02]),e.box(n.boardIn,[t,1.5,r+.63],[.6,.08,.02],{shadow:!1}),e.boxMM(n.housingIn,[t-.44,1.65,r+.06],[t+.44,1.75,r+.66]);Q(e,n,`fare`,[a+6.9,2.25,r+.08],2.2,.85,`z`),e.mesh(Z(`kippu`,[1.5,.22,.03]),n.signGlowIn,[a+6.9,2.86,r+.1],{shadow:!1,layer:1}),e.boxMM(n.wallBaseIn,[a+2.2,0,r-.1],[a+4.2,.85,r+.35]),e.boxMM(n.boardIn,[a+2.2,.85,r-.1],[a+4.2,.9,r+.4]),e.box(n.winGlass,[a+3.2,1.4,r],[1.8,1.1,.02],{shadow:!1}),e.boxMM(n.sashIn,[a+2.25,1.95,r+.06],[a+4.15,2.05,r+.1]),e.box(n.boardIn,[a+3.2,2.25,r+.08],[1.2,.22,.02],{shadow:!1});{let t=a+9.2,i=a+11.6,o=r+.56;e.boxMM(n.lockerIn,[t,0,r+.06],[i,1.85,o],{collide:!0}),e.boxMM(n.housingIn,[t-.02,1.85,r+.06],[i+.02,1.95,o+.02]);for(let r=1;r<4;r++)e.box(n.blackIn,[t+r*(i-t)/4,.95,o+.003],[.015,1.8,.01],{shadow:!1});for(let r=1;r<5;r++)e.box(n.blackIn,[(t+i)/2,.08+r*.354,o+.003],[i-t,.015,.01],{shadow:!1});for(let r=0;r<4;r++)for(let i=0;i<5;i++)e.box(n.steelIn,[t+(r+.8)*.6,.08+(i+.5)*.354,o+.008],[.04,.06,.012],{shadow:!1})}e.boxMM(n.redIn,[f-1.75,.5,r+.06],[f-1.05,1.4,r+.24]),e.box(n.redLit,[f-1.4,1.55,r+.12],[.12,.12,.08],{shadow:!1});{let t=a+12.6;e.boxMM(n.woodIn,[t-.4,0,r+.06],[t+.4,1.45,r+.36]);let i=[n.boardIn,n.redIn,n.greenIn,n.boardIn,n.ticketIn];for(let n=0;n<4;n++)for(let a=0;a<3;a++)e.box(i[(n*3+a)%i.length],[t-.25+a*.25,.55+n*.24,r+.38],[.2,.2,.02],{rotX:-.25,shadow:!1})}Q(e,n,`timetable`,[d+.03,1.6,r+.9],1.3,1.1,`x`),e.mesh(Z(`depart`,[1.5,.19,.03]),n.signGlowIn,[d+.04,2.62,s+16.3],{rotY:Math.PI/2,shadow:!1,layer:1}),e.boxMM(n.blackIn,[d,2.5,s+15.5],[d+.03,2.74,s+17.1],{shadow:!1}),e.cyl(n.boardIn,[d+.02,2.75,s+18.5],.2,.06,{axis:`x`,segments:20}),e.box(n.blackIn,[d+.06,2.78,s+18.5],[.01,.13,.02]),e.box(n.blackIn,[d+.06,2.75,s+18.55],[.01,.02,.1]),Ht(e,n,`hangGate`,[a+4.4,2.42,s+18.5],`z`,2.6,3),Q(e,n,`posters`,[f-.03,1.2,r+.9],1.2,.9,`-x`),Q(e,n,`posters`,[o-2,1.55,c-.09],2,.9,`-z`),Q(e,n,`notice`,[a+7.2,1.55,c-.09],2.6,1,`-z`),Q(e,n,`dengon`,[a+1.7,1.5,c-.09],1.3,1,`-z`),Q(e,n,`ad`,[f-.03,1.55,s+21-.6],.5,.7,`-x`,!0),e.boxMM(n.vendingIn,[o-.95,0,c-.95],[o-.12,1.83,c-.12],{collide:!0}),e.box(n.vendingLit,[o-.96,1.25,c-.53],[.02,.6,.6],{shadow:!1}),e.box(n.blackIn,[o-.96,.4,c-.53],[.02,.18,.4]);for(let t=0;t<3;t++){let i=r+2.2+t*.5;e.boxMM(n.steelIn,[f-.45,0,i-.21],[f-.05,.85,i+.21],{collide:!0}),e.boxMM([n.boardIn,n.ticketIn,n.greenIn][t],[f-.47,.85,i-.22],[f-.04,.9,i+.22]),e.box(n.blackIn,[f-.46,.7,i],[.01,.06,.2],{shadow:!1})}for(let[t,i]of[[d,d+.02],[f-.02,f]]){let a=t<u?[[15.2,21.8]]:[[17.3,20.3],[14.8,16.6],[21.1,23.7]],o=r+.06,s=(r,a)=>{e.boxMM(n.wallBaseIn,[t,0,r],[i,.95,a]),e.boxMM(n.woodIn,[Math.min(t,i)-.01,.95,r],[Math.max(t,i)+.01,1,a],{shadow:!1})};for(let[e,t]of[...a].sort((e,t)=>e[0]-t[0]))e>o&&s(o,e),o=Math.max(o,t);o<c-.06&&s(o,c-.06)}e.boxMM(n.wallBaseIn,[a+4.4,0,c-.08],[o-.2,.95,c-.06]);for(let t of[r+.16,s+16.95,s+20.65,c-.16])e.boxMM(n.woodIn,[f-.12,0,t-.12],[f,3,t+.12],{shadow:!1});for(let t of[r+.16,s+15.1,s+21.9,c-.16])e.boxMM(n.woodIn,[d,0,t-.12],[d+.12,3,t+.12],{shadow:!1});e.cyl(n.redLit,[o-1.4,.3,c-.3],.09,.55,{segments:10}),e.cyl(n.woodIn,[a+1,.25,c-.6],.25,.5,{segments:12,collide:!0});for(let t=0;t<6;t++)e.mesh(new p(.22,0),n.hedge,[a+1+Math.cos(t)*.15,.7+t*.08,c-.6+Math.sin(t*2)*.15]);Ut(e,n,a+2.4,s+17.95,f-.3,s+18.25,0,`both`),Ut(e,n,a+2.4,r+.8,a+2.7,s+17.95,0,`start`),e.boxMM(n.blackIn,[f-1.4,0,s+17.4],[f-.05,.01,s+20.2],{shadow:!1})}{let t=s+18.5,r=a+.9;for(let i of[-2.15,-1,.15,1.3])e.boxMM(n.vendingIn,[r-.7,0,t+i-.125],[r+.7,.95,t+i+.125],{collide:!0}),e.boxMM(n.blackIn,[r-.72,.95,t+i-.13],[r+.72,1.02,t+i+.13]),e.box(n.ticketScreen,[r-.2,1.03,t+i],[.18,.01,.16],{shadow:!1}),e.box(n.signalG,[r-.71,.8,t+i],[.01,.08,.08],{shadow:!1}),e.box(n.signalG,[r+.71,.8,t+i],[.01,.08,.08],{shadow:!1});e.boxMM(n.wallBaseIn,[r-.8,0,t+2],[r+.8,1.05,t+3.1],{collide:!0}),e.boxMM(n.boardIn,[r-.85,1.05,t+1.95],[r+.85,1.1,t+3.15]),e.box(n.winGlass,[r,1.5,t+1.97],[1.5,.8,.02],{shadow:!1}),e.mesh(Z(`guide`,[3.8,.36,.05]),n.signUnlit,[a-.05,2.75,t],{shadow:!1,rotY:-Math.PI/2})}{let t=L.zA,r=L.zB,o=[d,-.1,t+.06,L.xOff-.06,3.1,r-.06];e.boxMM(n.woodIn,[a+1.5,0,t+1],[a+3.5,.72,t+1.9],{collide:!0}),e.boxMM(n.woodIn,[a+4.2,0,t+1],[a+6.2,.72,t+1.9],{collide:!0});for(let r of[a+2.5,a+5.2])e.box(n.blackIn,[r,.45,t+2.4],[.45,.08,.45]),e.box(n.blackIn,[r,.75,t+2.62],[.45,.55,.06]),e.box(n.ticketScreen,[r,.95,t+1.2],[.5,.32,.03],{shadow:!1}),e.boxMM(n.boardIn,[r+.35,.72,t+1.2],[r+.75,.8+(r>a+4?.12:.05),t+1.6]);e.boxMM(n.steelIn,[L.xOff-.5,0,t+.2],[L.xOff-.1,2,r-.3],{collide:!0});for(let i=0;i<4;i++)e.boxMM(n.boardIn,[L.xOff-.48,.3+i*.45,t+.4],[L.xOff-.14,.55+i*.45,r-.5]);e.box(n.greenIn,[a+3.8,1.6,t+.08],[2.4,1,.03]),e.box(n.woodIn,[a+3.8,1.08,t+.1],[2.4,.04,.06]),Wt(e,n,`x`,[d,L.xOff],[t+1.25,t+3.85],3);for(let r of[a+2.6,a+5.6])Bt(e,n,i,r,3,t+2.55,`x`,o,1.1);Vt([a,1.5,s+11.6],`z`,3.2,1.2,1,o,.8)}{let c=[d,-.1,s+.1,f,3.1,L.zA-.06];me(e,n.concreteIn,[z.xBot,R.floor,(R.z0+R.z1)/2],`-x`,0-R.floor,R.z1-R.z0);for(let t=0;t<25;t++){let r=z.xBot-t*.28-.03,i=R.floor+(t+1)*(0-R.floor)/25;e.box(n.yellowPaint,[r,i+.003,(R.z0+R.z1)/2],[.05,.006,R.z1-R.z0-.1],{shadow:!1})}for(let r of[R.z0-.15,R.z1+.15]){e.boxMM(n.tileTun,[z.xTop-.15,R.floor,r-.15],[z.xBot,0,r+.15],{collide:!0}),t.colliders.add({x:z.xTop-.15,y:0,z:r-.1},{x:z.xBot,y:1.05,z:r+.1}),e.boxMM(n.wallBaseIn,[z.xTop-.15,0,r-.08],[z.xBot,.15,r+.08],{shadow:!1}),e.boxMM(n.steelIn,[z.xTop-.15,1,r-.04],[z.xBot,1.05,r+.04],{shadow:!1}),e.boxMM(n.steelIn,[z.xTop-.15,.55,r-.015],[z.xBot,.58,r+.015],{shadow:!1});for(let t=z.xTop-.1;t<=z.xBot+.01;t+=.12)e.boxMM(n.steelIn,[t-.012,.15,r-.012],[t+.012,1,r+.012],{shadow:!1})}for(let t of[R.z0+.06,R.z1-.06]){let i=.85,a=R.floor+.85,o=new r(.025,.025,Math.hypot(z.xBot-z.xTop,i-a),8);o.rotateZ(Math.PI/2-Math.atan2(i-a,z.xBot-z.xTop)*-1),e.mesh(o,n.steelIn,[(z.xTop+z.xBot)/2,(i+a)/2,t],{rotZ:0});for(let r=1;r<6;r++){let o=r/6;e.box(n.steelIn,[z.xTop+(z.xBot-z.xTop)*o,i+(a-i)*o-.05,t+(t<1.7?-.03:.03)],[.03,.1,.06],{shadow:!1})}}e.mesh(Z(`under`,[3.2,.36,.05]),n.signUnlit,[z.xTop+2,2.7,R.z1+.4],{shadow:!1,layer:1}),Q(e,n,`posters`,[f-.03,1.05,s+6.5],2.2,.8,`-x`),Q(e,n,`timetable`,[a+1.5,1.35,s+.13],1.1,.9,`z`),Q(e,n,`notice`,[a+9,1.4,L.zA-.08],2.4,.9,`-z`),e.cyl(n.redLit,[f-.3,.3,L.zA-.3],.09,.55,{segments:10}),Wt(e,n,`x`,[d,f],[s+3.4,s+6.6],3);for(let t of[a+3,a+9])Bt(e,n,i,t,3,s+5,`x`,c,1.15);Bt(e,n,i,(z.xTop+z.xBot)/2,3,(R.z0+R.z1)/2,`x`,[z.xTop-.2,R.floor-.1,R.z0-.05,z.xBot+.1,3.1,R.z1+.05],1.3,6),Vt([a,1.3,s+6],`z`,5.2,2.6,1,c,.85,6),Vt([a+7.5,2.1,s],`x`,6,.8,1,c,.6),Vt([o,2.05,s+4.5],`z`,6,.9,-1,c,.6),Ut(e,n,d+.2,s+5.85,a+2.65,s+6.15,0,`start`),Ut(e,n,a+2.35,R.z1+.35,a+2.65,s+6.15,0,`both`)}}function Kt(e,t,n){let{z0:i,z1:a,floor:o,ceil:s,x0:c,x1:l}=R,u=.3,d=(i+a)/2,f=[c-.2,o-.1,i,l+.3,s+.05,a];e.boxMM(t.floorTun,[c-.2,o-.3,i-u],[l+u,o,a+u],{collide:!0}),e.boxMM(t.floorTun,[-B.half-.15,o-.3,a],[B.half+.15,o,B.zBot+1.2],{collide:!0}),e.boxMM(t.tileTun,[c-.2,o,i-u],[l+u,s,i],{collide:!0}),e.boxMM(t.tileTun,[c-.2,o,a],[-B.half-.15,s,a+u],{collide:!0}),e.boxMM(t.tileTun,[l,o,i],[l+u,s,a+u],{collide:!0}),e.boxMM(t.ceilTun,[c-.2,s,i-u],[l+u,s+.3,a],{shadow:!1});let p=-B.half-.15;for(let n of[i+.005,a-.005]){let r=n===a-.005?p:l;e.boxMM(t.trimTun,[c,o+.95,n-.01],[r,o+1.05,n+.01],{shadow:!1});let i=n<d?n+.22:n-.22;e.boxMM(t.blackIn,[c,o+.001,Math.min(n,i)],[r,o+.004,Math.max(n,i)],{shadow:!1});for(let a=c+.05;a<r;a+=.11)e.boxMM(t.steelIn,[a,o+.004,Math.min(n,i)],[a+.03,o+.012,Math.max(n,i)],{shadow:!1})}for(let n of[i+.09,a-.09]){let r=n>d?p-.2:l-.2;e.cyl(t.steelIn,[(c+r)/2,o+.85,n],.022,r-c,{axis:`x`,segments:8,shadow:!1});for(let i=c+.6;i<r;i+=1.8)e.box(t.steelIn,[i,o+.8,n+(n<d?-.04:.04)],[.04,.1,.08],{shadow:!1})}for(let n=l-4;n>c+1;n-=7.5){for(let r of[i+.003,a-.003])(r<d||n<p)&&e.boxMM(t.trimTun,[n-.03,o,r-.004],[n+.03,s,r+.004],{shadow:!1});e.boxMM(t.trimTun,[n-.03,s-.005,i],[n+.03,s,a],{shadow:!1}),e.boxMM(t.trimTun,[n-.03,o,i+.22],[n+.03,o+.003,a-.22],{shadow:!1})}e.boxMM(t.housingIn,[c,s-.28,i+.12],[l,s-.24,i+.52],{shadow:!1});for(let[n,r]of[[.2,.03],[.3,.025],[.42,.035]])e.cyl(t.blackIn,[(c+l)/2,s-.24+r,i+n],r,l-c,{axis:`x`,segments:6,shadow:!1});for(let n=c+.8;n<l;n+=1.6)e.box(t.steelIn,[n,s-.12,i+.5],[.03,.24,.03],{shadow:!1});e.cyl(t.steelIn,[(c+p)/2,s-.12,a-.1],.04,p-c,{axis:`x`,segments:8,shadow:!1});for(let r=l-2;r>c;r-=4)Bt(e,t,n,r,s,d+.15,`z`,f,1.35,3.6);e.boxMM(t.tileTun,[c-.06,s,i],[c+.06,-.04,a],{shadow:!1}),e.mesh(Z(`arrowA`,[2.3,.34,.04]),t.signGlowIn,[c-.09,-.42,d],{rotY:-Math.PI/2,shadow:!1,layer:1}),e.box(t.housingIn,[c-.08,-.42,d],[.04,.42,2.42],{shadow:!1}),e.mesh(Z(`ad`,[1.4,.82,.04]),t.signBright,[c-.09,-1.1,d],{rotY:-Math.PI/2,shadow:!1,layer:1}),e.box(t.housingIn,[c-.08,-1.1,d],[.04,.9,1.5],{shadow:!1}),Bt(e,t,n,c+.6,s,d,`z`,[z.xTop-.2,o-.1,i-.05,c+4,.2,a+.05],1.5,4.5),Ee({kind:0,c:[0,-.5,8],axis:[0,0,1],half:3,radius:7,color:zt(Rt,1.3),box:[-B.half-.2,o-.1,a-.1,B.half+.2,1.5,B.zTop+.1]}),Ee({kind:0,c:[0,-.8,8.5],axis:[0,0,1],half:2.5,radius:9,color:zt(Rt,.7),box:f});for(let n of[-34,-18]){e.mesh(Z(`arrowA`,[1.8,.3,.04]),t.signUnlitTun,[n-.03,s-.25,d],{shadow:!1,rotY:Math.PI/2,layer:1}),e.mesh(Z(`arrowGate`,[1.8,.3,.04]),t.signUnlitTun,[n+.03,s-.25,d],{shadow:!1,rotY:-Math.PI/2,layer:1});for(let r of[-.7,.7])e.box(t.steelIn,[n,s-.05,d+r],[.02,.12,.02])}for(let n of[-38,-26,-10])Q(e,t,`posters`,[n,o+1.6,i+.02],2.2,.8,`z`);for(let n of[-31,-14.5])Q(e,t,`ad`,[n,o+1.55,a-.02],.9,1.2,`-z`,!0);Q(e,t,`map`,[-22,o+1.55,a-.02],1.2,.9,`-z`),Ut(e,t,c+.2,i+.6,-.3,i+.9,o,`both`),Ut(e,t,-.3,i+.9,0,a+.5,o,`end`);let m=B.zTop-25*.28;me(e,t.concreteIn,[0,o,m],`+z`,0-o,B.half*2);for(let n=0;n<25;n++){let r=m+n*.28+.03,i=o+(n+1)*(0-o)/25;e.box(t.yellowPaint,[0,i+.003,r],[B.half*2-.1,.006,.05],{shadow:!1})}for(let n of[-1,1]){let i=n*(B.half-.06),a=m,s=B.zTop,c=o+.85,l=.85,u=Math.hypot(s-a,l-c),d=new r(.025,.025,u,8);d.rotateX(Math.PI/2-Math.atan2(l-c,s-a)),e.mesh(d,t.steelIn,[i,(c+l)/2,(a+s)/2],{shadow:!1})}for(let n of[-1,1]){let r=n*B.half,i=n*(B.half+.15);e.boxMM(t.tileTun,[Math.min(r,i),o,B.zBot],[Math.max(r,i),0,B.zTop],{collide:!0}),e.boxMM(t.coping,[Math.min(r,i),0,B.zBot],[Math.max(r,i),1.05,B.zTop],{collide:!0}),e.boxMM(t.steel,[Math.min(r,i)-.02,1.05,B.zBot],[Math.max(r,i)+.02,1.1,B.zTop])}e.boxMM(t.tileTun,[-B.half-.15,s,B.zBot-.15],[B.half+.15,0,B.zBot],{collide:!0}),e.boxMM(t.coping,[-B.half-.15,0,B.zBot-.15],[B.half+.15,1.05,B.zBot],{collide:!0}),e.mesh(Z(`exit`,[2.2,.36,.05]),t.signUnlit,[0,3.2,B.zTop-.3],{shadow:!1});for(let n of[-1,1])e.box(t.steel,[n*.9,3.85,B.zTop-.3],[.02,.95,.02])}function qt(e,t,n,i,a=[]){let s=e.colliders,c,u=(n,r)=>{ze(e,t,n,e=>{c=e,r()})},d=(e,t,r,i=1,a={})=>{let o=[Math.abs(r[0]-t[0]),Math.abs(r[1]-t[1]),Math.abs(r[2]-t[2])];o[0]<o[2]?c.mesh(Z(e,[o[2],o[1],o[0]]),n.signLit,[(t[0]+r[0])/2,(t[1]+r[1])/2,(t[2]+r[2])/2],{rotY:i*Math.PI/2,...a}):c.mesh(Z(e,o),n.signLit,[(t[0]+r[0])/2,(t[1]+r[1])/2,(t[2]+r[2])/2],a)},f=(e,t,r,i,a,l,u=[!0,!0])=>{let d=O.road-O.ground,f=new x,p=u[0]?a/2+d*2:a/2,m=u[1]?a/2+d*2:a/2;f.moveTo(-p,0),f.lineTo(-a/2,d),f.lineTo(a/2,d),f.lineTo(m,0),f.lineTo(-p,0);let h=new o(f,{depth:r-t,bevelEnabled:!1});e===`x`?(h.rotateY(Math.PI/2),c.mesh(h,n.gravel,[t,O.ground,i])):c.mesh(h,n.gravel,[i,O.ground,t]),e===`x`?c.boxMM(l,[t,O.road-.02,i-a/2+.3],[r,O.road+.005,i+a/2-.3],{shadow:!1}):c.boxMM(l,[i-a/2+.3,O.road-.02,t],[i+a/2-.3,O.road+.005,r],{shadow:!1});let g=(n,a,o)=>{e===`x`?s.add({x:t,y:O.ground,z:i+n},{x:r,y:o,z:i+a}):s.add({x:i+n,y:O.ground,z:t},{x:i+a,y:o,z:r})};g(-a/2,a/2,O.road),u[0]&&g(-a/2-.6,-a/2,O.ground+d/2),u[1]&&g(a/2,a/2+.6,O.ground+d/2)},m=[],h=(e,t,r=O.ground,a=0)=>{let o=9.5;c.cyl(n.poleConc,[e,r+o/2,t],.13,o,{radiusTop:.09,segments:8});let l=Math.cos(a),u=Math.sin(a);for(let[i,a]of[[r+o-.4,1.8],[r+o-1.2,1.4]]){c.box(n.steel,[e,i,t],[a*l+.08*Math.abs(u),.08,a*Math.abs(u)+.08*Math.abs(l)]);for(let r of[-a/2+.1,0,a/2-.1])c.cyl(n.board,[e+r*l,i+.1,t-r*u],.04,.12,{segments:6})}i()<.3&&c.cyl(n.tin,[e+.35*u,r+o-2.6,t+.35*l],.25,.8,{segments:10});for(let i=r+2.5;i<r+o-2;i+=.45)c.box(n.steel,[e,i,t],[.3*Math.abs(u)+.02,.02,.3*Math.abs(l)+.02]);return s.addCentered(e,r+1.5,t,.3,3,.3),[e,r+o-.3,t]},g=(e,t=.35)=>{for(let r=0;r+1<e.length;r++){let i=e[r],a=e[r+1];for(let e of[-.7,0,.7]){let r=a[0]-i[0],o=a[2]-i[2],s=Math.hypot(r,o),u=-o/s,d=r/s,f=new l(i[0]+u*e,i[1],i[2]+d*e),p=new l(a[0]+u*e,a[1],a[2]+d*e),m=f.clone().lerp(p,.5);m.y-=t;let h=new ee(f,m,p);c.mesh(new ce(h,8,.012,3,!1),n.wire,[0,0,0],{shadow:!1})}}};u(!0,()=>{let{x0:e,x1:t,z0:a,z1:o}=V,l=O.road-O.ground;c.boxMM(n.gravel,[e,O.ground,a],[t,O.road-.02,o]),c.boxMM(n.asphalt,[e+4,O.road-.02,a],[t,O.road+.005,o],{shadow:!1}),s.add({x:e,y:O.ground,z:a},{x:t,y:O.road,z:o}),c.boxMM(n.curb,[e,O.road-.02,a],[e+4,O.road+.12,o],{shadow:!1}),s.add({x:e,y:O.road,z:a},{x:e+4,y:O.road+.12,z:o});for(let t=a+.5;t<o;t+=.5)c.box(n.wallBase,[e+2,O.road+.122,t],[3.96,.004,.02],{shadow:!1});for(let[r,i]of[[a-l*2,a],[o,o+l*2]]){let o=new C(t-e,.1,Math.hypot(l,l*2)),s=Math.atan2(l,l*2);c.mesh(o,n.gravel,[(e+t)/2,O.ground+l/2,(r+i)/2],{rotX:r<a?s:-s})}s.add({x:e,y:O.ground,z:o},{x:t,y:O.ground+l/2,z:o+.6}),s.add({x:e,y:O.ground,z:a-.6},{x:t,y:O.ground+l/2,z:a}),c.boxMM(n.concrete,[t,O.ground,a],[t+.25,O.road+.15,o]),Jt(c,n,[t+.12,a],[t+.12,o],O.road+.15,1.6),s.add({x:t,y:O.ground,z:a},{x:t+.25,y:O.road+2.2,z:o});let u=(e,t,r,i)=>{c.boxMM(n.paint,[Math.min(e,r),O.road+.006,Math.min(t,i)],[Math.max(e,r),O.road+.01,Math.max(t,i)],{shadow:!1})};for(let e=2;e<=14;e+=2.5)u(t-5.5,e,t-.5,e+.12);u(t-5.5,2,t-5.38,14.12),u(e+4.4,20,e+4.52,36);for(let t=22;t<36;t+=.8)u(e+4.5,t,e+6.5,t+.08);{let r=(e+t)/2+1;c.boxMM(n.curb,[r-3,O.road,15],[r+3,O.road+.2,21],{collide:!0}),c.boxMM(n.hedge,[r-2.8,O.road+.2,15.2],[r+2.8,O.road+.75,20.8]);for(let e=0;e<9;e++)c.mesh(new p(.45+i()*.25,0),n.hedge,[r-2.2+i()*4.4,O.road+.8,15.8+i()*4.4]);c.cyl(n.steel,[r,O.road+2.2,18],.08,3.6,{segments:8}),c.cyl(n.board,[r,O.road+3.9,18],.35,.12,{axis:`x`,segments:20}),c.cyl(n.board,[r,O.road+3.9,18],.35,.12,{axis:`z`,segments:20}),s.addCentered(r,O.road+1,18,6,2,6)}{let e=t-1.6;c.cyl(n.steel,[e,O.road+1.2,27],.04,2.4,{segments:8});{let t=bt(new r(.32,.32,.04,20),`bus`);t.rotateZ(Math.PI/2),c.mesh(t,n.signLit,[e,O.road+2.35,27])}c.boxMM(n.board,[e-.05,O.road+.9,26.75],[e+.05,O.road+1.8,27.25]),c.boxMM(n.tin,[e-1.2,O.road+2.3,28.4],[e+.6,O.road+2.4,31.8]);for(let t of[-1.4,1.6])c.box(n.steel,[e-1,O.road+1.15,30+t],[.08,2.3,.08]);c.boxMM(n.glass,[e-1.2,O.road+.3,28.4],[e-1.15,O.road+2.3,31.8],{shadow:!1}),s.add({x:e-1.25,y:O.road,z:28.4},{x:e-1.1,y:O.road+2.3,z:31.8}),$e(c,n.benchT,n.steel,[e-.6,O.road,30.1],-Math.PI/2,4,.55),s.add({x:e-.9,y:O.road,z:28.9},{x:e-.3,y:O.road+.9,z:31.3})}c.cyl(n.steel,[t-6,O.road+1.2,14.6],.04,2.4,{segments:8}),c.boxMM(n.yellow,[t-6.04,O.road+2,14.3],[t-5.96,O.road+2.5,14.9]);{let t=V.z0+.8,r=e+6,a=e+18;c.boxMM(n.tin,[r,O.road+2.3,t],[a,O.road+2.38,t+3.2]);for(let e=r+.2;e<a;e+=3.9)for(let r of[t+.15,t+3])c.box(n.steel,[e,O.road+1.15,r],[.08,2.3,.08],{collide:!0});c.boxMM(n.steel,[r,O.road+.3,t+.6],[a,O.road+.36,t+.66]);for(let e=r+.6;e<a-.3;e+=.6)i()<.45&&Yt(c,n,[e,O.road,t+1.5],Math.PI/2+(i()-.5)*.15,i),c.box(n.steel,[e,O.road+.2,t+.63],[.03,.4,.03]);s.add({x:r,y:O.road,z:t+.5},{x:a,y:O.road+1,z:t+2.4})}{let r=e+5.2;c.boxMM(n.sash,[r-.5,O.road,27],[r+.5,O.road+.15,28]),c.boxMM(n.glass,[r-.48,O.road+.15,27.02],[r+.48,O.road+2.2,27.98],{collide:!0}),c.boxMM(n.sash,[r-.52,O.road+2.2,26.98],[r+.52,O.road+2.42,28.02]),c.boxMM(n.green,[r-.2,O.road+.95,27.8],[r+.2,O.road+1.5,27.97]),c.box(n.signWhite,[r,O.road+2.31,26.97],[.7,.14,.02]),c.cyl(n.red,[e+3.2,O.road+.75,26],.22,1.25,{segments:14,collide:!0}),c.cyl(n.red,[e+3.2,O.road+1.4,26],.25,.06,{segments:14});for(let t of[12,13])c.boxMM(n.vending,[e+.15,O.road+.12,t-.45],[e+.95,O.road+1.95,t+.45],{collide:!0}),c.box(n.vendingLit,[e+.96,O.road+1.35,t],[.02,.6,.7],{shadow:!1});d(`map`,[e+3.6,O.road+.9,8],[e+3.68,O.road+2,9.6]);for(let t of[8.2,9.4])c.box(n.steel,[e+3.64,O.road+.45,t],[.06,.9,.06]);for(let[r,i]of[[e+4.2,2],[t-2,4],[t-2,22],[e+4.2,34]])Xt(c,n,r,O.road+.12,i)}$t(c,n,[t-3,O.road,8.5],Math.PI/2),s.addCentered(t-3,O.road+.8,8.5,1.6,1.6,3.5);for(let t=0;t<5;t++)u(e+4.2,16.2+t*.9,e+9.8,16.65+t*.9);u(e+4.2,V.z0+2.2,t-.4,V.z0+2.5);for(let t of[5,26]){u(e+13.6,t,e+13.75,t+2.4);for(let r of[-1,1])c.box(n.paint,[e+13.67+r*.22,O.road+.008,t+2.25],[.08,.004,.6],{rotY:r*.6,shadow:!1})}for(let[t,r]of[[e+7,6],[e+15,28],[e+20,12.5],[e+11,33]])c.cyl(n.steel,[t,O.road+.004,r],.36,.012,{segments:18,shadow:!1}),c.cyl(n.black,[t,O.road+.009,r],.31,.012,{segments:18,shadow:!1});for(let t=a+2.5;t<o-1;t+=5){c.boxMM(n.black,[e+4.05,O.road+.004,t-.3],[e+4.45,O.road+.012,t+.3],{shadow:!1});for(let r=0;r<5;r++)c.box(n.steel,[e+4.25,O.road+.014,t-.24+r*.12],[.36,.006,.03],{shadow:!1})}$t(c,n,[e+5.6,O.road,9.6],0,n.roofT),$t(c,n,[e+5.6,O.road,13.9],0);for(let t of[9.6,13.9])s.addCentered(e+5.6,O.road+.8,t,1.6,1.6,3.5);for(let t=13.8;t<=23.9;t+=1.4)c.cyl(n.steel,[e+3.75,O.road+.52,t],.05,.8,{segments:8,collide:!0}),c.cyl(n.signWhite,[e+3.75,O.road+.82,t],.052,.08,{segments:8,shadow:!1});{let t=de(311);for(let r of[4,31.5])c.boxMM(n.black,[e+2.2,O.road+.12,r-.6],[e+3.4,O.road+.13,r+.6],{shadow:!1}),tn(c,n,e+2.8,r,4.2,t,O.road+.12),s.addCentered(e+2.8,O.road+1,r,.4,2,.4)}}),u(!0,()=>{let e=(H.z0+H.z1)/2,t=H.z1-H.z0,r=A.t0;f(`x`,V.x0-.5,r+6.5,e,t,n.asphalt,[!0,!0]),f(`x`,G.x0-30,r-6.5,e,t,n.asphalt,[!0,!0]);for(let e of[-1,1]){let t=r+e*6.5,i=r+e*2.2;for(let e=0;e<4;e++){let r=e/4,a=(e+1)/4,o=O.road+(O.rail-O.road)*((e+1)/4),s=t+(i-t)*r,l=t+(i-t)*a;c.boxMM(n.asphalt,[Math.min(s,l),O.ground,H.z0],[Math.max(s,l),o,H.z1],{collide:!0})}}c.boxMM(n.asphalt,[r-2.2,O.ground,H.z0],[r+2.2,O.rail-.01,H.z1],{collide:!0}),c.boxMM(n.black,[r-.62,O.rail-.012,H.z0],[r+.62,O.rail+.002,H.z1],{shadow:!1});for(let e of[-1,1])c.boxMM(n.black,[r+e*.6-.35,O.rail-.012,H.z0],[r+e*.6+.35,O.rail+.002,H.z1],{shadow:!1});for(let e of[-1,1]){let t=r+e*3.2,i=e<0?H.z1+.6:H.z0-.6;Zt(c,n,t,i,e),s.addCentered(t,O.road+1.5,i,.4,3,.4)}for(let e of[-1,1]){let t=r+e*9,i=e<0?H.z1+.5:H.z0-.5;c.cyl(n.steel,[t,O.road+1.1,i],.04,2.2,{segments:8}),d(`warn`,[t-.03,O.road+1.6,i-.45],[t+.03,O.road+2.2,i+.45],e<0?-1:1)}for(let e of[H.z0+.45,H.z1-.45])for(let[t,i]of[[G.x0-30,r-7],[r+7,V.x0-.5]])c.boxMM(n.paint,[t,O.road+.006,e-.07],[i,O.road+.012,e+.07],{shadow:!1});{let t=G.x0+1.5;for(let r of[-1.5,0,1.5]){c.boxMM(n.signWhite,[t-.05,O.road+.5,e+r-.6],[t+.05,O.road+.7,e+r+.6]),c.boxMM(n.red,[t-.06,O.road+.55,e+r-.3],[t+.06,O.road+.65,e+r+.3]);for(let i of[-.5,.5])T(c,n.steel,[t-.4,O.road,e+r+i],[t,O.road+.75,e+r+i],.04,.04)}d(`closed`,[t+.1,O.road+1,e-1.4],[t+.14,O.road+1.5,e+1.4]),c.cyl(n.redLit,[t,O.road+.85,e+2.3],.08,.16,{segments:10})}let i=[];for(let e=G.x0+6;e<V.x0-2;e+=26)i.push(h(e,H.z1+1.6,O.ground,0));i.push(h(V.x0+1,V.z0+.6,O.road,0)),m.push(i)}),u(!0,()=>{let e=[m[0][m[0].length-1]];for(let t of[10,34])e.push(h(V.x1-.8,t,O.road,Math.PI/2));e.push(h(U.x0-1.4,46,O.ground,Math.PI/2)),m.push(e)}),u(!0,()=>{for(let e of m)g(e)}),u(!0,()=>{let e=(U.x0+U.x1)/2;f(`z`,V.z1,U.z1+1.5,e,U.x1-U.x0,n.asphalt);for(let t of[-1.2,0,1.2])c.box(n.steel,[e+t,O.road+.4,U.z1+1.2],[.1,.8,.1],{collide:!0});c.boxMM(n.signWhite,[e-1.6,O.road+.6,U.z1+1.15],[e+1.6,O.road+.75,U.z1+1.25]);for(let t=e-1.5;t<e+1.5;t+=.6)c.boxMM(n.red,[t,O.road+.6,U.z1+1.14],[t+.3,O.road+.75,U.z1+1.26]);s.add({x:U.x0,y:O.road,z:U.z1+1.1},{x:U.x1,y:O.road+2,z:U.z1+1.3});let t=U.x1-.1;for(let e=49.6;e<=53.3;e+=1.2)c.box(n.steel,[t,O.road+.5,e],[.06,1,.06]);for(let e of[.45,.95])c.boxMM(n.fence,[t-.03,O.road+e-.03,49.6],[t+.03,O.road+e+.03,53.3]);s.add({x:t-.1,y:O.road,z:49.4},{x:t+.1,y:O.road+2,z:53.4}),d(`deadend`,[t-.6,O.road+.15,50.6],[t-.56,O.road+.55,52.4],-1);for(let e=V.z1+.5;e<49.4;e+=2)c.box(n.steel,[t,O.road+.35,e],[.08,.7,.08]);c.boxMM(n.signWhite,[t-.02,O.road+.5,V.z1+.5],[t+.02,O.road+.8,49.4]),s.add({x:t-.1,y:O.road,z:V.z1},{x:t+.1,y:O.road+2,z:49.4})}),u(!1,()=>{for(let[e,t]of[[k.z0,-1],[k.z1,1]]){let r=(O.top-O.ground)*8;for(let i=0;i<8;i++){let a=e+i*r*t/8,o=e+t*((i+1)*r)/8,s=O.top-(i+1)*(O.top-O.ground)/8;c.boxMM(n.concrete,[-1,O.ground,Math.min(a,o)],[1,s,Math.max(a,o)],{collide:!0})}for(let i of[-1,1])Jt(c,n,[i*1.1,e],[i*k.half,e],0,1.2),s.add({x:Math.min(i*1.1,i*k.half),y:0,z:e-.05},{x:Math.max(i*1.1,i*k.half),y:2,z:e+.05}),c.boxMM(n.steel,[i*1.05-.03,O.ground+.9,Math.min(e,e+t*r)],[i*1.05+.03,1,Math.max(e,e+t*r)]);c.boxMM(n.signWhite,[-1,1.25,e-.02],[1,1.55,e+.02]),c.boxMM(n.fence,[.95,.05,e+t*.1],[1,1.15,e+t*1])}{let e=F.x+F.half;Jt(c,n,[e-.1,I.z1],[e-.1,F.z1-.4],0,1.2),s.add({x:e-.2,y:0,z:I.z1},{x:e,y:2,z:F.z1-.4}),Jt(c,n,[F.x-F.half+1.6,F.z0+.1],[e,F.z0+.1],0,1.2),s.add({x:F.x-F.half+1.5,y:0,z:F.z0},{x:e,y:2,z:F.z0+.2}),c.boxMM(n.signWhite,[F.x-1.2,1.25,F.z0+.06],[F.x+1.2,1.55,F.z0+.14])}{for(let e of[-1,1]){let t=e*2.35;c.mesh(Z(`ekimei`,[1.9,.63,.02]),n.signGlow,[t+e*.012,2.55,1.1],{rotY:e*Math.PI/2}),c.mesh(Z(`ekimei`,[1.9,.63,.02]),n.signGlow,[t-e*.012,2.55,1.1],{rotY:-e*Math.PI/2}),c.boxMM(n.housing,[t-.06,2.2,.1],[t+.06,2.24,2.1]),c.boxMM(n.housing,[t-.06,2.86,.1],[t+.06,2.9,2.1]);for(let e of[.4,1.8])c.box(n.steel,[t,3.7,e],[.02,1.6,.02])}let e=F.x-4.2;c.mesh(Z(`ekimei`,[1.9,.63,.04]),n.signLit,[e,1.75,16],{rotY:-Math.PI/2}),c.mesh(Z(`ekimei`,[1.9,.63,.04]),n.signLit,[e+.05,1.75,16],{rotY:Math.PI/2});for(let t of[15.15,16.85])c.box(n.steel,[e+.025,.85,t],[.06,1.7,.06],{collide:!0});c.boxMM(n.steel,[e-.03,2.06,15],[e+.08,2.1,17]);for(let e of[-1,1]){let t=e*1.37;c.mesh(Z(`timetable`,[1.1,.8,.02]),n.signLit,[t,.6,7.2],{rotY:e*Math.PI/2}),c.mesh(Z(`posters`,[1.4,.7,.02]),n.signLit,[t,.6,9.5],{rotY:e*Math.PI/2})}c.mesh(Z(`notice`,[3,1,.03]),n.signLit,[I.x0-.12,1.6,23.6],{rotY:-Math.PI/2}),c.mesh(Z(`timetable`,[1.3,1,.03]),n.signLit,[I.x0-.12,1.6,1.8],{rotY:-Math.PI/2}),c.boxMM(n.wood,[I.x0-.1,1.05,21.95],[I.x0,2.15,25.25])}}),u(!1,()=>{c.boxMM(n.wallExt,[-15,O.ground,19.5],[-12.2,O.ground+2.6,24],{collide:!0}),c.boxMM(n.roofTile,[-15.2,O.ground+2.6,19.3],[-12,O.ground+2.8,24.2]),c.box(n.doorLeaf,[-12.18,O.ground+1,22.6],[.04,2,.9]),c.box(n.steel,[-12.15,O.ground+2.2,20.5],[.1,.3,.4]),c.boxMM(n.curb,[-8.2,O.ground,-12],[-7.8,O.ground+.18,42])}),u(!0,()=>{let{x0:e,x1:t,z0:r,z1:o}=W;c.boxMM(n.concreteW,[e,O.ground,r],[t,-.16,o]),c.boxMM(n.coping,[e,-.16,r],[t,0,o]),s.add({x:e,y:O.ground,z:r},{x:t,y:0,z:o});let l=e,u=e+8,f=r+4,p=o-4;c.boxMM(n.tin,[l,0,f],[u,4.2,p],{collide:!0});for(let e=f+.15;e<p;e+=.3)c.box(n.wallBase,[u+.01,2.1,e],[.02,4.2,.04],{shadow:!1});for(let e of[-1,1]){let t=4.6,r=Math.atan2(1.3999999999999995,t);c.box(n.rust,[(l+u)/2+e*t/2,4.95,(f+p)/2],[Math.hypot(t,1.3999999999999995),.1,p-f+.6],{rotZ:-e*r})}for(let e of[f+4,p-4])c.box(n.doorLeaf,[u+.05,1.5,e],[.06,3,3]),c.box(n.steel,[u+.08,3.05,e],[.08,.08,3.4]);d(`ja`,[u+.06,3.4,(f+p)/2-2.6],[u+.1,3.95,(f+p)/2+2.6]),c.box(n.doorLeaf,[l-.03,1,(f+p)/2+3],[.05,2,.9]);for(let e of[-6,-2,2,6])c.box(n.glass,[l-.03,3.2,(f+p)/2+e],[.04,.5,1.2],{shadow:!1});for(let e of[f-.03,p+.03])c.box(n.wallBase,[(l+u)/2,4.7,e],[1,.5,.04]);for(let e=f+2;e<p;e+=4)c.box(n.rust,[l-.04,2,e],[.02,4,.25],{shadow:!1});c.boxMM(n.tin,[u,3.4,f],[t+.6,3.5,p]);for(let e=f+1;e<p;e+=4.5)T(c,n.steel,[u,2.6,e],[t+.3,3.4,e],.08,.08);for(let e=0;e<6;e++){let e=r+2+i()*(o-r-4),t=u+.8+i()*1.6;c.boxMM(n.wood,[t-.55,0,e-.55],[t+.55,.14,e+.55]),i()<.6&&c.boxMM(n.signWhite,[t-.45,.14,e-.45],[t+.45,.14+.25*(1+Math.floor(i()*3)),e+.45])}for(let r=0;r<4;r++){let i=0-(r+1)*((0-O.road)/4);c.boxMM(n.concrete,[e+9,O.ground,o+r*.6],[t,i,o+(r+1)*.6],{collide:!0})}{let e=Re(c,n,a);for(let t of[f+3,(f+p)/2,p-3])c.box(n.housing,[u+1.9,3.36,t],[.3,.06,1.3],{shadow:!1}),e([u+1.9,3.3,t],1.1,`z`,.06,.04,!0);c.box(n.black,[u+.03,1.45,p-1.8],[.02,2.9,1.3],{shadow:!1}),c.boxMM(n.steel,[u+.02,0,f+.5],[u+.12,.06,p-.5],{shadow:!1});for(let e of[l-.12,u+.12])c.boxMM(n.steel,[e-.07,4.05,f-.3],[e+.07,4.17,p+.3],{shadow:!1});for(let[e,t]of[[l-.12,f-.2],[l-.12,p+.2],[u+.12,f-.2]])c.cyl(n.steel,[e,2.05,t],.05,4.1,{segments:8});for(let e=0;e<5;e++){let t=f-2.2+e%3*.62,r=u+2.6+Math.floor(e/3)*.62;c.cyl(e%2?n.roofT:n.rust,[r,.44,t],.29,.88,{segments:14,collide:!0}),c.cyl(n.black,[r,.885,t],.27,.01,{segments:14,shadow:!1})}}en(c,n,[e-3,O.ground,o-6],.1),s.addCentered(e-3,O.ground+.9,o-6,1.6,1.8,3.6)}),u(!0,()=>{f(`z`,H.z1+.6,80,-96,3,n.gravel),f(`x`,G.x0-10,-97.5,81.5,3,n.gravel),Qt(c,n,[-91,O.ground,22],0,i),Qt(c,n,[-90.5,O.ground,62],Math.PI/2,i),s.addCentered(-91,O.ground+1.5,22,4.4,3,6.4),s.addCentered(-90.5,O.ground+1.5,62,6.4,3,4.4);let e=[];for(let t=H.z1+8;t<80;t+=28)e.push(h(-93.6,t,O.ground,Math.PI/2));g([m[0][0],...e]),f(`z`,G.z0-10,H.z0-.6,-94,3,n.gravel),Qt(c,n,[-89,O.ground,-62],Math.PI/2,i),s.addCentered(-89,O.ground+1.5,-62,6.4,3,4.4),f(`z`,-28,14,30,3,n.gravel),Qt(c,n,[35.5,O.ground,-20],0,i),s.addCentered(35.5,O.ground+1.5,-20,4.4,3,6.4);let t=[];for(let e of[-24,4])t.push(h(27.8,e,O.ground,Math.PI/2));g(t);for(let e=0;e<7;e++)tn(c,n,-98.6+e%2*1.3,8+e*10+i()*3,7+i()*4,i);tn(c,n,35.5,-6,8,i),tn(c,n,38,9,6.5,i),tn(c,n,V.x1-2.5,V.z0+2.5,7.5,i);for(let[e,t]of[[-98.6,8],[35.5,-6],[38,9]])s.addCentered(e,O.ground+1,t,.5,2,.5);nn(c,n,-92,46),s.addCentered(-92,O.ground+.8,46.8,1.6,1.6,1.6);for(let[e,t]of[[-84,36],[-82,39],[33,-6],[36,8]])c.cyl(n.signWhite,[e,O.ground+.6,t],.6,1.1,{axis:`x`,segments:16}),s.addCentered(e,O.ground+.6,t,1.2,1.2,1.2)}),u(!0,()=>{let e=O.ground,t=(t,r,i,a)=>{(Math.abs(i-t)>Math.abs(a-r)?`x`:`z`)==`x`?(c.boxMM(n.curb,[t,e-.02,r-.75],[i,e+.08,r-.6]),c.boxMM(n.curb,[t,e-.02,r+.6],[i,e+.08,r+.75]),c.boxMM(n.water,[t,e-.3,r-.6],[i,e-.25,r+.6],{shadow:!1}),s.add({x:t,y:e-1,z:r-.3},{x:i,y:e+3,z:r+.3})):(c.boxMM(n.curb,[t-.75,e-.02,r],[t-.6,e+.08,a]),c.boxMM(n.curb,[t+.6,e-.02,r],[t+.75,e+.08,a]),c.boxMM(n.water,[t-.6,e-.3,r],[t+.6,e-.25,a],{shadow:!1}),s.add({x:t-.3,y:e-1,z:r},{x:t+.3,y:e+3,z:a}))};t(G.x0,G.z0,G.x1,G.z0),t(G.x0,G.z1,G.x1,G.z1),t(G.x0,G.z0,G.x0,G.z1),t(G.x1,G.z0,G.x1,G.z1)}),u(!0,()=>{let e=[],t=ye(7,5),r=[[-16.5,-200,16.5,200],[V.x0-1,V.z0-1.5,V.x1+1,V.z1+1.5],[I.x0-.5,I.z0-.5,I.x1,I.z1+.5],[F.x-F.half-3.8,F.z0-1,F.x+F.half,F.z1+1],[-200,H.z0-2,V.x0,H.z1+2],[U.x0-1.5,V.z1,U.x1+1.5,U.z1+2],[A.t7-2.5,-200,A.t0+2.5,200],[W.x0-6,W.z0-2,W.x1,W.z1+4],[-98,-200,-92,200],[-200,79.5,-94,83.5],[28,-30,32,16]],a=(e,t)=>r.some(n=>e>n[0]&&e<n[2]&&t>n[1]&&t<n[3]);for(let t=0;t<9e3;t++){let t=G.x0+1+i()*(G.x1-G.x0-2),n=G.z0+1+i()*(G.z1-G.z0-2);if(a(t,n))continue;let r=.5+.5*Math.sin(t*.21+Math.cos(n*.17)*2)*Math.cos(n*.13-t*.05);if(i()>.35+r*.65)continue;let o=.18+i()*.25+r*.3;e.push(D(t,O.ground,n,i()*6.28,o*(.8+i()*.6),o,o*(.8+i()*.6)))}E(c.root,t,n.grass,e)})}function Jt(e,t,n,r,i,a){let o=r[0]-n[0],s=r[1]-n[1],c=Math.hypot(o,s);if(c<.05)return;let l=Math.max(1,Math.round(c/2.4));for(let r=0;r<=l;r++){let c=r/l;e.box(t.fence,[n[0]+o*c,i+a/2,n[1]+s*c],[.05,a,.05])}let u=Math.abs(o)>Math.abs(s);for(let o of[i+.1,i+a-.03])u?e.boxMM(t.fence,[Math.min(n[0],r[0]),o-.02,n[1]-.02],[Math.max(n[0],r[0]),o+.02,n[1]+.02]):e.boxMM(t.fence,[n[0]-.02,o-.02,Math.min(n[1],r[1])],[n[0]+.02,o+.02,Math.max(n[1],r[1])]);for(let r=.15;r<c;r+=.3){let l=n[0]+o*r/c,u=n[1]+s*r/c;e.box(t.fence,[l,i+a/2,u],[.01,a-.15,.01],{shadow:!1})}}function Yt(e,t,n,r,a){let o=Math.cos(r),s=Math.sin(r),c=(e,t)=>[n[0]+e*s,n[1]+t,n[2]+e*o],l=a()<.5?t.steel:t.red;for(let n of[-.52,.52]){let a=new i(.33,.02,4,16);a.rotateY(r+Math.PI/2),e.mesh(a,t.black,c(n,.34),{shadow:!1})}T(e,l,c(-.52,.34),c(0,.36),.03,.03),T(e,l,c(0,.36),c(.45,.82),.03,.03),T(e,l,c(-.52,.34),c(-.12,.78),.03,.03),T(e,l,c(-.12,.78),c(.42,.8),.03,.03),T(e,l,c(.52,.34),c(.45,.82),.03,.03),e.box(t.black,c(-.14,.86),[.12,.05,.12],{shadow:!1});let u=c(.44,.92);e.box(t.steel,u,[.5*Math.abs(o)+.03,.03,.5*Math.abs(s)+.03],{shadow:!1})}function Xt(e,t,n,r,i){e.cyl(t.steel,[n,r+2.8,i],.07,5.6,{segments:8,collide:!0}),T(e,t.steel,[n,r+5.5,i],[n+.9,r+5.7,i],.06,.06),e.box(t.housing,[n+1,r+5.6,i],[.5,.12,.25]),e.box(t.lampBox,[n+1,r+5.53,i],[.4,.02,.18],{shadow:!1})}function Zt(e,t,n,r,i){let a=O.road;e.cyl(t.signWhite,[n,a+1.6,r],.07,3.2,{segments:10});for(let i=0;i<6;i++)e.cyl(t.black,[n,a+.3+i*.5,r],.072,.25,{segments:10});for(let o of[.6,-.6])e.box(t.yellow,[n-i*.05,a+3,r],[.04,.16,1.1],{rotX:o}),e.box(t.black,[n-i*.06,a+3,r],[.03,.05,1.12],{rotX:o});for(let o of[-.32,.32])e.cyl(t.red,[n-i*.1,a+2.4,r+o],.13,.08,{axis:`x`,segments:14}),e.box(t.black,[n-i*.14,a+2.52,r+o],[.16,.04,.3]);e.box(t.black,[n-i*.02,a+2.4,r],[.06,.12,.9]),e.box(t.black,[n-i*.1,a+1.95,r],[.12,.22,.5]),e.cyl(t.steel,[n,a+3.35,r],.12,.12,{segments:10});let o=n+i*.5;e.box(t.yellow,[o,a+.55,r],[.4,1.1,.4]),e.box(t.black,[o,a+1.12,r],[.42,.06,.42]);for(let n=0;n<8;n++)e.box(n%2?t.black:t.yellow,[o,a+1.2+n*.45+.22,r],[.08,.45,.08])}function Qt(e,t,n,r,i){let a=Math.cos(r),o=Math.sin(r),s=(e,t,r)=>[n[0]+e*a+r*o,n[1]+t,n[2]-e*o+r*a],c=new C(4,2.6,6);e.mesh(c,i()<.5?t.wood:t.tin,s(0,1.3,0),{rotY:r}),e.mesh(new C(4.6,.1,6.6),t.rust,s(0,2.85,0),{rotY:r,rotZ:.12}),e.mesh(new C(.05,2,1.6),t.black,s(2.01,1,1),{rotY:r});for(let n=-2.7;n<3;n+=.4)e.mesh(new C(.02,2.6,.03),t.wallBase,s(2.01,1.3,n),{rotY:r,shadow:!1})}function $t(e,t,n,i,a=t.signWhite){let o=3.4;e.mesh(new C(1.45,.75,o),a,[n[0],n[1]+.55,n[2]],{rotY:i}),e.mesh(new C(1.35,.6,o*.55),t.glass,[n[0]-Math.sin(i)*.25,n[1]+1.2,n[2]-Math.cos(i)*.25],{rotY:i}),e.mesh(new C(1.4,.06,o*.56),a,[n[0]-Math.sin(i)*.25,n[1]+1.52,n[2]-Math.cos(i)*.25],{rotY:i});for(let a of[-1.1,1.1])for(let o of[-.65,.65]){let s=new r(.27,.27,.18,12);s.rotateZ(Math.PI/2),s.rotateY(i),e.mesh(s,t.black,[n[0]+Math.sin(i)*a+Math.cos(i)*o,n[1]+.27,n[2]+Math.cos(i)*a-Math.sin(i)*o])}}function en(e,t,n,i){let a=Math.sin(i),o=Math.cos(i);e.mesh(new C(1.45,.5,3.3),t.signWhite,[n[0],n[1]+.6,n[2]],{rotY:i}),e.mesh(new C(1.4,.9,1.1),t.signWhite,[n[0]+a*1.05,n[1]+1.25,n[2]+o*1.05],{rotY:i}),e.mesh(new C(1.3,.5,.05),t.glass,[n[0]+a*1.61,n[1]+1.35,n[2]+o*1.61],{rotY:i});for(let[s,c]of[[1,.65],[1,-.65],[-1,.65],[-1,-.65]]){let l=new r(.27,.27,.18,12);l.rotateZ(Math.PI/2),l.rotateY(i),e.mesh(l,t.black,[n[0]+a*s+o*c,n[1]+.27,n[2]+o*s-a*c])}e.mesh(new C(1.4,.4,2),t.tin,[n[0]-a*.55,n[1]+1.05,n[2]-o*.55],{rotY:i})}function tn(e,t,n,r,i,a,o=O.ground){let s=[n,o,r],c=[n+(a()-.5)*.4,o+i*.45,r+(a()-.5)*.4];T(e,t.wood,s,c,i/8*.22,i/8*.22);let u=(n,r,i,o,s)=>{let c=[n[0]+r.x*i,n[1]+r.y*i,n[2]+r.z*i];if(T(e,t.wood,n,c,o,o,{shadow:!1}),s<=0||o<.02)return;let d=s>2?3:2;for(let e=0;e<d;e++){let e=r.clone().add(new l((a()-.5)*1.2,.25+a()*.5,(a()-.5)*1.2)).normalize();u(c,e,i*(.6+a()*.2),o*.62,s-1)}};for(let e=0;e<4;e++){let t=e/4*Math.PI*2+a();u(c,new l(Math.cos(t)*.6,.8,Math.sin(t)*.6).normalize(),i*.22,i/8*.12,3)}}function nn(e,t,n,r){let i=O.ground;e.boxMM(t.curb,[n-.7,i,r+.1],[n+.7,i+.5,r+1.5]),e.boxMM(t.wood,[n-.4,i+.5,r+.4],[n+.4,i+1.2,r+1.2]);for(let a of[-1,1])e.box(t.roofTile,[n+a*.3,i+1.38,r+.8],[.75,.06,1.2],{rotZ:-a*.55});e.box(t.red,[n,i+.85,r+.39],[.5,.5,.02]);for(let a of[-1,1])e.cyl(t.red,[n+a*.55,i+.9,r-.6],.05,1.8,{segments:8});e.box(t.red,[n,i+1.85,r-.6],[1.6,.1,.14]),e.box(t.black,[n,i+1.93,r-.6],[1.75,.05,.16]),e.box(t.red,[n,i+1.55,r-.6],[1.25,.07,.08])}var rn=[{x:-62,z:29.3,fx:0,fz:1,k:.44},{x:0,z:0,fx:0,fz:-1,k:.9},{x:-23.7,z:51.4,fx:1,fz:0,k:.52},{x:0,z:12,fx:0,fz:1,k:.52}];function $(e,t,n=.5,r=1.5){for(let i of rn){let a=e-i.x,o=t-i.z,s=a*i.fx+o*i.fz;if(!(s<-n)&&Math.abs(a*-i.fz+o*i.fx)-n-r<Math.max(s,0)*i.k)return!0}return!1}function an(e,t,n){let r=de(907),i=sn(e,t,n,r),a=[...cn(e,t,n,r),...ln(e,t,n,r)];fn(e,t,n,r);let o=a.map(e=>{let t=e;return t.geometry?.computeBoundingSphere(),t.geometry?.boundingSphere??new g(new l,1e5)});return e=>{for(let t of i){let n=e.y>t.top+.3&&e.x>t.rect[0]&&e.x<t.rect[2]&&e.z>t.rect[1]&&e.z<t.rect[3];for(let e of t.objs)e.visible=!n}a.forEach((t,n)=>{t.visible=o[n].center.distanceTo(e)-o[n].radius<110})}}function on(e,t=2){let n=ue(new p(1,t)),r=n.getAttribute(`position`),i=de(e),a=[i()*6.28,i()*6.28,i()*6.28],o=new Float32Array(r.count*3);for(let e=0;e<r.count;e++){let t=r.getX(e),n=r.getY(e),i=r.getZ(e),s=.86+.12*Math.sin(t*3.1+a[0])*Math.cos(i*2.7+a[1])+.08*Math.sin(n*4.3+t*2+a[2]),c=(Math.max(n,-.4)+.4)*.64*s;r.setXYZ(e,t*s,c,i*s);let l=Math.min(Math.max(c/.85,0),1),u=.5+.85*l*l*(3-2*l);o.set([u*.96,u,u*.98],e*3)}n.setAttribute(`color`,new _(o,3)),n.computeVertexNormals();let s=n.getAttribute(`normal`);for(let e=0;e<s.count;e++)s.setXYZ(e,s.getX(e)*.45,s.getY(e)*.45+.6,s.getZ(e)*.45);return n}function sn(e,t,n,r){let i=[{x:-k.half+.12,s:-1,z0:k.z0+1,z1:k.z1-1,skip:[[38,66]],p:0},{x:k.half-.12,s:1,z0:k.z0+1,z1:k.z1-1,skip:[[38,66]],p:0},{x:F.x-F.half+.12,s:-1,z0:F.z0+1,z1:F.z1-1,skip:[],p:1},{x:W.x1,s:1,z0:W.z0+1,z1:W.z1-1,skip:[],p:2}],a=[{objs:[],rect:[-k.half,k.z0,k.half,k.z1],top:O.top},{objs:[],rect:[F.x-F.half,F.z0,F.x+F.half,F.z1],top:O.top},{objs:[],rect:[W.x0,W.z0,W.x1,W.z1],top:O.top}];for(let o of[0,1,2])a[o].objs=Ke(e,t,90,e=>{for(let t of i.filter(e=>e.p===o))for(let i=t.z0;i<t.z1;i+=30){let a=Math.min(i+30,t.z1);{let o=e=>!t.skip.some(([t,n])=>e>t&&e<n),s=t.x+t.s*.01,c=[],l=[],u=i;for(let e=i;e<=a;e+=.5)o(e)||(e-u>1&&l.push([u,e-.5]),u=e+.5);a-u>1&&l.push([u,a]);for(let[r,i]of l){e.cyl(n.black,[s+t.s*.05,-.42,(r+i)/2],.035,i-r,{axis:`z`,segments:6,shadow:!1});for(let a=r+.4;a<i;a+=2)e.box(n.steel,[s+t.s*.03,-.42,a],[.06,.1,.04],{shadow:!1})}for(let c=Math.ceil(i/6)*6+2;c<a;c+=6)o(c)&&(e.cyl(n.black,[s+t.s*.08,-.25,c],.045,.16,{axis:`x`,segments:8,shadow:!1}),e.box(n.concreteDark,[s+t.s*.004,-.75,c],[.01,.95,.14+r()*.1],{shadow:!1}));for(let r=Math.ceil((i-5)/12)*12+5;r<a-1;r+=12)if(o(r)&&o(r-1)&&o(r+1)){e.box(n.black,[s+t.s*.003,-.72,r],[.02,.72,1.6],{shadow:!1}),e.box(n.coping,[s+t.s*.03,-.34,r],[.06,.06,1.75],{shadow:!1});for(let i=0;i<6;i++)e.box(i%2?n.black:n.yellow,[s+t.s*.065,-.24,r-.5+i*.2],[.01,.1,.2],{shadow:!1})}for(let r=Math.ceil(i/20)*20+9;r<a;r+=20)o(r)&&(e.box(n.signWhite,[s+t.s*.012,-.58,r],[.02,.22,.32],{shadow:!1}),e.box(n.roofT,[s+t.s*.024,-.5,r],[.01,.06,.32],{shadow:!1}));for(let e=i;e<a;e+=.35){if(!o(e))continue;let n=.5+.5*Math.sin(e*.37+t.x);if(r()>.25+n*.6)continue;let i=.18+r()*.3+n*.15;c.push(D(s+t.s*(.1+r()*.35),O.ground,e+(r()-.5)*.3,r()*6.28,i,i,i))}c.length&&E(e.root,ye(7,11),n.grass,c)}}});return a}function cn(e,t,n,r){let i=[{x:A.t0,z0:G.z0+2,z1:44,trough:-1},{x:A.t7,z0:-14,z1:60,trough:0},{x:A.t1,z0:-100,z1:42,trough:-1},{x:A.t2,z0:-100,z1:42,trough:1},{x:A.t3,z0:46,z1:104,trough:-1},{x:A.t6,z0:46,z1:104,trough:1},{x:A.t4,z0:58,z1:104,trough:0},{x:A.t5,z0:58,z1:104,trough:0}],a=ye(8,21),o=on(5);return Ke(e,t,90,t=>{for(let e of i)for(let i=e.z0;i<e.z1;i+=25){let s=Math.min(i+25,e.z1);{let c=[],l=[];for(let t=i;t<s;t+=.45)for(let n of[-1,1]){let i=e.x+n*(2+r()*.9),a=.5+.5*Math.sin(t*.23+n*1.7+e.x);if(r()>.15+a*.5)continue;let o=(.15+r()*.2+a*.1)*1.6;$(i,t,.3,2)||un(i,t)||c.push(D(i,O.ground,t,r()*6.28,o,o,o))}for(let t=i+r()*6;t<s;t+=7+r()*9){let n=r()<.5?-1:1,i=e.x+n*(3.2+r()*2.5);if($(i,t,1.5,3)||Math.abs(i)<16.5&&Math.abs(e.x)<16)continue;let a=2+Math.floor(r()*4);for(let e=0;e<a;e++){let e=.5+r()*.7;l.push(D(i+(r()-.5)*2.2,O.ground-.05,t+(r()-.5)*2.5,r()*6.28,e,e*(.7+r()*.6),e))}}for(let r=Math.ceil(i/100)*100+20;r<s;r+=100){let i=e.x+(e.trough||1)*-2.5;$(i,r,.3,2)||(t.box(n.signWhite,[i,O.ground+.35,r],[.14,.7,.14],{shadow:!1}),t.box(n.black,[i,O.ground+.55,r],[.145,.12,.145],{shadow:!1}))}if(e.trough){let r=e.x+e.trough*2.75,a=null,o=(e,i)=>{if(!(i-e<1)){t.boxMM(n.curb,[r-.18,O.ground,e],[r+.18,O.ground+.22,i],{shadow:!1});for(let a=e+.5;a<i;a+=.5)t.box(n.concreteDark,[r,O.ground+.222,a],[.36,.004,.02],{shadow:!1})}};for(let e=i;e<=s;e+=1){let t=$(r,e,.3,2);!t&&a===null&&(a=e),(t||e+1>s)&&a!==null&&(o(a,t?e-1:s),a=null)}}c.length&&E(t.root,a,n.grass,c),l.length&&E(t.root,o,n.bush,l)}}{for(let[e,r]of[[A.t0+2.9,0],[A.t7-2.6,-12],[A.t0+2.9,47]])$(e,r,1,2)||(t.boxMM(n.cabinet,[e-.4,O.ground,r-.6],[e+.4,O.ground+1.5,r+.6],{collide:!0}),t.boxMM(n.housing,[e-.45,O.ground+1.5,r-.65],[e+.45,O.ground+1.58,r+.65]),t.box(n.black,[e+(e>A.t0?-.41:.41),O.ground+.9,r],[.01,.9,.5],{shadow:!1}),t.box(n.signWhite,[e+(e>A.t0?-.415:.415),O.ground+1.25,r],[.01,.12,.3],{shadow:!1}));let r=A.t7-3.6;for(let i of[6,22])if(!$(r,i,3,2)){for(let e=0;e<5;e++)t.box(n.sleeper,[r,O.ground+.07+e*.14,i+e%2*.1],[2,.14,1.2-e*.15],{rotY:Math.PI/2,collide:e===0});for(let e=0;e<4;e++)t.box(n.railRust,[r+1.6+e*.12,O.ground+.08,i+4],[.07,.15,8],{shadow:!1});e.colliders.addCentered(r,O.ground+.4,i,1.4,.8,2.2)}}})}function ln(e,t,n,i){return Ke(e,t,90,t=>{let a=on(9),s=(e,t,r,a,o,s,c)=>{let l=O.ground,u=(r,i)=>{if(i-r<.5)return;let a=(n,a,s,c,l)=>{t===`z`?e.boxMM(l,[o+n,s,r],[o+a,c,i],{shadow:!1}):e.boxMM(l,[r,s,o+n],[i,c,o+a],{shadow:!1})};a(-.55,-.42,l-.4,l+.06,n.curb),a(.42,.55,l-.4,l+.06,n.curb),a(-.42,.42,l-.45,l-.38,n.concreteDark),a(-.42,.42,l-.3,l-.27,n.water)},d=[...s].sort((e,t)=>e[0]-t[0]),f=r;for(let[r,i]of d)u(f,r),t===`z`?e.boxMM(n.curb,[o-.7,l-.02,r],[o+.7,l+.1,i],{shadow:!1}):e.boxMM(n.curb,[r,l-.02,o-.7],[i,l+.1,o+.7],{shadow:!1}),f=i;u(f,a);for(let e=r+i()*5;e<a;e+=4+i()*8){if(s.some(([t,n])=>e>t-2&&e<n+2))continue;let n=o+(i()<.5?-1:1)*(1+i()*.8),[r,a]=t===`z`?[n,e]:[e,n];if($(r,a,1.5,3))continue;let l=1+Math.floor(i()*3);for(let e=0;e<l;e++){let e=.45+i()*.55;c.push(D(r+(i()-.5)*1.2,O.ground-.05,a+(i()-.5)*1.6,i()*6.28,e,e*(.8+i()*.5),e))}}};(e=>{let t=[];s(e,`z`,H.z1+2.4,79,-92.6,[[18.5,26],[44.5,48.5],[59,65.5]],t),s(e,`x`,G.x0+1,-77.5,H.z1+2.4,[[-95,-93]],t),E(e.root,a,n.bush,t)})(t),(e=>{let t=[];s(e,`z`,G.z0+2,H.z0-2.4,-90.8,[[-65,-59]],t),E(e.root,a,n.bush,t)})(t),(e=>{let t=[];s(e,`z`,-27,13,33.2,[[-23.5,-16.5],[-7.2,-4.8]],t),E(e.root,a,n.bush,t)})(t);for(let e of[[-99,-98,-76,-10],[-90,-98,-16,-12],[-99,-1,-78,104],[17,-32,39,24],[-50,55,-27,80]])(t=>{let r=[],o=(e[2]-e[0])*(e[3]-e[1]),s=Math.round(o/260);for(let t=0;t<s;t++){let t=e[0]+i()*(e[2]-e[0]),n=e[1]+i()*(e[3]-e[1]);if($(t,n,3,4)||dn(t,n))continue;let a=2+Math.floor(i()*5);for(let e=0;e<a;e++){let e=.4+i()*.6,a=t+(i()-.5)*4,o=n+(i()-.5)*4;dn(a,o)||r.push(D(a,O.ground-.05,o,i()*6.28,e,e*(.6+i()*.5),e))}}r.length&&E(t.root,a,n.bush,r)})(t);let c=[[-86.2,20.5,-86.2,78],[-92,28,-77.5,28],[-92,50,-77.5,50],[-92,70,-77.5,70],[-89.5,-30,-34,-30],[-89.5,-55,-52,-55],[-89.5,-80,-74,-80],[-70,-97,-70,-13],[-45,-60,-45,-13],[22,-32,22,23],[17,0,27.5,0],[17,-18,27.5,-18],[-48,58,-27,58],[-48,76,-27,76],[-44,58,-44,80]];(e=>{let t=[];for(let[r,a,s,l]of c){let c=Math.hypot(s-r,l-a),u=Math.ceil(c/1),d=null,f=(u,d)=>{if(d-u<1)return;let f=r+(s-r)*u/c,p=a+(l-a)*u/c,m=r+(s-r)*d/c,h=a+(l-a)*d/c,g=new x;g.moveTo(-.45,-.04),g.lineTo(-.17,.15),g.lineTo(.17,.15),g.lineTo(.45,-.04),g.lineTo(-.45,-.04);let _=Math.hypot(m-f,h-p),v=new o(g,{depth:_,bevelEnabled:!1});v.rotateY(Math.atan2(m-f,h-p)),e.mesh(v,n.ridge,[f,O.ground,p],{shadow:!1});for(let e=u;e<d;e+=.4){if(i()>.75)continue;let n=.16+i()*.25;t.push(D(r+(s-r)*e/c+(i()-.5)*.5,O.ground+.08,a+(l-a)*e/c+(i()-.5)*.5,i()*6.28,n,n,n))}};for(let e=0;e<=u;e++){let t=e/u*c,n=r+(s-r)*t/c,i=a+(l-a)*t/c,o=$(n,i,.5,3)||dn(n,i,!0);!o&&d===null&&(d=t),(o||e===u)&&d!==null&&(f(d,o?t-1:t),d=null)}}t.length&&E(e.root,ye(7,31),n.grass,t)})(t),(t=>{for(let[r,a,o]of[[-80,60,3],[-60,-40,2],[-82,-88,3],[24,-26,2],[-30,-20,1]])for(let s=0;s<o;s++){let o=r+(i()-.5)*6,s=a+(i()-.5)*6;$(o,s,3,3)||dn(o,s)||(tn(t,{...n,wood:n.woodP},o,s,6+i()*4,i),e.colliders.addCentered(o,O.ground+1,s,.5,2,.5))}})(t),(e=>{let t=[];for(let[r,i]of[[-142,-105],[-146,40],[-150,175]])if(!$(r,i,6,4)){for(let t of[-1,1])for(let a of[-1,1])T(e,n.far,[r+t*3.2,O.ground,i+a*3.2],[r+t*.7,O.ground+30,i+a*.7],.22,.22);for(let t=3;t<29;t+=3.2){let a=6.4-t/30*5;e.box(n.far,[r,O.ground+t,i],[a,.12,.12],{shadow:!1}),e.box(n.far,[r,O.ground+t,i],[.12,.12,a],{shadow:!1}),T(e,n.far,[r-a/2,O.ground+t,i+a/2],[r+a/2-.3,O.ground+t+3,i+a/2-.3],.08,.08)}for(let[t,a]of[[24,11],[27.5,8]])e.box(n.far,[r,O.ground+t,i],[a,.5,.6],{shadow:!1});t.push([r,O.ground+30-6.5,i])}for(let r=0;r+1<t.length;r++)for(let[i,a]of[[-5,0],[5,0],[0,3.5]]){let o=new l(t[r][0]+i,t[r][1]+a,t[r][2]),s=new l(t[r+1][0]+i,t[r+1][1]+a,t[r+1][2]),c=o.clone().lerp(s,.5);c.y-=6,e.mesh(new ce(new ee(o,c,s),16,.05,3,!1),n.far,[0,0,0],{shadow:!1})}})(t),(t=>{let r=[];for(let i=H.z0-6;i>G.z0;i-=28){let a=-89.6;t.cyl(n.poleConc,[a,O.ground+4.75,i],.13,9.5,{radiusTop:.09,segments:8}),t.box(n.steel,[a,O.ground+9.1,i],[1.6,.08,.08]);for(let e of[-.6,0,.6])t.cyl(n.board,[a+e,O.ground+9.2,i],.04,.12,{segments:6});e.colliders.addCentered(a,O.ground+1.5,i,.3,3,.3),r.push([a,O.ground+9.2,i])}for(let e=0;e+1<r.length;e++)for(let i of[-.6,.6]){let a=new l(r[e][0]+i,r[e][1],r[e][2]),o=new l(r[e+1][0]+i,r[e+1][1],r[e+1][2]),s=a.clone().lerp(o,.5);s.y-=.4,t.mesh(new ce(new ee(a,s,o),8,.012,3,!1),n.wire,[0,0,0],{shadow:!1})}})(t),(t=>{let i=2.6;for(let e=1;e<=19.01;e+=1.5){let r=new u(0,0,i,i*.95,0,Math.PI,!1,0).getPoints(14).map(t=>new l(-84+t.x,O.ground+t.y,e));t.mesh(new ce(new b(r),16,.025,4,!1),n.steel,[0,0,0],{shadow:!1})}for(let e of[.35,1,1.57,2.14,2.79]){let r=-84+Math.cos(e)*i,a=O.ground+Math.sin(e)*i*.95;t.boxMM(n.steel,[r-.02,a-.02,1],[r+.02,a+.02,19],{shadow:!1})}let a=new r(i,i,16.5,18,1,!0,-Math.PI/2,Math.PI);a.rotateX(Math.PI/2),a.scale(1,.95,1),t.mesh(a,n.film,[-84,O.ground,10.4],{shadow:!1}),e.colliders.add({x:-86.6,y:O.ground,z:1},{x:-81.4,y:O.ground+2.4,z:19}),t.boxMM(n.curb,[-90.4,O.ground,.2],[-88.4,O.ground+1.9,2],{collide:!0}),t.boxMM(n.rust,[-90.6,O.ground+1.9,0],[-88.2,O.ground+2,2.2]),t.box(n.doorLeaf,[-88.38,O.ground+.8,1.1],[.04,1.5,.8]),t.cyl(n.steel,[-91.2,O.ground+.3,1.1],.08,1.6,{axis:`x`,segments:8})})(t),(e=>{if(!$(-38,67,4,1.5)){e.boxMM(n.tin,[-40,O.ground,64],[-36,O.ground+2.5,70],{collide:!0}),e.box(n.rust,[-38,O.ground+2.75,67],[4.6,.1,6.6],{rotZ:.12}),e.box(n.black,[-35.99,O.ground+1,68],[.05,2,1.6],{shadow:!1});for(let t=0;t<3;t++)e.cyl(n.signWhite,[-34.8,O.ground+.55,65+t*1.3],.55,1,{axis:`z`,segments:14,collide:!0})}})(t),(t=>{for(let[a,o]of[[-15,-8.5],[-3.5,3]]){for(let e=a;e<=o+.01;e+=1.3)T(t,n.woodP,[34.65,O.ground,e],[35,O.ground+2.3,e],.08,.08),T(t,n.woodP,[35.35,O.ground,e],[35,O.ground+2.3,e],.08,.08);for(let e of[1.1,1.6,2.1]){t.boxMM(n.woodP,[34.96,O.ground+e-.03,a],[35.04,O.ground+e+.03,o],{shadow:!1});for(let s=a+.12;s<o;s+=.19)for(let a of[-1,1]){let o=new r(.035,.09+i()*.03,.5,5,1);o.rotateX((i()-.5)*.15),o.rotateZ(a*(.22+i()*.08)),t.mesh(o,n.straw,[35+a*.07,O.ground+e-.24,s],{shadow:!1})}}e.colliders.add({x:34.5,y:O.ground,z:a},{x:35.5,y:O.ground+2.3,z:o})}})(t)})}function un(e,t){return[[-k.half-.1,k.z0,k.half+.1,k.z1],[F.x-F.half-.1,F.z0,F.x+F.half+.1,F.z1],[-10.6,45.2,10.6,57.6],[W.x0,W.z0,W.x1+.1,W.z1]].some(n=>e>n[0]&&e<n[2]&&t>n[1]&&t<n[3])}function dn(e,t,n=!1){return n?[[-16.5,-200,16.5,200],[-200,H.z0-2,-40,H.z1+3],[A.t7-3,-200,A.t0+3,200],[W.x0-6,W.z0-2,W.x1,W.z1+4],[-99,-200,-91.4,200],[-87.5,-1,-80,20],[27,-30,34,16],[-93,44,-90,48],[-86,34,-80,41],[-92,59,-86,65],[-92.3,-65,-85,-59],[-41,63,-34,71]].some(n=>e>n[0]&&e<n[2]&&t>n[1]&&t<n[3]):[[-16.5,-200,16.5,200],[-200,H.z0-2,-40,H.z1+3],[A.t7-3,-200,A.t0+3,200],[W.x0-6,W.z0-2,W.x1,W.z1+4],[-99,-200,-89.5,200],[-87.5,-1,-80,20],[27,-30,34,16],[32,-22,38.5,-18],[-93,18,-88,26],[-94,59,-86,65],[-93,44,-90,48],[-86,34,-80,41]].some(n=>e>n[0]&&e<n[2]&&t>n[1]&&t<n[3])}function fn(e,t,n,i){let a=on(13,1),o=(e,t,i,a,o,s,c)=>{e.box(n.farHaze,[t,O.ground+s/2,i],[a,s,o],{rotY:c,shadow:!1});let l=new r(.01,Math.hypot(a,o)*.55,s*.7,4,1);l.rotateY(Math.PI/4),l.scale(a/Math.hypot(a,o)*1.45,1,o/Math.hypot(a,o)*1.45),e.mesh(l,n.farHaze,[t,O.ground+s+s*.35,i],{rotY:c,shadow:!1})},s=[{x:-175,z:-45,kind:`farm`},{x:-168,z:35,kind:`farm`},{x:-190,z:0,kind:`grove`},{x:-185,z:70,kind:`grove`},{x:-160,z:-120,kind:`shed`},{x:-200,z:-90,kind:`grove`},{x:160,z:-110,kind:`farm`},{x:190,z:-70,kind:`grove`},{x:-150,z:150,kind:`farm`},{x:-200,z:120,kind:`tower`},{x:150,z:170,kind:`shed`},{x:200,z:140,kind:`grove`}];Ke(e,t,400,e=>{for(let t of s)if(!$(t.x,t.z,25,5)){let r=[],s=(e,t,n,a)=>{let o=Math.cos(a),s=Math.sin(a);for(let a=-n/2;a<n/2;a+=2.5+i()*2){let n=3+i()*3.5;r.push(D(e+o*a+(i()-.5)*4,O.ground-.3,t+s*a+(i()-.5)*4,i()*6.28,n,n*(1.3+i()*1.2),n))}},c=(i()-.5)*.6;if(t.kind===`farm`)o(e,t.x,t.z,12,9,4.5,c),o(e,t.x+14,t.z+6,8,6,3.2,c+.1),s(t.x-4,t.z-12,34,c),s(t.x-16,t.z,22,c+Math.PI/2);else if(t.kind===`grove`)s(t.x,t.z,50+i()*30,c+(i()<.5?Math.PI/2:0));else if(t.kind===`shed`)e.box(n.farHaze,[t.x,O.ground+3.5,t.z],[36,7,14],{rotY:c,shadow:!1}),s(t.x+25,t.z,20,c);else{for(let r of[-1.5,1.5])for(let i of[-1.5,1.5])T(e,n.farHaze,[t.x+r*1.4,O.ground,t.z+i*1.4],[t.x+r,O.ground+14,t.z+i],.3,.3);e.cyl(n.farHaze,[t.x,O.ground+16,t.z],3.2,4.5,{segments:12}),s(t.x+10,t.z+8,26,c)}r.length&&E(e.root,a,n.farHaze,r)}})}var pn=[.6,.26,.35,k.half],mn=[{x:.1,z:-6.8,rx:.85,rz:1.9},{x:-.6,z:-4.25,rx:.65,rz:.32},{x:1.35,z:-4.15,rx:.8,rz:.55},{x:.5,z:-3.3,rx:.4,rz:.17},{x:1.7,z:-5.2,rx:.55,rz:.4},{x:2,z:-7.8,rx:.3,rz:.4},{x:0,z:-10,rx:1,rz:.4},{x:0,z:-10.8,rx:.9,rz:1.1},{x:1.7,z:22.8,rx:.55,rz:4.8},{x:1,z:19.4,rx:.32,rz:1},{x:1,z:25.8,rx:.3,rz:1.4},{x:-1.75,z:25.2,rx:.45,rz:2.2},{x:0,z:30,rx:.32,rz:1.8},{x:-1,z:28.8,rx:.3,rz:.9}],hn=[{x:-61.2,z:-2.2,rx:1.1,rz:1.35},{x:-56.4,z:2.9,rx:.45,rz:.55},{x:-56.45,z:-.95,rx:.5,rz:.5},{x:-61.3,z:3.1,rx:.65,rz:1}];function gn(e,t){let n=[...new Set([e[0],e[2],...t.flatMap(e=>[e[0],e[2]])])].filter(t=>t>=e[0]&&t<=e[2]).sort((e,t)=>e-t),r=[];for(let i=0;i+1<n.length;i++){let a=n[i],o=n[i+1],s=t.filter(e=>e[0]<o&&e[2]>a).map(e=>[e[1],e[3]]).sort((e,t)=>e[0]-t[0]),c=e[1];for(let[e,t]of s)e>c&&r.push([a,c,o,e]),c=Math.max(c,t);c<e[3]&&r.push([a,c,o,e[3]])}return r}function _n(e){let t=new pe(e);De();let n=At(),r=de(7),i=[],a=(e,r,a,o,s=.04,c=!1)=>{if(c){let i=new te(o/2,Math.max(r-o,.01),4,10);a===`x`?i.rotateZ(Math.PI/2):i.rotateX(Math.PI/2),t.mesh(i,n.tube,e,{shadow:!1})}else t.box(n.tube,e,a===`x`?[r,s,o]:[o,s,r],{shadow:!1});i.push({c:e,axis:a===`x`?[1,0,0]:[0,0,1],len:r})};Me([{x0:-M.half,z0:M.z0-.2,x1:M.half,z1:M.z1,h:M.soffit,lamp:.05},{x0:-N.half,z0:N.z0,x1:N.half,z1:N.z1,h:(N.center+N.edge)/2,lamp:.02},{x0:-10.1,z0:46.5,x1:-2,z1:56.05,h:3.56,lamp:1.5},{x0:2,z0:46.5,x1:10.1,z1:56.05,h:3.56,lamp:1.5},{x0:F.x-F.half+.2,z0:F.z1-41,x1:F.x+F.half-.2,z1:F.z1-.5,h:F.soffit,lamp:.015},{x0:I.x0-.7,z0:I.z0-.6,x1:I.x1+.7,z1:I.z1+.6,h:3,lamp:.16,fog:!1},{x0:R.x0-8,z0:R.z0-.3,x1:R.x1+.3,z1:R.z1+.3,h:-2,lamp:.13,fog:!1},{x0:W.x0+8,z0:W.z0+4,x1:W.x1+.6,z1:W.z1-4,h:3.4,lamp:.35,fog:!1}]);let o=e.addReflector({x:0,y:O.top,z:0},void 0,.4),s=new st(ct);t.root.add(jt({cloudColor:`#aae6ec`,hillColor:`#4a9a9c`,looks:s}));let l=[[-B.half-.15,B.zBot,B.half+.15,B.zTop],[-52.6,R.z0-.3,R.x0,R.z1+.3]];{let e=[];for(let t of gn([-800,-800,800,800],l)){let[n,r,i,a]=t;e.push(n,O.ground,r,n,O.ground,a,i,O.ground,a,n,O.ground,r,i,O.ground,a,i,O.ground,r)}let r=new v;r.setAttribute(`position`,new c(e,3)),r.setAttribute(`normal`,new c(e.map((e,t)=>+(t%3==1)),3)),r.setAttribute(`uv`,new c(Array(e.length/3*2).fill(0),2)),t.mesh(r,n.field,[0,0,0],{merge:!1,shadow:`receive`})}for(let t of gn([G.x0,G.z0,G.x1,G.z1],l))e.colliders.add({x:t[0],y:O.ground-1,z:t[1]},{x:t[2],y:O.ground,z:t[3]});let u=(e,t,n)=>[{u0:-e,u1:-e+.48,v0:t,v1:n,kind:2},{u0:e-.48,u1:e,v0:t,v1:n,kind:2},{u0:-e+.68,u1:-e+1,v0:t,v1:n,kind:1},{u0:e-1,u1:e-.68,v0:t,v1:n,kind:1}],d=(r,i,a,o,s=[!0,!0,!0,!0],c=n.concreteW)=>{let l=e=>s[e]?.12:0;t.boxMM(c,[r+l(0),O.ground,a+l(2)],[i-l(1),-.16,o-l(3)]),t.boxMM(n.coping,[r,-.16,a],[i,-.005,o]),e.colliders.add({x:r,y:O.ground,z:a},{x:i,y:O.top,z:o})},f=(e,n,r,i,a)=>{let s=t.plane(e,[(n+r)/2,O.top,(i+a)/2],r-n,a-i,`y`,{merge:!1});o.hide.push(s)},p=rt({color:`#2a5c7a`,frame:{cx:0,cz:0,alongX:!1},strips:[...u(k.half,k.z0,k.z1),{u0:.05,u1:.08,v0:k.z0,v1:k.z1,kind:5}],refl:o,joint:0,yShift:[-4,17,.24,0],reflTint:`#78e4f0`,puddle:pn,puddleVar:[.04,.12],shapes:mn,dryZone:[-4.5,40,.8],dryRefl:.1}),m=B.half+.15;d(-k.half,k.half,k.z0,B.zBot,[!0,!0,!0,!1]),d(-k.half,-m,B.zBot,B.zTop,[!0,!1,!1,!1]),d(m,k.half,B.zBot,B.zTop,[!1,!0,!1,!1]),d(-k.half,k.half,B.zTop,k.z1,[!0,!0,!1,!0]),f(p,-k.half,k.half,k.z0,B.zBot),f(p,-k.half,-m,B.zBot,B.zTop),f(p,m,k.half,B.zBot,B.zTop),f(p,-k.half,k.half,B.zTop,k.z1);for(let r of[-1,1]){let i=rt({color:`#3a8a8c`,frame:{cx:r*(P.xIn+P.xOut)/2,cz:0,alongX:!1},strips:u((P.xOut-P.xIn)/2,P.z0,P.z1),refl:o,puddle:[.3,.6,.3,(P.xOut-P.xIn)/2],dryRefl:.3,lookRefl:!1}),a=r<0?-P.xOut:P.xIn,s=r<0?-P.xIn:P.xOut;d(a,s,P.z0,P.z1,[!0,!0,!0,!0],n.concrete),f(i,a,s,P.z0,P.z1);let c=r<0?-P.xIn:k.half,l=r<0?-k.half:P.xIn;t.boxMM(n.concrete,[c,O.ground,P.z0+.12],[l,-.2,P.z1-.12]),t.boxMM(n.black,[c,-.2,P.z0],[l,-.03,P.z1]);for(let e=P.z0+.05;e<P.z1;e+=.06)t.boxMM(n.steel,[c,-.03,e],[l,-.004,e+.025],{shadow:!1});e.colliders.add({x:c,y:O.ground,z:P.z0},{x:l,y:O.top,z:P.z1})}{let e=[...u(F.half,0,F.z1-F.z0),{u0:-F.half,u1:F.half,v0:0,v1:.12,kind:4},{u0:-F.half+.5,u1:F.half-.5,v0:6,v1:6.75,kind:3},{u0:-.32,u1:.32,v0:6.75,v1:36,kind:1}],t=rt({color:`#2a5a7c`,frame:{cx:F.x,cz:F.z1,alongX:!1},strips:e,refl:o,puddle:[.6,.22,.35,F.half],puddleVar:[.04,.12],shapes:hn,dryRefl:.2,wetRefl:.4,yellow:`#86a088`,oldFrame:{ox:we.xEnd,oz:we.zc,su:1,sv:-1}});d(F.x-F.half,F.x+F.half,F.z0,F.z1),f(t,F.x-F.half,F.x+F.half,F.z0,F.z1)}Mt(t,e,n);let h=Le(t,e,n,i,a),g=nt(e,t.root,n,i);for(let r of[-1,1]){let i=r<0?-1:1.15;$e(t,n.bench,n.steel,[i,0,-8.4],r<0?-Math.PI/2:Math.PI/2,9,.58),e.colliders.add({x:i-.3,y:0,z:-11.7},{x:i+.3,y:.9,z:-5.7})}$e(t,n.bench,n.steel,[.15,0,-17.3],Math.PI,3,.6),t.box(n.board,[.36,1.05,-18.4],[.95,1,.08]);for(let e of[-.42,.42])t.box(n.steel,[.36+e,.3,-18.4],[.05,.6,.05]);e.colliders.add({x:-1,y:0,z:-18.6},{x:1,y:1.6,z:-17}),$e(t,n.benchT,n.steel,[-1.95,0,22.6],-Math.PI/2,12,.57),e.colliders.add({x:-2.3,y:0,z:19.2},{x:-1.6,y:.9,z:26}),$e(t,n.benchT,n.steel,[1,0,34.5],Math.PI/2,10,.57),e.colliders.add({x:.7,y:0,z:31.6},{x:1.3,y:.9,z:37.4}),$e(t,n.benchT,n.steel,[-1.2,0,36.2],-Math.PI/2,4,.57),e.colliders.add({x:-1.5,y:0,z:35},{x:-.9,y:.9,z:37.4});for(let r of[-1,1])$e(t,n.benchT,n.steel,[r*5.6,0,48.3],0,5,.57),e.colliders.addCentered(r*5.6,.45,48.3,2.9,.9,.6),tt(t,n.benchB,n.benchB,[r*5.75,0,53.9],r<0?.6435:-.6435,1.7),e.colliders.addCentered(r*5.75,.45,53.9,1.3,.9,1.3);{let e=n.grass,i=n.grassDark,a=[],o=[],s=(e,t,n,i,o=a)=>{o.push(D(e,t,n,r()*Math.PI*2,i*(.8+r()*.5),i,i*(.8+r()*.5)))};for(let e=0;e<150;e++)s(-15.5+r()*5.2,O.ground,44+r()*16,.2+r()*.3,o);for(let e=0;e<50;e++)s(-10.7-r()*.5,O.ground,45.5+r()*12.4,.22+r()*.25,o);for(let e=0;e<70;e++){let e=18+r()*30;s((r()-.5)*3.2,O.top,e,.06+r()*.08)}for(let e=0;e<220;e++)s((r()<.5?-1:1)*(6.6+r()*9),O.ground,-60+r()*140,.12+r()*.2);let c=ye(7,3);E(t.root,c,e,a),E(t.root,c,i,o)}let _=Nt(e,t.root,n,i);qt(e,t.root,n,r,i);let y=an(e,t.root,n);return h.canDark.build(t.root,n.underDark),h.canLite.build(t.root,n.underLite),h.shedDark.build(t.root,n.underDark),h.shedLite.build(t.root,n.underLite),g.dark.build(t.root,n.underDark),g.lite.build(t.root,n.underLite),h.bcDark.build(t.root,n.bcUnderDark),h.bcLite.build(t.root,n.bcUnderLite),t.root.add(it(i,{radius:.22,color:`#ffffff`,strength:.2})),Ge(t.root),t.finalize(),{root:t.root,spawn:{pos:[-44,O.road,40],yaw:.2},beforeRender(e){let t=e.position;Ae(t.x,t.y,t.z),y(t),_(e)}}}var vn=(e,t,n,r,i)=>({id:e,label:t,kind:`track`,rect:[n-1.6,r,n+1.6,i],floor:-1.15}),yn={id:`station`,title:`霧の駅（建築版）: 電化区間の終点で非電化の支線へ乗り換える地方の分岐駅「霧原」`,typology:[`類型: 平野の田畑の中の乗り換え駅。北から来る電化複線（本線・電車）がここで終わり（頭端）、南と西へ非電化の支線（気動車）が出る`,`「電化区間の終点で気動車に乗り換える駅」（例: 大糸線の南小谷・豊肥本線の肥後大津のような境の駅）。`,`本線の 1・2 番線と、南の支線の 3〜6 番線は線路がつながらず、頭端どうしが向き合う（旅客はホームの端を歩いて乗り換える。会社や電化の境の駅に例がある）。`,`駅舎は西の単式ホーム D（0 番線・西線の頭端）の東にあり、島式ホーム A へは改札内の地下道で渡る（本線の電車は B・C の前まで入るので、構内踏切だと止まった電車がふさぐ）。`,`寸法の根拠: 1,067 mm 軌間。ホームの高さはレール面から約 1.1 m（電車の床 1.15 m 前後に合わせる）。軌道中心からホームの縁まで約 1.6 m。`,`島式ホームの幅は中央 3 m 以上・端 2 m 以上（A は 6.4 m。階段の両脇は 2 m）、縁から柱まで 1 m 以上・階段口まで 1.5 m 以上（鉄道の技術基準の解釈基準の値）。`,`点字ブロックは縁から 80 cm 以上内側（国交省のバリアフリー整備ガイドライン）。ホームの長さは本線 6 両（20 m × 6 = 120 m）に余裕を見て 129 m、支線は 2 両（40 m）、D は 43 m。`,`架線柱は駅の構内（上屋の近く）は 18 m おき、構外は 50 m おき（在来線の径間は 50 m 前後まで）。線路中心の間隔は 0・7 番線で 4 m。`,`地下道は道床の下（天井 -1.85 m・床 -4.25 m、高さ 2.4 m・幅 2.6 m）、階段は 1 段 17 cm・踏み面 28 cm（25 段）。`,`駅前広場・道・農道は田より 0.6 m 高い盛り土（田の中の道）。踏切は第 1 種（警報機・遮断機）。`].join(``),spaces:[{id:`A-north`,label:`A 島式ホーム（本線 1・2 番線）`,kind:`platform`,rect:[-k.half,k.z0,k.half,P.z0],floor:0,note:`大屋根（-12.4〜11.6）・中央柱の上屋（11.6〜37）・地下道の階段（3〜11.2）。北端はスロープと柵`},{id:`A-south`,label:`A の南（支線 4・5 番線）`,kind:`platform`,rect:[-k.half,P.z0,k.half,k.z1],floor:0,note:`頭端で B・C とつながる。南端はスロープと柵`},{id:`B`,label:`B（3 番線）`,kind:`platform`,rect:[-P.xOut,P.z0,-P.xIn,P.z1],floor:0,note:`T 字の上屋・待合の小屋・券売機。A とは目地の蓋（グレーチング）でつながる`},{id:`C`,label:`C（6 番線）`,kind:`platform`,rect:[P.xIn,P.z0,P.xOut,P.z1],floor:0,note:`B と左右対称`},{id:`D`,label:`D 駅舎側の単式ホーム（0 番線・西線の頭端）`,kind:`platform`,rect:[F.x-F.half,F.z0,F.x+F.half,F.z1],floor:0,note:`幅 14.4 m（旧貨物の荷扱いを兼ねた広いホーム）。上屋は 2 列の柱。南端の先は野原（柵は無い）`},{id:`F`,label:`旧貨物ホーム（農協の倉庫）`,kind:`platform`,rect:[W.x0,W.z0,W.x1,W.z1],floor:0,note:`7 番線（使われていない側線）に面する。倉庫と荷役の上屋`},vn(`t1`,`1 番線（本線）`,A.t1,k.z0-20,j.t12),vn(`t2`,`2 番線（本線）`,A.t2,k.z0-20,j.t12),vn(`t3`,`3 番線`,A.t3,j.t36,G.z1),vn(`t4`,`4 番線`,A.t4,j.t45,G.z1),vn(`t5`,`5 番線`,A.t5,j.t45,G.z1),vn(`t6`,`6 番線`,A.t6,j.t36,G.z1),vn(`t0`,`0 番線（西線）`,A.t0,G.z0,j.t0),vn(`t7`,`7 番線（旧貨物側線）`,A.t7,-40,j.t7),{id:`stairhall`,label:`階段室（改札内）`,kind:`hall`,rect:[I.x0,I.z0,I.x1,L.zA],floor:0,ceiling:3.1,note:`D から入り、東へ地下道へ下りる。案内・掲示板`},{id:`office`,label:`駅事務室`,kind:`room`,rect:[I.x0,L.zA,L.xOff,L.zB],floor:0,ceiling:3.1,closed:!0,note:`窓口が待合室に、窓が D に向く。机・端末・棚・黒板`},{id:`elec`,label:`電気室`,kind:`service`,rect:[L.xOff,L.zA,I.x1,L.zB],floor:0,ceiling:3.1,closed:!0},{id:`hall`,label:`待合室（出札・券売機）`,kind:`hall`,rect:[I.x0,L.zB,I.x1,L.zC],floor:0,ceiling:3.1,note:`入口は東（広場）、改札は西（D）。ベンチ・券売機・運賃表・時刻表・時計・自動販売機`},{id:`wc`,label:`便所`,kind:`room`,rect:[I.x0,L.zC,I.x1,I.z1],floor:0,ceiling:3.1,closed:!0},{id:`bstair`,label:`階段（駅舎）`,kind:`stair`,rect:[z.xTop,R.z0,z.xBot,R.z1],floor:0},{id:`tunnel`,label:`地下道（広場と 1 番線の下）`,kind:`corridor`,rect:[R.x0,R.z0,R.x1,R.z1],floor:R.floor,ceiling:R.ceil,level:-1,note:`白いタイルの壁・蛍光灯・案内の矢印・掲示`},{id:`astair`,label:`階段（A）`,kind:`stair`,rect:[-B.half,B.zBot,B.half,B.zTop],floor:0,note:`大屋根の下。station-1 と station-3 の視点の間（両方の画角の後ろ）`},{id:`plaza`,label:`駅前広場`,kind:`outdoor`,rect:[V.x0,V.z0,V.x1,V.z1],floor:-.55,note:`バス停・タクシー乗り場・駐輪場・電話ボックス・郵便ポスト・自動販売機・案内図・街灯・植え込みと時計`},{id:`road`,label:`町へ出る道（踏切）`,kind:`outdoor`,rect:[H.x0,H.z0,V.x0,H.z1],floor:-.55,note:`0 番線を踏切で渡る（警報機・遮断機）。西の端は通行止め`},{id:`lane`,label:`旧踏切道（行き止まり・station-2）`,kind:`outdoor`,rect:[U.x0,V.z1,U.x1,U.z1],floor:-.55,note:`駅の改良で踏切が廃止され、線路の手前で行き止まり`},{id:`yard`,label:`構内（信号機器室）`,kind:`service`,rect:[V.x1,-12,-11.5,42],floor:-1.15,note:`広場の柵の中。大屋根の西の柱・ケーブルの溝`},{id:`field-s`,label:`野原（D の先・小川）`,kind:`outdoor`,rect:[G.x0,F.z1,-24,G.z1],floor:-1.15,note:`station-0 の画角の奥。草だけ（物を置かない）`},{id:`field-w`,label:`野原（西・農道・農作業小屋）`,kind:`outdoor`,rect:[G.x0,H.z1,A.t0-3,F.z1],floor:-1.15},{id:`field-nw`,label:`野原（北西）`,kind:`outdoor`,rect:[G.x0,G.z0,-12,H.z0],floor:-1.15},{id:`field-e`,label:`野原（東・農道・小屋）`,kind:`outdoor`,rect:[16,G.z0,G.x1,G.z1],floor:-1.15,note:`station-2 の画角の奥は野だけ（小屋・農道は z < 16）`}],walls:[{a:[I.x0,I.z0],b:[I.x1,I.z0]},{a:[I.x1,I.z0],b:[I.x1,I.z1]},{a:[I.x0,I.z1],b:[I.x1,I.z1]},{a:[I.x0,I.z0],b:[I.x0,I.z1]},{a:[I.x0,L.zA],b:[I.x1,L.zA],kind:`partition`},{a:[I.x0,L.zB],b:[I.x1,L.zB],kind:`partition`},{a:[L.xOff,L.zA],b:[L.xOff,L.zB],kind:`partition`},{a:[I.x0,L.zC],b:[I.x1,L.zC],kind:`partition`},{a:[R.x0,R.z0],b:[R.x1,R.z0],level:-1},{a:[R.x0,R.z1],b:[-B.half,R.z1],level:-1},{a:[-B.half-.1,B.zBot],b:[-B.half-.1,B.zTop],kind:`railing`},{a:[B.half+.1,B.zBot],b:[B.half+.1,B.zTop],kind:`railing`},{a:[-B.half-.1,B.zBot],b:[B.half+.1,B.zBot],kind:`railing`},{a:[-k.half,k.z0],b:[k.half,k.z0],kind:`fence`},{a:[-k.half,k.z1],b:[k.half,k.z1],kind:`fence`},{a:[F.x+F.half,I.z1],b:[F.x+F.half,F.z1],kind:`fence`},{a:[V.x1,V.z0],b:[V.x1,V.z1],kind:`fence`},{a:[U.x1,V.z1],b:[U.x1,U.z1],kind:`railing`},{a:[G.x0,G.z0],b:[G.x1,G.z0],kind:`railing`},{a:[G.x1,G.z0],b:[G.x1,G.z1],kind:`railing`},{a:[G.x0,G.z1],b:[G.x1,G.z1],kind:`railing`},{a:[G.x0,G.z0],b:[G.x0,G.z1],kind:`railing`}],openings:[{kind:`double-door`,at:[I.x1,18.8],width:3,wall:`z`,state:`open`,note:`駅舎の入口（広場から）`},{kind:`gate`,at:[I.x0,18.5],width:6.6,wall:`z`,state:`open`,note:`改札（自動改札 4 台の間の通路 3 本と係員の箱）`},{kind:`opening`,at:[I.x0,6],width:5.2,wall:`z`,state:`open`,note:`D から地下道の階段室へ`},{kind:`door`,at:[I.x0+3.1,L.zA],width:.9,wall:`x`,state:`locked`,note:`事務室（職員）`},{kind:`door`,at:[I.x0+4.3,L.zC],width:1,wall:`x`,state:`closed`,note:`便所`},{kind:`door`,at:[I.x0+9.7,L.zC],width:1,wall:`x`,state:`closed`,note:`便所`},{kind:`window`,at:[I.x0+3.2,L.zB],width:1.8,wall:`x`,state:`closed`,note:`窓口`},{kind:`stair`,at:[(z.xTop+z.xBot)/2,(R.z0+R.z1)/2],width:2.6,wall:`x`,state:`open`},{kind:`stair`,at:[0,(B.zBot+B.zTop)/2],width:2.4,wall:`z`,state:`open`,note:`A の階段（南が上り口）`},{kind:`crossing`,at:[A.t0,(H.z0+H.z1)/2],width:5,wall:`z`,state:`open`,note:`踏切（第 1 種: 警報機・遮断機）`},{kind:`opening`,at:[-P.xIn+.35,(P.z0+P.z1)/2],width:12.2,wall:`z`,state:`open`,note:`A と B の間の目地の蓋`},{kind:`opening`,at:[P.xIn-.35,(P.z0+P.z1)/2],width:12.2,wall:`z`,state:`open`,note:`A と C の間の目地の蓋`},{kind:`gate`,at:[0,k.z0],width:2,wall:`x`,state:`open`,note:`A の北端のスロープ（関係者用の柵の扉。開いている）`},{kind:`gate`,at:[0,k.z1],width:2,wall:`x`,state:`open`,note:`A の南端のスロープ`},{kind:`opening`,at:[U.x1,51.4],width:3.8,wall:`z`,state:`locked`,note:`旧踏切道の東の口（柵）`}],tour:[{label:`駅前広場から駅舎`,eye:[-19,1.05,36],yaw:.95,pitch:.03},{label:`待合室（券売機・窓口）`,eye:[-42,1.6,22],yaw:.9,pitch:-.04},{label:`待合室から改札と D`,eye:[-42.6,1.6,17.2],yaw:Math.PI/2-.1,pitch:-.03},{label:`D（0 番線）の北から南を見る`,eye:[-58.5,1.6,8],yaw:Math.PI-.06},{label:`D の南端から駅舎を振り返る`,eye:[-62,1.6,43],yaw:-.35,pitch:-.02},{label:`駅舎の地下道の階段`,eye:[-52.4,1.6,1.7],yaw:-Math.PI/2,pitch:-.4},{label:`地下道（1 番線の下）`,eye:[-20,R.floor+1.6,1.7],yaw:-Math.PI/2},{label:`A の階段を上がって大屋根の下から北西`,eye:[2.2,1.6,2.4],yaw:.9,pitch:.05},{label:`A の北端（スロープ・柵）`,eye:[0,1.6,k.z0+3],yaw:0,pitch:-.05},{label:`A の北から大屋根を振り返る（station-1 の方）`,eye:[-1.5,1.6,-42],yaw:Math.PI-.05,pitch:.04},{label:`東の野原から大屋根を見る`,eye:[26,.45,-6],yaw:Math.PI/2+.1,pitch:.05},{label:`頭端（1 番線の車止めと B）`,eye:[-1.2,1.6,38],yaw:Math.PI+.35,pitch:-.12},{label:`B の上屋の下から北（A へ）`,eye:[-7.2,1.6,56],yaw:-.25},{label:`A の南端から支線を見る`,eye:[0,1.6,k.z1-3],yaw:Math.PI,pitch:-.05},{label:`station-2 の場所から広場を振り返る`,eye:[-24,1.05,51.4],yaw:.4,pitch:0},{label:`踏切（0 番線）`,eye:[-62,1.05,-5.5],yaw:Math.PI/2,pitch:-.02},{label:`旧貨物ホームと倉庫`,eye:[-70.5,.45,-8.5],yaw:.85,pitch:.06},{label:`西の農道から駅を振り返る`,eye:[-96,1.05,40],yaw:-1.45,pitch:.02}],notes:[`B. 視点ごとに写っている物と、見えない方向（霧: 0.024/m。80 m で 15 %、100 m で 9 % しか見えない）:`,`  station-1 = A の大屋根の下 (0, 1.55, 0) から北。1・2 番線と架線柱、両側の野原、地平線の倉庫。画角は |x| < 0.9|z|（z < 0）。後ろ（南）の地下道の階段・駅舎・広場は画角の外。`,`  station-3 = A の中央柱の上屋の下 (0, 1.55, 12) から南。頭端の B・C と、その間を南へ続く A。画角は |x| < 0.52(z − 12)。広場の柵（x = -16）・旧踏切道（x < -21.7）は外。地下道の階段は真後ろ（z 3〜11.2）。`,`  station-2 = 旧踏切道の行き止まり (-23.7, 1.05, 51.4)（盛り土の道 -0.55 に立つ目の高さ）から東。3 番線と B を真横に。道・広場・駅舎は背中側。東の口の柵（高さ 1.05 m）は画角の下の端より低い。`,`  station-0 = D（0 番線）の上屋の下 (-62, 1.55, 29.3) から南。ホームの先は野原と小川。画角は |x + 62| < 0.44(z − 29.3)。駅舎は左（東）の柱の列の外で、D の南端より手前で終わる。`,`  上屋の下から見ると霧も上屋の影で暗い（場面の材質の決まり）ので、霧に溶けた遠くの物も空より暗い影に見える。だから各視点の画角の奥（霧の中）にも、参考画像に無い物は置かない。`,`C. 参考画像の矛盾の解き方:`,`  1) station-3 では 1・2 番線が B・C の前で終わり、station-2 では B の奥（東）に線路が続く → 1・2 番線は B・C の北の面の前の車止めで終わり（頭端）、B・C の南の面の前から 4・5 番線が南へ出る。station-2 の左に見える線路 = 1 番線の終わり、右 = 4 番線。`,`  2) station-2 では B の右（南）の奥に A が見えない（線路だけ）、station-3 では A が B・C の間を南へ続く → station-3 を優先（A は南へ続く）。station-2 の右端に A の南の部分の縁がわずかに入る（元の版と同じ）。`,`  3) station-0 の D は元の版では本線と直角で、線路がどこにもつながらなかった → 回して南北にし、駅舎側の単式ホーム（0 番線の頭端・南向き）にした。0 番線は北へ出て西へ曲がる（西線）。`,`     北向きにすると、北の地平線の倉庫（station-1 に写る）が D の画角に入るので、南向きにした（南の奥は野原だけ）。`,`  4) 1・2 番線の架線は大屋根の南の端（z 11）で終わる（station-3 の空に架線が無い）。電車は B・C の前の車止めまで入るので、先頭の車両は架線の外に止まる（現実離れ: 実際は車止めの数 m 手前まで架線がある）。`,`  5) B・C は 12 m しかない（station-2 で両端が見える）→ 3・6 番線は 1 両（レールバス 12〜16 m）の短い列車が使う線にした。4・5 番線は 2 両。`,`現実離れした所:`,`  - 1・2 番線を覆う大屋根は地方の駅としては大きい（station-1 を優先）。D の南端の先に柵が無い（station-0 を優先）。`,`  - 中央柱の上屋の南の床の水たまりには、上屋の続きが映る（映り込みにだけ出す層 layer 2。歩いて上屋の外へ出ると消える）。元の版の絵の工夫を残した。`,`  - 大屋根の下の右（東）の暗さ（画面のグラデーション）と霧のにじみの強さは場所ごとの見た目で、歩くと位置で滑らかに混ぜる（station.ts）。`,`  - 空気の色（霧・空・照り返し・地平線の雲や丘）は視点の位置ごとの値を、カメラの位置で混ぜる（looks-data.ts。重み 1/(1+(d/5)^3)。`,`    大屋根の下と中央柱の上屋の下は 12 m しか離れていないので、6〜8 m かけて移り変わる）。小川は D の辺りからだけ見える。`,`  - 北の地平線の倉庫の影は霧を薄く掛けた遠景（元の版と同じ）。station-2 の奥の鉄塔・柱も遠景の影。`,`  - 歩ける範囲は x -100〜40・z -100〜105 の用水路まで（外は霧の向こうの田。道の西の端は通行止め）。`,`D. 作り込みの決まり（場所の種類ごと）:`,`  ホーム: 縁の白い警告ブロックと黄色の線状ブロック（縁から 80 cm 以上）・水たまり・ベンチ・駅名標・時刻表。端はスロープと柵と扉、頭端は車止め。`,`  駅舎: 腰壁と白い壁・タイルの床・天井の蛍光灯。待合室にベンチ・券売機・運賃表・窓口・時刻表・時計・掲示板・自動販売機・植木・消火器。外は雨樋・室外機・計器箱。`,`  地下道: 白いタイル（目地）・腰の帯・床の溝・4 m おきの蛍光灯・吊り下げの案内（両向き）・掲示物。`,`  構外: 盛り土の道（法面）・電柱と電線（25〜30 m おき）・街灯・農作業小屋・冬枯れの木・稲わらのロール・祠・草の株（場所でむらのある塊）。`,`E. 重さ（1456×816 で 8 ms 以下）のための工夫（見た目は同じ）:`,`  場所ごとにまとめる（region.ts。画角の外の場所は描かない）・色だけ違う材質を頂点色の 1 つにまとめる・中の物は床の映り込みに出さない（層 1）・`,`  明るさの計算で重みが 0 の項を省く・霧の暗さは視線の近くの屋根だけ調べる・水たまりの縁のノイズは水たまりの近くだけ・野原の細かい模様は遠くで省く・映り込みは 0.4 倍の解像度。`,`F. 写っていない所の作り込み（2026-10-07 第 2 回。参考画像の言葉: 暗い構造と明るい霧の開口・光る蛍光灯とにじみ・濡れて霧と灯りを映す床・錆びた鋼・掲示物）:`,`  室内（駅舎・地下道）: 屋根の下の一様な灯りは弱くし、器具（2 本組の蛍光灯）と窓・開口ごとの光だまりで照らす（mat.ts の Pool。部屋の内側の箱の中だけ・縁は少しちぎる）。`,`    天井は暗い板の升目と梁、床は濡れた水たまりに蛍光灯（見る向きに伸びる）と窓の霧が映る。壁は水の筋と湿りの帯、タイルは 1 枚ずつのむら。窓のガラスは透ける（中から外の霧、外から中の灯り）。`,`    待合室: 柱型・梁・吊り下げの案内・発車の案内・コインロッカー・消火栓・パンフレットの棚・くず入れ 3 つ・伝言板・額入りの掲示物・入口から改札への点字ブロック。`,`    地下道: 4 m おきの器具の光だまり（間は暗い）・手すり・溝の格子の蓋・配線の棚・伸縮目地・点字ブロック・内照式の広告。階段は段鼻・手すり・柵。`,`  駅舎の外: 窓の枠（窓台・水切り）・軒の垂木・入口の庇の蛍光灯・掲示板・ベンチ・くず入れ・植木鉢・自転車・歩道の点字ブロック。外壁は軒からの雨の筋。`,`  広場・道: アスファルトの水たまりは鏡のように霧の空を映す（ホームの水たまりと同じ絵）。横断歩道・マンホール・側溝の蓋・車止め・若い木・道の外側線・送迎の車。`,`  ホームの壁（線路側。A・D・旧貨物）: 12 m おきの退避の穴（暗い窪みと黄と黒の帯）・6 m おきの水抜きと水の筋・配線の管・番号の札・根元の草。B・C は参考画像のまま。`,`  線路の脇: 道床の肩の草・キロポスト・蓋つきのケーブルの溝・信号の機器箱・錆びたレールと枕木の山。野原: 用水路（水面は霧を映す）・茂みの群れ・畦・電柱の列・`,`    ビニールハウス・稲のはさ掛け・農作業小屋・冬枯れの木。遠景（画角の外の向き）: 屋敷林・農家・倉庫・給水塔・送電線の鉄塔の影。`,`  置く所の決まり: 参考画像の視点の画角（seen.ts の扇形。上屋の下からは霧の中の物も暗い影に見えるので、遠くも含めて）には置かない。`,`    station-2・station-3 の画角の奥（東と南の野原）は参考画像のとおり何も無い野のまま（無作為の場所でそこを向くと簡素に見えるのは、参考画像を優先した結果）。`,`  重さ: 散らばる小物は 90 m の升目ごとに材質でまとめる（region.ts の tileRegion。草・茂みも形に焼き込む）。色だけ違う材質（光だまりを受ける物・光る物も）は頂点色に。`,`    110 m より遠い升目は描かない（霧で 7 % 未満）。ホームの壁の小物はそのホームの上からは描かない（縁に隠れる）。地下道は階段の口が画面に入るときだけ、室内は駅舎から 30 m 以内だけ描く。`,`    屋根の長方形は全部の画素が調べるので、使う数（8）ちょうどにした（小さな庇・バス停・駐輪場には使わない）。室内は空の割合の計算を省く（屋根に完全に覆われる）。`]},bn=ae(oe,{name:`station-arch`,background:`#bdf5e8`,fog:{horizon:`#bdf6e7`,zenith:`#d2fcee`,ground:`#8fd3c8`,density:.024,heightFalloff:0,baseHeight:-1,start:2,max:.985,steps:0,extinction:[.28,1,1.3]},toon:{amount:0,thresholds:[1.5,.72,.3],soft:.05,noiseAmp:0,noiseScale:1,shade:[.8,.95,6],dark:[.6,1,10],hi:[1.05,.8,-2]},post:{bloom:{strength:.04,threshold:1,radius:.15},diffusion:{amount:.12,threshold:.75,radius:.15},lines:{enabled:!1,color:`#173036`,width:1,depth:.1,normal:.6,id:0,breakup:.3,fadeFar:30,opacity:.4},kuwahara:{enabled:!1,radius:4,sharpness:8,aniso:1},grade:{exposure:1,lift:0,gamma:1,gain:1,saturation:1,hue:0,tint:[0,0],posterize:0,vignette:0,grain:0}}}),xn={color:`#c0c8cc`,amount:.4,p0:[1,.4],p1:[.65,.4],blend:`mul`},Sn=ae(bn,{name:`station-arch-1`,post:{diffusion:{amount:0,threshold:.75,radius:.15},gradients:[xn]}}),Cn=ae(bn,{name:`station-arch-0`,post:{diffusion:{amount:0,threshold:.75,radius:.15}}}),wn=ae(bn,{name:`station-arch-walk`,post:{gradients:[{...xn,amount:0}]}});function Tn(e,t,n,r,i,a){let o=Math.max(t-e.x,0,e.x-r),s=Math.max(n-e.z,0,e.z-i),c=Math.min(Math.max(1-Math.hypot(o,s)/a,0),1);return c*c*(3-2*c)}var En={id:`station`,label:`霧の駅（建築版）`,style:bn,plan:yn,sky:!1,views:[{id:`station-0`,label:`D（0 番線）の上屋の下から南の野原`,eye:[F.x,1.55,F.z1-15.7],yaw:Math.PI,pitch:.0327,fov:27.7,style:Cn},{id:`station-1`,label:`大屋根の下から北`,eye:[0,1.55,0],yaw:-.016,pitch:.0086,fov:53.3,style:Sn},{id:`station-2`,label:`旧踏切道の行き止まりから B`,eye:[-23.7,1.05,51.4],yaw:-Math.PI/2,pitch:.071,fov:32.3},{id:`station-3`,label:`中央柱の上屋から南（頭端の B・C）`,eye:[0,1.55,12],yaw:Math.PI,pitch:.026,roll:.007,fov:32.5}],build(e){let t=_n(e);t.styleZones=[{min:[-2e3,-50,-2e3],max:[2e3,200,2e3],style:wn}];let n=t.beforeRender;return t.beforeRender=e=>{n?.(e);let t=e.position,r=Tn(t,-M.half,M.z0,M.half,M.z1-6,5),i=Tn(t,F.x-F.half,F.z1-30,F.x+F.half,F.z1,4);wn.post.diffusion.amount=.12*(1-Math.max(i,r)),wn.post.gradients[0].amount=.4*r},t}};export{En as station};