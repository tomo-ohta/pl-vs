import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop, V2 } from '../../../props/kit.ts';
import { bottle } from '../../../props/lib/index.ts';
import { BOTTLES, K, SPINES } from './mats.ts';

/**
 * 受付・薬局・医局・診察室の家具と机の上の物（昭和の町の診療所）。局所の座標: 足元の真ん中が原点・正面 +z・背 -z。
 * 実寸: 事務机（高さ 0.72 m・片袖の引き出し 3 段）・回転椅子・丸椅子（座 0.47 m）・木の椅子・薬の引き出しの棚（升 0.22 × 0.15 m）・
 * 調剤台（0.85 m）と上皿天秤・乳鉢・金庫（0.6 × 0.75 m）・引き戸の低い棚・黒電話・応接のソファと机・本棚・コート掛けと白衣・屑かご。
 */

const ROUND = { seg: 1 } as const;

/** 本（立てた 1 冊）: 表紙の箱・上から見える小口（紙の色）・背の帯。原点は底の真ん中、背が +z */
export function book(p: Prop, t: number, h: number, d: number, col: string): void {
  p.box(col, [-t / 2, 0, -d / 2], [t / 2, h, d / 2], { r: 0.002 });
  p.box(K.paper, [-t / 2 + 0.003, h - 0.003, -d / 2 - 0.001], [t / 2 - 0.003, h + 0.0008, d / 2 - 0.006]);
  if (t > 0.022) p.box(K.paper, [-t / 2 + 0.004, h * 0.72, d / 2], [t / 2 - 0.004, h * 0.8, d / 2 + 0.0015]);
}

/** 本の並び（棚板 1 段・机の上）。局所: 棚板の上面の手前寄りの中心が原点。背を手前にそろえ、ときどき倒れた本・横に積んだ本 */
export function bookRow(p: Prop, w: number, d: number, clear: number, cols = SPINES): void {
  let x = -w / 2;
  while (x < w / 2 - 0.03) {
    const r = p.r();
    if (r < 0.08) {
      x += 0.06 + p.r() * 0.1;
      continue;
    }
    if (r < 0.16 && w / 2 - x > 0.24) {
      // 横に積んだ本
      const n = 2 + Math.floor(p.r() * 3);
      let y = 0;
      for (let k = 0; k < n && y < clear - 0.05; k++) {
        const t = 0.025 + p.r() * 0.02;
        const s = p.sub([x + 0.11, y, d / 2 - 0.1], (p.r() - 0.5) * 0.12, { roll: Math.PI / 2 });
        book(s.sub([-t / 2, -0.1, 0]), t, 0.2 + p.r() * 0.02, 0.15 + p.r() * 0.03, cols[Math.floor(p.r() * cols.length)]);
        y += t;
      }
      x += 0.24;
      continue;
    }
    const t = 0.018 + p.r() * 0.035;
    const h = Math.min(clear - 0.02, 0.18 + p.r() * 0.12);
    const dd = Math.min(d, 0.14 + p.r() * 0.08);
    const lean = r > 0.94 ? 0.35 : 0;
    book(p.sub([x + t / 2 + (lean ? h * 0.3 : 0), 0, d / 2 - dd / 2 - p.r() * 0.01], 0, { roll: -lean }), t, h, dd, cols[Math.floor(p.r() * cols.length)]);
    x += t + 0.002 + (lean ? h * 0.35 : 0);
  }
}

/**
 * 事務机（鋼の片袖机）: 天板（角の丸い淡い木）・右の袖（3 段の引き出し・取っ手の棒・名札の枠）・左の側板（板脚）・幕板・
 * 天板の下の中引き出し・引っ込んだ台輪。drawers: false で 4 本脚の机（窓口の台・給湯室の机）
 */
