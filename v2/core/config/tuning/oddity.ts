/**
 * 段階 4・部屋まるごとの異変の拡充（2.2・2.5 の見た目・2.12・2.13）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'anomaly.<仕掛け・異変>.<数値>'（例: 'anomaly.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const ODDITY_TUNING = {
} as const satisfies Record<string, Spec>;
