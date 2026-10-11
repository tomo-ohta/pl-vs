import { Prop, shade, type V2 } from '../../../props/kit.ts';

/**
 * 海の見える教室の小物（教室・教材室・廊下・階段）。実寸と部位で作る。色は場所の色の表の「日の当たった色」で頼む
 * （陰・暗部の色は場所の材質の作り方 classroomMats が決める）。正面 +z、背 -z、床 y = 0。
 * 壁に掛ける物は壁の面が z = 0、物の中心が y = 0。
 * 校舎の間の通路（alley/props/school.ts）の机・椅子・ロッカーなどの作り方を写して、この場所の寸法と部位に直した。
 *
 * 寸法の根拠: 生徒用の机 天板 650 × 450・高さ 0.70 m（JIS S 1021 の 5.5 号に近い旧規格）・椅子 座の高さ 0.42 m、
 * 教卓 幅 1.0 m・高さ 0.95 m、黒板 3.6 × 1.2 m（下端 0.85 m）、掲示板 1.8 × 0.9 m、蛍光灯（逆富士の 2 灯）1.25 m、
 * スチールの書庫 0.88 × 0.4 × 1.8 m、教室の後ろのロッカー 高さ 1.05 m
 */

export const DARK = '#14283a';

/**
 * 影を落とさない座標系（椅子・机の物入れ）。床の日なたを細い脚の影だけで切る（参考画像の日なたは大きく、影は脚の細い筋と天板）
 */
export function noCast(p: Prop): Prop {
  const q = new Prop({ add: (g, m, s) => p.sink.add(g, m, s === true || s === 'cast' ? 'receive' : s), collide: (a, c) => p.sink.collide(a, c) }, p.mats, p.m.clone());
  (q as { r: () => number }).r = p.r;
  return q;
}
export const PAPER = '#d9eef0';

/**
 * 生徒用の机: 天板（縁の帯と化粧板）・物入れ（鉄板の箱。座る側 +z が開く）・鉄の管の脚・下の横棒・樹脂の足・横のフック。
 * 天板の上に教科書・プリントを乱数で
 */
