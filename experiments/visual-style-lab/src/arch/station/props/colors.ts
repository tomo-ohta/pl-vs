import type { CarOpts, ShelfOpts, VendingOpts } from '../../../props/lib/index.ts';

/**
 * 駅で使う小物の色（実物の色。駅の色へは mats.ts の stationColor が寄せる）。
 * 霧の駅の色の表: 青緑の白・灰緑・濃い青緑・沈んだ赤と黄。小物の色もこの中に収める（派手な色は少しだけ）
 */
export const STATION_COLORS = {
  ticket: { body: '#3e5c60', panel: '#c9d0cc', screen: '#a6d6cb', band: '#2f6a8a' },
  locker: { body: '#c3ccc5', door: '#d4dbd5', sign: '#2f6a8a' },
  vendingWhite: { body: '#e9ece6', accent: '#3d78b8' } satisfies VendingOpts,
  vendingRed: { body: '#c9433b', accent: '#e9ece6', goodsColors: ['#c94a45', '#e8e4d6', '#2d3f55', '#d9a43a', '#8a5a3b', '#b8d7e3'] } satisfies VendingOpts,
  bins: { kind: 'recycle' as const, body: '#9aa8a4', lid: '#4c7f7c', n: 3 },
  plant: { pot: '#8a7a62', leaf: '#4f7d5c', h: 1.05 },
  officeChair: { kind: 'office' as const, seat: '#3f5f63' },
  officeShelf: { load: ['paper', 'binders', 'cardboard', 'paper'], frame: '#c3c9c3' } satisfies ShelfOpts,
  carWhite: { body: '#e7ebe6' } satisfies CarOpts,
  carHatch: { type: 'hatch', body: '#9fb7c0' } satisfies CarOpts,
  carNavy: { body: '#3c5677' } satisfies CarOpts,
  truck: { body: '#eef0ea' },
  bikeSilver: { frame: '#cfd9d6' },
  bikeRed: { frame: '#a8463f' },
  bikeBlack: { frame: '#2a3233' },
  drums: ['#3d6f9a', '#8a4a3a', '#6f6a5a', '#3f6f5a'],
};
