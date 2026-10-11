import { shade, type Prop, type V2 } from '../../../props/kit.ts';

/**
 * 校舎の中の小物（教室・廊下）。実物の寸法と部位で作り、色は実物の色で頼む（場所の色へは alleyMats が写す）。
 * 正面 +z、背 -z、床 y = 0（壁に掛ける物は、壁の面が z = 0・物の中心が y = 0）。
 * 寸法の根拠: 生徒用の机 天板 600 × 400・高さ 0.71 m（JIS S 1021 の 5.5 号）・椅子 座の高さ 0.43 m、教卓 幅 0.9〜1.0 m・高さ 0.9〜1.0 m、
 * 教室の後ろのロッカー 高さ 1.0〜1.1 m・奥行き 0.45 m・1 人 1 区画、廊下のスチールロッカー 2 段・扉の幅 0.38 m、
 * 掃除用具入れ 0.7 × 0.5 × 1.8 m、傘立て 高さ 0.5 m、ほうき 1.3 m・モップ 1.3 m・バケツ 10 L（口の直径 0.3 m）
 */

const DARK = '#2b302e';
const PAPER = '#eeede4';

/** 生徒用の机: 天板（縁の樹脂の帯と化粧板）・物入れ（座る側 +z が開く鉄板の箱）・鉄の管の脚（下の差し込みとカラー）・下の横棒・樹脂の足・横のフック */
export function schoolDesk(p: Prop, o: { top?: string; edge?: string; frame?: string; collide?: boolean } = {}): void {
  const top = o.top ?? '#d8c6a0';
  const edge = o.edge ?? '#7b705c';
  const fr = o.frame ?? '#8e9994';
  const W = 0.6;
  const D = 0.44;
  const H = 0.71;
  // 天板: 縁の帯（厚さ 2.2 cm）の上に化粧板
  p.box(edge, [-W / 2, H - 0.024, -D / 2], [W / 2, H - 0.002, D / 2], { r: 0.006, seg: 1 });
  p.box(top, [-W / 2 + 0.01, H - 0.004, -D / 2 + 0.01], [W / 2 - 0.01, H, D / 2 - 0.01]);
  // 物入れ（底・奥・横の鉄板）
  const by0 = 0.57;
  const by1 = H - 0.024;
  p.box(fr, [-0.265, by0, -0.19], [0.265, by0 + 0.008, 0.16]);
  p.box(fr, [-0.265, by0, -0.2], [0.265, by1, -0.19]);
  for (const s of [-1, 1]) p.box(fr, [s * 0.265 - 0.004, by0, -0.2], [s * 0.265 + 0.004, by1, 0.16]);
  // 脚（上の太い管・下の差し込み・カラー・足）と天板の下の横の枠
  for (const sx of [-1, 1]) {
    const x = sx * 0.28;
    for (const z of [-0.185, 0.185]) {
      p.rod(fr, [x, 0.34, z], [x, H - 0.024, z], 0.0125, { radial: 6 });
      p.rod(fr, [x, 0.014, z], [x, 0.35, z], 0.0098, { radial: 6 });
      p.cyl(DARK, [x, 0.008, z], 0.014, 0.016, { seg: 6 });
    }
    p.box(fr, [x - 0.012, H - 0.05, -0.2], [x + 0.012, H - 0.024, 0.2]);
    p.rod(fr, [x, 0.07, -0.185], [x, 0.07, 0.185], 0.0085, { radial: 6 });
  }
  // 奥の横棒（足をのせる）・横のフック（袋を掛ける）
  p.rod(fr, [-0.28, 0.2, -0.185], [0.28, 0.2, -0.185], 0.0085, { radial: 6 });
  p.tube(DARK, [[0.29, 0.65, 0.05], [0.325, 0.65, 0.05], [0.325, 0.615, 0.05]], 0.004, { sharp: true, radial: 4, seg: 4 });
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/** 生徒用の椅子: 曲げた鉄の管（前の脚と座の下の枠と後ろの脚が 1 本・後ろの脚が背の柱へ伸びる）・合板の座と背・横棒・足 */
export function schoolChair(p: Prop, o: { seat?: string; frame?: string; collide?: boolean } = {}): void {
  const seat = o.seat ?? '#c9b087';
  const fr = o.frame ?? '#8e9994';
  const SH = 0.43;
  for (const s of [-1, 1]) {
    const x = s * 0.185;
    // 1 本の曲げた管（角は細いので継ぎ目の玉は付けない）
    p.rod(fr, [x, 0.012, 0.17], [x, SH - 0.03, 0.165], 0.0105, { radial: 6 });
    p.rod(fr, [x, SH - 0.03, 0.175], [x, SH - 0.03, -0.165], 0.0105, { radial: 6 });
    p.rod(fr, [x, SH - 0.03, -0.155], [x, 0.012, -0.175], 0.0105, { radial: 6 });
    p.rod(fr, [x, SH - 0.03, -0.155], [x, 0.8, -0.21], 0.0105, { radial: 6 });
    for (const z of [0.17, -0.175]) p.cyl(DARK, [x, 0.008, z], 0.013, 0.016, { seg: 6 });
  }
  p.rod(fr, [-0.185, 0.3, 0.165], [0.185, 0.3, 0.165], 0.0085, { radial: 6 });
  p.rod(fr, [-0.185, SH - 0.03, -0.155], [0.185, SH - 0.03, -0.155], 0.0085, { radial: 6 });
  // 座（角の丸い合板）と背（後ろの柱に沿って少し倒れる）
  p.box(seat, [-0.2, SH - 0.016, -0.19], [0.2, SH + 0.01, 0.2], { r: 0.012, seg: 1 });
  p.sub([0, 0.6, -0.185], 0, { pitch: -0.135 }).box(seat, [-0.195, 0, -0.011], [0.195, 0.17, 0.011], { r: 0.01, seg: 1 });
  if (o.collide !== false) p.collide([-0.21, 0, -0.22], [0.21, 0.8, 0.2]);
}

/** 教卓（先生の机。生徒の側 +z）: 木の箱・天板のはみ出し・前の板の額縁と鏡板・台輪・後ろの棚と出席簿・チョークの箱 */
export function lectern(p: Prop, o: { wood?: string; top?: string; collide?: boolean } = {}): void {
  const wood = o.wood ?? '#b79a6a';
  const top = o.top ?? '#cdb183';
  const W = 1.0;
  const D = 0.6;
  const H = 0.98;
  p.box(DARK, [-W / 2 + 0.03, 0, -D / 2 + 0.03], [W / 2 - 0.03, 0.07, D / 2 - 0.03]);
  for (const s of [-1, 1]) p.box(wood, [s < 0 ? -W / 2 : W / 2 - 0.024, 0, -D / 2], [s < 0 ? -W / 2 + 0.024 : W / 2, H - 0.03, D / 2], { r: 0.006, seg: 1 });
  p.box(wood, [-W / 2 + 0.02, 0.07, D / 2 - 0.022], [W / 2 - 0.02, H - 0.03, D / 2], { r: 0.004, seg: 1 });
  // 前の板の鏡板（1 段へこむ）と額縁
  p.box(shade(wood, -0.25), [-W / 2 + 0.1, 0.17, D / 2], [W / 2 - 0.1, H - 0.13, D / 2 + 0.003]);
  for (const [a, c] of [
    [[-W / 2 + 0.08, H - 0.13], [W / 2 - 0.08, H - 0.11]],
    [[-W / 2 + 0.08, 0.15], [W / 2 - 0.08, 0.17]],
    [[-W / 2 + 0.08, 0.15], [-W / 2 + 0.1, H - 0.11]],
    [[W / 2 - 0.1, 0.15], [W / 2 - 0.08, H - 0.11]],
  ] as [V2, V2][]) {
    p.box(shade(wood, 0.25), [a[0], a[1], D / 2], [c[0], c[1], D / 2 + 0.012], { shadow: false });
  }
  // 天板（四方へ 3 cm はみ出す）
  p.box(top, [-W / 2 - 0.03, H - 0.03, -D / 2 - 0.03], [W / 2 + 0.03, H, D / 2 + 0.03], { r: 0.008, seg: 1 });
  // 後ろ（先生の側）は開いて棚: 棚板・奥の暗い面・棚の上のファイル
  p.box(wood, [-W / 2 + 0.02, 0.5, -D / 2 + 0.02], [W / 2 - 0.02, 0.52, D / 2 - 0.022]);
  p.box(shade(wood, -0.6), [-W / 2 + 0.02, 0.07, D / 2 - 0.024], [W / 2 - 0.02, H - 0.03, D / 2 - 0.022], { shadow: false });
  for (let i = 0; i < 4; i++) {
    const x = -0.36 + i * 0.045;
    p.box(['#33506e', '#e6e2d4', '#4c6b4f', '#7a3e3a'][i], [x, 0.52, -0.1], [x + 0.038, 0.82, 0.14], { r: 0.003, seg: 1 });
  }
  // 天板の上: 出席簿（閉じたファイル）とチョークの箱
  p.box('#30465e', [-0.32, H, -0.12], [-0.08, H + 0.03, 0.2], { r: 0.004, seg: 1 });
  p.box(PAPER, [-0.315, H + 0.004, -0.115], [-0.09, H + 0.026, 0.195]);
  p.box('#e8e3d0', [0.18, H, -0.05], [0.32, H + 0.05, 0.05], { r: 0.003, seg: 1 });
  for (let i = 0; i < 5; i++) p.cyl(['#f4f2ea', '#f4f2ea', '#e2c94e', '#d8706a', '#f4f2ea'][i], [0.2 + i * 0.024, H + 0.055, 0], 0.0055, 0.08, { axis: 'z', seg: 6 });
  if (o.collide !== false) p.collide([-W / 2 - 0.03, 0, -D / 2 - 0.03], [W / 2 + 0.03, H, D / 2 + 0.03]);
}

/** 掛け時計（丸い枠・文字盤・目盛り・針）。壁の面 z = 0、中心 y = 0 */
export function wallClock(p: Prop, o: { rim?: string; face?: string; hour?: number; minute?: number } = {}): void {
  const rim = o.rim ?? '#d9ddd8';
  const face = o.face ?? '#f4f3ec';
  const R = 0.155;
  p.cyl(rim, [0, 0, 0.022], R, 0.044, { axis: 'z', seg: 24 });
  p.torus(rim, [0, 0, 0.044], R - 0.008, 0.01, { axis: 'z', seg: 24 });
  p.cyl(face, [0, 0, 0.045], R - 0.016, 0.004, { axis: 'z', seg: 24 });
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0;
    p.sub([0, 0, 0.047], 0, { roll: (i / 12) * Math.PI * 2 }).box(DARK, [-(big ? 0.005 : 0.0025), R - (big ? 0.045 : 0.034), 0], [big ? 0.005 : 0.0025, R - 0.022, 0.002], { shadow: false });
  }
  const hr = o.hour ?? 4.2;
  const mn = o.minute ?? 0.62;
  p.sub([0, 0, 0.05], 0, { roll: -(hr / 12) * Math.PI * 2 }).box(DARK, [-0.006, -0.012, 0], [0.006, 0.075, 0.003], { shadow: false });
  p.sub([0, 0, 0.053], 0, { roll: -mn * Math.PI * 2 }).box(DARK, [-0.004, -0.015, 0], [0.004, 0.11, 0.003], { shadow: false });
  p.cyl(DARK, [0, 0, 0.056], 0.008, 0.006, { axis: 'z', seg: 8, shadow: false });
}