export function schoolDesk(p: Prop, o: { top?: string; edge?: string; frame?: string; collide?: boolean; clutter?: number } = {}): void {
  const top = o.top ?? '#9ed5d0';
  const edge = o.edge ?? '#4f7f8c';
  const fr = o.frame ?? '#3d6a80';
  const W = 0.65;
  const D = 0.45;
  const H = 0.7;
  p.box(edge, [-W / 2, H - 0.026, -D / 2], [W / 2, H - 0.003, D / 2], { r: 0.006, seg: 1 });
  p.box(top, [-W / 2 + 0.008, H - 0.004, -D / 2 + 0.008], [W / 2 - 0.008, H, D / 2 - 0.008]);
  // 物入れ
  const by0 = 0.56;
  const by1 = H - 0.026;
  const box = shade(fr, -0.25);
  const nc = noCast(p);
  nc.box(box, [-0.285, by0, -0.2], [0.285, by0 + 0.008, 0.17]);
  nc.box(box, [-0.285, by0, -0.21], [0.285, by1, -0.2]);
  for (const s of [-1, 1]) nc.box(box, [s * 0.285 - 0.004, by0, -0.21], [s * 0.285 + 0.004, by1, 0.17]);
  // 脚（上の太い管・下の差し込み・足）と天板の下の横の枠
  for (const sx of [-1, 1]) {
    const x = sx * 0.3;
    for (const z of [-0.19, 0.19]) {
      p.rod(fr, [x, 0.34, z], [x, H - 0.026, z], 0.0125, { radial: 6 });
      p.rod(fr, [x, 0.014, z], [x, 0.35, z], 0.0098, { radial: 6 });
      p.cyl(DARK, [x, 0.008, z], 0.014, 0.016, { seg: 6 });
    }
    p.box(fr, [x - 0.012, H - 0.05, -0.21], [x + 0.012, H - 0.026, 0.21]);
    p.rod(fr, [x, 0.07, -0.19], [x, 0.07, 0.19], 0.0085, { radial: 6 });
  }
  p.rod(fr, [-0.3, 0.2, -0.19], [0.3, 0.2, -0.19], 0.0085, { radial: 6 });
  p.tube(DARK, [[0.31, 0.64, 0.05], [0.345, 0.64, 0.05], [0.345, 0.605, 0.05]], 0.004, { sharp: true, radial: 4, seg: 4 });
  // 天板の上（プリント・教科書）
  const k = o.clutter ?? 0;
  if (k > 0) {
    if (p.r() < k) {
      const s = p.sub([(p.r() - 0.5) * 0.25, H + 0.001, (p.r() - 0.5) * 0.12], (p.r() - 0.5) * 0.8);
      s.box(PAPER, [-0.105, 0, -0.148], [0.105, 0.002, 0.148], { shadow: false });
    }
    if (p.r() < k * 0.6) {
      const s = p.sub([(p.r() - 0.5) * 0.3, H + 0.001, (p.r() - 0.5) * 0.1], (p.r() - 0.5) * 0.6);
      s.box(PAPER, [-0.105, 0, -0.148], [0.105, 0.002, 0.148], { shadow: false });
      s.box('#3f6f9a', [-0.09, 0.002, -0.12], [0.09, 0.012, 0.12], { r: 0.002, seg: 1 });
    }
  }
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/**
 * 生徒用の椅子: 曲げた鉄の管（前の脚 → 座の下の枠 → 後ろの脚が 1 本・背の柱は角の丸い輪）・合板の座と背・横棒・足。
 * 参考画像の椅子は背の管が角の丸い四角の輪になっていて、その上の方に背の板が付く
 */
export function schoolChair(p: Prop, o: { seat?: string; frame?: string; back?: string; collide?: boolean } = {}): void {
  const seat = o.seat ?? '#9bccbd';
  // 背の板は座より暗い（参考画像の椅子は、明るい管の枠の中に暗い背の板）
  const back = o.back ?? shade(seat, -0.9);
  const fr = o.frame ?? '#3d6a80';
  const SH = 0.42;
  for (const s of [-1, 1]) {
    const x = s * 0.19;
    p.bend(fr, [[x, 0.012, 0.18], [x, SH - 0.03, 0.17], [x, SH - 0.03, -0.16], [x, 0.012, -0.18]], 0.0105, 0.04, { radial: 6 });
    for (const z of [0.18, -0.18]) p.cyl(DARK, [x, 0.008, z], 0.013, 0.016, { seg: 6 });
  }
  // 背の管: 座の後ろから立ち上がって、上で角を丸めて左右をつなぐ輪
  p.bend(fr, [[-0.19, SH - 0.03, -0.16], [-0.19, 0.8, -0.22], [0.19, 0.8, -0.22], [0.19, SH - 0.03, -0.16]], 0.0105, 0.06, { radial: 6 });
  p.rod(fr, [-0.19, 0.3, 0.17], [0.19, 0.3, 0.17], 0.0085, { radial: 6 });
  p.rod(fr, [-0.19, SH - 0.03, -0.16], [0.19, SH - 0.03, -0.16], 0.0085, { radial: 6 });
  // 座（角の丸い合板）と背の板（輪の上の方。少し倒れる）
  p.box(seat, [-0.2, SH - 0.016, -0.19], [0.2, SH + 0.01, 0.2], { r: 0.014, seg: 1 });
  p.sub([0, 0.66, -0.2], 0, { pitch: -0.15 }).box(back, [-0.18, 0, -0.011], [0.18, 0.13, 0.011], { r: 0.012, seg: 1 });
  if (o.collide !== false) p.collide([-0.21, 0, -0.23], [0.21, 0.8, 0.2]);
}

/** 机と椅子の組（椅子は机の座る側 +z に、少し引き出して）。tilt は椅子のずれ（乱数） */
export function deskSet(p: Prop, o: { top?: string; seat?: string; frame?: string; chairFrame?: string; edge?: string; pull?: number; clutter?: number; noChair?: boolean } = {}): void {
  schoolDesk(p, { top: o.top, frame: o.frame, edge: o.edge, clutter: o.clutter });
  if (o.noChair) return;
  const pull = o.pull ?? 0.22 + p.r() * 0.15;
  schoolChair(noCast(p).sub([(p.r() - 0.5) * 0.06, 0, pull], Math.PI + (p.r() - 0.5) * 0.25), { seat: o.seat, frame: o.chairFrame ?? o.frame });
}

/** 教卓（先生の机。生徒の側 +z）: 木の箱・天板のはみ出し・前の板の鏡板と額縁・台輪・後ろの棚と出席簿・チョークの箱 */
export function lectern(p: Prop, o: { wood?: string; top?: string; collide?: boolean } = {}): void {
  const wood = o.wood ?? '#6f9aa0';
  const top = o.top ?? '#8fbcbc';
  const W = 1.0;
  const D = 0.6;
  const H = 0.95;
  p.box(DARK, [-W / 2 + 0.03, 0, -D / 2 + 0.03], [W / 2 - 0.03, 0.07, D / 2 - 0.03]);
  for (const s of [-1, 1]) p.box(wood, [s < 0 ? -W / 2 : W / 2 - 0.024, 0, -D / 2], [s < 0 ? -W / 2 + 0.024 : W / 2, H - 0.03, D / 2], { r: 0.006, seg: 1 });
  p.box(wood, [-W / 2 + 0.02, 0.07, D / 2 - 0.022], [W / 2 - 0.02, H - 0.03, D / 2], { r: 0.004, seg: 1 });
  p.box(shade(wood, -0.25), [-W / 2 + 0.1, 0.17, D / 2], [W / 2 - 0.1, H - 0.13, D / 2 + 0.003]);
  for (const [a, c] of [
    [[-W / 2 + 0.08, H - 0.13], [W / 2 - 0.08, H - 0.11]],
    [[-W / 2 + 0.08, 0.15], [W / 2 - 0.08, 0.17]],
    [[-W / 2 + 0.08, 0.15], [-W / 2 + 0.1, H - 0.11]],
    [[W / 2 - 0.1, 0.15], [W / 2 - 0.08, H - 0.11]],
  ] as [V2, V2][]) {
    p.box(shade(wood, 0.25), [a[0], a[1], D / 2], [c[0], c[1], D / 2 + 0.012], { shadow: false });
  }
  p.box(top, [-W / 2 - 0.03, H - 0.03, -D / 2 - 0.03], [W / 2 + 0.03, H, D / 2 + 0.03], { r: 0.008, seg: 1 });
  p.box(wood, [-W / 2 + 0.02, 0.5, -D / 2 + 0.02], [W / 2 - 0.02, 0.52, D / 2 - 0.022]);
  p.box(DARK, [-W / 2 + 0.02, 0.07, D / 2 - 0.024], [W / 2 - 0.02, H - 0.03, D / 2 - 0.022], { shadow: false });
  for (let i = 0; i < 4; i++) {
    const x = -0.36 + i * 0.045;
    p.box(['#2f5a7a', '#cfe6e6', '#3f6f6a', '#6a4a5a'][i], [x, 0.52, -0.1], [x + 0.038, 0.82, 0.14], { r: 0.003, seg: 1 });
  }
  p.box('#2f4a66', [-0.32, H, -0.12], [-0.08, H + 0.03, 0.2], { r: 0.004, seg: 1 });
  p.box(PAPER, [-0.315, H + 0.004, -0.115], [-0.09, H + 0.026, 0.195]);
  p.box('#cfe6e2', [0.18, H, -0.05], [0.32, H + 0.05, 0.05], { r: 0.003, seg: 1 });
  for (let i = 0; i < 5; i++) p.cyl(['#e6f4f2', '#e6f4f2', '#d8d49a', '#d89a9a', '#e6f4f2'][i], [0.2 + i * 0.024, H + 0.055, 0], 0.0055, 0.08, { axis: 'z', seg: 6 });
  if (o.collide !== false) p.collide([-W / 2 - 0.03, 0, -D / 2 - 0.03], [W / 2 + 0.03, H, D / 2 + 0.03]);
}

/** 教壇（黒板の前の一段高い台。木の天板・縁の金物・蹴込み） */
export function platform(p: Prop, o: { w?: number; d?: number; h?: number; wood?: string } = {}): void {
  const W = o.w ?? 4.2;
  const D = o.d ?? 1.0;
  const H = o.h ?? 0.18;
  const wood = o.wood ?? '#5f8c94';
  p.box(shade(wood, -0.35), [-W / 2, 0, -D / 2], [W / 2, H - 0.02, D / 2]);
  p.box(wood, [-W / 2, H - 0.02, -D / 2], [W / 2, H, D / 2], { r: 0.006, seg: 1 });
  p.box('#8fb0b4', [-W / 2, H - 0.025, D / 2 - 0.004], [W / 2, H + 0.002, D / 2 + 0.01], { shadow: false });
  p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/**
 * 黒板（壁掛け。緑の盤面・アルミの枠・下のチョーク受け・チョークと黒板消し・上の掲示の溝・消し跡と書いた字の筋）。
 * 壁の面 z = 0、盤面の中心が y = 0
 */
export function blackboard(p: Prop, o: { w?: number; h?: number; board?: string; frame?: string; writing?: number } = {}): void {
  const W = o.w ?? 3.6;
  const H = o.h ?? 1.2;
  const board = o.board ?? '#1d4a44';
  const fr = o.frame ?? '#7fa3aa';
  p.box(board, [-W / 2, -H / 2, 0], [W / 2, H / 2, 0.02]);
  for (const s of [-1, 1]) {
    p.box(fr, [-W / 2 - 0.03, s < 0 ? -H / 2 - 0.03 : H / 2, 0], [W / 2 + 0.03, s < 0 ? -H / 2 : H / 2 + 0.03, 0.035], { r: 0.006, seg: 1 });
    p.box(fr, [s < 0 ? -W / 2 - 0.03 : W / 2, -H / 2, 0], [s < 0 ? -W / 2 : W / 2 + 0.03, H / 2, 0.035], { r: 0.006, seg: 1 });
  }
  // チョーク受け（前へ出た樋）
  p.extrude(fr, [[0, -H / 2 - 0.03], [0.09, -H / 2 - 0.03], [0.09, -H / 2 - 0.005], [0.075, -H / 2 - 0.005], [0.07, -H / 2 - 0.02], [0, -H / 2 - 0.02]], 'zy', -W / 2, W / 2, { bevel: 0.003 });
  for (let i = 0; i < 4; i++) p.cyl(['#e6f4f2', '#d8d49a', '#e6f4f2', '#d89a9a'][i], [-W / 2 + 0.4 + i * 0.07 + p.r() * 0.05, -H / 2 - 0.012, 0.05], 0.005, 0.07, { axis: 'x', seg: 6, shadow: false });
  p.box('#2e3e48', [W / 2 - 0.5, -H / 2 - 0.02, 0.03], [W / 2 - 0.36, -H / 2 + 0.02, 0.08], { r: 0.006, seg: 1 });
  // 消し跡（盤面より少し明るい、横に長いかすれ）と書いた字の筋
  const n = Math.round((o.writing ?? 0.6) * 9);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.2 + p.r() * (W - 0.6);
    const y = -H / 2 + 0.15 + p.r() * (H - 0.35);
    const w = 0.25 + p.r() * 0.6;
    p.box(shade(board, 0.25), [x, y, 0.02], [Math.min(x + w, W / 2 - 0.05), y + 0.012 + p.r() * 0.02, 0.022], { shadow: false });
  }
}

/** 掲示板（フェルトの板・アルミの枠・画鋲で留めた紙）。壁の面 z = 0、中心 y = 0。紙は乱数で */
export function noticeBoard(p: Prop, o: { w?: number; h?: number; felt?: string; frame?: string; papers?: number } = {}): void {
  const W = o.w ?? 1.8;
  const H = o.h ?? 0.9;
  const felt = o.felt ?? '#1d4448';
  const fr = o.frame ?? '#6f939c';
  p.box(felt, [-W / 2, -H / 2, 0], [W / 2, H / 2, 0.015]);
  for (const s of [-1, 1]) {
    p.box(fr, [-W / 2 - 0.02, s < 0 ? -H / 2 - 0.02 : H / 2, 0], [W / 2 + 0.02, s < 0 ? -H / 2 : H / 2 + 0.02, 0.025], { r: 0.004, seg: 1 });
    p.box(fr, [s < 0 ? -W / 2 - 0.02 : W / 2, -H / 2, 0], [s < 0 ? -W / 2 : W / 2 + 0.02, H / 2, 0.025], { r: 0.004, seg: 1 });
  }
  const n = o.papers ?? Math.round(W * H * 6);
  for (let i = 0; i < n; i++) {
    const big = p.r() < 0.35;
    const pw = big ? 0.297 : 0.21;
    const ph = big ? 0.42 : 0.297;
    const land = p.r() < 0.25;
    const w = land ? ph : pw;
    const h = land ? pw : ph;
    const x = -W / 2 + w / 2 + 0.03 + p.r() * Math.max(0.01, W - w - 0.06);
    const y = -H / 2 + h / 2 + 0.03 + p.r() * Math.max(0.01, H - h - 0.06);
    const s = p.sub([x, y, 0.016 + i * 0.0006], 0, { roll: (p.r() - 0.5) * 0.06 });
    s.box(i % 5 === 3 ? '#b9d8d8' : PAPER, [-w / 2, -h / 2, 0], [w / 2, h / 2, 0.0015], { shadow: false });
    // 文字の帯（題と本文の行）
    s.box('#5d8a96', [-w / 2 + 0.03, h / 2 - 0.06, 0.0016], [w / 2 - 0.03, h / 2 - 0.035, 0.0018], { shadow: false });
    for (let k = 0; k < 4; k++) s.box('#9fc3c8', [-w / 2 + 0.03, h / 2 - 0.1 - k * 0.04, 0.0016], [-w / 2 + 0.03 + (w - 0.06) * (0.5 + p.r() * 0.5), h / 2 - 0.09 - k * 0.04, 0.0018], { shadow: false });
    s.cyl('#c85a5a', [0, h / 2 - 0.015, 0.003], 0.006, 0.006, { axis: 'z', seg: 6, shadow: false });
  }
}

/** 紙 1 枚（壁に貼る。テープの跡・文字の帯）。壁の面 z = 0、中心 y = 0 */
export function poster(p: Prop, o: { w?: number; h?: number; paper?: string; ink?: string } = {}): void {
  const w = o.w ?? 0.297;
  const h = o.h ?? 0.42;
  p.box(o.paper ?? PAPER, [-w / 2, -h / 2, 0], [w / 2, h / 2, 0.0015], { shadow: false });
  const ink = o.ink ?? '#6f9aa4';
  p.box(ink, [-w / 2 + 0.03, h / 2 - 0.07, 0.0016], [w / 2 - 0.03, h / 2 - 0.04, 0.0018], { shadow: false });
  for (let k = 0; k < Math.floor(h / 0.05) - 3; k++) p.box('#a9cdd0', [-w / 2 + 0.03, h / 2 - 0.11 - k * 0.04, 0.0016], [-w / 2 + 0.03 + (w - 0.06) * (0.45 + p.r() * 0.55), h / 2 - 0.1 - k * 0.04, 0.0018], { shadow: false });
  for (const s of [-1, 1]) p.box('#e6f0e8', [s * w / 2 - 0.02, h / 2 - 0.015, 0.0017], [s * w / 2 + 0.02, h / 2 + 0.015, 0.002], { shadow: false });
}

/**
 * 蛍光灯（逆富士形の 2 灯。天井の面 y = 0、下へ）。本体の台形の箱・端の口金・管（光る/消えた）。
 * lit = false で消えた管（参考画像の天井の白い細い線）
 */
export function fluorescent(p: Prop, o: { len?: number; body?: string; tube?: string; lit?: boolean } = {}): void {
  const L = o.len ?? 1.25;
  const body = o.body ?? '#2f526c';
  const tube = o.tube ?? (o.lit ? '#e8fbff' : '#8fb7c8');
  // 本体（横から見た台形: 天井側が狭く、下が広い）
  p.extrude(body, [[-0.05, 0], [0.05, 0], [0.11, -0.06], [-0.11, -0.06]], 'xy', -L / 2, L / 2, { bevel: 0.004 });
  for (const s of [-1, 1]) {
    p.box(shade(body, 0.25), [-0.11, -0.075, s * L / 2 - s * 0.03 - 0.015], [0.11, -0.06, s * L / 2 - s * 0.03 + 0.015], { shadow: false });
    // 管は消えていても窓の光を映して淡く光る（参考画像の天井の白い細い線）
    p.cyl(tube, [s * 0.075, -0.083, 0], 0.0135, L - 0.08, { axis: 'z', seg: 8, kind: 'glow', shadow: false });
  }
}

/** 吊り下げの蛍光灯（2 本の吊り棒・反射の笠・管）。天井の面 y = 0、下へ drop */
export function pendantLight(p: Prop, o: { len?: number; drop?: number; body?: string; tube?: string } = {}): void {
  const L = o.len ?? 1.25;
  const drop = o.drop ?? 0.55;
  const body = o.body ?? '#24485e';
  for (const s of [-1, 1]) {
    p.rod(body, [0, 0, s * (L / 2 - 0.15)], [0, -drop, s * (L / 2 - 0.15)], 0.005, { radial: 4, shadow: false });
    p.cyl(body, [0, -0.008, s * (L / 2 - 0.15)], 0.03, 0.016, { seg: 8, shadow: false });
  }
  const s = p.sub([0, -drop, 0]);
  s.extrude(body, [[-0.03, 0], [0.03, 0], [0.13, -0.05], [0.12, -0.056], [-0.12, -0.056], [-0.13, -0.05]], 'xy', -L / 2, L / 2, { bevel: 0.003 });
  for (const k of [-1, 1]) s.cyl(o.tube ?? '#bfe6ef', [k * 0.06, -0.07, 0], 0.0135, L - 0.08, { axis: 'z', seg: 8, shadow: false });
}

/** 掛け時計（丸い枠・文字盤・目盛り・針）。壁の面 z = 0、中心 y = 0 */
export function wallClock(p: Prop, o: { rim?: string; face?: string; hour?: number; minute?: number } = {}): void {
  const rim = o.rim ?? '#9fc3c8';
  const face = o.face ?? '#d9eef0';
  const R = 0.155;
  p.cyl(rim, [0, 0, 0.022], R, 0.044, { axis: 'z', seg: 24 });
  p.torus(rim, [0, 0, 0.044], R - 0.008, 0.01, { axis: 'z', seg: 24 });
  p.cyl(face, [0, 0, 0.045], R - 0.016, 0.004, { axis: 'z', seg: 24 });
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0;
    p.sub([0, 0, 0.047], 0, { roll: (i / 12) * Math.PI * 2 }).box(DARK, [-(big ? 0.005 : 0.0025), R - (big ? 0.045 : 0.034), 0], [big ? 0.005 : 0.0025, R - 0.022, 0.002], { shadow: false });
  }
  const hr = o.hour ?? 3.3;
  const mn = o.minute ?? 0.45;
  p.sub([0, 0, 0.05], 0, { roll: -(hr / 12) * Math.PI * 2 }).box(DARK, [-0.006, -0.012, 0], [0.006, 0.075, 0.003], { shadow: false });
  p.sub([0, 0, 0.053], 0, { roll: -mn * Math.PI * 2 }).box(DARK, [-0.004, -0.015, 0], [0.004, 0.11, 0.003], { shadow: false });
  p.cyl(DARK, [0, 0, 0.056], 0.008, 0.006, { axis: 'z', seg: 8, shadow: false });
}

