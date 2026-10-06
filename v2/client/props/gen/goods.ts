/**
 * 棚の商品（スプラット）: ペットボトル・缶・袋菓子・紙パック・カップ麺。局所の座標は商品の底の中心が原点、正面が +z。
 * 並べる関数は本棚と同じく棚板の上面 y = 0・棚の向き x・正面 +z。
 */
import { ellipsoid, fbm, LOOK, lin, mix3, quad, Rand, revolve, scale3, superellipsoid, surface, type Look, type ShapeSink, type V3 } from '../shape.ts';

type Xf = (p: V3) => V3;
const at = (xf: Xf, o: V3): Xf => (p) => xf([p[0] + o[0], p[1] + o[1], p[2] + o[2]]);

/** ラベルの模様: 地の色・帯・ロゴの丸・文字 */
function label(u: number, v: number, base: V3, accent: V3, seed: number): V3 {
  // 回転体の u は角度（cos u, sin u）。正面（+z）は u = π/2
  const a = u / (Math.PI * 2);
  const f = (((a + 0.25) % 1) + 1) % 1;
  const front = Math.abs(f - 0.5) < 0.18;
  if (v > 0.78 || v < 0.12) return scale3(accent, 0.95);
  if (front) {
    const lx = (f - 0.5) / 0.18, ly = (v - 0.5) / 0.25;
    if (lx * lx + ly * ly < 0.55) return mix3(accent, [1, 1, 1], 0.6);
    if (v > 0.2 && v < 0.3 && Math.sin(lx * 30 + seed) > 0.2) return [0.05, 0.05, 0.05];
  }
  return scale3(base, 0.95 + 0.1 * Math.sin(v * 40 + seed));
}

const DRINKS: { liquid: number; alpha: number; label: number; accent: number; cap: number }[] = [
  { liquid: 0x9a6a1a, alpha: 0.75, label: 0x2f7a3a, accent: 0xe8d070, cap: 0x2a6a2a }, // お茶
  { liquid: 0xdfe8ee, alpha: 0.12, label: 0x3a8fd0, accent: 0xffffff, cap: 0x2a6ad0 }, // 水
  { liquid: 0xf08a1a, alpha: 0.85, label: 0xf2a020, accent: 0x2a8a3a, cap: 0xf0a020 }, // オレンジ
  { liquid: 0x2a120a, alpha: 0.92, label: 0xc0202a, accent: 0xffffff, cap: 0xc0202a }, // コーラ
  { liquid: 0xe8e080, alpha: 0.4, label: 0xf0f0e8, accent: 0x2a5ac0, cap: 0xf0f0f0 }, // スポーツ飲料
];

/** 500 ml のペットボトル（透ける本体・中身・巻いたラベル・ふた） */
export function petBottle(S: ShapeSink, R: Rand, xf: Xf, kind = R.int(0, DRINKS.length - 1)): void {
  const k = DRINKS[kind]!;
  const H = 0.205;
  const body = (t: number): [number, number] => {
    const y = t * 0.185;
    let r = 0.0325;
    if (y < 0.007) r = 0.026 + 0.0065 * Math.sin((y / 0.007) * Math.PI / 2);
    else if (y > 0.06 && y < 0.09) r -= 0.0018 * Math.sin(((y - 0.06) / 0.03) * Math.PI);
    else if (y > 0.12) r = 0.0135 + (0.0325 - 0.0135) * (0.5 + 0.5 * Math.cos(Math.min(1, (y - 0.12) / 0.05) * Math.PI));
    if (y > 0.171 && y < 0.174) r = 0.0165;
    return [r, y];
  };
  const clear: Look = { ...LOOK.clear, opacity: 0.32 };
  revolve(S, [0, 0, 0], body, { spacing: 0.006, look: clear, rand: R, xf, color: () => lin(0xe8f0f2, 0.9) });
  // 中身（少し内側）と液面
  const fill = 0.15 + R.range(-0.01, 0.01);
  const liq: Look = { ...LOOK.clear, opacity: Math.min(1.2, 0.35 + k.alpha), rough: 0.15 };
  revolve(S, [0, 0, 0], (t) => { const [r, y] = body(t * (fill / 0.185)); return [Math.max(0.004, r - 0.0015), y]; }, { spacing: 0.007, look: liq, rand: R, xf, color: () => lin(k.liquid) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.007, look: liq, rand: R, xf, pos: (u, v) => { const r = v * (body(fill / 0.185)[0] - 0.0015); return [Math.cos(u) * r, fill, Math.sin(u) * r]; }, color: () => scale3(lin(k.liquid), 1.1) });
  // ラベル（不透明）
  const seed = R.range(0, 100);
  revolve(S, [0, 0, 0], (t) => [0.0335, 0.045 + t * 0.06], { spacing: 0.0055, look: { ...LOOK.plastic, rough: 0.3 }, rand: R, xf, color: (u, v) => label(u, v, lin(k.label), lin(k.accent), seed) });
  // ふた（ぎざぎざ）
  revolve(S, [0, 0, 0], (t) => [0.0148 + (Math.sin(t * 60) > 0 ? 0.0004 : 0), 0.185 + t * (H - 0.185)], { spacing: 0.0035, look: LOOK.plastic, rand: R, xf, color: () => lin(k.cap), theta: [0, Math.PI * 2] });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.0035, look: LOOK.plastic, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * 0.0148, H, Math.sin(u) * v * 0.0148], color: () => scale3(lin(k.cap), 1.05) });
}

