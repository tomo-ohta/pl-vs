import { WARD } from './mats.ts';

/**
 * 共通の小物（src/props/lib）を病棟の色で使うときの値。見本帳と場面で同じ値を使う
 */
export const commonOpts = {
  officeChair: (seat: string = WARD.dark) => ({ kind: 'office' as const, seat, frame: WARD.steel }),
  vending: () => ({
    body: WARD.teal,
    accent: WARD.cream,
    lit: '#f4f8ea',
    goodsColors: [WARD.red, '#8fa6b0', WARD.cream, '#d9a43a', '#6f9f74', WARD.orange, WARD.dark, '#b8d7d3', '#8a6a4b', '#e9d77a'],
    cold: '#5f8fc0',
    hot: WARD.red,
  }),
  cooler: () => ({ body: WARD.white, top: WARD.steel }),
  plant: (h = 1.1) => ({ pot: WARD.board, leaf: '#6f8f74', h }),
  seats: (w: number, seat: string = WARD.olive) => ({ kind: 'seats' as const, w, seat, frame: WARD.steel }),
  extinguisher: () => ({ red: '#c05d60' }),
};
