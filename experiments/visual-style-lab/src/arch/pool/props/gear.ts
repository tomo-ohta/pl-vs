import type { Prop, V2 } from '../../../props/kit.ts';
import { fillShelf, steelShelf, towelStack, type ShelfLoad } from '../../../props/lib/index.ts';
import { PC } from './mats.ts';
import { arc, cw, R1, roundRect } from './shape.ts';
import { rescueTube } from './poolside.ts';

/**
 * プールの用具（棚・台車・倉庫に置く物）: ビート板・プルブイ・レスキューチューブ・薬品のポリ缶・ペール缶・ドラム・救急箱、
 * それらを載せる棚（共通のスチール棚に、プールの用具の載せ方を足す）。正面 +z、床 y = 0（物の下の面の中心が原点）。
 * 寸法の根拠: ビート板 28 × 44 × 3 cm（前が丸く、握りの穴 2 つ）。プルブイ 2 本の筒（φ10 × 21 cm）を帯でつなぐ。
 * 薬品のポリ缶 20 L（30 × 19 × 40 cm・上に取っ手と口）。ペール缶 20 L（φ30 × 36 cm）。ポリドラム 60 L（φ40 × 60 cm）
 */

/** ビート板（上から見て前が丸い板・後ろの角は小さく丸い・前寄りに握りの穴 2 つ）。holes = 穴を作る（重ねた下の板は省く） */
export function kickboard(p: Prop, col: string, o: { holes?: boolean; t?: number } = {}): void {
  const t = o.t ?? 0.028;
  const out: V2[] = [...arc([0.09, -0.17], 0.05, -Math.PI / 2, 0, 3), ...arc([0, 0.08], 0.14, 0, Math.PI, 8), ...arc([-0.09, -0.17], 0.05, Math.PI, Math.PI * 1.5, 3)];
  const holes = o.holes ? [-0.075, 0.075].map((x) => cw(roundRect([x, 0.09], 0.034, 0.085, 0.016, 2))) : [];
  p.extrude(col, out, 'xz', 0, t, { bevel: o.holes ? 0.007 : 0, holes, shadow: o.holes ? true : 'receive' });
}

/** ビート板の山（色ごとに数枚ずつ。少しずつずれる） */
export function kickboardPile(p: Prop, n: number, colors: string[]): void {
  const t = 0.028;
  for (let k = 0; k < n; k++) {
    const c = colors[Math.floor(k / 3 + p.r() * 0.6) % colors.length];
    kickboard(p.sub([(p.r() - 0.5) * 0.025, k * (t + 0.002), (p.r() - 0.5) * 0.025], (p.r() - 0.5) * 0.08), c, { holes: k === n - 1, t });
  }
}

/** プルブイ（2 本の発泡の筒を真ん中の帯でつなぐ。局所 x の向きに寝かせる） */
export function pullBuoy(p: Prop, a: string, b: string): void {
  const prof: V2[] = [[0, 0], [0.04, 0], [0.05, 0.014], [0.05, 0.196], [0.04, 0.21], [0, 0.21]];
  p.lathe(a, prof, [-0.105, 0.05, -0.05], { axis: 'x', seg: 10 });
  p.lathe(b, prof, [-0.105, 0.05, 0.05], { axis: 'x', seg: 10 });
  p.box(PC.white, [-0.07, 0.03, -0.012], [0.07, 0.07, 0.012], R1(0.008));
}

/** 薬品のポリ缶（20 L: 角の丸い胴・上の取っ手・口とふた・ラベル） */
export function jerrycan(p: Prop, col: string, cap: string = PC.blue): void {
  p.box(col, [-0.15, 0, -0.095], [0.15, 0.38, 0.095], { r: 0.03, seg: 2 });
  p.box(col, [-0.1, 0.38, -0.02], [0.06, 0.43, 0.02], R1(0.015));
  p.box(PC.ink, [-0.075, 0.375, -0.022], [0.035, 0.405, 0.022], { shadow: false });
  p.cyl(col, [0.105, 0.39, 0], 0.025, 0.03, { seg: 10 });
  p.cyl(cap, [0.105, 0.415, 0], 0.03, 0.026, { seg: 10 });
  p.box(PC.white, [-0.1, 0.12, 0.095], [0.1, 0.26, 0.098], { shadow: false });
  p.box(PC.red, [-0.1, 0.23, 0.098], [0.1, 0.26, 0.1], { shadow: false });
}

/** ペール缶（20 L: 少しすぼむ胴・補強の帯・ふたの縁・つる） */
export function pail(p: Prop, col: string, lid: string = PC.white): void {
  p.lathe(col, [[0, 0], [0.135, 0], [0.14, 0.01], [0.15, 0.32], [0.155, 0.33], [0, 0.33]], [0, 0, 0], { seg: 18 });
  for (const y of [0.24, 0.29]) p.torus(col, [0, y, 0], 0.149, 0.006, { axis: 'y', seg: 18 });
  p.lathe(lid, [[0.16, 0.315], [0.165, 0.345], [0.15, 0.36], [0, 0.365]], [0, 0, 0], { seg: 18 });
  p.sub([0, 0.33, 0], 0, { roll: 0 }).torus(PC.steel, [0, 0, 0], 0.15, 0.004, { axis: 'x', seg: 12, arc: Math.PI });
  p.box(PC.white, [-0.07, 0.1, 0.143], [0.07, 0.2, 0.15], { shadow: false });
}

