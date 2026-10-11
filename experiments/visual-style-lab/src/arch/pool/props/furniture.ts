import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop, V2 } from '../../../props/kit.ts';
import { PC, PG } from './mats.ts';
import { arc, bend, cw, R1, roundRect } from './shape.ts';

/**
 * 部屋の家具と設備（ロッカー・下足箱・化粧台・洗面台・便所の個室・シャワーの仕切り・手の乾燥機・体重計・水着の脱水機・
 * 事務机・テーブル・ソファ・救護のベッド・背板・流し台・冷蔵庫・受付の台・入場ゲート・AED）。正面 +z、床 y = 0。
 * 寸法の根拠: ロッカー 1 列の幅 0.3〜0.4 m・奥行き 0.45 m・高さ 1.8 m。下足箱の升目 0.3 × 0.3 m（木札の鍵）。
 * 化粧台の天板 0.72 m・奥行き 0.5 m。洗面台 0.78〜0.8 m。便器の座面 0.4 m・個室 1.0 × 1.4 m。事務机 0.7 m。
 * 受付の台 1.05 m（客の側）・0.72 m（係の側）。入場ゲートの箱 1.0 m・長さ 1.2 m。AED の箱 0.42 × 0.5 m（床から 1.0 m）
 */

const KEY_COLORS = [PC.red, PC.yellow, PC.blue, PC.teal, PC.red];

/**
 * ロッカーの列（n 列 × rows 段。背 -z、扉の面 +z）: 側板と天板・扉の隙間に見える暗い面・台輪・扉ごとの通気の切れ目・
 * 番号の札・鍵と手首に付けるゴムの輪。cell は番号の札の中心（局所）を受け取る（場面で番号の図柄を貼る）
 */
export function lockerBank(p: Prop, o: { n: number; rows: number; w?: number; h?: number; d?: number; keys?: number; color?: string; cell?: (c: V3) => void }): void {
  const w = o.w ?? 0.4;
  const H = o.h ?? 1.8;
  const D = o.d ?? 0.45;
  const W = o.n * w;
  const body = o.color ?? PC.mint;
  const zf = D / 2;
  const base = 0.1;
  const side = 0.016;
  p.box(PC.tealDark, [-W / 2 + 0.01, 0, -D / 2 + 0.02], [W / 2 - 0.01, base, zf - 0.05]);
  for (const sx of [-1, 1]) p.box(body, [sx > 0 ? W / 2 - side : -W / 2, base - 0.004, -D / 2], [sx > 0 ? W / 2 : -W / 2 + side, H, zf], R1(0.004));
  p.box(body, [-W / 2, H - 0.018, -D / 2], [W / 2, H, zf + 0.004], R1(0.004));
  p.box(body, [-W / 2 + side, base, -D / 2], [W / 2 - side, H - 0.018, -D / 2 + 0.012], { shadow: 'receive' });
  p.box(PC.tealDark, [-W / 2 + side, base, zf - 0.03], [W / 2 - side, H - 0.018, zf - 0.02], { shadow: 'receive' });
  const rh = (H - 0.018 - base) / o.rows;
  const keys = o.keys ?? 0.8;
  for (let i = 0; i < o.n; i++) {
    const x0 = -W / 2 + i * w;
    const dx0 = i === 0 ? -W / 2 + side + 0.003 : x0 + 0.006;
    const dx1 = i === o.n - 1 ? W / 2 - side - 0.003 : x0 + w - 0.006;
    const xc = (dx0 + dx1) / 2;
    const dw = dx1 - dx0;
    for (let j = 0; j < o.rows; j++) {
      const y0 = base + j * rh + 0.006;
      const y1 = base + (j + 1) * rh - 0.006;
      p.box(body, [dx0, y0, zf - 0.02], [dx1, y1, zf], { shadow: 'receive' });
      for (let k = 0; k < 2; k++) p.box(PC.tealDark, [xc - dw * 0.3, y1 - 0.052 - k * 0.016, zf], [xc + dw * 0.3, y1 - 0.045 - k * 0.016, zf + 0.002], { shadow: false });
      p.box(PC.white, [xc - 0.034, y1 - 0.118, zf], [xc + 0.034, y1 - 0.086, zf + 0.002], { shadow: false });
      o.cell?.([xc, y1 - 0.102, zf + 0.003]);
      const lx = dx1 - 0.045;
      const ym = y0 + Math.min((y1 - y0) * 0.5, 0.5);
      p.box(PC.steel, [lx - 0.017, ym - 0.04, zf], [lx + 0.017, ym + 0.032, zf + 0.016], { shadow: false });
      p.box(PC.ink, [lx - 0.004, ym + 0.002, zf + 0.016], [lx + 0.004, ym + 0.02, zf + 0.018], { shadow: false });
      if (p.r() < keys) {
        p.box(PC.steel, [lx - 0.007, ym - 0.05, zf + 0.012], [lx + 0.007, ym - 0.02, zf + 0.02], { shadow: false });
        p.torus(KEY_COLORS[Math.floor(p.r() * KEY_COLORS.length)], [lx, ym - 0.088, zf + 0.022], 0.034, 0.0065, { seg: 8, shadow: false });
      }
    }
  }
  p.collide([-W / 2, 0, -D / 2], [W / 2, H, zf + 0.03]);
}

/** 下足箱（小さな扉の升目。木札の鍵・番号の札・指を掛ける切れ目）。cell は番号の札の中心 */
export function shoeLockerBank(p: Prop, o: { n: number; rows: number; d?: number; cell?: (c: V3) => void }): void {
  const w = 0.3;
  const W = o.n * w;
  const D = o.d ?? 0.38;
  const base = 0.1;
  const H = base + o.rows * 0.3 + 0.02;
  const zf = D / 2;
  p.box(PC.tealDark, [-W / 2 + 0.01, 0, -D / 2 + 0.02], [W / 2 - 0.01, base, zf - 0.05]);
  for (const sx of [-1, 1]) p.box(PC.pale, [sx > 0 ? W / 2 - 0.018 : -W / 2, base - 0.004, -D / 2], [sx > 0 ? W / 2 : -W / 2 + 0.018, H, zf], R1(0.004));
  p.box(PC.pale, [-W / 2, H - 0.02, -D / 2], [W / 2, H, zf + 0.005], R1(0.005));
  p.box(PC.pale, [-W / 2, base, -D / 2], [W / 2, H, -D / 2 + 0.012], { shadow: 'receive' });
  p.box(PC.tealDark, [-W / 2 + 0.018, base, zf - 0.028], [W / 2 - 0.018, H - 0.02, zf - 0.018], { shadow: 'receive' });
  for (let i = 0; i < o.n; i++)
    for (let j = 0; j < o.rows; j++) {
      const x0 = -W / 2 + i * w + (i === 0 ? 0.02 : 0.004);
      const x1 = -W / 2 + (i + 1) * w - (i === o.n - 1 ? 0.02 : 0.004);
      const y0 = base + j * 0.3 + 0.004;
      const y1 = y0 + 0.292;
      const xc = (x0 + x1) / 2;
      p.box(PC.white, [x0, y0, zf - 0.018], [x1, y1, zf], { shadow: 'receive' });
      p.box(PC.ink, [xc - 0.05, y0 + 0.03, zf], [xc + 0.05, y0 + 0.04, zf + 0.002], { shadow: false });
      p.box(PC.white, [xc - 0.04, y1 - 0.075, zf], [xc + 0.04, y1 - 0.025, zf + 0.002], { shadow: false });
      o.cell?.([xc, y1 - 0.05, zf + 0.003]);
      // 木札の鍵（金具の板・差した木の札）
      p.box(PC.steel, [xc - 0.028, y0 + 0.085, zf], [xc + 0.028, y0 + 0.19, zf + 0.006], { shadow: false });
      if (p.r() < 0.85) p.box(PC.wood, [xc - 0.016, y0 + 0.1, zf + 0.006], [xc + 0.016, y0 + 0.2, zf + 0.014], { ...R1(0.003), shadow: false });
      else p.box(PC.ink, [xc - 0.012, y0 + 0.16, zf + 0.006], [xc + 0.012, y0 + 0.165, zf + 0.007], { shadow: false });
    }
  p.collide([-W / 2, 0, -D / 2], [W / 2, H, zf + 0.02]);
}

