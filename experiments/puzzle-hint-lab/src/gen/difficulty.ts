/**
 * 部屋の難易度: 0 / 1 / 2 / 3 をちょうど 50 / 25 / 20 / 5 % の数だけ作って混ぜる（スタートの部屋だけ難易度 0 に固定）。
 * 易しい順に足すと 50 → 75 → 95 → 100 % で、ヒントの境目（制圧 50 / 75 / 95 部屋）と一致する
 */
import type { Rng } from './rng.ts';
import type { Difficulty } from './types.ts';

export const DIFFICULTY_SHARE: readonly number[] = [0.5, 0.25, 0.2, 0.05];

/** n 部屋のうち難易度ごとの数（割合の端数は大きい順に配る） */
export function difficultyCounts(n: number): number[] {
  const raw = DIFFICULTY_SHARE.map((s) => n * s);
  const counts = raw.map(Math.floor);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0, rest = n - counts.reduce((a, b) => a + b, 0); rest > 0; k++, rest--) counts[order[k % order.length][1]]++;
  return counts;
}

export function assignDifficulty(n: number, rng: Rng, start = 0): Difficulty[] {
  const pool: Difficulty[] = [];
  difficultyCounts(n).forEach((k, d) => {
    for (let i = 0; i < k; i++) pool.push(d as Difficulty);
  });
  // スタートの部屋（操作を覚える所）は難易度 0。残りを混ぜて配る
  pool.splice(pool.indexOf(0), 1);
  rng.shuffle(pool);
  const out: Difficulty[] = [];
  for (let i = 0, k = 0; i < n; i++) out.push(i === start ? 0 : pool[k++]);
  return out;
}
