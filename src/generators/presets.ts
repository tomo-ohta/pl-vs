/** 建築用途別の素材・照明パレット。共通PBR素材で全生成器をカバーする。 */
import type { RoomDefinition, TemplateDef } from '../core/types';
import type { Palette } from './layout';

const BASE: Record<string, Partial<Palette>> = {
  // ビジネスホテル廊下（参考 3）: 低い無地の天井（グリッド天井ではなく塗り天井）
  CorridorHotel: { floor: 'floorCarpetRed', wall: 'wallBeige', ceiling: 'wallWhite', door: 'doorWood' },
  // マンション共用廊下（参考 8）: 軒天は塗り（グリッド天井ではない）
  ApartmentCorridor: { floor: 'floorConcrete', wall: 'wallCream', ceiling: 'wallWhite', door: 'doorMetal' },
  // カラオケ店廊下（参考 17）: 赤茶の布張り壁 + 黒い扉
  CorridorEntertainment: { floor: 'floorCarpetRed', wall: 'upholstery', ceiling: 'ceilingDark', door: 'metalDark' },
  // オフィス廊下（参考 2）: ベージュ無地の壁（wallBeige）。wallCream は CC0 の Plaster001 の斑が強く「無地」に見えないため不採用。
  // 担当 M が wallWhite 自体を暖かい生成りへ寄せるので、wallWhite のままの待合室 / 休憩室 / 汎用廊下と二重に暗くしない
  CorridorOffice: { floor: 'floorCarpetGrey', wall: 'wallBeige', ceiling: 'ceilingTile', door: 'doorWood' },
  CorridorSchool: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  // 病院外来廊下（参考 5）: 生成りの壁 + wainscotCream の腰壁 + 木目の手すり
  CorridorHospital: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorWood' },
  CorridorService: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  // 駅の連絡通路 / 地下歩道（参考 7・19）: 白タイルの壁
  TransitCorridor: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorMetal' },
  GenericCorridor: { floor: 'floorCarpetGrey', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  Bridge: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  LargeRoom: { floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorWood' },
  SmallRoom: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  GenericRoom: { floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'doorWood' },
  Classroom: { floor: 'floorWood', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  Restroom: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorWood' },
  LockerRoom: { floor: 'floorTile', wall: 'wallGreen', ceiling: 'ceilingWhite', door: 'doorMetal' },
  RetailRoom: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'glass' },
  Theater: { floor: 'floorCarpetRed', wall: 'wallDark', ceiling: 'ceilingDark', door: 'doorWood' },
  Gallery: { floor: 'floorWood', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'doorWood' },
  OfficeGrid: { floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorWood' },
  PlayArea: { floor: 'floorCarpetRed', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  OrganicZone: { floor: 'floorConcrete', wall: 'glass', ceiling: 'glass', door: 'doorMetal' },
  ParkingGrid: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  WarehouseGrid: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  ShelfGrid: { floor: 'floorWood', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorWood' },
  RetailGrid: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'glass' },
  StorageGrid: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  MazeGrid: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorMetal' },
  ServerGrid: { floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorMetal' },
  ServiceMaze: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  AtriumLobby: { floor: 'floorTile', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  Terminal: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'glass' },
  VerticalCore: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  // Phase 2 の新 Generator（各 Generator は layout.palette を自分でも上書きする。ここは paletteFor を直接読む側・前室との整合用）
  PoolCorridor: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorMetal' },
  DynamicGrid: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorMetal' },
  StreetGrid: { floor: 'floorAsphalt', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  RoadGraph: { floor: 'floorAsphalt', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
};

/** 廊下系テンプレートの照明（器具の種類・色・強さ・環境光）。lightingPreset の語による推定より優先する
 *  （docs/reference-common-analysis.md: 器具の列は全体で少し暗め、ホテル / カラオケは暖色の点光源、病院は高照度の白） */
const CORRIDOR_LIGHT: Record<string, Partial<Palette>> = {
  CorridorOffice: { light: 'lightPanel', lightColor: 0xe9f0ff, lightIntensity: 1.0 },
  CorridorSchool: { light: 'lightPanel', lightColor: 0xdde8ff, lightIntensity: 0.85 },
  CorridorHospital: { light: 'lightPanel', lightColor: 0xf3f6ff, lightIntensity: 1.15, ambient: 0x9a9eaa },
  CorridorHotel: { light: 'lightWarm', lightColor: 0xffc98a, lightIntensity: 0.7, ambient: 0x6b5a47 },
  CorridorEntertainment: { light: 'lightWarm', lightColor: 0xffb070, lightIntensity: 0.5, ambient: 0x3a2826, fog: 0x0c0608 },
  CorridorService: { light: 'lightPanel', lightColor: 0xe2ecff, lightIntensity: 0.9 },
  ApartmentCorridor: { light: 'lightWarm', lightColor: 0xffd9a0, lightIntensity: 0.7, ambient: 0x6e6658 },
  TransitCorridor: { light: 'lightPanel', lightColor: 0xf0f4ff, lightIntensity: 1.0 },
};

const DEFAULT: Palette = {
  floor: 'floorCarpetGrey', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood',
  light: 'lightPanel', lightColor: 0xdfe8ff, lightIntensity: 1.0, ambient: 0x8a90a0, fog: 0x0b0d14,
};

export function paletteFor(def: RoomDefinition, template: TemplateDef, fallback: boolean): Palette {
  const base = { ...DEFAULT, ...(BASE[template.id] ?? BASE[template.baseTemplate ?? ''] ?? {}) };
  const l = def.lightingPreset;
  if (/暖色|電球|橙|夕|琥珀/.test(l)) {
    base.light = 'lightWarm';
    base.lightColor = 0xffd9a0;
    base.ambient = 0x8f7a60;
  } else if (/冷白|蛍光|白色|均一/.test(l)) {
    base.light = 'lightPanel';
    base.lightColor = 0xe9f0ff;
    base.ambient = 0x8a90a0;
  }
  if (/低照度|暗|一部消灯|非常灯|薄明/.test(l)) {
    base.lightIntensity = 0.55;
    base.ambient = 0x50545e;
  }
  if (/青|水族|水中/.test(l)) {
    base.lightColor = 0x9fc8ff;
    base.fog = 0x0a1a33;
  }
  Object.assign(base, CORRIDOR_LIGHT[template.id] ?? CORRIDOR_LIGHT[template.baseTemplate ?? ''] ?? {});
  if (fallback) {
    base.floor = 'placeholder';
    base.wall = 'wallWhite';
  }
  return base;
}