export function desk(p: Prop, w: number, dp: number, o: { drawers?: boolean; h?: number; top?: string } = {}): void {
  const h = o.h ?? 0.72;
  const top = o.top ?? K.wood;
  const body = K.pale;
  const handle = K.metal;
  p.box(top, [-w / 2, h - 0.03, -dp / 2], [w / 2, h, dp / 2], { r: 0.008, ...ROUND });
  if (o.drawers !== false) {
    const pw = Math.min(0.4, w * 0.36);
    const x0 = w / 2 - pw - 0.01;
    const x1 = w / 2 - 0.01;
    p.box(body, [x0, 0.06, -dp / 2 + 0.02], [x1, h - 0.03, dp / 2 - 0.012], { r: 0.005, ...ROUND });
    p.box(K.sageD, [x0 + 0.02, 0, -dp / 2 + 0.04], [x1 - 0.02, 0.06, dp / 2 - 0.05]);
    const cx = (x0 + x1) / 2;
    const ys: [number, number][] = [[0.075, 0.3], [0.3, 0.5], [0.5, h - 0.04]];
    for (const [y0, y1] of ys) {
      p.box(body, [x0 + 0.01, y0 + 0.005, dp / 2 - 0.014], [x1 - 0.01, y1 - 0.005, dp / 2 + 0.006], { r: 0.004, ...ROUND });
      p.box(handle, [cx - 0.07, y1 - 0.05, dp / 2 + 0.006], [cx + 0.07, y1 - 0.034, dp / 2 + 0.02], { r: 0.005, ...ROUND });
      p.box(K.paper, [cx - 0.03, y1 - 0.085, dp / 2 + 0.006], [cx + 0.03, y1 - 0.064, dp / 2 + 0.008]);
    }
    p.box(body, [-w / 2 + 0.012, 0, -dp / 2 + 0.02], [-w / 2 + 0.036, h - 0.03, dp / 2 - 0.03], { r: 0.004, ...ROUND });
    p.box(body, [-w / 2 + 0.036, 0.26, -dp / 2 + 0.02], [x0, h - 0.03, -dp / 2 + 0.034]);
    p.box(body, [-w / 2 + 0.04, h - 0.1, -dp / 2 + 0.04], [x0 - 0.005, h - 0.03, dp / 2 - 0.012], { r: 0.004, ...ROUND });
    const mx = (-w / 2 + x0) / 2;
    p.box(handle, [mx - 0.08, h - 0.075, dp / 2 - 0.012], [mx + 0.08, h - 0.06, dp / 2 + 0.002], { r: 0.005, ...ROUND });
  } else {
    const leg = K.metal;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) p.box(leg, [sx * (w / 2 - 0.04) - 0.018, 0, sz * (dp / 2 - 0.04) - 0.018], [sx * (w / 2 - 0.04) + 0.018, h - 0.03, sz * (dp / 2 - 0.04) + 0.018], { r: 0.004, ...ROUND });
    for (const sz of [-1, 1]) p.box(leg, [-w / 2 + 0.04, h - 0.1, sz * (dp / 2 - 0.04) - 0.008], [w / 2 - 0.04, h - 0.03, sz * (dp / 2 - 0.04) + 0.008]);
    for (const sx of [-1, 1]) p.box(leg, [sx * (w / 2 - 0.04) - 0.008, h - 0.1, -dp / 2 + 0.04], [sx * (w / 2 - 0.04) + 0.008, h - 0.03, dp / 2 - 0.04]);
  }
  p.collide([-w / 2, 0, -dp / 2], [w / 2, h, dp / 2]);
}

/** 電気スタンド（鉄の首の曲がる型）: 丸い台・曲がった首・笠（中は暗く）。原点は台の下 */
export function deskLamp(p: Prop): void {
  const c = K.sageD;
  p.lathe(c, [[0, 0], [0.075, 0], [0.078, 0.012], [0.06, 0.026], [0.016, 0.032], [0, 0.032]], [0, 0, 0], { seg: 16 });
  p.tube(c, [[0, 0.03, 0], [0, 0.24, 0], [0.025, 0.36, 0], [0.11, 0.41, 0], [0.17, 0.39, 0]], 0.008, { seg: 18, radial: 6 });
  const s = p.sub([0.2, 0.33, 0]);
  s.lathe(c, [[0.012, 0.06], [0.03, 0.055], [0.075, 0.0], [0.072, -0.004], [0.026, 0.046], [0.01, 0.052]], [0, 0, 0], { seg: 16 });
  s.cyl(K.paper, [0, 0.035, 0], 0.02, 0.03, { seg: 10 });
}

