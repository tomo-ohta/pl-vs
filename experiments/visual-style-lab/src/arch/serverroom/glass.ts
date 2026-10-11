import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';

/**
 * ラックのガラス扉の材質（場面専用）。参考画像のラックの前は「青いガラス」に見える:
 * - 正面に近い所は暗い中（機器と LED）が透け、斜めに見る所ほど淡い青の艶（フレネル）
 * - ガラスには向かいの列（暗いラックの扉・枠の縦の線・LED の点）と天井の明るさ・床の明るさが映り込み、
 *   ガラスが重なって見える（手前の扉の上に奥の扉の映り込み）
 * - 床と天井の灯りが映る縦の明るい筋（図柄 atlas.makeGlassStreaks）
 * 映り込みは安い作り物: 映った視線を、通路の幅だけ離れた向かいの列の面（ガラスと平行な面）に当て、その点の手続きの模様
 * （0.6 m ごとの扉・枠・LED の升目・ラックの上は天井の明るさ・足元は床の明るさ）を描く。視線で動くので歩くと映り込みもずれる。
 * 遠く（模様が画素より細かい所）は模様を平均の色へ溶かす（ちらつかない）。霧は場面の霧と同じ。
 */
export interface GlassOptions {
  map: THREE.Texture;
  /** 正面から見たときの色・不透明度 */
  color: THREE.ColorRepresentation;
  opacity: number;
  /** 斜めに見たときの艶の色・不透明度 */
  edgeColor: THREE.ColorRepresentation;
  edgeOpacity: number;
  /** フレネルの鋭さ（大きいほど斜めの時だけ映る） */
  power?: number;
  /** 下の方ほど明るい床が映る（強さ・高さ m。床から上へこの高さで 0 になる） */
  floorGlow?: [number, number];
  /** 映り込み: 強さ・向かいの列までの距離（通路の幅）・ラックの高さ */
  reflect?: { strength: number; aisle: number; rackH: number };
  /** 映り込みの色: 向かいのラック・枠・天井と床の明るさ */
  reflColors?: { rack: THREE.ColorRepresentation; frame: THREE.ColorRepresentation; light: THREE.ColorRepresentation };
}