/** 化粧台（白い天板・青緑の前の帯・支えの板・長い鏡と上の灯り・ドライヤーと掛ける輪・時間の箱・丸い腰掛け）。背 -z が壁 */
export function vanity(p: Prop, w: number): void {
  const zb = -0.26;
  const zf = 0.24;
  const ht = 0.72;
  p.box(PC.white, [-w / 2, ht, zb], [w / 2, ht + 0.04, zf], R1(0.012));
  p.box(PC.teal, [-w / 2, ht - 0.12, zf - 0.025], [w / 2, ht, zf], R1(0.006));
  const ns = Math.max(1, Math.round(w / 1.8));
  for (let i = 0; i <= ns; i++) {
    const x = -w / 2 + 0.015 + (i * (w - 0.03)) / ns;
    p.box(PC.pale, [x - 0.015, 0, zb], [x + 0.015, ht, zf - 0.05]);
  }
  p.box(PC.white, [-w / 2, ht + 0.04, zb], [w / 2, ht + 0.14, zb + 0.02]);
  // 鏡（金属の裏板とガラス）と上の灯り
  p.box(PC.chrome, [-w / 2 + 0.06, 0.98, zb], [w / 2 - 0.06, 1.76, zb + 0.008], { shadow: 'receive' });
  p.box('#cfe6e0', [-w / 2 + 0.08, 1.0, zb + 0.008], [w / 2 - 0.08, 1.74, zb + 0.014], { kind: 'glass', shadow: false });
  p.box(PC.white, [-w / 2 + 0.06, 1.8, zb], [w / 2 - 0.06, 1.88, zb + 0.09], R1(0.012));
  p.box(PG.lamp, [-w / 2 + 0.09, 1.795, zb + 0.015], [w / 2 - 0.09, 1.8, zb + 0.075], { kind: 'glow', shadow: false });
  for (let x = -w / 2 + 0.45; x < w / 2 - 0.3; x += 0.9) {
    // ドライヤー（掛ける輪に先を下にして差す）・巻いた線・時間の箱（硬貨の口と表示）
    const hx = x + 0.26;
    p.rod(PC.steel, [hx, 0.92, zb], [hx, 0.92, zb + 0.07], 0.006, { radial: 4 });
    p.torus(PC.steel, [hx, 0.92, zb + 0.11], 0.042, 0.007, { axis: 'y', seg: 12 });
    p.cyl(PC.ink, [hx, 0.93, zb + 0.11], 0.04, 0.12, { seg: 10 });
    p.cyl(PC.rubber, [hx, 0.85, zb + 0.11], 0.028, 0.05, { seg: 8 });
    p.box(PC.ink, [hx - 0.016, 0.99, zb + 0.085], [hx + 0.016, 1.11, zb + 0.115], R1(0.008));
    p.tube(PC.ink, [[hx, 1.11, zb + 0.1], [hx - 0.05, 1.04, zb + 0.06], [hx - 0.12, 0.93, zb + 0.04], [hx - 0.16, 0.86, zb + 0.03]], 0.005, { seg: 12, radial: 4, shadow: false });
    p.box(PC.dark, [x + 0.04, ht + 0.06, zb], [x + 0.16, ht + 0.22, zb + 0.06], R1(0.006));
    p.box(PG.red, [x + 0.06, ht + 0.17, zb + 0.06], [x + 0.14, ht + 0.195, zb + 0.062], { kind: 'glow', shadow: false });
    p.box(PC.chrome, [x + 0.07, ht + 0.1, zb + 0.06], [x + 0.13, ht + 0.12, zb + 0.064], { shadow: false });
    // 天板の上の小物（綿棒の入れ物・ティッシュの箱）
    if (p.r() < 0.6) p.box(PC.white, [x - 0.18, ht + 0.04, zb + 0.06], [x - 0.04, ht + 0.11, zb + 0.15], R1(0.008));
    if (p.r() < 0.4) p.lathe(PC.teal, [[0, 0], [0.03, 0], [0.032, 0.08], [0, 0.08]], [x - 0.27, ht + 0.04, zb + 0.1], { seg: 10 });
    // 丸い腰掛け（座面・柱・台）
    const sz = zf + 0.28;
    p.lathe(PC.teal, [[0, 0], [0.16, 0], [0.17, 0.02], [0.165, 0.055], [0, 0.06]], [x, 0.42, sz], { seg: 16 });
    p.rod(PC.chrome, [x, 0.03, sz], [x, 0.42, sz], 0.022, { radial: 8 });
    p.lathe(PC.chrome, [[0, 0], [0.17, 0], [0.165, 0.015], [0.04, 0.035], [0, 0.035]], [x, 0, sz], { seg: 16 });
    p.collide([x - 0.17, 0, sz - 0.17], [x + 0.17, 0.48, sz + 0.17]);
  }
  p.collide([-w / 2, 0, zb], [w / 2, ht + 0.14, zf]);
}

