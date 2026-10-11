import type { Prop, V2 } from '../../../props/kit.ts';
import { bottle } from '../../../props/lib/index.ts';
import { kettle } from './lobby.ts';
import { BOTTLES, K, PAPERS } from './mats.ts';
import { storeBox, teacup } from './office.ts';

/**
 * 診察室・処置室・検査室・便所の器具と設備（昭和の町の診療所）。局所の座標: 足元の真ん中が原点・正面 +z・背 -z。
 * 実寸: 診察台（1.8 × 0.6 m・高さ 0.6 m）と踏み台・3 枚の衝立（1.65 m）・陶器の洗面台・ガラス戸の薬品棚（0.9 × 1.85 m）・
 * シャウカステン・体重計と身長計・処置台（1.95 × 0.85 m）とカーテン・点滴台・処置のワゴン・酸素ボンベ・たたんだ車椅子・
 * 顕微鏡・遠心機・試験管立て・朝顔形の小便器・和式の便器と高い水槽・掃除の流しとバケツとモップ。
 */

const ROUND = { seg: 1 } as const;

/** 回転体の小さな車輪とフォーク（キャスター）。原点は床 */
function caster(p: Prop, r = 0.035): void {
  p.cyl(K.ink, [0, r, 0], r, 0.022, { axis: 'x', seg: 10 });
  p.box(K.metal, [-0.016, r, -0.012], [0.016, r * 2 + 0.02, 0.012]);
}

/** 診察台: 管の脚と下の棚・張りの台（頭の側を起こす）・枕・紙のシーツ・2 段の踏み台 */
export function exam(p: Prop, len = 1.8): void {
  const fr = K.enamel;
  const pad = K.cushion;
  const L = len / 2;
  for (const x of [-L + 0.08, L - 0.08]) for (const z of [-0.24, 0.24]) {
    p.rod(fr, [x, 0, z], [x, 0.5, z], 0.018, { radial: 8 });
    p.cyl(K.ink, [x, 0.01, z], 0.022, 0.02, { seg: 8 });
  }
  for (const z of [-0.24, 0.24]) p.rod(fr, [-L + 0.08, 0.16, z], [L - 0.08, 0.16, z], 0.012, { radial: 6 });
  p.box(fr, [-L + 0.06, 0.15, -0.26], [L - 0.06, 0.17, 0.26]);
  p.box(fr, [-L + 0.02, 0.48, -0.28], [L - 0.02, 0.52, 0.28], { r: 0.008, ...ROUND });
  // 台（足の側は平ら、頭の側 0.55 m を起こす）
  p.box(pad, [-L + 0.55, 0.52, -0.3], [L, 0.61, 0.3], { r: 0.03 });
  const hd = p.sub([-L + 0.55, 0.52, 0], 0, { roll: -0.28 });
  hd.box(pad, [-0.55, 0, -0.3], [0, 0.09, 0.3], { r: 0.03 });
  hd.box(K.metal, [-0.3, -0.06, -0.2], [-0.25, 0.0, 0.2]);
  hd.box(K.white, [-0.5, 0.09, -0.18], [-0.22, 0.15, 0.18], { r: 0.03 });
  p.box(K.paper, [-L + 0.6, 0.61, -0.22], [L - 0.05, 0.613, 0.22]);
  // 踏み台（2 段）
  const st = p.sub([0.2, 0, 0.5]);
  for (const sx of [-1, 1]) st.extrude(K.metal, [[-0.12, 0], [0.12, 0], [0.12, 0.12], [0.0, 0.12], [0.0, 0.24], [-0.12, 0.24]], 'zy', sx * 0.19 - 0.01, sx * 0.19 + 0.01);
  st.box(K.sageD, [-0.2, 0.12, 0.0], [0.2, 0.135, 0.12], { r: 0.004 });
  st.box(K.sageD, [-0.2, 0.24, -0.12], [0.2, 0.255, 0.0], { r: 0.004 });
  p.collide([-L, 0, -0.3], [L, 0.75, 0.3]);
  p.collide([0.0, 0, 0.38], [0.4, 0.26, 0.62]);
}

/** 衝立（3 枚折り）: 管の枠・布の板・蝶番・脚とキャスター。折った角度でジグザグに立つ */
export function screen(p: Prop, n = 3, w = 0.55, h = 1.65): void {
  const fr = K.metal;
  let x = (-(n - 1) * w) / 2;
  for (let i = 0; i < n; i++) {
    const s = p.sub([x, 0, 0], (i % 2 ? 1 : -1) * 0.18);
    s.rod(fr, [-w / 2, 0.06, 0], [-w / 2, h, 0], 0.012, { radial: 6 });
    s.rod(fr, [w / 2, 0.06, 0], [w / 2, h, 0], 0.012, { radial: 6 });
    s.rod(fr, [-w / 2, h, 0], [w / 2, h, 0], 0.012, { radial: 6 });
    s.rod(fr, [-w / 2, 0.22, 0], [w / 2, 0.22, 0], 0.01, { radial: 6 });
    s.box(K.cloth, [-w / 2 + 0.014, 0.23, -0.004], [w / 2 - 0.014, h - 0.015, 0.004]);
    for (let k = 1; k < 4; k++) s.box(K.sage, [-w / 2 + (w * k) / 4 - 0.002, 0.24, -0.006], [-w / 2 + (w * k) / 4 + 0.002, h - 0.03, 0.006]);
    for (const xx of [-w / 2 + 0.03, w / 2 - 0.03]) {
      s.rod(fr, [xx, 0.06, -0.12], [xx, 0.06, 0.12], 0.01, { radial: 6 });
      for (const z of [-0.12, 0.12]) s.ball(K.ink, [xx, 0.03, z], 0.025, { seg: 8 });
    }
    if (i > 0) for (const y of [0.5, 1.3]) s.cyl(K.ink, [-w / 2, y, 0], 0.016, 0.06, { seg: 8 });
    x += w;
  }
  p.collide([(-n * w) / 2, 0, -0.15], [(n * w) / 2, h, 0.15]);
}

/**
 * 陶器の洗面台（丸い鉢を壁に）と鏡・棚: 鉢（外と内を 1 つの回転体で）・台の柱・蛇口（管と十字の取っ手）・石けん台・鏡と棚・コップ・横のタオル掛けとタオル。
 * 原点は置く場所の真ん中（奥行き 0.42）、壁は z = -0.21
 */
