import * as THREE from 'three';
import type { PlanarReflector } from '../../render/PlanarReflector.ts';
import type { StyleMaterialOptions } from '../../render/StyleMaterial.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 立方体の大広間の材質。どれも色彩設計の材質（ctx.mat）を半写実（toon: 0）で使い、場所の質感を足す:
 * - 打ち放しのコンクリート: 型枠の目地（横長のパネル 2.4 × 1.2 m）・セパの穴・パネルと打ち込みの区切りごとの明るさ・
 *   箱の上の縁と打ち継ぎから垂れる染み・水際の濡れた帯と苔・谷の底ほど空が見えず暗い（高さで間接光を減らす）。
 *   色は造りに従う（ノイズの斑を面に塗らない。むら・染みの縁はパネル・打ち継ぎ・箱の縁・開口の上に来る）
 * - 水: 平面の鏡像（波でゆがむ・視線が浅いほど強い）
 * - 浸水した通りの板石: 0.9 × 0.6 m の石の割付け（石ごとの明るさ・沈んだ石の水たまり・水の入った目地）と、縁から水がかぶる所（鏡像）
 * - 光る開口（門・扉・窓）: 照明なしの明るい色（ブルームでにじむ）
 * 模様はすべてワールド座標（歩いても泳がない）。
 */

export interface ConcreteOpts {
  color: string;
  name: string;
  /** 型枠のパネル [横, 縦]（m）・目地の幅（m）・目地の暗さ（0..1）・パネルごとの色むら */
  panel?: [number, number];
  joint?: number;
  jointDark?: number;
  panelVar?: number;
  /** セパの穴: パネルあたり [横, 縦] の数・半径（m）・暗さ */
  ties?: [number, number];
  tieR?: number;
  tieDark?: number;
  /** 縦の染み: 量（0..1）・暗さ */
  streak?: number;
  streakDark?: number;
  /** 苔・藻の筋: 量（0..1）・色・上限の高さ（m） */
  moss?: number;
  mossColor?: string;
  mossTop?: number;
  /** 水際の濡れた帯 [下, 上]（m）・暗さ */
  wet?: [number, number];
  wetDark?: number;
  /** 谷の底の暗さ: [この高さで min, この高さで 1]・min（間接光の倍率） */
  ao?: [number, number];
  aoMin?: number;
  /** 下向きの面（張り出しの下）の間接光の倍率 */
  under?: number;
  /**
   * 水路の向き（世界の軸）と、その向きに面する面（目の方を向く正面・奥の面）の間接光の倍率。
   * 水路を横切る向きの面は上の空の帯を正面に見るが、水路に沿う向きの面は細い隙間しか見ない（参考画像で正面が側面より暗い）
   */
  axis?: 'x' | 'z';
  axisDark?: number;
  /** 間接光（空の明るさ）の全体の倍率。日の当たる区域は小さく（日なたと日陰の差が大きい） */
  amb?: number;
  /** 染みの板の材質にする（濃さ 0..1）。開口・窓台・庇の下に貼る板（stainOf で作る） */
  stain?: number;
  /** 打ち込みごとの明るさの違い（0〜） */
  tone?: number;
  /** 細かい粒・筆の跡のにじみの強さ（既定 0.12） */
  grain?: number;
  /** 打ち継ぎの下から垂れる筋の量（0〜1。既定 0.22） */
  drip?: number;
  /**
   * 日の当たる面（描いた光）: この向き（世界）を向く面の明るさの倍率と、その光の色。
   * 1 つの日の影では作れない日なた（参考画像の低い箱の正面だけが明るい）を、その箱の材質で塗る
   */
  sunFace?: { dir: [number, number, number]; gain: number; color: string };
  /**
   * 高い所の霞: [この高さから, この高さまでで最大, 最大の量, 距離の係数]。谷の上の方の空気は日を受けて明るく、遠い上の箱ほど霞む
   * （谷の底の空気は日陰で暗い。core の霧は高さで濃くできないので材質で足す）
   */
  haze?: [number, number, number, number];
  /** そのほかの StyleMaterial の値 */
  extra?: Partial<StyleMaterialOptions>;
}

