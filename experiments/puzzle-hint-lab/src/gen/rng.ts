/**
 * seed 付きの乱数（mulberry32）。同じ seed なら同じ並びになる。
 * 地図・難易度・謎・ヒントは用途ごとに subSeed で別の並びを使う（どれかの作りを変えても、ほかの結果がずれない）
 */
export interface Rng {
  /** 0 以上 1 未満 */
  next(): number;
  /** lo 以上 hi 以下の整数 */
  int(lo: number, hi: number): number;
  /** lo 以上 hi 未満の実数 */
  range(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  /** その場で混ぜて、同じ配列を返す */
  shuffle<T>(xs: T[]): T[];
  chance(p: number): boolean;
  /** 重み付きで 1 つ */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    shuffle: (xs) => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [xs[i], xs[j]] = [xs[j], xs[i]];
      }
      return xs;
    },
    chance: (p) => next() < p,
    weighted: (items) => {
      let total = 0;
      for (const [, w] of items) total += w;
      let r = next() * total;
      for (const [v, w] of items) {
        r -= w;
        if (r < 0) return v;
      }
      return items[items.length - 1][0];
    },
  };
}

/** seed と用途の名前から、別の並びの seed を作る */
export function subSeed(seed: number, name: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
