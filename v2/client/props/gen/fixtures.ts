/**
 * 設備（形の関数）: 壁掛けの洗面器・便器（ブースの中）・壁の灯り・流し台の天板（流しと水栓・コンロ）。
 * 局所の座標: 壁の面が z = 0（正面 +z）、床が y = 0。v2 の sinkRow / booths / sconce / kitchenette と同じ寸法に合わせる。
 */
import { ellipsoid, fbm, LOOK, lin, quad, Rand, revolve, scale3, superellipsoid, surface, tube, type Look, type ShapeSink, type V3 } from '../shape.ts';

type Xf = (p: V3) => V3;
const glaze = LOOK.ceramic;
const chrome: Look = { rough: 0.1, metal: 1, opacity: 1.6, mat: 3 };
const steel: Look = { rough: 0.32, metal: 1, opacity: 1.6, mat: 3 };
const WHITE = 0xf4f3ef;

/** 水栓の注ぎ口（台から立ち上がって前へ曲がる。base は台の上の点、reach は前へ出る長さ） */
function spout(S: ShapeSink, R: Rand, xf: Xf, base: V3, rise: number, reach: number, r = 0.011): void {
  revolve(S, base, (t) => [r * 2.2 - t * r, t * 0.02], { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xdadada) });
  const path = (t: number): V3 => {
    if (t < 0.55) return [base[0], base[1] + 0.02 + (t / 0.55) * rise, base[2]];
    const a = ((t - 0.55) / 0.45) * Math.PI * 0.75;
    return [base[0], base[1] + 0.02 + rise + Math.sin(a) * reach * 0.35, base[2] + (1 - Math.cos(a)) * reach * 0.6];
  };
  tube(S, path, () => r, { spacing: 0.003, look: chrome, rand: R, xf, color: () => lin(0xdadada) });
  // 横のレバー
  tube(S, (t) => [base[0] + r + t * 0.06, base[1] + 0.02 + rise * 0.55 + t * 0.012, base[2]], () => r * 0.45, { spacing: 0.0025, look: chrome, rand: R, xf, color: () => lin(0xdadada) });
}

/**
 * 壁掛けの洗面器（v2 の sinkRow の 1 つ分: 幅 0.5・奥行き 0.45・上面 0.9）。原点は器の中心の真下の壁の面・床
 * 外側の殻・平らな縁・くぼみ・排水口・水栓・下の排水管（S 字）
 */
export function wallBasin(S: ShapeSink, R: Rand, xf: Xf): void {
  const white = lin(WHITE);
  const top = 0.9, cz = 0.245;
  // 外側（下半分の角の丸い殻）
  superellipsoid(S, [0, top, cz], [0.25, 0.17, 0.225], 0.6, 0.45, {
    spacing: 0.006, look: glaze, rand: R, xf,
    skip: (_u, v) => v > 0.02,
    color: (_u, v) => scale3(white, 0.9 + 0.1 * Math.cos(v)),
  });
  // くぼみ（内向き）
  ellipsoid(S, [0, top, cz + 0.015], [0.205, 0.13, 0.175], {
    spacing: 0.006, look: glaze, rand: R, xf, flip: true, vRange: [Math.PI / 2, Math.PI - 0.001],
    color: (_u, v) => scale3(white, 0.78 + 0.2 * Math.sin(v)),
  });
  // 縁（外の輪郭とくぼみの輪郭の間の平らな輪）
  const sp = (w: number, m: number): number => Math.sign(w) * Math.pow(Math.abs(w), m);
  surface(S, {
    u: [0, Math.PI * 2], v: [0, 1], spacing: 0.005, look: glaze, rand: R, xf, flip: true,
    pos: (u, v) => {
      const ox = sp(Math.cos(u), 0.45) * 0.25, oz = sp(Math.sin(u), 0.45) * 0.225;
      const ix = Math.cos(u) * 0.205, iz = Math.sin(u) * 0.175 + 0.015;
      return [ix + (ox - ix) * v, top + 0.002 * Math.sin(v * Math.PI), cz + iz + (oz - iz) * v];
    },
    color: () => white,
  });
  // 排水口
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.002, look: chrome, rand: R, xf, flip: true, pos: (u, v) => [Math.cos(u) * v * 0.022, top - 0.129, cz + 0.015 + Math.sin(u) * v * 0.022], color: (_u, v) => (v < 0.7 && Math.sin(v * 40) > 0 ? lin(0x202020) : lin(0xd0d0d0)) });
  // 水栓（縁の奥）
  spout(S, R, xf, [0, top, 0.045], 0.1, 0.12);
  // 排水管: 器の底から下りて S 字に曲がり、壁へ
  tube(S, (t) => {
    if (t < 0.4) return [0, top - 0.17 - t * 0.35, cz];
    if (t < 0.7) { const a = ((t - 0.4) / 0.3) * Math.PI; return [0, top - 0.31 - Math.sin(a) * 0.05, cz - (1 - Math.cos(a)) * 0.04]; }
    const k = (t - 0.7) / 0.3; return [0, top - 0.31, cz - 0.08 - k * (cz - 0.08)];
  }, () => 0.016, { spacing: 0.004, look: chrome, rand: R, xf, color: () => lin(0xc8c8c8) });
}

