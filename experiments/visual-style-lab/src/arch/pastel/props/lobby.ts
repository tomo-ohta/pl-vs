import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop, V2 } from '../../../props/kit.ts';
import { K, PAPERS } from './mats.ts';

/**
 * 待合・風除室・通用口の小物（昭和の町の診療所）。小物の道具（props/kit.ts）の局所の座標: 足元の真ん中が原点・正面 +z・背 -z。
 * 寸法は実物: 長椅子（座 0.42 m・背 0.82 m）・石油ストーブ（胴 φ0.43 m）と囲い（1.1 m 角）・下足箱（升 0.3 × 0.2 m）・
 * スリッパ（0.25 m）・傘立て（φ0.28 m）・雑誌の棚・柱時計・ピンク電話・瓶の冷水機・鉢植え。
 * 平らな色面の絵柄なので、模様は描かず、部位の形（縁・継ぎ目・取っ手・脚）で何か分かるようにする。
 */

const ROUND = { seg: 1 } as const;

/** 待合の長椅子: 張りの座と背（ボタン留め）・木の座枠と背の笠木・鉄の管の脚と肘掛け（両端）・長い物は真ん中にも脚 */
export function bench(p0: Prop, W = 1.8): void {
  // 背の上端が後ろへ出るので、全体を 5 cm 前へ（外形の奥行き ±0.26 m）
  const p = p0.sub([0, 0, 0.05]);
  const seat = K.cushion;
  const seam = K.sageD;
  const fr = K.metal;
  const wood = K.woodD;
  // 座枠（木）と座の張り（前の縁に玉縁）
  p.box(wood, [-W / 2 + 0.03, 0.33, -0.19], [W / 2 - 0.03, 0.37, 0.19], { r: 0.008, ...ROUND });
  p.box(seat, [-W / 2 + 0.02, 0.37, -0.2], [W / 2 - 0.02, 0.44, 0.215], { r: 0.025 });
  p.box(seam, [-W / 2 + 0.04, 0.403, 0.213], [W / 2 - 0.04, 0.409, 0.219]);
  // 背（少し後ろへ倒す）・ボタン留め・上の笠木
  const bk = p.sub([0, 0.47, -0.2], 0, { pitch: -0.14 });
  bk.box(seat, [-W / 2 + 0.02, 0, -0.035], [W / 2 - 0.02, 0.33, 0.03], { r: 0.025 });
  bk.box(wood, [-W / 2 + 0.02, 0.33, -0.035], [W / 2 - 0.02, 0.37, 0.035], { r: 0.012, ...ROUND });
  // ボタンは 2 段で互い違い
  const n = Math.max(2, Math.round(W / 0.3));
  for (let i = 0; i < n; i++) bk.cyl(seam, [-W / 2 + (W * (i + 0.5)) / n, 0.1, 0.03], 0.011, 0.01, { axis: 'z', seg: 8 });
  for (let i = 1; i < n; i++) bk.cyl(seam, [-W / 2 + (W * i) / n, 0.23, 0.03], 0.011, 0.01, { axis: 'z', seg: 8 });
  // 脚（両端は肘掛けつき。1.4 m より長い物は真ん中にも）
  const xe = W / 2 + 0.006;
  const frames = W > 1.4 ? [-xe, 0, xe] : [-xe, xe];
  for (const x of frames) {
    const end = Math.abs(x) > 0.1;
    p.rod(fr, [x, 0.015, 0.165], [x, 0.36, 0.15], 0.014);
    p.rod(fr, [x, 0.015, -0.17], [x, 0.36, -0.16], 0.014);
    p.rod(fr, [x, 0.02, -0.19], [x, 0.02, 0.19], 0.013);
    p.rod(fr, [x, 0.36, -0.17], [x, 0.365, -0.23], 0.012);
    bk.rod(fr, [x, -0.1, -0.045], [x, 0.33, -0.045], 0.012);
    for (const z of [-0.19, 0.19]) p.ball(K.ink, [x, 0.012, z], 0.016, { seg: 8 });
    if (end) {
      p.tube(fr, [[x, 0.44, 0.165], [x, 0.6, 0.155], [x, 0.62, -0.15]], 0.013, { sharp: true });
      p.box(wood, [x - 0.025, 0.615, -0.17], [x + 0.025, 0.645, 0.18], { r: 0.012, ...ROUND });
    }
  }
  p.collide([-W / 2 - 0.03, 0, -0.3], [W / 2 + 0.03, 0.86, 0.22]);
}