/** 洗面台（穴を抜いた天板・陶器の鉢・前の幕板・曲がった蛇口・排水の管・鏡・石けんの入れ物）。背 -z が壁（z = -0.25） */
export function washbasin(p: Prop): void {
  const zb = -0.25;
  const top = 0.8;
  const hole = cw(arc([0, -0.02], 0.17, 0, Math.PI * 2, 20).slice(0, 20));
  p.extrude(PC.white, [[-0.3, zb], [0.3, zb], [0.3, 0.22], [-0.3, 0.22]], 'xz', top - 0.04, top, { holes: [hole] });
  p.lathe(PC.white, [[0.175, top - 0.005], [0.165, top - 0.03], [0.145, top - 0.09], [0.1, top - 0.13], [0.04, top - 0.145], [0, top - 0.15]], [0, 0, -0.02], { seg: 20 });
  p.lathe(PC.white, [[0, top - 0.16], [0.06, top - 0.155], [0.13, top - 0.12], [0.175, top - 0.04], [0.18, top - 0.04]], [0, 0, -0.02], { seg: 20 });
  p.cyl(PC.chrome, [0, top - 0.148, -0.02], 0.022, 0.006, { seg: 10, shadow: false });
  p.box(PC.white, [-0.3, top - 0.14, 0.18], [0.3, top - 0.04, 0.22], R1(0.008));
  // 蛇口（台・曲がった口・レバー）
  p.cyl(PC.chrome, [0, top + 0.02, zb + 0.06], 0.024, 0.04, { seg: 10 });
  p.tube(PC.chrome, bend([[0, top + 0.03, zb + 0.06], [0, top + 0.19, zb + 0.06], [0, top + 0.19, zb + 0.17], [0, top + 0.13, zb + 0.18]], 0.05), 0.011, { seg: 24, radial: 6 });
  p.box(PC.chrome, [-0.008, top + 0.2, zb + 0.03], [0.008, top + 0.215, zb + 0.1], R1(0.004));
  // 排水の管（鉢の下から壁へ）
  p.tube(PC.chrome, bend([[0, top - 0.15, -0.02], [0, top - 0.36, -0.02], [0, top - 0.36, zb]], 0.06), 0.018, { seg: 16, radial: 6 });
  // 鏡・石けんの入れ物
  p.box(PC.chrome, [-0.27, 1.05, zb], [0.27, 1.75, zb + 0.008], { shadow: 'receive' });
  p.box('#cfe6e0', [-0.255, 1.065, zb + 0.008], [0.255, 1.735, zb + 0.013], { kind: 'glass', shadow: false });
  p.box(PC.white, [0.17, 0.93, zb], [0.25, 1.1, zb + 0.08], R1(0.012));
  p.box(PC.chrome, [0.2, 0.92, zb + 0.06], [0.22, 0.95, zb + 0.085], { shadow: false });
  p.collide([-0.3, 0, zb], [0.3, top + 0.2, 0.22]);
}

/** 洋式の便器（楕円の台と胴・便座とふた・壁のフラッシュバルブと管）。原点は背の壁の床、+z へ伸びる */
export function toilet(p: Prop): void {
  // 楕円の輪郭（上から見た (x, z)。反時計回り）
  const oval = (cz: number, rx: number, rz: number, n = 16): V2[] => arc([0, 0], 1, 0, Math.PI * 2, n).slice(0, n).map(([a, b]) => [a * rx, cz + b * rz] as V2);
  p.extrude(PC.white, oval(0.36, 0.13, 0.17), 'xz', 0, 0.22, { bevel: 0.02 });
  p.extrude(PC.white, oval(0.4, 0.18, 0.25), 'xz', 0.2, 0.38, { bevel: 0.03 });
  p.box(PC.white, [-0.13, 0.12, 0.0], [0.13, 0.38, 0.2], R1(0.03));
  p.extrude(PC.pale, oval(0.42, 0.175, 0.24), 'xz', 0.38, 0.405, { bevel: 0.008, holes: [cw(oval(0.43, 0.11, 0.15))] });
  // ふた（後ろの蝶番で起こす）
  p.sub([0, 0.405, 0.18], 0, { pitch: -1.45 }).extrude(PC.pale, oval(0.24, 0.17, 0.235), 'xz', 0, 0.02, { bevel: 0.006 });
  // フラッシュバルブ（壁の金具・管・レバー）
  p.box(PC.chrome, [-0.04, 0.9, 0], [0.04, 0.98, 0.02], R1(0.006));
  p.tube(PC.chrome, bend([[0, 0.94, 0.02], [0, 0.94, 0.09], [0, 0.4, 0.09]], 0.04), 0.016, { seg: 20, radial: 6 });
  p.cyl(PC.chrome, [0, 0.96, 0.09], 0.032, 0.12, { seg: 10 });
  p.rod(PC.chrome, [0.03, 0.96, 0.09], [0.13, 0.94, 0.11], 0.008, { radial: 4 });
  p.collide([-0.2, 0, 0], [0.2, 0.45, 0.66]);
}

/** 便所の個室（仕切りの板と脚・前の柱と上の横木・内へ開いた扉と表示錠・便器・紙巻き・汚物入れ）。原点は扉の線の真ん中、奥の壁は z = -dp */
export function cubicle(p: Prop, w: number, dp: number, wallL: boolean): void {
  const panel = (x: number): void => {
    p.box(PC.pale, [x - 0.013, 0.13, -dp], [x + 0.013, 2.0, -0.035], { ...R1(0.006), collide: true });
    p.cyl(PC.chrome, [x, 0.065, -0.2], 0.018, 0.13, { seg: 8 });
  };
  if (wallL) panel(-w / 2);
  panel(w / 2);
  p.box(PC.steel, [w / 2 - 0.035, 0, -0.035], [w / 2 + 0.035, 2.05, 0.0], R1(0.006));
  if (wallL) p.box(PC.steel, [-w / 2 - 0.035, 0, -0.035], [-w / 2 + 0.035, 2.05, 0.0], R1(0.006));
  p.box(PC.steel, [-w / 2, 2.0, -0.04], [w / 2, 2.05, 0.0], R1(0.008));
  // 扉（左の蝶番で内へ開く）・表示錠・取っ手・蝶番・服掛け
  const dw = w - 0.08;
  const door = p.sub([-w / 2 + 0.04, 0.13, -0.02], 1.15);
  door.box(PC.teal, [0, 0, -0.012], [dw, 1.85, 0.012], R1(0.006));
  door.box(PC.steel, [dw - 0.07, 0.95, 0.012], [dw - 0.02, 1.07, 0.02], R1(0.004));
  door.box(PC.blue, [dw - 0.06, 1.02, 0.02], [dw - 0.03, 1.05, 0.022], { shadow: false });
  door.ball(PC.chrome, [dw - 0.045, 0.9, 0.03], 0.018, { seg: 8 });
  door.ball(PC.chrome, [dw - 0.045, 0.9, -0.03], 0.018, { seg: 8 });
  for (const y of [0.25, 1.6]) door.box(PC.steel, [-0.01, y, -0.015], [0.03, y + 0.1, 0.015]);
  door.box(PC.chrome, [dw / 2 - 0.02, 1.62, -0.05], [dw / 2 + 0.02, 1.66, -0.012], R1(0.006));
  toilet(p.sub([0, 0, -dp]));
  // 紙巻き（右の仕切りの内側）・汚物入れ
  p.box(PC.chrome, [w / 2 - 0.013 - 0.06, 0.7, -dp + 0.5], [w / 2 - 0.013, 0.74, -dp + 0.7], R1(0.006));
  p.cyl(PC.white, [w / 2 - 0.013 - 0.06, 0.655, -dp + 0.6], 0.055, 0.11, { axis: 'z', seg: 12 });
  p.box(PC.white, [-w / 2 + 0.03, 0, -dp + 0.03], [-w / 2 + 0.2, 0.3, -dp + 0.25], R1(0.02));
  p.box(PC.pale, [-w / 2 + 0.03, 0.3, -dp + 0.03], [-w / 2 + 0.2, 0.32, -dp + 0.25], R1(0.008));
}

