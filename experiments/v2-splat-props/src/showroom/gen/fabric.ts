/**
 * 布もの（スプラット）: 掛け布団・枕・クッション・ひざ掛け・カーテン・たたんだタオル・布団。
 * しわ・たるみ・ふくらみはノイズと形の関数で出す。
 */
import { fbm, LOOK, lin, mix3, Rand, scale3, superellipsoid, surface, tube, type Look, type Surfels, type V3 } from '../surfel.ts';

type Xf = (p: V3) => V3;

/**
 * マットレスの上の掛け布団。マットレスの上面（x0..x1 × z0..z1、高さ top）を覆い、両脇と足元に垂れる。
 * 枕の側（z0）は折り返して白いシーツが見える。局所 = 部屋の座標（xf は通常そのまま）
 */
export function duvet(S: Surfels, R: Rand, xf: Xf, o: { x0: number; x1: number; z0: number; z1: number; top: number; color: number; pattern?: boolean }): void {
  const hang = 0.26, thick = 0.05;
  const W = o.x1 - o.x0;
  const col = lin(o.color);
  const sheet = lin(0xf1eee6);
  const fold = 0.32; // 折り返しの長さ
  const zStart = o.z0 + 0.42;
  // u: 横（−hang .. W + hang）、v: 縦（zStart .. z1 + hang）
  surface(S, {
    u: [-hang, W + hang], v: [zStart, o.z1 + hang], spacing: 0.011, look: LOOK.fabric, rand: R, xf, flip: true,
    pos: (u, v) => {
      const over = Math.max(0, -u, u - W, v - o.z1);
      const n = fbm(u * 3.2, v * 3.2, 1.7);
      const wr = (fbm(u * 9, v * 9, 4.2) - 0.5) * 0.012;
      if (over <= 0) {
        // 上: ふくらみ（中央が高い）としわ
        const cu = Math.sin(Math.PI * Math.min(1, Math.max(0, u / W)));
        return [o.x0 + u, o.top + thick * (0.55 + 0.45 * cu) + (n - 0.5) * 0.03 + wr, v];
      }
      // 垂れる: 端からの距離だけ下へ。ひだは縦に波打つ
      const edgeX = u < 0 ? 0 : u > W ? W : u, edgeZ = Math.min(v, o.z1);
      const out = Math.min(0.04, over * 0.15);
      const wave = Math.sin((u < 0 || u > W ? v : u) * 18 + n * 4) * 0.012 * Math.min(1, over / 0.08);
      const dx = u < 0 ? -1 : u > W ? 1 : 0, dz = v > o.z1 ? 1 : 0;
      return [o.x0 + edgeX + dx * (out + 0.012) + dz * wave, o.top + thick * 0.4 - over * 0.95, edgeZ + dz * (out + 0.012) + (dx ? wave : 0)];
    },
    color: (u, v) => {
      let c = col;
      if (o.pattern) { const g = (Math.floor(u / 0.12) + Math.floor(v / 0.12)) % 2; c = g ? col : scale3(mix3(col, [1, 1, 1], 0.25), 1); }
      return scale3(c, 0.88 + 0.16 * fbm(u * 20, v * 20, 2));
    },
  });
  // 折り返し（枕側。裏の白が見える）
  surface(S, {
    u: [-0.02, W + 0.02], v: [0, 1], spacing: 0.011, look: LOOK.fabric, rand: R, xf,
    pos: (u, v) => { const a = v * Math.PI; const z = zStart - Math.sin(a) * 0.035 + v * fold * 0.0; return [o.x0 + u, o.top + thick + 0.012 + (1 - Math.cos(a)) * 0.022, z - v * fold * 0.12]; },
    color: (_u, v) => (v > 0.5 ? sheet : col),
  });
  surface(S, {
    u: [0, W], v: [0, 1], spacing: 0.011, look: LOOK.fabric, rand: R, xf,
    pos: (u, v) => [o.x0 + u, o.top + thick + 0.045 + (fbm(u * 6, v * 3, 9) - 0.5) * 0.01, zStart - 0.035 - v * fold],
    color: (u) => scale3(sheet, 0.92 + 0.08 * Math.sin(u * 30)),
  });
  // 見えているシーツ（枕の周り）
  surface(S, { u: [0, W], v: [o.z0, zStart - 0.03 - fold], spacing: 0.012, look: LOOK.fabric, rand: R, xf, flip: true, pos: (u, v) => [o.x0 + u, o.top + 0.004 + (fbm(u * 8, v * 8, 1) - 0.5) * 0.006, v], color: () => sheet });
}