export function washBasin(p0: Prop, w = 0.55, mirror = true, towel = mirror): void {
  const p = p0.sub([0, 0, -0.21]);
  const c = K.enamel;
  p.box(c, [-w / 2 + 0.02, 0.62, 0], [w / 2 - 0.02, 0.92, 0.02], { r: 0.006, ...ROUND });
  const b = p.sub([0, 0, 0.22]);
  b.lathe(c, [[0, 0.62], [0.12, 0.64], [0.2, 0.72], [0.235, 0.8], [0.24, 0.825], [0.226, 0.832], [0.21, 0.81], [0.18, 0.74], [0.08, 0.7], [0, 0.69]], [0, 0, 0], { seg: 26 });
  b.lathe(c, [[0, 0], [0.11, 0], [0.12, 0.02], [0.075, 0.06], [0.06, 0.5], [0.08, 0.63], [0, 0.63]], [0, 0, 0], { seg: 18 });
  b.cyl(K.metal, [0, 0.695, 0], 0.016, 0.006, { seg: 10 });
  // 蛇口（壁から出て下へ）と十字の取っ手
  p.tube(K.steel, [[0, 0.95, 0.02], [0, 0.96, 0.1], [0, 0.94, 0.15], [0, 0.9, 0.16]], 0.012, { seg: 10, radial: 8 });
  p.cyl(K.steel, [0, 0.98, 0.07], 0.01, 0.04, { seg: 8 });
  p.box(K.steel, [-0.035, 1.0, 0.065], [0.035, 1.01, 0.075], { r: 0.004 });
  p.box(K.steel, [-0.005, 1.0, 0.035], [0.005, 1.01, 0.105], { r: 0.004 });
  // 石けん台と石けん
  p.box(K.enamel, [w / 2 - 0.13, 0.92, 0.0], [w / 2 - 0.02, 0.935, 0.08], { r: 0.006, ...ROUND });
  p.box(K.cream, [w / 2 - 0.115, 0.935, 0.015], [w / 2 - 0.04, 0.96, 0.065], { r: 0.01 });
  if (mirror) {
    p.box(K.metal, [-w / 2 + 0.02, 1.15, 0], [w / 2 - 0.02, 1.62, 0.015], { r: 0.006, ...ROUND });
    p.box('#dbe5e3', [-w / 2 + 0.04, 1.17, 0.015], [w / 2 - 0.04, 1.6, 0.019]);
    p.box(K.enamel, [-w / 2 + 0.02, 1.04, 0], [w / 2 - 0.02, 1.06, 0.11], { r: 0.005, ...ROUND });
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) p.box(K.metal, [x - 0.008, 1.0, 0], [x + 0.008, 1.04, 0.08]);
    p.lathe(K.glassTint, [[0, 0], [0.028, 0], [0.032, 0.09], [0.028, 0.09], [0.024, 0.006], [0, 0.006]], [-0.12, 1.06, 0.06], { seg: 12 });
    p.rod(K.greyBlue, [-0.12, 1.07, 0.06], [-0.1, 1.2, 0.07], 0.005, { radial: 5 });
  }
  if (towel) {
    // タオル掛けとタオル（横の壁ぎわ）
    p.rod(K.steel, [w / 2 + 0.06, 1.0, 0.04], [w / 2 + 0.34, 1.0, 0.04], 0.008, { radial: 6 });
    for (const x of [w / 2 + 0.06, w / 2 + 0.34]) p.rod(K.steel, [x, 1.0, 0], [x, 1.0, 0.04], 0.008, { radial: 6 });
    p.box(K.paper, [w / 2 + 0.09, 0.66, 0.025], [w / 2 + 0.31, 1.01, 0.055], { r: 0.01 });
  }
  p.collide([-w / 2, 0.0, 0], [w / 2, 0.84, 0.46]);
}

/** ガラス戸の棚の中身の 1 段（局所: 棚板の上面の真ん中） */
function cabinetRow(p: Prop, w: number, d: number, clear: number, content: 'medicine' | 'dishes' | 'instruments'): void {
  let x = -w / 2 + 0.03;
  while (x < w / 2 - 0.05) {
    const r = p.r();
    if (r < 0.1) {
      x += 0.06 + p.r() * 0.08;
      continue;
    }
    // 棚の幅からはみ出す物は置かない（小さな物を試す）
    const room = w / 2 - x;
    const want = content === 'dishes' ? (r < 0.45 ? 0.2 : r < 0.8 ? 0.13 : 0.22) : content === 'instruments' && r < 0.45 ? 0.24 : r < 0.75 ? 0.08 : 0.14;
    if (want > room) {
      x += 0.04;
      continue;
    }
    if (content === 'dishes') {
      if (r < 0.45) {
        // 重ねた皿
        const n = 3 + Math.floor(p.r() * 5);
        for (let k = 0; k < n; k++) p.lathe(K.white, [[0, 0], [0.06, 0], [0.09, 0.012], [0.095, 0.016], [0, 0.012]], [x + 0.095, k * 0.012, -0.02], { seg: 18 });
        x += 0.2;
      } else if (r < 0.8) {
        teacup(p.sub([x + 0.05, 0, 0.02]));
        teacup(p.sub([x + 0.06, 0, -0.08]), K.cream);
        x += 0.13;
      } else {
        kettle(p.sub([x + 0.1, 0, -0.02], p.r() * 6), K.pale, 0.75);
        x += 0.22;
      }
      continue;
    }
    if (content === 'instruments' && r < 0.45) {
      // ガーゼ缶（ふた付きの筒）・膿盆
      if (p.r() < 0.5) {
        p.cyl(K.steel, [x + 0.07, Math.min(clear - 0.04, 0.16) / 2, 0], 0.065, Math.min(clear - 0.04, 0.16), { seg: 16 });
        p.cyl(K.steel, [x + 0.07, Math.min(clear - 0.04, 0.16) + 0.01, 0], 0.068, 0.02, { seg: 16 });
        p.box(K.ink, [x + 0.05, Math.min(clear - 0.04, 0.16) + 0.02, -0.01], [x + 0.09, Math.min(clear - 0.04, 0.16) + 0.03, 0.01]);
        x += 0.16;
      } else {
        kidneyDish(p.sub([x + 0.1, 0, 0], 0.1));
        x += 0.22;
      }
      continue;
    }
    // 薬の瓶（2 列）・広口の瓶・小箱
    if (r < 0.75) {
      const rr = 0.022 + p.r() * 0.016;
      const hh = Math.min(clear - 0.03, 0.09 + p.r() * 0.11);
      const col = BOTTLES[Math.floor(p.r() * BOTTLES.length)];
      bottle(p.sub([x + rr, 0, d / 2 - rr - 0.03]), rr, hh, col);
      if (p.r() < 0.6) bottle(p.sub([x + rr, 0, d / 2 - rr * 3 - 0.05]), rr, hh * (0.8 + p.r() * 0.3), col);
      x += rr * 2 + 0.012;
    } else if (r < 0.88) {
      const rr = 0.04;
      const hh = Math.min(clear - 0.03, 0.12);
      p.lathe(K.glassTint, [[0, 0], [rr, 0], [rr, hh * 0.85], [rr * 0.8, hh * 0.9], [0, hh * 0.9]], [x + rr, 0, 0], { seg: 14 });
      p.cyl(K.paper, [x + rr, hh * 0.92, 0], rr * 0.85, hh * 0.08, { seg: 14 });
      x += rr * 2 + 0.015;
    } else {
      storeBox(p.sub([x + 0.06, 0, 0], (p.r() - 0.5) * 0.1), 0.11, Math.min(clear - 0.03, 0.08 + p.r() * 0.06), 0.16, K.white);
      x += 0.14;
    }
  }
}