const CONCRETE_GLSL = /* glsl */ `
uniform vec4 uCqPanel;   // 横, 縦, 目地の幅, 目地の暗さ
uniform vec4 uCqTie;     // 横の数, 縦の数, 半径, 暗さ
uniform vec4 uCqStreak;  // 量, 暗さ, 苔の量, 苔の上限
uniform vec3 uCqMoss;
uniform vec4 uCqWet;     // 下, 上, 暗さ, 色むら
uniform vec4 uCqAo;      // 下, 上, min, 下向きの面の倍率
uniform vec4 uCqAxis;    // 水路の向き xyz, 正面の倍率
uniform float uCqAmb;
uniform float uCqTone;   // 打ち込みごとの明るさの違い
uniform float uCqGrain;  // 細かい粒の強さ
uniform float uCqDrip;   // 垂れの量
uniform vec4 uCqSunDir;  // 日の当たる面の向き・倍率
uniform vec3 uCqSunCol;
uniform vec4 uCqHaze;    // 高い所の霞
uniform float uCqStain;  // 染みの板の濃さ（0 = ふつうの壁）
varying vec2 vCqUv;
float cqAo = 1.0;
`;

const CONCRETE_PATTERN = /* glsl */ `
  {
    vec3 an = abs(slN);
    bool cqWall = an.y < 0.5;
    vec2 cuv = slUV;
    vec2 aa = fwidth(cuv) * 0.75;
    // 1 画素あたりの m（遠いほど細かい模様を消す）
    float far = max(aa.x, aa.y);
    float faceId = floor(dot(slN, vec3(1.0, 2.0, 3.0)) + 0.5);
    // 色は造りに従う: むらは型枠のパネル・打ち込みの区切りごと、染みは箱の上の縁（棚）・打ち継ぎ・開口の下から（塗りの斑は無い）
    vec3 col = diffuseColor.rgb;
    // 箱の上の縁の高さ（place() が uv.y に 1000 + 高さで入れる。無い箱は 3.6 m の打ち継ぎだけ）
    float cqTop = vCqUv.y > 500.0 ? vCqUv.y - 1000.0 : 1.0e4;
    float lift = floor(vSlWorld.y / 3.6);
    // ---- 細かい粒（4 cm）と気泡の穴（あばた）。参考画像の打ち放しのざらつき。遠くでは消す
    {
      // 筆の跡のようなにじみ（16 cm）: 中くらいの距離まで残す
      float fs = 1.0 - smoothstep(0.02, 0.07, far);
      col *= 1.0 + sl_vnoise(vec3(cuv * 6.3, faceId * 1.7)) * uCqGrain * 0.6 * fs;
      float fg = 1.0 - smoothstep(0.008, 0.03, far);
      if (fg > 0.0) {
        float gr = sl_vnoise(vSlWorld * 23.0 + faceId * 7.1) * 0.6 + sl_vnoise(vSlWorld * 61.0 + faceId * 3.3) * 0.4;
        col *= 1.0 + gr * uCqGrain * fg;
        vec2 bc = floor(cuv * 9.0);
        vec3 bh = sl_hash33(vec3(bc, faceId * 2.0 + 1.0));
        float bd = length(fract(cuv * 9.0) - 0.25 - bh.xy * 0.5) / 9.0;
        float bug = step(bh.z, 0.04) * (1.0 - smoothstep(0.005, 0.005 + far, bd));
        col *= 1.0 - bug * 0.45 * fg;
      }
    }
    // 打ち込みごとの明るさ（高さ 3.6 m の段 × 横 3.6 m の区切り。区切りの縁は打ち継ぎの線の上に来る）
    if (cqWall && uCqTone > 0.0) {
      float cut = floor(cuv.x / 3.6);
      float tone = sl_hash12(vec2(cut * 1.7 + faceId * 5.3, lift * 3.1)) - 0.5;
      col *= 1.0 + tone * uCqTone * (1.0 - smoothstep(0.03, 0.12, far));
    }
    // ---- 型枠の割付け（壁は横長のパネル。行ごとに半分ずらす。床・天井は正方形）
    vec2 ps = cqWall ? uCqPanel.xy : vec2(uCqPanel.x);
    vec2 pc = cuv / ps;
    float row = floor(pc.y);
    pc.x += cqWall ? step(0.5, fract(row * 0.5)) * 0.5 : 0.0;
    vec2 cell = floor(pc);
    vec2 f = fract(pc);
    vec2 dl = min(f, 1.0 - f) * ps;
    float jw = uCqPanel.z;
    float fadeJ = 1.0 - smoothstep(0.012, 0.045, far);
    float jx = 1.0 - smoothstep(jw - aa.x, jw + aa.x, dl.x);
    float jy = 1.0 - smoothstep(jw - aa.y, jw + aa.y, dl.y);
    float joint = max(jx, jy) * fadeJ;
    // パネルごとの明るさ（型枠の板ごとに少し違う）
    float pv = (sl_hash12(cell * 1.31 + vec2(faceId * 7.0, 0.0)) - 0.5) * uCqWet.w;
    col *= 1.0 + pv;
    col *= 1.0 - joint * uCqPanel.w * 0.6;
    // ---- 打ち継ぎの線（高さ 3.6 m ごとの横の線・打ち込みの区切りの縦の線）: 太く、下側が少し明るい
    if (cqWall) {
      float py = vSlWorld.y / 3.6;
      float dy = abs(fract(py + 0.5) - 0.5) * 3.6;
      float lw = 0.012 + far * 0.6;
      float pour = (1.0 - smoothstep(lw * 0.5, lw * 1.5, dy)) * (1.0 - smoothstep(0.03, 0.09, far));
      float side = fract(py + 0.5) - 0.5;
      col *= 1.0 - pour * uCqPanel.w * (side > 0.0 ? 1.2 : 0.4);
      // 打ち継ぎの下の影（上の打ち込みがわずかに出ている。下へ 0.15 m でぼける）
      float below = fract(py) * 3.6;
      float shadowBand = 1.0 - smoothstep(0.0, 0.15, below);
      col *= 1.0 - shadowBand * uCqPanel.w * 0.3 * (1.0 - smoothstep(0.02, 0.06, far));
      float vx = abs(fract(cuv.x / 3.6) - 0.5);
      float vline = (1.0 - smoothstep(lw * 0.5 / 3.6, lw * 1.5 / 3.6, 0.5 - vx)) * (1.0 - smoothstep(0.03, 0.09, far));
      col *= 1.0 - vline * uCqPanel.w;
    }
    // ---- セパの穴（パネルの中に横 n × 縦 m）: 暗い穴と明るい縁（Pコンのくぼみ）
    if (uCqTie.x > 0.0 && cqWall) {
      vec2 tp = f * uCqTie.xy;
      vec2 tm = (fract(tp) - 0.5) * ps / uCqTie.xy;
      float tr = uCqTie.z;
      float d = length(tm);
      float fadeT = 1.0 - smoothstep(0.014, 0.05, far);
      float hole = (1.0 - smoothstep(tr - far, tr + far, d)) * fadeT;
      float rim = (1.0 - smoothstep(tr * 1.5 - far, tr * 1.5 + far, d)) * (1.0 - hole) * fadeT;
      col *= 1.0 - hole * uCqTie.w;
      col *= 1.0 + rim * 0.12;
    }
    // ---- 染み（決まり: 箱の上の縁と打ち継ぎの線から下へ垂れる。型枠の 1.2 m の列ごとに、幅・長さ・濃さが違う）。
    // 縁は乾いた筆のかすれ（細かいノイズで縦にちぎる）。3 割は雨に洗われた明るい筋
    float st = 0.0;
    if (cqWall && uCqStreak.x > 0.0) {
      float hz = dot(vSlWorld.xz, vec2(an.z, an.x));
      float ci = floor(hz / 1.2);
      float cx = fract(hz / 1.2);
      float rag = sl_vnoise(vec3(hz * 9.0, vSlWorld.y * 0.8, faceId)) * 0.1;
      // 箱の上の縁の下（強く長い）
      vec3 h2 = sl_hash33(vec3(ci, floor(cqTop * 4.0), faceId + 23.0));
      float dT = cqTop - vSlWorld.y;
      float wT = 0.22 + h2.y * 0.5;
      float inT = 1.0 - smoothstep(wT * 0.5 - 0.08, wT * 0.5, abs(cx - 0.3 - h2.z * 0.4) + rag);
      float lenT = 0.8 + h2.x * 3.4;
      float sT = step(0.3, h2.x + 0.4 * h2.y) * inT * (1.0 - smoothstep(lenT * 0.25, lenT, dT)) * step(0.0, dT);
      // 打ち継ぎの線の下（弱く短い。箱の上の縁と同じ高さの線は除く）
      vec3 h1 = sl_hash33(vec3(ci, lift, faceId + 11.0));
      float liftTop = (lift + 1.0) * 3.6;
      float dL = liftTop - vSlWorld.y;
      float wL = 0.18 + h1.y * 0.35;
      float inL = 1.0 - smoothstep(wL * 0.5 - 0.06, wL * 0.5, abs(cx - 0.3 - h1.z * 0.4) + rag);
      float lenL = 0.5 + h1.x * 1.8;
      float sL = step(0.5, h1.x) * inL * (1.0 - smoothstep(lenL * 0.25, lenL, dL)) * 0.65 * step(liftTop + 0.3, cqTop);
      float fadeS = 1.0 - smoothstep(0.05, 0.2, far) * 0.6;
      float washT = step(h2.y, 0.3);
      st = sT * (1.0 - washT) + sL * step(0.3, h1.y);
      float wash = sT * washT + sL * (1.0 - step(0.3, h1.y));
      st *= uCqStreak.x * fadeS;
      wash *= uCqStreak.x * fadeS;
      col *= 1.0 - clamp(st, 0.0, 1.0) * uCqStreak.y;
      col *= 1.0 + clamp(wash, 0.0, 1.0) * uCqStreak.y * 0.6;
      // 苔・藻（決まり: 水際の濡れた帯の上と、そこへ垂れた染みに沿って生える）
      if (uCqStreak.z > 0.0) {
        float mh = 1.0 - smoothstep(0.0, uCqStreak.w, vSlWorld.y);
        float mo = smoothstep(0.5, 0.85, mh * (0.3 + st * 1.2) + rag * 2.0) * uCqStreak.z;
        col = mix(col, uCqMoss * (0.8 + rag * 3.0), mo);
      }
    }
    // ---- 垂れ（決まり: 打ち継ぎ 3.6 m ごとの下から、幅 2〜6 cm の縦の筋が 0.6〜3.4 m 垂れる。7 割は暗い汚れ、3 割は白いエフロ）
    if (cqWall && uCqDrip > 0.0) {
      float hz = dot(vSlWorld.xz, vec2(an.z, an.x));
      float cw = 0.22;
      float ci = floor(hz / cw);
      vec3 h = sl_hash33(vec3(ci, faceId, 4.0));
      vec3 h2 = sl_hash33(vec3(ci, lift, faceId + 7.0));
      float dy = (lift + 1.0) * 3.6 - vSlWorld.y;
      float len = 0.6 + h2.y * 2.8;
      float on = step(h2.x, uCqDrip) * (1.0 - smoothstep(len * 0.55, len, dy));
      float xc = (fract(hz / cw) - 0.5) * cw - (h.z - 0.5) * 0.1;
      float wdt = (0.01 + h.y * 0.025) * (1.0 - clamp(dy / len, 0.0, 1.0) * 0.6);
      float aw = fwidth(hz) * 0.75;
      float line = 1.0 - smoothstep(wdt - aw, wdt + aw, abs(xc));
      float k = on * line * (1.0 - smoothstep(0.008, 0.03, far));
      col = h2.z < 0.7 ? col * (1.0 - k * 0.42) : mix(col, col * 1.28 + 0.02, k * 0.75);
    }
    // ---- 水際の濡れた帯（ちぎれた上端・上へ伸びる濡れの舌）
    if (uCqWet.z > 0.0) {
      float wn = sl_fbm(vec3(vSlWorld.xz * 0.9, vSlWorld.y * 0.5), 3) * 0.25;
      float hzw = dot(vSlWorld.xz, vec2(an.z, an.x));
      vec3 th = sl_hash33(vec3(floor(hzw / 0.16), faceId, 9.0));
      float tongue = step(0.55, th.x) * th.y * 0.9;
      float wet = 1.0 - smoothstep(uCqWet.x, uCqWet.y + wn + tongue, vSlWorld.y);
      col *= 1.0 - wet * uCqWet.z;
    }
    // ---- 開口・窓台・庇の下の染みの板（stain > 0 の材質だけ。板の uv: y = 1 が上の縁）。1 cm ごとの筋で長さが違う
    if (uCqStain > 0.0) {
      float hzs = dot(vSlWorld.xz, vec2(an.z, an.x));
      vec3 sh = sl_hash33(vec3(floor(hzs / 0.07), 2.0, faceId));
      float t = 1.0 - vCqUv.y;
      float len = 0.3 + 0.7 * sh.x;
      float k = 1.0 - smoothstep(len * 0.35, len, t);
      float sideF = smoothstep(0.0, 0.25, min(vCqUv.x, 1.0 - vCqUv.x));
      float ss = clamp(k * sideF * (0.7 + 0.5 * sh.y), 0.0, 1.0);
      col *= 1.0 - ss * uCqStain;
    }
    diffuseColor.rgb = col;
    // 谷の底ほど空が見えない（間接光を減らす）。下向きの面（張り出しの下）は照り返しだけ
    cqAo = mix(uCqAo.z, 1.0, smoothstep(uCqAo.x, uCqAo.y, vSlWorld.y));
    if (slN.y < -0.5) cqAo *= uCqAo.w;
    cqAo *= mix(1.0, uCqAxis.w, abs(dot(slN, uCqAxis.xyz))) * uCqAmb;
    if (uCqSunDir.w > 0.0) {
      float sf = smoothstep(0.6, 0.9, dot(slN, uCqSunDir.xyz));
      cqAo *= 1.0 + sf * uCqSunDir.w;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uCqSunCol, sf);
    }
  }
`;