/** ポリドラム（60 L: 胴の帯・上の 2 つの口） */
export function drum(p: Prop, col: string): void {
  p.lathe(col, [[0, 0], [0.18, 0], [0.2, 0.03], [0.2, 0.57], [0.18, 0.6], [0, 0.6]], [0, 0, 0], { seg: 20 });
  for (const y of [0.2, 0.4]) p.torus(col, [0, y, 0], 0.2, 0.012, { axis: 'y', seg: 20 });
  p.cyl(PC.white, [0.1, 0.61, 0], 0.035, 0.025, { seg: 10 });
  p.cyl(PC.white, [-0.11, 0.605, 0.03], 0.022, 0.015, { seg: 10 });
  p.box(PC.white, [-0.09, 0.26, 0.195], [0.09, 0.36, 0.202], { shadow: false });
}

/** 救急箱（白い箱・赤い十字・取っ手） */
export function firstAidBox(p: Prop, w = 0.34, h = 0.2, d = 0.22): void {
  p.box(PC.white, [-w / 2, 0, -d / 2], [w / 2, h, d / 2], R1(0.012));
  p.box(PC.steel, [-w / 2 - 0.002, h * 0.62, -d / 2 - 0.002], [w / 2 + 0.002, h * 0.62 + 0.006, d / 2 + 0.002], { shadow: false });
  p.box(PC.red, [-0.012, h * 0.2, d / 2], [0.012, h * 0.52, d / 2 + 0.003], { shadow: false });
  p.box(PC.red, [-0.045, h * 0.34, d / 2], [0.045, h * 0.38, d / 2 + 0.003], { shadow: false });
  p.box(PC.dark, [-0.05, h, -0.015], [0.05, h + 0.02, 0.015], R1(0.006));
}

export type PoolLoad = ShelfLoad | 'boards' | 'buoys' | 'tubes' | 'jugs' | 'pails' | 'aid' | 'towels';

/** プールの用具の棚（共通のスチール棚の枠に、段ごとの載せ方で物を置く） */
export function poolShelf(p: Prop, o: { w?: number; h?: number; d?: number; levels?: number; frame?: string; load: PoolLoad[] }): void {
  const W = o.w ?? 1.2;
  const H = o.h ?? 1.8;
  const D = o.d ?? 0.45;
  const n = o.levels ?? Math.max(3, Math.round(H / 0.42));
  steelShelf(p, { w: W, h: H, d: D, levels: n, frame: o.frame ?? PC.steel, load: 'mixed', empty: 1 });
  for (let i = 0; i < n - 1; i++) {
    const y = 0.08 + (i * (H - 0.12)) / (n - 1);
    const clear = (H - 0.12) / (n - 1) - 0.05;
    fillPool(p.sub([0, y, 0]), W - 0.06, D - 0.05, clear, o.load[i % o.load.length]);
  }
}

const BOARD_COLORS = [[PC.yellow, PC.blue], [PC.blue, PC.white], [PC.teal, PC.yellow], [PC.red, PC.white]];