/** やかん（ほうろう）: 胴・ふたとつまみ・注ぎ口・つる（上の取っ手） */
export function kettle(p: Prop, col = K.enamel, s = 1): void {
  p.lathe(col, [[0, 0], [0.1 * s, 0], [0.118 * s, 0.025 * s], [0.12 * s, 0.07 * s], [0.095 * s, 0.12 * s], [0.045 * s, 0.14 * s], [0, 0.14 * s]], [0, 0, 0], { seg: 20 });
  p.cyl(col, [0, 0.145 * s, 0], 0.045 * s, 0.012 * s, { seg: 14 });
  p.ball(K.ink, [0, 0.16 * s, 0], 0.014 * s, { seg: 8 });
  p.tube(col, [[0.09 * s, 0.05 * s, 0], [0.15 * s, 0.09 * s, 0], [0.19 * s, 0.15 * s, 0]], 0.014 * s, { seg: 10, radial: 8 });
  p.torus(K.ink, [0, 0.14 * s, 0], 0.085 * s, 0.006, { axis: 'z', arc: Math.PI, seg: 14 });
}

/**
 * 石油ストーブ（対流形）: 台の輪・胴・燃焼の窓・つまみと油量計・上の天板と網・やかん、
 * 周りのストーブの囲い（上・中・下の横の管と縦の桟。1.1 m 角）
 */
export function stove(p: Prop): void {
  const body = K.sageD;
  const dark = K.dark;
  const metal = K.metal;
  p.lathe(body, [[0, 0], [0.25, 0], [0.262, 0.02], [0.25, 0.075], [0.215, 0.085], [0.215, 0.5], [0.232, 0.52], [0.236, 0.55], [0, 0.55]], [0, 0, 0], { seg: 26 });
  p.torus(dark, [0, 0.08, 0], 0.218, 0.008, { axis: 'y', seg: 26 });
  // 燃焼の窓（暗いガラス）と枠・つまみ・油量計
  p.box(metal, [-0.075, 0.16, 0.18], [0.075, 0.27, 0.228], { r: 0.012, ...ROUND });
  p.box(K.darker, [-0.058, 0.175, 0.2], [0.058, 0.255, 0.232], { r: 0.008, ...ROUND });
  p.cyl(K.ink, [0.15, 0.045, 0.21], 0.024, 0.03, { axis: 'z', seg: 10 });
  p.cyl(K.paper, [-0.14, 0.05, 0.215], 0.018, 0.02, { axis: 'z', seg: 10 });
  // 天板の網（輪と横の棒）と上の天板
  p.torus(dark, [0, 0.56, 0], 0.17, 0.009, { axis: 'y', seg: 22 });
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) p.rod(dark, [Math.cos(a) * 0.17, 0.56, Math.sin(a) * 0.17], [-Math.cos(a) * 0.17, 0.56, -Math.sin(a) * 0.17], 0.006, { radial: 6 });
  kettle(p.sub([0.02, 0.565, 0.0], 0.3));
  // 囲い（ストーブガード）
  const r = 0.55;
  const fence = metal;
  for (const y of [0.05, 0.36, 0.64]) {
    p.rod(fence, [-r, y, -r], [r, y, -r], 0.01, { radial: 6 });
    p.rod(fence, [r, y, -r], [r, y, r], 0.01, { radial: 6 });
    p.rod(fence, [r, y, r], [-r, y, r], 0.01, { radial: 6 });
    p.rod(fence, [-r, y, r], [-r, y, -r], 0.01, { radial: 6 });
  }
  // 隅の柱（太い）と、各辺の縦の桟
  for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) p.rod(fence, [x, 0, z], [x, 0.65, z], 0.012, { radial: 6 });
  const nb = 5;
  for (let i = 1; i < nb; i++) {
    const t = -r + (2 * r * i) / nb;
    for (const [x, z] of [[t, -r], [t, r], [-r, t], [r, t]] as V2[]) p.rod(fence, [x, 0.05, z], [x, 0.64, z], 0.006, { radial: 5 });
  }
  p.collide([-r - 0.02, 0, -r - 0.02], [r + 0.02, 0.68, r + 0.02]);
}

