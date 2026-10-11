import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { floorGlsl } from './profile.ts';
import { HOUSE, inHouse } from './layout.ts';

/**
 * 光の筋（照明橋のスポットライトの光が、舞台の煙（ヘイザー）に見える円錐）。
 * 円錐の殻のメッシュに描き、画素ごとに視線と円錐の交わる区間を解いて、その中を数歩たどって光の量を足す。
 * - 床・段床（profile.ts の floorY と同じ段）より下はたどらない（舞台や段床の向こうの霧を足さない）
 * - 縁の外側の細い帯は光を吸う（参考画像の筋の縁の暗い帯）
 * - 殻の外からは表の面（深度で隠れる）、中に入ったら裏の面（深度なし）で描く
 * 合成は「足す + 吸う」（ONE, ONE_MINUS_SRC_ALPHA）。2 枚目の出力（線の情報）は変えない（alpha 0）
 */

export interface BeamOpts {
  apex: THREE.Vector3;
  target: THREE.Vector3;
  /** 半分の開き角（ラジアン） */
  half: number;
  color: string;
  /** 1 m あたりの光の量 */
  density: number;
  /** 縁の暗い帯の強さ（0〜1） */
  rim: number;
  /** 下ほど濃く（床の近くに溜まる煙）: 床から何 m で倍になるか */
  pool: number;
  /** 光の強さが頂点からの距離の 2 乗で弱まる割合（0 = 弱まらない、1 = 2 乗で）。基準の距離は目標までの距離 */
  falloff: number;
}

export interface Beam {
  mesh: THREE.Mesh;
  /** カメラの位置で表 / 裏を切り替える */
  update(camera: THREE.Camera): void;
  uniforms: Record<string, THREE.IUniform>;
}