/** 校内放送のスピーカー（木の箱・前が下を向いて傾く・網の布・銘板）。壁の面 z = 0、中心 y = 0 */
export function wallSpeaker(p: Prop, o: { body?: string; cloth?: string } = {}): void {
  const body = o.body ?? '#b49a72';
  const cloth = o.cloth ?? '#4a4c48';
  // 横から見た輪郭（上ほど前へ出る = 前の面が下を向く）
  p.extrude(body, [[0, -0.15], [0.13, -0.15], [0.17, 0.15], [0, 0.15]], 'zy', -0.17, 0.17, { bevel: 0.008 });
  const f = p.sub([0, 0, 0.15], 0, { pitch: 0.133 });
  f.box(cloth, [-0.145, -0.125, -0.002], [0.145, 0.12, 0.004], { r: 0.004, seg: 1, shadow: false });
  f.box('#c9b98c', [-0.03, -0.112, 0.004], [0.03, -0.098, 0.007], { shadow: false });
}

/** 天井から下げたテレビ（薄型・枠・画面・背の出っ張り・下げる柱と受け金物） */
export function ceilingTv(p: Prop, o: { drop?: number } = {}): void {
  const body = '#2f3433';
  const drop = o.drop ?? 0.5;
  p.box(body, [-0.37, -0.225, -0.045], [0.37, 0.225, 0.0], { r: 0.012, seg: 1 });
  p.box(body, [-0.24, -0.15, -0.1], [0.24, 0.15, -0.04], { r: 0.02, seg: 1 });
  p.box('#3c4e56', [-0.35, -0.2, 0.0], [0.35, 0.2, 0.003], { shadow: false });
  p.box('#57707a', [-0.35, 0.05, 0.003], [-0.12, 0.2, 0.004], { shadow: false });
  p.box('#9fd3a8', [0.31, -0.215, 0.0], [0.322, -0.208, 0.003], { kind: 'glow', shadow: false });
  // 受け金物と柱（天井まで）
  p.box('#9aa29e', [-0.1, -0.08, -0.13], [0.1, 0.08, -0.1], { r: 0.006, seg: 1 });
  p.rod('#9aa29e', [0, 0.06, -0.12], [0, 0.225 + drop, -0.12], 0.022, { radial: 8 });
  p.cyl('#9aa29e', [0, 0.225 + drop - 0.008, -0.12], 0.07, 0.016, { seg: 12 });
}

