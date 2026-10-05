/**
 * 本棚の中身（スプラット）: 1 冊ずつの本・雑誌・リングファイル。
 * 局所の座標: 棚板の上面が y = 0、棚の向きが x（x0..x1）、正面（背表紙の側）が +z（zFront）。xf で部屋へ置く。
 * 見える面だけ作る（背表紙・天・列の端や傾いた本の表紙）。
 */
import { LOOK, lin, mix3, quad, Rand, scale3, surface, type Look, type Surfels, type V3 } from '../surfel.ts';

type Xf = (p: V3) => V3;

const CLOTH = [0x6b1f24, 0x1f3a5c, 0x2d4a2f, 0x5a3b22, 0x2a2a2e, 0x7a5a2a, 0x4b2a4f, 0x8a7a5a, 0x3c5560, 0x9a3a2a];
const PAPER = [0xd84a3a, 0xf0c040, 0x2f7fc4, 0xf2f0ea, 0x3fa060, 0xe8783a, 0x1c1c22, 0x9a5ab0, 0xe0e0d8, 0x58b0c8];

/** 文字の行のような模様（0 = 地、1 = 字） */
function textMask(s: number, t: number, rows: number, seed: number): number {
  const r = Math.floor(t * rows);
  const ft = t * rows - r;
  if (ft < 0.25 || ft > 0.75) return 0;
  const blocks = Math.floor(s * 9);
  const h = Math.sin((r * 12.9898 + blocks * 78.233 + seed) * 43758.5453) % 1;
  return Math.abs(h) > 0.32 ? 1 : 0;
}

interface BookSpec {
  t: number; h: number; d: number;
  kind: 'hard' | 'paper' | 'magazine' | 'binder';
  color: V3;
  accent: V3;
  seed: number;
}

/** 本 1 冊。place は本の局所（x: 0..t、y: 0..h、z: −d..0 が奥→背表紙）→ 棚の局所 */
function book(S: Surfels, R: Rand, xf: Xf, b: BookSpec, place: (p: V3) => V3, covers: { left: boolean; right: boolean; top: boolean }): void {
  const X = (p: V3): V3 => xf(place(p));
  const look: Look = b.kind === 'hard' ? { ...LOOK.matte, rough: 0.75 } : b.kind === 'binder' ? LOOK.plastic : { ...LOOK.plastic, rough: 0.3 };
  const sp = 0.004;
  // 背表紙
  surface(S, {
    u: [0, 1], v: [0, 1], spacing: sp, look, rand: R, xf: X, jitter: 0.2,
    pos: (u, v) => {
      const bulge = b.kind === 'hard' ? Math.sin(Math.PI * u) * Math.min(0.004, b.t * 0.12) : 0;
      return [u * b.t, v * b.h, bulge];
    },
    color: (u, v) => {
      let c = b.color;
      if (b.kind === 'hard') {
        const band = (v > 0.05 && v < 0.075) || (v > 0.925 && v < 0.95) || (v > 0.11 && v < 0.12) || (v > 0.88 && v < 0.89);
        if (band) return b.accent;
        if (v > 0.6 && v < 0.8 && u > 0.18 && u < 0.82) {
          return textMask(u, (v - 0.6) / 0.2, 3, b.seed) ? b.accent : scale3(c, 0.85);
        }
      } else if (b.kind === 'binder') {
        if (v > 0.55 && v < 0.88 && u > 0.18 && u < 0.82) return textMask(u, (v - 0.55) / 0.33, 4, b.seed) ? lin(0x303030) : lin(0xf2f0e8);
        const hx = (u - 0.5) * b.t, hy = (v - 0.25) * b.h;
        if (hx * hx / 0.0004 + hy * hy / 0.0009 < 1) return lin(0x111111);
      } else {
        if (v > 0.08 && v < 0.85) {
          const m = textMask(u, (v - 0.08) / 0.77, b.kind === 'magazine' ? 6 : 4, b.seed);
          if (m) c = mix3(c, b.accent, 0.85);
        }
        if (v < 0.08) c = scale3(b.accent, 0.9);
      }
      return c;
    },
  });
  // 天（紙の小口: 細い縞。表紙の板が両端に見える）
  if (covers.top) {
    const board = b.kind === 'hard' ? 0.0025 : b.kind === 'binder' ? 0.003 : 0.0008;
    quad(S, [0, b.h, 0], [b.t, 0, 0], [0, 0, -b.d], {
      spacing: 0.0055, look: LOOK.paper, rand: R, xf: X, jitter: 0.15,
      color: (u, v) => {
        const x = u * b.t;
        if (x < board || x > b.t - board || (b.kind === 'hard' && v < 0.02)) return scale3(b.color, 0.9);
        if (b.kind === 'binder') return v > 0.85 ? scale3(b.color, 0.8) : scale3(lin(0xeeece2), 0.85 + 0.15 * Math.sin(u * 140));
        return scale3(lin(0xe9e1c8), 0.82 + 0.14 * Math.sin(x * 2400) * Math.sin(x * 900));
      },
    });
  }
  // 表紙（列の端・傾いた本・すき間の横）
  for (const [side, on] of [[0, covers.left], [1, covers.right]] as const) {
    if (!on) continue;
    const x = side * b.t;
    quad(S, side ? [x, 0, 0] : [x, 0, -b.d], [0, 0, side ? -b.d : b.d], [0, b.h, 0], {
      spacing: 0.005, look, rand: R, xf: X,
      color: (u, v) => {
        if (b.kind === 'paper' || b.kind === 'magazine') {
          const blob = Math.sin(u * 7 + b.seed) * Math.cos(v * 5 + b.seed) > 0.4;
          return blob ? mix3(b.color, b.accent, 0.7) : b.color;
        }
        return scale3(b.color, 0.92 + 0.06 * Math.sin(v * 50));
      },
    });
  }
}

