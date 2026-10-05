/**
 * v2 の材質が使う環境マップ（部屋ごとの PMREM）を、粗さの段ごとに緯度経度の小さな画像へ読み出す。
 * 環境の映り込み（見る向きで変わる色）を CPU（Worker）で SH に入れるため。
 * 読み出しは three の textureCubeUV（cube_uv_reflection_fragment）をそのまま使うので、v2 の材質と同じ値になる。
 */
import * as THREE from 'three';

/** 粗さの段 */
export const ENV_LEVELS = [0, 0.08, 0.16, 0.28, 0.42, 0.6, 0.8, 1];
export const ENV_W = 64;
export const ENV_H = 32;

/** 段ごとの RGB（ENV_W × ENV_H × 3、行は θ = 0（真上）→ π（真下）） */
export type EnvProbe = Float32Array[];

const cache = new WeakMap<THREE.Texture, EnvProbe>();

export function envProbe(renderer: THREE.WebGLRenderer, envMap: THREE.Texture): EnvProbe {
  const hit = cache.get(envMap);
  if (hit) return hit;
  const h = (envMap.image as { height: number }).height;
  // three の WebGLPrograms の generateCubeUVSize と同じ
  const maxMip = Math.log2(h) - 2;
  const texelHeight = 1 / h;
  const texelWidth = 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16));
  const material = new THREE.ShaderMaterial({
    defines: { ENVMAP_TYPE_CUBE_UV: '', CUBEUV_TEXEL_WIDTH: String(texelWidth), CUBEUV_TEXEL_HEIGHT: String(texelHeight), CUBEUV_MAX_MIP: `${maxMip}.0` },
    uniforms: { envMap: { value: envMap }, roughness: { value: 0 }, size: { value: new THREE.Vector2(ENV_W, ENV_H) } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D envMap;
      uniform float roughness;
      uniform vec2 size;
      #include <common>
      #include <cube_uv_reflection_fragment>
      void main() {
        vec2 uv = gl_FragCoord.xy / size;
        float phi = uv.x * 2.0 * PI;
        float theta = uv.y * PI;
        vec3 dir = vec3(sin(theta) * cos(phi), cos(theta), sin(theta) * sin(phi));
        gl_FragColor = vec4(textureCubeUV(envMap, dir, roughness).rgb, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();
  const rt = new THREE.WebGLRenderTarget(ENV_W, ENV_H, { type: THREE.FloatType, depthBuffer: false });
  const prev = renderer.getRenderTarget();
  const out: EnvProbe = [];
  const buf = new Float32Array(ENV_W * ENV_H * 4);
  try {
    for (const r of ENV_LEVELS) {
      material.uniforms.roughness!.value = r;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(rt, 0, 0, ENV_W, ENV_H, buf);
      const rgb = new Float32Array(ENV_W * ENV_H * 3);
      for (let i = 0; i < ENV_W * ENV_H; i++) { rgb[i * 3] = buf[i * 4]!; rgb[i * 3 + 1] = buf[i * 4 + 1]!; rgb[i * 3 + 2] = buf[i * 4 + 2]!; }
      out.push(rgb);
    }
  } finally {
    renderer.setRenderTarget(prev);
    rt.dispose();
    material.dispose();
    quad.geometry.dispose();
  }
  cache.set(envMap, out);
  return out;
}