/**
 * 教室の後ろのロッカー（1 人 1 区画の扉の無い棚）: 天板・台輪・側板・中の棚板・仕切り・奥の板・名札。
 * 中身（区画ごとに乱数）: 寝かせたかばん・教科書の束・体操着の袋・空き
 */
export function cubbyLocker(p: Prop, o: { cols?: number; rows?: number; cw?: number; h?: number; d?: number; body?: string; collide?: boolean } = {}): void {
  const cols = o.cols ?? 9;
  const rows = o.rows ?? 2;
  const cw = o.cw ?? 0.68;
  const H = o.h ?? 1.05;
  const D = o.d ?? 0.45;
  const L = cols * cw;
  const body = o.body ?? '#c6c9bc';
  const inner = shade(body, -0.35);
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
  const bags = ['#253246', '#2e2f33', '#3a4f6b', '#5a3b36'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = -L / 2 + c * cw + t / 2;
      const x1 = x0 + cw - t;
      const y = ys[r] + t;
      const clear = ys[r + 1] - y;
      const xc = (x0 + x1) / 2;
      // 名札（棚板の前の縁）
      p.box(PAPER, [xc - 0.06, y - t, D / 2], [xc + 0.06, y - 0.004, D / 2 + 0.003], { shadow: false });
      const k = p.r();
      if (k < 0.4) {
        // 寝かせたかばん
        const s = p.sub([xc + (p.r() - 0.5) * 0.08, y, 0.0], (p.r() - 0.5) * 0.2);
        s.box(bags[Math.floor(p.r() * bags.length)], [-0.2, 0, -0.15], [0.2, 0.12, 0.15], { r: 0.035, seg: 1 });
        s.box(DARK, [-0.14, 0.119, -0.004], [0.14, 0.123, 0.004], { shadow: false });
      } else if (k < 0.65) {
        bookStack(p.sub([x0 + 0.04 + p.r() * 0.2, y, 0.02], (p.r() - 0.5) * 0.3), 2 + Math.floor(p.r() * 4), Math.min(clear - 0.04, 0.2));
      } else if (k < 0.82) {
        const s = p.sub([xc + (p.r() - 0.5) * 0.15, y, 0.02]);
        s.ball(['#2f4f7a', '#6a3a40', '#3c5a3e'][Math.floor(p.r() * 3)], [0, 0.08, 0], [0.16, 0.08, 0.13], { seg: 8 });
      }
    }
  }
  if (o.collide !== false) p.collide([-L / 2, 0, -D / 2], [L / 2, H, D / 2]);
}

