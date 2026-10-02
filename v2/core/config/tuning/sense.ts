/**
 * 段階 4・光・音・視線・時間（2.6〜2.9）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'sense.<仕掛け・異変>.<数値>'（例: 'sense.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const SENSE_TUNING = {
} as const satisfies Record<string, Spec>;