function pickBook(R: Rand, maxH: number, maxD: number): BookSpec {
  const r = R.next();
  const seed = R.range(0, 1000);
  if (r < 0.45) {
    return { kind: 'hard', t: R.range(0.022, 0.05), h: Math.min(maxH, R.range(0.2, 0.3)), d: Math.min(maxD, R.range(0.15, 0.21)), color: scale3(lin(R.pick(CLOTH)), R.range(0.75, 1.1)), accent: R.chance(0.6) ? lin(0xc8a24a) : lin(0xe8e0c8), seed };
  }
  if (r < 0.85) {
    return { kind: 'paper', t: R.range(0.012, 0.032), h: Math.min(maxH, R.range(0.15, 0.21)), d: Math.min(maxD, R.range(0.105, 0.15)), color: lin(R.pick(PAPER)), accent: lin(R.pick([0x111111, 0xf8f6f0, 0xe0c040])), seed };
  }
  return { kind: 'magazine', t: R.range(0.006, 0.012), h: Math.min(maxH, R.range(0.27, 0.3)), d: Math.min(maxD, R.range(0.2, 0.22)), color: lin(R.pick(PAPER)), accent: lin(R.pick(PAPER)), seed };
}

export interface RowOpts { x0: number; x1: number; zFront: number; zBack: number; maxH: number; binders?: boolean }