/** 教科書・ノートの束（表紙・紙の小口・背）。局所: 底の中心 */
export function bookStack(p: Prop, n: number, maxH = 0.2): void {
  const covers = ['#2f5e8a', '#c9493f', '#3f7a52', '#e0b84a', '#6b4f8a', '#e8e6dc', '#2c3a4a'];
  let y = 0;
  for (let i = 0; i < n && y < maxH; i++) {
    const w = 0.18 + p.r() * 0.05;
    const d = 0.25 + p.r() * 0.03;
    const th = 0.012 + p.r() * 0.02;
    const s = p.sub([(p.r() - 0.5) * 0.02, y, (p.r() - 0.5) * 0.02], (p.r() - 0.5) * 0.15);
    const c = covers[Math.floor(p.r() * covers.length)];
    s.box(c, [-w / 2, 0, -d / 2], [w / 2, th, d / 2], { r: 0.002, seg: 1 });
    s.box(PAPER, [-w / 2 + 0.006, 0.002, -d / 2 + 0.004], [w / 2 + 0.001, th - 0.002, d / 2 + 0.001], { shadow: false });
    y += th;
  }
}

/** 筆箱（ファスナーの付いた布の筒） */
export function pencilCase(p: Prop, col: string): void {
  p.box(col, [-0.1, 0, -0.035], [0.1, 0.045, 0.035], { r: 0.018, seg: 1 });
  p.box(DARK, [-0.09, 0.044, -0.003], [0.09, 0.047, 0.003], { shadow: false });
  p.box('#c8ccc6', [0.085, 0.032, -0.006], [0.1, 0.04, 0.006], { shadow: false });
}