const CANS = [[0xc0202a, 0xf0f0f0], [0x1a3a8a, 0xd0d8e0], [0x2a8a3a, 0xf0e070], [0xf0c020, 0x1a1a1a], [0x6a2a8a, 0xe0d0f0], [0xd8dadc, 0xc02020]];

/** 350 ml の缶（印刷した胴・金属の上下・プルタブ） */
export function can(S: ShapeSink, R: Rand, xf: Xf, kind = R.int(0, CANS.length - 1)): void {
  const [base, accent] = CANS[kind]!;
  const seed = R.range(0, 100);
  const prof = (t: number): [number, number] => {
    const y = t * 0.122;
    let r = 0.033;
    if (y < 0.006) r = 0.026 + 0.007 * (y / 0.006);
    if (y > 0.11) r = 0.033 - (y - 0.11) / 0.012 * 0.006;
    return [r, y];
  };
  revolve(S, [0, 0, 0], prof, {
    spacing: 0.0055, look: { rough: 0.22, metal: 0.35, opacity: 1.6, mat: 3 }, rand: R, xf,
    color: (u, v) => (v < 0.06 || v > 0.9 ? lin(0xc8ccd0) : label(u, (v - 0.06) / 0.84, lin(base), lin(accent), seed)),
  });
  // 上のふた（金属）と縁・プルタブ
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.0045, look: LOOK.metal, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * 0.027, 0.119 - (1 - v) * 0.002, Math.sin(u) * v * 0.027], color: (u, v) => { const x = Math.cos(u) * v, z = Math.sin(u) * v; return x * x * 4 + (z - 0.35) * (z - 0.35) * 9 < 0.12 ? lin(0x9a9ea2) : lin(0xd0d4d8); } });
  revolve(S, [0, 0, 0], (t) => { const a = t * Math.PI; return [0.027 + Math.sin(a) * 0.0015, 0.12 + Math.sin(a) * 0.0015]; }, { spacing: 0.003, look: LOOK.metal, rand: R, xf, color: () => lin(0xd8dcdf) });
}

/** 袋菓子（つやのある袋・しわ・上下の圧着の帯・中身の窓） */
export function snackBag(S: ShapeSink, R: Rand, xf: Xf): void {
  const col = lin(R.pick([0xd8202a, 0x1a6ad0, 0xf0b020, 0x2a9a3a, 0x8a2ab0, 0xe86a1a]));
  const acc = lin(R.pick([0xf8f0d0, 0xffe040, 0x101010]));
  const W = 0.085, Hb = 0.12, D = 0.035;
  const foil: Look = { rough: 0.22, metal: 0.55, opacity: 1.6, mat: 3 };
  superellipsoid(S, [0, Hb + 0.012, 0], [W, Hb, D], 0.12, 0.25, {
    spacing: 0.0055, look: foil, rand: R, xf,
    warp: (p, d) => {
      const crinkle = (fbm(p[0] * 60, p[1] * 60, p[2] * 60) - 0.5) * 0.004;
      // 上下の端は平たく（中身が無い）
      const squash = 1 - Math.pow(Math.abs(d[1]), 6) * 0.9;
      return [p[0] + d[0] * crinkle, p[1], p[2] * squash + d[2] * crinkle];
    },
    // 局所の向き（u = 経度・v = 緯度）で模様を決める（p は部屋の座標なので使わない）
    color: (u, v) => {
      const ly = Math.sin(v), lx = Math.cos(v) * Math.cos(u);
      const front = Math.sin(u) > 0.3;
      if (front && Math.abs(ly + 0.2) < 0.25 && Math.abs(lx) < 0.5) return scale3(lin(0xe0b050), 0.7 + 0.5 * fbm(lx * 20, ly * 20, 0));
      if (front && ly > 0.25 && ly < 0.55) return Math.sin(lx * 30) > 0 ? acc : col;
      return scale3(col, 0.9 + 0.15 * Math.sin(u * 3 + v));
    },
  });
  // 圧着の帯（ぎざぎざの縁）
  for (const y of [0.006, 2 * Hb + 0.016]) {
    quad(S, [-W * 0.95, y - 0.008, 0], [W * 1.9, 0, 0], [0, 0.016, 0], { spacing: 0.004, look: foil, rand: R, xf, color: (u) => (Math.sin(u * 200) > 0 ? scale3(col, 0.8) : scale3(col, 1.1)), skip: (u, v) => v < 0.1 && Math.sin(u * 120) < 0 });
  }
}