/** スリッパ（片方）: 底（上から見た輪郭の板）と甲（前の 1/3 を覆う丸い帯）。原点は底の下の真ん中・つま先が +z */
export function slipper(p: Prop, upper: string, sole = K.creamD): void {
  const o: V2[] = [[0, -0.125], [0.03, -0.11], [0.038, -0.07], [0.044, 0.0], [0.046, 0.08], [0.035, 0.115], [0, 0.125], [-0.035, 0.115], [-0.046, 0.08], [-0.044, 0.0], [-0.038, -0.07], [-0.03, -0.11]];
  p.extrude(sole, o, 'xz', 0, 0.018, { bevel: 0.004 });
  p.box(upper, [-0.045, 0.012, 0.005], [0.045, 0.05, 0.105], { r: 0.018 });
}

/** 下足箱（木の升目の棚）: 側板・天板・背板・棚板と仕切り（厚みのある升）・引っ込んだ台輪、升の中にスリッパと靴 */
export function shoeRack(p: Prop, w: number, h: number, dp = 0.36, fill = 0.4): void {
  const body = K.enamel;
  const inner = K.sage;
  const t = 0.018;
  const base = 0.07;
  p.box(K.sageD, [-w / 2 + 0.02, 0, -dp / 2 + 0.01], [w / 2 - 0.02, base, dp / 2 - 0.025]);
  p.box(inner, [-w / 2 + t, base, -dp / 2], [w / 2 - t, h, -dp / 2 + 0.012]);
  for (const s of [-1, 1]) p.box(body, [s < 0 ? -w / 2 : w / 2 - t, 0, -dp / 2], [s < 0 ? -w / 2 + t : w / 2, h, dp / 2], { r: 0.004, ...ROUND });
  p.box(body, [-w / 2 - 0.012, h - 0.002, -dp / 2 - 0.004], [w / 2 + 0.012, h + 0.024, dp / 2 + 0.014], { r: 0.008, ...ROUND });
  p.box(body, [-w / 2 + t, base, -dp / 2 + 0.012], [w / 2 - t, base + t, dp / 2]);
  const rows = Math.max(2, Math.round((h - base) / 0.2));
  const cols = Math.max(2, Math.round(w / 0.3));
  const ch = (h - base - t) / rows;
  const cw = (w - 2 * t) / cols;
  for (let i = 1; i < rows; i++) {
    const y = base + t + ch * i;
    p.box(body, [-w / 2 + t, y - t / 2, -dp / 2 + 0.012], [w / 2 - t, y + t / 2, dp / 2]);
  }
  for (let j = 1; j < cols; j++) {
    const x = -w / 2 + t + cw * j;
    p.box(body, [x - t / 2, base + t, -dp / 2 + 0.012], [x + t / 2, h, dp / 2]);
  }
  // 升の中: スリッパの揃え（つま先を手前）・ときどき靴 1 足
  const ups = [K.greyBlue, K.cushion, K.creamD, K.sageD];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const cx = -w / 2 + t + cw * (j + 0.5);
      const y0 = base + t + ch * i + (i > 0 ? t / 2 : 0);
      if (p.r() < fill) {
        const col = ups[Math.floor(p.r() * ups.length)];
        const s = p.sub([cx + (p.r() - 0.5) * 0.02, y0, dp / 2 - 0.15], (p.r() - 0.5) * 0.15);
        slipper(s.sub([-0.05, 0, 0], -0.04), col);
        slipper(s.sub([0.05, 0, 0], 0.04), col);
      } else if (p.r() < 0.12) {
        shoe(p.sub([cx - 0.05, y0, dp / 2 - 0.16], 0.03));
        shoe(p.sub([cx + 0.05, y0, dp / 2 - 0.16], -0.03));
      }
    }
  p.collide([-w / 2 - 0.012, 0, -dp / 2], [w / 2 + 0.012, h + 0.024, dp / 2 + 0.014]);
}