/** ctx.mat の材質に場所の模様を足す（onBeforeCompile をつなぐ）。cacheKey は模様ごとに変える */
function extend(m: THREE.MeshStandardMaterial, key: string, uniforms: Record<string, THREE.IUniform>, patch: (fs: string, vs: string) => [string, string]): void {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader, r) => {
    prev.call(m, shader, r);
    Object.assign(shader.uniforms, uniforms);
    const [fs, vs] = patch(shader.fragmentShader, shader.vertexShader);
    shader.fragmentShader = fs;
    shader.vertexShader = vs;
  };
  m.customProgramCacheKey = () => prevKey() + '|' + key;
}

function insertAfter(src: string, find: string, add: string): string {
  const i = src.indexOf(find);
  if (i < 0) throw new Error('squareroom/mats: chunk not found: ' + find);
  return src.slice(0, i + find.length) + add + src.slice(i + find.length);
}

/** 打ち放しのコンクリート */
export function concrete(ctx: SceneContext, o: ConcreteOpts): THREE.MeshStandardMaterial {
  const m = ctx.mat({ color: o.color, toon: 0, name: o.name, line: 0.6, ...(o.extra ?? {}) });
  const u = {
    uCqPanel: { value: new THREE.Vector4(o.panel?.[0] ?? 2.4, o.panel?.[1] ?? 1.2, o.joint ?? 0.009, o.jointDark ?? 0.35) },
    uCqTie: { value: new THREE.Vector4(o.ties?.[0] ?? 2, o.ties?.[1] ?? 2, o.tieR ?? 0.02, o.tieDark ?? 0.7) },
    uCqStreak: { value: new THREE.Vector4(o.streak ?? 0.75, o.streakDark ?? 0.32, o.moss ?? 0, o.mossTop ?? 3) },
    uCqMoss: { value: new THREE.Color(o.mossColor ?? '#4a6040') },
    uCqWet: { value: new THREE.Vector4(o.wet?.[0] ?? -0.5, o.wet?.[1] ?? 0.35, o.wetDark ?? 0.35, o.panelVar ?? 0.12) },
    uCqAo: { value: new THREE.Vector4(o.ao?.[0] ?? 0, o.ao?.[1] ?? 30, o.aoMin ?? 0.45, o.under ?? 0.6) },
    uCqAxis: { value: new THREE.Vector4(o.axis === 'x' ? 1 : 0, 0, o.axis === 'z' ? 1 : 0, o.axisDark ?? 1) },
    uCqAmb: { value: o.amb ?? 1 },
    uCqStain: { value: o.stain ?? 0 },
    uCqTone: { value: o.tone ?? 0.45 },
    uCqGrain: { value: o.grain ?? 0.12 },
    uCqDrip: { value: o.drip ?? 0.22 },
    uCqSunDir: { value: new THREE.Vector4(...(o.sunFace?.dir ?? [0, 0, 1]), o.sunFace?.gain ?? 0) },
    uCqSunCol: { value: new THREE.Color(o.sunFace?.color ?? '#ffffff') },
    uCqHaze: { value: new THREE.Vector4(...(o.haze ?? [10, 40, 0, 0.02])) },
  };
  m.userData.cq = u;
  m.userData.cqOpts = o;
  extend(m, 'sq-concrete', u, (fs, vs) => {
    vs = insertAfter(vs, 'varying vec3 vSlWorld;', '\nvarying vec2 vCqUv;');
    vs = insertAfter(vs, '#include <project_vertex>', '\n  vCqUv = uv;');
    fs = insertAfter(fs, 'uniform vec3 uSlWaterColor;', '\n' + CONCRETE_GLSL);
    fs = insertAfter(fs, 'float slPuddle = 0.0;', '\n' + CONCRETE_PATTERN);
    fs = insertAfter(fs, '#include <aomap_fragment>', '\n  reflectedLight.indirectDiffuse *= cqAo;\n');
    fs = insertAfter(
      fs,
      'gl_FragColor.rgb = sl_applyFog(gl_FragColor.rgb, vSlWorld, cameraPosition);',
      `
  if (uCqHaze.z > 0.0) {
    vec3 hd = vSlWorld - cameraPosition;
    float hz = smoothstep(uCqHaze.x, uCqHaze.y, vSlWorld.y) * uCqHaze.z * (1.0 - exp(-length(hd) * uCqHaze.w));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, sl_fogColor(normalize(hd)), hz);
  }`,
    );
    return [fs, vs];
  });
  return m;
}

