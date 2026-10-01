import roomsJson from '../../data/rooms.json';
import templatesJson from '../../data/templates.json';
import modifiersJson from '../../data/modifiers.json';
import type { RoomDefinition, TemplateDef, Rarity } from '../core/types';

export interface ModifierDef {
  id: string;
  target: string;
  parameters: string;
  implementation: string;
  cost: string;
  usedBy: string[];
  notes?: string | null;
  /** v1.3: 実装対象 / 保留 などの状態ラベル */
  status?: string | null;
  /** v1.3: 保留（FutureAudio / RewindState / DiscoveryGate） */
  deferred?: boolean;
}

/** v1.3 でオミットした部屋（生成対象から除外。ID は欠番として残す）。rooms.json 側でも `omitted[]` に分離されるが、コードでも二重に守る */
export const OMITTED_ROOM_IDS: ReadonlySet<string> = new Set(['E10', 'M05', 'M06', 'M10', 'M15', 'M20']);

const roomsData = roomsJson as { rooms: RoomDefinition[]; omitted?: RoomDefinition[] };
/** 抽選対象の定義（オミット済みを含まない） */
export const ROOMS: RoomDefinition[] = roomsData.rooms.filter((r) => !OMITTED_ROOM_IDS.has(r.id));
/** オミット済みの定義（rooms.json の omitted[] + rooms[] に残っていた場合）。セーブ済みノードの参照解決にだけ使う */
export const OMITTED_ROOMS: RoomDefinition[] = [...(roomsData.omitted ?? []), ...roomsData.rooms.filter((r) => OMITTED_ROOM_IDS.has(r.id))];
export const TEMPLATES: TemplateDef[] = (templatesJson as { templates: TemplateDef[] }).templates;
export const MODIFIERS: ModifierDef[] = (modifiersJson as { modifiers: ModifierDef[] }).modifiers;

/** 全定義（オミット含む。セーブ済みノードの参照解決用。抽選には ROOMS_BY_RARITY を使う） */
export const ROOM_BY_ID = new Map([...OMITTED_ROOMS, ...ROOMS].map((r) => [r.id, r]));
export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
/** 抽選対象（オミット部屋を除く） */
export const ROOMS_BY_RARITY = new Map<Rarity, RoomDefinition[]>();
for (const r of ROOMS) {
  if (OMITTED_ROOM_IDS.has(r.id)) continue;
  if (!ROOMS_BY_RARITY.has(r.rarity)) ROOMS_BY_RARITY.set(r.rarity, []);
  ROOMS_BY_RARITY.get(r.rarity)!.push(r);
}

export function isOmitted(def: RoomDefinition): boolean {
  return OMITTED_ROOM_IDS.has(def.id);
}

/** 実装済みの Generator クラス（Pool / Street / MegaStructure / DynamicGrid は F1 のスタブ。generateRoom 委譲なので追加しても安全） */
export const IMPLEMENTED_GENERATORS = new Set([
  'CorridorGenerator', 'RoomGenerator', 'ParkingGenerator', 'VerticalGenerator', 'GridGenerator', 'AtriumGenerator',
  'PoolGenerator', 'StreetGenerator', 'MegaStructureGenerator', 'DynamicGridGenerator',
]);
/** hole の落下先に使える（天井穴の入口を持てる）Generator */
export const ROOMLIKE_GENERATORS = new Set(['RoomGenerator', 'ParkingGenerator', 'GridGenerator', 'AtriumGenerator', 'StreetGenerator', 'MegaStructureGenerator']);
/** SEAM-4: 一段小さい定義で再抽選するときの baseTemplate */
export const SMALL_TEMPLATES: ReadonlySet<string> = new Set(['SmallRoom', 'Restroom']);

export function isImplemented(def: RoomDefinition): boolean {
  return IMPLEMENTED_GENERATORS.has(def.generator);
}

/** 基礎重み（07 シートの 55 / 25 / 12 / 5 / 2.5 / 0.5 から、Rare 以上を増やした値。xlsx 未反映） */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  Common: 33, Uncommon: 24, Rare: 19, Epic: 18, Legendary: 4, Mythic: 6.5,
};
/** 最低深度（07 シートの 4 / 10 / 20 / 35 から前倒し。xlsx 未反映） */
export const RARITY_MIN_DEPTH: Record<Rarity, number> = {
  Common: 0, Uncommon: 0, Rare: 2, Epic: 5, Legendary: 10, Mythic: 18,
};
export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#9aa3b2', Uncommon: '#6fcf97', Rare: '#5aa9ff', Epic: '#b57bff', Legendary: '#f2c14e', Mythic: '#ff6b81',
};
