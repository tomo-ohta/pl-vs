/**
 * 植物（スプラット）。鉢は回転体、葉は 1 枚ずつのリボン（両面・中央の葉脈・先の垂れ）。
 * 座標は局所（鉢の底の中心が原点、y が上）。xf で部屋へ置く。
 */
import { ellipsoid, fbm, LOOK, lin, mix3, norm, Rand, revolve, scale3, surface, tube, type Look, type ShapeSink, type V3 } from '../shape.ts';

type Xf = (p: V3) => V3;

// ---------------------------------------------------------------- 鉢と土

export interface PotOpts { r0: number; r1: number; h: number; color: number; look?: Look; rim?: number; soil?: number }

/** 丸い鉢（底の半径 r0 → 口の半径 r1、高さ h）+ 縁 + 土。返り値は土の高さ */
export function pot(S: ShapeSink, R: Rand, xf: Xf, o: PotOpts): number {
  const col = lin(o.color);
  const look = o.look ?? LOOK.ceramic;
  const rim = o.rim ?? 0.012;
  // 外側（下ほど少し暗い）
  revolve(S, [0, 0, 0], (t) => [o.r0 + (o.r1 - o.r0) * t, t * o.h], {
    spacing: 0.007, look, rand: R, xf,
    color: (_u, v, p) => scale3(col, (0.78 + 0.22 * v) * (0.94 + 0.08 * fbm(p[0] * 30, p[1] * 30, p[2] * 30))),
  });
  // 縁（上に丸く）
  revolve(S, [0, 0, 0], (t) => { const a = t * Math.PI; return [o.r1 + Math.sin(a) * rim - rim * 0.3, o.h + (1 - Math.cos(a)) * rim * 0.5 - 0.004, ]; }, {
    spacing: 0.005, look, rand: R, xf, color: () => scale3(col, 1.05),
  });
  // 内側の縁（土まで少し見える）
  const soilY = o.h - (o.soil ?? 0.03);
  revolve(S, [0, 0, 0], (t) => [o.r1 - 0.006, soilY + t * (o.h - soilY)], {
    spacing: 0.006, look, rand: R, xf, flip: true, color: () => scale3(col, 0.55),
  });
  // 土（粒の大きさがばらつく茶色。小石を少し）
  surface(S, {
    u: [0, Math.PI * 2], v: [0, 1], spacing: 0.006, look: LOOK.matte, rand: R, xf,
    pos: (u, v) => { const r = v * (o.r1 - 0.008); return [Math.cos(u) * r, soilY + (fbm(Math.cos(u) * r * 40, 0, Math.sin(u) * r * 40) - 0.5) * 0.006, Math.sin(u) * r]; },
    color: (_u, _v, p) => { const k = fbm(p[0] * 80, 3, p[2] * 80); return k > 0.72 ? lin(0x8a8070, 0.9) : scale3(lin(0x3b2a1c), 0.6 + 0.6 * k); },
  });
  return soilY;
}

// ---------------------------------------------------------------- 葉

export interface LeafOpts {
  /** 付け根（局所） */
  base: V3;
  /** 出る向き（単位ベクトル） */
  dir: V3;
  length: number;
  /** 最大の幅 */
  width: number;
  /** 垂れる強さ（先ほど下へ曲がる） */
  droop: number;
  /** 葉の形: 細長い / 丸い（ハート） / 剣 */
  shape: 'lance' | 'heart' | 'sword' | 'oval';
  /** 葉の色（付け根・先・縁の色の作り方） */
  color: (s: number, t: number, edge: number) => V3;
  /** 横断面のくぼみ（V 字） */
  cup?: number;
  /** ねじれ（ラジアン） */
  twist?: number;
  spacing?: number;
  look?: Look;
}

function widthProfile(shape: LeafOpts['shape'], t: number): number {
  switch (shape) {
    case 'lance': return Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.65) * (1 - 0.15 * t);
    case 'heart': { const a = Math.sin(Math.PI * Math.pow(t, 0.85)); return a * (1 + 0.35 * Math.exp(-(((t - 0.25) / 0.18) ** 2))); }
    case 'sword': return Math.min(1, t * 6) * Math.pow(1 - t, 0.45);
    case 'oval': return Math.pow(Math.sin(Math.PI * t), 0.75);
  }
}

