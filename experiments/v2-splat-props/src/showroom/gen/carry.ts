/**
 * 持てる物（v2 の carryItem / carryBody の kind ごと）。局所の原点は物の中心、h は v2 の half（半分の寸法）。
 * v2 の buildShape と同じ大きさ・同じ見分けの手がかり（荷物の色の札・重りの点の数・電球の色）を保つ。
 * 色は v2 の材質の色（hex）を受け取る: main = params.mat、label = params.label、glass = params.glass。
 */
import { fbm, LOOK, lin, mix3, quad, Rand, revolve, scale3, superellipsoid, surface, tube, ellipsoid, boxFaces, type Look, type Surfels, type V3 } from '../surfel.ts';
import { bear } from './plush.ts';
import { leaf } from './plants.ts';

type Xf = (p: V3) => V3;
export interface CarryColors { main: number; label: number; glass: number; dots: number }

const chrome: Look = { rough: 0.12, metal: 1, opacity: 1.6, mat: 3 };
const gold: Look = { rough: 0.25, metal: 1, opacity: 1.6, mat: 3 };

/** 段ボールの荷物: 段ボールの面（むら・角のつぶれ）・上のガムテープ・色の帯と上の色の札（どの受けに合うかの手がかり） */
export function parcel(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const kraft = lin(c.main), tag = lin(c.label), tape = lin(0xc9a86a);
  const seed = R.range(0, 50);
  // 色は面の (s, t) で決める（p は部屋の座標なので、模様の位置には使わない。むらのノイズだけに使う）
  boxFaces(S, [-h[0], -h[1], -h[2]], [h[0], h[1], h[2]], '+x-x+y-y+z-z', (face, s, t, p) => {
    const side = face !== '+y' && face !== '-y';
    const n = fbm(p[0] * 9 + seed, p[1] * 9, p[2] * 9, 3);
    let col = scale3(kraft, 0.86 + 0.18 * n);
    // 側面の真ん中の色の帯（v2 の帯と同じ高さ）
    if (side && Math.abs(t - 0.5) < 0.09) col = mix3(tag, scale3(kraft, 0.9), 0.15);
    if (face === '+y') {
      const lx = -h[0] + s * 2 * h[0], lz = h[2] - t * 2 * h[2];
      // 上のふたの合わせ目のガムテープ（x の向き）
      if (Math.abs(lz) < 0.025) col = scale3(tape, 0.95 + 0.08 * Math.sin(lx * 300));
      // 上の色の札（伝票）: 札の色の枠 + 白地のバーコード
      const ux = (lx - h[0] * 0.35) / (h[0] * 0.3), uz = (lz + h[2] * 0.45) / (h[2] * 0.25);
      if (Math.abs(ux) < 1 && Math.abs(uz) < 1) {
        if (Math.abs(ux) > 0.8 || Math.abs(uz) > 0.75) return tag;
        return uz < 0 && Math.sin(ux * 60 + Math.floor(ux * 9)) > 0.2 ? lin(0x111111) : lin(0xf6f4ee);
      }
    }
    // 前後の面へ折り返したガムテープ
    if ((face === '+z' || face === '-z') && t > 0.82 && Math.abs(s - 0.5) * 2 * h[0] < 0.025) col = scale3(tape, 0.95);
    // 角のつぶれ（縁が少し濃い）
    const edge = Math.min(1 - Math.abs(s * 2 - 1), 1 - Math.abs(t * 2 - 1));
    return scale3(col, 0.82 + 0.18 * Math.min(1, edge * 12));
  }, { spacing: 0.006, look: { ...LOOK.matte, rough: 0.95 }, rand: R, xf });
}