/** シャワーの仕切り（仕切りの板・混ぜる弁と取っ手・立ち上がりの管・腕・丸いシャワーの頭・石けんの棚）。原点は前の線の真ん中、奥の壁は z = -dp */
export function showerStall(p: Prop, w: number, dp: number, wallL: boolean, wallR: boolean): void {
  for (const [on, x] of [[wallL, -w / 2], [wallR, w / 2]] as [boolean, number][]) if (on) p.box(PC.pale, [x - 0.02, 0.1, -dp], [x + 0.02, 2.0, 0], { ...R1(0.012), collide: true });
  const z = -dp;
  p.box(PC.chrome, [-0.1, 1.0, z], [0.1, 1.08, z + 0.06], R1(0.012));
  for (const [sx, col] of [[-1, PC.red], [1, PC.blue]] as [number, string][]) {
    p.cyl(PC.chrome, [sx * 0.07, 1.04, z + 0.08], 0.022, 0.04, { axis: 'z', seg: 10 });
    p.box(PC.chrome, [sx * 0.07 - 0.008, 1.04, z + 0.09], [sx * 0.07 + 0.008, 1.12, z + 0.105], R1(0.004));
    p.cyl(col, [sx * 0.07, 1.04, z + 0.101], 0.01, 0.004, { axis: 'z', seg: 8, shadow: false });
  }
  p.tube(PC.chrome, bend([[0, 1.08, z + 0.035], [0, 2.08, z + 0.035], [0, 2.08, z + 0.27]], 0.06), 0.012, { seg: 30, radial: 6 });
  p.box(PC.chrome, [-0.03, 1.6, z], [0.03, 1.64, z + 0.04], { shadow: false });
  p.lathe(PC.chrome, [[0, 0], [0.075, 0], [0.08, 0.012], [0.04, 0.035], [0.014, 0.05], [0, 0.05]], [0, 2.0, z + 0.27], { seg: 16 });
  p.cyl(PC.steel, [0, 1.999, z + 0.27], 0.068, 0.002, { seg: 16, shadow: false });
  // 石けんの棚と瓶
  p.box(PC.white, [0.18, 1.2, z], [0.4, 1.225, z + 0.12], R1(0.008));
  if (p.r() < 0.7) p.lathe(p.r() < 0.5 ? PC.white : PC.teal, [[0, 0], [0.03, 0], [0.032, 0.12], [0.012, 0.15], [0, 0.15]], [0.26, 1.225, z + 0.06], { seg: 10 });
}

/** 手の乾燥機（ジェット式: 背の箱・下の受け・上の手を入れる口・青緑の帯・表示灯・下の水受け）。原点は壁の床 */
export function handDryer(p: Prop): void {
  p.box(PC.white, [-0.15, 0.95, 0], [0.15, 1.6, 0.1], R1(0.03));
  p.box(PC.white, [-0.15, 0.95, 0.1], [0.15, 1.24, 0.22], R1(0.03));
  p.box(PC.white, [-0.15, 1.46, 0.1], [0.15, 1.6, 0.2], R1(0.03));
  p.box(PC.ink, [-0.12, 1.24, 0.1], [0.12, 1.46, 0.105], { shadow: false });
  p.box(PC.teal, [-0.151, 1.47, 0.1], [0.151, 1.5, 0.2], { shadow: false });
  p.box(PG.green, [0.08, 1.54, 0.2], [0.11, 1.55, 0.202], { kind: 'glow', shadow: false });
  p.box(PC.pale, [-0.12, 0.9, 0.02], [0.12, 0.95, 0.18], R1(0.012));
  p.collide([-0.15, 0.9, 0], [0.15, 1.6, 0.22]);
}

/** 体重計（台・ゴムの面・後ろの柱・表示の頭） */
export function weighScale(p: Prop): void {
  p.box(PC.white, [-0.19, 0, -0.22], [0.19, 0.07, 0.22], R1(0.02));
  p.box(PC.rubber, [-0.16, 0.07, -0.14], [0.16, 0.074, 0.19], { shadow: 'receive' });
  p.rod(PC.steel, [0, 0.07, -0.19], [0, 1.0, -0.19], 0.025, { radial: 10 });
  p.sub([0, 1.0, -0.19], 0, { pitch: 0.35 }).box(PC.white, [-0.14, 0, -0.06], [0.14, 0.17, 0.05], R1(0.02));
  p.sub([0, 1.0, -0.19], 0, { pitch: 0.35 }).box(PG.aqua, [-0.1, 0.06, 0.05], [0.1, 0.12, 0.053], { kind: 'glow', shadow: false });
  p.collide([-0.19, 0, -0.25], [0.19, 1.2, 0.22]);
}

/** 水着の脱水機（白い箱・上の丸いふたと取っ手・前の青い札・硬貨の箱・後ろの排水の管） */
export function spinner(p: Prop): void {
  p.box(PC.dark, [-0.23, 0, -0.25], [0.23, 0.06, 0.25]);
  p.box(PC.white, [-0.25, 0.06, -0.27], [0.25, 0.86, 0.27], R1(0.03));
  p.torus(PC.ink, [0, 0.862, 0], 0.19, 0.008, { axis: 'y', seg: 20, shadow: false });
  p.lathe(PC.pale, [[0, 0], [0.185, 0], [0.18, 0.02], [0.12, 0.035], [0, 0.04]], [0, 0.86, 0], { seg: 20 });
  p.box(PC.chrome, [-0.06, 0.895, -0.015], [0.06, 0.92, 0.015], R1(0.008));
  p.box(PC.blue, [-0.2, 0.46, 0.27], [0.12, 0.74, 0.274], { shadow: false });
  for (let k = 0; k < 3; k++) p.box(PC.white, [-0.17, 0.66 - k * 0.06, 0.274], [-0.17 + 0.12 + (k % 2) * 0.1, 0.675 - k * 0.06, 0.276], { shadow: false });
  p.box(PC.steel, [0.13, 0.6, 0.27], [0.22, 0.76, 0.3], R1(0.008));
  p.box(PC.ink, [0.16, 0.72, 0.3], [0.19, 0.73, 0.302], { shadow: false });
  p.tube(PC.rubber, [[0.15, 0.1, -0.27], [0.15, 0.05, -0.36], [0.1, 0.01, -0.42]], 0.018, { seg: 10, radial: 6 });
  p.collide([-0.25, 0, -0.3], [0.25, 0.92, 0.3]);
}