/** 校内放送のスピーカー（木の箱・前が下を向いて傾く・網の布・銘板）。壁の面 z = 0、中心 y = 0 */
export function wallSpeaker(p: Prop, o: { body?: string; cloth?: string } = {}): void {
  const body = o.body ?? '#355e74';
  const cloth = o.cloth ?? '#1a3446';
  p.extrude(body, [[0, -0.17], [0.15, -0.17], [0.2, 0.17], [0, 0.17]], 'zy', -0.2, 0.2, { bevel: 0.008 });
  const f = p.sub([0, 0, 0.17], 0, { pitch: 0.145 });
  f.box(cloth, [-0.17, -0.14, -0.002], [0.17, 0.135, 0.004], { r: 0.004, seg: 1, shadow: false });
  f.box('#7fa9b4', [-0.03, -0.125, 0.004], [0.03, -0.11, 0.007], { shadow: false });
}

/** 天井から下げたテレビ（ブラウン管の箱形: 前の枠・画面・後ろのふくらみ・下げる金物と柱） */
export function ceilingTv(p: Prop, o: { drop?: number; body?: string } = {}): void {
  const body = o.body ?? '#1f3a4e';
  const drop = o.drop ?? 0.45;
  p.box(body, [-0.33, -0.25, -0.3], [0.33, 0.25, 0.04], { r: 0.02, seg: 1 });
  p.box(shade(body, -0.2), [-0.22, -0.17, -0.48], [0.22, 0.17, -0.28], { r: 0.04, seg: 1 });
  p.box('#26465a', [-0.27, -0.2, 0.04], [0.27, 0.18, 0.045], { r: 0.02, seg: 1, shadow: false });
  p.box('#3f6f86', [-0.25, 0.04, 0.045], [-0.05, 0.16, 0.047], { shadow: false });
  // 下げる台（天井の板・柱・受けの板）
  p.box('#2c4c60', [-0.25, 0.25, -0.35], [0.25, 0.27, 0.0], { r: 0.004, seg: 1 });
  p.rod('#2c4c60', [0, 0.26, -0.18], [0, 0.26 + drop, -0.18], 0.025, { radial: 8 });
  p.cyl('#2c4c60', [0, 0.26 + drop - 0.01, -0.18], 0.08, 0.02, { seg: 12 });
}