/** スクールバッグ（立てた形。局所: 底の中心。ファスナー・前のポケット・持ち手 2 本・校章） */
export function schoolBag(p: Prop, col: string): void {
  p.box(col, [-0.2, 0, -0.06], [0.2, 0.29, 0.06], { r: 0.035, seg: 2 });
  p.box(shade(col, -0.2), [-0.155, 0.04, 0.055], [0.155, 0.18, 0.074], { r: 0.02, seg: 1 });
  p.box(DARK, [-0.17, 0.287, -0.005], [0.17, 0.293, 0.005], { shadow: false });
  for (const z of [-0.035, 0.035]) p.torus(shade(col, -0.35), [0, 0.29, z], 0.075, 0.008, { axis: 'z', arc: Math.PI, seg: 10 });
  p.box('#d9d2b8', [-0.035, 0.2, 0.06], [0.035, 0.24, 0.064], { shadow: false });
}

/** 体操着の袋（平たい布の袋・絞って寄った口・絞りの紐の輪）。局所: 掛ける点 = 原点、袋は下へ下がる */
export function gymBag(p: Prop, col: string): void {
  p.box(col, [-0.15, -0.44, -0.028], [0.15, -0.13, 0.028], { r: 0.026, seg: 1 });
  // 絞って寄った口（上ほど細い）と、口の下の折り返しの帯
  p.extrude(col, [[-0.14, -0.14], [0.14, -0.14], [0.035, -0.07], [-0.035, -0.07]], 'xy', -0.022, 0.022, { bevel: 0.008 });
  p.box(shade(col, -0.25), [-0.152, -0.17, -0.03], [0.152, -0.15, 0.03], { r: 0.008, seg: 1, shadow: false });
  p.torus('#e8e6dc', [0, -0.035, 0], 0.035, 0.004, { axis: 'z', seg: 10, shadow: false });
  p.box('#f2f0e8', [-0.06, -0.3, 0.028], [0.06, -0.25, 0.031], { shadow: false });
}

/**
 * 廊下のスチールロッカー（2 段・扉ごとに通気の切り欠き・取っ手・名札入れ・鍵穴）。cols 列 × rows 段、扉の幅 cw。
 * 本体は扉より 1 段暗く、扉の継ぎ目が見える
 */
export function steelLocker(p: Prop, o: { cols?: number; rows?: number; cw?: number; h?: number; d?: number; body?: string; collide?: boolean } = {}): void {
  const cols = o.cols ?? 10;
  const rows = o.rows ?? 2;
  const cw = o.cw ?? 0.385;
  const H = o.h ?? 1.0;
  const D = o.d ?? 0.36;
  const L = cols * cw;
  const door = o.body ?? '#c4c9bf';
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
      p.box(door, [x0, y0, D / 2 - 0.01], [x1, y1, D / 2], { r: 0.003, seg: 1 });
      // 通気の切り欠き（上の方に 3 本）
      for (let k = 0; k < 3; k++) p.box(DARK, [xc - 0.07, y1 - 0.05 - k * 0.022, D / 2], [xc + 0.07, y1 - 0.043 - k * 0.022, D / 2 + 0.002], { shadow: false });
      // 取っ手（くぼみの縁）・名札入れ・鍵穴
      p.box('#9aa29e', [x1 - 0.06, y0 + dh * 0.38, D / 2], [x1 - 0.03, y0 + dh * 0.38 + 0.08, D / 2 + 0.012]);
      p.box(PAPER, [xc - 0.06, y1 - 0.135, D / 2], [xc + 0.03, y1 - 0.105, D / 2 + 0.004], { shadow: false });
      p.cyl('#9aa29e', [x1 - 0.045, y0 + dh * 0.38 + 0.11, D / 2 + 0.004], 0.008, 0.008, { axis: 'z', seg: 6, shadow: false });
    }
  }
  if (o.collide !== false) p.collide([-L / 2, 0, -D / 2], [L / 2, H, D / 2]);
}

