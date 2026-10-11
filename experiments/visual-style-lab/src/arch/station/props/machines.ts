import type { Prop, V2 } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';

/**
 * 駅の機械と設備（自動改札機・壁の券売機・コインロッカー・電話ボックス・丸型ポスト・エアコンの室外機・信号の機器箱）。
 * 正面 +z、床 y = 0。色は実物の色で頼む（駅の色へは材質の作り方 mats.ts が寄せる）。
 * 寸法の根拠:
 * - 自動改札機: 本体の長さ 1.4 m・幅 0.25 m・高さ 1.0 m、両端は丸い。通路の幅 0.9 m。入る側の上に IC の読み取り部（斜めの青い板）と切符の投入口、
 *   出る側に切符の取り出し口、上の面の中ほどに小さな表示、両端の面に進めるかの灯（緑の矢印）、通路側の面の中ほどに扉（羽根）の収まる口と人を見る窓
 * - 壁の券売機: 幅 0.84 m・高さ 1.75 m・奥行き 0.56 m。上に光る「きっぷ」の帯、斜めの画面（タッチパネル）、右に硬貨・紙幣・IC カードの口、下に券と釣り銭の受け口
 * - コインロッカー: 1 列 0.6 m・高さ 1.85 m・奥行き 0.5 m。下の段は大きい扉。扉ごとに鍵の箱（硬貨の口と鍵）と番号の札
 * - 電話ボックス: 0.9 m 角・高さ 2.3 m。角の柱・腰の板・ガラス・中ほどの横の桟・折れ戸・屋根の上の光る帯（公衆電話）。中に台と電話機
 * - 丸型ポスト（郵便差出箱 1 号丸型）: 直径 0.4 m・高さ 1.3 m。つばのある丸い笠・前に差し入れ口 2 つ・後ろに取り出しの扉
 * - 室外機: 幅 0.8 m・高さ 0.6 m・奥行き 0.28 m。前の左に丸い吹き出しの格子、右に点検の板、横から配管
 * - 信号の機器箱: 幅 1.2 m・高さ 1.5 m・奥行き 0.8 m。コンクリートの台・両開きの扉と取っ手・扉の上下のがらり（換気の羽板）・後ろへ下がる屋根・番号の札・配線の管
 */

/** 丸い両端の輪郭（上から見た形。x の幅 w・z の長さ L。端の半円を n 分割） */
function capsuleXZ(w: number, L: number, n = 8): V2[] {
  const r = w / 2;
  const out: V2[] = [];
  const zc = L / 2 - r;
  // +z の端（x: +r → -r）
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    out.push([Math.cos(a) * r, zc + Math.sin(a) * r]);
  }
  // -z の端（x: -r → +r）
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    out.push([Math.cos(a) * r, -zc + Math.sin(a) * r]);
  }
  return out;
}

