import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';

/**
 * 窓から差し込む光の筋（水の中の光の柱。classroom-1 の窓の前の明るい斜めの帯）。屋内プールの天窓の光の筋（scenes/pool/shafts.ts）を、
 * 縦の窓の長方形を日の向きへ押し出す形に直した。加算・霧の中だけで淡く、目の近く・真横から見た面・押し出しの先で薄くする。
 * 決まり: 南の窓の区画ごとに 1 本（2 階は青・3 階は青緑）。区画の中で縦に縞（竪框の影）
 */

const VS = /* glsl */ `
attribute float aT;
attribute float aU;
varying float vT;
varying float vU;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vT = aT;
  vU = aU;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying float vT;
varying float vU;
varying vec3 vWorld;
varying vec3 vNormalW;
${NOISE_GLSL}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = abs(dot(normalize(vNormalW), V));
  float a = smoothstep(0.0, 0.08, vT) * (1.0 - smoothstep(0.35, 1.0, vT));
  a *= smoothstep(0.03, 0.4, edge);
  a *= smoothstep(1.2, 4.0, length(cameraPosition - vWorld));
  // 縦の縞（竪框の影）と、ゆらぐ明るさ
  a *= 0.45 + 0.55 * smoothstep(0.1, 0.25, fract(vU)) * (1.0 - smoothstep(0.75, 0.9, fract(vU)));
  a *= 0.75 + 0.25 * sl_vnoise(vec3(vWorld.xz * 0.8, uTime * 0.05));
  gl_FragColor = vec4(uColor * uIntensity * a, 1.0);
  gInfo = vec4(0.0);
}`;

export class Shafts {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly tt: number[] = [];
  private readonly uu: number[] = [];

  /**
   * 縦の窓（x = gx の面、z0〜z1・y0〜y1）から、光の進む向き dir（日の向きの逆）へ長さ len の柱。stripes = 竪框の数（縦の縞）
   */
  window(gx: number, z0: number, z1: number, y0: number, y1: number, dir: THREE.Vector3, len: number, stripes: number): void {
    const d = dir.clone().normalize().multiplyScalar(len);
    const c = [new THREE.Vector3(gx, y0, z0), new THREE.Vector3(gx, y0, z1), new THREE.Vector3(gx, y1, z1), new THREE.Vector3(gx, y1, z0)];
    const us = [0, stripes, stripes, 0];
    for (let i = 0; i < 4; i++) {
      const a = c[i];
      const b = c[(i + 1) % 4];
      const a2 = a.clone().add(d);
      const b2 = b.clone().add(d);
      const n = new THREE.Vector3().subVectors(b, a).cross(d).normalize();
      const quad = [a, b, b2, a, b2, a2];
      const ts = [0, 0, 1, 0, 1, 1];
      const ua = us[i];
      const ub = us[(i + 1) % 4];
      const uq = [ua, ub, ub, ua, ub, ua];
      for (let k = 0; k < 6; k++) {
        this.pos.push(quad[k].x, quad[k].y, quad[k].z);
        this.nrm.push(n.x, n.y, n.z);
        this.tt.push(ts[k]);
        this.uu.push(uq[k]);
      }
    }
  }

  build(color: THREE.ColorRepresentation, intensity: number): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(this.tt, 1));
    geo.setAttribute('aU', new THREE.Float32BufferAttribute(this.uu, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: styleUniforms.uTime, uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.name = 'shafts';
    m.renderOrder = 20;
    m.frustumCulled = false;
    return m;
  }
}