export function createBeam(o: BeamOpts): Beam {
  const axis = o.target.clone().sub(o.apex);
  const len = axis.length();
  axis.normalize();
  // 殻: 縁の帯まで入るように少し太く。長さは床の下まで
  const L = len * 1.12;
  const R = Math.tan(o.half * 1.22) * L;
  const geo = new THREE.ConeGeometry(R, L, 64, 1, true);
  // 頂点が +y、底が -y → 頂点を原点へ、軸を -y に
  geo.translate(0, -L / 2, 0);
  const mesh = new THREE.Mesh(geo);
  mesh.position.copy(o.apex);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis);
  mesh.name = 'beam';
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  const uniforms: Record<string, THREE.IUniform> = {
    ...styleUniforms,
    uApex: { value: o.apex.clone() },
    uAxis: { value: axis.clone() },
    uCos: { value: Math.cos(o.half) },
    uTan: { value: Math.tan(o.half) },
    uLen: { value: L },
    uColor: { value: new THREE.Color(o.color) },
    uDensity: { value: o.density },
    uRim: { value: o.rim },
    uPool: { value: o.pool },
    uInside: { value: 0 },
    uFall: { value: new THREE.Vector2(o.falloff, len) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
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
      uniform vec3 uApex;
      uniform vec3 uAxis;
      uniform float uCos;
      uniform float uTan;
      uniform float uLen;
      uniform vec3 uColor;
      uniform float uDensity;
      uniform float uRim;
      uniform float uPool;
      uniform float uInside;
      uniform vec2 uFall;
      uniform float uTime;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      ${floorGlsl()}
      // 視線が（縁の帯まで含めた）円錐に入る区間
      vec2 coneSpan(vec3 ro, vec3 rd, float tanH) {
        float c2 = 1.0 / (1.0 + tanH * tanH);
        vec3 co = ro - uApex;
        float dv = dot(rd, uAxis);
        float cv = dot(co, uAxis);
        float a = dv * dv - c2;
        float b = 2.0 * (dv * cv - c2 * dot(rd, co));
        float c = cv * cv - c2 * dot(co, co);
        // 軸の向きの範囲 [0, uLen]
        float h0 = -1e9, h1 = 1e9;
        if (abs(dv) > 1e-5) {
          float ta = (0.0 - cv) / dv, tb = (uLen - cv) / dv;
          h0 = min(ta, tb); h1 = max(ta, tb);
        } else if (cv < 0.0 || cv > uLen) return vec2(1.0, -1.0);
        float disc = b * b - 4.0 * a * c;
        vec2 span = vec2(1.0, -1.0);
        if (abs(a) < 1e-6) return span;
        if (disc < 0.0) {
          if (a > 0.0) span = vec2(-1e9, 1e9); else return span;
        } else {
          float s = sqrt(disc);
          float t1 = (-b - s) / (2.0 * a), t2 = (-b + s) / (2.0 * a);
          if (t1 > t2) { float tt = t1; t1 = t2; t2 = tt; }
          if (a < 0.0) span = vec2(t1, t2);
          else {
            // 外側の 2 つの区間のうち、軸の正の側（頂点の先）にある方
            float tm1 = t1 - 1.0, tm2 = t2 + 1.0;
            float hA = cv + dv * tm1;
            span = hA > 0.0 ? vec2(-1e9, t1) : vec2(t2, 1e9);
          }
        }
        span.x = max(span.x, h0);
        span.y = min(span.y, h1);
        return span;
      }
      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWorld - ro);
        vec2 sp = coneSpan(ro, rd, uTan * 1.22);
        sp.x = max(sp.x, 0.0);
        if (uInside < 0.5) sp.y = min(sp.y, sp.x + 400.0);
        if (sp.y <= sp.x) discard;
        const int N = 20;
        float dt = (sp.y - sp.x) / float(N);
        // 画素ごとにずらした始点（縞を消す）
        float j = sl_hash12(gl_FragCoord.xy + fract(uTime) * 0.0);
        vec3 acc = vec3(0.0);
        float tau = 0.0;
        for (int i = 0; i < N; i++) {
          float t = sp.x + (float(i) + j) * dt;
          vec3 p = ro + rd * t;
          if (p.y < pl_floorY(p.xz) + 0.02) break;
          // 舞台の裏の塔（閉じた前室）の中は煙を数えない
          if (p.x > ${HOUSE.x0.toFixed(2)} && p.x < ${HOUSE.x1.toFixed(2)} && p.z > ${HOUSE.back.toFixed(2)} && p.z < ${HOUSE.front.toFixed(2)} && p.y < ${HOUSE.top.toFixed(2)}) continue;
          vec3 ap = p - uApex;
          float h = dot(ap, uAxis);
          if (h <= 0.0) continue;
          float rr = length(ap - uAxis * h) / (h * uTan);
          // 中（なめらかに縁へ）・縁の外の暗い帯
          float core = 1.0 - smoothstep(0.82, 1.0, rr);
          float rim = smoothstep(0.98, 1.02, rr) * (1.0 - smoothstep(1.05, 1.12, rr));
          // 煙のむら（ゆっくり動く）
          float nz = 0.75 + 0.5 * sl_vnoise(p * 0.12 + vec3(0.0, uTime * 0.01, 0.0));
          // 床の近くに溜まる・頂点の近くは薄い
          float pool = 1.0 + max(0.0, 1.0 - max(p.y, 0.0) / uPool);
          float fade = smoothstep(0.0, 3.0, h);
          // 光の強さ: 頂点からの距離の 2 乗で弱まる（目標までの距離で 1）。近くは上限
          float fall = mix(1.0, min(uFall.y * uFall.y / max(h * h, 1.0), 6.0), uFall.x);
          float d = core * nz * pool * fade * fall * uDensity;
          // 遠い所の光は霧で弱める
          float fogT = exp(-uFogParams.x * max(t - uFogParams.w, 0.0));
          acc += uColor * d * dt * fogT * exp(-tau);
          tau += rim * uRim * dt * 0.35;
        }
        float alpha = 1.0 - exp(-tau);
        gl_FragColor = vec4(acc, alpha);
        gInfo = vec4(0.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    side: THREE.FrontSide,
    fog: false,
  });
  mesh.material = mat;
  const tmp = new THREE.Vector3();
  return {
    mesh,
    uniforms,
    update(camera) {
      // 閉じた前室の中からは光の筋を描かない（裏の面を深度なしで描くと、壁の向こうの煙が透けるので）
      mesh.visible = !(inHouse(camera.position.x, camera.position.z) && camera.position.y < HOUSE.top);
      // 殻（縁の帯まで）の中にいるか
      tmp.copy(camera.position).sub(o.apex);
      const h = tmp.dot(axis);
      const r = tmp.sub(axis.clone().multiplyScalar(h)).length();
      const inside = h > 0 && h < L && r < h * Math.tan(o.half * 1.22) + 0.5;
      uniforms.uInside.value = inside ? 1 : 0;
      mat.side = inside ? THREE.BackSide : THREE.FrontSide;
      mat.depthTest = !inside;
    },
  };
}
