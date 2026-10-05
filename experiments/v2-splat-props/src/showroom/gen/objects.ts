/**
 * 丸い物・設備・展示物（スプラット）: カラーコーン・消火器・壁掛け時計・給水機のボトル・電気スタンド・
 * 花瓶と花・彫刻・トロフィー・トイレットペーパー。局所の座標は底の中心が原点、正面が +z。
 */
import { leaf } from './plants.ts';
import { boxFaces, ellipsoid, fbm, LOOK, lin, mix3, quad, Rand, revolve, scale3, surface, tube, type Look, type Surfels, type V3 } from '../surfel.ts';

type Xf = (p: V3) => V3;
const disc = (S: Surfels, R: Rand, xf: Xf, y: number, r0: number, r1: number, look: Look, color: (u: number, v: number) => V3, up = true, spacing = 0.004): void =>
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing, look, rand: R, xf, flip: !up, pos: (u, v) => { const r = r0 + (r1 - r0) * v; return [Math.cos(u) * r, y, Math.sin(u) * r]; }, color });

/** カラーコーン（円すい・白い反射帯 2 本・四角い黒い台） */
export function cone(S: Surfels, R: Rand, xf: Xf): void {
  const orange = lin(0xf05a1a), white = lin(0xf4f2ee);
  // 台（角の丸い黒い板）
  for (const [o, a, b] of [[[-0.18, 0.03, 0.18], [0.36, 0, 0], [0, 0, -0.36]], [[-0.18, 0, 0.18], [0.36, 0, 0], [0, 0.03, 0]], [[0.18, 0, -0.18], [-0.36, 0, 0], [0, 0.03, 0]], [[0.18, 0, 0.18], [0, 0, -0.36], [0, 0.03, 0]], [[-0.18, 0, -0.18], [0, 0, 0.36], [0, 0.03, 0]]] as [V3, V3, V3][]) {
    quad(S, o, a, b, { spacing: 0.006, look: { ...LOOK.matte, rough: 0.7 }, rand: R, xf, color: () => lin(0x1c1c1e) });
  }
  revolve(S, [0, 0.03, 0], (t) => [0.135 - t * 0.115, t * 0.66], {
    spacing: 0.006, look: { ...LOOK.plastic, rough: 0.32 }, rand: R, xf,
    color: (_u, v) => ((v > 0.42 && v < 0.55) || (v > 0.66 && v < 0.75) ? white : scale3(orange, 0.95 + 0.08 * Math.sin(v * 30))),
  });
  disc(S, R, xf, 0.69, 0, 0.02, LOOK.plastic, () => orange);
}

/** 消火器（赤い円筒・レバー・圧力計・ホース・ラベル） */
export function extinguisher(S: Surfels, R: Rand, xf: Xf): void {
  const red = lin(0xc0141a);
  const prof = (t: number): [number, number] => { const y = t * 0.47; const r = y < 0.01 ? 0.07 + y * 0.5 : y > 0.42 ? 0.075 * Math.cos(((y - 0.42) / 0.05) * 1.2) : 0.075; return [Math.max(0.02, r), y]; };
  revolve(S, [0, 0, 0], prof, {
    spacing: 0.005, look: { ...LOOK.glossy, rough: 0.18 }, rand: R, xf,
    color: (u, v) => { const front = Math.sin(u) > 0.55; return front && v > 0.3 && v < 0.75 ? ((Math.floor(v * 30) % 3 === 0 && Math.cos(u) * 10 % 1 > 0) ? lin(0x202020) : lin(0xf2efe6)) : red; },
  });
  // 口金・レバー・圧力計
  revolve(S, [0, 0.47, 0], (t) => [0.022, t * 0.04], { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xb0b0b0) });
  tube(S, (t) => [-0.01 + t * 0.12, 0.52 + t * 0.03, 0], () => 0.006, { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xc0c0c0) });
  tube(S, (t) => [-0.01 + t * 0.1, 0.5 - t * 0.01, 0.005], () => 0.005, { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xc0c0c0) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.0015, look: LOOK.glossy, rand: R, xf, pos: (u, v) => [-0.03 + Math.cos(u) * v * 0.016, 0.5 + Math.sin(u) * v * 0.016, 0.026], color: (u, v) => (v > 0.85 ? lin(0x909090) : Math.cos(u) > 0.5 && v > 0.5 ? lin(0x2a8a2a) : lin(0xf0f0e8)) });
  // ホース（口金から胴の横を下りて、先にノズル）
  const hose = (t: number): V3 => [0.03 + Math.sin(t * Math.PI) * 0.06, 0.48 - t * 0.38, 0.07 + Math.sin(t * 2) * 0.01];
  tube(S, hose, () => 0.009, { spacing: 0.004, look: { ...LOOK.matte, rough: 0.6 }, rand: R, xf, color: () => lin(0x1c1c1e) });
  tube(S, (t) => { const p = hose(1); return [p[0], p[1] - t * 0.05, p[2]]; }, (t) => 0.012 - t * 0.004, { spacing: 0.003, look: LOOK.plastic, rand: R, xf, color: () => lin(0x1c1c1e) });
}

