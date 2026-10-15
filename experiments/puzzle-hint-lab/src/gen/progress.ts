/**
 * 進行の計算（DOM を使わない）: 踏破率・制圧率・ヒントの段階・デバッグで制圧する部屋の選び方
 */
import type { Rng } from './rng.ts';
import type { Difficulty } from './types.ts';

/** ヒント 1 / 2 / 3 を解放する制圧の部屋の数（全部屋に同時） */
export const HINT_THRESHOLDS: readonly number[] = [50, 75, 95];

/** 制圧した部屋の数から、解放したヒントの段階（0 = まだ無し … 3 = ヒント 3 まで） */
export function hintStage(solved: number, th: readonly number[] = HINT_THRESHOLDS): number {
  let s = 0;
  for (const t of th) if (solved >= t) s++;
  return s;
}

/** 次の境目（ヒントの境目を全部越えたら全部屋、全部制圧したら null） */
export function nextTarget(solved: number, total: number, th: readonly number[] = HINT_THRESHOLDS): number | null {
  for (const t of th) if (solved < t) return Math.min(t, total);
  return solved < total ? total : null;
}

/** 0〜100 の率（%）。表示は切り捨て（100 % は全部そろったときだけ） */
export const percent = (count: number, total: number): number => (total > 0 ? Math.floor((count / total) * 100) : 0);

/**
 * デバッグ「次のヒント段階へ」で制圧にする部屋: 未制圧の部屋を難易度の低い順（同じ難易度の中はランダム）に count 個。
 * 今いる部屋（exclude）は、ほかに足りないときだけ最後に使う（今いる部屋のヒントの見え方を確かめられるように）
 */
export function pickDebugSolves(
  difficulty: readonly Difficulty[],
  solved: readonly boolean[],
  count: number,
  exclude: number,
  rng: Rng,
): number[] {
  const cand = rng.shuffle([...difficulty.keys()].filter((i) => !solved[i] && i !== exclude));
  cand.sort((a, b) => difficulty[a] - difficulty[b]);
  if (exclude >= 0 && !solved[exclude]) cand.push(exclude);
  return cand.slice(0, Math.max(0, count));
}