/** 薄い色のスチールの書庫（両開きのガラス戸の上段・鉄の扉の下段・取っ手・台輪） */
export function steelCabinet(p: Prop, o: { w?: number; d?: number; h?: number; body?: string; glass?: boolean; collide?: boolean } = {}): void {
  const W = o.w ?? 0.88;
  const D = o.d ?? 0.4;
  const H = o.h ?? 1.1;
  const body = o.body ?? '#7fa7b6';
  p.box(DARK, [-W / 2 + 0.01, 0, -D / 2 + 0.02], [W / 2 - 0.01, 0.06, D / 2 - 0.03]);
  p.box(body, [-W / 2, 0.06, -D / 2], [W / 2, H, D / 2 - 0.012], { r: 0.008, seg: 1 });
  const split = o.glass ? H * 0.5 : H;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -W / 2 + 0.01 : 0.004;
    const x1 = s < 0 ? -0.004 : W / 2 - 0.01;
    p.box(shade(body, 0.12), [x0, 0.07, D / 2 - 0.014], [x1, split - 0.01, D / 2], { r: 0.004, seg: 1 });
    p.box('#d0e6ea', [s * 0.035 - 0.01, split * 0.55, D / 2], [s * 0.035 + 0.01, split * 0.55 + 0.12, D / 2 + 0.015], { r: 0.005, seg: 1 });
    if (o.glass) {
      p.box(shade(body, 0.12), [x0, split, D / 2 - 0.014], [x1, H - 0.01, D / 2 - 0.004], { r: 0.004, seg: 1 });
      p.box('#2a4a5e', [x0 + 0.03, split + 0.03, D / 2 - 0.003], [x1 - 0.03, H - 0.04, D / 2]);
    }
  }
  p.box(shade(body, 0.2), [-W / 2 - 0.005, H - 0.02, -D / 2], [W / 2 + 0.005, H, D / 2 + 0.004], { r: 0.004, seg: 1 });
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/**
 * 教室の後ろのロッカー（1 人 1 区画の扉の無い棚）: 天板・台輪・側板・棚板・仕切り・奥の板・名札。
 * 中身（区画ごとに乱数）: 寝かせたかばん・教科書の束・体操着の袋・空き
 */