/** 膿盆（そら豆の形の浅い皿）。原点は底 */
export function kidneyDish(p: Prop): void {
  const o: V2[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const k = 1 - 0.32 * Math.max(0, Math.cos(a - Math.PI / 2)) ** 3;
    o.push([Math.cos(a) * 0.12, Math.sin(a) * 0.055 * k - 0.008 * Math.max(0, Math.sin(a))]);
  }
  p.extrude(K.steel, o, 'xz', 0, 0.035, { bevel: 0.006 });
}

/**
 * ガラス戸の棚（薬品棚・器械棚・食器棚）: 4 本の脚・下の戸棚（2 枚の扉・取っ手・鍵穴）・中ほどの台・上の中が見える箱（背板・側板・ガラスの棚板 2 枚）・
 * 2 枚のガラス戸の框とガラス・天板。content で中身（薬の瓶・器械・食器）
 */
export function glassCabinet(p: Prop, o: { w?: number; h?: number; dp?: number; body?: string; content?: 'medicine' | 'dishes' | 'instruments' } = {}): void {
  const W = o.w ?? 0.9;
  const H = o.h ?? 1.85;
  const D = o.dp ?? 0.4;
  const body = o.body ?? K.enamel;
  const leg = 0.1;
  const mid = 0.85;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(K.metal, [sx * (W / 2 - 0.04), leg / 2, sz * (D / 2 - 0.04)], 0.016, leg, { radiusTop: 0.022, seg: 8 });
  p.box(body, [-W / 2, leg, -D / 2], [W / 2, mid, D / 2 - 0.012], { r: 0.005, ...ROUND });
  for (const s of [-1, 1]) {
    const a = s < 0 ? -W / 2 + 0.015 : 0.004;
    const b = s < 0 ? -0.004 : W / 2 - 0.015;
    p.box(body, [a, leg + 0.02, D / 2 - 0.014], [b, mid - 0.02, D / 2 + 0.004], { r: 0.004, ...ROUND });
    p.box(K.ink, [s * 0.035 - 0.006, mid - 0.2, D / 2 + 0.004], [s * 0.035 + 0.006, mid - 0.1, D / 2 + 0.018], { r: 0.004 });
  }
  p.box(K.ink, [0.05, mid - 0.06, D / 2 + 0.004], [0.06, mid - 0.04, D / 2 + 0.006]);
  p.box(body, [-W / 2 - 0.012, mid, -D / 2 - 0.005], [W / 2 + 0.012, mid + 0.025, D / 2 + 0.015], { r: 0.005, ...ROUND });
  const top = H - 0.04;
  // 中の背板は 1 段暗く（ガラス越しに棚と瓶の形が浮かぶ）
  p.box(K.sage, [-W / 2 + 0.02, mid + 0.025, -D / 2], [W / 2 - 0.02, top, -D / 2 + 0.012]);
  for (const s of [-1, 1]) p.box(body, [s < 0 ? -W / 2 : W / 2 - 0.02, mid + 0.025, -D / 2], [s < 0 ? -W / 2 + 0.02 : W / 2, top, D / 2 - 0.02]);
  p.box(body, [-W / 2 - 0.012, top, -D / 2 - 0.006], [W / 2 + 0.012, H, D / 2 + 0.012], { r: 0.008, ...ROUND });
  // 中の棚板と中身
  const n = 3;
  const sh = (top - mid - 0.025) / n;
  for (let i = 0; i < n; i++) {
    const y = mid + 0.025 + sh * i;
    if (i > 0) p.box(K.glassTint, [-W / 2 + 0.02, y - 0.008, -D / 2 + 0.012], [W / 2 - 0.02, y, D / 2 - 0.04]);
    cabinetRow(p.sub([0, y, -0.02]), W - 0.06, D - 0.1, sh - 0.02, o.content ?? 'medicine');
  }
  // ガラス戸（框とガラス）・つまみ
  const zf = D / 2 - 0.02;
  for (const s of [-1, 1]) {
    const a = s < 0 ? -W / 2 + 0.005 : 0.003;
    const b = s < 0 ? -0.003 : W / 2 - 0.005;
    const f = (x0: number, y0: number, x1: number, y1: number): void => p.box(body, [x0, y0, zf], [x1, y1, zf + 0.02], { r: 0.003 });
    f(a, mid + 0.03, a + 0.035, top - 0.005);
    f(b - 0.035, mid + 0.03, b, top - 0.005);
    f(a, mid + 0.03, b, mid + 0.065);
    f(a, top - 0.04, b, top - 0.005);
    p.box('#e9efe8', [a + 0.035, mid + 0.065, zf + 0.008], [b - 0.035, top - 0.04, zf + 0.012], { kind: 'glass' });
    p.box(K.ink, [s * 0.022 - 0.005, mid + 0.4, zf + 0.02], [s * 0.022 + 0.005, mid + 0.5, zf + 0.032], { r: 0.004 });
  }
  p.collide([-W / 2 - 0.012, 0, -D / 2 - 0.006], [W / 2 + 0.012, H, D / 2 + 0.015]);
}

