import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import type { Looks } from './looks.ts';
import { LIGHT_GLSL, lightU } from './mat.ts';

/**
 * 駅の空。霧の色の関数（st_fogColor）と同じなので、霧に溶けた物と継ぎ目が出ない。
 * 地平線の少し上に淡い雲の帯（station-3 の空のもや）。カメラに付いて動く。
 */
export function createStationSky(o: { cloudColor: THREE.ColorRepresentation; hillColor: THREE.ColorRepresentation; looks: Looks }): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      ...lightU,
      uCloudColor: { value: new THREE.Color(o.cloudColor) },
      uHillColor: { value: new THREE.Color(o.hillColor) },
    },
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
      uniform float uTime;
      uniform vec3 uCloudColor;
      uniform float uStClouds;
      uniform float uStHills;
      uniform vec3 uHillColor;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      ${LIGHT_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = st_fogColor(d);
        float az = atan(d.x, d.z);
        if (uStClouds > 0.0 && d.y > -0.02) {
          // 地平線の少し上の雲のかたまり（空より少し暗く青い）。上の縁は丸く盛り上がる
          float top = 0.06 + 0.055 * (sl_fbm(vec3(az * 1.6, 7.7, 1.0), 4) * 0.5 + 0.5);
          float n = sl_fbm(vec3(az * 3.0, d.y * 14.0, 3.1), 4) * 0.5 + 0.5;
          float body = 1.0 - smoothstep(top - 0.03, top + 0.004, d.y + (n - 0.5) * 0.04);
          float k = body * smoothstep(0.0, 0.02, d.y) * uStClouds;
          // 雲の上の縁は少し明るい（日を受ける）
          vec3 cc = mix(uCloudColor, c, smoothstep(top - 0.05, top, d.y) * 0.5);
          c = mix(c, cc, k);
        }
        if (uStHills > 0.0 && d.y > -0.03) {
          // 遠くの低い丘（地平線の少し上まで、なだらかな上の縁）
          float h = 0.002 + 0.02 * smoothstep(0.45, 0.8, sl_fbm(vec3(az * 2.4, 3.3, 9.1), 4) * 0.5 + 0.5);
          float k = 1.0 - smoothstep(h - 0.002, h + 0.002, d.y);
          c = mix(c, uHillColor, k * uStHills);
        }
        gl_FragColor = vec4(c, 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'station-sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (_r, _s, cam) => {
    mesh.position.setFromMatrixPosition(cam.matrixWorld);
    mesh.updateMatrixWorld();
    // 場所ごとの空気の色（映り込みのカメラも同じ x, z なので同じ色になる）
    o.looks.apply(mesh.position.x, mesh.position.z);
  };
  return mesh;
}