export function cubbyLocker(p: Prop, o: { cols?: number; rows?: number; cw?: number; h?: number; d?: number; body?: string; collide?: boolean } = {}): void {
  const cols = o.cols ?? 9;
  const rows = o.rows ?? 2;
  const cw = o.cw ?? 0.6;
  const H = o.h ?? 1.05;
  const D = o.d ?? 0.45;
  const L = cols * cw;
  const body = o.body ?? '#6f9aa6';
  const inner = shade(body, -0.4);
  const t = 0.018;
  p.box(DARK, [-L / 2 + 0.01, 0, -D / 2 + 0.01], [L / 2 - 0.01, 0.08, D / 2 - 0.03]);
  p.box(body, [-L / 2 - 0.01, H - 0.025, -D / 2], [L / 2 + 0.01, H, D / 2 + 0.01], { r: 0.006, seg: 1 });
  p.box(inner, [-L / 2, 0.08, -D / 2], [L / 2, H - 0.025, -D / 2 + 0.012]);
  const ys: number[] = [];
  for (let r = 0; r <= rows; r++) ys.push(0.08 + (r * (H - 0.025 - 0.08)) / rows);
  for (let r = 0; r < rows; r++) p.box(body, [-L / 2, ys[r], -D / 2 + 0.012], [L / 2, ys[r] + t, D / 2]);
  for (let c = 0; c <= cols; c++) {
    const x = -L / 2 + c * cw;
    p.box(body, [x - t / 2, 0.08, -D / 2 + 0.012], [x + t / 2, H - 0.025, D / 2]);
  }
  const bags = ['#1d3348', '#22303a', '#2c4a66', '#4a3a48'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = -L / 2 + c * cw + t / 2;
      const x1 = x0 + cw - t;
      const y = ys[r] + t;
      const clear = ys[r + 1] - y;
      const xc = (x0 + x1) / 2;
      p.box(PAPER, [xc - 0.06, y - t, D / 2], [xc + 0.06, y - 0.004, D / 2 + 0.003], { shadow: false });
      const k = p.r();
      if (k < 0.3) {
        const s = p.sub([xc + (p.r() - 0.5) * 0.06, y, 0.0], (p.r() - 0.5) * 0.2);
        s.box(bags[Math.floor(p.r() * bags.length)], [-0.19, 0, -0.15], [0.19, 0.12, 0.15], { r: 0.035, seg: 1 });
        s.box(DARK, [-0.14, 0.119, -0.004], [0.14, 0.123, 0.004], { shadow: false });
      } else if (k < 0.55) {
        bookStack(p.sub([x0 + 0.04 + p.r() * 0.15, y, 0.02], (p.r() - 0.5) * 0.3), 2 + Math.floor(p.r() * 4), Math.min(clear - 0.04, 0.2));
      } else if (k < 0.7) {
        const s = p.sub([xc + (p.r() - 0.5) * 0.12, y, 0.02]);
        s.ball(['#2c4a66', '#4a3a48', '#2f5a52'][Math.floor(p.r() * 3)], [0, 0.08, 0], [0.15, 0.08, 0.13], { seg: 8 });
      }
    }
  }
  if (o.collide !== false) p.collide([-L / 2, 0, -D / 2], [L / 2, H, D / 2]);
}