/** 机の上の物（書類の束・下敷き・本立てと本・ペン立て・電気スタンド・印箱・カルテ・黒電話）。原点は天板の上面の真ん中 */
export function deskTop(p: Prop, w: number, dp: number, o: { lamp?: boolean; chart?: boolean; phone?: boolean } = {}): void {
  // 下敷き（手前の真ん中）
  p.box(K.sage, [-0.26, 0, -0.08], [0.26, 0.004, dp / 2 - 0.05]);
  // 書類の束（左）: 紙を少しずつずらして重ねる・上にクリップの板
  const st = p.sub([-w / 2 + 0.24, 0, -0.02], (p.r() - 0.5) * 0.2);
  const n = 3 + Math.floor(p.r() * 4);
  for (let i = 0; i < n; i++) st.sub([(p.r() - 0.5) * 0.015, i * 0.006, (p.r() - 0.5) * 0.015], (p.r() - 0.5) * 0.06).box(i % 3 === 2 ? '#e5ece0' : K.paper, [-0.105, 0, -0.148], [0.105, 0.006, 0.148]);
  if (p.r() < 0.6) {
    const cb = st.sub([0.02, n * 0.006, 0.01], (p.r() - 0.5) * 0.3);
    cb.box(K.woodD, [-0.115, 0, -0.16], [0.115, 0.005, 0.16], { r: 0.002 });
    cb.box(K.paper, [-0.1, 0.005, -0.13], [0.1, 0.007, 0.15]);
    cb.box(K.metal, [-0.04, 0.005, -0.165], [0.04, 0.016, -0.13], { r: 0.004 });
  }
  // カルテ（開いた 2 つ折りの紙ばさみ）
  if (o.chart) {
    const c = p.sub([0.02, 0.004, 0.03], (p.r() - 0.5) * 0.2);
    c.box(K.cream, [-0.25, 0, -0.17], [0.25, 0.004, 0.17]);
    for (const s of [-1, 1]) c.box(K.paper, [s < 0 ? -0.235 : 0.01, 0.004, -0.155], [s < 0 ? -0.01 : 0.235, 0.006, 0.155]);
    for (let i = 0; i < 5; i++) c.box(K.sage, [0.03, 0.006, 0.1 - i * 0.04], [0.03 + 0.08 + p.r() * 0.1, 0.007, 0.106 - i * 0.04]);
  }
  // 本立てと本（奥の右）
  const bx = w / 2 - 0.36;
  const bz = -dp / 2 + 0.13;
  for (const x of [bx - 0.02, bx + 0.3]) {
    p.box(K.metal, [x - 0.002, 0, bz - 0.08], [x + 0.002, 0.15, bz + 0.08]);
    p.box(K.metal, [x - 0.06, 0, bz - 0.08], [x + 0.06, 0.003, bz + 0.08]);
  }
  bookRow(p.sub([bx + 0.14, 0.003, bz - 0.08]), 0.28, 0.16, 0.3);
  // ペン立て（筒と斜めのペン・鉛筆）
  const pc = p.sub([-w / 2 + 0.55, 0, -dp / 2 + 0.12]);
  pc.lathe(K.sageD, [[0, 0], [0.033, 0], [0.035, 0.1], [0.031, 0.1], [0.029, 0.01], [0, 0.01]], [0, 0, 0], { seg: 12 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + p.r();
    pc.rod(i === 0 ? K.ink : i === 1 ? K.greyBlue : K.creamD, [Math.cos(a) * 0.01, 0.01, Math.sin(a) * 0.01], [Math.cos(a) * 0.045, 0.17 + p.r() * 0.03, Math.sin(a) * 0.045], 0.004, { radial: 5 });
  }
  // 印箱（暗い小箱）と朱肉
  p.box(K.darker, [-0.36, 0, -dp / 2 + 0.06], [-0.27, 0.035, -dp / 2 + 0.12], { r: 0.004, ...ROUND });
  p.cyl(K.dark, [-0.21, 0.01, -dp / 2 + 0.09], 0.03, 0.02, { seg: 12 });
  if (o.lamp !== false) deskLamp(p.sub([-w / 2 + 0.12, 0, -dp / 2 + 0.1], -0.25));
  if (o.phone) deskPhone(p.sub([w / 2 - 0.2, 0, 0.06], -0.35));
}

/** 回転椅子（4 本脚の台とキャスター・軸・張りの座・曲げた鉄の背の支え・背もたれ） */
export function swivelChair(p: Prop, seat = K.darker): void {
  const fr = K.metal;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const ex = Math.cos(a) * 0.28;
    const ez = Math.sin(a) * 0.28;
    p.rod(fr, [0, 0.13, 0], [ex, 0.075, ez], 0.016, { radial: 6 });
    p.box(fr, [ex - 0.012, 0.045, ez - 0.012], [ex + 0.012, 0.085, ez + 0.012]);
    p.cyl(K.ink, [ex, 0.03, ez], 0.03, 0.022, { axis: 'x', seg: 10 });
  }
  p.cyl(K.ink, [0, 0.14, 0], 0.045, 0.05, { seg: 12 });
  p.cyl(fr, [0, 0.29, 0], 0.026, 0.28, { seg: 10 });
  p.box(fr, [-0.16, 0.415, -0.16], [0.16, 0.43, 0.16]);
  p.box(seat, [-0.22, 0.43, -0.21], [0.22, 0.5, 0.22], { r: 0.03 });
  p.tube(fr, [[0, 0.43, -0.12], [0, 0.44, -0.24], [0, 0.56, -0.27], [0, 0.66, -0.27]], 0.014, { seg: 10, radial: 6 });
  p.sub([0, 0.62, -0.27], 0, { pitch: -0.1 }).box(seat, [-0.2, 0, -0.03], [0.2, 0.28, 0.025], { r: 0.024 });
  // 当たり判定は座と背（脚の台は低いので足で越える高さ）
  p.collide([-0.23, 0, -0.3], [0.23, 0.92, 0.23]);
}

/** 丸椅子（患者の椅子）: 丸い張りの座・座の受け・広がった 4 本の脚・足掛けの輪・脚の先のゴム */
export function stool(p: Prop, top = K.cushion): void {
  const fr = K.steel;
  p.lathe(top, [[0, 0], [0.16, 0], [0.172, 0.012], [0.175, 0.04], [0.162, 0.058], [0, 0.06]], [0, 0.44, 0], { seg: 20 });
  p.cyl(fr, [0, 0.43, 0], 0.13, 0.02, { seg: 16 });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    p.rod(fr, [Math.cos(a) * 0.1, 0.43, Math.sin(a) * 0.1], [Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2], 0.011, { radial: 6 });
    p.cyl(K.ink, [Math.cos(a) * 0.2, 0.012, Math.sin(a) * 0.2], 0.016, 0.024, { seg: 8 });
  }
  p.torus(fr, [0, 0.16, 0], 0.168, 0.008, { axis: 'y', seg: 22 });
  p.collide([-0.18, 0, -0.18], [0.18, 0.5, 0.18]);
}

/** 木の椅子: 4 本の脚と貫・座板・後ろの脚から続く背の柱・2 本の背板と笠木 */
export function woodChair(p: Prop, seat = K.wood): void {
  const wd = K.woodD;
  for (const sx of [-1, 1]) {
    p.tube(wd, [[sx * 0.18, 0, -0.17], [sx * 0.18, 0.44, -0.17], [sx * 0.175, 0.86, -0.22]], 0.015, { sharp: true });
    p.rod(wd, [sx * 0.18, 0, 0.17], [sx * 0.18, 0.44, 0.17], 0.016, { radial: 8 });
    p.rod(wd, [sx * 0.18, 0.14, -0.17], [sx * 0.18, 0.14, 0.17], 0.008, { radial: 6 });
  }
  p.rod(wd, [-0.18, 0.2, 0.17], [0.18, 0.2, 0.17], 0.008, { radial: 6 });
  p.rod(wd, [-0.18, 0.2, -0.17], [0.18, 0.2, -0.17], 0.008, { radial: 6 });
  p.box(seat, [-0.21, 0.44, -0.2], [0.21, 0.47, 0.21], { r: 0.012, ...ROUND });
  for (const [y, hh] of [[0.6, 0.05], [0.71, 0.05], [0.83, 0.06]] as const) {
    const z = -0.17 - (y - 0.44) * 0.12;
    p.sub([0, y, z], 0, { pitch: -0.12 }).box(y > 0.8 ? seat : wd, [-0.18, 0, -0.012], [0.18, hh, 0.012], { r: 0.008, ...ROUND });
  }
  p.collide([-0.22, 0, -0.24], [0.22, 0.9, 0.22]);
}

