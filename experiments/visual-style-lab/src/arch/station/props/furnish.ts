import type { Prop, V2 } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';

/**
 * 駅舎の家具と植え込み（事務机・パンフレットの棚・角のプランター）。正面 +z、床 y = 0。
 * 寸法の根拠:
 * - 片袖の事務机: 幅 1.2〜1.6 m・奥行き 0.7〜0.8 m・高さ 0.7 m。天板（縁の帯）・右の引き出し 3 段（取っ手のくぼみ）・左の脚の板・背の幕板。
 *   上に画面（台・縁・光る面）・キーボード・書類の束・電話
 * - パンフレットの棚: 幅 0.8 m・高さ 1.45 m・奥行き 0.3 m。横の板・4 段の斜めの差し入れ（前の透ける縁）とパンフレット
 * - 角のプランター: 0.6 × 0.45 m・高さ 0.42 m。上がすこし広い鉢・縁・土・常緑の低木（葉の塊）
 */

/** 片袖の事務机（座る人の側が +z）。items で机の上の物 */
export function officeDesk(p: Prop, o: { w?: number; d?: number; steel?: string; top?: string; items?: boolean } = {}): void {
  const W = o.w ?? 1.4;
  const D = o.d ?? 0.75;
  const H = 0.7;
  const st = o.steel ?? '#c3c9c3';
  const top = o.top ?? '#7f9a8e';
  const dark = '#2a3233';
  // 天板（縁の帯と上の面）
  p.box(shade(st, -0.2), [-W / 2, H - 0.035, -D / 2], [W / 2, H, D / 2], { r: 0.006, collide: true });
  p.box(top, [-W / 2 + 0.015, H, -D / 2 + 0.015], [W / 2 - 0.015, H + 0.003, D / 2 - 0.015], { shadow: 'receive' });
  // 右の袖（引き出し 3 段）
  const px0 = W / 2 - 0.42;
  p.box(st, [px0, 0.02, -D / 2 + 0.02], [W / 2 - 0.01, H - 0.035, D / 2 - 0.02], { r: 0.004, collide: true });
  p.box(dark, [px0 + 0.01, 0, -D / 2 + 0.04], [W / 2 - 0.02, 0.03, D / 2 - 0.04], {});
  const rows: [number, number][] = [[0.42, 0.63], [0.26, 0.41], [0.04, 0.25]];
  for (const [y0, y1] of rows) {
    p.box(shade(st, 0.12), [px0 + 0.012, y0, D / 2 - 0.02], [W / 2 - 0.022, y1, D / 2 - 0.006], { r: 0.004 });
    p.box(dark, [px0 + 0.1, y1 - 0.045, D / 2 - 0.006], [W / 2 - 0.11, y1 - 0.03, D / 2 - 0.002], { shadow: false });
  }
  // 中の浅い引き出し・左の脚の板・背の幕板
  p.box(shade(st, 0.12), [-W / 2 + 0.05, H - 0.11, D / 2 - 0.03], [px0 - 0.01, H - 0.04, D / 2 - 0.014], { r: 0.004 });
  p.box(st, [-W / 2 + 0.01, 0.0, -D / 2 + 0.02], [-W / 2 + 0.035, H - 0.035, D / 2 - 0.02], { r: 0.004 });
  p.box(st, [-W / 2 + 0.03, 0.2, -D / 2 + 0.02], [px0, H - 0.04, -D / 2 + 0.035], {});
  if (o.items === false) return;
  // 画面（台・縁・光る面）・キーボード・書類の束・電話
  const m = p.sub([-0.12, H + 0.003, -D / 2 + 0.2], (p.r() - 0.5) * 0.3);
  m.box(dark, [-0.1, 0, -0.08], [0.1, 0.015, 0.06], { r: 0.006 });
  m.box(dark, [-0.025, 0.015, -0.03], [0.025, 0.12, -0.01], {});
  m.box(dark, [-0.25, 0.1, -0.04], [0.25, 0.42, -0.01], { r: 0.008 });
  m.box('#9ad0c8', [-0.23, 0.12, -0.01], [0.23, 0.4, -0.006], { kind: 'glow', shadow: false });
  p.box('#d9ddd6', [-0.33, H + 0.003, D / 2 - 0.26], [0.09, H + 0.02, D / 2 - 0.1], { r: 0.006 });
  for (let k = 0; k < 2 + Math.floor(p.r() * 3); k++) {
    const s = p.sub([W / 2 - 0.3 + (p.r() - 0.5) * 0.04, H + 0.003 + k * 0.012, -D / 2 + 0.2 + (p.r() - 0.5) * 0.04], (p.r() - 0.5) * 0.4);
    s.box(k % 3 === 2 ? '#d8cfa6' : '#f2f3ee', [-0.105, 0, -0.15], [0.105, 0.011, 0.15], { shadow: false });
  }
  const t = p.sub([-W / 2 + 0.2, H + 0.003, -D / 2 + 0.18], 0.3);
  t.box('#3a4646', [-0.1, 0, -0.1], [0.1, 0.05, 0.1], { r: 0.012 });
  t.box('#2a3233', [-0.09, 0.05, -0.06], [0.09, 0.08, -0.01], { r: 0.012 });
}

