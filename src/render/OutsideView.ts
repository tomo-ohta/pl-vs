import * as THREE from 'three';

/**
 * 偽の外（第22回。M04 偽帰還口の扉の向こう）: 扉の開口に貼った薄い板（mat 'outsideView'）に、全天球の写真（正距円筒）を
 * 「地面の平らなドーム」に投影して描く（three の GroundedSkybox と同じ投影を、板の画素ごとに解析的に求める）。
 * 視線（カメラ → 板の画素）を扉の外まで延ばし、半径 OUTSIDE_RADIUS のドーム（撮影点 = 扉の外 OUTSIDE_STEP m・地面から撮影高さ）か
 * 地面（扉の床の高さ）に当たった点を、撮影点から見た向きで写真から引く。近い地面ほど大きくずれ、遠景はほぼ動かない = 本物の外の視差。
 * 扉に近づく・横から覗くと、外の見える範囲と遠近が変わる（1 枚の絵を貼ったときのように平らに見えない）。
 *
 * - 写真: public/textures/outside/outside.jpg（正距円筒 2 : 1。撮影高さ OUTSIDE_EYE m 付近の昼の屋外。無ければ手続きの住宅街を描いた代わりの絵）
 * - 板の向き・大きさは頂点属性 winCenter / winHalf（WindowRoom と同じ。部屋ローカル）から取る。カメラ側 = 室内、反対側 = 外
 * - 色は発光として出す（拡散は黒）。部屋の霧は掛けない
 */
export const OUTSIDE_VIEW_MAT = 'outsideView';
/** ドームの半径（m）。遠景（建物・空）はこの距離に投影される */
const OUTSIDE_RADIUS = 60;
/** 撮影点: 扉の外へ何 m、地面から何 m */
const OUTSIDE_STEP = 3.0;
export const OUTSIDE_EYE = 1.6;
/** 写真の向き（撮影点から見た扉の正面が写真のどの経度か。0 = 写真の中央） */
const OUTSIDE_YAW = 0.0;

export interface OutsideUniforms {
  outsidePano: { value: THREE.Texture | null };
  outsideExposure: { value: number };
}

const PARS = /* glsl */ `
uniform sampler2D outsidePano; uniform float outsideExposure;
varying vec3 vOutCenter; varying vec3 vOutHalf; varying vec3 vOutCam; varying vec3 vOutPos;
vec3 liminalOutside() {
  vec3 H = vOutHalf;
  vec3 C = vOutCenter;
  bool axisX = H.x < H.z;
  // 室内（カメラ側）の反対が外
  float s = axisX ? sign(vOutCam.x - C.x) : sign(vOutCam.z - C.z);
  vec3 fwd = axisX ? vec3(-s, 0.0, 0.0) : vec3(0.0, 0.0, -s);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(fwd, up));
  float groundY = C.y - H.y - 0.02;
  vec3 P0 = vec3(C.x, groundY + ${OUTSIDE_EYE.toFixed(2)}, C.z) + fwd * ${OUTSIDE_STEP.toFixed(2)};
  vec3 o = vOutCam;
  vec3 d = normalize(vOutPos - vOutCam);
  vec3 oc = o - P0;
  float b = dot(oc, d);
  float c = dot(oc, oc) - ${(OUTSIDE_RADIUS * OUTSIDE_RADIUS).toFixed(1)};
  float t = -b + sqrt(max(b * b - c, 0.0));
  if (d.y < -1e-4) { float tg = (groundY - o.y) / d.y; if (tg > 0.0) t = min(t, tg); }
  vec3 dir = normalize(o + d * t - P0);
  float lon = atan(dot(dir, right), dot(dir, fwd)) + ${OUTSIDE_YAW.toFixed(3)};
  float lat = asin(clamp(dir.y, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 + lon / 6.2831853), clamp(0.5 + lat / 3.1415927, 0.001, 0.999));
  vec3 col = texture2D(outsidePano, uv).rgb;
  return col * outsideExposure;
}
`;

interface OutShader { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> }

/** MaterialLibrary の onBeforeCompile から呼ぶ（'outsideView'）。発光を外の色に置き換え、拡散・反射を消す */
export function addOutsideView(shader: OutShader, u: OutsideUniforms): void {
  shader.uniforms.outsidePano = u.outsidePano;
  shader.uniforms.outsideExposure = u.outsideExposure;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 winCenter; attribute vec3 winHalf; varying vec3 vOutCenter; varying vec3 vOutHalf; varying vec3 vOutCam; varying vec3 vOutPos;');
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vOutCenter = winCenter; vOutHalf = winHalf; vOutPos = transformed;
vOutCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${PARS}`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance = liminalOutside(); diffuseColor.rgb *= 0.0;`);
}

