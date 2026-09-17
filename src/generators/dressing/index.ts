/**
 * 部屋別ドレッシング（v1.3 第6回）: 参考画像（Uncommon / Rare / Epic / Legendary / Mythic のボード）に合わせて、
 * 定義 ID ごとに「その部屋らしさ」を出す大物・サイン・照明色・パレットを決定論で足す。
 * generateLayout で Generator の直後（Modifier の layout フックより前）に呼ばれる。
 * - 乱数は p.rng.fork('dress') だけを使う（Generator / Modifier の乱数列を変えない）
 * - footprint・ソケット・扉前 1.6 m と動線 1.2 m は変えない。追加箔はソリッドでも可（当たり判定は clearDoorways 相当で確保）
 * - 部屋あたり 箱 +300 / 三角形 +40k / ライト +2 以内（部屋切り替え時のフリーズ防止）。反復物は L.instances を使う
 * - 見た目の基準は docs/reference-rarities-analysis.md
 */
import type { GenParams, RoomLayout } from '../layout';
import { dressUncommon } from './uncommon';
import { dressRare } from './rare';
import { dressEpic } from './epic';
import { dressLegendary } from './legendary';
import { dressMythic } from './mythic';

export function applyDressing(L: RoomLayout, p: GenParams): void {
  const rng = p.rng.fork('dress');
  switch (p.def.rarity) {
    case 'Uncommon': return dressUncommon(L, p, rng);
    case 'Rare': return dressRare(L, p, rng);
    case 'Epic': return dressEpic(L, p, rng);
    case 'Legendary': return dressLegendary(L, p, rng);
    case 'Mythic': return dressMythic(L, p, rng);
    default: return;
  }
}