/** 靴（片方。かかとの低い革靴）: 底・甲の丸い胴・履き口 */
export function shoe(p: Prop, col = K.darker): void {
  p.box(K.ink, [-0.042, 0, -0.125], [0.042, 0.015, 0.125], { r: 0.007, ...ROUND });
  p.ball(col, [0, 0.03, 0.04], [0.042, 0.04, 0.085], { seg: 10 });
  p.box(col, [-0.04, 0.012, -0.125], [0.04, 0.07, 0.0], { r: 0.02 });
  p.box(K.ink, [-0.028, 0.065, -0.09], [0.028, 0.072, 0.0], { r: 0.003 });
}

/** スリッパ立て（針金の棚）: 2 本の柱と足・斜めの段（手前の低い棒と奥の高い棒）にスリッパが斜めに載る */
export function slipperStand(p: Prop, w = 0.6, n = 6): void {
  const fr = K.metal;
  for (const s of [-1, 1]) {
    const x = (s * w) / 2;
    p.rod(fr, [x, 0, -0.02], [x, 0.92, -0.02], 0.01, { radial: 6 });
    p.rod(fr, [x, 0.01, -0.14], [x, 0.01, 0.14], 0.01, { radial: 6 });
    for (const z of [-0.14, 0.14]) p.ball(K.ink, [x, 0.012, z], 0.014, { seg: 6 });
  }
  p.rod(fr, [-w / 2, 0.92, -0.02], [w / 2, 0.92, -0.02], 0.01, { radial: 6 });
  const ups = [K.greyBlue, K.cushion, K.creamD];
  let k = 0;
  for (let lv = 0; lv < 3; lv++) {
    const y = 0.12 + lv * 0.27;
    p.rod(fr, [-w / 2, y, 0.09], [w / 2, y, 0.09], 0.006, { radial: 5 });
    p.rod(fr, [-w / 2, y + 0.15, -0.11], [w / 2, y + 0.15, -0.11], 0.006, { radial: 5 });
    for (const s of [-1, 1]) p.rod(fr, [(s * w) / 2, y, 0.09], [(s * w) / 2, y + 0.15, -0.11], 0.006, { radial: 5 });
    for (const x0 of [-0.16, 0.12]) {
      if (k >= n) break;
      const col = ups[(lv + (x0 > 0 ? 1 : 0)) % ups.length];
      for (const dx of [-0.05, 0.05]) slipper(p.sub([x0 + dx, y + 0.08, -0.01], Math.PI, { pitch: -0.64 }), col);
      k += 2;
    }
  }
  p.collide([-w / 2 - 0.02, 0, -0.15], [w / 2 + 0.02, 0.93, 0.15]);
}

/** 閉じた傘: 石突き・畳んだ布（細長い回転体）・留め帯・柄の棒・曲がった持ち手。原点は石突きの先 */
export function umbrella(p: Prop, col: string, len = 0.86): void {
  const k = len / 0.86;
  p.rod(K.ink, [0, 0, 0], [0, 0.05, 0], 0.004, { radial: 5 });
  p.lathe(col, [[0.004, 0.04], [0.02, 0.1 * k], [0.032, 0.35 * k], [0.036, 0.5 * k], [0.026, 0.62 * k], [0.008, 0.665 * k], [0, 0.67 * k]], [0, 0, 0], { seg: 10 });
  p.cyl(K.darker, [0, 0.45 * k, 0], 0.0365, 0.02, { seg: 10 });
  p.rod(K.metal, [0, 0.66 * k, 0], [0, 0.8 * k, 0], 0.006, { radial: 5 });
  p.torus(K.woodD, [0.035, 0.8 * k, 0], 0.035, 0.009, { axis: 'z', arc: Math.PI, seg: 10 });
  p.rod(K.woodD, [0.07, 0.8 * k, 0], [0.07, 0.77 * k, 0], 0.009, { radial: 6 });
}