/**
 * 洋式便器（ブースの奥の壁際。幅 0.38・奥行き 0.66・便座 0.42・タンク上端 0.8）。原点は壁の面・床・中心
 * 台座・器・便座・ふた（開いている / 閉じている）・タンク・洗浄レバー。lidUp で ふたを開ける
 */
export function toilet(S: ShapeSink, R: Rand, xf: Xf, lidUp = R.chance(0.5)): void {
  const white = lin(WHITE);
  const shade = (k: number) => (_u: number, v: number): V3 => scale3(white, k * (0.92 + 0.08 * Math.cos(v)));
  // 台座（床から器へ。上は器に隠れる）
  superellipsoid(S, [0, 0.17, 0.36], [0.12, 0.17, 0.19], 0.35, 0.9, { spacing: 0.007, look: glaze, rand: R, xf, skip: (_u, v) => v > 0.6, color: shade(0.95) });
  // 器の外側（楕円の鉢。上面は便座の下）
  superellipsoid(S, [0, 0.33, 0.39], [0.18, 0.09, 0.26], 0.55, 0.85, { spacing: 0.007, look: glaze, rand: R, xf, skip: (_u, v) => v > 0.75, color: shade(1) });
  // 器の縁（上面の輪）と、ふたが開いていれば内側と水
  const rimY = 0.405;
  surface(S, {
    u: [0, Math.PI * 2], v: [0, 1], spacing: 0.005, look: glaze, rand: R, xf, flip: true,
    pos: (u, v) => { const rx = 0.13 + v * 0.05, rz = 0.2 + v * 0.06; return [Math.cos(u) * rx, rimY + Math.sin(v * Math.PI) * 0.006, 0.39 + Math.sin(u) * rz]; },
    color: () => white,
  });
  ellipsoid(S, [0, rimY, 0.4], [0.13, 0.17, 0.2], { spacing: 0.006, look: glaze, rand: R, xf, flip: true, vRange: [Math.PI / 2, Math.PI * 0.86], color: (_u, v) => scale3(white, 0.75 + 0.2 * Math.sin(v)) });
  surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.005, look: { ...LOOK.clear, opacity: 0.55 }, rand: R, xf, flip: true, pos: (u, v) => [Math.cos(u) * v * 0.07, rimY - 0.11, 0.43 + Math.sin(u) * v * 0.1], color: () => lin(0xa8c4d0) });
  // 便座（平たい輪）
  const seat = lin(0xf0eee8);
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.cos(a) * 0.155, rimY + 0.022, 0.39 + Math.sin(a) * 0.23]; }, () => 0.02, { spacing: 0.005, look: LOOK.plastic, rand: R, xf, color: () => seat });
  // ふた（ちょうつがいは奥。開いていればタンクにもたれる）
  const hingeY = rimY + 0.04, hingeZ = 0.16;
  const lid = (p: V3): V3 => {
    const y = p[1] - hingeY, z = p[2] - hingeZ;
    if (!lidUp) return xf(p);
    const a = -1.5; // 起こす（x 軸まわり）
    return xf([p[0], hingeY + y * Math.cos(a) - z * Math.sin(a), hingeZ + y * Math.sin(a) + z * Math.cos(a)]);
  };
  superellipsoid(S, [0, hingeY + 0.004, 0.39], [0.175, 0.012, 0.235], 0.35, 0.6, { spacing: 0.006, look: LOOK.plastic, rand: R, xf: lid, color: () => seat });
  // タンク（角の丸い箱）とふた・洗浄レバー
  superellipsoid(S, [0, 0.62, 0.1], [0.2, 0.18, 0.085], 0.2, 0.25, { spacing: 0.007, look: glaze, rand: R, xf, color: shade(1) });
  superellipsoid(S, [0, 0.805, 0.1], [0.21, 0.018, 0.095], 0.2, 0.2, { spacing: 0.006, look: glaze, rand: R, xf, color: shade(1.02) });
  tube(S, (t) => [-0.14 - t * 0.06, 0.74, 0.19], () => 0.006, { spacing: 0.0025, look: chrome, rand: R, xf, color: () => lin(0xd0d0d0) });
  revolve(S, [-0.14, 0.74, 0.185], (t) => [0.016 - t * 0.004, t * 0.01], { spacing: 0.0025, look: chrome, rand: R, xf: (p) => xf([p[0], 0.74 + (p[2] - 0.185), 0.185 + (p[1] - 0.74)]), color: () => lin(0xd0d0d0) });
}