/** 壁掛け時計（黒い枠・白い文字盤・目盛り・針・ガラスの映り込み）。局所: 中心が原点、正面 +z */
export function wallClock(S: Surfels, R: Rand, xf: Xf, hour = 10, minute = 8): void {
  const Rr = 0.16;
  // 枠（ドーナツ形）
  surface(S, { u: [0, Math.PI * 2], v: [0, Math.PI * 1.5], spacing: 0.004, look: { ...LOOK.plastic, rough: 0.25 }, rand: R, xf,
    pos: (u, v) => { const r = Rr + Math.cos(v) * 0.012; return [Math.cos(u) * r, Math.sin(u) * r, 0.018 + Math.sin(v) * 0.014]; }, color: () => lin(0x1a1a1c) });
  // 文字盤
  const ang = (k: number): number => Math.PI / 2 - k * Math.PI * 2;
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.003, look: LOOK.matte, rand: R, xf, flip: false,
    pos: (u, v) => [Math.sin(u) * v * Rr, Math.cos(u) * v * Rr, 0.01],
    color: (u, v) => {
      const k = ((u / (Math.PI * 2)) * 60 + 60) % 60;
      const tick = Math.abs(k - Math.round(k)) < (Math.round(k) % 5 === 0 ? 0.18 : 0.07);
      if (v > 0.84 && v < 0.95 && tick) return lin(0x111111);
      return lin(0xf4f2ec);
    } });
  // 針（時・分・秒）
  const hand = (a: number, L: number, w: number, z: number, hex: number): void => {
    const d: V3 = [Math.cos(a), Math.sin(a), 0];
    quad(S, [d[1] * w / 2 - d[0] * 0.02, -d[0] * w / 2 - d[1] * 0.02, z], [d[0] * (L + 0.02), d[1] * (L + 0.02), 0], [-d[1] * w, d[0] * w, 0], { spacing: 0.002, look: LOOK.matte, rand: R, xf, color: () => lin(hex) });
  };
  hand(ang((hour % 12 + minute / 60) / 12), Rr * 0.5, 0.012, 0.013, 0x111111);
  hand(ang(minute / 60), Rr * 0.78, 0.008, 0.015, 0x111111);
  hand(ang(0.62), Rr * 0.85, 0.002, 0.017, 0xc01a1a);
  // ガラス（ほとんど透明。映り込みで見える）
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.005, look: { ...LOOK.clear, opacity: 0.08 }, rand: R, xf,
    pos: (u, v) => [Math.sin(u) * v * Rr * 0.98, Math.cos(u) * v * Rr * 0.98, 0.024 + (1 - v * v) * 0.006], color: () => lin(0xffffff) });
}