/** 閉じた本（表紙・背の丸み・小口の紙の層）。背は −z（v2 と同じ） */
export function closedBook(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const cover = lin(c.main), paper = lin(0xece4cc);
  const look: Look = { ...LOOK.matte, rough: 0.7 };
  const t = 0.004;
  // 表紙と裏表紙（小口より少し大きい）
  for (const sy of [1, -1]) {
    boxFaces(S, [-h[0], sy > 0 ? h[1] - t : -h[1], -h[2] + h[1]], [h[0], sy > 0 ? h[1] : -h[1] + t, h[2]], sy > 0 ? '+y+x-x+z' : '-y+x-x+z', (_f, s, u) => scale3(cover, 0.9 + 0.1 * Math.sin(s * 40 + u * 7)), { spacing: 0.005, look, rand: R, xf });
  }
  // 背（半円の筒、題名の帯）
  surface(S, { u: [-h[0], h[0]], v: [Math.PI / 2, Math.PI * 1.5], spacing: 0.004, look, rand: R, xf, flip: true,
    pos: (u, a) => [u, Math.sin(a) * h[1], -h[2] + h[1] + Math.cos(a) * h[1]],
    color: (u) => (Math.abs(u) < h[0] * 0.5 && Math.abs(u) > h[0] * 0.1 ? lin(0xd8c070) : cover) });
  // 小口（紙の層）
  boxFaces(S, [-h[0] + 0.003, -h[1] + t, -h[2] + h[1]], [h[0] - 0.003, h[1] - t, h[2] - 0.003], '+x-x+z', (_f, _s, u) => scale3(paper, 0.85 + 0.15 * Math.abs(Math.sin(u * 300))), { spacing: 0.004, look: LOOK.paper, rand: R, xf });
}

/** バケツ（すぼまった筒・縁の巻き・取っ手・耳）。水面は bucketWater（別の物にして v2 の水の高さで動かす） */
export function bucket(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const r = Math.min(h[0], h[2]), col = lin(c.main);
  const plastic: Look = { ...LOOK.plastic, rough: 0.4 };
  const prof = (t: number): [number, number] => [r * 0.8 + t * r * 0.2, -h[1] + t * 2 * h[1]];
  revolve(S, [0, 0, 0], prof, { spacing: 0.006, look: plastic, rand: R, xf, color: (_u, v) => scale3(col, 0.9 + 0.1 * (Math.floor(v * 12) % 2)) });
  revolve(S, [0, 0, 0], (t) => { const [rr, y] = prof(t); return [rr - 0.004, y]; }, { spacing: 0.007, look: plastic, rand: R, xf, flip: true, color: () => scale3(col, 0.75) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.007, look: plastic, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * r * 0.8, -h[1] + 0.006, Math.sin(u) * v * r * 0.8], color: () => scale3(col, 0.7) });
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * (r + 0.004), h[1], Math.sin(a) * (r + 0.004)]; }, () => 0.006, { spacing: 0.004, look: plastic, rand: R, xf, color: () => scale3(col, 1.05) });
  // 取っ手（金属の針金の半円）と耳
  tube(S, (t) => { const a = t * Math.PI; return [Math.cos(a) * r * 0.98, h[1] - 0.02 + Math.sin(a) * r * 0.9, 0]; }, () => 0.004, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xb8b8b8) });
  for (const sx of [-1, 1]) ellipsoid(S, [sx * (r + 0.006), h[1] - 0.025, 0], [0.008, 0.016, 0.014], { spacing: 0.003, look: plastic, rand: R, xf, color: () => col });
}

/** バケツの水面（原点が水面の中心。v2 の水の高さの式で上下させる） */
export function bucketWater(S: Surfels, R: Rand, xf: Xf, h: V3): void {
  const r = Math.min(h[0], h[2]) * 0.86;
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.006, look: { ...LOOK.clear, opacity: 0.7, rough: 0.05 }, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * r, 0, Math.sin(u) * v * r], color: () => lin(0x4a7ea8) });
}

