import type { Prop } from '../../../props/kit.ts';
import { PAL } from '../mats.ts';
import { ledDot } from './equipment.ts';

/**
 * 施設の小物（消火・監視室・開梱室・荷捌き場・廊下）。物の座標: 原点は床の上の中心、+z が正面。
 */

const NB = { shadow: false as const };

/**
 * 消火ガスのボンベ（高さ 1.5・径 0.27。窒素の不活性ガス消火）: 肩の丸い胴・首の弁・白い札・固定の帯。
 * 高圧ガスの容器の色の決まりで窒素の胴はねずみ色、消火設備の容器であることを示す赤い帯を肩に巻く
 */
export function gasCylinder(p: Prop, o: { color?: string } = {}): void {
  const c = o.color ?? '#6fa2b2';
  p.lathe(
    c,
    [
      [0.0, 0.0],
      [0.125, 0.0],
      [0.135, 0.03],
      [0.135, 1.28],
      [0.12, 1.36],
      [0.07, 1.42],
      [0.04, 1.44],
      [0.0, 1.44],
    ],
    [0, 0, 0],
    { seg: 18 },
  );
  p.cyl('#b44a52', [0, 1.18, 0], 0.138, 0.12, { seg: 18, shadow: false });
  p.cyl(PAL.steel, [0, 1.48, 0], 0.03, 0.08, { seg: 10, shadow: false });
  p.box(PAL.steel, [-0.06, 1.5, -0.015], [0.06, 1.53, 0.015], NB);
  p.box(PAL.paper, [-0.06, 0.8, 0.13], [0.06, 1.0, 0.137], NB);
}

/** ボンベの列（n 本）: 架台の帯・上の集合管・各ボンベから集合管への細い管・起動の箱 */
export function cylinderBank(p: Prop, o: { n?: number } = {}): void {
  const n = o.n ?? 6;
  const pitch = 0.34;
  const x0 = (-(n - 1) * pitch) / 2;
  p.collide([x0 - 0.25, 0, -0.22], [-x0 + 0.25, 1.8, 0.15]);
  for (let i = 0; i < n; i++) gasCylinder(p.sub([x0 + i * pitch, 0, 0]));
  // 架台（後ろの柱・2 本の帯）
  for (const x of [x0 - 0.22, -x0 + 0.22]) p.box('#2f6474', [x - 0.03, 0, -0.2], [x + 0.03, 1.8, -0.16], NB);
  for (const y of [0.55, 1.15]) p.box('#2f6474', [x0 - 0.22, y, -0.17], [-x0 + 0.22, y + 0.05, -0.14]);
  // 集合管と細い管
  p.rod('#a8b6ba', [x0 - 0.2, 1.75, -0.05], [-x0 + 0.2, 1.75, -0.05], 0.04, { radial: 10 });
  for (let i = 0; i < n; i++) {
    const x = x0 + i * pitch;
    p.tube('#58707a', [[x, 1.53, 0], [x, 1.66, -0.02], [x, 1.75, -0.05]], 0.012, { radial: 5, seg: 6, shadow: false });
  }
  p.rod('#a8b6ba', [-x0 + 0.2, 1.75, -0.05], [-x0 + 0.2, 2.8, -0.05], 0.04, { radial: 10 });
  // 起動の箱（赤い箱と表示灯）
  p.box(PAL.red, [-x0 + 0.35, 1.2, -0.12], [-x0 + 0.65, 1.6, -0.02], { r: 0.008 });
  ledDot(p, -x0 + 0.5, 1.5, -0.02, PAL.ledRed, 0.012);
  p.box(PAL.paper, [-x0 + 0.4, 1.3, -0.02], [-x0 + 0.6, 1.36, -0.016], NB);
}