/** 傘立て（陶器の筒）: 縁の盛り上がり・帯・中の暗い底、傘が少し傾いて立つ */
export function umbrellaStand(p: Prop, n = 2): void {
  const body = K.greyBlue;
  p.lathe(body, [[0, 0], [0.12, 0], [0.126, 0.012], [0.13, 0.44], [0.142, 0.47], [0.142, 0.49], [0.128, 0.495], [0.12, 0.48], [0.118, 0.46], [0, 0.46]], [0, 0, 0], { seg: 20 });
  p.torus(K.sageD, [0, 0.1, 0], 0.128, 0.007, { axis: 'y', seg: 20 });
  p.cyl(K.darker, [0, 0.462, 0], 0.117, 0.004, { seg: 18 });
  const cols = [K.dark, K.creamD, K.sageD, K.darker];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(n, 1)) * Math.PI * 2 + p.r();
    umbrella(p.sub([Math.cos(a) * 0.05, 0.03, Math.sin(a) * 0.05], p.r() * 6, { pitch: (p.r() - 0.5) * 0.18, roll: (p.r() - 0.5) * 0.18 }), cols[i % cols.length], 0.8 + p.r() * 0.1);
  }
  p.collide([-0.15, 0, -0.15], [0.15, 0.5, 0.15]);
}

/** 雑誌の棚（木）: 下が深い側板・背板・台輪・3 段の斜めの棚（手前の縁）に雑誌が立て掛けてある */
export function magazineRack(p: Prop, w = 0.8): void {
  const wd = K.wood;
  const wdD = K.woodD;
  for (const s of [-1, 1]) p.extrude(wd, [[-0.15, 0], [0.15, 0], [0.15, 0.1], [-0.02, 1.1], [-0.15, 1.1]], 'zy', s < 0 ? -w / 2 : w / 2 - 0.022, s < 0 ? -w / 2 + 0.022 : w / 2, { bevel: 0.005 });
  p.box(wdD, [-w / 2 + 0.02, 0.06, -0.15], [w / 2 - 0.02, 1.08, -0.138]);
  p.box(wdD, [-w / 2 + 0.02, 0, -0.13], [w / 2 - 0.02, 0.06, 0.13]);
  for (let i = 0; i < 3; i++) {
    const y = 0.1 + i * 0.32;
    const zf = 0.14 - i * 0.055;
    // 斜めの背の板（雑誌が寄り掛かる）・底の板・手前の縁
    p.sub([0, y, zf - 0.07], 0, { pitch: -0.36 }).box(wd, [-w / 2 + 0.022, 0, -0.012], [w / 2 - 0.022, 0.3, 0.0]);
    p.box(wd, [-w / 2 + 0.022, y - 0.015, zf - 0.08], [w / 2 - 0.022, y, zf]);
    p.box(wd, [-w / 2 + 0.022, y, zf - 0.016], [w / 2 - 0.022, y + 0.045, zf], { r: 0.005, ...ROUND });
    for (const x of [-0.25, 0, 0.25]) {
      if (p.r() < 0.18) continue;
      const m = p.sub([x + (p.r() - 0.5) * 0.03, y, zf - 0.045], (p.r() - 0.5) * 0.06, { pitch: -0.36 });
      const col = PAPERS[Math.floor(p.r() * PAPERS.length)];
      m.box(col, [-0.105, 0, -0.012], [0.105, 0.28, -0.004], { r: 0.002 });
      m.box(K.paper, [-0.09, 0.2, -0.004], [0.09, 0.25, -0.002]);
      m.box(K.sageD, [-0.07, 0.07, -0.004], [0.05, 0.08, -0.002]);
    }
  }
  p.collide([-w / 2, 0, -0.15], [w / 2, 1.1, 0.15]);
}

