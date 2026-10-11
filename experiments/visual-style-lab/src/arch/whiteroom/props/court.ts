import type { Prop } from '../../../props/kit.ts';

/**
 * whiteroom の中庭の小物（正面 +z、床 y = 0。実寸）。色は参考画像から拾った濃い灰緑（ベンチ・扉）と淡い灰緑（コンクリート）。
 * 平らな色面の絵柄なので、模様は描き込まず形の部位で見せる（面取り・板の継ぎ目・脚・取っ手・格子）。
 */

export const PC = {
  /** ベンチの黒に近い灰緑（参考画像 0 #1e2c29・1 #253135・2 #263330） */
  benchDark: '#25332f',
  benchTop: '#34443f',
  benchB: '#27383a',
  benchBTop: '#3a4d4e',
  /** 白い鉄の扉（参考画像 1 #cfdacc）・格子の奥 */
  doorWhite: '#d0dacb',
  doorWhiteShade: '#b9c7bb',
  grille: '#3c5150',
  /** 暗い扉（鉄・板） */
  doorDark: '#2a3c39',
  doorDarkEdge: '#3b4f4a',
  metal: '#4d5f5b',
  concrete: '#c5d4c8',
  concreteDark: '#9fb2a6',
  lampGlass: '#e9efe2',
  glassDark: '#1f2b2c',
  frame: '#dbe4d8',
  grass: '#8a9a6e',
  grassDry: '#a8a77c',
  soil: '#4c4a3e',
};

/** 背なしの長いベンチ（参考画像 0・2）: 厚い板の座面と、板の脚 2 枚・下の貫 */
export function slabBench(p: Prop, w: number, o: { h?: number; legs?: 'slab' | 'post'; dark?: string; top?: string } = {}): void {
  const H = o.h ?? 0.43;
  const d = 0.4;
  const dark = o.dark ?? PC.benchDark;
  const top = o.top ?? PC.benchTop;
  // 座面: 2 枚の厚い板（継ぎ目 1 cm）
  p.box(top, [-w / 2, H - 0.06, -d / 2], [w / 2, H, -0.005], { r: 0.012 });
  p.box(top, [-w / 2, H - 0.06, 0.005], [w / 2, H, d / 2], { r: 0.012 });
  // 座面の下の枠
  p.box(dark, [-w / 2 + 0.05, H - 0.11, -d / 2 + 0.04], [w / 2 - 0.05, H - 0.06, -d / 2 + 0.08], { r: 0.008 });
  p.box(dark, [-w / 2 + 0.05, H - 0.11, d / 2 - 0.08], [w / 2 - 0.05, H - 0.06, d / 2 - 0.04], { r: 0.008 });
  const xs = [-w / 2 + Math.min(0.25, w * 0.12), w / 2 - Math.min(0.25, w * 0.12)];
  for (const x of xs) {
    if ((o.legs ?? 'slab') === 'slab') {
      // 板の脚（下に向かって少し広がる台形）
      p.extrude(dark, [[-d / 2 + 0.03, 0], [d / 2 - 0.03, 0], [d / 2 - 0.06, H - 0.11], [-d / 2 + 0.06, H - 0.11]], 'zy', x - 0.03, x + 0.03, { bevel: 0.006 });
    } else {
      for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) p.box(dark, [x - 0.025, 0, z - 0.025], [x + 0.025, H - 0.11, z + 0.025], { r: 0.006 });
    }
  }
  // 貫（脚をつなぐ細い棒）
  p.box(dark, [xs[0], 0.12, -0.02], [xs[1], 0.16, 0.02], { r: 0.008 });
  p.collide([-w / 2, 0, -d / 2], [w / 2, H, d / 2]);
}