/** 自動改札機（1 台。通路は左右 ±x。flaps = 扉の口を付ける側 [-x, +x]） */
export function ticketGate(p: Prop, o: { body?: string; top?: string; flaps?: [boolean, boolean] } = {}): void {
  const body = o.body ?? '#e3e7e2';
  const top = o.top ?? '#2a3233';
  const steel = '#9aa5a1';
  const dark = '#141c1c';
  const W = 0.25;
  const L = 1.4;
  const H = 1.0;
  // 足元のステンレスの帯・本体（両端が丸い）・上の黒い天板
  p.extrude(steel, capsuleXZ(W - 0.02, L - 0.02), 'xz', 0, 0.09, { bevel: 0.004 });
  p.extrude(body, capsuleXZ(W, L), 'xz', 0.09, H - 0.06, { bevel: 0.01, collide: true });
  p.extrude(top, capsuleXZ(W + 0.012, L + 0.012), 'xz', H - 0.06, H, { bevel: 0.012 });
  // 側面の継ぎ目（点検の板）と、通路側の人を見る窓（小さな暗い窓が 3 つ）
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.001);
    for (const z of [-0.36, 0.36]) p.box(shade(body, -0.5), [x - 0.002, 0.12, z - 0.004], [x + 0.002, H - 0.09, z + 0.004], { shadow: false });
    for (const z of [-0.5, -0.05, 0.5]) p.box(dark, [x - 0.003, 0.66, z - 0.03], [x + 0.003, 0.7, z + 0.03], { shadow: false });
    if (o.flaps ? o.flaps[s < 0 ? 0 : 1] : true) {
      // 扉（羽根）の収まる口: 縦の細い口（羽根は通路へ横に出る板）と、口の縁の枠・のぞく黒いゴムの縁
      p.box(shade(body, -0.3), [x - 0.003, 0.4, 0.06], [x + 0.003, 0.88, 0.16], { r: 0.003, shadow: false });
      p.box(dark, [x - 0.005, 0.43, 0.095], [x + 0.005, 0.85, 0.125], { shadow: false });
      p.box('#2a3233', [x - 0.002 + s * 0.006, 0.47, 0.1], [x + 0.002 + s * 0.016, 0.81, 0.12], { r: 0.006, shadow: false });
    }
  }
  // 天板の上: 入る側（+z）に IC の読み取り部（斜めの台と青く光る板）・切符の投入口、中ほどに表示、出る側（-z）に取り出し口
  const ic = p.sub([0, H, 0.42], 0, { pitch: 0.28 });
  ic.box('#1d2727', [-0.1, 0, -0.1], [0.1, 0.035, 0.1], { r: 0.01 });
  ic.box('#4f8fd6', [-0.085, 0.035, -0.085], [0.085, 0.039, 0.085], { kind: 'glow', shadow: false });
  ic.box('#cfe6f2', [-0.03, 0.039, -0.03], [0.03, 0.041, 0.03], { kind: 'glow', shadow: false });
  p.box(dark, [-0.045, H, 0.6], [0.045, H + 0.006, 0.612], { shadow: false });
  p.box('#5f6c6a', [-0.06, H, 0.585], [0.06, H + 0.004, 0.63], { r: 0.003, shadow: false });
  const disp = p.sub([0, H, 0.08], 0, { pitch: -0.5 });
  disp.box('#1d2727', [-0.08, 0, -0.04], [0.08, 0.06, 0.02], { r: 0.008 });
  disp.box('#7fd0b4', [-0.065, 0.012, 0.02], [0.065, 0.05, 0.023], { kind: 'glow', shadow: false });
  p.box(dark, [-0.05, H, -0.52], [0.05, H + 0.006, -0.47], { shadow: false });
  p.box('#5f6c6a', [-0.065, H, -0.54], [0.065, H + 0.004, -0.45], { r: 0.003, shadow: false });
  // 両端の面の進める灯（緑）と、その下の小さな札
  for (const s of [-1, 1]) {
    const z = s * (L / 2 + 0.003);
    p.box('#1d2727', [-0.05, 0.7, z - 0.006], [0.05, 0.82, z + 0.006], { r: 0.008, shadow: false });
    p.box('#56c48c', [-0.035, 0.72, z - 0.008], [0.035, 0.8, z + 0.008], { kind: 'glow', shadow: false });
  }
}