/** 給水機のボトル（19 L。逆さにした透ける青い容器・溝・中の水） */
export function coolerBottle(S: Surfels, R: Rand, xf: Xf): void {
  const prof = (t: number): [number, number] => {
    // 逆さ: t = 0 が首（下）、1 が底（上）
    const y = t * 0.46;
    let r: number;
    if (y < 0.05) r = 0.028;
    else if (y < 0.12) r = 0.028 + (0.135 - 0.028) * Math.sin(((y - 0.05) / 0.07) * Math.PI / 2);
    else r = 0.135 + (Math.abs(Math.sin(y * 28)) > 0.92 ? 0.004 : 0);
    if (y > 0.44) r *= Math.cos(((y - 0.44) / 0.02) * 1.2);
    return [Math.max(0.01, r), y];
  };
  revolve(S, [0, 0, 0], prof, { spacing: 0.007, look: { ...LOOK.clear, opacity: 0.3 }, rand: R, xf, color: () => lin(0x7ab0e0) });
  revolve(S, [0, 0, 0], (t) => { const [r, y] = prof(t * 0.8); return [Math.max(0.005, r - 0.004), y]; }, { spacing: 0.008, look: { ...LOOK.clear, opacity: 0.35, rough: 0.1 }, rand: R, xf, color: () => lin(0x4a90d8) });
}

/** 電気スタンド（丸い台・曲がる軸・円すいの笠・光る電球） */
export function deskLamp(S: Surfels, R: Rand, xf: Xf, color = 0x2a4a3a): void {
  const col = lin(color);
  revolve(S, [0, 0, 0], (t) => [0.085 - t * 0.02, Math.sin(t * Math.PI / 2) * 0.025], { spacing: 0.004, look: LOOK.glossy, rand: R, xf, color: () => col });
  const arm = (t: number): V3 => [Math.sin(t * 1.2) * 0.12, 0.025 + t * 0.34, -Math.sin(t * 1.4) * 0.03];
  tube(S, arm, () => 0.008, { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xb0b0b0) });
  // 笠（下向きに傾ける）
  const top = arm(1);
  const tilt = 0.6;
  const X: Xf = (p) => { const y = p[1], x = p[0]; return xf([top[0] + x * Math.cos(tilt) + y * Math.sin(tilt) + 0.03, top[1] - x * Math.sin(tilt) + y * Math.cos(tilt) - 0.02, top[2] + p[2]]); };
  revolve(S, [0, 0, 0], (t) => [0.03 + t * 0.06, -t * 0.09], { spacing: 0.004, look: LOOK.glossy, rand: R, xf: X, color: () => col });
  revolve(S, [0, 0, 0], (t) => [0.029 + t * 0.059, -t * 0.09], { spacing: 0.004, look: { ...LOOK.matte, emit: lin(0xffe2b0, 0.9) }, rand: R, xf: X, flip: true, color: () => lin(0xf4ece0) });
  ellipsoid(S, [0, -0.045, 0], [0.022, 0.03, 0.022], { spacing: 0.003, look: { ...LOOK.matte, emit: lin(0xffd59a, 6) }, rand: R, xf: X, color: () => lin(0xfff4e0) });
}