/** 監視の机（幅 1.6）: 天板・袖の引き出し・画面 3 枚（光る）・キーボード・マウス */
export function nocDesk(p: Prop, o: { w?: number } = {}): void {
  const w = o.w ?? 1.6;
  const hw = w / 2;
  const top = 0.72;
  p.collide([-hw, 0, -0.4], [hw, top, 0.4]);
  p.box('#9ac6cf', [-hw, top - 0.03, -0.4], [hw, top, 0.4], { r: 0.008 });
  p.box('#3f7484', [-hw + 0.02, 0, -0.38], [-hw + 0.45, top - 0.03, 0.36]);
  for (let k = 0; k < 3; k++) p.box('#5a93a3', [-hw + 0.04, 0.08 + k * 0.2, 0.36], [-hw + 0.43, 0.25 + k * 0.2, 0.37], NB);
  p.box('#3f7484', [hw - 0.05, 0, -0.38], [hw - 0.02, top - 0.03, 0.36], NB);
  p.box('#3f7484', [-hw + 0.45, 0.3, -0.38], [hw - 0.05, top - 0.03, -0.36], NB);
  // 画面 3 枚（少し内向き）
  for (let i = -1; i <= 1; i++) {
    const s = p.sub([i * 0.52, top, -0.18 + Math.abs(i) * 0.06], -i * 0.35);
    s.box(PAL.black, [-0.03, 0, -0.08], [0.03, 0.02, 0.02], NB);
    s.box(PAL.black, [-0.012, 0.02, -0.05], [0.012, 0.18, -0.03], NB);
    s.box(PAL.black, [-0.27, 0.12, -0.04], [0.27, 0.45, -0.01], { r: 0.006 });
    s.box(i === 0 ? '#3fb7cf' : '#2c8aa6', [-0.255, 0.135, -0.01], [0.255, 0.435, -0.006], { kind: 'glow', ...NB });
    // 画面の背: 中央の膨らみ（取り付けの台）・通気の切れ込み・銘板
    s.box('#1d3540', [-0.16, 0.18, -0.065], [0.16, 0.4, -0.04], { r: 0.008, shadow: false });
    for (let k = 0; k < 5; k++) s.box('#33505c', [-0.22, 0.38 - k * 0.025, -0.0405], [-0.17, 0.39 - k * 0.025, -0.039], NB);
    s.box('#c8d8dc', [0.05, 0.22, -0.066], [0.12, 0.25, -0.064], NB);
  }
  // 机の前板（足元の目隠し）: 合わせ目・配線の口・通気の切れ込み
  p.box('#5a93a3', [-hw + 0.46, 0.06, -0.392], [hw - 0.06, 0.29, -0.385], NB);
  for (let x = -hw + 0.6; x < hw - 0.2; x += 0.08) p.box('#2f6474', [x, 0.12, -0.394], [x + 0.03, 0.24, -0.391], NB);
  p.box('#1d3a46', [-0.1, top - 0.1, -0.395], [0.1, top - 0.05, -0.39], NB);
  p.box('#1d3a46', [-0.25, top, 0.05], [0.2, top + 0.02, 0.2], { r: 0.004, shadow: false });
  p.box('#1d3a46', [0.32, top, 0.08], [0.38, top + 0.025, 0.17], { r: 0.01, shadow: false });
  p.cyl('#d8eef0', [-0.6, top + 0.06, 0.15], 0.04, 0.12, { seg: 12, shadow: false });
}