/** 壁の券売機（前 +z。背は壁に付ける） */
export function ticketVendor(p: Prop, o: { body?: string; panel?: string; screen?: string; band?: string } = {}): void {
  const body = o.body ?? '#3e5c60';
  const panel = o.panel ?? '#c9d0cc';
  const scr = o.screen ?? '#a6d6cb';
  const band = o.band ?? '#2f6a8a';
  const dark = '#141c1c';
  const W = 0.84;
  const z0 = -0.28;
  const z1 = 0.26; // 前の面
  // 台・本体・前の枠（少し出た縁）
  p.box(dark, [-W / 2 + 0.02, 0, z0 + 0.02], [W / 2 - 0.02, 0.08, z1 - 0.02], { r: 0.008 });
  p.box(body, [-W / 2, 0.08, z0], [W / 2, 1.62, z1], { r: 0.02, collide: true });
  p.box(shade(body, 0.25), [-W / 2 - 0.005, 1.62, z0], [W / 2 + 0.005, 1.78, z1 + 0.03], { r: 0.015 });
  // 上の光る帯（「きっぷ」）: 白い光る板と、色の帯
  p.box('#eef3ee', [-W / 2 + 0.05, 1.65, z1 + 0.03], [W / 2 - 0.05, 1.75, z1 + 0.034], { kind: 'glow', shadow: false });
  p.box(band, [-W / 2 + 0.05, 1.65, z1 + 0.034], [-W / 2 + 0.16, 1.75, z1 + 0.037], { shadow: false });
  // 前の板（明るい灰色）の上半分: 斜めの画面とまわりの縁
  p.box(panel, [-W / 2 + 0.03, 0.6, z1], [W / 2 - 0.03, 1.58, z1 + 0.015], { r: 0.01 });
  const s = p.sub([-0.07, 1.0, z1 + 0.015], 0, { pitch: -0.18 });
  s.box(dark, [-0.27, 0, -0.01], [0.27, 0.48, 0.03], { r: 0.012 });
  s.box(scr, [-0.24, 0.035, 0.03], [0.24, 0.445, 0.034], { kind: 'glow', shadow: false });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s.box('#e7f4ef', [-0.21 + j * 0.105, 0.07 + i * 0.07, 0.034], [-0.13 + j * 0.105, 0.115 + i * 0.07, 0.037], { kind: 'glow', shadow: false });
  // 右の柱: 硬貨の口（受け皿）・紙幣の口・IC カードの口・呼び出しの押しボタン
  const r = p.sub([0.31, 0, z1 + 0.015]);
  r.box('#8c9894', [-0.07, 1.36, 0], [0.07, 1.44, 0.03], { r: 0.008 });
  r.box(dark, [-0.035, 1.395, 0.03], [0.035, 1.405, 0.034], { shadow: false });
  r.box('#8c9894', [-0.07, 1.18, 0], [0.07, 1.26, 0.025], { r: 0.008 });
  r.box(dark, [-0.055, 1.215, 0.025], [0.055, 1.225, 0.029], { shadow: false });
  r.box('#2a3233', [-0.06, 1.02, 0], [0.06, 1.12, 0.02], { r: 0.008 });
  r.box('#4f8fd6', [-0.04, 1.04, 0.02], [0.04, 1.1, 0.023], { kind: 'glow', shadow: false });
  r.cyl('#c94a45', [0, 0.88, 0.012], 0.022, 0.025, { axis: 'z', seg: 12 });
  // 下半分: 券と釣り銭の受け口（暗い口と、銀の縁と、透ける蓋）・案内の札・鍵穴
  p.box('#9aa5a1', [-0.3, 0.2, z1], [0.3, 0.5, z1 + 0.02], { r: 0.012 });
  p.box('#0f1717', [-0.26, 0.24, z1 + 0.012], [0.26, 0.44, z1 + 0.024]);
  p.box('#dcebea', [-0.26, 0.38, z1 + 0.024], [0.26, 0.44, z1 + 0.028], { kind: 'glass', shadow: false });
  p.box('#f4f4ee', [-0.3, 0.52, z1 + 0.015], [0.1, 0.57, z1 + 0.018], { shadow: false });
  p.box('#56c48c', [0.2, 0.53, z1 + 0.015], [0.27, 0.56, z1 + 0.019], { kind: 'glow', shadow: false });
  p.cyl('#9aa5a1', [0.3, 0.14, z1 + 0.005], 0.015, 0.012, { axis: 'z', seg: 10 });
}

