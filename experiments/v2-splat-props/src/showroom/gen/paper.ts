/**
 * 紙（スプラット）: 書類の束・散らばった紙・丸めた紙・ごみ箱の中身。
 */
import { can } from './goods.ts';
import { ellipsoid, fbm, LOOK, lin, quad, Rand, scale3, surface, type Surfels, type V3 } from '../surfel.ts';

type Xf = (p: V3) => V3;

/** 文字の行（0 = 地、1 = 字） */
function lines(u: number, v: number, seed: number): boolean {
  if (u < 0.1 || u > 0.9 || v < 0.08 || v > 0.92) return false;
  const r = Math.floor(v * 34);
  const f = v * 34 - r;
  if (f < 0.3 || f > 0.7) return false;
  const end = 0.6 + 0.3 * Math.abs(Math.sin(r * 3.7 + seed));
  return u < end && Math.sin(u * 90 + r) > -0.6;
}

/** A4 の紙 1 枚（反り・回転）。中心 c、向き yaw、反り curl（両端が上がる量） */
export function sheet(S: Surfels, R: Rand, xf: Xf, c: V3, yaw: number, curl = 0.006, seed = R.range(0, 100)): void {
  const w = 0.21, h = 0.297;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  surface(S, {
    u: [0, 1], v: [0, 1], spacing: 0.0045, look: LOOK.paper, rand: R, xf, twoSided: true, flip: true,
    pos: (u, v) => {
      const x = (u - 0.5) * w, z = (v - 0.5) * h;
      const y = c[1] + curl * (((u - 0.5) * 2) ** 2) + curl * 0.6 * (((v - 0.5) * 2) ** 4) + 0.0008;
      return [c[0] + x * cy + z * sy, y, c[2] - x * sy + z * cy];
    },
    color: (u, v) => (lines(u, v, seed) ? lin(0x3a3a40) : scale3(lin(0xf4f2ec), 0.96 + 0.04 * Math.sin(u * 13))),
    backColor: () => lin(0xeeece6),
  });
}

/** 書類の束（積んだ紙。端がそろっていない・上の数枚がずれる・側面に紙の層） */
export function paperStack(S: Surfels, R: Rand, xf: Xf, c: V3, n = 80, yaw = 0): void {
  const w = 0.21, h = 0.297, t = n * 0.0001 + 0.002;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const P = (x: number, y: number, z: number): V3 => [c[0] + x * cy + z * sy, c[1] + y, c[2] - x * sy + z * cy];
  // 側面（紙の層の縞）
  const side = (o: V3, a: V3, b: V3): void => quad(S, o, a, b, { spacing: 0.0025, look: LOOK.paper, rand: R, xf, color: (u, v) => scale3(lin(0xf0eee8), 0.82 + 0.18 * Math.abs(Math.sin(v * n * 1.7 + u * 3))) });
  const corners = [P(-w / 2, 0, h / 2), P(w / 2, 0, h / 2), P(w / 2, 0, -h / 2), P(-w / 2, 0, -h / 2)];
  for (let k = 0; k < 4; k++) {
    const a = corners[k]!, b = corners[(k + 1) % 4]!;
    side(a, [b[0] - a[0], 0, b[2] - a[2]], [0, t, 0]);
  }
  // 上の数枚（ずれて重なる）
  const top = R.int(3, 6);
  for (let k = 0; k < top; k++) {
    const off = P(R.range(-0.012, 0.012), t + k * 0.0006, R.range(-0.012, 0.012));
    sheet(S, R, xf, off, yaw + R.range(-0.08, 0.08), 0.001);
  }
}

/** 丸めた紙（しわくちゃの玉） */
export function crumpled(S: Surfels, R: Rand, xf: Xf, c: V3, r = 0.04): void {
  const seed = R.range(0, 50);
  ellipsoid(S, c, [r, r * 0.85, r], {
    spacing: 0.004, look: LOOK.paper, rand: R, xf,
    warp: (p, d) => { const k = 1 + (fbm(d[0] * 3 + seed, d[1] * 3, d[2] * 3, 4) - 0.5) * 0.7; return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k]; },
    color: (u, v) => { const crease = fbm(u * 4 + seed, v * 6, 1, 3); return scale3(lin(0xf2f0ea), 0.68 + 0.4 * crease); },
  });
}

/** 角形のごみ箱の中身（丸めた紙・空き缶）。口の高さ y、内側の大きさ s */
export function binTrash(S: Surfels, R: Rand, xf: Xf, c: V3, s: number, y: number): void {
  const n = R.int(4, 7);
  for (let k = 0; k < n; k++) crumpled(S, R, xf, [c[0] + R.range(-s / 3, s / 3), y - 0.05 + R.range(-0.03, 0.03) + k * 0.006, c[2] + R.range(-s / 3, s / 3)], R.range(0.03, 0.045));
  // 空き缶（傾けて）
  const ox = c[0] + s * 0.15, oz = c[2] - s * 0.1, oy = y - 0.04;
  can(S, R, (p) => { const yy = p[1], xx = p[0]; return xf([ox + xx * 0.8 + yy * 0.6, oy + yy * 0.6 - xx * 0.2, oz + p[2]]); }, 1);
}

/** 散らばった紙（床に数枚。反りと回転） */
export function scattered(S: Surfels, R: Rand, xf: Xf, c: V3, n = 5, spread = 0.5): void {
  for (let k = 0; k < n; k++) sheet(S, R, xf, [c[0] + R.range(-spread, spread), c[1] + k * 0.0012, c[2] + R.range(-spread, spread)], R.range(0, Math.PI * 2), R.range(0.006, 0.02));
}

/**
 * 掲示板に画鋲で留めた紙（縦の面。局所: 板の面が z = 0、正面 +z）。中心 (cx, cy)、幅 w × 高さ h。
 * 下の角が少し浮いて反る・文字の行・上の画鋲。
 */
export function pinnedSheet(S: Surfels, R: Rand, xf: Xf, cx: number, cy: number, w = 0.21, h = 0.297, seed = R.range(0, 100)): void {
  const tilt = R.range(-0.04, 0.04);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const lift = R.range(0.004, 0.014);
  surface(S, {
    u: [0, 1], v: [0, 1], spacing: 0.005, look: LOOK.paper, rand: R, xf, twoSided: true,
    pos: (u, v) => {
      const x = (u - 0.5) * w, y = (v - 0.5) * h;
      // 下の角ほど浮く（上は画鋲で留まっている）
      const z = 0.002 + lift * Math.pow(1 - v, 2) * (0.4 + Math.abs(u - 0.5) * 1.6);
      return [cx + x * ct - y * st, cy + x * st + y * ct, z];
    },
    color: (u, v) => (lines(u, 1 - v, seed) ? lin(0x3a3a40) : scale3(lin(0xf4f2ec), 0.94 + 0.06 * Math.sin(u * 13))),
    backColor: () => lin(0xe8e6e0),
  });
  // 画鋲（上の中央）
  const px = cx - (h / 2 - 0.015) * st, py = cy + (h / 2 - 0.015) * ct;
  const pin = lin(R.pick([0xc0202a, 0x2050c0, 0xe0c020, 0x30a050]));
  ellipsoid(S, [px, py, 0.006], [0.006, 0.006, 0.004], { spacing: 0.0015, look: LOOK.glossy, rand: R, xf, color: () => pin });
}