export function glassMaterial(o: GlassOptions): THREE.ShaderMaterial {
  const rf = o.reflect ?? { strength: 0, aisle: 2, rackH: 2.2 };
  const rc = o.reflColors ?? { rack: '#0b2633', frame: '#2f7f9c', light: '#7fd4ec' };
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      tMap: { value: o.map },
      uColor: { value: new THREE.Color(o.color) },
      uEdge: { value: new THREE.Color(o.edgeColor) },
      uOpacity: { value: new THREE.Vector3(o.opacity, o.edgeOpacity, o.power ?? 3) },
      uFloorGlow: { value: new THREE.Vector2(...(o.floorGlow ?? [0, 1])) },
      uRefl: { value: new THREE.Vector3(rf.strength, rf.aisle, rf.rackH) },
      uRackC: { value: new THREE.Color(rc.rack) },
      uFrameC: { value: new THREE.Color(rc.frame) },
      uLightC: { value: new THREE.Color(rc.light) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec2 vUv;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec2 vUv;
      uniform sampler2D tMap;
      uniform vec3 uColor;
      uniform vec3 uEdge;
      uniform vec3 uOpacity;
      uniform vec2 uFloorGlow;
      uniform vec3 uRefl;
      uniform vec3 uRackC;
      uniform vec3 uFrameC;
      uniform vec3 uLightC;
      uniform float uTime;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      // 向かいの列の手続きの模様（along = 列に沿う座標 m、hy = 高さ m、w = 1 画素あたりの along の変化）
      vec3 sr_opposite(float along, float hy, float w) {
        float H = uRefl.z;
        // 天井（ラックの上）: 明るい。ケーブルラックの暗い帯が所々
        if (hy > H) {
          float band = step(0.82, fract(along * 0.31 + 0.2)) * (1.0 - smoothstep(0.15, 0.6, w));
          // 天井は灯りの列のほかは中くらいの青（参考画像の天井の設備）。境目は高さでぼかす
          float lamp = step(0.88, fract(along / 1.6)) * (1.0 - smoothstep(0.3, 0.8, w));
          vec3 ce = mix(uFrameC, uLightC, 0.25 + 0.6 * lamp);
          return mix(ce, uRackC, 0.35 * band);
        }
        // 床: 明るい
        if (hy < 0.06) return uLightC;
        float u = fract(along / 0.6);
        // 扉の枠（縦の明るい線）。遠くでは平均へ
        float fw = 0.05;
        float frame = (1.0 - smoothstep(fw * 0.5, fw, u)) + smoothstep(1.0 - fw, 1.0 - fw * 0.5, u);
        float fineFade = 1.0 - smoothstep(0.02, 0.12, w);
        vec3 c = mix(uRackC, uFrameC, frame * fineFade);
        // 遠く（模様が画素より細かい）は枠の線を含めた平均の色
        c = mix(c, mix(uRackC, uFrameC, 0.15), 1.0 - fineFade);
        // 上と下の框（横の線）
        float rail = (1.0 - smoothstep(0.06, 0.1, hy)) + smoothstep(H - 0.1, H - 0.06, hy);
        c = mix(c, uFrameC, rail * fineFade * 0.8);
        // 映った LED の点（升目ごとに少し。細かすぎる所は消す）
        vec2 g = vec2(along / 0.05, hy / 0.045);
        vec2 cell = floor(g);
        float hsh = sl_hash12(cell + floor(along / 0.6) * 7.1);
        vec2 f = fract(g) - 0.5;
        float dot_ = step(0.93, hsh) * step(max(abs(f.x), abs(f.y)), 0.22) * (1.0 - smoothstep(0.008, 0.025, w));
        c = mix(c, vec3(0.35, 0.95, 1.1), dot_);
        return c;
      }
      void main() {
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vNormalW);
        if (dot(n, v) < 0.0) n = -n;
        float ndv = max(dot(n, v), 0.0);
        float fr = pow(1.0 - ndv, uOpacity.z);
        // 下の方は明るい床が映る（参考画像のラックの足元のガラスが淡い）
        float low = uFloorGlow.x * (1.0 - smoothstep(0.0, uFloorGlow.y, vWorld.y));
        vec4 t = texture2D(tMap, vUv);
        // 艶の地（正面: 暗い青・斜め: 淡い青）
        vec3 base = mix(uColor, uEdge, min(1.0, fr + low));
        float a = mix(uOpacity.x, uOpacity.y, min(1.0, fr + low));
        // 向かいの列の映り込み
        if (uRefl.x > 0.0) {
          vec3 r = reflect(-v, n);
          float rn = max(dot(r, n), 0.04);
          vec3 h = vWorld + r * (uRefl.y / rn);
          vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), n));
          float along = dot(h, T);
          float w = length(vec2(dFdx(along), dFdy(along)));
          vec3 rcol = sr_opposite(along, h.y, w);
          // 映り込みの強さ: 斜めほど強く（フレネル）、正面でも少し
          float k = uRefl.x * fr;
          base = mix(base, rcol, k);
          a = max(a, mix(a, 0.9, k * 0.6));
        }
        // 縦の明るい筋（灯りの映り込み）。図柄の明るさが地より明るい所を足す
        float streak = smoothstep(0.66, 0.9, t.r);
        base = mix(base, uEdge * 1.25 + 0.05, clamp(streak * (0.2 + 0.5 * fr), 0.0, 1.0));
        a = clamp(a + streak * 0.2 * (0.3 + 0.7 * fr), 0.0, 0.95);
        vec3 c = sl_applyFog(base, vWorld, cameraPosition);
        gl_FragColor = vec4(c, a);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
  });
  mat.name = 'sr-glass';
  return mat;
}