/** 枕（角の丸いふくらんだ形・縫い目・しわ）。中心 c、向きは x が幅 */
export function pillow(S: Surfels, R: Rand, xf: Xf, c: V3, w = 0.62, d = 0.42, color = 0xf3f0ea): void {
  const col = lin(color);
  superellipsoid(S, c, [w / 2, 0.065, d / 2], 0.55, 0.25, {
    spacing: 0.007, look: LOOK.fabric, rand: R, xf,
    warp: (p, dd) => {
      const sag = 1 - Math.pow(Math.max(Math.abs(dd[0]), Math.abs(dd[2])), 4) * 0.85;
      const wr = (fbm(p[0] * 30, p[2] * 30, 3) - 0.5) * 0.012;
      return [p[0], c[1] + (p[1] - c[1]) * sag + wr * Math.abs(dd[1]), p[2]];
    },
    color: (u, v) => (Math.abs(Math.sin(v)) < 0.08 ? scale3(col, 0.82) : scale3(col, 0.92 + 0.1 * Math.sin(u * 12))),
  });
}

/** 四角いクッション（縁のパイピング・中央のくぼみ）。中心 c、傾き tilt（x 軸まわり）。向きは z が厚み */
export function cushion(S: Surfels, R: Rand, xf: Xf, c: V3, size = 0.42, color = 0xb84a3a, tilt = -0.25, pattern = false): void {
  const col = lin(color);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const X: Xf = (p) => { const y = p[1] - c[1], z = p[2] - c[2]; return xf([p[0], c[1] + y * ct - z * st, c[2] + y * st + z * ct]); };
  superellipsoid(S, c, [size / 2, size / 2, 0.075], 0.3, 0.3, {
    spacing: 0.0065, look: LOOK.fabric, rand: R, xf: X,
    warp: (p, dd) => {
      const r = Math.hypot(dd[0], dd[1]);
      const dimple = Math.exp(-r * r * 30) * 0.03 * Math.sign(dd[2]);
      const sag = 1 - Math.pow(Math.max(Math.abs(dd[0]), Math.abs(dd[1])), 5) * 0.7;
      return [p[0], p[1], c[2] + (p[2] - c[2]) * sag - dimple];
    },
    color: (u, v) => {
      if (Math.abs(Math.sin(v)) < 0.07) return scale3(col, 0.7);
      if (pattern) { const k = Math.sin(u * 8) * Math.sin(v * 8); return k > 0.2 ? scale3(mix3(col, [0.9, 0.85, 0.7], 0.6), 1) : col; }
      return scale3(col, 0.9 + 0.12 * fbm(u * 6, v * 6, 7));
    },
  });
}

/** ひざ掛け（ソファの肘掛けに掛けた毛布。ニットの縞と房） */
export function throwBlanket(S: Surfels, R: Rand, xf: Xf, o: { x: number; z0: number; z1: number; top: number; inner: number; outer: number; color: number; innerDrop?: number }): void {
  const col = lin(o.color);
  const W = o.z1 - o.z0;
  const drop = o.innerDrop ?? 0.32;
  // v: 内側に垂れた端 → 肘掛けの上 → 外側に垂れた端
  surface(S, {
    u: [0, W], v: [0, 1], spacing: 0.008, look: LOOK.fabric, rand: R, xf, twoSided: true,
    pos: (u, v) => {
      const n = (fbm(u * 6, v * 6, 2) - 0.5) * 0.02;
      if (v < 0.4) { const k = v / 0.4; return [o.x + o.inner * (1 - k) * 0.05 - 0.06 + n, o.top - (1 - k) * drop, o.z0 + u]; }
      if (v < 0.6) { const k = (v - 0.4) / 0.2; return [o.x - 0.06 + k * (o.outer + 0.12), o.top + 0.012 + Math.sin(k * Math.PI) * 0.012 + n * 0.3, o.z0 + u]; }
      const k = (v - 0.6) / 0.4; return [o.x + o.outer + 0.06 + n, o.top - k * 0.4, o.z0 + u + Math.sin(k * 6 + u * 10) * 0.01];
    },
    color: (u, v) => scale3(col, (Math.sin(u * 90) > 0.6 ? 0.82 : 1) * (Math.floor(v * 10) % 3 === 0 ? 0.88 : 1)),
  });
}