/**
 * 外の写真を読む（public/textures/outside/outside.jpg）。届くまで・無いときは手続きの代わりの絵（晴れた住宅街の全天球）。
 * 戻り値の uniform は写真が届いた時点で差し替わる
 */
export function loadOutsidePano(baseUrl: string, onError?: (e: unknown) => void): OutsideUniforms {
  const u: OutsideUniforms = { outsidePano: { value: createFallbackPano() }, outsideExposure: { value: 1.0 } };
  if (typeof document === 'undefined') return u;
  new THREE.TextureLoader().load(`${baseUrl}textures/outside/outside.jpg`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    prepare(t);
    u.outsidePano.value = t;
    u.outsideExposure.value = 1.0;
  }, undefined, (e) => onError?.(e));
  return u;
}

function prepare(t: THREE.Texture): void {
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  // 正距円筒は経度の継ぎ目で uv が跳ぶ（mipmap を引くと継ぎ目に線が出る）ので mipmap なし
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.name = 'outside/pano';
  t.needsUpdate = true;
}

/**
 * 代わりの絵（写真が無いとき）: 晴れた日の住宅街の全天球（2048 × 1024）。空（天頂の青 → 地平の白っぽい青、積雲、太陽のにじみ）、
 * 地平の家並み（切妻屋根の家・窓・電柱と電線）、地面（撮影点の前を左右に走るアスファルトの道 + 白線 + 側溝、手前の歩道）
 */
