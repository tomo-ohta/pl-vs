import * as THREE from 'three';
import { createPaint } from '../../../render/PaintMaterial.ts';
import { Builder, type V3 } from '../../../scenes/Builder.ts';
import { Prop, type PropKind, type PropMats, type PropSink } from '../../../props/kit.ts';
import type { LocalFrame } from '../frame.ts';
import { paint } from '../paint.ts';
import { sunAt } from '../sun.ts';

/**
 * 校舎の間の通路の小物の材質の作り方（PropMats）と置き方。
 *
 * 小物は「実物の色」（白い自販機・赤い消火器・木の机・灰色の鉄）で頼み、ここで場所の色の段へ写す
 * （参考画像の 16 色: 暗い青緑の段 #0a1b21〜#244d56・中の #34646a・#58918b・明るい差し色 #93c6b5・#bfedd6）。
 * - 明るさ: OKLab の L を、置く所の光ごとの幅へ写す（陰の屋外 = 暗い段、灯りの室内 = 少し明るい段、日なた = 明るい段）
 * - 色み: 参考画像の段の色み（明るさごとの a・b）に、元の色みを少しだけ足す（灰色の物は段の色そのもの。赤い消火器・
 *   黄色の札・色の付いた自転車は鈍い赤・黄・紺として残る。鮮やかな色ほど少し多く残す）
 * - 面ごとの塗り（照明は使わない。元の版と同じ面ごとの色）: 上の面は明るく、下の面は暗い。横の面は西（-x）が少し明るく、
 *   東（+x）・北（-z）が少し暗い（通路の室外機・ロッカーの塗りと同じ向き）。丸い物も面の向きで段になる
 * - 色の数を抑える: 明るさと色みを段に丸める（近い色は同じ材質にまとまり、Builder が材質ごとに 1 回で描く）
 * - 光る物（自販機の見本の窓・ボタン・表示）は灯りを受けない明るい色、ガラスは半透明の塗り
 * 影は使わない場面なので、形はすべて影なしで Builder へ出す（alleySink）。
 */

export type AlleyLight = 'shade' | 'room' | 'lit';

export interface AlleyMatsOpts {
  /** 置く所の光: shade = 陰の屋外（通路・裏庭・中庭の大部分）、room = 灯りの点いた室内、lit = 日なた */
  light?: AlleyLight;
  /** 霧の掛かり方（場面の物と同じ。室内 0.4・中庭 0.7 など） */
  fog?: number;
  /** 灯りの光だまりを受ける割合（既定 1） */
  lamp?: number;
}

// ---------------------------------------------------------------- OKLab
type Lab = [number, number, number];

