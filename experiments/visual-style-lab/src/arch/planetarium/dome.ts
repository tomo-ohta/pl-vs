import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { CATWALK_Y, DOME, DRUM_R } from './layout.ts';

/**
 * 投影ドーム: 半球の内側に映した世界地図の光（大陸・雲・星）を手続きのノイズで描く（参考画像は読まない）。
 * 骨組み（経線・緯線のリブ・金具）は形で作る（遠くでも線が泳がない）。
 * 映す光の明るさは、照明橋のスポットの方向（左上）で強く、輪の近くで弱い（投影の周辺の落ち）。
 */

export const DOME_C = new THREE.Vector3(DOME.cx, CATWALK_Y, DOME.cz);
export const DOME_RAD = DRUM_R;

export interface DomeLook {
  sea: string;
  seaHi: string;
  land: string;
  landHi: string;
  /** 明るさの中心の向き（ドームの中心から）と、強さ・広がり・底の明るさ */
  hotDir: [number, number, number];
  hot: [number, number, number];
  /** 大陸の大きさ（ノイズの周波数）・しきい値 */
  scale: number;
  threshold: number;
}

export const DOME_LOOK: DomeLook = {
  sea: '#08283a',
  seaHi: '#124e68',
  land: '#246c8a',
  landHi: '#4fb0d6',
  hotDir: [0.02, 0.52, -0.85],
  hot: [4.2, 4.0, 0.42],
  scale: 1.75,
  threshold: 0.05,
};

let domeId = 0.37;

/** 地図の模様（陸・海・島・陸の中のむら）を球の向き n から求める GLSL（焼き込みの描画で使う） */
const MAP_GLSL = /* glsl */ `
vec3 pl_domeMap(vec3 n, vec2 map, vec3 sea, vec3 seaHi, vec3 land, vec3 landHi) {
  // 大陸: ねじったノイズのしきい値（縁はちぎれた海岸線）。大陸は大きく（30〜60°）
  vec3 q = n * map.x + vec3(2.3, -0.7, 5.1);
  float w = sl_warp(q, 5);
  float coast = 0.004;
  float l = smoothstep(map.y - coast, map.y + coast, w);
  // 海岸の近くの島・半島のかけら
  float isl = sl_warp(n * 6.0 + vec3(7.0, 1.0, 3.0), 4);
  float near = 1.0 - smoothstep(0.0, 0.16, abs(w - map.y));
  float islands = smoothstep(0.16, 0.2, isl) * near;
  l = max(l, islands);
  // 陸の中の明るさのむら（高い所・雲の塊）
  float inner = sl_fbm(n * 4.5 + vec3(1.0, 4.0, 2.0), 4);
  vec3 landCol = mix(land, landHi, smoothstep(-0.25, 0.35, inner + (w - map.y) * 1.2));
  // 海: 海岸の近くは浅く明るい
  vec3 seaCol = mix(sea, seaHi, smoothstep(-0.35, map.y, w) * 0.5 + 0.12 * sl_fbm(n * 3.0, 2));
  return mix(seaCol, landCol, l);
}
`;

/**
 * 地図の模様を 1 回だけ経緯度の絵（横 = 経度 0〜2π、縦 = 緯度 0〜π/2）に焼く。
 * ドームの面の画素ごとにノイズを重ねて計算すると重いので（ドームが画面いっぱいの所で数 ms）、描くときは絵を引くだけにする
 */
