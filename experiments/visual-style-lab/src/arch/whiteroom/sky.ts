import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/glsl.ts';

/**
 * whiteroom の空（場面の空のドームの代わり。SceneDef.sky = false）。
 * 参考画像の空は中庭ごとに違う: 回廊の中庭（0）と沈んだ中庭（2）は白に近い淡い緑の曇り空、
 * 庇の中庭（1）は壁より暗い灰青緑の曇り空に、横に引いた筆の跡が重なる。
 * 物に掛かる霧の色（場面の見た目の fog）とは別に、空の色だけを区域ごとに変える（set）。
 */
export interface SkyLook {
  horizon: string;
  zenith: string;
  /** 筆の跡の色と量（0 で無し） */
  stroke: string;
  strokeAmt: number;
  /**
   * 雲の帯（参考画像の視点の画角より上だけ。from = 出始める高さの sin）: 横に長い淡い灰緑の塊を乾いた筆の跡で置く。
   * 参考画像 1 の空の「横に引いた大きな筆の塊」を、写っていない上の空にも（3 回目の直し: 平らな白い空に少しの形）
   */
  cloud?: { color: string; amount: number; from: number };
}

export function createWrSky(look: SkyLook): { mesh: THREE.Mesh; set(l: SkyLook): void } {
  const u = {
    uH: { value: new THREE.Color(look.horizon) },
    uZ: { value: new THREE.Color(look.zenith) },
    uS: { value: new THREE.Color(look.stroke) },
    uSA: { value: look.strokeAmt },
    uC: { value: new THREE.Color(look.cloud?.color ?? look.zenith) },
    uCA: { value: new THREE.Vector2(look.cloud?.amount ?? 0, look.cloud?.from ?? 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
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
      uniform vec3 uH;
      uniform vec3 uZ;
      uniform vec3 uS;
      uniform float uSA;
      uniform vec3 uC;
      uniform vec2 uCA;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(uH, uZ, smoothstep(0.0, 0.5, d.y));
        // 空の筆の跡は地平線ぎわで消す（霧の色との継ぎ目を出さない）
        if (uSA > 0.0 && d.y > 0.0) {
          // 横に引いた筆の跡（方位と仰角の升目。横に長い）
          float az = atan(d.x, d.z);
          vec2 p = vec2(az * 9.0, d.y * 38.0);
          float row = floor(p.y);
          p.x += sl_hash12(vec2(row, 1.0)) * 5.0;
          vec2 id = floor(p);
          float h = sl_hash12(id);
          float on = step(0.45, h) * smoothstep(0.0, 0.08, fract(p.y)) * smoothstep(1.0, 0.92, fract(p.y));
          float v = sl_fbm(vec3(az * 3.0, d.y * 6.0, 0.0), 3);
          float fade = smoothstep(0.0, 0.05, d.y);
          c = mix(c, uS, (on * uSA * (0.6 + 0.4 * h) + max(v, 0.0) * uSA * 0.6) * fade);
        }
        // 雲の帯: 横に長い塊（方位で 1.4、高さで 9 の割合のねじれたノイズ）。縁は乾いた筆のように横の段でちぎる
        if (uCA.x > 0.0 && d.y > uCA.y) {
          float az2 = atan(d.x, d.z);
          float rowc = floor(d.y * 60.0);
          float jag = (sl_hash12(vec2(rowc, floor(az2 * 14.0))) - 0.5) * 0.08;
          float n = sl_fbm(vec3(az2 * 1.4 + jag, d.y * 9.0, 5.0), 4);
          float band = smoothstep(0.02, 0.06, n) * smoothstep(uCA.y, uCA.y + 0.12, d.y);
          float inner = 0.75 + 0.25 * sl_hash12(vec2(rowc, floor(az2 * 6.0)));
          c = mix(c, uC, band * uCA.x * inner);
        }
        gl_FragColor = vec4(c, 1.0);
        gInfo = vec4(0.5, 0.5, 0.0, 0.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.name = 'sky';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (_r, _s, cam) => {
    mesh.position.setFromMatrixPosition(cam.matrixWorld);
    mesh.updateMatrixWorld();
  };
  return {
    mesh,
    set(l) {
      u.uH.value.set(l.horizon);
      u.uZ.value.set(l.zenith);
      u.uS.value.set(l.stroke);
      u.uSA.value = l.strokeAmt;
      u.uC.value.set(l.cloud?.color ?? l.zenith);
      u.uCA.value.set(l.cloud?.amount ?? 0, l.cloud?.from ?? 1);
    },
  };
}