/** 事務机（天板と前の縁・袖の引き出し 3 段と取っ手・右の脚の板・幕板・画面と台・キーボード・マウス・紙） */
export function desk(p: Prop, w = 1.4, o: { screen?: boolean } = {}): void {
  const D = 0.7;
  const ht = 0.72;
  p.box(PC.pale, [-w / 2, ht - 0.03, -D / 2], [w / 2, ht, D / 2], R1(0.008));
  p.box(PC.tealDark, [-w / 2, ht - 0.03, D / 2 - 0.004], [w / 2, ht, D / 2 + 0.002], { shadow: false });
  p.box(PC.metal, [-w / 2 + 0.01, 0.02, -D / 2 + 0.02], [-w / 2 + 0.41, ht - 0.03, D / 2 - 0.02]);
  for (const [a, b] of [[0.04, 0.3], [0.31, 0.49], [0.5, 0.66]]) {
    p.box(PC.metal, [-w / 2 + 0.015, a, D / 2 - 0.02], [-w / 2 + 0.405, b, D / 2], { shadow: 'receive' });
    p.box(PC.steel, [-w / 2 + 0.15, b - 0.04, D / 2], [-w / 2 + 0.27, b - 0.025, D / 2 + 0.012], { ...R1(0.004), shadow: false });
  }
  p.box(PC.metal, [w / 2 - 0.035, 0, -D / 2 + 0.02], [w / 2 - 0.01, ht - 0.03, D / 2 - 0.02]);
  p.box(PC.metal, [-w / 2 + 0.41, 0.25, -D / 2 + 0.02], [w / 2 - 0.035, ht - 0.03, -D / 2 + 0.035]);
  // 画面（台・首・薄い箱・面）
  p.box(PC.ink, [-0.1, ht, -0.27], [0.1, ht + 0.012, -0.13], R1(0.004));
  p.box(PC.ink, [-0.025, ht, -0.22], [0.025, ht + 0.17, -0.19]);
  p.box(PC.ink, [-0.27, ht + 0.1, -0.2], [0.27, ht + 0.43, -0.17], R1(0.008));
  if (o.screen ?? p.r() < 0.5) p.box(PG.aqua, [-0.25, ht + 0.12, -0.17], [0.25, ht + 0.41, -0.168], { kind: 'glow', shadow: false });
  else p.box(PC.dark, [-0.25, ht + 0.12, -0.17], [0.25, ht + 0.41, -0.168], { shadow: false });
  // キーボード・マウス・紙・湯のみ
  p.box(PC.white, [-0.22, ht, 0.0], [0.22, ht + 0.02, 0.15], R1(0.006));
  p.box(PC.steel, [-0.2, ht + 0.02, 0.012], [0.2, ht + 0.022, 0.13], { shadow: false });
  p.ball(PC.white, [0.31, ht + 0.012, 0.08], [0.03, 0.016, 0.05], { seg: 8 });
  const paper = p.sub([-0.45 + p.r() * 0.1, ht, 0.02], (p.r() - 0.5) * 0.5);
  paper.box(PC.white, [-0.105, 0, -0.15], [0.105, 0.006, 0.15], { shadow: 'receive' });
  if (p.r() < 0.5) p.lathe(PC.white, [[0, 0], [0.035, 0], [0.04, 0.09], [0, 0.09]], [0.45, ht, -0.15], { seg: 10 });
  p.collide([-w / 2, 0, -D / 2], [w / 2, ht, D / 2]);
}

/** テーブル（角の丸い天板・前の帯・管の 4 本脚と足の当て・脚をつなぐ枠） */
export function table(p: Prop, w: number, d: number, h = 0.72): void {
  p.box(PC.white, [-w / 2, h - 0.035, -d / 2], [w / 2, h, d / 2], R1(0.02));
  p.box(PC.metal, [-w / 2 + 0.06, h - 0.1, -d / 2 + 0.06], [w / 2 - 0.06, h - 0.035, -d / 2 + 0.08]);
  p.box(PC.metal, [-w / 2 + 0.06, h - 0.1, d / 2 - 0.08], [w / 2 - 0.06, h - 0.035, d / 2 - 0.06]);
  for (const x of [-w / 2 + 0.07, w / 2 - 0.07])
    for (const z of [-d / 2 + 0.07, d / 2 - 0.07]) {
      p.rod(PC.chrome, [x, 0.02, z], [x, h - 0.035, z], 0.02, { radial: 8 });
      p.cyl(PC.rubber, [x, 0.01, z], 0.022, 0.02, { seg: 8 });
    }
  p.collide([-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
}

/** ソファ（台・座面のクッション・背のクッション・肘掛け・短い脚） */
export function sofa(p: Prop, w: number): void {
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-0.32, 0.3]) p.cyl(PC.chrome, [x, 0.05, z], 0.022, 0.1, { seg: 8 });
  p.box(PC.tealDark, [-w / 2, 0.1, -0.4], [w / 2, 0.3, 0.38], R1(0.02));
  for (const sx of [-1, 1]) p.box(PC.teal, [sx > 0 ? w / 2 - 0.15 : -w / 2, 0.1, -0.4], [sx > 0 ? w / 2 : -w / 2 + 0.15, 0.62, 0.38], { r: 0.05, seg: 2 });
  p.box(PC.teal, [-w / 2 + 0.15, 0.3, -0.4], [w / 2 - 0.15, 0.82, -0.24], { r: 0.05, seg: 2 });
  const n = Math.max(1, Math.round((w - 0.3) / 0.62));
  const cw0 = (w - 0.3) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + 0.15 + i * cw0;
    p.box(PC.teal, [x0 + 0.006, 0.3, -0.24], [x0 + cw0 - 0.006, 0.45, 0.38], { r: 0.05, seg: 2 });
    p.sub([x0 + cw0 / 2, 0.45, -0.2], 0, { pitch: -0.2 }).box(PC.teal, [-cw0 / 2 + 0.01, 0, -0.06], [cw0 / 2 - 0.01, 0.36, 0.07], { r: 0.05, seg: 2 });
  }
  p.collide([-w / 2, 0, -0.4], [w / 2, 0.82, 0.38]);
}

