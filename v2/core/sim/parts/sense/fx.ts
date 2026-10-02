/**
 * 見た目と音だけの部品（段階 4・担当 sense）: senseFx。シミュレーションでは何もしない（状態も出力も無い）。
 * 描画（client/views/sense/fx.ts）が params.fx の種類ごとに、区画にいる間の音・画面の効果・光る印を作る
 * （部屋の異変の効果・暗闇でだけ光る扉の縁 など）。決定論に関わる物はここに置かない
 */
import { definePart } from '../../part.ts';

definePart({
  type: 'senseFx',
  init: () => ({}),
});