/** コインロッカー（cols 列。下の段は大きい扉。前 +z） */
export function coinLocker(p: Prop, o: { cols?: number; body?: string; door?: string; sign?: string } = {}): void {
  const cols = o.cols ?? 4;
  const body = o.body ?? '#c3ccc5';
  const door = o.door ?? '#d4dbd5';
  const sign = o.sign ?? '#2f6a8a';
  const dark = '#141c1c';
  const cw = 0.6;
  const W = cols * cw;
  const D = 0.5;
  const zf = D / 2;
  const y0 = 0.08;
  const H = 1.85;
  // 台・本体（横の板と天板）・上の看板の箱
  p.box(dark, [-W / 2 + 0.01, 0, -D / 2 + 0.02], [W / 2 - 0.01, y0, zf - 0.03], {});
  p.box(body, [-W / 2, y0, -D / 2], [W / 2, H, zf], { r: 0.008, collide: true });
  p.box(shade(body, -0.15), [-W / 2 - 0.01, H, -D / 2], [W / 2 + 0.01, H + 0.12, zf + 0.02], { r: 0.01 });
  p.box('#eef3ee', [-W / 2 + 0.1, H + 0.02, zf + 0.02], [W / 2 - 0.1, H + 0.1, zf + 0.024], { kind: 'glow', shadow: false });
  p.box(sign, [-W / 2 + 0.1, H + 0.02, zf + 0.024], [-W / 2 + 0.3, H + 0.1, zf + 0.027], { shadow: false });
  // 扉: 段の高さ（下が大きい）
  const rows = [0.5, 0.3125, 0.3125, 0.3125, 0.3125];
  let y = y0 + 0.02;
  for (let r = 0; r < rows.length; r++) {
    const h = rows[r] - 0.008;
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + cw * (c + 0.5);
      // 扉の板（隙間 8 mm）
      p.box(door, [x - cw / 2 + 0.012, y, zf], [x + cw / 2 - 0.012, y + h, zf + 0.012], { r: 0.003 });
      // 鍵の箱（硬貨の口・鍵）。扉の右上
      const ky = y + h - 0.13;
      p.box('#9aa5a1', [x + 0.17, ky, zf + 0.012], [x + 0.25, ky + 0.11, zf + 0.04]);
      p.box(dark, [x + 0.195, ky + 0.075, zf + 0.04], [x + 0.225, ky + 0.081, zf + 0.042], { shadow: false });
      p.cyl('#5f6c6a', [x + 0.21, ky + 0.03, zf + 0.044], 0.012, 0.008, { axis: 'z', seg: 8, shadow: false });
      // 番号の札（左上）と、下の段の換気の切れ込み
      p.box('#f4f4ee', [x - cw / 2 + 0.05, y + h - 0.06, zf + 0.012], [x - cw / 2 + 0.12, y + h - 0.025, zf + 0.014], { shadow: false });
      if (r === 0) for (let k = 0; k < 3; k++) p.box(shade(door, -0.6), [x - 0.12, y + 0.06 + k * 0.03, zf + 0.012], [x + 0.12, y + 0.068 + k * 0.03, zf + 0.014], { shadow: false });
    }
    y += rows[r];
  }
}

