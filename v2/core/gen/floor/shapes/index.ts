/**
 * 形を丸ごと作る型（区画の格子に乗らない形）: 螺旋（F12）・縮むくり返し（F20）・屋上（F33）。
 * どれも GeoBuild（geometry.ts）で区画・開口・扉・入口と出口の階段を作り、FloorGeometry を返す。
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { Rng } from '../../../math/rng.ts';
import type { FloorGeometry } from '../geometry.ts';
import type { FloorProfile } from '../profile.ts';
import type { PatternId } from '../themes.ts';

export type ShapeBuilder = (p: FloorProfile, rng: Rng, t: Tuning) => FloorGeometry;

export const SHAPES: Partial<Record<PatternId, ShapeBuilder>> = {};
