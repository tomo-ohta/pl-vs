import type { Prop } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { SC } from './mats.ts';

/**
 * 植物（参考画像 squareroom-0 の板石の上の草の株・squareroom-3 の高い箱の上の茂み・壁の苔）。
 * 葉と草は細い板（楕円体を薄く）を株元から放射状に。遠くでも塊に見えるよう、明るさの違う 2〜3 色
 */

/** 草の株（細い葉を株元から外へ反らせる。高さ h） */
export function grassTuft(p: Prop, h = 0.25, n = 14): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + p.r() * 0.6;
    const len = h * (0.6 + p.r() * 0.6);
    const lean = 0.35 + p.r() * 0.6;
    const c = p.r() < 0.3 ? shade(SC.grass, 0.3) : p.r() < 0.6 ? SC.grass : shade(SC.grass, -0.3);
    const s = p.sub([Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02], -a + Math.PI / 2, { pitch: -(Math.PI / 2 - lean) });
    s.ball(c, [0, 0, len / 2], [0.008, 0.002, len / 2], { seg: 6, shadow: false });
  }
  p.ball(shade(SC.moss, -0.2), [0, 0, 0], [0.05, 0.02, 0.05], { seg: 8, shadow: false });
}

/**
 * 苔の塊（幅 w）: 小さな丸い粒をランダムウォークで寄せ集め、縁が不規則に切れ込む塊にする。
 * 粒は高さ 2〜9 cm でまちまち（平らな円盤にしない）。暗いオリーブの 3 色
 */
export function mossCushion(p: Prop, w = 0.6): void {
  const n = 18 + Math.floor(p.r() * 14);
  let x = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    // 中心から離れすぎない歩き（不規則な輪郭の塊）
    x += (p.r() - 0.5) * w * 0.35;
    z += (p.r() - 0.5) * w * 0.3;
    const lim = w * 0.5;
    if (Math.hypot(x, z) > lim) {
      x *= 0.5;
      z *= 0.5;
    }
    const r = w * (0.06 + p.r() * 0.09);
    const h = 0.02 + p.r() * 0.07;
    const c = p.r() < 0.4 ? SC.moss : p.r() < 0.7 ? SC.mossDark : SC.mossLit;
    p.ball(c, [x, h * 0.35, z], [r, h, r * (0.7 + p.r() * 0.6)], { seg: 7, shadow: false });
  }
}

/**
 * 茂み（低木の塊: 枝と、葉の塊を枝先に寄せた不規則な輪郭。暗いオリーブ）。粒は小さく多く、上の方ほど明るい
 */
export function shrub(p: Prop, w = 1.2, h = 0.9): void {
  const tips: [number, number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + p.r() * 0.6;
    const t: [number, number, number] = [Math.cos(a) * w * (0.15 + p.r() * 0.25), h * (0.45 + p.r() * 0.45), Math.sin(a) * w * (0.12 + p.r() * 0.2)];
    tips.push(t);
    p.rod(SC.woodDark, [0, 0, 0], t, 0.014, { shadow: false });
  }
  for (const t of tips) {
    const m = 6 + Math.floor(p.r() * 4);
    for (let i = 0; i < m; i++) {
      const r = w * (0.06 + p.r() * 0.08);
      const c = t[1] + (p.r() - 0.3) * h * 0.25 > h * 0.7 ? SC.leafLit : p.r() < 0.5 ? SC.leaf : SC.ivy;
      p.ball(c, [t[0] + (p.r() - 0.5) * w * 0.3, t[1] + (p.r() - 0.4) * h * 0.25, t[2] + (p.r() - 0.5) * w * 0.25], [r, r * (0.6 + p.r() * 0.4), r * (0.8 + p.r() * 0.4)], { seg: 7 });
    }
  }
}

/**
 * 木の樹冠（屋上庭園の木）: 平たく大きな葉の塊を 14 個ほど重ね、それぞれを小さく崩した不規則な輪郭にする（丸い玉の房にしない）。
 * 暗く彩度の低いオリーブ。霧で溶ける。幅 w・高さ h
 */