/** 電話ボックス（前 +z が折れ戸。中の背の面に台と電話機） */
export function phoneBooth(p: Prop, o: { frame?: string; band?: string; glass?: string } = {}): void {
  const fr = o.frame ?? '#c9d0cc';
  const band = o.band ?? '#3f8f5f';
  const glass = o.glass ?? '#dcebea';
  const S = 0.9;
  const h = S / 2;
  const top = 2.2;
  // 台（コンクリート）と床
  p.box('#9aa29e', [-h - 0.04, 0, -h - 0.04], [h + 0.04, 0.1, h + 0.04], { r: 0.01 });
  // 角の柱・上下の枠
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(fr, [sx * h - 0.03, 0.1, sz * h - 0.03], [sx * h + 0.03, top, sz * h + 0.03], { r: 0.008 });
  // 面ごと: 腰の板・ガラス・中の横の桟（背と横の 3 面）
  const side = (axis: 'x' | 'z', s: number): void => {
    const at = s * h;
    const B = (a: number, b: number, y0: number, y1: number, t: number, col: string, kind?: 'glass'): void => {
      if (axis === 'z') p.box(col, [a, y0, at - t], [b, y1, at + t], { kind, shadow: kind ? false : true });
      else p.box(col, [at - t, y0, a], [at + t, y1, b], { kind, shadow: kind ? false : true });
    };
    B(-h + 0.03, h - 0.03, 0.1, 0.32, 0.012, fr);
    B(-h + 0.03, h - 0.03, 0.32, top - 0.06, 0.004, glass, 'glass');
    B(-h + 0.03, h - 0.03, 0.98, 1.03, 0.014, fr);
    B(-h + 0.03, h - 0.03, top - 0.06, top, 0.014, fr);
  };
  side('z', -1);
  side('x', -1);
  side('x', 1);
  // 前の折れ戸（2 枚。真ん中の縦の框・縦の取っ手）
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -h + 0.03 : 0.005;
    const x1 = s < 0 ? -0.005 : h - 0.03;
    p.box(fr, [x0, 0.1, h - 0.012], [x1, 0.32, h + 0.012], {});
    p.box(glass, [x0, 0.32, h - 0.004], [x1, top - 0.06, h + 0.004], { kind: 'glass', shadow: false });
    p.box(fr, [x0, 0.98, h - 0.014], [x1, 1.03, h + 0.014], {});
    p.box(fr, [s < 0 ? x1 - 0.025 : x0, 0.1, h - 0.016], [s < 0 ? x1 : x0 + 0.025, top - 0.06, h + 0.016], {});
  }
  p.rod('#8c9894', [0.06, 0.85, h + 0.04], [0.06, 1.25, h + 0.04], 0.012);
  // 屋根（張り出した板）と上の光る帯（4 面）
  p.box(shade(fr, -0.2), [-h - 0.05, top, -h - 0.05], [h + 0.05, top + 0.05, h + 0.05], { r: 0.01 });
  p.box('#eef3ee', [-h + 0.02, top + 0.05, -h + 0.02], [h - 0.02, top + 0.25, h - 0.02], { kind: 'glow', shadow: false });
  p.box(band, [-h, top + 0.05, -h], [h, top + 0.1, h], {});
  p.box(shade(fr, -0.2), [-h - 0.03, top + 0.25, -h - 0.03], [h + 0.03, top + 0.3, h + 0.03], { r: 0.01 });
  // 中: 背の台と電話機（本体・受話器・硬貨の口）・電話帳の棚
  p.box(fr, [-0.35, 0.9, -h + 0.03], [0.35, 0.93, -h + 0.3], {});
  const ph = p.sub([0.0, 0.93, -h + 0.12]);
  ph.box('#4f8f6a', [-0.11, 0, -0.08], [0.11, 0.24, 0.08], { r: 0.02 });
  ph.box('#2a3233', [-0.1, 0.24, -0.02], [0.1, 0.28, 0.04], { r: 0.02 });
  ph.box('#e7f4ef', [-0.06, 0.12, 0.08], [0.06, 0.18, 0.083], { kind: 'glow', shadow: false });
  ph.box('#141c1c', [0.03, 0.2, 0.08], [0.07, 0.205, 0.084], { shadow: false });
  p.box(shade(fr, -0.3), [-0.3, 0.45, -h + 0.03], [0.3, 0.48, -h + 0.28], {});
  p.box('#c9b98f', [-0.25, 0.48, -h + 0.06], [0.05, 0.53, -h + 0.25], { r: 0.006 });
  p.collide([-h - 0.04, 0, -h - 0.04], [h + 0.04, top + 0.3, h + 0.04]);
}