/** 薬の引き出しの棚（木の薬箪笥）: 天板・側板・台輪・引き出しの升（隙間の暗い枠）・つまみ・名札の枠・少し引き出したままの引き出し */
export function drawerCabinet(p: Prop, w: number, h: number, dp = 0.42): void {
  const wd = K.wood;
  const wdD = K.woodD;
  const base = 0.08;
  p.box(wdD, [-w / 2 + 0.02, base, -dp / 2], [w / 2 - 0.02, h, dp / 2 - 0.012]);
  for (const s of [-1, 1]) p.box(wd, [s < 0 ? -w / 2 : w / 2 - 0.025, 0, -dp / 2], [s < 0 ? -w / 2 + 0.025 : w / 2, h, dp / 2], { r: 0.004, ...ROUND });
  p.box(wd, [-w / 2 - 0.015, h, -dp / 2 - 0.008], [w / 2 + 0.015, h + 0.035, dp / 2 + 0.02], { r: 0.008, ...ROUND });
  p.box(wdD, [-w / 2 + 0.025, 0, -dp / 2 + 0.02], [w / 2 - 0.025, base, dp / 2 - 0.03]);
  p.box(wd, [-w / 2 + 0.025, base, -dp / 2], [w / 2 - 0.025, base + 0.025, dp / 2]);
  const rows = Math.max(2, Math.round((h - base - 0.03) / 0.15));
  const cols = Math.max(2, Math.round((w - 0.05) / 0.22));
  const y0 = base + 0.025;
  const ch = (h - y0) / rows;
  const cw = (w - 0.05) / cols;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = -w / 2 + 0.025 + cw * j + 0.004;
      const b = a + cw - 0.008;
      const c = y0 + ch * i + 0.004;
      const d = c + ch - 0.008;
      const out = p.r() < 0.05 ? 0.04 + p.r() * 0.14 : 0;
      p.box(wd, [a, c, dp / 2 - 0.02 - out * 0.5], [b, d, dp / 2 + out], { r: 0.003, ...ROUND });
      const cx = (a + b) / 2;
      p.cyl(K.ink, [cx, (c + d) / 2 - 0.012, dp / 2 + out + 0.008], 0.011, 0.016, { axis: 'z', seg: 8 });
      p.box(K.paper, [cx - 0.045, d - 0.042, dp / 2 + out], [cx + 0.045, d - 0.016, dp / 2 + out + 0.002]);
    }
  p.collide([-w / 2 - 0.015, 0, -dp / 2], [w / 2 + 0.015, h + 0.035, dp / 2 + 0.02]);
}

/** 上皿天秤: 台・2 本の柱と皿・真ん中の針と目盛りの板・分銅の箱。原点は台の下 */
export function balance(p: Prop): void {
  const m = K.steel;
  p.box(K.enamel, [-0.16, 0, -0.055], [0.16, 0.04, 0.055], { r: 0.01, ...ROUND });
  p.box(m, [-0.13, 0.04, -0.012], [0.13, 0.06, 0.012], { r: 0.006, ...ROUND });
  for (const s of [-1, 1]) {
    p.cyl(m, [s * 0.11, 0.075, 0], 0.008, 0.03, { seg: 8 });
    p.lathe(m, [[0, 0], [0.05, 0.002], [0.066, 0.012], [0.062, 0.014], [0.048, 0.006], [0, 0.004]], [s * 0.11, 0.09, 0], { seg: 18 });
  }
  p.box(K.paper, [-0.025, 0.06, 0.012], [0.025, 0.12, 0.016]);
  p.rod(K.ink, [0, 0.06, 0.018], [0, 0.115, 0.018], 0.002, { radial: 4 });
  p.box(K.woodD, [0.18, 0, -0.04], [0.28, 0.035, 0.04], { r: 0.004, ...ROUND });
  for (let i = 0; i < 4; i++) p.cyl(K.creamD, [0.2 + i * 0.022, 0.04, 0], 0.006 + i * 0.001, 0.012 + i * 0.004, { seg: 8 });
}

/** 乳鉢と乳棒（陶器）: 外と内の輪郭を 1 つの回転体で（内側のくぼみが見える） */
export function mortar(p: Prop): void {
  p.lathe(K.white, [[0, 0], [0.045, 0], [0.068, 0.03], [0.075, 0.058], [0.07, 0.064], [0.06, 0.06], [0.05, 0.035], [0.02, 0.018], [0, 0.016]], [0, 0, 0], { seg: 20 });
  p.rod(K.white, [0.01, 0.025, 0], [0.07, 0.15, 0.03], 0.011, { radial: 8 });
  p.ball(K.white, [0.01, 0.025, 0], 0.016, { seg: 8 });
}