/** 救護のベッド（管の脚とキャスター・横の枠・板・青緑のマットと敷いた紙・枕・頭の側の巻いた紙・足元の毛布） */
export function aidBed(p: Prop): void {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      p.rod(PC.chrome, [sx * 0.34, 0.08, sz * 0.86], [sx * 0.34, 0.52, sz * 0.86], 0.02, { radial: 8 });
      p.cyl(PC.ink, [sx * 0.34, 0.04, sz * 0.86], 0.04, 0.03, { axis: 'x', seg: 10 });
    }
  for (const sx of [-1, 1]) p.box(PC.steel, [sx * 0.36 - 0.02, 0.46, -0.9], [sx * 0.36 + 0.02, 0.52, 0.9], R1(0.006));
  for (const sz of [-1, 1]) p.rod(PC.steel, [-0.34, 0.2, sz * 0.86], [0.34, 0.2, sz * 0.86], 0.014, { radial: 6 });
  p.box(PC.metal, [-0.38, 0.52, -0.93], [0.38, 0.55, 0.93], R1(0.006));
  p.box(PC.teal, [-0.37, 0.55, -0.92], [0.37, 0.65, 0.92], { r: 0.03, seg: 2 });
  p.box(PC.white, [-0.3, 0.65, -0.55], [0.3, 0.653, 0.75], { shadow: 'receive' });
  p.box(PC.white, [-0.25, 0.65, -0.9], [0.25, 0.73, -0.62], { r: 0.04, seg: 2 });
  p.box(PC.blue, [-0.33, 0.65, 0.55], [0.33, 0.72, 0.85], { r: 0.025, seg: 2 });
  for (const sx of [-1, 1]) p.rod(PC.steel, [sx * 0.28, 0.58, -0.93], [sx * 0.28, 0.58, -1.0], 0.008, { radial: 4 });
  p.cyl(PC.white, [0, 0.58, -0.99], 0.055, 0.52, { axis: 'x', seg: 12 });
  p.collide([-0.4, 0, -1.05], [0.4, 0.73, 0.93]);
}

/** 背板（救助用の担架。黄の板に握りの穴の列・赤い帯 3 本・頭を留める台）。壁に立てかける。原点は壁の床 */
export function backboard(p: Prop): void {
  const s = p.sub([0, 0, 0.27], 0, { pitch: -0.13 });
  const holes: V2[][] = [];
  for (let k = 0; k < 5; k++) for (const x of [-0.155, 0.155]) holes.push(cw(roundRect([x, 0.24 + k * 0.34], 0.04, 0.15, 0.02, 2)));
  holes.push(cw(roundRect([0, 1.76], 0.16, 0.045, 0.02, 2)), cw(roundRect([0, 0.1], 0.16, 0.045, 0.02, 2)));
  s.extrude(PC.yellow, roundRect([0, 0.93], 0.42, 1.84, 0.07, 4), 'xy', -0.025, 0.025, { bevel: 0.01, holes });
  for (const y of [0.55, 1.0, 1.38]) s.box(PC.red, [-0.215, y - 0.025, -0.03], [0.215, y + 0.025, 0.032], { shadow: false });
  for (const sx of [-1, 1]) s.box(PC.red, [sx * 0.1 - 0.05, 1.5, 0.025], [sx * 0.1 + 0.05, 1.72, 0.14], R1(0.02));
  p.collide([-0.22, 0, 0.02], [0.22, 1.86, 0.3]);
}

/** 流し台（下の戸棚と取っ手・金属の天板に流しの穴と槽・蛇口・電子レンジ・電気ポット・上の吊り戸棚）。背 -z が壁（z = -0.3） */
export function kitchenette(p: Prop, w: number): void {
  const zb = -0.3;
  const zf = 0.3;
  p.box(PC.ink, [-w / 2 + 0.02, 0, zb + 0.02], [w / 2 - 0.02, 0.1, zf - 0.08]);
  p.box(PC.white, [-w / 2, 0.1, zb], [w / 2, 0.85, zf - 0.02]);
  const n = Math.max(2, Math.round(w / 0.45));
  const dw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * dw;
    p.box(PC.pale, [x0 + 0.004, 0.12, zf - 0.02], [x0 + dw - 0.004, 0.83, zf], { shadow: 'receive' });
    const hx = i % 2 === 0 ? x0 + dw - 0.05 : x0 + 0.05;
    p.box(PC.chrome, [hx - 0.008, 0.6, zf], [hx + 0.008, 0.76, zf + 0.022], R1(0.004));
  }
  // 天板（流しの穴）と流しの槽
  const sx0 = -w / 2 + 0.2;
  const sx1 = sx0 + 0.55;
  const top: V2[] = [[-w / 2 - 0.01, zb], [w / 2 + 0.01, zb], [w / 2 + 0.01, zf + 0.01], [-w / 2 - 0.01, zf + 0.01]];
  p.extrude(PC.chrome, top, 'xz', 0.85, 0.88, { holes: [cw(roundRect([(sx0 + sx1) / 2, -0.02], sx1 - sx0, 0.36, 0.04, 2))] });
  p.box(PC.steel, [sx0, 0.68, -0.2], [sx1, 0.69, 0.16]);
  for (const [a, b] of [[[sx0, 0.68, -0.2], [sx1, 0.86, -0.19]], [[sx0, 0.68, 0.15], [sx1, 0.86, 0.16]], [[sx0, 0.68, -0.2], [sx0 + 0.01, 0.86, 0.16]], [[sx1 - 0.01, 0.68, -0.2], [sx1, 0.86, 0.16]]] as [V3, V3][]) p.box(PC.steel, a, b, { shadow: 'receive' });
  p.tube(PC.chrome, bend([[(sx0 + sx1) / 2, 0.88, zb + 0.05], [(sx0 + sx1) / 2, 1.12, zb + 0.05], [(sx0 + sx1) / 2, 1.12, zb + 0.2], [(sx0 + sx1) / 2, 1.04, zb + 0.22]], 0.06), 0.012, { seg: 24, radial: 6 });
  // 電子レンジ・電気ポット
  const mx = w / 2 - 0.42;
  p.box(PC.white, [mx - 0.24, 0.88, zb + 0.03], [mx + 0.24, 1.17, zb + 0.4], R1(0.012));
  p.box(PC.ink, [mx - 0.21, 0.92, zb + 0.4], [mx + 0.08, 1.13, zb + 0.403], { shadow: false });
  p.box(PC.steel, [mx + 0.11, 0.92, zb + 0.4], [mx + 0.21, 1.13, zb + 0.403], { shadow: false });
  p.box(PC.chrome, [mx + 0.08, 0.95, zb + 0.4], [mx + 0.1, 1.1, zb + 0.42], R1(0.006));
  const kx = mx - 0.42;
  p.lathe(PC.white, [[0, 0], [0.09, 0], [0.095, 0.02], [0.09, 0.2], [0.07, 0.24], [0, 0.245]], [kx, 0.88, zb + 0.15], { seg: 14 });
  p.torus(PC.dark, [kx, 1.1, zb + 0.15], 0.06, 0.012, { axis: 'x', seg: 10, arc: Math.PI });
  // 吊り戸棚
  p.box(PC.pale, [-w / 2, 1.5, zb], [w / 2, 2.15, zb + 0.33]);
  for (let i = 1; i < n; i++) p.box(PC.tealDark, [-w / 2 + i * dw - 0.003, 1.52, zb + 0.33], [-w / 2 + i * dw + 0.003, 2.13, zb + 0.332], { shadow: false });
  for (let i = 0; i < n; i++) p.box(PC.chrome, [-w / 2 + (i + 0.5) * dw - 0.05, 1.53, zb + 0.33], [-w / 2 + (i + 0.5) * dw + 0.05, 1.545, zb + 0.35], R1(0.004));
  p.collide([-w / 2, 0, zb], [w / 2, 0.88, zf + 0.01]);
}