/**
 * 壁の灯り（v2 の sconce: 幅 0.14・高さ 0.22・壁から 0.11）。原点は壁の面・灯りの下端の高さ（y = 0 が下端）
 * 金色の座金・腕・乳白のガラスの笠（中が光る）
 */
export function sconce(S: ShapeSink, R: Rand, xf: Xf, warm = 0xffd9a0): void {
  const gold: Look = { rough: 0.25, metal: 1, opacity: 1.6, mat: 3 };
  const g = lin(0xc8a040);
  // 座金（壁に付いた円盤）
  const plate = (p: V3): V3 => xf([p[0], 0.11 + p[2], p[1]]);
  revolve(S, [0, 0, 0], (t) => [0.05 - t * 0.01, t * 0.012], { spacing: 0.003, look: gold, rand: R, xf: plate, color: () => g });
  // 腕
  tube(S, (t) => [0, 0.11 - Math.sin(t * Math.PI) * 0.015, 0.01 + t * 0.07], () => 0.006, { spacing: 0.003, look: gold, rand: R, xf, color: () => g });
  // 笠（チューリップ形の乳白ガラス。内側が光る）
  const glow: Look = { ...LOOK.matte, rough: 0.35, mat: 1, emit: lin(warm, 2.2) };
  revolve(S, [0, 0.03, 0.08], (t) => [0.03 + Math.sin(t * Math.PI * 0.6) * 0.045, t * 0.18], { spacing: 0.004, look: glow, rand: R, xf, color: () => lin(0xf6efe2) });
  revolve(S, [0, 0.03, 0.08], (t) => [0.029 + Math.sin(t * Math.PI * 0.6) * 0.044, t * 0.18], { spacing: 0.005, look: glow, rand: R, xf, flip: true, color: () => lin(0xf6efe2) });
  ellipsoid(S, [0, 0.03, 0.08], [0.03, 0.01, 0.03], { spacing: 0.003, look: gold, rand: R, xf, color: () => g });
}

