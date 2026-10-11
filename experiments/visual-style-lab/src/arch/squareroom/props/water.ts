import type { Prop, V2 } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { SC } from './mats.ts';

/**
 * 水まわりの小物（正面 +z・床 y = 0）。
 * 飛び石・水の中の瓦礫・係留の環・水へ下りるはしご・排水の格子・水位標・小舟
 */

/**
 * 欠けたコンクリートの塊（飛び石・瓦礫）。上から見た輪郭の角を不規則に落とした多角形を押し出す（箱の輪郭にしない）。
 * 上の面は 2 段（一部が欠けて低い）、割れた面は明るい骨材の色、側面に割れ目、上面に暗いオリーブの苔の粒、水際の濡れ
 */
export function chippedBlock(p: Prop, w: number, h: number, d: number, o: { moss?: number; color?: string; waterline?: number } = {}): void {
  const c = o.color ?? SC.concMid;
  const broken = shade(c, 0.35);
  // 輪郭: 4 隅をそれぞれ 0〜35 % 落とし、辺の途中にも小さな欠け
  const out: V2[] = [];
  const corners: V2[] = [
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
    [-w / 2, -d / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const prev = corners[(i + 3) % 4];
    const cut = Math.min(w, d) * (0.04 + p.r() * 0.3);
    const toPrev: V2 = [(prev[0] - a[0]) / Math.hypot(prev[0] - a[0], prev[1] - a[1]), (prev[1] - a[1]) / Math.hypot(prev[0] - a[0], prev[1] - a[1])];
    const toNext: V2 = [(b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]), (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1])];
    out.push([a[0] + toPrev[0] * cut, a[1] + toPrev[1] * cut]);
    out.push([a[0] + toNext[0] * cut * (0.5 + p.r()), a[1] + toNext[1] * cut * (0.5 + p.r())]);
    // 辺の途中の小さな欠け（三角の切れ込み）
    if (p.r() < 0.6) {
      const t = 0.35 + p.r() * 0.3;
      const m: V2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const nrm: V2 = [-toNext[1], toNext[0]];
      const dep = Math.min(w, d) * (0.03 + p.r() * 0.06);
      const half = Math.min(w, d) * 0.06;
      out.push([m[0] - toNext[0] * half, m[1] - toNext[1] * half]);
      out.push([m[0] + nrm[0] * dep, m[1] + nrm[1] * dep]);
      out.push([m[0] + toNext[0] * half, m[1] + toNext[1] * half]);
    }
  }
  // 'xz' の押し出しは輪郭 (x, z) を y の向きへ。反時計回りにする
  const ccw = out.slice().reverse();
  const lowCut = 0.6 + p.r() * 0.25;
  p.extrude(c, ccw, 'xz', 0, h * lowCut, { bevel: Math.min(0.015, h * 0.05), collide: true });
  // 上の段（輪郭を縮めて片側へ寄せる: 片側が欠けて低い）
  const sx = (p.r() - 0.5) * w * 0.25;
  const sz = (p.r() - 0.5) * d * 0.25;
  const top = ccw.map(([x, z]): V2 => [x * 0.78 + sx, z * 0.78 + sz]);
  p.extrude(c, top, 'xz', h * lowCut - 0.01, h, { bevel: Math.min(0.012, h * 0.04) });
  // 欠けた面（上の段の縁に沿った明るい骨材の帯）
  p.extrude(broken, top.map(([x, z]): V2 => [x * 1.04, z * 1.04]), 'xz', h * lowCut - 0.012, h * lowCut + 0.012, { shadow: 'receive' });
  // 側面の割れ目
  if (p.r() < 0.7) {
    const x = (p.r() - 0.5) * w * 0.5;
    p.box(shade(c, -0.5), [x - 0.008, h * 0.15, d / 2 - 0.02], [x + 0.008, h * lowCut, d / 2 + 0.004], { shadow: 'receive' });
  }
  // 苔（暗いオリーブの小さな粒の群れ。上の段の窪みに）
  const moss = o.moss ?? 0.5;
  const k = Math.round(moss * 10);
  for (let i = 0; i < k; i++) {
    const r = Math.min(w, d) * (0.03 + p.r() * 0.05);
    const mx = sx + (p.r() - 0.5) * w * 0.5;
    const mz = sz + (p.r() - 0.5) * d * 0.5;
    p.ball(p.r() < 0.5 ? SC.moss : SC.mossDark, [mx, h + 0.004, mz], [r, r * 0.4, r * (0.7 + p.r() * 0.5)], { seg: 6, shadow: 'receive' });
  }
  // 水際の濡れた帯
  if (o.waterline !== undefined) {
    const y = o.waterline;
    const wc = shade(c, -0.4);
    p.extrude(wc, ccw.map(([x, z]): V2 => [x * 1.01, z * 1.01]), 'xz', Math.max(0, y - 0.15), y + 0.06, { shadow: 'receive' });
  }
}

