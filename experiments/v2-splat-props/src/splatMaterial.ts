/**
 * スプラットの粒の色の後処理（Spark の worldModifier。粒の中心・向きはワールド座標）。v2 の世界の検証・見本の部屋で共通。
 *   1. 負の色を切り捨てる（Spark は粒の色を pow(色, 2.2) するので負だと NaN になる）
 *   2. 懐中電灯で照らし直す（v2 の SpotLight と同じ: 円錐 + ペナンブラ 1.0 + 放射状の減衰マップ、拡散 × 0.4、GGX の鏡面）。
 *      粒ごとの地の色・粗さ・金属度は splatbuild.ts の buildMaterialTexture のテクスチャから引く
 *   3. 霧（v2 と同じ色・距離。部屋固有の霧があればそれ）
 */
import * as THREE from 'three';
import { dyno, SplatMesh, type ExtSplats } from '@sparkjsdev/spark';

/** ゲームの scene と懐中電灯（v2 の ClientGame の必要な所） */
export interface LightingSource {
  scene: THREE.Scene;
  camera: THREE.Camera;
}

export class SplatLighting {
  readonly camPos = new dyno.DynoVec3({ value: new THREE.Vector3() });
  private readonly sceneFog = { color: new dyno.DynoVec3({ value: new THREE.Vector3() }), near: new dyno.DynoFloat({ value: 8 }), far: new dyno.DynoFloat({ value: 46 }) };
  /** 懐中電灯（全部の粒で共有する uniform。毎フレーム v2 の SpotLight から写す） */
  private readonly flash = {
    on: new dyno.DynoFloat({ value: 0 }),
    pos: new dyno.DynoVec3({ value: new THREE.Vector3() }),
    dir: new dyno.DynoVec3({ value: new THREE.Vector3(0, 0, -1) }),
    color: new dyno.DynoVec3({ value: new THREE.Vector3() }),
    distance: new dyno.DynoFloat({ value: 22 }),
    coneCos: new dyno.DynoFloat({ value: Math.cos(Math.PI / 4.2) }),
    tanAngle: new dyno.DynoFloat({ value: Math.tan(Math.PI / 4.2) }),
    gloss: new dyno.DynoFloat({ value: 1 }),
    roughScale: new dyno.DynoFloat({ value: 1 }),
  };
  private nextKey = 1;

  /** 毎フレーム: カメラの位置・霧・懐中電灯を v2 のゲームから写す */
  update(g: LightingSource, gloss: number, roughScale: number): void {
    g.camera.getWorldPosition(this.camPos.value);
    const fog = g.scene.fog as THREE.Fog | null;
    if (fog) {
      this.sceneFog.color.value.set(fog.color.r, fog.color.g, fog.color.b);
      this.sceneFog.near.value = fog.near;
      this.sceneFog.far.value = fog.far;
    } else {
      this.sceneFog.near.value = 1e6;
      this.sceneFog.far.value = 2e6;
    }
    const light = (g as unknown as { flashlight?: { light?: THREE.SpotLight } | null }).flashlight?.light;
    const f = this.flash;
    f.gloss.value = gloss;
    f.roughScale.value = roughScale;
    if (!light || !light.visible || light.intensity <= 0) { f.on.value = 0; return; }
    f.on.value = 1;
    light.getWorldPosition(f.pos.value);
    const target = light.target.getWorldPosition(new THREE.Vector3());
    // three の SpotLight の向き = 位置 − 目標（照らす面から光へ向かう向きとの内積で円錐の中か決める）
    f.dir.value.copy(f.pos.value).sub(target).normalize();
    f.color.value.set(light.color.r, light.color.g, light.color.b).multiplyScalar(light.intensity);
    f.distance.value = light.distance;
    f.coneCos.value = Math.cos(light.angle);
    f.tanAngle.value = Math.tan(light.angle);
  }