export function canopy(p: Prop, w = 6, h = 5): void {
  p.cyl(SC.woodDark, [0, h * 0.2, 0], 0.12, h * 0.4, { seg: 6 });
  const cols = ['#4a5340', '#545d47', '#3f4838', '#5c6650'];
  for (let i = 0; i < 14; i++) {
    const a = p.r() * Math.PI * 2;
    const rr = Math.sqrt(p.r());
    const cx = Math.cos(a) * rr * w * 0.35;
    const cz = Math.sin(a) * rr * w * 0.22;
    const cy = h * (0.45 + p.r() * 0.45);
    const R = w * (0.12 + p.r() * 0.08);
    const c = cols[Math.floor(p.r() * cols.length)];
    // 1 つの塊 = 平たい楕円体を 3 つずらして重ねる（縁が波打つ）
    for (let k = 0; k < 3; k++) {
      const q = p.sub([cx + (p.r() - 0.5) * R * 0.8, cy + (p.r() - 0.5) * R * 0.2, cz + (p.r() - 0.5) * R * 0.6], p.r() * Math.PI, { roll: (p.r() - 0.5) * 0.4 });
      q.ball(c, [0, 0, 0], [R * (0.8 + p.r() * 0.5), R * (0.22 + p.r() * 0.12), R * (0.5 + p.r() * 0.4)], { seg: 7, shadow: false });
    }
  }
}

/** 垂れ下がる蔦（箱の上の縁 y = 0 から下へ。幅 w・長さ L の帯に、葉の付いた細い茎を並べる） */
export function ivyCurtain(p: Prop, w = 1.6, L = 2.4): void {
  const n = Math.max(4, Math.round(w / 0.12));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n + (p.r() - 0.5) * 0.06;
    const len = L * (0.35 + p.r() * 0.65);
    const sway = (p.r() - 0.5) * 0.12;
    p.tube(shade(SC.ivy, -0.35), [[x, 0, 0.02], [x + sway * 0.5, -len * 0.5, 0.05], [x + sway, -len, 0.04]], 0.006, { seg: 6, radial: 4, shadow: false });
    for (let y = 0.08; y < len; y += 0.09 + p.r() * 0.05) {
      const c = p.r() < 0.5 ? SC.ivy : shade(SC.ivy, p.r() < 0.5 ? 0.3 : -0.25);
      const t = y / len;
      p.sub([x + sway * t + (p.r() - 0.5) * 0.04, -y, 0.05], (p.r() - 0.5) * 1.2).ball(c, [0, 0, 0.025], [0.035, 0.03, 0.006], { seg: 6, shadow: false });
    }
  }
}

/**
 * 植え込みの低木の塊（茎を見せない、土から盛り上がる葉の塊）: 平たい葉の塊を半球の形に詰め、下ほど暗く上ほど明るい。
 * 輪郭は塊ごとに崩す（丸い玉の房にしない）。幅 w・高さ h
 */
export function shrubClump(p: Prop, w = 0.8, h = 0.55): void {
  const n = 16 + Math.floor(p.r() * 8);
  for (let i = 0; i < n; i++) {
    const a = p.r() * Math.PI * 2;
    const rr = Math.sqrt(p.r()) * 0.5;
    const y = h * (0.25 + (1 - rr) * 0.55 + (p.r() - 0.5) * 0.15);
    const r = w * (0.13 + p.r() * 0.09);
    const up = y / h;
    const c = up > 0.75 ? (p.r() < 0.5 ? SC.leafLit : SC.leaf) : up > 0.45 ? (p.r() < 0.5 ? SC.leaf : SC.ivy) : SC.mossDark;
    p.ball(c, [Math.cos(a) * rr * w, y, Math.sin(a) * rr * w * 0.85], [r, r * (0.55 + p.r() * 0.3), r * (0.8 + p.r() * 0.4)], { seg: 8, shadow: 'receive' });
  }
}

/** 草の群れ（高い草の株を 3〜5 つ寄せる）。幅 w・高さ h */
export function grassClump(p: Prop, w = 0.5, h = 0.45): void {
  const n = 3 + Math.floor(p.r() * 3);
  for (let i = 0; i < n; i++) grassTuft(p.sub([(p.r() - 0.5) * w, 0, (p.r() - 0.5) * w * 0.7], p.r() * 6), h * (0.7 + p.r() * 0.5), 16);
}
