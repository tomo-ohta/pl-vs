import{a as e,i as t,t as n}from"./main-CWXRxuAn.js";import{G as r,I as i,In as a,L as o,Ln as s,N as c,Rn as l,_t as u,a as d,bn as f,d as p,f as m,g as h,gn as g,h as _,hn as v,nt as y,r as b,t as x,tt as S,u as C,v as w,wn as T,xn as E}from"./Style-DOuyqAVF.js";import{n as D,t as O}from"./Builder-dhC2zwri.js";var k={uRects:{value:Array.from({length:10},()=>new l)},uRectH:{value:Array(10).fill(-1e3)},uRectL:{value:Array(10).fill(0)},uLampCol:{value:new w(`#bff0e0`)},uSkyCol:{value:new w(`#b8efe2`)},uOutCol:{value:new w(`#5d9c94`)},uInCol:{value:new w(`#0d2a2e`)},uFloorY:{value:0},uStHorizon:{value:new w(`#b4efe4`)},uStUpper:{value:new w(`#c4f8ea`)},uStZenith:{value:new w(`#d0fbee`)},uStGround:{value:new w(`#57a3a0`)},uStFogShape:{value:new l(.08,.025,.12,1.6)},uStGlowA:{value:new l(-1,.15,0,0)},uStGlowACol:{value:new w(`#ffffff`)},uStGlowB:{value:new l(-1,.15,0,6)},uStGlowBCol:{value:new w(`#000000`)},uStClouds:{value:0},uStHills:{value:0},uStStripRefl:{value:1},uStTubeCol:{value:new w(`#fff8d0`)},uStFieldGain:{value:1},uStTubeGlow:{value:new a(1,1)},uStStripGain:{value:1},uStPudLift:{value:0},uStLampMul:{value:1},uStWet:{value:0},uStFloorRefl:{value:1},uStDens:{value:new l(1,0,.1,2)}};function ee(e){for(let t=0;t<10;t++){let n=e[t];n?(k.uRects.value[t].set(Math.min(n.x0,n.x1),Math.min(n.z0,n.z1),Math.max(n.x0,n.x1),Math.max(n.z0,n.z1)),k.uRectH.value[t]=n.h,k.uRectL.value[t]=n.lamp??0):(k.uRectL.value[t]=0,k.uRects.value[t].set(0,0,0,0),k.uRectH.value[t]=-1e3)}}var A=`
uniform vec4 uRects[10];
uniform float uRectH[10];
uniform float uRectL[10];
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
  for (int i = 0; i < 10; i++) {
    float h = uRectH[i] - p.y;
    if (h > -0.8) occ += st_rect(p.xz, uRects[i], max(h, 0.05));
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}
// 下を見たとき、屋根の外（明るい所）が見える割合
float st_visDown(vec3 p) {
  float occ = 0.0;
  float h = max(p.y - uFloorY, 0.05);
  for (int i = 0; i < 10; i++) {
    if (uRectH[i] > p.y - 0.8) occ += st_rect(p.xz, uRects[i], h);
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
float st_roofShade(vec3 q) {
  float sh = 0.0;
  float s = max(uStFogShape.w, 1.2);
  q.y = uFloorY + abs(q.y - uFloorY);
  for (int i = 0; i < 10; i++) {
    vec4 r = uRects[i];
    float h = uRectH[i];
    if (h < -100.0) continue;
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
  for (int i = 0; i < 10; i++) {
    float h = uRectH[i];
    if (h < -100.0) continue;
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
  if (total > 1e-4) {
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
  // 縦の面は面の向きへずらした点で調べる（屋根の外を向いた面は明るい）
  vec3 q = p + vec3(n.x, 0.0, n.z) * 1.4;
  float vu = mix(st_visUp(q), st_visUp(p), abs(n.y));
  float vd = mix(st_visDown(q), st_visDown(p), abs(n.y));
  vec3 sky = uSkyCol * vu;
  vec3 gnd = mix(uInCol, uOutCol, vd);
  // 屋根の下の蛍光灯（屋根の範囲の中、屋根より下を一様に照らす）
  float lamp = 0.0;
  for (int i = 0; i < 10; i++) {
    if (uRectL[i] <= 0.0 || p.y > uRectH[i] + 0.3) continue;
    vec4 r = uRects[i];
    float d = min(min(p.x - r.x, r.z - p.x), min(p.z - r.y, r.w - p.z));
    lamp += uRectL[i] * smoothstep(-1.5, 1.0, d);
  }
  // 蛍光灯は下を向いた面（屋根の下面）を弱く照らす
  return sky * up + gnd * (1.0 - up) + uLampCol * lamp * uStLampMul * mix(0.4, 1.0, smoothstep(-0.6, 0.0, n.y));
}
`,j=0,M=`
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
}`;function N(r){let i={...r.defines??{}};r.unlit&&(i.ST_UNLIT=1),r.noFog&&(i.ST_NOFOG=1),r.map&&(i.ST_MAP=1),r.mottle&&(i.ST_MOTTLE=1);let o=new w(r.emissive??0).multiplyScalar(r.emissiveIntensity??1),s={...d,...k,uAlbedo:{value:new w(r.color)},uEmissive:{value:o},uGain:{value:r.gain??1},uMap:{value:r.map??null},uMottle:{value:new a(...r.mottle??[0,1])},uOpacity:{value:r.opacity??1},uId:{value:j++*.618034%1*.9+.05},uLineW:{value:r.line??0},uFogMul:{value:r.fogMul??1},uSheen:{value:r.sheen??0},...r.uniforms??{}},c=`
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
${e}
${t}
${n}
${A}
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
#ifdef ST_UNLIT
  vec3 col = albedo;
#else
  vec3 col = albedo * st_light(p, n) * uGain;
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
  st_fogMul = uFogMul;
  col = st_applyFog(col, p, cameraPosition);
#endif
${r.fragPostFog??``}
  gl_FragColor = vec4(col, alpha);
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  gInfo = vec4(vn.xy * 0.5 + 0.5, uId, uLineW * alpha);
}`;return new v({uniforms:s,defines:i,vertexShader:M,fragmentShader:c,side:r.side??0,transparent:r.transparent??!1,depthWrite:r.depthWrite??!0,vertexColors:r.vertexColors??!1})}function te(e){let t=Array.from({length:12},(t,n)=>new a(...e.stream[Math.min(n,e.stream.length-1)]??[0,0]));return N({color:e.color,uniforms:{uFDark:{value:new w(e.dark)},uFLight:{value:new w(e.light)},uStream:{value:t},uStreamN:{value:e.stream.length},uFKeep:{value:e.keep}},fragHead:`
uniform vec3 uFDark;
uniform vec3 uFLight;
uniform vec2 uStream[12];
uniform int uStreamN;
uniform float uFKeep;
uniform float uStFieldGain;
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
    // 筋の向き: 西の野原（D の先）・東の野原（station-2 の奥）は z 向き、線路沿いは x 向き
    float wz = max(smoothstep(-62.0, -80.0, xz.x), smoothstep(18.0, 30.0, xz.x) * smoothstep(20.0, 35.0, xz.y));
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
    float clump = sl_warp(vec3(xz * 0.07, 2.3), 4);
    float pat = big * 0.6 + streak * 1.1 + clump * 0.5 * lodM;
    fd_pat = big * 0.6 + streak * 1.1;
    vec3 c = pat < 0.0 ? mix(albedo, uFDark * uStFieldGain, clamp(-pat * 1.4, 0.0, 1.0)) : mix(albedo, uFLight * uStFieldGain, clamp(pat * 1.0, 0.0, 1.0));
    // 明るい草の房（筋の縁に多い）
    float edge = 1.0 - smoothstep(0.0, 0.12, abs(streak + 0.05));
    float tuft = sl_vnoise(vec3(xz * 1.7, 7.7)) * 0.5 + 0.5;
    c = mix(c, uFLight, smoothstep(0.6, 0.88, tuft) * (0.3 + edge * 0.7) * lodF);
    float tuftM = sl_vnoise(vec3(sq * 6.0, 9.3)) * 0.5 + 0.5;
    c = mix(c, uFLight, smoothstep(0.65, 0.92, tuftM) * edge * 0.6 * lodM);
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
    float blob = sl_warp(vec3(xz * 0.35, 8.8), 4);
    c = mix(c, uFDark * 0.75, smoothstep(0.12, 0.2, blob) * 0.55 * lodM);
    // 小川: 遠く（西）は空を映す白い線、近くは暗い溝と湿った縁
    if (uStreamN > 1) {
      vec2 ds = fd_stream(xz);
      float wob = sl_fbm(vec3(xz * 0.08, 5.5), 3);
      float w = mix(2.2, 1.4, ds.y) + wob * 0.8;
      float far = smoothstep(-165.0, -185.0, xz.x);
      float core = 1.0 - smoothstep(w * 0.5, w * 0.5 + max(fw, 0.2), ds.x);
      float wet = 1.0 - smoothstep(w * 0.6, w * 3.5 + wob * 3.0, ds.x);
      c = mix(c, uFDark * 0.6, wet * (1.0 - far) * 0.7);
      fd_pat -= wet * (1.0 - far) * 1.2;
      fd_water = core * far;
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
`})}function P(e){let t=Array.from({length:12},(t,n)=>{let r=e.strips[n];return r?new l(Math.min(r.u0,r.u1),Math.max(r.u0,r.u1),Math.min(r.v0,r.v1),Math.max(r.v0,r.v1)):new l(0,0,0,0)}),n=Array.from({length:12},(t,n)=>e.strips[n]?.kind??0),r=e.shapes??[],i=Array.from({length:16},(e,t)=>{let n=r[t];return n?new l(n.x,n.z,n.rx,n.rz):new l(0,0,0,0)}),o=Array.from({length:16},(e,t)=>r[t]?.rot??0),c={uFrame:{value:new s(e.frame.cx,e.frame.cz,+!!e.frame.alongX)},uStrips:{value:t},uStripKind:{value:n},uYellow:{value:new w(e.yellow??`#c8c062`)},uWhite:{value:new w(e.white??`#80aab0`)},uJoint:{value:e.joint??0},uYShift:{value:new l(...e.yShift??[0,1,0,0])},uPud:{value:new l(...e.puddle??[.3,.2,.3,3])},uPud2:{value:new a(...e.puddleVar??[.05,0])},uPE:{value:i},uPER:{value:o},uPEN:{value:r.length},uDry:{value:new s(...e.dryZone??[0,0,0])},uReflTex:{value:e.refl.target.texture},uReflMatrix:{value:e.refl.matrix},uRefl:{value:new s(e.wetRefl??1,e.dryRefl??.25,.85)},uStripRefl:{value:e.stripRefl??.6},uLookRefl:{value:e.lookRefl===!1?0:1},uReflTint:{value:new w(e.reflTint??`#a8f0ff`)}};return N({color:e.color,line:0,uniforms:c,fragHead:`
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
// 水たまりの形（正 = 水）。ノイズのしきい値と、手で置いた楕円の和
float fl_puddle(vec2 xz, float u, float v) {
  // 横（u）に長い塊（長手 v に細かく）
  float nz = sl_warp(vec3(vec2(u * 0.7, v * 1.3) * uPud.x, 0.37), 5);
  float th = uPud.y + uPud.z * smoothstep(0.3, 0.9, abs(u) / uPud.w) + sl_fbm(vec3(xz * uPud2.x, 2.1), 3) * uPud2.y;
  th += uDry.z * smoothstep(uDry.x - 2.0, uDry.x, v) * (1.0 - smoothstep(uDry.y, uDry.y + 2.0, v));
  float f = nz - th;
  // 手で置いた水たまりの縁と中の乾いた島（横に長い、ちぎれた形）
  float rag = sl_warp(vec3(vec2(u * 0.9, v * 2.6), 5.1), 4) * 0.8 + sl_vnoise(vec3(u * 3.0, v * 9.0, 8.3)) * 0.25;
  for (int i = 0; i < 16; i++) {
    if (i >= uPEN) break;
    vec4 e = uPE[i];
    vec2 d = xz - e.xy;
    float c = cos(uPER[i]);
    float s = sin(uPER[i]);
    d = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / e.zw;
    f = max(f, (1.0 - length(d)) * 0.4 + rag * 0.18 - 0.02);
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
      float f = fl_puddle(p.xz, u, v);
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
`})}function F(e,t,n,r,i,a,o={}){let c=new s(...n),l=new s(...r),u=l.clone().sub(c),d=u.length();u.normalize();let f=new s(...o.up??[0,1,0]);Math.abs(f.dot(u))>.99&&f.set(1,0,0);let p=new s().crossVectors(u,f).normalize(),m=new s().crossVectors(p,u).normalize(),h=new S().makeBasis(u,m,p),g=new C(d,a,i);g.applyMatrix4(h);let _=c.add(l).multiplyScalar(.5);return e.mesh(g,t,[_.x,_.y,_.z],o)}function I(e,t,n,r,i={}){let a=new h(n.map(e=>new s(...e)),!1,`catmullrom`,.2),o=new T(a,i.seg??Math.max(8,n.length*6),r,i.radial??6,!1);return e.mesh(o,t,[0,0,0],i)}function L(e,t,n,r,i,a,o=.3,s=.3,c={}){let l=a-i,u=(i+a)/2,d=Math.min(o,s)*.12,f=c.rotY??0,p=Math.cos(f),m=Math.sin(f),h=(e,t)=>[n+e*p+t*m,u,r-e*m+t*p];e.box(t,h(0,s/2-d/2),[o,l,d],{...c,rotY:f}),e.box(t,h(0,-s/2+d/2),[o,l,d],{...c,rotY:f}),e.box(t,h(0,0),[d,l,s-2*d],{...c,rotY:f})}function R(e,t,n,i){let a=new r(t,n,i.length);return i.forEach((e,t)=>a.setMatrixAt(t,e)),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),e.add(a),a}function z(e,t,n,r=0,i=1,a=1,o=1){return new S().compose(new s(e,t,n),new u().setFromEuler(new c(0,r,0)),new s(i,a,o))}function ne(e=7,t=1){let n=[],r=t,i=()=>(r=r*16807%2147483647,r/2147483647);for(let t=0;t<e;t++){let r=t/e*Math.PI*2+i()*.8,a=.15+i()*.35,o=.6+i()*.4,s=.035+i()*.02,c=Math.cos(r),l=Math.sin(r),u=-l*s,d=c*s;n.push(u,0,d,-u,0,-d,c*a,o,l*a)}let a=new m;a.setAttribute(`position`,new o(n,3)),a.computeVertexNormals();let s=a.getAttribute(`normal`);for(let e=0;e<s.count;e++)s.setXYZ(e,s.getX(e)*.3,1,s.getZ(e)*.3);return a.setAttribute(`uv`,new o(Array(n.length/3*2).fill(0),2)),a}function re(e,t,n,r,a,o,s,c,l,u,d={}){let f=new g;f.moveTo(0,o);for(let e=1;e<=16;e++){let t=e/16;f.lineTo(s*t,o+c*(1-(1-t)*(1-t)))}f.lineTo(s,l),f.lineTo(0,l),f.lineTo(0,o);let p=new i(f,{depth:u,bevelEnabled:!1});if(p.translate(0,0,-u/2),r<0&&p.scale(-1,1,1),r<0){let e=p.index;if(e)for(let t=0;t<e.count;t+=3){let n=e.getX(t+1);e.setX(t+1,e.getX(t+2)),e.setX(t+2,n)}else{let e=p.getAttribute(`position`),t=p.getAttribute(`normal`);for(let n=0;n<e.count;n+=3)for(let r of[e,t]){let e=r.getX(n+1),t=r.getY(n+1),i=r.getZ(n+1);r.setXYZ(n+1,r.getX(n+2),r.getY(n+2),r.getZ(n+2)),r.setXYZ(n+2,e,t,i)}}p.computeVertexNormals()}return e.mesh(p,t,[n,0,a],d)}var B=new C(1,1,1),V=class{mats=[];box(e,t,n=0){this.mats.push(z(e[0],e[1],e[2],n,t[0],t[1],t[2]))}mm(e,t){this.box([(e[0]+t[0])/2,(e[1]+t[1])/2,(e[2]+t[2])/2],[Math.abs(t[0]-e[0]),Math.abs(t[1]-e[1]),Math.abs(t[2]-e[2])])}build(e,t,n=0){if(!this.mats.length)return null;let i=new r(B,t,this.mats.length);return this.mats.forEach((e,t)=>i.setMatrixAt(t,e)),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),n&&i.layers.set(n),e.add(i),i}};function ie(e,t,n){let r=D(e.seed??1),i=e.along===`x`,a=i?e.x0:e.z0,o=i?e.x1:e.z1,s=i?e.z0:e.x0,c=i?e.z1:e.x1,l=e.y,u=(e,t,n)=>i?[e,t,n]:[n,t,e],d=(e,t,n)=>i?[e,t,n]:[n,t,e];if(e.rib&&e.rib[0]>0){let[n,r]=e.rib;for(let e=a+n/2;e<o;e+=n)t.box(u(e,l-r/2,(s+c)/2),d(.05,r,c-s))}for(let[n,r,i]of e.beams??[])t.box(u((a+o)/2,l-r/2,n),d(o-a,r,i));for(let[n,r,i]of e.cross??[])t.box(u(n,l-r/2,(s+c)/2),d(i,r,c-s));for(let[r,i,s]of e.trays??[]){let e=l-i;for(let t of[-1,1])n.box(u((a+o)/2,e,r+t*s/2),d(o-a,.06,.025));for(let n=a+.15;n<o;n+=.3)t.box(u(n,e-.02,r),d(.025,.02,s));for(let e=a+.6;e<o;e+=1.8)for(let n of[-1,1])t.box(u(e,l-i/2,r+n*s/2),d(.015,i,.015))}for(let[r,i,s]of e.pipes??[]){n.box(u((a+o)/2,l-i,r),d(o-a,s,s));for(let e=a+1;e<o;e+=2.4)t.box(u(e,l-i/2,r),d(.04,i,s*1.6))}if(e.boxes){let{n,size:i,drop:f,lanes:p}=e.boxes;for(let e=0;e<n;e++){let e=a+.5+r()*(o-a-1),n=p&&p.length?p[Math.floor(r()*p.length)]+(r()-.5)*.4:s+.5+r()*(c-s-1),m=i[0]+r()*(i[1]-i[0]),h=i[0]+r()*(i[1]-i[0]),g=f[0]+r()*(f[1]-f[0]);t.box(u(e,l-g-h/2,n),d(m,h,m*(.6+r()*.6))),t.box(u(e,l-g/2,n),d(.03,g,.03))}}if(e.hangers)for(let i=a+e.hangers/2;i<o;i+=e.hangers){let e=s+.4+r()*(c-s-.8),a=.15+r()*.35;t.box(u(i,l-a/2,e),d(.02,a,.02)),n.box(u(i,l-a-.03,e),d(.08,.06,.05))}}var ae=new S;function H(e,t,n,r,i,a,o=0){let s=t.clone();o&&s.applyMatrix4(ae.makeRotationX(o)),s.translate(...a),s.applyMatrix4(ae.makeRotationY(i)),e.mesh(s,n,r)}function U(e,t,n,r,i,a){let o=new T(new h(i.map(e=>new s(...e)),!1,`catmullrom`,.3),16,a,6,!1);o.applyMatrix4(ae.makeRotationY(r)),e.mesh(o,t,n)}function oe(e){let t=e.width,n=e.seatY??.43,r=e.backTop??.86,i=e.taper??.12,a=e.corner??.07,c=new h([[0,n-.04,-.22],[0,n,-.19],[0,n+.01,-.1],[0,n-.005,.04],[0,n,.14],[0,n+.05,.2],[0,n+.16,.235],[0,(n+r)/2+.08,.26],[0,r,.3]].map(e=>new s(e[0],e[1],e[2])),!1,`catmullrom`,.4),l=c.getSpacedPoints(24),u=c.getLength(),d=[],f=[];for(let e=0;e<=24;e++){let o=l[e],s=(1-e/24)*u,c=t/2*(1+i*Math.max(0,(o.y-(n+.1))/(r-n))),f=s<a?c-a+Math.sqrt(Math.max(0,a*a-(a-s)*(a-s))):c;for(let e=0;e<=8;e++){let t=-f+2*f*e/8,n=.012*(2*e/8-1)**2;d.push(t,o.y+n,o.z)}}for(let e=0;e<24;e++)for(let t=0;t<8;t++){let n=e*9+t,r=n+8+1;f.push(n,r,n+1,n+1,r,r+1)}let p=new m;return p.setAttribute(`position`,new o(d,3)),p.setAttribute(`uv`,new o(Array(d.length/3*2).fill(0),2)),p.setIndex(f),p.computeVertexNormals(),p.toNonIndexed()}function W(e,t,n,r,i,a,o=.56){let s=a*o,c=oe({width:o-.07,backTop:.84,taper:.1,corner:.06});for(let n=0;n<a;n++)H(e,c,t,r,i,[-s/2+o*(n+.5),0,0]);H(e,new C(s-.1,.04,.04),n,r,i,[0,.37,-.02]),H(e,new C(s-.1,.04,.04),n,r,i,[0,.37,.17]);let l=Math.max(2,Math.round(s/1.8)+1);for(let t=0;t<l;t++){let a=-s/2+.2+(s-.4)*t/(l-1);H(e,new C(.05,.36,.05),n,r,i,[a,.18,.08]),H(e,new C(.04,.03,.46),n,r,i,[a,.015,.06]),H(e,new C(.04,.04,.3),n,r,i,[a,.37,.08])}}function se(e,t,n,r,i){let a=oe({width:.53,seatY:.42,backTop:.86,taper:.1,corner:.08});for(let n of[-.28,.28])H(e,a,t,r,i,[n,0,0]);H(e,new C(1.2,.035,.035),n,r,i,[0,.37,.05]),H(e,new C(1.2,.035,.035),n,r,i,[0,.37,-.12]);for(let t of[-.55,.55]){let a=Math.sign(t);U(e,n,r,i,[[t,0,-.16],[t,.2,-.13],[t,.38,-.08]],.016),U(e,n,r,i,[[t,0,.2],[t,.2,.17],[t,.38,.1]],.016),H(e,new C(.03,.02,.4),n,r,i,[t,.01,.02]),U(e,n,r,i,[[t+a*.03,.4,.16],[t+a*.06,.55,.12],[t+a*.065,.6,0],[t+a*.065,.58,-.14],[t+a*.04,.44,-.2]],.016)}}function ce(e,t,n,r,i,a=1.8){let o=new h([[0,.4,-.22],[0,.43,-.1],[0,.42,.08],[0,.46,.2],[0,.62,.27],[0,.8,.33],[0,.92,.38]].map(e=>new s(e[0],e[1],e[2])));for(let n=0;n<=10;n++){if(n===4)continue;let s=n/10,c=o.getPointAt(s),l=o.getTangentAt(s),u=Math.atan2(l.y,l.z);H(e,new C(a,.02,.075),t,r,i,[0,c.y,c.z],-u)}for(let t of[-a/2+.15,a/2-.15])U(e,n,r,i,[[t,0,-.28],[t,.2,-.16],[t,.4,-.05]],.022),U(e,n,r,i,[[t,0,.32],[t,.2,.2],[t,.4,.06]],.022),U(e,n,r,i,[[t,.39,-.2],[t,.41,.1],[t,.58,.25],[t,.9,.36]],.02)}var G={top:0,rail:-.92,ballast:-1.06,ground:-1.15},K={half:3.2,z0:-150,z1:78},q={t1:-5.3,t2:5.3,t0:-12.35,t3:12.35,gauge:1.067},J={z0:-12.4,z1:11.6,half:11.9,colX:10.6,soffit:4.5,knee:3.9},Y={z0:11.6,z1:37,half:3.9,center:3.3,edge:4},X={xIn:3.9,xOut:10.5,z0:45.3,z1:57.5},Z={xEnd:-64,x1:-26,zc:0,half:7.2,soffit:3.9},Q={x:10.8,z0:-24,step:18,n:9};function le(r){let i=new E(900,48,24),a=new v({uniforms:{...d,...k,uCloudColor:{value:new w(r.cloudColor)},uHillColor:{value:new w(r.hillColor)}},vertexShader:`
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
      ${A}
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
      }`,side:1,depthWrite:!1}),o=new y(i,a);return o.name=`station-sky`,o.renderOrder=-1e3,o.frustumCulled=!1,o.onBeforeRender=(e,t,n)=>{o.position.setFromMatrixPosition(n.matrixWorld),o.updateMatrixWorld(),r.looks.apply(o.position.x,o.position.z)},o}function ue(r,i){let a=r.length,o=new Float32Array(a*4*3),c=new Float32Array(a*4*4),l=new Float32Array(a*4*2),u=[];r.forEach((e,t)=>{for(let n=0;n<4;n++){let r=t*4+n;o.set(e.c,r*3),c.set([...e.axis,e.len/2],r*4),l.set([n&1?1:-1,n&2?1:-1],r*2)}let n=t*4;u.push(n,n+1,n+2,n+2,n+1,n+3)});let h=new m;h.setAttribute(`position`,new p(o,3)),h.setAttribute(`aAxis`,new p(c,4)),h.setAttribute(`aCorner`,new p(l,2)),h.setIndex(u),h.boundingSphere=new f(new s,1e5);let g=new v({uniforms:{...d,...k,uR:{value:i.radius},uColor:{value:new w(i.color).multiplyScalar(i.strength)}},vertexShader:`
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
      }`,transparent:!0,blending:2,depthWrite:!1}),_=new y(h,g);return _.name=`tube-glow`,_.frustumCulled=!1,_.renderOrder=10,_}var de=[`horizon`,`upper`,`zenith`,`ground`,`glowA`,`glowB`,`sky`,`out`,`in`];function fe(e){let t=(e,t=1)=>new w(e).multiplyScalar(t);return{at:e.at,cols:[t(e.horizon),t(e.upper),t(e.zenith),t(e.ground),t(e.glowA.color,e.glowA.strength),t(e.glowB.color,e.glowB.strength),t(e.sky),t(e.out),t(e.in)],vecs:[new l(...e.shape),new l(...e.glowA.dir,e.glowA.power),new l(...e.glowB.dir,e.glowB.power)],dens:e.dens,lift:e.lift,clouds:e.clouds,blockFog:e.blockFog,start:e.start,floorRefl:e.floorRefl,hills:e.hills,stripRefl:e.stripRefl,tubeGlow:e.tubeGlow,fieldGain:e.fieldGain,tubeColor:new w(e.tubeColor).multiplyScalar(e.tubePower),wet:e.wet,lampMul:e.lampMul,pudLift:e.pudLift,stripGain:e.stripGain}}var pe=class{packed;tc=de.map(()=>new w);tv=[new l,new l,new l];lastX=NaN;lastZ=NaN;constructor(e){this.packed=e.map(fe)}apply(e,t){if(e===this.lastX&&t===this.lastZ)return;this.lastX=e,this.lastZ=t;let n=this.packed.map(n=>1/(1+(Math.hypot(e-n.at[0],t-n.at[1])/5)**6)),r=n.reduce((e,t)=>e+t,0);this.tc.forEach(e=>e.setRGB(0,0,0)),this.tv.forEach(e=>e.set(0,0,0,0));let i=0,a=0,o=0,s=0,c=0,l=0,u=0,d=0,f=[0,0],p=0,m=new w(0,0,0),h=0,g=0,_=0,v=0;this.packed.forEach((e,t)=>{let y=n[t]/r;e.cols.forEach((e,t)=>{this.tc[t].r+=e.r*y,this.tc[t].g+=e.g*y,this.tc[t].b+=e.b*y}),e.vecs.forEach((e,t)=>this.tv[t].addScaledVector(e,y)),i+=e.dens*y,a+=e.lift*y,o+=e.clouds*y,s+=e.blockFog*y,c+=e.start*y,l+=e.floorRefl*y,u+=e.hills*y,d+=e.stripRefl*y,f[0]+=e.tubeGlow[0]*y,f[1]+=e.tubeGlow[1]*y,p+=e.fieldGain*y,m.r+=e.tubeColor.r*y,m.g+=e.tubeColor.g*y,m.b+=e.tubeColor.b*y,h+=e.wet*y,g+=e.lampMul*y,_+=e.pudLift*y,v+=e.stripGain*y});let[y,b,x,S,C,T,E,D,O]=this.tc;k.uStHorizon.value.copy(y),k.uStUpper.value.copy(b),k.uStZenith.value.copy(x),k.uStGround.value.copy(S),k.uStGlowACol.value.copy(C),k.uStGlowBCol.value.copy(T),k.uSkyCol.value.copy(E),k.uOutCol.value.copy(D),k.uInCol.value.copy(O),k.uStFogShape.value.copy(this.tv[0]),k.uStGlowA.value.copy(this.tv[1]),k.uStGlowB.value.copy(this.tv[2]),k.uStDens.value.set(i,a,s,c),k.uStClouds.value=o,k.uStFloorRefl.value=l,k.uStHills.value=u,k.uStStripRefl.value=d,k.uStTubeGlow.value.set(f[0],f[1]),k.uStFieldGain.value=p,k.uStTubeCol.value.copy(m),k.uStWet.value=h,k.uStLampMul.value=g,k.uStPudLift.value=_,k.uStStripGain.value=v}},me=[{at:[-48.3,0],horizon:`#b6f0e6`,upper:`#c2f8ec`,zenith:`#ccfbef`,ground:`#86d0cc`,shape:[.06,.035,.15,3],glowA:{dir:[-1,.1,0],power:6,color:`#ffffff`,strength:0},glowB:{dir:[-1,.12,0],power:8,color:`#fff4d0`,strength:0},sky:`#5ccfe0`,out:`#1c6070`,in:`#1e6680`,dens:1,lift:.009,clouds:0,blockFog:.1,start:2,floorRefl:1,stripRefl:0,tubeGlow:[.5,.8],fieldGain:1,tubeColor:`#e8fcd8`,tubePower:2.4,wet:0,lampMul:1,pudLift:0,stripGain:1,hills:0},{at:[0,0],horizon:`#98d4c6`,upper:`#98dccd`,zenith:`#9adccd`,ground:`#78b6ae`,shape:[.12,.012,.15,2],glowA:{dir:[-.35,.15,-.92],power:3,color:`#a29889`,strength:1},glowB:{dir:[-.6,.15,-.78],power:8,color:`#3a2a00`,strength:1},sky:`#74d6e2`,out:`#2a8590`,in:`#04161e`,dens:1,lift:.008,clouds:0,blockFog:.1,start:2,floorRefl:8,stripRefl:8,tubeGlow:[1.6,1.6],fieldGain:.7,tubeColor:`#fffcc4`,tubePower:1.15,wet:0,lampMul:1,pudLift:.12,stripGain:1,hills:0},{at:[-23.7,51.4],horizon:`#82cfcc`,upper:`#a0e0d8`,zenith:`#e2f6e8`,ground:`#3f9d9b`,shape:[.16,.02,.1,1.6],glowA:{dir:[1,.55,0],power:5,color:`#24200c`,strength:1},glowB:{dir:[-1,.12,0],power:8,color:`#fff4d0`,strength:0},sky:`#6cd8c8`,out:`#226e6a`,in:`#062420`,dens:.9,lift:.012,clouds:0,blockFog:.1,start:9,floorRefl:1,stripRefl:.5,tubeGlow:[7,2.6],fieldGain:1,tubeColor:`#fff8d8`,tubePower:2.4,wet:0,lampMul:1,pudLift:0,stripGain:1,hills:.35},{at:[0,12],horizon:`#aee8ea`,upper:`#d4fdf9`,zenith:`#ecfffc`,ground:`#5a9ea4`,shape:[.12,.07,.92,1.6],glowA:{dir:[-1,.15,.3],power:4,color:`#204840`,strength:1},glowB:{dir:[-.6,.2,.8],power:6,color:`#203830`,strength:1},sky:`#5cc0d0`,out:`#2a7684`,in:`#051520`,dens:.8,lift:.004,clouds:1,blockFog:.16,start:2,floorRefl:8,stripRefl:4,tubeGlow:[1,1],fieldGain:.6,tubeColor:`#ecfae0`,tubePower:2.4,wet:.4,lampMul:.3,pudLift:.25,stripGain:1.8,hills:0}],he=[.6,.26,.35,K.half],ge=[{x:.1,z:-6.8,rx:.85,rz:1.9},{x:-.6,z:-4.25,rx:.65,rz:.32},{x:1.35,z:-4.15,rx:.8,rz:.55},{x:.5,z:-3.3,rx:.4,rz:.17},{x:1.7,z:-5.2,rx:.55,rz:.4},{x:2,z:-7.8,rx:.3,rz:.4},{x:0,z:-10,rx:1,rz:.4},{x:0,z:-10.8,rx:.9,rz:1.1},{x:1.7,z:22.8,rx:.55,rz:4.8},{x:1,z:19.4,rx:.32,rz:1},{x:1,z:25.8,rx:.3,rz:1.4},{x:-1.75,z:25.2,rx:.45,rz:2.2}],_e=[{x:0,z:30,rx:.32,rz:1.8},{x:-1,z:28.8,rx:.3,rz:.9}],ve=[{x:-61.2,z:-2.2,rx:1.1,rz:1.35},{x:-56.4,z:2.9,rx:.45,rz:.55},{x:-56.45,z:-.95,rx:.5,rz:.5},{x:-61.3,z:3.1,rx:.65,rz:1}],ye=`
  albedo *= mix(0.3, 1.0, smoothstep(0.3, 2.2, p.y)) * mix(1.0, 0.4, smoothstep(2.2, 3.3, p.y));
`;function be(e){let t=new O(e),n=e=>N(e),r=D(7),i={concrete:n({color:`#1a2e40`,mottle:[.12,1.3]}),coping:n({color:`#2e4e54`}),roof:n({color:`#3a6878`}),beam:n({color:`#3e6c7c`}),steel:n({color:`#3d6e7c`}),pedestal:n({color:`#3f6a74`,mottle:[.1,2]}),bench:n({color:`#1a6878`,emissive:`#04222c`,emissiveIntensity:1,side:2,sheen:.3}),frameD:n({color:`#2a6670`,emissive:`#0a3c44`,emissiveIntensity:1}),benchB:n({color:`#123238`,sheen:.2}),benchT:n({color:`#1e4450`,side:2,sheen:.6}),benchD:n({color:`#2a6670`,emissive:`#0a3c44`,emissiveIntensity:1,side:2,sheen:.3}),housing:n({color:`#3a5a5e`}),tube:n({color:`#000000`,unlit:!0,fragAlbedo:`  emis = uStTubeCol * (0.65 + 0.45 * abs(dot(n, normalize(cameraPosition - p))));`}),sign:n({color:`#1d3a40`}),rail:n({color:`#24383c`}),railTop:n({color:`#a8c8c6`,gain:1}),clip:n({color:`#3a5c60`,gain:1}),sleeper:n({color:`#25393a`,mottle:[.15,3]}),ballast:n({color:`#0e1a20`,mottle:[.35,6]}),ballastA:n({color:`#4a8088`,mottle:[.35,6],fragAlbedo:`  albedo *= mix(1.0, 0.4, smoothstep(4.0, 14.0, p.z));`}),field:te({color:`#8ab6ae`,dark:`#4c766a`,light:`#b4d8b8`,stream:[[-480,200],[-383,131],[-306,66],[-258,29],[-212,5],[-187,-3],[-152,-6],[-119,-9.5],[-99,-11.4],[-86,-12],[-70,-12.6]],keep:2}),far:n({color:`#3d5e5c`}),farHaze:n({color:`#2a5a5c`,fogMul:.26}),booth:n({color:`#1e4a50`}),glass:n({color:`#5a9890`,gain:1}),wire:n({color:`#2a4a50`}),steelD:n({color:`#6a9aa0`,gain:5.5,fragAlbedo:ye}),pedestalD:n({color:`#3a6a7a`,gain:5,fragAlbedo:ye}),roofB:n({color:`#3a96a0`}),columnB:n({color:`#1a4a54`,fragAlbedo:`  albedo *= mix(0.6, 1.0, smoothstep(0.5, 2.0, p.y)) * mix(1.0, 0.7, smoothstep(2.4, 3.4, p.y));`}),columnBase:n({color:`#164a50`}),columnEdge:n({color:`#3a7a80`}),bcFunnel:n({color:`#24646c`}),shelterDark:n({color:`#2a5a60`}),lampBox:n({color:`#000000`,unlit:!0,emissive:`#f4f0c0`,emissiveIntensity:1.3}),beamB:n({color:`#2a6466`}),roofT:n({color:`#2c4c70`}),columnT:n({color:`#3a7488`,emissive:`#16505e`,emissiveIntensity:1,sheen:.3}),endT:n({color:`#1a3848`,fogMul:.55}),shedCol:n({color:`#24505a`}),shedColL:n({color:`#3a7480`,emissive:`#103a42`,emissiveIntensity:1}),lattice:n({color:`#4a8088`,emissive:`#14424a`,emissiveIntensity:1}),underDark:n({color:`#1c3646`}),bcUnderDark:n({color:`#2a7078`}),ticket:n({color:`#1c4a4e`}),ticketScreen:n({color:`#000000`,unlit:!0,emissive:`#9ad0c8`,emissiveIntensity:.8}),doorFrame:n({color:`#4a8a84`}),doorLeaf:n({color:`#1a4c50`}),fasciaN:n({color:`#8ab4a0`,emissive:`#2a4a40`,emissiveIntensity:1}),bcValance:n({color:`#2a6a72`}),bcUnderLite:n({color:`#4a9aa0`}),underLite:n({color:`#3a6a7a`}),hookT:n({color:`#5aa0a8`,emissive:`#0a2a30`,emissiveIntensity:1}),beamT:n({color:`#2a4a68`}),steelT:n({color:`#2a4c58`}),housingT:n({color:`#3a5a5e`}),tubeT:n({color:`#000000`,unlit:!0,fragAlbedo:`  emis = uStTubeCol;`}),board:n({color:`#b6d6d0`}),frontS:n({color:`#2a5a64`,emissive:`#16383e`,emissiveIntensity:1}),frontD:n({color:`#2a6a74`,emissive:`#28626a`,emissiveIntensity:1}),signLight:n({color:`#94b4aa`,unlit:!0}),signal:n({color:`#c06050`,unlit:!0})},a=new V,o=new V,s=new V,c=new V,l=new V,u=new V,d=[],f=(e,n,r,a,o=.04,s=!1)=>{if(s){let o=new _(a/2,Math.max(n-a,.01),4,10);r===`x`?o.rotateZ(Math.PI/2):o.rotateX(Math.PI/2),t.mesh(o,i.tube,e,{shadow:!1})}else t.box(i.tube,e,r===`x`?[n,o,a]:[a,o,n],{shadow:!1});d.push({c:e,axis:r===`x`?[1,0,0]:[0,0,1],len:n})};ee([{x0:-J.half,z0:J.z0-.2,x1:J.half,z1:J.z1,h:J.soffit,lamp:.05},{x0:-Y.half,z0:Y.z0,x1:Y.half,z1:Y.z1,h:(Y.center+Y.edge)/2,lamp:.02},{x0:-10.1,z0:46.5,x1:-2,z1:56.05,h:3.56,lamp:1.5},{x0:2,z0:46.5,x1:10.1,z1:56.05,h:3.56,lamp:1.5},{x0:Z.xEnd+.5,z0:Z.zc-Z.half+.2,x1:-30,z1:Z.zc+Z.half-.2,h:Z.soffit,lamp:.015}]);let p=e.addReflector({x:0,y:G.top,z:0},void 0,.5);t.root.add(le({cloudColor:`#aae6ec`,hillColor:`#4a9a9c`,looks:new pe(me)})),t.plane(i.field,[0,G.ground,0],1600,1600,`y`,{merge:!1}),e.colliders.add({x:-800,y:G.ground-1,z:-800},{x:800,y:G.ground,z:800});let m=(n,r,a,o,s)=>{t.boxMM(i.concrete,[n+.12,G.ground,a+.12],[r-.12,-.16,o-.12]),t.boxMM(i.coping,[n,-.16,a],[r,-.005,o]);let c=t.plane(s,[(n+r)/2,G.top,(a+o)/2],r-n,o-a,`y`,{merge:!1});p.hide.push(c),e.colliders.add({x:n,y:G.ground,z:a},{x:r,y:G.top,z:o})},h=(e,t,n)=>[{u0:-e,u1:-e+.48,v0:t,v1:n,kind:2},{u0:e-.48,u1:e,v0:t,v1:n,kind:2},{u0:-e+.68,u1:-e+1,v0:t,v1:n,kind:1},{u0:e-1,u1:e-.68,v0:t,v1:n,kind:1}],g=P({color:`#2a5c7a`,frame:{cx:0,cz:0,alongX:!1},strips:[...h(K.half,K.z0,K.z1),{u0:.05,u1:.08,v0:K.z0,v1:K.z1,kind:5}],refl:p,joint:0,yShift:[-4,17,.24,0],reflTint:`#78e4f0`,puddle:he,puddleVar:[.04,.12],shapes:[...ge,..._e],dryZone:[-4.5,40,.8],dryRefl:.1});m(-K.half,K.half,K.z0,K.z1,g);let v=P({color:`#3a8a8c`,frame:{cx:-(X.xIn+X.xOut)/2,cz:0,alongX:!1},strips:h((X.xOut-X.xIn)/2,X.z0,X.z1),refl:p,puddle:[.3,.6,.3,(X.xOut-X.xIn)/2],dryRefl:.3,lookRefl:!1});m(-X.xOut,-X.xIn,X.z0,X.z1,v);let y=P({color:`#3a8a8c`,frame:{cx:(X.xIn+X.xOut)/2,cz:0,alongX:!1},strips:h((X.xOut-X.xIn)/2,X.z0,X.z1),refl:p,puddle:[.3,.6,.3,(X.xOut-X.xIn)/2],dryRefl:.3,lookRefl:!1});m(X.xIn,X.xOut,X.z0,X.z1,y);let b=[...h(Z.half,Z.xEnd,Z.x1).map(e=>({...e,v0:Z.xEnd-Z.xEnd,v1:Z.x1-Z.xEnd})),{u0:-Z.half,u1:Z.half,v0:0,v1:.12,kind:4},{u0:-Z.half+.5,u1:Z.half-.5,v0:6,v1:6.75,kind:3},{u0:-.32,u1:.32,v0:6.75,v1:30,kind:1}],x=P({color:`#2a5a7c`,frame:{cx:Z.xEnd,cz:Z.zc,alongX:!0},strips:b,refl:p,puddle:[.6,.22,.35,Z.half],puddleVar:[.04,.12],shapes:ve,dryRefl:.2,wetRefl:.4,yellow:`#86a088`});m(Z.xEnd,Z.x1,Z.zc-Z.half,Z.zc+Z.half,x),t.boxMM(i.ballast,[-28,G.ground,30],[-21,-.55,80],{collide:!0}),t.boxMM(i.ballast,[-21,G.ground,48],[-20.6,-.85,55],{collide:!0}),t.box(n({color:`#3aa8b0`,gain:1.2}),[-X.xOut-.13,-.42,50.02],[.03,.32,.43]);let S=(e,n,r,a,o)=>{for(let s=0;s<6;s++){let c=G.top-(s+1)*(G.top-G.ground)/7,l=s*.3,u=e+r*(l+.15),d=n+a*(l+.15),f=r===0?o:.3,p=a===0?o:.3;t.boxMM(i.concrete,[u-f/2,G.ground,d-p/2],[u+f/2,c,d+p/2],{collide:!0})}};S(0,K.z1,0,1,2.4),S(0,K.z0,0,-1,2.4),S(-(X.xIn+X.xOut)/2,X.z1,0,1,2),S((X.xIn+X.xOut)/2,X.z1,0,1,2),S(Z.x1,Z.zc,1,0,2.4);let w=new C(2,.14,.22),T=[],E=[],k=(e,n,r,a=i.ballast)=>{t.boxMM(a,[e-2.1,G.ground-.1,n],[e+2.1,G.ballast-.02,r],{shadow:!1});for(let a of[-1,1]){let o=e+a*q.gauge/2;t.boxMM(i.rail,[o-.035,G.ballast,n],[o+.035,G.rail-.012,r],{shadow:!1}),t.boxMM(i.railTop,[o-.033,G.rail-.012,n],[o+.033,G.rail,r],{shadow:!1});for(let e=n+.3;e<r;e+=.6)for(let t of[-.09,.09])E.push(z(o+t,G.ballast+.02,e,0,1,1,1))}for(let t=n+.3;t<r;t+=.6)T.push(z(e,G.ballast-.07,t))};k(q.t1,-330,X.z0-2,i.ballastA),k(q.t2,-330,X.z0-2,i.ballastA),k(q.t0,X.z0,330),k(q.t3,X.z0,330),R(t.root,w,i.sleeper,T),R(t.root,new C(.09,.05,.12),i.clip,E);for(let e of[q.t1,q.t2])t.boxMM(i.steel,[e-.9,G.ballast,X.z0-2.3],[e+.9,G.ballast+.9,X.z0-2],{collide:!0});{let n=J.z0,r=J.z1,a=J.soffit;t.boxMM(i.roof,[-J.half,a+.3,n-.2],[J.half,a+.5,r]),t.boxMM(i.frontS,[-J.half,a-.02,n-.2],[J.half,a+.5,n+.1]);for(let e=n+3;e<r;e+=3)t.boxMM(i.beam,[-J.colX,a,e-.12],[J.colX,a+.3,e+.12]);for(let e=n+1;e<r;e+=1)t.boxMM(i.beam,[-J.colX,a+.2,e-.04],[J.colX,a+.3,e+.04]);for(let e of[-7.5,-4.6,-1.6,1.6,4.6,7.5])t.boxMM(i.beam,[e-.08,a+.15,n],[e+.08,a+.3,r]);for(let o of[n,(n+r)/2,r])for(let n of[-1,1]){let r=n<0?-J.colX:J.colX+.45;L(t,n<0?i.shedColL:i.shedCol,r,o,G.ground+.45,a+.3,n<0?.34:.26,.3),t.box(i.pedestal,[r,G.ground+.22,o],[.9,.45,.9],{collide:!0}),e.colliders.addCentered(r,1.5,o,.4,5,.4),n<0?(F(t,i.shedCol,[r+.1,3.4,o],[r+2.2,a-.05,o],.3,.38),re(t,i.shedCol,r-n*.17,-n,o,3.2,.5,.45,3.9,.3)):F(t,i.shedCol,[r-.1,3.45,o],[r-1.4,a-.05,o],.16,.2),t.boxMM(i.beam,[Math.min(r+n*.6,n*6.5),a-.1,o-.15],[Math.max(r+n*.6,n*6.5),a+.5,o+.15])}for(let e of[-3.5,3.75])for(let o=n+.2;o<r-1;o+=2.65)t.box(i.housing,[e,a-.02,o],[.34,.1,1.45],{shadow:!1}),f([e,a-.1,o],1.25,`z`,.2,.04,!0),t.box(i.board,[e,a-.06,o+.68],[.36,.12,.12],{shadow:!1});ie({x0:-J.colX,x1:J.colX,z0:n+.2,z1:r,y:a+.3,along:`z`,rib:[.25,.06],trays:[[.7,.25,.35],[-5.9,.2,.3]],pipes:[[-2.6,.18,.06],[2.45,.22,.05],[6.1,.15,.08]],boxes:{n:14,size:[.25,.6],drop:[.05,.3],lanes:[-2.4,.4,2,5.5,-6.5]},hangers:.9,seed:11},s,c),s.box([1.9,a-.05,-7],[1,.45,.9]),s.box([1,a-0,-6.6],[1.6,.2,.25]);for(let e of[-3.45,3.9]){t.box(i.frontS,[e,4.2,n+.25],[1.07,.28,.08],{shadow:!1});for(let r of[-.4,.4])t.box(i.steel,[e+r,4.4,n+.25],[.02,.12,.02])}for(let e of[-1.9,-1.2,-.3,.5,1.1,2.4])t.cyl(i.beam,[e,a-.12,n+0],.13,.2,{segments:10});{let e=n+.8;for(let n of[-.07,.07])t.box(i.lattice,[-9.2+n,1.25,e],[.04,4.8,.04]);for(let n=G.ground;n<3.6;n+=.32)F(t,i.lattice,[-9.27,n,e],[-9.129999999999999,n+.32,e],.02,.02);t.box(i.sign,[-9.95,1,n+.15],[.45,.55,.3]),t.box(i.signal,[-10.35,.15,n+.25],[.12,.3,.05]),t.box(i.sign,[10.5,1,n+.2],[.25,.3,.25]),t.box(i.sign,[10.55,2.35,n+.2],[.25,.3,.25])}}{let n=Y.z0,r=Y.z1,s={};t.boxMM(i.beamT,[-.35,Y.center-.35,n],[.35,Y.center+.05,r],s);for(let e of[-1,1]){F(t,i.roofT,[0,Y.center+.05,(n+r)/2],[e*Y.half,Y.edge+.04,(n+r)/2],r-n,.14,s),t.boxMM(i.beamT,[e>0?Y.half-.1:-Y.half,Y.edge-.18,n],[e>0?Y.half:-Y.half+.1,Y.edge+.14,r],s);for(let a=n+6.4;a<r-.5;a+=4.15){let n=e*(Y.half-.12),r=Y.edge-.15;I(t,i.hookT,[[n,r,a],[n+e*.02,r-.3,a],[n-e*.12,r-.42,a],[n-e*.6,r-.43,a],[n-e*1,r-.43,a]],.03,s),t.box(i.hookT,[n-e*1,r-.52,a],[.05,.18,.05],s)}for(let a=n+2;a<r;a+=4)F(t,i.beamT,[0,Y.center-.1,a],[e*(Y.half-.1),Y.edge-.12,a],.12,.22,s);for(let a of[.3,.55]){let o=e*Y.half*a,c=Y.center+(Y.edge-Y.center)*a-.12;t.boxMM(i.beamT,[o-.07,c-.2,n],[o+.07,c+.1,r],s)}}for(let e of[-1,1]){for(let[t,i]of[[.18,.05],[.5,.035],[.86,.04]]){let o=e*Y.half*t,s=Y.center+(Y.edge-Y.center)*t-.22;a.box([o,s,(n+r)/2],[i,i,r-n-.4])}for(let t=n+.9;t<r;t+=1.3){let n=.2+t*7.31%1*.6,r=e*Y.half*n,i=Y.center+(Y.edge-Y.center)*n-.1;a.box([r,i-.12,t],[.02,.24,.02]),o.box([r,i-.26,t],[.07,.05,.05])}}for(let n of[20.5,28.5,36.4])L(t,i.columnT,0,n,G.top,Y.center-.35,.15,.15),e.colliders.addCentered(0,1.5,n,.25,3,.25);for(let e of[-1,1])F(t,i.beamT,[0,2.3,36.4],[e*1.3,2.85,36.4],.1,.1,s);t.boxMM(i.beamT,[-.95,2.85,19],[-.1,3.42,20.2],s),t.boxMM(i.beamT,[-1.8,2.3,23.6],[-.25,3.35,25],s);for(let e of[-1.6,-.5])t.box(i.beamT,[e,3.45,24.3],[.04,.3,.04],s);for(let e of[-1,1])F(t,i.beamT,[0,Y.center-.1,r-.05],[e*Y.half,Y.edge,r-.05],.1,.3,s);t.boxMM(i.endT,[-3.8,2.65,r-.3],[3,Y.center,r-.1],s),t.boxMM(i.endT,[-3,2.4,r-1.6],[-1.1,2.65,r-.3],s),t.boxMM(i.endT,[.6,2.75,r-2.6],[2.4,2.95,r-.3],s);for(let e of[-2.95,2.95])for(let n=21.4;n<r-.8;n+=4.15){t.box(i.housingT,[e,3.66,n],[.34,.06,1.7],{shadow:!1});for(let r of[-.08,.08])t.box(i.tubeT,[e+r,3.6,n],[.05,.04,1.55],{shadow:!1});d.push({c:[e,3.6,n],axis:[0,0,1],len:1.55})}}{let e=n({color:`#183444`,unlit:!0,fogMul:.7,transparent:!0,depthWrite:!0,fragAlbedo:`  alpha *= smoothstep(36.0, 28.0, cameraPosition.z);`}),r={layer:2,shadow:!1},i=Y.z1;for(let n of[-1,1]){F(t,e,[0,Y.center+.05,(i+46)/2],[n*Y.half,Y.edge+.04,(i+46)/2],46-i,.14,r),t.boxMM(e,[n>0?Y.half-.1:-Y.half,Y.edge-.18,i],[n>0?Y.half:-Y.half+.1,Y.edge+.14,46],r);let a=1.9/Y.half;F(t,e,[0,Y.center+.05,98],[n*1.9,Y.center+(Y.edge-Y.center)*a+.04,98],104,.14,r)}t.boxMM(e,[-.35,Y.center-.35,i],[.35,Y.center+.05,150],r)}for(let e of[-1,1]){let n=e*6.55,r=51.4,a=3.56,o=3.68,s=e<0?-10.1:2,c=e<0?-2:10.1,d=46.5,p=56.05;t.box(i.columnBase,[n,.6,r],[.6,1.2,.6],{collide:!0}),t.box(i.columnBase,[n,1.22,r],[.64,.05,.64]),t.box(i.columnB,[n,4.76/2,r],[.36,2.3600000000000003,.36],{collide:!0}),t.box(i.columnEdge,[n-.17,4.8100000000000005/2,51.23],[.03,2.31,.03]),t.cyl(i.bcFunnel,[n,3.2600000000000002,r],.28,.6,{radiusTop:1.5,segments:4,rotY:Math.PI/4});for(let e of[-1,1])F(t,i.columnB,[n,2.1,r],[n+e*2.2,3.5,r],.12,.16),F(t,i.columnB,[n,2.35,r],[n,3.5,r+e*1.9],.12,.16,{up:[1,0,0]}),F(t,i.columnB,[n,2.75,r],[n,3.5,r+e*2.8],.08,.1,{up:[1,0,0]});t.boxMM(i.roofB,[s,a,d],[c,3.6500000000000004,p]),t.boxMM(i.fasciaN,[s-.04,3.54,46.46],[c+.04,o,46.54]),t.boxMM(i.fasciaN,[s-.04,3.54,56.01],[c+.04,o,56.089999999999996]),t.boxMM(i.beamB,[s-.04,3.54,d],[s+.04,o,p]),t.boxMM(i.beamB,[c-.04,3.54,d],[c+.04,o,p]);for(let e of[46.55,56])t.boxMM(i.bcValance,[s,3.08,e-.05],[c,a,e+.05]);ie({x0:s+.1,x1:c-.1,z0:46.6,z1:55.949999999999996,y:a,along:`z`,rib:[0,0],beams:[[n,.3,.3],[n-2.4,.16,.1],[n+2.4,.16,.1],[s+.6,.12,.08],[c-.6,.12,.08]],cross:[[47.1,.18,.1],[49.4,.18,.1],[51.7,.18,.1],[54,.18,.1],[55.449999999999996,.18,.1]],pipes:[[n-1.2,.1,.05],[n+1.4,.12,.04]],boxes:{n:6,size:[.2,.45],drop:[.05,.3],lanes:[n-1.5,n+1.6,n-2.2,n+2.2]},hangers:1.1,seed:e<0?21:22},l,u),t.box(i.steel,[e*8.5,4.3,50.6],[.05,1.25,.05]),t.box(i.steel,[e*7.5,3.7800000000000002,51.05],[.08,.2,.08]),F(t,i.steel,[e*9.5,o,56],[e*9.5,4.88,55.45],.05,.05),F(t,i.steel,[e*9.5,o,55.65],[e*9.5,4.58,55.55],.03,.03);let m=e*4.75,h=e*7.2,g=Math.min(m,h),_=Math.max(m,h);t.boxMM(i.booth,[g,0,49.45],[_,2.55,50.6],{collide:!0}),t.boxMM(i.shelterDark,[g-.06,2.55,49.39],[_+.06,2.85,50.660000000000004]);let v=h,y=e,b=e=>[Math.min(v+y*e,v+y*(e+.02)),Math.max(v+y*e,v+y*(e+.02))],[x,S]=b(0),C=49.53,w=50.52;t.boxMM(i.doorFrame,[x,.02,49.49],[S,2,C]),t.boxMM(i.doorFrame,[x,.02,w],[S,2,50.56]),t.boxMM(i.doorFrame,[x,1.96,49.49],[S,2,50.56]);let[T,E]=b(.01);t.boxMM(i.doorLeaf,[T,.04,C],[E,1.96,w]),t.boxMM(i.doorFrame,[T,.04,50.010000000000005],[E,1.96,50.040000000000006]);let[D,O]=b(.02);for(let[e,n]of[[49.6,49.965],[50.08500000000001,50.45]])t.boxMM(i.glass,[D,1.08,e],[O,1.78,n]);t.box(i.board,[v+y*.04,1,49.955000000000005],[.02,.1,.025]),t.boxMM(i.board,[D,2.12,49.57],[O,2.3,49.95]),t.boxMM(i.board,[D,2.08,50.010000000000005],[O,2.2,50.27]),t.cyl(i.board,[v+y*.05,2.22,50.46],.085,.03,{axis:`x`,segments:16});let k=49.43;for(let[e,n]of[[g+.2,g+1.12],[_-1.12,_-.2]]){t.boxMM(i.glass,[e,1,49.42],[n,2.15,k]);for(let r=1;r<4;r++){let a=e+r*(n-e)/4;t.boxMM(i.shelterDark,[a-.02,1,49.4],[a+.02,2.15,k])}}t.boxMM(i.booth,[Math.min(e*4,e*5.05),0,51.8],[Math.max(e*4,e*5.05),2.1,53.3],{collide:!0}),t.boxMM(i.shelterDark,[Math.min(e*4,e*5.05)-.04,2.1,51.76],[Math.max(e*4,e*5.05)+.04,2.25,53.34]);for(let n of[52.35,52.85]){t.boxMM(i.ticket,[e<0?-5.45:5.05,0,n-.21],[e<0?-5.05:5.45,1.55,n+.21],{collide:!0});let r=e<0?-5.45:5.45;t.boxMM(i.ticketScreen,[r-.012,1,n-.13],[r+.012,1.22,n+.13]),t.boxMM(i.shelterDark,[r-.06,1.55,n-.21],[r+.06,1.68,n+.21])}for(let[n,r]of[[48.77,1.95],[53.76,1.95]])f([e*9.55,3.22,n],r,`z`,.12,.09),t.box(i.shelterDark,[e*9.55,3.34,n],[.04,.18,r*.9],{shadow:!1});for(let[n,r]of[[48.7,1.6],[53.9,2.2]])f([e*3.6,3.2,n],r,`z`,.08),t.box(i.shelterDark,[e*3.6,3.32,n],[.04,.22,r*.9],{shadow:!1});t.box(i.steel,[e*3.5,a/2,47.4],[.08,a,.08]),t.box(i.steel,[n,1.3,54.5],[.07,2.6,.07]),t.box(i.shelterDark,[n,1.6,54.5],[.12,.38,.12]),t.box(i.tube,[n-e*.08,2.55,54.3],[.06,.24,.5],{shadow:!1}),t.box(i.shelterDark,[n-e*.08,2.55,54.95],[.07,.24,.85],{shadow:!1}),t.box(i.lampBox,[e<0?-9:9,2.35,49],[.12,.3,.18],{shadow:!1})}{let n=Z.soffit,r=Z.xEnd+.5,a=Z.zc;t.boxMM(i.roof,[r,n,a-Z.half+.2],[-30,n+.25,a+Z.half-.2]),t.boxMM(i.frontD,[r,3.43,a-Z.half+.2],[r+.4,n+.25,a+Z.half-.2]);for(let e of[-1.38,1.2])t.boxMM(i.beam,[r,3.5,a+e-.1],[-30,n,a+e+.1]);for(let e of[-2.2,2.2])t.boxMM(i.beam,[r,3.55,a+e-.12],[-30,n,a+e+.12]);for(let e of[-4.6,4.6])t.boxMM(i.beam,[r,3.15,a+e-.14],[-30,n,a+e+.14]);for(let e=r+6;e<-30;e+=6)t.boxMM(i.beam,[e-.1,n-.25,a-Z.half+.3],[e+.1,n,a+Z.half-.3]);for(let r of[Z.xEnd+2.15,Z.xEnd+4.25,Z.xEnd+13.5,Z.xEnd+22.5,Z.xEnd+31.5])for(let o of[-4.6,4.6]){let s=r===Z.xEnd+4.25&&o>0?4.65:o;L(t,i.steelD,r,a+s,1.1,n,.18,.2,{rotY:Math.PI/2}),t.box(i.pedestalD,[r,.55,a+s],[.3,1.1,.3],{collide:!0}),e.colliders.addCentered(r,2,a+s,.3,4,.3)}ie({x0:r+.4,x1:-30,z0:a-Z.half+.3,z1:a+Z.half-.3,y:n,along:`x`,rib:[.22,.05],beams:[[-3.3,.18,.12],[3.3,.18,.12],[-5.8,.25,.14],[5.8,.25,.14]],trays:[[.05,.3,.42]],pipes:[[-.6,.2,.05],[.7,.24,.04],[-2.7,.15,.06],[2.6,.12,.05]],boxes:{n:16,size:[.2,.5],drop:[.05,.25],lanes:[-2.6,-.4,.5,2.7,-4.8,4.9]},hangers:.8,seed:5},s,c);for(let e of[-4.6,4.6]){let r=Math.sign(e);re(t,i.steelD,Z.xEnd+2.15,r,a+e-r*.1,2.95,.5,.48,n,.12,{rotY:Math.PI/2});for(let n=0;n<4;n++){let r=2.85+n%2*.28;F(t,i.steelD,[Z.xEnd+2.15+n*.7,r,a+e*.98],[Z.xEnd+2.85+n*.7,3.41-n%2*.28,a+e*.98],.03,.03)}e>0?t.box(i.sign,[Z.xEnd+2.15,2.35,a+e*.96],[.14,.35,.2]):t.box(i.signLight,[Z.xEnd+2.05,2.23,a-4.3],[.04,.16,.55]),t.box(i.sign,[Z.xEnd+2.155,.68,a+e*.95],[.08,.2,.06])}t.cyl(i.steelD,[Z.xEnd+4.6,.95,a+4.75],.06,1.9,{segments:8}),t.box(i.steelD,[Z.xEnd+4.6,2.5,a+4.7],[.05,.05,.4]),t.boxMM(i.steelD,[Z.xEnd+2.15,2.9,a-4.7],[Z.xEnd+4.25,n,a-4.5]),F(t,i.steelD,[Z.xEnd+2.15,2.35,a-4.6],[Z.xEnd+3.2,2.95,a-4.6],.05,.05),t.boxMM(i.steelD,[Z.xEnd+2.15,2.66,a+4.48],[Z.xEnd+4.25,2.72,a+4.52]);for(let e=0;e<6;e++){let n=Z.xEnd+2.15+e*.35;F(t,i.steelD,[n,2.69,a+4.5],[n+.35,3.15,a+4.5],.025,.025)}I(t,i.steel,[[r+.2,3.42,a+3.6],[r+.2,3.22,a+3.3],[r+.2,3.3,a+2.9],[r+.2,3.42,a+2.6]],.03),I(t,i.steel,[[r+.2,3.42,a-2.5],[r+.2,3.27,a-2.75],[r+.2,3.38,a-3.1]],.03),I(t,i.steel,[[r+.25,3.42,a+.6],[r+.25,3.1,a+.6],[r+.25,3.05,a+.25],[r+.25,3.05,a-.55]],.035),t.box(i.sign,[r+.3,3.15,a-4.06],[.15,.42,.82]);for(let e of[-.3,.3])t.box(i.steel,[r+.3,3.4,a-4.06+e],[.03,.12,.03]);for(let e of[-1.38,1.2])for(let n of[-61.6,-60.1,-57.1,-54.75,-52.5,-49.9,-47.3,-44.7,-42.1,-39.5,-36.9,-34.3,-31.7])t.box(i.housing,[n,3.53,a+e],[1.25,.08,.2],{shadow:!1}),f([n,3.46,a+e],1,`x`,.11,.04,!0)}for(let e=0;e<Q.n;e++){let n=Q.z0-e*Q.step;for(let e of[-1,1]){let r=e>0?.9:0,a=e*(Q.x+.4+r),o=e*(Q.x-.8+r);L(t,i.steel,a,n,G.ground,5.4,.3,.3),L(t,i.steel,o,n,G.ground,4.7,.22,.22),t.box(i.pedestal,[a,G.ground+.3,n],[.7,.6,.7]),t.boxMM(i.steel,[Math.min(a,e*4.8),5.25,n-.1],[Math.max(a,e*4.8),5.45,n+.1]),F(t,i.steel,[o,3.4,n],[e*5.2,4.6,n],.08,.08),F(t,i.steel,[o,4,n],[e*5,3.95,n],.07,.07)}}let A=-330,j=J.z0+2;for(let e of[q.t1,q.t2]){t.boxMM(i.wire,[e-.012,5.3,A],[e+.012,5.324,j]),t.boxMM(i.wire,[e-.012,4.1,A],[e+.012,4.12,j]);for(let n=j-2;n>A;n-=4.5)t.boxMM(i.wire,[e-.006,4.12,n-.006],[e+.006,5.3,n+.006])}for(let e of[-1,1])for(let[n,r]of[[0,5.55],[-.6,5.2],[.5,5.35]]){let a=e*(Q.x+.4+n);t.boxMM(i.wire,[a-.012,r,A],[a+.012,r+.024,j])}for(let e=0;e<Q.n;e++){let n=Q.z0-e*Q.step;for(let e of[-1,1]){let r=e*(Q.x-.8);t.box(i.steel,[r-e*.15,2.8,n],[.22,.4,.22]),t.box(i.steel,[r-e*.15,3.6,n],[.18,.25,.18]),t.box(i.steel,[e*5.3,4.95,n],[.12,.3,.12])}}let M=(e,n,r,a,o)=>{t.boxMM(i.far,[e-r/2,G.ground,n-a/2],[e+r/2,G.ground+o,n+a/2])};M(-75,-150,60,14,6),M(-130,-170,40,12,5),M(85,-160,50,16,7),M(140,-190,30,12,5);let B=(e,n,r,a)=>{for(let o of[-a/2,a/2])for(let s of[-a/2,a/2])F(t,i.far,[e+o*1.6,G.ground,n+s*1.6],[e+o*.5,G.ground+r,n+s*.5],.12,.12);for(let o=.9;o<r-.3;o+=1.3)t.box(i.far,[e,G.ground+o,n],[a*(1.6-o/r*1.1),.1,a*(1.6-o/r*1.1)]);t.box(i.far,[e,G.ground+r+.4,n],[a*1.3,.8,a*1.3])};t.box(i.far,[76.3,(G.ground+12.6)/2,8.5],[.4,12.6-G.ground,.4]),t.box(i.far,[76.3,11.3,9.1],[.25,.25,3.2]),t.box(i.far,[76.3,10,8.8],[.6,1,.7]),B(96.3,2.5,11,1.6),B(116.3,12.3,10.5,1.6),t.boxMM(i.far,[123,G.ground,-21.9],[129,G.ground+4.6,-15.5]),t.box(i.far,[86.3,(G.ground+8.7)/2,97.7],[.25,8.7-G.ground,.25]);{let e=-230,n=G.ground;t.boxMM(i.farHaze,[-204,n,-250],[-126,6.6,e]),t.boxMM(i.farHaze,[-128,n,-244],[-106,7.2,-226]),t.boxMM(i.farHaze,[119,n,-254],[260,5.8,e]),t.boxMM(i.farHaze,[167,n,-248],[187,10,-232]),t.boxMM(i.farHaze,[60,n,-260],[100,4.5,-240]);for(let e of[-198,-169,-163,-137])t.box(i.farHaze,[e,(n+12.3)/2,-220],[.5,12.3-n,.5]),t.box(i.farHaze,[e,11.8,-220],[3.2,.3,.3]);for(let r of[77,96,120,148,185])t.box(i.farHaze,[r,(n+8.1)/2,e],[.4,8.1-n,.4]),t.box(i.farHaze,[r,7.7,e],[2.4,.25,.25])}for(let n of[-1,1]){let r=n<0?-1:1.15;W(t,i.bench,i.steel,[r,0,-8.4],n<0?-Math.PI/2:Math.PI/2,9,.58),e.colliders.add({x:r-.3,y:0,z:-11.7},{x:r+.3,y:.9,z:-5.7})}W(t,i.bench,i.steel,[.15,0,-17.3],Math.PI,3,.6),t.box(i.board,[.36,1.05,-18.4],[.95,1,.08]);for(let e of[-.42,.42])t.box(i.steel,[.36+e,.3,-18.4],[.05,.6,.05]);e.colliders.add({x:-1,y:0,z:-18.6},{x:1,y:1.6,z:-17}),W(t,i.benchT,i.steel,[-1.95,0,22.6],-Math.PI/2,12,.57),e.colliders.add({x:-2.3,y:0,z:19.2},{x:-1.6,y:.9,z:26}),W(t,i.benchT,i.steel,[1,0,34.5],Math.PI/2,10,.57),e.colliders.add({x:.7,y:0,z:31.6},{x:1.3,y:.9,z:37.4}),W(t,i.benchT,i.steel,[-1.2,0,36.2],-Math.PI/2,4,.57),e.colliders.add({x:-1.5,y:0,z:35},{x:-.9,y:.9,z:37.4});for(let n of[.99,-1.07])se(t,i.benchD,i.frameD,[-60.05,0,Z.zc+n],Math.PI/2),e.colliders.addCentered(-60.05,.45,Z.zc+n,.6,.9,1.3);for(let n of[-1,1])W(t,i.benchT,i.steel,[n*5.6,0,48.3],0,5,.57),e.colliders.addCentered(n*5.6,.45,48.3,2.9,.9,.6),ce(t,i.benchB,i.benchB,[n*5.75,0,53.9],n<0?.6435:-.6435,1.7),e.colliders.addCentered(n*5.75,.45,53.9,1.3,.9,1.3);{let e=n({color:`#4a7a62`,side:2}),i=n({color:`#0c2a2e`,unlit:!0,side:2}),a=[],o=[],s=(e,t,n,i,o=a)=>{let s=z(e,t,n,r()*Math.PI*2,i*(.8+r()*.5),i,i*(.8+r()*.5));o.push(s)};for(let e=0;e<150;e++)s(-15.5+r()*5.2,G.ground,44+r()*16,.2+r()*.3,o);for(let e=0;e<50;e++)s(-10.7-r()*.5,G.ground,45.5+r()*12.4,.22+r()*.25,o);for(let e=0;e<70;e++){let e=18+r()*30;s((r()-.5)*3.2,G.top,e,.06+r()*.08)}for(let e=0;e<220;e++)s((r()<.5?-1:1)*(6.6+r()*9),G.ground,-60+r()*140,.12+r()*.2);let c=ne(7,3);R(t.root,c,e,a),R(t.root,c,i,o)}return a.build(t.root,i.underDark),o.build(t.root,i.underLite),s.build(t.root,i.underDark),c.build(t.root,i.underLite),l.build(t.root,i.bcUnderDark),u.build(t.root,i.bcUnderLite),t.root.add(ue(d,{radius:.22,color:`#ffffff`,strength:.2})),t.finalize(),{root:t.root,spawn:{pos:[0,0,0],yaw:0}}}var $=b(x,{name:`station`,background:`#bdf5e8`,fog:{horizon:`#bdf6e7`,zenith:`#d2fcee`,ground:`#8fd3c8`,density:.024,heightFalloff:0,baseHeight:-1,start:2,max:.985,steps:0,extinction:[.28,1,1.3]},toon:{amount:0,thresholds:[1.5,.72,.3],soft:.05,noiseAmp:0,noiseScale:1,shade:[.8,.95,6],dark:[.6,1,10],hi:[1.05,.8,-2]},post:{bloom:{strength:.04,threshold:1,radius:.15},diffusion:{amount:.12,threshold:.75,radius:.15},lines:{enabled:!1,color:`#173036`,width:1,depth:.1,normal:.6,id:0,breakup:.3,fadeFar:30,opacity:.4},kuwahara:{enabled:!1,radius:4,sharpness:8,aniso:1},grade:{exposure:1,lift:0,gamma:1,gain:1,saturation:1,hue:0,tint:[0,0],posterize:0,vignette:0,grain:0}}}),xe=b($,{name:`station-1`,post:{diffusion:{amount:0,threshold:.75,radius:.15},gradients:[{color:`#c0c8cc`,amount:.4,p0:[1,.4],p1:[.65,.4],blend:`mul`}]}}),Se=b($,{name:`station-0`,post:{diffusion:{amount:0,threshold:.75,radius:.15}}}),Ce={id:`station`,label:`霧の駅`,style:$,sky:!1,views:[{id:`station-0`,label:`支線のホームの先端（西）`,eye:[-48.3,1.55,0],yaw:Math.PI/2,pitch:.0327,fov:27.7,style:Se},{id:`station-1`,label:`大屋根の下から北`,eye:[0,1.55,0],yaw:-.016,pitch:.0086,fov:53.3,style:xe},{id:`station-2`,label:`線路の外から小さな上屋`,eye:[-23.7,1.05,51.4],yaw:-Math.PI/2,pitch:.071,fov:32.3},{id:`station-3`,label:`中央柱の上屋から南`,eye:[0,1.55,12],yaw:Math.PI,pitch:.026,roll:.007,fov:32.5}],build(e){let t=be(e);return t.styleZones=[{min:[-12,-5,-13],max:[12,8,11.6],style:xe},{min:[-70,-5,-8],max:[-26,8,8],style:Se},{min:[-2e3,-50,-2e3],max:[2e3,200,2e3],style:$}],t}};export{Ce as station};