const stainCache = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();

/**
 * 壁の材質と同じ模様の、染みの板の材質（開口・窓台・庇・竪樋の下に壁から 4 mm 浮かせて貼る）。
 * 模様はワールド座標なので板は壁と同じに見え、上の縁から下へ暗い筋が垂れる
 */
export function stainOf(ctx: SceneContext, m: THREE.Material, k = 0.4): THREE.MeshStandardMaterial {
  let s = stainCache.get(m);
  if (!s) {
    const o = m.userData.cqOpts as ConcreteOpts | undefined;
    if (!o) throw new Error('squareroom/mats: stainOf needs a concrete material');
    s = concrete(ctx, { ...o, name: `${o.name}-stain`, stain: k });
    s.polygonOffset = true;
    s.polygonOffsetFactor = -2;
    s.polygonOffsetUnits = -4;
    stainCache.set(m, s);
  }
  return s;
}

export interface WaterOpts {
  color: string;
  name: string;
  strength?: number;
  distort?: number;
  fresnel?: number;
  tint?: string;
  posterize?: number;
  /** 波の細かさ（1/m） */
  ripple?: number;
  /** 波の伸び（世界の x・z の倍率）。水路の向きに細かく・横に長くすると、映り込みが横の筋に切れる */
  aniso?: [number, number];
  /** 明るい映り込み（空・扉・日なた）だけを強める倍率 */
  boost?: number;
}

