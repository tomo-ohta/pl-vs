import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from './glsl.ts';
import { FOG_GLSL } from './StyleMaterial.ts';
import { styleUniforms } from './Style.ts';

export interface SkyOptions {
  /** 雲（霧の色に重ねる淡い帯）の強さ。0 で無し */
  clouds?: number;
  cloudColor?: THREE.ColorRepresentation;
  /** 雲の高さ（仰角の中心・幅） */
  cloudBand?: [number, number];
  cloudScale?: number;
  /**
   * 空だけの明るさの倍率と、寄せる色（霧の色はそのまま。物に掛かる霧より空を明るくしたい場面）。
   * 地平線の近くは霧に溶けるように、仰角 horizonBlend（既定 0.08）までで 1 から gain へ移す
   */
  gain?: number;
  tint?: THREE.ColorRepresentation;
  tintAmount?: number;
  horizonBlend?: number;
}

/**
 * 空のドーム。霧と同じ色の関数（sl_fogColor）で塗るので、霧に溶けた物と継ぎ目が出ない。
 * カメラに付いて動く（毎フレーム位置を合わせる）。
 */
export function createSky(o: SkyOptions = {}): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...styleUniforms,
      uClouds: { value: o.clouds ?? 0 },
      uCloudColor: { value: new THREE.Color(o.cloudColor ?? 0xffffff) },
      uCloudBand: { value: new THREE.Vector2(...(o.cloudBand ?? [0.12, 0.12])) },
      uCloudScale: { value: o.cloudScale ?? 3 },
      uSkyGain: { value: new THREE.Vector3(o.gain ?? 1, o.tintAmount ?? 0, o.horizonBlend ?? 0.08) },
      uSkyTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
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
      uniform float uClouds;
      uniform vec3 uCloudColor;
      uniform vec2 uCloudBand;
      uniform float uCloudScale;
      uniform vec3 uSkyGain;
      uniform vec3 uSkyTint;
      ${NOISE_GLSL}
      ${COLOR_GLSL}
      ${FOG_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = sl_fogColor(d);
        if (uClouds > 0.0) {
          float band = 1.0 - smoothstep(0.0, uCloudBand.y, abs(d.y - uCloudBand.x));
          vec2 p = d.xz / max(d.y + 0.25, 0.05) * uCloudScale;
          float n = sl_fbm(vec3(p, uTime * 0.01), 5) * 0.5 + 0.5;
          c = mix(c, uCloudColor, smoothstep(0.45, 0.8, n) * band * uClouds);
        }
        if (uSkyGain.x != 1.0 || uSkyGain.y > 0.0) {
          float k = smoothstep(0.0, max(uSkyGain.z, 1e-3), d.y);
          c = mix(c, mix(c * uSkyGain.x, uSkyTint, uSkyGain.y), k);
        }
        gl_FragColor = vec4(c, 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (_r, _s, cam) => {
    mesh.position.setFromMatrixPosition(cam.matrixWorld);
    mesh.updateMatrixWorld();
  };
  return mesh;
}
