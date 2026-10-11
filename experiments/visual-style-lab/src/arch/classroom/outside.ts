import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { rng } from '../../scenes/Builder.ts';
import { SEA_Y, XN, Z_EAST } from './layout.ts';

/**
 * 窓の外: 空・海・岬の岩と離れ岩・波の泡。
 * 外の物は自前の材質で描く: 段落とし（日の向き）→ 外の空気の霞（距離。空の色へ）→ 室内の霧（目から建物の外の面までの距離だけ）。
 * 室内の霧は「水の中の霞」なので、外の物には目から窓までの間の分だけ掛ける（建物の中の箱 x 0〜XN・z 0〜Z_EAST を出る点までの距離）。
 * 外の物の位置は 2 枚の参考画像の方位と仰角から決めた（2 枚で同じ岬の岩が同じ方位に見える）:
 *   方位は西（-Z）を 0°、南（-X）を正。基準の点 (2, 0, 10)
 *   大きな岩（岬の先の離れ岩）: 方位 28〜52°・約 450 m・海から約 100 m（classroom-0 の 2・3・4 枚目の窓の崖、classroom-1 の 1 枚目の窓の岩）
 *   遠くの淡い岬: 方位 48〜56°・約 900 m（classroom-0 の 1 枚目の窓の淡い影）
 *   白い岩: 方位 32〜41°・約 67 m・海から 10 m（classroom-1 の 2 枚目の窓）。小さな岩: 方位 46°・65 m（classroom-1 の左下）
 */

export const SKY = { zenith: '#6cd8f0', horizon: '#55c2e2', sea: '#3a9cc4', seaNear: '#147585', haze: '#5cc6e4' };

/** 日の向き（外の物の段と、室内の日なたの向き。南西の午後） */
export const SUN_DIR = new THREE.Vector3(-0.754, 0.643, -0.133).normalize();

