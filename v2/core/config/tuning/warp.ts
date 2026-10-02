/**
 * 段階 4・空間のゆがみと輪（2.5 の移動・2.13 X01・F27・F30）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'warp.<仕掛け・異変>.<数値>'（例: 'warp.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import type { Spec } from '../spec.ts';

export const WARP_TUNING = {
} as const satisfies Record<string, Spec>;
