import type { VendingOpts } from '../../../props/lib/index.ts';

/**
 * 校舎の間の通路の小物の色の表（実物の色。場所の色へは alleyMats が写す）。
 */

/** 自販機 2 台（青い飲料の自販機・赤い飲料の自販機） */
export const VENDING: VendingOpts[] = [
  { body: '#2c5c8c', accent: '#e6e9e3', lit: '#f4f7ee' },
  { body: '#c23a33', accent: '#e9ece6', lit: '#f4f7ee' },
];

/** 自転車のフレームの色（銀・黒・紺・白・えんじ・緑・灰） */
export const BIKE_COLORS = ['#c9ced0', '#2a2f3a', '#2c3f66', '#e8e8e2', '#7a2e30', '#3f5a48', '#8a8f92'];