/** 掃除用具入れ（スチールの縦長の物入れ: 両開きの扉・上下の通気の切り欠き・取っ手・札・台輪） */
export function cleaningCabinet(p: Prop, o: { w?: number; d?: number; h?: number; body?: string; collide?: boolean } = {}): void {
  const W = o.w ?? 0.7;
  const D = o.d ?? 0.5;
  const H = o.h ?? 1.8;
  const door = o.body ?? '#c4c9bf';
  p.box(DARK, [-W / 2 + 0.01, 0, -D / 2 + 0.02], [W / 2 - 0.01, 0.05, D / 2 - 0.03]);
  p.box(shade(door, -0.3), [-W / 2, 0.05, -D / 2], [W / 2, H, D / 2 - 0.01], { r: 0.006, seg: 1 });
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -W / 2 + 0.008 : 0.003;
    const x1 = s < 0 ? -0.003 : W / 2 - 0.008;
    const xc = (x0 + x1) / 2;
    p.box(door, [x0, 0.06, D / 2 - 0.012], [x1, H - 0.012, D / 2], { r: 0.004, seg: 1 });
    for (const y of [H - 0.16, 0.2]) for (let k = 0; k < 5; k++) p.box(DARK, [xc - 0.1, y + k * 0.022, D / 2], [xc + 0.1, y + k * 0.022 + 0.007, D / 2 + 0.002], { shadow: false });
    p.box('#9aa29e', [s * 0.03 - 0.012, H * 0.48, D / 2], [s * 0.03 + 0.012, H * 0.48 + 0.16, D / 2 + 0.018], { r: 0.006, seg: 1 });
  }
  p.box(PAPER, [-0.14, H - 0.42, D / 2], [0.14, H - 0.32, D / 2 + 0.004], { shadow: false });
  for (let k = 0; k < 2; k++) p.box(DARK, [-0.1, H - 0.39 + k * 0.035, D / 2 + 0.004], [0.1, H - 0.38 + k * 0.035, D / 2 + 0.005], { shadow: false });
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/** 来客用のスリッパの棚（木の側板・棚板・奥の板・台輪。棚ごとにスリッパの組） */
export function slipperRack(p: Prop, o: { w?: number; h?: number; d?: number; levels?: number; wood?: string; collide?: boolean } = {}): void {
  const W = o.w ?? 1.4;
  const H = o.h ?? 1.1;
  const D = o.d ?? 0.4;
  const n = o.levels ?? 4;
  const wood = o.wood ?? '#b89c70';
  for (const s of [-1, 1]) p.box(wood, [s < 0 ? -W / 2 : W / 2 - 0.02, 0, -D / 2], [s < 0 ? -W / 2 + 0.02 : W / 2, H, D / 2], { r: 0.004, seg: 1 });
  p.box(wood, [-W / 2, H - 0.022, -D / 2], [W / 2, H, D / 2 + 0.01], { r: 0.005, seg: 1 });
  p.box(shade(wood, -0.55), [-W / 2 + 0.02, 0, -D / 2], [W / 2 - 0.02, H - 0.022, -D / 2 + 0.01]);
  p.box(DARK, [-W / 2 + 0.02, 0, D / 2 - 0.03], [W / 2 - 0.02, 0.06, D / 2 - 0.012]);
  const slip = ['#3f6a58', '#7a5a3c', '#3a5068', '#7a3c3c'];
  for (let i = 0; i < n; i++) {
    const y = 0.06 + (i * (H - 0.08)) / n;
    p.box(wood, [-W / 2 + 0.02, y, -D / 2 + 0.01], [W / 2 - 0.02, y + 0.018, D / 2], { r: 0.003, seg: 1 });
    for (let x = -W / 2 + 0.14; x < W / 2 - 0.12; x += 0.24) {
      if (p.r() < 0.3) continue;
      const col = slip[Math.floor(p.r() * slip.length)];
      const pair = p.sub([x + (p.r() - 0.5) * 0.03, y + 0.018, 0.02], (p.r() - 0.5) * 0.12);
      for (const s of [-1, 1]) {
        const f = pair.sub([s * 0.055, 0, 0]);
        f.box(shade(col, 0.15), [-0.045, 0, -0.12], [0.045, 0.02, 0.12]);
        f.ball(col, [0, 0.02, 0.04], [0.049, 0.04, 0.075], { seg: 6 });
      }
    }
  }
  if (o.collide !== false) p.collide([-W / 2, 0, -D / 2], [W / 2, H, D / 2]);
}