/** 棚の段 1 つ分の本を並べる（シリーズ・すき間・傾き・平積み） */
export function bookRow(S: Surfels, R: Rand, xf: Xf, o: RowOpts): void {
  const maxD = o.zFront - o.zBack - 0.01;
  let x = o.x0 + R.range(0, 0.02);
  let series: BookSpec | null = null;
  let seriesLeft = 0;
  let prevGap = true;
  while (x < o.x1 - 0.015) {
    // ところどころ平積み
    if (!o.binders && R.chance(0.06) && o.x1 - x > 0.25) {
      const n = R.int(2, 4);
      let y = 0;
      const w = R.range(0.17, 0.22);
      for (let k = 0; k < n; k++) {
        const b = pickBook(R, 0.3, maxD);
        const th = Math.min(b.t, 0.04);
        const dx = R.range(-0.008, 0.008);
        const z0 = o.zFront - R.range(0.004, 0.02);
        // 寝かせた本（z 軸まわりに −90° 回す。軸を入れ替えるだけだと鏡写しになって面の向きが裏返る）:
        // 本の高さ → 棚の x、厚み → 棚の y（本の左の表紙が上を向く）。背表紙は正面のまま
        const sx = x + dx, sy = y;
        book(S, R, xf, { ...b, t: th, h: w }, (p) => [sx + p[1], sy + th - p[0], z0 + p[2]], { left: k === n - 1, right: false, top: true });
        y += th;
      }
      x += w + R.range(0.02, 0.05);
      prevGap = true;
      continue;
    }
    let b: BookSpec;
    if (o.binders) {
      b = { kind: 'binder', t: R.pick([0.05, 0.065, 0.08]), h: Math.min(o.maxH, 0.315), d: Math.min(maxD, 0.29), color: lin(R.pick([0x1f4f9a, 0x2a2a2e, 0x9a2a2a, 0xe8e6e0, 0x3f8f4a])), accent: lin(0xffffff), seed: R.range(0, 1000) };
    } else if (series && seriesLeft > 0) {
      b = { ...series, seed: R.range(0, 1000) };
      seriesLeft--;
    } else {
      b = pickBook(R, o.maxH - 0.01, maxD);
      if (R.chance(0.25)) { series = b; seriesLeft = R.int(2, 5); } else series = null;
    }
    if (x + b.t > o.x1) break;
    const z0 = o.zFront - (o.binders ? 0.005 : R.range(0.004, 0.03));
    // すき間の後の本はときどき傾く（左の本にもたれる）
    const gap = !o.binders && R.chance(0.07);
    const lean = prevGap && !o.binders && R.chance(0.35) ? R.range(0.08, 0.28) : 0;
    const bx = x;
    const place = lean
      ? (p: V3): V3 => { const c = Math.cos(lean), s = Math.sin(lean); return [bx + p[0] * c - p[1] * s + Math.sin(lean) * b.h, p[0] * s + p[1] * c, z0 + p[2]]; }
      : (p: V3): V3 => [bx + p[0], p[1], z0 + p[2]];
    book(S, R, xf, b, place, { left: prevGap || lean > 0, right: gap, top: true });
    x += b.t + (lean ? Math.sin(lean) * b.h : 0) + R.range(0, 0.002);
    prevGap = false;
    if (gap) { x += R.range(0.04, 0.12); prevGap = true; series = null; }
  }
}

/** 机の上の開いた本（ページが反った見開き） */
export function openBook(S: Surfels, R: Rand, xf: Xf): void {
  const W = 0.16, H = 0.23;
  for (const side of [-1, 1]) {
    surface(S, {
      u: [0, 1], v: [0, 1], spacing: 0.0035, look: LOOK.paper, rand: R, xf,
      pos: (u, v) => [side * u * W, 0.012 + Math.sin(u * Math.PI * 0.9) * 0.018 * (1 - u * 0.3), (v - 0.5) * H],
      color: (u, v) => (u > 0.1 && u < 0.92 && v > 0.08 && v < 0.92 && textMask(u, v, 26, side * 7) ? lin(0x3a3632) : lin(0xefe8d6)),
    });
  }
  // 表紙（下に少し見える）
  quad(S, [-W - 0.005, 0.004, -H / 2 - 0.004], [0, 0, H + 0.008], [2 * W + 0.01, 0, 0], { spacing: 0.005, look: LOOK.matte, rand: R, xf, color: () => lin(0x6b1f24) });
}