/** 背もたれのある公園のベンチ（参考画像 1）: 鋳物の脇の枠（肘掛け）・座面の板 3 枚・背の板 2 枚 */
export function parkBench(p: Prop, w: number): void {
  const fr = PC.benchB;
  const sl = PC.benchBTop;
  const H = 0.42;
  // 脇の枠（横から見た輪郭: 前脚・後脚・座の受け・背の支え・肘掛け）
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
    p.extrude(
      fr,
      [
        [0.24, 0],
        [0.2, 0],
        [0.17, H - 0.05],
        [-0.16, H - 0.05],
        [-0.2, 0],
        [-0.24, 0],
        [-0.21, H - 0.02],
        [-0.24, 0.64],
        [-0.2, 0.64],
        [-0.17, H],
        [0.2, H],
      ],
      'zy',
      x - 0.025,
      x + 0.025,
      { bevel: 0.006 },
    );
    // 肘掛け
    p.tube(fr, [[x, 0.56, -0.19], [x, 0.58, 0.0], [x, 0.55, 0.15], [x, H, 0.19]], 0.016);
  }
  // 座面の板 3 枚・背の板 2 枚
  for (let i = 0; i < 3; i++) p.box(sl, [-w / 2, H - 0.01, -0.15 + i * 0.12], [w / 2, H + 0.025, -0.06 + i * 0.12], { r: 0.008 });
  for (let i = 0; i < 2; i++) {
    const y = 0.48 + i * 0.09;
    const z = -0.2 - (y - 0.5) * 0.17;
    p.box(sl, [-w / 2 + 0.02, y, z - 0.015], [w / 2 - 0.02, y + 0.09, z + 0.015], { r: 0.008 });
  }
  p.collide([-w / 2, 0, -0.28], [w / 2, 0.64, 0.24]);
}

/** 白い鉄の扉（参考画像 1 の突き当たり）: 枠・扉の板・上の換気の格子（横の羽根）・取っ手。壁の面（z = 0）に付ける */
export function louverDoor(p0: Prop, w: number, h: number): void {
  // 壁の面より手前に出す（壁に穴を空けないので、扉の一番奥が壁の面）
  const p = p0.sub([0, 0, 0.045]);
  const fw = 0.05;
  p.box(PC.doorWhite, [-w / 2 - fw, 0, -0.02], [-w / 2, h + fw, 0.04]);
  p.box(PC.doorWhite, [w / 2, 0, -0.02], [w / 2 + fw, h + fw, 0.04]);
  p.box(PC.doorWhite, [-w / 2, h, -0.02], [w / 2, h + fw, 0.04]);
  // 扉の板（少し奥）
  p.box(PC.doorWhiteShade, [-w / 2, 0, -0.04], [w / 2, h, 0.0]);
  // 上の換気の格子（暗い奥に羽根 7 枚）
  const g0 = h - 0.3;
  p.box(PC.grille, [-w / 2 + 0.06, g0, -0.035], [w / 2 - 0.06, h - 0.06, 0.0]);
  for (let i = 0; i < 7; i++) {
    const y = g0 + 0.02 + i * 0.032;
    p.box(PC.doorWhite, [-w / 2 + 0.06, y, -0.005], [w / 2 - 0.06, y + 0.012, 0.02], { shadow: false });
  }
  // 取っ手（横の棒）と鍵穴の板
  p.box(PC.metal, [w / 2 - 0.16, 1.0, 0.0], [w / 2 - 0.08, 1.16, 0.012], { shadow: false });
  p.rod(PC.metal, [w / 2 - 0.2, 1.08, 0.04], [w / 2 - 0.08, 1.08, 0.04], 0.01, { shadow: false });
}