/** 花瓶と花（青い釉薬の花瓶・茎・チューリップのような花・葉） */
export function vaseFlowers(S: Surfels, R: Rand, xf: Xf): void {
  const blue = lin(0x2a4a8a);
  revolve(S, [0, 0, 0], (t) => [0.05 + Math.sin(t * Math.PI * 1.1) * 0.045 - t * 0.02, t * 0.26], {
    spacing: 0.0045, look: LOOK.ceramic, rand: R, xf, color: (_u, v) => scale3(mix3(blue, lin(0x6a8ac0), Math.max(0, v - 0.7) * 2), 0.9 + 0.15 * fbm(v * 9, 0, 1)),
  });
  disc(S, R, xf, 0.255, 0, 0.03, LOOK.matte, () => lin(0x101418));
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + R.range(-0.3, 0.3);
    const spread = R.range(0.04, 0.12), H = R.range(0.28, 0.4);
    const stem = (t: number): V3 => [Math.cos(a) * spread * t * t, 0.2 + t * H, Math.sin(a) * spread * t * t];
    tube(S, stem, () => 0.0035, { spacing: 0.003, look: LOOK.leaf, rand: R, xf, color: () => lin(0x4a7a2a) });
    const head = stem(1);
    const petal = lin(R.pick([0xd02a3a, 0xf0c020, 0xf2f0ea, 0xe86a9a]));
    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * Math.PI * 2 + (p % 2) * 0.5;
      leaf(S, R, xf, { base: [head[0], head[1] - 0.005, head[2]], dir: [Math.cos(pa) * 0.35, 1, Math.sin(pa) * 0.35], length: 0.045, width: 0.035, droop: -2.5, shape: 'oval', cup: 0.8, spacing: 0.0025, look: { ...LOOK.leaf, rough: 0.45 }, color: (_s, t) => scale3(petal, 0.75 + 0.35 * t) });
    }
    if (k % 2 === 0) leaf(S, R, xf, { base: stem(0.3), dir: [Math.cos(a + 1), 0.8, Math.sin(a + 1)], length: 0.12, width: 0.03, droop: 3, shape: 'lance', spacing: 0.003, color: () => lin(0x3f6a26) });
  }
}

/** 彫刻（トーラスの結び目。ブロンズの金属） */
export function sculpture(S: Surfels, R: Rand, xf: Xf): void {
  const path = (t: number): V3 => {
    const a = t * Math.PI * 2, p = 2, q = 3;
    const r = 0.08 * (2 + Math.cos(q * a));
    return [r * Math.cos(p * a) * 0.55, 0.2 + 0.08 * Math.sin(q * a) * 0.9 + 0.02, r * Math.sin(p * a) * 0.55];
  };
  tube(S, path, () => 0.026, { spacing: 0.004, look: { rough: 0.32, metal: 1, opacity: 1.6, mat: 3 }, rand: R, xf, color: (_u, v, p) => scale3(lin(0x9a6a3a), 0.75 + 0.45 * fbm(p[0] * 20, p[1] * 20, p[2] * 20 + v)) });
  // 台（黒い石）
  revolve(S, [0, 0, 0], (t) => [0.07 - t * 0.01, t * 0.05], { spacing: 0.004, look: { ...LOOK.ceramic, rough: 0.4 }, rand: R, xf, color: () => lin(0x1e1e22) });
  disc(S, R, xf, 0.05, 0, 0.06, LOOK.ceramic, () => lin(0x1e1e22));
}

/** トロフィー（金のカップ・取っ手・大理石の台・銘板） */
export function trophy(S: Surfels, R: Rand, xf: Xf): void {
  const gold: Look = { rough: 0.2, metal: 1, opacity: 1.6, mat: 3 };
  const g = lin(0xd8a83a);
  // 台
  for (const [o, a, b] of [[[-0.06, 0.06, 0.06], [0.12, 0, 0], [0, 0, -0.12]], [[-0.06, 0, 0.06], [0.12, 0, 0], [0, 0.06, 0]], [[0.06, 0, -0.06], [-0.12, 0, 0], [0, 0.06, 0]], [[0.06, 0, 0.06], [0, 0, -0.12], [0, 0.06, 0]], [[-0.06, 0, -0.06], [0, 0, 0.12], [0, 0.06, 0]]] as [V3, V3, V3][]) {
    quad(S, o, a, b, { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, color: (u, v) => (Math.abs(a[0]) > 0.1 && v > 0.3 && v < 0.7 && u > 0.2 && u < 0.8 ? lin(0xc8a040) : scale3(lin(0xe8e4dc), 0.85 + 0.2 * fbm(u * 8, v * 8, 3))) });
  }
  // 脚と杯
  revolve(S, [0, 0.06, 0], (t) => { const y = t * 0.22; const r = y < 0.02 ? 0.035 - y : y < 0.1 ? 0.012 : 0.012 + Math.pow((y - 0.1) / 0.12, 0.6) * 0.055; return [r, y]; }, { spacing: 0.004, look: gold, rand: R, xf, color: () => g });
  revolve(S, [0, 0.06, 0], (t) => [0.064, 0.22 - t * 0.05], { spacing: 0.004, look: gold, rand: R, xf, flip: true, color: () => scale3(g, 0.8) });
  for (const s of [-1, 1]) tube(S, (t) => { const a = t * Math.PI; return [s * (0.065 + Math.sin(a) * 0.03), 0.26 - t * 0.07, 0]; }, () => 0.005, { spacing: 0.003, look: gold, rand: R, xf, color: () => g });
}