/** シャウカステン（レントゲンを見る光る板）: 枠の箱・光る乳白の板・上の挟む金具・挟んだフィルム・横のスイッチ。原点は壁の面 */
export function viewer(p: Prop, w = 0.9, y = 1.5): void {
  p.box(K.enamel, [-w / 2, y - 0.3, 0], [w / 2, y + 0.3, 0.08], { r: 0.012, ...ROUND });
  p.box('#f4f6e8', [-w / 2 + 0.04, y - 0.26, 0.08], [w / 2 - 0.04, y + 0.26, 0.082], { kind: 'glow' });
  p.box(K.metal, [-w / 2 + 0.04, y + 0.22, 0.08], [w / 2 - 0.04, y + 0.26, 0.09], { r: 0.004 });
  for (const x of [-0.3, -0.12, 0.1, 0.28]) p.box(K.ink, [x - 0.015, y + 0.21, 0.088], [x + 0.015, y + 0.25, 0.096], { r: 0.004 });
  p.box('#b3bfba', [-w / 2 + 0.08, y - 0.22, 0.083], [-0.02, y + 0.23, 0.085]);
  p.box('#c2ccc6', [-0.16, y - 0.12, 0.0852], [-0.1, y + 0.12, 0.0855]);
  p.box(K.ink, [w / 2 - 0.08, y - 0.29, 0.08], [w / 2 - 0.05, y - 0.27, 0.095], { r: 0.004 });
}

/** 体重計と身長計（台の秤）: ゴムを敷いた台・柱・竿の秤（分銅を滑らせる竿と目盛りの針）・後ろの身長計の棒と頭に当てる腕 */
export function scale(p: Prop): void {
  p.box(K.enamel, [-0.22, 0, -0.26], [0.22, 0.08, 0.2], { r: 0.015 });
  p.box(K.greyBlue, [-0.19, 0.08, -0.17], [0.19, 0.085, 0.17], { r: 0.004 });
  p.box(K.metal, [-0.025, 0.08, -0.25], [0.025, 1.25, -0.2], { r: 0.006, ...ROUND });
  // 竿の秤
  p.box(K.enamel, [-0.06, 1.18, -0.25], [0.06, 1.3, -0.19], { r: 0.012, ...ROUND });
  p.box(K.steel, [-0.3, 1.215, -0.215], [0.06, 1.235, -0.205]);
  p.box(K.steel, [-0.3, 1.25, -0.215], [0.06, 1.262, -0.205]);
  p.box(K.ink, [-0.12, 1.205, -0.222], [-0.09, 1.245, -0.198], { r: 0.004 });
  p.box(K.ink, [-0.23, 1.245, -0.222], [-0.21, 1.27, -0.198], { r: 0.004 });
  p.box(K.ink, [-0.32, 1.2, -0.217], [-0.3, 1.28, -0.203]);
  // 身長計（後ろの棒・目盛りの帯・頭の腕）
  p.box(K.wood, [-0.015, 1.3, -0.26], [0.015, 2.0, -0.23], { r: 0.004 });
  p.box(K.paper, [-0.012, 1.32, -0.23], [0.012, 1.98, -0.228]);
  p.box(K.metal, [-0.025, 1.68, -0.27], [0.025, 1.71, -0.03], { r: 0.006, ...ROUND });
  p.collide([-0.22, 0, -0.27], [0.22, 2.0, 0.2]);
}

/** カーテン（ひだのある布）: 上から見たジグザグの輪郭を下へ押し出す。局所: x の向きに長さ len、上端 y1・下端 y0 */
export function curtain(p: Prop, len: number, y0: number, y1: number, col = K.cloth): void {
  const n = Math.max(2, Math.round(len / 0.09));
  const front: V2[] = [];
  const back: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (len * i) / n;
    const z = i % 2 ? 0.022 : -0.022;
    front.push([x, z + 0.006]);
    back.push([x, z - 0.006]);
  }
  p.extrude(col, [...front, ...back.reverse()], 'xz', y0, y1, {});
}

/** 処置台（ベッド）: 鉄の管の頭板と足板（縦の桟）・横の枠・マットと敷布・枕・畳んだ毛布・キャスター、天井からのカーテンレールと寄せたカーテン */
export function treatBed(p: Prop, ceil: number): void {
  const len = 1.95;
  const L = len / 2;
  const fr = K.enamel;
  for (const [z, hh] of [[-L, 0.95], [L, 0.75]] as const) {
    for (const x of [-0.42, 0.42]) p.rod(fr, [x, 0.08, z], [x, hh, z], 0.018, { radial: 8 });
    p.rod(fr, [-0.42, hh, z], [0.42, hh, z], 0.016, { radial: 8 });
    p.rod(fr, [-0.42, 0.42, z], [0.42, 0.42, z], 0.014, { radial: 8 });
    for (let i = 1; i < 6; i++) p.rod(fr, [-0.42 + i * 0.14, 0.42, z], [-0.42 + i * 0.14, hh, z], 0.008, { radial: 6 });
    for (const x of [-0.42, 0.42]) caster(p.sub([x, 0, z + (z < 0 ? 0.03 : -0.03)]), 0.04);
  }
  for (const x of [-0.42, 0.42]) p.rod(fr, [x, 0.45, -L], [x, 0.45, L], 0.016, { radial: 8 });
  p.box(K.metal, [-0.41, 0.44, -L + 0.02], [0.41, 0.47, L - 0.02]);
  p.box('#c9d5cd', [-0.41, 0.47, -L + 0.03], [0.41, 0.6, L - 0.03], { r: 0.035 });
  p.box(K.paper, [-0.415, 0.585, -L + 0.04], [0.415, 0.615, L - 0.05], { r: 0.012, ...ROUND });
  p.ball(K.white, [0, 0.66, -L + 0.22], [0.27, 0.055, 0.15], { seg: 14 });
  p.box(K.cloth, [-0.36, 0.615, L - 0.5], [0.36, 0.7, L - 0.12], { r: 0.035 });
  p.collide([-0.44, 0, -L - 0.02], [0.44, 0.95, L + 0.02]);
  // カーテンレール（高さ 2.2 m、天井から吊り棒）とカーテン（片側に寄せてある）
  const rx = 0.75;
  const z0 = -L - 0.05;
  const z1 = L + 0.4;
  const ry = 2.2;
  const m = K.metal;
  p.box(m, [-rx, ry, z0], [-rx + 0.03, ry + 0.03, z1]);
  p.box(m, [-rx, ry, z1 - 0.03], [rx, ry + 0.03, z1]);
  p.box(m, [rx - 0.03, ry, z0], [rx, ry + 0.03, z1]);
  for (const [x, z] of [[-rx + 0.015, z0 + 0.1], [rx - 0.015, z0 + 0.1], [-rx + 0.015, z1 - 0.1], [rx - 0.015, z1 - 0.1]]) p.box(m, [x - 0.008, ry + 0.03, z - 0.008], [x + 0.008, ceil, z + 0.008]);
  curtain(p.sub([-rx + 0.015, 0, z0 + 0.05], -Math.PI / 2), 1.05, 0.35, ry - 0.01);
  curtain(p.sub([-rx + 0.015, 0, z0 + 1.1], -Math.PI / 2), z1 - z0 - 1.15, 1.75, ry - 0.01, '#c9d5cd');
  curtain(p.sub([-rx + 0.03, 0, z1 - 0.015]), 0.5, 0.35, ry - 0.01);
}