/** 水面（平面の鏡像）。波は細かく（参考画像の横に細かく切れた映り込み）、遠くでは弱める */
export function water(ctx: SceneContext, refl: PlanarReflector, o: WaterOpts): THREE.MeshStandardMaterial {
  const m = ctx.mat({
    color: o.color,
    toon: 0,
    name: o.name,
    line: 0,
    reflection: {
      texture: refl.target.texture,
      matrix: refl.matrix,
      strength: o.strength ?? 0.92,
      distort: o.distort ?? 0.018,
      fresnel: o.fresnel ?? 0.55,
      tint: o.tint ?? '#ffffff',
      posterize: o.posterize ?? 0,
    },
  });
  const u = {
    uWqRipple: { value: o.ripple ?? 4.5 },
    uWqAniso: { value: new THREE.Vector2(...(o.aniso ?? [1, 1])) },
    uWqBoost: { value: o.boost ?? 0 },
  };
  extend(m, 'sq-water', u, (fs, vs) => {
    fs = insertAfter(fs, 'uniform vec3 uSlWaterColor;', '\nuniform float uWqRipple;\nuniform vec2 uWqAniso;\nuniform float uWqBoost;');
    const a = 'vec3 q = vec3(vSlWorld.xz * 1.7, uTime * 0.25);';
    if (!fs.includes(a)) throw new Error('squareroom/mats: water ripple not found');
    fs = fs.replace(
      a,
      `vec3 q = vec3(vSlWorld.xz * uWqAniso * uWqRipple, uTime * 0.6);
        // 遠くは波を弱める（画素より細かい波はちらつく）
        float wqFar = length(vSlWorld - cameraPosition);
        q.z += 0.0;`,
    );
    fs = fs.replace('ruv += vec2(sl_fbm(q, 3), sl_fbm(q + 7.3, 3)) * uSlRefl.y;', 'ruv += vec2(sl_fbm(q, 3) * 0.35, sl_fbm(q + 7.3, 3)) * uSlRefl.y * (1.0 - smoothstep(25.0, 90.0, wqFar) * 0.6);');
    const b = 'vec3 r = texture2D(uSlReflTex, ruv).rgb * uSlReflTint;';
    if (!fs.includes(b)) throw new Error('squareroom/mats: reflection lookup not found');
    fs = fs.replace(b, b + '\n      r *= 1.0 + uWqBoost * smoothstep(0.35, 0.75, sl_luma(r));');
    return [fs, vs];
  });
  return m;
}