/** 丸い腰掛け（木の座・3 本の脚・足掛けの輪） */
export function stool(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const r = Math.min(h[0], h[2]), col = lin(c.main);
  const top = h[1];
  revolve(S, [0, top - 0.04, 0], (t) => { const a = t * Math.PI / 2; return [r * (0.92 + 0.08 * Math.sin(a)), Math.sin(a) * 0.04 * t]; }, { spacing: 0.006, look: LOOK.glossy, rand: R, xf, color: () => col });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.008, look: LOOK.glossy, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * r * 0.99, top, Math.sin(u) * v * r * 0.99], color: (u, v) => scale3(col, 0.92 + 0.08 * fbm(Math.cos(u) * v * 8, Math.sin(u) * v * 8, 1)) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.01, look: LOOK.matte, rand: R, xf, flip: true, pos: (u, v) => [Math.cos(u) * v * r * 0.92, top - 0.04, Math.sin(u) * v * r * 0.92], color: () => scale3(col, 0.7) });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    tube(S, (t) => [Math.cos(a) * r * (0.55 + t * 0.35), top - 0.04 - t * (2 * h[1] - 0.04), Math.sin(a) * r * (0.55 + t * 0.35)], () => 0.012, { spacing: 0.004, look: chrome, rand: R, xf, color: () => lin(0x9a9a9a) });
  }
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * r * 0.75, -h[1] + 0.22 * h[1], Math.sin(a) * r * 0.75]; }, () => 0.007, { spacing: 0.004, look: chrome, rand: R, xf, color: () => lin(0x9a9a9a) });
}

/** 電球（洋なし形のガラス・光る色・口金のねじ・先の接点）。glass の色で光る */
export function bulb(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const r = Math.min(h[0], h[2]) * 0.95;
  const glow: Look = { ...LOOK.clear, opacity: 0.95, rough: 0.12, emit: lin(c.glass, 1.6) };
  const y0 = -h[1] + 0.35 * 2 * h[1];
  revolve(S, [0, y0, 0], (t) => { const y = t * (h[1] - y0 + h[1] * 0.0); const k = y / (h[1] - y0); return [Math.max(0.002, r * Math.sin(Math.min(1, 0.35 + k * 0.85) * Math.PI) * (k < 0.3 ? 0.55 + k * 1.5 : 1)), y]; }, { spacing: 0.004, look: glow, rand: R, xf, color: () => lin(c.glass) });
  revolve(S, [0, -h[1], 0], (t) => [r * 0.42 + (Math.sin(t * 28) > 0 ? 0.0025 : 0) - t * 0.004, t * (y0 + h[1])], { spacing: 0.0025, look: chrome, rand: R, xf, color: (_u, v) => scale3(lin(0xc8c4b8), 0.85 + 0.15 * Math.sin(v * 28)) });
  ellipsoid(S, [0, -h[1], 0], [r * 0.18, 0.005, r * 0.18], { spacing: 0.002, look: chrome, rand: R, xf, color: () => lin(0x8a6a3a) });
}

/** ボール（球に 2 色の帯の模様・つや）。原点が中心、半径 h[0] */
export function ball(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const col = lin(c.main), white = lin(0xf2f0ea);
  const tilt = R.range(0, Math.PI);
  ellipsoid(S, [0, 0, 0], [h[0], h[0], h[0]], {
    spacing: Math.max(0.004, h[0] / 18), look: { ...LOOK.glossy, rough: 0.28 }, rand: R, xf,
    color: (u, v) => { const x = Math.sin(v) * Math.cos(u + tilt), y = Math.cos(v); const band = Math.abs(x * 0.6 + y * 0.8) < 0.18; return band ? white : scale3(col, 0.95 + 0.05 * Math.sin(u * 9)); },
  });
}