/** 1 L の紙パック（三角屋根） */
export function carton(S: ShapeSink, R: Rand, xf: Xf): void {
  const c = lin(R.pick([0x2a6ad0, 0x2a9a3a, 0xe0a020, 0xd02a6a]));
  const w = 0.035, h = 0.195, top = 0.235;
  const look: Look = { ...LOOK.matte, rough: 0.55, mat: 1 };
  const face = (u: number, v: number): V3 => (v > 0.75 ? lin(0xf6f4ee) : v < 0.1 ? scale3(c, 0.8) : Math.abs(u - 0.5) < 0.3 && v > 0.35 && v < 0.65 ? lin(0xf6f4ee) : c);
  quad(S, [-w, 0, w], [2 * w, 0, 0], [0, h, 0], { spacing: 0.006, look, rand: R, xf, color: face });
  quad(S, [w, 0, -w], [-2 * w, 0, 0], [0, h, 0], { spacing: 0.006, look, rand: R, xf, color: face });
  quad(S, [w, 0, w], [0, 0, -2 * w], [0, h, 0], { spacing: 0.006, look, rand: R, xf, color: (_u, v) => (v > 0.75 ? lin(0xf6f4ee) : c) });
  quad(S, [-w, 0, -w], [0, 0, 2 * w], [0, h, 0], { spacing: 0.006, look, rand: R, xf, color: (_u, v) => (v > 0.75 ? lin(0xf6f4ee) : c) });
  // 屋根（正面・背面の斜面）と上の耳
  quad(S, [-w, h, w], [2 * w, 0, 0], [0, top - h, -w], { spacing: 0.006, look, rand: R, xf, color: () => lin(0xf6f4ee) });
  quad(S, [w, h, -w], [-2 * w, 0, 0], [0, top - h, w], { spacing: 0.006, look, rand: R, xf, color: () => lin(0xf6f4ee) });
  quad(S, [-w, top, 0.001], [2 * w, 0, 0], [0, 0.012, 0], { spacing: 0.003, look, rand: R, xf, twoSided: true, color: () => scale3(c, 0.9) });
}

/** カップ麺（逆さの円すい台 + ふた） */
export function cupNoodle(S: ShapeSink, R: Rand, xf: Xf): void {
  const c = lin(R.pick([0xc0202a, 0xf0b020, 0x2a6ad0]));
  revolve(S, [0, 0, 0], (t) => [0.034 + t * 0.012, t * 0.1], {
    spacing: 0.0055, look: { ...LOOK.plastic, rough: 0.45 }, rand: R, xf,
    color: (u, v) => (v > 0.35 && v < 0.65 ? (Math.abs(Math.sin(u)) > 0.85 && v > 0.42 && v < 0.58 ? lin(0xf8f4e8) : c) : lin(0xf6f2ea)),
  });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.0055, look: { ...LOOK.plastic, rough: 0.35 }, rand: R, xf, pos: (u, v) => [Math.cos(u) * v * 0.047, 0.1 + (1 - v) * 0.002, Math.sin(u) * v * 0.047], color: (u, v) => (v < 0.55 && Math.cos(u) > 0 ? c : lin(0xe8e4dc)) });
}