/** 教科書・ノートの束（表紙・紙の小口）。局所: 底の中心 */
export function bookStack(p: Prop, n: number, maxH = 0.2): void {
  const covers = ['#2f5a7a', '#8a4a52', '#3f6f5a', '#b0a46a', '#5a4f7a', '#cfe6e6', '#22384a'];
  let y = 0;
  for (let i = 0; i < n && y < maxH; i++) {
    const w = 0.18 + p.r() * 0.05;
    const d = 0.25 + p.r() * 0.03;
    const th = 0.012 + p.r() * 0.02;
    const s = p.sub([(p.r() - 0.5) * 0.02, y, (p.r() - 0.5) * 0.02], (p.r() - 0.5) * 0.15);
    s.box(covers[Math.floor(p.r() * covers.length)], [-w / 2, 0, -d / 2], [w / 2, th, d / 2], { r: 0.002, seg: 1 });
    s.box(PAPER, [-w / 2 + 0.006, 0.002, -d / 2 + 0.004], [w / 2 + 0.001, th - 0.002, d / 2 + 0.001], { shadow: false });
    y += th;
  }
}

/** 掃除用具入れ（スチールの縦長の物入れ: 両開きの扉・上下の通気の切り欠き・取っ手・札・台輪） */
export function cleaningCabinet(p: Prop, o: { w?: number; d?: number; h?: number; body?: string; collide?: boolean } = {}): void {
  const W = o.w ?? 0.7;
  const D = o.d ?? 0.5;
  const H = o.h ?? 1.8;
  const door = o.body ?? '#6f9aa6';
  p.box(DARK, [-W / 2 + 0.01, 0, -D / 2 + 0.02], [W / 2 - 0.01, 0.05, D / 2 - 0.03]);
  p.box(shade(door, -0.3), [-W / 2, 0.05, -D / 2], [W / 2, H, D / 2 - 0.01], { r: 0.006, seg: 1 });
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -W / 2 + 0.008 : 0.003;
    const x1 = s < 0 ? -0.003 : W / 2 - 0.008;
    const xc = (x0 + x1) / 2;
    p.box(door, [x0, 0.06, D / 2 - 0.012], [x1, H - 0.012, D / 2], { r: 0.004, seg: 1 });
    for (const y of [H - 0.16, 0.2]) for (let k = 0; k < 5; k++) p.box(DARK, [xc - 0.1, y + k * 0.022, D / 2], [xc + 0.1, y + k * 0.022 + 0.007, D / 2 + 0.002], { shadow: false });
    p.box('#a9cdd4', [s * 0.03 - 0.012, H * 0.48, D / 2], [s * 0.03 + 0.012, H * 0.48 + 0.16, D / 2 + 0.018], { r: 0.006, seg: 1 });
  }
  p.box(PAPER, [-0.14, H - 0.42, D / 2], [0.14, H - 0.32, D / 2 + 0.004], { shadow: false });
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/** 窓の下の暖房（古い温水の放熱器: ひれの並ぶ箱・上の格子・脚・配管） */
export function radiator(p: Prop, o: { w?: number; h?: number; d?: number; body?: string } = {}): void {
  const W = o.w ?? 1.2;
  const H = o.h ?? 0.5;
  const D = o.d ?? 0.18;
  const body = o.body ?? '#3f6f84';
  p.box(body, [-W / 2, 0.1, -D / 2], [W / 2, H, D / 2], { r: 0.01, seg: 1 });
  const n = Math.floor(W / 0.06);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    p.box(shade(body, -0.35), [x - 0.008, 0.14, D / 2], [x + 0.008, H - 0.04, D / 2 + 0.004], { shadow: false });
  }
  for (const s of [-1, 1]) p.box(shade(body, -0.3), [s * (W / 2 - 0.06) - 0.02, 0, -D / 2 + 0.02], [s * (W / 2 - 0.06) + 0.02, 0.1, D / 2 - 0.02]);
  p.tube('#2c4c5e', [[W / 2, 0.3, 0], [W / 2 + 0.08, 0.3, 0], [W / 2 + 0.08, 0.02, -0.02]], 0.014, { sharp: true });
}

/** 段ボール箱（ふたの合わせ目・テープ・ラベル）。局所: 底の中心 */
export function carton(p: Prop, o: { w?: number; h?: number; d?: number; col?: string } = {}): void {
  const w = o.w ?? 0.4;
  const h = o.h ?? 0.3;
  const d = o.d ?? 0.3;
  const col = o.col ?? '#8fa8a4';
  p.box(col, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], { r: 0.006, seg: 1 });
  p.box(shade(col, -0.35), [-0.003, h - 0.001, -d / 2], [0.003, h + 0.001, d / 2], { shadow: false });
  p.box(shade(col, 0.2), [-0.025, h, -d / 2 - 0.001], [0.025, h + 0.002, d / 2 + 0.001], { shadow: false });
  p.box(shade(col, 0.2), [-0.025, h - 0.08, d / 2], [0.025, h, d / 2 + 0.002], { shadow: false });
  p.box(PAPER, [-w / 4, h * 0.35, d / 2], [w / 4, h * 0.6, d / 2 + 0.002], { shadow: false });
}

/** 地球儀（台・弧の金物・球） */
export function globe(p: Prop): void {
  p.lathe('#2c4c60', [[0, 0], [0.09, 0], [0.09, 0.015], [0.03, 0.03], [0.015, 0.2], [0, 0.2]], [0, 0, 0], { seg: 16 });
  p.sub([0, 0.36, 0], 0, { roll: 0.41 }).torus('#7fa9b4', [0, 0, 0], 0.17, 0.006, { axis: 'z', arc: Math.PI * 1.2, seg: 16 });
  p.ball('#4f8fa0', [0, 0.36, 0], 0.15, { seg: 16 });
  p.ball('#8fc0b0', [0.05, 0.4, 0.09], [0.07, 0.05, 0.05], { seg: 8 });
}

