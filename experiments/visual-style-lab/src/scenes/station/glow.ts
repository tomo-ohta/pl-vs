import * as THREE from 'three';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { lightU } from './mat.ts';

/**
 * 蛍光灯のにじみ（アニメの撮影の透過光）。管の軸のまわりでカメラを向く板を加算で重ねる。
 * 後処理のブルームは画面全体に広く広がるので弱くし、管のまわりの柔らかい光はこちらで出す。
 */
export interface Tube {
  /** 管の中心と軸（単位ベクトル）、長さ */
  c: [number, number, number];
  axis: [number, number, number];
  len: number;
}

export function createTubeGlow(tubes: Tube[], o: { radius: number; color: THREE.ColorRepresentation; strength: number }): THREE.Mesh {
  const n = tubes.length;
  const pos = new Float32Array(n * 4 * 3);
  const axis = new Float32Array(n * 4 * 4);
  const corner = new Float32Array(n * 4 * 2);
  const idx: number[] = [];
  tubes.forEach((t, i) => {
    for (let k = 0; k < 4; k++) {
      const j = i * 4 + k;
      pos.set(t.c, j * 3);
      axis.set([...t.axis, t.len / 2], j * 4);
      corner.set([k & 1 ? 1 : -1, k & 2 ? 1 : -1], j * 2);
    }
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAxis', new THREE.BufferAttribute(axis, 4));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      ...lightU,
      uR: { value: o.radius },
      uColor: { value: new THREE.Color(o.color).multiplyScalar(o.strength) },
    },
    vertexShader: /* glsl */ `
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
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      uniform vec3 uColor;
      uniform float uR;
      uniform vec2 uStTubeGlow;
      uniform vec3 uStTubeCol;
      varying vec2 vUV;
      varying float vHalf;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      void main() {
        float d = length(vec2(max(abs(vUV.x) - vHalf, 0.0), vUV.y)) / (uR * uStTubeGlow.y);
        // 芯に近い明るいにじみと、広く薄いにじみ
        float a = exp(-d * d * 9.0) * 0.6 + exp(-d * 3.2) * 0.4;
        a *= smoothstep(1.0, 0.75, d);
        float od = sl_fogOptical(vWorld, cameraPosition);
        gl_FragColor = vec4(uColor * uStTubeCol * uStTubeGlow.x * a * exp(-od), 1.0);
        gInfo = vec4(0.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'tube-glow';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}
