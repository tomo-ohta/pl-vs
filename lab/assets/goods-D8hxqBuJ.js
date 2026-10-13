import{i as e}from"./main-8OE8YqBL.js";import{Fn as t,Jn as n,Sn as r,Tn as i,Yn as a,d as o,h as s,l as c,qn as l,st as u,v as d,z as f}from"./Builder-oYNvRoNC.js";import{n as p,t as m}from"./glsl-Di_U4Tn9.js";import{a as h}from"./Style-BSLb_DuM.js";import{_ as g,i as _,v,x as y}from"./storage-DDoO1RSJ.js";var b={uRects:{value:Array.from({length:8},()=>new a)},uRectH:{value:Array(8).fill(-1e3)},uRectL:{value:Array(8).fill(0)},uRectF:{value:Array(8).fill(1)},uLampCol:{value:new d(`#bff0e0`)},uSkyCol:{value:new d(`#b8efe2`)},uOutCol:{value:new d(`#5d9c94`)},uInCol:{value:new d(`#0d2a2e`)},uFloorY:{value:0},uStHorizon:{value:new d(`#b4efe4`)},uStUpper:{value:new d(`#c4f8ea`)},uStZenith:{value:new d(`#d0fbee`)},uStGround:{value:new d(`#57a3a0`)},uStFogShape:{value:new a(.08,.025,.12,1.6)},uStGlowA:{value:new a(-1,.15,0,0)},uStGlowACol:{value:new d(`#ffffff`)},uStGlowB:{value:new a(-1,.15,0,6)},uStGlowBCol:{value:new d(`#000000`)},uStClouds:{value:0},uStHills:{value:0},uStStripRefl:{value:1},uStTubeCol:{value:new d(`#fff8d0`)},uStFieldGain:{value:1},uStTubeGlow:{value:new l(1,1)},uStStripGain:{value:1},uStPudLift:{value:0},uStLampMul:{value:1},uStWet:{value:0},uStFloorRefl:{value:1},uStDens:{value:new a(1,0,.1,2)},uStFarMul:{value:.26},uStStream:{value:1}},x=[];function S(e){x.push(e)}function C(){x.length=0}var w={uPoolP:{value:Array.from({length:10},()=>new a)},uPoolA:{value:Array.from({length:10},()=>new a)},uPoolC:{value:Array.from({length:10},()=>new a)},uPoolB0:{value:Array.from({length:10},()=>new a)},uPoolB1:{value:Array.from({length:10},()=>new a)},uPoolN:{value:0}},T=``;function E(e,t,n){let r=`${e.toFixed(2)},${t.toFixed(2)},${n.toFixed(2)},${x.length}`;if(r===T)return;T=r;let i=x.map((r,i)=>{let a=r.box,o=Math.max(a[0]-e,0,e-a[3]),s=Math.max(a[1]-t,0,t-a[4]),c=Math.max(a[2]-n,0,n-a[5]);return[Math.hypot(o,s,c)+Math.hypot(r.c[0]-e,r.c[2]-n)*.01,i]});i.sort((e,t)=>e[0]-t[0]);let a=Math.min(10,x.length);for(let e=0;e<a;e++){let t=x[i[e][1]];w.uPoolP.value[e].set(t.c[0],t.c[1],t.c[2],t.half),w.uPoolA.value[e].set(t.axis[0],t.axis[1],t.axis[2],t.radius),w.uPoolC.value[e].set(t.color[0],t.color[1],t.color[2],t.kind),w.uPoolB0.value[e].set(t.box[0],t.box[1],t.box[2],t.halfH??0),w.uPoolB1.value[e].set(t.box[3],t.box[4],t.box[5],t.side??1)}w.uPoolN.value=a}var D=`
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
`;function O(e){for(let t=0;t<8;t++){let n=e[t];n?(b.uRects.value[t].set(Math.min(n.x0,n.x1),Math.min(n.z0,n.z1),Math.max(n.x0,n.x1),Math.max(n.z0,n.z1)),b.uRectH.value[t]=n.h,b.uRectL.value[t]=n.lamp??0,b.uRectF.value[t]=n.fog===!1?0:1):(b.uRectL.value[t]=0,b.uRects.value[t].set(0,0,0,0),b.uRectH.value[t]=-1e3)}}var k=`
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
`,A=0,j=`
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
}`;function M(t){let r={...t.defines??{}};t.unlit&&(r.ST_UNLIT=1),t.noFog&&(r.ST_NOFOG=1),t.map&&(r.ST_MAP=1),t.mottle&&(r.ST_MOTTLE=1),t.farFog&&(r.ST_FARFOG=1),t.pool&&(r.ST_POOL=1),t.wet&&(r.ST_WET=1);let a=new d(t.emissive??0).multiplyScalar(t.emissiveIntensity??1),o={...h,...b,uAlbedo:{value:new d(t.color)},uEmissive:{value:a},uGain:{value:t.gain??1},uMap:{value:t.map??null},uMottle:{value:new l(...t.mottle??[0,1])},uOpacity:{value:t.opacity??1},uId:{value:A++*.618034%1*.9+.05},uLineW:{value:t.line??0},uFogMul:{value:t.fogMul??1},uSheen:{value:t.sheen??0},...t.pool?w:{},uWet:{value:new n(...t.wet??[0,0,1])},...t.uniforms??{}},s=`
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
${p}
${m}
${e}
${k}
#ifdef ST_POOL
${D}
#endif
uniform vec3 uWet;
${t.fragHead??``}
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
${t.fragAlbedo??``}
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
${t.fragFinal??``}
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
${t.fragPostFog??``}
  gl_FragColor = vec4(col, alpha);
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  gInfo = vec4(vn.xy * 0.5 + 0.5, uId, uLineW * alpha);
}`;return new i({uniforms:o,defines:r,vertexShader:j,fragmentShader:s,side:t.side??0,transparent:t.transparent??!1,depthWrite:t.depthWrite??!0,vertexColors:t.vertexColors??!1})}var N=new u;function P(e,t,n,r,i,a,o=0){let s=t.clone();o&&s.applyMatrix4(N.makeRotationX(o)),s.translate(...a),s.applyMatrix4(N.makeRotationY(i)),e.mesh(s,n,r)}function F(e,r,i,a,o,c){let l=new t(new s(o.map(e=>new n(...e)),!1,`catmullrom`,.3),16,c,6,!1);l.applyMatrix4(N.makeRotationY(a)),e.mesh(l,r,i)}function I(e){let t=e.width,r=e.seatY??.43,i=e.backTop??.86,a=e.taper??.12,c=e.corner??.07,l=new s([[0,r-.04,-.22],[0,r,-.19],[0,r+.01,-.1],[0,r-.005,.04],[0,r,.14],[0,r+.05,.2],[0,r+.16,.235],[0,(r+i)/2+.08,.26],[0,i,.3]].map(e=>new n(e[0],e[1],e[2])),!1,`catmullrom`,.4),u=l.getSpacedPoints(24),d=l.getLength(),p=[],m=[];for(let e=0;e<=24;e++){let n=u[e],o=(1-e/24)*d,s=t/2*(1+a*Math.max(0,(n.y-(r+.1))/(i-r))),l=o<c?s-c+Math.sqrt(Math.max(0,c*c-(c-o)*(c-o))):s;for(let e=0;e<=8;e++){let t=-l+2*l*e/8,r=.012*(2*e/8-1)**2;p.push(t,n.y+r,n.z)}}for(let e=0;e<24;e++)for(let t=0;t<8;t++){let n=e*9+t,r=n+8+1;m.push(n,r,n+1,n+1,r,r+1)}let h=new o;return h.setAttribute(`position`,new f(p,3)),h.setAttribute(`uv`,new f(Array(p.length/3*2).fill(0),2)),h.setIndex(m),h.computeVertexNormals(),h.toNonIndexed()}function L(e,t,n,r,i,a,o=.56){let s=a*o,l=I({width:o-.07,backTop:.84,taper:.1,corner:.06});for(let n=0;n<a;n++)P(e,l,t,r,i,[-s/2+o*(n+.5),0,0]);P(e,new c(s-.1,.04,.04),n,r,i,[0,.37,-.02]),P(e,new c(s-.1,.04,.04),n,r,i,[0,.37,.17]);let u=Math.max(2,Math.round(s/1.8)+1);for(let t=0;t<u;t++){let a=-s/2+.2+(s-.4)*t/(u-1);P(e,new c(.05,.36,.05),n,r,i,[a,.18,.08]),P(e,new c(.04,.03,.46),n,r,i,[a,.015,.06]),P(e,new c(.04,.04,.3),n,r,i,[a,.37,.08])}}function R(e,t,n,r,i){let a=I({width:.53,seatY:.42,backTop:.86,taper:.1,corner:.08});for(let n of[-.28,.28])P(e,a,t,r,i,[n,0,0]);P(e,new c(1.2,.035,.035),n,r,i,[0,.37,.05]),P(e,new c(1.2,.035,.035),n,r,i,[0,.37,-.12]);for(let t of[-.55,.55]){let a=Math.sign(t);F(e,n,r,i,[[t,0,-.16],[t,.2,-.13],[t,.38,-.08]],.016),F(e,n,r,i,[[t,0,.2],[t,.2,.17],[t,.38,.1]],.016),P(e,new c(.03,.02,.4),n,r,i,[t,.01,.02]),F(e,n,r,i,[[t+a*.03,.4,.16],[t+a*.06,.55,.12],[t+a*.065,.6,0],[t+a*.065,.58,-.14],[t+a*.04,.44,-.2]],.016)}}function z(e,t,r,i,a,o=1.8){let l=new s([[0,.4,-.22],[0,.43,-.1],[0,.42,.08],[0,.46,.2],[0,.62,.27],[0,.8,.33],[0,.92,.38]].map(e=>new n(e[0],e[1],e[2])));for(let n=0;n<=10;n++){if(n===4)continue;let r=n/10,s=l.getPointAt(r),u=l.getTangentAt(r),d=Math.atan2(u.y,u.z);P(e,new c(o,.02,.075),t,i,a,[0,s.y,s.z],-d)}for(let t of[-o/2+.15,o/2-.15])F(e,r,i,a,[[t,0,-.28],[t,.2,-.16],[t,.4,-.05]],.022),F(e,r,i,a,[[t,0,.32],[t,.2,.2],[t,.4,.06]],.022),F(e,r,i,a,[[t,.39,-.2],[t,.41,.1],[t,.58,.25],[t,.9,.36]],.02)}var B=[`horizon`,`upper`,`zenith`,`ground`,`glowA`,`glowB`,`sky`,`out`,`in`];function ee(e){let t=(e,t=1)=>new d(e).multiplyScalar(t);return{at:e.at,cols:[t(e.horizon),t(e.upper),t(e.zenith),t(e.ground),t(e.glowA.color,e.glowA.strength),t(e.glowB.color,e.glowB.strength),t(e.sky),t(e.out),t(e.in)],vecs:[new a(...e.shape),new a(...e.glowA.dir,e.glowA.power),new a(...e.glowB.dir,e.glowB.power)],dens:e.dens,lift:e.lift,clouds:e.clouds,blockFog:e.blockFog,start:e.start,floorRefl:e.floorRefl,hills:e.hills,stripRefl:e.stripRefl,tubeGlow:e.tubeGlow,fieldGain:e.fieldGain,tubeColor:new d(e.tubeColor).multiplyScalar(e.tubePower),wet:e.wet,lampMul:e.lampMul,pudLift:e.pudLift,stripGain:e.stripGain,farMul:e.farMul??.26,stream:e.stream??1}}var te=class{packed;tc=B.map(()=>new d);tv=[new a,new a,new a];lastX=NaN;lastZ=NaN;constructor(e){this.packed=e.map(ee)}apply(e,t){if(e===this.lastX&&t===this.lastZ)return;this.lastX=e,this.lastZ=t;let n=this.packed.map(n=>1/(1+(Math.hypot(e-n.at[0],t-n.at[1])/5)**3)),r=n.reduce((e,t)=>e+t,0);this.tc.forEach(e=>e.setRGB(0,0,0)),this.tv.forEach(e=>e.set(0,0,0,0));let i=0,a=0,o=0,s=0,c=0,l=0,u=0,f=0,p=[0,0],m=0,h=new d(0,0,0),g=0,_=0,v=0,y=0,x=0,S=0;this.packed.forEach((e,t)=>{let d=n[t]/r;e.cols.forEach((e,t)=>{this.tc[t].r+=e.r*d,this.tc[t].g+=e.g*d,this.tc[t].b+=e.b*d}),e.vecs.forEach((e,t)=>this.tv[t].addScaledVector(e,d)),i+=e.dens*d,a+=e.lift*d,o+=e.clouds*d,s+=e.blockFog*d,c+=e.start*d,l+=e.floorRefl*d,u+=e.hills*d,f+=e.stripRefl*d,p[0]+=e.tubeGlow[0]*d,p[1]+=e.tubeGlow[1]*d,m+=e.fieldGain*d,h.r+=e.tubeColor.r*d,h.g+=e.tubeColor.g*d,h.b+=e.tubeColor.b*d,g+=e.wet*d,_+=e.lampMul*d,v+=e.pudLift*d,y+=e.stripGain*d,x+=e.farMul*d,S+=e.stream*d});let[C,w,T,E,D,O,k,A,j]=this.tc;b.uStHorizon.value.copy(C),b.uStUpper.value.copy(w),b.uStZenith.value.copy(T),b.uStGround.value.copy(E),b.uStGlowACol.value.copy(D),b.uStGlowBCol.value.copy(O),b.uSkyCol.value.copy(k),b.uOutCol.value.copy(A),b.uInCol.value.copy(j),b.uStFogShape.value.copy(this.tv[0]),b.uStGlowA.value.copy(this.tv[1]),b.uStGlowB.value.copy(this.tv[2]),b.uStDens.value.set(i,a,s,c),b.uStClouds.value=o,b.uStFloorRefl.value=l,b.uStHills.value=u,b.uStStripRefl.value=f,b.uStTubeGlow.value.set(p[0],p[1]),b.uStFieldGain.value=m,b.uStTubeCol.value.copy(h),b.uStWet.value=g,b.uStLampMul.value=_,b.uStPudLift.value=v,b.uStStripGain.value=y,b.uStFarMul.value=x,b.uStStream.value=S}},V=[{at:[-62,29.3],horizon:`#b6f0e6`,upper:`#c2f8ec`,zenith:`#ccfbef`,ground:`#86d0cc`,shape:[.06,.035,.15,3],glowA:{dir:[-1,.1,0],power:6,color:`#ffffff`,strength:0},glowB:{dir:[-1,.12,0],power:8,color:`#fff4d0`,strength:0},sky:`#5ccfe0`,out:`#1c6070`,in:`#1e6680`,dens:1,lift:.009,clouds:0,blockFog:.1,start:2,floorRefl:1,stripRefl:0,tubeGlow:[.5,.8],fieldGain:1,tubeColor:`#e8fcd8`,tubePower:2.4,wet:0,lampMul:1,pudLift:0,stripGain:1,hills:0,stream:1},{at:[0,0],horizon:`#98d4c6`,upper:`#98dccd`,zenith:`#9adccd`,ground:`#78b6ae`,shape:[.12,.012,.15,2],glowA:{dir:[-.35,.15,-.92],power:3,color:`#a29889`,strength:1},glowB:{dir:[-.6,.15,-.78],power:8,color:`#3a2a00`,strength:1},sky:`#74d6e2`,out:`#2a8590`,in:`#04161e`,dens:1,lift:.008,clouds:0,blockFog:.1,start:2,floorRefl:8,stripRefl:8,tubeGlow:[1.6,1.6],fieldGain:.7,tubeColor:`#fffcc4`,tubePower:1.15,wet:0,lampMul:1,pudLift:.12,stripGain:1,hills:0,stream:0},{at:[-23.7,51.4],horizon:`#82cfcc`,upper:`#a0e0d8`,zenith:`#e2f6e8`,ground:`#3f9d9b`,shape:[.16,.02,.1,1.6],glowA:{dir:[1,.55,0],power:5,color:`#24200c`,strength:1},glowB:{dir:[-1,.12,0],power:8,color:`#fff4d0`,strength:0},sky:`#6cd8c8`,out:`#226e6a`,in:`#062420`,dens:.9,lift:.012,clouds:0,blockFog:.1,start:9,floorRefl:1,stripRefl:.5,tubeGlow:[7,2.6],fieldGain:1,tubeColor:`#fff8d8`,tubePower:2.4,wet:0,lampMul:1,pudLift:0,stripGain:1,hills:.35,stream:0},{at:[0,12],horizon:`#aee8ea`,upper:`#d4fdf9`,zenith:`#ecfffc`,ground:`#5a9ea4`,shape:[.12,.07,.92,1.6],glowA:{dir:[-1,.15,.3],power:4,color:`#204840`,strength:1},glowB:{dir:[-.6,.2,.8],power:6,color:`#203830`,strength:1},sky:`#5cc0d0`,out:`#2a7684`,in:`#051520`,dens:.8,lift:.004,clouds:1,blockFog:.16,start:2,floorRefl:8,stripRefl:4,tubeGlow:[1,1],fieldGain:.6,tubeColor:`#ecfae0`,tubePower:2.4,wet:.4,lampMul:.3,pudLift:.25,stripGain:1.8,hills:0,stream:0}],H=new Set,U=[.88,1,.97];function W(e,t=`solid`){if(H.has(e.toLowerCase()))return e;let n=new d(e),i={h:0,s:0,l:0};n.getHSL(i,r);let a=t===`glow`,o=i.s*(a?.85:.8),s=a?i.l*.92:.015+.86*i.l**1.12,c=+(Math.min(Math.abs(i.h-.04),Math.abs(i.h-1.04))<.1);return a||(s*=1-.26*(1-c)*i.s*(1-Math.abs(i.l-.5)*2)),n.setHSL(i.h,o,s,r),n.setRGB(n.r*U[0]**2.2,n.g*U[1]**2.2,n.b*U[2]**2.2),`#${n.getHexString()}`}var G=new Map;function K(e={}){let t=!!e.inside,n=t?`in`:`out`,r=G.get(n);r||G.set(n,r=new Map);let i=t?{pool:!0,fogMul:.18}:{};return{get(e,n=`solid`){let a=`${n}:${e}`,o=r.get(a);if(!o){let s=W(e,n);o=M(n===`glow`?{color:`#000000`,unlit:!0,emissive:s,emissiveIntensity:.78,fogMul:t?.18:1}:n===`glass`?{color:s,transparent:!0,opacity:.24,depthWrite:!1,sheen:.8,side:2,...i}:{color:s,...i}),r.set(a,o)}return o}}}function q(e,t,n={}){let r=K(n),i=v(e,t),a=0,o=((e,t,n=0,o)=>{a++,e(g.at(i,r,t,n,o??7919+a*131))});return o.mats=r,o}var J={ticket:{body:`#3e5c60`,panel:`#c9d0cc`,screen:`#a6d6cb`,band:`#2f6a8a`},locker:{body:`#c3ccc5`,door:`#d4dbd5`,sign:`#2f6a8a`},vendingWhite:{body:`#e9ece6`,accent:`#3d78b8`},vendingRed:{body:`#c9433b`,accent:`#e9ece6`,goodsColors:[`#c94a45`,`#e8e4d6`,`#2d3f55`,`#d9a43a`,`#8a5a3b`,`#b8d7e3`]},bins:{kind:`recycle`,body:`#9aa8a4`,lid:`#4c7f7c`,n:3},plant:{pot:`#8a7a62`,leaf:`#4f7d5c`,h:1.05},officeChair:{kind:`office`,seat:`#3f5f63`},officeShelf:{load:[`paper`,`binders`,`cardboard`,`paper`],frame:`#c3c9c3`},carWhite:{body:`#e7ebe6`},carHatch:{type:`hatch`,body:`#9fb7c0`},carNavy:{body:`#3c5677`},truck:{body:`#eef0ea`},bikeSilver:{frame:`#cfd9d6`},bikeRed:{frame:`#a8463f`},bikeBlack:{frame:`#2a3233`},drums:[`#3d6f9a`,`#8a4a3a`,`#6f6a5a`,`#3f6f5a`]};function Y(e,t,n=8){let r=e/2,i=[],a=t/2-r;for(let e=0;e<=n;e++){let t=e/n*Math.PI;i.push([Math.cos(t)*r,a+Math.sin(t)*r])}for(let e=0;e<=n;e++){let t=Math.PI+e/n*Math.PI;i.push([Math.cos(t)*r,-a+Math.sin(t)*r])}return i}function X(e,t={}){let n=t.body??`#e3e7e2`,r=t.top??`#2a3233`,i=`#141c1c`;e.extrude(`#9aa5a1`,Y(.23,1.38),`xz`,0,.09,{bevel:.004}),e.extrude(n,Y(.25,1.4),`xz`,.09,.94,{bevel:.01,collide:!0}),e.extrude(r,Y(.262,1.412),`xz`,.94,1,{bevel:.012});for(let r of[-1,1]){let a=r*.126;for(let t of[-.36,.36])e.box(y(n,-.5),[a-.002,.12,t-.004],[a+.002,.91,t+.004],{shadow:!1});for(let t of[-.5,-.05,.5])e.box(i,[a-.003,.66,t-.03],[a+.003,.7,t+.03],{shadow:!1});(!t.flaps||t.flaps[r<0?0:1])&&(e.box(y(n,-.3),[a-.003,.4,.06],[a+.003,.88,.16],{r:.003,shadow:!1}),e.box(i,[a-.005,.43,.095],[a+.005,.85,.125],{shadow:!1}),e.box(`#2a3233`,[a-.002+r*.006,.47,.1],[a+.002+r*.016,.81,.12],{r:.006,shadow:!1}))}let a=e.sub([0,1,.42],0,{pitch:.28});a.box(`#1d2727`,[-.1,0,-.1],[.1,.035,.1],{r:.01}),a.box(`#4f8fd6`,[-.085,.035,-.085],[.085,.039,.085],{kind:`glow`,shadow:!1}),a.box(`#cfe6f2`,[-.03,.039,-.03],[.03,.041,.03],{kind:`glow`,shadow:!1}),e.box(i,[-.045,1,.6],[.045,1.006,.612],{shadow:!1}),e.box(`#5f6c6a`,[-.06,1,.585],[.06,1.004,.63],{r:.003,shadow:!1});let o=e.sub([0,1,.08],0,{pitch:-.5});o.box(`#1d2727`,[-.08,0,-.04],[.08,.06,.02],{r:.008}),o.box(`#7fd0b4`,[-.065,.012,.02],[.065,.05,.023],{kind:`glow`,shadow:!1}),e.box(i,[-.05,1,-.52],[.05,1.006,-.47],{shadow:!1}),e.box(`#5f6c6a`,[-.065,1,-.54],[.065,1.004,-.45],{r:.003,shadow:!1});for(let t of[-1,1]){let n=t*.703;e.box(`#1d2727`,[-.05,.7,n-.006],[.05,.82,n+.006],{r:.008,shadow:!1}),e.box(`#56c48c`,[-.035,.72,n-.008],[.035,.8,n+.008],{kind:`glow`,shadow:!1})}}function Z(e,t={}){let n=t.body??`#3e5c60`,r=t.panel??`#c9d0cc`,i=t.screen??`#a6d6cb`,a=t.band??`#2f6a8a`,o=`#141c1c`,s=.84,c=-.28,l=.26;e.box(o,[-.84/2+.02,0,-.26],[s/2-.02,.08,.24000000000000002],{r:.008}),e.box(n,[-.84/2,.08,c],[s/2,1.62,l],{r:.02,collide:!0}),e.box(y(n,.25),[-.84/2-.005,1.62,c],[.425,1.78,.29000000000000004],{r:.015}),e.box(`#eef3ee`,[-.37,1.65,.29000000000000004],[s/2-.05,1.75,.29400000000000004],{kind:`glow`,shadow:!1}),e.box(a,[-.37,1.65,.29400000000000004],[-.26,1.75,.297],{shadow:!1}),e.box(r,[-.39,.6,l],[s/2-.03,1.58,.275],{r:.01});let u=e.sub([-.07,1,.275],0,{pitch:-.18});u.box(o,[-.27,0,-.01],[.27,.48,.03],{r:.012}),u.box(i,[-.24,.035,.03],[.24,.445,.034],{kind:`glow`,shadow:!1});for(let e=0;e<4;e++)for(let t=0;t<4;t++)u.box(`#e7f4ef`,[-.21+t*.105,.07+e*.07,.034],[-.13+t*.105,.115+e*.07,.037],{kind:`glow`,shadow:!1});let d=e.sub([.31,0,.275]);d.box(`#8c9894`,[-.07,1.36,0],[.07,1.44,.03],{r:.008}),d.box(o,[-.035,1.395,.03],[.035,1.405,.034],{shadow:!1}),d.box(`#8c9894`,[-.07,1.18,0],[.07,1.26,.025],{r:.008}),d.box(o,[-.055,1.215,.025],[.055,1.225,.029],{shadow:!1}),d.box(`#2a3233`,[-.06,1.02,0],[.06,1.12,.02],{r:.008}),d.box(`#4f8fd6`,[-.04,1.04,.02],[.04,1.1,.023],{kind:`glow`,shadow:!1}),d.cyl(`#c94a45`,[0,.88,.012],.022,.025,{axis:`z`,seg:12}),e.box(`#9aa5a1`,[-.3,.2,l],[.3,.5,.28],{r:.012}),e.box(`#0f1717`,[-.26,.24,.272],[.26,.44,.28400000000000003]),e.box(`#dcebea`,[-.26,.38,.28400000000000003],[.26,.44,.28800000000000003],{kind:`glass`,shadow:!1}),e.box(`#f4f4ee`,[-.3,.52,.275],[.1,.57,.278],{shadow:!1}),e.box(`#56c48c`,[.2,.53,.275],[.27,.56,.279],{kind:`glow`,shadow:!1}),e.cyl(`#9aa5a1`,[.3,.14,.265],.015,.012,{axis:`z`,seg:10})}function ne(e,t={}){let n=t.cols??4,r=t.body??`#c3ccc5`,i=t.door??`#d4dbd5`,a=t.sign??`#2f6a8a`,o=`#141c1c`,s=.6,c=n*s,l=.5/2,u=.08,d=1.85;e.box(o,[-c/2+.01,0,-.23],[c/2-.01,u,.22],{}),e.box(r,[-c/2,u,-.5/2],[c/2,d,l],{r:.008,collide:!0}),e.box(y(r,-.15),[-c/2-.01,d,-.5/2],[c/2+.01,1.9700000000000002,.27],{r:.01}),e.box(`#eef3ee`,[-c/2+.1,1.87,.27],[c/2-.1,1.9500000000000002,.274],{kind:`glow`,shadow:!1}),e.box(a,[-c/2+.1,1.87,.274],[-c/2+.3,1.9500000000000002,.277],{shadow:!1});let f=[.5,.3125,.3125,.3125,.3125],p=.1;for(let t=0;t<f.length;t++){let r=f[t]-.008;for(let a=0;a<n;a++){let n=-c/2+s*(a+.5);e.box(i,[n-s/2+.012,p,l],[n+s/2-.012,p+r,.262],{r:.003});let u=p+r-.13;if(e.box(`#9aa5a1`,[n+.17,u,.262],[n+.25,u+.11,.29]),e.box(o,[n+.195,u+.075,.29],[n+.225,u+.081,.292],{shadow:!1}),e.cyl(`#5f6c6a`,[n+.21,u+.03,.294],.012,.008,{axis:`z`,seg:8,shadow:!1}),e.box(`#f4f4ee`,[n-s/2+.05,p+r-.06,.262],[n-s/2+.12,p+r-.025,.264],{shadow:!1}),t===0)for(let t=0;t<3;t++)e.box(y(i,-.6),[n-.12,p+.06+t*.03,.262],[n+.12,p+.068+t*.03,.264],{shadow:!1})}p+=f[t]}}function re(e,t={}){let n=t.frame??`#c9d0cc`,r=t.band??`#3f8f5f`,i=t.glass??`#dcebea`,a=.9/2,o=2.2;e.box(`#9aa29e`,[-.49,0,-.49],[.49,.1,.49],{r:.01});for(let t of[-1,1])for(let r of[-1,1])e.box(n,[t*a-.03,.1,r*a-.03],[t*a+.03,o,r*a+.03],{r:.008});let s=(t,r)=>{let s=r*a,c=(n,r,i,a,o,c,l)=>{t===`z`?e.box(c,[n,i,s-o],[r,a,s+o],{kind:l,shadow:!l}):e.box(c,[s-o,i,n],[s+o,a,r],{kind:l,shadow:!l})};c(-.45+.03,.42000000000000004,.1,.32,.012,n),c(-.45+.03,.42000000000000004,.32,2.14,.004,i,`glass`),c(-.45+.03,.42000000000000004,.98,1.03,.014,n),c(-.45+.03,.42000000000000004,2.14,o,.014,n)};s(`z`,-1),s(`x`,-1),s(`x`,1);for(let t of[-1,1]){let r=t<0?-.45+.03:.005,a=t<0?-.005:.42000000000000004;e.box(n,[r,.1,.438],[a,.32,.462],{}),e.box(i,[r,.32,.446],[a,2.14,.454],{kind:`glass`,shadow:!1}),e.box(n,[r,.98,.436],[a,1.03,.464],{}),e.box(n,[t<0?a-.025:r,.1,.434],[t<0?a:r+.025,2.14,.466],{})}e.rod(`#8c9894`,[.06,.85,.49],[.06,1.25,.49],.012),e.box(y(n,-.2),[-.5,o,-.5],[.5,2.25,.5],{r:.01}),e.box(`#eef3ee`,[-.43,2.25,-.43],[.43,2.45,.43],{kind:`glow`,shadow:!1}),e.box(r,[-.45,2.25,-.45],[a,2.3000000000000003,a],{}),e.box(y(n,-.2),[-.48,2.45,-.48],[.48,2.5,.48],{r:.01}),e.box(n,[-.35,.9,-.45+.03],[.35,.93,-.45+.3],{});let c=e.sub([0,.93,-.33]);c.box(`#4f8f6a`,[-.11,0,-.08],[.11,.24,.08],{r:.02}),c.box(`#2a3233`,[-.1,.24,-.02],[.1,.28,.04],{r:.02}),c.box(`#e7f4ef`,[-.06,.12,.08],[.06,.18,.083],{kind:`glow`,shadow:!1}),c.box(`#141c1c`,[.03,.2,.08],[.07,.205,.084],{shadow:!1}),e.box(y(n,-.3),[-.3,.45,-.45+.03],[.3,.48,-.45+.28],{}),e.box(`#c9b98f`,[-.25,.48,-.39],[.05,.53,-.2],{r:.006}),e.collide([-.49,0,-.49],[.49,2.5,.49])}function ie(e,t={}){let n=t.red??`#c9433b`,r=.2;e.box(`#9aa29e`,[-.26,0,-.26],[.26,.05,.26],{r:.01}),e.lathe(n,[[0,.05],[.218,.05],[.218,.1],[r,.11],[r,1],[0,1]],[0,0,0],{seg:22,collide:!0}),e.lathe(n,[[0,1],[.25,1],[.25,1.035],[.22,1.06],[.19,1.15],[r*.6,1.24],[r*.25,1.28],[0,1.285]],[0,0,0],{seg:22}),e.ball(n,[0,1.3,0],.035,{seg:10});for(let t of[-.32,.32]){let i=e.sub([Math.sin(t)*r,.88,Math.cos(t)*r],t);i.box(`#141c1c`,[-.055,0,-.01],[.055,.025,.006]),i.box(n,[-.07,.025,-.01],[.07,.045,.03],{r:.008})}e.sub([0,.62,r],0).box(`#f4f4ee`,[-.07,0,-.004],[.07,.17,.004],{shadow:!1});let i=e.sub([0,0,-.2],Math.PI);i.box(y(n,-.6),[-.12,.3,-.006],[.12,.304,.004],{shadow:!1}),i.box(y(n,-.6),[-.12,.78,-.006],[.12,.784,.004],{shadow:!1}),i.cyl(`#c8d0cc`,[.08,.6,.006],.014,.012,{axis:`z`,seg:10,shadow:!1})}function ae(e,t={}){let n=t.body??`#dcdfd8`,r=`#2a3233`,i=.8,a=.28;for(let t of[-.3,.3])e.box(`#5f6c6a`,[t-.05,0,-.28/2-.02],[t+.05,.08,.16],{r:.008});e.box(n,[-.8/2,.08,-.28/2],[i/2,.66,a/2],{r:.012,collide:!0});let o=-.13,s=.36;e.cyl(r,[o,s,a/2],.21,.006,{axis:`z`,seg:24,shadow:!1}),e.cyl(`#5f6c6a`,[o,s,.14400000000000002],.05,.01,{axis:`z`,seg:12,shadow:!1});for(let t of[.08,.13,.18])e.torus(y(n,-.15),[o,s,.15200000000000002],t,.004,{axis:`z`,seg:24,shadow:!1});e.torus(n,[o,s,.14600000000000002],.21,.012,{axis:`z`,seg:24,shadow:!1}),e.box(y(n,-.15),[-.33,.356,.14800000000000002],[.07,.364,.15600000000000003],{shadow:!1}),e.box(y(n,-.15),[-.134,.15999999999999998,.14800000000000002],[-.126,.56,.15600000000000003],{shadow:!1}),e.box(y(n,-.4),[.17,.12,a/2],[.172,.62,.14300000000000002],{shadow:!1}),e.box(`#f4f4ee`,[.22,.5,a/2],[.34,.56,.14300000000000002],{shadow:!1}),e.tube(`#e3e6df`,[[i/2,.22,.04],[.47000000000000003,.22,.02],[.49,.3,-.06],[.49,.62,-.28/2+.02]],.025,{seg:12,radial:8}),e.box(r,[-.37,.12,-.28/2-.004],[i/2-.03,.62,-.138],{shadow:!1})}function oe(e,t={}){let n=t.body??`#a7b3ae`,r=t.w??1.2,i=t.h??1.5,a=.22;e.box(`#8f9893`,[-r/2-.08,0,-.8/2-.08],[r/2+.08,a,.48000000000000004],{r:.015,collide:!0}),e.box(n,[-r/2,a,-.8/2],[r/2,a+i,.8/2],{r:.012,collide:!0}),e.extrude(y(n,-.2),[[-.8/2-.06,a+i],[.47000000000000003,a+i],[.47000000000000003,a+i+.04],[-.8/2-.06,a+i+.11]],`zy`,-r/2-.05,r/2+.05,{bevel:.006});for(let t of[-1,1]){let o=t<0?-r/2+.04:.006,s=t<0?-.006:r/2-.04;e.box(n,[o,.27,.4],[s,a+i-.05,.41200000000000003],{r:.004});for(let[t,r]of[[.36,4],[a+i-.3,3]]){e.box(y(n,-.65),[o+.06,t-.01,.41000000000000003],[s-.06,t+r*.045,.41300000000000003],{shadow:!1});for(let i=0;i<r;i++)e.sub([(o+s)/2,t+i*.045+.02,.41600000000000004],0,{pitch:.6}).box(n,[-(s-o)/2+.06,-.003,-.016],[(s-o)/2-.06,.003,.016],{shadow:!1})}}e.box(`#141c1c`,[-.003,.27,.41200000000000003],[.003,a+i-.05,.41400000000000003],{shadow:!1});for(let t of[-1,1])e.box(`#5f6c6a`,[t*.05-.015,a+i*.5-.09,.41200000000000003],[t*.05+.015,a+i*.5+.09,.43500000000000005],{r:.008});e.cyl(`#c8d0cc`,[.05,a+i*.5+.14,.41600000000000004],.012,.008,{axis:`z`,seg:8,shadow:!1}),e.box(`#f4f4ee`,[-r/2+.1,a+i-.2,.41200000000000003],[-r/2+.34,a+i-.1,.41500000000000004],{shadow:!1}),e.box(`#d9b23a`,[r/2-.3,a+i-.2,.41200000000000003],[r/2-.12,a+i-.1,.41500000000000004],{shadow:!1});for(let t of[-r/2+.12,r/2-.12])e.box(y(n,-.5),[t-.003,.3,-.404],[t+.003,a+i-.08,-.4],{shadow:!1});e.box(y(n,-.5),[-r/2+.12,a+i-.083,-.404],[r/2-.12,a+i-.077,-.4],{shadow:!1}),e.box(y(n,-.65),[-.3,.36,-.405],[.3,.54,-.401],{shadow:!1});for(let t of[-r/2+.25,-r/2+.45])e.tube(`#2a3233`,[[t,.27,-.8/2-.02],[t,.1,-.8/2-.15],[t,-.02,-.8/2-.35]],.035,{seg:8,radial:8})}function se(e,t={}){let n=t.red??`#c9433b`,r=.7,i=.18;e.box(y(n,-.2),[-.7/2,.5,-.18/2],[r/2,1.4,i/2],{r:.01,collide:!0}),e.box(n,[-.7/2+.03,.53,i/2],[r/2-.03,1.3699999999999999,.102],{r:.006}),e.box(`#f4f4ee`,[-.16,1.18,.102],[.16,1.2999999999999998,.105],{shadow:!1});for(let t=0;t<3;t++)e.box(`#c9433b`,[-.12+t*.09,1.21,.105],[-.06+t*.09,1.27,.107],{shadow:!1});e.box(`#9aa5a1`,[r/2-.1,.88,.102],[r/2-.07,1.02,.125],{r:.008}),e.box(y(n,-.6),[-.29,.62,.102],[r/2-.06,.624,.104],{shadow:!1}),e.box(y(n,-.2),[-.08,1.46,-.04],[.08,1.48,i/2-.02],{r:.006}),e.ball(`#e8584a`,[0,1.5299999999999998,i/2-.1],.06,{kind:`glow`,seg:12,shadow:!1}),e.cyl(`#5f6c6a`,[0,1.47,i/2-.1],.065,.02,{seg:14})}function ce(e,t={}){let n=t.w??1.4,r=t.d??.75,i=.7,a=t.steel??`#c3c9c3`,o=t.top??`#7f9a8e`,s=`#2a3233`;e.box(y(a,-.2),[-n/2,.6649999999999999,-r/2],[n/2,i,r/2],{r:.006,collide:!0}),e.box(o,[-n/2+.015,i,-r/2+.015],[n/2-.015,.703,r/2-.015],{shadow:`receive`});let c=n/2-.42;e.box(a,[c,.02,-r/2+.02],[n/2-.01,.6649999999999999,r/2-.02],{r:.004,collide:!0}),e.box(s,[c+.01,0,-r/2+.04],[n/2-.02,.03,r/2-.04],{});for(let[t,i]of[[.42,.63],[.26,.41],[.04,.25]])e.box(y(a,.12),[c+.012,t,r/2-.02],[n/2-.022,i,r/2-.006],{r:.004}),e.box(s,[c+.1,i-.045,r/2-.006],[n/2-.11,i-.03,r/2-.002],{shadow:!1});if(e.box(y(a,.12),[-n/2+.05,.59,r/2-.03],[c-.01,.6599999999999999,r/2-.014],{r:.004}),e.box(a,[-n/2+.01,0,-r/2+.02],[-n/2+.035,.6649999999999999,r/2-.02],{r:.004}),e.box(a,[-n/2+.03,.2,-r/2+.02],[c,.6599999999999999,-r/2+.035],{}),t.items===!1)return;let l=e.sub([-.12,.703,-r/2+.2],(e.r()-.5)*.3);l.box(s,[-.1,0,-.08],[.1,.015,.06],{r:.006}),l.box(s,[-.025,.015,-.03],[.025,.12,-.01],{}),l.box(s,[-.25,.1,-.04],[.25,.42,-.01],{r:.008}),l.box(`#9ad0c8`,[-.23,.12,-.01],[.23,.4,-.006],{kind:`glow`,shadow:!1}),e.box(`#d9ddd6`,[-.33,.703,r/2-.26],[.09,.72,r/2-.1],{r:.006});for(let t=0;t<2+Math.floor(e.r()*3);t++)e.sub([n/2-.3+(e.r()-.5)*.04,.703+t*.012,-r/2+.2+(e.r()-.5)*.04],(e.r()-.5)*.4).box(t%3==2?`#d8cfa6`:`#f2f3ee`,[-.105,0,-.15],[.105,.011,.15],{shadow:!1});let u=e.sub([-n/2+.2,.703,-r/2+.18],.3);u.box(`#3a4646`,[-.1,0,-.1],[.1,.05,.1],{r:.012}),u.box(`#2a3233`,[-.09,.05,-.06],[.09,.08,-.01],{r:.012})}function le(e,t={}){let n=t.frame??`#8a6f52`,r=t.colors??[`#f2f3ee`,`#c94a45`,`#3d78b8`,`#e3c06a`,`#4f9a64`,`#f2f3ee`,`#7fb1a8`],i=.8,a=1.45,o=.3,s=[[-.3/2,0],[o/2,0],[o/2,.45],[-.3/2+.08,a],[-.3/2,a]];for(let t of[-1,1])e.extrude(n,s,`zy`,t*i/2-.009,t*i/2+.009,{bevel:.004});e.box(y(n,-.2),[-.8/2,.05,-.3/2],[i/2,1.43,-.135],{}),e.box(n,[-.8/2,0,-.3/2],[i/2,.08,o/2],{r:.006}),e.collide([-.8/2-.01,0,-.3/2],[.41000000000000003,a,o/2]);for(let t=0;t<4;t++){let a=.35+t*.27,s=o/2-.04-t*.045,c=e.sub([0,a,s],0,{pitch:-.28});c.box(y(n,-.1),[-.39,-.01,-.06],[i/2-.01,0,.03],{}),c.box(`#dcebea`,[-.39,0,.026],[i/2-.01,.08,.032],{kind:`glass`,shadow:!1});for(let t=0;t<3;t++){let n=-.26+t*.26;if(e.r()<.12)continue;let i=r[Math.floor(e.r()*r.length)],a=1+Math.floor(e.r()*3);for(let t=0;t<a;t++)c.sub([n+(e.r()-.5)*.02,0,.018-t*.006],(e.r()-.5)*.06).box(t===a-1?i:y(i,-.2),[-.105,0,-.002],[.105,.21+(e.r()-.5)*.02,.002],{shadow:!1});c.box(`#f4f4ee`,[n-.09,.12,.02],[n+.09,.15,.021],{shadow:!1})}}}function ue(e,t={}){let n=t.pot??`#b9b3a4`,r=t.leaf??`#3f6f52`,i=t.w??.6,a=t.d??.45,o=.42;e.extrude(n,[[-i/2+.03,0],[i/2-.03,0],[i/2,.38],[-i/2,.38]],`xy`,-a/2+.02,a/2-.02,{bevel:.01,collide:!0}),e.box(y(n,.15),[-i/2-.01,.38,-a/2-.01],[i/2+.01,o,a/2+.01],{r:.012}),e.box(`#3a3328`,[-i/2+.03,.39,-a/2+.03],[i/2-.03,.425,a/2-.03],{shadow:!1}),e.ball(y(r,-.2),[0,.52,0],[i*.46,.2,a*.46],{seg:12});for(let t=0;t<13;t++){let n=t/13*Math.PI*2+e.r()*.4,o=t%3==0?.35:.85,s=Math.cos(n)*i*.4*o,c=Math.sin(n)*a*.4*o,l=.52+(1-o)*.12+.06+e.r()*.05,u=.07+e.r()*.05,d=o<.5?y(r,.35):e.r()<.4?y(r,.12):r;e.ball(d,[s,l,c],[u,u*.8,u],{seg:8,shadow:!1})}for(let t=0;t<3;t++)e.rod(y(r,-.7),[(e.r()-.5)*.2,o,(e.r()-.5)*.15],[(e.r()-.5)*.3,.62,(e.r()-.5)*.2],.008,{shadow:!1})}function de(e,t={}){let n=t.color??`#3d6f9a`,r=.2925,i=.88,a=t.lying?e.sub([0,r,0],0,{pitch:Math.PI/2}).sub([0,-.88/2,0]):e,o=[[0,.004],[.27249999999999996,.004],[.2895,.012],[r,.024],[.2845,.034],[.2845,.285],[.2945,.295],[.2945,.312],[.2845,.322],[.2845,.558],[.2945,.568],[.2945,.585],[.2845,.595],[.2845,.846],[r,.856],[.2895,.874],[.28049999999999997,i],[.27449999999999997,.868],[0,.868]];a.lathe(n,o,[0,0,0],{seg:18});for(let e of[.3035,.5765])a.torus(y(n,.35),[0,e,0],.2905,.007,{axis:`y`,seg:20,shadow:!1});a.torus(y(n,.45),[0,.868,0],.28049999999999997,.009,{axis:`y`,seg:20,shadow:!1}),a.cyl(y(n,-.5),[.14,.874,.05],.03,.012,{seg:10,shadow:!1}),a.cyl(y(n,-.5),[-.15,.874,-.05],.018,.012,{seg:8,shadow:!1}),t.lying?e.collide([-.2925,0,-.88/2],[r,r*2,i/2]):e.collide([-.2925,0,-.2925],[r,i,r])}function Q(e,t={}){let n=t.wood??`#a58f6c`,r=1.1/2;for(let t=0;t<7;t++){let i=-.5+t*1/6;e.box(t%3==1?y(n,-.12):n,[-.55,.124,i-.05],[r,.144,i+.05],{shadow:`receive`})}for(let t of[-.5,0,.5]){e.box(y(n,-.2),[t-.05,.104,-.55],[t+.05,.124,r],{shadow:!1}),e.box(y(n,-.25),[t-.05,0,-.55],[t+.05,.02,r],{shadow:!1});for(let r of[-.5,0,.5])e.box(y(n,-.35),[t-.05,.02,r-.05],[t+.05,.104,r+.05],{shadow:!1})}}function fe(e,t={}){Q(e,{wood:t.wood});let n=t.bag??`#e6e1d0`,r=t.band??`#3f8f5f`,i=t.layers??5,a=.84,o=.5;for(let t=0;t<i;t++){let s=t%2*(Math.PI/2)+(e.r()-.5)*.04,c=e.sub([(e.r()-.5)*.03,.144+t*.128,(e.r()-.5)*.03],s);for(let s of[-1,1]){if(t===i-1&&s>0&&e.r()<.5)continue;let l=c.sub([0,0,s*.26],(e.r()-.5)*.05),u=e.r()<.25?y(n,-.15):n;l.box(u,[-.84/2,0,-.5/2],[a/2,.14,o/2],{r:.05,shadow:t===i-1||`receive`});for(let e of[-1,1])l.box(y(u,-.2),[e*a/2-.02,.03,-.22],[e*a/2+.012,.11000000000000001,o/2-.03],{shadow:!1});l.box(r,[-.08,.138,-.19],[.08,.14200000000000002,o/2-.06],{shadow:!1}),l.box(r,[-.08,.03,o/2-.004],[.08,.11000000000000001,.252],{shadow:!1})}}e.collide([-.56,0,-.56],[.56,.144+i*.128,.56])}function pe(e,t={}){Q(e,{wood:t.wood});let n=t.layers??3,r=.3,i=.144;for(let a=0;a<n;a++)for(let o=0;o<2;o++)for(let s=0;s<3;s++){if(a===n-1&&e.r()<.35)continue;let c=-.27+o*.54,l=-.37+s*.37;_(e.sub([c,.144+a*r,l],(e.r()-.5)*.04),.52,.295,.36,t.colors),i=Math.max(i,.144+(a+1)*r)}e.collide([-.56,0,-.56],[.56,i,.56])}function $(e,t={}){let n=t.n??6;for(let r=0;r<n;r++)Q(e.sub([(e.r()-.5)*.06,r*.146,(e.r()-.5)*.06],(e.r()-.5)*.05),{wood:t.wood});e.collide([-.58,0,-.58],[.58,n*.146,.58])}function me(e,t={}){let n=t.film??`#e8ebe5`,r=t.r??.6,i=r*2,a=[[0,-i/2],[r*.82,-i/2],[r*.95,-i/2+r*.04],[r*1,-i/2+r*.14],[r*1.02,0],[r*1,i/2-r*.14],[r*.95,i/2-r*.04],[r*.82,i/2],[0,i/2]];if(t.upright){e.lathe(n,a,[0,i/2,0],{seg:22}),e.cyl(y(n,-.15),[0,i/2+.12,0],r*1.022,.1,{seg:22,open:!0,shadow:!1}),e.collide([-r,0,-r],[r,i,r]);return}e.lathe(n,a,[0,r,0],{axis:`x`,seg:22});for(let t of[-.22,.3])e.cyl(y(n,-.15),[t*r,r,0],r*1.022,.12,{axis:`x`,seg:22,open:!0,shadow:!1});for(let t of[-1,1])e.torus(y(n,-.12),[t*(i/2+.002),r,0],r*.45,.012,{axis:`x`,seg:18,shadow:!1});e.collide([-i/2,0,-r],[i/2,r*2,r])}function he(e,t={}){let n=t.red??`#d8553f`;e.box(`#2a3233`,[-.19,0,-.19],[.19,.035,.19],{r:.012}),e.lathe(n,[[0,.035],[.16,.035],[.15,.08],[.045,.66],[.03,.7],[0,.7]],[0,0,0],{seg:16});for(let[t,n]of[[.3,.38],[.48,.55]]){let r=.15-(t-.08)*(.105/.58)+.003,i=.15-(n-.08)*(.105/.58)+.003;e.cyl(`#f4f4ee`,[0,(t+n)/2,0],r,n-t,{radiusTop:i,seg:16,open:!0,shadow:!1})}e.collide([-.19,0,-.19],[.19,.7,.19])}function ge(e,t={}){let n=t.frame??`#d8d8cf`,r=t.a??`#d8553f`,i=t.b??`#f0efe8`,a=1.2;for(let t of[-1.2/2+.05,a/2-.05]){e.rod(n,[t,.8,0],[t,0,.28],.018),e.rod(n,[t,.8,0],[t,0,-.28],.018),e.rod(n,[t,.25,.19],[t,.25,-.19],.012);for(let n of[-.28,.28])e.box(`#2a3233`,[t-.04,0,n-.06],[t+.04,.02,n+.06],{r:.005})}e.rod(n,[-1.2/2+.05,.25,.19],[a/2-.05,.25,.19],.014);for(let t=0;t<6;t++){let n=-1.2/2+t*a/6;e.box(t%2?i:r,[n,.62,-.02],[n+a/6,.78,.02],{r:.004})}e.box(n,[-1.2/2,.6,-.025],[a/2,.62,.025],{r:.004}),e.collide([-1.2/2,0,-.3],[a/2,.8,.3])}function _e(e,t={}){let n=t.frame??`#8a9692`,r=t.deck??`#9a8466`,i=1.2,a=.8,o=.48;for(let t=0;t<6;t++){let n=-.33+t*.66/5;e.box(t%2?y(r,-.12):r,[n-.06,o,-1.2/2],[n+.06,.5,i/2],{shadow:`receive`})}for(let t of[-1,1]){e.rod(n,[t*a/2,.5,-1.2/2],[t*a/2,.5,i/2],.016),e.rod(n,[t*a/2,.7,-1.2/2],[t*a/2,.7,i/2],.012);for(let r of[-1.2/2,-1.2/6,i/6,i/2])e.rod(n,[t*a/2,.5,r],[t*a/2,.7,r],.01);e.rod(n,[t*a/2,.5,i/2],[t*.3,.86,1.35],.016);let r=t*.47000000000000003;e.torus(`#1f2626`,[r,.25,0],.225,.028,{axis:`x`,seg:20}),e.torus(`#b7c1bd`,[r,.25,0],.19,.01,{axis:`x`,seg:18});for(let t=0;t<8;t++){let n=t/8*Math.PI*2;e.rod(`#b7c1bd`,[r,.25,0],[r,.25+Math.sin(n)*.19,Math.cos(n)*.19],.004,{radial:4,shadow:!1})}e.rod(n,[r,.25,0],[t*a/2,o,0],.014)}for(let t of[-1.2/2,i/2])e.rod(n,[-.8/2,.5,t],[a/2,.5,t],.016);e.rod(n,[-.3,.86,1.35],[.3,.86,1.35],.018),e.rod(`#141c1c`,[-.12,.86,1.35],[.12,.86,1.35],.022),e.rod(n,[0,o,i/2-.05],[0,0,.7],.014),e.collide([-.8/2-.1,0,-1.2/2],[.5,.88,1.4])}function ve(e,t={}){let n=t.sleeper??`#5d6a66`,r=t.rail??`#6a5a4a`,i=[5,5,4,4,3];i.forEach((t,r)=>{for(let a=0;a<t;a++){let o=e.sub([(a-(t-1)/2)*.24+r%2*.05,r*.145,r%2*.1+(e.r()-.5)*.12],(e.r()-.5)*.03);if(o.box(e.r()<.3?y(n,-.15):n,[-.1,0,-1],[.1,.14,1],{r:.012,seg:1,shadow:r===i.length-1||`receive`}),r===i.length-1)for(let e of[-.55,.55])o.box(`#1f2626`,[-.05,.14,e-.03],[.05,.143,e+.03],{shadow:!1})}}),e.collide([-.65,0,-1.1],[.65,i.length*.145,1.1]);for(let n=0;n<(t.rails??4);n++){let t=1.6+n*.16;e.box(r,[t-.065,0,0],[t+.065,.03,8],{shadow:!1}),e.box(r,[t-.01,.03,0],[t+.01,.11,8],{shadow:!1}),e.box(y(r,.2),[t-.033,.11,0],[t+.033,.15,8],{shadow:!1})}}export{S as A,K as C,z as D,L as E,E as F,b as M,O as N,R as O,M as P,q as S,te as T,ie as _,_e as a,Z as b,fe as c,le as d,ue as f,re as g,se as h,de as i,C as j,k,ve as l,ne as m,ge as n,$ as o,ae as p,he as r,pe as s,me as t,ce as u,oe as v,V as w,J as x,X as y};