/** 丸型ポスト（前 +z に差し入れ口 2 つ） */
export function postBox(p: Prop, o: { red?: string } = {}): void {
  const red = o.red ?? '#c9433b';
  const R = 0.2;
  // 足元の台（コンクリート）・胴・つばのある笠・頭の玉
  p.box('#9aa29e', [-0.26, 0, -0.26], [0.26, 0.05, 0.26], { r: 0.01 });
  p.lathe(red, [[0, 0.05], [R + 0.018, 0.05], [R + 0.018, 0.1], [R, 0.11], [R, 1.0], [0, 1.0]], [0, 0, 0], { seg: 22, collide: true });
  p.lathe(red, [[0, 1.0], [R + 0.05, 1.0], [R + 0.05, 1.035], [R + 0.02, 1.06], [R - 0.01, 1.15], [R * 0.6, 1.24], [R * 0.25, 1.28], [0, 1.285]], [0, 0, 0], { seg: 22 });
  p.ball(red, [0, 1.3, 0], 0.035, { seg: 10 });
  // 差し入れ口（暗い口と、上のひさし）。胴の前の面に沿って左右に 2 つ
  for (const a of [-0.32, 0.32]) {
    const s = p.sub([Math.sin(a) * R, 0.88, Math.cos(a) * R], a);
    s.box('#141c1c', [-0.055, 0, -0.01], [0.055, 0.025, 0.006]);
    s.box(red, [-0.07, 0.025, -0.01], [0.07, 0.045, 0.03], { r: 0.008 });
  }
  // 前の白い札（取り集めの時刻）と、後ろの取り出しの扉（継ぎ目と鍵）
  p.sub([0, 0.62, R], 0).box('#f4f4ee', [-0.07, 0, -0.004], [0.07, 0.17, 0.004], { shadow: false });
  const b = p.sub([0, 0, -R], Math.PI);
  b.box(shade(red, -0.6), [-0.12, 0.3, -0.006], [0.12, 0.304, 0.004], { shadow: false });
  b.box(shade(red, -0.6), [-0.12, 0.78, -0.006], [0.12, 0.784, 0.004], { shadow: false });
  b.cyl('#c8d0cc', [0.08, 0.6, 0.006], 0.014, 0.012, { axis: 'z', seg: 10, shadow: false });
}

/** エアコンの室外機（前 +z。左に吹き出しの丸い格子） */
export function acUnit(p: Prop, o: { body?: string } = {}): void {
  const body = o.body ?? '#dcdfd8';
  const dark = '#2a3233';
  const W = 0.8;
  const D = 0.28;
  // 足（樹脂の台 2 本）・本体
  for (const x of [-0.3, 0.3]) p.box('#5f6c6a', [x - 0.05, 0, -D / 2 - 0.02], [x + 0.05, 0.08, D / 2 + 0.02], { r: 0.008 });
  p.box(body, [-W / 2, 0.08, -D / 2], [W / 2, 0.66, D / 2], { r: 0.012, collide: true });
  // 吹き出し: 暗い丸い口・羽根の軸・格子の輪と縦横の線
  const fx = -0.13;
  const fy = 0.36;
  p.cyl(dark, [fx, fy, D / 2], 0.21, 0.006, { axis: 'z', seg: 24, shadow: false });
  p.cyl('#5f6c6a', [fx, fy, D / 2 + 0.004], 0.05, 0.01, { axis: 'z', seg: 12, shadow: false });
  for (const r of [0.08, 0.13, 0.18]) p.torus(shade(body, -0.15), [fx, fy, D / 2 + 0.012], r, 0.004, { axis: 'z', seg: 24, shadow: false });
  p.torus(body, [fx, fy, D / 2 + 0.006], 0.21, 0.012, { axis: 'z', seg: 24, shadow: false });
  p.box(shade(body, -0.15), [fx - 0.2, fy - 0.004, D / 2 + 0.008], [fx + 0.2, fy + 0.004, D / 2 + 0.016], { shadow: false });
  p.box(shade(body, -0.15), [fx - 0.004, fy - 0.2, D / 2 + 0.008], [fx + 0.004, fy + 0.2, D / 2 + 0.016], { shadow: false });
  // 右: 点検の板（継ぎ目）・銘板。右の横の面から配管（断熱材の白い管）
  p.box(shade(body, -0.4), [0.17, 0.12, D / 2], [0.172, 0.62, D / 2 + 0.003], { shadow: false });
  p.box('#f4f4ee', [0.22, 0.5, D / 2], [0.34, 0.56, D / 2 + 0.003], { shadow: false });
  p.tube('#e3e6df', [[W / 2, 0.22, 0.04], [W / 2 + 0.07, 0.22, 0.02], [W / 2 + 0.09, 0.3, -0.06], [W / 2 + 0.09, 0.62, -D / 2 + 0.02]], 0.025, { seg: 12, radial: 8 });
  // 背の熱交換器のひれ（暗い面）
  p.box(dark, [-W / 2 + 0.03, 0.12, -D / 2 - 0.004], [W / 2 - 0.03, 0.62, -D / 2 + 0.002], { shadow: false });
}