/** ボウリングのピン（白い回転体・首の赤い 2 本の帯） */
export function pin(S: Surfels, R: Rand, xf: Xf, h: V3): void {
  const H = 2 * h[1], R0 = h[0];
  const prof = (t: number): [number, number] => {
    const y = t * H;
    const k = t;
    // 胴の膨らみ → 首のくびれ → 頭の丸み
    const body = Math.sin(Math.min(1, k / 0.62) * Math.PI) * 0.55 + 0.45;
    let r = k < 0.62 ? R0 * (0.55 + 0.45 * Math.sin((k / 0.62) * Math.PI * 0.95)) * (body > 0 ? 1 : 1) : 0;
    if (k >= 0.62 && k < 0.78) r = R0 * (0.36 + (0.78 - k) * 0.9);
    if (k >= 0.78) { const a = (k - 0.78) / 0.22; r = R0 * 0.48 * Math.sqrt(Math.max(0, 1 - Math.pow(a * 2 - 1, 2))) + (a < 0.5 ? R0 * 0.36 * (1 - a * 2) : 0); }
    if (k < 0.02) r = R0 * 0.5;
    return [Math.max(0.002, r), y - h[1]];
  };
  revolve(S, [0, 0, 0], prof, { spacing: 0.004, look: { ...LOOK.glossy, rough: 0.15 }, rand: R, xf, color: (_u, v) => (Math.abs(v - 0.66) < 0.02 || Math.abs(v - 0.71) < 0.015 ? lin(0xc0202a) : lin(0xf4f2ec)) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.004, look: LOOK.glossy, rand: R, xf, flip: true, pos: (u, v) => [Math.cos(u) * v * R0 * 0.5, -h[1], Math.sin(u) * v * R0 * 0.5], color: () => lin(0xdcdad4) });
}

/** 立てる鏡（楕円の枠・鏡の面・脚と台） */
export function mirror(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const fr = lin(c.main);
  const cy = h[1] * 0.2, rx = h[0] * 0.92, ry = h[1] * 0.72;
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * rx, cy + Math.sin(a) * ry, 0]; }, () => 0.014, { spacing: 0.005, look: { ...LOOK.glossy, rough: 0.3 }, rand: R, xf, color: () => fr });
  const glass: Look = { rough: 0.04, metal: 1, opacity: 1.6, mat: 3 };
  for (const sz of [1, -1]) {
    surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.008, look: sz > 0 ? glass : LOOK.matte, rand: R, xf, flip: sz < 0, pos: (u, v) => [Math.cos(u) * v * rx, cy + Math.sin(u) * v * ry, sz * 0.004], color: () => (sz > 0 ? lin(0xdfe4e8) : scale3(fr, 0.8)) });
  }
  tube(S, (t) => [0, cy - ry - t * (cy - ry + h[1] - 0.02), -0.01 - t * 0.02], () => 0.012, { spacing: 0.004, look: { ...LOOK.glossy, rough: 0.3 }, rand: R, xf, color: () => fr });
  tube(S, (t) => [-h[0] * 0.7 + t * h[0] * 1.4, -h[1] + 0.012, -0.03], () => 0.012, { spacing: 0.004, look: { ...LOOK.glossy, rough: 0.3 }, rand: R, xf, color: () => fr });
}

