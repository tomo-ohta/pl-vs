import type { Prop, V2 } from '../kit.ts';
import { shade } from '../kit.ts';

/**
 * 家具と設備の小物（ベンチ・植木・ごみ箱・消火器・椅子）。正面 +z、床 y = 0。
 */

/** ベンチ: 'slat' = 木の板の背なし（屋外・更衣室）、'locker' = 1 枚板の背なし（プールサイド）、'seats' = 座面の並ぶ待合いの椅子 */
export function bench(p: Prop, o: { w?: number; kind?: 'slat' | 'locker' | 'seats'; seat?: string; frame?: string; n?: number } = {}): void {
  const W = o.w ?? 1.8;
  const seat = o.seat ?? '#d8c7a4';
  const fr = o.frame ?? '#8b9895';
  const kind = o.kind ?? 'slat';
  if (kind === 'seats') {
    const n = o.n ?? Math.max(2, Math.round(W / 0.5));
    const pitch = W / n;
    // 下の梁と足
    p.box(fr, [-W / 2, 0.3, -0.04], [W / 2, 0.36, 0.04], { r: 0.012 });
    for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) {
      p.box(fr, [x - 0.03, 0, -0.03], [x + 0.03, 0.36, 0.03], { r: 0.01 });
      p.box(fr, [x - 0.03, 0, -0.25], [x + 0.03, 0.02, 0.25], { r: 0.008 });
    }
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + pitch * (i + 0.5);
      const s = p.sub([x, 0.36, 0]);
      // 一体の座面と背（成形の樹脂）: 横から見た輪郭を押し出す
      s.extrude(seat, [[-0.22, 0.02], [0.22, 0.04], [0.24, 0.08], [-0.2, 0.08], [-0.24, 0.12], [-0.3, 0.52], [-0.26, 0.54], [-0.2, 0.15]], 'zy', -pitch / 2 + 0.02, pitch / 2 - 0.02, { bevel: 0.012 });
      s.box(fr, [-0.03, -0.01, -0.12], [0.03, 0.03, 0.12], { r: 0.008 });
    }
    p.collide([-W / 2, 0, -0.3], [W / 2, 0.85, 0.25]);
    return;
  }
  const H = 0.42;
  if (kind === 'slat') {
    for (let i = 0; i < 4; i++) p.box(seat, [-W / 2, H - 0.035, -0.18 + i * 0.095], [W / 2, H, -0.18 + i * 0.095 + 0.08], { r: 0.008 });
    // 鉄の脚（脚と、座面を受ける横の枠と、床の足）
    for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) {
      p.box(fr, [x - 0.025, H - 0.06, -0.2], [x + 0.025, H - 0.035, 0.2], { r: 0.006 });
      p.tube(fr, [[x, 0.0, -0.17], [x, H - 0.06, -0.15]], 0.018, { sharp: true });
      p.tube(fr, [[x, 0.0, 0.17], [x, H - 0.06, 0.15]], 0.018, { sharp: true });
      p.box(fr, [x - 0.03, 0, -0.2], [x + 0.03, 0.015, 0.2], { r: 0.005 });
    }
  } else {
    p.box(seat, [-W / 2, H - 0.04, -0.2], [W / 2, H, 0.2], { r: 0.015 });
    for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) p.box(fr, [x - 0.12, 0, -0.17], [x + 0.12, H - 0.04, 0.17], { r: 0.02 });
  }
  p.collide([-W / 2, 0, -0.2], [W / 2, H, 0.2]);
}