/** 壁の大きな画面（2 × 3 枚）: 枠・光る画面（地図と線の図。色だけで描く）・下の台 */
export function videoWall(p: Prop, o: { cols?: number; rows?: number } = {}): void {
  const cols = o.cols ?? 3;
  const rows = o.rows ?? 2;
  const sw = 1.22;
  const sh = 0.7;
  const x0 = (-cols * sw) / 2;
  const y0 = 0.95;
  p.collide([x0, 0, -0.5], [-x0, 0.75, -0.02]);
  p.box(PAL.black, [x0 - 0.04, y0 - 0.04, -0.12], [-x0 + 0.04, y0 + rows * sh + 0.04, -0.02], { r: 0.01 });
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const xa = x0 + c * sw + 0.01;
      const ya = y0 + r * sh + 0.01;
      p.box(PAL.black, [xa, ya, -0.02], [xa + sw - 0.02, ya + sh - 0.02, -0.01], NB);
      p.box(r === 1 && c === 1 ? '#2a90ad' : '#185c74', [xa + 0.01, ya + 0.01, -0.01], [xa + sw - 0.03, ya + sh - 0.03, -0.006], { kind: 'glow', ...NB });
      // 画面の中の図（線グラフの帯・地図の点・表の行）
      for (let k = 0; k < 5; k++) {
        const yy = ya + 0.08 + k * 0.11;
        const len = 0.2 + p.r() * (sw - 0.5);
        p.box(k % 2 ? '#56d8ef' : '#3fb7cf', [xa + 0.06, yy, -0.006], [xa + 0.06 + len, yy + 0.018, -0.004], { kind: 'glow', ...NB });
      }
      ledDot(p, xa + sw - 0.15, ya + sh - 0.12, -0.006, p.r() < 0.2 ? PAL.ledAmber : PAL.ledGreen, 0.02);
    }
  // 下の台（低い収納）
  p.box('#3f7484', [x0, 0, -0.5], [-x0, 0.75, -0.05], { r: 0.008 });
  for (let c = 0; c < cols * 2; c++) p.box('#5a93a3', [x0 + 0.03 + c * (sw / 2), 0.08, -0.05], [x0 + (c + 1) * (sw / 2) - 0.03, 0.68, -0.044], NB);
}

/**
 * 段ボールのサーバーの箱（長い平たい箱: 幅 0.6・長さ 1.0・高さ 0.3）: ふたの合わせ目・テープ・ラベル・取っ手の穴。
 * 箱は製造元ごとに茶色（無地の段ボール）か白（印刷した化粧箱・横に青い帯）。色は箱ごと
 */
export function serverBox(p: Prop, o: { w?: number; l?: number; h?: number; white?: boolean } = {}): void {
  const w = o.w ?? 0.62;
  const l = o.l ?? 1.0;
  const h = o.h ?? 0.28;
  const white = o.white ?? p.r() < 0.45;
  const c = white ? '#bfe0e8' : PAL.cardboard;
  if (white) for (const s of [-1, 1]) p.box('#2f7a96', [s * (w / 2) - 0.002, h * 0.35, -l / 2 + 0.05], [s * (w / 2) + 0.002, h * 0.55, l / 2 - 0.05], NB);
  p.collide([-w / 2, 0, -l / 2], [w / 2, h, l / 2]);
  p.box(c, [-w / 2, 0, -l / 2], [w / 2, h, l / 2], { r: 0.008 });
  p.box('#7d6f55', [-0.002, h - 0.001, -l / 2], [0.002, h + 0.002, l / 2], NB);
  p.box('#c9c0a6', [-0.04, h, -l / 2 - 0.001], [0.04, h + 0.002, l / 2 + 0.001], NB);
  p.box(PAL.paper, [-w / 2 - 0.002, 0.08, -0.25], [-w / 2, 0.2, 0.05], NB);
  for (const z of [-l / 2, l / 2]) p.box('#4c4232', [-0.07, h - 0.1, z - 0.002], [0.07, h - 0.06, z + 0.002], NB);
}

/**
 * パレット（1.1 × 1.1）: 上の板 7 枚・桁 3 本・下の板。木製（茶）と、繰り返し使う樹脂製（青。桁の差し込みの穴の縁）がある。材は 1 枚ごと
 */