export type GoodsKind = 'drinks' | 'cans' | 'snacks' | 'mixed' | 'cartons';

/** 棚の段に商品を並べる（同じ商品を数個ずつ続ける。正面の列だけ） */
export function goodsRow(S: ShapeSink, R: Rand, xf: Xf, o: { x0: number; x1: number; zFront: number; maxH: number; kind: GoodsKind }): void {
  let x = o.x0 + 0.01;
  while (x < o.x1 - 0.04) {
    const pick = o.kind === 'mixed' ? R.pick(['drinks', 'cans', 'snacks', 'cartons', 'noodles'] as const) : o.kind;
    const run = R.int(2, 5);
    const variant = R.int(0, 5);
    for (let k = 0; k < run && x < o.x1 - 0.04; k++) {
      const z = o.zFront - 0.05 - R.range(0, 0.01);
      if (pick === 'drinks' && o.maxH > 0.21) { petBottle(S, R, at(xf, [x + 0.034, 0, z]), variant % 5); x += 0.07; }
      else if (pick === 'cans' || (pick === 'drinks')) { can(S, R, at(xf, [x + 0.034, 0, z]), variant % 6); x += 0.069; }
      else if (pick === 'snacks' && o.maxH > 0.26) { snackBag(S, R, (p) => xf([p[0] + x + 0.09, p[1], p[2] + z + 0.02])); x += 0.18; }
      else if (pick === 'cartons' && o.maxH > 0.24) { carton(S, R, at(xf, [x + 0.036, 0, z + 0.01])); x += 0.074; }
      else { cupNoodle(S, R, at(xf, [x + 0.048, 0, z])); x += 0.098; }
    }
    x += R.range(0.01, 0.05);
  }
}

/**
 * 自販機の見本の列（v2 の vending の光る面の前。局所: 光る面の中心の下端が原点、x が幅、+z が手前、y が上）。
 * 段ごとに缶とペットボトルの見本（少し小さく）・値札・押しボタン
 */
export function vendingDisplay(S: ShapeSink, R: Rand, xf: Xf, o: { width: number; rows: number[]; perRow: number }): void {
  const step = o.width / o.perRow;
  // 見本の窓の奥の板（光る面の前を覆う。見本が逆光の影にならないように）と、段ごとの上の照明の帯
  const yb = o.rows[0]! - 0.035, yt = o.rows[o.rows.length - 1]! + 0.21;
  quad(S, [-o.width / 2, yb, 0.004], [o.width, 0, 0], [0, yt - yb, 0], { spacing: 0.01, look: LOOK.matte, rand: R, xf, color: (_u, v) => scale3(lin(0xdfe3e4), 0.85 + 0.15 * v) });
  for (const y of o.rows) quad(S, [-o.width / 2, y + 0.2, 0.006], [o.width, 0, 0], [0, 0.008, 0], { spacing: 0.004, look: { ...LOOK.matte, emit: lin(0xf4f8ff, 2.5) }, rand: R, xf, color: () => lin(0xffffff) });
  for (const y of o.rows) {
    for (let k = 0; k < o.perRow; k++) {
      const x = -o.width / 2 + step * (k + 0.5);
      const put = (p: V3): V3 => xf([x + p[0] * 0.8, y + 0.012 + p[1] * 0.8, 0.045 + p[2] * 0.8]);
      if (R.chance(0.45)) petBottle(S, R, put); else can(S, R, put);
      // 値札（白い札に数字の帯）と押しボタン
      quad(S, [x - step * 0.36, y - 0.002, 0.018], [step * 0.72, 0, 0], [0, 0.014, 0], { spacing: 0.002, look: LOOK.matte, rand: R, xf, color: (u) => (u > 0.25 && u < 0.75 && Math.sin(u * 60) > -0.3 ? lin(0x202020) : lin(0xf4f4f0)) });
      const button = lin(R.chance(0.15) ? 0xe03020 : 0x2a8ad0);
      ellipsoid(S, [x, y - 0.018, 0.02], [0.009, 0.006, 0.004], { spacing: 0.0015, look: LOOK.glossy, rand: R, xf, color: () => button });
    }
    // 段の棚（細い板）
    quad(S, [-o.width / 2, y, 0.08], [o.width, 0, 0], [0, 0, -0.07], { spacing: 0.006, look: LOOK.plastic, rand: R, xf, color: () => lin(0xd8d8d8) });
  }
}