/** 調剤台: 天板・前の小引き出しの列・下の棚・4 本脚・奥の棚。上に天秤・乳鉢・薬包紙の束と包んだ薬・瓶・メスシリンダー */
export function dispensingTable(p: Prop, w = 1.6, dp = 0.75): void {
  const body = K.enamel;
  const H = 0.85;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(body, [sx * (w / 2 - 0.04) - 0.025, 0, sz * (dp / 2 - 0.04) - 0.025], [sx * (w / 2 - 0.04) + 0.025, H - 0.03, sz * (dp / 2 - 0.04) + 0.025], { r: 0.005, ...ROUND });
  p.box(K.pale, [-w / 2 - 0.02, H - 0.03, -dp / 2 - 0.02], [w / 2 + 0.02, H, dp / 2 + 0.02], { r: 0.01, ...ROUND });
  p.box(body, [-w / 2 + 0.02, H - 0.17, -dp / 2 + 0.02], [w / 2 - 0.02, H - 0.03, dp / 2 - 0.02]);
  const nd = 5;
  for (let i = 0; i < nd; i++) {
    const a = -w / 2 + 0.04 + ((w - 0.08) * i) / nd + 0.006;
    const b = a + (w - 0.08) / nd - 0.012;
    p.box(body, [a, H - 0.16, dp / 2 - 0.022], [b, H - 0.045, dp / 2 - 0.006], { r: 0.004, ...ROUND });
    p.cyl(K.ink, [(a + b) / 2, H - 0.1, dp / 2], 0.01, 0.014, { axis: 'z', seg: 8 });
  }
  p.box(body, [-w / 2 + 0.02, 0.14, -dp / 2 + 0.02], [w / 2 - 0.02, 0.16, dp / 2 - 0.02]);
  // 下の棚の箱と瓶
  for (let i = 0; i < 3; i++) storeBox(p.sub([-0.5 + i * 0.36, 0.16, 0]), 0.3, 0.16 + p.r() * 0.06, 0.3);
  // 奥の棚（低い 2 段）
  const sy = H + 0.22;
  for (const s of [-1, 1]) p.box(body, [s * (w / 2 - 0.03) - 0.015, H, -dp / 2], [s * (w / 2 - 0.03) + 0.015, sy + 0.02, -dp / 2 + 0.16]);
  p.box(body, [-w / 2 + 0.02, sy, -dp / 2], [w / 2 - 0.02, sy + 0.02, -dp / 2 + 0.16], { r: 0.004, ...ROUND });
  p.box(K.pale, [-w / 2 + 0.03, H, -dp / 2], [w / 2 - 0.03, sy, -dp / 2 + 0.01]);
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.12 + i * 0.16;
    bottle(p.sub([x, sy + 0.02, -dp / 2 + 0.08]), 0.032, 0.13 + p.r() * 0.06, BOTTLES[Math.floor(p.r() * BOTTLES.length)]);
  }
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + 0.14 + i * 0.2;
    if (p.r() < 0.3) continue;
    bottle(p.sub([x, H, -dp / 2 + 0.08]), 0.03 + p.r() * 0.012, 0.12 + p.r() * 0.06, BOTTLES[Math.floor(p.r() * BOTTLES.length)]);
  }
  // 天板の上
  balance(p.sub([-0.45, H, 0.05]));
  mortar(p.sub([0.08, H, 0.08]));
  const pk = p.sub([0.36, H, 0.06], 0.15);
  for (let i = 0; i < 6; i++) pk.sub([0, i * 0.003, 0], (p.r() - 0.5) * 0.2).box(K.white, [-0.065, 0, -0.065], [0.065, 0.003, 0.065]);
  for (let i = 0; i < 5; i++) p.sub([0.55 + (p.r() - 0.5) * 0.1, H, -0.02 + i * 0.06], p.r() * 3).box(K.white, [-0.03, 0, -0.022], [0.03, 0.008, 0.022], { r: 0.002 });
  p.lathe(K.glassTint, [[0, 0], [0.03, 0], [0.03, 0.006], [0.016, 0.01], [0.016, 0.21], [0.022, 0.22], [0, 0.22]], [0.24, H, -0.16], { seg: 12 });
  p.collide([-w / 2 - 0.02, 0, -dp / 2 - 0.02], [w / 2 + 0.02, H, dp / 2 + 0.02]);
}

/** 物品の箱（白い紙の箱: ふたの縁・前のラベルと色の帯） */
export function storeBox(p: Prop, w: number, h: number, d: number, col = K.paper, band?: string): void {
  p.box(col, [-w / 2, 0, -d / 2], [w / 2, h - 0.012, d / 2], { r: 0.003 });
  p.box(col, [-w / 2 - 0.004, h - 0.025, -d / 2 - 0.004], [w / 2 + 0.004, h, d / 2 + 0.004], { r: 0.003 });
  p.box(band ?? SPINES[Math.floor(p.r() * SPINES.length)], [-w / 2, h * 0.55, d / 2], [w / 2, h * 0.55 + 0.02, d / 2 + 0.002]);
  p.box(K.white, [-w * 0.3, h * 0.18, d / 2], [w * 0.3, h * 0.45, d / 2 + 0.002]);
}