/** 葉 1 枚（両面）。中心線は dir から重さで垂れる弧 */
export function leaf(S: ShapeSink, R: Rand, xf: Xf, o: LeafOpts): void {
  const N = 24;
  const pts: V3[] = [];
  const dirs: V3[] = [];
  let p: V3 = [...o.base];
  let d = norm(o.dir);
  const step = o.length / N;
  for (let i = 0; i <= N; i++) {
    pts.push(p);
    dirs.push(d);
    // 重さで先ほど下を向く
    const t = i / N;
    d = norm([d[0], d[1] - o.droop * step * (0.4 + 2.2 * t), d[2]]);
    p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step];
  }
  const at = (t: number): { p: V3; d: V3 } => {
    const f = Math.min(N - 1e-6, t * N), i = Math.floor(f), k = f - i;
    const a = pts[i]!, b = pts[i + 1]!, da = dirs[i]!, db = dirs[i + 1]!;
    return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], d: norm([da[0] + (db[0] - da[0]) * k, da[1] + (db[1] - da[1]) * k, da[2] + (db[2] - da[2]) * k]) };
  };
  // 葉の横の向き: 中心線と上の向きの外積（ねじれを足す）
  const side = (d: V3, t: number): V3 => {
    let s = norm([d[2], 0, -d[0]]);
    if (!Number.isFinite(s[0]) || Math.hypot(d[0], d[2]) < 1e-3) s = [1, 0, 0];
    const tw = (o.twist ?? 0) * t;
    if (tw) {
      const up = norm([d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]);
      s = norm([s[0] * Math.cos(tw) + up[0] * Math.sin(tw), s[1] * Math.cos(tw) + up[1] * Math.sin(tw), s[2] * Math.cos(tw) + up[2] * Math.sin(tw)]);
    }
    return s;
  };
  const cup = o.cup ?? 0.25;
  const look = o.look ?? LOOK.leaf;
  surface(S, {
    u: [-1, 1], v: [0, 1], spacing: o.spacing ?? 0.005, look, rand: R, xf, twoSided: true, jitter: 0.25, size: 0.7,
    pos: (u, v) => {
      const { p, d } = at(v);
      const s = side(d, v);
      const w = o.width * 0.5 * widthProfile(o.shape, v);
      const n = norm([d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]);
      const lift = cup * w * u * u;
      return [p[0] + s[0] * u * w + n[0] * lift, p[1] + s[1] * u * w + n[1] * lift, p[2] + s[2] * u * w + n[2] * lift];
    },
    color: (u, v) => o.color(u, v, Math.abs(u)),
    backColor: (u, v) => scale3(mix3(o.color(u, v, Math.abs(u)), [0.35, 0.42, 0.22], 0.25), 0.85),
  });
}

const leafGreen = (R: Rand, base: number, vein = 1.15, tip = 0x9aa83c) => {
  const c0 = lin(base), ct = lin(tip);
  const k = 0.85 + R.next() * 0.3;
  return (s: number, t: number, edge: number): V3 => {
    let c = scale3(c0, k * (0.82 + 0.3 * t));
    if (edge < 0.08) c = scale3(c, vein);
    if (t > 0.85) c = mix3(c, ct, (t - 0.85) * 1.6);
    return scale3(c, 0.92 + 0.12 * Math.sin(s * 40 + t * 25));
  };
};

// ---------------------------------------------------------------- 植物の種類