/**
 * 流し台の天板（ステンレス。流しの穴・流し・水栓・コンロの五徳）。原点は天板の手前の左端の下（局所 x = 0..len が天板の長さ、
 * z = 0 が壁・depth が手前、y = 0 が天板の上面）。sink は流しの位置（x の範囲）、hobs はコンロの中心の x
 */
export function kitchenTop(S: ShapeSink, R: Rand, xf: Xf, o: { len: number; depth: number; sink: [number, number]; hobs: number[] }): void {
  const [s0, s1] = o.sink;
  const sz0 = 0.12, sz1 = o.depth - 0.1;
  const brushed = (u: number, v: number): V3 => scale3(lin(0xc4c6c8), 0.86 + 0.08 * Math.sin(u * 900 + fbm(u * 30, v * 30, 2) * 3) + 0.06 * fbm(u * 8, v * 8, 4));
  // 天板の上面（流しの所は抜く）と手前の縁
  surface(S, {
    u: [0, o.len], v: [0, o.depth + 0.02], spacing: 0.012, look: steel, rand: R, xf, flip: true,
    pos: (u, v) => [u, 0.0015, v],
    skip: (u, v) => u > s0 && u < s1 && v > sz0 && v < sz1,
    color: (u, v) => brushed(u, v),
  });
  quad(S, [0, -0.03, o.depth + 0.02], [o.len, 0, 0], [0, 0.0315, 0], { spacing: 0.008, look: steel, rand: R, xf, color: (u) => brushed(u * 3, 0.5) });
  // 流し（四角い深い器: 4 つの壁と底）
  const d = 0.17;
  const wall = (o2: V3, a: V3, b: V3): void => quad(S, o2, a, b, { spacing: 0.01, look: steel, rand: R, xf, color: (u, v) => scale3(brushed(u, v), 0.75 + 0.2 * v) });
  wall([s0, -d, sz0], [s1 - s0, 0, 0], [0, d, 0]);
  wall([s1, -d, sz1], [s0 - s1, 0, 0], [0, d, 0]);
  wall([s0, -d, sz1], [0, 0, sz0 - sz1], [0, d, 0]);
  wall([s1, -d, sz0], [0, 0, sz1 - sz0], [0, d, 0]);
  quad(S, [s0, -d, sz1], [s1 - s0, 0, 0], [0, 0, sz0 - sz1], { spacing: 0.01, look: steel, rand: R, xf, color: (u, v) => { const x = (u - 0.5) * (s1 - s0), z = (v - 0.5) * (sz1 - sz0); return x * x + z * z < 0.0009 ? lin(0x202020) : scale3(brushed(u, v), 0.7); } });
  // 水栓（流しの奥）
  spout(S, R, xf, [(s0 + s1) / 2, 0, 0.06], 0.2, 0.2, 0.012);
  // コンロ（黒い五徳の輪と台）
  for (const hx of o.hobs) {
    surface(S, { u: [0, Math.PI * 2], v: [0, 1], spacing: 0.006, look: { ...LOOK.matte, rough: 0.6 }, rand: R, xf, flip: true, pos: (u, v) => [hx + Math.cos(u) * v * 0.11, 0.004, o.depth * 0.5 + Math.sin(u) * v * 0.11], color: (_u, v) => (v > 0.4 && v < 0.5 ? lin(0x3a3a3a) : lin(0x151515)) });
    tube(S, (t) => { const a = t * Math.PI * 2; return [hx + Math.cos(a) * 0.075, 0.016, o.depth * 0.5 + Math.sin(a) * 0.075]; }, () => 0.005, { spacing: 0.003, look: { ...LOOK.metal, rough: 0.55 }, rand: R, xf, color: () => lin(0x222222) });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      tube(S, (t) => [hx + Math.cos(a) * (0.05 + t * 0.06), 0.016 + Math.sin(t * Math.PI) * 0.006, o.depth * 0.5 + Math.sin(a) * (0.05 + t * 0.06)], () => 0.004, { spacing: 0.003, look: { ...LOOK.metal, rough: 0.55 }, rand: R, xf, color: () => lin(0x222222) });
    }
  }
}