/** 金庫: 台輪とキャスター・角の丸い胴・一段出た扉・ダイヤル（回転体）と目盛りの輪・T 字の取っ手・鍵穴の板・蝶番・名の札・上の敷き布 */
export function safe(p: Prop): void {
  const body = K.darker;
  const face = K.dark;
  const m = K.steel;
  p.box(K.ink, [-0.27, 0, -0.25], [0.27, 0.06, 0.25]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(K.ink, [sx * 0.22, 0.03, sz * 0.2], 0.03, 0.025, { axis: 'x', seg: 10 });
  p.box(body, [-0.3, 0.05, -0.28], [0.3, 0.78, 0.28], { r: 0.03 });
  p.box(face, [-0.25, 0.1, 0.27], [0.25, 0.73, 0.294], { r: 0.012, ...ROUND });
  p.lathe(m, [[0, 0], [0.052, 0], [0.054, 0.008], [0.046, 0.022], [0.02, 0.028], [0, 0.028]], [0, 0.52, 0.294], { axis: 'z', seg: 20 });
  p.torus(K.paper, [0, 0.52, 0.296], 0.064, 0.004, { axis: 'z', seg: 24 });
  p.rod(m, [0.14, 0.38, 0.294], [0.14, 0.38, 0.33], 0.01, { radial: 8 });
  p.rod(m, [0.08, 0.38, 0.33], [0.2, 0.38, 0.33], 0.012, { radial: 8 });
  for (const x of [0.08, 0.2]) p.ball(m, [x, 0.38, 0.33], 0.016, { seg: 8 });
  p.box(m, [-0.025, 0.31, 0.294], [0.025, 0.4, 0.3], { r: 0.006, ...ROUND });
  p.box(K.ink, [-0.005, 0.34, 0.3], [0.005, 0.375, 0.302]);
  for (const y of [0.2, 0.62]) p.cyl(K.ink, [-0.255, y, 0.29], 0.012, 0.08, { seg: 8 });
  p.box(K.creamD, [-0.1, 0.65, 0.294], [0.1, 0.69, 0.299], { r: 0.003 });
  p.box(K.paper, [-0.26, 0.78, -0.24], [0.26, 0.783, 0.24]);
  p.lathe(K.enamel, [[0, 0], [0.04, 0], [0.05, 0.05], [0.035, 0.14], [0.02, 0.16], [0.024, 0.18], [0, 0.18]], [0.15, 0.783, -0.05], { seg: 14 });
  p.collide([-0.3, 0, -0.28], [0.3, 0.8, 0.33]);
}

/** 引き戸の低い棚（書類入れ）: 台輪・胴・天板・2 枚の引き戸（前後にずれる）・引き手のくぼみ・上のレール。上に書類の箱とファイル */
export function lowCabinet(p: Prop, w: number, h = 0.85, dp = 0.45, col = K.pale): void {
  p.box(K.sageD, [-w / 2 + 0.02, 0, -dp / 2 + 0.02], [w / 2 - 0.02, 0.06, dp / 2 - 0.04]);
  p.box(col, [-w / 2, 0.06, -dp / 2], [w / 2, h, dp / 2 - 0.02], { r: 0.005, ...ROUND });
  p.box(col, [-w / 2 - 0.012, h, -dp / 2 - 0.005], [w / 2 + 0.012, h + 0.025, dp / 2 + 0.015], { r: 0.006, ...ROUND });
  p.box(K.creamD, [-w / 2 + 0.015, 0.07, dp / 2 - 0.02], [w / 2 - 0.015, 0.085, dp / 2 + 0.012]);
  p.box(K.creamD, [-w / 2 + 0.015, h - 0.03, dp / 2 - 0.02], [w / 2 - 0.015, h - 0.015, dp / 2 + 0.012]);
  for (const [a, b, z] of [[-w / 2 + 0.02, 0.012, -0.01], [-0.012, w / 2 - 0.02, 0.0]] as const) {
    p.box(K.cream, [a, 0.085, dp / 2 - 0.012 + z], [b, h - 0.03, dp / 2 + z], { r: 0.004, ...ROUND });
    const hx = a < 0 && b < 0.1 ? a + 0.07 : b - 0.07;
    p.box(K.ink, [hx - 0.015, h / 2 - 0.04, dp / 2 + z - 0.001], [hx + 0.015, h / 2 + 0.04, dp / 2 + z + 0.001], { r: 0.006 });
  }
  // 上: 書類の箱（ふた付き）・横に寝かせたファイルの束
  storeBox(p.sub([-w / 2 + 0.25, h + 0.025, -0.02], 0.05), 0.33, 0.1, 0.25, K.paper, K.sage);
  let y = h + 0.025;
  for (let i = 0; i < 3; i++) {
    p.sub([w / 2 - 0.3, y, 0.0], (p.r() - 0.5) * 0.1).box(SPINES[Math.floor(p.r() * SPINES.length)], [-0.12, 0, -0.16], [0.12, 0.03, 0.16], { r: 0.003 });
    y += 0.03;
  }
  p.collide([-w / 2 - 0.012, 0, -dp / 2], [w / 2 + 0.012, h + 0.025, dp / 2 + 0.015]);
}

/** 黒電話（色は暗い青緑）: 斜めの前の面の胴・回すダイヤル（指穴と真ん中の紙）・受け台・受話器・巻いたコード。原点は机の上面 */
export function deskPhone(p: Prop): void {
  const c = K.darker;
  p.extrude(c, [[-0.1, 0], [0.1, 0], [0.1, 0.025], [0.065, 0.095], [-0.085, 0.11], [-0.1, 0.1]], 'zy', -0.1, 0.1, { bevel: 0.014 });
  const d = p.sub([0, 0.06, 0.085], 0, { pitch: -0.42 });
  d.cyl(K.metal, [0, 0, 0.003], 0.048, 0.006, { axis: 'z', seg: 22 });
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 0.35 + (i / 10) * Math.PI * 1.6;
    d.cyl(K.ink, [Math.cos(a) * 0.034, Math.sin(a) * 0.034, 0.006], 0.007, 0.003, { axis: 'z', seg: 8 });
  }
  d.cyl(K.paper, [0, 0, 0.007], 0.016, 0.003, { axis: 'z', seg: 12 });
  for (const x of [-0.07, 0.07]) p.box(c, [x - 0.014, 0.1, -0.06], [x + 0.014, 0.13, -0.01], { r: 0.008, ...ROUND });
  p.tube(c, [[-0.105, 0.13, -0.035], [-0.07, 0.15, -0.035], [0.07, 0.15, -0.035], [0.105, 0.13, -0.035]], 0.014, { seg: 12 });
  for (const x of [-0.11, 0.11]) p.ball(c, [x, 0.125, -0.035], [0.026, 0.02, 0.036], { seg: 10 });
  p.tube(K.ink, [[0.12, 0.11, -0.035], [0.16, 0.04, 0.0], [0.18, 0.006, -0.05], [0.12, 0.006, -0.1], [0.1, 0.03, -0.07]], 0.005, { seg: 14, radial: 5 });
}