/** 暗い扉（鉄の扉・板の扉）: 枠・板・取っ手。壁の面（z = 0）に付ける。panels で縦の板の継ぎ目 */
export function darkDoor(p0: Prop, w: number, h: number, o: { panels?: number; color?: string } = {}): void {
  // 壁の面より手前に出す（壁に穴を空けないので、扉の一番奥が壁の面）
  const p = p0.sub([0, 0, 0.032]);
  const c = o.color ?? PC.doorDark;
  const fw = 0.04;
  p.box(PC.doorDarkEdge, [-w / 2 - fw, 0, -0.02], [-w / 2, h + fw, 0.025]);
  p.box(PC.doorDarkEdge, [w / 2, 0, -0.02], [w / 2 + fw, h + fw, 0.025]);
  p.box(PC.doorDarkEdge, [-w / 2, h, -0.02], [w / 2, h + fw, 0.025]);
  p.box(c, [-w / 2, 0, -0.03], [w / 2, h, -0.005]);
  const n = o.panels ?? 0;
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + (w * i) / n;
    p.box(PC.doorDarkEdge, [x - 0.008, 0.05, -0.006], [x + 0.008, h - 0.05, 0.0], { shadow: false });
  }
  p.box(PC.metal, [w / 2 - 0.12, 0.95, -0.005], [w / 2 - 0.07, 1.1, 0.008], { shadow: false });
  p.rod(PC.metal, [w / 2 - 0.15, 1.04, 0.03], [w / 2 - 0.05, 1.04, 0.03], 0.009, { shadow: false });
}

/** 壁の小さな灯り（腕木と丸い笠）。壁の面（z = 0）に付ける */
export function wallLamp(p: Prop): void {
  p.box(PC.metal, [-0.06, -0.09, -0.01], [0.06, 0.09, 0.015], { r: 0.008, shadow: false });
  p.rod(PC.metal, [0, 0, 0.01], [0, 0.03, 0.18], 0.012, { shadow: false });
  p.lathe(PC.metal, [[0, 0.04], [0.07, 0.0], [0.09, -0.05], [0.085, -0.055], [0, -0.01]], [0, 0.04, 0.2], { seg: 14, shadow: false });
  p.ball(PC.lampGlass, [0, -0.02, 0.2], 0.04, { kind: 'glow', shadow: false });
}

/** 壁の配電の箱（参考画像 2 の南の回廊）: 箱・ふたの継ぎ目・下の配管 */
export function elecBox(p: Prop): void {
  p.box('#8fa59b', [-0.2, 1.12, 0], [0.2, 1.38, 0.14], { r: 0.012 });
  p.box('#7c938a', [-0.18, 1.14, 0.14], [0.18, 1.36, 0.15], { shadow: false });
  p.box(PC.metal, [0.12, 1.24, 0.15], [0.15, 1.28, 0.165], { shadow: false });
  p.rod('#7c938a', [0, 1.12, 0.06], [0, 0.0, 0.06], 0.02);
  p.box('#7c938a', [-0.03, 0.0, 0.03], [0.03, 0.04, 0.09], { shadow: false });
}

/** 窓（淡い枠・暗いガラス・桟。bars で縦の格子）。壁の面（z = 0）に付け、奥へ depth 引っ込む */
export function window(p: Prop, w: number, h: number, o: { depth?: number; bars?: number; mullion?: boolean } = {}): void {
  const d = o.depth ?? 0.22;
  const f = 0.05;
  // 抱き（壁の厚みの淡い面）は壁の側が作る。ここは枠・ガラス・窓台
  p.box(PC.frame, [-w / 2, 0, -d], [w / 2, f, -d + 0.06]);
  p.box(PC.frame, [-w / 2, h - f, -d], [w / 2, h, -d + 0.06]);
  p.box(PC.frame, [-w / 2, 0, -d], [-w / 2 + f, h, -d + 0.06]);
  p.box(PC.frame, [w / 2 - f, 0, -d], [w / 2, h, -d + 0.06]);
  p.box(PC.glassDark, [-w / 2 + f, f, -d + 0.01], [w / 2 - f, h - f, -d + 0.02], { shadow: false });
  if (o.mullion ?? w > 0.7) p.box(PC.frame, [-0.02, f, -d + 0.01], [0.02, h - f, -d + 0.05], { shadow: false });
  // 窓台（外へ少し出る）
  p.box(PC.frame, [-w / 2 - 0.04, -0.04, -0.02], [w / 2 + 0.04, 0.0, 0.05], { r: 0.006 });
  for (let i = 1; i <= (o.bars ?? 0); i++) {
    const x = -w / 2 + (w * i) / ((o.bars ?? 0) + 1);
    p.rod(PC.metal, [x, 0.02, -0.06], [x, h - 0.02, -0.06], 0.008, { shadow: false });
  }
}