/** 冷蔵庫（白い胴・上の扉と下の引き出し・縦の取っ手・脚・貼り紙） */
export function fridge(p: Prop): void {
  p.box(PC.white, [-0.3, 0.02, -0.33], [0.3, 1.75, 0.28], R1(0.02));
  p.box(PC.white, [-0.296, 0.66, 0.28], [0.296, 1.745, 0.33], R1(0.015));
  p.box(PC.white, [-0.296, 0.04, 0.28], [0.296, 0.64, 0.33], R1(0.015));
  p.box(PC.steel, [-0.29, 0.64, 0.28], [0.29, 0.66, 0.3], { shadow: false });
  for (const [a, b] of [[0.9, 1.4], [0.45, 0.6]]) p.box(PC.chrome, [0.24, a, 0.33], [0.26, b, 0.36], R1(0.006));
  p.box(PC.white, [-0.18, 1.2, 0.33], [-0.03, 1.4, 0.332], { shadow: false });
  p.box(PC.yellow, [-0.12, 1.37, 0.332], [-0.09, 1.4, 0.338], { shadow: false });
  p.collide([-0.3, 0, -0.33], [0.3, 1.75, 0.36]);
}

/** 受付の台（客の側の白い前の板と継ぎ目・青緑の天板・係の側の低い台と支え・画面・キーボード・呼び鈴・皿・立て札）。客の側が +z */
export function frontDesk(p: Prop, w: number): void {
  p.box(PC.rubber, [-w / 2 + 0.02, 0, 0.1], [w / 2 - 0.02, 0.08, 0.18]);
  p.box(PC.white, [-w / 2, 0.08, 0.16], [w / 2, 1.05, 0.2]);
  for (let x = -w / 2 + 1.0; x < w / 2 - 0.2; x += 1.0) p.box(PC.tealDark, [x - 0.004, 0.08, 0.2], [x + 0.004, 1.05, 0.203], { shadow: false });
  p.box(PC.pale, [-w / 2, 0, -0.2], [w / 2, 1.05, 0.16]);
  p.box(PC.teal, [-w / 2 - 0.05, 1.05, -0.3], [w / 2 + 0.05, 1.1, 0.3], R1(0.015));
  p.box(PC.pale, [-w / 2, 0.72, -0.8], [w / 2, 0.76, -0.2], R1(0.008));
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) p.box(PC.metal, [x - 0.02, 0, -0.8], [x + 0.02, 0.72, -0.2]);
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 1.2) {
    p.box(PC.ink, [x - 0.1, 0.76, -0.62], [x + 0.1, 0.772, -0.48], R1(0.004));
    p.box(PC.ink, [x - 0.025, 0.76, -0.58], [x + 0.025, 0.95, -0.55]);
    p.box(PC.ink, [x - 0.25, 0.86, -0.56], [x + 0.25, 1.16, -0.53], R1(0.008));
    p.box(PG.aqua, [x - 0.23, 0.88, -0.53], [x + 0.23, 1.14, -0.528], { kind: 'glow', shadow: false });
    p.box(PC.white, [x - 0.2, 0.76, -0.42], [x + 0.2, 0.78, -0.28], R1(0.006));
    p.box(PC.white, [x + 0.3, 0.76, -0.5], [x + 0.51, 0.765, -0.2], { shadow: 'receive' });
    // 客の側: 呼び鈴・釣り銭の皿・立て札
    if (p.r() < 0.5) p.lathe(PC.chrome, [[0, 0], [0.045, 0], [0.04, 0.03], [0.02, 0.045], [0, 0.05]], [x - 0.3, 1.1, 0.12], { seg: 12 });
    p.box(PC.ink, [x - 0.08, 1.1, 0.06], [x + 0.08, 1.108, 0.2], R1(0.004));
    if (p.r() < 0.5) p.extrude(PC.white, [[0.06, 1.1], [0.18, 1.1], [0.12, 1.26]], 'zy', x + 0.25, x + 0.42, {});
  }
  p.collide([-w / 2 - 0.05, 0, -0.3], [w / 2 + 0.05, 1.1, 0.3]);
  p.collide([-w / 2, 0, -0.8], [w / 2, 0.76, -0.3]);
}

/** 入場ゲート（ステンレスの箱の列・上の暗い板と読み取りの光・端の矢印の灯り・開いて少しだけ出た扉の板）。通路は局所 z の向き */
export function gates(p: Prop, n: number, pitch = 0.9): void {
  const prof: V2[] = [[-0.6, 0], [0.6, 0], [0.6, 0.9], [0.56, 0.97], [0.46, 1.0], [-0.46, 1.0], [-0.56, 0.97], [-0.6, 0.9]];
  for (let i = 0; i <= n; i++) {
    const x = -(n * pitch) / 2 + i * pitch;
    p.box(PC.rubber, [x - 0.11, 0, -0.62], [x + 0.11, 0.01, 0.62], { shadow: 'receive' });
    p.extrude(PC.chrome, prof, 'zy', x - 0.1, x + 0.1, { bevel: 0.012 });
    p.box(PC.ink, [x - 0.085, 1.0, -0.42], [x + 0.085, 1.006, 0.42], { shadow: false });
    p.cyl(PG.blue, [x, 1.008, 0.28], 0.045, 0.004, { kind: 'glow', seg: 14, shadow: false });
    p.box(PG.green, [x - 0.04, 0.84, 0.6], [x + 0.04, 0.91, 0.603], { kind: 'glow', shadow: false });
    p.box(PG.red, [x - 0.04, 0.84, -0.603], [x + 0.04, 0.91, -0.6], { kind: 'glow', shadow: false });
    for (const sx of [-1, 1]) {
      if ((i === 0 && sx < 0) || (i === n && sx > 0)) continue;
      // 開いた扉の板（箱の横から少しだけ出る）
      const flap: V2[] = [[0, 0.5], [0.08, 0.5], [0.11, 0.62], [0.08, 0.76], [0, 0.76]];
      p.extrude(PC.teal, flap.map(([a, b]) => [x + sx * (0.1 + a), b] as V2), 'xy', -0.01, 0.01, {});
    }
    p.collide([x - 0.1, 0, -0.6], [x + 0.1, 1.0, 0.6]);
  }
}