/** 棚板 1 段にプールの用具を並べる（局所: 棚板の上面の中心が原点） */
export function fillPool(p: Prop, w: number, d: number, clearH: number, load: PoolLoad): void {
  if (load === 'boards') {
    // ビート板の山（幅 0.3 m ごと）
    const k = Math.max(1, Math.floor(w / 0.32));
    for (let i = 0; i < k; i++) {
      if (p.r() < 0.12) continue;
      const cols = BOARD_COLORS[Math.floor(p.r() * BOARD_COLORS.length)];
      const n = Math.max(2, Math.floor((clearH * (0.55 + p.r() * 0.35)) / 0.03));
      kickboardPile(p.sub([-w / 2 + (i + 0.5) * (w / k), 0, 0], (p.r() - 0.5) * 0.1), n, cols);
    }
    return;
  }
  if (load === 'buoys') {
    // プルブイの列（2 段に重なる所も）
    const k = Math.floor(w / 0.24);
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < 2; j++) {
        if (p.r() < 0.18) continue;
        const pair = BOARD_COLORS[Math.floor(p.r() * BOARD_COLORS.length)];
        const z = d / 2 - 0.08 - j * 0.2;
        pullBuoy(p.sub([-w / 2 + (i + 0.5) * (w / k), 0, z], Math.PI / 2 + (p.r() - 0.5) * 0.3), pair[0], pair[1]);
        if (clearH > 0.25 && p.r() < 0.4) pullBuoy(p.sub([-w / 2 + (i + 0.5) * (w / k) + (p.r() - 0.5) * 0.03, 0.1, z], Math.PI / 2 + (p.r() - 0.5) * 0.5), pair[1], pair[0]);
      }
    }
    return;
  }
  if (load === 'tubes') {
    // レスキューチューブを横に寝かせて重ねる（幅が足りなければ斜めに）
    const L = Math.min(0.95, w - 0.05);
    const n = Math.max(1, Math.min(4, Math.floor(clearH / 0.1)));
    for (let k = 0; k < n; k++) rescueTube(p.sub([(p.r() - 0.5) * 0.04, k * 0.092, (p.r() - 0.5) * 0.06 + (k % 2) * 0.03 - 0.02], (p.r() - 0.5) * 0.06), L);
    return;
  }
  if (load === 'jugs' || load === 'pails') {
    let x = -w / 2;
    while (x < w / 2 - 0.2) {
      if (p.r() < 0.15) {
        x += 0.15;
        continue;
      }
      if (load === 'jugs' && clearH > 0.45) {
        const col = [PC.white, PC.white, PC.blue, PC.yellow][Math.floor(p.r() * 4)];
        jerrycan(p.sub([x + 0.16, 0, d / 2 - 0.12], (p.r() - 0.5) * 0.12), col, col === PC.white ? PC.blue : PC.white);
        x += 0.33;
      } else if (clearH > 0.38) {
        pail(p.sub([x + 0.16, 0, 0], p.r() * 6), [PC.white, PC.blue, PC.white][Math.floor(p.r() * 3)]);
        x += 0.34;
      } else {
        const col = [PC.white, PC.blue][Math.floor(p.r() * 2)];
        const s = p.sub([x + 0.08, 0, d / 2 - 0.08]);
        s.lathe(col, [[0, 0], [0.055, 0], [0.06, 0.02], [0.06, 0.16], [0.03, 0.2], [0.025, 0.22], [0, 0.22]], [0, 0, 0], { seg: 12 });
        s.cyl(PC.red, [0, 0.235, 0], 0.025, 0.03, { seg: 10 });
        x += 0.14;
      }
    }
    return;
  }
  if (load === 'aid') {
    let x = -w / 2;
    while (x < w / 2 - 0.25) {
      if (p.r() < 0.6) {
        firstAidBox(p.sub([x + 0.17, 0, 0], (p.r() - 0.5) * 0.1), 0.32, Math.min(clearH * 0.7, 0.2), 0.22);
        x += 0.37;
      } else {
        fillShelf(p.sub([x + 0.15, 0, 0]), 0.3, d, clearH, 'bottles', [PC.white, PC.blue]);
        x += 0.32;
      }
    }
    return;
  }
  if (load === 'towels') {
    let x = -w / 2;
    while (x < w / 2 - 0.3) {
      towelStack(p.sub([x + 0.18, 0, 0], (p.r() - 0.5) * 0.06), 0.34, Math.min(d, 0.34), Math.min(clearH * 0.85, 0.14 + p.r() * 0.18), [PC.white, PC.white, PC.blue, PC.teal][Math.floor(p.r() * 4)]);
      x += 0.38;
    }
    return;
  }
  // 共通の載せ方（段ボール・収納箱・ファイル・紙・瓶・リネン・ビート板）は色だけプールの色で
  const colors: Partial<Record<ShelfLoad, string[]>> = {
    cardboard: [PC.kraft, PC.kraft, PC.wood],
    bins: [PC.white, PC.pale, PC.blue],
    binders: [PC.tealDark, PC.blue, PC.white, PC.teal, PC.dark],
    bottles: [PC.white, PC.blue, PC.yellow],
    linen: [PC.white],
    kickboards: [PC.yellow, PC.blue, PC.teal],
    paper: [PC.teal, PC.blue],
  };
  fillShelf(p, w, d, clearH, load, colors[load], 0.12);
}

/** 平らな台車（鉄の荷台・4 つのキャスター・押し手）にビート板の山を 2 つ */
export function boardCart(p: Prop): void {
  p.box(PC.steel, [-0.6, 0.11, -0.4], [0.6, 0.15, 0.4], R1(0.012));
  p.box(PC.rubber, [-0.6, 0.15, -0.4], [0.6, 0.155, 0.4], { shadow: 'receive' });
  for (const x of [-0.48, 0.48])
    for (const z of [-0.3, 0.3]) {
      p.box(PC.steel, [x - 0.03, 0.08, z - 0.03], [x + 0.03, 0.11, z + 0.03]);
      p.cyl(PC.ink, [x, 0.05, z], 0.05, 0.035, { axis: 'z', seg: 12 });
    }
  p.tube(PC.chrome, [[-0.58, 0.15, -0.34], [-0.6, 0.95, -0.34], [-0.6, 0.95, 0.34], [-0.58, 0.15, 0.34]], 0.014, { sharp: true });
  for (const z of [-0.18, 0.18]) {
    const cols = BOARD_COLORS[Math.floor(p.r() * BOARD_COLORS.length)];
    kickboardPile(p.sub([0.05 + (p.r() - 0.5) * 0.3, 0.155, z], Math.PI / 2 + (p.r() - 0.5) * 0.08), 6 + Math.floor(p.r() * 10), cols);
  }
  p.collide([-0.62, 0, -0.42], [0.62, 0.96, 0.42]);
}