/**
 * 浸水した通りの板石の上面: 縁から水がかぶる。乾いた所はコンクリート、水の膜は鏡像。
 * 箱の上面の UV（0..1）と箱の寸法（頂点の属性 aSq: 横・縦・ちぎれの深さ）から縁までの距離を出し、ノイズのしきい値で分ける
 */
export function floodPath(ctx: SceneContext, refl: PlanarReflector, o: { color: string; wetColor: string; name: string; strength?: number; algae?: string; foam?: string }): THREE.MeshStandardMaterial {
  const m = ctx.mat({
    color: o.color,
    toon: 0,
    name: o.name,
    line: 0.4,
    reflection: { texture: refl.target.texture, matrix: refl.matrix, strength: o.strength ?? 0.9, distort: 0.016, fresnel: 0.5 },
  });
  const u = {
    uFpWet: { value: new THREE.Color(o.wetColor) },
    uFpAlgae: { value: new THREE.Color(o.algae ?? '#3f5a48') },
    uFpFoam: { value: new THREE.Color(o.foam ?? '#c4dcdc') },
  };
  extend(m, 'sq-flood', u, (fs, vs) => {
    vs = insertAfter(vs, 'varying vec3 vSlWorld;', '\nattribute vec3 aSq;\nvarying vec3 vSq;\nvarying vec2 vSqUv;');
    vs = insertAfter(vs, '#include <project_vertex>', '\n  vSq = aSq;\n  vSqUv = uv;');
    fs = insertAfter(fs, 'varying vec3 vSlWorld;', '\nvarying vec3 vSq;\nvarying vec2 vSqUv;\nuniform vec3 uFpWet;\nuniform vec3 uFpAlgae;\nuniform vec3 uFpFoam;\nfloat fpWater = 0.0;');
    fs = insertAfter(
      fs,
      'float slPuddle = 0.0;',
      `
  if (vSq.z > 0.0) {
    if (slN.y > 0.7) {
      // 縁までの距離（m）
      vec2 e = min(vSqUv, 1.0 - vSqUv) * vSq.xy;
      float d = min(e.x, e.y);
      float n = sl_warp(vec3(vSlWorld.xz * 0.55, 1.3), 4) * 0.5 + 0.5;
      float n2 = sl_fbm(vec3(vSlWorld.xz * 3.1, 7.7), 3) * 0.5 + 0.5;
      float far = max(fwidth(vSlWorld.x), fwidth(vSlWorld.z));
      // 板石の割付け（通りを横切る 0.9 m × 通りに沿う 0.6 m。行ごとに半分ずらす）。色は石 1 枚ごと（斑を塗らない）
      vec2 fq = vec2(vSlWorld.x / 0.9, vSlWorld.z / 0.6);
      fq.x += step(0.5, fract(floor(fq.y) * 0.5)) * 0.5;
      vec2 fcellS = floor(fq);
      vec2 fs = fract(fq);
      vec2 fdl = min(fs, 1.0 - fs) * vec2(0.9, 0.6);
      float fj = 1.0 - smoothstep(0.008, 0.014 + far, min(fdl.x, fdl.y));
      fj *= 1.0 - smoothstep(0.02, 0.06, far);
      vec3 fh = sl_hash33(vec3(fcellS, 5.0));
      // 縁から vSq.z の範囲に水がかぶる（ノイズで奥行きが変わる）
      float lim = vSq.z * (0.1 + 0.7 * n) + (n2 - 0.5) * 0.1;
      fpWater = 1.0 - smoothstep(lim - 0.012, lim + 0.012, d);
      // 沈んだ石（1 割強）は水が溜まる: 石の内側いっぱい（目地から少し内）
      float sunk = step(fh.x, 0.13) * smoothstep(0.03, 0.05, min(fdl.x, fdl.y) - (n2 - 0.5) * 0.06);
      fpWater = max(fpWater, sunk);
      // 乾いた所: 石ごとの明るさ（濡れて暗い石・乾きかけの石）と、水の入った暗い目地
      float wetStone = step(0.55, fh.y);
      vec3 dry = diffuseColor.rgb * (0.72 + 0.18 * fh.z) * (1.0 - wetStone * 0.3);
      dry *= 1.0 - fj * 0.55;
      // 縁のすぐ内側の藻（暗い緑の細い帯）と、縁の外の水に浮く泡・欠けた薄片（横に長い短い明るい断片）
      float edgeIn = smoothstep(0.0, 0.02, d - lim) * (1.0 - smoothstep(0.04, 0.12, d - lim));
      dry = mix(dry, uFpAlgae, edgeIn * 0.7 * smoothstep(0.3, 0.7, n2));
      vec2 fc = vec2(vSlWorld.x / 0.32, vSlWorld.z / 0.07);
      vec2 fcell = floor(fc);
      vec3 fh2 = sl_hash33(vec3(fcell, 3.0));
      vec2 ff = fract(fc);
      float frag = step(0.62, fh2.x) * step(0.15, ff.x) * step(ff.x, 0.35 + 0.6 * fh2.y) * step(0.25, ff.y) * step(ff.y, 0.8);
      float band = 1.0 - smoothstep(0.0, 0.45 * (0.4 + fh2.z), lim - d);
      float foam = frag * band * fpWater * (1.0 - sunk);
      diffuseColor.rgb = mix(dry, uFpWet, fpWater);
      diffuseColor.rgb = mix(diffuseColor.rgb, uFpFoam, foam);
      fpWater *= 1.0 - foam;
      // 目地の水も少し映る
      fpWater = max(fpWater, fj * 0.5 * (1.0 - foam));
      slPuddle = fpWater;
    } else {
      // 横の面（水面から少し出た板石の縁）は水と同じ暗い色（明るい細い線にしない）
      diffuseColor.rgb = uFpWet;
    }
  }
`,
    );
    // 板石の上面は日を受けても周りの壁より明るくしない（濡れた暗い石。日の直接の光を弱める）
    fs = insertAfter(fs, '#include <aomap_fragment>', '\n  if (vSq.z > 0.0) reflectedLight.directDiffuse *= 0.3;\n');
    // 映り込みは水の膜の所だけ
    fs = fs.replace('float m = 1.0;\n#ifdef SL_REFLECT_PUDDLE', 'float m = fpWater;\n#ifdef SL_REFLECT_PUDDLE');
    return [fs, vs];
  });
  return m;
}

/** 光る開口（照明なし。ブルームでにじむ明るさ） */
export function glow(ctx: SceneContext, color: string, name: string, o: { fog?: boolean } = {}): THREE.MeshStandardMaterial {
  // 霧を弱く掛けたいときは fog: false（門の光は遠くでも白く抜ける）
  return ctx.mat({ color, unlit: true, name, line: 0, noFog: o.fog === false });
}

/** 浸水した通りの板石の箱に、縁の水の幅（m）を頂点の属性で付ける（floodPath 用） */
export function tagFlood(g: THREE.BufferGeometry, sx: number, sz: number, rag: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = sx;
    a[i * 3 + 1] = sz;
    a[i * 3 + 2] = rag;
  }
  g.setAttribute('aSq', new THREE.BufferAttribute(a, 3));
  return g;
}