/** 水の中の瓦礫の群れ（大小の欠けた塊。参考画像 squareroom-2 の水路の中の小さな立方体） */
export function debrisCluster(p: Prop, n = 5, color: string = SC.concDark): void {
  for (let i = 0; i < n; i++) {
    const s = 0.25 + p.r() * 0.45;
    const q = p.sub([(p.r() - 0.5) * 2.2, -0.2 + p.r() * 0.15, (p.r() - 0.5) * 1.4], p.r() * 0.6 - 0.3, { roll: (p.r() - 0.5) * 0.25 });
    chippedBlock(q, s * (0.8 + p.r() * 0.6), s, s * (0.8 + p.r() * 0.5), { moss: p.r() * 0.6, waterline: 0.2, color });
  }
}

/** 係留の環（鉄の座金と、垂れた環。歩廊の縁の上面に） */
export function mooringRing(p: Prop): void {
  p.box(SC.rustDark, [-0.09, 0, -0.07], [0.09, 0.02, 0.07], { r: 0.008 });
  for (const x of [-0.06, 0.06]) p.cyl(SC.steelDark, [x, 0.022, 0], 0.012, 0.008, { seg: 8, shadow: 'receive' });
  p.box(SC.rust, [-0.025, 0.02, -0.02], [0.025, 0.06, 0.02], { r: 0.008 });
  // 環は縁から水の方へ垂れる（局所の +z が水）
  p.sub([0, 0.045, 0.06], 0, { pitch: -1.1 }).torus(SC.rust, [0, 0, 0.08], 0.08, 0.012, { axis: 'x', seg: 18, radial: 6 });
}

/** 水へ下りるはしご（歩廊の縁 z = 0 から水の中へ。上に曲がった手すり） */
export function waterLadder(p: Prop, depth: number): void {
  const w = 0.42;
  const top = 0.95;
  for (const x of [-w / 2, w / 2]) {
    p.bend(SC.steel, [[x, -depth, 0.16], [x, 0.0, 0.16], [x, top, 0.16], [x, top, -0.12], [x, 0.02, -0.12]], 0.019, 0.08);
    // 縁への留め金具
    p.box(SC.steelDark, [x - 0.03, -0.12, 0.0], [x + 0.03, -0.04, 0.17], { r: 0.006, shadow: 'receive' });
  }
  for (let y = -depth + 0.15; y < 0; y += 0.28) p.rod(SC.steel, [-w / 2, y, 0.16], [w / 2, y, 0.16], 0.014);
  p.collide([-w / 2, -depth, 0], [w / 2, top, 0.2]);
}

/** 排水の格子（鉄の枠と、細い桟の並び。床に埋まる） */
export function drainGrate(p: Prop, w = 0.6, d = 0.4): void {
  p.box(SC.steelDark, [-w / 2, -0.01, -d / 2], [w / 2, 0.006, d / 2], { shadow: 'receive' });
  const n = Math.round(w / 0.05);
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + (i * w) / n;
    p.box(SC.steel, [x - 0.008, 0.0, -d / 2 + 0.03], [x + 0.008, 0.014, d / 2 - 0.03], { shadow: 'receive' });
  }
  p.box(SC.steel, [-w / 2, 0.0, -d / 2], [w / 2, 0.016, -d / 2 + 0.03], { shadow: 'receive' });
  p.box(SC.steel, [-w / 2, 0.0, d / 2 - 0.03], [w / 2, 0.016, d / 2], { shadow: 'receive' });
}