export function pallet(p: Prop, o: { plastic?: boolean } = {}): void {
  p.collide([-0.55, 0, -0.55], [0.55, 0.14, 0.55]);
  const plastic = o.plastic ?? p.r() < 0.5;
  const wood = plastic ? '#3f86a0' : '#8a7c62';
  const bar = plastic ? '#2f6f86' : '#76694f';
  for (let i = 0; i < 7; i++) {
    const x = -0.55 + 0.05 + i * 0.165;
    p.box(wood, [x - 0.05, 0.12, -0.55], [x + 0.05, 0.14, 0.55], NB);
  }
  for (const z of [-0.5, 0, 0.5]) p.box(bar, [-0.55, 0.02, z - 0.05], [0.55, 0.12, z + 0.05]);
  for (const x of [-0.5, 0, 0.5]) p.box(wood, [x - 0.05, 0, -0.55], [x + 0.05, 0.02, 0.55], NB);
  if (plastic) for (const z of [-0.5, 0, 0.5]) for (const x of [-0.28, 0.28]) p.box('#1d4a5c', [x - 0.12, 0.035, z + 0.05], [x + 0.12, 0.1, z + 0.052], NB);
}

/** 作業台（1.8 × 0.75）: 天板・脚・下の棚・上の工具（ドライバー・ケーブルの束・ノートパソコン） */
export function workbench(p: Prop): void {
  const top = 0.85;
  p.collide([-0.9, 0, -0.38], [0.9, top, 0.38]);
  p.box('#a7ccd3', [-0.9, top - 0.04, -0.38], [0.9, top, 0.38], { r: 0.006 });
  for (const x of [-0.85, 0.85]) for (const z of [-0.33, 0.33]) p.box(PAL.steelDark, [x - 0.025, 0, z - 0.025], [x + 0.025, top - 0.04, z + 0.025], NB);
  p.box('#5a93a3', [-0.85, 0.18, -0.33], [0.85, 0.2, 0.33]);
  // ノートパソコン（開いた）
  const l = p.sub([-0.4, top, 0.05], 0.2);
  l.box('#26404a', [-0.17, 0, -0.12], [0.17, 0.015, 0.12], { r: 0.004, shadow: false });
  l.box('#26404a', [-0.17, 0.015, -0.13], [0.17, 0.25, -0.115], { r: 0.004, shadow: false });
  l.box('#3fb7cf', [-0.15, 0.03, -0.115], [0.15, 0.23, -0.112], { kind: 'glow', ...NB });
  // 巻いたケーブル・ドライバー
  p.torus('#1c3742', [0.3, top + 0.02, 0.0], 0.11, 0.015, { axis: 'y', seg: 18, shadow: false });
  p.torus('#3a6c7a', [0.32, top + 0.04, 0.03], 0.09, 0.012, { axis: 'y', seg: 18, shadow: false });
  p.box(PAL.red, [0.55, top, 0.15], [0.66, top + 0.025, 0.18], { r: 0.008, shadow: false });
  p.box(PAL.steel, [0.66, top + 0.01, 0.16], [0.78, top + 0.016, 0.17], NB);
}

/** 床板の持ち上げ具（吸盤 2 つと握り。点検口の横に置く） */
export function tileLifter(p: Prop): void {
  for (const x of [-0.07, 0.07]) p.lathe('#2c3f46', [[0, 0], [0.055, 0], [0.05, 0.02], [0.02, 0.035], [0, 0.035]], [x, 0, 0], { seg: 16, shadow: false });
  p.bend(PAL.yellow, [[-0.07, 0.035, 0], [-0.07, 0.12, 0], [0.07, 0.12, 0], [0.07, 0.035, 0]], 0.012, 0.03, { shadow: false });
}

/** 三角コーン（点検口の囲い） */
export function cone(p: Prop): void {
  p.box('#c86a3c', [-0.17, 0, -0.17], [0.17, 0.03, 0.17], { r: 0.01 });
  p.lathe('#d9773f', [[0.0, 0.03], [0.13, 0.03], [0.03, 0.68], [0.0, 0.7]], [0, 0, 0], { seg: 16 });
  p.lathe(PAL.paper, [[0.107, 0.2], [0.083, 0.36]], [0, 0, 0], { seg: 16, shadow: false });
}

