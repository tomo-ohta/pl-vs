/**
 * warpSign: 描画だけの掲示（文字の板・札）。シミュレーションでは何もしない（描画 client/views/warp/sign.ts が params の文字を描く）。
 * params: pos（板の真ん中）・dir（板の表が向く向き）・w・h・lines（文字の行）・style（'board' 壁の掲示 / 'plate' 札）
 */
import { definePart } from '../../part.ts';

definePart<Record<string, never>>({
  type: 'warpSign',
  init: () => ({}),
});
