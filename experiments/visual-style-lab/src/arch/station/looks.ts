import * as THREE from 'three';
import { lightU } from './mat.ts';

/**
 * 場所ごとの空気の色（霧・空・照り返し）。参考画像ごとに色調が少し違うので、
 * 視点の位置に「見え方」を置き、カメラの位置で滑らかに混ぜる（歩いても急に変わらない）。
 */
export interface Look {
  /** この見え方の中心（x, z） */
  at: [number, number];
  horizon: string;
  upper: string;
  zenith: string;
  ground: string;
  /** 上へ明るくなる仰角・下へ暗くなる俯角の目安・屋根の下の霧の明るさ・屋根の影の縁のぼかし */
  shape: [number, number, number, number];
  /** 霧の向こうの光源のにじみ 2 つ（向き・鋭さ・色 × 強さ） */
  glowA: { dir: [number, number, number]; power: number; color: string; strength: number };
  glowB: { dir: [number, number, number]; power: number; color: string; strength: number };
  /** 地平線を上へずらす量（遠くの野や林の帯） */
  lift: number;
  /** 空の明るさ・屋根の外からの照り返し・屋根の下の床からの照り返し */
  sky: string;
  out: string;
  in: string;
  /** 霧の濃さの倍率 */
  dens: number;
  /** 空の雲の強さ */
  clouds: number;
  /** 屋根の下面・屋根の下の床を見る視線の霧の明るさ（0〜1） */
  blockFog: number;
  /** 霧の始まる距離（m） */
  start: number;
  /** 床の乾いた所の映り込みの倍率 */
  floorRefl: number;
  /** 遠くの丘の強さ */
  hills: number;
  /** 点字ブロックの帯の映り込みの倍率 */
  stripRefl: number;
  /** 蛍光灯のにじみの強さ・広がりの倍率 */
  tubeGlow: [number, number];
  /** 野原の明るさの倍率 */
  fieldGain: number;
  /** 蛍光灯の色と明るさ（色 × 明るさ） */
  tubeColor: string;
  tubePower: number;
  /** 水たまりを鏡のようにする割合（0〜1） */
  wet: number;
  /** 屋根の下の蛍光灯の明るさの倍率 */
  lampMul: number;
  /** 水たまりの明るさの持ち上げ */
  pudLift: number;
  /** 点字ブロック・白線の明るさの倍率 */
  stripGain: number;
  /** 地平線の遠い影（倉庫・電柱）の霧の倍率（省略で 0.26） */
  farMul?: number;
  /** 野原の小川の見え方（省略で 1） */
  stream?: number;
}

interface Packed {
  at: [number, number];
  cols: THREE.Color[];
  vecs: THREE.Vector4[];
  dens: number;
  lift: number;
  clouds: number;
  blockFog: number;
  start: number;
  floorRefl: number;
  hills: number;
  stripRefl: number;
  tubeGlow: [number, number];
  fieldGain: number;
  tubeColor: THREE.Color;
  wet: number;
  lampMul: number;
  pudLift: number;
  stripGain: number;
  farMul: number;
  stream: number;
}

const COL_KEYS = ['horizon', 'upper', 'zenith', 'ground', 'glowA', 'glowB', 'sky', 'out', 'in'] as const;

function pack(l: Look): Packed {
  const c = (h: string, k = 1): THREE.Color => new THREE.Color(h).multiplyScalar(k);
  return {
    at: l.at,
    cols: [c(l.horizon), c(l.upper), c(l.zenith), c(l.ground), c(l.glowA.color, l.glowA.strength), c(l.glowB.color, l.glowB.strength), c(l.sky), c(l.out), c(l.in)],
    vecs: [new THREE.Vector4(...l.shape), new THREE.Vector4(...l.glowA.dir, l.glowA.power), new THREE.Vector4(...l.glowB.dir, l.glowB.power)],
    dens: l.dens,
    lift: l.lift,
    clouds: l.clouds,
    blockFog: l.blockFog,
    start: l.start,
    floorRefl: l.floorRefl,
    hills: l.hills,
    stripRefl: l.stripRefl,
    tubeGlow: l.tubeGlow,
    fieldGain: l.fieldGain,
    tubeColor: new THREE.Color(l.tubeColor).multiplyScalar(l.tubePower),
    wet: l.wet,
    lampMul: l.lampMul,
    pudLift: l.pudLift,
    stripGain: l.stripGain,
    farMul: l.farMul ?? 0.26,
    stream: l.stream ?? 1,
  };
}