/** 点滴台: 5 本脚とキャスター・柱・上の掛け金物 2 本・吊った点滴の袋と点滴筒と管 */
export function ivPole(p: Prop): void {
  const m = K.steel;
  for (let i = 0; i < 5; i++) {
    const s = p.sub([0, 0, 0], (i / 5) * Math.PI * 2);
    s.rod(m, [0, 0.08, 0], [0, 0.06, 0.26], 0.012, { radial: 6 });
    caster(s.sub([0, 0, 0.26]), 0.025);
  }
  p.cyl(m, [0, 0.1, 0], 0.035, 0.06, { seg: 10 });
  p.cyl(m, [0, 1.02, 0], 0.012, 1.86, { seg: 8 });
  p.ball(m, [0, 1.96, 0], 0.016, { seg: 8 });
  for (const s of [-1, 1]) p.tube(m, [[0, 1.9, 0], [s * 0.12, 1.92, 0], [s * 0.17, 1.95, 0], [s * 0.17, 1.98, 0]], 0.006, { seg: 10, radial: 5 });
  p.box(K.glassTint, [0.12, 1.62, -0.03], [0.22, 1.9, 0.03], { r: 0.025 });
  p.box(K.white, [0.135, 1.7, 0.028], [0.205, 1.8, 0.032]);
  p.cyl(K.glassTint, [0.17, 1.56, 0], 0.012, 0.06, { seg: 8 });
  p.tube(K.glassTint, [[0.17, 1.53, 0], [0.18, 1.3, 0.02], [0.12, 1.05, 0.04], [0.04, 1.0, 0.02]], 0.003, { seg: 14, radial: 4 });
  p.collide([-0.26, 0, -0.26], [0.26, 1.98, 0.26]);
}

/** 処置のワゴン（ステンレスの 3 段）: 4 本の管の柱・縁の立った盆・押し手・キャスター。上に膿盆・ガーゼ缶・瓶・綿の瓶 */
export function cart(p: Prop, w = 0.6, dp = 0.45, h = 0.9): void {
  const m = K.steel;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.02);
    const z = sz * (dp / 2 - 0.02);
    p.rod(m, [x, 0.09, z], [x, h, z], 0.012, { radial: 8 });
    caster(p.sub([x, 0, z]), 0.035);
  }
  for (const y of [0.22, h * 0.58, h]) {
    p.box(m, [-w / 2, y - 0.012, -dp / 2], [w / 2, y, dp / 2], { r: 0.004 });
    for (const s of [-1, 1]) {
      p.box(m, [-w / 2, y, s * (dp / 2) - 0.004], [w / 2, y + 0.03, s * (dp / 2) + 0.004]);
      p.box(m, [s * (w / 2) - 0.004, y, -dp / 2], [s * (w / 2) + 0.004, y + 0.03, dp / 2]);
    }
  }
  p.tube(m, [[-w / 2 - 0.0, h - 0.05, -dp / 2 + 0.06], [-w / 2 - 0.07, h + 0.02, -dp / 2 + 0.06], [-w / 2 - 0.07, h + 0.02, dp / 2 - 0.06], [-w / 2 - 0.0, h - 0.05, dp / 2 - 0.06]], 0.011, { sharp: true });
  kidneyDish(p.sub([-0.12, h, 0.08], 0.2));
  p.cyl(m, [0.15, h + 0.07, -0.08], 0.07, 0.14, { seg: 16 });
  p.cyl(m, [0.15, h + 0.15, -0.08], 0.074, 0.02, { seg: 16 });
  p.box(K.ink, [0.13, h + 0.16, -0.09], [0.17, h + 0.17, -0.07]);
  p.lathe(K.glassTint, [[0, 0], [0.045, 0], [0.045, 0.1], [0.035, 0.11], [0, 0.11]], [0.18, h, 0.12], { seg: 12 });
  p.ball(K.white, [0.18, h + 0.08, 0.12], [0.035, 0.03, 0.035], { seg: 8 });
  p.cyl(K.steel, [0.18, h + 0.115, 0.12], 0.04, 0.012, { seg: 12 });
  bottle(p.sub([-0.2, h, -0.12]), 0.035, 0.18, BOTTLES[0]);
  for (let i = 0; i < 3; i++) storeBox(p.sub([-0.15 + i * 0.16, 0.22, 0], (p.r() - 0.5) * 0.2), 0.13, 0.08, 0.2, K.white);
  for (let i = 0; i < 4; i++) p.sub([-0.18 + i * 0.12, h * 0.58, -0.05], p.r()).cyl(K.white, [0, 0.04, 0], 0.035, 0.08, { seg: 12 });
  p.collide([-w / 2 - 0.08, 0, -dp / 2], [w / 2, h + 0.17, dp / 2]);
}