/** 信号の機器箱（線路の脇。前 +z に両開きの扉） */
export function signalCabinet(p: Prop, o: { body?: string; w?: number; h?: number } = {}): void {
  const body = o.body ?? '#a7b3ae';
  const W = o.w ?? 1.2;
  const H = o.h ?? 1.5;
  const D = 0.8;
  const y0 = 0.22;
  const dark = '#141c1c';
  // コンクリートの台（少し大きい）と、本体
  p.box('#8f9893', [-W / 2 - 0.08, 0, -D / 2 - 0.08], [W / 2 + 0.08, y0, D / 2 + 0.08], { r: 0.015, collide: true });
  p.box(body, [-W / 2, y0, -D / 2], [W / 2, y0 + H, D / 2], { r: 0.012, collide: true });
  // 屋根: 後ろへ下がる板（張り出し）
  p.extrude(shade(body, -0.2), [[-D / 2 - 0.06, y0 + H], [D / 2 + 0.07, y0 + H], [D / 2 + 0.07, y0 + H + 0.04], [-D / 2 - 0.06, y0 + H + 0.11]], 'zy', -W / 2 - 0.05, W / 2 + 0.05, { bevel: 0.006 });
  // 扉 2 枚（少し出た板）・真ん中の継ぎ目・取っ手・鍵
  const zf = D / 2;
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -W / 2 + 0.04 : 0.006;
    const xb = s < 0 ? -0.006 : W / 2 - 0.04;
    p.box(body, [xa, y0 + 0.05, zf], [xb, y0 + H - 0.05, zf + 0.012], { r: 0.004 });
    // がらり（扉の下と上に、斜めの羽板）
    for (const [ya, n] of [[y0 + 0.14, 4], [y0 + H - 0.3, 3]] as const) {
      p.box(shade(body, -0.65), [xa + 0.06, ya - 0.01, zf + 0.01], [xb - 0.06, ya + n * 0.045, zf + 0.013], { shadow: false });
      for (let k = 0; k < n; k++) p.sub([(xa + xb) / 2, ya + k * 0.045 + 0.02, zf + 0.016], 0, { pitch: 0.6 }).box(body, [-(xb - xa) / 2 + 0.06, -0.003, -0.016], [(xb - xa) / 2 - 0.06, 0.003, 0.016], { shadow: false });
    }
  }
  p.box(dark, [-0.003, y0 + 0.05, zf + 0.012], [0.003, y0 + H - 0.05, zf + 0.014], { shadow: false });
  for (const s of [-1, 1]) {
    p.box('#5f6c6a', [s * 0.05 - 0.015, y0 + H * 0.5 - 0.09, zf + 0.012], [s * 0.05 + 0.015, y0 + H * 0.5 + 0.09, zf + 0.035], { r: 0.008 });
  }
  p.cyl('#c8d0cc', [0.05, y0 + H * 0.5 + 0.14, zf + 0.016], 0.012, 0.008, { axis: 'z', seg: 8, shadow: false });
  // 番号の札（白）・注意の札（黄）
  p.box('#f4f4ee', [-W / 2 + 0.1, y0 + H - 0.2, zf + 0.012], [-W / 2 + 0.34, y0 + H - 0.1, zf + 0.015], { shadow: false });
  p.box('#d9b23a', [W / 2 - 0.3, y0 + H - 0.2, zf + 0.012], [W / 2 - 0.12, y0 + H - 0.1, zf + 0.015], { shadow: false });
  // 背の面: 点検の扉 1 枚の継ぎ目と下のがらり
  const zb = -D / 2 - 0.002;
  for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) p.box(shade(body, -0.5), [x - 0.003, y0 + 0.08, zb - 0.002], [x + 0.003, y0 + H - 0.08, zb + 0.002], { shadow: false });
  p.box(shade(body, -0.5), [-W / 2 + 0.12, y0 + H - 0.083, zb - 0.002], [W / 2 - 0.12, y0 + H - 0.077, zb + 0.002], { shadow: false });
  p.box(shade(body, -0.65), [-0.3, y0 + 0.14, zb - 0.003], [0.3, y0 + 0.32, zb + 0.001], { shadow: false });
  // 配線の管（台の横から地面へ下りる 2 本）
  for (const x of [-W / 2 + 0.25, -W / 2 + 0.45]) p.tube('#2a3233', [[x, y0 + 0.05, -D / 2 - 0.02], [x, 0.1, -D / 2 - 0.15], [x, -0.02, -D / 2 - 0.35]], 0.035, { seg: 8, radial: 8 });
}