/** AED の箱（白い箱・ガラスの戸と取っ手・中の AED の本体・赤い帯・上の案内の板） */
export function aedBox(p: Prop): void {
  p.box(PC.white, [-0.21, 1.02, 0], [0.21, 1.52, 0.2], R1(0.012));
  p.box(PC.pale, [-0.19, 1.04, 0.2], [0.19, 1.43, 0.205], { shadow: false });
  p.box(PC.yellow, [-0.13, 1.07, 0.03], [0.13, 1.36, 0.16], { r: 0.03, seg: 2 });
  p.box(PC.ink, [-0.06, 1.36, 0.08], [0.06, 1.39, 0.11], R1(0.008));
  p.box(PC.ink, [-0.08, 1.2, 0.16], [0.08, 1.3, 0.162], { shadow: false });
  p.box('#cfe6e0', [-0.18, 1.06, 0.205], [0.18, 1.42, 0.21], { kind: 'glass', shadow: false });
  p.box(PC.red, [-0.21, 1.43, 0.2], [0.21, 1.52, 0.214], R1(0.004));
  p.box(PC.white, [-0.12, 1.455, 0.214], [0.12, 1.495, 0.216], { shadow: false });
  p.box(PC.chrome, [0.15, 1.15, 0.21], [0.17, 1.33, 0.225], R1(0.006));
  p.box(PC.red, [-0.2, 1.62, 0], [0.2, 1.8, 0.012], R1(0.006));
  p.box(PC.white, [-0.16, 1.69, 0.012], [0.04, 1.74, 0.014], { shadow: false });
  p.ball(PC.white, [0.11, 1.71, 0.014], [0.035, 0.035, 0.004], { seg: 8, shadow: false });
  p.collide([-0.21, 1.0, 0], [0.21, 1.52, 0.23]);
}

/** 採暖室の暖房器（暗い箱と通気の切れ目・上の石の籠と石）。原点は床 */
export function saunaHeater(p: Prop, w = 0.9, d = 0.7): void {
  p.box(PC.ink, [-w / 2 + 0.03, 0, -d / 2 + 0.03], [w / 2 - 0.03, 0.06, d / 2 - 0.03]);
  p.box(PC.dark, [-w / 2, 0.06, -d / 2], [w / 2, 0.68, d / 2], R1(0.02));
  for (let k = 0; k < 5; k++) p.box(PC.ink, [-w / 2 + 0.12, 0.18 + k * 0.07, d / 2], [w / 2 - 0.12, 0.2 + k * 0.07, d / 2 + 0.003], { shadow: false });
  for (const [a, b] of [[[-w / 2, 0.68, -d / 2], [w / 2, 0.8, -d / 2 + 0.02]], [[-w / 2, 0.68, d / 2 - 0.02], [w / 2, 0.8, d / 2]], [[-w / 2, 0.68, -d / 2], [-w / 2 + 0.02, 0.8, d / 2]], [[w / 2 - 0.02, 0.68, -d / 2], [w / 2, 0.8, d / 2]]] as [V3, V3][]) p.box(PC.steel, a, b);
  for (let i = 0; i < 22; i++) {
    const x = (p.r() - 0.5) * (w - 0.12);
    const z = (p.r() - 0.5) * (d - 0.12);
    const r = 0.05 + p.r() * 0.035;
    p.ball([PC.rubber, PC.steel, PC.dark][Math.floor(p.r() * 3)], [x, 0.72 + p.r() * 0.08, z], [r, r * 0.7, r * 0.9], { seg: 7 });
  }
  p.collide([-w / 2, 0, -d / 2], [w / 2, 0.85, d / 2]);
}

/** 採暖室の温度計（木の板・ガラスの管と赤い線・下の玉）。原点は壁の床 */
export function saunaThermometer(p: Prop, y = 1.45): void {
  p.box(PC.wood, [-0.07, y, 0], [0.07, y + 0.5, 0.02], R1(0.01));
  p.cyl(PC.white, [0, y + 0.27, 0.03], 0.01, 0.36, { seg: 8 });
  p.box(PC.red, [-0.003, y + 0.09, 0.038], [0.003, y + 0.36, 0.041], { shadow: false });
  p.ball(PC.red, [0, y + 0.08, 0.03], 0.016, { seg: 8 });
  for (let k = 0; k < 6; k++) p.box(PC.ink, [0.018, y + 0.12 + k * 0.05, 0.02], [0.04, y + 0.125 + k * 0.05, 0.022], { shadow: false });
}

/** 軽食の売り場のカウンターの上の物（レジと表示・立て札のメニュー・紙ナプキン・保温の箱と中の包み）。原点はカウンターの床、天板は y = 1.05 */
export function snackItems(p: Prop): void {
  const y = 1.05;
  p.box(PC.dark, [-2.2, y, -0.15], [-1.8, y + 0.12, 0.15], R1(0.012));
  const scr = p.sub([-2.0, y + 0.12, -0.05], 0, { pitch: -0.5 });
  scr.box(PC.ink, [-0.14, 0, -0.01], [0.14, 0.14, 0.01], R1(0.008));
  scr.box(PG.green, [-0.12, 0.02, 0.01], [0.12, 0.11, 0.012], { kind: 'glow', shadow: false });
  p.extrude(PC.wood, [[0.0, y], [0.18, y], [0.09, y + 0.34]], 'zy', -0.9, -0.6, {});
  p.box(PC.white, [-0.88, y + 0.08, 0.1], [-0.62, y + 0.26, 0.102], { shadow: false });
  p.box(PC.chrome, [0.1, y, -0.06], [0.26, y + 0.12, 0.06], R1(0.01));
  p.box(PC.white, [0.12, y + 0.02, -0.04], [0.24, y + 0.13, 0.04], { shadow: false });
  p.box(PC.chrome, [1.0, y, -0.2], [1.7, y + 0.42, 0.2], R1(0.012));
  p.box('#cfe6e0', [1.03, y + 0.06, 0.2], [1.67, y + 0.38, 0.205], { kind: 'glass', shadow: false });
  p.box(PG.amber, [1.04, y + 0.39, -0.17], [1.66, y + 0.4, 0.17], { kind: 'glow', shadow: false });
  for (let i = 0; i < 3; i++) p.box(PC.kraft, [1.1 + i * 0.2, y + 0.06, -0.1], [1.25 + i * 0.2, y + 0.1, 0.1], { ...R1(0.01), shadow: false });
}