  /** 粒の入れ物（ExtSplats）と粒ごとの材質から SplatMesh を作る。fog は部屋固有の霧（無ければ scene の霧） */
  createMesh(ext: ExtSplats, matTex: THREE.DataArrayTexture, name: string, fog: { color: THREE.Vector3; near: number; far: number } | null = null): SplatMesh {
    const fogColor = fog ? new dyno.DynoVec3({ value: fog.color.clone() }) : this.sceneFog.color;
    const fogNear = fog ? new dyno.DynoFloat({ value: fog.near }) : this.sceneFog.near;
    const fogFar = fog ? new dyno.DynoFloat({ value: fog.far }) : this.sceneFog.far;
    const cam = this.camPos;
    const f = this.flash;
    const mat = new dyno.DynoSampler2DArray({ value: matTex, key: `splatPropMat${this.nextKey++}` });
    const modifier = dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
      const lit = new dyno.Dyno({
        inTypes: {
          gsplat: dyno.Gsplat, cam: 'vec3', fogColor: 'vec3', near: 'float', far: 'float', mat: 'sampler2DArray',
          fOn: 'float', fPos: 'vec3', fDir: 'vec3', fColor: 'vec3', fDist: 'float', fCone: 'float', fTan: 'float', fGloss: 'float', fRough: 'float',
        },
        outTypes: { gsplat: dyno.Gsplat },
        globals: () => [dyno.unindent(`
          float splatPropBeam(float r) {
            if (r >= 1.0) return 0.0;
            float core = exp(-(r / 0.34) * (r / 0.34)) * 0.7;
            float halo = pow(1.0 - r, 1.6) * 0.3;
            return clamp((core + halo) * (1.0 - r * r * 0.85), 0.0, 1.0);
          }
          vec3 splatPropCap(vec3 s) {
            float m = max(max(s.r, s.g), s.b);
            if (m <= 0.4) return s;
            float e = m - 0.4;
            return s * ((0.4 + e / (1.0 + e / 0.6)) / m);
          }
        `)],
        statements: ({ inputs, outputs }) => dyno.unindentLines(`
          ${outputs.gsplat} = ${inputs.gsplat};
          vec3 lin = pow(max(${inputs.gsplat}.rgba.rgb, vec3(0.0)), vec3(2.2));
          if (${inputs.fOn} > 0.5) {
            vec3 P = ${inputs.gsplat}.center;
            vec3 N = normalize(quatVec(${inputs.gsplat}.quaternion, vec3(0.0, 0.0, 1.0)));
            vec3 L = ${inputs.fPos} - P;
            float dist = length(L);
            L /= max(dist, 1e-4);
            vec3 V = normalize(${inputs.cam} - P);
            // 薄い物（葉・紙・布）は両面に粒がある。見ている側の面だけを照らす
            float ndl = dot(N, L);
            float angleCos = dot(L, ${inputs.fDir});
            if (ndl > 0.0 && dot(N, V) > -0.05 && angleCos > ${inputs.fCone}) {
              ivec3 tc = splatTexCoord(${inputs.gsplat}.index);
              vec4 m0 = texelFetch(${inputs.mat}, ivec3(tc.xy, 0), 0);
              float metal = texelFetch(${inputs.mat}, ivec3(tc.xy, 1), 0).r;
              float falloff = 1.0 / max(dist * dist, 0.01);
              float cutoff = pow(clamp(1.0 - pow(dist / ${inputs.fDist}, 4.0), 0.0, 1.0), 2.0);
              float spot = smoothstep(${inputs.fCone}, 1.0, angleCos);
              float theta = acos(clamp(angleCos, -1.0, 1.0));
              float beam = splatPropBeam(tan(theta) / ${inputs.fTan});
              vec3 E = ${inputs.fColor} * (ndl * falloff * cutoff * spot * beam);
              vec3 albedo = m0.rgb;
              float rough = clamp(max(m0.a, 0.0525) * ${inputs.fRough}, 0.0525, 1.0);
              lin += albedo * (1.0 - metal) * (0.4 / PI) * E;
              float ndv = max(dot(N, V), 1e-3);
              vec3 H = normalize(L + V);
              float ndh = max(dot(N, H), 0.0);
              float vdh = max(dot(V, H), 0.0);
              float a = rough * rough;
              float a2 = a * a;
              float vis = 0.5 / max(ndl * sqrt(a2 + (1.0 - a2) * ndv * ndv) + ndv * sqrt(a2 + (1.0 - a2) * ndl * ndl), 1e-6);
              float den = ndh * ndh * (a2 - 1.0) + 1.0;
              float D = a2 / (PI * den * den);
              vec3 f0 = mix(vec3(0.04), albedo, metal);
              vec3 F = f0 + (1.0 - f0) * pow(1.0 - vdh, 5.0);
              lin += splatPropCap(E * F * vis * D) * ${inputs.fGloss};
            }
          }
          float fogK = smoothstep(${inputs.near}, ${inputs.far}, distance(${inputs.gsplat}.center, ${inputs.cam}));
          lin = mix(lin, ${inputs.fogColor}, fogK);
          ${outputs.gsplat}.rgba.rgb = pow(lin, vec3(1.0 / 2.2));
        `),
      });
      return {
        gsplat: lit.apply({
          gsplat: gsplat!, cam, fogColor, near: fogNear, far: fogFar, mat,
          fOn: f.on, fPos: f.pos, fDir: f.dir, fColor: f.color, fDist: f.distance, fCone: f.coneCos, fTan: f.tanAngle, fGloss: f.gloss, fRough: f.roughScale,
        }).gsplat,
      };
    });
    const mesh = new SplatMesh({ extSplats: ext, worldModifier: modifier, raycastable: false, editable: false });
    // 霧・懐中電灯はカメラの位置で変わるので、SH が無い粒もカメラが動いたら作り直す
    mesh.enableViewToObject = true;
    mesh.name = name;
    return mesh;
  }
}

/** 深さだけを書く代役の材質（法線の逆へ 4 mm 縮める。面の上の粒が深さで消えないように） */
let DEPTH_PROXY: THREE.MeshBasicMaterial | null = null;
export function depthProxyMaterial(): THREE.MeshBasicMaterial {
  if (DEPTH_PROXY) return DEPTH_PROXY;
  const m = new THREE.MeshBasicMaterial({ colorWrite: false });
  m.name = 'splat-props:depthProxy';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed -= normalize(normal) * 0.004;');
  };
  m.customProgramCacheKey = () => 'splat-props:depthProxy';
  DEPTH_PROXY = m;
  return m;
}
