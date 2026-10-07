import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';

/**
 * 天窓からの光の筋（加算の柱）。開口の長方形（y 一定）を日の向きへ押し出した箱の側面を描く。
 * 上と下・カメラの近く・真横から見た面で薄くする。桟の影のような縞を入れられる。
 * 後処理用の情報は 0 を加算する（変えない）。
 */
export interface ShaftOptions {
  /** 開口の長方形（x0, z0, x1, z1）と高さ */
  rect: [number, number, number, number];
  y: number;
  /** 押し出す長さ（m） */
  length: number;
  color: THREE.ColorRepresentation;
  intensity: number;
  /** 縞（桟の影）の間隔（m、0 で無し）と向き（'x' | 'z' に並ぶ） */
  stripe?: number;
  stripeAxis?: 'x' | 'z';
}

const VS = /* glsl */ `
attribute float aT;
varying float vT;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vOrigin;
attribute vec3 aOrigin;
void main() {
  vT = aT;
  vOrigin = aOrigin;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uStripe;
uniform float uStripeAxis;
uniform float uTime;
varying float vT;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vOrigin;
${NOISE_GLSL}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = abs(dot(normalize(vNormalW), V));
  float a = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.45, 1.0, vT));
  a *= smoothstep(0.05, 0.5, edge);
  float dc = length(cameraPosition - vWorld);
  a *= smoothstep(1.5, 5.0, dc);
  if (uStripe > 0.0) {
    float c = uStripeAxis < 0.5 ? vOrigin.x : vOrigin.z;
    float s = fract(c / uStripe);
    a *= 0.35 + 0.65 * smoothstep(0.15, 0.3, s) * (1.0 - smoothstep(0.7, 0.85, s));
  }
  a *= 0.85 + 0.15 * sl_vnoise(vec3(vWorld.xz * 0.6, uTime * 0.05));
  gl_FragColor = vec4(uColor * uIntensity * a, 1.0);
  gInfo = vec4(0.0);
}`;

export function createShaft(o: ShaftOptions, sunDir: THREE.Vector3): THREE.Mesh {
  const [x0, z0, x1, z1] = o.rect;
  const d = sunDir.clone().normalize().multiplyScalar(o.length);
  const top = [
    new THREE.Vector3(x0, o.y, z0),
    new THREE.Vector3(x1, o.y, z0),
    new THREE.Vector3(x1, o.y, z1),
    new THREE.Vector3(x0, o.y, z1),
  ];
  const pos: number[] = [];
  const nrm: number[] = [];
  const tt: number[] = [];
  const org: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = top[i];
    const b = top[(i + 1) % 4];
    const a2 = a.clone().add(d);
    const b2 = b.clone().add(d);
    const n = new THREE.Vector3().subVectors(b, a).cross(d).normalize();
    // 縦の分割（上から下へ 1 本の面。t は頂点で補間）
    const quad = [a, b, b2, a, b2, a2];
    const ts = [0, 0, 1, 0, 1, 1];
    for (let k = 0; k < 6; k++) {
      pos.push(quad[k].x, quad[k].y, quad[k].z);
      nrm.push(n.x, n.y, n.z);
      tt.push(ts[k]);
      // 縞の基準: 開口の上の点（押し出す前）
      const q = ts[k] === 0 ? quad[k] : quad[k].clone().sub(d);
      org.push(q.x, q.y, q.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  geo.setAttribute('aOrigin', new THREE.Float32BufferAttribute(org, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: styleUniforms.uTime,
      uColor: { value: new THREE.Color(o.color) },
      uIntensity: { value: o.intensity },
      uStripe: { value: o.stripe ?? 0 },
      uStripeAxis: { value: o.stripeAxis === 'z' ? 1 : 0 },
    },
    vertexShader: VS,
    fragmentShader: FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'shaft';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 20;
  mesh.frustumCulled = false;
  return mesh;
}