/** 床の排水の格子（中庭の床に埋める）: 枠・格子の桟 */
export function drain(p: Prop, w: number, d: number): void {
  p.box(PC.concreteDark, [-w / 2, -0.005, -d / 2], [w / 2, 0.006, d / 2], { shadow: false });
  p.box('#26332f', [-w / 2 + 0.03, -0.004, -d / 2 + 0.03], [w / 2 - 0.03, 0.007, d / 2 - 0.03], { shadow: false });
  const n = Math.max(3, Math.round(w / 0.05));
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + 0.03 + ((w - 0.06) * i) / n;
    p.box(PC.metal, [x - 0.006, 0.0, -d / 2 + 0.03], [x + 0.006, 0.009, d / 2 - 0.03], { shadow: false });
  }
}

/** コンクリートの植木鉢（四角・枯れかけた草の株） */
export function planter(p: Prop, w: number, o: { h?: number } = {}): void {
  const H = o.h ?? 0.55;
  const t = 0.07;
  p.box(PC.concrete, [-w / 2, 0, -w / 2], [w / 2, H, -w / 2 + t], { r: 0.01 });
  p.box(PC.concrete, [-w / 2, 0, w / 2 - t], [w / 2, H, w / 2], { r: 0.01 });
  p.box(PC.concrete, [-w / 2, 0, -w / 2], [-w / 2 + t, H, w / 2], { r: 0.01 });
  p.box(PC.concrete, [w / 2 - t, 0, -w / 2], [w / 2, H, w / 2], { r: 0.01 });
  p.box(PC.soil, [-w / 2 + t, 0, -w / 2 + t], [w / 2 - t, H - 0.06, w / 2 - t], { shadow: false });
  // 草の株: 細い葉の束（外へ傾けた細い楕円体）
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + p.r();
    const r = (w / 2 - t) * 0.5 * p.r();
    const len = 0.25 + p.r() * 0.25;
    const c = p.r() < 0.5 ? PC.grassDry : PC.grass;
    const s = p.sub([Math.cos(a) * r, H - 0.06, Math.sin(a) * r], -a + Math.PI / 2, { pitch: -(0.35 + p.r() * 0.6) });
    s.ball(c, [0, 0, len / 2], [0.012, 0.006, len / 2], { seg: 6, shadow: false });
  }
  p.collide([-w / 2, 0, -w / 2], [w / 2, H, w / 2]);
}

/** 石の水槽と蛇口（中庭の隅。洗い場） */
export function trough(p: Prop, w: number): void {
  const H = 0.75;
  const d = 0.55;
  p.box(PC.concrete, [-w / 2, 0, -d / 2], [w / 2, H, d / 2], { r: 0.02 });
  p.box('#5f7a74', [-w / 2 + 0.07, H - 0.25, -d / 2 + 0.07], [w / 2 - 0.07, H + 0.001, d / 2 - 0.07], { shadow: false });
  p.box('#7f9a90', [-w / 2 + 0.07, H - 0.12, -d / 2 + 0.07], [w / 2 - 0.07, H - 0.11, d / 2 - 0.07], { shadow: false });
  // 蛇口（壁から出る管と把手）
  p.bend(PC.metal, [[0, 1.05, -d / 2 - 0.02], [0, 1.05, -d / 2 + 0.12], [0, 0.95, -d / 2 + 0.16]], 0.015, 0.04);
  p.torus(PC.metal, [0, 1.1, -d / 2 + 0.06], 0.035, 0.007, { axis: 'y', shadow: false });
  p.collide([-w / 2, 0, -d / 2], [w / 2, H, d / 2]);
}