/** 鉢植え（鉢の縁・土・葉の重なり。葉は細長い楕円を外へ傾けて放射状に） */
export function pottedPlant(p: Prop, o: { pot?: string; leaf?: string; soil?: string; h?: number; kind?: 'broad' | 'palm' } = {}): void {
  const pot = o.pot ?? '#e9ece6';
  const leaf = o.leaf ?? '#5f9a7d';
  const H = o.h ?? 1.1;
  const pr = 0.2;
  const ph = 0.32;
  p.lathe(pot, [[0, 0], [pr * 0.78, 0], [pr * 0.82, 0.02], [pr, ph - 0.03], [pr + 0.025, ph - 0.02], [pr + 0.025, ph], [pr - 0.02, ph], [pr - 0.02, ph - 0.03], [0, ph - 0.03]], [0, 0, 0], { seg: 20, collide: true });
  p.cyl(o.soil ?? '#5a4a3c', [0, ph - 0.035, 0], pr - 0.02, 0.01, { seg: 18, shadow: false });
  const n = o.kind === 'palm' ? 9 : 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + p.r() * 0.5;
    const t = i / n;
    const up = o.kind === 'palm' ? 0.5 + p.r() * 0.3 : 0.25 + (1 - t) * 0.9;
    const len = o.kind === 'palm' ? H * 0.5 : 0.18 + p.r() * 0.12;
    const y = ph + (o.kind === 'palm' ? H * 0.35 : (H - ph) * (0.25 + p.r() * 0.7));
    const c = p.r() < 0.35 ? shade(leaf, 0.35) : p.r() < 0.5 ? shade(leaf, -0.3) : leaf;
    const s = p.sub([Math.cos(a) * 0.05, y, Math.sin(a) * 0.05], -a + Math.PI / 2, { pitch: -(Math.PI / 2 - up) });
    // 葉: 板のように平たい楕円体（局所の +z へ伸びる）
    s.ball(c, [0, 0, len / 2], [o.kind === 'palm' ? 0.06 : len * 0.32, 0.008, len / 2], { seg: 10 });
  }
  // 茎（真ん中の数本）
  for (let k = 0; k < 3; k++) p.rod(shade(leaf, -0.5), [0, ph, 0], [(p.r() - 0.5) * 0.12, ph + (H - ph) * (0.5 + p.r() * 0.3), (p.r() - 0.5) * 0.12], 0.008, { shadow: false });
}

/** ごみ箱: 'round' = 丸い（投入口のある蓋）、'recycle' = 分別の箱（穴の形の違う 2〜3 口） */
export function trashBin(p: Prop, o: { kind?: 'round' | 'recycle'; body?: string; lid?: string; n?: number } = {}): void {
  const body = o.body ?? '#dfe5e2';
  const lid = o.lid ?? '#4c7f7c';
  if ((o.kind ?? 'round') === 'round') {
    const r = 0.21;
    const h = 0.68;
    p.lathe(body, [[0, 0], [r * 0.88, 0], [r * 0.9, 0.02], [r, h - 0.06], [r + 0.012, h - 0.05], [0, h - 0.05]], [0, 0, 0], { seg: 22, collide: true });
    p.lathe(lid, [[r + 0.02, h - 0.06], [r + 0.025, h - 0.02], [r * 0.9, h + 0.03], [r * 0.45, h + 0.05], [r * 0.45, h + 0.035], [0, h + 0.035]], [0, 0, 0], { seg: 22 });
    p.cyl('#141c1c', [0, h + 0.04, 0], r * 0.42, 0.02, { seg: 16, shadow: false });
    return;
  }
  const n = o.n ?? 3;
  const W = n * 0.36;
  p.box(body, [-W / 2, 0, -0.22], [W / 2, 0.85, 0.22], { r: 0.02, collide: true });
  const cols = [lid, '#3d78b8', '#d9a43a', '#c94a45'];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.18 + i * 0.36;
    // 上の板（色）と口（丸・細長・四角）
    p.box(cols[i % cols.length], [x - 0.17, 0.85, -0.22], [x + 0.17, 0.88, 0.22], { r: 0.008 });
    if (i % 3 === 0) p.cyl('#141c1c', [x, 0.882, 0.02], 0.055, 0.006, { seg: 16, shadow: false });
    else if (i % 3 === 1) p.box('#141c1c', [x - 0.11, 0.879, 0.0], [x + 0.11, 0.885, 0.04], { r: 0.004, shadow: false });
    else p.box('#141c1c', [x - 0.08, 0.879, -0.05], [x + 0.08, 0.885, 0.09], { r: 0.004, shadow: false });
    // 前の札と、扉の継ぎ目
    p.box('#f4f4ee', [x - 0.12, 0.62, 0.22], [x + 0.12, 0.74, 0.225], { shadow: false });
    p.box(cols[i % cols.length], [x - 0.12, 0.7, 0.225], [x + 0.12, 0.74, 0.228], { shadow: false });
    if (i > 0) p.box(shade(body, -0.6), [x - 0.182, 0.05, 0.22], [x - 0.178, 0.84, 0.226], { shadow: false });
  }
}