/** ドラセナ（幸福の木）: 太さの違う幹が 3 本、それぞれの上に細長い葉のロゼット */
export function dracaena(S: ShapeSink, R: Rand, xf: Xf): void {
  const soil = pot(S, R, xf, { r0: 0.14, r1: 0.19, h: 0.36, color: 0xb86a45 });
  const canes: [number, number, number][] = [[0.04, 0, 1.15], [-0.05, 0.03, 0.85], [0.01, -0.06, 0.62]];
  for (const [cx, cz, h] of canes) {
    const r = 0.03 + h * 0.012;
    tube(S, (t) => [cx + Math.sin(t * 2) * 0.01, soil + t * (h - soil), cz], () => r, {
      spacing: 0.006, look: LOOK.matte, rand: R, xf,
      color: (_u, v, p) => { const ring = Math.sin(v * 70) > 0.75 ? 0.7 : 1; return scale3(lin(0x7a6248), ring * (0.8 + 0.4 * fbm(p[0] * 60, p[1] * 60, p[2] * 60))); },
    });
    const n = R.int(18, 26);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R.range(-0.2, 0.2);
      const up = R.range(0.35, 0.95);
      leaf(S, R, xf, {
        base: [cx, h - R.range(0, 0.08), cz], dir: [Math.cos(a) * (1 - up * 0.6), up, Math.sin(a) * (1 - up * 0.6)],
        length: R.range(0.32, 0.55), width: R.range(0.035, 0.05), droop: R.range(2.2, 3.6), shape: 'lance', cup: 0.35, twist: R.range(-0.6, 0.6),
        color: ((g) => (s: number, t: number, e: number) => { const c = g(s, t, e); return e > 0.35 && e < 0.6 ? mix3(c, lin(0xb9c45a), 0.55) : c; })(leafGreen(R, 0x2f5a1e)),
      });
    }
  }
}

/** ポトス: 丸い葉（ハート形・黄色の斑）が鉢の上に茂り、つるが縁から垂れる */
export function pothos(S: ShapeSink, R: Rand, xf: Xf): void {
  const soil = pot(S, R, xf, { r0: 0.11, r1: 0.15, h: 0.25, color: 0xe9e4d8 });
  const variegate = (s: number, t: number, e: number, k: number): V3 => {
    const c = scale3(lin(0x3f7a24), k * (0.85 + 0.25 * t));
    const streak = fbm(s * 3 + k * 10, t * 9, k * 5);
    return streak > 0.62 ? mix3(c, lin(0xd8d27a), (streak - 0.62) * 2.2) : e < 0.06 ? scale3(c, 1.15) : c;
  };
  // 茂み: 半球の上に葉を散らす
  const n = 70;
  for (let k = 0; k < n; k++) {
    const a = R.range(0, Math.PI * 2), el = Math.acos(R.range(0.1, 1));
    const r = R.range(0.1, 0.24);
    const base: V3 = [Math.cos(a) * Math.sin(el) * r, soil + 0.04 + Math.cos(el) * r * 0.9, Math.sin(a) * Math.sin(el) * r];
    // 葉柄
    const out = norm([base[0], 0.6, base[2]]);
    const kk = 0.85 + R.next() * 0.3;
    leaf(S, R, xf, { base, dir: [out[0] + R.range(-0.3, 0.3), out[1] + R.range(-0.2, 0.3), out[2] + R.range(-0.3, 0.3)], length: R.range(0.08, 0.12), width: R.range(0.06, 0.085), droop: R.range(1, 3), shape: 'heart', cup: 0.15, twist: R.range(-0.4, 0.4), spacing: 0.004, color: (s, t, e) => variegate(s, t, e, kk) });
  }
  // つる 4 本（縁から垂れる）
  for (let v = 0; v < 4; v++) {
    const a = (v / 4) * Math.PI * 2 + R.range(0, 0.6);
    const len = R.range(0.35, 0.6);
    const path = (t: number): V3 => { const r = 0.15 + Math.sin(t * Math.PI * 0.5) * 0.06; return [Math.cos(a) * r, 0.25 - t * len + 0.02, Math.sin(a) * r]; };
    tube(S, path, () => 0.0035, { spacing: 0.004, look: LOOK.leaf, rand: R, xf, color: () => lin(0x4d7a2a) });
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const p = path(t);
      const side = i % 2 ? 1 : -1;
      const kk = 0.85 + R.next() * 0.3;
      leaf(S, R, xf, { base: p, dir: [Math.cos(a) + side * Math.sin(a) * 0.6, 0.2, Math.sin(a) - side * Math.cos(a) * 0.6], length: 0.07 - t * 0.02, width: 0.06 - t * 0.015, droop: 4, shape: 'heart', cup: 0.1, spacing: 0.004, color: (s, tt, e) => variegate(s, tt, e, kk) });
    }
  }
}