/** 時計の文字盤（縁・盤・12 の目盛り・時針と分針・軸）。原点は盤の中心、+z が手前 */
function dial(p: Prop, r: number, rim: string): void {
  p.torus(rim, [0, 0, 0.004], r + 0.004, 0.007, { axis: 'z', seg: 28 });
  p.cyl(K.paper, [0, 0, 0], r, 0.006, { axis: 'z', seg: 28 });
  for (let i = 0; i < 12; i++) p.sub([0, 0, 0.003], 0, { roll: (i * Math.PI) / 6 }).box(K.ink, [-0.003, r * 0.78, 0], [0.003, r * (i % 3 === 0 ? 0.95 : 0.9), 0.002]);
  const hh = p.r() * Math.PI * 2;
  p.sub([0, 0, 0.004], 0, { roll: -hh }).box(K.ink, [-0.005, -r * 0.1, 0], [0.005, r * 0.52, 0.002]);
  p.sub([0, 0, 0.006], 0, { roll: -hh * 12 }).box(K.ink, [-0.003, -r * 0.12, 0], [0.003, r * 0.82, 0.002]);
  p.cyl(K.ink, [0, 0, 0.009], 0.008, 0.006, { axis: 'z', seg: 8 });
}

/** 掛け時計。round = 丸い時計（縁・盤）、pendulum = 柱時計（木の箱・上の破風・盤・下のガラス戸の中の振り子）。原点は壁の面、y は盤の中心 */
export function clock(p: Prop, y = 2.6, kind: 'round' | 'pendulum' = 'round'): void {
  if (kind === 'round') {
    p.cyl(K.enamel, [0, y, 0.022], 0.17, 0.044, { axis: 'z', seg: 28 });
    dial(p.sub([0, y, 0.047]), 0.15, K.metal);
    return;
  }
  const wd = K.woodD;
  const w = 0.32;
  const d = 0.12;
  // 上（盤の箱）・破風・下（振り子の箱の枠）・背板・下の飾り
  p.box(wd, [-w / 2, y - 0.14, 0], [w / 2, y + 0.16, d], { r: 0.008, ...ROUND });
  p.box(K.sageD, [-w / 2, y - 0.6, 0], [w / 2, y - 0.14, 0.012]);
  for (const s of [-1, 1]) p.box(wd, [s < 0 ? -w / 2 : w / 2 - 0.03, y - 0.6, 0], [s < 0 ? -w / 2 + 0.03 : w / 2, y - 0.14, d], { r: 0.005, ...ROUND });
  p.box(wd, [-w / 2, y - 0.63, 0], [w / 2, y - 0.57, d], { r: 0.008, ...ROUND });
  p.box(wd, [-0.05, y - 0.68, 0.01], [0.05, y - 0.63, d - 0.02], { r: 0.01, ...ROUND });
  // 破風（箱の上に載る三角の板）
  p.sub([0, y + 0.16, 0]).extrude(wd, [[-w / 2 - 0.015, 0], [w / 2 + 0.015, 0], [w / 2 + 0.015, 0.025], [0, 0.075], [-w / 2 - 0.015, 0.025]], 'xy', -0.002, d + 0.01, { bevel: 0.004 });
  dial(p.sub([0, y, d + 0.003]), 0.11, K.creamD);
  // 振り子（棒と円盤）と、ガラス戸の桟・ガラス
  p.rod(K.creamD, [0, y - 0.16, 0.05], [0, y - 0.48, 0.05], 0.004, { radial: 5 });
  p.cyl(K.creamD, [0.0, y - 0.49, 0.05], 0.045, 0.008, { axis: 'z', seg: 18 });
  p.box(wd, [-w / 2 + 0.03, y - 0.17, d - 0.012], [w / 2 - 0.03, y - 0.14, d]);
  p.box('#e9efe8', [-w / 2 + 0.03, y - 0.57, d - 0.008], [w / 2 - 0.03, y - 0.17, d - 0.004], { kind: 'glass' });
}

/**
 * 公衆電話（ピンク電話の形。色は参考画像の表のセージ）と壁の棚: 木の棚板と三角の受け・斜めの前の面に回すダイヤル・上の受話器と台・
 * 硬貨の口・巻いたコード・電話帳。原点は棚の中心の床（壁は z = -0.145）
 */
