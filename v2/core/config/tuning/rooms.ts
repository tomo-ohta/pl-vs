/**
 * 段階 4・部屋の形（gimmicks-and-structures.md 2.2）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'rooms.<部屋の形>.<数値>'（例: 'rooms.example.heightM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const ROOMS_TUNING = {
} as const satisfies Record<string, Spec>;