/** 酸素ボンベと運ぶ台車: 肩の丸いボンベ・弁と手回し・圧力計のついた調整器・2 輪の台車と押し手 */
export function oxygen(p: Prop): void {
  const c = K.sageD;
  const m = K.steel;
  p.lathe(c, [[0, 0.06], [0.08, 0.06], [0.09, 0.08], [0.09, 1.0], [0.08, 1.06], [0.04, 1.1], [0.02, 1.12], [0, 1.12]], [0, 0, 0], { seg: 18 });
  p.cyl(K.white, [0, 0.98, 0], 0.0905, 0.06, { seg: 18 });
  p.cyl(m, [0, 1.15, 0], 0.022, 0.07, { seg: 10 });
  p.torus(K.ink, [0, 1.2, 0], 0.035, 0.006, { axis: 'y', seg: 14 });
  p.box(m, [-0.02, 1.13, 0.0], [0.02, 1.17, 0.07], { r: 0.008 });
  p.cyl(m, [0, 1.15, 0.09], 0.035, 0.03, { axis: 'z', seg: 16 });
  p.cyl(K.paper, [0, 1.15, 0.106], 0.028, 0.003, { axis: 'z', seg: 14 });
  p.rod(K.ink, [0, 1.15, 0.108], [0.015, 1.165, 0.108], 0.002, { radial: 4 });
  // 台車
  p.box(K.metal, [-0.14, 0.02, -0.12], [0.14, 0.06, 0.12], { r: 0.006 });
  for (const s of [-1, 1]) {
    p.cyl(K.ink, [s * 0.16, 0.08, -0.1], 0.08, 0.03, { axis: 'x', seg: 14 });
    p.cyl(K.metal, [s * 0.16, 0.08, -0.1], 0.03, 0.035, { axis: 'x', seg: 10 });
    p.rod(K.metal, [s * 0.11, 0.06, -0.12], [s * 0.11, 1.05, -0.13], 0.01, { radial: 6 });
  }
  p.rod(K.metal, [-0.11, 1.05, -0.13], [0.11, 1.05, -0.13], 0.012, { radial: 6 });
  for (const y of [0.4, 0.8]) p.torus(K.metal, [0, y, 0], 0.095, 0.006, { axis: 'y', seg: 18, arc: Math.PI });
  p.collide([-0.2, 0, -0.2], [0.2, 1.22, 0.13]);
}

/**
 * たたんだ車椅子: 大きな後輪（タイヤ・リム・手で回す輪・輻）・前の小さな車輪とフォーク・横の枠（座の枠・肘掛け・押し手）・
 * 畳んで垂れた座と背の布・足台。原点は足元の真ん中・前 +z（たたんだので幅 0.3 m）
 */
export function wheelchair(p: Prop): void {
  const m = K.steel;
  const R = 0.29;
  for (const s of [-1, 1]) {
    const x = s * 0.15;
    p.torus(K.ink, [x, R + 0.01, -0.1], R - 0.012, 0.016, { axis: 'x', seg: 28 });
    p.torus(m, [x, R + 0.01, -0.1], R - 0.04, 0.006, { axis: 'x', seg: 28 });
    p.torus(m, [x + s * 0.03, R + 0.01, -0.1], R - 0.05, 0.005, { axis: 'x', seg: 24 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.rod(m, [x, R + 0.01, -0.1], [x, R + 0.01 + Math.sin(a) * (R - 0.04), -0.1 + Math.cos(a) * (R - 0.04)], 0.002, { radial: 3 });
    }
    p.cyl(m, [x, R + 0.01, -0.1], 0.025, 0.04, { axis: 'x', seg: 10 });
    // 前の車輪とフォーク
    p.cyl(K.ink, [s * 0.11, 0.07, 0.3], 0.07, 0.025, { axis: 'x', seg: 14 });
    p.rod(m, [s * 0.11, 0.07, 0.3], [s * 0.11, 0.2, 0.28], 0.009, { radial: 5 });
    // 横の枠
    const fx = s * 0.12;
    p.tube(m, [[fx, 0.2, 0.28], [fx, 0.48, 0.22], [fx, 0.48, -0.22], [fx, 0.92, -0.32]], 0.012, { sharp: true });
    p.rod(m, [fx, 0.2, 0.28], [fx, 0.25, -0.2], 0.01, { radial: 6 });
    p.tube(m, [[fx, 0.48, 0.12], [fx, 0.68, 0.12], [fx, 0.68, -0.24]], 0.01, { sharp: true });
    p.box(K.darker, [fx - 0.025, 0.68, -0.22], [fx + 0.025, 0.7, 0.08], { r: 0.008 });
    p.cyl(K.darker, [fx, 0.92, -0.32], 0.016, 0.1, { axis: 'z', seg: 8 });
    // 足台（跳ね上げた板）
    p.rod(m, [fx, 0.2, 0.28], [fx, 0.1, 0.38], 0.009, { radial: 5 });
    p.box(K.metal, [fx - (s < 0 ? 0 : 0.1), 0.1, 0.37], [fx + (s < 0 ? 0.1 : 0), 0.22, 0.39], { r: 0.004 });
  }
  // 垂れた座と背の布（たたんで真ん中が下がる）
  for (const s of [-1, 1]) p.sub([s * 0.06, 0.45, 0], 0, { roll: s * 0.9 }).box(K.darker, [-0.07, -0.004, -0.2], [0.07, 0.004, 0.2]);
  p.box(K.darker, [-0.11, 0.55, -0.31], [0.11, 0.88, -0.29], { r: 0.004 });
  p.collide([-0.2, 0, -0.42], [0.2, 0.95, 0.42]);
}

/** 顕微鏡: 馬蹄形の台・弓形の腕・ステージと押さえ・斜めの鏡筒と接眼・対物のレボルバー・横の焦点のつまみ・下の鏡。原点は台の下 */
export function microscope(p: Prop): void {
  const c = K.darker;
  const m = K.steel;
  const hs: V2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 0.2 + (i / 12) * Math.PI * 1.6;
    hs.push([Math.cos(a) * 0.075, Math.sin(a) * 0.09 - 0.02]);
  }
  for (let i = 12; i >= 0; i--) {
    const a = Math.PI * 0.2 + (i / 12) * Math.PI * 1.6;
    hs.push([Math.cos(a) * 0.035, Math.sin(a) * 0.045 - 0.02]);
  }
  p.extrude(c, hs.map(([x, z]) => [x, -z] as V2), 'xz', 0, 0.025, { bevel: 0.004 });
  p.box(c, [-0.02, 0.025, -0.1], [0.02, 0.08, -0.05], { r: 0.006 });
  p.extrude(c, [[-0.09, 0.07], [-0.06, 0.07], [-0.05, 0.2], [-0.02, 0.3], [0.0, 0.33], [-0.04, 0.34], [-0.08, 0.25]], 'zy', -0.02, 0.02, { bevel: 0.006 });
  p.box(c, [-0.06, 0.15, -0.05], [0.06, 0.162, 0.07], { r: 0.004 });
  for (const s of [-1, 1]) p.box(m, [s * 0.03 - 0.006, 0.162, -0.02], [s * 0.03 + 0.006, 0.166, 0.04]);
  p.cyl(K.glassTint, [0, 0.14, 0.01], 0.02, 0.004, { seg: 10 });
  const t = p.sub([0, 0.3, 0.0], 0, { pitch: 0.45 });
  t.cyl(c, [0, 0.0, 0], 0.022, 0.18, { seg: 12 });
  t.cyl(m, [0, 0.11, 0], 0.014, 0.05, { seg: 10 });
  t.cyl(c, [0, 0.14, 0], 0.017, 0.012, { seg: 10 });
  p.cyl(m, [0, 0.215, 0.03], 0.03, 0.02, { seg: 12 });
  for (const a of [-0.5, 0, 0.5]) p.sub([0, 0.2, 0.03], a).rod(m, [0, 0, 0.018], [0, -0.035, 0.022], 0.007, { radial: 6 });
  for (const s of [-1, 1]) p.cyl(c, [s * 0.04, 0.22, -0.07], 0.02, 0.016, { axis: 'x', seg: 12 });
  p.cyl(m, [0, 0.07, 0.01], 0.025, 0.006, { seg: 12 });
}