/** 積んだ木箱（板の継ぎ目の帯・持ち手の穴） */
export function crateStack(p: Prop, n = 3): void {
  for (let i = 0; i < n; i++) {
    const s = p.sub([i * 0.05 - 0.05, i * 0.42, 0], (p.r() - 0.5) * 0.15);
    s.box('#6d7d72', [-0.4, 0, -0.3], [0.4, 0.4, 0.3], { r: 0.01 });
    s.box('#4a5a52', [-0.41, 0.17, -0.31], [0.41, 0.23, 0.31], { shadow: false });
    s.box('#2f3c38', [-0.12, 0.27, 0.3], [0.12, 0.33, 0.312], { shadow: false });
    s.box('#2f3c38', [-0.12, 0.27, -0.312], [0.12, 0.33, -0.3], { shadow: false });
  }
  p.collide([-0.45, 0, -0.32], [0.5, n * 0.42, 0.32]);
}

/** 手押し車（荷台・車輪・2 本の柄・脚） */
export function wheelbarrow(p: Prop): void {
  p.extrude('#59696a', [[-0.35, 0.25], [0.35, 0.25], [0.45, 0.6], [-0.45, 0.6]], 'zy', -0.3, 0.3, { bevel: 0.01 });
  p.box('#3e4d4a', [-0.28, 0.5, -0.24], [0.28, 0.6, 0.24], { shadow: false });
  p.torus('#2b3637', [0, 0.18, 0.55], 0.17, 0.04, { axis: 'x' });
  p.cyl('#59696a', [0, 0.18, 0.55], 0.03, 0.12, { axis: 'x', shadow: false });
  for (const x of [-0.2, 0.2]) {
    p.rod('#4d5f5b', [x, 0.3, 0.45], [x * 1.2, 0.75, -0.95], 0.015);
    p.rod('#4d5f5b', [x, 0.28, -0.2], [x, 0.0, -0.3], 0.013);
  }
  p.collide([-0.45, 0, -1.0], [0.45, 0.75, 0.75]);
}

/** ほうきと金属のバケツ（壁に立て掛け） */
export function bucketBroom(p: Prop): void {
  p.lathe('#59696a', [[0, 0], [0.13, 0], [0.16, 0.3], [0.17, 0.31], [0.15, 0.31], [0.14, 0.02], [0, 0.02]], [0.3, 0, 0], { seg: 14 });
  p.torus('#4d5f5b', [0.3, 0.33, 0], 0.15, 0.006, { axis: 'z', arc: Math.PI, shadow: false });
  p.rod('#6d7d72', [-0.2, 0.12, 0.0], [-0.25, 1.35, -0.1], 0.013);
  p.extrude('#8a978b', [[-0.11, 0], [0.11, 0], [0.06, 0.2], [-0.06, 0.2]], 'xy', -0.03, 0.03, { bevel: 0.006 });
  p.collide([-0.35, 0, -0.2], [0.5, 1.3, 0.2]);
}

/** 屋上の点検口（打ち放しの立ち上がり・鋼のふた・蝶番・取っ手） */
export function roofHatch(p: Prop, w = 0.9): void {
  const H = 0.4;
  const t = 0.12;
  p.box(PC.concrete, [-w / 2 - t, 0, -w / 2 - t], [w / 2 + t, H, w / 2 + t], { r: 0.015 });
  // 鋼のふた（縁が少し出る）と補強の筋・蝶番・取っ手
  p.box(PC.metal, [-w / 2 - t - 0.03, H, -w / 2 - t - 0.03], [w / 2 + t + 0.03, H + 0.04, w / 2 + t + 0.03], { r: 0.006 });
  for (const x of [-w / 4, w / 4]) p.box(PC.metal, [x - 0.02, H + 0.04, -w / 2], [x + 0.02, H + 0.06, w / 2], { shadow: false });
  for (const x of [-w / 3, w / 3]) p.box(PC.doorDarkEdge, [x - 0.06, H - 0.02, -w / 2 - t - 0.05], [x + 0.06, H + 0.05, -w / 2 - t - 0.02], { shadow: false });
  p.bend(PC.metal, [[-0.12, H + 0.04, w / 2 + t - 0.02], [-0.12, H + 0.1, w / 2 + t - 0.02], [0.12, H + 0.1, w / 2 + t - 0.02], [0.12, H + 0.04, w / 2 + t - 0.02]], 0.01, 0.03, { shadow: false });
  p.collide([-w / 2 - t, 0, -w / 2 - t], [w / 2 + t, H + 0.05, w / 2 + t]);
}