/** 簀の子（細い板を 2〜3 本の桟の上に並べる） */
export function duckboard(p: Prop, o: { w?: number; d?: number; wood?: string } = {}): void {
  const W = o.w ?? 1.1;
  const D = o.d ?? 1.2;
  const wood = o.wood ?? '#b49a70';
  for (const x of [-W / 2 + 0.08, 0, W / 2 - 0.08]) p.box(shade(wood, -0.4), [x - 0.03, 0, -D / 2 + 0.02], [x + 0.03, 0.022, D / 2 - 0.02]);
  const n = Math.floor(D / 0.105);
  for (let i = 0; i < n; i++) {
    const z = -D / 2 + (i + 0.5) * (D / n);
    p.box(shade(wood, (p.r() - 0.5) * 0.25), [-W / 2, 0.022, z - 0.04], [W / 2, 0.042, z + 0.04], { r: 0.004, seg: 1 });
  }
  p.collide([-W / 2, 0, -D / 2], [W / 2, 0.042, D / 2]);
}

/** 閉じた長い傘（先・畳んだ布・留め帯・柄・曲がった持ち手）。局所: 先が原点、上へ */
export function umbrella(p: Prop, col: string, len = 0.86): void {
  p.lathe(col, [[0, 0.03], [0.006, 0.03], [0.012, 0.09], [0.03, 0.26], [0.033, 0.4], [0.027, 0.56], [0.016, 0.66], [0.007, 0.69], [0, 0.69]], [0, 0, 0], { seg: 8 });
  p.rod('#c8ccc6', [0, 0, 0], [0, 0.04, 0], 0.004, { radial: 4, shadow: false });
  p.cyl(shade(col, -0.3), [0, 0.42, 0], 0.034, 0.025, { seg: 8, shadow: false });
  p.rod('#9aa29e', [0, 0.68, 0], [0, len - 0.02, 0], 0.006, { radial: 4 });
  const handle = p.r() < 0.5 ? '#3a2e26' : '#d9d6cc';
  p.rod(handle, [0, len - 0.12, 0], [0, len, 0], 0.011, { radial: 6 });
  p.torus(handle, [0.032, len, 0], 0.032, 0.011, { axis: 'z', arc: Math.PI, seg: 8 });
}

/** 傘立て（鉄の角の管の枠・上の升目の枠・中の桟・下の受け皿。升目のいくつかに傘） */
export function umbrellaStand(p: Prop, o: { w?: number; d?: number; h?: number; nx?: number; nz?: number; frame?: string; fill?: number; collide?: boolean } = {}): void {
  const W = o.w ?? 0.6;
  const D = o.d ?? 0.3;
  const H = o.h ?? 0.52;
  const nx = o.nx ?? 4;
  const nz = o.nz ?? 2;
  const fr = o.frame ?? '#a7aea9';
  const t = 0.012;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(fr, [sx * W / 2 - t, 0, sz * D / 2 - t], [sx * W / 2 + t, H, sz * D / 2 + t], { r: 0.003, seg: 1 });
  // 上の枠（升目）と中の桟
  for (const y of [H - 0.02, 0.22]) {
    for (const sz of [-1, 1]) p.box(fr, [-W / 2, y, sz * D / 2 - 0.008], [W / 2, y + 0.02, sz * D / 2 + 0.008]);
    for (const sx of [-1, 1]) p.box(fr, [sx * W / 2 - 0.008, y, -D / 2], [sx * W / 2 + 0.008, y + 0.02, D / 2]);
  }
  for (let i = 1; i < nx; i++) p.box(fr, [-W / 2 + (i * W) / nx - 0.005, H - 0.018, -D / 2], [-W / 2 + (i * W) / nx + 0.005, H - 0.004, D / 2]);
  for (let j = 1; j < nz; j++) p.box(fr, [-W / 2, H - 0.018, -D / 2 + (j * D) / nz - 0.005], [W / 2, H - 0.004, -D / 2 + (j * D) / nz + 0.005]);
  // 受け皿
  p.box(shade(fr, -0.45), [-W / 2 + 0.01, 0.0, -D / 2 + 0.01], [W / 2 - 0.01, 0.006, D / 2 - 0.01]);
  for (const sz of [-1, 1]) p.box(shade(fr, -0.2), [-W / 2 + 0.01, 0, sz * (D / 2 - 0.012) - 0.003], [W / 2 - 0.01, 0.035, sz * (D / 2 - 0.012) + 0.003]);
  for (const sx of [-1, 1]) p.box(shade(fr, -0.2), [sx * (W / 2 - 0.012) - 0.003, 0, -D / 2 + 0.01], [sx * (W / 2 - 0.012) + 0.003, 0.035, D / 2 - 0.01]);
  const cols = ['#20283a', '#2a2c30', '#e6e8e2', '#3c5a8a', '#8a3a3a', '#3f6a4f', '#d9cfa8'];
  const fill = o.fill ?? 0.45;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (p.r() > fill) continue;
      const cx = -W / 2 + ((i + 0.5) * W) / nx + (p.r() - 0.5) * 0.03;
      const cz = -D / 2 + ((j + 0.5) * D) / nz + (p.r() - 0.5) * 0.03;
      umbrella(p.sub([cx, 0.008, cz], p.r() * Math.PI * 2, { pitch: (p.r() - 0.5) * 0.12, roll: (p.r() - 0.5) * 0.12 }), cols[Math.floor(p.r() * cols.length)], 0.8 + p.r() * 0.1);
    }
  }
  if (o.collide !== false) p.collide([-W / 2 - t, 0, -D / 2 - t], [W / 2 + t, H, D / 2 + t]);
}