/** 遠心機（卓上）: 丸い胴と丸いふた・ふたの留め金・前の傾いた操作の板（タイマーのつまみ・表示）・足 */
export function centrifuge(p: Prop): void {
  const c = K.enamel;
  p.lathe(c, [[0, 0.015], [0.16, 0.015], [0.18, 0.04], [0.185, 0.22], [0.175, 0.25], [0, 0.25]], [0, 0, 0], { seg: 22 });
  p.lathe(K.pale, [[0, 0.25], [0.17, 0.25], [0.165, 0.28], [0.1, 0.31], [0, 0.315]], [0, 0, 0], { seg: 22 });
  p.cyl(K.metal, [0, 0.318, 0], 0.03, 0.012, { seg: 12 });
  p.box(K.ink, [-0.02, 0.22, 0.17], [0.02, 0.27, 0.19], { r: 0.006 });
  for (const s of [-1, 1]) p.cyl(K.ink, [s * 0.12, 0.007, s * 0.06], 0.02, 0.014, { seg: 8 });
  const f = p.sub([0, 0.05, 0.18], 0, { pitch: -0.4 });
  f.box(K.sage, [-0.12, 0, -0.02], [0.12, 0.13, 0.01], { r: 0.008, ...ROUND });
  for (const x of [-0.06, 0.06]) {
    f.cyl(K.ink, [x, 0.065, 0.02], 0.022, 0.02, { axis: 'z', seg: 12 });
    f.box(K.white, [x - 0.003, 0.07, 0.03], [x + 0.003, 0.085, 0.032]);
  }
}

/** 試験管立て（木の 2 段の板と脚）と試験管（底の丸い回転体・中に少しの液） */
export function tubeRack(p: Prop): void {
  const w = 0.3;
  for (const y of [0.04, 0.1]) p.box(K.wood, [-w / 2, y - 0.012, -0.04], [w / 2, y, 0.04], { r: 0.003 });
  for (const s of [-1, 1]) p.box(K.woodD, [s * (w / 2) - 0.01, 0, -0.045], [s * (w / 2) + 0.01, 0.12, 0.045], { r: 0.003 });
  for (let i = 0; i < 8; i++) {
    if (p.r() < 0.2) continue;
    const x = -w / 2 + 0.03 + i * 0.034;
    const h = 0.14 + p.r() * 0.02;
    p.lathe(K.glassTint, [[0, 0.012], [0.006, 0.013], [0.009, 0.018], [0.009, h], [0.0105, h + 0.004], [0, h + 0.004]], [x, 0, 0], { seg: 8 });
    if (p.r() < 0.6) p.cyl(PAPERS[Math.floor(p.r() * PAPERS.length)], [x, 0.04, 0], 0.0095, 0.05, { seg: 8 });
  }
}

/** 検体の紙コップ（縁の巻き）。原点は底 */
export function cup(p: Prop, col = '#e5ece0'): void {
  p.lathe(col, [[0, 0], [0.026, 0], [0.034, 0.09], [0.037, 0.093], [0.032, 0.093], [0.023, 0.006], [0, 0.006]], [0, 0, 0], { seg: 12 });
}

/** 小便器（朝顔形の陶器）: 壁の板・広がった口・下へすぼまる胴・上の洗浄の管と弁。原点は壁の面の床 */
export function urinal(p: Prop): void {
  const c = K.enamel;
  p.box(c, [-0.17, 0.5, 0], [0.17, 1.12, 0.03], { r: 0.012, ...ROUND });
  const b = p.sub([0, 0.75, 0.17], 0, { pitch: 0.45 });
  b.lathe(c, [[0, -0.25], [0.04, -0.25], [0.07, -0.12], [0.12, 0.05], [0.165, 0.14], [0.17, 0.16], [0.155, 0.16], [0.11, 0.06], [0.055, -0.08], [0, -0.1]], [0, 0, 0], { seg: 24 });
  p.rod(K.metal, [0, 0.55, 0.12], [0, 0.4, 0.06], 0.02, { radial: 8 });
  p.rod(K.metal, [0, 0.4, 0.06], [0, 0.4, 0.0], 0.02, { radial: 8 });
  p.rod(K.steel, [0, 1.12, 0.06], [0, 1.45, 0.06], 0.012, { radial: 8 });
  p.cyl(K.steel, [0, 1.45, 0.06], 0.03, 0.06, { seg: 12 });
  p.rod(K.steel, [0, 1.45, 0.06], [0.08, 1.4, 0.1], 0.006, { radial: 5 });
  p.rod(K.steel, [0, 1.12, 0.06], [0, 1.0, 0.14], 0.01, { radial: 6 });
  p.collide([-0.18, 0.0, 0], [0.18, 1.12, 0.34]);
}