/** サンセベリア: まっすぐ立つ剣状の葉（濃い緑に明るい横縞、縁は黄色） */
export function sansevieria(S: ShapeSink, R: Rand, xf: Xf): void {
  const soil = pot(S, R, xf, { r0: 0.12, r1: 0.15, h: 0.3, color: 0x3a3a3c, look: LOOK.plastic });
  const n = 11;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + R.range(-0.3, 0.3);
    const r = R.range(0.02, 0.08);
    const lean = R.range(0.05, 0.22);
    const phase = R.range(0, 10);
    leaf(S, R, xf, {
      base: [Math.cos(a) * r, soil, Math.sin(a) * r], dir: [Math.cos(a) * lean, 1, Math.sin(a) * lean],
      length: R.range(0.5, 0.8), width: R.range(0.075, 0.095), droop: 0.08, shape: 'sword', cup: 0.25, twist: R.range(-0.5, 0.5), spacing: 0.005,
      look: { ...LOOK.leaf, rough: 0.4 },
      color: (s, t, e) => {
        if (e > 0.8) return lin(0xd8c860);
        const band = Math.sin(t * 38 + Math.sin(s * 6 + phase) * 2.2) > 0.35;
        return band ? lin(0xa8bd94) : scale3(lin(0x3f6e45), 0.9 + 0.2 * t);
      },
    });
  }
}

/** ベンジャミン（フィカスの木）: 編んだ幹・枝・小さな楕円の葉の樹冠 */
export function ficus(S: ShapeSink, R: Rand, xf: Xf): void {
  const soil = pot(S, R, xf, { r0: 0.18, r1: 0.23, h: 0.42, color: 0xe2ddd2 });
  const H = 1.25;
  const bark = (_u: number, v: number, p: V3): V3 => scale3(lin(0x8c7b66), 0.75 + 0.4 * fbm(p[0] * 50, p[1] * 18 + v, p[2] * 50));
  // 編んだ 3 本の幹
  for (let k = 0; k < 3; k++) {
    const ph = (k / 3) * Math.PI * 2;
    tube(S, (t) => { const y = soil + t * H; const a = ph + t * 7; return [Math.cos(a) * 0.022, y, Math.sin(a) * 0.022]; }, (t) => 0.016 - t * 0.006, { spacing: 0.005, look: LOOK.matte, rand: R, xf, color: bark });
  }
  // 枝と葉の房
  const tips: V3[] = [];
  for (let b = 0; b < 9; b++) {
    const a = (b / 9) * Math.PI * 2 + R.range(-0.3, 0.3);
    const y0 = soil + H * R.range(0.55, 0.95);
    const L = R.range(0.22, 0.42);
    const path = (t: number): V3 => [Math.cos(a) * L * t, y0 + t * L * 0.55 - t * t * L * 0.25, Math.sin(a) * L * t];
    tube(S, path, (t) => 0.007 - t * 0.004, { spacing: 0.005, look: LOOK.matte, rand: R, xf, color: bark });
    tips.push(path(1), path(0.6));
  }
  tips.push([0, soil + H + 0.08, 0]);
  for (const tip of tips) {
    const m = R.int(28, 40);
    for (let k = 0; k < m; k++) {
      const d = norm([R.range(-1, 1), R.range(-0.6, 1), R.range(-1, 1)]);
      const r = R.range(0.02, 0.16);
      const base: V3 = [tip[0] + d[0] * r, tip[1] + d[1] * r * 0.8, tip[2] + d[2] * r];
      leaf(S, R, xf, { base, dir: [d[0], d[1] - 0.4, d[2]], length: R.range(0.05, 0.075), width: R.range(0.025, 0.035), droop: 2.5, shape: 'oval', cup: 0.2, twist: R.range(-1, 1), spacing: 0.004, look: { ...LOOK.leaf, rough: 0.32 }, color: leafGreen(R, 0x2c5f1f, 1.1, 0x5f8a2c) });
    }
  }
}