/** 水位標（水の中に立つ柱と、目盛りを塗った板。1 m ごとの数字の代わりに太い帯） */
export function gaugeStaff(p: Prop, h = 2.4, below = 0.5): void {
  p.box(SC.concMid, [-0.12, -below, -0.12], [0.12, h * 0.35, 0.12], { r: 0.02, collide: true });
  p.box(SC.steelDark, [-0.04, -below, -0.04], [0.04, h, 0.04], { r: 0.008 });
  const bw = 0.12;
  p.box(SC.white, [-bw / 2, h * 0.12, 0.04], [bw / 2, h - 0.05, 0.055], { r: 0.004 });
  // 目盛り（10 cm ごとに半分の幅、50 cm ごとに全幅・赤）
  for (let y = h * 0.12 + 0.05; y < h - 0.08; y += 0.1) {
    const k = Math.round((y - h * 0.12) / 0.1);
    const full = k % 5 === 0;
    p.box(full ? SC.red : SC.steelDark, [-bw / 2, y, 0.055], [full ? bw / 2 : 0, y + (full ? 0.035 : 0.02), 0.06], { shadow: 'receive' });
  }
  p.box(SC.yellow, [-0.07, h - 0.05, -0.07], [0.07, h, 0.07], { r: 0.01, shadow: 'receive' });
}

/** 小舟（平底の古い作業舟。長さ 3.6 m。舷・座席・舟底の肋・櫂・舫い綱） */
export function skiff(p: Prop): void {
  const L = 3.6;
  const B = 1.15;
  const H = 0.42;
  // 舷: 上から見た輪郭（舳先が細い）を外板として押し出し、中をくり抜く
  const out: V2[] = [];
  const inn: V2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const z = -L / 2 + t * L;
    const half = (B / 2) * Math.min(1, (t < 0.25 ? 0.45 + (t / 0.25) * 0.55 : t > 0.85 ? 1 - ((t - 0.85) / 0.15) * 0.25 : 1));
    out.push([half, z]);
  }
  for (let i = n; i >= 0; i--) out.push([-out[i][0], out[i][1]]);
  for (const [x, z] of out) inn.push([x * 0.9, z * 0.95]);
  // 底板と外板
  p.extrude(SC.paint, out, 'xz', 0, 0.06, { bevel: 0.01 });
  p.extrude(SC.paint, out, 'xz', 0.06, H, { holes: [inn.slice().reverse()], bevel: 0.008 });
  // 舷の縁（明るい塗りの帯）と、喫水の暗い帯
  p.extrude(SC.paintPale, out, 'xz', H - 0.035, H, { holes: [inn.slice().reverse()] });
  // 座席 2 枚・肋
  for (const z of [-0.5, 0.65]) p.box(SC.wood, [-B * 0.43, H - 0.12, z - 0.14], [B * 0.43, H - 0.09, z + 0.14], { r: 0.01 });
  for (let z = -1.3; z <= 1.31; z += 0.43) p.box(SC.woodDark, [-B * 0.4, 0.06, z - 0.025], [B * 0.4, 0.1, z + 0.025], { shadow: 'receive' });
  // 櫂（座席に渡して置く）
  p.sub([0.1, H - 0.07, 0.1], 0.12).tube(SC.wood, [[0, 0, -1.1], [0, 0, 0.9]], 0.022, { sharp: true });
  p.sub([0.1, H - 0.07, 0.1], 0.12).box(SC.wood, [-0.07, -0.01, 0.9], [0.07, 0.01, 1.3], { r: 0.005 });
  // 舫い綱（舳先の環から垂れる）
  p.torus(SC.steelDark, [0, H + 0.02, -L / 2 + 0.25], 0.04, 0.008, { axis: 'z', seg: 12 });
  p.tube(SC.paper, [[0, H + 0.02, -L / 2 + 0.25], [0.05, H - 0.1, -L / 2 - 0.05], [0.12, 0.02, -L / 2 - 0.5], [0.2, 0.0, -L / 2 - 0.9]], 0.012);
  p.collide([-B / 2, 0, -L / 2], [B / 2, H, L / 2]);
}