/** 運ぶ台車（機器の持ち上げ台車: 柱・巻き上げのハンドル・台・キャスター） */
export function serverLift(p: Prop): void {
  p.collide([-0.32, 0, -0.5], [0.32, 1.76, 0.35]);
  p.box('#4f8ea0', [-0.32, 0.05, -0.35], [0.32, 0.12, 0.35], { r: 0.01 });
  for (const x of [-0.28, 0.28]) for (const z of [-0.3, 0.3]) p.cyl(PAL.black, [x, 0.04, z], 0.04, 0.03, { axis: 'x', seg: 10, shadow: false });
  for (const x of [-0.22, 0.22]) p.box(PAL.steel, [x - 0.03, 0.12, -0.34], [x + 0.03, 1.75, -0.28]);
  p.box(PAL.steel, [-0.25, 1.7, -0.34], [0.25, 1.76, -0.28]);
  p.box('#6aa9b8', [-0.25, 0.75, -0.28], [0.25, 0.79, 0.25]);
  p.bend(PAL.black, [[0.25, 1.2, -0.31], [0.38, 1.2, -0.31], [0.38, 1.05, -0.31]], 0.012, 0.03, { shadow: false });
  p.bend(PAL.steelDark, [[-0.2, 1.1, -0.35], [-0.2, 1.1, -0.5], [0.2, 1.1, -0.5], [0.2, 1.1, -0.35]], 0.014, 0.05, { shadow: false });
}

/** 非常口の誘導灯（緑の光る板・走る人の形は白い四角の組み合わせ） */
export function exitSign(p: Prop): void {
  p.box('#d8eef0', [-0.2, -0.1, -0.03], [0.2, 0.1, 0.0], { r: 0.006, shadow: false });
  p.box('#3fd29a', [-0.18, -0.08, 0.0], [0.18, 0.08, 0.004], { kind: 'glow', ...NB });
  p.box('#f2fff8', [-0.13, -0.05, 0.004], [-0.1, 0.04, 0.007], { kind: 'glow', ...NB });
  p.box('#f2fff8', [-0.12, -0.01, 0.004], [-0.04, 0.0, 0.007], { kind: 'glow', ...NB });
  p.box('#f2fff8', [0.02, -0.06, 0.004], [0.14, 0.06, 0.007], { kind: 'glow', ...NB });
}

/** カードの読み取り機（扉の横の壁。小さな箱・光る点） */
export function cardReader(p: Prop): void {
  p.box('#16303a', [-0.045, 1.05, 0], [0.045, 1.2, 0.025], { r: 0.006, shadow: false });
  p.box('#244b58', [-0.035, 1.07, 0.025], [0.035, 1.14, 0.028], NB);
  ledDot(p, 0, 1.17, 0.025, PAL.ledGreen, 0.006);
}

/** 監視カメラ（天井のドーム） */
export function cctvDome(p: Prop): void {
  p.cyl('#cfe6ea', [0, -0.02, 0], 0.08, 0.04, { seg: 16, shadow: false });
  p.lathe('#16303a', [[0.0, -0.1], [0.04, -0.098], [0.065, -0.08], [0.075, -0.04], [0.0, -0.04]], [0, 0, 0], { seg: 16, shadow: false });
}

/** 壁の消火器の箱（赤い箱・白い札） */
export function hydrantBox(p: Prop): void {
  p.box(PAL.red, [-0.3, 0.9, -0.12], [0.3, 1.7, 0.0], { r: 0.01 });
  p.box('#9e3f47', [-0.27, 0.93, 0.0], [0.27, 1.67, 0.006], NB);
  p.box(PAL.paper, [-0.18, 1.45, 0.006], [0.18, 1.56, 0.01], NB);
  ledDot(p, 0, 1.75, -0.02, PAL.ledRed, 0.02);
}