/** エケベリア（多肉植物）の寄せ植え: 小さな鉢に、肉厚の葉のロゼット 1〜3 個 */
export function succulent(S: ShapeSink, R: Rand, xf: Xf): void {
  const soil = pot(S, R, xf, { r0: 0.055, r1: 0.075, h: 0.08, color: 0x9a6a50, rim: 0.006, soil: 0.012 });
  const rosettes: [number, number, number][] = [[0, 0, 1], [0.035, 0.025, 0.6], [-0.03, 0.03, 0.5]];
  for (const [cx, cz, s] of rosettes) {
    const n = Math.round(28 * s + 10);
    for (let k = 0; k < n; k++) {
      // 黄金角で内側から外側へ
      const a = k * 2.39996, f = Math.sqrt((k + 1) / n);
      const len = (0.012 + 0.03 * f) * s;
      const up = 1 - f * 0.85;
      const base: V3 = [cx + Math.cos(a) * f * 0.006, soil + 0.004 + (1 - f) * 0.01 * s, cz + Math.sin(a) * f * 0.006];
      leaf(S, R, xf, {
        base, dir: [Math.cos(a) * (1 - up), up + 0.15, Math.sin(a) * (1 - up)], length: len, width: len * 0.62, droop: -1.5, shape: 'oval', cup: 0.7, spacing: 0.0025,
        look: { ...LOOK.leaf, rough: 0.45, opacity: 1.5 },
        color: (_s2, t, e) => { const c = mix3(lin(0x8fb3a2), lin(0x6e8f86), f); return t > 0.82 ? mix3(c, lin(0xc77a86), (t - 0.82) * 4) : e > 0.85 ? scale3(c, 1.1) : c; },
      });
    }
  }
}

/** 刈り込んだ低木（植え込みの中）: 丸い塊の表面に小さな葉をびっしり */
export function shrub(S: ShapeSink, R: Rand, xf: Xf, c: V3, r: V3): void {
  // 中の暗い茂み（葉のすき間から向こうが透けないように）
  ellipsoid(S, c, [r[0] * 0.86, r[1] * 0.86, r[2] * 0.86], { spacing: 0.012, look: { ...LOOK.leaf, rough: 0.8 }, rand: R, xf, jitter: 0.6, color: (u, v) => scale3(lin(0x1a3314), 0.8 + 0.4 * fbm(u * 3, v * 3, 2)) });
  const area = 4 * Math.PI * Math.pow((r[0] * r[1] + r[1] * r[2] + r[0] * r[2]) / 3, 1);
  const n = Math.round(area / 0.0011);
  for (let k = 0; k < n; k++) {
    const d = norm([R.range(-1, 1), R.range(-0.2, 1), R.range(-1, 1)]);
    const depth = 1 - Math.pow(R.next(), 3) * 0.25;
    const bump = 1 + (fbm(d[0] * 4, d[1] * 4, d[2] * 4) - 0.5) * 0.25;
    const base: V3 = [c[0] + d[0] * r[0] * depth * bump, c[1] + d[1] * r[1] * depth * bump, c[2] + d[2] * r[2] * depth * bump];
    const g = 0.75 + 0.35 * depth * R.next();
    leaf(S, R, xf, {
      base, dir: [d[0] + R.range(-0.6, 0.6), d[1] + R.range(-0.3, 0.6), d[2] + R.range(-0.6, 0.6)], length: R.range(0.025, 0.04), width: R.range(0.014, 0.02),
      droop: 1, shape: 'oval', cup: 0.2, twist: R.range(-1, 1), spacing: 0.004, look: { ...LOOK.leaf, rough: 0.5 },
      color: (s, t, e) => scale3(depth < 0.9 ? lin(0x1f3d17) : t > 0.7 ? lin(0x6f9a32) : lin(0x3d6b22), g * (1 - e * 0.15) * (0.95 + 0.1 * Math.sin(s * 30))),
    });
  }
}