/** 鉄の重り（角の丸い塊・上の取っ手・前の白い点の数が重さ） */
export function weight(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const iron = lin(c.main === 0x2a2c2e ? 0x3a3c3e : c.main), dots = Math.max(1, Math.round(c.dots));
  superellipsoid(S, [0, -h[1] * 0.12, 0], [h[0], h[1] * 0.85, h[2]], 0.35, 0.3, {
    spacing: 0.006, look: { rough: 0.6, metal: 0.8, opacity: 1.6, mat: 3 }, rand: R, xf,
    warp: (p) => [p[0], p[1], p[2]],
    color: (u, v) => {
      // 上の面に白い点（重さの数）。局所の x・z は (u, v) から（p は部屋の座標）
      const sp = (w: number, m: number): number => Math.sign(w) * Math.pow(Math.abs(w), m);
      const lx = sp(Math.cos(v), 0.35) * sp(Math.cos(u), 0.3) * h[0], lz = sp(Math.cos(v), 0.35) * sp(Math.sin(u), 0.3) * h[2];
      // 点は取っ手（x 向きの弧）の下を避けて、z の片側に並べる
      const dz = lz - h[2] * 0.52;
      if (v > 1.2) for (let i = 0; i < dots; i++) { const dx = lx - (i - (dots - 1) / 2) * Math.min(0.06, (h[0] * 1.4) / dots); if (dx * dx + dz * dz < 0.014 * 0.014) return lin(0xf0eee8); }
      return scale3(iron, 0.8 + 0.4 * fbm(u * 6, v * 6, 2));
    },
  });
  tube(S, (t) => { const a = t * Math.PI; return [Math.cos(a) * h[0] * 0.5, h[1] * 0.6 + Math.sin(a) * h[1] * 0.38, 0]; }, () => Math.min(0.016, h[0] * 0.12), { spacing: 0.004, look: { rough: 0.5, metal: 0.8, opacity: 1.6, mat: 3 }, rand: R, xf, color: () => iron });
}

/** 電気スタンド（床置きの小さな物: 丸い台・柱・布の笠） */
export function standLamp(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const shade = lin(c.main);
  revolve(S, [0, -h[1], 0], (t) => [h[0] * (0.6 - t * 0.12), Math.sin(t * Math.PI / 2) * 0.03], { spacing: 0.005, look: chrome, rand: R, xf, color: () => lin(0x3a3a3a) });
  tube(S, (t) => [0, -h[1] + 0.03 + t * (2 * h[1] * 0.68), 0], () => 0.009, { spacing: 0.004, look: chrome, rand: R, xf, color: () => lin(0x5a5a5a) });
  const y0 = h[1] - 2 * h[1] * 0.35;
  for (const f of [false, true]) revolve(S, [0, y0, 0], (t) => [h[0] * (1 - t * 0.5) - (f ? 0.003 : 0), t * 2 * h[1] * 0.35], { spacing: 0.006, look: LOOK.fabric, rand: R, xf, flip: f, color: (u, v) => scale3(shade, (f ? 0.8 : 1) * (0.9 + 0.1 * Math.sin(u * 40) * Math.sin(v * 3))) });
}

/** 小さな鉢植え（色の鉢・土・丸く茂る葉） */
export function pottedSmall(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const potC = lin(c.main === 0x45692c ? 0xb86a45 : c.main);
  const H = 2 * h[1], rp = Math.min(h[0], h[2]) * 0.8;
  const potH = H * 0.4;
  revolve(S, [0, -h[1], 0], (t) => [rp * (0.75 + 0.25 * t), t * potH], { spacing: 0.005, look: LOOK.ceramic, rand: R, xf, color: (_u, v) => scale3(potC, 0.9 + 0.1 * v) });
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * rp, -h[1] + potH, Math.sin(a) * rp]; }, () => 0.006, { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, color: () => potC });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.006, look: LOOK.matte, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * rp * 0.95, -h[1] + potH - 0.01, Math.sin(u) * v * rp * 0.95], color: () => lin(0x3a2a1c) });
  const n = Math.round(14 + 40 * Math.min(1, H / 0.8));
  const top = h[1], base = -h[1] + potH;
  for (let k = 0; k < n; k++) {
    const a = k * 2.39996, f = Math.sqrt((k + 1) / n);
    const up = 0.95 - f * 0.6;
    leaf(S, R, xf, {
      base: [Math.cos(a) * rp * 0.2 * f, base, Math.sin(a) * rp * 0.2 * f], dir: [Math.cos(a) * (1 - up), up, Math.sin(a) * (1 - up)],
      length: (top - base) * (0.55 + 0.45 * (1 - f)), width: Math.max(0.025, h[0] * 0.35), droop: 1.2, shape: 'lance', cup: 0.3, twist: R.range(-0.6, 0.6), spacing: 0.004,
      color: (s2, t) => scale3(lin(0x3f6e2a), (0.8 + 0.35 * t) * (0.92 + 0.12 * Math.sin(s2 * 30))),
    });
  }
}