/** 機器を運ぶ台車（コンソール台車: 画面・キーボード・2 段の台・キャスター） */
export function crashCart(p: Prop): void {
  p.collide([-0.32, 0, -0.24], [0.32, 1.0, 0.3]);
  for (const x of [-0.28, 0.28]) for (const z of [-0.2, 0.2]) p.cyl(PAL.black, [x, 0.04, z], 0.04, 0.03, { axis: 'x', seg: 10, shadow: false });
  for (const x of [-0.3, 0.3]) for (const z of [-0.22, 0.22]) p.box(PAL.steel, [x - 0.012, 0.07, z - 0.012], [x + 0.012, 0.95, z + 0.012], NB);
  for (const y of [0.25, 0.9]) p.box('#6aa9b8', [-0.32, y, -0.24], [0.32, y + 0.03, 0.24], { r: 0.006 });
  p.box('#1d3a46', [-0.22, 0.93, 0.0], [0.2, 0.95, 0.15], { r: 0.004, shadow: false });
  p.box(PAL.black, [-0.24, 0.93, -0.2], [0.24, 1.28, -0.17], { r: 0.006 });
  p.box('#2c8aa6', [-0.22, 0.95, -0.17], [0.22, 1.26, -0.166], { kind: 'glow', ...NB });
  p.bend(PAL.steel, [[-0.3, 0.95, 0.22], [-0.3, 1.05, 0.3], [0.3, 1.05, 0.3], [0.3, 0.95, 0.22]], 0.012, 0.04, { shadow: false });
  serverBox(p.sub([0, 0.28, 0], 0), { w: 0.42, l: 0.4, h: 0.2 });
}

/** 壁掛けの画面（監視の図: 帯グラフ・線・点）。幅 w */
export function wallScreen(p: Prop, o: { w?: number; h?: number; tone?: string } = {}): void {
  const w = o.w ?? 1.0;
  const h = o.h ?? 0.58;
  p.box(PAL.black, [-w / 2, -h / 2, 0], [w / 2, h / 2, 0.05], { r: 0.008, shadow: false });
  p.box(o.tone ?? '#185c74', [-w / 2 + 0.02, -h / 2 + 0.02, 0.05], [w / 2 - 0.02, h / 2 - 0.02, 0.054], { kind: 'glow', ...NB });
  for (let k = 0; k < 6; k++) {
    const bh = 0.05 + p.r() * (h - 0.2);
    const x = -w / 2 + 0.08 + k * ((w - 0.2) / 6);
    p.box(k % 3 === 0 ? '#56d8ef' : '#3fb7cf', [x, -h / 2 + 0.06, 0.054], [x + 0.08, -h / 2 + 0.06 + bh, 0.057], { kind: 'glow', ...NB });
  }
  p.box('#9ff0ff', [-w / 2 + 0.06, h / 2 - 0.1, 0.054], [w / 2 - 0.3, h / 2 - 0.08, 0.057], { kind: 'glow', ...NB });
  ledDot(p, w / 2 - 0.12, h / 2 - 0.09, 0.054, p.r() < 0.3 ? PAL.ledAmber : PAL.ledGreen, 0.015);
}

/** 壁の時計（丸い枠・文字盤・針）。半径 r */
export function wallClock(p: Prop, r = 0.15): void {
  p.cyl('#2a4a58', [0, 0, 0.02], r, 0.04, { axis: 'z', seg: 20, shadow: false });
  p.cyl('#e8f4f6', [0, 0, 0.041], r - 0.015, 0.004, { axis: 'z', seg: 20, shadow: false });
  p.box('#14303c', [-0.005, 0, 0.044], [0.005, r * 0.6, 0.047], NB);
  p.box('#14303c', [0, -0.005, 0.044], [r * 0.45, 0.005, 0.047], NB);
}
