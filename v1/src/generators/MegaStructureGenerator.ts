/** MegaStructureGenerator（MegaAtrium / MegaHall: Legendary 10 部屋。60〜160 m、xl 200 m）。
 *  - variant = サイズ 5 段（160 / 120 / 96 / 72 / 60 m） × 入口位置 4（中央 / 左 1/4 / 右 1/4 / 角寄り）= 20。WorldManager が 0 から順に試す
 *  - 1 定義 = 1 RoomNode + 1 RoomLayout。内部は RoomBuilder がチャンク（L.chunkSize 28〜32 m）に分ける
 *  - MegaHall（L02 / L03 / L12）: 巨大床 + 柱グリッド + 環境要素 → MegaStructureGenerator.hall.ts
 *  - MegaAtrium（L04 / L05 / L07 / L09 / L11 / L14 / L19）: 吹抜 + 多層回廊（3.6 m 単位）+ 階段 + ゾーン → MegaStructureGenerator.atrium.ts
 *  - 共通部品（寸法表・構造・ゾーン・予算）→ MegaStructureGenerator.common.ts
 *  出力: footprint / sockets（上階の出口は pos[1] = 3.6k）/ boxes（先頭 shellCount 個 = シェル + 構造）/ zones（kind 'theme' など）/
 *        lights / signs / path / fogFar / chunkSize / elevators（EV 籠）。Seam は使わない（遠方配置は WorldManager 側）。 */
import { generateRoom } from './RoomGenerator';
import type { GenParams, RoomLayout } from './layout';
import { VARIANT_COUNT } from './MegaStructureGenerator.common';
import { generateMegaHall } from './MegaStructureGenerator.hall';
import { generateMegaAtrium } from './MegaStructureGenerator.atrium';

/** バリアント数（WorldManager が 0..n-1 を大きい順に試す） */
export const variants = VARIANT_COUNT;

export function generateMegaStructure(p: GenParams): RoomLayout {
  switch (p.template.id) {
    case 'MegaHall': return generateMegaHall(p);
    case 'MegaAtrium': return generateMegaAtrium(p);
    default: return generateRoom(p);
  }
}
