/**
 * warpSign: 描画だけの掲示（文字の板・札）。シミュレーションでは何もしない（描画 client/views/warp/sign.ts が params の文字を描く）。
 * params: pos（板の真ん中）・dir（板の表が向く向き）・w・h・lines（文字の行）・style（'board' 壁の掲示 / 'plate' 札）
 */
import { definePart } from '../../part.ts';

definePart<Record<string, never>>({
  type: 'warpSign',
  init: () => ({}),
});

/**
 * warpPortal: 描画だけの部品（窓・枠の向こうに別の所を描く板。client/views/warp/portal.ts）。シミュレーションでは何もしない。
 * params: center・dir・w・h・xform・cells?・needs?
 */
definePart<Record<string, never>>({
  type: 'warpPortal',
  init: () => ({}),
});

/** warpLinks: 何もしない部品（歩く人（試験）の道順 params.warpLinks だけを持つ。光の枠のように、移す部品が道順を持たないとき） */
definePart<Record<string, never>>({
  type: 'warpLinks',
  init: () => ({}),
});