/** たたんだ傘（ひだのある布・軸・先・曲がった柄・留め帯） */
export function umbrella(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const col = lin(c.main);
  const H = 2 * h[1];
  const cloth: Look = { ...LOOK.fabric, rough: 0.6, mat: 1 };
  // 布（8 枚のひだ。上 0.15 から下 0.75 の範囲）
  revolve(S, [0, -h[1], 0], (t) => { const y = H * (0.18 + t * 0.62); const k = Math.sin(t * Math.PI); return [0.008 + k * h[0] * 0.55, y]; }, { spacing: 0.005, look: cloth, rand: R, xf, color: (u) => scale3(col, 0.85 + 0.15 * Math.abs(Math.sin(u * 4))) });
  // 留め帯
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * h[0] * 0.38, -h[1] + H * 0.5, Math.sin(a) * h[0] * 0.38]; }, () => 0.006, { spacing: 0.003, look: cloth, rand: R, xf, color: () => scale3(col, 0.7) });
  // 軸・先・柄（J の字）
  tube(S, (t) => [0, -h[1] + H * 0.12 + t * H * 0.85, 0], () => 0.006, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xb0b0b0) });
  tube(S, (t) => [0, -h[1] + H * 0.12 - t * H * 0.1, 0], () => 0.004, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xb0b0b0) });
  tube(S, (t) => { if (t < 0.4) return [0, h[1] - 0.02 + 0, 0]; const a = ((t - 0.4) / 0.6) * Math.PI; return [0.035 - Math.cos(a) * 0.035, h[1] - 0.02 - Math.sin(a) * 0.05 - 0.0, 0]; }, () => 0.011, { spacing: 0.003, look: { ...LOOK.glossy, rough: 0.3 }, rand: R, xf, color: () => lin(0x3a2418) });
}

/** 手提げの鞄（角の丸い胴・ふたの縁・2 本の持ち手・金具） */
export function bag(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const col = lin(c.main);
  const leather: Look = { ...LOOK.plastic, rough: 0.5, mat: 1 };
  const bodyH = h[1] * 0.75;
  superellipsoid(S, [0, -h[1] + bodyH, 0], [h[0], bodyH, h[2]], 0.25, 0.45, { spacing: 0.006, look: leather, rand: R, xf, color: (u, v) => scale3(col, (Math.abs(Math.sin(v)) > 0.9 ? 0.8 : 1) * (0.92 + 0.1 * fbm(u * 5, v * 5, 1))) });
  for (const sz of [-1, 1]) tube(S, (t) => { const a = t * Math.PI; return [Math.cos(a) * h[0] * 0.45, -h[1] + 2 * bodyH + Math.sin(a) * (h[1] - 0.02 - (2 * bodyH - h[1]) * 0.5) * 0.9, sz * h[2] * 0.35]; }, () => 0.008, { spacing: 0.003, look: leather, rand: R, xf, color: () => scale3(col, 0.75) });
  ellipsoid(S, [0, -h[1] + bodyH * 1.55, h[2] * 0.98], [0.018, 0.012, 0.006], { spacing: 0.002, look: gold, rand: R, xf, color: () => lin(0xd0a850) });
}

/** ぬいぐるみの小物（クマを物の高さに縮める。毛の色 = 材質の色） */
export function toy(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const k = (2 * h[1]) / 0.42;
  const fur = c.main, patch = mixHex(c.main, 0xf4eee0, 0.55);
  bear(S, R, (p) => xf([p[0] * k, -h[1] + p[1] * k, p[2] * k]), fur, patch, 0xf2f0ea);
}