/** スチールの棚（4 本の柱・棚板・筋交い）。棚板ごとの中身は呼ぶ側の関数 */
export function steelRack(p: Prop, o: { w?: number; d?: number; h?: number; levels?: number; col?: string; fill?: (s: Prop, w: number, d: number, clear: number, i: number) => void; collide?: boolean } = {}): void {
  const W = o.w ?? 1.2;
  const D = o.d ?? 0.45;
  const H = o.h ?? 1.8;
  const n = o.levels ?? 4;
  const col = o.col ?? '#5f8a9a';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(col, [sx * W / 2 - (sx > 0 ? 0.03 : 0), 0, sz * D / 2 - (sz > 0 ? 0.03 : 0)], [sx * W / 2 + (sx < 0 ? 0.03 : 0), H, sz * D / 2 + (sz < 0 ? 0.03 : 0)]);
  for (let i = 0; i < n; i++) {
    const y = 0.08 + (i * (H - 0.1)) / (n - 1);
    p.box(shade(col, 0.1), [-W / 2, y, -D / 2], [W / 2, y + 0.025, D / 2], { r: 0.003, seg: 1 });
    if (o.fill && i < n - 1) o.fill(p.sub([0, y + 0.025, 0]), W - 0.06, D - 0.06, (H - 0.1) / (n - 1) - 0.04, i);
  }
  for (const sz of [-1, 1]) p.rod(shade(col, -0.2), [-W / 2 + 0.015, 0.1, sz * (D / 2 - 0.015)], [W / 2 - 0.015, H - 0.1, sz * (D / 2 - 0.015)], 0.005, { radial: 4, shadow: false });
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/** 書類の箱（ファイルボックス: 背のラベルと指穴） */
export function fileBox(p: Prop, o: { col?: string; h?: number } = {}): void {
  const col = o.col ?? '#cfe6e6';
  const h = o.h ?? 0.3;
  p.box(col, [-0.05, 0, -0.15], [0.05, h, 0.15], { r: 0.004, seg: 1 });
  p.box(PAPER, [-0.035, h * 0.55, 0.15], [0.035, h * 0.85, 0.152], { shadow: false });
  p.cyl(DARK, [0, h * 0.25, 0.151], 0.012, 0.004, { axis: 'z', seg: 8, shadow: false });
}

/**
 * 廊下のスチールロッカー（2 段・扉ごとに通気の切り欠き・取っ手・名札入れ）。cols 列 × rows 段、扉の幅 cw。
 * 本体は扉より 1 段暗く、扉の継ぎ目が見える。開いた扉（乱数）から中のかばん
 */
export function steelLocker(p: Prop, o: { cols?: number; rows?: number; cw?: number; h?: number; d?: number; body?: string; collide?: boolean } = {}): void {
  const cols = o.cols ?? 8;
  const rows = o.rows ?? 2;
  const cw = o.cw ?? 0.385;
  const H = o.h ?? 1.0;
  const D = o.d ?? 0.36;
  const L = cols * cw;
  const door = o.body ?? '#6f9aa6';
  const body = shade(door, -0.3);
  p.box(DARK, [-L / 2 + 0.01, 0, -D / 2 + 0.02], [L / 2 - 0.01, 0.05, D / 2 - 0.03]);
  p.box(body, [-L / 2, 0.05, -D / 2], [L / 2, H - 0.012, D / 2 - 0.008]);
  p.box(door, [-L / 2 - 0.004, H - 0.014, -D / 2], [L / 2 + 0.004, H, D / 2 + 0.006], { r: 0.004, seg: 1 });
  const dh = (H - 0.07) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x0 = -L / 2 + c * cw + 0.004;
      const x1 = x0 + cw - 0.008;
      const y0 = 0.055 + r * dh + 0.003;
      const y1 = y0 + dh - 0.006;
      const xc = (x0 + x1) / 2;
      const open = p.r() < 0.12;
      if (open) {
        // 開いた扉（吊り元で 70° ほど開く）と、中のかばん
        p.sub([x0, (y0 + y1) / 2, D / 2], -1.2).box(door, [0, -(y1 - y0) / 2, 0], [cw - 0.008, (y1 - y0) / 2, 0.012], { r: 0.003, seg: 1 });
        p.box(DARK, [x0 + 0.01, y0 + 0.01, -D / 2 + 0.02], [x1 - 0.01, y1 - 0.01, -D / 2 + 0.03], { shadow: false });
        p.box(['#1d3348', '#2c4a66', '#4a3a48'][Math.floor(p.r() * 3)], [xc - 0.13, y0 + 0.01, -0.12], [xc + 0.13, y0 + 0.24, 0.1], { r: 0.03, seg: 1 });
        continue;
      }
      p.box(door, [x0, y0, D / 2 - 0.01], [x1, y1, D / 2], { r: 0.003, seg: 1 });
      for (let k = 0; k < 3; k++) p.box(DARK, [xc - 0.07, y1 - 0.05 - k * 0.022, D / 2], [xc + 0.07, y1 - 0.043 - k * 0.022, D / 2 + 0.002], { shadow: false });
      p.box('#a9cdd4', [x1 - 0.06, y0 + dh * 0.38, D / 2], [x1 - 0.03, y0 + dh * 0.38 + 0.08, D / 2 + 0.012]);
      p.box(PAPER, [xc - 0.06, y1 - 0.135, D / 2], [xc + 0.03, y1 - 0.105, D / 2 + 0.004], { shadow: false });
    }
  }
  if (o.collide !== false) p.collide([-L / 2, 0, -D / 2], [L / 2, H, D / 2]);
}

