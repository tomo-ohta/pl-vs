import{a as e,i as t,t as n}from"./main-CWXRxuAn.js";import{Rn as r,a as i,hn as a,v as o}from"./Style-DOuyqAVF.js";var s=0;function c(c){return new a({uniforms:{...i,uColor:{value:new o(c.color)},uInk:{value:new o(c.inkColor??`#22333a`)},uRag:{value:new r(c.rag??.04,c.scale??6,c.ink??0,c.specks??0)},uEdges:{value:new r(...c.edges??[1,1,1,1])},uSpeck:{value:new o(c.speckColor??`#e9f2dc`)},uOpacity:{value:c.opacity??1},uId:{value:.93-s++*.137%.2},uStep:{value:c.step??0},uSpeckAxis:{value:+(c.speckAlong===`first`)}},clipping:!0,vertexShader:`
      #include <clipping_planes_pars_vertex>
      varying vec3 vW;
      varying vec2 vUv;
      varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,fragmentShader:`
      layout(location = 1) out highp vec4 gInfo;
      #include <clipping_planes_pars_fragment>
      varying vec3 vW;
      varying vec2 vUv;
      varying vec3 vN;
      uniform vec3 uColor;
      uniform vec3 uInk;
      uniform vec4 uRag;
      uniform vec4 uEdges;
      uniform vec3 uSpeck;
      uniform float uOpacity;
      uniform float uId;
      uniform float uStep;
      uniform float uSpeckAxis;
      ${e}
      ${t}
      ${n}
      void main() {
        #include <clipping_planes_fragment>
        vec3 dpx = dFdx(vW);
        vec3 dpy = dFdy(vW);
        vec2 dux = dFdx(vUv);
        vec2 duy = dFdy(vUv);
        float det = dux.x * duy.y - dux.y * duy.x;
        if (abs(det) < 1e-12) discard;
        vec3 dPdu = (dpx * duy.y - dpy * dux.y) / det;
        vec3 dPdv = (dpy * dux.x - dpx * duy.x) / det;
        float wu = length(dPdu);
        float wv = length(dPdv);
        vec4 d = vec4(vUv.x * wu, (1.0 - vUv.x) * wu, vUv.y * wv, (1.0 - vUv.y) * wv);
        // ちぎれ: ねじったノイズ + 細かいノイズ
        vec3 q = uStep > 0.0 ? (floor(vW / uStep) + 0.5) * uStep : vW;
        float n = sl_warp(q * uRag.y, 3) * 0.5 + 0.5;
        n += 0.35 * sl_vnoise(q * uRag.y * 5.0);
        n = clamp(n, 0.0, 1.2);
        vec4 r = uRag.x * uEdges * n;
        vec4 e = d - r;
        float m = min(min(e.x, e.y), min(e.z, e.w));
        if (m < 0.0) discard;
        vec3 col = uColor;
        if (uRag.z > 0.0) {
          // 縁の線（ちぎる縁だけ）
          vec4 inkE = mix(vec4(1e3), e, step(0.5, uEdges));
          float mi = min(min(inkE.x, inkE.y), min(inkE.z, inkE.w));
          col = mix(uInk, col, step(uRag.z, mi));
        }
        if (uRag.w > 0.0) {
          // 白い細長い傷（v の向きに長い。縁に暗い線）
          // 面の向きに合わせた座標（床は xz、壁は zy / xy）。uSpeckAxis で長い向きを選ぶ
          vec3 an = abs(vN);
          vec2 pl = an.y > 0.5 ? vW.xz : (an.x > an.z ? vW.zy : vW.xy);
          if (uSpeckAxis > 0.5) pl = pl.yx;
          vec2 p = vec2(pl.x / 0.05, pl.y / 0.3);
          vec2 cell = floor(p);
          vec3 h = sl_hash33(vec3(cell, 3.7));
          vec2 f = fract(p) - 0.5 - (h.xy - 0.5) * vec2(0.3, 0.2);
          float hw = 0.16;
          float hl = 0.15 + h.z * 0.3;
          float on = step(abs(f.x), hw) * step(abs(f.y), hl);
          float rim = step(abs(f.x), hw + 0.1) * step(abs(f.y), hl + 0.02);
          float use = step(fract(h.z * 7.13), uRag.w);
          col = mix(col, uInk, (rim - on) * use);
          col = mix(col, uSpeck, on * use);
        }
        gl_FragColor = vec4(sl_applyFog(col, vW, cameraPosition), uOpacity);
        vec3 vn = normalize((viewMatrix * vec4(normalize(vN), 0.0)).xyz);
        gInfo = vec4(vn.xy * 0.5 + 0.5, uId, 0.0);
      }`,transparent:(c.opacity??1)<1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4})}export{c as t};