/** 和式の便器（床の楕円の鉢と前の覆い）・高い所の水槽と下りる管と引き手・紙の掛け。原点は個室の床の真ん中、背の壁は z = -dp/2 */
export function squatToilet(p: Prop, dp: number, w: number): void {
  const c = K.enamel;
  const o: V2[] = [];
  const hole: V2[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    o.push([Math.cos(a) * 0.2, Math.sin(a) * 0.34]);
    hole.push([Math.cos(-a) * 0.15, Math.sin(-a) * 0.28]);
  }
  p.extrude(c, o, 'xz', 0, 0.025, { holes: [hole] });
  p.extrude(K.sage, hole.slice().reverse(), 'xz', -0.002, 0.004, {});
  p.ball(c, [0, 0.0, -0.24], [0.16, 0.2, 0.12], { seg: 14 });
  // 水槽・管・引き手の鎖
  p.box(c, [-0.2, 1.75, -dp / 2], [0.2, 1.97, -dp / 2 + 0.2], { r: 0.015, ...ROUND });
  p.rod(K.steel, [-0.1, 1.75, -dp / 2 + 0.06], [-0.1, 0.3, -dp / 2 + 0.06], 0.016, { radial: 8 });
  p.tube(K.steel, [[-0.1, 0.3, -dp / 2 + 0.06], [-0.1, 0.12, -dp / 2 + 0.1], [0, 0.04, -0.3]], 0.016, { seg: 10, radial: 8 });
  p.rod(K.ink, [0.15, 1.75, -dp / 2 + 0.15], [0.15, 1.3, -dp / 2 + 0.15], 0.003, { radial: 4 });
  p.ball(K.ink, [0.15, 1.28, -dp / 2 + 0.15], 0.02, { seg: 8 });
  // 紙の掛け（横の仕切り）
  p.box(K.metal, [w / 2 - 0.05, 0.75, -0.1], [w / 2 - 0.03, 0.86, 0.04], { r: 0.004 });
  p.cyl(K.paper, [w / 2 - 0.1, 0.78, -0.03], 0.055, 0.11, { axis: 'z', seg: 14 });
}

/** バケツ（ブリキ）: 広がった胴・縁・つる */
export function bucket(p: Prop, col = K.greyBlue): void {
  p.lathe(col, [[0, 0], [0.11, 0], [0.115, 0.01], [0.14, 0.26], [0.135, 0.262], [0.108, 0.012], [0, 0.012]], [0, 0, 0], { seg: 18 });
  p.torus(col, [0, 0.262, 0], 0.142, 0.006, { axis: 'y', seg: 18 });
  p.sub([0, 0.262, 0], 0, { pitch: -0.9 }).torus(K.metal, [0, 0, 0], 0.14, 0.004, { axis: 'z', arc: Math.PI, seg: 12 });
}

/** モップ（柄・金具・垂れた糸の房）。原点は房の下・柄は +y へ少し傾いて立つ */
export function mop(p: Prop): void {
  p.rod(K.woodD, [0, 0.12, 0], [0, 1.4, 0], 0.013, { radial: 8 });
  p.box(K.metal, [-0.05, 0.1, -0.012], [0.05, 0.13, 0.012], { r: 0.004 });
  for (let i = 0; i < 9; i++) {
    const x = -0.045 + (i % 5) * 0.022 + (i > 4 ? 0.011 : 0);
    const z = i > 4 ? 0.012 : -0.012;
    p.rod(K.paper, [x, 0.11, z], [x * 1.6 + (p.r() - 0.5) * 0.03, 0.0, z * 2.5], 0.009, { radial: 4 });
  }
}

/**
 * 掃除の流し（低い陶器の流し）: 厚い縁の箱・くぼみ（内の 4 面と底）・蛇口・横に立て掛けたモップとバケツ。原点は壁の面の床の真ん中。
 * mop・bucket は置く側（1 = +x、-1 = -x、0 = 置かない）。同じ側ならバケツはモップの外
 */
export function mopSink(p: Prop, o: { mop?: number; bucket?: number } = {}): void {
  const ms = o.mop ?? 1;
  const bs = o.bucket ?? -1;
  const c = K.enamel;
  const w = 0.6;
  const d = 0.45;
  p.box(c, [-w / 2, 0, 0], [w / 2, 0.08, d], { r: 0.01, ...ROUND });
  for (const [a, b] of [[[-w / 2, 0], [w / 2, 0.05]], [[-w / 2, d - 0.05], [w / 2, d]], [[-w / 2, 0], [-w / 2 + 0.05, d]], [[w / 2 - 0.05, 0], [w / 2, d]]] as [V2, V2][]) {
    p.box(c, [a[0], 0.08, a[1]], [b[0], 0.42, b[1]], { r: 0.012, ...ROUND });
  }
  p.box(K.sage, [-w / 2 + 0.05, 0.08, 0.05], [w / 2 - 0.05, 0.085, d - 0.05]);
  p.cyl(K.metal, [0, 0.086, d / 2], 0.025, 0.004, { seg: 10 });
  p.tube(K.steel, [[0, 0.75, 0.0], [0, 0.76, 0.1], [0, 0.72, 0.14], [0, 0.66, 0.15]], 0.012, { seg: 10, radial: 8 });
  p.box(K.steel, [-0.035, 0.77, 0.05], [0.035, 0.78, 0.06], { r: 0.004 });
  if (ms) mop(p.sub([ms * (w / 2 + 0.07), 0, 0.08], 0, { roll: -ms * 0.06, pitch: 0.05 }));
  if (bs) {
    const bx = bs * (w / 2 + 0.18 + (bs === ms ? 0.16 : 0));
    bucket(p.sub([bx, 0, 0.25]));
    p.collide([bx - 0.15, 0, 0.1], [bx + 0.15, 0.27, 0.4]);
  }
  p.collide([-w / 2, 0, 0], [w / 2, 0.42, d]);
}