export function bakeDomeMap(renderer: THREE.WebGLRenderer, look: DomeLook = DOME_LOOK, o: { w?: number; h?: number; latMin?: number } = {}): THREE.Texture {
  const W = o.w ?? 4096;
  const H = o.h ?? 1024;
  // 緯度の範囲: ドームは 0〜π/2（下端〜頂部）、地球儀は -π/2〜π/2
  const latMin = o.latMin ?? 0;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  rt.texture.wrapS = THREE.RepeatWrapping;
  rt.texture.wrapT = THREE.ClampToEdgeWrapping;
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSea: { value: new THREE.Color(look.sea) },
      uSeaHi: { value: new THREE.Color(look.seaHi) },
      uLand: { value: new THREE.Color(look.land) },
      uLandHi: { value: new THREE.Color(look.landHi) },
      uMap: { value: new THREE.Vector2(look.scale, look.threshold) },
      uLatMin: { value: latMin },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uSea; uniform vec3 uSeaHi; uniform vec3 uLand; uniform vec3 uLandHi; uniform vec2 uMap; uniform float uLatMin;
      ${NOISE_GLSL}
      ${MAP_GLSL}
      void main() {
        float lon = vUv.x * 6.28318530718;
        float lat = mix(uLatMin, 1.57079632679, vUv.y);
        vec3 n = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
        gl_FragColor = vec4(pl_domeMap(n, uMap, uSea, uSeaHi, uLand, uLandHi), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  quad.geometry.dispose();
  mat.dispose();
  return rt.texture;
}

export function domeMaterial(map: THREE.Texture, look: DomeLook = DOME_LOOK): THREE.ShaderMaterial {
  const hd = new THREE.Vector3(...look.hotDir).normalize();
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uCenter: { value: DOME_C.clone() },
      uMapTex: { value: map },
      uSeaHi: { value: new THREE.Color(look.seaHi) },
      uHotDir: { value: hd },
      uHot: { value: new THREE.Vector3(...look.hot) },
      uId: { value: (domeId = (domeId + 0.618) % 1) * 0.9 + 0.05 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vWorld;
      uniform vec3 uCenter;
      uniform sampler2D uMapTex;
      uniform vec3 uSeaHi;
      uniform vec3 uHotDir;
      uniform vec3 uHot;
      uniform float uId;
      uniform float uTime;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      void main() {
        vec3 n = normalize(vWorld - uCenter);
        // 焼いた地図（経緯度）を引く。経度の継ぎ目は繰り返しの包みで消える。微分は継ぎ目をまたがない向きで
        float lon = atan(n.x, -n.z);
        float lat = asin(clamp(n.y, 0.0, 1.0));
        vec2 uv = vec2(lon / 6.28318530718, lat / 1.57079632679);
        vec2 uv2 = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
        vec2 dx = dFdx(uv2), dy = dFdy(uv2);
        vec3 col = textureGrad(uMapTex, uv, dx, dy).rgb;
        // 星（小さな点。少なく）。ドームの面の升目ごとに 1 つ
        vec3 sc = n * 120.0;
        vec3 cell = floor(sc);
        vec3 h = sl_hash33(cell);
        vec3 sp = cell + 0.2 + h * 0.6;
        float sd = length(sc - sp);
        float star = step(0.955, h.x) * (1.0 - smoothstep(0.03, 0.08 + fwidth(sc.x) * 0.6, sd));
        col += vec3(0.5, 0.75, 0.9) * star * (0.3 + 0.7 * h.y) * 0.6;
        // 投影の明るさ: 照明の輪の向きで強く、輪の近く（低い所）で落ちる
        float hot = pow(max(dot(n, uHotDir), 0.0), uHot.y);
        // 明るい所から離れると映像の濃淡も弱い（陸と海の差を縮める。参考画像のレンズの外のドーム）
        float sl = sl_luma(col);
        col = mix(vec3(sl) * vec3(0.55, 1.0, 1.35), col, 0.45 + 0.55 * smoothstep(0.0, 0.5, hot));
        float k = uHot.z + uHot.x * hot;
        k *= mix(0.55, 1.0, smoothstep(0.0, 0.35, n.y));
        col *= k;
        // 明るい所は海も明るく（映像の光が強く、陸と海の差が小さい）
        col += uSeaHi * hot * 0.9;
        gl_FragColor = vec4(sl_applyFog(col, vWorld, cameraPosition), 1.0);
        gInfo = vec4(-n.xy * 0.5 + 0.5, uId, 0.0);
      }`,
    side: THREE.BackSide,
  });
}

/**
 * リブ・金具の材質: ドームの映像の光がリブにも当たる（ドームの面と同じ明るさの分布で、少し暗い）。
 * レンズの外の暗い所ではリブも暗く目立たず、明るい所では暗い線に見える（参考画像のリブの見え方）
 */
export function ribMaterial(color: string, look: DomeLook = DOME_LOOK): THREE.ShaderMaterial {
  const hd = new THREE.Vector3(...look.hotDir).normalize();
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uCenter: { value: DOME_C.clone() },
      uColor: { value: new THREE.Color(color) },
      uHotDir: { value: hd },
      uHot: { value: new THREE.Vector3(...look.hot) },
      uId: { value: (domeId = (domeId + 0.618) % 1) * 0.9 + 0.05 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vWorld;
      varying vec3 vN;
      uniform vec3 uCenter;
      uniform vec3 uColor;
      uniform vec3 uHotDir;
      uniform vec3 uHot;
      uniform float uId;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      void main() {
        vec3 n = normalize(vWorld - uCenter);
        float hot = pow(max(dot(n, uHotDir), 0.0), uHot.y);
        float k = (uHot.z + uHot.x * hot) * mix(0.55, 1.0, smoothstep(0.0, 0.35, n.y));
        // 中心を向く面（見える面）ほど明るい
        float face = 0.55 + 0.45 * max(dot(normalize(vN), -n), 0.0);
        vec3 col = uColor * k * face;
        gl_FragColor = vec4(sl_applyFog(col, vWorld, cameraPosition), 1.0);
        gInfo = vec4(-n.xy * 0.5 + 0.5, uId, 0.0);
      }`,
  });
}

/** 半球の殻（内側を見る）と、骨組みのリブ・金具 */
export function buildDome(b: Builder): THREE.Mesh {
  const ribMat = ribMaterial('#0d3447');
  const bracketMat = ribMaterial('#0a2a3a');
  const geo = new THREE.SphereGeometry(DOME_RAD, 128, 48, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(geo, domeMaterial(bakeDomeMap(b.ctx.renderer)));
  // ドームの外へ光が抜けないように影を落とす（照明の輪はドームの中）
  dome.castShadow = true;
  dome.position.copy(DOME_C);
  dome.name = 'dome';
  b.root.add(dome);
  // リブ: 経線 48 本（頂部の小さな輪まで。参考画像の輪の上の経線の位置に合わせて 4.1° 回す）・緯線は 7.8° おき
  const RR = DOME_RAD - 0.05;
  const ribs: THREE.BufferGeometry[] = [];
  const ribAt = (lat: number, lon: number, inset: number): THREE.Vector3 =>
    new THREE.Vector3(Math.cos(lat) * Math.sin(lon) * (RR - inset), Math.sin(lat) * (RR - inset), -Math.cos(lat) * Math.cos(lon) * (RR - inset)).add(DOME_C);
  const NM = 48;
  const LON0 = (4.1 * Math.PI) / 180;
  const latTop = (78 * Math.PI) / 180;
  for (let i = 0; i < NM; i++) {
    const lon = (i / NM) * Math.PI * 2 + LON0;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 40; k++) pts.push(ribAt((k / 40) * latTop, lon, 0.12));
    // 頂部へ向かって細く見えすぎないよう、経線は 2 本おきに頂部の輪まで（残りは 60° で止める）
    if (i % 2 === 1) pts.splice(Math.round((60 / 78) * 40) + 1);
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length - 1, 0.06, 4, false));
  }
  const lats = [12.5, 20.3, 28.1, 35.9, 43.7, 51.5, 59.3, 67.1, 78].map((d) => (d * Math.PI) / 180);
  for (const lat of lats) {
    const pts: THREE.Vector3[] = [];
    const n = 144;
    for (let k = 0; k < n; k++) pts.push(ribAt(lat, (k / n) * Math.PI * 2, 0.12));
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), n, 0.055, 4, true));
  }
  for (const g of ribs) b.mesh(g, ribMat, [0, 0, 0], { shadow: false });
  // 金具: リブの交点ごとの小さな板（参考画像の小さな暗い印）
  const br = new THREE.BoxGeometry(0.34, 0.34, 0.1);
  const bgs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < NM; i++) {
    const lon = (i / NM) * Math.PI * 2 + LON0;
    for (const lat of lats) {
      if (i % 2 === 1 && lat > 1.06) continue;
      const p = ribAt(lat, lon, 0.2);
      const g = br.clone();
      g.lookAt(new THREE.Vector3().subVectors(DOME_C, p));
      g.translate(p.x, p.y, p.z);
      bgs.push(g);
      // 間の小さな金具（経線の上、緯線の間）
      const p2 = ribAt(lat + 0.1, lon, 0.2);
      const g2 = new THREE.BoxGeometry(0.22, 0.3, 0.1);
      g2.lookAt(new THREE.Vector3().subVectors(DOME_C, p2));
      g2.translate(p2.x, p2.y, p2.z);
      bgs.push(g2);
    }
  }
  for (const g of bgs) b.mesh(g, bracketMat, [0, 0, 0], { shadow: false });
  return dome;
}

/** 地球儀の展示の地図（ドームの地図と同じ手続きの模様。色は地球儀の塗り: 深い青の海・青緑と砂色の陸）。1 回だけ焼いて使い回す */
let globeTex: THREE.Texture | null = null;
export function globeMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  globeTex ??= bakeDomeMap(
    renderer,
    { ...DOME_LOOK, sea: '#0f3346', seaHi: '#1d5a74', land: '#4d8577', landHi: '#a59c72', scale: 1.4, threshold: 0.02 },
    { w: 2048, h: 1024, latMin: -Math.PI / 2 },
  );
  return globeTex;
}