function toLab(hex: string): Lab {
  // THREE.Color は 16 進（sRGB）を線形の値で持つ
  const c = new THREE.Color(hex);
  const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const cl = (v: number): number => Math.min(1, Math.max(0, v));
  const c = new THREE.Color().setRGB(
    cl(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    cl(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    cl(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
  return `#${c.getHexString()}`;
}

/** 参考画像の段（明るさの順）。明るさごとの色み（a・b）をここから引く */
const RAMP: Lab[] = ['#0a1b21', '#0e222b', '#122a33', '#16323b', '#1c3d46', '#244d56', '#34646a', '#58918b', '#93c6b5', '#bfedd6'].map(toLab).sort((p, q) => p[0] - q[0]);

function rampTint(L: number): [number, number] {
  if (L <= RAMP[0][0]) return [RAMP[0][1], RAMP[0][2]];
  for (let i = 0; i + 1 < RAMP.length; i++) {
    const [l0, a0, b0] = RAMP[i];
    const [l1, a1, b1] = RAMP[i + 1];
    if (L <= l1) {
      const t = (L - l0) / (l1 - l0);
      return [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t];
    }
  }
  const last = RAMP[RAMP.length - 1];
  return [last[1], last[2]];
}

/** 光ごとの明るさの幅 [黒, 白]（OKLab の L）と、上の面の明るさの足し */
const RANGE: Record<AlleyLight, { lo: number; hi: number; top: number }> = {
  shade: { lo: 0.22, hi: 0.56, top: 0.06 },
  room: { lo: 0.25, hi: 0.64, top: 0.04 },
  lit: { lo: 0.38, hi: 0.86, top: 0.06 },
};

const qL = (v: number): number => Math.round(v / 0.02) * 0.02;
const qC = (v: number): number => Math.round(v / 0.012) * 0.012;

/** 実物の色 → 場所の色（明るさ L の足し dL で面ごとの色） */
function mapColor(hex: string, light: AlleyLight, dL = 0, glow = false): string {
  const [L, a, b] = toLab(hex);
  const C = Math.hypot(a, b);
  const r = RANGE[light];
  let Lo: number;
  let k: number;
  if (glow) {
    // 光る物: 明るい差し色の段（#93c6b5〜#bfedd6）。色みは多めに残す（ボタンの青・赤、表示の緑）
    Lo = 0.84 + 0.11 * L;
    k = 0.5;
  } else {
    Lo = r.lo + (r.hi - r.lo) * Math.pow(Math.max(L, 0), 1.15);
    k = 0.24 + 0.16 * THREE.MathUtils.smoothstep(C, 0.07, 0.17);
  }
  // 元の明るさを段に丸めてから面ごとの差を足す（同じ物の面の差がどの色でもそろう）
  Lo = Math.min(0.95, Math.max(0.12, qL(Lo) + dL));
  const [ta, tb] = rampTint(Lo);
  return fromLab([Lo, qC(ta + a * k), qC(tb + b * k)]);
}

// ---------------------------------------------------------------- 材質
const glassCache = new Map<string, THREE.ShaderMaterial>();

/** 場面を作り直すとき（読み込みのたび）に使い回しを捨てる（塗りの材質は paint.ts の使い回し） */
export function resetAlleyPropCache(): void {
  glassCache.clear();
  memo.clear();
}

const memo = new Map<string, PropMats>();

/** 同じ光・霧の材質の作り方を使い回す（場面の中の置き方から使う） */
export function propMats(light: AlleyLight, fog: number, lamp = 1): PropMats {
  const key = `${light}|${fog}|${lamp}`;
  let m = memo.get(key);
  if (!m) memo.set(key, (m = alleyMats({ light, fog, lamp })));
  return m;
}

/** 屋外の物: 置く所（物の中ほどの高さ）が日なたなら日なたの段、陰なら陰の段 */
export function outMats(pos: V3, fog: number): PropMats {
  return propMats(sunAt([pos[0], pos[1] + 0.8, pos[2]]) > 0.5 ? 'lit' : 'shade', fog);
}

/** 半透明の塗り（自販機の窓・メーターのふた）。塗りの材質の出す色の不透明度を変える */
function glassPaint(color: Record<string, string>, fog: number, opacity: number): THREE.ShaderMaterial {
  const key = JSON.stringify([color, fog, opacity]);
  let m = glassCache.get(key);
  if (!m) {
    m = createPaint({ color, fog, lamp: 0.3 });
    m.uniforms.uAlpha = { value: opacity };
    m.fragmentShader = m.fragmentShader.replace('uniform float uLampLit;', 'uniform float uLampLit;\nuniform float uAlpha;').replace('gl_FragColor = vec4(col, 1.0);', 'gl_FragColor = vec4(col, uAlpha);');
    m.transparent = true;
    m.depthWrite = false;
    glassCache.set(key, m);
  }
  return m;
}

/** 校舎の間の通路の小物の材質の作り方 */
export function alleyMats(o: AlleyMatsOpts = {}): PropMats {
  const light = o.light ?? 'shade';
  const fog = o.fog ?? 0.6;
  const lamp = o.lamp ?? 1;
  const top = RANGE[light].top;
  const cache = new Map<string, THREE.Material>();
  return {
    get(color: string, kind: PropKind = 'solid'): THREE.Material {
      const key = `${kind}:${color}`;
      let m = cache.get(key);
      if (m) return m;
      if (kind === 'glow') {
        m = paint({ color: mapColor(color, light, 0, true), fog: fog * 0.5, lamp: 0 });
      } else {
        const faces = {
          py: mapColor(color, light, top),
          nx: mapColor(color, light, 0.02),
          pz: mapColor(color, light, 0),
          px: mapColor(color, light, -0.02),
          nz: mapColor(color, light, -0.04),
          ny: mapColor(color, light, -0.08),
        };
        m = kind === 'glass' ? glassPaint(faces, fog, 0.16) : paint({ color: faces, fog, lamp });
      }
      cache.set(key, m);
      return m;
    },
  };
}

/** 場面の Builder へ出す（影なし。材質ごとにまとめて描かれる） */
export function alleySink(b: Builder): PropSink {
  return {
    add: (geo, mat) => {
      b.mesh(geo, mat, [0, 0, 0], { shadow: false });
    },
    collide: (min, max) => {
      b.ctx.colliders.add({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] });
    },
  };
}

/**
 * 小物の置き場（場所ごとに別の Builder にまとめる）。材質ごとにまとめた形が場所ごとに分かれるので、
 * 画面の外の場所（目の後ろの駐輪場など）の小物は描かない。最後に done() で親の Builder の下へ入れる
 */
export class PropArea {
  readonly b: Builder;
  readonly sink: PropSink;
  constructor(private readonly parent: Builder) {
    this.b = new Builder(parent.ctx);
    this.sink = alleySink(this.b);
  }
  done(): void {
    this.b.finalize();
    this.parent.root.add(this.b.root);
  }
}

/** 場面の座標に置く（yaw = 正面 +z の向き。Object3D.rotation.y と同じ） */
export function propAt(sink: PropSink, mats: PropMats, pos: V3, yaw = 0, seed = 1): Prop {
  return Prop.at(sink, mats, pos, yaw, seed);
}

/** 向き（場面の水平の向き）を、物の正面 +z がその向きになる yaw へ */
export function yawTo(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/**
 * 壁の座標（u, y, w）に置く。face = 物の正面（+z）の向き: 'out' = +w（壁の外・通路側）、'in' = -w、'along' = +u、'back' = -u。
 * 壁の座標が裏返し（鏡写し）でも形は裏返さない（向きだけ合わせる）。sx = 物の +x が壁の +u の側なら 1、逆なら -1
 */
export function propOnFrame(sink: PropSink, mats: PropMats, fr: LocalFrame, u: number, y: number, w: number, face: 'out' | 'in' | 'along' | 'back', seed = 1): { p: Prop; sx: number } {
  const v = face === 'out' ? fr.N : face === 'in' ? fr.N.clone().negate() : face === 'along' ? fr.T : fr.T.clone().negate();
  const yaw = Math.atan2(v.x, v.z);
  const p = Prop.at(sink, mats, fr.w(u, y, w), yaw, seed);
  // 物の +x（場面）= (cos yaw, 0, -sin yaw)
  const sx = Math.cos(yaw) * fr.T.x - Math.sin(yaw) * fr.T.z >= 0 ? 1 : -1;
  return { p, sx };
}