const OUT_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uHaze;
uniform vec4 uHazeP; // 霞の濃さ（1/m）, 上限, 室内の箱 XN, Z_EAST
// 目から建物の中の箱（x 0〜XN, z 0〜ZE）を出る点までの距離（目が箱の外なら 0）
float cl_exitDist(vec3 ro, vec3 rd) {
  if (ro.x < 0.0 || ro.x > uHazeP.z || ro.z < 0.0 || ro.z > uHazeP.w) return 0.0;
  float tx = rd.x < 0.0 ? (0.0 - ro.x) / rd.x : (uHazeP.z - ro.x) / max(rd.x, 1e-5);
  float tz = rd.z < 0.0 ? (0.0 - ro.z) / rd.z : (uHazeP.w - ro.z) / max(rd.z, 1e-5);
  return max(min(tx, tz), 0.0);
}
vec3 cl_outside(vec3 col, vec3 wp) {
  vec3 ro = cameraPosition;
  vec3 d = wp - ro;
  float dist = length(d);
  vec3 rd = d / max(dist, 1e-4);
  // 外の空気の霞（空の地平の色へ）
  float h = 1.0 - exp(-dist * uHazeP.x);
  col = mix(col, uHaze, min(h, uHazeP.y));
  // 室内の霧（窓までの分だけ）
  float te = cl_exitDist(ro, rd);
  return sl_applyFog(col, ro + rd * min(dist, te), ro);
}
`;

function outsideUniforms(): Record<string, THREE.IUniform> {
  return {
    ...styleUniforms,
    uSunDir: { value: SUN_DIR.clone() },
    uHaze: { value: new THREE.Color(SKY.haze) },
    uHazeP: { value: new THREE.Vector4(0.0014, 0.6, XN, Z_EAST) },
  };
}

/** 空のドーム（目に付いて動く）。地平から天頂へ */
export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...outsideUniforms(), uZen: { value: new THREE.Color(SKY.zenith) }, uHor: { value: new THREE.Color(SKY.horizon) } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vDir;
      uniform vec3 uZen;
      uniform vec3 uHor;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      ${OUT_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.45, d.y));
        // 日の方の空は少し明るい
        c += vec3(0.05, 0.06, 0.05) * pow(max(dot(d, uSunDir), 0.0), 6.0);
        if (d.y < 0.0) c = uHor;
        vec3 ro = cameraPosition;
        float te = cl_exitDist(ro, d);
        gl_FragColor = vec4(sl_applyFog(c, ro + d * te, ro), 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.name = 'sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (_r, _s, cam) => {
    mesh.position.setFromMatrixPosition(cam.matrixWorld);
    mesh.updateMatrixWorld();
  };
  return mesh;
}

/** 海: 大きな板。遠いほど明るく（霞）、岩のまわりに白い泡の筋、細い波の線 */
function createSea(rocks: THREE.Vector4[]): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...outsideUniforms(),
      uSea: { value: new THREE.Color(SKY.sea) },
      uSeaNear: { value: new THREE.Color(SKY.seaNear) },
      uFoam: { value: new THREE.Color('#c8f6f8') },
      uRocks: { value: rocks },
      uCliff: { value: new THREE.Vector4(-5, -6.5, 45.5, 59.5) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vW;
      uniform vec3 uSea;
      uniform vec3 uSeaNear;
      uniform vec3 uFoam;
      uniform vec4 uRocks[8];
      uniform vec4 uCliff;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      ${OUT_GLSL}
      void main() {
        float dist = length(vW - cameraPosition);
        // 近い海は暗い青緑（真下を見る 3 階から）、遠い海は明るい青（水平線の近く）
        vec3 c = mix(uSeaNear, uSea, smoothstep(45.0, 260.0, dist));
        // 波: 大きなうねりの明暗（なめらか）と、近くの細かい白い波頭（まばら）
        vec2 p = vW.xz;
        float sw = sl_fbm(vec3(p * 0.012, 0.0), 3);
        c *= 0.93 + 0.1 * sw;
        float lines = 0.0;
        if (dist < 160.0) {
          float crest = sl_warp(vec3(p.x * 0.09, p.y * 0.35, 1.0), 3);
          lines = step(0.5, crest) * step(crest, 0.54) * (1.0 - smoothstep(40.0, 160.0, dist));
        }
        c = mix(c, uFoam, lines * 0.35);
        // 近くの白い泡の渦（ねじったノイズの細い等高線。北斎の波のような）
        float swirl = 0.0;
        if (dist < 160.0) {
          float sw2 = sl_warp(vec3(p * 0.06, 3.0), 4);
          swirl = smoothstep(0.41, 0.46, abs(fract(sw2 * 3.0) - 0.5)) * (1.0 - smoothstep(70.0, 160.0, dist));
        }
        c = mix(c, uFoam, swirl * 0.8);
        // 岩のまわりの泡（ちぎれた白い帯）
        float foam = 0.0;
        for (int i = 0; i < 8; i++) {
          vec4 r = uRocks[i];
          if (r.w <= 0.0) continue;
          float d = length(p - r.xy) - r.z;
          if (d > r.w * 2.4) continue;
          float n = sl_warp(vec3(p * (1.2 / r.w), 2.0), 3) * 0.5 + 0.5;
          float band = 1.0 - smoothstep(0.0, r.w * (0.6 + n * 1.4), d);
          foam = max(foam, step(0.45, band * (0.55 + n * 0.8)));
        }
        // 崖の根元の白い波（崖の箱の縁から 0〜5 m のちぎれた帯と、沖へ流れる筋）
        vec2 q = max(uCliff.xy - p, p - uCliff.zw);
        float dc = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        if (dc < 14.0) {
          float n2 = sl_warp(vec3(p * 0.35, 5.0), 3) * 0.5 + 0.5;
          float band = step(dc, 1.2 + n2 * 4.0);
          float streak = step(0.62, sl_fbm(vec3(p.x * 0.6, p.y * 0.12, 2.0), 3) * 0.5 + 0.5) * (1.0 - smoothstep(4.0, 14.0, dc));
          foam = max(foam, max(band, streak * 0.8));
        }
        c = mix(c, uFoam, foam * 0.9);
        gl_FragColor = vec4(cl_outside(c, vW), 1.0);
        gInfo = vec4(0.5, 1.0, 0.07, 0.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(0, SEA_Y, 0);
  m.name = 'sea';
  return m;
}

export interface RockPalette {
  lit: string;
  shade: string;
  dark: string;
  white: string;
  whiteAmt: number;
}

/**
 * 岩の材質: 日の向きで 3 段（日なた・陰・暗部）、上向きの面の白い斑（鳥の糞・塩）、縦の筋。
 * 色の組は 4 つまで（頂点の aPal で選ぶ: 遠くの岩・近くの白い岩・しぶき・崖）。全部を 1 つの形にまとめて 1 回で描く
 */
function rockMaterial(pals: RockPalette[]): THREE.ShaderMaterial {
  const P = [...pals];
  while (P.length < 6) P.push(pals[0]);
  return new THREE.ShaderMaterial({
    uniforms: {
      ...outsideUniforms(),
      uLit: { value: P.map((p) => new THREE.Color(p.lit)) },
      uShade: { value: P.map((p) => new THREE.Color(p.shade)) },
      uDark: { value: P.map((p) => new THREE.Color(p.dark)) },
      uWhite: { value: P.map((p) => new THREE.Color(p.white)) },
      uWhiteAmt: { value: P.map((p) => p.whiteAmt) },
    },
    vertexShader: /* glsl */ `
      attribute float aPal;
      varying vec3 vW;
      varying vec3 vNs;
      varying float vPal;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vNs = normalize(mat3(modelMatrix) * normal);
        vPal = aPal;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vW;
      varying vec3 vNs;
      varying float vPal;
      uniform vec3 uLit[6];
      uniform vec3 uShade[6];
      uniform vec3 uDark[6];
      uniform vec3 uWhite[6];
      uniform float uWhiteAmt[6];
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      ${OUT_GLSL}
      void main() {
        int k = int(vPal + 0.5);
        vec3 lit = uLit[0]; vec3 sh = uShade[0]; vec3 dk = uDark[0]; vec3 wh = uWhite[0]; float wa = uWhiteAmt[0];
        for (int i = 1; i < 6; i++) if (i == k) { lit = uLit[i]; sh = uShade[i]; dk = uDark[i]; wh = uWhite[i]; wa = uWhiteAmt[i]; }
        vec3 n = normalize(vNs);
        if (dot(n, cameraPosition - vW) < 0.0) n = -n;
        float l = dot(n, uSunDir);
        float nz = sl_warp(vW * 0.05, 3) * 0.35;
        // 縦の筋（崖の割れ目）
        float stri = sl_vnoise(vec3(vW.x * 0.35 + vW.z * 0.35, vW.y * 0.02, 0.0));
        float s = l + nz + stri * 0.12;
        vec3 c = s > 0.32 ? lit : (s > -0.05 ? sh : dk);
        // 上を向いた面・日の当たる面の白い斑
        float wn = sl_warp(vW * 0.09 + 3.1, 4);
        if (wa > 0.0 && n.y * 0.7 + l * 0.5 + wn * 0.8 > 1.0 - wa && s > -0.2) c = mix(wh, lit, step(s, 0.1) * 0.45);
        // 白い岩の暗い斑（穴・苔。参考画像の白い岩の青い点々）
        if (wa > 0.4) {
          float sp = sl_vnoise(vW * 1.4) * 0.6 + sl_vnoise(vW * 4.1) * 0.4;
          if (sp > 0.42) c = mix(c, dk, 0.75);
          else if (sp > 0.3) c = mix(c, sh, 0.6);
        }
        gl_FragColor = vec4(cl_outside(c, vW), 1.0);
        gInfo = vec4(n.xy * 0.5 + 0.5, 0.11, 0.0);
      }`,
  });
}

/** 形に色の組の番号（aPal）を付けて、場面の位置・向きへ */
function placed(g: THREE.BufferGeometry, pal: number, x: number, y: number, z: number, yaw: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (!ng.getAttribute('normal')) ng.computeVertexNormals();
  ng.rotateY(yaw);
  ng.translate(x, y, z);
  const n = ng.getAttribute('position').count;
  ng.setAttribute('aPal', new THREE.Float32BufferAttribute(new Float32Array(n).fill(pal), 1));
  for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'aPal') ng.deleteAttribute(k);
  return ng;
}

/**
 * 岩の形: 縦に長い柱を、高さごとの輪郭（半径の倍率）で絞り、ノイズで崩した形。上が平らで崖の面が切り立つ。
 * 中心 (x, z)・底の高さ・幅（x・z の半径）・高さ・向き
 */
function rockGeometry(o: { rx: number; rz: number; h: number; seed: number; profile: [number, number][]; rough: number; lean?: number }): THREE.BufferGeometry {
  const r = rng(o.seed);
  const seg = 28;
  const rows = o.profile.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const phase = Array.from({ length: 5 }, () => r() * Math.PI * 2);
  const amp = Array.from({ length: 5 }, (_, k) => (r() * 0.5 + 0.5) / (k + 1.5));
  for (let i = 0; i < rows; i++) {
    const [t, rad] = o.profile[i];
    const y = t * o.h;
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      let k = 1;
      for (let m = 0; m < 5; m++) k += Math.sin(a * (m + 2) + phase[m] + t * (m + 1) * 1.7) * amp[m] * o.rough;
      k += (r() - 0.5) * o.rough * 0.25;
      pos.push(Math.cos(a) * o.rx * rad * k + (o.lean ?? 0) * y, y, Math.sin(a) * o.rz * rad * k);
    }
  }
  for (let i = 0; i + 1 < rows; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      const c = (i + 1) * seg + j;
      const d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, c, b, b, c, d);
    }
  }
  // 上のふた
  const top = pos.length / 3;
  const last = (rows - 1) * seg;
  let cx = 0;
  let cz = 0;
  for (let j = 0; j < seg; j++) {
    cx += pos[(last + j) * 3];
    cz += pos[(last + j) * 3 + 2];
  }
  pos.push(cx / seg, o.profile[rows - 1][0] * o.h + o.h * 0.02, cz / seg);
  for (let j = 0; j < seg; j++) idx.push(last + j, last + ((j + 1) % seg), top);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // なめらかな法線（面の折れ目で角ばった欠片に見えないように）
  g.computeVertexNormals();
  return g.toNonIndexed();
}

const REF: [number, number] = [2, 10];
/** 方位（西 0°・南が正）と距離から場面の (x, z) */
export function polar(azDeg: number, dist: number): [number, number] {
  const a = (azDeg * Math.PI) / 180;
  return [REF[0] - Math.sin(a) * dist, REF[1] - Math.cos(a) * dist];
}

export function buildOutside(root: THREE.Object3D): void {
  const rocks: THREE.Vector4[] = [];
  const all: THREE.BufferGeometry[] = [];
  // 色の組: 0 = 遠くの岩、1 = 近くの白い岩、2 = 波しぶき、3 = 崖の面、4 = 内陸の丘（草と岩の暗い緑灰）
  const BIG = 0;
  const NEAR = 1;
  const HILL = 4;
  const add = (geo: THREE.BufferGeometry, pal: number, x: number, z: number, yaw: number, foamR: number, foamW: number): void => {
    all.push(placed(geo, pal, x, SEA_Y - 2, z, yaw));
    if (foamR > 0) rocks.push(new THREE.Vector4(x, z, foamR, foamW));
  };
  const mat = rockMaterial([
    { lit: '#5aa6c6', shade: '#3f86ab', dark: '#33739b', white: '#c4f0f8', whiteAmt: 0.36 },
    { lit: '#c8f6f6', shade: '#6cbccc', dark: '#3a8ea6', white: '#ecffff', whiteAmt: 0.5 },
    { lit: '#e4ffff', shade: '#bdf2f6', dark: '#8fd6e4', white: '#ffffff', whiteAmt: 0 },
    { lit: '#3f86a6', shade: '#2d6b8c', dark: '#24597a', white: '#7fc4d8', whiteAmt: 0.15 },
    { lit: '#3f7a74', shade: '#33656a', dark: '#2b5762', white: '#4f8a80', whiteAmt: 0.0 },
  ]);
  // 岬の離れ岩（大）: 方位 28〜52°・約 450 m。崖の面が切り立ち、上は少し丸い
  const cliffProfile: [number, number][] = [[0, 1.15], [0.08, 1.05], [0.3, 1.0], [0.55, 0.95], [0.75, 0.85], [0.88, 0.7], [0.95, 0.5], [1.0, 0.22]];
  const stackProfile: [number, number][] = [[0, 1.1], [0.1, 1.0], [0.4, 0.92], [0.7, 0.8], [0.85, 0.62], [0.95, 0.4], [1.0, 0.15]];
  const geos: { g: THREE.BufferGeometry; x: number; z: number; yaw: number; fr: number; fw: number }[] = [];
  const put = (az: number, dist: number, o: Parameters<typeof rockGeometry>[0], yaw: number, fr: number, fw: number): void => {
    const [x, z] = polar(az, dist);
    geos.push({ g: rockGeometry(o), x, z, yaw, fr, fw });
  };
  put(44, 470, { rx: 60, rz: 42, h: 110, seed: 3, profile: cliffProfile, rough: 0.28 }, 0.4, 62, 9);
  put(33, 440, { rx: 34, rz: 30, h: 104, seed: 5, profile: stackProfile, rough: 0.3, lean: 0.05 }, 1.1, 34, 8);
  put(29, 520, { rx: 26, rz: 24, h: 80, seed: 7, profile: stackProfile, rough: 0.35 }, 0.2, 26, 7);
  for (const q of geos) add(q.g, BIG, q.x, q.z, q.yaw, q.fr, q.fw);
  // 岩の根元の白い波しぶき（海から 2〜8 m。ちぎれた塊）
  const sr = rng(77);
  for (const q of geos) {
    for (let i = 0; i < 60; i++) {
      const a = sr() * Math.PI * 2;
      const rr = q.fr * (0.92 + sr() * 0.2);
      const sz = 1.5 + sr() * 3.5;
      const g = new THREE.IcosahedronGeometry(1, 0);
      // 縦に跳ねる尖ったしぶき
      g.scale(sz * (0.5 + sr() * 0.6), sz * (0.8 + sr() * 2.2), sz * (0.5 + sr() * 0.6));
      all.push(placed(g, 2, q.x + Math.cos(a) * rr, SEA_Y + sz * 0.3, q.z + Math.sin(a) * rr, 0));
    }
  }
  // 遠くの淡い岬
  {
    const [x, z] = polar(49.5, 950);
    add(rockGeometry({ rx: 70, rz: 50, h: 125, seed: 11, profile: cliffProfile, rough: 0.22 }), BIG, x, z, 0.2, 0, 0);
  }
  // 水平線の小さな岩
  for (const [az, d, s] of [[36, 560, 9], [38.5, 600, 6], [24, 700, 12]] as [number, number, number][]) {
    const [x, z] = polar(az, d);
    add(rockGeometry({ rx: s, rz: s * 0.8, h: s * 0.9, seed: 20 + az, profile: stackProfile, rough: 0.3 }), BIG, x, z, az, s * 1.1, 3);
  }
  // 白い岩（近い）と小さな岩
  {
    // 白い岩: classroom-1 の根元の画素（435,615）を海面に当てた位置（方位 38°・65 m）。幅 約 10 m・海から 11 m の丸い頂
    const [x, z] = polar(38.1, 64.7);
    add(rockGeometry({ rx: 5.6, rz: 4.6, h: 13.5, seed: 31, profile: [[0, 1.08], [0.2, 1.04], [0.45, 1.0], [0.68, 0.95], [0.82, 0.86], [0.91, 0.68], [0.97, 0.4], [1.0, 0.08]], rough: 0.24, lean: 0.06 }), NEAR, x, z, 0.6, 6.4, 3.5);
    const [x2, z2] = polar(47.6, 62.8);
    add(rockGeometry({ rx: 3.2, rz: 2.8, h: 4.6, seed: 37, profile: [[0, 1.08], [0.3, 1.0], [0.6, 0.85], [0.85, 0.55], [1.0, 0.1]], rough: 0.14 }), BIG, x2, z2, 0.3, 4.2, 2.6);
  }
  // 崖（地面の下の岩。南と西の面が海へ落ちる）。崖の縁は建物の南の面から 4.75 m・西の端から 6.25 m
  const ground = new THREE.BoxGeometry(50.5, 12, 66, 8, 4, 8);
  all.push(placed(ground, 3, -5 + 25.25, -6.4, -6.5 + 33, 0));
  // 内陸の丘（低い岩山の連なり。霞で淡い）
  for (const [x, z, sc] of [[110, 10, 40], [140, 60, 55], [95, 90, 35], [160, -30, 50]] as [number, number, number][]) {
    const g = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(sc * 1.6, sc * 0.5, sc);
    all.push(placed(g, HILL, x, -1, z, 0));
  }
  while (rocks.length < 8) rocks.push(new THREE.Vector4(0, 0, 0, 0));
  root.add(createSea(rocks));
  // 全部を 1 つの形に（描く回数を減らす。真上の図では遠景として範囲に入れない大きさ）
  const merged = mergeGeometries(all, false);
  if (merged) {
    const m = new THREE.Mesh(merged, mat);
    m.name = 'rocks';
    m.frustumCulled = false;
    root.add(m);
  }
}
