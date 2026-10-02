/**
 * 調整表の項目の型と作り方（tuning.ts と、担当ごとの調整値 tuning/*.ts で使う）。
 */
export interface NumberSpec { readonly kind: 'number'; readonly default: number; readonly min: number; readonly max: number; readonly integer?: boolean; readonly note: string }
export interface BooleanSpec { readonly kind: 'boolean'; readonly default: boolean; readonly note: string }
export type Spec = NumberSpec | BooleanSpec;

export const num = (def: number, min: number, max: number, note: string, integer = false): NumberSpec =>
  ({ kind: 'number', default: def, min, max, note, ...(integer ? { integer } : {}) });
export const bool = (def: boolean, note: string): BooleanSpec => ({ kind: 'boolean', default: def, note });