function createFallbackPano(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  let seed = 0x0a75de;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const lattice = (n: number) => Float32Array.from({ length: n * n }, () => rnd());
  const g1 = lattice(16), g2 = lattice(32), g3 = lattice(64);
  const vn = (g: Float32Array, n: number, u: number, v: number) => {
    const x = u * n, y = v * n, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => g[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  // 画素 → 経度・緯度（u: 0..1 が −π..π、中央 = 撮影点の正面（扉の外））
  const img = ctx.createImageData(W, H);
  const horizon = H / 2;
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const i = (y * W + x) * 4;
      let r: number, g: number, b: number;
      if (lat >= 0) {
        // 空
        const k = Math.pow(1 - lat / (Math.PI / 2), 2.2);
        r = 70 + (205 - 70) * k; g = 125 + (222 - 125) * k; b = 205 + (238 - 205) * k;
        // 積雲（地平に近いほど平たく密に）
        const cu = x / W, cvv = lat / (Math.PI / 2);
        const n = vn(g1, 16, cu, cvv * 0.8) * 0.55 + vn(g2, 32, cu * 1.7, cvv * 1.6) * 0.3 + vn(g3, 64, cu * 3.1, cvv * 3.2) * 0.15;
        const cloud = Math.min(1, Math.max(0, (n - 0.52) * 4.2)) * (0.35 + 0.65 * Math.min(1, cvv * 3));
        r += (246 - r) * cloud; g += (247 - g) * cloud; b += (250 - b) * cloud;
        // 太陽（正面の右上）のにじみ
        const sd = Math.hypot(lon - 0.9, lat - 0.75);
        const glow = Math.exp(-sd * sd * 30) * 0.6;
        r += (255 - r) * glow; g += (250 - g) * glow; b += (235 - b) * glow;
      } else {
        // 地面: 撮影点（高さ OUTSIDE_EYE）から見た地面の点（前 = +z）
        const dist = OUTSIDE_EYE / Math.tan(-lat);
        const gx = Math.sin(lon) * dist, gz = Math.cos(lon) * dist;
        const tex = vn(g3, 64, gx * 0.35 + 3, gz * 0.35 + 7) * 0.6 + vn(g2, 32, gx * 0.08, gz * 0.08) * 0.4;
        // 扉からの距離 zd（撮影点は扉の外 OUTSIDE_STEP m）: 0〜1.5 m 土間のコンクリート、側溝、1.75〜7 m 左右に走るアスファルトの道（白線）、
        // 縁石、その先はブロック塀の足元と敷地の植え込み。扉の後ろ（室内側）は同じコンクリート
        const zd = gz + OUTSIDE_STEP;
        if (zd < 1.5) { r = 150; g = 148; b = 140; }
        else if (zd < 1.75) { r = 105; g = 104; b = 98; }
        else if (zd < 7.0) {
          r = 78; g = 80; b = 82;
          if (Math.abs(zd - 2.0) < 0.07 || Math.abs(zd - 6.75) < 0.07) { r = 225; g = 225; b = 215; }
        } else if (zd < 7.5) { r = 128; g = 126; b = 118; }
        else { r = 72; g = 88; b = 60; }
        const m = 0.82 + 0.3 * tex;
        r *= m; g *= m; b *= m;
        // 遠くは空気で霞む
        const haze = Math.min(1, dist / 90);
        r += (190 - r) * haze * 0.6; g += (205 - g) * haze * 0.6; b += (220 - b) * haze * 0.6;
      }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // 地平の家並み（前方 ±100° の範囲、道の向こう側 8〜14 m）: 経度ごとに切妻屋根の家
  const lonToX = (lon: number) => (lon / (Math.PI * 2) + 0.5) * W;
  const latToY = (lat: number) => (0.5 - lat / Math.PI) * H;
  let lon = -Math.PI * 0.62;
  while (lon < Math.PI * 0.62) {
    const dist = 11 - OUTSIDE_STEP + rnd() * 6; // 扉から 11〜17 m
    const wAng = (5 + rnd() * 5) / dist; // 家の幅 5〜10 m
    const hWall = 5.2 + rnd() * 1.4, hRoof = 1.4 + rnd() * 1.2;
    const x0 = lonToX(lon), x1 = lonToX(lon + wAng);
    const yb = latToY(Math.atan2(-OUTSIDE_EYE, dist)), yw = latToY(Math.atan2(hWall - OUTSIDE_EYE, dist)), yr = latToY(Math.atan2(hWall + hRoof - OUTSIDE_EYE, dist));
    const wall = ['#e8e2d4', '#d9d2c3', '#cfc8b8', '#e4dfd6', '#bfb6a4'][Math.floor(rnd() * 5)];
    ctx.fillStyle = wall; ctx.fillRect(x0, yw, x1 - x0, yb - yw);
    ctx.fillStyle = ['#4a5058', '#5a4a44', '#3e464f', '#6b6f73'][Math.floor(rnd() * 4)];
    ctx.beginPath(); ctx.moveTo(x0 - 6, yw); ctx.lineTo((x0 + x1) / 2, yr); ctx.lineTo(x1 + 6, yw); ctx.closePath(); ctx.fill();
    // 窓（2 階建て: 上下 2 段）
    ctx.fillStyle = 'rgba(60,72,84,0.85)';
    const nWin = Math.max(1, Math.floor((x1 - x0) / 34));
    for (let k = 0; k < nWin; k++) {
      const wx = x0 + ((k + 0.5) * (x1 - x0)) / nWin - 7;
      for (const fl of [0.28, 0.62]) { const wy = yw + (yb - yw) * fl; ctx.fillRect(wx, wy, 14, (yb - yw) * 0.16); }
    }
    // 塀（ブロック塀）
    const wd = 8 - OUTSIDE_STEP; // 扉から 8 m
    const yf = latToY(Math.atan2(1.2 - OUTSIDE_EYE, wd));
    ctx.fillStyle = '#a7a397'; ctx.fillRect(x0 - 8, yf, x1 - x0 + 16, latToY(Math.atan2(-OUTSIDE_EYE, wd)) - yf);
    lon += wAng + (0.2 + rnd() * 0.6) / dist;
  }
  // 電柱と電線（道の向こう側 = 扉から 7.3 m、20 m おき）
  ctx.strokeStyle = '#2a2c2e';
  for (let px = -40; px <= 40; px += 20) {
    const pd = 7.3 - OUTSIDE_STEP;
    const lonP = Math.atan2(px, pd), dist = Math.hypot(px, pd);
    const x = lonToX(lonP);
    const y0 = latToY(Math.atan2(-OUTSIDE_EYE, dist)), y1 = latToY(Math.atan2(9 - OUTSIDE_EYE, dist));
    ctx.lineWidth = Math.max(2, 26 / dist); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  }
  ctx.lineWidth = 1.2;
  for (const hw of [8.6, 8.2, 7.6]) {
    ctx.beginPath();
    for (let k = 0; k <= 200; k++) {
      const px = -45 + (90 * k) / 200;
      const sag = 0.35 * (1 - Math.pow(((px % 20) + 20) % 20 / 10 - 1, 2));
      const x = lonToX(Math.atan2(px, 7.3 - OUTSIDE_STEP)), y = latToY(Math.atan2(hw - sag - OUTSIDE_EYE, Math.hypot(px, 7.3 - OUTSIDE_STEP)));
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  void horizon;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  prepare(t);
  return t;
}