/** マグカップ（筒・内側・底・縁・取っ手） */
export function cup(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const r = h[0], col = lin(c.main);
  revolve(S, [0, -h[1], 0], (t) => [r * (0.86 + 0.14 * Math.sin(t * Math.PI / 2)), t * 2 * h[1]], { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, color: () => col });
  revolve(S, [0, -h[1], 0], (t) => [r * (0.8 + 0.14 * Math.sin(t * Math.PI / 2)), 0.006 + t * (2 * h[1] - 0.006)], { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, flip: true, color: () => scale3(col, 0.85) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.004, look: LOOK.ceramic, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * r * 0.8, -h[1] + 0.006, Math.sin(u) * v * r * 0.8], color: () => scale3(col, 0.75) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.004, look: LOOK.ceramic, rand: R, xf, flip: true, pos: (u, v) => [Math.cos(u) * v * r * 0.86, -h[1], Math.sin(u) * v * r * 0.86], color: () => scale3(col, 0.9) });
  tube(S, (t) => { const a = -Math.PI / 2 + t * Math.PI; return [r + Math.cos(a) * h[1] * 0.42, Math.sin(a) * h[1] * 0.55, 0]; }, () => Math.max(0.005, r * 0.12), { spacing: 0.003, look: LOOK.ceramic, rand: R, xf, color: () => col });
}

/** 小さな花瓶（膨らんだ胴・細い首・口の縁・釉薬のつや） */
export function smallVase(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const col = lin(c.main), r = h[0];
  revolve(S, [0, -h[1], 0], (t) => [Math.max(0.004, r * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.6) * Math.PI) * (t < 0.62 ? 1 : 0) + (t >= 0.62 ? 0.35 + (t - 0.62) * 0.5 : 0) - (t < 0.62 ? 0 : 0.0))), t * 2 * h[1]], {
    spacing: 0.004, look: LOOK.ceramic, rand: R, xf, color: (_u, v) => scale3(col, 0.85 + 0.2 * v),
  });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.003, look: LOOK.matte, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * r * 0.5, h[1] - 0.002, Math.sin(u) * v * r * 0.5], color: () => lin(0x14110e) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.004, look: LOOK.ceramic, rand: R, xf, flip: true, pos: (u, v) => [Math.cos(u) * v * r * 0.55, -h[1], Math.sin(u) * v * r * 0.55], color: () => scale3(col, 0.8) });
}

/** 鳥の置物（陶器の胴・頭・くちばし・尾・羽・小さな台） */
export function bird(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const col = lin(c.main), beak = lin(0xe0a830);
  const base = -h[1];
  revolve(S, [0, base, 0], (t) => [h[0] * (0.7 - t * 0.1), t * 0.018], { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, color: () => lin(0x6a4a30) });
  ellipsoid(S, [0, base + h[1] * 0.75, -h[2] * 0.05], [h[0] * 0.55, h[1] * 0.5, h[2] * 0.75], { spacing: 0.004, look: LOOK.ceramic, rand: R, xf, color: (_u, v) => (v > 2.2 ? scale3(col, 1.25) : col) });
  ellipsoid(S, [0, base + h[1] * 1.45, h[2] * 0.4], [h[0] * 0.36, h[1] * 0.34, h[2] * 0.36], { spacing: 0.0035, look: LOOK.ceramic, rand: R, xf, color: () => col });
  revolve(S, [0, 0, 0], (t) => [h[0] * 0.09 * (1 - t), t * h[2] * 0.4], { spacing: 0.002, look: LOOK.ceramic, rand: R, xf: (p) => xf([p[0], base + h[1] * 1.42 + p[2], h[2] * 0.72 + p[1]]), color: () => beak });
  for (const sx of [-1, 1]) {
    ellipsoid(S, [sx * h[0] * 0.16, base + h[1] * 1.52, h[2] * 0.68], [0.004, 0.004, 0.003], { spacing: 0.0012, look: LOOK.glossy, rand: R, xf, color: () => lin(0x111111) });
    ellipsoid(S, [sx * h[0] * 0.5, base + h[1] * 0.85, -h[2] * 0.1], [h[0] * 0.12, h[1] * 0.32, h[2] * 0.6], { spacing: 0.0035, look: LOOK.ceramic, rand: R, xf, color: () => scale3(col, 0.8) });
  }
  ellipsoid(S, [0, base + h[1] * 0.85, -h[2] * 0.85], [h[0] * 0.22, h[1] * 0.08, h[2] * 0.35], { spacing: 0.0035, look: LOOK.ceramic, rand: R, xf, color: () => scale3(col, 0.75) });
}

