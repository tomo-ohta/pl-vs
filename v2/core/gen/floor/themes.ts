/**
 * フロアの系統（施設の種類）。1 フロアは 1 つの系統で作る（廊下のテーマ・部屋のテーマの重み・扉の多さ・天井の高さ・廊下の幅・
 * 使いやすい骨組みの型）。テーマ名は v1 のテンプレート名（core/world/palettes.ts・core/gen/dress の家具の組と同じ語）。
 * 環境音の種類は v1 の audioPreset の語（client/audio/presetMap が読む日本語のラベル）。
 */
import type { Rarity } from './profile.ts';

export type PatternId = 'grid' | 'maze' | 'comb' | 'ring' | 'hub' | 'linear';

export interface FloorFamily {
  id: string;
  /** 図鑑・題に出す名前 */
  name: string;
  /** 廊下・曲がり角のテーマ */
  corridor: string;
  /** 部屋のテーマ [テーマ, 重み] */
  rooms: [string, number][];
  /** 広間（区画をまとめた大部屋）のテーマ */
  halls: [string, number][];
  /** 部屋の入口に扉を付ける確率 */
  doorChance: number;
  /** 廊下の幅（m） */
  corridorWidth: [number, number];
  /** 天井の高さ（m）: 廊下・部屋・広間 */
  corridorHeight: [number, number];
  roomHeight: [number, number];
  hallHeight: [number, number];
  /** 骨組みの型の重み */
  patterns: [PatternId, number][];
  /** 区画を広間にまとめる確率（区画ごと） */
  hallChance: number;
  /** 高さの違う区画を作る確率（つなぎごと。階段でつなぐ） */
  levelChance: number;
  /** 環境音（v1 の語）: 廊下・部屋 */
  corridorAudio: string;
  roomAudio: string;
  /** これより珍しいフロアにだけ出る（無ければどこでも） */
  minRarity?: Rarity;
  /** 出やすさ */
  weight: number;
}