/** ほうき（樹脂の頭と毛・木の柄・柄の先の吊り穴の帽子）。局所: 毛の先の中心が原点、柄は +y */
export function broom(p: Prop, o: { handle?: string; head?: string; bristle?: string } = {}): void {
  const handle = o.handle ?? '#b89a6c';
  const head = o.head ?? '#3f6f8a';
  const bristle = o.bristle ?? '#c9b46a';
  p.extrude(bristle, [[-0.13, 0], [0.13, 0], [0.11, 0.075], [-0.11, 0.075]], 'xy', -0.022, 0.022, { bevel: 0.004 });
  p.box(head, [-0.12, 0.072, -0.024], [0.12, 0.112, 0.024], { r: 0.012, seg: 1 });
  p.cyl(head, [0, 0.125, 0], 0.02, 0.04, { seg: 8 });
  p.rod(handle, [0, 0.12, 0], [0, 1.26, 0], 0.012, { radial: 6 });
  p.cyl(head, [0, 1.27, 0], 0.014, 0.04, { seg: 6 });
}

/** モップ（糸の房・留め金・柄） */
export function mop(p: Prop, o: { handle?: string; cloth?: string } = {}): void {
  const handle = o.handle ?? '#9aa29e';
  const cloth = o.cloth ?? '#d9d6c8';
  p.lathe(cloth, [[0, 0.0], [0.07, 0.0], [0.1, 0.03], [0.085, 0.14], [0.05, 0.24], [0.03, 0.27], [0, 0.27]], [0, 0, 0], { seg: 10 });
  p.cyl('#6f7a76', [0, 0.27, 0], 0.03, 0.05, { seg: 8 });
  p.rod(handle, [0, 0.28, 0], [0, 1.3, 0], 0.012, { radial: 6 });
  p.cyl('#3f6f8a', [0, 1.3, 0], 0.015, 0.05, { seg: 6 });
}

/** バケツ（樹脂。口の縁・底の段・中の面・取っ手と耳） */
export function bucket(p: Prop, col = '#3f78a8'): void {
  p.lathe(col, [[0, 0], [0.11, 0], [0.115, 0.012], [0.14, 0.255], [0.15, 0.262], [0.15, 0.275], [0.138, 0.275], [0.128, 0.03], [0, 0.03]], [0, 0, 0], { seg: 16 });
  for (const s of [-1, 1]) p.box(shade(col, -0.2), [s * 0.155 - 0.01, 0.235, -0.015], [s * 0.155 + 0.01, 0.27, 0.015], { r: 0.004, seg: 1 });
  p.sub([0, 0.255, 0], 0, { pitch: -1.25 }).torus('#c8ccc6', [0, 0, 0], 0.152, 0.0035, { axis: 'z', arc: Math.PI, seg: 12 });
}

/** 掃除用具のまとまり（壁に立て掛けたほうき・モップと、床のバケツ）。局所: 壁の面 z = 0、床の中心 */
export function cleaningTools(p: Prop, o: { collide?: boolean } = {}): void {
  broom(p.sub([-0.12, 0, 0.1], 0.1, { pitch: -0.1, roll: 0.06 }));
  mop(p.sub([0.06, 0, 0.12], -0.3, { pitch: -0.11, roll: -0.04 }));
  bucket(p.sub([0.3, 0, 0.18], 0.4));
  if (o.collide !== false) p.collide([-0.28, 0, 0], [0.46, 0.3, 0.34]);
}
