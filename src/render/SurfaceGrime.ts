import type * as THREE from 'three';

/**
 * 汚れ層（手続き。テクスチャを読まない）: 現実の表面にある「ムラ」を材質の上に薄く重ねる。
 * SurfaceAppearance（壁・床の色ムラ、床の通り道・扉の擦れ・壁際の埃・水際の濡れ）とは独立に、より広い材質へ効く。
 *
 * 分類ごとの中身（強さは surfaceGrime uniform。Tier で変える。0 で無効）:
 * - 共通: 3 段のノイズ（約 3 m / 40 cm / 9 cm）で明度 ±4%・粗さ ±0.05 のムラ
 * - wall:  床から 25 cm の蹴り跡・黒ずみ、手の高さ（0.8〜1.5 m）の手垢、上から下へ薄い垂れ筋
 * - floor: 大きなくすみの斑と、細かな汚れの点在（通り道の擦れは SurfaceAppearance）
 * - ceiling: 黄ばみの斑（煙草・経年）
 * - object: 面取りの辺だけ塗装が擦れて明るく・艶が出る（ChamferBox の斜め法線を拾う）、上面の埃、床際 10 cm の汚れ
 * - metal:  object と同じ + 指紋・拭き跡の艶ムラ（粗さの斑を強めに）
 *
 * 座標は部屋ローカル（vRoomPos、injectCommon が宣言）と、頂点の幾何法線（部屋の配置回転は 90° 刻みなので |成分| は不変）。
 * 部屋ごとの位相は modelMatrix の平行移動のハッシュ（同じ定義の部屋でも汚れが同じ場所に並ばない。uniform・属性は不要）
 */
export type GrimeClass = 'wall' | 'floor' | 'ceiling' | 'object' | 'metal';

/** 汚れ層を掛ける材質の分類。発光・ガラス・水・空・画面・特殊（void / placeholder / untextured / デカール）は null */
export function grimeClass(id: string): GrimeClass | null {
  if (/^(light|led|neon|screen(Glow|Lcd)|sky|water|puddle|glass|carGlass|windowNight|windowLit|windowDark|sodiumLight|signEmissive|void|placeholder|untextured|shadowDecal|aquariumBlue|ice|snow|grass|plant|yellowLine)/.test(id)) return null;
  if (/^(wall|wainscot|woodPanel|paintWhite|redShutter|noticeGreen|chalkboard|siding)/.test(id)) return 'wall';
  if (/^(floor|marbleFloor|carpetPattern)/.test(id)) return 'floor';
  if (/^ceiling/.test(id)) return 'ceiling';
  if (/^(metal|stainless|shelfMetal|goldTrim|locker|doorMetal|carPaint)/.test(id)) return 'metal';
  if (/^(door|furniture|trim|handrail|seat|plastic|bookshelf|upholstery|whiteFabric|marbleWhite|boxCardboard|columnConcrete|rubber|signPlate)/.test(id)) return 'object';
  return null;
}