/** 古い鍵（輪・軸・歯。金色） */
export function key(S: Surfels, R: Rand, xf: Xf, h: V3): void {
  const g = lin(0xc9a45c);
  const ry = h[1] * 0.45;
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.sin(a) * h[0] * 0.45, ry + Math.cos(a) * h[0] * 0.45, 0]; }, () => h[0] * 0.11, { spacing: 0.003, look: gold, rand: R, xf, color: () => g });
  tube(S, (t) => [0, ry - h[0] * 0.45 - t * (ry - h[0] * 0.45 + h[1] * 0.95), 0], () => h[0] * 0.08, { spacing: 0.003, look: gold, rand: R, xf, color: () => g });
  boxFaces(S, [0, -h[1] * 0.95, -h[0] * 0.06], [h[0] * 0.38, -h[1] * 0.62, h[0] * 0.06], '+x-x+y-y+z-z', () => g, { spacing: 0.003, look: gold, rand: R, xf });
}

/** オルゴールの木の箱（ふたの合わせ目・角の金具・横の巻きねじ） */
export function musicBox(S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors): void {
  const wood = lin(c.main);
  boxFaces(S, [-h[0], -h[1], -h[2]], [h[0], h[1], h[2]], '+x-x+y-y+z-z', (f, s, t, p) => {
    // ふたの合わせ目（側面の高さ 72% の所）。木目は面の s に沿って
    if (f !== '+y' && f !== '-y' && Math.abs(t - 0.725) * 2 * h[1] < 0.003) return scale3(wood, 0.5);
    const grain = Math.sin(s * 40 + fbm(p[0] * 20, p[1] * 20, p[2] * 20) * 6);
    return scale3(wood, 0.85 + 0.15 * grain);
  }, { spacing: 0.004, look: { ...LOOK.glossy, rough: 0.3 }, rand: R, xf });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ellipsoid(S, [sx * (h[0] - 0.006), h[1] - 0.006, sz * (h[2] - 0.006)], [0.008, 0.006, 0.008], { spacing: 0.002, look: gold, rand: R, xf, color: () => lin(0xc9a45c) });
  tube(S, (t) => [h[0] + t * 0.02, 0, 0], () => 0.003, { spacing: 0.002, look: gold, rand: R, xf, color: () => lin(0xc9a45c) });
  quad(S, [h[0] + 0.02, -0.012, -0.006], [0, 0.024, 0], [0, 0, 0.012], { spacing: 0.002, look: gold, rand: R, xf, twoSided: true, color: () => lin(0xc9a45c) });
}

const mixHex = (a: number, b: number, t: number): number => {
  const ch = (x: number, s: number): number => (x >> s) & 255;
  const m = (s: number): number => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};

/** kind → 形の関数（無い kind は v2 の形のまま） */
export const CARRY_GEN: Record<string, (S: Surfels, R: Rand, xf: Xf, h: V3, c: CarryColors) => void> = {
  parcel, book: closedBook, bucket, stool, bulb, ball, pin: (S, R, xf, h) => pin(S, R, xf, h), mirror, weight,
  lamp: standLamp, plant: pottedSmall, umbrella, bag, toy, cup, vase: smallVase, bird, key: (S, R, xf, h) => key(S, R, xf, h), box: musicBox,
};
