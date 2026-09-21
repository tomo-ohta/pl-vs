/**
 * Generator クラス名 → レイアウト生成関数。生成直後に Modifier の layout フック（applyLayoutModifiers）を決定論で適用する。
 *
 * 統合担当向け: 呼び出し方
 * - generateLayout(p, fallback) のシグネチャは従来どおり。戻り値の RoomLayout に v1.3 の任意フィールド（zones / render / …）が付くことがある。
 * - Generator ごとのバリアント数は各 Generator ファイルの `variants`（無いものは layout.ts の既定値）を registerVariants で VARIANTS に束ねる。
 *   VARIANTS の import 元は従来どおり generators/layout.ts でよい。
 * - 新 Generator の追加手順: ファイルに generateX(p) と `export const variants = N` を書き、下の switch と GENERATOR_VARIANTS に 1 行ずつ足す。
 *   （data/index.ts の IMPLEMENTED_GENERATORS / ROOMLIKE_GENERATORS への追加は統合担当）
 */
import { registerVariants, type RoomLayout, type GenParams } from './layout';
import { generateCorridor } from './CorridorGenerator';
import { generateRoom } from './RoomGenerator';
import { generateParking } from './ParkingGenerator';
import { generateVertical } from './VerticalGenerator';
import { generateGrid } from './GridGenerator';
import { generateAtrium } from './AtriumGenerator';
import { generatePool, variants as poolVariants } from './PoolGenerator';
import { generateStreet, variants as streetVariants } from './StreetGenerator';
import { generateMegaStructure, variants as megaVariants } from './MegaStructureGenerator';
import { generateDynamicGrid, variants as dynamicGridVariants } from './DynamicGridGenerator';
import { applyLayoutModifiers } from '../modifiers';
import { applyWearLayout } from './wear';
import { applyDressing } from './dressing';
import { applyDecalRules } from './decals';
import { applyLightKelvin } from './presets';

/** Generator ごとのバリアント数（既存 6 種は layout.ts の既定値と同じ。Phase 3 で各ファイルが variants を export したらここで参照する） */
export const GENERATOR_VARIANTS: Record<string, number> = {
  CorridorGenerator: 16,
  RoomGenerator: 24,
  ParkingGenerator: 6,
  VerticalGenerator: 1,
  GridGenerator: 12,
  AtriumGenerator: 8,
  PoolGenerator: poolVariants,
  StreetGenerator: streetVariants,
  MegaStructureGenerator: megaVariants,
  DynamicGridGenerator: dynamicGridVariants,
};
registerVariants(GENERATOR_VARIANTS);

function generateRaw(p: GenParams, fallback: boolean): RoomLayout {
  if (fallback) return generateRoom(p);
  switch (p.def.generator) {
    case 'CorridorGenerator': return generateCorridor(p);
    case 'RoomGenerator': return generateRoom(p);
    case 'ParkingGenerator': return generateParking(p);
    case 'VerticalGenerator': return generateVertical(p);
    case 'GridGenerator': return generateGrid(p);
    case 'AtriumGenerator': return generateAtrium(p);
    case 'PoolGenerator': return generatePool(p);
    case 'StreetGenerator': return generateStreet(p);
    case 'MegaStructureGenerator': return generateMegaStructure(p);
    case 'DynamicGridGenerator': return generateDynamicGrid(p);
    default: return generateRoom(p);
  }
}

/** Generator クラス名 → レイアウト生成 + Modifier の layout post-pass。
 *  レイアウトは (definitionId, seed, variant, extraSockets, removedSockets, mainRect, holeLocal) の決定論的関数のまま */
export function generateLayout(p: GenParams, fallback: boolean): RoomLayout {
  // 色温度（V04 手順 9。担当 P1）: テンプレート別の範囲から部屋 seed で 1 値を選び palette.lightColor / ambient を決める。
  // Generator の前に行い、専用 fork で他の乱数列を消費しない（paletteFor を呼ぶ側 = WorldManager / GraphReference / VisualReview は変えない）
  applyLightKelvin(p.palette, p.def, p.template, p.rng.fork('kelvin'));
  const L = generateRaw(p, fallback);
  // 部屋別ドレッシング（参考画像に合わせた大物・サイン・照明色。Modifier より前）
  applyDressing(L, p);
  applyLayoutModifiers(L, p);
  // 全部屋共通の後処理（決定論。p.rng.fork で独立した乱数列）: 低確率の破れ（担当 W）→ デカール配置（担当 D）
  applyWearLayout(L, p);
  applyDecalRules(L, p);
  return L;
}