const GRIME_PARS_GLSL = /* glsl */ `
uniform float surfaceGrime;
varying vec3 vGrimeNormal;
varying float vGrimePhase;
float grimeHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float grimeNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(grimeHash(i), grimeHash(i + vec3(1, 0, 0)), f.x), mix(grimeHash(i + vec3(0, 1, 0)), grimeHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(grimeHash(i + vec3(0, 0, 1)), grimeHash(i + vec3(1, 0, 1)), f.x), mix(grimeHash(i + vec3(0, 1, 1)), grimeHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

/** 分類ごとの本体。grimeShade（明度の倍率）/ grimeTint（色の混ぜ先と量）/ grimeRough（粗さの加算）を決める */
function bodyGlsl(cls: GrimeClass): string {
  const common = /* glsl */ `
  vec3 grimeP = vRoomPos + vec3(vGrimePhase * 61.7, vGrimePhase * 13.1, vGrimePhase * 97.3);
  float grimeMacro = grimeNoise(grimeP * 0.33);
  float grimeMid = grimeNoise(grimeP * 2.5 + 17.0);
  float grimeFine = grimeNoise(grimeP * 11.0 + 41.0);
  vec3 grimeN = normalize(vGrimeNormal);
  vec3 grimeA = abs(grimeN);
  float grimeShade = 1.0 + ((grimeMacro - 0.5) * 0.08 + (grimeMid - 0.5) * 0.04) * surfaceGrime;
  float grimeRough = ((grimeMacro - 0.5) * 0.06 + (grimeFine - 0.5) * 0.04) * surfaceGrime;
  vec3 grimeTintColor = vec3(0.30, 0.26, 0.20);
  float grimeTint = 0.0;
  `;
  switch (cls) {
    case 'wall':
      return common + /* glsl */ `
  float grimeY = vRoomPos.y;
  // 床際の蹴り跡・黒ずみ（25 cm。上端をノイズで揺らす）
  float grimeKick = (1.0 - smoothstep(0.02, 0.25 + (grimeMid - 0.5) * 0.12, grimeY)) * smoothstep(0.25, 0.75, grimeFine * 0.6 + grimeMid * 0.4);
  // 手の高さの手垢（点在する楕円の斑）
  float grimeHand = smoothstep(0.75, 0.95, grimeY) * (1.0 - smoothstep(1.35, 1.6, grimeY)) * smoothstep(0.62, 0.8, grimeNoise(grimeP * vec3(3.0, 5.0, 3.0) + 7.0));
  // 上から下への垂れ筋（縦に伸ばしたノイズ。弱く）
  float grimeStreak = smoothstep(0.7, 0.95, grimeNoise(grimeP * vec3(9.0, 0.35, 9.0) + 3.0)) * smoothstep(0.4, 1.8, grimeY);
  grimeTint = (grimeKick * 0.35 + grimeHand * 0.12 + grimeStreak * 0.07) * surfaceGrime;
  grimeRough += (grimeKick * 0.06 - grimeHand * 0.12) * surfaceGrime;
  `;
    case 'floor':
      return common + /* glsl */ `
  float grimeBlot = smoothstep(0.55, 0.85, grimeMacro) * 0.6 + smoothstep(0.7, 0.9, grimeFine) * 0.4;
  grimeTint = grimeBlot * 0.14 * surfaceGrime;
  grimeRough += grimeBlot * 0.05 * surfaceGrime;
  `;
    case 'ceiling':
      return common + /* glsl */ `
  grimeTintColor = vec3(0.62, 0.52, 0.30);
  grimeTint = smoothstep(0.58, 0.9, grimeMacro * 0.7 + grimeMid * 0.3) * 0.22 * surfaceGrime;
  `;
    case 'object':
    case 'metal':
      return common + /* glsl */ `
  // 面取りの辺（法線が軸から外れた所）: 擦れて明るく、艶が出る
  float grimeEdge = (1.0 - smoothstep(0.86, 0.985, max(grimeA.x, max(grimeA.y, grimeA.z)))) * smoothstep(0.3, 0.7, grimeMid);
  // 上面の埃
  float grimeTop = smoothstep(0.9, 0.99, grimeN.y) * smoothstep(0.35, 0.8, grimeMid * 0.5 + grimeFine * 0.5);
  // 床際（家具の脚元・扉の下端）の汚れ
  float grimeLow = 1.0 - smoothstep(0.02, 0.12, vRoomPos.y);
  grimeShade *= 1.0 + grimeEdge * ${cls === 'metal' ? '0.10' : '0.14'} * surfaceGrime;
  grimeRough += (-grimeEdge * ${cls === 'metal' ? '0.18' : '0.12'} + grimeTop * 0.16) * surfaceGrime;
  grimeTint = (grimeLow * 0.3 * grimeMid) * surfaceGrime;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.54, 0.5) * dot(diffuseColor.rgb, vec3(0.333)) + 0.04, grimeTop * 0.18 * surfaceGrime);
  ${cls === 'metal' ? 'grimeRough += (smoothstep(0.55, 0.8, grimeNoise(grimeP * vec3(7.0, 4.0, 7.0) + 29.0)) - 0.3) * 0.14 * surfaceGrime;' : ''}
  `;
  }
}

interface GrimeShader { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform>; }

/**
 * MaterialLibrary の onBeforeCompile から呼ぶ。injectCommon（vRoomPos の宣言）と addSurfaceAppearance（map_fragment を展開する）より
 * 前に呼ぶこと: ここでは `#include <map_fragment>` / `#include <roughnessmap_fragment>` の直後に足すだけで、include 自体は残す
 */
export function addSurfaceGrime(shader: GrimeShader, cls: GrimeClass, strength: THREE.IUniform<number>): void {
  shader.uniforms.surfaceGrime = strength;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGrimeNormal; varying float vGrimePhase;');
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vGrimeNormal = objectNormal;
vGrimePhase = fract(sin(dot(floor(modelMatrix[3].xz * 0.25), vec2(12.9898, 78.233))) * 43758.5453);`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GRIME_PARS_GLSL}`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
${bodyGlsl(cls)}
  diffuseColor.rgb = mix(diffuseColor.rgb * grimeShade, grimeTintColor * dot(diffuseColor.rgb, vec3(0.4)), clamp(grimeTint, 0.0, 0.6));`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + grimeRough, 0.04, 1.0);');
}
