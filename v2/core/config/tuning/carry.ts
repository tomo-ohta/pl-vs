/**
 * 段階 4・物を運ぶ・パズル・ミニゲーム（2.10・4.7 のパズル・2.15）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'carry.<仕掛け・異変>.<数値>'（例: 'carry.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const CARRY_TUNING = {
} as const satisfies Record<string, Spec>;