/** カーテン（レールから下がるひだのある布）。x0..x1 の幅、y0（下端）..y1（上端）、z は壁からの位置 */
export function curtain(S: Surfels, R: Rand, xf: Xf, o: { x0: number; x1: number; y0: number; y1: number; z: number; color: number; gather?: number }): void {
  const col = lin(o.color);
  const W = o.x1 - o.x0;
  const folds = Math.round(W / 0.14);
  surface(S, {
    u: [0, W], v: [o.y0, o.y1], spacing: 0.01, look: { ...LOOK.fabric, opacity: 1.3 }, rand: R, xf, twoSided: true,
    pos: (u, v) => {
      const k = (o.y1 - v) / (o.y1 - o.y0);
      const amp = 0.045 * (1 - k * 0.3);
      const z = Math.sin((u / W) * folds * Math.PI * 2 + k * 0.6) * amp + (fbm(u * 3, v * 2, 5) - 0.5) * 0.02 * k;
      return [o.x0 + u, v, o.z + z];
    },
    color: (u, v) => scale3(col, (0.86 + 0.14 * Math.cos((u / W) * folds * Math.PI * 2)) * (v - o.y0 < 0.04 ? 0.85 : 1)),
    backColor: () => scale3(col, 0.7),
  });
  // レールとリング
  tube(S, (t) => [o.x0 - 0.05 + t * (W + 0.1), o.y1 + 0.03, o.z], () => 0.012, { spacing: 0.004, look: LOOK.metal, rand: R, xf, color: () => lin(0xb8b4ac) });
}

/** たたんだタオルの山（パイル地のざらつき・色違い） */
export function towelStack(S: Surfels, R: Rand, xf: Xf, c: V3, n = 4): void {
  const colors = [0xf2efe8, 0x9fc4d8, 0xe8d0a8, 0xb8d8b0, 0xf2efe8, 0xd8a8b0];
  let y = c[1];
  for (let k = 0; k < n; k++) {
    const col = lin(R.pick(colors));
    const h = 0.045 + R.range(-0.005, 0.008);
    superellipsoid(S, [c[0] + R.range(-0.01, 0.01), y + h / 2, c[2] + R.range(-0.008, 0.008)], [0.17, h / 2, 0.13], 0.35, 0.18, {
      spacing: 0.006, look: { ...LOOK.fabric, opacity: 1.4 }, rand: R, xf,
      warp: (p, d) => { const pile = (fbm(p[0] * 220, p[1] * 220, p[2] * 220) - 0.5) * 0.002; return [p[0] + d[0] * pile, p[1] + d[1] * pile, p[2] + d[2] * pile]; },
      color: (u, v) => scale3(col, (0.88 + 0.16 * fbm(u * 40, v * 40, k)) * (Math.abs(Math.sin(v)) > 0.85 ? 1 : Math.abs(Math.sin(u * 2)) > 0.97 ? 0.85 : 1)),
    });
    y += h - 0.004;
  }
}

/** 床に敷いた布団（綴じの点・角の丸い厚い敷布団 + 掛け布団を半分たたんで重ねる） */
export function futon(S: Surfels, R: Rand, xf: Xf, c: V3, color = 0x3a5a8a): void {
  const col = lin(color), white = lin(0xf2efe8);
  superellipsoid(S, [c[0], c[1] + 0.045, c[2]], [0.48, 0.045, 0.95], 0.25, 0.12, {
    spacing: 0.01, look: LOOK.fabric, rand: R, xf,
    warp: (p, d) => { const tuft = Math.max(0, d[1]) * Math.min(1, Math.pow(Math.abs(Math.sin(d[0] * 9)) * Math.abs(Math.sin(d[2] * 14)), 0.3)) * 0.012; return [p[0], p[1] - tuft, p[2]]; },
    color: () => white,
  });
  superellipsoid(S, [c[0], c[1] + 0.12, c[2] + 0.4], [0.5, 0.035, 0.5], 0.4, 0.15, {
    spacing: 0.01, look: LOOK.fabric, rand: R, xf,
    warp: (p) => [p[0], p[1] + (fbm(p[0] * 4, p[2] * 4, 3) - 0.5) * 0.04, p[2]],
    color: (u, v) => (Math.sin(u * 14) * Math.sin(v * 9) > 0.3 ? scale3(col, 1.25) : col),
  });
  pillow(S, R, xf, [c[0], c[1] + 0.12, c[2] - 0.72], 0.5, 0.32, 0xd8c8a0);
}

export const fabricLook = (opacity: number): Look => ({ ...LOOK.fabric, opacity });