/** トイレットペーパー（壁の金具に掛けたロール） */
export function toiletRoll(S: Surfels, R: Rand, xf: Xf): void {
  // 局所: 軸は x、中心が原点
  surface(S, { u: [0, Math.PI * 2], v: [-0.055, 0.055], spacing: 0.004, look: LOOK.paper, rand: R, xf,
    pos: (u, v) => [v, Math.cos(u) * 0.055, Math.sin(u) * 0.055], color: (u) => scale3(lin(0xf6f4ee), 0.93 + 0.07 * Math.sin(u * 40)) });
  // 垂れた端
  quad(S, [-0.055, -0.0, 0.055], [0.11, 0, 0], [0, -0.09, 0.004], { spacing: 0.004, look: LOOK.paper, rand: R, xf, twoSided: true, color: (_u, v) => (Math.abs(v - 0.6) < 0.02 ? lin(0xd8d6d0) : lin(0xf6f4ee)) });
  // 金具
  tube(S, (t) => [-0.07 + t * 0.14, 0.0, 0], () => 0.006, { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xc0c0c0) });
  for (const s of [-1, 1]) quad(S, [s * 0.075 - 0.005, -0.03, -0.07], [0.01, 0, 0], [0, 0.06, 0.0], { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xc0c0c0) });
}


/**
 * 床置きの消火器と台（v2 の extinguisher: 壁際の赤い箱 0.44 × 0.16 × 0.65 の所）。局所: 壁の面 z = 0・床 y = 0・中心 x = 0
 * 赤い鉄板の台（底の受けと背の板。「消火器」の白い帯）と、その中に立つ消火器
 */
export function extinguisherStand(S: Surfels, R: Rand, xf: Xf): void {
  const red = lin(0xb81820);
  const paint: Look = { ...LOOK.glossy, rough: 0.35 };
  // 色は面の (s, t) で決める（p は部屋の座標）
  boxFaces(S, [-0.15, 0, 0.005], [0.15, 0.05, 0.17], '+x-x+y+z', (f, _s, t) => (f === '+z' && t > 0.25 && t < 0.75 ? lin(0xf2f0ea) : red), { spacing: 0.005, look: paint, rand: R, xf });
  boxFaces(S, [-0.15, 0.05, 0.005], [0.15, 0.62, 0.02], '+x-x+y+z', (f, s, t) => {
    if (f !== '+z') return red;
    const y = 0.05 + t * 0.57, x = -0.15 + s * 0.3;
    if (y > 0.5 && y < 0.58) return Math.abs(x) < 0.11 && Math.sin(x * 120) > -0.2 && y > 0.515 && y < 0.565 ? red : lin(0xf2f0ea);
    return red;
  }, { spacing: 0.006, look: paint, rand: R, xf });
  extinguisher(S, R, (p) => xf([p[0] * 0.92, 0.045 + p[1] * 0.92, 0.095 + p[2] * 0.92]));
}

