/**
 * 決定論的乱数（v1 core/rng.ts から移植）。世界の生成と仕掛けの乱数はすべてこれを使う（Math.random は禁止）。
 * 用途ごとに fork(tag) で別の乱数列を作り、段の順番や個数が変わっても他の段の結果が変わらないようにする。
 */

/** FNV-1a 32bit */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashCombine(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 複数の値をまとめたハッシュ（文字列は FNV、数値はそのまま混ぜる） */
export function hashAll(...parts: (string | number)[]): number {
  let h = 0x2545f491;
  for (const p of parts) h = hashCombine(h, typeof p === 'number' ? p >>> 0 : hashString(p));
  return h;
}

/** mulberry32 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x1234567;
  }
  /** [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** min 以上 max 以下の整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: 空の配列');
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    if (items.length === 0) throw new Error('Rng.weighted: 空の配列');
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return items[Math.floor(this.next() * items.length)] as T;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1] as T;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
    }
    return arr;
  }
  /** 平均 mean のポアソン分布（小さい mean 向けの Knuth 法） */
  poisson(mean: number): number {
    if (mean <= 0) return 0;
    const l = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do { k++; p *= this.next(); } while (p > l && k < 1000);
    return k - 1;
  }
  fork(tag: string | number): Rng {
    const t = typeof tag === 'number' ? tag >>> 0 : hashString(tag);
    return new Rng(hashCombine(this.s, t));
  }
  /** 状態の保存・復元（シミュレーションのスナップショット用） */
  get state(): number { return this.s; }
  set state(v: number) { this.s = v >>> 0; }
}