/** パンフレットの棚（4 段の斜めの差し入れ。前 +z） */
export function pamphletRack(p: Prop, o: { frame?: string; colors?: string[] } = {}): void {
  const fr = o.frame ?? '#8a6f52';
  const cols = o.colors ?? ['#f2f3ee', '#c94a45', '#3d78b8', '#e3c06a', '#4f9a64', '#f2f3ee', '#7fb1a8'];
  const W = 0.8;
  const H = 1.45;
  const D = 0.3;
  // 横の板（上から見て前が低い台形の輪郭）・背の板・台
  const side: V2[] = [[-D / 2, 0], [D / 2, 0], [D / 2, 0.45], [-D / 2 + 0.08, H], [-D / 2, H]];
  for (const s of [-1, 1]) p.extrude(fr, side, 'zy', s * W / 2 - 0.009, s * W / 2 + 0.009, { bevel: 0.004 });
  p.box(shade(fr, -0.2), [-W / 2, 0.05, -D / 2], [W / 2, H - 0.02, -D / 2 + 0.015], {});
  p.box(fr, [-W / 2, 0, -D / 2], [W / 2, 0.08, D / 2], { r: 0.006 });
  p.collide([-W / 2 - 0.01, 0, -D / 2], [W / 2 + 0.01, H, D / 2]);
  // 段: 斜めの受け（前の透ける縁）と、2〜3 部ずつのパンフレット
  for (let r = 0; r < 4; r++) {
    const y = 0.35 + r * 0.27;
    const z = D / 2 - 0.04 - r * 0.045;
    const s = p.sub([0, y, z], 0, { pitch: -0.28 });
    s.box(shade(fr, -0.1), [-W / 2 + 0.01, -0.01, -0.06], [W / 2 - 0.01, 0.0, 0.03], {});
    s.box('#dcebea', [-W / 2 + 0.01, 0.0, 0.026], [W / 2 - 0.01, 0.08, 0.032], { kind: 'glass', shadow: false });
    for (let c = 0; c < 3; c++) {
      const x = -W / 2 + 0.14 + c * 0.26;
      if (p.r() < 0.12) continue;
      const col = cols[Math.floor(p.r() * cols.length)];
      const n = 1 + Math.floor(p.r() * 3);
      for (let k = 0; k < n; k++) {
        const q = s.sub([x + (p.r() - 0.5) * 0.02, 0, 0.018 - k * 0.006], (p.r() - 0.5) * 0.06);
        q.box(k === n - 1 ? col : shade(col, -0.2), [-0.105, 0, -0.002], [0.105, 0.21 + (p.r() - 0.5) * 0.02, 0.002], { shadow: false });
      }
      // 表紙の帯（刷った色の面）
      s.box('#f4f4ee', [x - 0.09, 0.12, 0.02], [x + 0.09, 0.15, 0.021], { shadow: false });
    }
  }
}

/** 角のプランター（常緑の低木の塊） */
export function planter(p: Prop, o: { pot?: string; leaf?: string; w?: number; d?: number } = {}): void {
  const pot = o.pot ?? '#b9b3a4';
  const leaf = o.leaf ?? '#3f6f52';
  const W = o.w ?? 0.6;
  const D = o.d ?? 0.45;
  const H = 0.42;
  // 鉢（下がすぼまる）・縁・土
  p.extrude(pot, [[-W / 2 + 0.03, 0], [W / 2 - 0.03, 0], [W / 2, H - 0.04], [-W / 2, H - 0.04]], 'xy', -D / 2 + 0.02, D / 2 - 0.02, { bevel: 0.01, collide: true });
  p.box(shade(pot, 0.15), [-W / 2 - 0.01, H - 0.04, -D / 2 - 0.01], [W / 2 + 0.01, H, D / 2 + 0.01], { r: 0.012 });
  p.box('#3a3328', [-W / 2 + 0.03, H - 0.03, -D / 2 + 0.03], [W / 2 - 0.03, H + 0.005, D / 2 - 0.03], { shadow: false });
  // 低木（刈り込んだ常緑の株）: 低い丸屋根の塊に、小さな葉の塊のこぶ。上は明るく、下は暗い
  const top = H + 0.02;
  p.ball(shade(leaf, -0.2), [0, top + 0.08, 0], [W * 0.46, 0.2, D * 0.46], { seg: 12 });
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + p.r() * 0.4;
    const ring = i % 3 === 0 ? 0.35 : 0.85;
    const x = Math.cos(a) * W * 0.4 * ring;
    const z = Math.sin(a) * D * 0.4 * ring;
    const y = top + 0.08 + (1 - ring) * 0.12 + 0.06 + p.r() * 0.05;
    const r = 0.07 + p.r() * 0.05;
    const c = ring < 0.5 ? shade(leaf, 0.35) : p.r() < 0.4 ? shade(leaf, 0.12) : leaf;
    p.ball(c, [x, y, z], [r, r * 0.8, r], { seg: 8, shadow: false });
  }
  for (let k = 0; k < 3; k++) p.rod(shade(leaf, -0.7), [(p.r() - 0.5) * 0.2, H, (p.r() - 0.5) * 0.15], [(p.r() - 0.5) * 0.3, H + 0.2, (p.r() - 0.5) * 0.2], 0.008, { shadow: false });
}
