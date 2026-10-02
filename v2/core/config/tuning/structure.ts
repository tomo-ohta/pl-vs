/**
 * 段階 4・フロアの形・部屋の形（2.1・2.2 の構造）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'structure.<仕掛け・異変>.<数値>'（例: 'structure.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const STRUCTURE_TUNING = {
} as const satisfies Record<string, Spec>;