export function payPhone(p: Prop): void {
  const zw = -0.145;
  const body = K.sage;
  p.box(K.wood, [-0.3, 0.9, zw], [0.3, 0.93, 0.1], { r: 0.006, ...ROUND });
  for (const s of [-1, 1]) p.extrude(K.woodD, [[zw, 0.9], [0.05, 0.9], [zw, 0.68]], 'zy', s * 0.24 - 0.01, s * 0.24 + 0.01, { bevel: 0.003 });
  // 胴（横から見た輪郭: 斜めの前の面）
  p.extrude(body, [[-0.12, 0.93], [0.08, 0.93], [0.08, 0.99], [0.035, 1.12], [-0.12, 1.15]], 'zy', -0.11, 0.11, { bevel: 0.016 });
  // ダイヤル（斜めの面に沿わせる）
  const d = p.sub([0, 1.058, 0.06], 0, { pitch: -0.37 });
  d.cyl(K.white, [0, 0, 0.004], 0.052, 0.008, { axis: 'z', seg: 24 });
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 0.35 + (i / 10) * Math.PI * 1.6;
    d.cyl(K.darker, [Math.cos(a) * 0.038, Math.sin(a) * 0.038, 0.008], 0.0075, 0.003, { axis: 'z', seg: 8 });
  }
  d.cyl(K.paper, [0, 0, 0.009], 0.018, 0.003, { axis: 'z', seg: 14 });
  d.box(K.metal, [0.03, -0.045, 0.006], [0.036, -0.03, 0.014]);
  // 硬貨の口・返却の口
  p.box(K.ink, [-0.035, 1.137, -0.095], [0.035, 1.153, -0.083], { r: 0.003 });
  p.box(K.darker, [0.075, 0.95, -0.03], [0.083, 0.98, 0.03], { r: 0.004 });
  // 受話器（台に横に載る）とコード
  for (const x of [-0.07, 0.07]) p.box(body, [x - 0.015, 1.135, -0.07], [x + 0.015, 1.165, -0.01], { r: 0.008, ...ROUND });
  p.tube(body, [[-0.1, 1.155, -0.04], [-0.07, 1.178, -0.04], [0.07, 1.178, -0.04], [0.1, 1.155, -0.04]], 0.014, { seg: 12 });
  for (const x of [-0.105, 0.105]) p.ball(body, [x, 1.15, -0.04], [0.026, 0.018, 0.036], { seg: 10 });
  p.tube(K.darker, [[-0.112, 1.14, -0.04], [-0.15, 1.04, 0.0], [-0.14, 0.97, -0.03], [-0.112, 1.0, -0.07]], 0.005, { seg: 14, radial: 5 });
  // 電話帳（棚の右）と、上の注意書きの札
  p.box(K.cream, [0.13, 0.93, -0.11], [0.29, 0.966, 0.06], { r: 0.004, ...ROUND });
  p.box(K.paper, [0.135, 0.934, 0.058], [0.285, 0.962, 0.063]);
  p.box(K.paper, [-0.09, 1.26, zw], [0.09, 1.38, zw + 0.004]);
  p.box(K.sageD, [-0.07, 1.34, zw + 0.004], [0.07, 1.355, zw + 0.006]);
}

/** 瓶の冷水機（ほうろうの箱・天板の受け・逆さの大きな瓶・前の蛇口と受け皿・横の紙コップ入れ） */
export function waterDispenser(p: Prop): void {
  p.box(K.sageD, [-0.15, 0, -0.15], [0.15, 0.06, 0.15]);
  p.box(K.enamel, [-0.16, 0.06, -0.16], [0.16, 0.95, 0.16], { r: 0.02 });
  p.box(K.pale, [-0.168, 0.95, -0.168], [0.168, 0.985, 0.168], { r: 0.012, ...ROUND });
  p.cyl(K.metal, [0, 1.0, 0], 0.07, 0.035, { seg: 16 });
  p.lathe(K.glassTint, [[0, 0.99], [0.03, 0.99], [0.03, 1.04], [0.06, 1.065], [0.125, 1.12], [0.135, 1.18], [0.135, 1.43], [0.12, 1.475], [0, 1.485]], [0, 0, 0], { seg: 20 });
  p.torus(K.greyBlue, [0, 1.25, 0], 0.137, 0.005, { axis: 'y', seg: 20 });
  // 前: 継ぎ目・吸気の桟・蛇口と受け皿
  p.box(K.creamD, [-0.14, 0.58, 0.16], [0.14, 0.586, 0.163]);
  for (let i = 0; i < 4; i++) p.box(K.creamD, [-0.1, 0.14 + i * 0.05, 0.16], [0.1, 0.156 + i * 0.05, 0.164]);
  p.box(K.metal, [-0.03, 0.8, 0.155], [0.03, 0.84, 0.2], { r: 0.008, ...ROUND });
  p.rod(K.metal, [0, 0.81, 0.19], [0, 0.78, 0.19], 0.008, { radial: 6 });
  p.box(K.ink, [-0.008, 0.84, 0.17], [0.008, 0.87, 0.2], { r: 0.004 });
  p.box(K.metal, [-0.09, 0.64, 0.16], [0.09, 0.66, 0.24], { r: 0.006, ...ROUND });
  p.box(K.darker, [-0.075, 0.66, 0.175], [0.075, 0.662, 0.23]);
  // 紙コップ入れ（横の筒と金具）
  p.box(K.metal, [0.16, 0.74, -0.03], [0.18, 0.78, 0.03]);
  p.cyl(K.paper, [0.215, 0.82, 0], 0.035, 0.26, { seg: 12 });
  p.cyl(K.metal, [0.215, 0.69, 0], 0.037, 0.02, { seg: 12, radiusTop: 0.04 });
  p.collide([-0.17, 0, -0.17], [0.26, 1.49, 0.24]);
}