/** 応接のソファ: 木の脚（先細り）・胴・2〜3 枚の座の座布団と背の座布団・肘掛けと木の笠木 */
export function sofa(p: Prop, w = 1.4, col = K.greyBlue): void {
  const wd = K.woodD;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(wd, [sx * (w / 2 - 0.07), 0.06, sz * 0.3], 0.017, 0.12, { radiusTop: 0.026, seg: 8 });
  p.box(col, [-w / 2, 0.12, -0.38], [w / 2, 0.3, 0.36], { r: 0.02, ...ROUND });
  p.box(col, [-w / 2 + 0.02, 0.3, -0.4], [w / 2 - 0.02, 0.8, -0.27], { r: 0.04 });
  const arm = 0.15;
  const n = Math.max(1, Math.round((w - 2 * arm) / 0.55));
  const cw = (w - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    const a = -w / 2 + arm + cw * i + 0.006;
    p.box(col, [a, 0.3, -0.26], [a + cw - 0.012, 0.43, 0.37], { r: 0.04 });
    p.sub([0, 0.43, -0.25], 0, { pitch: -0.1 }).box(col, [a, 0, -0.05], [a + cw - 0.012, 0.34, 0.05], { r: 0.05 });
  }
  for (const s of [-1, 1]) {
    const a = s < 0 ? -w / 2 : w / 2 - arm;
    p.box(col, [a, 0.3, -0.4], [a + arm, 0.6, 0.37], { r: 0.05 });
    p.box(wd, [a + 0.01, 0.6, -0.38], [a + arm - 0.01, 0.625, 0.38], { r: 0.012, ...ROUND });
  }
  p.collide([-w / 2, 0, -0.4], [w / 2, 0.8, 0.38]);
}

/** 茶碗と受け皿（湯呑み）。原点は受け皿の下 */
export function teacup(p: Prop, col = K.white): void {
  p.lathe(col, [[0, 0], [0.05, 0.002], [0.06, 0.01], [0.055, 0.012], [0, 0.008]], [0, 0, 0], { seg: 14 });
  p.lathe(col, [[0, 0.008], [0.025, 0.008], [0.036, 0.04], [0.039, 0.07], [0.034, 0.07], [0.03, 0.04], [0, 0.03]], [0, 0, 0], { seg: 14 });
}

