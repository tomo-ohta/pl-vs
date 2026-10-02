/**
 * 段階 4・移動と身体（gimmicks-and-structures.md 2.3）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'move.<仕掛け・異変>.<数値>'（例: 'move.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const MOVE_TUNING = {
} as const satisfies Record<string, Spec>;