/**
 * 鉢植え（枯れかけたゴムの木）: 素焼きの鉢（縁の帯）と受け皿・土・幹（2〜3 本）・厚い楕円の葉（垂れた葉・枯れた淡い葉）・床に落ちた葉
 */
export function plant(p: Prop, h = 1.1): void {
  const pot = K.creamD;
  p.lathe(K.sageD, [[0, 0], [0.17, 0], [0.18, 0.022], [0.168, 0.024], [0, 0.012]], [0, 0, 0], { seg: 18 });
  p.lathe(pot, [[0, 0.012], [0.13, 0.012], [0.137, 0.026], [0.178, 0.29], [0.198, 0.296], [0.2, 0.345], [0.186, 0.35], [0.176, 0.33], [0, 0.33]], [0, 0, 0], { seg: 20 });
  p.cyl(K.dark, [0, 0.325, 0], 0.174, 0.008, { seg: 18 });
  const live = ['#8fa595', '#a3b39f', K.sageD];
  const dead = K.creamD;
  const stems = 2 + Math.floor(p.r() * 2);
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + p.r();
    const top: V3 = [Math.cos(a) * 0.1, h * (0.75 + p.r() * 0.25), Math.sin(a) * 0.1];
    p.tube(K.woodD, [[0, 0.33, 0], [top[0] * 0.3, (0.33 + top[1]) / 2, top[2] * 0.3], top], 0.012, { seg: 8, radial: 6 });
    const nl = 7 + Math.floor(p.r() * 4);
    for (let i = 0; i < nl; i++) {
      const t = 0.35 + (i / nl) * 0.65;
      const pos: V3 = [top[0] * t * t, 0.33 + (top[1] - 0.33) * t, top[2] * t * t];
      const yaw = p.r() * Math.PI * 2;
      const droop = i < 2 ? 0.9 + p.r() * 0.6 : 0.15 + p.r() * 0.5;
      const len = 0.17 + p.r() * 0.08;
      const col = i < 2 && p.r() < 0.6 ? dead : live[Math.floor(p.r() * live.length)];
      const lf = p.sub(pos, yaw, { pitch: droop });
      lf.rod(K.woodD, [0, 0, 0], [0, 0, 0.04], 0.004, { radial: 4 });
      lf.ball(col, [0, 0, 0.04 + len / 2], [len * 0.34, 0.012, len / 2], { seg: 10 });
    }
  }
  // 落ちた葉（床・受け皿の上）
  for (let i = 0; i < 2; i++) {
    const a = p.r() * Math.PI * 2;
    p.sub([Math.cos(a) * (0.26 + p.r() * 0.1), 0.004, Math.sin(a) * (0.26 + p.r() * 0.1)], p.r() * 6).ball(dead, [0, 0, 0], [0.05, 0.004, 0.09], { seg: 8 });
  }
  p.collide([-0.2, 0, -0.2], [0.2, h, 0.2]);
}
