import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { rng } from '../Builder.ts';

/**
 * 葉の塊（場面専用）。キャンバスに描いた葉の房の絵を、透明の切り抜きで板に貼る。
 * 絵は R = 葉、G = 日の当たる葉（明るい色）。色は材質で決める（暗い葉・明るい葉の 2 段）。
 */
export function makeLeafTexture(seed: number, opts: { clumps?: number; leaf?: number; litSide?: number; fill?: number } = {}): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  const clumps = opts.clumps ?? 22;
  const leaf = opts.leaf ?? 9;
  const fill = opts.fill ?? 1;
  for (let k = 0; k < clumps; k++) {
    // 房: 中心と半径。外周ほど疎ら
    const cx = S * (0.15 + r() * 0.7);
    const cy = S * (0.15 + r() * 0.7);
    const R = S * (0.08 + r() * 0.12);
    const n = Math.round(220 * fill * (R / (S * 0.14)) ** 2);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * R;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * 0.8;
      // 上側（日の当たる側）は明るい葉
      const lit = (cy - y) / R + (r() - 0.5) * 0.8 > (opts.litSide ?? 0.2);
      g.fillStyle = lit ? 'rgb(255,255,0)' : 'rgb(255,0,0)';
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, leaf * (0.6 + r() * 0.8), leaf * (0.3 + r() * 0.35), 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * 遠くの木の冠の絵（色をそのまま描く）。丸い冠の中に葉の房を重ね、房ごとに上側を明るい葉にする。
 * colors: [暗い葉, 中間, 明るい葉]
 */
export function makeTreeTexture(seed: number, colors: [string, string, string], o: { clumps?: number; leaf?: number } = {}): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  const n = o.clumps ?? 46;
  const leaf = o.leaf ?? 9;
  const clumps: [number, number, number][] = [];
  for (let k = 0; k < n; k++) {
    // 冠（上が丸い楕円）の中に房を置く
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.82;
    clumps.push([S * 0.5 + Math.cos(a) * d * S * 0.4, S * 0.48 + Math.sin(a) * d * S * 0.36, S * (0.06 + r() * 0.06)]);
  }
  // 下の房から描く（上の房が手前に重なる）
  clumps.sort((p, q) => q[1] - p[1]);
  const blob = (x: number, y: number, R: number, count: number, col: string, bias: number): void => {
    g.fillStyle = col;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const dd = Math.sqrt(r()) * R;
      const px = x + Math.cos(a) * dd;
      const py = y + Math.sin(a) * dd * 0.85;
      // 明るい葉は房の上側（左上）だけ
      if (bias > 0 && (py - y) / R + (px - x) / R * 0.3 > 0.3 - bias + (r() - 0.5) * 0.5) continue;
      g.save();
      g.translate(px, py);
      g.rotate(r() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, leaf * (0.6 + r() * 0.9), leaf * (0.35 + r() * 0.35), 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  };
  // 明るい地の上に暗い葉の房を重ね、房の上側に明るい葉（参考画像の遠くの木: 明るい緑の中に暗い葉の塊）
  for (const [x, y, R] of clumps) blob(x, y, R * 1.05, 260, colors[1], 0);
  for (const [x, y, R] of clumps) {
    blob(x + R * 0.1, y + R * 0.3, R * 0.5, 50, colors[0], 0);
    blob(x - R * 0.2, y - R * 0.3, R * 0.55, 45, colors[2], 0.6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const VS = /* glsl */ `
attribute vec2 aCard;
varying vec3 vWorld;
varying vec2 vUv;
varying vec2 vCard;
varying vec3 vVN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vCard = aCard;
  vVN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
varying vec3 vWorld;
varying vec2 vUv;
varying vec2 vCard;
varying vec3 vVN;
uniform sampler2D uMap;
uniform vec3 uDark;
uniform vec3 uLight;
uniform float uLightAmt;
uniform float uId;
uniform float uFogMul;
uniform float uDirect;
uniform float uCardEdge;
uniform vec3 uGrad;   // 下の高さ, 上の高さ, 下で暗くする割合
${NOISE_GLSL}
${FOG_GLSL}
void main() {
  vec4 m = texture2D(uMap, vUv);
  if (m.a < 0.5) discard;
  if (uCardEdge > 0.0) {
    // 板の縁: 中心からの距離をノイズで揺らし、外側を捨てる（房の丸い輪郭）
    vec2 cc = vCard * 2.0 - 1.0;
    float d = length(cc * vec2(1.0, 1.15));
    float nz = sl_fbm(vec3(vUv * 3.1, 0.7), 3);
    if (d > 0.82 + nz * uCardEdge) discard;
  }
  float lit = step(0.5, m.g) * uLightAmt;
  vec3 col = uDirect > 0.5 ? m.rgb : mix(uDark, uLight, lit);
  if (uGrad.y > uGrad.x) col *= 1.0 - uGrad.z * (1.0 - smoothstep(uGrad.x, uGrad.y, vWorld.y));
  col = mix(col, sl_applyFog(col, vWorld, cameraPosition), uFogMul);
  gl_FragColor = vec4(col, 1.0);
  gInfo = vec4(normalize(vVN).xy * 0.5 + 0.5, uId, 0.0);
}`;

export function createLeafMaterial(
  map: THREE.Texture,
  dark: THREE.ColorRepresentation,
  light: THREE.ColorRepresentation,
  lightAmt = 1,
  o: { fog?: number; grad?: [number, number, number]; direct?: boolean; cardEdge?: number } = {},
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uMap: { value: map },
      uDark: { value: new THREE.Color(dark) },
      uLight: { value: new THREE.Color(light) },
      uLightAmt: { value: lightAmt },
      uId: { value: 0.11 },
      uFogMul: { value: o.fog ?? 1 },
      uDirect: { value: o.direct ? 1 : 0 },
      uCardEdge: { value: o.cardEdge ?? 0 },
      uGrad: { value: new THREE.Vector3(...(o.grad ?? [0, 0, 0])) },
    },
    vertexShader: VS,
    fragmentShader: FS,
    side: THREE.DoubleSide,
  });
}

/**
 * 葉の板を何枚か重ねた塊（木の冠・茂み）。中心・大きさ（幅・高さ・奥行き）・枚数。
 * 絵は tile m ごとに 1 枚（板の大きさに関係なく葉の大きさがそろう）
 */
export function leafCluster(center: [number, number, number], size: [number, number, number], count: number, seed: number, faceYaw = 0, tile = 1.6): THREE.BufferGeometry {
  const r = rng(seed);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const w = size[0] * (0.55 + r() * 0.5);
    const h = size[1] * (0.55 + r() * 0.5);
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const ou = r();
    const ov = r();
    // 板の中の位置（0〜1）。縁をノイズで欠けさせて四角く見えないようにする
    const card = new Float32Array(uv.count * 2);
    for (let k = 0; k < uv.count; k++) {
      card[k * 2] = uv.getX(k);
      card[k * 2 + 1] = uv.getY(k);
      uv.setXY(k, pos.getX(k) / tile + ou, pos.getY(k) / tile + ov);
    }
    g.setAttribute('aCard', new THREE.BufferAttribute(card, 2));
    g.rotateY(faceYaw + (r() - 0.5) * 1.2);
    g.translate(center[0] + (r() - 0.5) * size[0] * 0.5, center[1] + (r() - 0.5) * size[1] * 0.4, center[2] + (r() - 0.5) * size[2]);
    geos.push(g);
  }
  const out = mergeSimple(geos);
  for (const g of geos) g.dispose();
  return out;
}

function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let nv = 0;
  let ni = 0;
  for (const g of geos) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const card = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, vo * 3);
    nor.set(g.attributes.normal.array as Float32Array, vo * 3);
    uv.set(g.attributes.uv.array as Float32Array, vo * 2);
    if (g.attributes.aCard) card.set(g.attributes.aCard.array as Float32Array, vo * 2);
    const gi = g.index!.array;
    for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
    vo += g.attributes.position.count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('aCard', new THREE.BufferAttribute(card, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