/** 消火器（赤い胴・肩の取っ手とレバー・圧力計・黒いホースとノズル・置き台） */
export function extinguisher(p: Prop, o: { stand?: boolean; red?: string; hose?: string; metal?: string } = {}): void {
  const red = o.red ?? '#c9504a';
  const metal = o.metal ?? '#c8d0cc';
  const dark = o.hose ?? '#1f2626';
  const r = 0.075;
  const h = 0.5;
  const base = o.stand === false ? 0 : 0.06;
  if (o.stand !== false) {
    p.box('#e9ece6', [-0.14, 0, -0.14], [0.14, 0.06, 0.14], { r: 0.01, collide: true });
    p.box(red, [-0.13, 0.06, -0.13], [0.13, 0.065, 0.13], { shadow: false });
  }
  const prof: V2[] = [[0, 0], [r * 0.9, 0], [r, 0.015], [r, h - 0.05], [r * 0.8, h - 0.015], [r * 0.3, h], [0, h]];
  p.lathe(red, prof, [0, base, 0], { seg: 18 });
  p.cyl(metal, [0, base + h + 0.02, 0], 0.025, 0.04, { seg: 10 });
  p.box(dark, [-0.015, base + h + 0.03, -0.07], [0.015, base + h + 0.05, 0.05], { r: 0.006 });
  p.box(metal, [-0.012, base + h + 0.06, -0.08], [0.012, base + h + 0.075, 0.04], { r: 0.005 });
  p.cyl('#f4f4ee', [0, base + h - 0.06, r - 0.005], 0.022, 0.012, { axis: 'z', seg: 12 });
  p.box('#f4f4ee', [-0.045, base + 0.18, r - 0.004], [0.045, base + 0.32, r + 0.002], { shadow: false });
  p.tube(dark, [[0.02, base + h + 0.03, -0.03], [0.07, base + h - 0.05, -0.08], [0.09, base + 0.25, -0.06], [0.07, base + 0.15, -0.03]], 0.01, { seg: 14 });
  p.cyl(dark, [0.07, base + 0.12, -0.03], 0.014, 0.06, { seg: 8 });
}

/** 椅子: 'stack' = 積み重ねの椅子（鉄の管の脚・樹脂の座と背）、'office' = 事務椅子（5 本脚・キャスター） */
export function chair(p: Prop, o: { kind?: 'stack' | 'office'; seat?: string; frame?: string; base?: string } = {}): void {
  const seat = o.seat ?? '#4c7f7c';
  const fr = o.frame ?? '#b7c1bd';
  if ((o.kind ?? 'stack') === 'stack') {
    for (const sx of [-1, 1]) {
      p.tube(fr, [[sx * 0.2, 0, 0.2], [sx * 0.21, 0.44, 0.18], [sx * 0.21, 0.44, -0.18], [sx * 0.2, 0, -0.2]], 0.011, { sharp: true });
      p.rod(fr, [sx * 0.21, 0.44, -0.18], [sx * 0.2, 0.84, -0.24], 0.011);
    }
    p.sub([0, 0.44, 0]).box(seat, [-0.22, 0, -0.2], [0.22, 0.03, 0.2], { r: 0.012 });
    p.sub([0, 0.62, -0.22], 0, { pitch: 0.12 }).box(seat, [-0.21, 0, -0.012], [0.21, 0.22, 0.012], { r: 0.01 });
    p.collide([-0.24, 0, -0.26], [0.24, 0.86, 0.22]);
    return;
  }
  const dark = o.base ?? '#2b3637';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const ex = Math.cos(a) * 0.3;
    const ez = Math.sin(a) * 0.3;
    p.rod(dark, [0, 0.12, 0], [ex, 0.06, ez], 0.016);
    p.ball(dark, [ex, 0.035, ez], 0.03, { seg: 8 });
  }
  p.cyl(fr, [0, 0.28, 0], 0.025, 0.32, { seg: 10 });
  p.box(seat, [-0.24, 0.44, -0.23], [0.24, 0.52, 0.24], { r: 0.035 });
  p.box(dark, [-0.03, 0.5, -0.27], [0.03, 0.7, -0.24], { r: 0.01 });
  p.sub([0, 0.62, -0.27], 0, { pitch: 0.1 }).box(seat, [-0.22, 0, -0.03], [0.22, 0.42, 0.03], { r: 0.035 });
  for (const sx of [-1, 1]) {
    p.rod(dark, [sx * 0.22, 0.5, -0.05], [sx * 0.23, 0.66, -0.02], 0.01);
    p.box(dark, [sx * 0.23 - 0.025, 0.66, -0.12], [sx * 0.23 + 0.025, 0.69, 0.1], { r: 0.012 });
  }
  p.collide([-0.3, 0, -0.32], [0.3, 1.05, 0.3]);
}