/** バスケットのリングと網（v2 の体育館の板の前）。局所: 板の前の面 z = 0、リングの高さ y = 0、正面 +z（リングの中心は板から 0.225） */
export function hoop(S: Surfels, R: Rand, xf: Xf): void {
  const orange = lin(0xd8541c);
  const ringR = 0.215, cz = 0.01 + ringR;
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * ringR, 0, cz + Math.sin(a) * ringR]; }, () => 0.009, { spacing: 0.004, look: { ...LOOK.metal, rough: 0.4 }, rand: R, xf, color: () => orange });
  boxFaces(S, [-0.1, -0.08, 0], [0.1, 0.01, 0.03], '+x-x+y-y+z', () => orange, { spacing: 0.006, look: { ...LOOK.metal, rough: 0.4 }, rand: R, xf });
  // 網: 12 本の糸が下ですぼまり、斜めに交わる
  const n = 12, depth = 0.42;
  const at = (k: number, t: number): V3 => { const a = (k / n) * Math.PI * 2 + t * 0.6; const r = ringR * (1 - t * 0.45); return [Math.cos(a) * r, -t * depth, cz + Math.sin(a) * r]; };
  for (let k = 0; k < n; k++) {
    tube(S, (t) => at(k, t), () => 0.003, { spacing: 0.004, look: LOOK.fabric, rand: R, xf, color: () => lin(0xf0eee8) });
    tube(S, (t) => { const a = ((k + t) / n) * Math.PI * 2 - t * 0.6 + 0.0; const tt = t; const r = ringR * (1 - tt * 0.45); return [Math.cos(a) * r, -tt * depth, cz + Math.sin(a) * r]; }, () => 0.003, { spacing: 0.004, look: LOOK.fabric, rand: R, xf, color: () => lin(0xf0eee8) });
  }
}

/** 皿（白い陶器の浅い円盤・縁の帯）。原点は底の中心 */
export function plate(S: Surfels, R: Rand, xf: Xf, r = 0.12, rim = 0x2a4a8a): void {
  const white = lin(0xf6f4ee), band = lin(rim);
  revolve(S, [0, 0, 0], (t) => [0.04 + t * (r - 0.04), t < 0.55 ? 0.004 : 0.004 + Math.pow((t - 0.55) / 0.45, 2) * 0.018], { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, flip: true, color: (_u, v) => (v > 0.88 && v < 0.94 ? band : white) });
  revolve(S, [0, 0, 0], (t) => [0.05 + t * (r - 0.05), t * 0.02], { spacing: 0.005, look: LOOK.ceramic, rand: R, xf, color: () => scale3(white, 0.92) });
}

/** ボールプールの玉（上から見える層だけ。色とりどりの小さな球）。局所: プールの中の床の中心、w × d、玉の上面の高さ top */
export function ballPit(S: Surfels, R: Rand, xf: Xf, w: number, d: number, top: number): void {
  const colors = [0xd23a34, 0xe8c23a, 0x2f6fd0, 0x3aa858, 0xf2f0ea, 0xe86a9a];
  const r = 0.04, step = r * 1.85;
  for (let z = -d / 2 + r; z <= d / 2 - r; z += step * 0.87) {
    const row = Math.round((z + d / 2) / (step * 0.87));
    for (let x = -w / 2 + r + (row % 2 ? step / 2 : 0); x <= w / 2 - r; x += step) {
      const col = lin(R.pick(colors));
      const y = top - r + R.range(-0.015, 0.01);
      ellipsoid(S, [x + R.range(-0.006, 0.006), y, z + R.range(-0.006, 0.006)], [r, r, r], { spacing: 0.012, look: { ...LOOK.glossy, rough: 0.3 }, rand: R, xf, vRange: [0.001, Math.PI * 0.62], color: () => col });
    }
  }
}
