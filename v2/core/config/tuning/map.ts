/**
 * 段階 4・地図と道案内・図鑑・調査率（2.14）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'map.<仕掛け・異変>.<数値>'（例: 'map.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const MAP_TUNING = {
} as const satisfies Record<string, Spec>;