/** 屋上の通気管（足元の座・管・きのこ形の笠） */
export function ventPipe(p: Prop, h = 0.75): void {
  p.cyl(PC.concrete, [0, 0.05, 0], 0.13, 0.1, { seg: 12 });
  p.cyl(PC.metal, [0, h / 2, 0], 0.055, h, { seg: 12 });
  p.lathe(PC.metal, [[0, h + 0.12], [0.14, h + 0.04], [0.15, h + 0.02], [0.06, h + 0.03], [0, h + 0.03]], [0, 0, 0], { seg: 14 });
  p.collide([-0.13, 0, -0.13], [0.13, h + 0.12, 0.13]);
}

/** 屋上の排水口（四角い座・丸い鋳物の格子・まわりの水の跡） */
export function roofDrain(p: Prop, wet: string): void {
  p.box(wet, [-0.55, -0.004, -0.45], [0.55, 0.004, 0.45], { shadow: false });
  p.box(PC.concreteDark, [-0.2, 0.0, -0.2], [0.2, 0.012, 0.2], { shadow: false });
  p.cyl('#26332f', [0, 0.012, 0], 0.13, 0.008, { seg: 18, shadow: false });
  for (let i = -2; i <= 2; i++) p.box(PC.metal, [-0.12, 0.014, i * 0.045 - 0.008], [0.12, 0.02, i * 0.045 + 0.008], { shadow: false });
}

/** 竪樋（上の集水器・管・つかみ金物・下の曲がりと受け）。壁の面（z = 0）に付け、高さ h0（下）〜 h1（上） */
export function downpipe(p: Prop, h0: number, h1: number, col = '#7c938a'): void {
  const z = 0.09;
  // 集水器（上が広い台形の箱。h1 の高さに上の縁）
  p.extrude(col, [[-0.14, h1], [0.14, h1], [0.09, h1 - 0.22], [-0.09, h1 - 0.22]], 'xy', 0.0, 0.18, { bevel: 0.008 });
  p.rod(col, [0, h1 - 0.22, z], [0, h0 + 0.2, z], 0.045);
  p.bend(col, [[0, h0 + 0.25, z], [0, h0 + 0.08, z], [0, h0 + 0.05, z + 0.18]], 0.045, 0.08);
  const n = Math.max(2, Math.floor((h1 - h0) / 1.6));
  for (let i = 1; i <= n; i++) {
    const y = h0 + ((h1 - h0) * i) / (n + 1);
    p.box(PC.metal, [-0.06, y - 0.015, 0.0], [0.06, y + 0.015, z + 0.05], { shadow: false });
  }
}

/** 水の吐き口（屋根・テラスの縁から突き出る U 字の樋）。壁の面（z = 0）、高さ y */
export function spout(p: Prop, y: number, len = 0.45): void {
  p.box(PC.concreteDark, [-0.09, y - 0.08, 0], [-0.06, y + 0.04, len], { shadow: false });
  p.box(PC.concreteDark, [0.06, y - 0.08, 0], [0.09, y + 0.04, len], { shadow: false });
  p.box(PC.concreteDark, [-0.09, y - 0.1, 0], [0.09, y - 0.07, len], {});
}