export class Looks {
  private readonly packed: Packed[];
  private readonly tc = COL_KEYS.map(() => new THREE.Color());
  private readonly tv = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  private lastX = NaN;
  private lastZ = NaN;

  constructor(looks: Look[]) {
    this.packed = looks.map(pack);
  }

  /** カメラの位置で混ぜて、材質の共有 uniform に書く */
  apply(x: number, z: number): void {
    if (x === this.lastX && z === this.lastZ) return;
    this.lastX = x;
    this.lastZ = z;
    const ws = this.packed.map((p) => {
      const d = Math.hypot(x - p.at[0], z - p.at[1]);
      // 視点の間（大屋根の下と中央柱の上屋の下は 12 m）で空気の色が急に変わらないよう、なだらかに混ぜる（視点そのものでは 93 % 以上その視点の値）
      return 1 / (1 + (d / 5) ** 3);
    });
    const sum = ws.reduce((a, b) => a + b, 0);
    this.tc.forEach((c) => c.setRGB(0, 0, 0));
    this.tv.forEach((v) => v.set(0, 0, 0, 0));
    let dens = 0;
    let lift = 0;
    let clouds = 0;
    let blockFog = 0;
    let start = 0;
    let floorRefl = 0;
    let hills = 0;
    let stripRefl = 0;
    const tg = [0, 0];
    let fieldGain = 0;
    const tc = new THREE.Color(0, 0, 0);
    let wet = 0;
    let lampMul = 0;
    let pudLift = 0;
    let stripGain = 0;
    let farMul = 0;
    let stream = 0;
    this.packed.forEach((p, i) => {
      const w = ws[i] / sum;
      p.cols.forEach((c, k) => {
        this.tc[k].r += c.r * w;
        this.tc[k].g += c.g * w;
        this.tc[k].b += c.b * w;
      });
      p.vecs.forEach((v, k) => this.tv[k].addScaledVector(v, w));
      dens += p.dens * w;
      lift += p.lift * w;
      clouds += p.clouds * w;
      blockFog += p.blockFog * w;
      start += p.start * w;
      floorRefl += p.floorRefl * w;
      hills += p.hills * w;
      stripRefl += p.stripRefl * w;
      tg[0] += p.tubeGlow[0] * w;
      tg[1] += p.tubeGlow[1] * w;
      fieldGain += p.fieldGain * w;
      tc.r += p.tubeColor.r * w;
      tc.g += p.tubeColor.g * w;
      tc.b += p.tubeColor.b * w;
      wet += p.wet * w;
      lampMul += p.lampMul * w;
      pudLift += p.pudLift * w;
      stripGain += p.stripGain * w;
      farMul += p.farMul * w;
      stream += p.stream * w;
    });
    const [hor, up, zen, gnd, ga, gb, sky, out, inn] = this.tc;
    lightU.uStHorizon.value.copy(hor);
    lightU.uStUpper.value.copy(up);
    lightU.uStZenith.value.copy(zen);
    lightU.uStGround.value.copy(gnd);
    lightU.uStGlowACol.value.copy(ga);
    lightU.uStGlowBCol.value.copy(gb);
    lightU.uSkyCol.value.copy(sky);
    lightU.uOutCol.value.copy(out);
    lightU.uInCol.value.copy(inn);
    lightU.uStFogShape.value.copy(this.tv[0]);
    lightU.uStGlowA.value.copy(this.tv[1]);
    lightU.uStGlowB.value.copy(this.tv[2]);
    lightU.uStDens.value.set(dens, lift, blockFog, start);
    lightU.uStClouds.value = clouds;
    lightU.uStFloorRefl.value = floorRefl;
    lightU.uStHills.value = hills;
    lightU.uStStripRefl.value = stripRefl;
    lightU.uStTubeGlow.value.set(tg[0], tg[1]);
    lightU.uStFieldGain.value = fieldGain;
    lightU.uStTubeCol.value.copy(tc);
    lightU.uStWet.value = wet;
    lightU.uStLampMul.value = lampMul;
    lightU.uStPudLift.value = pudLift;
    lightU.uStStripGain.value = stripGain;
    lightU.uStFarMul.value = farMul;
    lightU.uStStream.value = stream;
  }
}