/** 屋内消火栓の箱（壁に付ける。前 +z。箱の下端 y = 0.5） */
export function hydrantBox(p: Prop, o: { red?: string } = {}): void {
  const red = o.red ?? '#c9433b';
  const W = 0.7;
  const D = 0.18;
  const y0 = 0.5;
  const y1 = 1.4;
  // 箱（枠）と、少し出た扉・継ぎ目・取っ手・白い札（消火栓）・上の赤い表示灯（笠と光る玉）
  p.box(shade(red, -0.2), [-W / 2, y0, -D / 2], [W / 2, y1, D / 2], { r: 0.01, collide: true });
  p.box(red, [-W / 2 + 0.03, y0 + 0.03, D / 2], [W / 2 - 0.03, y1 - 0.03, D / 2 + 0.012], { r: 0.006 });
  p.box('#f4f4ee', [-0.16, y1 - 0.22, D / 2 + 0.012], [0.16, y1 - 0.1, D / 2 + 0.015], { shadow: false });
  for (let k = 0; k < 3; k++) p.box('#c9433b', [-0.12 + k * 0.09, y1 - 0.19, D / 2 + 0.015], [-0.06 + k * 0.09, y1 - 0.13, D / 2 + 0.017], { shadow: false });
  p.box('#9aa5a1', [W / 2 - 0.1, y0 + 0.38, D / 2 + 0.012], [W / 2 - 0.07, y0 + 0.52, D / 2 + 0.035], { r: 0.008 });
  p.box(shade(red, -0.6), [-W / 2 + 0.06, y0 + 0.12, D / 2 + 0.012], [W / 2 - 0.06, y0 + 0.124, D / 2 + 0.014], { shadow: false });
  p.box(shade(red, -0.2), [-0.08, y1 + 0.06, -0.04], [0.08, y1 + 0.08, D / 2 - 0.02], { r: 0.006 });
  p.ball('#e8584a', [0, y1 + 0.13, D / 2 - 0.1], 0.06, { kind: 'glow', seg: 12, shadow: false });
  p.cyl('#5f6c6a', [0, y1 + 0.07, D / 2 - 0.1], 0.065, 0.02, { seg: 14 });
}
