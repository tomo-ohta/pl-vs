import type { Prop } from '../../../props/kit.ts';
import { PAL } from '../mats.ts';

/**
 * サーバールームの機械・盤（物の座標: 原点は床の上の中心、+z が正面）。
 * 実寸と主な部位を付けて、近く（1.5 m）で何か分かる形にする（docs/08-props.md）。色は場所の色の表（mats.ts の PAL）から。
 */

const NB = { shadow: false as const };

/** 小さな LED（光る板） */
export function ledDot(p: Prop, x: number, y: number, z: number, color: string = PAL.led, s = 0.008): void {
  p.box(color, [x - s, y - s, z], [x + s, y + s, z + 0.004], { kind: 'glow', ...NB });
}

/**
 * 背の低いラック（16U・キャスター付き。参考画像 serverroom-0 の通路の右の低い箱）。
 * 天板・側板・前面の機器（横の縁）・LED の縦の列・キャスター
 */
export function shortRack(p: Prop, o: { w?: number; d?: number; h?: number } = {}): void {
  const w = o.w ?? 0.6;
  const d = o.d ?? 0.8;
  const h = o.h ?? 0.82;
  const hw = w / 2;
  // キャスター
  for (const x of [-hw + 0.06, hw - 0.06])
    for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) {
      p.box(PAL.steelDark, [x - 0.02, 0.05, z - 0.02], [x + 0.02, 0.08, z + 0.02], NB);
      p.cyl(PAL.black, [x, 0.03, z], 0.03, 0.025, { axis: 'x', seg: 10, shadow: false });
    }
  p.box(PAL.rack, [-hw, 0.08, -d / 2], [hw, h, d / 2], { r: 0.01 });
  p.box(PAL.rackTop, [-hw - 0.005, h - 0.03, -d / 2 - 0.005], [hw + 0.005, h, d / 2 + 0.005], { r: 0.006 });
  // 前面の機器（1U ずつの横の縁と、縦に並ぶ LED）
  const n = Math.floor((h - 0.16) / 0.0445);
  for (let i = 0; i < n; i++) {
    const y = 0.12 + i * 0.0445;
    p.box(i % 3 === 0 ? PAL.face : '#0d2b3a', [-hw + 0.05, y, d / 2], [hw - 0.05, y + 0.04, d / 2 + 0.008], NB);
    if (p.r() < 0.8) ledDot(p, -0.02, y + 0.02, d / 2 + 0.008, PAL.led, 0.007);
    if (p.r() < 0.5) ledDot(p, -hw + 0.09, y + 0.02, d / 2 + 0.008, PAL.ledGreen, 0.005);
    if (p.r() < 0.3) ledDot(p, hw - 0.12, y + 0.02, d / 2 + 0.008, PAL.ledWhite, 0.005);
  }
  // 側面の LED（通路から見える縦の列）
  for (let i = 0; i < n; i += 2) if (p.r() < 0.7) p.box(PAL.led, [hw, 0.14 + i * 0.0445, d / 2 - 0.25], [hw + 0.004, 0.15 + i * 0.0445, d / 2 - 0.22], { kind: 'glow', ...NB });
}

/**
 * 分電盤（ラックの列に入る背の高い淡い灰色の盤。参考画像 serverroom-1 の左の淡い大きな面）。
 * 2 枚扉・横の握り棒・表示の窓・銘板・換気の切れ込み・台座
 */
export function powerCabinet(p: Prop, o: { w?: number; d?: number; h?: number; color?: string } = {}): void {
  const w = o.w ?? 0.9;
  const d = o.d ?? 0.9;
  const h = o.h ?? 2.3;
  const hw = w / 2;
  const c = o.color ?? '#5a9eae';
  p.collide([-hw, 0, -d], [hw, h, 0.03]);
  p.box(PAL.black, [-hw + 0.01, 0, -d + 0.02], [hw - 0.01, 0.1, -0.02], NB);
  p.box(c, [-hw, 0.1, -d], [hw, h, -0.02], { r: 0.008 });
  // 2 枚扉（合わせ目と縁）
  p.box(c, [-hw + 0.015, 0.12, -0.02], [-0.003, h - 0.03, 0], { r: 0.004 });
  p.box(c, [0.003, 0.12, -0.02], [hw - 0.015, h - 0.03, 0], { r: 0.004 });
  // 横の握り棒（左の扉）・縦の錠
  p.box('#2f6676', [-hw + 0.06, 1.22, 0], [-0.06, 1.24, 0.03], { r: 0.008, shadow: false });
  p.box('#2f6676', [0.05, 1.3, 0], [0.07, 1.5, 0.03], { r: 0.006, shadow: false });
  // 表示の窓（暗い）と銘板
  p.box('#123848', [-0.3, 1.02, 0], [-0.1, 1.12, 0.008], NB);
  p.box(PAL.led, [-0.28, 1.06, 0.008], [-0.22, 1.08, 0.011], { kind: 'glow', ...NB });
  p.box(PAL.paper, [-0.2, 1.62, 0], [-0.06, 1.7, 0.004], NB);
  // 換気の切れ込み（下）
  for (let k = 0; k < 6; k++) p.box('#3c7e90', [-hw + 0.08 + k * 0.03, 0.3, 0], [-hw + 0.095 + k * 0.03, 0.5, 0.004], NB);
  for (let k = 0; k < 6; k++) p.box('#3c7e90', [0.08 + k * 0.03, 0.3, 0], [0.095 + k * 0.03, 0.5, 0.004], NB);
}

/**
 * KVM のコンソール（ラックから引き出した画面とキーボード。参考画像 serverroom-2 の右の奥の突き出た箱）
 */
export function kvmDrawer(p: Prop, o: { y?: number } = {}): void {
  const y = o.y ?? 1.0;
  // 引き出したトレイ（キーボード）
  p.box(PAL.steelDark, [-0.22, y, 0], [0.22, y + 0.04, 0.5], { r: 0.006 });
  p.box('#9fcad6', [-0.2, y + 0.04, 0.05], [0.2, y + 0.05, 0.3], NB);
  p.box('#0b2230', [-0.06, y + 0.04, 0.33], [0.06, y + 0.048, 0.43], NB);
  // 立てた画面（蓋）
  p.box(PAL.steelDark, [-0.22, y + 0.04, -0.02], [0.22, y + 0.36, 0.0], { r: 0.006 });
  p.box('#2c8aa4', [-0.19, y + 0.07, 0.0], [0.19, y + 0.33, 0.004], { kind: 'glow', ...NB });
  // レール
  p.box(PAL.steel, [-0.235, y + 0.005, -0.3], [-0.22, y + 0.03, 0.45], NB);
  p.box(PAL.steel, [0.22, y + 0.005, -0.3], [0.235, y + 0.03, 0.45], NB);
}
