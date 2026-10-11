import * as THREE from 'three';
import { COLOR_GLSL, NOISE_GLSL } from '../../render/glsl.ts';
import { styleUniforms } from '../../render/Style.ts';
import { FOG_GLSL } from '../../render/StyleMaterial.ts';
import { rng } from '../../scenes/Builder.ts';

/**
 * 部屋の中に浮かぶ泡（classroom-0 の小さな丸。縁が暗い線・上の左に白い光・中は透ける）。
 * 決まった乱数で部屋の箱の中に置き、ゆっくり上がって天井の下で消える（歩いている時だけ動く。撮影は時刻 0）。
 * 1 回で描く（InstancedMesh・目の方を向く板）。霧は材質と同じ
 */

export interface BubbleVolume {
  /** 箱 [x0, y0, z0, x1, y1, z1] と数・大きさ（直径 m の範囲） */
  box: [number, number, number, number, number, number];
  count: number;
  size: [number, number];
  /** 窓ぎわに寄せる（0〜1。x の小さい方ほど多く） */
  window?: number;
  /** 置かない所（x, z と箱の高さの範囲で判定。泡は上下に動くので縦の線で見る）。参考画像の視点から見える所など */
  exclude?: (x: number, z: number, y0: number, y1: number) => boolean;
}

const VS = /* glsl */ `
attribute vec4 aB; // 中心 xyz・直径
attribute vec4 aP; // 上がる速さ・ゆれの位相・箱の下端・箱の高さ
uniform float uBT;
varying vec2 vUv;
varying vec3 vW;
varying float vFade;
void main() {
  vUv = uv;
  vec3 c = aB.xyz;
  float h = aP.w;
  float y = mod(c.y - aP.z + uBT * aP.x, h);
  c.y = aP.z + y;
  c.x += sin(uBT * 0.7 + aP.y) * 0.04;
  c.z += cos(uBT * 0.6 + aP.y * 1.3) * 0.04;
  // 箱の上下の端で小さく
  vFade = smoothstep(0.0, 0.15, y / h) * (1.0 - smoothstep(0.85, 1.0, y / h));
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * aB.w * vFade;
  vW = c;
  gl_Position = projectionMatrix * mv;
}`;

const FS = /* glsl */ `
layout(location = 1) out highp vec4 gInfo;
varying vec2 vUv;
varying vec3 vW;
varying float vFade;
uniform vec3 uRim;
uniform vec3 uInk;
uniform vec3 uFill;
${NOISE_GLSL}
${COLOR_GLSL}
${FOG_GLSL}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0 || vFade < 0.05) discard;
  // 淡い泡: 明るい細い縁（上ほど明るい）・左上に白い光・中はほとんど透ける。暗い線は使わない
  float ring = smoothstep(0.7, 0.86, r) * (1.0 - smoothstep(0.92, 1.0, r));
  float hl = 1.0 - smoothstep(0.16, 0.28, length(p - vec2(-0.33, 0.36)));
  float lit = 0.55 + 0.45 * smoothstep(-0.8, 0.8, p.y - p.x * 0.4);
  vec3 col = mix(uFill, uRim, ring * lit);
  col = mix(col, vec3(1.0), hl);
  float a = max(max(ring * (0.55 + 0.45 * lit), hl), 0.12);
  vec3 cam = cameraPosition;
  col = sl_applyFog(col, vW, cam);
  gl_FragColor = vec4(col, a);
  gInfo = vec4(0.5, 0.5, 0.0, 0.0);
}`;

export function createBubbles(vols: BubbleVolume[], seed = 3): { mesh: THREE.Mesh; tick: (t: number) => void } {
  const r = rng(seed);
  const total = vols.reduce((a, v) => a + v.count, 0);
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const aB = new Float32Array(total * 4);
  const aP = new Float32Array(total * 4);
  let i = 0;
  for (const v of vols) {
    const [x0, y0, z0, x1, y1, z1] = v.box;
    for (let k = 0; k < v.count; k++, i++) {
      // 窓ぎわに寄せる: x を小さい方へ偏らせる
      const u = v.window ? Math.pow(r(), 1 + v.window * 1.5) : r();
      const big = r() < 0.12;
      const d = big ? v.size[1] * (0.6 + r() * 0.4) : v.size[0] + Math.pow(r(), 2) * (v.size[1] - v.size[0]) * 0.4;
      let px = x0 + u * (x1 - x0);
      const py = y0 + r() * (y1 - y0);
      let pz = z0 + r() * (z1 - z0);
      // 置かない所なら選び直す（決まった回数まで。だめなら箱の外の遠くへ置かず、大きさ 0）
      let ok = true;
      for (let tries = 0; v.exclude && v.exclude(px, pz, y0, y1); tries++) {
        if (tries > 20) {
          ok = false;
          break;
        }
        px = x0 + r() * (x1 - x0);
        pz = z0 + r() * (z1 - z0);
      }
      aB.set([px, py, pz, ok ? d : 0], i * 4);
      aP.set([0.02 + r() * 0.06, r() * 6.28, y0, y1 - y0], i * 4);
    }
  }
  geo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
  geo.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 4));
  geo.instanceCount = total;
  const uBT = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...styleUniforms, uBT, uRim: { value: new THREE.Color('#c8f6fb') }, uInk: { value: new THREE.Color('#5f9fbf') }, uFill: { value: new THREE.Color('#8fd0e2') } },
    vertexShader: VS,
    fragmentShader: FS,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'bubbles';
  mesh.layers.set(0);
  return { mesh, tick: (t) => (uBT.value = t) };
}