/** 壁のフック掛け（横木と金具・掛けた袋や雨具） */
export function hookRail(p: Prop, o: { w?: number; n?: number; wood?: string } = {}): void {
  const W = o.w ?? 1.8;
  const n = o.n ?? 8;
  const wood = o.wood ?? '#5f8c94';
  p.box(wood, [-W / 2, -0.04, 0], [W / 2, 0.04, 0.02], { r: 0.004, seg: 1 });
  const cols = ['#2c4a66', '#4a3a48', '#2f5a52', '#5a7a8a', '#cfe6e6'];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    p.tube('#a9cdd4', [[x, 0, 0.02], [x, 0, 0.06], [x, 0.03, 0.07]], 0.005, { sharp: true, radial: 4, seg: 4, shadow: false });
    if (p.r() < 0.55) {
      const c = cols[Math.floor(p.r() * cols.length)];
      const s = p.sub([x, -0.02, 0.05], (p.r() - 0.5) * 0.2);
      s.box(c, [-0.12, -0.42, -0.025], [0.12, -0.05, 0.025], { r: 0.022, seg: 1 });
      s.tube(shade(c, -0.3), [[-0.06, -0.06, 0], [0, 0.02, 0], [0.06, -0.06, 0]], 0.004, { radial: 4, seg: 6, shadow: false });
    }
  }
}

/**
 * 子どもの絵・習字の列（画用紙を横に並べて貼る。紙ごとに色の塊と線）。壁の面 z = 0、中心 y = 0。幅 W に n 枚
 */
export function artRow(p: Prop, o: { w?: number; n?: number; h?: number; kind?: 'draw' | 'calli' } = {}): void {
  const W = o.w ?? 2.4;
  const n = o.n ?? 6;
  const h = o.h ?? 0.38;
  const pw = (W / n) * 0.86;
  const blobs = ['#4f8fa8', '#6faab0', '#2f5a7a', '#8fb8a8', '#5a7a9a', '#b0c8b8'];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    const s = p.sub([x, (p.r() - 0.5) * 0.03, 0.001 + i * 0.0004], 0, { roll: (p.r() - 0.5) * 0.04 });
    s.box(PAPER, [-pw / 2, -h / 2, 0], [pw / 2, h / 2, 0.0015], { shadow: false });
    if (o.kind === 'calli') {
      // 習字: 縦の太い墨の字 2〜3 つと名前
      for (let k = 0; k < 2 + Math.floor(p.r() * 2); k++) s.box('#1a2e3e', [-0.03, h / 2 - 0.08 - k * 0.11, 0.0016], [0.03, h / 2 - 0.02 - k * 0.11, 0.0018], { shadow: false });
      s.box('#1a2e3e', [pw / 2 - 0.04, -h / 2 + 0.04, 0.0016], [pw / 2 - 0.025, -h / 2 + 0.14, 0.0018], { shadow: false });
    } else {
      // 絵: 色の塊 3〜4 つ（空・地面・人や物）
      s.box(blobs[Math.floor(p.r() * blobs.length)], [-pw / 2 + 0.015, h * 0.05, 0.0016], [pw / 2 - 0.015, h / 2 - 0.015, 0.0017], { shadow: false });
      s.box(blobs[Math.floor(p.r() * blobs.length)], [-pw / 2 + 0.015, -h / 2 + 0.015, 0.0016], [pw / 2 - 0.015, -h * 0.1, 0.0017], { shadow: false });
      for (let k = 0; k < 2; k++) {
        const cx = (p.r() - 0.5) * pw * 0.6;
        const cy = (p.r() - 0.5) * h * 0.4;
        s.box(blobs[Math.floor(p.r() * blobs.length)], [cx - 0.03, cy - 0.04, 0.0018], [cx + 0.03, cy + 0.05, 0.0019], { shadow: false });
      }
    }
  }
}

/**
 * 寄せた机と椅子の山（使わない机を廊下・踊り場の壁ぎわに積む）。机 n 台（2 段目は逆さに重ねる）と、椅子を机の上や横に。
 * 局所: 床の中心、壁は -z 側
 */
export function deskPile(p: Prop, o: { n?: number; top?: string; edge?: string; frame?: string; seat?: string } = {}): void {
  const n = o.n ?? 3;
  const dk = { top: o.top, edge: o.edge, frame: o.frame, collide: false };
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.68 + (p.r() - 0.5) * 0.05;
    schoolDesk(p.sub([x, 0, (p.r() - 0.5) * 0.06], (p.r() - 0.5) * 0.12), dk);
    // 上に逆さの机（脚が上）か、椅子を座面を下に
    if (p.r() < 0.55) schoolDesk(p.sub([x + (p.r() - 0.5) * 0.06, 1.41, 0], (p.r() - 0.5) * 0.15, { roll: Math.PI }), dk);
    else schoolChair(p.sub([x, 0.7 + 0.8, 0.02], Math.PI + (p.r() - 0.5) * 0.4, { roll: Math.PI }), { seat: o.seat, frame: o.frame, collide: false });
  }
  // 横に積んだ椅子（2〜3 脚）
  const cx = (n / 2) * 0.68 + 0.3;
  for (let k = 0; k < 2 + Math.floor(p.r() * 2); k++) schoolChair(p.sub([cx, k * 0.05, 0.05], (p.r() - 0.5) * 0.2), { seat: o.seat, frame: o.frame, collide: false });
  p.collide([-(n / 2) * 0.68 - 0.05, 0, -0.25], [cx + 0.25, 1.45, 0.3]);
}

/**
 * 天井から垂れたケーブル（外れた配線が 2 点の間でたるむ）と、天井の接続箱・感知器。局所: 天井の面 y = 0、ケーブルは +z の向き len m
 */
export function saggingCable(p: Prop, o: { len?: number; sag?: number; col?: string; tail?: boolean } = {}): void {
  const L = o.len ?? 2.4;
  const sag = o.sag ?? 0.5;
  const col = o.col ?? '#4f7f96';
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([Math.sin(t * 3.1) * 0.05, -0.04 - Math.sin(t * Math.PI) * sag, t * L]);
  }
  p.tube(col, pts, 0.008, { radial: 5, seg: 24, shadow: false });
  // 片方の端が外れて垂れる
  if (o.tail) p.tube(col, [[0, -0.04, L], [0.08, -0.25, L + 0.15], [0.05, -0.32, L + 0.4]], 0.008, { radial: 5, seg: 12, shadow: false });
  for (const z of [0, L]) p.box('#4f7f96', [-0.06, -0.05, z - 0.06], [0.06, 0, z + 0.06], { r: 0.008, seg: 1, shadow: false });
  // 感知器（丸い皿）
  p.cyl('#cfe6e6', [0.4, -0.02, L / 2], 0.06, 0.04, { seg: 12, shadow: false });
}