export const FAMILIES: FloorFamily[] = [
  {
    id: 'office', name: 'オフィス', corridor: 'CorridorOffice', weight: 10,
    rooms: [['OfficeGrid', 3], ['SmallRoom', 2], ['LargeRoom', 1], ['Restroom', 0.6], ['ServerGrid', 0.4]],
    halls: [['OfficeGrid', 3], ['LargeRoom', 2]],
    doorChance: 0.7, corridorWidth: [2.0, 2.6], corridorHeight: [2.6, 2.8], roomHeight: [2.6, 3.0], hallHeight: [3.0, 3.6],
    patterns: [['grid', 3], ['comb', 3], ['ring', 1], ['hub', 1]], hallChance: 0.12, levelChance: 0.04,
    corridorAudio: '空調ハム・PCファン残響', roomAudio: '空調',
  },
  {
    id: 'hotel', name: 'ホテル', corridor: 'CorridorHotel', weight: 8,
    rooms: [['SmallRoom', 3], ['GenericRoom', 2], ['Restroom', 0.5]],
    halls: [['AtriumLobby', 2], ['LargeRoom', 1]],
    doorChance: 0.9, corridorWidth: [1.8, 2.2], corridorHeight: [2.4, 2.6], roomHeight: [2.5, 2.7], hallHeight: [3.4, 4.5],
    patterns: [['comb', 4], ['linear', 2], ['ring', 1]], hallChance: 0.06, levelChance: 0.03,
    corridorAudio: '静かな空調', roomAudio: '空調',
  },
  {
    id: 'school', name: '学校', corridor: 'CorridorSchool', weight: 7,
    rooms: [['Classroom', 4], ['LockerRoom', 1], ['Restroom', 0.7], ['SmallRoom', 1]],
    halls: [['LargeRoom', 2], ['PlayArea', 1]],
    doorChance: 0.8, corridorWidth: [2.6, 3.2], corridorHeight: [2.8, 3.0], roomHeight: [2.9, 3.2], hallHeight: [4.0, 6.0],
    patterns: [['comb', 4], ['linear', 2], ['grid', 1]], hallChance: 0.08, levelChance: 0.08,
    corridorAudio: '換気音・遠い時計', roomAudio: '換気音・遠い時計',
  },
  {
    id: 'hospital', name: '病院', corridor: 'CorridorHospital', weight: 6,
    rooms: [['SmallRoom', 3], ['GenericRoom', 2], ['Restroom', 1]],
    halls: [['LargeRoom', 2], ['Terminal', 1]],
    doorChance: 0.8, corridorWidth: [2.4, 3.0], corridorHeight: [2.7, 2.9], roomHeight: [2.6, 2.9], hallHeight: [3.0, 3.6],
    patterns: [['comb', 3], ['grid', 2], ['ring', 1]], hallChance: 0.08, levelChance: 0.03,
    corridorAudio: '空調・番号呼出音', roomAudio: '空調',
  },
  {
    id: 'backrooms', name: 'バックルーム', corridor: 'MazeGrid', weight: 6,
    rooms: [['MazeGrid', 3], ['GenericRoom', 1], ['StorageGrid', 1]],
    halls: [['MazeGrid', 2], ['LargeRoom', 1]],
    doorChance: 0.1, corridorWidth: [1.8, 2.6], corridorHeight: [2.5, 2.7], roomHeight: [2.5, 2.8], hallHeight: [2.6, 3.0],
    patterns: [['maze', 4], ['grid', 2]], hallChance: 0.2, levelChance: 0.02,
    corridorAudio: '低いハム', roomAudio: '低いハム',
  },
  {
    id: 'service', name: '設備区画', corridor: 'CorridorService', weight: 5,
    rooms: [['StorageGrid', 2], ['ServerGrid', 1], ['WarehouseGrid', 1], ['ServiceMaze', 1]],
    halls: [['WarehouseGrid', 2], ['ParkingGrid', 1]],
    doorChance: 0.6, corridorWidth: [1.6, 2.2], corridorHeight: [2.4, 2.8], roomHeight: [2.8, 3.4], hallHeight: [4.0, 6.5],
    patterns: [['maze', 2], ['grid', 2], ['comb', 1]], hallChance: 0.12, levelChance: 0.12,
    corridorAudio: '換気・反響', roomAudio: '駆動音',
  },
  {
    id: 'transit', name: '駅の連絡通路', corridor: 'TransitCorridor', weight: 5,
    rooms: [['Terminal', 2], ['RetailRoom', 1], ['Restroom', 1]],
    halls: [['Terminal', 3], ['AtriumLobby', 1]],
    doorChance: 0.2, corridorWidth: [3.6, 5.0], corridorHeight: [2.8, 3.2], roomHeight: [3.0, 3.6], hallHeight: [4.5, 7.0],
    patterns: [['linear', 3], ['hub', 2], ['grid', 1]], hallChance: 0.18, levelChance: 0.15,
    corridorAudio: '換気・遠い列車音', roomAudio: '換気・足音反響',
  },
  {
    id: 'mall', name: 'ショッピングモール', corridor: 'GenericCorridor', weight: 5,
    rooms: [['RetailRoom', 3], ['RetailGrid', 2], ['Restroom', 0.5]],
    halls: [['AtriumLobby', 3], ['RetailGrid', 1]],
    doorChance: 0.3, corridorWidth: [3.0, 4.2], corridorHeight: [3.0, 3.4], roomHeight: [3.0, 3.6], hallHeight: [5.0, 8.0],
    patterns: [['hub', 3], ['ring', 2], ['grid', 1]], hallChance: 0.2, levelChance: 0.1,
    corridorAudio: '低いBGM・空調', roomAudio: '空調・微かなBGM',
  },
  {
    id: 'library', name: '図書館・美術館', corridor: 'GenericCorridor', weight: 4,
    rooms: [['ShelfGrid', 3], ['Gallery', 2], ['SmallRoom', 0.5]],
    halls: [['Gallery', 2], ['ShelfGrid', 2]],
    doorChance: 0.5, corridorWidth: [2.2, 3.0], corridorHeight: [2.8, 3.2], roomHeight: [3.0, 3.8], hallHeight: [4.5, 7.0],
    patterns: [['grid', 2], ['ring', 2], ['hub', 1]], hallChance: 0.18, levelChance: 0.08,
    corridorAudio: '静かな空調', roomAudio: '静かな空調',
  },
  {
    id: 'pool', name: '屋内プール', corridor: 'PoolCorridor', weight: 3,
    rooms: [['LockerRoom', 2], ['Restroom', 1], ['PoolCorridor', 1]],
    halls: [['PoolCorridor', 3]],
    doorChance: 0.4, corridorWidth: [2.0, 2.8], corridorHeight: [2.6, 2.9], roomHeight: [2.7, 3.0], hallHeight: [4.5, 7.5],
    patterns: [['linear', 2], ['grid', 2], ['hub', 1]], hallChance: 0.25, levelChance: 0.05,
    corridorAudio: '換気・水滴', roomAudio: '換気扇・水滴',
  },
  {
    id: 'apartment', name: '集合住宅', corridor: 'ApartmentCorridor', weight: 4,
    rooms: [['GenericRoom', 3], ['SmallRoom', 2], ['Restroom', 0.6]],
    halls: [['LargeRoom', 1]],
    doorChance: 0.95, corridorWidth: [1.6, 2.0], corridorHeight: [2.4, 2.6], roomHeight: [2.4, 2.6], hallHeight: [2.8, 3.2],
    patterns: [['comb', 4], ['linear', 2]], hallChance: 0.04, levelChance: 0.06,
    corridorAudio: '換気扇・遠い車道音', roomAudio: '冷蔵庫・蛍光灯',
  },
  {
    id: 'warehouse', name: '倉庫・駐車場', corridor: 'CorridorService', weight: 3,
    rooms: [['WarehouseGrid', 2], ['StorageGrid', 2]],
    halls: [['ParkingGrid', 2], ['WarehouseGrid', 2]],
    doorChance: 0.3, corridorWidth: [2.4, 3.6], corridorHeight: [2.8, 3.2], roomHeight: [3.2, 4.2], hallHeight: [3.6, 6.0],
    patterns: [['grid', 2], ['hub', 1], ['maze', 1]], hallChance: 0.3, levelChance: 0.1,
    corridorAudio: '台車の軋み・換気設備', roomAudio: '冷蔵機・台車', minRarity: 'Uncommon',
  },
  {
    id: 'entertainment', name: 'カラオケ・娯楽施設', corridor: 'CorridorEntertainment', weight: 3,
    rooms: [['SmallRoom', 3], ['Theater', 1], ['PlayArea', 1]],
    halls: [['Theater', 2], ['PlayArea', 1]],
    doorChance: 0.85, corridorWidth: [1.6, 2.0], corridorHeight: [2.3, 2.5], roomHeight: [2.4, 2.7], hallHeight: [4.0, 6.0],
    patterns: [['comb', 3], ['maze', 1], ['ring', 1]], hallChance: 0.08, levelChance: 0.05,
    corridorAudio: '低いBGM・空調', roomAudio: '空調・電子音', minRarity: 'Uncommon',
  },
];

export function familyById(id: string): FloorFamily {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`フロアの系統がありません: ${id}`);
  return f;
}