/** 応接の低い机: 角の丸い天板・幕板・先細りの脚・下の棚板・レースの敷物・灰皿・茶碗 */
export function lowTable(p: Prop, w = 1.0, dp = 0.55): void {
  const wd = K.wood;
  const wdD = K.woodD;
  p.box(wd, [-w / 2, 0.38, -dp / 2], [w / 2, 0.41, dp / 2], { r: 0.012, ...ROUND });
  p.box(wdD, [-w / 2 + 0.05, 0.33, -dp / 2 + 0.05], [w / 2 - 0.05, 0.38, dp / 2 - 0.05]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(wdD, [sx * (w / 2 - 0.07), 0.19, sz * (dp / 2 - 0.07)], 0.015, 0.38, { radiusTop: 0.024, seg: 8 });
  p.box(wd, [-w / 2 + 0.06, 0.1, -dp / 2 + 0.06], [w / 2 - 0.06, 0.115, dp / 2 - 0.06]);
  p.cyl(K.paper, [0, 0.411, 0], 0.17, 0.002, { seg: 18 });
  p.lathe(K.glassTint, [[0, 0], [0.065, 0], [0.07, 0.028], [0.058, 0.032], [0.05, 0.012], [0, 0.012]], [0.3, 0.41, 0.1], { seg: 16 });
  for (const [x, z] of [[-0.12, 0.08], [0.06, -0.1]] as const) teacup(p.sub([x, 0.412, z]));
  p.collide([-w / 2, 0, -dp / 2], [w / 2, 0.42, dp / 2]);
}

/** 白衣（掛けた物）: 肩から裾へ広がる胴・袖・襟と前の合わせ・ポケット。原点は掛けた所（襟の後ろ）・+z が前 */
export function whiteCoat(p: Prop): void {
  const c = K.white;
  const o: V2[] = [[-0.05, 0], [0.05, 0], [0.19, -0.06], [0.21, -0.22], [0.24, -0.98], [-0.24, -0.98], [-0.21, -0.22], [-0.19, -0.06]];
  p.extrude(c, o, 'xy', -0.05, 0.06, { bevel: 0.025 });
  for (const s of [-1, 1]) p.sub([s * 0.205, -0.08, 0.005], 0, { roll: s * 0.06 }).box(c, [-0.04, -0.6, -0.045], [0.04, 0, 0.05], { r: 0.035 });
  p.box(K.cloth, [-0.004, -0.95, 0.055], [0.004, -0.12, 0.062]);
  for (const s of [-1, 1]) p.extrude(K.cloth, [[0, 0], [s * 0.12, -0.12], [s * 0.06, -0.2], [0, -0.1]].map(([x, y]) => [x, y - 0.02] as V2), 'xy', 0.05, 0.065, {});
  for (const s of [-1, 1]) p.box(K.cloth, [s * 0.1 - 0.06, -0.62, 0.058], [s * 0.1 + 0.06, -0.6, 0.064]);
}

/** コート掛け（木）: 重い丸い台・柱・上の玉・曲がった掛け金物（上 4・下 4）と白衣 1 枚 */
export function coatStand(p: Prop, coat = true): void {
  const wd = K.woodD;
  p.lathe(wd, [[0, 0], [0.2, 0], [0.21, 0.02], [0.13, 0.05], [0.04, 0.075], [0, 0.075]], [0, 0, 0], { seg: 20 });
  p.cyl(wd, [0, 0.9, 0], 0.022, 1.66, { seg: 10 });
  p.ball(wd, [0, 1.75, 0], 0.035, { seg: 10 });
  for (let i = 0; i < 4; i++) {
    const s = p.sub([0, 0, 0], (i * Math.PI) / 2 + Math.PI / 4);
    s.tube(K.ink, [[0, 1.6, 0], [0, 1.61, 0.09], [0, 1.66, 0.14], [0, 1.71, 0.13]], 0.007, { seg: 10, radial: 5 });
    s.tube(K.ink, [[0, 1.44, 0], [0, 1.45, 0.06], [0, 1.49, 0.09]], 0.006, { seg: 8, radial: 5 });
  }
  if (coat) whiteCoat(p.sub([0, 0, 0], Math.PI / 4).sub([0, 1.64, 0.16]));
  p.collide([-0.21, 0, -0.21], [0.21, 1.79, 0.21]);
}

/** 本棚（木の開いた棚）: 側板・天板・背板・台輪・棚板の前の縁と、本の並び */
export function bookcase(p: Prop, w: number, h: number, dp: number): void {
  const wd = K.wood;
  const wdD = K.woodD;
  for (const s of [-1, 1]) p.box(wd, [s < 0 ? -w / 2 : w / 2 - 0.02, 0, -dp / 2], [s < 0 ? -w / 2 + 0.02 : w / 2, h, dp / 2], { r: 0.004, ...ROUND });
  p.box(wd, [-w / 2 - 0.012, h - 0.02, -dp / 2], [w / 2 + 0.012, h + 0.012, dp / 2 + 0.012], { r: 0.006, ...ROUND });
  p.box(wdD, [-w / 2 + 0.02, 0.06, -dp / 2], [w / 2 - 0.02, h - 0.02, -dp / 2 + 0.01]);
  p.box(wdD, [-w / 2 + 0.02, 0, -dp / 2 + 0.01], [w / 2 - 0.02, 0.06, dp / 2 - 0.02]);
  const n = Math.max(3, Math.round(h / 0.38));
  for (let i = 0; i < n; i++) {
    const y = 0.06 + ((h - 0.08) * i) / n;
    p.box(wd, [-w / 2 + 0.02, y, -dp / 2 + 0.01], [w / 2 - 0.02, y + 0.018, dp / 2], { r: 0.003 });
    bookRow(p.sub([0, y + 0.018, 0]), w - 0.06, dp - 0.03, (h - 0.08) / n - 0.03);
  }
  p.collide([-w / 2 - 0.012, 0, -dp / 2], [w / 2 + 0.012, h + 0.012, dp / 2 + 0.012]);
}

/** 屑かご（ブリキの筒）: 少し開いた胴・巻いた縁・中の丸めた紙 */
export function wasteBin(p: Prop, col = K.sage): void {
  p.lathe(col, [[0, 0], [0.11, 0], [0.112, 0.01], [0.135, 0.3], [0.13, 0.302], [0.105, 0.012], [0, 0.012]], [0, 0, 0], { seg: 18 });
  p.torus(col, [0, 0.302, 0], 0.136, 0.007, { axis: 'y', seg: 18 });
  for (let i = 0; i < 2 + Math.floor(p.r() * 2); i++) {
    const pos: V3 = [(p.r() - 0.5) * 0.1, 0.24 + p.r() * 0.05, (p.r() - 0.5) * 0.1];
    p.ball(K.paper, pos, [0.045, 0.035, 0.04], { seg: 7 });
  }
  p.collide([-0.14, 0, -0.14], [0.14, 0.31, 0.14]);
}
