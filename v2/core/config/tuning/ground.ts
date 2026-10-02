/**
 * 段階 4・床と足場・装置（2.4・2.11）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'ground.<仕掛け・異変>.<数値>'（例: 'ground.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const GROUND_TUNING = {
} as const satisfies Record<string, Spec>;
